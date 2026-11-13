import Phaser from 'phaser';
import { TEX_RES } from '../config';

/** Вражеский снаряд: стрела лучника, огненный шар и т.п. Летит по прямой, бьёт богатыря при касании. */
interface Shot {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  radius: number;
  /** Высота полёта над землёй (картинка рисуется выше точки попадания). */
  lift: number;
  spin: number;
  trail: number;
  /** Богатырский снаряд босса: доля здоровья богатыря (0 — обычный). */
  pct: number;
}

export interface ShotOpts {
  key?: string;
  speed?: number;
  damage: number;
  radius?: number;
  life?: number;
  tint?: number;
  scale?: number;
  spin?: number;
  /** Цвет следа (0 — без следа). */
  trail?: number;
  /** Снаряд босса: щитом не отбить, урон не меньше этой доли здоровья богатыря. */
  pct?: number;
}

/**
 * Вражеские снаряды. Попадание проверяет сам — по точке «на земле» под снарядом и ногам богатыря,
 * чтобы уворот читался так же, как от врагов ближнего боя.
 */
export class Projectiles {
  private shots: Shot[] = [];
  private pool: Phaser.GameObjects.Image[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onHit: (damage: number, pct: number) => boolean,
    private readonly onTrail: (x: number, y: number, tint: number) => void,
  ) {}

  /** Выстрел из (x, y) — точки на земле — в сторону (tx, ty). */
  fire(x: number, y: number, tx: number, ty: number, o: ShotOpts): void {
    const speed = o.speed ?? 380;
    const a = Math.atan2(ty - y, tx - x);
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, o.key ?? 'arrow');
    img
      .setTexture(o.key ?? 'arrow')
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setScale((o.scale ?? 1) / TEX_RES)
      .setRotation(a)
      .clearTint();
    if (o.tint !== undefined) img.setTint(o.tint);
    this.shots.push({
      img,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: o.life ?? 2.2,
      damage: o.damage,
      radius: o.radius ?? 16,
      lift: 34,
      spin: o.spin ?? 0,
      trail: o.trail ?? 0,
      pct: o.pct ?? 0,
    });
    this.place(this.shots[this.shots.length - 1], x, y);
  }

  private place(s: Shot, x: number, y: number): void {
    s.img.setData('gx', x).setData('gy', y);
    s.img.setPosition(x, y - s.lift).setDepth(y + 30);
  }

  /** px, py — ноги богатыря; hitR — его радиус. */
  update(dt: number, px: number, py: number, hitR: number, active: boolean): void {
    for (const s of this.shots) {
      let gx = s.img.getData('gx') as number, gy = s.img.getData('gy') as number;
      gx += s.vx * dt;
      gy += s.vy * dt;
      s.life -= dt;
      if (s.spin) s.img.rotation += s.spin * dt;
      this.place(s, gx, gy);
      if (s.trail && Math.random() < 0.5) this.onTrail(gx, gy - s.lift, s.trail);
      if (active && s.life > 0 && Math.hypot(gx - px, gy - py) < s.radius + hitR) {
        if (this.onHit(s.damage, s.pct)) s.life = 0;
      }
    }
    for (const s of this.shots) {
      if (s.life <= 0) {
        s.img.setActive(false).setVisible(false);
        this.pool.push(s.img);
      }
    }
    this.shots = this.shots.filter((s) => s.life > 0);
  }

  clear(): void {
    for (const s of this.shots) s.img.destroy();
    for (const i of this.pool) i.destroy();
    this.shots = [];
    this.pool = [];
  }
}
