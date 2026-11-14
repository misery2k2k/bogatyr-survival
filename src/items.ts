import type { Stats } from './entities/Player';
import { T, type Text } from './i18n';

/** Редкость предмета из сундука. */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY: Record<Rarity, { name: Text; color: number; text: string; weight: number }> = {
  common: { name: T('Обычное', 'Common'), color: 0xcfd6dc, text: '#dfe5ea', weight: 50 },
  rare: { name: T('Редкое', 'Rare'), color: 0x4aa3ff, text: '#7cc0ff', weight: 30 },
  epic: { name: T('Дивное', 'Epic'), color: 0xb45cff, text: '#d29bff', weight: 15 },
  legendary: { name: T('Былинное', 'Legendary'), color: 0xff9a1f, text: '#ffb84d', weight: 5 },
};

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export type ItemId =
  | 'belt' | 'ring' | 'klubok' | 'mitts'
  | 'horseshoe' | 'bracers' | 'apple' | 'tablecloth'
  | 'moonshard' | 'cap' | 'bell' | 'koschei' | 'heart' | 'alatyr'
  | 'battlefury' | 'monomakh' | 'feather' | 'gusli' | 'thunderring' | 'mace';

export interface ItemDef {
  id: ItemId;
  name: Text;
  rarity: Rarity;
  /** Что даёт — коротко, для карточки. */
  desc: Text;
  /** Постоянный бонус к статам (применяется после умений). */
  apply?: (s: Stats) => void;
}

/**
 * Предметы из сундуков: каждый попадается один раз за забег.
 * Особые эффекты (колокол, скатерть, перо) обрабатывает GameScene по id.
 */
export const ITEMS: ItemDef[] = [
  // ---- Обычные ----
  { id: 'belt', name: T('Пояс богатырский', 'Hero\'s Belt'), rarity: 'common', desc: T('+30 к здоровью', '+30 max health'), apply: (s) => (s.maxHp += 30) },
  { id: 'ring', name: T('Перстень с яхонтом', 'Ruby Ring'), rarity: 'common', desc: T('Урон всего оружия +12%', 'All weapon damage +12%'), apply: (s) => (s.might += 0.12) },
  {
    id: 'klubok',
    name: T('Клубок-путеводец', 'Guiding Yarn Ball'),
    rarity: 'common',
    desc: T('Опыт +15%, пирожки тянутся издалека', 'XP +15%, pies are pulled in from afar'),
    apply: (s) => {
      s.xpMul += 0.15;
      s.pickupRadius *= 1.6;
    },
  },
  { id: 'mitts', name: T('Ежовые рукавицы', 'Hedgehog Gauntlets'), rarity: 'common', desc: T('Кто ударит богатыря — получит втрое сильнее в ответ', 'Whoever hits the hero takes triple damage back'), apply: (s) => (s.thorns += 3) },
  // ---- Редкие ----
  { id: 'horseshoe', name: T('Подкова Сивки-Бурки', 'Sivka-Burka\'s Horseshoe'), rarity: 'rare', desc: T('Скорость бега +20%', 'Move speed +20%'), apply: (s) => (s.speed *= 1.2) },
  {
    id: 'bracers',
    name: T('Наручи булатные', 'Damascus Bracers'),
    rarity: 'rare',
    desc: T('Шанс богатырской затрещины +10%', 'Mighty Smack chance +10%'),
    apply: (s) => {
      s.critChance += 0.1;
      s.critMul = Math.max(s.critMul, 2);
    },
  },
  { id: 'apple', name: T('Яблоко молодильное', 'Rejuvenating Apple'), rarity: 'rare', desc: T('+50 к здоровью и полное исцеление', '+50 max health and a full heal'), apply: (s) => (s.maxHp += 50) },
  { id: 'tablecloth', name: T('Скатерть-самобранка', 'Self-Laying Tablecloth'), rarity: 'rare', desc: T('Каждые 20 с кормит богатыря: +20% здоровья', 'Every 20 s feeds the hero: +20% health') },
  // ---- Дивные (эпические) ----
  { id: 'moonshard', name: T('Осколок Месяца', 'Moon Shard'), rarity: 'epic', desc: T('Все удары на четверть чаще', 'All attacks a quarter faster'), apply: (s) => (s.haste *= 0.75) },
  { id: 'cap', name: T('Шапка-невидимка', 'Cap of Invisibility'), rarity: 'epic', desc: T('18% ударов нечисти проходят мимо', '18% of monster blows miss'), apply: (s) => (s.evasion += 0.18) },
  { id: 'bell', name: T('Колокол вечевой', 'Veche Bell'), rarity: 'epic', desc: T('Каждые 6 с гудит: волна урона и отброса вокруг', 'Tolls every 6 s: a wave of damage and knockback') },
  { id: 'koschei', name: T('Кольчуга Кощеева', 'Koschei\'s Chainmail'), rarity: 'epic', desc: T('Получаемый урон −20%', 'Damage taken −20%'), apply: (s) => (s.armor += 0.2) },
  {
    id: 'heart',
    name: T('Сердце Тура', 'Aurochs\' Heart'),
    rarity: 'epic',
    desc: T('Здоровье +25% и понемногу заживают раны', 'Health +25% and wounds slowly heal'),
    apply: (s) => {
      s.maxHp = Math.round(s.maxHp * 1.25);
      s.regen += 1.5;
    },
  },
  { id: 'alatyr', name: T('Камень Алатырь', 'Alatyr Stone'), rarity: 'epic', desc: T('Когда здоровья меньше трети — 3 с неуязвимости (раз в 40 с)', 'Below a third of health — 3 s of invulnerability (every 40 s)') },
  // ---- Былинные (легендарные) ----
  { id: 'battlefury', name: T('Секира Ярой сечи', 'Axe of Fierce Battle'), rarity: 'legendary', desc: T('Каждый удар сечёт и всех рядом с целью (половина урона)', 'Every hit also cleaves everyone near the target (half damage)'), apply: (s) => (s.cleave += 0.5) },
  {
    id: 'monomakh',
    name: T('Шапка Мономаха', 'Cap of Monomakh'),
    rarity: 'legendary',
    desc: T('Урон +30%, здоровье +30%', 'Damage +30%, health +30%'),
    apply: (s) => {
      s.might += 0.3;
      s.maxHp = Math.round(s.maxHp * 1.3);
    },
  },
  { id: 'feather', name: T('Перо Жар-птицы', 'Firebird Feather'), rarity: 'legendary', desc: T('Один раз поднимет павшего богатыря на ноги', 'Revives the fallen hero once') },
  { id: 'thunderring', name: T('Перстень Громовержца', 'Thunderer\'s Ring'), rarity: 'legendary', desc: T('Удар с шансом 15% пускает молнию по цепи на четверых', 'Hits have a 15% chance to chain lightning to four foes') },
  {
    id: 'mace',
    name: T('Палица Ильи Муромца', 'Ilya Muromets\' Mace'),
    rarity: 'legendary',
    desc: T('Шанс богатырской затрещины +15%, затрещина на ×1 сильнее', 'Mighty Smack chance +15%, smack ×1 stronger'),
    apply: (s) => {
      s.critChance += 0.15;
      s.critMul = Math.max(s.critMul, 2) + 1;
    },
  },
  { id: 'gusli', name: T('Гусли-самогуды', 'Self-Playing Gusli'), rarity: 'legendary', desc: T('Нечисть рядом заслушивается и еле ползёт', 'Nearby monsters are spellbound and barely crawl'), apply: (s) => (s.slowAura = Math.max(s.slowAura, 160)) },
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
