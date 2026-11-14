import Phaser from 'phaser';
import { COLORS, FONT_TITLE, FONT_UI } from '../config';
import { ITEM_BY_ID, RARITY, type ItemId } from '../items';
import { t, tx } from '../i18n';

export interface BlessOptions {
  /** Цена за злато и сколько злата у игрока. */
  cost: number;
  gold: number;
  /** Реклама недоступна — пояснение вместо кнопки рекламы (null — реклама есть). */
  adsNotice: string | null;
  /** Уже благословлён — показываем выпавший предмет. */
  item: ItemId | null;
  onAd: () => void;
  onGold: () => void;
  onClose: () => void;
}

/**
 * «Благословение» в меню: редкий предмет на старт забега — за рекламу или за злато
 * (кнопки одинаковые: CrazyGames просит не делать вариант без рекламы неприметным).
 * После благословения окно показывает, какой именно предмет выпал.
 */
export class BlessPanel {
  readonly root: Phaser.GameObjects.Container;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly s: number,
    private readonly o: BlessOptions,
  ) {
    const W = scene.scale.width, H = scene.scale.height;
    const c = scene.add.container(0, 0).setDepth(20000);
    this.root = c;
    // затемнение ловит тапы мимо окна (и закрывает его)
    const shade = scene.add.rectangle(0, 0, W, H, 0x000000, 0.66).setOrigin(0).setInteractive();
    shade.on('pointerup', () => this.close());
    c.add(shade);
    if (o.item) this.buildItem(o.item);
    else this.buildOffer();
    scene.input.keyboard?.on('keydown-ESC', this.close, this);
  }

  private panel(pw: number, ph: number, title: string, titleColor: string = COLORS.goldText): { px: number; py: number } {
    const scene = this.scene, s = this.s;
    const W = scene.scale.width, H = scene.scale.height;
    const px = (W - pw) / 2, py = (H - ph) / 2 + 16 * s;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(px + 3 * s, py + 5 * s, pw, ph, 16 * s);
    g.fillStyle(COLORS.parchment, 1).fillRoundedRect(px, py, pw, ph, 16 * s);
    g.lineStyle(3 * s, 0x5a3a7a, 1).strokeRoundedRect(px, py, pw, ph, 16 * s);
    g.lineStyle(1.2 * s, 0x5a3a7a, 0.5).strokeRoundedRect(px + 6 * s, py + 6 * s, pw - 12 * s, ph - 12 * s, 12 * s);
    // окно само по себе тапы не пропускает к затемнению
    const block = scene.add.zone(px, py, pw, ph).setOrigin(0).setInteractive();
    const head = scene.add
      .text(W / 2, py + 16 * s, title, { fontFamily: FONT_TITLE, fontSize: `${28 * s}px`, color: titleColor, stroke: '#2a1405', strokeThickness: 6 * s })
      .setOrigin(0.5, 0);
    if (head.width > pw - 96 * s) head.setScale((pw - 96 * s) / head.width);
    this.root.add([g, block, head]);
    return { px, py };
  }

  /** Предложение: реклама или злато. */
  private buildOffer(): void {
    const scene = this.scene, s = this.s, o = this.o;
    const W = scene.scale.width;
    const pw = Math.min(W - 28 * s, 420 * s);
    const bw = pw - 60 * s, bh = 50 * s;
    const ph = 344 * s;
    const { py } = this.panel(pw, ph, t('menu.bless'));
    const cx = W / 2;
    let y = py + 58 * s;
    const icon = scene.add.image(cx, y + 28 * s, 'item-feather').setDisplaySize(54 * s, 54 * s);
    y += 64 * s;
    const desc = scene.add
      .text(cx, y, t('bless.desc'), { fontFamily: FONT_UI, fontSize: `${15.5 * s}px`, color: '#4a2f1a', align: 'center', wordWrap: { width: pw - 40 * s } })
      .setOrigin(0.5, 0);
    this.root.add([icon, desc]);
    y = py + 184 * s;

    if (o.adsNotice) {
      this.root.add(
        scene.add
          .text(cx, y + bh / 2, o.adsNotice, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${13.5 * s}px`, color: '#7a5a3a', align: 'center', wordWrap: { width: bw } })
          .setOrigin(0.5),
      );
    } else {
      this.button(t('bless.ad'), cx, y, bw, bh, 0x5a3a7a, true, () => o.onAd());
    }
    y += bh + 12 * s;
    const enough = o.gold >= o.cost;
    this.button(t('bless.gold', { n: o.cost }), cx, y, bw, bh, enough ? 0x5a3a7a : 0x6b6460, enough, () => o.onGold());
    y += bh + 8 * s;
    const have = scene.add
      .text(cx, y, t('bless.have', { n: o.gold }), { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${13 * s}px`, color: enough ? '#6a4a1a' : '#a0281e' })
      .setOrigin(0.5, 0);
    this.root.add(have);
    // крестик — закрыть
    this.closeCross(W / 2 + pw / 2 - 22 * s, py + 22 * s);
  }

  /** Благословлён: какой предмет выпал. */
  private buildItem(id: ItemId): void {
    const scene = this.scene, s = this.s;
    const W = scene.scale.width;
    const def = ITEM_BY_ID.get(id)!;
    const rar = RARITY[def.rarity];
    const pw = Math.min(W - 28 * s, 380 * s), ph = 404 * s;
    const { px, py } = this.panel(pw, ph, t('bless.got'));
    const cx = W / 2;
    // рамка цвета редкости
    const frame = scene.add.graphics();
    frame.lineStyle(4 * s, rar.color, 1).strokeRoundedRect(px + 10 * s, py + 10 * s, pw - 20 * s, ph - 20 * s, 12 * s);
    const glow = scene.add.image(cx, py + 136 * s, 'circle_05').setBlendMode(Phaser.BlendModes.ADD).setTint(rar.color).setAlpha(0.55).setScale((150 * s) / 512);
    scene.tweens.add({ targets: glow, alpha: 0.25, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const rarText = scene.add
      .text(cx, py + 58 * s, tx(rar.name), { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${17 * s}px`, color: rar.text, stroke: '#2a1405', strokeThickness: 4 * s })
      .setOrigin(0.5, 0);
    const ring = scene.add.graphics();
    ring.fillStyle(rar.color, 0.18).fillCircle(cx, py + 136 * s, 46 * s);
    ring.lineStyle(2 * s, rar.color, 0.7).strokeCircle(cx, py + 136 * s, 46 * s);
    const icon = scene.add.image(cx, py + 136 * s, `item-${id}`).setDisplaySize(78 * s, 78 * s);
    const name = scene.add
      .text(cx, py + 192 * s, tx(def.name), { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${23 * s}px`, color: COLORS.ink, align: 'center', wordWrap: { width: pw - 30 * s } })
      .setOrigin(0.5, 0);
    const desc = scene.add
      .text(cx, name.y + name.height + 8 * s, tx(def.desc), { fontFamily: FONT_UI, fontSize: `${16 * s}px`, color: '#4a2f1a', align: 'center', wordWrap: { width: pw - 36 * s } })
      .setOrigin(0.5, 0);
    const sub = scene.add
      .text(cx, py + ph - 84 * s, t('bless.gotSub'), { fontFamily: FONT_UI, fontSize: `${13 * s}px`, color: '#7a5a3a', align: 'center', wordWrap: { width: pw - 30 * s } })
      .setOrigin(0.5, 1);
    this.root.add([glow, frame, rarText, ring, icon, name, desc, sub]);
    this.button(t('bless.ok'), cx, py + ph - 70 * s, pw - 90 * s, 46 * s, 0x8b1e1e, true, () => this.close());
  }

  private button(label: string, cx: number, y: number, w: number, h: number, color: number, enabled: boolean, onTap: () => void): void {
    const scene = this.scene, s = this.s;
    const g = scene.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(0x000000, 0.3).fillRoundedRect(cx - w / 2 + 2 * s, y + 4 * s, w, h, 12 * s);
      g.fillStyle(color, 1).fillRoundedRect(cx - w / 2, y, w, h, 12 * s);
      g.lineStyle(2.5 * s, hover ? 0xffffff : enabled ? COLORS.gold : 0x9a948c, 1).strokeRoundedRect(cx - w / 2, y, w, h, 12 * s);
    };
    draw(false);
    const txt = scene.add
      .text(cx, y + h / 2, label, { fontFamily: FONT_UI, fontStyle: 'bold', fontSize: `${19 * s}px`, color: enabled ? '#ffffff' : '#d8d2ca', stroke: '#1a0a04', strokeThickness: 3 * s })
      .setOrigin(0.5);
    if (txt.width > w - 16 * s) txt.setScale((w - 16 * s) / txt.width);
    this.root.add([g, txt]);
    if (!enabled) return;
    const z = scene.add.zone(cx - w / 2, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    z.on('pointerover', () => draw(true));
    z.on('pointerout', () => draw(false));
    z.on('pointerup', () => onTap());
    this.root.add(z);
  }

  private closeCross(x: number, y: number): void {
    const scene = this.scene, s = this.s;
    const g = scene.add.graphics();
    g.fillStyle(0x8b1e1e, 1).fillCircle(x, y, 15 * s);
    g.lineStyle(2 * s, COLORS.gold, 1).strokeCircle(x, y, 15 * s);
    g.lineStyle(3 * s, 0xffffff, 1);
    g.lineBetween(x - 6 * s, y - 6 * s, x + 6 * s, y + 6 * s).lineBetween(x - 6 * s, y + 6 * s, x + 6 * s, y - 6 * s);
    const z = scene.add.zone(x, y, 40 * s, 40 * s).setInteractive({ useHandCursor: true });
    z.on('pointerup', () => this.close());
    this.root.add([g, z]);
  }

  close(): void {
    if (!this.root.active) return;
    this.destroy();
    this.o.onClose();
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-ESC', this.close, this);
    this.scene.tweens.killTweensOf(this.root.list);
    this.root.destroy(true);
  }
}
