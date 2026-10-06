import os
p = os.path.expanduser('~/data_manager/server.py')
src = open(p).read()

# 1) Insert helper before the AUTH section
helper = "\n\ndef find_aadhaar_owner(conn, aadhaar, exclude_member_id=None):\n"
helper += "    clean = (aadhaar or '').replace('-', '').strip()\n"
helper += "    if not clean:\n"
helper += "        return None\n"
helper += "    sql = 'SELECT m.id, m.full_name, f.aush_number, f.family_name FROM family_members m JOIN families f ON f.id = m.family_id WHERE REPLACE(m.aadhaar_number, \"-\", \"\") = ? AND m.is_active = 1'\n"
helper += "    params = [clean]\n"
helper += "    if exclude_member_id:\n"
helper += "        sql += ' AND m.id != ?'\n"
helper += "        params.append(exclude_member_id)\n"
helper += "    sql += ' LIMIT 1'\n"
helper += "    return conn.execute(sql, params).fetchone()\n"
helper += "\n\n"
helper += "def aadhaar_conflict_msg(row, is_head=False):\n"
helper += "    label = 'Head Aadhaar' if is_head else 'Aadhaar'\n"
helper += "    return label + ' pehle se maujood hai - Family #' + str(row['aush_number']) + ' (' + (row['family_name'] or '') + ') ke sadasya \"' + (row['full_name'] or '') + '\" ke saath.'\n\n"

anchor = "# ==================== AUTH ===================="
if anchor in src and 'find_aadhaar_owner' not in src:
    src = src.replace(anchor, helper + anchor, 1)
    print("HELPER ADDED")
else:
    print("HELPER SKIP")

# 2) Head duplicate in create_family
b1_old = "    if head_payload and head_payload['aadhaar_number']:\n        dup = conn.execute('SELECT id FROM family_members WHERE REPLACE(aadhaar_number,\"-\",\"\") = ? AND is_active = 1', (head_payload['aadhaar_number'],)).fetchone()\n        if dup:\n            conn.close()\n            return jsonify({'error': 'Head Aadhaar already exists for another member'}), 400"
b1_new = "    if head_payload and head_payload['aadhaar_number']:\n        owner = find_aadhaar_owner(conn, head_payload['aadhaar_number'])\n        if owner:\n            conn.close()\n            return jsonify({'error': aadhaar_conflict_msg(owner, is_head=True)}), 400"
if b1_old in src:
    src = src.replace(b1_old, b1_new)
    print("BLOCK1 PATCHED")
else:
    print("BLOCK1 NOT FOUND")

# 3) Member duplicate in create_member
b2_old = "    if aadhaar and conn.execute('SELECT id FROM family_members WHERE REPLACE(aadhaar_number,\"-\",\"\") = ? AND is_active = 1', (aadhaar,)).fetchone():\n        conn.close()\n        return jsonify({'error': 'Aadhaar already exists for another member'}), 400"
b2_new = "    if aadhaar:\n        owner = find_aadhaar_owner(conn, aadhaar)\n        if owner:\n            conn.close()\n            return jsonify({'error': aadhaar_conflict_msg(owner)}), 400"
if b2_old in src:
    src = src.replace(b2_old, b2_new)
    print("BLOCK2 PATCHED")
else:
    print("BLOCK2 NOT FOUND")

# 4) Member duplicate in update_member
b3_old = "        dup = conn.execute('SELECT id FROM family_members WHERE REPLACE(aadhaar_number,\"-\",\"\") = ? AND id != ? AND is_active = 1', (aadhaar, mid)).fetchone()\n        if dup:\n            conn.close()\n            return jsonify({'error': 'Aadhaar already exists for another member'}), 400"
b3_new = "        owner = find_aadhaar_owner(conn, aadhaar, exclude_member_id=mid)\n        if owner:\n            conn.close()\n            return jsonify({'error': aadhaar_conflict_msg(owner)}), 400"
if b3_old in src:
    src = src.replace(b3_old, b3_new)
    print("BLOCK3 PATCHED")
else:
    print("BLOCK3 NOT FOUND")

open(p, 'w').write(src)
print("PATCH DONE")
