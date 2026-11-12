// Готовит ассеты из raw-assets/ → public/assets/.
// Запуск: npm run assets
// Зомби: GameArt2D «The Zombie» (CC0) — перекрашиваем одежду под Русь и пакуем в атлас.
// Богатырь — векторный (public/assets/hero/*.svg), здесь не обрабатывается.
import { PNG } from 'pngjs';
import fs from 'node:fs';
import path from 'node:path';
import * as zr from './zombie-recolor.mjs';

const root = path.resolve(import.meta.dirname, '..');
const raw = (...p) => path.join(root, 'raw-assets', ...p);
const out = (...p) => path.join(root, 'public', 'assets', ...p);

// Старые спрайты Kenney больше не используются
for (const f of ['bogatyr.png', 'bogatyr.xml', 'zombie.png', 'zombie.xml']) fs.rmSync(out('sprites', f), { force: true });

// --- Зомби: GameArt2D «The Zombie» (CC0) → перекраска + атлас ---
buildZombieAtlas();

// --- Эффекты (копируем только используемые в игре — см. FX в src/scenes/BootScene.ts) ---
const USED_FX = ['slash_03', 'star_04', 'smoke_04', 'light_01', 'twirl_02', 'scorch_02', 'circle_05'];
fs.rmSync(out('fx'), { recursive: true, force: true });
fs.mkdirSync(out('fx'), { recursive: true });
for (const f of USED_FX) fs.copyFileSync(raw('particles', `${f}.png`), out('fx', `${f}.png`));

// --- Звуки ---
// Мягкие WAV из raw-assets/sfx-soft (их делает tools/make-soft-sfx.mjs) + несколько исходных OGG без обработки.
// Список должен совпадать с AUDIO в src/scenes/BootScene.ts.
const KEEP_OGG = { audio: ['click_002', 'footstep09'], sfx: ['slam_02', 'plop_01', 'explosion'] };
fs.rmSync(out('audio'), { recursive: true, force: true });
fs.mkdirSync(out('audio'), { recursive: true });
for (const [dir, list] of Object.entries(KEEP_OGG)) {
  for (const f of list) fs.copyFileSync(raw(dir, `${f}.ogg`), out('audio', `${f}.ogg`));
}
for (const f of fs.readdirSync(raw('sfx-soft'))) if (f.endsWith('.wav')) fs.copyFileSync(raw('sfx-soft', f), out('audio', f));

// --- Музыка: mp3 + список треков (грузится лениво, по выбору в настройках) ---
fs.rmSync(out('music'), { recursive: true, force: true });
fs.mkdirSync(out('music'), { recursive: true });
const tracks = JSON.parse(fs.readFileSync(raw('music', 'tracks.json'), 'utf8'));
for (const t of tracks) fs.copyFileSync(raw('music', `${t.id}.mp3`), out('music', `${t.id}.mp3`));
fs.writeFileSync(out('music', 'tracks.json'), JSON.stringify(tracks.map(({ id, title, author, license }) => ({ id, title, author, license }))));

console.log('assets ready');

// =====================================================================
// Атлас зомби
// =====================================================================

