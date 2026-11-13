import Phaser from 'phaser';
import type { Ability, BossDef } from '../bosses';
import { mobFigure, mobOrigin } from '../mobs';
import { Dragon } from './Dragon';
import type { Enemy } from './Enemy';

/** Текущий приём босса (см. systems/Bosses.ts). */
export interface Cast {
  ab: Ability;
  i: number;
  stage: number;
  t: number;
  T: number;
  ang: number;
  x: number;
  y: number;
  pts: { x: number; y: number }[];
  hit: boolean;
  acc: number;
  waves: number;
}

/** Общее у боссов, которыми управляет systems/Bosses.ts. */
export interface BossActor extends Enemy {
  readonly def: BossDef;
  facing: number;
  /** Высота прыжка над землёй (только картинка). */
  hop: number;
  /** Под землёй или в «мгновении» — не бьют и не цепляют. */
  hidden: boolean;
  invulnT: number;
  lives: number;
  reviveT: number;
  dmgMul: number;
  hpMul: number;
  speedBuff: number;
  buffT: number;
  cds: number[];
  gcd: number;
  cast: Cast | null;
  phaseIdx: number;
  attackCd: number;
  strafe: number;
  strafeT: number;
  alpha: number;
  active: boolean;
  setAlpha(a: number): this;
  setPosition(x: number, y: number): this;
  setDepth(d: number): this;
  /** Разовая анимация (тела или наездника) на dur секунд, потом обратно к ходьбе. */
  act(name: string, dur: number, rider?: boolean): void;
  /** Свечение глаз (0..1) — Вий, Лихо. */
  glow(k: number, color: number): void;
  /** Мировая точка глаз — откуда бьёт луч. */
  eye(): { x: number; y: number };
  /** Кадр: положение картинок, тень, глубина. */
  tickVisual(dt: number, moving: boolean): void;
  restoreTint(): void;
  /** Упал, но встанет (Кощей): лежит. */
  fall(): void;
  rise(): void;
  die(onDone: () => void): void;
  destroy(): void;
}

function bossFields(def: BossDef) {
  return {
    hp: 1,
    maxHp: 1,
    dead: false,
    kbx: 0,
    kby: 0,
    slowT: 0,
    kbTired: 0,
    lastHit: {} as Record<string, number>,
    hop: 0,
    hidden: false,
    invulnT: 0,
    lives: def.lives ?? 0,
    reviveT: 0,
    dmgMul: 1,
    hpMul: 1,
    speedBuff: 1,
    buffT: 0,
    cds: def.abilities.map((a) => a.first ?? a.cd * Phaser.Math.FloatBetween(0.4, 0.8)),
    gcd: 1.2,
    cast: null as Cast | null,
    phaseIdx: 0,
    attackCd: 0,
    strafe: Math.random() < 0.5 ? -1 : 1,
    strafeT: 2,
  };
}

