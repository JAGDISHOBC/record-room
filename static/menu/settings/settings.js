/* ==================== SETTINGS MODULE ==================== */

const SettingsMenu = {
  view: 'home',       // home | profile | security | recycle | harddelete | audit | about
  profile: null,
  audit: { logs: [], page: 1, pages: 1, total: 0, module: '' },
  recycle: {
    category: 'SMALL',
    items: [],
    counts: { SMALL: 0, MEDIUM: 0, HARD: 0 },
    page: 1,
    pages: 1,
    total: 0,
    selected: []
  },
  about: null
};

function setFmtDate(iso){
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = n => String(n).padStart(2,'0');
  return pad(d.getDate()) + '/' + pad(d.getMonth()+1) + '/' + d.getFullYear();
}

/* ==================== API ==================== */
async function setLoadProfile(){
  const data = await api('/api/settings/profile');
  SettingsMenu.profile = data.profile;
}

async function setLoadAbout(){
  const data = await api('/api/settings/about-full');
  SettingsMenu.about = data.about;
}

async function setLoadRecycle(){
  const params = new URLSearchParams();
  params.set('category', SettingsMenu.recycle.category);
  params.set('page', SettingsMenu.recycle.page);
  const data = await api('/api/settings/recycle?' + params.toString());
  SettingsMenu.recycle.items = data.items || [];
  SettingsMenu.recycle.counts = data.counts || { SMALL: 0, MEDIUM: 0, HARD: 0 };
  SettingsMenu.recycle.page = data.page;
  SettingsMenu.recycle.pages = data.pages;
  SettingsMenu.recycle.total = data.total;
  SettingsMenu.recycle.selected = [];
}

async function setLoadAudit(){
  const params = new URLSearchParams();
  if (SettingsMenu.audit.module) params.set('module', SettingsMenu.audit.module);
  params.set('page', SettingsMenu.audit.page);
  const data = await api('/api/settings/audit?' + params.toString());
  SettingsMenu.audit.logs = data.logs || [];
  SettingsMenu.audit.page = data.page;
  SettingsMenu.audit.pages = data.pages;
  SettingsMenu.audit.total = data.total;
}

/* ==================== ENTRY ==================== */
SettingsMenu.open = function(){
  SettingsMenu.view = 'home';
  setLoadProfile().then(renderSettingsHome).catch(e => showToast(e.message, 'error'));
};


/* ==================== RENDER: SETTINGS HOME ==================== */
function renderSettingsHome(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const p = SettingsMenu.profile || {};

  root.innerHTML = `
    <div class="set-header">
      <div>
        <h2>Settings</h2>
        <div class="sub">${escHtml(p.full_name || 'Admin')}</div>
      </div>
    </div>

    <div class="set-main">

      <div class="set-tiles">
        <button class="set-tile" data-goto="profile">
          <div class="tile-icon">👤</div>
          <div class="tile-body">
            <div class="tile-title">Account & Profile</div>
            <div class="tile-sub">नाम, photo, mobile, email</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>

        <button class="set-tile" data-goto="security">
          <div class="tile-icon purple">🔐</div>
          <div class="tile-body">
            <div class="tile-title">Security</div>
            <div class="tile-sub">Delete PIN, Master Password, Login Password</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>

        <button class="set-tile" data-goto="recycle">
          <div class="tile-icon blue">♻️</div>
          <div class="tile-body">
            <div class="tile-title">Recycle Bin</div>
            <div class="tile-sub">Small / Medium / Hard Actions</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>

        <button class="set-tile danger" data-goto="harddelete">
          <div class="tile-icon">⚠️</div>
          <div class="tile-body">
            <div class="tile-title">Hard Delete Actions</div>
            <div class="tile-sub">Clear stored DATA only</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>

        <button class="set-tile" data-goto="audit">
          <div class="tile-icon green">📜</div>
          <div class="tile-body">
            <div class="tile-title">Audit Log</div>
            <div class="tile-sub">सभी activity का रिकॉर्ड</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>

        <button class="set-tile" data-goto="about">
          <div class="tile-icon orange">ℹ️</div>
          <div class="tile-body">
            <div class="tile-title">About / System Information</div>
            <div class="tile-sub">Version & build details</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>

        <button class="set-tile danger" data-goto="logout">
          <div class="tile-icon">🚪</div>
          <div class="tile-body">
            <div class="tile-title">Logout</div>
            <div class="tile-sub">Session से बाहर निकलें</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>
      </div>

    </div>
  `;

  root.querySelectorAll('.set-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.goto;
      if (target === 'logout') { doLogoutConfirm(); return; }
      SettingsMenu.view = target;
      if (target === 'profile') renderSetProfile();
      else if (target === 'security') renderSetSecurity();
      else if (target === 'recycle') { SettingsMenu.recycle.page = 1; SettingsMenu.recycle.category = 'SMALL'; SettingsMenu.recycle.selected = []; setLoadRecycle().then(renderSetRecycle).catch(e => showToast(e.message, 'error')); }
      else if (target === 'harddelete') renderSetHardDelete();
      else if (target === 'audit') { SettingsMenu.audit.page = 1; setLoadAudit().then(renderSetAudit).catch(e => showToast(e.message, 'error')); }
      else if (target === 'about') setLoadAbout().then(renderSetAbout).catch(e => showToast(e.message, 'error'));
    });
  });
}


/* ==================== LOGOUT ==================== */
async function doLogout(){
  if (!confirm('Logout करना है?')) return;
  try { await api('/api/logout', { method: 'POST' }); } catch (e) {}
  window.location.href = '/';
}


