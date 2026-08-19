// Refreshes the offline copy of the catalog: catalog.json and the pictures it
// points at. Run by .github/workflows/refresh-fallback.yml once a day, and by
// hand with `node tools/refresh-fallback.mjs` when something needs pushing
// through immediately.
//
// What this file is for: the page fetches the live catalog from Odoo on every
// load, so nothing here affects what a visitor normally sees. This only keeps
// the copy that gets shown when Odoo is unreachable — and that copy is worth
// nothing if it is a year old.
//
// Run it with:
//   CATALOG_API_URL=https://api.cebuscooterrental.com/qa/catalog \
//   CATALOG_API_KEY=... node tools/refresh-fallback.mjs
//
// Exit codes: 0 means "nothing to do" as well as "updated" — a refusal to write
// is a normal outcome here, not a failure. Only a bug in this script exits 1.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_JSON = join(ROOT, 'catalog.json');
// Deliberately its own folder. The hand-curated images/bike-<slug>.<ext> are the
// last-resort layer, tied by name and extension to the BIKE_IMG table compiled
// into app.js; writing over them from here would eventually rename one and cost
// a card its picture with no error anywhere.
const OUT_IMG_DIR = join(ROOT, 'images', 'catalog');
const OUT_IMG_REL = 'images/catalog';

const API_URL = process.env.CATALOG_API_URL || 'http://localhost:8069/qa/catalog';
const API_KEY = process.env.CATALOG_API_KEY || '';
const MAX_PHOTOS_PER_MODEL = 4;

function log(...a) { console.log('[refresh-fallback]', ...a); }

// Bail out rather than write. Every early return in this script goes through
// here, because "the endpoint was unreachable" and "the endpoint said nothing"
// must never end with an empty catalog.json overwriting a good one — that would
// destroy the emergency copy at exactly the moment it is needed.
function refuse(why) {
  log('not writing:', why);
  process.exit(0);
}

async function fetchCatalog() {
  const url = API_URL + '?key=' + encodeURIComponent(API_KEY);
  let res;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (err) {
    refuse('endpoint unreachable — ' + err.message);
  }
  if (!res.ok) refuse('endpoint answered HTTP ' + res.status);
  let data;
  try {
    data = await res.json();
  } catch (err) {
    refuse('endpoint did not answer JSON — ' + err.message);
  }
  // A wrong key answers {"models": []} with HTTP 200, so an empty list is the
  // shape a failure takes here, not an unusual success.
  if (!data || !Array.isArray(data.models) || data.models.length === 0) {
    refuse('endpoint returned no models (wrong key, or an empty database)');
  }
  return data;
}

function extFor(contentType, url) {
  const ct = (contentType || '').split(';')[0].trim().toLowerCase();
  if (ct === 'image/png') return '.png';
  if (ct === 'image/webp') return '.webp';
  if (ct === 'image/jpeg') return '.jpg';
  if (ct === 'image/gif') return '.gif';
  const m = /\.(png|webp|jpe?g|gif)(?:$|\?)/i.exec(url || '');
  return m ? '.' + m[1].toLowerCase().replace('jpeg', 'jpg') : '.jpg';
}

async function grabPhoto(url, slug, index) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    log('photo unreachable, leaving it out:', slug, index, err.message);
    return null;
  }
  if (!res.ok) { log('photo answered HTTP ' + res.status + ', leaving it out:', slug, index); return null; }
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) { log('photo was empty, leaving it out:', slug, index); return null; }

  const name = 'bike-' + slug + '-' + (index + 1) + extFor(res.headers.get('content-type'), url);
  const path = join(OUT_IMG_DIR, name);

  // Written only when the bytes actually differ. Without this every run commits
  // ten binaries, and a git history carries them for ever.
  if (existsSync(path)) {
    const old = await readFile(path);
    if (createHash('sha256').update(old).digest('hex') ===
        createHash('sha256').update(buf).digest('hex')) {
      return { rel: OUT_IMG_REL + '/' + name, changed: false };
    }
  }
  await writeFile(path, buf);
  return { rel: OUT_IMG_REL + '/' + name, changed: true };
}

async function main() {
  const data = await fetchCatalog();
  log('endpoint answered with ' + data.models.length + ' models');

  await mkdir(OUT_IMG_DIR, { recursive: true });
  const keep = new Set();
  let photosChanged = 0;

  const models = [];
  for (const m of data.models) {
    const slug = String(m.id || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!slug) { log('a model has no usable id, leaving it out:', m.name); continue; }

    const photos = [];
    for (const [i, url] of (m.photos || []).slice(0, MAX_PHOTOS_PER_MODEL).entries()) {
      const got = await grabPhoto(url, slug, i);
      if (!got) continue;
      photos.push(got.rel);
      keep.add(got.rel.split('/').pop());
      if (got.changed) photosChanged++;
    }

    // `units` is dropped on purpose, twice over. The offline copy deliberately
    // shows no availability — yesterday's "free" is worse than no answer — and
    // this repository is public, so per-bike booking ranges have no business
    // being committed to it.
    // `card_photo` is dropped and rebuilt, not copied: the endpoint sends an
    // absolute Odoo URL, and this copy is shown exactly when Odoo cannot be
    // reached — a card would be left pointing at a picture nobody can fetch.
    const { units, card_photo, ...rest } = m;
    const card = { ...rest, photos };
    if (photos.length) card.card_photo = photos[0];
    models.push(card);
  }

  if (!models.length) refuse('every model was dropped while processing');

  // Sweep pictures belonging to cards that no longer exist. Without it a renamed
  // or deleted model leaves its photo behind for ever.
  for (const f of await readdir(OUT_IMG_DIR)) {
    if (!keep.has(f)) { await unlink(join(OUT_IMG_DIR, f)); log('removed a stale photo:', f); }
  }

  const payload = {
    // Not from the endpoint: this is when the copy was taken, which is the one
    // thing a stale-copy question actually turns on.
    refreshed_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    currency: data.currency,
    categories: data.categories,
    discounts: data.discounts,
    delivery_zones: data.delivery_zones,
    whatsapp: data.whatsapp,
    // The offered currencies and the day their rates were quoted. Copied,
    // unlike `direct_booking`: a converted price still works with Odoo down,
    // and this copy is refreshed daily, which is exactly how often the rates
    // move. `rates_date` travels with them so nothing here is dateless — the
    // hand-typed table this replaced had no date, which is how it managed to
    // be wrong for a year without anybody noticing.
    currencies: data.currencies,
    rates_date: data.rates_date,
    // `direct_booking` is deliberately NOT copied, same reasoning as `units`
    // above: this copy is shown exactly when Odoo is unreachable, and then a
    // booking cannot land anyway — the page must offer WhatsApp alone.
    models,
  };

  const text = JSON.stringify(payload, null, 2) + '\n';
  let before = null;
  try { before = await readFile(OUT_JSON, 'utf8'); } catch { /* first run */ }

  // Compare everything except the timestamp, or the file changes every single
  // day whether or not the shop did anything.
  const strip = s => s.replace(/^\s*"refreshed_at":.*$/m, '');
  if (before !== null && strip(before) === strip(text) && photosChanged === 0) {
    log('nothing changed since the last run');
    return;
  }

  await writeFile(OUT_JSON, text);
  log('wrote catalog.json (' + models.length + ' models, ' + photosChanged + ' photos updated)');
}

main().catch(err => { console.error('[refresh-fallback] failed:', err); process.exit(1); });
