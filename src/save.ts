import { Platform } from './platform';
import { readLocal } from './storage';

/** Прогресс между забегами: злато, таланты, рекорды. */
export interface SaveData {
  gold: number;
  talents: Record<string, number>;
  bestTime: number;
  bestKills: number;
  runs: number;
  /** Самая дальняя глава, до которой дошёл (индекс в BIOMES) — с неё и раньше можно начинать забег. */
  maxChapter: number;
  /** С какой главы начинать следующий забег (выбор в меню). */
  startChapter: number;
  /** Сколько раз показывали подсказку про пирожки (новичкам — первые несколько забегов). */
  pieTips: number;
  /** Сколько раз одолел Чернобога. */
  wins: number;
  /** День, когда последний раз забирал «Подарок дня» (ГГГГ-ММ-ДД). */
  giftDay: string;
  /** Отметка времени последнего сохранения — чтобы взять более свежую копию (облако или браузер). */
  ts: number;
}

const KEY = 'bogatyr-save-v1';
const EMPTY: SaveData = { gold: 0, talents: {}, bestTime: 0, bestKills: 0, runs: 0, maxChapter: 0, startChapter: 0, pieTips: 0, wins: 0, giftDay: '', ts: 0 };

function normalize(x: Record<string, unknown> | null): SaveData | null {
  if (!x || typeof x !== 'object' || typeof x.gold !== 'number') return null;
  return { ...EMPTY, ...(x as Partial<SaveData>), talents: { ...((x.talents as Record<string, number>) ?? {}) } };
}

// до ответа площадки — то, что лежит в браузере (у Яндекса это обычная копия; у CrazyGames там обычно пусто)
let data: SaveData = normalize(readLocal(KEY)) ?? { ...EMPTY, talents: {} };
let loaded: Promise<void> | null = null;

export const Save = {
  /** Подтянуть сохранение площадки (облако Яндекса / модуль данных CrazyGames), если оно не старше нашего. */
  load(): Promise<void> {
    loaded ??= Platform.loadSave(KEY).then((remote) => {
      const c = normalize(remote);
      if (c && c.ts >= data.ts) data = c;
    });
    return loaded;
  },

  get(): SaveData {
    return data;
  },

  update(fn: (d: SaveData) => void): void {
    fn(data);
    data.ts = Date.now();
    Platform.writeSave(KEY, data);
  },
};
