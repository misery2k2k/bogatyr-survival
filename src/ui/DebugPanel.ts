import Phaser from 'phaser';
import { FONT_UI } from '../config';
import { debugState } from '../debug';
import type { GameScene } from '../scenes/GameScene';

interface Btn {
  label: () => string;
  act: () => void;
  on?: () => boolean;
}

/**
 * Панель тестера (слева): уровни, умения, ускорение времени, бессмертие, боссы, главы.
 * F2 — спрятать/показать.
 */
export class DebugPanel {
  private root: Phaser.GameObjects.Container;
  private texts: { t: Phaser.GameObjects.Text; bg: Phaser.GameObjects.Graphics; b: Btn; w: number; h: number }[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly g: GameScene,
    private s: number,
  ) {
    this.root = scene.add.container(0, 0).setDepth(15500);
    this.build();
    scene.input.keyboard?.on('keydown-F2', this.toggle, this);
  }

  private buttons(): Btn[] {
    const g = this.g;
    const speed = (k: number): Btn => ({
      label: () => `×${k}`,
      on: () => debugState.timeScale === k,
      act: () => {
        debugState.timeScale = k;
        g.setTimeScale(k);
      },
    });
    return [
      { label: () => '+1 уровень', act: () => g.debugLevels(1) },
      { label: () => '+5 уровней', act: () => g.debugLevels(5) },
      { label: () => 'Все умения', act: () => g.debugMaxAll() },
      speed(1),
      speed(2),
      speed(4),
      speed(8),
      {
        label: () => (debugState.god ? 'Бессмертие: ВКЛ' : 'Бессмертие: выкл'),
        on: () => debugState.god,
        act: () => {
          debugState.god = !debugState.god;
          g.player.god = debugState.god;
          if (debugState.god) g.player.hp = g.player.stats.maxHp;
        },
      },
      { label: () => '+1 минута', act: () => g.debugAddTime(60) },
      { label: () => 'Босс сейчас', act: () => g.debugBoss() },
      { label: () => 'След. глава', act: () => g.debugChapter() },
      { label: () => 'Убить всех', act: () => g.debugKillAll() },
      { label: () => 'Сундук', act: () => g.debugChest() },
    ];
  }

  private build(): void {
    this.root.removeAll(true);
    this.texts = [];
    const s = this.s;
    const x0 = 8 * s;
    let y = this.scene.scale.height * 0.3;
    const bw = 116 * s, bh = 24 * s, gap = 4 * s;
    const list = this.buttons();
    // скорости — в одну строку
    let row: Btn[] = [];
    const flushRow = () => {
      if (!row.length) return;
      const w = (bw - gap * (row.length - 1)) / row.length;
      row.forEach((b, i) => this.add(b, x0 + i * (w + gap), y, w, bh));
      y += bh + gap;
      row = [];
    };
    for (const b of list) {
      if (b.label().startsWith('×')) {
        row.push(b);
        continue;
      }
      flushRow();
      this.add(b, x0, y, bw, bh);
      y += bh + gap;
    }
    flushRow();
    this.root.setVisible(debugState.panel);
  }

  private add(b: Btn, x: number, y: number, w: number, h: number): void {
    const s = this.s;
    const bg = this.scene.add.graphics();
    const t = this.scene.add
      .text(x + w / 2, y + h / 2, '', { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${12 * s}px`, color: '#ffffff' })
      .setOrigin(0.5);
    const zone = this.scene.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e.stopPropagation());
    zone.on('pointerup', () => {
      b.act();
      this.refresh();
    });
    bg.setPosition(x, y);
    this.root.add([bg, t, zone]);
    this.texts.push({ t, bg, b, w, h });
    this.paint(this.texts[this.texts.length - 1]);
  }

  private paint(e: { t: Phaser.GameObjects.Text; bg: Phaser.GameObjects.Graphics; b: Btn; w: number; h: number }): void {
    const on = e.b.on?.() ?? false;
    e.bg.clear();
    e.bg.fillStyle(on ? 0x2a7a3a : 0x000000, on ? 0.85 : 0.55).fillRoundedRect(0, 0, e.w, e.h, 5 * this.s);
    e.bg.lineStyle(1, 0xffd27a, 0.6).strokeRoundedRect(0, 0, e.w, e.h, 5 * this.s);
    e.t.setText(e.b.label());
  }

  refresh(): void {
    for (const e of this.texts) this.paint(e);
  }

  /** Попал ли палец в панель (чтобы не включался джойстик). */
  contains(x: number, y: number): boolean {
    if (!this.root.visible) return false;
    return this.root.getBounds().contains(x, y);
  }

  resize(s: number): void {
    this.s = s;
    this.build();
  }

  private toggle(): void {
    debugState.panel = !debugState.panel;
    this.root.setVisible(debugState.panel);
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-F2', this.toggle, this);
    this.root.destroy(true);
  }
}
