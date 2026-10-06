/* ==================== FAMILY ADD V3 (restructured) ==================== */

function renderAddFamily() {
  const root = document.getElementById('viewRoot');
  if (!root) return;

  root.innerHTML = `
    <div class="family-header">
      <h2>Add Family</h2>
      <div class="header-actions">
        <button class="back-btn" id="backBtn">← Back</button>
      </div>
    </div>

    <div class="family-form-card">
      <form id="addFamilyForm">

        <div class="detail-section-title">Family Information</div>
        <div class="family-form-grid">
          <div class="family-field">
            <label for="aushNumber">Aush Number <span class="req">*</span></label>
            <input type="number" id="aushNumber" value="${FamilyMenu.nextAush}" required>
            <div class="hint">Suggested: ${FamilyMenu.nextAush} (बदल सकते हैं)</div>
          </div>
          <div class="family-field">
            <label for="houseNumber">House Number</label>
            <input type="text" id="houseNumber">
          </div>
          <div class="family-field" style="grid-column:1 / -1">
            <label for="address">Address</label>
            <textarea id="address" rows="2" placeholder="गाँव / वार्ड / पिनकोड सहित पूरा पता"></textarea>
          </div>
          <div class="family-field">
            <label for="category">Social Category</label>
            <select id="category">
              <option value="">Select</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="GENERAL">General</option>
            </select>
          </div>
          <div class="family-field">
            <label for="religion">Religion</label>
            <select id="religion">
              <option value="">Select</option>
              <option value="HINDU">Hindu</option>
              <option value="MUSLIM">Muslim</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div class="family-field">
            <label for="surveyStatus">Survey Status</label>
            <select id="surveyStatus">
              <option value="">Select</option>
              <option value="PENDING">Pending</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
          <div class="family-field">
            <label for="surveyDate">Survey Date</label>
            <input type="date" id="surveyDate">
          </div>
        </div>

        <div class="detail-section-title">Family Head Details</div>
        <div class="family-form-grid">
          <div class="family-field" style="grid-column:1 / -1">
            <label for="headName">Head Name <span class="req">*</span></label>
            <input type="text" id="headName" required autofocus>
            <div class="hint">Family Head का नाम (यही family की मुख्य पहचान होगी)</div>
          </div>
          <div class="family-field">
            <label for="headGender">Gender</label>
            <select id="headGender">
              <option value="">Select</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div class="family-field">
            <label for="headDob">Date of Birth</label>
            <input type="date" id="headDob">
            <div class="hint" id="headAgePreview">Age: —</div>
          </div>
          <div class="family-field">
            <label for="headAadhaar">Aadhaar Number</label>
            <input type="text" id="headAadhaar" inputmode="numeric" maxlength="14" placeholder="XXXX-XXXX-XXXX">
          </div>
          <div class="family-field">
            <label for="headMobile">Mobile</label>
            <input type="text" id="headMobile" inputmode="numeric" maxlength="10">
          </div>
          <div class="family-field">
            <label for="headJanAadhaar">Jan Aadhaar Number</label>
            <input type="text" id="headJanAadhaar">
          </div>
          <div class="family-field">
            <label for="headVoterId">Voter ID</label>
            <input type="text" id="headVoterId">
          </div>
          <div class="family-field">
            <label for="headAltMobile">Alternate Mobile</label>
            <input type="text" id="headAltMobile" inputmode="numeric" maxlength="10">
          </div>
          <div class="family-field">
            <label for="headMarital">Marital Status</label>
            <select id="headMarital">
              <option value="">Select</option>
              <option value="MARRIED">Married</option>
              <option value="UNMARRIED">Unmarried</option>
            </select>
          </div>
        </div>

        <button type="button" class="addinfo-toggle" id="locToggle">
          <span>⌄ Location Information</span>
          <span class="chev">▼</span>
        </button>
        <div class="addinfo-body" id="locBody">
          <div class="location-block">
            <div class="location-row">
              <div class="location-value">
                <span class="lv-label">Latitude</span>
                <span class="lv-val" id="latVal">—</span>
              </div>
              <div class="location-value">
                <span class="lv-label">Longitude</span>
                <span class="lv-val" id="lngVal">—</span>
              </div>
              <div class="location-value">
                <span class="lv-label">Accuracy (m)</span>
                <span class="lv-val" id="accVal">—</span>
              </div>
            </div>
            <div class="location-actions">
              <button type="button" class="family-btn family-btn-primary" id="captureLocBtn">📡 Capture Location</button>
              <button type="button" class="family-btn family-btn-secondary" id="copyLocBtn">📋 Copy</button>
              <button type="button" class="family-btn family-btn-secondary" id="clearLocBtn">✕ Clear</button>
            </div>
            <div id="locStatus" class="location-status info" style="display:none;"></div>
          </div>
        </div>

        <div id="formError" class="login-error" style="display:none;margin-top:14px;"></div>
        <div class="family-form-actions">
          <button type="button" class="family-btn family-btn-secondary" id="cancelBtn">Cancel</button>
          <button type="submit" class="family-btn family-btn-primary">Save Family & Head</button>
        </div>
      </form>
    </div>
  `;

  // --- Location toggle ---
  const locToggle = document.getElementById('locToggle');
  const locBody = document.getElementById('locBody');
  locToggle.addEventListener('click', () => {
    locToggle.classList.toggle('open');
    locBody.classList.toggle('open');
  });

  // --- Location state ---
  let locData = { lat: null, lng: null, acc: null };
  function updateLocDisplay() {
    document.getElementById('latVal').textContent = locData.lat !== null ? locData.lat.toFixed(6) : '—';
    document.getElementById('lngVal').textContent = locData.lng !== null ? locData.lng.toFixed(6) : '—';
    document.getElementById('accVal').textContent = locData.acc !== null ? locData.acc.toFixed(1) : '—';
  }
  function setLocStatus(msg, type) {
    const el = document.getElementById('locStatus');
    el.textContent = msg;
    el.className = 'location-status ' + (type || 'info');
    el.style.display = 'block';
  }

  document.getElementById('captureLocBtn').addEventListener('click', () => {
    if (!navigator.geolocation) { setLocStatus('इस browser में location support नहीं है।', 'err'); return; }
    setLocStatus('Location ला रहे हैं... कृपया allow करें।', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locData.lat = pos.coords.latitude;
        locData.lng = pos.coords.longitude;
        locData.acc = pos.coords.accuracy;
        updateLocDisplay();
        if (pos.coords.accuracy > 5) {
          setLocStatus('Accuracy ' + pos.coords.accuracy.toFixed(1) + 'm (5m से ज़्यादा)। फिर भी save कर सकते हैं।', 'warn');
        } else {
          setLocStatus('Location मिल गई (accuracy ' + pos.coords.accuracy.toFixed(1) + 'm)।', 'ok');
        }
      },
      (err) => setLocStatus('Location नहीं मिली: ' + (err.message || 'Permission deny'), 'err'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  });

  document.getElementById('copyLocBtn').addEventListener('click', () => {
    if (locData.lat === null) { setLocStatus('पहले location capture करें।', 'warn'); return; }
    const txt = locData.lat.toFixed(6) + ', ' + locData.lng.toFixed(6) + ' (±' + locData.acc.toFixed(1) + 'm)';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(() => setLocStatus('Copy हो गया: ' + txt, 'ok'))
        .catch(() => setLocStatus('Copy fail', 'err'));
    } else {
      setLocStatus(txt, 'info');
    }
  });

  document.getElementById('clearLocBtn').addEventListener('click', () => {
    locData = { lat: null, lng: null, acc: null };
    updateLocDisplay();
    document.getElementById('locStatus').style.display = 'none';
  });

  // --- Head DOB age preview ---
  document.getElementById('headDob').addEventListener('change', (e) => {
    document.getElementById('headAgePreview').textContent = 'Age: ' + calcAge(e.target.value);
  });

  // --- Aadhaar format ---
  const headAadhaar = document.getElementById('headAadhaar');
  headAadhaar.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 12);
    if (v.length > 8) v = v.slice(0, 4) + '-' + v.slice(4, 8) + '-' + v.slice(8);
    else if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
    e.target.value = v;
  });

  // --- Navigation ---
  document.getElementById('backBtn').addEventListener('click', () => {
    FamilyMenu.view = 'list';
    renderFamilyList();
  });
  document.getElementById('cancelBtn').addEventListener('click', () => {
    FamilyMenu.view = 'list';
    renderFamilyList();
  });

  // --- Submit ---
  document.getElementById('addFamilyForm').addEventListener('submit', async (e) => {
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

    const payload = {
      family_name: headName,
      aush_number: aush,
      house_number: document.getElementById('houseNumber').value.trim() || null,
      address: document.getElementById('address').value.trim() || null,
      category: document.getElementById('category').value || null,
      religion: document.getElementById('religion').value || null,
      survey_status: document.getElementById('surveyStatus').value || null,
      survey_date: document.getElementById('surveyDate').value || null,
      latitude: locData.lat,
      longitude: locData.lng,
      location_accuracy_meters: locData.acc,
      head_name: headName,
      head_gender: document.getElementById('headGender').value || null,
      head_dob: document.getElementById('headDob').value || null,
      head_aadhaar: headAadhaar.value.replace(/\D/g, '') || null,
      head_mobile: headMobile || null,
      head_alternate_mobile: headAlt || null,
      head_jan_aadhaar: document.getElementById('headJanAadhaar').value.trim() || null,
      head_voter_id: document.getElementById('headVoterId').value.trim() || null,
      head_marital: document.getElementById('headMarital').value || null
    };

    try {
      const res = await api('/api/families', { method: 'POST', body: payload });
      showToast('Family & Head saved', 'success');
      FamilyMenu.familyId = res.family.id;
      FamilyMenu.view = 'familyDetail';
      openFamily(res.family.id);
    } catch (err) {
      errDiv.textContent = err.message;
      errDiv.style.display = 'block';
    }
  });
}
