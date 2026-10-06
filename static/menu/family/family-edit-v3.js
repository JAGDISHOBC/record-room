/* ==================== EDIT FAMILY V3 + MEMBER FORM CLEANUP ==================== */

function renderEditFamily() {
  const root = document.getElementById('viewRoot');
  if (!root) return;
  const f = FamilyMenu.family;
  if (!f) { FamilyMenu.view = 'list'; renderFamilyList(); return; }

  const head = FamilyMenu.members.find(m => m.is_family_head) || {};

  root.innerHTML = `
    <div class="family-header">
      <h2>Edit Family</h2>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="family-form-card">
      <form id="editFamilyForm">

        <div class="detail-section-title">Family Information</div>
        <div class="family-form-grid">
          <div class="family-field">
            <label for="aushNumber">Aush Number <span class="req">*</span></label>
            <input type="number" id="aushNumber" value="${f.aush_number}" required>
          </div>
          <div class="family-field">
            <label for="houseNumber">House Number</label>
            <input type="text" id="houseNumber" value="${escHtml(f.house_number || '')}">
          </div>
          <div class="family-field" style="grid-column:1 / -1">
            <label for="address">Address</label>
            <textarea id="address" rows="2">${escHtml(f.address || '')}</textarea>
          </div>
          <div class="family-field">
            <label for="category">Social Category</label>
            <select id="category">
              <option value="">Select</option>
              <option value="OBC" ${f.category === 'OBC' ? 'selected' : ''}>OBC</option>
              <option value="SC" ${f.category === 'SC' ? 'selected' : ''}>SC</option>
              <option value="ST" ${f.category === 'ST' ? 'selected' : ''}>ST</option>
              <option value="GENERAL" ${f.category === 'GENERAL' ? 'selected' : ''}>General</option>
            </select>
          </div>
          <div class="family-field">
            <label for="religion">Religion</label>
            <select id="religion">
              <option value="">Select</option>
              <option value="HINDU" ${f.religion === 'HINDU' ? 'selected' : ''}>Hindu</option>
              <option value="MUSLIM" ${f.religion === 'MUSLIM' ? 'selected' : ''}>Muslim</option>
              <option value="OTHER" ${f.religion === 'OTHER' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="family-field">
            <label for="surveyStatus">Survey Status</label>
            <select id="surveyStatus">
              <option value="">Select</option>
              <option value="PENDING" ${f.survey_status === 'PENDING' ? 'selected' : ''}>Pending</option>
              <option value="COMPLETED" ${f.survey_status === 'COMPLETED' ? 'selected' : ''}>Completed</option>
            </select>
          </div>
          <div class="family-field">
            <label for="surveyDate">Survey Date</label>
            <input type="date" id="surveyDate" value="${escHtml(f.survey_date || '')}">
          </div>
        </div>

        <div class="detail-section-title">Family Head Details</div>
        <div class="family-form-grid">
          <div class="family-field" style="grid-column:1 / -1">
            <label for="headName">Head Name <span class="req">*</span></label>
            <input type="text" id="headName" value="${escHtml(head.full_name || '')}" required>
          </div>
          <div class="family-field">
            <label for="headGender">Gender</label>
            <select id="headGender">
              <option value="">Select</option>
              <option value="MALE" ${head.gender === 'MALE' ? 'selected' : ''}>Male</option>
              <option value="FEMALE" ${head.gender === 'FEMALE' ? 'selected' : ''}>Female</option>
              <option value="OTHER" ${head.gender === 'OTHER' ? 'selected' : ''}>Other</option>
            </select>
          </div>
          <div class="family-field">
            <label for="headDob">Date of Birth</label>
            <input type="date" id="headDob" value="${escHtml(head.date_of_birth || '')}">
            <div class="hint" id="headAgePreview">Age: ${calcAge(head.date_of_birth)}</div>
          </div>
          <div class="family-field">
            <label for="headAadhaar">Aadhaar Number</label>
            <input type="text" id="headAadhaar" inputmode="numeric" maxlength="14" value="${escHtml(formatAadhaar(head.aadhaar_number))}">
          </div>
          <div class="family-field">
            <label for="headMobile">Mobile</label>
            <input type="text" id="headMobile" inputmode="numeric" maxlength="10" value="${escHtml(head.mobile || '')}">
          </div>
          <div class="family-field">
            <label for="headJanAadhaar">Jan Aadhaar Number</label>
            <input type="text" id="headJanAadhaar" value="${escHtml(head.jan_aadhaar_number || '')}">
          </div>
          <div class="family-field">
            <label for="headVoterId">Voter ID</label>
            <input type="text" id="headVoterId" value="${escHtml(head.voter_id_number || '')}">
          </div>
          <div class="family-field">
            <label for="headAltMobile">Alternate Mobile</label>
            <input type="text" id="headAltMobile" inputmode="numeric" maxlength="10" value="${escHtml(head.alternate_mobile || '')}">
          </div>
          <div class="family-field">
            <label for="headMarital">Marital Status</label>
            <select id="headMarital">
              <option value="">Select</option>
              <option value="MARRIED" ${head.marital_status === 'MARRIED' ? 'selected' : ''}>Married</option>
              <option value="UNMARRIED" ${head.marital_status === 'UNMARRIED' ? 'selected' : ''}>Unmarried</option>
            </select>
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

  const headAadhaar = document.getElementById('headAadhaar');
  headAadhaar.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 12);
    if (v.length > 8) v = v.slice(0, 4) + '-' + v.slice(4, 8) + '-' + v.slice(8);
    else if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
    e.target.value = v;
  });

  document.getElementById('headDob').addEventListener('change', (e) => {
    document.getElementById('headAgePreview').textContent = 'Age: ' + calcAge(e.target.value);
  });

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

    const headName = document.getElementById('headName').value.trim();
    const aush = parseInt(document.getElementById('aushNumber').value, 10);
    if (!headName) { errDiv.textContent = 'Head Name ज़रूरी है।'; errDiv.style.display = 'block'; return; }
    if (!aush || aush < 1) { errDiv.textContent = 'Aush Number सही डालें।'; errDiv.style.display = 'block'; return; }

    const headMobile = document.getElementById('headMobile').value.trim();
    const headAlt = document.getElementById('headAltMobile').value.trim();
    if (headMobile && !/^\d{10}$/.test(headMobile)) { errDiv.textContent = 'Mobile 10 अंकों का होना चाहिए।'; errDiv.style.display = 'block'; return; }
    if (headAlt && !/^\d{10}$/.test(headAlt)) { errDiv.textContent = 'Alternate Mobile 10 अंकों का होना चाहिए।'; errDiv.style.display = 'block'; return; }
    if (headMobile && headAlt && headMobile === headAlt) { errDiv.textContent = 'Mobile और Alternate Mobile अलग होने चाहिए।'; errDiv.style.display = 'block'; return; }

    const familyPayload = {
      family_name: headName,
      aush_number: aush,
      house_number: document.getElementById('houseNumber').value.trim() || null,
      address: document.getElementById('address').value.trim() || null,
      category: document.getElementById('category').value || null,
      religion: document.getElementById('religion').value || null,
      survey_status: document.getElementById('surveyStatus').value || null,
      survey_date: document.getElementById('surveyDate').value || null
    };

    try {
      await api('/api/families/' + FamilyMenu.familyId, { method: 'PUT', body: familyPayload });

      const headMember = FamilyMenu.members.find(m => m.is_family_head);
      if (headMember) {
        const headPayload = {
          full_name: headName,
          gender: document.getElementById('headGender').value || null,
          date_of_birth: document.getElementById('headDob').value || null,
          aadhaar_number: headAadhaar.value.replace(/\D/g, '') || null,
          mobile: headMobile || null,
          alternate_mobile: headAlt || null,
          jan_aadhaar_number: document.getElementById('headJanAadhaar').value.trim() || null, voter_id_number: document.getElementById('headVoterId').value.trim() || null,
          marital_status: document.getElementById('headMarital').value || null,
          relation_to_head: 'SELF'
        };
        await api('/api/families/' + FamilyMenu.familyId + '/members/' + headMember.id, {
          method: 'PUT', body: headPayload
        });
      }

      showToast('Family & Head updated', 'success');
      FamilyMenu.view = 'familyDetail';
      openFamily(FamilyMenu.familyId);
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}

/* --- Aadhaar formatter --- */
function formatAadhaar(v) {
  const s = (v || '').replace(/\D/g, '');
  if (s.length === 12) return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8);
  return s;
}

/* ==================== ADD MEMBER V3 (cleaned) ==================== */
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
        <div class="detail-section-title">Basic Information</div>
        <div class="family-form-grid">
          <div class="family-field" style="grid-column:1 / -1">
            <label for="fullName">Name <span class="req">*</span></label>
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
          </div>
          <div class="family-field">
            <label for="dob">Date of Birth</label>
            <input type="date" id="dob">
            <div class="hint" id="agePreview">Age: —</div>
          </div>
          <div class="family-field">
            <label for="relation">Relationship with Head <span class="req">*</span></label>
            <select id="relation" required>
              ${RELATION_OPTIONS.map(o => `<option value="${o[0]}" ${o[0] === 'OTHER' ? 'selected' : ''}>${o[1]}</option>`).join('')}
            </select>
          </div>
          <div class="family-field">
            <label for="marital">Marital Status</label>
            <select id="marital">
              <option value="">Select</option>
              <option value="MARRIED">Married</option>
              <option value="UNMARRIED">Unmarried</option>
            </select>
          </div>
          <div class="family-field">
            <label for="occupation">Occupation</label>
            <input type="text" id="occupation">
          </div>
          <div class="family-field">
            <label for="caste">Caste</label>
            <input type="text" id="caste">
          </div>
        </div>

        <button type="button" class="addinfo-toggle" id="idToggle">
          <span>⌄ Identity & Contact Information</span>
          <span class="chev">▼</span>
        </button>
        <div class="addinfo-body" id="idBody">
          <div class="family-form-grid">
            <div class="family-field">
              <label for="aadhaar">Aadhaar Number</label>
              <input type="text" id="aadhaar" inputmode="numeric" maxlength="14" placeholder="XXXX-XXXX-XXXX">    </div>
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

  // Toggle
  const idToggle = document.getElementById('idToggle');
  const idBody = document.getElementById('idBody');
  idToggle.addEventListener('click', () => {
    idToggle.classList.toggle('open');
    idBody.classList.toggle('open');
  });

  document.getElementById('dob').addEventListener('change', (e) => {
    document.getElementById('agePreview').textContent = 'Age: ' + calcAge(e.target.value);
  });

  const aadhaarInput = document.getElementById('aadhaar');
  aadhaarInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 12);
    if (v.length > 8) v = v.slice(0, 4) + '-' + v.slice(4, 8) + '-' + v.slice(8);
    else if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
    e.target.value = v;
  });

  document.getElementById('backBtn').addEventListener('click', () => {
    FamilyMenu.view = 'familyDetail';
    renderFamilyDetail();
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    FamilyMenu.view = 'familyDetail';
    renderFamilyDetail();
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
      relation_to_head: document.getElementById('relation').value,
      marital_status: document.getElementById('marital').value || null,
      occupation: document.getElementById('occupation').value.trim() || null,
      caste: document.getElementById('caste').value.trim() || null,
      aadhaar_number: aadhaarInput.value.replace(/\D/g, '') || null,
      jan_aadhaar_number: document.getElementById('janAadhaar').value.trim() || null,
      voter_id_number: document.getElementById('voterId').value.trim() || null,
      mobile: mobile || null,
      alternate_mobile: altMobile || null
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
