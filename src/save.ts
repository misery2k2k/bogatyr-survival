import { Yandex } from './yandex';

/** Прогресс между забегами: злато, таланты, рекорды. */
export interface SaveData {
  gold: number;
  talents: Record<string, number>;
  bestTime: number;
  bestKills: number;
  runs: number;
  /** Отметка времени последнего сохранения — чтобы взять более свежую копию (облако или браузер). */
  ts: number;
}

const KEY = 'bogatyr-save-v1';
const EMPTY: SaveData = { gold: 0, talents: {}, bestTime: 0, bestKills: 0, runs: 0, ts: 0 };

let data: SaveData = readLocal();
let loaded: Promise<void> | null = null;

function readLocal(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...(JSON.parse(raw) as Partial<SaveData>) };
  } catch {
    // нет localStorage — живём в памяти
  }
  return { ...EMPTY, talents: {} };
}

function normalize(x: Record<string, unknown> | null): SaveData | null {
  if (!x || typeof x !== 'object' || typeof x.gold !== 'number') return null;
  return { ...EMPTY, ...(x as Partial<SaveData>), talents: { ...((x.talents as Record<string, number>) ?? {}) } };
}

export const Save = {
  /** Подтянуть облачное сохранение Яндекса (если оно новее локального). Вызывать при старте. */
  load(): Promise<void> {
    if (loaded) return loaded;
    loaded = Yandex.loadData().then((cloud) => {
      const c = normalize(cloud);
      if (c && c.ts >= data.ts) {
        data = c;
        this.writeLocal();
      }
    });
    return loaded;
  },

  get(): SaveData {
    return data;
  },

  update(fn: (d: SaveData) => void): void {
    fn(data);
    data.ts = Date.now();
    this.writeLocal();
    void Yandex.saveData(data as unknown as Record<string, unknown>);
  },

  writeLocal(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      // не сохранилось локально — облако всё равно попробуем
    }
  },
};
