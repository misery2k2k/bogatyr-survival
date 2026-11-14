import type { EnemyKind } from './entities/Enemy';
import { T, type Text } from './i18n';

export type BossKind =
  | 'gorynych'
  | 'tugarin'
  | 'fused'
  | 'leshy'
  | 'koschei'
  | 'solovey'
  | 'koschei_solovey'
  | 'volkolak'
  | 'koldun'
  | 'volkoldun'
  | 'karachun'
  | 'likho'
  | 'lihoy'
  | 'anchutka'
  | 'viy'
  | 'viy_fused'
  | 'pek'
  | 'yascher'
  | 'niy'
  | 'chernobog';

/** Объявление босса при появлении. */
export const BOSS_TOAST: Record<BossKind, Text> = {
  gorynych: T('Змей Горыныч летит!', 'Zmey Gorynych is coming!'),
  tugarin: T('Тугарин Змеевич идёт!', 'Tugarin Zmeyevich approaches!'),
  fused: T('Тугаро-Горыныч!!!', 'Tugaro-Gorynych!!!'),
  leshy: T('Леший водит по лесу!', 'The Leshy leads you astray!'),
  koschei: T('Кощей Бессмертный пробудился!', 'Koschei the Deathless awakens!'),
  solovey: T('Соловей-Разбойник засвистал!', 'Nightingale the Robber starts whistling!'),
  koschei_solovey: T('Кощей-Соловей!!!', 'Koschei-Nightingale!!!'),
  volkolak: T('Волколак вышел на охоту!', 'The Volkolak is on the hunt!'),
  koldun: T('Чёрный Колдун колдует!', 'The Black Sorcerer casts his spells!'),
  volkoldun: T('Волколдун!!!', 'Wolfcerer!!!'),
  karachun: T('Карачун несёт стужу!', 'Karachun brings the deadly cold!'),
  likho: T('Лихо Одноглазое проснулось!', 'Likho the One-Eyed wakes up!'),
  lihoy: T('Лихой Карачун!!!', 'Wicked Karachun!!!'),
  anchutka: T('Анчутка Беспятый скачет!', 'Anchutka the Heelless comes hopping!'),
  viy: T('Вий поднимается из земли!', 'Viy rises from the earth!'),
  viy_fused: T('Анчутка держит Вию веки!!!', 'Anchutka holds Viy\'s eyelids open!!!'),
  pek: T('Пек, пекельный царь, гневается!', 'Pek, King of Hellfire, is furious!'),
  yascher: T('Ящер выползает из огненной реки!', 'Yashcher crawls out of the river of fire!'),
  niy: T('Ний, владыка Нави, явился!', 'Niy, Lord of Nav, has come!'),
  chernobog: T('Чернобог восстал!', 'Chernobog has risen!'),
};

/**
 * Приём босса. Поля, что не нужны виду приёма, не задаются.
 * Все приёмы сначала подсвечивают опасное место на земле (wind — сколько секунд), потом бьют.
 */
export interface Ability {
  kind: 'cleave' | 'slam' | 'leap' | 'dash' | 'summon' | 'roots' | 'volley' | 'nova' | 'blink' | 'meteors' | 'beam' | 'whistle' | 'burrow' | 'curse' | 'cage';
  /** Перезарядка и задержка перед первым применением (с). */
  cd: number;
  first?: number;
  /** С какого и до какого расстояния до богатыря приём имеет смысл. */
  min?: number;
  max?: number;
  wind?: number;
  /** Радиус (круг, сектор, клетка), полный угол сектора (рад). */
  r?: number;
  arc?: number;
  dmg?: number;
  /** Анимация (по умолчанию attack) и кто её играет — сам босс или наездник. */
  anim?: string;
  rider?: boolean;
  tint?: number;
  /** Отброс богатыря (скорость, px/с) и оглушение (с). */
  knock?: number;
  stun?: number;
  speed?: number;
  /** Призыв: кого, сколько, где (вокруг богатыря или себя), радиус кольца, предел живых, объявление, бафф себе. */
  type?: string;
  n?: number;
  at?: 'player' | 'self';
  ring?: number;
  maxAlive?: number;
  toast?: Text;
  buff?: { speed: number; dur: number };
  /** Корни/лёд: на сколько опутывает и разброс кругов вокруг богатыря; подпись над ним. */
  root?: number;
  spread?: number;
  label?: Text;
  /** Снаряды: текстура, масштаб, число волн. */
  shot?: string;
  scale?: number;
  waves?: number;
  /** Мгновение: на каком расстоянии от богатыря появится. */
  dist?: number;
  /** Луч: длина, ширина, длительность, скорость доворота (рад/с), «поднимите мне веки». */
  len?: number;
  width?: number;
  dur?: number;
  turn?: number;
  lids?: boolean;
}

