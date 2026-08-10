/* Q Adventures — everything on the page that moves.
   Ported from the logic block of the old .dc.html. The rules are unchanged; what
   changed is that nothing here draws the page's furniture any more — the header,
   hero, story, contacts and footer are plain HTML now, and this file only owns
   the fleet grid, the two calendars, the booking modal and the contact form. */

'use strict';

// --- Constants, carried over unchanged --------------------------------------

const CURRENCIES = {
  PHP: { symbol: '₱',   rate: 1,     label: '₱ PHP' },
  USD: { symbol: '$',   rate: 0.017, label: '$ USD' },
  EUR: { symbol: '€',   rate: 0.016, label: '€ EUR' },
  AUD: { symbol: 'A$',  rate: 0.026, label: 'A$ AUD' },
  SGD: { symbol: 'S$',  rate: 0.023, label: 'S$ SGD' },
  KRW: { symbol: '₩',   rate: 23.5,  label: '₩ KRW' },
  JPY: { symbol: '¥',   rate: 2.6,   label: '¥ JPY' },
  CNY: { symbol: 'CN¥', rate: 0.12,  label: 'CN¥ CNY' },
};

// Fallback picture per card, by site_id. Filename including extension, because
// one of them is a .webp and the rest are .png.
const BIKE_IMG = {
  pcx160:    'images/bike-pcx160.png',
  aerox155:  'images/bike-aerox155.png',
  burgman:   'images/bike-burgman.png',
  gravis125: 'images/bike-gravis125.png',
  click125i: 'images/bike-click125i.webp',
  pcx160abs: 'images/bike-pcx160abs.png',
  adv160:    'images/bike-adv160.png',
  adv350:    'images/bike-adv350.png',
  vstrom250: 'images/bike-vstrom250.png',
  rouser160: 'images/bike-rouser160.png',
};

// The key is deliberately committed and NOT a secret: a static page has no server
// to hide it behind, and the endpoint only serves already-public catalog data. It
// is a speed-bump against scrapers, paired with the endpoint's CORS origin check.
// Keep it in sync with Odoo's `qa_catalog.api_key` (do not regenerate it).
// URL is localhost for now — repoint to the public Odoo host at deploy time.
const CATALOG_API_URL = 'http://localhost:8069/qa/catalog';
const CATALOG_API_KEY = 'uo_HMSZHGdkrKDQeSoYdvdpeNU-loThwYSiCfqopgh0';

// Derived rather than written out again, so the deploy still repoints one constant.
const BOOK_API_URL = CATALOG_API_URL.replace(/\/qa\/catalog\/?$/, '') + '/qa/book';

// The offline copy, refreshed daily by a GitHub schedule (plan 0007). Same shape
// as the endpoint's answer, served from this site's own origin — so it is reachable
// exactly when Odoo is not.
const FALLBACK_JSON_URL = 'catalog.json';

// Client ids are public by design. What is NOT interchangeable is the origin: the
// address this page is served from must be a registered JavaScript origin on that
// client, or the popup refuses with origin_mismatch and nothing reports why.
const GOOGLE_CLIENT_ID = '754460266117-11d4750piukfr2831t5ermlj86qn0k0q.apps.googleusercontent.com';
const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
// How long to wait for Google's script before deciding it will never arrive — an ad
// blocker, a privacy browser, hotel Wi-Fi. A visitor in that position must never be
// shown a button that cannot work, so the wait is bounded and WhatsApp takes over.
const GOOGLE_LOAD_TIMEOUT = 4000;

// The number the WhatsApp buttons write to until the catalog answers with the real
// one. It cannot be dropped in favour of the payload: an unreachable Odoo is exactly
// when this number matters most.
const WHATSAPP_DEFAULT = '16266266347';

