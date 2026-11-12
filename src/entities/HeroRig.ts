import Phaser from 'phaser';

/**
 * Векторный богатырь со скелетной анимацией.
 * Детали — SVG из public/assets/hero/, BootScene упаковывает их в текстуру 'hero'.
 * У каждой детали (0,0) в SVG — её шарнир, viewBox задаёт, где он в картинке.
 */
export const HERO_PARTS = {
  cape: [-54, -10, 70, 140],
  thigh: [-19, -10, 38, 64],
  shin: [-18, -9, 52, 66],
  torso: [-42, -86, 88, 114],
  head: [-38, -116, 76, 122],
  'arm-upper': [-19, -18, 38, 58],
  'arm-fore': [-15, -8, 30, 52],
  sword: [-25, -134, 50, 160],
  shield: [-27, -39, 54, 78],
  hand: [-14, -13, 30, 30],
} as const;

export type HeroPart = keyof typeof HERO_PARTS;

/** Пикселей текстуры на единицу SVG (выставляет BootScene). */
export const heroTex = { res: 1 };

/** Детали Тугарина Змеевича: тот же скелет, свои SVG (public/assets/tugarin/). */
export const TUGARIN_PARTS: Record<HeroPart, readonly [number, number, number, number]> = {
  ...HERO_PARTS,
  head: [-38, -122, 80, 128],
  sword: [-24, -156, 66, 182],
  cape: [-112, -96, 124, 150],
};
export const tugarinTex = { res: 1 };

/** «Шкура» скелета: текстура, размеры деталей, разрешение. */
export interface RigSkin {
  tex: string;
  parts: Record<HeroPart, readonly [number, number, number, number]>;
  res: { res: number };
}
export const HERO_SKIN: RigSkin = { tex: 'hero', parts: HERO_PARTS, res: heroTex };
export const TUGARIN_SKIN: RigSkin = { tex: 'tugarin', parts: TUGARIN_PARTS, res: tugarinTex };

/** Полный рост в единицах SVG: от подошв до кончика шпиля. */
export const HERO_UNITS_TALL = 268;

const RAD = Phaser.Math.DegToRad;
const lerp = Phaser.Math.Linear;

// ---- Скелет (единицы SVG, Y вниз, лицом вправо, (0,0) — земля) ----
const PELVIS_Y = -90;
const THIGH = 44;
const UPPER = 32;
const FORE = 31;
/** Точки в системе корпуса (от таза). */
const NECK = [4, -70];
const SH_F = [22, -64];
const SH_B = [-25, -65];
const CAPE = [-5, -72];
const HIP_F = [9, -4];
const HIP_B = [-12, -4];

/** Углы в градусах, абсолютные. 0 — деталь как нарисована (конечности вниз, меч вверх). */
interface Pose {
  lean: number;
  bob: number;
  head: number;
  cape: number;
  thF: number;
  shF: number;
  thB: number;
  shB: number;
  uaF: number;
  faF: number;
  sw: number;
  uaB: number;
  faB: number;
}

const IDLE: Pose = {
  lean: 0, bob: 0, head: 0, cape: 5,
  thF: -9, shF: -3, thB: 11, shB: 7,
  uaF: -18, faF: -72, sw: 28,
  uaB: 30, faB: 20,
};

/** Ключевые позы руки с мечом: [плечо, предплечье, меч, наклон корпуса]. */
type ArmKey = [number, number, number, number];
const CHOP: { at: number; k: ArmKey | null }[] = [
  { at: 0, k: null },
  { at: 0.3, k: [-168, -192, -105, -6] },
  { at: 0.56, k: [-52, -72, 122, 9] },
  { at: 1, k: null },
];
const THRUST: { at: number; k: ArmKey | null }[] = [
  { at: 0, k: null },
  { at: 0.25, k: [-40, -20, 60, -4] },
  { at: 0.5, k: [-86, -90, 90, 8] },
  { at: 1, k: null },
];
const SPIN_ARM: ArmKey = [-88, -92, 92, 0];

type Img = Phaser.GameObjects.Image;

export class HeroRig extends Phaser.GameObjects.Container {
  facing = 1;
  /** 0..1 — насколько герой «идёт» (плавно). */
  private move = 0;
  private phase = 0;
  private time = 0;
  private atk = -1;
  private atkDur = 0.24;
  private atkKeys = CHOP;
  private spin = -1;
  private spinDur = 0.34;
  private flashT = 0;
  private readonly bones: Record<string, Img> = {};
  private readonly baseTint: Record<string, number> = {};
  private readonly pose: Pose = { ...IDLE };

