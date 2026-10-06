/* ==================== LOGS V2 (override) ==================== */

/* --- IST date/time --- */
function fmtDateTime(iso) {
  if (!iso) return '';
  let d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const ist = new Date(d.getTime() + istOffsetMs);
  const pad = n => String(n).padStart(2, '0');
  const day = pad(ist.getUTCDate());
  const month = pad(ist.getUTCMonth() + 1);
  const year = ist.getUTCFullYear();
  let h = ist.getUTCHours();
  const m = pad(ist.getUTCMinutes());
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return day + '/' + month + '/' + year + ', ' + pad(h) + ':' + m + ' ' + ampm + ' IST';
}

/* --- Python-dict/JSON parser --- */
function parseAnyDict(str) {
  if (str === null || str === undefined) return null;
  if (typeof str === 'object') return str;
  const s = String(str).trim();
  if (!s) return null;
  // Try JSON first
  try { return JSON.parse(s); } catch (e) {}
  // Convert Python-style to JSON
  try {
    let j = s
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null');
    return JSON.parse(j);
  } catch (e) {}
  return null;
}

/* --- Human-readable label --- */
function humanLabel(key) {
  const extra = {
    category: 'Social Category',
    religion: 'Religion',
    survey_status: 'Survey Status',
    survey_date: 'Survey Date',
    husband_name: 'Husband Name',
    aush_number: 'Aush Number',
    family_name: 'Family Name',
    house_number: 'House Number'
  };
  if (extra[key]) return extra[key];
  if (typeof FIELD_LABELS !== 'undefined' && FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/* --- Aadhaar masking for logs --- */
function maskLogValue(key, val) {
  if (val === null || val === undefined || val === '') return '—';
  const v = String(val);
  if (key === 'aadhaar_number' && v.length >= 12) {
    return 'XXXX-XXXX-' + v.replace(/\D/g, '').slice(-4);
  }
  if (key === 'jan_aadhaar_number' && v.length > 4) {
    return v.slice(0, 2) + 'XXXX' + v.slice(-2);
  }
  return v;
}

/* --- Render a single log entry --- */
function renderLogEntry(log) {
  const actionLabels = {
    'CREATE': 'Family Created',
    'UPDATE': 'Updated',
    'ADD': 'Member Added',
    'DELETE': 'Archived'
  };
  const action = actionLabels[log.action] || log.action;
  const isMember = log.entity_type === 'FAMILY_MEMBER';
  const icon = isMember ? '👤' : '👨‍👩‍👧';

  let changesHtml = '';

  // Parse the changes dict (backend sends Python-repr in old_values for UPDATE)
  const changes = parseAnyDict(log.old_values);

  if (log.action === 'UPDATE' && changes && typeof changes === 'object') {
    const rows = [];
    Object.keys(changes).forEach(k => {
      const entry = changes[k];
      if (!entry || typeof entry !== 'object') return;
      if (!('old' in entry) && !('new' in entry)) return;
      const o = entry.old;
      const n = entry.new;
      if (String(o === null || o === undefined ? '' : o) === String(n === null || n === undefined ? '' : n)) return;
      rows.push(
        '<div class="chg"><b>' + escHtml(humanLabel(k)) + ':</b> ' +
        '<span class="old">' + escHtml(maskLogValue(k, o)) + '</span>' +
        ' <span class="arrow">→</span> ' +
        '<span class="new">' + escHtml(maskLogValue(k, n)) + '</span></div>'
      );
    });
    if (rows.length) {
      changesHtml = '<details><summary>Changes देखें (' + rows.length + ' field)</summary>' +
        '<div class="log-changes">' + rows.join('') + '</div></details>';
    }
  } else if (log.action === 'ADD' && log.new_values) {
    const nv = parseAnyDict(log.new_values);
    if (nv && typeof nv === 'object') {
      const rows = [];
      Object.keys(nv).forEach(k => {
        const v = nv[k];
        if (v === null || v === undefined || v === '') return;
        rows.push('<div class="chg"><b>' + escHtml(humanLabel(k)) + ':</b> <span class="new">' + escHtml(maskLogValue(k, v)) + '</span></div>');
      });
      if (rows.length) {
        changesHtml = '<details><summary>Details देखें (' + rows.length + ')</summary>' +
          '<div class="log-changes">' + rows.join('') + '</div></details>';
      }
    }
  }

  const userHtml = log.username
    ? '<div class="log-user">👤 ' + escHtml(log.username) + '</div>'
    : '';

  return `
    <div class="log-entry">
      <div class="log-head">
        <span class="log-action">${icon} ${escHtml(action)}</span>
        <span class="log-time">${fmtDateTime(log.created_at)}</span>
      </div>
      <div class="log-detail">${escHtml(log.detail || '')}</div>
      ${userHtml}
      ${changesHtml}
    </div>
  `;
}
