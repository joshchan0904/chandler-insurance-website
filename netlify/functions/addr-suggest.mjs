// Real address suggestions for the /get-a-quote/ flow (Round 11c). All sources are free:
//  1. Local index of Minnesota address points (MnGeo "Address Points, Compiled from Opt-In Open Counties", 52 counties
//     incl. Itasca + St. Louis; ~2.1M addresses) bundled with this function as netlify/data/mn-addr.json.gz. Instant,
//     works for partial typing like "322 NE 5th", no outside call, no rate limit.
//  2. US Census Geocoder (onelineaddress) for complete addresses anywhere in the US.
//  3. Photon (komoot / OpenStreetMap), one call, MN-biased, short timeout - only when 1+2 found too little.
// Only the typed address text is forwarded to 2/3 (no name, phone, email, cookies or visitor IP). Nothing is stored.
// Round 11c cause: Photon's public server throttled/timed out calls from Netlify (~4.6 s, 0 results) and we made two
// calls per keystroke; OSM also lacks house numbers in Grand Rapids. Nominatim is NOT used (its policy forbids autocomplete).
import { readFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getStore } from '@netlify/blobs';

const UA = 'ChandlerQuoteFlowPreview/1.1 (+https://chandlerinsurancemn.com)';
const ATTRIB = 'Suggestions: MN address points (MnGeo/counties), US Census, © OpenStreetMap contributors.';
const DIR = { N: 'North', S: 'South', E: 'East', W: 'West', NE: 'Northeast', NW: 'Northwest', SE: 'Southeast', SW: 'Southwest' };
const SUF = { ST: 'Street', AVE: 'Avenue', AV: 'Avenue', RD: 'Road', DR: 'Drive', LN: 'Lane', CT: 'Court', BLVD: 'Boulevard', TRL: 'Trail', HWY: 'Highway', PL: 'Place', CIR: 'Circle', PKWY: 'Parkway', TER: 'Terrace', WAY: 'Way', CO: 'County' };
const ABBR = { North: 'N', South: 'S', East: 'E', West: 'W', Northeast: 'NE', Northwest: 'NW', Southeast: 'SE', Southwest: 'SW', Street: 'St', Avenue: 'Ave', Road: 'Rd', Drive: 'Dr', Lane: 'Ln', Court: 'Ct', Boulevard: 'Blvd', Trail: 'Trl', Highway: 'Hwy', Place: 'Pl', Circle: 'Cir', Parkway: 'Pkwy', Terrace: 'Ter' };
const STATES = { Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC', Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY' };
const ST_ABBR = new Set(Object.values(STATES).map((s) => s.toLowerCase()));

// Query-token normalizer: spelled-out directionals/types/ordinals -> the short forms used in the index.
const NORM = { north: 'n', south: 's', east: 'e', west: 'w', northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
  street: 'st', str: 'st', avenue: 'ave', av: 'ave', road: 'rd', drive: 'dr', lane: 'ln', court: 'ct', boulevard: 'blvd', trail: 'trl',
  highway: 'hwy', place: 'pl', circle: 'cir', parkway: 'pkwy', terrace: 'ter', point: 'pt', alley: 'aly', ridge: 'rdg', square: 'sq', crossing: 'xing',
  first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th', sixth: '6th', seventh: '7th', eighth: '8th', ninth: '9th', tenth: '10th',
  saint: 'st', mt: 'mount', 'co': 'county', cty: 'county', cr: 'county' };
// Long forms appended to each street's search text so a half-typed last word ("Stre", "Northe") still prefix-matches.
const LONG = { n: 'north', s: 'south', e: 'east', w: 'west', ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest', st: 'street saint',
  ave: 'avenue', rd: 'road', '1st': 'first', '2nd': 'second', '3rd': 'third', '4th': 'fourth', '5th': 'fifth', '6th': 'sixth', '7th': 'seventh', '8th': 'eighth', '9th': 'ninth', '10th': 'tenth', dr: 'drive', ln: 'lane', ct: 'court', blvd: 'boulevard', trl: 'trail', hwy: 'highway', pl: 'place', cir: 'circle', pkwy: 'parkway', ter: 'terrace' };
const IGNORE = new Set(['mn', 'minn', 'minnesota', 'usa', 'us']);
const NEAR = { Itasca: 0, 'Saint Louis': 1, Aitkin: 2, Cass: 2, Koochiching: 2, Lake: 2, Carlton: 2, 'Crow Wing': 2 };

