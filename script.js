const PASSWORD='oval1';
const LS_RECORDS='oval_manager_records_v2';
const LS_PRODUCTS='oval_manager_products_v2';
const LS_AUDIT='oval_manager_audit_v2';
const LS_TRASH='oval_manager_trash_v2';
const LS_CRM='oval_manager_crm_v2';
let records=[], products=[], filtered=[], orderLines=[];

const $=id=>document.getElementById(id);
const norm=v=>String(v||'').replace(/\s+/g,' ').trim();
const clean=v=>norm(v).toLowerCase()
  .replace(/[أإآا]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/ئ/g,'ي').replace(/ؤ/g,'و')
  .replace(/[\u064B-\u0652]/g,'').replace(/[^\u0600-\u06FFa-z0-9 ]/g,' ');
const unique=a=>[...new Set(a.map(norm).filter(Boolean))].sort((x,y)=>x.localeCompare(y,'ar'));
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const escAttr=s=>String(s||'').replace(/'/g,'&#39;').replace(/"/g,'&quot;');
const colorPalette={ 'أبيض':'#eef7ff', 'أحمر':'#fff0ef', 'بلدي':'#fff7e7' };

function toast(m){$('toast').textContent=m;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1800)}
function read(k,d){try{return JSON.parse(localStorage.getItem(k)||'null')??d}catch{return d}}
function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
function download(content,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

const ALIASES=[
  ['المنصوره','وكالة المنصورة'],['وكاله','وكالة المنصورة'],['بنده','بندة'],['بندة','بندة'],['اوسكار','أوسكار جراند ستورز'],
  ['سبينيس','سبينيس'],['اللولو','اللولو هايبر ماركت'],['الفار','الفار'],['زهران','زهران'],['اولاد رجب','أولاد رجب'],['أولاد رجب','أولاد رجب'],
  ['كازيون','أوكازيون'],['اوكازيون','أوكازيون'],['كارفور','كارفور'],['ماف','كارفور'],['سوق دوت','أمازون / نون'],['امازون','أمازون'],['نون','نون'],
  ['رع ماركت','جيان ماركت / رع'],['جيان','جيان ماركت / رع'],['جودز','جودز مارت'],['سوبر سنتر','سوبر سنتر'],['هيلتون','فندق هيلتون هليوبلس'],
  ['ماريوت','فندق ماريوت مينا هاوس'],['سانت ريجيس العاصمة','فندق سانت ريجيس العاصمة'],['سانت ريجيس كورنيش','فندق سانت ريجيس كورنيش النيل'],['رايدسون','فندق رايدسون بلو شيراتون'],
  ['بان كيكس','بان كيكس فودز'],['بيم','بيم'],['سوان','سوان ماركت'],['تمار','شركة تمار هوم'],['جاما','جاما للإنشاءات والطرق'],['meimhardt','MEIMHARDT'],['الهندسية','الشركة الهندسية للإنشاء والتعمير'],['تالنت','شركة تالنت الهندسية']
];
function officialName(n){const c=clean(n);for(const [a,b] of ALIASES){if(c.includes(clean(a)))return b}return norm(n)||'عميل غير محدد'}
function taxFor(r){
  if(r.taxId) return r.taxId;
  const reg=(window.TAX_REGISTRY||[]).find(x=> clean(officialName(r.client)).includes(clean(x.name)) || clean(x.name).includes(clean(officialName(r.client))));
  return reg?.taxId || '';
}
function normalizeRecord(r){
  return {
    id:r.id||crypto.randomUUID(),
    client:norm(r.client||r.clientOriginal),
    branch:norm(r.branchFullName||r.branch||r.client),
    branchFullName:norm(r.branchFullName||r.branch||r.client),
    taxId:norm(r.taxId),
    state:norm(r.state), city:norm(r.city), street:norm(r.street),
    phone:norm(r.phone), mobile:norm(r.mobile), email:norm(r.email), website:norm(r.website),
    paymentTerms:norm(r.paymentTerms), notes:norm(r.notes), sourceSheet:r.sourceSheet||'data'
  }
}
function normalizeProduct(p){
  return {
    id:p.id||crypto.randomUUID(), no:p.no||'', name:norm(p.name), displayName:norm(p.displayName||p.name),
    barcode:norm(p.barcode), color:norm(p.color), packSize:norm(p.packSize), segment:norm(p.segment), packaging:norm(p.packaging), notes:norm(p.notes)
  }
}
function builtRecords(){return (window.INITIAL_CUSTOMERS||[]).map(normalizeRecord).filter(r=>r.client||r.branch)}
function builtProducts(){return (window.INITIAL_PRODUCTS||[]).map(normalizeProduct).filter(p=>p.name||p.barcode)}
function initData(){
  const builtR=builtRecords(), builtP=builtProducts();
  const savedR=read(LS_RECORDS, null), savedP=read(LS_PRODUCTS, null);
  records=Array.isArray(savedR)&&savedR.length?savedR.map(normalizeRecord):builtR;
  products=Array.isArray(savedP)&&savedP.length?savedP.map(normalizeProduct):builtP;
  if(!records.length && builtR.length) records=builtR;
  if(!products.length && builtP.length) products=builtP;
  saveAll();
}
function saveAll(){write(LS_RECORDS, records); write(LS_PRODUCTS, products)}
function addAudit(action,details){const list=read(LS_AUDIT,[]);list.unshift({at:new Date().toLocaleString('ar-EG'),action,details});write(LS_AUDIT,list.slice(0,500));renderAuditTrash()}
function restoreOriginal(){if(!confirm('هيتم استرجاع البيانات الأصلية من الملفات. تكمل؟'))return;records=builtRecords();products=builtProducts();saveAll();addAudit('استرجاع البيانات الأصلية',`عملاء/فروع ${records.length} - أصناف ${products.length}`);render();toast('تم استرجاع كل البيانات الأصلية')}
function hasContact(r){return !!(r.mobile||r.phone||r.email)}
function hasAddress(r){return !!(r.street||r.city||r.state)}
function complete(r){return hasContact(r)&&hasAddress(r)&&!!taxFor(r)}
function groups(list=records){return list.reduce((a,r)=>{const k=officialName(r.client);(a[k]||=[]).push(r);return a}, {})}
function normalizeColor(c){const x=clean(c); if(x.includes('بيض')) return 'أبيض'; if(x.includes('حمر')) return 'أحمر'; if(x.includes('بلدي')) return 'بلدي'; return norm(c)||'غير محدد'}
function productBrand(p){const s=clean([p.name,p.displayName,p.segment,p.notes,p.barcode].join(' ')); if(s.includes('بيج')||s.includes('big')) return 'bigegg'; if(s.includes('كارفور')||s.includes('carrefour')) return 'carrefour'; if(s.includes('فاليو')||s.includes('value')) return 'value'; return 'other'}
function brandName(k){return k==='bigegg'?'Big Egg / بيج ايج':k==='carrefour'?'Carrefour / كارفور':k==='value'?'Value / فاليو':'أخرى'}

function login(){if($('password').value===PASSWORD){sessionStorage.setItem('oval_ok','1');$('login').classList.add('hidden');$('app').classList.remove('hidden');start()}else $('loginMsg').textContent='كلمة السر غير صحيحة'}
function start(){initData();bind();render()}
function bind(){
  document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  $('logout').onclick=()=>{sessionStorage.removeItem('oval_ok');location.reload()};
  $('restoreBtn').onclick=restoreOriginal;
  $('backupBtn').onclick=backup;
  $('exportBtn').onclick=exportExcel;
  $('importJson').onchange=importJson;
  $('search').oninput=applyFilters; $('clientFilter').oninput=applyFilters; $('stateFilter').oninput=applyFilters;
  $('clearFilters').onclick=()=>{ $('search').value=''; $('clientFilter').value=''; $('stateFilter').value=''; applyFilters(); };
  $('productSearch').oninput=renderProducts; $('brandFilter').oninput=renderProducts; $('colorFilter').oninput=renderProducts;
  $('orderClient').onchange=fillOrderBranches; $('addOrderLine').onclick=addOrderLine; $('copyOrder').onclick=()=>copyText($('orderText').value,'تم نسخ الأوردر');
  $('crmClient').onchange=fillCrmBranches; $('saveCrm').onclick=saveCrm;
  $('copyReport').onclick=()=>copyText($('dailyReport').value,'تم نسخ التقرير');
  $('copyManagerSummary').onclick=copyManagerSummary; $('copySmartSummary').onclick=copyManagerSummary;
  $('driverSearch').oninput=renderDriver;
  $('addBranchBtn').onclick=addRecordQuick; $('addProductBtn').onclick=addProductQuick;
  $('closeDetails').onclick=()=>$('details').classList.add('hidden');
  document.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('keydown',e=>{if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&['I','J','C'].includes(e.key.toUpperCase()))){e.preventDefault();toast('البيانات خاصة')}});
}
function switchTab(id){document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.id===id)); if(id==='reports')renderReport(); if(id==='driver')renderDriver(); if(id==='smart')renderSmart(); if(id==='products')renderProducts()}
function render(){filtered=[...records];renderFilters(true);renderDashboard();renderCustomers();renderBranches();renderProducts();fillOrderSelects();renderCrm();renderReport();renderAuditTrash();renderDriver();renderSmart()}
function renderFilters(reset=false){
  const clients=unique(records.map(r=>officialName(r.client))); const states=unique(records.map(r=>r.state));
  const oldC=$('clientFilter').value, oldS=$('stateFilter').value;
  $('clientFilter').innerHTML='<option value="">كل العملاء</option>'+clients.map(c=>`<option ${!reset&&c===oldC?'selected':''}>${esc(c)}</option>`).join('');
  $('stateFilter').innerHTML='<option value="">كل المحافظات</option>'+states.map(s=>`<option ${!reset&&s===oldS?'selected':''}>${esc(s)}</option>`).join('');
}
function applyFilters(){
  const q=clean($('search').value), cf=$('clientFilter').value, sf=$('stateFilter').value;
  filtered=records.filter(r=>{
    const blob=clean([r.client,officialName(r.client),r.branch,r.street,r.city,r.state,r.mobile,r.phone,r.email,taxFor(r)].join(' '));
    return (!q||blob.includes(q)) && (!cf||officialName(r.client)===cf) && (!sf||r.state===sf);
  });
  renderDashboard(); renderCustomers(); renderBranches(); renderDriver(); renderSmart();
}
function countDuplicates(){const map={}; records.forEach(r=>{const k=clean(officialName(r.client)+' '+r.branch); map[k]=(map[k]||0)+1}); return Object.values(map).filter(v=>v>1).length}
function colorStats(list=products){const o={}; list.forEach(p=>{const c=normalizeColor(p.color)||'غير محدد'; o[c]=(o[c]||0)+1}); return o}
function brandStats(list=products){const o={}; list.forEach(p=>{const c=productBrand(p); o[c]=(o[c]||0)+1}); return o}
function renderDashboard(){
  const g=groups(records);
  $('kClients').textContent=Object.keys(g).length;
  $('kBranches').textContent=records.length;
  $('kStates').textContent=unique(records.map(r=>r.state)).length;
  $('kContacts').textContent=records.filter(hasContact).length;
  $('kProducts').textContent=products.length;

  barChart('topClients', Object.entries(groups(filtered)).map(([n,it])=>[n,it.length]).sort((a,b)=>b[1]-a[1]).slice(0,12));
  const st={}; filtered.forEach(r=>st[r.state||'غير محدد']=(st[r.state||'غير محدد']||0)+1);
  barChart('statesChart', Object.entries(st).sort((a,b)=>b[1]-a[1]).slice(0,12));

  const cStats=colorStats(products), bStats=brandStats(products);
  $('colorStats').innerHTML=['أبيض','أحمر','بلدي'].map(k=>chipCard(k,cStats[k]||0)).join('');
  $('brandStats').innerHTML=['bigegg','carrefour','value','other'].map(k=>chipCard(brandName(k),bStats[k]||0)).join('');

  const biggest=Object.entries(g).sort((a,b)=>b[1].length-a[1].length)[0]?.[0]||'لا يوجد';
  $('alerts').innerHTML=[
    `أكبر عميل: ${biggest}`,
    `فروع ناقصة تواصل: ${records.filter(r=>!hasContact(r)).length}`,
    `فروع ناقصة عنوان: ${records.filter(r=>!hasAddress(r)).length}`,
    `سجلات ناقصة رقم ضريبي: ${records.filter(r=>!taxFor(r)).length}`,
    `تكرارات محتملة: ${countDuplicates()}`,
    `أصناف بدون كود: ${products.filter(p=>!p.barcode).length}`,
    `أصناف بيضاء: ${cStats['أبيض']||0}`,
    `أصناف حمراء: ${cStats['أحمر']||0}`,
    `أصناف بلدي: ${cStats['بلدي']||0}`
  ].map(x=>`<div class="alert">${esc(x)}</div>`).join('');
}
function chipCard(label,value){return `<div class="chip-card"><span>${esc(label)}</span><b>${value}</b></div>`}
function barChart(id,data){const max=Math.max(1,...data.map(x=>x[1]));$(id).innerHTML=data.map(([n,v])=>`<div class="bar"><b>${esc(n)}</b><div class="track"><div class="fill" style="width:${(v/max)*100}%"></div></div><span>${v}</span></div>`).join('')||'<div class="empty">لا توجد بيانات</div>'}

