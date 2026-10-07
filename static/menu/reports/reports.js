/* ==================== REPORTS MENU ==================== */

const ReportsMenu = {
  view: 'list',           // list | form | register
  type: null,             // selected form type
  year: 0,
  month: 0,
  types: {},
  register: {
    reports: [],
    selected: null,
    versions: [],
    selectedVersion: null
  },
  gkPayload: null,
  gkWizardStep: 1,
  gkMode: 'manual',
  mkPayload: null,
  mkWizardStep: 1,
  mkMode: 'manual',
  msrPayload: null,
  msrWizardStep: 1,
  msrMode: 'manual'
};

const REPORTS_MONTHS = ['', 'January','February','March','April','May','June',
                        'July','August','September','October','November','December'];

function reportsFmtMonth(n){
  return REPORTS_MONTHS[n] || '';
}

function reportsTypeLabel(code){
  return (ReportsMenu.types[code] && ReportsMenu.types[code].label) || code;
}

function reportsTypeIcon(code){
  return (ReportsMenu.types[code] && ReportsMenu.types[code].icon) || '📄';
}

/* ==================== API ==================== */
async function loadReportTypes(){
  if (Object.keys(ReportsMenu.types).length) return;
  const data = await api('/api/reports/types');
  ReportsMenu.types = data.types || {};
}

/* ==================== ENTRY ==================== */
ReportsMenu.open = async function(){
  ReportsMenu.view = 'list';
  ReportsMenu.type = null;
  const now = new Date();
  ReportsMenu.year = now.getFullYear();
  ReportsMenu.month = now.getMonth() + 1;
  try {
    await loadReportTypes();
    renderReportsList();
  } catch (e) {
    showToast(e.message, 'error');
  }
};


/* ==================== RENDER: REPORTS LANDING (6 tiles) ==================== */
function renderReportsList(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const TILES = [
    { code: 'GARMA_KHANA', icon: '🍲', color: 'orange', sub: 'गरम पूरक पोषाहार दावा प्रपत्र' },
    { code: 'MILK_CLAIM',  icon: '🥛', color: 'blue',   sub: '3-6 वर्ष बच्चों का दूध दावा प्रपत्र' },
    { code: 'MILK_STOCK',  icon: '📦', color: 'green',  sub: 'दूध + चीनी स्टॉक रजिस्टर' },
    { code: 'FORM4',       icon: '📄', color: 'purple', sub: 'पूरक पोषण दैनिक मासिक प्रगति' },
    { code: 'MPR',         icon: '📊', color: 'blue',   sub: 'मासिक प्रगति रिपोर्ट' },
    { code: 'STOCK_THR',   icon: '📋', color: 'orange', sub: 'THR पोषाहार स्टॉक रजिस्टर' }
  ];

  root.innerHTML = `
    <div class="reports-header">
      <div>
        <h2>Reports</h2>
        <div class="sub">6 Forms · Manual Fill + Blank Form</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="registerBtn">📚 Monthly Register</button>
      </div>
    </div>

    <div class="reports-main">
      <div class="reports-grid">
        ${TILES.map(t => `
          <button class="reports-tile" data-type="${t.code}">
            <div class="tile-icon ${t.color}">${t.icon}</div>
            <div class="tile-body">
              <div class="tile-title">${escHtml(reportsTypeLabel(t.code))}</div>
              <div class="tile-sub">${escHtml(t.sub)}</div>
            </div>
            <div class="tile-arrow">›</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  // Form tile click → Form landing
  root.querySelectorAll('.reports-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.type;
      ReportsMenu.type = t;
      ReportsMenu.view = 'form';
      renderFormLanding(t);
    });
  });

  // Register button
  document.getElementById('registerBtn').addEventListener('click', () => {
    ReportsMenu.view = 'register';
    renderMonthlyRegister();
  });
}


/* ==================== RENDER: FORM LANDING (2 options) ==================== */
function renderFormLanding(type){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const label = reportsTypeLabel(type);
  const icon = reportsTypeIcon(type);

  root.innerHTML = `
    <div class="reports-header">
      <div>
        <h2>${escHtml(label)}</h2>
        <div class="sub">क्या करना है चुनिए</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="reports-main">
      <div class="form-landing-card">
        <h3>${icon} ${escHtml(label)}</h3>
        <p>नीचे दो विकल्प में से एक चुनें।</p>
      </div>

      <div class="form-options">
        <button class="form-option" data-action="manual">
          <span class="opt-icon">✍️</span>
          <div class="opt-body">
            <div class="opt-title">Manual Fill & Generate</div>
            <div class="opt-sub">form भरें, preview देखें, print करें और save करें</div>
          </div>
        </button>

        <button class="form-option" data-action="blank">
          <span class="opt-icon">🖨️</span>
          <div class="opt-body">
            <div class="opt-title">Download Blank Form</div>
            <div class="opt-sub">खाली form देखें और print / save as PDF करें</div>
          </div>
        </button>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    ReportsMenu.view = 'list';
    ReportsMenu.type = null;
    renderReportsList();
  });

  root.querySelectorAll('.form-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (type === 'GARMA_KHANA') {
        renderGarmaKhanaForm(action === 'blank' ? 'blank' : 'manual');
      } else if (type === 'MILK_CLAIM') {
        renderMilkClaimForm(action === 'blank' ? 'blank' : 'manual');
      } else if (type === 'MILK_STOCK') {
        renderMilkStockForm(action === 'blank' ? 'blank' : 'manual');
      } else if (type === 'FORM4') {
        if (typeof window.renderForm4Form === 'function') {
          window.renderForm4Form(action === 'blank' ? 'blank' : 'manual');
        } else {
          showToast('Form 4 module load नहीं हुआ', 'error');
        }
      } else {
        showToast('"' + action + '" — यह form अभी बनना बाकी है।', 'info');
      }
    });
  });
}


/* ==================== RENDER: MONTHLY REGISTER ==================== */
function renderMonthlyRegister(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const year = ReportsMenu.year;
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 3; y <= currentYear + 1; y++) years.push(y);

  root.innerHTML = `
    <div class="reports-header">
      <div>
        <h2>Monthly Register</h2>
        <div class="sub">सभी saved report versions</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="reports-main">
      <div class="form-landing-card">
        <h3>📚 Monthly Register</h3>
        <p>Saved reports के versions यहाँ दिखेंगे।</p>
      </div>

      <div class="form-landing-card">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;">
          <div class="stock-field" style="min-width:140px;">
            <label>Year</label>
            <select id="regYear">
              ${years.map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
          <div class="stock-field" style="flex:0 0 auto;">
            <label>&nbsp;</label>
            <button class="stock-btn stock-btn-secondary" id="refreshBtn" style="min-height:46px;">↻ Refresh</button>
          </div>
        </div>
      </div>

      <div id="registerList">
        <p style="text-align:center;padding:30px;color:var(--rr-muted);">Loading...</p>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    ReportsMenu.view = 'list';
    renderReportsList();
  });

  document.getElementById('regYear').addEventListener('change', (e) => {
    ReportsMenu.year = parseInt(e.target.value, 10);
    loadRegisterList();
  });

  document.getElementById('refreshBtn').addEventListener('click', loadRegisterList);

  loadRegisterList();
}

async function loadRegisterList(){
  const listEl = document.getElementById('registerList');
  if (!listEl) return;
  listEl.innerHTML = '<p style="text-align:center;padding:30px;color:var(--rr-muted);">Loading...</p>';
  try {
    const data = await api('/api/reports/register?year=' + ReportsMenu.year);
    const reports = data.reports || [];
    if (!reports.length) {
      listEl.innerHTML = `
        <div class="form-landing-card" style="text-align:center;padding:36px 24px;">
          <div style="font-size:44px;opacity:.6;margin-bottom:10px;">📚</div>
          <div style="font-size:16px;font-weight:800;color:var(--rr-ink);margin-bottom:4px;">कोई saved report नहीं</div>
          <div style="font-size:13px;color:var(--rr-muted);">जब report save करेंगे तो यहाँ दिखेगी</div>
        </div>
      `;
      return;
    }
    listEl.innerHTML = `
      <div class="reports-grid">
        ${reports.map(r => `
          <button class="reports-tile" data-rtype="${r.report_type}" data-year="${r.year}" data-month="${r.month}">
            <div class="tile-icon purple">${reportsTypeIcon(r.report_type)}</div>
            <div class="tile-body">
              <div class="tile-title">${escHtml(reportsTypeLabel(r.report_type))}</div>
              <div class="tile-sub">
                ${reportsFmtMonth(r.month)} ${r.year} · ${r.version_count} version${r.version_count === 1 ? '' : 's'}
              </div>
            </div>
            <div class="tile-arrow">›</div>
          </button>
        `).join('')}
      </div>
    `;
    listEl.querySelectorAll('.reports-tile').forEach(btn => {
      btn.addEventListener('click', () => {
        const rtype = btn.dataset.rtype;
        const y = parseInt(btn.dataset.year, 10);
        const m = parseInt(btn.dataset.month, 10);
        openRegisterDetail(rtype, y, m);
      });
    });
  } catch (e) {
    listEl.innerHTML = `<div class="form-landing-card" style="color:#b0271f;">${escHtml(e.message)}</div>`;
  }
}

async function openRegisterDetail(rtype, year, month){
  showToast('Register detail अभी बनना बाकी है — Round 3 में आएगा।', 'info');
}


/* ==================== RENDER: REGISTER DETAIL (version list) ==================== */
async function openRegisterDetail(rtype, year, month){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  root.innerHTML = `
    <div class="reports-header">
      <div><h2>Loading...</h2></div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>
    <div class="reports-main">
      <p style="text-align:center;padding:30px;color:var(--rr-muted);">Loading...</p>
    </div>
  `;
  document.getElementById('backBtn').addEventListener('click', () => {
    ReportsMenu.view = 'register';
    renderMonthlyRegister();
  });

  try {
    const data = await api('/api/reports/register/' + rtype + '/' + year + '/' + month);
    ReportsMenu.register.selected = data;
    ReportsMenu.register.selectedVersion = null;
    renderRegisterDetail();
  } catch (e) {
    showToast(e.message, 'error');
    renderMonthlyRegister();
  }
}

function renderRegisterDetail(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const d = ReportsMenu.register.selected;
  if (!d) { renderMonthlyRegister(); return; }
  const versions = d.versions || [];

  root.innerHTML = `
    <div class="reports-header">
      <div>
        <h2>${escHtml(d.report_label)}</h2>
        <div class="sub">${reportsFmtMonth(d.month)} ${d.year} · ${versions.length} version${versions.length === 1 ? '' : 's'}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="reports-main">
      <div class="form-landing-card">
        <h3>${reportsTypeIcon(d.report_type)} ${escHtml(d.report_label)} — ${reportsFmtMonth(d.month)} ${d.year}</h3>
        <p>सभी versions नीचे दिख रहे हैं। किसी पर click करके preview देख सकते हैं।</p>
      </div>

      <div id="versionList">
        ${versions.length ? versions.map(v => `
          <button class="reports-tile" data-vid="${v.id}" style="margin-bottom:10px;">
            <div class="tile-icon purple">v${v.version_no}</div>
            <div class="tile-body">
              <div class="tile-title">Version v${v.version_no}</div>
              <div class="tile-sub">
                📅 ${fmtDateTime(v.created_at)}
                ${v.created_by_username ? ' · 👤 ' + escHtml(v.created_by_username) : ''}
              </div>
            </div>
            <div class="tile-arrow">›</div>
          </button>
        `).join('') : `
          <div class="form-landing-card" style="text-align:center;padding:36px 24px;">
            <div style="font-size:44px;opacity:.6;margin-bottom:10px;">📄</div>
            <div style="font-size:16px;font-weight:800;color:var(--rr-ink);">कोई version नहीं</div>
          </div>
        `}
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    ReportsMenu.view = 'register';
    renderMonthlyRegister();
  });

  root.querySelectorAll('#versionList .reports-tile').forEach(btn => {
    btn.addEventListener('click', () => {
      const vid = parseInt(btn.dataset.vid, 10);
      openVersionPreview(vid);
    });
  });
}


/* ==================== RENDER: VERSION PREVIEW ==================== */
async function openVersionPreview(vid){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  root.innerHTML = `
    <div class="reports-header">
      <div><h2>Loading version...</h2></div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>
    <div class="reports-main">
      <p style="text-align:center;padding:30px;color:var(--rr-muted);">Loading...</p>
    </div>
  `;
  document.getElementById('backBtn').addEventListener('click', () => {
    renderRegisterDetail();
  });

  try {
    const data = await api('/api/reports/version/' + vid);
    const v = data.version;
    ReportsMenu.register.selectedVersion = v;

    root.innerHTML = `
      <div class="reports-header">
        <div>
          <h2>Version v${v.version_no}</h2>
          <div class="sub">${escHtml(v.report_label)} · ${reportsFmtMonth(v.month)} ${v.year}</div>
        </div>
        <div class="header-actions">
          <button class="back-btn" id="backBtn">← Back</button>
        </div>
      </div>

      <div class="reports-main">
        <div class="form-landing-card">
          <h3>📌 Version v${v.version_no} — ${escHtml(v.report_label)}</h3>
          <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:8px;font-size:13px;color:var(--rr-muted);font-weight:600;">
            <span>📅 ${fmtDateTime(v.created_at)}</span>
            ${v.created_by ? '<span>👤 ' + escHtml(v.created_by) + '</span>' : ''}
          </div>
        </div>

        <div class="form-landing-card">
          <h3>📋 Saved Payload</h3>
          <p style="margin-bottom:12px;">यह version के data हैं (preview form Round 4 के बाद बनेगा)।</p>
          <pre style="background:#f8f8fa;padding:14px;border-radius:10px;font-size:12px;overflow:auto;max-height:400px;">${escHtml(JSON.stringify(v.payload, null, 2))}</pre>
        </div>

        <div class="stock-actions">
          <button class="stock-btn stock-btn-secondary" id="delVersionBtn" style="color:#b0271f;">🗑 Delete This Version</button>
        </div>
      </div>
    `;

    document.getElementById('backBtn').addEventListener('click', () => {
      renderRegisterDetail();
    });

    document.getElementById('delVersionBtn').addEventListener('click', () => {
      deleteVersions([vid]);
    });

  } catch (e) {
    showToast(e.message, 'error');
    renderRegisterDetail();
  }
}


/* ==================== DELETE VERSIONS ==================== */
async function deleteVersions(ids){
  if (!ids.length) { showToast('कोई version select नहीं।', 'info'); return; }
  const d = ReportsMenu.register.selected;
  if (!d) return;

  if (!confirm(ids.length + ' version(s) delete करने हैं?\n\nवे Recycle Bin → Medium Actions में जाएँगे (वहाँ से restore कर सकते हैं)।')) return;

  try {
    const res = await api('/api/reports/register/' + d.report_type + '/' + d.year + '/' + d.month + '/delete-versions', {
      method: 'POST',
      body: { version_ids: ids }
    });
    showToast(res.message || 'Versions deleted.', 'success');
    // reload register detail
    await openRegisterDetail(d.report_type, d.year, d.month);
  } catch (e) {
    showToast(e.message, 'error');
  }
}


/* ==================== GARMA KHANA HELPERS ==================== */

// Hindi month names for गरम खाना
const GK_MONTHS_HINDI = ['', 'जनवरी','फरवरी','मार्च','अप्रैल','मई','जून',
                        'जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'];
function gkMonthHindi(n){
  return GK_MONTHS_HINDI[n] || '';
}

// Recipes based on day-of-week (from reference business rules)
const GK_RECIPES = {
  1: 'खिचड़ी',      // Monday
  2: 'दलिया',       // Tuesday
  3: 'उपमा',        // Wednesday
  4: 'खिचड़ी',      // Thursday
  5: 'दलिया',       // Friday
  6: 'उपमा',        // Saturday
  0: ''             // Sunday — locked
};

function gkDaysInMonth(y, m){
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function gkDow(y, m, d){
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
function gkIso(y, m, d){
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
function gkDateLabel(iso){
  if (!iso) return '';
  const a = String(iso).split('-');
  return a.length === 3 ? a[2] + '/' + a[1] + '/' + a[0].slice(-2) : iso;
}
function gkDayName(dow){
  return ['रविवार','सोमवार','मंगलवार','बुधवार','गुरुवार','शुक्रवार','शनिवार'][dow] || '';
}

// Amount in words (Hindi) — 0.45 formula reference
function gkRupeesWords(n){
  n = Math.max(0, Number(n) || 0);
  let rupee = Math.floor(n + 0.00001);
  let paise = Math.round((n - rupee) * 100);
  if (paise === 100) { rupee++; paise = 0; }

  const H = [
    'शून्य','एक','दो','तीन','चार','पाँच','छह','सात','आठ','नौ',
    'दस','ग्यारह','बारह','तेरह','चौदह','पंद्रह','सोलह','सत्रह','अठारह','उन्नीस',
    'बीस','इक्कीस','बाईस','तेईस','चौबीस','पच्चीस','छब्बीस','सत्ताईस','अट्ठाईस','उनतीस',
    'तीस','इकतीस','बत्तीस','तैंतीस','चौंतीस','पैंतीस','छत्तीस','सैंतीस','अड़तीस','उनतालीस',
    'चालीस','इकतालीस','बयालीस','तैंतालीस','चवालीस','पैंतालीस','छियालीस','सैंतालीस','अड़तालीस','उनचास',
    'पचास','इक्यावन','बावन','तिरेपन','चौवन','पचपन','छप्पन','सत्तावन','अट्ठावन','उनसठ',
    'साठ','इकसठ','बासठ','तिरसठ','चौंसठ','पैंसठ','छियासठ','सड़सठ','अड़सठ','उनहत्तर',
    'सत्तर','इकहत्तर','बहत्तर','तिहत्तर','चौहत्तर','पचहत्तर','छिहत्तर','सतहत्तर','अठहत्तर','उन्यासी',
    'अस्सी','इक्यासी','बयासी','तिरासी','चौरासी','पचासी','छियासी','सतासी','अट्ठासी','नवासी',
    'नब्बे','इक्यानवे','बानवे','तिरानवे','चौरानवे','पंचानवे','छियानवे','सत्तानवे','अट्ठानवे','निन्यानवे'
  ];

  function below1000(x){
    if (x === 0) return '';
    if (x < 100) return H[x];
    const h = Math.floor(x / 100);
    const r = x % 100;
    return H[h] + ' सौ' + (r ? ' ' + H[r] : '');
  }

  function full(x){
    if (x === 0) return 'शून्य';
    const out = [];
    const crore = Math.floor(x / 10000000); x %= 10000000;
    const lakh  = Math.floor(x / 100000);    x %= 100000;
    const thou  = Math.floor(x / 1000);      x %= 1000;
    if (crore) out.push(below1000(crore) + ' करोड़');
    if (lakh)  out.push(below1000(lakh) + ' लाख');
    if (thou)  out.push(below1000(thou) + ' हजार');
    if (x)     out.push(below1000(x));
    return out.join(' ');
  }

  const p = paise ? H[paise] + ' पैसे' : 'शून्य पैसे';
  return full(rupee) + ' रुपये और ' + p + ' मात्र';
}

// Build default payload for गरम खाना
function gkDefaultPayload(year, month){
  const n = gkDaysInMonth(year, month);
  const daily = [];
  for (let d = 1; d <= n; d++){
    const dow = gkDow(year, month, d);
    const isSunday = dow === 0;
    daily.push({
      date: gkIso(year, month, d),
      day: d,
      dow: dow,
      dayName: gkDayName(dow),
      holiday: isSunday ? { name: 'रविवार', type: 'SUNDAY' } : null,
      recipe: isSunday ? '' : (GK_RECIPES[dow] || ''),
      beneficiaries: ''
    });
  }
  return {
    year: year,
    month: month,
    meta: {
      centreName: '',
      project: '',
      sector: '',
      district: '',
      code: ''
    },
    daily: daily,
    total_beneficiaries: 0,
    reimbursement: 0
  };
}

// Recalculate totals from daily rows
function gkRecalc(payload){
  if (!payload || !Array.isArray(payload.daily)) return payload;
  let total = 0;
  payload.daily.forEach(r => {
    if (r.holiday) { r.beneficiaries = ''; return; }
    const v = parseInt(r.beneficiaries, 10);
    total += isNaN(v) ? 0 : v;
  });
  payload.total_beneficiaries = total;
  payload.reimbursement = Number((total * 0.45).toFixed(2));
  return payload;
}

// Compute preview totals for screen
function gkComputeTotals(payload){
  if (!payload || !Array.isArray(payload.daily)) {
    return { total: 0, amount: 0, days: 0, holidays: 0 };
  }
  let total = 0, days = 0, holidays = 0;
  payload.daily.forEach(r => {
    if (r.holiday) { holidays++; return; }
    days++;
    const v = parseInt(r.beneficiaries, 10);
    total += isNaN(v) ? 0 : v;
  });
  return {
    total: total,
    amount: Number((total * 0.45).toFixed(2)),
    days: days,
    holidays: holidays
  };
}


/* ==================== RENDER: GARMA KHANA FORM ==================== */

async function renderGarmaKhanaForm(mode){
  // mode = 'manual' | 'blank'
  const year = ReportsMenu.year;
  const month = ReportsMenu.month;
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) years.push(y);

  // Load draft if not already loaded
  if (mode === 'manual') {
    try {
      const d = await api('/api/reports/GARMA_KHANA/draft?year=' + year + '&month=' + month);
      ReportsMenu.gkPayload = (d.draft && d.draft.daily && d.draft.daily.length)
        ? d.draft
        : gkDefaultPayload(year, month);
    } catch (e) {
      ReportsMenu.gkPayload = gkDefaultPayload(year, month);
    }
    gkRecalc(ReportsMenu.gkPayload);
  } else {
    ReportsMenu.gkPayload = gkDefaultPayload(year, month);
    gkRecalc(ReportsMenu.gkPayload);
  }

  ReportsMenu.gkWizardStep = 1;
  ReportsMenu.gkMode = mode;
  renderGarmaKhanaWizard();
}


function renderGarmaKhanaWizard(){
  const mode = ReportsMenu.gkMode || 'manual';
  const step = ReportsMenu.gkWizardStep || 1;
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const stepTitles = [
    { n: 1, title: 'केन्द्र जानकारी', sub: 'Month, Year, Centre' },
    { n: 2, title: 'बच्चों की संख्या', sub: 'Daily entries + Totals' },
    { n: 3, title: 'Preview + Save', sub: 'Print / Save Draft / Send' }
  ];
  const isBlank = mode === 'blank';
  const monthName = reportsFmtMonth(ReportsMenu.month);

  root.innerHTML = `
    <div class="reports-header">
      <div>
        <h2>${isBlank ? 'गरम खाना — Blank Form' : 'गरम खाना दावा प्रपत्र'}</h2>
        <div class="sub">${monthName} ${ReportsMenu.year} · Step ${step} of 3</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="reports-main">
      ${isBlank ? '' : `
        <div class="gk-stepper">
          ${stepTitles.map(s => `
            <button type="button" class="${step === s.n ? 'active' : (step > s.n ? 'done' : '')}" data-step="${s.n}">
              <span class="gk-step-no">${step > s.n ? '✓' : s.n}</span>
              <span class="gk-step-body">
                <span class="gk-step-title">${s.title}</span>
                <span class="gk-step-sub">${s.sub}</span>
              </span>
            </button>
          `).join('')}
        </div>
      `}

      <div id="gkWizardBody"></div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    ReportsMenu.view = 'form';
    ReportsMenu.gkWizardStep = 1;
    renderFormLanding('GARMA_KHANA');
  });

  // Stepper click — किसी भी step पर direct jump
  root.querySelectorAll('.gk-stepper button').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.dataset.step, 10);
      ReportsMenu.gkWizardStep = target;
      renderGarmaKhanaWizard();
    });
  });

  const body = document.getElementById('gkWizardBody');
  if (step === 1) renderGKWizardStep1(body, isBlank);
  else if (step === 2) renderGKWizardStep2(body, isBlank);
  else renderGKWizardStep3(body, isBlank);
}


