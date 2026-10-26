// Round 11 – scheduled every 5 minutes. Emails PARTIAL leads (contact entered, then no activity for 15+ minutes and
// never completed) exactly once, and retries COMPLETE leads whose DIRECT email failed (up to 5 tries; also covers leads
// the browser had to send through Netlify Forms because the secure upload failed). Uses compare-and-swap claims so a
// lead is never emailed twice. Skips harness/test records and anything created before Round 11 went live.
import { leads, deliver } from '../lib/leads.mjs';
const IDLE_MS = 15 * 60e3;
const SINCE = Date.parse('2026-10-26T21:45:00Z'); // Round 11b (direct email) cut-over, 4:45 PM CT; older preview records are never emailed
const meta = (r) => ({ stage: r.stage, ref: r.ref, variant: String(r.variant || ''), updatedAt: r.updatedAt, noSend: !!r.noSend, partialEmailedAt: r.partialEmailedAt || '', completeEmailedAt: r.completeEmailedAt || '', completeDirectAt: r.completeDirectAt || '' });
const hasContact = (c) => !!(c && (c.firstName || c.lastName) && (c.email || c.phone));

export default async () => {
  const store = leads(); const now = Date.now(); let sent = 0, checked = 0;
  const { blobs } = await store.list();
  for (const { key } of blobs) {
    const md = await store.getMetadata(key).catch(() => null); const m = md?.metadata || {};
    if (m.noSend || Date.parse(m.updatedAt || 0) < SINCE || now - Date.parse(m.updatedAt || 0) < IDLE_MS) continue;
    if (m.stage === 'complete' ? m.completeDirectAt : m.partialEmailedAt) continue;
    checked++;
    const cur = await store.getWithMetadata(key, { type: 'json' }).catch(() => null); const r = cur?.data;
    if (!r || r.noSend || !hasContact(r.contact) || Date.parse(r.firstSeenAt || 0) < SINCE) continue;
    let kind = null;
    if (r.stage === 'partial' && !r.partialClaimAt && !r.partialEmailedAt) kind = 'PARTIAL';
    if (r.stage === 'complete' && !r.completeClaimAt && !r.completeDirectAt && (r.directTries || 0) < 5) kind = 'COMPLETE';
    if (!kind) continue;
    const claimK = kind === 'PARTIAL' ? 'partialClaimAt' : 'completeClaimAt';
    const claimed = { ...r, [claimK]: new Date().toISOString() };
    const res = await store.setJSON(key, claimed, { onlyIfMatch: cur.etag, metadata: meta(claimed) });
    if (!res?.modified) continue; // someone else touched it (e.g. they just finished) – look again next run
    const dv = await deliver(claimed, kind); const ok = dv.ok;
    for (let t = 0; t < 6; t++) {
      const c2 = await store.getWithMetadata(key, { type: 'json' }).catch(() => null); if (!c2?.data) break;
      const upd = { ...c2.data };
      if (ok) upd[kind === 'PARTIAL' ? 'partialEmailedAt' : 'completeEmailedAt'] = new Date().toISOString();
      if (kind === 'COMPLETE') { delete upd[claimK]; if (dv.direct) upd.completeDirectAt = new Date().toISOString(); else upd.directTries = (upd.directTries || 0) + 1; }
      else if (!ok) delete upd[claimK];
      const r2 = await store.setJSON(key, upd, { onlyIfMatch: c2.etag, metadata: meta(upd) });
      if (r2?.modified) break;
    }
    if (ok) sent++;
  }
  console.log(`lead-sweep: ${blobs.length} records, ${checked} due, ${sent} emailed`); // counts only, no lead data
};
export const config = { schedule: '*/5 * * * *' };
