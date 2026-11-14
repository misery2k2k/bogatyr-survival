import Phaser from 'phaser';
import { DPR, ZOMBIES } from './config';
import { BIOMES } from './biomes';
import { BOSSES } from './bosses';
import { DEBUG_ALLOWED } from './debug';
import { LazyAssets } from './mobs';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { UIScene } from './scenes/UIScene';
import { Platform } from './platform';
import { getLang, t } from './i18n';

// площадка подключается сразу; язык известен после неё — подписываем вкладку на нём
void Platform.init().then(() => {
  document.documentElement.lang = getLang();
  document.title = t('doc.title');
});

// Рисуем в физических пикселях (чётко на телефонах), а CSS-размер canvas = размер окна.
const size = () => ({ w: Math.round(window.innerWidth * DPR), h: Math.round(window.innerHeight * DPR) });
const { w, h } = size();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#16210f',
  width: w,
  height: h,
  scale: {
    mode: Phaser.Scale.NONE,
    zoom: 1 / DPR,
  },
  disableContextMenu: true,
  render: { antialias: true, powerPreference: 'high-performance', mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
  input: { activePointers: 2 },
  scene: [BootScene, MenuScene, GameScene, UIScene],
});

// звук глушится на время рекламы и по настройке площадки
Platform.bindSound(game.sound);

// iOS может «уронить» звук (звонок, сворачивание) — поднимаем его по первому же касанию
const resumeAudio = () => {
  const ctx = (game.sound as unknown as { context?: AudioContext }).context;
  if (ctx && ctx.state === 'suspended') void ctx.resume();
};
window.addEventListener('pointerup', resumeAudio);
window.addEventListener('touchend', resumeAudio);

window.addEventListener('resize', () => {
  const { w, h } = size();
  game.scale.resize(w, h);
});

// Для отладки из консоли
(window as unknown as { game: Phaser.Game }).game = game;
// Режим тестера: реестры нечисти, боссов, глав и загрузчик — для проверок из консоли и автотестов
if (DEBUG_ALLOWED) (window as unknown as { dbg: object }).dbg = { ZOMBIES, BOSSES, BIOMES, LazyAssets };