// Last-known catalog, in the endpoint's shape. The third and last level: used when
// neither Odoo nor catalog.json answered. Photos fall back to the bundled images/.
const FALLBACK_MODELS = [
  { id:'pcx160', name:'Honda PCX160', cc:'160cc', cat:'scooter', price:700, weekly:4410, monthly:16800, tag:'Best-selling premium scooter', badge:'Best Seller', specs:['Automatic','Top box','2 helmets'], photos:[BIKE_IMG.pcx160], units:[],
    overview:'The Honda PCX160 is a comfort-focused premium scooter that balances a refined ride with strong performance — well suited to both urban commutes and longer suburban trips.',
    pros:['Comfort-focused ride — wide seat, spacious legroom, and superior suspension for longer trips.','Strong engine performance — the 157cc engine delivers smooth acceleration and excellent power for urban and suburban riding.','Premium design — stylish, modern body with LED lights and an upscale aesthetic.','Excellent fuel efficiency — great mileage despite the higher displacement.','Large under-seat storage — fits a helmet and additional items with ease.','Enhanced safety features — ABS and traction improvements (depending on model/year).'],
    cons:['Wider body — less agile in heavy traffic than slimmer scooters like the Click 125i or Mio.','Heavier build — requires more effort to maneuver in tight spaces or when parking.','Higher price point — more costly than other 150cc-class scooters.'] },
  { id:'aerox155', name:'Yamaha Aerox 155', cc:'155cc', cat:'scooter', price:700, weekly:4410, monthly:16800, tag:'Sporty and quick around town', badge:'', specs:['Automatic','Top box','2 helmets'], photos:[BIKE_IMG.aerox155], units:[] },
  { id:'burgman', name:'Suzuki Burgman 125 EX', cc:'125cc', cat:'scooter', price:650, weekly:4095, monthly:15600, tag:'Comfortable maxi-style ride', badge:'', specs:['Automatic','Top box','2 helmets'], photos:[BIKE_IMG.burgman], units:[] },
  { id:'gravis125', name:'Yamaha Gravis 125', cc:'125cc', cat:'scooter', price:600, weekly:3780, monthly:14400, tag:'Easy, economical everyday runabout', badge:'', specs:['Automatic','Top box','2 helmets'], photos:[BIKE_IMG.gravis125], units:[] },
  { id:'click125i', name:'Honda Click 125i', cc:'125cc', cat:'scooter', price:600, weekly:3780, monthly:14400, tag:'The reliable all-rounder', badge:'', specs:['Automatic','Top box','2 helmets'], photos:[BIKE_IMG.click125i], units:[],
    overview:'The Honda Click 125i is an excellent choice for city riding. Its slim, agile design makes it perfect for navigating heavy traffic and tight urban spaces.',
    pros:['Lightweight & easy to handle — ideal for new riders or busy city environments.','Punchy performance — despite being a 125cc, it feels closer to a 150cc in acceleration.','Narrow body — lets you slip smoothly through congested roads and tight gaps.'],
    cons:['Single rear shock — may feel uncomfortable on the back after long rides (40+ minutes).','Narrow seat — less comfortable for wider builds or long-distance travel.','Limited under-seat storage — enough for essentials, but not much more.'] },
  { id:'pcx160abs', name:'Honda PCX160 ABS', cc:'160cc', cat:'scooter', price:850, weekly:5355, monthly:20400, tag:'PCX comfort with ABS safety', badge:'', specs:['Automatic','ABS','Top box'], photos:[BIKE_IMG.pcx160abs], units:[] },
  { id:'adv160', name:'Honda ADV160 ABS', cc:'160cc', cat:'adventure', price:900, weekly:5670, monthly:21600, tag:'Adventure-styled and rugged', badge:'', specs:['Automatic','ABS','Big storage'], photos:[BIKE_IMG.adv160], units:[] },
  { id:'adv350', name:'Honda ADV350', cc:'350cc', cat:'adventure', price:1900, weekly:11970, monthly:45600, tag:'The flagship — highway ready', badge:'Top spec', specs:['Automatic','ABS','Traction control'], photos:[BIKE_IMG.adv350], units:[] },
  { id:'vstrom250', name:'Suzuki V-Strom 250', cc:'250cc', cat:'adventure', price:1300, weekly:8190, monthly:31200, tag:'Go anywhere, ride all day', badge:'Featured', specs:['Manual','Touring','Long range'], photos:[BIKE_IMG.vstrom250], units:[] },
  { id:'rouser160', name:'Kawasaki Rouser 160', cc:'160cc', cat:'adventure', price:800, weekly:5040, monthly:19200, tag:'Punchy naked street bike', badge:'', specs:['Manual','Nimble','Fuel-efficient'], photos:[BIKE_IMG.rouser160], units:[] },
];

// --- State ------------------------------------------------------------------

const S = {
  models: null, categories: null, catalogError: false, filter: 'all',
  selected: null, photoIndex: 0,
  pickup: '', dropoff: '', step: 'form',
  availFrom: '', availTo: '', availOnly: false, calOpen: false, calCursor: '',
  modalCalOpen: false, modalCursor: '',
  currency: 'PHP', mobileMenuOpen: false,
  // Priced by the shop, not by this file. `null` means the catalog never answered,
  // and then the form quotes the day rate only — inventing a discount tier here is
  // how a site ends up promising a number the counter will not honour.
  discounts: null, zones: null, whatsapp: '',
  zoneId: '', address: '', phone: '', note: '',
  sending: false, googleReady: false, googleFailed: false, account: null,
  waReason: '', hint: '',
};

const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

// Text in, text out. Every value that reaches innerHTML goes through this.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// --- Money, dates, the quote ------------------------------------------------

