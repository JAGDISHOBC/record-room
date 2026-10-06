"""Record Room - Beneficiaries Module"""
import os, json
from datetime import datetime
from functools import wraps
from flask import Blueprint, request, jsonify, session

beneficiaries_bp = Blueprint('beneficiaries', __name__)

VALID_CATEGORIES = ['PREGNANT', 'LACTATING', 'CHILD_0_6', 'CHILD_6_36', 'CHILD_36_72']
CATEGORY_LABELS = {
    'PREGNANT': 'Pregnant Women',
    'LACTATING': 'Lactating Mothers',
    'CHILD_0_6': 'Children 0-6 Months',
    'CHILD_6_36': 'Children 6 Months-3 Years',
    'CHILD_36_72': 'Children 3-6 Years'
}
CATEGORY_MOVES = {
    'PREGNANT': ['LACTATING'],
    'LACTATING': [],
    'CHILD_0_6': ['CHILD_6_36'],
    'CHILD_6_36': ['CHILD_36_72'],
    'CHILD_36_72': []
}


def now_iso():
    return datetime.utcnow().isoformat(timespec='seconds') + 'Z'


def get_db():
    import sqlite3
    DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data_manager.db')
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys = ON')
    return conn


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not session.get('user_id'):
            return jsonify({'error': 'Not authenticated'}), 401
        return f(*args, **kwargs)
    return wrapper