function clientScore(items){return Math.round(items.filter(complete).length/Math.max(items.length,1)*100)}
function renderCustomers(){
  const g=groups(filtered);
  $('customersList').innerHTML=Object.entries(g).sort((a,b)=>a[0].localeCompare(b[0],'ar')).map(([client,items])=>{
    const score=clientScore(items), missing=items.filter(x=>!complete(x)).length, tax=taxFor(items[0])||'غير مسجل';
    return `<article class="client-card">
      <div class="client-head">
        <div class="client-title">
          <b>${esc(client)}</b>
          <small>${items.length} فرع · الرقم الضريبي: ${esc(tax)} · اكتمال البيانات ${score}%</small>
          <div class="inline-stats">
            <span class="stat-pill">ناقص بيانات: ${missing}</span>
            <span class="stat-pill">بيانات تواصل: ${items.filter(hasContact).length}</span>
            <span class="stat-pill">محافظات: ${unique(items.map(x=>x.state)).length}</span>
          </div>
        </div>
        <div class="card-actions">
          <button class="action-btn" onclick="copyClient('${escAttr(client)}')">نسخ العميل</button>
          <button class="action-btn" onclick="addBranchForClient('${escAttr(client)}')">إضافة فرع</button>
        </div>
      </div>
      <div class="branch-grid">${items.map(branchCard).join('')}</div>
    </article>`
  }).join('')||'<div class="empty">لا توجد بيانات</div>';
}
function branchCard(r){
  const adr=[r.street,r.city,r.state].filter(Boolean).join(' - ')||'غير مسجل';
  return `<div class="branch-card" onclick="showDetails('${r.id}')">
    <div>
      <h3>${esc(r.branch)}</h3>
      <div class="meta">
        <span><strong>العميل:</strong> ${esc(officialName(r.client))}</span>
        <span><strong>المحافظة:</strong> ${esc(r.state||'غير محدد')}</span>
        <span><strong>المدينة:</strong> ${esc(r.city||'غير محدد')}</span>
        <span><strong>العنوان:</strong> ${esc(adr)}</span>
      </div>
    </div>
    <div class="row-actions" onclick="event.stopPropagation()">
      <button class="action-btn" onclick="copyBranch('${r.id}')">نسخ</button>
      <button class="action-btn" onclick="editRecord('${r.id}')">تعديل</button>
      <button class="action-btn danger-soft" onclick="deleteRecord('${r.id}')">حذف</button>
    </div>
  </div>`
}
function renderBranches(){$('branchesGrid').innerHTML=filtered.map(branchCard).join('')||'<div class="empty">لا توجد فروع</div>'}
function showDetails(id){
  const r=records.find(x=>x.id===id); if(!r) return;
  const adr=[r.street,r.city,r.state].filter(Boolean).join(' - ')||'غير مسجل';
  const contact=[r.mobile,r.phone,r.email].filter(Boolean).join(' | ')||'غير مسجل';
  $('detailsBody').innerHTML=`
    <div class="details-head"><h2>${esc(r.branch)}</h2><p>${esc(officialName(r.client))}</p></div>
    <div class="details-grid">
      ${detail('اسم العميل الرسمي',officialName(r.client))}
      ${detail('اسم العميل الأصلي',r.client)}
      ${detail('اسم الفرع كامل',r.branch)}
      ${detail('الرقم الضريبي',taxFor(r)||'غير مسجل')}
      ${detail('المحافظة',r.state||'غير محدد')}
      ${detail('المدينة',r.city||'غير محدد')}
      ${detail('العنوان',adr)}
      ${detail('بيانات التواصل',contact)}
      ${detail('شروط الدفع',r.paymentTerms||'غير مسجل')}
      ${detail('ملاحظات',r.notes||'لا توجد')}
    </div>
    <hr class="soft">
    <div class="row-actions">
      <button onclick="copyBranch('${r.id}')">نسخ بيانات الفرع</button>
      <button onclick="editRecord('${r.id}')">تعديل</button>
      <button onclick="deleteRecord('${r.id}')" class="danger-soft">حذف</button>
    </div>`;
  $('details').classList.remove('hidden');
}
function detail(label,value){return `<div class="detail"><span>${esc(label)}</span><b>${esc(value)}</b></div>`}

