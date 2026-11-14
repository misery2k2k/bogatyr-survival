// Общие константы и баланс.
import { MOB_SPRITES } from './gen/assets';
import { T, type Text } from './i18n';

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

/** Поведение: ближний бой, стрелок (держит дистанцию и стреляет), прыгун (подкрадывается и прыгает). */
export type EnemyAI = 'melee' | 'archer' | 'leaper';

export interface ZombieType {
  key: string;
  name: Text;
  /** Атлас и префикс анимаций в нём: `${anim}-walk`, `${anim}-attack`, `${anim}-dead`. */
  tex: string;
  anim: string;
  /** Высота фигуры в пикселях атласа (для цифр урона и эффектов). */
  figure: number;
  ai?: EnemyAI;
  /** Стрелок: желаемая дистанция, перезарядка, урон и скорость снаряда, текстура снаряда. */
  range?: number;
  shotCd?: number;
  shotDmg?: number;
  shotSpeed?: number;
  shot?: string;
  /** Цвет снаряда (колдовской шар и т.п.). */
  shotTint?: number;
  /** Прыгун: с какой дистанции прыгает, перезарядка, скорость прыжка. */
  leapRange?: number;
  leapCd?: number;
  leapSpeed?: number;
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
  /** Здоровяк: здоровье растёт со временем медленнее, ходит в ордах «через одного». */
  heavy?: boolean;
  /** «Лютый» (усиленный) — с красным кругом под ногами. */
  elite?: boolean;
}

type MobStats = Omit<ZombieType, 'key' | 'tex' | 'anim' | 'figure' | 'scale' | 'tint'> & { tint?: number };

/** Нечисть на готовом спрайте из атласов глав: рост h в мире (px). */
function mob(key: string, id: string, h: number, t: MobStats): ZombieType {
  const m = MOB_SPRITES[id];
  return { key, tex: m.atlas, anim: id, figure: m.figure, scale: h / m.figure, tint: 0xffffff, ...t };
}

