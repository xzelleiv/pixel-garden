import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GameState, PlotTile, Preferences } from './types';
import { INITIAL_GAME_STATE, UPGRADES, PLANTING_MILESTONES, getUpgradeCost, getUpgradeEffect, EVENTS, TREE_LIFESPAN_SEEDS, SEASON_MULTIPLIERS, SEASON_DURATION, formatNumber, SEASON_TIPS, MILESTONE_REWARDS, getUpgradeMilestoneRequirement } from './constants';
import { useGameLoop } from './hooks/useGameLoop';
import Plot from './components/Plot';
import ControlPanel from './components/ControlPanel';
import LogPanel from './components/LogPanel';
import DebugPanel from './components/DebugPanel';
import InfoPanel from './components/InfoPanel';
import TitleScreen from './components/TitleScreen';
import SettingsPage from './components/SettingsPage';
import { SeedIcon } from './components/icons';
import ConfettiLayer, { ConfettiBurst } from './components/ConfettiLayer';

const SAVE_KEY = 'pixelGardenSave';
type AudioTrack = 'title' | 'main' | 'none';

type ViteImportMetaWithBaseUrl = ImportMeta & {
  env?: {
    BASE_URL?: string;
  };
};

const getAssetUrl = (assetPath: string) => {
  const base = ((import.meta as ViteImportMetaWithBaseUrl).env?.BASE_URL) ?? '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const normalizedPath = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
  return `${normalizedBase}${normalizedPath}`;
};

const BASE_EVENT_CHANCE = 0.002;
const BASE_PLANTING_INCREMENT = 5;
const MIN_PLANTING_INCREMENT = 1;
const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6c5ce7', '#00cec9', '#f8a5c2', '#ff9f43'];
const LOG_THROTTLE_MS = 7000;

