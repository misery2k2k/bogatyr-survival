import { T, tx } from '../i18n';
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

export const ABILITIES: AbilityDef[] = [
  // ---------------- Оружие (ближний бой) ----------------
  {
    id: 'sword',
    kind: 'weapon',
    name: T('Меч-кладенец', 'Kladenets Sword'),
    icon: 'icon-sword',
    maxLevel: 6,
    desc: [
      T('Широкий взмах по ближайшему врагу', 'A wide swing at the nearest foe'),
      T('Урон +4', 'Damage +4'),
      T('Замах шире и дальше', 'Wider, longer swing'),
      T('Замах быстрее', 'Faster swings'),
      T('Обратный взмах: бьёт и за спиной', 'Backswing: also hits behind you'),
      T('Урон +25%, замах ещё быстрее', 'Damage +25%, even faster swings'),
    ],
    create: (g) => new Sword(g),
  },
  {
    id: 'axes',
    kind: 'weapon',
    name: T('Вихрь секир', 'Axe Whirlwind'),
    icon: 'icon-axes',
    maxLevel: 6,
    desc: [
      T('Секира кружит вокруг богатыря', 'An axe circles around the hero'),
      T('Вторая секира', 'Second axe'),
      T('Больше урон и радиус', 'More damage and radius'),
      T('Третья секира', 'Third axe'),
      T('Кружат быстрее и бьют сильнее', 'Spin faster and hit harder'),
      T('Четвёртая секира', 'Fourth axe'),
    ],
    create: (g) => new Axes(g),
  },
  {
    id: 'spear',
    kind: 'weapon',
    name: T('Богатырское копьё', 'Hero\'s Spear'),
    icon: 'icon-spear',
    maxLevel: 6,
    desc: [
      T('Пронзающий выпад туда, куда идёшь', 'A piercing thrust where you\'re heading'),
      T('Больше урон и длина', 'More damage and reach'),
      T('Два копья веером', 'Two spears in a fan'),
      T('Выпад чаще', 'Thrusts more often'),
      T('Три копья веером', 'Three spears in a fan'),
      T('Урон и длина: богатырские', 'Heroic damage and reach'),
    ],
    create: (g) => new Spear(g),
  },
  {
    id: 'stomp',
    kind: 'weapon',
    name: T('Богатырский топот', 'Hero\'s Stomp'),
    icon: 'icon-stomp',
    maxLevel: 6,
    desc: [
      T('Удар оземь: урон и отбрасывание вокруг', 'Slam the ground: damage and knockback around you'),
      T('Больше урон и радиус', 'More damage and radius'),
      T('Ещё больше радиус', 'Even bigger radius'),
      T('Оглушённая нечисть замедляется', 'Stunned monsters are slowed'),
      T('Топот чаще и сильнее', 'Stomps more often and harder'),
      T('Земля ходуном: огромный радиус', 'Earthquake: huge radius'),
    ],
    create: (g) => new Stomp(g),
  },
  {
    id: 'flail',
    kind: 'weapon',
    name: T('Кистень', 'Flail'),
    icon: 'icon-flail',
    maxLevel: 6,
    desc: [
      T('Гиря на цепи описывает широкий круг и раскидывает нечисть', 'A weight on a chain sweeps a wide circle, scattering monsters'),
      T('Урон больше', 'More damage'),
      T('Круг шире', 'Wider circle'),
      T('Раскручивается чаще', 'Spins up more often'),
      T('Урон и круг больше', 'More damage and a bigger circle'),
      T('Две гири: второй круг вдогонку', 'Two weights: a second circle follows'),
    ],
    create: (g) => new Flail(g),
  },
  {
    id: 'whistle',
    kind: 'weapon',
    name: T('Соловьиный свист', 'Nightingale Whistle'),
    icon: 'icon-whistle',
    maxLevel: 6,
    desc: [
      T('Свист сбивает с ног всех впереди: урон, отброс и замедление', 'A whistle knocks down everyone ahead: damage, knockback and slow'),
      T('Свистит дальше', 'Reaches farther'),
      T('Конус шире, урон больше', 'Wider cone, more damage'),
      T('Свистит чаще', 'Whistles more often'),
      T('Дальше и сильнее', 'Farther and stronger'),
      T('Свист-ураган: огромный конус', 'Hurricane whistle: huge cone'),
    ],
    create: (g) => new Whistle(g),
  },
  {
    id: 'perun',
    kind: 'weapon',
    name: T('Гнев Перуна', 'Perun\'s Wrath'),
    icon: 'icon-perun',
    maxLevel: 6,
    desc: [
      T('Молния бьёт в нечисть рядом с богатырём', 'Lightning strikes monsters near the hero'),
      T('Урон больше', 'More damage'),
      T('Две молнии', 'Two bolts'),
      T('Бьёт чаще', 'Strikes more often'),
      T('Три молнии', 'Three bolts'),
      T('Гроза: четыре молнии и оглушение', 'Thunderstorm: four bolts and a stun'),
    ],
    create: (g) => new Perun(g),
  },

  // ---------------- Пассивки ----------------
  {
    id: 'lifesteal',
    kind: 'passive',
    name: T('Живая вода', 'Water of Life'),
    icon: 'icon-lifesteal',
    maxLevel: 5,
    desc: LIFESTEAL.map((v) => T(`Вампиризм: ${(v * 100).toLocaleString('ru-RU')}% урона лечит богатыря`, `Lifesteal: ${v * 100}% of damage heals the hero`)),
    apply: (s, l) => {
      s.lifesteal += LIFESTEAL[l - 1];
    },
  },
  {
    id: 'armor',
    kind: 'passive',
    name: T('Кольчуга', 'Chainmail'),
    icon: 'icon-armor',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, (_, i) => T(`Получаемый урон −${(i + 1) * 8}%`, `Damage taken −${(i + 1) * 8}%`)),
    apply: (s, l) => {
      s.armor += 0.08 * l;
    },
  },
  {
    id: 'vitality',
    kind: 'passive',
    name: T('Богатырское здоровье', 'Hero\'s Health'),
    icon: 'icon-vitality',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, () => T('+20 к здоровью', '+20 max health')),
    apply: (s, l) => {
      s.maxHp += 20 * l;
    },
  },
  {
    id: 'helix',
    kind: 'passive',
    name: T('Круговерть', 'Spinning Blade'),
    icon: 'icon-helix',
    maxLevel: 5,
    desc: HELIX.chance.map((c, i) =>
      i === 0
        ? T(
            `Бьёшь сам или бьют тебя — шанс ${pct(c)} крутануться и посечь всех вокруг. Удар, на который ответил вихрем, не проходит. +10 к здоровью`,
            `When you hit or get hit — ${pct(c)} chance to spin and cut everyone around. A blow answered by a spin doesn't land. +10 health`,
          )
        : T(`Шанс ${pct(c)}, урон ${HELIX.dmg[i]}, круг шире, +10 к здоровью`, `Chance ${pct(c)}, damage ${HELIX.dmg[i]}, wider circle, +10 health`),
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
    name: T('Богатырская затрещина', 'Mighty Smack'),
    icon: 'icon-crit',
    maxLevel: 5,
    desc: CRIT.chance.map((c, i) =>
      i === 0
        ? T(`Шанс ${pct(c)} влепить так, что нечисть отлетает: урон ×${ru(CRIT.mul[i])}`, `${pct(c)} chance to hit so hard monsters fly off: damage ×${CRIT.mul[i]}`)
        : T(`Шанс ${pct(c)}, урон ×${ru(CRIT.mul[i])}`, `Chance ${pct(c)}, damage ×${CRIT.mul[i]}`),
    ),
    apply: (s, l) => {
      s.critChance += CRIT.chance[l - 1];
      s.critMul = Math.max(s.critMul, CRIT.mul[l - 1]);
    },
  },
  {
    id: 'speed',
    kind: 'passive',
    name: T('Сапоги-скороходы', 'Seven-League Boots'),
    icon: 'icon-speed',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, (_, i) => T(`Скорость бега +${(i + 1) * 10}%`, `Move speed +${(i + 1) * 10}%`)),
    apply: (s, l) => {
      s.speed *= 1 + 0.1 * l;
    },
  },
  {
    id: 'might',
    kind: 'passive',
    name: T('Сила богатырская', 'Hero\'s Might'),
    icon: 'icon-might',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, (_, i) => T(`Урон всего оружия +${(i + 1) * 10}%`, `All weapon damage +${(i + 1) * 10}%`)),
    apply: (s, l) => {
      s.might += 0.1 * l;
    },
  },
  {
    id: 'haste',
    kind: 'passive',
    name: T('Удаль молодецкая', 'Youthful Daring'),
    icon: 'icon-haste',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, (_, i) => T(`Удары чаще: перезарядка −${(i + 1) * 8}%`, `Faster attacks: cooldowns −${(i + 1) * 8}%`)),
    apply: (s, l) => {
      s.haste *= 1 - 0.08 * l;
    },
  },
  {
    id: 'area',
    kind: 'passive',
    name: T('Размах плеча', 'Broad Swing'),
    icon: 'icon-area',
    maxLevel: 5,
    desc: Array.from({ length: 5 }, (_, i) => T(`Дальность и радиус ударов +${(i + 1) * 10}%`, `Attack reach and radius +${(i + 1) * 10}%`)),
    apply: (s, l) => {
      s.area += 0.1 * l;
    },
  },
  {
    id: 'block',
    kind: 'passive',
    name: T('Щит Святогора', 'Svyatogor\'s Shield'),
    icon: 'icon-block',
    maxLevel: 5,
    desc: BLOCK.map((v, i) => (i === 0 ? T(`Шанс ${pct(v)} принять удар на щит и не получить урона`, `${pct(v)} chance to block a blow and take no damage`) : T(`Шанс блока ${pct(v)}`, `Block chance ${pct(v)}`))),
    apply: (s, l) => {
      s.blockChance = BLOCK[l - 1];
    },
  },
  {
    id: 'mead',
    kind: 'passive',
    name: T('Медовуха', 'Mead'),
    icon: 'icon-mead',
    maxLevel: 5,
    desc: MEAD.map((v) => T(`Опыт за нечисть +${pct(v)}`, `XP from monsters +${pct(v)}`)),
    apply: (s, l) => {
      s.xpMul += MEAD[l - 1];
    },
  },
  {
    id: 'amulet',
    kind: 'passive',
    name: T('Оберег', 'Ward Charm'),
    icon: 'icon-amulet',
    maxLevel: 5,
    desc: AMULET_REGEN.map((v, i) => T(`${i === 0 ? 'Понемногу лечит' : 'Лечит'}: ${ru(v)} здоровья в секунду`, `${i === 0 ? 'Slowly heals' : 'Heals'} ${v} health per second`)),
    apply: (s, l) => {
      s.regen += AMULET_REGEN[l - 1];
    },
  },

  // ---------------- Расходник, когда всё прокачано ----------------
  {
    id: 'pie',
    kind: 'consumable',
    name: T('Пирожок с капустой', 'Cabbage Pie'),
    icon: 'icon-pie',
    maxLevel: Infinity,
    desc: [T('Восстанавливает 30% здоровья', 'Restores 30% health')],
  },
];

export const ABILITY_BY_ID = new Map<AbilityId, AbilityDef>(ABILITIES.map((a) => [a.id, a]));

export function abilityDesc(def: AbilityDef, nextLevel: number): string {
  const d = def.desc[Math.min(nextLevel, def.desc.length) - 1];
  return d ? tx(d) : '';
}

/** Число по-русски (дробная запятая) — для русских описаний. */
function ru(v: number): string {
  return v.toLocaleString('ru-RU');
}
