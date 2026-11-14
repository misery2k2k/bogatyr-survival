import Phaser from 'phaser';
import { TEX_RES } from '../config';
import type { GameScene } from '../scenes/GameScene';
import type { Enemy } from '../entities/Enemy';
import type { Weapon } from './types';

const deg = Phaser.Math.DegToRad;

// ---------------------------------------------------------------
// Меч-кладенец — базовое оружие: взмах дугой по ближайшему врагу.
// ---------------------------------------------------------------
const SWORD = {
  dmg: [12, 16, 16, 20, 24, 30],
  cd: [1.05, 1.05, 0.95, 0.85, 0.85, 0.72],
  range: [100, 100, 118, 124, 128, 138],
  arc: [110, 110, 135, 140, 150, 160],
  back: [false, false, false, false, true, true],
};

export class Sword implements Weapon {
  level = 1;
  private t = 0.2;

  constructor(private readonly g: GameScene) {}

  setLevel(l: number): void {
    this.level = l;
  }

  update(dt: number): void {
    this.t -= dt;
    if (this.t > 0) return;
    const i = this.level - 1;
    const p = this.g.player;
    const range = SWORD.range[i] * p.stats.area;
    const target = this.g.nearestZombie(p.x, p.y, range + 30);
    if (!target) {
      this.t = 0.08;
      return;
    }
    const ang = Math.atan2(target.y - p.y, target.x - p.x);
    this.swing(ang, range, i);
    if (SWORD.back[i]) this.g.time.delayedCall(130, () => this.swing(ang + Math.PI, range, i));
    p.attackAnim(Math.cos(ang));
    this.g.tryHelix();
    this.t = SWORD.cd[i] * p.stats.haste;
  }

  private swing(ang: number, range: number, i: number): void {
    const p = this.g.player;
    if (p.dead) return;
    const arc = deg(SWORD.arc[i]);
    this.g.fx.slash(p, -p.tall * 0.42, ang, range, arc);
    this.g.sfx('swing', 0.35);
    for (const z of this.g.queryZombies(p.x, p.y, range)) {
      const dx = z.x - p.x, dy = z.y - p.y;
      const d = Math.hypot(dx, dy);
      const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang));
      // вплотную стоящих задеваем всегда, остальных — только в секторе
      if (d > z.radius + 16 && da > arc / 2) continue;
      this.g.damageZombie(z, SWORD.dmg[i], p.x, p.y, 260);
    }
  }

  destroy(): void {}
}

// ---------------------------------------------------------------
// Вихрь секир — секиры кружат вокруг богатыря.
// ---------------------------------------------------------------
const AXES = {
  count: [1, 2, 2, 3, 3, 4],
  dmg: [10, 13, 17, 21, 26, 32],
  radius: [80, 80, 90, 94, 100, 112],
  speed: [3.8, 3.9, 4.3, 4.6, 5.1, 5.7],
  size: [1, 1, 1.1, 1.1, 1.2, 1.3],
};
const AXE_HIT_CD = 0.32;

export class Axes implements Weapon {
  level = 1;
  private angle = 0;
  private sprites: Phaser.GameObjects.Image[] = [];

  constructor(private readonly g: GameScene) {}

  setLevel(l: number): void {
    this.level = l;
  }

  update(dt: number): void {
    const i = this.level - 1;
    const p = this.g.player;
    const n = AXES.count[i];
    while (this.sprites.length < n) this.sprites.push(this.g.add.image(p.x, p.y, 'axe'));
    this.angle += AXES.speed[i] * dt;
    const R = AXES.radius[i] * p.stats.area;
    const size = AXES.size[i] * Math.sqrt(p.stats.area);
    const hitR = 22 * size;
    const now = this.g.elapsed;
    for (let k = 0; k < n; k++) {
      const a = this.angle + (k / n) * Math.PI * 2;
      const hx = p.x + Math.cos(a) * R;
      const hy = p.y + Math.sin(a) * R;
      const s = this.sprites[k];
      s.setPosition(hx, hy - 40).setScale((size * 0.8) / TEX_RES).setDepth(hy);
      s.rotation += 14 * dt;
      for (const z of this.g.queryZombies(hx, hy, hitR)) {
        if (now - (z.lastHit.axes ?? -99) < AXE_HIT_CD) continue;
        z.lastHit.axes = now;
        this.g.damageZombie(z, AXES.dmg[i], p.x, p.y, 160);
      }
    }
  }

