import Phaser from 'phaser';
import { ABILITY_BY_ID, abilityDesc } from '../abilities/defs';
import type { AbilityId } from '../abilities/types';
import { COLORS, DPR, FONT_TITLE, FONT_UI } from '../config';
import { ITEMS, ITEM_BY_ID, RARITY, type ItemId } from '../items';
import { t, tx } from '../i18n';
import { DEBUG_ALLOWED } from '../debug';
import { DebugPanel } from '../ui/DebugPanel';
import { SettingsPanel } from '../ui/SettingsPanel';
import { Platform } from '../platform';
import { Save } from '../save';
import { RAGE_TIME, type GameScene, type RunStats } from './GameScene';

type Text = Phaser.GameObjects.Text;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** HUD, виртуальный джойстик, окно выбора способностей и экран поражения. */
export class UIScene extends Phaser.Scene {
  private g!: GameScene;
  /** Масштаб интерфейса: физических пикселей на «единицу» макета. */
  private s = 1;
  private hud!: Phaser.GameObjects.Graphics;
  private levelText!: Text;
  private timerText!: Text;
  private killsText!: Text;
  private toastText!: Text;
  /** Подсказка поверх окон (реклама недоступна, не хватает злата) — внизу экрана, чтобы не закрывать окно. */
  private modalNote: Phaser.GameObjects.Text | null = null;
  private icons!: Phaser.GameObjects.Container;
  private vignette!: Phaser.GameObjects.Image;
  private joyBase!: Phaser.GameObjects.Image;
  private joyKnob!: Phaser.GameObjects.Image;
  private joyId = -1;
  private joyOx = 0;
  private joyOy = 0;
  private modal: Phaser.GameObjects.Container | null = null;
  private modalKind: 'levelup' | 'gameover' | 'chest' | null = null;
  private modalItem: ItemId | null = null;
  private chestArrow!: Phaser.GameObjects.Container;
  private chestArrowGfx!: Phaser.GameObjects.Graphics;
  private modalChoices: AbilityId[] = [];
  private modalStats: RunStats | null = null;
  private modalOpenedAt = 0;
  private busy = false;
  /** В этом сундуке уже брали «Другой предмет». */
  private chestRerolled = false;
  private gear!: Phaser.GameObjects.Image;
  private settings: SettingsPanel | null = null;
  private settingsPaused = false;
  private bossText!: Text;
  private rageText!: Text;
  private shade!: Phaser.GameObjects.Image;
  /** Цветовое настроение главы (умножение поверх мира). */
  private mood!: Phaser.GameObjects.Rectangle;
  /** Панель тестера (только в dev и с ?debug=1). */
  private debug: DebugPanel | null = null;
  /** Правый и нижний край блока иконок умений (чтобы полоска змея их не перекрывала). */
  private iconsRight = 0;
  private iconsBottom = 0;

  constructor() {
    super('UI');
  }

  create(): void {
    this.g = this.scene.get('Game') as GameScene;
    this.modal = null;
    this.modalKind = null;
    this.joyId = -1;
    this.busy = false;
    this.settings = null;
    this.settingsPaused = false;

    const txt = (size: number, color = '#ffffff', family = FONT_UI) =>
      this.add.text(0, 0, '', {
        fontFamily: family,
        fontStyle: 'bold',
        fontSize: `${size}px`,
        color,
        stroke: '#140b04',
        strokeThickness: 4,
      });

    this.mood = this.add.rectangle(0, 0, 10, 10, this.g.biome.mood).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.shade = this.add.image(0, 0, 'shade').setOrigin(0).setAlpha(0.85);
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setAlpha(0);
    this.hud = this.add.graphics();
    this.icons = this.add.container(0, 0);
    this.levelText = txt(18, COLORS.goldText).setOrigin(1, 0);
    this.killsText = txt(16).setOrigin(1, 0);
    this.timerText = txt(26).setOrigin(0.5, 0);
    this.toastText = txt(30, COLORS.goldText, FONT_TITLE).setOrigin(0.5).setAlpha(0);
    this.bossText = txt(15, '#ffb08a').setOrigin(0.5, 1).setVisible(false);
    this.rageText = txt(14, '#ffd0b0').setOrigin(0.5, 0.5).setVisible(false);
    // Стрелка к ближайшему сундуку за краем экрана
    this.chestArrowGfx = this.add.graphics();
    this.chestArrow = this.add.container(0, 0, [this.chestArrowGfx, this.add.image(0, 0, 'chest').setOrigin(0.5)]).setVisible(false);
    this.gear = this.add.image(0, 0, 'icon-gear').setDepth(15000).setInteractive({ useHandCursor: true });
    this.gear.on('pointerup', () => this.openSettings());
    this.joyBase = this.add.image(0, 0, 'joy-base').setVisible(false);
    this.joyKnob = this.add.image(0, 0, 'joy-knob').setVisible(false);

    const bus = this.g.bus;
    bus.on('levelup', this.onLevelUp, this);
    bus.on('gameover', this.onGameOver, this);
    bus.on('hurt', this.onHurt, this);
    bus.on('toast', this.toast, this);
    bus.on('abilities', this.rebuildIcons, this);
    bus.on('chest', this.onChest, this);
    bus.on('biome', this.onBiome, this);

    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.input.keyboard?.on('keydown', this.onKey, this);
    this.input.keyboard?.on('keydown-ESC', () => {
      if (!this.settings) this.openSettings();
    });

    this.scale.on('resize', this.layout, this);
    const offAds = Platform.onAdsChange(() => this.refreshModal());
    this.events.once('shutdown', () => {
      offAds();
      bus.off('levelup', this.onLevelUp, this);
      bus.off('gameover', this.onGameOver, this);
      bus.off('hurt', this.onHurt, this);
      bus.off('toast', this.toast, this);
      bus.off('abilities', this.rebuildIcons, this);
      bus.off('chest', this.onChest, this);
      bus.off('biome', this.onBiome, this);
      this.scale.off('resize', this.layout, this);
      this.settings?.destroy();
      this.settings = null;
      this.debug?.destroy();
      this.debug = null;
    });

    this.layout();
    if (DEBUG_ALLOWED) this.debug = new DebugPanel(this, this.g, this.s);
  }

