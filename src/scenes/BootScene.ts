import Phaser from 'phaser';
import { HERO_SCALE, VIEW_AREA_SQRT } from '../config';
import { DRAGON, DRAGON_PARTS, dragonTex } from '../entities/Dragon';
import { HERO_PARTS, HERO_UNITS_TALL, heroTex, tugarinTex } from '../entities/HeroRig';
import { TUGARIN } from '../entities/Tugarin';
import { readZombieOrigins } from '../entities/Zombie';
import { sfxLoadList } from '../sfx';
import { makeTextures } from '../textures';

const FX = ['slash_03', 'star_04', 'smoke_04', 'light_01', 'twirl_02', 'scorch_02', 'circle_05'];



async function waitFonts(timeoutMs: number): Promise<void> {
  if (!document.fonts) return;
  const load = Promise.all([
    document.fonts.load('32px "Ruslan Display"'),
    document.fonts.load('16px "Philosopher"'),
    document.fonts.load('bold 16px "Philosopher"'),
  ]);
  await Promise.race([load, new Promise((r) => setTimeout(r, timeoutMs))]);
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const W = this.scale.width, H = this.scale.height;
    const bw = Math.min(W * 0.6, 600), bh = Math.max(8, H * 0.012);
    const bar = this.add.graphics();
    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0x000000, 0.5).fillRect((W - bw) / 2, H / 2 - bh / 2, bw, bh);
      bar.fillStyle(0xf2c14e, 1).fillRect((W - bw) / 2, H / 2 - bh / 2, bw * v, bh);
    });

    // Разрешение векторного богатыря: под текущий экран (игра и крупный герой в меню)
    const zoom = Math.sqrt(W * H) / VIEW_AREA_SQRT;
    const inGame = HERO_SCALE * zoom * 1.15;
    const inMenu = (Math.min(H, W * 1.3) * 0.34) / HERO_UNITS_TALL;
    heroTex.res = Phaser.Math.Clamp(Math.max(inGame, inMenu), 0.8, 2.6);
    dragonTex.res = Phaser.Math.Clamp(DRAGON.scale * 1.22 * zoom * 1.1, 0.7, 2.4);
    tugarinTex.res = Phaser.Math.Clamp(TUGARIN.scale * zoom * 1.1, 0.7, 2.2);

    this.load.setPath('assets/');
    this.load.atlas('zombies', 'sprites/zombies.png', 'sprites/zombies.json');
    for (const part of Object.keys(HERO_PARTS)) this.load.svg(`hsrc-${part}`, `hero/${part}.svg`, { scale: heroTex.res });
    for (const part of Object.keys(DRAGON_PARTS)) this.load.svg(`dsrc-${part}`, `dragon/${part}.svg`, { scale: dragonTex.res });
    for (const part of Object.keys(HERO_PARTS)) this.load.svg(`tsrc-${part}`, `tugarin/${part}.svg`, { scale: tugarinTex.res });
    for (const f of FX) this.load.image(f, `fx/${f}.png`);
    for (const [key, file] of sfxLoadList()) {
      if (!this.cache.audio.exists(key)) this.load.audio(key, `audio/${file}`);
    }
  }

  create(): void {
    makeTextures(this);
    this.packParts('hero', 'hsrc-', Object.keys(HERO_PARTS));
    this.packParts('dragon', 'dsrc-', Object.keys(DRAGON_PARTS));
    this.packParts('tugarin', 'tsrc-', Object.keys(HERO_PARTS));
    readZombieOrigins(this);
    this.makeAnims();
    void waitFonts(3000).then(() => this.scene.start('Menu'));
  }

  /** Склеиваем детали (SVG) в одну текстуру со сторонами-степенями двойки (ради мипмапов). */
  private packParts(key: string, prefix: string, names: string[]): void {
    const parts = names.map((p) => {
      const img = this.textures.get(`${prefix}${p}`).getSourceImage() as HTMLImageElement;
      return { p, img, w: img.width, h: img.height };
    });
    parts.sort((a, b) => b.h - a.h);
    const pad = 2;
    let W = 256;
    let layout: { x: number; y: number }[] = [];
    let H = 0;
    for (;;) {
      layout = [];
      let x = pad, y = pad, row = 0;
      for (const it of parts) {
        if (x + it.w + pad > W) {
          x = pad;
          y += row + pad;
          row = 0;
        }
        layout.push({ x, y });
        x += it.w + pad;
        row = Math.max(row, it.h);
      }
      H = y + row + pad;
      if (H <= W) break;
      W *= 2;
    }
    H = Phaser.Math.Pow2.GetPowerOfTwo(H);
    const tex = this.textures.createCanvas(key, W, H)!;
    const ctx = tex.getContext();
    parts.forEach((it, i) => {
      ctx.drawImage(it.img, layout[i].x, layout[i].y);
      tex.add(it.p, 0, layout[i].x, layout[i].y, it.w, it.h);
    });
    tex.refresh();
    for (const it of parts) this.textures.remove(`${prefix}${it.p}`);
  }

  private makeAnims(): void {
    const a = this.anims;
    for (const v of ['m', 'f']) {
      a.create({
        key: `${v}-walk`,
        frames: a.generateFrameNames('zombies', { prefix: `${v}-walk`, start: 0, end: 9 }),
        frameRate: 12,
        repeat: -1,
      });
      a.create({
        key: `${v}-attack`,
        frames: a.generateFrameNames('zombies', { prefix: `${v}-attack`, start: 0, end: 7 }),
        frameRate: 12,
        repeat: -1,
      });
      a.create({
        key: `${v}-dead`,
        frames: a.generateFrameNames('zombies', { prefix: `${v}-dead`, start: 0, end: 11 }),
        frameRate: 20,
      });
    }
  }
}
