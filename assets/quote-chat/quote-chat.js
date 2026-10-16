(function(){const ROOT=document.getElementById('qchat-embed');if(!ROOT)return;const PRE_TYPE=ROOT.dataset.qtype||'';
// Chandler Quote Chat (PREVIEW) — mirrors live auto-quote / home-quote fields; submits via Netlify Forms (HTTPS POST).
const chat=document.getElementById('chat'),D={};let QC_LIVE=false;const qcLive=()=>{QC_LIVE=true};chat.addEventListener('pointerdown',qcLive,{once:true});chat.addEventListener('keydown',qcLive,{once:true});let decFile=null;let currentError=null;let partialSent=false;let sentEarly=false;
const DONE_KEY='chandler-quote-complete';
const DRAFT_KEY='chandler-quote-draft';
// Block ONLY SSNs and bank/card numbers. Driver's license numbers and VINs are allowed (live forms collect them).
const BAD=/\b\d{3}-\d{2}-\d{4}\b|\b(?:\d[ -]?){13,19}\b|\b(ssn|social security|routing number|bank account|account number|card number|credit card|debit card|cvv)\b/i;
const VIN_OK=v=>/^[A-HJ-NPR-Z0-9]{5,17}$/i.test(v.replace(/\s/g,''));
const YEAR_OK=v=>{const y=parseInt(v);return /^\d{4}$/.test(v)&&y>=1800&&y<=new Date().getFullYear()+1};

const qcMobile=()=>matchMedia('(max-width:700px)').matches;
const vv=window.visualViewport;
function qcFit(){if(!document.documentElement.classList.contains('qchat-kb'))return;const h=vv?vv.height:innerHeight;const top=vv?vv.offsetTop:0;chat.style.top=top+'px';chat.style.height=h+'px';chat.style.maxHeight=h+'px';const inp=document.getElementById('in');if(inp){chat.scrollTop=chat.scrollHeight}}
function qcKbOn(){if(!qcMobile())return;document.documentElement.classList.add('qchat-kb');qcFit();setTimeout(qcFit,120);setTimeout(qcFit,400)}
function qcKbOff(){document.documentElement.classList.remove('qchat-kb');chat.style.top='';chat.style.height='';chat.style.maxHeight=''}
chat.addEventListener('focusin',e=>{if(e.target.matches('input,textarea,select'))qcKbOn()});
chat.addEventListener('focusout',()=>{setTimeout(()=>{const a=document.activeElement;if(!a||!chat.contains(a)||!a.matches('input,textarea,select'))qcKbOff()},150)});
if(vv){vv.addEventListener('resize',qcFit);vv.addEventListener('scroll',qcFit)}

async function decodeVin(vin){vin=(vin||'').replace(/\s/g,'').toUpperCase();if(!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))return null;
  const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),5000);
  try{const r=await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`,{signal:ctl.signal});const j=await r.json();const x=(j.Results||[])[0]||{};
   if(!x.ModelYear||!x.Make)return null;return {year:x.ModelYear,make:x.Make,model:x.Model||'',trim:[x.Trim,x.BodyClass].filter(Boolean).join(' / ')}}catch(e){return null}finally{clearTimeout(t)}}
async function vinStep(obj,keys,label){ // keys: {vin,year,make,model,trim}
  obj[keys.vin]=await ask.call({pv:obj[keys.vin]},`${label}: VIN? (optional — we'll look up the year/make/model)`,{valid:VIN_OK});
  let ok=false;
  if(obj[keys.vin]){const st=say('Looking up that VIN…');const d=await decodeVin(obj[keys.vin]);st.remove();
   if(d){const desc=[d.year,d.make,d.model,d.trim].filter(Boolean).join(' ');
    if((await choose(`We found: ${desc}. Correct?`,['Yes','Edit'],{opt:false}))==='Yes'){obj[keys.year]=String(d.year);obj[keys.make]=d.make;obj[keys.model]=d.model;if(d.trim)obj[keys.trim]=d.trim;ok=true}}
   else say("We couldn't decode that VIN automatically — a few quick questions instead.")}
  if(!ok){delete obj[keys.trim];
   obj[keys.year]=await ask.call({pv:obj[keys.year]},'Year?',{valid:v=>/^(19|20)\d\d$/.test(v)});
   obj[keys.make]=await ask.call({pv:obj[keys.make]},'Make?');
   obj[keys.model]=await ask.call({pv:obj[keys.model]},'Model?');}}
const CARRIERS='AAA Insurance|Acuity Insurance|Allstate|American Family Insurance|American National|Amica Mutual Insurance|Auto-Owners Insurance|Berkley Insurance|Bristol West|Chubb|Cincinnati Insurance|Citizens Insurance|Country Financial|CSAA Insurance (AAA)|Dairyland Insurance|Direct General|Erie Insurance|Esurance|Farm Bureau Insurance|Farmers Insurance|Federated Insurance|First American|GEICO|Grinnell Mutual|Hastings Mutual|Horace Mann|IMT Insurance|Infinity Insurance|Kemper Insurance|Liberty Mutual|Markel|Mercury Insurance|MetLife|National Farmers Union|National General|Nationwide|North Star Mutual|Plymouth Rock Assurance|Progressive|QBE Insurance|Safeco|Sentry Insurance|Shelter Insurance|State Auto|State Farm|Travelers|USAA|Utica National|Wawanesa Insurance|Western National|Zurich Insurance|Other'.split('|');
const STATES='MN|WI|IA|ND|SD|AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|KS|KY|LA|ME|MD|MA|MI|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|OH|OK|OR|PA|RI|SC|TN|TX|UT|VT|VA|WA|WV|WY|Other'.split('|');

const ANSWERS=new Map(); let EDIT=null; let QSEEN=null; let QCOUNT={};
function qkeyFor(q){QCOUNT[q]=(QCOUNT[q]||0)+1;return q+'#'+QCOUNT[q];}
function record(k,q,a){ANSWERS.set(k,{q,a,step:cur});if(QSEEN)QSEEN.add(k);}

function saveDraft(){try{localStorage.setItem(DRAFT_KEY,JSON.stringify({D,cur,STEPS,partialSent,sentEarly,ts:Date.now()}))}catch(e){}}
function loadDraft(){try{const s=localStorage.getItem(DRAFT_KEY);return s?JSON.parse(s):null}catch(e){return null}}
function clearDraft(){localStorage.removeItem(DRAFT_KEY);partialSent=false;sentEarly=false}
function hasMeaningfulDraft(d){if(!d||!d.D)return false;const dd=d.D;return !!(dd.full_name||dd.phone||dd.email)}
function removeError(){if(currentError){currentError.remove();currentError=null}}
function showError(msg){removeError();currentError=say(msg,'m w');}

async function sendPartial(){if(sessionStorage.getItem(DONE_KEY)||sessionStorage.getItem('chandler-quote-partial-sent')||!hasMeaningfulDraft({D}))return;
 partialSent=true;sessionStorage.setItem('chandler-quote-partial-sent','1');saveDraft();
 const fd=new FormData();fd.append('form-name','chat-quote');fd.append('request_status','PARTIAL - incomplete');
 const qtypes=(D.types||[]).join(', ')||'Unknown';
 fd.append('quote_form',qtypes);
 fd.append('subject',`Chandler Quote Request: ${qtypes} (PARTIAL) - ${D.full_name||'Unknown'}`);
 if(D.full_name)fd.append('full_name',D.full_name);
 if(D.email)fd.append('email',D.email);
 if(D.phone)fd.append('phone',D.phone);
 const summary=buildSummary('PARTIAL - incomplete');fd.append('summary',summary);
 try{await fetch('/',{method:'POST',body:fd,keepalive:true})}catch(e){}}

// ---------- progress ----------
// STEPS: [{t:type|null,s:section}] — contact once, then each selected type's sections, then Final details + Review
let STEPS=[],cur=0;
const SHORT=t=>({'Home & Cabin':'Home','Condo / Townhouse':'Condo','Landlord / Rental':'Landlord','ATV / UTV':'ATV/UTV','Boat / PWC':'Boat','RV / Travel Trailer':'RV','Home + Auto Bundle':'Bundle','Home + Auto bundle':'Bundle','Other / not sure':'Other'}[t]||t);
const LBL=x=>x.t?SHORT(x.t)+' · '+x.s:x.s;
function setSteps(s){STEPS=s;render()}
function step(){if(EDIT)return;render();say('— '+LBL(STEPS[cur])+' —','sec');saveDraft()}
function render(){const p=document.getElementById('prog');const n=STEPS.length;requestAnimationFrame(()=>document.documentElement.style.setProperty('--progh',(p.offsetHeight+16)+'px'));
 if(!D.types||!n){p.innerHTML='<div class="pt">Getting started — choose one or more quote types</div>';return}
 const nav=D.types?`<div class="qnav"><button type="button" class="alt" data-nav="back">← Back</button><span class="qt">${esc(D.types.map(SHORT).join(' + '))}</span><button type="button" class="alt" data-nav="type">Change quote type</button></div>`:'';
 p.innerHTML=nav+`<div class="pt">Step ${cur+1} of ${n}: <b>${esc(LBL(STEPS[cur]))}</b></div><div class="bar"><i style="width:${Math.round((cur+1)/n*100)}%"></i></div><div class="crumbs">${STEPS.map((x,i)=>{const s=esc(LBL(x));return i<cur?`<a href="#" class="done" data-step="${i}" title="Edit ${s}">✓ ${s}</a>`:`<span class="${i===cur?'on':''}">${s}</span>`}).join('<em>›</em>')}</div>`}
 if(!document.getElementById('editstyle')){const st=document.createElement('style');st.id='editstyle';st.textContent=`.m.u.editable{cursor:pointer}.m.u.editable:hover::after{content:" ✎ edit";font-size:0.8em;color:#666;margin-left:8px}`;document.head.appendChild(st);}

// ---------- chat primitives ----------
let lastQK=null;
const say=(t,c='b')=>{removeError();const d=document.createElement('div');d.className='m '+c;if(c==='u'&&typeof cur!=='undefined'&&lastQK){d.dataset.step=String(cur);d.dataset.qkey=lastQK;d.classList.add('editable');d.title='Tap to change this answer';d.onclick=e=>{if(e.target.tagName==='BUTTON')return;const qk=d.dataset.qkey;if(qk){startEdit(qk);return}const step=parseInt(d.dataset.step);if(!isNaN(step)&&step<STEPS.length&&document.getElementById('sum').style.display!=='block')goto(step)}};d.textContent=t;chat.append(d);if(QC_LIVE)chat.scrollTop=chat.scrollHeight;else chat.scrollTop=0;return d};
const box=()=>{document.getElementById('in')?.remove();const d=document.createElement('div');d.id='in';chat.append(d);requestAnimationFrame(()=>{if(QC_LIVE)chat.scrollTop=chat.scrollHeight;else chat.scrollTop=0});return d};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function ask(q,{type='text',opt=true,valid,multi,ph=''}={}){const pv=this&&this.pv;const k=qkeyFor(q);if(EDIT&&k!==EDIT.k&&ANSWERS.has(k)){const a=ANSWERS.get(k).a;record(k,q,a);return Promise.resolve(a);}return new Promise(res=>{say(q);const b=box();
 const i=document.createElement(multi?'textarea':'input');if(!multi)i.type=type;i.placeholder=ph;if(typeof pv==='string'&&pv)i.value=pv;b.append(i);if(QC_LIVE)i.focus({preventScroll:true});
 const ql=q.toLowerCase();if(!multi){i.setAttribute('enterkeyhint','next');
 if(ql.includes('email')){i.type='email';i.inputMode='email';i.autocomplete='email';i.autocapitalize='off';i.spellcheck=false}
 else if(ql.includes('phone')){i.type='tel';i.inputMode='tel';i.autocomplete='tel'}
 else if(ql.includes('full name'))i.autocomplete='name';
 else if(ql.includes('zip')){i.inputMode='numeric';i.autocomplete='postal-code'}
 else if((/\byear\b|miles|odometer|square foot|sq/.test(ql))&&i.type==='text'){i.inputMode='numeric'}
 else if(ql.includes('vin')){i.autocapitalize='characters';i.spellcheck=false;i.autocomplete='off'}
 else if(ql.includes('address')&&!ql.includes('email'))i.autocomplete='street-address';
 else if(ql.includes('city'))i.autocomplete='address-level2';
 }
 const go=document.createElement('button');go.textContent='Next';b.append(go);
 if(typeof pv==='string'&&pv){const kb=document.createElement('button');kb.className='go';kb.textContent='Keep: '+(pv.length>30?pv.slice(0,30)+'…':pv);kb.onclick=()=>{b.remove();lastQK=k;say(pv,'u');record(k,q,pv);res(pv);lastQK=null};b.append(kb)}
 if(opt){const s=document.createElement('button');s.className='alt';s.textContent="Don't know / Skip";s.onclick=()=>{b.remove();lastQK=k;say('(skipped)','u');record(k,q,'');res('');saveDraft();lastQK=null};b.append(s)}
 const sub=()=>{const v=i.value.trim();if(!v&&!opt)return;
  if(BAD.test(v)){showError("For your security we don't collect Social Security numbers or bank/credit card numbers here. Please re-enter without it.");i.value='';return}
  if(v&&valid&&!valid(v)){showError("That doesn't look right — please check and try again.");return}
  removeError();b.remove();lastQK=k;say(v||'(skipped)','u');record(k,q,v||'');res(v);saveDraft();lastQK=null};
 go.onclick=sub;if(!multi)i.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();sub()}};
 if(!multi&&valid)i.oninput=()=>{if(i.value.trim()&&valid(i.value.trim()))removeError()};})}
