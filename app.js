/* CareRelay — UI shell, router and 15 screens */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(msg) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 3800); }
function go(h) { location.hash = h; }
const route = () => (location.hash.slice(1) || 'login').split('/');

const LOGO = `<svg width="30" height="30" viewBox="0 0 32 32" aria-label="CareRelay logo"><rect width="32" height="32" rx="9" fill="#0f9e8e"/><path d="M6 20h5.5l3-8 3.2 12 3-8H24" stroke="#04221f" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const STATUS_TAG = { Confirmed: 't-ok', LastKnown: 't-info', Pending: 't-warn', Expired: 't-bad', Unavailable: 't-bad' };
const sTag = s => `<span class="tag ${STATUS_TAG[s] || 't-mute'}">${s === 'LastKnown' ? 'Last Known' : s}</span>`;
const stateTag = s => `<span class="tag ${s === 'Followed-up' ? 't-ok' : s === 'Requested' ? 't-warn' : 't-info'}">${s}</span>`;

const NAV = {
  ASHA: [['asha', 'ASHA Dashboard'], ['register', 'Register Patient'], ['followup', 'Follow-ups'], ['sync', 'Offline Queue']],
  FACILITY: [['hospital', 'Referral Inbox'], ['readiness', 'Facility Readiness'], ['revalidate', 'Pre-Travel Revalidation'], ['lab', 'Lab & Pharmacy']],
  DOCTOR: [['doctor', 'Doctor Dashboard'], ['hospital', 'Referral Inbox'], ['readiness', 'Facility Readiness']],
  LAB: [['lab', 'Lab & Pharmacy'], ['readiness', 'Facility Readiness']],
  ADMIN: [['admin', 'District Dashboard'], ['hospital', 'All Referrals'], ['readiness', 'Facility Readiness'], ['audit', 'Audit Log']],
  PATIENT: [['patients', 'My Care Card']]
};

/* ============================ SHELL ============================ */
function render() {
  const r = route();
  if (!DB.meta.role || r[0] === 'login') return renderLogin();
  const nav = (NAV[DB.meta.role] || []).concat([['demo', 'Guided Demo'], ['patients', 'Patients']]);
  $('#app').innerHTML = `<div class="shell">
    <aside>
      <div class="logo">${LOGO}<div><b>CareRelay</b><span>Journey-ready care</span></div></div>
      <nav>
        <div class="grp">${DB.meta.role} · ${esc(usr(DB.meta.userId))}</div>
        ${nav.map(([h, l]) => `<a href="#${h}" class="${r[0] === h ? 'on' : ''}">${l}${h === 'sync' && pendingCount() ? `<span class="pill">${pendingCount()}</span>` : ''}${h === 'followup' && DB.followups.filter(f => f.state !== 'Done').length ? `<span class="pill">${DB.followups.filter(f => f.state !== 'Done').length}</span>` : ''}</a>`).join('')}
        <div class="grp">Session</div>
        <a href="#login">Switch role</a>
        <a href="#" onclick="resetDB();go('login');return false">Reset demo data</a>
      </nav>
      <div style="margin-top:auto;font-size:11px;color:#7fa8a5;padding:10px">Prototype with DEMO DATA. No live ABDM / eSanjeevani connection.</div>
    </aside>
    <main id="main"></main></div>`;
  const body = {
    asha: scAsha, register: scRegister, patients: scPatients, patient: scPatient, triage: scTriage, refer: scRefer,
    hospital: scHospital, readiness: scReadiness, bundle: scBundle, revalidate: scRevalidate, doctor: scDoctor,
    lab: scLab, card: scCard, followup: scFollowup, admin: scAdmin, audit: scAudit, sync: scSync, demo: scDemo
  }[r[0]] || scAsha;
  $('#main').innerHTML = body(r.slice(1));
}
function head(title, sub, actions) {
  return `<div class="topbar"><div><h1>${title}</h1><p>${sub || ''}</p></div><div class="spacer"></div>
    <div class="offline"><span class="dot ${DB.meta.offline ? 'off' : ''}"></span>${DB.meta.offline ? 'Offline mode' : 'Online'}</div>
    <button class="btn alt mini" onclick="DB.meta.offline=!DB.meta.offline;save();render()">${DB.meta.offline ? 'Go online' : 'Simulate offline'}</button>
    <button class="btn mini" onclick="syncNow();render()">Sync Now${pendingCount() ? ' (' + pendingCount() + ')' : ''}</button>
    ${actions || ''}</div>`;
}

/* ============================ 1. LOGIN ============================ */
function renderLogin() {
  const roles = [
    ['U1', 'ASHA / ANM', 'Register patients offline, triage, create referrals, close follow-ups'],
    ['U3', 'PHC / Rural Hospital staff', 'Accept referrals, schedule, verify readiness, revalidate before travel'],
    ['U4', 'Doctor / Clinician', 'Review vitals and results, decide next stage, sign off referrals'],
    ['U5', 'Lab / Pharmacy staff', 'Update reagent, equipment and medicine claims; upload results'],
    ['U7', 'District Administrator', 'Monitor bottlenecks, readiness failures, overdue referrals'],
    ['PT', 'Patient view', 'Printed / low-literacy care card in English, Marathi, Hindi']
  ];
  $('#app').innerHTML = `<div class="login"><div class="box">
    <div class="row tight" style="align-items:center;gap:12px">${LOGO}<div><h1 style="margin:0;font-size:22px;letter-spacing:-.02em">CareRelay</h1>
    <p class="muted" style="margin:2px 0 0">SIH26133 prototype · offline-first coordination of complete care journeys</p></div></div>
    <div class="banner b-info" style="margin:16px 0"><b>Don't just book the patient — make sure the journey is ready.</b></div>
    <p class="muted">Select a role to enter the prototype. All data on this device is demo data.</p>
    <div class="roles">${roles.map(([id, n, d]) => `<button class="role" onclick="pick('${id}')"><b>${n}</b><small>${d}</small></button>`).join('')}</div>
    <div class="row tight" style="margin-top:16px"><label style="margin:0">Patient-facing language</label>
      ${['en', 'mr', 'hi'].map(l => `<button class="btn ${DB.meta.lang === l ? 'acc' : 'alt'} mini" onclick="DB.meta.lang='${l}';save();renderLogin()">${{ en: 'English', mr: 'मराठी', hi: 'हिंदी' }[l]}</button>`).join('')}
    </div></div></div>`;
}
function pick(id) {
  if (id === 'PT') { DB.meta.role = 'PATIENT'; DB.meta.userId = 'U1'; save(); return go('card/R-1039'); }
  const u = by(DB.users, id); DB.meta.role = u.role; DB.meta.userId = u.id; save();
  go({ ASHA: 'asha', FACILITY: 'hospital', DOCTOR: 'doctor', LAB: 'lab', ADMIN: 'admin' }[u.role]);
}

/* ============================ 2. ASHA DASHBOARD ============================ */
function scAsha() {
  const mine = DB.patients.filter(p => p.createdBy === DB.meta.userId || true);
  const myRefs = DB.referrals.filter(r => r.createdBy === DB.meta.userId || DB.meta.role !== 'ASHA');
  const fu = DB.followups.filter(f => f.assignedTo === DB.meta.userId && f.state !== 'Done');
  return head('ASHA field dashboard', esc(usr(DB.meta.userId)) + ' · ' + fac(by(DB.users, DB.meta.userId).facilityId),
    `<button class="btn acc mini" onclick="go('register')">+ New patient</button>`) + `
  <div class="grid g4" style="margin-bottom:14px">
    ${kpi(mine.length, 'Patients')}${kpi(myRefs.filter(r => r.state !== 'Followed-up').length, 'Open referrals')}
    ${kpi(fu.length, 'Follow-ups due')}${kpi(pendingCount(), 'Queued offline')}</div>
  <div class="grid g2">
    <div class="card"><h3>My referrals — journey status</h3><table><tr><th>Patient</th><th>Referral</th><th>Stage</th><th>Journey</th><th></th></tr>
    ${myRefs.map(r => { const b = bundleFor(r.id); return `<tr><td><b>${esc(pat(r.patientId).name)}</b><div class="muted">${esc(pat(r.patientId).village)} · ${pat(r.patientId).distanceKm} km</div></td>
      <td class="mono">${r.id}</td><td>${stateTag(r.state)}${isOverdue(r) ? ' <span class="tag t-bad">Overdue</span>' : ''}</td>
      <td>${b ? (b.status === 'READY' ? '<span class="tag t-ok">TRAVEL READY</span>' : '<span class="tag t-bad">NOT READY</span>') : '<span class="tag t-mute">No bundle</span>'}</td>
      <td><button class="btn alt mini" onclick="go('bundle/${r.id}')">Open</button></td></tr>`; }).join('')}</table></div>
    <div class="card"><h3>Patients</h3><table><tr><th>Name</th><th>Age</th><th>Village</th><th>Sync</th><th></th></tr>
    ${mine.map(p => `<tr><td>${esc(p.name)}</td><td>${p.age}${p.sex}</td><td>${esc(p.village)}</td>
      <td>${p.synced ? '<span class="tag t-ok">Synced</span>' : '<span class="tag t-warn">On device</span>'}</td>
      <td><button class="btn alt mini" onclick="go('patient/${p.id}')">Open</button></td></tr>`).join('')}</table></div>
    <div class="card"><h3>Follow-up tasks assigned to me</h3>${fu.length ? `<ul class="list">${fu.map(f => `<li><b>${esc(pat(f.patientId).name)}</b> — ${esc(f.task)} <span class="tag ${f.state === 'Overdue' ? 't-bad' : 't-warn'}">${f.state} ${rel(f.dueAt)}</span></li>`).join('')}</ul>` : '<p class="muted">Nothing pending.</p>'}
      <button class="btn alt mini" style="margin-top:10px" onclick="go('followup')">Open follow-up dashboard</button></div>
    <div class="card"><h3>Device sync</h3><p class="muted">Registration, vitals and referrals work fully offline. Live facts (slots, stock) are shown as <b>Last Known</b> until the device syncs.</p>
      <div class="row tight"><button class="btn" onclick="syncNow();render()">Sync Now</button><button class="btn alt" onclick="go('sync')">View queue (${pendingCount()})</button></div></div>
  </div>`;
}
const kpi = (v, l) => `<div class="card kpi"><small>${l}</small><b>${v}</b></div>`;

/* ============================ 3. PATIENT REGISTRATION ============================ */
function scRegister() {
  return head('Register patient', 'Works offline. Saved on device with timestamp, queued for sync.') + `
  <div class="card" style="max-width:720px">
    <div class="row"><div><label>Full name</label><input id="n" placeholder="Name as on records"></div>
      <div><label>Age</label><input id="a" type="number" value="52"></div>
      <div><label>Sex</label><select id="s"><option>F</option><option>M</option><option>Other</option></select></div></div>
    <div class="row"><div><label>Village / hamlet</label><input id="v" placeholder="Village"></div>
      <div><label>Distance to referral facility (km)</label><input id="d" type="number" value="26"></div></div>
    <div class="row"><div><label>Phone (optional — smartphone not required)</label><input id="ph" placeholder="+91"></div>
      <div><label>ABHA ID (optional, never blocks care)</label><input id="ab" placeholder="Leave blank if unavailable"></div>
      <div><label>Preferred language</label><select id="lg"><option value="mr">Marathi</option><option value="hi">Hindi</option><option value="en">English</option></select></div></div>
    <label>Consent</label><div class="muted">Verbal consent recorded by ASHA for storing minimum necessary health data. Recorded in audit log.</div>
    <div class="row tight" style="margin-top:14px"><button class="btn" onclick="saveNewPatient()">Save patient${DB.meta.offline ? ' (offline)' : ''}</button>
      <button class="btn alt" onclick="go('asha')">Cancel</button></div>
  </div>`;
}
function saveNewPatient() {
  const name = $('#n').value.trim(); if (!name) return toast('Name is required.');
  const p = { id: uid('P'), name, age: +$('#a').value || 0, sex: $('#s').value, village: $('#v').value.trim() || '—',
    phone: $('#ph').value, abha: $('#ab').value, lang: $('#lg').value, distanceKm: +$('#d').value || 0,
    createdBy: DB.meta.userId, createdAt: now() };
  write('patient', p, 'Patient ' + name); go('patient/' + p.id);
}

/* ============================ 4. PATIENT PROFILE + VITALS ============================ */
function scPatients() {
  return head('Patients', 'All patients known to this device') + `<div class="card"><table><tr><th>Name</th><th>Age/Sex</th><th>Village</th><th>Distance</th><th>ABHA</th><th>Sync</th><th></th></tr>
  ${DB.patients.map(p => `<tr><td><b>${esc(p.name)}</b></td><td>${p.age}${p.sex}</td><td>${esc(p.village)}</td><td>${p.distanceKm} km</td>
  <td class="mono">${p.abha ? esc(p.abha) : '<span class="tag t-mute">none</span>'}</td><td>${p.synced ? '<span class="tag t-ok">Synced</span>' : '<span class="tag t-warn">On device</span>'}</td>
  <td><button class="btn alt mini" onclick="go('patient/${p.id}')">Open</button></td></tr>`).join('')}</table></div>`;
}
function scPatient(a) {
  const p = pat(a[0]); if (!p.id) return '<p>Patient not found.</p>';
  const vs = DB.vitals.filter(v => v.patientId === p.id).sort((x, y) => y.at - x.at);
  const rs = DB.referrals.filter(r => r.patientId === p.id);
  return head(esc(p.name), `${p.age}${p.sex} · ${esc(p.village)} · ${p.distanceKm} km from referral facility · language ${p.lang}`) + `
  <div class="grid g2">
    <div class="card"><h3>Record vitals (offline capable)</h3>
      <div class="row"><div><label>BP systolic</label><input id="bs" type="number" value="158"></div><div><label>BP diastolic</label><input id="bd" type="number" value="96"></div>
      <div><label>Random glucose (mg/dL)</label><input id="gl" type="number" value="268"></div></div>
      <div class="row"><div><label>SpO2 %</label><input id="sp" type="number" value="97"></div><div><label>Temp °F</label><input id="tp" type="number" value="98.4"></div><div><label>Pulse</label><input id="pu" type="number" value="88"></div></div>
      <label>Complaint / note</label><input id="nt" value="Fatigue, blurred vision, known diabetic">
      <div class="row tight" style="margin-top:12px"><button class="btn" onclick="saveVitals('${p.id}')">Save &amp; run triage</button></div></div>
    <div class="card"><h3>Vitals history</h3><table><tr><th>When</th><th>BP</th><th>Glucose</th><th>SpO2</th><th>Sync</th></tr>
      ${vs.length ? vs.map(v => `<tr><td>${fmt(v.at)}</td><td>${v.bpSys}/${v.bpDia}</td><td>${v.glucose}</td><td>${v.spo2}%</td><td>${v.synced ? '<span class="tag t-ok">Synced</span>' : '<span class="tag t-warn">Queued</span>'}</td></tr>`).join('') : '<tr><td colspan=5 class="muted">No vitals yet.</td></tr>'}</table></div>
    <div class="card"><h3>Care journeys</h3>${rs.length ? rs.map(r => `<div class="row tight" style="justify-content:space-between;border-bottom:1px solid #eef3f0;padding:7px 0">
      <span class="mono">${r.id}</span>${stateTag(r.state)}<span class="muted">${esc(fac(r.toFacility))}</span>
      <button class="btn alt mini" onclick="go('bundle/${r.id}')">Bundle</button></div>`).join('') : '<p class="muted">No referrals yet.</p>'}
      <button class="btn acc mini" style="margin-top:10px" onclick="go('refer/${p.id}')">Create referral</button></div>
    <div class="card"><h3>Identity &amp; data minimisation</h3><ul class="list">
      <li>ABHA ID: ${p.abha ? '<span class="mono">' + esc(p.abha) + '</span>' : 'not available — care is never blocked'}</li>
      <li>Only fields needed for this journey are stored on the field device.</li>
      <li>Printed card and SMS carry a reference code only — no diagnosis, no lab values.</li></ul></div>
  </div>`;
}
function saveVitals(pid) {
  const enc = { id: uid('E'), patientId: pid, by: DB.meta.userId, at: now(), type: 'HouseholdVisit', note: $('#nt').value };
  write('encounter', enc, 'Encounter for ' + pat(pid).name);
  const v = { id: uid('V'), encounterId: enc.id, patientId: pid, at: now(), bpSys: +$('#bs').value, bpDia: +$('#bd').value, glucose: +$('#gl').value, spo2: +$('#sp').value, temp: +$('#tp').value, pulse: +$('#pu').value };
  write('vital', v, 'Vitals for ' + pat(pid).name);
  go('triage/' + v.id);
}

/* ============================ 5. RULE-BASED TRIAGE ============================ */
function scTriage(a) {
  const v = by(DB.vitals, a[0]); if (!v) return '<p>Vitals not found.</p>';
  const p = pat(v.patientId), t = triage(v, p);
  const map = { EMERGENCY: ['b-bad', 'EMERGENCY — do not wait for internet, ABHA or appointment'], FACILITY_VISIT: ['b-info', 'FACILITY VISIT with confirmed diagnostics required'], LOCAL_DIAGNOSTICS: ['b-info', 'LOCAL DIAGNOSTICS at PHC'], TELECONSULT: ['b-info', 'TELECONSULTATION with medical officer'], ROUTINE: ['b-ok', 'ROUTINE — home advice and next visit'] };
  return head('Rule-based triage', 'Transparent clinical rules — no AI, no black box. ' + esc(p.name)) + `
  <div class="banner ${map[t.outcome][0]}" style="margin-bottom:14px"><b>${map[t.outcome][1]}</b></div>
  <div class="grid g2">
    <div class="card"><h3>Readings used</h3><table><tr><th>BP</th><th>Glucose</th><th>SpO2</th><th>Temp</th><th>Pulse</th></tr>
      <tr><td>${v.bpSys}/${v.bpDia}</td><td>${v.glucose} mg/dL</td><td>${v.spo2}%</td><td>${v.temp}°F</td><td>${v.pulse}</td></tr></table>
      <p class="muted" style="margin-top:8px">Recorded ${fmt(v.at)} ${v.synced ? '(synced)' : '(on device, queued)'}</p></div>
    <div class="card"><h3>Rules evaluated</h3><ul class="list">${t.rules.map(r => `<li>${r.hit ? '<span class="tag t-bad">HIT</span>' : '<span class="tag t-mute">pass</span>'} ${esc(r.msg)}</li>`).join('')}</ul></div>
    <div class="card"><h3>Next action</h3><div class="row tight">
      ${t.outcome === 'EMERGENCY' ? `<button class="btn danger" onclick="emergency('${p.id}')">Activate emergency override</button>` : ''}
      <button class="btn" onclick="go('refer/${p.id}')">Create referral</button>
      <button class="btn alt" onclick="go('patient/${p.id}')">Back to patient</button></div>
      <p class="muted" style="margin-top:10px">Emergency override skips internet, ABHA, appointment and bundle completeness. Everything else demands a verified, unexpired readiness claim before the patient travels.</p></div>
  </div>`;
}
function emergency(pid) {
  const r = { id: uid('R'), patientId: pid, fromFacility: 'F1', toFacility: 'F4', reason: 'EMERGENCY — critical vitals', priority: 'Emergency', state: 'Requested', createdBy: DB.meta.userId, createdAt: now(), owner: 'U3', dueAt: now() + 0.5 * HOUR, requiredResources: ['Doctor'], serviceRequest: 'Immediate stabilisation', history: [{ state: 'Requested', at: now(), by: DB.meta.userId, note: 'Emergency override — bundle checks bypassed' }], emergency: true };
  write('referral', r, 'EMERGENCY referral ' + r.id);
  notify('U3', `EMERGENCY ${r.id} for ${pat(pid).name}. Transport dispatched, no gating checks applied.`);
  toast('Emergency referral raised — no gating checks applied.'); go('bundle/' + r.id);
}

/* ============================ 6. REFERRAL CREATION ============================ */
function scRefer(a) {
  const p = pat(a[0]);
  return head('Create referral', 'Patient ' + esc(p.name) + ' · ' + p.distanceKm + ' km to travel') + `
  <div class="card" style="max-width:760px">
    <div class="row"><div><label>Refer to facility</label><select id="tf">${DB.facilities.filter(f => f.level > 1).map(f => `<option value="${f.id}">${esc(f.name)} (${f.type})</option>`).join('')}</select></div>
      <div><label>Priority</label><select id="pr"><option>Routine</option><option selected>Urgent</option><option>Emergency</option></select></div></div>
    <label>Clinical reason</label><input id="rs" value="Uncontrolled type-2 diabetes with raised BP">
    <label>Requested services (ServiceRequest)</label><input id="sv" value="HbA1c + FBS + Serum creatinine">
    <label>Resources this journey requires</label>
    <div class="row tight" style="gap:14px;margin-top:6px">${['Doctor', 'Lab', 'Technician', 'Reagents', 'Medicine', 'Equipment'].map(r => `<label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="c_${r}" ${['Doctor', 'Lab', 'Technician', 'Reagents', 'Medicine'].includes(r) ? 'checked' : ''} style="width:auto"> ${r}</label>`).join('')}</div>
    <div class="banner b-info" style="margin-top:14px">Referral is <b>Requested</b> only. It becomes a real journey when the receiving facility accepts, schedules and every required resource is confirmed and unexpired.</div>
    <div class="row tight" style="margin-top:14px"><button class="btn" onclick="createRef('${p.id}')">Send referral${DB.meta.offline ? ' (queue offline)' : ''}</button>
      <button class="btn alt" onclick="go('patient/${p.id}')">Cancel</button></div></div>`;
}
function createRef(pid) {
  const req = ['Doctor', 'Lab', 'Technician', 'Reagents', 'Medicine', 'Equipment'].filter(r => $('#c_' + r).checked);
  const r = { id: uid('R'), patientId: pid, fromFacility: by(DB.users, DB.meta.userId).facilityId, toFacility: $('#tf').value,
    reason: $('#rs').value, priority: $('#pr').value, state: 'Requested', createdBy: DB.meta.userId, createdAt: now(),
    owner: 'U3', dueAt: now() + SLA.Requested * HOUR, requiredResources: req, serviceRequest: $('#sv').value,
    history: [{ state: 'Requested', at: now(), by: DB.meta.userId, note: DB.meta.offline ? 'Created offline' : 'Created online' }] };
  write('referral', r, 'Referral ' + r.id);
  notify('U3', `New ${r.priority} referral ${r.id} for ${pat(pid).name}. Acknowledge within ${SLA.Requested}h.`);
  go('bundle/' + r.id);
}

/* ============================ 7. HOSPITAL REFERRAL INBOX ============================ */
function scHospital() {
  const me = by(DB.users, DB.meta.userId);
  const refs = DB.referrals.filter(r => DB.meta.role === 'ADMIN' || r.toFacility === me.facilityId);
  return head('Referral inbox — accountable closure', 'Every stage has an owner, a deadline and an escalation path.') + `
  <div class="card"><table><tr><th>Referral</th><th>Patient</th><th>From</th><th>Stage</th><th>Owner</th><th>Due</th><th>Journey</th><th>Action</th></tr>
  ${refs.map(r => { const b = bundleFor(r.id), ev = evaluateBundle(r); const nxt = FLOW[FLOW.indexOf(r.state) + 1];
    return `<tr><td class="mono">${r.id}${r.emergency ? ' <span class="tag t-bad">EMG</span>' : ''}</td>
    <td><b>${esc(pat(r.patientId).name)}</b><div class="muted">${esc(r.reason)}</div></td>
    <td>${esc(fac(r.fromFacility))}</td><td>${stateTag(r.state)}</td><td>${esc(usr(r.owner))}</td>
    <td>${r.dueAt ? `${fmt(r.dueAt)}<div class="${isOverdue(r) ? '' : 'muted'}">${isOverdue(r) ? '<span class="tag t-bad">Overdue ' + rel(r.dueAt) + '</span>' : rel(r.dueAt)}</div>` : '<span class="tag t-ok">Closed</span>'}</td>
    <td>${b ? (b.status === 'READY' ? '<span class="tag t-ok">READY</span>' : `<span class="tag t-bad">NOT READY</span><div class="muted">${ev.failed.map(f => f.resource).join(', ')}</div>`) : '<span class="tag t-mute">no bundle</span>'}</td>
    <td><div class="row tight" style="gap:6px">
      ${nxt ? `<button class="btn mini" onclick="doAdvance('${r.id}','${nxt}')">${nxt}</button>` : ''}
      <button class="btn alt mini" onclick="go('bundle/${r.id}')">Bundle</button>
      ${isOverdue(r) ? `<button class="btn danger mini" onclick="escalate('${r.id}');render()">Escalate</button>` : ''}
    </div></td></tr>`; }).join('')}</table></div>
  <div class="card" style="margin-top:14px"><h3>Stage ownership &amp; SLA rules (prototype)</h3><table><tr><th>Stage reached</th><th>Next owner</th><th>Deadline</th></tr>
    ${Object.keys(SLA).filter(k => k !== 'Followed-up').map(k => `<tr><td>${k}</td><td>${NEXT_OWNER[k]}</td><td>${SLA[k]} h</td></tr>`).join('')}</table></div>`;
}
function doAdvance(id, to) {
  if (to === 'Scheduled') {
    const at = now() + 1 * DAY + 4 * HOUR;
    if (!DB.appointments.find(a => a.referralId === id)) DB.appointments.push({ id: uid('A'), referralId: id, facilityId: by(DB.referrals, id).toFacility, at, slot: '10:30', dept: 'OPD-2', coordinator: 'U3' });
    advance(id, to); generateBundle(id);
  } else advance(id, to);
  render();
}

/* ============================ 8. FACILITY READINESS ============================ */
function scReadiness() {
  const me = by(DB.users, DB.meta.userId);
  const facs = DB.meta.role === 'ADMIN' ? DB.facilities.filter(f => f.level > 1) : DB.facilities.filter(f => f.id === me.facilityId);
  return head('Facility readiness', 'Every availability claim carries who verified it, when, and how long it stays valid.') + facs.map(f => {
    const ks = facilityReadiness(f.id);
    return `<div class="card" style="margin-bottom:14px"><h3>${esc(f.name)} · ${f.type}</h3>
    <table><tr><th>Resource</th><th>Detail</th><th>Status</th><th>Last verified</th><th>Valid until</th><th>Verified by</th><th>Re-verify</th></tr>
    ${ks.map(k => `<tr><td><b>${k.resource}</b></td><td>${esc(k.detail)}${k.note ? `<div class="muted">${esc(k.note)}</div>` : ''}</td>
      <td>${sTag(k.status)}</td><td>${fmt(k.verifiedAt)}<div class="muted">${rel(k.verifiedAt)}</div></td>
      <td>${fmt(k.validUntil)}<div class="muted">${k.status === 'Expired' ? 'expired ' + rel(k.validUntil) : rel(k.validUntil)}</div></td>
      <td>${esc(usr(k.by))}</td>
      <td><div class="row tight" style="gap:5px"><button class="btn mini" onclick="verifyClaim('${k.id}','Confirmed',24);render()">Confirm 24h</button>
        <button class="btn alt mini" onclick="verifyClaim('${k.id}','Unavailable',24);render()">Unavailable</button></div></td></tr>`).join('')}</table></div>`;
  }).join('') + `<div class="card"><h3>Why validity windows matter</h3><p class="muted">A "doctor available" tick from three days ago is not information — it is a guess. CareRelay treats a stale claim as <b>Expired</b> and refuses to call the journey ready until someone re-verifies it. Expired and Unavailable both block travel; Last Known and Pending are shown honestly but never counted as ready.</p></div>`;
}

/* ============================ 9. TRAVEL-READY CARE BUNDLE ============================ */
function scBundle(a) {
  const ref = by(DB.referrals, a[0]); if (!ref) return '<p>Referral not found.</p>';
  const b = bundleFor(ref.id), ev = evaluateBundle(ref), p = pat(ref.patientId);
  const appt = DB.appointments.find(x => x.referralId === ref.id);
  return head('Travel-Ready Care Bundle', `${esc(p.name)} · ${ref.id} · ${esc(fac(ref.fromFacility))} → ${esc(fac(ref.toFacility))}`,
    `<button class="btn alt mini" onclick="go('card/${ref.id}')">Patient card</button><button class="btn mini" onclick="go('revalidate/${ref.id}')">Revalidate</button>`) + `
  <div class="steps" style="margin-bottom:14px">${FLOW.map(s => `<i class="${FLOW.indexOf(s) < FLOW.indexOf(ref.state) ? 'done' : s === ref.state ? 'now' : ''}">${s}</i>`).join('<span class="muted">→</span>')}</div>
  ${ref.emergency ? `<div class="banner b-bad" style="margin-bottom:14px"><b>EMERGENCY OVERRIDE ACTIVE</b> — travel proceeds immediately; internet, ABHA, appointment and bundle completeness are bypassed.</div>` : ''}
  ${b ? `<div class="banner ${b.status === 'READY' ? 'b-ok' : 'b-bad'}" style="margin-bottom:14px">
      <b>${b.status === 'READY' ? '✔ TRAVEL READY' : '✕ TRAVEL NOT READY'}</b>
      <span>${b.status === 'READY' ? 'All required components confirmed and unexpired. Last validated ' + rel(b.lastValidatedAt) + '.'
        : 'Failed components: ' + ev.failed.map(f => f.resource + ' (' + f.status + ')').join(', ') + '. Patient must not travel yet.'}</span></div>`
    : `<div class="banner b-info" style="margin-bottom:14px">No bundle yet. Accept and schedule the referral, then generate the bundle.
      <button class="btn mini" onclick="generateBundle('${ref.id}');render()">Generate bundle</button></div>`}
  <div class="grid g2">
    <div class="card"><h3>Clinically sequenced bundle items</h3><table><tr><th>Component</th><th>Detail</th><th>Status</th><th>Valid until</th><th>Owner</th></tr>
      ${ev.items.map(i => `<tr><td><b>${i.resource}</b></td><td>${esc(i.detail)}</td><td>${sTag(i.status)}</td>
        <td>${i.validUntil ? fmt(i.validUntil) : '—'}</td><td>${i.owner ? esc(usr(i.owner)) : '—'}</td></tr>`).join('')}</table>
      <p class="muted" style="margin-top:8px">Order matters: registration → doctor → sample → lab → result → medicines. A confirmed doctor with expired reagents is still a wasted journey.</p></div>
    <div class="card"><h3>Journey logistics</h3><ul class="list">
      <li><b>Appointment:</b> ${appt ? fmt(appt.at) + ' · ' + appt.dept + ' · slot ' + appt.slot : 'not scheduled'}</li>
      <li><b>Coordinator:</b> ${esc(usr(appt ? appt.coordinator : ref.owner))} · ${esc((by(DB.users, appt ? appt.coordinator : ref.owner) || {}).phone || '')}</li>
      <li><b>Transport:</b> ${b ? esc(b.transport) : 'pending'}</li>
      <li><b>Fallback plan:</b> ${b ? esc(b.fallback) : 'pending'}</li>
      <li><b>Patient instructions:</b> fasting since 22:00, bring old prescriptions and this card</li>
      <li><b>Travel distance:</b> ${p.distanceKm} km one way</li></ul>
      ${ev.failed.length ? `<div class="banner b-bad" style="margin-top:12px"><div><b>Fix required</b><div class="muted">${ev.failed.map(f => `${f.resource} — notify ${esc(usr(f.owner || ref.owner))}`).join('<br>')}</div></div></div>` : ''}
      <div class="row tight" style="margin-top:12px"><button class="btn" onclick="go('revalidate/${ref.id}')">Run pre-travel revalidation</button>
      <button class="btn alt" onclick="go('readiness')">Fix readiness</button></div></div>
    <div class="card"><h3>Referral timeline</h3><ul class="timeline">${ref.history.map(h => `<li><b>${h.state}</b> · ${fmt(h.at)} · ${esc(usr(h.by))}${h.note ? `<div class="muted">${esc(h.note)}</div>` : ''}</li>`).join('')}</ul></div>
    <div class="card"><h3>FHIR R4 mapping (prototype shape only)</h3><table><tr><th>CareRelay</th><th>FHIR R4</th></tr>
      <tr><td>Patient ${p.id}</td><td class="mono">Patient</td></tr><tr><td>ASHA visit</td><td class="mono">Encounter</td></tr>
      <tr><td>Vitals / glucose</td><td class="mono">Observation</td></tr><tr><td>Requested tests</td><td class="mono">ServiceRequest</td></tr>
      <tr><td>Appointment</td><td class="mono">Appointment</td></tr><tr><td>Lab result</td><td class="mono">DiagnosticReport</td></tr>
      <tr><td>Medicines</td><td class="mono">MedicationRequest</td></tr><tr><td>Readiness claim</td><td class="mono">custom extension (no FHIR equivalent)</td></tr></table>
      <p class="muted" style="margin-top:8px">Resources are shaped for ABDM/FHIR alignment. No live ABDM or eSanjeevani connection exists in this prototype.</p></div>
  </div>`;
}

/* ============================ 10. PRE-TRAVEL REVALIDATION ============================ */
function scRevalidate(a) {
  const target = a[0];
  if (!target) {
    const list = DB.bundles.map(b => ({ b, r: by(DB.referrals, b.referralId) })).filter(x => x.r);
    return head('Pre-travel revalidation', 'Evening-before check. Nothing is trusted twice without re-verification.') + `
    <div class="card"><table><tr><th>Referral</th><th>Patient</th><th>Travel</th><th>Bundle</th><th>Last validated</th><th></th></tr>
    ${list.map(({ b, r }) => `<tr><td class="mono">${r.id}</td><td>${esc(pat(r.patientId).name)}</td>
      <td>${(DB.appointments.find(x => x.referralId === r.id) || {}).at ? fmt(DB.appointments.find(x => x.referralId === r.id).at) : '—'}</td>
      <td>${b.status === 'READY' ? '<span class="tag t-ok">READY</span>' : '<span class="tag t-bad">NOT READY</span>'}</td>
      <td>${fmt(b.lastValidatedAt)} <span class="muted">(${rel(b.lastValidatedAt)})</span></td>
      <td><button class="btn mini" onclick="go('revalidate/${r.id}')">Revalidate</button></td></tr>`).join('')}</table></div>`;
  }
  const ref = by(DB.referrals, target); const res = revalidate(target, DB.meta.userId);
  if (!res) return head('Pre-travel revalidation', '') + '<div class="banner b-info">No bundle for this referral yet. Schedule it first.</div>';
  const { bundle, ev } = res;
  return head('Pre-travel revalidation — ' + ref.id, 'Re-checked just now at ' + fmt(now())) + `
  <div class="banner ${bundle.status === 'READY' ? 'b-ok' : 'b-bad'}" style="margin-bottom:14px">
    <b>${bundle.status === 'READY' ? '✔ REVALIDATION PASSED — TRAVEL READY' : '✕ REVALIDATION FAILED — TRAVEL NOT READY'}</b>
    <span>${bundle.status === 'READY' ? 'Patient and ASHA notified to travel as planned.' : 'Responsible staff notified. Patient told to wait; fallback offered.'}</span></div>
  <div class="grid g2">
    <div class="card"><h3>Component-by-component re-check</h3><table><tr><th>Component</th><th>Status</th><th>Valid until</th><th>Verdict</th></tr>
      ${ev.items.map(i => `<tr><td><b>${i.resource}</b><div class="muted">${esc(i.detail)}</div></td><td>${sTag(i.status)}</td><td>${i.validUntil ? fmt(i.validUntil) : '—'}</td>
      <td>${i.status === 'Confirmed' ? '<span class="tag t-ok">Pass</span>' : '<span class="tag t-bad">Blocks travel</span>'}</td></tr>`).join('')}</table></div>
    <div class="card"><h3>Automatic actions taken</h3>${ev.failed.length ? `<ul class="list">
      ${ev.failed.map(f => `<li>Failed component <b>${f.resource}</b> (${f.status}) identified</li><li>Notification sent to ${esc(usr(f.owner || ref.owner))}</li>`).join('')}
      <li>Patient informed in ${{ en: 'English', mr: 'Marathi', hi: 'Hindi' }[pat(ref.patientId).lang] || 'local language'}: do not travel yet</li>
      <li>Fallback offered: ${esc(bundle.fallback)}</li><li>Revalidation will run again after the fix</li></ul>
      <div class="row tight" style="margin-top:12px"><button class="btn" onclick="go('readiness')">Fix failing resource</button>
      <button class="btn alt" onclick="go('revalidate/${ref.id}')">Revalidate again</button></div>`
      : `<ul class="list"><li>Bundle marked READY at ${fmt(bundle.lastValidatedAt)}</li><li>Patient card refreshed with confirmed slot</li><li>Transport confirmed: ${esc(bundle.transport)}</li><li>Coordinator ${esc(usr('U3'))} expecting the patient</li></ul>
      <div class="row tight" style="margin-top:12px"><button class="btn" onclick="go('card/${ref.id}')">Open patient card</button>
      <button class="btn acc" onclick="doAdvance('${ref.id}','Attended')">Mark attended</button></div>`}</div>
  </div>`;
}

/* ============================ 11. DOCTOR DASHBOARD ============================ */
function scDoctor() {
  const me = by(DB.users, DB.meta.userId);
  const refs = DB.referrals.filter(r => r.toFacility === me.facilityId || DB.meta.role === 'ADMIN');
  const toReview = DB.orders.filter(o => o.state === 'Resulted' && !o.reviewed);
  return head('Doctor dashboard', 'Review readings and results, then release the next stage of the journey.') + `
  <div class="grid g4" style="margin-bottom:14px">${kpi(refs.filter(r => r.state === 'Attended').length, 'Awaiting review')}${kpi(toReview.length, 'Results to sign')}
  ${kpi(refs.filter(r => bundleFor(r.id) && bundleFor(r.id).status === 'NOT_READY').length, 'Blocked journeys')}${kpi(refs.filter(isOverdue).length, 'Overdue')}</div>
  <div class="grid g2">
    <div class="card"><h3>Patients attended — needs clinician review</h3><table><tr><th>Patient</th><th>Referral</th><th>Findings</th><th></th></tr>
      ${refs.filter(r => r.state === 'Attended').map(r => { const o = DB.orders.find(x => x.referralId === r.id);
        return `<tr><td><b>${esc(pat(r.patientId).name)}</b><div class="muted">${esc(r.reason)}</div></td><td class="mono">${r.id}</td>
        <td>${o && o.result ? esc(o.result) : '<span class="tag t-warn">result pending</span>'}</td>
        <td><button class="btn mini" onclick="reviewRef('${r.id}')">Review &amp; assign follow-up</button></td></tr>`; }).join('') || '<tr><td colspan=4 class="muted">Nothing to review.</td></tr>'}</table></div>
    <div class="card"><h3>Results to countersign</h3>${toReview.map(o => `<div style="border-bottom:1px solid #eef3f0;padding:8px 0">
      <b>${esc(pat(o.patientId).name)}</b> · <span class="mono">${o.id}</span><div class="muted">${esc(o.tests)} — ${esc(o.result)}</div>
      <button class="btn mini" style="margin-top:6px" onclick="signOrder('${o.id}')">Countersign</button></div>`).join('') || '<p class="muted">None.</p>'}</div>
    <div class="card"><h3>Teleconsultation queue (prototype placeholder)</h3><p class="muted">Triage outcomes marked TELECONSULT appear here with vitals attached. This prototype records the consult decision and notes; it does not connect to eSanjeevani.</p></div>
    <div class="card"><h3>Vitals flagged by field rules</h3><table><tr><th>Patient</th><th>BP</th><th>Glucose</th><th>When</th></tr>
      ${DB.vitals.filter(v => v.bpSys >= 140 || v.glucose >= 200).map(v => `<tr><td>${esc(pat(v.patientId).name)}</td><td>${v.bpSys}/${v.bpDia}</td><td>${v.glucose}</td><td>${fmt(v.at)}</td></tr>`).join('')}</table></div>
  </div>`;
}
function reviewRef(id) { advance(id, 'Reviewed', DB.meta.userId, 'Clinician reviewed results and prescribed plan'); toast('Reviewed. Follow-up assigned to ASHA.'); render(); }
function signOrder(id) { const o = by(DB.orders, id); o.reviewed = true; log('RESULT_REVIEW', id); save(); render(); }

/* ============================ 12. LAB & PHARMACY ============================ */
function scLab() {
  const me = by(DB.users, DB.meta.userId);
  const fid = DB.meta.role === 'ADMIN' ? 'F3' : me.facilityId;
  const orders = DB.orders.filter(o => o.facilityId === fid || DB.meta.role === 'ADMIN');
  return head('Lab &amp; pharmacy', 'Update reagent, equipment and medicine claims. Upload diagnostic results.') + `
  <div class="grid g2">
    <div class="card"><h3>Diagnostic orders</h3><table><tr><th>Order</th><th>Patient</th><th>Tests</th><th>State</th><th></th></tr>
      ${orders.map(o => `<tr><td class="mono">${o.id}</td><td>${esc(pat(o.patientId).name)}</td><td>${esc(o.tests)}</td>
      <td><span class="tag ${o.state === 'Resulted' ? 't-ok' : 't-warn'}">${o.state}</span></td>
      <td>${o.state === 'Resulted' ? esc(o.result).slice(0, 40) : `<button class="btn mini" onclick="uploadResult('${o.id}')">Upload result</button>`}</td></tr>`).join('')}</table>
      <p class="muted" style="margin-top:8px">Uploaded results map to a FHIR <span class="mono">DiagnosticReport</span> and push the referral towards <b>Reviewed</b>.</p></div>
    <div class="card"><h3>Medicine &amp; consumable stock</h3><table><tr><th>Item</th><th>Qty</th><th>Reorder at</th><th>Status</th><th>Updated</th></tr>
      ${DB.stock.filter(s => s.facilityId === fid || DB.meta.role === 'ADMIN').map(s => `<tr><td>${esc(s.item)}</td><td>${s.qty} ${s.unit}</td><td>${s.reorder}</td>
      <td>${s.qty === 0 ? '<span class="tag t-bad">Stock-out</span>' : s.qty < s.reorder ? '<span class="tag t-warn">Low</span>' : '<span class="tag t-ok">OK</span>'}</td>
      <td>${fmt(s.updatedAt)}</td></tr>`).join('')}</table></div>
    <div class="card"><h3>My readiness claims</h3><p class="muted">Claims you own expire automatically. Re-verify at the start of each shift.</p>
      <table><tr><th>Resource</th><th>Status</th><th>Valid until</th><th></th></tr>
      ${facilityReadiness(fid).filter(k => ['Reagents', 'Medicine', 'Equipment', 'Lab', 'Technician'].includes(k.resource)).map(k => `<tr><td><b>${k.resource}</b><div class="muted">${esc(k.detail)}</div></td><td>${sTag(k.status)}</td><td>${fmt(k.validUntil)}</td>
      <td><div class="row tight" style="gap:5px"><button class="btn mini" onclick="verifyClaim('${k.id}','Confirmed',24);render()">Confirm</button>
      <button class="btn alt mini" onclick="verifyClaim('${k.id}','Unavailable',24);render()">Mark out</button></div></td></tr>`).join('')}</table></div>
    <div class="card"><h3>Effect on journeys</h3>${(() => {
      const rows = DB.referrals.filter(r => r.toFacility === fid).map(r => ({ r, ev: evaluateBundle(r) }));
      return `<table><tr><th>Referral</th><th>Patient</th><th>Impact</th></tr>${rows.map(({ r, ev }) => `<tr><td class="mono">${r.id}</td><td>${esc(pat(r.patientId).name)}</td>
      <td>${ev.failed.length ? '<span class="tag t-bad">Blocked: ' + ev.failed.map(f => f.resource).join(', ') + '</span>' : '<span class="tag t-ok">Clear</span>'}</td></tr>`).join('')}</table>`; })()}</div>
  </div>`;
}
function uploadResult(id) {
  const o = by(DB.orders, id); o.state = 'Resulted'; o.resultAt = now();
  o.result = o.tests.includes('CBC') ? 'Hb 8.4 g/dL, microcytic hypochromic picture — moderate anaemia' : 'HbA1c 9.8%, FBS 214 mg/dL, creatinine 1.0 mg/dL';
  log('RESULT_UPLOAD', id); notify('U4', `Result ready for ${pat(o.patientId).name} (${o.id}). Review and release follow-up.`); save(); toast('Result uploaded and doctor notified.'); render();
}

/* ============================ 13. PATIENT CARE CARD ============================ */
function scCard(a) {
  const ref = by(DB.referrals, a[0]) || DB.referrals[1]; const p = pat(ref.patientId);
  const b = bundleFor(ref.id), appt = DB.appointments.find(x => x.referralId === ref.id);
  const ready = b && b.status === 'READY';
  return head('Patient care card', 'Printable, low-literacy, no smartphone required. Reference code only — no diagnosis.',
    `${['en', 'mr', 'hi'].map(l => `<button class="btn ${DB.meta.lang === l ? 'acc' : 'alt'} mini" onclick="DB.meta.lang='${l}';save();render()">${{ en: 'EN', mr: 'मराठी', hi: 'हिंदी' }[l]}</button>`).join('')}
     <button class="btn mini" onclick="window.print()">Print</button>`) + `
  <div class="grid g2"><div class="card-print">
    <div class="row tight" style="justify-content:space-between;align-items:flex-start">
      <div><div style="font-size:12px;letter-spacing:.1em;color:var(--muted)">CARERELAY · ${T('card').toUpperCase()}</div>
      <h2 style="margin:4px 0;font-size:24px">${esc(p.name)}</h2>
      <div class="muted">${p.age}${p.sex} · ${esc(p.village)} · ${esc(fac(ref.toFacility))}</div></div>
      <div style="text-align:center"><div class="qr"></div><div class="mono" style="margin-top:4px">${ref.id}</div></div></div>
    <div class="banner ${ready ? 'b-ok' : 'b-bad'}" style="margin:14px 0;font-size:17px">${ready ? '✔ ' + T('ready') : '✕ ' + T('notready')}</div>
    <table><tr><th>${T('appt')}</th><td><b>${appt ? fmt(appt.at) + ' · ' + appt.slot : '—'}</b></td></tr>
      <tr><th>${T('transport')}</th><td>${b ? esc(b.transport) : '—'}</td></tr>
      <tr><th>Coordinator</th><td>${esc(usr('U3'))} · ${esc(by(DB.users, 'U3').phone)}</td></tr></table>
    <ul class="list" style="margin-top:12px;font-size:15px"><li>${T('bring')}</li><li>${T('fasting')}</li><li>${T('ask')}</li></ul>
    <div class="row tight" style="margin-top:12px"><button class="btn alt mini" onclick="speak()">🔊 Play audio instructions</button></div>
    <p class="muted" style="margin-top:10px">Card shows a reference code only. No lab values, no diagnosis, nothing sensitive in QR or SMS.</p>
  </div>
  <div class="card"><h3>How the patient is reached</h3><ul class="list">
    <li><b>Printed card</b> handed over by ASHA — works with no phone, no network, no literacy requirement</li>
    <li><b>ASHA-assisted access</b> — ASHA app reads the same journey status aloud</li>
    <li><b>Voice / audio</b> instructions in ${{ en: 'English', mr: 'Marathi', hi: 'Hindi' }[DB.meta.lang]}</li>
    <li><b>SMS</b> carries only "Visit confirmed · ${ref.id} · ${appt ? fmt(appt.at) : 'TBD'}"</li>
    <li>Smartphone view is optional and shows the same card</li></ul>
    <h3 style="margin-top:16px">Journey stage</h3>
    <div class="steps">${FLOW.map(s => `<i class="${FLOW.indexOf(s) < FLOW.indexOf(ref.state) ? 'done' : s === ref.state ? 'now' : ''}">${s}</i>`).join('')}</div></div></div>`;
}
function speak() {
  const txt = [T('bring'), T('fasting'), T('ask')].join('. ');
  try { const u = new SpeechSynthesisUtterance(txt); u.lang = { en: 'en-IN', mr: 'mr-IN', hi: 'hi-IN' }[DB.meta.lang]; speechSynthesis.speak(u); toast('Playing audio instructions.'); }
  catch (e) { toast('Audio not available on this device.'); }
}

/* ============================ 14. FOLLOW-UP DASHBOARD ============================ */
function scFollowup() {
  const fs = DB.followups.map(f => ({ ...f, state: f.state !== 'Done' && now() > f.dueAt ? 'Overdue' : f.state }));
  return head('Follow-up &amp; referral closure', 'A referral is closed only when the loop is closed.') + `
  <div class="grid g4" style="margin-bottom:14px">${kpi(fs.filter(f => f.state === 'Due').length, 'Due')}${kpi(fs.filter(f => f.state === 'Overdue').length, 'Overdue')}
  ${kpi(fs.filter(f => f.state === 'Done').length, 'Completed')}${kpi(DB.referrals.filter(r => r.state === 'Followed-up').length, 'Referrals closed')}</div>
  <div class="card"><table><tr><th>Task</th><th>Patient</th><th>Referral</th><th>Owner</th><th>Due</th><th>State</th><th></th></tr>
  ${fs.map(f => `<tr><td>${esc(f.task)}</td><td>${esc(pat(f.patientId).name)}</td><td class="mono">${f.referralId}</td><td>${esc(usr(f.assignedTo))}</td>
    <td>${fmt(f.dueAt)}<div class="muted">${rel(f.dueAt)}</div></td>
    <td><span class="tag ${f.state === 'Done' ? 't-ok' : f.state === 'Overdue' ? 't-bad' : 't-warn'}">${f.state}</span></td>
    <td>${f.state !== 'Done' ? `<button class="btn mini" onclick="closeFU('${f.id}')">Complete &amp; close referral</button>` : '<span class="muted">closed</span>'}</td></tr>`).join('')}</table></div>`;
}
function closeFU(id) {
  const f = by(DB.followups, id); f.state = 'Done'; f.doneAt = now();
  const r = by(DB.referrals, f.referralId);
  if (r && r.state === 'Reviewed') advance(r.id, 'Followed-up', DB.meta.userId, 'ASHA completed home follow-up; loop closed');
  else { log('FOLLOWUP_DONE', id); save(); }
  toast('Follow-up completed. Referral loop closed.'); render();
}

/* ============================ 15. DISTRICT ADMIN ============================ */
function scAdmin() {
  const m = metrics();
  const perFac = DB.facilities.filter(f => f.level > 1).map(f => {
    const rs = DB.referrals.filter(r => r.toFacility === f.id);
    const ks = facilityReadiness(f.id);
    return { f, refs: rs.length, overdue: rs.filter(isOverdue).length, bad: ks.filter(k => !READY_OK(k.status)).length, ks };
  });
  return head('District administrator dashboard', 'DEMO DATA — prototype metrics computed from this device only.') + `
  <div class="grid g4" style="margin-bottom:14px">
    ${kpi(m.patients, 'Total patients')}${kpi(m.pending, 'Pending referrals')}${kpi(m.overdue, 'Overdue referrals')}
    ${kpi(m.ready, 'Travel ready')}${kpi(m.notReady, 'Travel NOT ready')}${kpi(m.failures.length, 'Readiness failures')}
    ${kpi(m.stockouts.length, 'Stock issues')}${kpi(m.fuDue, 'Follow-ups open')}${kpi(m.fuDone, 'Follow-ups done')}${kpi(m.closed, 'Referrals closed')}</div>
  <div class="grid g2">
    <div class="card"><h3>Facility bottlenecks</h3><table><tr><th>Facility</th><th>Referrals</th><th>Overdue</th><th>Unusable claims</th><th>Worst component</th></tr>
      ${perFac.map(x => `<tr><td><b>${esc(x.f.name)}</b><div class="muted">${x.f.type}</div></td><td>${x.refs}</td>
      <td>${x.overdue ? '<span class="tag t-bad">' + x.overdue + '</span>' : 0}</td><td>${x.bad}</td>
      <td>${x.ks.filter(k => !READY_OK(k.status)).map(k => k.resource + ' (' + k.status + ')').join(', ') || '<span class="tag t-ok">none</span>'}</td></tr>`).join('')}</table></div>
    <div class="card"><h3>Readiness failures blocking journeys</h3><table><tr><th>Referral</th><th>Facility</th><th>Component</th><th>Status</th></tr>
      ${m.failures.map(f => `<tr><td class="mono">${f.ref}</td><td>${esc(f.facility)}</td><td>${f.resource}</td><td>${sTag(f.status)}</td></tr>`).join('') || '<tr><td colspan=4 class="muted">None</td></tr>'}</table></div>
    <div class="card"><h3>Stock-outs &amp; low stock</h3><table><tr><th>Facility</th><th>Item</th><th>Qty</th><th>Status</th></tr>
      ${m.stockouts.map(s => `<tr><td>${esc(fac(s.facilityId))}</td><td>${esc(s.item)}</td><td>${s.qty} ${s.unit}</td>
      <td>${s.qty === 0 ? '<span class="tag t-bad">Stock-out</span>' : '<span class="tag t-warn">Below reorder</span>'}</td></tr>`).join('')}</table></div>
    <div class="card"><h3>Diagnostic problems</h3><table><tr><th>Order</th><th>Patient</th><th>Issue</th></tr>
      ${m.diagIssues.map(o => `<tr><td class="mono">${o.id}</td><td>${esc(pat(o.patientId).name)}</td>
      <td>${o.state !== 'Resulted' ? '<span class="tag t-warn">Result pending since ' + fmt(o.orderedAt) + '</span>' : '<span class="tag t-info">Awaiting clinician sign-off</span>'}</td></tr>`).join('')}</table></div>
    <div class="card"><h3>Escalations &amp; notifications</h3><ul class="timeline">${DB.notifications.slice(0, 8).map(n => `<li><b>${esc(usr(n.to))}</b> · ${fmt(n.at)}<div class="muted">${esc(n.text)}</div></li>`).join('')}</ul></div>
    <div class="card"><h3>Scope honesty</h3><ul class="list">
      <li><b>DEMO DATA</b> — every patient, facility and reading here is fictional.</li>
      <li><b>PROTOTYPE FUNCTIONALITY</b> — offline capture, triage rules, readiness expiry, bundle validation, referral state machine, audit log.</li>
      <li><b>PRODUCTION INTEGRATION (not built)</b> — ABDM/ABHA gateway, eSanjeevani, HMIS/e-Aushadhi stock feeds, SMS gateway, state health authority sign-off.</li></ul></div>
  </div>`;
}

/* ============================ AUDIT + SYNC QUEUE ============================ */
function scAudit() {
  return head('Audit log', 'Who did what, when, from online or offline device.') + `<div class="card"><table><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Mode</th></tr>
  ${DB.audit.slice(0, 60).map(l => `<tr><td>${fmt(l.at)}</td><td>${esc(usr(l.actor))}</td><td class="mono">${l.action}</td><td class="mono">${esc(l.target)}</td>
  <td><span class="tag ${l.mode === 'offline' ? 't-warn' : 't-info'}">${l.mode}</span></td></tr>`).join('')}</table></div>`;
}
function scSync() {
  return head('Offline queue', 'Local-first writes with device timestamps. Nothing is silently lost.') + `
  <div class="banner b-info" style="margin-bottom:14px">${DB.meta.offline ? 'Device is offline. New records stay queued and live facts show as Last Known / Pending.' : 'Device is online. Pending records can be flushed now.'}</div>
  <div class="card"><div class="row tight" style="margin-bottom:10px"><button class="btn" onclick="syncNow();render()">Sync Now</button>
    <button class="btn alt" onclick="DB.meta.offline=!DB.meta.offline;save();render()">${DB.meta.offline ? 'Go online' : 'Simulate offline'}</button></div>
  <table><tr><th>Queue item</th><th>Type</th><th>Record</th><th>Queued at</th><th>State</th></tr>
  ${DB.syncQueue.length ? DB.syncQueue.slice().reverse().map(q => `<tr><td>${esc(q.label)}</td><td>${q.kind}</td><td class="mono">${q.ref}</td>
    <td>${fmt(q.queuedAt)}<div class="muted">${rel(q.queuedAt)}</div></td>
    <td><span class="tag ${q.state === 'Synced' ? 't-ok' : 't-warn'}">${q.state}</span></td></tr>`).join('') : '<tr><td colspan=5 class="muted">Queue empty.</td></tr>'}</table></div>
  <div class="card" style="margin-top:14px"><h3>Sync rules</h3><ul class="list">
    <li>Patient, vitals, encounter, referral and follow-up writes are allowed offline.</li>
    <li>Appointment slots, stock levels and readiness claims are <b>server truth</b> — offline the app shows Last Known with the timestamp, never a fabricated confirmation.</li>
    <li>Conflicts resolve last-write-wins per field, with both versions kept in the audit log.</li>
    <li>Emergency referrals are never blocked by sync state.</li></ul></div>`;
}

/* ============================ GUIDED DEMO ============================ */
const DEMO = [
  ['Go offline and register the diabetes patient', () => { DB.meta.offline = true; save(); go('register'); }],
  ['Record high glucose / BP and run triage', () => { const p = DB.patients.find(x => x.name.includes('Ganesh')); go('patient/' + p.id); }],
  ['Sync the device, then open the referral inbox', () => { DB.meta.offline = false; save(); syncNow(); go('hospital'); }],
  ['Accept + schedule R-1042 and generate the bundle', () => { const r = by(DB.referrals, 'R-1042'); if (r.state === 'Requested') advance('R-1042', 'Accepted', 'U3'); if (by(DB.referrals, 'R-1042').state === 'Accepted') doAdvance('R-1042', 'Scheduled'); go('bundle/R-1042'); }],
  ['Break reagents (simulate stock-out)', () => { verifyClaim('K4', 'Unavailable', 24, 'U5'); const s = by(DB.stock, 'S3'); s.qty = 0; s.updatedAt = now(); save(); go('revalidate/R-1042'); }],
  ['Hospital replaces the reagent batch', () => { verifyClaim('K4', 'Confirmed', 24, 'U5', 'HbA1c cartridges (replacement batch RX-92 received)'); const s = by(DB.stock, 'S3'); s.qty = 8; s.updatedAt = now(); save(); go('revalidate/R-1042'); }],
  ['Patient attends — mark attended', () => { doAdvance('R-1042', 'Attended'); go('lab'); }],
  ['Lab uploads the result', () => { let o = DB.orders.find(x => x.referralId === 'R-1042'); if (!o) { o = { id: uid('D'), referralId: 'R-1042', patientId: by(DB.referrals, 'R-1042').patientId, facilityId: 'F3', tests: 'HbA1c + FBS + Serum creatinine', state: 'Ordered', orderedAt: now(), result: '', reviewed: false }; DB.orders.push(o); save(); } uploadResult(o.id); go('doctor'); }],
  ['Doctor reviews and assigns follow-up', () => { if (by(DB.referrals, 'R-1042').state === 'Attended') reviewRef('R-1042'); go('followup'); }],
  ['ASHA completes follow-up — referral closed', () => { const f = DB.followups.filter(x => x.referralId === 'R-1042' && x.state !== 'Done')[0]; if (f) closeFU(f.id); go('admin'); }]
];
function scDemo() {
  const r = by(DB.referrals, 'R-1042'); const b = bundleFor('R-1042');
  return head('Guided jury demo — diabetes journey', 'Ten clicks, one complete care journey, including a deliberate failure and recovery.') + `
  <div class="banner b-info" style="margin-bottom:14px"><b>Don't just book the patient — make sure the journey is ready.</b></div>
  <div class="grid g2"><div class="card"><h3>Demo steps</h3><ol style="padding-left:20px;line-height:2">
    ${DEMO.map((d, i) => `<li>${esc(d[0])} <button class="btn mini alt" onclick="DEMO[${i}][1]();render()">Run</button></li>`).join('')}</ol>
    <p class="muted">Steps 5 and 6 are the point of the whole product: a confirmed appointment becomes worthless the moment a reagent claim dies, and CareRelay says so before the patient boards a jeep.</p></div>
  <div class="card"><h3>Live state of R-1042</h3>
    <div class="steps" style="margin-bottom:12px">${FLOW.map(s => `<i class="${FLOW.indexOf(s) < FLOW.indexOf(r.state) ? 'done' : s === r.state ? 'now' : ''}">${s}</i>`).join('')}</div>
    <table><tr><th>Patient</th><td>${esc(pat(r.patientId).name)}</td></tr><tr><th>Stage</th><td>${stateTag(r.state)}</td></tr>
    <tr><th>Owner</th><td>${esc(usr(r.owner))}</td></tr><tr><th>Bundle</th><td>${b ? (b.status === 'READY' ? '<span class="tag t-ok">TRAVEL READY</span>' : '<span class="tag t-bad">TRAVEL NOT READY</span>') : '<span class="tag t-mute">not generated</span>'}</td></tr>
    <tr><th>Reagents claim</th><td>${sTag(claimStatus(by(DB.readiness, 'K4')))} <span class="muted">valid until ${fmt(validUntil(by(DB.readiness, 'K4')))}</span></td></tr></table>
    <div class="row tight" style="margin-top:12px"><button class="btn" onclick="go('bundle/R-1042')">Open bundle</button>
    <button class="btn alt" onclick="go('card/R-1042')">Patient card</button>
    <button class="btn alt" onclick="resetDB();render()">Reset demo</button></div></div></div>`;
}

window.addEventListener('hashchange', render);
render();
