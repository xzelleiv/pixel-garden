import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GameState, PlotTile, Resources, UpgradeDefinition, Season } from './types';
import { INITIAL_GAME_STATE, UPGRADES, PLANTING_MILESTONES, getUpgradeCost, getUpgradeEffect, EVENTS, TREE_LIFESPAN_SEEDS, SEASON_MULTIPLIERS, SEASON_DURATION, formatNumber } from './constants';
import { useGameLoop } from './hooks/useGameLoop';
import Plot from './components/Plot';
import ControlPanel from './components/ControlPanel';
import LogPanel from './components/LogPanel';
import DebugPanel from './components/DebugPanel';
import InfoPanel from './components/InfoPanel';
import TitleScreen from './components/TitleScreen';
import { SeedIcon } from './components/icons';

const SAVE_KEY = 'pixelGardenSave';

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
        };
        // Safely set peakSeeds
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

  const [logs, setLogs] = useState<string[]>(['Welcome to Pixel Garden...']);
  const [clearProgress, setClearProgress] = useState(0);
  const clearTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const [resetProgress, setResetProgress] = useState(0);
  const resetTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const titleAudioRef = useRef<HTMLAudioElement | null>(null);
  const mainAudioRef = useRef<HTMLAudioElement | null>(null);

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
    if (typeof window === 'undefined') return;
    const audio = titleAudioRef.current;
    if (!audio) return;
    audio.loop = true;
    audio.volume = 0.65;

    if (!hasStarted) {
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          audio.muted = true;
          audio.play().catch(() => undefined);
        });
      }
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [hasStarted]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const audio = mainAudioRef.current;
    if (!audio) return;
    audio.loop = true;
    audio.volume = 0.6;

    if (hasStarted) {
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          audio.muted = true;
          audio.play().catch(() => undefined);
        });
      }
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, [hasStarted]);

  const addLog = useCallback((message: string) => {
    setLogs(prev => {
        if (prev.length > 50) {
            prev = prev.slice(prev.length - 20);
        }
        if (prev[prev.length - 1] === message) return prev;
        return [...prev, message];
    });
  }, []);

  const toggleSidebar = useCallback(() => setIsSidebarOpen(prev => !prev), []);
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), []);
  
  const manualSeedGain = useMemo(() => getUpgradeEffect('gloves', gameState.upgrades.gloves.level), [gameState.upgrades.gloves.level]);
  const seedGenerationRate = useMemo(() => getUpgradeEffect('betterSoil', gameState.upgrades.betterSoil.level), [gameState.upgrades.betterSoil.level]);
  const compostBonus = useMemo(() => getUpgradeEffect('shovel', gameState.upgrades.shovel.level) + getUpgradeEffect('composter', gameState.upgrades.composter.level), [gameState.upgrades.shovel.level, gameState.upgrades.composter.level]);


  const gameTick = useCallback(() => {
    setGameState(prev => {
      let mutableState: GameState = JSON.parse(JSON.stringify(prev)); // Deep copy for mutation
      const healthyTreesCount = mutableState.plot.filter(t => t.hasTree && !t.isWithered).length;

      // --- Season Handling ---
      if (mutableState.seasonDuration > 0) {
          mutableState.seasonDuration -= 1;
      } else if (mutableState.currentSeason !== 'summer') {
          // When a season ends, revert to summer
          mutableState.currentSeason = 'summer';
          addLog("The season returns to summer.");
      }

      // --- Event Handling ---
      const EVENT_CHANCE = 0.002; // 2% chance per second
if (Math.random() < EVENT_CHANCE) {
    const possibleEvents = EVENTS.filter(event => {
        if (event.id === 'bountifulHarvest' && healthyTreesCount === 0) return false;
        // Prevent changing to the same season
        if (event.id.startsWith('changeTo') && mutableState.currentSeason === event.id.replace('changeTo', '').toLowerCase()) return false;
        // Prevent overlapping season changes (only allow if current season duration has expired)
        if (event.id.startsWith('changeTo') && mutableState.seasonDuration > 0) return false;
        return true;
    });
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
        }
    }
}
      
      // --- Automation ---
      const autoPlanterLevel = mutableState.upgrades.autoPlanter.level;
      if (autoPlanterLevel > 0) {
          mutableState.autoPlanterCooldown -= 1;
          if (mutableState.autoPlanterCooldown <= 0) {
              const emptyTile = mutableState.plot.find(t => !t.hasTree);
              const treeCount = mutableState.plot.filter(t => t.hasTree).length;
              const plotCapacity = mutableState.plot.length;
              const currentPlantingCost = mutableState.costs.tree + (treeCount * 5);

              if (emptyTile && treeCount < plotCapacity && mutableState.resources.seeds >= currentPlantingCost) {
                  mutableState.resources.seeds -= currentPlantingCost;
                  emptyTile.hasTree = true;

                  // Fertilizer logic
                  const fertilizerChance = getUpgradeEffect('fertilizer', mutableState.upgrades.fertilizer.level);
                  if (Math.random() * 100 < fertilizerChance) {
                      emptyTile.isGolden = true;
                      addLog("Fertilizer worked! A golden sapling grew, producing extra seeds.");
                  }
                  
                  addLog("Auto Planter planted a new tree.");
              }
              mutableState.autoPlanterCooldown = getUpgradeEffect('autoPlanter', autoPlanterLevel);
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
                  addLog("Auto Shovel cleared a withered tree.");
              }
              mutableState.autoShovelCooldown = getUpgradeEffect('autoShovel', autoShovelLevel);
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
            tile.isWithered = true;
            witheredCountThisTick++;
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
    setGameState(prev => {
        const newState: GameState = JSON.parse(JSON.stringify(prev));
        const treeCount = newState.plot.filter(t => t.hasTree).length;

        switch(action) {
            case 'gatherSeeds': {
                newState.resources.seeds += getUpgradeEffect('gloves', newState.upgrades.gloves.level);
                break;
            }
            case 'plantTree': {
                const plotCapacity = newState.plot.length;
                const currentPlantingCost = newState.costs.tree + (treeCount * 5);
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
  }, [addLog]);
  
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
    const cost = getUpgradeCost(upgradeId, gameState.upgrades[upgradeId].level);
    return gameState.resources.seeds >= cost;
  }, [gameState.resources, gameState.upgrades]);

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

        if (upgradeId === 'cleanseSoil') {
            newState.treeLifespanSeeds = TREE_LIFESPAN_SEEDS + getUpgradeEffect('cleanseSoil', newState.upgrades.cleanseSoil.level);
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

  const handleStartGame = useCallback(() => {
    setHasStarted(true);
    addLog('Entering the garden...');
    if (titleAudioRef.current) {
      titleAudioRef.current.pause();
      titleAudioRef.current.currentTime = 0;
    }
    mainAudioRef.current?.play().catch(() => undefined);
  }, [addLog]);

  return (
    <div className="h-screen font-press-start text-sm p-1 sm:p-4 flex flex-col items-center selection:bg-pixel-accent selection:text-pixel-bg">
      <div className="w-full max-w-7xl flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <LogPanel logs={logs} />
          </div>
          <button
            type="button"
            aria-expanded={isSidebarOpen}
            aria-controls="mobile-sidebar"
            aria-label="Toggle menu"
            className="md:hidden flex-shrink-0 rounded-md border-2 border-pixel-border bg-pixel-panel p-2 shadow-pixel"
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

      {/* Mobile-only Resource Bar */}
      <div className="w-full max-w-7xl px-2 mb-2 md:hidden">
        <div className="bg-pixel-panel border-2 border-pixel-border shadow-pixel p-1 flex items-center justify-center gap-2">
          <SeedIcon />
          <span className="text-pixel-accent font-bold text-base">{formatNumber(gameState.resources.seeds || 0)}</span>
        </div>
      </div>
      
      <main className="w-full max-w-7xl flex-grow flex flex-col md:grid md:grid-cols-3 lg:grid-cols-6 gap-6 min-h-0 mt-1 md:mt-0">
        <div className="hidden lg:block lg:col-span-1 md:h-full">
            <InfoPanel upgrades={gameState.upgrades} />
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
          />
        </div>
      </main>
      <div
        className={`fixed inset-0 z-40 md:hidden ${isSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
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
          <div className="flex h-full flex-col justify-between min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto p-4 text-xs text-pixel-console-text">
              <p className="text-pixel-text/60 text-[11px] leading-relaxed">
                Soon
              </p>
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
  <audio ref={titleAudioRef} src="/audio/titlescreen.mp3" preload="auto" />
  <audio ref={mainAudioRef} src="/audio/mainbg.mp3" preload="auto" />
      {isDebugVisible && <DebugPanel setGameState={setGameState} addLog={addLog} />}
      {!hasStarted && <TitleScreen onStart={handleStartGame} />}
    </div>
  );
};

export default App;
