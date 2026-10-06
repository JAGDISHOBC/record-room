/* ==================== ATTENDANCE MENU ==================== */

const AttendanceMenu = {
  view: 'attendance',     // attendance | calendar
  date: '',
  year: 0,
  month: 0,
  children: [],
  isSunday: false,
  holiday: null,
  total: 0,
  present: 0,
  absent: 0,
  notMarked: 0,
  summary: null,
  days: [],
  locked: false
};

const HolidayMenu = {
  view: 'list',           // list | add | edit | logs
  status: 'ACTIVE',
  search: '',
  holidays: [],
  selected: null,
  logs: []
};

function attToday(){
  const d = new Date();
  return d.toISOString().slice(0,10);
}

function attFmtDate(iso){
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  const pad = n => String(n).padStart(2,'0');
  return pad(d.getDate()) + '/' + pad(d.getMonth()+1) + '/' + d.getFullYear();
}

function attFmtDay(iso){
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return days[d.getDay()] || '';
}

/* ==================== ATTENDANCE API ==================== */
async function attLoadEligible(dateStr){
  const data = await api('/api/admin/attendance/eligible?date=' + encodeURIComponent(dateStr));
  AttendanceMenu.children = data.children || [];
  AttendanceMenu.total = data.total || 0;
  AttendanceMenu.present = data.present || 0;
  AttendanceMenu.absent = data.absent || 0;
  AttendanceMenu.notMarked = data.not_marked || 0;
  AttendanceMenu.isSunday = data.is_sunday;
  AttendanceMenu.holiday = data.holiday || null;

  // Auto-lock: अगर सभी eligible children की attendance पहले से saved है → lock
  const total = AttendanceMenu.children.length;
  const marked = AttendanceMenu.children.filter(c => c.attendance_status).length;
  AttendanceMenu.locked = (total > 0 && marked === total);
}

async function attMark(beneId, status){
  return api('/api/admin/attendance/mark', {
    method: 'POST',
    body: { beneficiary_id: beneId, date: AttendanceMenu.date, status: status }
  });
}

async function attLoadCalendar(year, month){
  const data = await api('/api/admin/attendance/calendar?year=' + year + '&month=' + month);
  AttendanceMenu.days = data.days || [];
  AttendanceMenu.summary = data.summary || null;
}

/* ==================== HOLIDAY API ==================== */
async function holidayLoadList(){
  const params = new URLSearchParams();
  params.set('status', HolidayMenu.status);
  if (HolidayMenu.search) params.set('search', HolidayMenu.search);
  const data = await api('/api/admin/holidays?' + params.toString());
  HolidayMenu.holidays = data.holidays || [];
}

async function holidayLoadLogs(hid){
  const data = await api('/api/admin/holidays/' + hid + '/logs');
  HolidayMenu.logs = data.logs || [];
}

/* ==================== ENTRY ==================== */
AttendanceMenu.open = function(){
  AttendanceMenu.view = 'attendance';
  AttendanceMenu.date = attToday();
  const now = new Date();
  AttendanceMenu.year = now.getFullYear();
  AttendanceMenu.month = now.getMonth() + 1;
  attLoadEligible(AttendanceMenu.date)
    .then(renderAttendance)
    .catch(e => showToast(e.message, 'error'));
};

HolidayMenu.open = function(){
  HolidayMenu.view = 'list';
  HolidayMenu.status = 'ACTIVE';
  HolidayMenu.search = '';
  HolidayMenu.selected = null;
  holidayLoadList()
    .then(renderHolidayList)
    .catch(e => showToast(e.message, 'error'));
};


