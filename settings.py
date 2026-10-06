"""Record Room - Settings Module (Account, Security, Recycle Bin, Audit, Hard Delete)"""
import os, json, hashlib
from datetime import datetime
from functools import wraps
from flask import Blueprint, request, jsonify, session

settings_bp = Blueprint('settings', __name__)

APP_NAME = 'Record Room'
APP_VERSION = '1.0.0'
DB_VERSION = '1.0'
BUILD_VERSION = '2026.10.06'
VERSION_UPDATE_DATE = '2026-10-06'
LAST_SYSTEM_UPDATE = '2026-10-06'
DEVELOPER_INFO = 'Record Room — Data Manager'


def now_iso():
    return datetime.utcnow().isoformat(timespec='seconds') + 'Z'


def hash_password(pw):
    return hashlib.sha256(pw.encode('utf-8')).hexdigest()


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


def add_col(conn, table, column, ddl):
    try:
        cur = conn.execute('PRAGMA table_info(' + table + ')')
        cols = [r[1] for r in cur.fetchall()]
        if column not in cols:
            conn.execute('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + ddl)
            return True
    except Exception:
        pass
    return False


def init_settings_tables():
    conn = get_db()
    c = conn.cursor()

    # Upgrade users table with profile + security fields
    add_col(conn, 'users', 'profile_photo_data', 'TEXT')
    add_col(conn, 'users', 'mobile', 'TEXT')
    add_col(conn, 'users', 'email', 'TEXT')
    add_col(conn, 'users', 'employee_id', 'TEXT')
    add_col(conn, 'users', 'delete_pin_hash', 'TEXT')
    add_col(conn, 'users', 'master_password_hash', 'TEXT')

    # Audit logs
    c.execute('''CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id INTEGER,
        actor_username TEXT,
        module TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        old_values TEXT,
        new_values TEXT,
        reason TEXT,
        effective_date TEXT,
        metadata TEXT,
        created_at TEXT NOT NULL)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(module)')

    # Recycle bin
    c.execute('''CREATE TABLE IF NOT EXISTS recycle_bin (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        module TEXT NOT NULL,
        record_type TEXT NOT NULL,
        record_id TEXT,
        record_name TEXT,
        record_data TEXT,
        effective_date TEXT,
        reason TEXT,
        deleted_by INTEGER,
        deleted_by_username TEXT,
        deleted_at TEXT NOT NULL,
        restored_by INTEGER,
        restored_at TEXT,
        restored_status TEXT DEFAULT 'PENDING')''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_recycle_cat ON recycle_bin(category)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_recycle_status ON recycle_bin(restored_status)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_recycle_deleted ON recycle_bin(deleted_at)')

    conn.commit()
    conn.close()


def write_audit(conn, module, action, target_type=None, target_id=None,
                old_values=None, new_values=None, reason=None, effective_date=None, metadata=None):
    """Central audit logger."""
    conn.execute('''INSERT INTO audit_logs
        (actor_user_id, actor_username, module, action, target_type, target_id,
         old_values, new_values, reason, effective_date, metadata, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)''',
        (session.get('user_id'), session.get('username'),
         module, action, target_type, str(target_id) if target_id is not None else None,
         json.dumps(old_values, ensure_ascii=False) if old_values else None,
         json.dumps(new_values, ensure_ascii=False) if new_values else None,
         reason, effective_date,
         json.dumps(metadata, ensure_ascii=False) if metadata else None,
         now_iso()))


def push_recycle(conn, category, module, record_type, record_id=None, record_name=None,
                 record_data=None, effective_date=None, reason=None):
    """Push a deleted record into Recycle Bin."""
    conn.execute('''INSERT INTO recycle_bin
        (category, module, record_type, record_id, record_name, record_data,
         effective_date, reason, deleted_by, deleted_by_username, deleted_at, restored_status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?, 'PENDING')''',
        (category, module, record_type,
         str(record_id) if record_id is not None else None,
         record_name,
         json.dumps(record_data, ensure_ascii=False) if record_data else None,
         effective_date, reason,
         session.get('user_id'), session.get('username'), now_iso()))


# ==================== PROFILE ====================
@settings_bp.route('/api/settings/profile', methods=['GET'])
@login_required
def get_profile():
    conn = get_db()
    u = conn.execute('SELECT id, username, full_name, profile_photo_data, mobile, email, employee_id FROM users WHERE id = ?',
                     (session.get('user_id'),)).fetchone()
    conn.close()
    if not u:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'success': True,
        'profile': {
            'id': u['id'],
            'username': u['username'],
            'role': 'Super Admin',
            'full_name': u['full_name'],
            'profile_photo_data': u['profile_photo_data'],
            'mobile': u['mobile'] or '',
            'email': u['email'] or '',
            'employee_id': u['employee_id'] or ''
        }
    })


