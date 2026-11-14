import Phaser from 'phaser';
import { BOSSES, BOSS_TOAST, type Ability, type BossDef, type BossKind } from '../bosses';
import { PLAYER_BASE, ZOMBIES } from '../config';
import { t, tx } from '../i18n';
import { SpriteBoss, Yascher, type BossActor, type Cast } from '../entities/SpriteBoss';
import type { GameScene } from '../scenes/GameScene';

/** Сколько живёт «разогрев» и откат после приёма по умолчанию. */
const RECOVER = 0.4;

/**
 * Боссы на готовых спрайтах (и Ящер). Каждый — набор приёмов из bosses.ts:
 * приём сначала подсвечивает опасное место на земле, потом бьёт — от любого удара можно уйти.
 */
export class Bosses {
  list: BossActor[] = [];

  constructor(private readonly g: GameScene) {}

  /** Есть ли картинки для босса (атласы глав грузятся фоном). */
  ready(kind: BossKind): boolean {
    const def = BOSSES[kind];
    if (!def) return false;
    if (def.body === 'yascher') return true;
    const ids = [def.body, def.rider?.id].filter(Boolean) as string[];
    return ids.every((id) => this.g.anims.exists(`${id}-walk`));
  }

  spawn(kind: BossKind, x: number, y: number, hpMul: number): BossActor | null {
    const def = BOSSES[kind];
    if (!def) return null;
    const b: BossActor = def.body === 'yascher' ? new Yascher(this.g, x, y, def) : new SpriteBoss(this.g, x, y, def);
    b.hp = b.maxHp = Math.round(def.hp * hpMul);
    b.hpMul = hpMul;
    b.dmgMul = this.g.spawner.dmgMul;
    b.facing = this.g.player.x >= x ? 1 : -1;
    this.list.push(b);
    return b;
  }

  alive(): boolean {
    return this.list.some((b) => !b.dead);
  }

  clear(): void {
    for (const b of this.list) b.destroy();
    this.list = [];
  }

  /** Удар вплотную (обычный: щит, круговерть и уворот работают). */
  private hit(b: BossActor, raw: number): boolean {
    return this.g.hitPlayer(Math.round(raw * this.g.spawner.dmgMul), b);
  }

  /** Подсвеченный приём — богатырский удар: не отбить и не увернуться, урон не меньше pct здоровья. */
  private hard(b: BossActor, raw: number, pct: number): boolean {
    return this.g.hitPlayerHard(Math.round(raw * this.g.spawner.dmgMul), pct, b);
  }

  /** Попадает ли богатырь в эллипс на земле (круг радиуса r в перспективе). */
  private inCircle(x: number, y: number, r: number): boolean {
    const p = this.g.player;
    const ex = (p.x - x) / (r + PLAYER_BASE.hitRadius * 0.5), ey = (p.y - y) / ((r + PLAYER_BASE.hitRadius * 0.5) * 0.7);
    return ex * ex + ey * ey <= 1;
  }

