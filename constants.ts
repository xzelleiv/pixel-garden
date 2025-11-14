// FIX: import all necessary types from the corrected types.ts file.
import { GameState, Resource, Upgrades, PlotTile, Season, EventDefinition } from './types';

export const INITIAL_PLOT_SIZE = 16;
export const TREE_LIFESPAN_SEEDS = 60;
export const PLANTING_MILESTONES = [1, 100, 500, 1000, 3000, 4000, 5000, 7000, 10000];
export const SEASON_DURATION = 300; // 5 minutes

export const SEASON_TEXTURES: Record<Season, { tree: string; withered?: string }> = {
    spring: {
        tree: 'https://tinyurl.com/4ur44chr',
    },
    summer: {
        tree: 'https://tinyurl.com/4fun7b8r',
        withered: 'https://tinyurl.com/2wsrp3my'
    },
    autumn: {
        tree: 'https://tinyurl.com/tv3ue2kd', 
    },
    winter: {
        tree: 'https://tinyurl.com/2f45puk8', 
    }
};

export const SEASON_MULTIPLIERS: Record<Season, number> = {
    spring: 5,
    summer: 2,
    autumn: 3,
    winter: 1,
};

export const EVENTS: EventDefinition[] = [
    {
        id: 'bountifulHarvest',
        description: "You found a stash of seeds.",
        weight: 1,
        apply: (gs) => {
            const healthyTrees = gs.plot.filter(t => t.hasTree && !t.isWithered).length;
            const bonus = 10 + (healthyTrees * 5);
            gs.resources.seeds += bonus;
            return gs;
        }
    },
    {
        id: 'diamondSapling',
        description: "An diamond sapling appears! It produces seeds at a vastly increased rate.",
        weight: 0.1,
        apply: (gs) => {
            const emptyTile = gs.plot.find(t => !t.hasTree);
            if (emptyTile) {
                emptyTile.hasTree = true;
                emptyTile.isDiamond = true;
            }
            return gs;
        }
    },
    {
        id: 'goldenSapling',
        description: "A golden sapling appears! It produces seeds at an increased rate.",
        weight: 0.3,
        apply: (gs) => {
            const emptyTile = gs.plot.find(t => !t.hasTree);
            if (emptyTile) {
                emptyTile.hasTree = true;
                emptyTile.isGolden = true;
            }
            return gs;
        }
    },
    {
        id: 'changeToSpring',
        description: "Spring is here.",
        weight: 0.4,
        apply: (gs) => {
            gs.currentSeason = 'spring';
            gs.seasonDuration = SEASON_DURATION;
            return gs;
        }
    },
    {
        id: 'changeToSummer',
        description: "Summer has arrived.",
        weight: 0.5,
        apply: (gs) => {
            gs.currentSeason = 'summer';
            gs.seasonDuration = SEASON_DURATION;
            return gs;
        }
    },
    {
        id: 'changeToAutumn',
        description: "Autumn has arrived.",
        weight: 0.6,
        apply: (gs) => {
            gs.currentSeason = 'autumn';
            gs.seasonDuration = SEASON_DURATION;
            return gs;
        }
    },
    {
        id: 'changeToWinter',
        description: "Winter has come.",
        weight: 0.3,
        apply: (gs) => {
            gs.currentSeason = 'winter';
            gs.seasonDuration = SEASON_DURATION;
            return gs;
        }
    }
];

const createInitialPlot = (): PlotTile[] => {
    return Array.from({ length: INITIAL_PLOT_SIZE }, (_, i) => ({
        id: i,
        hasTree: false,
        isWithered: false,
        seedsGenerated: 0,
        isGolden: false,
        isDiamond: false,
    }));
}

