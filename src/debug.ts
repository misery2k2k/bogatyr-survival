// Режим тестера: доступен в dev-сборке (npm run dev) и по параметру ?debug=1 в адресе.
export const DEBUG_ALLOWED = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');

/** Что включено в режиме тестера (переживает рестарт забега). */
export const debugState = { god: false, timeScale: 1, panel: true };