@settings_bp.route('/api/settings/profile', methods=['PATCH'])
@login_required
def update_profile():
    d = request.get_json() or {}
    full_name = (d.get('full_name') or '').strip()
    if not full_name:
        return jsonify({'error': 'Full Name is required.'}), 400

    mobile = (d.get('mobile') or '').strip() or None
    email = (d.get('email') or '').strip() or None
    employee_id = (d.get('employee_id') or '').strip() or None
    photo_new = d.get('profile_photo_data') if 'profile_photo_data' in d else None

    conn = get_db()
    old = conn.execute('SELECT * FROM users WHERE id = ?', (session.get('user_id'),)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    # Photo handling — if 'profile_photo_data' key is present in payload, use it (may be None to remove)
    if 'profile_photo_data' in d:
        photo_final = photo_new  # can be None for remove
    else:
        photo_final = old['profile_photo_data']

    # Build changes
    changes = {}
    if full_name != (old['full_name'] or ''):
        changes['full_name'] = {'old': old['full_name'], 'new': full_name}
    if mobile != (old['mobile'] or None):
        changes['mobile'] = {'old': old['mobile'], 'new': mobile}
    if email != (old['email'] or None):
        changes['email'] = {'old': old['email'], 'new': email}
    if employee_id != (old['employee_id'] or None):
        changes['employee_id'] = {'old': old['employee_id'], 'new': employee_id}

    old_photo = old['profile_photo_data'] or ''
    new_photo = photo_final or ''
    if old_photo != new_photo:
        if not old_photo and new_photo:
            changes['profile_photo'] = {'old': None, 'new': '(photo added)'}
        elif old_photo and not new_photo:
            changes['profile_photo'] = {'old': '(photo)', 'new': None}
        else:
            changes['profile_photo'] = {'old': '(photo)', 'new': '(photo changed)'}

    if not changes:
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'changed': False, 'message': 'No changes.'})

    t = now_iso()
    conn.execute('''UPDATE users SET full_name=?, mobile=?, email=?, employee_id=?,
        profile_photo_data=?, updated_at=? WHERE id=?''',
        (full_name, mobile, email, employee_id, photo_final, t, session.get('user_id')))

    # ONE grouped audit event
    write_audit(conn, 'ACCOUNT', 'PROFILE_UPDATED',
                target_type='USER', target_id=session.get('user_id'),
                old_values=changes, new_values=None)
    conn.commit()

    u = conn.execute('SELECT id, username, full_name, profile_photo_data, mobile, email, employee_id FROM users WHERE id = ?',
                     (session.get('user_id'),)).fetchone()
    conn.close()
    return jsonify({
        'success': True,
        'changed': True,
        'message': 'Profile updated successfully.',
        'profile': dict(u)
    })


