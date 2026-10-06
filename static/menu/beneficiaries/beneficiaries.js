/* ==================== BENEFICIARIES MODULE ==================== */

const BeneficiariesMenu = {
  view: 'dashboard',
  status: 'active',
  category: '',
  search: '',
  beneficiaries: [],
  counts: {},
  total: 0,
  categoryLabels: {},
  selected: null,
  selectedLogs: [],
  today: ''
};

const BENE_CATEGORIES = [
  { code: 'PREGNANT',    label: 'Pregnant Women',           icon: '🤰', color: 'coral' },
  { code: 'LACTATING',   label: 'Lactating Mothers',        icon: '🤱', color: 'purple' },
  { code: 'CHILD_0_6',   label: 'Children 0-6 Months',      icon: '👶', color: 'coral' },
  { code: 'CHILD_6_36',  label: 'Children 6M-3 Years',      icon: '🧒', color: 'purple' },
  { code: 'CHILD_36_72', label: 'Children 3-6 Years',       icon: '🧑', color: 'coral' }
];

const BENE_FIELD_LABELS = {
  full_name: 'Name',
  aadhaar_number: 'Aadhaar',
  father_name: "Father's Name",
  mother_name: "Mother's Name",
  husband_name: 'Husband Name',
  gender: 'Gender',
  date_of_birth: 'Date of Birth',
  house_number: 'House Number',
  religion: 'Religion',
  mobile: 'Mobile',
  alternate_mobile: 'Alternate Mobile',
  father_aadhaar_number: "Father's Aadhaar",
  mother_aadhaar_number: "Mother's Aadhaar",
  jan_aadhaar_number: 'Jan Aadhaar',
  abha_id: 'ABHA ID',
  apaar_id: 'APAAR ID',
  lmp_date: 'LMP',
  edd_date: 'EDD',
  delivery_date: 'Delivery Date',
  entry_reason: 'Entry Reason',
  effective_date: 'Effective Date',
  category: 'Category',
  is_active: 'Status'
};

function beneCatLabel(code){
  const f = BENE_CATEGORIES.find(c => c.code === code);
  return f ? f.label : code;
}
function beneCatIcon(code){
  const f = BENE_CATEGORIES.find(c => c.code === code);
  return f ? f.icon : '👤';
}

function beneGenderAge(b){
  const parts = [];
  if (b.gender) parts.push(b.gender);
  if (b.date_of_birth) parts.push(calcAge(b.date_of_birth));
  return parts.join(' · ');
}

function maskAadhaarBene(v){
  if (!v) return '—';
  const s = String(v).replace(/\D/g, '');
  if (s.length !== 12) return s || '—';
  return 'XXXX-XXXX-' + s.slice(-4);
}

function fmtBeneDate(iso){
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = n => String(n).padStart(2,'0');
  return pad(d.getDate()) + '/' + pad(d.getMonth()+1) + '/' + d.getFullYear();
}

async function beneLoadList(){
  const params = new URLSearchParams();
  params.set('status', BeneficiariesMenu.status);
  if (BeneficiariesMenu.category) params.set('category', BeneficiariesMenu.category);
  if (BeneficiariesMenu.search) params.set('search', BeneficiariesMenu.search);
  const data = await api('/api/admin/beneficiaries?' + params.toString());
  BeneficiariesMenu.beneficiaries = data.beneficiaries || [];
  BeneficiariesMenu.counts = data.counts || {};
  BeneficiariesMenu.total = data.total || 0;
  BeneficiariesMenu.categoryLabels = data.category_labels || {};
  BeneficiariesMenu.today = data.today || '';
}

async function beneLoadDetail(id){
  const data = await api('/api/admin/beneficiaries/' + id);
  BeneficiariesMenu.selected = data.beneficiary;
  const ldata = await api('/api/admin/beneficiaries/' + id + '/logs');
  BeneficiariesMenu.selectedLogs = ldata.logs || [];
}

BeneficiariesMenu.open = function(){
  BeneficiariesMenu.view = 'dashboard';
  BeneficiariesMenu.status = 'active';
  BeneficiariesMenu.category = '';
  BeneficiariesMenu.search = '';
  BeneficiariesMenu.selected = null;
  beneLoadList().then(renderBeneDashboard).catch(e => showToast(e.message, 'error'));
};


/* ==================== RENDER: DASHBOARD / LIST ==================== */
function renderBeneDashboard(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const isInactive = BeneficiariesMenu.status === 'inactive';
  const title = isInactive ? 'Inactive Beneficiaries' : 'Active Beneficiaries';

  root.innerHTML = `
    <div class="bene-header">
      <div>
        <h2>Beneficiaries</h2>
        <div class="sub">${escHtml(title)}</div>
      </div>
    </div>

    <div class="bene-main">

      <div class="bene-toggle">
        <button class="${!isInactive ? 'active' : ''}" data-status="active">Active</button>
        <button class="inactive ${isInactive ? 'active' : ''}" data-status="inactive">Inactive</button>
      </div>

      <div class="bene-categories">
        ${BENE_CATEGORIES.map(c => `
          <button class="bene-cat ${BeneficiariesMenu.category === c.code ? 'active' : ''} ${isInactive ? 'inactive' : ''}" data-cat="${c.code}">
            <h3>${escHtml(c.label)}</h3>
            <span class="count">${(BeneficiariesMenu.counts[c.code] || 0)}</span>
            <span class="bene-cat-icon ${c.color === 'purple' ? 'purple' : ''}">${c.icon}</span>
          </button>
        `).join('')}
      </div>

      <div class="bene-search">
        <input id="beneSearch" type="search"
          placeholder="Search name, father name, Aadhaar or mobile number"
          autocomplete="off" value="${escHtml(BeneficiariesMenu.search)}">
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
        <div id="beneTotalCount" style="font-size:13px;font-weight:700;color:var(--b-muted);">
          ${BeneficiariesMenu.category ? escHtml(beneCatLabel(BeneficiariesMenu.category)) + ' — ' : ''}
          ${BeneficiariesMenu.total} record${BeneficiariesMenu.total === 1 ? '' : 's'}
          ${BeneficiariesMenu.category ? ' <button class="family-btn family-btn-secondary family-btn-sm" id="clearCatBtn" style="margin-left:8px;">Clear filter</button>' : ''}
        </div>
      </div>

      <div class="bene-list" id="beneList">
        ${BeneficiariesMenu.beneficiaries.length
          ? BeneficiariesMenu.beneficiaries.map(b => renderBeneCard(b, isInactive)).join('')
          : renderBeneEmpty(isInactive)}
      </div>

    </div>

    ${!isInactive ? '<button class="family-fab" id="addBeneBtn" title="Add Beneficiary">＋</button>' : ''}
  `;

  // --- Toggle Active/Inactive ---
  root.querySelectorAll('.bene-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      BeneficiariesMenu.status = btn.dataset.status;
      BeneficiariesMenu.category = '';
      BeneficiariesMenu.search = '';
      beneLoadList().then(renderBeneDashboard).catch(e => showToast(e.message, 'error'));
    });
  });

  // --- Category click ---
  root.querySelectorAll('.bene-cat').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.cat;
      BeneficiariesMenu.category = (BeneficiariesMenu.category === code) ? '' : code;
      beneLoadList().then(renderBeneDashboard).catch(e => showToast(e.message, 'error'));
    });
  });

  // --- Clear category ---
  const clearCatBtn = document.getElementById('clearCatBtn');
  if (clearCatBtn) {
    clearCatBtn.addEventListener('click', () => {
      BeneficiariesMenu.category = '';
      beneLoadList().then(renderBeneDashboard).catch(e => showToast(e.message, 'error'));
    });
  }

  // --- Search ---
  const searchInput = document.getElementById('beneSearch');
  let searchTimer = null;
  searchInput.addEventListener('input', (e) => {
    BeneficiariesMenu.search = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      beneLoadList().then(() => {
        // Re-render only the list part to keep focus
        const listEl = document.getElementById('beneList');
        const isInactiveNow = BeneficiariesMenu.status === 'inactive';
        if (listEl) {
          listEl.innerHTML = BeneficiariesMenu.beneficiaries.length
            ? BeneficiariesMenu.beneficiaries.map(b => renderBeneCard(b, isInactiveNow)).join('')
            : renderBeneEmpty(isInactiveNow);
          bindBeneCards();
        }
        // Update the total counter
        const countDiv = document.getElementById('beneTotalCount');
        if (countDiv) {
          countDiv.innerHTML = (BeneficiariesMenu.category ? escHtml(beneCatLabel(BeneficiariesMenu.category)) + ' — ' : '') +
            BeneficiariesMenu.total + ' record' + (BeneficiariesMenu.total === 1 ? '' : 's');
        }
      }).catch(e => showToast(e.message, 'error'));
    }, 250);
  });

  // --- Add button ---
  const addBtn = document.getElementById('addBeneBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      BeneficiariesMenu.view = 'add';
      renderBeneAdd();
    });
  }

  bindBeneCards();
}

