import Phaser from 'phaser';
import type { Enemy, EnemyKind } from './Enemy';
import { HeroRig, TUGARIN_SKIN } from './HeroRig';

/** Детали змея: viewBox SVG (0,0 — шарнир). BootScene пакует их в текстуру 'dragon'. */
export const DRAGON_PARTS = {
  body: [-166, -186, 262, 194],
  neck: [-34, -150, 124, 160],
  wing: [-156, -128, 168, 146],
} as const;
export type DragonPart = keyof typeof DRAGON_PARTS;

export const dragonTex = { res: 1 };

export const DRAGON = {
  key: 'dragon',
  name: 'Змей Горыныч',
  hp: 900,
  speed: 36,
  damage: 24,
  xp: 45,
  /** Единицы SVG → мир. Рост ≈ 270 × 0.78 ≈ 210 px — вдвое выше богатыря. */
  scale: 0.78,
  radius: 62,
  knockbackResist: 0.95,
  /** Огонь: урон за тик (0.2 с), дальность, полуугол конуса, перезарядка. */
  fireDmg: 7,
  fireRange: 300,
  fireHalfAngle: 0.36,
  fireCd: 4.2,
  /** Огненное кольцо вокруг себя, если богатырь подошёл вплотную. */
  ringRadius: 190,
  ringDmg: 22,
} satisfies EnemyKind & Record<string, number | string>;

const RAD = Phaser.Math.DegToRad;

/** Шеи: точка крепления на туловище и базовый наклон (0 — вверх). Порядок: задняя, средняя, передняя. */
const NECKS = [
  { root: [26, -158], base: -42, tint: 0xa9b4a0 },
  { root: [44, -150], base: -14, tint: 0xffffff },
  { root: [60, -136], base: 16, tint: 0xffffff },
];
/** Пасть в координатах шеи. */
const MOUTH = [76, -100];
const SHOULDER = [-6, -140];

type Img = Phaser.GameObjects.Image;

export class Dragon extends Phaser.GameObjects.Container implements Enemy {
  ztype: EnemyKind = DRAGON;
  hp = 1;
  maxHp = 1;
  dead = false;
  radius = DRAGON.radius;
  speed = DRAGON.speed;
  damage = DRAGON.damage;
  kbx = 0;
  kby = 0;
  slowT = 0;
  kbTired = 0;
  attackCd = 0;
  lastHit: Record<string, number> = {};
  facing = 1;

  /** Огненное дыхание: прицел → выдох. */
  fireState: 'idle' | 'aim' | 'breath' | 'ringAim' | 'ring' = 'idle';
  /** Развернулся во время прицела — прицел сразу на богатыря. */
  turned = false;
  fireT = 2.5;
  fireHead = 1;
  fireAng = 0;
  fireTick = 0;
  fireEmit = 0;

  private t = Math.random() * 10;
  private flashT = 0;
  private flashCd = 0;
  private aimBlend = 0;
  private readonly necks: Img[] = [];
  private readonly wingB: Img;
  private readonly wingF: Img;
  private readonly torso: Img;
  /** Тугаро-Горыныч: змей крупнее, темнее, с Тугарином на спине и огненным дождём. */
  readonly fused: boolean;
  readonly baseScale: number;
  /** Тугарин-наездник (только у Тугаро-Горыныча). */
  rider: HeroRig | null = null;
  /** Перезарядка огненного дождя (у Тугаро-Горыныча). */
  rainT = 4;
  private readonly bodyTint: number;

  constructor(scene: Phaser.Scene, x: number, y: number, fused = false) {
    super(scene, x, y);
    this.fused = fused;
    this.baseScale = DRAGON.scale * (fused ? 1.22 : 1);
    this.bodyTint = fused ? 0xc8949a : 0xffffff;
    if (fused) this.ztype = { ...DRAGON, name: 'Тугаро-Горыныч', xp: 140 };
    const part = (p: DragonPart, tint = 0xffffff) => {
      const vb = DRAGON_PARTS[p];
      const im = scene.add.image(0, 0, 'dragon', p).setOrigin(-vb[0] / vb[2], -vb[1] / vb[3]).setScale(1 / dragonTex.res);
      if (tint !== 0xffffff) im.setTint(tint);
      this.add(im);
      return im;
    };
    this.wingB = part('wing', 0x8f9c88);
    this.necks[0] = part('neck', NECKS[0].tint);
    this.torso = part('body');
    this.wingF = part('wing');
    this.necks[1] = part('neck');
    this.necks[2] = part('neck');
    this.setScale(this.baseScale);
    scene.add.existing(this);
    if (fused) this.rider = new HeroRig(scene, x, y, 0.4, TUGARIN_SKIN);
    this.restoreTint();
    this.animate(0);
  }

  get figureH(): number {
    return 250 * this.baseScale;
  }

  get flipX(): boolean {
    return this.facing < 0;
  }

