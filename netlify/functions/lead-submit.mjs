// Round 11 – real lead intake for /get-a-quote/. Saves the lead to Netlify Blobs "quote-leads" and, on COMPLETE,
// emails it once (via the Netlify Form "qf-lead" -> joshchandler@chandlerinsurancemn.com).
// Partials are saved here and emailed later by lead-sweep.mjs if the person never finishes.
// Ownership/ref rules are the same as sandbox-submit.mjs (random collision-proof refs, per-browser token hash, CAS updates).
// stage: 'partial' (after contact screen / on page hide) | 'complete' | 'doc' (extra document after submit).
// clientSends: true -> the browser will email it itself (file attached via the form's file field), so don't email here.
// clientSent: true -> the browser already emailed it; just record that.
import { createHash, randomBytes } from 'node:crypto';
import { leads, json, isHarness, deliver } from '../lib/leads.mjs';

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REF_RE = /^CHQ-2026-[0-9A-HJKMNP-TV-Z]{6}$/;
const TOKEN_RE = /^[a-f0-9]{32,64}$/;
const newRef = () => { const b = randomBytes(6); let s = ''; for (let i = 0; i < 6; i++) s += B32[b[i] & 31]; return `CHQ-2026-${s}`; };
const hashToken = (t) => createHash('sha256').update('chq-lead:' + t).digest('hex');
const meta = (r) => ({ stage: r.stage, ref: r.ref, variant: String(r.variant || ''), updatedAt: r.updatedAt, noSend: !!r.noSend, partialEmailedAt: r.partialEmailedAt || '', completeEmailedAt: r.completeEmailedAt || '', completeDirectAt: r.completeDirectAt || '' });
const okDoc = (d) => d && /^[a-f0-9]{32}$/.test(d.id || '') && /^[a-f0-9]{32}$/.test(d.t || '');

