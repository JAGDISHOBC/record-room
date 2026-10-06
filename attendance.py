"""Record Room - Attendance + Holiday + Calendar Module"""
import os, json
from datetime import datetime, date, timedelta
from functools import wraps
from flask import Blueprint, request, jsonify, session

attendance_bp = Blueprint('attendance', __name__)


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


def init_attendance_tables():
    conn = get_db()
    c = conn.cursor()

    # Attendance records - one per (beneficiary, date)
    c.execute('''CREATE TABLE IF NOT EXISTS attendance_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        beneficiary_id INTEGER NOT NULL,
        attendance_date TEXT NOT NULL,
        status TEXT NOT NULL,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(beneficiary_id, attendance_date))''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_att_date ON attendance_records(attendance_date)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_att_bene ON attendance_records(beneficiary_id)')

    # Attendance logs
    c.execute('''CREATE TABLE IF NOT EXISTS attendance_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        attendance_id INTEGER,
        beneficiary_id INTEGER,
        attendance_date TEXT,
        action TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT,
        reason TEXT,
        created_by INTEGER,
        created_by_username TEXT,
        created_at TEXT NOT NULL)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_att_log_date ON attendance_logs(attendance_date)')

    # Holidays
    c.execute('''CREATE TABLE IF NOT EXISTS holidays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        holiday_date TEXT NOT NULL,
        holiday_name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_holiday_date ON holidays(holiday_date)')

    # Holiday logs
    c.execute('''CREATE TABLE IF NOT EXISTS holiday_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        holiday_id INTEGER,
        action TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        reason TEXT,
        created_by INTEGER,
        created_by_username TEXT,
        created_at TEXT NOT NULL)''')

    conn.commit()
    conn.close()


def add_att_log(conn, attendance_id, bene_id, date_str, action, old_val=None, new_val=None, reason=None):
    conn.execute('''INSERT INTO attendance_logs
        (attendance_id, beneficiary_id, attendance_date, action, old_value, new_value, reason,
         created_by, created_by_username, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)''',
        (attendance_id, bene_id, date_str, action, old_val, new_val, reason,
         session.get('user_id'), session.get('username'), now_iso()))


def add_holiday_log(conn, holiday_id, action, old_vals=None, new_vals=None, reason=None):
    conn.execute('''INSERT INTO holiday_logs
        (holiday_id, action, old_values, new_values, reason,
         created_by, created_by_username, created_at)
        VALUES (?,?,?,?,?,?,?,?)''',
        (holiday_id, action,
         json.dumps(old_vals) if old_vals else None,
         json.dumps(new_vals) if new_vals else None,
         reason,
         session.get('user_id'), session.get('username'), now_iso()))


def is_holiday(conn, date_str):
    """Return active holiday row for the date, or None."""
    return conn.execute('''SELECT * FROM holidays
        WHERE holiday_date = ? AND is_active = 1 LIMIT 1''', (date_str,)).fetchone()


def is_sunday(date_str):
    try:
        d = datetime.strptime(date_str, '%Y-%m-%d').date()
        return d.weekday() == 6
    except Exception:
        return False


def age_years_on(dob_str, on_date_str):
    """Return age in years on a given date, or None if DOB invalid."""
    try:
        dob = datetime.strptime(dob_str, '%Y-%m-%d').date()
        on_date = datetime.strptime(on_date_str, '%Y-%m-%d').date()
        years = on_date.year - dob.year
        # Adjust if birthday not yet reached
        if (on_date.month, on_date.day) < (dob.month, dob.day):
            years -= 1
        return years
    except Exception:
        return None


def is_eligible_3_6_on(bene, on_date_str):
    """Check if beneficiary is 3-6 years old on given date AND category is 3-6Y."""
    if not bene:
        return False
    if bene['category'] != 'CHILD_36_72':
        return False
    if not bene['date_of_birth']:
        return False
    age = age_years_on(bene['date_of_birth'], on_date_str)
    if age is None:
        return False
    return 3 <= age < 6


# ==================== ATTENDANCE — LIST ELIGIBLE CHILDREN ====================
@attendance_bp.route('/api/admin/attendance/eligible', methods=['GET'])
@login_required
def att_eligible_children():
    """READ-ONLY list of 3-6Y children from beneficiaries eligible on given date."""
    date_str = (request.args.get('date') or '').strip()
    if not date_str:
        return jsonify({'error': 'Date is required.'}), 400

    conn = get_db()
    holiday = is_holiday(conn, date_str)

    # Get all active 3-6Y beneficiaries from Beneficiaries (READ ONLY)
    rows = conn.execute('''SELECT id, beneficiary_unique_id, full_name, category,
        date_of_birth, gender, house_number, father_name, mother_name,
        profile_photo_data, is_active, effective_date
        FROM beneficiary_profiles
        WHERE category = 'CHILD_36_72' AND is_active = 1
        ORDER BY full_name COLLATE NOCASE ASC''').fetchall()

    eligible = []
    for r in rows:
        bene = dict(r)
        # Effective date check
        if bene['effective_date'] and bene['effective_date'] > date_str:
            continue
        # Age check
        if not is_eligible_3_6_on(bene, date_str):
            continue
        eligible.append(bene)

    # Fetch attendance for this date
    att_rows = conn.execute('''SELECT * FROM attendance_records
        WHERE attendance_date = ?''', (date_str,)).fetchall()
    att_map = {a['beneficiary_id']: a['status'] for a in att_rows}

    # Attach status
    for bene in eligible:
        bene['attendance_status'] = att_map.get(bene['id'])

    conn.close()
    return jsonify({
        'success': True,
        'date': date_str,
        'is_sunday': is_sunday(date_str),
        'holiday': dict(holiday) if holiday else None,
        'children': eligible,
        'total': len(eligible),
        'present': sum(1 for c in eligible if c['attendance_status'] == 'PRESENT'),
        'absent': sum(1 for c in eligible if c['attendance_status'] == 'ABSENT'),
        'not_marked': sum(1 for c in eligible if not c['attendance_status'])
    })


# ==================== ATTENDANCE — SAVE (single) ====================
@attendance_bp.route('/api/admin/attendance/mark', methods=['POST'])
@login_required
def att_mark():
    d = request.get_json() or {}
    bene_id = d.get('beneficiary_id')
    date_str = (d.get('date') or '').strip()
    status = (d.get('status') or '').strip().upper()

    if not bene_id or not date_str:
        return jsonify({'error': 'Beneficiary and date are required.'}), 400
    if status not in ('PRESENT', 'ABSENT'):
        return jsonify({'error': 'Status must be PRESENT or ABSENT.'}), 400

    # Future date block
    today_str = date.today().isoformat()
    if date_str > today_str:
        return jsonify({'error': 'Future date की attendance दर्ज नहीं की जा सकती।'}), 400

    conn = get_db()

    # Holiday check
    if is_holiday(conn, date_str):
        conn.close()
        return jsonify({'error': 'इस दिन अवकाश है। Attendance दर्ज नहीं की जा सकती।'}), 400

    # Verify beneficiary exists, active, 3-6Y eligible on that date
    bene = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ? AND is_active = 1', (bene_id,)).fetchone()
    if not bene:
        conn.close()
        return jsonify({'error': 'Beneficiary not found.'}), 404
    if not is_eligible_3_6_on(dict(bene), date_str):
        conn.close()
        return jsonify({'error': 'यह बच्चा इस तारीख को 3-6 साल की श्रेणी में नहीं है।'}), 400

    # Upsert attendance
    existing = conn.execute('''SELECT * FROM attendance_records
        WHERE beneficiary_id = ? AND attendance_date = ?''', (bene_id, date_str)).fetchone()

    t = now_iso()
    uid = session.get('user_id')

    if existing:
        if existing['status'] == status:
            conn.close()
            return jsonify({'success': True, 'changed': False, 'message': 'No change.'})
        conn.execute('''UPDATE attendance_records SET status = ?, updated_by = ?, updated_at = ?
            WHERE id = ?''', (status, uid, t, existing['id']))
        add_att_log(conn, existing['id'], bene_id, date_str, 'ATTENDANCE_UPDATED',
                    existing['status'], status, None)
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'changed': True, 'status': status})
    else:
        cur = conn.execute('''INSERT INTO attendance_records
            (beneficiary_id, attendance_date, status, created_by, updated_by, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?)''',
            (bene_id, date_str, status, uid, uid, t, t))
        add_att_log(conn, cur.lastrowid, bene_id, date_str, 'ATTENDANCE_CREATED',
                    None, status, None)
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'changed': True, 'status': status})


# ==================== ATTENDANCE — BULK SAVE ====================
@attendance_bp.route('/api/admin/attendance/bulk-save', methods=['POST'])
@login_required
def att_bulk_save():
    d = request.get_json() or {}
    date_str = (d.get('date') or '').strip()
    records = d.get('records') or []  # [{beneficiary_id, status}]

    if not date_str:
        return jsonify({'error': 'Date is required.'}), 400
    today_str = date.today().isoformat()
    if date_str > today_str:
        return jsonify({'error': 'Future date की attendance दर्ज नहीं की जा सकती।'}), 400

    conn = get_db()
    if is_holiday(conn, date_str):
        conn.close()
        return jsonify({'error': 'इस दिन अवकाश है। Attendance दर्ज नहीं की जा सकती।'}), 400

    t = now_iso()
    uid = session.get('user_id')
    saved = 0
    skipped = 0
    changes_log = []

    for rec in records:
        bene_id = rec.get('beneficiary_id')
        status = (rec.get('status') or '').strip().upper()
        if not bene_id or status not in ('PRESENT', 'ABSENT'):
            skipped += 1
            continue
        bene = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ? AND is_active = 1', (bene_id,)).fetchone()
        if not bene or not is_eligible_3_6_on(dict(bene), date_str):
            skipped += 1
            continue
        existing = conn.execute('''SELECT * FROM attendance_records
            WHERE beneficiary_id = ? AND attendance_date = ?''', (bene_id, date_str)).fetchone()
        if existing:
            if existing['status'] != status:
                conn.execute('''UPDATE attendance_records SET status = ?, updated_by = ?, updated_at = ?
                    WHERE id = ?''', (status, uid, t, existing['id']))
                changes_log.append({
                    'beneficiary_id': bene_id,
                    'full_name': bene['full_name'],
                    'unique_id': bene['beneficiary_unique_id'],
                    'old': existing['status'],
                    'new': status,
                    'type': 'updated'
                })
                saved += 1
        else:
            cur = conn.execute('''INSERT INTO attendance_records
                (beneficiary_id, attendance_date, status, created_by, updated_by, created_at, updated_at)
                VALUES (?,?,?,?,?,?,?)''',
                (bene_id, date_str, status, uid, uid, t, t))
            changes_log.append({
                'beneficiary_id': bene_id,
                'full_name': bene['full_name'],
                'unique_id': bene['beneficiary_unique_id'],
                'old': None,
                'new': status,
                'type': 'created'
            })
            saved += 1

    # ONE combined log entry for the entire bulk save
    if changes_log:
        conn.execute('''INSERT INTO attendance_logs
            (attendance_id, beneficiary_id, attendance_date, action, old_value, new_value, reason,
             created_by, created_by_username, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?)''',
            (None, None, date_str, 'ATTENDANCE_BULK', None,
             json.dumps(changes_log, ensure_ascii=False), None,
             uid, session.get('username'), t))

    conn.commit()
    conn.close()
    if saved == 0 and skipped == 0:
        return jsonify({'success': True, 'saved': 0, 'skipped': 0,
                        'message': 'No changes detected.'})
    if saved == 0 and skipped > 0:
        return jsonify({'success': True, 'saved': 0, 'skipped': skipped,
                        'message': str(skipped) + ' records skipped.'})
    return jsonify({'success': True, 'saved': saved, 'skipped': skipped,
                    'message': str(saved) + ' attendance record' + ('' if saved == 1 else 's') + ' saved.'})


# ==================== HOLIDAY — LIST ====================
@attendance_bp.route('/api/admin/holidays', methods=['GET'])
@login_required
def holiday_list():
    year = request.args.get('year')
    month = request.args.get('month')
    status = (request.args.get('status') or 'ACTIVE').upper()
    search = (request.args.get('search') or '').strip().lower()

    conn = get_db()
    where = []
    params = []
    if status == 'ACTIVE':
        where.append('is_active = 1')
    elif status == 'DELETED':
        where.append('is_active = 0')
    if year:
        where.append("substr(holiday_date,1,4) = ?")
        params.append(str(year))
    if month:
        where.append("substr(holiday_date,6,2) = ?")
        params.append(str(month).zfill(2))
    if search:
        where.append("(LOWER(holiday_name) LIKE ? OR LOWER(COALESCE(description,'')) LIKE ?)")
        params.extend(['%' + search + '%', '%' + search + '%'])

    sql = 'SELECT * FROM holidays'
    if where:
        sql += ' WHERE ' + ' AND '.join(where)
    sql += ' ORDER BY holiday_date DESC'
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return jsonify({'success': True, 'holidays': [dict(r) for r in rows]})


# ==================== HOLIDAY — CREATE ====================
@attendance_bp.route('/api/admin/holidays', methods=['POST'])
@login_required
def holiday_create():
    d = request.get_json() or {}
    date_str = (d.get('holiday_date') or '').strip()
    name = (d.get('holiday_name') or '').strip()
    description = (d.get('description') or '').strip() or None

    if not date_str:
        return jsonify({'error': 'Date is required.'}), 400
    if not name:
        return jsonify({'error': 'Holiday name / reason is required.'}), 400

    try:
        datetime.strptime(date_str, '%Y-%m-%d')
    except Exception:
        return jsonify({'error': 'Invalid date format.'}), 400

    conn = get_db()
    # Duplicate active holiday check
    dup = conn.execute('SELECT id FROM holidays WHERE holiday_date = ? AND is_active = 1', (date_str,)).fetchone()
    if dup:
        conn.close()
        return jsonify({'error': 'इस date पर पहले से Holiday है।'}), 400

    t = now_iso()
    uid = session.get('user_id')
    cur = conn.execute('''INSERT INTO holidays
        (holiday_date, holiday_name, description, is_active, created_by, updated_by, created_at, updated_at)
        VALUES (?,?,?,1,?,?,?,?)''',
        (date_str, name, description, uid, uid, t, t))
    hid = cur.lastrowid

    # Invalidate attendance for that date
    att_rows = conn.execute('SELECT * FROM attendance_records WHERE attendance_date = ?', (date_str,)).fetchall()
    invalidated = 0
    for a in att_rows:
        add_att_log(conn, a['id'], a['beneficiary_id'], date_str, 'ATTENDANCE_BLOCKED_HOLIDAY',
                    a['status'], None, 'Holiday added: ' + name)
        invalidated += 1
    if att_rows:
        conn.execute('DELETE FROM attendance_records WHERE attendance_date = ?', (date_str,))

    add_holiday_log(conn, hid, 'HOLIDAY_CREATED', None,
                    {'holiday_date': date_str, 'holiday_name': name, 'description': description},
                    None)
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'holiday_id': hid, 'attendance_invalidated': invalidated,
                    'message': 'Holiday added successfully' + (' (' + str(invalidated) + ' attendance records invalidated)' if invalidated else '')}), 201


# ==================== HOLIDAY — UPDATE ====================
@attendance_bp.route('/api/admin/holidays/<int:hid>', methods=['PATCH'])
@login_required
def holiday_update(hid):
    d = request.get_json() or {}
    conn = get_db()
    old = conn.execute('SELECT * FROM holidays WHERE id = ?', (hid,)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': 'Holiday not found.'}), 404
    if not old['is_active']:
        conn.close()
        return jsonify({'error': 'Deleted holiday cannot be edited.'}), 400

    new_date = (d.get('holiday_date') or old['holiday_date']).strip()
    new_name = (d.get('holiday_name') or old['holiday_name']).strip()
    new_desc = d.get('description') if 'description' in d else old['description']

    if not new_name:
        conn.close()
        return jsonify({'error': 'Holiday name is required.'}), 400

    try:
        datetime.strptime(new_date, '%Y-%m-%d')
    except Exception:
        conn.close()
        return jsonify({'error': 'Invalid date.'}), 400

    # If date changed, check no other active holiday on new date
    if new_date != old['holiday_date']:
        dup = conn.execute('SELECT id FROM holidays WHERE holiday_date = ? AND is_active = 1 AND id != ?',
                           (new_date, hid)).fetchone()
        if dup:
            conn.close()
            return jsonify({'error': 'इस new date पर पहले से Holiday है।'}), 400

    t = now_iso()
    uid = session.get('user_id')
    conn.execute('''UPDATE holidays SET holiday_date=?, holiday_name=?, description=?,
        updated_by=?, updated_at=? WHERE id=?''',
        (new_date, new_name, new_desc, uid, t, hid))

    invalidated_old = 0
    invalidated_new = 0

    # If date changed, old date's attendance becomes available again
    if new_date != old['holiday_date']:
        add_holiday_log(conn, hid, 'HOLIDAY_EDITED',
                        {'holiday_date': old['holiday_date'], 'holiday_name': old['holiday_name']},
                        {'holiday_date': new_date, 'holiday_name': new_name},
                        'Date changed')
        # Invalidate attendance on new date
        att_rows = conn.execute('SELECT * FROM attendance_records WHERE attendance_date = ?', (new_date,)).fetchall()
        for a in att_rows:
            add_att_log(conn, a['id'], a['beneficiary_id'], new_date, 'ATTENDANCE_BLOCKED_HOLIDAY',
                        a['status'], None, 'Holiday moved to this date: ' + new_name)
            invalidated_new += 1
        if att_rows:
            conn.execute('DELETE FROM attendance_records WHERE attendance_date = ?', (new_date,))
    else:
        add_holiday_log(conn, hid, 'HOLIDAY_EDITED',
                        {'holiday_name': old['holiday_name'], 'description': old['description']},
                        {'holiday_name': new_name, 'description': new_desc},
                        None)

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Holiday updated',
                    'attendance_invalidated': invalidated_new})


# ==================== HOLIDAY — DELETE (soft) ====================
@attendance_bp.route('/api/admin/holidays/<int:hid>/delete', methods=['POST'])
@login_required
def holiday_delete(hid):
    d = request.get_json() or {}
    reason = (d.get('reason') or '').strip() or 'Holiday deleted'

    conn = get_db()
    old = conn.execute('SELECT * FROM holidays WHERE id = ?', (hid,)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': 'Holiday not found.'}), 404
    if not old['is_active']:
        conn.close()
        return jsonify({'error': 'Already deleted.'}), 400

    t = now_iso()
    uid = session.get('user_id')
    conn.execute('UPDATE holidays SET is_active = 0, updated_by = ?, updated_at = ? WHERE id = ?', (uid, t, hid))
    add_holiday_log(conn, hid, 'HOLIDAY_DELETED',
                    {'holiday_date': old['holiday_date'], 'holiday_name': old['holiday_name']},
                    None, reason)
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Holiday deleted. Date अब attendance के लिए open है।'})


# ==================== HOLIDAY LOGS ====================
@attendance_bp.route('/api/admin/holidays/<int:hid>/logs', methods=['GET'])
@login_required
def holiday_logs(hid):
    conn = get_db()
    rows = conn.execute('SELECT * FROM holiday_logs WHERE holiday_id = ? ORDER BY datetime(created_at) DESC, id DESC', (hid,)).fetchall()
    conn.close()
    return jsonify({'success': True, 'logs': [dict(r) for r in rows]})


@attendance_bp.route('/api/admin/holidays/logs/all', methods=['GET'])
@login_required
def holiday_logs_all():
    conn = get_db()
    rows = conn.execute('SELECT * FROM holiday_logs ORDER BY datetime(created_at) DESC, id DESC LIMIT 300').fetchall()
    conn.close()
    return jsonify({'success': True, 'logs': [dict(r) for r in rows]})


# ==================== ATTENDANCE LOGS ====================
@attendance_bp.route('/api/admin/attendance/logs', methods=['GET'])
@login_required
def att_logs():
    date_str = request.args.get('date')
    conn = get_db()
    sql = '''SELECT al.*,
             COALESCE(bp.full_name, 'Unknown') AS beneficiary_name,
             bp.beneficiary_unique_id,
             bp.profile_photo_data
             FROM attendance_logs al
             LEFT JOIN beneficiary_profiles bp ON bp.id = al.beneficiary_id'''
    if date_str:
        sql += ' WHERE al.attendance_date = ? ORDER BY datetime(al.created_at) DESC, al.id DESC LIMIT 200'
        rows = conn.execute(sql, (date_str,)).fetchall()
    else:
        sql += ' ORDER BY datetime(al.created_at) DESC, al.id DESC LIMIT 300'
        rows = conn.execute(sql).fetchall()
    conn.close()
    return jsonify({'success': True, 'logs': [dict(r) for r in rows]})


# ==================== CALENDAR — MONTH VIEW ====================
@attendance_bp.route('/api/admin/attendance/calendar', methods=['GET'])
@login_required
def att_calendar():
    year = request.args.get('year')
    month = request.args.get('month')
    try:
        year = int(year); month = int(month)
        if month < 1 or month > 12:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'Year and month are required.'}), 400

    # Determine month range
    start = date(year, month, 1)
    if month == 12:
        end = date(year + 1, 1, 1)
    else:
        end = date(year, month + 1, 1)
    days_in_month = (end - start).days

    conn = get_db()

    # Fetch all active holidays in this month
    holidays = {}
    hrows = conn.execute('''SELECT * FROM holidays
        WHERE is_active = 1 AND holiday_date >= ? AND holiday_date < ?''',
        (start.isoformat(), end.isoformat())).fetchall()
    for h in hrows:
        holidays[h['holiday_date']] = dict(h)

    # Fetch attendance counts per date
    att_rows = conn.execute('''SELECT attendance_date,
        SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) AS absent
        FROM attendance_records
        WHERE attendance_date >= ? AND attendance_date < ?
        GROUP BY attendance_date''',
        (start.isoformat(), end.isoformat())).fetchall()
    att_map = {}
    for a in att_rows:
        att_map[a['attendance_date']] = {'present': a['present'] or 0, 'absent': a['absent'] or 0}

    # Build day list
    today_str = date.today().isoformat()
    days = []
    for i in range(days_in_month):
        d = start + timedelta(days=i)
        ds = d.isoformat()
        is_sun = d.weekday() == 6
        hol = holidays.get(ds)
        att = att_map.get(ds, {'present': 0, 'absent': 0})
        total_marked = att['present'] + att['absent']
        days.append({
            'date': ds,
            'day': d.day,
            'weekday': d.weekday(),
            'is_sunday': is_sun,
            'is_today': ds == today_str,
            'holiday': hol,
            'present': att['present'],
            'absent': att['absent'],
            'total_marked': total_marked
        })

    # Monthly summary
    total_days = days_in_month
    sundays = sum(1 for d in days if d['is_sunday'])
    manual_holidays = len(holidays)
    # Working days = total - sundays - manual holidays NOT on sunday
    extra_holidays = sum(1 for d in days if d['holiday'] and not d['is_sunday'])
    working_days = total_days - sundays - extra_holidays
    total_present = sum(d['present'] for d in days)
    total_absent = sum(d['absent'] for d in days)

    # Not marked = for working days, count eligible children not marked
    # This is approximate — we compute eligible children for each working day
    not_marked = 0
    # For accuracy, we would need to loop each day. Let's do a quick count:
    for d in days:
        if d['is_sunday'] or d['holiday']:
            continue
        # Find eligible children on this date
        rows = conn.execute('''SELECT id, date_of_birth, effective_date FROM beneficiary_profiles
            WHERE category = 'CHILD_36_72' AND is_active = 1''').fetchall()
        eligible_count = 0
        for r in rows:
            if r['effective_date'] and r['effective_date'] > d['date']:
                continue
            age = age_years_on(r['date_of_birth'], d['date']) if r['date_of_birth'] else None
            if age is not None and 3 <= age < 6:
                eligible_count += 1
        not_marked += max(0, eligible_count - d['total_marked'])

    # Also fetch today's total eligible for reference
    conn.close()

    summary = {
        'total_days': total_days,
        'sundays': sundays,
        'manual_holidays': manual_holidays,
        'extra_holidays_not_sunday': extra_holidays,
        'total_holidays': sundays + extra_holidays,
        'working_days': working_days,
        'present': total_present,
        'absent': total_absent,
        'not_marked': not_marked
    }

    return jsonify({
        'success': True,
        'year': year,
        'month': month,
        'month_name': ['', 'January','February','March','April','May','June',
                       'July','August','September','October','November','December'][month],
        'days': days,
        'summary': summary
    })


# ==================== CHECK HOLIDAY FOR DATE ====================
@attendance_bp.route('/api/admin/attendance/holiday-check', methods=['GET'])
@login_required
def att_holiday_check():
    date_str = (request.args.get('date') or '').strip()
    if not date_str:
        return jsonify({'error': 'Date is required.'}), 400
    conn = get_db()
    hol = is_holiday(conn, date_str)
    conn.close()
    return jsonify({
        'success': True,
        'date': date_str,
        'is_holiday': hol is not None,
        'holiday': dict(hol) if hol else None,
        'is_sunday': is_sunday(date_str)
    })
