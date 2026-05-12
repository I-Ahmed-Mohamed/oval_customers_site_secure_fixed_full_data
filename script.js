const PASSWORD = 'oval1';
const STORAGE_KEY = 'oval.customers.branches.secure.v4.fixed-full-data';
const OLD_STORAGE_KEY = 'oval.customers.branches.v1';
const AUDIT_KEY = 'oval.customers.audit.v1';
const TRASH_KEY = 'oval.customers.trash.v1';
const SESSION_KEY = 'oval.customers.session.v1';
const SESSION_MS = 1000 * 60 * 60 * 8;

let records = [];
let currentView = [];
let currentUser = 'admin';
const $ = (id) => document.getElementById(id);

function norm(v){ return String(v || '').trim(); }
function unique(arr){ return [...new Set(arr.map(norm).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar')); }
function escapeHtml(s){ return String(s||'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function showToast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1900); }

function encodeSafe(text){ return btoa(unescape(encodeURIComponent(text))); }
function decodeSafe(text){ return decodeURIComponent(escape(atob(text))); }
function xorText(text, key){ return [...text].map((ch,i)=>String.fromCharCode(ch.charCodeAt(0) ^ key.charCodeAt(i % key.length))).join(''); }
function encryptData(data){ return encodeSafe(xorText(JSON.stringify(data), PASSWORD)); }
function decryptData(cipher){ return JSON.parse(xorText(decodeSafe(cipher), PASSWORD)); }
function readEncrypted(key, fallback){
  const cipher = localStorage.getItem(key);
  if(!cipher) return fallback;
  try { return decryptData(cipher); } catch(e){ return fallback; }
}
function writeEncrypted(key, data){ localStorage.setItem(key, encryptData(data)); }

function initialRecords(){ return (window.INITIAL_CUSTOMERS || []).map(r => ({...r})); }
function loadRecords(){
  const base = initialRecords();
  const secured = readEncrypted(STORAGE_KEY, null);
  // لو المتصفح كان حافظ نسخة فاضية من إصدار قديم، نرجع الداتا الأساسية بدل ما يفتح الموقع فاضي
  if(Array.isArray(secured) && secured.length > 0) return secured;
  if(Array.isArray(secured) && secured.length === 0 && base.length > 0){
    writeEncrypted(STORAGE_KEY, base);
    return base;
  }
  const old = localStorage.getItem(OLD_STORAGE_KEY);
  if(old){
    try{
      const parsed = JSON.parse(old);
      if(Array.isArray(parsed)){
        writeEncrypted(STORAGE_KEY, parsed);
        localStorage.removeItem(OLD_STORAGE_KEY);
        return parsed;
      }
    }catch(e){}
  }
  writeEncrypted(STORAGE_KEY, base);
  return base;
}
function save(){ writeEncrypted(STORAGE_KEY, records); }
function readAudit(){ return readEncrypted(AUDIT_KEY, []); }
function saveAudit(list){ writeEncrypted(AUDIT_KEY, list.slice(0,400)); }
function readTrash(){ return readEncrypted(TRASH_KEY, []); }
function saveTrash(list){ writeEncrypted(TRASH_KEY, list); }
function snapshot(r){ return {client:r?.client, branch:r?.branch, state:r?.state, city:r?.city, mobile:r?.mobile, phone:r?.phone, email:r?.email, street:r?.street}; }
function addLog(action, before=null, after=null){
  const list = readAudit();
  list.unshift({id:'log-'+Date.now(), action, by:currentUser, at:new Date().toISOString(), before:snapshot(before), after:snapshot(after)});
  saveAudit(list);
}
function formatDate(iso){ try{return new Date(iso).toLocaleString('ar-EG');}catch(e){return iso;} }

function login(){
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ok:true, at:Date.now()}));
  $('loginScreen').style.display='none';
  $('appShell').classList.remove('locked');
  $('appShell').setAttribute('aria-hidden','false');
  records = loadRecords();
  render();
  showToast('تم الدخول بنجاح');
}
function logout(){
  sessionStorage.removeItem(SESSION_KEY);
  $('appShell').classList.add('locked');
  $('appShell').setAttribute('aria-hidden','true');
  $('loginScreen').style.display='grid';
  $('passwordInput').value='';
  $('passwordInput').focus();
}
function checkSession(){
  try{
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
    if(s.ok && Date.now() - s.at < SESSION_MS){ login(); }
  }catch(e){}
}
$('loginForm').addEventListener('submit', e=>{
  e.preventDefault();
  if($('passwordInput').value === PASSWORD) login();
  else { showToast('كلمة السر غير صحيحة'); $('passwordInput').select(); }
});

function groupByClient(list){ return list.reduce((acc,r)=>{ const key = norm(r.client) || 'عميل بدون اسم'; (acc[key] ||= []).push(r); return acc; },{}); }
function hasContact(r){ return !!(norm(r.phone)||norm(r.mobile)||norm(r.email)||norm(r.website)); }
function hasAddress(r){ return !!(norm(r.street)||norm(r.city)||norm(r.state)); }
function isCompleteEnough(r){ return norm(r.client) && norm(r.branch) && hasContact(r) && hasAddress(r); }
function missingCount(r){ return ['client','branch','state','city','street','phone','mobile','email'].filter(k=>!norm(r[k])).length; }

function refreshFilters(){
  fillSelect('stateFilter', unique(records.map(r=>r.state)), 'كل المحافظات');
  fillSelect('cityFilter', unique(records.map(r=>r.city)), 'كل المدن');
  fillSelect('termsFilter', unique(records.map(r=>r.paymentTerms)), 'كل شروط الدفع');
  fillSelect('sourceFilter', unique(records.map(r=>r.sourceSheet)), 'كل الشيتات');
}
function fillSelect(id, items, first){
  const el=$(id), old=el.value;
  el.innerHTML = `<option value="">${first}</option>` + items.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if(items.includes(old)) el.value=old;
}
function getFiltered(){
  const q=norm($('searchInput').value).toLowerCase();
  const st=$('stateFilter').value, city=$('cityFilter').value, terms=$('termsFilter').value, source=$('sourceFilter').value, comp=$('completenessFilter').value;
  return records.filter(r=>{
    const blob = [r.client,r.branch,r.street,r.city,r.state,r.phone,r.mobile,r.email,r.paymentTerms,r.taxId,r.sourceSheet,r.notes].join(' ').toLowerCase();
    const passComp = !comp || (comp==='complete' && isCompleteEnough(r)) || (comp==='missingContact' && !hasContact(r)) || (comp==='missingAddress' && !hasAddress(r));
    return (!q || blob.includes(q)) && (!st || r.state===st) && (!city || r.city===city) && (!terms || r.paymentTerms===terms) && (!source || r.sourceSheet===source) && passComp;
  });
}
function render(){ refreshFilters(); currentView = getFiltered(); renderKPIs(currentView); renderCharts(currentView); renderQuality(currentView); renderList(currentView); }
function renderKPIs(list){
  const grouped=groupByClient(list);
  $('totalClients').textContent = Object.keys(grouped).length;
  $('totalBranches').textContent = list.length;
  $('totalStates').textContent = unique(list.map(r=>r.state)).length;
  $('totalContacts').textContent = list.filter(hasContact).length;
  $('totalMissing').textContent = list.filter(r=>!isCompleteEnough(r)).length;
}
function renderCharts(list){
  const grouped=groupByClient(list);
  const top=Object.entries(grouped).map(([name,items])=>({name,count:items.length})).sort((a,b)=>b.count-a.count).slice(0,8);
  const max=Math.max(1,...top.map(x=>x.count));
  $('topCount').textContent = `${top.length} عملاء`;
  $('topClientsChart').innerHTML = top.map(x=>`<div class="bar-row"><div class="bar-name" title="${escapeHtml(x.name)}">${escapeHtml(x.name)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(7,x.count/max*100)}%"></div></div><b>${x.count}</b></div>`).join('') || '<div class="empty">لا توجد بيانات</div>';
  const states=Object.entries(list.reduce((a,r)=>{const k=r.state||'غير محدد';a[k]=(a[k]||0)+1;return a;},{})).sort((a,b)=>b[1]-a[1]).slice(0,18);
  $('stateCount').textContent = `${states.length} محافظة/منطقة`;
  $('statesChart').innerHTML = states.map(([k,v])=>`<span class="chip">${escapeHtml(k)} <b>${v}</b></span>`).join('') || '<div class="empty">لا توجد بيانات</div>';
}
function renderQuality(list){
  const noContact=list.filter(r=>!hasContact(r)).length;
  const noAddress=list.filter(r=>!hasAddress(r)).length;
  const complete=list.filter(isCompleteEnough).length;
  const avgMissing=list.length ? (list.reduce((s,r)=>s+missingCount(r),0)/list.length).toFixed(1) : '0';
  $('qualityCount').textContent = `${complete} سجل مكتمل نسبيًا`;
  $('qualityPanel').innerHTML = `
    <div class="quality-item"><span>مكتمل نسبيًا</span><strong>${complete}</strong></div>
    <div class="quality-item"><span>ناقص تواصل</span><strong>${noContact}</strong></div>
    <div class="quality-item"><span>ناقص عنوان</span><strong>${noAddress}</strong></div>
    <div class="quality-item"><span>متوسط النواقص</span><strong>${avgMissing}</strong></div>`;
}
function renderList(list){
  const grouped=groupByClient(list);
  const html = Object.entries(grouped).sort((a,b)=>a[0].localeCompare(b[0],'ar')).map(([client,items])=>{
    const contacts = items.filter(hasContact).length;
    const incomplete = items.filter(r=>!isCompleteEnough(r)).length;
    return `<article class="client-card">
      <div class="client-head">
        <div class="client-title"><strong>${escapeHtml(client)}</strong><span>${items.length} فرع/سجل · ${contacts} بيانات تواصل · ${incomplete} ناقص</span></div>
        <div class="client-actions"><button class="btn small" onclick="copyClient('${encodeURIComponent(client)}')">نسخ بيانات العميل</button><button class="btn small" onclick="addBranch('${encodeURIComponent(client)}')">+ إضافة فرع</button></div>
      </div>
      <div class="branches">${items.map(branchTemplate).join('')}</div>
    </article>`;
  }).join('');
  $('customersList').innerHTML = html || '<div class="empty">مفيش بيانات مطابقة للبحث الحالي</div>';
}
function branchTemplate(r){
  const address=[r.street,r.city,r.state].filter(Boolean).join(' - ');
  const warn = !isCompleteEnough(r) ? `<span class="tag-warn">بيانات ناقصة</span>` : '';
  return `<div class="branch-card">
    <h4>${escapeHtml(r.branch)}</h4>
    ${warn}
    <div class="branch-meta">
      ${address?`<div>📍 ${escapeHtml(address)}</div>`:'<div>📍 لا يوجد عنوان كافي</div>'}
      ${r.paymentTerms?`<div>💳 ${escapeHtml(r.paymentTerms)}</div>`:''}
      ${r.taxId?`<div>🧾 ${escapeHtml(r.taxId)}</div>`:''}
      ${r.mobile||r.phone?`<div class="copy-field">☎ ${escapeHtml([r.mobile,r.phone].filter(Boolean).join(' / '))}</div>`:'<div>☎ لا يوجد رقم</div>'}
      ${r.email?`<div class="copy-field">✉ ${escapeHtml(r.email)}</div>`:''}
      ${r.website?`<div class="copy-field">🌐 ${escapeHtml(r.website)}</div>`:''}
      <div>📄 ${escapeHtml(r.sourceSheet || 'local')}</div>
    </div>
    <div class="branch-actions">
      <button class="btn small" onclick="editRecord('${r.id}')">تعديل</button>
      <button class="btn small" onclick="duplicateRecord('${r.id}')">تكرار</button>
      <button class="btn small" onclick="copyRecord('${r.id}')">نسخ</button>
      <button class="btn small danger" onclick="deleteRecord('${r.id}')">حذف</button>
    </div>
  </div>`;
}

function copyRecord(id){
  const r=records.find(x=>x.id===id); if(!r) return;
  const text = `العميل: ${r.client}\nالفرع: ${r.branch}\nالعنوان: ${[r.street,r.city,r.state].filter(Boolean).join(' - ')}\nالموبايل: ${r.mobile||''}\nالهاتف: ${r.phone||''}\nالإيميل: ${r.email||''}\nشروط الدفع: ${r.paymentTerms||''}\nالرقم الضريبي: ${r.taxId||''}`;
  navigator.clipboard.writeText(text); showToast('تم نسخ بيانات الفرع'); addLog('نسخ بيانات فرع', r, r);
}
function copyClient(encoded){
  const client=decodeURIComponent(encoded); const items=records.filter(r=>r.client===client);
  const text = items.map(r=>`• ${r.branch} | ${[r.street,r.city,r.state].filter(Boolean).join(' - ')} | ${r.mobile || r.phone || ''}`).join('\n');
  navigator.clipboard.writeText(`${client}\n${text}`); showToast('تم نسخ كل فروع العميل'); addLog('نسخ بيانات عميل', {client}, {client});
}
function duplicateRecord(id){
  const r=records.find(x=>x.id===id); if(!r) return;
  const copy={...r,id:'copy-'+Date.now(),branch:(r.branch||'فرع')+' - نسخة',sourceSheet:'manual-copy',rowNumber:''};
  records.unshift(copy); save(); addLog('تكرار سجل', r, copy); render(); showToast('تم تكرار السجل');
}
function deleteRecord(id){
  const r=records.find(x=>x.id===id); if(!r) return;
  const phrase = prompt(`للحذف اكتب كلمة: حذف\n${r.client} - ${r.branch}`);
  if(phrase !== 'حذف') return showToast('تم إلغاء الحذف');
  const trash = readTrash();
  trash.unshift({...r, deletedAt:new Date().toISOString(), deletedBy:currentUser});
  saveTrash(trash);
  records=records.filter(x=>x.id!==id); save(); addLog('حذف ونقل للسلة', r, null); render(); showToast('تم النقل لسلة المحذوفات');
}
function addBranch(encodedClient=''){ openModal(); if(encodedClient) $('client').value=decodeURIComponent(encodedClient); }
function editRecord(id){
  const r=records.find(x=>x.id===id); if(!r) return; openModal('تعديل البيانات');
  ['client','branch','paymentTerms','taxId','city','state','street','phone','mobile','email','website','notes'].forEach(k=>$(k).value=r[k]||'');
  $('recordId').value=id;
}
function openModal(title='إضافة عميل/فرع'){ $('customerForm').reset(); $('recordId').value=''; $('modalTitle').textContent=title; $('editorDialog').showModal(); }
function closeModal(){ $('editorDialog').close(); }
$('customerForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const id=$('recordId').value;
  const payload={client:norm($('client').value),branch:norm($('branch').value),paymentTerms:norm($('paymentTerms').value),taxId:norm($('taxId').value),city:norm($('city').value),state:norm($('state').value),street:norm($('street').value),phone:norm($('phone').value),mobile:norm($('mobile').value),email:norm($('email').value),website:norm($('website').value),notes:norm($('notes').value)};
  if(id){
    const before = records.find(r=>r.id===id);
    records = records.map(r=>r.id===id?{...r,...payload,updatedAt:new Date().toISOString()}:r);
    addLog('تعديل بيانات', before, records.find(r=>r.id===id));
  } else {
    const created={id:'local-'+Date.now(), sourceSheet:'manual', rowNumber:'', isBranch:true, country:'مصر', street2:'', zip:'', createdAt:new Date().toISOString(), ...payload};
    records.unshift(created); addLog('إضافة سجل جديد', null, created);
  }
  save(); closeModal(); render(); showToast('تم الحفظ');
});

function exportCsv(){
  const headers=['client','branch','paymentTerms','taxId','street','city','state','phone','mobile','email','website','sourceSheet'];
  const rows=currentView.map(r=>headers.map(h=>'"'+String(r[h]||'').replaceAll('"','""')+'"').join(','));
  downloadFile('\ufeff'+headers.join(',')+'\n'+rows.join('\n'), 'oval-customers.csv', 'text/csv;charset=utf-8');
  addLog('تصدير CSV', null, {client:'current view', branch:String(currentView.length)});
}
function backup(){
  const payload={exportedAt:new Date().toISOString(), version:2, records, trash:readTrash(), audit:readAudit()};
  downloadFile(JSON.stringify(payload,null,2),'oval-customers-secure-backup.json','application/json');
  addLog('نسخ احتياطي JSON', null, {client:'backup', branch:String(records.length)});
}
function downloadFile(content, filename, type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }
$('importInput').addEventListener('change', async e=>{
  const file=e.target.files[0]; if(!file) return;
  try{
    const json=JSON.parse(await file.text());
    const imported = Array.isArray(json) ? json : json.records;
    if(Array.isArray(imported)){
      const oldRecords = records;
      records=imported; save();
      if(Array.isArray(json.trash)) saveTrash(json.trash);
      if(Array.isArray(json.audit)) saveAudit(json.audit);
      addLog('استيراد JSON', {branch:String(oldRecords.length)}, {branch:String(records.length)});
      render(); showToast('تم الاستيراد');
    } else alert('ملف JSON غير صحيح');
  } catch(err){ alert('ملف JSON غير صحيح'); }
  e.target.value='';
});

function renderAudit(){
  const list = readAudit();
  $('auditList').innerHTML = list.map(l=>`<div class="log-item"><strong>${escapeHtml(l.action)}</strong><small>${formatDate(l.at)} · ${escapeHtml(l.by||'admin')}</small><div class="log-diff">قبل: ${escapeHtml([l.before?.client,l.before?.branch].filter(Boolean).join(' - ') || 'لا يوجد')}<br>بعد: ${escapeHtml([l.after?.client,l.after?.branch].filter(Boolean).join(' - ') || 'لا يوجد')}</div></div>`).join('') || '<div class="empty">لا يوجد حركات حتى الآن</div>';
}
function renderTrash(){
  const list = readTrash();
  $('trashList').innerHTML = list.map(r=>`<div class="trash-item"><strong>${escapeHtml(r.client)} - ${escapeHtml(r.branch)}</strong><small>حُذف: ${formatDate(r.deletedAt)} · بواسطة ${escapeHtml(r.deletedBy||'admin')}</small><div class="modal-actions"><button class="btn small" onclick="restoreRecord('${r.id}')">استرجاع</button><button class="btn small danger" onclick="purgeRecord('${r.id}')">حذف نهائي</button></div></div>`).join('') || '<div class="empty">سلة المحذوفات فارغة</div>';
}
function restoreRecord(id){
  const trash=readTrash(); const r=trash.find(x=>x.id===id); if(!r) return;
  const restored={...r,id:r.id+'-restored-'+Date.now()}; delete restored.deletedAt; delete restored.deletedBy;
  records.unshift(restored); save(); saveTrash(trash.filter(x=>x.id!==id)); addLog('استرجاع من السلة', null, restored); renderTrash(); render(); showToast('تم الاسترجاع');
}
function purgeRecord(id){
  if(!confirm('حذف نهائي من السلة؟')) return;
  const trash=readTrash(); const r=trash.find(x=>x.id===id);
  saveTrash(trash.filter(x=>x.id!==id)); addLog('حذف نهائي من السلة', r, null); renderTrash(); showToast('تم الحذف النهائي');
}
function exportAudit(){ downloadFile(JSON.stringify(readAudit(),null,2),'oval-audit-log.json','application/json'); }
function clearAudit(){ if(confirm('مسح سجل الحركات بالكامل؟')){ saveAudit([]); renderAudit(); showToast('تم مسح السجل'); } }

['searchInput','stateFilter','cityFilter','termsFilter','sourceFilter','completenessFilter'].forEach(id=>$(id).addEventListener('input', render));
$('clearFilters').onclick=()=>{ ['searchInput','stateFilter','cityFilter','termsFilter','sourceFilter','completenessFilter'].forEach(id=>$(id).value=''); render(); };
$('addBtn').onclick=()=>addBranch();
$('backupBtn').onclick=backup;
$('exportCsvBtn').onclick=exportCsv;
$('closeModal').onclick=closeModal;
$('cancelModal').onclick=closeModal;
$('lockBtn').onclick=logout;
$('auditBtn').onclick=()=>{ renderAudit(); $('auditDialog').showModal(); };
$('trashBtn').onclick=()=>{ renderTrash(); $('trashDialog').showModal(); };
$('closeAudit').onclick=()=>$('auditDialog').close();
$('closeTrash').onclick=()=>$('trashDialog').close();
$('exportAuditBtn').onclick=exportAudit;
$('clearAuditBtn').onclick=clearAudit;
$('resetBtn').onclick=()=>{
  const phrase=prompt('للرجوع للأصل اكتب: رجوع');
  if(phrase==='رجوع'){
    const beforeCount=records.length;
    records=initialRecords();
    save();
    addLog('رجوع للبيانات الأصلية', {branch:String(beforeCount)}, {branch:String(records.length)});
    render(); showToast('تم الرجوع للأصل');
  }
};

function installDeterrents(){
  document.addEventListener('contextmenu', e=>{ e.preventDefault(); showToast('تم منع كليك يمين لحماية البيانات'); });
  document.addEventListener('keydown', e=>{
    const key=e.key.toLowerCase();
    if(key==='f12' || (e.ctrlKey && e.shiftKey && ['i','j','c'].includes(key)) || (e.ctrlKey && ['u','s'].includes(key))){
      e.preventDefault();
      $('securityBlank').classList.add('show');
      setTimeout(()=>$('securityBlank').classList.remove('show'),1300);
      showToast('تم منع الاختصار لحماية البيانات');
    }
  });
}
installDeterrents();
checkSession();