  private inSector(x: number, y: number, r: number, ang: number, arc: number): boolean {
    const p = this.g.player;
    const dx = p.x - x, dy = p.y - y;
    const d = Math.hypot(dx, dy);
    if (d > r + PLAYER_BASE.hitRadius) return false;
    return d < 50 || Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - ang)) < arc / 2;
  }

  private circle(x: number, y: number, r: number, k: number, color = 0xff3a1a): void {
    const gfx = this.g.fireGfx;
    gfx.fillStyle(color, 0.1 + k * 0.22).fillEllipse(x, y, r * 2, r * 1.4);
    gfx.lineStyle(2, color, 0.5 + k * 0.45).strokeEllipse(x, y, r * 2, r * 1.4);
  }

  private sector(x: number, y: number, r: number, ang: number, arc: number, k: number, color = 0xff3a1a): void {
    const gfx = this.g.fireGfx;
    gfx.fillStyle(color, 0.12 + k * 0.2);
    gfx.slice(x, y, r, ang - arc / 2, ang + arc / 2, false).fillPath();
    gfx.lineStyle(2, color, 0.5 + k * 0.4);
    gfx.slice(x, y, r, ang - arc / 2, ang + arc / 2, false).strokePath();
  }

  update(dt: number): void {
    const g = this.g;
    const p = g.player;
    const playing = g.state === 'play' && !p.dead;
    const decay = Math.exp(-6 * dt);
    for (const b of this.list) {
      if (b.dead) continue;
      const dx = p.x - b.x, dy = p.y - b.y;
      const d = Math.hypot(dx, dy) || 1;
      b.invulnT -= dt;
      b.slowT -= dt;
      b.kbTired -= dt;
      b.attackCd -= dt;
      b.buffT -= dt;
      if (b.buffT <= 0) b.speedBuff = 1;
      if (playing) {
        b.gcd -= dt;
        for (let i = 0; i < b.cds.length; i++) b.cds[i] -= dt;
      }

      // Кощей лежит и вот-вот встанет
      if (b.reviveT > 0) {
        b.reviveT -= dt;
        if (b.reviveT <= 0) this.rise(b);
        b.tickVisual(dt, false);
        continue;
      }

      // стужа вокруг Карачуна
      const aura = b.def.aura;
      if (aura) {
        g.fireGfx.lineStyle(2, aura.color, 0.35).strokeEllipse(b.x, b.y, aura.r * 2, aura.r * 1.4);
        g.fireGfx.fillStyle(aura.color, 0.06).fillEllipse(b.x, b.y, aura.r * 2, aura.r * 1.4);
        if (playing && this.inCircle(b.x, b.y, aura.r)) p.slowMul = Math.min(p.slowMul, aura.slow);
      }

      // Чернобог зовёт подмогу на трети здоровья
      const ph = b.def.phases?.[b.phaseIdx];
      if (ph && b.hp / b.maxHp <= ph.at) {
        b.phaseIdx++;
        const pt = g.spawner.ringPoint();
        g.bus.emit('toast', tx(ph.toast));
        g.spawnBoss(ph.kind, pt.x, pt.y, b.hpMul * 0.35);
      }

      let moving = false;
      if (!b.cast) {
        if (Math.abs(dx) > 10) b.facing = dx > 0 ? 1 : -1;
        const slow = b.slowT > 0 || (p.stats.slowAura > 0 && d < p.stats.slowAura + b.radius) ? 0.6 : 1;
        const sp = b.def.speed * b.speedBuff * slow;
        const touch = b.radius + PLAYER_BASE.hitRadius;
        if (playing) {
          let vx = 0, vy = 0;
          const keep = b.def.keep ?? 0;
          if (keep > 0) {
            // колдуны держатся поодаль и обходят по кругу
            b.strafeT -= dt;
            if (b.strafeT <= 0) {
              b.strafeT = Phaser.Math.FloatBetween(1.5, 3);
              b.strafe = -b.strafe;
            }
            if (d > keep * 1.15) {
              vx = dx / d;
              vy = dy / d;
            } else if (d < keep * 0.7) {
              vx = (-dx / d) * 0.85;
              vy = (-dy / d) * 0.85;
            } else {
              vx = (-dy / d) * 0.45 * b.strafe;
              vy = (dx / d) * 0.45 * b.strafe;
            }
          } else if (d > touch * 0.8) {
            vx = dx / d;
            vy = dy / d;
          }
          if (vx || vy) {
            b.x += vx * sp * dt;
            b.y += vy * sp * dt;
            moving = true;
          }
          // вплотную ещё и бьёт
          if (d < touch + 4 && b.attackCd <= 0 && !b.hidden) {
            b.attackCd = 1.1;
            this.hit(b, b.def.damage);
          }
          if (b.gcd <= 0) this.choose(b, d);
        }
      } else {
        moving = this.runCast(b, b.cast, dt, playing);
      }

      b.x += b.kbx * dt;
      b.y += b.kby * dt;
      b.kbx *= decay;
      b.kby *= decay;
      // отставшего — ближе (за край экрана)
      if (d > g.spawner.spawnRadius * 1.6 && !b.cast) {
        const pt = g.spawner.ringPoint(Math.atan2(-dy, -dx));
        b.setPosition(pt.x, pt.y);
      }
      b.tickVisual(dt, moving);
    }
    if (this.list.some((b) => b.dead && !b.active)) this.list = this.list.filter((b) => b.active);
  }

  /** Выбрать приём: из готовых по дальности — тот, что ждёт дольше всех. */
  private choose(b: BossActor, d: number): void {
    let best = -1;
    let bestCd = 0;
    b.def.abilities.forEach((ab, i) => {
      if (b.cds[i] > 0) return;
      if (d < (ab.min ?? 0) || d > (ab.max ?? Infinity)) return;
      if (ab.kind === 'summon' && this.countAlive(ab.type!) >= (ab.maxAlive ?? 99)) return;
      if (best < 0 || b.cds[i] < bestCd) {
        best = i;
        bestCd = b.cds[i];
      }
    });
    if (best < 0) return;
    const ab = b.def.abilities[best];
    b.cds[best] = ab.cd * Phaser.Math.FloatBetween(0.85, 1.15) * this.g.spawner.bossAggro;
    b.gcd = 0.7;
    this.start(b, ab, best);
  }

  private countAlive(type: string): number {
    let n = 0;
    for (const z of this.g.zombies) if (z.active && !z.dead && z.ztype.key === type) n++;
    return n;
  }

  private start(b: BossActor, ab: Ability, i: number): void {
    const g = this.g;
    const p = g.player;
    const ang = Math.atan2(p.y - b.y, p.x - b.x);
    const c: Cast = { ab, i, stage: 0, t: ab.wind ?? 0.8, T: ab.wind ?? 0.8, ang, x: p.x, y: p.y, pts: [], hit: false, acc: 0, waves: 0 };
    b.cast = c;
    const anim = ab.anim ?? 'attack';
    switch (ab.kind) {
      case 'cleave':
      case 'slam':
      case 'whistle':
        b.act(anim, c.T + 0.25, ab.rider);
        if (ab.kind === 'whistle') g.sfx('roar', 0.35, 1.7);
        break;
      case 'leap':
        // прыгнет туда, где богатырь сейчас (чуть с упреждением)
        c.x = p.x + p.aimX * (p.moving ? 30 : 0);
        c.y = p.y + p.aimY * (p.moving ? 30 : 0);
        b.act(anim, c.T + 0.5, ab.rider);
        break;
      case 'dash': {
        const len = Math.min(Math.hypot(p.x - b.x, p.y - b.y) + 120, (ab.max ?? 500) + 80);
        c.x = b.x + Math.cos(ang) * len;
        c.y = b.y + Math.sin(ang) * len;
        b.act(anim, c.T + 0.3, ab.rider);
        g.sfx('roar', 0.35, 1.5);
        break;
      }
      case 'summon': {
        const n = ab.n ?? 4;
        const cx = ab.at === 'self' ? b.x : p.x, cy = ab.at === 'self' ? b.y : p.y;
        const a0 = Math.random() * Math.PI * 2;
        for (let k = 0; k < n; k++) {
          const a = a0 + (k / n) * Math.PI * 2;
          c.pts.push({ x: cx + Math.cos(a) * (ab.ring ?? 150), y: cy + Math.sin(a) * (ab.ring ?? 150) * 0.8 });
        }
        if (ab.toast) g.bus.emit('toast', tx(ab.toast));
        b.act(anim, c.T + 0.3, ab.rider);
        if (ab.buff) g.sfx('roar', 0.6, 0.75);
        break;
      }
      case 'roots': {
        c.pts.push({ x: p.x, y: p.y });
        // остальные круги — на пути богатыря и вокруг
        for (let k = 1; k < (ab.n ?? 3); k++) {
          const lead = p.moving ? 70 : 0;
          c.pts.push({
            x: p.x + p.aimX * lead + Phaser.Math.FloatBetween(-1, 1) * (ab.spread ?? 100),
            y: p.y + p.aimY * lead + Phaser.Math.FloatBetween(-1, 1) * (ab.spread ?? 100) * 0.8,
          });
        }
        b.act(anim, c.T + 0.2, ab.rider);
        break;
      }
      case 'volley':
      case 'nova':
      case 'meteors':
      case 'curse':
        b.act(anim, c.T + 0.3, ab.rider);
        break;
      case 'cage':
        b.act(anim, c.T + 0.3, ab.rider);
        g.sfx('dstomp', 0.35, 0.6);
        break;
      case 'blink':
        c.t = c.T = 0.35;
        b.hidden = true;
        g.fx.puff(b.x, b.y - b.figureH * 0.4, 0x6a4a8a, 0.3);
        g.sfx('soul0', 0.4, 0.6);
        break;
      case 'beam':
        if (ab.lids) {
          // «Поднимите мне веки!» — чертенята бегут к Вию
          g.bus.emit('toast', t('toast.lids'));
          const imp = ZOMBIES.chortik;
          if (imp && g.anims.exists(`${imp.anim}-walk`)) {
            for (let k = 0; k < 2; k++) g.spawnZombie(imp, b.x + (k ? 80 : -80), b.y + 30, g.spawner.hpMul, g.spawner.dmgMul);
          }
        }
        b.act(anim, c.T * 0.6, ab.rider);
        break;
      case 'burrow':
        c.t = c.T = 0.6;
        g.sfx('dstomp', 0.5, 0.6);
        break;
    }
  }

  /** Кадр приёма. Возвращает, двигался ли босс. */
  private runCast(b: BossActor, c: Cast, dt: number, playing: boolean): boolean {
    const g = this.g;
    const p = g.player;
    const ab = c.ab;
    if (playing) c.t -= dt;
    const k = c.T > 0 ? Phaser.Math.Clamp(1 - c.t / c.T, 0, 1) : 1;
    const want = Math.atan2(p.y - b.y, p.x - b.x);
    const done = (recover = RECOVER) => {
      if (c.stage < 90) {
        c.stage = 99;
        c.t = c.T = recover;
      }
    };
    if (c.stage === 99) {
      if (c.t <= 0) b.cast = null;
      return false;
    }
    const tint = ab.tint ?? 0xff3a1a;

    switch (ab.kind) {
      case 'cleave':
      case 'whistle': {
        // доворачивает за богатырём, но медленно — можно уйти в сторону
        c.ang = Phaser.Math.Angle.RotateTo(c.ang, want, (ab.kind === 'whistle' ? 0.6 : 1.0) * dt);
        b.facing = Math.cos(c.ang) >= 0 ? 1 : -1;
        const r = ab.r ?? 140, arc = ab.arc ?? 1.6;
        this.sector(b.x, b.y, r, c.ang, arc, k, ab.kind === 'whistle' ? 0x9adfff : tint);
        if (c.t > 0) return false;
        if (ab.kind === 'whistle') {
          g.fx.whistle(b, -b.figureH * 0.55, c.ang, r, arc);
          g.sfx('whistle', 0.7, 0.8);
          g.cameras.main.shake(180, 0.004);
          // ветер сносит и нечисть
          for (const z of g.queryZombies(b.x, b.y, r)) {
            if (z === b) continue;
            const za = Math.atan2(z.y - b.y, z.x - b.x);
            if (Math.abs(Phaser.Math.Angle.Wrap(za - c.ang)) < arc / 2) {
              z.kbx = Math.cos(za) * 420;
              z.kby = Math.sin(za) * 420;
            }
          }
          if (playing && this.inSector(b.x, b.y, r, c.ang, arc)) {
            this.hard(b, ab.dmg ?? 20, 0.2);
            p.push(b.x, b.y, ab.knock ?? 500);
            p.rootT = Math.max(p.rootT, ab.stun ?? 0.8);
            g.fx.number(p.x, p.y - p.tall - 20, t('fx.stunned'), '#bfe8ff', 16);
          }
        } else {
          g.fx.slash(b, -b.figureH * 0.4, c.ang, r, arc, 0xff8a6a);
          g.sfx('swing', 0.6, 0.6);
          if (playing && this.inSector(b.x, b.y, r, c.ang, arc)) this.hard(b, ab.dmg ?? 20, 0.22);
        }
        done();
        return false;
      }
      case 'slam': {
        const r = ab.r ?? 160;
        this.circle(b.x, b.y, r, k, tint);
        if (c.t > 0) return false;
        g.fx.ring(b.x, b.y, r, tint === 0xff3a1a ? 0xffb07a : tint, 450);
        g.fx.critBurst(b.x, b.y - 10, 1.4);
        for (let i = 0; i < 6; i++) g.fx.puff(b.x + Phaser.Math.Between(-r * 0.6, r * 0.6), b.y + Phaser.Math.Between(-r * 0.3, r * 0.3), 0x9a8a7a, 0.18);
        g.cameras.main.shake(220, 0.006);
        g.sfx('dstomp', 0.7, 0.75);
        if (playing && this.inCircle(b.x, b.y, r)) {
          this.hard(b, ab.dmg ?? 28, 0.3);
          if (ab.knock) p.push(b.x, b.y, ab.knock);
        }
        done(0.5);
        return false;
      }
      case 'leap': {
        const r = ab.r ?? 95;
        if (c.stage === 0) {
          this.circle(c.x, c.y, r, k, tint);
          if (c.t > 0) return false;
          c.stage = 1;
          c.acc = Math.hypot(c.x - b.x, c.y - b.y);
          c.t = c.T = Math.max(0.25, c.acc / (ab.speed ?? 700));
          b.facing = c.x >= b.x ? 1 : -1;
          c.pts = [{ x: b.x, y: b.y }];
          g.sfx('swing', 0.5, 0.5);
          return false;
        }
        if (c.stage === 1) {
          this.circle(c.x, c.y, r, 1, tint);
          const s = c.pts[0];
          b.x = Phaser.Math.Linear(s.x, c.x, k);
          b.y = Phaser.Math.Linear(s.y, c.y, k);
          b.hop = Math.sin(k * Math.PI) * Math.min(130, 40 + c.acc * 0.3);
          if (c.t > 0) return true;
          b.hop = 0;
          g.fx.ring(c.x, c.y, r, 0xffb07a, 400);
          g.fx.critBurst(c.x, c.y - 10, 1.2);
          for (let i = 0; i < 5; i++) g.fx.puff(c.x + Phaser.Math.Between(-r, r) * 0.6, c.y + Phaser.Math.Between(-r, r) * 0.3, 0x9a8a7a, 0.16);
          g.cameras.main.shake(200, 0.006);
          g.sfx('dstomp', 0.7, 0.8);
          if (playing && this.inCircle(c.x, c.y, r)) {
            this.hard(b, ab.dmg ?? 22, 0.26);
            p.push(c.x, c.y, 300);
          }
          done(0.5);
        }
        return false;
      }
      case 'dash': {
        const w = b.radius * 1.5;
        if (c.stage === 0) {
          b.facing = c.x >= b.x ? 1 : -1;
          g.fireGfx.lineStyle(w, tint, 0.12 + k * 0.22).lineBetween(b.x, b.y, c.x, c.y);
          g.fireGfx.lineStyle(2, tint, 0.6 + k * 0.4).lineBetween(b.x, b.y, c.x, c.y);
          if (c.t > 0) return false;
          c.stage = 1;
          c.t = c.T = Math.hypot(c.x - b.x, c.y - b.y) / (ab.speed ?? 650);
          g.sfx('helix', 0.6, 0.7);
          return false;
        }
        const ddx = c.x - b.x, ddy = c.y - b.y, dd = Math.hypot(ddx, ddy) || 1;
        const step = Math.min(dd, (ab.speed ?? 650) * dt);
        b.x += (ddx / dd) * step;
        b.y += (ddy / dd) * step;
        if (Math.random() < 0.5) g.fx.puff(b.x, b.y - 6, 0xb89a70, 0.12, b.y - 1);
        if (playing && !c.hit && Math.hypot(p.x - b.x, p.y - b.y) < b.radius + PLAYER_BASE.hitRadius + 8) {
          c.hit = true;
          this.hard(b, ab.dmg ?? 24, 0.26);
          p.push(b.x, b.y, 320);
        }
        if (c.t <= 0 || dd < 6) done(0.6);
        return true;
      }
      case 'summon': {
        for (const pt of c.pts) {
          g.fireGfx.fillStyle(0x3a1a4a, 0.25 + k * 0.35).fillEllipse(pt.x, pt.y, 46, 28);
          g.fireGfx.lineStyle(2, 0x9a6aff, 0.4 + k * 0.5).strokeEllipse(pt.x, pt.y, 46 * (1 - k * 0.4), 28 * (1 - k * 0.4));
        }
        if (c.t > 0) return false;
        const type = ZOMBIES[ab.type ?? 'skel'];
        if (type && g.anims.exists(`${type.anim}-walk`)) {
          for (const pt of c.pts) {
            if (this.countAlive(type.key) >= (ab.maxAlive ?? 99)) break;
            const hp = type.heavy ? 1 + (g.spawner.hpMul - 1) * 0.7 : g.spawner.hpMul;
            g.spawnZombie(type, pt.x, pt.y, hp, g.spawner.dmgMul);
            g.fx.puff(pt.x, pt.y - 10, 0x6a5a7a, 0.2);
          }
          g.sfx('squish', 0.4, 0.7);
        }
        if (ab.buff) {
          b.speedBuff = ab.buff.speed;
          b.buffT = ab.buff.dur;
        }
        done(0.3);
        return false;
      }
      case 'roots': {
        const r = ab.r ?? 52;
        for (const pt of c.pts) this.circle(pt.x, pt.y, r, k, tint);
        if (c.t > 0) return false;
        let caught = false;
        for (const pt of c.pts) {
          g.fx.ring(pt.x, pt.y, r, tint, 380);
          g.fx.puff(pt.x, pt.y - 10, tint, 0.2);
          g.fx.spark(pt.x, pt.y - 18, tint, 0.14);
          if (!caught && playing && this.inCircle(pt.x, pt.y, r)) caught = true;
        }
        g.sfx('block', 0.4, 0.6);
        if (caught) {
          this.hard(b, ab.dmg ?? 18, 0.15);
          p.rootT = Math.max(p.rootT, ab.root ?? 1);
          g.fx.number(p.x, p.y - p.tall - 20, ab.label ? tx(ab.label) : t('fx.rooted'), '#d8ffd0', 16);
        }
        done(0.3);
        return false;
      }
      case 'volley':
      case 'nova': {
        if (c.t > 0) {
          // заряжает: светится
          b.glow(k * 0.7, ab.tint ?? 0xffffff);
          return false;
        }
        b.glow(0, 0);
        const n = ab.n ?? 5;
        const from = ab.rider && b.def.rider ? { x: b.x + b.def.rider.dx * b.def.h * b.facing, y: b.y } : { x: b.x, y: b.y };
        const base = ab.kind === 'nova' ? Math.random() * Math.PI * 2 : Math.atan2(p.y - from.y, p.x - from.x);
        for (let i = 0; i < n; i++) {
          const a = ab.kind === 'nova' ? base + (i / n) * Math.PI * 2 + c.waves * (Math.PI / n) : base + (n > 1 ? (i / (n - 1) - 0.5) * (ab.arc ?? 0.6) : 0);
          g.projectiles.fire(from.x, from.y, from.x + Math.cos(a) * 100, from.y + Math.sin(a) * 100, {
            key: ab.shot ?? 'orb',
            damage: Math.round((ab.dmg ?? 12) * this.g.spawner.dmgMul),
            pct: 0.07,
            speed: ab.speed ?? 300,
            tint: ab.tint,
            trail: ab.shot === 'orb' ? ab.tint : 0,
            scale: ab.scale ?? (ab.shot === 'orb' ? 1 : 1.1),
            radius: ab.shot === 'orb' ? 14 : 12,
            life: 3,
          });
        }
        g.sfx(ab.shot === 'shard' ? 'spear' : 'fire', 0.4, ab.shot === 'shard' ? 1.5 : 1.3);
        c.waves++;
        if (c.waves < (ab.waves ?? 1)) {
          c.t = c.T = 0.35;
          return false;
        }
        done(0.3);
        return false;
      }
      case 'meteors': {
        if (c.t > 0) return false;
        const n = ab.n ?? 6;
        g.addMeteor(p.x, p.y, 1.1);
        for (let i = 1; i < n; i++) {
          const a = Math.random() * Math.PI * 2, r = Phaser.Math.FloatBetween(60, ab.spread ?? 200);
          g.addMeteor(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.8, 1.1 + i * 0.12);
        }
        g.sfx('roar', 0.4, 1.2);
        done(0.3);
        return false;
      }
      case 'blink': {
        if (c.stage === 0) {
          b.setAlpha(Math.max(0, 1 - k));
          if (c.t > 0) return false;
          // появится сбоку или за спиной богатыря
          const a = Math.random() * Math.PI * 2;
          const dist = ab.dist ?? 260;
          b.setPosition(p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist * 0.8);
          g.fx.puff(b.x, b.y - b.figureH * 0.4, 0x6a4a8a, 0.3);
          c.stage = 1;
          c.t = c.T = 0.35;
          return false;
        }
        b.setAlpha(k);
        if (c.t > 0) return false;
        b.setAlpha(1);
        b.hidden = false;
        done(0.2);
        return false;
      }
      case 'beam': {
        const len = ab.len ?? 600, w = ab.width ?? 50;
        const color = ab.tint ?? 0xff3a2a;
        const eye = b.eye();
        if (c.stage === 0) {
          // целится: тонкий луч и разгорающиеся глаза
          c.ang = Phaser.Math.Angle.RotateTo(c.ang, want, (ab.turn ?? 0.5) * 0.6 * dt);
          b.facing = Math.cos(c.ang) >= 0 ? 1 : -1;
          b.glow(k, color);
          const ex = b.x + Math.cos(c.ang) * len, ey = b.y + Math.sin(c.ang) * len;
          g.fireGfx.lineStyle(w, color, 0.06 + k * 0.14).lineBetween(b.x, b.y, ex, ey);
          g.fireGfx.lineStyle(1.5, color, 0.4 + k * 0.5).lineBetween(eye.x, eye.y, ex, ey);
          if (c.t > 0) return false;
          c.stage = 1;
          c.t = c.T = ab.dur ?? 1.6;
          c.acc = 0;
          g.sfx('fire', 0.6, 0.6);
          g.cameras.main.shake(160, 0.003);
          return false;
        }
        // смотрит: луч ползёт за богатырём
        c.ang = Phaser.Math.Angle.RotateTo(c.ang, want, (ab.turn ?? 0.5) * dt);
        b.facing = Math.cos(c.ang) >= 0 ? 1 : -1;
        b.glow(1, color);
        const ex = b.x + Math.cos(c.ang) * len, ey = b.y + Math.sin(c.ang) * len;
        g.fireGfx.lineStyle(w, color, 0.3).lineBetween(b.x, b.y, ex, ey);
        g.fireGfx.lineStyle(w * 0.6, color, 0.55).lineBetween(eye.x, eye.y, ex, ey);
        g.fireGfx.lineStyle(w * 0.2, 0xffffff, 0.8).lineBetween(eye.x, eye.y, ex, ey);
        c.acc -= dt;
        if (Math.random() < 0.4) g.fx.spark(Phaser.Math.Linear(b.x, ex, Math.random()), Phaser.Math.Linear(b.y, ey, Math.random()) - 10, color, 0.08);
        if (playing && c.acc <= 0) {
          // попадание — по земле: расстояние от ног богатыря до отрезка луча
          const vx = ex - b.x, vy = ey - b.y;
          const tt = Phaser.Math.Clamp(((p.x - b.x) * vx + (p.y - b.y) * vy) / (vx * vx + vy * vy), 0, 1);
          const dist = Math.hypot(p.x - (b.x + vx * tt), p.y - (b.y + vy * tt));
          if (dist < w / 2 + PLAYER_BASE.hitRadius * 0.6) {
            c.acc = 0.25;
            this.hard(b, ab.dmg ?? 16, 0.07);
          }
        }
        if (c.t > 0) return false;
        b.glow(0, 0);
        done(0.5);
        return false;
      }
      case 'burrow': {
        const r = ab.r ?? 120;
        if (c.stage === 0) {
          // уходит под землю
          b.setAlpha(Math.max(0, 1 - k));
          if (Math.random() < 0.6) g.fx.puff(b.x + Phaser.Math.Between(-50, 50), b.y - 6, 0x7a5a3a, 0.2);
          if (c.t > 0) return false;
          b.hidden = true;
          c.stage = 1;
          c.t = c.T = ab.dur ?? 2;
          return false;
        }
        if (c.stage === 1) {
          // ползёт под землёй к богатырю — бугор и комья земли
          const ddx = p.x - b.x, ddy = p.y - b.y, dd = Math.hypot(ddx, ddy) || 1;
          if (dd > 10) {
            b.x += (ddx / dd) * (ab.speed ?? 260) * dt;
            b.y += (ddy / dd) * (ab.speed ?? 260) * dt;
          }
          g.fireGfx.fillStyle(0x3a2418, 0.5).fillEllipse(b.x, b.y, 70, 30);
          if (Math.random() < 0.5) g.fx.puff(b.x + Phaser.Math.Between(-20, 20), b.y - 4, 0x7a5a3a, 0.12);
          if (c.t > 0) return true;
          c.stage = 2;
          c.t = c.T = ab.wind ?? 0.8;
          return true;
        }
        if (c.stage === 2) {
          this.circle(b.x, b.y, r, k, tint);
          if (c.t > 0) return false;
          b.setAlpha(1);
          b.hidden = false;
          g.fx.ring(b.x, b.y, r, 0xffb07a, 450);
          g.fx.critBurst(b.x, b.y - 20, 1.6);
          for (let i = 0; i < 8; i++) g.fx.puff(b.x + Phaser.Math.Between(-r, r) * 0.7, b.y + Phaser.Math.Between(-r, r) * 0.35, 0x7a5a3a, 0.22);
          g.cameras.main.shake(260, 0.008);
          g.sfx('roar', 0.6, 0.7);
          if (playing && this.inCircle(b.x, b.y, r)) {
            this.hard(b, ab.dmg ?? 30, 0.32);
            p.push(b.x, b.y, ab.knock ?? 420);
          }
          done(0.7);
        }
        return false;
      }
      case 'curse': {
        const r = ab.r ?? 70;
        this.circle(c.x, c.y, r, k, 0xb06aff);
        if (c.t > 0) return false;
        g.fx.ring(c.x, c.y, r, 0xb06aff, 420);
        g.sfx('soul0', 0.5, 0.45);
        if (playing && this.inCircle(c.x, c.y, r)) {
          p.noHealT = Math.max(p.noHealT, ab.dur ?? 6);
          g.fx.number(p.x, p.y - p.tall - 20, t('fx.curse'), '#d8a8ff', 17);
          g.bus.emit('toast', t('toast.curse'));
        }
        done(0.3);
        return false;
      }
      case 'cage': {
        const r = ab.r ?? 150;
        const bone = 0xe8dcc8;
        if (c.stage === 0) {
          g.fireGfx.lineStyle(3, bone, 0.3 + k * 0.6).strokeEllipse(c.x, c.y, r * 2, r * 1.4);
          if (c.t > 0) return false;
          c.stage = 1;
          c.t = c.T = ab.dur ?? 4;
          g.sfx('dstomp', 0.6, 0.55);
          g.cameras.main.shake(160, 0.004);
          for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            g.fx.puff(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r * 0.7, 0xc8b8a0, 0.14);
          }
          return false;
        }
        // костяная ограда: кольцо с зубцами, переступить — больно
        g.fireGfx.lineStyle(7, bone, 0.85).strokeEllipse(c.x, c.y, r * 2, r * 1.4);
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2;
          const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r * 0.7;
          g.fireGfx.lineStyle(4, bone, 0.95).lineBetween(x, y, x, y - 22);
        }
        if (playing) {
          const ex = (p.x - c.x) / r, ey = (p.y - c.y) / (r * 0.7);
          const e = Math.sqrt(ex * ex + ey * ey);
          if (Math.abs(e - 1) < 0.12) {
            this.hard(b, ab.dmg ?? 18, 0.12);
            // отбрасывает обратно внутрь клетки (или наружу, если стоял снаружи)
            const sgn = e < 1 ? -1 : 1;
            p.push(c.x - sgn * (p.x - c.x) * 10, c.y - sgn * (p.y - c.y) * 10, 360);
          }
        }
        if (c.t > 0) return false;
        done(0.3);
        return false;
      }
    }
    return false;
  }

  /** Удар, после которого босс должен пасть. true — не пал, а «умер понарошку» (Кощей встанет). */
  tryRevive(b: BossActor): boolean {
    if (b.lives <= 0) return false;
    b.lives--;
    b.hp = 1;
    b.cast = null;
    b.hidden = false;
    b.setAlpha(1);
    b.hop = 0;
    b.glow(0, 0);
    b.reviveT = 2.8;
    b.invulnT = 3;
    b.fall();
    this.g.bus.emit('toast', b.def.deathToast ? tx(b.def.deathToast) : t('toast.willRise', { name: tx(b.def.name) }));
    this.g.sfx('roar', 0.5, 0.6);
    return true;
  }

  private rise(b: BossActor): void {
    b.hp = Math.round(b.maxHp * 0.5);
    b.invulnT = 0.6;
    b.rise();
    this.g.fx.ring(b.x, b.y, 200, 0x9aff7a, 600);
    this.g.fx.critBurst(b.x, b.y - b.figureH * 0.5, 1.5);
    this.g.cameras.main.shake(260, 0.006);
    this.g.sfx('roar', 0.7, 0.7);
    this.g.bus.emit('toast', b.def.riseToast ? tx(b.def.riseToast) : t('toast.rises', { name: tx(b.def.name) }));
  }

  /** Имя и объявление босса для Spawner. */
  static toast(kind: BossKind): string {
    return tx(BOSS_TOAST[kind]);
  }

  static def(kind: BossKind): BossDef | undefined {
    return BOSSES[kind];
  }
}
