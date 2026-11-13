import Phaser from 'phaser';
import { FONT_UI, TEX_RES } from '../config';

type Img = Phaser.GameObjects.Image;
type Target = { x: number; y: number };

const MAX_SPLATS = 70;
const MAX_SOULS = 40;

/** Визуальные эффекты с пулами объектов: взмахи, кольца, вспышки, всплывающие цифры. */
export class Fx {
  private pools = new Map<string, Img[]>();
  private texts: Phaser.GameObjects.Text[] = [];
  private textRes = 1;
  private splats: Img[] = [];
  private splatNext = 0;
  private souls = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  setTextResolution(r: number): void {
    this.textRes = Math.max(1, Math.min(4, Math.ceil(r)));
    for (const t of this.texts) t.setResolution(this.textRes);
  }

  private img(key: string): Img {
    let pool = this.pools.get(key);
    if (!pool) {
      pool = [];
      this.pools.set(key, pool);
    }
    let im = pool.find((i) => !i.active);
    if (!im) {
      im = this.scene.add.image(0, 0, key);
      pool.push(im);
    }
    this.scene.tweens.killTweensOf(im);
    return im
      .setActive(true)
      .setVisible(true)
      .setAlpha(1)
      .setScale(1)
      .setRotation(0)
      .setOrigin(0.5)
      .setFlipY(false)
      .clearTint()
      .setBlendMode(Phaser.BlendModes.NORMAL);
  }

  private release = (im: Img) => {
    im.setActive(false).setVisible(false);
  };

  /** Серп удара мечом, «прилипает» к цели follow и прокатывается по дуге. */
  slash(follow: Target, yOff: number, ang: number, range: number, arc: number, tint = 0xfff0c8): void {
    const im = this.img('slash_03').setBlendMode(Phaser.BlendModes.ADD).setTint(tint);
    const dist = range * 0.68;
    const chord = 2 * dist * Math.sin(Math.min(arc, Math.PI * 0.95) / 2);
    const size = Math.max(chord / 0.78, range * 0.9);
    im.setScale(size / 512);
    const dir = Math.random() < 0.5 ? 1 : -1;
    im.setFlipY(dir < 0);
    const state = { p: 0 };
    const apply = () => {
      const a = ang + (state.p - 0.5) * arc * 0.45 * dir;
      im.setPosition(follow.x + Math.cos(a) * (dist - size * 0.06), follow.y + yOff + Math.sin(a) * (dist - size * 0.06));
      im.setRotation(a);
      im.setAlpha(1 - state.p * state.p);
      im.setDepth(follow.y + 50);
    };
    apply();
    this.scene.tweens.add({
      targets: state,
      p: 1,
      duration: 200,
      ease: 'Cubic.easeOut',
      onUpdate: apply,
      onComplete: () => this.release(im),
    });
  }