  destroy(): void {
    for (const s of this.sprites) s.destroy();
    this.sprites = [];
  }
}

// ---------------------------------------------------------------
// Богатырское копьё — пронзающий выпад вперёд (по ходу движения).
// ---------------------------------------------------------------
const SPEAR = {
  cd: [1.7, 1.55, 1.55, 1.38, 1.3, 1.1],
  dmg: [30, 35, 38, 42, 46, 56],
  len: [190, 205, 215, 235, 255, 300],
  count: [1, 1, 2, 2, 3, 3],
};

export class Spear implements Weapon {
  level = 1;
  private t = 0.6;

  constructor(private readonly g: GameScene) {}

  setLevel(l: number): void {
    this.level = l;
  }

  update(dt: number): void {
    this.t -= dt;
    if (this.t > 0) return;
    const i = this.level - 1;
    const p = this.g.player;
    const len = SPEAR.len[i] * p.stats.area;
    let base: number;
    if (p.moving) {
      base = Math.atan2(p.aimY, p.aimX);
    } else {
      const z = this.g.nearestZombie(p.x, p.y, len);
      if (!z) {
        this.t = 0.1;
        return;
      }
      base = Math.atan2(z.y - p.y, z.x - p.x);
    }
    const n = SPEAR.count[i];
    for (let k = 0; k < n; k++) {
      const ang = base + (k - (n - 1) / 2) * 0.34;
      this.g.fx.thrust(p, -p.tall * 0.4, ang, len);
      const ex = p.x + Math.cos(ang) * len, ey = p.y + Math.sin(ang) * len;
      for (const z of this.g.queryZombies((p.x + ex) / 2, (p.y + ey) / 2, len / 2 + 10)) {
        const dist = distToSegment(z.x, z.y, p.x, p.y, ex, ey);
        if (dist > 14 + z.radius) continue;
        this.g.damageZombie(z, SPEAR.dmg[i], p.x, p.y, 300);
      }
    }
    this.g.sfx('spear', 0.45);
    p.attackAnim(Math.cos(base), 'thrust');
    this.g.tryHelix();
    this.t = SPEAR.cd[i] * p.stats.haste;
  }

  destroy(): void {}
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax, vy = by - ay;
  const len2 = vx * vx + vy * vy || 1;
  const t = Phaser.Math.Clamp(((px - ax) * vx + (py - ay) * vy) / len2, 0, 1);
  return Math.hypot(px - (ax + vx * t), py - (ay + vy * t));
}

// ---------------------------------------------------------------
// Богатырский топот — удар о землю, урон и отбрасывание вокруг.
// ---------------------------------------------------------------
const STOMP = {
  cd: [4.2, 3.8, 3.8, 3.4, 3.0, 2.6],
  dmg: [14, 18, 22, 26, 32, 40],
  radius: [115, 125, 140, 150, 165, 190],
  knock: [380, 400, 420, 440, 470, 520],
  slow: [0, 0, 0, 1.2, 1.4, 1.8],
};

export class Stomp implements Weapon {
  level = 1;
  private t = 1.5;

  constructor(private readonly g: GameScene) {}

  setLevel(l: number): void {
    this.level = l;
  }

