// Общие операции над PNG (pngjs) для сборки ассетов.
import { PNG } from 'pngjs';
import fs from 'node:fs';

export const readPng = (file) => PNG.sync.read(fs.readFileSync(file));
export const writePng = (file, png) => fs.writeFileSync(file, PNG.sync.write(png, { deflateLevel: 9 }));

export function blank(w, h) {
  const p = new PNG({ width: w, height: h });
  p.data.fill(0);
  return p;
}

/** Прямоугольник непрозрачных пикселей (включительно) или null. */
export function bbox(png, minA = 8) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  const { width: W, height: H, data: d } = png;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3] > minA) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Середина ступней: центр непрозрачных пикселей в нижней полосе силуэта. */
export function feetPoint(png, b, band = 12) {
  let sx = 0, n = 0;
  for (let y = Math.max(b.y0, b.y1 - band); y <= b.y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      if (png.data[(y * png.width + x) * 4 + 3] > 128) {
        sx += x;
        n++;
      }
    }
  }
  return { x: n ? sx / n : (b.x0 + b.x1) / 2, y: b.y1 };
}

/**
 * Ступни у фигуры с оружием: опущенный меч или копьё бывают ниже ног, поэтому по X берём центр масс
 * нижней трети силуэта (тонкий клинок почти ничего не весит), а по Y — самую нижнюю точку рядом с ним.
 */
export function feetOfFigure(png, b) {
  const h = b.y1 - b.y0 + 1, w = b.x1 - b.x0 + 1;
  const A = (x, y) => png.data[(y * png.width + x) * 4 + 3];
  // Для каждого столбца — сплошной кусок силуэта снизу вверх. У ног и туловища он длинный,
  // у клинка, копья, вил — короткий (толщина оружия). По длинным и ищем, где стоит фигура.
  const cols = [];
  let maxRun = 0;
  for (let x = b.x0; x <= b.x1; x++) {
    let yb = -1;
    for (let y = b.y1; y >= b.y0; y--) {
      if (A(x, y) > 128) {
        yb = y;
        break;
      }
    }
    if (yb < 0) continue;
    let run = 0;
    for (let y = yb; y >= b.y0 && A(x, y) > 128; y--) run++;
    cols.push({ x, yb, run });
    maxRun = Math.max(maxRun, run);
  }
  let sx = 0, sw = 0;
  for (const c of cols) {
    if (c.run < Math.max(maxRun * 0.45, h * 0.2)) continue;
    sx += c.x * c.run;
    sw += c.run;
  }
  const fx = sw ? sx / sw : (b.x0 + b.x1) / 2;
  const half = Math.max(6, w * 0.12);
  let fy = b.y0;
  for (let x = Math.round(fx - half); x <= Math.round(fx + half); x++) {
    if (x < 0 || x >= png.width) continue;
    for (let y = b.y1; y > fy; y--) {
      if (png.data[(y * png.width + x) * 4 + 3] > 128) {
        fy = y;
        break;
      }
    }
  }
  return { x: fx, y: fy };
}

export function flipX(src) {
  const { width: W, height: H } = src;
  const dst = new PNG({ width: W, height: H });
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const si = (y * W + x) * 4, di = (y * W + (W - 1 - x)) * 4;
      src.data.copy(dst.data, di, si, si + 4);
    }
  }
  return dst;
}

/** Копия src в dst со сдвигом (без смешивания — dst в этом месте пуст). */
export function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) {
    const dy = y + oy;
    if (dy < 0 || dy >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const dx = x + ox;
      if (dx < 0 || dx >= dst.width) continue;
      const si = (y * src.width + x) * 4;
      if (src.data[si + 3] === 0) continue;
      src.data.copy(dst.data, (dy * dst.width + dx) * 4, si, si + 4);
    }
  }
}

/** Вырезать прямоугольник. */
export function crop(src, x0, y0, w, h) {
  const dst = blank(w, h);
  for (let y = 0; y < h; y++) {
    const sy = y0 + y;
    if (sy < 0 || sy >= src.height) continue;
    for (let x = 0; x < w; x++) {
      const sx = x0 + x;
      if (sx < 0 || sx >= src.width) continue;
      src.data.copy(dst.data, (y * w + x) * 4, (sy * src.width + sx) * 4, (sy * src.width + sx) * 4 + 4);
    }
  }
  return dst;
}

/** Уменьшение с усреднением по площади (в premultiplied alpha, без тёмных ореолов). k ≤ 1. */
export function downscale(src, k) {
  const W = Math.max(1, Math.round(src.width * k)), H = Math.max(1, Math.round(src.height * k));
  return resize(src, W, H);
}

export function resize(src, W, H) {
  const sx = src.width / W, sy = src.height / H;
  if (sx < 1 || sy < 1) return upscale(src, W, H);
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

/** Билинейное увеличение (для мелких исходников декора). */
function upscale(src, W, H) {
  const dst = new PNG({ width: W, height: H });
  const s = src.data, sw = src.width, sh = src.height;
  for (let y = 0; y < H; y++) {
    const fy = Math.max(0, Math.min(sh - 1, ((y + 0.5) * sh) / H - 0.5));
    const y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < W; x++) {
      const fx = Math.max(0, Math.min(sw - 1, ((x + 0.5) * sw) / W - 0.5));
      const x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0;
      let r = 0, g = 0, b = 0, a = 0;
      for (const [px, py, w] of [[x0, y0, (1 - tx) * (1 - ty)], [x1, y0, tx * (1 - ty)], [x0, y1, (1 - tx) * ty], [x1, y1, tx * ty]]) {
        const i = (py * sw + px) * 4, al = s[i + 3] * w;
        r += s[i] * al;
        g += s[i + 1] * al;
        b += s[i + 2] * al;
        a += al;
      }
      const o = (y * W + x) * 4;
      if (a > 0) {
        dst.data[o] = Math.round(r / a);
        dst.data[o + 1] = Math.round(g / a);
        dst.data[o + 2] = Math.round(b / a);
      }
      dst.data[o + 3] = Math.round(a);
    }
  }
  return dst;
}

