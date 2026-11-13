// Сборка готовых спрайтов глав: атласы нечисти и боссов, декор, земля.
// Источники — raw-assets/mobs (мастер-копии, см. tools/import-raw.mjs), raw-assets/decor, raw-assets/ground.
// Пишет public/assets/{mobs,decor,ground} и src/gen/assets.ts (точки опоры, кадры, масштабы).
import fs from 'node:fs';
import path from 'node:path';
import { DECOR, MOBS } from './mobs-manifest.mjs';
import { bbox, blank, crop, downscale, grade, outline, packPages, readPng, recolor, writePng } from './img.mjs';

export function buildMobs(root) {
  const raw = (...p) => path.join(root, 'raw-assets', ...p);
  const out = (...p) => path.join(root, 'public', 'assets', ...p);
  const gen = { atlases: {}, mobs: {}, decor: {} };

  // ---------------- нечисть ----------------
  fs.rmSync(out('mobs'), { recursive: true, force: true });
  fs.mkdirSync(out('mobs'), { recursive: true });
  const byAtlas = new Map();
  for (const mob of MOBS) {
    const dir = raw('mobs', mob.id);
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    // в атлас не крупнее мастера (увеличивать картинку смысла нет — это сделает видеокарта)
    const k = Math.min(1, mob.figure / meta.figure);
    const ol = mob.outline ? Math.max(1.4, 2.2 * (mob.figure / 150)) : 0;
    const frames = [];
    let srcW = 0, srcH = 0, pad = 0;
    for (const [anim, n] of Object.entries(meta.anims)) {
      for (let i = 0; i < n; i++) {
        let png = readPng(path.join(dir, `${anim}_${String(i).padStart(2, '0')}.png`));
        png = k < 1 ? downscale(png, k) : png;
        if (mob.recolor) recolor(png, mob.recolor);
        if (ol > 0) ({ png, pad } = outline(png, ol));
        srcW = png.width;
        srcH = png.height;
        const b = bbox(png, 2);
        if (!b) continue;
        frames.push({ name: `${mob.id}-${anim}${i}`, png, box: b, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 });
      }
    }
    for (const f of frames) {
      f.srcW = srcW;
      f.srcH = srcH;
    }
    const fx = meta.feet[0] * k + pad, fy = meta.feet[1] * k + pad;
    gen.mobs[mob.id] = {
      atlas: mob.atlas,
      figure: Math.round(meta.figure * k),
      origin: [+(fx / srcW).toFixed(4), +(fy / srcH).toFixed(4)],
      anims: meta.anims,
    };
    if (!byAtlas.has(mob.atlas)) byAtlas.set(mob.atlas, []);
    byAtlas.get(mob.atlas).push(...frames);
  }
  for (const [key, frames] of byAtlas) {
    const pages = packPages(frames, 2, 2048);
    const json = { textures: [] };
    let bytes = 0;
    pages.forEach((pg, pi) => {
      const img = blank(pg.w, pg.h);
      const list = [];
      for (const f of frames.filter((x) => x.page === pi)) {
        for (let y = 0; y < f.h; y++) {
          const si = ((f.box.y0 + y) * f.png.width + f.box.x0) * 4;
          f.png.data.copy(img.data, ((f.ay + y) * pg.w + f.ax) * 4, si, si + f.w * 4);
        }
        list.push({
          filename: f.name,
          rotated: false,
          trimmed: true,
          sourceSize: { w: f.srcW, h: f.srcH },
          spriteSourceSize: { x: f.box.x0, y: f.box.y0, w: f.w, h: f.h },
          frame: { x: f.ax, y: f.ay, w: f.w, h: f.h },
        });
      }
      const file = `${key}-${pi}.png`;
      writePng(out('mobs', file), img);
      bytes += fs.statSync(out('mobs', file)).size;
      json.textures.push({ image: file, format: 'RGBA8888', size: { w: pg.w, h: pg.h }, scale: 1, frames: list });
    });
    fs.writeFileSync(out('mobs', `${key}.json`), JSON.stringify(json));
    gen.atlases[key] = { pages: pages.map((p) => `${p.w}x${p.h}`), kb: Math.round(bytes / 1024) };
    console.log(`${key}: ${frames.length} frames, pages ${pages.map((p) => `${p.w}x${p.h}`).join(' + ')}, ${Math.round(bytes / 1024)} KB`);
  }

  // ---------------- декор ----------------
  // Высота в атласе — до 2 px на мировой пиксель (как у процедурного декора), но не крупнее исходника.
  const items = [];
  const addDecor = (key, png, h) => {
    const b = bbox(png, 4);
    let p = crop(png, b.x0, b.y0, b.x1 - b.x0 + 1, b.y1 - b.y0 + 1);
    const res = Math.min(2, p.height / h);
    const k = (h * res) / p.height;
    if (k < 0.999) p = downscale(p, k);
    items.push({ key, png: p, w: p.width, h: p.height, res: +(p.height / h).toFixed(3) });
  };
  const frost = (png) => {
    // иней: всё бледнеет и синеет, светлые места почти белые
    const d = png.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
      const t = 0.45 + l * 0.35;
      d[i] = Math.round(d[i] * (1 - t) + 214 * t);
      d[i + 1] = Math.round(d[i + 1] * (1 - t) + 230 * t);
      d[i + 2] = Math.round(d[i + 2] * (1 - t) + 250 * t);
    }
    return png;
  };
  for (const [key, def] of Object.entries(DECOR)) addDecor(key, readPng(raw('decor', def.src)), def.h);
  // морозные двойники деревьев, кустов и камней
  for (const [key, src] of [['f-tree', 'c-tree'], ['f-tree2', 's-tree3'], ['f-ctree', 's-ctree'], ['f-bramble', 's-bramble'], ['f-rock', 's-rock2'], ['f-bush', 'c-deadbush'], ['f-bones', 'c-bones']]) {
    addDecor(key, frost(readPng(raw('decor', DECOR[src].src))), DECOR[src].h);
  }
  // лавовые лужи Пекла — вырезаны из бесшовной текстуры «Lava Stones» (Althaj, CC-BY 3.0)
  const lava = readPng(raw('ground', 'ground-lavastones.png'));
  items.push(lavaPool('h-lava', lava, 260, 150, 11), lavaPool('h-lava2', lava, 190, 120, 23));
  const pages = packPages(items, 2, 2048);
  if (pages.length > 1) throw new Error('decor atlas does not fit one page');
  const img = blank(pages[0].w, pages[0].h);
  const json = { frames: {}, meta: { image: 'decor.png', size: { w: pages[0].w, h: pages[0].h }, scale: '1' } };
  for (const it of items) {
    for (let y = 0; y < it.h; y++) it.png.data.copy(img.data, ((it.ay + y) * pages[0].w + it.ax) * 4, y * it.w * 4, (y + 1) * it.w * 4);
    json.frames[it.key] = { frame: { x: it.ax, y: it.ay, w: it.w, h: it.h }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w: it.w, h: it.h }, sourceSize: { w: it.w, h: it.h } };
    gen.decor[it.key] = it.res;
  }
  fs.rmSync(out('decor'), { recursive: true, force: true });
  fs.mkdirSync(out('decor'), { recursive: true });
  writePng(out('decor', 'decor.png'), img);
  fs.writeFileSync(out('decor', 'decor.json'), JSON.stringify(json));
  console.log(`decor: ${items.length} items, ${pages[0].w}x${pages[0].h}, ${Math.round(fs.statSync(out('decor', 'decor.png')).size / 1024)} KB`);

  // ---------------- земля ----------------
  fs.rmSync(out('ground'), { recursive: true, force: true });
  fs.mkdirSync(out('ground'), { recursive: true });
  const ground = (name, src, opts) => writePng(out('ground', `${name}.png`), grade(readPng(raw('ground', src)), opts));
  ground('cursed', 'ground-grass.png', { sat: 0.3, mul: [0.78, 0.6, 0.98], gain: 0.74 });
  ground('scorched', 'ground-dirt.png', { sat: 0.45, mul: [0.8, 0.72, 0.64], gain: 0.62 });
  ground('frozen', 'ground-stone.png', { sat: 0.25, mul: [0.88, 0.96, 1.1], gain: 0.97 });
  ground('hell', 'ground-volcano.png', { sat: 1.1, mul: [1.25, 1, 0.95], gain: 1.55 });
  ground('hell2', 'ground-volcano.png', { sat: 0.9, mul: [1.15, 0.85, 1.1], gain: 1.7 });
  console.log('ground: 5 textures');

  // ---------------- описание для игры ----------------
  fs.mkdirSync(path.join(root, 'src', 'gen'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src', 'gen', 'assets.ts'),
    `// Сгенерировано tools/build-mobs.mjs — не править руками.\n\n` +
      `/** Атласы нечисти: страницы (для справки) и вес. */\n` +
      `export const MOB_ATLASES: Record<string, { pages: string[]; kb: number }> = ${JSON.stringify(gen.atlases, null, 1)};\n\n` +
      `/** Нечисть на готовых спрайтах: атлас, рост фигуры в атласе (px), точка опоры, число кадров анимаций. */\n` +
      `export const MOB_SPRITES: Record<string, { atlas: string; figure: number; origin: [number, number]; anims: Record<string, number> }> = ${JSON.stringify(gen.mobs, null, 1)};\n\n` +
      `/** Декор глав (кадры атласа 'decor'): пикселей атласа на мировой пиксель. */\n` +
      `export const DECOR_RES: Record<string, number> = ${JSON.stringify(gen.decor, null, 1)};\n`,
  );
}