# ==================== SECURITY — DELETE PIN ====================
@settings_bp.route('/api/settings/security/pin', methods=['POST'])
@login_required
def change_delete_pin():
    d = request.get_json() or {}
    current = (d.get('current_pin') or '').strip()
    new_pin = (d.get('new_pin') or '').strip()
    confirm = (d.get('confirm_pin') or '').strip()

    if not current or not new_pin or not confirm:
        return jsonify({'error': 'All fields are required.'}), 400
    if new_pin != confirm:
        return jsonify({'error': 'New credential and confirmation do not match.'}), 400
    if len(new_pin) < 4:
        return jsonify({'error': 'Delete PIN must be at least 4 characters.'}), 400

    conn = get_db()
    u = conn.execute('SELECT * FROM users WHERE id = ?', (session.get('user_id'),)).fetchone()
    if not u:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    # If a PIN exists, verify current
    if u['delete_pin_hash']:
        if u['delete_pin_hash'] != hash_password(current):
            conn.close()
            return jsonify({'error': 'Current credential is incorrect.'}), 400
    else:
        # First-time set: verify with login password
        if u['password_hash'] != hash_password(current):
            conn.close()
            return jsonify({'error': 'Current credential is incorrect.'}), 400

    t = now_iso()
    conn.execute('UPDATE users SET delete_pin_hash=?, updated_at=? WHERE id=?',
                 (hash_password(new_pin), t, session.get('user_id')))
    write_audit(conn, 'SECURITY', 'DELETE_PIN_UPDATED',
                target_type='USER', target_id=session.get('user_id'))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Security setting updated successfully.'})


# ==================== SECURITY — MASTER PASSWORD ====================
@settings_bp.route('/api/settings/security/master', methods=['POST'])
@login_required
def change_master_password():
    d = request.get_json() or {}
    current = (d.get('current_password') or '').strip()
    new_pw = (d.get('new_password') or '').strip()
    confirm = (d.get('confirm_password') or '').strip()

    if not current or not new_pw or not confirm:
        return jsonify({'error': 'All fields are required.'}), 400
    if new_pw != confirm:
        return jsonify({'error': 'New credential and confirmation do not match.'}), 400
    if len(new_pw) < 6:
        return jsonify({'error': 'Master Password must be at least 6 characters.'}), 400

    conn = get_db()
    u = conn.execute('SELECT * FROM users WHERE id = ?', (session.get('user_id'),)).fetchone()
    if not u:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    if u['master_password_hash']:
        if u['master_password_hash'] != hash_password(current):
            conn.close()
            return jsonify({'error': 'Current credential is incorrect.'}), 400
    else:
        if u['password_hash'] != hash_password(current):
            conn.close()
            return jsonify({'error': 'Current credential is incorrect.'}), 400

    t = now_iso()
    conn.execute('UPDATE users SET master_password_hash=?, updated_at=? WHERE id=?',
                 (hash_password(new_pw), t, session.get('user_id')))
    write_audit(conn, 'SECURITY', 'MASTER_PASSWORD_UPDATED',
                target_type='USER', target_id=session.get('user_id'))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Security setting updated successfully.'})


# ==================== SECURITY — LOGIN PASSWORD ====================
@settings_bp.route('/api/settings/security/login', methods=['POST'])
@login_required
def change_login_password():
    d = request.get_json() or {}
    current = (d.get('current_password') or '').strip()
    new_pw = (d.get('new_password') or '').strip()
    confirm = (d.get('confirm_password') or '').strip()

    if not current or not new_pw or not confirm:
        return jsonify({'error': 'All fields are required.'}), 400
    if new_pw != confirm:
        return jsonify({'error': 'New credential and confirmation do not match.'}), 400
    if len(new_pw) < 6:
        return jsonify({'error': 'Login Password must be at least 6 characters.'}), 400

    conn = get_db()
    u = conn.execute('SELECT * FROM users WHERE id = ?', (session.get('user_id'),)).fetchone()
    if not u:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    if u['password_hash'] != hash_password(current):
        conn.close()
        return jsonify({'error': 'Current credential is incorrect.'}), 400

    t = now_iso()
    conn.execute('UPDATE users SET password_hash=?, updated_at=? WHERE id=?',
                 (hash_password(new_pw), t, session.get('user_id')))
    write_audit(conn, 'SECURITY', 'LOGIN_PASSWORD_UPDATED',
                target_type='USER', target_id=session.get('user_id'))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Security setting updated successfully.'})