let IDX = null, IDX_ERR = '', IDX_P = null;
// The index lives in the site's Netlify Blobs store "qf-geo" (key mn-addr-v1.gz.b64 = base64 of the 4.6 MB gzip; uploaded with
// `netlify blobs:set`, built by /tmp/fx/addrpts/build.py). A local copy at netlify/data/ is used when running on the box.
function parseIndex(buf) {
  const d = JSON.parse(gunzipSync(buf).toString('utf8'));
  const txt = d.s.map((r) => {
    const w = (r[0] + ' ' + r[1]).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const extra = w.map((x) => LONG[x] || '').filter(Boolean);
    return ' ' + w.concat(extra, [r[2]]).join(' ') + ' ';
  });
  return { s: d.s, c: d.c, txt, pri: d.c.map((c) => (c in NEAR ? NEAR[c] : 3)) };
}
function loadIndex() {
  if (IDX) return Promise.resolve(IDX);
  if (IDX_P) return IDX_P;
  IDX_P = (async () => {
    try {
      const here = (() => { try { return path.dirname(fileURLToPath(import.meta.url)); } catch { return ''; } })();
      const f = [process.cwd(), here && path.join(here, '../..')].filter(Boolean).map((d) => path.join(d, 'netlify/data/mn-addr.json.gz')).find((p) => existsSync(p));
      let buf = f ? readFileSync(f) : null;
      if (!buf) {
        const b64 = await getStore('qf-geo').get('mn-addr-v1.gz.b64'); // base64 text: the CLI stores --input files as UTF-8
        if (b64) buf = Buffer.from(b64, 'base64');
      }
      if (!buf) { IDX_ERR = 'index missing'; return null; }
      IDX = parseIndex(buf); IDX_ERR = ''; return IDX;
    } catch (e) { IDX_ERR = 'index load failed: ' + String(e && e.message || e).slice(0, 120); return null; } finally { IDX_P = null; }
  })();
  return IDX_P;
}

function tokens(q) {
  return q.toLowerCase().replace(/\b(apt|unit|ste|suite|#)\b.*$/, ' ').replace(/#.*$/, ' ').replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter(Boolean);
}
async function localSearch(q, max) {
  const idx = await loadIndex(); if (!idx) return [];
  let t = tokens(q);
  if (t.length < 2 || !/^\d+[a-z]?$/.test(t[0])) return []; // need "<house number> <street…>"
  const num = t[0]; const endsWithSpace = /\s$/.test(q);
  t = t.slice(1);
  const lastRaw = t[t.length - 1];
  const words = t.map((w, i) => (i < t.length - 1 || endsWithSpace ? (NORM[w] || w) : w)).filter((w, i, a) => !(IGNORE.has(w) && a.length > 1));
  if (!words.length) return [];
  const last = endsWithSpace ? null : words[words.length - 1];
  const full = last === null ? words : words.slice(0, -1);
  const lastAlt = last && NORM[last] && NORM[last] !== last ? NORM[last] : null;
  const hits = [];
  for (let i = 0; i < idx.s.length; i++) {
    const s = idx.txt[i]; let ok = true;
    for (const w of full) { if (!s.includes(' ' + w + ' ')) { ok = false; break; } }
    if (!ok) continue;
    if (last && !s.includes(' ' + last) && !(lastAlt && s.includes(' ' + lastAlt + ' '))) continue;
    const r = idx.s[i];
    if (!(',' + r[4] + ',').includes(',' + num + ',')) continue;
    hits.push(i);
    if (hits.length > 400) break;
  }
  hits.sort((a, b) => idx.pri[idx.s[a][3]] - idx.pri[idx.s[b][3]] || idx.s[a][0].length - idx.s[b][0].length);
  return hits.slice(0, max).map((i) => {
    const r = idx.s[i];
    return { line: num.toUpperCase().replace(/^(\d+)([A-Z])$/, '$1$2') + ' ' + r[0], city: r[1], area: '', state: 'MN', zip: r[2], exact: true, numberFromTyping: false, source: 'mn-address-points', county: idx.c[r[3]] };
  });
}

async function getJson(u, ms) {
  const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal }); return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(tm); }
}
const tc = (s) => String(s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (m, a, b) => a + b.toLowerCase()).replace(/\b(Ne|Nw|Se|Sw)\b/g, (m) => m.toUpperCase());

