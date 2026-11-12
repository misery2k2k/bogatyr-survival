// Перекраска зомби GameArt2D (CC0) под Русь: современная одежда → деревенская.
// Правило получает HSV пикселя и флаг «это обувь» (по положению в кадре),
// возвращает новый [h, s, v] или null (пиксель не трогаем).

export function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

export function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

const isRed = (h) => h >= 340 || h <= 14;

/**
 * Мертвяк: красная футболка → холщовая рубаха, джинсы → бурые порты, кеды → лапти с онучами.
 * Язык (розовый, s < 0.74) не трогаем.
 */
export function male(h, s, v, foot) {
  if (foot) {
    if (s < 0.2 && v > 0.45) return [44, 0.42, v * 0.82]; // белая резина → лыко
    if (isRed(h) && s >= 0.6) return [24, 0.55, v * 0.5]; // красные полосы → оборы
  }
  if (isRed(h) && s >= 0.74 && v >= 0.3) return [38, 0.22, Math.min(1, v * 0.95 + 0.08)];
  if (h >= 195 && h <= 250 && s >= 0.45) return [28, 0.42, v * 0.7];
  return null;
}

/** Кикимора: розовые волосы → болотная тина. */
export function female(h, s, v) {
  if (h >= 300 && h <= 352 && s >= 0.3 && v >= 0.45) return [80 + (s - 0.6) * 16, Math.min(1, s * 0.6), v * 0.62];
  return null;
}