# ==================== AUDIT LOG ====================
@settings_bp.route('/api/settings/audit', methods=['GET'])
@login_required
def get_audit_log():
    module = (request.args.get('module') or '').strip()
    page = max(1, int(request.args.get('page') or 1))
    per_page = 20
    offset = (page - 1) * per_page

    conn = get_db()
    where = []
    params = []
    if module:
        where.append('module = ?')
        params.append(module)

    sql_count = 'SELECT COUNT(*) AS c FROM audit_logs'
    sql_data = 'SELECT * FROM audit_logs'
    if where:
        sql_count += ' WHERE ' + ' AND '.join(where)
        sql_data += ' WHERE ' + ' AND '.join(where)
    sql_data += ' ORDER BY datetime(created_at) DESC, id DESC LIMIT ? OFFSET ?'

    total = conn.execute(sql_count, params).fetchone()['c']
    rows = conn.execute(sql_data, params + [per_page, offset]).fetchall()
    conn.close()

    return jsonify({
        'success': True,
        'logs': [dict(r) for r in rows],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': max(1, (total + per_page - 1) // per_page)
    })


# ==================== RECYCLE BIN ====================
@settings_bp.route('/api/settings/recycle', methods=['GET'])
@login_required
def list_recycle():
    category = (request.args.get('category') or '').strip().upper()
    page = max(1, int(request.args.get('page') or 1))
    per_page = 10
    offset = (page - 1) * per_page

    conn = get_db()
    where = ["restored_status = 'PENDING'"]
    params = []
    if category and category in ('SMALL', 'MEDIUM', 'HARD'):
        where.append('category = ?')
        params.append(category)

    sql_count = 'SELECT COUNT(*) AS c FROM recycle_bin WHERE ' + ' AND '.join(where)
    sql_data = 'SELECT * FROM recycle_bin WHERE ' + ' AND '.join(where)
    sql_data += ' ORDER BY datetime(deleted_at) DESC, id DESC LIMIT ? OFFSET ?'

    total = conn.execute(sql_count, params).fetchone()['c']
    rows = conn.execute(sql_data, params + [per_page, offset]).fetchall()

    # Counts
    counts = {}
    for cat in ('SMALL', 'MEDIUM', 'HARD'):
        cnt = conn.execute("SELECT COUNT(*) AS c FROM recycle_bin WHERE category = ? AND restored_status = 'PENDING'", (cat,)).fetchone()['c']
        counts[cat] = cnt

    conn.close()
    return jsonify({
        'success': True,
        'items': [dict(r) for r in rows],
        'counts': counts,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': max(1, (total + per_page - 1) // per_page)
    })


# DEPRECATED — replaced by recover_items_v2 below
# @settings_bp.route('/api/settings/recycle/recover', methods=['POST'])
# @login_required
def recover_items_DEPRECATED():
    d = request.get_json() or {}
    ids = d.get('ids') or []
    if not ids:
        return jsonify({'error': 'Please select at least one item.'}), 400

    conn = get_db()
    recovered = 0
    for rid in ids:
        row = conn.execute("SELECT * FROM recycle_bin WHERE id = ? AND restored_status = 'PENDING'", (rid,)).fetchone()
        if not row:
            continue
        # Mark as recovered
        conn.execute('''UPDATE recycle_bin SET restored_status = 'RECOVERED',
            restored_by = ?, restored_at = ? WHERE id = ?''',
            (session.get('user_id'), now_iso(), rid))
        write_audit(conn, 'RECYCLE', 'ITEM_RECOVERED',
                    target_type=row['record_type'], target_id=row['record_id'],
                    metadata={'module': row['module'], 'record_name': row['record_name']})
        recovered += 1

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'recovered': recovered,
                    'message': 'Selected items recovered successfully.'})