function choose(q,opts,{opt=true}={}){const pv=this&&this.pv;const k=qkeyFor(q);if(EDIT&&k!==EDIT.k&&ANSWERS.has(k)){const a=ANSWERS.get(k).a;record(k,q,a);return Promise.resolve(a);}return new Promise(res=>{say(q);const b=box();
 if(typeof pv==='string'&&pv){const kb=document.createElement('button');kb.className='go';kb.textContent='Keep: '+pv;kb.onclick=()=>{b.remove();lastQK=k;say(pv,'u');record(k,q,pv);res(pv);lastQK=null};b.append(kb)}
 [...opts,...(opt?["Don't know / Skip"]:[])].forEach(o=>{const x=document.createElement('button');if(o==="Don't know / Skip")x.className='alt';x.textContent=o;x.onclick=()=>{removeError();b.remove();const val=o==="Don't know / Skip"?'':o;lastQK=k;say(o==="Don't know / Skip"?'(skipped)':o,'u');record(k,q,val);res(val);saveDraft();lastQK=null};b.append(x)})})}
function pick(q,opts,{opt=true}={}){const pv=this&&this.pv;const k=qkeyFor(q);if(EDIT&&k!==EDIT.k&&ANSWERS.has(k)){const a=ANSWERS.get(k).a;record(k,q,a);return Promise.resolve(a);}return new Promise(res=>{say(q);const b=box();const s=document.createElement('select');
 s.innerHTML='<option value="">Select…</option>'+opts.map(o=>`<option>${esc(o)}</option>`).join('');if(pv)s.value=pv;b.append(s);if(QC_LIVE)s.focus({preventScroll:true});
 const go=document.createElement('button');go.textContent='Next';b.append(go);
 if(opt){const sk=document.createElement('button');sk.className='alt';sk.textContent="Don't know / Skip";sk.onclick=()=>{removeError();b.remove();lastQK=k;say('(skipped)','u');record(k,q,'');res('');saveDraft();lastQK=null};b.append(sk)}
 const sub=()=>{if(!s.value&&!opt)return;removeError();b.remove();lastQK=k;say(s.value||'(skipped)','u');record(k,q,s.value||'');res(s.value||'');saveDraft();lastQK=null};go.onclick=sub;
 if(typeof pv==='string'&&pv){const kb=document.createElement('button');kb.className='go';kb.textContent='Keep: '+pv;kb.onclick=()=>{b.remove();lastQK=k;say(pv,'u');record(k,q,pv);res(pv);lastQK=null};b.append(kb)}
 s.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();sub()}}})}





function checks(q,opts){const pv=(this&&this.pv)||'';const pre=pv.split(', ');const k=qkeyFor(q);if(EDIT&&k!==EDIT.k&&ANSWERS.has(k)){const a=ANSWERS.get(k).a;record(k,q,a);return Promise.resolve(a);}return new Promise(res=>{say(q);const b=box();const cs=opts.map(o=>{const l=document.createElement('label');l.className='ck';const c=document.createElement('input');c.type='checkbox';c.value=o;c.checked=pre.includes(o);l.append(c,' '+o);b.append(l);return c});
 const go=document.createElement('button');go.textContent='Next';
 const sk=document.createElement('button');sk.className='alt';sk.textContent="Don't know / Skip";sk.onclick=()=>{removeError();b.remove();lastQK=k;say('(skipped)','u');record(k,q,'');res('');saveDraft();lastQK=null};b.append(go,sk);
 go.onclick=()=>{const v=cs.filter(c=>c.checked).map(c=>c.value).join(', ');removeError();b.remove();lastQK=k;say(v||'(none)','u');record(k,q,v||'');res(v);saveDraft();lastQK=null}})}
const yes=async q=>(await choose(q,['Yes','No'],{opt:false}))==='Yes';
const dobOK=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)||/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v);
async function carrier(q){let c=await pick(q,['None / new to insurance',...CARRIERS],{opt:true});if(c==='Other')c=await ask('Which carrier?');return c}

function startEdit(k){ if(!ANSWERS.has(k))return; EDIT={k}; editContact=false; resetChat(); QCOUNT={}; QSEEN=new Set(); runFrom(0); }

// ---------- sections (light, easy) ----------
async function contact(){step();
 if(D.full_name&&D.email&&D.phone&&!editContact&&!EDIT){say(`We have your contact info:\n${D.full_name}\n${D.email}\n${D.phone}${D.address?'\n'+[D.address,D.city,D.zip].filter(Boolean).join(', '):''}`);
  if((await choose('Use this contact info?',['Looks good','Edit'],{opt:false}))==='Looks good')return false}
 editContact=false;
 D.full_name=await ask.call({pv:D.full_name},'Your full name?',{opt:false});
 D.email=await ask.call({pv:D.email},'Email address?',{type:'email',opt:false,valid:v=>/^\S+@\S+\.\S+$/.test(v)});
 D.phone=await ask.call({pv:D.phone},'Best phone number?',{type:'tel',opt:false,valid:v=>v.replace(/\D/g,'').length>=10});
 D.date_of_birth=await ask.call({pv:D.date_of_birth},'Date of birth? (optional)',{type:'date'});
 D.address=await ask.call({pv:D.address},'Street address? (optional)');D.city=await ask.call({pv:D.city},'City? (optional)');D.zip=await ask.call({pv:D.zip},'ZIP code? (optional)',{valid:v=>/^\d{5}(-\d{4})?$/.test(v)});
 D.requested_effective_date=await ask.call({pv:D.requested_effective_date},'When should coverage start? (optional)',{type:'date'});
 return false}
async function drivers(){step();
 if(D.drivers&&D.drivers.length&& !EDIT &&(await choose(`You have ${D.drivers.length} driver(s) entered. Keep them?`,['Keep as entered','Re-enter'],{opt:false}))==='Keep as entered')return;const L=[];
 L.push({name:D.full_name,dob:D.date_of_birth,relation:'Self',license:await ask("Your driver's license number? (optional)"),license_state:await pick('License state?',STATES),occupation:await ask.call({pv:D.occupation},'Occupation for driver 1? (optional)')});
 while(L.length<5&&await yes('Add another driver?')){const d={name:await ask(`Driver ${L.length+1} name?`),dob:await ask('Date of birth?',{type:'date'}),relation:await choose('Relationship to you?',['Spouse','Domestic partner','Child','Parent','Other relative','Other'])};d.license=await ask('Driver\'s license number? (optional)');d.license_state=await pick('License state? (optional)',STATES,{opt:true});d.occupation=await ask('Occupation? (optional)');L.push(d)}
 D.drivers=L; D.current_insurance_status=await choose('Current insurance status?',['No - New to Auto Insurance','Yes - With Another Carrier','Yes - Renewing with Current Carrier']); D.auto_prior_claims=await choose('Any prior claims in last 5 years?',['None','1 claim','2 or more claims']);
 if(D.auto_prior_claims && !D.auto_prior_claims.startsWith('None')){
  D.auto_prior_claims_details=await ask.call({pv:D.auto_prior_claims_details},'Claim details: date, type and amount for each (approx is fine)',{multi:true});
 } else {
  delete D.auto_prior_claims_details;
 }}
