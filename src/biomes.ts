import { TEX_RES } from './config';
import { DECOR_RES } from './gen/assets';
import type { BossKind } from './bosses';
import { T, type Text } from './i18n';
import { FOREST_DECOR, type DecorKind } from './systems/Decor';

export type { BossKind };

/** Глава = локация со своей землёй, декором, настроением, нечистью и боссами. */
export interface BiomeDef {
  id: 'forest' | 'cursed' | 'scorched' | 'frozen' | 'hell' | 'hell2';
  /** Заголовок при входе. */
  title: Text;
  /** Текстура земли (бесшовная), её оттенок и масштаб (мировых px на пиксель текстуры). */
  ground: string;
  groundTint: number;
  groundScale: number;
  /** Цвет фона камеры (виден на краях при ресайзе). */
  bg: string;
  decor: DecorKind[];
  /** Цвет «настроения» поверх мира (умножение), 0xffffff — без него. */
  mood: number;
  /** Частицы в воздухе. */
  particles: 'none' | 'motes' | 'ash' | 'embers' | 'snow' | 'souls';
  /** Нечисть: ключ из ZOMBIES, вес, с какой секунды главы появляется. */
  enemies: { key: string; weight: number; from?: number }[];
  /** Орда: основная нечисть и здоровяк (каждый десятый). */
  horde: [string, string];
  /** Боссы по очереди; после последнего — следующая глава. */
  bosses: BossKind[];
  /** Ассеты, которые нужны главе (грузятся фоном заранее, см. src/mobs.ts). */
  assets: string[];
}

/** Готовый объект из атласа декора. */
function atl(frame: string, min: number, max: number, flat: boolean, scale: [number, number], o: { tint?: number; chance?: number } = {}): DecorKind {
  return { key: 'decor', frame, res: DECOR_RES[frame] ?? 1, min, max, flat, scale, ...o };
}

const CURSED_DECOR: DecorKind[] = [
  { key: 'tuft', tint: 0x8a7cb0, min: 4, max: 7, flat: true, scale: [0.8, 1.2] },
  atl('c-tree', 0, 2, false, [0.85, 1.15]),
  atl('c-deadbush', 1, 3, false, [0.8, 1.2]),
  atl('c-bones', 0, 2, true, [0.8, 1.1]),
  atl('c-tomb', 0, 2, false, [0.9, 1.1]),
  atl('c-cross', 0, 2, false, [0.9, 1.1]),
  atl('c-bush', 0, 2, false, [0.8, 1.1], { tint: 0x9a86c8 }),
  atl('c-bush2', 0, 1, false, [0.8, 1.1], { tint: 0x9a86c8 }),
  atl('c-shroom', 0, 2, false, [0.8, 1.2], { tint: 0xc0a0ff }),
  atl('c-shroom2', 0, 1, false, [0.8, 1.2], { tint: 0xb090ff }),
  { key: 'stone', tint: 0x9a90b8, min: 0, max: 2, flat: false, scale: [0.7, 1.2] },
  { key: 'fir', tint: 0x5a4e78, min: 0, max: 1, flat: false, scale: [0.8, 1.1] },
];

const SCORCHED_DECOR: DecorKind[] = [
  { key: 'tuft', tint: 0xa08a60, min: 3, max: 6, flat: true, scale: [0.8, 1.2] },
  atl('s-tree', 0, 1, false, [0.85, 1.1], { chance: 0.5 }),
  atl('s-tree2', 0, 1, false, [0.85, 1.1], { chance: 0.5 }),
  atl('s-tree3', 0, 1, false, [0.85, 1.15]),
  atl('s-ctree', 0, 2, false, [0.85, 1.15]),
  atl('s-bramble', 1, 2, false, [0.8, 1.2]),
  atl('s-bramble2', 0, 2, false, [0.8, 1.2]),
  atl('s-rock', 0, 1, false, [0.8, 1.15]),
  atl('s-rock2', 0, 1, false, [0.8, 1.15]),
  atl('s-tumble', 0, 2, false, [0.8, 1.2]),
  atl('s-skull', 0, 1, false, [0.8, 1.1]),
  atl('s-burnt', 0, 2, false, [0.8, 1.2]),
  atl('s-burnt2', 0, 1, false, [0.8, 1.2]),
  atl('s-bones', 0, 1, true, [0.8, 1.1]),
  { key: 'stump', tint: 0x4a3a32, min: 0, max: 1, flat: false, scale: [0.9, 1.1] },
  { key: 'log', tint: 0x4a3a32, min: 0, max: 1, flat: false, scale: [0.8, 1.1] },
];

