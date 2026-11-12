# Ассеты и лицензии

Все сторонние ассеты разрешено использовать в коммерческих проектах.

| Что | Где в проекте | Источник | Лицензия |
|---|---|---|---|
| Зомби (мертвяк, кикимора, ратник) — перекрашены | `public/assets/sprites/zombies.*` | pzUH / GameArt2D — The Zombie Free Sprites, https://opengameart.org/content/the-zombie-free-sprites | CC0 |
| Эффекты: взмах, искра, дым, свечение, вихрь, вспышка | `public/assets/fx/` | Kenney — Particle Pack, https://opengameart.org/content/particle-pack-80-sprites | CC0 |
| Удары по нечисти, затрещина, удар по богатырю, рёв змея (смягчены фильтром) | `hit1–4.wav`, `crit.wav`, `hurt.wav`, `roar.wav` | qubodup — Punch и Impact, https://opengameart.org/content/punch , https://opengameart.org/content/impact | CC0 |
| Блок щитом, один из ударов (смягчены) | `block.wav`, `hit4.wav` | rubberduck — 75 CC0 breaking/falling/hit sfx, https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx | CC0 |
| Джинглы: новый уровень, смерть, пирожок (саксофон) | `levelup.wav`, `death.wav`, `pie.wav` | Kenney — 85 Short music jingles, https://opengameart.org/content/85-short-music-jingles | CC0 |
| Топот, клик интерфейса | `footstep09.ogg`, `click_002.ogg` | Kenney — 50 RPG sound effects / Interface Sounds (opengameart.org) | CC0 |
| Гром, поступь змея, «чвяк» нечисти | `explosion.ogg`, `slam_02.ogg`, `plop_01.ogg` | rubberduck — 100 CC0 SFX, https://opengameart.org/content/100-cc0-sfx | CC0 |
| Взмахи (меч, копьё, кистень, круговерть), свист, огонь, колокольчики душ | `swing/spear/flail/helix/whistle/fire.wav`, `soul0–7.wav` | синтезированы для проекта (`tools/make-soft-sfx.mjs`) | свои |
| Музыка: Dark Ritual (тишина по краям обрезана для бесшовного повтора) | `public/assets/music/dark-ritual.mp3` | Of Far Different Nature, https://opengameart.org/content/dark-ritual | CC BY 4.0 — автор указан в настройках игры |
| Шрифт заголовков Ruslan Display | `public/assets/fonts/` | Google Fonts | SIL OFL 1.1 (`OFL-RuslanDisplay.txt`) |
| Шрифт интерфейса Philosopher | `public/assets/fonts/` | Google Fonts | SIL OFL 1.1 (`OFL-Philosopher.txt`) |

Нарисованы для проекта (свои, без сторонних лицензий):
- богатырь и Змей Горыныч — SVG в `public/assets/hero/` и `public/assets/dragon/`;
- в `src/textures.ts` — трава, берёзы, ели, кусты, камни, пни, мухоморы, цветы, стог, плетень,
  камень на распутье, бревно, лужи нечисти, секира, копьё, гиря, молния, пирожок, сундуки,
  все иконки умений и 20 иконок предметов.

Исходники лежат в `raw-assets/`. `npm run assets` перекрашивает зомби, пакует атлас и копирует
эффекты, звуки и музыку в `public/assets/`.

Мягкие звуки (`raw-assets/sfx-soft/*.wav`) делает `tools/make-soft-sfx.mjs` из сэмплов в `raw-assets/sfx-src/`:
фильтр низких частот срезает резкий верх, хвост плавно гасится, громкость выравнивается.
Скрипту нужен браузер: `npm i --no-save puppeteer-core && node tools/make-soft-sfx.mjs`.
Рецепты (какой сэмпл, срез фильтра, громкость) — в начале скрипта, их удобно подкручивать. Папка `raw-assets/toon/` (старые персонажи Kenney) больше не используется.

Музыка под CC BY 4.0 — автора обязательно указывать; в настройках игры есть строка с авторами:
«Музыка: Of Far Different Nature — Dark Ritual (CC BY 4.0) · Зомби: GameArt2D · Звуки: Kenney, qubodup, rubberduck».
Если будешь добавлять трек под CC BY — автора обязательно указать в титрах.
