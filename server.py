"""Record Room - Backend Server v2"""
import os, sqlite3, hashlib
from datetime import datetime
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, session

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'data_manager.db')
STATIC_DIR = os.path.join(BASE_DIR, 'static')

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='')
app.secret_key = 'record-room-2026-secret'

from beneficiaries import beneficiaries_bp, init_beneficiary_tables
from stock import stock_bp, init_stock_tables, init_thr_recipe_tables
from attendance import attendance_bp, init_attendance_tables
from thr_dist import thr_dist_bp, init_thr_dist_tables
from settings import settings_bp, init_settings_tables, init_app_settings_table
from reports import reports_bp, init_report_tables


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def hash_password(pw):
    return hashlib.sha256(pw.encode('utf-8')).hexdigest()


def now_iso():
    return datetime.utcnow().isoformat(timespec='seconds') + 'Z'


def column_exists(conn, table, column):
    cur = conn.execute('PRAGMA table_info(' + table + ')')
    return any(row[1] == column for row in cur.fetchall())


def add_col(conn, table, column, ddl):
    if not column_exists(conn, table, column):
        conn.execute('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + ddl)


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS families (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aush_number INTEGER UNIQUE NOT NULL,
        family_name TEXT NOT NULL,
        husband_name TEXT,
        house_number TEXT,
        address TEXT,
        village TEXT,
        ward TEXT,
        pincode TEXT,
        latitude REAL,
        longitude REAL,
        location_accuracy_meters REAL,
        survey_status TEXT,
        survey_date TEXT,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS family_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER NOT NULL,
        full_name TEXT NOT NULL,
        gender TEXT,
        date_of_birth TEXT,
        aadhaar_number TEXT,
        jan_aadhaar_number TEXT,
        social_category TEXT,
        caste TEXT,
        mobile TEXT,
        alternate_mobile TEXT,
        relation_to_head TEXT,
        occupation TEXT,
        religion TEXT,
        marital_status TEXT,
        voter_id_number TEXT,
        is_family_head INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE)''')
    c.execute('''CREATE TABLE IF NOT EXISTS family_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        family_id INTEGER NOT NULL,
        member_id INTEGER,
        user_id INTEGER,
        username TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        detail TEXT,
        old_values TEXT,
        new_values TEXT,
        effective_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE)''')
    conn.commit()

    add_col(conn, 'families', 'husband_name', 'TEXT')
    add_col(conn, 'families', 'survey_status', 'TEXT')
    add_col(conn, 'families', 'survey_date', 'TEXT')
    add_col(conn, 'families', 'created_by', 'INTEGER')
    add_col(conn, 'families', 'updated_by', 'INTEGER')
    add_col(conn, 'families', 'location_accuracy_meters', 'REAL')
    add_col(conn, 'family_logs', 'user_id', 'INTEGER')
    add_col(conn, 'family_logs', 'username', 'TEXT')
    add_col(conn, 'families', 'category', 'TEXT')
    add_col(conn, 'families', 'religion', 'TEXT')
    conn.commit()

    c.execute('SELECT id FROM users WHERE username = ?', ('admin',))
    if not c.fetchone():
        t = now_iso()
        c.execute('INSERT INTO users (username, password_hash, full_name, created_at, updated_at) VALUES (?,?,?,?,?)',
                  ('admin', hash_password('admin123'), 'Super Admin', t, t))
        conn.commit()
    conn.close()


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': 'Not authenticated'}), 401
        return f(*args, **kwargs)
    return wrapper


def add_log(conn, family_id, member_id, action, entity_type, detail, old_values=None, new_values=None, effective_at=None):
    conn.execute('''INSERT INTO family_logs
        (family_id, member_id, user_id, username, action, entity_type, detail, old_values, new_values, effective_at, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
        (family_id, member_id, session.get('user_id'), session.get('username'),
         action, entity_type, detail, old_values, new_values, effective_at, now_iso()))




def find_aadhaar_owner(conn, aadhaar, exclude_member_id=None):
    clean = (aadhaar or '').replace('-', '').strip()
    if not clean:
        return None
    sql = 'SELECT m.id, m.full_name, f.aush_number, f.family_name FROM family_members m JOIN families f ON f.id = m.family_id WHERE REPLACE(m.aadhaar_number, "-", "") = ? AND m.is_active = 1'
    params = [clean]
    if exclude_member_id:
        sql += ' AND m.id != ?'
        params.append(exclude_member_id)
    sql += ' LIMIT 1'
    return conn.execute(sql, params).fetchone()