  // ------------------------------------------------------------------ HUD

  private layout(): void {
    const W = this.scale.width, H = this.scale.height;
    const cssMin = Math.min(W, H) / DPR;
    this.s = DPR * Phaser.Math.Clamp(cssMin / 430, 0.85, 1.35);
    const s = this.s;
    this.levelText.setFontSize(18 * s).setStroke('#140b04', 4 * s).setPosition(W - 10 * s, 20 * s);
    this.killsText.setFontSize(15 * s).setStroke('#140b04', 4 * s).setPosition(W - 10 * s, 44 * s);
    this.timerText.setFontSize(26 * s).setStroke('#140b04', 5 * s).setPosition(W / 2, 18 * s);
    this.toastText.setFontSize(30 * s).setStroke('#140b04', 6 * s).setPosition(W / 2, H * 0.26);
    this.vignette.setDisplaySize(W, H);
    this.shade.setDisplaySize(W, H);
    this.mood.setSize(W, H);
    this.debug?.resize(s);
    this.bossText.setFontSize(15 * s).setStroke('#140b04', 4 * s).setPosition(W / 2, 74 * s);
    this.rageText.setFontSize(14 * s).setStroke('#140b04', 4 * s).setPosition(W / 2, 58 * s);
    this.gear.setDisplaySize(34 * s, 34 * s).setPosition(W - 10 * s - 17 * s, 84 * s);
    if (this.settings) {
      this.settings.destroy();
      this.settings = new SettingsPanel(this, s, () => this.onSettingsClosed(), () => void this.exitToMenu(), () => this.reopenSettings());
    }
    this.joyBase.setScale(s * 0.8);
    this.joyKnob.setScale(s * 0.8);
    this.rebuildIcons();
    this.refreshModal();
  }

  /** Перерисовать открытое окно (новый размер экрана, реклама стала недоступна…). */
  private refreshModal(): void {
    if (this.modalKind === 'levelup') this.showLevelUp(this.modalChoices, false);
    else if (this.modalKind === 'gameover' && this.modalStats) this.showGameOver(this.modalStats, false);
    else if (this.modalKind === 'chest' && this.modalItem) this.showChest(this.modalItem, false);
  }