function filteredProducts(){
  const q=clean($('productSearch')?.value||'');
  const bf=$('brandFilter')?.value||'';
  const cf=$('colorFilter')?.value||'';
  return products.filter(p=>{
    const blob=clean([p.name,p.displayName,p.barcode,p.color,p.packSize,p.segment,p.packaging,p.notes].join(' '));
    return (!q||blob.includes(q)) && (!bf||productBrand(p)===bf) && (!cf||normalizeColor(p.color)===cf)
  })
}
function renderProducts(){
  const list=filteredProducts();
  const cStats=colorStats(list), bStats=brandStats(list);
  $('productsOverview').innerHTML=[
    chipCard('إجمالي المعروض', list.length),
    chipCard('أبيض', cStats['أبيض']||0),
    chipCard('أحمر', cStats['أحمر']||0),
    chipCard('بلدي', cStats['بلدي']||0),
    chipCard('بيج ايج', bStats['bigegg']||0),
    chipCard('كارفور/فاليو/أخرى', (bStats['carrefour']||0)+(bStats['value']||0)+(bStats['other']||0))
  ].join('');
  const brandOrder=['bigegg','carrefour','value','other'];
  const colorOrder=['أبيض','أحمر','بلدي'];
  $('productsSections').innerHTML=brandOrder.map(brand=>{
    const brandItems=list.filter(p=>productBrand(p)===brand);
    if(!brandItems.length) return '';
    const content=colorOrder.map(color=>{
      const colorItems=brandItems.filter(p=>normalizeColor(p.color)===color);
      if(!colorItems.length) return '';
      return `<div class="color-group"><div class="color-head"><h3>${esc(color)}</h3><span class="mini-note">${colorItems.length} صنف</span></div><div class="products-grid">${colorItems.map(productCard).join('')}</div></div>`
    }).join('') + (()=>{
      const otherColors=brandItems.filter(p=>!colorOrder.includes(normalizeColor(p.color)));
      if(!otherColors.length) return '';
      return `<div class="color-group"><div class="color-head"><h3>أخرى</h3><span class="mini-note">${otherColors.length} صنف</span></div><div class="products-grid">${otherColors.map(productCard).join('')}</div></div>`
    })();
    return `<section class="brand-section"><div class="brand-box"><div class="brand-title"><span>${brandName(brand)}</span><small>${brandItems.length} صنف</small></div>${content}</div></section>`
  }).join('') || '<div class="empty">لا توجد أصناف</div>';
}
function productCard(p){
  const color=normalizeColor(p.color);
  return `<div class="product-card">
    <div>
      <b>${esc(p.name)}</b>
      <div class="code">${esc(p.barcode||'بدون كود')}</div>
      <div>
        <span class="tag" style="background:${colorPalette[color]||'#eef7f0'}">${esc(color||'غير محدد')}</span>
        <span class="tag">${esc(p.packSize||'حجم غير محدد')}</span>
        <span class="tag">${esc(brandName(productBrand(p)))}</span>
      </div>
    </div>
    <div class="row-actions">
      <button class="action-btn" onclick="copyProduct('${p.id}')">نسخ</button>
      <button class="action-btn" onclick="editProduct('${p.id}')">تعديل</button>
      <button class="action-btn danger-soft" onclick="deleteProduct('${p.id}')">حذف</button>
    </div>
  </div>`
}