def init_beneficiary_tables():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS beneficiary_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        beneficiary_unique_id INTEGER UNIQUE NOT NULL,
        category TEXT NOT NULL,
        full_name TEXT NOT NULL,
        aadhaar_number TEXT,
        father_name TEXT,
        mother_name TEXT,
        husband_name TEXT,
        gender TEXT,
        date_of_birth TEXT,
        profile_photo_data TEXT,
        house_number TEXT,
        religion TEXT,
        mobile TEXT,
        alternate_mobile TEXT,
        father_aadhaar_number TEXT,
        mother_aadhaar_number TEXT,
        jan_aadhaar_number TEXT,
        abha_id TEXT,
        apaar_id TEXT,
        lmp_date TEXT,
        edd_date TEXT,
        delivery_date TEXT,
        entry_reason TEXT,
        effective_date TEXT NOT NULL,
        added_at TEXT,
        inactive_at TEXT,
        inactive_type TEXT,
        inactive_reason TEXT,
        inactive_effective_date TEXT,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS beneficiary_profile_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        beneficiary_id INTEGER NOT NULL,
        log_type TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        reason TEXT,
        effective_date TEXT,
        created_by INTEGER,
        created_by_username TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (beneficiary_id) REFERENCES beneficiary_profiles(id) ON DELETE CASCADE)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_bene_cat_active ON beneficiary_profiles(category, is_active)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_bene_mobile ON beneficiary_profiles(mobile)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_bene_jan ON beneficiary_profiles(jan_aadhaar_number)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_bene_uid ON beneficiary_profiles(beneficiary_unique_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_bene_logs ON beneficiary_profile_logs(beneficiary_id, created_at)')
    conn.commit()
    conn.close()


def add_bene_log(conn, bene_id, log_type, old_vals=None, new_vals=None, reason=None, effective_date=None):
    conn.execute('''INSERT INTO beneficiary_profile_logs
        (beneficiary_id, log_type, old_values, new_values, reason, effective_date,
         created_by, created_by_username, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)''',
        (bene_id, log_type,
         json.dumps(old_vals) if old_vals else None,
         json.dumps(new_vals) if new_vals else None,
         reason, effective_date,
         session.get('user_id'), session.get('username'), now_iso()))


def next_unique_id(conn):
    row = conn.execute('SELECT MAX(beneficiary_unique_id) AS mx FROM beneficiary_profiles').fetchone()
    if not row or row['mx'] is None:
        return 1001
    return int(row['mx']) + 1


def clean_aadhaar(v):
    return (v or '').replace('-', '').replace(' ', '').strip()


def validate_mobile(v):
    if not v: return True
    return v.isdigit() and len(v) == 10


# ==================== LIST ====================
@beneficiaries_bp.route('/api/admin/beneficiaries', methods=['GET'])
@login_required
def list_beneficiaries():
    status = (request.args.get('status') or 'active').lower()
    category = (request.args.get('category') or '').strip()
    search = (request.args.get('search') or '').strip().lower()
    is_active = 1 if status == 'active' else 0

    conn = get_db()
    where = ['is_active = ?']
    params = [is_active]
    if category and category in VALID_CATEGORIES:
        where.append('category = ?')
        params.append(category)
    if search:
        s_clean = search.replace('-', '').replace(' ', '')
        like = '%' + search + '%'
        like_clean = '%' + s_clean + '%'
        where.append('''(
            LOWER(full_name) LIKE ? OR
            LOWER(COALESCE(father_name,'')) LIKE ? OR
            LOWER(COALESCE(mother_name,'')) LIKE ? OR
            REPLACE(COALESCE(mobile,''),' ','') LIKE ? OR
            REPLACE(REPLACE(COALESCE(aadhaar_number,''),'-',''),' ','') LIKE ? OR
            CAST(beneficiary_unique_id AS TEXT) LIKE ?
        )''')
        params.extend([like, like, like, like_clean, like_clean, like])

    sql = 'SELECT * FROM beneficiary_profiles WHERE ' + ' AND '.join(where) + \
          ' ORDER BY full_name COLLATE NOCASE ASC, beneficiary_unique_id ASC'
    rows = conn.execute(sql, params).fetchall()

    counts = {}
    for cat in VALID_CATEGORIES:
        cnt = conn.execute('SELECT COUNT(*) AS c FROM beneficiary_profiles WHERE category = ? AND is_active = ?', (cat, is_active)).fetchone()['c']
        counts[cat] = cnt
    total = conn.execute('SELECT COUNT(*) AS c FROM beneficiary_profiles WHERE is_active = ?', (is_active,)).fetchone()['c']

    conn.close()
    return jsonify({
        'success': True,
        'status': status,
        'beneficiaries': [dict(r) for r in rows],
        'counts': counts,
        'total': total,
        'category_labels': CATEGORY_LABELS,
        'today': datetime.utcnow().strftime('%Y-%m-%d')
    })


# ==================== GET DETAIL ====================
@beneficiaries_bp.route('/api/admin/beneficiaries/<int:bid>', methods=['GET'])
@login_required
def get_beneficiary(bid):
    conn = get_db()
    row = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ?', (bid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Beneficiary not found'}), 404
    return jsonify({'success': True, 'beneficiary': dict(row), 'category_labels': CATEGORY_LABELS})


# ==================== GET LOGS ====================
@beneficiaries_bp.route('/api/admin/beneficiaries/<int:bid>/logs', methods=['GET'])
@login_required
def get_beneficiary_logs(bid):
    conn = get_db()
    if not conn.execute('SELECT id FROM beneficiary_profiles WHERE id = ?', (bid,)).fetchone():
        conn.close()
        return jsonify({'error': 'Beneficiary not found'}), 404
    rows = conn.execute('SELECT * FROM beneficiary_profile_logs WHERE beneficiary_id = ? ORDER BY datetime(created_at) DESC, id DESC', (bid,)).fetchall()
    conn.close()
    return jsonify({'success': True, 'logs': [dict(r) for r in rows]})


