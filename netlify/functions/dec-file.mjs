// Round 11 – private download of an uploaded dec page. Needs the random id AND the secret t from the lead email.
// Works for 30 days after upload. Files are deleted 90 days after upload (data-retention.mjs); a well-formed link whose
// file is gone gets a friendly 'no longer available' page (410). Streams the file (never logged). noindex, no-store.
import { createHash } from 'node:crypto';
import { files } from '../lib/leads.mjs';
const hash = (t) => createHash('sha256').update('chq-dec:' + t).digest('hex');
const deny = (msg, status) => new Response(`<!doctype html><meta name="robots" content="noindex"><title>Chandler Insurance</title><p style="font:16px system-ui;margin:2rem">${msg}</p>`, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
export default async (req) => {
  const u = new URL(req.url); const id = u.searchParams.get('id') || '', t = u.searchParams.get('t') || '';
  if (!/^[a-f0-9]{32}$/.test(id) || !/^[a-f0-9]{32}$/.test(t)) return deny('This link is not valid.', 404);
  const store = files();
  const m = await store.get(`${id}/meta`, { type: 'json' }).catch(() => null);
  if (!m) return deny('This file is no longer available. Links work for 30 days, and uploaded files are deleted automatically 90 days after upload. Ask the customer to send the file again.', 410);
  if (m.tokenHash !== hash(t)) return deny('This link is not valid.', 404);
  if (Date.parse(m.expiresAt) < Date.now()) return deny('This link has expired (links work for 30 days, and files are deleted 90 days after upload). Ask the customer to send the file again.', 410);
  if (!m.done) return deny('This file did not finish uploading. Ask the customer to send it again.', 409);
  let i = 0;
  const stream = new ReadableStream({
    async pull(ctl) {
      if (i >= m.chunks) { ctl.close(); return; }
      const ab = await store.get(`${id}/${i++}`, { type: 'arrayBuffer' });
      if (!ab) { ctl.error(new Error('missing part')); return; }
      ctl.enqueue(new Uint8Array(ab));
    }
  });
  return new Response(stream, { status: 200, headers: {
    'content-type': m.type, 'content-length': String(m.size),
    'content-disposition': `inline; filename="dec-page-${m.createdAt.slice(0, 10)}.${m.ext}"`,
    'cache-control': 'private, no-store', 'x-robots-tag': 'noindex', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' } });
};
export const config = { path: '/api/dec-file' };
