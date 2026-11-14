// Яндекс Игры: тонкая обёртка над SDK (подключается через Platform).
// Локально (localhost) SDK не грузится — все вызовы становятся заглушками, реклама за награду сразу «досмотрена».
// Чтобы проверить SDK локально, откройте игру с параметром ?ysdk=1.

import type { AdsOff, Backend, RewardResult } from './platform';
import { readLocal, withTimeout, writeLocal } from './storage';

/* eslint-disable @typescript-eslint/no-explicit-any */
type YSDK = any;

declare global {
  interface Window {
    YaGames?: { init(): Promise<YSDK> };
  }
}

function isLocal(): boolean {
  const h = location.hostname;
  const local = h === 'localhost' || h === '127.0.0.1' || h === '' || h.startsWith('192.168.');
  return local && !location.search.includes('ysdk=1');
}

export class YandexBackend implements Backend {
  readonly id = 'yandex' as const;
  private sdk: YSDK | null = null;

  async init(): Promise<void> {
    if (isLocal()) return;
    const ok = await withTimeout(
      new Promise<boolean>((resolve) => {
        const s = document.createElement('script');
        s.src = '/sdk.js';
        s.async = true;
        s.onload = () => resolve(true);
        s.onerror = () => resolve(false);
        document.head.appendChild(s);
      }),
      6000,
    );
    if (!ok || !window.YaGames) {
      console.warn('[YSDK] sdk.js not available');
      return;
    }
    try {
      this.sdk = await withTimeout(window.YaGames.init(), 6000);
    } catch (e) {
      console.warn('[YSDK] init failed', e);
    }
  }

  lang(): string | null {
    return this.sdk?.environment?.i18n?.lang ?? null;
  }

  device(): 'desktop' | 'mobile' | 'tablet' | null {
    const t = this.sdk?.deviceInfo?.type;
    return t === 'desktop' || t === 'mobile' || t === 'tablet' ? t : null;
  }

  loadingStart(): void {
    // у Яндекса отдельного «начали грузиться» нет
  }

  loadingStop(): void {
    this.sdk?.features?.LoadingAPI?.ready?.();
  }

  gameplayStart(): void {
    this.sdk?.features?.GameplayAPI?.start?.();
  }

  gameplayStop(): void {
    this.sdk?.features?.GameplayAPI?.stop?.();
  }

  happytime(): void {
    // у Яндекса такого события нет
  }

  /**
   * Облако Яндекса (у вошедших — на всех устройствах) или браузер — что свежее.
   * У гостей SDK хранит данные сам; локальная копия — на случай, если SDK недоступен.
   */
  async loadSave(key: string): Promise<Record<string, unknown> | null> {
    const local = readLocal(key);
    if (!this.sdk?.getPlayer) return local;
    try {
      const player = await this.sdk.getPlayer({ scopes: false });
      const cloud = (await player.getData()) as Record<string, unknown> | null;
      const ts = (x: Record<string, unknown> | null) => (typeof x?.ts === 'number' ? x.ts : -1);
      return ts(cloud) >= ts(local) ? cloud : local;
    } catch (e) {
      console.warn('[YSDK] getData failed', e);
      return local;
    }
  }

  writeSave(key: string, data: object): void {
    writeLocal(key, data);
    if (!this.sdk?.getPlayer) return;
    void this.sdk
      .getPlayer({ scopes: false })
      .then((player: YSDK) => player.setData(data, true))
      .catch((e: unknown) => console.warn('[YSDK] setData failed', e));
  }

  midgame(onStart: () => void): Promise<void> {
    return new Promise((resolve) => {
      if (!this.sdk?.adv) return resolve();
      this.sdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => onStart(),
          onClose: () => resolve(),
          onError: () => resolve(),
          onOffline: () => resolve(),
        },
      });
    });
  }

  rewarded(onStart: () => void): Promise<RewardResult> {
    return new Promise((resolve) => {
      if (!this.sdk?.adv) return resolve('ok'); // локально — сразу награда, удобно для отладки
      let rewarded = false;
      this.sdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => onStart(),
          onRewarded: () => {
            rewarded = true;
          },
          onClose: () => resolve(rewarded ? 'ok' : 'skipped'),
          onError: () => resolve('unavailable'),
        },
      });
    });
  }

  muted(): boolean {
    return false;
  }

  adsOff(): AdsOff {
    return null;
  }

  listen(): void {
    // Яндекс настроек звука и блокировщика не сообщает
  }
}
