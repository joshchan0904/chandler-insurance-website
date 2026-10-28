// Data retention for the /get-a-quote/ flow (Josh, 2026-10-28):
//  - Uploaded dec pages (Blobs "quote-dec-files"): deleted 90 days after upload, using the upload time stored in
//    <id>/meta (createdAt), or on the parts' blob metadata if meta is missing (new uploads only). All parts (<id>/0..n) are deleted first, then <id>/meta, so an interrupted run is retried.
//  - Website quote leads (Blobs "quote-leads"): deleted 3 years after the record was last updated (updatedAt in the
//    blob metadata, so lead contents are never read here).
// Never touches Netlify Forms submissions, the office mailbox, or any other store. Anything without a readable date is
// skipped (kept) and counted. dryRun = log counts only, delete nothing. Logs counts only (no ids, names or contents).
export const FILE_DAYS = 90;
export const LEAD_YEARS = 3;
const DAY = 864e5;
const plusYears = (ms, y) => { const d = new Date(ms); d.setUTCFullYear(d.getUTCFullYear() + y); return d.getTime(); };

export async function purgeDecFiles(store, { now = Date.now(), dryRun = false } = {}) {
  const { blobs } = await store.list();
  const groups = new Map();
  for (const { key } of blobs) { const i = key.indexOf('/'); if (i < 1) continue; const id = key.slice(0, i); (groups.get(id) || groups.set(id, []).get(id)).push(key); }
  const r = { files: groups.size, due: 0, deleted: 0, keysDeleted: 0, kept: 0, noDate: 0, errors: 0 };
  for (const [id, keys] of groups) {
    const m = keys.includes(`${id}/meta`) ? await store.get(`${id}/meta`, { type: 'json' }).catch(() => null) : null;
    let up = Date.parse(m?.createdAt || '');
    if (!Number.isFinite(up) && !m) { // parts left without meta (interrupted upload): use the upload time stored on a part, if any
      for (const k of keys) { const md = await store.getMetadata(k).catch(() => null); const t = Date.parse(md?.metadata?.createdAt || ''); if (Number.isFinite(t)) { up = t; break; } }
    }
    if (!Number.isFinite(up)) { r.noDate++; continue; }          // no stored upload time -> never guess, keep
    if (now - up < FILE_DAYS * DAY) { r.kept++; continue; }
    r.due++;
    if (dryRun) continue;
    try {
      const parts = keys.filter((k) => k !== `${id}/meta`);
      for (const k of parts) { await store.delete(k); r.keysDeleted++; }
      await store.delete(`${id}/meta`); r.keysDeleted++; r.deleted++;
    } catch { r.errors++; }
  }
  return r;
}

export async function purgeLeads(store, { now = Date.now(), dryRun = false } = {}) {
  const { blobs } = await store.list();
  const r = { records: blobs.length, due: 0, deleted: 0, kept: 0, noDate: 0, errors: 0 };
  for (const { key } of blobs) {
    const md = await store.getMetadata(key).catch(() => null);
    const t = Date.parse(md?.metadata?.updatedAt || '');
    if (!Number.isFinite(t)) { r.noDate++; continue; }
    if (now < plusYears(t, LEAD_YEARS)) { r.kept++; continue; }
    r.due++;
    if (dryRun) continue;
    try { await store.delete(key); r.deleted++; } catch { r.errors++; }
  }
  return r;
}
