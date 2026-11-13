// Тонкая обёртка над Yandex Games SDK.
// Локально (localhost) SDK не грузится — все вызовы становятся заглушками.
// Чтобы проверить SDK локально, откройте игру с параметром ?ysdk=1.

/* eslint-disable @typescript-eslint/no-explicit-any */
type YSDK = any;

declare global {
  interface Window {
    YaGames?: { init(): Promise<YSDK> };
  }
}

let ysdk: YSDK | null = null;
let readyPromise: Promise<void> | null = null;
let loadingReadySent = false;
let gameplayActive = false;

function isLocal(): boolean {
  const h = location.hostname;
  const local = h === 'localhost' || h === '127.0.0.1' || h === '' || h.startsWith('192.168.');
  return local && !location.search.includes('ysdk=1');
}

export const Yandex = {
  /** Подгружает /sdk.js и инициализирует SDK. Никогда не падает — максимум работаем без SDK. */
  init(): Promise<void> {
    if (readyPromise) return readyPromise;
    readyPromise = new Promise<void>((resolve) => {
      if (isLocal()) return resolve();
      const done = () => resolve();
      const timer = window.setTimeout(done, 6000);
      const s = document.createElement('script');
      s.src = '/sdk.js';
      s.async = true;
      s.onload = () => {
        if (!window.YaGames) return done();
        window.YaGames.init()
          .then((sdk) => {
            ysdk = sdk;
            window.clearTimeout(timer);
            done();
          })
          .catch((e) => {
            console.warn('[YSDK] init failed', e);
            done();
          });
      };
      s.onerror = () => {
        console.warn('[YSDK] sdk.js not available');
        done();
      };
      document.head.appendChild(s);
    });
    return readyPromise;
  },

  get available(): boolean {
    return !!ysdk;
  },

  /** Язык из SDK (ru/en/tr...). */
  lang(): string {
    return ysdk?.environment?.i18n?.lang ?? 'ru';
  },

  /** Сообщить платформе, что игра загрузилась и готова к взаимодействию. */
  loadingReady(): void {
    if (loadingReadySent) return;
    loadingReadySent = true;
    void this.init().then(() => ysdk?.features?.LoadingAPI?.ready?.());
  },

  gameplayStart(): void {
    if (gameplayActive) return;
    gameplayActive = true;
    ysdk?.features?.GameplayAPI?.start?.();
  },

  gameplayStop(): void {
    if (!gameplayActive) return;
    gameplayActive = false;
    ysdk?.features?.GameplayAPI?.stop?.();
  },

  /**
   * Данные игрока из облака Яндекса (у вошедших — на всех устройствах, у гостей SDK хранит их сам).
   * null — SDK недоступен (локально) или ошибка.
   */
  async loadData(): Promise<Record<string, unknown> | null> {
    await this.init();
    if (!ysdk?.getPlayer) return null;
    try {
      const player = await ysdk.getPlayer({ scopes: false });
      return (await player.getData()) as Record<string, unknown>;
    } catch (e) {
      console.warn('[YSDK] getData failed', e);
      return null;
    }
  },

  async saveData(data: Record<string, unknown>): Promise<void> {
    await this.init();
    if (!ysdk?.getPlayer) return;
    try {
      const player = await ysdk.getPlayer({ scopes: false });
      await player.setData(data, true);
    } catch (e) {
      console.warn('[YSDK] setData failed', e);
    }
  },

  /** Вошёл ли игрок в аккаунт Яндекса (иначе прогресс живёт только на этом устройстве). */
  async isAuthorized(): Promise<boolean> {
    await this.init();
    if (!ysdk?.getPlayer) return false;
    try {
      const player = await ysdk.getPlayer({ scopes: false });
      return player.getMode?.() !== 'lite';
    } catch {
      return false;
    }
  },

  /** Предложить войти, чтобы прогресс не потерялся. */
  async askAuth(): Promise<boolean> {
    await this.init();
    if (!ysdk?.auth?.openAuthDialog) return false;
    try {
      await ysdk.auth.openAuthDialog();
      return true;
    } catch {
      return false;
    }
  },

  /** Полноэкранная реклама. onPause/onResume — заглушить звук и остановить игру. */
  showFullscreenAd(onPause: () => void, onResume: () => void): Promise<void> {
    return new Promise((resolve) => {
      if (!ysdk?.adv) return resolve();
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => onPause(),
          onClose: () => {
            onResume();
            resolve();
          },
          onError: () => {
            onResume();
            resolve();
          },
          onOffline: () => {
            onResume();
            resolve();
          },
        },
      });
    });
  },

  /** Реклама за вознаграждение. Возвращает true, если игрок досмотрел. */
  showRewardedAd(onPause: () => void, onResume: () => void): Promise<boolean> {
    return new Promise((resolve) => {
      if (!ysdk?.adv) return resolve(true); // локально — сразу награда, удобно для отладки
      let rewarded = false;
      ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => onPause(),
          onRewarded: () => {
            rewarded = true;
          },
          onClose: () => {
            onResume();
            resolve(rewarded);
          },
          onError: () => {
            onResume();
            resolve(false);
          },
        },
      });
    });
  },
};
