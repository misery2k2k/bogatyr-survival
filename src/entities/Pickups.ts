import Phaser from 'phaser';
import { TEX_RES } from '../config';

class Pie extends Phaser.GameObjects.Image {
  /** Сколько процентов здоровья лечит. */
  value = 25;
  magnet = false;
  vel = 0;
  bob = 0;
}

const MAX_PIES = 30;
const SCALE = 1 / TEX_RES;

/**
 * Пирожки, которые иногда роняет Кощеев ратник. Опыт теперь начисляется сразу за убийство,
 * поэтому подбираются только они. Притягиваются к богатырю в радиусе сбора.
 */
export class Pickups {
  private items: Pie[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  spawn(x: number, y: number, value: number): void {
    let p = this.items.find((i) => !i.active);
    if (!p) {
      if (this.items.length >= MAX_PIES) return;
      p = new Pie(this.scene, 0, 0, 'pie');
      this.scene.add.existing(p);
      this.items.push(p);
    }
    p.value = value;
    p.magnet = false;
    p.vel = 0;
    p.bob = Math.random() * Math.PI * 2;
    p.setOrigin(0.5, 1).setPosition(x, y).setActive(true).setVisible(true).setScale(0.2 * SCALE).setAlpha(1).setDepth(y - 30);
    this.scene.tweens.add({ targets: p, scale: SCALE, duration: 180, ease: 'Back.easeOut' });
  }

  /** Возвращает суммарный процент лечения от подобранных пирожков. */
  update(dt: number, px: number, py: number, radius: number): number {
    let heal = 0;
    const r2 = radius * radius;
    for (const p of this.items) {
      if (!p.active) continue;
      const dx = px - p.x, dy = py - p.y;
      const d2 = dx * dx + dy * dy;
      if (!p.magnet && d2 < r2) p.magnet = true;
      if (p.magnet) {
        p.vel = Math.min(900, p.vel + 1400 * dt);
        const d = Math.sqrt(d2) || 1;
        if (d < 16 + p.vel * dt) {
          heal += p.value;
          p.setActive(false).setVisible(false);
          continue;
        }
        p.x += (dx / d) * p.vel * dt;
        p.y += (dy / d) * p.vel * dt;
      } else {
        p.bob += dt * 4;
      }
      p.setDepth(p.y - 30);
      if (!this.scene.tweens.isTweening(p)) p.setScale(SCALE * (1 + Math.sin(p.bob) * 0.06), SCALE * (1 - Math.sin(p.bob) * 0.06));
    }
    return heal;
  }
}