  constructor(scene: Phaser.Scene, x: number, y: number, worldScale: number, skin: RigSkin = HERO_SKIN) {
    super(scene, x, y);
    // Порядок отрисовки: сзади → вперёд
    const order: [string, HeroPart, number][] = [
      ['cape', 'cape', 0xffffff],
      // щит на дальней руке повёрнут к нам изнанкой: рука лежит поверх него и держит за ручку
      ['shield', 'shield', 0xd8dae2],
      ['uaB', 'arm-upper', 0xb9bcc8],
      ['faB', 'arm-fore', 0xb9bcc8],
      ['handB', 'hand', 0xb9bcc8],
      ['thB', 'thigh', 0xb9bcc8],
      ['shB', 'shin', 0xb9bcc8],
      ['thF', 'thigh', 0xffffff],
      ['shF', 'shin', 0xffffff],
      ['torso', 'torso', 0xffffff],
      ['head', 'head', 0xffffff],
      ['sword', 'sword', 0xffffff],
      ['uaF', 'arm-upper', 0xffffff],
      ['faF', 'arm-fore', 0xffffff],
      // кулак поверх рукояти; поворачивается вместе с мечом, чтобы пальцы обхватывали её поперёк
      ['handF', 'hand', 0xffffff],
    ];
    const inv = 1 / skin.res.res;
    for (const [name, part, tint] of order) {
      const vb = skin.parts[part];
      const im = scene.add.image(0, 0, skin.tex, part).setOrigin(-vb[0] / vb[2], -vb[1] / vb[3]).setScale(part === 'shield' ? inv * 1.18 : inv);
      if (tint !== 0xffffff) im.setTint(tint);
      this.bones[name] = im;
      this.baseTint[name] = tint;
      this.add(im);
    }
    this.setScale(worldScale);
    scene.add.existing(this);
    this.apply();
  }

  /** Обновить анимацию. speedK — во сколько раз быстрее обычного шага. */
  animate(dt: number, moving: boolean, speedK = 1): void {
    this.time += dt;
    this.move = Phaser.Math.Clamp(this.move + (moving ? dt * 7 : -dt * 6), 0, 1);
    if (moving) this.phase += dt * Math.PI * 2 * 1.65 * speedK;
    if (this.atk >= 0) {
      this.atk += dt / this.atkDur;
      if (this.atk >= 1) this.atk = -1;
    }
    if (this.spin >= 0) {
      this.spin += dt / this.spinDur;
      if (this.spin >= 1) this.spin = -1;
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.restoreTint();
    }
    this.apply();
  }

  attack(kind: 'chop' | 'thrust' = 'chop'): void {
    this.atkKeys = kind === 'chop' ? CHOP : THRUST;
    this.atkDur = kind === 'chop' ? 0.24 : 0.22;
    this.atk = 0;
  }

  spinAttack(): void {
    this.spin = 0;
    this.atk = -1;
  }

  flash(color = 0xffffff, time = 0.15): void {
    this.flashT = time;
    for (const im of Object.values(this.bones)) im.setTint(color);
  }

  restoreTint(): void {
    for (const [name, im] of Object.entries(this.bones)) {
      const t = this.baseTint[name];
      if (t === 0xffffff) im.clearTint();
      else im.setTint(t);
    }
  }