  /** Круговерть: вихрь стали вокруг богатыря. */
  helix(follow: Target, yOff: number, radius: number): void {
    const tw = this.img('twirl_02').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd27a);
    const size = (radius * 2.3) / 512;
    const state = { p: 0 };
    const crescents = [0, 1, 2].map(() => this.img('slash_03').setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff4d0));
    const apply = () => {
      const p = state.p;
      tw.setPosition(follow.x, follow.y + yOff * 0.4)
        .setScale(size * (0.55 + p * 0.5), size * (0.55 + p * 0.5) * 0.62)
        .setRotation(p * Math.PI * 4)
        .setAlpha(p < 0.2 ? p * 5 : 1 - (p - 0.2) / 0.8)
        .setDepth(follow.y + 60);
      crescents.forEach((c, k) => {
        const a = p * Math.PI * 4 + (k / 3) * Math.PI * 2;
        const r = radius * 0.62;
        c.setPosition(follow.x + Math.cos(a) * r, follow.y + yOff * 0.4 + Math.sin(a) * r * 0.62)
          .setRotation(a + Math.PI / 2)
          .setScale((radius * 0.9) / 512)
          .setAlpha(Math.min(1, (1 - p) * 2.2))
          .setDepth(follow.y + (Math.sin(a) > 0 ? 70 : -20));
      });
    };
    apply();
    this.scene.tweens.add({
      targets: state,
      p: 1,
      duration: 360,
      ease: 'Sine.easeOut',
      onUpdate: apply,
      onComplete: () => {
        this.release(tw);
        crescents.forEach(this.release);
      },
    });
  }

  /** Соловьиный свист: волны ветра конусом. */
  whistle(follow: Target, yOff: number, ang: number, range: number, arc: number): void {
    for (let k = 0; k < 3; k++) {
      const im = this.img('slash_03').setBlendMode(Phaser.BlendModes.ADD).setTint(0xcfefff);
      const state = { p: 0 };
      const ox = follow.x, oy = follow.y + yOff * 0.6;
      const apply = () => {
        const d = 30 + state.p * range * 0.85;
        const size = Math.max(60, 2 * d * Math.sin(Math.min(arc, Math.PI * 0.9) / 2)) / 0.78;
        im.setPosition(ox + Math.cos(ang) * d, oy + Math.sin(ang) * d)
          .setRotation(ang)
          .setScale(size / 512, (size / 512) * 0.9)
          .setAlpha(0.85 * (1 - state.p))
          .setDepth(oy + Math.sin(ang) * d + 60);
      };
      apply();
      this.scene.tweens.add({ targets: state, p: 1, delay: k * 70, duration: 380, ease: 'Quad.easeOut', onUpdate: apply, onComplete: () => this.release(im) });
    }
    for (let k = 0; k < 5; k++) {
      const a = ang + (Math.random() - 0.5) * arc * 0.8;
      const streak = this.img('light_01')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xe6f7ff)
        .setRotation(a)
        .setScale(range / 1400, 0.05)
        .setAlpha(0.7)
        .setPosition(follow.x + Math.cos(a) * 60, follow.y + yOff * 0.6 + Math.sin(a) * 60)
        .setDepth(follow.y + 70);
      this.scene.tweens.add({
        targets: streak,
        x: streak.x + Math.cos(a) * range * 0.8,
        y: streak.y + Math.sin(a) * range * 0.8,
        alpha: 0,
        duration: 360,
        ease: 'Quad.easeOut',
        onComplete: () => this.release(streak),
      });
    }
  }

  /** Молния Перуна в точку на земле. */
  lightning(x: number, y: number): void {
    const bolt = this.img('bolt')
      .setOrigin(0.5, 1)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setPosition(x, y)
      .setScale(Phaser.Math.FloatBetween(0.9, 1.15) * (Math.random() < 0.5 ? -1 : 1), Phaser.Math.FloatBetween(0.95, 1.2))
      .setDepth(y + 90);
    this.scene.tweens.add({
      targets: bolt,
      alpha: { from: 1, to: 0 },
      duration: 280,
      ease: (t: number) => (t < 0.3 ? (Math.floor(t * 20) % 2 ? 0.2 : 0) : t),
      onComplete: () => this.release(bolt),
    });
    const glow = this.img('circle_05').setBlendMode(Phaser.BlendModes.ADD).setTint(0x9fc8ff).setPosition(x, y - 6).setScale(0.32, 0.16).setDepth(-7000);
    this.scene.tweens.add({ targets: glow, alpha: 0, scaleX: 0.5, scaleY: 0.25, duration: 420, onComplete: () => this.release(glow) });
    this.critBurst(x, y - 14, 0.9);
    this.ring(x, y, 60, 0xbfe0ff, 260);
  }

  /** Частица в воздухе главы: тени (motes), пепел (ash), угли (embers), снег (snow), души (souls). */
  ambient(kind: 'motes' | 'ash' | 'embers' | 'snow' | 'souls', x: number, y: number): void {
    if (kind === 'snow') {
      const im = this.img('circle_05').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffffff).setPosition(x, y).setScale(Phaser.Math.FloatBetween(0.014, 0.03)).setAlpha(0.9).setDepth(90000);
      this.scene.tweens.add({ targets: im, x: x - Phaser.Math.Between(40, 110), y: y + Phaser.Math.Between(160, 240), alpha: 0, duration: 2600, ease: 'Sine.easeIn', onComplete: () => this.release(im) });
      return;
    }
    if (kind === 'souls') {
      // грешные души поднимаются из земли — лиловые огоньки
      const im = this.img('circle_05').setBlendMode(Phaser.BlendModes.ADD).setTint(Math.random() < 0.6 ? 0xb06aff : 0xff6a9a).setPosition(x, y).setScale(Phaser.Math.FloatBetween(0.04, 0.08)).setAlpha(0).setDepth(y + 200);
      this.scene.tweens.add({ targets: im, alpha: { from: 0, to: 0.6 }, x: x + Phaser.Math.Between(-20, 20), y: y - 90, duration: 1300, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => this.release(im) });
      return;
    }
    if (kind === 'motes') {
      // блуждающие огоньки — тусклые фиолетовые искры
      const im = this.img('circle_05').setBlendMode(Phaser.BlendModes.ADD).setTint(0x8a5ad0).setPosition(x, y).setScale(Phaser.Math.FloatBetween(0.03, 0.07)).setAlpha(0).setDepth(y + 200);
      this.scene.tweens.add({ targets: im, alpha: { from: 0, to: 0.55 }, x: x + Phaser.Math.Between(-30, 30), y: y - 40, duration: 1400, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => this.release(im) });
      return;
    }
    if (kind === 'ash') {
      const im = this.img('px').setTint(Math.random() < 0.5 ? 0x9a948c : 0x5a544e).setPosition(x, y).setScale(Phaser.Math.FloatBetween(0.6, 1.2)).setAlpha(0.8).setDepth(90000);
      im.setRotation(Math.random() * Math.PI);
      this.scene.tweens.add({ targets: im, x: x - 60, y: y + 140, rotation: im.rotation + 3, alpha: 0, duration: 2400, ease: 'Sine.easeIn', onComplete: () => this.release(im) });
      return;
    }
    const im = this.img('star_04').setBlendMode(Phaser.BlendModes.ADD).setTint(Math.random() < 0.5 ? 0xff8a3a : 0xffc14a).setPosition(x, y).setScale(Phaser.Math.FloatBetween(0.03, 0.06)).setDepth(90000);
    this.scene.tweens.add({ targets: im, x: x + Phaser.Math.Between(-30, 30), y: y - Phaser.Math.Between(80, 150), alpha: 0, duration: 1700, ease: 'Quad.easeOut', onComplete: () => this.release(im) });
  }

  /** Звено цепной молнии между двумя точками (Перстень Громовержца). */
  chain(x1: number, y1: number, x2: number, y2: number): void {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const bolt = this.img('bolt')
      .setOrigin(0.5, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xbfdcff)
      .setPosition(x1, y1)
      .setRotation(Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2)
      .setScale(0.45 * (Math.random() < 0.5 ? -1 : 1), d / 420)
      .setDepth(Math.max(y1, y2) + 90);
    this.scene.tweens.add({ targets: bolt, alpha: 0, duration: 220, ease: 'Quad.easeIn', onComplete: () => this.release(bolt) });
    this.spark(x2, y2, 0xcfe4ff, 0.14);
  }

  /** Огонь Змея Горыныча: клуб пламени летит из пасти по направлению ang. */
  fire(x: number, y: number, ang: number, range: number, groundY: number): void {
    const im = this.img(Math.random() < 0.5 ? 'smoke_04' : 'circle_05')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(Math.random() < 0.5 ? 0xff7a1f : 0xffc23a)
      .setPosition(x, y)
      .setRotation(Math.random() * Math.PI * 2)
      .setScale(0.04)
      .setAlpha(0.95);
    const a = ang + (Math.random() - 0.5) * 0.45;
    const d = range * Phaser.Math.FloatBetween(0.75, 1);
    const state = { p: 0 };
    const apply = () => {
      const p = state.p;
      // Пламя опускается к земле по ходу полёта (голова выше цели)
      const px = x + Math.cos(a) * d * p, py = y + Math.sin(a) * d * p + (groundY - y) * p * 0.7;
      im.setPosition(px, py)
        .setScale(0.04 + p * 0.2)
        .setAlpha(0.8 * (1 - p * p))
        .setDepth(py + 80);
    };
    apply();
    this.scene.tweens.add({ targets: state, p: 1, duration: 480, ease: 'Sine.easeOut', onUpdate: apply, onComplete: () => this.release(im) });
  }

  /** Вспышка богатырской затрещины. */
  critBurst(x: number, y: number, scale = 1): void {
    const im = this.img('scorch_02')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xffb347)
      .setPosition(x, y)
      .setDepth(y + 80)
      .setScale(0.05 * scale)
      .setRotation(Math.random() * Math.PI);
    this.scene.tweens.add({
      targets: im,
      scale: 0.2 * scale,
      alpha: 0,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => this.release(im),
    });
    this.spark(x, y, 0xffe9a8, 0.22 * scale);
  }

  /** Расходящееся кольцо (топот, воскрешение, новый уровень). */
  ring(x: number, y: number, radius: number, tint: number, duration = 380): void {
    const im = this.img('ring').setTint(tint).setPosition(x, y).setDepth(-7000);
    const target = (radius * 2) / (256 * TEX_RES) / 0.92;
    im.setScale(target * 0.2).setAlpha(0.95);
    this.scene.tweens.add({
      targets: im,
      scale: target,
      alpha: 0,
      duration,
      ease: 'Cubic.easeOut',
      onComplete: () => this.release(im),
    });
  }

  /** Клуб дыма/пыли. */
  puff(x: number, y: number, tint: number, scale = 0.12, depth = y + 20): void {
    const im = this.img('smoke_04')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setPosition(x, y)
      .setDepth(depth)
      .setScale(scale * 0.5)
      .setAlpha(0.7)
      .setRotation(Math.random() * Math.PI * 2);
    this.scene.tweens.add({
      targets: im,
      scale,
      alpha: 0,
      y: y - 10,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => this.release(im),
    });
  }

  /** Искра попадания. */
  spark(x: number, y: number, tint = 0xffffff, scale = 0.09): void {
    const im = this.img('star_04')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(tint)
      .setPosition(x, y)
      .setDepth(y + 60)
      .setScale(scale)
      .setRotation(Math.random() * Math.PI);
    this.scene.tweens.add({
      targets: im,
      scale: scale * 0.3,
      alpha: 0,
      duration: 140,
      onComplete: () => this.release(im),
    });
  }

  /** Душа поверженной нечисти летит к богатырю — это и есть опыт. */
  soul(fromX: number, fromY: number, to: Target, toYOff: number, big = false): void {
    if (this.souls >= MAX_SOULS) return;
    this.souls++;
    const im = this.img('circle_05').setBlendMode(Phaser.BlendModes.ADD).setTint(big ? 0xffd27a : 0x7fd8ff);
    const sc = big ? 0.13 : 0.085;
    const side = Math.random() < 0.5 ? -1 : 1;
    const state = { p: 0 };
    const apply = () => {
      const p = state.p;
      const tx = to.x, ty = to.y + toYOff;
      const dx = tx - fromX, dy = ty - fromY;
      const d = Math.hypot(dx, dy) || 1;
      const arc = Math.sin(p * Math.PI) * Math.min(60, d * 0.4) * side;
      im.setPosition(fromX + dx * p - (dy / d) * arc, fromY + dy * p + (dx / d) * arc - Math.sin(p * Math.PI) * 18)
        .setScale(sc * (1 - p * 0.45))
        .setAlpha(p < 0.15 ? p / 0.15 : 1)
        .setDepth(100000 - 1);
    };
    apply();
    this.scene.tweens.add({
      targets: state,
      p: 1,
      duration: 420 + Math.random() * 120,
      ease: 'Quad.easeIn',
      onUpdate: apply,
      onComplete: () => {
        this.souls--;
        this.release(im);
      },
    });
  }

  /** Лужа нечисти на земле, медленно тает. */
  splat(x: number, y: number, scale: number): void {
    let im: Img;
    if (this.splats.length < MAX_SPLATS) {
      im = this.scene.add.image(0, 0, 'splat');
      this.splats.push(im);
    } else {
      im = this.splats[this.splatNext];
      this.splatNext = (this.splatNext + 1) % MAX_SPLATS;
    }
    this.scene.tweens.killTweensOf(im);
    const s = (scale * Phaser.Math.FloatBetween(0.8, 1.2)) / TEX_RES;
    im.setActive(true)
      .setVisible(true)
      .setPosition(x, y)
      .setDepth(-8500 + y * 0.001)
      .setRotation(Math.random() * Math.PI * 2)
      .setScale(s * 0.3, s * 0.3 * 0.6)
      .setAlpha(0.85);
    this.scene.tweens.add({ targets: im, scaleX: s, scaleY: s * 0.6, duration: 160, ease: 'Quad.easeOut' });
    this.scene.tweens.add({ targets: im, alpha: 0, delay: 3500, duration: 1500, onComplete: () => this.release(im) });
  }

  /** Мягкое зелёное свечение лечения (вампиризм, оберег). */
  healGlow(follow: Target, yOff: number): void {
    const im = this.img('circle_05').setBlendMode(Phaser.BlendModes.ADD).setTint(0x5dff7a).setAlpha(0.55);
    const state = { p: 0 };
    const apply = () => {
      im.setPosition(follow.x, follow.y + yOff - state.p * 16).setScale(0.22 + state.p * 0.08, 0.3 + state.p * 0.1).setAlpha(0.5 * (1 - state.p));
      im.setDepth(follow.y + 55);
    };
    apply();
    this.scene.tweens.add({ targets: state, p: 1, duration: 520, ease: 'Quad.easeOut', onUpdate: apply, onComplete: () => this.release(im) });
    for (let i = 0; i < 3; i++) {
      const sp = this.img('star_04')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0x9dffb0)
        .setScale(0.035)
        .setPosition(follow.x + Phaser.Math.Between(-22, 22), follow.y + yOff + Phaser.Math.Between(-20, 30))
        .setDepth(follow.y + 56);
      this.scene.tweens.add({ targets: sp, y: sp.y - 34, alpha: 0, delay: i * 70, duration: 600, onComplete: () => this.release(sp) });
    }
  }

  /** Всплывающее число (урон / лечение). crit — крупно, с подскоком. */
  number(x: number, y: number, value: number | string, color: string, size = 18, crit = false): void {
    let t = this.texts.find((tt) => !tt.active);
    if (!t) {
      if (this.texts.length >= 90) return;
      t = this.scene.add
        .text(0, 0, '', {
          fontFamily: FONT_UI,
          fontStyle: 'bold',
          fontSize: '18px',
          color: '#ffffff',
          stroke: '#1a0e06',
          strokeThickness: 4,
          resolution: this.textRes,
        })
        .setOrigin(0.5, 1);
      this.texts.push(t);
    }
    this.scene.tweens.killTweensOf(t);
    t.setActive(true)
      .setVisible(true)
      .setText(String(value))
      .setColor(color)
      .setFontSize(size)
      .setStroke(crit ? '#4a0d00' : '#1a0e06', crit ? 6 : 4)
      .setPosition(x + (Math.random() - 0.5) * 10, y)
      .setAlpha(1)
      .setAngle(crit ? Phaser.Math.Between(-8, 8) : 0)
      .setScale(crit ? 2 : 1.25)
      .setDepth(crit ? 100001 : 100000);
    this.scene.tweens.add({
      targets: t,
      y: y - (crit ? 40 : 28),
      scale: 1,
      duration: crit ? 640 : 520,
      ease: crit ? 'Back.easeOut' : 'Quad.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: t,
          alpha: 0,
          duration: 160,
          onComplete: () => t!.setActive(false).setVisible(false),
        });
      },
    });
  }

  /** Летящее копьё (чистая визуализация выпада). */
  thrust(follow: Target, yOff: number, ang: number, len: number): void {
    const im = this.img('spear').setOrigin(0, 0.5).setRotation(ang);
    const sc = Math.max(0.6, len / 230);
    im.setScale(sc / TEX_RES, 1 / TEX_RES);
    const state = { p: 0 };
    const apply = () => {
      const k = state.p < 0.45 ? state.p / 0.45 : 1 - (state.p - 0.45) / 0.55;
      const off = -40 * sc + k * (len - 150 * sc + 40 * sc);
      im.setPosition(follow.x + Math.cos(ang) * off, follow.y + yOff + Math.sin(ang) * off);
      im.setAlpha(state.p < 0.7 ? 1 : 1 - (state.p - 0.7) / 0.3);
      im.setDepth(follow.y + (Math.sin(ang) > 0 ? 40 : -5));
    };
    apply();
    this.scene.tweens.add({ targets: state, p: 1, duration: 260, onUpdate: apply, onComplete: () => this.release(im) });

    const trail = this.img('light_01')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0xfff1b0)
      .setRotation(ang)
      .setPosition(follow.x + Math.cos(ang) * len * 0.5, follow.y + yOff + Math.sin(ang) * len * 0.5)
      .setDepth(follow.y + 45)
      .setScale(len / 512, 0.1)
      .setAlpha(0.8);
    this.scene.tweens.add({ targets: trail, alpha: 0, scaleY: 0.02, duration: 220, onComplete: () => this.release(trail) });
  }
}
