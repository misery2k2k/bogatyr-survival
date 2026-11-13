// Нечисть и боссы на готовых спрайтах (всё, кроме зомби первой главы и векторных Горыныча/Тугарина/Ящера).
// tools/import-raw.mjs берёт отсюда, какие кадры взять из скачанных паков (и кладёт мастер-копии в raw-assets/mobs),
// tools/build-assets.mjs — как упаковать их в атласы.
//
// id       — префикс кадров и анимаций в игре: `${id}-walk0`, анимация `${id}-walk`.
// atlas    — в какой атлас. Атласы грузятся фоном и выгружаются, когда глава позади (см. src/mobs.ts).
// figure   — рост фигуры в атласе (px, по первому кадру ходьбы).
// flip     — исходник смотрит влево (в игре все смотрят вправо).
// outline  — обвести тёмным контуром (плоские векторные скелеты рядом с чиби-нечистью без контура смотрятся чужими).
// anims    — имя → { dir: папка в паке, re: шаблон файла (номер кадра — первая группа), take: сколько кадров взять, loop }.
// recolor  — перекраска по HSV (h 0..360, s,v 0..1) → [h,s,v] | null (null — не трогать).

const SONILD_WARRIOR = 'skeleton-warrior-sonild/files/Warrior Skeleton Animations';
const SONILD_ARCHER = 'skeleton-archer-sonild/files/Archer Skeleton  Animations';
const SONILD_MAGE = 'skeleton-magician-sonild/files/Magician Skeleton';
const SONILD_KNIGHT = 'skeleton-knight-sonild/files/Knight Skeleton';
const REAPER2 = 'reaper-chibi-craftpix/files/Reaper_Man_2/PNG/PNG Sequences';
const REAPER3 = 'reaper-chibi-craftpix/files/Reaper_Man_3/PNG/PNG Sequences';
const WOLF = 'wolf-segel/files/Wolf';
const ELF = 'elf-treant-craftpix/files';
const MON_A = 'monsters-td-craftpix-a/files/PNG';
const MON_B = 'monsters-td-craftpix-b/files/PNG';

const paren = (name) => new RegExp(`^${name} \\((\\d+)\\)\\.png$`, 'i');
const seq = (name) => new RegExp(`^${name}_(\\d+)\\.png$`, 'i');
/** Монстры CraftPix: walk/attack/die/jump/idle по 20 кадров. */
const mon = (pack, n, anim, take, loop = false) => ({ dir: `${pack}/${n}`, re: seq(`${n}_enemies_1_${anim}`), take, loop });
const monSet = (pack, n, extra = {}) => ({
  walk: mon(pack, n, 'walk', 10, true),
  attack: mon(pack, n, 'attack', 10, true),
  dead: mon(pack, n, 'die', 10),
  ...extra,
});
const elf = (n, anim, take, loop = false) => ({ dir: `${ELF}/${n}`, re: seq(`${n}_animation_${anim}`), take, loop });