/* ==================== RENDER: ACCOUNT & PROFILE ==================== */
function renderSetProfile(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const p = SettingsMenu.profile || {};

  const avatar = p.profile_photo_data
    ? '<img src="' + p.profile_photo_data + '" alt="">'
    : '👤';

  root.innerHTML = `
    <div class="set-header">
      <div>
        <h2>Account & Profile</h2>
        <div class="sub">Super Admin</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="set-main">

      <div class="set-card">
        <div class="set-profile-head">
          <div class="set-avatar">${avatar}</div>
          <div class="info">
            <h2>${escHtml(p.full_name || 'Admin')}</h2>
            <div class="meta">@${escHtml(p.username || 'admin')}</div>
            <div class="role-chip">Super Admin</div>
          </div>
        </div>

        <form id="profileForm">

          <div class="set-photo-row">
            <div class="set-photo-preview" id="profilePhotoPreview">${p.profile_photo_data ? '<img src="' + p.profile_photo_data + '">' : '👤'}</div>
            <div class="set-photo-actions">
              <label for="profilePhotoInput">Profile Photo (optional)</label>
              <input type="file" id="profilePhotoInput" accept="image/*">
              <button type="button" class="stock-btn stock-btn-secondary stock-btn-sm" id="profilePhotoClear" style="display:${p.profile_photo_data ? 'inline-flex' : 'none'};margin-top:6px;align-self:flex-start;">Remove Photo</button>
              <div class="hint" id="profilePhotoStatus"></div>
            </div>
          </div>

          <div class="stock-form-grid">
            <div class="stock-field full">
              <label for="profileFullName">Full Name <span class="req">*</span></label>
              <input type="text" id="profileFullName" value="${escHtml(p.full_name || '')}" required>
            </div>

            <div class="stock-field">
              <label>Username</label>
              <div class="set-locked-field">
                <span class="lock-label">Login ID</span>
                <span class="lock-value">${escHtml(p.username || 'admin')}</span>
              </div>
              <div class="hint">Username cannot be changed</div>
            </div>

            <div class="stock-field">
              <label>Role</label>
              <div class="set-locked-field">
                <span class="lock-label">Access Level</span>
                <span class="lock-value">Super Admin</span>
              </div>
              <div class="hint">Role cannot be changed</div>
            </div>

            <div class="stock-field">
              <label for="profileMobile">Mobile</label>
              <input type="text" id="profileMobile" inputmode="numeric" maxlength="10" value="${escHtml(p.mobile || '')}">
            </div>

            <div class="stock-field">
              <label for="profileEmail">Email</label>
              <input type="email" id="profileEmail" value="${escHtml(p.email || '')}">
            </div>

            <div class="stock-field">
              <label for="profileEmpId">Employee ID</label>
              <input type="text" id="profileEmpId" value="${escHtml(p.employee_id || '')}">
            </div>
          </div>

          <div id="profileError" class="login-error" style="display:none;margin-top:14px;"></div>
          <div class="stock-actions" style="margin-top:20px;">
            <button type="button" class="stock-btn stock-btn-secondary" id="profileCancelBtn">Cancel</button>
            <button type="submit" class="stock-btn stock-btn-primary">Save Profile</button>
          </div>
        </form>
      </div>

    </div>
  `;

  // Photo handlers
  let photoData = p.profile_photo_data || null;
  let photoChanged = false;

  const photoInput = document.getElementById('profilePhotoInput');
  const photoPreview = document.getElementById('profilePhotoPreview');
  const photoClear = document.getElementById('profilePhotoClear');
  const photoStatus = document.getElementById('profilePhotoStatus');

  photoInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      photoStatus.textContent = 'Photo बहुत बड़ी है (max 2 MB)।';
      photoStatus.style.color = 'var(--rr-coral)';
      photoInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      photoData = ev.target.result;
      photoChanged = true;
      photoPreview.innerHTML = '<img src="' + photoData + '">';
      photoClear.style.display = 'inline-flex';
      photoStatus.textContent = '✓ नई photo ready';
      photoStatus.style.color = 'var(--rr-green)';
    };
    reader.readAsDataURL(f);
  });

  photoClear.addEventListener('click', () => {
    photoData = null;
    photoChanged = true;
    photoInput.value = '';
    photoPreview.innerHTML = '👤';
    photoClear.style.display = 'none';
    photoStatus.textContent = 'Photo हटा दी गई';
    photoStatus.style.color = 'var(--rr-coral)';
  });

  // Nav
  document.getElementById('backBtn').addEventListener('click', () => {
    SettingsMenu.view = 'home';
    setLoadProfile().then(renderSettingsHome).catch(e => showToast(e.message, 'error'));
  });
  document.getElementById('profileCancelBtn').addEventListener('click', () => {
    SettingsMenu.view = 'home';
    setLoadProfile().then(renderSettingsHome).catch(e => showToast(e.message, 'error'));
  });

  // Submit
  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('profileError');
    errDiv.style.display = 'none';

    const fullName = document.getElementById('profileFullName').value.trim();
    if (!fullName) {
      errDiv.textContent = 'Full Name is required.';
      errDiv.style.display = 'block';
      return;
    }

    const mobile = document.getElementById('profileMobile').value.trim();
    if (mobile && !/^\d{10}$/.test(mobile)) {
      errDiv.textContent = 'Mobile number must be 10 digits.';
      errDiv.style.display = 'block';
      return;
    }

    const payload = {
      full_name: fullName,
      mobile: mobile || null,
      email: document.getElementById('profileEmail').value.trim() || null,
      employee_id: document.getElementById('profileEmpId').value.trim() || null
    };
    if (photoChanged) {
      payload.profile_photo_data = photoData;
    }

    try {
      const res = await api('/api/settings/profile', { method: 'PATCH', body: payload });
      if (res.changed === false) {
        showToast('No changes to save.', 'info');
      } else {
        showToast(res.message || 'Profile updated successfully.', 'success');
      }
      SettingsMenu.profile = res.profile;
      SettingsMenu.view = 'home';
      setLoadProfile().then(renderSettingsHome).catch(e => showToast(e.message, 'error'));
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}


/* ==================== RENDER: SECURITY (home with 3 tiles) ==================== */
function renderSetSecurity(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="set-header">
      <div>
        <h2>Security</h2>
        <div class="sub">Credentials & Passwords</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="set-main">
      <div class="set-tiles">
        <button class="set-tile" data-goto="sec-pin">
          <div class="tile-icon">🔢</div>
          <div class="tile-body">
            <div class="tile-title">Delete PIN</div>
            <div class="tile-sub">Destructive actions के लिए verification PIN</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>

        <button class="set-tile" data-goto="sec-master">
          <div class="tile-icon purple">🗝️</div>
          <div class="tile-body">
            <div class="tile-title">Master Password</div>
            <div class="tile-sub">Extra verification step for Hard Delete</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>

        <button class="set-tile" data-goto="sec-login">
          <div class="tile-icon green">🔑</div>
          <div class="tile-body">
            <div class="tile-title">Login Password</div>
            <div class="tile-sub">Account sign-in password</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    SettingsMenu.view = 'home';
    renderSettingsHome();
  });

  root.querySelectorAll('.set-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.goto;
      if (target === 'sec-pin') renderSetSecurityPIN();
      else if (target === 'sec-master') renderSetSecurityMaster();
      else if (target === 'sec-login') renderSetSecurityLogin();
    });
  });
}