async function census(q, typedNum) {
  const j = await getJson('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=' + encodeURIComponent(q), 2500);
  const ms = (j && j.result && j.result.addressMatches) || [];
  return ms.slice(0, 3).map((m) => {
    const c = m.addressComponents || {};
    const street = [c.preQualifier, c.preDirection, c.preType, c.streetName, c.suffixType, c.suffixDirection, c.suffixQualifier].filter(Boolean).join(' ');
    return { line: (typedNum ? typedNum + ' ' : '') + tc(street), city: tc(c.city), area: '', state: c.state || '', zip: c.zip || '', exact: !!typedNum, numberFromTyping: false, source: 'us-census' };
  }).filter((x) => x.line.trim());
}

function expand(q) { return q.split(/\s+/).map((w) => { const u = w.replace(/[.,]/g, '').toUpperCase(); return DIR[u] || SUF[u] || w; }).join(' '); }
function shortStreet(s) { return String(s || '').split(' ').map((w) => ABBR[w] || w).join(' '); }
async function photon(q, typedNum) {
  const j = await getJson('https://photon.komoot.io/api/?q=' + encodeURIComponent(expand(q)) + '&limit=8&lang=en&lat=47.24&lon=-93.53&location_bias_scale=0.5', 2500);
  const out = [];
  for (const f of (j && j.features) || []) {
    const p = f.properties || {};
    if (p.countrycode !== 'US') continue;
    const isHouse = !!p.housenumber; const street = p.street || (p.type === 'street' ? p.name : '');
    if (!street) continue;
    const city = p.city || p.town || p.village || p.locality || '';
    const area = !city && p.county ? p.county + (/county/i.test(p.county) ? '' : ' County') : '';
    const num = isHouse ? p.housenumber : typedNum;
    out.push({ line: [num, shortStreet(street)].filter(Boolean).join(' '), city, area, state: STATES[p.state] || p.state || '', zip: (p.postcode || '').slice(0, 5), exact: isHouse, numberFromTyping: !isHouse && !!typedNum, source: 'osm-photon' });
  }
  return out;
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300', 'x-robots-tag': 'noindex' } });

export default async (req) => {
  const url = new URL(req.url);
  const raw = String(url.searchParams.get('q') || '');
  const q = raw.replace(/[^\p{L}\p{N}\s.,#'\-\/]/gu, ' ').replace(/[ \t]+/g, ' ').replace(/^\s+/, '').slice(0, 120);
  const qt = q.trim();
  if (url.searchParams.get('warm') === '1') { await loadIndex(); return new Response(JSON.stringify({ ok: true, idx: IDX ? 'ok' : IDX_ERR }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }); }
  if (qt.length < 3) return json(200, { ok: true, results: [], attrib: ATTRIB });
  const typedNum = (qt.match(/^(\d+[A-Za-z]?)\s/) || [])[1] || '';
  const t0 = Date.now();
  const local = await localSearch(q, 6);
  let more = [];
  if (local.length < 3) {
    const words = tokens(qt).length;
    const jobs = [];
    if (typedNum && words >= 4) jobs.push(census(qt, typedNum)); // a full-ish address: Census is exact and fast
    jobs.push(photon(qt, typedNum));
    more = [].concat(...(await Promise.all(jobs)));
    more.sort((a, b) => (a.state === 'MN' ? 0 : 1) - (b.state === 'MN' ? 0 : 1)); // stable: MN first
  }
  const seen = new Set(), out = [];
  const key = (x) => (x.line + '|' + (x.city || '') + '|' + x.state).toLowerCase().replace(/[^a-z0-9|]/g, '');
  for (const x of local.concat(more)) {
    const k = key(x); if (seen.has(k)) continue; seen.add(k);
    // An OSM street-only guess that duplicates a real address point (same street + city) adds nothing.
    out.push(x); if (out.length >= 6) break;
  }
  return json(200, { ok: true, source: out[0] ? out[0].source : 'none', results: out, attrib: ATTRIB, ms: Date.now() - t0, idx: IDX ? 'ok' : (IDX_ERR || 'not loaded') });
};
export const config = { path: '/api/addr' };