function fillOrderSelects(){
  const clients=unique(records.map(r=>officialName(r.client)));
  ['orderClient','crmClient'].forEach(id=>$(id).innerHTML=clients.map(c=>`<option>${esc(c)}</option>`).join(''));
  $('orderProduct').innerHTML=products.map(p=>`<option value="${p.id}">${esc(p.name)} - ${esc(p.barcode||'بدون كود')}</option>`).join('');
  fillOrderBranches(); fillCrmBranches();
}
function fillOrderBranches(){const c=$('orderClient').value; const arr=records.filter(r=>officialName(r.client)===c); $('orderBranch').innerHTML=arr.map(r=>`<option value="${r.id}">${esc(r.branch)}</option>`).join('')}
function fillCrmBranches(){const c=$('crmClient').value; const arr=records.filter(r=>officialName(r.client)===c); $('crmBranch').innerHTML=arr.map(r=>`<option value="${r.id}">${esc(r.branch)}</option>`).join('')}
function addOrderLine(){
  const r=records.find(x=>x.id===$('orderBranch').value), p=products.find(x=>x.id===$('orderProduct').value), qty=Number($('orderQty').value||1);
  if(!r||!p) return;
  orderLines.push({client:officialName(r.client), branch:r.branch, product:p.name, barcode:p.barcode, qty, eggs:qty*(Number(p.packSize)||0)});
  renderOrder();
}
function renderOrder(){
  $('orderBody').innerHTML=orderLines.map((l,i)=>`<tr><td>${esc(l.client)}</td><td>${esc(l.branch)}</td><td>${esc(l.product)}</td><td>${esc(l.barcode)}</td><td>${l.qty}</td><td>${l.eggs}</td><td><button onclick="orderLines.splice(${i},1);renderOrder()">حذف</button></td></tr>`).join('');
  $('orderText').value='أوردر OVAL\n'+orderLines.map(l=>`${l.client} - ${l.branch}\n${l.product} | ${l.barcode}\nالكمية: ${l.qty} | إجمالي البيض: ${l.eggs}`).join('\n----------------\n');
}

