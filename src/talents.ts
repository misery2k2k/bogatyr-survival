import type { Stats } from './entities/Player';
import { Save } from './save';

/** Ветви древа талантов. Внутри ветви следующий талант открывается, когда вложен хоть один уровень в предыдущий. */
export const BRANCHES = [
  { id: 'might', name: 'Сила' },
  { id: 'vigor', name: 'Стойкость' },
  { id: 'valor', name: 'Удаль' },
] as const;

export type BranchId = (typeof BRANCHES)[number]['id'];

export interface TalentDef {
  id: string;
  branch: BranchId;
  name: string;
  icon: string;
  max: number;
  /** Цена следующего уровня (lvl — текущий уровень). */
  cost: (lvl: number) => number;
  /** Что даёт уровень lvl — для подписи. */
  desc: (lvl: number) => string;
  apply: (s: Stats, lvl: number) => void;
}

const ladder = (base: number) => (lvl: number) => Math.round(base * (1 + lvl * 0.9 + lvl * lvl * 0.25));

export const TALENTS: TalentDef[] = [
  // ---- Сила ----
  { id: 'dmg', branch: 'might', name: 'Богатырская сила', icon: 'icon-might', max: 5, cost: ladder(30), desc: (l) => `Урон +${l * 5}%`, apply: (s, l) => (s.might += 0.05 * l) },
  { id: 'haste', branch: 'might', name: 'Скорая рука', icon: 'icon-haste', max: 5, cost: ladder(40), desc: (l) => `Удары чаще на ${l * 3}%`, apply: (s, l) => (s.haste *= 1 - 0.03 * l) },
  {
    id: 'crit',
    branch: 'might',
    name: 'Тяжёлая рука',
    icon: 'icon-crit',
    max: 5,
    cost: ladder(55),
    desc: (l) => `Шанс затрещины +${l * 2}%`,
    apply: (s, l) => {
      s.critChance += 0.02 * l;
      if (l > 0) s.critMul = Math.max(s.critMul, 2);
    },
  },
  // ---- Стойкость ----
  { id: 'hp', branch: 'vigor', name: 'Крепкое здоровье', icon: 'icon-vitality', max: 5, cost: ladder(30), desc: (l) => `+${l * 10} к здоровью`, apply: (s, l) => (s.maxHp += 10 * l) },
  { id: 'armor', branch: 'vigor', name: 'Закалка', icon: 'icon-armor', max: 5, cost: ladder(40), desc: (l) => `Получаемый урон −${l * 2}%`, apply: (s, l) => (s.armor += 0.02 * l) },
  { id: 'regen', branch: 'vigor', name: 'Живучесть', icon: 'icon-amulet', max: 5, cost: ladder(55), desc: (l) => `Лечение +${(l * 0.2).toLocaleString('ru-RU')} в секунду`, apply: (s, l) => (s.regen += 0.2 * l) },
  // ---- Удаль ----
  { id: 'speed', branch: 'valor', name: 'Лёгкий шаг', icon: 'icon-speed', max: 5, cost: ladder(30), desc: (l) => `Скорость бега +${l * 3}%`, apply: (s, l) => (s.speed *= 1 + 0.03 * l) },
  { id: 'xp', branch: 'valor', name: 'Смекалка', icon: 'icon-mead', max: 5, cost: ladder(40), desc: (l) => `Опыт +${l * 5}%`, apply: (s, l) => (s.xpMul += 0.05 * l) },
  { id: 'revive', branch: 'valor', name: 'Второе дыхание', icon: 'icon-lifesteal', max: 1, cost: () => 450, desc: () => 'Раз за забег встаёт сам, без рекламы', apply: () => {} },
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