  /** Подсказка поверх окна, внизу экрана: появляется и через пару секунд гаснет. */
  private note(msg: string): void {
    const W = this.scale.width, H = this.scale.height, s = this.s;
    this.modalNote?.destroy();
    const n = this.add
      .text(W / 2, H - 22 * s, msg, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${18 * s}px`, color: '#ffe6a8', stroke: '#140b04', strokeThickness: 5 * s, align: 'center', wordWrap: { width: W - 30 * s } })
      .setOrigin(0.5, 1)
      .setDepth(14000);
    this.modalNote = n;
    this.tweens.add({ targets: n, alpha: 0, delay: 2400, duration: 500, onComplete: () => n.destroy() });
  }

  /** Пояснение, почему нет кнопок «за рекламу» (площадка просит не прятать их молча). */
  private adsNotice(): string {
    return Platform.adsOff === 'adblock' ? t('ad.offAdblock') : t('ad.offDisabled');
  }

  /** Мелкая надпись-пояснение в окне. */
  private noteText(x: number, y: number, msg: string, width: number): Phaser.GameObjects.Text {
    const s = this.s;
    return this.add
      .text(x, y, msg, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${13 * s}px`, color: '#d8b8a0', stroke: '#140b04', strokeThickness: 3 * s, align: 'center', wordWrap: { width } })
      .setOrigin(0.5);
  }

  update(): void {
    const g = this.g;
    const s = this.s, W = this.scale.width;
    const h = 12 * s;
    const k = Phaser.Math.Clamp(g.xp / g.xpNext, 0, 1);
    this.hud.clear();
    this.hud.fillStyle(0x0b0f08, 0.8).fillRect(0, 0, W, h + 4 * s);
    this.hud.fillStyle(COLORS.xp, 1).fillRect(2 * s, 2 * s, (W - 4 * s) * k, h);
    this.hud.fillStyle(0xffffff, 0.28).fillRect(2 * s, 2 * s, (W - 4 * s) * k, h * 0.35);
    this.levelText.setText(t('hud.level', { n: g.level }));
    this.killsText.setText(t('hud.kills', { n: g.kills }));
    this.timerText.setText(fmtTime(g.elapsed));
    this.rageText.setVisible(g.rageT > 0);
    if (g.rageT > 0) {
      const rw = 170 * s, rh = 16 * s, rx = (W - rw) / 2, ry = 50 * s;
      this.hud.fillStyle(0x000000, 0.65).fillRoundedRect(rx - 2 * s, ry - 2 * s, rw + 4 * s, rh + 4 * s, 6 * s);
      this.hud.fillStyle(0xd8401e, 1).fillRoundedRect(rx, ry, Math.max(1, rw * (g.rageT / RAGE_TIME)), rh, 5 * s);
      this.rageText.setText(t('hud.rage', { n: Math.ceil(g.rageT) })).setY(ry + rh / 2);
    }

    // Полоска здоровья Змея Горыныча (ближайшего живого)
    const bosses = g.bossList();
    const boss = bosses.sort((a, b) => Math.hypot(a.x - g.player.x, a.y - g.player.y) - Math.hypot(b.x - g.player.x, b.y - g.player.y))[0];
    this.bossText.setVisible(!!boss);
    if (boss) {
      const bw = Math.min(W * 0.6, 380 * s), bh = 10 * s, bx = (W - bw) / 2;
      // На узком экране иконки умений доходят до середины — тогда полоска под ними
      const by = this.iconsRight > bx ? Math.max(80 * s, this.iconsBottom + 22 * s) : 80 * s;
      this.bossText.setY(by - 4 * s);
      const others = bosses.length - 1;
      this.bossText.setText(others > 0 ? `${tx(boss.ztype.name)} (+${others})` : tx(boss.ztype.name));
      this.hud.fillStyle(0x000000, 0.7).fillRoundedRect(bx - 2 * s, by - 2 * s, bw + 4 * s, bh + 4 * s, 4 * s);
      this.hud.fillStyle(0x3fae3a, 1).fillRoundedRect(bx, by, Math.max(1, bw * Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1)), bh, 3 * s);
      this.hud.fillStyle(0xffffff, 0.25).fillRect(bx, by, bw * Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1), bh * 0.35);
    }
    this.updateChestArrow();
  }

  /** Стрелка у края экрана к ближайшему сундуку, если его не видно. */
  private updateChestArrow(): void {
    const g = this.g, s = this.s, W = this.scale.width, H = this.scale.height;
    const cam = g.cameras.main;
    const p = g.player;
    const c = g.chests.slice().sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!c || this.modal) {
      this.chestArrow.setVisible(false);
      return;
    }
    const v = cam.worldView;
    const sx = (c.x - v.x) * cam.zoom, sy = (c.y - 20 - v.y) * cam.zoom;
    const m = 34 * s;
    if (sx > m && sx < W - m && sy > m + 30 * s && sy < H - m) {
      this.chestArrow.setVisible(false);
      return;
    }
    const cx = W / 2, cy = H / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    // точка на краю экрана по направлению к сундуку
    const kx = (W / 2 - m) / Math.max(1e-3, Math.abs(Math.cos(ang))), ky = (H / 2 - m - 20 * s) / Math.max(1e-3, Math.abs(Math.sin(ang)));
    const r = Math.min(kx, ky);
    const ax = cx + Math.cos(ang) * r, ay = cy + Math.sin(ang) * r;
    const pulse = 1 + Math.sin(this.time.now / 180) * 0.08;
    const gfx = this.chestArrowGfx;
    gfx.clear();
    gfx.fillStyle(0x000000, 0.45).fillCircle(0, 0, 21 * s);
    gfx.lineStyle(2 * s, COLORS.gold, 0.9).strokeCircle(0, 0, 21 * s);
    const tip = 32 * s, base = 20 * s, half = 8 * s;
    gfx.fillStyle(COLORS.gold, 1).fillTriangle(Math.cos(ang) * tip, Math.sin(ang) * tip, Math.cos(ang) * base - Math.sin(ang) * half, Math.sin(ang) * base + Math.cos(ang) * half, Math.cos(ang) * base + Math.sin(ang) * half, Math.sin(ang) * base - Math.cos(ang) * half);
    (this.chestArrow.list[1] as Phaser.GameObjects.Image).setDisplaySize(30 * s, 25 * s);
    this.chestArrow.setPosition(ax, ay).setScale(pulse).setVisible(true);
  }

  // ------------------------------------------------------------------ Настройки

  private openSettings(): void {
    if (this.settings || this.busy) return;
    this.releaseJoystick();
    this.settingsPaused = this.g.state === 'play';
    if (this.settingsPaused) {
      this.g.scene.pause();
      Platform.gameplayStop();
    }
    this.settings = new SettingsPanel(this, this.s, () => this.onSettingsClosed(), () => void this.exitToMenu(), () => this.reopenSettings());
  }

  /** Выйти из забега в главное меню (злато за пройденное начисляется). */
  private async exitToMenu(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.g.quitRun();
    this.busy = false;
    this.settings?.destroy();
    this.settings = null;
    this.closeModal();
    this.modalStats = null;
    this.scene.stop('Game');
    this.scene.start('Menu');
  }

  /** Сменили язык в настройках — окно пересоздаётся на новом языке (интерфейс боя обновится сам). */
  private reopenSettings(): void {
    this.settings?.destroy();
    this.settings = new SettingsPanel(this, this.s, () => this.onSettingsClosed(), () => void this.exitToMenu(), () => this.reopenSettings());
  }

  private onSettingsClosed(): void {
    this.settings = null;
    if (this.settingsPaused && this.g.state === 'play') {
      this.g.scene.resume();
      Platform.gameplayStart();
    }
    this.settingsPaused = false;
  }

  private rebuildIcons(): void {
    if (!this.icons) return;
    this.icons.removeAll(true);
    const s = this.s;
    const size = 30 * s, gap = 5 * s;
    const owned = [...this.g.levels.entries()];
    this.iconsRight = 0;
    this.iconsBottom = 0;
    const rows = [
      owned.filter(([id]) => ABILITY_BY_ID.get(id)?.kind === 'weapon'),
      owned.filter(([id]) => ABILITY_BY_ID.get(id)?.kind === 'passive'),
    ];
    // Предметы из сундуков — третьим рядом, рамка цвета редкости
    const r3 = rows.filter((r) => r.length).length;
    this.g.items.forEach((id, i) => {
      const def = ITEM_BY_ID.get(id)!;
      const x = 10 * s + i * (size + gap);
      const y = 22 * s + r3 * (size + gap);
      this.iconsRight = Math.max(this.iconsRight, x + size + 6 * s);
      this.iconsBottom = Math.max(this.iconsBottom, y + size + 6 * s);
      const bg = this.add.graphics();
      bg.fillStyle(0x000000, 0.45).fillRoundedRect(x, y, size, size, 6 * s);
      bg.lineStyle(2 * s, RARITY[def.rarity].color, 0.95).strokeRoundedRect(x, y, size, size, 6 * s);
      const im = this.add.image(x + size / 2, y + size / 2, `item-${id}`).setDisplaySize(size * 0.86, size * 0.86);
      if (id === 'feather' && this.g.featherUsed) im.setAlpha(0.3);
      this.icons.add([bg, im]);
    });
    rows.forEach((row, r) =>
      row.forEach(([id, lvl], i) => {
        const def = ABILITY_BY_ID.get(id)!;
        const x = 10 * s + i * (size + gap);
        const y = 22 * s + r * (size + gap);
        this.iconsRight = Math.max(this.iconsRight, x + size + 6 * s);
        this.iconsBottom = Math.max(this.iconsBottom, y + size + 6 * s);
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.45).fillRoundedRect(x, y, size, size, 6 * s);
        bg.lineStyle(1.5 * s, COLORS.gold, 0.6).strokeRoundedRect(x, y, size, size, 6 * s);
        const im = this.add.image(x + size / 2, y + size / 2, def.icon).setDisplaySize(size * 0.84, size * 0.84);
        const t = this.add
          .text(x + size + 1 * s, y + size + 2 * s, String(lvl), {
            fontFamily: FONT_UI,
            fontStyle: 'bold',
            fontSize: `${12 * s}px`,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3 * s,
          })
          .setOrigin(1, 1);
        this.icons.add([bg, im, t]);
      }),
    );
  }

  private onHurt(): void {
    this.tweens.killTweensOf(this.vignette);
    this.vignette.setAlpha(0.6);
    this.tweens.add({ targets: this.vignette, alpha: 0, duration: 380 });
  }

  private toast(msg: string): void {
    this.tweens.killTweensOf(this.toastText);
    // длинная надпись на узком экране — уменьшаем шрифт, чтобы влезла
    const W = this.scale.width;
    this.toastText.setFontSize(30 * this.s).setText(msg);
    if (this.toastText.width > W * 0.92) this.toastText.setFontSize(Math.floor((30 * this.s * W * 0.92) / this.toastText.width));
    this.toastText.setAlpha(0).setScale(0.8);
    this.tweens.add({
      targets: this.toastText,
      alpha: 1,
      scale: 1,
      duration: 250,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 1400,
    });
  }

  // ------------------------------------------------------------------ Джойстик

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.modal || this.settings || this.joyId !== -1) return;
    if (this.gear.getBounds().contains(p.x, p.y)) return;
    if (this.debug?.contains(p.x, p.y)) return;
    this.joyId = p.id;
    this.joyOx = p.x;
    this.joyOy = p.y;
    this.joyBase.setPosition(p.x, p.y).setVisible(true);
    this.joyKnob.setPosition(p.x, p.y).setVisible(true);
  }

  private onPointerMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.joyId || !p.isDown) return;
    const max = 60 * this.s;
    let dx = p.x - this.joyOx, dy = p.y - this.joyOy;
    let d = Math.hypot(dx, dy);
    if (d > max) {
      // «Плавающая» база тянется за пальцем
      this.joyOx = p.x - (dx / d) * max;
      this.joyOy = p.y - (dy / d) * max;
      dx = p.x - this.joyOx;
      dy = p.y - this.joyOy;
      d = max;
      this.joyBase.setPosition(this.joyOx, this.joyOy);
    }
    this.joyKnob.setPosition(this.joyOx + dx, this.joyOy + dy);
    if (d < 6 * this.s) {
      this.g.joyX = this.g.joyY = 0;
    } else {
      const k = Math.min(1, d / (max * 0.55));
      this.g.joyX = (dx / d) * k;
      this.g.joyY = (dy / d) * k;
    }
  }

  private onPointerUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.joyId) this.releaseJoystick();
  }

  private releaseJoystick(): void {
    this.joyId = -1;
    this.joyBase.setVisible(false);
    this.joyKnob.setVisible(false);
    this.g.joyX = this.g.joyY = 0;
  }

  // ------------------------------------------------------------------ Модальные окна

  private closeModal(): void {
    this.modal?.destroy(true);
    this.modal = null;
    this.modalKind = null;
  }

  private onKey(e: KeyboardEvent): void {
    if (this.modalKind === 'chest' && this.modalItem && this.time.now - this.modalOpenedAt > 350 && ['Enter', 'Space', 'Digit1'].includes(e.code)) {
      this.takeChest();
      return;
    }
    if (this.modalKind === 'levelup' && this.time.now - this.modalOpenedAt > (this.g.prepLeft > 0 ? 120 : 250)) {
      const idx = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (idx >= 0 && idx < this.modalChoices.length) this.pick(this.modalChoices[idx]);
    }
  }

  private onLevelUp(choices: AbilityId[]): void {
    this.releaseJoystick();
    this.showLevelUp(choices, true);
  }

  private pick(id: AbilityId): void {
    if (this.modalKind !== 'levelup') return;
    this.g.sfx('click', 0.5);
    this.closeModal();
    this.g.chooseAbility(id);
  }

  private showLevelUp(choices: AbilityId[], animate: boolean): void {
    this.closeModal();
    this.modalKind = 'levelup';
    this.modalChoices = choices;
    if (animate) this.modalOpenedAt = this.time.now;
    const W = this.scale.width, H = this.scale.height, s = this.s;
    const c = this.add.container(0, 0);
    this.modal = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.62).setOrigin(0).setInteractive());

    const landscape = W > H * 1.15;
    const gap = 14 * s;
    const n = choices.length;
    let cw: number, ch: number;
    const pos: { x: number; y: number }[] = [];
    if (landscape) {
      cw = Math.min(250 * s, (W - 60 * s - gap * (n - 1)) / n);
      ch = Math.min(235 * s, H * 0.62);
      const x0 = (W - (n * cw + (n - 1) * gap)) / 2;
      const y0 = H / 2 - ch / 2 + 26 * s;
      for (let i = 0; i < n; i++) pos.push({ x: x0 + i * (cw + gap), y: y0 });
    } else {
      cw = Math.min(W - 28 * s, 440 * s);
      ch = 108 * s;
      const y0 = H / 2 - (n * ch + (n - 1) * gap) / 2 + 30 * s;
      for (let i = 0; i < n; i++) pos.push({ x: (W - cw) / 2, y: y0 + i * (ch + gap) });
    }

    // Подготовка к поздней главе: умения выбираются подряд, есть счётчик и «Остальное — случайно»
    const prep = this.g.prepLeft > 0;
    // в подготовке после первого окна — без долгой анимации, чтобы выбирать быстро
    const quick = prep && this.g.prepLeft < this.g.prepTotal;
    const title = this.add
      .text(W / 2, pos[0].y - (prep ? 50 : 36) * s, prep ? t('lvl.prep') : t('lvl.title'), {
        fontFamily: FONT_TITLE,
        fontSize: `${(prep ? 32 : 36) * s}px`,
        color: COLORS.goldText,
        stroke: '#2a1405',
        strokeThickness: 7 * s,
      })
      .setOrigin(0.5, 1);
    c.add(title);
    if (prep) {
      c.add(
        this.add
          .text(W / 2, pos[0].y - 16 * s, t('lvl.prepLeft', { left: this.g.prepLeft, total: this.g.prepTotal }), {
            fontFamily: FONT_UI,
            fontStyle: 'bold',
            fontSize: `${16 * s}px`,
            color: '#ffffff',
            stroke: '#140b04',
            strokeThickness: 4 * s,
          })
          .setOrigin(0.5, 1),
      );
      const last = pos[pos.length - 1];
      const bw = Math.min(W - 40 * s, 300 * s), bh = 44 * s;
      const by = (landscape ? last.y + ch : last.y + ch) + 18 * s;
      c.add(
        this.makeButton(t('lvl.restRandom'), W / 2, Math.min(by, H - bh - 10 * s), bw, bh, 0x5a4636, () => {
          this.closeModal();
          this.g.autoRest();
        }),
      );
    }

    if (!prep && Platform.adsOff) {
      const last = pos[pos.length - 1];
      c.add(this.noteText(W / 2, Math.min(last.y + ch + 34 * s, H - 24 * s), this.adsNotice(), W - 40 * s));
    } else if (!prep) {
      const fmt = (t: number) => {
        const left = Math.ceil(t);
        return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      };
      // слоты: «Буйство» (с 45-й секунды) и «Другие умения» — кнопка или таймер до следующего раза
      const slots: { label: string; color: number; fn: (() => void) | null }[] = [];
      if (this.g.elapsed > 45) {
        if (this.g.rageReady) slots.push({ label: t('lvl.rage'), color: 0xa8341a, fn: () => void this.offerRage() });
        else if (this.g.rageCd > 0) slots.push({ label: t('lvl.rageIn', { t: fmt(this.g.rageCd) }), color: 0, fn: null });
      }
      if (this.g.rerollCd <= 0) slots.push({ label: t('lvl.reroll'), color: 0x5a4636, fn: () => void this.rerollSkills() });
      else slots.push({ label: t('lvl.rerollIn', { t: fmt(this.g.rerollCd) }), color: 0, fn: null });
      const last = pos[pos.length - 1];
      const n = slots.length;
      const bw = Math.min((W - 40 * s - 12 * s * (n - 1)) / n, 300 * s), bh = 44 * s;
      const by = Math.min(last.y + ch + 18 * s, H - bh - 10 * s);
      const x0 = W / 2 - (n * bw + (n - 1) * 12 * s) / 2;
      slots.forEach((sl, i) => {
        const cx = x0 + i * (bw + 12 * s) + bw / 2;
        if (sl.fn) c.add(this.makeButton(sl.label, cx, by, bw, bh, sl.color, sl.fn));
        else
          c.add(
            this.add
              .text(cx, by + bh / 2, sl.label, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${14 * s}px`, color: '#d8b8a0', stroke: '#140b04', strokeThickness: 3 * s })
              .setOrigin(0.5),
          );
      });
    }

    choices.forEach((id, i) => {
      const card = this.makeCard(id, i, pos[i].x, pos[i].y, cw, ch, landscape);
      c.add(card);
      if (animate && quick) {
        card.setAlpha(0.3);
        this.tweens.add({ targets: card, alpha: 1, duration: 120 });
      } else if (animate) {
        card.setAlpha(0).setY(card.y + 30 * s);
        this.tweens.add({ targets: card, alpha: 1, y: pos[i].y, duration: 260, delay: 70 * i, ease: 'Back.easeOut' });
      }
    });
    if (animate && !quick) {
      title.setScale(0.6);
      this.tweens.add({ targets: title, scale: 1, duration: 300, ease: 'Back.easeOut' });
    }
  }

  private makeCard(id: AbilityId, index: number, x: number, y: number, w: number, h: number, vertical: boolean) {
    const s = this.s;
    const def = ABILITY_BY_ID.get(id)!;
    const cur = id === 'pie' ? 0 : this.g.getLevel(id);
    const next = cur + 1;
    const card = this.add.container(x, y);
    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.35).fillRoundedRect(3 * s, 5 * s, w, h, 14 * s);
      bg.fillStyle(hover ? 0xfff3d6 : COLORS.parchment, 1).fillRoundedRect(0, 0, w, h, 14 * s);
      bg.lineStyle(3 * s, hover ? COLORS.gold : 0x8b1e1e, 1).strokeRoundedRect(0, 0, w, h, 14 * s);
      bg.lineStyle(1.2 * s, 0x8b1e1e, 0.5).strokeRoundedRect(6 * s, 6 * s, w - 12 * s, h - 12 * s, 10 * s);
    };
    draw(false);
    card.add(bg);

    const badgeText = def.kind === 'consumable' ? t('card.treat') : cur === 0 ? t('card.new') : t('card.lvl', { n: next });
    const badgeColor = cur === 0 && def.kind !== 'consumable' ? '#b3261e' : '#5a3a1a';
    const kindText = def.kind === 'weapon' ? t('card.weapon') : def.kind === 'passive' ? t('card.skill') : '';

    const nameStyle = { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${20 * s}px`, color: COLORS.ink };
    const descStyle = { fontFamily: FONT_UI, fontSize: `${15 * s}px`, color: '#4a2f1a' };
    const smallStyle = { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${13 * s}px`, color: badgeColor };

    if (vertical) {
      const icon = this.add.image(w / 2, 58 * s, def.icon).setDisplaySize(72 * s, 72 * s);
      const name = this.add.text(w / 2, 104 * s, tx(def.name), { ...nameStyle, align: 'center', wordWrap: { width: w - 24 * s } }).setOrigin(0.5, 0);
      const badge = this.add.text(w / 2, 14 * s, badgeText, smallStyle).setOrigin(0.5, 0);
      const desc = this.add
        .text(w / 2, name.y + name.height + 10 * s, abilityDesc(def, next), { ...descStyle, align: 'center', wordWrap: { width: w - 28 * s } })
        .setOrigin(0.5, 0);
      card.add([icon, name, badge, desc]);
    } else {
      const icon = this.add.image(18 * s + 34 * s, h / 2, def.icon).setDisplaySize(64 * s, 64 * s);
      const textX = 100 * s;
      const name = this.add.text(textX, 14 * s, tx(def.name), nameStyle);
      const badge = this.add.text(w - 14 * s, 16 * s, badgeText, smallStyle).setOrigin(1, 0);
      const desc = this.add.text(textX, 14 * s + name.height + 6 * s, abilityDesc(def, next), {
        ...descStyle,
        wordWrap: { width: w - textX - 16 * s },
      });
      card.add([icon, name, badge, desc]);
    }
    if (kindText) {
      card.add(
        this.add
          .text(vertical ? w / 2 : w - 14 * s, h - 12 * s, `${kindText} · ${index + 1}`, {
            fontFamily: FONT_UI,
            fontSize: `${11 * s}px`,
            color: '#8a6a4a',
          })
          .setOrigin(vertical ? 0.5 : 1, 1),
      );
    }

    const zone = this.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    let pressed = false;
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => {
      draw(false);
      pressed = false;
    });
    zone.on('pointerdown', () => {
      pressed = true;
    });
    zone.on('pointerup', () => {
      // Защита от случайного тапа: палец, которым вели героя, мог отпуститься прямо на карточке
      if (pressed && this.time.now - this.modalOpenedAt > 250) this.pick(id);
      pressed = false;
    });
    card.add(zone);
    return card;
  }

  private onBiome(): void {
    this.mood.setFillStyle(this.g.biome.mood);
  }

  // ------------------------------------------------------------------ Сундук

  private onChest(id: ItemId): void {
    this.releaseJoystick();
    this.chestRerolled = false;
    this.showChest(id, true);
  }

  private takeChest(): void {
    if (this.modalKind !== 'chest' || !this.modalItem) return;
    // защита от случайного тапа: палец, которым вели богатыря, мог отпуститься на кнопке
    if (this.time.now - this.modalOpenedAt < 350) return;
    const id = this.modalItem;
    this.g.sfx('click', 0.5);
    this.closeModal();
    this.modalItem = null;
    this.g.takeItem(id);
  }

  private showChest(id: ItemId, animate: boolean): void {
    this.closeModal();
    this.modalKind = 'chest';
    this.modalItem = id;
    if (animate) this.modalOpenedAt = this.time.now;
    const def = ITEM_BY_ID.get(id)!;
    const rar = RARITY[def.rarity];
    const W = this.scale.width, H = this.scale.height, s = this.s;
    const c = this.add.container(0, 0);
    this.modal = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.68).setOrigin(0).setInteractive());

    // «Другой предмет» за рекламу — раз за сундук, если есть из чего выбирать
    const canReroll = !this.chestRerolled && this.g.items.length < ITEMS.length - 1 && !Platform.adsOff;
    const cw = Math.min(W - 40 * s, 330 * s), ch = 320 * s;
    const cx = W / 2, cy = H / 2 + 18 * s - (canReroll ? 30 * s : 0);

    // Лучи цвета редкости за карточкой
    const rays = this.add.image(cx, cy - 40 * s, 'scorch_02').setBlendMode(Phaser.BlendModes.ADD).setTint(rar.color).setAlpha(0.75);
    rays.setScale((Math.min(W, H) * 0.95) / 512);
    this.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
    const glow = this.add.image(cx, cy - 40 * s, 'circle_05').setBlendMode(Phaser.BlendModes.ADD).setTint(rar.color).setScale((cw * 2.2) / 512).setAlpha(0.6);
    this.tweens.add({ targets: glow, alpha: 0.3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    c.add([glow, rays]);

    c.add(
      this.add
        .text(cx, cy - ch / 2 - 16 * s, t('chest.title'), {
          fontFamily: FONT_TITLE,
          fontSize: `${38 * s}px`,
          color: COLORS.goldText,
          stroke: '#2a1405',
          strokeThickness: 7 * s,
        })
        .setOrigin(0.5, 1),
    );

    const card = this.add.container(cx, cy);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.4).fillRoundedRect(-cw / 2 + 4 * s, -ch / 2 + 6 * s, cw, ch, 16 * s);
    bg.fillStyle(COLORS.parchment, 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 16 * s);
    bg.lineStyle(5 * s, rar.color, 1).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 16 * s);
    bg.lineStyle(1.5 * s, rar.color, 0.6).strokeRoundedRect(-cw / 2 + 8 * s, -ch / 2 + 8 * s, cw - 16 * s, ch - 16 * s, 11 * s);
    card.add(bg);
    const rarText = this.add
      .text(0, -ch / 2 + 16 * s, tx(rar.name), { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${17 * s}px`, color: rar.text, stroke: '#2a1405', strokeThickness: 4 * s })
      .setOrigin(0.5, 0);
    const iconBg = this.add.graphics();
    iconBg.fillStyle(rar.color, 0.18).fillCircle(0, -ch / 2 + 98 * s, 50 * s);
    iconBg.lineStyle(2 * s, rar.color, 0.7).strokeCircle(0, -ch / 2 + 98 * s, 50 * s);
    const icon = this.add.image(0, -ch / 2 + 98 * s, `item-${id}`).setDisplaySize(84 * s, 84 * s);
    const name = this.add
      .text(0, -ch / 2 + 160 * s, tx(def.name), { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${23 * s}px`, color: COLORS.ink, align: 'center', wordWrap: { width: cw - 30 * s } })
      .setOrigin(0.5, 0);
    const desc = this.add
      .text(0, name.y + name.height + 8 * s, tx(def.desc), { fontFamily: FONT_UI, fontSize: `${16 * s}px`, color: '#4a2f1a', align: 'center', wordWrap: { width: cw - 36 * s } })
      .setOrigin(0.5, 0);
    card.add([rarText, iconBg, icon, name, desc]);
    c.add(card);

    const bw = cw - 70 * s, bh = 48 * s;
    c.add(this.makeButton(t('chest.take'), cx, cy + ch / 2 - bh - 18 * s, bw, bh, 0x8b1e1e, () => this.takeChest()));
    if (!canReroll && Platform.adsOff && !this.chestRerolled) c.add(this.noteText(cx, cy + ch / 2 + 26 * s, this.adsNotice(), W - 40 * s));
    if (canReroll) {
      c.add(this.makeButton(t('chest.reroll'), cx, cy + ch / 2 + 14 * s, Math.min(W - 40 * s, 300 * s), 44 * s, 0x5a4636, () => void this.rerollChest()));
    }

    if (animate) {
      card.setScale(0.4).setAlpha(0);
      this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
      icon.setScale(0);
      this.tweens.add({ targets: icon, displayWidth: 84 * s, displayHeight: 84 * s, delay: 200, duration: 380, ease: 'Back.easeOut' });
    }
  }

  private onGameOver(stats: RunStats): void {
    this.releaseJoystick();
    this.showGameOver(stats, true);
  }

  private showGameOver(stats: RunStats, animate: boolean): void {
    this.closeModal();
    this.modalKind = 'gameover';
    this.modalStats = stats;
    const W = this.scale.width, H = this.scale.height;
    let s = this.s;
    const c = this.add.container(0, 0);
    this.modal = c;
    c.add(this.add.rectangle(0, 0, W, H, 0x000000, 0.7).setOrigin(0).setInteractive());

    const buttons: { label: string; color: number; fn: () => void }[] = [];
    const ads = !Platform.adsOff;
    if (stats.canRevive && ads) buttons.push({ label: t('over.revive'), color: 0x1f7a5a, fn: () => void this.revive() });
    if (stats.canRevive) {
      const cost = this.g.reviveCost;
      const enough = Save.get().gold >= cost;
      buttons.push({ label: t('over.reviveGold', { n: cost }), color: enough ? 0x1f7a5a : 0x55554c, fn: () => this.reviveForGold() });
    }
    if (ads && !this.g.goldDoubled && stats.gold > 0) buttons.push({ label: t('over.double', { x1: stats.gold, x2: stats.gold * 2 }), color: 0xb8861e, fn: () => void this.doubleGold() });
    buttons.push({ label: t('over.again'), color: 0x8b1e1e, fn: () => this.restart() });
    buttons.push({ label: t('over.menu'), color: 0x5a4636, fn: () => void this.exitToMenu() });
    const landscape = W > H * 1.15;
    const cols = landscape && buttons.length > 2 ? 2 : 1;
    const rows = Math.ceil(buttons.length / cols);
    const notice = !ads && (stats.canRevive || (!this.g.goldDoubled && stats.gold > 0));
    // невысокий экран (окно 800×450, телефон боком): окно с заголовком ужимается, чтобы влезть целиком
    const tall = 172 + rows * 50 + (rows - 1) * 12 + 22 + (notice ? 30 : 0) + 128;
    s = Math.min(s, (H - 8 * this.s) / tall);
    const bh = 50 * s, bgap = 12 * s;
    const pw = Math.min(W - 28 * s, (cols === 2 ? 600 : 400) * s);
    const ph = 172 * s + rows * bh + (rows - 1) * bgap + 22 * s + (notice ? 30 * s : 0);
    const px = (W - pw) / 2, py = H / 2 - ph / 2 + 10 * s;
    const panel = this.add.graphics();
    panel.fillStyle(COLORS.parchment, 1).fillRoundedRect(px, py, pw, ph, 16 * s);
    panel.lineStyle(3 * s, 0x8b1e1e, 1).strokeRoundedRect(px, py, pw, ph, 16 * s);
    c.add(panel);

    c.add(
      this.add
        .text(W / 2, py - 14 * s, stats.won ? t('over.win') : t('over.lose'), {
          fontFamily: FONT_TITLE,
          fontSize: `${(stats.won ? 44 : 36) * s}px`,
          color: stats.won ? COLORS.goldText : '#ff6b5a',
          stroke: '#2a0805',
          strokeThickness: 7 * s,
        })
        .setOrigin(0.5, 1),
    );

    const lines = [
      stats.won ? t('over.winTime', { t: fmtTime(stats.time) }) : t('over.time', { t: fmtTime(stats.time) }),
      t('over.kills', { n: stats.kills }),
      t('over.level', { n: stats.level }),
      this.g.goldDoubled ? t('over.goldX2', { n: stats.gold, total: stats.totalGold }) : t('over.gold', { n: stats.gold, total: stats.totalGold }),
    ];
    c.add(
      this.add
        .text(W / 2, py + 24 * s, lines.join('\n'), {
          fontFamily: FONT_UI,
          fontStyle: 'bold',
          fontSize: `${20 * s}px`,
          color: COLORS.ink,
          align: 'center',
          lineSpacing: 8 * s,
        })
        .setOrigin(0.5, 0),
    );

    const bw = (pw - 48 * s - (cols - 1) * bgap) / cols;
    const by0 = py + 172 * s;
    buttons.forEach((b, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = px + 24 * s + col * (bw + bgap) + bw / 2;
      c.add(this.makeButton(b.label, cx, by0 + row * (bh + bgap), bw, bh, b.color, b.fn));
    });
    if (notice) {
      const note = this.noteText(W / 2, py + ph - 26 * s, this.adsNotice(), pw - 30 * s);
      c.add(note.setColor('#7a5a3a').setStroke('#000000', 0));
    }

    if (animate) {
      c.setAlpha(0);
      this.tweens.add({ targets: c, alpha: 1, duration: 300 });
    }
  }

  private makeButton(label: string, cx: number, y: number, w: number, h: number, color: number, onClick: () => void) {
    const s = this.s;
    const b = this.add.container(cx - w / 2, y);
    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(0x000000, 0.3).fillRoundedRect(2 * s, 4 * s, w, h, 12 * s);
      bg.fillStyle(color, 1).fillRoundedRect(0, 0, w, h, 12 * s);
      bg.lineStyle(2.5 * s, hover ? 0xffffff : COLORS.gold, 1).strokeRoundedRect(0, 0, w, h, 12 * s);
    };
    draw(false);
    const t = this.add
      .text(w / 2, h / 2, label, {
        fontFamily: FONT_UI,
        fontStyle: 'bold',
        fontSize: `${(label.length > 20 ? 16 : 20) * s}px`,
        color: '#ffffff',
        stroke: '#1a0a04',
        strokeThickness: 3 * s,
      })
      .setOrigin(0.5);
    // длинная подпись в узкой кнопке ужимается по ширине
    if (t.width > w - 14 * s) t.setScale((w - 14 * s) / t.width);
    const zone = this.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout', () => draw(false));
    zone.on('pointerup', () => {
      if (this.busy) return;
      this.g.sfx('click', 0.5);
      onClick();
    });
    b.add([bg, t, zone]);
    return b;
  }

  /**
   * Реклама за награду: true — досмотрена (награду даём только тогда).
   * Рекламы нет — короткая надпись; недоступна совсем — окно перерисуется без рекламных кнопок.
   */
  private async watchAd(): Promise<boolean> {
    this.busy = true;
    const r = await Platform.rewarded();
    this.busy = false;
    if (r === 'unavailable') this.note(t('ad.later'));
    if (r === 'blocked') {
      this.note(this.adsNotice());
      this.refreshModal();
    }
    return r === 'ok';
  }

  /** «Другой предмет» в сундуке за рекламу. */
  private async rerollChest(): Promise<void> {
    if (this.busy || this.modalKind !== 'chest' || !this.modalItem) return;
    if (!(await this.watchAd()) || this.modalKind !== 'chest' || !this.modalItem) return;
    const id = this.g.rerollChestItem(this.modalItem);
    if (!id) return;
    this.chestRerolled = true;
    this.showChest(id, true);
  }

  /** «Другие умения» на экране уровня за рекламу. */
  private async rerollSkills(): Promise<void> {
    if (this.busy || this.modalKind !== 'levelup' || this.g.rerollCd > 0) return;
    if (!(await this.watchAd()) || this.modalKind !== 'levelup') return;
    this.showLevelUp(this.g.rerollChoices(), true);
  }

  /** ×2 злата за забег на экране поражения/победы. */
  private async doubleGold(): Promise<void> {
    if (this.busy || this.modalKind !== 'gameover' || !this.modalStats || this.g.goldDoubled) return;
    if (!(await this.watchAd()) || !this.modalStats) return;
    const r = this.g.doubleGold();
    this.g.sfx('levelup', 0.5);
    this.showGameOver({ ...this.modalStats, gold: r.gold, totalGold: r.totalGold }, false);
  }

  /** «Буйство» за рекламу (с экрана нового уровня): награда — только если реклама досмотрена. */
  private async offerRage(): Promise<void> {
    if (this.busy || !this.g.rageReady) return;
    if (!(await this.watchAd())) return;
    this.g.startRage();
    // окно выбора остаётся — перерисуем без кнопки
    if (this.modalKind === 'levelup') this.showLevelUp(this.modalChoices, false);
  }

  private async revive(): Promise<void> {
    if (this.busy) return;
    if (!(await this.watchAd()) || this.modalKind !== 'gameover') return;
    this.closeModal();
    this.modalStats = null;
    this.g.revive();
  }

  /** Воскрешение за злато — без рекламы. */
  private reviveForGold(): void {
    if (this.modalKind !== 'gameover') return;
    const cost = this.g.reviveCost;
    if (!this.g.reviveForGold()) {
      this.note(t('over.noGold', { n: cost, have: Save.get().gold }));
      return;
    }
    this.closeModal();
    this.modalStats = null;
  }

  private restart(): void {
    this.closeModal();
    this.modalStats = null;
    this.g.scene.restart();
  }
}