function saveCrm(){
  const r=records.find(x=>x.id===$('crmBranch').value);
  const list=read(LS_CRM,[]);
  list.unshift({id:crypto.randomUUID(), at:new Date().toLocaleString('ar-EG'), client:$('crmClient').value, branch:r?.branch||'', owner:$('crmOwner').value, next:$('crmNext').value, note:$('crmNote').value});
  write(LS_CRM,list); renderCrm(); toast('تم حفظ المتابعة');
}
function renderCrm(){$('crmList').innerHTML=read(LS_CRM,[]).map(x=>`<div class="alert"><b>${esc(x.client)}</b><br>${esc(x.branch)}<br>${esc(x.owner)}${x.next?` - ${esc(x.next)}`:''}<br>${esc(x.note)}</div>`).join('')||'<div class="empty">لا توجد متابعات</div>'}

function renderReport(){
  const g=groups(records);
  const top=Object.entries(g).sort((a,b)=>b[1].length-a[1].length).slice(0,10).map(([n,it])=>`- ${n}: ${it.length} فرع`).join('\n');
  const colors=colorStats(products);
  $('dailyReport').value=`تقرير OVAL اليومي\nالتاريخ: ${new Date().toLocaleDateString('ar-EG')}\n\nإجمالي العملاء: ${Object.keys(g).length}\nإجمالي الفروع: ${records.length}\nإجمالي الأصناف: ${products.length}\nالمحافظات: ${unique(records.map(r=>r.state)).length}\nبيانات تواصل: ${records.filter(hasContact).length}\nبيانات ناقصة: ${records.filter(r=>!complete(r)).length}\nتكرارات محتملة: ${countDuplicates()}\n\nتحليل الأصناف:\n- أبيض: ${colors['أبيض']||0}\n- أحمر: ${colors['أحمر']||0}\n- بلدي: ${colors['بلدي']||0}\n\nأكبر العملاء حسب عدد الفروع:\n${top}`
}
function renderDriver(){
  const q=clean($('driverSearch')?.value||$('search').value||'');
  const list=records.filter(r=>!q||clean([officialName(r.client),r.branch,r.street,r.city,r.state,r.mobile,r.phone].join(' ')).includes(q)).slice(0,80);
  $('driverList').innerHTML=list.map(r=>`<div class="branch-card"><div><h3>${esc(r.branch)}</h3><div class="meta"><span>${esc(officialName(r.client))}</span><span>${esc([r.street,r.city,r.state].filter(Boolean).join(' - ')||'غير مسجل')}</span><span>${esc([r.mobile,r.phone].filter(Boolean).join(' | ')||'لا يوجد رقم')}</span></div></div><div class="row-actions"><button onclick="copyBranch('${r.id}')">نسخ</button></div></div>`).join('')||'<div class="empty">لا توجد نتائج</div>'
}

