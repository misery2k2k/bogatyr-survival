import Phaser from 'phaser';
import { COLORS, DPR, FONT_TITLE, FONT_UI, TEX_RES } from '../config';
import { HERO_UNITS_TALL, HeroRig } from '../entities/HeroRig';
import { readZombieOrigins } from '../entities/Zombie';
import { Music } from '../music';
import { SettingsPanel } from '../ui/SettingsPanel';
import { Yandex } from '../yandex';

/** Титульный экран. */
export class MenuScene extends Phaser.Scene {
  private started = false;
  private hero: HeroRig | null = null;
  private swingT = 1.2;
  private settings: SettingsPanel | null = null;
  private gear: Phaser.GameObjects.Image | null = null;
  private uiScale = 1;
  private settingsClosedAt = -1e9;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.started = false;
    this.settings = null;
    readZombieOrigins(this);
    Music.init(this);
    this.build();
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.build, this);
      this.settings?.destroy();
      this.settings = null;
    });

    this.input.on('pointerup', this.start, this);
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.code !== 'Escape') this.start();
    });

    Yandex.loadingReady();
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

    const cy = H * 0.66;
    const heroH = Math.min(H, W * 1.3) * 0.34;
    this.add.image(W / 2, cy + 2 * s, 'shadow').setScale((heroH / 70) / TEX_RES, (heroH / 90) / TEX_RES).setDepth(cy - 1);
    this.hero = new HeroRig(this, W / 2, cy, heroH / HERO_UNITS_TALL);
    this.hero.setDepth(cy);

    const zh = heroH * 0.62 / 155;
    const zl = this.add.sprite(W / 2 - heroH * 0.85, cy + 16 * s, 'zombies').setScale(zh).setDepth(cy + 16 * s);
    zl.setOrigin(0.5, 0.93).play('m-attack');
    const zr = this.add.sprite(W / 2 + heroH * 0.85, cy + 10 * s, 'zombies').setScale(zh * 0.92).setFlipX(true).setDepth(cy + 10 * s);
    zr.setOrigin(0.5, 0.92).play('f-walk');

    this.add.rectangle(0, 0, W, H * 0.42, 0x000000, 0.25).setOrigin(0).setDepth(9000);
    this.add
      .text(W / 2, H * 0.14, 'Богатырь', {
        fontFamily: FONT_TITLE,
        fontSize: `${64 * s}px`,
        color: COLORS.goldText,
        stroke: '#2a1405',
        strokeThickness: 10 * s,
      })
      .setOrigin(0.5)
      .setDepth(9001);
    this.add
      .text(W / 2, H * 0.14 + 58 * s, 'против нечисти', {
        fontFamily: FONT_TITLE,
        fontSize: `${30 * s}px`,
        color: '#f1e2c0',
        stroke: '#2a1405',
        strokeThickness: 7 * s,
      })
      .setOrigin(0.5)
      .setDepth(9001);

    const touch = this.sys.game.device.input.touch;
    const prompt = this.add
      .text(W / 2, H * 0.84, touch ? 'Коснись, чтобы начать' : 'Нажми, чтобы начать', {
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

    this.add
      .text(W / 2, H * 0.84 + 40 * s, touch ? 'Веди пальцем — богатырь идёт, бьёт сам' : 'WASD / стрелки — идти. Бьёт сам.', {
        fontFamily: FONT_UI,
        fontSize: `${16 * s}px`,
        color: '#f1e2c0',
        stroke: '#140b04',
        strokeThickness: 4 * s,
      })
      .setOrigin(0.5)
      .setDepth(9001);

    const gs = this.uiScale;
    this.gear = this.add.image(W - 30 * gs, H - 30 * gs, 'icon-gear').setDisplaySize(40 * gs, 40 * gs).setDepth(9500).setInteractive({ useHandCursor: true });
    this.gear.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (!this.settings)
        this.settings = new SettingsPanel(this, gs, () => {
          this.settings = null;
          this.settingsClosedAt = this.time.now;
        });
    });
  }

  private start(): void {
    // Тот же тап, что закрыл настройки, не должен запускать игру
    if (this.started || this.settings || this.time.now - this.settingsClosedAt < 300) return;
    const p = this.input.activePointer;
    if (this.gear && this.gear.getBounds().contains(p.x, p.y)) return;
    this.started = true;
    this.scene.start('Game');
  }
}
