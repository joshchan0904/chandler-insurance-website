// Round 11 – dec page / policy file upload for the /get-a-quote/ flow.
// The browser sends the file in 2 MB chunks (raw bytes). Stored privately in Netlify Blobs "quote-dec-files".
// Server-side checks: allowed type (PDF, JPEG, PNG, HEIC/HEIF, WebP), real file signature (magic bytes), max 10 MB,
// chunk order and size. The first chunk returns {id, t}: id is a random 128-bit key, t a random 128-bit secret whose
// SHA-256 hash is stored. Only id+t together open the file (dec-file.mjs), and only for 30 days.
// File contents are never logged or parsed.
import { createHash, randomBytes } from 'node:crypto';
import { files, json, isHarness, LINK_DAYS } from '../lib/leads.mjs';

export const MAX = 10 * 1024 * 1024;
const CHUNK = 2 * 1024 * 1024;
const TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp' };
const hash = (t) => createHash('sha256').update('chq-dec:' + t).digest('hex');
function sniff(b) {
  const s = (i, n) => Buffer.from(b.subarray(i, i + n)).toString('latin1');
  if (s(0, 5) === '%PDF-') return 'application/pdf';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && s(1, 3) === 'PNG') return 'image/png';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'image/webp';
  if (s(4, 4) === 'ftyp' && /^(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(s(8, 4))) return 'image/heic';
  return '';
}

export default async (req) => {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
  const h = (k) => req.headers.get(k) || '';
  const size = parseInt(h('x-qf-size'), 10), idx = parseInt(h('x-qf-idx'), 10);
  if (!(size > 0) || !(idx >= 0)) return json({ ok: false, error: 'bad request' }, 400);
  if (size > MAX) return json({ ok: false, error: 'too_big', max: MAX }, 413);
  const nChunks = Math.ceil(size / CHUNK);
  if (idx >= nChunks) return json({ ok: false, error: 'bad chunk' }, 400);
  const buf = new Uint8Array(await req.arrayBuffer());
  const want = idx === nChunks - 1 ? size - CHUNK * idx : CHUNK;
  if (buf.length !== want) return json({ ok: false, error: 'bad chunk size' }, 400);
  const store = files();

  if (idx === 0) {
    const real = sniff(buf); // trust the file's own signature, not the name or the browser's declared type
    if (!real) return json({ ok: false, error: 'bad_type' }, 415);
    const id = randomBytes(16).toString('hex'), t = randomBytes(16).toString('hex');
    const now = Date.now();
    const meta = { type: real, ext: TYPES[real], size, chunks: nChunks, got: 1, tokenHash: hash(t), createdAt: new Date(now).toISOString(), expiresAt: new Date(now + LINK_DAYS * 864e5).toISOString(), harness: isHarness(req) };
    await store.set(`${id}/0`, buf, { metadata: { createdAt: meta.createdAt } }); // upload time on every part too (retention)
    await store.setJSON(`${id}/meta`, { ...meta, done: nChunks === 1 });
    return json({ ok: true, id, t, done: nChunks === 1, type: real, kb: Math.max(1, Math.round(size / 1024)) });
  }
  const id = h('x-qf-id'), t = h('x-qf-t');
  if (!/^[a-f0-9]{32}$/.test(id) || !/^[a-f0-9]{32}$/.test(t)) return json({ ok: false, error: 'bad id' }, 400);
  const m = await store.get(`${id}/meta`, { type: 'json' }).catch(() => null);
  if (!m || m.tokenHash !== hash(t) || m.size !== size || m.got !== idx) return json({ ok: false, error: 'out of order' }, 409);
  await store.set(`${id}/${idx}`, buf, { metadata: { createdAt: m.createdAt } });
  const upd = { ...m, got: idx + 1, done: idx + 1 === m.chunks };
  await store.setJSON(`${id}/meta`, upd);
  return json({ ok: true, id, t, done: upd.done, type: m.type, kb: Math.max(1, Math.round(size / 1024)) });
};
export const config = { path: '/api/dec-upload' };
