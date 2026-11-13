import Phaser from 'phaser';
import { TEX_RES } from './config';

// Процедурные текстуры (рисуем Canvas2D при загрузке) в разрешении TEX_RES:
// размеры ниже — в «мировых» пикселях, при показе такие картинки масштабируются на 1/TEX_RES.
// Персонажи — векторный богатырь (public/assets/hero) и зомби GameArt2D (см. ASSETS.md).

type Ctx = CanvasRenderingContext2D;

const INK = '#2a180e';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx, w: number, h: number) => void, res = TEX_RES) {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, Math.round(w * res), Math.round(h * res));
  if (!tex) return;
  const c = tex.getContext();
  c.save();
  c.scale(res, res);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c, w, h);
  c.restore();
  tex.refresh();
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

function circle(c: Ctx, x: number, y: number, r: number, fill: string) {
  ellipse(c, x, y, r, r, fill);
}

function path(c: Ctx, pts: number[]) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
}

function poly(c: Ctx, pts: number[], fill: string, stroke?: string, lw = 2) {
  path(c, pts);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}

function softShadow(c: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.28) {
  const g = c.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  c.translate(-x, -y);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** Купа листвы: сначала контур (круги чуть больше), потом заливка — получается мультяшный силуэт. */
function foliage(c: Ctx, blobs: [number, number, number][], colors: string[], rnd: () => number, outline = 2.2) {
  for (const [x, y, r] of blobs) circle(c, x, y, r + outline, INK);
  for (const [x, y, r] of blobs) circle(c, x, y, r, colors[0]);
  for (const [x, y, r] of blobs) circle(c, x - r * 0.18, y - r * 0.22, r * 0.72, colors[1]);
  for (const [x, y, r] of blobs) if (rnd() < 0.6) circle(c, x - r * 0.35, y - r * 0.4, r * 0.3, colors[2]);
}

// ---------- Мир ----------

function makeGround(scene: Phaser.Scene) {
  canvasTex(scene, 'ground', 256, 256, (c, w, h) => {
    const rnd = mulberry32(7);
    c.fillStyle = '#4e7c32';
    c.fillRect(0, 0, w, h);
    const wrap = (fn: (ox: number, oy: number) => void) => {
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) fn(ox, oy);
    };
    // мягкие пятна светлой и тёмной травы
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, y = rnd() * h, r = 26 + rnd() * 46;
      const light = rnd() < 0.5;
      wrap((ox, oy) => {
        const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, light ? 'rgba(122,168,70,0.38)' : 'rgba(46,82,30,0.34)');
        g.addColorStop(1, light ? 'rgba(122,168,70,0)' : 'rgba(46,82,30,0)');
        c.fillStyle = g;
        c.beginPath();
        c.ellipse(x + ox, y + oy, r, r * 0.72, 0, 0, Math.PI * 2);
        c.fill();
      });
    }
    // клевер
    for (let i = 0; i < 18; i++) {
      const x = rnd() * w, y = rnd() * h;
      wrap((ox, oy) => {
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 - Math.PI / 2;
          circle(c, x + ox + Math.cos(a) * 2.2, y + oy + Math.sin(a) * 2.2, 2, 'rgba(64,112,40,0.9)');
        }
      });
    }
    // камушки
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w, y = rnd() * h, r = 0.8 + rnd() * 1.4;
      wrap((ox, oy) => circle(c, x + ox, y + oy, r, 'rgba(78,60,36,0.4)'));
    }
    // травинки
    c.lineWidth = 1.4;
    for (let i = 0; i < 360; i++) {
      const x = rnd() * w, y = rnd() * h, len = 3 + rnd() * 6, dx = (rnd() - 0.5) * 4;
      const col = rnd() < 0.5 ? '#70a849' : rnd() < 0.5 ? '#3c6628' : '#86ba58';
      wrap((ox, oy) => {
        c.strokeStyle = col;
        c.beginPath();
        c.moveTo(x + ox, y + oy);
        c.quadraticCurveTo(x + ox + dx * 0.3, y + oy - len * 0.6, x + ox + dx, y + oy - len);
        c.stroke();
      });
    }
  });
}

