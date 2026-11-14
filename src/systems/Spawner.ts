import Phaser from 'phaser';
import { BIOMES, type BiomeDef } from '../biomes';
import { BOSS_TOAST } from '../bosses';
import { t, tx } from '../i18n';
import { MAX_ZOMBIES, ZOMBIES, type ZombieType } from '../config';
import type { GameScene } from '../scenes/GameScene';

/** Первый босс главы (с от её начала) и пауза после смерти босса до следующего (с). */
const FIRST_BOSS = 180;
const BOSS_GAP = 120;
/** Во сколько раз реже приходит нечисть, пока жив босс. */
const BOSS_CALM = 0.45;
/**
 * С какой минуты (по ожиданию) начинается каждая глава. Угроза считается не меньше, чем если бы богатырь
 * пришёл в главу вовремя: кто пробежал главы быстро (или через режим тестера), слабых врагов там не встретит.
 */
const CHAPTER_MIN = [0, 13, 23, 33, 43, 56];
/** Сколько «минут» добавляет каждый новый круг. */
const LAP_MIN = 66;


/**
 * Волны нечисти, орды, боссы. Нечисти немного, но она крепчает со временем и с уровнем богатыря:
 * ближнику нужно, чтобы из толпы можно было вырваться, а не чтобы его просто задавили числом.
 */
export class Spawner {
  private acc = 0;
  private nextHorde = 46;
  private bossIdx = 0;
  /** Когда придёт следующий босс; пока жив текущий — бесконечность. */
  private nextBoss = FIRST_BOSS;
  private bossAlive = false;
  /** Номер прилёта боссов (0 — ещё не было). С первого убитого в прилёте падает сундук. */
  bossWave = 0;
  /** Глава (индекс в BIOMES), круг (сколько раз прошли все главы), когда глава началась. */
  chapter = 0;
  lap = 0;
  chapterStart = 0;
  /** С какой главы начался забег и одолел ли Чернобога. */
  startChapter = 0;
  won = false;
  /** Передышка после перехода в новую главу. */
  private graceUntil = 0;

  get biome(): BiomeDef {
    return BIOMES[this.chapter];
  }

  constructor(private readonly g: GameScene) {}

  /** Минуты угрозы: время забега, но не меньше ожидаемого для главы и круга. */
  get minutes(): number {
    const real = this.g.elapsed / 60;
    const inChapter = (this.g.elapsed - this.chapterStart) / 60;
    return Math.max(real, (CHAPTER_MIN[this.chapter] ?? 0) + this.lap * LAP_MIN + inChapter);
  }

  /**
   * Множитель здоровья нечисти — только от времени (в начале мягко, к концу круче).
   * От уровня богатыря не зависит: прокачка должна давать перевес, а за «стояние» наказывают боссы.
   */
  get hpMul(): number {
    const m = this.minutes;
    // после 10-й минуты прокачанный богатырь уже сносит всё — нечисть крепчает быстрее; новый круг — ещё вдвое
    return (1 + m * 0.3 + m * m * 0.045 + Math.max(0, m - 10) * 0.9) * (1 + this.lap);
  }

  /** Множитель урона нечисти: к поздним главам растёт всё быстрее, иначе прокачанному богатырю никто не страшен. */
  get dmgMul(): number {
    const m = this.minutes;
    return (1 + m * 0.09 + Math.max(0, m - 12) ** 2 * 0.003 + (this.g.level - 1) * 0.012) * (1 + this.lap * 0.5);
  }

  /**
   * Здоровье боссов: растёт мягче, чем у нечисти, — под урон хорошей сборки к этому времени
   * (бой — около минуты, гибриды и Чернобог — дольше).
   */
  get bossHpMul(): number {
    const m = this.minutes;
    return (1 + m * 0.2 + m * m * 0.012) * (1 + this.lap);
  }

  /** Доля «богатырских» ударов боссов от здоровья богатыря: в лесу — меньше половины, на Дне Пекла — полностью. */
  get bossPctK(): number {
    return Math.min(1, 0.45 + 0.11 * this.chapter) + this.lap * 0.25;
  }

  /** Боссы поздних глав перезаряжают приёмы быстрее. */
  get bossAggro(): number {
    return Math.max(0.6, 1 - 0.05 * this.chapter - 0.1 * this.lap);
  }

