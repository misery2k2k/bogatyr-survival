// Площадка, на которой запущена игра: Яндекс Игры или CrazyGames.
// Игра обращается только к Platform — реклама, сохранения, события «игра идёт / пауза», язык, звук.
// Какая площадка — решает сборка: npm run build (Яндекс) или npm run build:cg (CrazyGames).
// В dev-режиме можно примерить другую: ?platform=crazygames в адресе.

import type Phaser from 'phaser';
import { CrazyGamesBackend } from './crazygames';
import { applyPlatformLang } from './i18n';
import { YandexBackend } from './yandex';

/** Чем кончилась реклама за награду: досмотрена / закрыта раньше / нет рекламы сейчас / реклама недоступна совсем. */
export type RewardResult = 'ok' | 'skipped' | 'unavailable' | 'blocked';
/** Почему реклама недоступна на весь сеанс: блокировщик или площадка её не показывает (пробный запуск). */
export type AdsOff = 'adblock' | 'disabled' | null;

/** Что умеет каждая площадка. */
export interface Backend {
  readonly id: 'yandex' | 'crazygames';
  /** Подключить SDK. Никогда не падает — без SDK игра работает как есть. */
  init(): Promise<void>;
  /** Язык площадки (ru, en-US…) или null. */
  lang(): string | null;
  /** Устройство по данным площадки или null (тогда смотрим на сенсорный экран). */
  device(): 'desktop' | 'mobile' | 'tablet' | null;
  loadingStart(): void;
  loadingStop(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** Праздник (победа над главным злом) — площадка может отметить его у себя. */
  happytime(): void;
  /** Сохранение с площадки (облако / модуль данных) или null. */
  loadSave(key: string): Promise<Record<string, unknown> | null>;
  writeSave(key: string, data: object): void;
  /** Полноэкранная реклама; onStart — реклама действительно началась (глушим звук). */
  midgame(onStart: () => void): Promise<void>;
  rewarded(onStart: () => void): Promise<RewardResult>;
  /** Звук выключен настройкой площадки — важнее громкости в игре. */
  muted(): boolean;
  adsOff(): AdsOff;
  /** Площадка сообщает: сменились её настройки (звук) или выяснилось, что рекламы не будет. */
  listen(fn: (what: 'mute' | 'ads') => void): void;
}

function pick(): Backend {
  const fromUrl = import.meta.env.DEV ? new URLSearchParams(location.search).get('platform') : null;
  const id = fromUrl ?? import.meta.env.VITE_PLATFORM ?? 'yandex';
  return id === 'crazygames' ? new CrazyGamesBackend() : new YandexBackend();
}

const backend = pick();
let sound: Phaser.Sound.BaseSoundManager | null = null;
let adPlaying = false;
let gameplay = false;
let loadingDone = false;
let initP: Promise<void> | null = null;
const adsListeners = new Set<() => void>();

/** Звук молчит, пока идёт реклама или если площадка его выключила. */
function applyMute(): void {
  if (sound) sound.mute = adPlaying || backend.muted();
}

const onAdStart = () => {
  adPlaying = true;
  applyMute();
};

export const Platform = {
  id: backend.id,

  init(): Promise<void> {
    initP ??= backend.init().then(() => {
      applyPlatformLang(backend.lang());
      if (!loadingDone) backend.loadingStart();
      backend.listen((what) => {
        applyMute();
        if (what === 'ads') for (const fn of adsListeners) fn();
      });
      applyMute();
    });
    return initP;
  },

  /** Звуковой менеджер игры — чтобы глушить его на время рекламы и по настройке площадки. */
  bindSound(s: Phaser.Sound.BaseSoundManager): void {
    sound = s;
    applyMute();
  },

  /** Игра загрузилась и ждёт игрока (титульный экран). */
  loadingReady(): void {
    if (loadingDone) return;
    loadingDone = true;
    void this.init().then(() => backend.loadingStop());
  },

  gameplayStart(): void {
    if (gameplay) return;
    gameplay = true;
    backend.gameplayStart();
  },

  gameplayStop(): void {
    if (!gameplay) return;
    gameplay = false;
    backend.gameplayStop();
  },

  happytime(): void {
    backend.happytime();
  },

  /** Телефон/планшет по данным площадки; null — площадка не сказала. */
  isMobile(): boolean | null {
    const d = backend.device();
    return d ? d !== 'desktop' : null;
  },

  /** Реклама недоступна на весь сеанс (блокировщик / пробный запуск) — кнопки «за рекламу» прячем. */
  get adsOff(): AdsOff {
    return backend.adsOff();
  },

  /** Подписка на «реклама стала недоступна»; возвращает отписку. */
  onAdsChange(fn: () => void): () => void {
    adsListeners.add(fn);
    return () => adsListeners.delete(fn);
  },

  loadSave(key: string): Promise<Record<string, unknown> | null> {
    return this.init().then(() => backend.loadSave(key));
  },

  writeSave(key: string, data: object): void {
    backend.writeSave(key, data);
  },

  /** Полноэкранная реклама на естественной паузе. Ошибка или нет рекламы — игра просто идёт дальше. */
  async midgame(): Promise<void> {
    if (backend.adsOff() === 'adblock') return;
    try {
      await backend.midgame(onAdStart);
    } finally {
      adPlaying = false;
      applyMute();
    }
  },

  /** Реклама за награду: награду даём, только если 'ok'. */
  async rewarded(): Promise<RewardResult> {
    if (backend.adsOff()) return 'blocked';
    try {
      return await backend.rewarded(onAdStart);
    } finally {
      adPlaying = false;
      applyMute();
    }
  },
};
