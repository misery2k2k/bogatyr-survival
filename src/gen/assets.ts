// Сгенерировано tools/build-mobs.mjs — не править руками.

/** Атласы нечисти: страницы (для справки) и вес. */
export const MOB_ATLASES: Record<string, { pages: string[]; kb: number }> = {
 "mobs-common": {
  "pages": [
   "2048x2048"
  ],
  "kb": 2456
 },
 "mobs-forest": {
  "pages": [
   "2048x2048"
  ],
  "kb": 2715
 },
 "mobs-cursed": {
  "pages": [
   "2048x2048"
  ],
  "kb": 2740
 },
 "mobs-scorched": {
  "pages": [
   "2048x1024"
  ],
  "kb": 973
 },
 "mobs-frozen": {
  "pages": [
   "2048x2048"
  ],
  "kb": 2022
 },
 "mobs-hell": {
  "pages": [
   "2048x2048",
   "2048x1024"
  ],
  "kb": 3125
 },
 "mobs-hell2": {
  "pages": [
   "2048x2048"
  ],
  "kb": 2154
 }
};

/** Нечисть на готовых спрайтах: атлас, рост фигуры в атласе (px), точка опоры, число кадров анимаций. */
export const MOB_SPRITES: Record<string, { atlas: string; figure: number; origin: [number, number]; anims: Record<string, number> }> = {
 "wolf": {
  "atlas": "mobs-common",
  "figure": 120,
  "origin": [
   0.4985,
   0.9538
  ],
  "anims": {
   "walk": 8,
   "attack": 8,
   "idle": 8,
   "dead": 8
  }
 },
 "upyr": {
  "atlas": "mobs-common",
  "figure": 130,
  "origin": [
   0.5002,
   0.876
  ],
  "anims": {
   "walk": 12,
   "attack": 10,
   "dead": 10
  }
 },
 "skel": {
  "atlas": "mobs-common",
  "figure": 140,
  "origin": [
   0.4992,
   0.9305
  ],
  "anims": {
   "walk": 10,
   "attack": 8,
   "dead": 8
  }
 },
 "archer": {
  "atlas": "mobs-common",
  "figure": 140,
  "origin": [
   0.501,
   0.7786
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 6
  }
 },
 "razboinik": {
  "atlas": "mobs-common",
  "figure": 120,
  "origin": [
   0.5003,
   0.9686
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10
  }
 },
 "ghost": {
  "atlas": "mobs-common",
  "figure": 90,
  "origin": [
   0.5002,
   0.8139
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10
  }
 },
 "leshy": {
  "atlas": "mobs-forest",
  "figure": 220,
  "origin": [
   0.4998,
   0.9766
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "hurt": 6
  }
 },
 "treant": {
  "atlas": "mobs-forest",
  "figure": 200,
  "origin": [
   0.5001,
   0.9668
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "hurt": 6
  }
 },
 "koschei": {
  "atlas": "mobs-cursed",
  "figure": 240,
  "origin": [
   0.5004,
   0.936
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "slam": 10,
   "idle": 6,
   "dead": 7
  }
 },
 "solovey": {
  "atlas": "mobs-cursed",
  "figure": 220,
  "origin": [
   0.4992,
   0.9371
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10,
   "jump": 10,
   "idle": 8
  }
 },
 "mage": {
  "atlas": "mobs-scorched",
  "figure": 210,
  "origin": [
   0.4996,
   0.6867
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "idle": 6,
   "dead": 7
  }
 },
 "karachun": {
  "atlas": "mobs-frozen",
  "figure": 220,
  "origin": [
   0.4987,
   0.9235
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10,
   "idle": 8
  }
 },
 "likho": {
  "atlas": "mobs-frozen",
  "figure": 202,
  "origin": [
   0.5005,
   0.8908
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10,
   "idle": 8
  }
 },
 "strazh": {
  "atlas": "mobs-frozen",
  "figure": 125,
  "origin": [
   0.4999,
   0.9398
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10
  }
 },
 "imp": {
  "atlas": "mobs-hell",
  "figure": 110,
  "origin": [
   0.5015,
   0.9009
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10
  }
 },
 "chortik": {
  "atlas": "mobs-hell",
  "figure": 110,
  "origin": [
   0.5014,
   0.8832
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10
  }
 },
 "rogach": {
  "atlas": "mobs-hell",
  "figure": 140,
  "origin": [
   0.5008,
   0.9414
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10
  }
 },
 "anchutka": {
  "atlas": "mobs-hell",
  "figure": 192,
  "origin": [
   0.4995,
   0.8864
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10,
   "jump": 10
  }
 },
 "viy": {
  "atlas": "mobs-hell",
  "figure": 221,
  "origin": [
   0.4995,
   0.9116
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10
  }
 },
 "pek": {
  "atlas": "mobs-hell",
  "figure": 235,
  "origin": [
   0.5002,
   0.8411
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10
  }
 },
 "niy": {
  "atlas": "mobs-hell2",
  "figure": 240,
  "origin": [
   0.5006,
   0.8731
  ],
  "anims": {
   "walk": 12,
   "attack": 10,
   "cast": 10,
   "dead": 10
  }
 },
 "chernobog": {
  "atlas": "mobs-hell2",
  "figure": 248,
  "origin": [
   0.4994,
   0.8871
  ],
  "anims": {
   "walk": 10,
   "attack": 10,
   "dead": 10
  }
 }
};

/** Декор глав (кадры атласа 'decor'): пикселей атласа на мировой пиксель. */
export const DECOR_RES: Record<string, number> = {
 "c-tree": 1.406,
 "c-deadbush": 1.85,
 "c-bones": 2,
 "c-tomb": 1.528,
 "c-cross": 1.462,
 "c-bush": 2,
 "c-bush2": 2,
 "c-shroom": 1.864,
 "c-shroom2": 2,
 "s-tree": 2,
 "s-tree2": 2,
 "s-tree3": 2,
 "s-ctree": 1.513,
 "s-bramble": 2,
 "s-bramble2": 2,
 "s-rock": 2,
 "s-rock2": 2,
 "s-tumble": 2,
 "s-skull": 2,
 "s-burnt": 1.676,
 "s-burnt2": 2,
 "s-bones": 2,
 "f-crystal": 1.217,
 "f-crystal2": 1.4,
 "h-glow": 2,
 "h-volcano": 1.226,
 "h-flame": 2,
 "h-flame2": 2,
 "h-rock": 1.667,
 "h-rock2": 1.7,
 "h-spikes": 2,
 "f-tree": 1.406,
 "f-tree2": 2,
 "f-ctree": 1.513,
 "f-bramble": 2,
 "f-rock": 2,
 "f-bush": 1.85,
 "f-bones": 2,
 "h-lava": 1,
 "h-lava2": 1
};
