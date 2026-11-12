import type { Stats } from '../entities/Player';
import type { GameScene } from '../scenes/GameScene';

export type AbilityId =
  | 'sword'
  | 'axes'
  | 'spear'
  | 'stomp'
  | 'flail'
  | 'whistle'
  | 'perun'
  | 'block'
  | 'mead'
  | 'lifesteal'
  | 'armor'
  | 'vitality'
  | 'speed'
  | 'might'
  | 'haste'
  | 'area'
  | 'amulet'
  | 'helix'
  | 'crit'
  | 'pie';

/** Активное оружие: живёт в сцене, само решает, когда бить. */
export interface Weapon {
  level: number;
  setLevel(level: number): void;
  update(dt: number): void;
  destroy(): void;
}

export interface AbilityDef {
  id: AbilityId;
  kind: 'weapon' | 'passive' | 'consumable';
  name: string;
  icon: string;
  maxLevel: number;
  /** desc[i] — что даёт переход на уровень i+1. */
  desc: string[];
  create?: (g: GameScene) => Weapon;
  /** Применить пассивку уровня level к статам (накопительно от базовых). */
  apply?: (s: Stats, level: number) => void;
}
