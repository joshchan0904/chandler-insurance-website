// Shared lead helpers for the /get-a-quote/ flow on chandlerinsurancemn.com (launch copy of the Round 11 preview code).
// Leads are stored in Netlify Blobs store "quote-leads". Every email is sent DIRECTLY by the function via Microsoft Graph
// (lib/mail.mjs, forms@ -> joshchandler@chandlerinsurancemn.com) with the dec page attached (<= 3 MB) plus a private link.
// A backup copy always goes to Netlify Form "qf-lead-backup" (no notification). Only if the direct send fails is the lead
// posted to Netlify Form "qf-lead", whose ONLY notification goes to joshchandler@ (fallback email).
// Never logs answers, contact details or file contents.
import { getStore } from '@netlify/blobs';
import { sendDirect, ATTACH_MAX } from './mail.mjs';

export const LEADS = 'quote-leads';
export const FILES = 'quote-dec-files';
export const FORM = 'qf-lead';
export const BACKUP_FORM = 'qf-lead-backup';
export const LINK_DAYS = 30;
export const leads = () => getStore({ name: LEADS, consistency: 'strong' });
export const files = () => getStore({ name: FILES, consistency: 'strong' });
export const siteUrl = () => (process.env.URL || 'https://chandlerinsurancemn.com').replace(/\/$/, '');
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
// Automated test harness: browser UA contains "QFHarness" (or the page sets noSend). Such records are stored but never emailed.
export const isHarness = (req) => /QFHarness/i.test(req.headers.get('user-agent') || '');

const PNAMES = { home: 'Home', auto: 'Auto', bundle: 'Home + Auto', cabin: 'Cabin', renters: 'Renters', dwelling: 'Rental property', rec: 'Boat / rec', umbrella: 'Umbrella', life: 'Life', business: 'Business', notsure: 'Not sure yet' };
const one = (s, n = 200) => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').trim().slice(0, n);
export const fileLink = (d) => (d && /^[a-f0-9]{32}$/.test(d.id || '') && /^[a-f0-9]{32}$/.test(d.t || '')) ? `${siteUrl()}/api/dec-file?id=${d.id}&t=${d.t}` : '';