@settings_bp.route('/api/settings/recycle/delete', methods=['POST'])
@login_required
def permanent_delete():
    d = request.get_json() or {}
    ids = d.get('ids') or []
    pin = (d.get('pin') or '').strip()
    master = (d.get('master_password') or '').strip()

    if not ids:
        return jsonify({'error': 'Please select at least one item.'}), 400
    if not pin:
        return jsonify({'error': 'Please verify Delete PIN and Master Password.'}), 400

    conn = get_db()
    u = conn.execute('SELECT * FROM users WHERE id = ?', (session.get('user_id'),)).fetchone()
    if not u:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    # Check if any HARD category — need master password
    has_hard = False
    for rid in ids:
        row = conn.execute('SELECT category FROM recycle_bin WHERE id = ?', (rid,)).fetchone()
        if row and row['category'] == 'HARD':
            has_hard = True
            break

    # Verify PIN
    if not u['delete_pin_hash'] or u['delete_pin_hash'] != hash_password(pin):
        conn.close()
        return jsonify({'error': 'Please verify Delete PIN and Master Password.'}), 400

    # If HARD items present, also require master password
    if has_hard:
        if not master or not u['master_password_hash'] or u['master_password_hash'] != hash_password(master):
            conn.close()
            return jsonify({'error': 'Please verify Delete PIN and Master Password.'}), 400

    deleted = 0
    for rid in ids:
        row = conn.execute('SELECT * FROM recycle_bin WHERE id = ?', (rid,)).fetchone()
        if not row:
            continue
        conn.execute('DELETE FROM recycle_bin WHERE id = ?', (rid,))
        write_audit(conn, 'RECYCLE', 'PERMANENT_DELETE',
                    target_type=row['record_type'], target_id=row['record_id'],
                    metadata={'module': row['module'], 'category': row['category'],
                              'record_name': row['record_name']})
        deleted += 1

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'deleted': deleted,
                    'message': 'Selected items permanently deleted.'})


# ==================== HARD DELETE ACTIONS ====================
@settings_bp.route('/api/settings/hard-delete', methods=['POST'])
@login_required
def hard_delete_action():
    d = request.get_json() or {}
    module = (d.get('module') or '').strip().upper()
    pin = (d.get('pin') or '').strip()
    master = (d.get('master_password') or '').strip()
    confirm_text = (d.get('confirm') or '').strip()

    if confirm_text != 'DELETE':
        return jsonify({'error': 'Final confirmation is required. Type DELETE.'}), 400
    if not pin or not master:
        return jsonify({'error': 'Please verify Delete PIN and Master Password.'}), 400

    # Map of allowed modules
    VALID_MODULES = {
        'FAMILY': ['families', 'family_members', 'family_logs'],
        'BENEFICIARIES': ['beneficiary_profiles', 'beneficiary_profile_logs'],
        'THR': ['thr_distributions', 'thr_distribution_logs'],
        'ATTENDANCE': ['attendance_records', 'attendance_logs'],
        'HOLIDAY': ['holidays', 'holiday_logs'],
        'STOCK': ['stock_entries', 'stock_logs', 'stock_recipe_lines']
    }
    if module not in VALID_MODULES:
        return jsonify({'error': 'Invalid module for hard delete.'}), 400

    conn = get_db()
    u = conn.execute('SELECT * FROM users WHERE id = ?', (session.get('user_id'),)).fetchone()
    if not u or not u['delete_pin_hash'] or u['delete_pin_hash'] != hash_password(pin):
        conn.close()
        return jsonify({'error': 'Please verify Delete PIN and Master Password.'}), 400
    if not u['master_password_hash'] or u['master_password_hash'] != hash_password(master):
        conn.close()
        return jsonify({'error': 'Please verify Delete PIN and Master Password.'}), 400

    # Snapshot ALL rows before delete
    counts = {}
    snapshot = {'module': module, 'tables': {}}
    try:
        for tbl in VALID_MODULES[module]:
            try:
                rows = conn.execute('SELECT * FROM ' + tbl).fetchall()
                rows_list = [dict(r) for r in rows]
                counts[tbl] = len(rows_list)
                snapshot['tables'][tbl] = rows_list
            except Exception:
                counts[tbl] = 0
                snapshot['tables'][tbl] = []

        snapshot['rows_cleared'] = counts

        # Push to Recycle Bin as HARD entry with FULL snapshot
        try:
            from settings import push_recycle
            push_recycle(conn, 'HARD', 'HARD_DELETE', 'HARD_CLEAR',
                         record_id=None,
                         record_name=module + ' — ' + str(sum(counts.values())) + ' rows cleared',
                         record_data=snapshot,
                         reason='Hard delete action')
        except Exception:
            pass

        # Delete only data
        for tbl in VALID_MODULES[module]:
            try:
                conn.execute('DELETE FROM ' + tbl)
            except Exception:
                pass

        # Audit
        write_audit(conn, 'HARD_DELETE', 'DATA_CLEARED',
                    target_type=module, target_id=None,
                    metadata={'rows_deleted': counts},
                    reason='Hard delete action')
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': 'Unable to complete hard delete. Please try again.'}), 500

    conn.close()
    return jsonify({'success': True, 'message': 'Data moved to Recycle Bin → Hard Actions.',
                    'counts': counts})


