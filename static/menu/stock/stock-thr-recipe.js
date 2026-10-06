/* ==================== THR MULTI-CATEGORY FORM (v2) ==================== */

let THRRecipeMaster = null;
let THRMultiState = {
  PREGNANT: {},
  LACTATING: {},
  CHILD_6_36: {},
  CHILD_36_72: {}
};
let THRPhotoData = null;

async function loadTHRRecipeMaster(){
  if (THRRecipeMaster) return THRRecipeMaster;
  const data = await api('/api/admin/stock/thr-recipe-master');
  THRRecipeMaster = data.master || {};
  return THRRecipeMaster;
}

const THR_CAT_META = [
  { code: 'PREGNANT',    label: 'Pregnant Women',    icon: '🤰' },
  { code: 'LACTATING',   label: 'Lactating Mothers', icon: '🤱' },
  { code: 'CHILD_6_36',  label: '6 Months–3 Years',  icon: '🧒' },
  { code: 'CHILD_36_72', label: '3–6 Years',         icon: '🧑' }
];

function renderTHRRecipeForm(){
  const container = document.getElementById('categoryFields');
  if (!container) return;

  // Hide outer form's duplicate sections
  const outerReceipt = document.getElementById('outerReceiptSection');
  const outerActions = document.getElementById('outerFormActions');
  if (outerReceipt) outerReceipt.style.display = 'none';
  if (outerActions) outerActions.style.display = 'none';

  if (!THRRecipeMaster) {
    container.innerHTML = '<p style="color:var(--rr-muted);font-size:13px;">Loading recipes...</p>';
    loadTHRRecipeMaster().then(() => {
      THRMultiState = { PREGNANT:{}, LACTATING:{}, CHILD_6_36:{}, CHILD_36_72:{} };
      renderTHRRecipeForm();
    });
    return;
  }

  const today = new Date().toISOString().slice(0,10);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  container.innerHTML = `
    <div class="detail-section-title" style="margin-top:22px;">THR Stock Details</div>
    <div class="stock-form-grid" style="margin-bottom:14px;">
      <div class="stock-field">
        <label for="rationYear">Ration Year <span class="req">*</span></label>
        <select id="rationYear" required>
          ${[currentYear-1, currentYear, currentYear+1].map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>
      <div class="stock-field">
        <label for="rationMonth">Ration Month <span class="req">*</span></label>
        <select id="rationMonth" required>
          ${MONTH_NAMES.slice(1).map((m, i) => `<option value="${i+1}" ${i+1 === currentMonth ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="detail-section-title" style="margin-top:8px;">चारों Categories के Recipes भरें</div>
    <p style="font-size:12px;color:var(--rr-muted);margin:0 0 14px;font-weight:600;">
      एक ही bill में सभी categories की packet quantities भरें। जिस category में stock नहीं आया, उसे 0 छोड़ दें।
    </p>

    <div id="thrAllCategories"></div>

    <div id="thrSummaryArea" style="margin-top:18px;"></div>

    <div class="detail-section-title" style="margin-top:22px;">Bill / Challan Details</div>
    <div class="stock-form-grid">
      <div class="stock-field">
        <label for="thrBillChallan">Bill / Challan No.</label>
        <input type="text" id="thrBillChallan">
      </div>
      <div class="stock-field">
        <label for="thrBillingDate">Billing Date</label>
        <input type="date" id="thrBillingDate">
      </div>
      <div class="stock-field">
        <label for="thrActualReceivedDate">Actual Received Date <span class="req">*</span></label>
        <input type="date" id="thrActualReceivedDate" value="${today}" required>
      </div>
      <div class="stock-field">
        <label for="thrSupplierName">Supplier Name</label>
        <input type="text" id="thrSupplierName">
      </div>
      <div class="stock-field full">
        <label for="thrRemarks">Remarks / Details</label>
        <textarea id="thrRemarks" rows="2"></textarea>
      </div>

      <div class="stock-field full">
        <label>📷 Bill / Challan Photo (optional)</label>
        <div class="thr-photo-row">
          <div class="thr-photo-preview" id="thrPhotoPreview">📷</div>
          <div class="thr-photo-actions">
            <input type="file" id="thrPhotoInput" accept="image/*">
            <button type="button" class="stock-btn stock-btn-secondary stock-btn-sm" id="thrPhotoClear" style="display:none;margin-top:6px;align-self:flex-start;">Remove Photo</button>
            <div class="hint" id="thrPhotoStatus"></div>
          </div>
        </div>
      </div>
    </div>

    <div id="thrFormError" class="login-error" style="display:none;margin-top:14px;"></div>
    <div class="stock-actions">
      <button type="button" class="stock-btn stock-btn-secondary" id="thrCancelBtn">Cancel</button>
      <button type="button" class="stock-btn stock-btn-primary" id="thrSaveBtn">Save THR Stock</button>
    </div>
  `;

  // Render all 4 categories
  const allArea = document.getElementById('thrAllCategories');
  THR_CAT_META.forEach(cat => {
    const recipes = THRRecipeMaster[cat.code] || [];
    if (!recipes.length) return;

    // Initialize state
    recipes.forEach(r => {
      if (THRMultiState[cat.code][r.name] === undefined) {
        THRMultiState[cat.code][r.name] = 0;
      }
    });

    const catBlock = document.createElement('div');
    catBlock.className = 'thr-cat-block';
    catBlock.innerHTML = `
      <div class="thr-cat-block-head">
        <span class="thr-cat-block-icon">${cat.icon}</span>
        <span class="thr-cat-block-label">${cat.label}</span>
        <span class="thr-cat-block-total" id="thrCatTotal-${cat.code}">0 pkt</span>
      </div>
      <div class="thr-recipe-table">
        <div class="thr-recipe-head">
          <div>Recipe Item</div>
          <div>Weight</div>
          <div>Packets</div>
          <div>Total</div>
        </div>
        ${recipes.map((r, i) => `
          <div class="thr-recipe-row">
            <div class="thr-recipe-name">${escHtml(r.name)}</div>
            <div class="thr-recipe-weight">${r.weight} g</div>
            <div class="thr-recipe-pkts">
              <input type="number" min="0" step="1" data-cat="${cat.code}" data-recipe="${escHtml(r.name)}" data-weight="${r.weight}" class="thr-pkt-input" value="${THRMultiState[cat.code][r.name] || 0}">
            </div>
            <div class="thr-recipe-total" id="thrLineTotal-${cat.code}-${i}">0 g</div>
          </div>
        `).join('')}
      </div>
    `;
    allArea.appendChild(catBlock);
  });

  // Update line totals initially
  updateAllTHRTotals();

  // Bind inputs
  container.querySelectorAll('.thr-pkt-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const cat = inp.dataset.cat;
      const name = inp.dataset.recipe;
      const pk = parseFloat(inp.value) || 0;
      THRMultiState[cat][name] = pk;
      updateAllTHRTotals();
    });
  });

  // Photo
  const photoInput = document.getElementById('thrPhotoInput');
  const photoPreview = document.getElementById('thrPhotoPreview');
  const photoClear = document.getElementById('thrPhotoClear');
  const photoStatus = document.getElementById('thrPhotoStatus');

  photoInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) {
      photoStatus.textContent = 'Photo बहुत बड़ी है (max 3 MB)।';
      photoStatus.style.color = 'var(--rr-coral)';
      photoInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      THRPhotoData = ev.target.result;
      photoPreview.innerHTML = '<img src="' + THRPhotoData + '" alt="">';
      photoClear.style.display = 'inline-flex';
      photoStatus.textContent = '✓ Photo ready';
      photoStatus.style.color = 'var(--rr-green)';
    };
    reader.readAsDataURL(f);
  });

  photoClear.addEventListener('click', () => {
    THRPhotoData = null;
    photoInput.value = '';
    photoPreview.innerHTML = '📷';
    photoClear.style.display = 'none';
    photoStatus.textContent = '';
  });

  // Cancel
  document.getElementById('thrCancelBtn').addEventListener('click', () => {
    THRMultiState = { PREGNANT:{}, LACTATING:{}, CHILD_6_36:{}, CHILD_36_72:{} };
    THRPhotoData = null;
    StockMenu.view = 'dashboard';
    StockMenu.type = '';
    stockLoadSummary().then(renderStockDashboard).catch(e => showToast(e.message, 'error'));
  });

  // Save
  document.getElementById('thrSaveBtn').addEventListener('click', async () => {
    const errDiv = document.getElementById('thrFormError');
    errDiv.style.display = 'none';

    // Collect categories with data
    const categories = [];
    THR_CAT_META.forEach(cat => {
      const lines = [];
      const recipes = THRRecipeMaster[cat.code] || [];
      recipes.forEach(r => {
        const pk = THRMultiState[cat.code][r.name] || 0;
        if (pk > 0) {
          lines.push({ recipe_name: r.name, packets: pk });
        }
      });
      if (lines.length) {
        categories.push({ category: cat.code, lines: lines });
      }
    });

    if (!categories.length) {
      errDiv.textContent = 'कम से कम एक category में packet quantity भरें।';
      errDiv.style.display = 'block';
      return;
    }

    const ry = document.getElementById('rationYear').value;
    const rm = document.getElementById('rationMonth').value;
    const actualDate = document.getElementById('thrActualReceivedDate').value;
    if (!actualDate) {
      errDiv.textContent = 'Actual received date is required.';
      errDiv.style.display = 'block';
      return;
    }

    const payload = {
      ration_year: parseInt(ry),
      ration_month: parseInt(rm),
      actual_received_date: actualDate,
      bill_challan_no: document.getElementById('thrBillChallan').value.trim() || null,
      billing_date: document.getElementById('thrBillingDate').value || null,
      supplier_name: document.getElementById('thrSupplierName').value.trim() || null,
      remarks: document.getElementById('thrRemarks').value.trim() || null,
      photo_data: THRPhotoData,
      categories: categories
    };

    try {
      const res = await api('/api/admin/stock/thr-multi', { method: 'POST', body: payload });
      showToast(res.message || 'THR stock saved', 'success');
      THRMultiState = { PREGNANT:{}, LACTATING:{}, CHILD_6_36:{}, CHILD_36_72:{} };
      THRPhotoData = null;
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


function updateAllTHRTotals(){
  if (!THRRecipeMaster) return;
  let grandPkts = 0;
  let grandGrams = 0;

  THR_CAT_META.forEach(cat => {
    const recipes = THRRecipeMaster[cat.code] || [];
    let catPkts = 0;
    recipes.forEach((r, i) => {
      const pk = THRMultiState[cat.code][r.name] || 0;
      const tg = pk * r.weight;
      catPkts += pk;
      grandPkts += pk;
      grandGrams += tg;
      const el = document.getElementById('thrLineTotal-' + cat.code + '-' + i);
      if (el) el.textContent = tg ? tg.toLocaleString('en-IN') + ' g' : '0 g';
    });
    const catEl = document.getElementById('thrCatTotal-' + cat.code);
    if (catEl) catEl.textContent = catPkts + ' pkt';
  });

  const summaryArea = document.getElementById('thrSummaryArea');
  if (summaryArea) {
    summaryArea.innerHTML = `
      <div class="thr-recipe-summary">
        <div class="thr-sum-item">
          <span class="label">Total Packets</span>
          <span class="value">${grandPkts}</span>
        </div>
        <div class="thr-sum-item">
          <span class="label">Total Grams</span>
          <span class="value">${grandGrams.toLocaleString('en-IN')} g</span>
        </div>
        <div class="thr-sum-item">
          <span class="label">Total Kg</span>
          <span class="value">${(grandGrams/1000).toFixed(3)} kg</span>
        </div>
      </div>
    `;
  }
}


/* ==================== EDIT THR RECIPE BATCH ==================== */
let THREditPhotoData = null;

async function renderStockEditRecipe(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const s = StockMenu.selected;
  if (!s) { renderStockDashboard(); return; }

  // Load recipe lines
  let recipes = [];
  try {
    const data = await api('/api/admin/stock/' + s.id + '/recipes');
    recipes = data.recipes || [];
  } catch (e) {
    showToast(e.message, 'error');
    return;
  }

  THREditPhotoData = s.photo_data || null;

  const currentYear = new Date().getFullYear();
  const catMeta = {
    'PREGNANT': { label: 'Pregnant Women', icon: '🤰' },
    'LACTATING': { label: 'Lactating Mothers', icon: '🤱' },
    'CHILD_6_36': { label: '6 Months–3 Years', icon: '🧒' },
    'CHILD_36_72': { label: '3–6 Years', icon: '🧑' }
  };

  // Group by category
  const grouped = {};
  recipes.forEach(r => {
    const c = r.category || 'UNKNOWN';
    if (!grouped[c]) grouped[c] = [];
    grouped[c].push(r);
  });

  root.innerHTML = `
    <div class="stock-header">
      <div>
        <h2>Edit THR Stock</h2>
        <div class="sub">#${s.id} · ${escHtml(MONTH_NAMES[s.ration_month] || '')} ${s.ration_year}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="stock-main">
      <div class="stock-form-card">

        <div class="detail-section-title">Ration Period</div>
        <div class="stock-form-grid">
          <div class="stock-field">
            <label>Ration Year</label>
            <input type="text" value="${s.ration_year}" readonly style="background:#f8f8fa;">
          </div>
          <div class="stock-field">
            <label>Ration Month</label>
            <input type="text" value="${escHtml(MONTH_NAMES[s.ration_month] || '')}" readonly style="background:#f8f8fa;">
          </div>
        </div>

        <div class="detail-section-title" style="margin-top:22px;">Recipe Quantities</div>
        <p style="font-size:12px;color:var(--rr-muted);margin:0 0 14px;font-weight:600;">
          Categories fixed रहेंगी। सिर्फ packet quantities बदल सकते हैं।
        </p>

        <div id="thrEditCategories"></div>

        <div id="thrEditSummary" style="margin-top:18px;"></div>

        <div class="detail-section-title" style="margin-top:22px;">Bill / Challan Details</div>
        <div class="stock-form-grid">
          <div class="stock-field">
            <label for="editBillChallan">Bill / Challan No.</label>
            <input type="text" id="editBillChallan" value="${escHtml(s.bill_challan_no || '')}">
          </div>
          <div class="stock-field">
            <label for="editBillingDate">Billing Date</label>
            <input type="date" id="editBillingDate" value="${escHtml(s.billing_date || '')}">
          </div>
          <div class="stock-field">
            <label for="editActualDate">Actual Received Date <span class="req">*</span></label>
            <input type="date" id="editActualDate" value="${escHtml(s.actual_received_date || '')}" required>
          </div>
          <div class="stock-field">
            <label for="editSupplier">Supplier Name</label>
            <input type="text" id="editSupplier" value="${escHtml(s.supplier_name || '')}">
          </div>
          <div class="stock-field full">
            <label for="editRemarks">Remarks / Details</label>
            <textarea id="editRemarks" rows="2">${escHtml(s.remarks || '')}</textarea>
          </div>

          <div class="stock-field full">
            <label>📷 Bill / Challan Photo (optional)</label>
            <div class="thr-photo-row">
              <div class="thr-photo-preview" id="editPhotoPreview">${THREditPhotoData ? '<img src="' + THREditPhotoData + '">' : '📷'}</div>
              <div class="thr-photo-actions">
                <input type="file" id="editPhotoInput" accept="image/*">
                <button type="button" class="stock-btn stock-btn-secondary stock-btn-sm" id="editPhotoClear" style="display:${THREditPhotoData ? 'inline-flex' : 'none'};margin-top:6px;align-self:flex-start;">Remove Photo</button>
                <div class="hint" id="editPhotoStatus"></div>
              </div>
            </div>
          </div>
        </div>

        <div id="editFormError" class="login-error" style="display:none;margin-top:14px;"></div>
        <div class="stock-actions">
          <button type="button" class="stock-btn stock-btn-secondary" id="editCancelBtn">Cancel</button>
          <button type="button" class="stock-btn stock-btn-primary" id="editSaveBtn">Save Changes</button>
        </div>

      </div>
    </div>
  `;

  // Render categories with recipe rows
  const catArea = document.getElementById('thrEditCategories');
  Object.keys(grouped).forEach(cat => {
    const meta = catMeta[cat] || { label: cat, icon: '📦' };
    const lines = grouped[cat];
    const block = document.createElement('div');
    block.className = 'thr-cat-block';
    block.innerHTML = `
      <div class="thr-cat-block-head">
        <span class="thr-cat-block-icon">${meta.icon}</span>
        <span class="thr-cat-block-label">${escHtml(meta.label)}</span>
        <span class="thr-cat-block-total" id="editCatTot-${cat}">0 pkt</span>
      </div>
      <div class="thr-recipe-table">
        <div class="thr-recipe-head">
          <div>Recipe Item</div>
          <div>Weight</div>
          <div>Packets</div>
          <div>Total</div>
        </div>
        ${lines.map((r, i) => `
          <div class="thr-recipe-row">
            <div class="thr-recipe-name">${escHtml(r.recipe_name)}</div>
            <div class="thr-recipe-weight">${r.packet_weight_grams} g</div>
            <div class="thr-recipe-pkts">
              <input type="number" min="0" step="1" class="thr-edit-pkt" data-cat="${cat}" data-line-idx="${i}" data-weight="${r.packet_weight_grams}" data-name="${escHtml(r.recipe_name)}" value="${r.packets}">
            </div>
            <div class="thr-recipe-total" id="editLine-${cat}-${i}">0 g</div>
          </div>
        `).join('')}
      </div>
    `;
    catArea.appendChild(block);
  });

  function updateEditTotals(){
    let grandPkts = 0, grandGrams = 0;
    Object.keys(grouped).forEach(cat => {
      const lines = grouped[cat];
      let catPkts = 0;
      lines.forEach((r, i) => {
        const inp = document.querySelector('.thr-edit-pkt[data-cat="' + cat + '"][data-line-idx="' + i + '"]');
        const pk = parseFloat(inp.value) || 0;
        const tg = pk * r.packet_weight_grams;
        catPkts += pk;
        grandPkts += pk;
        grandGrams += tg;
        const el = document.getElementById('editLine-' + cat + '-' + i);
        if (el) el.textContent = tg ? tg.toLocaleString('en-IN') + ' g' : '0 g';
      });
      const catEl = document.getElementById('editCatTot-' + cat);
      if (catEl) catEl.textContent = catPkts + ' pkt';
    });
    const sumEl = document.getElementById('thrEditSummary');
    if (sumEl) {
      sumEl.innerHTML = `
        <div class="thr-recipe-summary">
          <div class="thr-sum-item"><span class="label">Total Packets</span><span class="value">${grandPkts}</span></div>
          <div class="thr-sum-item"><span class="label">Total Grams</span><span class="value">${grandGrams.toLocaleString('en-IN')} g</span></div>
          <div class="thr-sum-item"><span class="label">Total Kg</span><span class="value">${(grandGrams/1000).toFixed(3)} kg</span></div>
        </div>
      `;
    }
  }

  document.querySelectorAll('.thr-edit-pkt').forEach(inp => {
    inp.addEventListener('input', updateEditTotals);
  });
  updateEditTotals();

  // Photo handlers
  const photoInput = document.getElementById('editPhotoInput');
  const photoPreview = document.getElementById('editPhotoPreview');
  const photoClear = document.getElementById('editPhotoClear');
  const photoStatus = document.getElementById('editPhotoStatus');

  photoInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) {
      photoStatus.textContent = 'Photo बहुत बड़ी है (max 3 MB)।';
      photoStatus.style.color = 'var(--rr-coral)';
      photoInput.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      THREditPhotoData = ev.target.result;
      photoPreview.innerHTML = '<img src="' + THREditPhotoData + '">';
      photoClear.style.display = 'inline-flex';
      photoStatus.textContent = '✓ Photo ready';
      photoStatus.style.color = 'var(--rr-green)';
    };
    reader.readAsDataURL(f);
  });

  photoClear.addEventListener('click', () => {
    THREditPhotoData = null;
    photoInput.value = '';
    photoPreview.innerHTML = '📷';
    photoClear.style.display = 'none';
    photoStatus.textContent = '';
  });

  // Nav
  document.getElementById('backBtn').addEventListener('click', () => {
    StockMenu.view = 'detail';
    renderStockDetail();
  });
  document.getElementById('editCancelBtn').addEventListener('click', () => {
    StockMenu.view = 'detail';
    renderStockDetail();
  });

  // Save
  document.getElementById('editSaveBtn').addEventListener('click', async () => {
    const errDiv = document.getElementById('editFormError');
    errDiv.style.display = 'none';

    const lines = [];
    Object.keys(grouped).forEach(cat => {
      grouped[cat].forEach((r, i) => {
        const inp = document.querySelector('.thr-edit-pkt[data-cat="' + cat + '"][data-line-idx="' + i + '"]');
        const pk = parseFloat(inp.value) || 0;
        lines.push({
          category: cat,
          recipe_name: r.recipe_name,
          packet_weight_grams: r.packet_weight_grams,
          packets: pk
        });
      });
    });

    const actualDate = document.getElementById('editActualDate').value;
    if (!actualDate) { errDiv.textContent = 'Actual received date is required.'; errDiv.style.display = 'block'; return; }

    const payload = {
      actual_received_date: actualDate,
      bill_challan_no: document.getElementById('editBillChallan').value.trim() || null,
      billing_date: document.getElementById('editBillingDate').value || null,
      supplier_name: document.getElementById('editSupplier').value.trim() || null,
      remarks: document.getElementById('editRemarks').value.trim() || null,
      photo_data: THREditPhotoData,
      lines: lines
    };

    try {
      const res = await api('/api/admin/stock/' + s.id + '/edit-recipe', { method: 'POST', body: payload });
      showToast(res.message || 'THR stock updated successfully', 'success');
      await stockLoadDetail(s.id);
      StockMenu.view = 'detail';
      renderStockDetail();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}
