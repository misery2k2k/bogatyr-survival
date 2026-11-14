import Phaser from 'phaser';
import { COLORS, DPR, FONT_TITLE, FONT_UI, TEX_RES } from '../config';
import { HERO_UNITS_TALL, HeroRig } from '../entities/HeroRig';
import { readZombieOrigins } from '../entities/Zombie';
import { BIOMES, START_LEVEL } from '../biomes';
import { LazyAssets } from '../mobs';
import { Save } from '../save';
import { t, tx } from '../i18n';
import { ITEM_BY_ID, rollItem, type ItemId } from '../items';
import { getSettings } from '../settings';
import { sfxCacheKey } from '../sfx';
import { BlessPanel } from '../ui/BlessPanel';
import { SettingsPanel } from '../ui/SettingsPanel';
import { TalentPanel } from '../ui/TalentPanel';
import { Platform } from '../platform';

/** «Подарок дня» за рекламу: сколько злата. */
const GIFT_GOLD = 100;
/** «Благословение» без рекламы — за столько злата. */
const BLESS_GOLD = 150;

/** Сегодняшняя дата (по местному времени) — для «Подарка дня». */
function today(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

/** Титульный экран. */
export class MenuScene extends Phaser.Scene {
  private started = false;
  private hero: HeroRig | null = null;
  private swingT = 1.2;
  private settings: SettingsPanel | TalentPanel | BlessPanel | null = null;
  /** Кнопка древа талантов (с запасом злата). */
  private talentBtn: Phaser.GameObjects.Container | null = null;
  private gear: Phaser.GameObjects.Image | null = null;
  private uiScale = 1;
  private settingsClosedAt = -1e9;
  /** Глава, с которой начнётся забег (выбор доступен, если дошёл дальше первой). */
  private chapter = -1;
  private picker: Phaser.GameObjects.Container | null = null;
  /** Кнопки рекламы за награду в меню и флаг «реклама идёт». */
  private adButtons: Phaser.GameObjects.Container[] = [];
  private adBusy = false;
  /** Где надпись «Нажми, чтобы начать» (от неё — выбор главы). */
  private promptY = 0;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.started = false;
    this.settings = null;
    this.chapter = -1;
    readZombieOrigins(this);
    this.build();
    this.scale.on('resize', this.build, this);
    const offAds = Platform.onAdsChange(() => {
      const bless = this.settings instanceof BlessPanel;
      this.build();
      if (bless) this.openBless();
    });
    this.events.once('shutdown', () => {
      offAds();
      this.scale.off('resize', this.build, this);
      this.settings?.destroy();
      this.settings = null;
    });

    this.input.on('pointerup', this.start, this);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.code !== 'Escape') this.start();
    });

    Platform.loadingReady();
    // облачное сохранение могло оказаться новее локального — перерисуем баланс
    void Save.load().then(() => {
      if (this.scene.isActive() && !this.started) this.build();
    });
  }

  update(_t: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    if (!this.hero) return;
    this.swingT -= dt;
    if (this.swingT <= 0) {
      this.swingT = 2.4;
      this.hero.attack('chop');
    }
    this.hero.animate(dt, false);
  }

  private build(): void {
    this.tweens.killAll();
    this.settings?.destroy();
    this.settings = null;
    this.children.removeAll(true);
    const W = this.scale.width, H = this.scale.height;
    const s = DPR * Phaser.Math.Clamp(Math.min(W, H) / DPR / 430, 0.85, 1.5);
    this.uiScale = DPR * Phaser.Math.Clamp(Math.min(W, H) / DPR / 430, 0.85, 1.35);

    this.add.tileSprite(0, 0, W, H, 'ground').setOrigin(0).setTileScale((s * 0.8) / TEX_RES);

    // Лесная опушка вокруг
    const trees: [string, number, number, number][] = [
      ['birch', 0.08, 0.42, 1.1], ['fir', 0.22, 0.3, 1.0], ['birch', 0.92, 0.4, 1.15], ['fir', 0.78, 0.3, 0.95],
      ['bush', 0.15, 0.84, 1.2], ['haystack', 0.87, 0.86, 0.9], ['mushroom', 0.3, 0.9, 1.4], ['stump', 0.7, 0.92, 1.2],
    ];
    for (const [key, fx, fy, sc] of trees) {
      this.add.image(W * fx, H * fy, key).setOrigin(0.5, 0.96).setScale((sc * s * 0.9) / TEX_RES).setDepth(H * fy);
    }

    // если есть выбор главы — богатырь чуть выше и меньше, чтобы полоса выбора не наезжала на ноги
    const hasPicker = Math.min(Save.get().maxChapter ?? 0, BIOMES.length - 1) > 0;
    const cy = H * (hasPicker ? 0.6 : 0.66);
    const heroH = Math.min(H, W * 1.3) * (hasPicker ? 0.3 : 0.34);
    this.add.image(W / 2, cy + 2 * s, 'shadow').setScale((heroH / 70) / TEX_RES, (heroH / 90) / TEX_RES).setDepth(cy - 1);
    this.hero = new HeroRig(this, W / 2, cy, heroH / HERO_UNITS_TALL);
    this.hero.setDepth(cy);

    const zh = heroH * 0.62 / 155;
    const zl = this.add.sprite(W / 2 - heroH * 0.85, cy + 16 * s, 'zombies').setScale(zh).setDepth(cy + 16 * s);
    zl.setOrigin(0.5, 0.93).play('m-attack');
    const zr = this.add.sprite(W / 2 + heroH * 0.85, cy + 10 * s, 'zombies').setScale(zh * 0.92).setFlipX(true).setDepth(cy + 10 * s);
    zr.setOrigin(0.5, 0.92).play('f-walk');

    // мягкая виньетка: края и верх (под заголовком) плавно темнеют, богатырь в центре остаётся светлым
    this.add.image(0, 0, this.vignette()).setOrigin(0).setDisplaySize(W, H).setDepth(9000);
    this.add
      .text(W / 2, H * 0.14, t('menu.title'), {
        fontFamily: FONT_TITLE,
        fontSize: `${64 * s}px`,
        color: COLORS.goldText,
        stroke: '#2a1405',
        strokeThickness: 10 * s,
      })
      .setOrigin(0.5)
      .setDepth(9001);
    this.add
      .text(W / 2, H * 0.14 + 58 * s, t('menu.subtitle'), {
        fontFamily: FONT_TITLE,
        fontSize: `${30 * s}px`,
        color: '#f1e2c0',
        stroke: '#2a1405',
        strokeThickness: 7 * s,
      })
      .setOrigin(0.5)
      .setDepth(9001);

    const gs0 = this.uiScale;
    // на узком экране (телефон) внизу два ряда кнопок — надписи и выбор главы поднимаются над ними
    const narrowMenu = 2 * 210 * gs0 + 100 * gs0 > W;
    const promptY = narrowMenu ? Math.min(H * 0.84, H - 12 * gs0 - 2 * 44 * gs0 - 10 * gs0 - 64 * s) : H * 0.84;
    this.promptY = promptY;
    const touch = Platform.isMobile() ?? this.sys.game.device.input.touch;
    const prompt = this.add
      .text(W / 2, promptY, touch ? t('menu.tap') : t('menu.click'), {
        fontFamily: FONT_UI,
        fontStyle: 'bold',
        fontSize: `${26 * s}px`,
        color: '#ffffff',
        stroke: '#140b04',
        strokeThickness: 6 * s,
      })
      .setOrigin(0.5)
      .setDepth(9001);
    this.tweens.add({ targets: prompt, alpha: 0.35, duration: 700, yoyo: true, repeat: -1 });

    const hint = this.add
      .text(W / 2, promptY + 40 * s, touch ? t('menu.hintTouch') : t('menu.hintKeys'), {
        fontFamily: FONT_UI,
        fontSize: `${16 * s}px`,
        color: '#f1e2c0',
        stroke: '#140b04',
        strokeThickness: 4 * s,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(9001);
    if (narrowMenu) {
      // телефон: под подсказкой кнопки — одна строка, при нужде чуть мельче
      if (hint.width > W - 16 * s) hint.setScale((W - 16 * s) / hint.width);
    } else {
      // широкий экран: по бокам кнопки (древо, благословение) — подсказка между ними, если надо в две строки
      const room = Math.max(W - 2 * (210 + 76) * gs0, 300 * s);
      if (hint.width > room) hint.setWordWrapWidth(room).setOrigin(0.5, 0.3);
    }

    this.buildChapterPicker(W, s);

    const gs = this.uiScale;
    this.gear = this.add.image(W - 30 * gs, H - 30 * gs, 'icon-gear').setDisplaySize(40 * gs, 40 * gs).setDepth(9500).setInteractive({ useHandCursor: true });
    this.gear.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (!this.settings) this.openSettings();
    });

    // Древо талантов — внизу слева
    const bw = 210 * gs, bh = 44 * gs, bx = 12 * gs, by = H - bh - 12 * gs;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(2 * gs, 3 * gs, bw, bh, 12 * gs);
    bg.fillStyle(0x3a5a22, 1).fillRoundedRect(0, 0, bw, bh, 12 * gs);
    bg.lineStyle(2.5 * gs, COLORS.gold, 1).strokeRoundedRect(0, 0, bw, bh, 12 * gs);
    const tree = this.add.image(24 * gs, bh / 2, 'icon-tree').setDisplaySize(34 * gs, 34 * gs);
    const label = this.add.text(46 * gs, 8 * gs, t('menu.talents'), { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${15 * gs}px`, color: '#ffffff' });
    const coin = this.add.image(54 * gs, 32 * gs, 'icon-coin').setDisplaySize(15 * gs, 15 * gs);
    const gold = this.add.text(64 * gs, 32 * gs, `${Save.get().gold}`, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${13 * gs}px`, color: COLORS.goldText }).setOrigin(0, 0.5);
    const zone = this.add.zone(0, 0, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
    this.talentBtn = this.add.container(bx, by, [bg, tree, label, coin, gold, zone]).setDepth(9500);
    zone.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (this.settings) return;
      this.settings = new TalentPanel(this, gs, () => {
        this.settings = null;
        this.settingsClosedAt = this.time.now;
        gold.setText(`${Save.get().gold}`);
      });
    });

    // Награды в меню (здесь не бой — можно): «Подарок дня» над древом, «Благословение» справа внизу
    this.adButtons = [];
    const halfW = (W - 2 * bx - 10 * gs) / 2;
    const giftSlot = (Save.get().giftDay ?? '') !== today();
    if (giftSlot && !Platform.adsOff) {
      this.adButtons.push(
        this.menuButton(bx, by - bh - 10 * gs, narrowMenu ? halfW : bw, bh, 'chest', t('menu.gift', { n: GIFT_GOLD }), t('menu.ad'), 0x8a5a1a, async () => {
          if (!(await this.rewarded())) return;
          Save.update((d) => {
            d.gold += GIFT_GOLD;
            d.giftDay = today();
          });
          this.build();
        }),
      );
    } else if (giftSlot) {
      // реклама недоступна — подарок дня не прячем молча, а поясняем почему
      this.add
        .text(bx + (narrowMenu ? halfW : bw) / 2, by - bh / 2 - 10 * gs, this.adsNotice(), {
          fontFamily: FONT_UI,
          fontStyle: 'bold',
          fontSize: `${12 * gs}px`,
          color: '#f1e2c0',
          stroke: '#140b04',
          strokeThickness: 3 * gs,
          align: 'center',
          wordWrap: { width: (narrowMenu ? halfW : bw) - 4 * gs },
        })
        .setOrigin(0.5)
        .setDepth(9500);
    }
    // благословлён — на кнопке сам предмет: какой именно, видно сразу
    const blessed = this.registry.get('blessed') as ItemId | null;
    const blessedDef = blessed ? ITEM_BY_ID.get(blessed) : undefined;
    // на узком экране в нижний ряд не влезает — ставим столбиком над древом (и подарком)
    const blX = narrowMenu ? (giftSlot ? bx + halfW + 10 * gs : bx) : W - bw - 64 * gs;
    const blY = narrowMenu ? by - bh - 10 * gs : by;
    this.adButtons.push(
      blessedDef
        ? this.menuButton(blX, blY, narrowMenu ? halfW : bw, bh, `item-${blessed}`, tx(blessedDef.name), t('menu.blessSubDone'), 0x3a5a22, () => this.openBless())
        : this.menuButton(blX, blY, narrowMenu ? halfW : bw, bh, 'item-feather', t('menu.bless'), t('menu.blessSub'), 0x5a3a7a, () => this.openBless()),
    );
  }

  /** Почему нет наград за рекламу (блокировщик или площадка рекламу сейчас не показывает). */
  private adsNotice(): string {
    return Platform.adsOff === 'adblock' ? t('ad.offAdblock') : t('ad.offDisabled');
  }

  /** Окно «Благословения»: реклама или злато; если уже благословлён — показывает выпавший предмет. */
  private openBless(): void {
    if (this.settings) return;
    this.settings = new BlessPanel(this, this.uiScale, {
      cost: BLESS_GOLD,
      gold: Save.get().gold,
      adsNotice: Platform.adsOff ? this.adsNotice() : null,
      item: (this.registry.get('blessed') as ItemId | null) ?? null,
      onAd: () => {
        if (this.adBusy) return;
        void this.rewarded().then((ok) => ok && this.bless());
      },
      onGold: () => {
        if (this.adBusy || Save.get().gold < BLESS_GOLD) return;
        Save.update((d) => (d.gold -= BLESS_GOLD));
        this.bless();
      },
      onClose: () => {
        this.settings = null;
        this.settingsClosedAt = this.time.now;
        this.build();
      },
    });
  }

  /** Благословение получено: предмет выбирается сразу и показывается в том же окне. */
  private bless(): void {
    const id = rollItem(new Set(), 'rare', 0.5);
    if (!id) return;
    this.registry.set('blessed', id);
    const ck = sfxCacheKey('levelup');
    if (this.cache.audio.exists(ck) && getSettings().sfx > 0) this.sound.play(ck, { volume: 0.5 * getSettings().sfx });
    this.build();
    this.openBless();
  }

  /** Текстура виньетки (рисуется один раз, растягивается на экран — получается эллипс). */
  private vignette(): string {
    const key = 'menu-vignette';
    if (this.textures.exists(key)) return key;
    const n = 512;
    const tex = this.textures.createCanvas(key, n, n);
    if (!tex) return '__WHITE';
    const ctx = tex.context;
    // верх: тень под заголовок, сходит на нет к середине экрана
    const top = ctx.createLinearGradient(0, 0, 0, n * 0.55);
    top.addColorStop(0, 'rgba(10,5,2,0.5)');
    top.addColorStop(0.45, 'rgba(10,5,2,0.2)');
    top.addColorStop(1, 'rgba(10,5,2,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, n, n);
    // края: свет в центре на богатыре, к углам темнее
    const edge = ctx.createRadialGradient(n / 2, n * 0.58, n * 0.2, n / 2, n * 0.58, n * 0.78);
    edge.addColorStop(0, 'rgba(10,5,2,0)');
    edge.addColorStop(0.6, 'rgba(10,5,2,0.18)');
    edge.addColorStop(1, 'rgba(10,5,2,0.55)');
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, n, n);
    tex.refresh();
    return key;
  }

  /** Настройки; сменили язык — меню перерисовывается на новом языке, окно настроек открывается заново. */
  private openSettings(): void {
    this.settings = new SettingsPanel(
      this,
      this.uiScale,
      () => {
        this.settings = null;
        this.settingsClosedAt = this.time.now;
      },
      undefined,
      () => {
        this.build();
        this.openSettings();
      },
    );
  }

  /** Кнопка меню с иконкой, заголовком и подписью (как у древа талантов). */
  private menuButton(x: number, y: number, w: number, h: number, icon: string, title: string, sub: string, color: number, onTap: () => void): Phaser.GameObjects.Container {
    const gs = this.uiScale;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(2 * gs, 3 * gs, w, h, 12 * gs);
    bg.fillStyle(color, 1).fillRoundedRect(0, 0, w, h, 12 * gs);
    bg.lineStyle(2.5 * gs, COLORS.gold, 1).strokeRoundedRect(0, 0, w, h, 12 * gs);
    const ic = this.add.image(24 * gs, h / 2, icon).setDisplaySize(32 * gs, 32 * gs);
    const t1 = this.add.text(46 * gs, 7 * gs, title, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${15 * gs}px`, color: '#ffffff' });
    const t2 = this.add.text(46 * gs, 26 * gs, sub, { fontFamily: FONT_UI, fontSize: `${12 * gs}px`, color: '#f2d79a' });
    for (const t of [t1, t2]) if (t.width > w - 52 * gs) t.setScale((w - 52 * gs) / t.width);
    const zone = this.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (this.settings || this.adBusy) return;
      onTap();
    });
    return this.add.container(x, y, [bg, ic, t1, t2, zone]).setDepth(9500);
  }

  /**
   * Реклама за награду из меню; true — досмотрена (награду даём только тогда).
   * Рекламы нет прямо сейчас — подсказка «попробуй позже»; недоступна совсем — меню перерисуется с пояснением.
   */
  private async rewarded(): Promise<boolean> {
    this.adBusy = true;
    const r = await Platform.rewarded();
    this.adBusy = false;
    if (r === 'unavailable') this.note(t('ad.later'));
    if (r === 'blocked') this.note(this.adsNotice());
    return r === 'ok';
  }

  /** Короткая надпись посреди меню (поверх окон). */
  private note(msg: string): void {
    const W = this.scale.width, H = this.scale.height, s = this.uiScale;
    const n = this.add
      .text(W / 2, H * 0.3, msg, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${19 * s}px`, color: '#ffffff', stroke: '#140b04', strokeThickness: 5 * s, align: 'center', wordWrap: { width: W - 40 * s } })
      .setOrigin(0.5)
      .setDepth(30000);
    this.tweens.add({ targets: n, alpha: 0, delay: 2200, duration: 500, onComplete: () => n.destroy() });
  }

  /** Выбор главы старта: стрелки листают главы, до которых богатырь уже дошёл. */
  private buildChapterPicker(W: number, s: number): void {
    this.picker = null;
    const save = Save.get();
    const maxCh = Math.min(save.maxChapter ?? 0, BIOMES.length - 1);
    if (maxCh <= 0) {
      this.chapter = 0;
      return;
    }
    if (this.chapter < 0) this.chapter = Phaser.Math.Clamp(save.startChapter ?? 0, 0, maxCh);
    const pw = Math.min(W - 24 * s, 470 * s), ph = 50 * s;
    const c = this.add.container(W / 2, this.promptY - 64 * s).setDepth(9400);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.5).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 14 * s);
    bg.lineStyle(2 * s, COLORS.gold, 0.9).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 14 * s);
    const title = this.add.text(0, -6 * s, '', { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${17 * s}px`, color: '#ffffff' }).setOrigin(0.5);
    const sub = this.add.text(0, 13 * s, '', { fontFamily: FONT_UI, fontSize: `${12.5 * s}px`, color: '#f2d79a' }).setOrigin(0.5);
    const refresh = () => {
      title.setText(tx(BIOMES[this.chapter].title));
      sub.setText(this.chapter > 0 ? t('menu.startHere', { lvl: START_LEVEL[this.chapter] }) : t('menu.fromStart'));
      // главу заранее подгружаем фоном, чтобы старт был мгновенным
      if (this.chapter > 0) LazyAssets.ensure(this, BIOMES[this.chapter].assets);
    };
    const arrow = (dir: -1 | 1) => {
      const x = dir * (pw / 2 - 26 * s);
      const g = this.add.graphics();
      g.fillStyle(0x8b1e1e, 1).fillCircle(x, 0, 18 * s);
      g.lineStyle(2 * s, COLORS.gold, 1).strokeCircle(x, 0, 18 * s);
      g.fillStyle(0xffffff, 1).fillTriangle(x + dir * 7 * s, 0, x - dir * 5 * s, -8 * s, x - dir * 5 * s, 8 * s);
      const z = this.add.zone(x, 0, 52 * s, ph).setInteractive({ useHandCursor: true });
      z.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.chapter = (this.chapter + dir + maxCh + 1) % (maxCh + 1);
        refresh();
      });
      return [g, z];
    };
    c.add([bg, title, sub, ...arrow(-1), ...arrow(1)]);
    refresh();
    this.picker = c;
  }

  private start(): void {
    // Тот же тап, что закрыл настройки, не должен запускать игру
    if (this.started || this.settings || this.time.now - this.settingsClosedAt < 300) return;
    const p = this.input.activePointer;
    if (this.gear && this.gear.getBounds().contains(p.x, p.y)) return;
    if (this.talentBtn && this.talentBtn.getBounds().contains(p.x, p.y)) return;
    if (this.picker && this.picker.getBounds().contains(p.x, p.y)) return;
    if (this.adBusy || this.adButtons.some((b) => b.getBounds().contains(p.x, p.y))) return;
    this.started = true;
    const k = Math.max(0, this.chapter);
    if ((Save.get().startChapter ?? 0) !== k) Save.update((d) => (d.startChapter = k));
    const biome = BIOMES[k];
    if (k > 0 && !LazyAssets.allReady(this, biome.assets)) {
      // картинки главы ещё грузятся — подождём (обычно мгновенно: подгружаются фоном при выборе)
      const W = this.scale.width, H = this.scale.height, s = this.uiScale;
      this.add
        .text(W / 2, H * 0.5, t('menu.loading'), { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${22 * s}px`, color: '#ffffff', stroke: '#140b04', strokeThickness: 5 * s })
        .setOrigin(0.5)
        .setDepth(9999);
      LazyAssets.ensure(this, biome.assets, () => this.scene.start('Game'));
      return;
    }
    this.scene.start('Game');
  }
}
