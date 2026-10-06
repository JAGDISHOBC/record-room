/* ==================== STOCK REGISTER MODULE ==================== */

const StockMenu = {
  view: 'dashboard',        // dashboard | list | add | detail | edit | logs
  type: '',                 // '' | THR | MILK_POWDER | SUGAR | SANITARY_NAPKINS | OTHERS
  status: 'ACTIVE',         // ACTIVE | DELETED | ALL
  search: '',
  items: [],
  counts: {},
  totalActive: 0,
  totalDeleted: 0,
  typeLabels: {},
  summary: {},
  thrSummary: null,
  selected: null,
  selectedLogs: [],
  selectedRecipes: []
};

const STOCK_TYPES = [
  { code: 'THR',              label: 'THR Stock',              short: 'THR',         icon: '📦', color: 'coral' },
  { code: 'MILK_POWDER',      label: 'Milk Powder Stock',      short: 'Milk Powder', icon: '🥛', color: 'purple' },
  { code: 'SUGAR',            label: 'Sugar Stock',            short: 'Sugar',       icon: '🍬', color: 'coral' },
  { code: 'SANITARY_NAPKINS', label: 'Sanitary Napkins Stock', short: 'Sanitary',    icon: '🧴', color: 'purple' },
  { code: 'OTHERS',           label: 'Other Items Stock',      short: 'Other',       icon: '📎', color: 'coral' }
];

const STOCK_FIELD_LABELS = {
  stock_type: 'Stock Type',
  item_name: 'Item Name',
  quantity: 'Quantity',
  unit: 'Unit',
  packets: 'Packets',
  grams_per_packet: 'Grams/Packet',
  total_grams: 'Total Grams',
  total_kg: 'Total Kg',
  pieces_per_packet: 'Pieces/Packet',
  total_pieces: 'Total Pieces',
  ration_year: 'Ration Year',
  ration_month: 'Ration Month',
  bill_challan_no: 'Bill/Challan No.',
  billing_date: 'Billing Date',
  actual_received_date: 'Actual Received Date',
  supplier_name: 'Supplier Name',
  remarks: 'Remarks',
  details: 'Details'
};

const MONTH_NAMES = ['', 'January','February','March','April','May','June','July','August','September','October','November','December'];

function stockTypeLabel(code){
  const t = STOCK_TYPES.find(x => x.code === code);
  return t ? t.label : code;
}
function stockTypeShort(code){
  const t = STOCK_TYPES.find(x => x.code === code);
  return t ? t.short : code;
}
function stockTypeIcon(code){
  const t = STOCK_TYPES.find(x => x.code === code);
  return t ? t.icon : '📦';
}
function stockTypeColor(code){
  const t = STOCK_TYPES.find(x => x.code === code);
  return t ? t.color : 'coral';
}
function fmtNumber(n, decimals){
  if (n === null || n === undefined || n === '') return '—';
  const num = Number(n);
  if (isNaN(num)) return String(n);
  return num.toLocaleString('en-IN', { maximumFractionDigits: decimals === undefined ? 3 : decimals });
}
function fmtKg(grams){
  if (!grams && grams !== 0) return '—';
  const kg = Number(grams) / 1000;
  return kg.toFixed(3) + ' kg';
}

/* ==================== GLOBAL STOCK PHOTO ==================== */
let stockAddPhotoData = null;
let stockEditPhotoData = null;
let stockEditPhotoOriginal = null;

function bindStockPhotoUI(container, onStatus){
  const photoInput = container.querySelector('#stockPhotoInput');
  const photoPreview = container.querySelector('#stockPhotoPreview');
  const photoClear = container.querySelector('#stockPhotoClear');
  const photoStatus = container.querySelector('#stockPhotoStatus');
  if (!photoInput) return;

  photoInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) {
      if (photoStatus) { photoStatus.textContent = 'Photo बहुत बड़ी है (max 3 MB)।'; photoStatus.style.color = 'var(--rr-coral)'; }
      photoInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      stockAddPhotoData = ev.target.result;
      if (photoPreview) photoPreview.innerHTML = '<img src="' + stockAddPhotoData + '" alt="">';
      if (photoClear) photoClear.style.display = 'inline-flex';
      if (photoStatus) { photoStatus.textContent = '✓ Photo ready'; photoStatus.style.color = 'var(--rr-green)'; }
    };
    reader.readAsDataURL(f);
  });

  if (photoClear) photoClear.addEventListener('click', () => {
    stockAddPhotoData = null;
    photoInput.value = '';
    if (photoPreview) photoPreview.innerHTML = '📷';
    photoClear.style.display = 'none';
    if (photoStatus) photoStatus.textContent = '';
  });
}

function stockPhotoUI(){
  return `
    <div class="stock-field full">
      <label>📷 Bill / Challan Photo (optional)</label>
      <div class="thr-photo-row">
        <div class="thr-photo-preview" id="stockPhotoPreview">📷</div>
        <div class="thr-photo-actions">
          <input type="file" id="stockPhotoInput" accept="image/*">
          <button type="button" class="stock-btn stock-btn-secondary stock-btn-sm" id="stockPhotoClear" style="display:none;margin-top:6px;align-self:flex-start;">Remove Photo</button>
          <div class="hint" id="stockPhotoStatus"></div>
        </div>
      </div>
    </div>
  `;
}

/* ==================== API ==================== */
async function stockLoadList(){
  const params = new URLSearchParams();
  if (StockMenu.type) params.set('type', StockMenu.type);
  params.set('status', StockMenu.status);
  if (StockMenu.search) params.set('search', StockMenu.search);
  const data = await api('/api/admin/stock?' + params.toString());
  StockMenu.items = data.stock || [];
  StockMenu.counts = data.counts || {};
  StockMenu.totalActive = data.total_active || 0;
  StockMenu.totalDeleted = data.total_deleted || 0;
  StockMenu.typeLabels = data.type_labels || {};
}

async function stockLoadSummary(){
  const data = await api('/api/admin/stock/summary');
  StockMenu.summary = data.summary || {};
  StockMenu.thrSummary = data.thr_summary || null;
  StockMenu.typeLabels = data.type_labels || {};
}

async function stockLoadDetail(id){
  const data = await api('/api/admin/stock/' + id);
  StockMenu.selected = data.stock;
  const ldata = await api('/api/admin/stock/' + id + '/logs');
  StockMenu.selectedLogs = ldata.logs || [];
  // Load recipe lines if this is a THR recipe batch
  if (data.stock && data.stock.is_recipe_batch) {
    try {
      const rdata = await api('/api/admin/stock/' + id + '/recipes');
      StockMenu.selectedRecipes = rdata.recipes || [];
    } catch (e) {
      StockMenu.selectedRecipes = [];
    }
  } else {
    StockMenu.selectedRecipes = [];
  }
}

/* ==================== ENTRY ==================== */
StockMenu.open = function(){
  StockMenu.view = 'dashboard';
  StockMenu.type = '';
  StockMenu.status = 'ACTIVE';
  StockMenu.search = '';
  StockMenu.selected = null;
  Promise.all([stockLoadSummary(), stockLoadList()])
    .then(renderStockDashboard)
    .catch(e => showToast(e.message, 'error'));
};


