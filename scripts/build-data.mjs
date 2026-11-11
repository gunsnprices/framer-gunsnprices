// Builds src/data/catalog.json, the offline data the plugin ships with.
//
//   node scripts/build-data.mjs [--figma FILE] [--calibers FILE] [--models FILE]
//
// --figma     catalog.json of the GunsNPrices Figma plugin (figma-gunsnprices/src/data/catalog.json):
//             firearm models with title, capacity, barrel and prices, and in-stock ammo boxes. See that
//             plugin's README for how those rows were made.
// --calibers  calibers.csv of the firearm-calibers dataset: id, name, type, retailer spellings, listing counts
//             and the GunsNPrices ammo price page of each caliber.
// --models    models.csv of the firearm-models dataset: the GunsNPrices price page of each model, model family
//             or brand.
//
// Item IDs are stable keys for CMS sync: the dataset id for calibers, "g-<model>" for guns and "a-<title>" for ammo
// boxes (a suffix is added when two rows would share one). Price page URLs are stored as paths on gunsnprices.com.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? path.resolve(process.argv[i + 1]) : dflt;
};
const FIGMA = arg('--figma', path.resolve(root, '../figma-gunsnprices/src/data/catalog.json'));
const CALIBERS = arg('--calibers', path.resolve(root, '../datasets/firearm-calibers/calibers.csv'));
const MODELS = arg('--models', path.resolve(root, '../datasets/firearm-models/models.csv'));
const OUT = path.join(root, 'src/data/catalog.json');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const [hdr, ...body] = rows;
  return body.filter((r) => r.length === hdr.length).map((r) => Object.fromEntries(hdr.map((h, i) => [h, r[i]])));
}

function objects(table) {
  return table.rows.map((r) => Object.fromEntries(table.fields.map((f, i) => [f, r[i]])));
}

/** same rules as src/core/slug.ts */
function slugify(s) {
  return s
    .normalize('NFKD')
    .replace(/×/g, 'x')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(\w)&(\w)/g, '$1$2')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function uniqueIds(keys) {
  const seen = new Map();
  return keys.map((k) => {
    const n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    return n === 1 ? k : `${k}-${n}`;
  });
}

const figma = JSON.parse(fs.readFileSync(FIGMA, 'utf8'));
const caliberRows = parseCsv(fs.readFileSync(CALIBERS, 'utf8'));
const modelRows = parseCsv(fs.readFileSync(MODELS, 'utf8'));

// ---------- calibers ----------
const calibers = caliberRows
  .map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    aliases: r.aliases ? r.aliases.split(' | ').map((a) => a.trim()).filter(Boolean) : [],
    listings: Number(r.products_guns) + Number(r.products_ammo),
    url: r.ammo_url || r.guns_url || '',
  }))
  .sort((a, b) => b.listings - a.listings || a.name.localeCompare(b.name));
const caliberByName = new Map(calibers.map((c) => [c.name, c]));

// ---------- guns ----------
const pageByModel = new Map();
for (const m of modelRows) {
  const url = m.model_url || m.family_url || m.brand_hub_url || '';
  for (const key of [`${m.brand}|${m.family}|${m.model}`, `${m.brand}|${m.model}`]) {
    if (!pageByModel.has(key)) pageByModel.set(key, url);
  }
}
const gunsIn = objects(figma.guns);
const gunIds = uniqueIds(gunsIn.map((g) => 'g-' + slugify(g.model)));
const guns = gunsIn.map((g, i) => {
  const url = pageByModel.get(`${g.brand}|${g.family}|${g.model}`) ?? pageByModel.get(`${g.brand}|${g.model}`) ?? '';
  if (!caliberByName.has(g.caliber)) throw new Error(`unknown caliber ${g.caliber}`);
  return [gunIds[i], g.brand, g.model, g.type, g.caliber, g.title, g.capacity, g.barrel, g.priceMin, g.priceMedian, url];
});

// ---------- ammo ----------
const ammoIn = objects(figma.ammo);
const ammoIds = uniqueIds(ammoIn.map((a) => 'a-' + slugify(a.title).slice(0, 60).replace(/-+$/, '')));
const ammo = ammoIn.map((a, i) => {
  if (!caliberByName.has(a.caliber)) throw new Error(`unknown caliber ${a.caliber}`);
  return [ammoIds[i], a.title, a.brand, a.caliber, a.caliberType, a.rounds, a.price];
});

const SITE = 'https://gunsnprices.com';
function sitePath(url) {
  if (!url) return '';
  if (!url.startsWith(SITE + '/')) throw new Error(`not a ${SITE} URL: ${url}`);
  return url.slice(SITE.length);
}
for (const g of guns) g[10] = sitePath(g[10]);
for (const c of calibers) c.url = sitePath(c.url);
const allIds = [...guns.map((g) => g[0]), ...ammo.map((a) => a[0])];
if (new Set(allIds).size !== allIds.length) throw new Error('duplicate item ids');
if (new Set(calibers.map((c) => c.id)).size !== calibers.length) throw new Error('duplicate caliber ids');

const out = {
  version: 1,
  snapshot: figma.snapshot,
  attribution: figma.attribution,
  guns: {
    fields: ['id', 'brand', 'model', 'type', 'caliber', 'title', 'capacity', 'barrel', 'priceMin', 'priceMedian', 'url'],
    rows: guns,
  },
  ammo: {
    fields: ['id', 'title', 'brand', 'caliber', 'caliberType', 'rounds', 'price'],
    rows: ammo,
  },
  calibers: {
    fields: ['id', 'name', 'type', 'aliases', 'listings', 'url'],
    rows: calibers.map((c) => [c.id, c.name, c.type, c.aliases, c.listings, c.url]),
  },
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out) + '\n');
const noUrl = guns.filter((g) => !g[10]).length;
console.log(
  `wrote ${path.relative(root, OUT)}: ${guns.length} guns (${noUrl} without a price page), ${ammo.length} ammo boxes, ` +
    `${calibers.length} calibers (${calibers.filter((c) => c.url).length} with a price page), snapshot ${figma.snapshot}`,
);
