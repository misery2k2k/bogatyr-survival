import { getSettings, updateSettings } from './settings';

/**
 * Языки игры. Для CrazyGames английский обязателен; язык берётся так:
 * ?lang=ru|en в адресе → выбор игрока в настройках → язык площадки (SDK) → язык браузера → английский.
 */
export type Lang = 'ru' | 'en';
export const LANGS: Lang[] = ['ru', 'en'];

/** Текст на всех языках — так описаны умения, предметы, боссы, главы (рядом с цифрами, к которым относятся). */
export interface Text {
  ru: string;
  en: string;
}

export const T = (ru: string, en: string): Text => ({ ru, en });

function urlLang(): Lang | null {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    return q === 'ru' || q === 'en' ? q : null;
  } catch {
    return null;
  }
}

function browserLang(): Lang {
  const nav = (typeof navigator !== 'undefined' ? navigator.language || '' : '').toLowerCase();
  // русскоязычным (и соседям, кто обычно читает по-русски) — русский, остальным — английский
  return /^(ru|uk|be|kk)/.test(nav) ? 'ru' : 'en';
}

let lang: Lang = urlLang() ?? getSettings().lang ?? browserLang();

export function getLang(): Lang {
  return lang;
}

/** Выбор игрока (в настройках) — запоминается. */
export function setLang(l: Lang): void {
  lang = l;
  updateSettings({ lang: l });
  document.documentElement.lang = l;
  document.title = t('doc.title');
}

/** Язык площадки (из SDK): действует, если игрок сам язык не выбирал и в адресе его нет. */
export function applyPlatformLang(code: string | null | undefined): void {
  if (urlLang() || getSettings().lang || !code) return;
  lang = /^(ru|uk|be|kk)/i.test(code) ? 'ru' : 'en';
}

/** Текст на текущем языке (строка — как есть). */
export function tx(v: Text | string): string {
  return typeof v === 'string' ? v : (v[lang] ?? v.en);
}