  /** Короткий красноватый отблеск, не чаще раза в 0.18 с — иначе под градом ударов змей всё время белый. */
  flash(): void {
    if (this.flashCd > 0) return;
    this.flashCd = 0.18;
    this.flashT = 0.07;
    for (const im of this.list as Img[]) im.setTint(0xffb4a8).setTintMode(Phaser.TintModes.MULTIPLY);
  }

  private restoreTint(): void {
    const mul = (a: number, b: number) => {
      const ca = Phaser.Display.Color.IntegerToColor(a), cb = Phaser.Display.Color.IntegerToColor(b);
      return Phaser.Display.Color.GetColor((ca.red * cb.red) / 255, (ca.green * cb.green) / 255, (ca.blue * cb.blue) / 255);
    };
    for (const im of this.list as Img[]) im.setTint(this.bodyTint).setTintMode(Phaser.TintModes.MULTIPLY);
    this.wingB.setTint(mul(0x8f9c88, this.bodyTint));
    this.necks[0].setTint(mul(NECKS[0].tint, this.bodyTint));
  }

  /**
   * Наклон шеи, при котором морда смотрит на цель. При повороте шеи 0 (вверх) морда смотрит вправо,
   * так что наклон = мировому углу цели (с зеркалом, если змей смотрит влево).
   */
  private aimAngle(): number {
    const a = this.facing > 0 ? this.fireAng : Math.PI - this.fireAng;
    return Phaser.Math.Clamp(Phaser.Math.RadToDeg(Phaser.Math.Angle.Wrap(a)), -50, 75);
  }

  animate(dt: number): void {
    this.t += dt;
    this.flashCd -= dt;
    const t = this.t;
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.restoreTint();
    }
    // Тяжёлая поступь и дыхание
    const step = Math.sin(t * 3.2);
    this.torso.setPosition(0, -Math.abs(step) * 3).setRotation(RAD(step * 1.2));
    // Крылья машут
    const flap = Math.sin(t * 2.6);
    this.wingB.setPosition(SHOULDER[0] - 8, SHOULDER[1] - Math.abs(step) * 3).setRotation(RAD(-10 + flap * 16));
    this.wingF.setPosition(SHOULDER[0], SHOULDER[1] + 4 - Math.abs(step) * 3).setRotation(RAD(4 + flap * 18));

    const aiming = this.fireState !== 'idle';
    this.aimBlend = Phaser.Math.Clamp(this.aimBlend + (aiming ? dt * 5 : -dt * 3), 0, 1);
    for (let k = 0; k < 3; k++) {
      const n = NECKS[k];
      let ang = n.base + Math.sin(t * 2 + k * 2.1) * 7;
      const ring = this.fireState === 'ringAim' || this.fireState === 'ring';
      if ((k === this.fireHead || ring) && this.aimBlend > 0) ang = Phaser.Math.Linear(ang, this.aimAngle() + (ring ? (k - 1) * 12 : 0), this.aimBlend);
      this.necks[k].setPosition(n.root[0], n.root[1] - Math.abs(step) * 3).setRotation(RAD(ang));
    }
    if ((this.fireState === 'aim' || this.fireState === 'ringAim') && this.flashT <= 0) {
      // Набирает огонь: голова (или все три) наливается красным
      const pulse = 0.5 + 0.5 * Math.sin(t * 30);
      const col = Phaser.Display.Color.GetColor(255, 140 + pulse * 60, 120 + pulse * 40);
      if (this.fireState === 'ringAim') for (const n of this.necks) n.setTint(col);
      else this.necks[this.fireHead].setTint(col);
    }
    this.scaleX = this.baseScale * this.facing;
    // наездник стоит на спине между крыльями
    if (this.rider) {
      const r = this.rider;
      r.facing = this.facing;
      // ноги «в седле» поверх спины, сам — между крылом и шеями
      r.setPosition(this.x - 30 * this.baseScale * this.facing, this.y + (-118 - Math.abs(step) * 3) * this.baseScale);
      r.setDepth(this.depth + 0.5);
      r.setAlpha(this.alpha).setAngle(this.angle);
      r.animate(dt, false);
    }
  }

  endAim(): void {
    this.restoreTint();
  }

  /** Мировые координаты пасти выбранной головы. */
  mouth(k = this.fireHead): { x: number; y: number } {
    const n = this.necks[k];
    const r = n.rotation;
    const lx = n.x + MOUTH[0] * Math.cos(r) - MOUTH[1] * Math.sin(r);
    const ly = n.y + MOUTH[0] * Math.sin(r) + MOUTH[1] * Math.cos(r);
    return { x: this.x + lx * this.baseScale * this.facing, y: this.y + ly * this.baseScale };
  }

  die(onDone: () => void): void {
    this.dead = true;
    this.restoreTint();
    this.scene.tweens.add({
      targets: this,
      angle: -70 * this.facing,
      alpha: 0,
      y: this.y + 10,
      duration: 1100,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.rider?.destroy();
        this.destroy();
        onDone();
      },
    });
  }
}