# ==================== CHECK DUP JAN AADHAAR ====================
@beneficiaries_bp.route('/api/admin/beneficiaries/check-jan-aadhaar', methods=['GET'])
@login_required
def check_jan_aadhaar_bene():
    val = (request.args.get('jan') or '').strip()
    exclude = request.args.get('exclude_id')
    if not val:
        return jsonify({'exists': False})
    conn = get_db()
    sql = "SELECT id, full_name, category FROM beneficiary_profiles WHERE jan_aadhaar_number = ? AND is_active = 1"
    params = [val]
    if exclude:
        sql += " AND id != ?"
        params.append(exclude)
    sql += " LIMIT 1"
    row = conn.execute(sql, params).fetchone()
    conn.close()
    if row:
        return jsonify({'exists': True, 'name': row['full_name'],
                        'category': CATEGORY_LABELS.get(row['category'], row['category'])})
    return jsonify({'exists': False})


# ==================== CREATE ====================
@beneficiaries_bp.route('/api/admin/beneficiaries', methods=['POST'])
@login_required
def create_beneficiary():
    d = request.get_json() or {}

    # --- Required ---
    category = (d.get('category') or '').strip().upper()
    if category not in VALID_CATEGORIES:
        return jsonify({'error': 'Invalid beneficiary category'}), 400
    full_name = (d.get('full_name') or '').strip()
    if not full_name:
        return jsonify({'error': 'Name is required'}), 400
    effective_date = (d.get('effective_date') or '').strip()
    if not effective_date:
        return jsonify({'error': 'Effective Date is required'}), 400

    # --- Gender rule ---
    gender = (d.get('gender') or '').strip().upper() or None
    if category in ('PREGNANT', 'LACTATING'):
        if gender and gender != 'FEMALE':
            return jsonify({'error': 'Pregnant and Lactating beneficiaries must have Female gender.'}), 400
        gender = 'FEMALE'

    # --- Aadhaar ---
    aadhaar = clean_aadhaar(d.get('aadhaar_number'))
    if aadhaar:
        if not aadhaar.isdigit() or len(aadhaar) != 12:
            return jsonify({'error': 'Aadhaar must be in XXXX-XXXX-XXXX format.'}), 400

    # --- Mobile ---
    mobile = (d.get('mobile') or '').strip() or None
    alt_mobile = (d.get('alternate_mobile') or '').strip() or None
    if mobile and not validate_mobile(mobile):
        return jsonify({'error': 'Mobile number must be 10 digits.'}), 400
    if alt_mobile and not validate_mobile(alt_mobile):
        return jsonify({'error': 'Alternate mobile must be 10 digits.'}), 400
    if mobile and alt_mobile and mobile == alt_mobile:
        return jsonify({'error': 'Alternate mobile must be different from primary mobile.'}), 400

    # --- LMP/EDD auto-calc (Pregnant) ---
    lmp = (d.get('lmp_date') or '').strip() or None
    edd = (d.get('edd_date') or '').strip() or None
    if category == 'PREGNANT':
        try:
            if lmp and not edd:
                dt = datetime.strptime(lmp, '%Y-%m-%d')
                edd = (dt.timestamp() + 280 * 86400)
                edd = datetime.utcfromtimestamp(edd).strftime('%Y-%m-%d')
            elif edd and not lmp:
                dt = datetime.strptime(edd, '%Y-%m-%d')
                lmp = (dt.timestamp() - 280 * 86400)
                lmp = datetime.utcfromtimestamp(lmp).strftime('%Y-%m-%d')
        except Exception:
            pass

    conn = get_db()

    # --- Duplicate active Aadhaar (hard fail) ---
    if aadhaar:
        owner = conn.execute('''SELECT id, full_name FROM beneficiary_profiles
            WHERE REPLACE(REPLACE(aadhaar_number,'-',''),' ','') = ? AND is_active = 1
            LIMIT 1''', (aadhaar,)).fetchone()
        if owner:
            conn.close()
            return jsonify({'error': 'Aadhaar already exists in active beneficiary ' + owner['full_name'] + '. Please change the Aadhaar number.'}), 400

    # --- Auto unique ID ---
    uid_new = next_unique_id(conn)

    # --- Insert ---
    t = now_iso()
    uid_session = session.get('user_id')
    cur = conn.execute('''INSERT INTO beneficiary_profiles
        (beneficiary_unique_id, category, full_name, aadhaar_number, father_name, mother_name,
         husband_name, gender, date_of_birth, profile_photo_data, house_number, religion,
         mobile, alternate_mobile, father_aadhaar_number, mother_aadhaar_number,
         jan_aadhaar_number, abha_id, apaar_id, lmp_date, edd_date, delivery_date,
         entry_reason, effective_date, added_at, is_active, created_by, updated_by,
         created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)''',
        (uid_new, category, full_name, aadhaar or None,
         (d.get('father_name') or '').strip() or None,
         (d.get('mother_name') or '').strip() or None,
         (d.get('husband_name') or '').strip() or None,
         gender, (d.get('date_of_birth') or '').strip() or None,
         d.get('profile_photo_data') or None,
         (d.get('house_number') or '').strip() or None,
         (d.get('religion') or '').strip() or None,
         mobile, alt_mobile,
         clean_aadhaar(d.get('father_aadhaar_number')) or None,
         clean_aadhaar(d.get('mother_aadhaar_number')) or None,
         (d.get('jan_aadhaar_number') or '').strip() or None,
         (d.get('abha_id') or '').strip() or None,
         (d.get('apaar_id') or '').strip() or None,
         lmp, edd, (d.get('delivery_date') or '').strip() or None,
         (d.get('entry_reason') or '').strip() or None,
         effective_date, t,
         uid_session, uid_session, t, t))
    bid = cur.lastrowid

    # --- ADD log ---
    new_vals = {k: v for k, v in {
        'beneficiary_unique_id': uid_new,
        'category': category,
        'full_name': full_name,
        'gender': gender,
        'effective_date': effective_date
    }.items() if v}
    add_bene_log(conn, bid, 'ADD', None, new_vals, d.get('entry_reason'), effective_date)

    conn.commit()
    row = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ?', (bid,)).fetchone()
    conn.close()
    return jsonify({'success': True, 'beneficiary': dict(row),
                    'message': 'Beneficiary added successfully.'}), 201


