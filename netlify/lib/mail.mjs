// Round 11b – DIRECT email from the site's own functions via Microsoft Graph sendMail (app-only, certificate auth).
// Reuses the Chandler Forms Entra app already used by chandler-forms (Zerfas client form): sender GRAPH_SENDER
// (forms@chandlerinsurancemn.com, Exchange RBAC-scoped to that one mailbox) -> joshchandler@chandlerinsurancemn.com ONLY.
// Env: GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_SENDER, GRAPH_PRIVATE_KEY (PEM or base64 PEM), GRAPH_CERT_SHA256.
// Never logs secrets, lead data or file contents.
import crypto from 'node:crypto';
export const RECIPIENT = 'joshchandler@chandlerinsurancemn.com';
export const ATTACH_MAX = 3 * 1024 * 1024; // Graph sendMail request limit is 4 MB incl. base64; bigger files go by link only
let tokenCache = { token: null, exp: 0 };
const b64url = (b) => Buffer.from(b).toString('base64url');
export const mailConfigured = () => ['GRAPH_TENANT_ID', 'GRAPH_CLIENT_ID', 'GRAPH_SENDER', 'GRAPH_PRIVATE_KEY', 'GRAPH_CERT_SHA256'].every((k) => !!process.env[k]);
function loadKey(raw) {
  let v = String(raw || '').trim();
  if (!v.includes('-----BEGIN')) { v = Buffer.from(v, 'base64').toString('utf8'); if (!v.includes('-----BEGIN')) throw new Error('key format'); }
  try { return crypto.createPrivateKey({ key: v.replace(/\\n/g, '\n'), format: 'pem' }); } catch { throw new Error('key parse'); }
}
async function tfetch(url, opt, ms) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...opt, signal: c.signal }); } finally { clearTimeout(t); }
}
async function token() {
  const env = process.env, now = Date.now();
  if (tokenCache.token && now < tokenCache.exp - 60000) return tokenCache.token;
  const aud = 'https://login.microsoftonline.com/' + encodeURIComponent(env.GRAPH_TENANT_ID) + '/oauth2/v2.0/token';
  const iat = Math.floor(now / 1000);
  const data = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', 'x5t#S256': String(env.GRAPH_CERT_SHA256).trim() })) + '.' +
    b64url(JSON.stringify({ aud, iss: env.GRAPH_CLIENT_ID, sub: env.GRAPH_CLIENT_ID, jti: crypto.randomUUID(), nbf: iat - 30, iat, exp: iat + 300 }));
  const jwt = data + '.' + b64url(crypto.sign('RSA-SHA256', Buffer.from(data), loadKey(env.GRAPH_PRIVATE_KEY)));
  const body = new URLSearchParams({ client_id: env.GRAPH_CLIENT_ID, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials',
    client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: jwt });
  const r = await tfetch(aud, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: body.toString() }, 5000);
  if (!r.ok) throw new Error('token HTTP ' + r.status);
  const j = await r.json(); if (!j.access_token) throw new Error('token missing');
  tokenCache = { token: j.access_token, exp: now + (Number(j.expires_in) || 3000) * 1000 };
  return j.access_token;
}
// Returns { ok, status, error } – error is a short code only.
export async function sendDirect({ subject, html, replyTo, attachment }) {
  if (!mailConfigured()) return { ok: false, error: 'not configured' };
  try {
    const tk = await token();
    const message = { subject, body: { contentType: 'HTML', content: html }, toRecipients: [{ emailAddress: { address: RECIPIENT } }] };
    if (replyTo && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(replyTo)) message.replyTo = [{ emailAddress: { address: replyTo } }];
    if (attachment) message.attachments = [{ '@odata.type': '#microsoft.graph.fileAttachment', name: attachment.name, contentType: attachment.type, contentBytes: attachment.bytes.toString('base64') }];
    const r = await tfetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(process.env.GRAPH_SENDER) + '/sendMail', {
      method: 'POST', headers: { authorization: 'Bearer ' + tk, 'content-type': 'application/json' }, body: JSON.stringify({ message, saveToSentItems: true })
    }, 8000);
    return { ok: r.status === 202, status: r.status, error: r.status === 202 ? '' : 'graph HTTP ' + r.status };
  } catch (e) { return { ok: false, error: String(e && e.name === 'AbortError' ? 'timeout' : (e && e.message) || 'error').slice(0, 40) }; }
}
