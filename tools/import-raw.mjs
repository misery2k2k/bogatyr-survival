// Разовый импорт готовых спрайтов из скачанных паков (см. ASSETS.md) в raw-assets/.
// Запуск: node tools/import-raw.mjs <папка со скачанными паками>
//
// Нечисть: выбирает кадры, разворачивает лицом вправо, совмещает анимации по ступням, кладёт
// мастер-копии (в MASTER_K раз крупнее итогового атласа) в raw-assets/mobs/<id>/ + meta.json.
// Декор и земля: копирует нужные файлы в raw-assets/decor и raw-assets/ground.
import fs from 'node:fs';
import path from 'node:path';
import { MASTER_K, MOBS, DECOR_SOURCES } from './mobs-manifest.mjs';
import { bbox, blank, blit, downscale, feetOfFigure, flipX, readPng, writePng } from './img.mjs';

const SRC = process.argv[2];
if (!SRC || !fs.existsSync(SRC)) {
  console.error('usage: node tools/import-raw.mjs <папка со скачанными паками>');
  process.exit(1);
}
const only = new Set(process.argv.slice(3));
const root = path.resolve(import.meta.dirname, '..');
const raw = (...p) => path.join(root, 'raw-assets', ...p);

for (const mob of MOBS) {
  if (only.size && !only.has(mob.id)) continue;
  importMob(mob);
}
if (!only.size) importDecor();
console.log('import done');

function pickFrames(a) {
  const dir = path.join(SRC, a.dir);
  const files = fs
    .readdirSync(dir)
    .map((f) => ({ f, m: f.match(a.re) }))
    .filter((x) => x.m)
    .sort((p, q) => Number(p.m[1]) - Number(q.m[1]))
    .map((x) => path.join(dir, x.f));
  if (files.length === 0) throw new Error(`no frames in ${dir} for ${a.re}`);
  const n = Math.min(a.take, files.length);
  // зацикленные — равномерно без повтора последнего кадра; разовые — от первого до последнего
  const idx = Array.from({ length: n }, (_, i) => (a.loop ? Math.floor((i * files.length) / n) : n === 1 ? 0 : Math.round((i * (files.length - 1)) / (n - 1))));
  return idx.map((i) => files[i]);
}

function importMob(mob) {
  const anims = {};
  for (const [name, a] of Object.entries(mob.anims)) {
    anims[name] = pickFrames(a).map((f) => {
      const png = readPng(f);
      return mob.flip ? flipX(png) : png;
    });
  }
  const walk = anims.walk;
  const refBox = bbox(walk[0]);
  const refFeet = feetOfFigure(walk[0], refBox);
  // сдвиг каждой анимации: если холст другого размера — совмещаем ступни первого кадра со ступнями ходьбы
  const offs = {};
  for (const [name, frames] of Object.entries(anims)) {
    const f0 = frames[0];
    if (f0.width === walk[0].width && f0.height === walk[0].height) offs[name] = { x: 0, y: 0 };
    else {
      const b = bbox(f0);
      const ft = feetOfFigure(f0, b);
      offs[name] = { x: Math.round(refFeet.x - ft.x), y: Math.round(refFeet.y - ft.y) };
    }
  }
  // общий холст: объединение всех кадров
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [name, frames] of Object.entries(anims)) {
    for (const f of frames) {
      const b = bbox(f);
      if (!b) continue;
      x0 = Math.min(x0, b.x0 + offs[name].x);
      y0 = Math.min(y0, b.y0 + offs[name].y);
      x1 = Math.max(x1, b.x1 + offs[name].x);
      y1 = Math.max(y1, b.y1 + offs[name].y);
    }
  }
  x0 -= 4;
  y0 -= 4;
  x1 += 4;
  y1 += 4;
  // Холст симметричен относительно ступней: Phaser отражает кадр вокруг его центра,
  // и при повороте влево фигура иначе съезжает со своей точки на земле.
  const half = Math.ceil(Math.max(refFeet.x - x0, x1 - refFeet.x));
  x0 = Math.floor(refFeet.x) - half;
  x1 = Math.floor(refFeet.x) + half;
  const W = x1 - x0 + 1, H = y1 - y0 + 1;
  const k = (mob.figure * MASTER_K) / (refBox.y1 - refBox.y0 + 1);
  const outDir = raw('mobs', mob.id);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const counts = {};
  for (const [name, frames] of Object.entries(anims)) {
    frames.forEach((f, i) => {
      const canvas = blank(W, H);
      blit(canvas, f, offs[name].x - x0, offs[name].y - y0);
      writePng(path.join(outDir, `${name}_${String(i).padStart(2, '0')}.png`), downscale(canvas, Math.min(1, k)));
    });
    counts[name] = frames.length;
  }
  const kk = Math.min(1, k);
  const meta = {
    feet: [+((refFeet.x - x0) * kk).toFixed(1), +((refFeet.y - y0) * kk).toFixed(1)],
    figure: +((refBox.y1 - refBox.y0 + 1) * kk).toFixed(1),
    anims: counts,
  };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 1));
  console.log(`${mob.id}: ${Object.entries(counts).map(([a, n]) => `${a}×${n}`).join(' ')}, master ${Math.round(W * kk)}x${Math.round(H * kk)}${k > 1 ? ' (исходник мельче мастера!)' : ''}`);
}

function importDecor() {
  fs.mkdirSync(raw('decor'), { recursive: true });
  fs.mkdirSync(raw('ground'), { recursive: true });
  for (const [name, rel] of Object.entries(DECOR_SOURCES)) {
    const src = path.join(SRC, rel);
    if (name.startsWith('ground-')) {
      // землю храним в 512 px — крупнее в игре не нужно
      const png = readPng(src);
      writePng(raw('ground', name), png.width > 512 ? downscale(png, 512 / png.width) : png);
    } else {
      fs.copyFileSync(src, raw('decor', name));
    }
  }
  console.log(`decor: ${Object.keys(DECOR_SOURCES).length} files`);
}