async function vehicles(){step();
 if(D.vehicles&&D.vehicles.length&& !EDIT &&(await choose(`You have ${D.vehicles.length} vehicle(s) entered. Keep them?`,['Keep as entered','Re-enter'],{opt:false}))==='Keep as entered')return;const L=[];
 do{const o={},n=L.length+1;
  await vinStep(o,{vin:'vin',year:'year',make:'make',model:'model',trim:'trim'},`Vehicle ${n}`);
  o.ownership=await choose('Ownership?',['Owned Outright','Financed (Loan)','Leased']);
  o.coverages=await checks('Coverages wanted?',['Comprehensive','Collision','Glass','Roadside','Rental','GAP']);
  o.use=await choose('Primary use?',['Personal / Pleasure','Commuting to Work','Business / Work','Farm / Ranch','Ride Share / Delivery']);
  o.parking=await choose('Where is it parked overnight?',['Garage','Carport','Driveway','Street','Apartment / Condo Lot','Work Parking Lot']);
  o.mileage=await ask('Current odometer (approx)?');
  o.annual_miles=await ask('Miles driven per year (approx)?');
  const covs=o.coverages.split(', ');
  if(covs.includes('Comprehensive'))o.comp_deductible=await choose('Comprehensive deductible?',['$100','$250','$500','$1,000','$2,500']);
  if(covs.includes('Collision'))o.coll_deductible=await choose('Collision deductible?',['$100','$250','$500','$1,000','$2,500']);
  if(covs.includes('Rental'))o.rental_limit=await choose('Rental reimbursement?',['None','Up to $20/day','Up to $30/day (most common)','Up to $50/day']);
  L.push(o)}while(L.length<5&&await yes('Add another vehicle?'));D.vehicles=L}
async function household(){step();
 if(D.household&&D.household.length&& !EDIT &&(await choose(`You have ${D.household.length} household member(s) entered. Keep them?`,['Keep as entered','Re-enter'],{opt:false}))==='Keep as entered')return;const L=[];
 while(L.length<3&&await yes(L.length?'Add another household member?':'Anyone else in the household to list?')){
  L.push({name:await ask('Name?'),dob:await ask('Date of birth?',{type:'date'}),relation:await choose('Relationship?',['Spouse','Domestic partner','Child','Parent','Other relative','Roommate / other'])})}
 D.household=L}
async function property(preset){step();
 if(!EDIT)say('Update years and property details make a big difference in your premium. A best guess is fine, or you can skip.');
 if(!preset&&!D.property_type&&D.types.includes('Condo / Townhouse')&&!D.types.some(t=>/Home/.test(t)))preset='Townhouse / Condo';
 D.property_type=preset||await choose.call({pv:D.property_type},'Property type?',['Home','Cabin / Vacation Home','Townhouse / Condo','Rental / landlord property']);
 if(preset)say('Property type: '+preset);
 D.property_address=(D.address&&await yes('Is the property at the address you gave?'))?`${D.address}, ${D.city} ${D.zip}`:await ask('Property address? (optional)');
 D.year_built=await ask.call({pv:D.year_built},'Year built? (4-digit)',{valid:YEAR_OK});
 D.square_footage=await ask.call({pv:D.square_footage},'Square footage (approx)?');
 D.num_stories=await pick('Number of stories?',['1 Story','1.5 Stories','2 Stories','3+ Stories','Split Level / Bi-Level']);
 D.foundation_type=await pick('Foundation type?',['Basement','Crawlspace','Slab','Pier & Beam']);
 if(D.foundation_type==='Basement'){
  D.basement_finished_percent=await pick('Approximate % of basement finished?',['None - Unfinished','1-25%','26-50%','51-75%','76-100% (Fully Finished)']);
  D.walkout_basement=await pick('Walkout basement?',['No','Yes - Full Walkout','Yes - Partial / Daylight']);
  D.basement_water_history=await pick('Any history of water in the basement?',['No','Yes - Minor / Occasional','Yes - Significant (required mitigation)']);
 }
 D.exterior_wall=await pick('Exterior wall type?',['Vinyl Siding','Wood Siding','Brick','Stucco','Log','Metal']);
 D.roof_type=await pick('Roof type?',['Asphalt Shingles (3-tab or Architectural)','Metal','Wood Shake / Shingle','Tile','Rubber / EPDM (Flat)','TPO (Flat)','Other']);
 D.roof_year=await ask.call({pv:D.roof_year||''},'Year roof installed/replaced? (4-digit)',{valid:YEAR_OK}) || 'Skipped';
 D.roof_condition=await pick('Roof condition?',['Excellent - New or Like New','Good','Fair - Some Wear','Poor - Needs Replacement Soon']);
 D.garage_type=await pick('Garage type?',['No Garage','Attached Garage','Detached Garage']);
 if(D.garage_type==='Detached Garage'){
  D.detached_garage_sqft=await ask('Detached garage size (sq ft)?');
  D.detached_garage_year=await ask('Detached garage year built?');
  D.detached_garage_construction=await pick('Detached garage construction?',['Wood Frame','Pole Barn','Concrete Block','Metal Building']);
  D.detached_garage_foundation=await pick('Detached garage foundation?',['Concrete Slab','Crawlspace','Full Basement','Piers / Posts']);
  D.detached_garage_heating=await pick('Detached garage heating?',['No Heat','Electric Heat','Propane','Wood Stove / Pellet']);
  D.detached_garage_electrical=await pick('Detached garage electrical?',['No Electrical Service','Yes - 100 Amp','Yes - 200 Amp']);
  D.detached_garage_use=await pick('Primary use of detached garage?',['Vehicle Storage Only','Workshop / Hobby Space','General Storage','Living Space / Apartment','Mixed Use']);
 }
 D.heat_type=await choose.call({pv:D.heat_type},'Primary heat?',['Gas Forced Air','Electric','Oil','Propane','Wood','Geothermal']);
 D.heat_update_year=await ask.call({pv:D.heat_update_year||''},'Year of last heat update? (4-digit)',{valid:YEAR_OK}) || 'Skipped';
 D.electrical_update_year=await ask.call({pv:D.electrical_update_year||''},'Electrical update year? (4-digit)',{valid:YEAR_OK}) || 'Skipped';
 D.plumbing_update_year=await ask.call({pv:D.plumbing_update_year||''},'Plumbing update year? (4-digit)',{valid:YEAR_OK}) || 'Skipped';
 D.wood_heat=await choose.call({pv:D.wood_heat},'Any wood heat (stove/insert)?',['No','Yes']);
 if(D.wood_heat && D.wood_heat.startsWith('Yes')){
  D.wood_heat_type=await pick.call({pv:D.wood_heat_type},'Type of wood/solid-fuel heat?',['Wood stove','Fireplace insert','Outdoor wood boiler','Pellet stove','Other']);
  D.wood_heat_location=await pick.call({pv:D.wood_heat_location},'Where is it located?',['In the house (main floor)','Basement','Attached garage','Detached garage / outbuilding']);
  D.wood_heat_role=await pick.call({pv:D.wood_heat_role},'Primary or supplemental heat?',['Primary','Supplemental']);
  D.wood_heat_pro_installed=await choose.call({pv:D.wood_heat_pro_installed},'Professionally installed?',['Yes','No']);
  D.wood_heat_year=await ask.call({pv:D.wood_heat_year},'Year installed (approx)?',{valid:YEAR_OK});
 } else {
  delete D.wood_heat_type; delete D.wood_heat_location; delete D.wood_heat_role; delete D.wood_heat_pro_installed; delete D.wood_heat_year;
 }
 D.smoke_detectors=await pick('Smoke detectors?',['None','Battery Operated Only','Hardwired (not interconnected)','Hardwired & Interconnected']);
 D.co_detectors=await pick('Carbon monoxide detectors?',['None','Battery Operated','Hardwired','Hardwired & Interconnected']);
 D.deadbolts=await pick('Deadbolt locks on all exterior doors?',['Yes - All Exterior Doors','Yes - Most Doors','Some or None']);
 D.fire_extinguishers=await pick('Fire extinguishers?',['None','1-2','3 or more']);
 D.other_protective_devices=await ask('Any other protective devices? (optional)',{opt:true});
 D.has_dogs=await choose.call({pv:D.has_dogs},'Any dogs or other pets?',['No','Yes']);
 if(D.has_dogs==='Yes'){
  D.pet_details=await ask.call({pv:D.pet_details},'Type/breed of each (e.g. Lab, German Shepherd mix)?');
  D.pet_count=await ask.call({pv:D.pet_count},'How many?');
  D.pet_bite_history=await choose.call({pv:D.pet_bite_history},'Any bite history?',['No','Yes']);
 } else {
  delete D.pet_details; delete D.pet_count; delete D.pet_bite_history;
 }
 D.has_pool=await choose.call({pv:D.has_pool},'Swimming pool?',['No','Yes']);
 if(D.has_pool==='Yes'){
  D.pool_type=await choose.call({pv:D.pool_type},'Pool type?',['In-ground','Above-ground']);
  D.pool_fenced=await choose.call({pv:D.pool_fenced},'Fenced with locking gate?',['Yes','No']);
  D.pool_board_slide=await choose.call({pv:D.pool_board_slide},'Diving board or slide?',['No','Diving board','Slide','Both']);
 } else {
  delete D.pool_type; delete D.pool_fenced; delete D.pool_board_slide;
 }
 D.has_trampoline=await choose.call({pv:D.has_trampoline},'Trampoline?',['No','Yes']);
 if(D.has_trampoline==='Yes'){
  D.trampoline_netting=await choose.call({pv:D.trampoline_netting},'Safety netting?',['Yes','No']);
  D.trampoline_fenced=await choose.call({pv:D.trampoline_fenced},'Yard fenced?',['Yes','No']);
 } else {
  delete D.trampoline_netting; delete D.trampoline_fenced;
 }
 D.business_on_premises=await choose.call({pv:D.business_on_premises},'Any business run from the home?',['No','Yes']);
 if(D.business_on_premises==='Yes'){
  D.home_business_type=await ask.call({pv:D.home_business_type},'What kind of business?');
  D.home_business_visitors=await choose.call({pv:D.home_business_visitors},'Do customers/clients visit?',['No','Yes']);
 } else {
  delete D.home_business_type; delete D.home_business_visitors;
 }
 D.personal_property=await pick.call({pv:D.personal_property},'Personal property limit?',['50% of Dwelling (Standard)','75% of Dwelling','100% of Dwelling','Other - Please specify in notes']);
 D.home_liability_limit=await pick.call({pv:D.home_liability_limit},'Home liability limit?',['$100,000','$300,000 (Recommended)','$500,000','$1,000,000']);
 D.add_ons=await checks.call({pv:D.add_ons||''},'Add-ons / interested in these coverages?',['Ice Dam Coverage','Equipment Breakdown (HVAC, etc.)','Identity Theft Protection']);
 D.home_claims_history=await pick.call({pv:D.home_claims_history},'Any claims or losses in the last 5 years?',['No','Yes - 1','Yes - 2 or more']);
 if(D.home_claims_history && !D.home_claims_history.startsWith('No')){
  D.home_claims_history_details=await ask.call({pv:D.home_claims_history_details},'Claim details: date, type and amount for each (approx is fine)',{multi:true});
 } else {
  delete D.home_claims_history_details;
 }
 D.security_system=await choose.call({pv:D.security_system},'Security system?',['None','Unmonitored / Local Alarm','Monitored (Professional)'])}