function peso(n) {
  const c = CURRENCIES[S.currency] || CURRENCIES.PHP;
  return c.symbol + Math.round(n * c.rate).toLocaleString('en-US');
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s + 'T00:00:00');
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toISO(y, m, d) {
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

// DO NOT "simplify" this. Odoo bills ceil(hours / 24) and the site counts a plain
// date difference; the two agree only because pickup and return carry the same
// clock time (09:00). Moving either side quotes seven days and invoices eight.
function days() {
  if (!S.pickup || !S.dropoff) return 0;
  const d = (new Date(S.dropoff) - new Date(S.pickup)) / 86400000;
  if (d < 0) return 0;
  if (d === 0) return 1;
  return Math.round(d);
}

function discountPct() {
  const d = days();
  let pct = 0;
  for (const tier of (S.discounts || [])) {
    if (d >= tier.min_days && tier.percent > pct) pct = tier.percent;
  }
  return pct / 100;
}

function zone() {
  if (!S.zoneId) return null;
  return (S.zones || []).find(z => String(z.id) === String(S.zoneId)) || null;
}

function quote() {
  const d = days();
  const price = S.selected ? S.selected.price : 0;
  const subtotal = d * price;
  const pct = discountPct();
  const discount = Math.round(subtotal * pct);
  const z = zone();
  const delivery = z ? z.price : 0;
  return { days: d, subtotal, pct, discount, zone: z, delivery, total: subtotal - discount + delivery };
}

// --- The catalog ------------------------------------------------------------

function catCaption(slug) {
  return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : '';
}

function normalizeModel(m, captions) {
  const hasDesc = !!(m.overview || (m.pros && m.pros.length) || (m.cons && m.cons.length));
  return {
    id: m.id, name: m.name, cc: m.cc, cat: m.cat,
    catLabel: (captions && captions[m.cat]) || catCaption(m.cat),
    price: m.price, weekly: m.weekly, monthly: m.monthly,
    tag: m.tag || '', badge: m.badge || '', specs: m.specs || [],
    photos: m.photos || [], units: m.units || [],
    desc: hasDesc ? { overview: m.overview || '', pros: m.pros || [], cons: m.cons || [] } : null,
  };
}

function catCaptions() {
  const out = {};
  (S.categories || []).forEach(c => { if (c && c.slug) out[c.slug] = c.label || catCaption(c.slug); });
  return out;
}

function fleet() {
  const captions = catCaptions();
  return (S.models || []).map(m => normalizeModel(m, captions));
}

// "All bikes" first, then one tab per category. Odoo decides which categories
// exist, what they are called and in what order — adding one there is all it takes
// for a tab to appear here. Intersected with the slugs actually present, because a
// stale offline copy can disagree and a tab filtering to nothing is worse than a
// missing one.
function catTabs() {
  const present = new Set((S.models || []).map(m => m.cat).filter(Boolean));
  const ordered = (S.categories || []).map(c => c && c.slug).filter(slug => present.has(slug));
  const slugs = ordered.length ? ordered : Array.from(present).sort();
  const captions = catCaptions();
  return [{ key: 'all', label: 'All bikes' }]
    .concat(slugs.map(slug => ({ key: slug, label: captions[slug] || catCaption(slug) })));
}

function availInfo() {
  const parseIso = s => { const d = new Date(s + 'T00:00:00'); d.setHours(0,0,0,0); return d.getTime(); };
  const chosen = !!(S.availFrom && S.availTo) && parseIso(S.availTo) >= parseIso(S.availFrom);
  const from = chosen ? parseIso(S.availFrom) : 0;
  const to = chosen ? parseIso(S.availTo) : 0;
  // A model is available if AT LEAST ONE of its physical units is free over the range.
  const isAvailable = b => {
    if (!chosen) return true;
    const units = (b.units && b.units.length) ? b.units : [{ booked: [] }];
    return units.some(u => !(u.booked || []).some(([bs, be]) => from <= parseIso(be) && to >= parseIso(bs)));
  };
  return { chosen, isAvailable };
}

// Three levels, in order: live Odoo, then the offline copy served from this same
// origin, then the list compiled into this file. "Reachable but empty" counts as a
// failure at every level — a wrong key answers {"models": []}, and an answer with no
// models makes its other fields no more trustworthy than its empty list.
function applyCatalog(data, source) {
  const models = (data && Array.isArray(data.models)) ? data.models : [];
  if (!models.length) return false;
  S.models = models;
  S.categories = (data && Array.isArray(data.categories)) ? data.categories : null;
  S.catalogError = source !== 'odoo';
  S.discounts = Array.isArray(data.discounts)
    ? data.discounts.slice().sort((a, b) => a.min_days - b.min_days) : null;
  S.zones = Array.isArray(data.delivery_zones) ? data.delivery_zones : null;
  S.whatsapp = (typeof data.whatsapp === 'string' && data.whatsapp) ? data.whatsapp : '';
  return true;
}

function loadCatalog() {
  fetch(CATALOG_API_URL + '?key=' + encodeURIComponent(CATALOG_API_KEY))
    .then(r => r.json())
    .then(data => {
      if (applyCatalog(data, 'odoo')) { renderCatalog(); return; }
      console.warn('[catalog] endpoint returned no models; trying the offline copy');
      return loadOfflineCopy();
    })
    .catch(err => {
      console.warn('[catalog] endpoint unreachable; trying the offline copy', err);
      return loadOfflineCopy();
    });
}

function loadOfflineCopy() {
  return fetch(FALLBACK_JSON_URL, { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('no offline copy'))))
    .then(data => {
      if (applyCatalog(data, 'offline')) { renderCatalog(); return; }
      throw new Error('offline copy is empty');
    })
    .catch(err => {
      console.warn('[catalog] offline copy unusable; using the compiled list', err);
      applyCatalog({ models: FALLBACK_MODELS }, 'compiled');
      S.models = FALLBACK_MODELS;
      S.categories = null;
      S.catalogError = true;
      renderCatalog();
    });
}

// --- The fleet grid ---------------------------------------------------------

function renderTabs() {
  const host = $('#fleet-tabs');
  if (!host) return;
  const tabs = catTabs();
  // One category and "All bikes" is not a filter, it is decoration.
  if (tabs.length <= 2) { host.innerHTML = ''; host.hidden = true; return; }
  host.hidden = false;
  host.innerHTML = tabs.map(t =>
    '<button class="tab' + (S.filter === t.key ? ' is-active' : '') + '" data-tab="' + esc(t.key) + '">' +
    esc(t.label) + '</button>').join('');
  $$('.tab', host).forEach(b => b.addEventListener('click', () => {
    S.filter = b.getAttribute('data-tab');
    renderCatalog();
  }));
}

function visibleFleet() {
  const { chosen, isAvailable } = availInfo();
  let list = fleet().filter(b => S.filter === 'all' || b.cat === S.filter);
  if (chosen && S.availOnly) list = list.filter(isAvailable);
  return list;
}

function renderFleet() {
  const grid = $('#fleet-grid');
  const loading = $('#fleet-loading');
  if (loading) loading.hidden = S.models !== null;
  if (!grid) return;

  const { chosen, isAvailable } = availInfo();
  grid.innerHTML = visibleFleet().map(b => {
    const avail = isAvailable(b);
    const img = (b.photos && b.photos[0]) || BIKE_IMG[b.id] || '';
    const booked = chosen && !avail;
    return '' +
      '<article class="card' + (booked ? ' is-booked' : '') + '" data-bike="' + esc(b.id) + '">' +
        '<div class="card__media">' +
          (img ? '<img src="' + esc(img) + '" alt="' + esc(b.name) + '" loading="lazy">'
               : '<div class="card__noimg">' + esc(b.name) + '</div>') +
          (b.badge ? '<span class="card__badge">' + esc(b.badge) + '</span>' : '') +
          (chosen ? '<span class="card__chip' + (avail ? ' is-free' : ' is-taken') + '">● ' +
                    (avail ? 'Available' : 'Booked') + '</span>' : '') +
          (booked ? '<div class="card__dim"></div>' : '') +
        '</div>' +
        '<div class="card__body">' +
          '<div class="card__meta">' +
            '<span class="card__cat">' + esc(b.catLabel) + '</span>' +
            '<span class="card__cc">' + esc(b.cc) + '</span>' +
          '</div>' +
          '<h3 class="card__name">' + esc(b.name) + '</h3>' +
          '<div class="card__tag">' + esc(b.tag) + '</div>' +
          '<div class="card__specs">' + (b.specs || []).map(s =>
            '<span class="spec">' + esc(s) + '</span>').join('') + '</div>' +
          '<div class="card__foot">' +
            '<div>' +
              '<div><span class="card__price">' + esc(peso(b.price)) + '</span><span class="card__per">/day</span></div>' +
              '<div class="card__wk">' + esc(peso(b.weekly) + '/wk · ' + peso(b.monthly) + '/mo') + '</div>' +
            '</div>' +
            '<button class="card__book" ' + (booked ? 'disabled' : '') + '>' +
              (booked ? 'Booked' : 'Book') + '</button>' +
          '</div>' +
        '</div>' +
      '</article>';
  }).join('');

  $$('.card', grid).forEach(el => el.addEventListener('click', () => {
    if (el.classList.contains('is-booked')) return;
    const id = el.getAttribute('data-bike');
    const bike = fleet().find(b => b.id === id);
    if (bike) openModal(bike);
  }));
}