/* ==================== SECURITY — Delete PIN ==================== */
function renderSetSecurityPIN(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="set-header">
      <div>
        <h2>Delete PIN</h2>
        <div class="sub">Destructive actions verification</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="set-main">
      <div class="set-card">
        <p style="font-size:12.5px;color:var(--rr-muted);margin:0 0 16px;font-weight:600;line-height:1.5;">
          Delete PIN का उपयोग destructive actions (Delete, Hard Delete) के verification के लिए होता है।
          पहली बार set करते समय Current field में अपना Login Password डालें।
        </p>
        <form id="pinForm">
          <div class="stock-form-grid">
            <div class="stock-field full">
              <label for="pinCurrent">Current Delete PIN / Login Password</label>
              <input type="password" id="pinCurrent" autocomplete="off" required>
            </div>
            <div class="stock-field">
              <label for="pinNew">New Delete PIN</label>
              <input type="password" id="pinNew" autocomplete="off" required>
              <div class="hint">Minimum 4 characters</div>
            </div>
            <div class="stock-field">
              <label for="pinConfirm">Confirm New Delete PIN</label>
              <input type="password" id="pinConfirm" autocomplete="off" required>
            </div>
          </div>
          <div id="pinError" class="login-error" style="display:none;margin-top:10px;"></div>
          <div class="stock-actions">
            <button type="submit" class="stock-btn stock-btn-primary">Save Delete PIN</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    SettingsMenu.view = 'security';
    renderSetSecurity();
  });

  document.getElementById('pinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('pinError');
    errDiv.style.display = 'none';

    const cur = document.getElementById('pinCurrent').value.trim();
    const newPin = document.getElementById('pinNew').value.trim();
    const conf = document.getElementById('pinConfirm').value.trim();

    if (!cur || !newPin || !conf) {
      errDiv.textContent = 'All fields are required.'; errDiv.style.display = 'block'; return;
    }
    if (newPin !== conf) {
      errDiv.textContent = 'New credential and confirmation do not match.'; errDiv.style.display = 'block'; return;
    }
    if (newPin.length < 4) {
      errDiv.textContent = 'Delete PIN must be at least 4 characters.'; errDiv.style.display = 'block'; return;
    }

    try {
      const res = await api('/api/settings/security/pin', {
        method: 'POST',
        body: { current_pin: cur, new_pin: newPin, confirm_pin: conf }
      });
      showToast(res.message || 'Security setting updated successfully.', 'success');
      document.getElementById('pinForm').reset();
    } catch (err) {
      errDiv.textContent = err.message; errDiv.style.display = 'block';
    }
  });
}


/* ==================== SECURITY — Master Password ==================== */
function renderSetSecurityMaster(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="set-header">
      <div>
        <h2>Master Password</h2>
        <div class="sub">Hard Delete verification</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="set-main">
      <div class="set-card">
        <p style="font-size:12.5px;color:var(--rr-muted);margin:0 0 16px;font-weight:600;line-height:1.5;">
          Master Password extra verification step है Hard Delete और Hard Actions के लिए।
          पहली बार set करते समय Current field में अपना Login Password डालें।
        </p>
        <form id="masterForm">
          <div class="stock-form-grid">
            <div class="stock-field full">
              <label for="masterCurrent">Current Master Password / Login Password</label>
              <input type="password" id="masterCurrent" autocomplete="off" required>
            </div>
            <div class="stock-field">
              <label for="masterNew">New Master Password</label>
              <input type="password" id="masterNew" autocomplete="off" required>
              <div class="hint">Minimum 6 characters</div>
            </div>
            <div class="stock-field">
              <label for="masterConfirm">Confirm New Master Password</label>
              <input type="password" id="masterConfirm" autocomplete="off" required>
            </div>
          </div>
          <div id="masterError" class="login-error" style="display:none;margin-top:10px;"></div>
          <div class="stock-actions">
            <button type="submit" class="stock-btn stock-btn-primary">Save Master Password</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    SettingsMenu.view = 'security';
    renderSetSecurity();
  });

  document.getElementById('masterForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('masterError');
    errDiv.style.display = 'none';

    const cur = document.getElementById('masterCurrent').value.trim();
    const newPw = document.getElementById('masterNew').value.trim();
    const conf = document.getElementById('masterConfirm').value.trim();

    if (!cur || !newPw || !conf) {
      errDiv.textContent = 'All fields are required.'; errDiv.style.display = 'block'; return;
    }
    if (newPw !== conf) {
      errDiv.textContent = 'New credential and confirmation do not match.'; errDiv.style.display = 'block'; return;
    }
    if (newPw.length < 6) {
      errDiv.textContent = 'Master Password must be at least 6 characters.'; errDiv.style.display = 'block'; return;
    }

    try {
      const res = await api('/api/settings/security/master', {
        method: 'POST',
        body: { current_password: cur, new_password: newPw, confirm_password: conf }
      });
      showToast(res.message || 'Security setting updated successfully.', 'success');
      document.getElementById('masterForm').reset();
    } catch (err) {
      errDiv.textContent = err.message; errDiv.style.display = 'block';
    }
  });
}


/* ==================== SECURITY — Login Password ==================== */
function renderSetSecurityLogin(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="set-header">
      <div>
        <h2>Login Password</h2>
        <div class="sub">Account sign-in</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="set-main">
      <div class="set-card">
        <p style="font-size:12.5px;color:var(--rr-muted);margin:0 0 16px;font-weight:600;line-height:1.5;">
          Login Password आपके account में sign-in करने के लिए उपयोग होता है।
          इसे बदलने के बाद अगली बार नए password से login करेंगे।
        </p>
        <form id="loginPwForm">
          <div class="stock-form-grid">
            <div class="stock-field full">
              <label for="loginCurrent">Current Login Password</label>
              <input type="password" id="loginCurrent" autocomplete="off" required>
            </div>
            <div class="stock-field">
              <label for="loginNew">New Login Password</label>
              <input type="password" id="loginNew" autocomplete="off" required>
              <div class="hint">Minimum 6 characters</div>
            </div>
            <div class="stock-field">
              <label for="loginConfirm">Confirm New Login Password</label>
              <input type="password" id="loginConfirm" autocomplete="off" required>
            </div>
          </div>
          <div id="loginPwError" class="login-error" style="display:none;margin-top:10px;"></div>
          <div class="stock-actions">
            <button type="submit" class="stock-btn stock-btn-primary">Save Login Password</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    SettingsMenu.view = 'security';
    renderSetSecurity();
  });

  document.getElementById('loginPwForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('loginPwError');
    errDiv.style.display = 'none';

    const cur = document.getElementById('loginCurrent').value.trim();
    const newPw = document.getElementById('loginNew').value.trim();
    const conf = document.getElementById('loginConfirm').value.trim();

    if (!cur || !newPw || !conf) {
      errDiv.textContent = 'All fields are required.'; errDiv.style.display = 'block'; return;
    }
    if (newPw !== conf) {
      errDiv.textContent = 'New credential and confirmation do not match.'; errDiv.style.display = 'block'; return;
    }
    if (newPw.length < 6) {
      errDiv.textContent = 'Login Password must be at least 6 characters.'; errDiv.style.display = 'block'; return;
    }

    try {
      const res = await api('/api/settings/security/login', {
        method: 'POST',
        body: { current_password: cur, new_password: newPw, confirm_password: conf }
      });
      showToast(res.message || 'Security setting updated successfully.', 'success');
      document.getElementById('loginPwForm').reset();
    } catch (err) {
      errDiv.textContent = err.message; errDiv.style.display = 'block';
    }
  });
}




