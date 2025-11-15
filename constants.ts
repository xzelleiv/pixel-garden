// FIX: import all necessary types from the corrected types.ts file.
import { GameState, Resource, Upgrades, PlotTile, Season, EventDefinition, Preferences, MilestoneReward } from './types';

export const DEFAULT_PREFERENCES: Preferences = {
    reducedMotion: false,
    compactLogs: false,
    seasonTips: true,
    classicActionsUI: false,
    classicUpgradesUI: false,
    disableConfetti: false,
    disableParticles: false,
    effectsVolume: 1,
};

export const GAME_VERSION = '1.5.5';

export const INITIAL_PLOT_SIZE = 16;
export const TREE_LIFESPAN_SEEDS = 60;
export const PLANTING_MILESTONES = [1, 100, 500, 700, 800, 1000, 3000, 4000, 5000, 7000, 10000];
export const SEASON_DURATION = 300; // 5 minutes
export const GOLDEN_TREE_DURATION_MS = 30_000;
export const DIAMOND_TREE_DURATION_MS = 60_000;

export const MILESTONE_REWARDS: Record<number, MilestoneReward[]> = {
    130: [
        { type: 'gatherBonus', amount: 1, message: 'Milestone perk: manual gathering now yields +1 extra seed.' }
    ],
    500: [
        { type: 'unlockUpgrade', upgradeId: 'sunCore', message: 'Sun Core upgrade unlocked! Solar powered clicks! :O' }
    ],
    720: [
        { type: 'unlockUpgrade', upgradeId: 'seedVault', message: 'Seed Vault upgrade unlocked!' }
    ],
    850: [
        { type: 'unlockUpgrade', upgradeId: 'gnomeInterns', message: 'Gnome Interns unlocked! The little dudes work for snacks.' }
    ],
    1000: [
        { type: 'unlockUpgrade', upgradeId: 'greenhouse', message: 'Greenhouse upgrade unlocked! Extend tree lifespan.' },
        { type: 'gatherBonus', amount: 1, message: 'Milestone perk: another +1 manual gather bonus.' }
    ],
    3500: [
        { type: 'unlockUpgrade', upgradeId: 'stormSatellite', message: 'Storm Satellite upgrade unlocked! Higher event chances!' }
    ]
};

export const SEASON_TEXTURES: Record<Season, { tree: string; withered?: string }> = {
    spring: {
        tree: 'https://tinyurl.com/4ur44chr',
    },
    summer: {
        tree: 'https://tinyurl.com/4fun7b8r',
    },
    autumn: {
        tree: 'https://tinyurl.com/tv3ue2kd', 
    },
    winter: {
        tree: 'https://tinyurl.com/2f45puk8',
        withered: 'https://tinyurl.com/2wsrp3my'
    }
};

export const SEASON_MULTIPLIERS: Record<Season, number> = {
    spring: 5,
    summer: 2,
    autumn: 3,
    winter: 1,
};

export const SEASON_TIPS: Record<Season, string> = {
    spring: 'Spring is the rarest event with a 5x multiplier :p',
    summer: 'Summer is steady. Use the downtime to save seeds and prep upgrades.',
    autumn: 'Autumn rewards planning with a 3x bonus—clear withered trees early.',
    winter: 'Winter slows production. Lean on manual gathering and compost.',
};

