/* Chandler quote-flow PREVIEW harness (options A/B/C).
   INERT on production: on chandlerinsurancemn.com / www.chandlerinsurancemn.com without ?preview=1 this file returns
   immediately and changes nothing. In preview mode every same-origin POST (quote submit, partial-lead save, dec upload,
   callback request, contact modal) is stubbed and an on-screen "TEST PREVIEW: nothing was sent" notice is shown. */
(function(){
  var H=location.hostname, QS=new URLSearchParams(location.search);
  var PREVIEW=(H!=='chandlerinsurancemn.com'&&H!=='www.chandlerinsurancemn.com')||QS.get('preview')==='1';
  if(!PREVIEW)return;

  var opt=(QS.get('opt')||'').toLowerCase();
  if(!/^(a|b|c|0)$/.test(opt)){try{opt=sessionStorage.getItem('qp-opt')||''}catch(e){opt=''}}
  if(!/^(a|b|c|0)$/.test(opt))opt='a';
  try{sessionStorage.setItem('qp-opt',opt)}catch(e){}
  var OPT=opt==='0'?'':opt;
  var QP=window.QC_PREVIEW={on:true,opt:OPT,blocked:0,log:[]};
  var de=document.documentElement;de.classList.add('qp-on','qp-opt-'+(OPT||'now'));

  // ---------- toast ----------
  var toastEl=null,toastT=null;
  function toast(what){
    var show=function(){
      if(!toastEl){toastEl=document.createElement('div');toastEl.className='qp-toast';toastEl.setAttribute('role','status');document.body.appendChild(toastEl)}
      toastEl.innerHTML='<b>TEST PREVIEW: nothing was sent</b><small>'+String(what||'form submit').replace(/[<>&]/g,'')+' was blocked. No lead reached Chandler Insurance.</small>';
      toastEl.classList.add('show');clearTimeout(toastT);toastT=setTimeout(function(){toastEl.classList.remove("show")},10000);
    };
    if(document.body)show();else document.addEventListener('DOMContentLoaded',show);
  }
  QP.toast=toast;QP.isStub=function(){return true};
  function describe(body){
    var fn='',st='',file=false;
    try{
      if(typeof FormData!=='undefined'&&body instanceof FormData){fn=body.get('form-name')||'';st=body.get('request_status')||'';body.forEach(function(v){if(typeof File!=='undefined'&&v instanceof File&&v.size)file=true})}
      else if(typeof body==='string'||body instanceof URLSearchParams){var p=new URLSearchParams(String(body));fn=p.get('form-name')||'';st=p.get('request_status')||''}
    }catch(e){}
    var what=/PARTIAL/i.test(st)&&!/stuck/i.test(st)?'Partial-lead save':/CALLBACK/i.test(st)?'Callback request':/COMPLETE/i.test(st)?'Quote submit':'Form submit';
    if(file)what+=' + dec page upload';
    return {what:what+(fn?' ('+fn+')':''),fn:fn,st:st,file:file};
  }
  var lastNet=0;
  function blocked(kind,body){var d=describe(body);if(kind!=='native submit')lastNet=Date.now();QP.blocked++;QP.log.push({kind:kind,form:d.fn,status:d.st,file:d.file,t:Date.now()});
    try{console.info('[quote-preview] blocked POST',kind,d.fn,d.st)}catch(e){}toast(d.what)}
  function sameOrigin(u){try{return new URL(u,location.href).origin===location.origin}catch(e){return true}}

  // ---------- network stubs ----------
  var ofetch=window.fetch;
  if(ofetch)window.fetch=function(input,init){
    var url='',method='GET';
    try{url=typeof input==='string'?input:(input&&input.url)||String(input);method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase()}catch(e){method='POST'}
    if(method!=='GET'&&method!=='HEAD'&&sameOrigin(url)){blocked('fetch',init&&init.body);return Promise.resolve(new Response('',{status:200,statusText:'OK (preview stub)'}))}
    return ofetch.apply(this,arguments);
  };
  if(navigator.sendBeacon){var ob=navigator.sendBeacon.bind(navigator);navigator.sendBeacon=function(u,d){if(sameOrigin(u)){blocked('beacon',d);return true}return ob(u,d)}}
  var XO=XMLHttpRequest.prototype.open,XS=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open=function(m,u){this.__qp=String(m).toUpperCase()!=='GET'&&String(m).toUpperCase()!=='HEAD'&&sameOrigin(u);return XO.apply(this,arguments)};
  XMLHttpRequest.prototype.send=function(b){if(this.__qp){blocked('xhr',b);var x=this;setTimeout(function(){try{Object.defineProperty(x,'readyState',{value:4});Object.defineProperty(x,'status',{value:200});x.onreadystatechange&&x.onreadystatechange();x.onload&&x.onload()}catch(e){}},0);return}return XS.apply(this,arguments)};
  var FS=HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit=function(){if(String(this.method).toLowerCase()==='post'){blocked('form.submit()',new FormData(this));return}return FS.apply(this,arguments)};
  document.addEventListener('submit',function(e){var f=e.target;if(OPT&&f&&f.querySelectorAll)setTimeout(function(){[].forEach.call(f.querySelectorAll('input[name*="license" i]:not([name*="state" i])'),function(el){el.value=''})},0);if(f&&String(f.method).toLowerCase()==='post'){e.preventDefault();
    // Let the page's own handler run (validation / success UI). Native POST is cancelled here.
    setTimeout(function(){if(!e.__qpCounted&&Date.now()-lastNet>300){blocked('native submit',new FormData(f))}},50)}},true);

  // ---------- UI: badge + switcher + per-option page tweaks ----------
  var NAMES={a:'Option A · Quick start',b:'Option B · Talk or quote',c:'Option C · Short form','':'Current site'};
  var PRODUCT={'auto.html':'auto-quote.html','business.html':'business-quote.html','commercial-insurance.html':'business-quote.html','home.html':'home-quote.html','landlord.html':'landlord-quote.html','life.html':'life-quote.html','recreational.html':'recreational-quote.html','snowmobile-insurance-minnesota.html':'recreational-quote.html','atv-insurance-minnesota.html':'recreational-quote.html','rv-insurance-minnesota.html':'recreational-quote.html'};
  function page(){var p=location.pathname.split('/').pop()||'index.html';if(!/\.html$/.test(p))p+='.html';return p}
  function withOpt(href,o){try{var u=new URL(href,location.href);if(u.origin!==location.origin)return href;u.searchParams.set('opt',o);return u.pathname.replace(/^\//,'/')+u.search+u.hash}catch(e){return href}}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

  function ui(){
    var b=document.createElement('div');b.className='qp-banner';b.setAttribute('role','note');b.innerHTML='<strong>PREVIEW, not a real quote request. Nothing is sent.</strong> <span class="qp-badge">'+esc(NAMES[OPT])+'</span>';document.body.insertBefore(b,document.body.firstChild);
    if(OPT)[].forEach.call(document.querySelectorAll('input[name*="license" i]:not([name*="state" i])'),function(el){if(el.type!=='text')return;el.type='password';el.setAttribute('autocomplete','off');el.spellcheck=false;var t=document.createElement('button');t.type='button';t.className='qp-dl-show';t.textContent='Show';t.onclick=function(){var h=el.type==='password';el.type=h?'text':'password';t.textContent=h?'Hide':'Show'};el.insertAdjacentElement('afterend',t);});
    var sw=document.createElement('div');sw.className='qp-switch';sw.innerHTML='<button type="button" class="qp-sw-toggle" aria-expanded="true">Compare options ▾</button><div class="qp-sw-btns">'+
      [['0','Now','Current'],['a','A','A · Quick start'],['b','B','B · Talk or quote'],['c','C','C · Short form']].map(function(x){return '<a href="'+esc(withOpt(location.href,x[0]))+'" class="qp-sw-btn'+(opt===x[0]?' on':'')+'" data-opt="'+x[0]+'"><span class="l">'+x[2]+'</span><span class="s">'+x[1]+'</span></a>'}).join('')+
      '<div class="qp-sw-note">Test preview — nothing is sent</div></div>';
    document.body.appendChild(sw);
    sw.querySelector('.qp-sw-toggle').onclick=function(){var c=sw.classList.toggle('collapsed');this.setAttribute('aria-expanded',String(!c));this.textContent=c?'Options ▸':'Compare options ▾'};
    if(matchMedia('(max-width:640px)').matches){sw.classList.add('collapsed');sw.querySelector('.qp-sw-toggle').textContent='Options ▸'}
    // keep the chosen option on internal links
    document.querySelectorAll('a[href]').forEach(function(a){var h=a.getAttribute('href');if(!h||/^(#|mailto:|tel:|sms:|javascript:)/i.test(h)||a.closest('.qp-switch'))return;if(/^https?:/i.test(h)&&!sameOrigin(h))return;a.setAttribute('href',withOpt(h,opt))});
    if(!OPT)return;
    // Option A+: product-page buttons go straight into that product's quote (skips the 13-tile picker)
    var target=PRODUCT[page()];
    if(target)document.querySelectorAll('a[href]').forEach(function(a){var u;try{u=new URL(a.getAttribute('href'),location.href)}catch(e){return}if(u.origin===location.origin&&/\/quote(\.html)?$/.test(u.pathname)){a.setAttribute('href',withOpt('/'+target,opt));a.dataset.qpRewritten='1'}});
    var embed=document.getElementById('qchat-embed');if(!embed)return;
    // Trust strip directly under the chat (by the form)
    var ts=document.createElement('div');ts.className='qp-trust';ts.innerHTML=
      '<a class="qp-g" href="https://www.google.com/maps/place/Chandler+Insurance/@47.2367975,-93.5224832,17z" target="_blank" rel="noopener"><span class="qp-stars">★★★★★</span> <b>4.7</b> on Google</a>'+
      '<span class="qp-rev">“Joe found me excellent quotes in a very timely manner.” <i>— Bob R.</i></span>'+
      '<span class="qp-car">✓ We shop A+ rated carriers for you</span>'+
      '<!-- Carrier logos intentionally omitted: no carrier logos exist on the site yet; pending Josh\'s approved carrier list. -->'+
      '<span class="qp-spam">🔒 We never sell your info. No spam.</span>';
    embed.parentNode.insertBefore(ts,embed);
    if(OPT==='b'||OPT==='c')talkBox(embed);
  }
  function talkBox(embed){
    var qt=embed.dataset.qtype||'';var map={'Auto':'Auto','Business':'Business','Home & Cabin':'Home & Cabin','Landlord / Rental':'Landlord / Rental','Life':'Life'};
    var pre=map[qt]||(page()==='recreational-quote.html'?'Recreational':'');
    var types=['Auto','Home & Cabin','Business','Recreational','Landlord / Rental','Life','Other'];
    var t=document.createElement('div');t.className='qp-talk';t.innerHTML=
      '<button type="button" class="qp-talk-h" aria-expanded="true"><b>Rather just talk?</b> We\'ll call or text you. <span class="qp-chev">▾</span></button>'+
      '<form class="qp-talk-f" novalidate><input name="qp_name" autocomplete="name" placeholder="Your name" aria-label="Your name">'+
      '<input name="qp_phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="Phone" aria-label="Phone">'+
      '<select name="qp_for" aria-label="What is it for?"><option value="">What\'s it for?</option>'+types.map(function(x){return '<option'+(x===pre?' selected':'')+'>'+esc(x)+'</option>'}).join('')+'</select>'+
      '<span class="qp-ct" role="radiogroup" aria-label="Call or text"><label><input type="radio" name="qp_ct" value="Call" checked> Call</label><label><input type="radio" name="qp_ct" value="Text"> Text</label></span>'+
      '<button type="submit" class="qp-talk-go">Have us reach out</button><p class="qp-talk-msg" aria-live="polite"></p></form>';
    var top=document.querySelector('.qp-trust')||embed;top.parentNode.insertBefore(t,top);
    var h=t.querySelector('.qp-talk-h');h.onclick=function(){var c=t.classList.toggle('collapsed');h.setAttribute('aria-expanded',String(!c))};
    if(matchMedia('(max-width:640px)').matches){t.classList.add('collapsed');h.setAttribute('aria-expanded','false')}
    var f=t.querySelector('form');
    f.addEventListener('submit',function(e){e.preventDefault();e.__qpCounted=true;e.stopPropagation();
      var n=f.qp_name.value.trim(),p=f.qp_phone.value.trim(),w=f.qp_for.value||'Not specified',ct=(f.querySelector('input[name=qp_ct]:checked')||{}).value||'Call',m=f.querySelector('.qp-talk-msg');
      if(!n){m.textContent='Please add your name.';return}if(p.replace(/\D/g,'').length<10){m.textContent='Please add a 10-digit phone number.';return}
      var fd=new FormData();fd.append('form-name','chat-quote');fd.append('request_status','CALLBACK REQUEST');fd.append('quote_form',w);
      fd.append('subject','Chandler Quote Request: '+w+' (CALLBACK - '+ct+') - '+n);fd.append('full_name',n);fd.append('phone',p);
      fd.append('summary','== Callback request ==\nName: '+n+'\nPhone: '+p+'\nFor: '+w+'\nPrefers: '+ct+'\nFrom page: '+page());
      fetch('/',{method:'POST',body:fd}).then(function(r){if(!r.ok)throw r.status;f.innerHTML='<p class="qp-talk-ok">✓ Thanks, '+esc(n.split(' ')[0])+'! We\'ll '+(ct==='Text'?'text':'call')+' you shortly during office hours.</p>'})
        .catch(function(){m.textContent='Could not send — please call (218) 326-4655.'});
    },true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ui);else ui();

  // ---------- styles ----------
  var css=
  '.qp-dl-show{margin:6px 0 0;background:#fff;color:#003d82;border:1px solid #003d82;border-radius:999px;padding:4px 12px;font:600 13px Roboto,sans-serif;cursor:pointer}'+
  'html.qp-opt-a #qchat-embed .qback,html.qp-opt-b #qchat-embed .qback,html.qp-opt-c #qchat-embed .qback{min-width:44px!important;min-height:44px!important;padding:10px 12px!important;display:inline-flex;align-items:center}'+
  '.qp-banner{position:relative;z-index:2147483000;background:#b91c1c;color:#fff;font:500 14px/1.35 Roboto,sans-serif;text-align:center;padding:9px 14px}.qp-banner strong{font-weight:700}.qp-badge{display:inline-block;margin-left:8px;background:#fff;color:#b91c1c;font:700 12px/1 Roboto,sans-serif;padding:5px 10px;border-radius:999px;vertical-align:middle}'+
  '@media(max-width:640px){.qp-badge{top:auto;bottom:10px;left:8px;font-size:11px;padding:6px 9px}}'+
  '.qp-toast{position:fixed;left:50%;top:14px;transform:translate(-50%,-140%);z-index:2147483001;background:#111827;color:#fff;border:3px solid #facc15;border-radius:16px;padding:12px 18px;max-width:92vw;font:15px/1.35 Roboto,sans-serif;box-shadow:0 10px 30px #0007;transition:transform .25s}'+
  '.qp-toast.show{transform:translate(-50%,0)}.qp-toast b{display:block;color:#facc15;font-size:16px}.qp-toast small{display:block;margin-top:3px;color:#e5e7eb}'+
  '.qp-switch{position:fixed;right:10px;bottom:10px;z-index:2147483000;background:#fff;border:2px solid #003d82;border-radius:16px;box-shadow:0 6px 20px #0004;font:13px Roboto,sans-serif;overflow:hidden}'+
  '.qp-sw-toggle{display:block;width:100%;background:#003d82;color:#fff;border:0;padding:7px 10px;font-weight:700;cursor:pointer;text-align:left}'+
  '.qp-sw-btns{display:flex;flex-direction:column;padding:6px;gap:4px}.qp-switch.collapsed .qp-sw-btns{display:none}'+
  '.qp-sw-btn{display:block;padding:7px 10px;border-radius:999px;color:#003d82;text-decoration:none;font-weight:600;border:1px solid #dbe4f0}.qp-sw-btn.on{background:#003d82;color:#fff}'+
  '.qp-sw-btn .s{display:none}.qp-sw-note{font-size:11px;color:#b91c1c;text-align:center;padding-top:2px}'+
  '@media(max-width:640px){.qp-sw-btns{flex-direction:row}.qp-sw-btn .l{display:none}.qp-sw-btn .s{display:inline}.qp-sw-note{display:none}}'+
  '.qp-trust{max-width:720px;margin:12px auto 0;padding:12px 14px;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;justify-content:center;background:#f8fafd;border:1px solid #dbe4f0;border-radius:16px;font:14px/1.4 Roboto,sans-serif;color:#334155;box-sizing:border-box}'+
  '.qp-trust a{color:#003d82;text-decoration:none}.qp-stars{color:#f5b301;letter-spacing:1px}.qp-rev i{color:#64748b;font-style:normal}.qp-car{color:#166534;font-weight:600}.qp-spam{font-weight:600}'+
  '@media(max-width:640px){.qp-trust{margin:10px 12px 0;font-size:13px;gap:6px 12px}.qp-rev{flex-basis:100%;text-align:center}}'+
  '.qp-talk{max-width:720px;margin:14px auto 0;border:2px solid #00a651;border-radius:16px;background:#f0fdf4;font:14px Roboto,sans-serif;box-sizing:border-box;overflow:hidden}'+
  '@media(max-width:760px){.qp-talk{margin:12px 12px 0}}'+
  '.qp-talk-h{display:flex;width:100%;gap:6px;align-items:center;background:none;border:0;padding:10px 14px;font:15px Roboto,sans-serif;color:#14532d;cursor:pointer;text-align:left}.qp-talk-h .qp-chev{margin-left:auto}'+
  '.qp-talk.collapsed .qp-talk-f{display:none}.qp-talk.collapsed .qp-chev{transform:rotate(-90deg)}'+
  '.qp-talk-f{display:grid;grid-template-columns:1.2fr 1fr 1fr auto auto;gap:8px;padding:0 14px 12px;align-items:center}'+
  '.qp-talk-f input[type=text],.qp-talk-f input:not([type]),.qp-talk-f input[type=tel],.qp-talk-f select{padding:10px;border:1px solid #94a3b8;border-radius:12px;font-size:16px;min-width:0;background:#fff}'+
  '.qp-ct{display:flex;gap:10px;white-space:nowrap}.qp-talk-go{background:#00a651;color:#fff;border:0;border-radius:999px;padding:11px 14px;font-weight:700;cursor:pointer;white-space:nowrap}'+
  '.qp-talk-msg{grid-column:1/-1;margin:0;color:#b91c1c;font-size:13px}.qp-talk-msg:empty{display:none}.qp-talk-ok{grid-column:1/-1;margin:4px 0;color:#14532d;font-weight:700}'+
  '@media(max-width:760px){.qp-talk-f{grid-template-columns:1fr 1fr}.qp-talk-f input:first-child{grid-column:1/-1}.qp-talk-go{grid-column:1/-1}}'+
  '.qp-stuck{max-width:680px;margin:6px auto 0;text-align:center;font:14px Roboto,sans-serif}'+
  '#qchat-embed .qp-stuck-btn,.qp-stuck-btn{background:none!important;color:#003d82!important;box-shadow:none!important;width:auto!important;border:0;color:#003d82;text-decoration:underline;font-weight:600;cursor:pointer;padding:6px}'+
  '.qp-stuck-f{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:6px}.qp-stuck-f input{padding:9px;border:1px solid #94a3b8;border-radius:12px;font-size:16px;min-width:0;flex:1 1 140px}'+
  '.qp-stuck-f button{background:#00a651;color:#fff;border:0;border-radius:999px;padding:10px 14px;font-weight:700}'+
  '#qchat-embed a.qp-sms{display:inline-block;margin-top:6px;background:#00a651;color:#fff;padding:9px 14px;border-radius:999px;text-decoration:none;font-weight:700}'+
  '#qchat-embed .tiles .qskip{grid-column:1/-1}'+
  'html.qp-opt-c #qchat-embed .qchoice-ck{display:inline-flex;align-items:center;gap:6px;border:2px solid #dbe4f0;border-radius:999px;padding:8px 14px;background:#fff;cursor:pointer;font-weight:600;color:#003d82}'+
  'html.qp-opt-c #qchat-embed .qchoice-ck:has(input:checked){border-color:#003d82;background:#e8f0fb}';
  var st=document.createElement('style');st.id='qp-style';st.textContent=css;(document.head||de).appendChild(st);
})();