function renderAvailBar() {
  const label = $('#avail-label');
  const count = $('#avail-count');
  const only = $('#avail-only');
  const onlyLabel = $('#avail-only-label');
  const field = $('#avail-field');
  const { chosen, isAvailable } = availInfo();

  if (label) {
    label.textContent = (S.availFrom && S.availTo)
      ? (fmtDate(S.availFrom) + ' – ' + fmtDate(S.availTo))
      : (S.availFrom ? (fmtDate(S.availFrom) + ' – …') : 'Select dates');
    label.classList.toggle('is-filled', !!S.availFrom);
  }
  if (field) field.classList.toggle('is-open', S.calOpen);
  if (only) { only.disabled = !chosen; only.checked = S.availOnly; }
  if (onlyLabel) onlyLabel.classList.toggle('is-on', chosen);
  if (count) {
    count.hidden = !chosen;
    if (chosen) {
      const list = visibleFleet();
      const n = list.filter(isAvailable).length;
      count.textContent = n + ' of ' + list.length + ' available';
      count.classList.toggle('is-some', n > 0);
      count.classList.toggle('is-none', n === 0);
    }
  }
}

function renderCatalog() {
  renderTabs();
  renderAvailBar();
  renderFleet();
  if (S.selected) updateModal();
  const wa = $('#shop-wa');
  if (wa) wa.href = 'https://wa.me/' + waNumber();
  const from = $('#hero-from');
  // The hero's "scooters from" figure follows the currency selector, as it did.
  if (from) from.textContent = peso(600);
}

// --- Calendars --------------------------------------------------------------

const CAL = {
  avail: { fromKey: 'availFrom', toKey: 'availTo', curKey: 'calCursor', openKey: 'calOpen' },
  modal: { fromKey: 'pickup',    toKey: 'dropoff', curKey: 'modalCursor', openKey: 'modalCalOpen' },
};

function cursorDate(ctx) {
  const cfg = CAL[ctx];
  const c = S[cfg.curKey] || S[cfg.fromKey];
  const base = c ? new Date(c + 'T00:00:00') : new Date();
  return new Date(base.getFullYear(), base.getMonth(), 1);
}

function shiftMonth(ctx, delta) {
  const c = cursorDate(ctx);
  const n = new Date(c.getFullYear(), c.getMonth() + delta, 1);
  S[CAL[ctx].curKey] = toISO(n.getFullYear(), n.getMonth(), 1);
  renderCal(ctx);
}

function pickDay(ctx, iso) {
  const cfg = CAL[ctx];
  const from = S[cfg.fromKey], to = S[cfg.toKey];
  if (!from || (from && to)) { S[cfg.fromKey] = iso; S[cfg.toKey] = ''; }
  else if (iso < from)       { S[cfg.fromKey] = iso; }
  else                       { S[cfg.toKey] = iso; S[cfg.openKey] = false; }
  renderCal(ctx);
  if (ctx === 'avail') renderCatalog();
  else updateModal();
}

function calCells(ctx) {
  const cfg = CAL[ctx];
  const cur = cursorDate(ctx);
  const y = cur.getFullYear(), m = cur.getMonth();
  const startWd = (new Date(y, m, 1).getDay() + 6) % 7;
  const dim = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const todayIso = toISO(today.getFullYear(), today.getMonth(), today.getDate());
  const from = S[cfg.fromKey], to = S[cfg.toKey];
  const cells = [];
  for (let i = 0; i < startWd; i++) cells.push({ blank: true });
  for (let d = 1; d <= dim; d++) {
    const iso = toISO(y, m, d);
    const wd = (startWd + d - 1) % 7;
    const past = iso < todayIso;
    const sel = !!from && ((to && iso >= from && iso <= to) || (!to && iso === from));
    // Rounded only where the selected run starts and ends, so a range reads as one bar.
    const roundL = iso === from || wd === 0 || d === 1;
    const roundR = (to ? iso === to : iso === from) || wd === 6 || d === dim;
    cells.push({ iso, label: String(d), past, sel, roundL, roundR });
  }
  return { title: cur.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), cells };
}

function calHTML(ctx) {
  const { title, cells } = calCells(ctx);
  const wd = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  return '' +
    '<div class="cal__head">' +
      '<button class="cal__nav" data-cal-nav="-1">‹</button>' +
      '<div class="cal__title">' + esc(title) + '</div>' +
      '<button class="cal__nav" data-cal-nav="1">›</button>' +
    '</div>' +
    '<div class="cal__wd">' + wd.map((w, i) =>
      '<div class="cal__wdc' + (i > 4 ? ' is-weekend' : '') + '">' + w + '</div>').join('') + '</div>' +
    '<div class="cal__grid">' + cells.map(c => {
      if (c.blank) return '<div class="cal__day is-blank"></div>';
      const radius = c.sel
        ? ' style="border-radius:' + (c.roundL ? '10px' : '0') + ' ' + (c.roundR ? '10px' : '0') +
          ' ' + (c.roundR ? '10px' : '0') + ' ' + (c.roundL ? '10px' : '0') + '"'
        : '';
      return '<div class="cal__day' + (c.past ? ' is-past' : '') + (c.sel ? ' is-sel' : '') + '"' +
             (c.past ? '' : ' data-day="' + c.iso + '"') + radius + '>' + c.label + '</div>';
    }).join('') + '</div>' +
    (ctx === 'avail'
      ? '<div class="cal__foot"><button class="cal__clear" data-cal-clear>Clear</button>' +
        '<button class="cal__done" data-cal-done>Done</button></div>'
      : '<div class="cal__foot cal__foot--end"><button class="cal__done" data-cal-done>Done</button></div>');
}

