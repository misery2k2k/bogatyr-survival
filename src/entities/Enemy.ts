/** Общие свойства любой нечисти, по которой бьёт оружие (зомби и Змей Горыныч). */
export interface EnemyKind {
  key: string;
  name: string;
  /** Опыт за убийство (начисляется сразу). */
  xp: number;
  scale: number;
  knockbackResist: number;
}

export interface Enemy {
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  /** true — повержен (или в пуле), в бою не участвует. */
  dead: boolean;
  kbx: number;
  kby: number;
  slowT: number;
  /** Усталость от отброса: пока > 0, новые толчки слабее (иначе стену из оружия не пробить). */
  kbTired: number;
  /** Время последнего попадания от каждого оружия (для «тикающих» атак). */
  lastHit: Record<string, number>;
  ztype: EnemyKind;
  /** Высота фигуры в мире — для цифр урона и эффектов. */
  readonly figureH: number;
  readonly flipX: boolean;
  flash(): void;
}
