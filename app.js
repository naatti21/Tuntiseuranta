/* TyömaaTunnit 0.2A.5: yksi yritys, kirjautuminen ja Postgres/RLS.
 * Ei paikallista työaikatietojen tallennusta. Ei salaisia avaimia selaimessa.
 */
'use strict';

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const config = window.APP_CONFIG || {};
let client = null;
let session = null;
let myself = null;
let members = [];
let sites = [];
let entries = [];
let reportEntries = [];
let reportPeriodLoaded = '';
let reportLoading = false;
let editId = null;
let currentView = 'new';
let loadSerial = 0;
let busy = false;
const statusText = {submitted:'Odottaa hyväksyntää', needs_changes:'Palautettu', approved:'Hyväksytty'};
const isLead = () => ['supervisor','admin'].includes(myself?.role);
const isAdmin = () => myself?.role === 'admin';
// Pääkäyttäjän oman vanhan testileiman historia säilyy kannassa, mutta se ei kuulu työntekijöiden koontiin.
const isWorkerEntry = e => !isAdmin() || (e.employee_id!==session?.user?.id && !members.some(m=>m.user_id===e.employee_id && m.role==='admin'));
const hasConnection = () => navigator.onLine;

function show(id) { ['setup','login','app'].forEach(x => $(x).classList.toggle('hidden', x !== id)); }
function feedback(message, type='ok') {
  const el = $('banner'); el.textContent = message;
  el.className = `banner ${type}`; el.classList.remove('hidden');
  window.scrollTo({top:0,behavior:'smooth'});
}
function clearFeedback(){ $('banner').classList.add('hidden'); }
function errorText(err) { return err?.message || String(err || 'Tuntematon virhe'); }
function localYmd(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function localHm(d) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
function localDateTime(utc) { const d = new Date(utc); return {date:localYmd(d),time:localHm(d)}; }
function humanDate(utc) { return new Intl.DateTimeFormat('fi-FI',{timeZone:'Europe/Helsinki',day:'numeric',month:'numeric',year:'numeric'}).format(new Date(utc)); }
function formatHour(min) { return `${Math.floor(min/60)} h ${String(min%60).padStart(2,'0')} min`; }
function deltaMins(start, end, breaks=0) { return Math.round((new Date(end).getTime()-new Date(start).getTime())/60000)-breaks; }

const travelFields = ['travel-out-start','travel-out-end','travel-back-start','travel-back-end'];
const travelColumns = 'travel_out_start,travel_out_end,travel_back_start,travel_back_end';
function localInputDateTime(utc) {
  if(!utc)return '';
  const d=localDateTime(utc);
  return d.date+'T'+d.time;
}
function travelMinutes(e,which) {
  const a=e[which+'_start'],b=e[which+'_end'];
  return a&&b ? deltaMins(a,b,0) : 0;
}
function travelTotals(e) {
  const outbound=travelMinutes(e,'travel_out');
  const inbound=travelMinutes(e,'travel_back');
  return {outbound,inbound,total:outbound+inbound};
}
function fromTravelForm(workStart,workEnd) {
  const [outStart,outEnd,backStart,backEnd]=travelFields.map(id=>$(id).value);
  const intervals=[[outStart,outEnd,'Menomatka'],[backStart,backEnd,'Paluumatka']];
  const parsed=intervals.map(([a,b,name])=>{
    if(!a&&!b)return [null,null];
    if(!a||!b)throw Error(name+': täytä lähtö ja saapuminen');
    const start=new Date(a),end=new Date(b);
    if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||
       end<=start||end-start>24*3600000)
      throw Error(name+': tarkista päivämäärät ja kellonajat');
    if(start<new Date(workEnd)&&end>new Date(workStart))
      throw Error(name+' ja kirjattu työaika eivät saa mennä päällekkäin');
    return [start,end];
  });
  if(parsed[0][0]&&parsed[1][0]&&parsed[0][0]<parsed[1][1]&&parsed[0][1]>parsed[1][0])
    throw Error('Meno- ja paluumatka eivät saa mennä päällekkäin');
  return {
    p_out_start:parsed[0][0]?.toISOString()||null,
    p_out_end:parsed[0][1]?.toISOString()||null,
    p_back_start:parsed[1][0]?.toISOString()||null,
    p_back_end:parsed[1][1]?.toISOString()||null
  };
}
function calculateTravel() {
  try {
    // Laske vain valmiit matkajaksot, jotta puoliksi täytetty lomake ei estä työajan näyttämistä.
    const pairs=[['travel-out-start','travel-out-end','travel-out-duration'],
      ['travel-back-start','travel-back-end','travel-back-duration']];
    let total=0;
    for(const [a,b,target] of pairs) {
      const from=$(a).value,to=$(b).value;
      const mins=from&&to ? deltaMins(new Date(from),new Date(to),0) : null;
      $(target).textContent=mins!==null&&mins>0 ? formatHour(mins) : '—';
      if(mins!==null&&mins>0)total+=mins;
    }
    $('travel-total').textContent=formatHour(total);
  }catch { $('travel-total').textContent='—'; }
}