/* ==================== WIZARD STEP 1: Month + Centre Details ==================== */
function renderGKWizardStep1(body, isBlank){
  const p = ReportsMenu.gkPayload;
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) years.push(y);

  body.innerHTML = `
    <div class="form-landing-card">
      <h3>📅 Month & Year</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;">
        <div class="stock-field" style="min-width:140px;flex:1;">
          <label>Month</label>
          <select id="gkMonth">
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
              <option value="${m}" ${m === ReportsMenu.month ? 'selected' : ''}>${reportsFmtMonth(m)}</option>
            `).join('')}
          </select>
        </div>
        <div class="stock-field" style="min-width:110px;flex:1;">
          <label>Year</label>
          <select id="gkYear">
            ${years.map(y => `<option value="${y}" ${y === ReportsMenu.year ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    ${isBlank ? '' : `
      <div class="form-landing-card">
        <h3>📋 Centre Details</h3>
        <div class="gk-meta-grid" style="margin-top:12px;">
          <div class="stock-field">
            <label>केन्द्र का नाम</label>
            <input type="text" id="gkCentreName" value="${escHtml(p.meta.centreName || '')}">
          </div>
          <div class="stock-field">
            <label>कोड</label>
            <input type="text" id="gkCode" value="${escHtml(p.meta.code || '')}">
          </div>
          <div class="stock-field">
            <label>परियोजना</label>
            <input type="text" id="gkProject" value="${escHtml(p.meta.project || '')}">
          </div>
          <div class="stock-field">
            <label>सेक्टर</label>
            <input type="text" id="gkSector" value="${escHtml(p.meta.sector || '')}">
          </div>
          <div class="stock-field">
            <label>जिला</label>
            <input type="text" id="gkDistrict" value="${escHtml(p.meta.district || '')}">
          </div>
        </div>
      </div>
    `}

    <div class="gk-wizard-nav">
      <div></div>
      <button class="stock-btn stock-btn-primary" id="gkNext1">आगे बढ़ें →</button>
    </div>
  `;

  // Month/Year change
  document.getElementById('gkMonth').addEventListener('change', (e) => {
    ReportsMenu.month = parseInt(e.target.value, 10);
    renderGarmaKhanaForm(ReportsMenu.gkMode);
  });
  document.getElementById('gkYear').addEventListener('change', (e) => {
    ReportsMenu.year = parseInt(e.target.value, 10);
    renderGarmaKhanaForm(ReportsMenu.gkMode);
  });

  // Meta inputs — bind and persist
  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      ReportsMenu.gkPayload.meta[key] = el.value;
    });
  };
  bind('gkCentreName', 'centreName');
  bind('gkCode', 'code');
  bind('gkProject', 'project');
  bind('gkSector', 'sector');
  bind('gkDistrict', 'district');

  // Next
  document.getElementById('gkNext1').addEventListener('click', () => {
    ReportsMenu.gkWizardStep = 2;
    renderGarmaKhanaWizard();
  });
}


/* ==================== SHEET CSS (single source for preview + print) ==================== */
const GK_SHEET_CSS = `
.gk-sheet{
  width:210mm;
  min-height:281mm;
  margin:0 auto;
  background:#fff;
  color:#111;
  padding:9mm 15mm 7mm;
  box-sizing:border-box;
  font-family:"Nirmala UI","Mangal","Noto Sans Devanagari",Arial,sans-serif;
}
.gk-office{
  text-align:center;
  font-size:37px;
  line-height:1.25;
  font-weight:600;
  margin-top:0;
  margin-bottom:-0.5mm;
}
.gk-office-value{padding-left:2mm}
.gk-title{
  text-align:center;
  font-size:22px;
  line-height:1.24;
  font-weight:500;
  margin-bottom:2.5mm;
}
.gk-meta{
  font-size:18px;
  line-height:1.5;
  margin-bottom:2.5mm;
  font-weight:500;
}
.gk-meta-row{
  display:flex;
  gap:4mm;
  align-items:baseline;
  margin-bottom:1mm;
}
.gk-meta-item{white-space:nowrap}
.gk-meta-value{
  display:inline-block;
  min-width:34mm;
  font-size:16px;
  border-bottom:1px dotted #333;
  padding:0 2px;
  font-weight:450 !important;
  text-align:center;
}
.gk-meta-value.gk-meta-month{ min-width:20mm !important; }
.gk-meta-value.gk-meta-year{ min-width:14mm !important; }
.gk-table{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
  font-size:calc(11.5pt + 2px);
  font-weight:400;
}
.gk-table th,
.gk-table td{
  border:1px solid #161616;
  padding:1.65mm 1.1mm;
  text-align:center;
  vertical-align:middle;
  line-height:1.18;
}
.gk-table th{font-weight:600;background:#fffdf4}
.gk-table tbody td{padding:.35mm 1.1mm;line-height:1.02;height:5.2mm}
.gk-table .gk-th-date{font-size:calc(11.2pt + 6px);font-weight:600}
.gk-table .gk-th-recipe{font-size:calc(11pt + 6px);font-weight:400}
.gk-table .gk-th-recipe b{font-weight:400}
.gk-table .gk-th-recipe small{font-size:calc(11pt - 2px);font-weight:500;display:block}
.gk-table .gk-th-count{font-size:calc(11pt + 2px);font-weight:600}
.gk-table tbody td.gk-cell-date{font-size:calc(12.5pt - 1px);font-weight:600}
.gk-table tbody td.gk-cell-recipe{font-size:calc(9.5pt + 5px);font-weight:400}
.gk-table tbody td.gk-cell-count{font-size:calc(9.5pt + 2px);font-weight:400}
.gk-holiday-date{color:#b0251f;font-weight:600}
.gk-holiday-bar{color:#b0251f;font-weight:600;padding:0!important}
.gk-holiday-bar>div{display:flex;align-items:center;gap:2mm;height:100%;min-height:5mm}
.gk-holiday-bar i{height:0;border-top:3px solid #b0251f;flex:1;display:block}
.gk-holiday-bar b{font-size:13px;white-space:nowrap;font-weight:600}
.gk-total-cell{color:#b0251f!important;font-weight:600!important;background:#fff8f7!important}
.gk-table .gk-total-cell{font-size:calc(11.5pt + 9px)}
.gk-reimbursement{
  font-size:calc(12.5pt + 5px);
  line-height:1.45;
  margin-top:3mm;
  text-align:center;
  font-weight:400;
}
.gk-claim-fill{
  display:inline-block;
  min-width:15mm;
  padding:0 2mm 1px;
  border-bottom:1px dotted #333;
  font-weight:450;
  text-align:center;
}
.gk-words{
  margin-top:4mm;
  min-height:6.5mm;
  font-size:calc(12.5pt + 5px);
  text-align:center;
  font-weight:400;
}
.gk-words b{font-weight:400}
.gk-words-fill{
  display:inline-block;
  min-width:80mm;
  max-width:110mm;
  padding:0 2mm 1px;
  border-bottom:1px dotted #333;
  font-weight:400;
}
.gk-cert{
  font-size:calc(11.5pt + 4px);
  line-height:1.45;
  text-align:justify;
  margin-top:4mm;
  font-weight:400;
}
.gk-worker-sign{
  text-align:right;
  margin-top:5mm;
  font-size:calc(13.5pt + 4px);
  font-weight:400;
  line-height:1.60;
}
.gk-sign-space{height:15mm}
.gk-seal{font-weight:400;margin-top:0mm}
.gk-approvals{
  margin-top:0mm;
  font-size:calc(13.5pt + 4px);
  line-height:1.60;
  font-weight:400;
}
.gk-dotted{
  display:inline-block;
  min-width:45mm;
  border-bottom:1px dotted #333;
  vertical-align:baseline;
  margin-left:4mm;
}

/* ============ PRINT LAYOUT (A4 Portrait, single page — matches reference dava.css) ============ */
@media print{
  @page{ size:A4 portrait; margin:0 !important; }
  html,body{
    width:100% !important;
    height:100% !important;
    margin:0 !important;
    padding:0 !important;
    background:#fff !important;
    overflow:hidden !important;
  }
  body *{ visibility:hidden !important; }
  .gk-sheet.gk-print-active,
  .gk-sheet.gk-print-active *{ visibility:visible !important; }
  .gk-sheet.gk-print-active{
    position:absolute !important;
    left:50% !important;
    top:0 !important;
    transform:translateX(-50%) !important;
    transform-origin:top center !important;
    width:221.053mm !important;
    height:312.632mm !important;
    min-width:0 !important;
    min-height:0 !important;
    max-width:none !important;
    max-height:none !important;
    margin:0 !important;
    padding:9mm 15mm 7mm !important;
    box-sizing:border-box !important;
    zoom:.95 !important;
    overflow:hidden !important;
    box-shadow:none !important;
    background:#fff !important;
    break-inside:avoid !important;
    page-break-inside:avoid !important;
    page-break-after:avoid !important;
  }
  .gk-sheet.gk-print-active .gk-office{ font-size:34.9px !important; }
  .gk-sheet.gk-print-active .gk-words{ margin-top:3mm !important; }
  .gk-sheet.gk-print-active .gk-cert{ margin-top:3mm !important; line-height:1.30 !important; }
  .gk-sheet.gk-print-active .gk-worker-sign{ margin-top:12mm !important; }
  .gk-sheet.gk-print-active .gk-sign-space{ height:8mm !important; }
  .gk-sheet.gk-print-active .gk-approvals{ font-size:calc(11.5pt + 4px) !important; line-height:1.38 !important; font-weight:400 !important; }
  .gk-sheet.gk-print-active .gk-th-count{ font-size:calc(9pt + 2px) !important; }
}
`;

/* ==================== SHEET HTML (preview + print) ==================== */
function renderGarmaKhanaSheetHtml(p, isBlank){
  if (!p) return '';
  const totals = gkComputeTotals(p);
  const monthName = gkMonthHindi(p.month);
  const year = p.year;
  const daily = p.daily || [];

  let bodyRows = '';
  for (let i = 1; i <= 16; i++) {
    const leftRow = daily[i - 1] || null;
    let rightCells;
    if (i <= 15) {
      const rightRow = daily[15 + i] || null;
      rightCells = gkHalfCells(rightRow, isBlank);
    } else {
      rightCells =
        '<td class="gk-cell-date gk-total-cell">--</td>' +
        '<td class="gk-cell-recipe gk-total-cell">कुल योग</td>' +
        '<td class="gk-cell-count gk-total-cell">' + (isBlank ? '' : String(totals.total)) + '</td>';
    }
    bodyRows += '<tr>' + gkHalfCells(leftRow, isBlank) + rightCells + '</tr>';
  }

  const proj = isBlank ? '' : escHtml(p.meta.project || '');
  const sect = isBlank ? '' : escHtml(p.meta.sector || '');
  const dist = isBlank ? '' : escHtml(p.meta.district || '');
  const cnam = isBlank ? '' : escHtml(p.meta.centreName || '');
  const code = isBlank ? '' : escHtml(p.meta.code || '');
  const totalVal = isBlank ? '' : String(totals.total);
  const amountVal = isBlank ? '' : totals.amount.toFixed(2);
  const wordsVal = isBlank ? '' : gkRupeesWords(totals.amount);

  return '<style>' + GK_SHEET_CSS + '</style>' +
'<div class="gk-sheet">' +
  '<div class="gk-office">बाल विकास परियोजना अधिकारी <span class="gk-office-value">गुड़ामालानी</span></div>' +
  '<div class="gk-title">3 से 6 वर्ष के बच्चों को उपलब्ध कराये गये गरम पूरक पोषाहार के भुगतान हेतु दावा प्रपत्र</div>' +
  '<div class="gk-meta">' +
    '<div class="gk-meta-row">' +
      '<span class="gk-meta-item">परियोजना का नाम <span class="gk-meta-value">' + proj + '</span></span>' +
      '<span class="gk-meta-item">सेक्टर <span class="gk-meta-value">' + sect + '</span></span>' +
      '<span class="gk-meta-item">जिला <span class="gk-meta-value">' + dist + '</span></span>' +
    '</div>' +
    '<div class="gk-meta-row">' +
      '<span class="gk-meta-item">आं.बा. केन्द्र का नाम <span class="gk-meta-value">' + cnam + '</span></span>' +
      '<span class="gk-meta-item">कोड <span class="gk-meta-value">' + code + '</span></span>' +
      '<span class="gk-meta-item">माह <span class="gk-meta-value gk-meta-month">' + escHtml(monthName) + '</span></span>' +
      '<span class="gk-meta-item">वर्ष <span class="gk-meta-value gk-meta-year">' + escHtml(String(year)) + '</span></span>' +
    '</div>' +
  '</div>' +
  '<table class="gk-table">' +
    '<colgroup>' +
      '<col style="width:16%"><col style="width:26%"><col style="width:9%">' +
      '<col style="width:16%"><col style="width:26%"><col style="width:9%">' +
    '</colgroup>' +
    '<thead>' +
      '<tr>' +
        '<th class="gk-th-date">दिनांक</th>' +
        '<th class="gk-th-recipe"><b>रेसिपी का नाम</b><br><small>(फोर्टिफाइड मूंग दाल चावल खिचड़ी / फोर्टिफाइड न्यूट्री मीठा दलिया / पौष्टिक उपमा प्रीमिक्स)</small></th>' +
        '<th class="gk-th-count">कुल<br>लाभार्थियों<br>की संख्या</th>' +
        '<th class="gk-th-date">दिनांक</th>' +
        '<th class="gk-th-recipe"><b>रेसिपी का नाम</b><br><small>(फोर्टिफाइड मूंग दाल चावल खिचड़ी / फोर्टिफाइड न्यूट्री मीठा दलिया / पौष्टिक उपमा प्रीमिक्स)</small></th>' +
        '<th class="gk-th-count">कुल<br>लाभार्थियों<br>की संख्या</th>' +
      '</tr>' +
    '</thead>' +
    '<tbody>' + bodyRows + '</tbody>' +
  '</table>' +
  '<div class="gk-reimbursement">' +
    'पुनर्भरण हेतु राशि रु. 0.45 X <span class="gk-claim-fill">' + totalVal + '</span> (कुल हाजिरी) = <span class="gk-claim-fill">' + amountVal + '</span> रुपये (अंकों में)' +
  '</div>' +
  '<div class="gk-words"><b>(शब्दों में)</b> <span class="gk-words-fill">' + wordsVal + '</span></div>' +
  '<div class="gk-cert">प्रमाणित किया जाता है कि उपरोक्त विवरणानुसार आंगनवाड़ी केन्द्र पर लाभान्वितों को गरम पूरक पोषाहार की रेसिपी फोर्टिफाइड मूंग दाल चावल खिचड़ी / फोर्टिफाइड न्यूट्री मीठा दलिया / पौष्टिक उपमा प्रीमिक्स (मीठा-नमकीन) निर्धारित मात्रा में आंगनवाड़ी केन्द्र पर पका कर लाभान्वितों को खिलाया गया है।</div>' +
  '<div class="gk-worker-sign"><div class="gk-sign-space"></div><div>(कार्यकर्ता के हस्ताक्षर)</div><div class="gk-seal">मय मोहर</div></div>' +
  '<div class="gk-approvals">' +
    'प्रमाणित<br>' +
    'अध्यक्ष आंगनवाड़ी मातृ बाल विकास समिति (हस्ताक्षर मय नाम)<span class="gk-dotted"></span><br>' +
    'प्रति हस्ताक्षर<br>' +
    'महिला पर्यवेक्षक (हस्ताक्षर मय नाम मोहर)<span class="gk-dotted"></span><br>' +
    'सत्यापनकर्ता<br>' +
    'बाल विकास परियोजना अधिकारी (हस्ताक्षर मय नाम मोहर)<span class="gk-dotted"></span>' +
  '</div>' +
'</div>';
}