// kind: 'COMPLETE' | 'PARTIAL' | 'DOCUMENT'
export function formFields(rec, kind, extra = {}) {
  const c = rec.contact || {};
  const name = one([c.firstName, c.lastName].filter(Boolean).join(' ')) || 'Unknown name';
  const products = (rec.products || []).map((p) => PNAMES[p] || p).join(', ') || (rec.variant === 'c' ? 'Business' : 'Not chosen');
  const ver = String(rec.variant || '').toUpperCase();
  const tag = kind === 'PARTIAL' ? 'PARTIAL – unfinished quote request' : kind === 'DOCUMENT' ? 'DOCUMENT – added after quote request' : 'COMPLETE – quote request';
  const subject = one(`${tag} (${products}) – ${name} – ${rec.ref}${kind === 'COMPLETE' && rec.partialEmailedAt ? ' (follows earlier PARTIAL)' : ''}`, 240);
  const ct = (iso) => { try { return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }) + ' CT'; } catch { return iso; } };
  const status = kind === 'PARTIAL'
    ? `PARTIAL – the person entered contact info, then stopped. Last activity ${ct(rec.updatedAt)}. Call or email them to finish.`
    : kind === 'DOCUMENT' ? 'DOCUMENT – extra file uploaded from the confirmation page.'
    : `COMPLETE${rec.sentEarly ? ' (sent early with "Send now"; later sections not answered)' : ''}`;
  const link = fileLink(extra.doc || rec.decFile);
  return {
    'form-name': FORM, subject, status, ref: rec.ref, version: ver, products,
    name, email: one(c.email), phone: one(c.phone), contact_pref: one((c.contactPref || []).join(', ')), best_time: one(c.bestTime),
    dec_page_link: link ? `${link}  (private link, works for ${LINK_DAYS} days)` : (rec.decFileNote || 'No file uploaded'),
    follow_up: one((rec.followUp || []).join('; '), 2000),
    summary: String(rec.summary || '(no answers yet)').slice(0, 20000),
    submitted: ct(rec.updatedAt || new Date().toISOString())
  };
}
// Submit to the site's own Netlify Form (server side). Netlify then emails the form's notification address.
export async function sendToForm(fields) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) body.append(k, String(v ?? ''));
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(siteUrl() + '/', { method: 'POST', body, redirect: 'manual', signal: ctl.signal, headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'chandlerinsurancemn-quote/lead-mailer' } });
    return r.status >= 200 && r.status < 400;
  } catch { return false; } finally { clearTimeout(t); }
}

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function leadHtml(f, link, attached) {
  const row = (k, v) => `<tr><td style="padding:4px 10px 4px 0;color:#555;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0">${v}</td></tr>`;
  const btn = link ? `<p style="margin:16px 0"><a href="${esc(link)}" style="background:#0b5394;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:600">Open dec page</a>
<br><span style="color:#555;font-size:13px">One click, no login. Private link, works for ${LINK_DAYS} days.${attached ? ' The file is also attached to this email.' : ''}</span></p>` : '';
  return `<!doctype html><html><body style="font:15px/1.45 -apple-system,Segoe UI,Arial,sans-serif;color:#111">
<p style="font-size:16px"><b>${esc(f.status)}</b></p>${btn}
<table style="border-collapse:collapse">${row('Name', esc(f.name))}${row('Phone', f.phone ? `<a href="tel:${esc(f.phone.replace(/[^0-9+]/g, ''))}">${esc(f.phone)}</a>` : '–')}${row('Email', f.email ? `<a href="mailto:${esc(f.email)}">${esc(f.email)}</a>` : '–')}
${row('Contact by', esc(f.contact_pref || '–'))}${row('Best time', esc(f.best_time || '–'))}${row('Products', esc(f.products))}${row('Reference', esc(f.ref))}${row('Dec page', link ? (attached ? 'Attached + link above' : 'Link above') : esc(f.dec_page_link))}${row('Follow up', esc(f.follow_up || '–'))}${row('Time', esc(f.submitted))}</table>
<h3 style="margin:18px 0 6px">Answers</h3><pre style="font:13px/1.4 Consolas,Menlo,monospace;white-space:pre-wrap;background:#f6f6f6;padding:10px;border-radius:6px">${esc(f.summary)}</pre>
<p style="color:#777;font-size:12px">Sent directly by the chandlerinsurancemn.com quote form (/get-a-quote/). A backup copy is in Netlify Forms (qf-lead-backup).</p></body></html>`;
}
async function loadFile(d) {
  if (!d || !/^[a-f0-9]{32}$/.test(d.id || '')) return null;
  const st = files(); const m = await st.get(`${d.id}/meta`, { type: 'json' }).catch(() => null);
  if (!m || !m.done || m.size > ATTACH_MAX) return null;
  const parts = [];
  for (let i = 0; i < m.chunks; i++) { const ab = await st.get(`${d.id}/${i}`, { type: 'arrayBuffer' }).catch(() => null); if (!ab) return null; parts.push(Buffer.from(ab)); }
  return { name: `dec-page-${m.createdAt.slice(0, 10)}.${m.ext}`, type: m.type, bytes: Buffer.concat(parts) };
}
// Direct email first (with attachment + link); backup copy to Netlify Forms; Forms notification only if direct failed.
// Returns { ok, direct, backup, fallback, attached, error }.
export async function deliver(rec, kind, extra = {}) {
  const f = formFields(rec, kind, extra);
  const d = extra.doc || rec.decFile; const link = fileLink(d);
  const att = await loadFile(d).catch(() => null);
  const [dr, backup] = await Promise.all([
    sendDirect({ subject: f.subject, html: leadHtml(f, link, !!att), replyTo: f.email, attachment: att }),
    sendToForm({ ...f, 'form-name': BACKUP_FORM })
  ]);
  let fallback = false;
  if (!dr.ok) fallback = await sendToForm(f);
  console.log(`lead mail: ${kind} direct=${dr.ok}${dr.ok ? '' : ' (' + dr.error + ')'} attached=${!!att} backup=${backup} fallback=${fallback}`); // no lead data
  return { ok: dr.ok || fallback, direct: dr.ok, backup, fallback, attached: !!att, error: dr.error || '' };
}