/** Лавовая лужа: неровный эллипс из лавовой текстуры с тёмной обугленной каймой. */
function lavaPool(key, tex, w, h, seed) {
  const png = blank(w, h);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const bumps = Array.from({ length: 7 }, () => [rnd() * Math.PI * 2, 0.05 + rnd() * 0.08, 2 + Math.floor(rnd() * 4)]);
  const ox = Math.floor(rnd() * tex.width), oy = Math.floor(rnd() * tex.height);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - w / 2) / (w / 2), ny = (y - h / 2) / (h / 2);
      const a = Math.atan2(ny, nx);
      let r = 0.86;
      for (const [ph, amp, f] of bumps) r += Math.sin(a * f + ph) * amp * 0.5;
      const d = Math.hypot(nx, ny) / r;
      if (d > 1) continue;
      const o = (y * w + x) * 4;
      const ti = (((oy + y) % tex.height) * tex.width + ((ox + x) % tex.width)) * 4;
      let cr = tex.data[ti], cg = tex.data[ti + 1], cb = tex.data[ti + 2];
      // кайма: к краю темнеет до окалины
      const rim = Math.min(1, Math.max(0, (d - 0.72) / 0.22));
      cr = cr * (1 - rim) + 40 * rim;
      cg = cg * (1 - rim) + 22 * rim;
      cb = cb * (1 - rim) + 18 * rim;
      png.data[o] = Math.round(cr);
      png.data[o + 1] = Math.round(cg);
      png.data[o + 2] = Math.round(cb);
      png.data[o + 3] = Math.round(255 * Math.min(1, (1 - d) / 0.06));
    }
  }
  return { key, png, w, h, res: 1 };
}
