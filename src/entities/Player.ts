import Phaser from 'phaser';
import { HERO_SCALE, PLAYER_BASE } from '../config';
import { HERO_UNITS_TALL, HeroRig } from './HeroRig';

export interface Stats {
  maxHp: number;
  speed: number;
  /** Доля снижения входящего урона (0..0.6). */
  armor: number;
  /** Множитель урона. */
  might: number;
  /** Множитель перезарядки (меньше — чаще). */
  haste: number;
  /** Множитель дальности/радиуса ударов. */
  area: number;
  pickupRadius: number;
  /** Доля урона, возвращаемая лечением. */
  lifesteal: number;
  /** Лечение в секунду. */
  regen: number;
  /** Шанс богатырской затрещины (крита) и её множитель. */
  critChance: number;
  critMul: number;
  /** Круговерть: шанс, урон, радиус (0 — нет умения). */
  helixChance: number;
  helixDmg: number;
  helixRadius: number;
  /** Шанс полностью отразить удар щитом. */
  blockChance: number;
  /** Множитель получаемого опыта. */
  xpMul: number;
  /** Доля урона, которая задевает всех рядом с целью (Секира Ярой сечи). */
  cleave: number;
  /** Во сколько раз урон удара возвращается ударившему (Ежовые рукавицы). */
  thorns: number;
  /** Шанс, что удар нечисти пройдёт мимо (Шапка-невидимка). */
  evasion: number;
  /** Радиус ауры замедления (Гусли-самогуды), 0 — нет. */
  slowAura: number;
}

export function baseStats(): Stats {
  return {
    maxHp: PLAYER_BASE.maxHp,
    speed: PLAYER_BASE.speed,
    armor: 0,
    might: 1,
    haste: 1,
    area: 1,
    pickupRadius: PLAYER_BASE.pickupRadius,
    lifesteal: 0,
    regen: 0,
    critChance: 0,
    critMul: 2,
    helixChance: 0,
    helixDmg: 0,
    helixRadius: 0,
    blockChance: 0,
    xpMul: 1,
    cleave: 0,
    thorns: 0,
    evasion: 0,
    slowAura: 0,
  };
}

/** Богатырь. Координаты (x, y) — точка у ног на «земле». */
export class Player extends HeroRig {
  stats: Stats = baseStats();
  hp: number = PLAYER_BASE.maxHp;
  aimX = 1;
  aimY = 0;
  moving = false;
  dead = false;
  readonly shadow: Phaser.GameObjects.Image;
  private attackT = 0;
  private hurtCd = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, HERO_SCALE);
    this.shadow = scene.add.image(x, y, 'shadow').setScale(0.62, 0.55).setDepth(-8000);
  }

  /** Центр туловища — для эффектов. */
  get bodyY(): number {
    return this.y - HERO_UNITS_TALL * HERO_SCALE * 0.45;
  }

  /** Высота макушки над точкой ног. */
  get tall(): number {
    return HERO_UNITS_TALL * HERO_SCALE;
  }

  setStats(s: Stats): void {
    const prevMax = this.stats.maxHp;
    this.stats = s;
    if (s.maxHp > prevMax) this.hp += s.maxHp - prevMax;
    this.hp = Math.min(this.hp, s.maxHp);
  }

  /** Возвращает, сколько здоровья реально восстановила регенерация. */
  tick(dt: number, ix: number, iy: number): number {
    if (this.dead) return 0;
    const len = Math.hypot(ix, iy);
    this.moving = len > 0.08;
    if (this.moving) {
      const k = Math.min(1, len);
      this.x += (ix / len) * k * this.stats.speed * dt;
      this.y += (iy / len) * k * this.stats.speed * dt;
      this.aimX = ix / len;
      this.aimY = iy / len;
      if (Math.abs(ix) > 0.12 && this.attackT <= 0) this.facing = ix > 0 ? 1 : -1;
    }

    const healed = this.stats.regen > 0 ? this.heal(this.stats.regen * dt) : 0;

    this.attackT -= dt;
    this.hurtCd -= dt;
    this.animate(dt, this.moving, this.stats.speed / PLAYER_BASE.speed);
    this.setDepth(this.y);
    this.shadow.setPosition(this.x, this.y - 1);
    return healed;
  }

  attackAnim(dirX: number, kind: 'chop' | 'thrust' = 'chop'): void {
    if (this.dead) return;
    this.attackT = 0.22;
    if (Math.abs(dirX) > 0.05) this.facing = dirX > 0 ? 1 : -1;
    this.attack(kind);
  }

  /** Возвращает фактический урон (0 — если неуязвим). */
  takeDamage(raw: number): number {
    if (this.dead || this.hurtCd > 0) return 0;
    const dmg = Math.max(1, Math.round(raw * (1 - Math.min(0.75, this.stats.armor))));
    this.hp -= dmg;
    // неуязвимость после удара: толпа не может «разорвать» за долю секунды
    this.hurtCd = 0.4;
    this.flash(0xff6a6a, 0.15);
    return dmg;
  }

  heal(amount: number): number {
    if (this.dead) return 0;
    const before = this.hp;
    this.hp = Math.min(this.stats.maxHp, this.hp + amount);
    return this.hp - before;
  }

  die(): void {
    this.dead = true;
    this.moving = false;
    this.restoreTint();
    this.scene.tweens.add({ targets: this, angle: -78 * this.facing, duration: 520, ease: 'Bounce.easeOut' });
  }

  revive(): void {
    this.dead = false;
    this.scene.tweens.killTweensOf(this);
    this.setAngle(0);
    this.hp = this.stats.maxHp;
    this.hurtCd = 1.5;
  }
}