/* ==================== RENDER: DASHBOARD ==================== */
function renderStockDashboard(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const t = StockMenu.thrSummary;

  root.innerHTML = `
    <div class="stock-header">
      <div>
        <h2>Stock Register</h2>
        <div class="sub">Stock Receipt & History</div>
      </div>
    </div>

    <div class="stock-main">

      ${t ? `
        <div class="stock-thr-strip">
          <h3>
            <span>THR Monthly Summary</span>
            <span class="pill">${escHtml(MONTH_NAMES[t.ration_month] || '')} ${t.ration_year}</span>
          </h3>
          <div class="stock-summary-grid">
            <div class="stock-summary-card">
              <div class="label">Last Month Remaining</div>
              <div class="value">${fmtNumber(t.prior_received, 0)} pkt</div>
            </div>
            <div class="stock-summary-card">
              <div class="label">Received</div>
              <div class="value">${fmtNumber(t.received, 0)} pkt</div>
            </div>
            <div class="stock-summary-card">
              <div class="label">Total Pkt</div>
              <div class="value">${fmtNumber((t.prior_received||0) + (t.received||0), 0)}</div>
            </div>
            <div class="stock-summary-card">
              <div class="label">Distributed</div>
              <div class="value">—</div>
            </div>
            <div class="stock-summary-card">
              <div class="label">Remaining</div>
              <div class="value">—</div>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="stock-grid">
        ${STOCK_TYPES.map(st => {
          const s = StockMenu.summary[st.code] || { count: 0, total_qty: 0, last_date: null, last_qty: null, last_unit: null };
          return `
            <button class="stock-category-card" data-type="${st.code}">
              <h3>${escHtml(st.label)}</h3>
              <div class="stock-subline">
                ${s.last_date ? 'Last: ' + fmtBeneDate(s.last_date) : 'No receipts yet'}
              </div>
              <span class="stock-count">${s.count} entr${s.count === 1 ? 'y' : 'ies'}</span>
              <span class="stock-cat-icon ${st.color === 'purple' ? 'purple' : ''}">${st.icon}</span>
            </button>
          `;
        }).join('')}
      </div>

      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;">
        <button class="stock-btn stock-btn-primary" id="quickAddBtn">＋ Add Stock</button>
        <button class="stock-btn stock-btn-secondary" id="quickHistoryBtn">📋 All History</button>
        <button class="stock-btn stock-btn-secondary" id="quickLogsBtn">📜 Stock Logs</button>
      </div>
    </div>
  `;

  root.querySelectorAll('.stock-category-card').forEach(btn => {
    btn.addEventListener('click', () => {
      StockMenu.type = btn.dataset.type;
      StockMenu.view = 'list';
      StockMenu.status = 'ACTIVE';
      StockMenu.search = '';
      stockLoadList().then(renderStockList).catch(e => showToast(e.message, 'error'));
    });
  });

  document.getElementById('quickAddBtn').addEventListener('click', () => {
    StockMenu.type = '';
    StockMenu.view = 'add';
    renderStockAdd();
  });

  document.getElementById('quickHistoryBtn').addEventListener('click', () => {
    StockMenu.type = '';
    StockMenu.view = 'list';
    StockMenu.status = 'ALL';
    StockMenu.search = '';
    stockLoadList().then(renderStockList).catch(e => showToast(e.message, 'error'));
  });

  document.getElementById('quickLogsBtn').addEventListener('click', () => {
    StockMenu.view = 'logs';
    renderStockLogsPage();
  });
}


/* ==================== RENDER: LIST (category or all) ==================== */
function renderStockList(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const cat = StockMenu.type ? StockMenu.type : null;
  const title = cat ? stockTypeLabel(cat) : 'All Stock History';
  const isDeleted = StockMenu.status === 'DELETED';

  root.innerHTML = `
    <div class="stock-header">
      <div>
        <h2>${escHtml(title)}</h2>
        <div class="sub">${isDeleted ? 'Deleted entries' : 'Active entries'}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="stock-main">

      <div class="stock-filter-row">
        <button class="stock-chip ${StockMenu.status === 'ACTIVE' ? 'active' : ''}" data-status="ACTIVE">Active</button>
        <button class="stock-chip ${StockMenu.status === 'DELETED' ? 'active' : ''}" data-status="DELETED">Deleted</button>
        <button class="stock-chip ${StockMenu.status === 'ALL' ? 'active' : ''}" data-status="ALL">All</button>
      </div>

      <div class="stock-search">
        <input id="stockSearch" type="search"
          placeholder="Search item, supplier, bill/challan or remarks"
          autocomplete="off" value="${escHtml(StockMenu.search)}">
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--rr-muted);margin-bottom:12px;">
        ${StockMenu.items.length} record${StockMenu.items.length === 1 ? '' : 's'}
      </div>

      <div class="stock-list" id="stockList">
        ${StockMenu.items.length
          ? StockMenu.items.map(item => renderStockRow(item)).join('')
          : renderStockEmpty()}
      </div>
    </div>

    ${!isDeleted ? '<button class="stock-fab" id="addStockBtn" title="Add Stock">＋</button>' : ''}
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    StockMenu.view = 'dashboard';
    StockMenu.type = '';
    stockLoadSummary().then(renderStockDashboard).catch(e => showToast(e.message, 'error'));
  });

  root.querySelectorAll('.stock-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      StockMenu.status = chip.dataset.status;
      stockLoadList().then(renderStockList).catch(e => showToast(e.message, 'error'));
    });
  });

  const searchInput = document.getElementById('stockSearch');
  let searchTimer = null;
  searchInput.addEventListener('input', (e) => {
    StockMenu.search = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      stockLoadList().then(() => {
        const listEl = document.getElementById('stockList');
        if (listEl) {
          listEl.innerHTML = StockMenu.items.length
            ? StockMenu.items.map(item => renderStockRow(item)).join('')
            : renderStockEmpty();
          bindStockRows();
        }
      }).catch(e => showToast(e.message, 'error'));
    }, 250);
  });

  const addBtn = document.getElementById('addStockBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      StockMenu.view = 'add';
      renderStockAdd();
    });
  }

  bindStockRows();
}


function renderStockRow(s){
  const isDeleted = s.status === 'DELETED';
  const title = s.item_name || stockTypeShort(s.stock_type);
  const qtyText = fmtNumber(s.quantity, 3) + ' ' + (s.unit || '');
  const metaParts = [];
  metaParts.push('📅 ' + fmtBeneDate(s.actual_received_date));
  if (s.stock_type === 'THR' && s.ration_year && s.ration_month) {
    metaParts.push('Ration: ' + (MONTH_NAMES[s.ration_month] || '') + ' ' + s.ration_year);
  }
  if (s.photo_data) metaParts.push('📷');
  if (s.supplier_name) metaParts.push('🏢 ' + escHtml(s.supplier_name));
  if (s.bill_challan_no) metaParts.push('🧾 ' + escHtml(s.bill_challan_no));

  return `
    <button class="stock-list-row ${isDeleted ? 'deleted' : ''}" data-id="${s.id}">
      <div class="stock-avatar">${stockTypeIcon(s.stock_type)}</div>
      <div style="min-width:0;">
        <div class="stock-name">${escHtml(title)}</div>
        <div class="stock-meta" style="margin-top:4px;">
          <b style="color:var(--rr-ink);">${escHtml(qtyText)}</b>
          <span class="stock-status-badge ${isDeleted ? 'deleted' : ''}">${isDeleted ? 'DELETED' : 'ACTIVE'}</span>
        </div>
        <div class="stock-meta" style="margin-top:4px;">
          ${metaParts.join('')}
        </div>
      </div>
      <div class="stock-arrow">›</div>
    </button>
  `;
}


function renderStockEmpty(){
  return `
    <div class="empty-state">
      <div class="empty-icon">📦</div>
      <div class="empty-title">No stock entries found.</div>
      <div class="empty-sub">${StockMenu.search ? 'दूसरा search try करें' : 'नीचे + बटन से नया stock जोड़ें'}</div>
    </div>
  `;
}


function bindStockRows(){
  document.querySelectorAll('.stock-list-row').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.id, 10);
      StockMenu.view = 'detail';
      stockLoadDetail(id).then(renderStockDetail).catch(e => showToast(e.message, 'error'));
    });
  });
}


