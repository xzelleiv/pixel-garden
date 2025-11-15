import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { GameState, PlotTile, Preferences } from './types';
import { INITIAL_GAME_STATE, UPGRADES, PLANTING_MILESTONES, getUpgradeCost, getUpgradeEffect, EVENTS, TREE_LIFESPAN_SEEDS, SEASON_MULTIPLIERS, SEASON_DURATION, formatNumber, SEASON_TIPS, MILESTONE_REWARDS, getUpgradeMilestoneRequirement, GOLDEN_TREE_DURATION_MS, DIAMOND_TREE_DURATION_MS } from './constants';
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
import SeasonalParticles from './components/SeasonalParticles';
import { registerSW } from 'virtual:pwa-register';

type UpdateStatus = 'idle' | 'checking' | 'ready' | 'upToDate' | 'error';
const IS_DEV = import.meta?.env?.DEV ?? false;

const SAVE_KEY = 'pixelGardenSave';
type AudioTrack = 'title' | 'mainIntro' | 'main' | 'none';

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
const AUTO_ACTION_LOG_INTERVAL_MS = 45000;

const calculatePlantingCost = (treeCount: number, baseCost: number, seedVaultLevel: number): number => {
  const discountPerTree = seedVaultLevel > 0 ? getUpgradeEffect('seedVault', seedVaultLevel) : 0;
  const incrementalCost = Math.max(MIN_PLANTING_INCREMENT, BASE_PLANTING_INCREMENT - discountPerTree);
  return baseCost + (treeCount * incrementalCost);
};

const scheduleRareExpiry = (tile: PlotTile) => {
  if (tile.isDiamond) {
    tile.rareExpiresAt = Date.now() + DIAMOND_TREE_DURATION_MS;
  } else if (tile.isGolden) {
    tile.rareExpiresAt = Date.now() + GOLDEN_TREE_DURATION_MS;
  } else {
    tile.rareExpiresAt = undefined;
  }
};

const ensureRareExpiry = (tile: PlotTile) => {
  if ((tile.isDiamond || tile.isGolden) && !tile.rareExpiresAt) {
    scheduleRareExpiry(tile);
  }
};

