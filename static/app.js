/* ==================== RECORD ROOM - APP ==================== */

const App = {
  user: null,
  view: 'dashboard'
};

/* ---------- API helper ---------- */
async function api(path, options = {}) {
  const opts = {
    credentials: 'same-origin',
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      options.headers || {}
    ),
    ...options
  };
  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
  if (res.status === 401) {
    window.location.href = '/';
    throw new Error('Not authenticated');
  }
  if (!res.ok) {
    const msg = (data && data.error) ? data.error : ('Request failed (' + res.status + ')');
    throw new Error(msg);
  }
  return data;
}

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(message, type) {
  let el = document.getElementById('appToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'appToast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast show' + (type ? ' ' + type : '');
  el.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = 'toast' + (type ? ' ' + type : '');
  }, 2600);
}

/* ---------- Escape HTML ---------- */
function escHtml(text) {
  if (text === null || text === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(text);
  return d.innerHTML;
}

/* ---------- Date/time ---------- */
function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const pad = n => String(n).padStart(2, '0');
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

/* ---------- Age calculation ---------- */
function calcAge(dobIso) {
  if (!dobIso) return '—';
  const dob = new Date(dobIso);
  if (isNaN(dob.getTime())) return '—';
  const now = new Date();
  if (dob > now) return '—';
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  if (now.getDate() < dob.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return '—';
  return years + 'Y' + months + 'M';
}

/* ---------- Sidebar ---------- */
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const btn = document.getElementById('mobileMenuBtn');

  function openSidebar() {
    if (sidebar) sidebar.classList.add('open');
    if (overlay) overlay.classList.add('show');
  }
  function closeSidebar() {
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('show');
  }

  if (btn) btn.addEventListener('click', openSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      navigate(view);
      closeSidebar();
    });
  });

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await api('/api/logout', { method: 'POST' }); } catch (e) {}
      window.location.href = '/';
    });
  }
}

function setActiveNav(view) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });
}

/* ---------- Router ---------- */
function navigate(view) {
  App.view = view;
  setActiveNav(view);
  if (view === 'dashboard') renderDashboard();
  else if (view === 'family') renderFamilyMenu();
  else if (view === 'beneficiaries') renderBeneficiariesMenu();
  else if (view === 'stock') renderStockMenu();
  else if (view === 'attendance') renderAttendanceMenu();
  else if (view === 'holiday') renderHolidayMenu();
  else if (view === 'thr') renderTHRMenu();
  else if (view === 'settings') renderSettingsMenu();
  else if (view === 'reports') renderReportsMenu();
  else renderDashboard();
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  const root = document.getElementById('viewRoot');
  if (!root) return;
  root.innerHTML = `
    <div class="dashboard-wrap">
      <div class="dashboard-card">
        <h2>Welcome, ${escHtml(App.user ? App.user : 'Admin')}</h2>
        <p>Record Room — Data Manager</p>
      </div>
      <div class="dashboard-grid">
        <a class="dashboard-tile" data-goto="family">
          <div class="tile-icon">👨‍👩‍👧</div>
          <div class="tile-title">Family Survey</div>
          <div class="tile-sub">Manage families and members</div>
        </a>
        <a class="dashboard-tile" data-goto="beneficiaries">
          <div class="tile-icon">🤱</div>
          <div class="tile-title">Beneficiaries</div>
          <div class="tile-sub">Pregnant, Lactating & Children</div>
        </a>
        <a class="dashboard-tile" data-goto="stock">
          <div class="tile-icon">📦</div>
          <div class="tile-title">Stock Register</div>
          <div class="tile-sub">THR, Milk, Sugar & More</div>
        </a>
        <a class="dashboard-tile" data-goto="attendance">
          <div class="tile-icon">📋</div>
          <div class="tile-title">Attendance</div>
          <div class="tile-sub">3-6 Years Children</div>
        </a>
        <a class="dashboard-tile" data-goto="holiday">
          <div class="tile-icon">🎉</div>
          <div class="tile-title">Holiday</div>
          <div class="tile-sub">Manage Holidays</div>
        </a>
        <a class="dashboard-tile" data-goto="thr">
          <div class="tile-icon">🍲</div>
          <div class="tile-title">THR</div>
          <div class="tile-sub">Take Home Ration Distribution</div>
        </a>
        <a class="dashboard-tile" data-goto="settings">
          <div class="tile-icon">⚙️</div>
          <div class="tile-title">Settings</div>
          <div class="tile-sub">Account, Security & Recycle Bin</div>
        </a>
        <a class="dashboard-tile" data-goto="reports">
          <div class="tile-icon">📊</div>
          <div class="tile-title">Reports</div>
          <div class="tile-sub">6 Forms + Monthly Register</div>
        </a>
      </div>
    </div>
  `;
  root.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.goto);
    });
  });
}