function renderCal(ctx) {
  const host = ctx === 'avail' ? $('#avail-cal') : $('#modal-cal');
  if (!host) return;
  const open = S[CAL[ctx].openKey];
  host.hidden = !open;
  if (!open) { host.innerHTML = ''; return; }
  host.innerHTML = '<div class="cal">' + calHTML(ctx) + '</div>';

  $$('[data-cal-nav]', host).forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    shiftMonth(ctx, Number(b.getAttribute('data-cal-nav')));
  }));
  $$('[data-day]', host).forEach(d => d.addEventListener('click', e => {
    e.stopPropagation();
    pickDay(ctx, d.getAttribute('data-day'));
  }));
  const clear = $('[data-cal-clear]', host);
  if (clear) clear.addEventListener('click', e => {
    e.stopPropagation();
    S.availFrom = ''; S.availTo = ''; S.availOnly = false;
    renderCal('avail'); renderCatalog();
  });
  const done = $('[data-cal-done]', host);
  if (done) done.addEventListener('click', e => {
    e.stopPropagation();
    S[CAL[ctx].openKey] = false;
    renderCal(ctx);
    if (ctx === 'avail') renderAvailBar();
  });
}

// --- Google sign-in ---------------------------------------------------------

let googleSettled = false, googleTimer = null;

function loadGoogle() {
  const settle = ok => {
    if (googleSettled) return;
    googleSettled = true;
    clearTimeout(googleTimer);
    S.googleReady = ok;
    S.googleFailed = !ok;
    if (S.selected) updateModal();
  };
  googleTimer = setTimeout(() => settle(false), GOOGLE_LOAD_TIMEOUT);
  const script = document.createElement('script');
  script.src = GOOGLE_SCRIPT_URL;
  script.async = true;
  script.onload = () => settle(!!(window.google && window.google.accounts && window.google.accounts.oauth2));
  script.onerror = () => settle(false);
  document.head.appendChild(script);
}

// --- WhatsApp ---------------------------------------------------------------

function waNumber() {
  return S.whatsapp || WHATSAPP_DEFAULT;
}

// The booking written out for a person to read. Whatever is empty is left out
// rather than leaving a gap in the sentence.
function waMessage() {
  const name = S.selected ? S.selected.name : 'one of your bikes';
  const dates = fmtDate(S.pickup) + ' – ' + fmtDate(S.dropoff);
  const q = quote();

  if (S.waReason === 'unavailable') {
    return 'Hi! I wanted to book the *' + name + '*, ' + dates +
      ', but the site says it’s taken for those dates. Is anything else available?' +
      ' Sent from the website.';
  }

  let text = 'Hi! I’d like to book the *' + name + '*, ' + dates +
    ' (' + q.days + (q.days === 1 ? ' day' : ' days') + ')';
  if (q.zone && S.address.trim()) text += ', delivery to ' + q.zone.name + ' — ' + S.address.trim();
  else if (q.zone) text += ', delivery to ' + q.zone.name;
  else text += ', pickup at the shop';
  text += '.';
  // A WhatsApp booking leaves no record, so the message has to be one — and a figure
  // that has drifted from the shop's own shows up here, read at the keyboard rather
  // than argued about at the counter.
  if (q.total > 0) text += ' The site showed ' + peso(q.total) + '.';
  if (S.phone.trim()) text += ' My number: ' + S.phone.trim() + '.';
  if (S.note.trim()) text += ' ' + S.note.trim().replace(/([^.!?])$/, '$1.');
  return text + ' Sent from the website.';
}

function openWhatsApp() {
  // Only a broken date range stops this. Everything else missing is simply left out
  // of the message — demanding a phone number before someone may open a messenger
  // asks for a fact the messenger is about to supply.
  if (days() <= 0) { S.hint = 'Choose your dates first.'; updateModal(); return; }
  window.open('https://wa.me/' + waNumber() + '?text=' + encodeURIComponent(waMessage()),
              '_blank', 'noopener');
}

function toWhatsApp(reason) {
  S.sending = false; S.waReason = reason; S.hint = '';
  updateModal();
}

// --- Sending the booking ----------------------------------------------------

// What the endpoint insists on, checked here so the visitor hears about it before a
// popup opens rather than after a round trip. The server checks all of it again —
// this is courtesy, not security.
function bookProblem() {
  if (!S.selected) return 'Pick a bike first.';
  if (days() <= 0) return 'Choose your pick-up and drop-off dates.';
  if (!S.phone.trim()) return 'Add a phone number — it is how we reach you.';
  if (zone() && !S.address.trim()) return 'Add the address to deliver to.';
  return '';
}

function requestBooking() {
  const problem = bookProblem();
  if (problem) { S.hint = problem; updateModal(); return; }
  if (!S.googleReady) { toWhatsApp('nogoogle'); return; }

  // The popup opens inside the click, with nothing awaited before it. After an await
  // the user gesture is spent and the browser blocks the window — and it breaks only
  // for the visitor, never with a console open.
  let client;
  try {
    client = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'email profile',
      callback: resp => {
        if (!resp || !resp.access_token) { toWhatsApp('signin'); return; }
        postBooking(resp.access_token);
      },
      error_callback: () => toWhatsApp('signin'),
    });
  } catch (err) {
    toWhatsApp('nogoogle');
    return;
  }
  S.hint = ''; S.sending = true; updateModal();
  client.requestAccessToken();
}