  update(dt: number): void {
    this.t -= dt;
    if (this.t > 0) return;
    const i = this.level - 1;
    const p = this.g.player;
    const r = STOMP.radius[i] * p.stats.area;
    if (!this.g.nearestZombie(p.x, p.y, r * 0.8)) {
      this.t = 0.15;
      return;
    }
    this.g.fx.ring(p.x, p.y, r, 0xf0d8a0);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      this.g.fx.puff(p.x + Math.cos(a) * r * 0.45, p.y + Math.sin(a) * r * 0.45, 0x7a6040, 0.16);
    }
    this.g.cameras.main.shake(110, 0.004);
    this.g.sfx('stomp', 0.9, 0.6);
    for (const z of this.g.queryZombies(p.x, p.y, r)) {
      this.g.damageZombie(z, STOMP.dmg[i], p.x, p.y, STOMP.knock[i]);
      if (STOMP.slow[i] > 0) z.slowT = STOMP.slow[i];
    }
    this.t = STOMP.cd[i] * p.stats.haste;
  }

  destroy(): void {}
}

// ---------------------------------------------------------------
// Кистень — гиря на цепи описывает широкий круг, бьёт всех, через кого проходит.
// ---------------------------------------------------------------
const FLAIL = {
  cd: [2.8, 2.7, 2.5, 2.3, 2.1, 1.9],
  dmg: [12, 15, 18, 22, 26, 30],
  radius: [140, 145, 165, 170, 185, 190],
  balls: [1, 1, 1, 1, 1, 2],
};
const FLAIL_SWING = 0.55;

export class Flail implements Weapon {
  level = 1;
  private t = 1;
  private swing = -1;
  private a0 = 0;
  private dir = 1;
  private prev = 0;
  private readonly hit = new Set<Enemy>();
  private readonly balls: Phaser.GameObjects.Image[] = [];
  private readonly chain: Phaser.GameObjects.Graphics;

  constructor(private readonly g: GameScene) {
    this.chain = g.add.graphics();
  }

  setLevel(l: number): void {
    this.level = l;
  }

  update(dt: number): void {
    const p = this.g.player;
    const i = this.level - 1;
    const R = FLAIL.radius[i] * p.stats.area;
    if (this.swing < 0) {
      this.t -= dt;
      if (this.t > 0) return;
      if (!this.g.nearestZombie(p.x, p.y, R + 30)) {
        this.t = 0.15;
        return;
      }
      this.swing = 0;
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.a0 = Math.random() * Math.PI * 2;
      this.prev = 0;
      this.hit.clear();
      this.g.sfx('flail', 0.5);
    }
    this.swing = Math.min(1, this.swing + dt / FLAIL_SWING);
    const sweep = Phaser.Math.Easing.Sine.InOut(this.swing) * Math.PI * 2;
    const n = FLAIL.balls[i];
    while (this.balls.length < n) this.balls.push(this.g.add.image(0, 0, 'flail').setScale(0.9 / TEX_RES));

    const hx = p.x + p.facing * 14, hy = p.y - p.tall * 0.42;
    this.chain.clear();
    for (let b = 0; b < this.balls.length; b++) {
      const ball = this.balls[b];
      if (b >= n) {
        ball.setVisible(false);
        continue;
      }
      const a = this.a0 + this.dir * sweep + b * Math.PI;
      const bx = p.x + Math.cos(a) * R, by = p.y + Math.sin(a) * R * 0.8 - 26;
      ball.setVisible(true).setPosition(bx, by).setRotation(a * 3).setDepth(by + 26);
      // Цепь — звенья от руки до гири
      const links = 9;
      for (let k = 1; k < links; k++) {
        const q = k / links;
        this.chain.fillStyle(0x2a2420, 1).fillCircle(hx + (bx - hx) * q, hy + (by - hy) * q, 3.2);
        this.chain.fillStyle(0x9aa3ab, 1).fillCircle(hx + (bx - hx) * q, hy + (by - hy) * q, 1.8);
      }
      this.chain.setDepth(Math.min(by + 25, p.y + 2));
    }

    for (const z of this.g.queryZombies(p.x, p.y, R + 28)) {
      if (this.hit.has(z)) continue;
      const dx = z.x - p.x, dy = z.y - p.y;
      if (Math.hypot(dx, dy) < R * 0.45 - z.radius) continue;
      const za = Math.atan2(dy, dx);
      for (let b = 0; b < n; b++) {
        const rel = Phaser.Math.Angle.Normalize((za - this.a0 - b * Math.PI) * this.dir);
        if (rel >= this.prev - 0.05 && rel <= sweep + 0.05) {
          this.hit.add(z);
          this.g.damageZombie(z, FLAIL.dmg[i], p.x, p.y, 420);
          this.g.sfx('hit', 0.3, 0.85);
          break;
        }
      }
    }
    this.prev = sweep;

    if (this.swing >= 1) {
      this.swing = -1;
      this.t = FLAIL.cd[i] * p.stats.haste;
      for (const b of this.balls) b.setVisible(false);
      this.chain.clear();
    }
  }

