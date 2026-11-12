import type { Stats } from './entities/Player';

/** Редкость предмета из сундука. */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, { name: string; color: number; text: string; weight: number }> = {
  common: { name: 'Обычное', color: 0xcfd6dc, text: '#dfe5ea', weight: 50 },
  rare: { name: 'Редкое', color: 0x4aa3ff, text: '#7cc0ff', weight: 30 },
  epic: { name: 'Дивное', color: 0xb45cff, text: '#d29bff', weight: 15 },
  legendary: { name: 'Былинное', color: 0xff9a1f, text: '#ffb84d', weight: 5 },
};

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export type ItemId =
  | 'belt' | 'ring' | 'klubok' | 'mitts'
  | 'horseshoe' | 'bracers' | 'apple' | 'tablecloth'
  | 'moonshard' | 'cap' | 'bell' | 'koschei' | 'heart' | 'alatyr'
  | 'battlefury' | 'monomakh' | 'feather' | 'gusli' | 'thunderring' | 'mace';

export interface ItemDef {
  id: ItemId;
  name: string;
  rarity: Rarity;
  /** Что даёт — коротко, для карточки. */
  desc: string;
  /** Постоянный бонус к статам (применяется после умений). */
  apply?: (s: Stats) => void;
}

/**
 * Предметы из сундуков: каждый попадается один раз за забег.
 * Особые эффекты (колокол, скатерть, перо) обрабатывает GameScene по id.
 */
export const ITEMS: ItemDef[] = [
  // ---- Обычные ----
  { id: 'belt', name: 'Пояс богатырский', rarity: 'common', desc: '+30 к здоровью', apply: (s) => (s.maxHp += 30) },
  { id: 'ring', name: 'Перстень с яхонтом', rarity: 'common', desc: 'Урон всего оружия +12%', apply: (s) => (s.might += 0.12) },
  {
    id: 'klubok',
    name: 'Клубок-путеводец',
    rarity: 'common',
    desc: 'Опыт +15%, пирожки тянутся издалека',
    apply: (s) => {
      s.xpMul += 0.15;
      s.pickupRadius *= 1.6;
    },
  },
  { id: 'mitts', name: 'Ежовые рукавицы', rarity: 'common', desc: 'Кто ударит богатыря — получит втрое сильнее в ответ', apply: (s) => (s.thorns += 3) },
  // ---- Редкие ----
  { id: 'horseshoe', name: 'Подкова Сивки-Бурки', rarity: 'rare', desc: 'Скорость бега +20%', apply: (s) => (s.speed *= 1.2) },
  {
    id: 'bracers',
    name: 'Наручи булатные',
    rarity: 'rare',
    desc: 'Шанс богатырской затрещины +10%',
    apply: (s) => {
      s.critChance += 0.1;
      s.critMul = Math.max(s.critMul, 2);
    },
  },
  { id: 'apple', name: 'Яблоко молодильное', rarity: 'rare', desc: '+50 к здоровью и полное исцеление', apply: (s) => (s.maxHp += 50) },
  { id: 'tablecloth', name: 'Скатерть-самобранка', rarity: 'rare', desc: 'Каждые 20 с кормит богатыря: +20% здоровья' },
  // ---- Дивные (эпические) ----
  { id: 'moonshard', name: 'Осколок Месяца', rarity: 'epic', desc: 'Все удары на четверть чаще', apply: (s) => (s.haste *= 0.75) },
  { id: 'cap', name: 'Шапка-невидимка', rarity: 'epic', desc: '18% ударов нечисти проходят мимо', apply: (s) => (s.evasion += 0.18) },
  { id: 'bell', name: 'Колокол вечевой', rarity: 'epic', desc: 'Каждые 6 с гудит: волна урона и отброса вокруг' },
  { id: 'koschei', name: 'Кольчуга Кощеева', rarity: 'epic', desc: 'Получаемый урон −20%', apply: (s) => (s.armor += 0.2) },
  {
    id: 'heart',
    name: 'Сердце Тура',
    rarity: 'epic',
    desc: 'Здоровье +25% и понемногу заживают раны',
    apply: (s) => {
      s.maxHp = Math.round(s.maxHp * 1.25);
      s.regen += 1.5;
    },
  },
  { id: 'alatyr', name: 'Камень Алатырь', rarity: 'epic', desc: 'Когда здоровья меньше трети — 3 с неуязвимости (раз в 40 с)' },
  // ---- Былинные (легендарные) ----
  { id: 'battlefury', name: 'Секира Ярой сечи', rarity: 'legendary', desc: 'Каждый удар сечёт и всех рядом с целью (половина урона)', apply: (s) => (s.cleave += 0.5) },
  {
    id: 'monomakh',
    name: 'Шапка Мономаха',
    rarity: 'legendary',
    desc: 'Урон +30%, здоровье +30%',
    apply: (s) => {
      s.might += 0.3;
      s.maxHp = Math.round(s.maxHp * 1.3);
    },
  },
  { id: 'feather', name: 'Перо Жар-птицы', rarity: 'legendary', desc: 'Один раз поднимет павшего богатыря на ноги' },
  { id: 'thunderring', name: 'Перстень Громовержца', rarity: 'legendary', desc: 'Удар с шансом 15% пускает молнию по цепи на четверых' },
  {
    id: 'mace',
    name: 'Палица Ильи Муромца',
    rarity: 'legendary',
    desc: 'Шанс богатырской затрещины +15%, затрещина на ×1 сильнее',
    apply: (s) => {
      s.critChance += 0.15;
      s.critMul = Math.max(s.critMul, 2) + 1;
    },
  },
  { id: 'gusli', name: 'Гусли-самогуды', rarity: 'legendary', desc: 'Нечисть рядом заслушивается и еле ползёт', apply: (s) => (s.slowAura = Math.max(s.slowAura, 160)) },
];

export const ITEM_BY_ID = new Map<ItemId, ItemDef>(ITEMS.map((i) => [i.id, i]));

/**
 * Случайный ещё не взятый предмет. minRarity — не хуже этой редкости (сундук со змея).
 * late — доля «позднего» забега 0..1: чем дальше, тем чаще дивные и былинные.
 */
export function rollItem(owned: ReadonlySet<ItemId>, minRarity: Rarity = 'common', late = 0): ItemId | null {
  const minIdx = RARITY_ORDER.indexOf(minRarity);
  const pool = ITEMS.filter((i) => !owned.has(i.id) && RARITY_ORDER.indexOf(i.rarity) >= minIdx);
  if (pool.length === 0) return null;
  const weight = (r: Rarity) => {
    const base = RARITY[r].weight;
    // к концу забега обычные встречаются вдвое реже, былинные — вдвое чаще
    const shift = r === 'common' ? 1 - late * 0.5 : r === 'legendary' ? 1 + late : r === 'epic' ? 1 + late * 0.5 : 1;
    return base * shift;
  };
  const total = pool.reduce((s, i) => s + weight(i.rarity), 0);
  let r = Math.random() * total;
  for (const i of pool) {
    r -= weight(i.rarity);
    if (r <= 0) return i.id;
  }
  return pool[pool.length - 1].id;
}