/** Строка интерфейса по ключу; {name} заменяется на vars.name. */
export function t(key: StrKey, vars?: Record<string, string | number>): string {
  let s = tx(STR[key]);
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Число по правилам языка (дробная запятая/точка). */
export function num(v: number): string {
  return v.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US');
}

/** Склонение «злато» не нужно (несклоняемое в наших фразах), а вот единицы — да: 1 предмет / 2 предмета / 5 предметов. */
export function plural(n: number, one: Text, few: Text, many: Text): string {
  if (lang === 'en') return tx(n === 1 ? one : many);
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return tx(one);
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return tx(few);
  return tx(many);
}

/** Все строки интерфейса. */
const STR = {
  // ---- меню ----
  'doc.title': T('Богатырь против нечисти', 'Bogatyr vs the Unclean Horde'),
  'menu.title': T('Богатырь', 'Bogatyr'),
  'menu.subtitle': T('против нечисти', 'vs the Unclean Horde'),
  'menu.tap': T('Коснись, чтобы начать', 'Tap to start'),
  'menu.click': T('Нажми, чтобы начать', 'Click to start'),
  'menu.hintTouch': T('Веди пальцем — богатырь идёт, бьёт сам. Пирожки лечат.', 'Drag to move — the hero attacks on his own. Pies heal.'),
  'menu.hintKeys': T('WASD / стрелки — идти. Бьёт сам. Пирожки лечат.', 'WASD / arrows to move. Attacks are automatic. Pies heal.'),
  'menu.talents': T('Древо талантов', 'Talent Tree'),
  'menu.gift': T('Подарок дня: +{n}', 'Daily gift: +{n}'),
  'menu.ad': T('реклама', 'watch an ad'),
  'menu.bless': T('Благословение', 'Blessing'),
  'menu.blessSub': T('редкий предмет · реклама или злато', 'rare item · ad or gold'),
  'menu.blessSubDone': T('благословение · с начала забега', 'blessing · from the start'),
  'bless.desc': T('Редкий, дивный или былинный предмет — у богатыря с первой минуты забега.', 'A rare, epic or legendary item — the hero has it from the very first minute of the run.'),
  'bless.ad': T('Смотреть рекламу', 'Watch an ad'),
  'bless.gold': T('За {n} злата', 'For {n} gold'),
  'bless.have': T('Злата у тебя: {n}', 'Your gold: {n}'),
  'bless.close': T('Закрыть', 'Close'),
  'bless.got': T('Благословение получено!', 'You are blessed!'),
  'bless.gotSub': T('Предмет будет у богатыря с начала забега', 'The hero starts the next run with this item'),
  'bless.ok': T('Отлично', 'Great'),
  'menu.fromStart': T('С самого начала', 'From the very beginning'),
  'menu.startHere': T('Начать отсюда — богатырь придёт с {lvl} уровнем', 'Start here — the hero arrives at level {lvl}'),
  'menu.loading': T('Готовим главу…', 'Preparing the chapter…'),

  // ---- бой: интерфейс ----
  'hud.level': T('Ур. {n}', 'Lv. {n}'),
  'hud.kills': T('Сражено: {n}', 'Slain: {n}'),
  'hud.rage': T('БУЙСТВО  {n}', 'RAMPAGE  {n}'),

  // ---- новый уровень ----
  'lvl.title': T('Новый уровень!', 'Level up!'),
  'lvl.prep': T('Подготовка к бою', 'Prepare for battle'),
  'lvl.prepLeft': T('Выбери умение — осталось {left} из {total}', 'Choose a skill — {left} of {total} left'),
  'lvl.restRandom': T('Остальное — случайно', 'Pick the rest at random'),
  'lvl.rage': T('Буйство на 20 с (реклама)', 'Rampage for 20 s (ad)'),
  'lvl.rageIn': T('Буйство — через {t}', 'Rampage in {t}'),
  'lvl.reroll': T('Другие умения (реклама)', 'Other skills (ad)'),
  'lvl.rerollIn': T('Другие умения — через {t}', 'Other skills in {t}'),
  'card.treat': T('Угощение', 'Treat'),
  'card.new': T('Новое!', 'New!'),
  'card.lvl': T('Ур. {n}', 'Lv. {n}'),
  'card.weapon': T('оружие', 'weapon'),
  'card.skill': T('умение', 'skill'),

  // ---- сундук ----
  'chest.title': T('Сундук!', 'Chest!'),
  'chest.take': T('Взять', 'Take'),
  'chest.reroll': T('Другой предмет (реклама)', 'Another item (ad)'),

  // ---- поражение / победа ----
  'over.revive': T('Живая вода: воскреснуть (реклама)', 'Water of Life: revive (ad)'),
  'over.reviveGold': T('Воскреснуть за {n} злата', 'Revive for {n} gold'),
  'over.noGold': T('Не хватает злата: нужно {n}, есть {have}', 'Not enough gold: need {n}, you have {have}'),
  'ad.later': T('Реклама сейчас недоступна — попробуй позже', 'No ad available right now — try again later'),
  'ad.offAdblock': T('Реклама заблокирована — награды за рекламу недоступны', 'Ads are blocked — ad rewards are unavailable'),
  'ad.offDisabled': T('Награды за рекламу сейчас недоступны', 'Ad rewards are unavailable right now'),
  'over.double': T('Получить +{x2} злата вместо +{x1} (реклама)', 'Get +{x2} gold instead of +{x1} (ad)'),
  'over.again': T('Снова в бой', 'Fight again'),
  'over.menu': T('В главное меню', 'Main menu'),
  'over.win': T('Победа!', 'Victory!'),
  'over.lose': T('Богатырь пал…', 'The hero has fallen…'),
  'over.winTime': T('Чернобог повержен за {t}', 'Chernobog defeated in {t}'),
  'over.time': T('Продержался: {t}', 'Survived: {t}'),
  'over.kills': T('Сражено нечисти: {n}', 'Monsters slain: {n}'),
  'over.level': T('Уровень: {n}', 'Level: {n}'),
  'over.gold': T('Злато за забег: +{n}  (всего {total})', 'Gold this run: +{n}  (total {total})'),
  'over.goldX2': T('Злато за забег: +{n}, удвоено  (всего {total})', 'Gold this run: +{n}, doubled  (total {total})'),

  // ---- настройки ----
  'set.title': T('Настройки', 'Settings'),
  'set.sound': T('Звуки', 'Sound'),
  'set.lang': T('Язык', 'Language'),
  'set.continue': T('Продолжить', 'Continue'),
  'set.menu': T('В главное меню', 'Main menu'),
  'set.menuConfirm': T('Выйти? Нажми ещё раз', 'Quit? Tap again'),
  'set.credits': T(
    'Нечисть: GameArt2D, sonild, Segel (CC0), CraftPix.net 2D Game Assets (OGA-BY 3.0). Земли: Drummyfish, rubberduck, pzUH, Tio Aimar, Bevouliin (CC0), Dakal и Althaj (CC BY 3.0), LudicArts — Franco Giachetti (CC BY 4.0). Звуки: Kenney, qubodup, rubberduck (CC0).',
    'Monsters: GameArt2D, sonild, Segel (CC0), CraftPix.net 2D Game Assets (OGA-BY 3.0). Lands: Drummyfish, rubberduck, pzUH, Tio Aimar, Bevouliin (CC0), Dakal and Althaj (CC BY 3.0), LudicArts — Franco Giachetti (CC BY 4.0). Sounds: Kenney, qubodup, rubberduck (CC0).',
  ),

  // ---- древо талантов ----
  'tal.title': T('Древо талантов', 'Talent Tree'),
  'tal.gold': T('{n} злата', '{n} gold'),
  'tal.done': T('Готово', 'Done'),
  'tal.max': T('МАКС', 'MAX'),
  'tal.locked': T('закрыто', 'locked'),

  // ---- всплывающие надписи ----
  'toast.blessing': T('Благословение: {item}', 'Blessing: {item}'),
  'toast.rageOver': T('Буйство прошло', 'Rampage is over'),
  'toast.rage': T('Буйство богатырское!', 'Heroic rampage!'),
  'toast.lowHp': T('Мало здоровья — съешь пирожок!', 'Low health — eat a pie!'),
  'toast.chestForest': T('Где-то в лесу сундук!', 'A chest somewhere in the forest!'),
  'toast.chestNear': T('Где-то рядом сундук!', 'A chest somewhere nearby!'),
  'toast.defeated': T('{name} повержен!', '{name} defeated!'),
  'toast.feather': T('Перо Жар-птицы подняло богатыря!', 'The Firebird Feather revived the hero!'),
  'toast.secondWind': T('Второе дыхание!', 'Second wind!'),
  'toast.pie': T('Пирожок! Подбери — он лечит', 'A pie! Pick it up — it heals'),
  'toast.victory': T('Чернобог повержен! Нечисть побеждена!', 'Chernobog has fallen! The horde is beaten!'),
  'toast.horde': T('Нечисть наступает!', 'The horde is coming!'),
  'toast.lids': T('Поднимите мне веки!', 'Lift up my eyelids!'),
  'toast.curse': T('Печать Нави: лечение не действует!', 'Seal of Nav: healing is blocked!'),
  'toast.willRise': T('{name} ещё встанет!', '{name} will rise again!'),
  'toast.rises': T('{name} встаёт!', '{name} rises!'),
  'pie.label': T('Пирожок — лечит!\n▼', 'Pie — heals!\n▼'),

  // ---- цифры над богатырём ----
  'fx.block': T('Блок!', 'Block!'),
  'fx.miss': T('Мимо!', 'Miss!'),
  'fx.parry': T('Отбил!', 'Parried!'),
  'fx.alatyr': T('Алатырь!', 'Alatyr!'),
  'fx.invuln': T('Неуязвим!', 'Invulnerable!'),
  'fx.stunned': T('Оглушён!', 'Stunned!'),
  'fx.rooted': T('Опутан!', 'Rooted!'),
  'fx.curse': T('Печать Нави!', 'Seal of Nav!'),
} satisfies Record<string, Text>;

export type StrKey = keyof typeof STR;