# ==================== ABOUT / SYSTEM INFO ====================
@settings_bp.route('/api/settings/about', methods=['GET'])
@login_required
def get_about():
    conn = get_db()
    u = conn.execute('SELECT id, username, full_name FROM users WHERE id = ?', (session.get('user_id'),)).fetchone()
    conn.close()
    return jsonify({
        'success': True,
        'about': {
            'app_name': APP_NAME,
            'app_version': APP_VERSION,
            'db_version': DB_VERSION,
            'build_version': BUILD_VERSION,
            'version_update_date': VERSION_UPDATE_DATE,
            'last_system_update': LAST_SYSTEM_UPDATE,
            'role': 'Super Admin',
            'username': u['username'] if u else '',
            'developer': DEVELOPER_INFO
        }
    })


# ==================== RECOVER DISPATCHER ====================
def recover_record(conn, module, record_type, record_id, record_data):
    """
    Restore the deleted record back to its original state.
    Returns (success: bool, error_msg: str or None).
    """
    try:
        data = json.loads(record_data) if record_data else {}
    except Exception:
        data = {}

    rid = record_id

    # HARD Delete — restore from snapshot
    if module == 'HARD_DELETE' or record_type == 'HARD_CLEAR':
        snap = data if data else {}
        tables = snap.get('tables') or {}
        if not tables:
            return False, 'No snapshot data available for recovery.'
        restored_total = 0
        for tbl, rows in tables.items():
            if not rows:
                continue
            # Check table exists and get its columns
            try:
                cur = conn.execute('PRAGMA table_info(' + tbl + ')')
                valid_cols = [r[1] for r in cur.fetchall()]
            except Exception:
                continue
            for row in rows:
                cols = [c for c in row.keys() if c in valid_cols]
                if not cols:
                    continue
                placeholders = ','.join(['?'] * len(cols))
                col_names = ','.join(cols)
                vals = [row[c] for c in cols]
                try:
                    conn.execute('INSERT OR REPLACE INTO ' + tbl + ' (' + col_names + ') VALUES (' + placeholders + ')', vals)
                    restored_total += 1
                except Exception:
                    pass
        return True, None

    try:
        if module == 'FAMILY' and record_type == 'FAMILY':
            # Reactivate family + its members that were inactivated together
            conn.execute('UPDATE families SET is_active = 1, updated_at = ? WHERE id = ?', (now_iso(), rid))
            # Note: we only restore the family itself, not its members (they were individually recycled)
            return True, None

        elif module == 'FAMILY' and record_type == 'FAMILY_MEMBER':
            conn.execute('UPDATE family_members SET is_active = 1, updated_at = ? WHERE id = ?', (now_iso(), rid))
            return True, None

        elif module == 'BENEFICIARIES' and record_type == 'BENEFICIARY':
            conn.execute('UPDATE beneficiary_profiles SET is_active = 1, updated_at = ? WHERE id = ?', (now_iso(), rid))
            return True, None

        elif module == 'STOCK' and record_type == 'STOCK_ENTRY':
            conn.execute("UPDATE stock_entries SET status = 'ACTIVE', deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = ? WHERE id = ?",
                         (now_iso(), rid))
            return True, None

        elif module == 'THR' and record_type == 'THR_DISTRIBUTION':
            conn.execute("UPDATE thr_distributions SET status = 'ACTIVE', deleted_at = NULL, deleted_by = NULL, delete_reason = NULL, updated_at = ? WHERE id = ?",
                         (now_iso(), rid))
            return True, None

        elif module == 'HOLIDAY' and record_type == 'HOLIDAY':
            conn.execute('UPDATE holidays SET is_active = 1, updated_at = ? WHERE id = ?', (now_iso(), rid))
            return True, None

        elif module == 'ATTENDANCE' and record_type == 'ATTENDANCE':
            # Recreate attendance record from data
            conn.execute('''INSERT OR IGNORE INTO attendance_records
                (beneficiary_id, attendance_date, status, created_by, updated_by, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?)''',
                (data.get('beneficiary_id'), data.get('attendance_date'), data.get('status'),
                 data.get('created_by'), data.get('updated_by'), data.get('created_at'), data.get('updated_at')))
            return True, None

        else:
            # Unknown type — try a generic fallback
            return False, 'Recovery not supported for ' + module + '/' + record_type
    except Exception as e:
        return False, str(e)