function buildZombieAtlas() {
  /** Во сколько раз уменьшаем исходники (персонаж ~480 px → ~165 px). */
  const SCALE = 0.34;
  const ANIMS = [
    ['walk', 'Walk', 10],
    ['attack', 'Attack', 8],
    ['dead', 'Dead', 12],
  ];
  const VARIANTS = [
    ['m', 'male', zr.male],
    ['f', 'female', zr.female],
  ];

  const frames = [];
  const origins = {};
  for (const [vk, dir, rule] of VARIANTS) {
    const load = (anim, i) => PNG.sync.read(fs.readFileSync(raw('zombies', dir, `${anim} (${i}).png`)));
    // Опорный кадр — первый шаг: по нему ставим «землю» и точку между ступнями.
    const ref = load('Walk', 1);
    const refBox = bbox(ref);
    const refFeet = feetPoint(ref, refBox);
    // Кадры смерти лежат на холсте другого размера — совмещаем по ступням первого кадра.
    const dead1 = load('Dead', 1);
    const deadFeet = feetPoint(dead1, bbox(dead1));
    const deadOff = { x: refFeet.x - deadFeet.x, y: refFeet.y - deadFeet.y };
    const footLine = refFeet.y - (refBox.y1 - refBox.y0) * 0.23;

    const vFrames = [];
    for (const [ak, file, count] of ANIMS) {
      for (let i = 1; i <= count; i++) {
        const png = load(file, i);
        const off = ak === 'dead' ? deadOff : { x: 0, y: 0 };
        // Обувь: нижняя полоса у земли и рядом с исходным местом ступней (зомби падает вперёд, голова уходит вправо)
        const footMaxX = refFeet.x + (refBox.x1 - refBox.x0) * (ak === 'dead' ? 0.12 : 1);
        recolorPng(png, (x, y) => y + off.y > footLine && x + off.x < footMaxX, rule);
        const small = downscale(png, SCALE);
        const b = bbox(small);
        if (!b) continue;
        vFrames.push({
          name: `${vk}-${ak}${i - 1}`,
          png: small,
          box: b,
          // позиция кадра в общей системе координат (в уменьшенных пикселях)
          ox: off.x * SCALE,
          oy: off.y * SCALE,
        });
      }
    }
    // Общий «исходный» прямоугольник: ступни ровно по центру по X
    const fx = refFeet.x * SCALE, fy = refFeet.y * SCALE;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const f of vFrames) {
      minX = Math.min(minX, f.ox + f.box.x0);
      maxX = Math.max(maxX, f.ox + f.box.x1 + 1);
      minY = Math.min(minY, f.oy + f.box.y0);
      maxY = Math.max(maxY, f.oy + f.box.y1 + 1);
    }
    const half = Math.ceil(Math.max(fx - minX, maxX - fx)) + 1;
    const top = Math.floor(minY) - 1;
    const srcW = half * 2, srcH = Math.ceil(maxY) + 1 - top;
    const left = Math.round(fx) - half;
    for (const f of vFrames) {
      f.sx = Math.round(f.ox + f.box.x0 - left);
      f.sy = Math.round(f.oy + f.box.y0 - top);
      f.srcW = srcW;
      f.srcH = srcH;
      frames.push(f);
    }
    origins[vk] = [0.5, +((fy - top) / srcH).toFixed(4)];
  }

  // Упаковка полками в текстуру со сторонами-степенями двойки (чтобы работали мипмапы)
  frames.sort((a, b) => b.box.y1 - b.box.y0 - (a.box.y1 - a.box.y0));
  const PAD = 2;
  let atlasW = 1024, atlasH = 1024, placed = null;
  for (const [w, h] of [[1024, 1024], [2048, 1024], [2048, 2048]]) {
    placed = shelfPack(frames, w, h, PAD);
    if (placed) {
      atlasW = w;
      atlasH = h;
      break;
    }
  }
  if (!placed) throw new Error('zombie atlas does not fit 2048x2048');

  const atlas = new PNG({ width: atlasW, height: atlasH });
  atlas.data.fill(0);
  const json = { frames: {}, meta: { image: 'zombies.png', size: { w: atlasW, h: atlasH }, scale: '1', origins } };
  for (const f of frames) {
    const w = f.box.x1 - f.box.x0 + 1, h = f.box.y1 - f.box.y0 + 1;
    for (let y = 0; y < h; y++) {
      const si = ((f.box.y0 + y) * f.png.width + f.box.x0) * 4;
      const di = ((f.ay + y) * atlasW + f.ax) * 4;
      f.png.data.copy(atlas.data, di, si, si + w * 4);
    }
    json.frames[f.name] = {
      frame: { x: f.ax, y: f.ay, w, h },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: f.sx, y: f.sy, w, h },
      sourceSize: { w: f.srcW, h: f.srcH },
    };
  }
  fs.mkdirSync(out('sprites'), { recursive: true });
  fs.writeFileSync(out('sprites', 'zombies.png'), PNG.sync.write(atlas, { deflateLevel: 9 }));
  fs.writeFileSync(out('sprites', 'zombies.json'), JSON.stringify(json));
  console.log(`zombies atlas ${atlasW}x${atlasH}, ${frames.length} frames, origins`, origins);
}

function bbox(png) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  const { width: W, height: H, data: d } = png;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Середина ступней: центр непрозрачных пикселей в нижних 12 px силуэта. */
function feetPoint(png, b) {
  let sx = 0, n = 0;
  for (let y = b.y1 - 12; y <= b.y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] > 128) {
        sx += x;
        n++;
      }
    }
  }
  return { x: n ? sx / n : (b.x0 + b.x1) / 2, y: b.y1 };
}

function recolorPng(png, isFoot, rule) {
  const { width: W, data: d } = png;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const p = i / 4;
    const [h, s, v] = zr.rgbToHsv(d[i], d[i + 1], d[i + 2]);
    const res = rule(h, s, v, isFoot(p % W, Math.floor(p / W)));
    if (res) [d[i], d[i + 1], d[i + 2]] = zr.hsvToRgb(res[0], res[1], res[2]);
  }
}

/** Уменьшение с усреднением по площади (в premultiplied alpha, без тёмных ореолов). */
function downscale(src, k) {
  const W = Math.max(1, Math.round(src.width * k)), H = Math.max(1, Math.round(src.height * k));
  const sx = src.width / W, sy = src.height / H;
  const spans = (n, step, max) =>
    Array.from({ length: n }, (_, i) => {
      const a = i * step, b = Math.min(max, (i + 1) * step);
      const out = [];
      for (let p = Math.floor(a); p < Math.ceil(b); p++) {
        const w = Math.min(b, p + 1) - Math.max(a, p);
        if (w > 0) out.push([p, w]);
      }
      return out;
    });
  const xs = spans(W, sx, src.width), ys = spans(H, sy, src.height);
  const dst = new PNG({ width: W, height: H });
  const s = src.data;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (const [py, wy] of ys[y]) {
        for (const [px, wx] of xs[x]) {
          const w = wx * wy, i = (py * src.width + px) * 4, al = s[i + 3] * w;
          r += s[i] * al;
          g += s[i + 1] * al;
          b += s[i + 2] * al;
          a += al;
          wsum += w;
        }
      }
      const o = (y * W + x) * 4;
      if (a > 0) {
        dst.data[o] = Math.round(r / a);
        dst.data[o + 1] = Math.round(g / a);
        dst.data[o + 2] = Math.round(b / a);
      }
      dst.data[o + 3] = Math.round(a / wsum);
    }
  }
  return dst;
}

function shelfPack(frames, W, H, pad) {
  let x = pad, y = pad, rowH = 0;
  for (const f of frames) {
    const w = f.box.x1 - f.box.x0 + 1, h = f.box.y1 - f.box.y0 + 1;
    if (x + w + pad > W) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    if (y + h + pad > H) return null;
    f.ax = x;
    f.ay = y;
    x += w + pad;
    rowH = Math.max(rowH, h);
  }
  return true;
}