async function coverage(part){step();
 if(part!=='home'){D.auto_liability_limit=await choose.call({pv:D.auto_liability_limit},'Auto liability limits?',['100/300/100 (Recommended)','25,000 / 50,000','50,000 / 100,000','250,000 / 500,000','500,000 / 500,000','Not sure']);
  D.current_auto_carrier=await carrier('Current auto carrier?')}
 if(part!=='auto'){D.dwelling_value=await ask.call({pv:D.dwelling_value},'Estimated rebuild value? (optional)');
  D.deductible=await choose.call({pv:D.deductible},'Home deductible?',['$2,500 (most common)','$500','$1,000','$5,000','Not sure']);
  D.current_home_carrier=await carrier('Current home carrier?')}}
async function finalDetails(){step();await decUpload();await notes()}
async function decUpload(){say('Optional: upload your current declarations page (PDF or image).');
 await new Promise(res=>{const b=box(),f=document.createElement('input');f.type='file';f.accept='image/*,.pdf';const n=document.createElement('button');n.textContent='Continue';const sk=document.createElement('button');sk.className='alt';sk.textContent="Don't know / Skip";sk.onclick=()=>{decFile=null;b.remove();say('(skipped)','u');res()};b.append(f,n,sk);
  n.onclick=()=>{decFile=f.files[0]||null;if(decFile&&decFile.size>8e6){say('File too large (max 8 MB).','m w');return}b.remove();say(decFile?decFile.name:'(no file)','u');res()}})}
