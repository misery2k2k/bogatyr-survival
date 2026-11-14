import Phaser from 'phaser';
import { ABILITIES, ABILITY_BY_ID } from '../abilities/defs';
import type { AbilityId, Weapon } from '../abilities/types';
import { COLORS, FONT_UI, PLAYER_BASE, TEX_RES, VIEW_AREA_SQRT, xpForLevel, type ZombieType } from '../config';
import { Pickups } from '../entities/Pickups';
import { ARMOR_CAP, Player, baseStats } from '../entities/Player';
import { DRAGON, Dragon } from '../entities/Dragon';
import type { Enemy } from '../entities/Enemy';
import { TUGARIN, Tugarin } from '../entities/Tugarin';
import { Zombie } from '../entities/Zombie';
import { ITEM_BY_ID, RARITY, rollItem, type ItemId, type Rarity } from '../items';
import { debugState } from '../debug';
import { Save } from '../save';
import { applyTalents, runGold, talentLevel } from '../talents';
import { getSettings } from '../settings';
import { SFX_TONAL, sfxCacheKey, type SfxKey } from '../sfx';
import { Decor } from '../systems/Decor';
import { Fx } from '../systems/Fx';
import { Projectiles } from '../systems/Projectiles';
import { SpatialGrid } from '../systems/SpatialGrid';
import { Spawner } from '../systems/Spawner';
import { BIOMES, START_ITEMS, START_LEVEL, type BiomeDef, type BossKind } from '../biomes';
import { Bosses } from '../systems/Bosses';
import type { BossActor } from '../entities/SpriteBoss';
import { LazyAssets } from '../mobs';
import { Platform } from '../platform';
import { t, tx } from '../i18n';

export type { SfxKey };

const SFX_THROTTLE_MS: Record<string, number> = { hit: 55, soul: 60, hurt: 220, swing: 60, crit: 80, squish: 80, thunder: 90, fire: 150, block: 120, dstomp: 300, flail: 200 };

export interface RunStats {
  /** Одолел Чернобога — победа. */
  won?: boolean;
  time: number;
  kills: number;
  level: number;
  canRevive: boolean;
  /** Злато за забег и всего в кошельке. */
  gold: number;
  totalGold: number;
}

export type DamageKind = 'hit' | 'helix' | 'splash';

/** «Буйство» за рекламу: сколько длится и как часто можно (с). */
export const RAGE_TIME = 20;
const RAGE_CD = 150;
/** «Другие умения» за рекламу — не чаще раза в столько секунд. */
const REROLL_CD = 60;
/** После воскрешения за рекламу — столько секунд неуязвимости. */
const REVIVE_GOD = 5;

/** Прицел стрелка: всего (с) и сколько из них прицел уже замер перед выстрелом. */
const ARCHER_AIM = 0.54;
const ARCHER_LOCK = 0.04;

/** Сундук на земле. */
export interface Chest {
  x: number;
  y: number;
  img: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  minRarity: Rarity;
}

type Keys = Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;

export class GameScene extends Phaser.Scene {
  /** Шина событий для UI (пересоздаётся на каждый забег). */
  bus!: Phaser.Events.EventEmitter;
  player!: Player;
  fx!: Fx;
  zombies: Zombie[] = [];
  dragons: Dragon[] = [];
  tugarins: Tugarin[] = [];
  /** Огненный дождь Тугаро-Горыныча: точки падения и время до удара. */
  private meteors: { x: number; y: number; t: number }[] = [];
  aliveZombies = 0;
  elapsed = 0;
  kills = 0;
  level = 1;
  xp = 0;
  xpNext = 1;
  levels = new Map<AbilityId, number>();
  /** Вектор виртуального джойстика (пишет UIScene). */
  joyX = 0;
  joyY = 0;
  state: 'play' | 'levelup' | 'dead' | 'chest' = 'play';
  /** Режим тестера: множитель времени. */
  timeScale = 1;
  /** Убито боссов за забег (для злата). */
  bossKills = 0;
  /** Сколько злата уже начислено в этом забеге (после воскрешения считаем только прибавку). */
  private goldAwarded = 0;
  /** Бесплатные воскрешения от таланта «Второе дыхание». */
  private freeRevives = 0;
  /** Предметы из сундуков (в порядке получения). */
  items: ItemId[] = [];
  featherUsed = false;
  chests: Chest[] = [];
  /** Текущая глава (локация). */
  biome: BiomeDef = BIOMES[0];
  revivesLeft = 1;

  /** Боссы на готовых спрайтах и Ящер. */
  bosses!: Bosses;
  private grid = new SpatialGrid<Zombie>(64);
  private buf: Zombie[] = [];
  private weapons = new Map<AbilityId, Weapon>();
  private pickups!: Pickups;
  private decor!: Decor;
  spawner!: Spawner;
  private ground!: Phaser.GameObjects.TileSprite;
  private hpBar!: Phaser.GameObjects.Graphics;
  private keys?: Keys;
  private pendingLevelUps = 0;
  private lastSfx: Record<string, number> = {};
  private healAcc = 0;
  private healShown = 0;
  private healShowT = 0;
  private gemStreak = 0;
  private gemStreakT = 0;
  private helixCd = 0;
  private shakeCd = 0;
  /** Сколько ещё может вылечить вампиризм (копится со временем — потолок лечения в секунду). */
  private lsBudget = 0;
  /** Слой подсветок атак (конусы, круги, лучи) — перерисовывается каждый шаг. */
  fireGfx!: Phaser.GameObjects.Graphics;
  projectiles!: Projectiles;
  /** Масштаб земли текущей главы (мировых px на пиксель текстуры). */
  private groundScale = 1 / TEX_RES;
  private chestT = 0;
  private ambientAcc = 0;
  private chestWave = 0;
  /** Неуязвимость от Камня Алатыря (с). */
  private invulnT = 0;
  private alatyrCd = 0;
  private chainCd = 0;
  private feastT = 0;
  private bellT = 0;
  /** Подсказки новичку про пирожки (одна при первом пирожке, одна при малом здоровье). */
  private pieHintShown = false;
  /** Старт с поздней главы: сколько умений ещё выбрать в подготовке (и сколько было всего). */
  prepLeft = 0;
  prepTotal = 0;
  /** «Буйство» (за рекламу): сколько ещё длится и когда можно снова. */
  rageT = 0;
  rageCd = 0;
  /** «Другие умения» за рекламу: когда можно снова. */
  rerollCd = 0;
  /** Злато за этот забег уже удвоено рекламой. */
  goldDoubled = false;
  /** Редкость последнего открытого сундука (для «Другой предмет»). */
  private chestRarity: Rarity = 'common';
  private rageFxT = 0;
  private lowHpTipShown = false;

  constructor() {
    super('Game');
  }