  /** Сколько нечисти может быть разом: к поздней игре — больше. */
  get maxAlive(): number {
    return MAX_ZOMBIES + Math.min(80, Math.max(0, this.minutes - 8) * 10);
  }

  /** Половина диагонали видимой области + запас: дальше этого зомби считаются «отставшими». */
  get spawnRadius(): number {
    const v = this.g.viewRect();
    return Math.hypot(v.w, v.h) / 2 + 60;
  }

  update(dt: number): void {
    const t = this.g.elapsed;
    const m = this.minutes;
    // пока жив босс — нечисти меньше и орд нет: бой с боссом — главное, не толпа
    const boss = this.bossAlive;
    // зомби в секунду: меньше, чем раньше, но каждый крепче
    const rate = (0.6 + m * 0.95 + Math.min(m * m * 0.2, 3.5) + (this.g.level - 1) * 0.03) * this.waveFactor(t) * this.mercy() * (boss ? BOSS_CALM : 1);
    this.acc += t < this.graceUntil ? 0 : rate * dt;
    const cap = boss ? Math.round(this.maxAlive * 0.6) : this.maxAlive;
    while (this.acc >= 1) {
      this.acc -= 1;
      if (this.g.aliveZombies < cap) this.spawnAt(this.pickType(t), this.ringPoint());
    }
    if (t >= this.nextHorde) {
      this.nextHorde += 60;
      if (!boss) this.horde(Math.round(16 + m * 4));
    }
    // Боссы по очереди: следующий — через BOSS_GAP после того, как пал предыдущий
    const alive = this.g.bossesAlive();
    if (this.bossAlive && !alive) {
      if (this.bossIdx >= this.biome.bosses.length) {
        // все боссы главы повержены — дальше новая глава
        this.nextChapter(t);
      } else {
        this.nextBoss = t + BOSS_GAP;
      }
    }
    this.bossAlive = alive;
    if (!alive && t >= this.nextBoss) this.spawnBosses();
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
    const kind = this.biome.bosses[this.bossIdx];
    // картинки босса ещё грузятся (слабая сеть) — подождём пару секунд
    if (!['gorynych', 'tugarin', 'fused'].includes(kind) && !this.g.bosses.ready(kind)) {
      this.nextBoss = this.g.elapsed + 2;
      return;
    }
    this.bossIdx++;
    this.nextBoss = Infinity;
    this.bossAlive = true;
    this.bossWave++;
    // боссы крепчают со временем медленнее обычной нечисти (круг уже учтён в hpMul)
    const hp = this.bossHpMul;
    const pt = this.ringPoint();
    this.g.bus.emit('toast', tx(BOSS_TOAST[kind]));
    this.g.spawnBoss(kind, pt.x, pt.y, hp);
  }

  /** Режим тестера: следующий босс прямо сейчас (если никого нет). */
  forceBoss(): void {
    if (!this.g.bossesAlive()) this.nextBoss = this.g.elapsed;
  }

  /** Режим тестера: сразу следующая глава. */
  forceChapter(): void {
    this.bossAlive = false;
    this.nextChapter(this.g.elapsed);
  }

  /** Переход в следующую главу. После Дна Пекла (Чернобог повержен) — победа, забег окончен. */
  private nextChapter(t: number): void {
    if (this.chapter + 1 >= BIOMES.length) {
      this.won = true;
      this.nextBoss = Infinity;
      this.g.victory();
      return;
    }
    this.chapter++;
    this.bossIdx = 0;
    this.chapterStart = t;
    this.graceUntil = t + 6;
    this.nextHorde = Math.max(this.nextHorde, t + 40);
    this.nextBoss = t + FIRST_BOSS;
    this.g.enterChapter(this.biome, this.lap);
  }

  /** Начать забег сразу с главы k (выбор в меню): нечисть и боссы этой главы, угроза — как если бы дошёл сам. */
  startAt(k: number): void {
    this.chapter = k;
    this.startChapter = k;
    this.chapterStart = 0;
  }

  /** Сколько глав пройдено в этом забеге (для злата). */
  get chaptersCleared(): number {
    return this.chapter - this.startChapter + (this.won ? 1 : 0);
  }

  /** Стартовая пачка, чтобы бой начался сразу. */
  opening(): void {
    const main = ZOMBIES[this.biome.horde[0]];
    for (let i = 0; i < 5; i++) this.spawnAt(this.loaded(main) ? main : ZOMBIES.walker, this.ringPoint());
  }