async function notes(){D.additional_info=await ask.call({pv:D.additional_info},'Anything else we should know? (optional)',{multi:true})}
async function landlord(){step();
 say('Update years and property details make a big difference in your premium. A best guess is fine, or you can skip.');
 D.property_type='Rental / landlord property';
 D.mailing_address=await ask.call({pv:D.mailing_address},'Mailing address (if different)? (optional)');
 D.county=await ask('County?');
 D.property_address=await ask.call({pv:D.property_address},'Rental property address?');
 D.property_type=await pick('Property type?',['Single-family rental','Duplex','Triplex / 4-plex','5+ unit building','Cabin / seasonal rental','Mobile / manufactured home','Other']);
 D.rental_units=await pick('Number of rental units?',['1','2','3','4','5–10','11+']);
 D.year_built=await ask.call({pv:D.year_built},'Year built? (4-digit)',{valid:YEAR_OK});
 D.square_feet=await ask('Finished square feet?');
 D.dwelling_value=await ask.call({pv:D.dwelling_value},'Estimated rebuild value?');
 D.monthly_rent=await ask.call({pv:D.monthly_rent},'Monthly rent (total, approx)?');
 D.stories=await pick('Stories?',['1','1.5','2','3+']);
 D.construction=await pick('Construction / exterior?',['Frame / vinyl','Wood siding','Brick / masonry','Log','Metal','Other / mixed']);
 D.roof=await ask('Roof type / year? (e.g. Asphalt shingle, 2018)');
 D.heat_type=await pick('Primary heat?',['Forced air / gas','Electric','Boiler / hot water','Propane','Wood / pellet (primary)','Other']);
 D.electrical_year=await ask.call({pv:D.electrical_year},'Electrical update year? (4-digit)',{valid:YEAR_OK}) || 'Skipped';
 D.plumbing_year=await ask.call({pv:D.plumbing_year},'Plumbing update year? (4-digit)',{valid:YEAR_OK}) || 'Skipped';
 D.wood_heat=await pick.call({pv:D.wood_heat},'Any wood stove, fireplace, or pellet stove?',['No','Yes — supplemental','Yes — primary heat']);
 if(D.wood_heat && D.wood_heat.startsWith('Yes')){
  D.wood_heat_type=await pick.call({pv:D.wood_heat_type},'Type of wood/solid-fuel heat?',['Wood stove','Fireplace insert','Outdoor wood boiler','Pellet stove','Other']);
  D.wood_heat_location=await pick.call({pv:D.wood_heat_location},'Where is it located?',['In the house (main floor)','Basement','Attached garage','Detached garage / outbuilding']);
  D.wood_heat_role=await pick.call({pv:D.wood_heat_role},'Primary or supplemental heat?',['Primary','Supplemental']);
  D.wood_heat_pro_installed=await choose.call({pv:D.wood_heat_pro_installed},'Professionally installed?',['Yes','No']);
  D.wood_heat_year=await ask.call({pv:D.wood_heat_year},'Year installed (approx)?',{valid:YEAR_OK});
 } else {
  delete D.wood_heat_type; delete D.wood_heat_location; delete D.wood_heat_role; delete D.wood_heat_pro_installed; delete D.wood_heat_year;
 }
 D.occupancy=await pick('Current occupancy?',['Fully rented','Partially rented','Vacant — being rented','Vacant — rehab / between tenants','Seasonal / short-term rental']);
 D.owner_occupied_unit=await pick('Do you live in one of the units?',['No — investment only','Yes — I live in one unit']);
 D.tenant_screening=await pick('Do you screen tenants?',['Yes — credit, background, and references','Some screening','No formal screening']);
 D.require_renters=await pick('Do you require renters insurance?',['Yes','No','Planning to']);
 D.coverages=await checks('Coverages to quote?',['Dwelling / building','Landlord liability','Loss of rents','Appliances / furnishings you own','Flood (separate)']);
 D.landlord_liability_limit=await pick('Landlord liability limit?',['$300,000','$500,000','$1,000,000','Not sure']);
 D.current_carrier=await carrier('Current landlord / dwelling carrier?');
 D.prior_claims=await pick.call({pv:D.prior_claims},'Claims on this property in last 5 years?',['None','1 claim','2 or more claims']);
 if(D.prior_claims && !D.prior_claims.startsWith('None')){
  D.prior_claims_details=await ask.call({pv:D.prior_claims_details},'Claim details: date, type and amount for each (approx is fine)',{multi:true});
 } else {
  delete D.prior_claims_details;
 }
 D.additional_properties=await pick('Other rentals to quote?',['Just this property','Yes — I’ll list them below']);
}
async function business(){step();
 D.business_name=await ask.call({pv:D.business_name},'Business name?');
 D.dba=await ask.call({pv:D.dba},'DBA / trade name (if different)? (optional)');
 D.ein=await ask.call({pv:D.ein},'Federal EIN / Tax ID (optional)');
 D.years_in_business=await pick.call({pv:D.years_in_business},'Years in business (under current ownership)?',['Less than 1 year','1-3 years','4-7 years','8-15 years','15+ years']);
 D.annual_revenue=await pick.call({pv:D.annual_revenue},'Annual revenue?',['Under $50,000','$50,000 - $100,000','$100,000 - $250,000','$250,000 - $500,000','$500,000 - $1,000,000','$1M - $5M','Over $5M']);
 if(!D.annual_payroll)D.annual_payroll = await pick.call({pv:D.annual_payroll},'Annual payroll (approx)?',['Under $50,000','$50,000 - $100,000','$100,000 - $250,000','$250,000 - $500,000','$500,000 - $1,000,000','Over $1,000,000']) 
 D.owner_experience=await pick.call({pv:D.owner_experience},'Years of owner experience in this industry?',['Less than 1 year','1-3 years','4-10 years','10+ years']);
 D.business_entity=await choose.call({pv:D.business_entity},'Legal entity type?',['LLC','Corporation (C-Corp)','Corporation (S-Corp)','Sole Proprietorship','Partnership','Non-Profit']);
 D.business_employees=await choose.call({pv:D.business_employees},'Number of employees?',['1-5','6-10','11-25','26-50','51-100','101+']);
 D.business_address=await ask.call({pv:D.business_address},'Business address?');
 D.business_city=await ask.call({pv:D.business_city},'Business city?');
 D.business_state=await pick.call({pv:D.business_state},'Business state?',STATES,{opt:true});
 D.business_zip=await ask.call({pv:D.business_zip},'Business ZIP code?',{valid:v=>/^\d{5}(-\d{4})?$/.test(v)});
 D.business_description=await ask.call({pv:D.business_description},'Brief description of the business (what you do)?',{multi:true});
 D.business_coverages=await checks.call({pv:D.business_coverages||''},'Coverages wanted? (select all that apply)',['General Liability','Business Owners Package (BOP)','Commercial Auto',"Workers' Compensation",'Commercial Property','Professional Liability (E&O)','Directors & Officers (D&O)','Commercial Crime']);
 const covs=(D.business_coverages||'').split(', ');
 if(covs.includes('Commercial Auto')){
  D.total_vehicles=await ask.call({pv:D.total_vehicles},'Total owned/leased vehicles?');
  D.hired_autos=await pick.call({pv:D.hired_autos},'Any hired or non-owned autos?',['No','Yes - Occasionally','Yes - Regularly']);
 }
 if(covs.some(c=>['General Liability','Business Owners Package (BOP)'].includes(c))){
  D.gl_operations=await ask.call({pv:D.gl_operations},'Detailed description of operations (what you do, how, where)?',{multi:true});
  D.gl_per_occurrence=await pick.call({pv:D.gl_per_occurrence},'GL per occurrence limit?',['$500,000','$1,000,000 (Standard)','$2,000,000','$5,000,000','$10,000,000+']);
  D.gl_aggregate=await pick.call({pv:D.gl_aggregate},'GL aggregate limit?',['$1,000,000','$2,000,000 (Standard)','$4,000,000','$10,000,000']);
  D.subcontractors_used=await pick.call({pv:D.subcontractors_used},'Subcontractors used?',['No','Yes - Occasionally','Yes - Frequently']);
 }
 if(covs.includes('Commercial Property')||covs.includes('Business Owners Package (BOP)')){
  D.no_building_coverage=await choose.call({pv:D.no_building_coverage},'No building coverage requested (liability + contents only)?',['No','Yes']);
 }
 if(covs.includes('Professional Liability (E&O)')){
  D.eo_services=await ask.call({pv:D.eo_services},'Description of professional services?',{multi:true});
  D.eo_revenue=await ask.call({pv:D.eo_revenue},'Annual revenue from these services?');
  D.eo_per_claim=await pick.call({pv:D.eo_per_claim},'Per claim limit?',['$500,000','$1,000,000 (Most Common)','$2,000,000','$5,000,000+']);
  D.eo_claims=await pick.call({pv:D.eo_claims},'Any claims or suits in last 5 years?',['No','Yes - 1','Yes - 2 or more']);
 }
 if(covs.includes('Directors & Officers (D&O)')){
  D.do_org_type=await pick.call({pv:D.do_org_type},'Type of organization?',['For-Profit Corporation','Non-Profit / 501(c)','LLC / Partnership','Other']);
  D.do_directors=await ask.call({pv:D.do_directors},'Number of directors/officers?');
  D.do_assets=await ask.call({pv:D.do_assets},'Total assets (approx)?');
  D.do_limit=await pick.call({pv:D.do_limit},'Requested limit?',['$1,000,000','$2,000,000 (Common)','$5,000,000','$10,000,000+']);
  D.do_claims=await pick.call({pv:D.do_claims},'Any claims/investigations in last 5 years?',['No','Yes']);
 }
 if(covs.includes('Commercial Crime')){
  D.crime_employees=await ask.call({pv:D.crime_employees},'Total number of employees?');
  D.crime_handlers=await ask.call({pv:D.crime_handlers},'Employees handling money/securities/inventory?');
  D.crime_limit=await pick.call({pv:D.crime_limit},'Employee dishonesty limit?',['$25,000','$50,000','$100,000','$250,000+']);
  D.crime_claims=await pick.call({pv:D.crime_claims},'Any crime/fidelity losses in last 5 years?',['No','Yes']);
  D.crime_dual_control=await pick.call({pv:D.crime_dual_control},'Dual control / segregation of duties for funds?',['Yes (recommended)','Partial','No']);
 }
 D.prior_line=await ask.call({pv:D.prior_line},'Prior insurance line (last 3 years)? (optional)');
 D.prior_carrier=await carrier('Prior / current carrier?');
 D.prior_expiration=await ask.call({pv:D.prior_expiration},'Prior policy expiration date? (optional)',{type:'date'});
 D.current_business_carrier=await carrier('Current primary business insurance carrier?');
 D.loss_history=await ask.call({pv:D.loss_history},'Any claims or losses in the last 5 years? Describe (optional)',{multi:true});
}
async function life(){step();
 D.sex=await pick('Sex (for quoting)?',['Female','Male']);
 D.height=await ask('Height? (e.g. 5\'10")');
 D.weight=await ask('Weight? (e.g. 180 lbs)');
 D.occupation=await ask('Occupation?');
 D.life_purpose=await pick('What is this coverage for?',['Income replacement','Mortgage / debt payoff','Final expenses','Family protection','Not sure — help me choose']);
 D.life_policy_type=await pick('Coverage type?',['Term life','Whole life','Final expense','Not sure — help me choose']);
 if(!D.life_policy_type.includes('Whole')&&!D.life_policy_type.includes('Final'))D.life_term_years=await pick('If term, how many years?',['10','15','20','30','Not sure']);
 D.life_coverage_amount=await pick('Coverage amount?',['$50,000','$100,000','$250,000','$500,000','$1,000,000+','Not sure']);
 D.tobacco_use=await pick('Tobacco / nicotine in last 12 months?',['No','Yes']);
 D.beneficiary_name=await ask('Primary beneficiary name? (optional)',{opt:true});
 D.current_coverage=await ask('Current life coverage? (optional)',{opt:true});
}
async function rec(kind){step();const U=(D.units=D.units||{})[kind]=(D.units||{})[kind]||{};
 if(kind.includes('Motorcycle')||kind.includes('RV')||kind.includes('Travel Trailer')||kind.includes('Snowmobile')){
  await vinStep(U,{vin:'unit_vin',year:'unit_year',make:'unit_make',model:'unit_model',trim:'unit_trim'},kind);
 }else{
  U.unit_year=await ask.call({pv:U.unit_year},`${kind} year?`,{valid:v=>/^(19|20)\d\d$/.test(v)});
  U.unit_make=await ask.call({pv:U.unit_make},'Make?');
  U.unit_model=await ask.call({pv:U.unit_model},'Model?');
 }
 if(kind.includes('ATV')||kind.includes('UTV')){
  U.unit_engine_cc=await ask.call({pv:U.unit_engine_cc},'Engine size (cc)?');
  U.unit_drive_type=await pick.call({pv:U.unit_drive_type},'Drive type?',['2WD','4WD','6WD / 6x6','Side-by-Side (SxS)']);
  U.unit_seats=await pick.call({pv:U.unit_seats},'Passenger capacity?',['1 (Solo)','2','3-4','5+']);
  U.unit_use=await pick.call({pv:U.unit_use},'Primary use?',['Recreational / Trail Riding','Hunting / Fishing','Work / Utility / Farm','Racing / Competitive','Ice Fishing / Grooming']);
  U.unit_terrain=await pick.call({pv:U.unit_terrain},'Where primarily ridden?',['Public Trails (MN DNR)','Private Land / Own Property','Mix of Trails + Private','Road / Street Legal Use']);
  U.unit_annual_hours=await ask.call({pv:U.unit_annual_hours},'Est. annual hours/miles?');
  U.unit_mods=await checks.call({pv:U.unit_mods||''},'Aftermarket modifications? (select all)',['Lift Kit / Suspension','Winch','Tracks','Plow / Blade','Light Bar / LEDs','Street Legal Kit','Cab / Enclosure']);
 }
 if(kind.includes('Snowmobile')){
  U.unit_engine=await ask.call({pv:U.unit_engine},'Engine (cc & type)?');
  U.unit_track=await pick.call({pv:U.unit_track},'Track length/type?',['Short Track (Trail)','Long Track (Mountain)','Hybrid / Crossover','Touring']);
  U.unit_use=await pick.call({pv:U.unit_use},'Primary use?',['Trail Riding / Recreation','Mountain / Off-Trail','Ice Fishing / Grooming','Racing / Snocross','Work / Trapping']);
  U.unit_club=await pick.call({pv:U.unit_club},'Snowmobile club member?',['No','Yes - Local MN Club','Yes - Multiple Clubs']);
  U.unit_annual_miles=await ask.call({pv:U.unit_annual_miles},'Est. annual miles?');
  U.unit_mods=await checks.call({pv:U.unit_mods||''},'Major modifications? (select all)',['Turbo','Long Track Conversion','Suspension Upgrade','Studded Track']);
 }
 if(kind.includes('Boat')||kind.includes('PWC')){
  U.unit_length=await ask.call({pv:U.unit_length},'Length (ft)?');
  U.unit_type=await pick.call({pv:U.unit_type},'Boat type?',['PWC / Jet Ski','Runabout / Bowrider','Pontoon','Fishing Boat','Bass Boat','Sailboat','Cuddy / Cruiser','Houseboat','Other']);
  U.unit_motor=await ask.call({pv:U.unit_motor},'Engine HP & type?');
  U.unit_hull=await pick.call({pv:U.unit_hull},'Hull material?',['Fiberglass','Aluminum','Wood','Inflatable / RIB']);
  U.unit_hin=await ask.call({pv:U.unit_hin},'Hull ID / MN registration #?');
  U.unit_waters=await ask.call({pv:U.unit_waters},'Primary waters used?');
  U.unit_mooring=await pick.call({pv:U.unit_mooring},'Mooring/storage location?',['Marina Slip (wet)','Private Dock / Lift','Trailer - Home','Dry Stack / Indoor Storage','Mooring Buoy','Winter Storage Only (seasonal)']);
  U.unit_sports=await pick.call({pv:U.unit_sports},'Water sports/towing?',['None','Tubing / Water Skiing','Wakeboarding / Wake Surfing','Fishing Only','Cruising / Overnight']);
  U.unit_months=await ask.call({pv:U.unit_months},'Months used per year?');
 }
 if(kind.includes('Motorcycle')){
  U.unit_engine_cc=await ask.call({pv:U.unit_engine_cc},'Engine size (cc) or class?');
  U.unit_type=await pick.call({pv:U.unit_type},'Motorcycle type?',['Cruiser / Chopper','Sportbike / Supersport','Touring / Bagger','Adventure / Dual-Sport','Standard / Naked','Dirt Bike / Enduro','Trike','Scooter']);
  U.unit_abs=await pick.call({pv:U.unit_abs},'ABS equipped?',['Yes','No']);
  U.unit_accessory_value=await ask.call({pv:U.unit_accessory_value},'Aftermarket accessories value?');
  U.unit_use=await pick.call({pv:U.unit_use},'Primary use?',['Pleasure / Weekend','Commuting','Long-Distance Touring','Track / Club Racing','Off-Road / Dual-Sport']);
  U.unit_safety_course=await pick.call({pv:U.unit_safety_course},'MSF / safety course completed?',['No','Yes - Basic MSF','Yes - Advanced']);
  U.unit_annual_miles=await ask.call({pv:U.unit_annual_miles},'Est. annual miles?');
 }
 if(kind.includes('RV')||kind.includes('Trailer')){
  U.unit_length=await ask.call({pv:U.unit_length},'Length (ft) + GVWR?');
  U.unit_type=await pick.call({pv:U.unit_type},'RV/trailer type?',['Travel Trailer','5th Wheel','Class A Motorhome','Class B Campervan','Class C Motorhome','Truck Camper','Pop-Up / Folding','Toy Hauler']);
  U.unit_slides=await pick.call({pv:U.unit_slides},'Slide-outs?',['0','1','2','3+']);
  U.unit_features=await checks.call({pv:U.unit_features||''},'Special features? (select all)',['Onboard Generator','Solar Panels','Leveling Jacks','Full Body Paint']);
  U.unit_usage=await pick.call({pv:U.unit_usage},'Usage pattern?',['Seasonal / Weekend Only','Extended Summer Travel','Full-Time Living (Full-Timer)','Winter Getaways / Snowbird','Primarily Stored (rare use)']);
  U.unit_storage=await pick.call({pv:U.unit_storage},'Storage when not traveling?',['At Home (driveway)','RV Storage Facility','Seasonal RV Park','Indoor Heated Storage']);
  U.unit_tow_vehicle=await ask.call({pv:U.unit_tow_vehicle},'Tow vehicle (if trailer)?');
 }
 if(! (kind.includes('Motorcycle')||kind.includes('RV')||kind.includes('Travel Trailer')||kind.includes('Snowmobile')) ){
  U.unit_vin=await ask.call({pv:U.unit_vin},'VIN / HIN / serial? (optional)');
 }
 U.unit_value=await ask.call({pv:U.unit_value},'Approximate insured value?');
 U.unit_storage=await choose.call({pv:U.unit_storage},'Primary storage?',['Garage','Shed / storage building','Outdoors','Storage facility','Marina / dock','Other']);

 // Per-unit coverages and security from live form (stored on unit as unit_*)
 U.unit_security=await choose.call({pv:U.unit_security||D.security_system},'Security system / anti-theft for this unit?',['None','Alarm / GPS','Wheel Lock / Chain','Garage / Locked Storage','Multiple Features']);

 if(kind.includes('ATV') || kind.includes('UTV') || kind.includes('Snowmobile') || kind.includes('Motorcycle') || kind.includes('Boat') || kind.includes('RV') || kind.includes('Trailer')){
  U.unit_liability = await choose.call({pv:U.unit_liability},'Liability coverage?',['None','Standard','Higher Limits (recommended)']);
  if(await yes('Add physical damage / comprehensive + collision?')){
   U.unit_comp_collision = 'Yes';
   U.unit_insured_value = await ask.call({pv:U.unit_insured_value},'Insured value?');
   U.unit_deductible = await choose.call({pv:U.unit_deductible},'Deductible?',['$100','$250','$500','$1,000','$2,500']);
  }
  U.unit_roadside = await choose.call({pv:U.unit_roadside},'Roadside / towing assistance?',['No','Yes']);
  if(kind.includes('Boat') || kind.includes('PWC')){
   U.unit_medical = await choose.call({pv:U.unit_medical},'Guest medical payments?',['No','Yes']);
   U.unit_uninsured = await choose.call({pv:U.unit_uninsured},'Uninsured / underinsured boater?',['No','Yes']);
   U.unit_towing = await choose.call({pv:U.unit_towing},'On-water towing?',['No','Yes']);
   U.unit_trailer = await choose.call({pv:U.unit_trailer},'Trailer coverage?',['No','Yes']);
   U.unit_effects = await choose.call({pv:U.unit_effects},'Personal effects / gear?',['No','Yes']);
  }
  if(kind.includes('Motorcycle')){
   U.unit_uninsured = await choose.call({pv:U.unit_uninsured},'Uninsured motorist?',['No','Yes']);
   U.unit_passenger = await choose.call({pv:U.unit_passenger},'Passenger liability?',['No','Yes']);
   U.unit_gear = await choose.call({pv:U.unit_gear},'Riding gear / helmet coverage?',['No','Yes']);
  }
  if(kind.includes('RV') || kind.includes('Trailer')){
   U.unit_physical = await choose.call({pv:U.unit_physical},'Physical damage coverage?',['No','Yes']);
   U.unit_contents = await choose.call({pv:U.unit_contents},'Personal contents coverage?',['No','Yes']);
   U.unit_rental = await choose.call({pv:U.unit_rental},'Rental reimbursement?',['No','Yes']);
   U.unit_awning = await choose.call({pv:U.unit_awning},'Awning / slide coverage?',['No','Yes']);
   U.unit_fulltimer = await choose.call({pv:U.unit_fulltimer},'Full-timer endorsement?',['No','Yes']);
   U.unit_value_type = await pick.call({pv:U.unit_value_type},'Value type?',['Agreed Value','Actual Cash Value']);
  }
  if(kind.includes('Snowmobile')){
   U.unit_club_discount = await choose.call({pv:U.unit_club_discount},'Snow club discount?',['No','Yes']);
  }
  if(kind.includes('ATV') || kind.includes('UTV')){
   U.unit_trail = await choose.call({pv:U.unit_trail},'Trail / club permit discount?',['No','Yes']);
   U.unit_accessory = await choose.call({pv:U.unit_accessory},'Accessory coverage?',['No','Yes']);
  }
 }

 if(!D.rec_shared_asked){
  D.drivers_license=await ask.call({pv:D.drivers_license},'Driver\'s license #? (optional)');
  D.anti_theft=await pick.call({pv:D.anti_theft},'Anti-theft devices?',['None','Alarm System','GPS Tracker','Wheel Lock / Chain','Multiple Security Features']);
  D.safety_course=await pick.call({pv:D.safety_course},'Safety course completed?',['No','Yes - ATV/Snowmobile Safety Course','Yes - Boating Safety Course','Yes - Motorcycle Safety Course']);
  D.current_rec_insurance=await choose.call({pv:D.current_rec_insurance},'Current recreational insurance?',['No - new to recreational insurance','Yes - with another carrier','Yes - renewing with current carrier']);
  D.current_rec_carrier=await carrier('Current recreational insurance carrier?');
  D.rec_prior_claims=await pick.call({pv:D.rec_prior_claims},'Claims or accidents in last 5 years?',['None','1 claim','2 or more claims']);
 if(D.rec_prior_claims && !D.rec_prior_claims.startsWith('None')){
  D.rec_prior_claims_details=await ask.call({pv:D.rec_prior_claims_details},'Claim details: date, type and amount for each (approx is fine)',{multi:true});
 } else {
  delete D.rec_prior_claims_details;
 }

  // Additional riders/operators (matches live recreational form)
  if(await yes('Any additional riders/operators?')){
   D.rec_operators = [];
   let opNum = 1;
   do {
    const op = {};
    op.name = await ask(`Operator ${opNum} name?`);
    op.dob = await ask('Date of birth?',{type:'date'});
    op.license = await ask("Driver's license # (optional)");
    op.relationship = await pick('Relationship to you?',['Spouse','Domestic Partner','Child (18+)','Parent','Other Family Member','Friend / Roommate','Employee','Other']);
    op.experience = await pick('Riding/operating experience or safety course?',['Less than 1 year','1-3 years','4-10 years','10+ years','Completed safety course','Not sure']);
    D.rec_operators.push(op);
    opNum++;
   } while(opNum <= 5 && await yes('Add another rider/operator?'));
  } else {
   D.rec_operators = [];
  }
  D.rec_shared_asked=true;
 }
}
async function recSafety(kind){step();const U=(D.units=D.units||{})[kind]=D.units[kind]||{};
 // Shared safety/insurance fields already asked in rec(); per-unit security/coverages now handled in rec() (bugfix)
}
async function other(){step();
 D.need_description=await ask.call({pv:D.need_description},'Tell us what you need covered — in your own words.',{multi:true})}

