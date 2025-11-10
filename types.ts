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
}

export type Upgrades = {
    [key: string]: UpgradeDefinition;
};

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
}

export type EventDefinition = {
    id: string;
    description: string;
    weight: number;
    apply: (gameState: GameState) => GameState;
};