# ==================== UPDATE (Edit Active) ====================
@beneficiaries_bp.route('/api/admin/beneficiaries/<int:bid>', methods=['PATCH'])
@login_required
def update_beneficiary(bid):
    d = request.get_json() or {}
    conn = get_db()
    old = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ?', (bid,)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': 'Beneficiary not found'}), 404
    if not old['is_active']:
        conn.close()
        return jsonify({'error': 'Inactive beneficiary cannot be edited here.'}), 400

    old_d = dict(old)
    category = old_d['category']

    # --- Validate ---
    full_name = (d.get('full_name') or '').strip()
    if not full_name:
        conn.close()
        return jsonify({'error': 'Name is required'}), 400

    gender = (d.get('gender') or '').strip().upper() or None
    if category in ('PREGNANT', 'LACTATING'):
        gender = 'FEMALE'

    aadhaar = clean_aadhaar(d.get('aadhaar_number'))
    if aadhaar and (not aadhaar.isdigit() or len(aadhaar) != 12):
        conn.close()
        return jsonify({'error': 'Aadhaar must be in XXXX-XXXX-XXXX format.'}), 400

    if aadhaar:
        owner = conn.execute('''SELECT id, full_name FROM beneficiary_profiles
            WHERE REPLACE(REPLACE(aadhaar_number,'-',''),' ','') = ? AND is_active = 1 AND id != ?
            LIMIT 1''', (aadhaar, bid)).fetchone()
        if owner:
            conn.close()
            return jsonify({'error': 'Aadhaar already exists in active beneficiary ' + owner['full_name'] + '. Please change the Aadhaar number.'}), 400

    mobile = (d.get('mobile') or '').strip() or None
    alt_mobile = (d.get('alternate_mobile') or '').strip() or None
    if mobile and not validate_mobile(mobile):
        conn.close()
        return jsonify({'error': 'Mobile number must be 10 digits.'}), 400
    if alt_mobile and not validate_mobile(alt_mobile):
        conn.close()
        return jsonify({'error': 'Alternate mobile must be 10 digits.'}), 400
    if mobile and alt_mobile and mobile == alt_mobile:
        conn.close()
        return jsonify({'error': 'Alternate mobile must be different from primary mobile.'}), 400

    effective_date = (d.get('effective_date') or '').strip() or old_d.get('effective_date')

    # --- Build changes ---
    fields = ['full_name', 'aadhaar_number', 'father_name', 'mother_name', 'husband_name',
              'gender', 'date_of_birth', 'house_number', 'religion', 'mobile', 'alternate_mobile',
              'father_aadhaar_number', 'mother_aadhaar_number', 'jan_aadhaar_number', 'abha_id',
              'apaar_id', 'lmp_date', 'edd_date', 'delivery_date', 'entry_reason', 'effective_date']
    new_vals = {}
    for f in fields:
        new_vals[f] = d.get(f) if f in d else old_d.get(f)
    new_vals['full_name'] = full_name
    new_vals['gender'] = gender
    new_vals['aadhaar_number'] = aadhaar or None
    new_vals['mobile'] = mobile
    new_vals['alternate_mobile'] = alt_mobile
    new_vals['effective_date'] = effective_date
    new_vals['father_aadhaar_number'] = clean_aadhaar(d.get('father_aadhaar_number')) or None if 'father_aadhaar_number' in d else old_d.get('father_aadhaar_number')
    new_vals['mother_aadhaar_number'] = clean_aadhaar(d.get('mother_aadhaar_number')) or None if 'mother_aadhaar_number' in d else old_d.get('mother_aadhaar_number')

    changes = {}
    for f in fields:
        ov = old_d.get(f)
        nv = new_vals.get(f)
        if str(ov or '') != str(nv or ''):
            changes[f] = {'old': ov, 'new': nv}

    # Photo new value (define early)
    photo_new = d.get('profile_photo_data') if 'profile_photo_data' in d else old_d.get('profile_photo_data')

    # Photo change detection
    old_photo = old_d.get('profile_photo_data') or ''
    new_photo = photo_new or ''
    if old_photo != new_photo:
        if not old_photo and new_photo:
            changes['profile_photo_data'] = {'old': None, 'new': '(photo added)'}
        elif old_photo and not new_photo:
            changes['profile_photo_data'] = {'old': '(photo)', 'new': None}
        else:
            changes['profile_photo_data'] = {'old': '(photo)', 'new': '(photo changed)'}

    if not changes:
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'changed': False, 'message': 'No changes.'})

    t = now_iso()
    uid_session = session.get('user_id')
    conn.execute('''UPDATE beneficiary_profiles SET
        full_name=?, aadhaar_number=?, father_name=?, mother_name=?, husband_name=?,
        gender=?, date_of_birth=?, house_number=?, religion=?, mobile=?, alternate_mobile=?,
        father_aadhaar_number=?, mother_aadhaar_number=?, jan_aadhaar_number=?, abha_id=?,
        apaar_id=?, lmp_date=?, edd_date=?, delivery_date=?, entry_reason=?, effective_date=?,
        profile_photo_data=?,
        updated_by=?, updated_at=?
        WHERE id=?''',
        (new_vals['full_name'], new_vals['aadhaar_number'], new_vals['father_name'],
         new_vals['mother_name'], new_vals['husband_name'], new_vals['gender'],
         new_vals['date_of_birth'], new_vals['house_number'], new_vals['religion'],
         new_vals['mobile'], new_vals['alternate_mobile'],
         new_vals['father_aadhaar_number'], new_vals['mother_aadhaar_number'],
         new_vals['jan_aadhaar_number'], new_vals['abha_id'], new_vals['apaar_id'],
         new_vals['lmp_date'], new_vals['edd_date'], new_vals['delivery_date'],
         new_vals['entry_reason'], new_vals['effective_date'],
         photo_new,
         uid_session, t, bid))

    add_bene_log(conn, bid, 'EDIT', changes, new_vals, None, effective_date)
    conn.commit()
    row = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ?', (bid,)).fetchone()
    conn.close()
    return jsonify({'success': True, 'changed': True, 'beneficiary': dict(row),
                    'message': 'Updated successfully.'})