export const MOBS = [
  // ---------------- Общая нечисть (нужна в нескольких главах) ----------------
  {
    // Серый волк; Волколак — он же, огромный
    id: 'wolf', atlas: 'mobs-common', figure: 120,
    anims: {
      walk: { dir: `${WOLF}/Run`, re: seq('__Wolf_Run'), take: 8, loop: true },
      attack: { dir: `${WOLF}/Attack`, re: seq('__Wolf_Attack'), take: 8, loop: true },
      idle: { dir: `${WOLF}/Idle`, re: seq('__Wolf_Idle'), take: 8, loop: true },
      dead: { dir: `${WOLF}/Dead`, re: seq('__Wolf_Dead'), take: 8 },
    },
  },
  {
    id: 'upyr', atlas: 'mobs-common', figure: 130,
    anims: {
      walk: { dir: `${REAPER2}/Walking`, re: seq('0_Reaper_Man_Walking'), take: 12, loop: true },
      attack: { dir: `${REAPER2}/Slashing`, re: seq('0_Reaper_Man_Slashing'), take: 10, loop: true },
      dead: { dir: `${REAPER2}/Dying`, re: seq('0_Reaper_Man_Dying'), take: 10 },
    },
  },
  {
    id: 'skel', atlas: 'mobs-common', figure: 140, flip: true, outline: true,
    anims: {
      walk: { dir: `${SONILD_WARRIOR}/Walking/Separate Sp`, re: paren('walk'), take: 10, loop: true },
      attack: { dir: `${SONILD_WARRIOR}/Attack 1/Separate Sp`, re: paren('attack'), take: 8, loop: true },
      dead: { dir: `${SONILD_WARRIOR}/Dead/Separate Sp`, re: paren('dead'), take: 8 },
    },
  },
  {
    id: 'archer', atlas: 'mobs-common', figure: 140, flip: true, outline: true,
    anims: {
      walk: { dir: `${SONILD_ARCHER}/Walk/Separate sp`, re: paren('walk'), take: 10, loop: true },
      attack: { dir: `${SONILD_ARCHER}/Attack/Separate sp`, re: paren('attack'), take: 10 },
      dead: { dir: `${SONILD_ARCHER}/Dead/Separate sp`, re: paren('dead'), take: 6 },
    },
  },
  // Разбойник (шайка Соловья, бродяги Выжженной земли)
  { id: 'razboinik', atlas: 'mobs-common', figure: 120, anims: monSet(MON_A, 6) },
  // Навка / грешная душа (призрак): Лютые морозы и Дно Пекла
  { id: 'ghost', atlas: 'mobs-common', figure: 90, anims: monSet(MON_A, 9) },

  // ---------------- Глава I. Дремучий лес ----------------
  {
    // Леший — старый друид с рогами и посохом
    id: 'leshy', atlas: 'mobs-forest', figure: 220, flip: true,
    anims: { walk: elf(4, 'walk', 10, true), attack: elf(4, 'attack', 10), hurt: elf(4, 'hurt', 6) },
  },
  {
    // Древень — ходячее дерево, призыв Лешего
    id: 'treant', atlas: 'mobs-forest', figure: 200, flip: true,
    anims: { walk: elf(6, 'walk', 10, true), attack: elf(6, 'attack', 10, true), hurt: elf(6, 'hurt', 6) },
  },

  // ---------------- Глава II. Темнолесье ----------------
  {
    // Кощей Бессмертный (и наездник Кощея-Соловья)
    id: 'koschei', atlas: 'mobs-cursed', figure: 240, flip: true, outline: true,
    anims: {
      walk: { dir: `${SONILD_KNIGHT}/Walk/Separate sp`, re: paren('walk'), take: 10, loop: true },
      attack: { dir: `${SONILD_KNIGHT}/Attack 1/Separated sp`, re: paren('attack 1'), take: 10 },
      slam: { dir: `${SONILD_KNIGHT}/Attack 2/Separate sp`, re: paren('attack 2'), take: 10 },
      idle: { dir: `${SONILD_KNIGHT}/Idle/Separate sp`, re: paren('idle'), take: 6, loop: true },
      dead: { dir: `${SONILD_KNIGHT}/Dead/Separate sp`, re: paren('dead'), take: 7 },
    },
  },
  // Соловей-Разбойник — косматый, красноглазый, с мечом
  { id: 'solovey', atlas: 'mobs-cursed', figure: 220, anims: monSet(MON_A, 10, { jump: mon(MON_A, 10, 'jump', 10), idle: mon(MON_A, 10, 'idle', 8, true) }) },

  // ---------------- Глава III. Выжженная земля ----------------
  {
    // Чернокнижник; Чёрный Колдун — он же, крупнее
    id: 'mage', atlas: 'mobs-scorched', figure: 210, flip: true, outline: true,
    anims: {
      walk: { dir: `${SONILD_MAGE}/Walk/Separate sp 2`, re: paren('walk 2'), take: 10, loop: true },
      attack: { dir: `${SONILD_MAGE}/Attack 1/Separate sp`, re: paren('attack 1'), take: 10 },
      idle: { dir: `${SONILD_MAGE}/Idle/Separate sp 1`, re: paren('idle'), take: 6, loop: true },
      dead: { dir: `${SONILD_MAGE}/Dead/Separate sp`, re: seq('ad_entity_000_Dead'), take: 7 },
    },
  },

  // ---------------- Глава IV. Лютые морозы ----------------
  {
    // Карачун — старик в капюшоне, перекрашен в лёд
    id: 'karachun', atlas: 'mobs-frozen', figure: 220,
    recolor: (h, s, v) => {
      if (h > 40 && h < 70 && s > 0.45 && v > 0.5) return [188, 0.75, 1]; // жёлтые глаза → ледяные
      if (s < 0.32 && v > 0.55) return [205, s * 0.35, Math.min(1, v * 1.08)]; // борода → иней
      if (h > 190 && h < 260) return [205, Math.min(0.55, s + 0.15), Math.min(1, 0.32 + v * 1.2)]; // тёмный балахон → студёный
      return null;
    },
    anims: monSet(MON_A, 2, { idle: mon(MON_A, 2, 'idle', 8, true) }),
  },
  // Лихо Одноглазое — бледный здоровяк с одним глазом и шипастым кистенём
  { id: 'likho', atlas: 'mobs-frozen', figure: 230, anims: monSet(MON_B, 6, { idle: mon(MON_B, 6, 'idle', 8, true) }) },
  // Навий страж — белый, четырёхглазый, с копьём
  { id: 'strazh', atlas: 'mobs-frozen', figure: 125, anims: monSet(MON_B, 3) },

  // ---------------- Глава V. Пекло ----------------
  { id: 'imp', atlas: 'mobs-hell', figure: 110, anims: monSet(MON_A, 7) },
  { id: 'chortik', atlas: 'mobs-hell', figure: 110, anims: monSet(MON_B, 5) },
  { id: 'rogach', atlas: 'mobs-hell', figure: 140, anims: monSet(MON_A, 8) },
  // Анчутка Беспятый — красный чёрт с вилами, скачет
  { id: 'anchutka', atlas: 'mobs-hell', figure: 200, anims: monSet(MON_B, 1, { jump: mon(MON_B, 1, 'jump', 10) }) },
  {
    // Вий — землистый тролль с дубиной, веки опущены (глаза перекрашены в цвет кожи)
    id: 'viy', atlas: 'mobs-hell', figure: 280,
    recolor: (h, s, v) => {
      if (h > 40 && h < 70 && s > 0.5 && v > 0.6) return [30, 0.35, 0.22]; // глаза под веками
      if (h >= 65 && h < 160 && s > 0.15) return [28, Math.min(1, s * 0.6 + 0.1), v * 0.62]; // зелёная кожа → чёрная земля
      return null;
    },
    anims: monSet(MON_A, 3),
  },
  {
    // Пек, Пекельный царь — каменный великан, раскалённый докрасна
    id: 'pek', atlas: 'mobs-hell', figure: 280,
    recolor: (h, s, v) => {
      if (h > 40 && h < 70 && s > 0.5 && v > 0.6) return [52, 0.6, 1]; // глаза — белый жар
      if (h >= 90 && h < 180 && s > 0.2) return [6 + v * v * 34, 0.92, Math.min(1, 0.18 + v * v * 0.95)]; // зелёная кожа → раскалённый камень
      if ((h < 20 || h > 330) && s > 0.35) return [0, 0.3, v * 0.35]; // красная одёжа → окалина
      return null;
    },
    anims: monSet(MON_B, 2),
  },

  // ---------------- Глава VI. Дно Пекла ----------------
  {
    // Ний, владыка Нави — череп в лиловом балахоне, с косой
    id: 'niy', atlas: 'mobs-hell2', figure: 240,
    recolor: (h, s, v) => {
      if ((h < 25 || h > 330) && s > 0.3 && v > 0.45) return [285, 0.8, Math.min(1, v * 1.15)]; // красные глаза → лиловое свечение
      if (v < 0.42) return [272, 0.4, v * 1.15]; // чёрный балахон → чёрно-лиловый
      return null;
    },
    anims: {
      walk: { dir: `${REAPER3}/Walking`, re: seq('0_Reaper_Man_Walking'), take: 12, loop: true },
      attack: { dir: `${REAPER3}/Slashing`, re: seq('0_Reaper_Man_Slashing'), take: 10 },
      cast: { dir: `${REAPER3}/Throwing`, re: seq('0_Reaper_Man_Throwing'), take: 10 },
      dead: { dir: `${REAPER3}/Dying`, re: seq('0_Reaper_Man_Dying'), take: 10 },
    },
  },
  {
    // Чернобог — рогатый с секирой, обугленный, с огненными глазами
    id: 'chernobog', atlas: 'mobs-hell2', figure: 300,
    recolor: (h, s, v) => {
      if (h > 250 && h < 320 && s > 0.35 && v > 0.45) return [22, 1, 1];
      if (h > 160 && h < 250 && s > 0.25 && v < 0.8) return [355, Math.min(1, s * 0.9 + 0.25), v * 0.55];
      return null;
    },
    anims: monSet(MON_B, 7),
  },
];