function renderBeneCard(b, isInactive){
  const avatarContent = b.profile_photo_data
    ? '<img src="' + b.profile_photo_data + '" alt="">'
    : beneCatIcon(b.category);

  const metaParts = [];
  const ga = beneGenderAge(b);
  if (ga) metaParts.push(escHtml(ga));
  if (b.mobile) metaParts.push('📱 ' + escHtml(b.mobile));
  if (b.aadhaar_number) metaParts.push('ID: ' + escHtml(maskAadhaarBene(b.aadhaar_number)));
  if (isInactive && b.inactive_reason) metaParts.push('⚠ ' + escHtml(b.inactive_reason));

  return `
    <button class="bene-card ${isInactive ? 'inactive' : ''}" data-id="${b.id}">
      <div class="bene-avatar">${avatarContent}</div>
      <div class="bene-info">
        <div class="bene-name">${escHtml(b.full_name)}</div>
        <div class="bene-meta">${metaParts.join('')}</div>
        <div class="bene-meta" style="margin-top:4px;">
          <span class="bene-status">${isInactive ? 'Inactive' : '● Active'}</span>
          <span>${escHtml(beneCatLabel(b.category))}</span>
        </div>
      </div>
      <div class="bene-arrow">›</div>
      <div class="bene-id-badge">#${b.beneficiary_unique_id}</div>
    </button>
  `;
}

function renderBeneEmpty(isInactive){
  return `
    <div class="empty-state">
      <div class="empty-icon">${isInactive ? '🗂️' : '🤱'}</div>
      <div class="empty-title">${isInactive ? 'No inactive beneficiaries found.' : 'No beneficiaries found.'}</div>
      <div class="empty-sub">${BeneficiariesMenu.category ? 'इस category में कोई record नहीं' : (isInactive ? '' : 'नीचे दिए + बटन से नया जोड़ें')}</div>
    </div>
  `;
}

function bindBeneCards(){
  document.querySelectorAll('.bene-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      BeneficiariesMenu.view = 'detail';
      beneLoadDetail(id).then(renderBeneDetail).catch(e => showToast(e.message, 'error'));
    });
  });
}