function gkHalfCells(row, isBlank){
  if (!row) {
    return '<td class="gk-cell-date"></td><td class="gk-cell-recipe"></td><td class="gk-cell-count"></td>';
  }
  if (row.holiday) {
    const hname = escHtml(row.holiday.name || 'रविवार');
    return '<td class="gk-cell-date gk-holiday-date">' + gkDateLabel(row.date) + '</td>' +
           '<td class="gk-cell-recipe gk-holiday-bar"><div><i></i><b>' + hname + '</b><i></i></div></td>' +
           '<td class="gk-cell-count gk-holiday-bar"><div><i></i></div></td>';
  }
  const count = (row.beneficiaries === '' || row.beneficiaries == null) ? '--' : String(row.beneficiaries);
  return '<td class="gk-cell-date">' + gkDateLabel(row.date) + '</td>' +
         '<td class="gk-cell-recipe">' + (isBlank ? '' : escHtml(row.recipe || '')) + '</td>' +
         '<td class="gk-cell-count">' + (isBlank ? '' : escHtml(count)) + '</td>';
}

/* ==================== PRINT (isolated iframe) ==================== */
function printGarmaKhanaSheet(isBlank){
  const sourceSheet = document.querySelector('.gk-sheet');
  if (!sourceSheet) { showToast('Preview उपलब्ध नहीं है।', 'error'); return; }

  const clone = sourceSheet.cloneNode(true);
  clone.classList.add('gk-print-active');
  const html = clone.outerHTML;
  const iframe = document.createElement('iframe');
  iframe.className = 'gk-print-host';
  iframe.setAttribute('title', 'Garma Khana Print');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>' +
    'html,body{margin:0;padding:0;background:#fff}' +
    GK_SHEET_CSS +
    '</style></head><body>' + html + '</body></html>'
  );
  doc.close();

  const cleanup = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
  try { iframe.contentWindow.addEventListener('afterprint', cleanup, { once: true }); } catch (e) {}

  setTimeout(() => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
    setTimeout(cleanup, 60000);
  }, 600);
}

function getGarmaKhanaInlineCss(){
  return GK_SHEET_CSS;
}


/* ==================== WIZARD STEP 2: Children Entry + Totals ==================== */
function renderGKWizardStep2(body, isBlank){
  const p = ReportsMenu.gkPayload;
  const totals = gkComputeTotals(p);

  body.innerHTML = `
    <div class="form-landing-card">
      <h3>🍲 बच्चों की संख्या भरें</h3>
      <p style="margin-bottom:12px;">रविवार में entry नहीं होगी। हर कार्य दिवस में बच्चों की संख्या डालिए।</p>

      <div style="overflow-x:auto;">
        <table class="gk-entry-table">
          <thead>
            <tr>
              <th style="width:60px;">क्र.</th>
              <th style="width:120px;">दिनांक</th>
              <th style="width:100px;">वार</th>
              <th>Recipe</th>
              <th style="width:130px;">लाभार्थी संख्या</th>
            </tr>
          </thead>
          <tbody>
            ${p.daily.map((r, i) => {
              if (r.holiday) {
                return `
                  <tr class="locked">
                    <td>${i + 1}</td>
                    <td>${gkDateLabel(r.date)}</td>
                    <td>${escHtml(r.dayName)}</td>
                    <td colspan="2"><b>${escHtml(r.holiday.name || 'HOLIDAY')}</b></td>
                  </tr>
                `;
              }
              return `
                <tr>
                  <td>${i + 1}</td>
                  <td>${gkDateLabel(r.date)}</td>
                  <td>${escHtml(r.dayName)}</td>
                  <td>${escHtml(r.recipe || '')}</td>
                  <td>
                    <input type="number" min="0" step="1" data-gk-day2="${i}"
                           value="${r.beneficiaries === '' ? '' : escHtml(String(r.beneficiaries))}"
                           ${isBlank ? 'disabled' : ''}>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="gk-totals">
      <div class="gk-total-card">
        <div class="label">कुल लाभार्थी (हाजिरी)</div>
        <div class="value" id="gkTotTotal">${totals.total}</div>
      </div>
      <div class="gk-total-card">
        <div class="label">कार्य दिवस</div>
        <div class="value" id="gkTotDays">${totals.days}</div>
      </div>
      <div class="gk-total-card accent">
        <div class="label">देय राशि (₹0.45 × हाजिरी)</div>
        <div class="value" id="gkTotAmount">₹ ${totals.amount.toFixed(2)}</div>
      </div>
    </div>

    <div class="gk-wizard-nav">
      <button class="stock-btn stock-btn-secondary" id="gkPrev2">← पीछे</button>
      <button class="stock-btn stock-btn-primary" id="gkNext2">आगे बढ़ें →</button>
    </div>
  `;

  // Inputs
  body.querySelectorAll('[data-gk-day2]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(inp.dataset.gkDay2, 10);
      ReportsMenu.gkPayload.daily[idx].beneficiaries = e.target.value;
      gkRecalc(ReportsMenu.gkPayload);
      const t2 = gkComputeTotals(ReportsMenu.gkPayload);
      const elT = document.getElementById('gkTotTotal');
      const elD = document.getElementById('gkTotDays');
      const elA = document.getElementById('gkTotAmount');
      if (elT) elT.textContent = t2.total;
      if (elD) elD.textContent = t2.days;
      if (elA) elA.textContent = '₹ ' + t2.amount.toFixed(2);
    });
  });

  // Prev
  document.getElementById('gkPrev2').addEventListener('click', () => {
    ReportsMenu.gkWizardStep = 1;
    renderGarmaKhanaWizard();
  });

  // Next
  document.getElementById('gkNext2').addEventListener('click', () => {
    ReportsMenu.gkWizardStep = 3;
    renderGarmaKhanaWizard();
  });
}


/* ==================== WIZARD STEP 3: Preview + Save Actions ==================== */
function renderGKWizardStep3(body, isBlank){
  const p = ReportsMenu.gkPayload;
  const totals = gkComputeTotals(p);

  body.innerHTML = `
    <div class="form-landing-card">
      <h3>✅ Preview</h3>
      <p>नीचे आपके भरे हुए data का final preview है। Save Draft / Send / Print से आगे बढ़ें।</p>
    </div>

    <div class="gk-totals">
      <div class="gk-total-card">
        <div class="label">कुल लाभार्थी (हाजिरी)</div>
        <div class="value">${totals.total}</div>
      </div>
      <div class="gk-total-card">
        <div class="label">कार्य दिवस</div>
        <div class="value">${totals.days}</div>
      </div>
      <div class="gk-total-card accent">
        <div class="label">देय राशि (₹0.45 × हाजिरी)</div>
        <div class="value">₹ ${totals.amount.toFixed(2)}</div>
      </div>
    </div>

    <div id="gkPreviewWrap3" style="margin:16px 0;">
      ${renderGarmaKhanaSheetHtml(p, isBlank)}
    </div>

    ${!isBlank ? `
      <div class="gk-wizard-nav" style="flex-wrap:wrap;justify-content:flex-start;">
        <button class="stock-btn stock-btn-secondary" id="gkSaveDraft3">💾 Save Draft</button>
        <button class="stock-btn stock-btn-primary" id="gkSend3">📚 Save & Send to Register</button>
        <button class="stock-btn stock-btn-secondary" id="gkPrint3">🖨️ Print / Save PDF</button>
        <button class="stock-btn stock-btn-secondary" id="gkPrev3" style="margin-left:auto;">← पीछे</button>
      </div>
    ` : `
      <div class="gk-wizard-nav" style="flex-wrap:wrap;justify-content:flex-start;">
        <button class="stock-btn stock-btn-primary" id="gkPrint3">🖨️ Print / Save PDF</button>
        <button class="stock-btn stock-btn-secondary" id="gkPrev3" style="margin-left:auto;">← पीछे</button>
      </div>
    `}
  `;

  // Save Draft
  const sd = document.getElementById('gkSaveDraft3');
  if (sd) sd.addEventListener('click', async () => {
    try {
      await api('/api/reports/GARMA_KHANA/draft', {
        method: 'POST',
        body: { year: ReportsMenu.year, month: ReportsMenu.month, payload: ReportsMenu.gkPayload }
      });
      showToast('Draft saved.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Send
  const snd = document.getElementById('gkSend3');
  if (snd) snd.addEventListener('click', async () => {
    try {
      const res = await api('/api/reports/GARMA_KHANA/send-to-register', {
        method: 'POST',
        body: { year: ReportsMenu.year, month: ReportsMenu.month, payload: ReportsMenu.gkPayload }
      });
      showToast(res.message || 'Sent to Register.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  // Print
  const pr = document.getElementById('gkPrint3');
  if (pr) pr.addEventListener('click', () => printGarmaKhanaSheet(isBlank));

  // Prev
  document.getElementById('gkPrev3').addEventListener('click', () => {
    ReportsMenu.gkWizardStep = 2;
    renderGarmaKhanaWizard();
  });
}


/* ==================== MILK CLAIM (दूध दावा फॉर्म) ==================== */

// Skip only Sat/Sun from daily rows for Milk Claim
function mkDefaultPayload(year, month){
  const n = gkDaysInMonth(year, month);
  const daily = [];
  for (let d = 1; d <= n; d++){
    const dow = gkDow(year, month, d);
    if (dow === 0 || dow === 6) continue;
    daily.push({
      date: gkIso(year, month, d),
      day: d,
      dow: dow,
      dayName: gkDayName(dow),
      beneficiaries: ''
    });
  }
  return {
    year: year,
    month: month,
    meta: {centreName:'', project:'', sector:'', district:'', code:''},
    daily: daily,
    total_beneficiaries: 0,
    reimbursement: 0
  };
}

function mkRecalc(payload){
  if (!payload || !Array.isArray(payload.daily)) return payload;
  let total = 0;
  payload.daily.forEach(r => {
    const v = parseInt(r.beneficiaries, 10);
    total += isNaN(v) ? 0 : v;
  });
  payload.total_beneficiaries = total;
  payload.reimbursement = Number((total * 0.45).toFixed(2));
  return payload;
}

function mkComputeTotals(payload){
  if (!payload || !Array.isArray(payload.daily)) return { total: 0, amount: 0, days: 0 };
  let total = 0, days = 0;
  payload.daily.forEach(r => {
    days++;
    const v = parseInt(r.beneficiaries, 10);
    total += isNaN(v) ? 0 : v;
  });
  return { total, amount: Number((total * 0.45).toFixed(2)), days };
}


/* ==================== MK WIZARD ENTRY ==================== */
async function renderMilkClaimForm(mode){
  const year = ReportsMenu.year;
  const month = ReportsMenu.month;

  if (mode === 'manual') {
    try {
      const d = await api('/api/reports/MILK_CLAIM/draft?year=' + year + '&month=' + month);
      ReportsMenu.mkPayload = (d.draft && d.draft.daily && d.draft.daily.length)
        ? d.draft
        : mkDefaultPayload(year, month);
    } catch (e) {
      ReportsMenu.mkPayload = mkDefaultPayload(year, month);
    }
    mkRecalc(ReportsMenu.mkPayload);
  } else {
    ReportsMenu.mkPayload = mkDefaultPayload(year, month);
    mkRecalc(ReportsMenu.mkPayload);
  }

  ReportsMenu.mkWizardStep = 1;
  ReportsMenu.mkMode = mode;
  renderMilkClaimWizard();
}

function renderMilkClaimWizard(){
  const mode = ReportsMenu.mkMode || 'manual';
  const step = ReportsMenu.mkWizardStep || 1;
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const stepTitles = [
    { n: 1, title: 'केन्द्र जानकारी', sub: 'Month, Year, Centre' },
    { n: 2, title: 'बच्चों की संख्या', sub: 'Daily entries + Totals' },
    { n: 3, title: 'Preview + Save', sub: 'Print / Save Draft / Send' }
  ];
  const isBlank = mode === 'blank';
  const monthName = reportsFmtMonth(ReportsMenu.month);

  root.innerHTML = `
    <div class="reports-header">
      <div>
        <h2>${isBlank ? 'दूध दावा फॉर्म — Blank Form' : 'दूध दावा फॉर्म'}</h2>
        <div class="sub">${monthName} ${ReportsMenu.year} · Step ${step} of 3</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="reports-main">
      ${isBlank ? '' : `
        <div class="gk-stepper">
          ${stepTitles.map(s => `
            <button type="button" class="${step === s.n ? 'active' : (step > s.n ? 'done' : '')}" data-step="${s.n}">
              <span class="gk-step-no">${step > s.n ? '✓' : s.n}</span>
              <span class="gk-step-body">
                <span class="gk-step-title">${s.title}</span>
                <span class="gk-step-sub">${s.sub}</span>
              </span>
            </button>
          `).join('')}
        </div>
      `}

      <div id="mkWizardBody"></div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    ReportsMenu.view = 'form';
    ReportsMenu.mkWizardStep = 1;
    renderFormLanding('MILK_CLAIM');
  });

  root.querySelectorAll('.gk-stepper button').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.dataset.step, 10);
      ReportsMenu.mkWizardStep = target;
      renderMilkClaimWizard();
    });
  });

  const body = document.getElementById('mkWizardBody');
  if (step === 1) renderMKWizardStep1(body, isBlank);
  else if (step === 2) renderMKWizardStep2(body, isBlank);
  else renderMKWizardStep3(body, isBlank);
}


/* ==================== MK STEP 1 ==================== */
function renderMKWizardStep1(body, isBlank){
  const p = ReportsMenu.mkPayload;
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) years.push(y);

  body.innerHTML = `
    <div class="form-landing-card">
      <h3>📅 Month & Year</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;">
        <div class="stock-field" style="min-width:140px;flex:1;">
          <label>Month</label>
          <select id="mkMonth">
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
              <option value="${m}" ${m === ReportsMenu.month ? 'selected' : ''}>${reportsFmtMonth(m)}</option>
            `).join('')}
          </select>
        </div>
        <div class="stock-field" style="min-width:110px;flex:1;">
          <label>Year</label>
          <select id="mkYear">
            ${years.map(y => `<option value="${y}" ${y === ReportsMenu.year ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    ${isBlank ? '' : `
      <div class="form-landing-card">
        <h3>📋 Centre Details</h3>
        <div class="gk-meta-grid" style="margin-top:12px;">
          <div class="stock-field">
            <label>केन्द्र का नाम</label>
            <input type="text" id="mkCentreName" value="${escHtml(p.meta.centreName || '')}">
          </div>
          <div class="stock-field">
            <label>कोड</label>
            <input type="text" id="mkCode" value="${escHtml(p.meta.code || '')}">
          </div>
          <div class="stock-field">
            <label>परियोजना</label>
            <input type="text" id="mkProject" value="${escHtml(p.meta.project || '')}">
          </div>
          <div class="stock-field">
            <label>सेक्टर</label>
            <input type="text" id="mkSector" value="${escHtml(p.meta.sector || '')}">
          </div>
          <div class="stock-field">
            <label>जिला</label>
            <input type="text" id="mkDistrict" value="${escHtml(p.meta.district || '')}">
          </div>
        </div>
      </div>
    `}

    <div class="gk-wizard-nav">
      <div></div>
      <button class="stock-btn stock-btn-primary" id="mkNext1">आगे बढ़ें →</button>
    </div>
  `;

  document.getElementById('mkMonth').addEventListener('change', (e) => {
    ReportsMenu.month = parseInt(e.target.value, 10);
    renderMilkClaimForm(ReportsMenu.mkMode);
  });
  document.getElementById('mkYear').addEventListener('change', (e) => {
    ReportsMenu.year = parseInt(e.target.value, 10);
    renderMilkClaimForm(ReportsMenu.mkMode);
  });

  const bind = (id, key) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      ReportsMenu.mkPayload.meta[key] = el.value;
    });
  };
  bind('mkCentreName', 'centreName');
  bind('mkCode', 'code');
  bind('mkProject', 'project');
  bind('mkSector', 'sector');
  bind('mkDistrict', 'district');

  document.getElementById('mkNext1').addEventListener('click', () => {
    ReportsMenu.mkWizardStep = 2;
    renderMilkClaimWizard();
  });
}


/* ==================== MK STEP 2: Children Entry + Totals ==================== */
function renderMKWizardStep2(body, isBlank){
  const p = ReportsMenu.mkPayload;
  const totals = mkComputeTotals(p);

  body.innerHTML = `
    <div class="form-landing-card">
      <h3>🥛 बच्चों की संख्या भरें</h3>
      <p style="margin-bottom:12px;">सोमवार से शुक्रवार — दूध वितरण के दिनों में बच्चों की संख्या डालिए।</p>

      <div style="overflow-x:auto;">
        <table class="mk-entry-table">
          <thead>
            <tr>
              <th style="width:60px;">क्र.</th>
              <th style="width:120px;">दिनांक</th>
              <th style="width:100px;">वार</th>
              <th style="width:150px;">लाभार्थी संख्या</th>
            </tr>
          </thead>
          <tbody>
            ${p.daily.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${gkDateLabel(r.date)}</td>
                <td>${escHtml(r.dayName)}</td>
                <td>
                  <input type="number" min="0" step="1" data-mk-day="${i}"
                         value="${r.beneficiaries === '' ? '' : escHtml(String(r.beneficiaries))}"
                         ${isBlank ? 'disabled' : ''}>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="gk-totals">
      <div class="gk-total-card">
        <div class="label">कुल लाभार्थी (हाजिरी)</div>
        <div class="value" id="mkTotTotal">${totals.total}</div>
      </div>
      <div class="gk-total-card">
        <div class="label">कार्य दिवस</div>
        <div class="value" id="mkTotDays">${totals.days}</div>
      </div>
      <div class="gk-total-card accent">
        <div class="label">देय राशि (₹0.45 × हाजिरी)</div>
        <div class="value" id="mkTotAmount">₹ ${totals.amount.toFixed(2)}</div>
      </div>
    </div>

    <div class="gk-wizard-nav">
      <button class="stock-btn stock-btn-secondary" id="mkPrev2">← पीछे</button>
      <button class="stock-btn stock-btn-primary" id="mkNext2">आगे बढ़ें →</button>
    </div>
  `;

  body.querySelectorAll('[data-mk-day]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(inp.dataset.mkDay, 10);
      ReportsMenu.mkPayload.daily[idx].beneficiaries = e.target.value;
      mkRecalc(ReportsMenu.mkPayload);
      const t2 = mkComputeTotals(ReportsMenu.mkPayload);
      const elT = document.getElementById('mkTotTotal');
      const elD = document.getElementById('mkTotDays');
      const elA = document.getElementById('mkTotAmount');
      if (elT) elT.textContent = t2.total;
      if (elD) elD.textContent = t2.days;
      if (elA) elA.textContent = '₹ ' + t2.amount.toFixed(2);
    });
  });

  document.getElementById('mkPrev2').addEventListener('click', () => {
    ReportsMenu.mkWizardStep = 1;
    renderMilkClaimWizard();
  });

  document.getElementById('mkNext2').addEventListener('click', () => {
    ReportsMenu.mkWizardStep = 3;
    renderMilkClaimWizard();
  });
}


