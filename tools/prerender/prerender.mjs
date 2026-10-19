// Writes the offline catalog into the page itself, so a robot that runs no
// scripts finds the fleet, the prices, the discounts and the hours in the first
// answer the server gives (d21 stage 3). Run by .github/workflows/publish.yml on
// the copy of the site about to be published — never on the repository's own
// index.html, which stays the plain page that opens with no build step:
//
//   node tools/prerender/prerender.mjs <folder holding index.html>
//
// What it does to <folder>/index.html:
//   - draws the page from <folder>/catalog.json with app.js's own functions, in
//     a DOM of its own (jsdom). Same code, same figures, same markup — which is
//     what lets the live catalog take over in a visitor's browser without
//     anything on screen moving;
//   - drops the grey placeholder cards, which nothing is waiting for any more;
//   - carries the copy along as a JSON block, so app.js starts from it and a card
//     pressed before Odoo answers opens straight away;
//   - completes the business card for search engines from Business Settings,
//     and puts the description from there into the page's own description.
// And writes <folder>/sitemap.xml and <folder>/llms.txt.
//
// Exit codes: 0 — written and checked. 1 — a check failed or something broke;
// nothing is written then, and the publish fails, which turns the run red, puts
// "failed" on the Last Update line in Odoo and wakes the watchdog. The page on
// the site stays the one the last good publish wrote.

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

const SITE = 'https://cebuscooterrental.com/';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function log(...a) { console.log('[prerender]', ...a); }
function fail(why) { console.error('[prerender] not publishing:', why); process.exit(1); }

const dir = process.argv[2];
if (!dir) fail('usage: node tools/prerender/prerender.mjs <site folder>');

const html = await readFile(join(dir, 'index.html'), 'utf8');
const appJs = await readFile(join(dir, 'app.js'), 'utf8');
const seedText = await readFile(join(dir, 'catalog.json'), 'utf8');

const dom = new JSDOM(html, { url: SITE, runScripts: 'outside-only' });
const { window } = dom;
const doc = window.document;

// app.js listens for DOMContentLoaded to start fetching the live catalog. Waiting
// until the document has finished loading means that listener is registered
// after the event, and never runs here.
if (doc.readyState !== 'complete') await new Promise(r => window.addEventListener('load', r));

// Read at the top of app.js. Nothing is fetched: init() never runs here.
window.QA_API = { url: 'https://api.cebuscooterrental.com/qa/catalog', key: '', catalog: new window.Promise(() => {}) };
// app.js is strict code, and strict code run through eval keeps its declarations
// to itself — so the one function needed is handed out from inside the same run.
window.eval(appJs + '\n;window.__qaPrerender = prerender;');

const seed = window.JSON.parse(seedText);
if (!window.__qaPrerender(seed)) fail('catalog.json has no models');

const skel = doc.getElementById('fleet-skel');
if (skel) skel.remove();

// The copy itself, for app.js to start from. `<` is escaped so no value in it
// can close the script element early.
const block = doc.createElement('script');
block.type = 'application/json';
block.id = 'qa-seed';
block.textContent = JSON.stringify(JSON.parse(seedText)).replace(/</g, '\\u003c');
const appTag = doc.querySelector('script[src^="app.js"]');
if (!appTag) fail('index.html has no app.js script tag');
appTag.parentNode.insertBefore(block, appTag);

completeBusinessCard(doc.getElementById('ld-business'), JSON.parse(seedText));
describePage(doc, JSON.parse(seedText));
const llms = llmsTxt(JSON.parse(seedText));
check(doc, JSON.parse(seedText), llms);

await writeFile(join(dir, 'index.html'), dom.serialize());
await writeFile(join(dir, 'sitemap.xml'), sitemap());
await writeFile(join(dir, 'llms.txt'), llms);
log('wrote index.html with ' + JSON.parse(seedText).models.length + ' models, sitemap.xml and llms.txt');