/* ==================== RENDER: ADD BENEFICIARY ==================== */
function renderBeneAdd(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="bene-header">
      <div>
        <h2>Add Beneficiary</h2>
        <div class="sub">Active Beneficiaries</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="bene-main">
      <div class="bene-form">
        <form id="beneAddForm">

          <div class="detail-section-title">Basic Information</div>
          <div class="bene-grid">
            <div class="family-field">
              <label for="category">Category <span class="req">*</span></label>
              <select id="category" required>
                <option value="">-- Select Category --</option>
                ${BENE_CATEGORIES.map(c => `<option value="${c.code}">${c.label}</option>`).join('')}
              </select>
            </div>
            <div class="family-field">
              <label for="fullName">Full Name <span class="req">*</span></label>
              <input type="text" id="fullName" required autofocus>
            </div>
            <div class="family-field">
              <label for="gender">Gender</label>
              <select id="gender">
                <option value="">Select</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
              <div class="hint" id="genderHint" style="display:none;color:var(--b-coral);">Pregnant/Lactating में Female ही allowed है।</div>
            </div>
            <div class="family-field">
              <label for="dob">Date of Birth</label>
              <input type="date" id="dob">
              <div class="hint" id="agePreview">Age: —</div>
            </div>
            <div class="family-field">
              <label for="fatherName">Father's Name</label>
              <input type="text" id="fatherName">
            </div>
            <div class="family-field">
              <label for="motherName">Mother's Name</label>
              <input type="text" id="motherName">
            </div>
            <div class="family-field" id="husbandNameWrap" style="display:none;">
              <label for="husbandName">Husband Name</label>
              <input type="text" id="husbandName">
            </div>
            <div class="family-field">
              <label for="houseNumber">House Number</label>
              <input type="text" id="houseNumber">
            </div>
            <div class="family-field">
              <label for="religion">Religion</label>
              <select id="religion">
                <option value="">Select</option>
                <option value="HINDU">Hindu</option>
                <option value="MUSLIM">Muslim</option>
                <option value="SIKH">Sikh</option>
                <option value="CHRISTIAN">Christian</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div class="family-field">
              <label for="mobile">Mobile</label>
              <input type="text" id="mobile" inputmode="numeric" maxlength="10">
            </div>
            <div class="family-field">
              <label for="altMobile">Alternate Mobile</label>
              <input type="text" id="altMobile" inputmode="numeric" maxlength="10">
            </div>
          </div>

          <div class="detail-section-title">Identity</div>
          <div class="bene-grid">
            <div class="family-field">
              <label for="aadhaar">Aadhaar Number</label>
              <input type="text" id="aadhaar" inputmode="numeric" maxlength="14" placeholder="XXXX-XXXX-XXXX">
            </div>
            <div class="family-field">
              <label for="janAadhaar">Jan Aadhaar</label>
              <input type="text" id="janAadhaar">
            </div>
            <div class="family-field">
              <label for="fatherAadhaar">Father's Aadhaar</label>
              <input type="text" id="fatherAadhaar" inputmode="numeric" maxlength="14" placeholder="XXXX-XXXX-XXXX">
            </div>
            <div class="family-field">
              <label for="motherAadhaar">Mother's Aadhaar</label>
              <input type="text" id="motherAadhaar" inputmode="numeric" maxlength="14" placeholder="XXXX-XXXX-XXXX">
            </div>
            <div class="family-field">
              <label for="abhaId">ABHA ID</label>
              <input type="text" id="abhaId">
            </div>
            <div class="family-field" id="apaarWrap" style="display:none;">
              <label for="apaarId">APAAR ID</label>
              <input type="text" id="apaarId">
              <div class="hint">केवल Children 3-6 Years के लिए</div>
            </div>
          </div>

          <div class="detail-section-title" id="pregnancySection" style="display:none;">Pregnancy Information</div>
          <div class="bene-grid" id="pregnancyFields" style="display:none;">
            <div class="family-field">
              <label for="lmpDate">LMP Date</label>
              <input type="date" id="lmpDate">
            </div>
            <div class="family-field">
              <label for="eddDate">EDD Date</label>
              <input type="date" id="eddDate">
              <div class="hint">LMP + 280 दिन (auto)</div>
            </div>
            <div class="family-field">
              <label for="deliveryDate">Delivery Date</label>
              <input type="date" id="deliveryDate">
              <div class="hint">Lactating में जाने के लिए ज़रूरी</div>
            </div>
            <div class="family-field">
              <label>Pregnancy Month</label>
              <div class="locked-field" style="min-height:46px;">
                <span class="lock-value" id="pregMonthVal">—</span>
              </div>
            </div>
          </div>

          <div class="detail-section-title" id="lactationSection" style="display:none;">Lactation Information</div>
          <div class="bene-grid" id="lactationFields" style="display:none;">
            <div class="family-field">
              <label for="lactDeliveryDate">Delivery Date</label>
              <input type="date" id="lactDeliveryDate">
            </div>
          </div>

          <div class="detail-section-title">Other Information</div>
          <div class="bene-grid">
            <div class="family-field">
              <label for="entryReason">Entry Reason</label>
              <select id="entryReason">
                <option value="">Select</option>
                <option value="New Registration">New Registration</option>
                <option value="Transfer">Transfer</option>
                <option value="Re-entry">Re-entry</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="family-field">
              <label for="effectiveDate">Effective Date <span class="req">*</span></label>
              <input type="date" id="effectiveDate" required>
            </div>

            <div class="bene-photo-row">
              <div class="bene-photo-preview" id="photoPreview">👤</div>
              <div class="bene-photo-actions">
                <label for="photoInput">Profile Photo (optional)</label>
                <input type="file" id="photoInput" accept="image/*">
                <button type="button" class="family-btn family-btn-secondary family-btn-sm" id="clearPhotoBtn" style="display:none;margin-top:6px;align-self:flex-start;">Remove Photo</button>
                <div class="hint" id="photoStatus"></div>
              </div>
            </div>
          </div>

          <div id="formError" class="login-error" style="display:none;margin-top:14px;"></div>
          <div class="family-form-actions">
            <button type="button" class="family-btn family-btn-secondary" id="cancelBtn">Cancel</button>
            <button type="submit" class="family-btn family-btn-primary">Add Beneficiary</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // ==================== FORM EVENTS ====================
  const categorySel = document.getElementById('category');
  const genderSel = document.getElementById('gender');
  const genderHint = document.getElementById('genderHint');
  const husbandNameWrap = document.getElementById('husbandNameWrap');
  const apaarWrap = document.getElementById('apaarWrap');
  const pregSection = document.getElementById('pregnancySection');
  const pregFields = document.getElementById('pregnancyFields');
  const lactSection = document.getElementById('lactationSection');
  const lactFields = document.getElementById('lactationFields');
  const effDate = document.getElementById('effectiveDate');
  effDate.value = BeneficiariesMenu.today || new Date().toISOString().slice(0,10);

  function updateCategoryUI(){
    const cat = categorySel.value;
    // Reset
    husbandNameWrap.style.display = 'none';
    apaarWrap.style.display = 'none';
    pregSection.style.display = 'none';
    pregFields.style.display = 'none';
    lactSection.style.display = 'none';
    lactFields.style.display = 'none';
    genderHint.style.display = 'none';
    genderSel.disabled = false;

    if (cat === 'PREGNANT') {
      husbandNameWrap.style.display = 'flex';
      pregSection.style.display = 'block';
      pregFields.style.display = 'grid';
      genderSel.value = 'FEMALE';
      genderSel.disabled = true;
      genderHint.style.display = 'block';
    } else if (cat === 'LACTATING') {
      husbandNameWrap.style.display = 'flex';
      lactSection.style.display = 'block';
      lactFields.style.display = 'grid';
      genderSel.value = 'FEMALE';
      genderSel.disabled = true;
      genderHint.style.display = 'block';
    } else if (cat === 'CHILD_0_6' || cat === 'CHILD_6_36' || cat === 'CHILD_36_72') {
      // Child - husband not applicable
      if (cat === 'CHILD_36_72') {
        apaarWrap.style.display = 'flex';
      }
    }
  }
  categorySel.addEventListener('change', updateCategoryUI);

  // ==================== PREGNANCY CALC ====================
  const lmpInput = document.getElementById('lmpDate');
  const eddInput = document.getElementById('eddDate');
  const pregMonthVal = document.getElementById('pregMonthVal');

  function addDays(dateStr, days){
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  }
  function diffDays(a, b){
    const d1 = new Date(a + 'T00:00:00');
    const d2 = new Date(b + 'T00:00:00');
    return Math.floor((d2 - d1) / 86400000);
  }
  function updatePregMonth(){
    const lmp = lmpInput.value;
    if (!lmp) { pregMonthVal.textContent = '—'; return; }
    const today = new Date().toISOString().slice(0,10);
    const days = diffDays(lmp, today);
    if (days < 0) { pregMonthVal.textContent = '—'; return; }
    const month = Math.min(9, Math.floor(days / 30) + 1);
    if (month < 1) { pregMonthVal.textContent = '—'; return; }
    pregMonthVal.textContent = 'MONTH-' + String(month).padStart(2, '0');
  }
  lmpInput.addEventListener('change', () => {
    if (lmpInput.value && !eddInput.value) eddInput.value = addDays(lmpInput.value, 280);
    updatePregMonth();
  });
  eddInput.addEventListener('change', () => {
    if (eddInput.value && !lmpInput.value) lmpInput.value = addDays(eddInput.value, -280);
    updatePregMonth();
  });

  // ==================== DOB AGE ====================
  document.getElementById('dob').addEventListener('change', (e) => {
    document.getElementById('agePreview').textContent = 'Age: ' + calcAge(e.target.value);
  });

  // ==================== AADHAAR FORMAT ====================
  function formatAadhaarInput(el){
    el.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 12);
      if (v.length > 8) v = v.slice(0, 4) + '-' + v.slice(4, 8) + '-' + v.slice(8);
      else if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
      e.target.value = v;
    });
  }
  formatAadhaarInput(document.getElementById('aadhaar'));
  formatAadhaarInput(document.getElementById('fatherAadhaar'));
  formatAadhaarInput(document.getElementById('motherAadhaar'));

  // ==================== PHOTO ====================
  let photoData = null;
  const photoInput = document.getElementById('photoInput');
  const photoPreview = document.getElementById('photoPreview');
  const clearPhotoBtn = document.getElementById('clearPhotoBtn');
  const photoStatus = document.getElementById('photoStatus');

  photoInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      photoStatus.textContent = 'Photo is too large. Max 2 MB.';
      photoStatus.style.color = 'var(--b-coral)';
      photoInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      photoData = ev.target.result;
      photoPreview.innerHTML = '<img src="' + photoData + '" alt="">';
      clearPhotoBtn.style.display = 'inline-flex';
      photoStatus.textContent = '✓ Photo ready';
      photoStatus.style.color = 'var(--b-green)';
    };
    reader.readAsDataURL(f);
  });
  clearPhotoBtn.addEventListener('click', () => {
    photoData = null;
    photoInput.value = '';
    photoPreview.innerHTML = '👤';
    clearPhotoBtn.style.display = 'none';
    photoStatus.textContent = '';
  });

  // ==================== NAVIGATION ====================
  document.getElementById('backBtn').addEventListener('click', () => {
    BeneficiariesMenu.view = 'dashboard';
    BeneMenuGoBack();
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    BeneficiariesMenu.view = 'dashboard';
    BeneMenuGoBack();
  });

  function BeneMenuGoBack(){
    beneLoadList().then(renderBeneDashboard).catch(e => showToast(e.message, 'error'));
  }

  // ==================== SUBMIT ====================
  document.getElementById('beneAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('formError');
    errDiv.style.display = 'none';

    const cat = categorySel.value;
    const name = document.getElementById('fullName').value.trim();
    const gender = genderSel.value;
    const aadhaar = document.getElementById('aadhaar').value.replace(/\D/g, '');
    const mobile = document.getElementById('mobile').value.trim();
    const altMobile = document.getElementById('altMobile').value.trim();
    const eff = effDate.value;
    const janAadhaar = document.getElementById('janAadhaar').value.trim();

    if (!cat) { errDiv.textContent = 'Category ज़रूरी है।'; errDiv.style.display = 'block'; return; }
    if (!name) { errDiv.textContent = 'Name ज़रूरी है।'; errDiv.style.display = 'block'; return; }
    if (!eff) { errDiv.textContent = 'Effective Date ज़रूरी है।'; errDiv.style.display = 'block'; return; }
    if (aadhaar && aadhaar.length !== 12) { errDiv.textContent = 'Aadhaar 12 अंकों का होना चाहिए।'; errDiv.style.display = 'block'; return; }
    if (mobile && !/^\d{10}$/.test(mobile)) { errDiv.textContent = 'Mobile number must be 10 digits.'; errDiv.style.display = 'block'; return; }
    if (altMobile && !/^\d{10}$/.test(altMobile)) { errDiv.textContent = 'Alternate mobile must be 10 digits.'; errDiv.style.display = 'block'; return; }
    if (mobile && altMobile && mobile === altMobile) { errDiv.textContent = 'Alternate mobile must be different from primary mobile.'; errDiv.style.display = 'block'; return; }

    // Jan Aadhaar duplicate warning
    if (janAadhaar) {
      try {
        const chk = await api('/api/admin/beneficiaries/check-jan-aadhaar?jan=' + encodeURIComponent(janAadhaar));
        if (chk && chk.exists) {
          const ok = await beneShowWarning(
            'Jan Aadhaar already exists in ' + chk.name + ' (' + chk.category + '). Do you want to continue?',
            'Continue',
            'Cancel'
          );
          if (!ok) return;
        }
      } catch (e) { /* ignore */ }
    }

    const payload = {
      category: cat,
      full_name: name,
      gender: gender || null,
      date_of_birth: document.getElementById('dob').value || null,
      father_name: document.getElementById('fatherName').value.trim() || null,
      mother_name: document.getElementById('motherName').value.trim() || null,
      husband_name: document.getElementById('husbandName').value.trim() || null,
      house_number: document.getElementById('houseNumber').value.trim() || null,
      religion: document.getElementById('religion').value || null,
      mobile: mobile || null,
      alternate_mobile: altMobile || null,
      aadhaar_number: aadhaar || null,
      jan_aadhaar_number: janAadhaar || null,
      father_aadhaar_number: document.getElementById('fatherAadhaar').value.replace(/\D/g, '') || null,
      mother_aadhaar_number: document.getElementById('motherAadhaar').value.replace(/\D/g, '') || null,
      abha_id: document.getElementById('abhaId').value.trim() || null,
      apaar_id: document.getElementById('apaarId').value.trim() || null,
      lmp_date: lmpInput.value || null,
      edd_date: eddInput.value || null,
      delivery_date: (document.getElementById('deliveryDate').value || document.getElementById('lactDeliveryDate').value) || null,
      entry_reason: document.getElementById('entryReason').value || null,
      effective_date: eff,
      profile_photo_data: photoData
    };

    try {
      await api('/api/admin/beneficiaries', { method: 'POST', body: payload });
      showToast('Beneficiary added successfully.', 'success');
      BeneficiariesMenu.view = 'dashboard';
      beneLoadList().then(renderBeneDashboard).catch(e => showToast(e.message, 'error'));
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}

/* ==================== WARNING MODAL ==================== */
function beneShowWarning(message, okText, cancelText){
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'bene-modal-backdrop';
    backdrop.innerHTML = `
      <div class="bene-modal">
        <div class="warn-icon">⚠️</div>
        <h3>Warning</h3>
        <p>${escHtml(message)}</p>
        <div class="bene-modal-actions">
          <button class="family-btn family-btn-secondary" id="warnCancel">${escHtml(cancelText || 'Cancel')}</button>
          <button class="family-btn family-btn-primary" id="warnOk">${escHtml(okText || 'Continue')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#warnCancel').addEventListener('click', () => {
      document.body.removeChild(backdrop);
      resolve(false);
    });
    backdrop.querySelector('#warnOk').addEventListener('click', () => {
      document.body.removeChild(backdrop);
      resolve(true);
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) { document.body.removeChild(backdrop); resolve(false); }
    });
  });
}


/* ==================== RENDER: BENEFICIARY DETAIL (Locked) ==================== */
function renderBeneDetail(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const b = BeneficiariesMenu.selected;
  if (!b) { renderBeneDashboard(); return; }

  const isInactive = !b.is_active;
  const avatarContent = b.profile_photo_data
    ? '<img src="' + b.profile_photo_data + '" alt="">'
    : beneCatIcon(b.category);

  const age = b.date_of_birth ? calcAge(b.date_of_birth) : '—';

  // Preg month calc
  let pregMonth = '—';
  if (b.lmp_date) {
    const days = Math.floor((new Date() - new Date(b.lmp_date)) / 86400000);
    if (days >= 0) {
      const m = Math.min(9, Math.floor(days / 30) + 1);
      if (m >= 1) pregMonth = 'MONTH-' + String(m).padStart(2, '0');
    }
  }

  root.innerHTML = `
    <div class="bene-header">
      <div>
        <h2>Beneficiary Detail</h2>
        <div class="sub">${escHtml(beneCatLabel(b.category))}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="bene-main">

      <div class="bene-detail">
        <div class="bene-profile-head">
          <div class="bene-profile-avatar">${avatarContent}</div>
          <div class="bene-profile-info">
            <h2>${escHtml(b.full_name)}</h2>
            <div class="profile-meta">
              <span>${escHtml(b.gender || '—')}</span>
              <span>Age: ${escHtml(age)}</span>
              <span>Added: ${fmtBeneDate(b.added_at || b.created_at)}</span>
              <span>Effective: ${fmtBeneDate(b.effective_date)}</span>
            </div>
            <div class="profile-id ${isInactive ? 'inactive' : ''}">ID #${b.beneficiary_unique_id}</div>
          </div>
        </div>

        ${isInactive ? `
          <div style="background:#fff4e5;border:1px solid #f5d8a8;border-radius:12px;padding:12px 14px;margin-bottom:14px;">
            <div style="font-size:13px;font-weight:800;color:#8a5a00;margin-bottom:4px;">⚠ Inactive Record</div>
            <div style="font-size:13px;color:#8a5a00;line-height:1.5;">
              <b>Reason:</b> ${escHtml(b.inactive_reason || '—')}<br>
              <b>Effective Date:</b> ${fmtBeneDate(b.inactive_effective_date)}<br>
              <b>Inactivated At:</b> ${fmtBeneDate(b.inactive_at)}<br>
              <b>Type:</b> ${escHtml(b.inactive_type || 'MANUAL')}
            </div>
          </div>
        ` : ''}

        ${!isInactive ? `
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="family-btn family-btn-primary" id="editBtn">✎ Edit Beneficiary</button>
            ${b.category === 'PREGNANT' ? '<button class="family-btn family-btn-primary" id="moveBtn" style="background:#7568e8;">→ Move Category</button>' : ''}
            ${b.category === 'CHILD_0_6' ? '<button class="family-btn family-btn-primary" id="moveBtn" style="background:#7568e8;">→ Move to 6M-3Y</button>' : ''}
            ${b.category === 'CHILD_6_36' ? '<button class="family-btn family-btn-primary" id="moveBtn" style="background:#7568e8;">→ Move to 3-6Y</button>' : ''}
            ${b.category === 'LACTATING' ? '<button class="family-btn family-btn-primary" id="addBabyBtn" style="background:#59bd63;">+ Add Baby</button>' : ''}
            <button class="family-btn family-btn-danger" id="inactiveBtn">🗑 Move to Inactive</button>
          </div>
        ` : ''}
      </div>

      <div class="bene-info-section">
        <h3>Basic Information</h3>
        <div class="bene-kv">
          ${beneKV('Name', b.full_name)}
          ${beneKV('Aadhaar', maskAadhaarBene(b.aadhaar_number))}
          ${beneKV("Father's Name", b.father_name)}
          ${beneKV("Mother's Name", b.mother_name)}
          ${b.husband_name ? beneKV('Husband Name', b.husband_name) : ''}
          ${beneKV('Gender', b.gender)}
          ${beneKV('Date of Birth', fmtBeneDate(b.date_of_birth))}
          ${beneKV('Age', age)}
          ${beneKV('House Number', b.house_number)}
        </div>
      </div>

      <div class="bene-info-section">
        <h3>Additional Information</h3>
        <div class="bene-kv">
          ${beneKV('Category', beneCatLabel(b.category))}
          ${beneKV('Religion', b.religion)}
          ${beneKV('Mobile', b.mobile)}
          ${beneKV('Alternate Mobile', b.alternate_mobile)}
          ${beneKV("Father's Aadhaar", maskAadhaarBene(b.father_aadhaar_number))}
          ${beneKV("Mother's Aadhaar", maskAadhaarBene(b.mother_aadhaar_number))}
          ${beneKV('Jan Aadhaar', b.jan_aadhaar_number)}
          ${beneKV('ABHA ID', b.abha_id)}
          ${b.apaar_id ? beneKV('APAAR ID', b.apaar_id) : ''}
          ${beneKV('Entry Reason', b.entry_reason)}
          ${beneKV('Effective Date', fmtBeneDate(b.effective_date))}
          ${beneKV('Unique ID', '#' + b.beneficiary_unique_id, true)}
        </div>
      </div>

      ${b.category === 'PREGNANT' ? `
        <div class="bene-info-section">
          <h3>Pregnancy Information</h3>
          <div class="bene-kv">
            ${beneKV('LMP', fmtBeneDate(b.lmp_date))}
            ${beneKV('EDD', fmtBeneDate(b.edd_date))}
            ${beneKV('Pregnancy Month', pregMonth)}
            ${beneKV('Delivery Date', fmtBeneDate(b.delivery_date))}
          </div>
        </div>
      ` : ''}

      ${b.category === 'LACTATING' ? `
        <div class="bene-info-section">
          <h3>Lactation Information</h3>
          <div class="bene-kv">
            ${beneKV('Delivery Date', fmtBeneDate(b.delivery_date))}
          </div>
        </div>
      ` : ''}

      <div class="bene-info-section">
        <h3>Activity Logs</h3>
        <div class="bene-logs">
          ${BeneficiariesMenu.selectedLogs.length
            ? BeneficiariesMenu.selectedLogs.map(l => renderBeneLog(l)).join('')
            : '<p style="color:var(--b-muted);font-size:13px;margin:8px 0;">No logs yet.</p>'}
        </div>
      </div>

    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    BeneficiariesMenu.view = 'dashboard';
    BeneficiariesMenu.selected = null;
    beneLoadList().then(renderBeneDashboard).catch(e => showToast(e.message, 'error'));
  });

  const editBtn = document.getElementById('editBtn');
  if (editBtn) editBtn.addEventListener('click', () => {
    BeneficiariesMenu.view = 'edit';
    renderBeneEdit();
  });

  const moveBtn = document.getElementById('moveBtn');
  if (moveBtn) moveBtn.addEventListener('click', () => showBeneMoveDialog());

  const addBabyBtn = document.getElementById('addBabyBtn');
  if (addBabyBtn) addBabyBtn.addEventListener('click', () => showBeneAddBabyDialog());

  const inactiveBtn = document.getElementById('inactiveBtn');
  if (inactiveBtn) inactiveBtn.addEventListener('click', () => showBeneInactiveDialog());
}