@settings_bp.route('/api/settings/recycle/recover', methods=['POST'])
@login_required
def recover_items_v2():
    d = request.get_json() or {}
    ids = d.get('ids') or []
    if not ids:
        return jsonify({'error': 'Please select at least one item.'}), 400

    conn = get_db()
    recovered = 0
    failed = []

    for rid in ids:
        row = conn.execute("SELECT * FROM recycle_bin WHERE id = ? AND restored_status = 'PENDING'", (rid,)).fetchone()
        if not row:
            continue
        ok, err = recover_record(conn, row['module'], row['record_type'], row['record_id'], row['record_data'])
        if ok:
            conn.execute('''UPDATE recycle_bin SET restored_status = 'RECOVERED',
                restored_by = ?, restored_at = ? WHERE id = ?''',
                (session.get('user_id'), now_iso(), rid))
            write_audit(conn, 'RECYCLE', 'ITEM_RECOVERED',
                        target_type=row['record_type'], target_id=row['record_id'],
                        metadata={'module': row['module'], 'record_name': row['record_name']})
            recovered += 1
        else:
            failed.append({'id': rid, 'error': err})

    conn.commit()
    conn.close()
    msg = 'Selected items recovered successfully.'
    if failed:
        msg = str(recovered) + ' recovered, ' + str(len(failed)) + ' failed.'
    return jsonify({'success': True, 'recovered': recovered, 'failed': failed, 'message': msg})


