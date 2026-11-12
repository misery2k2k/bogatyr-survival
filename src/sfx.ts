// Звуки: ключ → файл в public/assets/audio (массив — несколько вариантов, играется случайный).
// WAV — мягкие версии, их делает tools/make-soft-sfx.mjs. Список синхронизирован с tools/build-assets.mjs.

export const SFX_FILES = {
  hit: ['hit1.wav', 'hit2.wav', 'hit3.wav', 'hit4.wav'],
  crit: 'crit.wav',
  hurt: 'hurt.wav',
  block: 'block.wav',
  swing: 'swing.wav',
  spear: 'spear.wav',
  flail: 'flail.wav',
  helix: 'helix.wav',
  whistle: 'whistle.wav',
  fire: 'fire.wav',
  roar: 'roar.wav',
  levelup: 'levelup.wav',
  death: 'death.wav',
  pie: 'pie.wav',
  stomp: 'footstep09.ogg',
  dstomp: 'slam_02.ogg',
  thunder: 'explosion.ogg',
  squish: 'plop_01.ogg',
  click: 'click_002.ogg',
  // Колокольчики душ: пентатоника вверх по серии убийств
  soul0: 'soul0.wav',
  soul1: 'soul1.wav',
  soul2: 'soul2.wav',
  soul3: 'soul3.wav',
  soul4: 'soul4.wav',
  soul5: 'soul5.wav',
  soul6: 'soul6.wav',
  soul7: 'soul7.wav',
} as const satisfies Record<string, string | readonly string[]>;

export type SfxKey = keyof typeof SFX_FILES;

/** Звуки с нотами/мелодией — их нельзя случайно подстраивать по высоте. */
export const SFX_TONAL = new Set<SfxKey>(['levelup', 'death', 'pie', 'soul0', 'soul1', 'soul2', 'soul3', 'soul4', 'soul5', 'soul6', 'soul7']);

/** Ключ в кэше Phaser: для звуков с вариантами — случайный из них. */
export function sfxCacheKey(key: SfxKey): string {
  const f = SFX_FILES[key];
  return Array.isArray(f) ? `${key}~${Math.floor(Math.random() * f.length)}` : key;
}

/** Все пары «ключ кэша → файл» для загрузки. */
export function sfxLoadList(): [string, string][] {
  const out: [string, string][] = [];
  for (const [key, f] of Object.entries(SFX_FILES)) {
    if (Array.isArray(f)) f.forEach((file, i) => out.push([`${key}~${i}`, file]));
    else out.push([key, f as string]);
  }
  return out;
}
