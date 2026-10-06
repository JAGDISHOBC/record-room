/* ==================== FAMILY SURVEY MODULE ==================== */

const FamilyMenu = {
  view: 'list',
  familyId: null,
  memberId: null,
  search: '',
  family: null,
  members: [],
  logs: [],
  nextAush: 101
};

const RELATION_OPTIONS = [
  ['SELF', 'Self (Family Head)'],
  ['HUSBAND', 'Husband'],
  ['SON', 'Son'],
  ['DAUGHTER', 'Daughter'],
  ['GRAND_SON', 'Grand-son'],
  ['GRAND_DAUGHTER', 'Grand-daughter'],
  ['FATHER', 'Father'],
  ['MOTHER', 'Mother'],
  ['FATHER_IN_LAW', 'Father-in-law'],
  ['MOTHER_IN_LAW', 'Mother-in-law'],
  ['BROTHER', 'Brother'],
  ['SISTER', 'Sister'],
  ['BROTHER_IN_LAW', 'Brother-in-law'],
  ['SISTER_IN_LAW', 'Sister-in-law'],
  ['OTHER', 'Other']
];

const CATEGORY_OPTIONS = [['', 'Select'], ['OBC','OBC'],['SC','SC'],['ST','ST'],['GENERAL','General']];
const RELIGION_OPTIONS = [['', 'Select'], ['HINDU','Hindu'],['MUSLIM','Muslim'],['OTHER','Other']];
const MARITAL_OPTIONS = [['', 'Select'], ['MARRIED','Married'],['UNMARRIED','Unmarried']];
const GENDER_OPTIONS = [['', 'Select'], ['MALE','Male'],['FEMALE','Female'],['OTHER','Other']];

const FIELD_LABELS = {
  full_name: 'Name',
  aadhaar_number: 'Aadhaar',
  jan_aadhaar_number: 'Jan Aadhaar',
  voter_id_number: 'Voter ID',
  mobile: 'Mobile',
  alternate_mobile: 'Alternate Mobile',
  gender: 'Gender',
  date_of_birth: 'DOB',
  relation_to_head: 'Relationship',
  marital_status: 'Marital Status',
  social_category: 'Category',
  religion: 'Religion',
  caste: 'Caste',
  occupation: 'Occupation',
  family_name: 'Family Name',
  aush_number: 'Aush Number',
  house_number: 'House Number',
  address: 'Address',
  village: 'Village',
  ward: 'Ward',
  pincode: 'Pincode'
};

function maskAadhaar(v) {
  if (!v) return '—';
  const s = String(v).replace(/\D/g, '');
  if (s.length !== 12) return s;
  return 'XXXX-XXXX-' + s.slice(8);
}

function relLabel(code) {
  const found = RELATION_OPTIONS.find(r => r[0] === code);
  return found ? found[1] : (code || '—');
}

/* ==================== MAIN ENTRY ==================== */
FamilyMenu.open = function() {
  FamilyMenu.view = 'list';
  FamilyMenu.familyId = null;
  FamilyMenu.memberId = null;
  FamilyMenu.search = '';
  loadFamilies();
  loadNextAush();
};

async function loadFamilies() {
  try {
    const data = await api('/api/families?search=' + encodeURIComponent(FamilyMenu.search || ''));
    FamilyMenu.families = (data && data.families) || [];
    renderFamilyList();
  } catch (e) {
    showToast(e.message || 'Failed to load families', 'error');
  }
}

async function loadNextAush() {
  try {
    const data = await api('/api/families/next-aush');
    FamilyMenu.nextAush = (data && data.next) || 101;
  } catch (e) {
    FamilyMenu.nextAush = 101;
  }
}

