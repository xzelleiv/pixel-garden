export enum Resource {
    Seeds = 'seeds',
}

export type Resources = {
    [key in Resource]?: number;
};

export interface PlotTile {
  id: number;
  hasTree: boolean;
  isWithered: boolean;
  seedsGenerated: number;
  isGolden: boolean;
  isDiamond: boolean;
  rareExpiresAt?: number;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface UpgradeDefinition {
    id: string;
    name: string;
    description: (level: number) => string;
    category: 'Tools' | 'Cultivation' | 'Expansion' | 'Automation';
    baseCost: number;
    costExponent: number;
    baseEffect: number;
    effectFormula: (level: number, base: number) => number;
    requiresMilestone?: number;
  perLevelMilestoneProgression?: boolean;
  levelMilestones?: Record<number, number>;
}

export type Upgrades = {
    [key: string]: UpgradeDefinition;
};

export interface MilestoneBonuses {
  gatherBonus: number;
}

export type MilestoneReward =
  | { type: 'gatherBonus'; amount: number; message: string }
  | { type: 'unlockUpgrade'; upgradeId: string; message: string };

export interface Preferences {
  reducedMotion: boolean;
  compactLogs: boolean;
  seasonTips: boolean;
  classicActionsUI: boolean;
  classicUpgradesUI: boolean;
  disableConfetti: boolean;
  disableParticles: boolean;
  effectsVolume: number;
}

export interface GameState {
  resources: Resources;
  upgrades: {
    [key: string]: { level: number };
  };
  plot: PlotTile[];
  treeLifespanSeeds: number;
  costs: {
    tree: number;
  };
  totalTreesPlanted: number;
  loggedMilestones: { [key: string]: boolean };
  notifiedAvailable: { [key: string]: boolean };
  currentSeason: Season;
  autoPlanterCooldown: number;
  autoShovelCooldown: number;
  seasonDuration: number;
  peakSeeds: number;
  preferences: Preferences;
  milestoneBonuses: MilestoneBonuses;
}

export type EventDefinition = {
    id: string;
    description: string;
    weight: number;
    apply: (gameState: GameState) => GameState;
  canTrigger?: (gameState: GameState) => boolean;
};