/* ==================== RENDER: ADD STOCK ==================== */
function renderStockAdd(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const today = new Date().toISOString().slice(0,10);
  const currentYear = new Date().getFullYear();

  root.innerHTML = `
    <div class="stock-header">
      <div>
        <h2>Add Stock</h2>
        <div class="sub">Stock Receipt Entry</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="stock-main">
      <div class="stock-form-card">
        <form id="stockAddForm">

          <div class="detail-section-title">Stock Information</div>
          <div class="stock-form-grid">
            <div class="stock-field full">
              <label for="stockType">Stock Type <span class="req">*</span></label>
              <select id="stockType" required>
                <option value="">-- Select Stock Type --</option>
                ${STOCK_TYPES.map(t => `<option value="${t.code}" ${StockMenu.type === t.code ? 'selected' : ''}>${t.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Dynamic category-specific fields -->
          <div id="categoryFields"></div>

          <div id="outerReceiptSection">
            <div class="detail-section-title" style="margin-top:22px;">Receipt Information</div>
            <div class="stock-form-grid">
              <div class="stock-field">
                <label for="billChallan">Bill / Challan No.</label>
                <input type="text" id="billChallan">
              </div>
              <div class="stock-field">
                <label for="billingDate">Billing Date</label>
                <input type="date" id="billingDate">
              </div>
              <div class="stock-field">
                <label for="actualReceivedDate">Actual Received Date <span class="req">*</span></label>
                <input type="date" id="actualReceivedDate" value="${today}" required>
              </div>
              <div class="stock-field">
                <label for="supplierName">Supplier Name</label>
                <input type="text" id="supplierName">
              </div>
              <div class="stock-field full">
                <label for="remarks">Remarks / Details</label>
                <textarea id="remarks" rows="2"></textarea>
              </div>
            </div>
          </div>

          <div id="formError" class="login-error" style="display:none;margin-top:14px;"></div>
          <div class="stock-actions" id="outerFormActions">
            <button type="button" class="stock-btn stock-btn-secondary" id="cancelBtn">Cancel</button>
            <button type="submit" class="stock-btn stock-btn-primary">Save Stock</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // ==================== DYNAMIC CATEGORY FIELDS ====================
  const catContainer = document.getElementById('categoryFields');
  const typeSel = document.getElementById('stockType');
  stockAddPhotoData = null;

  function renderCategoryFields(){
    const t = typeSel.value;
    if (!t) { catContainer.innerHTML = '<p style="color:var(--rr-muted);font-size:13px;margin-top:14px;">कृपया पहले Stock Type चुनें।</p>'; return; }

    // Show/hide outer sections based on type
    const outerReceipt = document.getElementById('outerReceiptSection');
    const outerActions = document.getElementById('outerFormActions');
    if (t === 'THR') {
      if (outerReceipt) outerReceipt.style.display = 'none';
      if (outerActions) outerActions.style.display = 'none';
    } else {
      if (outerReceipt) outerReceipt.style.display = '';
      if (outerActions) outerActions.style.display = 'flex';
    }

    // THR uses recipe-wise form
    if (t === 'THR' && typeof renderTHRRecipeForm === 'function') {
      renderTHRRecipeForm();
      return;
    }

    if (t === 'THR') {
      const curMonth = new Date().getMonth() + 1;
      catContainer.innerHTML = `
        <div class="detail-section-title" style="margin-top:22px;">THR Stock Details</div>
        <div class="stock-form-grid">
          <div class="stock-field">
            <label for="rationYear">Ration Year <span class="req">*</span></label>
            <select id="rationYear" required>
              ${[currentYear-1, currentYear, currentYear+1].map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
          </div>
          <div class="stock-field">
            <label for="rationMonth">Ration Month <span class="req">*</span></label>
            <select id="rationMonth" required>
              ${MONTH_NAMES.slice(1).map((m, i) => `<option value="${i+1}" ${i+1 === curMonth ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <div class="stock-field">
            <label for="quantity">Quantity (Packets) <span class="req">*</span></label>
            <input type="number" id="quantity" step="any" min="0.01" required>
          </div>
          <div class="stock-field">
            <label for="unit">Unit</label>
            <input type="text" id="unit" value="Packets" readonly style="background:#f8f8fa;">
          </div>
        </div>
      `;
    } else if (t === 'MILK_POWDER') {
      catContainer.innerHTML = `
        <div class="detail-section-title" style="margin-top:22px;">Milk Powder Details</div>
        <div class="stock-form-grid">
          <div class="stock-field full">
            <label for="itemName">Item / Milk Powder Name <span class="req">*</span></label>
            <input type="text" id="itemName" placeholder="जैसे: Balbhog Milk Powder" required>
          </div>
          <div class="stock-field">
            <label for="packets">Number of Packets <span class="req">*</span></label>
            <input type="number" id="packets" step="any" min="0.01" required>
          </div>
          <div class="stock-field">
            <label for="gramsPerPacket">Grams per Packet <span class="req">*</span></label>
            <input type="number" id="gramsPerPacket" step="any" min="0.01" required>
          </div>
          <div class="stock-field">
            <label>Total Weight (Auto)</label>
            <div class="locked-field" style="min-height:46px;">
              <span class="lock-value" id="milkTotalKg">—</span>
            </div>
          </div>
          <div class="stock-field">
            <label for="unit">Unit</label>
            <input type="text" id="unit" value="Packets" readonly style="background:#f8f8fa;">
          </div>
          ${stockPhotoUI()}
        </div>
      `;
      bindStockPhotoUI(catContainer);
      // Auto calculate
      const pEl = document.getElementById('packets');
      const gEl = document.getElementById('gramsPerPacket');
      const kgEl = document.getElementById('milkTotalKg');
      function calcMilk(){
        const p = parseFloat(pEl.value) || 0;
        const g = parseFloat(gEl.value) || 0;
        if (p > 0 && g > 0) {
          kgEl.textContent = ((p * g) / 1000).toFixed(3) + ' kg (' + (p * g).toLocaleString('en-IN') + ' g)';
        } else {
          kgEl.textContent = '—';
        }
      }
      pEl.addEventListener('input', calcMilk);
      gEl.addEventListener('input', calcMilk);
    } else if (t === 'SUGAR') {
      catContainer.innerHTML = `
        <div class="detail-section-title" style="margin-top:22px;">Sugar Details</div>
        <div class="stock-form-grid">
          <div class="stock-field full">
            <label for="itemName">Sugar Item Name</label>
            <input type="text" id="itemName" placeholder="Sugar" value="Sugar">
          </div>
          <div class="stock-field">
            <label for="quantity">Quantity (grams) <span class="req">*</span></label>
            <input type="number" id="quantity" step="any" min="0.01" required>
            <div class="hint" id="sugarKg">= 0.000 kg</div>
          </div>
          <div class="stock-field">
            <label for="unit">Unit</label>
            <input type="text" id="unit" value="grams" readonly style="background:#f8f8fa;">
          </div>
          ${stockPhotoUI()}
        </div>
      `;
      bindStockPhotoUI(catContainer);
      const qEl = document.getElementById('quantity');
      const kgEl = document.getElementById('sugarKg');
      qEl.addEventListener('input', () => {
        const g = parseFloat(qEl.value) || 0;
        kgEl.textContent = '= ' + (g / 1000).toFixed(3) + ' kg';
      });
    } else if (t === 'SANITARY_NAPKINS') {
      catContainer.innerHTML = `
        <div class="detail-section-title" style="margin-top:22px;">Sanitary Napkins Details</div>
        <div class="stock-form-grid">
          <div class="stock-field full">
            <label for="itemName">Item Name</label>
            <input type="text" id="itemName" placeholder="Sanitary Napkins" value="Sanitary Napkins">
          </div>
          <div class="stock-field">
            <label for="packets">Number of Packets <span class="req">*</span></label>
            <input type="number" id="packets" step="any" min="0.01" required>
          </div>
          <div class="stock-field">
            <label for="piecesPerPacket">Pieces per Packet <span class="req">*</span></label>
            <input type="number" id="piecesPerPacket" step="any" min="0.01" required>
          </div>
          <div class="stock-field">
            <label>Total Pieces (Auto)</label>
            <div class="locked-field" style="min-height:46px;">
              <span class="lock-value" id="totalPieces">—</span>
            </div>
          </div>
          <div class="stock-field">
            <label for="unit">Unit</label>
            <input type="text" id="unit" value="Packets" readonly style="background:#f8f8fa;">
          </div>
          ${stockPhotoUI()}
        </div>
      `;
      bindStockPhotoUI(catContainer);
      const pEl = document.getElementById('packets');
      const pppEl = document.getElementById('piecesPerPacket');
      const tpEl = document.getElementById('totalPieces');
      function calcPieces(){
        const p = parseFloat(pEl.value) || 0;
        const ppp = parseFloat(pppEl.value) || 0;
        if (p > 0 && ppp > 0) {
          tpEl.textContent = (p * ppp).toLocaleString('en-IN') + ' pieces';
        } else {
          tpEl.textContent = '—';
        }
      }
      pEl.addEventListener('input', calcPieces);
      pppEl.addEventListener('input', calcPieces);
    } else if (t === 'OTHERS') {
      catContainer.innerHTML = `
        <div class="detail-section-title" style="margin-top:22px;">Other Item Details</div>
        <div class="stock-form-grid">
          <div class="stock-field full">
            <label for="itemName">Item Name <span class="req">*</span></label>
            <input type="text" id="itemName" placeholder="जैसे: Utensils, Equipment" required>
          </div>
          <div class="stock-field">
            <label for="quantity">Quantity <span class="req">*</span></label>
            <input type="number" id="quantity" step="any" min="0.01" required>
          </div>
          <div class="stock-field">
            <label for="unit">Unit <span class="req">*</span></label>
            <select id="unit" required>
              <option value="">Select</option>
              <option value="pieces">Pieces</option>
              <option value="kg">Kg</option>
              <option value="grams">Grams</option>
              <option value="liters">Liters</option>
              <option value="ml">ML</option>
              <option value="boxes">Boxes</option>
              <option value="packets">Packets</option>
              <option value="sets">Sets</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div class="stock-field" id="customUnitWrap" style="display:none;">
            <label for="customUnit">Custom Unit</label>
            <input type="text" id="customUnit" placeholder="Custom unit name">
          </div>
          ${stockPhotoUI()}
        </div>
      `;
      bindStockPhotoUI(catContainer);
      const unitSel = document.getElementById('unit');
      const custWrap = document.getElementById('customUnitWrap');
      unitSel.addEventListener('change', () => {
        custWrap.style.display = unitSel.value === 'other' ? 'flex' : 'none';
      });
    }
  }

  typeSel.addEventListener('change', renderCategoryFields);
  renderCategoryFields();

  // ==================== NAVIGATION ====================
  document.getElementById('backBtn').addEventListener('click', () => {
    StockMenu.view = 'dashboard';
    StockMenu.type = '';
    stockLoadSummary().then(renderStockDashboard).catch(e => showToast(e.message, 'error'));
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    StockMenu.view = 'dashboard';
    StockMenu.type = '';
    stockLoadSummary().then(renderStockDashboard).catch(e => showToast(e.message, 'error'));
  });

  // ==================== SUBMIT ====================
  document.getElementById('stockAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('formError');
    errDiv.style.display = 'none';

    const t = typeSel.value;
    if (!t) { errDiv.textContent = 'Stock type is required.'; errDiv.style.display = 'block'; return; }

    const actualDate = document.getElementById('actualReceivedDate').value;
    if (!actualDate) { errDiv.textContent = 'Actual received date is required.'; errDiv.style.display = 'block'; return; }

    const payload = {
      stock_type: t,
      bill_challan_no: document.getElementById('billChallan').value.trim() || null,
      billing_date: document.getElementById('billingDate').value || null,
      actual_received_date: actualDate,
      supplier_name: document.getElementById('supplierName').value.trim() || null,
      remarks: document.getElementById('remarks').value.trim() || null,
      photo_data: stockAddPhotoData
    };

    // Category-specific
    if (t === 'THR') {
      const q = parseFloat(document.getElementById('quantity').value);
      if (!q || q <= 0) { errDiv.textContent = 'Quantity must be greater than zero.'; errDiv.style.display = 'block'; return; }
      const ry = document.getElementById('rationYear').value;
      const rm = document.getElementById('rationMonth').value;
      if (!ry || !rm) { errDiv.textContent = 'Ration month is required for THR stock.'; errDiv.style.display = 'block'; return; }
      payload.quantity = q;
      payload.unit = 'Packets';
      payload.ration_year = parseInt(ry);
      payload.ration_month = parseInt(rm);
      payload.year = parseInt(ry);
    } else if (t === 'MILK_POWDER') {
      const name = document.getElementById('itemName').value.trim();
      if (!name) { errDiv.textContent = 'Item name is required.'; errDiv.style.display = 'block'; return; }
      const p = parseFloat(document.getElementById('packets').value);
      const gpp = parseFloat(document.getElementById('gramsPerPacket').value);
      if (!p || p <= 0) { errDiv.textContent = 'Packets must be greater than zero.'; errDiv.style.display = 'block'; return; }
      if (!gpp || gpp <= 0) { errDiv.textContent = 'Grams per packet must be greater than zero.'; errDiv.style.display = 'block'; return; }
      payload.item_name = name;
      payload.quantity = p;
      payload.unit = 'Packets';
      payload.packets = p;
      payload.grams_per_packet = gpp;
    } else if (t === 'SUGAR') {
      const q = parseFloat(document.getElementById('quantity').value);
      if (!q || q <= 0) { errDiv.textContent = 'Quantity must be greater than zero.'; errDiv.style.display = 'block'; return; }
      payload.item_name = document.getElementById('itemName').value.trim() || 'Sugar';
      payload.quantity = q;
      payload.unit = 'grams';
    } else if (t === 'SANITARY_NAPKINS') {
      const p = parseFloat(document.getElementById('packets').value);
      const ppp = parseFloat(document.getElementById('piecesPerPacket').value);
      if (!p || p <= 0) { errDiv.textContent = 'Packets must be greater than zero.'; errDiv.style.display = 'block'; return; }
      if (!ppp || ppp <= 0) { errDiv.textContent = 'Pieces per packet must be greater than zero.'; errDiv.style.display = 'block'; return; }
      payload.item_name = document.getElementById('itemName').value.trim() || 'Sanitary Napkins';
      payload.quantity = p;
      payload.unit = 'Packets';
      payload.packets = p;
      payload.pieces_per_packet = ppp;
    } else if (t === 'OTHERS') {
      const name = document.getElementById('itemName').value.trim();
      if (!name) { errDiv.textContent = 'Item name is required.'; errDiv.style.display = 'block'; return; }
      const q = parseFloat(document.getElementById('quantity').value);
      if (!q || q <= 0) { errDiv.textContent = 'Quantity must be greater than zero.'; errDiv.style.display = 'block'; return; }
      let unit = document.getElementById('unit').value;
      if (unit === 'other') {
        const cust = document.getElementById('customUnit').value.trim();
        if (!cust) { errDiv.textContent = 'Custom unit is required.'; errDiv.style.display = 'block'; return; }
        unit = cust;
      }
      if (!unit) { errDiv.textContent = 'Unit is required.'; errDiv.style.display = 'block'; return; }
      payload.item_name = name;
      payload.quantity = q;
      payload.unit = unit;
    }

    try {
      const res = await api('/api/admin/stock', { method: 'POST', body: payload });
      showToast(res.message || 'Stock saved successfully', 'success');
      StockMenu.view = 'dashboard';
      StockMenu.type = '';
      await Promise.all([stockLoadSummary(), stockLoadList()]);
      renderStockDashboard();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}


/* ==================== RENDER: DETAIL ==================== */
function renderStockDetail(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const s = StockMenu.selected;
  if (!s) { renderStockDashboard(); return; }

  const isDeleted = s.status === 'DELETED';
  const icon = stockTypeIcon(s.stock_type);
  const label = stockTypeLabel(s.stock_type);

  // Category specific calculated display
  let extraCard = '';
  if (s.stock_type === 'MILK_POWDER' && s.total_kg) {
    extraCard = `
      <div class="stock-detail-card">
        <h3>Calculated</h3>
        <div class="stock-kv">
          ${stockKV('Packets', fmtNumber(s.packets, 3))}
          ${stockKV('Grams per Packet', fmtNumber(s.grams_per_packet, 3) + ' g')}
          ${stockKV('Total Weight (g)', fmtNumber(s.total_grams, 3) + ' g')}
          ${stockKV('Total Weight (kg)', Number(s.total_kg).toFixed(3) + ' kg')}
        </div>
      </div>
    `;
  } else if (s.stock_type === 'SUGAR' && s.total_kg) {
    extraCard = `
      <div class="stock-detail-card">
        <h3>Calculated</h3>
        <div class="stock-kv">
          ${stockKV('Quantity (grams)', fmtNumber(s.quantity, 3) + ' g')}
          ${stockKV('Quantity (kg)', Number(s.total_kg).toFixed(3) + ' kg')}
        </div>
      </div>
    `;
  } else if (s.stock_type === 'SANITARY_NAPKINS' && s.total_pieces) {
    extraCard = `
      <div class="stock-detail-card">
        <h3>Calculated</h3>
        <div class="stock-kv">
          ${stockKV('Packets', fmtNumber(s.packets, 3))}
          ${stockKV('Pieces per Packet', fmtNumber(s.pieces_per_packet, 3))}
          ${stockKV('Total Pieces', fmtNumber(s.total_pieces, 0) + ' pieces')}
        </div>
      </div>
    `;
  }

  root.innerHTML = `
    <div class="stock-header">
      <div>
        <h2>Stock Detail</h2>
        <div class="sub">${escHtml(label)}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="stock-main">

      ${isDeleted ? `
        <div style="background:#fff4e5;border:1px solid #f5d8a8;border-radius:12px;padding:12px 14px;margin-bottom:14px;">
          <div style="font-size:13px;font-weight:800;color:#8a5a00;margin-bottom:4px;">⚠ Deleted Entry</div>
          <div style="font-size:13px;color:#8a5a00;line-height:1.5;">
            <b>Reason:</b> ${escHtml(s.delete_reason || '—')}<br>
            <b>Deleted At:</b> ${fmtBeneDate(s.deleted_at)}
          </div>
        </div>
      ` : ''}

      <div class="stock-detail-card">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:18px;">
          <div class="stock-avatar" style="width:74px;height:74px;font-size:34px;">${icon}</div>
          <div style="flex:1;min-width:0;">
            <h3 style="margin:0 0 4px;font-size:20px;">${escHtml(s.item_name || stockTypeShort(s.stock_type))}</h3>
            <div style="font-size:13px;color:var(--rr-muted);font-weight:700;">${escHtml(label)}</div>
            <div style="margin-top:6px;">
              <span class="stock-status-badge ${isDeleted ? 'deleted' : ''}">${isDeleted ? 'DELETED' : '● ACTIVE'}</span>
            </div>
          </div>
        </div>

        ${!isDeleted ? `
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="stock-btn stock-btn-primary" id="editBtn">✎ Edit</button>
            <button class="stock-btn stock-btn-danger" id="deleteBtn">🗑 Delete</button>
          </div>
        ` : `
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="stock-btn stock-btn-primary" id="recoverBtn" style="background:#59bd63;">↺ Recover</button>
            <button class="stock-btn stock-btn-danger" id="permanentDeleteBtn">🗑 Permanent Delete</button>
          </div>
        `}
      </div>

      <div class="stock-detail-card">
        <h3>Basic Information</h3>
        <div class="stock-kv">
          ${stockKV('Stock Type', label)}
          ${stockKV('Item Name', s.item_name)}
          ${stockKV('Quantity', fmtNumber(s.quantity, 3) + ' ' + (s.unit || ''))}
          ${stockKV('Unit', s.unit)}
          ${s.stock_type === 'THR' ? stockKV('Ration Year', s.ration_year) : ''}
          ${s.stock_type === 'THR' ? stockKV('Ration Month', MONTH_NAMES[s.ration_month] || '') : ''}
        </div>
      </div>

      <div class="stock-detail-card">
        <h3>Receipt Information</h3>
        <div class="stock-kv">
          ${stockKV('Bill / Challan No.', s.bill_challan_no)}
          ${stockKV('Billing Date', fmtBeneDate(s.billing_date))}
          ${stockKV('Actual Received Date', fmtBeneDate(s.actual_received_date))}
          ${stockKV('Supplier', s.supplier_name)}
          ${s.remarks ? `<div class="stock-kv-item full"><span class="kv-label">Remarks</span><span class="kv-value">${escHtml(s.remarks)}</span></div>` : ''}
        </div>
      </div>

      ${extraCard}

      ${s.is_recipe_batch && StockMenu.selectedRecipes && StockMenu.selectedRecipes.length ? `
        <div class="stock-detail-card">
          <h3>THR Recipe Details</h3>
          ${(() => {
            const grouped = {};
            StockMenu.selectedRecipes.forEach(r => {
              const c = r.category || 'UNKNOWN';
              if (!grouped[c]) grouped[c] = [];
              grouped[c].push(r);
            });
            const catMeta = {
              'PREGNANT': { label: 'Pregnant Women', icon: '🤰' },
              'LACTATING': { label: 'Lactating Mothers', icon: '🤱' },
              'CHILD_6_36': { label: '6 Months–3 Years', icon: '🧒' },
              'CHILD_36_72': { label: '3–6 Years', icon: '🧑' }
            };
            let html = '';
            Object.keys(grouped).forEach(cat => {
              const meta = catMeta[cat] || { label: cat, icon: '📦' };
              const lines = grouped[cat];
              const catPkts = lines.reduce((s, r) => s + Number(r.packets), 0);
              const catKg = lines.reduce((s, r) => s + Number(r.total_kg), 0);
              html += '<div class="thr-cat-group">';
              html += '<div class="thr-cat-group-head">' + meta.icon + ' ' + escHtml(meta.label) + ' <span class="thr-cat-group-tot">' + catPkts + ' pkt · ' + catKg.toFixed(3) + ' kg</span></div>';
              html += '<div class="thr-recipe-view">';
              lines.forEach(r => {
                html += '<div class="thr-recipe-view-row">' +
                  '<div class="thr-rv-name">' + escHtml(r.recipe_name) + '</div>' +
                  '<div class="thr-rv-weight">' + r.packet_weight_grams + ' g</div>' +
                  '<div class="thr-rv-pkts">' + fmtNumber(r.packets, 0) + ' pkt</div>' +
                  '<div class="thr-rv-total">' + Number(r.total_kg).toFixed(3) + ' kg</div>' +
                '</div>';
              });
              html += '</div></div>';
            });
            return html;
          })()}
          <div class="thr-recipe-view-total" style="margin-top:14px;">
            <span>Grand Total: ${fmtNumber(s.quantity, 0)} packets</span>
            <span>${Number(s.total_kg).toFixed(3)} kg</span>
          </div>
        </div>
      ` : ''}

      ${s.photo_data ? `
        <div class="stock-detail-card">
          <h3>Bill / Challan Photo</h3>
          <div class="thr-photo-view">
            <img src="${s.photo_data}" alt="Bill Photo" onclick="window.open(this.src,'_blank')">
            <div class="hint">Photo पर tap करके पूरी देखें</div>
          </div>
        </div>
      ` : ''}

      <div class="stock-detail-card">
        <h3>Audit</h3>
        <div class="stock-kv">
          ${stockKV('Created At', fmtDateTime(s.created_at))}
          ${stockKV('Updated At', fmtDateTime(s.updated_at))}
        </div>
      </div>

      <div class="stock-detail-card">
        <h3>Activity Logs</h3>
        <div>
          ${StockMenu.selectedLogs.length
            ? StockMenu.selectedLogs.map(l => renderStockLog(l)).join('')
            : '<p style="color:var(--rr-muted);font-size:13px;">No logs yet.</p>'}
        </div>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    const prevType = StockMenu.type;
    StockMenu.view = 'list';
    StockMenu.selected = null;
    stockLoadList().then(renderStockList).catch(e => showToast(e.message, 'error'));
  });

  const editBtn = document.getElementById('editBtn');
  if (editBtn) editBtn.addEventListener('click', () => {
    StockMenu.view = 'edit';
    renderStockEdit();
  });

  const delBtn = document.getElementById('deleteBtn');
  if (delBtn) delBtn.addEventListener('click', () => showStockDeleteDialog());

  const recBtn = document.getElementById('recoverBtn');
  if (recBtn) recBtn.addEventListener('click', async () => {
    if (!confirm('इस stock entry को recover करना है?\n\nयह फिर से Active हो जाएगी और balance में जुड़ जाएगी।')) return;
    try {
      const res = await api('/api/admin/stock/' + s.id + '/recover', { method: 'POST' });
      showToast(res.message || 'Stock recovered successfully', 'success');
      await stockLoadDetail(s.id);
      renderStockDetail();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  const pdelBtn = document.getElementById('permanentDeleteBtn');
  if (pdelBtn) pdelBtn.addEventListener('click', () => showStockPermanentDeleteDialog());
}


function stockKV(label, value){
  const empty = (value === null || value === undefined || value === '');
  return `
    <div class="stock-kv-item">
      <span class="kv-label">${escHtml(label)}</span>
      <span class="kv-value">${escHtml(empty ? '—' : value)}</span>
    </div>
  `;
}


/* ==================== LOG RENDER ==================== */
function renderStockLog(log){
  const icons = { 'ADD': '➕', 'EDIT': '✎', 'DELETE': '🗑', 'RECOVER': '↺', 'PERMANENT_DELETE': '❌' };
  const labels = { 'ADD': 'Added', 'EDIT': 'Edited', 'DELETE': 'Deleted', 'RECOVER': 'Recovered', 'PERMANENT_DELETE': 'Permanently Deleted' };
  const icon = icons[log.action] || '•';
  const label = labels[log.action] || log.action;

  let changesHtml = '';
  if (log.action === 'EDIT' && log.old_values_json) {
    try {
      const oldV = JSON.parse(log.old_values_json);
      const rows = [];
      Object.keys(oldV).forEach(k => {
        const e = oldV[k];
        if (!e || typeof e !== 'object') return;
        const lab = STOCK_FIELD_LABELS[k] || k;
        const o = maskStockVal(k, e.old);
        const n = maskStockVal(k, e.new);
        if (String(o) === String(n)) return;
        rows.push(`<div class="chg"><b>${escHtml(lab)}:</b> <span class="old">${escHtml(o)}</span> <span class="arrow">→</span> <span class="new">${escHtml(n)}</span></div>`);
      });
      if (rows.length) changesHtml = `<details><summary>Changes देखें (${rows.length})</summary><div class="log-changes">${rows.join('')}</div></details>`;
    } catch (e) {}
  } else if (log.action === 'ADD' && log.new_values_json) {
    try {
      const nv = JSON.parse(log.new_values_json);
      const rows = [];
      Object.keys(nv).forEach(k => {
        const v = nv[k];
        if (v === null || v === undefined || v === '') return;
        const lab = STOCK_FIELD_LABELS[k] || k;
        rows.push(`<div class="chg"><b>${escHtml(lab)}:</b> <span class="new">${escHtml(maskStockVal(k, v))}</span></div>`);
      });
      if (rows.length) changesHtml = `<details><summary>Details देखें (${rows.length})</summary><div class="log-changes">${rows.join('')}</div></details>`;
    } catch (e) {}
  }

  const reason = log.reason ? `<div style="margin-top:3px;font-style:italic;">Reason: ${escHtml(log.reason)}</div>` : '';
  const user = log.performed_by_username ? `<div style="font-size:11px;color:#9aa8a0;font-style:italic;margin-top:3px;">👤 ${escHtml(log.performed_by_username)}</div>` : '';

  return `
    <div class="stock-log">
      <div class="log-head">
        <span>${icon} ${escHtml(label)}</span>
        <span class="log-time">${fmtDateTime(log.performed_at)}</span>
      </div>
      <div class="log-body">
        ${user}
        ${reason}
        ${changesHtml}
      </div>
    </div>
  `;
}

function maskStockVal(key, v){
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
}


/* ==================== RENDER: EDIT STOCK ==================== */
function renderStockEdit(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const s = StockMenu.selected;
  if (!s) { renderStockDashboard(); return; }

  stockEditPhotoData = s.photo_data || null;
  stockEditPhotoOriginal = s.photo_data || null;

  if (s.is_recipe_batch) {
    renderStockEditRecipe();
    return;
  }

  const currentYear = new Date().getFullYear();
  const isTHR = s.stock_type === 'THR';
  const isMilk = s.stock_type === 'MILK_POWDER';
  const isSugar = s.stock_type === 'SUGAR';
  const isSanitary = s.stock_type === 'SANITARY_NAPKINS';
  const isOthers = s.stock_type === 'OTHERS';

  root.innerHTML = `
    <div class="stock-header">
      <div>
        <h2>Edit Stock</h2>
        <div class="sub">${escHtml(stockTypeLabel(s.stock_type))}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="stock-main">
      <div class="stock-form-card">
        <form id="stockEditForm">

          <div class="detail-section-title">Stock Information</div>
          <div class="stock-form-grid">
            <div class="stock-field full">
              <label>Stock Type</label>
              <div class="locked-field" style="min-height:46px;">
                <span class="lock-value">${escHtml(stockTypeLabel(s.stock_type))}</span>
              </div>
              <div class="hint">Stock Type बदलने के लिए Delete करके नया entry बनाएँ।</div>
            </div>

            ${isMilk || isSugar || isSanitary || isOthers ? `
              <div class="stock-field full">
                <label for="itemName">Item Name ${(isMilk || isOthers) ? '<span class="req">*</span>' : ''}</label>
                <input type="text" id="itemName" value="${escHtml(s.item_name || '')}" ${(isMilk || isOthers) ? 'required' : ''}>
              </div>
            ` : ''}

            ${isTHR ? `
              <div class="stock-field">
                <label for="rationYear">Ration Year <span class="req">*</span></label>
                <select id="rationYear" required>
                  ${[currentYear-2, currentYear-1, currentYear, currentYear+1].map(y => `<option value="${y}" ${y === s.ration_year ? 'selected' : ''}>${y}</option>`).join('')}
                </select>
              </div>
              <div class="stock-field">
                <label for="rationMonth">Ration Month <span class="req">*</span></label>
                <select id="rationMonth" required>
                  ${MONTH_NAMES.slice(1).map((m, i) => `<option value="${i+1}" ${(i+1) === s.ration_month ? 'selected' : ''}>${m}</option>`).join('')}
                </select>
              </div>
              <div class="stock-field">
                <label for="quantity">Quantity (Packets) <span class="req">*</span></label>
                <input type="number" id="quantity" step="any" min="0.01" value="${s.quantity}" required>
              </div>
              <div class="stock-field">
                <label>Unit</label>
                <input type="text" value="Packets" readonly style="background:#f8f8fa;">
              </div>
            ` : ''}

            ${isMilk ? `
              <div class="stock-field">
                <label for="packets">Number of Packets <span class="req">*</span></label>
                <input type="number" id="packets" step="any" min="0.01" value="${s.packets || ''}" required>
              </div>
              <div class="stock-field">
                <label for="gramsPerPacket">Grams per Packet <span class="req">*</span></label>
                <input type="number" id="gramsPerPacket" step="any" min="0.01" value="${s.grams_per_packet || ''}" required>
              </div>
              <div class="stock-field">
                <label>Total Weight (Auto)</label>
                <div class="locked-field" style="min-height:46px;">
                  <span class="lock-value" id="milkTotalKg">${s.total_kg ? Number(s.total_kg).toFixed(3) + ' kg' : '—'}</span>
                </div>
              </div>
              <div class="stock-field">
                <label>Unit</label>
                <input type="text" value="Packets" readonly style="background:#f8f8fa;">
              </div>
            ` : ''}

            ${isSugar ? `
              <div class="stock-field">
                <label for="quantity">Quantity (grams) <span class="req">*</span></label>
                <input type="number" id="quantity" step="any" min="0.01" value="${s.quantity}" required>
                <div class="hint" id="sugarKg">= ${(s.quantity / 1000).toFixed(3)} kg</div>
              </div>
              <div class="stock-field">
                <label>Unit</label>
                <input type="text" value="grams" readonly style="background:#f8f8fa;">
              </div>
            ` : ''}

            ${isSanitary ? `
              <div class="stock-field">
                <label for="packets">Number of Packets <span class="req">*</span></label>
                <input type="number" id="packets" step="any" min="0.01" value="${s.packets || ''}" required>
              </div>
              <div class="stock-field">
                <label for="piecesPerPacket">Pieces per Packet <span class="req">*</span></label>
                <input type="number" id="piecesPerPacket" step="any" min="0.01" value="${s.pieces_per_packet || ''}" required>
              </div>
              <div class="stock-field">
                <label>Total Pieces (Auto)</label>
                <div class="locked-field" style="min-height:46px;">
                  <span class="lock-value" id="totalPieces">${s.total_pieces ? Number(s.total_pieces).toLocaleString('en-IN') + ' pieces' : '—'}</span>
                </div>
              </div>
              <div class="stock-field">
                <label>Unit</label>
                <input type="text" value="Packets" readonly style="background:#f8f8fa;">
              </div>
            ` : ''}

            ${isOthers ? `
              <div class="stock-field">
                <label for="quantity">Quantity <span class="req">*</span></label>
                <input type="number" id="quantity" step="any" min="0.01" value="${s.quantity}" required>
              </div>
              <div class="stock-field">
                <label for="unit">Unit <span class="req">*</span></label>
                <input type="text" id="unit" value="${escHtml(s.unit || '')}" required>
              </div>
            ` : ''}
          </div>

          <div class="detail-section-title" style="margin-top:22px;">Receipt Information</div>
          <div class="stock-form-grid">
            <div class="stock-field">
              <label for="billChallan">Bill / Challan No.</label>
              <input type="text" id="billChallan" value="${escHtml(s.bill_challan_no || '')}">
            </div>
            <div class="stock-field">
              <label for="billingDate">Billing Date</label>
              <input type="date" id="billingDate" value="${escHtml(s.billing_date || '')}">
            </div>
            <div class="stock-field">
              <label for="actualReceivedDate">Actual Received Date <span class="req">*</span></label>
              <input type="date" id="actualReceivedDate" value="${escHtml(s.actual_received_date || '')}" required>
            </div>
            <div class="stock-field">
              <label for="supplierName">Supplier Name</label>
              <input type="text" id="supplierName" value="${escHtml(s.supplier_name || '')}">
            </div>
            <div class="stock-field full">
              <label for="remarks">Remarks / Details</label>
              <textarea id="remarks" rows="2">${escHtml(s.remarks || '')}</textarea>
            </div>
          </div>

          <div class="stock-field full" style="margin-top:14px;">
            <label>📷 Bill / Challan Photo (optional)</label>
            <div class="thr-photo-row">
              <div class="thr-photo-preview" id="editStockPhotoPreview">${s.photo_data ? '<img src="' + s.photo_data + '">' : '📷'}</div>
              <div class="thr-photo-actions">
                <input type="file" id="editStockPhotoInput" accept="image/*">
                <button type="button" class="stock-btn stock-btn-secondary stock-btn-sm" id="editStockPhotoClear" style="display:${s.photo_data ? 'inline-flex' : 'none'};margin-top:6px;align-self:flex-start;">Remove Photo</button>
                <div class="hint" id="editStockPhotoStatus"></div>
              </div>
            </div>
          </div>

        <div id="formError" class="login-error" style="display:none;margin-top:14px;"></div>
          <div class="stock-actions">
            <button type="button" class="stock-btn stock-btn-secondary" id="cancelBtn">Cancel</button>
            <button type="submit" class="stock-btn stock-btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // ==================== AUTO-CALC ====================
  if (isMilk) {
    const pEl = document.getElementById('packets');
    const gEl = document.getElementById('gramsPerPacket');
    const kgEl = document.getElementById('milkTotalKg');
    function calcMilk(){
      const p = parseFloat(pEl.value) || 0;
      const g = parseFloat(gEl.value) || 0;
      if (p > 0 && g > 0) kgEl.textContent = ((p*g)/1000).toFixed(3) + ' kg (' + (p*g).toLocaleString('en-IN') + ' g)';
      else kgEl.textContent = '—';
    }
    pEl.addEventListener('input', calcMilk);
    gEl.addEventListener('input', calcMilk);
  }
  if (isSugar) {
    const qEl = document.getElementById('quantity');
    const kgEl = document.getElementById('sugarKg');
    qEl.addEventListener('input', () => {
      const g = parseFloat(qEl.value) || 0;
      kgEl.textContent = '= ' + (g/1000).toFixed(3) + ' kg';
    });
  }
  if (isSanitary) {
    const pEl = document.getElementById('packets');
    const pppEl = document.getElementById('piecesPerPacket');
    const tpEl = document.getElementById('totalPieces');
    function calcPieces(){
      const p = parseFloat(pEl.value) || 0;
      const ppp = parseFloat(pppEl.value) || 0;
      if (p > 0 && ppp > 0) tpEl.textContent = (p*ppp).toLocaleString('en-IN') + ' pieces';
      else tpEl.textContent = '—';
    }
    pEl.addEventListener('input', calcPieces);
    pppEl.addEventListener('input', calcPieces);
  }

  // ==================== NAVIGATION ====================
  document.getElementById('backBtn').addEventListener('click', () => {
    StockMenu.view = 'detail';
    renderStockDetail();
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    StockMenu.view = 'detail';
    renderStockDetail();
  });

  // ==================== PHOTO HANDLERS ====================
  {
    const inp = document.getElementById('editStockPhotoInput');
    const prev = document.getElementById('editStockPhotoPreview');
    const clr = document.getElementById('editStockPhotoClear');
    const stat = document.getElementById('editStockPhotoStatus');
    if (inp) {
      inp.addEventListener('change', function(evt){
        var f = evt.target.files[0];
        if (!f) return;
        if (f.size > 3 * 1024 * 1024) {
          if (stat) { stat.textContent = 'Photo बहुत बड़ी है (max 3 MB)।'; stat.style.color = 'var(--rr-coral)'; }
          inp.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function(e2){
          stockEditPhotoData = e2.target.result;
          if (prev) prev.innerHTML = '<img src="' + stockEditPhotoData + '" style="width:100%;height:100%;object-fit:cover;">';
          if (clr) clr.style.display = 'inline-flex';
          if (stat) { stat.textContent = '✓ नई photo ready — Save दबाइए'; stat.style.color = 'var(--rr-green)'; }
        };
        reader.onerror = function(){
          if (stat) { stat.textContent = 'Photo पढ़ी नहीं जा सकी'; stat.style.color = 'var(--rr-coral)'; }
        };
        reader.readAsDataURL(f);
      });
      if (clr) {
        clr.addEventListener('click', function(){
          stockEditPhotoData = null;
          inp.value = '';
          if (prev) prev.innerHTML = '📷';
          clr.style.display = 'none';
          if (stat) { stat.textContent = 'Photo हटा दी गई — Save दबाइए'; stat.style.color = 'var(--rr-coral)'; }
        });
      }
    }
  }

  // ==================== SUBMIT ====================
  document.getElementById('stockEditForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('formError');
    errDiv.style.display = 'none';

    const actualDate = document.getElementById('actualReceivedDate').value;
    if (!actualDate) { errDiv.textContent = 'Actual received date is required.'; errDiv.style.display = 'block'; return; }

    const payload = {
      stock_type: s.stock_type,
      bill_challan_no: document.getElementById('billChallan').value.trim() || null,
      billing_date: document.getElementById('billingDate').value || null,
      actual_received_date: actualDate,
      supplier_name: document.getElementById('supplierName').value.trim() || null,
      remarks: document.getElementById('remarks').value.trim() || null,
      photo_data: stockEditPhotoData
    };

    if (isTHR) {
      const q = parseFloat(document.getElementById('quantity').value);
      if (!q || q <= 0) { errDiv.textContent = 'Quantity must be greater than zero.'; errDiv.style.display = 'block'; return; }
      payload.quantity = q;
      payload.unit = 'Packets';
      payload.ration_year = parseInt(document.getElementById('rationYear').value);
      payload.ration_month = parseInt(document.getElementById('rationMonth').value);
      payload.year = payload.ration_year;
    } else if (isMilk) {
      const name = document.getElementById('itemName').value.trim();
      if (!name) { errDiv.textContent = 'Item name is required.'; errDiv.style.display = 'block'; return; }
      const p = parseFloat(document.getElementById('packets').value);
      const gpp = parseFloat(document.getElementById('gramsPerPacket').value);
      if (!p || p <= 0) { errDiv.textContent = 'Packets must be greater than zero.'; errDiv.style.display = 'block'; return; }
      if (!gpp || gpp <= 0) { errDiv.textContent = 'Grams per packet must be greater than zero.'; errDiv.style.display = 'block'; return; }
      payload.item_name = name;
      payload.quantity = p;
      payload.unit = 'Packets';
      payload.packets = p;
      payload.grams_per_packet = gpp;
    } else if (isSugar) {
      const q = parseFloat(document.getElementById('quantity').value);
      if (!q || q <= 0) { errDiv.textContent = 'Quantity must be greater than zero.'; errDiv.style.display = 'block'; return; }
      payload.item_name = document.getElementById('itemName').value.trim() || 'Sugar';
      payload.quantity = q;
      payload.unit = 'grams';
    } else if (isSanitary) {
      const p = parseFloat(document.getElementById('packets').value);
      const ppp = parseFloat(document.getElementById('piecesPerPacket').value);
      if (!p || p <= 0) { errDiv.textContent = 'Packets must be greater than zero.'; errDiv.style.display = 'block'; return; }
      if (!ppp || ppp <= 0) { errDiv.textContent = 'Pieces per packet must be greater than zero.'; errDiv.style.display = 'block'; return; }
      payload.item_name = document.getElementById('itemName').value.trim() || 'Sanitary Napkins';
      payload.quantity = p;
      payload.unit = 'Packets';
      payload.packets = p;
      payload.pieces_per_packet = ppp;
    } else if (isOthers) {
      const name = document.getElementById('itemName').value.trim();
      if (!name) { errDiv.textContent = 'Item name is required.'; errDiv.style.display = 'block'; return; }
      const q = parseFloat(document.getElementById('quantity').value);
      if (!q || q <= 0) { errDiv.textContent = 'Quantity must be greater than zero.'; errDiv.style.display = 'block'; return; }
      const unit = document.getElementById('unit').value.trim();
      if (!unit) { errDiv.textContent = 'Unit is required.'; errDiv.style.display = 'block'; return; }
      payload.item_name = name;
      payload.quantity = q;
      payload.unit = unit;
    }

    try {
      const res = await api('/api/admin/stock/' + s.id, { method: 'PATCH', body: payload });
      if (res.changed === false) {
        showToast('No changes to save.', 'info');
      } else {
        showToast('Stock edited successfully', 'success');
      }
      await stockLoadDetail(s.id);
      StockMenu.view = 'detail';
      renderStockDetail();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}


/* ==================== MODAL: DELETE ==================== */
function showStockDeleteDialog(){
  const s = StockMenu.selected;
  if (!s) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal">
      <div class="warn-icon">🗑</div>
      <h3>Delete Stock Entry</h3>
      <p>
        <b>${escHtml(s.item_name || stockTypeShort(s.stock_type))}</b><br>
        Quantity: <b>${fmtNumber(s.quantity, 3)} ${escHtml(s.unit || '')}</b><br>
        Received: ${fmtBeneDate(s.actual_received_date)}
        <br><br>
        यह entry हटा दी जाएगी। History बनी रहेगी, और बाद में recover की जा सकती है।
      </p>

      <div class="family-field">
        <label for="delReason">Delete Reason <span class="req">*</span></label>
        <input type="text" id="delReason" placeholder="Reason बताएँ (जैसे: Wrong entry, Duplicate)">
      </div>

      <div id="delError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="delCancel">Cancel</button>
        <button class="family-btn family-btn-danger" id="delOk">Delete Stock</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#delCancel').addEventListener('click', () => document.body.removeChild(backdrop));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) document.body.removeChild(backdrop); });

  backdrop.querySelector('#delOk').addEventListener('click', async () => {
    const errEl = backdrop.querySelector('#delError');
    errEl.style.display = 'none';
    const reason = backdrop.querySelector('#delReason').value.trim();
    if (!reason) { errEl.textContent = 'Delete reason ज़रूरी है।'; errEl.style.display = 'block'; return; }

    try {
      const res = await api('/api/admin/stock/' + s.id + '/delete', {
        method: 'POST',
        body: { reason: reason }
      });
      document.body.removeChild(backdrop);
      showToast(res.message || 'Stock deleted successfully', 'success');
      await Promise.all([stockLoadSummary(), stockLoadList()]);
      StockMenu.view = 'dashboard';
      StockMenu.selected = null;
      renderStockDashboard();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}


/* ==================== MODAL: PERMANENT DELETE ==================== */
function showStockPermanentDeleteDialog(){
  const s = StockMenu.selected;
  if (!s) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal">
      <div class="warn-icon">⚠️</div>
      <h3>Permanent Delete</h3>
      <p style="color:#b0271f;font-weight:700;">
        यह action पूरी तरह undo नहीं हो सकता!<br>
        Record हमेशा के लिए हटा दिया जाएगा।
      </p>
      <p>
        <b>${escHtml(s.item_name || stockTypeShort(s.stock_type))}</b><br>
        Quantity: ${fmtNumber(s.quantity, 3)} ${escHtml(s.unit || '')}<br>
        Received: ${fmtBeneDate(s.actual_received_date)}
      </p>

      <div class="family-field">
        <label for="pdelConfirm">Type "DELETE" to confirm <span class="req">*</span></label>
        <input type="text" id="pdelConfirm" placeholder="DELETE" autocomplete="off">
      </div>

      <div class="family-field">
        <label for="pdelReason">Reason</label>
        <input type="text" id="pdelReason" placeholder="Reason (optional)">
      </div>

      <div id="pdelError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="pdelCancel">Cancel</button>
        <button class="family-btn family-btn-danger" id="pdelOk">Permanently Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.querySelector('#pdelCancel').addEventListener('click', () => document.body.removeChild(backdrop));
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) document.body.removeChild(backdrop); });

  backdrop.querySelector('#pdelOk').addEventListener('click', async () => {
    const errEl = backdrop.querySelector('#pdelError');
    errEl.style.display = 'none';
    const confirm = backdrop.querySelector('#pdelConfirm').value.trim();
    if (confirm !== 'DELETE') { errEl.textContent = 'Type DELETE to confirm.'; errEl.style.display = 'block'; return; }
    const reason = backdrop.querySelector('#pdelReason').value.trim() || 'Permanent delete';

    try {
      const res = await api('/api/admin/stock/' + s.id + '/permanent-delete', {
        method: 'POST',
        body: { confirm: 'DELETE', reason: reason }
      });
      document.body.removeChild(backdrop);
      showToast(res.message || 'Stock permanently deleted successfully', 'success');
      await Promise.all([stockLoadSummary(), stockLoadList()]);
      StockMenu.view = 'dashboard';
      StockMenu.selected = null;
      renderStockDashboard();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}


/* ==================== RENDER: LOGS PAGE ==================== */
function renderStockLogsPage(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="stock-header">
      <div>
        <h2>Stock Logs</h2>
        <div class="sub">All stock activity history</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="stock-main">
      <div class="stock-filter-row">
        <button class="stock-chip active" data-type="">All Types</button>
        ${STOCK_TYPES.map(t => `<button class="stock-chip" data-type="${t.code}">${escHtml(t.short)}</button>`).join('')}
      </div>
      <div id="logListContainer">
        <p style="color:var(--rr-muted);font-size:13px;text-align:center;padding:20px;">Loading...</p>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    StockMenu.view = 'dashboard';
    stockLoadSummary().then(renderStockDashboard).catch(e => showToast(e.message, 'error'));
  });

  let currentType = '';
  function loadLogs(){
    const url = currentType
      ? '/api/admin/stock/logs/all?type=' + encodeURIComponent(currentType)
      : '/api/admin/stock/logs/all';
    api(url).then(data => {
      const container = document.getElementById('logListContainer');
      const logs = data.logs || [];
      if (!logs.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📜</div><div class="empty-title">No stock logs yet.</div></div>';
        return;
      }
      container.innerHTML = logs.map(l => renderStockLogFull(l)).join('');
    }).catch(e => showToast(e.message, 'error'));
  }

  root.querySelectorAll('.stock-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      root.querySelectorAll('.stock-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentType = chip.dataset.type;
      loadLogs();
    });
  });

  loadLogs();
}


function renderStockLogFull(log){
  const icons = { 'ADD': '➕', 'EDIT': '✎', 'DELETE': '🗑', 'RECOVER': '↺', 'PERMANENT_DELETE': '❌' };
  const labels = { 'ADD': 'Added', 'EDIT': 'Edited', 'DELETE': 'Deleted', 'RECOVER': 'Recovered', 'PERMANENT_DELETE': 'Permanently Deleted' };
  const icon = icons[log.action] || '•';
  const label = labels[log.action] || log.action;

  let changesHtml = '';
  if (log.action === 'EDIT' && log.old_values_json) {
    try {
      const oldV = JSON.parse(log.old_values_json);
      const rows = [];
      Object.keys(oldV).forEach(k => {
        const e = oldV[k];
        if (!e || typeof e !== 'object') return;
        const lab = STOCK_FIELD_LABELS[k] || k;
        const o = e.old === null || e.old === undefined || e.old === '' ? '—' : String(e.old);
        const n = e.new === null || e.new === undefined || e.new === '' ? '—' : String(e.new);
        if (o === n) return;
        rows.push(`<div class="chg"><b>${escHtml(lab)}:</b> <span class="old">${escHtml(o)}</span> <span class="arrow">→</span> <span class="new">${escHtml(n)}</span></div>`);
      });
      if (rows.length) changesHtml = `<details><summary>Changes (${rows.length})</summary><div class="log-changes">${rows.join('')}</div></details>`;
    } catch (e) {}
  } else if (log.action === 'ADD' && log.new_values_json) {
    try {
      const nv = JSON.parse(log.new_values_json);
      const rows = [];
      Object.keys(nv).forEach(k => {
        const v = nv[k];
        if (v === null || v === undefined || v === '') return;
        const lab = STOCK_FIELD_LABELS[k] || k;
        rows.push(`<div class="chg"><b>${escHtml(lab)}:</b> <span class="new">${escHtml(String(v))}</span></div>`);
      });
      if (rows.length) changesHtml = `<details><summary>Details (${rows.length})</summary><div class="log-changes">${rows.join('')}</div></details>`;
    } catch (e) {}
  }

  const typeLabel = log.stock_type ? stockTypeShort(log.stock_type) : '';
  const reason = log.reason ? `<div style="margin-top:3px;font-style:italic;">Reason: ${escHtml(log.reason)}</div>` : '';
  const user = log.performed_by_username ? `<div style="font-size:11px;color:#9aa8a0;font-style:italic;margin-top:3px;">👤 ${escHtml(log.performed_by_username)}</div>` : '';

  return `
    <div class="stock-log">
      <div class="log-head">
        <span>${icon} ${escHtml(label)} ${typeLabel ? '<span style="font-weight:600;font-size:12px;color:var(--rr-muted);">· ' + escHtml(typeLabel) + '</span>' : ''}</span>
        <span class="log-time">${fmtDateTime(log.performed_at)}</span>
      </div>
      <div class="log-body">
        ${user}
        ${reason}
        ${changesHtml}
      </div>
    </div>
  `;
}