/** Босс на готовых спрайтах: тело + (у гибридов) наездник, тень, свечение глаз. */
export class SpriteBoss extends Phaser.GameObjects.Container implements BossActor {
  ztype: BossDef;
  hp = 1;
  maxHp = 1;
  dead = false;
  radius: number;
  kbx = 0;
  kby = 0;
  slowT = 0;
  kbTired = 0;
  lastHit: Record<string, number> = {};
  facing = 1;
  hop = 0;
  hidden = false;
  invulnT = 0;
  lives = 0;
  reviveT = 0;
  dmgMul = 1;
  hpMul = 1;
  speedBuff = 1;
  buffT = 0;
  cds: number[] = [];
  gcd = 1;
  cast: Cast | null = null;
  phaseIdx = 0;
  attackCd = 0;
  strafe = 1;
  strafeT = 2;
  readonly spr: Phaser.GameObjects.Sprite;
  readonly riderSpr: Phaser.GameObjects.Sprite | null = null;
  readonly shadow: Phaser.GameObjects.Image;
  private readonly eyeImg: Phaser.GameObjects.Image;
  private flashT = 0;
  private flashCd = 0;
  private t = Math.random() * 10;
  private actT = 0;
  private riderActT = 0;
  private lying = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly def: BossDef,
  ) {
    super(scene, x, y);
    this.ztype = def;
    Object.assign(this, bossFields(def));
    this.radius = def.radius;
    const o = mobOrigin(def.body) ?? [0.5, 0.92];
    this.spr = scene.add.sprite(0, 0, '__DEFAULT').setOrigin(o[0], o[1]);
    this.spr.setScale(def.h / mobFigure(def.body));
    this.add(this.spr);
    if (def.rider) {
      const ro = mobOrigin(def.rider.id) ?? [0.5, 0.92];
      this.riderSpr = scene.add.sprite(0, 0, '__DEFAULT').setOrigin(ro[0], ro[1]).setScale(def.rider.h / mobFigure(def.rider.id));
      this.add(this.riderSpr);
    }
    this.eyeImg = scene.add.image(0, 0, 'light_01').setBlendMode(Phaser.BlendModes.ADD).setVisible(false).setScale(0.18);
    this.add(this.eyeImg);
    this.shadow = scene.add.image(x, y, 'shadow').setScale((def.radius / 30) * 1.2, (def.radius / 30) * 0.95).setDepth(-8000);
    scene.add.existing(this);
    this.loopAnim(this.spr, def.body, 'walk');
    if (this.riderSpr && def.rider) this.loopAnim(this.riderSpr, def.rider.id, this.hasAnim(def.rider.id, 'idle') ? 'idle' : 'walk');
    this.restoreTint();
  }

  get figureH(): number {
    return this.def.h;
  }

  get flipX(): boolean {
    return this.facing < 0;
  }

  private hasAnim(id: string, name: string): boolean {
    return this.scene.anims.exists(`${id}-${name}`);
  }

  private loopAnim(spr: Phaser.GameObjects.Sprite, id: string, name: string): void {
    const key = `${id}-${name}`;
    if (!this.scene.anims.exists(key)) return;
    if (spr.anims.currentAnim?.key === key && spr.anims.isPlaying) return;
    spr.play({ key, repeat: -1 });
  }

  act(name: string, dur: number, rider = false): void {
    const spr = rider && this.riderSpr ? this.riderSpr : this.spr;
    const id = rider && this.def.rider ? this.def.rider.id : this.def.body;
    const pick = [name, 'attack', 'walk'].find((n) => this.hasAnim(id, n));
    if (!pick) return;
    const anim = this.scene.anims.get(`${id}-${pick}`);
    const frames = anim?.frames.length ?? 8;
    // растягиваем анимацию на время приёма (но не медленнее 6 кадров/с)
    const rate = Phaser.Math.Clamp(frames / Math.max(0.2, dur), 6, 30);
    spr.anims.timeScale = 1;
    spr.play({ key: `${id}-${pick}`, repeat: 0, frameRate: rate });
    if (rider) this.riderActT = dur;
    else this.actT = dur;
  }

  glow(k: number, color: number): void {
    if (k <= 0) {
      this.eyeImg.setVisible(false);
      return;
    }
    const [ex, ey] = this.def.eye ?? [0.1, 0.75];
    this.eyeImg
      .setVisible(true)
      .setTint(color)
      .setPosition(ex * this.def.h * 0.5 * this.facing, -this.def.h * ey - this.hop)
      .setScale(0.08 + 0.22 * k, 0.05 + 0.12 * k)
      .setAlpha(0.4 + 0.6 * k);
  }

  eye(): { x: number; y: number } {
    const [ex, ey] = this.def.eye ?? [0.1, 0.75];
    return { x: this.x + ex * this.def.h * 0.5 * this.facing, y: this.y - this.def.h * ey - this.hop };
  }

  restoreTint(): void {
    if (this.def.tint !== undefined) this.spr.setTint(this.def.tint).setTintMode(Phaser.TintModes.MULTIPLY);
    else this.spr.clearTint();
    if (this.riderSpr) {
      if (this.def.rider?.tint !== undefined) this.riderSpr.setTint(this.def.rider.tint).setTintMode(Phaser.TintModes.MULTIPLY);
      else this.riderSpr.clearTint();
    }
  }

  flash(): void {
    if (this.flashCd > 0 || this.invulnT > 0) return;
    this.flashCd = 0.18;
    this.flashT = 0.07;
    this.spr.setTint(0xffb4a8).setTintMode(Phaser.TintModes.MULTIPLY);
    this.riderSpr?.setTint(0xffb4a8).setTintMode(Phaser.TintModes.MULTIPLY);
  }

  tickVisual(dt: number, moving: boolean): void {
    this.t += dt;
    this.flashCd -= dt;
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.restoreTint();
    }
    const flip = this.facing < 0;
    const bob = this.def.float ? Math.sin(this.t * 2.4) * 5 + 8 : 0;
    this.spr.setFlipX(flip).setY(-this.hop - bob);
    // разовая анимация закончилась — обратно к ходьбе (или стоянию)
    if (!this.lying) {
      this.actT -= dt;
      if (this.actT <= 0) {
        this.loopAnim(this.spr, this.def.body, moving || !this.hasAnim(this.def.body, 'idle') ? 'walk' : 'idle');
      }
      if (this.actT <= 0 && this.spr.anims.currentAnim?.key === `${this.def.body}-walk`) this.spr.anims.timeScale = moving ? 1 : 0.35;
    }
    if (this.riderSpr && this.def.rider) {
      const r = this.def.rider;
      // наездник покачивается в такт шагам тела
      const sway = moving ? Math.sin(this.t * 9) * 2.5 : Math.sin(this.t * 2) * 1.2;
      this.riderSpr
        .setFlipX(flip)
        .setPosition(r.dx * this.def.h * this.facing, -this.def.h * r.dy - this.hop - bob + sway)
        .setVisible(!this.lying);
      this.riderActT -= dt;
      if (this.riderActT <= 0) {
        this.loopAnim(this.riderSpr, r.id, this.hasAnim(r.id, 'idle') ? 'idle' : 'walk');
      }
    }
    this.setDepth(this.y);
    this.shadow
      .setPosition(this.x, this.y - 1)
      .setAlpha(this.alpha * (this.hop > 0 ? Math.max(0.35, 1 - this.hop / 160) : 1))
      .setScale((this.def.radius / 30) * 1.2 * (1 - Math.min(0.4, this.hop / 300)), (this.def.radius / 30) * 0.95 * (1 - Math.min(0.4, this.hop / 300)));
  }

  fall(): void {
    this.lying = true;
    const dead = this.hasAnim(this.def.body, 'dead') ? 'dead' : 'hurt';
    if (this.hasAnim(this.def.body, dead)) this.spr.play({ key: `${this.def.body}-${dead}`, repeat: 0 });
  }

  rise(): void {
    this.lying = false;
    const dead = this.hasAnim(this.def.body, 'dead') ? 'dead' : 'hurt';
    if (this.hasAnim(this.def.body, dead)) this.spr.playReverse({ key: `${this.def.body}-${dead}`, repeat: 0 });
    this.actT = 0.6;
  }

  die(onDone: () => void): void {
    this.dead = true;
    this.lying = true;
    this.cast = null;
    this.restoreTint();
    this.eyeImg.setVisible(false);
    const dead = this.hasAnim(this.def.body, 'dead') ? 'dead' : 'hurt';
    if (this.hasAnim(this.def.body, dead)) this.spr.play({ key: `${this.def.body}-${dead}`, repeat: 0 });
    if (this.riderSpr && this.def.rider) {
      // наездник слетает со спины
      const rs = this.riderSpr;
      this.scene.tweens.add({ targets: rs, x: rs.x - 60 * this.facing, y: rs.y + this.def.h * this.def.rider.dy * 0.8, angle: -80 * this.facing, duration: 600, ease: 'Quad.easeIn' });
    }
    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 1400 });
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      delay: 900,
      duration: 800,
      onComplete: () => {
        this.shadow.destroy();
        this.destroy();
        onDone();
      },
    });
  }
}