/** Тёмный контур толщиной r px вокруг силуэта (рисуется под спрайтом). */
export function outline(src, r, color = [26, 18, 14]) {
  const pad = Math.ceil(r) + 1;
  const W = src.width + pad * 2, H = src.height + pad * 2;
  const alpha = new Float32Array(W * H);
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) alpha[(y + pad) * W + x + pad] = src.data[(y * src.width + x) * 4 + 3] / 255;
  // максимум альфы в круге радиуса r (с мягким краем)
  const offs = [];
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dy);
    if (d <= r + 0.5) offs.push([dx, dy, Math.min(1, r + 0.5 - d)]);
  }
  const dst = blank(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let m = 0;
      for (const [dx, dy, w] of offs) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const a = alpha[yy * W + xx] * w;
        if (a > m) m = a;
        if (m >= 1) break;
      }
      const o = (y * W + x) * 4;
      // спрайт поверх контура
      const sa = alpha[y * W + x];
      const oa = m * (1 - sa);
      const outA = sa + oa;
      if (outA <= 0) continue;
      let r0 = color[0], g0 = color[1], b0 = color[2];
      if (sa > 0) {
        const si = ((y - pad) * src.width + (x - pad)) * 4;
        r0 = (src.data[si] * sa + color[0] * oa) / outA;
        g0 = (src.data[si + 1] * sa + color[1] * oa) / outA;
        b0 = (src.data[si + 2] * sa + color[2] * oa) / outA;
      }
      dst.data[o] = Math.round(r0);
      dst.data[o + 1] = Math.round(g0);
      dst.data[o + 2] = Math.round(b0);
      dst.data[o + 3] = Math.round(outA * 255);
    }
  }
  return { png: dst, pad };
}

export function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = 60 * (((g - b) / d) % 6);
    else if (mx === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return [h, mx === 0 ? 0 : d / mx, mx];
}

export function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  v = Math.max(0, Math.min(1, v));
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Перекраска по правилу (h,s,v) → [h,s,v] | null. */
export function recolor(png, rule) {
  const d = png.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const res = rule(...rgbToHsv(d[i], d[i + 1], d[i + 2]));
    if (res) [d[i], d[i + 1], d[i + 2]] = hsvToRgb(res[0], res[1], res[2]);
  }
  return png;
}

/** Цветокоррекция текстуры: обесцветить (sat), умножить (mul), прибавить (add), яркость (gain). */
export function grade(png, { sat = 1, mul = [1, 1, 1], add = [0, 0, 0], gain = 1 } = {}) {
  const d = png.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    for (let c = 0; c < 3; c++) {
      const v = (l + (d[i + c] - l) * sat) * mul[c] * gain + add[c];
      d[i + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }
  return png;
}

/**
 * Упаковка полками в страницы со сторонами-степенями двойки (ради мипмапов).
 * items: { w, h } — проставляет page, ax, ay. Возвращает размеры страниц.
 */
export function packPages(items, pad = 2, maxSize = 2048) {
  const sorted = [...items].sort((a, b) => b.h - a.h || b.w - a.w);
  const pages = [];
  let rest = sorted;
  while (rest.length) {
    // пробуем всё оставшееся в одну страницу поменьше; иначе — полную страницу
    let placed = null;
    for (const [w, h] of [[512, 512], [1024, 512], [1024, 1024], [2048, 1024], [2048, 2048]].filter(([w, h]) => w <= maxSize && h <= maxSize)) {
      const r = shelf(rest, w, h, pad, false);
      if (r.left.length === 0) {
        placed = { w, h, r };
        break;
      }
    }
    if (!placed) placed = { w: maxSize, h: maxSize, r: shelf(rest, maxSize, maxSize, pad, true) };
    // ужать высоту страницы до степени двойки по факту
    const idx = pages.length;
    for (const it of placed.r.done) it.page = idx;
    let usedH = 0;
    for (const it of placed.r.done) usedH = Math.max(usedH, it.ay + it.h + pad);
    let h = 64;
    while (h < usedH) h *= 2;
    pages.push({ w: placed.w, h: Math.min(placed.h, h) });
    if (placed.r.done.length === 0) throw new Error('item larger than page');
    rest = placed.r.left;
  }
  return pages;
}

function shelf(items, W, H, pad, partial) {
  let x = pad, y = pad, rowH = 0;
  const done = [], left = [];
  for (const it of items) {
    if (x + it.w + pad > W) {
      x = pad;
      y += rowH + pad;
      rowH = 0;
    }
    if (y + it.h + pad > H) {
      if (!partial) return { done, left: [it] };
      left.push(it);
      continue;
    }
    it.ax = x;
    it.ay = y;
    done.push(it);
    x += it.w + pad;
    rowH = Math.max(rowH, it.h);
  }
  return { done, left };
}