// ---------- flatten / submit ----------
const fmtD=d=>d.map((x,i)=>`${i+1}. ${x.name||'-'} | DOB ${x.dob||'-'} | ${x.relation||'-'} | DL ${x.license||'-'} ${x.license_state||''} | ${x.occupation||''}`).join('\n');
const fmtV=v=>v.map((x,i)=>`${i+1}. ${[x.year,x.make,x.model].filter(Boolean).join(' ')||'(details skipped)'} | VIN ${x.vin||'-'} | ${x.ownership||'-'} | ${x.use||'-'} | parked ${x.parking||'-'} | odo ${x.mileage||'-'} | ${x.annual_miles||'-'} mi/yr | cov: ${x.coverages||'liability only'}${x.comp_deductible?' | comp '+x.comp_deductible:''}${x.coll_deductible?' | coll '+x.coll_deductible:''}${x.rental_limit?' | rental '+x.rental_limit:''}`).join('\n');
function flat(){const f={};for(const[k,v]of Object.entries(D))if(typeof v==='string')f[k]=v;
 const types=D.types||[];f.quote_types=[...new Set(types)].join(', ');f.quote_type=f.quote_types;
 const rt=D.types.filter(t=>REC.includes(t));if(rt.length){f.rec_type=rt.join(', ');const U=D.units||{};
  f.units=rt.map(t=>{const u=U[t]||{};return `${t}: ${[u.unit_year,u.unit_make,u.unit_model].filter(Boolean).join(' ')||'(details skipped)'} | len ${u.unit_length||'-'} | motor ${u.unit_motor||'-'} | VIN/HIN ${u.unit_vin||'-'} | value ${u.unit_value||'-'} | stored ${u.unit_storage||'-'} | ${u.unit_security||'-'}`}).join('\n');
  Object.assign(f,U[rt[0]]||{})}
 if(D.drivers){f.drivers=fmtD(D.drivers);D.drivers.forEach((x,i)=>{const n=i+1;f[`driver${n}_name`]=x.name;f[`driver${n}_dob`]=x.dob;f[`driver${n}_relation`]=x.relation;f[`driver${n}_license`]=x.license;f[`driver${n}_license_state`]=x.license_state;f[`driver${n}_occupation`]=x.occupation})}
 if(D.vehicles){f.vehicles=fmtV(D.vehicles);D.vehicles.forEach((x,i)=>{for(const k of ['vin','year','make','model','ownership','mileage','annual_miles','use','parking','coverages','comp_deductible','coll_deductible','rental_limit'])if(i<6)f[`vehicle_${i+1}_${k}`]=x[k]||''})}
 if(D.household)f.household=D.household.map(x=>`${x.name} | ${x.dob||'-'} | ${x.relation}`).join('\n');
 return f}