/* --- KV item helper --- */
function beneKV(label, value, mono){
  const empty = (value === null || value === undefined || value === '');
  return `
    <div class="bene-kv-item">
      <span class="kv-label">${escHtml(label)}</span>
      <span class="kv-value ${mono ? 'mono' : ''}">${escHtml(empty ? '—' : value)}</span>
    </div>
  `;
}

/* ==================== LOG RENDER ==================== */
function renderBeneLog(log){
  const icons = {
    'ADD': '➕',
    'EDIT': '✎',
    'MOVE_CATEGORY': '🔄',
    'INACTIVE': '⏸'
  };
  const labels = {
    'ADD': 'Added',
    'EDIT': 'Edited',
    'MOVE_CATEGORY': 'Category Moved',
    'INACTIVE': 'Moved to Inactive'
  };
  const icon = icons[log.log_type] || '•';
  const label = labels[log.log_type] || log.log_type;

  let changesHtml = '';
  if (log.log_type === 'EDIT' && log.old_values) {
    try {
      const oldV = JSON.parse(log.old_values);
      const rows = [];
      Object.keys(oldV).forEach(k => {
        const e = oldV[k];
        if (!e || typeof e !== 'object') return;
        const label2 = BENE_FIELD_LABELS[k] || k;
        const o = maskLogVal(k, e.old);
        const n = maskLogVal(k, e.new);
        if (String(o) === String(n)) return;
        rows.push(`<div class="chg"><b>${escHtml(label2)}:</b> <span class="old">${escHtml(o)}</span> <span class="arrow">→</span> <span class="new">${escHtml(n)}</span></div>`);
      });
      if (rows.length) {
        changesHtml = `<details><summary>Changes देखें (${rows.length})</summary><div class="bene-log-changes">${rows.join('')}</div></details>`;
      }
    } catch (e) {}
  } else if (log.log_type === 'MOVE_CATEGORY' && log.old_values && log.new_values) {
    try {
      const o = JSON.parse(log.old_values);
      const n = JSON.parse(log.new_values);
      changesHtml = `<div class="bene-log-changes">
        <div class="chg"><b>Category:</b> <span class="old">${escHtml(beneCatLabel(o.category))}</span> <span class="arrow">→</span> <span class="new">${escHtml(beneCatLabel(n.category))}</span></div>
      </div>`;
    } catch (e) {}
  } else if (log.log_type === 'ADD' && log.new_values) {
    try {
      const nv = JSON.parse(log.new_values);
      const rows = [];
      Object.keys(nv).forEach(k => {
        const v = nv[k];
        if (v === null || v === undefined || v === '') return;
        const lab = BENE_FIELD_LABELS[k] || k;
        let val = v;
        if (k === 'category') val = beneCatLabel(v);
        rows.push(`<div class="chg"><b>${escHtml(lab)}:</b> <span class="new">${escHtml(maskLogVal(k, val))}</span></div>`);
      });
      if (rows.length) {
        changesHtml = `<details><summary>Details देखें (${rows.length})</summary><div class="bene-log-changes">${rows.join('')}</div></details>`;
      }
    } catch (e) {}
  }

  const eff = log.effective_date ? `<div class="bene-log-effective">📅 Effective: ${fmtBeneDate(log.effective_date)}</div>` : '';
  const reason = log.reason ? `<div style="margin-top:3px;font-style:italic;">Reason: ${escHtml(log.reason)}</div>` : '';
  const user = log.created_by_username ? `<div class="bene-log-user">👤 ${escHtml(log.created_by_username)}</div>` : '';

  return `
    <div class="bene-log-item">
      <div class="bene-log-head">
        <span class="log-action">${icon} ${escHtml(label)}</span>
        <span class="bene-log-date">${fmtDateTime(log.created_at)}</span>
      </div>
      <div class="bene-log-body">
        ${user}
        ${reason}
        ${eff}
        ${changesHtml}
      </div>
    </div>
  `;
}

