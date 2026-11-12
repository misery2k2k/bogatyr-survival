import Phaser from 'phaser';
import { getSettings, onSettings, updateSettings } from './settings';

export interface Track {
  id: string;
  title: string;
  author: string;
  license: string;
}

/**
 * Фоновая музыка. Список треков — assets/music/tracks.json; mp3 грузится лениво,
 * только выбранный, чтобы не тормозить старт игры. Звуковой менеджер у Phaser общий на игру.
 */
class MusicManager {
  tracks: Track[] = [];
  private game: Phaser.Game | null = null;
  private sound: Phaser.Sound.BaseSound | null = null;
  private playingId = '';
  private loading = '';

  /** Вызывается из меню: подгружает список и запускает выбранный трек. */
  init(scene: Phaser.Scene): void {
    if (this.game) return;
    this.game = scene.game;
    onSettings((s) => {
      this.applyVolume();
      if (s.track !== this.playingId) this.play(s.track);
    });
    fetch('assets/music/tracks.json')
      .then((r) => r.json() as Promise<Track[]>)
      .then((list) => {
        this.tracks = list;
        let id = getSettings().track;
        if (!list.some((t) => t.id === id) && list[0]) {
          id = list[0].id;
          updateSettings({ track: id });
        }
        this.play(id);
      })
      .catch(() => {
        /* без музыки играть тоже можно */
      });
  }

  current(): Track | undefined {
    return this.tracks.find((t) => t.id === (this.playingId || getSettings().track));
  }

  /** Следующий/предыдущий трек в списке. */
  step(dir: 1 | -1): void {
    if (this.tracks.length === 0) return;
    const i = this.tracks.findIndex((t) => t.id === getSettings().track);
    const next = this.tracks[(i + dir + this.tracks.length) % this.tracks.length];
    updateSettings({ track: next.id });
  }

  private play(id: string): void {
    const game = this.game;
    if (!game || !id) return;
    const key = `music-${id}`;
    if (game.cache.audio.exists(key)) {
      this.start(key, id);
      return;
    }
    if (this.loading === id) return;
    // Грузим загрузчиком активной сцены. Если сцена сменится посреди загрузки — ensure() повторит.
    const scene = game.scene.getScenes(true)[0];
    if (!scene) return;
    this.loading = id;
    scene.load.audio(key, `assets/music/${id}.mp3`);
    scene.load.once(`filecomplete-audio-${key}`, () => {
      if (this.loading === id) this.loading = '';
      if (getSettings().track === id) this.start(key, id);
    });
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (this.loading === id) this.loading = '';
    });
    scene.load.start();
  }

  /** Новая сцена стартовала — если музыка ещё не играет (загрузка прервалась), пробуем снова. */
  ensure(): void {
    if (!this.game || this.tracks.length === 0) return;
    if (this.playingId === getSettings().track && this.sound) return;
    this.loading = '';
    this.play(getSettings().track);
  }

  private start(key: string, id: string): void {
    const game = this.game!;
    this.sound?.stop();
    this.sound?.destroy();
    this.playingId = id;
    this.sound = game.sound.add(key, { loop: true, volume: this.volume() });
    const go = () => this.sound?.play();
    if (game.sound.locked) game.sound.once(Phaser.Sound.Events.UNLOCKED, go);
    else go();
  }

  private volume(): number {
    // Музыка тише звуков по умолчанию: громкость ползунка в квадрате — ухо так воспринимает ровнее
    const v = getSettings().music;
    return v * v * 0.8;
  }

  private applyVolume(): void {
    if (this.sound && 'setVolume' in this.sound) (this.sound as Phaser.Sound.WebAudioSound).setVolume(this.volume());
  }
}

export const Music = new MusicManager();