const LABEL=k=>k.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
function buildSummary(status){const types=D.types||[];const qtypes=[...new Set(types)].join(', ');let lines=[`Status: ${status}`];if(qtypes)lines.push(`Quote type: ${qtypes}`);lines.push('');
 const printed=new Set(['types','drivers','vehicles','household','units','rec_shared_asked','rec_operators',...CONTACT_KEYS,...PROPERTY_KEYS]);
 const addSection=(title,keys)=>{const sec=[];for(const k of keys||[]){const v=D[k];if(v&&typeof v==='string')sec.push(`${LABEL(k)}: ${v}`);printed.add(k)}if(sec.length){lines.push(`== ${title} ==`);lines.push(...sec);lines.push('')}};
 addSection('Contact',CONTACT_KEYS);
 addSection('Property',PROPERTY_KEYS);
 const hh=D.household||[];if(hh.length){lines.push('== Household ==');hh.forEach(h=>{const parts=[h.name,h.dob,h.relation].filter(Boolean);if(parts.length)lines.push(parts.join(' — '))});lines.push(''); printed.add('household');}
 if((D.types||[]).some(t=>['Home & Cabin','Condo / Townhouse','Home + Auto Bundle'].includes(t))) addSection('Home Coverage',['dwelling_value','deductible','current_home_carrier','home_liability_limit','personal_property','add_ons','home_claims_history','home_claims_history_details']);
 if(D.drivers&&D.drivers.length){lines.push('== Drivers ==');D.drivers.forEach((dr,i)=>{const parts=[];if(dr.name)parts.push(`Name: ${dr.name}`);if(dr.dob)parts.push(`DOB: ${dr.dob}`);if(dr.relation)parts.push(`Relation: ${dr.relation}`);if(dr.license)parts.push(`License #: ${dr.license}`);if(dr.license_state)parts.push(`License state: ${dr.license_state}`);if(dr.occupation!==undefined)parts.push(`Occupation: ${dr.occupation||''}`);lines.push(`Driver ${i+1}: ` + parts.join('; '))});lines.push(''); printed.add('drivers');}
 if(D.vehicles&&D.vehicles.length){lines.push('== Vehicles ==');D.vehicles.forEach((v,i)=>{lines.push('Vehicle '+(i+1)+':');const add=(l,val)=>{if(val)lines.push('  '+l+': '+val)};add('Year/Make/Model',[v.year,v.make,v.model].filter(Boolean).join(' '));if(v.vin)add('VIN',v.vin);if(v.trim)add('  Trim/Body',v.trim);add('Ownership',v.ownership);add('Use',v.use);add('Parking',v.parking);add('Odometer',v.mileage);add('Annual miles',v.annual_miles);add('Coverages',v.coverages);add('Comprehensive deductible',v.comp_deductible);add('Collision deductible',v.coll_deductible);add('Rental reimbursement',v.rental_limit);lines.push('')});lines.push(''); printed.add('vehicles');}
 addSection('Auto Coverage',['auto_liability_limit','current_auto_carrier','current_insurance_status','auto_prior_claims','auto_prior_claims_details']);
 if((D.types||[]).includes('Landlord / Rental')) addSection('Rental Property',['mailing_address','county','rental_units','square_feet','dwelling_value','monthly_rent','stories','construction','roof','electrical_year','plumbing_year','wood_heat','wood_heat_type','wood_heat_location','wood_heat_role','wood_heat_pro_installed','wood_heat_year','occupancy','owner_occupied_unit','tenant_screening','require_renters','coverages','landlord_liability_limit','current_carrier','prior_claims','prior_claims_details','additional_properties']);
 addSection('Business',['business_name','dba','ein','years_in_business','annual_revenue','annual_payroll','owner_experience','business_entity','business_employees','business_address','business_city','business_state','business_zip','business_description','business_coverages','total_vehicles','hired_autos','gl_operations','gl_per_occurrence','gl_aggregate','subcontractors_used','no_building_coverage','eo_services','eo_revenue','eo_per_claim','eo_claims','do_org_type','do_directors','do_assets','do_limit','do_claims','crime_employees','crime_handlers','crime_limit','crime_claims','crime_dual_control','prior_line','prior_carrier','prior_expiration','current_business_carrier','loss_history']);
 addSection('Life',['sex','height','weight','occupation','life_purpose','life_policy_type','life_term_years','life_coverage_amount','tobacco_use','beneficiary_name','current_coverage']);
 if(D.drivers_license||D.anti_theft||D.safety_course||D.current_rec_insurance||D.current_rec_carrier||D.rec_prior_claims|| (D.rec_operators && D.rec_operators.length)){
  lines.push('== Recreational ==');
  if(D.drivers_license)lines.push(`Driver's License: ${D.drivers_license}`);
  if(D.anti_theft)lines.push(`Anti-theft: ${D.anti_theft}`);
  if(D.safety_course)lines.push(`Safety Course: ${D.safety_course}`);
  if(D.current_rec_insurance)lines.push(`Current Rec Insurance: ${D.current_rec_insurance}`);
  if(D.current_rec_carrier)lines.push(`Current Rec Carrier: ${D.current_rec_carrier}`);
  if(D.rec_prior_claims)lines.push(`Rec Prior Claims: ${D.rec_prior_claims}`);
  if(D.rec_prior_claims_details)lines.push(`Rec Prior Claims Details: ${D.rec_prior_claims_details}`);
  if(D.rec_operators && D.rec_operators.length){
   lines.push('== Additional Riders / Operators ==');
   D.rec_operators.forEach((op,i)=>{
    const parts=[];
    if(op.name)parts.push(`Name: ${op.name}`);
    if(op.dob)parts.push(`DOB: ${op.dob}`);
    if(op.license)parts.push(`License #: ${op.license}`);
    if(op.relationship)parts.push(`Relationship: ${op.relationship}`);
    if(op.experience)parts.push(`Experience: ${op.experience}`);
    lines.push(`Operator ${i+1}: ` + parts.join('; '));
   });
  }
  lines.push('');
  printed.add('drivers_license');printed.add('anti_theft');printed.add('safety_course');printed.add('current_rec_insurance');printed.add('current_rec_carrier');printed.add('rec_prior_claims');printed.add('rec_operators');
 }
 const U=D.units||{};for(const kind in U){const u=U[kind];if(!u)continue;lines.push(`== ${kind} ==`);
  const orderedKeys=['year','make','model','engine_cc','engine','length','type','hull','hin','motor','drive_type','seats','track','club','abs','accessory_value','slides','features','usage','tow_vehicle','vin','value','storage','use','terrain','waters','mooring','sports','months','annual_hours','annual_miles','safety_course','mods','security','liability','comp_collision','deductible','roadside','insured_value','accessory','medical','uninsured','towing','trailer','effects','passenger','gear','physical','contents','rental','awning','fulltimer','value_type','club_discount','trail','trim'];
  for(const k of orderedKeys){const v=u[`unit_${k}`]||u[k]||u[`unit_${k}`];if(v&&typeof v==='string'&&v!=='Skipped')lines.push(LABEL(k)+': '+v)}
  // Print any other non-empty string keys on the unit (after ordered pass) so nothing is dropped
  for(const k in u){
   if(typeof u[k]==='string' && u[k] && u[k]!=='-' && u[k]!=='Skipped' && !orderedKeys.includes(k) && !orderedKeys.includes(k.replace('unit_','')) && !k.startsWith('unit_')){
    const clean = k.replace(/^unit_/,'');
    lines.push(LABEL(clean)+': '+u[k]);
   }
  }
  lines.push(''); printed.add('units');}
 const nd=D.need_description;if(nd)lines.push('== What you need ==',nd,''); printed.add('need_description');
 const ai=D.additional_info;if(ai)lines.push('== Notes ==',ai,''); printed.add('additional_info');
 const leftovers=[];for(const[k,v]of Object.entries(D)){if(!printed.has(k)&&v&&typeof v==='string'&&v!=='-'&&k!=='types'&&k!=='rec_shared_asked'){leftovers.push(`${LABEL(k)}: ${v}`);printed.add(k)}}
 if(leftovers.length){lines.push('== Other ==');lines.push(...leftovers);lines.push('')}
 if(sentEarly)lines.push('Note: customer chose "Send what I have" after the key rating questions.');
 const decl = decFile ? `${decFile.name} (attached)` : 'none uploaded';
 lines.push(`Declarations page: ${decl}`);
 return lines.filter(l=>l!==undefined).join('\n').trim()}
function review(){step();const s=document.getElementById('sum');s.style.display='block';
 const summaryText=buildSummary('COMPLETE');
 const blocks=summaryText.split(/==\s*(.+?)\s*==/g);
 let html=`<h2>Review Your Quote Request</h2>`;
 let i=1;while(i<blocks.length){const title=blocks[i].trim();const content=blocks[i+1]||'';const secTitle=title.replace(/==/g,'').trim();
  let stepName=secTitle==='Contact'?'Contact':secTitle==='Property'?'Property':secTitle==='Home Coverage'?'Home Coverage':secTitle==='Household'?'Household':secTitle==='Drivers'?'Drivers':secTitle==='Vehicles'?'Vehicles':secTitle==='Auto Coverage'?'Auto Coverage':secTitle==='Rental Property'?'Rental Property':secTitle==='Business'?'Business':secTitle==='Life'?'Life':secTitle==='What you need'?'What you need':secTitle==='Notes'?'Final details':secTitle.includes('Recreational')||secTitle.includes('Riders')||secTitle.includes('Unit Details')?'Unit Details':'Final details';
  const stepIdx=STEPS.findIndex(st=>st.s===stepName);
  html+=`<div class="sumblock"><h3>${esc(secTitle)}</h3><div style="white-space:pre-wrap;background:#f8fafd;padding:16px;border-radius:8px;margin-bottom:8px">${esc(content.trim())}</div>`;
  if(stepIdx!==-1){
   html+=`<details><summary>Edit answers in this section</summary>`;
   const secAnswers = Array.from(ANSWERS.entries()).filter(([kk,v]) => v.step === stepIdx && !['What would you like to do?','Add another…','Keep them?','Is the property at the address you gave?'].some(nav => v.q.includes(nav)));
   secAnswers.forEach(([kk,v]) => {
    html += `<div style="margin:4px 0;padding-left:20px">• ${esc(v.q)} → ${esc(v.a||'(skipped)')} <a href="#" class="editq" data-qkey="${kk}" style="color:#0066cc;text-decoration:underline">Edit</a></div>`;
   });
   html += `</details>`;
  }
  html+='</div>';i+=2;}
 html+=`<p class="np"><button class="go" id="send">Submit securely</button> <button class="alt" id="editbtn">← Back / edit</button> <button class="alt" id="restart">Start over</button> <button class="alt" onclick="print()">Print</button></p><div id="st"></div>
 <p><small>Submitted over HTTPS and stored securely with Chandler Insurance (Netlify Forms). Not sent by email.</small></p>`;
 s.innerHTML=html;
 document.getElementById('restart').onclick=()=>location.reload();
 document.getElementById('editbtn').onclick=()=>goto(Math.max(0,cur-1));
 s.querySelectorAll('.editq').forEach(a=>a.onclick=e=>{e.preventDefault();startEdit(a.dataset.qkey)});
 document.getElementById('send').onclick=async e=>{const btn=e.target;if(btn.dataset.done)return;btn.disabled=true;const st=document.getElementById('st');st.textContent='Submitting…';
  const fd=new FormData();fd.append('form-name','chat-quote');fd.append('request_status','COMPLETE');
  const types=D.types||[];const qtypes=[...new Set(types)].join(', ')||'Unknown';
  fd.append('quote_form',qtypes);
  fd.append('subject',`Chandler Quote Request: ${qtypes} (COMPLETE) - ${D.full_name||'Unknown'}`);
  const summary=buildSummary('COMPLETE');fd.append('summary',summary);if(decFile)fd.append('current_policy_declarations',decFile);
  if(D.full_name)fd.append('full_name',D.full_name);if(D.email)fd.append('email',D.email);if(D.phone)fd.append('phone',D.phone);
  try{const r=await fetch('/',{method:'POST',body:fd});if(!r.ok)throw r.status;sessionStorage.setItem(DONE_KEY,'1');localStorage.setItem(DONE_KEY,'1');removeListeners();btn.dataset.done='1';btn.disabled=true;btn.textContent='Submitted ✓';
   st.innerHTML='<b style="color:#00a651">✓ Submitted! An agent will follow up shortly.</b>';say('Submitted — thank you! An agent will be in touch.');clearDraft();}
  catch(err){st.textContent='Submit failed ('+err+'). Please try again or call us.';btn.disabled=false}};
 say('Please review your answers below and press Submit.');s.scrollIntoView({block:'nearest'})}