/** Ящер — векторный змей с одной головой и без крыльев, ползает и ныряет под землю. */
export class Yascher extends Dragon implements BossActor {
  declare ztype: BossDef;
  hop = 0;
  hidden = false;
  invulnT = 0;
  lives = 0;
  reviveT = 0;
  dmgMul = 1;
  hpMul = 1;
  speedBuff = 1;
  buffT = 0;
  cds: number[] = [];
  gcd = 1;
  cast: Cast | null = null;
  phaseIdx = 0;
  strafe = 1;
  strafeT = 2;
  private actT = 0;
  private readonly yShadow: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly def: BossDef,
  ) {
    super(scene, x, y, false, { heads: 1, wings: false, tint: 0xe08a62, scale: 1.1 });
    this.ztype = def;
    Object.assign(this, bossFields(def));
    this.radius = def.radius;
    this.fireHead = 1;
    this.yShadow = scene.add.image(x, y, 'shadow').setScale(3.2, 1.6).setDepth(-8000);
  }

  get figureH(): number {
    return this.def.h;
  }

  act(name: string, dur: number): void {
    // «атака» — голова тянется к богатырю, как при прицеле огнём
    if (name === 'attack' || name === 'bite') {
      this.fireState = 'aim';
      this.actT = dur;
    }
  }

  glow(): void {}

  eye(): { x: number; y: number } {
    return this.mouth(1);
  }

  tickVisual(dt: number): void {
    this.actT -= dt;
    if (this.actT <= 0 && this.fireState === 'aim') {
      this.fireState = 'idle';
      this.endAim();
    }
    this.animate(dt);
    this.setDepth(this.y);
    this.yShadow.setPosition(this.x, this.y - 1).setAlpha(this.alpha);
  }

  fall(): void {}
  rise(): void {}

  die(onDone: () => void): void {
    this.yShadow.destroy();
    super.die(onDone);
  }
}