/* ==================== MK STEP 3: Preview + Save ==================== */
function renderMKWizardStep3(body, isBlank){
  const p = ReportsMenu.mkPayload;
  const totals = mkComputeTotals(p);

  body.innerHTML = `
    <div class="form-landing-card">
      <h3>✅ Preview</h3>
      <p>नीचे आपके भरे हुए data का final preview है। Save Draft / Send / Print से आगे बढ़ें।</p>
    </div>

    <div class="gk-totals">
      <div class="gk-total-card">
        <div class="label">कुल लाभार्थी (हाजिरी)</div>
        <div class="value">${totals.total}</div>
      </div>
      <div class="gk-total-card">
        <div class="label">कार्य दिवस</div>
        <div class="value">${totals.days}</div>
      </div>
      <div class="gk-total-card accent">
        <div class="label">देय राशि (₹0.45 × हाजिरी)</div>
        <div class="value">₹ ${totals.amount.toFixed(2)}</div>
      </div>
    </div>

    <div style="margin:16px 0;">
      ${renderMilkClaimSheetHtml(p, isBlank)}
    </div>

    ${!isBlank ? `
      <div class="gk-wizard-nav" style="flex-wrap:wrap;justify-content:flex-start;">
        <button class="stock-btn stock-btn-secondary" id="mkSaveDraft3">💾 Save Draft</button>
        <button class="stock-btn stock-btn-primary" id="mkSend3">📚 Save & Send to Register</button>
        <button class="stock-btn stock-btn-secondary" id="mkPrint3">🖨️ Print / Save PDF</button>
        <button class="stock-btn stock-btn-secondary" id="mkPrev3" style="margin-left:auto;">← पीछे</button>
      </div>
    ` : `
      <div class="gk-wizard-nav" style="flex-wrap:wrap;justify-content:flex-start;">
        <button class="stock-btn stock-btn-primary" id="mkPrint3">🖨️ Print / Save PDF</button>
        <button class="stock-btn stock-btn-secondary" id="mkPrev3" style="margin-left:auto;">← पीछे</button>
      </div>
    `}
  `;

  const sd = document.getElementById('mkSaveDraft3');
  if (sd) sd.addEventListener('click', async () => {
    try {
      await api('/api/reports/MILK_CLAIM/draft', {
        method: 'POST',
        body: { year: ReportsMenu.year, month: ReportsMenu.month, payload: ReportsMenu.mkPayload }
      });
      showToast('Draft saved.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  const snd = document.getElementById('mkSend3');
  if (snd) snd.addEventListener('click', async () => {
    try {
      const res = await api('/api/reports/MILK_CLAIM/send-to-register', {
        method: 'POST',
        body: { year: ReportsMenu.year, month: ReportsMenu.month, payload: ReportsMenu.mkPayload }
      });
      showToast(res.message || 'Sent to Register.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  const pr = document.getElementById('mkPrint3');
  if (pr) pr.addEventListener('click', () => printMilkClaimSheet(isBlank));

  document.getElementById('mkPrev3').addEventListener('click', () => {
    ReportsMenu.mkWizardStep = 2;
    renderMilkClaimWizard();
  });
}


/* ==================== MK SHEET CSS ==================== */
const MK_SHEET_CSS = `
.mk-sheet{
  width:210mm;
  min-height:281mm;
  margin:0 auto;
  background:#fff;
  color:#111;
  padding:9mm 15mm 7mm;
  box-sizing:border-box;
  font-family:"Nirmala UI","Mangal","Noto Sans Devanagari",Arial,sans-serif;
}
.mk-office{
  text-align:center;font-size:37px;line-height:1.25;font-weight:500;
  margin-top:0;margin-bottom:-0.5mm;
}
.mk-office-value{padding-left:2mm}
.mk-title{
  text-align:center;font-size:20px;line-height:1.24;font-weight:500;
  margin-bottom:2.5mm;
}
.mk-meta{font-size:18px;line-height:1.5;margin-bottom:2.5mm;font-weight:500;}
.mk-meta-row{display:flex;gap:4mm;align-items:baseline;margin-bottom:1mm;}
.mk-meta-item{white-space:nowrap}
.mk-meta-value{
  display:inline-block;min-width:34mm;font-size:16px;
  border-bottom:1px dotted #333;padding:0 2px;
  font-weight:450 !important;text-align:center;
}
.mk-meta-value.mk-meta-month{ min-width:20mm !important; }
.mk-meta-value.mk-meta-year{ min-width:14mm !important; }

.mk-table{
  width:100%;border-collapse:collapse;table-layout:fixed;
  font-size:calc(11pt + 2px);font-weight:400;
}
.mk-table th,
.mk-table td{
  border:1px solid #161616;
  padding:1.4mm 1mm;
  text-align:center;vertical-align:middle;line-height:1.15;
}
.mk-table th{font-weight:700;background:#fffdf4}
.mk-table tbody td{padding:.3mm 1mm;line-height:1.02;height:7mm;}
.mk-table .mk-th-serial{font-size:calc(11pt + 4px);font-weight:600}
.mk-table .mk-th-day{font-size:calc(11pt + 4px);font-weight:600}
.mk-table .mk-th-date{font-size:calc(11pt + 4px);font-weight:600}
.mk-table .mk-th-count{font-size:calc(11pt + 4px);font-weight:600}
.mk-table tbody td.mk-cell-serial{font-size:calc(11pt + 2px);font-weight:600}
.mk-table tbody td.mk-cell-day{font-size:calc(12.5pt + 4px);font-weight:500}
.mk-table tbody td.mk-cell-date{font-size:calc(11.5pt + 2px);font-weight:600}
.mk-table tbody td.mk-cell-count{font-size:calc(12.5pt + 2px);font-weight:600}
.mk-table tr.mk-total-row td{
  color:#b0251f !important;font-weight:700 !important;
  border:1.5px solid #b0251f !important;background:#fff8f7 !important;
}
.mk-total-cell{color:#b0251f !important;font-weight:700 !important;background:#fff8f7 !important}

.mk-reimbursement{
  font-size:calc(12.5pt + 5px);line-height:1.45;
  margin-top:3mm;text-align:center;font-weight:450;
}
.mk-claim-fill{
  display:inline-block;min-width:15mm;padding:0 2mm 1px;
  border-bottom:1px dotted #333;font-weight:550;text-align:center;
}
.mk-words{
  margin-top:4mm;min-height:6.5mm;
  font-size:calc(12.5pt + 5px);text-align:center;font-weight:450;
}
.mk-words b{font-weight:500}
.mk-words-fill{
  display:inline-block;min-width:80mm;max-width:110mm;
  padding:0 2mm 1px;border-bottom:1px dotted #333;font-weight:400;
}
.mk-cert{
  font-size:calc(11.5pt + 4px);line-height:1.45;
  text-align:justify;margin-top:4mm;font-weight:400;
}
.mk-worker-sign{
  text-align:right;margin-top:5mm;
  font-size:calc(13.5pt + 4px);font-weight:400;line-height:1.60;
}
.mk-sign-space{height:15mm}
.mk-seal{font-weight:500;margin-top:0mm}
.mk-approvals{
  margin-top:0mm;font-size:calc(13.5pt + 4px);
  line-height:1.60;font-weight:400;
}
.mk-dotted{
  display:inline-block;min-width:45mm;
  border-bottom:1px dotted #333;vertical-align:baseline;margin-left:4mm;
}

/* ============ PRINT ============ */
@media print{
  @page{ size:A4 portrait; margin:0 !important; }
  html,body{
    width:100% !important;height:100% !important;
    margin:0 !important;padding:0 !important;
    background:#fff !important;overflow:hidden !important;
  }
  body *{ visibility:hidden !important; }
  .mk-sheet.mk-print-active,
  .mk-sheet.mk-print-active *{ visibility:visible !important; }
  .mk-sheet.mk-print-active{
    position:absolute !important;
    left:50% !important;top:0 !important;
    transform:translateX(-50%) !important;
    transform-origin:top center !important;
    width:221.053mm !important;
    height:312.632mm !important;
    min-width:0 !important;min-height:0 !important;
    max-width:none !important;max-height:none !important;
    margin:0 !important;
    padding:9mm 15mm 7mm !important;
    box-sizing:border-box !important;
    zoom:.95 !important;
    overflow:hidden !important;box-shadow:none !important;
    background:#fff !important;
    break-inside:avoid !important;
    page-break-inside:avoid !important;
    page-break-after:avoid !important;
  }
  .mk-sheet.mk-print-active .mk-office{ font-size:34.9px !important; font-weight:500 !important; }
  .mk-sheet.mk-print-active .mk-words{ margin-top:3mm !important; }
  .mk-sheet.mk-print-active .mk-cert{ margin-top:3mm !important; line-height:1.30 !important; }
  .mk-sheet.mk-print-active .mk-worker-sign{ margin-top:12mm !important; }
  .mk-sheet.mk-print-active .mk-sign-space{ height:8mm !important; }
  .mk-sheet.mk-print-active .mk-approvals{
    font-size:calc(11.5pt + 4px) !important;line-height:1.38 !important;font-weight:400 !important;
  }
}
`;

/* ==================== MK SHEET HTML ==================== */
function renderMilkClaimSheetHtml(p, isBlank){
  if (!p) return '';
  const totals = mkComputeTotals(p);
  const monthName = gkMonthHindi(p.month);
  const year = p.year;
  const daily = p.daily || [];
  const HALF = 12;

  let bodyRows = '';
  for (let i = 0; i < HALF; i++) {
    const leftRow = daily[i] || null;
    const rightRow = daily[HALF + i] || null;
    const leftCells = mkHalfCells(leftRow, i + 1, isBlank);
    let rightCells;
    if (rightRow) {
      rightCells = mkHalfCells(rightRow, HALF + i + 1, isBlank);
    } else if (i === HALF - 1) {
      // Last row of right side → show total
      rightCells =
        '<td class="mk-cell-serial mk-total-cell">—</td>' +
        '<td class="mk-cell-day mk-total-cell">योग</td>' +
        '<td class="mk-cell-date mk-total-cell">—</td>' +
        '<td class="mk-cell-count mk-total-cell">' + (isBlank ? '' : String(totals.total)) + '</td>';
    } else {
      rightCells =
        '<td class="mk-cell-serial"></td><td class="mk-cell-day"></td>' +
        '<td class="mk-cell-date"></td><td class="mk-cell-count"></td>';
    }
    bodyRows += '<tr>' + leftCells + rightCells + '</tr>';
  }

  const proj = isBlank ? '' : escHtml(p.meta.project || '');
  const sect = isBlank ? '' : escHtml(p.meta.sector || '');
  const dist = isBlank ? '' : escHtml(p.meta.district || '');
  const cnam = isBlank ? '' : escHtml(p.meta.centreName || '');
  const code = isBlank ? '' : escHtml(p.meta.code || '');
  const totalVal = isBlank ? '' : String(totals.total);
  const amountVal = isBlank ? '' : totals.amount.toFixed(2);
  const wordsVal = isBlank ? '' : gkRupeesWords(totals.amount);

  return '<style>' + MK_SHEET_CSS + '</style>' +
'<div class="mk-sheet">' +
  '<div class="mk-office">बाल विकास परियोजना अधिकारी <span class="mk-office-value">गुड़ामालानी</span></div>' +
  '<div class="mk-title">3 से 6 वर्ष के बच्चों को उपलब्ध कराए गए दूध पैकेट एवं चीनी के भुगतान हेतु दावा प्रपत्र</div>' +
  '<div class="mk-meta">' +
    '<div class="mk-meta-row">' +
      '<span class="mk-meta-item">परियोजना का नाम <span class="mk-meta-value">' + proj + '</span></span>' +
      '<span class="mk-meta-item">सेक्टर <span class="mk-meta-value">' + sect + '</span></span>' +
      '<span class="mk-meta-item">जिला <span class="mk-meta-value">' + dist + '</span></span>' +
    '</div>' +
    '<div class="mk-meta-row">' +
      '<span class="mk-meta-item">आं.बा. केन्द्र का नाम <span class="mk-meta-value">' + cnam + '</span></span>' +
      '<span class="mk-meta-item">कोड <span class="mk-meta-value">' + code + '</span></span>' +
      '<span class="mk-meta-item">माह <span class="mk-meta-value mk-meta-month">' + escHtml(monthName) + '</span></span>' +
      '<span class="mk-meta-item">वर्ष <span class="mk-meta-value mk-meta-year">' + escHtml(String(year)) + '</span></span>' +
    '</div>' +
  '</div>' +
  '<table class="mk-table">' +
    '<colgroup>' +
      '<col style="width:6%"><col style="width:11%"><col style="width:14%"><col style="width:12%">' +
      '<col style="width:6%"><col style="width:11%"><col style="width:14%"><col style="width:12%">' +
    '</colgroup>' +
    '<thead>' +
      '<tr>' +
        '<th class="mk-th-serial">क्र.सं.</th>' +
        '<th class="mk-th-day">वार</th>' +
        '<th class="mk-th-date">दिनांक</th>' +
        '<th class="mk-th-count">लाभार्थियों<br>की संख्या</th>' +
        '<th class="mk-th-serial">क्र.सं.</th>' +
        '<th class="mk-th-day">वार</th>' +
        '<th class="mk-th-date">दिनांक</th>' +
        '<th class="mk-th-count">लाभार्थियों<br>की संख्या</th>' +
      '</tr>' +
    '</thead>' +
    '<tbody>' + bodyRows + '</tbody>' +
  '</table>' +
  '<div class="mk-reimbursement">' +
    'पुनर्भरण हेतु राशि रु. 0.45 X <span class="mk-claim-fill">' + totalVal + '</span> (कुल हाजिरी) = <span class="mk-claim-fill">' + amountVal + '</span> रुपये (अंकों में)' +
  '</div>' +
  '<div class="mk-words"><b>(शब्दों में)</b> <span class="mk-words-fill">' + wordsVal + '</span></div>' +
  '<div class="mk-cert">प्रमाणित किया जाता है कि उपरोक्त विवरणानुसार आंगनबाड़ी केन्द्र पर लाभान्वितों को सोमवार, मंगलवार, बुधवार, गुरुवार एवं शुक्रवार को दूध प्रति बालक 10 ग्राम एवं शक्कर प्रति बालक 4 ग्राम निर्धारित मात्रा में आंगनबाड़ी केन्द्र पर लाभान्वितों को पिलाया गया है। चीनी एवं ईंधन पर प्रति लाभार्थी प्रति दिवस 0.45 पैसे (0.20 + 0.25 पैसे) के अनुसार बिल बनाया गया है।</div>' +
  '<div class="mk-worker-sign"><div class="mk-sign-space"></div><div>(कार्यकर्ता के हस्ताक्षर)</div><div class="mk-seal">मय मोहर</div></div>' +
  '<div class="mk-approvals">' +
    'प्रमाणित<br>' +
    'अध्यक्ष आंगनवाड़ी मातृ बाल विकास समिति (हस्ताक्षर मय नाम)<span class="mk-dotted"></span><br>' +
    'प्रति हस्ताक्षर<br>' +
    'महिला पर्यवेक्षक (हस्ताक्षर मय नाम मोहर)<span class="mk-dotted"></span><br>' +
    'सत्यापनकर्ता<br>' +
    'बाल विकास परियोजना अधिकारी (हस्ताक्षर मय नाम मोहर)<span class="mk-dotted"></span>' +
  '</div>' +
'</div>';
}

function mkHalfCells(row, serial, isBlank){
  if (!row) {
    return '<td class="mk-cell-serial"></td><td class="mk-cell-day"></td>' +
           '<td class="mk-cell-date"></td><td class="mk-cell-count"></td>';
  }
  const count = (row.beneficiaries === '' || row.beneficiaries == null) ? '—' : String(row.beneficiaries);
  return '<td class="mk-cell-serial">' + serial + '</td>' +
         '<td class="mk-cell-day">' + escHtml(row.dayName || '') + '</td>' +
         '<td class="mk-cell-date">' + gkDateLabel(row.date) + '</td>' +
         '<td class="mk-cell-count">' + (isBlank ? '' : escHtml(count)) + '</td>';
}

/* ==================== MK PRINT ==================== */
function printMilkClaimSheet(isBlank){
  const sourceSheet = document.querySelector('.mk-sheet');
  if (!sourceSheet) { showToast('Preview उपलब्ध नहीं है।', 'error'); return; }

  const clone = sourceSheet.cloneNode(true);
  clone.classList.add('mk-print-active');
  const html = clone.outerHTML;

  const iframe = document.createElement('iframe');
  iframe.className = 'gk-print-host';
  iframe.setAttribute('title', 'Milk Claim Print');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>' +
    'html,body{margin:0;padding:0;background:#fff}' +
    MK_SHEET_CSS +
    '</style></head><body>' + html + '</body></html>'
  );
  doc.close();

  const cleanup = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
  try { iframe.contentWindow.addEventListener('afterprint', cleanup, { once: true }); } catch (e) {}

  setTimeout(() => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
    setTimeout(cleanup, 60000);
  }, 600);
}


/* ==================== MILK STOCK REGISTER (मिल्क स्टॉक रजिस्टर) ==================== */

// Default payload for milk stock register
function msrDefaultPayload(year, month){
  const n = gkDaysInMonth(year, month);
  const daily = [];
  for (let d = 1; d <= n; d++){
    const dow = gkDow(year, month, d);
    if (dow === 0 || dow === 6) continue;
    daily.push({
      date: gkIso(year, month, d),
      day: d,
      dow: dow,
      dayName: gkDayName(dow),
      beneficiaries: ''
    });
  }
  return {
    year: year,
    month: month,
    meta: {centreName:'', project:'', sector:'', district:'', code:''},
    stock: {
      milk: { opening: 0, challan_no: '', receipts: [] },   // receipts: [{date, qty, challan}]
      sugar: { opening: 0, receipts: [] }
    },
    daily: daily,
    daily_computed: []
  };
}

// Convert to grams helper — accept any unit
function msrToGrams(v, unit){
  v = Number(v) || 0;
  if (unit === 'kg') return v * 1000;
  return v;
}

// Compute daily rows with stock movement (FIFO-ish, no negative)
function msrRecalc(payload){
  if (!payload || !Array.isArray(payload.daily)) return payload;
  const daily = payload.daily;
  const milk = payload.stock?.milk || { opening: 0, challan_no: '', receipts: [] };
  const sugar = payload.stock?.sugar || { opening: 0, receipts: [] };
  const monthStart = gkIso(payload.year, payload.month, 1);

  // Compute receipts map (per date)
  const milkReceiptMap = {};
  const milkChallanMap = {};
  (milk.receipts || []).forEach(r => {
    if (r && r.date) {
      milkReceiptMap[r.date] = (milkReceiptMap[r.date] || 0) + (Number(r.qty) || 0);
      if (r.challan) milkChallanMap[r.date] = r.challan;
    }
  });
  const sugarReceiptMap = {};
  const sugarChallanMap = {};
  (sugar.receipts || []).forEach(r => {
    if (r && r.date) {
      sugarReceiptMap[r.date] = (sugarReceiptMap[r.date] || 0) + (Number(r.qty) || 0);
      if (r.challan) sugarChallanMap[r.date] = r.challan;
    }
  });

  // Opening balance (grams) — includes pre-month receipts
  let milkBal = Number(milk.opening) || 0;
  let sugarBal = Number(sugar.opening) || 0;
  (milk.receipts || []).forEach(r => {
    if (r && r.date && r.date < monthStart) milkBal += Number(r.qty) || 0;
  });
  (sugar.receipts || []).forEach(r => {
    if (r && r.date && r.date < monthStart) sugarBal += Number(r.qty) || 0;
  });

  const computed = [];
  let totBeneficiaries = 0, totMilkUsed = 0, totSugarUsed = 0, totMilkReceived = 0, totSugarReceived = 0;

  for (let i = 0; i < daily.length; i++){
    const row = daily[i];
    const date = row.date;
    const milkRecvToday = milkReceiptMap[date] || 0;
    const sugarRecvToday = sugarReceiptMap[date] || 0;

    const milkOpening = milkBal;
    const sugarOpening = sugarBal;
    const milkTotal = milkOpening + milkRecvToday;
    const sugarTotal = sugarOpening + sugarRecvToday;

    const requestedBeneficiaries = parseInt(row.beneficiaries, 10);
    const reqCount = isNaN(requestedBeneficiaries) ? 0 : Math.max(0, requestedBeneficiaries);

    // Limit by available stock: milk 10g per, sugar 4g per
    const milkCap = Math.floor(milkTotal / 10);
    const sugarCap = Math.floor(sugarTotal / 4);
    const servedCount = Math.min(reqCount, milkCap, sugarCap);

    const milkUsed = servedCount * 10;
    const sugarUsed = servedCount * 4;
    const milkClosing = Math.max(0, milkTotal - milkUsed);
    const sugarClosing = Math.max(0, sugarTotal - sugarUsed);

    computed.push({
      date: date,
      day: row.day,
      dow: row.dow,
      dayName: row.dayName,
      requested: reqCount,
      served: servedCount,
      challan_no: i === 0 ? (milk.challan_no || '') : (milkChallanMap[date] || ''),
      milk: {
        opening: milkOpening,
        received: milkRecvToday,
        total: milkTotal,
        used: milkUsed,
        closing: milkClosing
      },
      sugar: {
        opening: sugarOpening,
        received: sugarRecvToday,
        total: sugarTotal,
        used: sugarUsed,
        closing: sugarClosing
      }
    });

    totBeneficiaries += servedCount;
    totMilkUsed += milkUsed;
    totSugarUsed += sugarUsed;
    totMilkReceived += milkRecvToday;
    totSugarReceived += sugarRecvToday;

    milkBal = milkClosing;
    sugarBal = sugarClosing;
  }

  payload.daily_computed = computed;
  var firstDay = computed[0] || {};
  var milkOpeningStart = (firstDay.milk && Number(firstDay.milk.opening)) || 0;
  var sugarOpeningStart = (firstDay.sugar && Number(firstDay.sugar.opening)) || 0;
  payload.summary = {
    beneficiaries: totBeneficiaries,
    milk_opening: milkOpeningStart,
    milk_received: totMilkReceived,
    milk_total: milkOpeningStart + totMilkReceived,
    milk_used: totMilkUsed,
    milk_closing: milkBal,
    sugar_opening: sugarOpeningStart,
    sugar_received: totSugarReceived,
    sugar_total: sugarOpeningStart + totSugarReceived,
    sugar_used: totSugarUsed,
    sugar_closing: sugarBal
  };
  return payload;
}

// Format grams as kg with 3 decimals
function msrKg(grams){
  return (Number(grams) / 1000).toFixed(3);
}

// Empty grams value shows "--"
function msrVal(grams, showDash){
  const g = Number(grams) || 0;
  if (g === 0 && showDash) return '--';
  return msrKg(g);
}


/* ==================== MSR WIZARD ==================== */
async function renderMilkStockForm(mode){
  const year = ReportsMenu.year;
  const month = ReportsMenu.month;

  if (mode === 'manual') {
    try {
      const d = await api('/api/reports/MILK_STOCK/draft?year=' + year + '&month=' + month);
      ReportsMenu.msrPayload = (d.draft && d.draft.daily && d.draft.daily.length)
        ? d.draft
        : msrDefaultPayload(year, month);
    } catch (e) {
      ReportsMenu.msrPayload = msrDefaultPayload(year, month);
    }
    msrRecalc(ReportsMenu.msrPayload);
  } else {
    ReportsMenu.msrPayload = msrDefaultPayload(year, month);
    msrRecalc(ReportsMenu.msrPayload);
  }

  ReportsMenu.msrWizardStep = 1;
  ReportsMenu.msrMode = mode;
  renderMilkStockWizard();
}

function renderMilkStockWizard(){
  const mode = ReportsMenu.msrMode || 'manual';
  const step = ReportsMenu.msrWizardStep || 1;
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const stepTitles = [
    { n: 1, title: 'केन्द्र + स्टॉक', sub: 'Centre + Opening + Receipts' },
    { n: 2, title: 'दैनिक प्रविष्टि', sub: 'Daily beneficiaries' },
    { n: 3, title: 'Preview + Save', sub: 'Print / Save / Send' }
  ];
  const isBlank = mode === 'blank';
  const monthName = reportsFmtMonth(ReportsMenu.month);

  root.innerHTML = `
    <div class="reports-header">
      <div>
        <h2>${isBlank ? 'मिल्क स्टॉक रजिस्टर — Blank Form' : 'मिल्क स्टॉक रजिस्टर'}</h2>
        <div class="sub">${monthName} ${ReportsMenu.year} · Step ${step} of 3</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="reports-main">
      ${isBlank ? '' : `
        <div class="gk-stepper">
          ${stepTitles.map(s => `
            <button type="button" class="${step === s.n ? 'active' : (step > s.n ? 'done' : '')}" data-step="${s.n}">
              <span class="gk-step-no">${step > s.n ? '✓' : s.n}</span>
              <span class="gk-step-body">
                <span class="gk-step-title">${s.title}</span>
                <span class="gk-step-sub">${s.sub}</span>
              </span>
            </button>
          `).join('')}
        </div>
      `}

      <div id="msrWizardBody"></div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    ReportsMenu.view = 'form';
    ReportsMenu.msrWizardStep = 1;
    renderFormLanding('MILK_STOCK');
  });

  root.querySelectorAll('.gk-stepper button').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.dataset.step, 10);
      ReportsMenu.msrWizardStep = target;
      renderMilkStockWizard();
    });
  });

  const body = document.getElementById('msrWizardBody');
  if (step === 1) renderMSRStep1(body, isBlank);
  else if (step === 2) renderMSRStep2(body, isBlank);
  else renderMSRStep3(body, isBlank);
}


/* ==================== MSR STEP 1: Centre + Stock ==================== */
function renderMSRStep1(body, isBlank){
  const p = ReportsMenu.msrPayload;
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear - 2; y <= currentYear + 1; y++) years.push(y);

  body.innerHTML = `
    <div class="form-landing-card">
      <h3>📅 Month & Year</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;">
        <div class="stock-field" style="min-width:140px;flex:1;">
          <label>Month</label>
          <select id="msrMonth">
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
              <option value="${m}" ${m === ReportsMenu.month ? 'selected' : ''}>${reportsFmtMonth(m)}</option>
            `).join('')}
          </select>
        </div>
        <div class="stock-field" style="min-width:110px;flex:1;">
          <label>Year</label>
          <select id="msrYear">
            ${years.map(y => `<option value="${y}" ${y === ReportsMenu.year ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    ${isBlank ? '' : `
      <div class="form-landing-card">
        <h3>📋 Centre Details</h3>
        <div class="gk-meta-grid" style="margin-top:12px;">
          <div class="stock-field">
            <label>केन्द्र का नाम</label>
            <input type="text" id="msrCentreName" value="${escHtml(p.meta.centreName || '')}">
          </div>
          <div class="stock-field">
            <label>कोड</label>
            <input type="text" id="msrCode" value="${escHtml(p.meta.code || '')}">
          </div>
          <div class="stock-field">
            <label>परियोजना</label>
            <input type="text" id="msrProject" value="${escHtml(p.meta.project || '')}">
          </div>
          <div class="stock-field">
            <label>सेक्टर</label>
            <input type="text" id="msrSector" value="${escHtml(p.meta.sector || '')}">
          </div>
          <div class="stock-field">
            <label>जिला</label>
            <input type="text" id="msrDistrict" value="${escHtml(p.meta.district || '')}">
          </div>
        </div>
      </div>

      <div class="form-landing-card">
        <h3>📦 Stock Opening (ग्राम में)</h3>
        <p style="margin-bottom:12px;">गत माह का शेष ग्राम में भरें। जैसे 15 kg = 15000 ग्राम</p>
        <div class="gk-meta-grid">
          <div class="stock-field">
            <label>दूध पाउडर गत शेष (ग्राम)</label>
            <input type="number" id="msrMilkOpening" min="0" step="1" value="${Number(p.stock.milk.opening) || 0}">
          </div>
          <div class="stock-field">
            <label>चीनी गत शेष (ग्राम)</label>
            <input type="number" id="msrSugarOpening" min="0" step="1" value="${Number(p.stock.sugar.opening) || 0}">
          </div>
          <div class="stock-field">
            <label>दूध चालान संख्या</label>
            <input type="text" id="msrChallan" value="${escHtml(p.stock.milk.challan_no || '')}">
          </div>
        </div>
      </div>

      <div class="form-landing-card">
        <h3>📥 Stock Receipts (प्राप्ति)</h3>
        <p style="margin-bottom:12px;">नई प्राप्ति जोड़ें — ग्राम में</p>

        <div class="msr-receipt-grid">
          <div class="stock-field">
            <label>Type</label>
            <select id="msrReceiptType">
              <option value="milk">दूध पाउडर</option>
              <option value="sugar">चीनी</option>
            </select>
          </div>
          <div class="stock-field">
            <label>दिनांक</label>
            <input type="date" id="msrReceiptDate">
          </div>
          <div class="stock-field">
            <label>मात्रा (ग्राम)</label>
            <input type="number" id="msrReceiptQty" min="1" step="1" placeholder="जैसे 15000">
          </div>
          <div class="stock-field" style="min-width:150px;flex:1;">
            <label>चालान संख्या</label>
            <input type="text" id="msrReceiptChallan" placeholder="जैसे 17278">
          </div>
          <button class="stock-btn stock-btn-primary" id="msrAddReceipt" style="min-height:46px;">जोड़ें</button>
        </div>

        <div id="msrReceiptList" style="margin-top:12px;">
          ${renderMSRReceiptList(p)}
        </div>
      </div>
    `}

    <div class="gk-wizard-nav">
      <div></div>
      <button class="stock-btn stock-btn-primary" id="msrNext1">आगे बढ़ें →</button>
    </div>
  `;

  document.getElementById('msrMonth').addEventListener('change', (e) => {
    ReportsMenu.month = parseInt(e.target.value, 10);
    renderMilkStockForm(ReportsMenu.msrMode);
  });
  document.getElementById('msrYear').addEventListener('change', (e) => {
    ReportsMenu.year = parseInt(e.target.value, 10);
    renderMilkStockForm(ReportsMenu.msrMode);
  });

  if (!isBlank) {
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        ReportsMenu.msrPayload.meta[key] = el.value;
      });
    };
    bind('msrCentreName', 'centreName');
    bind('msrCode', 'code');
    bind('msrProject', 'project');
    bind('msrSector', 'sector');
    bind('msrDistrict', 'district');

    // Stock inputs
    document.getElementById('msrMilkOpening').addEventListener('input', (e) => {
      ReportsMenu.msrPayload.stock.milk.opening = Number(e.target.value) || 0;
    });
    document.getElementById('msrSugarOpening').addEventListener('input', (e) => {
      ReportsMenu.msrPayload.stock.sugar.opening = Number(e.target.value) || 0;
    });
    document.getElementById('msrChallan').addEventListener('input', (e) => {
      ReportsMenu.msrPayload.stock.milk.challan_no = e.target.value;
    });

    // Add receipt
    document.getElementById('msrAddReceipt').addEventListener('click', () => {
      const type = document.getElementById('msrReceiptType').value;
      const date = document.getElementById('msrReceiptDate').value;
      const qty = Number(document.getElementById('msrReceiptQty').value) || 0;
      if (!date) { showToast('दिनांक भरें', 'error'); return; }
      if (qty <= 0) { showToast('मात्रा 0 से ज्यादा होनी चाहिए', 'error'); return; }
      const challan = (document.getElementById('msrReceiptChallan')?.value || '').trim();
      const rec = { date, qty, challan };
      ReportsMenu.msrPayload.stock[type].receipts.push(rec);
      document.getElementById('msrReceiptDate').value = '';
      document.getElementById('msrReceiptQty').value = '';
      const chEl = document.getElementById('msrReceiptChallan'); if (chEl) chEl.value = '';
      document.getElementById('msrReceiptList').innerHTML = renderMSRReceiptList(ReportsMenu.msrPayload);
      bindReceiptDelete();
    });

    bindReceiptDelete();
  }

  document.getElementById('msrNext1').addEventListener('click', () => {
    ReportsMenu.msrWizardStep = 2;
    renderMilkStockWizard();
  });
}

function renderMSRReceiptList(p){
  const milk = (p.stock.milk.receipts || []).map((r, i) => ({...r, type:'milk', idx:i}));
  const sugar = (p.stock.sugar.receipts || []).map((r, i) => ({...r, type:'sugar', idx:i}));
  const all = [...milk, ...sugar].sort((a,b) => (a.date || '').localeCompare(b.date || ''));
  if (!all.length) return '<p style="color:var(--rr-muted);font-size:13px;">कोई प्राप्ति नहीं जोड़ी गई।</p>';
  return all.map(r => `
    <div class="msr-receipt-item">
      <span><b>${r.type === 'milk' ? 'दूध पाउडर' : 'चीनी'}</b> — ${gkDateLabel(r.date)} — ${r.qty} ग्राम (${msrKg(r.qty)} kg)</span>
      <button type="button" class="stock-btn stock-btn-danger stock-btn-sm" data-msr-del-type="${r.type}" data-msr-del-idx="${r.idx}">🗑 हटाएँ</button>
    </div>
  `).join('');
}

function bindReceiptDelete(){
  document.querySelectorAll('[data-msr-del-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.msrDelType;
      const idx = parseInt(btn.dataset.msrDelIdx, 10);
      ReportsMenu.msrPayload.stock[type].receipts.splice(idx, 1);
      document.getElementById('msrReceiptList').innerHTML = renderMSRReceiptList(ReportsMenu.msrPayload);
      bindReceiptDelete();
    });
  });
}


/* ==================== MSR STEP 2: Daily beneficiaries entry ==================== */
function renderMSRStep2(body, isBlank){
  const p = ReportsMenu.msrPayload;
  msrRecalc(p);
  const totals = p.summary || {};

  body.innerHTML = `
    <div class="form-landing-card">
      <h3>👦 दैनिक लाभार्थी संख्या</h3>
      <p style="margin-bottom:12px;">सोमवार से शुक्रवार प्रत्येक दिन बच्चों की संख्या भरें। अगर stock कम होगी तो वितरण अपने आप limit हो जाएगा।</p>

      <div style="overflow-x:auto;">
        <table class="mk-entry-table">
          <thead>
            <tr>
              <th style="width:60px;">क्र.</th>
              <th style="width:120px;">दिनांक</th>
              <th style="width:100px;">वार</th>
              <th style="width:150px;">लाभार्थी संख्या</th>
            </tr>
          </thead>
          <tbody>
            ${p.daily.map((r, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${gkDateLabel(r.date)}</td>
                <td>${escHtml(r.dayName)}</td>
                <td>
                  <input type="number" min="0" step="1" data-msr-day="${i}"
                         value="${r.beneficiaries === '' ? '' : escHtml(String(r.beneficiaries))}"
                         ${isBlank ? 'disabled' : ''}>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="gk-totals">
      <div class="gk-total-card">
        <div class="label">कुल हाजिरी (served)</div>
        <div class="value" id="msrTotBene">${totals.beneficiaries || 0}</div>
      </div>
      <div class="gk-total-card">
        <div class="label">दूध पाउडर used (kg)</div>
        <div class="value" id="msrTotMilk">${msrKg(totals.milk_used || 0)}</div>
      </div>
      <div class="gk-total-card accent">
        <div class="label">चीनी used (kg)</div>
        <div class="value" id="msrTotSugar">${msrKg(totals.sugar_used || 0)}</div>
      </div>
    </div>

    <div class="gk-wizard-nav">
      <button class="stock-btn stock-btn-secondary" id="msrPrev2">← पीछे</button>
      <button class="stock-btn stock-btn-primary" id="msrNext2">आगे बढ़ें →</button>
    </div>
  `;

  body.querySelectorAll('[data-msr-day]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(inp.dataset.msrDay, 10);
      ReportsMenu.msrPayload.daily[idx].beneficiaries = e.target.value;
      msrRecalc(ReportsMenu.msrPayload);
      const t = ReportsMenu.msrPayload.summary || {};
      const elB = document.getElementById('msrTotBene');
      const elM = document.getElementById('msrTotMilk');
      const elS = document.getElementById('msrTotSugar');
      if (elB) elB.textContent = t.beneficiaries || 0;
      if (elM) elM.textContent = msrKg(t.milk_used || 0);
      if (elS) elS.textContent = msrKg(t.sugar_used || 0);
    });
  });

  document.getElementById('msrPrev2').addEventListener('click', () => {
    ReportsMenu.msrWizardStep = 1;
    renderMilkStockWizard();
  });
  document.getElementById('msrNext2').addEventListener('click', () => {
    ReportsMenu.msrWizardStep = 3;
    renderMilkStockWizard();
  });
}


/* ==================== MSR STEP 3: Preview + Save ==================== */
function renderMSRStep3(body, isBlank){
  const p = ReportsMenu.msrPayload;
  msrRecalc(p);
  const t = p.summary || {};

  body.innerHTML = `
    <div class="form-landing-card">
      <h3>✅ Preview</h3>
      <p>नीचे final preview है। Save Draft / Send / Print से आगे बढ़ें।</p>
    </div>

    <div class="gk-totals">
      <div class="gk-total-card">
        <div class="label">कुल हाजिरी</div>
        <div class="value">${t.beneficiaries || 0}</div>
      </div>
      <div class="gk-total-card">
        <div class="label">दूध पाउडर Closing (kg)</div>
        <div class="value">${msrKg(t.milk_closing || 0)}</div>
      </div>
      <div class="gk-total-card accent">
        <div class="label">चीनी Closing (kg)</div>
        <div class="value">${msrKg(t.sugar_closing || 0)}</div>
      </div>
    </div>

    <div style="margin:16px 0;overflow-x:auto;">
      ${renderMilkStockSheetHtml(p, isBlank)}
    </div>

    ${!isBlank ? `
      <div class="gk-wizard-nav" style="flex-wrap:wrap;justify-content:flex-start;">
        <button class="stock-btn stock-btn-secondary" id="msrSaveDraft3">💾 Save Draft</button>
        <button class="stock-btn stock-btn-primary" id="msrSend3">📚 Save & Send to Register</button>
        <button class="stock-btn stock-btn-secondary" id="msrPrint3">🖨️ Print / Save PDF</button>
        <button class="stock-btn stock-btn-secondary" id="msrPrev3" style="margin-left:auto;">← पीछे</button>
      </div>
    ` : `
      <div class="gk-wizard-nav" style="flex-wrap:wrap;justify-content:flex-start;">
        <button class="stock-btn stock-btn-primary" id="msrPrint3">🖨️ Print / Save PDF</button>
        <button class="stock-btn stock-btn-secondary" id="msrPrev3" style="margin-left:auto;">← पीछे</button>
      </div>
    `}
  `;

  const sd = document.getElementById('msrSaveDraft3');
  if (sd) sd.addEventListener('click', async () => {
    try {
      await api('/api/reports/MILK_STOCK/draft', {
        method: 'POST',
        body: { year: ReportsMenu.year, month: ReportsMenu.month, payload: ReportsMenu.msrPayload }
      });
      showToast('Draft saved.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  const snd = document.getElementById('msrSend3');
  if (snd) snd.addEventListener('click', async () => {
    try {
      const res = await api('/api/reports/MILK_STOCK/send-to-register', {
        method: 'POST',
        body: { year: ReportsMenu.year, month: ReportsMenu.month, payload: ReportsMenu.msrPayload }
      });
      showToast(res.message || 'Sent to Register.', 'success');
    } catch (e) { showToast(e.message, 'error'); }
  });

  const pr = document.getElementById('msrPrint3');
  if (pr) pr.addEventListener('click', () => printMilkStockSheet(isBlank));

  document.getElementById('msrPrev3').addEventListener('click', () => {
    ReportsMenu.msrWizardStep = 2;
    renderMilkStockWizard();
  });
}


/* ==================== MSR SHEET CSS (A4 Landscape) ==================== */
const MSR_SHEET_CSS = `
.msr-sheet{
  width:297mm;
  min-height:210mm;
  margin:0 auto;
  background:#fff;
  color:#111;
  padding:7mm 8mm 5mm;
  box-sizing:border-box;
  font-family:"Nirmala UI","Mangal","Noto Sans Devanagari",Arial,sans-serif;
}
.msr-office{
  text-align:center;
  font-size:30px;
  line-height:1.2;
  font-weight:600;
  margin:0 0 1mm;
}
.msr-title{
  text-align:center;
  font-size:18px;
  line-height:1.2;
  font-weight:500;
  margin:0 0 3mm;
}
.msr-meta{
  display:flex;
  gap:5mm;
  flex-wrap:wrap;
  font-size:14px;
  line-height:1.4;
  margin-bottom:3mm;
}
.msr-meta-item{white-space:nowrap}
.msr-meta-value{
  display:inline-block;
  min-width:30mm;
  font-size:13px;
  border-bottom:1px dotted #333;
  padding:0 2px;
  font-weight:400;
  text-align:center;
}
.msr-table{
  width:100%;
  border-collapse:collapse;
  table-layout:fixed;
  font-size:11px;
  font-weight:500;
}
.msr-table th,
.msr-table td{
  border:1px solid #161616;
  padding:1mm .6mm;
  text-align:center;
  vertical-align:middle;
  line-height:1.1;
}
.msr-table th{
  font-weight:600;
  background:#fffdf4;
  font-size:10px;
}
.msr-table tbody td{height:6mm}
.msr-table .msr-grp-milk{background:#fff5e8}
.msr-table .msr-grp-sugar{background:#eaf7ec}
.msr-table .msr-total-row td{
  color:#b0251f !important;
  font-weight:600 !important;
  border:1.5px solid #b0251f !important;
  background:#fff8f7 !important;
}
.msr-signatures{
  display:flex;
  justify-content:space-between;
  gap:8mm;
  margin-top:8mm;
  font-size:11px;
  font-weight:400;
}
.msr-signatures .msr-sig-block{text-align:center;flex:1}
.msr-signatures .msr-sig-space{height:12mm}
.msr-signatures .msr-sig-label{border-top:1px solid #111;padding-top:2mm;font-weight:500}

@media print{
  @page{ size:A4 landscape; margin:0 !important; }
  html,body{
    width:100% !important;height:100% !important;
    margin:0 !important;padding:0 !important;
    background:#fff !important;overflow:hidden !important;
  }
  body *{ visibility:hidden !important; }
  .msr-sheet.msr-print-active,
  .msr-sheet.msr-print-active *{ visibility:visible !important; }
  .msr-sheet.msr-print-active{
    position:absolute !important;
    left:0 !important;top:0 !important;
    transform:none !important;
    transform-origin:top left !important;
    width:297mm !important;
    height:206mm !important;
    min-width:0 !important;min-height:0 !important;
    max-width:none !important;max-height:none !important;
    margin:0 !important;
    padding:7mm 8mm 5mm !important;
    box-sizing:border-box !important;
    zoom:.89 !important;
    overflow:hidden !important;box-shadow:none !important;
    background:#fff !important;
    break-inside:avoid !important;
    page-break-inside:avoid !important;
    page-break-after:avoid !important;
  }
  .msr-sheet.msr-print-active .msr-total-row td{
    color:#b0251f !important;font-weight:600 !important;
    border:1.5px solid #b0251f !important;
  }
}
`;

/* ==================== MSR SHEET HTML ==================== */
function renderMilkStockSheetHtml(p, isBlank){
  if (!p) return '';
  msrRecalc(p);
  const computed = p.daily_computed || [];
  const total = p.summary || {};

  const rows = computed.map((r, i) => {
    const req = isBlank ? '' : String(r.requested || 0);
    const served = isBlank ? '' : String(r.served || 0);
    const milkOpen  = isBlank ? '' : msrVal(r.milk.opening, i === 0);
    const milkRecv  = isBlank ? '' : msrVal(r.milk.received, true);
    const milkTotal = isBlank ? '' : msrVal(r.milk.total, false);
    const milkUsed  = isBlank ? '' : msrVal(r.milk.used, true);
    const milkClose = isBlank ? '' : msrVal(r.milk.closing, false);
    const sugarOpen  = isBlank ? '' : msrVal(r.sugar.opening, i === 0);
    const sugarRecv  = isBlank ? '' : msrVal(r.sugar.received, true);
    const sugarTotal = isBlank ? '' : msrVal(r.sugar.total, false);
    const sugarUsed  = isBlank ? '' : msrVal(r.sugar.used, true);
    const sugarClose = isBlank ? '' : msrVal(r.sugar.closing, false);
    const challan = isBlank ? '' : escHtml(r.challan_no || '');
    return '<tr>' +
      '<td>' + gkDateLabel(r.date) + '</td>' +
      '<td>' + escHtml(r.dayName) + '</td>' +
      '<td>' + served + '</td>' +
      '<td>' + (isBlank ? '' : msrVal((r.served || 0) * 10, true)) + '</td>' +
      '<td>' + (isBlank ? '' : msrVal((r.served || 0) * 4, true)) + '</td>' +
      '<td>' + challan + '</td>' +
      '<td>' + milkOpen + '</td>' +
      '<td>' + milkRecv + '</td>' +
      '<td>' + milkTotal + '</td>' +
      '<td>' + milkUsed + '</td>' +
      '<td>' + milkClose + '</td>' +
      '<td>' + sugarOpen + '</td>' +
      '<td>' + sugarRecv + '</td>' +
      '<td>' + sugarTotal + '</td>' +
      '<td>' + sugarUsed + '</td>' +
      '<td>' + sugarClose + '</td>' +
      '<td></td>' +
    '</tr>';
  }).join('');

  const totalRow = '<tr class="msr-total-row">' +
    '<td colspan="2">योग</td>' +
    '<td>' + (isBlank ? '' : String(total.beneficiaries || 0)) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg((total.beneficiaries || 0) * 10)) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg((total.beneficiaries || 0) * 4)) + '</td>' +
    '<td>' + (isBlank ? '' : escHtml(p.stock.milk.challan_no || '')) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg(total.milk_opening || 0)) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg(total.milk_received || 0)) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg(total.milk_total || 0)) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg(total.milk_used || 0)) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg(total.milk_closing || 0)) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg(total.sugar_opening || 0)) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg(total.sugar_received || 0)) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg(total.sugar_total || 0)) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg(total.sugar_used || 0)) + '</td>' +
    '<td>' + (isBlank ? '' : msrKg(total.sugar_closing || 0)) + '</td>' +
    '<td></td>' +
  '</tr>';

  const monthName = gkMonthHindi(p.month);
  const year = p.year;
  const proj = isBlank ? '' : escHtml(p.meta.project || '');
  const sect = isBlank ? '' : escHtml(p.meta.sector || '');
  const dist = isBlank ? '' : escHtml(p.meta.district || '');
  const cnam = isBlank ? '' : escHtml(p.meta.centreName || '');
  const code = isBlank ? '' : escHtml(p.meta.code || '');

  return '<style>' + MSR_SHEET_CSS + '</style>' +
'<div class="msr-sheet">' +
  '<div class="msr-office">कार्यालय महिला एवं बाल विकास अधिकारी गुड़ामालानी</div>' +
  '<div class="msr-title">दूध वितरण एवं स्टॉक पंजिका</div>' +
  '<div class="msr-meta">' +
    '<span class="msr-meta-item">आंगनवाड़ी केन्द्र का नाम - <span class="msr-meta-value">' + cnam + '</span></span>' +
    '<span class="msr-meta-item">सेक्टर - <span class="msr-meta-value">' + sect + '</span></span>' +
    '<span class="msr-meta-item">परियोजना - <span class="msr-meta-value">' + proj + '</span></span>' +
    '<span class="msr-meta-item">जिला - <span class="msr-meta-value">' + dist + '</span></span>' +
    '<span class="msr-meta-item">कोड - <span class="msr-meta-value">' + code + '</span></span>' +
    '<span class="msr-meta-item">माह - <span class="msr-meta-value">' + escHtml(monthName) + '</span></span>' +
    '<span class="msr-meta-item">वर्ष - <span class="msr-meta-value">' + escHtml(String(year)) + '</span></span>' +
  '</div>' +
  '<table class="msr-table">' +
    '<colgroup>' +
      '<col style="width:5.8%"><col style="width:5.6%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%"><col style="width:5.5%">' +
      '<col style="width:5.8%"><col style="width:5.8%"><col style="width:5.8%"><col style="width:5.8%"><col style="width:5.8%">' +
      '<col style="width:5.8%"><col style="width:5.8%"><col style="width:5.8%"><col style="width:5.8%"><col style="width:5.8%">' +
      '<col style="width:6.5%">' +
    '</colgroup>' +
    '<thead>' +
      '<tr>' +
        '<th rowspan="2">दिनांक</th>' +
        '<th rowspan="2">वार</th>' +
        '<th rowspan="2">3 से 6 वर्ष के<br>लाभार्थी</th>' +
        '<th rowspan="2">दूध वितरण<br>प्रति लाभार्थी<br>10 ग्राम</th>' +
        '<th rowspan="2">चीनी वितरण<br>प्रति लाभार्थी<br>4 ग्राम</th>' +
        '<th rowspan="2">दूध<br>चालान<br>संख्या</th>' +
        '<th colspan="5" class="msr-grp-milk">दूध पाउडर (कि.ग्रा.)</th>' +
        '<th colspan="5" class="msr-grp-sugar">चीनी (कि.ग्रा.)</th>' +
        '<th rowspan="2">कार्यकर्ता<br>हस्ताक्षर</th>' +
      '</tr>' +
      '<tr>' +
        '<th>गत शेष</th><th>प्राप्त</th><th>योग</th><th>आज की खपत</th><th>शेष</th>' +
        '<th>गत शेष</th><th>प्राप्त</th><th>योग</th><th>आज की खपत</th><th>शेष</th>' +
      '</tr>' +
    '</thead>' +
    '<tbody>' + rows + totalRow + '</tbody>' +
  '</table>' +
  '<div class="msr-signatures">' +
    '<div class="msr-sig-block"><div class="msr-sig-space"></div><div class="msr-sig-label">कार्यकर्ता के हस्ताक्षर</div></div>' +
    '<div class="msr-sig-block"><div class="msr-sig-space"></div><div class="msr-sig-label">महिला पर्यवेक्षक</div></div>' +
    '<div class="msr-sig-block"><div class="msr-sig-space"></div><div class="msr-sig-label">बाल विकास परियोजना अधिकारी</div></div>' +
  '</div>' +
'</div>';
}

/* ==================== MSR PRINT ==================== */
function printMilkStockSheet(isBlank){
  const sourceSheet = document.querySelector('.msr-sheet');
  if (!sourceSheet) { showToast('Preview उपलब्ध नहीं है।', 'error'); return; }

  const clone = sourceSheet.cloneNode(true);
  clone.classList.add('msr-print-active');

  /* Single right-aligned signature only */
  const sigs = clone.querySelector('.msr-signatures');
  if (sigs) {
    sigs.innerHTML = '<div class="msr-sig-block"><div class="msr-sig-space"></div><div class="msr-sig-label">कार्यकर्ता के हस्ताक्षर</div></div>';
  }

  const html = clone.outerHTML;

  const iframe = document.createElement('iframe');
  iframe.className = 'gk-print-host';
  iframe.setAttribute('title', 'Milk Stock Register Print');
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); return; }

  const override_css = [
    '@page{size:A4 landscape;margin:4mm!important}',
    'html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;}',
    '.msr-sheet,.msr-sheet *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}',
    '.msr-sheet.msr-print-active{width:289mm!important;max-width:289mm!important;min-width:0!important;height:auto!important;min-height:0!important;max-height:none!important;padding:2mm 3mm!important;margin:0!important;box-sizing:border-box!important;position:relative!important;left:0!important;top:0!important;transform:none!important;overflow:visible!important;box-shadow:none!important;zoom:1!important;}',
    '.msr-meta{display:flex!important;flex-wrap:nowrap!important;justify-content:space-between!important;gap:1mm!important;font-size:12px!important;line-height:1.2!important;margin-bottom:1.5mm!important;overflow:visible!important;white-space:nowrap!important;width:100%!important;}',
    '.msr-meta-item{flex:0 1 auto!important;font-size:12px!important;white-space:nowrap!important;text-align:center!important;}',
    '.msr-meta-value{font-size:12px!important;min-width:0!important;max-width:none!important;padding:0 2px!important;border-bottom:1px dotted #333!important;text-align:center!important;display:inline-block!important;}',
    '.msr-meta-item:first-child .msr-meta-value{max-width:none!important;}',
    '.msr-office{font-size:20px!important;line-height:1.1!important;margin:0 0 0.5mm!important;}',
    '.msr-title{font-size:13px!important;line-height:1.1!important;margin:0 0 1mm!important;}',
    '.msr-table{font-size:14px!important;}',
    '.msr-table th,.msr-table td{padding:0.35mm 0.25mm!important;line-height:1.05!important;} .msr-table tbody td{font-size:14px!important;}',
    '.msr-table th{font-size:10px!important;}.msr-table thead tr:first-child th:nth-child(1),.msr-table thead tr:first-child th:nth-child(2),.msr-table thead tr:first-child th:nth-child(4),.msr-table thead tr:first-child th:nth-child(5){font-size:8px!important;}',
    '.msr-table tbody td{height:6.2mm!important;}',
    '.msr-table .msr-total-row td{color:#b0251f!important;font-weight:600!important;border:1.5px solid #b0251f!important;background:#fff8f7!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}',
    '.msr-table .msr-grp-milk{background:#fff5e8!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}',
    '.msr-table .msr-grp-sugar{background:#eaf7ec!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}',
    '.msr-signatures{display:block!important;margin-top:1mm!important;margin-bottom:4mm!important;padding:0!important;text-align:right!important;}',
    '.msr-signatures .msr-sig-block{display:block!important;width:auto!important;flex:none!important;text-align:right!important;margin-left:auto!important;padding:0!important;}',
    '.msr-signatures .msr-sig-space{height:4mm!important;width:60mm!important;margin-left:auto!important;}',
    '.msr-signatures .msr-sig-label{border:0!important;padding:0!important;text-align:right!important;width:60mm!important;margin-left:auto!important;margin-top:1mm!important;font-size:10px!important;font-weight:500!important;}'
  ].join('');

  doc.open();
  doc.write(
    '<!doctype html><html><head><meta charset="utf-8">' +
    '<style>' +
    MSR_SHEET_CSS +
    override_css +
    '</style></head><body>' + html + '</body></html>'
  );
  doc.close();

  const cleanup = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };
  try { iframe.contentWindow.addEventListener('afterprint', cleanup, { once: true }); } catch (e) {}

  setTimeout(() => {
    try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
    setTimeout(cleanup, 60000);
  }, 800);
}

/* ===== MILK CLAIM — FORCE LIGHTER + SMALLER (inline) ===== */
(function(){
  function apply(){
    var sheets = document.querySelectorAll('.milk-claim-sheet, .dava-sheet');
    sheets.forEach(function(s){
      if(!s.classList.contains('milk-claim-sheet') && !s.classList.contains('dava-sheet')) return;

      // पूरा sheet — font-weight कम
      s.querySelectorAll('*').forEach(function(el){
        el.style.setProperty('font-weight','500','important');
      });

      // Headings को थोड़ा bold
      s.querySelectorAll('.dava-office, .dava-title, th, b, strong').forEach(function(el){
        el.style.setProperty('font-weight','600','important');
      });

      // Table values छोटी
      s.querySelectorAll('.milk-claim-table td, .milk-claim-table th, .mc-serial, .mc-day, .mc-date, .mc-count').forEach(function(el){
        el.style.setProperty('font-size','12px','important');
        el.style.setProperty('font-weight','500','important');
      });

      s.querySelectorAll('.milk-claim-total-label, .milk-claim-total-count').forEach(function(el){
        el.style.setProperty('font-size','13px','important');
        el.style.setProperty('font-weight','600','important');
      });

      // प्रमाणित पैराग्राफ
      s.querySelectorAll('.dava-cert').forEach(function(el){
        el.style.setProperty('font-size','11px','important');
        el.style.setProperty('font-weight','400','important');
      });

      // सत्यापित हस्ताक्षर
      s.querySelectorAll('.dava-approvals').forEach(function(el){
        el.style.setProperty('font-size','10px','important');
        el.style.setProperty('font-weight','400','important');
      });

      // कार्यकर्ता हस्ताक्षर मय मोहर
      s.querySelectorAll('.dava-worker-sign, .dava-worker-sign *, .dava-seal').forEach(function(el){
        el.style.setProperty('font-size','10px','important');
        el.style.setProperty('font-weight','400','important');
      });

      // Meta
      s.querySelectorAll('.dava-meta, .dava-meta *, .dava-meta-value').forEach(function(el){
        el.style.setProperty('font-weight','400','important');
      });
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
  try{ new MutationObserver(apply).observe(document.body, {childList:true, subtree:true}); }catch(e){}
  setInterval(apply, 1000);
})();

/* ==================== FORM 4 (पूरक पोषण दैनिक मासिक) ==================== */
(function(){
  if(window.__f4Module) return;
  window.__f4Module = true;

  const F4_RECIPES = [
    {code:'SWEET_MURMURA', name:'मीठा मुरमुरा',   days:[1,3,5], weight:'60 ग्राम'},
    {code:'SALTY_MURMURA', name:'नमकीन मुरमुरा', days:[2,4,6], weight:'60 ग्राम'},
    {code:'KHICHDI',       name:'खिचड़ी',           days:[1,4],   weight:'60 ग्राम'},
    {code:'SWEET_DALIA',   name:'मीठा दलिया',      days:[2,5],   weight:'60 ग्राम'},
    {code:'UPMA',          name:'उपमा',             days:[3,6],   weight:'60 ग्राम'}
  ];
  const F4_MONTHS = ['जनवरी','फरवरी','मार्च','अप्रैल','मई','जून','जुलाई','अगस्त','सितंबर','अक्टूबर','नवंबर','दिसंबर'];
  const F4_DAYS = ['रविवार','सोमवार','मंगलवार','बुधवार','गुरुवार','शुक्रवार','शनिवार'];

  function f4Iso(y,m,d){ return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'); }
  function f4DaysIn(y,m){ return new Date(y,m,0).getDate(); }
  function f4Dow(y,m,d){ return new Date(y,m-1,d).getDay(); }
  function f4Num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
  function f4Esc(v){ return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  window.f4DefaultPayload = function(year, month){
    const days = f4DaysIn(year, month);
    const daily = [];
    for(let d=1; d<=days; d++){
      const recipes = {};
      F4_RECIPES.forEach(r => recipes[r.code] = {opening:null,receipt:null,total:null,distribution:null,closing:null});
      daily.push({
        date: f4Iso(year, month, d),
        day: d,
        dow: f4Dow(year, month, d),
        holiday: null,
        boys:'', girls:'', total:'',
        recipes
      });
    }
    return {
      year, month,
      centre: {name:'', code:'', project_name:'', sector_name:'', district:''},
      daily,
      month_total: {boys:0, girls:0, total:0},
      summary: F4_RECIPES.map(r => ({code:r.code, recipe:r.name, opening:0, received:0, total:0, distributed:0, closing:0, receipt_date:null})),
      recipe_data: F4_RECIPES.reduce((a, r) => { a[r.code] = {opening: 0, receipts: []}; return a; }, {}),
      special_details: ''
    };
  };

  function f4FormatDate(iso){
    if(!iso) return '';
    const parts = String(iso).slice(0,10).split('-');
    if(parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0].slice(-2);
    return iso;
  }

  function f4CalcRecipeSummary(rec, data, p){
    const opening = f4Num(data.opening);
    const monthStart = p.year + '-' + String(p.month).padStart(2,'0') + '-01';
    const monthEnd = p.year + '-' + String(p.month).padStart(2,'0') + '-' + String(f4DaysIn(p.year, p.month)).padStart(2,'0');
    
    // receipts group by date
    const recByDate = {};
    let prevMonthRecv = 0;
    (data.receipts || []).forEach(r => {
      if(!r.date) return;
      const dstr = String(r.date).slice(0,10);
      const qty = f4Num(r.qty);
      if(dstr < monthStart) prevMonthRecv += qty;
      else recByDate[dstr] = (recByDate[dstr] || 0) + qty;
    });
    
    let balance = opening;
    let totalRecv = 0, totalDist = 0;
    const rows = [];
    
    p.daily.forEach((r, idx) => {
      const isHoliday = r.holiday || r.dow === 0;
      const applicable = !isHoliday && rec.days.indexOf(r.dow) !== -1;
      let todayRecv = recByDate[r.date] || 0;
      // पहले दिन पिछले महीने की receipt जोड़ें
      if(idx === 0 && prevMonthRecv > 0) todayRecv += prevMonthRecv;
      totalRecv += todayRecv;
      
      const totalStock = balance + todayRecv;
      let dist = 0;
      if(applicable && f4Num(r.total) > 0){
        const need = f4Num(r.total) * 0.060;
        dist = Math.min(need, totalStock);
      }
      const closing = Math.max(0, totalStock - dist);
      totalDist += dist;
      
      const inactive = (!applicable && todayRecv === 0);
      rows.push('<tr class="' + (inactive ? 'f4-inactive' : '') + '">' +
        '<td>' + String(r.day).padStart(2,'0') + '/' + String(p.month).padStart(2,'0') + '</td>' +
        '<td>' + balance.toFixed(3) + '</td>' +
        '<td>' + (todayRecv > 0 ? todayRecv.toFixed(3) : '—') + '</td>' +
        '<td>' + totalStock.toFixed(3) + '</td>' +
        '<td>' + (applicable && dist > 0 ? dist.toFixed(3) : '—') + '</td>' +
        '<td>' + closing.toFixed(3) + '</td>' +
        '</tr>');
      
      balance = closing;
    });
    
    const text = '<b>प्रा. शेष:</b> ' + opening.toFixed(3) +
      ' · <b>कुल प्राप्ति:</b> ' + totalRecv.toFixed(3) +
      ' · <b>कुल वितरण:</b> ' + totalDist.toFixed(3) +
      ' · <b>अ.शेष:</b> ' + balance.toFixed(3) + ' किलो' +
      '<br><span style="color:#a07613;">⚠️ अ.शेष अगले माह auto carry forward नहीं होगा — वहाँ manual opening भरें।</span>';
    
    return { rows: rows.join(''), text, opening, totalRecv, totalDist, closing: balance };
  }

  function f4RefreshRecipePreview(code){
    const rec = F4_RECIPES.find(r => r.code === code);
    if(!rec) return;
    const p = ReportsMenu.f4Payload;
    const data = (p.recipe_data && p.recipe_data[code]) || {opening: 0, receipts: []};
    const summary = f4CalcRecipeSummary(rec, data, p);
    const acc = document.querySelector('.f4-recipe-acc[data-rec="' + code + '"]');
    if(!acc) return;
    
    const listEl = acc.querySelector('[data-reclist="' + code + '"]');
    if(listEl){
      listEl.innerHTML = (data.receipts || []).length
        ? (data.receipts || []).map((r, i) =>
            '<div class="f4-receipt-item"><span>📦 ' + f4FormatDate(r.date) + ' — ' + f4Num(r.qty).toFixed(3) + ' किलो</span>' +
            '<button type="button" data-f4del-rec="' + code + '" data-idx="' + i + '">🗑 हटाएँ</button></div>'
          ).join('')
        : '<div style="color:#8a8e97;font-size:12px;padding:6px 0;">कोई प्राप्ति नहीं जोड़ी गई।</div>';
      listEl.querySelectorAll('[data-f4del-rec]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx, 10);
          data.receipts.splice(idx, 1);
          f4RefreshRecipePreview(code);
        });
      });
    }
    
    const tbody = acc.querySelector('.f4-mini-table tbody');
    if(tbody) tbody.innerHTML = summary.rows;
    const sumEl = acc.querySelector('.f4-rec-summary');
    if(sumEl) sumEl.innerHTML = summary.text;
    
    const rdateEl = acc.querySelector('.f4-rec-rdate[data-rec="' + code + '"]');
    const rqtyEl = acc.querySelector('.f4-rec-rqty[data-rec="' + code + '"]');
    if(rdateEl) rdateEl.value = '';
    if(rqtyEl) rqtyEl.value = '';
  }

  window.renderForm4Form = async function(mode){
    const root = document.getElementById('viewRoot');
    if(!root) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    ReportsMenu.f4Mode = mode;
    ReportsMenu.f4Step = 1;
    ReportsMenu.f4OpenRecipe = null;

    // पहले current month का draft देखो
    const draftKey = 'f4_draft_' + year + '_' + month;
    let loadedFromDraft = false;
    try {
      const saved = localStorage.getItem(draftKey);
      if(saved){
        const parsed = JSON.parse(saved);
        if(parsed && parsed.daily && parsed.daily.length){
          ReportsMenu.f4Payload = parsed;
          if(!ReportsMenu.f4Payload.recipe_data) ReportsMenu.f4Payload.recipe_data = {};
          F4_RECIPES.forEach(r => {
            if(!ReportsMenu.f4Payload.recipe_data[r.code]){
              ReportsMenu.f4Payload.recipe_data[r.code] = {opening:0, receipts:[]};
            }
          });
          loadedFromDraft = true;
          ReportsMenu.f4Message = '✓ पिछला draft load हो गया';
        }
      }
    } catch(e){ console.warn('Draft load fail:', e); }

    if(!loadedFromDraft){
      ReportsMenu.f4Payload = window.f4DefaultPayload(year, month);
      try {
        const prevM = month === 1 ? 12 : month - 1;
        const prevY = month === 1 ? year - 1 : year;
        const d = await api('/api/reports/FORM4/draft?year=' + prevY + '&month=' + prevM);
        if(d && d.draft && d.draft.centre){
          ReportsMenu.f4Payload.centre = Object.assign({}, d.draft.centre);
        }
      } catch(e){ /* no draft */ }
      ReportsMenu.f4Message = '';
    }

    await f4LoadHolidays(true);
    renderF4Wizard();
  };

  function renderF4Wizard(){
    const root = document.getElementById('viewRoot');
    if(!root) return;
    const p = ReportsMenu.f4Payload;
    const step = ReportsMenu.f4Step || 1;
    const monthName = F4_MONTHS[(p.month||1)-1];
    const steps = [
      {n:1, t:'मूल जानकारी', s:'Basic'},
      {n:2, t:'B / G / T',   s:'Daily'},
      {n:3, t:'Recipe विवरण', s:'Recipes'},
      {n:4, t:'जाँचें और Save', s:'Final'}
    ];

    let bodyHtml = '';
    if(step === 1) bodyHtml = f4Step1Html(p);
    else if(step === 2) bodyHtml = f4Step2Html(p);
    else if(step === 3) bodyHtml = f4Step3Html(p);
    else bodyHtml = f4Step4Html(p);

    root.innerHTML = `
      <div class="reports-header">
        <div>
          <h2>Form No. 4</h2>
          <div class="sub">${monthName} ${p.year} · Step ${step} of 4</div>
        </div>
        <div class="header-actions">
          <button class="back-btn" id="f4Back">← Back</button>
        </div>
      </div>
      <div class="reports-main">
        <div class="f4-stepper">
          ${steps.map(s => `
            <button class="f4-step ${step===s.n?'active':(step>s.n?'done':'')}" data-f4step="${s.n}">
              <span class="f4-step-no">${step>s.n?'✓':s.n}</span>
              <span class="f4-step-body">
                <span class="f4-step-title">${s.t}</span>
                <span class="f4-step-sub">${s.s}</span>
              </span>
            </button>
          `).join('')}
        </div>
        <div id="f4Body">${bodyHtml}</div>
        <div class="f4-nav">
          <button class="stock-btn stock-btn-secondary" id="f4Prev" ${step<=1?'disabled':''}>← Previous</button>
          <button class="stock-btn stock-btn-primary" id="f4Next" ${step>=4?'disabled':''}>Next →</button>
        </div>
      </div>
    `;

    let f4NavLock = false;
    root.querySelectorAll('[data-f4step]').forEach(btn => {
      btn.addEventListener('click', () => {
        if(f4NavLock) return;
        f4NavLock = true;
        try { f4CaptureInputs(); } catch(e){}
        ReportsMenu.f4Step = parseInt(btn.dataset.f4step, 10);
        renderF4Wizard();
        setTimeout(() => { f4NavLock = false; }, 150);
      });
    });
    document.getElementById('f4Back').addEventListener('click', () => {
      ReportsMenu.view = 'form';
      ReportsMenu.type = 'FORM4';
      renderFormLanding('FORM4');
    });
    document.getElementById('f4Prev').addEventListener('click', () => {
      if(ReportsMenu.f4Step > 1){ ReportsMenu.f4Step--; renderF4Wizard(); }
    });
    document.getElementById('f4Next').addEventListener('click', () => {
      f4CaptureInputs();
      if(ReportsMenu.f4Step < 4){ ReportsMenu.f4Step++; renderF4Wizard(); }
    });

    f4BindStepHandlers();
  }

  function f4Step1Html(p){
    const c = p.centre || {};
    return `
      <div class="form-landing-card">
        <h3>1. मूल जानकारी</h3>
        <div class="f4-grid">
          <div><label>केन्द्र का नाम</label><input id="f4Name" value="${f4Esc(c.name)}"></div>
          <div><label>कोड</label><input id="f4Code" value="${f4Esc(c.code)}"></div>
          <div><label>परियोजना</label><input id="f4Project" value="${f4Esc(c.project_name)}"></div>
          <div><label>सेक्टर</label><input id="f4Sector" value="${f4Esc(c.sector_name)}"></div>
          <div><label>जिला</label><input id="f4District" value="${f4Esc(c.district)}"></div>
          <div><label>माह</label>
            <select id="f4Month">${F4_MONTHS.map((m,i)=>`<option value="${i+1}" ${(i+1)===p.month?'selected':''}>${m}</option>`).join('')}</select>
          </div>
          <div><label>वर्ष</label><input id="f4Year" type="number" value="${p.year}"></div>
        </div>
        <div class="f4-note">पिछले महीने की जानकारी auto भर दी गई है — जरूरत हो तो बदलें।</div>
      </div>
    `;
  }

  function f4Step2Html(p){
    const rows = p.daily.map(r => {
      const locked = r.dow === 0 || !!r.holiday;
      const hname = r.holiday && r.holiday.name ? r.holiday.name : (r.dow === 0 ? 'रविवार' : '');
      const dateLbl = String(r.day).padStart(2,'0')+'/'+String(p.month).padStart(2,'0')+'/'+p.year;
      if(locked){
        return `<tr class="f4-locked">
          <td>${r.day}</td>
          <td>${dateLbl}</td>
          <td>${F4_DAYS[r.dow]}</td>
          <td colspan="3">🔒 ${f4Esc(hname)}</td>
        </tr>`;
      }
      return `<tr data-day="${r.day}">
        <td>${r.day}</td>
        <td>${dateLbl}</td>
        <td>${F4_DAYS[r.dow]}</td>
        <td><input type="number" min="0" class="f4-b" data-day="${r.day}" value="${f4Esc(r.boys)}"></td>
        <td><input type="number" min="0" class="f4-g" data-day="${r.day}" value="${f4Esc(r.girls)}"></td>
        <td><input type="number" disabled class="f4-t" data-day="${r.day}" value="${f4Esc(r.total)}"></td>
      </tr>`;
    }).join('');

    return `<div class="form-landing-card">
      <h3>2. B / G / T दैनिक प्रविष्टि</h3>
      <p style="color:#666;margin-bottom:10px;">हर कार्य दिवस के लिए लड़के (B), लड़कियाँ (G) भरें — T अपने आप जुड़ जाएगा।</p>
      <div class="f4-bgt-wrap">
        <table class="f4-bgt-table">
          <thead><tr><th>क्र.</th><th>दिनांक</th><th>वार</th><th>B</th><th>G</th><th>T</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div class="f4-lock-note">🔒 रविवार और घोषित Holiday में entry स्वतः बंद रहती है (Holiday menu से auto sync होती है)।</div>
    </div>`;
  }
  function f4Step3Html(p){
    if(!p.recipe_data) p.recipe_data = F4_RECIPES.reduce((a, r) => { a[r.code] = {opening: 0, receipts: []}; return a; }, {});
    const monthName = F4_MONTHS[(p.month||1)-1];
    const cards = F4_RECIPES.map(rec => {
      const data = p.recipe_data[rec.code] || {opening: 0, receipts: []};
      const isOpen = ReportsMenu.f4OpenRecipe === rec.code;
      const summary = f4CalcRecipeSummary(rec, data, p);
      return `
        <div class="f4-recipe-acc ${isOpen?'open':''}" data-rec="${rec.code}">
          <button class="f4-recipe-header" data-f4acc="${rec.code}">
            <span>${rec.name} <small style="color:#718298;font-weight:500;">(${rec.weight} × 60g rule)</small></span>
            <span class="f4-arrow">▾</span>
          </button>
          <div class="f4-recipe-body">
            <div class="f4-open-row">
              <div>
                <label>प्रा. शेष (1 ${monthName}) — किलो</label>
                <input type="number" step="0.001" class="f4-rec-opening" data-rec="${rec.code}" value="${data.opening || ''}" placeholder="0.000">
              </div>
              <div>
                <label>इकाई</label>
                <input type="text" value="किलो (kg)" disabled>
              </div>
            </div>
            <div class="f4-receipt-add">
              <div>
                <label>प्राप्ति दिनांक</label>
                <input type="date" class="f4-rec-rdate" data-rec="${rec.code}">
              </div>
              <div>
                <label>मात्रा (किलो)</label>
                <input type="number" step="0.001" class="f4-rec-rqty" data-rec="${rec.code}" placeholder="0.000">
              </div>
              <button type="button" data-f4add-rec="${rec.code}">➕ जोड़ें</button>
            </div>
            <div class="f4-receipt-list" data-reclist="${rec.code}">
              ${(data.receipts || []).length ? (data.receipts || []).map((r, i) => `
                <div class="f4-receipt-item">
                  <span>📦 ${f4FormatDate(r.date)} — ${f4Num(r.qty).toFixed(3)} किलो</span>
                  <button type="button" data-f4del-rec="${rec.code}" data-idx="${i}">🗑 हटाएँ</button>
                </div>
              `).join('') : '<div style="color:#8a8e97;font-size:12px;padding:6px 0;">कोई प्राप्ति नहीं जोड़ी गई।</div>'}
            </div>
            <div class="f4-mini-wrap">
              <table class="f4-mini-table">
                <thead><tr><th>दिनांक</th><th>प्रा.शेष</th><th>प्राप्ति</th><th>योग</th><th>वितरण</th><th>अ.शेष</th></tr></thead>
                <tbody>${summary.rows}</tbody>
              </table>
            </div>
            <div class="f4-rec-summary">${summary.text}</div>
          </div>
        </div>
      `;
    }).join('');
    return `<div class="form-landing-card">
      <h3>3. Recipe विवरण</h3>
      <p style="color:#666;margin-bottom:10px;">हर recipe के लिए opening और receipts भरें — वितरण और अ.शेष auto गिना जाएगा (60g × T rule)। एक बार में एक recipe खुलती है।</p>
      ${cards}
    </div>`;
  }
  function f4Step4Html(p){
    const preview = f4SheetHtml(p, false);
    const status = ReportsMenu.f4Message || '';
    return `<div class="form-landing-card">
      <h3>4. जाँचें और Save करें</h3>
      <p style="color:#666;margin-bottom:10px;">नीचे live preview देखें — इसके बाद Save / Send / Print करें।</p>
      <div class="stock-btn-row" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
        <button class="stock-btn stock-btn-secondary" id="f4SaveDraft">💾 Save Draft</button>
        <button class="stock-btn stock-btn-primary" id="f4SendRegister">📤 Save & Send to Monthly Register</button>
        <button class="stock-btn stock-btn-secondary" id="f4PrintBtn">🖨️ Print / Save as PDF</button>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px;font-weight:700;color:#52635d;display:block;margin-bottom:4px;">विशेष विवरण (Summary के दाएँ column में दिखेगा)</label>
        <input type="text" id="f4SpecialDetails" value="${f4Esc(p.special_details || '')}" placeholder="जैसे: मंगल पहाड़ TMB के साथ मदद मिला" style="width:100%;padding:8px 10px;border:1px solid #cfdcd7;border-radius:8px;font-size:13px;box-sizing:border-box;">
      </div>
      <div class="f4-status" style="padding:8px 10px;border-radius:8px;font-size:12px;min-height:20px;${status ? 'background:#edf9f0;border:1px solid #b8dfc2;color:#16723a;' : 'display:none;'}">${f4Esc(status)}</div>
      <div class="f4-preview-box" style="margin-top:12px;background:#e4e8e4;border-radius:12px;padding:10px;overflow:auto;">
        ${preview}
      </div>
    </div>`;
  }

  // ===== Recipe daily compute =====
  function f4ComputeAllRecipes(p){
    const result = {};
    const monthStart = p.year + '-' + String(p.month).padStart(2,'0') + '-01';
    const days = f4DaysIn(p.year, p.month);
    F4_RECIPES.forEach(rec => {
      const data = (p.recipe_data && p.recipe_data[rec.code]) || {opening:0, receipts:[]};
      const recByDate = {};
      let prevMonthRecv = 0;
      (data.receipts || []).forEach(r => {
        if(!r.date) return;
        const ds = String(r.date).slice(0,10);
        const q = f4Num(r.qty);
        if(ds < monthStart) prevMonthRecv += q;
        else recByDate[ds] = (recByDate[ds] || 0) + q;
      });
      // महीने का पहला working day ढूँढो (Sunday/Holiday छोड़कर)
      let firstWorkingDate = null;
      for(let d=1; d<=days; d++){
        const row = p.daily[d-1];
        if(!row) continue;
        const isLocked = row.dow === 0 || !!row.holiday;
        if(!isLocked){ firstWorkingDate = row.date; break; }
      }
      
      let balance = f4Num(data.opening);
      const daily = {};
      let tRecv = 0, tDist = 0;
      for(let d=1; d<=days; d++){
        const row = p.daily[d-1];
        if(!row) continue;
        const isLocked = row.dow === 0 || !!row.holiday;
        const applicable = !isLocked && rec.days.indexOf(row.dow) !== -1;
        let todayRecv = recByDate[row.date] || 0;
        if(d === 1 && prevMonthRecv > 0) todayRecv += prevMonthRecv;
        
        const isFirstWorkingDay = (row.date === firstWorkingDate);
        
        // Non-applicable AND not first working day → सब dashes, balance track
        if(!applicable && !isFirstWorkingDay){
          balance = balance + todayRecv;
          tRecv += todayRecv;
          daily[row.date] = {opening: null, received: null, total: null, distribution: null, closing: null};
          continue;
        }
        
        // Applicable OR पहला working day → सारे numbers, distribution असली
        const totalStock = balance + todayRecv;
        let dist = 0;
        if(applicable && f4Num(row.total) > 0){
          dist = Math.min(f4Num(row.total) * 0.060, totalStock);
        }
        const closing = Math.max(0, totalStock - dist);
        tRecv += todayRecv; tDist += dist;
        daily[row.date] = {
          opening: balance, received: todayRecv, total: totalStock,
          distribution: applicable ? dist : null,
          closing
        };
        balance = closing;
      }
      result[rec.code] = {
        daily,
        totals: {opening: f4Num(data.opening), received: tRecv, distribution: tDist, closing: balance}
      };
    });
    return result;
  }

  // ===== Sheet HTML (Preview + Print) =====
  function f4SheetHtml(p, blankMode){
    const c = p.centre || {};
    const m = p.month, y = p.year;
    const days = f4DaysIn(y, m);
    const monthName = F4_MONTHS[m-1];
    const allCodes = ['SWEET_MURMURA','SALTY_MURMURA','KHICHDI','SWEET_DALIA','UPMA'];
    const breakfastCodes = ['SWEET_MURMURA','SALTY_MURMURA'];
    const hotCodes = ['KHICHDI','SWEET_DALIA','UPMA'];
    const comp = blankMode ? {} : f4ComputeAllRecipes(p);

    const fmtKg = (v) => v == null || v === 0 ? '—' : f4Num(v).toFixed(3);

    let html = '<div class="f4-sheet">';
    html += '<div class="f4-sheet-header"><h1>कार्यालय बाल विकास परियोजना अधिकारी, गुडामालानी</h1><h2>प्रपत्र - 4</h2><div class="f4-sheet-sub">पूरक पोषण वितरण (दैनिक) मासिक प्रगति रिपोर्ट</div></div>';

    html += '<div class="f4-sheet-meta">' +
      '<span>आंगनवाड़ी केन्द्र का नाम - <u>' + f4Esc(blankMode?'':c.name||'') + '</u></span>' +
      '<span>परियोजना - <u>' + f4Esc(blankMode?'':c.project_name||'') + '</u></span>' +
      '<span>सेक्टर - <u>' + f4Esc(blankMode?'':c.sector_name||'') + '</u></span>' +
      '<span>कोड - <u>' + f4Esc(blankMode?'':c.code||'') + '</u></span>' +
      '<span>माह - <u>' + f4Esc(blankMode?'':monthName) + '</u></span>' +
      '<span>वर्ष - <u>' + f4Esc(blankMode?'':y) + '</u></span>' +
      '</div>';

    // Table head
    html += '<table class="f4-sheet-table"><colgroup>';
    html += '<col style="width:2.8%"><col style="width:4.5%"><col style="width:5%">';
    html += '<col style="width:2%"><col style="width:2%"><col style="width:2%">';
    for(let i=0; i<5; i++){ for(let j=0;j<5;j++){ html += '<col style="width:3.06%">'; } }
    html += '</colgroup>';
    html += '<thead>';
    html += '<tr>';
    html += '<th rowspan="3">क्र.सं.</th>';
    html += '<th rowspan="3">दिनांक</th>';
    html += '<th rowspan="3">वार</th>';
    html += '<th colspan="3" class="f4-bgt-top">लाभान्वित बच्चों की संख्या</th>';
    html += '<th colspan="10">नाश्ता (प्रति बच्चा 60 ग्राम) (किलो ग्राम में)</th>';
    html += '<th colspan="15">गरम खाना (प्रति बच्चा 60 ग्राम) (किलो ग्राम में)</th>';
    html += '</tr>';
    html += '<tr>';
    html += '<th colspan="3" class="f4-bgt-bottom">3 से 6 वर्ष के बच्चे</th>';
    const dayNamesHi = ['रवि','सोम','मंगल','बुध','गुरु','शुक्र','शनि'];
    function recNameWithDays(rec){
      const days = rec.days.map(d => dayNamesHi[d]).join(', ');
      return f4Esc(rec.name) + ' (' + days + ')';
    }
    breakfastCodes.forEach(code => { const r = F4_RECIPES.find(x => x.code === code); html += '<th colspan="5">' + recNameWithDays(r) + '</th>'; });
    hotCodes.forEach(code => { const r = F4_RECIPES.find(x => x.code === code); html += '<th colspan="5">' + recNameWithDays(r) + '</th>'; });
    html += '</tr>';
    html += '<tr>';
    html += '<th>B</th><th>G</th><th>T</th>';
    for(let i=0; i<5; i++){ html += '<th>प्रा.शेष</th><th>प्राप्ति</th><th>योग</th><th>वितरण</th><th>अ.शेष</th>'; }
    html += '</tr></thead><tbody>';

    // Totals — Summary correct values (comp से सीधे, last-day overwrite नहीं)
    const tot = {b:0,g:0,t:0};
    const recTotals = {};
    allCodes.forEach(code => {
      const cdata = comp[code] || {};
      const dailyMap = cdata.daily || {};
      const keys = Object.keys(dailyMap).sort();
      const firstDay = keys.length ? dailyMap[keys[0]] : {};
      const lastDay = keys.length ? dailyMap[keys[keys.length - 1]] : {};
      const t = cdata.totals || {};
      const firstOpening = firstDay.opening != null ? firstDay.opening : (t.opening || 0);
      const lastClosing = lastDay.closing != null ? lastDay.closing : (t.closing || 0);
      recTotals[code] = {
        opening: firstOpening,
        received: t.received || 0,
        total: firstOpening + (t.received || 0),
        distribution: t.distribution || 0,
        closing: lastClosing
      };
    });

    // Rows
    for(let d=1; d<=days; d++){
      const row = p.daily[d-1]; if(!row) continue;
      const isLocked = row.dow === 0 || !!row.holiday;
      const dstr = String(d).padStart(2,'0') + '/' + String(m).padStart(2,'0') + '/' + String(y).slice(-2);
      if(isLocked){
        const hname = row.holiday ? row.holiday.name : 'रविवार';
        const strip = '<div class="f4-holiday-strip">' +
          '<i></i><b>' + f4Esc(hname) + '</b>' +
          '<i></i><b>' + f4Esc(hname) + '</b>' +
          '<i></i><b>' + f4Esc(hname) + '</b>' +
          '<i></i></div>';
        html += '<tr class="f4-sheet-holiday"><td>' + d + '</td><td>' + dstr + '</td><td>' + F4_DAYS[row.dow] + '</td><td colspan="28" class="f4-sheet-holiday-bar">' + strip + '</td></tr>';
        continue;
      }
      tot.b += f4Num(row.boys); tot.g += f4Num(row.girls); tot.t += f4Num(row.total);
      html += '<tr><td>' + d + '</td><td>' + dstr + '</td><td>' + F4_DAYS[row.dow] + '</td>';
      html += '<td>' + (blankMode?'':f4Esc(row.boys||'—')) + '</td>';
      html += '<td>' + (blankMode?'':f4Esc(row.girls||'—')) + '</td>';
      html += '<td><b>' + (blankMode?'':f4Esc(row.total||'—')) + '</b></td>';
      allCodes.forEach(code => {
        const dv = (comp[code] && comp[code].daily[row.date]) || {};
        // सिर्फ display — recTotals अब अलग calculate होता है
        html += '<td>' + (blankMode?'':(dv.opening != null ? fmtKg(dv.opening) : '—')) + '</td>';
        html += '<td>' + (blankMode?'':(dv.received != null && dv.received > 0 ? fmtKg(dv.received) : '—')) + '</td>';
        html += '<td>' + (blankMode?'':(dv.total != null ? fmtKg(dv.total) : '—')) + '</td>';
        html += '<td>' + (blankMode?'':(dv.distribution != null && dv.distribution > 0 ? fmtKg(dv.distribution) : '—')) + '</td>';
        html += '<td>' + (blankMode?'':(dv.closing != null ? fmtKg(dv.closing) : '—')) + '</td>';
      });
      html += '</tr>';
    }

    // Total row
    html += '<tr class="f4-sheet-total"><td colspan="3">योग</td>';
    html += '<td>' + (blankMode?'':tot.b) + '</td><td>' + (blankMode?'':tot.g) + '</td><td>' + (blankMode?'':tot.t) + '</td>';
    allCodes.forEach(code => {
      const r = recTotals[code];
      html += '<td>' + (blankMode?'':fmtKg(r.opening)) + '</td>';
      html += '<td>' + (blankMode?'':fmtKg(r.received)) + '</td>';
      html += '<td>' + (blankMode?'':fmtKg(r.total)) + '</td>';
      html += '<td>' + (blankMode?'':fmtKg(r.distribution)) + '</td>';
      html += '<td>' + (blankMode?'':(r.closing > 0 ? fmtKg(r.closing) : 'NIL')) + '</td>';
    });
    html += '</tr></tbody></table>';

    // ===== MONTHLY SUMMARY — COLUMN-WISE (5 recipes as columns) =====
    const summaryRecipes = ['SWEET_MURMURA','SALTY_MURMURA','KHICHDI','SWEET_DALIA','UPMA'];
    const recipeNames = {
      'SWEET_MURMURA':'मीठा मुरमुरा',
      'SALTY_MURMURA':'नमकीन मुरमुरा',
      'KHICHDI':'खिचड़ी',
      'SWEET_DALIA':'मीठा दलिया',
      'UPMA':'उपमा'
    };

    const vOpen = [], vRecv = [], vTotal = [], vDist = [], vClose = [], vDate = [];
    summaryRecipes.forEach(code => {
      const t = recTotals[code];
      const lastRec = (p.recipe_data && p.recipe_data[code] && p.recipe_data[code].receipts || []).slice(-1)[0];
      vOpen.push(t.opening.toFixed(3));
      vRecv.push(t.received.toFixed(3));
      vTotal.push(t.total.toFixed(3));
      vDist.push(t.distribution.toFixed(3));
      vClose.push(t.closing.toFixed(3));
      vDate.push(lastRec ? f4FormatDate(lastRec.date) : '—');
    });

    const summaryRows = [
      ['प्रा.शेष', vOpen],
      ['प्राप्ति', vRecv],
      ['कुल', vTotal],
      ['वितरण', vDist],
      ['अ.शेष', vClose],
      ['प्राप्ति दिनांक', vDate]
    ];

    let sumHtml = '<table class="f4-summary-table"><colgroup>';
    sumHtml += '<col style="width:15%">';
    for(let i=0;i<5;i++) sumHtml += '<col style="width:14.6%">';
    sumHtml += '<col style="width:12%">';
    sumHtml += '</colgroup>';
    sumHtml += '<thead><tr><th>मासिक सारांश</th>';
    summaryRecipes.forEach(code => { sumHtml += '<th>' + f4Esc(recipeNames[code]) + '</th>'; });
    sumHtml += '<th>विशेष विवरण</th></tr></thead><tbody>';
    summaryRows.forEach((r, ri) => {
      sumHtml += '<tr><td>' + r[0] + '</td>';
      r[1].forEach(v => { sumHtml += '<td>' + (blankMode?'':v) + '</td>'; });
      if(ri === 0){
        sumHtml += '<td class="f4-special-cell" rowspan="6">' + (blankMode?'':f4Esc(p.special_details || 'मंगल पहाड़ TMB के साथ मदद मिला')) + '</td>';
      }
      sumHtml += '</tr>';
    });
    sumHtml += '</tbody></table>';

    html += '<div class="f4-sheet-summary"><div>' + sumHtml + '</div>' +
      '<div class="f4-sheet-sign"><div class="f4-sig-line"></div><div class="f4-sig-lbl">हस्ताक्षर आंगनवाड़ी कार्यकर्ता</div></div>' +
      '</div>';

    html += '</div>';
    return html;
  }

  // ===== Print =====
  function f4Print(){
    const sheet = document.querySelector('.f4-preview-box .f4-sheet');
    if(!sheet){ alert('Preview उपलब्ध नहीं है।'); return; }
    const html = sheet.outerHTML;
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8">' +
      '<style>@page{size:A4 landscape;margin:4mm;}' +
      'html,body{margin:0;padding:0;background:#fff;}' +
      'body *{visibility:hidden!important;}' +
      '.f4-sheet,.f4-sheet *{visibility:visible!important;}' +
      '.f4-sheet{position:absolute!important;left:0!important;top:0!important;width:289mm!important;padding:3mm 4mm!important;box-sizing:border-box!important;}' +
      '</style>' +
      '<link rel="stylesheet" href="/form4-print.css">' +
      '</head><body>' + html + '</body></html>');
    doc.close();
    const cleanup = () => { if(iframe.parentNode) iframe.parentNode.removeChild(iframe); };
    try { iframe.contentWindow.addEventListener('afterprint', cleanup, {once:true}); } catch(e){}
    setTimeout(() => { try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch(e){} }, 500);
    setTimeout(cleanup, 60000);
  }

  // ===== Save Draft (local) =====
  function f4SaveDraft(){
    const p = ReportsMenu.f4Payload;
    try {
      const key = 'f4_draft_' + p.year + '_' + p.month;
      localStorage.setItem(key, JSON.stringify(p));
      ReportsMenu.f4Message = '✓ Draft saved locally (' + new Date().toLocaleTimeString('en-IN') + ')';
      renderF4Wizard();
    } catch(e){ alert('Draft save fail: ' + e.message); }
  }

  // ===== Save & Send to Monthly Register =====
  async function f4SendRegister(){
    const p = ReportsMenu.f4Payload;
    try {
      const payload = {
        year: p.year, month: p.month, mode: 'MANUAL',
        payload: p, centre_id: (ReportsMenu.centreId || null)
      };
      const r = await api('/api/reports/FORM4/send-to-register', {method:'POST', body: JSON.stringify(payload)});
      ReportsMenu.f4Message = r.createdVersion
        ? '✓ Saved & Sent — Version created'
        : '✓ Already up to date — same version exists';
      renderF4Wizard();
    } catch(e){
      alert('Send fail: ' + (e.message || 'Unknown'));
    }
  }

  function f4CaptureInputs(){
    const p = ReportsMenu.f4Payload;
    const step = ReportsMenu.f4Step;
    if(step === 1){
      const el = id => document.getElementById(id);
      p.centre.name = el('f4Name')?.value || '';
      p.centre.code = el('f4Code')?.value || '';
      p.centre.project_name = el('f4Project')?.value || '';
      p.centre.sector_name = el('f4Sector')?.value || '';
      p.centre.district = el('f4District')?.value || '';
      p.month = parseInt(el('f4Month')?.value, 10) || p.month;
      p.year = parseInt(el('f4Year')?.value, 10) || p.year;
    }
    // Auto-save draft
    try {
      const key = 'f4_draft_' + p.year + '_' + p.month;
      localStorage.setItem(key, JSON.stringify(p));
    } catch(e){}
  }

  function f4BindStepHandlers(){
    const step = ReportsMenu.f4Step;
    if(step === 2){
      document.querySelectorAll('.f4-b, .f4-g').forEach(inp => {
        inp.addEventListener('input', () => {
          const day = parseInt(inp.dataset.day, 10);
          const p = ReportsMenu.f4Payload;
          const row = p.daily[day-1];
          if(!row) return;
          const bEl = document.querySelector('.f4-b[data-day="'+day+'"]');
          const gEl = document.querySelector('.f4-g[data-day="'+day+'"]');
          const tEl = document.querySelector('.f4-t[data-day="'+day+'"]');
          row.boys = bEl ? bEl.value : '';
          row.girls = gEl ? gEl.value : '';
          row.total = (f4Num(row.boys) + f4Num(row.girls)) || '';
          if(tEl) tEl.value = row.total;
          try { localStorage.setItem('f4_draft_' + p.year + '_' + p.month, JSON.stringify(p)); } catch(e){}
        });
      });
    }
    if(step === 3){
      const p = ReportsMenu.f4Payload;
      if(!p.recipe_data) p.recipe_data = F4_RECIPES.reduce((a, r) => { a[r.code] = {opening: 0, receipts: []}; return a; }, {});
      
      document.querySelectorAll('[data-f4acc]').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.dataset.f4acc;
          ReportsMenu.f4OpenRecipe = ReportsMenu.f4OpenRecipe === code ? null : code;
          document.querySelectorAll('.f4-recipe-acc').forEach(a => {
            a.classList.toggle('open', a.dataset.rec === ReportsMenu.f4OpenRecipe);
          });
        });
      });
      
      document.querySelectorAll('.f4-rec-opening').forEach(inp => {
        inp.addEventListener('input', () => {
          const code = inp.dataset.rec;
          p.recipe_data[code] = p.recipe_data[code] || {opening: 0, receipts: []};
          p.recipe_data[code].opening = f4Num(inp.value);
          f4RefreshRecipePreview(code);
          try { localStorage.setItem('f4_draft_' + p.year + '_' + p.month, JSON.stringify(p)); } catch(e){}
        });
      });
      
      document.querySelectorAll('[data-f4add-rec]').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.dataset.f4addRec;
          const dateEl = document.querySelector('.f4-rec-rdate[data-rec="' + code + '"]');
          const qtyEl = document.querySelector('.f4-rec-rqty[data-rec="' + code + '"]');
          const date = dateEl ? dateEl.value : '';
          const qty = f4Num(qtyEl ? qtyEl.value : 0);
          if(!date || qty <= 0){ alert('दिनांक और मात्रा भरें (0 से बड़ी)'); return; }
          p.recipe_data[code] = p.recipe_data[code] || {opening: 0, receipts: []};
          p.recipe_data[code].receipts.push({date, qty});
          p.recipe_data[code].receipts.sort((a,b) => String(a.date).localeCompare(String(b.date)));
          f4RefreshRecipePreview(code);
          try { localStorage.setItem('f4_draft_' + p.year + '_' + p.month, JSON.stringify(p)); } catch(e){}
        });
      });
      
      document.querySelectorAll('[data-f4del-rec]').forEach(btn => {
        btn.addEventListener('click', () => {
          const code = btn.dataset.f4delRec;
          const idx = parseInt(btn.dataset.idx, 10);
          if(p.recipe_data[code] && p.recipe_data[code].receipts){
            p.recipe_data[code].receipts.splice(idx, 1);
            f4RefreshRecipePreview(code);
          }
        });
      });
    }
    if(step === 4){
      const sBtn = document.getElementById('f4SaveDraft');
      const sendBtn = document.getElementById('f4SendRegister');
      const printBtn = document.getElementById('f4PrintBtn');
      if(sBtn) sBtn.addEventListener('click', f4SaveDraft);
      if(sendBtn) sendBtn.addEventListener('click', f4SendRegister);
      if(printBtn) printBtn.addEventListener('click', f4Print);
      const spEl = document.getElementById('f4SpecialDetails');
      if(spEl){
        spEl.addEventListener('input', () => {
          ReportsMenu.f4Payload.special_details = spEl.value;
          try { localStorage.setItem('f4_draft_' + p.year + '_' + p.month, JSON.stringify(p)); } catch(e){}
          const box = document.querySelector('.f4-preview-box');
          if(box) box.innerHTML = f4SheetHtml(p, false);
        });
      }
    }
  }

  async function f4LoadHolidays(force){
    const p = ReportsMenu.f4Payload;
    if(!ReportsMenu.f4HolidayCache) ReportsMenu.f4HolidayCache = {};
    const key = p.year + '-' + p.month;
    
    if(!force && ReportsMenu.f4HolidayCache[key]){
      const map = ReportsMenu.f4HolidayCache[key];
      p.daily.forEach(r => { r.holiday = map[r.date] || null; });
      return;
    }
    
    try {
      const d = await api('/api/admin/holidays?year='+p.year+'&month='+p.month);
      const list = Array.isArray(d.holidays) ? d.holidays : [];
      const map = {};
      list.forEach(h => {
        const dt = String(h.holiday_date || h.date || '').slice(0,10);
        if(dt) map[dt] = {name: String(h.holiday_name || h.name || 'Holiday')};
      });
      ReportsMenu.f4HolidayCache[key] = map;
      p.daily.forEach(r => { r.holiday = map[r.date] || null; });
    } catch(e) {
      console.warn('Holiday fetch fail:', e);
      p.daily.forEach(r => { r.holiday = null; });
    }
  }


})();