/* ==================== RENDER: ATTENDANCE PAGE ==================== */
function renderAttendance(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  const d = AttendanceMenu.date;
  const isHoliday = !!AttendanceMenu.holiday;
  const isSunday = AttendanceMenu.isSunday;

  // Year/Month selectors for date
  const dt = new Date(d + 'T00:00:00');
  const year = dt.getFullYear();
  const month = dt.getMonth() + 1;
  const day = dt.getDate();
  const currentYear = new Date().getFullYear();
  const years = [currentYear-1, currentYear, currentYear+1];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  root.innerHTML = `
    <div class="att-header">
      <div>
        <h2>Attendance</h2>
        <div class="sub">3-6 Years Children</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="attLogsBtn">📜 Logs</button>
      </div>
    </div>

    <div class="att-main">

      <div class="att-tabs">
        <button class="${AttendanceMenu.view === 'attendance' ? 'active' : ''}" data-tab="attendance">Attendance</button>
        <button class="${AttendanceMenu.view === 'calendar' ? 'active' : ''}" data-tab="calendar">Calendar</button>
      </div>

      ${AttendanceMenu.view === 'attendance' ? `
        <div class="att-controls">
          <div class="stock-field">
            <label>Date</label>
            <input type="date" id="attDate" value="${d}" max="${attToday()}">
          </div>
          <div class="stock-field" style="flex:0 0 auto;">
            <label>&nbsp;</label>
            <button class="stock-btn stock-btn-secondary" id="attTodayBtn" style="min-height:46px;">आज की तारीख</button>
          </div>
        </div>

        <div style="background:#fff;border:1px solid var(--card-border);border-radius:16px;padding:14px 16px;margin-bottom:16px;box-shadow:var(--card-shadow);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div>
              <div style="font-size:16px;font-weight:800;color:var(--rr-ink);">${attFmtDate(d)}</div>
              <div style="font-size:13px;color:var(--rr-muted);font-weight:600;margin-top:2px;">${attFmtDay(d)}</div>
            </div>
          </div>
        </div>

        ${isHoliday ? `
          <div class="att-holiday-notice">
            <div class="hol-icon">🎉</div>
            <div class="hol-title">HOLIDAY — ${escHtml(AttendanceMenu.holiday.holiday_name)}</div>
            <div class="hol-sub">इस दिन अवकाश है। Attendance दर्ज नहीं की जा सकती।</div>
          </div>
        ` : ''}

        ${!isHoliday && isSunday ? `
          <div class="att-sunday-notice">
            🔔 रविवार — Attendance आमतौर पर नहीं लगती। फिर भी चाहें तो mark कर सकते हैं।
          </div>
        ` : ''}

        ${!isHoliday ? `
          <div class="att-summary">
            <div class="att-summary-card">
              <div class="label">Total</div>
              <div class="value">${AttendanceMenu.total}</div>
            </div>
            <div class="att-summary-card green">
              <div class="label">Present</div>
              <div class="value">${AttendanceMenu.present}</div>
            </div>
            <div class="att-summary-card coral">
              <div class="label">Absent</div>
              <div class="value">${AttendanceMenu.absent}</div>
            </div>
            <div class="att-summary-card muted">
              <div class="label">Not Marked</div>
              <div class="value">${AttendanceMenu.notMarked}</div>
            </div>
          </div>
        ` : ''}

        <div class="att-list" id="attList">
          ${renderAttChildren(isHoliday)}
        </div>

        ${!isHoliday && AttendanceMenu.children.length ? (
          AttendanceMenu.locked ? `
            <div style="margin-top:18px;background:#e6f5ea;border:1px solid #a8dfb4;border-radius:12px;padding:12px 14px;text-align:center;font-size:13px;font-weight:700;color:#1f7a35;">
              ✅ Attendance saved और locked है। बदलाव के लिए Edit दबाइए।
            </div>
            <div class="stock-actions" style="margin-top:12px;">
              <button class="stock-btn stock-btn-primary" id="attEditBtn">✎ Edit Attendance</button>
            </div>
          ` : `
            <div class="stock-actions" style="margin-top:18px;">
              <button class="stock-btn stock-btn-secondary" id="attClearBtn">Clear All</button>
              <button class="stock-btn stock-btn-primary" id="attSaveAllBtn">Save Attendance</button>
            </div>
          `
        ) : ''}
      ` : ''}

      ${AttendanceMenu.view === 'calendar' ? `
        <div id="calContainer">
          <p style="color:var(--rr-muted);text-align:center;padding:30px;">Loading calendar...</p>
        </div>
      ` : ''}

    </div>
  `;

  // ==================== TABS ====================
  root.querySelectorAll('.att-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab === 'attendance') {
        AttendanceMenu.view = 'attendance';
        renderAttendance();
      } else {
        AttendanceMenu.view = 'calendar';
        renderAttendance();
        attLoadCalendar(AttendanceMenu.year, AttendanceMenu.month)
          .then(renderCalendar)
          .catch(e => showToast(e.message, 'error'));
      }
    });
  });

  // ==================== DATE CHANGE ====================
  const dateInput = document.getElementById('attDate');
  if (dateInput) {
    dateInput.addEventListener('change', (e) => {
      AttendanceMenu.date = e.target.value;
      attLoadEligible(AttendanceMenu.date)
        .then(renderAttendance)
        .catch(e => showToast(e.message, 'error'));
    });
  }
  const todayBtn = document.getElementById('attTodayBtn');
  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      AttendanceMenu.date = attToday();
      attLoadEligible(AttendanceMenu.date)
        .then(renderAttendance)
        .catch(e => showToast(e.message, 'error'));
    });
  }

  // ==================== P/A BUTTONS ====================
  bindAttButtons();

  // ==================== LOGS BUTTON ====================
  const logsBtn = document.getElementById('attLogsBtn');
  if (logsBtn) {
    logsBtn.addEventListener('click', () => {
      AttendanceMenu.view = 'logs';
      renderAttendanceLogs();
    });
  }

  // ==================== SAVE ALL ====================
  const saveAllBtn = document.getElementById('attSaveAllBtn');
  if (saveAllBtn) {
    saveAllBtn.addEventListener('click', async () => {
      const records = AttendanceMenu.children
        .filter(c => c.attendance_status)
        .map(c => ({ beneficiary_id: c.id, status: c.attendance_status }));
      if (!records.length) { showToast('कम से कम एक बच्चे की attendance mark करें।', 'info'); return; }
      try {
        const res = await api('/api/admin/attendance/bulk-save', {
          method: 'POST',
          body: { date: AttendanceMenu.date, records: records }
        });
        const n = (res && res.saved !== undefined) ? res.saved : records.length;
        showToast(n + ' attendance record' + (n === 1 ? '' : 's') + ' saved.', 'success');
        await attLoadEligible(AttendanceMenu.date);
        AttendanceMenu.locked = true;
        renderAttendance();
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  }

  // Edit button — unlock
  const editBtn = document.getElementById('attEditBtn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      AttendanceMenu.locked = false;
      renderAttendance();
    });
  }

  const clearBtn = document.getElementById('attClearBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      AttendanceMenu.children.forEach(c => c.attendance_status = null);
      AttendanceMenu.present = 0;
      AttendanceMenu.absent = 0;
      AttendanceMenu.notMarked = AttendanceMenu.children.length;
      renderAttendance();
    });
  }
}