function renderSmart(){
  const g=groups(records);
  const biggest=Object.entries(g).sort((a,b)=>b[1].length-a[1].length)[0] || ['لا يوجد',[]];
  const missingContact=records.filter(r=>!hasContact(r)).length;
  const missingAddress=records.filter(r=>!hasAddress(r)).length;
  const missingTax=records.filter(r=>!taxFor(r)).length;
  const dup=countDuplicates();
  const colors=colorStats(products);
  $('smartSummary').innerHTML=[
    `إجمالي العملاء ${Object.keys(g).length} عميل، وإجمالي الفروع ${records.length} فرع، وإجمالي الأصناف ${products.length} صنف.`,
    `أكبر عميل حاليًا هو ${biggest[0]} بعدد ${biggest[1].length} فرع.`,
    `تحليل الألوان: أبيض ${colors['أبيض']||0}، أحمر ${colors['أحمر']||0}، بلدي ${colors['بلدي']||0}.`,
    `عدد السجلات المكتملة بالكامل ${records.filter(complete).length} من أصل ${records.length}.`
  ].map(t=>`<div class="smart-line">${esc(t)}</div>`).join('');

  const tips=[];
  if(missingContact) tips.push(`يوجد ${missingContact} فرع ناقص بيانات تواصل، ويفضل استكمال أرقام الهواتف أو الإيميلات.`);
  if(missingAddress) tips.push(`يوجد ${missingAddress} فرع ناقص عنوان، وده مهم للسواقين وخطة التوريد.`);
  if(missingTax) tips.push(`يوجد ${missingTax} سجل بدون رقم ضريبي ظاهر، ويفضل مراجعته مع ملف السجل الضريبي.`);
  if(dup) tips.push(`تم رصد ${dup} تكرار محتمل، راجع أسماء الفروع المتشابهة لتفادي الازدواج.`);
  tips.push(`قسم الأصناف متقسم حسب القسم التجاري واللون، وده بيسهل الوصول للصنف بسرعة.`);
  tips.push(`استخدم زر "نسخ ملخص للإدارة" لإرسال ملخص سريع للمدير في ثواني.`);
  $('smartTips').innerHTML=tips.map(t=>`<div class="smart-tip">${esc(t)}</div>`).join('');

  $('smartIssues').innerHTML=[
    issueCard('فروع ناقصة تواصل', missingContact),
    issueCard('فروع ناقصة عنوان', missingAddress),
    issueCard('سجلات ناقصة رقم ضريبي', missingTax),
    issueCard('تكرارات محتملة', dup),
    issueCard('أصناف بلا باركود', products.filter(p=>!p.barcode).length),
    issueCard('عملاء لهم أكثر من 10 فروع', Object.values(g).filter(v=>v.length>10).length)
  ].join('');
}
function issueCard(label,value){return `<div class="issue-card"><span>${esc(label)}</span><b style="display:block;font-size:34px;color:var(--green);margin-top:6px">${value}</b></div>`}

function renderAuditTrash(){
  $('auditList').innerHTML=read(LS_AUDIT,[]).map(x=>`<div class="alert"><b>${esc(x.action)}</b><br>${esc(x.at)}<br>${esc(x.details)}</div>`).join('')||'<div class="empty">لا يوجد سجل</div>';
  $('trashList').innerHTML=read(LS_TRASH,[]).map(x=>`<div class="alert"><b>${esc(x.client)} - ${esc(x.branch)}</b><br><br><button onclick="restoreTrash('${x.id}')">استرجاع</button></div>`).join('')||'<div class="empty">السلة فارغة</div>';
}

