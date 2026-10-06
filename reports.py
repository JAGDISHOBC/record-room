"""Record Room - Reports + Monthly Register
Only Manual Fill + Blank Form modes. No legacy Attendance/Billing modes.
"""
import os, json, hashlib
from datetime import datetime
from functools import wraps
from flask import Blueprint, request, jsonify, session

reports_bp = Blueprint('reports', __name__)

# 6 form types (only these — no legacy modes)
REPORT_TYPES = {
    'GARMA_KHANA': {'label': 'गरम खाना दावा प्रपत्र', 'icon': '🍲', 'orientation': 'portrait'},
    'MILK_CLAIM':  {'label': 'दूध दावा फॉर्म',         'icon': '🥛', 'orientation': 'portrait'},
    'MILK_STOCK':  {'label': 'मिल्क स्टॉक रजिस्टर',   'icon': '📦', 'orientation': 'landscape'},
    'FORM4':       {'label': 'Form No. 4',            'icon': '📄', 'orientation': 'landscape'},
    'MPR':         {'label': 'MPR',                   'icon': '📊', 'orientation': 'portrait'},
    'STOCK_THR':   {'label': 'स्टॉक रजिस्टर THR',     'icon': '📋', 'orientation': 'landscape'}
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


def content_hash(payload_json):
    return hashlib.sha256(payload_json.encode('utf-8')).hexdigest()


def init_report_tables():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS reports_draft (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_type TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        content_hash TEXT,
        updated_by INTEGER,
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(report_type, year, month))''')
    c.execute('''CREATE TABLE IF NOT EXISTS report_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_type TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        version_no INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        content_hash TEXT,
        created_by INTEGER,
        created_by_username TEXT,
        created_at TEXT NOT NULL)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_rv_key ON report_versions(report_type, year, month)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_rv_hash ON report_versions(content_hash)')
    conn.commit()
    conn.close()


# ==================== DRAFT SAVE ====================
@reports_bp.route('/api/reports/<report_type>/draft', methods=['POST'])
@login_required
def save_draft(report_type):
    rtype = (report_type or '').strip().upper()
    if rtype not in REPORT_TYPES:
        return jsonify({'error': 'Invalid report type.'}), 400

    d = request.get_json() or {}
    year = d.get('year')
    month = d.get('month')
    payload = d.get('payload') or {}
    try:
        year = int(year); month = int(month)
        if month < 1 or month > 12:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid year and month required.'}), 400

    payload_json = json.dumps(payload, ensure_ascii=False)
    h = content_hash(payload_json)
    t = now_iso()

    conn = get_db()
    existing = conn.execute('''SELECT id FROM reports_draft
        WHERE report_type = ? AND year = ? AND month = ?''',
        (rtype, year, month)).fetchone()

    if existing:
        conn.execute('''UPDATE reports_draft SET payload_json=?, content_hash=?,
            updated_by=?, updated_at=? WHERE id=?''',
            (payload_json, h, session.get('user_id'), t, existing['id']))
    else:
        conn.execute('''INSERT INTO reports_draft
            (report_type, year, month, payload_json, content_hash,
             updated_by, updated_at, created_at)
            VALUES (?,?,?,?,?,?,?,?)''',
            (rtype, year, month, payload_json, h,
             session.get('user_id'), t, t))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Draft saved.'})


# ==================== GET DRAFT ====================
@reports_bp.route('/api/reports/<report_type>/draft', methods=['GET'])
@login_required
def get_draft(report_type):
    rtype = (report_type or '').strip().upper()
    if rtype not in REPORT_TYPES:
        return jsonify({'error': 'Invalid report type.'}), 400

    year = request.args.get('year')
    month = request.args.get('month')
    try:
        year = int(year); month = int(month)
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid year and month required.'}), 400

    conn = get_db()
    row = conn.execute('''SELECT payload_json, updated_at FROM reports_draft
        WHERE report_type = ? AND year = ? AND month = ?''',
        (rtype, year, month)).fetchone()
    conn.close()

    if not row:
        return jsonify({'success': True, 'draft': None})
    return jsonify({
        'success': True,
        'draft': json.loads(row['payload_json']),
        'updated_at': row['updated_at']
    })


# ==================== SAVE TO MONTHLY REGISTER ====================
@reports_bp.route('/api/reports/<report_type>/send-to-register', methods=['POST'])
@login_required
def send_to_register(report_type):
    rtype = (report_type or '').strip().upper()
    if rtype not in REPORT_TYPES:
        return jsonify({'error': 'Invalid report type.'}), 400

    d = request.get_json() or {}
    year = d.get('year')
    month = d.get('month')
    payload = d.get('payload') or {}
    try:
        year = int(year); month = int(month)
        if month < 1 or month > 12:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid year and month required.'}), 400

    payload_json = json.dumps(payload, ensure_ascii=False)
    new_hash = content_hash(payload_json)

    conn = get_db()

    # Last version for this (type, year, month)
    last = conn.execute('''SELECT version_no, content_hash
        FROM report_versions WHERE report_type = ? AND year = ? AND month = ?
        ORDER BY version_no DESC LIMIT 1''',
        (rtype, year, month)).fetchone()

    # Duplicate detection — same hash → no new version
    if last and last['content_hash'] == new_hash:
        conn.close()
        return jsonify({
            'success': True,
            'createdVersion': False,
            'versionNo': last['version_no'],
            'message': 'Same content already saved. No new version created.'
        })

    version_no = (last['version_no'] + 1) if last else 1
    t = now_iso()
    conn.execute('''INSERT INTO report_versions
        (report_type, year, month, version_no, payload_json, content_hash,
         created_by, created_by_username, created_at)
        VALUES (?,?,?,?,?,?,?,?,?)''',
        (rtype, year, month, version_no, payload_json, new_hash,
         session.get('user_id'), session.get('username'), t))

    # Also update draft so it stays in sync
    existing_draft = conn.execute('''SELECT id FROM reports_draft
        WHERE report_type = ? AND year = ? AND month = ?''',
        (rtype, year, month)).fetchone()
    if existing_draft:
        conn.execute('''UPDATE reports_draft SET payload_json=?, content_hash=?,
            updated_by=?, updated_at=? WHERE id=?''',
            (payload_json, new_hash, session.get('user_id'), t, existing_draft['id']))
    else:
        conn.execute('''INSERT INTO reports_draft
            (report_type, year, month, payload_json, content_hash,
             updated_by, updated_at, created_at)
            VALUES (?,?,?,?,?,?,?,?)''',
            (rtype, year, month, payload_json, new_hash,
             session.get('user_id'), t, t))

    conn.commit()
    conn.close()
    return jsonify({
        'success': True,
        'createdVersion': True,
        'versionNo': version_no,
        'message': 'Version v' + str(version_no) + ' created.'
    })