  create(): void {
    // Сцена переиспользуется при рестарте — сбрасываем всё здесь, а не в инициализаторах полей.
    this.zombies = [];
    this.dragons = [];
    this.tugarins = [];
    this.meteors = [];
    this.aliveZombies = 0;
    this.elapsed = 0;
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = xpForLevel(1);
    this.levels = new Map();
    this.weapons = new Map();
    this.joyX = this.joyY = 0;
    this.state = 'play';
    this.revivesLeft = 1;
    this.pendingLevelUps = 0;
    this.lastSfx = {};
    this.healAcc = this.healShown = this.healShowT = 0;
    this.gemStreak = this.gemStreakT = 0;
    this.helixCd = this.shakeCd = this.lsBudget = 0;
    this.items = [];
    this.featherUsed = false;
    this.chests = [];
    this.chestT = 70;
    this.chestWave = 0;
    this.invulnT = this.alatyrCd = this.chainCd = 0;
    this.feastT = 20;
    this.bellT = 6;
    this.grid = new SpatialGrid<Zombie>(64);
    this.bus = new Phaser.Events.EventEmitter();
    this.pieHintShown = this.lowHpTipShown = false;
    this.prepLeft = this.prepTotal = 0;
    this.rageT = this.rageCd = this.rageFxT = 0;
    this.rerollCd = 0;
    this.goldDoubled = false;

    this.groundScale = 1 / TEX_RES;
    this.ground = this.add.tileSprite(0, 0, 64, 64, 'ground').setOrigin(0).setScale(this.groundScale).setDepth(-10000);
    this.decor = new Decor(this);
    this.biome = BIOMES[0];
    this.fx = new Fx(this);
    this.pickups = new Pickups(this);
    this.player = new Player(this, 0, 0);
    this.hpBar = this.add.graphics().setDepth(99999);
    this.fireGfx = this.add.graphics().setDepth(-7500);
    this.projectiles = new Projectiles(
      this,
      (dmg, pct) => (pct > 0 ? this.hitPlayerHard(dmg, pct, null) : this.hitPlayer(dmg, null)),
      (x, y, tint) => this.fx.spark(x, y, tint, 0.05),
    );
    this.events.once('shutdown', () => this.projectiles.clear());
    this.spawner = new Spawner(this);
    this.bosses = new Bosses(this);
    this.events.once('shutdown', () => this.bosses.clear());
    // глава старта: выбранная в меню, но не дальше той, до которой дошёл
    const save = Save.get();
    const startCh = Phaser.Math.Clamp(save.startChapter ?? 0, 0, Math.min(save.maxChapter ?? 0, BIOMES.length - 1));
    if (startCh > 0) this.spawner.startAt(startCh);
    // ассеты этой главы и следующей — фоном, пока идёт бой
    const nextCh = Math.min(startCh + 1, BIOMES.length - 1);
    LazyAssets.ensure(this, BIOMES[startCh].assets, () => LazyAssets.ensure(this, BIOMES[nextCh].assets));

    const cam = this.cameras.main;
    cam.setBackgroundColor('#3f6a2a');
    cam.startFollow(this.player, true, 0.15, 0.15);
    cam.setFollowOffset(0, 45);

    const kb = this.input.keyboard;
    this.keys = kb?.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Keys | undefined;

    this.onResize();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.onResize, this);
      for (const w of this.weapons.values()) w.destroy();
    });

    this.addAbility('sword');
    // благословение: предмет выбран ещё в меню (там его и показали) — даётся первым, до предметов подготовки
    const blessed = this.registry.get('blessed') as ItemId | null;
    this.registry.set('blessed', null);
    if (blessed && ITEM_BY_ID.has(blessed)) {
      this.items.push(blessed);
      this.recalcStats();
      this.time.delayedCall(2600, () => this.bus.emit('toast', t('toast.blessing', { item: tx(ITEM_BY_ID.get(blessed)!.name) })));
    }
    if (startCh > 0) {
      this.applyBiome(BIOMES[startCh], 0);
      this.prepareStart(startCh);
    }
    if (blessed) this.player.hp = this.player.stats.maxHp;
    this.spawner.opening();
    this.pickups.onSpawn = (pie) => this.pieHint(pie);
    this.bossKills = 0;
    this.goldAwarded = 0;
    this.freeRevives = talentLevel('revive');
    this.player.god = debugState.god;
    this.setTimeScale(debugState.timeScale);

    this.scene.stop('UI');
    this.scene.launch('UI');
    Platform.gameplayStart();
  }

  /** Видимая область мира (считаем сами: worldView обновляется только после рендера). */
  viewRect(): { cx: number; cy: number; w: number; h: number } {
    const cam = this.cameras.main;
    return { cx: this.player.x, cy: this.player.y - 45, w: cam.width / cam.zoom, h: cam.height / cam.zoom };
  }

  private onResize(): void {
    const w = this.scale.width, h = this.scale.height;
    const zoom = Math.sqrt(w * h) / VIEW_AREA_SQRT;
    this.cameras.main.setZoom(zoom);
    this.fx.setTextResolution(zoom);
    this.ground.setSize((w / zoom + 128) / this.groundScale, (h / zoom + 128) / this.groundScale);
  }

  // ------------------------------------------------------------------
  update(_time: number, delta: number): void {
    // Ускорение времени (режим тестера): логику считаем мелкими шагами, чтобы ничего не «перепрыгивало»
    let left = Math.min(delta / 1000, 0.05) * this.timeScale;
    while (left > 1e-6) {
      const dt = Math.min(left, 0.05);
      left -= dt;
      this.step(dt);
      if (!this.sys.isActive()) break;
    }
  }

  private step(dt: number): void {
    const p = this.player;

    if (this.state === 'play') {
      this.elapsed += dt;
      let ix = 0, iy = 0;
      const k = this.keys;
      if (k) {
        if (k.A.isDown || k.LEFT.isDown) ix -= 1;
        if (k.D.isDown || k.RIGHT.isDown) ix += 1;
        if (k.W.isDown || k.UP.isDown) iy -= 1;
        if (k.S.isDown || k.DOWN.isDown) iy += 1;
      }
      if (ix || iy) {
        const l = Math.hypot(ix, iy);
        ix /= l;
        iy /= l;
      } else {
        ix = this.joyX;
        iy = this.joyY;
      }
      this.healShown += p.tick(dt, ix, iy);
      p.slowMul = 1;
      this.helixCd -= dt;
      this.shakeCd -= dt;
      this.alatyrCd -= dt;
      this.chainCd -= dt;
      if (this.invulnT > 0) {
        this.invulnT -= dt;
        // золотое мерцание неуязвимости
        if (Math.floor(this.invulnT * 10) % 2 === 0) p.flash(0xffe9a0, 0.05);
      }
      this.rageCd -= dt;
      this.rerollCd -= dt;
      if (this.rageT > 0) {
        this.rageT -= dt;
        this.rageFxT -= dt;
        if (this.rageFxT <= 0) {
          this.rageFxT = 0.25;
          p.flash(0xff6a4a, 0.1);
          this.fx.spark(p.x + Phaser.Math.Between(-22, 22), p.y - Phaser.Math.Between(20, 90), 0xff5a2a, 0.12);
        }
        if (this.rageT <= 0) {
          this.recalcStats();
          this.bus.emit('toast', t('toast.rageOver'));
        }
      }
      // Потолок вампиризма: не больше 2.5% здоровья в секунду (в буйстве — 8%) + запас на одну секунду
      const lsCap = p.stats.maxHp * (this.rageT > 0 ? 0.08 : 0.025);
      this.lsBudget = Math.min(lsCap, this.lsBudget + lsCap * dt);
    }

    this.rebuildGrid();
    // слой подсветок атак (конусы, круги, линии прицела) рисуется заново каждый кадр
    this.fireGfx.clear();
    this.updateZombies(dt);
    this.updateDragons(dt);
    this.updateTugarins(dt);
    this.bosses.update(dt);
    this.updateMeteors(dt);
    this.projectiles.update(dt, p.x, p.y, PLAYER_BASE.hitRadius, this.state === 'play' && !p.dead);
    this.rebuildGrid();

    if (this.state === 'play') {
      for (const w of this.weapons.values()) w.update(dt);
      this.spawner.update(dt);
      this.updatePickups(dt);
      this.updateHealNumbers(dt);
      this.updateChests(dt);
      this.updateItems(dt);
    }

    this.updateGround();
    this.updateAmbient(dt);
    this.drawHpBar();

    if (this.state === 'play') {
      if (p.hp <= 0) this.onDeath();
      else if (this.pendingLevelUps > 0) this.openLevelUp();
    }
  }

  private rebuildGrid(): void {
    this.grid.clear();
    for (const z of this.zombies) if (z.active && !z.dead) this.grid.insert(z);
  }

  private updateZombies(dt: number): void {
    const p = this.player;
    const decay = Math.exp(-9 * dt);
    const relocateDist = this.spawner.spawnRadius * 1.35;
    for (const z of this.zombies) {
      if (!z.active || z.dead) continue;
      const dx = p.x - z.x, dy = p.y - z.y;
      const d = Math.hypot(dx, dy) || 1;

      // Отставших переносим вперёд по ходу движения богатыря
      if (d > relocateDist) {
        const pt = this.spawner.ringPoint(Math.atan2(p.aimY, p.aimX) + Phaser.Math.FloatBetween(-0.9, 0.9));
        z.setPosition(pt.x, pt.y);
        continue;
      }

      const touchDist = z.radius + PLAYER_BASE.hitRadius;
      const aura = p.stats.slowAura;
      const slow = z.slowT > 0 || (aura > 0 && d < aura) ? 0.45 : 1;
      z.slowT -= dt;
      z.kbTired -= dt;
      let vx = 0, vy = 0;
      const ai = z.ztype.ai ?? 'melee';
      const playing = this.state === 'play' && !p.dead;
      if (ai === 'archer') {
        // Стрелок: держит дистанцию; целится (тонкая линия) — первые полсекунды прицел точно следует за богатырём,
        // потом замирает (вспыхивает светлым) и через ~40 мс летит выстрел в замершую точку: кто двигается — уходит.
        const range = z.ztype.range ?? 260;
        z.aiT -= dt;
        if (z.aiState === 'aim') {
          const locked = z.aiT <= ARCHER_LOCK;
          if (!locked) {
            z.aimX = p.x;
            z.aimY = p.y;
          }
          const k = 1 - Math.max(0, z.aiT - ARCHER_LOCK) / (ARCHER_AIM - ARCHER_LOCK);
          this.fireGfx
            .lineStyle(locked ? 2.5 : 1.5, locked ? 0xffffff : z.ztype.shotTint ?? 0xff4a2a, locked ? 0.95 : 0.3 + 0.4 * k)
            .lineBetween(z.x, z.y - z.figureH * 0.55, z.aimX, z.aimY - p.tall * 0.4);
          if (z.aiT <= 0) {
            if (playing) {
              const orb = z.ztype.shot === 'orb';
              this.projectiles.fire(z.x, z.y, z.aimX, z.aimY, {
                key: z.ztype.shot ?? 'arrow',
                damage: z.damage,
                speed: z.ztype.shotSpeed ?? 380,
                tint: z.ztype.shotTint,
                trail: orb ? z.ztype.shotTint : 0,
                radius: orb ? 11 : 9,
              });
              this.sfx(orb ? 'fire' : 'spear', 0.25, 1.4);
            }
            z.aiState = 'move';
            z.aiT = (z.ztype.shotCd ?? 2.6) * Phaser.Math.FloatBetween(0.85, 1.15);
            z.play({ key: `${z.ztype.anim}-walk`, timeScale: z.ztype.animRate });
          }
        } else {
          if (d > range * 1.15) {
            vx = (dx / d) * z.speed * slow;
            vy = (dy / d) * z.speed * slow;
          } else if (d < range * 0.6) {
            vx = -(dx / d) * z.speed * 0.8 * slow;
            vy = -(dy / d) * z.speed * 0.8 * slow;
          }
          if (playing && d < range * 1.4 && z.aiT <= 0) {
            z.aiState = 'aim';
            z.aiT = ARCHER_AIM;
            z.play({ key: `${z.ztype.anim}-attack`, timeScale: z.ztype.animRate });
          }
        }
      } else if (ai === 'leaper') {
        // Прыгун: подкрадывается, замирает (метка на земле) и прыгает
        z.aiT -= dt;
        if (z.aiState === 'aim') {
          const k = 1 - Math.max(0, z.aiT) / 0.45;
          this.fireGfx.fillStyle(0xff3a1a, 0.15 + 0.25 * k).fillEllipse(z.aimX, z.aimY, 64, 40);
          this.fireGfx.lineStyle(2, 0xff5a2a, 0.5 + 0.5 * k).strokeEllipse(z.aimX, z.aimY, 64, 40);
          if (z.aiT <= 0) {
            z.aiState = 'leap';
            z.leapHit = false;
            z.aiT = Math.hypot(z.aimX - z.x, z.aimY - z.y) / (z.ztype.leapSpeed ?? 560);
          }
        } else if (z.aiState === 'leap') {
          const lx = z.aimX - z.x, ly = z.aimY - z.y, ld = Math.hypot(lx, ly) || 1;
          const step = Math.min(ld, (z.ztype.leapSpeed ?? 560) * dt);
          z.x += (lx / ld) * step;
          z.y += (ly / ld) * step;
          if (playing && !z.leapHit && d < touchDist + 10) {
            z.leapHit = true;
            this.hitPlayer(Math.round(z.damage * 1.5), z);
          }
          if (z.aiT <= 0 || ld < 4) {
            z.aiState = 'move';
            z.aiT = z.ztype.leapCd ?? 3.5;
          }
        } else {
          if (d > touchDist * 0.85 && !p.dead) {
            vx = (dx / d) * z.speed * slow;
            vy = (dy / d) * z.speed * slow;
          }
          const lr = z.ztype.leapRange ?? 230;
          if (playing && d < lr && d > 70 && z.aiT <= 0) {
            z.aiState = 'aim';
            z.aiT = 0.45;
            z.aimX = p.x + (dx / d) * 30;
            z.aimY = p.y + (dy / d) * 30;
          }
        }
      } else if (d > touchDist * 0.85 && !p.dead) {
        vx = (dx / d) * z.speed * slow;
        vy = (dy / d) * z.speed * slow;
      }

      // Расталкиваемся, чтобы не слипаться в одну кучу
      for (const o of this.grid.query(z.x, z.y, z.radius * 2, this.buf)) {
        if (o === z) continue;
        const ox = z.x - o.x, oy = z.y - o.y;
        const min = (z.radius + o.radius) * 0.85;
        const od2 = ox * ox + oy * oy;
        if (od2 >= min * min) continue;
        if (od2 < 0.01) {
          vx += Phaser.Math.FloatBetween(-30, 30);
          vy += Phaser.Math.FloatBetween(-30, 30);
          continue;
        }
        const od = Math.sqrt(od2);
        const push = ((min - od) / min) * 150;
        vx += (ox / od) * push;
        vy += (oy / od) * push;
      }

      vx += z.kbx;
      vy += z.kby;
      z.kbx *= decay;
      z.kby *= decay;
      z.x += vx * dt;
      z.y += vy * dt;

      // Атака вплотную (стрелки врукопашную не бьют, прыгун в прыжке бьёт сам)
      z.attackCd -= dt;
      const touching = d <= touchDist + 4 && !p.dead && ai !== 'archer' && z.aiState === 'move';
      if (touching && z.attackCd <= 0 && this.state === 'play') {
        z.attackCd = 1.2;
        this.hitPlayer(z.damage, z);
      }
      if (touching !== z.touching && ai !== 'archer') {
        z.touching = touching;
        z.play({ key: `${z.ztype.anim}-${touching ? 'attack' : 'walk'}`, timeScale: z.ztype.animRate });
      }

      if (z.flashT > 0) {
        z.flashT -= dt;
        if (z.flashT <= 0) z.restoreTint();
      }
      if (Math.abs(dx) > 4) z.setFlipX(dx < 0);
      z.setDepth(z.y);
      // «лютый» — красный круг под ногами, чтобы угрозу было видно в толпе
      if (z.ztype.elite) this.fireGfx.lineStyle(3, 0xff3a2a, 0.75).strokeEllipse(z.x, z.y, z.radius * 2.6, z.radius * 1.3);
    }
  }

  private updatePickups(dt: number): void {
    const p = this.player;
    if (!this.lowHpTipShown && p.hp < p.stats.maxHp * 0.35 && this.pickups.count > 0 && Save.get().runs < 5) {
      this.lowHpTipShown = true;
      this.bus.emit('toast', t('toast.lowHp'));
    }
    this.gemStreakT -= dt;
    if (this.gemStreakT <= 0) this.gemStreak = 0;
    const healPct = this.pickups.update(dt, p.x, p.y - 10, p.stats.pickupRadius);
    if (healPct > 0) {
      const h = Math.round(p.heal((p.stats.maxHp * healPct) / 100));
      if (h > 0) this.fx.number(p.x, p.y - p.tall - 8, `+${h}`, COLORS.heal, 22);
      this.fx.healGlow(p, -p.tall * 0.45);
      this.sfx('pie', 0.6);
    }
  }

  /** Лечение от вампиризма и оберега копится и показывается раз в полсекунды. */
  private updateHealNumbers(dt: number): void {
    this.healShowT -= dt;
    if (this.healShowT <= 0 && this.healShown >= 1) {
      const p = this.player;
      this.fx.number(p.x + 22, p.y - p.tall - 4, `+${Math.floor(this.healShown)}`, COLORS.heal, 16);
      this.fx.healGlow(p, -p.tall * 0.45);
      this.healShown -= Math.floor(this.healShown);
      this.healShowT = 0.6;
    }
  }

  /** Частицы в воздухе по главе: тени, пепел, угли. */
  private updateAmbient(dt: number): void {
    const kind = this.biome.particles;
    if (kind === 'none') return;
    const rate = kind === 'ash' ? 22 : kind === 'snow' ? 30 : kind === 'embers' ? 14 : kind === 'souls' ? 7 : 5;
    this.ambientAcc += dt * rate;
    const v = this.cameras.main.worldView;
    while (this.ambientAcc >= 1) {
      this.ambientAcc -= 1;
      const x = v.x + Math.random() * v.width;
      const y = kind === 'ash' || kind === 'snow' ? v.y - 40 + Math.random() * v.height * 0.8 : v.y + Math.random() * (v.height + 60);
      this.fx.ambient(kind, x, y);
    }
  }

  private updateGround(): void {
    const v = this.cameras.main.worldView;
    const x = Math.floor(v.x - 64), y = Math.floor(v.y - 64);
    this.ground.setPosition(x, y);
    this.ground.tilePositionX = x / this.groundScale;
    this.ground.tilePositionY = y / this.groundScale;
    this.decor.update(v);
  }

  private drawHpBar(): void {
    const p = this.player;
    const g = this.hpBar;
    g.clear();
    if (p.dead) return;
    if (p.rootT > 0) {
      this.fireGfx.lineStyle(4, 0x8ad86a, 0.85).strokeEllipse(p.x, p.y, 64, 30);
      this.fireGfx.lineStyle(2, 0xd8ffd0, 0.7).strokeEllipse(p.x, p.y - 6, 50, 22);
    }
    if (p.noHealT > 0) this.fireGfx.lineStyle(3, 0xb06aff, 0.5 + 0.3 * Math.sin(this.elapsed * 8)).strokeEllipse(p.x, p.y, 80, 40);
    if (this.rageT > 0) {
      const k = 0.5 + 0.5 * Math.sin(this.elapsed * 10);
      this.fireGfx.fillStyle(0xff3a1a, 0.18 + 0.12 * k).fillEllipse(p.x, p.y, 110, 50);
      this.fireGfx.lineStyle(3, 0xff6a2a, 0.6 + 0.3 * k).strokeEllipse(p.x, p.y, 110 + 10 * k, 50 + 5 * k);
    }
    const w = 54, h = 6, x = p.x - w / 2, y = p.y + 9;
    g.fillStyle(0x000000, 0.65).fillRect(x - 1.5, y - 1.5, w + 3, h + 3);
    g.fillStyle(COLORS.hp, 1).fillRect(x, y, w * Phaser.Math.Clamp(p.hp / p.stats.maxHp, 0, 1), h);
  }

  // ------------------------------------------------------------------
  // API для оружия

  spawnZombie(type: ZombieType, x: number, y: number, hpMul: number, dmgMul = 1): void {
    let z = this.zombies.find((zz) => !zz.active);
    if (!z) {
      z = new Zombie(this);
      this.zombies.push(z);
    }
    z.spawn(type, x, y, hpMul);
    z.damage = Math.round(type.damage * dmgMul);
    this.aliveZombies++;
  }

  /** Живая нечисть (зомби и змеи), задевающая круг (x, y, r) — с учётом их радиуса. */
  queryZombies(x: number, y: number, r: number): Enemy[] {
    const out: Enemy[] = [];
    for (const z of this.grid.query(x, y, r + 30, this.buf)) {
      if (z.dead) continue;
      const rr = r + z.radius;
      const dx = z.x - x, dy = z.y - y;
      if (dx * dx + dy * dy <= rr * rr) out.push(z);
    }
    for (const d of this.bigOnes()) {
      const rr = r + d.radius;
      const dx = d.x - x, dy = d.y - y;
      if (dx * dx + dy * dy <= rr * rr) out.push(d);
    }
    return out;
  }

  nearestZombie(x: number, y: number, maxR: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const z of this.grid.query(x, y, maxR + 30, this.buf)) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - x, z.y - y) - z.radius;
      if (d <= maxR && d < bestD) {
        bestD = d;
        best = z;
      }
    }
    for (const z of this.bigOnes()) {
      const d = Math.hypot(z.x - x, z.y - y) - z.radius;
      if (d <= maxR && d < bestD) {
        bestD = d;
        best = z;
      }
    }
    return best;
  }

  /** Живые боссы, по которым можно бить (кроме ушедших под землю и встающих). */
  private bigOnes(): Enemy[] {
    const out: Enemy[] = [];
    for (const d of this.dragons) if (!d.dead) out.push(d);
    for (const t of this.tugarins) if (!t.dead) out.push(t);
    for (const b of this.bosses.list) if (!b.dead && !b.hidden && b.reviveT <= 0) out.push(b);
    return out;
  }

  /** Все живые боссы — для полосы здоровья. */
  bossList(): Enemy[] {
    return [...this.dragons, ...this.tugarins, ...this.bosses.list].filter((b) => !b.dead);
  }

  /** Щит Святогора: шанс полностью принять удар на щит. */
  private tryBlock(): boolean {
    const p = this.player;
    if (p.stats.blockChance <= 0 || Math.random() >= p.stats.blockChance) return false;
    this.fx.number(p.x - 18, p.y - p.tall - 4, t('fx.block'), '#bfe3ff', 16);
    this.fx.spark(p.x - 20 * p.facing, p.y - p.tall * 0.45, 0xcfe8ff, 0.16);
    this.sfx('block', 0.45);
    return true;
  }

  /**
   * Удар нечисти по богатырю: уворот (шапка-невидимка) → блок (щит) → отбив круговертью → урон
   * → ответ ежовыми рукавицами. Возвращает true, если урон прошёл.
   */
  hitPlayer(raw: number, from: Enemy | null): boolean {
    const p = this.player;
    if (this.invulnT > 0) return false;
    if (p.stats.evasion > 0 && Math.random() < p.stats.evasion) {
      this.fx.number(p.x + 16, p.y - p.tall - 4, t('fx.miss'), '#d8e6ff', 15);
      return false;
    }
    if (this.tryBlock()) {
      this.tryHelix();
      return false;
    }
    // Круговерть, сработавшая от удара, отбивает его — богатырю не нужно «танковать» как Аксу
    if (this.tryHelix()) {
      this.fx.number(p.x - 16, p.y - p.tall - 4, t('fx.parry'), '#ffe08a', 15);
      return false;
    }
    // Камень Алатырь: удар, после которого останется меньше трети здоровья, не проходит — 3 с неуязвимости
    const expected = raw * (1 - Math.min(ARMOR_CAP, p.stats.armor));
    if (this.items.includes('alatyr') && this.alatyrCd <= 0 && p.hp - expected < p.stats.maxHp / 3) {
      this.alatyrCd = 40;
      this.invulnT = 3;
      this.fx.ring(p.x, p.y, 160, 0xfff0b0, 520);
      this.fx.critBurst(p.x, p.y - p.tall * 0.5, 1.6);
      this.fx.number(p.x, p.y - p.tall - 8, t('fx.alatyr'), '#fff0b0', 20, true);
      this.sfx('soul0', 0.5, 0.5);
      return false;
    }
    const dmg = p.takeDamage(raw);
    if (dmg <= 0) return false;
    this.fx.number(p.x, p.y - p.tall - 4, dmg, '#ff5a4a', 18);
    this.sfx('hurt', 0.35);
    this.bus.emit('hurt');
    if (from && p.stats.thorns > 0 && !from.dead) this.damageZombie(from, raw * p.stats.thorns, p.x, p.y, 220, 'splash');
    return true;
  }

  /**
   * Богатырский удар босса (подсвеченный приём — от него надо уходить): мимо не пройдёт, щитом и круговертью
   * не отбить, броня держит вдвое хуже. Урон — не меньше pct от здоровья богатыря (в поздних главах больше),
   * иначе прокачанного по самые брови богатыря боссы бы и не замечали.
   */
  hitPlayerHard(raw: number, pct: number, from: Enemy | null): boolean {
    const p = this.player;
    if (this.invulnT > 0) return false;
    const dmgRaw = Math.max(raw, p.stats.maxHp * pct * this.spawner.bossPctK);
    const expected = dmgRaw * (1 - Math.min(ARMOR_CAP, p.stats.armor) * 0.5);
    if (this.items.includes('alatyr') && this.alatyrCd <= 0 && p.hp - expected < p.stats.maxHp / 3) {
      this.alatyrCd = 40;
      this.invulnT = 3;
      this.fx.ring(p.x, p.y, 160, 0xfff0b0, 520);
      this.fx.critBurst(p.x, p.y - p.tall * 0.5, 1.6);
      this.fx.number(p.x, p.y - p.tall - 8, t('fx.alatyr'), '#fff0b0', 20, true);
      this.sfx('soul0', 0.5, 0.5);
      return false;
    }
    const dmg = p.takeDamage(dmgRaw, 0.5);
    if (dmg <= 0) return false;
    this.fx.number(p.x, p.y - p.tall - 4, dmg, '#ff3a2a', 22, true);
    this.sfx('hurt', 0.45, 0.85);
    this.bus.emit('hurt');
    if (this.shakeCd <= 0) {
      this.cameras.main.shake(120, 0.004);
      this.shakeCd = 0.25;
    }
    if (from && p.stats.thorns > 0 && !from.dead) this.damageZombie(from, raw * p.stats.thorns, p.x, p.y, 220, 'splash');
    return true;
  }

  // ------------------------------------------------------------------
  // Сундуки и предметы

  /** Сундук на земле. minRarity — не хуже этой редкости (со змея — дивное и выше). */
  spawnChest(x: number, y: number, minRarity: Rarity = 'common'): void {
    if (this.chests.length >= 4) return;
    const glow = this.add.image(x, y - 14, 'circle_05').setBlendMode(Phaser.BlendModes.ADD).setTint(minRarity === 'common' ? 0xffd27a : RARITY[minRarity].color).setScale(0.22, 0.16).setAlpha(0.7);
    const img = this.add.image(x, y, 'chest').setOrigin(0.5, 0.92).setScale(0.95 / TEX_RES).setDepth(y);
    glow.setDepth(y - 1);
    this.tweens.add({ targets: glow, alpha: 0.35, scaleX: 0.28, scaleY: 0.2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    img.setScale(0);
    this.tweens.add({ targets: img, scale: 0.95 / TEX_RES, duration: 320, ease: 'Back.easeOut' });
    this.chests.push({ x, y, img, glow, minRarity });
  }

  private updateChests(dt: number): void {
    const p = this.player;
    // новый сундук где-то в лесу (не больше двух обычных на карте)
    this.chestT -= dt;
    if (this.chestT <= 0) {
      this.chestT = Phaser.Math.FloatBetween(100, 140);
      if (this.chests.length < 2) {
        const a = Math.random() * Math.PI * 2, r = Phaser.Math.FloatBetween(380, 600);
        this.spawnChest(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.85);
        this.bus.emit('toast', this.biome.id === 'forest' ? t('toast.chestForest') : t('toast.chestNear'));
      }
    }
    for (const c of this.chests) {
      if (Math.hypot(c.x - p.x, c.y - p.y) < 50) {
        this.openChest(c);
        break;
      }
    }
  }

  private openChest(c: Chest): void {
    this.chests = this.chests.filter((x) => x !== c);
    this.tweens.killTweensOf(c.glow);
    c.glow.destroy();
    c.img.setTexture('chest-open');
    this.fx.critBurst(c.x, c.y - 20, 1.4);
    this.fx.ring(c.x, c.y, 120, 0xffd27a, 500);
    this.tweens.add({ targets: c.img, alpha: 0, delay: 500, duration: 300, onComplete: () => c.img.destroy() });
    const late = Phaser.Math.Clamp(this.elapsed / 600, 0, 1);
    this.chestRarity = c.minRarity;
    const id = rollItem(new Set(this.items), c.minRarity, late) ?? rollItem(new Set(this.items), 'common', late);
    if (!id) {
      // всё уже собрано — в сундуке пирожки
      const h = Math.round(this.player.heal(this.player.stats.maxHp * 0.5));
      this.fx.number(c.x, c.y - 60, `+${h}`, COLORS.heal, 22);
      this.sfx('pie', 0.6);
      return;
    }
    this.state = 'chest';
    this.sfx('levelup', 0.55);
    this.time.delayedCall(260, () => {
      this.bus.emit('chest', id);
      this.scene.pause();
      Platform.gameplayStop();
    });
  }

  /** Игрок забрал предмет из сундука (вызывает UI). */
  takeItem(id: ItemId): void {
    if (!this.items.includes(id)) this.items.push(id);
    const p = this.player;
    this.recalcStats();
    if (id === 'apple') p.heal(p.stats.maxHp);
    this.bus.emit('abilities');
    this.state = 'play';
    this.scene.resume();
    this.fx.ring(p.x, p.y, 140, RARITY[ITEM_BY_ID.get(id)!.rarity].color, 520);
    Platform.gameplayStart();
  }

  /** Периодические эффекты предметов: скатерть-самобранка и вечевой колокол. */
  private updateItems(dt: number): void {
    const p = this.player;
    if (this.items.includes('tablecloth')) {
      this.feastT -= dt;
      if (this.feastT <= 0) {
        this.feastT = 20;
        const h = Math.round(p.heal(p.stats.maxHp * 0.2));
        if (h > 0) {
          this.fx.number(p.x, p.y - p.tall - 8, `+${h}`, COLORS.heal, 22);
          this.fx.healGlow(p, -p.tall * 0.45);
          this.sfx('pie', 0.4);
        }
      }
    }
    if (this.items.includes('bell')) {
      this.bellT -= dt;
      if (this.bellT <= 0) {
        const r = 170 * p.stats.area;
        if (!this.nearestZombie(p.x, p.y, r)) {
          this.bellT = 0.3;
        } else {
          this.bellT = 6 * p.stats.haste;
          this.fx.ring(p.x, p.y, r, 0xffd27a, 450);
          this.sfx('soul0', 0.5, 0.5);
          for (const z of this.queryZombies(p.x, p.y, r)) this.damageZombie(z, 45, p.x, p.y, 520, 'splash');
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Змей Горыныч

  spawnDragon(x: number, y: number, hpMul: number, fused = false): void {
    const d = new Dragon(this, x, y, fused);
    d.hp = d.maxHp = Math.round(DRAGON.hp * hpMul * (fused ? 2.5 : 1));
    d.damage = Math.round(DRAGON.damage * this.spawner.dmgMul * (fused ? 1.3 : 1));
    if (fused) {
      d.radius = DRAGON.radius * 1.22;
      d.fireT = 1.5;
    }
    this.dragons.push(d);
    this.sfx('roar', 0.7, fused ? 0.8 : 1);
    this.cameras.main.shake(260, 0.004);
  }

  // ------------------------------------------------------------------
  // Режим тестера

  /** Ускорение времени: логика, твины, таймеры и анимации. */
  setTimeScale(k: number): void {
    this.timeScale = k;
    this.tweens.timeScale = k;
    this.time.timeScale = k;
    this.anims.globalTimeScale = k;
  }

  /** +n уровней сразу, умения выбираются случайно (без окна выбора). */
  debugLevels(n: number): void {
    for (let i = 0; i < n; i++) {
      this.level++;
      this.xp = 0;
      this.xpNext = xpForLevel(this.level);
      const choices = this.rollChoices(3);
      const pick = choices[Math.floor(Math.random() * choices.length)];
      if (pick === 'pie') this.player.heal(this.player.stats.maxHp * 0.3);
      else this.addAbility(pick);
    }
    this.fx.ring(this.player.x, this.player.y, 150, COLORS.gold, 520);
  }

  /** Все умения на максимум. */
  debugMaxAll(): void {
    for (const a of ABILITIES) {
      if (a.kind === 'consumable') continue;
      while ((this.levels.get(a.id) ?? 0) < a.maxLevel) this.addAbility(a.id);
    }
  }

  debugAddTime(sec: number): void {
    this.elapsed += sec;
  }

  debugBoss(): void {
    this.spawner.forceBoss();
  }

  debugChapter(): void {
    for (const b of [...this.dragons, ...this.tugarins]) if (!b.dead) this.killZombie(b);
    for (const b of this.bosses.list) {
      if (b.dead) continue;
      b.lives = 0;
      b.reviveT = 0;
      this.killZombie(b);
    }
    this.spawner.forceChapter();
  }

  debugKillAll(): void {
    for (const z of this.zombies) if (z.active && !z.dead) this.damageZombie(z, 1e9, z.x, z.y, 0, 'splash');
  }

  debugChest(): void {
    this.spawnChest(this.player.x + 70, this.player.y + 10);
  }

  /** Жив ли хоть один босс (очередь боссов ждёт, пока все падут). */
  bossesAlive(): boolean {
    return this.dragons.some((d) => !d.dead) || this.tugarins.some((t) => !t.dead) || this.bosses.alive();
  }

  /** Призыв босса по виду (из очереди главы). */
  spawnBoss(kind: BossKind, x: number, y: number, hpMul: number): void {
    switch (kind) {
      case 'gorynych':
        this.spawnDragon(x, y, hpMul);
        break;
      case 'tugarin':
        this.spawnTugarin(x, y, hpMul);
        break;
      case 'fused':
        this.spawnDragon(x, y, hpMul, true);
        break;
      default: {
        // картинки главы ещё грузятся (бывает только в режиме тестера) — подождём
        if (!this.bosses.ready(kind)) {
          const biome = BIOMES.find((b) => b.bosses.includes(kind));
          if (biome) LazyAssets.ensure(this, biome.assets);
          this.time.delayedCall(500, () => this.spawnBoss(kind, x, y, hpMul));
          return;
        }
        const b = this.bosses.spawn(kind, x, y, hpMul);
        if (b) {
          this.sfx('roar', 0.65, kind === 'chernobog' ? 0.6 : 0.9);
          this.cameras.main.shake(260, 0.004);
        }
      }
    }
  }

  /** Огненный дождь: метка на земле, через t секунд туда падает пламя. */
  addMeteor(x: number, y: number, t: number): void {
    this.meteors.push({ x, y, t });
  }

  /** Переход в новую главу: затемнение, смена земли, декора и настроения, нечисть — с чистого листа. */
  enterChapter(biome: BiomeDef, lap: number): void {
    const cam = this.cameras.main;
    cam.fadeOut(650, 0, 0, 0);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // естественная пауза между главами — тут уместна полноэкранная реклама (частоту ограничивает площадка)
      void this.midgameAd(true).then(() => LazyAssets.ensure(this, biome.assets, () => this.afterFade(biome, lap)));
    });
  }

  private afterFade(biome: BiomeDef, lap: number): void {
    const cam = this.cameras.main;
    {
      // старая нечисть рассеивается вместе с прежней землёй
      for (const z of this.zombies) {
        if (!z.active) continue;
        z.dead = true;
        z.setActive(false).setVisible(false);
      }
      this.aliveZombies = 0;
      this.meteors = [];
      this.projectiles.clear();
      this.applyBiome(biome, lap);
      this.bus.emit('toast', tx(biome.title));
      cam.fadeIn(800, 0, 0, 0);
    }
    const idx = BIOMES.indexOf(biome);
    if (idx > (Save.get().maxChapter ?? 0)) {
      Save.update((d) => (d.maxChapter = idx));
      Platform.happytime();
    }
    // следующая глава — фоном; атласы прошлых глав освобождаем (через паузу — вдруг кто-то ещё тает)
    const next = BIOMES[(BIOMES.indexOf(biome) + 1) % BIOMES.length];
    LazyAssets.ensure(this, next.assets);
    this.time.delayedCall(5000, () => LazyAssets.release(this, [...biome.assets, ...next.assets]));
  }

  private applyBiome(biome: BiomeDef, lap: number): void {
    const p = this.player;
    this.biome = biome;
    this.groundScale = biome.groundScale;
    this.ground.setTexture(biome.ground).setTint(biome.groundTint).setScale(this.groundScale);
    this.onResize();
    this.cameras.main.setBackgroundColor(biome.bg);
    this.decor.setKinds(biome.decor, p.x, p.y, (BIOMES.indexOf(biome) + 1) * 7919 + lap * 104729);
    this.bus.emit('biome', biome);
  }

  spawnTugarin(x: number, y: number, hpMul: number): void {
    const t = new Tugarin(this, x, y);
    t.hp = t.maxHp = Math.round(TUGARIN.hp * hpMul);
    t.dmgMul = this.spawner.dmgMul;
    this.tugarins.push(t);
    this.sfx('roar', 0.6, 1.3);
    this.cameras.main.shake(200, 0.003);
  }

  private updateDragons(dt: number): void {
    const p = this.player;
    const g = this.fireGfx;
    const decay = Math.exp(-6 * dt);
    for (const d of this.dragons) {
      if (d.dead) continue;
      const dx = p.x - d.x, dy = p.y - d.y;
      const dist = Math.hypot(dx, dy) || 1;
      const playing = this.state === 'play' && !p.dead;

      // Идёт к богатырю, пока не дышит огнём
      if ((d.fireState === 'idle' || d.fireState === 'aim') && Math.abs(dx) > 10) {
        const f = dx > 0 ? 1 : -1;
        if (f !== d.facing) {
          d.facing = f;
          d.turned = true;
        }
      }
      const touchDist = d.radius + PLAYER_BASE.hitRadius;
      const slow = d.slowT > 0 || (p.stats.slowAura > 0 && dist < p.stats.slowAura + d.radius) ? 0.6 : 1;
      d.slowT -= dt;
      d.kbTired -= dt;
      if (playing && (d.fireState === 'idle' || d.fireState === 'aim') && dist > touchDist * 0.8) {
        d.x += (dx / dist) * d.speed * slow * dt;
        d.y += (dy / dist) * d.speed * slow * dt;
      }
      d.x += d.kbx * dt;
      d.y += d.kby * dt;
      d.kbx *= decay;
      d.kby *= decay;
      // Отставшего змея переносим ближе (но за край экрана)
      if (dist > this.spawner.spawnRadius * 1.6) {
        const pt = this.spawner.ringPoint(Math.atan2(-dy, -dx));
        d.setPosition(pt.x, pt.y);
      }

      // Тяжёлая поступь — топчет зомби рядом не будем, просто атака вплотную
      d.attackCd -= dt;
      if (playing && dist <= touchDist + 6 && d.attackCd <= 0) {
        d.attackCd = 1.2;
        if (this.hitPlayer(d.damage, d)) this.sfx('dstomp', 0.5, 0.7);
      }

      // Огненное дыхание: прицел (голова наливается красным, на земле конус) → выдох
      if (playing) this.updateDragonFire(d, dt, dist, g);
      // Тугаро-Горыныч: наездник призывает огненный дождь
      if (playing && d.fused) {
        d.rainT -= dt;
        if (d.rainT <= 0 && dist < 650) {
          d.rainT = 6.5;
          d.rider?.attack('chop');
          this.meteors.push({ x: p.x, y: p.y, t: 1.1 });
          for (let i = 0; i < 6; i++) {
            const a = Math.random() * Math.PI * 2, r = Phaser.Math.FloatBetween(60, 190);
            this.meteors.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.8, t: 1.1 + i * 0.12 });
          }
        }
      }
      d.animate(dt);
      d.setDepth(d.y);
    }
    if (this.dragons.some((d) => d.dead && !d.active)) this.dragons = this.dragons.filter((d) => d.active);
  }

  private updateDragonFire(d: Dragon, dt: number, dist: number, g: Phaser.GameObjects.Graphics): void {
    const p = this.player;
    d.fireT -= dt;
    // Точка на земле под пастью — отсюда считаем конус и направление на ноги богатыря
    const ground = () => {
      const m = d.mouth();
      return { m, gx: m.x, gy: d.y - 4, want: Math.atan2(p.y - (d.y - 4), p.x - m.x) };
    };
    if (d.fireState === 'idle') {
      if (d.fireT > 0) return;
      if (dist < DRAGON.ringRadius + 10) {
        // Вплотную: все головы вниз — огненное кольцо вокруг себя
        d.fireState = 'ringAim';
        d.fireT = DRAGON.ringAim;
        d.fireAng = Math.PI / 2;
        this.sfx('roar', 0.45, 1.25);
      } else if (dist < DRAGON.fireRange * 1.15) {
        d.fireState = 'aim';
        d.fireT = DRAGON.aimTime;
        d.fireHead = Phaser.Math.Between(0, 2);
        d.fireAng = ground().want;
      }
      return;
    }
    if (d.fireState === 'ringAim' || d.fireState === 'ring') {
      this.updateDragonRing(d, dt, dist, g);
      return;
    }
    const { m, gx, gy, want } = ground();
    const ga = d.fireAng;
    const half = DRAGON.fireHalfAngle;
    if (d.fireState === 'aim') {
      // Пока целится — доворачивает за богатырём (можно увернуться), а если тот забежал за спину — разворачивается
      if (d.turned) {
        // развернулся за спину — прицел заново, но с запасом времени на уклонение
        d.fireAng = want;
        d.fireT = Math.max(d.fireT, 0.6);
      } else {
        d.fireAng = Phaser.Math.Angle.RotateTo(d.fireAng, want, DRAGON.aimTurn * dt);
      }
      d.turned = false;
      const k = 1 - Math.max(0, d.fireT) / DRAGON.aimTime;
      g.fillStyle(0xff3a1a, 0.12 + k * 0.18);
      g.slice(gx, gy, DRAGON.fireRange, ga - half, ga + half, false).fillPath();
      g.lineStyle(2, 0xff5a2a, 0.5 + k * 0.4);
      g.slice(gx, gy, DRAGON.fireRange, ga - half, ga + half, false).strokePath();
      if (d.fireT <= 0) {
        d.fireState = 'breath';
        d.fireT = 1.2;
        d.fireTick = 0;
        d.endAim();
        this.sfx('fire', 0.5);
      }
      return;
    }
    // Выдох
    g.fillStyle(0xff6a1a, 0.18);
    g.slice(gx, gy, DRAGON.fireRange, ga - half, ga + half, false).fillPath();
    // Пламя выпускаем по времени (40 клубов в секунду), а не каждый кадр — иначе на 144 Гц сплошной луч
    d.fireEmit += dt;
    while (d.fireEmit >= 1 / 40) {
      d.fireEmit -= 1 / 40;
      this.fx.fire(m.x, m.y, d.fireAng, DRAGON.fireRange, gy + Math.sin(d.fireAng) * DRAGON.fireRange);
    }
    d.fireTick -= dt;
    if (d.fireTick <= 0) {
      d.fireTick = 0.2;
      this.sfx('fire', 0.3, Phaser.Math.FloatBetween(0.9, 1.1));
      const px = p.x - gx, py = p.y - gy;
      const pd = Math.hypot(px, py);
      const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(py, px) - ga));
      if (pd < DRAGON.fireRange + PLAYER_BASE.hitRadius && (da < half || pd < 40)) {
        this.hitPlayerHard(Math.round(DRAGON.fireDmg * this.spawner.dmgMul), 0.06, d);
      }
    }
    if (d.fireT <= 0) {
      d.fireState = 'idle';
      d.fireT = DRAGON.fireCd * Phaser.Math.FloatBetween(0.85, 1.2);
    }
  }

  // ------------------------------------------------------------------
  // Тугарин Змеевич

  private updateTugarins(dt: number): void {
    const p = this.player;
    const g = this.fireGfx;
    const decay = Math.exp(-6 * dt);
    const playing = this.state === 'play' && !p.dead;
    for (const t of this.tugarins) {
      if (t.dead) continue;
      const dx = p.x - t.x, dy = p.y - t.y;
      const dist = Math.hypot(dx, dy) || 1;
      t.slowT -= dt;
      t.kbTired -= dt;
      t.flashCd -= dt;
      t.attackCd -= dt;
      if (playing) {
        t.slashCd -= dt;
        t.dashCd -= dt;
        t.stateT -= dt;
      }
      const slow = t.slowT > 0 || (p.stats.slowAura > 0 && dist < p.stats.slowAura + t.radius) ? 0.6 : 1;
      let moving = false;
      let animK = 0.75;

      switch (t.tstate) {
        case 'walk': {
          if (Math.abs(dx) > 8) t.facing = dx > 0 ? 1 : -1;
          if (playing && dist > t.radius + 26) {
            t.x += (dx / dist) * TUGARIN.speed * slow * dt;
            t.y += (dy / dist) * TUGARIN.speed * slow * dt;
            moving = true;
          }
          if (!playing) break;
          if (dist < TUGARIN.slashRadius * 0.8 && t.slashCd <= 0) {
            // замах саблей: сектор подсвечивается на земле
            t.tstate = 'slashAim';
            t.stateT = TUGARIN.slashWindup;
            t.aimAng = Math.atan2(dy, dx);
            t.swung = false;
          } else if (dist > TUGARIN.dashMin && dist < TUGARIN.dashMax && t.dashCd <= 0) {
            // рывок: полоса на земле до точки чуть за богатырём
            t.tstate = 'dashAim';
            t.stateT = TUGARIN.dashAim;
            t.aimAng = Math.atan2(dy, dx);
            const len = Math.min(dist + 120, TUGARIN.dashMax + 80);
            t.dashTx = t.x + Math.cos(t.aimAng) * len;
            t.dashTy = t.y + Math.sin(t.aimAng) * len;
            this.sfx('roar', 0.35, 1.6);
          }
          break;
        }
        case 'slashAim': {
          const k = 1 - Math.max(0, t.stateT) / TUGARIN.slashWindup;
          const half = TUGARIN.slashArc / 2;
          g.fillStyle(0xff3a1a, 0.12 + k * 0.2);
          g.slice(t.x, t.y, TUGARIN.slashRadius, t.aimAng - half, t.aimAng + half, false).fillPath();
          g.lineStyle(2, 0xff5a2a, 0.5 + k * 0.4);
          g.slice(t.x, t.y, TUGARIN.slashRadius, t.aimAng - half, t.aimAng + half, false).strokePath();
          // взмах анимации заранее, чтобы удар пришёлся на конец замаха
          if (!t.swung && t.stateT <= 0.14) {
            t.swung = true;
            t.attack('chop');
          }
          if (t.stateT <= 0) {
            this.fx.slash(t, -t.figureH * 0.42, t.aimAng, TUGARIN.slashRadius, TUGARIN.slashArc, 0xff8a6a);
            this.sfx('swing', 0.6, 0.6);
            const da = Math.abs(Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - t.aimAng));
            if (playing && dist < TUGARIN.slashRadius + PLAYER_BASE.hitRadius && (da < half || dist < 50)) {
              this.hitPlayerHard(Math.round(TUGARIN.slashDmg * this.spawner.dmgMul), 0.2, t);
            }
            t.tstate = 'recover';
            t.stateT = 0.5;
            t.slashCd = TUGARIN.slashCd;
          }
          break;
        }
        case 'dashAim': {
          if (Math.abs(t.dashTx - t.x) > 8) t.facing = t.dashTx > t.x ? 1 : -1;
          const k = 1 - Math.max(0, t.stateT) / TUGARIN.dashAim;
          g.lineStyle(t.radius * 1.6, 0xff3a1a, 0.12 + k * 0.22).lineBetween(t.x, t.y, t.dashTx, t.dashTy);
          g.lineStyle(2, 0xff5a2a, 0.6 + k * 0.4).lineBetween(t.x, t.y, t.dashTx, t.dashTy);
          if (t.stateT <= 0) {
            t.tstate = 'dash';
            t.stateT = Math.hypot(t.dashTx - t.x, t.dashTy - t.y) / TUGARIN.dashSpeed;
            t.dashHit = false;
            t.attack('thrust');
            this.sfx('helix', 0.6, 0.7);
          }
          break;
        }
        case 'dash': {
          const ddx = t.dashTx - t.x, ddy = t.dashTy - t.y;
          const dd = Math.hypot(ddx, ddy) || 1;
          const step = Math.min(dd, TUGARIN.dashSpeed * dt);
          t.x += (ddx / dd) * step;
          t.y += (ddy / dd) * step;
          moving = true;
          animK = 2.6;
          if (Math.random() < 0.5) this.fx.puff(t.x, t.y - 6, 0xb89a70, 0.12, t.y - 1);
          if (playing && !t.dashHit && Math.hypot(p.x - t.x, p.y - t.y) < t.radius + PLAYER_BASE.hitRadius + 8) {
            t.dashHit = true;
            this.hitPlayerHard(Math.round(TUGARIN.dashDmg * this.spawner.dmgMul), 0.25, t);
          }
          if (t.stateT <= 0 || dd < 6) {
            t.tstate = 'recover';
            t.stateT = 0.7;
            t.dashCd = TUGARIN.dashCd;
          }
          break;
        }
        case 'recover':
          if (t.stateT <= 0) t.tstate = 'walk';
          break;
      }

      // вплотную ещё и пинает
      if (playing && t.tstate === 'walk' && dist < t.radius + PLAYER_BASE.hitRadius + 4 && t.attackCd <= 0) {
        t.attackCd = 1.1;
        this.hitPlayer(Math.round(TUGARIN.contactDmg * t.dmgMul), t);
      }
      t.x += t.kbx * dt;
      t.y += t.kby * dt;
      t.kbx *= decay;
      t.kby *= decay;
      if (dist > this.spawner.spawnRadius * 1.6) {
        const pt = this.spawner.ringPoint(Math.atan2(-dy, -dx));
        t.setPosition(pt.x, pt.y);
      }
      t.animate(dt, moving, animK);
      t.setDepth(t.y);
      t.shadow.setPosition(t.x, t.y - 1);
    }
  }

  private killTugarin(tg: Tugarin): void {
    const p = this.player;
    this.kills++;
    this.bossKills++;
    tg.tstate = 'recover';
    this.addXp(TUGARIN.xp * p.stats.xpMul);
    for (let i = 0; i < 8; i++) {
      this.time.delayedCall(i * 60, () => this.fx.soul(tg.x + Phaser.Math.Between(-30, 30), tg.y - Phaser.Math.Between(40, 140), p, -p.tall * 0.5, true));
    }
    this.fx.splat(tg.x, tg.y - 4, 1.6);
    this.fx.ring(tg.x, tg.y, 180, 0xff8a5a, 600);
    if (this.chestWave !== this.spawner.bossWave) {
      this.chestWave = this.spawner.bossWave;
      this.spawnChest(tg.x, tg.y + 10, 'epic');
    }
    this.pickups.spawn(tg.x - 20, tg.y + 6, 25);
    this.cameras.main.shake(260, 0.005);
    this.sfx('roar', 0.55, 1.1);
    this.bus.emit('toast', t('toast.defeated', { name: tx(TUGARIN.name) }));
    tg.die(() => {
      this.tugarins = this.tugarins.filter((x) => x !== tg);
    });
  }

  /** Огненный дождь: круги на земле, через секунду туда падает пламя. */
  private updateMeteors(dt: number): void {
    if (this.meteors.length === 0) return;
    const p = this.player;
    const g = this.fireGfx;
    const R = 62;
    const playing = this.state === 'play' && !p.dead;
    for (const m of this.meteors) {
      if (playing) m.t -= dt;
      const k = Phaser.Math.Clamp(1 - m.t / 1.1, 0, 1);
      g.fillStyle(0xff3a1a, 0.1 + k * 0.25).fillEllipse(m.x, m.y, R * 2, R * 1.4);
      g.lineStyle(2, 0xff6a2a, 0.5 + k * 0.5).strokeEllipse(m.x, m.y, R * 2 * (1 - k * 0.6), R * 1.4 * (1 - k * 0.6));
      if (m.t <= 0) {
        this.fx.critBurst(m.x, m.y - 20, 1.3);
        for (let i = 0; i < 5; i++) this.fx.fire(m.x, m.y - 120, Math.PI / 2 + (Math.random() - 0.5) * 0.6, 110, m.y);
        this.fx.ring(m.x, m.y, R, 0xffa040, 300);
        this.sfx('thunder', 0.35, 0.7);
        const ex = (p.x - m.x) / R, ey = (p.y - m.y) / (R * 0.7);
        if (playing && ex * ex + ey * ey <= 1.15) {
          this.hitPlayerHard(Math.round(DRAGON.ringDmg * 1.2 * this.spawner.dmgMul), 0.18, null);
        }
      }
    }
    this.meteors = this.meteors.filter((m) => m.t > 0);
  }

  /** Огненное кольцо вокруг змея: подсветка на земле → выдох вниз всеми головами. */
  private updateDragonRing(d: Dragon, dt: number, dist: number, g: Phaser.GameObjects.Graphics): void {
    const p = this.player;
    const R = DRAGON.ringRadius;
    const cy = d.y - 4;
    if (d.fireState === 'ringAim') {
      const k = 1 - Math.max(0, d.fireT) / DRAGON.ringAim;
      g.fillStyle(0xff3a1a, 0.1 + k * 0.2).fillEllipse(d.x, cy, R * 2, R * 1.4);
      g.lineStyle(3, 0xff5a2a, 0.5 + k * 0.45).strokeEllipse(d.x, cy, R * 2, R * 1.4);
      if (d.fireT <= 0) {
        d.fireState = 'ring';
        d.fireT = 0.55;
        d.fireTick = 0;
        d.endAim();
        this.sfx('fire', 0.6, 0.8);
        this.cameras.main.shake(160, 0.004);
        // волна огня во все стороны
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * Math.PI * 2;
          this.fx.fire(d.x + Math.cos(a) * 30, cy - 40, a, R, cy + Math.sin(a) * R * 0.7);
        }
      }
      return;
    }
    g.fillStyle(0xff6a1a, 0.16).fillEllipse(d.x, cy, R * 2, R * 1.4);
    d.fireEmit += dt;
    while (d.fireEmit >= 1 / 50) {
      d.fireEmit -= 1 / 50;
      const a = Math.random() * Math.PI * 2;
      this.fx.fire(d.x + Math.cos(a) * 30, cy - 40, a, R * Phaser.Math.FloatBetween(0.6, 1), cy + Math.sin(a) * R * 0.7);
    }
    // урон один раз за выдох, если богатырь внутри кольца (эллипс на земле)
    if (d.fireTick === 0) {
      d.fireTick = 1;
      const ex = (p.x - d.x) / R, ey = (p.y - cy) / (R * 0.7);
      if (ex * ex + ey * ey <= 1.1) {
        this.hitPlayerHard(Math.round(DRAGON.ringDmg * this.spawner.dmgMul), 0.25, d);
      }
    }
    if (d.fireT <= 0) {
      d.fireState = 'idle';
      d.fireT = DRAGON.fireCd * Phaser.Math.FloatBetween(0.85, 1.2);
    }
    void dist;
  }

  private killSpriteBoss(b: BossActor): void {
    const p = this.player;
    this.kills++;
    this.bossKills++;
    this.addXp(b.def.xp * p.stats.xpMul);
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 60, () => this.fx.soul(b.x + Phaser.Math.Between(-40, 40), b.y - Phaser.Math.Between(40, b.figureH), p, -p.tall * 0.5, true));
    }
    this.fx.splat(b.x, b.y - 4, 1.8);
    this.fx.ring(b.x, b.y, 200, 0xffd27a, 600);
    if (this.chestWave !== this.spawner.bossWave) {
      this.chestWave = this.spawner.bossWave;
      this.spawnChest(b.x, b.y + 10, 'epic');
    }
    this.pickups.spawn(b.x - 20, b.y + 6, 25);
    this.cameras.main.shake(300, 0.006);
    this.sfx('roar', 0.6, 0.8);
    this.bus.emit('toast', t('toast.defeated', { name: tx(b.def.name) }));
    b.die(() => {
      this.bosses.list = this.bosses.list.filter((x) => x !== b);
    });
  }

  private killDragon(d: Dragon): void {
    const p = this.player;
    this.kills++;
    this.bossKills++;
    d.fireState = 'idle';
    this.fireGfx.clear();
    this.addXp(d.ztype.xp * p.stats.xpMul);
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 60, () => this.fx.soul(d.x + Phaser.Math.Between(-50, 50), d.y - Phaser.Math.Between(40, 160), p, -p.tall * 0.5, true));
    }
    this.fx.splat(d.x, d.y - 4, 2.4);
    this.fx.ring(d.x, d.y, 220, 0x9dff7a, 600);
    for (let i = 0; i < 6; i++) this.fx.puff(d.x + Phaser.Math.Between(-60, 60), d.y - Phaser.Math.Between(20, 140), 0x8dff9a, 0.3);
    // сундук — только с первого змея каждого прилёта, чтобы предметы не кончались слишком быстро
    if (this.chestWave !== this.spawner.bossWave) {
      this.chestWave = this.spawner.bossWave;
      this.spawnChest(d.x, d.y + 10, 'epic');
    }
    this.pickups.spawn(d.x - 20, d.y + 6, 25);
    this.cameras.main.shake(320, 0.006);
    this.sfx('roar', 0.6, 0.85);
    this.bus.emit('toast', t('toast.defeated', { name: tx(d.ztype.name) }));
    d.die(() => {
      this.dragons = this.dragons.filter((x) => x !== d);
    });
  }

  /**
   * kind: 'hit' — обычный удар оружием (вампиризм, рассечение, молнии перстня);
   * 'helix' — круговерть (вампиризм вчетверо слабее); 'splash' — рассечение, ответ рукавиц, колокол
   * (без вампиризма и без цепных эффектов).
   */
  damageZombie(z: Enemy, base: number, fromX: number, fromY: number, knock: number, kind: DamageKind = 'hit'): void {
    if (z.dead) return;
    const ba = z as Partial<BossActor>;
    if ((ba.invulnT ?? 0) > 0 || ba.hidden || (ba.reviveT ?? 0) > 0) return;
    const p = this.player;
    // Богатырская затрещина (крит)
    const crit = p.stats.critChance > 0 && Math.random() < p.stats.critChance;
    const mul = crit ? p.stats.critMul : 1;
    const dmg = Math.max(1, Math.round(base * mul * p.stats.might * Phaser.Math.FloatBetween(0.9, 1.1)));
    z.hp -= dmg;
    z.flash();
    const dx = z.x - fromX, dy = z.y - fromY;
    const d = Math.hypot(dx, dy) || 1;
    // Сопротивление отбросу растёт со временем, а сразу после толчка нечисть «устаёт» отлетать
    const grow = Math.min(0.5, (this.elapsed / 60) * 0.06);
    const resist = 1 - (1 - z.ztype.knockbackResist) * (1 - grow);
    const k = knock * (crit ? 1.8 : 1) * (1 - resist) * (z.kbTired > 0 ? 0.5 : 1);
    if (k > 40) z.kbTired = 0.35;
    if (k > Math.hypot(z.kbx, z.kby)) {
      z.kbx = (dx / d) * k;
      z.kby = (dy / d) * k;
    }
    const headY = z.y - z.figureH * 0.95;
    const midY = z.y - z.figureH * 0.5;
    if (crit) {
      this.fx.number(z.x, headY - 6, `${dmg}!`, COLORS.crit, 26, true);
      this.fx.critBurst(z.x, midY, 0.8 + z.ztype.scale * 0.5);
      this.sfx('crit', 0.55);
      if (this.shakeCd <= 0) {
        this.cameras.main.shake(70, 0.0022);
        this.shakeCd = 0.25;
      }
    } else {
      this.fx.number(z.x, headY, dmg, dmg >= 30 ? COLORS.dmgBig : COLORS.dmg, dmg >= 30 ? 22 : 17);
      this.fx.spark(z.x, midY);
      this.sfx('hit', 0.28);
    }

    // Живая вода: малый вампиризм (круговерть — вчетверо слабее, рассечение — без него)
    const ls = kind === 'hit' ? 1 : kind === 'helix' ? 0.25 : 0;
    if (p.stats.lifesteal > 0 && ls > 0) {
      this.healAcc = Math.min(this.healAcc + dmg * p.stats.lifesteal * ls, 5);
      const whole = Math.min(Math.floor(this.healAcc), Math.floor(this.lsBudget));
      if (whole >= 1) {
        this.healAcc -= whole;
        this.lsBudget -= whole;
        this.healShown += p.heal(whole);
      }
    }

    // Перстень Громовержца: цепная молния по четверым рядом
    if (kind === 'hit' && this.chainCd <= 0 && this.items.includes('thunderring') && Math.random() < 0.15) {
      this.chainCd = 0.2;
      let prev: Enemy = z;
      const hit = new Set<Enemy>([z]);
      for (let n = 0; n < 4; n++) {
        const next = this.queryZombies(prev.x, prev.y, 200).find((o) => !hit.has(o));
        if (!next) break;
        hit.add(next);
        this.fx.chain(prev.x, prev.y - prev.figureH * 0.5, next.x, next.y - next.figureH * 0.5);
        this.damageZombie(next, 30, prev.x, prev.y, 120, 'splash');
        prev = next;
      }
      this.sfx('thunder', 0.3, 1.4);
    }

    if (kind === 'hit' && p.stats.cleave > 0) {
      for (const o of this.queryZombies(z.x, z.y, 70)) {
        if (o !== z) this.damageZombie(o, base * p.stats.cleave, z.x, z.y, knock * 0.5, 'splash');
      }
    }

    if (z.hp <= 0) this.killZombie(z);
  }

  /**
   * Круговерть (как Counter Helix у Акса): при своём ударе или ударе по богатырю —
   * шанс крутануться с мечом и задеть всех вокруг.
   */
  tryHelix(): boolean {
    const p = this.player;
    const s = p.stats;
    if (s.helixChance <= 0 || this.helixCd > 0 || p.dead || Math.random() >= s.helixChance) return false;
    this.helixCd = 0.45;
    const r = s.helixRadius * s.area;
    p.spinAttack();
    this.fx.helix(p, -p.tall * 0.4, r);
    this.sfx('helix', 0.55);
    this.time.delayedCall(90, () => {
      if (p.dead) return;
      for (const z of this.queryZombies(p.x, p.y, r)) this.damageZombie(z, s.helixDmg, p.x, p.y, 340, 'helix');
    });
    return true;
  }

  private killZombie(z: Enemy): void {
    if (z instanceof Dragon) {
      this.killDragon(z);
      return;
    }
    if (z instanceof Tugarin) {
      this.killTugarin(z);
      return;
    }
    const boss = this.bosses.list.find((b) => b === z);
    if (boss) {
      if (!this.bosses.tryRevive(boss)) this.killSpriteBoss(boss);
      return;
    }
    if (!(z instanceof Zombie)) return;
    z.die();
    this.aliveZombies--;
    this.kills++;
    const p = this.player;
    const big = z.ztype.key === 'brute';
    this.fx.splat(z.x + (z.flipX ? -10 : 10), z.y - 2, 0.55 + z.ztype.scale * 0.7);
    this.fx.puff(z.x, z.y - z.figureH * 0.4, 0x8dff9a, 0.08 + z.ztype.scale * 0.08);
    this.sfx('squish', 0.25);
    // Опыт — сразу за убийство; душа летит к богатырю для наглядности
    this.addXp(z.ztype.xp * p.stats.xpMul);
    this.fx.soul(z.x, z.y - z.figureH * 0.55, p, -p.tall * 0.5, big);
    this.gemStreak = Math.min(this.gemStreak + 1, 24);
    this.gemStreakT = 0.7;
    this.sfx(`soul${this.gemStreak % 8}` as SfxKey, 0.2);
    if (big && Math.random() < 0.08) this.pickups.spawn(z.x + 14, z.y + 4, 15);
  }

  sfx(key: SfxKey, volume = 0.5, rate = 1): void {
    const tk = key.startsWith('soul') ? 'soul' : key;
    const th = SFX_THROTTLE_MS[tk];
    if (th) {
      const now = performance.now();
      if (now - (this.lastSfx[tk] ?? 0) < th) return;
      this.lastSfx[tk] = now;
    }
    const ck = sfxCacheKey(key);
    if (!this.cache.audio.exists(ck)) return;
    const vol = volume * getSettings().sfx;
    if (vol <= 0.001) return;
    this.sound.play(ck, { volume: vol, rate, detune: SFX_TONAL.has(key) ? 0 : Phaser.Math.Between(-80, 80) });
  }

  // ------------------------------------------------------------------
  // Прокачка

  private addXp(n: number): void {
    this.xp += n;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpForLevel(this.level);
      this.pendingLevelUps++;
    }
  }

  private openLevelUp(): void {
    this.state = 'levelup';
    this.sfx('levelup', 0.5);
    this.bus.emit('levelup', this.levelChoices());
    this.scene.pause();
    Platform.gameplayStop();
  }

  /** Вызывается из UI, когда игрок выбрал карточку. */
  chooseAbility(id: AbilityId): void {
    const p = this.player;
    if (id === 'pie') {
      const h = Math.round(p.heal(p.stats.maxHp * 0.3));
      if (h > 0) this.fx.number(p.x, p.y - p.tall - 8, `+${h}`, COLORS.heal, 22);
    } else {
      this.addAbility(id);
    }
    this.pendingLevelUps--;
    if (this.prepLeft > 0) this.prepLeft--;
    if (this.pendingLevelUps > 0) {
      this.bus.emit('levelup', this.levelChoices());
      return;
    }
    this.finishLevelUps();
  }

  /** Все умения выбраны — обратно в бой. */
  private finishLevelUps(): void {
    const p = this.player;
    // подготовка к поздней главе закончилась — в бой со здоровьем под завязку
    if (this.prepTotal > 0 && this.elapsed < 1) p.hp = p.stats.maxHp;
    this.state = 'play';
    this.scene.resume();
    // Сила прибыла: золотое кольцо и искры вокруг богатыря
    this.fx.ring(p.x, p.y, 150, COLORS.gold, 520);
    this.fx.critBurst(p.x, p.y - p.tall * 0.5, 1.4);
    Platform.gameplayStart();
  }

  private addAbility(id: AbilityId): void {
    const def = ABILITY_BY_ID.get(id);
    if (!def) return;
    const lvl = (this.levels.get(id) ?? 0) + 1;
    this.levels.set(id, lvl);
    if (def.kind === 'weapon' && def.create) {
      let w = this.weapons.get(id);
      if (!w) {
        w = def.create(this);
        this.weapons.set(id, w);
      }
      w.setLevel(lvl);
    }
    this.recalcStats();
    this.bus.emit('abilities');
  }

  private recalcStats(): void {
    const s = baseStats();
    applyTalents(s);
    for (const [id, lvl] of this.levels) ABILITY_BY_ID.get(id)?.apply?.(s, lvl);
    for (const id of this.items) ITEM_BY_ID.get(id)?.apply?.(s);
    if (this.rageT > 0) {
      // Буйство: урон вдвое, удары вдвое чаще, сильный вампиризм, чуть быстрее бег
      s.might *= 2;
      s.haste *= 0.5;
      s.lifesteal += 0.15;
      s.speed *= 1.15;
    }
    this.player.setStats(s);
  }

  private rollChoices(n: number): AbilityId[] {
    const pool = ABILITIES.filter((a) => a.kind !== 'consumable' && (this.levels.get(a.id) ?? 0) < a.maxLevel);
    const weights = pool.map((a) => {
      const owned = this.levels.has(a.id);
      if (a.kind === 'weapon') return owned ? 1.3 : 1.0;
      return owned ? 1.0 : 0.8;
    });
    const picks: AbilityId[] = [];
    while (picks.length < n && pool.length > 0) {
      const total = weights.reduce((s, w) => s + w, 0);
      let r = Math.random() * total;
      let idx = 0;
      while (idx < pool.length - 1 && r >= weights[idx]) r -= weights[idx++];
      picks.push(pool[idx].id);
      pool.splice(idx, 1);
      weights.splice(idx, 1);
    }
    if (picks.length < n) picks.push('pie');
    return picks;
  }

  // ------------------------------------------------------------------
  // Смерть и воскрешение

  private onDeath(): void {
    if (this.items.includes('feather') && !this.featherUsed) {
      this.featherUsed = true;
      const p = this.player;
      p.revive();
      p.hp = Math.round(p.stats.maxHp * 0.6);
      this.fx.ring(p.x, p.y, 300, 0xffb347, 600);
      this.fx.critBurst(p.x, p.y - p.tall * 0.5, 2);
      for (const z of this.queryZombies(p.x, p.y, 300)) this.damageZombie(z, 60, p.x, p.y, 700, 'splash');
      this.bus.emit('toast', t('toast.feather'));
      this.bus.emit('abilities');
      this.sfx('levelup', 0.6);
      return;
    }
    if (this.freeRevives > 0) {
      this.freeRevives--;
      const p = this.player;
      p.revive();
      p.hp = Math.round(p.stats.maxHp * 0.5);
      this.fx.ring(p.x, p.y, 280, 0x9dffb0, 600);
      for (const z of this.queryZombies(p.x, p.y, 280)) this.damageZombie(z, 50, p.x, p.y, 700, 'splash');
      this.bus.emit('toast', t('toast.secondWind'));
      this.sfx('levelup', 0.6);
      return;
    }
    this.state = 'dead';
    this.player.die();
    this.sfx('death', 0.6);
    Platform.gameplayStop();
    this.time.delayedCall(1000, async () => {
      const canRevive = this.revivesLeft > 0;
      const stats: RunStats = { time: this.elapsed, kills: this.kills, level: this.level, canRevive, ...this.awardGold() };
      this.scene.pause();
      if (!canRevive) await this.midgameAd(false);
      this.bus.emit('gameover', stats);
    });
  }

  /** Начислить злато за забег (только прибавку с прошлого начисления) и обновить рекорды. */
  private awardGold(): { gold: number; totalGold: number } {
    const base = runGold(this.elapsed, this.kills, this.bossKills, this.spawner.chaptersCleared) + (this.spawner.won ? 150 : 0);
    const earned = Math.floor(base * (1 + 0.1 * talentLevel('greed')));
    const delta = Math.max(0, earned - this.goldAwarded);
    const first = this.goldAwarded === 0;
    this.goldAwarded = earned;
    Save.update((d) => {
      d.gold += delta;
      d.bestTime = Math.max(d.bestTime, this.elapsed);
      d.bestKills = Math.max(d.bestKills, this.kills);
      if (first) d.runs++;
    });
    return { gold: earned, totalGold: Save.get().gold };
  }

  /** Выход в меню посреди забега: злато за пройденное начисляется (после смерти уже начислено). */
  quitRun(): void {
    if (this.state !== 'dead') this.awardGold();
    Platform.gameplayStop();
  }

  /**
   * Старт с поздней главы: богатырь сразу получает уровень и случайные предметы (по 7 за пропущенную главу),
   * а умения выбирает игрок — окно выбора открывается по очереди (или «Остальное — случайно»).
   */
  private prepareStart(k: number): void {
    const late = Math.min(1, k / 5);
    for (let i = 0; i < START_ITEMS[k]; i++) {
      const id = rollItem(new Set(this.items), 'common', late);
      if (id) this.items.push(id);
    }
    this.recalcStats();
    this.level = START_LEVEL[k];
    this.xp = 0;
    this.xpNext = xpForLevel(this.level);
    this.pendingLevelUps = this.prepLeft = this.prepTotal = START_LEVEL[k] - 1;
  }

  /** Три умения на выбор; в подготовке без пирожка — лечить пока некого. */
  private levelChoices(): AbilityId[] {
    if (this.prepLeft <= 0) return this.rollChoices(3);
    const ch = this.rollChoices(4).filter((c) => c !== 'pie').slice(0, 3);
    return ch.length ? ch : this.rollChoices(3);
  }

  /** Одно умение «само»: из трёх случайных берётся то, что уже прокачано сильнее (сборка цельная). */
  private autoPick(): void {
    const ch = this.rollChoices(3).filter((c) => c !== 'pie');
    if (ch.length === 0) return;
    ch.sort((a, b) => this.getLevel(b) - this.getLevel(a) || Math.random() - 0.5);
    this.addAbility(ch[0]);
  }

  /** «Остальное — случайно»: оставшиеся умения подготовки выбираются сами, и в бой. */
  autoRest(): void {
    while (this.pendingLevelUps > 0) {
      this.autoPick();
      this.pendingLevelUps--;
    }
    this.prepLeft = 0;
    this.finishLevelUps();
  }

  /** Первый пирожок новичку подписываем: «Пирожок — лечит!» и стрелка, пока его не съели. */
  private pieHint(pie: Phaser.GameObjects.Image): void {
    if (this.pieHintShown || (Save.get().pieTips ?? 0) >= 3) return;
    this.pieHintShown = true;
    Save.update((d) => (d.pieTips = (d.pieTips ?? 0) + 1));
    this.bus.emit('toast', t('toast.pie'));
    const label = this.add
      .text(pie.x, pie.y - 30, t('pie.label'), {
        fontFamily: FONT_UI,
        fontStyle: 'bold',
        fontSize: '15px',
        color: '#ffe9a0',
        stroke: '#2a1405',
        strokeThickness: 4,
        align: 'center',
      })
      .setOrigin(0.5, 1)
      .setDepth(99990)
      .setResolution(Math.max(1, this.cameras.main.zoom));
    const until = this.elapsed + 10;
    const follow = () => {
      if (!pie.active || !pie.visible || this.elapsed > until || !label.active) {
        label.destroy();
        this.events.off('postupdate', follow);
        return;
      }
      label.setPosition(pie.x, pie.y - 30 + Math.sin(this.elapsed * 6) * 3);
    };
    this.events.on('postupdate', follow);
    this.events.once('shutdown', () => this.events.off('postupdate', follow));
  }

  /** Можно ли сейчас предложить «Буйство» (не в подготовке, не на первой минуте, не чаще раза в 2,5 мин). */
  get rageReady(): boolean {
    return this.rageCd <= 0 && this.rageT <= 0 && this.elapsed > 45 && this.prepLeft <= 0;
  }

  /** «Буйство» за рекламу: 20 с урон ×2, удары вдвое чаще, вампиризм. */
  startRage(): void {
    this.rageT = RAGE_TIME;
    this.rageCd = RAGE_CD;
    this.rageFxT = 0;
    this.recalcStats();
    const p = this.player;
    this.fx.ring(p.x, p.y, 200, 0xff5a2a, 500);
    this.fx.critBurst(p.x, p.y - p.tall * 0.5, 1.5);
    this.sfx('roar', 0.6, 1.2);
    this.bus.emit('toast', t('toast.rage'));
  }

  /** Чернобог повержен — победа, забег окончен. */
  victory(): void {
    Save.update((d) => {
      d.wins = (d.wins ?? 0) + 1;
      d.maxChapter = BIOMES.length - 1;
    });
    this.invulnT = 4;
    Platform.happytime();
    this.bus.emit('toast', t('toast.victory'));
    this.sfx('levelup', 0.7);
    this.cameras.main.flash(500, 255, 230, 160);
    this.time.delayedCall(2600, () => {
      if (this.state === 'dead') return;
      this.state = 'dead';
      Platform.gameplayStop();
      this.scene.pause();
      const stats: RunStats = { won: true, time: this.elapsed, kills: this.kills, level: this.level, canRevive: false, ...this.awardGold() };
      void this.midgameAd(false).then(() => this.bus.emit('gameover', stats));
    });
  }

  /**
   * Полноэкранная реклама на естественной паузе (между главами, после смерти, после победы).
   * pauseGame — поставить игру на паузу на время показа и вернуть после.
   */
  async midgameAd(pauseGame: boolean): Promise<void> {
    if (pauseGame) {
      this.scene.pause();
      Platform.gameplayStop();
    }
    await Platform.midgame();
    if (pauseGame) {
      this.scene.resume();
      Platform.gameplayStart();
    }
  }

  /** ×2 злата за забег (реклама на экране поражения/победы): ещё столько же, сколько уже начислено. */
  doubleGold(): { gold: number; totalGold: number } {
    if (!this.goldDoubled && this.goldAwarded > 0) {
      this.goldDoubled = true;
      Save.update((d) => (d.gold += this.goldAwarded));
    }
    return { gold: this.goldAwarded * (this.goldDoubled ? 2 : 1), totalGold: Save.get().gold };
  }

  /** «Другие умения» (реклама на экране уровня): новые три карточки. */
  rerollChoices(): AbilityId[] {
    this.rerollCd = REROLL_CD;
    return this.levelChoices();
  }

  /** «Другой предмет» (реклама в сундуке): другой предмет той же редкости или лучше. */
  rerollChestItem(cur: ItemId): ItemId | null {
    const owned = new Set<ItemId>([...this.items, cur]);
    const late = Phaser.Math.Clamp(this.elapsed / 600, 0, 1);
    return rollItem(owned, this.chestRarity, late) ?? rollItem(owned, 'common', late);
  }

  /** Цена воскрешения за злато: дороже с каждой главой (за поздний забег и злата больше). */
  get reviveCost(): number {
    return 100 + 50 * Math.max(0, BIOMES.indexOf(this.biome));
  }

  /** Воскрешение за злато (вместо рекламы); false — не хватает злата. */
  reviveForGold(): boolean {
    const cost = this.reviveCost;
    if (this.revivesLeft <= 0 || Save.get().gold < cost) return false;
    Save.update((d) => (d.gold -= cost));
    this.revive();
    return true;
  }

  /** Воскрешение (за рекламу или злато): полное здоровье + ударная волна вокруг. */
  revive(): void {
    this.revivesLeft--;
    const p = this.player;
    p.revive();
    this.invulnT = REVIVE_GOD;
    this.fx.ring(p.x, p.y, 320, 0xbff7ff);
    this.fx.number(p.x, p.y - p.tall - 10, t('fx.invuln'), '#fff0b0', 20, true);
    for (const z of this.queryZombies(p.x, p.y, 320)) this.damageZombie(z, 40, p.x, p.y, 700, 'splash');
    this.state = 'play';
    this.scene.resume();
    Platform.gameplayStart();
  }

  getLevel(id: AbilityId): number {
    return this.levels.get(id) ?? 0;
  }
}