function buildRecord(prev, data, ctx) {
  const { sessionToken, clientSends, clientSent, doc, stage: _s, test, preview, ...incoming } = data;
  const prevStage = prev?.stage;
  const stage = ctx.stage === 'complete' || prevStage === 'complete' ? 'complete' : 'partial';
  const rec = {
    ...(prev || {}), ...incoming,
    decFile: okDoc(incoming.decFile) ? { id: incoming.decFile.id, t: incoming.decFile.t, type: String(incoming.decFile.type || '').slice(0, 40), kb: +incoming.decFile.kb || 0 } : (prev?.decFile || null),
    ref: ctx.ref, clientId: ctx.client, tokenHash: ctx.tokenHash, stage, noSend: !!(ctx.noSend || prev?.noSend),
    summary: String(incoming.summary || prev?.summary || '').slice(0, 20000),
    firstSeenAt: prev?.firstSeenAt || ctx.now, updatedAt: ctx.now,
    stages: [...(prev?.stages || []), { stage: ctx.stage, at: ctx.now }].slice(-40)
  };
  return rec;
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  const raw = await req.text();
  if (raw.length > 200_000) return json({ ok: false, error: 'too large' }, 413);
  let data;
  try { data = JSON.parse(raw); } catch { return json({ ok: false, error: 'bad json' }, 400); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return json({ ok: false, error: 'bad payload' }, 400);
  const token = String(data.sessionToken || '').toLowerCase();
  if (!TOKEN_RE.test(token)) return json({ ok: false, error: 'missing session token' }, 400);
  const c = data.contact || {};
  const store = leads();
  const ctx = {
    tokenHash: hashToken(token), now: new Date().toISOString(),
    client: String(data.clientId || 'anon').replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'anon',
    stage: data.stage === 'complete' ? 'complete' : data.stage === 'doc' ? 'doc' : 'partial',
    noSend: !!data.noSend || isHarness(req)
  };

  // 1) create or update the record (atomic)
  let rec = null, etag = null, mismatch = false;
  if (REF_RE.test(data.ref || '')) {
    for (let tries = 0; tries < 6 && !rec; tries++) {
      const cur = await store.getWithMetadata(data.ref, { type: 'json' }).catch(() => null);
      if (!cur || !cur.data) break;
      if (cur.data.tokenHash !== ctx.tokenHash) { mismatch = true; break; }
      const r = buildRecord(cur.data, data, { ...ctx, ref: data.ref });
      const res = await store.setJSON(data.ref, r, { onlyIfMatch: cur.etag, metadata: meta(r) });
      if (res && res.modified) { rec = r; etag = res.etag; }
    }
  }
  if (!rec) {
    if (ctx.stage === 'doc') return json({ ok: false, error: 'unknown ref' }, 400);
    for (let tries = 0; tries < 8 && !rec; tries++) {
      const ref = newRef(); const r = buildRecord(null, data, { ...ctx, ref });
      const res = await store.setJSON(ref, r, { onlyIfNew: true, metadata: meta(r) });
      if (res && res.modified) { rec = r; etag = res.etag; }
    }
    if (!rec) return json({ ok: false, error: 'could not issue a ref' }, 500);
  }
  const base = { ok: true, ref: rec.ref, stage: rec.stage, reissued: !!data.ref && data.ref !== rec.ref, refMismatch: mismatch };
  if (rec.noSend) return json({ ...base, emailed: false, noSend: true });
  if (ctx.stage === 'partial') return json({ ...base, emailed: false });

  // 2) email once. Claim the send with a compare-and-swap so two requests can never both email the same thing.
  const claimKey = ctx.stage === 'doc' ? 'docClaims' : 'completeClaimAt';
  const docId = ctx.stage === 'doc' && okDoc(data.doc) ? data.doc.id : null;
  if (ctx.stage === 'doc' && !docId) return json({ ...base, emailed: false, error: 'no document' }, 400);
  const already = (r) => ctx.stage === 'doc' ? (r.docClaims || []).includes(docId) : !!(r.completeClaimAt || r.completeEmailedAt);
  for (let tries = 0; tries < 6; tries++) {
    if (already(rec)) return json({ ...base, emailed: false, duplicate: true });
    const claimed = ctx.stage === 'doc' ? { ...rec, docClaims: [...(rec.docClaims || []), docId] } : { ...rec, completeClaimAt: ctx.now };
    if (ctx.stage === 'complete' && (data.clientSent || data.clientSends)) {
      claimed.completeEmailedAt = data.clientSent ? ctx.now : '';
      if (data.clientSends) { delete claimed.completeClaimAt; claimed.clientSendingAt = ctx.now; }
      const res = await store.setJSON(rec.ref, claimed, { onlyIfMatch: etag, metadata: meta(claimed) });
      if (res && res.modified) return json({ ...base, emailed: !!data.clientSent, by: 'browser' });
    } else {
      const res = await store.setJSON(rec.ref, claimed, { onlyIfMatch: etag, metadata: meta(claimed) });
      if (res && res.modified) {
        const dv = await deliver(claimed, ctx.stage === 'doc' ? 'DOCUMENT' : 'COMPLETE', { doc: data.doc }); const sent = dv.ok;
        // record the result (release the claim on failure so the browser or the sweeper can retry)
        for (let t2 = 0; t2 < 6; t2++) {
          const cur = await store.getWithMetadata(rec.ref, { type: 'json' }).catch(() => null); if (!cur?.data) break;
          const upd = { ...cur.data };
          if (ctx.stage === 'complete') {
            if (sent) upd.completeEmailedAt = new Date().toISOString(); else { delete upd.completeClaimAt; upd.completeEmailError = new Date().toISOString(); }
            if (dv.direct) upd.completeDirectAt = new Date().toISOString(); else upd.directTries = (upd.directTries || 0) + 1;
          }
          else if (!sent) upd.docClaims = (upd.docClaims || []).filter((x) => x !== docId);
          const r2 = await store.setJSON(rec.ref, upd, { onlyIfMatch: cur.etag, metadata: meta(upd) });
          if (r2 && r2.modified) break;
        }
        return json({ ...base, emailed: sent, by: 'server', direct: dv.direct, attached: dv.attached, backup: dv.backup, fallback: dv.fallback });
      }
    }
    const cur = await store.getWithMetadata(rec.ref, { type: 'json' }).catch(() => null);
    if (!cur?.data) break; rec = cur.data; etag = cur.etag;
  }
  return json({ ...base, emailed: false, error: 'busy' }, 409);
};
export const config = { path: '/api/lead' };