  destroy(): void {
    for (const b of this.balls) b.destroy();
    this.chain.destroy();
  }
}

// ---------------------------------------------------------------
// Соловьиный свист — конус ветра: урон, сильный отброс, замедление.
// ---------------------------------------------------------------
const WHISTLE = {
  cd: [3.6, 3.4, 3.2, 2.8, 2.6, 2.2],
  dmg: [14, 18, 24, 28, 34, 42],
  range: [220, 250, 260, 270, 300, 330],
  arc: [80, 85, 100, 105, 115, 150],
};

export class Whistle implements Weapon {
  level = 1;
  private t = 1.4;

  constructor(private readonly g: GameScene) {}

  setLevel(l: number): void {
    this.level = l;
  }

  update(dt: number): void {
    this.t -= dt;
    if (this.t > 0) return;
    const i = this.level - 1;
    const p = this.g.player;
    const range = WHISTLE.range[i] * p.stats.area;
    const target = this.g.nearestZombie(p.x, p.y, range * 0.8);
    if (!target) {
      this.t = 0.2;
      return;
    }
    const ang = Math.atan2(target.y - p.y, target.x - p.x);
    const arc = deg(WHISTLE.arc[i]);
    this.g.fx.whistle(p, -p.tall * 0.55, ang, range, arc);
    this.g.sfx('whistle', 0.45);
    for (const z of this.g.queryZombies(p.x, p.y, range)) {
      const dx = z.x - p.x, dy = z.y - p.y;
      const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang));
      if (da > arc / 2 && Math.hypot(dx, dy) > z.radius + 30) continue;
      this.g.damageZombie(z, WHISTLE.dmg[i], p.x, p.y, 640);
      z.slowT = Math.max(z.slowT, 1.5);
    }
    this.t = WHISTLE.cd[i] * p.stats.haste;
  }

  destroy(): void {}
}

// ---------------------------------------------------------------
// Гнев Перуна — молнии бьют в нечисть рядом с богатырём.
// ---------------------------------------------------------------
const PERUN = {
  cd: [3.4, 3.2, 2.9, 2.6, 2.4, 2.0],
  dmg: [24, 30, 34, 38, 44, 52],
  strikes: [1, 1, 2, 2, 3, 4],
  stun: [0.5, 0.5, 0.5, 0.6, 0.6, 1.2],
};
const PERUN_AOE = 50;

export class Perun implements Weapon {
  level = 1;
  private t = 1.8;

  constructor(private readonly g: GameScene) {}

  setLevel(l: number): void {
    this.level = l;
  }

  update(dt: number): void {
    this.t -= dt;
    if (this.t > 0) return;
    const i = this.level - 1;
    const p = this.g.player;
    const pool = this.g.queryZombies(p.x, p.y, 400);
    if (pool.length === 0) {
      this.t = 0.2;
      return;
    }
    Phaser.Utils.Array.Shuffle(pool);
    const n = PERUN.strikes[i];
    for (let k = 0; k < n; k++) {
      const z = pool[k % pool.length];
      const x = z.x, y = z.y;
      this.g.time.delayedCall(k * 120, () => {
        if (p.dead) return;
        this.g.fx.lightning(x, y);
        this.g.sfx('thunder', 0.45);
        for (const e of this.g.queryZombies(x, y, PERUN_AOE)) {
          this.g.damageZombie(e, PERUN.dmg[i], x, y, 160);
          e.slowT = Math.max(e.slowT, PERUN.stun[i]);
        }
      });
    }
    this.t = PERUN.cd[i] * p.stats.haste;
  }

  destroy(): void {}
}
