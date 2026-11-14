// Режим тестера (панель: бессмертие, скорость, переход по главам) — только в dev-режиме (npm run dev)
// и только с ?debug=1 в адресе. В сборках для площадок (Яндекс, CrazyGames) панели нет совсем.
// Было: доступен в любой сборке по ?debug=1 —
// export const DEBUG_ALLOWED = import.meta.env.DEV || new URLSearchParams(location.search).has('debug');
export const DEBUG_ALLOWED = import.meta.env.DEV && new URLSearchParams(location.search).has('debug');

/** Что включено в режиме тестера (переживает рестарт забега). */
export const debugState = { god: false, timeScale: 1, panel: true };