/** Масштаб мастер-копий в raw-assets/mobs относительно итогового атласа (запас на будущие правки размеров). */
export const MASTER_K = 1.5;

/**
 * Декор глав II–VI: готовые объекты из raw-assets/decor. h — высота в мире (px).
 */
export const DECOR = {
  // Темнолесье (pzUH, CC0)
  'c-tree': { src: 'pzuh-graveyard-tree.png', h: 170 },
  'c-deadbush': { src: 'pzuh-graveyard-deadbush.png', h: 40 },
  'c-bones': { src: 'pzuh-graveyard-skeleton.png', h: 22 },
  'c-tomb': { src: 'pzuh-graveyard-tomb1.png', h: 36 },
  'c-cross': { src: 'pzuh-graveyard-tomb2.png', h: 52 },
  'c-bush': { src: 'pzuh-graveyard-bush1.png', h: 40 },
  'c-bush2': { src: 'pzuh-graveyard-bush2.png', h: 32 },
  'c-shroom': { src: 'pzuh-mushroom1.png', h: 22 },
  'c-shroom2': { src: 'pzuh-mushroom2.png', h: 20 },
  // Выжженная земля (LudicArts CC-BY 4.0, Tio Aimar CC0, pzUH CC0)
  's-tree': { src: 'ludic-tree1.png', h: 210 },
  's-tree2': { src: 'ludic-tree2.png', h: 200 },
  's-tree3': { src: 'ludic-tree3.png', h: 150 },
  's-ctree': { src: 'tio-tree.png', h: 150 },
  's-bramble': { src: 'ludic-bramble1.png', h: 40 },
  's-bramble2': { src: 'ludic-bramble2.png', h: 36 },
  's-rock': { src: 'ludic-rock1.png', h: 70 },
  's-rock2': { src: 'ludic-rock2.png', h: 60 },
  's-tumble': { src: 'ludic-tumble.png', h: 22 },
  's-skull': { src: 'ludic-skull.png', h: 26 },
  's-burnt': { src: 'tio-burntbush.png', h: 34 },
  's-burnt2': { src: 'tio-deadbush.png', h: 44 },
  's-bones': { src: 'pzuh-desert-skeleton.png', h: 22 },
  // Лютые морозы (те же, перекрашенные в иней, + ледяные кристаллы Tio Aimar)
  'f-crystal': { src: 'tio-crystal-blue.png', h: 46 },
  'f-crystal2': { src: 'tio-crystal-purple.png', h: 40 },
  // Пекло (LudicArts, Tio Aimar, Bevouliin CC0)
  'h-glow': { src: 'ludic-glowrocks.png', h: 70 },
  'h-volcano': { src: 'tio-volcano.png', h: 62 },
  'h-flame': { src: 'tio-flameplant.png', h: 58 },
  'h-flame2': { src: 'tio-flamebush.png', h: 50 },
  'h-rock': { src: 'tio-rock1.png', h: 54 },
  'h-rock2': { src: 'tio-rock2.png', h: 40 },
  'h-spikes': { src: 'bevouliin-spikes.png', h: 44 },
};