/* ==================== RENDER: RECYCLE BIN (home with 3 tiles) ==================== */
function renderSetRecycle(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const c = SettingsMenu.recycle.counts || { SMALL: 0, MEDIUM: 0, HARD: 0 };

  root.innerHTML = `
    <div class="set-header">
      <div>
        <h2>Recycle Bin</h2>
        <div class="sub">Deleted items — recover या permanently delete</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="set-main">
      <div class="set-tiles">
        <button class="set-tile" data-goto="rb-small">
          <div class="tile-icon blue">📋</div>
          <div class="tile-body">
            <div class="tile-title">Small Actions <span style="background:#eef4ff;color:#2c4c91;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;margin-left:6px;">${c.SMALL || 0}</span></div>
            <div class="tile-sub">Deleted logs & history records</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>

        <button class="set-tile" data-goto="rb-medium">
          <div class="tile-icon orange">🗂️</div>
          <div class="tile-body">
            <div class="tile-title">Medium Actions <span style="background:#fff4e5;color:#8a5a00;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;margin-left:6px;">${c.MEDIUM || 0}</span></div>
            <div class="tile-sub">Family, Member, Beneficiary, Stock records</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>

        <button class="set-tile danger" data-goto="rb-hard">
          <div class="tile-icon">⚠️</div>
          <div class="tile-body">
            <div class="tile-title">Hard Actions <span style="background:#fdeceb;color:#b0271f;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;margin-left:6px;">${c.HARD || 0}</span></div>
            <div class="tile-sub">Large/whole-data destructive actions</div>
          </div>
          <div class="tile-arrow">›</div>
        </button>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    SettingsMenu.view = 'home';
    renderSettingsHome();
  });

  root.querySelectorAll('.set-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.goto;
      if (target === 'rb-small') {
        SettingsMenu.recycle.category = 'SMALL';
        SettingsMenu.recycle.page = 1;
        SettingsMenu.recycle.selected = [];
        setLoadRecycle().then(renderRecycleList).catch(e => showToast(e.message, 'error'));
      } else if (target === 'rb-medium') {
        SettingsMenu.recycle.category = 'MEDIUM';
        SettingsMenu.recycle.page = 1;
        SettingsMenu.recycle.selected = [];
        setLoadRecycle().then(renderRecycleList).catch(e => showToast(e.message, 'error'));
      } else if (target === 'rb-hard') {
        SettingsMenu.recycle.category = 'HARD';
        SettingsMenu.recycle.page = 1;
        SettingsMenu.recycle.selected = [];
        setLoadRecycle().then(renderRecycleList).catch(e => showToast(e.message, 'error'));
      }
    });
  });
}


/* ==================== RENDER: RECYCLE LIST (per category) ==================== */
function renderRecycleList(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const rb = SettingsMenu.recycle;
  const items = rb.items;
  const cat = rb.category;

  const TITLES = {
    'SMALL':  { label: 'Small Actions',  sub: 'Deleted logs & history records',  icon: '📋' },
    'MEDIUM': { label: 'Medium Actions', sub: 'Family, Member, Beneficiary, Stock records', icon: '🗂️' },
    'HARD':   { label: 'Hard Actions',   sub: 'Large/whole-data destructive actions', icon: '⚠️' }
  };
  const t = TITLES[cat] || { label: cat, sub: '', icon: '♻️' };

  root.innerHTML = `
    <div class="set-header">
      <div>
        <h2>${escHtml(t.label)}</h2>
        <div class="sub">${escHtml(t.sub)}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="set-main">

      <div class="set-rb-toolbar">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;cursor:pointer;">
          <input type="checkbox" id="rbSelectAll" ${(items.length && rb.selected.length === items.length) ? 'checked' : ''}>
          Select All
        </label>
        <span class="spacer"></span>
        <button class="stock-btn stock-btn-secondary stock-btn-sm" id="rbRecoverSelected" ${rb.selected.length ? '' : 'disabled'}>↺ Recover Selected</button>
        <button class="stock-btn stock-btn-secondary stock-btn-sm" id="rbRecoverAll" ${items.length ? '' : 'disabled'}>↺ Recover All</button>
        <button class="stock-btn stock-btn-danger stock-btn-sm" id="rbDeleteSelected" ${rb.selected.length ? '' : 'disabled'}>🗑 Delete Selected</button>
      </div>

      <div id="rbList">
        ${items.length ? items.map(item => renderRecycleRow(item)).join('') : `
          <div class="thr-empty">
            <div class="empty-icon">♻️</div>
            <div class="empty-title">इस category में कोई item नहीं</div>
            <div class="empty-sub">यहाँ deleted items दिखेंगी</div>
          </div>
        `}
      </div>

      ${rb.pages > 1 ? `
        <div class="set-pager">
          <button id="rbPrev" ${rb.page <= 1 ? 'disabled' : ''}>‹</button>
          <span class="p-info">Page ${rb.page} of ${rb.pages} · ${rb.total} items</span>
          <button id="rbNext" ${rb.page >= rb.pages ? 'disabled' : ''}>›</button>
        </div>
      ` : (rb.total ? '<div style="text-align:center;font-size:12.5px;color:var(--rr-muted);margin-top:12px;font-weight:600;">' + rb.total + ' item' + (rb.total === 1 ? '' : 's') + '</div>' : '')}

    </div>
  `;

  // Back
  document.getElementById('backBtn').addEventListener('click', () => {
    SettingsMenu.view = 'recycle';
    // Reload counts for home
    setLoadRecycle().then(renderSetRecycle).catch(e => showToast(e.message, 'error'));
  });

  // Select All
  const selectAll = document.getElementById('rbSelectAll');
  if (selectAll) {
    selectAll.addEventListener('change', (e) => {
      if (e.target.checked) {
        SettingsMenu.recycle.selected = items.map(i => i.id);
      } else {
        SettingsMenu.recycle.selected = [];
      }
      renderRecycleList();
    });
  }

  // Individual checkboxes
  root.querySelectorAll('.rb-row-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = parseInt(cb.dataset.id, 10);
      if (e.target.checked) {
        if (!SettingsMenu.recycle.selected.includes(id)) SettingsMenu.recycle.selected.push(id);
      } else {
        SettingsMenu.recycle.selected = SettingsMenu.recycle.selected.filter(x => x !== id);
      }
      renderRecycleList();
    });
  });

  // Recover Selected
  const recSel = document.getElementById('rbRecoverSelected');
  if (recSel) recSel.addEventListener('click', () => {
    if (!SettingsMenu.recycle.selected.length) return;
    doRecover(SettingsMenu.recycle.selected);
  });

  // Recover All (current page)
  const recAll = document.getElementById('rbRecoverAll');
  if (recAll) recAll.addEventListener('click', () => {
    const ids = items.map(i => i.id);
    if (!ids.length) return;
    doRecover(ids);
  });

  // Delete Selected
  const delSel = document.getElementById('rbDeleteSelected');
  if (delSel) delSel.addEventListener('click', () => {
    if (!SettingsMenu.recycle.selected.length) return;
    doPermanentDelete(SettingsMenu.recycle.selected);
  });

  // Recover / Delete per row
  root.querySelectorAll('[data-rec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.rec, 10);
      doRecover([id]);
    });
  });
  root.querySelectorAll('[data-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.del, 10);
      doPermanentDelete([id]);
    });
  });

  // Pagination
  const prevBtn = document.getElementById('rbPrev');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (SettingsMenu.recycle.page > 1) {
      SettingsMenu.recycle.page--;
      SettingsMenu.recycle.selected = [];
      setLoadRecycle().then(renderRecycleList).catch(e => showToast(e.message, 'error'));
    }
  });
  const nextBtn = document.getElementById('rbNext');
  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (SettingsMenu.recycle.page < SettingsMenu.recycle.pages) {
      SettingsMenu.recycle.page++;
      SettingsMenu.recycle.selected = [];
      setLoadRecycle().then(renderRecycleList).catch(e => showToast(e.message, 'error'));
    }
  });
}


/* ==================== RECYCLE ROW ==================== */
function renderRecycleRow(item){
  const isSelected = SettingsMenu.recycle.selected.includes(item.id);
  const cat = item.category;
  const isHard = (cat === 'HARD' || item.record_type === 'HARD_CLEAR');

  let data = {};
  try { data = JSON.parse(item.record_data || '{}'); } catch(e) {}

  const title = item.record_name || (item.record_type + ' #' + (item.record_id || ''));
  const meta = [];
  meta.push('📁 ' + escHtml(item.module));
  if (item.reason) meta.push('💬 ' + escHtml(item.reason));
  if (item.effective_date) meta.push('📅 ' + fmtBeneDate(item.effective_date));

  // Details rendering (differs for HARD)
  let detailsHtml = '';
  if (isHard && data.rows_cleared) {
    detailsHtml = Object.keys(data.rows_cleared).map(tbl =>
      '<div><b>' + escHtml(tbl) + ':</b> ' + data.rows_cleared[tbl] + ' rows (snapshot saved)</div>'
    ).join('');
    if (data.module) {
      detailsHtml = '<div><b>Module:</b> ' + escHtml(data.module) + '</div>' + detailsHtml;
    }
  } else {
    detailsHtml = Object.keys(data).map(k => '<div><b>' + escHtml(k) + ':</b> ' + escHtml(String(data[k] == null ? '—' : data[k]).substring(0, 120)) + '</div>').join('') || '<div style="color:#8a9a92;">No preview</div>';
  }

  // Actions — HARD can also be recovered now
  const actionBtns = '<button class="stock-btn stock-btn-secondary stock-btn-sm" data-rec="' + item.id + '">↺ Recover</button>' +
    '<button class="stock-btn stock-btn-danger stock-btn-sm" data-del="' + item.id + '">🗑 Delete Permanently</button>';

  return `
    <div class="set-rb-row ${isSelected ? 'selected' : ''}">
      <input type="checkbox" class="rb-row-cb" data-id="${item.id}" ${isSelected ? 'checked' : ''}>
      <div class="rb-main">
        <div class="rb-title">
          <span class="rb-cat ${cat}">${cat}</span>
          <span style="margin-left:8px;">${escHtml(title)}</span>
        </div>
        <div class="rb-meta">${meta.join(' · ')}</div>
        <div class="rb-meta" style="color:#a0a3a9;">Deleted: ${fmtDateTime(item.deleted_at)} by ${escHtml(item.deleted_by_username || '—')}</div>
        ${isHard ? '<div class="rb-meta" style="color:#8a5a00;font-weight:700;margin-top:3px;">ⓘ Data snapshot available — Recover से module में वापस restore होगा</div>' : ''}
        <details style="margin-top:6px;">
          <summary style="cursor:pointer;font-size:11.5px;color:#8aa096;font-weight:700;list-style:none;">▸ View details</summary>
          <div class="bene-log-changes" style="background:#f8f8fa;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:12px;line-height:1.5;max-height:180px;overflow:auto;">
            ${detailsHtml}
          </div>
        </details>
      </div>
      <div class="rb-actions">
        ${actionBtns}
      </div>
    </div>
  `;
}


/* ==================== RECOVER / DELETE ACTIONS ==================== */
async function doRecover(ids){
  if (!ids.length) { showToast('Please select at least one item.', 'info'); return; }
  if (!confirm('Selected item(s) को recover करना है?\n\n' + ids.length + ' item(s)')) return;
  try {
    const res = await api('/api/settings/recycle/recover', {
      method: 'POST',
      body: { ids: ids }
    });
    showToast(res.message || 'Selected items recovered successfully.', 'success');
    SettingsMenu.recycle.selected = [];
    await setLoadRecycle();
    renderSetRecycle();
  } catch (e) {
    showToast(e.message, 'error');
  }
}


async function doPermanentDelete(ids){
  if (!ids.length) { showToast('Please select at least one item.', 'info'); return; }

  // Check if any HARD category
  const hasHard = SettingsMenu.recycle.items.some(i => ids.includes(i.id) && i.category === 'HARD');

  const backdrop = document.createElement('div');
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal">
      <div class="warn-icon">🗑</div>
      <h3>Permanent Delete</h3>
      <p style="color:#b0271f;font-weight:700;">
        यह action undo नहीं हो सकता!<br>
        ${ids.length} item(s) हमेशा के लिए हट जाएँगे।
      </p>
      ${hasHard ? '<p style="background:#fdeceb;border-radius:8px;padding:8px 12px;color:#b0271f;font-size:13px;">⚠ इसमें Hard category items हैं — Delete PIN और Master Password दोनों ज़रूरी हैं।</p>' : ''}

      <div class="family-field">
        <label for="pdPin">Delete PIN <span class="req">*</span></label>
        <input type="password" id="pdPin" autocomplete="off">
      </div>

      ${hasHard ? `
        <div class="family-field">
          <label for="pdMaster">Master Password <span class="req">*</span></label>
          <input type="password" id="pdMaster" autocomplete="off">
        </div>
      ` : ''}

      <div id="pdError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="pdCancel">Cancel</button>
        <button class="family-btn family-btn-danger" id="pdOk">Delete Permanently</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#pdCancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('#pdOk').addEventListener('click', async () => {
    const errEl = backdrop.querySelector('#pdError');
    errEl.style.display = 'none';
    const pin = backdrop.querySelector('#pdPin').value.trim();
    const master = hasHard ? backdrop.querySelector('#pdMaster').value.trim() : '';
    if (!pin) { errEl.textContent = 'Please verify Delete PIN and Master Password.'; errEl.style.display = 'block'; return; }
    if (hasHard && !master) { errEl.textContent = 'Please verify Delete PIN and Master Password.'; errEl.style.display = 'block'; return; }

    try {
      const res = await api('/api/settings/recycle/delete', {
        method: 'POST',
        body: { ids: ids, pin: pin, master_password: master }
      });
      backdrop.remove();
      showToast(res.message || 'Selected items permanently deleted.', 'success');
      SettingsMenu.recycle.selected = [];
      await setLoadRecycle();
      renderSetRecycle();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  });
}


/* ==================== RENDER: HARD DELETE ACTIONS ==================== */
function renderSetHardDelete(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const MODULES = [
    { code: 'FAMILY',        label: 'Family Survey Data',      icon: '👨‍👩‍👧', desc: 'Families, Members, Logs' },
    { code: 'BENEFICIARIES', label: 'Beneficiary Data',        icon: '🤱', desc: 'All beneficiaries + logs' },
    { code: 'THR',           label: 'THR Data',                icon: '🍲', desc: 'THR distributions + logs' },
    { code: 'ATTENDANCE',    label: 'Attendance Data',         icon: '📋', desc: 'Attendance records + logs' },
    { code: 'HOLIDAY',       label: 'Holiday Data',            icon: '🎉', desc: 'Holidays + logs' },
    { code: 'STOCK',         label: 'Stock Data',              icon: '📦', desc: 'Stock entries + recipes + logs' }
  ];

  root.innerHTML = `
    <div class="set-header">
      <div>
        <h2>Hard Delete Actions</h2>
        <div class="sub">Clear stored DATA only — application सुरक्षित रहेगी</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="set-main">

      <div style="background:#fdeceb;border:1px solid #f5c8c5;border-radius:14px;padding:14px 16px;margin-bottom:18px;">
        <div style="font-size:14px;font-weight:800;color:#b0271f;margin-bottom:6px;">⚠️ सावधानी!</div>
        <div style="font-size:13px;color:#b0271f;line-height:1.5;">
          यह action module का <b>data module से हटा देगा</b>। Entry <b>Recycle Bin → Hard Actions</b> में चली जाएगी।<br>
          Application, code, tables, structure — सब सुरक्षित रहेगा।<br>
          Recycle Bin से <b>permanently delete</b> करने पर ही entry पूरी तरह हटेगी।
        </div>
      </div>

      <div class="set-hd-grid">
        ${MODULES.map(m => `
          <div class="set-hd-card">
            <div class="hd-icon">${m.icon}</div>
            <div class="hd-title">${escHtml(m.label)}</div>
            <div class="hd-sub">${escHtml(m.desc)}</div>
            <button class="stock-btn stock-btn-danger" data-module="${m.code}">Clear Data</button>
          </div>
        `).join('')}

        <div class="set-hd-card" style="border-color:#f5c8c5;">
          <div class="hd-icon">📜</div>
          <div class="hd-title">Clear All Audit Logs</div>
          <div class="hd-sub">सभी audit logs हटाएँ — Recycle Bin → Hard Actions में जाएंगे</div>
          <button class="stock-btn stock-btn-danger" id="clearAuditLogsBtn">Clear All Audit Logs</button>
        </div>
      </div>

    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    SettingsMenu.view = 'home';
    renderSettingsHome();
  });

  root.querySelectorAll('[data-module]').forEach(btn => {
    btn.addEventListener('click', () => showHardDeleteDialog(btn.dataset.module, MODULES));
  });

  const clearAuditBtn = document.getElementById('clearAuditLogsBtn');
  if (clearAuditBtn) clearAuditBtn.addEventListener('click', () => showClearAuditLogsDialog());
}


