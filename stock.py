"""Record Room - Stock Register Module"""
import os, json
from datetime import datetime
from functools import wraps
from flask import Blueprint, request, jsonify, session

stock_bp = Blueprint('stock', __name__)

VALID_STOCK_TYPES = ['THR', 'MILK_POWDER', 'SUGAR', 'SANITARY_NAPKINS', 'OTHERS']
STOCK_TYPE_LABELS = {
    'THR': 'THR Stock',
    'MILK_POWDER': 'Milk Powder Stock',
    'SUGAR': 'Sugar Stock',
    'SANITARY_NAPKINS': 'Sanitary Napkins Stock',
    'OTHERS': 'Other Items Stock'
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


def init_stock_tables():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS stock_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_type TEXT NOT NULL,
        item_name TEXT,
        year INTEGER,
        ration_year INTEGER,
        ration_month INTEGER,
        quantity REAL NOT NULL,
        unit TEXT,
        packets REAL,
        grams_per_packet REAL,
        total_grams REAL,
        total_kg REAL,
        pieces_per_packet REAL,
        total_pieces REAL,
        bill_challan_no TEXT,
        billing_date TEXT,
        actual_received_date TEXT NOT NULL,
        supplier_name TEXT,
        remarks TEXT,
        details TEXT,
        photo_reference TEXT,
        status TEXT DEFAULT 'ACTIVE',
        deleted_at TEXT,
        deleted_by INTEGER,
        delete_reason TEXT,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_stock_type ON stock_entries(stock_type)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_stock_status ON stock_entries(status)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_stock_ration ON stock_entries(ration_year, ration_month)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_stock_date ON stock_entries(actual_received_date)')

    c.execute('''CREATE TABLE IF NOT EXISTS stock_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_entry_id INTEGER,
        stock_type TEXT,
        action TEXT NOT NULL,
        old_values_json TEXT,
        new_values_json TEXT,
        reason TEXT,
        effective_date TEXT,
        performed_by INTEGER,
        performed_by_username TEXT,
        performed_at TEXT NOT NULL)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_stock_logs_entry ON stock_logs(stock_entry_id)')
    conn.commit()
    conn.close()


def add_stock_log(conn, entry_id, stock_type, action, old_vals=None, new_vals=None, reason=None, effective_date=None):
    conn.execute('''INSERT INTO stock_logs
        (stock_entry_id, stock_type, action, old_values_json, new_values_json, reason,
         effective_date, performed_by, performed_by_username, performed_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)''',
        (entry_id, stock_type, action,
         json.dumps(old_vals) if old_vals else None,
         json.dumps(new_vals) if new_vals else None,
         reason, effective_date,
         session.get('user_id'), session.get('username'), now_iso()))


# ==================== LIST ====================
@stock_bp.route('/api/admin/stock', methods=['GET'])
@login_required
def list_stock():
    stock_type = (request.args.get('type') or '').strip().upper()
    status = (request.args.get('status') or 'ACTIVE').upper()
    year = request.args.get('year')
    month = request.args.get('month')
    search = (request.args.get('search') or '').strip().lower()

    conn = get_db()
    where = []
    params = []

    if stock_type and stock_type in VALID_STOCK_TYPES:
        where.append('stock_type = ?')
        params.append(stock_type)
    if status == 'ACTIVE':
        where.append("status = 'ACTIVE'")
    elif status == 'DELETED':
        where.append("status = 'DELETED'")
    # ALL -> no filter

    if year:
        try:
            where.append('year = ?')
            params.append(int(year))
        except ValueError:
            pass
    if month:
        try:
            where.append('ration_month = ?')
            params.append(int(month))
        except ValueError:
            pass
    if search:
        s = '%' + search + '%'
        where.append('''(LOWER(COALESCE(item_name,'')) LIKE ? OR
                         LOWER(COALESCE(supplier_name,'')) LIKE ? OR
                         LOWER(COALESCE(bill_challan_no,'')) LIKE ? OR
                         LOWER(COALESCE(remarks,'')) LIKE ?)''')
        params.extend([s, s, s, s])

    sql = 'SELECT * FROM stock_entries'
    if where:
        sql += ' WHERE ' + ' AND '.join(where)
    sql += ' ORDER BY datetime(created_at) DESC, id DESC'

    rows = conn.execute(sql, params).fetchall()

    # counts
    counts = {}
    for st in VALID_STOCK_TYPES:
        cnt = conn.execute("SELECT COUNT(*) AS c FROM stock_entries WHERE stock_type = ? AND status = 'ACTIVE'", (st,)).fetchone()['c']
        counts[st] = cnt
    total_active = conn.execute("SELECT COUNT(*) AS c FROM stock_entries WHERE status = 'ACTIVE'").fetchone()['c']
    total_deleted = conn.execute("SELECT COUNT(*) AS c FROM stock_entries WHERE status = 'DELETED'").fetchone()['c']

    conn.close()
    return jsonify({
        'success': True,
        'stock': [dict(r) for r in rows],
        'counts': counts,
        'total_active': total_active,
        'total_deleted': total_deleted,
        'type_labels': STOCK_TYPE_LABELS
    })


# ==================== SUMMARY (Dashboard) ====================
@stock_bp.route('/api/admin/stock/summary', methods=['GET'])
@login_required
def stock_summary():
    conn = get_db()
    summary = {}
    for st in VALID_STOCK_TYPES:
        row = conn.execute('''SELECT
            COUNT(*) AS count,
            SUM(quantity) AS total_qty,
            MAX(actual_received_date) AS last_date
            FROM stock_entries
            WHERE stock_type = ? AND status = 'ACTIVE' ''', (st,)).fetchone()
        last_receipt = conn.execute('''SELECT quantity, actual_received_date, unit
            FROM stock_entries
            WHERE stock_type = ? AND status = 'ACTIVE'
            ORDER BY datetime(created_at) DESC LIMIT 1''', (st,)).fetchone()
        summary[st] = {
            'count': row['count'] or 0,
            'total_qty': row['total_qty'] or 0,
            'last_date': row['last_date'],
            'last_qty': last_receipt['quantity'] if last_receipt else None,
            'last_unit': last_receipt['unit'] if last_receipt else None
        }

    # THR monthly summary for latest ration month (if any)
    latest_thr = conn.execute('''SELECT ration_year, ration_month
        FROM stock_entries
        WHERE stock_type = 'THR' AND status = 'ACTIVE'
        ORDER BY ration_year DESC, ration_month DESC LIMIT 1''').fetchone()
    thr_summary = None
    if latest_thr:
        ry = latest_thr['ration_year']
        rm = latest_thr['ration_month']
        received = conn.execute('''SELECT COALESCE(SUM(quantity),0) AS q FROM stock_entries
            WHERE stock_type='THR' AND status='ACTIVE' AND ration_year=? AND ration_month=?''',
            (ry, rm)).fetchone()['q']
        # Previous month closing
        prev_y, prev_m = (ry, rm - 1) if rm > 1 else (ry - 1, 12)
        prior_received = conn.execute('''SELECT COALESCE(SUM(quantity),0) AS q FROM stock_entries
            WHERE stock_type='THR' AND status='ACTIVE' AND (ration_year < ? OR (ration_year = ? AND ration_month < ?))''',
            (ry, ry, rm)).fetchone()['q']
        thr_summary = {
            'ration_year': ry,
            'ration_month': rm,
            'received': received,
            'prior_received': prior_received
        }

    conn.close()
    return jsonify({
        'success': True,
        'summary': summary,
        'thr_summary': thr_summary,
        'type_labels': STOCK_TYPE_LABELS
    })


# ==================== GET DETAIL ====================
@stock_bp.route('/api/admin/stock/<int:sid>', methods=['GET'])
@login_required
def get_stock(sid):
    conn = get_db()
    row = conn.execute('SELECT * FROM stock_entries WHERE id = ?', (sid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'Stock entry not found'}), 404
    return jsonify({'success': True, 'stock': dict(row), 'type_labels': STOCK_TYPE_LABELS})


# ==================== GET LOGS ====================
@stock_bp.route('/api/admin/stock/<int:sid>/logs', methods=['GET'])
@login_required
def get_stock_logs(sid):
    conn = get_db()
    rows = conn.execute('SELECT * FROM stock_logs WHERE stock_entry_id = ? ORDER BY datetime(performed_at) DESC, id DESC', (sid,)).fetchall()
    conn.close()
    return jsonify({'success': True, 'logs': [dict(r) for r in rows]})


# ==================== ALL LOGS ====================
@stock_bp.route('/api/admin/stock/logs/all', methods=['GET'])
@login_required
def get_all_stock_logs():
    stock_type = (request.args.get('type') or '').strip().upper()
    conn = get_db()
    if stock_type and stock_type in VALID_STOCK_TYPES:
        rows = conn.execute('SELECT * FROM stock_logs WHERE stock_type = ? ORDER BY datetime(performed_at) DESC, id DESC LIMIT 300', (stock_type,)).fetchall()
    else:
        rows = conn.execute('SELECT * FROM stock_logs ORDER BY datetime(performed_at) DESC, id DESC LIMIT 300').fetchall()
    conn.close()
    return jsonify({'success': True, 'logs': [dict(r) for r in rows]})


# ==================== HELPERS ====================
def validate_stock_payload(d, is_update=False):
    errs = []
    stock_type = (d.get('stock_type') or '').strip().upper()
    if stock_type not in VALID_STOCK_TYPES:
        errs.append('Stock type is required.')
        return errs, stock_type, None

    actual_received_date = (d.get('actual_received_date') or '').strip()
    if not actual_received_date:
        errs.append('Actual received date is required.')

    qty = d.get('quantity')
    try:
        qty = float(qty)
        if qty <= 0:
            errs.append('Quantity must be greater than zero.')
    except (TypeError, ValueError):
        errs.append('Quantity is required.')
        qty = None

    # Category-specific validation
    if stock_type == 'THR':
        ry = d.get('ration_year')
        rm = d.get('ration_month')
        try:
            ry = int(ry); rm = int(rm)
            if rm < 1 or rm > 12:
                errs.append('Invalid ration month.')
        except (TypeError, ValueError):
            errs.append('Ration month is required for THR stock.')

    if stock_type == 'SANITARY_NAPKINS':
        ppp = d.get('pieces_per_packet')
        try:
            ppp = float(ppp)
            if ppp <= 0:
                errs.append('Pieces per packet must be greater than zero.')
        except (TypeError, ValueError):
            errs.append('Pieces per packet is required.')

    if stock_type == 'OTHERS':
        item_name = (d.get('item_name') or '').strip()
        if not item_name:
            errs.append('Item name is required.')

    if stock_type == 'MILK_POWDER':
        item_name = (d.get('item_name') or '').strip()
        if not item_name:
            errs.append('Item name is required.')

    return errs, stock_type, qty


def compute_calcs(d, stock_type):
    """Compute derived values for storage."""
    out = {
        'packets': None, 'grams_per_packet': None, 'total_grams': None,
        'total_kg': None, 'pieces_per_packet': None, 'total_pieces': None
    }
    if stock_type == 'MILK_POWDER':
        try:
            packets = float(d.get('packets') or 0)
            gpp = float(d.get('grams_per_packet') or 0)
            if packets > 0 and gpp > 0:
                total_g = packets * gpp
                out['packets'] = packets
                out['grams_per_packet'] = gpp
                out['total_grams'] = total_g
                out['total_kg'] = round(total_g / 1000.0, 3)
        except (TypeError, ValueError):
            pass
    if stock_type == 'SUGAR':
        # quantity is grams; also store kg
        try:
            q = float(d.get('quantity'))
            out['total_grams'] = q
            out['total_kg'] = round(q / 1000.0, 3)
        except (TypeError, ValueError):
            pass
    if stock_type == 'SANITARY_NAPKINS':
        try:
            packets = float(d.get('packets') or 0)
            ppp = float(d.get('pieces_per_packet') or 0)
            if packets > 0 and ppp > 0:
                out['packets'] = packets
                out['pieces_per_packet'] = ppp
                out['total_pieces'] = packets * ppp
        except (TypeError, ValueError):
            pass
    return out


# ==================== CREATE ====================
@stock_bp.route('/api/admin/stock', methods=['POST'])
@login_required
def create_stock():
    d = request.get_json() or {}
    errs, stock_type, qty = validate_stock_payload(d)
    if errs:
        return jsonify({'error': ' '.join(errs)}), 400

    calcs = compute_calcs(d, stock_type)
    t = now_iso()
    uid = session.get('user_id')

    ry = None; rm = None
    if stock_type == 'THR':
        ry = int(d.get('ration_year'))
        rm = int(d.get('ration_month'))

    conn = get_db()
    cur = conn.execute('''INSERT INTO stock_entries
        (stock_type, item_name, year, ration_year, ration_month, quantity, unit,
         packets, grams_per_packet, total_grams, total_kg, pieces_per_packet, total_pieces,
         bill_challan_no, billing_date, actual_received_date, supplier_name, remarks, details,
         photo_data, status, created_by, updated_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'ACTIVE', ?,?,?,?)''',
        (stock_type,
         (d.get('item_name') or '').strip() or None,
         int(d.get('year')) if d.get('year') else (ry or None),
         ry, rm, qty, (d.get('unit') or '').strip() or None,
         calcs['packets'], calcs['grams_per_packet'], calcs['total_grams'], calcs['total_kg'],
         calcs['pieces_per_packet'], calcs['total_pieces'],
         (d.get('bill_challan_no') or '').strip() or None,
         (d.get('billing_date') or '').strip() or None,
         (d.get('actual_received_date') or '').strip(),
         (d.get('supplier_name') or '').strip() or None,
         (d.get('remarks') or '').strip() or None,
         (d.get('details') or '').strip() or None,
         d.get('photo_data') or None,
         uid, uid, t, t))
    sid = cur.lastrowid

    new_vals = {k: v for k, v in {
        'stock_type': stock_type, 'item_name': d.get('item_name'),
        'quantity': qty, 'unit': d.get('unit'),
        'actual_received_date': d.get('actual_received_date'),
        'ration_year': ry, 'ration_month': rm
    }.items() if v}
    add_stock_log(conn, sid, stock_type, 'ADD', None, new_vals, None, d.get('actual_received_date'))
    conn.commit()
    row = conn.execute('SELECT * FROM stock_entries WHERE id = ?', (sid,)).fetchone()
    conn.close()
    return jsonify({'success': True, 'stock': dict(row), 'message': 'Stock saved successfully'}), 201


# ==================== UPDATE ====================
@stock_bp.route('/api/admin/stock/<int:sid>', methods=['PATCH'])
@login_required
def update_stock(sid):
    d = request.get_json() or {}
    conn = get_db()
    old = conn.execute('SELECT * FROM stock_entries WHERE id = ?', (sid,)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': 'Stock entry not found'}), 404
    if old['status'] != 'ACTIVE':
        conn.close()
        return jsonify({'error': 'Deleted stock cannot be edited.'}), 400

    errs, stock_type, qty = validate_stock_payload(d)
    if errs:
        conn.close()
        return jsonify({'error': ' '.join(errs)}), 400
    if stock_type != old['stock_type']:
        conn.close()
        return jsonify({'error': 'Stock type cannot be changed. Delete and re-create instead.'}), 400

    calcs = compute_calcs(d, stock_type)
    ry = None; rm = None
    if stock_type == 'THR':
        ry = int(d.get('ration_year'))
        rm = int(d.get('ration_month'))

    t = now_iso()
    uid = session.get('user_id')
    # Photo handling
    photo_new = d.get('photo_data') if 'photo_data' in d else old['photo_data']
    conn.execute('''UPDATE stock_entries SET
        item_name=?, year=?, ration_year=?, ration_month=?, quantity=?, unit=?,
        packets=?, grams_per_packet=?, total_grams=?, total_kg=?, pieces_per_packet=?, total_pieces=?,
        bill_challan_no=?, billing_date=?, actual_received_date=?, supplier_name=?, remarks=?, details=?,
        photo_data=?,
        updated_by=?, updated_at=?
        WHERE id=?''',
        ((d.get('item_name') or '').strip() or None,
         int(d.get('year')) if d.get('year') else (ry or None),
         ry, rm, qty, (d.get('unit') or '').strip() or None,
         calcs['packets'], calcs['grams_per_packet'], calcs['total_grams'], calcs['total_kg'],
         calcs['pieces_per_packet'], calcs['total_pieces'],
         (d.get('bill_challan_no') or '').strip() or None,
         (d.get('billing_date') or '').strip() or None,
         (d.get('actual_received_date') or '').strip(),
         (d.get('supplier_name') or '').strip() or None,
         (d.get('remarks') or '').strip() or None,
         (d.get('details') or '').strip() or None,
         photo_new,
         uid, t, sid))

    old_d = dict(old)
    new_row = conn.execute('SELECT * FROM stock_entries WHERE id = ?', (sid,)).fetchone()
    changes = {}
    for k in ['item_name','quantity','unit','bill_challan_no','billing_date',
              'actual_received_date','supplier_name','remarks','details',
              'ration_year','ration_month']:
        ov = old_d.get(k)
        nv = new_row[k]
        if str(ov or '') != str(nv or ''):
            changes[k] = {'old': ov, 'new': nv}

    # Photo change detection (compare lengths to avoid huge log payloads)
    old_photo_len = len(old_d.get('photo_data') or '')
    new_photo_len = len(new_row['photo_data'] or '')
    if old_photo_len != new_photo_len:
        if old_photo_len == 0 and new_photo_len > 0:
            changes['photo_data'] = {'old': None, 'new': '(photo added)'}
        elif old_photo_len > 0 and new_photo_len == 0:
            changes['photo_data'] = {'old': '(photo)', 'new': None}
        else:
            changes['photo_data'] = {'old': '(photo)', 'new': '(photo changed)'}

    if not changes:
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'changed': False, 'message': 'No changes.'})

    add_stock_log(conn, sid, stock_type, 'EDIT', changes, dict(new_row), None, d.get('actual_received_date'))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'changed': True, 'message': 'Stock edited successfully'})


# ==================== DELETE (Soft) ====================
@stock_bp.route('/api/admin/stock/<int:sid>/delete', methods=['POST'])
@login_required
def delete_stock(sid):
    d = request.get_json() or {}
    reason = (d.get('reason') or '').strip()
    if not reason:
        return jsonify({'error': 'Delete reason is required.'}), 400

    conn = get_db()
    row = conn.execute('SELECT * FROM stock_entries WHERE id = ?', (sid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Stock entry not found'}), 404
    if row['status'] != 'ACTIVE':
        conn.close()
        return jsonify({'error': 'Stock already deleted.'}), 400

    t = now_iso()
    uid = session.get('user_id')

    # Push to Recycle Bin (MEDIUM)
    try:
        from settings import push_recycle
        push_recycle(conn, 'MEDIUM', 'STOCK', 'STOCK_ENTRY',
                     record_id=sid,
                     record_name=(row['item_name'] or row['stock_type']) + ' · ' + str(row['quantity']) + ' ' + (row['unit'] or ''),
                     record_data=dict(row),
                     effective_date=row['actual_received_date'],
                     reason=reason)
    except Exception:
        pass

    conn.execute('''UPDATE stock_entries SET
        status='DELETED', deleted_at=?, deleted_by=?, delete_reason=?, updated_by=?, updated_at=?
        WHERE id=?''', (t, uid, reason, uid, t, sid))

    add_stock_log(conn, sid, row['stock_type'], 'DELETE',
                  dict(row), {'status': 'DELETED'}, reason, row['actual_received_date'])
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Stock deleted successfully'})


# ==================== RECOVER ====================
@stock_bp.route('/api/admin/stock/<int:sid>/recover', methods=['POST'])
@login_required
def recover_stock(sid):
    conn = get_db()
    row = conn.execute('SELECT * FROM stock_entries WHERE id = ?', (sid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Stock entry not found'}), 404
    if row['status'] != 'DELETED':
        conn.close()
        return jsonify({'error': 'Stock is not deleted.'}), 400

    t = now_iso()
    uid = session.get('user_id')
    conn.execute('''UPDATE stock_entries SET
        status='ACTIVE', deleted_at=NULL, deleted_by=NULL, delete_reason=NULL,
        updated_by=?, updated_at=?
        WHERE id=?''', (uid, t, sid))

    add_stock_log(conn, sid, row['stock_type'], 'RECOVER',
                  {'status': 'DELETED'}, {'status': 'ACTIVE'}, None, row['actual_received_date'])
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Stock recovered successfully'})


# ==================== PERMANENT DELETE ====================
@stock_bp.route('/api/admin/stock/<int:sid>/permanent-delete', methods=['POST'])
@login_required
def permanent_delete_stock(sid):
    d = request.get_json() or {}
    confirm = (d.get('confirm') or '').strip()
    if confirm != 'DELETE':
        return jsonify({'error': 'Type DELETE to confirm permanent deletion.'}), 400

    conn = get_db()
    row = conn.execute('SELECT * FROM stock_entries WHERE id = ?', (sid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({'error': 'Stock entry not found'}), 404

    # Log first (before removal)
    add_stock_log(conn, sid, row['stock_type'], 'PERMANENT_DELETE',
                  dict(row), None, d.get('reason') or 'Permanent delete', row['actual_received_date'])
    conn.execute('DELETE FROM stock_entries WHERE id = ?', (sid,))
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Stock permanently deleted successfully'})


# ==================== THR RECIPE-WISE TABLES ====================
def init_thr_recipe_tables():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS stock_recipe_lines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_entry_id INTEGER NOT NULL,
        category TEXT NOT NULL,
        recipe_name TEXT NOT NULL,
        packet_weight_grams REAL NOT NULL,
        packets REAL NOT NULL,
        total_grams REAL,
        total_kg REAL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (stock_entry_id) REFERENCES stock_entries(id) ON DELETE CASCADE)''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_recipe_entry ON stock_recipe_lines(stock_entry_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_recipe_category ON stock_recipe_lines(category)')

    # stock_entries में category column जोड़ें (थ्र के लिए)
    try:
        conn.execute('ALTER TABLE stock_entries ADD COLUMN thr_category TEXT')
    except Exception:
        pass
    # is_recipe_batch flag
    try:
        conn.execute('ALTER TABLE stock_entries ADD COLUMN is_recipe_batch INTEGER DEFAULT 0')
    except Exception:
        pass
    # photo data
    try:
        conn.execute('ALTER TABLE stock_entries ADD COLUMN photo_data TEXT')
    except Exception:
        pass
    conn.commit()
    conn.close()


# ==================== THR RECIPE MASTER ====================
THR_RECIPE_MASTER = {
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


@stock_bp.route('/api/admin/stock/thr-recipe-master', methods=['GET'])
@login_required
def thr_recipe_master():
    return jsonify({'success': True, 'master': THR_RECIPE_MASTER})


# ==================== THR RECIPE-WISE CREATE ====================
@stock_bp.route('/api/admin/stock/thr-recipe', methods=['POST'])
@login_required
def create_thr_recipe():
    d = request.get_json() or {}

    category = (d.get('thr_category') or '').strip().upper()
    if category not in THR_RECIPE_MASTER:
        return jsonify({'error': 'Invalid THR category.'}), 400

    ry = d.get('ration_year')
    rm = d.get('ration_month')
    try:
        ry = int(ry); rm = int(rm)
        if rm < 1 or rm > 12:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'Ration month is required for THR stock.'}), 400

    actual_received_date = (d.get('actual_received_date') or '').strip()
    if not actual_received_date:
        return jsonify({'error': 'Actual received date is required.'}), 400

    lines = d.get('lines') or []
    if not isinstance(lines, list) or not lines:
        return jsonify({'error': 'कम से कम एक recipe packet quantity भरें।'}), 400

    # Validate against master
    master = {r['name']: r['weight'] for r in THR_RECIPE_MASTER[category]}
    clean_lines = []
    total_pkts = 0
    total_grams = 0
    for ln in lines:
        name = (ln.get('recipe_name') or '').strip()
        if name not in master:
            return jsonify({'error': 'Invalid recipe item: ' + name}), 400
        try:
            pk = float(ln.get('packets') or 0)
        except (TypeError, ValueError):
            return jsonify({'error': 'Invalid packet quantity for ' + name}), 400
        if pk < 0:
            return jsonify({'error': 'Packet quantity cannot be negative.'}), 400
        if pk == 0:
            continue  # skip zero rows
        weight = master[name]
        tg = pk * weight
        clean_lines.append({
            'recipe_name': name,
            'packet_weight_grams': weight,
            'packets': pk,
            'total_grams': tg,
            'total_kg': round(tg / 1000.0, 3)
        })
        total_pkts += pk
        total_grams += tg

    if not clean_lines:
        return jsonify({'error': 'कम से कम एक packet quantity ज़रूर भरें।'}), 400

    total_kg = round(total_grams / 1000.0, 3)
    t = now_iso()
    uid = session.get('user_id')
    photo_data = d.get('photo_data') or None

    conn = get_db()
    cur = conn.execute('''INSERT INTO stock_entries
        (stock_type, item_name, year, ration_year, ration_month, quantity, unit,
         total_grams, total_kg,
         bill_challan_no, billing_date, actual_received_date, supplier_name, remarks, details,
         photo_data, thr_category, is_recipe_batch, status,
         created_by, updated_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'ACTIVE',?,?,?,?)''',
        ('THR',
         'THR — ' + category.replace('_', ' '),
         ry, ry, rm,
         total_pkts, 'Packets',
         total_grams, total_kg,
         (d.get('bill_challan_no') or '').strip() or None,
         (d.get('billing_date') or '').strip() or None,
         actual_received_date,
         (d.get('supplier_name') or '').strip() or None,
         (d.get('remarks') or '').strip() or None,
         (d.get('details') or '').strip() or None,
         photo_data,
         category,
         uid, uid, t, t))
    sid = cur.lastrowid

    for ln in clean_lines:
        conn.execute('''INSERT INTO stock_recipe_lines
            (stock_entry_id, category, recipe_name, packet_weight_grams, packets, total_grams, total_kg,
             created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?)''',
            (sid, category, ln['recipe_name'], ln['packet_weight_grams'],
             ln['packets'], ln['total_grams'], ln['total_kg'], t, t))

    new_vals = {
        'thr_category': category,
        'ration_year': ry, 'ration_month': rm,
        'total_packets': total_pkts,
        'total_grams': total_grams,
        'total_kg': total_kg,
        'recipes': len(clean_lines)
    }
    add_stock_log(conn, sid, 'THR', 'ADD', None, new_vals, None, actual_received_date)
    conn.commit()
    row = conn.execute('SELECT * FROM stock_entries WHERE id = ?', (sid,)).fetchone()
    conn.close()
    return jsonify({
        'success': True,
        'stock': dict(row),
        'message': 'THR stock saved successfully (' + str(len(clean_lines)) + ' recipes)'
    }), 201


# ==================== GET RECIPE LINES ====================
@stock_bp.route('/api/admin/stock/<int:sid>/recipes', methods=['GET'])
@login_required
def get_stock_recipes(sid):
    conn = get_db()
    rows = conn.execute('SELECT * FROM stock_recipe_lines WHERE stock_entry_id = ? ORDER BY id ASC', (sid,)).fetchall()
    conn.close()
    return jsonify({'success': True, 'recipes': [dict(r) for r in rows]})


# ==================== THR MULTI-CATEGORY CREATE ====================
@stock_bp.route('/api/admin/stock/thr-multi', methods=['POST'])
@login_required
def create_thr_multi():
    d = request.get_json() or {}

    ry = d.get('ration_year')
    rm = d.get('ration_month')
    try:
        ry = int(ry); rm = int(rm)
        if rm < 1 or rm > 12:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({'error': 'Ration month is required for THR stock.'}), 400

    actual_received_date = (d.get('actual_received_date') or '').strip()
    if not actual_received_date:
        return jsonify({'error': 'Actual received date is required.'}), 400

    categories = d.get('categories') or []
    if not isinstance(categories, list) or not categories:
        return jsonify({'error': '\u0915\u092e \u0938\u0947 \u0915\u092e \u090f\u0915 category \u092e\u0947\u0902 packet quantity \u092d\u0930\u0947\u0902\u0964'}), 400

    validated = []
    grand_pkts = 0
    grand_grams = 0
    total_lines = 0

    for cat_entry in categories:
        cat = (cat_entry.get('category') or '').strip().upper()
        if cat not in THR_RECIPE_MASTER:
            return jsonify({'error': 'Invalid THR category: ' + cat}), 400
        lines_in = cat_entry.get('lines') or []
        if not lines_in:
            continue
        master = {r['name']: r['weight'] for r in THR_RECIPE_MASTER[cat]}
        clean_lines = []
        cat_pkts = 0
        cat_grams = 0
        for ln in lines_in:
            name = (ln.get('recipe_name') or '').strip()
            if name not in master:
                return jsonify({'error': 'Invalid recipe: ' + name}), 400
            try:
                pk = float(ln.get('packets') or 0)
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid packet quantity for ' + name}), 400
            if pk <= 0:
                continue
            weight = master[name]
            tg = pk * weight
            clean_lines.append({
                'recipe_name': name,
                'packet_weight_grams': weight,
                'packets': pk,
                'total_grams': tg,
                'total_kg': round(tg/1000.0, 3)
            })
            cat_pkts += pk
            cat_grams += tg
        if clean_lines:
            validated.append({'category': cat, 'lines': clean_lines, 'pkts': cat_pkts, 'grams': cat_grams})
            grand_pkts += cat_pkts
            grand_grams += cat_grams
            total_lines += len(clean_lines)

    if not validated:
        return jsonify({'error': '\u0915\u092e \u0938\u0947 \u0915\u092e \u090f\u0915 category \u092e\u0947\u0902 packet quantity \u092d\u0930\u0947\u0902\u0964'}), 400

    grand_kg = round(grand_grams / 1000.0, 3)
    t = now_iso()
    uid = session.get('user_id')
    photo_data = d.get('photo_data') or None
    bill_no = (d.get('bill_challan_no') or '').strip() or None
    billing_date = (d.get('billing_date') or '').strip() or None
    supplier = (d.get('supplier_name') or '').strip() or None
    remarks = (d.get('remarks') or '').strip() or None

    conn = get_db()

    # ONE stock entry for all categories
    cur = conn.execute('''INSERT INTO stock_entries
        (stock_type, item_name, year, ration_year, ration_month, quantity, unit,
         total_grams, total_kg,
         bill_challan_no, billing_date, actual_received_date, supplier_name, remarks,
         photo_data, thr_category, is_recipe_batch, status,
         created_by, updated_by, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'ACTIVE',?,?,?,?)''',
        ('THR', 'THR Multi-Category', ry, ry, rm,
         grand_pkts, 'Packets',
         grand_grams, grand_kg,
         bill_no, billing_date, actual_received_date, supplier, remarks,
         photo_data, 'MULTI',
         uid, uid, t, t))
    sid = cur.lastrowid

    # All recipe lines with their category
    for v in validated:
        for ln in v['lines']:
            conn.execute('''INSERT INTO stock_recipe_lines
                (stock_entry_id, category, recipe_name, packet_weight_grams, packets, total_grams, total_kg,
                 created_at, updated_at)
                VALUES (?,?,?,?,?,?,?,?,?)''',
                (sid, v['category'], ln['recipe_name'], ln['packet_weight_grams'],
                 ln['packets'], ln['total_grams'], ln['total_kg'], t, t))

    categories_summary = {v['category']: v['pkts'] for v in validated}
    new_vals = {
        'thr_categories': categories_summary,
        'ration_year': ry, 'ration_month': rm,
        'total_packets': grand_pkts,
        'total_grams': grand_grams,
        'total_kg': grand_kg,
        'recipes': total_lines
    }
    add_stock_log(conn, sid, 'THR', 'ADD', None, new_vals, None, actual_received_date)
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'THR stock saved successfully (' + str(len(validated)) + ' categories, ' + str(total_lines) + ' recipes)',
        'entry_id': sid,
        'total_packets': grand_pkts,
        'total_kg': grand_kg
    }), 201


# ==================== GET RECIPE LINES ====================

# ==================== EDIT THR RECIPE BATCH ====================
@stock_bp.route('/api/admin/stock/<int:sid>/edit-recipe', methods=['POST'])
@login_required
def edit_thr_recipe(sid):
    d = request.get_json() or {}
    conn = get_db()
    old = conn.execute('SELECT * FROM stock_entries WHERE id = ?', (sid,)).fetchone()
    if not old:
        conn.close()
        return jsonify({'error': 'Stock entry not found'}), 404
    if old['status'] != 'ACTIVE':
        conn.close()
        return jsonify({'error': 'Deleted stock cannot be edited.'}), 400
    if not old['is_recipe_batch']:
        conn.close()
        return jsonify({'error': 'Not a recipe batch.'}), 400

    lines_in = d.get('lines') or []
    if not lines_in:
        conn.close()
        return jsonify({'error': 'कम से कम एक recipe में packet quantity भरें।'}), 400

    grand_pkts = 0
    grand_grams = 0
    clean_lines = []
    for ln in lines_in:
        try:
            pk = float(ln.get('packets') or 0)
            w = float(ln.get('packet_weight_grams') or 0)
        except (TypeError, ValueError):
            conn.close()
            return jsonify({'error': 'Invalid quantity.'}), 400
        if pk <= 0:
            continue
        if w <= 0:
            conn.close()
            return jsonify({'error': 'Invalid packet weight.'}), 400
        tg = pk * w
        clean_lines.append({
            'recipe_name': (ln.get('recipe_name') or '').strip(),
            'category': (ln.get('category') or '').strip(),
            'packet_weight_grams': w,
            'packets': pk,
            'total_grams': tg,
            'total_kg': round(tg / 1000.0, 3)
        })
        grand_pkts += pk
        grand_grams += tg

    if not clean_lines:
        conn.close()
        return jsonify({'error': 'कम से कम एक packet quantity ज़रूर भरें।'}), 400

    grand_kg = round(grand_grams / 1000.0, 3)
    actual_date = (d.get('actual_received_date') or old['actual_received_date']).strip()
    t = now_iso()
    uid = session.get('user_id')

    # Update stock_entries
    conn.execute('''UPDATE stock_entries SET
        quantity=?, total_grams=?, total_kg=?,
        bill_challan_no=?, billing_date=?, actual_received_date=?, supplier_name=?, remarks=?,
        photo_data=?, updated_by=?, updated_at=?
        WHERE id=?''',
        (grand_pkts, grand_grams, grand_kg,
         (d.get('bill_challan_no') or '').strip() or None,
         (d.get('billing_date') or '').strip() or None,
         actual_date,
         (d.get('supplier_name') or '').strip() or None,
         (d.get('remarks') or '').strip() or None,
         d.get('photo_data') if 'photo_data' in d else old['photo_data'],
         uid, t, sid))

    # Delete old recipe lines, insert new
    conn.execute('DELETE FROM stock_recipe_lines WHERE stock_entry_id = ?', (sid,))
    for ln in clean_lines:
        conn.execute('''INSERT INTO stock_recipe_lines
            (stock_entry_id, category, recipe_name, packet_weight_grams, packets, total_grams, total_kg,
             created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?)''',
            (sid, ln['category'], ln['recipe_name'], ln['packet_weight_grams'],
             ln['packets'], ln['total_grams'], ln['total_kg'], t, t))

    changes = {
        'total_packets': {'old': old['quantity'], 'new': grand_pkts},
        'total_kg': {'old': old['total_kg'], 'new': grand_kg}
    }
    add_stock_log(conn, sid, 'THR', 'EDIT', changes,
                  {'recipes': len(clean_lines), 'total_packets': grand_pkts, 'total_kg': grand_kg},
                  None, actual_date)
    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'THR stock updated successfully'})