function makeDecor(scene: Phaser.Scene) {
  // Берёза
  canvasTex(scene, 'birch', 120, 240, (c, w, h) => {
    const rnd = mulberry32(11);
    softShadow(c, w / 2, h - 8, 36, 9);
    const tw = 15, tx = w / 2 - tw / 2, top = 70;
    c.fillStyle = '#f4f1e8';
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(tx + 1, top);
    c.lineTo(tx - 1, h - 9);
    c.quadraticCurveTo(w / 2, h - 5, tx + tw + 1, h - 9);
    c.lineTo(tx + tw - 1, top);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#d2cdc0';
    c.fillRect(tx + tw - 5, top + 2, 4, h - 12 - top);
    c.fillStyle = '#2b2b2b';
    for (let y = top + 8; y < h - 16; y += 8 + rnd() * 11) {
      const mw = 4 + rnd() * 7;
      c.fillRect(rnd() < 0.5 ? tx : tx + tw - mw, y, mw, 2 + rnd() * 2);
    }
    c.strokeStyle = INK;
    c.lineWidth = 2.6;
    for (let i = 0; i < 4; i++) {
      const y = 76 + i * 14, dir = i % 2 ? 1 : -1;
      c.beginPath();
      c.moveTo(w / 2, y);
      c.lineTo(w / 2 + dir * (18 + rnd() * 10), y - 16 - rnd() * 6);
      c.stroke();
    }
    const blobs: [number, number, number][] = [];
    for (let i = 0; i < 22; i++) blobs.push([w / 2 + (rnd() - 0.5) * 78, 22 + rnd() * 92, 9 + rnd() * 9]);
    foliage(c, blobs, ['#4f8c2f', '#6fae42', '#9fd468'], rnd);
  });

  // Ель
  canvasTex(scene, 'fir', 116, 230, (c, w, h) => {
    softShadow(c, w / 2, h - 8, 38, 9);
    c.fillStyle = '#5b3a1e';
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.fillRect(w / 2 - 6, h - 40, 12, 32);
    c.strokeRect(w / 2 - 6, h - 40, 12, 32);
    for (let i = 0; i < 5; i++) {
      const apex = 10 + i * 30, base = 66 + i * 33, hw = 20 + i * 10;
      const pts = [w / 2, apex, w / 2 + hw * 0.55, base - 8, w / 2 + hw, base, w / 2 - hw, base, w / 2 - hw * 0.55, base - 8];
      poly(c, pts, '#24502c', INK, 2.4);
      poly(c, [w / 2, apex + 3, w / 2 - hw * 0.5, base - 9, w / 2 - hw + 4, base - 2, w / 2 - 2, base - 2], '#2f6a39');
      poly(c, [w / 2, apex + 6, w / 2 - hw * 0.3, base - 14, w / 2 - 3, base - 12], '#3f8248');
    }
  });

  // Куст с калиной
  canvasTex(scene, 'bush', 86, 62, (c, w, h) => {
    const rnd = mulberry32(21);
    softShadow(c, w / 2, h - 6, 36, 8);
    const blobs: [number, number, number][] = [];
    for (let i = 0; i < 9; i++) blobs.push([16 + rnd() * (w - 32), 22 + rnd() * 22, 10 + rnd() * 7]);
    foliage(c, blobs, ['#3a7428', '#56963a', '#86c25c'], rnd);
    for (let i = 0; i < 8; i++) {
      const x = 16 + rnd() * (w - 32), y = 16 + rnd() * 26;
      circle(c, x, y, 3.2, INK);
      circle(c, x, y, 2.4, '#d6332b');
      circle(c, x - 0.8, y - 0.8, 0.8, '#ffb0a0');
    }
  });

  // Камень
  canvasTex(scene, 'stone', 56, 40, (c, w, h) => {
    softShadow(c, w / 2, h - 6, 26, 6);
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    path(c, [6, h - 8, 10, 14, 22, 7, 38, 8, 50, 17, 51, h - 8]);
    c.fillStyle = '#7b8079';
    c.fill();
    c.stroke();
    poly(c, [12, 15, 22, 9, 36, 10, 30, 18, 16, 20], '#a3a8a0');
    poly(c, [16, 13, 22, 10, 26, 12, 20, 15], '#c8ccc4');
  });

  // Пень
  canvasTex(scene, 'stump', 54, 48, (c, w) => {
    softShadow(c, w / 2, 41, 24, 6);
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.fillStyle = '#6b4626';
    c.beginPath();
    c.moveTo(w / 2 - 16, 15);
    c.lineTo(w / 2 - 18, 39);
    c.quadraticCurveTo(w / 2, 45, w / 2 + 18, 39);
    c.lineTo(w / 2 + 16, 15);
    c.closePath();
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(w / 2, 15, 16, 6.5, 0, 0, Math.PI * 2);
    c.fillStyle = '#d4ae74';
    c.fill();
    c.stroke();
    c.strokeStyle = '#a07a48';
    c.lineWidth = 1;
    for (const r of [4, 8, 12]) {
      c.beginPath();
      c.ellipse(w / 2, 15, r, r * 0.4, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.strokeStyle = '#4a2e16';
    c.lineWidth = 1.6;
    for (const x of [-9, 0, 8]) {
      c.beginPath();
      c.moveTo(w / 2 + x, 24);
      c.lineTo(w / 2 + x - 1, 38);
      c.stroke();
    }
  });

  // Мухомор
  canvasTex(scene, 'mushroom', 28, 32, (c, w) => {
    softShadow(c, w / 2, 28, 10, 3);
    c.strokeStyle = INK;
    c.lineWidth = 1.8;
    c.fillStyle = '#f4efe0';
    c.fillRect(w / 2 - 3.5, 13, 7, 14);
    c.strokeRect(w / 2 - 3.5, 13, 7, 14);
    c.beginPath();
    c.ellipse(w / 2, 14, 12, 9, 0, Math.PI, 0);
    c.closePath();
    c.fillStyle = '#d42b1e';
    c.fill();
    c.stroke();
    for (const [x, y] of [[-6, -2], [1, -6], [6, -1], [-1, -1]]) circle(c, w / 2 + x, 12 + y, 1.7, '#ffffff');
  });

  // Цветы: ромашки и васильки
  canvasTex(scene, 'flowers', 56, 34, (c) => {
    const rnd = mulberry32(31);
    for (let i = 0; i < 7; i++) {
      const x = 6 + rnd() * 44, y = 6 + rnd() * 22, blue = rnd() < 0.35;
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        circle(c, x + Math.cos(a) * 2.8, y + Math.sin(a) * 2.8, 2, blue ? '#4f7fe0' : '#ffffff');
      }
      circle(c, x, y, 1.7, blue ? '#2b4fa8' : '#f5c242');
    }
  });

  // Пучок травы
  canvasTex(scene, 'tuft', 36, 24, (c) => {
    c.lineWidth = 2;
    const rnd = mulberry32(41);
    for (let i = 0; i < 9; i++) {
      c.strokeStyle = i % 2 ? '#79b04c' : '#4f8634';
      const x = 6 + rnd() * 24;
      c.beginPath();
      c.moveTo(x, 22);
      c.quadraticCurveTo(x + (rnd() - 0.5) * 6, 12, x + (rnd() - 0.5) * 12, 2 + rnd() * 6);
      c.stroke();
    }
  });

  // Стог сена
  canvasTex(scene, 'haystack', 92, 92, (c, w, h) => {
    const rnd = mulberry32(51);
    softShadow(c, w / 2, h - 8, 42, 10);
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.fillStyle = '#5a3a1a';
    c.fillRect(w / 2 - 2, 2, 4, 20);
    c.strokeRect(w / 2 - 2, 2, 4, 20);
    c.beginPath();
    c.moveTo(8, h - 10);
    c.bezierCurveTo(4, 40, 30, 12, w / 2, 12);
    c.bezierCurveTo(w - 30, 12, w - 4, 40, w - 8, h - 10);
    c.quadraticCurveTo(w / 2, h - 2, 8, h - 10);
    c.closePath();
    const g = c.createLinearGradient(0, 10, w, h);
    g.addColorStop(0, '#f0d27a');
    g.addColorStop(1, '#b98d34');
    c.fillStyle = g;
    c.fill();
    c.stroke();
    c.lineWidth = 1.3;
    for (let i = 0; i < 40; i++) {
      const x = 14 + rnd() * (w - 28), y = 20 + rnd() * (h - 34);
      c.strokeStyle = rnd() < 0.5 ? '#a47a2a' : '#fbe7a6';
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (rnd() - 0.5) * 6, y + 6 + rnd() * 6);
      c.stroke();
    }
    c.strokeStyle = '#6b4a1a';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(14, 52);
    c.quadraticCurveTo(w / 2, 60, w - 14, 52);
    c.stroke();
  });

  // Плетень
  canvasTex(scene, 'fence', 110, 56, (c, w, h) => {
    softShadow(c, w / 2, h - 5, 52, 6, 0.22);
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    const stakes = [10, 38, 66, 96];
    for (const x of stakes) {
      c.fillStyle = '#6b4626';
      c.fillRect(x - 3, 4, 6, h - 10);
      c.strokeRect(x - 3, 4, 6, h - 10);
    }
    for (let row = 0; row < 4; row++) {
      const y = 14 + row * 8;
      c.lineWidth = 5.5;
      c.strokeStyle = INK;
      c.beginPath();
      c.moveTo(4, y);
      for (let i = 0; i < stakes.length - 1; i++) {
        const xm = (stakes[i] + stakes[i + 1]) / 2;
        c.quadraticCurveTo(xm, y + ((i + row) % 2 ? 3 : -3), stakes[i + 1], y);
      }
      c.lineTo(w - 4, y);
      c.stroke();
      c.lineWidth = 3;
      c.strokeStyle = row % 2 ? '#a07040' : '#8a5c30';
      c.stroke();
    }
  });

  // Камень на распутье
  canvasTex(scene, 'signstone', 74, 78, (c, w, h) => {
    softShadow(c, w / 2, h - 7, 34, 8);
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    path(c, [8, h - 9, 10, 20, 22, 8, 50, 6, 64, 18, 66, h - 9]);
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#6a6e68');
    g.addColorStop(0.5, '#a2a69e');
    g.addColorStop(1, '#7e827b');
    c.fillStyle = g;
    c.fill();
    c.stroke();
    c.strokeStyle = '#4a4d48';
    c.lineWidth = 1.6;
    for (let r = 0; r < 4; r++) {
      const y = 24 + r * 10;
      c.beginPath();
      c.moveTo(20, y);
      for (let x = 20; x < 54; x += 4) c.lineTo(x + 2, y + (x % 8 ? -2 : 1));
      c.stroke();
    }
    poly(c, [18, 12, 24, 9, 40, 9, 30, 14], 'rgba(255,255,255,0.35)');
    c.fillStyle = '#4f8a32';
    for (const [x, y] of [[12, h - 14], [60, h - 16], [36, 9]]) circle(c, x, y, 3, '#4f8a32');
  });

  // Поваленное бревно
  canvasTex(scene, 'log', 96, 40, (c, w, h) => {
    softShadow(c, w / 2, h - 6, 44, 6);
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.fillStyle = '#6b4626';
    c.beginPath();
    c.moveTo(12, 10);
    c.lineTo(w - 14, 8);
    c.lineTo(w - 14, h - 10);
    c.lineTo(12, h - 8);
    c.closePath();
    c.fill();
    c.stroke();
    c.strokeStyle = '#4a2e16';
    c.lineWidth = 1.5;
    for (const y of [16, 22, 27]) {
      c.beginPath();
      c.moveTo(18, y);
      c.lineTo(w - 22, y - 1);
      c.stroke();
    }
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.beginPath();
    c.ellipse(w - 14, (8 + h - 10) / 2, 7, 11, 0, 0, Math.PI * 2);
    c.fillStyle = '#d4ae74';
    c.fill();
    c.stroke();
    c.strokeStyle = '#a07a48';
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(w - 14, (8 + h - 10) / 2, 3.5, 6, 0, 0, Math.PI * 2);
    c.stroke();
    foliage(c, [[20, 9, 5], [30, 7, 4]], ['#3f7a2b', '#5a9a3a', '#86c25c'], mulberry32(61), 1.6);
  });

  // Тень под персонажем
  canvasTex(scene, 'shadow', 64, 22, (c, w, h) => softShadow(c, w / 2, h / 2, 30, 10, 0.42));

  // Лужа нечисти (остаётся на месте гибели)
  canvasTex(scene, 'splat', 64, 64, (c) => {
    const rnd = mulberry32(71);
    const blobs: [number, number, number][] = [[32, 32, 15]];
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2, d = 10 + rnd() * 14;
      blobs.push([32 + Math.cos(a) * d, 32 + Math.sin(a) * d, 3 + rnd() * 6]);
    }
    for (const [x, y, r] of blobs) circle(c, x, y, r, '#2f5a1c');
    for (const [x, y, r] of blobs) circle(c, x - 1, y - 1, r * 0.75, '#4c8a2a');
    circle(c, 27, 27, 4, 'rgba(190,255,150,0.45)');
  });
}