def aadhaar_conflict_msg(row, is_head=False):
    label = 'Head Aadhaar' if is_head else 'Aadhaar'
    return label + ' pehle se maujood hai - Family #' + str(row['aush_number']) + ' (' + (row['family_name'] or '') + ') ke sadasya "' + (row['full_name'] or '') + '" ke saath.'

# ==================== AUTH ====================
@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    u = (data.get('username') or '').strip()
    p = data.get('password') or ''
    if not u or not p:
        return jsonify({'error': 'Username and password required'}), 400
    conn = get_db()
    row = conn.execute('SELECT * FROM users WHERE username = ?', (u,)).fetchone()
    conn.close()
    if not row or row['password_hash'] != hash_password(p):
        return jsonify({'error': 'Invalid username or password'}), 401
    session['user_id'] = row['id']
    session['username'] = row['username']
    return jsonify({'ok': True, 'user': {'username': row['username'], 'full_name': row['full_name']}})


@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'ok': True})


@app.route('/api/me', methods=['GET'])
def api_me():
    if not session.get('user_id'):
        return jsonify({'authenticated': False})
    return jsonify({'authenticated': True, 'username': session.get('username')})


# ==================== HELPERS ====================
def validate_member_fields(d):
    errs = []
    name = (d.get('full_name') or '').strip()
    if not name:
        errs.append('Name is required')
    aadhaar = (d.get('aadhaar_number') or '').replace('-', '').strip()
    if aadhaar:
        if not aadhaar.isdigit() or len(aadhaar) != 12:
            errs.append('Aadhaar must be 12 digits')
    mobile = (d.get('mobile') or '').strip()
    if mobile and (not mobile.isdigit() or len(mobile) != 10):
        errs.append('Mobile must be 10 digits')
    alt = (d.get('alternate_mobile') or '').strip()
    if alt and (not alt.isdigit() or len(alt) != 10):
        errs.append('Alternate Mobile must be 10 digits')
    if mobile and alt and mobile == alt:
        errs.append('Mobile and Alternate Mobile must be different')
    return errs, name, aadhaar


# ==================== FAMILIES ====================
@app.route('/api/families', methods=['GET'])
@login_required
def list_families():
    s = (request.args.get('search') or '').strip().lower()
    conn = get_db()
    if s:
        s_clean = s.replace('-', '').replace(' ', '')
        like = '%' + s + '%'
        like_clean = '%' + s_clean + '%'
        q = '''SELECT DISTINCT f.* FROM families f
               LEFT JOIN family_members m ON m.family_id = f.id AND m.is_active = 1
               WHERE f.is_active = 1 AND (
                 LOWER(f.family_name) LIKE ? OR
                 CAST(f.aush_number AS TEXT) LIKE ? OR
                 LOWER(COALESCE(f.house_number,'')) LIKE ? OR
                 LOWER(COALESCE(f.husband_name,'')) LIKE ? OR
                 LOWER(COALESCE(f.address,'')) LIKE ? OR
                 LOWER(COALESCE(m.full_name,'')) LIKE ? OR
                 REPLACE(REPLACE(COALESCE(m.aadhaar_number,''),'-',''),' ','') LIKE ? OR
                 REPLACE(COALESCE(m.mobile,''),' ','') LIKE ? OR
                 LOWER(COALESCE(m.voter_id_number,'')) LIKE ? OR
                 LOWER(COALESCE(m.jan_aadhaar_number,'')) LIKE ?
               ) ORDER BY f.aush_number ASC'''
        rows = conn.execute(q, (like, like, like, like, like, like, like_clean, like_clean, like, like)).fetchall()
    else:
        rows = conn.execute('SELECT * FROM families WHERE is_active = 1 ORDER BY aush_number ASC').fetchall()

    out = []
    for r in rows:
        d = dict(r)
        head = conn.execute('''SELECT full_name, date_of_birth, gender, aadhaar_number, mobile
                               FROM family_members
                               WHERE family_id = ? AND is_family_head = 1 AND is_active = 1
                               LIMIT 1''', (r['id'],)).fetchone()
        d['head_name'] = head['full_name'] if head else None
        d['head_dob'] = head['date_of_birth'] if head else None
        d['head_gender'] = head['gender'] if head else None
        d['head_aadhaar'] = head['aadhaar_number'] if head else None
        d['head_mobile'] = head['mobile'] if head else None
        cnt = conn.execute('SELECT COUNT(*) AS c FROM family_members WHERE family_id = ? AND is_active = 1', (r['id'],)).fetchone()['c']
        d['member_count'] = cnt
        out.append(d)
    conn.close()
    return jsonify({'families': out})