/* ---------- Family menu entry ---------- */
function renderFamilyMenu() {
  if (typeof FamilyMenu !== 'undefined' && FamilyMenu.open) {
    FamilyMenu.open();
  } else {
    const root = document.getElementById('viewRoot');
    if (root) {
      root.innerHTML = `
        <div class="family-header">
          <h2>Family Survey</h2>
        </div>
        <div class="member-detail-card">
          <p>Family Survey module loading...</p>
        </div>
      `;
    }
  }
}

function renderBeneficiariesMenu() {
  if (typeof BeneficiariesMenu !== 'undefined' && BeneficiariesMenu.open) {
    BeneficiariesMenu.open();
  } else {
    const root = document.getElementById('viewRoot');
    if (root) {
      root.innerHTML = `
        <div class="bene-header">
          <h2>Beneficiaries</h2>
        </div>
        <div class="bene-detail">
          <p>Beneficiaries module loading...</p>
        </div>
      `;
    }
  }
}

function renderStockMenu() {
  if (typeof StockMenu !== 'undefined' && StockMenu.open) {
    StockMenu.open();
  } else {
    const root = document.getElementById('viewRoot');
    if (root) {
      root.innerHTML = `
        <div class="stock-header">
          <h2>Stock Register</h2>
        </div>
        <div class="stock-detail-card">
          <p>Stock module loading...</p>
        </div>
      `;
    }
  }
}

function renderAttendanceMenu() {
  if (typeof AttendanceMenu !== 'undefined' && AttendanceMenu.open) {
    AttendanceMenu.open();
  } else {
    const root = document.getElementById('viewRoot');
    if (root) {
      root.innerHTML = `
        <div class="att-header"><h2>Attendance</h2></div>
        <div class="att-main"><p>Attendance module loading...</p></div>
      `;
    }
  }
}

function renderReportsMenu() {
  if (typeof ReportsMenu !== 'undefined' && ReportsMenu.open) {
    ReportsMenu.open();
  } else {
    const root = document.getElementById('viewRoot');
    if (root) {
      root.innerHTML = `
        <div class="set-header"><h2>Reports</h2></div>
        <div class="set-main"><p style="text-align:center;padding:30px;color:var(--rr-muted);">Loading Reports...</p></div>
      `;
    }
  }
}

function renderSettingsMenu() {
  if (typeof SettingsMenu !== 'undefined' && SettingsMenu.open) {
    SettingsMenu.open();
  } else {
    const root = document.getElementById('viewRoot');
    if (root) {
      root.innerHTML = `
        <div class="set-header"><h2>Settings</h2></div>
        <div class="set-main"><p style="text-align:center;padding:30px;color:var(--rr-muted);">Loading settings...</p></div>
      `;
    }
  }
}

function renderTHRMenu() {
  if (typeof THRMenu !== 'undefined' && THRMenu.open) {
    THRMenu.open();
  } else {
    const root = document.getElementById('viewRoot');
    if (root) {
      root.innerHTML = `
        <div class="thr-header"><h2>THR</h2><div class="sub">Loading...</div></div>
        <div class="thr-main"><p style="text-align:center;padding:30px;color:var(--rr-muted);">Loading THR module...</p></div>
      `;
    }
  }
}

function renderHolidayMenu() {
  if (typeof HolidayMenu !== 'undefined' && HolidayMenu.open) {
    HolidayMenu.open();
  } else {
    const root = document.getElementById('viewRoot');
    if (root) {
      root.innerHTML = `
        <div class="att-header"><h2>Holiday</h2></div>
        <div class="att-main"><p>Holiday module loading...</p></div>
      `;
    }
  }
}

/* ---------- Init ---------- */
async function initApp() {
  try {
    const me = await api('/api/me');
    if (!me || !me.authenticated) {
      window.location.href = '/';
      return;
    }
    App.user = me.username || 'admin';
    const sidebarUser = document.getElementById('sidebarUser');
    if (sidebarUser) sidebarUser.textContent = App.user;
  } catch (e) {
    window.location.href = '/';
    return;
  }
  setupSidebar();
  navigate('dashboard');
}

document.addEventListener('DOMContentLoaded', initApp);