const FROZEN_DECOR: DecorKind[] = [
  atl('f-tree', 0, 2, false, [0.85, 1.15]),
  atl('f-tree2', 0, 1, false, [0.85, 1.15]),
  atl('f-ctree', 0, 1, false, [0.85, 1.15]),
  atl('f-bramble', 0, 2, false, [0.8, 1.2]),
  atl('f-rock', 0, 2, false, [0.8, 1.2]),
  atl('f-bush', 1, 2, false, [0.8, 1.2]),
  atl('f-bones', 0, 1, true, [0.8, 1.1]),
  atl('f-crystal', 0, 2, false, [0.8, 1.3]),
  atl('f-crystal2', 0, 1, false, [0.8, 1.2], { tint: 0xd0c8ff }),
  { key: 'stone', tint: 0xc8d8f0, min: 0, max: 2, flat: false, scale: [0.7, 1.2] },
];

const HELL_DECOR: DecorKind[] = [
  atl('h-lava', 0, 1, true, [0.8, 1.25], { chance: 0.6 }),
  atl('h-lava2', 0, 1, true, [0.8, 1.25], { chance: 0.6 }),
  atl('h-glow', 0, 1, false, [0.8, 1.15]),
  atl('h-volcano', 0, 1, false, [0.8, 1.2], { chance: 0.5 }),
  atl('h-flame', 0, 2, false, [0.8, 1.2]),
  atl('h-flame2', 0, 1, false, [0.8, 1.2]),
  atl('h-rock', 0, 2, false, [0.8, 1.2], { tint: 0xc08070 }),
  atl('h-rock2', 0, 2, false, [0.8, 1.2], { tint: 0xb07060 }),
  atl('h-spikes', 0, 1, false, [0.9, 1.2], { tint: 0x8a3a2a }),
  atl('s-skull', 0, 1, false, [0.8, 1.1]),
  atl('s-bones', 0, 1, true, [0.8, 1.1], { tint: 0xd09080 }),
  atl('c-bones', 0, 1, true, [0.8, 1.1], { tint: 0xd09080 }),
  atl('s-ctree', 0, 1, false, [0.85, 1.1], { tint: 0x6a3a30 }),
];

const HELL2_DECOR: DecorKind[] = [
  atl('h-lava', 0, 1, true, [0.9, 1.3], { chance: 0.7 }),
  atl('h-lava2', 0, 1, true, [0.9, 1.3], { chance: 0.5 }),
  atl('h-glow', 0, 1, false, [0.8, 1.15], { tint: 0xe0a0d0 }),
  atl('h-rock', 0, 2, false, [0.8, 1.2], { tint: 0x9a6088 }),
  atl('h-rock2', 0, 1, false, [0.8, 1.2], { tint: 0x8a5078 }),
  atl('h-spikes', 0, 2, false, [0.9, 1.2], { tint: 0x6a2a3a }),
  atl('c-bones', 1, 2, true, [0.8, 1.1], { tint: 0xc8a0b0 }),
  atl('c-tomb', 0, 1, false, [0.9, 1.1], { tint: 0x8a6a7a }),
  atl('c-cross', 0, 1, false, [0.9, 1.1], { tint: 0x8a6a7a }),
  atl('f-crystal2', 0, 1, false, [0.8, 1.3]),
  atl('s-skull', 0, 2, false, [0.8, 1.1], { tint: 0xd8b0c0 }),
  atl('h-flame', 0, 1, false, [0.8, 1.2], { tint: 0xffb0e0 }),
];

const COMMON = ['mobs-common', 'decor'];

/**
 * Старт с поздней главы (выбор в меню): богатырь приходит подготовленным — примерно таким, каким дошёл бы сам
 * (уровень и число предметов к началу главы; оценка по симуляции обычного забега).
 */
export const START_LEVEL = [1, 24, 33, 40, 46, 52];
// по 7 случайных предметов за каждую пропущенную главу (всего предметов 20)
export const START_ITEMS = [0, 7, 14, 20, 20, 20];