  private apply(): void {
    const p = this.pose;
    const m = this.move, ph = this.phase, t = this.time;
    const s = Math.sin(ph), c = Math.cos(ph);
    const breath = Math.sin(t * 2.4);

    // Ходьба поверх стойки
    p.lean = lerp(IDLE.lean, 5, m);
    p.bob = lerp(breath * 0.8, 4.5 * Math.abs(s), m);
    p.head = lerp(breath * 1.2, -2 + 1.5 * Math.sin(ph * 2), m);
    p.cape = lerp(IDLE.cape + Math.sin(t * 1.7) * 2.5, 17 + 5 * Math.sin(ph * 2), m);
    p.thF = lerp(IDLE.thF, -27 * s, m);
    p.shF = lerp(IDLE.shF, -27 * s + 40 * Math.max(0, c) + 3, m);
    p.thB = lerp(IDLE.thB, 27 * s, m);
    p.shB = lerp(IDLE.shB, 27 * s + 40 * Math.max(0, -c) + 3, m);
    p.uaB = lerp(IDLE.uaB + breath, 26 - 14 * s, m);
    p.faB = p.uaB - lerp(10, 16, m);
    const armBob = lerp(breath * 2, 5 * Math.sin(ph * 2), m);
    p.uaF = IDLE.uaF + armBob;
    p.faF = IDLE.faF + armBob;
    p.sw = IDLE.sw + armBob * 0.6;

    // Удар: рука с мечом идёт по ключевым позам
    if (this.atk >= 0) {
      const keys = this.atkKeys;
      const cur: ArmKey = [p.uaF, p.faF, p.sw, p.lean];
      let i = 0;
      while (i < keys.length - 2 && this.atk > keys[i + 1].at) i++;
      const a = keys[i], b = keys[i + 1];
      const k = Phaser.Math.Easing.Quadratic.InOut((this.atk - a.at) / (b.at - a.at));
      const ka = a.k ?? cur, kb = b.k ?? cur;
      p.uaF = lerp(ka[0], kb[0], k);
      p.faF = lerp(ka[1], kb[1], k);
      p.sw = lerp(ka[2], kb[2], k);
      p.lean = lerp(ka[3], kb[3], k);
    }

    // Круговерть: меч вытянут, фигура «крутится» (сжатие по X), подпрыгивает
    let sx = this.facing;
    if (this.spin >= 0) {
      const q = this.spin;
      const blend = Math.min(1, q * 6, (1 - q) * 6);
      p.uaF = lerp(p.uaF, SPIN_ARM[0], blend);
      p.faF = lerp(p.faF, SPIN_ARM[1], blend);
      p.sw = lerp(p.sw, SPIN_ARM[2], blend);
      p.lean = lerp(p.lean, 0, blend);
      p.cape = lerp(p.cape, 40, blend);
      p.bob -= Math.sin(q * Math.PI) * 10;
      sx = this.facing * Math.cos(q * Math.PI * 4);
      if (Math.abs(sx) < 0.35) sx = sx < 0 ? -0.35 : 0.35;
    }
    this.scaleX = Math.abs(this.scaleY) * sx;

    this.layout(p);
  }

  /** Прямая кинематика: углы → позиции деталей. */
  private layout(p: Pose): void {
    const b = this.bones;
    const px = 0, py = PELVIS_Y + p.bob;
    const lr = RAD(p.lean);
    const cl = Math.cos(lr), sl = Math.sin(lr);
    const body = (pt: number[]) => [px + pt[0] * cl - pt[1] * sl, py + pt[0] * sl + pt[1] * cl];
    const end = (x: number, y: number, deg: number, len: number) => [x - Math.sin(RAD(deg)) * len, y + Math.cos(RAD(deg)) * len];

    b.torso.setPosition(px, py).setRotation(lr);
    const neck = body(NECK);
    b.head.setPosition(neck[0], neck[1]).setRotation(lr + RAD(p.head));
    const cape = body(CAPE);
    b.cape.setPosition(cape[0], cape[1]).setRotation(RAD(p.cape));

    for (const [side, hip, th, sh] of [
      ['F', HIP_F, p.thF, p.shF],
      ['B', HIP_B, p.thB, p.shB],
    ] as const) {
      const hx = px + hip[0], hy = py + hip[1];
      b[`th${side}`].setPosition(hx, hy).setRotation(RAD(th));
      const knee = end(hx, hy, th, THIGH);
      b[`sh${side}`].setPosition(knee[0], knee[1]).setRotation(RAD(sh));
    }

    const shF = body(SH_F);
    b.uaF.setPosition(shF[0], shF[1]).setRotation(RAD(p.uaF));
    const elF = end(shF[0], shF[1], p.uaF, UPPER);
    b.faF.setPosition(elF[0], elF[1]).setRotation(RAD(p.faF));
    const hand = end(elF[0], elF[1], p.faF, FORE);
    b.sword.setPosition(hand[0], hand[1]).setRotation(RAD(p.sw));
    b.handF.setPosition(hand[0], hand[1]).setRotation(RAD(p.sw));

    const shB = body(SH_B);
    b.uaB.setPosition(shB[0], shB[1]).setRotation(RAD(p.uaB));
    const elB = end(shB[0], shB[1], p.uaB, UPPER);
    b.faB.setPosition(elB[0], elB[1]).setRotation(RAD(p.faB));
    const handB = end(elB[0], elB[1], p.faB, FORE);
    const shieldRot = lr * 0.5 + RAD((p.uaB - IDLE.uaB) * 0.3);
    b.shield.setPosition(handB[0], handB[1]).setRotation(shieldRot);
    b.handB.setPosition(handB[0], handB[1]).setRotation(shieldRot);
  }
}