export const ZOMBIES: Record<string, ZombieType> = {
  walker: {
    key: 'walker', name: T('Мертвяк', 'Walker'), tex: 'zombies', anim: 'm', figure: 155,
    hp: 14, speed: 56, damage: 6, xp: 1, scale: 0.45, tint: 0xffffff, radius: 15, animRate: 1, knockbackResist: 0,
  },
  runner: {
    key: 'runner', name: T('Кикимора', 'Kikimora'), tex: 'zombies', anim: 'f', figure: 165,
    hp: 9, speed: 100, damage: 5, xp: 1, scale: 0.37, tint: 0xffffff, radius: 13, animRate: 1.6, knockbackResist: 0,
  },
  brute: {
    key: 'brute', name: T('Кощеев ратник', 'Koschei\'s Warrior'), tex: 'zombies', anim: 'm', figure: 155, heavy: true,
    hp: 55, speed: 42, damage: 14, xp: 6, scale: 0.64, tint: 0xa898ff, radius: 25, animRate: 0.7, knockbackResist: 0.7,
  },
  charbrute: {
    key: 'charbrute', name: T('Обгорелый ратник', 'Charred Warrior'), tex: 'zombies', anim: 'm', figure: 155, heavy: true,
    hp: 60, speed: 44, damage: 15, xp: 6, scale: 0.64, tint: 0x9a7262, radius: 25, animRate: 0.7, knockbackResist: 0.7,
  },
  frostwalker: {
    key: 'frostwalker', name: T('Мёрзлый мертвяк', 'Frozen Walker'), tex: 'zombies', anim: 'm', figure: 155,
    hp: 16, speed: 52, damage: 7, xp: 1, scale: 0.45, tint: 0xa8c8ff, radius: 15, animRate: 0.9, knockbackResist: 0.05,
  },
  frostbrute: {
    key: 'frostbrute', name: T('Ледяной ратник', 'Ice Warrior'), tex: 'zombies', anim: 'm', figure: 155, heavy: true,
    hp: 60, speed: 40, damage: 15, xp: 6, scale: 0.66, tint: 0x86a6ec, radius: 25, animRate: 0.65, knockbackResist: 0.75,
  },

  // ---- готовые спрайты (атласы глав грузятся фоном, см. src/mobs.ts) ----
  wolf: mob('wolf', 'wolf', 50, {
    name: T('Серый волк', 'Grey Wolf'), ai: 'leaper', leapRange: 230, leapCd: 3.4, leapSpeed: 620,
    hp: 12, speed: 98, damage: 6, xp: 1, radius: 17, animRate: 1.1, knockbackResist: 0.1,
  }),
  snowwolf: mob('snowwolf', 'wolf', 52, {
    name: T('Снежный волк', 'Snow Wolf'), ai: 'leaper', leapRange: 240, leapCd: 3.0, leapSpeed: 640, tint: 0xdde9ff,
    hp: 14, speed: 104, damage: 7, xp: 1, radius: 17, animRate: 1.15, knockbackResist: 0.1,
  }),
  upyr: mob('upyr', 'upyr', 64, { name: T('Упырь', 'Upyr'), hp: 13, speed: 92, damage: 7, xp: 1, radius: 14, animRate: 1.3, knockbackResist: 0 }),
  skel: mob('skel', 'skel', 80, { name: T('Костяной ратник', 'Bone Warrior'), hp: 24, speed: 50, damage: 9, xp: 2, radius: 16, animRate: 0.9, knockbackResist: 0.3 }),
  archer: mob('archer', 'archer', 80, {
    name: T('Костяной лучник', 'Bone Archer'), ai: 'archer', range: 280, shotCd: 2.8, shotSpeed: 380, shot: 'arrow',
    hp: 12, speed: 50, damage: 8, xp: 2, radius: 15, animRate: 1, knockbackResist: 0.1,
  }),
  razboinik: mob('razboinik', 'razboinik', 68, { name: T('Разбойник', 'Bandit'), hp: 18, speed: 72, damage: 8, xp: 1, radius: 16, animRate: 1.1, knockbackResist: 0.1 }),
  treant: mob('treant', 'treant', 120, { name: T('Древень', 'Treant'), heavy: true, hp: 60, speed: 36, damage: 14, xp: 5, radius: 26, animRate: 0.8, knockbackResist: 0.85 }),
  mage: mob('mage', 'mage', 92, {
    name: T('Чернокнижник', 'Warlock'), ai: 'archer', range: 300, shotCd: 3.2, shotSpeed: 290, shot: 'orb', shotTint: 0xb06aff,
    hp: 16, speed: 44, damage: 9, xp: 2, radius: 15, animRate: 1, knockbackResist: 0.1,
  }),
  navka: mob('navka', 'ghost', 48, { name: T('Навка', 'Navka'), tint: 0xcfe6ff, hp: 9, speed: 108, damage: 5, xp: 1, radius: 13, animRate: 1.2, knockbackResist: 0 }),
  dusha: mob('dusha', 'ghost', 48, { name: T('Грешная душа', 'Sinful Soul'), tint: 0xffb48c, hp: 11, speed: 112, damage: 6, xp: 1, radius: 13, animRate: 1.2, knockbackResist: 0 }),
  strazh: mob('strazh', 'strazh', 72, { name: T('Навий страж', 'Nav Guard'), tint: 0xe2eeff, hp: 24, speed: 60, damage: 9, xp: 2, radius: 16, animRate: 1, knockbackResist: 0.3 }),
  imp: mob('imp', 'imp', 62, { name: T('Бес', 'Imp'), hp: 14, speed: 84, damage: 7, xp: 1, radius: 15, animRate: 1.1, knockbackResist: 0.1 }),
  chortik: mob('chortik', 'chortik', 60, {
    name: T('Чертёнок', 'Little Devil'), ai: 'leaper', leapRange: 210, leapCd: 3.0, leapSpeed: 600,
    hp: 10, speed: 96, damage: 6, xp: 1, radius: 14, animRate: 1.2, knockbackResist: 0,
  }),
  rogach: mob('rogach', 'rogach', 92, { name: T('Рогач', 'Horned Brute'), heavy: true, hp: 60, speed: 44, damage: 15, xp: 6, radius: 24, animRate: 0.8, knockbackResist: 0.7 }),

  // ---- стрелки поздних глав: бьют издалека, оружием их не достать — богатырю не отсидеться в «мясорубке» ----
  icearcher: mob('icearcher', 'archer', 80, {
    name: T('Ледяной лучник', 'Ice Archer'), ai: 'archer', range: 290, shotCd: 2.7, shotSpeed: 360, shot: 'shard', shotTint: 0xcff0ff, tint: 0xc8dcff,
    hp: 14, speed: 50, damage: 9, xp: 2, radius: 15, animRate: 1, knockbackResist: 0.1,
  }),
  ogon: mob('ogon', 'ghost', 46, {
    name: T('Блуждающий огонь', 'Will-o\'-the-Wisp'), ai: 'archer', range: 300, shotCd: 2.6, shotSpeed: 300, shot: 'orb', shotTint: 0xff7a2a, tint: 0xffa070,
    hp: 10, speed: 76, damage: 9, xp: 2, radius: 13, animRate: 1.2, knockbackResist: 0,
  }),
  navi: mob('navi', 'ghost', 46, {
    name: T('Навий огонёк', 'Nav Wisp'), ai: 'archer', range: 300, shotCd: 2.5, shotSpeed: 290, shot: 'orb', shotTint: 0xb06aff, tint: 0xc8a0ff,
    hp: 11, speed: 76, damage: 10, xp: 2, radius: 13, animRate: 1.2, knockbackResist: 0,
  }),
};

export const MAX_ZOMBIES = 140;
