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
//   - completes the business card for search engines from Business Settings.
// And writes <folder>/sitemap.xml.
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
check(doc, JSON.parse(seedText));

await writeFile(join(dir, 'index.html'), dom.serialize());
await writeFile(join(dir, 'sitemap.xml'), sitemap());
log('wrote index.html with ' + JSON.parse(seedText).models.length + ' models, and sitemap.xml');

// The parts of the business card that live in Odoo. The static parts — name,
// address, map — stand in index.html beside the contact block they repeat.
function completeBusinessCard(el, data) {
  if (!el) fail('index.html has no business card (#ld-business)');
  let card;
  try { card = JSON.parse(el.textContent); } catch (e) { fail('the business card in index.html is not JSON: ' + e.message); }

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
function check(doc, data) {
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
