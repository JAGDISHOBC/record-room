/* ==================== THR DISTRIBUTION MODULE ==================== */

const THRMenu = {
  view: 'list',       // list | detail | edit | logs
  year: 0,
  month: 0,
  category: '',       // '' = all | PREGNANT | LACTATING | CHILD_6_36 | CHILD_36_72
  filter: 'ALL',      // ALL | PENDING | GIVEN | BILLING
  search: '',
  beneficiaries: [],
  summary: {},
  categoryLabels: {},
  defaultPackets: {},
  stockReference: null,
  stockAvailable: true,
  selected: null,
  selectedBene: null,
  selectedLogs: [],
  currentDistribution: null  // for entry modal
};

const THR_CATS = [
  { code: 'PREGNANT',    label: 'Pregnant Women',            icon: '🤰', default: 3 },
  { code: 'LACTATING',   label: 'Lactating Mothers',         icon: '🤱', default: 3 },
  { code: 'CHILD_6_36',  label: 'Children 6M-3Y',            icon: '🧒', default: 4 },
  { code: 'CHILD_36_72', label: 'Children 3-6Y',             icon: '🧑', default: 4 }
];

const MONTH_NAMES_THR = ['', 'January','February','March','April','May','June','July','August','September','October','November','December'];

function thrCatLabel(code){
  const c = THR_CATS.find(x => x.code === code);
  return c ? c.label : code;
}
function thrCatIcon(code){
  const c = THR_CATS.find(x => x.code === code);
  return c ? c.icon : '👤';
}

/* ==================== API ==================== */
async function thrLoadBeneficiaries(){
  const params = new URLSearchParams();
  params.set('year', THRMenu.year);
  params.set('month', THRMenu.month);
  const data = await api('/api/admin/thr/beneficiaries?' + params.toString());
  THRMenu.beneficiaries = data.beneficiaries || [];
  THRMenu.summary = data.summary || {};
  THRMenu.categoryLabels = data.category_labels || {};
  THRMenu.defaultPackets = data.default_packets || {};
}

async function thrLoadStock(){
  try {
    const params = new URLSearchParams();
    params.set('year', THRMenu.year);
    params.set('month', THRMenu.month);
    const data = await api('/api/admin/thr/stock?' + params.toString());
    THRMenu.stockReference = data.stock_reference || null;
    THRMenu.stockAvailable = data.stock_available !== false;
  } catch (e) {
    THRMenu.stockReference = null;
    THRMenu.stockAvailable = false;
  }
}

async function thrLoadDetail(tid){
  const data = await api('/api/admin/thr/' + tid);
  THRMenu.selected = data.distribution;
  THRMenu.selectedBene = data.beneficiary;
  const ldata = await api('/api/admin/thr/' + tid + '/logs');
  THRMenu.selectedLogs = ldata.logs || [];
}

/* ==================== ENTRY ==================== */
THRMenu.open = function(){
  THRMenu.view = 'list';
  const now = new Date();
  THRMenu.year = now.getFullYear();
  THRMenu.month = now.getMonth() + 1;
  THRMenu.category = '';
  THRMenu.filter = 'ALL';
  THRMenu.search = '';
  THRMenu.selected = null;
  Promise.all([thrLoadBeneficiaries(), thrLoadStock()])
    .then(renderTHRList)
    .catch(e => showToast(e.message, 'error'));
};


