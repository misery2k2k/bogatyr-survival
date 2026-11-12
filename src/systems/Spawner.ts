import Phaser from 'phaser';
import { MAX_ZOMBIES, ZOMBIES, type ZombieType } from '../config';
import type { GameScene } from '../scenes/GameScene';

type BossKind = 'gorynych' | 'tugarin' | 'duo' | 'fused';

/** Первые прилёты боссов (с), дальше — по кругу каждые BOSS_EVERY секунд и всё сильнее. */
const BOSS_PLAN: { t: number; kind: BossKind }[] = [
  { t: 180, kind: 'gorynych' },
  { t: 300, kind: 'tugarin' },
  { t: 450, kind: 'duo' },
  { t: 600, kind: 'fused' },
];
const BOSS_EVERY = 150;
const BOSS_CYCLE: BossKind[] = ['gorynych', 'tugarin', 'duo', 'fused'];

const BOSS_TOAST: Record<BossKind, string> = {
  gorynych: 'Змей Горыныч летит!',
  tugarin: 'Тугарин Змеевич идёт!',
  duo: 'Тугарин и Горыныч заодно!',
  fused: 'Тугаро-Горыныч!!!',
};

/**
 * Волны нечисти, орды, боссы. Нечисти немного, но она крепчает со временем и с уровнем богатыря:
 * ближнику нужно, чтобы из толпы можно было вырваться, а не чтобы его просто задавили числом.
 */
export class Spawner {
  private acc = 0;
  private nextHorde = 46;
  private lullShown = -1;
  private bossIdx = 0;
  private nextBoss = BOSS_PLAN[0].t;
  /** Номер прилёта боссов (0 — ещё не было). С первого убитого в прилёте падает сундук. */
  bossWave = 0;

  constructor(private readonly g: GameScene) {}

  private get minutes(): number {
    return this.g.elapsed / 60;
  }

  /**
   * Множитель здоровья нечисти — только от времени (в начале мягко, к концу круче).
   * От уровня богатыря не зависит: прокачка должна давать перевес, а за «стояние» наказывают боссы.
   */
  get hpMul(): number {
    const m = this.minutes;
    return 1 + m * 0.3 + m * m * 0.045;
  }

  /** Множитель урона нечисти. */
  get dmgMul(): number {
    return 1 + this.minutes * 0.09 + (this.g.level - 1) * 0.012;
  }

  /** Половина диагонали видимой области + запас: дальше этого зомби считаются «отставшими». */
  get spawnRadius(): number {
    const v = this.g.viewRect();
    return Math.hypot(v.w, v.h) / 2 + 60;
  }

