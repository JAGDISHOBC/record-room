"""Record Room - THR Distribution Module (who received THR)"""
import os, json
from datetime import datetime, date
from functools import wraps
from flask import Blueprint, request, jsonify, session

thr_dist_bp = Blueprint('thr_dist', __name__)

THR_ELIGIBLE_CATEGORIES = ['PREGNANT', 'LACTATING', 'CHILD_6_36', 'CHILD_36_72']
THR_EXCLUDED_CATEGORIES = ['CHILD_0_6']

THR_CATEGORY_LABELS = {
    'PREGNANT': 'Pregnant Women',
    'LACTATING': 'Lactating Mothers',
    'CHILD_6_36': 'Children 6 Months-3 Years',
    'CHILD_36_72': 'Children 3-6 Years'
}

THR_DEFAULT_PACKETS = {
    'PREGNANT': 3,
    'LACTATING': 3,
    'CHILD_6_36': 4,
    'CHILD_36_72': 4
}

# Recipe reference (mirrors Stock — READ ONLY here)
THR_RECIPE_REFERENCE = {
    'PREGNANT': [
        {'name': 'फोर्टिफाइड न्यूट्री मीठा दलिया', 'weight': 1400},
        {'name': 'फोर्टिफाइड मूंग दाल चावल खिचड़ी', 'weight': 1400},
        {'name': 'फोर्टिफाइड सादा गेहूँ दलिया', 'weight': 700}
    ],
    'LACTATING': [
        {'name': 'फोर्टिफाइड न्यूट्री मीठा दलिया', 'weight': 1400},
        {'name': 'फोर्टिफाइड मूंग दाल चावल खिचड़ी', 'weight': 1400},
        {'name': 'फोर्टिफाइड सादा गेहूँ दलिया', 'weight': 700}
    ],
    'CHILD_6_36': [
        {'name': 'फोर्टिफाइड न्यूट्री मीठा दलिया', 'weight': 480},
        {'name': 'फोर्टिफाइड मूंग दाल चावल खिचड़ी', 'weight': 480},
        {'name': 'फोर्टिफाइड सादा गेहूँ दलिया', 'weight': 540},
        {'name': 'फोर्टिफाइड बालाहार प्रीमिक्स', 'weight': 1375}
    ],
    'CHILD_36_72': [
        {'name': 'मीठा मुरमुरा', 'weight': 780},
        {'name': 'नमकीन मुरमुरा', 'weight': 720},
        {'name': 'फोर्टिफाइड मूंग दाल चावल खिचड़ी', 'weight': 540},
        {'name': 'फोर्टिफाइड न्यूट्री मीठा दलिया', 'weight': 480},
        {'name': 'पोषक उपमा प्रीमिक्स (मीठा-नमकीन)', 'weight': 480}
    ]
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


def init_thr_dist_tables():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS thr_distributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        beneficiary_id INTEGER NOT NULL,
        ration_year INTEGER NOT NULL,
        ration_month INTEGER NOT NULL,
        category_snapshot TEXT,
        packet_quantity INTEGER NOT NULL,
        receiver_name TEXT,
        receiver_relation TEXT,
        given_date TEXT,
        age_snapshot TEXT,
        photo_data TEXT,
        notes TEXT,
        status TEXT DEFAULT 'ACTIVE',
        deleted_at TEXT,
        deleted_by INTEGER,
        delete_reason TEXT,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_thr_dist_bene ON thr_distributions(beneficiary_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_thr_dist_month ON thr_distributions(ration_year, ration_month)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_thr_dist_status ON thr_distributions(status)')

    c.execute('''CREATE TABLE IF NOT EXISTS thr_distribution_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thr_id INTEGER,
        beneficiary_id INTEGER,
        log_type TEXT NOT NULL,
        old_values TEXT,
        new_values TEXT,
        reason TEXT,
        given_date TEXT,
        effective_at TEXT,
        created_by INTEGER,
        created_by_username TEXT,
        created_at TEXT NOT NULL)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_thr_logs ON thr_distribution_logs(thr_id)')
    conn.commit()
    conn.close()


def add_thr_log(conn, thr_id, bene_id, log_type, old_vals=None, new_vals=None, reason=None, given_date=None):
    conn.execute('''INSERT INTO thr_distribution_logs
        (thr_id, beneficiary_id, log_type, old_values, new_values, reason, given_date,
         effective_at, created_by, created_by_username, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)''',
        (thr_id, bene_id, log_type,
         json.dumps(old_vals, ensure_ascii=False) if old_vals else None,
         json.dumps(new_vals, ensure_ascii=False) if new_vals else None,
         reason, given_date, given_date,
         session.get('user_id'), session.get('username'), now_iso()))


def months_between(dob_str, on_date_str):
    """Return completed months between DOB and on_date. Return None if invalid."""
    try:
        dob = datetime.strptime(dob_str, '%Y-%m-%d').date()
        on_date = datetime.strptime(on_date_str, '%Y-%m-%d').date()
        if on_date < dob:
            return None
        months = (on_date.year - dob.year) * 12 + (on_date.month - dob.month)
        if on_date.day < dob.day:
            months -= 1
        return max(0, months)
    except Exception:
        return None


def compute_age_snapshot(dob_str, given_date_str):
    """Return 'Xy Ym' style string. Given date defaults to today."""
    if not dob_str:
        return None
    try:
        dob = datetime.strptime(dob_str, '%Y-%m-%d').date()
        on_date = datetime.strptime(given_date_str, '%Y-%m-%d').date() if given_date_str else date.today()
        if on_date < dob:
            return None
        years = on_date.year - dob.year
        months = on_date.month - dob.month
        if on_date.day < dob.day:
            months -= 1
        if months < 0:
            years -= 1
            months += 12
        return str(years) + 'Y ' + str(months) + 'M'
    except Exception:
        return None


def compute_category_on_month(bene, year, month):
    """
    Compute the applicable THR category for a given month.
    Returns one of THR_ELIGIBLE_CATEGORIES or None if not eligible.
    """
    cur_cat = bene['category']

    # Pregnant / Lactating: use current category
    if cur_cat == 'PREGNANT' or cur_cat == 'LACTATING':
        return cur_cat

    # Children: compute based on DOB on the 1st of the selected month
    if cur_cat in ('CHILD_0_6', 'CHILD_6_36', 'CHILD_36_72'):
        if not bene['date_of_birth']:
            return None
        try:
            on_date = date(int(year), int(month), 1)
        except Exception:
            return None
        m = months_between(bene['date_of_birth'], on_date.isoformat())
        if m is None:
            return None
        if m < 6:
            return None  # 0-6 months excluded from THR
        if 6 <= m < 36:
            return 'CHILD_6_36'
        if 36 <= m < 72:
            return 'CHILD_36_72'
        return None  # aged out

    return None


def is_billing_eligible(bene, year, month):
    """
    Billing-date eligibility filter (display only — does NOT block THR).
    Uses effective_date <= last day of selected month as a simple rule.
    """
    if not bene['effective_date']:
        return True
    try:
        last_day = date(int(year), int(month), 28)  # Simple conservative check
        # Actually let's use day 1 for simplicity: effective_date <= first day
        first_day = date(int(year), int(month), 1)
        eff = datetime.strptime(bene['effective_date'], '%Y-%m-%d').date()
        return eff <= first_day
    except Exception:
        return True


# ==================== GET ELIGIBLE BENEFICIARIES FOR MONTH ====================
@thr_dist_bp.route('/api/admin/thr/beneficiaries', methods=['GET'])
@login_required
def thr_eligible_list():
    year = request.args.get('year')
    month = request.args.get('month')
    try:
        year = int(year); month = int(month)
        if month < 1 or month > 12:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid year and month required.'}), 400

    conn = get_db()

    # All active beneficiaries
    rows = conn.execute('''SELECT id, beneficiary_unique_id, category, full_name,
        date_of_birth, gender, house_number, father_name, mother_name, husband_name,
        mobile, profile_photo_data, effective_date
        FROM beneficiary_profiles
        WHERE is_active = 1
        ORDER BY full_name COLLATE NOCASE ASC''').fetchall()

    eligible = []
    for r in rows:
        bene = dict(r)
        # Skip 0-6 months beneficiaries entirely (spec)
        if bene['category'] == 'CHILD_0_6':
            continue

        # Compute applicable category for the month
        cat = compute_category_on_month(bene, year, month)
        if not cat or cat not in THR_ELIGIBLE_CATEGORIES:
            continue

        # Check existing distribution for this bene + month
        dist = conn.execute('''SELECT * FROM thr_distributions
            WHERE beneficiary_id = ? AND ration_year = ? AND ration_month = ?
            AND status = 'ACTIVE' LIMIT 1''',
            (bene['id'], year, month)).fetchone()

        # Family identification (father first for children, husband first for pregnant/lactating)
        family_id = None
        if cat in ('PREGNANT', 'LACTATING'):
            family_id = bene['husband_name'] or bene['father_name'] or ''
        else:
            family_id = bene['father_name'] or bene['mother_name'] or ''

        # Mobile last 4
        mobile_last4 = ''
        if bene['mobile'] and len(bene['mobile']) >= 4:
            mobile_last4 = bene['mobile'][-4:]

        # Billing eligibility (filter only)
        billing_eligible = is_billing_eligible(bene, year, month)

        entry = {
            'beneficiary_id': bene['id'],
            'unique_id': bene['beneficiary_unique_id'],
            'name': bene['full_name'],
            'category': cat,
            'original_category': bene['category'],
            'date_of_birth': bene['date_of_birth'],
            'gender': bene['gender'],
            'family_identification': family_id,
            'mobile_last4': mobile_last4,
            'house_number': bene['house_number'],
            'profile_photo_data': bene['profile_photo_data'],
            'billing_eligible': billing_eligible,
            'default_packets': THR_DEFAULT_PACKETS.get(cat, 3),
            'given': dist is not None,
            'distribution': dict(dist) if dist else None
        }
        eligible.append(entry)

    # Summary counts per category
    summary = {cat: {'eligible': 0, 'pending': 0, 'given': 0} for cat in THR_ELIGIBLE_CATEGORIES}
    for e in eligible:
        summary[e['category']]['eligible'] += 1
        if e['given']:
            summary[e['category']]['given'] += 1
        else:
            summary[e['category']]['pending'] += 1

    conn.close()
    return jsonify({
        'success': True,
        'year': year,
        'month': month,
        'beneficiaries': eligible,
        'summary': summary,
        'category_labels': THR_CATEGORY_LABELS,
        'default_packets': THR_DEFAULT_PACKETS
    })


# ==================== GET STOCK REFERENCE (READ ONLY) ====================
@thr_dist_bp.route('/api/admin/thr/stock', methods=['GET'])
@login_required
def thr_stock_reference():
    year = request.args.get('year')
    month = request.args.get('month')
    try:
        year = int(year); month = int(month)
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid year and month required.'}), 400

    conn = get_db()
    stock_rows = conn.execute('''SELECT thr_category, SUM(quantity) as total_packets,
        SUM(total_kg) as total_kg
        FROM stock_entries
        WHERE stock_type = 'THR' AND status = 'ACTIVE'
        AND ration_year = ? AND ration_month = ?
        GROUP BY thr_category''', (year, month)).fetchall()

    by_cat = {}
    for r in stock_rows:
        by_cat[r['thr_category']] = {
            'received_packets': r['total_packets'] or 0,
            'received_kg': r['total_kg'] or 0
        }

    # Build response
    stock_ref = {}
    for cat in THR_ELIGIBLE_CATEGORIES:
        stock_ref[cat] = {
            'category': cat,
            'label': THR_CATEGORY_LABELS[cat],
            'received_packets': by_cat.get(cat, {}).get('received_packets', 0),
            'received_kg': by_cat.get(cat, {}).get('received_kg', 0),
            'recipes': THR_RECIPE_REFERENCE.get(cat, [])
        }

    conn.close()
    return jsonify({
        'success': True,
        'year': year,
        'month': month,
        'stock_reference': stock_ref,
        'stock_available': len(by_cat) > 0
    })


# ==================== CREATE DISTRIBUTION ====================
@thr_dist_bp.route('/api/admin/thr', methods=['POST'])
@login_required
def thr_create():
    d = request.get_json() or {}

    bene_id = d.get('beneficiary_id')
    year = d.get('ration_year')
    month = d.get('ration_month')
    try:
        year = int(year); month = int(month)
        if month < 1 or month > 12:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'Valid year and month required.'}), 400

    if not bene_id:
        return jsonify({'error': 'Please select a valid beneficiary.'}), 400

    # Packet quantity validation
    try:
        pk = int(d.get('packet_quantity') or 0)
    except (TypeError, ValueError):
        return jsonify({'error': 'Packet quantity must be a whole number.'}), 400
    if pk < 1:
        return jsonify({'error': 'Packet quantity must be at least 1.'}), 400

    given_date = (d.get('given_date') or '').strip() or None
    if given_date:
        try:
            datetime.strptime(given_date, '%Y-%m-%d')
        except Exception:
            return jsonify({'error': 'Please enter a valid Given Date.'}), 400

    receiver_name = (d.get('receiver_name') or '').strip() or None
    receiver_relation = (d.get('receiver_relation') or '').strip() or None
    notes = (d.get('notes') or '').strip() or None
    photo_data = d.get('photo_data') or None

    conn = get_db()
    bene = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ? AND is_active = 1', (bene_id,)).fetchone()
    if not bene:
        conn.close()
        return jsonify({'error': 'Please select a valid beneficiary.'}), 404

    bene_d = dict(bene)
    if bene_d['category'] == 'CHILD_0_6':
        conn.close()
        return jsonify({'error': 'Children 0-6 Months are not eligible for THR.'}), 400

    cat = compute_category_on_month(bene_d, year, month)
    if not cat or cat not in THR_ELIGIBLE_CATEGORIES:
        conn.close()
        return jsonify({'error': 'This beneficiary is not eligible for THR for the selected month.'}), 400

    # Duplicate check: one active event per bene+month
    existing = conn.execute('''SELECT id FROM thr_distributions
        WHERE beneficiary_id = ? AND ration_year = ? AND ration_month = ?
        AND status = 'ACTIVE' LIMIT 1''', (bene_id, year, month)).fetchone()
    if existing:
        conn.close()
        return jsonify({'error': 'This beneficiary has already received THR for this month.'}), 400

    # Age snapshot
    age_snapshot = compute_age_snapshot(bene_d['date_of_birth'], given_date or date.today().isoformat())

    t = now_iso()
    uid = session.get('user_id')

    cur = conn.execute('''INSERT INTO thr_distributions
        (beneficiary_id, ration_year, ration_month, category_snapshot, packet_quantity,
         receiver_name, receiver_relation, given_date, age_snapshot, photo_data, notes,
         status, created_by, updated_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?, 'ACTIVE', ?,?,?,?)''',
        (bene_id, year, month, cat, pk,
         receiver_name, receiver_relation, given_date, age_snapshot, photo_data, notes,
         uid, uid, t, t))
    tid = cur.lastrowid

    new_vals = {
        'beneficiary_id': bene_id,
        'beneficiary_name': bene_d['full_name'],
        'ration_year': year,
        'ration_month': month,
        'category_snapshot': cat,
        'packet_quantity': pk,
        'receiver_name': receiver_name,
        'receiver_relation': receiver_relation,
        'given_date': given_date,
        'age_snapshot': age_snapshot,
        'photo': 'yes' if photo_data else None
    }
    add_thr_log(conn, tid, bene_id, 'CREATE', None, new_vals, None, given_date)
    conn.commit()
    row = conn.execute('SELECT * FROM thr_distributions WHERE id = ?', (tid,)).fetchone()
    conn.close()
    return jsonify({'success': True, 'distribution': dict(row),
                    'message': 'THR saved successfully'}), 201


# ==================== UPDATE DISTRIBUTION ====================
@thr_dist_bp.route('/api/admin/thr/<int:tid>', methods=['PATCH'])
@login_required
def thr_update(tid):
    d = request.get_json() or {}
    conn = get_db()
    old = conn.execute('SELECT * FROM thr_distributions WHERE id = ?', (tid,)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': 'THR record not found.'}), 404
    if old['status'] != 'ACTIVE':
        conn.close()
        return jsonify({'error': 'Deleted THR cannot be edited.'}), 400

    old_d = dict(old)

    # Beneficiary change?
    new_bene_id = d.get('beneficiary_id', old_d['beneficiary_id'])
    try:
        new_bene_id = int(new_bene_id)
    except (TypeError, ValueError):
        conn.close()
        return jsonify({'error': 'Please select a valid beneficiary.'}), 400

    bene_changed = (new_bene_id != old_d['beneficiary_id'])
    if bene_changed:
        # Verify new beneficiary eligibility
        nb = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ? AND is_active = 1', (new_bene_id,)).fetchone()
        if not nb:
            conn.close()
            return jsonify({'error': 'Please select a valid beneficiary.'}), 404
        nb_d = dict(nb)
        if nb_d['category'] == 'CHILD_0_6':
            conn.close()
            return jsonify({'error': 'Children 0-6 Months are not eligible for THR.'}), 400
        new_cat = compute_category_on_month(nb_d, old_d['ration_year'], old_d['ration_month'])
        if not new_cat or new_cat not in THR_ELIGIBLE_CATEGORIES:
            conn.close()
            return jsonify({'error': 'This beneficiary is not eligible for THR for the selected month.'}), 400
        # Check new beneficiary doesn't already have active distribution for this month
        dup = conn.execute('''SELECT id FROM thr_distributions
            WHERE beneficiary_id = ? AND ration_year = ? AND ration_month = ?
            AND status = 'ACTIVE' AND id != ? LIMIT 1''',
            (new_bene_id, old_d['ration_year'], old_d['ration_month'], tid)).fetchone()
        if dup:
            conn.close()
            return jsonify({'error': 'This beneficiary has already received THR for this month.'}), 400
    else:
        nb_d = None
        new_cat = old_d['category_snapshot']

    # Packet quantity
    try:
        pk = int(d.get('packet_quantity', old_d['packet_quantity']))
    except (TypeError, ValueError):
        conn.close()
        return jsonify({'error': 'Packet quantity must be a whole number.'}), 400
    if pk < 1:
        conn.close()
        return jsonify({'error': 'Packet quantity must be at least 1.'}), 400

    given_date = d.get('given_date', old_d['given_date'])
    if given_date:
        given_date = given_date.strip() or None
        if given_date:
            try:
                datetime.strptime(given_date, '%Y-%m-%d')
            except Exception:
                conn.close()
                return jsonify({'error': 'Please enter a valid Given Date.'}), 400

    receiver_name = d.get('receiver_name', old_d['receiver_name'])
    receiver_relation = d.get('receiver_relation', old_d['receiver_relation'])
    notes = d.get('notes', old_d['notes'])

    # Photo handling
    photo_new = d.get('photo_data') if 'photo_data' in d else old_d['photo_data']

    # Age snapshot recompute
    if bene_changed:
        age_snapshot = compute_age_snapshot(nb_d['date_of_birth'], given_date or date.today().isoformat())
    else:
        age_snapshot = compute_age_snapshot(None, None) if False else old_d['age_snapshot']
        # Recompute if given_date or dob changed
        if given_date != old_d['given_date']:
            # Need DOB
            cur_bene = conn.execute('SELECT date_of_birth FROM beneficiary_profiles WHERE id = ?', (old_d['beneficiary_id'],)).fetchone()
            if cur_bene and cur_bene['date_of_birth']:
                age_snapshot = compute_age_snapshot(cur_bene['date_of_birth'], given_date or date.today().isoformat())

    # Build changes log
    changes = {}
    if new_bene_id != old_d['beneficiary_id']:
        changes['beneficiary_id'] = {'old': old_d['beneficiary_id'], 'new': new_bene_id}
    if new_cat != old_d['category_snapshot']:
        changes['category_snapshot'] = {'old': old_d['category_snapshot'], 'new': new_cat}
    if pk != old_d['packet_quantity']:
        changes['packet_quantity'] = {'old': old_d['packet_quantity'], 'new': pk}
    if receiver_name != old_d['receiver_name']:
        changes['receiver_name'] = {'old': old_d['receiver_name'], 'new': receiver_name}
    if receiver_relation != old_d['receiver_relation']:
        changes['receiver_relation'] = {'old': old_d['receiver_relation'], 'new': receiver_relation}
    if given_date != old_d['given_date']:
        changes['given_date'] = {'old': old_d['given_date'], 'new': given_date}
    if notes != old_d['notes']:
        changes['notes'] = {'old': old_d['notes'], 'new': notes}

    # Photo change
    old_photo = old_d.get('photo_data') or ''
    new_photo = photo_new or ''
    if old_photo != new_photo:
        if not old_photo and new_photo:
            changes['photo'] = {'old': None, 'new': '(photo added)'}
        elif old_photo and not new_photo:
            changes['photo'] = {'old': '(photo)', 'new': None}
        else:
            changes['photo'] = {'old': '(photo)', 'new': '(photo changed)'}

    if not changes:
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'changed': False, 'message': 'No changes.'})

    t = now_iso()
    uid = session.get('user_id')

    conn.execute('''UPDATE thr_distributions SET
        beneficiary_id=?, category_snapshot=?, packet_quantity=?,
        receiver_name=?, receiver_relation=?, given_date=?, age_snapshot=?,
        photo_data=?, notes=?, updated_by=?, updated_at=?
        WHERE id=?''',
        (new_bene_id, new_cat, pk, receiver_name, receiver_relation,
         given_date, age_snapshot, photo_new, notes, uid, t, tid))

    add_thr_log(conn, tid, new_bene_id, 'UPDATE', changes,
                {'packet_quantity': pk, 'given_date': given_date}, None, given_date)
    conn.commit()
    row = conn.execute('SELECT * FROM thr_distributions WHERE id = ?', (tid,)).fetchone()
    conn.close()
    return jsonify({'success': True, 'changed': True, 'distribution': dict(row),
                    'message': 'THR updated successfully'})


# ==================== DELETE DISTRIBUTION (soft) ====================
@thr_dist_bp.route('/api/admin/thr/<int:tid>/delete', methods=['POST'])
@login_required
def thr_delete(tid):
    d = request.get_json() or {}
    reason = (d.get('reason') or '').strip() or 'THR deleted'

    conn = get_db()
    old = conn.execute('SELECT * FROM thr_distributions WHERE id = ?', (tid,)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': 'THR record not found.'}), 404
    if old['status'] != 'ACTIVE':
        conn.close()
        return jsonify({'error': 'THR already deleted.'}), 400

    t = now_iso()
    uid = session.get('user_id')

    # Push to Recycle Bin (MEDIUM — individual THR event)
    try:
        from settings import push_recycle
        bene = conn.execute('SELECT full_name FROM beneficiary_profiles WHERE id = ?', (old['beneficiary_id'],)).fetchone()
        bene_name = bene['full_name'] if bene else 'Unknown'
        push_recycle(conn, 'MEDIUM', 'THR', 'THR_DISTRIBUTION',
                     record_id=tid,
                     record_name=bene_name + ' · ' + str(old['packet_quantity']) + ' packets',
                     record_data=dict(old),
                     effective_date=old['given_date'],
                     reason=reason)
    except Exception:
        pass

    conn.execute('''UPDATE thr_distributions SET
        status='DELETED', deleted_at=?, deleted_by=?, delete_reason=?, updated_by=?, updated_at=?
        WHERE id=?''', (t, uid, reason, uid, t, tid))

    add_thr_log(conn, tid, old['beneficiary_id'], 'DELETE',
                dict(old), {'status': 'DELETED'}, reason, old['given_date'])
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'THR deleted successfully'})


# ==================== LOGS ====================
@thr_dist_bp.route('/api/admin/thr/logs', methods=['GET'])
@login_required
def thr_logs_all():
    year = request.args.get('year')
    month = request.args.get('month')
    conn = get_db()
    sql = '''SELECT tl.*, bp.full_name as beneficiary_name,
             bp.beneficiary_unique_id
             FROM thr_distribution_logs tl
             LEFT JOIN beneficiary_profiles bp ON bp.id = tl.beneficiary_id'''
    params = []
    where = []
    if year:
        where.append("tl.thr_id IN (SELECT id FROM thr_distributions WHERE ration_year = ?)")
        params.append(int(year))
    if month:
        where.append("tl.thr_id IN (SELECT id FROM thr_distributions WHERE ration_month = ?)")
        params.append(int(month))
    if where:
        sql += ' WHERE ' + ' AND '.join(where)
    sql += ' ORDER BY datetime(tl.created_at) DESC, tl.id DESC LIMIT 300'
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return jsonify({'success': True, 'logs': [dict(r) for r in rows]})


@thr_dist_bp.route('/api/admin/thr/<int:tid>/logs', methods=['GET'])
@login_required
def thr_logs_single(tid):
    conn = get_db()
    rows = conn.execute('''SELECT tl.*, bp.full_name as beneficiary_name,
        bp.beneficiary_unique_id
        FROM thr_distribution_logs tl
        LEFT JOIN beneficiary_profiles bp ON bp.id = tl.beneficiary_id
        WHERE tl.thr_id = ?
        ORDER BY datetime(tl.created_at) DESC, tl.id DESC''', (tid,)).fetchall()
    conn.close()
    return jsonify({'success': True, 'logs': [dict(r) for r in rows]})


# ==================== GET SINGLE DISTRIBUTION ====================
@thr_dist_bp.route('/api/admin/thr/<int:tid>', methods=['GET'])
@login_required
def thr_get(tid):
    conn = get_db()
    row = conn.execute('SELECT * FROM thr_distributions WHERE id = ?', (tid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'THR record not found.'}), 404
    bene = conn.execute('SELECT * FROM beneficiary_profiles WHERE id = ?', (row['beneficiary_id'],)).fetchone()
    conn.close()
    return jsonify({
        'success': True,
        'distribution': dict(row),
        'beneficiary': dict(bene) if bene else None
    })