/* ==================== CLEAR AUDIT LOGS MODAL ==================== */
function showClearAuditLogsDialog(){
  const backdrop = document.createElement('div');
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal">
      <div class="warn-icon">📜</div>
      <h3>Clear All Audit Logs</h3>
      <p style="color:#b0271f;font-weight:700;">
        सभी audit logs हटा दिए जाएँगे।<br>
        वो Recycle Bin → Hard Actions में जाएंगे (Recover possible)।
      </p>

      <div class="family-field">
        <label for="calPin">Delete PIN <span class="req">*</span></label>
        <input type="password" id="calPin" autocomplete="off">
      </div>

      <div class="family-field">
        <label for="calMaster">Master Password <span class="req">*</span></label>
        <input type="password" id="calMaster" autocomplete="off">
      </div>

      <div class="family-field">
        <label for="calConfirm">Type "DELETE" to confirm <span class="req">*</span></label>
        <input type="text" id="calConfirm" autocomplete="off" placeholder="DELETE">
      </div>

      <div id="calError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="calCancel">Cancel</button>
        <button class="family-btn family-btn-danger" id="calOk">Clear Logs</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#calCancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('#calOk').addEventListener('click', async () => {
    const errEl = backdrop.querySelector('#calError');
    errEl.style.display = 'none';

    const pin = backdrop.querySelector('#calPin').value.trim();
    const master = backdrop.querySelector('#calMaster').value.trim();
    const confirm = backdrop.querySelector('#calConfirm').value.trim();

    if (!pin || !master) { errEl.textContent = 'Please verify Delete PIN and Master Password.'; errEl.style.display = 'block'; return; }
    if (confirm !== 'DELETE') { errEl.textContent = 'Final confirmation is required. Type DELETE.'; errEl.style.display = 'block'; return; }

    const btn = backdrop.querySelector('#calOk');
    btn.disabled = true;
    btn.textContent = 'Clearing...';

    try {
      const res = await api('/api/settings/hard-delete/audit-logs', {
        method: 'POST',
        body: { pin: pin, master_password: master, confirm: 'DELETE' }
      });
      backdrop.remove();
      showToast(res.message || 'Audit logs moved to Recycle Bin.', 'success');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Clear Logs';
    }
  });
}


