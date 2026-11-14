import Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI } from '../config';
import { getSettings, updateSettings } from '../settings';
import { LANGS, getLang, setLang, t, type Lang } from '../i18n';

/** Подписи языков — каждая на своём языке. */
const LANG_NAMES: Record<Lang, string> = { ru: 'Русский', en: 'English' };

/**
 * Окно настроек: громкость звуков, выход в меню (из забега) и титры.
 * s — масштаб интерфейса (физических пикселей на единицу макета).
 */
export class SettingsPanel {
  readonly root: Phaser.GameObjects.Container;
  private dragging: ((x: number) => void) | null = null;
  private release: (() => void) | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly s: number,
    private readonly onClose: () => void,
    /** Есть — в окне кнопка «В главное меню» (во время забега). */
    onExit?: () => void,
    /** Язык сменили — хозяин окна перерисовывает экран (и само окно). */
    onLang?: () => void,
  ) {
    const W = scene.scale.width, H = scene.scale.height;
    const c = scene.add.container(0, 0).setDepth(20000);
    this.root = c;
    c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.66).setOrigin(0).setInteractive());

    const pw = Math.min(W - 28 * s, 440 * s), ph = (onExit ? 322 : 300) * s + 52 * s;
    const px = (W - pw) / 2, py = (H - ph) / 2;
    const panel = scene.add.graphics();
    panel.fillStyle(0x000000, 0.35).fillRoundedRect(px + 3 * s, py + 5 * s, pw, ph, 16 * s);
    panel.fillStyle(COLORS.parchment, 1).fillRoundedRect(px, py, pw, ph, 16 * s);
    panel.lineStyle(3 * s, 0x8b1e1e, 1).strokeRoundedRect(px, py, pw, ph, 16 * s);
    panel.lineStyle(1.2 * s, 0x8b1e1e, 0.5).strokeRoundedRect(px + 6 * s, py + 6 * s, pw - 12 * s, ph - 12 * s, 12 * s);
    c.add(panel);
    c.add(
      scene.add
        .text(W / 2, py - 12 * s, t('set.title'), {
          fontFamily: FONT_TITLE,
          fontSize: `${34 * s}px`,
          color: COLORS.goldText,
          stroke: '#2a1405',
          strokeThickness: 7 * s,
        })
        .setOrigin(0.5, 1),
    );

    const lx = px + 26 * s, sw = pw - 52 * s;
    let y = py + 30 * s;
    this.slider(t('set.sound'), lx, y, sw, () => getSettings().sfx, (v) => updateSettings({ sfx: v }), () => {
      if (scene.cache.audio.exists('click')) scene.sound.play('click', { volume: 0.6 * getSettings().sfx });
    });
    y += 74 * s;

    // Язык: две кнопки, выбранная подсвечена
    c.add(scene.add.text(lx, y + 14 * s, t('set.lang'), this.labelStyle()).setOrigin(0, 0.5));
    const lw = 108 * s, lh = 32 * s;
    LANGS.forEach((l, i) => {
      const x = px + pw - 26 * s - (LANGS.length - i) * (lw + 8 * s) + 8 * s;
      const on = getLang() === l;
      const g = scene.add.graphics();
      g.fillStyle(on ? 0x8b1e1e : 0xe6d3a8, 1).fillRoundedRect(x, y - 2 * s, lw, lh, 9 * s);
      g.lineStyle(2 * s, on ? COLORS.gold : 0x8b6a4a, 1).strokeRoundedRect(x, y - 2 * s, lw, lh, 9 * s);
      const tl = scene.add.text(x + lw / 2, y + lh / 2 - 2 * s, LANG_NAMES[l], { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${15 * s}px`, color: on ? '#ffffff' : COLORS.ink }).setOrigin(0.5);
      const z = scene.add.zone(x, y - 2 * s, lw, lh).setOrigin(0).setInteractive({ useHandCursor: true });
      z.on('pointerup', () => {
        if (getLang() === l) return;
        setLang(l);
        onLang?.();
      });
      c.add([g, tl, z]);
    });
    y += 66 * s;

    // Кнопка «Продолжить»
    const bw = pw - 80 * s, bh = 48 * s, bx = W / 2 - bw / 2;
    const btn = scene.add.graphics();
    const drawBtn = (hover: boolean) => {
      btn.clear();
      btn.fillStyle(0x8b1e1e, 1).fillRoundedRect(bx, y, bw, bh, 12 * s);
      btn.lineStyle(2.5 * s, hover ? 0xffffff : COLORS.gold, 1).strokeRoundedRect(bx, y, bw, bh, 12 * s);
    };
    drawBtn(false);
    const btnText = scene.add
      .text(W / 2, y + bh / 2, t('set.continue'), { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${20 * s}px`, color: '#ffffff', stroke: '#1a0a04', strokeThickness: 3 * s })
      .setOrigin(0.5);
    const zone = scene.add.zone(bx, y, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBtn(true));
    zone.on('pointerout', () => drawBtn(false));
    zone.on('pointerup', () => this.close());
    c.add([btn, btnText, zone]);

    if (onExit) {
      // «В главное меню» — со второго нажатия, чтобы не бросить забег случайным тапом
      const ey = y + bh + 14 * s;
      let armed = false;
      const ebtn = scene.add.graphics();
      const drawExit = (hover: boolean) => {
        ebtn.clear();
        ebtn.fillStyle(armed ? 0x8b4a1e : 0x5a4636, 1).fillRoundedRect(bx, ey, bw, bh, 12 * s);
        ebtn.lineStyle(2.5 * s, hover ? 0xffffff : COLORS.gold, 1).strokeRoundedRect(bx, ey, bw, bh, 12 * s);
      };
      drawExit(false);
      const etext = scene.add
        .text(W / 2, ey + bh / 2, t('set.menu'), { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${18 * s}px`, color: '#ffffff', stroke: '#1a0a04', strokeThickness: 3 * s })
        .setOrigin(0.5);
      const ezone = scene.add.zone(bx, ey, bw, bh).setOrigin(0).setInteractive({ useHandCursor: true });
      ezone.on('pointerover', () => drawExit(true));
      ezone.on('pointerout', () => drawExit(false));
      ezone.on('pointerup', () => {
        if (!armed) {
          armed = true;
          etext.setText(t('set.menuConfirm'));
          drawExit(true);
          return;
        }
        onExit();
      });
      c.add([ebtn, etext, ezone]);
    }

    c.add(
      scene.add
        // авторы готовых ассетов: CC BY и OGA-BY требуют указывать имя — подробности в ASSETS.md
        .text(W / 2, py + ph - 14 * s, t('set.credits'), {
          fontFamily: FONT_UI,
          fontSize: `${10.5 * s}px`,
          lineSpacing: 1 * s,
          color: '#8a6a4a',
          align: 'center',
          wordWrap: { width: pw - 24 * s },
        })
        .setOrigin(0.5, 1),
    );

    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.input.keyboard?.on('keydown-ESC', this.close, this);
  }

  private labelStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${19 * this.s}px`, color: COLORS.ink };
  }

  private slider(label: string, x: number, y: number, w: number, get: () => number, set: (v: number) => void, onRelease?: () => void): void {
    const s = this.s, scene = this.scene;
    const pct = scene.add.text(x + w, y, '', { ...this.labelStyle(), color: '#8b1e1e' }).setOrigin(1, 0);
    this.root.add([scene.add.text(x, y, label, this.labelStyle()), pct]);
    const ty = y + 44 * s, th = 10 * s;
    const g = scene.add.graphics();
    const draw = () => {
      const v = get();
      g.clear();
      g.fillStyle(0x3b2414, 0.25).fillRoundedRect(x, ty - th / 2, w, th, th / 2);
      g.fillStyle(0x8b1e1e, 1).fillRoundedRect(x, ty - th / 2, Math.max(th, w * v), th, th / 2);
      g.fillStyle(0x000000, 0.25).fillCircle(x + w * v + 1.5 * s, ty + 2 * s, 13 * s);
      g.fillStyle(COLORS.gold, 1).fillCircle(x + w * v, ty, 13 * s);
      g.lineStyle(2.5 * s, 0x5a2a0a, 1).strokeCircle(x + w * v, ty, 13 * s);
      pct.setText(`${Math.round(v * 100)}%`);
    };
    draw();
    const apply = (px: number) => {
      set(Phaser.Math.Clamp((px - x) / w, 0, 1));
      draw();
    };
    const zone = scene.add.zone(x - 14 * s, ty - 22 * s, w + 28 * s, 44 * s).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = apply;
      this.release = onRelease ?? null;
      apply(p.x);
    });
    this.root.add([g, zone]);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.dragging && p.isDown) this.dragging(p.x);
  }

  private onUp(): void {
    if (this.dragging) this.release?.();
    this.dragging = null;
    this.release = null;
  }

  close(): void {
    if (!this.root.active) return;
    this.destroy();
    this.onClose();
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
    this.scene.input.keyboard?.off('keydown-ESC', this.close, this);
    this.root.destroy(true);
  }
}
