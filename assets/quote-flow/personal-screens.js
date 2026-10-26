/* Shared screen definitions for variants A and B (B splits these one question per screen).
   Round 3 (Josh's test of A): every selected product gets its own complete section, in a fixed order, and each
   product's questions stay inside its own section. Every non-contact question can be skipped or answered "not sure". */
(function () {
  var has = QF.has, first = QF.first, U = QF.UNSURE;
  var YEARS = []; for (var y = new Date().getFullYear() + 1; y >= 1981; y--) YEARS.push(String(y)); YEARS.push('1980 or older');
  var YN = [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }];
  var YNS = ['Yes', 'No'];
  var HEAT = [
    { v: 'furnace', l: 'Furnace (gas / propane / oil)' }, { v: 'electric', l: 'Electric / baseboard' },
    { v: 'boiler', l: 'Boiler / in-floor' }, { v: 'heatpump', l: 'Heat pump / geothermal' }
  ];
  var WOOD = [{ v: 'woodstove', l: 'Wood stove' }, { v: 'insert', l: 'Fireplace insert' }, { v: 'fireplace', l: 'Open fireplace (used for heat)' }, { v: 'outdoorboiler', l: 'Outdoor wood boiler' }, { v: 'pellet', l: 'Pellet stove' }, { v: 'coal', l: 'Coal / corn / other solid fuel' }];
  var OUTB = [{ v: 'garage', l: 'Detached garage' }, { v: 'polebarn', l: 'Pole barn' }, { v: 'shed', l: 'Shed' }, { v: 'shop', l: 'Shop' }, { v: 'sauna', l: 'Sauna' }, { v: 'guest', l: 'Guest cabin / bunkhouse' }, { v: 'barn', l: 'Barn (livestock / hay)' }, { v: 'boathouse', l: 'Boathouse' }, { v: 'poolhouse', l: 'Pool house' }, { v: 'leanto', l: 'Lean-to / carport' }, { v: 'other', l: 'Other building' }, { v: 'none', l: 'None' }];
  // Round 6 (Josh): for each outbuilding picked, ask size, construction, heat and electrical. All optional ("I'm not sure" is in each list).
  var OB_CONS = [{ v: 'wood', l: 'Wood frame' }, { v: 'pole', l: 'Pole barn / post-frame' }, { v: 'steel', l: 'Steel / metal building' }, { v: 'masonry', l: 'Masonry / concrete block' }, { v: 'postbeam', l: 'Post & beam' }, { v: 'other', l: 'Other' }];
  var OB_HEAT = [{ v: 'none', l: 'None' }].concat(QF.SYS.heat); // None + shared heat list
  var OB_ELEC = [{ v: 'none', l: 'None' }].concat(QF.SYS.elec); // None + shared electrical list
  var OB_FOUND = [{ v: 'slab', l: 'Concrete slab' }, { v: 'crawl', l: 'Crawlspace' }, { v: 'basement', l: 'Full basement' }, { v: 'piers', l: 'Piers / posts' }];
  var OB_USE = [{ v: 'vehicles', l: 'Vehicle / equipment storage' }, { v: 'storage', l: 'General storage' }, { v: 'workshop', l: 'Workshop / hobby space' }, { v: 'livestock', l: 'Livestock / animals' }, { v: 'hay', l: 'Hay / feed storage' }, { v: 'living', l: 'Living / guest space' }, { v: 'boat', l: 'Boat storage' }, { v: 'mixed', l: 'Mixed use' }, { v: 'other', l: 'Other' }];
  function obSel(id, label, opts, show) { return { id: id, type: 'select', label: label, q: label + '?', unsure: false, opts: opts.concat([{ v: U, l: 'I\'m not sure' }]), show: show }; }
  function outbFields(src, pre) {
    var out = [];
    OUTB.forEach(function (o) {
      if (o.v === 'none') return;
      var show = function (a) { return Array.isArray(a[src]) && a[src].indexOf(o.v) > -1; }, k = pre + '_' + o.v;
      out.push({ id: k + '_hd', type: 'info', cls: 'ob-hd', html: '<b>' + o.l + '</b>', show: show });
      out.push({ id: k + '_sqft', type: 'number', label: o.l + ' – size (sq ft)', q: 'About how big is the ' + o.l.toLowerCase() + ' (sq ft)?', im: 'numeric', ph: 'e.g. 600', show: show, unsureLabel: 'I\'m not sure' });
      out.push(obSel(k + '_cons', o.l + ' – construction', OB_CONS, show));
      out.push(Object.assign(obSel(k + '_heat', o.l + ' – heat', OB_HEAT, show), { woodLoc: k + '_woodLoc' }));
      out.push(obSel(k + '_elec', o.l + ' – electrical', OB_ELEC, show));
      out.push({ id: k + '_year', type: 'text', year: true, label: o.l + ' – year built', q: 'About what year was the ' + o.l.toLowerCase() + ' built?', im: 'numeric', ph: 'e.g. 2012', show: show, unsureLabel: 'I\'m not sure' });
      out.push(obSel(k + '_found', o.l + ' – foundation', OB_FOUND, show));
      out.push(obSel(k + '_roof', o.l + ' – roof', ROOF_T, show));
      out.push(obSel(k + '_use', o.l + ' – main use', OB_USE, show));
      out.push({ id: k + '_value', type: 'text', label: o.l + ' – replacement value (estimate)', q: 'Rough cost to rebuild the ' + o.l.toLowerCase() + '?', im: 'numeric', ph: 'e.g. $40,000', show: show, unsureLabel: 'I\'m not sure' });
    });
    return out;
  }
  var ATVT = ['ATV', 'UTV / side-by-side'], SNOWT = ['Snowmobile'], MCT = ['Motorcycle', 'Dirt bike'];
  var RVT = ['Travel trailer', '5th wheel', 'Class A motorhome', 'Class B campervan', 'Class C motorhome', 'Truck camper', 'Pop-up / folding', 'Toy hauler'];
  // rec kinds: if the picker was skipped, show every rec card screen
  function recKind(a, k) { var r = a.recKinds; return !Array.isArray(r) || !r.length || r.indexOf(k) > -1; }
  function anyOutb(src) { return function (a) { return Array.isArray(a[src]) && a[src].some(function (v) { return v !== 'none' && v !== U; }); }; }
  // eligible household people become auto drivers (name, relationship, DOB); a child counts once they are 15+
  function driverPeople(a) {
    return (Array.isArray(a.people) ? a.people : []).filter(function (p) {
      if (!p || !QF.cleanStr(p.name)) return false;
      if (/^(Me|Spouse \/ partner|Other driver)$/.test(p.rel || '')) return true;
      if (p.rel === 'Child' && p.dob) { var age = (Date.now() - new Date(p.dob).getTime()) / 31557600000; return age >= 15; }
      return false;
    });
  }
  var DOCK = [{ v: 'dock', l: 'Dock' }, { v: 'boathouse', l: 'Boathouse' }, { v: 'lift', l: 'Boat lift' }, { v: 'none', l: 'None' }];
  var FIRE = [{ v: 'u5', l: 'Under 5 miles' }, { v: '5to10', l: '5–10 miles' }, { v: 'o10', l: 'More than 10 miles' }];
  var DED = [{ v: '500', l: '$500' }, { v: '1000', l: '$1,000' }, { v: '2500', l: '$2,500', s: 'Common choice', common: true }, { v: '5000', l: '$5,000' }];
  // Round 6 (Josh): a TYPE next to each update year. "I'm not sure" is appended automatically to every list.
  var ROOF_T = QF.SYS.roof; // shared (Round 7)
  var SIDING_T = QF.SYS.siding; // shared (Round 7)
  var ELEC_T = QF.SYS.elec; // shared (Round 7)
  var HEAT_T = QF.SYS.heat; // shared (Round 7)
  var PLUMB_T = QF.SYS.plumb; // shared (Round 7)
  var ENCOURAGE = 'These help us give you an accurate price. Best guesses are fine, and "I\'m not sure" is OK.';
  var LIAB = [{ v: '100k', l: '$100,000' }, { v: '300k', l: '$300,000', s: 'Common choice', common: true }, { v: '500k', l: '$500,000' }, { v: '1m', l: '$1 million' }];
  var REL = ['Me', 'Spouse / partner', 'Co-owner', 'Other driver', 'Child', 'Parent', 'Other relative', 'Roommate / friend', 'Employee', 'Other household member'];
  var CAR = QF.CARRIERS, CPH = 'Start typing a company name (or none)';
  var CLAIMS = [{ v: 'none', l: 'None' }, { v: '1', l: '1 claim' }, { v: '2+', l: '2 or more' }];
  function sel(id, label, q, opts, show) { return { id: id, type: 'select', label: label, q: q, opts: opts.map(function (o) { return typeof o === 'string' ? { v: o, l: o } : o; }), unsureLabel: 'I\'m not sure', show: show }; }
  function tl(id, label, q, opts, show) { return { id: id, type: 'tiles', label: label, q: q, cols2: true, opts: opts.map(function (o) { return typeof o === 'string' ? { v: o, l: o } : o; }), show: show }; }
  // year updated: a select (no separate skip chip); "Original to the home" and "I'm not sure" are choices in the list
  var UPD_YEARS = []; for (var uy = new Date().getFullYear(); uy >= 1960; uy--) UPD_YEARS.push({ v: String(uy), l: String(uy) });
  UPD_YEARS.push({ v: 'pre1960', l: 'Before 1960' }, { v: 'original', l: 'Original to the home' });
  function yearField(id, label, q) { return { id: id, type: 'select', label: label, q: q, unsure: false, opts: UPD_YEARS.concat([{ v: U, l: 'I\'m not sure' }]) }; }
  // Round 7: typed year built – 4 digits, 1800 to this year (checked on Continue), with "I'm not sure"
  function builtField(id, label, q, show) { return { id: id, type: 'text', label: label, q: q, im: 'numeric', ph: 'e.g. 1978', year: true, unsureLabel: 'I\'m not sure', show: show }; }
  function typeField(id, label, q, opts) { return { id: id, type: 'tiles', label: label, q: q, cols2: true, opts: opts, unsureLabel: 'I\'m not sure' }; }
  function on(p) { return function (a) { return has(a, p); }; }
  function personalReal(a) { return QF.prods(a).some(function (p) { return p !== 'business' && p !== 'notsure'; }); }

  var screens = [
    { id: 'products', kind: 'products', step: 'Start', keep: true, title: 'What can we quote for you?', sub: 'Pick everything you\'d like us to shop. You can change this any time.',
      intro: '<div class="local-line"><span aria-hidden="true">🤝</span><span><b>A real local agent shops our carriers and reviews every quote with you.</b></span></div>',
      fields: [{ id: 'products', type: 'multi', label: 'Products', hideLabel: true, unsure: false, opts: QF.PRODUCTS.map(function (p) { return { v: p.v, l: p.l, ic: p.ic, s: p.s }; }), exclusive: ['notsure'] }] },

    { id: 'contact', kind: 'contact', step: 'Contact', keep: true, title: 'Who should your agent reach?', reviewTitle: 'Contact',
      sub: 'Your name plus an email (or a phone) is all we need to start. Everything after this is optional.',
      fields: QF.CONTACT_FIELDS },

    { id: 'you', step: 'You', title: function (a) { return 'Hi there' + (first(a) ? ', ' + first(a) : '') + '! Where\'s home?'; }, reviewTitle: 'Your address',
      show: function (a) { return QF.prods(a).length > 0; },
      fields: [
        { id: 'addr', type: 'address', apt: true, parcel: true, label: 'Home address', q: 'Nice. Where\'s home?', fuLabel: 'Home address' },
        { id: 'liveHere', type: 'tiles', label: 'Is this the home you want insured?', q: 'Is this the home you want insured?', cols2: true, opts: YN, show: on('home') },
        { id: 'homeAddr', type: 'address', parcel: true, label: 'Address of the home to insure', q: 'Where\'s the home you want insured?', show: function (a) { return has(a, 'home') && a.liveHere === 'no'; } }
      ] },

    { id: 'people', step: 'You', title: 'Who\'s in the household?', reviewTitle: 'People',
      sub: 'Add a spouse, other drivers or co-owners. Names are enough – birthdates are optional.',
      show: personalReal,
      fields: [{ id: 'people', type: 'repeater', label: 'People', q: 'Who else should be on the policy?', hideLabel: true, itemLabel: 'Person', addLabel: '+ Add a spouse, driver or co-owner',
        seed: function (a) { return { name: [QF.cleanStr(a.firstName), QF.cleanStr(a.lastName)].filter(Boolean).join(' '), rel: 'Me' }; },
        sub: [{ k: 'name', l: 'Name' }, { k: 'rel', l: 'Relationship', type: 'select', opts: REL }, { k: 'dob', l: 'Date of birth (optional)', t: 'date' }] }] },

    // ================= KEY DETAILS (rate drivers, asked before the A checkpoint) =================
    { id: 'homeKey', step: 'Key details', encourage: true, title: 'Your home: roof, siding and wiring', reviewTitle: 'Roof, siding and wiring', sub: ENCOURAGE, skippable: false, show: on('home'),
      fields: [
        typeField('roofType', 'Roof type', 'What type of roof does the home have?', ROOF_T),
        yearField('roofYear', 'Roof – year replaced', 'What year was the roof replaced?'),
        sel('roofCondition', 'Roof condition', 'What shape is the roof in?', ['Excellent – new or like new', 'Good', 'Fair – some wear', 'Poor – needs replacing soon']),
        typeField('sidingType', 'Siding type', 'What is the siding?', SIDING_T),
        typeField('electricalType', 'Electrical type', 'What kind of electrical panel?', ELEC_T),
        yearField('electricalYear', 'Electrical – year updated', 'What year was the electrical updated?')
      ] },
    { id: 'auto1', step: 'Key details', encourage: true, title: 'Who drives?', sub: ENCOURAGE + ' Date of birth matters most; the license number is optional.', skippable: false, show: on('auto'),
      fields: [{ id: 'drivers', type: 'repeater', label: 'Drivers', q: 'Who drives?', hideLabel: true, itemLabel: 'Driver', addLabel: '+ Add another driver',
        seed: function (a) {
          var ppl = driverPeople(a);
          if (!ppl.length) return { name: [QF.cleanStr(a.firstName), QF.cleanStr(a.lastName)].filter(Boolean).join(' '), rel: 'Me' };
          return ppl.map(function (p) { return { name: p.name, rel: p.rel === 'Child' ? 'Child' : p.rel, dob: p.dob || '', fromPeople: true }; });
        },
        carryNote: 'Filled in from your household. Edit anything that\'s off.',
        sync: function (a, items) {
          // add people entered (or changed) on the household screen; fill a blank DOB; never undo the person's own edits
          var ppl = driverPeople(a), sig = JSON.stringify(ppl.map(function (p) { return [p.name, p.rel, p.dob]; }));
          if (sig === a._drvSig) return; a._drvSig = sig;
          ppl.forEach(function (p) {
            var n = QF.cleanStr(p.name).toLowerCase(), d = items.filter(function (x) { return x && QF.cleanStr(x.name).toLowerCase() === n; })[0];
            if (!d) { var blank = items.filter(function (x) { return x && !QF.cleanStr(x.name); })[0]; if (blank) { blank.name = p.name; d = blank; } else { d = { name: p.name }; items.push(d); } d.rel = d.rel || p.rel; }
            if (!d.dob && p.dob) d.dob = p.dob;
            d.fromPeople = true;
          });
        },
        sub: [{ k: 'name', l: 'Name' }, { k: 'rel', l: 'Relationship', type: 'select', opts: ['Me', 'Spouse / partner', 'Child', 'Other driver', 'Other household member'] }, { k: 'dob', l: 'Date of birth (optional)', t: 'date' }, { k: 'occupation', l: 'Occupation (optional)', ph: 'e.g. Teacher' }, { k: 'dl', type: 'dl' }] }] },
    { id: 'auto2', step: 'Key details', encourage: true, title: 'Your vehicles', sub: ENCOURAGE, skippable: false, show: on('auto'),
      fields: [{ id: 'vehicles', type: 'repeater', label: 'Vehicles', q: 'What do you drive?', hideLabel: true, itemLabel: 'Vehicle', addLabel: '+ Add another vehicle',
        hint: 'Have the VIN? Enter or paste it and we\'ll fill in the rest. No VIN? Pick year, then make, then model.',
        sub: [{ k: 'vin', l: 'VIN (optional)', ph: '17 characters', vin: true },
          { k: 'year', l: 'Year', type: 'select', opts: YEARS }, { k: 'make', l: 'Make', type: 'make', ph: 'e.g. Ford' }, { k: 'model', l: 'Model', type: 'model', ph: 'e.g. F-150' },
          { k: 'trim', l: 'Trim (optional)', ph: 'e.g. XLT' },
          { k: 'ownership', l: 'Owned, financed or leased?', type: 'select', opts: ['Owned outright', 'Financed (loan)', 'Leased'] },
          { k: 'odometer', l: 'Current mileage (optional)', im: 'numeric', ph: 'e.g. 45,000', rv: 'Odometer' },
          { k: 'parking', l: 'Parked overnight', type: 'select', opts: ['Garage', 'Carport', 'Driveway', 'Street', 'Apartment / condo lot', 'Work parking lot'] }] }] },
    { id: 'upload', step: 'You', title: 'Upload your current policy to skip questions', reviewTitle: 'Current policy upload',
      sub: 'Optional. Your declarations (dec) page answers most coverage questions for your agent. Or just skip – no problem.',
      fields: [{ id: 'decUploadF', type: 'upload', label: 'Upload your current policy (optional)' }], cta: 'Continue', keep: true },

    // ================= HOME =================
    { id: 'home1', step: 'Home', title: 'About the home', show: on('home'),
      fields: [
        builtField('yearBuilt', 'Year built', 'Roughly when was the home built?'),
        { id: 'sqft', type: 'number', label: 'Square feet (finished)', q: 'About how many square feet?', im: 'numeric', ph: 'e.g. 1,800' },
        tl('homeKind', 'Type of home', 'What type of home is it?', ['Single-family home', 'Townhouse / condo']),
        sel('homeStories', 'Stories', 'How many stories?', ['1 story', '1.5 stories', '2 stories', '3+ stories', 'Split level / bi-level']),
        tl('homeFoundation', 'Foundation', 'What kind of foundation?', ['Basement', 'Crawlspace', 'Slab', 'Pier & beam']),
        tl('homeGarage', 'Garage', 'What kind of garage?', ['No garage', 'Attached garage', 'Detached garage']),
        { id: 'construction', type: 'pics', label: 'Construction', q: 'Which looks most like your home?', opts: [{ v: 'frame', l: 'Wood frame / siding', pic: 'frame' }, { v: 'brick', l: 'Brick / masonry', pic: 'brick' }, { v: 'log', l: 'Log', pic: 'log' }, { v: 'manufactured', l: 'Manufactured', pic: 'manufactured' }] }
      ] },
    { id: 'home1b', step: 'Home', title: 'The basement', show: function (a) { return has(a, 'home') && (!a.homeFoundation || a.homeFoundation === 'Basement'); },
      fields: [
        sel('basementFinished', 'Basement finished', 'About how much of the basement is finished?', ['None – unfinished', '1–25%', '26–50%', '51–75%', '76–100% (fully finished)']),
        tl('basementWalkout', 'Walkout basement', 'Is it a walkout?', ['No', 'Yes – full walkout', 'Yes – partial / daylight']),
        tl('basementWater', 'Water in the basement', 'Any history of water in the basement?', ['No', 'Yes – minor / occasional', 'Yes – significant (needed mitigation)'])
      ] },
    { id: 'home2', step: 'Home', title: 'Plumbing and heat', sub: 'Type and the year each was last updated. Best guesses are fine.', show: on('home'),
      fields: [
        typeField('plumbingType', 'Plumbing type', 'What kind of plumbing pipes?', PLUMB_T),
        yearField('plumbingYear', 'Plumbing – year updated', 'What year was the plumbing updated?'),
        Object.assign(typeField('homeHeat', 'Main heat', 'What is the main heat?', HEAT_T), { woodLoc: 'homeWoodLoc' }),
        yearField('heatingYear', 'Heating system – year updated', 'What year was the heating system updated?')
      ] },
    { id: 'home3', step: 'Home', title: 'Wood heat', show: on('home'),
      fields: [
        { id: 'woodHeat', type: 'tiles', label: 'Wood or other solid-fuel heat?', q: 'Any wood stove, fireplace insert, outdoor boiler or other solid-fuel heat?', cols2: true, opts: YN },
        { id: 'woodType', type: 'multi', label: 'Solid-fuel type', q: 'What kind? Pick all that apply.', opts: WOOD, woodLoc: 'homeWoodLoc', show: function (a) { return a.woodHeat === 'yes'; } }
      ] },
    { id: 'home4', step: 'Home', title: 'Around the property', show: on('home'),
      fields: [
        { id: 'homeOutbuildings', type: 'multi', label: 'Outbuildings', q: 'Any outbuildings?', opts: OUTB, exclusive: ['none'] },
        { id: 'homeLake', type: 'tiles', label: 'On a lake or river?', q: 'Is the home on a lake or river?', cols2: true, opts: YN },
        { id: 'homeDock', type: 'multi', label: 'Dock or boathouse', q: 'Dock or boathouse?', opts: DOCK, exclusive: ['none'], show: function (a) { return a.homeLake === 'yes'; } },
        { id: 'homeFire', type: 'tiles', label: 'Distance to the fire hall', q: 'How far is the nearest fire hall?', opts: FIRE }
      ] },
    { id: 'home4b', step: 'Home', title: 'Your outbuildings', reviewTitle: 'Outbuilding details', sub: 'A few quick details for each building. Skip anything you\'re not sure of.',
      show: function (a) { return has(a, 'home') && anyOutb('homeOutbuildings')(a); }, fields: outbFields('homeOutbuildings', 'hob') },
    { id: 'home4c', step: 'Home', title: 'Safety features', sub: 'Protective devices can lower your price.', show: on('home'),
      fields: [
        sel('smokeDetectors', 'Smoke detectors', 'What smoke detectors do you have?', ['None', 'Battery only', 'Hardwired (not interconnected)', 'Hardwired & interconnected']),
        sel('coDetectors', 'Carbon monoxide detectors', 'Carbon monoxide detectors?', ['None', 'Battery', 'Hardwired', 'Hardwired & interconnected']),
        tl('securitySystem', 'Security system', 'Home security system?', ['None', 'Unmonitored / local alarm', 'Monitored (professional)']),
        tl('deadbolts', 'Deadbolts', 'Deadbolts on the exterior doors?', ['Yes – all exterior doors', 'Yes – most doors', 'Some or none']),
        tl('extinguishers', 'Fire extinguishers', 'How many fire extinguishers?', ['None', '1–2', '3 or more']),
        { id: 'otherProtect', type: 'text', label: 'Other protective devices', q: 'Any other protective devices?', ph: 'e.g. gated driveway, exterior lighting, water shut-off' }
      ] },
    { id: 'home5', step: 'Home', title: 'Home coverage', reviewTitle: 'Home coverage', sub: 'If you\'re not sure, your agent will walk you through it.', show: on('home'),
      fields: [
        { id: 'homeDed', type: 'tiles', label: 'Deductible', q: 'What deductible?', cols2: true, opts: DED, unsureLabel: 'I\'m not sure' },
        { id: 'homeLiab', type: 'tiles', label: 'Personal liability', q: 'How much liability?', cols2: true, opts: LIAB, unsureLabel: 'I\'m not sure' }
      ] },
    { id: 'home6', step: 'Home', title: 'Current home insurance', show: on('home'),
      fields: [
        { id: 'homeCarrier', type: 'text', label: 'Current insurance company', q: 'Who insures the home now?', ph: CPH, list: CAR },
        { id: 'homeRenewal', type: 'date', label: 'Renewal date', q: 'When does it renew?' },
        tl('homeClaims', 'Claims in the last 5 years', 'Any claims or losses in the last 5 years?', CLAIMS),
        { id: 'homeMore', type: 'textarea', label: 'Anything else we should know about the home?', q: 'Anything else we should know about the home?', ph: 'e.g. finished basement, home business, trampoline, dog, recent claims…' }
      ] },

    // ================= AUTO =================
    { id: 'auto3p', step: 'Auto', title: 'Policy coverages', reviewTitle: 'Policy coverages', show: on('auto'),
      sub: 'Covers everyone on the policy, so we ask once – not per vehicle. The common choice is marked.',
      fields: [
        { id: 'autoLiab', type: 'tiles', label: 'Liability (bodily injury / property damage)', q: 'Liability limits (bodily injury / property damage)?', cols2: true, opts: QF.AUTO_POL.liab, unsure: false },
        { id: 'autoUM', type: 'tiles', label: 'Uninsured / underinsured motorist (UM/UIM)', q: 'Uninsured / underinsured motorist (UM/UIM) limits?', cols2: true, opts: QF.AUTO_POL.um, unsure: false },
        { id: 'autoPIP', type: 'tiles', label: 'Medical / PIP (personal injury protection)', q: 'Medical / PIP (personal injury protection)?', cols2: true, opts: QF.AUTO_POL.pip, unsure: false }] },
    { id: 'auto3', step: 'Auto', title: 'Coverage for each vehicle', reviewTitle: 'Vehicle coverage', show: on('auto'),
      sub: 'Pick for each vehicle. If you don\'t know, tap "I\'m not sure" and your agent will walk you through it.',
      fields: [
        { id: 'autoCov_comp', vk: 'comp', type: 'vehcov', label: 'Comprehensive deductible', q: 'Comprehensive deductible (theft, hail, deer)?', fuLabel: 'Comprehensive deductible' },
        { id: 'autoCov_coll', vk: 'coll', type: 'vehcov', label: 'Collision deductible', q: 'Collision deductible?', fuLabel: 'Collision deductible' },
        { id: 'autoCov_glass', vk: 'glass', type: 'vehcov', label: 'Full glass coverage', q: 'Full glass coverage?', fuLabel: 'Glass coverage' },
        { id: 'autoCov_rental', vk: 'rental', type: 'vehcov', label: 'Rental car', q: 'Rental car while yours is in the shop?', fuLabel: 'Rental car' },
        { id: 'autoCov_tow', vk: 'tow', type: 'vehcov', label: 'Towing & roadside', q: 'Towing & roadside?', fuLabel: 'Towing & roadside' },
        { id: 'autoCov_gap', vk: 'gap', type: 'vehcov', label: 'Gap coverage', q: 'Gap coverage (loan or lease)?', fuLabel: 'Gap coverage',
          show: function (a) { var v = (a.vehicles || []).filter(Boolean); return !v.length || v.some(function (x) { return x.ownership !== 'Owned outright'; }); } }] },
    { id: 'auto4', step: 'Auto', title: 'How you drive', show: on('auto'),
      fields: [
        { id: 'autoUse', type: 'tiles', label: 'Main use', q: 'What\'s the main use?', cols2: true, opts: [{ v: 'commute', l: 'Commute' }, { v: 'pleasure', l: 'Pleasure / errands' }, { v: 'business', l: 'Business / work' }, { v: 'farm', l: 'Farm / ranch' }, { v: 'rideshare', l: 'Ride share / delivery' }] },
        { id: 'autoMiles', type: 'tiles', label: 'Miles per year (each vehicle)', q: 'About how many miles a year?', cols2: true, opts: [{ v: '<7500', l: 'Under 7,500' }, { v: '7500-12000', l: '7,500–12,000' }, { v: '12000-20000', l: '12,000–20,000' }, { v: '20000+', l: '20,000+' }] },
        { id: 'autoIncidents', type: 'tiles', label: 'Tickets or claims in 5 years', q: 'Any tickets or claims in the last 5 years?', cols2: true, opts: [{ v: 'none', l: 'None' }, { v: '1', l: 'One' }, { v: '2+', l: 'Two or more' }] },
        { id: 'garageSame', type: 'tiles', label: 'Vehicles kept at your home address?', q: 'Are the vehicles kept overnight at your home address?', cols2: true,
          opts: [{ v: 'same', l: 'Yes – same as home' }, { v: 'other', l: 'No – somewhere else' }] },
        { id: 'garageAddr', type: 'address', label: 'Where are they kept?', q: 'Where are the vehicles kept overnight?', show: function (a) { return a.garageSame === 'other'; } }
      ] },
    { id: 'auto5', step: 'Auto', title: 'Current auto insurance', show: on('auto'),
      fields: [
        tl('autoInsured', 'Current auto insurance', 'Do you have auto insurance now?', [{ v: 'new', l: 'No – new to auto insurance' }, { v: 'other', l: 'Yes – with another company' }, { v: 'renew', l: 'Yes – renewing with my current company' }]),
        { id: 'autoCarrier', type: 'text', label: 'Current insurance company', q: 'Who insures your vehicles now?', ph: CPH, list: CAR, show: function (a) { return a.autoInsured !== 'new'; } },
        { id: 'autoRenewal', type: 'date', label: 'Renewal date', q: 'When does it renew?', show: function (a) { return a.autoInsured !== 'new'; } },
        { id: 'autoMore', type: 'textarea', label: 'Anything else about your drivers or vehicles?', q: 'Anything else we should know about your drivers or vehicles?', ph: 'e.g. a teen getting a license soon, a car in storage…' }
      ] },

    // ================= CABIN =================
    { id: 'cabin1', step: 'Cabin', title: 'About the cabin', show: on('cabin'),
      fields: [
        { id: 'cabinAddr', type: 'address', label: 'Cabin address', q: 'Where\'s the cabin?' },
        { id: 'cabinUse', type: 'tiles', label: 'Seasonal or year-round?', q: 'Is the cabin seasonal or year-round?', cols2: true, opts: [{ v: 'seasonal', l: 'Seasonal' }, { v: 'yearround', l: 'Year-round' }] },
        builtField('cabinYearBuilt', 'Year built', 'Roughly when was the cabin built?')
      ] },
    { id: 'cabin2', step: 'Cabin', title: 'Cabin heat and access', show: on('cabin'),
      fields: [
        { id: 'cabinHeat', type: 'multi', label: 'Cabin heat source(s)', q: 'How is the cabin heated?', opts: [{ v: 'outdoorboiler', l: 'Outdoor wood boiler' }].concat(QF.SYS.heat, [{ v: 'none', l: 'No heat' }]), exclusive: ['none'], woodLoc: 'cabinWoodLoc' },
        { id: 'cabinAccess', type: 'tiles', label: 'Winter access', q: 'How do you get there in winter?', opts: [{ v: 'plowed', l: 'Plowed road, year-round' }, { v: 'seasonal', l: 'Seasonal / unplowed road' }, { v: 'sled', l: 'Snowmobile, ATV, or over the ice only' }] },
        { id: 'cabinFire', type: 'tiles', label: 'Distance to the fire hall', q: 'How far is the cabin from a fire hall?', opts: FIRE }
      ] },
    { id: 'cabin3', step: 'Cabin', title: 'Around the cabin', show: on('cabin'),
      fields: [
        { id: 'cabinDock', type: 'multi', label: 'Dock or boathouse', q: 'Dock or boathouse at the cabin?', opts: DOCK, exclusive: ['none'] },
        { id: 'cabinOutbuildings', type: 'multi', label: 'Outbuildings', q: 'Any outbuildings at the cabin?', opts: OUTB, exclusive: ['none'] }
      ] },
    { id: 'cabin3b', step: 'Cabin', title: 'Your cabin outbuildings', reviewTitle: 'Cabin outbuilding details', sub: 'A few quick details for each building. Skip anything you\'re not sure of.',
      show: function (a) { return has(a, 'cabin') && anyOutb('cabinOutbuildings')(a); }, fields: outbFields('cabinOutbuildings', 'cob') },
    { id: 'cabin4', step: 'Cabin', title: 'Cabin coverage', show: on('cabin'),
      fields: [
        { id: 'cabinDed', type: 'tiles', label: 'Deductible', q: 'What deductible?', cols2: true, opts: DED, unsureLabel: 'I\'m not sure' },
        { id: 'cabinLiab', type: 'tiles', label: 'Liability', q: 'How much liability?', cols2: true, opts: LIAB, unsureLabel: 'I\'m not sure' },
        { id: 'cabinCarrier', type: 'text', label: 'Current insurance company', q: 'Who insures the cabin now?', ph: CPH, list: CAR }
      ] },

    // ================= RENTERS =================
    { id: 'renters1', step: 'Renters', title: 'About your rental', show: on('renters'),
      fields: [
        { id: 'rentType', type: 'tiles', label: 'What do you rent?', q: 'What kind of place do you rent?', cols2: true, opts: [{ v: 'apartment', l: 'Apartment' }, { v: 'house', l: 'House' }, { v: 'duplex', l: 'Duplex / townhome' }, { v: 'other', l: 'Other' }] },
        { id: 'rentUnits', type: 'tiles', label: 'Units in the building', q: 'How many units are in the building?', cols2: true, opts: [{ v: '1', l: '1' }, { v: '2', l: '2' }, { v: '3-4', l: '3–4' }, { v: '5+', l: '5 or more' }] }
      ] },
    { id: 'renters2', step: 'Renters', title: 'Renters coverage', show: on('renters'),
      fields: [
        { id: 'rentPP', type: 'tiles', label: 'Belongings', q: 'Coverage for your belongings?', cols2: true, opts: [{ v: '15k', l: '$15,000' }, { v: '25k', l: '$25,000' }, { v: '50k', l: '$50,000' }, { v: '75k+', l: '$75,000+' }] },
        { id: 'rentLiab', type: 'tiles', label: 'Liability', q: 'How much liability?', cols2: true, opts: LIAB },
        { id: 'rentDed', type: 'tiles', label: 'Deductible', q: 'What deductible?', cols2: true, opts: [{ v: '250', l: '$250' }, { v: '500', l: '$500' }, { v: '1000', l: '$1,000' }] }
      ] },

    // ================= RENTAL / DWELLING =================
    { id: 'dwelling1', step: 'Rental property', title: 'About the rental property', show: on('dwelling'),
      fields: [
        { id: 'dwAddr', type: 'address', label: 'Rental property address', q: 'Where\'s the rental property?' },
        { id: 'dwCounty', type: 'text', label: 'County', q: 'What county is it in?', ph: 'e.g. Itasca, St. Louis' },
        sel('dwType', 'Property type', 'What type of property?', ['Single-family rental', 'Duplex', 'Triplex / 4-plex', '5+ unit building', 'Cabin / seasonal rental', 'Mobile / manufactured home', 'Other']),
        { id: 'dwOcc', type: 'tiles', label: 'Owner-occupied or rented out?', q: 'Do you live there, or is it fully rented out?', opts: [{ v: 'owner', l: 'I live in one unit' }, { v: 'rented', l: 'Fully rented out' }] },
        { id: 'dwUnits', type: 'tiles', label: 'Units', q: 'How many rental units?', cols2: true, opts: [{ v: '1', l: '1' }, { v: '2', l: '2' }, { v: '3', l: '3' }, { v: '4', l: '4' }, { v: '5-10', l: '5–10' }, { v: '11+', l: '11+' }] },
        sel('dwOccupancy', 'Current occupancy', 'Is it rented right now?', ['Fully rented', 'Partially rented', 'Vacant – being rented', 'Vacant – rehab / between tenants', 'Seasonal / short-term rental']),
        { id: 'dwRent', type: 'text', label: 'Total monthly rent', q: 'Total monthly rent?', im: 'numeric', ph: 'e.g. $1,200' },
        { id: 'dwTerm', type: 'tiles', label: 'Long- or short-term rental?', q: 'Long-term tenants or short-term (like Airbnb/VRBO)?', opts: [{ v: 'long', l: 'Long-term (lease)' }, { v: 'short', l: 'Short-term / vacation' }, { v: 'both', l: 'Some of each' }] },
        builtField('dwYearBuilt', 'Year built', 'Roughly when was it built?'),
        { id: 'dwSqft', type: 'number', label: 'Finished square feet', q: 'About how many finished square feet?', im: 'numeric', ph: 'e.g. 1,600' },
        sel('dwStories', 'Stories', 'How many stories?', ['1', '1.5', '2', '3+'])
      ] },
    { id: 'dwelling1b', step: 'Rental property', title: 'Rental property: the building', sub: 'Type and the year each was last updated. Best guesses are fine.', show: on('dwelling'),
      fields: [
        sel('dwConstruction', 'Construction / exterior', 'What is the exterior?', ['Frame / vinyl', 'Wood siding', 'Brick / masonry', 'Log', 'Metal', 'Other / mixed']),
        typeField('dwSidingType', 'Siding type', 'What is the siding?', SIDING_T), // Round 8: parity with home (shared list)
        typeField('dwRoofType', 'Roof type', 'What type of roof?', ROOF_T),
        yearField('dwRoofYear', 'Roof – year replaced', 'What year was the roof replaced?'),
        Object.assign(typeField('dwHeat', 'Primary heat', 'What is the primary heat?', HEAT_T), { woodLoc: 'dwWoodLoc' }),
        yearField('dwHeatYear', 'Heating – year updated', 'What year was the heating updated?'),
        typeField('dwElecType', 'Electrical type', 'What kind of electrical panel?', ELEC_T),
        yearField('dwElecYear', 'Electrical – year updated', 'What year was the electrical updated?'),
        typeField('dwPlumbType', 'Plumbing type', 'What kind of plumbing pipes?', PLUMB_T),
        yearField('dwPlumbYear', 'Plumbing – year updated', 'What year was the plumbing updated?'),
        Object.assign(tl('dwWood', 'Wood stove, fireplace or pellet stove', 'Any wood stove, fireplace or pellet stove?', ['No', 'Yes – supplemental', 'Yes – primary heat']), { woodLoc: 'dwWoodLoc' }),
        sel('dwScreen', 'Tenant screening', 'Do you screen tenants?', ['Yes – credit, background and references', 'Some screening', 'No formal screening']),
        tl('dwRequireRenters', 'Require renters insurance', 'Do you require tenants to carry renters insurance?', ['Yes', 'No', 'Planning to'])
      ] },
    { id: 'dwelling2', step: 'Rental property', title: 'Rental property coverage', show: on('dwelling'),
      fields: [
        { id: 'dwDed', type: 'tiles', label: 'Deductible', q: 'What deductible?', cols2: true, opts: DED },
        { id: 'dwLiab', type: 'tiles', label: 'Landlord liability', q: 'How much liability?', cols2: true, opts: LIAB },
        { id: 'dwRents', type: 'tiles', label: 'Loss of rent coverage', q: 'Cover lost rent if it can\'t be rented after a claim?', cols2: true, opts: YN },
        { id: 'dwExtras', type: 'multi', label: 'Also quote', q: 'Anything else to quote with it?', opts: [{ v: 'contents', l: 'Appliances / furnishings you own' }, { v: 'flood', l: 'Flood (separate policy)' }, { v: 'none', l: 'Nothing else' }], exclusive: ['none'] },
        { id: 'dwCarrier', type: 'text', label: 'Current insurance company', q: 'Who insures it now?', ph: 'e.g. none / new purchase / company name', list: CAR },
        tl('dwClaims', 'Claims on this property in 5 years', 'Any claims on this property in the last 5 years?', CLAIMS),
        tl('dwOtherProps', 'Other rentals to quote', 'Do you have other rentals we should quote?', ['Just this property', 'Yes – I\'ll list them below']),
        { id: 'dwNotes', type: 'textarea', label: 'Notes', q: 'Anything else? Other addresses, lake property, planned updates, tenant situation…', ph: 'Optional' }
      ] },

    // ================= BOAT & REC =================
    // Round 6: per-vehicle and per-boat cards. Coverage is picked directly on the same card – no "not sure", no "match my current".
    { id: 'rec1', step: 'Boat & rec', title: 'What should we cover?', reviewTitle: 'Boat & rec – what to cover', show: on('rec'),
      fields: [{ id: 'recKinds', type: 'multi', label: 'What to cover', q: 'What would you like covered?', opts: [
        { v: 'vehicles', l: 'ATVs, side-by-sides, snowmobiles, motorcycles, golf carts' }, { v: 'boats', l: 'Boats and personal watercraft' }, { v: 'other', l: 'RV, camper or something else' }] }] },
    { id: 'recVeh', step: 'Boat & rec', title: 'Your rec vehicles', reviewTitle: 'Rec vehicles', sub: 'One card per vehicle. Have the VIN? We\'ll try to fill in the rest – many off-road VINs don\'t decode, so just type year, make and model.',
      show: function (a) { return has(a, 'rec') && recKind(a, 'vehicles'); },
      fields: [{ id: 'recVehicles', type: 'repeater', label: 'Rec vehicles', hideLabel: true, itemLabel: 'Vehicle', addLabel: '+ Add another rec vehicle', softVin: true, unsureLabel: 'Skip – my agent can help',
        sub: [{ k: 'type', l: 'Type', type: 'select', opts: ['ATV', 'UTV / side-by-side', 'Snowmobile', 'Motorcycle', 'Golf cart', 'Dirt bike', 'Other'] },
          { k: 'vin', l: 'VIN (optional)', ph: '17 characters', vin: true },
          { k: 'year', l: 'Year', type: 'select', opts: YEARS }, { k: 'make', l: 'Make', ph: 'e.g. Polaris' }, { k: 'model', l: 'Model', ph: 'e.g. Sportsman 570' },
          { k: 'cc', l: 'Engine size (cc)', im: 'numeric', ph: 'e.g. 1000', rv: 'cc', when: ATVT.concat(SNOWT, MCT) },
          { k: 'drive', l: 'Drive type', type: 'select', opts: ['2WD', '4WD', '6WD / 6x6', 'Side-by-side (SxS)'], when: ATVT },
          { k: 'seats', l: 'Passenger capacity', type: 'select', opts: ['1 (solo)', '2', '3–4', '5+'], when: ATVT },
          { k: 'atvMods', type: 'checks', l: 'Modifications (pick any)', rv: 'Mods', opts: ['Lift / suspension', 'Winch', 'Tracks', 'Plow / blade', 'Lights', 'Street legal kit', 'Cab / enclosure'], when: ATVT },
          { k: 'atvUse', l: 'Primary use', type: 'select', opts: ['Recreational / trail riding', 'Hunting / fishing', 'Work / utility / farm', 'Racing / competitive', 'Ice fishing / grooming'], when: ATVT },
          { k: 'terrain', l: 'Where is it mostly ridden?', type: 'select', opts: ['Public trails (MN DNR)', 'Private land / own property', 'Mix of trails and private', 'Road / street legal use'], when: ATVT },
          { k: 'hours', l: 'Hours or miles per year', ph: 'e.g. 200 hrs', rv: 'Use', when: ATVT },
          { k: 'engine', l: 'Engine type', type: 'select', opts: ['2-stroke', '4-stroke'], when: SNOWT },
          { k: 'track', l: 'Track length / type', type: 'select', opts: ['Short track (trail)', 'Long track (mountain)', 'Hybrid / crossover', 'Touring'], when: SNOWT },
          { k: 'snowMods', type: 'checks', l: 'Major modifications (pick any)', rv: 'Mods', opts: ['Turbo', 'Long track conversion', 'Suspension upgrade', 'Studded track'], when: SNOWT },
          { k: 'snowUse', l: 'Primary use', type: 'select', opts: ['Trail riding / recreation', 'Mountain / off-trail', 'Ice fishing / grooming', 'Racing / snocross', 'Work / trapping'], when: SNOWT },
          { k: 'club', l: 'Snowmobile club member?', type: 'select', opts: ['No', 'Yes – local MN club', 'Yes – multiple clubs'], when: SNOWT },
          { k: 'mcType', l: 'Motorcycle type', type: 'select', opts: ['Cruiser / chopper', 'Sportbike / supersport', 'Touring / bagger', 'Adventure / dual-sport', 'Standard / naked', 'Dirt bike / enduro', 'Trike', 'Scooter'], when: MCT },
          { k: 'abs', l: 'ABS brakes?', type: 'select', opts: ['Yes', 'No'], when: MCT },
          { k: 'accValue', l: 'Aftermarket / custom parts (est. value)', im: 'numeric', ph: 'e.g. $3,500', rv: 'Custom parts', when: MCT },
          { k: 'mcUse', l: 'Primary use', type: 'select', opts: ['Pleasure / weekend', 'Commuting', 'Long-distance touring', 'Track / club racing', 'Off-road / dual-sport'], when: MCT },
          { k: 'msf', l: 'Safety course completed?', type: 'select', opts: ['No', 'Yes – basic MSF', 'Yes – advanced'], when: MCT },
          { k: 'miles', l: 'Miles per year', im: 'numeric', ph: 'e.g. 1,500', rv: 'Miles/yr', when: SNOWT.concat(MCT) },
          { k: 'covHd', type: 'hd', l: 'Coverage for this vehicle' },
          { k: 'liab', l: 'Liability limits', type: 'select', noUnsure: true, rv: 'Liability', opts: ['No liability', '$25K / $50K', '$50K / $100K', '$100K / $300K (common choice)', '$250K / $500K'] },
          { k: 'compDed', l: 'Comprehensive deductible (theft, fire, hitting an animal)', type: 'select', noUnsure: true, rv: 'Comp', opts: ['No comprehensive', '$100', '$250', '$500 (common choice)', '$1,000', '$2,500'] },
          { k: 'collDed', l: 'Collision deductible', type: 'select', noUnsure: true, rv: 'Collision', opts: ['No collision', '$100', '$250', '$500 (common choice)', '$1,000', '$2,500'] },
          { k: 'insValue', l: 'Insured value', im: 'numeric', ph: 'e.g. $12,000', rv: 'Value' },
          { k: 'accessories', l: 'Accessories & added equipment (plows, winches, racks)', type: 'select', noUnsure: true, rv: 'Accessories', opts: ['None', 'Up to $1,000', 'Up to $2,500', 'Up to $5,000', 'More than $5,000'] },
          { k: 'apparel', l: 'Riding gear / safety apparel', type: 'select', noUnsure: true, rv: 'Gear', opts: ['Not needed', 'Up to $1,000', 'Up to $2,500'] },
          { k: 'roadside', l: 'Roadside / trail rescue & towing', type: 'select', noUnsure: true, rv: 'Roadside', opts: ['Yes', 'No'] },
          { k: 'layup', l: 'Off-season storage coverage', type: 'select', noUnsure: true, rv: 'Storage', opts: ['Yes', 'No'], when: ATVT.concat(SNOWT) },
          { k: 'trailPermit', l: 'Trail club / permit discount', type: 'select', noUnsure: true, rv: 'Trail permit', opts: ['Yes', 'No'], when: ATVT },
          { k: 'umc', l: 'Uninsured / underinsured motorist', type: 'select', noUnsure: true, rv: 'UM', opts: ['Yes', 'No'], when: MCT },
          { k: 'passenger', l: 'Passenger liability', type: 'select', noUnsure: true, rv: 'Passenger', opts: ['Yes', 'No'], when: MCT }] }] },
    { id: 'recBoat', step: 'Boat & rec', title: 'Your boats', reviewTitle: 'Boats', sub: 'One card per boat, with its motors and coverage. Skip anything you don\'t have handy.',
      show: function (a) { return has(a, 'rec') && recKind(a, 'boats'); },
      fields: [{ id: 'recBoats', type: 'repeater', label: 'Boats', hideLabel: true, itemLabel: 'Boat', addLabel: '+ Add another boat', unsureLabel: 'Skip – my agent can help',
        sub: [{ k: 'type', l: 'Type of boat', type: 'select', opts: ['Fishing boat', 'Bass boat', 'Pontoon / tritoon', 'Runabout / bowrider', 'Wake / ski boat', 'Cuddy / cruiser', 'Houseboat', 'Sailboat', 'Personal watercraft (jet ski)', 'Canoe / kayak', 'Other'] },
          { k: 'hin', l: 'Hull ID / HIN (optional)', ph: '12 characters, on the transom', hin: true, rv: 'HIN' },
          { k: 'mnReg', l: 'MN registration # (optional)', ph: 'e.g. MN 1234 AB', rv: 'MN reg' },
          { k: 'year', l: 'Year', type: 'select', opts: YEARS }, { k: 'make', l: 'Make', ph: 'e.g. Lund' }, { k: 'model', l: 'Model', ph: 'e.g. 1875 Impact' },
          { k: 'length', l: 'Length (ft)', im: 'numeric', ph: 'e.g. 18', rv: 'ft' },
          { k: 'hull', l: 'Hull material', type: 'select', opts: ['Aluminum', 'Fiberglass', 'Pontoon / tritoon', 'Wood', 'Inflatable / RIB', 'Other'] },
          { k: 'drive', l: 'Engine / drive type', type: 'select', opts: ['Outboard', 'Inboard', 'Sterndrive (I/O)', 'Jet drive', 'Sail (no engine)'] },
          { k: 'motors', type: 'motors', l: 'Motors' },
          { k: 'waters', l: 'Main waters used', ph: 'e.g. Lake Winnibigoshish, Mississippi River', rv: 'Waters' },
          { k: 'mooring', l: 'Where is it kept?', type: 'select', opts: ['Marina slip (wet)', 'Private dock / lift', 'On a trailer at home', 'Dry stack / indoor storage', 'Mooring buoy', 'Winter storage only (seasonal)'] },
          { k: 'sports', l: 'Water sports / towing', type: 'select', opts: ['None', 'Tubing / water skiing', 'Wakeboarding / wake surfing', 'Fishing only', 'Cruising / overnight'] },
          { k: 'months', l: 'Months used per year', ph: 'e.g. 5 (May–Oct)', rv: 'Months' },
          { k: 'covHd', type: 'hd', l: 'Coverage for this boat' },
          { k: 'liab', l: 'Liability', type: 'select', noUnsure: true, rv: 'Liability', opts: ['$100,000', '$300,000 (common choice)', '$500,000', '$1,000,000'] },
          { k: 'physDed', l: 'Physical damage deductible', type: 'select', noUnsure: true, rv: 'Deductible', opts: ['Liability only (no damage coverage)', '$100', '$250', '$500 (common choice)', '$1,000', '$2,500'] },
          { k: 'valueType', l: 'Hull coverage type', type: 'select', noUnsure: true, rv: 'Hull', opts: ['Agreed value (recommended)', 'Actual cash value'] },
          { k: 'insValue', l: 'Insured value', im: 'numeric', ph: 'e.g. $25,000', rv: 'Value' },
          { k: 'uninsured', l: 'Uninsured / underinsured boater', type: 'select', noUnsure: true, rv: 'Uninsured boater', opts: ['Yes', 'No'] },
          { k: 'medical', l: 'Guest medical payments', type: 'select', noUnsure: true, rv: 'Guest medical', opts: ['Yes', 'No'] },
          { k: 'effects', l: 'Personal effects / gear', type: 'select', noUnsure: true, rv: 'Effects', opts: ['Yes', 'No'] },
          { k: 'layup', l: 'Winter storage / shrink wrap', type: 'select', noUnsure: true, rv: 'Winter storage', opts: ['Yes', 'No'] },
          { k: 'trailer', l: 'Cover the trailer?', type: 'select', noUnsure: true, rv: 'Trailer', opts: ['Yes', 'No', 'No trailer'] },
          { k: 'tow', l: 'On-water towing / assistance', type: 'select', noUnsure: true, rv: 'Towing', opts: ['Yes', 'No'] }] }] },
    { id: 'recOther', step: 'Boat & rec', title: 'RV, camper or other', reviewTitle: 'Other rec items', show: function (a) { return has(a, 'rec') && recKind(a, 'other'); },
      fields: [{ id: 'recItems', type: 'repeater', label: 'Other rec items', hideLabel: true, itemLabel: 'Item', addLabel: '+ Add another item', unsureLabel: 'Skip – my agent can help',
        sub: [{ k: 'type', l: 'Type', type: 'select', opts: RVT.concat(['Fish house', 'Other']) },
          { k: 'year', l: 'Year', type: 'select', opts: YEARS }, { k: 'make', l: 'Make', ph: 'e.g. Jayco' }, { k: 'model', l: 'Model', ph: 'e.g. Eagle 5th wheel' },
          { k: 'vin', l: 'VIN / chassis # (optional)', ph: 'VIN', rv: 'VIN' },
          { k: 'length', l: 'Length (ft) and GVWR', ph: 'e.g. 32 ft / 12,000 lbs', rv: 'Size', when: RVT },
          { k: 'slides', l: 'Slide-outs', type: 'select', opts: ['None', '1 slide', '2 slides', '3 or more'], when: RVT },
          { k: 'features', type: 'checks', l: 'Special features (pick any)', rv: 'Features', opts: ['Onboard generator', 'Solar panels', 'Auto leveling jacks', 'Full body paint'], when: RVT },
          { k: 'usage', l: 'How is it used?', type: 'select', opts: ['Seasonal / weekend only', 'Extended summer travel', 'Full-time living (full-timer)', 'Winter getaways / snowbird', 'Mostly stored (rare use)'], when: RVT },
          { k: 'storage', l: 'Where is it stored?', type: 'select', opts: ['At home (driveway)', 'Garage / pole shed', 'Outside, covered', 'RV storage facility', 'Seasonal RV park', 'Indoor heated storage'] },
          { k: 'towVehicle', l: 'If towed: tow vehicle', ph: 'e.g. 2022 Ford F-250', rv: 'Tow vehicle', when: RVT },
          { k: 'covHd', type: 'hd', l: 'Coverage for this item' },
          { k: 'liab', l: 'Liability', type: 'select', noUnsure: true, rv: 'Liability', opts: ['$100,000', '$300,000 (common choice)', '$500,000'] },
          { k: 'physDed', l: 'Physical damage deductible', type: 'select', noUnsure: true, rv: 'Deductible', opts: ['Liability only', '$250', '$500 (common choice)', '$1,000', '$2,500'] },
          { k: 'valueType', l: 'Damage coverage type', type: 'select', noUnsure: true, rv: 'Valuation', opts: ['Agreed value', 'Actual cash value'] },
          { k: 'value', l: 'Insured value', im: 'numeric', ph: 'e.g. $45,000', rv: 'Value' },
          { k: 'contents', l: 'Personal contents / effects', type: 'select', noUnsure: true, rv: 'Contents', opts: ['Yes', 'No'], when: RVT },
          { k: 'roadside', l: 'RV roadside / emergency towing', type: 'select', noUnsure: true, rv: 'Roadside', opts: ['Yes', 'No'], when: RVT },
          { k: 'rental', l: 'Rental reimbursement while traveling', type: 'select', noUnsure: true, rv: 'Rental', opts: ['Yes', 'No'], when: RVT },
          { k: 'awning', l: 'Awning / slide-out / leveling coverage', type: 'select', noUnsure: true, rv: 'Awning', opts: ['Yes', 'No'], when: RVT },
          { k: 'fulltimer', l: 'Full-timer coverage', type: 'select', noUnsure: true, rv: 'Full-timer', opts: ['Yes', 'No'], when: RVT }] }] },
    { id: 'recMore', step: 'Boat & rec', title: 'Boat & rec: a few last questions', reviewTitle: 'Boat & rec – history', show: on('rec'),
      fields: [
        sel('recAntiTheft', 'Anti-theft devices', 'Any anti-theft devices?', ['None', 'Alarm system', 'GPS tracker', 'Wheel lock / chain', 'Multiple security features']),
        sel('recSafety', 'Safety courses', 'Any safety courses completed?', ['No', 'Yes – ATV / snowmobile safety', 'Yes – boating safety', 'Yes – motorcycle safety']),
        tl('recInsured', 'Current rec insurance', 'Do you have rec insurance now?', [{ v: 'new', l: 'No – new to rec insurance' }, { v: 'other', l: 'Yes – with another company' }, { v: 'renew', l: 'Yes – renewing with my current company' }]),
        { id: 'recCarrier', type: 'text', label: 'Current insurance company', q: 'Who insures them now?', ph: CPH, list: CAR, show: function (a) { return a.recInsured !== 'new'; } },
        tl('recClaims', 'Claims or accidents in 5 years', 'Any claims or accidents in the last 5 years?', CLAIMS),
        { id: 'recNotes', type: 'textarea', label: 'Anything else?', q: 'Anything else we should know?', ph: 'Optional' }
      ] },

    // ================= UMBRELLA =================
    { id: 'umbrella1', step: 'Umbrella', title: 'Umbrella coverage', sub: 'Extra liability on top of your home and auto.', show: on('umbrella'),
      fields: [
        { id: 'umbLimit', type: 'tiles', label: 'Limit wanted', q: 'How much extra liability would you like?', cols2: true, opts: [{ v: '1M', l: '$1 million' }, { v: '2M', l: '$2 million' }, { v: '3M', l: '$3 million' }, { v: '5M', l: '$5 million' }], unsureLabel: 'I\'m not sure' },
        { id: 'umbExtra', type: 'multi', label: 'Anything extra it should cover?', q: 'Anything extra it should cover?', opts: [{ v: 'rental', l: 'Rental property' }, { v: 'boats', l: 'Boats / rec' }, { v: 'teen', l: 'Young drivers' }, { v: 'pool', l: 'Pool, trampoline or dog' }, { v: 'board', l: 'Volunteer / board work' }, { v: 'none', l: 'Nothing extra' }], exclusive: ['none'] },
        { id: 'umbCarrier', type: 'text', label: 'Current umbrella company', q: 'Do you have an umbrella now? With who?', ph: 'e.g. none, or carrier name' }
      ] },

    // ================= LIFE =================
    { id: 'life1', step: 'Life', title: 'Life insurance', show: on('life'),
      fields: [
        { id: 'lifeWho', type: 'tiles', label: 'Who needs coverage?', q: 'Who needs coverage?', cols2: true, opts: [{ v: 'me', l: 'Me' }, { v: 'spouse', l: 'My spouse / partner' }, { v: 'both', l: 'Both of us' }, { v: 'other', l: 'Someone else' }] },
        tl('lifePurpose', 'What the coverage is for', 'What is the coverage for?', ['Income replacement', 'Mortgage / debt payoff', 'Final expenses', 'Family protection']),
        { id: 'lifeType', type: 'tiles', label: 'Type of policy', q: 'What kind of policy?', cols2: true, opts: [{ v: 'term', l: 'Term (set number of years)' }, { v: 'perm', l: 'Permanent / whole life' }, { v: 'final', l: 'Final expense' }], unsureLabel: 'I\'m not sure' },
        { id: 'lifeAmount', type: 'tiles', label: 'Coverage amount', q: 'How much coverage?', cols2: true, opts: [{ v: '50k', l: '$50,000' }, { v: '100k', l: '$100,000' }, { v: '250k', l: '$250,000' }, { v: '500k', l: '$500,000' }, { v: '1m', l: '$1 million' }, { v: '1m+', l: 'More than $1 million' }], unsureLabel: 'I\'m not sure' },
        { id: 'lifeTerm', type: 'tiles', label: 'Term length', q: 'For how many years?', cols2: true, opts: [{ v: '10', l: '10 years' }, { v: '15', l: '15 years' }, { v: '20', l: '20 years' }, { v: '30', l: '30 years' }], show: function (a) { return a.lifeType === 'term'; } }
      ] },
    { id: 'life2', step: 'Life', title: 'Life insurance – a bit about health', sub: 'Rough answers are fine. Your agent handles the details privately.', show: on('life'),
      fields: [
        tl('lifeSex', 'Sex (for quoting)', 'Sex (used for quoting)?', ['Female', 'Male']),
        { id: 'lifeHeight', type: 'text', label: 'Height', q: 'Height?', ph: 'e.g. 5\'10"' },
        { id: 'lifeWeight', type: 'text', label: 'Weight', q: 'Weight?', im: 'numeric', ph: 'e.g. 180 lbs' },
        { id: 'lifeOccupation', type: 'text', label: 'Occupation', q: 'What do you do for work?', ph: 'e.g. Nurse' },
        { id: 'lifeTobacco', type: 'tiles', label: 'Tobacco or nicotine in the last 12 months?', q: 'Any tobacco or nicotine in the last 12 months?', cols2: true, opts: YN },
        { id: 'lifeHealth', type: 'tiles', label: 'Overall health', q: 'How would you rate your overall health?', cols2: true, opts: [{ v: 'excellent', l: 'Excellent' }, { v: 'good', l: 'Good' }, { v: 'fair', l: 'Fair' }, { v: 'poor', l: 'Poor' }] },
        { id: 'lifeExisting', type: 'text', label: 'Any life insurance now?', q: 'Any life insurance now (work or personal)?', ph: 'e.g. $50K through work' },
        { id: 'lifeBeneficiary', type: 'text', label: 'Primary beneficiary', q: 'Who would be the primary beneficiary?', ph: 'Name' },
        { id: 'lifeNotes', type: 'textarea', label: 'Health notes or questions', q: 'Any health notes or questions?', ph: 'Conditions, medications or anything that might affect underwriting' }
      ] }
  ]
  // ================= BUSINESS (full section; matches the live business form) =================
  .concat(window.BIZ_SECTION({ inPersonal: true }))
  .concat([
    { id: 'notsure', step: 'Your situation', title: 'Tell us a little about what\'s going on', show: on('notsure'),
      fields: [{ id: 'notsureText', type: 'textarea', label: 'What would you like help with?', q: 'What would you like help with?', ph: 'e.g. just bought a house, new driver, starting a side business…' }] },

    // ================= WRAP-UP =================
    { id: 'wrap', step: 'Wrap-up', title: 'One last thing', reviewTitle: 'Timing',
      fields: [
        { id: 'startDate', type: 'date', label: 'When should coverage start?', q: 'When would you like coverage to start?' }
      ] },

    { id: 'review', kind: 'review', step: 'Review', title: 'Review and send' },
    { id: 'confirm', kind: 'confirm', step: 'Done', title: '' }
  ]);
  window.PERSONAL_SCREENS = screens;

  // Variant A: same strict per-product order, plus a checkpoint right after the basics
  // ("That's enough to get started: Send now, or add more details").
  var checkpoint = { id: 'checkpoint', kind: 'checkpoint', step: 'Key details', title: 'That\'s enough to get started',
    sub: 'Send it to your agent now, or keep going product by product for a sharper first quote. Both are fine.',
    fields: [{ id: 'decUploadF', type: 'upload', label: 'Upload your dec page (optional)' }] };
  // business-only (no home/auto): the checkpoint comes after the business rate drivers (type, details, revenue/employees, building) instead
  var bizOnly = function (a) { return has(a, 'business') && !has(a, 'home') && !has(a, 'auto'); };
  checkpoint.show = function (a) { return !bizOnly(a); };
  var cpBiz = { id: 'checkpointBiz', kind: 'checkpoint', step: 'Business', title: 'That\'s enough to get started', sub: checkpoint.sub, show: bizOnly, fields: checkpoint.fields };
  var A = screens.filter(function (s) { return s.id !== 'upload'; }), at = A.map(function (s) { return s.id; }).indexOf('home1');
  if (at < 0) at = A.map(function (s) { return s.id; }).indexOf('auto3');
  A.splice(at, 0, checkpoint);
  var bz = A.map(function (s) { return s.id; }).indexOf('biz5'); if (bz > -1) A.splice(bz + 1, 0, cpBiz);
  window.PERSONAL_SCREENS_A = A;
  // Round 6 direction change: B (main build) uses the same order + checkpoints; QF splits it one question per screen (kind screens stay whole).
  // Round 9 (Josh picked B): no early "Send now" in B. Each checkpoint becomes a plain, optional dec-page upload
  // screen with the normal primary "Continue"; the only way to send is "Send to my agent" on Review.
  function cpToUpload(cp, id) { return { id: id, step: cp.step, show: cp.show, title: 'Have your current policy?', reviewTitle: 'Current policy upload',
    sub: 'Optional. Upload your declarations (dec) page and your agent can fill in the rest. Or just tap Continue – there are a few more questions to go.',
    fields: [{ id: 'decUploadF', type: 'upload', label: 'Upload your dec page (optional)' }], cta: 'Continue', keep: true }; }
  window.PERSONAL_SCREENS_B = A.map(function (s) { return s === checkpoint ? cpToUpload(s, 'cpUpload') : s === cpBiz ? cpToUpload(s, 'cpUploadBiz') : s; });
  // Round 10: in B, auto coverage (auto3) comes right after drivers + vehicles (auto1, auto2), before the policy upload
  // and the Home section. Root cause of the miss: the strict per-product order put auto3 after the whole Home section,
  // so in Home + Auto / bundle / combos coverage was only asked ~30 screens later, after all the home questions.
  (function () { var B = window.PERSONAL_SCREENS_B, ids = function () { return B.map(function (s) { return s.id; }); };
    var polS = B.splice(ids().indexOf('auto3p'), 1)[0], cov = B.splice(ids().indexOf('auto3'), 1)[0]; B.splice(ids().indexOf('auto2') + 1, 0, polS, cov); })();
})();