export const BIOMES: BiomeDef[] = [
  {
    id: 'forest',
    title: T('Глава I. Дремучий лес', 'Chapter I. The Deep Forest'),
    ground: 'ground',
    groundTint: 0xffffff,
    groundScale: 1 / TEX_RES,
    bg: '#3f6a2a',
    decor: FOREST_DECOR,
    mood: 0xffffff,
    particles: 'none',
    enemies: [
      { key: 'walker', weight: 10 },
      { key: 'runner', weight: 4, from: 35 },
      { key: 'brute', weight: 1.2, from: 120 },
      { key: 'wolf', weight: 2, from: 200 },
    ],
    horde: ['walker', 'brute'],
    bosses: ['gorynych', 'tugarin', 'fused', 'leshy'],
    assets: [...COMMON, 'mobs-forest'],
  },
  {
    id: 'cursed',
    title: T('Глава II. Темнолесье', 'Chapter II. The Darkwood'),
    ground: 'ground-cursed',
    groundTint: 0xffffff,
    groundScale: 0.62,
    bg: '#2a2436',
    decor: CURSED_DECOR,
    mood: 0xc8b8e6,
    particles: 'motes',
    enemies: [
      { key: 'skel', weight: 6 },
      { key: 'walker', weight: 3 },
      { key: 'upyr', weight: 3, from: 20 },
      { key: 'archer', weight: 1.2, from: 45 },
      { key: 'brute', weight: 1.2, from: 90 },
    ],
    horde: ['skel', 'brute'],
    bosses: ['koschei', 'solovey', 'koschei_solovey'],
    assets: [...COMMON, 'mobs-cursed', 'ground-cursed'],
  },
  {
    id: 'scorched',
    title: T('Глава III. Выжженная земля', 'Chapter III. The Scorched Land'),
    ground: 'ground-scorched',
    groundTint: 0xffffff,
    groundScale: 0.62,
    bg: '#3a2e22',
    decor: SCORCHED_DECOR,
    mood: 0xf0d8bc,
    particles: 'ash',
    enemies: [
      { key: 'razboinik', weight: 6 },
      { key: 'wolf', weight: 3.5 },
      { key: 'upyr', weight: 2 },
      { key: 'mage', weight: 1.0, from: 40 },
      { key: 'charbrute', weight: 1.3, from: 90 },
    ],
    horde: ['razboinik', 'charbrute'],
    bosses: ['volkolak', 'koldun', 'volkoldun'],
    assets: [...COMMON, 'mobs-scorched', 'ground-scorched'],
  },
  {
    id: 'frozen',
    title: T('Глава IV. Лютые морозы', 'Chapter IV. The Bitter Frost'),
    ground: 'ground-frozen',
    groundTint: 0xffffff,
    groundScale: 0.62,
    bg: '#9aa8b8',
    decor: FROZEN_DECOR,
    mood: 0xdce6ff,
    particles: 'snow',
    enemies: [
      { key: 'frostwalker', weight: 6 },
      { key: 'navka', weight: 4 },
      { key: 'strazh', weight: 3, from: 30 },
      { key: 'snowwolf', weight: 2, from: 60 },
      { key: 'icearcher', weight: 1.1, from: 40 },
      { key: 'frostbrute', weight: 1.3, from: 90 },
    ],
    horde: ['frostwalker', 'frostbrute'],
    bosses: ['karachun', 'likho', 'lihoy'],
    assets: [...COMMON, 'mobs-frozen', 'ground-frozen'],
  },
  {
    id: 'hell',
    title: T('Глава V. Пекло', 'Chapter V. Hell'),
    ground: 'ground-hell',
    groundTint: 0xffffff,
    groundScale: 0.62,
    bg: '#3a1410',
    decor: HELL_DECOR,
    mood: 0xffc4ac,
    particles: 'embers',
    enemies: [
      { key: 'imp', weight: 6 },
      { key: 'chortik', weight: 3.5 },
      { key: 'dusha', weight: 2, from: 30 },
      { key: 'ogon', weight: 1.2, from: 20 },
      { key: 'rogach', weight: 1.3, from: 60 },
    ],
    horde: ['imp', 'rogach'],
    bosses: ['anchutka', 'viy', 'viy_fused', 'pek'],
    assets: [...COMMON, 'mobs-hell', 'ground-hell'],
  },
  {
    id: 'hell2',
    title: T('Глава VI. Дно Пекла', 'Chapter VI. The Bottom of Hell'),
    ground: 'ground-hell2',
    groundTint: 0xffffff,
    groundScale: 0.62,
    bg: '#2a1020',
    decor: HELL2_DECOR,
    mood: 0xf6d0e6,
    particles: 'souls',
    enemies: [
      { key: 'dusha', weight: 5 },
      { key: 'imp', weight: 3.5 },
      { key: 'chortik', weight: 3 },
      { key: 'upyr', weight: 2 },
      { key: 'navi', weight: 1.3 },
      { key: 'rogach', weight: 1.6, from: 40 },
    ],
    horde: ['dusha', 'rogach'],
    bosses: ['yascher', 'niy', 'chernobog'],
    assets: [...COMMON, 'mobs-hell', 'mobs-hell2', 'ground-hell2'],
  },
];
