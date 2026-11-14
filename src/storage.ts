// localStorage без падений: в приватном режиме и в iframe он бывает недоступен — тогда живём в памяти.

export function readLocal(key: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function writeLocal(key: string, data: object): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // не сохранилось — не страшно
  }
}

/** Подгрузить внешний скрипт (SDK площадки); false — не загрузился за отведённое время. */
export function loadScript(src: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    s.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    document.head.appendChild(s);
  });
}

/** Промис с ограничением по времени: не успел — null. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((r) => window.setTimeout(() => r(null), ms))]);
}
