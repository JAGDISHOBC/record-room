/* ==================== FAMILY DETAIL V2 (locked view) ==================== */

/* --- Locked field renderer --- */
function lockedField(label, value) {
  const empty = !value || value === '' || value === null;
  return '<div class="locked-field' + (empty ? ' empty' : '') + '">' +
    '<span class="lock-label">' + escHtml(label) + '</span>' +
    '<span class="lock-value">' + escHtml(empty ? '—' : value) + '</span>' +
  '</div>';
}

/* --- Render: Family List (v2 with Head info) --- */
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
        placeholder="Search family, Aush, Head, Aadhaar, Mobile, Voter ID"
        autocomplete="off" value="${escHtml(FamilyMenu.search)}">
    </section>

    <main class="family-list" id="familyList">
      ${list.length ? list.map(f => renderFamilyCard(f)).join('') : `
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

function renderFamilyCard(f) {
  const head = f.head_name || '';
  const husband = f.husband_name || '';
  const age = f.head_dob ? calcAge(f.head_dob) : '';
  const secondParts = [];
  if (head) secondParts.push('Head: ' + head);
  if (husband) secondParts.push('H/O: ' + husband);
  if (age && age !== '—') secondParts.push(age);

  const metaParts = [];
  metaParts.push('<span class="badge">Aush ' + escHtml(f.aush_number) + '</span>');
  metaParts.push('<span>Members: ' + (f.member_count || 0) + '</span>');
  if (f.survey_status) {
    const cls = f.survey_status === 'COMPLETED' ? 'surveyed' : 'pending';
    metaParts.push('<span class="badge ' + cls + '">' + escHtml(f.survey_status) + '</span>');
  }

  return `
    <button class="family-row head-based" data-id="${f.id}">
      <div class="family-main">
        <b>${escHtml(f.family_name)}</b>
        <span>${escHtml(secondParts.join(' · '))}</span>
      </div>
      <div class="family-meta">
        ${metaParts.join('')}
      </div>
      <div class="family-arrow">›</div>
    </button>
  `;
}

/* --- Render: Family Detail (v2 with locked fields + delete) --- */
function renderFamilyDetail() {
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const f = FamilyMenu.family;
  if (!f) { FamilyMenu.view = 'list'; renderFamilyList(); return; }

  const locChip = (f.latitude || f.longitude) ? `
    <div class="detail-meta">
      <span class="chip green">📍 ${f.latitude ? Number(f.latitude).toFixed(6) : '—'}, ${f.longitude ? Number(f.longitude).toFixed(6) : '—'}</span>
      ${f.location_accuracy_meters ? '<span class="chip">±' + Number(f.location_accuracy_meters).toFixed(1) + 'm</span>' : ''}
    </div>
  ` : '';

  root.innerHTML = `
    <div class="family-header">
      <h2>${escHtml(f.family_name)}</h2>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="member-detail-card">
      <div class="section-head-row">
        <h3>Family Details</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="family-btn family-btn-primary family-btn-sm" id="editFamilyBtn">✎ Edit</button>
          <button class="family-btn family-btn-danger family-btn-sm" id="deleteFamilyBtn">🗑 Delete Family</button>
        </div>
      </div>
      <div class="family-form-grid">
        ${lockedField('Aush Number', f.aush_number)}
        ${lockedField('Family Name', f.family_name)}
        ${lockedField('Husband Name', f.husband_name)}
        ${lockedField('Family / House Number', f.house_number)}
        ${lockedField('Village', f.village)}
        ${lockedField('Ward', f.ward)}
        ${lockedField('Pincode', f.pincode)}
        ${lockedField('Social Category', f.category)}
        ${lockedField('Religion', f.religion)}
        ${lockedField('Survey Status', f.survey_status)}
        ${lockedField('Survey Date', f.survey_date)}
        <div style="grid-column:1 / -1">${lockedField('Address', f.address)}</div>
      </div>
      ${locChip}
    </div>

    <div class="member-detail-card">
      <div class="section-head-row">
        <h3>Family Members (${FamilyMenu.members.length})</h3>
        <button class="family-btn family-btn-primary family-btn-sm" id="addMemberBtn">+ Add Member</button>
      </div>
      <div id="memberList">
        ${FamilyMenu.members.length ? FamilyMenu.members.map(m => `
          <button class="member-row" data-id="${m.id}">
            <div class="member-main">
              <b>${escHtml(m.full_name)}${m.is_family_head ? ' <span class="role-tag">HEAD</span>' : ''}</b>
              <span>${escHtml(relLabel(m.relation_to_head))}${m.date_of_birth ? ' · Age: ' + calcAge(m.date_of_birth) : ''}</span>
            </div>
            <div class="member-meta">
              ${m.gender ? '<span>' + escHtml(m.gender) + '</span>' : ''}
              ${m.mobile ? '<span>📱 ' + escHtml(m.mobile) + '</span>' : ''}
              ${m.aadhaar_number ? '<span>ID: ' + escHtml(maskAadhaar(m.aadhaar_number)) + '</span>' : ''}
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

  document.getElementById('deleteFamilyBtn').addEventListener('click', async () => {
    const f = FamilyMenu.family;
    const msg = 'क्या आप Family "' + f.family_name + '" (Aush ' + f.aush_number + ') को delete (archive) करना चाहते हैं?\n\n' +
      'इससे:\n' +
      '• Family inactive हो जाएगी\n' +
      '• सभी active members भी inactive होंगे\n' +
      '• Logs और records सुरक्षित रहेंगे\n' +
      '• बाद में Recycle Bin से restore कर सकेंगे';
    if (!confirm(msg)) return;
    try {
      await api('/api/families/' + f.id, { method: 'DELETE' });
      showToast('Family archived', 'success');
      FamilyMenu.view = 'list';
      FamilyMenu.familyId = null;
      loadFamilies();
    } catch (err) {
      showToast(err.message, 'error');
    }
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

/* ==================== MEMBER DETAIL V2 (locked view) ==================== */
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
      <div class="section-head-row">
        <h3>Basic Information</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="family-btn family-btn-primary family-btn-sm" id="editMemberBtn">✎ Edit</button>
          ${m.is_family_head ? '' : '<button class="family-btn family-btn-danger family-btn-sm" id="deleteMemberBtn">🗑 Delete</button>'}
        </div>
      </div>
      <div class="family-form-grid">
        ${lockedField('Name', m.full_name)}
        ${lockedField('Gender', m.gender)}
        ${lockedField('Date of Birth', m.date_of_birth)}
        ${lockedField('Age', calcAge(m.date_of_birth))}
        ${lockedField('Relationship', relLabel(m.relation_to_head))}
        ${lockedField('Marital Status', m.marital_status)}
        ${lockedField('Aadhaar Number', maskAadhaar(m.aadhaar_number))}
        ${lockedField('Jan Aadhaar', m.jan_aadhaar_number)}
        ${lockedField('Voter ID', m.voter_id_number)}
        ${lockedField('Mobile', m.mobile)}
        ${lockedField('Alternate Mobile', m.alternate_mobile)}
        ${lockedField('Social Category', m.social_category)}
        ${lockedField('Religion', m.religion)}
        ${lockedField('Caste', m.caste)}
        ${lockedField('Occupation', m.occupation)}
        ${lockedField('Family Head', m.is_family_head ? 'Yes' : 'No')}
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
      if (!confirm('क्या आप member "' + m.full_name + '" को delete (archive) करना चाहते हैं?')) return;
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