function maskLogVal(key, v){
  if (v === null || v === undefined || v === '') return '—';
  const s = String(v);
  if (key === 'aadhaar_number' && s.length >= 12) return 'XXXX-XXXX-' + s.slice(-4);
  if (key === 'father_aadhaar_number' && s.length >= 12) return 'XXXX-XXXX-' + s.slice(-4);
  if (key === 'mother_aadhaar_number' && s.length >= 12) return 'XXXX-XXXX-' + s.slice(-4);
  if (key === 'jan_aadhaar_number' && s.length > 4) return s.slice(0, 2) + 'XXXX' + s.slice(-2);
  return s;
}


/* ==================== RENDER: EDIT BENEFICIARY ==================== */
function renderBeneEdit(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const b = BeneficiariesMenu.selected;
  if (!b) { renderBeneDashboard(); return; }

  root.innerHTML = `
    <div class="bene-header">
      <div>
        <h2>Edit Beneficiary</h2>
        <div class="sub">#${b.beneficiary_unique_id} · ${escHtml(beneCatLabel(b.category))}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="bene-main">
      <div class="bene-form">
        <form id="beneEditForm">

          <div class="detail-section-title">Basic Information</div>
          <div class="bene-grid">
            <div class="family-field">
              <label>Category</label>
              <div class="locked-field" style="min-height:46px;">
                <span class="lock-value">${escHtml(beneCatLabel(b.category))}</span>
              </div>
              <div class="hint">Category बदलने के लिए "Move Category" use करें।</div>
            </div>
            <div class="family-field">
              <label for="fullName">Full Name <span class="req">*</span></label>
              <input type="text" id="fullName" value="${escHtml(b.full_name)}" required autofocus>
            </div>
            <div class="family-field">
              <label for="gender">Gender</label>
              <select id="gender" ${b.category === 'PREGNANT' || b.category === 'LACTATING' ? 'disabled' : ''}>
                <option value="">Select</option>
                <option value="MALE" ${b.gender === 'MALE' ? 'selected' : ''}>Male</option>
                <option value="FEMALE" ${b.gender === 'FEMALE' ? 'selected' : ''}>Female</option>
                <option value="OTHER" ${b.gender === 'OTHER' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div class="family-field">
              <label for="dob">Date of Birth</label>
              <input type="date" id="dob" value="${escHtml(b.date_of_birth || '')}">
              <div class="hint" id="agePreview">Age: ${calcAge(b.date_of_birth)}</div>
            </div>
            <div class="family-field">
              <label for="fatherName">Father's Name</label>
              <input type="text" id="fatherName" value="${escHtml(b.father_name || '')}">
            </div>
            <div class="family-field">
              <label for="motherName">Mother's Name</label>
              <input type="text" id="motherName" value="${escHtml(b.mother_name || '')}">
            </div>
            ${b.category === 'PREGNANT' || b.category === 'LACTATING' ? `
              <div class="family-field">
                <label for="husbandName">Husband Name</label>
                <input type="text" id="husbandName" value="${escHtml(b.husband_name || '')}">
              </div>
            ` : ''}
            <div class="family-field">
              <label for="houseNumber">House Number</label>
              <input type="text" id="houseNumber" value="${escHtml(b.house_number || '')}">
            </div>
            <div class="family-field">
              <label for="religion">Religion</label>
              <select id="religion">
                <option value="">Select</option>
                <option value="HINDU" ${b.religion === 'HINDU' ? 'selected' : ''}>Hindu</option>
                <option value="MUSLIM" ${b.religion === 'MUSLIM' ? 'selected' : ''}>Muslim</option>
                <option value="SIKH" ${b.religion === 'SIKH' ? 'selected' : ''}>Sikh</option>
                <option value="CHRISTIAN" ${b.religion === 'CHRISTIAN' ? 'selected' : ''}>Christian</option>
                <option value="OTHER" ${b.religion === 'OTHER' ? 'selected' : ''}>Other</option>
              </select>
            </div>
            <div class="family-field">
              <label for="mobile">Mobile</label>
              <input type="text" id="mobile" inputmode="numeric" maxlength="10" value="${escHtml(b.mobile || '')}">
            </div>
            <div class="family-field">
              <label for="altMobile">Alternate Mobile</label>
              <input type="text" id="altMobile" inputmode="numeric" maxlength="10" value="${escHtml(b.alternate_mobile || '')}">
            </div>
          </div>

          <div class="detail-section-title">Identity</div>
          <div class="bene-grid">
            <div class="family-field">
              <label for="aadhaar">Aadhaar Number</label>
              <input type="text" id="aadhaar" inputmode="numeric" maxlength="14" value="${escHtml(b.aadhaar_number || '')}" placeholder="XXXX-XXXX-XXXX">
            </div>
            <div class="family-field">
              <label for="janAadhaar">Jan Aadhaar</label>
              <input type="text" id="janAadhaar" value="${escHtml(b.jan_aadhaar_number || '')}">
            </div>
            <div class="family-field">
              <label for="fatherAadhaar">Father's Aadhaar</label>
              <input type="text" id="fatherAadhaar" inputmode="numeric" maxlength="14" value="${escHtml(b.father_aadhaar_number || '')}">
            </div>
            <div class="family-field">
              <label for="motherAadhaar">Mother's Aadhaar</label>
              <input type="text" id="motherAadhaar" inputmode="numeric" maxlength="14" value="${escHtml(b.mother_aadhaar_number || '')}">
            </div>
            <div class="family-field">
              <label for="abhaId">ABHA ID</label>
              <input type="text" id="abhaId" value="${escHtml(b.abha_id || '')}">
            </div>
            ${b.category === 'CHILD_36_72' ? `
              <div class="family-field">
                <label for="apaarId">APAAR ID</label>
                <input type="text" id="apaarId" value="${escHtml(b.apaar_id || '')}">
              </div>
            ` : ''}
          </div>

          ${b.category === 'PREGNANT' ? `
            <div class="detail-section-title">Pregnancy Information</div>
            <div class="bene-grid">
              <div class="family-field">
                <label for="lmpDate">LMP Date</label>
                <input type="date" id="lmpDate" value="${escHtml(b.lmp_date || '')}">
              </div>
              <div class="family-field">
                <label for="eddDate">EDD Date</label>
                <input type="date" id="eddDate" value="${escHtml(b.edd_date || '')}">
              </div>
              <div class="family-field">
                <label for="deliveryDate">Delivery Date</label>
                <input type="date" id="deliveryDate" value="${escHtml(b.delivery_date || '')}">
              </div>
            </div>
          ` : ''}

          ${b.category === 'LACTATING' ? `
            <div class="detail-section-title">Lactation Information</div>
            <div class="bene-grid">
              <div class="family-field">
                <label for="deliveryDate">Delivery Date</label>
                <input type="date" id="deliveryDate" value="${escHtml(b.delivery_date || '')}">
              </div>
            </div>
          ` : ''}

          <div class="detail-section-title">Other Information</div>
          <div class="bene-grid">
            <div class="family-field">
              <label for="entryReason">Entry Reason</label>
              <input type="text" id="entryReason" value="${escHtml(b.entry_reason || '')}">
            </div>
            <div class="family-field">
              <label for="effectiveDate">Effective Date <span class="req">*</span></label>
              <input type="date" id="effectiveDate" value="${escHtml(b.effective_date || '')}" required>
            </div>

            <div class="bene-photo-row">
              <div class="bene-photo-preview" id="editPhotoPreview">${b.profile_photo_data ? '<img src="' + b.profile_photo_data + '" alt="">' : '👤'}</div>
              <div class="bene-photo-actions">
                <label for="editPhotoInput">Profile Photo (optional)</label>
                <input type="file" id="editPhotoInput" accept="image/*">
                <button type="button" class="family-btn family-btn-secondary family-btn-sm" id="editClearPhotoBtn" style="display:${b.profile_photo_data ? 'inline-flex' : 'none'};margin-top:6px;align-self:flex-start;">Remove Photo</button>
                <div class="hint" id="editPhotoStatus"></div>
              </div>
            </div>
          </div>

          <div id="formError" class="login-error" style="display:none;margin-top:14px;"></div>
          <div class="family-form-actions">
            <button type="button" class="family-btn family-btn-secondary" id="cancelBtn">Cancel</button>
            <button type="submit" class="family-btn family-btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Aadhaar format helper
  function fmtAadhaar(el){
    el.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 12);
      if (v.length > 8) v = v.slice(0, 4) + '-' + v.slice(4, 8) + '-' + v.slice(8);
      else if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
      e.target.value = v;
    });
  }
  fmtAadhaar(document.getElementById('aadhaar'));
  fmtAadhaar(document.getElementById('fatherAadhaar'));
  fmtAadhaar(document.getElementById('motherAadhaar'));

  document.getElementById('dob').addEventListener('change', (e) => {
    document.getElementById('agePreview').textContent = 'Age: ' + calcAge(e.target.value);
  });

  // LMP/EDD auto
  const lmpEl = document.getElementById('lmpDate');
  const eddEl = document.getElementById('eddDate');
  function addDaysB(dateStr, days){
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0,10);
  }
  if (lmpEl) lmpEl.addEventListener('change', () => {
    if (lmpEl.value && eddEl && !eddEl.value) eddEl.value = addDaysB(lmpEl.value, 280);
  });
  if (eddEl) eddEl.addEventListener('change', () => {
    if (eddEl.value && lmpEl && !lmpEl.value) lmpEl.value = addDaysB(eddEl.value, -280);
  });

  document.getElementById('backBtn').addEventListener('click', () => {
    BeneficiariesMenu.view = 'detail';
    renderBeneDetail();
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    BeneficiariesMenu.view = 'detail';
    renderBeneDetail();
  });

  // ==================== EDIT PHOTO HANDLERS ====================
  let editPhotoData = b.profile_photo_data || null;
  const editPhotoInput = document.getElementById('editPhotoInput');
  const editPhotoPreview = document.getElementById('editPhotoPreview');
  const editClearPhotoBtn = document.getElementById('editClearPhotoBtn');
  const editPhotoStatus = document.getElementById('editPhotoStatus');

  if (editPhotoInput) {
    editPhotoInput.addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) {
        editPhotoStatus.textContent = 'Photo बहुत बड़ी है (max 2 MB)।';
        editPhotoStatus.style.color = 'var(--b-coral)';
        editPhotoInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        editPhotoData = ev.target.result;
        editPhotoPreview.innerHTML = '<img src="' + editPhotoData + '" alt="">';
        editClearPhotoBtn.style.display = 'inline-flex';
        editPhotoStatus.textContent = '✓ नई photo ready — Save दबाइए';
        editPhotoStatus.style.color = 'var(--b-green)';
      };
      reader.readAsDataURL(f);
    });

    editClearPhotoBtn.addEventListener('click', () => {
      editPhotoData = null;
      editPhotoInput.value = '';
      editPhotoPreview.innerHTML = '👤';
      editClearPhotoBtn.style.display = 'none';
      editPhotoStatus.textContent = 'Photo हटा दी गई — Save दबाइए';
      editPhotoStatus.style.color = 'var(--b-coral)';
    });
  }

  document.getElementById('beneEditForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('formError');
    errDiv.style.display = 'none';

    const name = document.getElementById('fullName').value.trim();
    if (!name) { errDiv.textContent = 'Name ज़रूरी है।'; errDiv.style.display = 'block'; return; }

    const mobile = document.getElementById('mobile').value.trim();
    const altMobile = document.getElementById('altMobile').value.trim();
    if (mobile && !/^\d{10}$/.test(mobile)) { errDiv.textContent = 'Mobile number must be 10 digits.'; errDiv.style.display = 'block'; return; }
    if (altMobile && !/^\d{10}$/.test(altMobile)) { errDiv.textContent = 'Alternate mobile must be 10 digits.'; errDiv.style.display = 'block'; return; }
    if (mobile && altMobile && mobile === altMobile) { errDiv.textContent = 'Alternate mobile must be different from primary mobile.'; errDiv.style.display = 'block'; return; }

    const payload = {
      full_name: name,
      gender: document.getElementById('gender').value || null,
      date_of_birth: document.getElementById('dob').value || null,
      father_name: document.getElementById('fatherName').value.trim() || null,
      mother_name: document.getElementById('motherName').value.trim() || null,
      husband_name: (document.getElementById('husbandName') || {}).value || null,
      house_number: document.getElementById('houseNumber').value.trim() || null,
      religion: document.getElementById('religion').value || null,
      mobile: mobile || null,
      alternate_mobile: altMobile || null,
      aadhaar_number: document.getElementById('aadhaar').value.replace(/\D/g, '') || null,
      jan_aadhaar_number: document.getElementById('janAadhaar').value.trim() || null,
      father_aadhaar_number: document.getElementById('fatherAadhaar').value.replace(/\D/g, '') || null,
      mother_aadhaar_number: document.getElementById('motherAadhaar').value.replace(/\D/g, '') || null,
      abha_id: document.getElementById('abhaId').value.trim() || null,
      apaar_id: (document.getElementById('apaarId') || {}).value || null,
      lmp_date: (lmpEl || {}).value || null,
      edd_date: (eddEl || {}).value || null,
      delivery_date: (document.getElementById('deliveryDate') || {}).value || null,
      entry_reason: document.getElementById('entryReason').value.trim() || null,
      effective_date: document.getElementById('effectiveDate').value,
      profile_photo_data: editPhotoData
    };

    try {
      const res = await api('/api/admin/beneficiaries/' + b.id, { method: 'PATCH', body: payload });
      if (res.changed === false) {
        showToast('No changes to save.', 'info');
      } else {
        showToast('Updated successfully.', 'success');
      }
      await beneLoadDetail(b.id);
      BeneficiariesMenu.view = 'detail';
      renderBeneDetail();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}


/* ==================== MODAL: MOVE CATEGORY ==================== */
function showBeneMoveDialog(){
  const b = BeneficiariesMenu.selected;
  if (!b) return;

  const allowedMap = {
    'PREGNANT': { target: 'LACTATING', label: 'Lactating Mothers', needsDelivery: true },
    'CHILD_0_6': { target: 'CHILD_6_36', label: 'Children 6 Months-3 Years', needsDelivery: false },
    'CHILD_6_36': { target: 'CHILD_36_72', label: 'Children 3-6 Years', needsDelivery: false }
  };
  const move = allowedMap[b.category];
  if (!move) { showToast('Movement not allowed from this category.', 'error'); return; }

  const today = BeneficiariesMenu.today || new Date().toISOString().slice(0,10);

  const backdrop = document.createElement('div');
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal">
      <h3>Move Category</h3>
      <p>
        The beneficiary will move from <b>${escHtml(beneCatLabel(b.category))}</b>
        to <b>${escHtml(move.label)}</b>.<br>
        The Beneficiary ID <b>#${b.beneficiary_unique_id}</b> will remain unchanged.
        The change will be recorded in the activity log.
      </p>

      ${move.needsDelivery ? `
        <div class="family-field">
          <label for="mvDelivery">Delivery Date <span class="req">*</span></label>
          <input type="date" id="mvDelivery" value="${escHtml(b.delivery_date || '')}">
          <div class="hint">Lactating Mothers में जाने के लिए Delivery Date ज़रूरी है।</div>
        </div>
      ` : ''}

      <div class="family-field">
        <label for="mvEffective">Effective Date <span class="req">*</span></label>
        <input type="date" id="mvEffective" value="${today}">
      </div>

      <div class="family-field">
        <label for="mvReason">Reason</label>
        <input type="text" id="mvReason" value="Category movement" placeholder="Reason (optional)">
      </div>

      <div id="mvError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="mvCancel">Cancel</button>
        <button class="family-btn family-btn-primary" id="mvOk">Move to ${escHtml(move.label)}</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#mvCancel').addEventListener('click', () => document.body.removeChild(backdrop));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) document.body.removeChild(backdrop); });

  backdrop.querySelector('#mvOk').addEventListener('click', async () => {
    const errEl = backdrop.querySelector('#mvError');
    errEl.style.display = 'none';
    const eff = backdrop.querySelector('#mvEffective').value;
    const reason = backdrop.querySelector('#mvReason').value.trim() || 'Category movement';
    if (!eff) { errEl.textContent = 'Effective Date ज़रूरी है।'; errEl.style.display = 'block'; return; }

    const payload = { new_category: move.target, effective_date: eff, reason: reason };
    if (move.needsDelivery) {
      const d = backdrop.querySelector('#mvDelivery').value;
      if (!d) { errEl.textContent = 'Delivery Date is required to move this beneficiary to Lactating Mothers.'; errEl.style.display = 'block'; return; }
      payload.delivery_date = d;
    }

    try {
      const res = await api('/api/admin/beneficiaries/' + b.id + '/move', { method: 'POST', body: payload });
      document.body.removeChild(backdrop);
      showToast(res.message || 'Beneficiary moved successfully.', 'success');
      await beneLoadDetail(b.id);
      BeneficiariesMenu.view = 'detail';
      renderBeneDetail();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}


/* ==================== MODAL: MOVE TO INACTIVE ==================== */
function showBeneInactiveDialog(){
  const b = BeneficiariesMenu.selected;
  if (!b) return;

  const today = BeneficiariesMenu.today || new Date().toISOString().slice(0,10);

  const backdrop = document.createElement('div');
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal">
      <div class="warn-icon">⏸</div>
      <h3>Move to Inactive</h3>
      <p>
        This beneficiary will be moved to Inactive.<br>
        The record and history will be retained.<br>
        <b>${escHtml(b.full_name)}</b> (#${b.beneficiary_unique_id})
      </p>

      <div class="family-field">
        <label for="inReason">Inactive Reason <span class="req">*</span></label>
        <input type="text" id="inReason" placeholder="Reason बताएँ (जैसे: Moved away, Completed)">
      </div>

      <div class="family-field">
        <label for="inEffective">Effective Date <span class="req">*</span></label>
        <input type="date" id="inEffective" value="${today}">
      </div>

      <div id="inError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="inCancel">Cancel</button>
        <button class="family-btn family-btn-danger" id="inOk">Move to Inactive</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#inCancel').addEventListener('click', () => document.body.removeChild(backdrop));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) document.body.removeChild(backdrop); });

  backdrop.querySelector('#inOk').addEventListener('click', async () => {
    const errEl = backdrop.querySelector('#inError');
    errEl.style.display = 'none';
    const reason = backdrop.querySelector('#inReason').value.trim();
    const eff = backdrop.querySelector('#inEffective').value;
    if (!reason) { errEl.textContent = 'Inactive Reason ज़रूरी है।'; errEl.style.display = 'block'; return; }
    if (!eff) { errEl.textContent = 'Effective Date ज़रूरी है।'; errEl.style.display = 'block'; return; }

    try {
      const res = await api('/api/admin/beneficiaries/' + b.id + '/delete', {
        method: 'POST',
        body: { reason: reason, effective_date: eff }
      });
      document.body.removeChild(backdrop);
      showToast(res.message || 'Beneficiary moved to Inactive.', 'success');
      BeneficiariesMenu.view = 'dashboard';
      BeneficiariesMenu.selected = null;
      beneLoadList().then(renderBeneDashboard).catch(e => showToast(e.message, 'error'));
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}


/* ==================== MODAL: ADD BABY (Lactating) ==================== */
function showBeneAddBabyDialog(){
  const b = BeneficiariesMenu.selected;
  if (!b) return;

  const today = BeneficiariesMenu.today || new Date().toISOString().slice(0,10);

  const backdrop = document.createElement('div');
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal">
      <h3>Add Baby</h3>
      <p>
        Baby of <b>${escHtml(b.full_name)}</b> (#${b.beneficiary_unique_id})<br>
        नया baby एक अलग beneficiary के रूप में बनेगा (Category: Children 0-6 Months)।
      </p>

      <div class="family-field">
        <label for="babyName">Baby Name <span class="req">*</span></label>
        <input type="text" id="babyName" autofocus>
      </div>

      <div class="family-field">
        <label for="babyGender">Gender</label>
        <select id="babyGender">
          <option value="">Select</option>
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      <div class="family-field">
        <label for="babyDob">Date of Birth <span class="req">*</span></label>
        <input type="date" id="babyDob" value="${escHtml(b.delivery_date || '')}">
      </div>

      <div class="family-field">
        <label for="babyAadhaar">Aadhaar (optional)</label>
        <input type="text" id="babyAadhaar" inputmode="numeric" maxlength="14" placeholder="XXXX-XXXX-XXXX">
      </div>

      <div class="family-field">
        <label for="babyEffective">Effective Date <span class="req">*</span></label>
        <input type="date" id="babyEffective" value="${today}">
      </div>

      <div id="babyError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="babyCancel">Cancel</button>
        <button class="family-btn family-btn-primary" id="babyOk">Add Baby</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  const aadhaarIn = backdrop.querySelector('#babyAadhaar');
  aadhaarIn.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 12);
    if (v.length > 8) v = v.slice(0, 4) + '-' + v.slice(4, 8) + '-' + v.slice(8);
    else if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
    e.target.value = v;
  });

  backdrop.querySelector('#babyCancel').addEventListener('click', () => document.body.removeChild(backdrop));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) document.body.removeChild(backdrop); });

  backdrop.querySelector('#babyOk').addEventListener('click', async () => {
    const errEl = backdrop.querySelector('#babyError');
    errEl.style.display = 'none';
    const name = backdrop.querySelector('#babyName').value.trim();
    const dob = backdrop.querySelector('#babyDob').value;
    const eff = backdrop.querySelector('#babyEffective').value;
    if (!name) { errEl.textContent = 'Baby Name ज़रूरी है।'; errEl.style.display = 'block'; return; }
    if (!dob) { errEl.textContent = 'Date of Birth ज़रूरी है।'; errEl.style.display = 'block'; return; }
    if (!eff) { errEl.textContent = 'Effective Date ज़रूरी है।'; errEl.style.display = 'block'; return; }

    const payload = {
      full_name: name,
      gender: backdrop.querySelector('#babyGender').value || null,
      date_of_birth: dob,
      aadhaar_number: aadhaarIn.value.replace(/\D/g, '') || null,
      effective_date: eff,
      father_name: b.husband_name || null,
      mother_name: b.full_name
    };

    try {
      const res = await api('/api/admin/beneficiaries/' + b.id + '/add-baby', { method: 'POST', body: payload });
      document.body.removeChild(backdrop);
      showToast(res.message || 'Baby added successfully.', 'success');
      // Reload mother detail
      await beneLoadDetail(b.id);
      BeneficiariesMenu.view = 'detail';
      renderBeneDetail();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}