# ==================== MOVE CATEGORY ====================
@beneficiaries_bp.route('/api/admin/beneficiaries/<int:bid>/move', methods=['POST'])
@login_required
def move_beneficiary(bid):
    d = request.get_json() or {}
    new_category = (d.get('new_category') or '').strip().upper()
    effective_date = (d.get('effective_date') or '').strip()
    reason = (d.get('reason') or '').strip() or 'Category movement'
    delivery_date = (d.get('delivery_date') or '').strip() or None

    if not new_category or new_category not in VALID_CATEGORIES:
        return jsonify({'error': 'Invalid beneficiary category'}), 400
    if not effective_date:
        return jsonify({'error': 'Effective Date is required'}), 400

    conn = get_db()
    row = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ?', (bid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Beneficiary not found'}), 404
    if not row['is_active']:
        conn.close()
        return jsonify({'error': 'Inactive beneficiary cannot be moved.'}), 400

    old_cat = row['category']
    if new_category not in CATEGORY_MOVES.get(old_cat, []):
        conn.close()
        return jsonify({'error': 'Movement from ' + CATEGORY_LABELS.get(old_cat, old_cat) + ' to ' + CATEGORY_LABELS.get(new_category, new_category) + ' is not permitted.'}), 400

    if old_cat == 'PREGNANT' and new_category == 'LACTATING':
        if not delivery_date:
            conn.close()
            return jsonify({'error': 'Delivery Date is required to move this beneficiary to Lactating Mothers.'}), 400

    t = now_iso()
    uid_session = session.get('user_id')
    if delivery_date:
        conn.execute('UPDATE beneficiary_profiles SET category=?, delivery_date=?, updated_by=?, updated_at=? WHERE id=?',
                     (new_category, delivery_date, uid_session, t, bid))
    else:
        conn.execute('UPDATE beneficiary_profiles SET category=?, updated_by=?, updated_at=? WHERE id=?',
                     (new_category, uid_session, t, bid))

    add_bene_log(conn, bid, 'MOVE_CATEGORY',
                 {'category': old_cat}, {'category': new_category},
                 reason, effective_date)
    conn.commit()
    updated = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ?', (bid,)).fetchone()
    conn.close()

    if old_cat == 'PREGNANT' and new_category == 'LACTATING':
        msg = 'Beneficiary moved to Lactating Mothers.'
    else:
        msg = 'Beneficiary moved to ' + CATEGORY_LABELS.get(new_category, new_category) + '.'
    return jsonify({'success': True, 'beneficiary': dict(updated), 'message': msg})