// ---------- Оружие и предметы ----------

function drawAxe(c: Ctx, cx: number, cy: number, s: number) {
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.fillStyle = '#7a4a22';
  c.fillRect(-3, -22, 6, 46);
  c.strokeRect(-3, -22, 6, 46);
  c.fillStyle = '#5a3416';
  c.fillRect(1, -21, 2, 44);
  c.beginPath();
  c.moveTo(2, -20);
  c.lineTo(14, -24);
  c.quadraticCurveTo(28, -10, 20, 10);
  c.lineTo(10, 2);
  c.lineTo(2, -4);
  c.closePath();
  const g = c.createLinearGradient(2, -20, 24, 4);
  g.addColorStop(0, '#9aa3ab');
  g.addColorStop(1, '#eef2f5');
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 2;
  c.stroke();
  c.strokeStyle = '#ffffff';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(15, -21);
  c.quadraticCurveTo(25, -10, 19.5, 6);
  c.stroke();
  c.restore();
}

function drawSpear(c: Ctx, x0: number, y: number, len: number) {
  const tip = len * 0.26;
  c.strokeStyle = INK;
  c.lineWidth = 1.6;
  c.fillStyle = '#8a5a2b';
  c.fillRect(x0 + 1, y - 2.5, len - tip, 5);
  c.strokeRect(x0 + 1, y - 2.5, len - tip, 5);
  poly(c, [x0 + len - tip - 10, y - 3, x0 + len - tip - 18, y - 9, x0 + len - tip - 14, y, x0 + len - tip - 18, y + 9, x0 + len - tip - 10, y + 3], '#c62e2e', INK, 1.2);
  c.beginPath();
  c.moveTo(x0 + len - tip, y);
  c.quadraticCurveTo(x0 + len - tip * 0.6, y - 9, x0 + len - 1, y);
  c.quadraticCurveTo(x0 + len - tip * 0.6, y + 9, x0 + len - tip, y);
  c.fillStyle = '#e1e6ea';
  c.fill();
  c.strokeStyle = INK;
  c.lineWidth = 1.4;
  c.stroke();
}

function drawFlailBall(c: Ctx, cx: number, cy: number, r: number) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    poly(c, [cx + Math.cos(a - 0.28) * r * 0.9, cy + Math.sin(a - 0.28) * r * 0.9, cx + Math.cos(a) * r * 1.55, cy + Math.sin(a) * r * 1.55, cx + Math.cos(a + 0.28) * r * 0.9, cy + Math.sin(a + 0.28) * r * 0.9], '#8d959c', INK, 1.4);
  }
  circle(c, cx, cy, r + 1.4, INK);
  const g = c.createRadialGradient(cx - r * 0.35, cy - r * 0.35, 1, cx, cy, r);
  g.addColorStop(0, '#d9dee3');
  g.addColorStop(1, '#4f575e');
  circle(c, cx, cy, r, g as unknown as string);
}

function makeItems(scene: Phaser.Scene) {
  canvasTex(scene, 'axe', 64, 64, (c, w, h) => drawAxe(c, w / 2 - 6, h / 2, 1.15));
  canvasTex(scene, 'spear', 150, 24, (c, _w, h) => drawSpear(c, 0, h / 2, 150));

  // Пирожок (лечит)
  canvasTex(scene, 'pie', 36, 26, (c, w, h) => {
    softShadow(c, w / 2, h - 4, 15, 3);
    c.strokeStyle = INK;
    c.lineWidth = 1.8;
    c.beginPath();
    c.ellipse(w / 2, h / 2 + 1, 15, 9, 0, 0, Math.PI * 2);
    c.fillStyle = '#b8681f';
    c.fill();
    c.stroke();
    ellipse(c, w / 2, h / 2 - 1, 13, 7, '#e59a3a');
    ellipse(c, w / 2 - 3, h / 2 - 4, 6, 2.5, '#f7c675');
    c.strokeStyle = '#9b5517';
    c.lineWidth = 1.5;
    for (const dx of [-5, 0, 5]) {
      c.beginPath();
      c.moveTo(w / 2 + dx - 2, h / 2 - 1);
      c.lineTo(w / 2 + dx + 2, h / 2 + 2);
      c.stroke();
    }
  });

  // Стрела лучника (летит вправо, поворачивается по направлению)
  canvasTex(scene, 'arrow', 46, 12, (c, _w, h) => {
    const y = h / 2;
    c.strokeStyle = INK;
    c.lineWidth = 1.4;
    c.fillStyle = '#8a5a2b';
    c.fillRect(6, y - 1.5, 30, 3);
    c.strokeRect(6, y - 1.5, 30, 3);
    poly(c, [36, y - 5, 45, y, 36, y + 5], '#c9d1d8', INK, 1.4);
    poly(c, [2, y - 5, 12, y - 1, 12, y + 1, 2, y + 5, 6, y], '#d63a2a', INK, 1.2);
  });

  // Колдовской шар (белый — красится при выстреле: огонь, души, яд)
  canvasTex(scene, 'orb', 34, 34, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });

  // Осколок: ледяная игла, шип, кость (летит вправо, белый — красится при выстреле)
  canvasTex(scene, 'shard', 40, 14, (c, _w, h) => {
    const y = h / 2;
    poly(c, [2, y, 14, y - 5, 39, y, 14, y + 5], '#ffffff', INK, 1.4);
    c.strokeStyle = 'rgba(160,190,220,0.9)';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(8, y);
    c.lineTo(34, y);
    c.stroke();
  });

  // Гиря кистеня
  canvasTex(scene, 'flail', 34, 34, (c, w, h) => drawFlailBall(c, w / 2, h / 2, 11));

  // Молния Перуна (рисуем с запасом по высоте, origin внизу)
  canvasTex(scene, 'bolt', 60, 420, (c, w, h) => {
    const rnd = mulberry32(81);
    const pts: [number, number][] = [];
    let x = w / 2;
    for (let y = 0; y <= h; y += 18) {
      pts.push([x, y]);
      x = Phaser.Math.Clamp(x + (rnd() - 0.5) * 22, 12, w - 12);
    }
    pts[pts.length - 1] = [w / 2, h];
    const stroke = (lw: number, col: string, blur: number) => {
      c.save();
      c.shadowColor = '#7fb8ff';
      c.shadowBlur = blur;
      c.strokeStyle = col;
      c.lineWidth = lw;
      c.beginPath();
      pts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py)));
      c.stroke();
      c.restore();
    };
    stroke(9, 'rgba(120,170,255,0.45)', 14);
    stroke(4.5, '#cfe4ff', 8);
    stroke(2, '#ffffff', 0);
    // ответвления
    for (let i = 3; i < pts.length - 3; i += 4) {
      const [px, py] = pts[i];
      const dir = rnd() < 0.5 ? -1 : 1;
      c.strokeStyle = 'rgba(200,225,255,0.8)';
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(px, py);
      c.lineTo(px + dir * (10 + rnd() * 10), py + 12);
      c.lineTo(px + dir * (14 + rnd() * 12), py + 26);
      c.stroke();
    }
  }, 1);

  // Кружок для джойстика (UI рисуется в физических пикселях — без TEX_RES)
  canvasTex(scene, 'joy-base', 160, 160, (c) => {
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 5;
    c.beginPath();
    c.arc(80, 80, 72, 0, Math.PI * 2);
    c.stroke();
    circle(c, 80, 80, 70, 'rgba(0,0,0,0.18)');
  }, 1);
  canvasTex(scene, 'joy-knob', 80, 80, (c) => {
    circle(c, 40, 40, 34, 'rgba(255,255,255,0.55)');
    circle(c, 40, 40, 26, 'rgba(255,255,255,0.35)');
  }, 1);

  // Кольцо ударной волны
  canvasTex(scene, 'ring', 256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 96, 128, 128, 126);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  });

  // Красная виньетка при уроне и тёмная — для атмосферы
  canvasTex(scene, 'vignette', 256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 70, 128, 128, 182);
    g.addColorStop(0, 'rgba(200,0,0,0)');
    g.addColorStop(1, 'rgba(200,0,0,0.85)');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  }, 1);
  canvasTex(scene, 'shade', 256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 90, 128, 128, 190);
    g.addColorStop(0, 'rgba(10,18,6,0)');
    g.addColorStop(1, 'rgba(10,18,6,0.55)');
    c.fillStyle = g;
    c.fillRect(0, 0, 256, 256);
  }, 1);

  canvasTex(scene, 'px', 4, 4, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 4, 4);
  }, 1);
}

