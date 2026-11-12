// Общие константы и баланс.

/** Плотность пикселей (ограничиваем 2, чтобы не убивать слабые телефоны). */
export const DPR = Math.min(window.devicePixelRatio || 1, 2);

/** sqrt(площади видимого мира) в мировых пикселях — одинаковый «обзор» на телефоне и ПК. */
export const VIEW_AREA_SQRT = 820;

export const FONT_TITLE = '"Ruslan Display", "Philosopher", Georgia, serif';
export const FONT_UI = '"Philosopher", Arial, sans-serif';

export const COLORS = {
  gold: 0xf2c14e,
  goldText: '#f2c14e',
  red: 0xc0392b,
  parchment: 0xf1e2c0,
  parchmentDark: 0xd9c08f,
  ink: '#3b2414',
  inkHex: 0x3b2414,
  xp: 0x4fc3ff,
  hp: 0xd63a2f,
  heal: '#7dff8a',
  dmg: '#ffffff',
  dmgBig: '#ffd34d',
  crit: '#ff9a1f',
};

export const PLAYER_BASE = {
  maxHp: 150,
  speed: 150,
  /** Радиус, с которого пирожки притягиваются к богатырю. */
  pickupRadius: 85,
  hitRadius: 20,
};

/** Единицы SVG богатыря → пиксели мира. Рост ≈ 262 × 0.41 ≈ 107 px (мертвяк ≈ 70 px). */
export const HERO_SCALE = 0.41;

/** Множитель разрешения процедурных текстур: рисуем вдвое крупнее, чтобы при зуме не мылились. */
export const TEX_RES = 2;

/** Сколько опыта нужно, чтобы перейти с уровня lvl на lvl+1. */
export function xpForLevel(lvl: number): number {
  return Math.round(5 + lvl * 3.2 + lvl * lvl * 0.32);
}

export interface ZombieType {
  key: 'walker' | 'runner' | 'brute';
  name: string;
  /** Спрайт из атласа zombies: m — мертвяк-мужик, f — кикимора. */
  sprite: 'm' | 'f';
  hp: number;
  speed: number;
  damage: number;
  /** Опыт за убийство (начисляется сразу). */
  xp: number;
  scale: number;
  tint: number;
  radius: number;
  animRate: number;
  knockbackResist: number;
}

export const ZOMBIES: Record<ZombieType['key'], ZombieType> = {
  walker: {
    key: 'walker', name: 'Мертвяк', sprite: 'm',
    hp: 14, speed: 56, damage: 6, xp: 1, scale: 0.45, tint: 0xffffff, radius: 15, animRate: 1, knockbackResist: 0,
  },
  runner: {
    key: 'runner', name: 'Кикимора', sprite: 'f',
    hp: 9, speed: 100, damage: 5, xp: 1, scale: 0.37, tint: 0xffffff, radius: 13, animRate: 1.6, knockbackResist: 0,
  },
  brute: {
    key: 'brute', name: 'Кощеев ратник', sprite: 'm',
    hp: 55, speed: 42, damage: 14, xp: 6, scale: 0.64, tint: 0xa898ff, radius: 25, animRate: 0.7, knockbackResist: 0.7,
  },
};

export const MAX_ZOMBIES = 140;
