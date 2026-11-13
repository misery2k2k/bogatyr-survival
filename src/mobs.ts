import Phaser from 'phaser';
import { MOB_SPRITES } from './gen/assets';

/** Скорость анимаций (кадров в секунду) по имени; зацикленные — ходьба, атака вплотную, ожидание. */
const RATE: Record<string, number> = { walk: 12, attack: 14, dead: 16, idle: 10, hurt: 14, slam: 14, jump: 16, cast: 14 };
const LOOP = new Set(['walk', 'attack', 'idle']);

/** Ассет глав, который грузится фоном: атлас нечисти, атлас декора или текстура земли. */
interface LazyAsset {
  key: string;
  type: 'multiatlas' | 'atlas' | 'image';
  url: string;
  path?: string;
}

const ASSETS: Record<string, LazyAsset> = {
  decor: { key: 'decor', type: 'atlas', url: 'assets/decor/decor.json' },
};
for (const id of new Set(Object.values(MOB_SPRITES).map((m) => m.atlas))) {
  ASSETS[id] = { key: id, type: 'multiatlas', url: `assets/mobs/${id}.json`, path: 'assets/mobs/' };
}
for (const g of ['cursed', 'scorched', 'frozen', 'hell', 'hell2']) {
  ASSETS[`ground-${g}`] = { key: `ground-${g}`, type: 'image', url: `assets/ground/${g}.png` };
}

/** Что сейчас грузится (повторно в очередь не ставим — иначе «Texture key already in use»). */
const pending = new Set<string>();
const pendingHooked = new WeakSet<Phaser.Scene>();

export function mobOrigin(id: string): [number, number] | undefined {
  return MOB_SPRITES[id]?.origin;
}

export function mobFigure(id: string): number {
  return MOB_SPRITES[id]?.figure ?? 150;
}

export function mobAtlas(id: string): string | undefined {
  return MOB_SPRITES[id]?.atlas;
}

/** Анимации всех спрайтов атласа (после его загрузки). */
function createAnims(scene: Phaser.Scene, atlas: string): void {
  for (const [id, m] of Object.entries(MOB_SPRITES)) {
    if (m.atlas !== atlas) continue;
    for (const [anim, n] of Object.entries(m.anims)) {
      const key = `${id}-${anim}`;
      if (scene.anims.exists(key)) scene.anims.remove(key);
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNames(atlas, { prefix: `${id}-${anim}`, start: 0, end: n - 1 }),
        frameRate: RATE[anim] ?? 12,
        repeat: LOOP.has(anim) ? -1 : 0,
      });
    }
  }
}

function removeAnims(scene: Phaser.Scene, atlas: string): void {
  for (const [id, m] of Object.entries(MOB_SPRITES)) {
    if (m.atlas !== atlas) continue;
    for (const anim of Object.keys(m.anims)) if (scene.anims.exists(`${id}-${anim}`)) scene.anims.remove(`${id}-${anim}`);
  }
}

/**
 * Ассеты глав грузятся фоном (первая глава в них почти не нуждается) и выгружаются, когда глава позади, —
 * чтобы на слабых телефонах в видеопамяти не лежали все шесть глав сразу.
 */
export const LazyAssets = {
  isReady(scene: Phaser.Scene, key: string): boolean {
    return scene.textures.exists(key);
  },

  allReady(scene: Phaser.Scene, keys: string[]): boolean {
    return keys.every((k) => scene.textures.exists(k));
  },

  /** Поставить в очередь фоновой загрузки (что уже есть или уже грузится — пропускается). onReady — когда всё из списка готово. */
  ensure(scene: Phaser.Scene, keys: string[], onReady?: () => void): void {
    const missing = keys.filter((k) => ASSETS[k] && !scene.textures.exists(k));
    if (missing.length === 0) {
      onReady?.();
      return;
    }
    const load = scene.load;
    if (!pendingHooked.has(scene)) {
      // сцена перезапустилась — загрузчик сброшен, всё недогруженное придётся просить заново
      pendingHooked.add(scene);
      scene.events.on(Phaser.Scenes.Events.SHUTDOWN, () => pending.clear());
    }
    let added = false;
    for (const k of missing) {
      if (pending.has(k)) continue;
      pending.add(k);
      added = true;
      const a = ASSETS[k];
      if (a.type === 'multiatlas') {
        load.multiatlas(a.key, a.url, a.path);
        load.once(`filecomplete-multiatlas-${a.key}`, () => createAnims(scene, a.key));
      } else if (a.type === 'atlas') {
        load.atlas(a.key, a.url.replace('.json', '.png'), a.url);
      } else {
        load.image(a.key, a.url);
      }
    }
    // очередь опустела — что не загрузилось, можно будет попросить снова
    if (added) load.once(Phaser.Loader.Events.COMPLETE, () => pending.clear());
    if (onReady) {
      const check = () => {
        if (this.allReady(scene, keys)) onReady();
        else load.once(Phaser.Loader.Events.COMPLETE, check);
      };
      load.once(Phaser.Loader.Events.COMPLETE, check);
    }
    if (!load.isLoading()) load.start();
  },

  /** Выгрузить атласы нечисти, кроме нужных (декор и земля лёгкие — их не трогаем). */
  release(scene: Phaser.Scene, keep: string[]): void {
    for (const a of Object.values(ASSETS)) {
      if (a.type !== 'multiatlas' || keep.includes(a.key) || !scene.textures.exists(a.key)) continue;
      // анимации, если атлас ещё грузится, создадутся заново при следующей загрузке
      removeAnims(scene, a.key);
      scene.textures.remove(a.key);
    }
  },
};