// The two lines under the site in Google's results (d21 stage 4). From Odoo when
// the copy carries `business`; emptied there, the tag goes, and Google writes its
// own lines from the page.
function describePage(doc, data) {
  const b = data.business;
  if (!b || typeof b !== 'object') return;
  const meta = doc.querySelector('meta[name="description"]');
  if (b.description) {
    if (meta) meta.setAttribute('content', b.description);
  } else if (meta) {
    meta.remove();
  }
}

// llms.txt — the business in plain Markdown for the AI that read it (d21 stage
// 4), after the convention at llmstxt.org: a title, a one-line summary as a
// quote, then sections. Everything here is on the page already; this is the
// same thing without the pictures and buttons around it.
function llmsTxt(data) {
  const b = data.business || {};
  const c = data.contacts || {};
  const peso = n => '₱' + Math.round(n).toLocaleString('en-US');
  const cats = {};
  (data.categories || []).forEach(k => { cats[k.slug] = k.label; });
  const out = ['# ' + (b.name || 'Q Adventures Motorbike Rental'), ''];
  if (b.description) out.push('> ' + b.description, '');

  out.push('## Bikes and prices per day', '');
  for (const m of data.models || []) {
    const bits = [m.name];
    if (cats[m.cat]) bits.push(cats[m.cat]);
    if (m.cc) bits.push(m.cc);
    out.push('- ' + bits.join(' — ') + ': ' + peso(m.price) + ' a day' + (m.tag ? '. ' + m.tag : ''));
  }
  out.push('');

  const tiers = (data.discounts || []).filter(t => t.percent > 0);
  if (tiers.length) {
    out.push('## Discounts', '');
    tiers.forEach(t => out.push('- ' + t.percent + '% off for ' + t.min_days + '+ days'));
    out.push('');
  }

  const h = c.hours;
  if (h && h.open && h.close) {
    out.push('## Hours', '', '- Every day ' + h.open + '–' + h.close + (h.note ? '; ' + h.note : ''), '');
  }

  out.push('## Contacts', '');
  (c.phones || []).filter(p => p && p.tel).forEach(p => out.push('- Phone: ' + (p.label || p.tel)));
  const ch = c.channels || {};
  const names = { whatsapp: 'WhatsApp', viber: 'Viber', facebook: 'Facebook', instagram: 'Instagram',
    line: 'LINE', telegram: 'Telegram', wechat: 'WeChat' };
  for (const [key, label] of Object.entries(names)) {
    const it = ch[key];
    if (!it || !it.href) continue;
    const shown = key === 'wechat' && it.id ? 'ID ' + it.id
      : key === 'viber' ? '+' + it.href.replace(/\D/g, '') : it.href;
    out.push('- ' + label + ': ' + shown);
  }
  const a = b.address || {};
  if (a.line) out.push('- Address: ' + a.line + (a.zip ? ' (postcode ' + a.zip + ')' : ''));
  if (b.map && b.map.href) out.push('- Google Maps: ' + b.map.href);
  out.push('- Website: ' + SITE, '');
  return out.join('\n');
}