function fromForm() {
  const date = $('work-date').value, start = $('start').value, end = $('end').value;
  if (!date || !start || !end) throw Error('Täytä päivämäärä ja kellonajat');
  const first = new Date(`${date}T${start}:00`);
  const last = new Date(`${date}T${end}:00`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) throw Error('Virheelliset kellonajat');
  if (last <= first) last.setDate(last.getDate()+1);
  const br = $('unpaid-break-enabled').checked ? Number($('break').value) : 0;
  const minutes = deltaMins(first.toISOString(),last.toISOString(),br);
  if (!Number.isInteger(br) || br<0 || br>1439 || minutes<=0 || deltaMins(first,last,0)>1440)
    throw Error('Tarkista kellonajat ja tauko (vuoro saa kestää enintään 24 tuntia)');
  return {p_worksite_id:$('worksite').value,p_start:first.toISOString(),p_end:last.toISOString(),p_break:br,p_note:$('note').value.trim()};
}
function syncUnpaidBreak() {
  const enabled=$('unpaid-break-enabled').checked;
  $('break-field').classList.toggle('hidden',!enabled);
  $('break').disabled=!enabled;
  $('break').required=enabled;
  if(!enabled) $('break').value='0';
  else if($('break').value==='0' || !$('break').value) $('break').value='30';
  calculate();
}
function calculate() {
  try { const v = fromForm(); $('net-time').textContent = formatHour(deltaMins(v.p_start,v.p_end,v.p_break)); }
  catch { $('net-time').textContent = '—'; }
  calculateTravel();
}
function fillSelect(select, options, placeholder='', selected='') {
  const el = $(select); el.replaceChildren();
  if (placeholder) el.add(new Option(placeholder,''));
  options.forEach(({value,label})=>el.add(new Option(label,value)));
  el.value = selected && options.some(o=>o.value===selected) ? selected : (placeholder?'':options[0]?.value||'');
}
function setView(name) {
  if (isAdmin() && (name==='mine' || (name==='new' && !editId))) return;
  if ((name === 'lead' || name === 'report') && !isLead()) return;
  if (name === 'sites' && !isAdmin()) return;
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('hidden',v.id!==`view-${name}`));
  document.querySelectorAll('[data-view]').forEach(v=>v.classList.toggle('active',v.dataset.view===name));
  currentView=name;
  if (name==='mine') renderMine();
  if (name==='lead') renderLead();
  if (name==='sites') renderSites();
  if (name==='report') { if (!reportPeriodLoaded) loadReport(); else renderReport(); }
}
function resetForm() {
  editId = null;
  $('entry-form').reset();
  $('work-date').value = localYmd(new Date());
  $('start').value='07:00';$('end').value='15:00';
  travelFields.forEach(id=>$(id).value='');
  $('travel-box').open=false;
  $('entry-extras').open=false;
  $('unpaid-break-enabled').checked=false;
  $('break').value='0';
  syncUnpaidBreak();
  $('edit-tag').classList.add('hidden'); $('cancel-edit').classList.add('hidden');
  $('reason-field').classList.add('hidden');$('reason').required=false;
  $('submit-entry').textContent='Lähetä tunnit';
  // Poista vain korjaukseen tilapäisesti lisätty arkistoitu työmaa normaalilomakkeelta.
  const activeSites=sites.filter(s=>s.active);
  const lastWorksite=entries.find(e=>e.employee_id===session?.user?.id && activeSites.some(site=>site.id===e.worksite_id))?.worksite_id;
  fillSelect('worksite',activeSites.map(s=>({value:s.id,label:s.name+(s.code?` (${s.code})`: '')})),'Valitse työmaa',lastWorksite||(activeSites.length===1?activeSites[0].id:''));
  if (members.length && isLead()) $('worker').value = session?.user?.id || '';
  calculate();
}
function resetState() {
  session=null;myself=null;members=[];sites=[];entries=[];reportEntries=[];reportPeriodLoaded='';editId=null;currentView='new';loadSerial++;
  $('person').textContent='Tervetuloa';
  $('mine-list').replaceChildren();$('lead-list').replaceChildren();
}
async function query(table,columns='*') {
  const {data,error} = await client.from(table).select(columns);
  if (error) throw error;
  return data || [];
}
async function loadData() {
  if (!session?.user) return;
  const id = ++loadSerial;
  try {
    const m = await query('memberships','user_id,display_name,role,active,organization_id');
    if (id!==loadSerial) return;
    myself = m.find(x=>x.user_id===session.user.id && x.active);
    if (!myself) {
      show('login');feedback('Tunnus on kirjautunut, mutta sitä ei ole liitetty aktiiviseksi työntekijäksi. Pyydä pääkäyttäjää lisäämään jäsenyys.', 'err');
      await client.auth.signOut(); return;
    }
    members=m.filter(x=>x.active);
    const [org, siteRows, entryRows] = await Promise.all([
      query('organizations','id,name'), query('worksites','id,name,code,active,organization_id'),
      client.from('time_entries').select('id,employee_id,worksite_id,start_at,end_at,break_minutes,note,status,created_by,updated_by,updated_at,review_reason,'+travelColumns)
        .order('start_at',{ascending:false}).limit(1000).then(({data,error})=>{if(error)throw error;return data||[];})
    ]);
    if (id!==loadSerial) return;
    sites=siteRows;entries=entryRows;
    $('company').textContent=org[0]?.name || 'Yritys';
    $('person').textContent=`Hei, ${myself.display_name}`;
    $('role-label').textContent={employee:'Työntekijä',supervisor:'Työnjohtaja',admin:'Pääkäyttäjä'}[myself.role]||myself.role;
    document.querySelectorAll('.lead-only').forEach(el=>el.classList.toggle('hidden',!isLead()));
    document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!isAdmin()));
    document.querySelectorAll('.admin-hide').forEach(el=>el.classList.toggle('hidden',isAdmin()));
    fillSelect('worksite',sites.filter(s=>s.active).map(s=>({value:s.id,label:s.name+(s.code?` (${s.code})`: '')})),'Valitse työmaa');
    fillSelect('worker',members.map(m=>({value:m.user_id,label:m.display_name})),'Valitse työntekijä',session.user.id);
    $('worker').required = isLead() && !isAdmin();
    $('worker').disabled = !isLead() || isAdmin();
    fillSelect('filter-worker',members.filter(m=>!isAdmin()||m.role!=='admin').map(m=>({value:m.user_id,label:m.display_name})),'Kaikki työntekijät');
    const rWorker=$('report-worker').value;
    const rSite=$('report-site').value;
    fillSelect('report-worker',members.filter(m=>!isAdmin()||m.role!=='admin').map(m=>({value:m.user_id,label:m.display_name})),'Kaikki työntekijät',rWorker);
    fillSelect('report-site',sites.map(s=>({value:s.id,label:s.name+(s.active?'':' (arkistoitu)')})),'Kaikki työmaat',rSite);
    if(!editId)resetForm();
    show('app');renderMine();renderLead();renderSites();
    setView(isAdmin() && (currentView==='new'||currentView==='mine') && !editId ? 'lead' : currentView);
    if (!sites.some(s=>s.active)) feedback('Yhtään aktiivista työmaata ei ole. Pääkäyttäjän täytyy lisätä ensimmäinen työmaa.','err');
    else clearFeedback();
  } catch (err) {
    feedback(`Tietojen lataus epäonnistui: ${errorText(err)}`,'err');
  }
}
function siteName(id){return sites.find(x=>x.id===id)?.name || 'Tuntematon työmaa';}
function employeeName(id){return members.find(x=>x.user_id===id)?.display_name || (id===session?.user?.id?myself?.display_name:'Tuntematon');}
function makeEntryCard(e,lead=false) {
  const min=deltaMins(e.start_at,e.end_at,e.break_minutes), local=localDateTime(e.start_at);
  const end=localDateTime(e.end_at);
  const canEdit=e.status!=='approved' && (isLead() || (e.employee_id===session.user.id && e.status==='needs_changes'));
  const canReview=lead && e.status==='submitted';
  const label = statusText[e.status] || e.status;
  const trip=travelTotals(e);
  return `<article class="entry">
    <div class="entry-top"><h3>${esc(siteName(e.worksite_id))}</h3><span class="status ${esc(e.status)}">${esc(label)}</span></div>
    ${lead?`<p class="muted">${esc(employeeName(e.employee_id))}</p>`:''}
    <div class="time">${esc(formatHour(min))}</div>
    <p class="muted">${esc(humanDate(e.start_at))} • ${esc(local.time)}–${esc(end.time)} • ${e.break_minutes>0?`palkaton taukovähennys ${e.break_minutes} min`:'ei palkatonta taukovähennystä'}</p>
    ${trip.total?`<p class="muted"><strong>Matka-aika ${esc(formatHour(trip.total))}</strong> • meno ${esc(formatHour(trip.outbound))}, paluu ${esc(formatHour(trip.inbound))}</p>`:''}
    ${e.note?`<p>${esc(e.note)}</p>`:''}
    ${e.review_reason?`<p class="muted"><strong>Perustelu:</strong> ${esc(e.review_reason)}</p>`:''}
    <div class="actions">
      ${canEdit?`<button type="button" class="btn ghost" data-action="edit" data-id="${esc(e.id)}">Korjaa</button>`:''}
      ${canReview?`<button type="button" class="btn secondary" data-action="approve" data-id="${esc(e.id)}" ${(e.created_by===session.user.id||e.updated_by===session.user.id)?'disabled title="Omaa kirjausta tai korjausta ei voi hyväksyä"':''}>Hyväksy</button><button type="button" class="btn ghost" data-action="return" data-id="${esc(e.id)}">Palauta</button>`:''}
    </div></article>`;
}
function drawSummary(target, array) {
  const minutes=array.reduce((sum,e)=>sum+deltaMins(e.start_at,e.end_at,e.break_minutes),0);
  const travel=array.reduce((sum,e)=>sum+travelTotals(e).total,0);
  const waiting=array.filter(e=>e.status==='submitted').length;
  $(target).innerHTML=`<div><strong>${array.length}</strong><span>Kirjauksia (näkymässä)</span></div><div><strong>${esc(formatHour(minutes))}</strong><span>Työaika</span></div><div><strong>${esc(formatHour(travel))}</strong><span>Matka-aika (erillinen)</span></div><div><strong>${waiting}</strong><span>Odottaa käsittelyä</span></div>`;
}
function renderMine() {
  if(!myself) return;
  const mine=entries.filter(e=>e.employee_id===session.user.id);
  drawSummary('mine-summary',mine);
  $('mine-list').innerHTML=mine.length?mine.map(e=>makeEntryCard(e)).join(''):'<p class="muted">Ei vielä kirjauksia.</p>';
}
function filteredLead() {
  const emp=$('filter-worker').value, status=$('filter-status').value;
  return entries.filter(e=>isWorkerEntry(e)&&(!emp||e.employee_id===emp)&&(!status||e.status===status));
}
function renderLead() {
  if(!isLead())return;
  const rows=filteredLead();drawSummary('lead-summary',rows);
  $('lead-list').innerHTML=rows.length?rows.map(e=>makeEntryCard(e,true)).join(''):'<p class="muted">Ei tällä suodatuksella kirjauksia.</p>';
}
function renderSites() {
  if (!isAdmin()) return;
  const activeSites=sites.filter(s=>s.active);
  const archivedSites=sites.filter(s=>!s.active);
  const item=s=>`<article class="entry">
    <div class="entry-top"><h3>${esc(s.name)}</h3><span class="status ${s.active?'approved':'needs_changes'}">${s.active?'Käytössä':'Arkistoitu'}</span></div>
    <p class="muted">${esc(s.code||'Ei koodia')}</p>
    <div class="actions">
      <button type="button" class="btn ghost" data-site-action="${s.active?'archive':'restore'}" data-site-id="${esc(s.id)}">
        ${s.active?'Arkistoi':'Palauta käyttöön'}
      </button>
    </div>
  </article>`;
  $('sites-list').innerHTML=
    `<h3>Aktiiviset (${activeSites.length})</h3>`+
    (activeSites.length?activeSites.map(item).join(''):'<p class="muted">Ei aktiivisia työmaita.</p>')+
    `<h3>Arkistoidut (${archivedSites.length})</h3>`+
    (archivedSites.length?archivedSites.map(item).join(''):'<p class="muted">Ei arkistoituja työmaita.</p>');
}
async function handleSiteAction(event) {
  const button=event.target.closest('button[data-site-action][data-site-id]');
  if(!button || !isAdmin())return;
  const site=sites.find(s=>s.id===button.dataset.siteId);
  if(!site)return;
  const restoring=button.dataset.siteAction==='restore';
  if(!restoring && button.dataset.siteAction!=='archive')return;
  if(site.active===restoring)return;
  if(!restoring && !window.confirm(`Arkistoidaanko työmaa "${site.name}"? Se poistuu uusista kirjauksista, mutta kaikki vanhat tunnit ja raporttihistoria säilyvät.`))return;
  await doBusy(async()=>{
    const {error}=await client.rpc('set_worksite_active',{p_worksite_id:site.id,p_active:restoring});
    if(error)throw error;
    await loadData();setView('sites');
    feedback(restoring?'Työmaa palautettu käyttöön.':'Työmaa arkistoitu. Aiemmat tuntikirjaukset säilyvät.');
  });
}
function editEntry(id) {
  const e=entries.find(x=>x.id===id);
  if(!e || e.status==='approved' || !isLead() && (e.employee_id!==session.user.id || e.status!=='needs_changes'))return;
  editId=id;
  const entrySite=sites.find(s=>s.id===e.worksite_id);
  if(entrySite && !entrySite.active) {
    // Historiallisen kirjauksen korjaaminen on sallittu alkuperäiselle arkistoidulle työmaalle.
    $('worksite').add(new Option(`${entrySite.name} (arkistoitu – vain tämän kirjauksen korjaus)`,entrySite.id));
  }
  $('worksite').value=e.worksite_id;
  $('worker').value=e.employee_id;
  const start=localDateTime(e.start_at),end=localDateTime(e.end_at);
  $('work-date').value=start.date;
  $('start').value=start.time;$('end').value=end.time;
  $('unpaid-break-enabled').checked=e.break_minutes>0;
  $('break').value=String(e.break_minutes);
  syncUnpaidBreak();
  $('travel-out-start').value=localInputDateTime(e.travel_out_start);
  $('travel-out-end').value=localInputDateTime(e.travel_out_end);
  $('travel-back-start').value=localInputDateTime(e.travel_back_start);
  $('travel-back-end').value=localInputDateTime(e.travel_back_end);
  $('travel-box').open=Boolean(e.travel_out_start||e.travel_back_start);
  $('note').value=e.note||'';
  $('entry-extras').open=Boolean(e.break_minutes||e.note);
  $('edit-tag').classList.remove('hidden');$('cancel-edit').classList.remove('hidden');
  $('reason-field').classList.remove('hidden');$('reason').required=true;$('reason').value='';
  $('submit-entry').textContent='Tallenna korjaus ja lähetä';
  calculate();setView('new');
}
async function doBusy(operation) {
  if(busy)return;
  if(!hasConnection()){feedback('Olet offline-tilassa. Tuntien tallennus vaatii verkkoyhteyden.','err');return;}
  busy=true;
  document.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=true);
  try { await operation(); }
  catch (err) { feedback(errorText(err),'err'); }
  finally {busy=false;document.querySelectorAll('button[type="submit"]').forEach(b=>b.disabled=false);}
}
async function submitEntry(event) {
  event.preventDefault();
  await doBusy(async()=>{
    if(isAdmin()&&!editId)throw Error('Pääkäyttäjä ei kirjaa omia tuntejaan tässä näkymässä');
    const basic=fromForm();
    const values={...basic,...fromTravelForm(basic.p_start,basic.p_end)};
    if(!values.p_worksite_id)throw Error('Valitse työmaa');
    const name=editId?'update_entry_with_travel':'create_entry_with_travel';
    const args=editId?{p_entry_id:editId,...values,p_reason:$('reason').value.trim()}:
      {p_employee_id:isLead()?$('worker').value:session.user.id,...values};
    if(editId && args.p_reason.length<3)throw Error('Kirjoita korjauksen perustelu');
    const {error}=await client.rpc(name,args);if(error)throw error;
    resetForm();await loadData();setView(isAdmin()?'lead':'mine');
    feedback('Kirjaus tallennettu yhteiseen tietokantaan.','ok');
  });
}
async function handleEntryButton(event) {
  const button=event.target.closest('[data-action][data-id]');if(!button)return;
  const {action,id}=button.dataset;
  if(action==='edit'){editEntry(id);return;}
  if(!isLead())return;
  let decision=null,reason='';
  if(action==='approve'){decision='approved';if(!window.confirm('Hyväksytäänkö tuntikirjaus?'))return;}
  if(action==='return'){
    decision='needs_changes';reason=(window.prompt('Miksi kirjaus palautetaan korjattavaksi?')||'').trim();
    if(reason.length<3)return;
  }
  if(!decision)return;
  await doBusy(async()=>{
    const {error}=await client.rpc('review_entry',{p_entry_id:id,p_decision:decision,p_reason:reason});
    if(error)throw error;
    await loadData();setView('lead');feedback(decision==='approved'?'Kirjaus hyväksytty.':'Kirjaus palautettu korjattavaksi.','ok');
  });
}