  /** Случайная нечисть из набора текущей главы (с учётом того, с какой секунды главы она приходит). */
  private pickType(t: number): ZombieType {
    const since = t - this.chapterStart;
    // нечисть, чьи картинки ещё не загрузились, пока не приходит; стрелков на поле — не больше предела
    const shooters = this.countShooters();
    const pool = this.biome.enemies.filter(
      (e) => since >= (e.from ?? 0) && this.loaded(ZOMBIES[e.key]) && (ZOMBIES[e.key].ai !== 'archer' || shooters < this.maxShooters),
    );
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    for (const e of pool) {
      r -= e.weight;
      if (r <= 0) return ZOMBIES[e.key];
    }
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
    // с третьей главы изредка приходит «лютый» — крупный, красный, толстый, почти не отлетает
    if (!type.heavy && Math.random() < this.champChance) type = this.champion(type);
    // здоровяки и так толстые — их здоровье растёт со временем медленнее остальных
    const hp = type.heavy ? 1 + (this.hpMul - 1) * 0.7 : this.hpMul;
    this.g.spawnZombie(type, pos.x, pos.y, hp * this.startK, this.dmgMul * this.startK);
  }

  /**
   * Мягкий старт: первые полминуты нечисть заметно слабее и к концу первой минуты приходит в норму —
   * чтобы начало было бодрым, но не таким, что новичка сразу задавят.
   */
  private get startK(): number {
    if (this.lap > 0 || this.chapter > 0) return 1;
    return Math.min(1, 0.55 + 0.45 * (this.g.elapsed / 60));
  }

  /** Доля «лютых» среди нечисти: с Выжженной земли — растёт с каждой главой и кругом. */
  get champChance(): number {
    return Math.max(0, this.chapter - 1) * 0.012 + this.lap * 0.03;
  }

  private champs = new Map<string, ZombieType>();

  /** «Лютый» вариант нечисти: в восемь раз толще, бьёт вдвое, почти не отлетает. */
  private champion(t: ZombieType): ZombieType {
    let c = this.champs.get(t.key);
    if (!c) {
      const r = ((t.tint >> 16) & 255) / 255, g = ((t.tint >> 8) & 255) / 255, b = (t.tint & 255) / 255;
      const tint = (Math.round(255 * r) << 16) | (Math.round(150 * g) << 8) | Math.round(140 * b);
      c = { ...t, hp: t.hp * 8, damage: t.damage * 2, scale: t.scale * 1.3, radius: Math.round(t.radius * 1.25), speed: t.speed * 1.08, knockbackResist: 0.95, tint, xp: t.xp * 10, heavy: true, elite: true };
      this.champs.set(t.key, c);
    }
    return c;
  }

  /** Орда: дуга в 250° — с одной стороны остаётся проход, чтобы ближник мог вырваться. */
  private horde(n: number): void {
    this.g.bus.emit('toast', t('toast.horde'));
    const start = Math.random() * Math.PI * 2;
    const arc = Phaser.Math.DegToRad(250);
    for (let i = 0; i < n; i++) {
      if (this.g.aliveZombies >= this.maxAlive) break;
      const a = start + (i / Math.max(1, n - 1)) * arc;
      const [main, heavy] = this.biome.horde.map((k) => ZOMBIES[k]);
      const pick = i % 10 === 5 && this.g.elapsed > 150 && this.loaded(heavy) ? heavy : this.loaded(main) ? main : ZOMBIES.walker;
      this.spawnAt(pick, this.ringPoint(a));
    }
  }

  /** Сколько стрелков может быть на поле разом (с боссом — вдвое меньше): больше — уже не увернуться. */
  private get maxShooters(): number {
    const n = 5 + this.chapter;
    return this.bossAlive ? Math.ceil(n / 2) : n;
  }

  private countShooters(): number {
    let n = 0;
    for (const z of this.g.zombies) if (z.active && !z.dead && z.ztype.ai === 'archer') n++;
    return n;
  }

  /** Картинки нечисти уже загружены (атласы глав грузятся фоном). */
  private loaded(t: ZombieType | undefined): boolean {
    return !!t && this.g.anims.exists(`${t.anim}-walk`);
  }
}
