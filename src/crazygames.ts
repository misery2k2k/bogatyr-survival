// CrazyGames: обёртка над HTML5 SDK v3 (подключается через Platform).
// Документация: https://docs.crazygames.com/sdk/intro/
// На localhost SDK работает в режиме «local»: вместо рекламы — заглушка-оверлей.
//
// Что требует площадка и как это сделано:
// - gameplayStart/Stop на каждой паузе, loadingStart/Stop вокруг загрузки;
// - прогресс — только через модуль данных (Data), не через localStorage;
// - настройка площадки muteAudio важнее громкости в игре;
// - при блокировщике рекламы игра работает, а кнопки «за рекламу» прячутся с пояснением.

import type { AdsOff, Backend, RewardResult } from './platform';
import { loadScript, readLocal, withTimeout, writeLocal } from './storage';

/* eslint-disable @typescript-eslint/no-explicit-any */
type CGSDK = any;

declare global {
  interface Window {
    CrazyGames?: { SDK: CGSDK };
  }
}

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

export class CrazyGamesBackend implements Backend {
  readonly id = 'crazygames' as const;
  private sdk: CGSDK | null = null;
  private off: AdsOff = null;
  /** Модуль данных выключен (не отмечен при загрузке игры) — тогда сохраняемся в браузере. */
  private dataOff = false;
  private notify: ((what: 'mute' | 'ads') => void) | null = null;

  async init(): Promise<void> {
    try {
      // в сборке для CrazyGames SDK подключён в index.html; в dev-режиме — подгружаем сами
      if (!window.CrazyGames?.SDK && !(await loadScript(SDK_URL, 8000))) {
        console.warn('[CrazyGames] SDK script not available');
        this.off = 'disabled';
        return;
      }
      const sdk = window.CrazyGames?.SDK;
      if (!sdk) return;
      const done = await withTimeout(sdk.init().then(() => true), 8000);
      if (!done || sdk.environment === 'disabled') {
        console.warn('[CrazyGames] SDK disabled here');
        this.off = 'disabled';
        return;
      }
      this.sdk = sdk;
      sdk.game.addSettingsChangeListener(() => this.notify?.('mute'));
      // блокировщик рекламы: игра идёт, просто без наград за рекламу
      void sdk.ad
        .hasAdblock()
        .then((blocked: boolean) => blocked && this.setOff('adblock'))
        .catch(() => undefined);
    } catch (e) {
      console.warn('[CrazyGames] SDK init failed', e);
      this.off = 'disabled';
    }
  }

  private setOff(why: Exclude<AdsOff, null>): void {
    if (this.off) return;
    this.off = why;
    this.notify?.('ads');
  }

  private call(fn: (sdk: CGSDK) => void): void {
    if (!this.sdk) return;
    try {
      fn(this.sdk);
    } catch (e) {
      console.warn('[CrazyGames]', e);
    }
  }

  lang(): string | null {
    return this.sdk?.user?.systemInfo?.locale ?? null;
  }

  device(): 'desktop' | 'mobile' | 'tablet' | null {
    const t = this.sdk?.user?.systemInfo?.device?.type;
    return t === 'desktop' || t === 'mobile' || t === 'tablet' ? t : null;
  }

  loadingStart(): void {
    this.call((sdk) => sdk.game.loadingStart());
  }

  loadingStop(): void {
    this.call((sdk) => sdk.game.loadingStop());
  }

  gameplayStart(): void {
    this.call((sdk) => sdk.game.gameplayStart());
  }

  gameplayStop(): void {
    this.call((sdk) => sdk.game.gameplayStop());
  }

  happytime(): void {
    this.call((sdk) => sdk.game.happytime());
  }

  /** Модуль данных: у гостей — в браузере (SDK сам), у вошедших — в аккаунте CrazyGames. */
  async loadSave(key: string): Promise<Record<string, unknown> | null> {
    if (this.sdk && !this.dataOff) {
      try {
        const raw = this.sdk.data.getItem(key) as string | null;
        if (raw) return JSON.parse(raw) as Record<string, unknown>;
      } catch (e) {
        console.warn('[CrazyGames] data module unavailable, saving locally', e);
        this.dataOff = true;
      }
    }
    // первый запуск с модулем данных (или он выключен) — берём, что есть в браузере
    return readLocal(key);
  }

  writeSave(key: string, data: object): void {
    if (this.sdk && !this.dataOff) {
      try {
        this.sdk.data.setItem(key, JSON.stringify(data));
        return;
      } catch (e) {
        console.warn('[CrazyGames] data module unavailable, saving locally', e);
        this.dataOff = true;
      }
    }
    writeLocal(key, data);
  }

  midgame(onStart: () => void): Promise<void> {
    return new Promise((resolve) => {
      if (!this.sdk) return resolve();
      try {
        this.sdk.ad.requestAd('midgame', {
          adStarted: () => onStart(),
          adFinished: () => resolve(),
          adError: (e: { code?: string }) => {
            if (e?.code === 'adblock') this.setOff('adblock');
            resolve();
          },
        });
      } catch {
        resolve();
      }
    });
  }

  rewarded(onStart: () => void): Promise<RewardResult> {
    return new Promise((resolve) => {
      if (!this.sdk) return resolve('blocked');
      try {
        this.sdk.ad.requestAd('rewarded', {
          adStarted: () => onStart(),
          adFinished: () => resolve('ok'),
          adError: (e: { code?: string }) => {
            if (e?.code === 'adblock') {
              this.setOff('adblock');
              resolve('blocked');
            } else if (e?.code === 'adsDisabled') {
              // пробный запуск (Basic Launch) или режим без рекламы — до конца сеанса её не будет
              this.setOff('disabled');
              resolve('blocked');
            } else resolve('unavailable'); // нет рекламы прямо сейчас / слишком часто
          },
        });
      } catch {
        resolve('unavailable');
      }
    });
  }

  muted(): boolean {
    return !!this.sdk?.game?.settings?.muteAudio;
  }

  adsOff(): AdsOff {
    return this.off;
  }

  listen(fn: (what: 'mute' | 'ads') => void): void {
    this.notify = fn;
  }
}