  update(dt: number): void {
    const t = this.g.elapsed;
    const m = this.minutes;
    // зомби в секунду: меньше, чем раньше, но каждый крепче
    const rate = (0.6 + m * 0.95 + Math.min(m * m * 0.2, 3.5) + (this.g.level - 1) * 0.03) * this.waveFactor(t) * this.mercy();
    this.acc += rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      if (this.g.aliveZombies < MAX_ZOMBIES) this.spawnAt(this.pickType(t), this.ringPoint());
    }
    if (t >= this.nextHorde) {
      this.nextHorde += 60;
      this.horde(Math.round(16 + m * 4));
    }
    const cycle = Math.floor(t / 60);
    if (t % 60 >= 50 && this.lullShown !== cycle) {
      this.lullShown = cycle;
      this.g.bus.emit('toast', 'Затишье — переведи дух');
    }
    if (t >= this.nextBoss) this.spawnBosses();
  }

  /** Ритм волны (цикл 60 с): обычный натиск → нарастание → орда на 46-й → затишье с 50-й по 60-ю. */
  private waveFactor(t: number): number {
    const c = t % 60;
    if (c >= 50) return 0.12;
    if (c >= 38 && t > 60) return 1.3;
    return 1;
  }

  /** Пощада: когда богатырю худо, нечисть прибывает реже — есть шанс отбиться и выйти из толпы. */
  private mercy(): number {
    const p = this.g.player;
    const k = p.hp / p.stats.maxHp;
    return k < 0.5 ? 0.45 + k : 1;
  }

  private spawnBosses(): void {
    const idx = this.bossIdx++;
    const kind = idx < BOSS_PLAN.length ? BOSS_PLAN[idx].kind : BOSS_CYCLE[(idx - BOSS_PLAN.length) % BOSS_CYCLE.length];
    this.nextBoss = idx + 1 < BOSS_PLAN.length ? BOSS_PLAN[idx + 1].t : this.g.elapsed + BOSS_EVERY;
    this.bossWave++;
    // после первого круга боссы приходят по двое и крепче
    const extra = idx >= BOSS_PLAN.length ? 1 + Math.floor((idx - BOSS_PLAN.length) / BOSS_CYCLE.length) : 0;
    // боссы крепчают со временем медленнее обычной нечисти, но с каждым кругом — по-новой
    const hp = (1 + (this.hpMul - 1) * 0.6) * (1 + extra * 0.25);
    const a0 = Math.random() * Math.PI * 2;
    const at = (k: number, n: number) => this.ringPoint(a0 + (k / Math.max(1, n)) * Math.PI * 2);
    this.g.bus.emit('toast', BOSS_TOAST[kind]);
    if (kind === 'gorynych') {
      const n = 1 + Math.min(extra, 2);
      for (let k = 0; k < n; k++) this.g.spawnDragon(at(k, n).x, at(k, n).y, hp);
    } else if (kind === 'tugarin') {
      const n = 1 + Math.min(extra, 2);
      for (let k = 0; k < n; k++) this.g.spawnTugarin(at(k, n).x, at(k, n).y, hp);
    } else if (kind === 'duo') {
      this.g.spawnDragon(at(0, 2).x, at(0, 2).y, hp);
      this.g.spawnTugarin(at(1, 2).x, at(1, 2).y, hp);
    } else {
      this.g.spawnDragon(at(0, 1).x, at(0, 1).y, hp, true);
    }
  }

  /** Стартовая пачка, чтобы бой начался сразу. */
  opening(): void {
    for (let i = 0; i < 5; i++) this.spawnAt(ZOMBIES.walker, this.ringPoint());
  }

  private pickType(t: number): ZombieType {
    const r = Math.random();
    const brute = Phaser.Math.Clamp((t - 120) / 600, 0, 0.12);
    const runner = Phaser.Math.Clamp((t - 35) / 180, 0, 0.32);
    if (r < brute) return ZOMBIES.brute;
    if (r < brute + runner) return ZOMBIES.runner;
    return ZOMBIES.walker;
  }

  /** Точка сразу за краем экрана в направлении angle (от центра камеры). */
  ringPoint(angle = Math.random() * Math.PI * 2): { x: number; y: number } {
    const v = this.g.viewRect();
    const c = Math.cos(angle), s = Math.sin(angle);
    const hw = v.w / 2 + 50, hh = v.h / 2 + 70;
    const r = Math.min(hw / Math.max(Math.abs(c), 1e-3), hh / Math.max(Math.abs(s), 1e-3)) + Math.random() * 40;
    return { x: v.cx + c * r, y: v.cy + s * r };
  }

  private spawnAt(type: ZombieType, pos: { x: number; y: number }): void {
    // ратники и так толстые — их здоровье растёт со временем медленнее остальных
    const hp = type.key === 'brute' ? 1 + (this.hpMul - 1) * 0.7 : this.hpMul;
    this.g.spawnZombie(type, pos.x, pos.y, hp, this.dmgMul);
  }

  /** Орда: дуга в 250° — с одной стороны остаётся проход, чтобы ближник мог вырваться. */
  private horde(n: number): void {
    this.g.bus.emit('toast', 'Нечисть наступает!');
    const start = Math.random() * Math.PI * 2;
    const arc = Phaser.Math.DegToRad(250);
    for (let i = 0; i < n; i++) {
      if (this.g.aliveZombies >= MAX_ZOMBIES) break;
      const a = start + (i / Math.max(1, n - 1)) * arc;
      this.spawnAt(i % 10 === 5 && this.g.elapsed > 150 ? ZOMBIES.brute : ZOMBIES.walker, this.ringPoint(a));
    }
  }
}