function postBooking(token) {
  const z = zone();
  const quoted = quote().total;
  fetch(BOOK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: CATALOG_API_KEY,
      token,
      model_id: S.selected.id,
      pickup: S.pickup,
      return: S.dropoff,
      phone: S.phone.trim(),
      zone_id: z ? z.id : null,
      address: z ? S.address.trim() : '',
      note: S.note.trim(),
      // Shown to the visitor, never used to price anything. It travels so a later
      // "but the site said so" has an answer on the order itself.
      quoted,
    }),
  })
    .then(r => r.json())
    .then(answer => {
      if (answer && answer.ok) {
        namedAccount(token);
        S.sending = false; S.step = 'done'; S.waReason = ''; S.hint = '';
        renderModalBody();
        return;
      }
      // An answer that said no must never be shown as a booking.
      toWhatsApp((answer && answer.error === 'unavailable') ? 'unavailable' : 'refused');
    })
    .catch(() => toWhatsApp('refused'));
}

// The confirmation names the account the booking went under. Sign-in happens at
// submit time, so there is no earlier moment to show it — and someone with two
// Google accounts will want to know which one was used.
function namedAccount(token) {
  fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + token } })
    .then(r => r.json())
    .then(p => { S.account = { name: p.name || '', email: p.email || '' }; renderModalBody(); })
    .catch(() => {});
}

// --- The modal --------------------------------------------------------------

function modalPhotos() {
  const sel = S.selected;
  const img = (sel.photos && sel.photos[0]) || BIKE_IMG[sel.id] || '';
  return (sel.photos && sel.photos.length) ? sel.photos : (img ? [img] : []);
}

function openModal(bike) {
  // A fresh modal: whatever the last attempt ended in must not greet the next bike
  // with somebody else's error.
  S.selected = bike;
  S.photoIndex = 0;
  S.step = 'form';
  S.pickup = S.availFrom || S.pickup;
  S.dropoff = S.availTo || S.dropoff;
  S.waReason = ''; S.hint = ''; S.account = null; S.sending = false;
  S.modalCalOpen = false;

  const root = $('#modal-root');
  root.innerHTML =
    '<div class="ovl" id="ovl">' +
      '<div class="sheet" id="sheet">' +
        '<div class="sheet__media" id="sheet-media"></div>' +
        '<div class="sheet__thumbs" id="sheet-thumbs" hidden></div>' +
        '<div class="sheet__body" id="sheet-body"></div>' +
      '</div>' +
    '</div>';

  $('#ovl').addEventListener('click', closeModal);
  $('#sheet').addEventListener('click', e => e.stopPropagation());
  document.addEventListener('keydown', onEsc);
  document.body.style.overflow = 'hidden';

  renderModalMedia();
  renderModalBody();
}

function onEsc(e) { if (e.key === 'Escape') closeModal(); }

function closeModal() {
  S.selected = null; S.waReason = ''; S.hint = ''; S.account = null; S.sending = false;
  S.modalCalOpen = false;
  const root = $('#modal-root');
  if (root) root.innerHTML = '';
  document.removeEventListener('keydown', onEsc);
  document.body.style.overflow = '';
}

function cyclePhoto(delta) {
  const len = modalPhotos().length || 1;
  if (len <= 1) return;
  S.photoIndex = ((S.photoIndex + delta) % len + len) % len;
  renderModalMedia();
}

function renderModalMedia() {
  const sel = S.selected;
  if (!sel) return;
  const photos = modalPhotos();
  const idx = Math.min(Math.max(S.photoIndex, 0), Math.max(0, photos.length - 1));
  const many = photos.length > 1;

  $('#sheet-media').innerHTML =
    '<img src="' + esc(photos[idx] || '') + '" alt="' + esc(sel.name) + '">' +
    '<button class="sheet__x" data-close>✕</button>' +
    (many ? '<button class="sheet__arrow sheet__arrow--l" data-photo="-1" aria-label="Previous photo">‹</button>' +
            '<button class="sheet__arrow sheet__arrow--r" data-photo="1" aria-label="Next photo">›</button>' : '');

  const thumbs = $('#sheet-thumbs');
  thumbs.hidden = !many;
  thumbs.innerHTML = many ? photos.map((p, i) =>
    '<img class="thumb' + (i === idx ? ' is-on' : '') + '" src="' + esc(p) + '" data-thumb="' + i + '" alt="">').join('') : '';

  $$('[data-close]').forEach(b => b.addEventListener('click', closeModal));
  $$('[data-photo]').forEach(b => b.addEventListener('click', () => cyclePhoto(Number(b.getAttribute('data-photo')))));
  $$('[data-thumb]', thumbs).forEach(t => t.addEventListener('click', () => {
    S.photoIndex = Number(t.getAttribute('data-thumb'));
    renderModalMedia();
  }));
}

function renderModalBody() {
  const sel = S.selected;
  if (!sel) return;
  const body = $('#sheet-body');
  body.innerHTML = S.step === 'done' ? doneHTML() : formHTML();
  if (S.step === 'done') wireDone(); else wireForm();
}