// The parts of the business card that live in Odoo. What index.html carries —
// name, description, address, map — is only for a copy taken from an Odoo older
// than d21 stage 4, which sends no `business`.
function completeBusinessCard(el, data) {
  if (!el) fail('index.html has no business card (#ld-business)');
  let card;
  try { card = JSON.parse(el.textContent); } catch (e) { fail('the business card in index.html is not JSON: ' + e.message); }

  const b = data.business;
  if (b && typeof b === 'object') {
    if (b.name) card.name = b.name;
    // Emptied in Odoo means none at all (owner, 2026-10-19): Google then takes
    // its own lines from the page rather than an old text of ours.
    if (b.description) card.description = b.description;
    else delete card.description;
    const a = b.address || {};
    if (a.street || a.city) {
      card.address = { '@type': 'PostalAddress' };
      if (a.street) card.address.streetAddress = a.street;
      if (a.city) card.address.addressLocality = a.city;
      if (a.region) card.address.addressRegion = a.region;
      if (a.zip) card.address.postalCode = a.zip;
      if (a.country) card.address.addressCountry = a.country;
    }
    const m = b.map;
    if (m && m.href) {
      card.hasMap = m.href;
      if (typeof m.lat === 'number' && typeof m.lng === 'number') {
        card.geo = { '@type': 'GeoCoordinates', latitude: m.lat, longitude: m.lng };
      }
    }
  }

  const c = data.contacts || {};
  const phones = (c.phones || []).map(p => p && p.tel).filter(Boolean);
  if (phones.length) {
    card.telephone = phones[0];
    card.contactPoint = phones.map(tel => ({ '@type': 'ContactPoint', telephone: tel, contactType: 'customer service' }));
  }
  // Only the opening and closing time. "24 hours by appointment" has no field
  // here; it stays in the page's text, under the hours.
  const h = c.hours;
  if (h && h.open && h.close) {
    card.openingHoursSpecification = [{
      '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS, opens: h.open, closes: h.close,
    }];
  }
  // Profiles, not chats: WhatsApp, Viber and WeChat links start a conversation
  // and say nothing about who the business is.
  const ch = c.channels || {};
  const sameAs = ['facebook', 'instagram', 'youtube', 'telegram', 'line']
    .map(k => ch[k] && ch[k].href).filter(href => /^https:\/\//.test(href || ''));
  if (sameAs.length) card.sameAs = sameAs;

  const prices = (data.models || []).map(m => m.price).filter(p => typeof p === 'number' && p > 0);
  if (prices.length) {
    const p = n => '₱' + Math.round(n).toLocaleString('en-US');
    card.priceRange = p(Math.min(...prices)) + ' – ' + p(Math.max(...prices)) + ' per day';
  }
  el.textContent = '\n' + JSON.stringify(card, null, 2).replace(/</g, '\\u003c') + '\n';
}

// What the acceptance criteria ask the page to hold, checked before it goes out.
function check(doc, data, llms) {
  const cards = doc.querySelectorAll('#fleet-grid > article.card');
  if (cards.length !== data.models.length) {
    fail(cards.length + ' cards drawn for ' + data.models.length + ' models');
  }
  const grid = doc.getElementById('fleet-grid').textContent;
  for (const m of data.models) {
    const price = '₱' + Math.round(m.price).toLocaleString('en-US');
    if (!grid.includes(m.name)) fail('the page has no card named ' + m.name);
    if (!grid.includes(price)) fail('the page has no price ' + price + ' for ' + m.name);
  }
  const pill = doc.getElementById('pill-disc');
  for (const t of (data.discounts || []).filter(t => t.percent > 0)) {
    if (!pill || !pill.textContent.includes(t.min_days + '+ days')) fail('the discount pill does not show the ' + t.min_days + '-day tier');
  }
  const h = data.contacts && data.contacts.hours;
  const hours = doc.getElementById('hours-t');
  if (h && h.open && (!hours || !hours.textContent.includes(h.open) || !hours.textContent.includes(h.close))) {
    fail('the contact block does not show the hours ' + h.open + '–' + h.close);
  }
  const card = JSON.parse(doc.getElementById('ld-business').textContent);
  for (const key of ['name', 'address', 'geo', 'url']) {
    if (!card[key]) fail('the business card has no ' + key);
  }
  const b = data.business;
  if (b && b.description) {
    if (card.description !== b.description) fail('the business card does not carry the description from Odoo');
    const meta = doc.querySelector('meta[name="description"]');
    if (!meta || meta.getAttribute('content') !== b.description) fail('the page description is not the one from Odoo');
  }
  for (const m of data.models) {
    const price = '₱' + Math.round(m.price).toLocaleString('en-US');
    if (!llms.includes('- ' + m.name) || !llms.includes(price)) fail('llms.txt has no ' + m.name + ' at ' + price);
  }
}

// One page. lastmod is the publish itself: the site is published when what it
// says has changed, so the day of the publish is the day the page last changed.
function sitemap() {
  const day = new Date().toISOString().slice(0, 10);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    '  <url><loc>' + SITE + '</loc><lastmod>' + day + '</lastmod></url>\n' +
    '</urlset>\n';
}
