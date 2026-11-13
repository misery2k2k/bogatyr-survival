import Phaser from 'phaser';
import { TEX_RES } from '../config';
import { mulberry32 } from '../textures';

const CHUNK = 640;

export interface DecorKind {
  key: string;
  /** Кадр атласа (готовый декор глав лежит в атласе 'decor'). */
  frame?: string;
  /** Пикселей текстуры на мировой пиксель (процедурные рисуются в TEX_RES, готовые спрайты — как есть). */
  res?: number;
  /** Оттенок (умножение) — чтобы перекрасить готовый объект под настроение главы. */
  tint?: number;
  min: number;
  max: number;
  /** Лежит на земле (рисуется под всеми) или стоит (сортируется по y). */
  flat: boolean;
  scale: [number, number];
  /** Вероятность, что объект вообще появится в чанке. */
  chance?: number;
}

/** Лес первой главы. */
export const FOREST_DECOR: DecorKind[] = [
  { key: 'tuft', min: 5, max: 9, flat: true, scale: [0.8, 1.2] },
  { key: 'flowers', min: 1, max: 4, flat: true, scale: [0.8, 1.1] },
  { key: 'mushroom', min: 0, max: 2, flat: false, scale: [0.9, 1.2] },
  { key: 'stone', min: 0, max: 2, flat: false, scale: [0.7, 1.2] },
  { key: 'stump', min: 0, max: 1, flat: false, scale: [0.9, 1.1] },
  { key: 'bush', min: 1, max: 3, flat: false, scale: [0.8, 1.2] },
  { key: 'birch', min: 0, max: 3, flat: false, scale: [0.85, 1.15] },
  { key: 'fir', min: 0, max: 2, flat: false, scale: [0.8, 1.15] },
  { key: 'log', min: 0, max: 1, flat: false, scale: [0.8, 1.1] },
  { key: 'haystack', min: 0, max: 1, flat: false, scale: [0.8, 1.05], chance: 0.35 },
  { key: 'fence', min: 0, max: 1, flat: false, scale: [0.9, 1.1], chance: 0.4 },
  { key: 'signstone', min: 0, max: 1, flat: false, scale: [0.9, 1.1], chance: 0.12 },
];

/** Бесконечный лес вокруг: декор генерируется чанками по сиду и удаляется вдали от камеры. */
export class Decor {
  private chunks = new Map<string, Phaser.GameObjects.Image[]>();
  private kinds: DecorKind[] = FOREST_DECOR;
  /** Поляна без крупных объектов (вокруг точки старта или места перехода в новую главу). */
  private clearX = 0;
  private clearY = 0;
  /** Сид меняется вместе с главой, чтобы новые места не повторяли старые. */
  private seed = 0x5bd1e995;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Сменить набор декора (новая глава): старые чанки убираются, новые строятся вокруг. */
  setKinds(kinds: DecorKind[], clearX: number, clearY: number, seed: number): void {
    for (const imgs of this.chunks.values()) for (const im of imgs) im.destroy();
    this.chunks.clear();
    this.kinds = kinds;
    this.clearX = clearX;
    this.clearY = clearY;
    this.seed = seed;
  }

  update(view: Phaser.Geom.Rectangle): void {
    const m = CHUNK * 0.5;
    const x0 = Math.floor((view.x - m) / CHUNK), x1 = Math.floor((view.right + m) / CHUNK);
    const y0 = Math.floor((view.y - m) / CHUNK), y1 = Math.floor((view.bottom + m) / CHUNK);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = `${cx},${cy}`;
        if (!this.chunks.has(k)) this.chunks.set(k, this.build(cx, cy));
      }
    }
    for (const [k, imgs] of this.chunks) {
      const [cx, cy] = k.split(',').map(Number);
      if (cx < x0 - 1 || cx > x1 + 1 || cy < y0 - 1 || cy > y1 + 1) {
        for (const im of imgs) im.destroy();
        this.chunks.delete(k);
      }
    }
  }

  private build(cx: number, cy: number): Phaser.GameObjects.Image[] {
    const rnd = mulberry32((cx * 73856093) ^ (cy * 19349663) ^ this.seed);
    const out: Phaser.GameObjects.Image[] = [];
    for (const kind of this.kinds) {
      const roll = rnd();
      if (!this.scene.textures.exists(kind.key)) continue;
      const n = kind.chance !== undefined && roll > kind.chance ? 0 : kind.min + Math.floor(rnd() * (kind.max - kind.min + 1));
      for (let i = 0; i < n; i++) {
        const x = (cx + rnd()) * CHUNK, y = (cy + rnd()) * CHUNK;
        // Поляна в точке старта — без крупных объектов
        if (!kind.flat && Math.hypot(x - this.clearX, y - this.clearY) < 260) continue;
        const s = (kind.scale[0] + rnd() * (kind.scale[1] - kind.scale[0])) / (kind.res ?? TEX_RES);
        const im = this.scene.add
          .image(x, y, kind.key, kind.frame)
          .setOrigin(0.5, kind.flat ? 0.5 : 0.96)
          .setScale(rnd() < 0.5 ? -s : s, s)
          .setDepth(kind.flat ? -9000 + y * 0.001 : y);
        if (kind.tint !== undefined) im.setTint(kind.tint);
        out.push(im);
      }
    }
    return out;
  }
}