export interface BossDef extends EnemyKind {
  kind: BossKind;
  /** Спрайт тела (id в атласах глав) или 'yascher' — векторный змей без крыльев. */
  body: string;
  /** Рост в мире (px). */
  h: number;
  tint?: number;
  /** Наездник (у гибридов): спрайт, рост, смещение по горизонтали и высота посадки (доли роста тела). */
  rider?: { id: string; h: number; dx: number; dy: number; tint?: number };
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  /** Держит дистанцию (колдуны); 0 — лезет вплотную. */
  keep?: number;
  /** Сколько раз встаёт после смерти (Кощей). */
  lives?: number;
  /** Парит над землёй (покачивается). */
  float?: boolean;
  /** Стужа вокруг: замедляет богатыря в радиусе. */
  aura?: { r: number; slow: number; color: number };
  /** Где глаза (доли роста: вперёд, вверх) — откуда бьёт луч. */
  eye?: [number, number];
  /** На какой доле здоровья кого призывает (Чернобог). */
  phases?: { at: number; kind: BossKind; toast: Text }[];
  /** Что кричит, когда падает в первый раз и когда встаёт (Кощей). */
  deathToast?: Text;
  riseToast?: Text;
  abilities: Ability[];
}

const FIRE = 0xff6a1a;
const ICE = 0xa8e0ff;
const SOUL = 0xb06aff;

// Повторяющиеся приёмы
const kosheiArmy = (cd: number, first: number, rider = false): Ability => ({
  kind: 'summon', cd, first, type: 'skel', n: 6, at: 'player', ring: 175, wind: 1.0, maxAlive: 12, toast: T('Встаньте, кощеева рать!', 'Rise, Koschei\'s army!'), anim: rider ? 'slam' : 'slam', rider,
});
const whistle = (dmg: number, cd = 7): Ability => ({ kind: 'whistle', cd, first: 3, r: 420, arc: 1.15, wind: 1.1, dmg, knock: 560, stun: 0.8, max: 400, anim: 'attack' });
const wolfPack = (cd: number, first: number): Ability => ({
  kind: 'summon', cd, first, type: 'wolf', n: 4, at: 'self', ring: 130, wind: 1.0, maxAlive: 8, toast: T('Волколак воет — стая идёт!', 'The Volkolak howls — the pack is coming!'), anim: 'idle', buff: { speed: 1.5, dur: 5 },
});
const pounce = (dmg: number, cd = 4.5): Ability => ({ kind: 'leap', cd, first: 2, wind: 0.6, r: 100, dmg, speed: 760, min: 150, max: 470, anim: 'attack' });
const icicles = (cd: number, rider = false): Ability => ({
  kind: 'roots', cd, first: 2.5, n: 4, r: 52, wind: 1.0, dmg: 20, root: 1.2, spread: 140, tint: ICE, label: T('Вмёрз!', 'Frozen!'), rider,
});
const iceVolley = (rider = false): Ability => ({ kind: 'volley', cd: 3.6, n: 5, arc: 0.55, speed: 340, dmg: 12, shot: 'shard', tint: 0xcff0ff, wind: 0.6, rider });
const imps = (cd: number, first: number, rider = false): Ability => ({
  kind: 'summon', cd, first, type: 'imp', n: 5, at: 'player', ring: 200, wind: 0.9, maxAlive: 10, toast: T('Бесенята, ко мне!', 'Imps, to me!'), rider,
});
const fireVolley = (cd = 5, rider = false): Ability => ({ kind: 'volley', cd, n: 3, arc: 0.35, speed: 330, dmg: 14, shot: 'orb', tint: FIRE, scale: 0.9, wind: 0.5, rider });