const calculatePlantingCost = (treeCount: number, baseCost: number, seedVaultLevel: number): number => {
  const discountPerTree = seedVaultLevel > 0 ? getUpgradeEffect('seedVault', seedVaultLevel) : 0;
  const incrementalCost = Math.max(MIN_PLANTING_INCREMENT, BASE_PLANTING_INCREMENT - discountPerTree);
  return baseCost + (treeCount * incrementalCost);
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      const savedGame = localStorage.getItem(SAVE_KEY);
      if (savedGame) {
        const parsedGame = JSON.parse(savedGame);
        // Deep merge to ensure old save files don't break the game
        const mergedState = {
          ...INITIAL_GAME_STATE,
          ...parsedGame,
          resources: {
            ...INITIAL_GAME_STATE.resources,
            ...(parsedGame.resources || {}),
          },
          upgrades: {
            ...INITIAL_GAME_STATE.upgrades,
            ...(parsedGame.upgrades || {}),
          },
          loggedMilestones: {
            ...INITIAL_GAME_STATE.loggedMilestones,
            ...(parsedGame.loggedMilestones || {}),
          },
          notifiedAvailable: {
            ...INITIAL_GAME_STATE.notifiedAvailable,
            ...(parsedGame.notifiedAvailable || {}),
          },
          preferences: {
            ...INITIAL_GAME_STATE.preferences,
            ...(parsedGame.preferences || {}),
          },
          milestoneBonuses: {
            ...INITIAL_GAME_STATE.milestoneBonuses,
            ...(parsedGame.milestoneBonuses || {}),
          },
        };
        // set peakSeeds
        mergedState.peakSeeds = Math.max(
          mergedState.peakSeeds || 0,
          mergedState.resources.seeds || 0
        );
        return mergedState;
      }
    } catch (error) {
      console.error("Failed to load saved game:", error);
    }
    return INITIAL_GAME_STATE;
  });

  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [confettiBursts, setConfettiBursts] = useState<ConfettiBurst[]>([]);

  const [logs, setLogs] = useState<string[]>(['Welcome to Pixel Garden...']);
  const [clearProgress, setClearProgress] = useState(0);
  const clearTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [resetProgress, setResetProgress] = useState(0);
  const resetTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobileMilestoneOpen, setIsMobileMilestoneOpen] = useState(false);
  const titleAudioRef = useRef<HTMLAudioElement | null>(null);
  const mainAudioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack>('title');
  const [awaitingUserGesture, setAwaitingUserGesture] = useState(false);
  const awaitingUserGestureRef = useRef(false);
  const [audioVolume, setAudioVolume] = useState(0.65);
  const preferencesRef = useRef<Preferences>(gameState.preferences);
  const confettiTimeoutsRef = useRef<number[]>([]);
  const throttledLogsRef = useRef<Record<string, number>>({});

  // Save game state to localStorage whenever it changes
  useEffect(() => {
    try {
      const serializedState = JSON.stringify(gameState);
      localStorage.setItem(SAVE_KEY, serializedState);
    } catch (error) {
      console.error("Failed to save game:", error);
    }
  }, [gameState]);

  useEffect(() => {
    preferencesRef.current = gameState.preferences;
  }, [gameState.preferences]);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return;
      confettiTimeoutsRef.current.forEach(timeoutId => {
        window.clearTimeout(timeoutId);
      });
      confettiTimeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            setIsDebugVisible(prev => !prev);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    setIsMobileMilestoneOpen(false);
  }, [gameState.totalTreesPlanted]);

  const markAwaitingGesture = useCallback(() => {
    if (awaitingUserGestureRef.current) return;
    awaitingUserGestureRef.current = true;
    setAwaitingUserGesture(true);
  }, []);

  const clearAwaitsGesture = useCallback(() => {
    if (!awaitingUserGestureRef.current) return;
    awaitingUserGestureRef.current = false;
    setAwaitingUserGesture(false);
  }, []);

  const attemptPlayback = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return;
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.catch(() => {
        markAwaitingGesture();
      });
    }
  }, [markAwaitingGesture]);

  const handleUserGesture = useCallback(
    (trackOverride?: AudioTrack) => {
      clearAwaitsGesture();
      const targetTrack = trackOverride ?? currentTrack;
      if (targetTrack === 'title') {
        attemptPlayback(titleAudioRef.current);
      } else if (targetTrack === 'main') {
        attemptPlayback(mainAudioRef.current);
      }
    },
    [attemptPlayback, clearAwaitsGesture, currentTrack]
  );

  const handleAudioVolumeChange = useCallback((value: number) => {
    setAudioVolume(value);
  }, []);

  const handlePreferenceChange = useCallback(<K extends keyof Preferences,>(key: K, value: Preferences[K]) => {
    setGameState(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [key]: value,
      }
    }));
  }, []);

  useEffect(() => {
    const titleAudio = titleAudioRef.current;
    if (titleAudio) {
      titleAudio.loop = true;
      titleAudio.volume = audioVolume;
    }
    const mainAudio = mainAudioRef.current;
    if (mainAudio) {
      mainAudio.loop = true;
      mainAudio.volume = audioVolume;
    }
  }, [audioVolume]);

  useEffect(() => {
    if (currentTrack === 'title') {
      if (mainAudioRef.current) {
        mainAudioRef.current.pause();
        mainAudioRef.current.currentTime = 0;
      }
      attemptPlayback(titleAudioRef.current);
    } else if (currentTrack === 'main') {
      if (titleAudioRef.current) {
        titleAudioRef.current.pause();
        titleAudioRef.current.currentTime = 0;
      }
      attemptPlayback(mainAudioRef.current);
    } else {
      titleAudioRef.current?.pause();
      mainAudioRef.current?.pause();
    }
  }, [currentTrack, attemptPlayback]);

  useEffect(() => {
    if (typeof window === 'undefined' || !awaitingUserGesture) return;
    const onUserGesture = () => handleUserGesture();
    window.addEventListener('pointerdown', onUserGesture, { once: true });
    window.addEventListener('keydown', onUserGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onUserGesture);
      window.removeEventListener('keydown', onUserGesture);
    };
  }, [awaitingUserGesture, handleUserGesture]);

  const addLog = useCallback((message: string) => {
    setLogs(prev => {
        if (prev.length > 50) {
            prev = prev.slice(prev.length - 20);
        }
        if (prev[prev.length - 1] === message) return prev;
        return [...prev, message];
    });
  }, []);

  const logWithThrottle = useCallback((key: string, message: string, interval: number = LOG_THROTTLE_MS) => {
    const now = Date.now();
    const last = throttledLogsRef.current[key] ?? 0;
    if (now - last >= interval) {
      addLog(message);
      throttledLogsRef.current[key] = now;
    }
  }, [addLog]);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  
  const manualSeedGain = useMemo(() => {
    const gloves = getUpgradeEffect('gloves', gameState.upgrades.gloves.level);
    const sunCore = getUpgradeEffect('sunCore', gameState.upgrades.sunCore?.level ?? 0);
    const milestoneBonus = gameState.milestoneBonuses?.gatherBonus ?? 0;
    return gloves + sunCore + milestoneBonus;
  }, [gameState.upgrades.gloves.level, gameState.upgrades.sunCore?.level, gameState.milestoneBonuses]);
  const seedGenerationRate = useMemo(() => getUpgradeEffect('betterSoil', gameState.upgrades.betterSoil.level), [gameState.upgrades.betterSoil.level]);
  const compostBonus = useMemo(() => getUpgradeEffect('shovel', gameState.upgrades.shovel.level) + getUpgradeEffect('composter', gameState.upgrades.composter.level), [gameState.upgrades.shovel.level, gameState.upgrades.composter.level]);
  const typingSpeed = gameState.preferences.reducedMotion ? 0 : 20;

  const createConfettiBurst = useCallback((intensity: number): ConfettiBurst => {
    const particleCount = Math.min(80, 12 + Math.floor(intensity * 6));
    const burstId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const particles = Array.from({ length: particleCount }, (_, index) => {
      const size = 5 + Math.random() * 6;
      return {
        id: `${burstId}-${index}`,
        left: Math.random() * 100,
        topOffset: Math.random() * 10 - 5,
        size,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        duration: 1200 + Math.random() * 900,
        delay: Math.random() * 200,
        drift: (Math.random() - 0.5) * 30,
        rotationStart: Math.random() * 360,
        rotationEnd: 540 + Math.random() * 720,
      };
    });
    return { id: burstId, particles };
  }, []);

  const triggerConfettiBurst = useCallback((intensity: number) => {
    if (typeof window === 'undefined') return;
    const burst = createConfettiBurst(intensity);
    setConfettiBursts(prev => [...prev, burst]);
    const timeoutId = window.setTimeout(() => {
      setConfettiBursts(prev => prev.filter(entry => entry.id !== burst.id));
      confettiTimeoutsRef.current = confettiTimeoutsRef.current.filter(id => id !== timeoutId);
    }, 2000);
    confettiTimeoutsRef.current.push(timeoutId);
  }, [createConfettiBurst]);


  const gameTick = useCallback(() => {
    setGameState(prev => {
      let mutableState: GameState = JSON.parse(JSON.stringify(prev)); // Deep copy for mutation
      const seedVaultLevel = mutableState.upgrades.seedVault?.level ?? 0;
      const weatherStationLevel = mutableState.upgrades.weatherStation?.level ?? 0;
      const sprinklerLevel = mutableState.upgrades.sprinklers?.level ?? 0;
      const sprinklerChance = sprinklerLevel > 0 ? getUpgradeEffect('sprinklers', sprinklerLevel) : 0;
      const seasonTipsEnabled = Boolean(mutableState.preferences?.seasonTips);

      // --- Season Handling ---
      if (mutableState.seasonDuration > 0) {
          mutableState.seasonDuration -= 1;
      } else if (mutableState.currentSeason !== 'summer') {
          // When a season ends, revert to summer
          mutableState.currentSeason = 'summer';
          addLog("The season returns to summer.");
          if (seasonTipsEnabled) {
            addLog(SEASON_TIPS.summer);
          }
      }

      // --- Event Handling ---
  const stormSatelliteBonus = getUpgradeEffect('stormSatellite', mutableState.upgrades.stormSatellite?.level ?? 0);
  const eventChance = BASE_EVENT_CHANCE + (weatherStationLevel * 0.0005) + stormSatelliteBonus;
      if (Math.random() < eventChance) {
        const possibleEvents = EVENTS.filter(event => (!event.canTrigger || event.canTrigger(mutableState)));
        if (possibleEvents.length > 0) {
          const totalWeight = possibleEvents.reduce((sum, event) => sum + event.weight, 0);
          let random = Math.random() * totalWeight;
          const triggeredEvent = possibleEvents.find(event => {
            random -= event.weight;
            return random < 0;
          });
          if (triggeredEvent) {
            addLog(triggeredEvent.description);
            mutableState = triggeredEvent.apply(mutableState);
            if (triggeredEvent.id.startsWith('changeTo')) {
              const extraDuration = weatherStationLevel > 0 ? getUpgradeEffect('weatherStation', weatherStationLevel) : 0;
              mutableState.seasonDuration += extraDuration;
              if (seasonTipsEnabled) {
                const tip = SEASON_TIPS[mutableState.currentSeason];
                if (tip) addLog(tip);
              }
            }
          }
        }
      }
      
      // --- Automation ---
      const autoPlanterLevel = mutableState.upgrades.autoPlanter.level;
      if (autoPlanterLevel > 0) {
      const hasEmptyTile = mutableState.plot.some(t => !t.hasTree);
      if (!hasEmptyTile) {
      mutableState.autoPlanterCooldown = getUpgradeEffect('autoPlanter', autoPlanterLevel);
      } else {
      mutableState.autoPlanterCooldown -= 1;
      if (mutableState.autoPlanterCooldown <= 0) {
        const emptyTile = mutableState.plot.find(t => !t.hasTree);
        const treeCount = mutableState.plot.filter(t => t.hasTree).length;
        const plotCapacity = mutableState.plot.length;
        const currentPlantingCost = calculatePlantingCost(treeCount, mutableState.costs.tree, seedVaultLevel);

        if (emptyTile && treeCount < plotCapacity && mutableState.resources.seeds >= currentPlantingCost) {
          mutableState.resources.seeds -= currentPlantingCost;
          emptyTile.hasTree = true;

          // Fertilizer logic
          const fertilizerChance = getUpgradeEffect('fertilizer', mutableState.upgrades.fertilizer.level);
          if (Math.random() * 100 < fertilizerChance) {
            emptyTile.isGolden = true;
            addLog("Fertilizer worked! A golden sapling grew, producing extra seeds.");
          }
                    
          logWithThrottle('autoPlanter', 'Auto Planter planted a new tree.');
        }
        mutableState.autoPlanterCooldown = getUpgradeEffect('autoPlanter', autoPlanterLevel);
      }
      }
      }
      
      const autoShovelLevel = mutableState.upgrades.autoShovel.level;
       if (autoShovelLevel > 0) {
          mutableState.autoShovelCooldown -= 1;
           if (mutableState.autoShovelCooldown <= 0) {
              const witheredTile = mutableState.plot.find(t => t.isWithered);
              if (witheredTile) {
                  // Perform clear action directly
                  const wasGolden = witheredTile.isGolden;
                  const wasDiamond = witheredTile.isDiamond;
                  witheredTile.hasTree = false;
                  witheredTile.isWithered = false;
                  witheredTile.seedsGenerated = 0;
                  witheredTile.isGolden = false;
                  witheredTile.isDiamond = false;
                  
                  let currentCompostBonus = getUpgradeEffect('shovel', mutableState.upgrades.shovel.level) + getUpgradeEffect('composter', mutableState.upgrades.composter.level);
                  if (wasDiamond) currentCompostBonus *= 10;
                  else if (wasGolden) currentCompostBonus *= 5;
                  mutableState.resources.seeds += currentCompostBonus;
          logWithThrottle('autoShovel', 'Auto Shovel cleared a withered tree.');
              }
              mutableState.autoShovelCooldown = getUpgradeEffect('autoShovel', autoShovelLevel);
           }
       }

      const gnomeLevel = mutableState.upgrades.gnomeInterns?.level ?? 0;
      if (gnomeLevel > 0) {
        const gnomeChance = getUpgradeEffect('gnomeInterns', gnomeLevel);
        if (gnomeChance > 0 && Math.random() * 100 < gnomeChance) {
          const emptyTile = mutableState.plot.find(t => !t.hasTree);
          if (emptyTile) {
            emptyTile.hasTree = true;
            emptyTile.isWithered = false;
            emptyTile.seedsGenerated = 0;
            const lucky = Math.random() < 0.18;
            emptyTile.isGolden = lucky;
            emptyTile.isDiamond = false;
            mutableState.totalTreesPlanted += 1;
            addLog(lucky ? 'Gnome interns planted a shiny tree for free.' : 'Gnome interns planted a free tree.');
          } else {
            const spareSeeds = 10 + (gnomeLevel * 5);
            mutableState.resources.seeds += spareSeeds;
            addLog('Gnome interns dropped off spare seeds.');
          }
        }
      }

      // --- Regular Tick Logic ---
      let seedsGained = 0;
      let witheredCountThisTick = 0;
      const currentSeedGenRate = getUpgradeEffect('betterSoil', mutableState.upgrades.betterSoil.level);
      const seasonMultiplier = SEASON_MULTIPLIERS[mutableState.currentSeason];

      mutableState.plot.forEach((tile: PlotTile) => {
        if (tile.hasTree && !tile.isWithered) {
          let generationMultiplier = 1;
          if (tile.isDiamond) generationMultiplier = 5;
          else if (tile.isGolden) generationMultiplier = 2;

          const seedsThisTick = currentSeedGenRate * generationMultiplier;

          seedsGained += seedsThisTick;
          tile.seedsGenerated += seedsThisTick;
          if (tile.seedsGenerated >= mutableState.treeLifespanSeeds) {
            const savedBySprinklers = sprinklerChance > 0 && Math.random() * 100 < sprinklerChance;
            if (savedBySprinklers) {
              tile.seedsGenerated = Math.floor(mutableState.treeLifespanSeeds * 0.5);
              if (Math.random() < 0.2) {
                addLog('Sprinklers saved a tree from withering.');
              }
            } else {
              tile.isWithered = true;
              witheredCountThisTick++;
            }
          }
        }
      });
      
      if (witheredCountThisTick > 0 && !mutableState.loggedMilestones.firstWither) {
        addLog("A tree has withered.");
        mutableState.loggedMilestones.firstWither = true;
      }
      
      mutableState.resources.seeds += (seedsGained * seasonMultiplier);

      // Update peak seeds
      mutableState.peakSeeds = Math.max(mutableState.peakSeeds || 0, mutableState.resources.seeds);

      // Check for newly available upgrades
      Object.values(UPGRADES).forEach(upgradeDef => {
          const upgradeState = mutableState.upgrades[upgradeDef.id];
          if (upgradeState.level >= (upgradeDef.id === 'autoPlanter' || upgradeDef.id === 'autoShovel' ? 9 : Infinity)) return;
          const cost = getUpgradeCost(upgradeDef.id, upgradeState.level);
          if (!mutableState.notifiedAvailable[`${upgradeDef.id}_${upgradeState.level}`] && mutableState.resources.seeds >= cost) {
              addLog(`${upgradeDef.category}: ${upgradeDef.name} Lv. ${upgradeState.level + 1} is available.`);
              mutableState.notifiedAvailable[`${upgradeDef.id}_${upgradeState.level}`] = true;
          }
      });
      
      return mutableState;
    });
  }, [addLog]);

  useGameLoop(gameTick, hasStarted ? 1000 : null);

  const handleAction = useCallback((action: string) => {
    let triggeredConfettiLevel: number | null = null;
    setGameState(prev => {
        const newState: GameState = JSON.parse(JSON.stringify(prev));
        const treeCount = newState.plot.filter(t => t.hasTree).length;

        switch(action) {
            case 'gatherSeeds': {
        const glovesGain = getUpgradeEffect('gloves', newState.upgrades.gloves.level);
        const sunCoreGain = getUpgradeEffect('sunCore', newState.upgrades.sunCore?.level ?? 0);
        const milestoneBonus = newState.milestoneBonuses?.gatherBonus ?? 0;
        newState.resources.seeds += glovesGain + sunCoreGain + milestoneBonus;
        const confettiLevel = newState.upgrades.confettiCannon?.level ?? 0;
        if (confettiLevel > 0) {
          const confettiChance = getUpgradeEffect('confettiCannon', confettiLevel);
          if (Math.random() * 100 < confettiChance) {
            const confettiBonus = 5 + (confettiLevel * 3);
            newState.resources.seeds += confettiBonus;
            addLog(`Confetti cannon popped for +${confettiBonus} seeds.`);
            triggeredConfettiLevel = confettiLevel;
          }
        }
                break;
            }
            case 'plantTree': {
                const plotCapacity = newState.plot.length;
        const seedVaultLevel = newState.upgrades.seedVault?.level ?? 0;
        const currentPlantingCost = calculatePlantingCost(treeCount, newState.costs.tree, seedVaultLevel);
                const emptyTile = newState.plot.find(t => !t.hasTree);
                if (emptyTile && treeCount < plotCapacity && newState.resources.seeds >= currentPlantingCost) {
                    newState.resources.seeds -= currentPlantingCost;
                    emptyTile.hasTree = true;
                    
                    // Fertilizer logic
                    const fertilizerChance = getUpgradeEffect('fertilizer', newState.upgrades.fertilizer.level);
                    if (Math.random() * 100 < fertilizerChance) {
                        emptyTile.isGolden = true;
                        addLog("Fertilizer worked! A golden sapling grew, producing extra seeds.");
                    }

                    newState.totalTreesPlanted += 1;
                    const milestone = PLANTING_MILESTONES.find(m => m === newState.totalTreesPlanted);
                    if (milestone && !newState.loggedMilestones[`planted${milestone}`]) {
                       addLog(milestone === 1 ? "Planted your first tree." : `Planted ${milestone} trees.`);
                       const rewards = MILESTONE_REWARDS[milestone];
                       if (rewards) {
                         rewards.forEach(reward => {
                           if (reward.type === 'gatherBonus') {
                             if (!newState.milestoneBonuses) {
                               newState.milestoneBonuses = { gatherBonus: 0 };
                             }
                             newState.milestoneBonuses.gatherBonus += reward.amount;
                           }
                           addLog(reward.message);
                         });
                       }
                       newState.loggedMilestones[`planted${milestone}`] = true;
                    }
                }
                break;
            }
            case 'clearWithered': {
                const witheredTile = newState.plot.find(t => t.isWithered);
                if (witheredTile) {
                    const wasGolden = witheredTile.isGolden;
                    const wasDiamond = witheredTile.isDiamond;
                    witheredTile.hasTree = false;
                    witheredTile.isWithered = false;
                    witheredTile.seedsGenerated = 0;
                    witheredTile.isGolden = false;
                    witheredTile.isDiamond = false;

                    addLog("Cleared a withered tree.");
                    if (newState.upgrades.shovel.level > 0) {
                       let currentCompostBonus = getUpgradeEffect('shovel', newState.upgrades.shovel.level) + getUpgradeEffect('composter', newState.upgrades.composter.level);
                       if (wasDiamond) {
                           currentCompostBonus *= 10;
                           addLog("The diamond tree left behind a treasure trove of seeds!");
                       } else if (wasGolden) {
                           currentCompostBonus *= 5;
                           addLog("The golden tree left behind a bounty of seeds!");
                       }
                       newState.resources.seeds += currentCompostBonus;
                    }
                }
                break;
            }
        }
        // Update peak seeds after actions
        newState.peakSeeds = Math.max(newState.peakSeeds || 0, newState.resources.seeds);
        return newState;
    });
    if (triggeredConfettiLevel !== null && !preferencesRef.current.disableConfetti) {
      triggerConfettiBurst(triggeredConfettiLevel);
    }
  }, [addLog, triggerConfettiBurst]);
  
  const handleClearHoldStart = useCallback(() => {
    if (gameState.upgrades.shovel.level > 0) return;
    if (clearTimerRef.current) clearInterval(clearTimerRef.current);

    const startTime = Date.now();
    const duration = 3000;

    clearTimerRef.current = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min((elapsedTime / duration) * 100, 100);
        setClearProgress(progress);

        if (progress >= 100) {
            handleAction('clearWithered');
            if (clearTimerRef.current) clearInterval(clearTimerRef.current);
            setClearProgress(0);
        }
    }, 30);
  }, [gameState.upgrades.shovel.level, handleAction]);

  const handleClearHoldEnd = useCallback(() => {
      if (clearTimerRef.current) {
          clearInterval(clearTimerRef.current);
          clearTimerRef.current = null;
      }
      setClearProgress(0);
  }, []);

  const canAffordUpgrade = useCallback((upgradeId: string): boolean => {
    const currentLevel = gameState.upgrades[upgradeId].level;
    const targetLevel = currentLevel + 1;
    const cost = getUpgradeCost(upgradeId, currentLevel);
    if ((gameState.resources.seeds ?? 0) < cost) return false;
    const requiredMilestone = getUpgradeMilestoneRequirement(upgradeId, targetLevel);
    if (requiredMilestone && gameState.totalTreesPlanted < requiredMilestone) return false;
    return true;
  }, [gameState.resources, gameState.upgrades, gameState.totalTreesPlanted]);

  const handleBuyUpgrade = useCallback((upgradeId: string) => {
    if (!canAffordUpgrade(upgradeId)) return;
    
    const upgradeDef = UPGRADES[upgradeId];
    const currentLevel = gameState.upgrades[upgradeId].level;
    const cost = getUpgradeCost(upgradeId, currentLevel);

    addLog(`Upgraded ${upgradeDef.name} to Level ${currentLevel + 1}!`);

    setGameState(prev => {
        const newState: GameState = JSON.parse(JSON.stringify(prev));
        
        newState.resources.seeds -= cost;
        newState.upgrades[upgradeId].level += 1;
        
        if (upgradeId === 'expandPlot') {
            const tilesToUnlock = UPGRADES['expandPlot'].baseEffect;
            const newTiles: PlotTile[] = Array.from({ length: tilesToUnlock }, (_, i) => ({
                id: newState.plot.length + i,
                hasTree: false,
                isWithered: false,
                seedsGenerated: 0,
                isGolden: false,
                isDiamond: false,
            }));
            newState.plot.push(...newTiles);
        }

    if (upgradeId === 'cleanseSoil' || upgradeId === 'greenhouse') {
      const cleanseBonus = getUpgradeEffect('cleanseSoil', newState.upgrades.cleanseSoil.level);
      const greenhouseBonus = getUpgradeEffect('greenhouse', newState.upgrades.greenhouse?.level ?? 0);
      newState.treeLifespanSeeds = TREE_LIFESPAN_SEEDS + cleanseBonus + greenhouseBonus;
    }
        
        return newState;
    });
  }, [canAffordUpgrade, gameState.upgrades, addLog]);

  const handleResetHoldStart = useCallback(() => {
    if (resetTimerRef.current) clearInterval(resetTimerRef.current);

    const startTime = Date.now();
    const duration = 5000; // 5 seconds

    resetTimerRef.current = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min((elapsedTime / duration) * 100, 100);
        setResetProgress(progress);

        if (progress >= 100) {
            localStorage.removeItem(SAVE_KEY);
            setGameState(INITIAL_GAME_STATE);
            setLogs(['Welcome to Pixel Garden... Progress has been reset.']);
            if (resetTimerRef.current) clearInterval(resetTimerRef.current);
            setResetProgress(0);
            setCurrentTrack('title');
            setHasStarted(false); // Go back to title screen
        }
    }, 30);
  }, []);

  const handleResetHoldEnd = useCallback(() => {
      if (resetTimerRef.current) {
          clearInterval(resetTimerRef.current);
          resetTimerRef.current = null;
      }
      setResetProgress(0);
  }, []);
  
  const autoGains = useMemo(() => {
    const liveTrees = gameState.plot.filter(t => t.hasTree && !t.isWithered);
    const normalTrees = liveTrees.filter(t => !t.isGolden && !t.isDiamond).length;
    const goldenTrees = liveTrees.filter(t => t.isGolden).length;
    const diamondTrees = liveTrees.filter(t => t.isDiamond).length;
    const seasonMultiplier = SEASON_MULTIPLIERS[gameState.currentSeason];
    const baseSeedsPerSecond = (normalTrees * seedGenerationRate) + (goldenTrees * seedGenerationRate * 2) + (diamondTrees * seedGenerationRate * 5);
    const seedsPerSecond = baseSeedsPerSecond * seasonMultiplier;

    return { 
        seeds: seedsPerSecond,
        normalTrees,
        goldenTrees,
        diamondTrees,
    };
  }, [gameState.plot, seedGenerationRate, gameState.currentSeason]);

  const nextMilestoneValue = useMemo(
    () => PLANTING_MILESTONES.find(m => m > gameState.totalTreesPlanted),
    [gameState.totalTreesPlanted]
  );
  const nextMilestoneRewards = useMemo(
    () => (nextMilestoneValue ? MILESTONE_REWARDS[nextMilestoneValue] : undefined),
    [nextMilestoneValue]
  );

  const handleStartGame = useCallback(() => {
    setCurrentTrack('main');
    setHasStarted(true);
    addLog('Entering the garden...');
    if (titleAudioRef.current) {
      titleAudioRef.current.pause();
      titleAudioRef.current.currentTime = 0;
    }
    handleUserGesture('main');
  }, [addLog, handleUserGesture]);

  return (
    <div className="h-screen font-press-start text-sm p-1 sm:p-4 flex flex-col items-center selection:bg-pixel-accent selection:text-pixel-bg">
      <div className="w-full max-w-7xl flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <LogPanel logs={logs} typingSpeed={typingSpeed} compact={gameState.preferences.compactLogs} />
          </div>
          <button
            type="button"
            aria-expanded={isSidebarOpen}
            aria-controls="mobile-sidebar"
            aria-label="Toggle menu"
            className="flex-shrink-0 rounded-md border-2 border-pixel-border bg-pixel-panel p-2 shadow-pixel"
            onClick={toggleSidebar}
          >
            <span className="flex flex-col gap-1">
              <span className="block h-0.5 w-5 bg-pixel-accent"></span>
              <span className="block h-0.5 w-5 bg-pixel-accent"></span>
              <span className="block h-0.5 w-5 bg-pixel-accent"></span>
            </span>
          </button>
        </div>
      </div>

      {/* Mobile-only Resource & Milestone Toggle */}
      <div className="w-full max-w-7xl px-2 mb-2 md:hidden">
        <div className="bg-pixel-panel border-2 border-pixel-border shadow-pixel p-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SeedIcon />
            <span className="text-pixel-accent font-bold text-base">{formatNumber(gameState.resources.seeds || 0)}</span>
          </div>
          {nextMilestoneValue && (
            <button
              type="button"
              onClick={() => setIsMobileMilestoneOpen(prev => !prev)}
              className="flex items-center justify-center rounded border border-pixel-border bg-pixel-panel/60 px-2 py-1 text-lg leading-none text-pixel-accent shadow-pixel"
              aria-expanded={isMobileMilestoneOpen}
              aria-label={isMobileMilestoneOpen ? 'Hide milestone details' : 'Show milestone details'}
            >
              {isMobileMilestoneOpen ? '−' : '+'}
            </button>
          )}
        </div>
        {nextMilestoneValue && isMobileMilestoneOpen && (
          <div className="mt-2 rounded-lg border-2 border-pixel-border bg-pixel-panel/80 px-3 py-2 text-[11px] leading-snug text-pixel-text/80">
            <p>
              Plant <span className="text-pixel-accent">{Math.max(0, nextMilestoneValue - gameState.totalTreesPlanted)}</span> more tree{Math.max(0, nextMilestoneValue - gameState.totalTreesPlanted) === 1 ? '' : 's'} to unlock:
            </p>
            <ul className="mt-2 space-y-1 list-disc list-inside text-pixel-text/70">
              {(nextMilestoneRewards ?? []).map((reward, index) => (
                <li key={`mobile-reward-${reward.type}-${index}`}>{reward.message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <main className="w-full max-w-7xl flex-grow flex flex-col md:grid md:grid-cols-3 lg:grid-cols-6 gap-6 min-h-0 mt-1 md:mt-0">
        <div className="hidden lg:block lg:col-span-1 md:h-full">
            <InfoPanel
              upgrades={gameState.upgrades}
            />
        </div>
        
        <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-4 md:h-full">
            <div className="flex-grow flex items-center justify-center">
                <Plot tiles={gameState.plot} currentSeason={gameState.currentSeason} />
            </div>
        </div>

        <div className="md:col-span-1 lg:col-span-2 md:h-full min-h-0 flex-grow">
          <ControlPanel 
            gameState={gameState}
            onAction={handleAction}
            onBuyUpgrade={handleBuyUpgrade}
            canAffordUpgrade={canAffordUpgrade}
            resources={gameState.resources}
            autoGains={{
                seeds: autoGains.seeds, 
                manual: manualSeedGain, 
                compost: compostBonus,
                normalTrees: autoGains.normalTrees,
                goldenTrees: autoGains.goldenTrees,
                diamondTrees: autoGains.diamondTrees,
            }}
            seedGenerationRate={seedGenerationRate}
            onClearHoldStart={handleClearHoldStart}
            onClearHoldEnd={handleClearHoldEnd}
            clearProgress={clearProgress}
            resetProgress={resetProgress}
            onResetHoldStart={handleResetHoldStart}
            onResetHoldEnd={handleResetHoldEnd}
            nextMilestone={nextMilestoneValue ? {
              value: nextMilestoneValue,
              rewards: nextMilestoneRewards ?? [],
              currentCount: gameState.totalTreesPlanted,
            } : null}
          />
        </div>
      </main>
      <div
        className={`fixed inset-0 z-40 ${isSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!isSidebarOpen}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${isSidebarOpen ? 'opacity-70' : 'opacity-0'}`}
          onClick={closeSidebar}
        ></div>
        <div
          id="mobile-sidebar"
          className={`absolute right-0 top-0 h-full w-64 max-w-[75vw] bg-pixel-panel border-l-2 border-pixel-border shadow-[0_0_30px_rgba(0,0,0,0.9)] p-0 transition-transform duration-200 ${
            isSidebarOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col justify-between min-h-0">
            <div className="flex items-center justify-between border-b-2 border-pixel-border p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-pixel-accent">Menu</p>
              <button
                type="button"
                aria-label="Close sidebar"
                onClick={closeSidebar}
                className="text-pixel-accent text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <SettingsPage
                audioVolume={audioVolume}
                onAudioVolumeChange={handleAudioVolumeChange}
                preferences={gameState.preferences}
                onPreferenceChange={handlePreferenceChange}
              />
            </div>
            <div className="sticky bottom-0 border-t border-pixel-border bg-pixel-panel/70 p-4 backdrop-blur-sm">
              <button
                onMouseDown={handleResetHoldStart}
                onMouseUp={handleResetHoldEnd}
                onMouseLeave={handleResetHoldEnd}
                onTouchStart={(e) => { e.preventDefault(); handleResetHoldStart(e); }}
                onTouchEnd={(e) => { e.preventDefault(); handleResetHoldEnd(e); }}
                onTouchCancel={(e) => { e.preventDefault(); handleResetHoldEnd(e); }}
                className="relative w-full overflow-hidden px-3 py-2 bg-red-700 text-pixel-bg font-bold shadow-pixel hover:bg-red-600 active:shadow-pixel-inset active:translate-y-px transition-colors text-xs"
              >
                {resetProgress > 0 && (
                  <div
                    className="absolute top-0 left-0 h-full bg-pixel-accent/50"
                    style={{ width: `${resetProgress}%` }}
                  />
                )}
                <span className="relative">
                  {resetProgress > 0 ? 'Resetting...' : 'Reset Progress'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {!gameState.preferences.disableConfetti && (
        <ConfettiLayer bursts={confettiBursts} />
      )}
  <audio ref={titleAudioRef} src={getAssetUrl('audio/titlescreen.mp3')} preload="auto" />
  <audio ref={mainAudioRef} src={getAssetUrl('audio/mainbg.mp3')} preload="auto" />
      {isDebugVisible && <DebugPanel setGameState={setGameState} addLog={addLog} />}
      {!hasStarted && <TitleScreen onStart={handleStartGame} />}
    </div>
  );
};

export default App;
