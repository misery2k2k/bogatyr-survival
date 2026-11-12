import Phaser from 'phaser';
import type { Enemy, EnemyKind } from './Enemy';
import { HERO_UNITS_TALL, HeroRig, TUGARIN_SKIN } from './HeroRig';

export const TUGARIN = {
  key: 'tugarin',
  name: 'Тугарин Змеевич',
  hp: 1300,
  speed: 64,
  /** Урон вплотную, сабельным взмахом и рывком (умножается на силу нечисти). */
  contactDmg: 14,
  slashDmg: 30,
  dashDmg: 34,
  xp: 50,
  /** Единицы скелета → мир: ≈ 177 px, в 1.6 раза выше богатыря. */
  scale: 0.66,
  radius: 40,
  knockbackResist: 0.92,
  slashRadius: 175,
  /** Ширина сектора взмаха, рад (~150°). */
  slashArc: 2.6,
  slashCd: 2.6,
  slashWindup: 0.6,
  dashMin: 230,
  dashMax: 560,
  dashCd: 5.5,
  dashAim: 0.75,
  dashSpeed: 660,
} satisfies EnemyKind & Record<string, number | string>;

export type TugarinState = 'walk' | 'slashAim' | 'dashAim' | 'dash' | 'recover';

/**
 * Тугарин Змеевич — босс-богатырь из былины про Алёшу Поповича.
 * Тот же скелет, что у героя, но своя «шкура»: змеиная морда, рогатый шлем, сабля, бумажные крылья.
 * Поведение (рывок, взмах) — в GameScene.updateTugarins.
 */
export class Tugarin extends HeroRig implements Enemy {
  ztype: EnemyKind = TUGARIN;
  hp = 1;
  maxHp = 1;
  dead = false;
  radius = TUGARIN.radius;
  kbx = 0;
  kby = 0;
  slowT = 0;
  kbTired = 0;
  lastHit: Record<string, number> = {};
  /** Множитель урона нечисти на момент появления. */
  dmgMul = 1;

  tstate: TugarinState = 'walk';
  stateT = 0;
  aimAng = 0;
  dashTx = 0;
  dashTy = 0;
  dashHit = false;
  swung = false;
  slashCd = 1.5;
  dashCd = 2.5;
  attackCd = 0;
  flashCd = 0;
  readonly shadow: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, TUGARIN.scale, TUGARIN_SKIN);
    this.shadow = scene.add.image(x, y, 'shadow').setScale(1.05, 0.85).setDepth(-8000);
  }

  get figureH(): number {
    return HERO_UNITS_TALL * TUGARIN.scale;
  }

  get flipX(): boolean {
    return this.facing < 0;
  }

  /** Отблеск попадания — красноватый и не чаще раза в 0.15 с. */
  flash(color = 0xff9a8a, time = 0.06): void {
    if (this.flashCd > 0) return;
    this.flashCd = 0.15;
    super.flash(color, time);
  }

  die(onDone: () => void): void {
    this.dead = true;
    this.restoreTint();
    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 900 });
    this.scene.tweens.add({
      targets: this,
      angle: -80 * this.facing,
      alpha: 0,
      duration: 1000,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.shadow.destroy();
        this.destroy();
        onDone();
      },
    });
  }
}