/* ==================== RENDER: THR LIST PAGE ==================== */
function renderTHRList(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const year = THRMenu.year;
  const month = THRMenu.month;
  const currentYear = new Date().getFullYear();
  const years = [currentYear-1, currentYear, currentYear+1];
  const summary = THRMenu.summary;

  // Filter counts
  let pendingCount = 0, givenCount = 0;
  THRMenu.beneficiaries.forEach(b => {
    if (b.given) givenCount++;
    else pendingCount++;
  });

  root.innerHTML = `
    <div class="thr-header">
      <div>
        <h2>THR</h2>
        <div class="sub">Take Home Ration · ${MONTH_NAMES_THR[month]} ${year}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="thrLogsBtn">📜 Logs</button>
      </div>
    </div>

    <div class="thr-main">

      <div class="thr-month-controls">
        <div class="stock-field">
          <label>Ration Year</label>
          <select id="thrYearSel">
            ${years.map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
        </div>
        <div class="stock-field">
          <label>Ration Month</label>
          <select id="thrMonthSel">
            ${MONTH_NAMES_THR.slice(1).map((m, i) => `<option value="${i+1}" ${i+1 === month ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
        <div class="stock-field" style="flex:0 0 auto;">
          <label>&nbsp;</label>
          <button class="stock-btn stock-btn-secondary" id="thrRefreshBtn" style="min-height:46px;">↻ Refresh</button>
        </div>
      </div>

      ${!THRMenu.stockAvailable ? `
        <div class="thr-billing-banner" style="background:#fdeceb;border-color:#f5c8c5;color:#b0271f;">
          ⚠️ Stock information could not be loaded. THR entry remains available for eligible beneficiaries.
        </div>
      ` : ''}

      ${THRMenu.filter === 'BILLING' ? `
        <div class="thr-billing-banner">
          ℹ️ Billing Date eligibility is only a filter. It does not block THR entry. Eligible beneficiaries can still receive THR.
        </div>
      ` : ''}

      <div class="thr-cat-summary">
        ${THR_CATS.map(c => {
          const s = summary[c.code] || { eligible: 0, pending: 0, given: 0 };
          const isActive = THRMenu.category === c.code;
          return `
            <button class="thr-cat-card ${isActive ? 'active' : ''}" data-cat="${c.code}">
              <div class="cc-icon">${c.icon}</div>
              <div class="cc-label">${escHtml(c.label)}</div>
              <div class="cc-counts">
                <span class="total">Total: ${s.eligible}</span>
                <span class="pending">P: ${s.pending}</span>
                <span class="given">G: ${s.given}</span>
              </div>
            </button>
          `;
        }).join('')}
      </div>

      ${THRMenu.stockReference && THRMenu.stockAvailable ? (() => {
        const cat = THRMenu.category;
        let items = [];
        if (cat && THRMenu.stockReference[cat]) {
          const sr = THRMenu.stockReference[cat];
          if (sr.received_packets > 0) {
            items = sr.recipes.map(r => {
              return '<span class="stock-item">' + escHtml(r.name) + ' · ' + r.weight + 'g</span>';
            });
            return '<div class="thr-stock-strip"><b>📦 ' + escHtml(sr.label) + ' — Stock Reference:</b> ' + sr.received_packets + ' packets received this month<div class="stock-items">' + items.join('') + '</div></div>';
          }
        } else {
          // Show all categories with stock
          const cats = Object.keys(THRMenu.stockReference).filter(c => THRMenu.stockReference[c].received_packets > 0);
          if (cats.length) {
            return '<div class="thr-stock-strip"><b>📦 Stock Reference (this month):</b><div class="stock-items">' +
              cats.map(c => '<span class="stock-item">' + escHtml(THRMenu.stockReference[c].label) + ': ' + THRMenu.stockReference[c].received_packets + ' pkt</span>').join('') +
              '</div></div>';
          }
        }
        return '';
      })() : ''}

      <div class="thr-tabs">
        <button class="${THRMenu.filter === 'ALL' ? 'active' : ''}" data-filter="ALL">All (${THRMenu.beneficiaries.length})</button>
        <button class="${THRMenu.filter === 'PENDING' ? 'active' : ''}" data-filter="PENDING">Pending (${pendingCount})</button>
        <button class="${THRMenu.filter === 'GIVEN' ? 'active' : ''}" data-filter="GIVEN">Given (${givenCount})</button>
        <button class="${THRMenu.filter === 'BILLING' ? 'active' : ''}" data-filter="BILLING">Billing Eligible</button>
      </div>

      <div class="thr-search">
        <input id="thrSearchInput" type="search"
          placeholder="Search beneficiary name"
          autocomplete="off" value="${escHtml(THRMenu.search)}">
      </div>

      <div id="thrListContainer">
        ${renderTHRListRows()}
      </div>

    </div>
  `;

  // ==================== EVENTS ====================
  // Month/Year change
  document.getElementById('thrYearSel').addEventListener('change', (e) => {
    THRMenu.year = parseInt(e.target.value, 10);
    reloadTHRData();
  });
  document.getElementById('thrMonthSel').addEventListener('change', (e) => {
    THRMenu.month = parseInt(e.target.value, 10);
    reloadTHRData();
  });
  document.getElementById('thrRefreshBtn').addEventListener('click', () => reloadTHRData());

  // Category filter
  root.querySelectorAll('.thr-cat-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.cat;
      THRMenu.category = (THRMenu.category === cat) ? '' : cat;
      renderTHRList();
    });
  });

  // Tab filters
  root.querySelectorAll('.thr-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      THRMenu.filter = btn.dataset.filter;
      renderTHRList();
    });
  });

  // Search
  const searchInput = document.getElementById('thrSearchInput');
  let searchTimer = null;
  searchInput.addEventListener('input', (e) => {
    THRMenu.search = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const cont = document.getElementById('thrListContainer');
      if (cont) {
        cont.innerHTML = renderTHRListRows();
        bindTHRRows();
      }
    }, 250);
  });

  // Logs button
  document.getElementById('thrLogsBtn').addEventListener('click', () => {
    THRMenu.view = 'logs';
    renderTHRLogsAll();
  });

  bindTHRRows();
}


/* ==================== RENDER: LIST ROWS ==================== */
function renderTHRListRows(){
  let list = THRMenu.beneficiaries || [];

  // Apply category filter
  if (THRMenu.category) {
    list = list.filter(b => b.category === THRMenu.category);
  }

  // Apply tab filter
  if (THRMenu.filter === 'PENDING') {
    list = list.filter(b => !b.given);
  } else if (THRMenu.filter === 'GIVEN') {
    list = list.filter(b => b.given);
  } else if (THRMenu.filter === 'BILLING') {
    list = list.filter(b => b.billing_eligible);
  }

  // Apply search
  if (THRMenu.search) {
    const s = THRMenu.search.toLowerCase();
    list = list.filter(b => (b.name || '').toLowerCase().includes(s));
  }

  if (!list.length) {
    return `
      <div class="thr-empty">
        <div class="empty-icon">🍲</div>
        <div class="empty-title">कोई beneficiary नहीं मिला</div>
        <div class="empty-sub">इस month/filter में eligible beneficiaries नहीं हैं।</div>
      </div>
    `;
  }

  return '<div class="thr-list">' + list.map(b => renderTHRRow(b)).join('') + '</div>';
}


function renderTHRRow(b){
  const cat = b.category;
  const icon = thrCatIcon(cat);
  const avatar = b.profile_photo_data
    ? '<img src="' + b.profile_photo_data + '">'
    : icon;

  const metaParts = [];
  if (b.date_of_birth) metaParts.push(calcAge(b.date_of_birth));
  if (b.family_identification) metaParts.push('👨 ' + escHtml(b.family_identification));
  if (b.mobile_last4) metaParts.push('📱 ****' + escHtml(b.mobile_last4));
  metaParts.push('ID: #' + escHtml(b.unique_id));

  if (b.given && b.distribution) {
    const d = b.distribution;
    const givenMeta = [];
    givenMeta.push('📦 ' + d.packet_quantity + ' packets');
    if (d.given_date) givenMeta.push('📅 ' + fmtBeneDate(d.given_date));
    if (d.receiver_name) givenMeta.push('👤 ' + escHtml(d.receiver_name));

    return `
      <div class="thr-row given" data-id="${b.beneficiary_id}" data-dist-id="${d.id}">
        <div class="thr-avatar">${avatar}</div>
        <div style="min-width:0;">
          <div class="thr-name">${escHtml(b.name)}</div>
          <div class="thr-meta">${metaParts.join(' · ')}</div>
          <div class="thr-meta" style="margin-top:3px;color:var(--rr-green);font-weight:700;">
            ${givenMeta.join(' · ')}
          </div>
        </div>
        <div class="thr-status">
          <span class="thr-badge given">✓ Given</span>
          <button class="thr-give-btn view" data-action="view" data-dist-id="${d.id}">View</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="thr-row" data-id="${b.beneficiary_id}">
      <div class="thr-avatar">${avatar}</div>
      <div style="min-width:0;">
        <div class="thr-name">${escHtml(b.name)}</div>
        <div class="thr-meta">${metaParts.join(' · ')}</div>
      </div>
      <div class="thr-status">
        <span class="thr-badge">Pending</span>
        <button class="thr-give-btn" data-action="give" data-id="${b.beneficiary_id}">Give THR</button>
      </div>
    </div>
  `;
}


function bindTHRRows(){
  document.querySelectorAll('.thr-row').forEach(row => {
    // View button (given rows)
    const viewBtn = row.querySelector('[data-action="view"]');
    if (viewBtn) {
      viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = parseInt(viewBtn.dataset.distId, 10);
        THRMenu.view = 'detail';
        thrLoadDetail(tid).then(renderTHRDetail).catch(err => showToast(err.message, 'error'));
      });
    }
    // Give button
    const giveBtn = row.querySelector('[data-action="give"]');
    if (giveBtn) {
      giveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const bid = parseInt(giveBtn.dataset.id, 10);
        const bene = THRMenu.beneficiaries.find(x => x.beneficiary_id === bid);
        if (bene) showTHREntryModal(bene);
      });
    }
    // Row click → detail if given
    row.addEventListener('click', () => {
      if (row.classList.contains('given')) {
        const tid = parseInt(row.dataset.distId, 10);
        THRMenu.view = 'detail';
        thrLoadDetail(tid).then(renderTHRDetail).catch(err => showToast(err.message, 'error'));
      }
    });
  });
}


function reloadTHRData(){
  Promise.all([thrLoadBeneficiaries(), thrLoadStock()])
    .then(renderTHRList)
    .catch(e => showToast(e.message, 'error'));
}


/* ==================== ENTRY MODAL (Give THR) ==================== */
function showTHREntryModal(bene){
  // Remove existing
  const old = document.getElementById('thrEntryModal');
  if (old) old.remove();

  const defaultPk = bene.default_packets || 3;
  const cat = bene.category;
  const catLabel = thrCatLabel(cat);

  const backdrop = document.createElement('div');
  backdrop.id = 'thrEntryModal';
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal" style="max-width:520px;">
      <h3>🍲 Give THR</h3>
      <p style="font-size:13px;color:var(--rr-muted);margin:0 0 12px;">
        ${MONTH_NAMES_THR[THRMenu.month]} ${THRMenu.year}
      </p>

      <div style="background:#f8f9fc;border-radius:12px;padding:12px 14px;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:52px;height:52px;border-radius:50%;border:3px solid var(--rr-green);background:#fff;display:grid;place-items:center;font-size:24px;overflow:hidden;flex-shrink:0;">
            ${bene.profile_photo_data ? '<img src="' + bene.profile_photo_data + '" style="width:100%;height:100%;object-fit:cover;">' : thrCatIcon(cat)}
          </div>
          <div style="min-width:0;">
            <div style="font-size:15px;font-weight:800;color:var(--rr-ink);">${escHtml(bene.name)}</div>
            <div style="font-size:12px;color:var(--rr-muted);margin-top:2px;">
              ${escHtml(catLabel)} · #${escHtml(bene.unique_id)}
            </div>
          </div>
        </div>
      </div>

      <div class="family-field">
        <label for="thrPkQty">Packet Quantity <span class="req">*</span></label>
        <input type="number" id="thrPkQty" min="1" step="1" value="${defaultPk}" required>
        <div class="hint">Default: ${defaultPk} packets (बदल सकते हैं, min 1)</div>
      </div>

      <div class="family-field">
        <label for="thrReceiver">Receiver Name (optional)</label>
        <input type="text" id="thrReceiver" placeholder="जो लेने आया (खाली छोड़ सकते हैं)">
      </div>

      <div class="family-field">
        <label for="thrRelation">Relation (optional)</label>
        <input type="text" id="thrRelation" placeholder="जैसे: स्वयं, माता, पिता">
      </div>

      <div class="family-field">
        <label for="thrGivenDate">Given Date (optional)</label>
        <input type="date" id="thrGivenDate" value="${new Date().toISOString().slice(0,10)}">
      </div>

      <div class="family-field">
        <label for="thrNotes">Notes (optional)</label>
        <textarea id="thrNotes" rows="2" placeholder="अतिरिक्त जानकारी"></textarea>
      </div>

      <div class="family-field">
        <label>📷 THR Photo (optional)</label>
        <div class="thr-photo-row">
          <div class="thr-photo-preview" id="thrPhotoPreview">📷</div>
          <div class="thr-photo-actions">
            <input type="file" id="thrPhotoInput" accept="image/*">
            <button type="button" class="stock-btn stock-btn-secondary stock-btn-sm" id="thrPhotoClear" style="display:none;margin-top:6px;align-self:flex-start;">Remove Photo</button>
            <div class="hint" id="thrPhotoStatus"></div>
          </div>
        </div>
      </div>

      <div id="thrEntryError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="thrEntryCancel">Cancel</button>
        <button class="family-btn family-btn-primary" id="thrEntrySave">Save THR</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  let photoData = null;
  let saving = false;

  // Photo
  const photoInput = document.getElementById('thrPhotoInput');
  const photoPreview = document.getElementById('thrPhotoPreview');
  const photoClear = document.getElementById('thrPhotoClear');
  const photoStatus = document.getElementById('thrPhotoStatus');

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
      photoPreview.innerHTML = '<img src="' + photoData + '" alt="">';
      photoClear.style.display = 'inline-flex';
      photoStatus.textContent = '✓ Photo ready';
      photoStatus.style.color = 'var(--rr-green)';
    };
    reader.readAsDataURL(f);
  });

  photoClear.addEventListener('click', () => {
    photoData = null;
    photoInput.value = '';
    photoPreview.innerHTML = '📷';
    photoClear.style.display = 'none';
    photoStatus.textContent = '';
  });

  // Cancel
  function closeModal(){
    backdrop.remove();
  }
  document.getElementById('thrEntryCancel').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  // Save
  document.getElementById('thrEntrySave').addEventListener('click', async () => {
    if (saving) return;
    const errDiv = document.getElementById('thrEntryError');
    errDiv.style.display = 'none';

    const pk = parseInt(document.getElementById('thrPkQty').value, 10);
    if (!pk || pk < 1 || !Number.isInteger(pk)) {
      errDiv.textContent = 'Packet quantity must be at least 1 (whole number).';
      errDiv.style.display = 'block';
      return;
    }

    const givenDate = document.getElementById('thrGivenDate').value || null;
    if (givenDate) {
      const dt = new Date(givenDate);
      if (isNaN(dt.getTime())) {
        errDiv.textContent = 'Please enter a valid Given Date.';
        errDiv.style.display = 'block';
        return;
      }
    }

    const payload = {
      beneficiary_id: bene.beneficiary_id,
      ration_year: THRMenu.year,
      ration_month: THRMenu.month,
      packet_quantity: pk,
      receiver_name: document.getElementById('thrReceiver').value.trim() || null,
      receiver_relation: document.getElementById('thrRelation').value.trim() || null,
      given_date: givenDate,
      notes: document.getElementById('thrNotes').value.trim() || null,
      photo_data: photoData
    };

    saving = true;
    const saveBtn = document.getElementById('thrEntrySave');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const res = await api('/api/admin/thr', { method: 'POST', body: payload });
      showToast(res.message || 'THR saved successfully', 'success');
      closeModal();
      await reloadTHRData();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
      saving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save THR';
    }
  });
}


/* ==================== RENDER: DETAIL PAGE ==================== */
function renderTHRDetail(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const d = THRMenu.selected;
  const b = THRMenu.selectedBene;
  if (!d) { THRMenu.view = 'list'; renderTHRList(); return; }

  const isDeleted = d.status === 'DELETED';
  const catLabel = thrCatLabel(d.category_snapshot);
  const avatar = (b && b.profile_photo_data)
    ? '<img src="' + b.profile_photo_data + '">'
    : thrCatIcon(d.category_snapshot);

  root.innerHTML = `
    <div class="thr-header">
      <div>
        <h2>THR Detail</h2>
        <div class="sub">${MONTH_NAMES_THR[d.ration_month]} ${d.ration_year}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="thr-main">

      ${isDeleted ? `
        <div style="background:#fff4e5;border:1px solid #f5d8a8;border-radius:12px;padding:12px 14px;margin-bottom:14px;">
          <div style="font-size:13px;font-weight:800;color:#8a5a00;margin-bottom:4px;">⚠ Deleted THR Event</div>
          <div style="font-size:13px;color:#8a5a00;line-height:1.5;">
            <b>Reason:</b> ${escHtml(d.delete_reason || '—')}<br>
            <b>Deleted At:</b> ${fmtDateTime(d.deleted_at)}
          </div>
        </div>
      ` : ''}

      <div class="thr-detail-card">
        <div class="thr-profile-head">
          <div class="thr-profile-avatar">${avatar}</div>
          <div style="flex:1;min-width:0;">
            <h3 style="margin:0 0 4px;font-size:20px;">${escHtml(b ? b.full_name : '—')}</h3>
            <div style="font-size:13px;color:var(--rr-muted);font-weight:700;">
              ${escHtml(catLabel)} · #${escHtml(b ? b.beneficiary_unique_id : '')}
            </div>
            ${isDeleted ? '<div style="margin-top:6px;"><span class="thr-badge deleted">DELETED</span></div>' : '<div style="margin-top:6px;"><span class="thr-badge given">✓ Given</span></div>'}
          </div>
        </div>

        ${!isDeleted ? `
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="stock-btn stock-btn-primary" id="editBtn">✎ Edit</button>
            <button class="stock-btn stock-btn-danger" id="deleteBtn">🗑 Delete</button>
          </div>
        ` : ''}
      </div>

      <div class="thr-detail-card">
        <h3>Distribution Details</h3>
        <div class="thr-kv">
          ${thrKV('Beneficiary ID', b ? '#' + b.beneficiary_unique_id : '—')}
          ${thrKV('Category', catLabel)}
          ${thrKV('Packet Quantity', d.packet_quantity + ' packets')}
          ${thrKV('Age Snapshot', d.age_snapshot || '—')}
          ${thrKV('Given Date', d.given_date ? fmtBeneDate(d.given_date) : '—')}
          ${thrKV('Ration Month', MONTH_NAMES_THR[d.ration_month] + ' ' + d.ration_year)}
        </div>
      </div>

      <div class="thr-detail-card">
        <h3>Receiver Details</h3>
        <div class="thr-kv">
          ${thrKV('Receiver Name', d.receiver_name)}
          ${thrKV('Relation', d.receiver_relation)}
          ${d.notes ? `<div class="thr-kv-item full"><span class="kv-label">Notes</span><span class="kv-value">${escHtml(d.notes)}</span></div>` : ''}
        </div>
      </div>

      ${d.photo_data ? `
        <div class="thr-detail-card">
          <h3>THR Photo</h3>
          <div style="text-align:center;">
            <img src="${d.photo_data}" alt="THR Photo" style="max-width:100%;max-height:340px;border-radius:12px;border:1px solid #e6e6ec;box-shadow:0 4px 12px rgba(40,36,46,.08);cursor:pointer;" onclick="window.open(this.src,'_blank')">
            <div style="font-size:12px;color:var(--rr-muted);margin-top:8px;">Photo पर tap करके पूरी देखें</div>
          </div>
        </div>
      ` : ''}

      <div class="thr-detail-card">
        <h3>Audit</h3>
        <div class="thr-kv">
          ${thrKV('Created At', fmtDateTime(d.created_at))}
          ${thrKV('Updated At', fmtDateTime(d.updated_at))}
        </div>
      </div>

      <div class="thr-detail-card">
        <h3>Activity Logs</h3>
        <div>
          ${THRMenu.selectedLogs.length ? THRMenu.selectedLogs.map(l => renderTHRLog(l)).join('') : '<p style="color:var(--rr-muted);font-size:13px;">No logs yet.</p>'}
        </div>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    THRMenu.view = 'list';
    THRMenu.selected = null;
    renderTHRList();
  });

  const editBtn = document.getElementById('editBtn');
  if (editBtn) editBtn.addEventListener('click', () => {
    THRMenu.view = 'edit';
    showTHREditModal(d, b);
  });

  const delBtn = document.getElementById('deleteBtn');
  if (delBtn) delBtn.addEventListener('click', () => showTHRDeleteDialog(d, b));
}


