import Phaser from 'phaser';
import type { ZombieType } from '../config';

/** Высота фигуры в пикселях атласа (без масштаба) — для цифр урона и эффектов. */
const FIGURE_H: Record<ZombieType['sprite'], number> = { m: 155, f: 165 };

/** Точки опоры кадров атласа (между ступнями) — пишет tools/build-assets.mjs в meta.origins. */
let origins: Record<string, [number, number]> = { m: [0.5, 0.93], f: [0.5, 0.92] };

export function readZombieOrigins(scene: Phaser.Scene): void {
  const data = scene.textures.get('zombies').customData as { meta?: { origins?: typeof origins } } | undefined;
  const meta = data?.meta;
  if (meta?.origins) origins = meta.origins;
}

/** Зомби. Двигает и сталкивает их GameScene (централизованно, ради производительности). */
export class Zombie extends Phaser.GameObjects.Sprite {
  ztype!: ZombieType;
  hp = 0;
  maxHp = 0;
  /** true — в пуле или проигрывает смерть (не участвует в бою). */
  dead = true;
  radius = 15;
  speed = 40;
  damage = 5;
  kbx = 0;
  kby = 0;
  attackCd = 0;
  flashT = 0;
  slowT = 0;
  kbTired = 0;
  touching = false;
  /** Время последнего попадания по зомби от каждого оружия (для «тикающих» атак). */
  lastHit: Record<string, number> = {};

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'zombies', 'm-walk0');
    scene.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  /** Высота фигуры в мире. */
  get figureH(): number {
    return FIGURE_H[this.ztype.sprite] * this.ztype.scale;
  }

  spawn(t: ZombieType, x: number, y: number, hpMul: number): this {
    this.ztype = t;
    this.setPosition(x, y);
    this.hp = this.maxHp = Math.max(1, Math.round(t.hp * hpMul));
    this.radius = t.radius;
    this.speed = t.speed * Phaser.Math.FloatBetween(0.88, 1.12);
    this.damage = t.damage;
    this.kbx = this.kby = 0;
    this.attackCd = 0.4;
    this.flashT = 0;
    this.slowT = 0;
    this.kbTired = 0;
    this.touching = false;
    this.lastHit = {};
    this.dead = false;
    const o = origins[t.sprite];
    this.scene.tweens.killTweensOf(this);
    this.setActive(true).setVisible(true).setAlpha(1).setAngle(0).setScale(t.scale).setOrigin(o[0], o[1]);
    this.restoreTint();
    this.play({ key: `${t.sprite}-walk`, startFrame: Phaser.Math.Between(0, 9), timeScale: t.animRate });
    return this;
  }

  restoreTint(): void {
    this.setTint(this.ztype.tint).setTintMode(Phaser.TintModes.MULTIPLY);
  }

  flash(): void {
    this.flashT = 0.08;
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
  }

  /** Анимация падения, потом тело тает и объект возвращается в пул. */
  die(): void {
    this.dead = true;
    this.restoreTint();
    this.play({ key: `${this.ztype.sprite}-dead`, timeScale: 1 });
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      delay: 650,
      duration: 380,
      ease: 'Quad.easeIn',
      onComplete: () => this.setActive(false).setVisible(false),
    });
  }
}