// ---------- Иконки способностей (64x64) ----------

function makeIcons(scene: Phaser.Scene) {
  const S = 64;
  const icon = (key: string, draw: (c: Ctx) => void) => canvasTex(scene, `icon-${key}`, S, S, draw);

  icon('sword', (c) => {
    c.translate(32, 32);
    c.rotate(Math.PI / 4);
    poly(c, [-5, 8, -5, -22, 0, -30, 5, -22, 5, 8], '#dfe5ea', INK, 2);
    c.fillStyle = '#b8c1c8';
    c.fillRect(0.5, -21, 4, 28);
    poly(c, [-14, 8, 14, 8, 14, 13, -14, 13], '#e3b23c', INK, 1.6);
    poly(c, [-3, 13, 3, 13, 3, 24, -3, 24], '#6b3f1d', INK, 1.6);
    circle(c, 0, 27, 5, INK);
    circle(c, 0, 27, 3.6, '#e3b23c');
  });

  icon('axes', (c) => {
    drawAxe(c, 24, 32, 1.05);
    c.strokeStyle = 'rgba(242,193,78,0.9)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(32, 32, 28, -0.3, 1.3);
    c.stroke();
    c.beginPath();
    c.arc(32, 32, 28, 2.8, 4.4);
    c.stroke();
  });

  icon('spear', (c) => {
    c.translate(32, 32);
    c.rotate(-Math.PI / 4);
    drawSpear(c, -30, 0, 62);
  });

  icon('stomp', (c) => {
    for (const [r, a] of [[28, 0.35], [21, 0.6], [14, 0.9]] as const) {
      c.strokeStyle = `rgba(214,170,96,${a})`;
      c.lineWidth = 3.5;
      c.beginPath();
      c.ellipse(32, 48, r, r * 0.38, 0, 0, Math.PI * 2);
      c.stroke();
    }
    poly(c, [24, 8, 37, 8, 37, 34, 50, 38, 50, 46, 22, 46, 22, 34], '#b8402a', INK, 2);
    c.fillStyle = '#e3b23c';
    c.fillRect(23, 10, 13, 4);
    c.fillStyle = '#3a1a0e';
    c.fillRect(22, 44, 28, 3);
  });

  icon('lifesteal', (c) => {
    c.beginPath();
    c.moveTo(32, 5);
    c.bezierCurveTo(26, 16, 12, 30, 12, 40);
    c.arc(32, 40, 20, Math.PI, 0, true);
    c.bezierCurveTo(52, 30, 38, 16, 32, 5);
    const g = c.createLinearGradient(12, 10, 52, 60);
    g.addColorStop(0, '#9dfff0');
    g.addColorStop(1, '#14a37f');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.stroke();
    ellipse(c, 24, 40, 4, 7, 'rgba(255,255,255,0.75)');
  });

  icon('armor', (c) => {
    const pts = [20, 10, 27, 7, 37, 7, 44, 10, 57, 24, 49, 31, 46, 26, 46, 58, 18, 58, 18, 26, 15, 31, 7, 24];
    poly(c, pts, '#9aa3ab', INK, 2.2);
    c.save();
    path(c, pts);
    c.clip();
    c.strokeStyle = '#646d75';
    c.lineWidth = 1.2;
    for (let y = 8; y < 60; y += 5)
      for (let x = 6 + ((y / 5) % 2) * 2.5; x < 60; x += 5) {
        c.beginPath();
        c.arc(x, y, 2.2, 0, Math.PI * 2);
        c.stroke();
      }
    c.restore();
  });

  icon('vitality', (c) => {
    c.beginPath();
    c.moveTo(32, 56);
    c.bezierCurveTo(6, 38, 6, 12, 22, 12);
    c.bezierCurveTo(28, 12, 32, 18, 32, 22);
    c.bezierCurveTo(32, 18, 36, 12, 42, 12);
    c.bezierCurveTo(58, 12, 58, 38, 32, 56);
    c.fillStyle = '#d63a2f';
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.stroke();
    ellipse(c, 21, 22, 4, 6, 'rgba(255,255,255,0.6)');
  });

  icon('speed', (c) => {
    poly(c, [28, 8, 42, 8, 42, 36, 58, 42, 58, 52, 24, 52, 24, 38], '#b2402a', INK, 2);
    c.fillStyle = '#e3b23c';
    c.fillRect(28, 12, 14, 4);
    c.fillStyle = '#3a1a0e';
    c.fillRect(24, 50, 34, 3);
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 3;
    for (const [y, l] of [[20, 16], [30, 20], [40, 14]]) {
      c.beginPath();
      c.moveTo(20 - l, y);
      c.lineTo(18, y);
      c.stroke();
    }
  });

  icon('might', (c) => {
    c.translate(32, 32);
    c.rotate(-Math.PI / 5);
    poly(c, [-3, -2, 3, -2, 3, 28, -3, 28], '#6b3f1d', INK, 1.6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      poly(c, [Math.cos(a - 0.25) * 11, -12 + Math.sin(a - 0.25) * 11, Math.cos(a) * 19, -12 + Math.sin(a) * 19, Math.cos(a + 0.25) * 11, -12 + Math.sin(a + 0.25) * 11], '#8d959c', INK, 1.4);
    }
    circle(c, 0, -12, 13, INK);
    circle(c, 0, -12, 11.5, '#a9b1b8');
    circle(c, -4, -16, 4, 'rgba(255,255,255,0.7)');
  });

  icon('haste', (c) => {
    poly(c, [36, 4, 14, 36, 30, 36, 24, 60, 50, 24, 34, 24, 42, 4], '#f2c14e', INK, 2.2);
  });

  icon('area', (c) => {
    c.strokeStyle = '#f2c14e';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(32, 40, 24, Math.PI * 1.1, Math.PI * 1.9);
    c.stroke();
    poly(c, [6, 34, 12, 22, 18, 36], '#f2c14e', INK, 1.4);
    poly(c, [58, 34, 52, 22, 46, 36], '#f2c14e', INK, 1.4);
    circle(c, 32, 42, 7, INK);
    circle(c, 32, 42, 5.5, '#d6d6d6');
  });

  // Оберег — солярный амулет на шнурке, светится целебным зелёным
  icon('amulet', (c) => {
    const g = c.createRadialGradient(32, 40, 4, 32, 40, 30);
    g.addColorStop(0, 'rgba(120,255,140,0.55)');
    g.addColorStop(1, 'rgba(120,255,140,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    c.strokeStyle = '#7a4a22';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(14, 4);
    c.lineTo(32, 22);
    c.lineTo(50, 4);
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.strokeStyle = INK;
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(32 + Math.cos(a) * 15, 40 + Math.sin(a) * 15);
      c.lineTo(32 + Math.cos(a) * 22, 40 + Math.sin(a) * 22);
      c.stroke();
      c.strokeStyle = '#e3b23c';
      c.lineWidth = 2.6;
      c.stroke();
    }
    circle(c, 32, 40, 16, INK);
    circle(c, 32, 40, 14.5, '#f2c14e');
    circle(c, 32, 40, 9, '#2f9a4a');
    poly(c, [32, 33, 34, 38, 39, 40, 34, 42, 32, 47, 30, 42, 25, 40, 30, 38], '#bfffc8');
  });

  // Круговерть — меч в вихре
  icon('helix', (c) => {
    c.lineWidth = 4;
    for (const [r, a0, col] of [[27, 0, '#f2c14e'], [20, 2.1, '#ffe7a3'], [13, 4.2, '#f2c14e']] as const) {
      c.strokeStyle = col;
      c.beginPath();
      c.arc(32, 32, r, a0, a0 + 4.2);
      c.stroke();
    }
    c.translate(32, 32);
    c.rotate(-Math.PI / 4);
    poly(c, [-3.5, 6, -3.5, -20, 0, -26, 3.5, -20, 3.5, 6], '#eef2f5', INK, 1.8);
    poly(c, [-10, 6, 10, 6, 10, 10, -10, 10], '#e3b23c', INK, 1.4);
    poly(c, [-2.5, 10, 2.5, 10, 2.5, 18, -2.5, 18], '#6b3f1d', INK, 1.4);
  });

  // Богатырская затрещина — кулак со звёздами
  icon('crit', (c) => {
    poly(c, [8, 30, 18, 24, 14, 14, 26, 18, 30, 6, 36, 18, 48, 12, 44, 24, 56, 30, 44, 36, 48, 48, 36, 42, 30, 56, 26, 42, 14, 48, 18, 36], '#ffb347', INK, 2);
    c.save();
    c.translate(33, 31);
    c.rotate(-0.25);
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.fillStyle = '#f1c29a';
    c.beginPath();
    c.roundRect(-13, -10, 26, 20, 6);
    c.fill();
    c.stroke();
    for (const x of [-6.5, 0, 6.5]) {
      c.beginPath();
      c.moveTo(x, -10);
      c.lineTo(x, -3);
      c.stroke();
    }
    c.fillStyle = '#c4352a';
    c.fillRect(-13, 9, 26, 7);
    c.strokeRect(-13, 9, 26, 7);
    c.restore();
  });

  // Кистень — гиря на цепи
  icon('flail', (c) => {
    c.strokeStyle = '#6b3f1d';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(8, 58);
    c.lineTo(20, 40);
    c.stroke();
    for (let i = 0; i < 5; i++) {
      const x = 22 + i * 4.5, y = 37 - i * 4.2;
      c.strokeStyle = INK;
      c.lineWidth = 3.6;
      c.beginPath();
      c.ellipse(x, y, 3, 2, -0.8, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = '#b9c1c8';
      c.lineWidth = 1.8;
      c.stroke();
    }
    drawFlailBall(c, 44, 18, 9);
  });

  // Соловьиный свист — птица и волны ветра
  icon('whistle', (c) => {
    for (const [r, a] of [[14, 0.95], [22, 0.7], [30, 0.45]] as const) {
      c.strokeStyle = `rgba(190,235,255,${a})`;
      c.lineWidth = 4;
      c.beginPath();
      c.arc(22, 34, r, -0.7, 0.7);
      c.stroke();
    }
    c.save();
    c.translate(16, 34);
    poly(c, [-10, 2, 2, -10, 12, -6, 18, -2, 10, 2, 4, 10, -6, 8], '#8a5a2b', INK, 1.8);
    poly(c, [12, -6, 22, -5, 14, -1], '#e3b23c', INK, 1.2);
    circle(c, 8, -5, 1.6, INK);
    c.restore();
  });

  // Гнев Перуна — молния из тучи
  icon('perun', (c) => {
    foliage(c, [[18, 16, 9], [30, 12, 11], [44, 17, 9], [32, 20, 9]], ['#5a6472', '#7d8794', '#a9b2bd'], mulberry32(91), 2);
    poly(c, [34, 22, 22, 40, 31, 40, 24, 60, 44, 34, 34, 34, 40, 22], '#fff3a0', INK, 2);
  });

  // Щит Святогора
  icon('block', (c) => {
    c.save();
    c.translate(32, 33);
    path(c, [0, -26, 22, -18, 20, 6, 0, 27, -20, 6, -22, -18]);
    const g = c.createLinearGradient(-22, -26, 22, 26);
    g.addColorStop(0, '#d0402f');
    g.addColorStop(1, '#7e1d15');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke();
    c.strokeStyle = '#e3b23c';
    c.lineWidth = 3;
    path(c, [0, -19, 15, -13, 14, 4, 0, 19, -14, 4, -15, -13]);
    c.stroke();
    circle(c, 0, -2, 6.5, INK);
    circle(c, 0, -2, 5, '#e3b23c');
    c.restore();
  });

  // Медовуха — деревянная кружка с пеной
  icon('mead', (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.beginPath();
    c.ellipse(46, 34, 9, 12, 0, -Math.PI / 2, Math.PI / 2);
    c.lineWidth = 6;
    c.stroke();
    c.strokeStyle = '#8a5a2b';
    c.lineWidth = 3;
    c.stroke();
    poly(c, [14, 16, 42, 16, 40, 56, 16, 56], '#a8702e', INK, 2.4);
    c.fillStyle = '#7a4a1e';
    for (const x of [21, 28, 35]) c.fillRect(x, 18, 2, 36);
    c.fillStyle = '#e3b23c';
    c.fillRect(15, 26, 26, 3);
    c.fillRect(15, 46, 25, 3);
    foliage(c, [[18, 14, 6], [27, 11, 7], [36, 13, 6]], ['#fff6dc', '#ffffff', '#ffffff'], mulberry32(93), 1.8);
  });

  // Монета злата — валюта мета-прокачки
  icon('coin', (c) => {
    circle(c, 32, 33, 24, INK);
    const g = c.createRadialGradient(26, 26, 3, 32, 33, 23);
    g.addColorStop(0, '#fff2b0');
    g.addColorStop(0.6, '#f2c14e');
    g.addColorStop(1, '#b8861e');
    c.fillStyle = g;
    c.beginPath();
    c.arc(32, 33, 22, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#8a5a10';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(32, 33, 16, 0, Math.PI * 2);
    c.stroke();
    // трезубец-оберег в центре
    c.strokeStyle = '#8a5a10';
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(32, 22);
    c.lineTo(32, 44);
    c.moveTo(24, 26);
    c.lineTo(24, 36);
    c.quadraticCurveTo(32, 42, 40, 36);
    c.lineTo(40, 26);
    c.stroke();
  });

  // Ветвистое дерево — кнопка древа талантов
  icon('tree', (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(32, 58);
    c.lineTo(32, 30);
    c.moveTo(32, 40);
    c.lineTo(18, 26);
    c.moveTo(32, 36);
    c.lineTo(46, 22);
    c.stroke();
    c.strokeStyle = '#8a5a2b';
    c.lineWidth = 4;
    c.stroke();
    foliage(c, [[18, 22, 9], [46, 18, 9], [32, 16, 10], [24, 12, 7], [40, 30, 7]], ['#3a7428', '#56963a', '#86c25c'], mulberry32(97), 2);
    for (const [x, y] of [[20, 20], [44, 16], [33, 13]]) circle(c, x, y, 2.6, '#f2c14e');
  });

  // Шестерёнка настроек (для кнопки HUD)
  icon('gear', (c) => {
    c.save();
    c.translate(32, 32);
    for (let i = 0; i < 8; i++) {
      c.rotate(Math.PI / 4);
      poly(c, [-5, -26, 5, -26, 6, -16, -6, -16], '#f1e2c0', INK, 2);
    }
    circle(c, 0, 0, 19, INK);
    circle(c, 0, 0, 17, '#f1e2c0');
    circle(c, 0, 0, 8, INK);
    circle(c, 0, 0, 6, '#3b2414');
    c.restore();
  });

  icon('pie', (c) => {
    softShadow(c, 32, 46, 24, 6);
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(32, 36, 24, 14, 0, 0, Math.PI * 2);
    c.fillStyle = '#b8681f';
    c.fill();
    c.stroke();
    ellipse(c, 32, 33, 21, 11, '#e59a3a');
    ellipse(c, 26, 28, 9, 3.5, '#f7c675');
  });
}

// ---------- Сундуки и предметы из них ----------

function drawChest(c: Ctx, w: number, h: number, open: boolean) {
  softShadow(c, w / 2, h - 5, w * 0.42, 7, 0.35);
  const bx = 8, by = h * 0.42, bw = w - 16, bh = h * 0.5;
  // короб
  c.strokeStyle = INK;
  c.lineWidth = 2.4;
  const g = c.createLinearGradient(0, by, 0, by + bh);
  g.addColorStop(0, '#a8682e');
  g.addColorStop(1, '#6e3d18');
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(bx, by, bw, bh, 3);
  c.fill();
  c.stroke();
  c.strokeStyle = '#4a2810';
  c.lineWidth = 1.2;
  for (let y = by + bh / 3; y < by + bh - 2; y += bh / 3) {
    c.beginPath();
    c.moveTo(bx + 2, y);
    c.lineTo(bx + bw - 2, y);
    c.stroke();
  }
  if (open) {
    // открытая крышка и свет изнутри
    const glow = c.createRadialGradient(w / 2, by, 2, w / 2, by, w * 0.5);
    glow.addColorStop(0, 'rgba(255,240,170,0.95)');
    glow.addColorStop(1, 'rgba(255,200,80,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, w, by + 6);
    poly(c, [bx + 2, by, bx + bw - 2, by, bx + bw - 6, by - h * 0.32, bx + 6, by - h * 0.32], '#7a4520', INK, 2.4);
    c.fillStyle = '#2a1408';
    c.fillRect(bx + 3, by - 2, bw - 6, 5);
  } else {
    // выпуклая крышка
    c.beginPath();
    c.moveTo(bx, by + 1);
    c.lineTo(bx, by - h * 0.12);
    c.quadraticCurveTo(w / 2, by - h * 0.42, bx + bw, by - h * 0.12);
    c.lineTo(bx + bw, by + 1);
    c.closePath();
    const lg = c.createLinearGradient(0, by - h * 0.4, 0, by);
    lg.addColorStop(0, '#c07a38');
    lg.addColorStop(1, '#84481e');
    c.fillStyle = lg;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke();
  }
  // железные полосы и золотой замок
  c.fillStyle = '#5d6670';
  c.strokeStyle = INK;
  c.lineWidth = 1.4;
  for (const x of [bx + bw * 0.18, bx + bw * 0.82 - 5]) {
    c.fillRect(x, open ? by : by - h * 0.22, 5, open ? bh : bh + h * 0.22);
    c.strokeRect(x, open ? by : by - h * 0.22, 5, open ? bh : bh + h * 0.22);
  }
  if (!open) {
    c.fillStyle = '#e3b23c';
    c.beginPath();
    c.roundRect(w / 2 - 6, by - 4, 12, 13, 2);
    c.fill();
    c.stroke();
    circle(c, w / 2, by + 2, 1.8, INK);
  }
}

function makeChestTextures(scene: Phaser.Scene) {
  canvasTex(scene, 'chest', 64, 54, (c, w, h) => drawChest(c, w, h, false));
  canvasTex(scene, 'chest-open', 64, 54, (c, w, h) => drawChest(c, w, h, true));
}

function makeItemIcons(scene: Phaser.Scene) {
  const S = 64;
  const icon = (key: string, draw: (c: Ctx) => void) => canvasTex(scene, `item-${key}`, S, S, draw);
  const glow = (c: Ctx, col: string) => {
    const g = c.createRadialGradient(32, 32, 4, 32, 32, 31);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  };

  icon('belt', (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 12;
    c.beginPath();
    c.ellipse(32, 34, 24, 12, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#8a4e22';
    c.lineWidth = 8;
    c.stroke();
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) circle(c, 32 + Math.cos(a) * 24, 34 + Math.sin(a) * 12, 1.6, '#e3b23c');
    poly(c, [24, 38, 40, 38, 40, 52, 24, 52], '#e3b23c', INK, 2);
    poly(c, [28, 42, 36, 42, 36, 48, 28, 48], '#8a5a10');
  });

  icon('ring', (c) => {
    glow(c, 'rgba(255,80,60,0.35)');
    c.strokeStyle = INK;
    c.lineWidth = 9;
    c.beginPath();
    c.ellipse(32, 38, 15, 13, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#e3b23c';
    c.lineWidth = 5.5;
    c.stroke();
    poly(c, [32, 10, 42, 18, 38, 28, 26, 28, 22, 18], '#d6232a', INK, 2);
    poly(c, [32, 12, 38, 18, 32, 20, 26, 18], '#ff8a8a');
  });

  icon('klubok', (c) => {
    c.strokeStyle = '#b8262a';
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(44, 46);
    c.bezierCurveTo(56, 52, 50, 60, 60, 60);
    c.stroke();
    circle(c, 30, 32, 20, INK);
    circle(c, 30, 32, 18, '#d63a3a');
    c.strokeStyle = '#8e1a1a';
    c.lineWidth = 1.8;
    for (const [a, r] of [[0.4, 16], [1.4, 13], [2.6, 17], [-0.6, 12]] as const) {
      c.beginPath();
      c.ellipse(30, 32, r, r * 0.45, a, 0, Math.PI * 2);
      c.stroke();
    }
    circle(c, 24, 25, 4, 'rgba(255,255,255,0.4)');
  });

  icon('mitts', (c) => {
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.95 + (i / 8) * Math.PI * 1.1;
      poly(c, [30 + Math.cos(a - 0.12) * 17, 30 + Math.sin(a - 0.12) * 19, 30 + Math.cos(a) * 28, 30 + Math.sin(a) * 30, 30 + Math.cos(a + 0.12) * 17, 30 + Math.sin(a + 0.12) * 19], '#3b2a1c', INK, 1.4);
    }
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.fillStyle = '#8a5a2b';
    c.beginPath();
    c.moveTo(18, 56);
    c.lineTo(16, 30);
    c.quadraticCurveTo(16, 12, 30, 12);
    c.quadraticCurveTo(44, 12, 44, 28);
    c.lineTo(50, 24);
    c.quadraticCurveTo(56, 28, 48, 38);
    c.lineTo(44, 56);
    c.closePath();
    c.fill();
    c.stroke();
    poly(c, [16, 50, 46, 50, 45, 58, 17, 58], '#d0402f', INK, 2);
  });

  icon('horseshoe', (c) => {
    glow(c, 'rgba(255,220,120,0.35)');
    c.strokeStyle = INK;
    c.lineWidth = 14;
    c.lineCap = 'butt';
    c.beginPath();
    c.arc(32, 30, 17, Math.PI * 0.9, Math.PI * 2.1, false);
    c.stroke();
    c.strokeStyle = '#e3b23c';
    c.lineWidth = 9;
    c.stroke();
    c.lineCap = 'round';
    for (let a = Math.PI * 1.0; a <= Math.PI * 2.0; a += Math.PI / 4) circle(c, 32 + Math.cos(a) * 17, 30 + Math.sin(a) * 17, 1.8, '#7a5212');
    poly(c, [14, 33, 20, 33, 21, 50, 13, 50], '#e3b23c', INK, 2);
    poly(c, [44, 33, 50, 33, 51, 50, 43, 50], '#e3b23c', INK, 2);
  });

  icon('bracers', (c) => {
    c.save();
    c.translate(32, 32);
    c.rotate(-0.5);
    path(c, [-12, -22, 12, -22, 15, 22, -15, 22]);
    const g = c.createLinearGradient(-15, 0, 15, 0);
    g.addColorStop(0, '#6c7682');
    g.addColorStop(0.5, '#e8edf1');
    g.addColorStop(1, '#8d98a4');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke();
    c.fillStyle = '#e3b23c';
    c.fillRect(-13, -14, 26, 4);
    c.fillRect(-14.5, 12, 29, 4);
    poly(c, [0, -8, 6, 0, 0, 8, -6, 0], '#d6232a', INK, 1.4);
    c.restore();
  });

  icon('apple', (c) => {
    glow(c, 'rgba(255,230,120,0.45)');
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(32, 20);
    c.bezierCurveTo(14, 8, 6, 30, 14, 44);
    c.bezierCurveTo(20, 56, 30, 54, 32, 52);
    c.bezierCurveTo(34, 54, 44, 56, 50, 44);
    c.bezierCurveTo(58, 30, 50, 8, 32, 20);
    const g = c.createRadialGradient(24, 28, 3, 32, 36, 26);
    g.addColorStop(0, '#fff6a0');
    g.addColorStop(0.5, '#f2c84a');
    g.addColorStop(1, '#c9871e');
    c.fillStyle = g;
    c.fill();
    c.stroke();
    c.strokeStyle = '#5a3216';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(32, 20);
    c.lineTo(33, 9);
    c.stroke();
    poly(c, [34, 12, 46, 6, 44, 14], '#4f9a3a', INK, 1.6);
  });

  icon('tablecloth', (c) => {
    poly(c, [6, 40, 32, 28, 58, 40, 32, 54], '#f4ecd8', INK, 2.2);
    c.strokeStyle = '#c4352a';
    c.lineWidth = 2;
    path(c, [12, 40, 32, 31, 52, 40, 32, 50]);
    c.stroke();
    for (const [x, y] of [[32, 33], [18, 40], [46, 40], [32, 48]]) poly(c, [x, y - 2.5, x + 2.5, y, x, y + 2.5, x - 2.5, y], '#c4352a');
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(32, 30, 13, 9, 0, Math.PI, 0);
    c.lineTo(45, 34);
    c.lineTo(19, 34);
    c.closePath();
    c.fillStyle = '#d99a48';
    c.fill();
    c.stroke();
    c.strokeStyle = '#a8682e';
    c.lineWidth = 1.6;
    for (const x of [25, 32, 39]) {
      c.beginPath();
      c.moveTo(x - 2, 25);
      c.lineTo(x + 2, 29);
      c.stroke();
    }
  });

  icon('moonshard', (c) => {
    glow(c, 'rgba(150,200,255,0.5)');
    c.save();
    c.beginPath();
    c.arc(32, 32, 22, 0, Math.PI * 2);
    c.arc(42, 26, 18, 0, Math.PI * 2, true);
    c.closePath();
    const g = c.createLinearGradient(10, 10, 54, 54);
    g.addColorStop(0, '#f2f8ff');
    g.addColorStop(1, '#7fa9e8');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.stroke();
    c.restore();
    for (const [x, y] of [[48, 44], [52, 16], [40, 52]]) poly(c, [x, y - 4, x + 1.2, y - 1.2, x + 4, y, x + 1.2, y + 1.2, x, y + 4, x - 1.2, y + 1.2, x - 4, y, x - 1.2, y - 1.2], '#ffffff');
  });

  icon('cap', (c) => {
    c.globalAlpha = 0.85;
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(12, 42);
    c.bezierCurveTo(12, 14, 52, 14, 52, 42);
    c.closePath();
    c.fillStyle = '#4a5a8a';
    c.fill();
    c.stroke();
    c.beginPath();
    c.ellipse(32, 44, 23, 8, 0, 0, Math.PI * 2);
    c.fillStyle = '#7a6a5a';
    c.fill();
    c.stroke();
    c.globalAlpha = 1;
    for (const [x, y, r] of [[18, 20, 3], [48, 24, 2.5], [40, 12, 2]]) poly(c, [x, y - r * 2, x + r * 0.5, y - r * 0.5, x + r * 2, y, x + r * 0.5, y + r * 0.5, x, y + r * 2, x - r * 0.5, y + r * 0.5, x - r * 2, y, x - r * 0.5, y - r * 0.5], '#e6f0ff');
  });

  icon('bell', (c) => {
    c.strokeStyle = 'rgba(255,220,130,0.8)';
    c.lineWidth = 3;
    for (const r of [8, 14]) {
      c.beginPath();
      c.arc(32, 30, 22 + r, -0.5, 0.5);
      c.stroke();
      c.beginPath();
      c.arc(32, 30, 22 + r, Math.PI - 0.5, Math.PI + 0.5);
      c.stroke();
    }
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(20, 46);
    c.bezierCurveTo(22, 34, 20, 14, 32, 12);
    c.bezierCurveTo(44, 14, 42, 34, 44, 46);
    c.closePath();
    const g = c.createLinearGradient(20, 0, 44, 0);
    g.addColorStop(0, '#8a5a1a');
    g.addColorStop(0.5, '#e8b44a');
    g.addColorStop(1, '#9a6420');
    c.fillStyle = g;
    c.fill();
    c.stroke();
    poly(c, [16, 46, 48, 46, 48, 50, 16, 50], '#b8862e', INK, 2);
    circle(c, 32, 54, 3.5, INK);
    circle(c, 32, 54, 2.4, '#e3b23c');
    poly(c, [29, 8, 35, 8, 35, 13, 29, 13], '#5a3a10', INK, 1.4);
  });

  icon('koschei', (c) => {
    glow(c, 'rgba(120,255,140,0.35)');
    const pts = [20, 10, 27, 7, 37, 7, 44, 10, 57, 24, 49, 31, 46, 26, 46, 58, 18, 58, 18, 26, 15, 31, 7, 24];
    poly(c, pts, '#3c4248', INK, 2.2);
    c.save();
    path(c, pts);
    c.clip();
    c.strokeStyle = '#6a737c';
    c.lineWidth = 1.1;
    for (let y = 8; y < 60; y += 5)
      for (let x = 6 + ((y / 5) % 2) * 2.5; x < 60; x += 5) {
        c.beginPath();
        c.arc(x, y, 2.2, 0, Math.PI * 2);
        c.stroke();
      }
    c.restore();
    // череп
    circle(c, 32, 32, 8.5, INK);
    circle(c, 32, 32, 7.2, '#e8e2cc');
    poly(c, [27, 37, 37, 37, 36, 42, 28, 42], '#e8e2cc', INK, 1.2);
    circle(c, 29, 31, 2, '#3aff6a');
    circle(c, 35, 31, 2, '#3aff6a');
  });

  icon('battlefury', (c) => {
    glow(c, 'rgba(255,70,40,0.45)');
    c.save();
    c.translate(32, 34);
    c.rotate(-0.6);
    poly(c, [-3, -26, 3, -26, 3, 28, -3, 28], '#5a3216', INK, 2);
    for (const dir of [-1, 1]) {
      c.beginPath();
      c.moveTo(dir * 2, -22);
      c.quadraticCurveTo(dir * 26, -26, dir * 22, 0);
      c.quadraticCurveTo(dir * 14, -6, dir * 2, -2);
      c.closePath();
      const g = c.createLinearGradient(0, -24, dir * 24, 0);
      g.addColorStop(0, '#c9d1d8');
      g.addColorStop(1, '#ff6a3a');
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = INK;
      c.lineWidth = 2.2;
      c.stroke();
    }
    circle(c, 0, -12, 3.5, '#e3b23c');
    c.restore();
  });

  icon('monomakh', (c) => {
    glow(c, 'rgba(255,200,80,0.45)');
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(13, 44);
    c.bezierCurveTo(12, 18, 52, 18, 51, 44);
    c.closePath();
    const g = c.createLinearGradient(13, 0, 51, 0);
    g.addColorStop(0, '#b8862e');
    g.addColorStop(0.5, '#ffe08a');
    g.addColorStop(1, '#a8761e');
    c.fillStyle = g;
    c.fill();
    c.stroke();
    c.strokeStyle = '#8a5a10';
    c.lineWidth = 1.4;
    for (const x of [22, 32, 42]) {
      c.beginPath();
      c.moveTo(x, 42);
      c.quadraticCurveTo(x + (32 - x) * 0.4, 28, 32, 20);
      c.stroke();
    }
    poly(c, [8, 42, 56, 42, 56, 54, 8, 54], '#4a3226', INK, 2.2);
    c.strokeStyle = '#6e5444';
    c.lineWidth = 1.2;
    for (let x = 11; x < 55; x += 4) {
      c.beginPath();
      c.moveTo(x, 44);
      c.lineTo(x + 1, 52);
      c.stroke();
    }
    for (const [x, col] of [[20, '#d6232a'], [32, '#2a8a4a'], [44, '#2a5ad6']] as const) {
      circle(c, x, 36, 3.6, INK);
      circle(c, x, 36, 2.6, col);
    }
    circle(c, 32, 15, 5, INK);
    circle(c, 32, 15, 3.8, '#ffe08a');
  });

  icon('feather', (c) => {
    glow(c, 'rgba(255,140,40,0.5)');
    c.save();
    c.translate(32, 34);
    c.rotate(0.55);
    c.beginPath();
    c.moveTo(0, 26);
    c.bezierCurveTo(-16, 10, -14, -18, 0, -28);
    c.bezierCurveTo(14, -18, 16, 10, 0, 26);
    const g = c.createLinearGradient(0, -28, 0, 26);
    g.addColorStop(0, '#fff3a0');
    g.addColorStop(0.4, '#ffb030');
    g.addColorStop(1, '#d63a1a');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.2;
    c.stroke();
    c.strokeStyle = '#a82a10';
    c.lineWidth = 1.6;
    for (let y = -18; y < 20; y += 6) {
      c.beginPath();
      c.moveTo(0, y + 4);
      c.lineTo(-9, y - 2);
      c.moveTo(0, y + 4);
      c.lineTo(9, y - 2);
      c.stroke();
    }
    c.strokeStyle = INK;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 30);
    c.lineTo(0, -22);
    c.stroke();
    circle(c, 0, -12, 4.5, '#2a8ad6');
    circle(c, 0, -12, 2.2, '#0a2a5a');
    c.restore();
  });

  // Сердце Тура — алое сердце с турьими рогами
  icon('heart', (c) => {
    glow(c, 'rgba(255,70,70,0.4)');
    for (const dir of [-1, 1]) {
      c.strokeStyle = INK;
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(32 + dir * 10, 22);
      c.quadraticCurveTo(32 + dir * 28, 18, 32 + dir * 24, 4);
      c.stroke();
      c.strokeStyle = '#efe6cc';
      c.lineWidth = 4;
      c.stroke();
    }
    c.beginPath();
    c.moveTo(32, 58);
    c.bezierCurveTo(6, 40, 6, 16, 22, 16);
    c.bezierCurveTo(28, 16, 32, 21, 32, 25);
    c.bezierCurveTo(32, 21, 36, 16, 42, 16);
    c.bezierCurveTo(58, 16, 58, 40, 32, 58);
    const g = c.createRadialGradient(24, 26, 2, 32, 36, 26);
    g.addColorStop(0, '#ff8a7a');
    g.addColorStop(1, '#a8160e');
    c.fillStyle = g;
    c.fill();
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.stroke();
  });

  // Камень Алатырь — бел-горюч камень с рунами
  icon('alatyr', (c) => {
    glow(c, 'rgba(255,240,180,0.55)');
    poly(c, [14, 46, 12, 28, 22, 14, 42, 12, 52, 24, 52, 44, 40, 54, 22, 54], '#efeae0', INK, 2.4);
    poly(c, [22, 16, 40, 14, 34, 24, 20, 26], '#ffffff');
    poly(c, [40, 52, 50, 44, 50, 30, 44, 40], '#c9c2b2');
    c.strokeStyle = '#e3a52c';
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(26, 28);
    c.lineTo(26, 44);
    c.moveTo(26, 32);
    c.lineTo(34, 28);
    c.moveTo(38, 30);
    c.lineTo(38, 44);
    c.lineTo(44, 40);
    c.stroke();
  });

  // Перстень Громовержца — перстень с молнией
  icon('thunderring', (c) => {
    glow(c, 'rgba(140,190,255,0.5)');
    c.strokeStyle = INK;
    c.lineWidth = 9;
    c.beginPath();
    c.ellipse(32, 40, 15, 13, 0, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#c9d1d8';
    c.lineWidth = 5.5;
    c.stroke();
    circle(c, 32, 20, 11, INK);
    circle(c, 32, 20, 9.5, '#2a5ad6');
    poly(c, [34, 11, 26, 22, 31, 22, 28, 30, 38, 18, 33, 18, 36, 11], '#fff3a0', INK, 1.2);
  });

  // Палица Ильи Муромца — огромная шипастая палица
  icon('mace', (c) => {
    glow(c, 'rgba(255,170,60,0.45)');
    c.save();
    c.translate(30, 36);
    c.rotate(-Math.PI / 4.5);
    poly(c, [-4, -4, 4, -4, 4, 30, -4, 30], '#5a3216', INK, 2);
    c.fillStyle = '#e3b23c';
    c.fillRect(-4.5, 22, 9, 3);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      poly(c, [Math.cos(a - 0.22) * 14, -16 + Math.sin(a - 0.22) * 14, Math.cos(a) * 24, -16 + Math.sin(a) * 24, Math.cos(a + 0.22) * 14, -16 + Math.sin(a + 0.22) * 14], '#c9d1d8', INK, 1.4);
    }
    circle(c, 0, -16, 16, INK);
    const g = c.createRadialGradient(-5, -21, 2, 0, -16, 15);
    g.addColorStop(0, '#f2f5f8');
    g.addColorStop(1, '#5d6670');
    circle(c, 0, -16, 14.5, g as unknown as string);
    c.restore();
  });

  icon('gusli', (c) => {
    c.strokeStyle = INK;
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(8, 46);
    c.lineTo(20, 14);
    c.quadraticCurveTo(44, 10, 56, 30);
    c.lineTo(52, 50);
    c.closePath();
    const g = c.createLinearGradient(8, 14, 56, 50);
    g.addColorStop(0, '#c8843e');
    g.addColorStop(1, '#7e4a1e');
    c.fillStyle = g;
    c.fill();
    c.stroke();
    circle(c, 34, 32, 6, '#4a2a10');
    c.strokeStyle = '#f4ecd0';
    c.lineWidth = 1.1;
    for (let i = 0; i < 6; i++) {
      c.beginPath();
      c.moveTo(14 + i * 2, 42 - i * 4.5);
      c.lineTo(50 - i * 0.5, 46 - i * 3.2);
      c.stroke();
    }
    c.fillStyle = '#e3b23c';
    for (const [x, y] of [[20, 18], [30, 15], [42, 18], [52, 30]]) circle(c, x, y, 1.8, '#e3b23c');
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.lineWidth = 2.2;
    for (const [x, y] of [[52, 10], [58, 18]]) {
      c.beginPath();
      c.arc(x, y, 3.4, 0, Math.PI * 2);
      c.moveTo(x + 3.4, y);
      c.lineTo(x + 3.4, y - 9);
      c.stroke();
    }
  });
}

export function makeTextures(scene: Phaser.Scene) {
  makeGround(scene);
  makeDecor(scene);
  makeItems(scene);
  makeIcons(scene);
  makeChestTextures(scene);
  makeItemIcons(scene);
}