/** Откуда брать исходники декора и земли (относительно папки со скачанными паками). */
export const DECOR_SOURCES = {
  'pzuh-graveyard-tree.png': 'graveyard-tileset-pzuh/files/png/Objects/Tree.png',
  'pzuh-graveyard-deadbush.png': 'graveyard-tileset-pzuh/files/png/Objects/DeadBush.png',
  'pzuh-graveyard-skeleton.png': 'graveyard-tileset-pzuh/files/png/Objects/Skeleton.png',
  'pzuh-graveyard-tomb1.png': 'graveyard-tileset-pzuh/files/png/Objects/TombStone (1).png',
  'pzuh-graveyard-tomb2.png': 'graveyard-tileset-pzuh/files/png/Objects/TombStone (2).png',
  'pzuh-graveyard-bush1.png': 'graveyard-tileset-pzuh/files/png/Objects/Bush (1).png',
  'pzuh-graveyard-bush2.png': 'graveyard-tileset-pzuh/files/png/Objects/Bush (2).png',
  'pzuh-mushroom1.png': 'platformer-tileset-pzuh/files/png/Object/Mushroom_1.png',
  'pzuh-mushroom2.png': 'platformer-tileset-pzuh/files/png/Object/Mushroom_2.png',
  'pzuh-desert-skeleton.png': 'desert-tileset-pzuh/files/png/Objects/Skeleton.png',
  'ludic-tree1.png': 'volcano-tileset-ludicarts/files/images/Tile_33.png',
  'ludic-tree2.png': 'volcano-tileset-ludicarts/files/images/Tile_34.png',
  'ludic-tree3.png': 'volcano-tileset-ludicarts/files/images/Tile_39.png',
  'ludic-bramble1.png': 'volcano-tileset-ludicarts/files/images/Tile_25.png',
  'ludic-bramble2.png': 'volcano-tileset-ludicarts/files/images/Tile_26.png',
  'ludic-rock1.png': 'volcano-tileset-ludicarts/files/images/Tile_20.png',
  'ludic-rock2.png': 'volcano-tileset-ludicarts/files/images/Tile_21.png',
  'ludic-tumble.png': 'volcano-tileset-ludicarts/files/images/Tile_29.png',
  'ludic-skull.png': 'volcano-tileset-ludicarts/files/images/Tile_31.png',
  'ludic-glowrocks.png': 'volcano-tileset-ludicarts/files/images/Tile_19.png',
  'tio-tree.png': 'volcano-pack-tioaimar/files/PNG/volcano_pack_59.png',
  'tio-burntbush.png': 'volcano-pack-tioaimar/files/PNG/volcano_pack_69.png',
  'tio-deadbush.png': 'volcano-pack-tioaimar/files/PNG/volcano_pack_73.png',
  'tio-volcano.png': 'volcano-pack-tioaimar/files/PNG/volcano_pack_68.png',
  'tio-flameplant.png': 'volcano-pack-tioaimar/files/PNG/volcano_pack_74.png',
  'tio-flamebush.png': 'volcano-pack-tioaimar/files/PNG/volcano_pack_66.png',
  'tio-rock1.png': 'volcano-pack-tioaimar/files/PNG/volcano_pack_70.png',
  'tio-rock2.png': 'volcano-pack-tioaimar/files/PNG/volcano_pack_71.png',
  'tio-crystal-blue.png': 'volcano-pack-tioaimar/files/PNG/volcano_pack_72.png',
  'tio-crystal-purple.png': 'volcano-pack-tioaimar/files/PNG/volcano_pack_56.png',
  'bevouliin-spikes.png': 'spikes-bevouliin/files/transparent PNG/spike B.png',
  // земля
  'ground-grass.png': 'tex-ground-handpainted-drummyfish/files/grass_34.png',
  'ground-dirt.png': 'tex-ground-handpainted-drummyfish/files/dirt_9.png',
  'ground-stone.png': 'tex-pack-2k-handpainted-rubberduck/files/hp_01.png',
  'ground-volcano.png': 'tex-hell-volcanofloor-dakal/files/volcano_floor_0.png',
  'ground-lavastones.png': 'tex-hell-lavastones-althaj/files/Lava Stones.png',
};