export const BOSSES: Partial<Record<BossKind, BossDef>> = {
  // ---------------- I. Дремучий лес ----------------
  leshy: {
    kind: 'leshy', key: 'leshy', name: T('Леший', 'Leshy'), body: 'leshy', h: 170,
    hp: 1700, speed: 52, damage: 16, radius: 30, xp: 70, scale: 1, knockbackResist: 0.92, keep: 260,
    abilities: [
      { kind: 'roots', cd: 6.5, first: 2.5, n: 3, r: 54, wind: 1.0, dmg: 18, root: 1.1, spread: 110, tint: 0x6ac83a, label: T('Опутан!', 'Rooted!') },
      { kind: 'volley', cd: 4.5, n: 5, arc: 0.5, speed: 300, dmg: 9, shot: 'shard', tint: 0x8ad85a, wind: 0.6 },
      { kind: 'summon', cd: 15, first: 6, type: 'treant', n: 2, at: 'self', ring: 110, wind: 1.0, maxAlive: 4, toast: T('Леший будит деревья!', 'The Leshy awakens the trees!') },
      { kind: 'blink', cd: 9, first: 5, dist: 260 },
    ],
  },

  // ---------------- II. Темнолесье ----------------
  koschei: {
    kind: 'koschei', key: 'koschei', name: T('Кощей Бессмертный', 'Koschei the Deathless'), body: 'koschei', h: 200,
    hp: 1500, speed: 52, damage: 18, radius: 30, xp: 80, scale: 1, knockbackResist: 0.95, lives: 1,
    deathToast: T('Смерть Кощея — в игле!', 'Koschei\'s death is hidden in a needle!'), riseToast: T('Кощей Бессмертный встаёт!', 'Koschei the Deathless rises!'),
    abilities: [
      { kind: 'cleave', cd: 3.2, r: 150, arc: 1.9, wind: 0.85, dmg: 26, max: 175, anim: 'attack' },
      { kind: 'slam', cd: 8, first: 4, r: 170, wind: 1.1, dmg: 30, knock: 380, anim: 'slam', tint: 0x9aff7a },
      kosheiArmy(13, 5),
    ],
  },
  solovey: {
    kind: 'solovey', key: 'solovey', name: T('Соловей-Разбойник', 'Nightingale the Robber'), body: 'solovey', h: 190,
    hp: 1400, speed: 64, damage: 16, radius: 28, xp: 80, scale: 1, knockbackResist: 0.9,
    abilities: [
      whistle(20),
      { kind: 'cleave', cd: 2.8, r: 115, arc: 1.6, wind: 0.6, dmg: 18, max: 125 },
      { kind: 'leap', cd: 6, first: 4, wind: 0.7, r: 90, dmg: 22, speed: 700, min: 170, max: 430, anim: 'jump' },
      { kind: 'summon', cd: 14, first: 6, type: 'razboinik', n: 4, at: 'player', ring: 220, wind: 0.8, maxAlive: 8, toast: T('Эй, разбойнички, на дело!', 'Hey, lads, to work!') },
    ],
  },
  koschei_solovey: {
    kind: 'koschei_solovey', key: 'koschei_solovey', name: T('Кощей-Соловей', 'Koschei-Nightingale'), body: 'solovey', h: 205,
    rider: { id: 'koschei', h: 120, dx: -0.06, dy: 0.8 },
    hp: 2300, speed: 58, damage: 20, radius: 32, xp: 160, scale: 1, knockbackResist: 0.95, lives: 1,
    deathToast: T('Соловей пал, а Кощей-то бессмертен!', 'The Nightingale fell, but Koschei is deathless!'), riseToast: T('Кощей-Соловей встаёт!', 'Koschei-Nightingale rises!'),
    abilities: [
      whistle(24, 6.5),
      { kind: 'leap', cd: 6, first: 4, wind: 0.7, r: 95, dmg: 24, speed: 700, min: 170, max: 430, anim: 'jump' },
      kosheiArmy(12, 5, true),
      { kind: 'slam', cd: 8, first: 7, r: 170, wind: 1.1, dmg: 30, knock: 400, anim: 'slam', rider: true, tint: 0x9aff7a },
    ],
  },

  // ---------------- III. Выжженная земля ----------------
  volkolak: {
    kind: 'volkolak', key: 'volkolak', name: T('Волколак', 'Volkolak'), body: 'wolf', h: 120, tint: 0x9a8070,
    hp: 1500, speed: 86, damage: 18, radius: 42, xp: 80, scale: 1, knockbackResist: 0.92,
    abilities: [pounce(24), { kind: 'cleave', cd: 2.4, r: 125, arc: 1.4, wind: 0.45, dmg: 18, max: 135 }, wolfPack(14, 6)],
  },
  koldun: {
    kind: 'koldun', key: 'koldun', name: T('Чёрный Колдун', 'The Black Sorcerer'), body: 'mage', h: 180, float: true,
    hp: 1300, speed: 54, damage: 14, radius: 26, xp: 80, scale: 1, knockbackResist: 0.9, keep: 300,
    abilities: [
      { kind: 'volley', cd: 3.2, n: 5, arc: 0.7, speed: 300, dmg: 12, shot: 'orb', tint: SOUL, wind: 0.7 },
      { kind: 'nova', cd: 8, first: 5, n: 14, speed: 220, dmg: 12, shot: 'orb', tint: 0x9a5aff, wind: 0.9, waves: 2 },
      { kind: 'blink', cd: 7, first: 4, dist: 280 },
      { kind: 'summon', cd: 15, first: 8, type: 'skel', n: 4, at: 'self', ring: 110, wind: 1.0, maxAlive: 8, toast: T('Колдун поднимает мёртвых!', 'The Sorcerer raises the dead!') },
    ],
  },
  volkoldun: {
    kind: 'volkoldun', key: 'volkoldun', name: T('Волколдун', 'Wolfcerer'), body: 'wolf', h: 130, tint: 0x8a7468,
    rider: { id: 'mage', h: 120, dx: -0.1, dy: 0.62 },
    hp: 2300, speed: 80, damage: 20, radius: 44, xp: 160, scale: 1, knockbackResist: 0.95,
    abilities: [
      pounce(26, 5),
      { kind: 'volley', cd: 3.4, n: 5, arc: 0.7, speed: 300, dmg: 12, shot: 'orb', tint: SOUL, wind: 0.6, rider: true },
      { kind: 'nova', cd: 9, first: 6, n: 14, speed: 220, dmg: 12, shot: 'orb', tint: 0x9a5aff, wind: 0.9, waves: 2, rider: true },
      wolfPack(15, 8),
    ],
  },

  // ---------------- IV. Лютые морозы ----------------
  karachun: {
    kind: 'karachun', key: 'karachun', name: T('Карачун', 'Karachun'), body: 'karachun', h: 175,
    hp: 1600, speed: 56, damage: 16, radius: 28, xp: 80, scale: 1, knockbackResist: 0.92, keep: 200,
    aura: { r: 260, slow: 0.65, color: ICE },
    abilities: [
      icicles(5.5),
      iceVolley(),
      { kind: 'nova', cd: 9, first: 6, n: 16, speed: 230, dmg: 12, shot: 'shard', tint: 0xcff0ff, wind: 1.0 },
      { kind: 'summon', cd: 14, first: 7, type: 'navka', n: 5, at: 'player', ring: 220, wind: 0.8, maxAlive: 10, toast: T('Карачун зовёт навок!', 'Karachun calls the navkas!') },
    ],
  },
  likho: {
    kind: 'likho', key: 'likho', name: T('Лихо Одноглазое', 'Likho the One-Eyed'), body: 'likho', h: 200, eye: [0.2, 0.68],
    hp: 2000, speed: 58, damage: 22, radius: 34, xp: 90, scale: 1, knockbackResist: 0.95,
    abilities: [
      { kind: 'cleave', cd: 2.6, r: 125, arc: 1.7, wind: 0.6, dmg: 20, max: 140 },
      { kind: 'slam', cd: 6, first: 3, r: 160, wind: 1.0, dmg: 30, knock: 420 },
      { kind: 'beam', cd: 7.5, first: 4, wind: 1.2, len: 560, width: 46, dur: 1.4, dmg: 14, turn: 0.55, tint: 0xb6ff5a },
      { kind: 'dash', cd: 6, first: 6, wind: 0.9, dmg: 26, speed: 620, min: 220, max: 520 },
    ],
  },
  lihoy: {
    kind: 'lihoy', key: 'lihoy', name: T('Лихой Карачун', 'Wicked Karachun'), body: 'likho', h: 215, eye: [0.2, 0.68],
    rider: { id: 'karachun', h: 115, dx: -0.04, dy: 0.86 },
    hp: 2500, speed: 56, damage: 22, radius: 36, xp: 170, scale: 1, knockbackResist: 0.95,
    aura: { r: 260, slow: 0.68, color: ICE },
    abilities: [
      { kind: 'slam', cd: 6, first: 3, r: 165, wind: 1.0, dmg: 30, knock: 420, tint: ICE },
      { kind: 'beam', cd: 8, first: 5, wind: 1.2, len: 560, width: 46, dur: 1.5, dmg: 15, turn: 0.55, tint: 0xb6ff5a },
      icicles(6, true),
      iceVolley(true),
      { kind: 'dash', cd: 7, first: 8, wind: 0.9, dmg: 26, speed: 620, min: 220, max: 520 },
    ],
  },

  // ---------------- V. Пекло ----------------
  anchutka: {
    kind: 'anchutka', key: 'anchutka', name: T('Анчутка Беспятый', 'Anchutka the Heelless'), body: 'anchutka', h: 180,
    hp: 1700, speed: 72, damage: 18, radius: 30, xp: 90, scale: 1, knockbackResist: 0.92,
    abilities: [
      { kind: 'leap', cd: 3.0, first: 1.5, wind: 0.55, r: 95, dmg: 22, speed: 760, min: 120, max: 480, anim: 'jump', tint: FIRE },
      { kind: 'dash', cd: 6, first: 4, wind: 0.7, dmg: 24, speed: 700, min: 160, max: 460 },
      fireVolley(),
      imps(13, 6),
    ],
  },
  viy: {
    kind: 'viy', key: 'viy', name: T('Вий', 'Viy'), body: 'viy', h: 250, eye: [0.12, 0.8],
    hp: 2400, speed: 34, damage: 24, radius: 40, xp: 100, scale: 1, knockbackResist: 0.97,
    abilities: [
      { kind: 'beam', cd: 10, first: 4, wind: 2.4, len: 720, width: 56, dur: 2.4, dmg: 18, turn: 0.42, tint: 0xff3a2a, lids: true },
      { kind: 'cleave', cd: 3, r: 145, arc: 1.8, wind: 0.75, dmg: 26, max: 165 },
      { kind: 'slam', cd: 5.5, first: 6, r: 175, wind: 1.0, dmg: 32, knock: 420 },
    ],
  },
  viy_fused: {
    kind: 'viy_fused', key: 'viy_fused', name: T('Вий Неусыпный', 'Viy the Sleepless'), body: 'viy', h: 260, eye: [0.12, 0.8],
    rider: { id: 'anchutka', h: 92, dx: 0.02, dy: 0.9 },
    hp: 2700, speed: 36, damage: 26, radius: 42, xp: 180, scale: 1, knockbackResist: 0.97,
    abilities: [
      { kind: 'beam', cd: 6.5, first: 3, wind: 1.1, len: 720, width: 56, dur: 2.2, dmg: 18, turn: 0.5, tint: 0xff3a2a },
      { kind: 'slam', cd: 5.5, first: 5, r: 175, wind: 1.0, dmg: 32, knock: 420 },
      fireVolley(4, true),
      imps(14, 8, true),
    ],
  },
  pek: {
    kind: 'pek', key: 'pek', name: T('Пек, пекельный царь', 'Pek, King of Hellfire'), body: 'pek', h: 250,
    hp: 2600, speed: 46, damage: 26, radius: 40, xp: 110, scale: 1, knockbackResist: 0.97,
    abilities: [
      { kind: 'meteors', cd: 7, first: 3, n: 7, spread: 200 },
      { kind: 'slam', cd: 5, first: 5, r: 180, wind: 1.0, dmg: 32, knock: 440, tint: FIRE },
      { kind: 'nova', cd: 9, first: 7, n: 18, speed: 240, dmg: 14, shot: 'orb', tint: FIRE, wind: 1.0, waves: 2 },
      fireVolley(3.5),
    ],
  },

  // ---------------- VI. Дно Пекла ----------------
  yascher: {
    kind: 'yascher', key: 'yascher', name: T('Ящер', 'Yashcher'), body: 'yascher', h: 170,
    hp: 2600, speed: 62, damage: 26, radius: 60, xp: 120, scale: 1, knockbackResist: 0.98,
    abilities: [
      { kind: 'burrow', cd: 9, first: 4, dur: 2.0, r: 120, wind: 0.8, dmg: 34, speed: 280, knock: 460 },
      { kind: 'cleave', cd: 4, r: 215, arc: 2.6, wind: 0.9, dmg: 26, max: 230, tint: FIRE },
      { kind: 'dash', cd: 5, first: 6, wind: 0.8, dmg: 30, speed: 720, min: 170, max: 520 },
    ],
  },
  niy: {
    kind: 'niy', key: 'niy', name: T('Ний, владыка Нави', 'Niy, Lord of Nav'), body: 'niy', h: 200, float: true,
    hp: 2400, speed: 54, damage: 20, radius: 30, xp: 120, scale: 1, knockbackResist: 0.95, keep: 240,
    abilities: [
      { kind: 'nova', cd: 6, n: 12, speed: 160, dmg: 13, shot: 'orb', tint: SOUL, wind: 0.8, waves: 3, anim: 'cast' },
      { kind: 'curse', cd: 12, first: 5, r: 70, wind: 1.1, dur: 6, anim: 'cast' },
      { kind: 'cage', cd: 14, first: 9, r: 150, wind: 1.0, dur: 4.5, dmg: 20, anim: 'cast' },
      { kind: 'summon', cd: 12, first: 7, type: 'dusha', n: 6, at: 'player', ring: 220, wind: 0.8, maxAlive: 12, toast: T('Ний выпускает души грешников!', 'Niy releases the souls of sinners!'), anim: 'cast' },
      { kind: 'blink', cd: 8, first: 6, dist: 260 },
    ],
  },
  chernobog: {
    kind: 'chernobog', key: 'chernobog', name: T('Чернобог', 'Chernobog'), body: 'chernobog', h: 290,
    hp: 3200, speed: 44, damage: 30, radius: 46, xp: 200, scale: 1, knockbackResist: 0.98,
    phases: [
      { at: 0.66, kind: 'tugarin', toast: T('Чернобог призвал Тугарина!', 'Chernobog summoned Tugarin!') },
      { at: 0.33, kind: 'fused', toast: T('Чернобог призвал Тугаро-Горыныча!', 'Chernobog summoned Tugaro-Gorynych!') },
    ],
    abilities: [
      { kind: 'cleave', cd: 3.2, r: 190, arc: 2.0, wind: 0.9, dmg: 34, max: 210 },
      { kind: 'slam', cd: 7, first: 4, r: 220, wind: 1.2, dmg: 40, knock: 480, tint: 0x9a2aff },
      { kind: 'nova', cd: 9, first: 6, n: 20, speed: 230, dmg: 16, shot: 'orb', tint: 0xff3a6a, wind: 1.1, waves: 2 },
      { kind: 'meteors', cd: 10, first: 8, n: 8, spread: 220 },
      { kind: 'beam', cd: 13, first: 10, wind: 1.4, len: 680, width: 54, dur: 2.0, dmg: 18, turn: 0.45, tint: 0x9a2aff },
      imps(16, 12),
    ],
  },
};