function formHTML() {
  const sel = S.selected;
  const hasZones = !!(S.zones && S.zones.length);
  return '' +
    '<div class="sheet__meta">' +
      '<span class="card__cat">' + esc(sel.catLabel) + '</span>' +
      '<span class="sheet__cc">' + esc(sel.cc) + '</span>' +
    '</div>' +
    '<div class="sheet__head">' +
      '<h2 class="sheet__name">' + esc(sel.name) + '</h2>' +
      '<div class="sheet__price">' +
        '<div><span class="sheet__pnum">' + esc(peso(sel.price)) + '</span><span class="card__per">/day</span></div>' +
        '<div class="card__wk">' + esc(peso(sel.weekly) + '/wk · ' + peso(sel.monthly) + '/mo') + '</div>' +
      '</div>' +
    '</div>' +
    (sel.desc ? descHTML(sel.desc) : '') +
    '<div class="fld">' +
      '<label class="fld__l">TRAVEL DATES</label>' +
      '<div class="fld__cal">' +
        '<button class="datefield datefield--modal" id="modal-field" type="button">' +
          '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#E4761B" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="8" y1="3" x2="8" y2="6"></line><line x1="16" y1="3" x2="16" y2="6"></line></svg>' +
          '<span class="datefield__label" id="modal-label"></span>' +
        '</button>' +
        '<div class="caldrop caldrop--modal" id="modal-cal" hidden></div>' +
      '</div>' +
    '</div>' +
    (hasZones ?
    '<div class="fld">' +
      '<label class="fld__l">DELIVERY</label>' +
      '<select class="inp" id="m-zone">' +
        '<option value="">Pick up at the shop — free</option>' +
        (S.zones || []).map(z => '<option value="' + esc(z.id) + '"' +
          (String(z.id) === String(S.zoneId) ? ' selected' : '') + '>' +
          esc(z.name + ' — ' + peso(z.price)) + '</option>').join('') +
      '</select>' +
    '</div>' : '') +
    (zone() ?
    '<div class="fld">' +
      '<label class="fld__l">DELIVERY ADDRESS</label>' +
      '<input class="inp" id="m-address" placeholder="Hotel and room number" value="' + esc(S.address) + '">' +
    '</div>' : '') +
    '<div class="fld">' +
      '<label class="fld__l">PHONE</label>' +
      '<input class="inp" id="m-phone" type="tel" placeholder="The number we can reach you on" value="' + esc(S.phone) + '">' +
    '</div>' +
    '<div class="fld">' +
      '<label class="fld__l">ANYTHING WE SHOULD KNOW? <span class="fld__opt">· optional</span></label>' +
      '<textarea class="inp" id="m-note" rows="2" placeholder="Arrival time, an extra helmet, anything else">' + esc(S.note) + '</textarea>' +
    '</div>' +
    '<div class="quote" id="quote"></div>' +
    '<div id="actions"></div>';
}

function descHTML(d) {
  return '' +
    '<div class="desc">' +
      '<p class="desc__p">' + esc(d.overview) + '</p>' +
      (d.pros && d.pros.length ?
        '<div class="desc__sep desc__sep--pro"><span>Pros</span><span class="desc__rule"></span></div>' +
        '<ul class="desc__list">' + d.pros.map(p =>
          '<li><span class="desc__mark desc__mark--pro">+</span><span>' + esc(p) + '</span></li>').join('') + '</ul>' : '') +
      (d.cons && d.cons.length ?
        '<div class="desc__sep desc__sep--con"><span>Cons</span><span class="desc__rule"></span></div>' +
        '<ul class="desc__list">' + d.cons.map(c =>
          '<li><span class="desc__mark desc__mark--con">−</span><span>' + esc(c) + '</span></li>').join('') + '</ul>' : '') +
    '</div>';
}

function doneHTML() {
  const q = quote();
  return '' +
    '<div class="done">' +
      '<div class="done__tick">✓</div>' +
      '<h2 class="done__h2">Booking requested!</h2>' +
      '<p class="done__p">We\'ve noted your <strong>' + esc(S.selected.name) + '</strong> for ' +
        esc(q.days > 0 ? (q.days + (q.days === 1 ? ' day' : ' days')) : 'your dates') +
        '. We\'ll confirm by WhatsApp shortly — nothing to pay until pick-up.</p>' +
      (S.account ? '<p class="done__acct">Booked as ' +
        esc([S.account.name, S.account.email].filter(Boolean).join(' · ')) + '</p>' : '') +
      '<div class="done__total"><span>Estimated total</span><span class="done__num">' + esc(peso(q.total)) + '</span></div>' +
      '<div class="done__btns">' +
        '<button class="btn done__ok" data-close>Done</button>' +
        '<a class="btn done__wa" href="https://wa.me/' + esc(waNumber()) + '" target="_blank" rel="noopener">Message us on WhatsApp</a>' +
      '</div>' +
    '</div>';
}

function wireDone() {
  $$('[data-close]', $('#sheet-body')).forEach(b => b.addEventListener('click', closeModal));
}

function wireForm() {
  const field = $('#modal-field');
  field.addEventListener('click', e => {
    e.stopPropagation();
    S.modalCalOpen = !S.modalCalOpen;
    renderCal('modal');
    field.classList.toggle('is-open', S.modalCalOpen);
  });

  const z = $('#m-zone');
  if (z) z.addEventListener('change', () => {
    S.zoneId = z.value; S.hint = '';
    // The address field appears and disappears with the zone, so this one redraws
    // the form. Nothing typed is lost: every field is written to state on input.
    renderModalBody();
  });

  const addr = $('#m-address');
  if (addr) addr.addEventListener('input', () => { S.address = addr.value; S.hint = ''; updateQuote(); });
  const phone = $('#m-phone');
  if (phone) phone.addEventListener('input', () => { S.phone = phone.value; S.hint = ''; updateQuote(); });
  const note = $('#m-note');
  if (note) note.addEventListener('input', () => { S.note = note.value; });

  renderCal('modal');
  updateModal();
}

// Everything in the modal that changes without the form being rebuilt. Kept apart
// from renderModalBody on purpose: rebuilding the body while somebody is typing
// takes the caret with it.
function updateQuote() {
  const host = $('#quote');
  if (!host) return;
  const q = quote();
  host.innerHTML =
    '<div class="quote__line"><span>' +
      esc(q.days > 0 ? (q.days + (q.days === 1 ? ' day' : ' days')) : 'Select dates') +
      ' × ' + esc(peso(S.selected.price)) + '</span><span class="quote__v">' + esc(peso(q.subtotal)) + '</span></div>' +
    (q.pct > 0 ? '<div class="quote__line quote__line--disc"><span>' +
      esc((q.pct * 100).toFixed(0)) + '% long-stay discount</span><span class="quote__v quote__v--disc">−' +
      esc(peso(q.discount)) + '</span></div>' : '') +
    (q.zone ? '<div class="quote__line"><span>Delivery to ' + esc(q.zone.name) +
      '</span><span class="quote__v">' + esc(peso(q.delivery)) + '</span></div>' : '') +
    '<div class="quote__rule"></div>' +
    '<div class="quote__total"><span>Total</span><span class="quote__num">' + esc(peso(q.total)) + '</span></div>';
}