function copyText(text,msg='تم النسخ'){navigator.clipboard.writeText(text||''); toast(msg)}
function copyBranch(id){const r=records.find(x=>x.id===id); if(!r) return; copyText(`العميل: ${officialName(r.client)}\nالفرع: ${r.branch}\nالرقم الضريبي: ${taxFor(r)||'غير مسجل'}\nالعنوان: ${[r.street,r.city,r.state].filter(Boolean).join(' - ')||'غير مسجل'}\nالتواصل: ${[r.mobile,r.phone,r.email].filter(Boolean).join(' | ')||'غير مسجل'}`, 'تم نسخ بيانات الفرع')}
function copyClient(client){const arr=records.filter(r=>officialName(r.client)===client); copyText(`${client}\nعدد الفروع: ${arr.length}\n`+arr.map((r,i)=>`${i+1}. ${r.branch} - ${r.city||''} - ${r.state||''}`).join('\n'),'تم نسخ العميل بفروعه')}
function copyProduct(id){const p=products.find(x=>x.id===id); if(!p) return; copyText(`الصنف: ${p.name}\nالكود: ${p.barcode||'بدون كود'}\nاللون: ${normalizeColor(p.color)}\nالحجم: ${p.packSize||'غير محدد'}\nالقسم: ${brandName(productBrand(p))}`,'تم نسخ بيانات الصنف')}
function copyManagerSummary(){
  const g=groups(records), colors=colorStats(products), biggest=Object.entries(g).sort((a,b)=>b[1].length-a[1].length)[0];
  const text=`ملخص OVAL للإدارة\n\nإجمالي العملاء: ${Object.keys(g).length}\nإجمالي الفروع: ${records.length}\nإجمالي الأصناف: ${products.length}\nالمحافظات: ${unique(records.map(r=>r.state)).length}\nبيانات تواصل: ${records.filter(hasContact).length}\nبيانات ناقصة: ${records.filter(r=>!complete(r)).length}\nأكبر عميل: ${biggest?biggest[0]:'لا يوجد'}${biggest?` (${biggest[1].length} فرع)`:''}\n\nتحليل الألوان:\nأبيض: ${colors['أبيض']||0}\nأحمر: ${colors['أحمر']||0}\nبلدي: ${colors['بلدي']||0}`;
  copyText(text,'تم نسخ ملخص الإدارة');
}

function addRecordQuick(){
  const client=prompt('اسم العميل'); if(!client) return;
  const branch=prompt('اسم الفرع بالكامل'); if(!branch) return;
  const state=prompt('المحافظة')||''; const city=prompt('المدينة')||''; const street=prompt('العنوان')||'';
  const mobile=prompt('الموبايل / الهاتف')||''; const email=prompt('الإيميل')||''; const taxId=prompt('الرقم الضريبي')||'';
  records.unshift(normalizeRecord({client,branchFullName:branch,state,city,street,mobile,email,taxId}));
  saveAll(); addAudit('إضافة فرع', `${client} - ${branch}`); render(); toast('تمت إضافة الفرع');
}
function addBranchForClient(client){
  const branch=prompt(`اسم الفرع الجديد للعميل ${client}`); if(!branch) return;
  const state=prompt('المحافظة')||''; const city=prompt('المدينة')||''; const street=prompt('العنوان')||'';
  const mobile=prompt('الموبايل / الهاتف')||''; const email=prompt('الإيميل')||'';
  records.unshift(normalizeRecord({client,branchFullName:branch,state,city,street,mobile,email}));
  saveAll(); addAudit('إضافة فرع', `${client} - ${branch}`); render(); toast('تمت إضافة الفرع');
}
function editRecord(id){
  const r=records.find(x=>x.id===id); if(!r) return;
  const client=prompt('اسم العميل', officialName(r.client)); if(client===null) return;
  const branch=prompt('اسم الفرع بالكامل', r.branch); if(branch===null) return;
  const state=prompt('المحافظة', r.state)||''; const city=prompt('المدينة', r.city)||''; const street=prompt('العنوان', r.street)||'';
  const mobile=prompt('الموبايل', r.mobile)||''; const phone=prompt('الهاتف الأرضي', r.phone)||''; const email=prompt('الإيميل', r.email)||'';
  const paymentTerms=prompt('شروط الدفع', r.paymentTerms)||''; const notes=prompt('ملاحظات', r.notes)||''; const taxId=prompt('الرقم الضريبي', taxFor(r))||'';
  Object.assign(r,{client, branch, branchFullName:branch, state, city, street, mobile, phone, email, paymentTerms, notes, taxId});
  saveAll(); addAudit('تعديل فرع', `${client} - ${branch}`); render(); showDetails(id); toast('تم تعديل بيانات الفرع');
}
function deleteRecord(id){
  if(prompt('للحذف اكتب: حذف')!=='حذف') return;
  const r=records.find(x=>x.id===id); if(!r) return;
  records=records.filter(x=>x.id!==id);
  const t=read(LS_TRASH,[]); t.unshift(r); write(LS_TRASH,t);
  saveAll(); addAudit('حذف فرع', `${r.client} - ${r.branch}`); $('details').classList.add('hidden'); render(); toast('تم حذف الفرع');
}
function restoreTrash(id){
  const t=read(LS_TRASH,[]), r=t.find(x=>x.id===id); if(!r) return;
  records.unshift(normalizeRecord(r)); write(LS_TRASH, t.filter(x=>x.id!==id)); saveAll(); addAudit('استرجاع فرع', `${r.client} - ${r.branch}`); render(); toast('تم استرجاع الفرع');
}

