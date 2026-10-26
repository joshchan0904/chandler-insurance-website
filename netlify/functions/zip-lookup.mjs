// ZIP -> city/state via the free Zippopotam.us API (no key). Only the 5-digit ZIP is sent. Nothing stored.
const json = (status, body, cache = 'public, max-age=86400') => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': cache, 'x-robots-tag': 'noindex' } });
export default async (req) => {
  const zip = String(new URL(req.url).searchParams.get('zip') || '').replace(/\D/g, '');
  if (zip.length !== 5) return json(200, { ok: true, found: false });
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
  try {
    const r = await fetch('https://api.zippopotam.us/us/' + zip, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (r.status === 404) return json(200, { ok: true, found: false });
    if (!r.ok) return json(200, { ok: false, found: false }, 'no-store');
    const j = await r.json(); const pl = (j.places || [])[0];
    if (!pl) return json(200, { ok: true, found: false });
    return json(200, { ok: true, found: true, zip, city: pl['place name'], state: pl['state abbreviation'], cities: (j.places || []).map((x) => x['place name']).slice(0, 5) });
  } catch { return json(200, { ok: false, found: false }, 'no-store'); } finally { clearTimeout(t); }
};
export const config = { path: '/api/zip' };