# ==================== DELETE = MOVE TO INACTIVE ====================
@beneficiaries_bp.route('/api/admin/beneficiaries/<int:bid>/delete', methods=['POST'])
@login_required
def delete_beneficiary(bid):
    d = request.get_json() or {}
    reason = (d.get('reason') or '').strip()
    effective_date = (d.get('effective_date') or '').strip()

    if not reason:
        return jsonify({'error': 'Inactive Reason is required'}), 400
    if not effective_date:
        return jsonify({'error': 'Effective Date is required'}), 400

    conn = get_db()
    row = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ?', (bid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Beneficiary not found'}), 404
    if not row['is_active']:
        conn.close()
        return jsonify({'error': 'Already inactive.'}), 400

    t = now_iso()
    uid_session = session.get('user_id')

    # Push to Recycle Bin (MEDIUM)
    try:
        from settings import push_recycle
        push_recycle(conn, 'MEDIUM', 'BENEFICIARIES', 'BENEFICIARY',
                     record_id=bid,
                     record_name=dict(row).get('full_name', ''),
                     record_data=dict(row),
                     effective_date=effective_date,
                     reason=reason)
    except Exception:
        pass

    conn.execute('''UPDATE beneficiary_profiles SET
        is_active=0, inactive_at=?, inactive_type='MANUAL', inactive_reason=?,
        inactive_effective_date=?, updated_by=?, updated_at=?
        WHERE id=?''', (t, reason, effective_date, uid_session, t, bid))

    add_bene_log(conn, bid, 'INACTIVE',
                 {'is_active': 1}, {'is_active': 0},
                 reason, effective_date)
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Beneficiary moved to Inactive.'})


