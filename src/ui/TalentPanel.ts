import Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI } from '../config';
import { Save } from '../save';
import { BRANCHES, TALENTS, buy, canBuy, talentLevel, type TalentDef } from '../talents';

/**
 * Древо талантов: три ветви по три таланта. Злато копится за забеги, вкладываются здесь
 * и действуют во всех следующих забегах.
 */
export class TalentPanel {
  readonly root: Phaser.GameObjects.Container;

  /** Масштаб окна: s, но ужатый, если окно не влезает по высоте. */
  private s: number;

  constructor(
    private readonly scene: Phaser.Scene,
    s: number,
    private readonly onClose: () => void,
  ) {
    this.root = scene.add.container(0, 0).setDepth(20000);
    // полная высота окна в единицах макета: шапка + 3 ряда карточек + кнопка + заголовок сверху
    const need = 96 + 3 * 112 + 2 * 22 + 84 + 60;
    this.s = Math.min(s, scene.scale.height / need);
    this.build();
    scene.input.keyboard?.on('keydown-ESC', this.close, this);
  }

  private build(): void {
    const { scene, s } = this;
    this.root.removeAll(true);
    const W = scene.scale.width, H = scene.scale.height;
    const c = this.root;
    c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.72).setOrigin(0).setInteractive());

    const cols = BRANCHES.length;
    const gap = 10 * s;
    const pw = Math.min(W - 24 * s, 600 * s);
    const cw = (pw - 24 * s - gap * (cols - 1)) / cols;
    const ch = 112 * s, vgap = 22 * s;
    const ph = 96 * s + 3 * ch + 2 * vgap + 84 * s;
    const px = (W - pw) / 2, py = Math.max(52 * s, (H - ph) / 2);

    const panel = scene.add.graphics();
    panel.fillStyle(0x000000, 0.35).fillRoundedRect(px + 3 * s, py + 5 * s, pw, ph, 16 * s);
    panel.fillStyle(COLORS.parchment, 1).fillRoundedRect(px, py, pw, ph, 16 * s);
    panel.lineStyle(3 * s, 0x8b1e1e, 1).strokeRoundedRect(px, py, pw, ph, 16 * s);
    c.add(panel);
    c.add(
      scene.add
        .text(W / 2, py - 10 * s, 'Древо талантов', { fontFamily: FONT_TITLE, fontSize: `${32 * s}px`, color: COLORS.goldText, stroke: '#2a1405', strokeThickness: 7 * s })
        .setOrigin(0.5, 1),
    );
    // кошелёк
    c.add(scene.add.image(W / 2 - 52 * s, py + 26 * s, 'icon-coin').setDisplaySize(28 * s, 28 * s));
    c.add(
      scene.add
        .text(W / 2 - 34 * s, py + 26 * s, `${Save.get().gold} злата`, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${20 * s}px`, color: COLORS.ink })
        .setOrigin(0, 0.5),
    );

    BRANCHES.forEach((b, bi) => {
      const x = px + 12 * s + bi * (cw + gap);
      let y = py + 56 * s;
      c.add(scene.add.text(x + cw / 2, y, b.name, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${17 * s}px`, color: '#8b1e1e' }).setOrigin(0.5, 0));
      y += 30 * s;
      const list = TALENTS.filter((t) => t.branch === b.id);
      list.forEach((t, i) => {
        if (i > 0) {
          // ветка между узлами
          const line = scene.add.graphics();
          line.lineStyle(4 * s, talentLevel(list[i - 1].id) > 0 ? 0x6b8e23 : 0xb8a888, 1).lineBetween(x + cw / 2, y - vgap, x + cw / 2, y);
          c.add(line);
        }
        c.add(this.card(t, x, y, cw, ch));
        y += ch + vgap;
      });
    });

    // кнопка «Готово»
    const bw = Math.min(pw - 60 * s, 260 * s), bh = 46 * s, bx = W / 2 - bw / 2, by = py + ph - bh - 16 * s;
    const btn = scene.add.graphics();
    btn.fillStyle(0x8b1e1e, 1).fillRoundedRect(bx, by, bw, bh, 12 * s);
    btn.lineStyle(2.5 * s, COLORS.gold, 1).strokeRoundedRect(bx, by, bw, bh, 12 * s);
    const bt = scene.add.text(W / 2, by + bh / 2, 'Готово', { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${20 * s}px`, color: '#ffffff' }).setOrigin(0.5);
    const zone = scene.add.zone(bx, by, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerup', () => this.close());
    c.add([btn, bt, zone]);
  }

  private card(t: TalentDef, x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    const { scene, s } = this;
    const lvl = talentLevel(t.id);
    const maxed = lvl >= t.max;
    const check = canBuy(t);
    const card = scene.add.container(x, y);
    const bg = scene.add.graphics();
    const locked = check.reason === 'сначала верхний';
    bg.fillStyle(locked ? 0xd8ccb0 : lvl > 0 ? 0xf6ecd0 : 0xece0c0, 1).fillRoundedRect(0, 0, w, h, 10 * s);
    bg.lineStyle(2.5 * s, maxed ? COLORS.gold : check.ok ? 0x2a7a3a : 0x8b6a4a, 1).strokeRoundedRect(0, 0, w, h, 10 * s);
    card.add(bg);
    const icon = scene.add.image(22 * s, 22 * s, t.icon).setDisplaySize(32 * s, 32 * s);
    if (locked) icon.setAlpha(0.4);
    card.add(icon);
    card.add(
      scene.add
        .text(42 * s, 8 * s, t.name, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${12.5 * s}px`, color: COLORS.ink, wordWrap: { width: w - 48 * s } })
        .setOrigin(0, 0),
    );
    card.add(scene.add.text(w - 8 * s, h - 8 * s, `${lvl}/${t.max}`, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${12 * s}px`, color: '#6a4a2a' }).setOrigin(1, 1));
    const next = maxed ? t.desc(lvl) : t.desc(lvl + 1);
    card.add(
      scene.add
        .text(8 * s, 44 * s, maxed ? next : `→ ${next}`, { fontFamily: FONT_UI, fontSize: `${11.5 * s}px`, color: '#4a2f1a', wordWrap: { width: w - 16 * s } })
        .setOrigin(0, 0),
    );
    // цена
    const label = maxed ? 'МАКС' : locked ? 'закрыто' : `${t.cost(lvl)}`;
    const pill = scene.add.graphics();
    const pw = 66 * s, phh = 22 * s;
    pill.fillStyle(maxed ? 0xb8861e : check.ok ? 0x2a7a3a : 0x8b6a4a, 1).fillRoundedRect(8 * s, h - phh - 6 * s, pw, phh, 8 * s);
    card.add(pill);
    if (!maxed && !locked) card.add(scene.add.image(8 * s + 12 * s, h - phh / 2 - 6 * s, 'icon-coin').setDisplaySize(16 * s, 16 * s));
    card.add(
      scene.add
        .text(8 * s + (maxed || locked ? pw / 2 : pw / 2 + 8 * s), h - phh / 2 - 6 * s, label, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${12 * s}px`, color: '#ffffff' })
        .setOrigin(0.5),
    );
    const zone = scene.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: check.ok });
    zone.on('pointerup', () => {
      if (buy(t)) {
        if (scene.cache.audio.exists('levelup')) scene.sound.play('levelup', { volume: 0.4 });
        this.build();
      } else if (scene.cache.audio.exists('click')) {
        scene.sound.play('click', { volume: 0.3 });
      }
    });
    card.add(zone);
    return card;
  }

  close(): void {
    if (!this.root.active) return;
    this.destroy();
    this.onClose();
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-ESC', this.close, this);
    this.root.destroy(true);
  }
}