const C='https://chandlerinsurancemn.com/';
const TILES=[
 ['Home + Auto Bundle','🏡🚗','quote.html'],['Auto','🚗','auto-quote.html'],['Home & Cabin','🏡','home-quote.html'],['Condo / Townhouse','🏢','home-quote.html'],
 ['Landlord / Rental','🔑','landlord-quote.html'],['Business','💼','business-quote.html'],['Life','❤️','life-quote.html'],
 ['ATV / UTV','🛻','recreational-quote.html'],['Snowmobile','❄️','recreational-quote.html'],['Boat / PWC','🚤','recreational-quote.html'],
 ['Motorcycle','🏍️','recreational-quote.html'],['RV / Travel Trailer','🚐','recreational-quote.html'],
 ['Other / not sure','❓','quote.html']];
function setClassic(u){} // no-op for embed
function tiles(pre=[]){return new Promise(res=>{say('What would you like a quote for? Select all that apply, then press Continue.');const b=box();b.className='tiles';const sel=new Set(pre&&pre.length?pre:(PRE_TYPE?[PRE_TYPE]:[]));
 const go=document.createElement('button');go.className='go tgo';const bar=document.createElement('div');bar.className='tbar';const hint=document.createElement('div');hint.className='thint';hint.textContent='Pick more or tap Continue';
 const upd=()=>{go.disabled=!sel.size;go.textContent=sel.size?`Continue (${sel.size} selected) →`:'Select at least one type';bar.classList.toggle('show',sel.size>0);};
 TILES.forEach(([t,i,u])=>{const x=document.createElement('button');x.type='button';x.className='tile'+(sel.has(t)?' sel':'');x.setAttribute('aria-pressed',sel.has(t));x.dataset.type=t;x.innerHTML=`<span>${i}</span>${esc(t)}`;
  x.onclick=()=>{sel.has(t)?sel.delete(t):sel.add(t);x.classList.toggle('sel',sel.has(t));x.setAttribute('aria-pressed',sel.has(t));upd()};b.append(x)});
 go.onclick=()=>{if(!sel.size)return;const T=TILES.filter(x=>sel.has(x[0]));b.remove();say(T.map(x=>x[0]).join(' + '),'u');setClassic(C+(T.length===1?T[0][2]:'quote.html'));res(T.map(x=>x[0]))};
 upd();bar.append(hint,go);b.append(bar)})}
// ---------- navigation ----------
const REC=['ATV / UTV','Snowmobile','Boat / PWC','Motorcycle','RV / Travel Trailer'];
const PLANS={'Auto':['Drivers','Vehicles','Auto Coverage'],'Home + Auto Bundle':['Drivers','Vehicles','Household','Property','Auto Coverage','Home Coverage'],
 'Home & Cabin':['Household','Property','Home Coverage'],'Condo / Townhouse':['Household','Property','Home Coverage'],
 'Landlord / Rental':['Rental Property'],'Business':['Business'],'Life':['Life'],'Other / not sure':['What you need']};
// Shared sections are asked once even if several selected types need them.
const SHARED=['Drivers','Vehicles','Household','Property','Auto Coverage','Home Coverage'];
const KEY_SECTIONS=['Drivers','Vehicles','Auto Coverage','Property','Rental Property','Business','Life','Unit Details','Safety','What you need'];
const NONKEY_SECTIONS=['Household','Home Coverage'];
function buildSteps(types){const out=[{t:null,s:'Contact'}],seen=new Set();
 for(const t of types)for(const s of (PLANS[t]||['Unit Details','Safety'])){if(!KEY_SECTIONS.includes(s))continue;if(SHARED.includes(s)){if(seen.has(s))continue;seen.add(s)}out.push({t,s})}
 out.push({t:null,s:'Send or continue'});
 for(const t of types)for(const s of (PLANS[t]||['Unit Details','Safety'])){if(KEY_SECTIONS.includes(s))continue;if(SHARED.includes(s)){if(seen.has(s))continue;seen.add(s)}out.push({t,s})}
 out.push({t:null,s:'Final details'},{t:null,s:'Review'});return out}
const CONTACT_KEYS=['full_name','email','phone','date_of_birth','address','city','zip','requested_effective_date'];
const PROPERTY_KEYS=['property_type','property_address','year_built','square_footage','num_stories','foundation_type','basement_finished_percent','walkout_basement','basement_water_history','exterior_wall','roof_type','roof_condition','roof_year','heat_update_year','electrical_update_year','plumbing_update_year','garage_type','heat_type','wood_heat','wood_heat_type','wood_heat_location','wood_heat_role','wood_heat_pro_installed','wood_heat_year','has_dogs','pet_details','pet_count','pet_bite_history','has_pool','pool_type','pool_fenced','pool_board_slide','has_trampoline','trampoline_netting','trampoline_fenced','business_on_premises','home_business_type','home_business_visitors','security_system','smoke_detectors','co_detectors','deadbolts','fire_extinguishers','other_protective_devices','detached_garage_sqft','detached_garage_year','detached_garage_construction','detached_garage_foundation','detached_garage_heating','detached_garage_electrical','detached_garage_use'];
let gen=0,editContact=false;
const SEC={'Contact':contact,'Drivers':drivers,'Vehicles':vehicles,'Household':household,
 'Property':()=>property(''),'Auto Coverage':()=>coverage('auto'),'Home Coverage':()=>coverage('home'),
 'Rental Property':landlord,'Business':business,'Life':life,'What you need':other,
 'Unit Details':t=>rec(t),'Safety':t=>recSafety(t),'Final details':finalDetails,
 'Send or continue':checkpoint};
async function checkpoint(){step();say("Thanks — that covers the key rating details. You can send it now and an agent will follow up on anything else, or keep going for a more accurate quote."); return (await choose('What would you like to do?',['Keep going','Send what I have'],{opt:false}))==='Send what I have'}
async function runFrom(i){const g=++gen;document.getElementById('sum').style.display='none';
 if(i===0){QCOUNT={};QSEEN=new Set()}
 for(let k=i;k<STEPS.length;k++){cur=k;const x=STEPS[k];
  if(x.s==='Review'){
   if(QSEEN){for(const kk of ANSWERS.keys())if(!QSEEN.has(kk))ANSWERS.delete(kk);}
   EDIT=null;QSEEN=null;review();return
  }
  const r=await SEC[x.s](x.t);if(g!==gen)return;
  if(x.s==='Send or continue'&&r===true){sentEarly=true;k=STEPS.findIndex(s=>s.s==='Final details')-1}}}
const INTRO="Hi! This takes about 2 minutes. Skip anything you don't know — we'll fill it in together.";
// Clean transcript: wipe chat and show only intro (+ types and completed steps when resuming mid-flow)
function resetChat(upto){chat.innerHTML='';say(INTRO);
 if(upto!=null&&D.types){say(D.types.join(' + '),'u');const done=STEPS.slice(0,upto).map(LBL);if(done.length)say('✓ Done: '+done.join(' · '),'sec')}
 chat.scrollTop=0}
function goto(i){if(i<0)return changeType();editContact=STEPS[i].s==='Contact';resetChat(i);runFrom(i)}
async function changeType(){const g=++gen;document.getElementById('sum').style.display='none';const prev=D.types||[];
 for(const k of Object.keys(D))if(!CONTACT_KEYS.includes(k))delete D[k]; D.rec_shared_asked=false; D.rec_operators=[]; decFile=null;sessionStorage.removeItem(DONE_KEY);localStorage.removeItem(DONE_KEY);
 sentEarly=false;STEPS=[];cur=0;render();resetChat();await pickType(g,prev)}
async function pickType(g,prev){g=g||++gen;const T=await tiles(prev||[]);if(g!==gen)return;D.types=[...new Set(T)];
 setSteps(buildSteps(T));runFrom(0)}
document.getElementById('prog').addEventListener('click',e=>{const s=e.target.closest('[data-step]'),n=e.target.closest('[data-nav]');
 if(s){e.preventDefault();goto(+s.dataset.step);return}
 if(n){e.preventDefault();if(n.dataset.nav==='type')changeType();else goto(cur===0?-1:cur-1)}});

let pageHideHandler,visibilityHandler;
function removeListeners(){if(pageHideHandler)removeEventListener('pagehide',pageHideHandler);if(visibilityHandler)removeEventListener('visibilitychange',visibilityHandler);pageHideHandler=visibilityHandler=null;}
// Partial submission on leave (once per draft). Max one partial; skip after COMPLETE.
pageHideHandler=()=>sendPartial();addEventListener('pagehide',pageHideHandler);
visibilityHandler=()=>{if(document.visibilityState==='hidden')sendPartial()};addEventListener('visibilitychange',visibilityHandler);
// bfcache: if restored from back/forward cache, reload so no stale chat chrome lingers
addEventListener('pageshow',e=>{if(e.persisted)location.reload()});



async function run(){setClassic(C+'quote.html');render();
 const draft=loadDraft();if(draft&&hasMeaningfulDraft(draft)){
  const choice=await choose('Resume your in-progress quote?',['Resume','Start over'],{opt:false});
  if(choice==='Start over'){clearDraft();sessionStorage.removeItem(DONE_KEY);localStorage.removeItem(DONE_KEY);resetChat();pickType();return}
  Object.assign(D,draft.D||{});cur=draft.cur||0;STEPS=draft.STEPS||[];partialSent=draft.partialSent||false;sentEarly=draft.sentEarly||false;
  resetChat(cur);runFrom(cur);return}
 say(INTRO);pickType()}
run();
})();
