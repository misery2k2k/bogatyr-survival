import type { Stats } from './entities/Player';
import { T, type Text } from './i18n';
import { Save } from './save';

/**
 * Ветви древа талантов (по 4 таланта). Внутри ветви следующий талант открывается, когда вложен хоть один уровень
 * в предыдущий. Таланты складываются с умениями забега (умения не затирают их).
 */
export const BRANCHES = [
  { id: 'might', name: T('Сила', 'Might') },
  { id: 'vigor', name: T('Стойкость', 'Vigor') },
  { id: 'valor', name: T('Удаль', 'Valor') },
] as const;

export type BranchId = (typeof BRANCHES)[number]['id'];

export interface TalentDef {
  id: string;
  branch: BranchId;
  name: Text;
  icon: string;
  max: number;
  /** Цена следующего уровня (lvl — текущий уровень). */
  cost: (lvl: number) => number;
  /** Что даёт уровень lvl — для подписи. */
  desc: (lvl: number) => Text;
  apply: (s: Stats, lvl: number) => void;
}

const ladder = (base: number) => (lvl: number) => Math.round(base * (1 + lvl * 0.9 + lvl * lvl * 0.25));

export const TALENTS: TalentDef[] = [
  // ---- Сила ----
  { id: 'dmg', branch: 'might', name: T('Богатырская сила', 'Heroic Strength'), icon: 'icon-might', max: 5, cost: ladder(30), desc: (l) => T(`Урон +${l * 4}%`, `Damage +${l * 4}%`), apply: (s, l) => (s.might += 0.04 * l) },
  { id: 'haste', branch: 'might', name: T('Скорая рука', 'Quick Hand'), icon: 'icon-haste', max: 5, cost: ladder(40), desc: (l) => T(`Удары чаще на ${l * 3}%`, `Attacks ${l * 3}% faster`), apply: (s, l) => (s.haste *= 1 - 0.03 * l) },
  {
    id: 'crit',
    branch: 'might',
    name: T('Тяжёлая рука', 'Heavy Hand'),
    icon: 'icon-crit',
    max: 5,
    cost: ladder(55),
    desc: (l) => T(`Шанс затрещины +${l * 2}%`, `Smack chance +${l * 2}%`),
    apply: (s, l) => {
      s.critChance += 0.02 * l;
      if (l > 0) s.critMul = Math.max(s.critMul, 2);
    },
  },
  { id: 'reach', branch: 'might', name: T('Широкий замах', 'Wide Swing'), icon: 'icon-area', max: 5, cost: ladder(45), desc: (l) => T(`Дальность и радиус ударов +${l * 3}%`, `Attack reach and radius +${l * 3}%`), apply: (s, l) => (s.area += 0.03 * l) },
  // ---- Стойкость ----
  { id: 'hp', branch: 'vigor', name: T('Крепкое здоровье', 'Sturdy Health'), icon: 'icon-vitality', max: 5, cost: ladder(30), desc: (l) => T(`+${l * 10} к здоровью`, `+${l * 10} max health`), apply: (s, l) => (s.maxHp += 10 * l) },
  { id: 'armor', branch: 'vigor', name: T('Закалка', 'Toughness'), icon: 'icon-armor', max: 5, cost: ladder(40), desc: (l) => T(`Получаемый урон −${l * 2}%`, `Damage taken −${l * 2}%`), apply: (s, l) => (s.armor += 0.02 * l) },
  { id: 'regen', branch: 'vigor', name: T('Живучесть', 'Resilience'), icon: 'icon-amulet', max: 5, cost: ladder(55), desc: (l) => T(`Лечение +${(l * 0.2).toLocaleString('ru-RU')} в секунду`, `Healing +${Math.round(l * 2) / 10} per second`), apply: (s, l) => (s.regen += 0.2 * l) },
  {
    id: 'vamp',
    branch: 'vigor',
    name: T('Кровь богатырская', 'Heroic Blood'),
    icon: 'icon-lifesteal',
    max: 5,
    cost: ladder(50),
    // вампиризм: доля урона уходит в лечение (общий потолок лечения от вампиризма — в GameScene)
    desc: (l) => T(`Вампиризм +${(l * 0.6).toLocaleString('ru-RU')}% урона`, `Lifesteal +${Math.round(l * 6) / 10}% of damage`),
    apply: (s, l) => (s.lifesteal += 0.006 * l),
  },
  // ---- Удаль ----
  { id: 'speed', branch: 'valor', name: T('Лёгкий шаг', 'Light Step'), icon: 'icon-speed', max: 5, cost: ladder(30), desc: (l) => T(`Скорость бега +${l * 3}%`, `Move speed +${l * 3}%`), apply: (s, l) => (s.speed *= 1 + 0.03 * l) },
  { id: 'xp', branch: 'valor', name: T('Смекалка', 'Wits'), icon: 'icon-mead', max: 5, cost: ladder(40), desc: (l) => T(`Опыт +${l * 5}%`, `XP +${l * 5}%`), apply: (s, l) => (s.xpMul += 0.05 * l) },
  // злато за забег (применяется при начислении, не к статам)
  { id: 'greed', branch: 'valor', name: T('Скопидом', 'Hoarder'), icon: 'icon-coin', max: 5, cost: ladder(35), desc: (l) => T(`Злата за забег +${l * 10}%`, `Gold per run +${l * 10}%`), apply: () => {} },
  { id: 'revive', branch: 'valor', name: T('Второе дыхание', 'Second Wind'), icon: 'item-feather', max: 1, cost: () => 450, desc: () => T('Встаёт сам раз за забег', 'Revive once per run'), apply: () => {} },
];

export function talentLevel(id: string): number {
  return Save.get().talents[id] ?? 0;
}

/** Можно ли вложиться в талант: не максимум, предыдущий в ветви открыт, хватает злата. */
export function canBuy(t: TalentDef): { ok: boolean; reason?: string } {
  const lvl = talentLevel(t.id);
  if (lvl >= t.max) return { ok: false, reason: 'максимум' };
  const branch = TALENTS.filter((x) => x.branch === t.branch);
  const i = branch.indexOf(t);
  if (i > 0 && talentLevel(branch[i - 1].id) < 1) return { ok: false, reason: 'сначала верхний' };
  if (Save.get().gold < t.cost(lvl)) return { ok: false, reason: 'мало злата' };
  return { ok: true };
}

export function buy(t: TalentDef): boolean {
  if (!canBuy(t).ok) return false;
  const lvl = talentLevel(t.id);
  Save.update((d) => {
    d.gold -= t.cost(lvl);
    d.talents[t.id] = lvl + 1;
  });
  return true;
}

/** Применить все таланты к статам богатыря (вызывается в начале пересчёта статов). */
export function applyTalents(s: Stats): void {
  for (const t of TALENTS) {
    const l = talentLevel(t.id);
    if (l > 0) t.apply(s, l);
  }
}

/** Злато за забег: за время, нечисть, боссов и пройденные главы. */
export function runGold(time: number, kills: number, bosses: number, chapters: number): number {
  return Math.floor(time / 10) + Math.floor(kills / 20) + bosses * 15 + chapters * 40;
}