@app.route('/api/families/next-aush', methods=['GET'])
@login_required
def next_aush():
    conn = get_db()
    row = conn.execute('SELECT MAX(aush_number) AS mx FROM families').fetchone()
    conn.close()
    nxt = 101 if not row or row['mx'] is None else int(row['mx']) + 1
    return jsonify({'next': nxt})


@app.route('/api/families/check-jan-aadhaar', methods=['GET'])
@login_required
def check_jan_aadhaar():
    val = (request.args.get('jan') or '').strip()
    if not val:
        return jsonify({'exists': False})
    conn = get_db()
    row = conn.execute('SELECT id, full_name FROM family_members WHERE jan_aadhaar_number = ? AND is_active = 1 LIMIT 1', (val,)).fetchone()
    conn.close()
    if row:
        return jsonify({'exists': True, 'member_name': row['full_name'], 'member_id': row['id']})
    return jsonify({'exists': False})


# ==================== CREATE FAMILY ====================
@app.route('/api/families', methods=['POST'])
@login_required
def create_family():
    d = request.get_json() or {}
    name = (d.get('family_name') or '').strip()
    head_name = (d.get('head_name') or '').strip()
    if not name and head_name:
        name = head_name
    if not name:
        return jsonify({'error': 'Head Name is required'}), 400
    try:
        aush = int(d.get('aush_number'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Aush Number must be a number'}), 400
    head_payload = None
    if head_name:
        errs, hn, ha = validate_member_fields({
            'full_name': head_name,
            'aadhaar_number': d.get('head_aadhaar'),
            'mobile': d.get('head_mobile'),
            'alternate_mobile': d.get('head_alternate_mobile')
        })
        if errs:
            return jsonify({'error': 'Head: ' + '; '.join(errs)}), 400
        head_payload = {
            'full_name': hn,
            'gender': (d.get('head_gender') or '').upper() or None,
            'date_of_birth': d.get('head_dob') or None,
            'aadhaar_number': ha or None,
            'jan_aadhaar_number': (d.get('head_jan_aadhaar') or '').strip() or None,
            'voter_id_number': (d.get('head_voter_id') or '').strip() or None,
            'mobile': (d.get('head_mobile') or '').strip() or None,
            'alternate_mobile': (d.get('head_alternate_mobile') or '').strip() or None,
            'social_category': (d.get('head_category') or '').strip() or None,
            'religion': (d.get('head_religion') or '').strip() or None,
            'marital_status': (d.get('head_marital') or '').strip() or None,
        }

    conn = get_db()
    if conn.execute('SELECT id FROM families WHERE aush_number = ?', (aush,)).fetchone():
        conn.close()
        return jsonify({'error': 'Aush Number already exists'}), 400

    if head_payload and head_payload['aadhaar_number']:
        owner = find_aadhaar_owner(conn, head_payload['aadhaar_number'])
        if owner:
            conn.close()
            return jsonify({'error': aadhaar_conflict_msg(owner, is_head=True)}), 400

    t = now_iso()
    uid = session.get('user_id')
    cur = conn.execute('''INSERT INTO families
        (aush_number, family_name, husband_name, house_number, address, village, ward, pincode,
         latitude, longitude, location_accuracy_meters, survey_status, survey_date,
         category, religion,
         is_active, created_by, updated_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)''',
        (aush, name, d.get('husband_name'), d.get('house_number'), d.get('address'),
         d.get('village'), d.get('ward'), d.get('pincode'),
         d.get('latitude'), d.get('longitude'), d.get('location_accuracy_meters'),
         d.get('survey_status'), d.get('survey_date'),
         d.get('category'), d.get('religion'),
         uid, uid, t, t))
    fid = cur.lastrowid

    add_log(conn, fid, None, 'CREATE', 'FAMILY', 'Family "' + name + '" created', None, None, t)

    if head_payload:
        cur2 = conn.execute('''INSERT INTO family_members
            (family_id, full_name, gender, date_of_birth, aadhaar_number, jan_aadhaar_number,
             social_category, caste, mobile, alternate_mobile, relation_to_head, occupation,
             religion, marital_status, voter_id_number, is_family_head, is_active, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,1,?,?)''',
            (fid, head_payload['full_name'], head_payload['gender'], head_payload['date_of_birth'],
             head_payload['aadhaar_number'], head_payload['jan_aadhaar_number'],
             head_payload['social_category'], None, head_payload['mobile'],
             head_payload['alternate_mobile'], 'SELF', None,
             head_payload['religion'], head_payload['marital_status'],
             head_payload['voter_id_number'], t, t))
        mid = cur2.lastrowid
        add_log(conn, fid, mid, 'ADD', 'FAMILY_MEMBER', 'Family Head "' + head_payload['full_name'] + '" created', None, None, t)

    conn.commit()
    row = conn.execute('SELECT * FROM families WHERE id = ?', (fid,)).fetchone()
    conn.close()
    return jsonify({'family': dict(row)}), 201


# ==================== GET FAMILY ====================
@app.route('/api/families/<int:fid>', methods=['GET'])
@login_required
def get_family(fid):
    conn = get_db()
    fam = conn.execute('SELECT * FROM families WHERE id = ?', (fid,)).fetchone()
    if not fam:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    members = conn.execute('SELECT * FROM family_members WHERE family_id = ? AND is_active = 1 ORDER BY is_family_head DESC, id ASC', (fid,)).fetchall()
    logs = conn.execute('SELECT * FROM family_logs WHERE family_id = ? ORDER BY datetime(created_at) DESC, id DESC', (fid,)).fetchall()
    conn.close()
    return jsonify({'family': dict(fam), 'members': [dict(m) for m in members], 'logs': [dict(l) for l in logs]})


# ==================== UPDATE FAMILY ====================
@app.route('/api/families/<int:fid>', methods=['PUT'])
@login_required
def update_family(fid):
    d = request.get_json() or {}
    conn = get_db()
    old = conn.execute('SELECT * FROM families WHERE id = ?', (fid,)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    name = (d.get('family_name') or '').strip()
    if not name:
        conn.close()
        return jsonify({'error': 'Family Name is required'}), 400
    try:
        aush = int(d.get('aush_number'))
    except (TypeError, ValueError):
        conn.close()
        return jsonify({'error': 'Aush Number must be a number'}), 400
    if aush != old['aush_number']:
        dup = conn.execute('SELECT id FROM families WHERE aush_number = ? AND id != ?', (aush, fid)).fetchone()
        if dup:
            conn.close()
            return jsonify({'error': 'Aush Number already exists'}), 400
    t = now_iso()
    uid = session.get('user_id')
    conn.execute('''UPDATE families SET aush_number=?, family_name=?, husband_name=?, house_number=?,
        address=?, village=?, ward=?, pincode=?, latitude=?, longitude=?, location_accuracy_meters=?,
        survey_status=?, survey_date=?, category=?, religion=?, updated_by=?, updated_at=? WHERE id=?''',
        (aush, name, d.get('husband_name'), d.get('house_number'), d.get('address'),
         d.get('village'), d.get('ward'), d.get('pincode'),
         d.get('latitude'), d.get('longitude'), d.get('location_accuracy_meters'),
         d.get('survey_status'), d.get('survey_date'),
         d.get('category'), d.get('religion'), uid, t, fid))
    old_d = dict(old)
    changes = {}
    for k in ['aush_number','family_name','husband_name','house_number','address','village','ward','pincode','survey_status','survey_date']:
        nv = aush if k == 'aush_number' else d.get(k)
        if str(old_d.get(k) or '') != str(nv or ''):
            changes[k] = {'old': old_d.get(k), 'new': nv}
    if changes:
        add_log(conn, fid, None, 'UPDATE', 'FAMILY', 'Family updated', str(changes), str(d), t)
    conn.commit()
    row = conn.execute('SELECT * FROM families WHERE id = ?', (fid,)).fetchone()
    conn.close()
    return jsonify({'family': dict(row)})


# ==================== DELETE FAMILY ====================
@app.route('/api/families/<int:fid>', methods=['DELETE'])
@login_required
def delete_family(fid):
    conn = get_db()
    old = conn.execute('SELECT * FROM families WHERE id = ? AND is_active = 1', (fid,)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    t = now_iso()
    uid = session.get('user_id')

    # Push to Recycle Bin (MEDIUM)
    try:
        from settings import push_recycle
        push_recycle(conn, 'MEDIUM', 'FAMILY', 'FAMILY',
                     record_id=fid,
                     record_name=old['family_name'] + ' (Aush ' + str(old['aush_number']) + ')',
                     record_data=dict(old),
                     reason='Family archived')
    except Exception as e:
        pass

    conn.execute('UPDATE families SET is_active = 0, updated_by = ?, updated_at = ? WHERE id = ?', (uid, t, fid))
    conn.execute('UPDATE family_members SET is_active = 0, updated_at = ? WHERE family_id = ?', (t, fid))
    add_log(conn, fid, None, 'DELETE', 'FAMILY', 'Family "' + old['family_name'] + '" archived', None, None, t)
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ==================== MEMBERS ====================
@app.route('/api/families/<int:fid>/members', methods=['POST'])
@login_required
def create_member(fid):
    d = request.get_json() or {}
    errs, name, aadhaar = validate_member_fields(d)
    if errs:
        return jsonify({'error': '; '.join(errs)}), 400
    conn = get_db()
    if not conn.execute('SELECT id FROM families WHERE id = ? AND is_active = 1', (fid,)).fetchone():
        conn.close()
        return jsonify({'error': 'Family not found'}), 404
    if aadhaar:
        owner = find_aadhaar_owner(conn, aadhaar)
        if owner:
            conn.close()
            return jsonify({'error': aadhaar_conflict_msg(owner)}), 400
    if d.get('is_family_head'):
        existing = conn.execute('SELECT id FROM family_members WHERE family_id = ? AND is_family_head = 1 AND is_active = 1', (fid,)).fetchone()
        if existing:
            conn.close()
            return jsonify({'error': 'Family already has a head member'}), 400
    t = now_iso()
    relation = d.get('relation_to_head') or 'OTHER'
    is_head = 1 if d.get('is_family_head') else 0
    if is_head:
        relation = 'SELF'
    cur = conn.execute('''INSERT INTO family_members
        (family_id, full_name, gender, date_of_birth, aadhaar_number, jan_aadhaar_number,
         social_category, caste, mobile, alternate_mobile, relation_to_head, occupation,
         religion, marital_status, voter_id_number, is_family_head, is_active, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)''',
        (fid, name, (d.get('gender') or '').upper() or None, d.get('date_of_birth'), aadhaar,
         d.get('jan_aadhaar_number'), d.get('social_category'), d.get('caste'),
         d.get('mobile'), d.get('alternate_mobile'), relation, d.get('occupation'),
         d.get('religion'), d.get('marital_status'), d.get('voter_id_number'),
         is_head, t, t))
    mid = cur.lastrowid
    add_log(conn, fid, mid, 'ADD', 'FAMILY_MEMBER', 'Member "' + name + '" added', None, None, t)
    conn.commit()
    row = conn.execute('SELECT * FROM family_members WHERE id = ?', (mid,)).fetchone()
    conn.close()
    return jsonify({'member': dict(row)}), 201


@app.route('/api/families/<int:fid>/members/<int:mid>', methods=['GET'])
@login_required
def get_member(fid, mid):
    conn = get_db()
    m = conn.execute('SELECT * FROM family_members WHERE id = ? AND family_id = ?', (mid, fid)).fetchone()
    conn.close()
    if not m:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'member': dict(m)})


@app.route('/api/families/<int:fid>/members/<int:mid>', methods=['PUT'])
@login_required
def update_member(fid, mid):
    d = request.get_json() or {}
    conn = get_db()
    old = conn.execute('SELECT * FROM family_members WHERE id = ? AND family_id = ?', (mid, fid)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    errs, name, aadhaar = validate_member_fields(d)
    if errs:
        conn.close()
        return jsonify({'error': '; '.join(errs)}), 400
    if aadhaar:
        owner = find_aadhaar_owner(conn, aadhaar, exclude_member_id=mid)
        if owner:
            conn.close()
            return jsonify({'error': aadhaar_conflict_msg(owner)}), 400
    t = now_iso()
    relation = d.get('relation_to_head') or old['relation_to_head']
    if old['is_family_head']:
        relation = 'SELF'
    conn.execute('''UPDATE family_members SET full_name=?, gender=?, date_of_birth=?,
        aadhaar_number=?, jan_aadhaar_number=?, social_category=?, caste=?, mobile=?,
        alternate_mobile=?, relation_to_head=?, occupation=?, religion=?, marital_status=?,
        voter_id_number=?, updated_at=? WHERE id=?''',
        (name, (d.get('gender') or '').upper() or None, d.get('date_of_birth'), aadhaar,
         d.get('jan_aadhaar_number'), d.get('social_category'), d.get('caste'),
         d.get('mobile'), d.get('alternate_mobile'), relation, d.get('occupation'),
         d.get('religion'), d.get('marital_status'), d.get('voter_id_number'), t, mid))
    old_d = dict(old)
    changes = {}
    for k in ['full_name','gender','date_of_birth','aadhaar_number','jan_aadhaar_number',
              'social_category','caste','mobile','alternate_mobile','relation_to_head',
              'occupation','religion','marital_status','voter_id_number']:
        nv = aadhaar if k == 'aadhaar_number' else d.get(k)
        if k == 'relation_to_head' and old['is_family_head']:
            nv = 'SELF'
        if str(old_d.get(k) or '') != str(nv or ''):
            changes[k] = {'old': old_d.get(k), 'new': nv}
    if changes:
        add_log(conn, fid, mid, 'UPDATE', 'FAMILY_MEMBER', 'Member "' + name + '" updated', str(changes), str(d), t)
    conn.commit()
    row = conn.execute('SELECT * FROM family_members WHERE id = ?', (mid,)).fetchone()
    conn.close()
    return jsonify({'member': dict(row)})


@app.route('/api/families/<int:fid>/members/<int:mid>', methods=['DELETE'])
@login_required
def delete_member(fid, mid):
    conn = get_db()
    m = conn.execute('SELECT * FROM family_members WHERE id = ? AND family_id = ?', (mid, fid)).fetchone()
    if not m:
        conn.close()
        return jsonify({'error': 'Not found'}), 404
    if m['is_family_head']:
        conn.close()
        return jsonify({'error': 'Family Head cannot be deleted'}), 400
    t = now_iso()
    try:
        from settings import push_recycle
        push_recycle(conn, 'MEDIUM', 'FAMILY', 'FAMILY_MEMBER',
                     record_id=mid,
                     record_name=m['full_name'] + ' (family #' + str(fid) + ')',
                     record_data=dict(m),
                     reason='Member archived')
    except Exception:
        pass
    conn.execute('UPDATE family_members SET is_active = 0, updated_at = ? WHERE id = ?', (t, mid))
    add_log(conn, fid, mid, 'DELETE', 'FAMILY_MEMBER', 'Member "' + m['full_name'] + '" archived', None, None, t)
    conn.commit()
    conn.close()
    return jsonify({'ok': True})


# ==================== STATIC ====================
@app.route('/')
def root():
    return send_from_directory(STATIC_DIR, 'login.html')


@app.route('/app')
def app_page():
    return send_from_directory(STATIC_DIR, 'index.html')


app.register_blueprint(beneficiaries_bp)
app.register_blueprint(stock_bp)
app.register_blueprint(attendance_bp)
app.register_blueprint(thr_dist_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(reports_bp)


if __name__ == '__main__':
    init_db()
    init_beneficiary_tables()
    init_stock_tables()
    init_thr_recipe_tables()
    init_attendance_tables()
    init_thr_dist_tables()
    init_settings_tables()
    init_app_settings_table()
    init_report_tables()
    print('=' * 55)
    print('  RECORD ROOM - Data Manager')
    print('  http://localhost:8787')
    print('  Login: admin / admin123')
    print('=' * 55)
    app.run(host='0.0.0.0', port=8787, debug=False)