/* ==================== HARD DELETE CONFIRMATION MODAL ==================== */
function showHardDeleteDialog(moduleCode, modules){
  const mod = modules.find(m => m.code === moduleCode);
  if (!mod) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal">
      <div class="warn-icon">⚠️</div>
      <h3>Confirm Hard Delete</h3>
      <p style="color:#b0271f;font-weight:700;">
        "${escHtml(mod.label)}" के सारे records हमेशा के लिए हट जाएँगे।<br>
        यह action undo नहीं हो सकता।
      </p>

      <div style="background:#f8f9fc;border-radius:10px;padding:10px 12px;margin-bottom:12px;font-size:13px;">
        <div style="font-weight:700;color:var(--rr-ink);">${mod.icon} ${escHtml(mod.label)}</div>
        <div style="color:var(--rr-muted);margin-top:3px;">${escHtml(mod.desc)}</div>
      </div>

      <div class="family-field">
        <label for="hdPin">Delete PIN <span class="req">*</span></label>
        <input type="password" id="hdPin" autocomplete="off">
      </div>

      <div class="family-field">
        <label for="hdMaster">Master Password <span class="req">*</span></label>
        <input type="password" id="hdMaster" autocomplete="off">
      </div>

      <div class="family-field">
        <label for="hdConfirm">Type "DELETE" to confirm <span class="req">*</span></label>
        <input type="text" id="hdConfirm" autocomplete="off" placeholder="DELETE">
      </div>

      <div id="hdError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="hdCancel">Cancel</button>
        <button class="family-btn family-btn-danger" id="hdOk">Move Data to Recycle Bin</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#hdCancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('#hdOk').addEventListener('click', async () => {
    const errEl = backdrop.querySelector('#hdError');
    errEl.style.display = 'none';

    const pin = backdrop.querySelector('#hdPin').value.trim();
    const master = backdrop.querySelector('#hdMaster').value.trim();
    const confirm = backdrop.querySelector('#hdConfirm').value.trim();

    if (!pin || !master) { errEl.textContent = 'Please verify Delete PIN and Master Password.'; errEl.style.display = 'block'; return; }
    if (confirm !== 'DELETE') { errEl.textContent = 'Final confirmation is required. Type DELETE.'; errEl.style.display = 'block'; return; }

    const btn = backdrop.querySelector('#hdOk');
    btn.disabled = true;
    btn.textContent = 'Moving...';

    try {
      const res = await api('/api/settings/hard-delete', {
        method: 'POST',
        body: { module: moduleCode, pin: pin, master_password: master, confirm: 'DELETE' }
      });
      backdrop.remove();
      showToast(res.message || 'Data cleared successfully.', 'success');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = 'Move Data to Recycle Bin';
    }
  });
}


