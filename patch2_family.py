import os
p = os.path.expanduser('~/data_manager/server.py')
src = open(p).read()

# 1) Add category, religion columns to families table
anchor = "    add_col(conn, 'family_logs', 'username', 'TEXT')\n"
new = anchor + "    add_col(conn, 'families', 'category', 'TEXT')\n    add_col(conn, 'families', 'religion', 'TEXT')\n"
if "add_col(conn, 'families', 'category'" not in src:
    src = src.replace(anchor, new, 1)
    print("COLUMNS ADDED")
else:
    print("COLUMNS SKIP")

# 2) create_family: use head_name as fallback family_name
old1 = """    d = request.get_json() or {}
    name = (d.get('family_name') or '').strip()
    if not name:
        return jsonify({'error': 'Family Name is required'}), 400
    try:
        aush = int(d.get('aush_number'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Aush Number must be a number'}), 400

    head_name = (d.get('head_name') or '').strip()"""
new1 = """    d = request.get_json() or {}
    name = (d.get('family_name') or '').strip()
    head_name = (d.get('head_name') or '').strip()
    if not name and head_name:
        name = head_name
    if not name:
        return jsonify({'error': 'Head Name is required'}), 400
    try:
        aush = int(d.get('aush_number'))
    except (TypeError, ValueError):
        return jsonify({'error': 'Aush Number must be a number'}), 400"""
if old1 in src:
    src = src.replace(old1, new1)
    print("CREATE1 OK")
else:
    print("CREATE1 MISS")

# 3) Include category/religion in INSERT
old2 = "(aush_number, family_name, husband_name, house_number, address, village, ward, pincode,\n         latitude, longitude, location_accuracy_meters, survey_status, survey_date,\n         is_active, created_by, updated_by, created_at, updated_at)\n        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)"
new2 = "(aush_number, family_name, husband_name, house_number, address, village, ward, pincode,\n         latitude, longitude, location_accuracy_meters, survey_status, survey_date,\n         category, religion,\n         is_active, created_by, updated_by, created_at, updated_at)\n        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?)"
if old2 in src:
    src = src.replace(old2, new2, 1)
    print("INSERT OK")
else:
    print("INSERT MISS")

old2b = """        (aush, name, d.get('husband_name'), d.get('house_number'), d.get('address'),
         d.get('village'), d.get('ward'), d.get('pincode'),
         d.get('latitude'), d.get('longitude'), d.get('location_accuracy_meters'),
         d.get('survey_status'), d.get('survey_date'),
         uid, uid, t, t))"""
new2b = """        (aush, name, d.get('husband_name'), d.get('house_number'), d.get('address'),
         d.get('village'), d.get('ward'), d.get('pincode'),
         d.get('latitude'), d.get('longitude'), d.get('location_accuracy_meters'),
         d.get('survey_status'), d.get('survey_date'),
         d.get('category'), d.get('religion'),
         uid, uid, t, t))"""
if old2b in src:
    src = src.replace(old2b, new2b, 1)
    print("INSERT PARAMS OK")
else:
    print("INSERT PARAMS MISS")

# 4) update_family: include category/religion
old3 = "survey_status=?, survey_date=?, updated_by=?, updated_at=? WHERE id=?''',"
new3 = "survey_status=?, survey_date=?, category=?, religion=?, updated_by=?, updated_at=? WHERE id=?''',"
if old3 in src and "category=?, religion=?" not in src:
    src = src.replace(old3, new3)
    print("UPDATE OK")
else:
    print("UPDATE SKIP")

old3b = """         d.get('survey_status'), d.get('survey_date'), uid, t, fid))"""
new3b = """         d.get('survey_status'), d.get('survey_date'),
         d.get('category'), d.get('religion'), uid, t, fid))"""
if old3b in src:
    src = src.replace(old3b, new3b, 1)
    print("UPDATE PARAMS OK")
else:
    print("UPDATE PARAMS MISS")

open(p, 'w').write(src)
print("DONE")