export const UPGRADES: Upgrades = {
    'gloves': {
        id: 'gloves',
        name: 'Gardening Gloves',
        description: (level) => `Gather +${(level + 1)} Seed per click.`,
        category: 'Tools',
        baseCost: 50,
        costExponent: 2.2,
        baseEffect: 1,
        effectFormula: (level, base) => 1 + (level * base),
    },
    'shovel': {
        id: 'shovel',
        name: 'Shovel',
        description: (level) => `Start composting. Cleared trees yield ${5 * (level + 1)} seeds.`,
        category: 'Tools',
        baseCost: 350,
        costExponent: 2.5,
        baseEffect: 5,
        effectFormula: (level, base) => level * base,
    },
    'composter': {
        id: 'composter',
        name: 'Composter',
        description: (level) => `Gain an extra ${10 * (level + 1)} seeds from compost.`,
        category: 'Cultivation',
        baseCost: 800,
        costExponent: 1.8,
        baseEffect: 10,
        effectFormula: (level, base) => level * base,
    },
    'betterSoil': {
        id: 'betterSoil',
        name: 'Better Soil',
        description: (level) => `Trees generate +${(level + 1)} seed/s.`,
        category: 'Cultivation',
        baseCost: 500,
        costExponent: 1.6,
        baseEffect: 1,
        effectFormula: (level, base) => 1 + (level * base),
    },
    'cleanseSoil': {
        id: 'cleanseSoil',
        name: 'Cleanse Soil',
        description: (level) => `Purifies the soil, increasing tree lifespan by an additional 15 seeds.`,
        category: 'Cultivation',
        baseCost: 800,
        costExponent: 2.1,
        baseEffect: 15,
        effectFormula: (level, base) => level * base,
    },
    'fertilizer': {
        id: 'fertilizer',
        name: 'Fertilizer',
        description: (level) => `Adds a ${2 * (level + 1)}% chance for a newly planted tree to be golden.`,
        category: 'Cultivation',
        baseCost: 2500,
        costExponent: 2.8,
        baseEffect: 2, 
        effectFormula: (level, base) => level * base,
    },
    'expandPlot': {
        id: 'expandPlot',
        name: 'Expand Plot',
        description: (level) => `Add ${2} new tiles to your plot.`,
        category: 'Expansion',
        baseCost: 2000,
        costExponent: 2.5,
        baseEffect: 2,
        effectFormula: (level, base) => base, // Always adds a fixed number of tiles
    },
    'autoPlanter': {
        id: 'autoPlanter',
        name: 'Auto Planter',
        description: (level) => `Automatically plants a tree every ${10 - level} seconds.`,
        category: 'Automation',
        baseCost: 3000,
        costExponent: 3.0,
        baseEffect: 10, // seconds
        effectFormula: (level, base) => Math.max(1, base - level),
    },
    'autoShovel': {
        id: 'autoShovel',
        name: 'Auto Shovel',
        description: (level) => `Automatically clears a withered tree every ${8 - level} seconds.`,
        category: 'Automation',
        baseCost: 1300,
        costExponent: 3.0,
        baseEffect: 10, // seconds
        effectFormula: (level, base) => Math.max(1, base - level),
    }
};

export const getUpgradeCost = (id: string, level: number): number => {
    const upgrade = UPGRADES[id];
    if (!upgrade) return Infinity;
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.costExponent, level));
};

export const getUpgradeEffect = (id: string, level: number): number => {
    const upgrade = UPGRADES[id];
    if (!upgrade) return 0;
    if (level === 0 && (id !== 'gloves' && id !== 'betterSoil')) return 0;
    if (level === 0 && (id === 'gloves' || id === 'betterSoil')) return 1;

    return upgrade.effectFormula(level, upgrade.baseEffect);
};

export const INITIAL_GAME_STATE: GameState = {
    resources: {
        [Resource.Seeds]: 40,
    },
    upgrades: {
        'gloves': { level: 0 },
        'shovel': { level: 0 },
        'composter': { level: 0 },
        'betterSoil': { level: 0 },
        'cleanseSoil': { level: 0 },
        'fertilizer': { level: 0 },
        'expandPlot': { level: 0 },
        'autoPlanter': { level: 0 },
        'autoShovel': { level: 0 },
    },
    plot: createInitialPlot(),
    treeLifespanSeeds: TREE_LIFESPAN_SEEDS,
    costs: {
        tree: 10,
    },
    totalTreesPlanted: 0,
    loggedMilestones: {},
    notifiedAvailable: {},
    currentSeason: 'summer',
    autoPlanterCooldown: 10,
    autoShovelCooldown: 8,
    seasonDuration: 0,
    peakSeeds: 40,
};

export const formatNumber = (num: number): string => {
    const format = (n: number) => n % 1 === 0 ? n.toString() : n.toFixed(1);

    if (num < 1e3) return format(num);
    if (num < 1e6) return format(num / 1e3) + 'k';
    if (num < 1e9) return format(num / 1e6) + 'M';
    if (num < 1e12) return format(num / 1e9) + 'B';
    if (num < 1e15) return format(num / 1e12) + 'T';
    return format(num / 1e15) + 'Q';
};