/* ==================== RENDER: AUDIT LOG ==================== */
function renderSetAudit(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const a = SettingsMenu.audit;
  const logs = a.logs;

  const MODULES = ['', 'ACCOUNT', 'SECURITY', 'RECYCLE', 'HARD_DELETE', 'FAMILY', 'BENEFICIARIES', 'THR', 'STOCK', 'ATTENDANCE', 'HOLIDAY'];

  root.innerHTML = `
    <div class="set-header">
      <div>
        <h2>Audit Log</h2>
        <div class="sub">सभी activity का रिकॉर्ड</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="set-main">

      <div class="set-rb-toolbar">
        <div class="stock-field" style="min-width:180px;flex:0 0 auto;">
          <label>Filter by Module</label>
          <select id="auditModuleFilter">
            <option value="">All Modules</option>
            ${MODULES.filter(m => m).map(m => `<option value="${m}" ${a.module === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <span class="spacer"></span>
        <div style="font-size:13px;font-weight:700;color:var(--rr-muted);">${a.total} entries</div>
      </div>

      <div id="auditList">
        ${logs.length ? logs.map(l => renderAuditRow(l)).join('') : `
          <div class="thr-empty">
            <div class="empty-icon">📜</div>
            <div class="empty-title">कोई audit entry नहीं</div>
            <div class="empty-sub">Activity होने पर यहाँ दिखेगी</div>
          </div>
        `}
      </div>

      ${a.pages > 1 ? `
        <div class="set-pager">
          <button id="auditPrev" ${a.page <= 1 ? 'disabled' : ''}>‹</button>
          <span class="p-info">Page ${a.page} of ${a.pages}</span>
          <button id="auditNext" ${a.page >= a.pages ? 'disabled' : ''}>›</button>
        </div>
      ` : ''}

    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    SettingsMenu.view = 'home';
    renderSettingsHome();
  });

  document.getElementById('auditModuleFilter').addEventListener('change', (e) => {
    SettingsMenu.audit.module = e.target.value;
    SettingsMenu.audit.page = 1;
    setLoadAudit().then(renderSetAudit).catch(err => showToast(err.message, 'error'));
  });

  const prevBtn = document.getElementById('auditPrev');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (SettingsMenu.audit.page > 1) {
      SettingsMenu.audit.page--;
      setLoadAudit().then(renderSetAudit).catch(e => showToast(e.message, 'error'));
    }
  });
  const nextBtn = document.getElementById('auditNext');
  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (SettingsMenu.audit.page < SettingsMenu.audit.pages) {
      SettingsMenu.audit.page++;
      setLoadAudit().then(renderSetAudit).catch(e => showToast(e.message, 'error'));
    }
  });
}


function renderAuditRow(log){
  const MODULE_ICONS = {
    'ACCOUNT': '👤', 'SECURITY': '🔐', 'RECYCLE': '♻️', 'HARD_DELETE': '⚠️',
    'FAMILY': '👨‍👩‍👧', 'BENEFICIARIES': '🤱', 'THR': '🍲', 'STOCK': '📦',
    'ATTENDANCE': '📋', 'HOLIDAY': '🎉'
  };
  const icon = MODULE_ICONS[log.module] || '•';

  let changesHtml = '';
  if (log.old_values) {
    try {
      const o = JSON.parse(log.old_values);
      const rows = [];
      Object.keys(o).forEach(k => {
        const entry = o[k];
        if (entry && typeof entry === 'object' && 'old' in entry) {
          const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const ov = entry.old === null || entry.old === undefined || entry.old === '' ? '—' : String(entry.old);
          const nv = entry.new === null || entry.new === undefined || entry.new === '' ? '—' : String(entry.new);
          rows.push('<div class="chg"><b>' + escHtml(label) + ':</b> <span class="old">' + escHtml(ov) + '</span> <span class="arrow">→</span> <span class="new">' + escHtml(nv) + '</span></div>');
        } else {
          const label = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          rows.push('<div class="chg"><b>' + escHtml(label) + ':</b> ' + escHtml(String(entry || '—')) + '</div>');
        }
      });
      if (rows.length) {
        changesHtml = '<details><summary>Details देखें</summary><div class="a-changes">' + rows.join('') + '</div></details>';
      }
    } catch (e) {}
  }

  let metadataHtml = '';
  if (log.metadata) {
    try {
      const md = JSON.parse(log.metadata);
      const parts = [];
      Object.keys(md).forEach(k => {
        const v = md[k];
        parts.push('<b>' + escHtml(k) + ':</b> ' + escHtml(typeof v === 'object' ? JSON.stringify(v) : String(v)));
      });
      if (parts.length) metadataHtml = '<div style="font-size:11.5px;color:#8a9a92;margin-top:5px;">' + parts.join(' · ') + '</div>';
    } catch (e) {}
  }

  return `
    <div class="set-audit-row">
      <div class="a-head">
        <span>${icon} ${escHtml(log.action)} <span style="color:var(--rr-muted);font-weight:600;font-size:11.5px;margin-left:6px;">${escHtml(log.module)}</span></span>
        <span class="a-time">${fmtDateTime(log.created_at)}</span>
      </div>
      <div class="a-meta">
        ${log.actor_username ? '👤 ' + escHtml(log.actor_username) : ''}
        ${log.target_type ? ' · ' + escHtml(log.target_type) : ''}
        ${log.target_id ? ' #' + escHtml(String(log.target_id)) : ''}
      </div>
      ${log.reason ? '<div class="a-meta" style="font-style:italic;">Reason: ' + escHtml(log.reason) + '</div>' : ''}
      ${metadataHtml}
      ${changesHtml}
    </div>
  `;
}