/* ==================== RENDER: FAMILY LIST ==================== */
function renderFamilyList() {
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const list = FamilyMenu.families || [];

  root.innerHTML = `
    <div class="family-header">
      <h2>Family Survey</h2>
    </div>

    <section class="family-search-card">
      <input id="familySearch" type="search"
        placeholder="Search family name, Aush number or member name"
        autocomplete="off" value="${escHtml(FamilyMenu.search)}">
    </section>

    <main class="family-list" id="familyList">
      ${list.length ? list.map(f => `
        <button class="family-row" data-id="${f.id}">
          <div class="family-main">
            <b>${escHtml(f.family_name)}</b>
            <span>Aush No. ${escHtml(f.aush_number)}</span>
          </div>
          <div class="family-meta">
            <span>Members: ${f.member_count || 0}</span>
            ${f.house_number ? '<span>House: ' + escHtml(f.house_number) + '</span>' : ''}
          </div>
          <div class="family-arrow">›</div>
        </button>
      `).join('') : `
        <div class="empty-state">
          <div class="empty-icon">👨‍👩‍👧</div>
          <div class="empty-title">${FamilyMenu.search ? 'कोई परिणाम नहीं मिला' : 'अभी कोई Family नहीं है'}</div>
          <div class="empty-sub">${FamilyMenu.search ? 'दूसरा नाम try करें' : 'नीचे दिए + बटन से नई Family जोड़ें'}</div>
        </div>
      `}
    </main>

    <button class="family-fab" id="addFamilyBtn" title="Add Family">＋</button>
  `;

  const searchInput = document.getElementById('familySearch');
  let searchTimer = null;
  searchInput.addEventListener('input', (e) => {
    FamilyMenu.search = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      loadFamilies();
      setTimeout(() => {
        const el = document.getElementById('familySearch');
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
        }
      }, 30);
    }, 250);
  });

  document.getElementById('addFamilyBtn').addEventListener('click', () => {
    FamilyMenu.view = 'addFamily';
    renderAddFamily();
  });

  root.querySelectorAll('.family-row').forEach(btn => {
    btn.addEventListener('click', () => {
      FamilyMenu.familyId = parseInt(btn.dataset.id, 10);
      FamilyMenu.view = 'familyDetail';
      openFamily(FamilyMenu.familyId);
    });
  });
}