function updateActions() {
  const host = $('#actions');
  if (!host) return;
  const canBook = days() > 0;
  const busy = S.sending;
  const waNote = {
    nogoogle: 'Sign-in isn’t available on this connection. Send it on WhatsApp instead — the booking is already written out.',
    signin: 'Sign-in didn’t finish. You can send the booking on WhatsApp instead — it is already written out.',
    refused: 'We couldn’t send that just now. WhatsApp reaches the shop directly, with the booking already written out.',
    unavailable: 'That bike was just taken for those dates. Ask on WhatsApp what else is free, or pick other dates.',
  }[S.waReason] || '';

  host.innerHTML =
    // Google's script never arrived, so the button that needs it is not shown at
    // all. Somebody on a network that blocks Google sees one exit, it works, and
    // they never learn there was meant to be another.
    (S.googleFailed ? '' :
      '<button class="req' + ((canBook && !busy) ? '' : ' is-off') + '" id="m-req">' +
      (busy ? 'Sending…' : (canBook ? 'Request booking' : 'Select your dates')) + '</button>') +
    '<button class="wabtn' + (S.googleFailed ? ' wabtn--solo' : '') + '" id="m-wa">' +
      (S.googleFailed ? 'Book on WhatsApp' : 'Book on WhatsApp instead') + '</button>' +
    (S.hint ? '<p class="mhint">' + esc(S.hint) + '</p>' : '') +
    (waNote ? '<p class="wanote">' + esc(waNote) + '</p>' : '') +
    '<p class="fineprint">Nothing to pay now · deposit on pick-up, refunded on return · free cancellation</p>';

  const req = $('#m-req');
  if (req) req.addEventListener('click', requestBooking);
  $('#m-wa').addEventListener('click', openWhatsApp);
}

function updateModal() {
  if (!S.selected) return;
  if (S.step === 'done') { renderModalBody(); return; }
  const label = $('#modal-label');
  if (label) {
    label.textContent = (S.pickup && S.dropoff)
      ? (fmtDate(S.pickup) + ' – ' + fmtDate(S.dropoff))
      : (S.pickup ? (fmtDate(S.pickup) + ' – …') : 'Select your dates');
    label.classList.toggle('is-filled', !!S.pickup);
  }
  updateQuote();
  updateActions();
}

// --- The contact form -------------------------------------------------------
// It used to relabel its own button "Sent — thanks! ✓" and send nothing at all.
// Now it hands the typed text to WhatsApp, the same exit the booking form uses.
// It still cannot promise delivery — once the tab is handed over, this page has
// no idea what happened — so it does not claim to.

function wireContactForm() {
  const btn = $('#dl-send');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const name = $('#dl-name').value.trim();
    const email = $('#dl-email').value.trim();
    const msg = $('#dl-msg').value.trim();
    const hint = $('#dl-hint');
    if (!msg && !name && !email) {
      hint.textContent = 'Write a couple of words first — this opens WhatsApp with your message.';
      hint.hidden = false;
      return;
    }
    hint.hidden = true;
    let text = 'Hi!';
    if (msg) text += ' ' + msg.replace(/([^.!?])$/, '$1.');
    if (name) text += ' — ' + name;
    if (email) text += ' (' + email + ')';
    window.open('https://wa.me/' + waNumber() + '?text=' + encodeURIComponent(text + ' Sent from the website.'),
                '_blank', 'noopener');
  });
}

// --- Wiring the static page -------------------------------------------------

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 68, behavior: 'smooth' });
}

function fillCurrencySelects() {
  const html = Object.keys(CURRENCIES).map(code =>
    '<option value="' + code + '">' + esc(CURRENCIES[code].label) + '</option>').join('');
  ['#cur-hdr', '#cur-filter'].forEach(sel => {
    const el = $(sel);
    if (!el) return;
    el.innerHTML = html;
    el.value = S.currency;
    el.addEventListener('change', () => {
      S.currency = el.value;
      // Both selectors show the same currency, so they move together.
      ['#cur-hdr', '#cur-filter'].forEach(other => { const o = $(other); if (o) o.value = S.currency; });
      renderCatalog();
    });
  });
}

function init() {
  $$('[data-scroll]').forEach(el => el.addEventListener('click', () => {
    scrollToId(el.getAttribute('data-scroll'));
    if (S.mobileMenuOpen) toggleMobileMenu();
  }));
  const top = $('#to-top');
  if (top) top.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  const burger = $('#burger');
  if (burger) burger.addEventListener('click', toggleMobileMenu);
  const scrim = $('#mobnav-scrim');
  if (scrim) scrim.addEventListener('click', toggleMobileMenu);

  const field = $('#avail-field');
  if (field) field.addEventListener('click', e => {
    e.stopPropagation();
    S.calOpen = !S.calOpen;
    renderCal('avail');
    renderAvailBar();
  });
  const only = $('#avail-only');
  if (only) only.addEventListener('change', () => { S.availOnly = only.checked; renderCatalog(); });

  // Clicking anywhere else closes an open calendar, as the old full-screen scrim did.
  document.addEventListener('click', e => {
    if (S.calOpen && !e.target.closest('#avail-wrap')) {
      S.calOpen = false; renderCal('avail'); renderAvailBar();
    }
    if (S.modalCalOpen && !e.target.closest('.fld__cal')) {
      S.modalCalOpen = false; renderCal('modal');
      const mf = $('#modal-field'); if (mf) mf.classList.remove('is-open');
    }
  });

  fillCurrencySelects();
  wireContactForm();
  renderCatalog();
  loadCatalog();
  loadGoogle();
}

function toggleMobileMenu() {
  S.mobileMenuOpen = !S.mobileMenuOpen;
  const nav = $('#mobnav');
  const burger = $('#burger');
  if (nav) nav.hidden = !S.mobileMenuOpen;
  if (burger) burger.setAttribute('aria-expanded', String(S.mobileMenuOpen));
}

document.addEventListener('DOMContentLoaded', init);
