// Home details from free public Minnesota parcel data, for the /get-a-quote/ flow.
// Source: MnGeo "Parcels, Compiled from Opt-In Open Data Counties" (public ArcGIS REST, no key). St. Louis County
// publishes year built and finished sq ft there. Itasca publishes parcels but no building data, so Itasca returns
// found:false. (St. Louis County's own layer, gis.stlouiscountymn.gov .../Open_Data/MapServer/7, has acreage but no
// year built or sq ft, so it isn't used.)
// Only the street number, street name and ZIP are sent. Owner names, taxes and values are NEVER requested or returned.
// Nothing is stored. Values are returned exactly as published; nothing is estimated.
const LAYER = 'https://enterprise.gisdata.mn.gov/aghost/rest/services/us_mn_state_mngeo/plan_parcels_open/FeatureServer/1/query';
const DIRS = { N: 'North', S: 'South', E: 'East', W: 'West', NE: 'Northeast', NW: 'Northwest', SE: 'Southeast', SW: 'Southwest', NORTH: 'North', SOUTH: 'South', EAST: 'East', WEST: 'West', NORTHEAST: 'Northeast', NORTHWEST: 'Northwest', SOUTHEAST: 'Southeast', SOUTHWEST: 'Southwest' };
const TYPES = { ST: 'Street', STREET: 'Street', AVE: 'Avenue', AV: 'Avenue', AVENUE: 'Avenue', RD: 'Road', ROAD: 'Road', DR: 'Drive', DRIVE: 'Drive', LN: 'Lane', LANE: 'Lane', CT: 'Court', COURT: 'Court', BLVD: 'Boulevard', BOULEVARD: 'Boulevard', TRL: 'Trail', TRAIL: 'Trail', HWY: 'Highway', HIGHWAY: 'Highway', PL: 'Place', PLACE: 'Place', CIR: 'Circle', CIRCLE: 'Circle', PKWY: 'Parkway', PARKWAY: 'Parkway', TER: 'Terrace', TERRACE: 'Terrace', WAY: 'Way' };
const json = (status, body, cache = 'public, max-age=3600') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache, 'x-robots-tag': 'noindex' } });

export function parseLine(line) {
  const w = String(line || '').replace(/[.,#]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (w.length < 2 || !/^\d{1,6}$/.test(w[0])) return null;
  const num = +w.shift(); let pre = null, post = null, type = null;
  if (w.length > 1 && DIRS[w[0].toUpperCase()]) pre = DIRS[w.shift().toUpperCase()];
  if (w.length > 1 && DIRS[w[w.length - 1].toUpperCase()]) post = DIRS[w.pop().toUpperCase()];
  if (w.length > 1 && TYPES[w[w.length - 1].toUpperCase()]) type = TYPES[w.pop().toUpperCase()];
  const name = w.join(' ');
  if (!name || !/^[A-Za-z0-9 '\-]{1,40}$/.test(name)) return null;
  return { num, pre, post, type, name };
}
const n0 = (x) => (typeof x === 'number' && isFinite(x) && x > 0 ? x : null);

export default async (req) => {
  const url = new URL(req.url);
  const p = parseLine(url.searchParams.get('line'));
  const zip = String(url.searchParams.get('zip') || '').replace(/\D/g, '').slice(0, 5);
  if (!p || zip.length !== 5) return json(200, { ok: true, found: false, reason: 'need-number-street-zip' });
  if (!/^5[56]\d{3}$/.test(zip)) return json(200, { ok: true, found: false, reason: 'not-mn' }); // MN ZIPs are 55xxx-56xxx
  const nm = p.name.toUpperCase().replace(/'/g, "''");
  const where = `anumber=${p.num} AND zip='${zip}' AND UPPER(st_name)='${nm}'`;
  const qs = new URLSearchParams({ where, outFields: 'co_name,st_pre_dir,st_pos_typ,st_pos_dir,year_built,fin_sq_ft,acres_poly,acres_deed,dwell_type', returnGeometry: 'false', resultRecordCount: '10', f: 'json' });
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
  let feats;
  try {
    const r = await fetch(LAYER + '?' + qs, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return json(200, { ok: false, found: false, reason: 'upstream-' + r.status }, 'no-store');
    const j = await r.json(); if (j.error) return json(200, { ok: false, found: false, reason: 'upstream-error' }, 'no-store');
    feats = (j.features || []).map((f) => f.attributes || {});
  } catch { return json(200, { ok: false, found: false, reason: 'timeout' }, 'no-store'); } finally { clearTimeout(t); }
  // keep matches whose directions/type agree with what was typed (when typed)
  let m = feats.filter((a) => (!p.pre || !a.st_pre_dir || a.st_pre_dir === p.pre) && (!p.post || !a.st_pos_dir || a.st_pos_dir === p.post) && (!p.type || !a.st_pos_typ || a.st_pos_typ === p.type));
  if (!m.length) return json(200, { ok: true, found: false, reason: feats.length ? 'no-exact-match' : 'no-parcel' });
  const withBldg = m.filter((a) => n0(a.year_built) || n0(a.fin_sq_ft));
  if (!withBldg.length) return json(200, { ok: true, found: false, reason: 'no-building-data', county: m[0].co_name || null });
  // ambiguous (e.g. same number on 4th St N and 4th St S, nothing typed to tell them apart): don't guess
  const sig = (a) => [n0(a.year_built), n0(a.fin_sq_ft)].join('|');
  if (new Set(withBldg.map(sig)).size > 1) return json(200, { ok: true, found: false, reason: 'ambiguous' });
  const a = withBldg[0], acres = n0(a.acres_deed) || n0(a.acres_poly);
  return json(200, { ok: true, found: true, source: 'MnGeo open parcel data (' + (a.co_name || 'county') + ' County assessor)', county: a.co_name || null,
    yearBuilt: n0(a.year_built), sqft: n0(a.fin_sq_ft), acres: acres ? Math.round(acres * 100) / 100 : null, dwellType: a.dwell_type || null });
};
export const config = { path: '/api/parcel' };