/* ==================== RENDER: ADD FAMILY ==================== */
function renderAddFamily() {
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="family-header">
      <h2>Add Family</h2>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="family-form-card">
      <form id="addFamilyForm">
        <div class="family-form-grid">
          <div class="family-field">
            <label for="aushNumber">Aush Number <span class="req">*</span></label>
            <input type="number" id="aushNumber" value="${FamilyMenu.nextAush}" required>
            <div class="hint">Suggested: ${FamilyMenu.nextAush} (आप बदल सकते हैं)</div>
          </div>
          <div class="family-field">
            <label for="familyName">Family Name <span class="req">*</span></label>
            <input type="text" id="familyName" required autofocus>
          </div>
          <div class="family-field">
            <label for="houseNumber">House Number</label>
            <input type="text" id="houseNumber">
          </div>
          <div class="family-field">
            <label for="village">Village</label>
            <input type="text" id="village">
          </div>
          <div class="family-field">
            <label for="ward">Ward</label>
            <input type="text" id="ward">
          </div>
          <div class="family-field">
            <label for="pincode">Pincode</label>
            <input type="text" id="pincode" inputmode="numeric" maxlength="6">
          </div>
          <div class="family-field" style="grid-column:1 / -1">
            <label for="address">Address</label>
            <textarea id="address" rows="2"></textarea>
          </div>
        </div>
        <div id="formError" class="login-error" style="display:none;margin-top:14px;"></div>
        <div class="family-form-actions">
          <button type="button" class="family-btn family-btn-secondary" id="cancelBtn">Cancel</button>
          <button type="submit" class="family-btn family-btn-primary">Save Family</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    FamilyMenu.view = 'list';
    renderFamilyList();
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    FamilyMenu.view = 'list';
    renderFamilyList();
  });

  document.getElementById('addFamilyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('formError');
    errDiv.style.display = 'none';

    const name = document.getElementById('familyName').value.trim();
    const aush = parseInt(document.getElementById('aushNumber').value, 10);

    if (!name) {
      errDiv.textContent = 'Family Name ज़रूरी है।';
      errDiv.style.display = 'block';
      return;
    }
    if (!aush || aush < 1) {
      errDiv.textContent = 'Aush Number सही डालें।';
      errDiv.style.display = 'block';
      return;
    }

    const payload = {
      family_name: name,
      aush_number: aush,
      house_number: document.getElementById('houseNumber').value.trim() || null,
      village: document.getElementById('village').value.trim() || null,
      ward: document.getElementById('ward').value.trim() || null,
      pincode: document.getElementById('pincode').value.trim() || null,
      address: document.getElementById('address').value.trim() || null
    };

    try {
      const res = await api('/api/families', { method: 'POST', body: payload });
      showToast('Family saved', 'success');
      FamilyMenu.familyId = res.family.id;
      FamilyMenu.view = 'familyDetail';
      openFamily(res.family.id);
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}

/* ==================== OPEN FAMILY ==================== */
async function openFamily(fid) {
  try {
    const data = await api('/api/families/' + fid);
    FamilyMenu.family = data.family;
    FamilyMenu.members = data.members || [];
    FamilyMenu.logs = data.logs || [];
    renderFamilyDetail();
  } catch (e) {
    showToast(e.message || 'Failed to load family', 'error');
    FamilyMenu.view = 'list';
    renderFamilyList();
  }
}

/* ==================== RENDER: FAMILY DETAIL ==================== */
function renderFamilyDetail() {
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const f = FamilyMenu.family;
  if (!f) { FamilyMenu.view = 'list'; renderFamilyList(); return; }

  root.innerHTML = `
    <div class="family-header">
      <h2>${escHtml(f.family_name)}</h2>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="member-detail-card">
      <div class="detail-grid">
        <div class="detail-item"><span>Family Name</span><b>${escHtml(f.family_name)}</b></div>
        <div class="detail-item"><span>Aush Number</span><b>${escHtml(f.aush_number)}</b></div>
        ${f.house_number ? '<div class="detail-item"><span>House Number</span><b>' + escHtml(f.house_number) + '</b></div>' : ''}
        ${f.village ? '<div class="detail-item"><span>Village</span><b>' + escHtml(f.village) + '</b></div>' : ''}
        ${f.ward ? '<div class="detail-item"><span>Ward</span><b>' + escHtml(f.ward) + '</b></div>' : ''}
        ${f.pincode ? '<div class="detail-item"><span>Pincode</span><b>' + escHtml(f.pincode) + '</b></div>' : ''}
        ${f.address ? '<div class="detail-item" style="grid-column:1 / -1"><span>Address</span><b>' + escHtml(f.address) + '</b></div>' : ''}
      </div>
      <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="family-btn family-btn-primary" id="editFamilyBtn">Edit Family</button>
      </div>
    </div>

    <div class="member-detail-card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;">
        <h3 style="margin:0;">Family Members</h3>
        <button class="family-btn family-btn-primary family-btn-sm" id="addMemberBtn">+ Add Member</button>
      </div>
      <div id="memberList">
        ${FamilyMenu.members.length ? FamilyMenu.members.map(m => `
          <button class="member-row" data-id="${m.id}">
            <div class="member-main">
              <b>${escHtml(m.full_name)}${m.is_family_head ? ' <span style="color:var(--family-green);font-size:11px;">• Head</span>' : ''}</b>
              <span>${escHtml(relLabel(m.relation_to_head))}${m.date_of_birth ? ' · Age: ' + calcAge(m.date_of_birth) : ''}</span>
            </div>
            <div class="member-meta">
              ${m.gender ? '<span>' + escHtml(m.gender) + '</span>' : ''}
              ${m.mobile ? '<span>📱 ' + escHtml(m.mobile) + '</span>' : ''}
            </div>
            <div class="family-arrow">›</div>
          </button>
        `).join('') : '<p style="color:var(--family-muted);font-size:13px;margin:8px 0;">No members yet.</p>'}
      </div>
    </div>

    <div class="edit-log-card">
      <h3>Logs</h3>
      <div id="logList">
        ${FamilyMenu.logs.length ? FamilyMenu.logs.map(l => renderLogEntry(l)).join('') : '<p style="color:var(--family-muted);font-size:13px;margin:8px 0;">No logs yet.</p>'}
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    FamilyMenu.view = 'list';
    FamilyMenu.familyId = null;
    loadFamilies();
  });

  document.getElementById('editFamilyBtn').addEventListener('click', () => {
    FamilyMenu.view = 'editFamily';
    renderEditFamily();
  });

  document.getElementById('addMemberBtn').addEventListener('click', () => {
    FamilyMenu.view = 'addMember';
    renderAddMember();
  });

  root.querySelectorAll('.member-row').forEach(btn => {
    btn.addEventListener('click', () => {
      FamilyMenu.memberId = parseInt(btn.dataset.id, 10);
      FamilyMenu.view = 'memberDetail';
      renderMemberDetail();
    });
  });
}

/* ==================== RENDER: EDIT FAMILY ==================== */
function renderEditFamily() {
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const f = FamilyMenu.family;
  if (!f) { FamilyMenu.view = 'list'; renderFamilyList(); return; }

  root.innerHTML = `
    <div class="family-header">
      <h2>Edit Family</h2>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="family-form-card">
      <form id="editFamilyForm">
        <div class="family-form-grid">
          <div class="family-field">
            <label for="aushNumber">Aush Number <span class="req">*</span></label>
            <input type="number" id="aushNumber" value="${f.aush_number}" required>
          </div>
          <div class="family-field">
            <label for="familyName">Family Name <span class="req">*</span></label>
            <input type="text" id="familyName" value="${escHtml(f.family_name)}" required autofocus>
          </div>
          <div class="family-field">
            <label for="houseNumber">House Number</label>
            <input type="text" id="houseNumber" value="${escHtml(f.house_number || '')}">
          </div>
          <div class="family-field">
            <label for="village">Village</label>
            <input type="text" id="village" value="${escHtml(f.village || '')}">
          </div>
          <div class="family-field">
            <label for="ward">Ward</label>
            <input type="text" id="ward" value="${escHtml(f.ward || '')}">
          </div>
          <div class="family-field">
            <label for="pincode">Pincode</label>
            <input type="text" id="pincode" inputmode="numeric" maxlength="6" value="${escHtml(f.pincode || '')}">
          </div>
          <div class="family-field" style="grid-column:1 / -1">
            <label for="address">Address</label>
            <textarea id="address" rows="2">${escHtml(f.address || '')}</textarea>
          </div>
        </div>
        <div id="formError" class="login-error" style="display:none;margin-top:14px;"></div>
        <div class="family-form-actions">
          <button type="button" class="family-btn family-btn-secondary" id="cancelBtn">Cancel</button>
          <button type="submit" class="family-btn family-btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    FamilyMenu.view = 'familyDetail';
    renderFamilyDetail();
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    FamilyMenu.view = 'familyDetail';
    renderFamilyDetail();
  });

  document.getElementById('editFamilyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('formError');
    errDiv.style.display = 'none';
    const name = document.getElementById('familyName').value.trim();
    const aush = parseInt(document.getElementById('aushNumber').value, 10);
    if (!name) { errDiv.textContent = 'Family Name ज़रूरी है।'; errDiv.style.display = 'block'; return; }
    if (!aush || aush < 1) { errDiv.textContent = 'Aush Number सही डालें।'; errDiv.style.display = 'block'; return; }

    const payload = {
      family_name: name, aush_number: aush,
      house_number: document.getElementById('houseNumber').value.trim() || null,
      village: document.getElementById('village').value.trim() || null,
      ward: document.getElementById('ward').value.trim() || null,
      pincode: document.getElementById('pincode').value.trim() || null,
      address: document.getElementById('address').value.trim() || null
    };
    try {
      await api('/api/families/' + FamilyMenu.familyId, { method: 'PUT', body: payload });
      showToast('Family updated', 'success');
      FamilyMenu.view = 'familyDetail';
      openFamily(FamilyMenu.familyId);
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}

/* ==================== RENDER: ADD MEMBER ==================== */
function renderAddMember() {
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="family-header">
      <h2>Add Member</h2>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="family-form-card">
      <form id="addMemberForm">
        <div class="family-form-grid">
          <div class="family-field" style="grid-column:1 / -1">
            <label for="fullName">Name <span class="req">*</span></label>
            <input type="text" id="fullName" required autofocus>
          </div>
          <div class="family-field">
            <label for="gender">Gender</label>
            <select id="gender">${GENDER_OPTIONS.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
          </div>
          <div class="family-field">
            <label for="dob">Date of Birth</label>
            <input type="date" id="dob">
            <div class="hint" id="agePreview">Age: —</div>
          </div>
          <div class="family-field">
            <label for="aadhaar">Aadhaar Number</label>
            <input type="text" id="aadhaar" inputmode="numeric" maxlength="14" placeholder="XXXX-XXXX-XXXX">
          </div>
          <div class="family-field">
            <label for="janAadhaar">Jan Aadhaar Number</label>
            <input type="text" id="janAadhaar">
          </div>
          <div class="family-field">
            <label for="voterId">Voter ID</label>
            <input type="text" id="voterId">
          </div>
          <div class="family-field">
            <label for="mobile">Mobile</label>
            <input type="text" id="mobile" inputmode="numeric" maxlength="10">
          </div>
          <div class="family-field">
            <label for="altMobile">Alternate Mobile</label>
            <input type="text" id="altMobile" inputmode="numeric" maxlength="10">
          </div>
          <div class="family-field">
            <label for="relation">Relationship with Head <span class="req">*</span></label>
            <select id="relation" required>${RELATION_OPTIONS.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
          </div>
          <div class="family-field">
            <label for="marital">Marital Status</label>
            <select id="marital">${MARITAL_OPTIONS.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
          </div>
          <div class="family-field">
            <label for="category">Social Category</label>
            <select id="category">${CATEGORY_OPTIONS.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
          </div>
          <div class="family-field">
            <label for="religion">Religion</label>
            <select id="religion">${RELIGION_OPTIONS.map(o => `<option value="${o[0]}">${o[1]}</option>`).join('')}</select>
          </div>
          <div class="family-field">
            <label for="caste">Caste</label>
            <input type="text" id="caste">
          </div>
          <div class="family-field">
            <label for="occupation">Occupation</label>
            <input type="text" id="occupation">
          </div>
          <div class="family-field" style="grid-column:1 / -1;flex-direction:row;align-items:center;gap:10px;">
            <input type="checkbox" id="isHead" style="width:auto;min-height:auto;">
            <label for="isHead" style="margin:0;">Mark as Family Head (SELF)</label>
          </div>
        </div>
        <div id="formError" class="login-error" style="display:none;margin-top:14px;"></div>
        <div class="family-form-actions">
          <button type="button" class="family-btn family-btn-secondary" id="cancelBtn">Cancel</button>
          <button type="submit" class="family-btn family-btn-primary">Add Member</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    FamilyMenu.view = 'familyDetail';
    renderFamilyDetail();
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    FamilyMenu.view = 'familyDetail';
    renderFamilyDetail();
  });

  const dobInput = document.getElementById('dob');
  dobInput.addEventListener('change', () => {
    document.getElementById('agePreview').textContent = 'Age: ' + calcAge(dobInput.value);
  });

  const aadhaarInput = document.getElementById('aadhaar');
  aadhaarInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 12);
    if (v.length > 8) v = v.slice(0, 4) + '-' + v.slice(4, 8) + '-' + v.slice(8);
    else if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
    e.target.value = v;
  });

  document.getElementById('addMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('formError');
    errDiv.style.display = 'none';
    const name = document.getElementById('fullName').value.trim();
    if (!name) { errDiv.textContent = 'Name ज़रूरी है।'; errDiv.style.display = 'block'; return; }

    const mobile = document.getElementById('mobile').value.trim();
    const altMobile = document.getElementById('altMobile').value.trim();
    if (mobile && !/^\d{10}$/.test(mobile)) { errDiv.textContent = 'Mobile 10 अंकों का होना चाहिए।'; errDiv.style.display = 'block'; return; }
    if (altMobile && !/^\d{10}$/.test(altMobile)) { errDiv.textContent = 'Alternate Mobile 10 अंकों का होना चाहिए।'; errDiv.style.display = 'block'; return; }
    if (mobile && altMobile && mobile === altMobile) { errDiv.textContent = 'Mobile और Alternate Mobile अलग होने चाहिए।'; errDiv.style.display = 'block'; return; }

    const payload = {
      full_name: name,
      gender: document.getElementById('gender').value || null,
      date_of_birth: document.getElementById('dob').value || null,
      aadhaar_number: aadhaarInput.value.replace(/\D/g, '') || null,
      jan_aadhaar_number: document.getElementById('janAadhaar').value.trim() || null,
      voter_id_number: document.getElementById('voterId').value.trim() || null,
      mobile: mobile || null,
      alternate_mobile: altMobile || null,
      relation_to_head: document.getElementById('relation').value,
      marital_status: document.getElementById('marital').value || null,
      social_category: document.getElementById('category').value || null,
      religion: document.getElementById('religion').value || null,
      caste: document.getElementById('caste').value.trim() || null,
      occupation: document.getElementById('occupation').value.trim() || null,
      is_family_head: document.getElementById('isHead').checked ? 1 : 0
    };

    try {
      await api('/api/families/' + FamilyMenu.familyId + '/members', { method: 'POST', body: payload });
      showToast('Member added', 'success');
      FamilyMenu.view = 'familyDetail';
      openFamily(FamilyMenu.familyId);
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}

/* ==================== MEMBER DETAIL ==================== */
function renderMemberDetail() {
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const m = FamilyMenu.members.find(x => x.id === FamilyMenu.memberId);
  if (!m) { FamilyMenu.view = 'familyDetail'; renderFamilyDetail(); return; }

  root.innerHTML = `
    <div class="family-header">
      <h2>Member Detail</h2>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="member-detail-card">
      <div class="detail-section-title">Basic Information</div>
      <div class="detail-grid">
        <div class="detail-item"><span>Name</span><b>${escHtml(m.full_name)}</b></div>
        <div class="detail-item"><span>Gender</span><b>${escHtml(m.gender || '—')}</b></div>
        <div class="detail-item"><span>Date of Birth</span><b>${escHtml(m.date_of_birth || '—')}</b></div>
        <div class="detail-item"><span>Age</span><b>${calcAge(m.date_of_birth)}</b></div>
        <div class="detail-item"><span>Relationship</span><b>${escHtml(relLabel(m.relation_to_head))}</b></div>
        <div class="detail-item"><span>Marital Status</span><b>${escHtml(m.marital_status || '—')}</b></div>
      </div>

      <div class="detail-section-title">Identity</div>
      <div class="detail-grid">
        <div class="detail-item"><span>Aadhaar</span><b>${escHtml(maskAadhaar(m.aadhaar_number))}</b></div>
        <div class="detail-item"><span>Jan Aadhaar</span><b>${escHtml(m.jan_aadhaar_number || '—')}</b></div>
        <div class="detail-item"><span>Voter ID</span><b>${escHtml(m.voter_id_number || '—')}</b></div>
      </div>

      <div class="detail-section-title">Contact</div>
      <div class="detail-grid">
        <div class="detail-item"><span>Mobile</span><b>${escHtml(m.mobile || '—')}</b></div>
        <div class="detail-item"><span>Alternate Mobile</span><b>${escHtml(m.alternate_mobile || '—')}</b></div>
      </div>

      <div class="detail-section-title">Other</div>
      <div class="detail-grid">
        <div class="detail-item"><span>Category</span><b>${escHtml(m.social_category || '—')}</b></div>
        <div class="detail-item"><span>Religion</span><b>${escHtml(m.religion || '—')}</b></div>
        <div class="detail-item"><span>Caste</span><b>${escHtml(m.caste || '—')}</b></div>
        <div class="detail-item"><span>Occupation</span><b>${escHtml(m.occupation || '—')}</b></div>
        <div class="detail-item"><span>Family Head</span><b>${m.is_family_head ? 'Yes' : 'No'}</b></div>
      </div>

      <div style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;">
        <button class="family-btn family-btn-primary" id="editMemberBtn">Edit Member</button>
        ${m.is_family_head ? '' : '<button class="family-btn family-btn-danger" id="deleteMemberBtn">Delete Member</button>'}
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    FamilyMenu.view = 'familyDetail';
    renderFamilyDetail();
  });

  document.getElementById('editMemberBtn').addEventListener('click', () => {
    FamilyMenu.view = 'editMember';
    renderEditMember();
  });

  const delBtn = document.getElementById('deleteMemberBtn');
  if (delBtn) {
    delBtn.addEventListener('click', async () => {
      if (!confirm('इस member को delete (archive) करना है?\n\n' + m.full_name)) return;
      try {
        await api('/api/families/' + FamilyMenu.familyId + '/members/' + m.id, { method: 'DELETE' });
        showToast('Member archived', 'success');
        FamilyMenu.view = 'familyDetail';
        openFamily(FamilyMenu.familyId);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }
}

/* ==================== EDIT MEMBER ==================== */
function renderEditMember() {
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const m = FamilyMenu.members.find(x => x.id === FamilyMenu.memberId);
  if (!m) { FamilyMenu.view = 'familyDetail'; renderFamilyDetail(); return; }

  const aadhaarFormatted = (() => {
    const v = (m.aadhaar_number || '').replace(/\D/g, '');
    if (v.length === 12) return v.slice(0,4) + '-' + v.slice(4,8) + '-' + v.slice(8);
    return v;
  })();

  root.innerHTML = `
    <div class="family-header">
      <h2>Edit Member</h2>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="family-form-card">
      <form id="editMemberForm">
        <div class="family-form-grid">
          <div class="family-field" style="grid-column:1 / -1">
            <label for="fullName">Name <span class="req">*</span></label>
            <input type="text" id="fullName" value="${escHtml(m.full_name)}" required autofocus>
          </div>
          <div class="family-field">
            <label for="gender">Gender</label>
            <select id="gender">${GENDER_OPTIONS.map(o => `<option value="${o[0]}" ${m.gender === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
          </div>
          <div class="family-field">
            <label for="dob">Date of Birth</label>
            <input type="date" id="dob" value="${escHtml(m.date_of_birth || '')}">
            <div class="hint" id="agePreview">Age: ${calcAge(m.date_of_birth)}</div>
          </div>
          <div class="family-field">
            <label for="aadhaar">Aadhaar Number</label>
            <input type="text" id="aadhaar" inputmode="numeric" maxlength="14" value="${escHtml(aadhaarFormatted)}">
          </div>
          <div class="family-field">
            <label for="janAadhaar">Jan Aadhaar Number</label>
            <input type="text" id="janAadhaar" value="${escHtml(m.jan_aadhaar_number || '')}">
          </div>
          <div class="family-field">
            <label for="voterId">Voter ID</label>
            <input type="text" id="voterId" value="${escHtml(m.voter_id_number || '')}">
          </div>
          <div class="family-field">
            <label for="mobile">Mobile</label>
            <input type="text" id="mobile" inputmode="numeric" maxlength="10" value="${escHtml(m.mobile || '')}">
          </div>
          <div class="family-field">
            <label for="altMobile">Alternate Mobile</label>
            <input type="text" id="altMobile" inputmode="numeric" maxlength="10" value="${escHtml(m.alternate_mobile || '')}">
          </div>
          <div class="family-field">
            <label for="relation">Relationship with Head <span class="req">*</span></label>
            <select id="relation" required ${m.is_family_head ? 'disabled' : ''}>
              ${RELATION_OPTIONS.map(o => `<option value="${o[0]}" ${m.relation_to_head === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}
            </select>
            ${m.is_family_head ? '<div class="hint">Family Head का relation SELF ही रहेगा।</div>' : ''}
          </div>
          <div class="family-field">
            <label for="marital">Marital Status</label>
            <select id="marital">${MARITAL_OPTIONS.map(o => `<option value="${o[0]}" ${m.marital_status === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
          </div>
          <div class="family-field">
            <label for="category">Social Category</label>
            <select id="category">${CATEGORY_OPTIONS.map(o => `<option value="${o[0]}" ${m.social_category === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
          </div>
          <div class="family-field">
            <label for="religion">Religion</label>
            <select id="religion">${RELIGION_OPTIONS.map(o => `<option value="${o[0]}" ${m.religion === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>
          </div>
          <div class="family-field">
            <label for="caste">Caste</label>
            <input type="text" id="caste" value="${escHtml(m.caste || '')}">
          </div>
          <div class="family-field">
            <label for="occupation">Occupation</label>
            <input type="text" id="occupation" value="${escHtml(m.occupation || '')}">
          </div>
        </div>
        <div id="formError" class="login-error" style="display:none;margin-top:14px;"></div>
        <div class="family-form-actions">
          <button type="button" class="family-btn family-btn-secondary" id="cancelBtn">Cancel</button>
          <button type="submit" class="family-btn family-btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    FamilyMenu.view = 'memberDetail';
    renderMemberDetail();
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    FamilyMenu.view = 'memberDetail';
    renderMemberDetail();
  });

  const dobInput = document.getElementById('dob');
  dobInput.addEventListener('change', () => {
    document.getElementById('agePreview').textContent = 'Age: ' + calcAge(dobInput.value);
  });

  const aadhaarInput = document.getElementById('aadhaar');
  aadhaarInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 12);
    if (v.length > 8) v = v.slice(0, 4) + '-' + v.slice(4, 8) + '-' + v.slice(8);
    else if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
    e.target.value = v;
  });

  document.getElementById('editMemberForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('formError');
    errDiv.style.display = 'none';
    const name = document.getElementById('fullName').value.trim();
    if (!name) { errDiv.textContent = 'Name ज़रूरी है।'; errDiv.style.display = 'block'; return; }

    const mobile = document.getElementById('mobile').value.trim();
    const altMobile = document.getElementById('altMobile').value.trim();
    if (mobile && !/^\d{10}$/.test(mobile)) { errDiv.textContent = 'Mobile 10 अंकों का होना चाहिए।'; errDiv.style.display = 'block'; return; }
    if (altMobile && !/^\d{10}$/.test(altMobile)) { errDiv.textContent = 'Alternate Mobile 10 अंकों का होना चाहिए।'; errDiv.style.display = 'block'; return; }
    if (mobile && altMobile && mobile === altMobile) { errDiv.textContent = 'Mobile और Alternate Mobile अलग होने चाहिए।'; errDiv.style.display = 'block'; return; }

    const payload = {
      full_name: name,
      gender: document.getElementById('gender').value || null,
      date_of_birth: document.getElementById('dob').value || null,
      aadhaar_number: aadhaarInput.value.replace(/\D/g, '') || null,
      jan_aadhaar_number: document.getElementById('janAadhaar').value.trim() || null,
      voter_id_number: document.getElementById('voterId').value.trim() || null,
      mobile: mobile || null,
      alternate_mobile: altMobile || null,
      relation_to_head: document.getElementById('relation').value,
      marital_status: document.getElementById('marital').value || null,
      social_category: document.getElementById('category').value || null,
      religion: document.getElementById('religion').value || null,
      caste: document.getElementById('caste').value.trim() || null,
      occupation: document.getElementById('occupation').value.trim() || null
    };

    try {
      await api('/api/families/' + FamilyMenu.familyId + '/members/' + m.id, { method: 'PUT', body: payload });
      showToast('Member updated', 'success');
      FamilyMenu.view = 'familyDetail';
      openFamily(FamilyMenu.familyId);
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}

/* ==================== LOG RENDERING ==================== */
function renderLogEntry(log) {
  const actionLabels = {
    'CREATE': 'Family Created',
    'UPDATE': 'Updated',
    'ADD': 'Member Added',
    'DELETE': 'Archived'
  };
  const action = actionLabels[log.action] || log.action;
  const isMember = log.entity_type === 'FAMILY_MEMBER';
  const icon = isMember ? '👤' : '👨‍👩‍👧';

  let changesHtml = '';
  if (log.old_values || log.new_values) {
    const parts = [];
    const oldObj = parseMaybeJson(log.old_values);
    const newObj = parseMaybeJson(log.new_values);
    if (oldObj && newObj) {
      Object.keys(newObj).forEach(k => {
        if (!oldObj[k]) return;
        const o = oldObj[k].old;
        const n = oldObj[k].new;
        const label = FIELD_LABELS[k] || k;
        if (o === undefined && n === undefined) return;
        parts.push(`<div class="chg"><b>${escHtml(label)}:</b> <span class="old">${escHtml(formatVal(o))}</span> → <span class="new">${escHtml(formatVal(n))}</span></div>`);
      });
    }
    if (parts.length) {
      changesHtml = '<details><summary>Changes देखें (' + parts.length + ')</summary><div class="log-changes">' + parts.join('') + '</div></details>';
    }
  }

  return `
    <div class="log-entry">
      <div class="log-head">
        <span class="log-action">${icon} ${escHtml(action)}</span>
        <span class="log-time">${fmtDateTime(log.created_at)}</span>
      </div>
      <div class="log-detail">${escHtml(log.detail || '')}</div>
      ${changesHtml}
    </div>
  `;
}

function parseMaybeJson(str) {
  if (!str) return null;
  try { return JSON.parse(str.replace(/'/g, '"')); } catch (e) {
    try {
      return new Function('return (' + str + ')')();
    } catch (e2) { return null; }
  }
}

function formatVal(v) {
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}