/* ==================== RENDER: CHILDREN LIST ==================== */
function renderAttChildren(isHoliday){
  const list = AttendanceMenu.children || [];
  if (!list.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-title">कोई eligible बच्चा नहीं मिला</div>
        <div class="empty-sub">इस तारीख को 3-6 साल का कोई child Beneficiaries में नहीं है।</div>
      </div>
    `;
  }

  return list.map(c => {
    const age = calcAge(c.date_of_birth);
    const metaParts = [];
    if (age !== '—') metaParts.push(age);
    if (c.house_number) metaParts.push('🏠 ' + escHtml(c.house_number));
    if (c.beneficiary_unique_id) metaParts.push('#' + c.beneficiary_unique_id);

    const avatar = c.profile_photo_data
      ? '<img src="' + c.profile_photo_data + '">'
      : '🧒';

    const isP = c.attendance_status === 'PRESENT';
    const isA = c.attendance_status === 'ABSENT';
    const isLocked = AttendanceMenu.locked;
    const disabled = (isHoliday || isLocked) ? 'disabled' : '';

    return `
      <div class="attendance-row ${isHoliday ? 'is-holiday' : ''}">
        <div class="att-avatar">${avatar}</div>
        <div style="min-width:0;">
          <div class="att-name">${escHtml(c.full_name)}</div>
          <div class="att-meta">${metaParts.join(' · ')}</div>
        </div>
        <div class="att-status">
          <button class="present ${isP ? 'active' : ''}" data-id="${c.id}" data-status="PRESENT" ${disabled}>P</button>
          <button class="absent ${isA ? 'active' : ''}" data-id="${c.id}" data-status="ABSENT" ${disabled}>A</button>
        </div>
      </div>
    `;
  }).join('');
}


function bindAttButtons(){
  document.querySelectorAll('.att-status button').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      if (AttendanceMenu.locked) return;
      const id = parseInt(btn.dataset.id, 10);
      const status = btn.dataset.status;
      // Optimistic UI update
      const child = AttendanceMenu.children.find(c => c.id === id);
      if (!child) return;
      // Toggle local state only — Save बटन से backend पर जाएगा
      if (child.attendance_status === status) {
        child.attendance_status = null;
      } else {
        child.attendance_status = status;
      }
      AttendanceMenu.present = AttendanceMenu.children.filter(c => c.attendance_status === 'PRESENT').length;
      AttendanceMenu.absent = AttendanceMenu.children.filter(c => c.attendance_status === 'ABSENT').length;
      AttendanceMenu.notMarked = AttendanceMenu.children.filter(c => !c.attendance_status).length;
      renderAttendance();
    });
  });
}


/* ==================== RENDER: HOLIDAY LIST ==================== */
function renderHolidayList(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const list = HolidayMenu.holidays || [];
  const isDeleted = HolidayMenu.status === 'DELETED';

  root.innerHTML = `
    <div class="att-header">
      <div>
        <h2>Holiday</h2>
        <div class="sub">${isDeleted ? 'Deleted Holidays' : 'Active Holidays'}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="holLogsAllBtn">📜 Logs</button>
      </div>
    </div>

    <div class="att-main">

      <div class="att-tabs">
        <button class="${HolidayMenu.status === 'ACTIVE' ? 'active' : ''}" data-status="ACTIVE">Active</button>
        <button class="${HolidayMenu.status === 'DELETED' ? 'active' : ''}" data-status="DELETED">Deleted</button>
      </div>

      <div class="stock-search" style="margin-bottom:16px;">
        <input id="holSearch" type="search"
          placeholder="Search holiday name or description"
          autocomplete="off" value="${escHtml(HolidayMenu.search)}">
      </div>

      <div style="font-size:13px;font-weight:700;color:var(--rr-muted);margin-bottom:12px;">
        ${list.length} holiday${list.length === 1 ? '' : 's'}
      </div>

      <div id="holidayList">
        ${list.length ? list.map(h => renderHolidayCard(h)).join('') : `
          <div class="empty-state">
            <div class="empty-icon">🎉</div>
            <div class="empty-title">${isDeleted ? 'कोई deleted holiday नहीं' : 'कोई Holiday नहीं है'}</div>
            <div class="empty-sub">${isDeleted ? '' : 'नीचे + बटन से नया Holiday जोड़ें'}</div>
          </div>
        `}
      </div>
    </div>

    ${!isDeleted ? '<button class="stock-fab" id="addHolidayBtn" title="Add Holiday">＋</button>' : ''}
  `;

  // Tabs
  root.querySelectorAll('.att-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      HolidayMenu.status = btn.dataset.status;
      HolidayMenu.search = '';
      holidayLoadList().then(renderHolidayList).catch(e => showToast(e.message, 'error'));
    });
  });

  // Logs button
  document.getElementById('holLogsAllBtn').addEventListener('click', () => {
    HolidayMenu.view = 'logs';
    renderHolidayLogsAll();
  });

  // Search
  const searchInput = document.getElementById('holSearch');
  let searchTimer = null;
  searchInput.addEventListener('input', (e) => {
    HolidayMenu.search = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      holidayLoadList().then(() => {
        const listEl = document.getElementById('holidayList');
        if (listEl) {
          listEl.innerHTML = HolidayMenu.holidays.length
            ? HolidayMenu.holidays.map(h => renderHolidayCard(h)).join('')
            : '<div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-title">कोई Holiday नहीं मिला</div></div>';
          bindHolidayCards();
        }
      }).catch(e => showToast(e.message, 'error'));
    }, 250);
  });

  // Add button
  const addBtn = document.getElementById('addHolidayBtn');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      HolidayMenu.view = 'add';
      renderHolidayForm(null);
    });
  }

  bindHolidayCards();
}


function renderHolidayCard(h){
  const isDeleted = !h.is_active;
  return `
    <div class="holiday-card ${isDeleted ? 'deleted' : ''}" data-id="${h.id}">
      <div>
        <div class="h-name">${escHtml(h.holiday_name)}</div>
        <div class="h-date">📅 ${attFmtDate(h.holiday_date)} · ${attFmtDay(h.holiday_date)}</div>
        ${h.description ? '<div class="h-desc">' + escHtml(h.description) + '</div>' : ''}
      </div>
      <div class="h-actions">
        <button class="stock-btn stock-btn-secondary stock-btn-sm" data-action="view" data-id="${h.id}">📜 Logs</button>
      </div>
    </div>
  `;
}


function bindHolidayCards(){
  document.querySelectorAll('.holiday-card').forEach(card => {
    const id = parseInt(card.dataset.id, 10);
    const h = HolidayMenu.holidays.find(x => x.id === id);
    // Logs button
    const logsBtn = card.querySelector('[data-action="view"]');
    if (logsBtn) {
      logsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        HolidayMenu.selected = h;
        HolidayMenu.view = 'logs';
        renderHolidayLogsDetail(id);
      });
    }
    // Click on card → edit (if active)
    card.addEventListener('click', () => {
      if (h.is_active) {
        HolidayMenu.selected = h;
        HolidayMenu.view = 'edit';
        renderHolidayForm(h);
      }
    });
  });
}


/* ==================== RENDER: HOLIDAY FORM (add/edit) ==================== */
function renderHolidayForm(h){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const isEdit = !!h;
  const today = attToday();

  root.innerHTML = `
    <div class="att-header">
      <div>
        <h2>${isEdit ? 'Edit Holiday' : 'Add Holiday'}</h2>
        <div class="sub">${isEdit ? escHtml(h.holiday_name) : 'नया Holiday जोड़ें'}</div>
      </div>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="att-main">
      <div class="stock-form-card">
        <form id="holidayForm">

          <div class="detail-section-title">Holiday Information</div>
          <div class="stock-form-grid">
            <div class="stock-field">
              <label for="holDate">Date <span class="req">*</span></label>
              <input type="date" id="holDate" value="${isEdit ? h.holiday_date : today}" required>
            </div>
            <div class="stock-field">
              <label for="holName">Holiday Name / Reason <span class="req">*</span></label>
              <input type="text" id="holName" value="${isEdit ? escHtml(h.holiday_name) : ''}" placeholder="जैसे: गांधी जयंती" required autofocus>
            </div>
            <div class="stock-field full">
              <label for="holDesc">Description (optional)</label>
              <textarea id="holDesc" rows="2">${isEdit ? escHtml(h.description || '') : ''}</textarea>
            </div>
          </div>

          ${isEdit ? `
            <div style="margin-top:14px;padding:12px;background:#fff7e5;border-radius:12px;border:1px solid #f5d8a8;font-size:13px;color:#8a5a00;line-height:1.5;">
              ⚠️ अगर आप date बदलेंगे तो:
              <ul style="margin:6px 0 0 18px;padding:0;">
                <li>पुरानी date फिर attendance के लिए open हो जाएगी</li>
                <li>नई date पर attendance block हो जाएगी</li>
                <li>दोनों में log बनेगा</li>
              </ul>
            </div>
          ` : ''}

          <div id="formError" class="login-error" style="display:none;margin-top:14px;"></div>
          <div class="stock-actions">
            ${isEdit ? '<button type="button" class="stock-btn stock-btn-secondary" id="deleteHolBtn" style="color:#b0271f;">🗑 Delete Holiday</button>' : ''}
            <button type="button" class="stock-btn stock-btn-secondary" id="cancelBtn">Cancel</button>
            <button type="submit" class="stock-btn stock-btn-primary">${isEdit ? 'Save Changes' : 'Add Holiday'}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    HolidayMenu.view = 'list';
    holidayLoadList().then(renderHolidayList).catch(e => showToast(e.message, 'error'));
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    HolidayMenu.view = 'list';
    holidayLoadList().then(renderHolidayList).catch(e => showToast(e.message, 'error'));
  });

  // Delete button
  const delBtn = document.getElementById('deleteHolBtn');
  if (delBtn) {
    delBtn.addEventListener('click', () => showHolidayDeleteDialog(h));
  }

  // Submit
  document.getElementById('holidayForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('formError');
    errDiv.style.display = 'none';

    const dateVal = document.getElementById('holDate').value;
    const nameVal = document.getElementById('holName').value.trim();
    const descVal = document.getElementById('holDesc').value.trim() || null;

    if (!dateVal) { errDiv.textContent = 'Date ज़रूरी है।'; errDiv.style.display = 'block'; return; }
    if (!nameVal) { errDiv.textContent = 'Holiday name ज़रूरी है।'; errDiv.style.display = 'block'; return; }

    const payload = { holiday_date: dateVal, holiday_name: nameVal, description: descVal };

    try {
      if (isEdit) {
        const res = await api('/api/admin/holidays/' + h.id, { method: 'PATCH', body: payload });
        showToast(res.message || 'Holiday updated', 'success');
      } else {
        const res = await api('/api/admin/holidays', { method: 'POST', body: payload });
        showToast(res.message || 'Holiday added successfully', 'success');
      }
      HolidayMenu.view = 'list';
      await holidayLoadList();
      renderHolidayList();
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}


/* ==================== MODAL: DELETE HOLIDAY ==================== */
function showHolidayDeleteDialog(h){
  const backdrop = document.createElement('div');
  backdrop.className = 'bene-modal-backdrop';
  backdrop.innerHTML = `
    <div class="bene-modal">
      <div class="warn-icon">🗑</div>
      <h3>Delete Holiday</h3>
      <p>
        <b>${escHtml(h.holiday_name)}</b><br>
        Date: ${attFmtDate(h.holiday_date)}
        <br><br>
        इस date पर attendance फिर से available हो जाएगी।<br>
        पुरानी attendance वापस नहीं आएगी — दोबारा manually mark करनी होगी।
      </p>

      <div class="family-field">
        <label for="delReason">Reason <span class="req">*</span></label>
        <input type="text" id="delReason" placeholder="जैसे: गलती से जोड़ दिया था">
      </div>

      <div id="delError" class="login-error" style="display:none;margin-top:10px;"></div>

      <div class="bene-modal-actions">
        <button class="family-btn family-btn-secondary" id="delCancel">Cancel</button>
        <button class="family-btn family-btn-danger" id="delOk">Delete Holiday</button>
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
    if (!reason) { errEl.textContent = 'Reason ज़रूरी है।'; errEl.style.display = 'block'; return; }

    try {
      const res = await api('/api/admin/holidays/' + h.id + '/delete', {
        method: 'POST',
        body: { reason: reason }
      });
      document.body.removeChild(backdrop);
      showToast(res.message || 'Holiday deleted', 'success');
      HolidayMenu.view = 'list';
      await holidayLoadList();
      renderHolidayList();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });
}


/* ==================== RENDER: HOLIDAY LOGS (single) ==================== */
async function renderHolidayLogsDetail(hid){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="att-header">
      <div><h2>Holiday Logs</h2><div class="sub">Loading...</div></div>
      <div class="header-actions"><button class="back-btn" id="backBtn">← Back</button></div>
    </div>
    <div class="att-main"><p style="color:var(--rr-muted);text-align:center;padding:30px;">Loading...</p></div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    HolidayMenu.view = 'list';
    holidayLoadList().then(renderHolidayList).catch(e => showToast(e.message, 'error'));
  });

  try {
    const data = await api('/api/admin/holidays/' + hid + '/logs');
    const logs = data.logs || [];
    const h = HolidayMenu.selected;
    root.innerHTML = `
      <div class="att-header">
        <div>
          <h2>Holiday Logs</h2>
          <div class="sub">${h ? escHtml(h.holiday_name) + ' · ' + attFmtDate(h.holiday_date) : ''}</div>
        </div>
        <div class="header-actions"><button class="back-btn" id="backBtn">← Back</button></div>
      </div>
      <div class="att-main">
        ${logs.length ? logs.map(l => renderHolidayLog(l)).join('') : '<div class="empty-state"><div class="empty-icon">📜</div><div class="empty-title">No logs yet</div></div>'}
      </div>
    `;
    document.getElementById('backBtn').addEventListener('click', () => {
      HolidayMenu.view = 'list';
      holidayLoadList().then(renderHolidayList).catch(e => showToast(e.message, 'error'));
    });
  } catch (e) {
    showToast(e.message, 'error');
  }
}


/* ==================== RENDER: ALL HOLIDAY LOGS ==================== */
async function renderHolidayLogsAll(){
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="att-header">
      <div><h2>All Holiday Logs</h2><div class="sub">सभी Holiday activity</div></div>
      <div class="header-actions"><button class="back-btn" id="backBtn">← Back</button></div>
    </div>
    <div class="att-main"><p style="color:var(--rr-muted);text-align:center;padding:30px;">Loading...</p></div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    HolidayMenu.view = 'list';
    holidayLoadList().then(renderHolidayList).catch(e => showToast(e.message, 'error'));
  });

  try {
    const data = await api('/api/admin/holidays/logs/all');
    const logs = data.logs || [];
    root.innerHTML = `
      <div class="att-header">
        <div><h2>All Holiday Logs</h2><div class="sub">${logs.length} entries</div></div>
        <div class="header-actions"><button class="back-btn" id="backBtn">← Back</button></div>
      </div>
      <div class="att-main">
        ${logs.length ? logs.map(l => renderHolidayLog(l)).join('') : '<div class="empty-state"><div class="empty-icon">📜</div><div class="empty-title">No logs yet</div></div>'}
      </div>
    `;
    document.getElementById('backBtn').addEventListener('click', () => {
      HolidayMenu.view = 'list';
      holidayLoadList().then(renderHolidayList).catch(e => showToast(e.message, 'error'));
    });
  } catch (e) {
    showToast(e.message, 'error');
  }
}


/* ==================== RENDER: SINGLE LOG ==================== */
function renderHolidayLog(log){
  const icons = { 'HOLIDAY_CREATED': '➕', 'HOLIDAY_EDITED': '✎', 'HOLIDAY_DELETED': '🗑' };
  const labels = { 'HOLIDAY_CREATED': 'Holiday Created', 'HOLIDAY_EDITED': 'Holiday Edited', 'HOLIDAY_DELETED': 'Holiday Deleted' };
  const icon = icons[log.action] || '•';
  const label = labels[log.action] || log.action;

  let changesHtml = '';
  if (log.action === 'HOLIDAY_EDITED' && log.old_values && log.new_values) {
    try {
      const o = JSON.parse(log.old_values);
      const n = JSON.parse(log.new_values);
      const rows = [];
      Object.keys(n).forEach(k => {
        if (String(o[k] || '') !== String(n[k] || '')) {
          rows.push('<div style="display:flex;gap:6px;flex-wrap:wrap;margin:2px 0;"><b>' + escHtml(k) + ':</b> <span style="color:#b0271f;text-decoration:line-through;">' + escHtml(o[k] || '—') + '</span> → <span style="color:#1f7a35;font-weight:700;">' + escHtml(n[k] || '—') + '</span></div>');
        }
      });
      if (rows.length) changesHtml = rows.join('');
    } catch (e) {}
  } else if (log.action === 'HOLIDAY_CREATED' && log.new_values) {
    try {
      const n = JSON.parse(log.new_values);
      changesHtml = Object.keys(n).map(k => '<div><b>' + escHtml(k) + ':</b> ' + escHtml(n[k] || '') + '</div>').join('');
    } catch (e) {}
  }

  const reason = log.reason ? '<div style="margin-top:3px;font-style:italic;">Reason: ' + escHtml(log.reason) + '</div>' : '';
  const user = log.created_by_username ? '<div class="log-user">👤 ' + escHtml(log.created_by_username) + '</div>' : '';

  return `
    <div class="att-log">
      <div class="log-head">
        <span>${icon} ${escHtml(label)}</span>
        <span class="log-time">${fmtDateTime(log.created_at)}</span>
      </div>
      <div class="log-body">
        ${user}
        ${changesHtml}
        ${reason}
      </div>
    </div>
  `;
}


/* ==================== RENDER: CALENDAR ==================== */
function renderCalendar(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const cont = document.getElementById('calContainer');
  if (!cont) return;

  const y = AttendanceMenu.year;
  const m = AttendanceMenu.month;
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthName = MONTHS[m-1];
  const days = AttendanceMenu.days || [];
  const summary = AttendanceMenu.summary;

  // Determine first day of week (0=Sun .. 6=Sat)
  const firstDate = new Date(y, m-1, 1);
  const firstWeekday = firstDate.getDay(); // 0-6

  const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let gridHtml = '';
  // Empty slots before day 1
  for (let i = 0; i < firstWeekday; i++) {
    gridHtml += '<div></div>';
  }
  // Days
  days.forEach(d => {
    const classes = ['calendar-day'];
    if (d.is_today) classes.push('today');
    if (d.is_sunday) classes.push('sunday');
    if (d.holiday) classes.push('holiday');
    if (!d.holiday && !d.is_sunday && d.total_marked > 0) classes.push('has-att');

    let sumHtml = '';
    if (d.holiday) {
      sumHtml = '<div class="summary">🎉 HOLIDAY</div>' +
                '<div class="hol-name">' + escHtml(d.holiday.holiday_name) + '</div>';
    } else if (d.is_sunday) {
      sumHtml = '<div class="summary">Sunday</div>';
    } else if (d.total_marked > 0) {
      sumHtml = '<div class="summary">P: ' + d.present + ' · A: ' + d.absent + '</div>';
    } else {
      sumHtml = '<div class="summary">—</div>';
    }

    gridHtml += `
      <div class="${classes.join(' ')}" data-date="${d.date}">
        <div class="num">${d.day}</div>
        ${sumHtml}
      </div>
    `;
  });

  cont.innerHTML = `
    <div class="calendar-card">
      <div class="calendar-head">
        <h3>${monthName} ${y}</h3>
        <div class="calendar-nav">
          <button id="prevMonth" title="Previous">‹</button>
          <button id="nextMonth" title="Next">›</button>
        </div>
      </div>
      <div class="calendar-grid">
        ${WEEKDAYS.map(w => '<div class="calendar-weekday">' + w + '</div>').join('')}
        ${gridHtml}
      </div>
    </div>

    ${summary ? `
      <div class="calendar-summary">
        <h3>Monthly Summary — ${monthName} ${y}</h3>
        <div class="cal-sum-grid">
          <div class="cal-sum-item">
            <div class="label">Total Days</div>
            <div class="value">${summary.total_days}</div>
          </div>
          <div class="cal-sum-item">
            <div class="label">Sundays</div>
            <div class="value">${summary.sundays}</div>
          </div>
          <div class="cal-sum-item">
            <div class="label">Manual Holidays</div>
            <div class="value">${summary.manual_holidays}</div>
          </div>
          <div class="cal-sum-item">
            <div class="label">Total Holidays</div>
            <div class="value">${summary.total_holidays}</div>
          </div>
          <div class="cal-sum-item">
            <div class="label">Working Days</div>
            <div class="value">${summary.working_days}</div>
          </div>
          <div class="cal-sum-item green">
            <div class="label">Present</div>
            <div class="value">${summary.present}</div>
          </div>
          <div class="cal-sum-item coral">
            <div class="label">Absent</div>
            <div class="value">${summary.absent}</div>
          </div>
          <div class="cal-sum-item muted">
            <div class="label">Not Marked</div>
            <div class="value">${summary.not_marked}</div>
          </div>
        </div>
      </div>
    ` : ''}
  `;

  // Month navigation
  document.getElementById('prevMonth').addEventListener('click', () => {
    let ny = y, nm = m - 1;
    if (nm < 1) { nm = 12; ny--; }
    AttendanceMenu.year = ny;
    AttendanceMenu.month = nm;
    attLoadCalendar(ny, nm).then(renderCalendar).catch(e => showToast(e.message, 'error'));
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    let ny = y, nm = m + 1;
    if (nm > 12) { nm = 1; ny++; }
    AttendanceMenu.year = ny;
    AttendanceMenu.month = nm;
    attLoadCalendar(ny, nm).then(renderCalendar).catch(e => showToast(e.message, 'error'));
  });

  // Click on a day → jump to Attendance page for that date
  cont.querySelectorAll('.calendar-day').forEach(cell => {
    cell.addEventListener('click', () => {
      const d = cell.dataset.date;
      if (!d) return;
      AttendanceMenu.view = 'attendance';
      AttendanceMenu.date = d;
      attLoadEligible(d).then(renderAttendance).catch(e => showToast(e.message, 'error'));
    });
  });
}


/* ==================== RENDER: ATTENDANCE LOGS PAGE ==================== */
async function renderAttendanceLogs(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const dateStr = AttendanceMenu.date;

  root.innerHTML = `
    <div class="att-header">
      <div>
        <h2>Attendance Logs</h2>
        <div class="sub">${attFmtDate(dateStr)} · ${attFmtDay(dateStr)}</div>
      </div>
      <div class="header-actions"><button class="back-btn" id="backBtn">← Back</button></div>
    </div>
    <div class="att-main"><p style="color:var(--rr-muted);text-align:center;padding:30px;">Loading...</p></div>
  `;

  document.getElementById('backBtn').addEventListener('click', () => {
    AttendanceMenu.view = 'attendance';
    attLoadEligible(AttendanceMenu.date).then(renderAttendance).catch(e => showToast(e.message, 'error'));
  });

  try {
    const data = await api('/api/admin/attendance/logs?date=' + encodeURIComponent(dateStr));
    const logs = data.logs || [];
    root.innerHTML = `
      <div class="att-header">
        <div>
          <h2>Attendance Logs</h2>
          <div class="sub">${attFmtDate(dateStr)} · ${logs.length} entr${logs.length === 1 ? 'y' : 'ies'}</div>
        </div>
        <div class="header-actions"><button class="back-btn" id="backBtn">← Back</button></div>
      </div>
      <div class="att-main">
        ${logs.length ? logs.map(l => renderAttLog(l)).join('') : `
          <div class="empty-state">
            <div class="empty-icon">📜</div>
            <div class="empty-title">इस date पर कोई log नहीं</div>
            <div class="empty-sub">${attFmtDate(dateStr)} पर अभी तक कुछ change नहीं हुआ।</div>
          </div>
        `}
      </div>
    `;
    document.getElementById('backBtn').addEventListener('click', () => {
      AttendanceMenu.view = 'attendance';
      attLoadEligible(AttendanceMenu.date).then(renderAttendance).catch(e => showToast(e.message, 'error'));
    });
  } catch (e) {
    showToast(e.message, 'error');
  }
}


function renderAttLog(log){
  const icons = {
    'ATTENDANCE_CREATED': '➕',
    'ATTENDANCE_UPDATED': '✎',
    'ATTENDANCE_DELETED': '🗑',
    'ATTENDANCE_BLOCKED_HOLIDAY': '🎉',
    'ATTENDANCE_BULK': '📋'
  };
  const labels = {
    'ATTENDANCE_CREATED': 'Attendance Marked',
    'ATTENDANCE_UPDATED': 'Attendance Updated',
    'ATTENDANCE_DELETED': 'Attendance Deleted',
    'ATTENDANCE_BLOCKED_HOLIDAY': 'Blocked (Holiday)',
    'ATTENDANCE_BULK': 'Attendance Saved'
  };
  const icon = icons[log.action] || '•';
  const label = labels[log.action] || log.action;

  // ============ BULK LOG ============
  if (log.action === 'ATTENDANCE_BULK') {
    let changes = [];
    try { changes = JSON.parse(log.new_value || '[]'); } catch(e) { changes = []; }
    const count = changes.length;
    const created = changes.filter(c => c.type === 'created').length;
    const updated = changes.filter(c => c.type === 'updated').length;

    const rows = changes.map(c => {
      const oldHtml = c.old
        ? '<span style="color:#b0271f;text-decoration:line-through;">' + escHtml(c.old) + '</span>'
        : '<span style="color:#8a9a92;">—</span>';
      const newHtml = '<span style="color:' + (c.new === 'PRESENT' ? '#1f7a35' : '#b0271f') + ';font-weight:800;">' + escHtml(c.new || '') + '</span>';
      return `
        <div style="display:flex;justify-content:space-between;gap:10px;padding:6px 8px;border-bottom:1px solid #f0f0f5;font-size:12px;">
          <div style="min-width:0;">
            <div style="font-weight:800;color:var(--rr-ink);font-size:13px;">${escHtml(c.full_name || '')}</div>
            <div style="font-size:10.5px;color:#8a9a92;">#${escHtml(String(c.unique_id || ''))}</div>
          </div>
          <div style="white-space:nowrap;text-align:right;">${oldHtml} → ${newHtml}</div>
        </div>
      `;
    }).join('');

    const user = log.created_by_username ? '<div class="log-user">👤 ' + escHtml(log.created_by_username) + '</div>' : '';

    return `
      <div class="att-log">
        <div class="log-head">
          <span>📋 ${escHtml(label)}</span>
          <span class="log-time">${fmtDateTime(log.created_at)}</span>
        </div>
        <div class="log-body">
          <div style="font-weight:700;color:var(--rr-ink);font-size:12.5px;margin-bottom:4px;">
            ${count} child${count === 1 ? '' : 'ren'} — 
            ${created ? created + ' added' : ''}${created && updated ? ', ' : ''}${updated ? updated + ' updated' : ''}
          </div>
          <details>
            <summary style="cursor:pointer;font-size:12px;color:#8aa096;font-weight:700;list-style:none;padding:4px 0;">▸ Changes देखें (${count})</summary>
            <div style="background:#fff;border-radius:8px;margin-top:6px;overflow:hidden;">
              ${rows}
            </div>
          </details>
          ${user}
        </div>
      </div>
    `;
  }

  // Child name (from JOIN)
  const childName = log.beneficiary_name || 'Unknown';
  const childId = log.beneficiary_unique_id ? '#' + log.beneficiary_unique_id : '';
  const avatar = log.profile_photo_data
    ? '<img src="' + log.profile_photo_data + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">'
    : '<span style="font-size:14px;">🧒</span>';

  // Status chips
  function statusChip(val){
    if (!val) return '<span style="color:#8a9a92;">—</span>';
    const color = val === 'PRESENT' ? '#1f7a35' : (val === 'ABSENT' ? '#b0271f' : '#8a9a92');
    return '<span style="color:' + color + ';font-weight:800;">' + escHtml(val) + '</span>';
  }

  let bodyHtml = '';
  if (log.action === 'ATTENDANCE_CREATED') {
    bodyHtml = '<div>Status: ' + statusChip(log.new_value) + '</div>';
  } else if (log.action === 'ATTENDANCE_UPDATED') {
    bodyHtml = '<div>Old: <span style="color:#b0271f;text-decoration:line-through;">' + escHtml(log.old_value || '—') + '</span> → New: ' + statusChip(log.new_value) + '</div>';
  } else if (log.action === 'ATTENDANCE_BLOCKED_HOLIDAY') {
    bodyHtml = '<div>Old: <span style="color:#b0271f;text-decoration:line-through;">' + escHtml(log.old_value || '—') + '</span></div>';
    if (log.reason) bodyHtml += '<div style="margin-top:2px;font-style:italic;">Reason: ' + escHtml(log.reason) + '</div>';
  } else if (log.action === 'ATTENDANCE_DELETED') {
    bodyHtml = '<div>Old: ' + statusChip(log.old_value) + '</div>';
  }

  const user = log.created_by_username ? '<div class="log-user">👤 ' + escHtml(log.created_by_username) + '</div>' : '';

  return `
    <div class="att-log">
      <div class="log-head">
        <span>${icon} ${escHtml(label)}</span>
        <span class="log-time">${fmtDateTime(log.created_at)}</span>
      </div>
      <div class="log-body">
        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px;background:#fff;border-radius:8px;margin:5px 0;">
          <div style="width:26px;height:26px;border-radius:50%;background:#f0f0f5;display:grid;place-items:center;flex-shrink:0;">${avatar}</div>
          <div style="min-width:0;">
            <div style="font-weight:800;color:var(--rr-ink);font-size:13px;">${escHtml(childName)}</div>
            ${childId ? '<div style="font-size:10.5px;color:#8a9a92;">' + escHtml(childId) + '</div>' : ''}
          </div>
        </div>
        ${bodyHtml}
        ${user}
      </div>
    </div>
  `;
}


/* ==================== BUTTON: Add Logs to Attendance page ==================== */
function addAttLogsButton(){
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const header = root.querySelector('.att-header');
  if (!header) return;
  const actions = header.querySelector('.header-actions');
  if (actions || !actions) {
    // Append a Logs button in header if not already present
    let ha = header.querySelector('.header-actions');
    if (!ha) {
      ha = document.createElement('div');
      ha.className = 'header-actions';
      header.appendChild(ha);
    }
    if (!ha.querySelector('#attLogsBtn')) {
      const btn = document.createElement('button');
      btn.className = 'back-btn';
      btn.id = 'attLogsBtn';
      btn.textContent = '📜 Logs';
      btn.addEventListener('click', () => {
        AttendanceMenu.view = 'logs';
        renderAttendanceLogs();
      });
      ha.appendChild(btn);
    }
  }
}
