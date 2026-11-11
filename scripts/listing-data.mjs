// Prints, as JSON, the values the plugin writes for the listing images (scripts/render_assets.py):
// the first rows of the default "Guns and ammo" and "Calibers" collections, and canvas texts.
// It loads the plugin's own TypeScript modules through Vite, so the images show exactly what the plugin syncs.
import { createServer } from 'vite';

const server = await createServer({ configFile: false, appType: 'custom', server: { middlewareMode: true }, logLevel: 'error' });
try {
  const c = await server.ssrLoadModule('/src/core/collection.ts');
  const t = await server.ssrLoadModule('/src/core/ammo-text.ts');
  const cat = await server.ssrLoadModule('/src/core/catalog.ts');
  const value = (item, id) => item.fieldData[id]?.value ?? '';
  const products = c.buildItems(c.defaultConfig('products')).slice(0, 8).map((item) => ({
    title: value(item, 'title'),
    caliber: value(item, 'caliber'),
    category: value(item, 'category'),
    priceText: value(item, 'priceText'),
    costPerRoundText: value(item, 'costPerRoundText'),
  }));
  const calibers = c.buildItems(c.defaultConfig('calibers')).slice(0, 8).map((item) => ({
    name: value(item, 'name'),
    type: value(item, 'type'),
    aliases: value(item, 'aliases'),
    slug: item.slug,
  }));
  const box = t.searchAmmo('')[0];
  const canvas = { title: box.title, texts: t.TEXT_FORMATS.map((f) => t.ammoText(box, f.id)) };
  const counts = {
    guns: cat.GUNS.length,
    ammo: cat.AMMO.length,
    calibers: cat.CALIBERS.length,
    snapshot: cat.SNAPSHOT,
  };
  const defaults = Object.fromEntries(
    ['products', 'calibers'].map((id) => {
      const config = c.defaultConfig(id);
      return [id, { items: c.buildItems(config).length, fields: c.buildFields(config).length }];
    }),
  );
  process.stdout.write(JSON.stringify({ products, calibers, canvas, counts, defaults }, null, 1) + '\n');
} finally {
  await server.close();
}
