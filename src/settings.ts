// Настройки игрока: громкость музыки и звуков, выбранный трек. Хранятся в localStorage
// (если он недоступен — просто живут до перезагрузки).

export interface Settings {
  sfx: number;
}

const KEY = 'bogatyr-settings-v1';
const DEFAULTS: Settings = { sfx: 0.8 };

let current: Settings = load();
const listeners = new Set<(s: Settings) => void>();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // localStorage недоступен (приватный режим, iframe) — берём умолчания
  }
  return { ...DEFAULTS };
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // не сохранилось — не страшно
  }
  for (const fn of listeners) fn(current);
}

export function onSettings(fn: (s: Settings) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