const clearRareExpiry = (tile: PlotTile) => {
  tile.rareExpiresAt = undefined;
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
  const mainIntroAudioRef = useRef<HTMLAudioElement | null>(null);
  const mainAudioRef = useRef<HTMLAudioElement | null>(null);
  const witherAudioRef = useRef<HTMLAudioElement | null>(null);
  const milestoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const clickAudioRef = useRef<HTMLAudioElement | null>(null);
  const goldDiamondAudioRef = useRef<HTMLAudioElement | null>(null);
  const weatherChangeAudioRef = useRef<HTMLAudioElement | null>(null);
  const countdownAudioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrack, setCurrentTrack] = useState<AudioTrack>('title');
  const [awaitingUserGesture, setAwaitingUserGesture] = useState(false);
  const awaitingUserGestureRef = useRef(false);
  const [audioVolume, setAudioVolume] = useState(0.65);
  const effectsVolume = gameState.preferences.effectsVolume ?? 1;
  const preferencesRef = useRef<Preferences>(gameState.preferences);
  const confettiTimeoutsRef = useRef<number[]>([]);
  const throttledLogsRef = useRef<Record<string, number>>({});
  const witherAudioPrimedRef = useRef(false);
  const milestoneAudioPrimedRef = useRef(false);
  const clickAudioPrimedRef = useRef(false);
  const goldDiamondAudioPrimedRef = useRef(false);
  const weatherChangeAudioPrimedRef = useRef(false);
  const countdownAudioPrimedRef = useRef(false);
  const rareTreeCountsRef = useRef({ golden: 0, diamond: 0, initialized: false });
  const [isSeasonTransitioning, setIsSeasonTransitioning] = useState(false);
  const seasonTransitionTimeoutRef = useRef<number | null>(null);
  const seasonTransitionInitializedRef = useRef(false);
  const previousSeasonRef = useRef<GameState['currentSeason']>(gameState.currentSeason);
  const seasonCountdownPlayedRef = useRef(false);
  const gameStateRef = useRef<GameState>(gameState);
  const swUpdateRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const hasPendingUpdateRef = useRef(false);
  const [isUpdateChecking, setIsUpdateChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');

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
    gameStateRef.current = gameState;
  }, [gameState]);

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
    if (e.ctrlKey && e.altKey && e.key === 'Home') {
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

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.dataset.season = gameState.currentSeason;
    return () => {
      document.body.dataset.season = 'summer';
    };
  }, [gameState.currentSeason]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!seasonTransitionInitializedRef.current) {
      seasonTransitionInitializedRef.current = true;
      return;
    }
    setIsSeasonTransitioning(true);
    if (seasonTransitionTimeoutRef.current) {
      window.clearTimeout(seasonTransitionTimeoutRef.current);
    }
    seasonTransitionTimeoutRef.current = window.setTimeout(() => {
      setIsSeasonTransitioning(false);
      seasonTransitionTimeoutRef.current = null;
    }, 900);

    return () => {
      if (seasonTransitionTimeoutRef.current) {
        window.clearTimeout(seasonTransitionTimeoutRef.current);
        seasonTransitionTimeoutRef.current = null;
      }
    };
  }, [gameState.currentSeason]);


  const persistLatestSave = useCallback(() => {
    try {
      const currentState = gameStateRef.current;
      if (!currentState) return;
      localStorage.setItem(SAVE_KEY, JSON.stringify(currentState));
    } catch (error) {
      console.error('Failed to persist progress before applying update:', error);
    }
  }, []);

  useEffect(() => {
    if (IS_DEV) {
      setUpdateStatus('idle');
      return;
    }
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const updateSW = registerSW({
      immediate: false,
      onNeedRefresh() {
        hasPendingUpdateRef.current = true;
        setUpdateStatus('ready');
      },
      onRegisteredSW(_swUrl, registration) {
        swRegistrationRef.current = registration ?? null;
      },
      onRegisterError(error) {
        console.error('Service worker registration failed:', error);
        setUpdateStatus('error');
      },
    });
    swUpdateRef.current = updateSW;
    return () => {
      swUpdateRef.current = null;
    };
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    if (IS_DEV) {
      setUpdateStatus('upToDate');
      return;
    }
    if (isUpdateChecking) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setUpdateStatus('error');
      return;
    }
    if (hasPendingUpdateRef.current && swUpdateRef.current) {
      persistLatestSave();
      try {
        await swUpdateRef.current(true);
      } catch (error) {
        console.error('Update application failed:', error);
        setUpdateStatus('error');
        return;
      }
      hasPendingUpdateRef.current = false;
      setUpdateStatus('upToDate');
      return;
    }
    setIsUpdateChecking(true);
    setUpdateStatus('checking');
    persistLatestSave();
    try {
      if (swRegistrationRef.current) {
        await swRegistrationRef.current.update();
      }
      if (swUpdateRef.current) {
        await swUpdateRef.current(true);
        hasPendingUpdateRef.current = false;
        setUpdateStatus('upToDate');
      } else {
        setUpdateStatus('upToDate');
      }
    } catch (error) {
      console.error('Update check failed:', error);
      setUpdateStatus('error');
    } finally {
      setIsUpdateChecking(false);
    }
  }, [isUpdateChecking, persistLatestSave]);

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

  const primeAudio = useCallback((audioRef: React.MutableRefObject<HTMLAudioElement | null>, primedRef: React.MutableRefObject<boolean>) => {
    if (primedRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    const originalMuted = audio.muted;
    audio.muted = true;
    audio.currentTime = 0;
    const playPromise = audio.play();
    const finalize = () => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = originalMuted;
      primedRef.current = true;
    };
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(finalize)
        .catch(() => {
          audio.muted = originalMuted;
        });
    } else {
      finalize();
    }
  }, []);

  const primeWitherAudio = useCallback(() => {
    primeAudio(witherAudioRef, witherAudioPrimedRef);
  }, [primeAudio]);

  const primeMilestoneAudio = useCallback(() => {
    primeAudio(milestoneAudioRef, milestoneAudioPrimedRef);
  }, [primeAudio]);

  const primeClickAudio = useCallback(() => {
    primeAudio(clickAudioRef, clickAudioPrimedRef);
  }, [primeAudio]);

  const primeGoldDiamondAudio = useCallback(() => {
    primeAudio(goldDiamondAudioRef, goldDiamondAudioPrimedRef);
  }, [primeAudio]);

  const primeWeatherChangeAudio = useCallback(() => {
    primeAudio(weatherChangeAudioRef, weatherChangeAudioPrimedRef);
  }, [primeAudio]);

  const primeCountdownAudio = useCallback(() => {
    primeAudio(countdownAudioRef, countdownAudioPrimedRef);
  }, [primeAudio]);

  const handleUserGesture = useCallback(
    (trackOverride?: AudioTrack) => {
      clearAwaitsGesture();
      primeWitherAudio();
      primeMilestoneAudio();
      primeClickAudio();
      primeGoldDiamondAudio();
      primeWeatherChangeAudio();
      primeCountdownAudio();
      const targetTrack = trackOverride ?? currentTrack;
      if (targetTrack === 'title') {
        attemptPlayback(titleAudioRef.current);
      } else if (targetTrack === 'mainIntro') {
        attemptPlayback(mainIntroAudioRef.current);
      } else if (targetTrack === 'main') {
        attemptPlayback(mainAudioRef.current);
      }
    },
    [attemptPlayback, clearAwaitsGesture, currentTrack, primeClickAudio, primeCountdownAudio, primeGoldDiamondAudio, primeMilestoneAudio, primeWeatherChangeAudio, primeWitherAudio]
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
    const introAudio = mainIntroAudioRef.current;
    if (introAudio) {
      introAudio.loop = false;
      introAudio.volume = audioVolume;
    }
    const mainAudio = mainAudioRef.current;
    if (mainAudio) {
      mainAudio.loop = false;
      mainAudio.volume = audioVolume;
    }
    const witherAudio = witherAudioRef.current;
    if (witherAudio) {
      witherAudio.volume = effectsVolume;
    }
    const milestoneAudio = milestoneAudioRef.current;
    if (milestoneAudio) {
      milestoneAudio.volume = effectsVolume;
    }
    const clickAudio = clickAudioRef.current;
    if (clickAudio) {
      clickAudio.volume = effectsVolume;
    }
    const rareAudio = goldDiamondAudioRef.current;
    if (rareAudio) {
      rareAudio.volume = effectsVolume;
    }
    const weatherAudio = weatherChangeAudioRef.current;
    if (weatherAudio) {
      weatherAudio.volume = effectsVolume;
    }
    const countdownAudio = countdownAudioRef.current;
    if (countdownAudio) {
      countdownAudio.volume = effectsVolume;
    }
  }, [audioVolume, effectsVolume]);

  useEffect(() => {
    if (currentTrack === 'title') {
      mainIntroAudioRef.current?.pause();
      if (mainAudioRef.current) {
        mainAudioRef.current.pause();
        mainAudioRef.current.currentTime = 0;
      }
      attemptPlayback(titleAudioRef.current);
    } else if (currentTrack === 'mainIntro') {
      titleAudioRef.current?.pause();
      if (mainAudioRef.current) {
        mainAudioRef.current.pause();
        mainAudioRef.current.currentTime = 0;
      }
      attemptPlayback(mainIntroAudioRef.current);
    } else if (currentTrack === 'main') {
      titleAudioRef.current?.pause();
      if (mainIntroAudioRef.current) {
        mainIntroAudioRef.current.pause();
        mainIntroAudioRef.current.currentTime = 0;
      }
      attemptPlayback(mainAudioRef.current);
    } else {
      titleAudioRef.current?.pause();
      mainIntroAudioRef.current?.pause();
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

  useEffect(() => {
    const introAudio = mainIntroAudioRef.current;
    if (!introAudio) return;
    const handleEnded = () => {
      setCurrentTrack(prev => (prev === 'mainIntro' ? 'main' : prev));
    };
    introAudio.addEventListener('ended', handleEnded);
    return () => {
      introAudio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    const mainAudio = mainAudioRef.current;
    if (!mainAudio) return;
    const handleEnded = () => {
      setCurrentTrack(prev => (prev === 'main' ? 'mainIntro' : prev));
    };
    mainAudio.addEventListener('ended', handleEnded);
    return () => {
      mainAudio.removeEventListener('ended', handleEnded);
    };
  }, []);

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

  const playWitherClearSound = useCallback(() => {
    if (effectsVolume <= 0) return;
    if (!witherAudioPrimedRef.current) {
      primeWitherAudio();
    }
    const audio = witherAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(error => {
          console.error('Wither clear audio failed to play', error);
          markAwaitingGesture();
        });
      }
    } catch (error) {
      console.error('Failed to play wither clear audio', error);
    }
  }, [effectsVolume, markAwaitingGesture, primeWitherAudio]);

  const playMilestoneSound = useCallback(() => {
    if (effectsVolume <= 0) return;
    if (!milestoneAudioPrimedRef.current) {
      primeMilestoneAudio();
    }
    const audio = milestoneAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(error => {
          console.error('Milestone audio failed to play', error);
          markAwaitingGesture();
        });
      }
    } catch (error) {
      console.error('Failed to play milestone audio', error);
    }
  }, [effectsVolume, markAwaitingGesture, primeMilestoneAudio]);

  const playClickSound = useCallback(() => {
    if (effectsVolume <= 0) return;
    if (!clickAudioPrimedRef.current) {
      primeClickAudio();
    }
    const audio = clickAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(error => {
          console.error('Click audio failed to play', error);
          markAwaitingGesture();
        });
      }
    } catch (error) {
      console.error('Failed to play click audio', error);
    }
  }, [effectsVolume, markAwaitingGesture, primeClickAudio]);

  const playGoldDiamondSound = useCallback(() => {
    if (effectsVolume <= 0) return;
    if (!goldDiamondAudioPrimedRef.current) {
      primeGoldDiamondAudio();
    }
    const audio = goldDiamondAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(error => {
          console.error('Rare tree audio failed to play', error);
          markAwaitingGesture();
        });
      }
    } catch (error) {
      console.error('Failed to play rare tree audio', error);
    }
  }, [effectsVolume, markAwaitingGesture, primeGoldDiamondAudio]);

  const playWeatherChangeSound = useCallback(() => {
    if (effectsVolume <= 0) return;
    if (!weatherChangeAudioPrimedRef.current) {
      primeWeatherChangeAudio();
    }
    const audio = weatherChangeAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(error => {
          console.error('Weather change audio failed to play', error);
          markAwaitingGesture();
        });
      }
    } catch (error) {
      console.error('Failed to play weather change audio', error);
    }
  }, [effectsVolume, markAwaitingGesture, primeWeatherChangeAudio]);

  const playSeasonCountdownSound = useCallback(() => {
    if (effectsVolume <= 0) return;
    if (!countdownAudioPrimedRef.current) {
      primeCountdownAudio();
    }
    const audio = countdownAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(error => {
          console.error('Season countdown audio failed to play', error);
          markAwaitingGesture();
        });
      }
    } catch (error) {
      console.error('Failed to play season countdown audio', error);
    }
  }, [effectsVolume, markAwaitingGesture, primeCountdownAudio]);

  useEffect(() => {
    if (previousSeasonRef.current !== gameState.currentSeason) {
      if (previousSeasonRef.current) {
        playWeatherChangeSound();
      }
      previousSeasonRef.current = gameState.currentSeason;
      seasonCountdownPlayedRef.current = false;
    }
  }, [gameState.currentSeason, playWeatherChangeSound]);

  useEffect(() => {
    if (gameState.seasonDuration > 4) {
      seasonCountdownPlayedRef.current = false;
      return;
    }
    if (gameState.seasonDuration > 0 && gameState.seasonDuration <= 4) {
      if (!seasonCountdownPlayedRef.current) {
        playSeasonCountdownSound();
        seasonCountdownPlayedRef.current = true;
      }
    }
  }, [gameState.seasonDuration, playSeasonCountdownSound]);

  useEffect(() => {
    const goldenCount = gameState.plot.filter(tile => tile.isGolden).length;
    const diamondCount = gameState.plot.filter(tile => tile.isDiamond).length;
    if (!rareTreeCountsRef.current.initialized) {
      rareTreeCountsRef.current = {
        golden: goldenCount,
        diamond: diamondCount,
        initialized: true,
      };
      return;
    }
    const previous = rareTreeCountsRef.current;
    if (goldenCount > previous.golden || diamondCount > previous.diamond) {
      playGoldDiamondSound();
    }
    rareTreeCountsRef.current = {
      golden: goldenCount,
      diamond: diamondCount,
      initialized: true,
    };
  }, [gameState.plot, playGoldDiamondSound]);

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
          emptyTile.isWithered = false;
          emptyTile.seedsGenerated = 0;
          emptyTile.isGolden = false;
          emptyTile.isDiamond = false;
          clearRareExpiry(emptyTile);

          // Fertilizer logic
          const fertilizerChance = getUpgradeEffect('fertilizer', mutableState.upgrades.fertilizer.level);
          if (Math.random() * 100 < fertilizerChance) {
            emptyTile.isGolden = true;
            emptyTile.isDiamond = false;
            scheduleRareExpiry(emptyTile);
            addLog("Fertilizer worked! A golden sapling grew, producing extra seeds.");
          }
                    
          logWithThrottle('autoPlanter', 'Auto Planter planted a new tree.', AUTO_ACTION_LOG_INTERVAL_MS);
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
                  clearRareExpiry(witheredTile);
                  playWitherClearSound();
                  let currentCompostBonus = getUpgradeEffect('shovel', mutableState.upgrades.shovel.level) + getUpgradeEffect('composter', mutableState.upgrades.composter.level);
                  if (wasDiamond) currentCompostBonus *= 10;
                  else if (wasGolden) currentCompostBonus *= 5;
                  mutableState.resources.seeds += currentCompostBonus;
          logWithThrottle('autoShovel', 'Auto Shovel cleared a withered tree.', AUTO_ACTION_LOG_INTERVAL_MS);
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
            if (lucky) {
              scheduleRareExpiry(emptyTile);
            } else {
              clearRareExpiry(emptyTile);
            }
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

      const now = Date.now();
      mutableState.plot.forEach((tile: PlotTile) => {
        if (tile.hasTree && !tile.isWithered) {
          if (tile.isGolden || tile.isDiamond) {
            ensureRareExpiry(tile);
          }
          const rareExpiry = tile.rareExpiresAt ?? null;
          const hasRareStatus = tile.isGolden || tile.isDiamond;

          if (hasRareStatus && rareExpiry && now >= rareExpiry) {
            tile.isWithered = true;
            clearRareExpiry(tile);
            witheredCountThisTick++;
            return;
          }

          let generationMultiplier = 1;
          if (tile.isDiamond) generationMultiplier = 5;
          else if (tile.isGolden) generationMultiplier = 2;

          const seedsThisTick = currentSeedGenRate * generationMultiplier;

          seedsGained += seedsThisTick;
          tile.seedsGenerated += seedsThisTick;
          if (tile.seedsGenerated >= mutableState.treeLifespanSeeds) {
            const savedBySprinklers = sprinklerChance > 0 && Math.random() * 100 < sprinklerChance;
            if (hasRareStatus && rareExpiry && now < rareExpiry) {
              tile.seedsGenerated = Math.floor(mutableState.treeLifespanSeeds * 0.5);
            } else if (savedBySprinklers) {
              tile.seedsGenerated = Math.floor(mutableState.treeLifespanSeeds * 0.5);
              if (Math.random() < 0.2) {
                addLog('Sprinklers saved a tree from withering.');
              }
            } else {
              tile.isWithered = true;
              clearRareExpiry(tile);
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
  }, [addLog, playWitherClearSound]);

  useGameLoop(gameTick, hasStarted ? 1000 : null);

  const handleAction = useCallback((action: string) => {
    const shouldPlayClick = action !== 'clearWithered';
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
          emptyTile.isWithered = false;
          emptyTile.seedsGenerated = 0;
          emptyTile.isGolden = false;
          emptyTile.isDiamond = false;
          clearRareExpiry(emptyTile);
                    
                    // Fertilizer logic
                    const fertilizerChance = getUpgradeEffect('fertilizer', newState.upgrades.fertilizer.level);
                    if (Math.random() * 100 < fertilizerChance) {
                        emptyTile.isGolden = true;
            emptyTile.isDiamond = false;
            scheduleRareExpiry(emptyTile);
                        addLog("Fertilizer worked! A golden sapling grew, producing extra seeds.");
                    }

                    newState.totalTreesPlanted += 1;
                    const milestone = PLANTING_MILESTONES.find(m => m === newState.totalTreesPlanted);
                    if (milestone && !newState.loggedMilestones[`planted${milestone}`]) {
                playMilestoneSound();
                       addLog(milestone === 1 ? "Planted your first tree." : `Planted ${milestone} trees.`);
                       const rewards = MILESTONE_REWARDS[milestone];
                       if (rewards) {
                         rewards.forEach((reward, rewardIndex) => {
                           if (reward.type === 'gatherBonus') {
                             if (!newState.milestoneBonuses) {
                               newState.milestoneBonuses = { gatherBonus: 0 };
                             }
                             newState.milestoneBonuses.gatherBonus += reward.amount;
                           }
                           logWithThrottle(
                             `milestone-reward-${milestone}-${rewardIndex}`,
                             reward.message,
                             LOG_THROTTLE_MS
                           );
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
                    clearRareExpiry(witheredTile);
                    playWitherClearSound();

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
    if (shouldPlayClick) {
      playClickSound();
    }
    if (triggeredConfettiLevel !== null && !preferencesRef.current.disableConfetti) {
      triggerConfettiBurst(triggeredConfettiLevel);
    }
  }, [addLog, logWithThrottle, playClickSound, playMilestoneSound, triggerConfettiBurst, playWitherClearSound]);
  
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
    playClickSound();
    
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
        rareExpiresAt: undefined,
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
  }, [addLog, canAffordUpgrade, gameState.upgrades, playClickSound]);

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
    <div className="min-h-screen h-screen w-full relative overflow-hidden" style={{ background: 'var(--season-bg-secondary, #3c2f2f)' }}>
      <div
        className={`absolute inset-0 -z-20 transition-all duration-700 ease-out ${isSeasonTransitioning ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
        style={{ background: 'var(--season-bg, #3c2f2f)' }}
        aria-hidden="true"
      />
      <div
        className={`absolute inset-0 -z-10 pointer-events-none transition-opacity duration-700 ease-out mix-blend-screen bg-gradient-to-br from-white/20 via-transparent to-transparent ${isSeasonTransitioning ? 'opacity-40' : 'opacity-0'}`}
        aria-hidden="true"
      />
      {!gameState.preferences.disableParticles && (
        <SeasonalParticles season={gameState.currentSeason} reducedMotion={gameState.preferences.reducedMotion} />
      )}
  <div className="relative z-10 h-full font-press-start text-sm p-1 sm:p-4 flex flex-col items-center selection:bg-pixel-accent selection:text-pixel-bg">
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
            className="season-button flex-shrink-0 rounded-md border-2 border-pixel-border p-2 shadow-pixel"
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
        <div className="season-panel-solid bg-pixel-panel border-2 border-pixel-border shadow-pixel p-1 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <SeedIcon />
            <span className="text-pixel-accent font-bold text-base">{formatNumber(gameState.resources.seeds || 0)}</span>
          </div>
          {nextMilestoneValue && (
            <button
              type="button"
              onClick={() => setIsMobileMilestoneOpen(prev => !prev)}
              className="season-button flex items-center justify-center rounded border border-pixel-border px-2 py-1 text-lg leading-none shadow-pixel"
              aria-expanded={isMobileMilestoneOpen}
              aria-label={isMobileMilestoneOpen ? 'Hide milestone details' : 'Show milestone details'}
            >
              {isMobileMilestoneOpen ? '−' : '+'}
            </button>
          )}
        </div>
        {nextMilestoneValue && isMobileMilestoneOpen && (
          <div className="season-panel-solid mt-2 rounded-lg border-2 border-pixel-border bg-pixel-panel/80 px-3 py-2 text-[11px] leading-snug text-pixel-text/80">
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
      
  <main className="w-full max-w-7xl flex-1 h-full flex flex-col md:grid md:grid-cols-3 lg:grid-cols-6 md:[grid-auto-rows:minmax(0,1fr)] md:items-stretch gap-4 md:gap-6 min-h-0 mt-1 md:mt-0">
        <div className="hidden lg:block lg:col-span-1 h-full min-h-0 overflow-hidden">
            <div className="h-full">
              <InfoPanel
                upgrades={gameState.upgrades}
              />
            </div>
        </div>
        
        <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-4 md:h-full h-full min-h-0">
            <div className="flex-grow flex items-center justify-center min-h-0">
                <Plot tiles={gameState.plot} currentSeason={gameState.currentSeason} />
            </div>
        </div>

  <div className="md:col-span-1 lg:col-span-2 h-full min-h-0 flex w-full overflow-visible">
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
          className={`season-panel-solid absolute right-0 top-0 h-full w-64 max-w-[75vw] bg-pixel-panel border-l-2 border-pixel-border shadow-[0_0_30px_rgba(0,0,0,0.9)] p-0 transition-transform duration-200 ${
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
                className="season-button text-2xl leading-none px-3 py-1"
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
                onCheckForUpdates={handleCheckForUpdates}
                isUpdateChecking={isUpdateChecking}
                updateStatus={updateStatus}
              />
            </div>
            <div className="season-panel-solid sticky bottom-0 border-t border-pixel-border bg-pixel-panel/70 p-4 backdrop-blur-sm">
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
  <audio ref={mainIntroAudioRef} src={getAssetUrl('audio/mainbg1.mp3')} preload="auto" />
  <audio ref={mainAudioRef} src={getAssetUrl('audio/mainbg.mp3')} preload="auto" />
  <audio ref={witherAudioRef} src={getAssetUrl('audio/witherpull.mp3')} preload="auto" />
  <audio ref={milestoneAudioRef} src={getAssetUrl('audio/milestone.mp3')} preload="auto" />
  <audio ref={clickAudioRef} src={getAssetUrl('audio/clicksound.mp3')} preload="auto" />
  <audio ref={goldDiamondAudioRef} src={getAssetUrl('audio/golddiamond.mp3')} preload="auto" />
  <audio ref={weatherChangeAudioRef} src={getAssetUrl('audio/weatherchange.mp3')} preload="auto" />
  <audio ref={countdownAudioRef} src={getAssetUrl('audio/countdown.mp3')} preload="auto" />
      {isDebugVisible && <DebugPanel setGameState={setGameState} addLog={addLog} />}
      {!hasStarted && <TitleScreen onStart={handleStartGame} />}
    </div>
    </div>
  );
};

export default App;