# ==================== ADD BABY (Lactating) ====================
@beneficiaries_bp.route('/api/admin/beneficiaries/<int:bid>/add-baby', methods=['POST'])
@login_required
def add_baby(bid):
    d = request.get_json() or {}
    conn = get_db()
    mother = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ?', (bid,)).fetchone()
    if not mother:
        conn.close()
        return jsonify({'error': 'Beneficiary not found'}), 404
    if mother['category'] != 'LACTATING':
        conn.close()
        return jsonify({'error': 'Add Baby is only available for Lactating Mothers.'}), 400

    full_name = (d.get('full_name') or '').strip()
    if not full_name:
        conn.close()
        return jsonify({'error': 'Name is required'}), 400
    effective_date = (d.get('effective_date') or '').strip()
    if not effective_date:
        conn.close()
        return jsonify({'error': 'Effective Date is required'}), 400

    aadhaar = clean_aadhaar(d.get('aadhaar_number'))
    if aadhaar and (not aadhaar.isdigit() or len(aadhaar) != 12):
        conn.close()
        return jsonify({'error': 'Aadhaar must be in XXXX-XXXX-XXXX format.'}), 400

    if aadhaar:
        owner = conn.execute('''SELECT id, full_name FROM beneficiary_profiles
            WHERE REPLACE(REPLACE(aadhaar_number,'-',''),' ','') = ? AND is_active = 1 LIMIT 1''', (aadhaar,)).fetchone()
        if owner:
            conn.close()
            return jsonify({'error': 'Aadhaar already exists in active beneficiary ' + owner['full_name'] + '.'}), 400

    uid_new = next_unique_id(conn)
    t = now_iso()
    uid_session = session.get('user_id')
    cur = conn.execute('''INSERT INTO beneficiary_profiles
        (beneficiary_unique_id, category, full_name, aadhaar_number, father_name, mother_name,
         gender, date_of_birth, house_number, religion, mobile, alternate_mobile,
         jan_aadhaar_number, abha_id, entry_reason, effective_date, added_at,
         is_active, created_by, updated_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)''',
        (uid_new, 'CHILD_0_6', full_name, aadhaar or None,
         (d.get('father_name') or '').strip() or None,
         mother['full_name'],
         (d.get('gender') or '').strip().upper() or None,
         (d.get('date_of_birth') or '').strip() or None,
         (d.get('house_number') or '').strip() or mother['house_number'],
         (d.get('religion') or '').strip() or mother['religion'],
         (d.get('mobile') or '').strip() or mother['mobile'],
         (d.get('alternate_mobile') or '').strip() or mother['alternate_mobile'],
         (d.get('jan_aadhaar_number') or '').strip() or None,
         (d.get('abha_id') or '').strip() or None,
         'Baby of ' + mother['full_name'],
         effective_date, t,
         uid_session, uid_session, t, t))
    baby_id = cur.lastrowid

    add_bene_log(conn, baby_id, 'ADD', None,
                 {'full_name': full_name, 'category': 'CHILD_0_6', 'mother': mother['full_name']},
                 'Baby creation', effective_date)
    conn.commit()
    row = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ?', (baby_id,)).fetchone()
    conn.close()
    return jsonify({'success': True, 'beneficiary': dict(row),
                    'message': 'Baby added successfully.'}), 201
