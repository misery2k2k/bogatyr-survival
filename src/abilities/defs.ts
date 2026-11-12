import type { AbilityDef, AbilityId } from './types';
import { Axes, Flail, Perun, Spear, Stomp, Sword, Whistle } from './weapons';

const LIFESTEAL = [0.02, 0.035, 0.05, 0.065, 0.08];
const AMULET_REGEN = [0.4, 0.8, 1.2, 1.6, 2.0];
const BLOCK = [0.06, 0.1, 0.14, 0.19, 0.25];
const MEAD = [0.1, 0.2, 0.3, 0.4, 0.5];
export const HELIX = {
  chance: [0.15, 0.18, 0.21, 0.24, 0.28],
  dmg: [22, 28, 35, 44, 55],
  radius: [110, 116, 124, 134, 148],
};
const CRIT = {
  chance: [0.08, 0.12, 0.16, 0.2, 0.25],
  mul: [2, 2.2, 2.4, 2.7, 3],
};

const pct = (v: number) => `${Math.round(v * 100)}%`;
const num = (v: number) => v.toLocaleString('ru-RU');

export const ABILITIES: AbilityDef[] = [
  // ---------------- Оружие (ближний бой) ----------------
  {
    id: 'sword',
    kind: 'weapon',
    name: 'Меч-кладенец',
    icon: 'icon-sword',
    maxLevel: 6,
    desc: [
      'Широкий взмах по ближайшему врагу',
      'Урон +4',
      'Замах шире и дальше',
      'Замах быстрее',
      'Обратный взмах: бьёт и за спиной',
      'Урон +25%, замах ещё быстрее',
    ],
    create: (g) => new Sword(g),
  },
  {
    id: 'axes',
    kind: 'weapon',
    name: 'Вихрь секир',
    icon: 'icon-axes',
    maxLevel: 6,
    desc: [
      'Секира кружит вокруг богатыря',
      'Вторая секира',
      'Больше урон и радиус',
      'Третья секира',
      'Кружат быстрее и бьют сильнее',
      'Четвёртая секира',
    ],
    create: (g) => new Axes(g),
  },
  {
    id: 'spear',
    kind: 'weapon',
    name: 'Богатырское копьё',
    icon: 'icon-spear',
    maxLevel: 6,
    desc: [
      'Пронзающий выпад туда, куда идёшь',
      'Больше урон и длина',
      'Два копья веером',
      'Выпад чаще',
      'Три копья веером',
      'Урон и длина: богатырские',
    ],
    create: (g) => new Spear(g),
  },
  {
    id: 'stomp',
    kind: 'weapon',
    name: 'Богатырский топот',
    icon: 'icon-stomp',
    maxLevel: 6,
    desc: [
      'Удар оземь: урон и отбрасывание вокруг',
      'Больше урон и радиус',
      'Ещё больше радиус',
      'Оглушённая нечисть замедляется',
      'Топот чаще и сильнее',
      'Земля ходуном: огромный радиус',
    ],
    create: (g) => new Stomp(g),
  },
  {
    id: 'flail',
    kind: 'weapon',
    name: 'Кистень',
    icon: 'icon-flail',
    maxLevel: 6,
    desc: [
      'Гиря на цепи описывает широкий круг и раскидывает нечисть',
      'Урон больше',
      'Круг шире',
      'Раскручивается чаще',
      'Урон и круг больше',
      'Две гири: второй круг вдогонку',
    ],
    create: (g) => new Flail(g),
  },
  {
    id: 'whistle',
    kind: 'weapon',
    name: 'Соловьиный свист',
    icon: 'icon-whistle',
    maxLevel: 6,
    desc: [
      'Свист сбивает с ног всех впереди: урон, отброс и замедление',
      'Свистит дальше',
      'Конус шире, урон больше',
      'Свистит чаще',
      'Дальше и сильнее',
      'Свист-ураган: огромный конус',
    ],
    create: (g) => new Whistle(g),
  },
  {
    id: 'perun',
    kind: 'weapon',
    name: 'Гнев Перуна',
    icon: 'icon-perun',
    maxLevel: 6,
    desc: [
      'Молния бьёт в нечисть рядом с богатырём',
      'Урон больше',
      'Две молнии',
      'Бьёт чаще',
      'Три молнии',
      'Гроза: четыре молнии и оглушение',
    ],
    create: (g) => new Perun(g),
  },

  // ---------------- Пассивки ----------------
  {
    id: 'lifesteal',
    kind: 'passive',
    name: 'Живая вода',
    icon: 'icon-lifesteal',
    maxLevel: 5,
    desc: LIFESTEAL.map((v, i) => `${i === 0 ? 'Вампиризм: ' : 'Вампиризм '}${(v * 100).toLocaleString('ru-RU')}% урона лечит богатыря`),
    apply: (s, l) => {
      s.lifesteal = LIFESTEAL[l - 1];
    },
  },
  {
    id: 'armor',
    kind: 'passive',
    name: 'Кольчуга',
    icon: 'icon-armor',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, (_, i) => `Получаемый урон −${(i + 1) * 8}%`),
    apply: (s, l) => {
      s.armor = 0.08 * l;
    },
  },
  {
    id: 'vitality',
    kind: 'passive',
    name: 'Богатырское здоровье',
    icon: 'icon-vitality',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, () => '+20 к здоровью'),
    apply: (s, l) => {
      s.maxHp += 20 * l;
    },
  },
  {
    id: 'helix',
    kind: 'passive',
    name: 'Круговерть',
    icon: 'icon-helix',
    maxLevel: 5,
    desc: HELIX.chance.map((c, i) =>
      i === 0
        ? `Бьёшь сам или бьют тебя — шанс ${pct(c)} крутануться и посечь всех вокруг. Удар, на который ответил вихрем, не проходит. +10 к здоровью`
        : `Шанс ${pct(c)}, урон ${HELIX.dmg[i]}, круг шире, +10 к здоровью`,
    ),
    apply: (s, l) => {
      s.helixChance = HELIX.chance[l - 1];
      s.helixDmg = HELIX.dmg[l - 1];
      s.helixRadius = HELIX.radius[l - 1];
      s.maxHp += 10 * l;
    },
  },
  {
    id: 'crit',
    kind: 'passive',
    name: 'Богатырская затрещина',
    icon: 'icon-crit',
    maxLevel: 5,
    desc: CRIT.chance.map((c, i) =>
      i === 0
        ? `Шанс ${pct(c)} влепить так, что нечисть отлетает: урон ×${num(CRIT.mul[i])}`
        : `Шанс ${pct(c)}, урон ×${num(CRIT.mul[i])}`,
    ),
    apply: (s, l) => {
      s.critChance = CRIT.chance[l - 1];
      s.critMul = CRIT.mul[l - 1];
    },
  },
  {
    id: 'speed',
    kind: 'passive',
    name: 'Сапоги-скороходы',
    icon: 'icon-speed',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, (_, i) => `Скорость бега +${(i + 1) * 10}%`),
    apply: (s, l) => {
      s.speed *= 1 + 0.1 * l;
    },
  },
  {
    id: 'might',
    kind: 'passive',
    name: 'Сила богатырская',
    icon: 'icon-might',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, (_, i) => `Урон всего оружия +${(i + 1) * 10}%`),
    apply: (s, l) => {
      s.might += 0.1 * l;
    },
  },
  {
    id: 'haste',
    kind: 'passive',
    name: 'Удаль молодецкая',
    icon: 'icon-haste',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, (_, i) => `Удары чаще: перезарядка −${(i + 1) * 8}%`),
    apply: (s, l) => {
      s.haste *= 1 - 0.08 * l;
    },
  },
  {
    id: 'area',
    kind: 'passive',
    name: 'Размах плеча',
    icon: 'icon-area',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, (_, i) => `Дальность и радиус ударов +${(i + 1) * 10}%`),
    apply: (s, l) => {
      s.area += 0.1 * l;
    },
  },
  {
    id: 'block',
    kind: 'passive',
    name: 'Щит Святогора',
    icon: 'icon-block',
    maxLevel: 5,
    desc: BLOCK.map((v, i) => (i === 0 ? `Шанс ${pct(v)} принять удар на щит и не получить урона` : `Шанс блока ${pct(v)}`)),
    apply: (s, l) => {
      s.blockChance = BLOCK[l - 1];
    },
  },
  {
    id: 'mead',
    kind: 'passive',
    name: 'Медовуха',
    icon: 'icon-mead',
    maxLevel: 5,
    desc: MEAD.map((v) => `Опыт за нечисть +${pct(v)}`),
    apply: (s, l) => {
      s.xpMul += MEAD[l - 1];
    },
  },
  {
    id: 'amulet',
    kind: 'passive',
    name: 'Оберег',
    icon: 'icon-amulet',
    maxLevel: 5,
    desc: AMULET_REGEN.map((v, i) => `${i === 0 ? 'Понемногу лечит' : 'Лечит'}: ${num(v)} здоровья в секунду`),
    apply: (s, l) => {
      s.regen += AMULET_REGEN[l - 1];
    },
  },

  // ---------------- Расходник, когда всё прокачано ----------------
  {
    id: 'pie',
    kind: 'consumable',
    name: 'Пирожок с капустой',
    icon: 'icon-pie',
    maxLevel: Infinity,
    desc: ['Восстанавливает 30% здоровья'],
  },
];

export const ABILITY_BY_ID = new Map<AbilityId, AbilityDef>(ABILITIES.map((a) => [a.id, a]));

export function abilityDesc(def: AbilityDef, nextLevel: number): string {
  return def.desc[Math.min(nextLevel, def.desc.length) - 1] ?? '';
}
