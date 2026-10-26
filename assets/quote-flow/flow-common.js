/* Chandler Insurance – quote request flow (version B, launch copy for chandlerinsurancemn.com/get-a-quote/).
   REAL LEADS: submissions go to /api/lead (Netlify Blobs "quote-leads"), which emails them
   through the Netlify Form "qf-lead" to joshchandler@chandlerinsurancemn.com. Dec pages upload to /api/dec-upload
   (private Blobs, 30-day secret link). Partials are emailed by the scheduled lead-sweep function after 15 idle minutes.
   Automated tests (browser UA containing "QFHarness", or localStorage qfNoSend=1) are saved but never emailed.
   Outside calls: optional VIN decode GET to NHTSA vPIC (public, sends only the VIN; Josh-approved) and address
   suggestions via this site's own /api/addr function (MN address-point index; forwards only the typed address text to US Census / Photon-OSM). */
(function () {
  'use strict';
  var UNSURE = '__unsure__';
  var LEAD_URL = '/api/lead', UPLOAD_URL = '/api/dec-upload';
  var NOSEND = (function () { try { return /QFHarness/i.test(navigator.userAgent) || localStorage.getItem('qfNoSend') === '1'; } catch (e) { return false; } })();
  var DEC_MAX = 10 * 1024 * 1024, DEC_CHUNK = 2 * 1024 * 1024, FORM_FILE_MAX = 7.5 * 1024 * 1024;
  var PHONE = '(218) 326-4655', TEL = 'tel:2183264655';

  // ---------- helpers ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function isEmpty(v) { return v == null || v === '' || (Array.isArray(v) && v.length === 0); }
  function clean(v) { return (v == null || v === UNSURE || (typeof v === 'string' && /^__.*__$/.test(v.trim()))) ? '' : v; } // sentinels never shown or validated as real values
  function cleanStr(v) { v = clean(v); return typeof v === 'string' ? v.trim() : ''; }
  function first(a) { return cleanStr(a.firstName); }

  // products helpers
  function prods(a) { return Array.isArray(a.products) ? a.products : []; }
  function has(a, p) {
    var ps = prods(a);
    if (p === 'home' || p === 'auto') return ps.indexOf(p) > -1 || ps.indexOf('bundle') > -1;
    return ps.indexOf(p) > -1;
  }
  function personal(a) { return prods(a).some(function (p) { return p !== 'business'; }); }

  var PRODUCTS = [
    { v: 'home', l: 'Home', ic: '🏠' },
    { v: 'auto', l: 'Auto', ic: '🚗' },
    { v: 'bundle', l: 'Home + Auto bundle', ic: '🏡', s: 'Usually the best value' },
    { v: 'cabin', l: 'Cabin / seasonal', ic: '🌲' },
    { v: 'renters', l: 'Renters', ic: '🔑' },
    { v: 'dwelling', l: 'Rental / dwelling', ic: '🏘️', s: 'A place you rent out' },
    { v: 'rec', l: 'Boat & rec', ic: '🛥️', s: 'Boat, ATV, snowmobile, RV' },
    { v: 'umbrella', l: 'Umbrella', ic: '☂️', s: 'Extra liability' },
    { v: 'life', l: 'Life', ic: '❤️' },
    { v: 'business', l: 'Business', ic: '💼' },
    { v: 'notsure', l: 'I\'m not sure – talk to an agent', ic: '💬' }
  ];

  // ---------- shared contact screen fields (all variants) ----------
  var CONTACT_FIELDS = [
    { id: 'firstName', type: 'text', label: 'First name', required: true, unsure: false, ac: 'given-name' },
    { id: 'lastName', type: 'text', label: 'Last name', required: true, unsure: false, ac: 'family-name' },
    // Email first and the default. Call / text are extra options (multi-select).
    { id: 'contactPref', type: 'multi', label: 'How should we get your quote to you?', unsure: false, fu: false, opts: [{ v: 'email', l: 'Email me my quote' }, { v: 'call', l: 'Call me' }, { v: 'text', l: 'Text me' }] },
    { id: 'email', type: 'email', label: 'Email', im: 'email', ac: 'email', ph: 'you@example.com', unsure: false, fu: false,
      reqFn: function (a) { return contactNeeds(a).email && !contactSwitchPending(a); } },
    { id: 'phone', type: 'tel', label: 'Mobile phone', im: 'tel', ac: 'tel', ph: '(218) 555-0100', unsure: false, fu: false,
      reqFn: function (a) { return contactNeeds(a).phone; },
      labelFn: function (a) { var n = contactNeeds(a); return n.phone || contactSwitchPending(a) ? 'Mobile phone' : (n.email ? 'Mobile phone (optional)' : 'Mobile phone'); },
      hintFn: function (a) { var n = contactNeeds(a); return n.phone || n.email ? '' : 'Phone or email – at least one.'; } },
    // phone-only with Email still picked: we switch to Call (or Text) instead of blocking
    { id: 'contactAutoNote', type: 'info', cls: 'cnote', live: true, html: function (a) { return contactNoteHtml(a); } },
    // only when they want a call or text
    { id: 'bestTime', type: 'tiles', label: 'Best time to reach you (optional)', cols2: true, unsure: false, fu: false, opts: [{ v: 'morning', l: 'Morning' }, { v: 'afternoon', l: 'Afternoon' }, { v: 'evening', l: 'After 5' }, { v: 'any', l: 'Anytime' }],
      show: function (a) { var c = Array.isArray(a.contactPref) ? a.contactPref : []; return c.indexOf('call') > -1 || c.indexOf('text') > -1; } },
    { id: 'contactConsent', type: 'info', cls: 'consent', html: 'We use this only to work on your quote. Chandler never sells your data. No spam, no robocalls.' }
  ];
  // Which contact fields are required, from the chosen method(s). Nothing chosen = the base rule (phone OR email).
  function contactNeeds(a) {
    var c = Array.isArray(a.contactPref) ? a.contactPref : [];
    return { email: c.indexOf('email') > -1, phone: c.indexOf('call') > -1 || c.indexOf('text') > -1 };
  }
  function phoneOk(a) { var ph = digits(cleanStr(a.phone)); return ph.length === 10 || (ph.length === 11 && ph[0] === '1'); }
  // Email still picked, no email typed, a valid phone typed -> we will contact by call (or text if only text was also picked)
  function contactSwitchPending(a) {
    var c = Array.isArray(a.contactPref) ? a.contactPref : [];
    return c.indexOf('email') > -1 && !cleanStr(a.email) && phoneOk(a);
  }
  function contactAutoMethod(a) { var c = Array.isArray(a.contactPref) ? a.contactPref : []; return c.indexOf('text') > -1 && c.indexOf('call') < 0 ? 'text' : 'call'; }
  function contactNoteHtml(a) {
    if (!(contactSwitchPending(a) || (a.contactAuto && !cleanStr(a.email)))) return '';
    return '<p class="cnote-p">' + (contactAutoMethod(a) === 'text' ? '💬 We\'ll text you' : '📞 We\'ll call you') + ' since no email was given. <button type="button" class="linkbtn" data-act="cchange">Change</button></p>';
  }
  function applyContactSwitch(a) {
    if (!contactSwitchPending(a)) return false;
    var c = a.contactPref.filter(function (x) { return x !== 'email'; });
    if (c.indexOf('call') < 0 && c.indexOf('text') < 0) { c.push('call'); a.contactAutoAdded = 'call'; } else a.contactAutoAdded = '';
    a.contactPref = c; a.contactAuto = true; return true;
  }

  // ---------- picture icons for construction ----------
  var PICS = {
    frame: '<svg viewBox="0 0 72 56"><path d="M8 28 36 6l28 22" fill="none" stroke="#003d82" stroke-width="4"/><rect x="16" y="26" width="40" height="26" fill="#e8f0fa" stroke="#003d82" stroke-width="3"/><path d="M16 33h40M16 40h40M16 47h40" stroke="#8fb0d8" stroke-width="2"/></svg>',
    brick: '<svg viewBox="0 0 72 56"><path d="M8 28 36 6l28 22" fill="none" stroke="#003d82" stroke-width="4"/><rect x="16" y="26" width="40" height="26" fill="#f6d9cf" stroke="#b22234" stroke-width="3"/><path d="M16 34h40M16 42h40M26 26v8M46 26v8M36 34v8M26 42v10M46 42v10" stroke="#b22234" stroke-width="2"/></svg>',
    log: '<svg viewBox="0 0 72 56"><path d="M8 28 36 6l28 22" fill="none" stroke="#003d82" stroke-width="4"/><g fill="#d9b48a" stroke="#7a5230" stroke-width="2"><rect x="14" y="27" width="44" height="7" rx="3.5"/><rect x="14" y="35" width="44" height="7" rx="3.5"/><rect x="14" y="43" width="44" height="7" rx="3.5"/></g></svg>',
    manufactured: '<svg viewBox="0 0 72 56"><rect x="6" y="20" width="60" height="24" rx="3" fill="#e8f0fa" stroke="#003d82" stroke-width="3"/><rect x="14" y="26" width="10" height="8" fill="#fff" stroke="#003d82" stroke-width="2"/><rect x="44" y="26" width="10" height="18" fill="#fff" stroke="#003d82" stroke-width="2"/><path d="M10 44v6M62 44v6" stroke="#003d82" stroke-width="3"/></svg>',
    unsure: '<svg viewBox="0 0 72 56"><circle cx="36" cy="28" r="20" fill="#fff6d6" stroke="#d9a900" stroke-width="3"/><text x="36" y="36" text-anchor="middle" font-size="24" font-weight="700" fill="#8a6d00" font-family="Roboto,Arial">?</text></svg>'
  };
  var AVATAR = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" fill="#dbe6f4"/><circle cx="32" cy="25" r="12" fill="#8fa9cc"/><path d="M10 60c2-13 11-20 22-20s20 7 22 20z" fill="#8fa9cc"/></svg>';

  // ---------- state ----------
  var CFG, S, root, oneQ;
  var SAVE_KEY, CLIENT_KEY = 'chq_client_id', TOKEN_KEY = 'chq_session_token'; // both get a per-variant suffix in start()

  function clientId() {
    var id = lsGet(CLIENT_KEY, null);
    if (!id) { id = Math.random().toString(36).slice(2, 10); lsSet(CLIENT_KEY, id); }
    return id;
  }
  // Per-browser session token (128-bit random). The server stores only its hash and refuses to let any other
  // browser update a record bound to it (it issues a new ref instead).
  function sessionToken() {
    var t = lsGet(TOKEN_KEY, null);
    if (!t || !/^[a-f0-9]{32}$/.test(t)) {
      var b = new Uint8Array(16);
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b); else for (var i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
      t = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
      lsSet(TOKEN_KEY, t);
    }
    return t;
  }
  var OFFLINE_REF = 'CHQ-OFFLINE';

  function visibleScreens() { return CFG.screens.filter(function (s) { return !s.show || s.show(S.a); }); }
  function fieldVisible(f) { return !f.show || f.show(S.a); }
  function screenById(id) { return CFG.screens.filter(function (s) { return s.id === id; })[0]; }

  // ---------- field rendering ----------
  var NO_UNSURE = ['firstName', 'lastName', 'phone', 'email'];
  function unsureChip(f, label) {
    if (f.unsure === false || f.required || NO_UNSURE.indexOf(f.id) > -1) return '';
    var on = S.a[f.id] === UNSURE;
    return '<button type="button" class="chip' + (on ? ' on' : '') + '" data-unsure="' + f.id + '" aria-pressed="' + on + '">' + (on ? '✓ ' : '') + esc(label || f.unsureLabel || "I'm not sure – my agent can help") + '</button>';
  }
  function lbl(f) {
    if (f.hideLabel) return f.hint ? '<p class="hint">' + esc(f.hint) + '</p>' : '';
    var L = f.labelFn ? f.labelFn(S.a) : f.label, R = f.reqFn ? f.reqFn(S.a) : f.required, H = f.hintFn ? f.hintFn(S.a) : f.hint;
    return '<label class="lbl" for="f_' + f.id + '">' + esc(L) + (R ? ' <span class="req">*</span>' : '') + '</label>' + (H ? '<p class="hint">' + esc(H) + '</p>' : '');
  }
  function optList(f) {
    var o = (typeof f.opts === 'function' ? f.opts(S.a) : f.opts).slice();
    if (f.unsure !== false) o.push({ v: UNSURE, l: f.unsureLabel || "I'm not sure", unsure: true });
    return o;
  }
  // Round 10 (Josh): any wood / solid-fuel heat choice shows an optional "Where is it located?" box right under it.
  var WOODV = ['woodprimary', 'outdoorboiler', 'woodstove', 'insert', 'fireplace', 'pellet', 'coal', 'Yes – supplemental', 'Yes – primary heat', 'Wood / pellet stove'];
  function woodOn(f) { var v = S.a[f.id]; return !!f.woodLoc && fieldVisible(f) && (Array.isArray(v) ? v.some(function (x) { return WOODV.indexOf(x) > -1; }) : WOODV.indexOf(v) > -1); }
  var WOOD_Q = 'Where is it located?', WOOD_HINT = 'e.g., living room, basement, garage, or outdoor boiler and how far from the house';
  function woodLocHtml(id, v, attrs) { return '<div class="woodloc"><label class="lbl" for="wl_' + id + '">' + WOOD_Q + ' <span class="opt">(optional)</span></label><p class="hint" id="wlh_' + id + '">' + esc(WOOD_HINT) + '</p><input type="text" id="wl_' + id + '" ' + attrs + ' aria-describedby="wlh_' + id + '" autocomplete="off" value="' + esc(v || '') + '" placeholder="' + esc(WOOD_HINT) + '"></div>'; }
  function renderField(f) {
    if (!fieldVisible(f)) return '';
    var v = S.a[f.id], uns = v === UNSURE, h = '';
    switch (f.type) {
      case 'info':
        return '<div class="' + (f.cls || 'note-info') + '"' + (f.live ? ' aria-live="polite"' : '') + '>' + (typeof f.html === 'function' ? f.html(S.a) : f.html) + '</div>';
      case 'text': case 'email': case 'tel': case 'number': case 'date': case 'month':
        h = lbl(f) + '<input id="f_' + f.id + '" type="' + f.type + '" data-in="' + f.id + '" value="' + (uns ? '' : esc(clean(v) || '')) + '"' +
          (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + (f.im ? ' inputmode="' + f.im + '"' : '') + (f.ac ? ' autocomplete="' + f.ac + '"' : '') +
          (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + (f.list ? ' list="dl_' + f.id + '"' : '') + (f.year ? ' maxlength="4" autocomplete="off" data-year="1"' : '') + (uns ? ' disabled' : '') + '>' +
          (f.list ? '<datalist id="dl_' + f.id + '">' + f.list.map(function (o) { return '<option value="' + esc(o) + '"></option>'; }).join('') + '</datalist>' : '') + unsureChip(f);
        break;
      case 'textarea':
        h = lbl(f) + '<textarea id="f_' + f.id + '" data-in="' + f.id + '"' + (f.ph ? ' placeholder="' + esc(f.ph) + '"' : '') + (uns ? ' disabled' : '') + '>' + (uns ? '' : esc(v || '')) + '</textarea>' + unsureChip(f);
        break;
      case 'select':
        h = lbl(f) + '<select id="f_' + f.id + '" data-in="' + f.id + '"' + (uns && f.unsure !== false ? ' disabled' : '') + '><option value="">Choose…</option>' +
          f.opts.map(function (o) { return '<option value="' + esc(o.v) + '"' + (v === o.v ? ' selected' : '') + '>' + esc(o.l) + '</option>'; }).join('') + '</select>' + unsureChip(f);
        break;
      case 'tiles': case 'multi': case 'pics':
        var multi = f.type === 'multi', sel = multi ? (Array.isArray(v) ? v : (uns ? [UNSURE] : [])) : v;
        h = lbl(f) + '<div class="tiles ' + (f.type === 'pics' ? 'pics ' : '') + (f.cols2 ? 'cols2 ' : '') + (multi && !f.cols2 ? 'multi-cols' : '') + '" role="group">' +
          optList(f).map(function (o) {
            var on = multi ? sel.indexOf(o.v) > -1 : sel === o.v;
            var icon = f.type === 'pics' ? (PICS[o.unsure ? 'unsure' : o.pic] || '') : (o.ic ? '<span class="ic" aria-hidden="true">' + o.ic + '</span>' : '');
            return '<button type="button" class="tile' + (multi ? ' multi' : '') + (o.unsure ? ' unsure' : '') + (on ? ' on' : '') + '" data-tile="' + f.id + '" data-v="' + esc(o.v) + '" aria-pressed="' + on + '">' +
              icon + '<span class="tx">' + esc(o.l) + (o.s ? '<small' + (o.common ? ' class="common"' : '') + '>' + esc(o.s) + '</small>' : '') + '</span><span class="ck"></span></button>';
          }).join('') + '</div>';
        break;
      case 'address':
        var p = f.id;
        h = lbl(f) + '<div class="ac"><input id="f_' + p + '" type="text" data-in="' + p + '_line" data-ac="' + p + '" autocomplete="off" placeholder="Start typing your street address" value="' + esc(S.a[p + '_line'] || '') + '"' + (uns ? ' disabled' : '') + '><ul class="ac-list" hidden></ul></div>' +
          '<div class="row three" style="margin-top:.6rem">' +
          '<input type="text" aria-label="City" placeholder="City" data-in="' + p + '_city" value="' + esc(S.a[p + '_city'] || '') + '"' + (uns ? ' disabled' : '') + '>' +
          '<input type="text" aria-label="State" placeholder="State" data-in="' + p + '_state" value="' + esc(S.a[p + '_state'] || '') + '"' + (uns ? ' disabled' : '') + '>' +
          '<input type="text" aria-label="ZIP" placeholder="ZIP" inputmode="numeric" data-in="' + p + '_zip" value="' + esc(S.a[p + '_zip'] || '') + '"' + (uns ? ' disabled' : '') + '></div>' +
          (f.apt ? '<input type="text" style="margin-top:.6rem" aria-label="Apt or unit (optional)" placeholder="Apt / unit (optional)" data-in="' + p + '_apt" value="' + esc(S.a[p + '_apt'] || '') + '"' + (uns ? ' disabled' : '') + '>' : '') +
          unsureChip(f, 'Skip – my agent can help') + (f.parcel ? '<div data-parcelslot="' + p + '" aria-live="polite">' + parcelCard(p) + '</div>' : '');
        break;
      case 'repeater':
        var items = Array.isArray(v) ? v : [];
        if (!uns && !items.length) { var sd = f.seed ? f.seed(S.a) : {}; items = Array.isArray(sd) ? sd : [sd]; S.a[f.id] = items; }
        if (!uns && f.sync) f.sync(S.a, items); // e.g. drivers pick up household people (name, DOB) entered earlier
        h = lbl(f) + (uns ? '' : items.map(function (it, i) {
          return '<div class="rep-item"><h4>' + esc(f.itemLabel) + ' ' + (i + 1) + (items.length > 1 ? '<button type="button" class="linkbtn rm" data-rm="' + f.id + '" data-i="' + i + '">Remove</button>' : '') + '</h4>' +
            (f.carryNote && it.fromPeople ? '<p class="hint carry">' + esc(f.carryNote) + '</p>' : '') +
            f.sub.map(function (sf) {
              var sv = it[sf.k] || '';
              if (sf.when && sf.when.indexOf(it[sf.whenKey || 'type']) < 0) return '';
              if (sf.type === 'checks') { var cv = Array.isArray(it[sf.k]) ? it[sf.k] : [];
                return '<div class="f"><p class="lbl">' + esc(sf.l) + '</p><div class="checks">' + sf.opts.map(function (o) { return '<label class="chk"><input type="checkbox" data-rep="' + f.id + '" data-i="' + i + '" data-k="' + sf.k + '" data-cv="' + esc(o) + '"' + (cv.indexOf(o) > -1 ? ' checked' : '') + '> <span>' + esc(o) + '</span></label>'; }).join('') + '</div></div>'; }
              if (CFG.vinConfirm && it.vinDecoded && it.vinConfirmed !== 'edit' && /^(year|make|model|trim)$/.test(sf.k)) return '';
              if (sf.type === 'make') return renderMake(f, it, i, sf);
              if (sf.type === 'model') return renderModel(f, it, i, sf); // shown in the confirm box instead
              if (sf.type === 'select') return '<div class="f"><label class="lbl">' + esc(sf.l) + '</label><select data-rep="' + f.id + '" data-i="' + i + '" data-k="' + sf.k + '"><option value="">Choose…</option>' +
                (sv && sf.opts.indexOf(sv) < 0 && sv !== 'Not sure' ? '<option selected>' + esc(sv) + '</option>' : '') + sf.opts.map(function (o) { return '<option' + (sv === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + (sf.noUnsure ? '' : '<option value="Not sure"' + (sv === "Not sure" ? ' selected' : '') + '>I\'m not sure</option>') + '</select></div>';
              if (sf.type === 'dl') return renderDL(f, it, i);
              if (sf.type === 'hd') return '<p class="rep-hd">' + esc(sf.l) + '</p>';
              if (sf.type === 'motors') return renderMotors(f, it, i, sf);
              if (sf.hin) { var hs = S.vin[f.id + ':' + i + ':hin'] || {};
                return '<div class="f"><label class="lbl">' + esc(sf.l) + '</label><input type="text" data-rep="' + f.id + '" data-i="' + i + '" data-k="' + sf.k + '" data-hin="1" maxlength="12" autocapitalize="characters" autocomplete="off" spellcheck="false" value="' + esc(sv) + '" placeholder="' + esc(sf.ph || '') + '">' +
                  '<p class="vin-stat ' + (hs.cls || '') + '" data-vinstat="' + f.id + ':' + i + ':hin" aria-live="polite">' + (hs.msg || '') + '</p></div>'; }
              if (sf.yr) { var yns = sv === 'Not sure';
                return '<div class="f"><label class="lbl">' + esc(sf.l) + '</label><input type="text" inputmode="numeric" maxlength="4" autocomplete="off" data-year="1" data-rep="' + f.id + '" data-i="' + i + '" data-k="' + sf.k + '" value="' + (yns ? '' : esc(sv)) + '" placeholder="' + esc(sf.ph || 'e.g. 1995') + '"' + (yns ? ' disabled' : '') + '>' +
                  '<label class="chk yns"><input type="checkbox" data-yns="1" data-rep="' + f.id + '" data-i="' + i + '" data-k="' + sf.k + '"' + (yns ? ' checked' : '') + '> I\'m not sure</label></div>'; }
              var vs = sf.vin ? (S.vin[f.id + ':' + i] || {}) : null;
              return '<div class="f' + (sf.cls ? ' ' + sf.cls : '') + '"><label class="lbl">' + esc(sf.l) + '</label>' + (sf.hint ? '<p class="hint">' + esc(sf.hint) + '</p>' : '') + '<input type="' + (sf.t || 'text') + '"' + (sf.t === 'date' ? ' max="' + new Date().toISOString().slice(0, 10) + '"' : '') + (sf.im ? ' inputmode="' + sf.im + '"' : '') + ' data-rep="' + f.id + '" data-i="' + i + '" data-k="' + sf.k + '" value="' + esc(sv) + '"' + (sf.ph ? ' placeholder="' + esc(sf.ph) + '"' : '') +
                (sf.vin ? ' maxlength="17" autocapitalize="characters" autocomplete="off" spellcheck="false" data-vin="1"' : '') + '>' +
                (sf.vin ? '<p class="vin-stat ' + (vs.cls || '') + '" data-vinstat="' + f.id + ':' + i + '" aria-live="polite">' + (vs.msg || '') + '</p>' + vinConfirmHtml(f, it, i) : '') + '</div>';
            }).join('') + '</div>';
        }).join('') + '<button type="button" class="linkbtn" data-add="' + f.id + '">' + esc(f.addLabel || ('+ Add another ' + f.itemLabel.toLowerCase())) + '</button>') +
          '<div>' + unsureChip(f, f.unsureLabel || 'I\'m not sure yet – my agent can help') + '</div>';
        break;
      case 'upload':
        h = '<label class="drop" for="f_upl"><span style="font-size:2rem" aria-hidden="true">📄</span><b>' + esc(f.label) + '</b><span class="hint">Photo or PDF. Snap a picture of your declarations page.</span>' +
          '<input id="f_upl" type="file" accept="image/*,application/pdf" data-upload="1"></label>' +
          (S.uploadNote ? '<div class="filenote">' + S.uploadNote + '</div>' : '') +
          (S.uploadNote ? '' : '<p class="hint up-rules">PDF, JPG, PNG or HEIC, up to 10 MB. It goes privately to your agent.</p>');
        break;
      case 'bizsearch':
        h = renderBiz(f);
        break;
      case 'vehcov':
        h = lbl(f) + renderVehCov(f);
        break;
      case 'secret':
        var sk = f.id, shownS = !!S.dlShow[sk], provided = !!S.a[sk + '_provided'];
        h = lbl(f) + '<div class="pw"><input id="f_' + sk + '" type="' + (shownS ? 'text' : 'password') + '" inputmode="numeric" autocomplete="off" spellcheck="false" data-secret="' + sk + '" value="' + (uns ? '' : esc(S.secret[sk] || '')) + '"' + (uns ? ' disabled' : '') + ' placeholder="Optional" maxlength="12">' +
          '<button type="button" class="eye" data-dleye="' + sk + '" aria-label="' + (shownS ? 'Hide' : 'Show') + ' ' + esc(f.label) + '" aria-pressed="' + shownS + '"' + (uns ? ' disabled' : '') + '>' + (shownS ? '🙈' : '👁') + '</button></div>' +
          (provided && !uns && !S.secret[sk] ? '<p class="hint">Entered earlier (ends in ' + esc(S.a[sk + '_last2'] || '') + '). Type it again only if you want to change it.</p>' : '') + unsureChip(f);
        break;
    }
    if (woodOn(f)) h += woodLocHtml(f.woodLoc, S.a[f.woodLoc], 'data-in="' + f.woodLoc + '"');
    return '<div class="f" data-field="' + f.id + '">' + h + '</div>';
  }

  // ---------- driver's license (PREVIEW DATA RULE: full number lives only in the input / memory; never saved or sent) ----------
  var STATES = 'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ');
  function renderDL(f, it, i) {
    var key = f.id + ':' + i, agent = !!it.dlAgent, shown = !!S.dlShow[key], full = S.dlFull[key] || '';
    var st = it.dlState || 'MN';
    return '<div class="f dl"><label class="lbl" for="dl_' + f.id + '_' + i + '">Driver\'s license number <span class="hint" style="font-weight:400">(optional)</span></label>' +
      '<div class="dl-row"><div class="pw"><input id="dl_' + f.id + '_' + i + '" type="' + (shown ? 'text' : 'password') + '" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" data-dl="' + f.id + '" data-i="' + i + '" value="' + (agent ? '' : esc(full)) + '"' + (agent ? ' disabled' : '') + ' placeholder="Optional">' +
      '<button type="button" class="eye" data-dleye="' + key + '" aria-label="' + (shown ? 'Hide' : 'Show') + ' license number" aria-pressed="' + shown + '"' + (agent ? ' disabled' : '') + '>' + (shown ? '🙈' : '👁') + '</button></div>' +
      '<select aria-label="License state" data-rep="' + f.id + '" data-i="' + i + '" data-k="dlState"' + (agent ? ' disabled' : '') + '>' + STATES.map(function (x) { return '<option' + (x === st ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>' +
      '<p class="hint" style="margin:.35rem 0 0">Optional — your license number helps us get an accurate quote.</p>' +
      '<button type="button" class="chip' + (agent ? ' on' : '') + '" data-dlagent="' + f.id + '" data-i="' + i + '" aria-pressed="' + agent + '">' + (agent ? '✓ ' : '') + 'I\'ll give it to my agent</button></div>';
  }
  function dlLabel(it) { return it && it.dlProvided && !it.dlAgent ? 'License: provided' : 'License: agent will ask'; }

  // ---------- VIN confirm (Variant A): one tap "Is this your 2003 Honda Accord? Correct / Edit" ----------
  function vehName(it) { return [it.year, it.make, it.model, it.trim].filter(Boolean).join(' '); }
  // ---------- boat motors: repeatable inside each boat card ('+ Add another motor') ----------
  var MOTOR_K = [['year', 'Year', 'numeric', 'e.g. 2019'], ['make', 'Make', '', 'e.g. Mercury'], ['model', 'Model number', '', 'e.g. F115ELPT'], ['serial', 'Serial number', '', 'Optional'], ['hp', 'Horsepower', 'numeric', 'e.g. 115']];
  function renderMotors(f, it, i, sf) {
    var ms = Array.isArray(it.motors) && it.motors.length ? it.motors : [{}];
    return '<div class="motors">' + ms.map(function (m, j) {
      return '<div class="motor"><p class="rep-hd">Motor ' + (j + 1) + (ms.length > 1 ? ' <button type="button" class="linkbtn rm" data-rmmotor="' + f.id + '" data-i="' + i + '" data-m="' + j + '">Remove</button>' : '') + '</p><div class="motor-g">' +
        MOTOR_K.map(function (k) { var mv = (m || {})[k[0]] || '', mns = k[0] === 'year' && mv === 'Not sure';
          return '<div class="f"><label class="lbl">' + k[1] + '</label><input type="text"' + (k[2] ? ' inputmode="' + k[2] + '"' : '') + (k[0] === 'year' ? ' maxlength="4" autocomplete="off" data-year="1"' : '') + ' data-rep="' + f.id + '" data-i="' + i + '" data-k="motors" data-m="' + j + '" data-mk="' + k[0] + '" value="' + (mns ? '' : esc(mv)) + '" placeholder="' + esc(k[3]) + '"' + (mns ? ' disabled' : '') + '>' +
            (k[0] === 'year' ? '<label class="chk yns"><input type="checkbox" data-myns="1" data-rep="' + f.id + '" data-i="' + i + '" data-k="motors" data-m="' + j + '"' + (mns ? ' checked' : '') + '> I\'m not sure</label>' : '') + '</div>'; }).join('') + '</div></div>';
    }).join('') + '<button type="button" class="linkbtn" data-addmotor="' + f.id + '" data-i="' + i + '">+ Add another motor</button></div>';
  }
  function motorsLabel(it) {
    return (Array.isArray(it.motors) ? it.motors : []).map(function (m) { return [m.year === 'Not sure' ? "year: I'm not sure" : m.year, m.make, m.model, m.hp ? m.hp + ' hp' : '', m.serial ? 'serial ' + m.serial : ''].filter(Boolean).join(' '); }).filter(Boolean).map(function (x) { return 'Motor: ' + x; }).join(' · ');
  }
  // HIN (hull ID): light format check only – 12 letters/numbers; standard US format is MIC(3 letters) + serial(5) + month letter + year digit + model year(2)
  function hinCheck(fid, i, v) {
    var key = fid + ':' + i + ':hin';
    if (!v) return setVinStat(key, '', '');
    if (v.length < 12) return setVinStat(key, v.length + '/12 characters', '');
    if (/^[A-Z]{3}[A-Z0-9]{5}[A-L][0-9]{3}$/.test(v)) return setVinStat(key, '✓ Looks like a standard hull ID', 'ok');
    setVinStat(key, 'That isn\'t the usual hull ID pattern. Double-check it, or leave it – your agent can confirm.', '');
  }
  function vinConfirmHtml(f, it, i) {
    if (!CFG.vinConfirm || !it.vinDecoded) return '';
    if (it.vinConfirmed === true) return '<div class="vin-ok" data-vinbox="' + f.id + ':' + i + '"><span>✓ <b>' + esc(vehName(it)) + '</b> – confirmed</span><button type="button" class="linkbtn" data-vinedit="' + f.id + '" data-i="' + i + '">Edit</button></div>';
    if (it.vinConfirmed === 'edit') return '';
    return '<div class="vin-confirm" data-vinbox="' + f.id + ':' + i + '" role="group" aria-label="Confirm your vehicle"><p class="vc-q">Is this your vehicle?</p>' +
      '<p class="vc-veh"><b>' + esc(vehName(it)) + '</b>' + (it.body ? '<br><span>' + esc(it.body) + '</span>' : '') + '</p>' +
      '<div class="vc-btns"><button type="button" class="btn btn-green" data-vinok="' + f.id + '" data-i="' + i + '">✓ Yes</button>' +
      '<button type="button" class="btn btn-ghost" data-vinedit="' + f.id + '" data-i="' + i + '">Edit</button></div></div>';
  }
  // ---------- Year -> Make -> Model dropdowns from NHTSA vPIC (via /api/vehicle; cached in memory + CDN). Free typing fallback. ----------
  var VP = { makes: null, byName: {}, models: {}, loadingMakes: false };
  var POPULAR = ['Chevrolet', 'Ford', 'GMC', 'Ram', 'Toyota', 'Honda', 'Jeep', 'Subaru', 'Dodge', 'Nissan', 'Hyundai', 'Kia', 'Chrysler', 'Buick', 'Volkswagen', 'Mazda', 'Tesla', 'Lincoln', 'Cadillac'];
  function loadMakes() {
    if (VP.makes || VP.loadingMakes) return; VP.loadingMakes = true;
    fetch('/api/vehicle?op=makes').then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok || !j.makes || !j.makes.length) throw 0;
      VP.makes = j.makes; j.makes.forEach(function (m) { VP.byName[m.name.toLowerCase()] = m.id; });
    }).catch(function () { VP.makes = false; }).then(function () { VP.loadingMakes = false; if (S && !S.done) render(false); });
  }
  function loadModels(key, id, yr) {
    if (VP.models[key] !== undefined) return; VP.models[key] = 'loading';
    fetch('/api/vehicle?op=models&makeId=' + id + '&year=' + yr).then(function (r) { return r.json(); }).then(function (j) {
      VP.models[key] = j && j.ok && j.models && j.models.length ? j.models : false;
    }).catch(function () { VP.models[key] = false; }).then(function () { render(false); });
  }
  function ymmSel(f, i, k, inner, disabled) { return '<select data-rep="' + f.id + '" data-i="' + i + '" data-k="' + k + '" data-ymm="1"' + (disabled ? ' disabled' : '') + '>' + inner + '</select>'; }
  function typedInput(f, it, i, sf, back) {
    return '<input type="text" data-rep="' + f.id + '" data-i="' + i + '" data-k="' + sf.k + '" value="' + esc(it[sf.k] || '') + '" placeholder="' + esc(sf.ph || '') + '">' +
      (back ? '<button type="button" class="linkbtn" data-ymmlist="' + f.id + '" data-i="' + i + '" data-k="' + sf.k + '">Pick from the list instead</button>' : '');
  }
  function renderMake(f, it, i, sf) {
    var head = '<div class="f"><label class="lbl">' + esc(sf.l) + '</label>';
    if (VP.makes === null) loadMakes();
    if (it.makeTyped || VP.makes === false) return head + typedInput(f, it, i, sf, VP.makes && it.makeTyped) + '</div>';
    if (!VP.makes) return head + ymmSel(f, i, 'make', '<option>Loading makes…</option>', true) + '</div>';
    var cur = it.make || '', known = !!VP.byName[cur.toLowerCase()], opt = function (n) { return '<option' + (cur.toLowerCase() === n.toLowerCase() ? ' selected' : '') + '>' + esc(n) + '</option>'; };
    return head + ymmSel(f, i, 'make', '<option value="">Choose a make…</option>' + (cur && !known ? '<option selected>' + esc(cur) + '</option>' : '') +
      '<optgroup label="Popular">' + POPULAR.filter(function (n) { return VP.byName[n.toLowerCase()]; }).map(opt).join('') + '</optgroup>' +
      '<optgroup label="All makes">' + VP.makes.map(function (m) { return '<option>' + esc(m.name) + '</option>'; }).join('') + '</optgroup>' +
      '<option value="__type__">Not listed – I\'ll type it</option>') + '</div>';
  }
  function renderModel(f, it, i, sf) {
    var head = '<div class="f"><label class="lbl">' + esc(sf.l) + '</label>';
    var id = VP.makes && it.make ? VP.byName[it.make.toLowerCase()] : null, yr = /^\d{4}$/.test(it.year || '') ? it.year : null;
    if (it.modelTyped || it.makeTyped || VP.makes === false) return head + typedInput(f, it, i, sf, !!(id && yr) && it.modelTyped) + '</div>';
    if (!VP.makes || !id || !yr) {
      if (it.model) return head + typedInput(f, it, i, sf, false) + '</div>';
      return head + ymmSel(f, i, 'model', '<option>' + (!VP.makes ? 'Loading…' : 'Pick a year and make first') + '</option>', true) + '</div>';
    }
    var key = id + '|' + yr, list = VP.models[key];
    if (list === undefined) { loadModels(key, id, yr); list = 'loading'; }
    if (list === 'loading') return head + ymmSel(f, i, 'model', '<option>Loading models…</option>', true) + '</div>';
    if (list === false) return head + typedInput(f, it, i, sf, false) + '</div>';
    var cur = it.model || '';
    return head + ymmSel(f, i, 'model', '<option value="">Choose a model…</option>' + (cur && list.indexOf(cur) < 0 ? '<option selected>' + esc(cur) + '</option>' : '') +
      list.map(function (m) { return '<option' + (m === cur ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('') +
      '<option value="__type__">Not listed – I\'ll type it</option>') + '<p class="hint" style="margin:.3rem 0 0">Lists from NHTSA (U.S. DOT).</p></div>';
  }

  // ISO 3779 / 49 CFR 565 check digit (position 9): transliterate, weight, sum mod 11 (10 = "X").
  var VIN_TR = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9, S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9 };
  var VIN_W = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  function vinCheckDigitOk(v) {
    var sum = 0;
    for (var k = 0; k < 17; k++) { var c = v.charAt(k), n = /\d/.test(c) ? +c : VIN_TR[c]; if (n == null) return false; sum += n * VIN_W[k]; }
    var r = sum % 11;
    return v.charAt(8) === (r === 10 ? 'X' : String(r));
  }

  // ---------- per-vehicle auto coverage (Variant A/B): stored on each vehicle as it.cov ----------
  // old forms' carrier dropdowns, offered as type-ahead suggestions (free text still allowed)
  // Round 7: ONE shared option list per building system, used by home, landlord/rental, cabin, outbuildings and business.
  // Values are stable keys; business repeater selects store the labels. "I'm not sure" is appended by each field.
  var SYS = {
    roof: [{ v: 'asphalt', l: 'Asphalt shingle' }, { v: 'architectural', l: 'Architectural shingle' }, { v: 'metal', l: 'Metal' }, { v: 'epdm', l: 'Rubber / EPDM' }, { v: 'shake', l: 'Wood shake' }, { v: 'tile', l: 'Tile' }, { v: 'tpo', l: 'TPO (flat)' }, { v: 'other', l: 'Other' }],
    siding: [{ v: 'vinyl', l: 'Vinyl' }, { v: 'wood', l: 'Wood' }, { v: 'fibercement', l: 'Fiber cement' }, { v: 'brick', l: 'Brick' }, { v: 'stucco', l: 'Stucco' }, { v: 'steel', l: 'Steel / aluminum' }, { v: 'log', l: 'Log' }, { v: 'other', l: 'Other' }],
    elec: [{ v: 'breakers', l: 'Circuit breakers' }, { v: 'b100', l: 'Circuit breakers – 100 amp' }, { v: 'b200', l: 'Circuit breakers – 200 amp' }, { v: 'fuses', l: 'Fuses' }, { v: 'knobtube', l: 'Knob and tube' }, { v: 'aluminum', l: 'Aluminum wiring' }, { v: 'other', l: 'Other' }],
    plumb: [{ v: 'pex', l: 'PEX' }, { v: 'copper', l: 'Copper' }, { v: 'galvanized', l: 'Galvanized' }, { v: 'pvc', l: 'PVC / CPVC' }, { v: 'polybutylene', l: 'Polybutylene' }, { v: 'castiron', l: 'Cast iron' }, { v: 'other', l: 'Other' }],
    heat: [{ v: 'gasforced', l: 'Forced air – natural gas' }, { v: 'propane', l: 'Forced air – propane' }, { v: 'oil', l: 'Oil' }, { v: 'baseboard', l: 'Electric (baseboard / forced air)' }, { v: 'boiler', l: 'Boiler / hot water / in-floor' }, { v: 'geo', l: 'Heat pump / geothermal' }, { v: 'woodprimary', l: 'Wood / pellet stove' }, { v: 'other', l: 'Other' }]
  };
  SYS.bizHvacExtra = [{ v: 'rooftop', l: 'Rooftop unit' }, { v: 'radiant', l: 'Radiant / unit heaters' }];
  var CARRIERS = ["AAA Insurance", "Acuity Insurance", "Allstate", "American Family Insurance", "American National", "Amica Mutual Insurance", "Auto-Owners Insurance", "Berkley Insurance", "Bristol West", "Chubb", "Cincinnati Insurance", "Citizens Insurance", "Country Financial", "CSAA Insurance (AAA)", "Dairyland Insurance", "Direct General", "Erie Insurance", "Esurance", "Farm Bureau Insurance", "Farmers Insurance", "Federated Insurance", "First American", "GEICO", "Grinnell Mutual", "Hastings Mutual", "Horace Mann", "IMT Insurance", "Infinity Insurance", "Kemper Insurance", "Liberty Mutual", "Markel", "Mercury Insurance", "MetLife", "National Farmers Union", "National General", "Nationwide", "North Star Mutual", "Plymouth Rock Assurance", "Progressive", "QBE Insurance", "Safeco", "Sentry Insurance", "Shelter Insurance", "State Auto", "State Farm", "Travelers", "USAA", "Utica National", "Wawanesa Insurance", "Western National", "Zurich Insurance", "Other", "None \u2013 I don't have insurance now"];
  var VC = {
    // Round 6: no "Match my current coverage". Vehicle 1 shows the choices directly; later vehicles can copy vehicle 1.
    mode: { l: 'Coverage', opts: [['same', 'Same as vehicle 1'], ['pick', 'Let me pick']] },
    liab: { l: 'Liability limits', opts: [['min', 'State minimum'], ['25/50', '25/50'], ['50/100', '50/100'], ['100/300', '100/300', 'Common choice'], ['250/500', '250/500'], ['500/500', '500/500']] },
    // Round 10: UM/UIM added (the standalone Auto form never asked it)
    um: { l: 'Uninsured / underinsured motorist (UM/UIM)', opts: [['25/50', '25/50 (MN minimum)'], ['50/100', '50/100'], ['100/300', '100/300', 'Common choice'], ['250/500', '250/500'], ['same', 'Same as my liability']] },
    comp: { l: 'Comprehensive deductible (theft, hail, deer)', opts: [['none', 'No comprehensive'], ['100', '$100'], ['250', '$250'], ['500', '$500', 'Common choice'], ['1000', '$1,000'], ['2500', '$2,500']] },
    coll: { l: 'Collision deductible', opts: [['none', 'No collision'], ['100', '$100'], ['250', '$250'], ['500', '$500', 'Common choice'], ['1000', '$1,000'], ['2500', '$2,500']] },
    glass: { l: 'Full glass coverage', opts: [['yes', 'Yes'], ['no', 'No']] },
    rental: { l: 'Rental car while yours is in the shop', opts: [['no', 'No'], ['20', 'Up to $20/day'], ['30', 'Up to $30/day', 'Common choice'], ['50', 'Up to $50/day']] },
    tow: { l: 'Towing & roadside', opts: [['yes', 'Yes'], ['no', 'No']] },
    gap: { l: 'Gap coverage (loan or lease)', opts: [['yes', 'Yes'], ['no', 'No']] }
  };
  // Round 10 (Josh): policy-level coverages (liability, UM/UIM, medical/PIP) are asked ONCE on the "Policy coverages"
  // screen (fields autoLiab / autoUM / autoPIP); only vehicle-level coverages are asked per vehicle.
  var VCK = ['comp', 'coll', 'glass', 'rental', 'tow', 'gap'];
  VCK.forEach(function (k) { VC[k].opts.push([UNSURE, "I'm not sure"]); });
  var NS = { v: UNSURE, l: "I'm not sure", unsure: true };
  var pol = function (k) { return VC[k].opts.map(function (x) { return { v: x[0], l: x[1], s: x[2], common: !!x[2] }; }).concat([NS]); };
  var AUTO_POL = { liab: pol('liab'), um: pol('um'),
    pip: [{ v: '40k', l: '$40,000 (MN minimum)', s: '$20k medical + $20k income/other' }, { v: '80k', l: '$80,000', s: 'Common choice', common: true }, { v: '100k+', l: '$100,000 or more' }, NS] };
  var POLK = [['autoLiab', 'Liability (bodily injury / property damage)'], ['autoUM', 'Uninsured / underinsured motorist (UM/UIM)'], ['autoPIP', 'Medical / PIP (personal injury protection)']];
  function polLabel(k) { var v = S.a[k], f = findField(k); return v === UNSURE ? "I'm not sure" : v ? optLabel(f, v) : 'Skipped'; }
  function vcVal(c, k) { return c[k] === UNSURE ? "I'm not sure" : c[k] ? vcLabel(k, c[k]) : ''; }
  // per-vehicle rows for Review / payload: [{vehicle, rows:[[label, value]]}]
  function vehCovBlocks() {
    var ts = vcTargets(), c0 = ts[0] && ts[0].cov;
    return ts.map(function (t, n) {
      var c = t.cov, src = n > 0 && c.mode === 'same' ? c0 : c;
      var rows = VCK.map(function (k) { if (k === 'gap' && !gapApplies(t)) return null; var x = vcVal(src, k); return x ? [VC[k].l.replace(/ while.*| \(.*\)/, ''), x] : null; }).filter(Boolean);
      return { vehicle: t.label, same: n > 0 && c.mode === 'same', rows: rows };
    });
  }
  function vcTargets() {
    var vs = Array.isArray(S.a.vehicles) ? S.a.vehicles.filter(function (x) { return x; }) : [];
    if (!vs.length) { S.a.autoCovAll = S.a.autoCovAll || {}; return [{ label: 'Your vehicles', cov: S.a.autoCovAll, i: 0 }]; }
    return vs.map(function (it, i) { it.cov = it.cov || {}; return { label: vehName(it) || ('Vehicle ' + (i + 1)), cov: it.cov, i: i }; });
  }
  function vcTiles(i, k, cov, first) {
    var o = VC[k].opts.filter(function (x) { return !(x[0] === 'same' && first); });
    return '<p class="lbl" style="margin:.7rem 0 .35rem">' + esc(VC[k].l) + '</p><div class="tiles cols2" role="group" aria-label="' + esc(VC[k].l) + '">' + o.map(function (x) {
      var on = cov[k] === x[0];
      return '<button type="button" class="tile' + (x[0] === 'unsure' ? ' unsure' : '') + (on ? ' on' : '') + '" data-vc="' + i + '" data-vk="' + k + '" data-v="' + x[0] + '" aria-pressed="' + on + '"><span class="tx">' + esc(x[1]) + (x[2] ? '<small class="common">' + esc(x[2]) + '</small>' : '') + '</span><span class="ck"></span></button>';
    }).join('') + '</div>';
  }
  // Round 10 (Josh 2:32 PM): same pattern as B Business "Coverage details" (biz9): one coverage question per screen,
  // the shared .tiles.cols2 > button.tile cards (44px+ targets, check circle, "Common choice" marked), auto-advance when answered.
  // A field with vk asks that one vehicle-level coverage, with one labeled tile group per vehicle (year make model).
  function gapApplies(t) { var it = (S.a.vehicles || []).filter(function (x) { return x; })[t.i]; return !it || it.ownership !== 'Owned outright'; }
  function vkTargets(vk) { return vcTargets().filter(function (t) { return vk !== 'gap' || gapApplies(t); }); }
  function vkDone(f) { return vkTargets(f.vk).every(function (t) { return !!t.cov[f.vk]; }); }
  function renderVehCovQ(f) {
    var ts = vkTargets(f.vk), one = ts.length === 1;
    return ts.map(function (t) {
      var o = VC[f.vk].opts;
      return '<div class="f vcq"><p class="lbl vcq-veh">' + esc(t.label) + '</p><div class="tiles cols2" role="group" aria-label="' + esc(VC[f.vk].l + ' – ' + t.label) + '">' + o.map(function (x) {
        var on = t.cov[f.vk] === x[0];
        return '<button type="button" class="tile' + (x[0] === UNSURE ? ' unsure' : '') + (on ? ' on' : '') + '" data-vc="' + t.i + '" data-vk="' + f.vk + '" data-v="' + x[0] + '" aria-pressed="' + on + '"><span class="tx">' + esc(x[1]) + (x[2] ? '<small class="common">' + esc(x[2]) + '</small>' : '') + '</span><span class="ck"></span></button>';
      }).join('') + '</div></div>';
    }).join('') + (one ? '' : '');
  }
  function renderVehCov(f) {
    if (f.vk) return renderVehCovQ(f);
    return vcTargets().map(function (t, n) {
      var c = t.cov, h = '<div class="rep-item vc-item"><h4>' + esc(t.label) + '</h4>' + (n === 0 ? '' : vcTiles(t.i, 'mode', c, false));
      if (n === 0 || c.mode === 'pick') h += VCK.map(function (k) { return vcTiles(t.i, k, c); }).join('');
      return h + '</div>';
    }).join('');
  }
  function vcLabel(k, v) { var m = VC[k].opts.filter(function (x) { return x[0] === v; })[0]; return m ? m[1] : ''; }
  function autoCoverageObj() {
    var o = { policy: {}, vehicles: [] };
    POLK.forEach(function (p) { o.policy[p[1]] = polLabel(p[0]); });
    vehCovBlocks().forEach(function (b) { var v = { vehicle: b.vehicle }; if (b.same) v.sameAsVehicle1 = true; b.rows.forEach(function (r) { v[r[0]] = r[1]; }); if (!b.rows.length) v.note = 'Skipped – agent will help'; o.vehicles.push(v); });
    return o;
  }
  function autoCoverageText() {
    var o = autoCoverageObj();
    return 'Policy coverages – ' + Object.keys(o.policy).map(function (k) { return k + ': ' + o.policy[k]; }).join('; ') +
      o.vehicles.map(function (v) { return ' | ' + v.vehicle + ' – ' + (Object.keys(v).filter(function (k) { return k !== 'vehicle'; }).map(function (k) { return k === 'sameAsVehicle1' ? 'Same as vehicle 1' : k === 'note' ? v[k] : k + ': ' + v[k]; }).join('; ')); }).join('');
  }
  function vehCovDisplay() {
    var ts = vcTargets(), any = false;
    var s = ts.map(function (t) {
      var c = t.cov, picks = VCK.some(function (k) { return c[k]; });
      if (c.mode === 'match') c.mode = ''; // old saved answers
      if (!c.mode && !picks) return t.label + ': skipped';
      any = true;
      if (c.mode && c.mode !== 'pick') return t.label + ': ' + vcLabel('mode', c.mode);
      return t.label + ': ' + VCK.map(function (k) { return c[k] ? VC[k].l.replace(/ while.*| \(.*\)/, '') + ': ' + vcVal(c, k) : null; }).filter(Boolean).join(', ');
    }).join(' / ');
    return any ? s : '';
  }

  // ---------- business search ----------
  var INDUSTRIES = null, LOCAL_PICKS = [
    { l: 'Contractors – residential remodeling & building', q: 'Residential Remodeling', ids: ['27', '25'] },
    { l: 'Excavating, grading & earthmoving', ids: ['559', '38'] },
    { l: 'Lodging & resorts (lodges, cabins, B&Bs, campgrounds)', ids: ['474', '473', '471', '475'] },
    { l: 'Nonprofits (civic, religious, social, advocacy)', ids: ['505', '502', '504', '503'] }
  ];
  var HARD = /mining|quarr|oil & gas|explosive|demolition|casino|gambling|aviation|aircraft|cannabis|crypto|firearm|ammunition|fireworks|tattoo|bridge and tunnel|abatement|hazardous|long-distance|nuclear|blasting/i;
  function loadIndustries() {
    if (INDUSTRIES) return Promise.resolve(INDUSTRIES);
    return fetch('/assets/quote-flow/industries.min.json').then(function (r) { return r.json(); }).then(function (d) { INDUSTRIES = d; return d; }).catch(function () { INDUSTRIES = []; return []; });
  }
  function byId(id) { return (INDUSTRIES || []).filter(function (x) { return x.id === id; })[0]; }
  function renderBiz(f) {
    var v = S.a[f.id], uns = v === UNSURE;
    var out = lbl(f);
    if (v && !uns) {
      out += '<div class="bz-picked"><span>' + esc(S.a[f.id + '_label']) + '</span><button type="button" class="linkbtn" data-bzclear="' + f.id + '">Change</button></div>';
      if (S.a[f.id + '_hard']) out += '<div class="note-warn">An agent will call you about this one. Some carriers are picky with this type of business, so we\'ll talk it through. You can keep going.</div>';
    } else if (!uns) {
      out += '<input id="f_' + f.id + '" type="text" data-bzq="' + f.id + '" placeholder="Search: e.g. plumber, resort, bakery" autocomplete="off" value="' + esc(S.bzq || '') + '"><ul class="bz-res" data-bzres="' + f.id + '"></ul>';
    }
    return out + unsureChip(f, "I'm not sure what to pick – my agent can help");
  }
  function bizResults(f) {
    var ul = $('[data-bzres="' + f.id + '"]', root); if (!ul) return;
    var q = (S.bzq || '').trim().toLowerCase(), html = '';
    if (!INDUSTRIES) { ul.innerHTML = '<li class="hd">Loading…</li>'; loadIndustries().then(function () { bizResults(f); }); return; }
    if (!q) {
      html += '<li class="hd">Popular around Grand Rapids & the Iron Range</li>';
      LOCAL_PICKS.forEach(function (p) { p.ids.forEach(function (id, i) { var x = byId(id); if (x) html += bzItem(x, i === 0 ? p.l : null); }); });
      html += '<li class="hd">All business types</li>';
      INDUSTRIES.slice(0, 60).forEach(function (x) { html += bzItem(x); });
      html += '<li class="hd">Type to search all ' + INDUSTRIES.length + ' types</li>';
    } else {
      var terms = q.split(/\s+/);
      var localIds = [].concat.apply([], LOCAL_PICKS.map(function (p) { return p.ids; }));
      var res = INDUSTRIES.filter(function (x) { var s = (x.l + ' ' + x.g + ' ' + x.d + ' ' + x.k).toLowerCase(); return terms.every(function (t) { return s.indexOf(t) > -1; }); });
      res.sort(function (a, b) { return (localIds.indexOf(b.id) > -1) - (localIds.indexOf(a.id) > -1); });
      html = res.slice(0, 40).map(function (x) { return bzItem(x); }).join('') || '<li class="hd">No match. Try another word, or tap "I\'m not sure" below.</li>';
    }
    ul.innerHTML = html;
  }
  function bzItem(x, head) {
    return '<li><button type="button" data-bzpick="' + x.id + '">' + (head ? '<small style="color:#00a651;font-weight:700">★ ' + esc(head) + '</small>' : '') + esc(x.l) + '<small>' + esc(x.g) + '</small></button></li>';
  }

  // ---------- screen rendering ----------
  function stepsHtml(vis, cur) {
    if (CFG.progress === 'percent') {
      var flowLen = vis.filter(function (s) { return s.kind !== 'confirm'; }).length;
      var pct = Math.round(Math.min(100, (vis.indexOf(cur) / Math.max(1, flowLen - 1)) * 100));
      return '<div class="pbar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div><p class="pct">' + pct + '% done</p>';
    }
    var steps = [];
    vis.forEach(function (s) { if (s.step && s.kind !== 'confirm' && steps.indexOf(s.step) < 0) steps.push(s.step); });
    var ci = steps.indexOf(cur.step);
    // sub-steps: long sections (e.g. Business, 10 screens) show "Business · 3 of 10" and the bar moves on every screen
    var inStep = vis.filter(function (s) { return s.step === cur.step && s.kind !== 'confirm'; }), si = inStep.indexOf(cur), sn = inStep.length;
    var subTxt = sn > 1 && si > -1 ? ' · ' + (si + 1) + ' of ' + sn : '';
    var pctS = Math.round(((ci + (sn > 1 && si > -1 ? (si + 1) / sn : 1)) / steps.length) * 100);
    return '<div class="steps-compact" aria-hidden="true"><div class="sc-row"><b>Step ' + (ci + 1) + ' of ' + steps.length + '</b> · ' + esc(cur.step) + '<span class="substep">' + subTxt + '</span></div><div class="pbar"><i style="width:' + pctS + '%"></i></div></div>' +
      '<ol class="steps" aria-label="Progress: step ' + (ci + 1) + ' of ' + steps.length + (subTxt ? ', screen ' + (si + 1) + ' of ' + sn + ' in ' + esc(cur.step) : '') + '">' + steps.map(function (st, i) { return '<li class="' + (i < ci ? 'done' : i === ci ? 'on' : '') + '"' + (i === ci ? ' aria-current="step"' : '') + '>' + esc(st) + (i === ci && subTxt ? '<span class="substep">' + subTxt + '</span>' : '') + '</li>'; }).join('') + '</ol>' +
      '<div class="pbar desk" aria-hidden="true"><i style="width:' + pctS + '%"></i></div>';
  }

  function render(scrollTop) {
    var vis = visibleScreens(), cur = screenById(S.cur) || vis[0];
    S.cur = cur.id;
    var title = typeof cur.title === 'function' ? cur.title(S.a) : cur.title;
    var sub = typeof cur.sub === 'function' ? cur.sub(S.a) : cur.sub;
    if (cur.encourage) sub = '<b class="enc">These help us give you an accurate price.</b> ' + (sub ? String(sub).replace(/^These help us give you an accurate price\.\s*/, '') : 'Best guesses are fine, and "I\'m not sure" is OK.');
    var body = '';
    if (cur.kind === 'review') body = renderReview();
    else if (cur.kind === 'confirm') body = renderConfirm();
    else if (cur.kind === 'checkpoint') body = renderCheckpoint();
    else body = cur.fields.map(renderField).join('');

    var idx = vis.indexOf(cur), isFirst = idx === 0, isConfirm = cur.kind === 'confirm';
    var saved = lsGet(SAVE_KEY, null);
    var top = '';
    if (isFirst) {
      var hasSave = !!(saved && saved.a);
      top += '<div class="resume"><span>' + (hasSave ? 'Started a quote on this device?' : '<span class="nosave" id="nosave">No saved quote on this device yet</span>') + '</span>' +
        '<button type="button" class="btn btn-ghost" style="min-height:44px;padding:.4rem 1rem" data-act="resume"' + (hasSave ? '' : ' aria-describedby="nosave"') + '>Continue previous quote</button></div>';
    }
    if (cur.intro) top += cur.intro;
    // "Change products" – always one tap back to the picker (answers for products still selected are kept)
    if (screenById('products') && S.visited.indexOf('contact') > -1 && !cur.kind) {
      var pn = prods(S.a).map(function (p) { var m = PRODUCTS.filter(function (x) { return x.v === p; })[0]; return m ? m.l : p; }).join(', ');
      top += '<div class="prodbar"><span>Quoting: <b>' + esc(pn || 'I\'m not sure yet') + '</b></span><button type="button" class="linkbtn" data-act="chprod">Change products</button></div>';
    }
    var trust = cur.kind === 'contact' && CFG.trustStrip ? '<ul class="trust" aria-label="Why Chandler"><li><span aria-hidden="true">📍</span>Local agents since 1977 · Grand Rapids &amp; Virginia, MN</li><li><span aria-hidden="true">🔒</span>We never sell your info</li><li><span aria-hidden="true">🚫</span>No spam</li></ul>' : '';

    var html = (isConfirm ? '' : stepsHtml(vis, cur)) + '<div class="card">' + top +
      (title ? '<h1 class="q" tabindex="-1">' + esc(title) + '</h1>' : '') + (sub ? '<p class="sub">' + sub + '</p>' : '') + trust +
      '<div class="errbox"></div>' + body;
    if (!isConfirm) {
      var showSave = idx > (CFG.saveFrom || 1);
      html += '<div class="subnav">' +
        (cur.kind !== 'review' && cur.kind !== 'checkpoint' && cur.skippable !== false && !isFirst && cur.kind !== 'contact' && body.indexOf('data-unsure=') < 0 ? '<button type="button" class="linkbtn" data-act="skip">Skip, my agent can help →</button>' : '<span></span>') +
        (showSave ? '<button type="button" class="linkbtn quiet" data-act="save">Save and finish later</button>' : '') + '</div>';
      if (isFirst) html += '<div class="contact-strip">Rather talk? Call <a href="' + TEL + '">' + PHONE + '</a> (Grand Rapids) or <a href="tel:2187419582">(218) 741-9582</a> (Virginia).<br>Mon–Thu 8:30–5, Fri 8:30–3:30.</div>';
    }
    html += '</div>';
    if (!isConfirm) {
      var hideCont = CFG.autoAdvance && autoAdvanceField(cur);
      html += '<div class="nav"><div class="wrap">' +
        (!isFirst ? '<button type="button" class="btn btn-back" data-act="back" aria-label="Back">← Back</button>' : '') +
        (cur.kind === 'checkpoint' ? '' : '<button type="button" class="btn ' + (cur.kind === 'review' ? 'btn-green' : 'btn-primary') + '" data-act="next" style="flex:1' + (hideCont ? ';opacity:.92' : '') + '">' +
        esc(cur.kind === 'review' ? 'Send to my agent' : cur.kind === 'products' && S.returnTo ? 'Update products' : (S.editing ? (editNextId() ? 'Next question in this section' : 'Save & back to review') : (cur.cta || 'Continue'))) + '</button>') + '</div></div>';
    }
    root.innerHTML = html;
    if (scrollTop !== false) window.scrollTo(0, 0);
    var sb = root.querySelector('.steps'), on = sb && sb.querySelector('li.on');
    if (on && sb.scrollWidth > sb.clientWidth) sb.scrollLeft = Math.max(0, on.offsetLeft - sb.offsetLeft - (sb.clientWidth - on.offsetWidth) / 2);
    // biz search initial list
    (cur.fields || []).forEach(function (f) { if (f.type === 'bizsearch' && fieldVisible(f) && !S.a[f.id]) bizResults(f); });
    document.title = (title || 'Get a Quote') + ' – Chandler Insurance';
  }

  function autoAdvanceField(cur) {
    if (!cur.fields) return null;
    var fs = cur.fields.filter(function (f) { return f.type !== 'info' && fieldVisible(f); });
    return fs.length === 1 && (fs[0].type === 'tiles' || fs[0].type === 'pics') ? fs[0] : null;
  }

  // ---------- value display / follow-up ----------
  function optLabel(f, v) {
    if (v === UNSURE) return null;
    var o = (typeof f.opts === 'function' ? f.opts(S.a) : f.opts) || [];
    var m = o.filter(function (x) { return x.v === v; })[0];
    return m ? m.l : v;
  }
  function display(f) {
    var v = S.a[f.id];
    if (v === UNSURE || (typeof v === 'string' && /^__.*__$/.test(v))) return null;
    switch (f.type) {
      case 'multi':
        var okv = typeof f.opts === 'function' ? f.opts(S.a).map(function (o) { return o.v; }) : null;
        return Array.isArray(v) && v.length ? v.filter(function (x) { return !okv || okv.indexOf(x) > -1; }).map(function (x) { return optLabel(f, x); }).join(', ') : '';
      case 'tiles': case 'pics': case 'select': return v ? optLabel(f, v) : '';
      case 'address':
        var p = f.id, l = S.a[p + '_line'];
        return l ? [l + (S.a[p + '_apt'] ? ' ' + S.a[p + '_apt'] : ''), S.a[p + '_city'], [S.a[p + '_state'], S.a[p + '_zip']].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '';
      case 'repeater':
        return Array.isArray(v) ? v.map(function (it) { return f.sub.map(function (sf) { return sf.type === 'dl' ? dlLabel(it) : sf.type === 'hd' ? '' : sf.type === 'motors' ? motorsLabel(it) : (sf.when && sf.when.indexOf(it[sf.whenKey || 'type']) < 0) ? '' : Array.isArray(it[sf.k]) ? (it[sf.k].length ? (sf.rv || sf.l) + ': ' + it[sf.k].join(', ') : '') : it[sf.k] ? (sf.rv ? sf.rv + ' ' : '') + (it[sf.k] === 'Not sure' ? "I'm not sure" : it[sf.k]) : ''; }).filter(Boolean).join(' · '); }).filter(Boolean).join(' / ') : '';
      case 'bizsearch': return v ? S.a[f.id + '_label'] : '';
      case 'vehcov': if (f.vk) { var dq = vkTargets(f.vk).map(function (t) { var x = vcVal(t.cov, f.vk); return x ? t.label + ': ' + x : null; }).filter(Boolean); return dq.join(' / '); } return vehCovDisplay();
      case 'secret': return S.a[f.id + '_provided'] ? 'Provided (ends in ' + (S.a[f.id + '_last2'] || '') + ')' : '';
      default: return clean(v) || '';
    }
  }
  function followUps() {
    var out = [];
    visibleScreens().forEach(function (s) {
      if (!s.fields || S.visited.indexOf(s.id) < 0) return;
      s.fields.forEach(function (f) {
        if (!fieldVisible(f) || f.type === 'info' || f.type === 'upload' || f.fu === false || f.required) return;
        var d = display(f);
        if (d == null || d === '') { var lab = f.fuLabel || f.label || f.q; if (out.indexOf(lab) < 0) out.push(lab); }
      });
    });
    visibleScreens().forEach(function (s) {
      if (!s.fields || S.visited.indexOf(s.id) < 0) return;
      s.fields.forEach(function (f) {
        if (f.type !== 'repeater' || !fieldVisible(f) || !f.sub.some(function (x) { return x.type === 'dl'; }) || !Array.isArray(S.a[f.id])) return;
        S.a[f.id].forEach(function (d, i) { var lab = 'Driver\'s license – ' + (cleanStr(d && d.name) || 'driver ' + (i + 1)); if (d && (!d.dlProvided || d.dlAgent) && out.indexOf(lab) < 0) out.push(lab); });
      });
    });
    if (S.a.decUpload !== 'provided' && S.visited.some(function (id) { return /upload|checkpoint/i.test(id); })) out.push('Current policy / dec page (not uploaded)');
    return out;
  }
  function fuHtml(list) {
    if (!list.length) return '';
    return '<div class="fu"><h3>Your agent will follow up on</h3><ul>' + list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
  }

  function renderReview() {
    var h = '<p class="sub">Look it over. Anything you skipped is fine.</p><p class="fu-line">Your agent may follow up on a few details.</p>';
    var seen = {}, wlSeen = {};
    visibleScreens().forEach(function (s) {
      if (!s.fields || s.kind === 'review' || S.visited.indexOf(s.id) < 0) return;
      if (s.kind === 'checkpoint') s.reviewTitle = s.reviewTitle || 'Current policy upload';
      var rows = s.fields.filter(function (f) { return fieldVisible(f) && f.type !== 'info' && f.type !== 'upload' && f.review !== false; }).map(function (f) {
        var d = display(f);
        var qEdit = oneQ && s.parent && groupIds(s.parent).length > 1 ? '<button type="button" class="linkbtn qedit" data-edit="' + s.id + '" aria-label="Edit: ' + esc(f.label || f.q) + '">Edit</button>' : '';
        return '<div class="rv-row"><div><dt>' + esc(f.label || f.q) + '</dt><dd' + (d == null || d === '' ? ' class="uns"' : '') + '>' + (d == null ? 'I\'m not sure – agent will help' : d === '' ? 'Skipped' : esc(d)) + '</dd></div>' + qEdit + '</div>' +
          (woodOn(f) && !wlSeen[f.woodLoc] && (wlSeen[f.woodLoc] = 1) ? '<div class="rv-row"><div><dt>Wood heat – where is it located?</dt><dd' + (cleanStr(S.a[f.woodLoc]) ? '>' + esc(S.a[f.woodLoc]) : ' class="uns">Skipped') + '</dd></div></div>' : '');
      }).join('');
      if (s.id === 'upload' || /upload/i.test(s.id) || s.kind === 'checkpoint') rows = '<div class="rv-row"><div><dt>Dec page</dt><dd>' + (S.a.decUpload === 'provided' ? 'Provided (' + esc(S.a.decFileType || 'file') + ', ' + (S.a.decSizeKB || '?') + ' KB – ' + (S.decRef ? 'uploaded securely' : S.decBusy ? 'still uploading' : 'will be attached when you send') + ')' : 'Skipped') + '</dd></div></div>';
      if ((s.fields || []).some(function (f) { return f.type === 'vehcov' && fieldVisible(f); })) {
        vehCovBlocks().forEach(function (b, n) {
          if (seen['vc_' + n]) return;
          seen['vc_' + n] = { id: s.id, t: 'Vehicle coverage: ' + b.vehicle, n: 1, order: Object.keys(seen).length,
            rows: (b.same ? '<div class="rv-row"><div><dt>Coverage</dt><dd>Same as vehicle 1</dd></div></div>' : '') + (b.rows.length ? b.rows.map(function (r) { return '<div class="rv-row"><div><dt>' + esc(r[0]) + '</dt><dd' + (r[1] === "I'm not sure" ? ' class="uns"' : '') + '>' + esc(r[1]) + '</dd></div></div>'; }).join('') : '<div class="rv-row"><div><dt>Coverage</dt><dd class="uns">Skipped</dd></div></div>') };
        });
        return;
      }
      if (!rows) return;
      var group = s.reviewGroup || s.parent || s.id;
      var t = s.reviewTitle || (typeof s.title === 'function' ? s.title(S.a) : s.title);
      if (seen[group]) { seen[group].rows += rows; return; }
      seen[group] = { id: s.id, t: t, rows: rows, n: 1, order: Object.keys(seen).length };
    });
    Object.keys(seen).forEach(function (g) {
      var x = seen[g], many = oneQ && groupIds(g).length > 1;
      h += '<div class="rv-sec"><h3>' + esc(x.t) + '<button type="button" class="linkbtn" data-edit="' + x.id + '"' + (many ? ' data-editgroup="' + esc(g) + '"' : '') + '>' + (many ? 'Edit all' : 'Edit') + '</button></h3><dl>' + x.rows + '</dl></div>';
    });
    h += '<div class="f" style="margin-top:1rem"><label class="lbl" for="f_anything">Anything else?</label><textarea id="f_anything" data-in="anythingElse" placeholder="Questions, special items, timing… (optional)">' + esc(S.a.anythingElse || '') + '</textarea></div>';
    h += shopReasonHtml();
    h += '<p class="consent"><b>Plain English:</b> When you tap "Send to my agent," Chandler Insurance shops our carriers for you and may pull reports (like driving, claims, or insurance-score reports) to get accurate quotes. We never sell your data. This is not a bound policy and there is no payment.</p>';
    return h;
  }

  // Optional one-tap "why now" question, asked after Review just before Send (agent context only).
  function shopOpts() {
    var o = [['renewal', 'My renewal went up'], ['new', has(S.a, 'business') ? 'New purchase or business' : 'New purchase'], ['moving', 'Moving'], ['service', 'Unhappy with service']];
    if (has(S.a, 'business')) o.push(['contract', 'A contract requires it']);
    o.push(['checking', 'Just checking']); return o;
  }
  function shopReasonHtml() {
    return '<div class="f shop" style="margin-top:1rem"><p class="lbl" id="shopq">Optional: what prompted you to shop today?</p><p class="hint">One tap, or leave it blank.</p><div class="tiles cols2" role="group" aria-labelledby="shopq">' +
      shopOpts().map(function (x) { var on = S.a.shopReason === x[0]; return '<button type="button" class="tile' + (on ? ' on' : '') + '" data-shop="' + x[0] + '" aria-pressed="' + on + '"><span class="tx">' + esc(x[1]) + '</span><span class="ck"></span></button>'; }).join('') + '</div></div>';
  }

  // ---------- checkpoint (Variant A): "That's enough to get started" ----------
  function remainingSections() {
    var vis = visibleScreens(), ci = vis.map(function (s) { return s.id; }).indexOf(S.cur), out = [];
    vis.slice(ci + 1).forEach(function (s) {
      if (s.kind || !s.fields || S.visited.indexOf(s.id) > -1) return;
      var labs = s.fields.filter(function (f) { return fieldVisible(f) && f.type !== 'info' && f.type !== 'upload' && f.fu !== false; }).map(function (f) { return f.fuLabel || f.label || f.q; });
      if (!labs.length) return;
      var t = s.reviewTitle || (typeof s.title === 'function' ? s.title(S.a) : s.title);
      out.push(t + ': ' + labs.join(', '));
    });
    return out;
  }
  function visitedAny(id) { return S.visited.some(function (x) { return x === id || x.indexOf(id + '__') === 0; }); }
  function renderCheckpoint() {
    var names = prods(S.a).map(function (p) { var m = PRODUCTS.filter(function (x) { return x.v === p; })[0]; return m ? m.l : p; }).join(', ');
    var rest = remainingSections();
    var got = ['your contact info'];
    if (S.a.addr_line) got.push('your address');
    if (Array.isArray(S.a.people) && S.a.people.filter(function (x) { return x && cleanStr(x.name); }).length > 1) got.push('who\'s in the household');
    if (has(S.a, 'home') && visitedAny('homeKey')) got.push('the key details about the home');
    if (has(S.a, 'auto') && visitedAny('auto2')) got.push('your drivers and vehicles');
    if (visitedAny('biz5')) got.push('the key details about the business');
    var cp = screenById(S.cur) || screenById('checkpoint'), upF = cp && (cp.fields || []).filter(function (f) { return f.type === 'upload'; })[0];
    return '<div class="cp-have"><b>We have:</b> ' + esc(got.join(', ').replace(/, ([^,]*)$/, ' and $1')) + (names ? ', and you\'d like quotes for <b>' + esc(names) + '</b>' : '') + '. That\'s enough for your agent to start.</div>' +
      (upF ? '<div class="cp-upload"><p class="lbl" style="margin:0 0 .2rem">Have your current policy?</p><p class="hint" style="margin:0 0 .5rem">Upload your declarations (dec) page and your agent can fill in the rest. Optional.</p>' + renderField(upF) + '</div>' : '') +
      '<div class="cp-btns"><button type="button" class="btn btn-green" data-act="sendnow">Send now</button>' +
      '<button type="button" class="btn btn-ghost" data-act="next">Add more details</button></div>' +
      '<p class="fu-line" style="margin:.9rem 0 .3rem">Your agent may follow up on a few details.</p>' +
      '<p class="consent"><b>Plain English:</b> When you tap "Send now," Chandler Insurance shops our carriers for you and may pull reports (like driving, claims, or insurance-score reports) to get accurate quotes. We never sell your data. This is not a bound policy and there is no payment.</p>';
  }

  function renderConfirm() {
    var fu = S.lastFollowUps || followUps();
    return '<div class="conf-top"><div class="conf-check" aria-hidden="true">✓</div><h1 class="q" tabindex="-1">Thanks! One of our agents will reach out within 24 hours.</h1>' +
      '<div class="refno">Reference ' + esc(S.ref || OFFLINE_REF) + '</div>' +
      (S.offline ? '<p class="offline">(test mode – the record could not be saved)</p>' : '') + '</div>' +
      '<p class="fu-line" style="text-align:center">Your agent may follow up on a few details.</p>' +
      '<h3 style="margin:.2rem 0 .2rem;color:#003d82">What happens next</h3><ol class="next-steps">' +
      '<li>Your agent reviews your answers and fills any gaps with you.</li>' +
      '<li>We shop our carriers to find the right coverage and price.</li>' +
      '<li>We walk through every quote with you. Nothing is bound and no payment is taken until you decide.</li></ol>' +

      '<div class="conf-actions"><a class="btn btn-green" href="' + TEL + '">📞 Call now ' + PHONE + '</a>' +
      '<label class="btn btn-ghost" for="f_more" style="cursor:pointer">📎 Upload more documents<input id="f_more" type="file" accept="image/*,application/pdf" data-upload="more" style="position:absolute;opacity:0;width:1px;height:1px"></label>' +
      '<button type="button" class="btn btn-ghost" data-act="another">➕ Add another product</button>' +
      '<a class="btn btn-back" href="/">Back to home page</a></div>' +
      (S.uploadNote ? '<div class="filenote">' + S.uploadNote + '</div>' : '') +
      (NOSEND ? '<p class="discard" style="text-align:center">Test mode: saved but not emailed.</p>' : '');
  }

  // ---------- validation ----------
  // ---------- Round 7: typed years must be 4 digits, 1800 to this year (or "I'm not sure" / blank) ----------
  var YMAX = new Date().getFullYear();
  function yearBad(v) { if (v == null) return false; v = String(v).trim(); if (!v || v === UNSURE || v === 'Not sure') return false; if (!/^\d{4}$/.test(v)) return true; var n = +v; return n < 1800 || n > YMAX; }
  function yearSlots(cur, cb) { // calls cb(label, get, set) for every typed-year slot visible on this screen
    (cur.fields || []).forEach(function (f) {
      if (!fieldVisible(f)) return;
      if (f.year) cb(f.label || f.q, function () { return S.a[f.id]; }, function (v) { S.a[f.id] = v; });
      if (f.type === 'repeater' && Array.isArray(S.a[f.id])) S.a[f.id].forEach(function (it, i) {
        if (!it) return;
        f.sub.forEach(function (sf) {
          if (sf.when && sf.when.indexOf(it[sf.whenKey || 'type']) < 0) return;
          if (sf.yr) cb((f.itemLabel || 'Item') + ' ' + (i + 1) + ': ' + sf.l, function () { return it[sf.k]; }, function (v) { it[sf.k] = v; });
          if (sf.type === 'motors' && Array.isArray(it.motors)) it.motors.forEach(function (m, j) { if (m) cb((f.itemLabel || 'Item') + ' ' + (i + 1) + ', motor ' + (j + 1) + ': year', function () { return m.year; }, function (v) { m.year = v; }); });
        });
      });
    });
  }
  function yearErrs(cur) { var bad = []; yearSlots(cur, function (l, g) { if (yearBad(g())) bad.push(l); }); return bad.length ? ['Please enter a 4-digit year from 1800 to ' + YMAX + ' (or leave it blank / pick "I\'m not sure"): ' + bad.join('; ')] : null; }
  function clrErr() { var eb = $('.errbox', root); if (eb && eb.innerHTML && !validate(screenById(S.cur))) eb.innerHTML = ''; }
  function clearBadYears(cur) { yearSlots(cur, function (l, g, st) { if (yearBad(g())) st(''); }); }
  function validate(cur) {
    if (cur.kind !== 'contact') return yearErrs(cur);
    var a = S.a, e = [];
    if (!cleanStr(a.firstName) || !cleanStr(a.lastName)) e.push('Please add your first and last name.');
    var em = cleanStr(a.email), ph = digits(cleanStr(a.phone));
    var need = contactNeeds(a);
    if (need.email && !em) e.push('Add your email so we can send your quote.');
    if (need.phone && !ph) e.push('Add a phone number so we can call or text you.');
    if (!need.email && !need.phone && !em && !ph) e.push('Add a phone number or an email so your agent can reach you.');
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) e.push('That email doesn\'t look quite right.');
    if (cleanStr(a.phone) && ph.length !== 10 && !(ph.length === 11 && ph[0] === '1')) e.push('Please enter a 10-digit phone number.');
    return e.length ? e : null;
  }

  // ---------- sandbox posting ----------
  // Only answers for questions that are visible for the CURRENT product mix are sent (answers for products the
  // person later removed stay in memory in case they add the product back, but never go to the sandbox).
  function visibleAnswerKeys() {
    var keys = ['products', 'anythingElse', 'shopReason', 'decUpload', 'decUploaded', 'decFileType', 'decSizeKB', 'parcelConfirm', 'parcelAcres', 'parcelSource'];
    visibleScreens().forEach(function (s) {
      (s.fields || []).forEach(function (f) {
        if (!fieldVisible(f) || f.type === 'info' || f.type === 'upload') return;
        if (f.type === 'address') ['_line', '_apt', '_city', '_state', '_zip'].forEach(function (x) { keys.push(f.id + x); });
        else if (f.type === 'bizsearch') { keys.push(f.id, f.id + '_label', f.id + '_hard'); }
        else if (f.type === 'secret') { keys.push(f.id, f.id + '_provided', f.id + '_last2'); }
        else if (f.type === 'vehcov') { keys.push('vehicles', 'autoCovAll'); }
        else keys.push(f.id);
        if (woodOn(f)) keys.push(f.woodLoc);
      });
    });
    if (!has(S.a, 'home')) keys = keys.filter(function (k) { return !/^parcel/.test(k); });
    return keys;
  }
  function payload(stage) {
    var answers = {};
    visibleAnswerKeys().forEach(function (k) {
      if (!(k in S.a)) return;
      var v = S.a[k], f = findField(k);
      if (Array.isArray(v) && f.type === 'multi' && typeof f.opts === 'function') { var ok = f.opts(S.a).map(function (o) { return o.v; }); v = v.filter(function (x) { return ok.indexOf(x) > -1 || x === UNSURE; }); }
      answers[k] = v === UNSURE ? 'not sure' : v;
    });
    ['drivers', 'bizDrivers'].forEach(function (k) { if (Array.isArray(answers[k])) answers[k] = answers[k].map(safeDriver); });
    Object.keys(answers).forEach(function (k) { var rf = findField(k); if (rf.type !== 'repeater' || !Array.isArray(answers[k])) return;
      var conds = (rf.sub || []).filter(function (x) { return x.when && x.k; });
      if (conds.length) answers[k] = answers[k].map(function (it) { if (!it) return it; var o = Object.assign({}, it); conds.forEach(function (x) { if (x.when.indexOf(o[x.whenKey || 'type']) < 0) delete o[x.k]; }); return o; }); });
    if (visibleScreens().some(function (s) { return (s.fields || []).some(function (f) { return f.type === 'vehcov'; }); })) { answers.autoCoverage = autoCoverageObj(); answers.autoCoverageSummary = autoCoverageText(); }
    return {
      test: NOSEND, noSend: NOSEND, preview: false, stage: stage, variant: CFG.variant, summary: leadSummary(),
      decFile: S.decRef ? { id: S.decRef.id, t: S.decRef.t, type: S.decRef.type, kb: S.decRef.kb } : null,
      decFileNote: S.a.decUpload === 'provided' && !S.decRef ? 'File chosen but the secure upload failed – see the attached file if any, or ask for it' : '', ref: S.ref && S.ref !== OFFLINE_REF ? S.ref : null, clientId: clientId(), sessionToken: sessionToken(),
      submittedAt: new Date().toISOString(), products: prods(S.a),
      contact: { firstName: cleanStr(S.a.firstName), lastName: cleanStr(S.a.lastName), email: cleanStr(S.a.email), phone: cleanStr(S.a.phone), contactPref: Array.isArray(S.a.contactPref) ? S.a.contactPref : [], contactAutoSwitched: !!S.a.contactAuto, bestTime: cleanStr(S.a.bestTime) },
      followUp: stage === 'complete' ? (S.lastFollowUps || followUps()) : [], sentEarly: stage === 'complete' && !!S.sentEarly, answers: answers
    };
  }
  // Only {dlProvided, dlState, dlLast2} ever leave the page; the full license number never does.
  function safeDriver(d) {
    d = d || {};
    var o = {}; Object.keys(d).forEach(function (k) { if (!/^dl/.test(k)) o[k] = d[k]; });
    return Object.assign(o, { name: cleanStr(d.name), rel: d.rel || '', dlProvided: !!(d.dlProvided && !d.dlAgent), dlState: d.dlProvided && !d.dlAgent ? (d.dlState || 'MN') : '', dlLast2: d.dlProvided && !d.dlAgent ? String(d.dlLast2 || '').slice(-2) : '', dlAgentWillAsk: !d.dlProvided || !!d.dlAgent });
  }
  function post(stage, extra) {
    var body = stage === 'doc' ? { stage: 'doc', ref: S.ref, sessionToken: sessionToken(), clientId: clientId(), variant: CFG.variant, noSend: NOSEND } : payload(stage);
    if (extra) Object.keys(extra).forEach(function (k) { body[k] = extra[k]; });
    S.lastSave = Date.now();
    return fetch(LEAD_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: JSON.stringify(body).length < 60000 })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) { if (!j || !j.ok || !j.ref) throw new Error('not ok'); S.ref = j.ref; return j; });
  }
  // Plain-text version of Review for the lead email (same rows the person saw; DL/EIN only as "provided"/last 2).
  function leadSummary() {
    var out = [], last = null, wl = {};
    visibleScreens().forEach(function (s) {
      if (!s.fields || s.kind === 'review' || s.kind === 'confirm' || S.visited.indexOf(s.id) < 0) return;
      var t = s.reviewTitle || (typeof s.title === 'function' ? s.title(S.a) : s.title) || s.step || '';
      s.fields.forEach(function (f) {
        if (!fieldVisible(f) || f.type === 'info' || f.type === 'upload' || f.type === 'vehcov' || f.review === false) return;
        var d = display(f);
        if (t !== last) { out.push('', '== ' + t + ' =='); last = t; }
        out.push((f.label || f.q || f.id) + ': ' + (d == null ? "I'm not sure" : d === '' ? 'Skipped' : String(d)));
        if (woodOn(f) && !wl[f.woodLoc]) { wl[f.woodLoc] = 1; out.push('Wood heat – where is it located?: ' + (cleanStr(S.a[f.woodLoc]) || 'Skipped')); }
      });
    });
    if (visibleScreens().some(function (s) { return (s.fields || []).some(function (f) { return f.type === 'vehcov'; }) && S.visited.indexOf(s.id) > -1; })) out.push('', '== Auto coverage ==', autoCoverageText());
    out.push('', '== Dec page ==', S.a.decUpload === 'provided' ? 'Provided (' + (S.a.decFileType || 'file') + ', ' + (S.a.decSizeKB || '?') + ' KB)' : 'Not uploaded');
    return out.join('\n').replace(/^\n+/, '').slice(0, 20000);
  }
  // Fallback only: the browser submits straight to the Netlify Form (used when /api/lead could not email it, or the
  // secure upload failed and the file has to ride along as the form's file field, max 8 MB per request).
  function sendFormDirect(withFile) {
    if (NOSEND) return Promise.resolve(false);
    var c = payload('complete'), pn = { home: 'Home', auto: 'Auto', bundle: 'Home + Auto', cabin: 'Cabin', renters: 'Renters', dwelling: 'Rental property', rec: 'Boat / rec', umbrella: 'Umbrella', life: 'Life', business: 'Business', notsure: 'Not sure yet' };
    var name = [c.contact.firstName, c.contact.lastName].filter(Boolean).join(' ') || 'Unknown name';
    var products = c.products.map(function (x) { return pn[x] || x; }).join(', ') || (CFG.variant === 'c' ? 'Business' : 'Not chosen');
    var fd = new FormData(), ref = S.ref || ('NO-REF-' + Date.now().toString(36).toUpperCase());
    var f = { 'form-name': 'qf-lead', subject: 'COMPLETE – quote request (' + products + ') – ' + name + ' – ' + ref, status: 'COMPLETE (sent from the browser)' + (S.sentEarly ? ' (sent early with "Send now")' : ''),
      ref: ref, version: CFG.variant.toUpperCase(), products: products, name: name, email: c.contact.email, phone: c.contact.phone, contact_pref: (c.contact.contactPref || []).join(', '), best_time: c.contact.bestTime,
      dec_page_link: S.decRef ? location.origin + '/api/dec-file?id=' + S.decRef.id + '&t=' + S.decRef.t + '  (private link, works for 30 days)' : (S.decFileObj ? 'Attached to this email' : 'No file uploaded'),
      follow_up: (c.followUp || []).join('; '), summary: c.summary, submitted: new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' }) + ' CT' };
    Object.keys(f).forEach(function (k) { fd.append(k, f[k] == null ? '' : String(f[k])); });
    if (withFile && S.decFileObj && S.decFileObj.size <= FORM_FILE_MAX) fd.append('dec_page', S.decFileObj, 'dec-page.' + extOf(S.decFileObj));
    return fetch('/', { method: 'POST', body: fd }).then(function (r) { return r.ok; }).catch(function () { return false; });
  }
  // ---------- Round 11: dec page upload (client checks; the server re-checks type by file signature and size) ----------
  var DEC_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp' };
  function extOf(file) { var e = ((file.name || '').match(/\.([a-z0-9]{1,5})$/i) || [])[1]; e = e ? e.toLowerCase() : ''; return DEC_TYPES[(file.type || '').toLowerCase()] || ({ jpeg: 'jpg', jpg: 'jpg', pdf: 'pdf', png: 'png', heic: 'heic', heif: 'heif', webp: 'webp' })[e] || ''; }
  function mb(n) { return (Math.round(n / 104857.6) / 10).toFixed(1) + ' MB'; }
  function decFileErr(file) {
    if (!extOf(file)) return 'That file type won\'t work. Please upload a PDF or a photo (JPG, PNG or HEIC).';
    if (!file.size) return 'That file looks empty. Please try again.';
    if (file.size > DEC_MAX) return 'That file is ' + mb(file.size) + '. The limit is 10 MB. Try a photo of just the declarations page, or a smaller PDF.';
    return '';
  }
  function uploadDec(file) {
    var n = Math.ceil(file.size / DEC_CHUNK), i = 0, id = '', t = '';
    function nextChunk() {
      var h = { 'content-type': 'application/octet-stream', 'x-qf-size': String(file.size), 'x-qf-idx': String(i), 'x-qf-type': file.type || '' };
      if (i) { h['x-qf-id'] = id; h['x-qf-t'] = t; }
      return fetch(UPLOAD_URL, { method: 'POST', headers: h, body: file.slice(i * DEC_CHUNK, Math.min(file.size, (i + 1) * DEC_CHUNK)) })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (j) {
          if (!j || !j.ok) { var e = new Error(j && j.error || 'upload failed'); e.friendly = j && j.error === 'too_big' ? 'That file is over the 10 MB limit. Try a photo of just the declarations page.' : j && j.error === 'bad_type' ? 'That doesn\'t look like a PDF or photo. Please upload a PDF, JPG, PNG or HEIC file.' : ''; throw e; }
          id = j.id; t = j.t; i++;
          return j.done ? { id: id, t: t, type: j.type, kb: j.kb } : nextChunk();
        });
    }
    return nextChunk();
  }

  // ---------- navigation ----------
  function go(id, push) {
    S.cur = id;
    if (S.ref && S.ref !== OFFLINE_REF && !S.done && S.partialSig && Date.now() - (S.lastSave || 0) > 60000) post('partial').catch(function () {}); // keeps "last activity" fresh for the partial-lead sweep
    if (S.visited.indexOf(id) < 0) S.visited.push(id);
    if (push !== false) history.pushState({ qf: id }, '', '#' + id);
    render();
    var h = $('h1.q', root); if (h && push !== false) try { h.focus({ preventScroll: true }); } catch (e) {}
  }
  // While editing from Review: a group edit walks every visible question in that review section, then returns.
  function groupIds(g) { return visibleScreens().filter(function (s) { return (s.reviewGroup || s.parent || s.id) === g && s.fields; }).map(function (s) { return s.id; }); }
  function editNextId() {
    if (!S.editing || !S.editing.group) return null;
    var ids = groupIds(S.editing.group), i = ids.indexOf(S.cur);
    return i > -1 && i < ids.length - 1 ? ids[i + 1] : null;
  }
  // first not-yet-visited question screen that sits before `target` in the flow (a newly added product's section)
  function gapBefore(target) {
    var vis = visibleScreens(), ids = vis.map(function (s) { return s.id; }), ti = target ? ids.indexOf(target) : vis.length;
    for (var j = 0; j < (ti < 0 ? vis.length : ti); j++) { var s = vis[j]; if (s.fields && !s.kind && S.visited.indexOf(s.id) < 0) return s.id; }
    return null;
  }
  function firstUnvisited() {
    var vis = visibleScreens();
    for (var j = 0; j < vis.length; j++) if (vis[j].kind !== 'confirm' && vis[j].kind !== 'checkpoint' && S.visited.indexOf(vis[j].id) < 0) return vis[j].id;
    return vis.filter(function (s) { return s.kind === 'review'; })[0].id;
  }
  function nextId() {
    var vis = visibleScreens(), i = vis.map(function (s) { return s.id; }).indexOf(S.cur);
    return vis[Math.min(vis.length - 1, i + 1)].id;
  }
  function next(skip) {
    var cur = screenById(S.cur);
    if (skip) clearBadYears(cur);
    if (cur.kind === 'review') return submit();
    if (!skip || cur.kind === 'contact') {
      var switched = cur.kind === 'contact' && applyContactSwitch(S.a);
      var errs = validate(cur);
      if (errs && switched) { render(false); }
      if (errs) { $('.errbox', root).innerHTML = '<div class="note-warn" role="alert">' + errs.map(esc).join('<br>') + '</div>'; window.scrollTo(0, 0); return; }
    }
    if (cur.kind === 'products' && !prods(S.a).length) { S.a.products = ['notsure']; }
    if (cur.kind === 'products' && S.returnTo) {
      var back = S.returnTo; S.returnTo = null;
      var vis0 = visibleScreens(), stillThere = vis0.indexOf(screenById(back)) > -1;
      S.resumeAt = stillThere ? back : null;
      var gap = gapBefore(stillThere ? back : null);
      if (gap) return go(gap);
      S.resumeAt = null;
      return go(stillThere ? back : firstUnvisited());
    }
    if (S.resumeAt && !S.editing) {
      var nid = nextId();
      if (S.visited.indexOf(nid) > -1 || nid === S.resumeAt) {
        var g2 = gapBefore(S.resumeAt); if (g2 && g2 !== S.cur) return go(g2);
        var r = S.resumeAt; S.resumeAt = null; return go(r);
      }
    }
    if (cur.kind === 'contact') {
      var sig = [S.a.firstName, S.a.lastName, S.a.email, S.a.phone, S.a.contactPref].join('|');
      if (sig !== S.partialSig) { S.partialSig = sig; S.partialP = post('partial').then(function () { S.partialOk = true; }).catch(function () { S.partialOk = false; }); }
    }
    if (S.editing) {
      var nx = editNextId(); if (nx) return go(nx);
      S.editing = false; var rv = visibleScreens().filter(function (s) { return s.kind === 'review'; })[0]; return go(rv.id);
    }
    go(nextId());
  }
  function submit(early) {
    visibleScreens().forEach(clearBadYears);
    var btn = $(early ? '[data-act="sendnow"]' : '[data-act="next"]', root); if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
    S.sentEarly = !!early;
    S.lastFollowUps = followUps().concat(early ? remainingSections() : []);
    var conf = visibleScreens().filter(function (s) { return s.kind === 'confirm'; })[0];
    // wait for the partial save (so the final submit carries the server-issued ref) and for any dec-page upload
    var fileOnly = false;
    Promise.resolve(S.partialP).then(function () { return S.decP; }).catch(function () {}).then(function () {
      fileOnly = !!(S.decFileObj && !S.decRef && !NOSEND);
      return post('complete', fileOnly ? { clientSends: true } : null);
    }).then(function (j) {
      if (j.emailed || j.noSend || j.duplicate || NOSEND) return true;
      // the server could not email it (or the file must be attached): send straight to the Netlify Form
      return sendFormDirect(fileOnly).then(function (ok) {
        if (ok) return post('complete', { clientSent: true }).then(function () { return true; }, function () { return true; });
        return fileOnly ? post('complete').then(function (j2) { return !!(j2.emailed || j2.duplicate); }) : false;
      });
    }, function () { return NOSEND ? 'offline' : sendFormDirect(true); })
      .then(function (ok) {
        if (ok === 'offline') { S.offline = true; S.ref = OFFLINE_REF; }
        else if (!ok) throw new Error('not sent');
        else S.offline = false;
        S.done = true; localStorage.removeItem(SAVE_KEY); go(conf.id);
      }).catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = early ? 'Send now' : 'Send to my agent'; }
        var eb = $('.errbox', root) || root;
        eb.innerHTML = '<div class="note-warn" role="alert">We couldn\'t send this just now. Please tap send again, or call us at ' + PHONE + '. Your answers are still here.</div>';
        window.scrollTo(0, 0);
      });
  }
  function saveLater() {
    var saveA = Object.assign({}, S.a); // never persist license or EIN data on the device
    ['drivers', 'bizDrivers'].forEach(function (k) { if (Array.isArray(saveA[k])) saveA[k] = saveA[k].map(function (d) { var o = {}; Object.keys(d || {}).forEach(function (x) { if (!/^dl(Last2|Provided|State)$/.test(x)) o[x] = d[x]; }); return o; }); });
    Object.keys(saveA).forEach(function (k) { if (/_(last2|provided)$/.test(k)) delete saveA[k]; });
    lsSet(SAVE_KEY, { a: saveA, cur: S.cur, visited: S.visited, ref: S.ref, partialSig: S.partialSig, savedAt: Date.now() });
    toast('Saved on this device. Come back to this page and tap "Continue previous quote" on the first screen to pick up here.');
  }
  function resume() {
    var s = lsGet(SAVE_KEY, null);
    if (!s || !s.a) { toast('No saved quote on this device yet. Use "Save and finish later" on any screen after your contact info.'); return; }
    S.a = s.a || {}; S.visited = s.visited || []; S.ref = s.ref || null; S.partialSig = s.partialSig || null;
    var target = screenById(s.cur) ? s.cur : visibleScreens()[0].id;
    history.replaceState({ qf: target }, '', '#' + target); S.cur = target; render();
    toast('Welcome back! We restored your answers.');
  }
  var toastT;
  function toast(msg) {
    var t = $('.toast'); if (t) t.remove();
    t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = msg; document.body.appendChild(t);
    clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, 6000);
  }

  // ---------- events ----------
  function onClick(e) {
    var t = e.target.closest('button, [data-act]'); if (!t || !root.contains(t)) return;
    var d = t.dataset;
    if (d.act === 'next') return next(false);
    if (d.act === 'skip') return next(true);
    if (d.act === 'sendnow') return submit(true);
    if (d.act === 'cchange') { var t0 = root.querySelector('[data-tile="contactPref"]'); if (t0) { t0.scrollIntoView({ block: 'center' }); t0.focus(); } return; }
    if (d.act === 'back') return history.back();
    if (d.act === 'save') return saveLater();
    if (d.act === 'resume') return resume();
    if (d.act === 'another') {
      S.done = false; S.offline = false; S.a.products = []; S.partialSig = null; S.ref = null; S.uploadNote = null; S.sentEarly = false; S.lastFollowUps = null; S.decRef = null; S.decFileObj = null; S.decP = null;
      S.visited = S.visited.filter(function (id) { return /^(products|contact|type)/.test(id); });
      return go(visibleScreens()[0].id);
    }
    if (d.edit) { S.editing = d.editgroup ? { group: d.editgroup } : { one: true }; return go(d.edit); }
    if (d.shop) { if (S.a.shopReason === d.shop) delete S.a.shopReason; else S.a.shopReason = d.shop; var sb2 = t.closest('.shop'); if (sb2) sb2.outerHTML = shopReasonHtml(); var nb = root.querySelector('[data-shop="' + d.shop + '"]'); if (nb) nb.focus(); return; }
    if (d.vinok) { var vk = S.a[d.vinok][+d.i]; vk.vinConfirmed = true; render(false); var ob = root.querySelector('[data-vinbox="' + d.vinok + ':' + d.i + '"] button'); if (ob) ob.focus(); return; }
    if (d.vinedit) { var ve = S.a[d.vinedit][+d.i]; ve.vinConfirmed = 'edit'; render(false); var yr = root.querySelector('[data-rep="' + d.vinedit + '"][data-i="' + d.i + '"][data-k="year"]'); if (yr) yr.focus(); return; }
    if (d.tile) {
      var f = findField(d.tile), v = d.v;
      if (f.type === 'multi') {
        var arr = Array.isArray(S.a[f.id]) ? S.a[f.id].slice() : [];
        if (v === UNSURE || (f.exclusive && f.exclusive.indexOf(v) > -1)) arr = arr.indexOf(v) > -1 ? [] : [v];
        else { arr = arr.filter(function (x) { return x !== UNSURE && !(f.exclusive && f.exclusive.indexOf(x) > -1); }); var i = arr.indexOf(v); if (i > -1) arr.splice(i, 1); else arr.push(v); }
        S.a[f.id] = arr;
        if (f.id === 'contactPref') { S.a.contactAuto = false; S.a.contactAutoAdded = ''; }
      } else S.a[f.id] = S.a[f.id] === v && !CFG.autoAdvance ? '' : v;
      render(false);
      var cur = screenById(S.cur);
      if (woodOn(f)) { var wl = root.querySelector('[data-in="' + f.woodLoc + '"]'); if (wl && !wl.value) wl.scrollIntoView({ block: 'center' }); return; } // stay: show the location box
      if (CFG.autoAdvance && f.type !== 'multi' && autoAdvanceField(cur) === f && S.a[f.id]) setTimeout(function () { next(false); }, 260);
      return;
    }
    if (d.unsure) {
      var fu = findField(d.unsure);
      if (fu.required || NO_UNSURE.indexOf(fu.id) > -1) return;
      S.a[fu.id] = S.a[fu.id] === UNSURE ? (fu.type === 'multi' || fu.type === 'repeater' ? [] : '') : UNSURE;
      render(false);
      if (CFG.autoAdvance && S.a[fu.id] === UNSURE) {
        var c2 = screenById(S.cur), only = c2.fields.filter(function (x) { return x.type !== 'info' && fieldVisible(x); });
        if (only.length === 1) setTimeout(function () { next(false); }, 260);
      }
      return;
    }
    if (d.dleye != null) { S.dlShow[d.dleye] = !S.dlShow[d.dleye]; render(false); var el = root.querySelector('#dl_' + d.dleye.replace(':', '_')) || root.querySelector('#f_' + d.dleye); if (el) el.focus(); return; }
    if (d.vc != null) {
      var tg = vcTargets()[+d.vc]; if (!tg) return;
      tg.cov[d.vk] = tg.cov[d.vk] === d.v ? '' : d.v;
      if (d.vk === 'mode' && d.v === 'same') { var c0 = vcTargets()[0].cov; VCK.forEach(function (k) { tg.cov[k] = c0[k]; }); }
      if (CFG.autoAdvance) tg.cov[d.vk] = d.v; // like Business tiles: a tap selects (no toggle-off), then advance once every vehicle is answered
      render(false);
      var vf = (screenById(S.cur).fields || []).filter(function (x) { return x.type === 'vehcov' && x.vk === d.vk; })[0];
      if (CFG.autoAdvance && vf && screenById(S.cur).fields.length === 1 && vkDone(vf)) { setTimeout(function () { next(false); }, 260); return; } var bt = root.querySelector('[data-vc="' + d.vc + '"][data-vk="' + d.vk + '"][data-v="' + d.v + '"]'); if (bt) bt.focus(); return;
    }
    if (d.act === 'chprod') { S.returnTo = S.cur; return go('products'); }
    if (d.dlagent) {
      var dv = S.a[d.dlagent][+d.i] || (S.a[d.dlagent][+d.i] = {});
      dv.dlAgent = !dv.dlAgent;
      if (dv.dlAgent) { S.dlFull[d.dlagent + ':' + d.i] = ''; dv.dlProvided = false; dv.dlLast2 = ''; }
      return render(false);
    }
    if (d.addmotor) { var bo = S.a[d.addmotor][+d.i]; bo.motors = Array.isArray(bo.motors) && bo.motors.length ? bo.motors : [{}]; bo.motors.push({}); return render(false); }
    if (d.rmmotor) { var br = S.a[d.rmmotor][+d.i]; if (Array.isArray(br.motors)) br.motors.splice(+d.m, 1); return render(false); }
    if (d.add) { var arr2 = Array.isArray(S.a[d.add]) ? S.a[d.add] : []; arr2.push({}); S.a[d.add] = arr2; return render(false); }
    if (d.rm) {
      S.a[d.rm].splice(+d.i, 1);
      // shift memory-only license numbers down so they stay with the right person
      var nf = {}; Object.keys(S.dlFull).forEach(function (k) { var m = k.split(':'); if (m[0] !== d.rm) nf[k] = S.dlFull[k]; else if (+m[1] < +d.i) nf[k] = S.dlFull[k]; else if (+m[1] > +d.i) nf[m[0] + ':' + (+m[1] - 1)] = S.dlFull[k]; });
      S.dlFull = nf; S.dlShow = {}; S.vin = {}; S.vinLast = {}; return render(false);
    }
    if (d.ymmlist) { var yi = S.a[d.ymmlist][+d.i]; yi[d.k + 'Typed'] = false; if (d.k === 'make') { yi.modelTyped = false; yi.model = ''; } yi[d.k] = ''; render(false); return; }
    if (d.parcel) { parcelAnswer(d.parcel); return; }
    if (d.acPick != null) {
      var p = d.acField, ad = (S.acRes[p] || [])[+d.acPick]; if (!ad) return;
      S.a[p + '_line'] = ad.line; S.a[p + '_city'] = ad.city || ''; S.a[p + '_state'] = ad.state || ''; S.a[p + '_zip'] = ad.zip || '';
      parcelLookup(p);
      render(false);
      var nx = root.querySelector(ad.zip ? '[data-in="' + p + '_apt"]' : '[data-in="' + p + '_zip"]') || root.querySelector('[data-in="' + p + '_city"]'); if (nx) nx.focus();
      return;
    }
    if (d.bzpick) {
      var fid = t.closest('[data-field]').dataset.field, x = byId(d.bzpick);
      S.a[fid] = x.id; S.a[fid + '_label'] = x.l; S.a[fid + '_hard'] = HARD.test(x.l + ' ' + x.g + ' ' + x.d); S.bzq = '';
      render(false);
      if (CFG.autoAdvance && !S.a[fid + '_hard']) setTimeout(function () { next(false); }, 300);
      return;
    }
    if (d.bzclear) { S.a[d.bzclear] = ''; S.a[d.bzclear + '_hard'] = false; render(false); return; }
  }
  function findSub(fid, k) { var f = findField(fid); return (f.sub || []).filter(function (x) { return x.type === k || x.k === k && x.type; })[0]; }
  function findField(id) {
    for (var i = 0; i < CFG.screens.length; i++) { var fs = CFG.screens[i].fields || []; for (var j = 0; j < fs.length; j++) if (fs[j].id === id) return fs[j]; }
    return { id: id, type: 'text' };
  }
  function onInput(e) {
    var t = e.target, d = t.dataset;
    if (d.in) {
      S.a[d.in] = t.value;
      if ((d.in === 'email' || d.in === 'phone') && screenById(S.cur).kind === 'contact') {
        if (d.in === 'email' && S.a.contactAuto && cleanStr(t.value)) {
          // they added an email after we switched: put Email back (and drop the Call we added for them)
          var cp = (S.a.contactPref || []).filter(function (x) { return x !== 'email' && x !== S.a.contactAutoAdded; });
          S.a.contactPref = ['email'].concat(cp); S.a.contactAuto = false; S.a.contactAutoAdded = '';
          render(false); var ne = root.querySelector('[data-in="email"]'); if (ne) { var ev = ne.value; ne.focus(); ne.value = ''; ne.value = ev; } // caret to end (email inputs have no selection API)
          return;
        }
        var cn = $('.cnote', root); if (cn) cn.innerHTML = contactNoteHtml(S.a);
        ['email', 'phone'].forEach(function (id) { var f = findField(id), le = root.querySelector('label[for="f_' + id + '"]'); if (le) le.innerHTML = esc(f.labelFn ? f.labelFn(S.a) : f.label) + ((f.reqFn ? f.reqFn(S.a) : f.required) ? ' <span class="req">*</span>' : ''); });
      }
      if (d.ac) acSuggest(t, d.ac);
      if (/_zip$/.test(d.in)) zipFill(d.in.replace(/_zip$/, ''), t.value);
      if (/_line$/.test(d.in)) { var lp = d.in.replace(/_line$/, ''); clearTimeout(S_PARCEL._t); S_PARCEL._t = setTimeout(function () { parcelLookup(lp); }, 700); }
      var eb = $('.errbox', root); if (eb && eb.innerHTML && !validate(screenById(S.cur))) eb.innerHTML = '';
    }
    if (d.rep) {
      var arr = S.a[d.rep]; if (!Array.isArray(arr)) arr = S.a[d.rep] = [{}]; arr[+d.i] = arr[+d.i] || {};
      if (d.yns) { arr[+d.i][d.k] = t.checked ? 'Not sure' : ''; render(false); var yb = root.querySelector('[data-yns][data-rep="' + d.rep + '"][data-i="' + d.i + '"][data-k="' + d.k + '"]'); if (yb) yb.focus(); return; }
      if (d.cv != null) { var ci = arr[+d.i], ca = Array.isArray(ci[d.k]) ? ci[d.k] : []; ca = ca.filter(function (x) { return x !== d.cv; }); if (t.checked) ca.push(d.cv); ci[d.k] = ca; return; }
      if (d.myns) { var mo = arr[+d.i]; mo.motors = Array.isArray(mo.motors) ? mo.motors : []; mo.motors[+d.m] = mo.motors[+d.m] || {}; mo.motors[+d.m].year = t.checked ? 'Not sure' : ''; clrErr(); render(false); var mb = root.querySelector('[data-myns][data-rep="' + d.rep + '"][data-i="' + d.i + '"][data-m="' + d.m + '"]'); if (mb) mb.focus(); return; }
      if (d.mk) { var mi = arr[+d.i]; mi.motors = Array.isArray(mi.motors) ? mi.motors : []; mi.motors[+d.m] = mi.motors[+d.m] || {}; mi.motors[+d.m][d.mk] = t.value; clrErr(); return; }
      if (d.hin) { var uh = t.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (uh !== t.value) t.value = uh; arr[+d.i][d.k] = uh; return hinCheck(d.rep, +d.i, uh); }
      if (d.vin) { var up = t.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (up !== t.value) t.value = up; }
      var itm = arr[+d.i], changed = d.vin && itm.vin !== t.value;
      itm[d.k] = t.value; clrErr();
      if (t.tagName === 'SELECT') { var rf0 = findField(d.rep); if (rf0 && rf0.sub.some(function (x) { return x.when && (x.whenKey || 'type') === d.k; })) { render(false); var nf3 = root.querySelector('[data-rep="' + d.rep + '"][data-i="' + d.i + '"][data-k="' + d.k + '"]'); if (nf3) nf3.focus(); return; } }
      if (d.ymm || (t.tagName === 'SELECT' && d.k === 'year' && Array.isArray(arr) && findSub(d.rep, 'make'))) {
        if (t.value === '__type__') { itm[d.k] = ''; itm[d.k + 'Typed'] = true; if (d.k === 'make') { itm.model = ''; itm.modelTyped = true; } }
        else if (d.k === 'make') { itm.model = ''; itm.modelTyped = false; }
        render(false);
        var nf2 = root.querySelector('[data-rep="' + d.rep + '"][data-i="' + d.i + '"][data-k="' + (t.value === '__type__' ? d.k : (d.k === 'year' ? 'make' : d.k === 'make' ? 'model' : d.k)) + '"]'); if (nf2 && !nf2.disabled) nf2.focus();
        return;
      }
      if (changed && (itm.vinDecoded || itm.vinFilled)) {
        // VIN changed: drop the old decode right away so stale year/make/model never remains
        itm.year = ''; itm.make = ''; itm.model = ''; itm.trim = ''; itm.body = ''; itm.vinDecoded = false; itm.vinFilled = false; delete itm.vinConfirmed;
        S.vin[d.rep + ':' + d.i] = { msg: '', cls: '' };
        var pos = t.selectionStart; render(false);
        var vi = root.querySelector('[data-vin][data-rep="' + d.rep + '"][data-i="' + d.i + '"]'); if (vi) { vi.focus(); try { vi.setSelectionRange(pos, pos); } catch (e) {} }
      }
      if (d.vin) vinCheck(d.rep, +d.i, t.value);
    }
    if (d.dl) {
      var drv = S.a[d.dl][+d.i] || (S.a[d.dl][+d.i] = {});
      var raw = t.value.replace(/\s/g, '');
      S.dlFull[d.dl + ':' + d.i] = raw;            // memory only
      drv.dlProvided = raw.length > 0;
      drv.dlLast2 = raw.length >= 2 ? raw.slice(-2).toUpperCase() : '';
      drv.dlState = drv.dlState || 'MN';
    }
    if (d.secret) {
      var rs = t.value.replace(/[^0-9]/g, '').slice(0, 9); if (rs !== t.value.replace(/-/g, '')) t.value = rs;
      S.secret[d.secret] = rs;                    // memory only
      S.a[d.secret + '_provided'] = rs.length > 0; S.a[d.secret + '_last2'] = rs.length >= 2 ? rs.slice(-2) : '';
    }
    if (d.bzq) { S.bzq = t.value; bizResults(findField(d.bzq)); }
  }
  // ---------- VIN decode (NHTSA vPIC, free public API, client-side GET; no pricing/rating) ----------
  var VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
  function setVinStat(key, msg, cls) {
    var fk = key.split(':'), ff = fk.length === 2 && findField(fk[0]);
    if (ff && ff.softVin && cls === 'bad') { msg = 'No match for that VIN – common for off-road vehicles. Just enter year, make and model below.'; cls = ''; }
    S.vin[key] = { msg: msg, cls: cls };
    var el = root.querySelector('[data-vinstat="' + key + '"]'); if (el) { el.innerHTML = msg; el.className = 'vin-stat ' + (cls || ''); }
  }
  function vinCheck(fid, i, vin) {
    var key = fid + ':' + i;
    if (!vin) { S.vinLast[key] = null; return setVinStat(key, '', ''); }
    if (vin.length < 17) { S.vinLast[key] = null; return setVinStat(key, vin.length + '/17 characters', ''); }
    if (/[IOQ]/.test(vin)) { S.vinLast[key] = null; return setVinStat(key, 'VINs never use the letters I, O or Q. Double-check it, or just fill in year, make and model below.', 'bad'); }
    if (!VIN_RE.test(vin)) { S.vinLast[key] = null; return setVinStat(key, 'That doesn\'t look like a 17-character VIN. You can fill in year, make and model below.', 'bad'); }
    // Local check-digit test (position 9) before any network call: junk VINs never reach vPIC.
    if (!vinCheckDigitOk(vin)) { S.vinLast[key] = null; return setVinStat(key, 'That VIN doesn\'t add up – one character may be off (the 9th character is a check digit). Double-check it, or just fill in year, make and model below.', 'bad'); }
    if (S.vinLast[key] === vin) return;
    S.vinLast[key] = vin;
    setVinStat(key, '<span class="spin" aria-hidden="true"></span> Decoding…', 'busy');
    fetch('https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/' + encodeURIComponent(vin) + '?format=json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (S.vinLast[key] !== vin) return; // user changed it meanwhile
        var r0 = j && j.Results && j.Results[0] || {};
        var yr = String(r0.ModelYear || '').trim(), mk = String(r0.Make || '').trim(), md = String(r0.Model || '').trim();
        var code = String(r0.ErrorCode == null ? '' : r0.ErrorCode).trim();
        // vPIC ErrorCode must be exactly "0" (clean decode) and Make + ModelYear must be present; anything else = not found.
        if (code !== '0' || !mk || !yr) throw new Error('notfound');
        var it = S.a[fid][i] || (S.a[fid][i] = {});
        if (it.vin !== vin) return;
        function tc(x) { return x.split(/(\s+|-)/).map(function (w) { return w.length > 3 ? w.charAt(0) + w.slice(1).toLowerCase() : w; }).join(''); }
        it.year = yr; it.make = tc(mk); it.model = md; it.makeTyped = false; it.modelTyped = false;
        it.trim = String(r0.Trim || r0.Series || '').trim(); it.body = String(r0.BodyClass || '').trim();
        it.vinDecoded = true; it.vinFilled = true; delete it.vinConfirmed;
        S.vin[key] = CFG.vinConfirm ? { msg: '✓ VIN matched', cls: 'ok' } : { msg: '✓ Found: <b>' + esc(vehName(it)) + '</b>' + (it.body ? ' (' + esc(it.body) + ')' : '') + '. Check it below and edit if anything\'s off.', cls: 'ok' };
        render(false);
        var box = root.querySelector('[data-vinbox="' + key + '"]'); if (box && box.scrollIntoView) box.scrollIntoView({ block: 'nearest' });
      })
      .catch(function (e) {
        if (S.vinLast[key] !== vin) return;
        setVinStat(key, e && e.message === 'notfound' ? 'We couldn\'t find that VIN. Double-check it, or just enter year, make and model below.' : 'We couldn\'t decode that VIN right now. No problem – just enter year, make and model below.', 'bad');
      });
  }

  // ---------- ZIP -> city/state (Zippopotam.us via /api/zip). Fills only empty city/state; never overwrites what was typed. ----------
  var ZIPC = {};
  function zipFill(p, val) {
    var z = String(val || '').replace(/\D/g, ''); if (z.length !== 5) return;
    var apply = function (r) {
      if (!r || !r.found || S.a[p + '_zip'] !== val) return;
      var c = root.querySelector('[data-in="' + p + '_city"]'), st = root.querySelector('[data-in="' + p + '_state"]');
      if (!cleanStr(S.a[p + '_city'])) { S.a[p + '_city'] = r.city; if (c) c.value = r.city; }
      if (!cleanStr(S.a[p + '_state'])) { S.a[p + '_state'] = r.state; if (st) st.value = r.state; }
      S.a[p + '_zipFilled'] = true; parcelLookup(p);
    };
    if (ZIPC[z]) return apply(ZIPC[z]);
    fetch('/api/zip?zip=' + z).then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) ZIPC[z] = j; apply(j); }).catch(function () {});
  }
  // ---------- Home details from free public MN parcel data (/api/parcel). Shown only on a real hit; silent otherwise. ----------
  var S_PARCEL = {};
  function parcelTarget(a) { return a.liveHere === 'no' ? 'homeAddr' : 'addr'; }
  function parcelLookup(p) {
    if (!has(S.a, 'home') || p !== parcelTarget(S.a)) return;
    var line = cleanStr(S.a[p + '_line']), zip = cleanStr(S.a[p + '_zip']), key = line + '|' + zip;
    if (!/^\d+\s+\S/.test(line) || !/^\d{5}$/.test(zip) || S_PARCEL[key]) return;
    S_PARCEL[key] = { loading: true };
    fetch('/api/parcel?line=' + encodeURIComponent(line) + '&zip=' + zip).then(function (r) { return r.json(); }).catch(function () { return { found: false }; }).then(function (j) {
      S_PARCEL[key] = j || { found: false };
      if (j && j.found && S.a.parcelKey !== key) { S.a.parcelKey = key; delete S.a.parcelConfirm; }
      var slot = root.querySelector('[data-parcelslot="' + p + '"]'); if (slot) slot.innerHTML = parcelCard(p);
    });
  }
  function parcelHit(p) {
    var key = cleanStr(S.a[p + '_line']) + '|' + cleanStr(S.a[p + '_zip']), r = S_PARCEL[key];
    return r && r.found && S.a.parcelKey === key ? r : null;
  }
  function parcelFacts(r) {
    return [r.yearBuilt ? 'built ' + r.yearBuilt : null, r.sqft ? Number(r.sqft).toLocaleString('en-US') + ' sq ft' : null, r.acres ? r.acres + (r.acres === 1 ? ' acre' : ' acres') : null].filter(Boolean).join(', ');
  }
  function parcelCard(p) {
    if (p !== parcelTarget(S.a) || !has(S.a, 'home')) return '';
    var r = parcelHit(p); if (!r) return '';
    var src = '<p class="pc-src">From public ' + esc(r.county || 'county') + ' County property records (MnGeo). Your agent will double-check.</p>';
    if (S.a.parcelConfirm === 'yes') return '<div class="parcel ok" data-parcelbox="1"><span>✓ Using county records: <b>' + esc(parcelFacts(r)) + '</b></span> <button type="button" class="linkbtn" data-parcel="edit">Edit</button></div>';
    if (S.a.parcelConfirm === 'edit') return '<div class="parcel ok" data-parcelbox="1"><span>Got it – you can change year built and square feet on the next screens.</span></div>';
    if (S.a.parcelConfirm === 'unsure') return '<div class="parcel ok" data-parcelbox="1"><span>No problem – your agent will confirm the home details.</span> <button type="button" class="linkbtn" data-parcel="reopen">Show what we found</button></div>';
    return '<div class="parcel" data-parcelbox="1" role="group" aria-label="Home details we found"><p class="pc-q">We found: <b>' + esc(parcelFacts(r)) + '</b>. Look right?</p>' +
      '<div class="pc-btns"><button type="button" class="btn btn-green" data-parcel="yes">✓ Yes</button><button type="button" class="btn btn-ghost" data-parcel="edit">Edit</button><button type="button" class="btn btn-ghost" data-parcel="unsure">I\'m not sure</button></div>' + src + '</div>';
  }
  function parcelAnswer(v) {
    var r = parcelHit(parcelTarget(S.a)); if (!r) return;
    if (v === 'reopen') { delete S.a.parcelConfirm; return render(false); }
    S.a.parcelConfirm = v;
    if (v === 'yes' || v === 'edit') {
      if (r.yearBuilt) S.a.yearBuilt = String(r.yearBuilt);
      if (r.sqft) S.a.sqft = String(r.sqft);
      S.a.parcelAcres = r.acres || ''; S.a.parcelSource = r.source || 'MnGeo open parcel data';
    } else { S.a.parcelAcres = ''; S.a.parcelSource = ''; }
    var p = parcelTarget(S.a), slot = root.querySelector('[data-parcelslot="' + p + '"]');
    if (slot) slot.innerHTML = parcelCard(p); else render(false);
    var b = root.querySelector('[data-parcelbox] button'); if (b) b.focus();
  }

  // Real address suggestions: our own /api/addr function (Round 11c: local MN address points + US Census + Photon/OSM). Debounced; free typing always works.
  var acTimer, acSeq = 0;
  // Round 11c: warm the address index (cold start ~3 s) as soon as an address box gets focus, before the first keystroke.
  var acWarm = false;
  document.addEventListener('focusin', function (e) { if (!acWarm && e.target && e.target.matches && e.target.matches('input[data-ac]')) { acWarm = true; fetch('/api/addr?warm=1').catch(function () {}); } });
  function acSuggest(input, p) {
    var ul = input.parentNode.querySelector('.ac-list'), q = input.value.trim();
    clearTimeout(acTimer);
    if (q.length < 4) { ul.hidden = true; return; }
    if (ul.hidden || !ul.querySelector('[data-ac-pick]')) { ul.innerHTML = '<li class="stubnote">Searching addresses…</li>'; ul.hidden = false; }
    acTimer = setTimeout(function () {
      var my = ++acSeq;
      fetch('/api/addr?q=' + encodeURIComponent(q)).then(function (r) { return r.ok ? r.json() : { results: [] }; }).catch(function () { return { results: [] }; }).then(function (j) {
        if (my !== acSeq || !document.body.contains(input) || input.value.trim() !== q || document.activeElement !== input) { if (my === acSeq && document.activeElement !== input && !ul.querySelector('[data-ac-pick]')) ul.hidden = true; return; } // user moved on: don't pop a stale list over the next field
        var res = (j && j.results) || []; S.acRes[p] = res;
        if (!res.length) { ul.innerHTML = '<li class="stubnote">No match found – just keep typing your address.</li>'; ul.hidden = false; return; }
        ul.innerHTML = res.map(function (x, i) { return '<li><button type="button" data-ac-pick="' + i + '" data-ac-field="' + p + '">' + esc(x.line) + '<br><small style="color:#5b6778">' + esc([x.city || x.area, [x.state, x.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')) + '</small></button></li>'; }).join('') +
          '<li class="stubnote">' + esc((j && j.attrib) || 'Suggestions © OpenStreetMap contributors.') + ' Don\'t see yours? Keep typing.</li>';
        ul.hidden = false;
      });
    }, 280);
  }
  function onChange(e) {
    var t = e.target;
    if (t.dataset.upload) {
      var file = t.files && t.files[0];
      if (!file) return;
      // Round 11: the file goes to /api/dec-upload (private Blobs, secret 30-day link in the lead email). It is never
      // read or parsed in the page and never saved to localStorage; only type + size are kept in the answers.
      var more = t.dataset.upload === 'more', bad = decFileErr(file), here = S.cur;
      t.value = '';
      if (bad) { S.uploadNote = '<span class="up-err" role="alert">' + esc(bad) + '</span>'; render(false); return; }
      var kb = Math.max(1, Math.round(file.size / 1024)), ft = extOf(file);
      if (!more) { S.a.decUpload = 'provided'; S.a.decUploaded = true; S.a.decFileType = ft; S.a.decSizeKB = kb; S.decFileObj = file; S.decRef = null; S.decBusy = true; }
      S.uploadNote = 'Uploading your file (' + esc(ft) + ', ' + kb + ' KB)…';
      var up = uploadDec(file).then(function (r) {
        if (more) return post('doc', { doc: r }).then(function () { S.uploadNote = '✓ Sent your extra file (' + esc(ft) + ', ' + kb + ' KB) to your agent.'; });
        S.decRef = r; S.uploadNote = '✓ Got your file (' + esc(ft) + ', ' + kb + ' KB). It goes privately to your agent with your request.';
      }).catch(function (e) {
        S.uploadNote = '<span class="up-err" role="alert">' + esc(e && e.friendly || (more ? 'We couldn\'t upload that file just now. Please try again or email it to your agent.' : 'We couldn\'t upload that file just now. We\'ll try to attach it when you send.')) + '</span>';
        if (e && e.friendly && !more) { S.a.decUpload = ''; S.a.decUploaded = false; S.decFileObj = null; }
      }).then(function () { S.decBusy = false; if (S.cur === here) render(false); });
      if (!more) S.decP = up;
      render(false);
    }
    if (t.tagName === 'SELECT' && t.dataset.in) { S.a[t.dataset.in] = t.value; var wf = findField(t.dataset.in); if (wf.woodLoc) { render(false); var ws = root.querySelector('select[data-in="' + t.dataset.in + '"]'); if (ws) ws.focus(); } }
  }

  // ---------- B: split grouped screens into one question per screen ----------
  function splitOneQ(screens) {
    var out = [];
    screens.forEach(function (s) {
      if (s.kind || s.keep || !s.fields) { out.push(s); return; }
      var infos = s.fields.filter(function (f) { return f.type === 'info' && f.cls !== 'ob-hd'; }); // per-building headers only make sense on a grouped screen
      var qs = s.fields.filter(function (f) { return f.type !== 'info'; });
      qs.forEach(function (f, i) {
        var nf = Object.assign({}, f, { hideLabel: !!f.q });
        out.push({
          id: s.id + '__' + f.id, parent: s.id, step: s.step, skippable: s.skippable, reviewTitle: s.reviewTitle || (typeof s.title === 'string' ? s.title : null) || s.step,
          title: f.q || f.label, sub: f.qsub || (i === 0 ? s.sub : null), encourage: s.encourage, intro: i === 0 ? s.intro : null,
          fields: (i === 0 ? infos : []).concat([nf]),
          show: (function (s, f) { return function (a) { return (!s.show || s.show(a)) && (!f.show || f.show(a)); }; })(s, f)
        });
      });
    });
    return out;
  }

  // ---------- boot ----------
  function start(cfg) {
    CFG = cfg; oneQ = !!cfg.oneQ;
    if (oneQ) CFG.screens = splitOneQ(cfg.screens);
    SAVE_KEY = 'chq_save_' + cfg.variant; CLIENT_KEY = 'chq_client_id_' + cfg.variant; TOKEN_KEY = 'chq_session_token_' + cfg.variant;
    S = { a: {}, cur: null, visited: [], ref: null, vin: {}, vinLast: {}, dlFull: {}, dlShow: {}, secret: {}, acRes: {} };
    if (cfg.init) cfg.init(S.a);
    if (!Array.isArray(S.a.contactPref)) S.a.contactPref = ['email']; // email is the default method
    root = document.getElementById('app');
    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    // Round 11: when the page is hidden or closed after contact info, save the latest answers (no email from here;
    // the lead-sweep function emails a PARTIAL once if nothing more happens for 15 minutes).
    var lastBeacon = '';
    function saveOnHide() {
      if (!S.ref || S.ref === OFFLINE_REF || S.done || !S.partialSig) return;
      var b = JSON.stringify(payload('partial')); if (b === lastBeacon || b.length > 60000) return; lastBeacon = b;
      try { if (navigator.sendBeacon && navigator.sendBeacon(LEAD_URL, new Blob([b], { type: 'text/plain' }))) return; } catch (e) {}
      try { fetch(LEAD_URL, { method: 'POST', body: b, keepalive: true }); } catch (e) {}
    }
    window.addEventListener('pagehide', saveOnHide);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveOnHide(); });
    document.addEventListener('click', function (e) { if (!e.target.closest('.ac')) $all('.ac-list', root).forEach(function (u) { u.hidden = true; }); });
    root.addEventListener('mousedown', function (e) { if (e.target.closest && e.target.closest('.ac-list')) e.preventDefault(); }); // keep focus in the address box while picking
    root.addEventListener('focusout', function (e) { var ac = e.target.closest && e.target.closest('.ac'); if (!ac) return; setTimeout(function () { if (!ac.contains(document.activeElement)) { var u = ac.querySelector('.ac-list'); if (u) u.hidden = true; } }, 150); });
    window.addEventListener('popstate', function (e) {
      var id = e.state && e.state.qf;
      if (S.done && id && screenById(id) && screenById(id).kind !== 'confirm') { history.go(1); return; } // don't re-open a sent quote
      if (id && screenById(id)) { S.cur = id; render(); }
    });
    var firstId = visibleScreens()[0].id;
    history.replaceState({ qf: firstId }, '', location.pathname + location.search);
    S.visited.push(firstId); S.cur = firstId;
    if (cfg.preloadIndustries) loadIndustries();
    render();
  }

  window.QF = { AUTO_POL: AUTO_POL, start: start, CARRIERS: CARRIERS, SYS: SYS, has: has, personal: personal, prods: prods, PRODUCTS: PRODUCTS, UNSURE: UNSURE, first: first, cleanStr: cleanStr, CONTACT_FIELDS: CONTACT_FIELDS };
})();