export const EVENTS: EventDefinition[] = [
    {
        id: 'bountifulHarvest',
        description: "You found a stash of seeds.",
        weight: 1,
        canTrigger: (gs) => gs.plot.some(t => t.hasTree && !t.isWithered),
        apply: (gs) => {
            const healthyTrees = gs.plot.filter(t => t.hasTree && !t.isWithered).length;
            const bonus = 10 + (healthyTrees * 5);
            gs.resources.seeds += bonus;
            return gs;
        }
    },
    {
        id: 'diamondSapling',
        description: "An diamond sapling appears! It produces seeds at an increased rate.",
        weight: 0.1,
        canTrigger: (gs) => gs.plot.some(t => !t.hasTree || (t.hasTree && !t.isWithered)),
        apply: (gs) => {
            const emptyTile = gs.plot.find(t => !t.hasTree);
            if (emptyTile) {
                emptyTile.hasTree = true;
                emptyTile.isWithered = false;
                emptyTile.isGolden = false;
                emptyTile.isDiamond = true;
                emptyTile.seedsGenerated = 0;
                emptyTile.rareExpiresAt = Date.now() + DIAMOND_TREE_DURATION_MS;
                return gs;
            }

            const upgradeTile = gs.plot.find(t => t.hasTree && !t.isWithered);
            if (upgradeTile) {
                upgradeTile.isDiamond = true;
                upgradeTile.isGolden = false;
                upgradeTile.seedsGenerated = 0;
                upgradeTile.rareExpiresAt = Date.now() + DIAMOND_TREE_DURATION_MS;
            }
            return gs;
        }
    },
    {
        id: 'goldenSapling',
        description: "A golden sapling appears! It produces seeds at an increased rate.",
        weight: 0.3,
        canTrigger: (gs) => gs.plot.some(t => !t.hasTree || (t.hasTree && !t.isWithered)),
        apply: (gs) => {
            const emptyTile = gs.plot.find(t => !t.hasTree);
            if (emptyTile) {
                emptyTile.hasTree = true;
                emptyTile.isWithered = false;
                emptyTile.isDiamond = false;
                emptyTile.isGolden = true;
                emptyTile.seedsGenerated = 0;
                emptyTile.rareExpiresAt = Date.now() + GOLDEN_TREE_DURATION_MS;
                return gs;
            }

            const upgradeTile = gs.plot.find(t => t.hasTree && !t.isWithered && !t.isDiamond);
            if (upgradeTile) {
                upgradeTile.isGolden = true;
                upgradeTile.isDiamond = false;
                upgradeTile.rareExpiresAt = Date.now() + GOLDEN_TREE_DURATION_MS;
            }
            return gs;
        }
    },
    {
        id: 'changeToSpring',
        description: "Spring is here.",
        weight: 0.4,
        canTrigger: (gs) => gs.currentSeason !== 'spring' && gs.seasonDuration <= 0,
        apply: (gs) => {
            gs.currentSeason = 'spring';
            gs.seasonDuration = SEASON_DURATION;
            return gs;
        }
    },
    {
        id: 'changeToSummer',
        description: "Summer has arrived.",
        weight: 0.65,
        canTrigger: (gs) => gs.currentSeason !== 'summer' && gs.seasonDuration <= 0,
        apply: (gs) => {
            gs.currentSeason = 'summer';
            gs.seasonDuration = SEASON_DURATION;
            return gs;
        }
    },
    {
        id: 'changeToAutumn',
        description: "Autumn has arrived.",
        weight: 0.75,
        canTrigger: (gs) => gs.currentSeason !== 'autumn' && gs.seasonDuration <= 0,
        apply: (gs) => {
            gs.currentSeason = 'autumn';
            gs.seasonDuration = SEASON_DURATION;
            return gs;
        }
    },
    {
        id: 'changeToWinter',
        description: "Winter has come.",
        weight: 0.45,
        canTrigger: (gs) => gs.currentSeason !== 'winter' && gs.seasonDuration <= 0,
        apply: (gs) => {
            gs.currentSeason = 'winter';
            gs.seasonDuration = SEASON_DURATION;
            return gs;
        }
    },
    {
        id: 'gentleRain',
        description: "Gentle rain cools the soil and refreshes your trees.",
        weight: 0.6,
        canTrigger: (gs) => gs.plot.some(t => t.hasTree && !t.isWithered),
        apply: (gs) => {
            gs.plot.forEach(tile => {
                if (tile.hasTree && !tile.isWithered) {
                    tile.seedsGenerated = Math.max(0, tile.seedsGenerated - 15);
                }
            });
            return gs;
        }
    },
    {
        id: 'hummingbirdFestival',
        description: "A hummingbird festival blesses your grove with golden blooms.",
        weight: 0.35,
        canTrigger: (gs) => gs.plot.some(tile => tile.hasTree && !tile.isWithered),
        apply: (gs) => {
            const healthyTiles = gs.plot.filter(tile => tile.hasTree && !tile.isWithered);
            if (healthyTiles.length === 0) return gs;
            const upgradesCount = Math.min(2, healthyTiles.length);
            for (let i = 0; i < upgradesCount; i++) {
                const target = healthyTiles[Math.floor(Math.random() * healthyTiles.length)];
                if (target) {
                    target.isGolden = true;
                    target.isDiamond = false;
                    target.rareExpiresAt = Date.now() + GOLDEN_TREE_DURATION_MS;
                }
            }
            return gs;
        }
    },
    {
        id: 'wiltBlight',
        description: "A sudden blight withers one of your trees!",
        weight: 0.25,
        canTrigger: (gs) => gs.plot.some(tile => tile.hasTree && !tile.isWithered),
        apply: (gs) => {
            const candidates = gs.plot.filter(tile => tile.hasTree && !tile.isWithered);
            if (candidates.length === 0) return gs;
            const unlucky = candidates[Math.floor(Math.random() * candidates.length)];
            const sprinklerLevel = gs.upgrades.sprinklers?.level || 0;
            const sprinklerChance = sprinklerLevel > 0 ? Math.min(60, sprinklerLevel * 6) : 0;
            const protectedBySprinklers = sprinklerChance > 0 && Math.random() * 100 < sprinklerChance;
            if (unlucky && !protectedBySprinklers) {
                unlucky.isWithered = true;
                unlucky.rareExpiresAt = undefined;
            }
            return gs;
        }
    },
    {
        id: 'wanderingMerchant',
        description: "A wandering merchant swaps stories for a bundle of seeds.",
        weight: 0.4,
        apply: (gs) => {
            const bonus = 150 + Math.floor(gs.totalTreesPlanted * 1.5);
            gs.resources.seeds += bonus;
            gs.costs.tree = Math.max(5, gs.costs.tree - 1);
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
        rareExpiresAt: undefined,
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
    'confettiCannon': {
        id: 'confettiCannon',
        name: 'Confetti Cannon',
        description: (level) => `Gathers may pop +${5 + level * 3} seeds.`,
        category: 'Tools',
        baseCost: 6000,
        costExponent: 2.4,
        baseEffect: 5,
        effectFormula: (level, base) => Math.min(45, level * base),
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
        description: (level) => {
            const chance = Math.max(0, (2 * level) - 1);
            return chance > 0
                ? `Adds roughly a ${chance}% chance for a newly planted tree to be golden.`
                : 'Adds a small chance for a newly planted tree to be golden (unlocked at Lv. 1).';
        },
        category: 'Cultivation',
        baseCost: 2500,
        costExponent: 2.8,
        baseEffect: 2, 
        effectFormula: (level, base) => Math.max(0, (level * base) - 1),
        levelMilestones: {
            7: 700,
        },
    },
    'sprinklers': {
        id: 'sprinklers',
        name: 'Sprinklers',
        description: (level) => `Gives aging trees a ${6 * (level + 1)}% chance to resist withering.`,
        category: 'Cultivation',
        baseCost: 1800,
        costExponent: 2.45,
        baseEffect: 6,
        effectFormula: (level, base) => Math.min(60, level * base),
        levelMilestones: {
            2: 800,
        },
    },
    'sunCore': {
        id: 'sunCore',
        name: 'Sun Core',
        description: (level) => `Solar focus adds +${(level + 1)} seeds per manual gather.`,
        category: 'Cultivation',
        baseCost: 4200,
        costExponent: 2.6,
        baseEffect: 1,
        effectFormula: (level, base) => level * base,
        requiresMilestone: 500,
        perLevelMilestoneProgression: true,
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
    'seedVault': {
        id: 'seedVault',
        name: 'Seed Vault',
        description: (level) => `Reduces planting cost growth by ${0.5 * (level + 1)} per tree.`,
        category: 'Expansion',
        baseCost: 3200,
        costExponent: 2.9,
        baseEffect: 0.5,
        effectFormula: (level, base) => Math.min(4, level * base),
        requiresMilestone: 700,
    },
    'greenhouse': {
        id: 'greenhouse',
        name: 'Greenhouse',
        description: (level) => `Extends tree lifespan by ${15 * (level + 1)} seeds.`,
        category: 'Expansion',
        baseCost: 4800,
        costExponent: 2.7,
        baseEffect: 15,
        effectFormula: (level, base) => level * base,
        requiresMilestone: 1000,
        perLevelMilestoneProgression: true,
    },
    'autoPlanter': {
        id: 'autoPlanter',
        name: 'Auto Planter',
        description: (level) => `Automatically plants a tree every ${10 - level} seconds.`,
        category: 'Automation',
        baseCost: 3000,
        costExponent: 3.2,
        baseEffect: 10, // seconds
        effectFormula: (level, base) => Math.max(1, base - level),
    },
    'autoShovel': {
        id: 'autoShovel',
        name: 'Auto Shovel',
        description: (level) => `Automatically clears a withered tree every ${8 - level} seconds.`,
        category: 'Automation',
        baseCost: 1300,
        costExponent: 3.2,
        baseEffect: 10, // seconds
        effectFormula: (level, base) => Math.max(1, base - level),
    },
    'weatherStation': {
        id: 'weatherStation',
        name: 'Weather Station',
        description: (level) => `Season events last +${30 * (level + 1)}s and happen more often.`,
        category: 'Automation',
        baseCost: 4200,
        costExponent: 3.35,
        baseEffect: 30,
        effectFormula: (level, base) => level * base,
    },
    'stormSatellite': {
        id: 'stormSatellite',
        name: 'Storm Satellite',
        description: (level) => `Adds ${0.2 * (level + 1)}% flat chance for a weather event each tick.`,
        category: 'Automation',
        baseCost: 5200,
        costExponent: 3.2,
        baseEffect: 0.002,
        effectFormula: (level, base) => level * base,
        requiresMilestone: 3000,
        perLevelMilestoneProgression: true,
    },
    'gnomeInterns': {
        id: 'gnomeInterns',
        name: 'Gnome Interns',
        description: (level) => `${Math.min(30, level * 4)}% chance for a free tree each tick.`,
        category: 'Automation',
        baseCost: 5200,
        costExponent: 2.9,
        baseEffect: 4,
        effectFormula: (level, base) => Math.min(30, level * base),
        requiresMilestone: 800,
    }
};

export const getUpgradeCost = (id: string, level: number): number => {
    const upgrade = UPGRADES[id];
    if (!upgrade) return Infinity;
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.costExponent, level));
};

export const getUpgradeMilestoneRequirement = (id: string, targetLevel: number): number | undefined => {
    if (targetLevel <= 0) return undefined;
    const upgrade = UPGRADES[id];
    if (!upgrade) return undefined;

    if (upgrade.levelMilestones && upgrade.levelMilestones[targetLevel]) {
        return upgrade.levelMilestones[targetLevel];
    }

    if (upgrade.perLevelMilestoneProgression && upgrade.requiresMilestone) {
        const baseIndex = PLANTING_MILESTONES.indexOf(upgrade.requiresMilestone);
        if (baseIndex === -1) {
            return upgrade.requiresMilestone;
        }
        const targetIndex = baseIndex + (targetLevel - 1);
        return PLANTING_MILESTONES[targetIndex] ?? PLANTING_MILESTONES[PLANTING_MILESTONES.length - 1];
    }

    if (targetLevel === 1) {
        return upgrade.requiresMilestone;
    }

    return undefined;
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
        'confettiCannon': { level: 0 },
        'composter': { level: 0 },
        'betterSoil': { level: 0 },
        'cleanseSoil': { level: 0 },
        'fertilizer': { level: 0 },
        'sprinklers': { level: 0 },
        'sunCore': { level: 0 },
        'expandPlot': { level: 0 },
        'seedVault': { level: 0 },
        'greenhouse': { level: 0 },
        'autoPlanter': { level: 0 },
        'autoShovel': { level: 0 },
        'weatherStation': { level: 0 },
        'stormSatellite': { level: 0 },
        'gnomeInterns': { level: 0 },
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
    preferences: { ...DEFAULT_PREFERENCES },
    milestoneBonuses: {
        gatherBonus: 0,
    },
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