// Year/Make/Model lists from NHTSA vPIC (free, no key) for people without a VIN.
//   /api/vehicle?op=makes                      -> makes for passenger cars, trucks and MPVs/SUVs (deduped)
//   /api/vehicle?op=models&makeId=460&year=2019 -> models for that make + model year (same three vehicle types)
// Cached at the CDN for a day. Nothing about the visitor is sent or stored.
const V = 'https://vpic.nhtsa.dot.gov/api/vehicles/';
const TYPES = ['car', 'truck', 'multipurpose passenger vehicle (mpv)'];
const json = (status, body, cache = 'public, max-age=86400, s-maxage=86400') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache, 'x-robots-tag': 'noindex' } });
async function get(path) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
  try { const r = await fetch(V + path, { signal: ctl.signal }); if (!r.ok) throw new Error('http ' + r.status); return (await r.json()).Results || []; } finally { clearTimeout(t); }
}
const tc = (s) => String(s || '').trim().split(/(\s+|-)/).map((w) => (w.length > 3 ? w.charAt(0) + w.slice(1).toLowerCase() : w)).join('');
export default async (req) => {
  const u = new URL(req.url), op = u.searchParams.get('op');
  try {
    if (op === 'makes') {
      const all = await Promise.all(TYPES.map((t) => get('GetMakesForVehicleType/' + encodeURIComponent(t) + '?format=json')));
      const m = new Map(); all.flat().forEach((r) => { if (r.MakeId && r.MakeName) m.set(r.MakeId, tc(r.MakeName)); });
      return json(200, { ok: true, makes: [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)) });
    }
    if (op === 'models') {
      const id = String(u.searchParams.get('makeId') || '').replace(/\D/g, ''), yr = String(u.searchParams.get('year') || '').replace(/\D/g, '');
      if (!id || yr.length !== 4) return json(400, { ok: false, error: 'makeId and year required' }, 'no-store');
      const all = await Promise.all(TYPES.map((t) => get('GetModelsForMakeIdYear/makeId/' + id + '/modelyear/' + yr + '/vehicletype/' + encodeURIComponent(t) + '?format=json').catch(() => [])));
      const s = new Set(); all.flat().forEach((r) => r.Model_Name && s.add(String(r.Model_Name).trim()));
      return json(200, { ok: true, models: [...s].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })) });
    }
    return json(400, { ok: false, error: 'op must be makes or models' }, 'no-store');
  } catch { return json(200, { ok: false, error: 'vpic-unavailable' }, 'no-store'); }
};
export const config = { path: '/api/vehicle' };