# ==================== MONTHLY REGISTER — LIST ====================
@reports_bp.route('/api/reports/register', methods=['GET'])
@login_required
def register_list():
    year = request.args.get('year')
    month = request.args.get('month')
    rtype = (request.args.get('type') or '').strip().upper()

    conn = get_db()
    where = []
    params = []
    if year:
        try:
            where.append('year = ?')
            params.append(int(year))
        except ValueError:
            pass
    if month:
        try:
            where.append('month = ?')
            params.append(int(month))
        except ValueError:
            pass
    if rtype and rtype in REPORT_TYPES:
        where.append('report_type = ?')
        params.append(rtype)

    sql = '''SELECT report_type, year, month,
             COUNT(*) AS version_count,
             MAX(created_at) AS latest_at
             FROM report_versions'''
    if where:
        sql += ' WHERE ' + ' AND '.join(where)
    sql += ' GROUP BY report_type, year, month ORDER BY year DESC, month DESC, report_type'

    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return jsonify({'success': True, 'reports': [dict(r) for r in rows]})


# ==================== MONTHLY REGISTER — DETAIL (all versions) ====================
@reports_bp.route('/api/reports/register/<report_type>/<int:year>/<int:month>', methods=['GET'])
@login_required
def register_detail(report_type, year, month):
    rtype = (report_type or '').strip().upper()
    if rtype not in REPORT_TYPES:
        return jsonify({'error': 'Invalid report type.'}), 400

    conn = get_db()
    rows = conn.execute('''SELECT id, version_no, created_by_username, created_at
        FROM report_versions
        WHERE report_type = ? AND year = ? AND month = ?
        ORDER BY version_no DESC''',
        (rtype, year, month)).fetchall()
    conn.close()
    return jsonify({
        'success': True,
        'report_type': rtype,
        'report_label': REPORT_TYPES[rtype]['label'],
        'year': year,
        'month': month,
        'versions': [dict(r) for r in rows]
    })


# ==================== GET ONE VERSION (with payload) ====================
@reports_bp.route('/api/reports/version/<int:vid>', methods=['GET'])
@login_required
def get_version(vid):
    conn = get_db()
    row = conn.execute('SELECT * FROM report_versions WHERE id = ?', (vid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Version not found.'}), 404
    return jsonify({
        'success': True,
        'version': {
            'id': row['id'],
            'report_type': row['report_type'],
            'report_label': REPORT_TYPES.get(row['report_type'], {}).get('label', row['report_type']),
            'year': row['year'],
            'month': row['month'],
            'version_no': row['version_no'],
            'created_at': row['created_at'],
            'created_by': row['created_by_username'],
            'payload': json.loads(row['payload_json'])
        }
    })


# ==================== DELETE VERSIONS (Medium Action → Recycle Bin) ====================
@reports_bp.route('/api/reports/register/<report_type>/<int:year>/<int:month>/delete-versions', methods=['POST'])
@login_required
def delete_versions(report_type, year, month):
    rtype = (report_type or '').strip().upper()
    if rtype not in REPORT_TYPES:
        return jsonify({'error': 'Invalid report type.'}), 400

    d = request.get_json() or {}
    ids = d.get('version_ids') or []
    if not ids:
        return jsonify({'error': 'No versions selected.'}), 400

    conn = get_db()
    deleted = 0
    for vid in ids:
        row = conn.execute('''SELECT * FROM report_versions
            WHERE id = ? AND report_type = ? AND year = ? AND month = ?''',
            (vid, rtype, year, month)).fetchone()
        if not row:
            continue
        # Push to Recycle Bin (MEDIUM)
        try:
            from settings import push_recycle
            push_recycle(conn, 'MEDIUM', 'REPORTS', 'REPORT_VERSION',
                         record_id=row['id'],
                         record_name=REPORT_TYPES[rtype]['label'] + ' · v' + str(row['version_no']) +
                                     ' · ' + str(month) + '/' + str(year),
                         record_data={'report_type': rtype, 'year': year, 'month': month,
                                      'version_no': row['version_no']},
                         reason='Monthly Register version deleted')
        except Exception:
            pass
        conn.execute('DELETE FROM report_versions WHERE id = ?', (vid,))
        deleted += 1

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'deleted': deleted,
                    'message': str(deleted) + ' version(s) deleted.'})


# ==================== REPORT TYPES LIST ====================
@reports_bp.route('/api/reports/types', methods=['GET'])
@login_required
def report_types():
    return jsonify({'success': True, 'types': REPORT_TYPES})
