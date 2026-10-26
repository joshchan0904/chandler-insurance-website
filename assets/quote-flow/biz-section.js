/* Shared business section for variants A, B (inside the multi-product flow) and C (business-only).
   Covers every field on the live business form (chandlerinsurancemn.com/business-quote.html, read-only reference)
   plus operations, payroll, FT/PT employees, building details, vehicles/drivers, coverages wanted and history.
   Every question can be skipped or answered "not sure". EIN is optional and masked; only "provided" + last 2 are sent. */
(function () {
  var has = QF.has, U = QF.UNSURE;
  var YN = [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No' }];
  function arr(a, k) { return Array.isArray(a[k]) ? a[k] : []; }
  function want(v) { return function (a) { return arr(a, 'bizWant').indexOf(v) > -1; }; }
  function emp(a) { return (+QF.cleanStr(a.bizFT) || 0) + (+QF.cleanStr(a.bizPT) || 0) > 0; }
  function bldg(a) { return a.bizSpace === 'own' || a.bizSpace === 'lease'; }
  var BIZ_YEARS = []; for (var by = new Date().getFullYear() + 1; by >= 1981; by--) BIZ_YEARS.push(String(by)); BIZ_YEARS.push('1980 or older');
  // Round 7: update years use the same dropdown as home (this year back to 1960, then Before 1960 / Original); "I'm not sure" is appended by the card select
  var BIZ_UPD = []; for (var bu = new Date().getFullYear(); bu >= 1960; bu--) BIZ_UPD.push(String(bu)); BIZ_UPD.push('Before 1960', 'Original to the building');
window.BIZ_SECTION = function (o) {
    var P = !!o.inPersonal;
    var isBiz = function (a) { return has(a, 'business'); };
    function sh(extra) { return function (a) { return isBiz(a) && (!extra || extra(a)); }; }
    var out = [];
    out.push({ id: 'biz1', step: 'Business', encourage: true, title: P ? 'About the business' : 'What do you do?', reviewTitle: 'About the business', show: sh(),
      fields: (P ? [{ id: 'bizType', type: 'bizsearch', label: 'Type of business', q: 'What kind of business is it?' }] : []).concat([
        { id: 'bizDesc', type: 'textarea', label: 'Describe your operations', q: 'Describe what the business does', ph: 'e.g. We do septic installs and site prep around Itasca County. 3 crews, mostly residential.' }
      ]) });
    out.push({ id: 'biz2', step: 'Business', title: P ? 'Business name and location' : function (a) { return 'Hi there' + (QF.first(a) ? ', ' + QF.first(a) : '') + '! Where\'s the business?'; },
      reviewTitle: P ? 'Business name and location' : 'Business name, address & start date', show: sh(),
      fields: [
        { id: 'hardNote', type: 'info', cls: 'note-warn', html: 'An agent will call you about this one. Some carriers are picky with this type of business, so we\'ll talk it through. Keep going – your answers still help.', show: function (a) { return !P && !!a.bizType_hard; } },
        { id: 'bizName', type: 'text', label: 'Business name', q: 'What\'s the business called?', ac: 'organization' },
        { id: 'bizDba', type: 'text', label: 'DBA / trade name (if different)', q: 'Any DBA or trade name?', ph: 'Optional' },
        { id: 'bizAddr', type: 'address', apt: true, label: 'Business address', q: 'Where\'s the business located?' }
      ].concat(P ? [] : [{ id: 'startDate', type: 'date', label: 'When should coverage start?', q: 'When should coverage start?' }]) });
    out.push({ id: 'biz3', step: 'Business', encourage: true, title: 'Business details', show: sh(),
      fields: [
        { id: 'bizStructure', type: 'tiles', label: 'Business structure', q: 'How is the business set up?', cols2: true, opts: [{ v: 'llc', l: 'LLC' }, { v: 'ccorp', l: 'C-Corp' }, { v: 'scorp', l: 'S-Corp' }, { v: 'sole', l: 'Sole proprietor' }, { v: 'partnership', l: 'Partnership' }, { v: 'nonprofit', l: 'Nonprofit' }] },
        { id: 'bizEin', type: 'secret', label: 'EIN / federal tax ID (optional)', q: 'Business EIN (optional)', hint: 'Business tax ID only. Never enter a Social Security number – sole proprietors without an EIN can skip this.', unsureLabel: 'I\'ll give it to my agent', fuLabel: 'EIN (agent will ask)' },
        { id: 'bizYears', type: 'tiles', label: 'Years in business', q: 'How long have you been in business?', cols2: true, opts: [{ v: '<1', l: 'Less than 1 year' }, { v: '1-3', l: '1–3 years' }, { v: '4-7', l: '4–7 years' }, { v: '8-15', l: '8–15 years' }, { v: '15+', l: '15+ years' }] },
        { id: 'bizOwnerExp', type: 'tiles', label: 'Owner experience in this industry', q: 'How many years have you (the owner) worked in this industry?', cols2: true, opts: [{ v: '<1', l: 'Less than 1 year' }, { v: '1-3', l: '1–3 years' }, { v: '4-10', l: '4–10 years' }, { v: '10+', l: '10+ years' }] }
      ] });
    out.push({ id: 'biz4', step: 'Business', encourage: true, title: 'Revenue and employees', sub: 'Estimates are fine.', show: sh(),
      fields: [
        { id: 'bizRevenue', type: 'tiles', label: 'Annual revenue', q: 'Rough annual revenue? Estimates are fine.', cols2: true, opts: [{ v: '<50k', l: 'Under $50K' }, { v: '50-100k', l: '$50K–$100K' }, { v: '100-250k', l: '$100K–$250K' }, { v: '250-500k', l: '$250K–$500K' }, { v: '500k-1m', l: '$500K–$1M' }, { v: '1-5m', l: '$1M–$5M' }, { v: '5m+', l: 'Over $5M' }] },
        { id: 'bizFT', type: 'number', label: 'Full-time employees (besides owners)', q: 'How many full-time employees, besides owners?', im: 'numeric', ph: 'e.g. 4', min: 0 },
        { id: 'bizPT', type: 'number', label: 'Part-time employees', q: 'How many part-time employees?', im: 'numeric', ph: 'e.g. 2', min: 0 },
        { id: 'bizPayroll', type: 'text', label: 'Annual payroll (estimate)', q: 'About how much is annual payroll?', im: 'numeric', ph: 'e.g. $250,000', show: emp },
        { id: 'bizStates', type: 'multi', label: 'States where employees work', q: 'Which states do employees work in?', cols2: true, opts: [{ v: 'MN', l: 'Minnesota' }, { v: 'WI', l: 'Wisconsin' }, { v: 'ND', l: 'North Dakota' }, { v: 'IA', l: 'Iowa' }, { v: 'MI', l: 'Michigan' }, { v: 'other', l: 'Other' }], show: emp },
        { id: 'bizSubs', type: 'tiles', label: 'Do you use subcontractors?', q: 'Do you use subcontractors?', cols2: true, opts: [{ v: 'no', l: 'No' }, { v: 'occasionally', l: 'Occasionally' }, { v: 'frequently', l: 'Frequently' }] },
        { id: 'bizSubCost', type: 'text', label: 'About how much do you pay subs a year?', q: 'About how much do you pay subs a year?', im: 'numeric', ph: 'e.g. $40,000', show: function (a) { return a.bizSubs === 'occasionally' || a.bizSubs === 'frequently'; } }
      ] });
    out.push({ id: 'biz5', step: 'Business', encourage: true, title: 'Your building', sub: 'We\'ll skip what doesn\'t apply.', show: sh(),
      fields: [
        { id: 'bizSpace', type: 'tiles', label: 'Where do you work from?', q: 'Where do you work from?', opts: [{ v: 'own', l: 'We own our building' }, { v: 'lease', l: 'We lease space' }, { v: 'home', l: 'Home-based' }, { v: 'mobile', l: 'On the road / job sites' }] },
        { id: 'bizBldgCov', type: 'tiles', label: 'Cover the building itself?', q: 'Should we quote coverage for the building itself?', cols2: true, opts: [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No building coverage' }], show: function (a) { return a.bizSpace === 'own' || a.bizSpace === 'lease'; } },
        { id: 'bizBuildings', type: 'repeater', label: 'Buildings', q: 'Tell us about each building', itemLabel: 'Building', addLabel: '+ Add another building', show: bldg,
          hint: 'One card per building or location. Skip anything you don\'t know.', unsureLabel: 'Skip – my agent can help',
          sub: [{ k: 'addr', l: 'Address (if different from the business address)', ph: 'Optional' },
            { k: 'sqft', l: 'Square feet', ph: 'e.g. 3,200', im: 'numeric' },
            { k: 'yearBuilt', l: 'Year built', ph: 'e.g. 1995', yr: true },
            { k: 'construction', l: 'Construction', type: 'select', opts: ['Wood frame', 'Brick / masonry', 'Metal / steel (non-combustible)', 'Concrete / fire-resistive'] },
            { k: 'sprinklers', l: 'Sprinklers?', type: 'select', opts: ['Yes', 'No'] },
            { k: 'alarms', l: 'Monitored alarms', type: 'select', opts: ['Fire alarm', 'Burglar alarm', 'Both', 'None'] },
            // Round 6: a type next to each update year (selects add "I'm not sure" automatically)
            { k: 'sidingType', l: 'Exterior / siding', type: 'select', opts: QF.SYS.siding.map(function (o) { return o.l; }) },
            { k: 'roofType', l: 'Roof material', type: 'select', opts: QF.SYS.roof.map(function (o) { return o.l; }) },
            { k: 'roofYear', l: 'Roof – year replaced', type: 'select', opts: BIZ_UPD },
            { k: 'elecType', l: 'Electrical panel / wiring', type: 'select', opts: QF.SYS.elec.map(function (o) { return o.l; }) },
            { k: 'elecYear', l: 'Electrical – year updated', type: 'select', opts: BIZ_UPD },
            { k: 'plumbType', l: 'Plumbing pipe material', type: 'select', opts: QF.SYS.plumb.map(function (o) { return o.l; }) },
            { k: 'plumbYear', l: 'Plumbing – year updated', type: 'select', opts: BIZ_UPD },
            { k: 'hvacType', l: 'Heating / HVAC type', type: 'select', opts: QF.SYS.bizHvacExtra.concat(QF.SYS.heat).map(function (o) { return o.l; }) },
            // Round 10: wood / solid-fuel heat -> where is it? (optional, shows right under the HVAC type)
            { k: 'woodLoc', l: 'Where is it located? (optional)', cls: 'woodloc', hint: 'e.g., living room, basement, garage, or outdoor boiler and how far from the house', ph: 'e.g., living room, basement, garage, or outdoor boiler and how far from the house', when: ['Wood / pellet stove'], whenKey: 'hvacType', rv: 'Wood heat location:' },
            { k: 'hvacYear', l: 'HVAC / heating – year updated', type: 'select', opts: BIZ_UPD },
            { k: 'bldgValue', l: 'Building value to rebuild (if you own it)', ph: 'e.g. $600,000', im: 'numeric' },
            { k: 'contents', l: 'Contents, equipment & inventory value', ph: 'e.g. $120,000', im: 'numeric' }] },
        { id: 'bizContents', type: 'text', label: 'Contents, equipment & inventory value', q: 'Value of contents, equipment and inventory?', im: 'numeric', ph: 'e.g. $120,000', show: function (a) { return a.bizSpace === 'home' || a.bizSpace === 'mobile'; } }
      ] });
    out.push({ id: 'biz6', step: 'Business', title: 'Business vehicles', show: sh(),
      fields: [
        { id: 'bizHasVehicles', type: 'tiles', label: 'Any vehicles used for the business?', q: 'Any vehicles used for the business?', cols2: true, opts: YN },
        { id: 'bizVehCount', type: 'number', label: 'Total owned / leased vehicles', q: 'How many vehicles in total (owned or leased)?', im: 'numeric', show: function (a) { return a.bizHasVehicles === 'yes'; } },
        { id: 'bizVehicles', type: 'repeater', label: 'Business vehicles', q: 'List the vehicles', itemLabel: 'Vehicle', addLabel: '+ Add another vehicle', show: function (a) { return a.bizHasVehicles === 'yes'; },
          hint: 'VIN fills in year, make and model. No VIN? Pick year, then make, then model.',
          sub: [{ k: 'vin', l: 'VIN (optional)', ph: '17 characters', vin: true }, { k: 'year', l: 'Year', type: 'select', opts: BIZ_YEARS }, { k: 'make', l: 'Make', type: 'make', ph: 'e.g. Ford' }, { k: 'model', l: 'Model', type: 'model', ph: 'e.g. F-250' },
            { k: 'type', l: 'Type', type: 'select', opts: ['Car / SUV', 'Pickup', 'Van', 'Box truck', 'Semi / tractor', 'Dump truck', 'Service truck', 'Trailer', 'Other'] },
            { k: 'value', l: 'Approximate value', ph: 'e.g. $35,000', im: 'numeric' },
            { k: 'use', l: 'Primary use', type: 'select', opts: ['Service calls', 'Sales', 'Hauling tools & equipment', 'Delivery', 'Hauling for others', 'Long haul', 'Construction', 'Employee commute', 'Other'] },
            { k: 'radius', l: 'Usual radius', type: 'select', opts: ['Local (under 50 miles)', 'Intermediate (50–150 miles)', 'Long haul (over 150 miles)'] },
            { k: 'compDed', l: 'Comprehensive deductible', type: 'select', noUnsure: true, opts: ['No comprehensive', '$250', '$500', '$1,000', '$2,500'] },
            { k: 'collDed', l: 'Collision deductible', type: 'select', noUnsure: true, opts: ['No collision', '$250', '$500', '$1,000', '$2,500'] },
            { k: 'glass', l: 'Glass coverage', type: 'select', noUnsure: true, opts: ['None', 'Limited', 'Full glass'] }] },
        { id: 'bizHired', type: 'tiles', label: 'Rent vehicles or have employees drive their own for work?', q: 'Rent vehicles, or have employees drive their own cars for work?', cols2: true, opts: [{ v: 'no', l: 'No' }, { v: 'occasionally', l: 'Occasionally' }, { v: 'regularly', l: 'Regularly' }] }
      ] });
    out.push({ id: 'biz7', step: 'Business', title: 'Business drivers', show: sh(function (a) { return a.bizHasVehicles === 'yes'; }),
      fields: [{ id: 'bizDrivers', type: 'repeater', label: 'Drivers', q: 'Who drives the business vehicles?', hideLabel: true, itemLabel: 'Driver', addLabel: '+ Add another driver',
        seed: function (a) { return { name: [QF.cleanStr(a.firstName), QF.cleanStr(a.lastName)].filter(Boolean).join(' ') }; },
        sub: [{ k: 'name', l: 'Name' }, { k: 'dob', l: 'Date of birth (optional)', t: 'date' }, { k: 'dl', type: 'dl' },
          { k: 'cdl', l: 'Years with a CDL (if any)', type: 'select', opts: ['No CDL', 'Under 1 year', '1–3 years', '3+ years'] },
          { k: 'pct', l: 'How much do they drive?', type: 'select', opts: ['Most of the time', 'Some of the time', 'Rarely'] },
          { k: 'violations', l: 'Tickets or accidents in 3 years', type: 'select', opts: ['None', '1', '2 or more'] }] }] });
    out.push({ id: 'biz8', step: 'Business', title: 'Coverage you want', show: sh(),
      fields: [
        { id: 'bizWant', type: 'multi', label: 'Coverages you\'d like quoted', q: 'Which coverages would you like quoted? Pick all that apply.', unsure: false,
          opts: [{ v: 'gl', l: 'General liability' }, { v: 'property', l: 'Commercial property' }, { v: 'bop', l: 'Business owner\'s policy (BOP)', s: 'Liability + property together' }, { v: 'auto', l: 'Commercial auto' }, { v: 'wc', l: 'Workers\' comp' }, { v: 'umbrella', l: 'Commercial umbrella' }, { v: 'eo', l: 'Professional liability (E&O)' }, { v: 'cyber', l: 'Cyber' }, { v: 'dando', l: 'Directors & officers (D&O)' }, { v: 'crime', l: 'Crime / employee theft' }, { v: 'other', l: 'Other' }] },
        { id: 'bizWantOther', type: 'text', label: 'Other coverage', q: 'What other coverage?', ph: 'e.g. inland marine, liquor liability, bonds', show: want('other') }
      ] });
    out.push({ id: 'biz9', step: 'Business', title: 'Coverage details', sub: 'Only for the coverages you picked. Pick a limit for each – the common choice is marked.',
      show: sh(function (a) { return ['gl', 'bop', 'eo', 'dando', 'crime', 'wc'].some(function (v) { return arr(a, 'bizWant').indexOf(v) > -1; }); }),
      fields: [
        { id: 'glOcc', type: 'tiles', unsure: false, label: 'General liability – per occurrence', q: 'General liability limit per occurrence?', cols2: true, opts: [{ v: '500k', l: '$500K' }, { v: '1m', l: '$1M (most common)' }, { v: '2m', l: '$2M' }, { v: '5m', l: '$5M' }, { v: '10m', l: '$10M+' }], show: function (a) { return want('gl')(a) || want('bop')(a); } },
        { id: 'glAgg', type: 'tiles', unsure: false, label: 'General liability – aggregate', q: 'General liability aggregate limit?', cols2: true, opts: [{ v: '1m', l: '$1M' }, { v: '2m', l: '$2M (most common)' }, { v: '4m', l: '$4M' }, { v: '10m', l: '$10M' }], show: function (a) { return want('gl')(a) || want('bop')(a); } },
        { id: 'wcClasses', type: 'repeater', label: 'Workers\' comp – payroll by job type', q: 'Payroll by job type', itemLabel: 'Job type', addLabel: '+ Add another job type', show: want('wc'),
          sub: [{ k: 'job', l: 'Job description', ph: 'e.g. Equipment operator' }, { k: 'ft', l: '# full-time', im: 'numeric' }, { k: 'pt', l: '# part-time', im: 'numeric' }, { k: 'payroll', l: 'Annual payroll', ph: 'e.g. $180,000', im: 'numeric' }] },
        { id: 'eoServices', type: 'textarea', label: 'E&O – professional services you provide', q: 'What professional services do you provide?', show: want('eo') },
        { id: 'eoRevenue', type: 'text', label: 'E&O – annual revenue from professional services', q: 'About how much yearly revenue comes from professional services?', im: 'numeric', ph: 'e.g. $300,000', show: want('eo') },
        { id: 'eoLimit', type: 'tiles', unsure: false, label: 'E&O – limit per claim', q: 'E&O limit per claim?', cols2: true, opts: [{ v: '250k', l: '$250K' }, { v: '500k', l: '$500K' }, { v: '1m', l: '$1M (most common)' }, { v: '2m', l: '$2M' }, { v: '5m', l: '$5M+' }], show: want('eo') },
        { id: 'eoClaims', type: 'tiles', label: 'E&O – any professional claims in 5 years?', q: 'Any professional liability claims or suits in the last 5 years?', cols2: true, opts: [{ v: 'no', l: 'No' }, { v: '1', l: 'Yes – 1' }, { v: '2+', l: 'Yes – 2 or more' }], show: want('eo') },
        { id: 'doOrg', type: 'tiles', label: 'D&O – organization type', q: 'What kind of organization?', cols2: true, opts: [{ v: 'private', l: 'Private company' }, { v: 'nonprofit', l: 'Nonprofit' }, { v: 'hoa', l: 'HOA / association' }, { v: 'llc', l: 'LLC / partnership' }, { v: 'other', l: 'Other' }], show: want('dando') },
        { id: 'doDirectors', type: 'number', label: 'D&O – number of directors / board members', q: 'How many directors or board members?', im: 'numeric', show: want('dando') },
        { id: 'doAssets', type: 'tiles', label: 'D&O – total assets', q: 'About how much are the organization\'s total assets?', cols2: true, opts: [{ v: '<1m', l: 'Under $1M' }, { v: '1-5m', l: '$1M–$5M' }, { v: '5-25m', l: '$5M–$25M' }, { v: '25m+', l: 'Over $25M' }], show: want('dando') },
        { id: 'doClaims', type: 'tiles', label: 'D&O – any claims against directors or officers in 5 years?', q: 'Any claims or lawsuits against directors or officers in the last 5 years?', cols2: true, opts: YN, show: want('dando') },
        { id: 'doLimit', type: 'tiles', unsure: false, label: 'D&O – limit', q: 'D&O limit?', cols2: true, opts: [{ v: '1m', l: '$1M' }, { v: '2m', l: '$2M (common)' }, { v: '5m', l: '$5M' }, { v: '10m', l: '$10M+' }], show: want('dando') },
        { id: 'crimeEmployees', type: 'number', label: 'Crime – total number of employees', q: 'How many employees in total?', im: 'numeric', show: want('crime') },
        { id: 'crimeHandlers', type: 'number', label: 'Crime – employees who handle money', q: 'How many employees handle money or checks?', im: 'numeric', show: want('crime') },
        { id: 'crimeLimit', type: 'tiles', unsure: false, label: 'Crime – employee dishonesty limit', q: 'Employee theft limit?', cols2: true, opts: [{ v: '25k', l: '$25K' }, { v: '50k', l: '$50K' }, { v: '100k', l: '$100K' }, { v: '250k', l: '$250K+' }], show: want('crime') },
        { id: 'crimeLosses', type: 'tiles', label: 'Crime – any theft or crime losses in 5 years?', q: 'Any theft, fraud or crime losses in the last 5 years?', cols2: true, opts: YN, show: want('crime') },
        { id: 'crimeDual', type: 'tiles', label: 'Crime – two people sign off on payments?', q: 'Do two people sign off on payments?', cols2: true, opts: [{ v: 'yes', l: 'Yes' }, { v: 'partial', l: 'Partially' }, { v: 'no', l: 'No' }], show: want('crime') }
      ] });
    out.push({ id: 'biz10', step: 'Business', title: 'Business insurance history', show: sh(),
      fields: [
        { id: 'bizCurrent', type: 'multi', label: 'What do you carry today?', q: 'What coverage does the business have now?', opts: [{ v: 'gl', l: 'General liability' }, { v: 'property', l: 'Property' }, { v: 'bop', l: 'BOP' }, { v: 'auto', l: 'Commercial auto' }, { v: 'wc', l: 'Workers\' comp' }, { v: 'umbrella', l: 'Umbrella' }, { v: 'none', l: 'None yet' }], exclusive: ['none'] },
        { id: 'bizCarrier', type: 'text', label: 'Current insurance company', q: 'Who insures the business now?', ph: 'Start typing a company name', list: QF.CARRIERS, show: function (a) { var c = arr(a, 'bizCurrent'); return c.length && c[0] !== 'none'; } },
        { id: 'bizRenewal', type: 'date', label: 'Renewal date', q: 'When does it renew?', show: function (a) { var c = arr(a, 'bizCurrent'); return c.length && c[0] !== 'none'; } },
        { id: 'bizPrior', type: 'tiles', label: 'Continuously insured the last 3 years?', q: 'Has the business been insured continuously for the last 3 years?', cols2: true, opts: [{ v: 'yes', l: 'Yes' }, { v: 'no', l: 'No / gap' }, { v: 'new', l: 'New business' }] },
        { id: 'bizPriorLine', type: 'text', label: 'Prior insurance – company and policy type', q: 'Prior insurance: which company and what kind of policy?', ph: 'e.g. Acme Mutual – general liability', show: function (a) { return a.bizPrior !== 'new'; } },
        { id: 'bizPriorExp', type: 'date', label: 'Prior policy expiration date', q: 'When did (or does) the prior policy expire?', show: function (a) { return a.bizPrior !== 'new'; } },
        { id: 'bizClaims', type: 'tiles', label: 'Claims in the last 5 years', q: 'Any claims in the last 5 years?', cols2: true, opts: [{ v: 'none', l: 'None' }, { v: '1', l: 'One' }, { v: '2+', l: 'Two or more' }] },
        { id: 'bizLoss', type: 'textarea', label: 'Tell us about the claims', q: 'Tell us a little about the claims', ph: 'Date, what happened, about how much', show: function (a) { return a.bizClaims === '1' || a.bizClaims === '2+'; } },
        { id: 'bizMore', type: 'textarea', label: 'Anything else we should know about the business?', q: 'Anything else we should know about the business?', ph: 'e.g. contract insurance requirements, seasonal work, special equipment…' }
      ] });
    return out;
  };
})();