# ==================== APP SETTINGS (VERSION INFO) ====================
def init_app_settings_table():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT,
        updated_by INTEGER,
        updated_at TEXT)''')
    conn.commit()

    # Seed defaults
    defaults = {
        'app_name': 'Record Room',
        'app_version': APP_VERSION,
        'db_version': DB_VERSION,
        'build_version': BUILD_VERSION,
        'version_update_date': VERSION_UPDATE_DATE,
        'last_system_update': LAST_SYSTEM_UPDATE,
        'developer': DEVELOPER_INFO
    }
    for k, v in defaults.items():
        existing = conn.execute('SELECT id FROM app_settings WHERE key = ?', (k,)).fetchone()
        if not existing:
            conn.execute('INSERT INTO app_settings (key, value, updated_at) VALUES (?,?,?)',
                         (k, v, now_iso()))
    conn.commit()
    conn.close()


def get_app_setting(conn, key, default=''):
    try:
        row = conn.execute('SELECT value FROM app_settings WHERE key = ?', (key,)).fetchone()
        return row['value'] if row else default
    except Exception:
        return default


# ==================== ABOUT APIs ====================
@settings_bp.route('/api/settings/about-full', methods=['GET'])
@login_required
def get_about_full():
    conn = get_db()
    u = conn.execute('SELECT id, username FROM users WHERE id = ?', (session.get('user_id'),)).fetchone()
    about = {
        'app_name': get_app_setting(conn, 'app_name', APP_NAME),
        'app_version': get_app_setting(conn, 'app_version', APP_VERSION),
        'db_version': get_app_setting(conn, 'db_version', DB_VERSION),
        'build_version': get_app_setting(conn, 'build_version', BUILD_VERSION),
        'version_update_date': get_app_setting(conn, 'version_update_date', VERSION_UPDATE_DATE),
        'last_system_update': get_app_setting(conn, 'last_system_update', LAST_SYSTEM_UPDATE),
        'developer': get_app_setting(conn, 'developer', DEVELOPER_INFO),
        'role': 'Super Admin',
        'username': u['username'] if u else ''
    }
    conn.close()
    return jsonify({'success': True, 'about': about})


@settings_bp.route('/api/settings/about-full', methods=['PATCH'])
@login_required
def update_about():
    d = request.get_json() or {}
    allowed = ['app_name', 'app_version', 'db_version', 'build_version',
               'version_update_date', 'last_system_update', 'developer']
    conn = get_db()

    old_vals = {}
    new_vals = {}
    for key in allowed:
        if key in d:
            old_v = get_app_setting(conn, key, '')
            new_v = (d.get(key) or '').strip()
            if str(old_v) != str(new_v):
                old_vals[key] = {'old': old_v, 'new': new_v}
                new_vals[key] = new_v

    if not old_vals:
        conn.close()
        return jsonify({'success': True, 'changed': False, 'message': 'No changes.'})

    t = now_iso()
    for key, val in new_vals.items():
        existing = conn.execute('SELECT id FROM app_settings WHERE key = ?', (key,)).fetchone()
        if existing:
            conn.execute('UPDATE app_settings SET value = ?, updated_by = ?, updated_at = ? WHERE key = ?',
                         (val, session.get('user_id'), t, key))
        else:
            conn.execute('INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES (?,?,?,?)',
                         (key, val, session.get('user_id'), t))

    # ONE grouped audit event
    write_audit(conn, 'SETTINGS', 'VERSION_INFO_UPDATED',
                target_type='APP_SETTINGS', target_id=None,
                old_values=old_vals, new_values=None)
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'changed': True, 'message': 'Version information updated successfully.'})


@settings_bp.route('/api/settings/about-full/logs', methods=['GET'])
@login_required
def get_about_logs():
    conn = get_db()
    rows = conn.execute('''SELECT * FROM audit_logs
        WHERE module = 'SETTINGS' AND action LIKE 'VERSION%'
        ORDER BY datetime(created_at) DESC, id DESC LIMIT 200''').fetchall()
    conn.close()
    return jsonify({'success': True, 'logs': [dict(r) for r in rows]})


# ==================== CLEAR ALL AUDIT LOGS ====================
@settings_bp.route('/api/settings/hard-delete/audit-logs', methods=['POST'])
@login_required
def clear_all_audit_logs():
    d = request.get_json() or {}
    pin = (d.get('pin') or '').strip()
    master = (d.get('master_password') or '').strip()
    confirm = (d.get('confirm') or '').strip()

    if confirm != 'DELETE':
        return jsonify({'error': 'Final confirmation is required. Type DELETE.'}), 400
    if not pin or not master:
        return jsonify({'error': 'Please verify Delete PIN and Master Password.'}), 400

    conn = get_db()
    u = conn.execute('SELECT * FROM users WHERE id = ?', (session.get('user_id'),)).fetchone()
    if not u or not u['delete_pin_hash'] or u['delete_pin_hash'] != hash_password(pin):
        conn.close()
        return jsonify({'error': 'Please verify Delete PIN and Master Password.'}), 400
    if not u['master_password_hash'] or u['master_password_hash'] != hash_password(master):
        conn.close()
        return jsonify({'error': 'Please verify Delete PIN and Master Password.'}), 400

    # Snapshot audit logs into Recycle Bin (HARD)
    try:
        rows = conn.execute('SELECT * FROM audit_logs ORDER BY id ASC').fetchall()
        snapshot = {'tables': {'audit_logs': [dict(r) for r in rows]}, 'rows_cleared': {'audit_logs': len(rows)}, 'module': 'AUDIT_LOGS'}
        push_recycle(conn, 'HARD', 'HARD_DELETE', 'HARD_CLEAR',
                     record_id=None,
                     record_name='Audit Logs — ' + str(len(rows)) + ' rows cleared',
                     record_data=snapshot,
                     reason='Clear all audit logs')
        # Delete all
        conn.execute('DELETE FROM audit_logs')
        # Write a single audit entry after (so we know a clear happened)
        write_audit(conn, 'HARD_DELETE', 'AUDIT_LOGS_CLEARED',
                    target_type='AUDIT_LOGS', target_id=None,
                    metadata={'rows_cleared': len(rows)},
                    reason='Clear all audit logs')
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': 'Unable to clear logs. Please try again.'}), 500

    conn.close()
    return jsonify({'success': True, 'message': 'Audit logs moved to Recycle Bin → Hard Actions.',
                    'rows_cleared': len(rows)})