/* ==================== RENDER: ABOUT / SYSTEM INFORMATION ==================== */
function renderSetAbout(editMode){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const a = SettingsMenu.about || {};
  const isEdit = !!editMode;

  root.innerHTML = `
    <div class="set-header">
      <div>
        <h2>${isEdit ? 'Edit Version Info' : 'About'}</h2>
        <div class="sub">${isEdit ? 'System Information' : 'System Information'}</div>
      </div>
      <div class="header-actions">
        ${!isEdit ? `
          <button class="back-btn" id="aboutEditBtn">✎ Edit</button>
        ` : ''}
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="set-main">

      <div class="set-card" style="text-align:center;padding:32px 22px 26px;">
        <div style="width:88px;height:88px;border-radius:22px;background:var(--rr-coral);color:#fff;display:grid;place-items:center;font-size:44px;margin:0 auto 14px;box-shadow:0 8px 22px rgba(223,91,85,.28);">📁</div>
        <h2 style="margin:0 0 4px;font-size:24px;font-weight:800;color:var(--rr-ink);">${escHtml(a.app_name || 'Record Room')}</h2>
        <div style="font-size:13px;color:var(--rr-muted);font-weight:600;">Data Manager</div>
        <div style="margin-top:10px;">
          <span style="display:inline-block;background:#e6f5ea;color:#1f7a35;font-size:12px;font-weight:800;padding:4px 12px;border-radius:999px;">v${escHtml(a.app_version || '1.0.0')}</span>
        </div>
      </div>

      ${isEdit ? `
        <div class="set-card">
          <h3>Edit Version Information</h3>
          <div class="stock-form-grid">
            <div class="stock-field">
              <label for="abAppName">App Name</label>
              <input type="text" id="abAppName" value="${escHtml(a.app_name || '')}">
            </div>
            <div class="stock-field">
              <label for="abAppVersion">App Version</label>
              <input type="text" id="abAppVersion" value="${escHtml(a.app_version || '')}">
            </div>
            <div class="stock-field">
              <label for="abDbVersion">Database Version</label>
              <input type="text" id="abDbVersion" value="${escHtml(a.db_version || '')}">
            </div>
            <div class="stock-field">
              <label for="abBuildVersion">Build Version</label>
              <input type="text" id="abBuildVersion" value="${escHtml(a.build_version || '')}">
            </div>
            <div class="stock-field">
              <label for="abVersionDate">Version Update Date</label>
              <input type="date" id="abVersionDate" value="${escHtml(a.version_update_date || '')}">
            </div>
            <div class="stock-field">
              <label for="abLastUpdate">Last System Update</label>
              <input type="date" id="abLastUpdate" value="${escHtml(a.last_system_update || '')}">
            </div>
            <div class="stock-field full">
              <label for="abDeveloper">Developer</label>
              <input type="text" id="abDeveloper" value="${escHtml(a.developer || '')}">
            </div>
          </div>

          <div id="aboutEditError" class="login-error" style="display:none;margin-top:14px;"></div>
          <div class="stock-actions" style="margin-top:18px;">
            <button type="button" class="stock-btn stock-btn-secondary" id="abCancelBtn">Cancel</button>
            <button type="button" class="stock-btn stock-btn-primary" id="abSaveBtn">Save Changes</button>
          </div>
        </div>
      ` : `
        <div class="set-card">
          <h3>System Information</h3>
          <div class="set-about-row"><div class="a-label">App Name</div><div class="a-value">${escHtml(a.app_name || '—')}</div></div>
          <div class="set-about-row"><div class="a-label">App Version</div><div class="a-value">${escHtml(a.app_version || '—')}</div></div>
          <div class="set-about-row"><div class="a-label">Database Version</div><div class="a-value">${escHtml(a.db_version || '—')}</div></div>
          <div class="set-about-row"><div class="a-label">Build Version</div><div class="a-value">${escHtml(a.build_version || '—')}</div></div>
          <div class="set-about-row"><div class="a-label">Version Update Date</div><div class="a-value">${escHtml(a.version_update_date || '—')}</div></div>
          <div class="set-about-row"><div class="a-label">Last System Update</div><div class="a-value">${escHtml(a.last_system_update || '—')}</div></div>
          <div class="set-about-row"><div class="a-label">Current Role</div><div class="a-value">${escHtml(a.role || '—')}</div></div>
          <div class="set-about-row"><div class="a-label">Username</div><div class="a-value">${escHtml(a.username || '—')}</div></div>
        </div>

        <div class="set-card">
          <h3>Developer / Copyright</h3>
          <div class="set-about-row"><div class="a-label">Developer</div><div class="a-value">${escHtml(a.developer || '—')}</div></div>
          <div class="set-about-row"><div class="a-label">Copyright</div><div class="a-value">© ${new Date().getFullYear()} — All rights reserved</div></div>
        </div>
      `}

    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    if (isEdit) {
      renderSetAbout(false);
    } else {
      SettingsMenu.view = 'home';
      renderSettingsHome();
    }
  });

  const logsBtn = document.getElementById('aboutLogsBtn');
  if (logsBtn) logsBtn.addEventListener('click', () => renderAboutLogs());

  const editBtn = document.getElementById('aboutEditBtn');
  if (editBtn) editBtn.addEventListener('click', () => renderSetAbout(true));

  const cancelBtn = document.getElementById('abCancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => renderSetAbout(false));

  const saveBtn = document.getElementById('abSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const errDiv = document.getElementById('aboutEditError');
    errDiv.style.display = 'none';

    const payload = {
      app_name: document.getElementById('abAppName').value.trim(),
      app_version: document.getElementById('abAppVersion').value.trim(),
      db_version: document.getElementById('abDbVersion').value.trim(),
      build_version: document.getElementById('abBuildVersion').value.trim(),
      version_update_date: document.getElementById('abVersionDate').value.trim(),
      last_system_update: document.getElementById('abLastUpdate').value.trim(),
      developer: document.getElementById('abDeveloper').value.trim()
    };

    try {
      const res = await api('/api/settings/about-full', { method: 'PATCH', body: payload });
      if (res.changed === false) {
        showToast('No changes to save.', 'info');
      } else {
        showToast(res.message || 'Version information updated successfully.', 'success');
      }
      await setLoadAbout();
      renderSetAbout(false);
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}


/* ==================== ABOUT LOGS ==================== */
async function renderAboutLogs(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="set-header">
      <div><h2>Version Logs</h2><div class="sub">Loading...</div></div>
      <div class="header-actions"><button class="back-btn" id="backBtn">← Back</button></div>
    </div>
    <div class="set-main"><p style="text-align:center;padding:30px;color:var(--rr-muted);">Loading...</p></div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => renderSetAbout(false));

  try {
    const data = await api('/api/settings/about-full/logs');
    const logs = data.logs || [];
    root.innerHTML = `
      <div class="set-header">
        <div><h2>Version Logs</h2><div class="sub">${logs.length} entr${logs.length === 1 ? 'y' : 'ies'}</div></div>
        <div class="header-actions"><button class="back-btn" id="backBtn">← Back</button></div>
      </div>
      <div class="set-main">
        ${logs.length ? logs.map(l => renderAuditRow(l)).join('') : '<div class="thr-empty"><div class="empty-icon">📜</div><div class="empty-title">कोई log नहीं</div></div>'}
      </div>
    `;
    document.getElementById('backBtn').addEventListener('click', () => renderSetAbout(false));
  } catch (e) {
    showToast(e.message, 'error');
  }
}


/* ==================== LOGOUT CONFIRMATION ==================== */
async function doLogoutConfirm(){
  const backdrop = document.createElement('div');
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal" style="max-width:420px;">
      <div class="warn-icon">🚪</div>
      <h3>Logout</h3>
      <p>क्या आप logout करना चाहते हैं?<br>आपकी profile और data सुरक्षित रहेगी।</p>
      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="loCancel">Cancel</button>
        <button class="family-btn family-btn-primary" id="loOk">Logout</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#loCancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('#loOk').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch (e) {}
    window.location.href = '/';
  });
}