function helsinkiYmd(utc) {
  return new Intl.DateTimeFormat('sv-SE',{
    timeZone:'Europe/Helsinki',year:'numeric',month:'2-digit',day:'2-digit'
  }).format(new Date(utc));
}
function reportRange() {
  const start=$('report-start').value, end=$('report-end').value;
  if (!start || !end || start>end) throw Error('Valitse kelvollinen alkamis- ja päättymispäivä');
  const startUtc=Date.parse(start+'T00:00:00Z');
  const endUtc=Date.parse(end+'T00:00:00Z');
  if (endUtc-startUtc>366*86400000) throw Error('Valitse enintään 366 päivän jakso');
  return {start,end,from:new Date(startUtc-86400000).toISOString(),until:new Date(endUtc+2*86400000).toISOString()};
}
function setCurrentMonth() {
  const now=new Date(), year=now.getFullYear(), month=now.getMonth();
  $('report-start').value=localYmd(new Date(year,month,1));
  $('report-end').value=localYmd(new Date(year,month+1,0));
  reportPeriodLoaded='';
}
async function loadReport() {
  if(!isLead() || reportLoading || !client) return;
  let range;
  try {range=reportRange();}
  catch(err) {feedback(errorText(err),'err');return;}
  reportLoading=true;
  $('report-load').disabled=true;
  $('report-file').disabled=true;
  $('report-pdf').disabled=true;
  $('report-notice').textContent='Ladataan kirjauksia valitulta ajalta…';
  try {
    const all=[];
    const pageSize=500, maxPages=50;
    for(let page=0;page<maxPages;page++) {
      const {data,error}=await client.from('time_entries')
        .select('id,employee_id,worksite_id,start_at,end_at,break_minutes,status,note,'+travelColumns)
        .gte('start_at',range.from).lt('start_at',range.until)
        .order('start_at',{ascending:true}).order('id',{ascending:true})
        .range(page*pageSize,(page+1)*pageSize-1);
      if(error)throw error;
      all.push(...(data||[]));
      if((data||[]).length<pageSize)break;
      if(page===maxPages-1)throw Error('Raportissa on yli 25 000 kirjausta. Rajaa aikaväliä, jotta kaikki rivit tulevat mukaan.');
    }
    reportEntries=all.filter(e=>{
      if(!isWorkerEntry(e))return false;
      const d=helsinkiYmd(e.start_at);
      return d>=range.start && d<=range.end;
    });
    reportPeriodLoaded=range.start+' – '+range.end;
    renderReport();
  } catch(err) {
    reportPeriodLoaded='';
    $('report-notice').textContent='Raportin lataus epäonnistui.';
    $('report-groups').replaceChildren();
    $('report-detail').replaceChildren();
    $('report-cards').replaceChildren();
    feedback('Raportin haku epäonnistui: '+errorText(err),'err');
  } finally {
    reportLoading=false;
    $('report-load').disabled=false;
    $('report-file').disabled=!reportPeriodLoaded;
    $('report-pdf').disabled=!reportPeriodLoaded;
  }
}
function filteredReport() {
  if(!reportPeriodLoaded)return [];
  const employee=$('report-worker').value, worksite=$('report-site').value,
    status=$('report-status').value;
  return reportEntries.filter(e=>(!employee||e.employee_id===employee)
    && (!worksite||e.worksite_id===worksite)&&(!status||e.status===status));
}
function reportGroups(rows) {
  const map=new Map();
  for(const e of rows) {
    const key=e.employee_id+'|'+e.worksite_id;
    if(!map.has(key))map.set(key,{
      employee:e.employee_id,site:e.worksite_id,entries:0,total:0,approved:0,submitted:0,returned:0,travelOut:0,travelBack:0
    });
    const r=map.get(key),minutes=deltaMins(e.start_at,e.end_at,e.break_minutes);
    const trip=travelTotals(e);
    r.entries++;r.total+=minutes;r.travelOut+=trip.outbound;r.travelBack+=trip.inbound;
    if(e.status==='approved')r.approved+=minutes;
    if(e.status==='submitted')r.submitted+=minutes;
    if(e.status==='needs_changes')r.returned+=minutes;
  }
  return [...map.values()].sort((a,b)=>
    employeeName(a.employee).localeCompare(employeeName(b.employee),'fi')||
    siteName(a.site).localeCompare(siteName(b.site),'fi'));
}
function renderReport() {
  if(!isLead()||!reportPeriodLoaded)return;
  const rows=filteredReport(),groups=reportGroups(rows);
  const total=rows.reduce((n,e)=>n+deltaMins(e.start_at,e.end_at,e.break_minutes),0);
  const travel=rows.reduce((n,e)=>n+travelTotals(e).total,0);
  const approved=rows.filter(e=>e.status==='approved')
    .reduce((n,e)=>n+deltaMins(e.start_at,e.end_at,e.break_minutes),0);
  $('report-notice').textContent='Jakso '+reportPeriodLoaded+
    ' • '+rows.length+' kirjausta • matka-aika raportoidaan erillään työajasta.';
  $('report-summary').innerHTML=
    '<div><strong>'+rows.length+'</strong><span>Kirjauksia</span></div>'+
    '<div><strong>'+esc(formatHour(total))+'</strong><span>Kaikki tunnit</span></div>'+
    '<div><strong>'+esc(formatHour(approved))+'</strong><span>Hyväksytyt tunnit</span></div>'+
    '<div><strong>'+esc(formatHour(travel))+'</strong><span>Matka-aika erikseen</span></div>';
  $('report-cards').innerHTML=groups.length?groups.map(g=>
    `<article class="report-person"><div class="report-person-head"><div><strong>${esc(employeeName(g.employee))}</strong><span>${esc(siteName(g.site))}</span></div><span class="report-count">${g.entries} kirjausta</span></div>`+
    `<div class="report-person-metrics"><div><small>Työaika</small><strong>${esc(formatHour(g.total))}</strong></div><div><small>Matka-aika</small><strong>${esc(formatHour(g.travelOut+g.travelBack))}</strong></div></div>`+
    `<div class="report-person-foot"><span>Hyväksytty ${esc(formatHour(g.approved))}</span><span>Käsiteltävä ${esc(formatHour(g.submitted+g.returned))}</span></div></article>`
  ).join(''):'<p class="muted">Ei kirjauksia valitulla rajauksella.</p>';
  const header='<thead><tr><th>Työntekijä</th><th>Työmaa</th><th>Kirjauksia</th><th>Työaika</th><th>Hyväksytty</th><th>Käsiteltävä</th><th>Meno</th><th>Paluu</th><th>Matkat yhteensä</th></tr></thead>';
  $('report-groups').innerHTML=groups.length?header+'<tbody>'+groups.map(g=>
    '<tr><td>'+esc(employeeName(g.employee))+'</td><td>'+esc(siteName(g.site))+'</td>'+
    '<td>'+g.entries+'</td><td>'+esc(formatHour(g.total))+'</td>'+
    '<td>'+esc(formatHour(g.approved))+'</td><td>'+esc(formatHour(g.submitted+g.returned))+'</td>'+
    '<td>'+esc(formatHour(g.travelOut))+'</td><td>'+esc(formatHour(g.travelBack))+'</td>'+
    '<td>'+esc(formatHour(g.travelOut+g.travelBack))+'</td></tr>'
  ).join('')+'</tbody>':'<tbody><tr><td>Ei kirjauksia valitulla rajauksella.</td></tr></tbody>';
  $('report-detail').innerHTML=rows.length?
    '<thead><tr><th>Päivä</th><th>Työntekijä</th><th>Työmaa</th><th>Työaika</th><th>Matka-aika</th><th>Tila</th></tr></thead><tbody>'+
    rows.map(e=>'<tr><td>'+esc(helsinkiYmd(e.start_at))+'</td><td>'+
      esc(employeeName(e.employee_id))+'</td><td>'+esc(siteName(e.worksite_id))+'</td>'+
      esc(formatHour(deltaMins(e.start_at,e.end_at,e.break_minutes)))+
      '</td><td>'+esc(formatHour(travelTotals(e).total))+'</td><td>'+esc(statusText[e.status]||e.status)+'</td></tr>').join('')+'</tbody>':'';
}
function exportReportCsv() {
  if(!isLead()||!reportPeriodLoaded)return;
  const groups=reportGroups(filteredReport());
  const lines=[
    ['Tuntiseuranta – työmaayhteenveto'],
    ['Alku', $('report-start').value,'Loppu',$('report-end').value],
    ['Työntekijä','Työmaa','Kirjauksia','Työaika yhteensä','Hyväksytyt tunnit','Käsiteltävät tunnit','Menomatka (h)','Paluumatka (h)','Matka-aika yhteensä (h)'],
    ...groups.map(g=>[
      employeeName(g.employee),siteName(g.site),g.entries,
      (g.total/60).toFixed(2).replace('.',','),
      (g.approved/60).toFixed(2).replace('.',','),
      ((g.submitted+g.returned)/60).toFixed(2).replace('.',','),
      (g.travelOut/60).toFixed(2).replace('.',','),
      (g.travelBack/60).toFixed(2).replace('.',','),
      ((g.travelOut+g.travelBack)/60).toFixed(2).replace('.',',')
    ])
  ].map(columns=>columns.map(csvField).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff',lines],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a');
  link.href=url;
  link.download='tuntiseuranta-yhteenveto-'+$('report-start').value+'_'+$('report-end').value+'.csv';
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  feedback('Raportin '+groups.length+' työntekijä–työmaa-yhteenvetoriviä viety tiedostoon.');
}