function addProductQuick(){
  const name=prompt('اسم الصنف'); if(!name) return;
  const barcode=prompt('الباركود / الكود')||''; const color=prompt('اللون: أبيض / أحمر / بلدي')||''; const packSize=prompt('حجم العبوة / العدد')||'';
  const segment=prompt('القسم: Big Egg / Carrefour / Value / أخرى')||''; const packaging=prompt('نوع التعبئة')||'';
  products.unshift(normalizeProduct({name,barcode,color,packSize,segment,packaging})); saveAll(); addAudit('إضافة صنف', name); renderProducts(); renderDashboard(); renderSmart(); toast('تم إضافة الصنف');
}
function editProduct(id){
  const p=products.find(x=>x.id===id); if(!p) return;
  const name=prompt('اسم الصنف', p.name); if(name===null) return;
  const barcode=prompt('الباركود / الكود', p.barcode)||''; const color=prompt('اللون', normalizeColor(p.color))||''; const packSize=prompt('حجم العبوة / العدد', p.packSize)||'';
  const segment=prompt('القسم', p.segment)||''; const packaging=prompt('نوع التعبئة', p.packaging)||''; const notes=prompt('ملاحظات', p.notes)||'';
  Object.assign(p,{name, displayName:name, barcode, color, packSize, segment, packaging, notes}); saveAll(); addAudit('تعديل صنف', name); renderProducts(); renderDashboard(); renderSmart(); toast('تم تعديل الصنف');
}
function deleteProduct(id){
  if(prompt('لحذف الصنف اكتب: حذف')!=='حذف') return;
  const p=products.find(x=>x.id===id); if(!p) return;
  products=products.filter(x=>x.id!==id); saveAll(); addAudit('حذف صنف', p.name); renderProducts(); renderDashboard(); renderSmart(); toast('تم حذف الصنف');
}

function backup(){download(JSON.stringify({records,products,crm:read(LS_CRM,[]),audit:read(LS_AUDIT,[]),trash:read(LS_TRASH,[]),createdAt:new Date().toISOString()},null,2),'oval-manager-backup.json','application/json')}
function importJson(e){
  const f=e.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{try{const o=JSON.parse(rd.result); if(Array.isArray(o.records)) records=o.records.map(normalizeRecord); if(Array.isArray(o.products)) products=o.products.map(normalizeProduct); if(Array.isArray(o.crm)) write(LS_CRM,o.crm); if(Array.isArray(o.audit)) write(LS_AUDIT,o.audit); if(Array.isArray(o.trash)) write(LS_TRASH,o.trash); saveAll(); render(); toast('تم الاستيراد')}catch{alert('ملف غير صحيح')}};
  rd.readAsText(f); e.target.value='';
}
function exportExcel(){
  const headers=['العميل الرسمي','العميل الأصلي','الفرع الكامل','الرقم الضريبي','المحافظة','المدينة','العنوان','موبايل','هاتف','إيميل','شروط الدفع'];
  const rows=records.map(r=>[officialName(r.client),r.client,r.branch,taxFor(r),r.state,r.city,r.street,r.mobile,r.phone,r.email,r.paymentTerms]);
  const html='<html dir="rtl"><meta charset="utf-8"><table border="1"><tr>'+headers.map(h=>`<th>${esc(h)}</th>`).join('')+'</tr>'+
    rows.map(row=>'<tr>'+row.map(c=>`<td>${esc(c)}</td>`).join('')+'</tr>').join('')+'</table></html>';
  download(html,'oval-customers-branches.xls','application/vnd.ms-excel;charset=utf-8');
}

window.addEventListener('DOMContentLoaded',()=>{
  $('loginBtn').onclick=login;
  $('password').onkeydown=e=>{if(e.key==='Enter') login()};
  if(sessionStorage.getItem('oval_ok')==='1'){ $('login').classList.add('hidden'); $('app').classList.remove('hidden'); start(); }
});
