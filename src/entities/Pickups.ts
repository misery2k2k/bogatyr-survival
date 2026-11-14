import Phaser from 'phaser';
import { TEX_RES } from '../config';

class Pie extends Phaser.GameObjects.Image {
  /** Сколько процентов здоровья лечит. */
  value = 25;
  /** Тёплое свечение под пирожком — чтобы его было видно в траве и в толпе. */
  glow: Phaser.GameObjects.Image | null = null;
  magnet = false;
  vel = 0;
  bob = 0;
}

const MAX_PIES = 30;
const SCALE = 1.2 / TEX_RES;

/**
 * Пирожки, которые иногда роняет Кощеев ратник. Опыт теперь начисляется сразу за убийство,
 * поэтому подбираются только они. Притягиваются к богатырю в радиусе сбора.
 */
export class Pickups {
  private items: Pie[] = [];
  /** Вызывается при каждом новом пирожке (GameScene подписывает первый для новичков). */
  onSpawn: ((pie: Phaser.GameObjects.Image) => void) | null = null;

  /** Сколько пирожков лежит на земле. */
  get count(): number {
    let n = 0;
    for (const p of this.items) if (p.active) n++;
    return n;
  }

  constructor(private readonly scene: Phaser.Scene) {}

  spawn(x: number, y: number, value: number): void {
    let p = this.items.find((i) => !i.active);
    if (!p) {
      if (this.items.length >= MAX_PIES) return;
      p = new Pie(this.scene, 0, 0, 'pie');
      this.scene.add.existing(p);
      p.glow = this.scene.add.image(0, 0, 'circle_05').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffc860);
      this.items.push(p);
    }
    p.value = value;
    p.magnet = false;
    p.vel = 0;
    p.bob = Math.random() * Math.PI * 2;
    p.setOrigin(0.5, 1).setPosition(x, y).setActive(true).setVisible(true).setScale(0.2 * SCALE).setAlpha(1).setDepth(y - 30);
    this.scene.tweens.add({ targets: p, scale: SCALE, duration: 180, ease: 'Back.easeOut' });
    p.glow?.setActive(true).setVisible(true).setPosition(x, y - 6).setDepth(y - 31);
    this.onSpawn?.(p);
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
          p.glow?.setActive(false).setVisible(false);
          continue;
        }
        p.x += (dx / d) * p.vel * dt;
        p.y += (dy / d) * p.vel * dt;
      } else {
        p.bob += dt * 4;
      }
      p.setDepth(p.y - 30);
      // мерцает тёплым светом, пока лежит
      p.glow?.setPosition(p.x, p.y - 6).setDepth(p.y - 31).setScale(0.13 + Math.sin(p.bob * 0.8) * 0.02, 0.07 + Math.sin(p.bob * 0.8) * 0.01).setAlpha(p.magnet ? 0.3 : 0.6);
      if (!this.scene.tweens.isTweening(p)) p.setScale(SCALE * (1 + Math.sin(p.bob) * 0.06), SCALE * (1 - Math.sin(p.bob) * 0.06));
    }
    return heal;
  }
}
