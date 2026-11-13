import Phaser from 'phaser';
import type { ZombieType } from '../config';
import { mobOrigin } from '../mobs';

/** Точки опоры кадров (между ступнями) по префиксу анимации — из meta.origins атласов (tools/build-assets.mjs). */
const origins: Record<string, [number, number]> = { m: [0.5, 0.93], f: [0.5, 0.92] };

/** Атласы нечисти, у которых в meta записаны точки опоры. */
export const ENEMY_ATLASES = ['zombies'];

export function readZombieOrigins(scene: Phaser.Scene): void {
  for (const key of ENEMY_ATLASES) {
    if (!scene.textures.exists(key)) continue;
    const data = scene.textures.get(key).customData as { meta?: { origins?: typeof origins } } | undefined;
    Object.assign(origins, data?.meta?.origins ?? {});
  }
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
  /** Состояние поведения стрелков и прыгунов. */
  aiState: 'move' | 'aim' | 'leap' = 'move';
  aiT = 0;
  aimX = 0;
  aimY = 0;
  leapHit = false;
  /** Время последнего попадания по зомби от каждого оружия (для «тикающих» атак). */
  lastHit: Record<string, number> = {};

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'zombies', 'm-walk0');
    scene.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  /** Высота фигуры в мире. */
  get figureH(): number {
    return this.ztype.figure * this.ztype.scale;
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
    this.aiState = 'move';
    this.aiT = Phaser.Math.FloatBetween(0.5, 1.5) * (t.shotCd ?? t.leapCd ?? 1);
    this.leapHit = false;
    this.lastHit = {};
    this.dead = false;
    const o = origins[t.anim] ?? mobOrigin(t.anim) ?? [0.5, 0.92];
    this.scene.tweens.killTweensOf(this);
    this.setTexture(t.tex, `${t.anim}-walk0`);
    this.setActive(true).setVisible(true).setAlpha(1).setAngle(0).setScale(t.scale).setOrigin(o[0], o[1]);
    this.restoreTint();
    const walk = this.scene.anims.get(`${t.anim}-walk`);
    this.play({ key: `${t.anim}-walk`, startFrame: Phaser.Math.Between(0, Math.max(0, (walk?.frames.length ?? 1) - 1)), timeScale: t.animRate });
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
    // у кого нет анимации смерти (Древень) — вздрагивает и тает
    const a = this.ztype.anim;
    const key = this.scene.anims.exists(`${a}-dead`) ? `${a}-dead` : `${a}-hurt`;
    if (this.scene.anims.exists(key)) this.play({ key, timeScale: 1, repeat: 0 });
    else this.stop();
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