function thrKV(label, value){
  const empty = (value === null || value === undefined || value === '');
  return `
    <div class="thr-kv-item">
      <span class="kv-label">${escHtml(label)}</span>
      <span class="kv-value">${escHtml(empty ? '—' : value)}</span>
    </div>
  `;
}


/* ==================== EDIT MODAL ==================== */
function showTHREditModal(d, b){
  const old = document.getElementById('thrEditModal');
  if (old) old.remove();

  const catLabel = thrCatLabel(d.category_snapshot);

  const backdrop = document.createElement('div');
  backdrop.id = 'thrEditModal';
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal" style="max-width:520px;">
      <h3>✎ Edit THR</h3>
      <p style="font-size:13px;color:var(--rr-muted);margin:0 0 12px;">
        ${MONTH_NAMES_THR[d.ration_month]} ${d.ration_year}
      </p>

      <div style="background:#f8f9fc;border-radius:12px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:15px;font-weight:800;color:var(--rr-ink);">${escHtml(b ? b.full_name : '')}</div>
        <div style="font-size:12px;color:var(--rr-muted);margin-top:2px;">
          ${escHtml(catLabel)} · #${escHtml(b ? b.beneficiary_unique_id : '')}
        </div>
      </div>

      <div class="family-field">
        <label for="editPkQty">Packet Quantity <span class="req">*</span></label>
        <input type="number" id="editPkQty" min="1" step="1" value="${d.packet_quantity}" required>
      </div>

      <div class="family-field">
        <label for="editReceiver">Receiver Name</label>
        <input type="text" id="editReceiver" value="${escHtml(d.receiver_name || '')}">
      </div>

      <div class="family-field">
        <label for="editRelation">Relation</label>
        <input type="text" id="editRelation" value="${escHtml(d.receiver_relation || '')}">
      </div>

      <div class="family-field">
        <label for="editGivenDate">Given Date</label>
        <input type="date" id="editGivenDate" value="${escHtml(d.given_date || '')}">
      </div>

      <div class="family-field">
        <label for="editNotes">Notes</label>
        <textarea id="editNotes" rows="2">${escHtml(d.notes || '')}</textarea>
      </div>

      <div class="family-field">
        <label>📷 THR Photo</label>
        <div class="thr-photo-row">
          <div class="thr-photo-preview" id="editPhotoPreview">${d.photo_data ? '<img src="' + d.photo_data + '">' : '📷'}</div>
          <div class="thr-photo-actions">
            <input type="file" id="editPhotoInput" accept="image/*">
            <button type="button" class="stock-btn stock-btn-secondary stock-btn-sm" id="editPhotoClear" style="display:${d.photo_data ? 'inline-flex' : 'none'};margin-top:6px;align-self:flex-start;">Remove Photo</button>
            <div class="hint" id="editPhotoStatus"></div>
          </div>
        </div>
      </div>

      <div id="thrEditError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="thrEditCancel">Cancel</button>
        <button class="family-btn family-btn-primary" id="thrEditSave">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  let photoData = d.photo_data || null;
  let saving = false;

  const photoInput = document.getElementById('editPhotoInput');
  const photoPreview = document.getElementById('editPhotoPreview');
  const photoClear = document.getElementById('editPhotoClear');
  const photoStatus = document.getElementById('editPhotoStatus');

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
      photoPreview.innerHTML = '<img src="' + photoData + '">';
      photoClear.style.display = 'inline-flex';
      photoStatus.textContent = '✓ नई photo ready';
      photoStatus.style.color = 'var(--rr-green)';
    };
    reader.readAsDataURL(f);
  });

  photoClear.addEventListener('click', () => {
    photoData = null;
    photoInput.value = '';
    photoPreview.innerHTML = '📷';
    photoClear.style.display = 'none';
    photoStatus.textContent = 'Photo हटा दी गई';
    photoStatus.style.color = 'var(--rr-coral)';
  });

  function closeModal(){ backdrop.remove(); }
  document.getElementById('thrEditCancel').addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeModal(); });

  document.getElementById('thrEditSave').addEventListener('click', async () => {
    if (saving) return;
    const errDiv = document.getElementById('thrEditError');
    errDiv.style.display = 'none';

    const pk = parseInt(document.getElementById('editPkQty').value, 10);
    if (!pk || pk < 1) {
      errDiv.textContent = 'Packet quantity must be at least 1.';
      errDiv.style.display = 'block';
      return;
    }

    const payload = {
      packet_quantity: pk,
      receiver_name: document.getElementById('editReceiver').value.trim() || null,
      receiver_relation: document.getElementById('editRelation').value.trim() || null,
      given_date: document.getElementById('editGivenDate').value || null,
      notes: document.getElementById('editNotes').value.trim() || null,
      photo_data: photoData
    };

    saving = true;
    const saveBtn = document.getElementById('thrEditSave');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const res = await api('/api/admin/thr/' + d.id, { method: 'PATCH', body: payload });
      if (res.changed === false) {
        showToast('No changes to save.', 'info');
      } else {
        showToast(res.message || 'THR updated successfully', 'success');
      }
      closeModal();
      await thrLoadDetail(d.id);
      THRMenu.view = 'detail';
      renderTHRDetail();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
      saving = false;
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}


/* ==================== DELETE MODAL ==================== */
function showTHRDeleteDialog(d, b){
  const backdrop = document.createElement('div');
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal">
      <div class="warn-icon">🗑</div>
      <h3>Delete THR</h3>
      <p>
        <b>${escHtml(b ? b.full_name : '')}</b><br>
        ${d.packet_quantity} packets · ${MONTH_NAMES_THR[d.ration_month]} ${d.ration_year}
        <br><br>
        इस beneficiary को उस महीने के लिए <b>Pending</b> में वापस डाल दिया जाएगा।<br>
        History सुरक्षित रहेगी।
      </p>

      <div class="family-field">
        <label for="thrDelReason">Reason <span class="req">*</span></label>
        <input type="text" id="thrDelReason" placeholder="जैसे: गलती से दर्ज हो गया">
      </div>

      <div id="thrDelError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="thrDelCancel">Cancel</button>
        <button class="family-btn family-btn-danger" id="thrDelOk">Delete THR</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#thrDelCancel').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

  backdrop.querySelector('#thrDelOk').addEventListener('click', async () => {
    const errEl = backdrop.querySelector('#thrDelError');
    errEl.style.display = 'none';
    const reason = backdrop.querySelector('#thrDelReason').value.trim();
    if (!reason) { errEl.textContent = 'Reason ज़रूरी है।'; errEl.style.display = 'block'; return; }

    try {
      const res = await api('/api/admin/thr/' + d.id + '/delete', {
        method: 'POST', body: { reason: reason }
      });
      backdrop.remove();
      showToast(res.message || 'THR deleted successfully', 'success');
      THRMenu.view = 'list';
      THRMenu.selected = null;
      await reloadTHRData();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}


/* ==================== LOG RENDER ==================== */
function renderTHRLog(log){
  const icons = { 'CREATE': '➕', 'UPDATE': '✎', 'DELETE': '🗑' };
  const labels = { 'CREATE': 'THR Given', 'UPDATE': 'THR Updated', 'DELETE': 'THR Deleted' };
  const icon = icons[log.log_type] || '•';
  const label = labels[log.log_type] || log.log_type;

  // Beneficiary chip
  const beneName = log.beneficiary_name || 'Unknown';
  const beneId = log.beneficiary_unique_id ? '#' + log.beneficiary_unique_id : '';
  const beneChip = `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#fff;border-radius:8px;margin:5px 0;">
      <div style="width:24px;height:24px;border-radius:50%;background:#f0f0f5;display:grid;place-items:center;font-size:12px;flex-shrink:0;">👤</div>
      <div style="min-width:0;">
        <div style="font-weight:800;color:var(--rr-ink);font-size:13px;">${escHtml(beneName)}</div>
        ${beneId ? '<div style="font-size:10.5px;color:#8a9a92;">' + escHtml(beneId) + '</div>' : ''}
      </div>
    </div>
  `;

  let bodyHtml = '';

  if (log.log_type === 'CREATE' && log.new_values) {
    try {
      const n = JSON.parse(log.new_values);
      const rows = [];
      Object.keys(n).forEach(k => {
        if (n[k] === null || n[k] === undefined || n[k] === '') return;
        const lab = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        rows.push('<div><b>' + escHtml(lab) + ':</b> ' + escHtml(String(n[k])) + '</div>');
      });
      if (rows.length) {
        bodyHtml = '<details><summary>Details देखें (' + rows.length + ')</summary><div class="log-changes">' + rows.join('') + '</div></details>';
      }
    } catch (e) {}
  } else if (log.log_type === 'UPDATE' && log.old_values) {
    try {
      const o = JSON.parse(log.old_values);
      const rows = [];
      Object.keys(o).forEach(k => {
        const e = o[k];
        if (!e || typeof e !== 'object') return;
        const lab = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const ov = e.old === null || e.old === undefined || e.old === '' ? '—' : String(e.old);
        const nv = e.new === null || e.new === undefined || e.new === '' ? '—' : String(e.new);
        if (ov === nv) return;
        rows.push('<div class="chg"><b>' + escHtml(lab) + ':</b> <span class="old">' + escHtml(ov) + '</span> <span class="arrow">→</span> <span class="new">' + escHtml(nv) + '</span></div>');
      });
      if (rows.length) {
        bodyHtml = '<details><summary>Changes देखें (' + rows.length + ')</summary><div class="log-changes">' + rows.join('') + '</div></details>';
      }
    } catch (e) {}
  } else if (log.log_type === 'DELETE') {
    bodyHtml = '<div>Beneficiary returned to Pending for that month.</div>';
    if (log.reason) bodyHtml += '<div style="font-style:italic;margin-top:3px;">Reason: ' + escHtml(log.reason) + '</div>';
  }

  const givenDate = log.given_date ? '<div style="font-size:11px;color:#8a9a92;margin-top:3px;">📅 Given: ' + fmtBeneDate(log.given_date) + '</div>' : '';
  const user = log.created_by_username ? '<div class="log-user">👤 ' + escHtml(log.created_by_username) + '</div>' : '';

  return `
    <div class="thr-log">
      <div class="log-head">
        <span>${icon} ${escHtml(label)}</span>
        <span class="log-time">${fmtDateTime(log.created_at)}</span>
      </div>
      <div class="log-body">
        ${beneChip}
        ${givenDate}
        ${bodyHtml}
        ${user}
      </div>
    </div>
  `;
}


/* ==================== LOGS PAGE (ALL) ==================== */
async function renderTHRLogsAll(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="thr-header">
      <div><h2>THR Logs</h2><div class="sub">Loading...</div></div>
      <div class="header-actions"><button class="back-btn" id="backBtn">← Back</button></div>
    </div>
    <div class="thr-main"><p style="text-align:center;padding:30px;color:var(--rr-muted);">Loading...</p></div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    THRMenu.view = 'list';
    renderTHRList();
  });

  try {
    const params = new URLSearchParams();
    if (THRMenu.year) params.set('year', THRMenu.year);
    if (THRMenu.month) params.set('month', THRMenu.month);
    const data = await api('/api/admin/thr/logs?' + params.toString());
    const logs = data.logs || [];
    root.innerHTML = `
      <div class="thr-header">
        <div>
          <h2>THR Logs</h2>
          <div class="sub">${MONTH_NAMES_THR[THRMenu.month]} ${THRMenu.year} · ${logs.length} entr${logs.length === 1 ? 'y' : 'ies'}</div>
        </div>
        <div class="header-actions"><button class="back-btn" id="backBtn">← Back</button></div>
      </div>
      <div class="thr-main">
        ${logs.length ? logs.map(l => renderTHRLog(l)).join('') : '<div class="thr-empty"><div class="empty-icon">📜</div><div class="empty-title">इस month में कोई THR log नहीं</div></div>'}
      </div>
    `;
    document.getElementById('backBtn').addEventListener('click', () => {
      THRMenu.view = 'list';
      renderTHRList();
    });
  } catch (e) {
    showToast(e.message, 'error');
  }
}