function csvField(raw) {
  let text=String(raw??'');
  if(/^[\s]*[=+@-]/.test(text))text=`'${text}`; // estä Excel-kaavainjektio
  return `"${text.replace(/"/g,'""')}"`;
}
function exportCsv() {
  if(!isLead())return;
  const rows=filteredLead();
  const output=[['Työntekijä','Työmaa','Päivä','Alku (Suomen aika)','Loppu (Suomen aika)','Tauko (min)','Työaika (h)','Menomatka alku','Menomatka loppu','Paluumatka alku','Paluumatka loppu','Matka-aika yhteensä (h)','Tila','Huomautus'],
    ...rows.map(e=>[employeeName(e.employee_id),siteName(e.worksite_id),humanDate(e.start_at),
      new Date(e.start_at).toLocaleString('fi-FI',{timeZone:'Europe/Helsinki'}),
      new Date(e.end_at).toLocaleString('fi-FI',{timeZone:'Europe/Helsinki'}),
      e.break_minutes,(deltaMins(e.start_at,e.end_at,e.break_minutes)/60).toFixed(2).replace('.',','),
      e.travel_out_start?localInputDateTime(e.travel_out_start):'',e.travel_out_end?localInputDateTime(e.travel_out_end):'',
      e.travel_back_start?localInputDateTime(e.travel_back_start):'',e.travel_back_end?localInputDateTime(e.travel_back_end):'',
      (travelTotals(e).total/60).toFixed(2).replace('.',','),statusText[e.status]||e.status,e.note])]
    .map(r=>r.map(csvField).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff',output],{type:'text/csv;charset=utf-8;'}));
  const a=document.createElement('a');a.href=url;a.download=`tyomaatunnit-${localYmd(new Date())}.csv`;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  feedback(`Viety ${rows.length} näkyvää kirjausta CSV-tiedostoon. Huom: näkymässä enintään 1000 uusinta tietuetta.`);
}
function wire() {
  $('login-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!client)return;
    await doBusy(async()=>{
      const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
      if(error)throw error;
      $('password').value='';
    });
  });
  $('logout').addEventListener('click',async()=>{
    if(!client)return;
    const {error}=await client.auth.signOut();
    if(error) feedback(errorText(error),'err');
  });
  document.querySelectorAll('[data-view]').forEach(el=>el.addEventListener('click',()=>setView(el.dataset.view)));
  $('entry-form').addEventListener('submit',submitEntry);
  $('cancel-edit').addEventListener('click',()=>{resetForm();if(isAdmin())setView('lead');});
  ['work-date','start','end','break',...travelFields].forEach(id=>$(id).addEventListener('input',calculate));
  $('unpaid-break-enabled').addEventListener('change',syncUnpaidBreak);
  $('mine-list').addEventListener('click',handleEntryButton);
  $('lead-list').addEventListener('click',handleEntryButton);
  $('filter-worker').addEventListener('change',renderLead);
  $('filter-status').addEventListener('change',renderLead);
  $('csv-export').addEventListener('click',exportCsv);
  setCurrentMonth();
  $('report-load').addEventListener('click',loadReport);
  $('report-current-month').addEventListener('click',()=>{setCurrentMonth();loadReport();});
  ['report-worker','report-site','report-status'].forEach(id=>$(id).addEventListener('change',renderReport));
  ['report-start','report-end'].forEach(id=>$(id).addEventListener('change',()=>{
    reportPeriodLoaded='';
    $('report-file').disabled=true;
    $('report-pdf').disabled=true;
    $('report-notice').textContent='Aikaväli muuttui. Paina Hae raportti.';
  }));
  $('report-file').addEventListener('click',exportReportCsv);
  const reportDetails=['report-groups-toggle','report-detail-toggle'].map(id=>$(id));
  if(window.matchMedia('(min-width:700px)').matches) $('report-groups-toggle').open=true;
  window.addEventListener('beforeprint',()=>reportDetails.forEach(d=>{d.dataset.previousOpen=d.open?'true':'false';d.open=true;}));
  window.addEventListener('afterprint',()=>reportDetails.forEach(d=>{if(d.dataset.previousOpen){d.open=d.dataset.previousOpen==='true';delete d.dataset.previousOpen;}}));
  $('report-pdf').addEventListener('click',()=>{if(isLead()&&reportPeriodLoaded)window.print();});
  $('refresh-mine').addEventListener('click',loadData);
  $('refresh-lead').addEventListener('click',loadData);
  $('sites-list').addEventListener('click',handleSiteAction);
  $('site-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!isAdmin())return;
    await doBusy(async()=>{
      const {error}=await client.rpc('create_worksite',{p_name:$('site-name').value.trim(),p_code:$('site-code').value.trim()});
      if(error)throw error;
      $('site-form').reset();await loadData();setView('sites');feedback('Työmaa lisätty yhteiseen tietokantaan.');
    });
  });
  $('password-form').addEventListener('submit',async event=>{
    event.preventDefault();
    await doBusy(async()=>{
      const {error}=await client.auth.updateUser({password:$('new-password').value});
      if(error)throw error;
      $('password-form').reset();feedback('Salasana vaihdettu.');
    });
  });
  window.addEventListener('online',updateConnection);
  window.addEventListener('offline',updateConnection);
  updateConnection();resetForm();
}
function updateConnection() {
  $('connection').classList.toggle('offline',!hasConnection());
  $('connection').textContent=hasConnection()?'Verkko käytettävissä':'Ei verkkoyhteyttä';
}
async function main() {
  wire();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url||'') ||
      !config.publishableKey || /(^$|^(YOUR|PASTE|PLACEHOLDER))/.test(config.publishableKey)) {
    show('setup');return;
  }
  try {
    const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm');
    client=createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    client.auth.onAuthStateChange((_event,newSession)=>{
      const was=session?.user?.id;
      session=newSession;
      if (!newSession) {resetState();$('logout').classList.add('hidden');show('login');clearFeedback();}
      else if(!was || was!==newSession.user.id){$('logout').classList.remove('hidden');setTimeout(loadData,0);}
    });
    const {data,error}=await client.auth.getSession();if(error)throw error;
    session=data.session;
    if(session){$('logout').classList.remove('hidden');await loadData();}
    else show('login');
  } catch(err) {show('setup');feedback(`Yhteyden alustaminen epäonnistui: ${errorText(err)}`,'err');}
  if('serviceWorker' in navigator && window.location.protocol==='https:')
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
main();