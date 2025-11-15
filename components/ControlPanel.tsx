
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GameState, Resources, UpgradeDefinition, MilestoneReward } from '../types';
import { SeedIcon } from './icons';
import { UPGRADES, getUpgradeCost, getUpgradeEffect, formatNumber, SEASON_MULTIPLIERS, getUpgradeMilestoneRequirement, GAME_VERSION } from '../constants';

type Tab = 'Actions' | 'Upgrades' | 'Stats';

const UPGRADE_SECTIONS: Array<{ title: string; upgradeIds: string[] }> = [
  { title: 'Tools', upgradeIds: ['gloves', 'shovel', 'confettiCannon'] },
  { title: 'Cultivation', upgradeIds: ['betterSoil', 'composter', 'cleanseSoil', 'fertilizer', 'sprinklers', 'sunCore'] },
  { title: 'Expansion', upgradeIds: ['expandPlot', 'seedVault', 'greenhouse'] },
  { title: 'Automation', upgradeIds: ['autoPlanter', 'autoShovel', 'weatherStation', 'stormSatellite', 'gnomeInterns'] },
];

const ResourceItem: React.FC<{ icon: React.ReactNode; label: string; value: number; rate: number }> = ({ icon, label, value, rate }) => (
  <div className="flex items-center justify-between p-1">
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-pixel-text">{label}</span>
    </div>
    <div className="text-right">
      <span className="text-pixel-accent font-bold">{formatNumber(value)}</span>
      {rate > 0 && <span className="block text-xs text-pixel-tree">+{formatNumber(rate)}/s</span>}
    </div>
  </div>
);

const ActionButton: React.FC<{ 
  onClick?: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
  onTouchStart?: (e: React.TouchEvent<HTMLButtonElement>) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLButtonElement>) => void;
  onTouchCancel?: (e: React.TouchEvent<HTMLButtonElement>) => void;
  children: React.ReactNode; 
  disabled?: boolean; 
  cost?: number; 
  progress?: number;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  compact?: boolean;
}> = ({ onClick, onMouseDown, onMouseUp, onMouseLeave, onTouchStart, onTouchEnd, onTouchCancel, onPointerDown, onPointerUp, onPointerCancel, children, disabled, cost, progress, compact }) => {
  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      disabled={disabled}
                className={`season-button relative w-full ${compact ? 'p-2' : 'p-2 sm:p-4'} bg-pixel-border text-pixel-text font-bold shadow-pixel active:shadow-pixel-inset active:translate-y-px disabled:text-gray-500 disabled:cursor-not-allowed transition-colors flex items-center overflow-hidden touch-pan-y`}
      aria-disabled={disabled}
    >
      {typeof progress === 'number' && progress > 0 && (
        <div 
          className="absolute top-0 left-0 h-full bg-pixel-accent/75"
          style={{ width: `${progress}%`, transition: 'width 0.05s linear' }}
        />
      )}
      <div className={`relative flex w-full items-center ${cost ? 'justify-between' : 'justify-center'}`}>
        <span>{children}</span>
        {cost && (
          <span className="flex items-center gap-1 text-xs">
            <SeedIcon />
            <span>{cost}</span>
          </span>
        )}
      </div>
    </button>
  );
};

const StatusChip: React.FC<{ label: React.ReactNode; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex flex-col rounded-md border border-pixel-border/50 bg-pixel-panel/80 px-2 py-1 min-w-0">
    <span className="text-[10px] uppercase tracking-widest text-pixel-text/60 leading-tight">{label}</span>
    <span className="text-sm font-bold text-pixel-accent leading-tight break-words">{value}</span>
  </div>
);

const ClassicUpgradeRow: React.FC<{
  upgradeDef: UpgradeDefinition;
  level: number;
  onBuy: (id: string) => void;
  canAfford: boolean;
  locked?: boolean;
  requiredMilestone?: number;
}> = ({ upgradeDef, level, onBuy, canAfford, locked = false, requiredMilestone }) => {
  const cost = getUpgradeCost(upgradeDef.id, level);
  const buttonLabel = locked ? 'Locked' : level > 0 ? 'Upgrade' : 'Buy';

  return (
    <div className="rounded-lg border border-pixel-border/40 bg-pixel-panel/60 p-2 sm:p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-bold text-pixel-accent flex items-center gap-2 break-words">
          {upgradeDef.name}
          <span className="text-[10px] uppercase tracking-widest text-pixel-text/60">Lv {level}</span>
        </p>
        <p className="text-[11px] text-pixel-text/80 leading-snug break-words">{upgradeDef.description(level)}</p>
        {locked && requiredMilestone && (
          <p className="text-[10px] uppercase tracking-[0.2em] text-pixel-text/50">Unlocks at {requiredMilestone} trees</p>
        )}
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
        <span className="flex items-center gap-1 text-xs text-pixel-text">
          <SeedIcon />
          {formatNumber(cost)}
        </span>
        <button
          onClick={() => onBuy(upgradeDef.id)}
          disabled={locked || !canAfford}
          className="season-button px-3 py-1 bg-pixel-tree text-pixel-bg font-bold shadow-pixel active:shadow-pixel-inset active:translate-y-px disabled:text-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-xs"
        >
          {locked && requiredMilestone ? `Plant ${requiredMilestone}` : buttonLabel}
        </button>
      </div>
    </div>
  );
};

const ClassicUpgradeSection: React.FC<{ title: string; upgradeIds: string[]; gameState: GameState; onBuy: (id: string) => void; canAfford: (id: string) => boolean }> = ({ title, upgradeIds, gameState, onBuy, canAfford }) => (
  <div className="space-y-2">
    <h3 className="text-xs font-bold uppercase tracking-[0.4em] text-pixel-text/70">{title}</h3>
    <div className="space-y-2">
      {upgradeIds.map(id => {
        const upgradeDef = UPGRADES[id];
        const level = gameState.upgrades[id].level;
        const requiredMilestone = getUpgradeMilestoneRequirement(id, level + 1);
        const locked = requiredMilestone ? gameState.totalTreesPlanted < requiredMilestone : false;
        return (
          <ClassicUpgradeRow
            key={id}
            upgradeDef={upgradeDef}
            level={level}
            onBuy={onBuy}
            canAfford={canAfford(id)}
            locked={locked}
            requiredMilestone={requiredMilestone}
          />
        );
      })}
    </div>
  </div>
);

const UpgradeCard: React.FC<{
  upgradeDef: UpgradeDefinition;
  level: number;
  onBuy: (id: string) => void;
  canAfford: boolean;
  locked?: boolean;
  requiredMilestone?: number;
}> = ({ upgradeDef, level, onBuy, canAfford, locked = false, requiredMilestone }) => {
  const cost = getUpgradeCost(upgradeDef.id, level);
  const buttonLabel = locked ? 'Locked' : level > 0 ? 'Upgrade' : 'Buy';

    // icons for specific upgrades
    const ICONS: Record<string, string> = {
      gloves: 'https://tinyurl.com/dpae3z66',
      shovel: 'https://tinyurl.com/4tyd5jdk',
    };
    const iconUrl = ICONS[upgradeDef.id];

    return (
    <div className="bg-pixel-panel border-2 border-pixel-border p-2 flex flex-col justify-between items-start gap-1">
      <div className="flex-grow w-full">
        <div className="flex justify-between items-baseline">
            <div className="flex items-center gap-2">
              {iconUrl && (
                <img src={iconUrl} alt={`${upgradeDef.name} icon`} className="w-5 h-5" style={{ imageRendering: 'pixelated' }} />
              )}
              <h3 className="font-bold text-pixel-accent">{upgradeDef.name}</h3>
            </div>
            <span className="text-xs text-pixel-text/70">{level + 1}</span>
        </div>
        <p className="text-xs leading-tight text-pixel-text/80">{upgradeDef.description(level)}</p>
        {locked && requiredMilestone && (
          <p className="text-[10px] uppercase tracking-[0.2em] text-pixel-text/60 mt-1">Unlocks at {requiredMilestone} trees</p>
        )}
      </div>
      <div className="w-full flex justify-between items-center mt-1">
        <div className="flex gap-4">
             <span className="flex items-center gap-1 text-xs">
                <SeedIcon />
                <span>{formatNumber(cost)}</span>
            </span>
        </div>
        <button
          onClick={() => onBuy(upgradeDef.id)}
          disabled={locked || !canAfford}
          className="season-button px-3 py-1 bg-pixel-tree text-pixel-bg font-bold shadow-pixel active:shadow-pixel-inset active:translate-y-px disabled:text-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-xs"
        >
          {locked && requiredMilestone ? `Plant ${requiredMilestone}` : buttonLabel}
        </button>
      </div>
    </div>
  )};


const UpgradeCategory: React.FC<{
  title: string;
  upgradeIds: string[];
  gameState: GameState;
  onBuy: (id: string) => void;
  canAfford: (id: string) => boolean;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ title, upgradeIds, gameState, onBuy, canAfford, isExpanded, onToggle }) => (
  <div className="border border-pixel-border/30 rounded-lg p-2 bg-pixel-panel/70">
    <button
      type="button"
      onClick={onToggle}
      className="season-button flex w-full items-center justify-between text-left font-bold text-pixel-accent md:hidden"
    >
      <span>{title}</span>
      <span className="text-xl leading-none">{isExpanded ? '−' : '+'}</span>
    </button>
    <h3 className="hidden md:block text-lg text-pixel-accent border-b-2 border-pixel-border mb-2 pb-1">{title}</h3>
    <div className={`${isExpanded ? 'block' : 'hidden'} md:block mt-2 md:mt-0 space-y-2`}>
      {upgradeIds.map(id => {
        const upgradeDef = UPGRADES[id];
        const level = gameState.upgrades[id].level;
        const requiredMilestone = getUpgradeMilestoneRequirement(id, level + 1);
        const locked = requiredMilestone ? gameState.totalTreesPlanted < requiredMilestone : false;
        return (
          <UpgradeCard
            key={id}
            upgradeDef={upgradeDef}
            level={level}
            onBuy={onBuy}
            canAfford={canAfford(id)}
            locked={locked}
            requiredMilestone={requiredMilestone}
          />
        );
      })}
    </div>
  </div>
);

const formatTime = (totalSeconds: number): string => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const ControlPanel: React.FC<{ 
  gameState: GameState; 
  onAction: (action: string) => void; 
  onBuyUpgrade: (upgradeId: string) => void;
  canAffordUpgrade: (upgradeId: string) => boolean;
  resources: Partial<Resources>;
  autoGains: {
    seeds: number;
    manual: number;
    compost: number;
    normalTrees: number;
    goldenTrees: number;
    diamondTrees: number;
  };
  seedGenerationRate: number;
  onClearHoldStart: (e?: any) => void;
  onClearHoldEnd: (e?: any) => void;
  clearProgress: number;
  resetProgress: number;
  onResetHoldStart: (e?: any) => void;
  onResetHoldEnd: (e?: any) => void;
  nextMilestone: {
    value: number;
    rewards: MilestoneReward[];
    currentCount: number;
  } | null;
}> = ({ 
  gameState, 
  onAction, 
  onBuyUpgrade, 
  canAffordUpgrade, 
  resources,
  autoGains,
  seedGenerationRate,
  onClearHoldStart,
  onClearHoldEnd,
  clearProgress,
  resetProgress,
  onResetHoldStart,
  onResetHoldEnd,
  nextMilestone,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('Actions');
  const [milestoneOpen, setMilestoneOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() =>
    UPGRADE_SECTIONS.reduce((acc, section) => {
      acc[section.title] = section.title === 'Tools';
      return acc;
    }, {} as Record<string, boolean>)
  );
  useEffect(() => {
    setMilestoneOpen(false);
  }, [nextMilestone?.value]);
  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  }, []);
  const { upgrades, costs, plot } = gameState;
  const holdActiveRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const useClassicActions = !!gameState.preferences?.classicActionsUI;
  const useClassicUpgrades = !!gameState.preferences?.classicUpgradesUI;

  const hasShovel = (upgrades.shovel?.level ?? 0) > 0;
  const treeCount = plot.filter(t => t.hasTree).length;
  const healthyTreeCount = plot.filter(t => t.hasTree && !t.isWithered).length;
  const witheredCount = plot.filter(t => t.isWithered).length;
  const canClearWithered = witheredCount > 0;

  const plotCapacity = plot.length;
  const seedVaultLevel = upgrades.seedVault?.level ?? 0;
  const plantingIncrementReduction = seedVaultLevel > 0 ? getUpgradeEffect('seedVault', seedVaultLevel) : 0;
  const plantingIncrement = Math.max(1, 5 - plantingIncrementReduction);
  const currentPlantingCost = costs.tree + (treeCount * plantingIncrement);
  const autoPlanterInterval = upgrades.autoPlanter?.level > 0 ? getUpgradeEffect('autoPlanter', upgrades.autoPlanter.level) : null;
  const autoShovelInterval = upgrades.autoShovel?.level > 0 ? getUpgradeEffect('autoShovel', upgrades.autoShovel.level) : null;
  const milestoneRemaining = nextMilestone ? Math.max(0, nextMilestone.value - nextMilestone.currentCount) : 0;
  const milestonePercent = nextMilestone && nextMilestone.value > 0
    ? Math.min(100, Math.round((nextMilestone.currentCount / nextMilestone.value) * 100))
    : 0;

  const handleHoldStart = useCallback((event?: React.SyntheticEvent<HTMLButtonElement>) => {
    if (holdActiveRef.current) return;
    holdActiveRef.current = true;
    event?.preventDefault();
    onClearHoldStart?.(event);
  }, [onClearHoldStart]);

  const handleHoldEnd = useCallback((event?: React.SyntheticEvent<HTMLButtonElement>) => {
    if (!holdActiveRef.current) return;
    holdActiveRef.current = false;
    event?.preventDefault();
    if (pointerIdRef.current !== null && event?.currentTarget) {
      event.currentTarget.releasePointerCapture?.(pointerIdRef.current);
      pointerIdRef.current = null;
    }
    onClearHoldEnd?.(event);
  }, [onClearHoldEnd]);

  const handlePointerHoldStart = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (holdActiveRef.current) return;
    holdActiveRef.current = true;
    event.preventDefault();
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onClearHoldStart?.(event);
  }, [onClearHoldStart]);

  const handlePointerHoldEnd = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!holdActiveRef.current) return;
    holdActiveRef.current = false;
    event.preventDefault();
    if (pointerIdRef.current !== null) {
      event.currentTarget.releasePointerCapture?.(pointerIdRef.current);
      pointerIdRef.current = null;
    }
    onClearHoldEnd?.(event);
  }, [onClearHoldEnd]);

  let gatherButtonText: React.ReactNode = 'Gather Seeds';
  if (treeCount === 0) gatherButtonText = 'No trees planted';
  else if (healthyTreeCount === 0 && treeCount > 0) gatherButtonText = 'All trees withered';

  const TABS: Tab[] = ['Actions', 'Upgrades', 'Stats'];

  return (
  <div className="season-panel-solid bg-pixel-panel border-2 border-pixel-border shadow-pixel flex flex-col h-full w-full overflow-visible">
      {/* Integrated Resources Display */}
      <div className="hidden md:block p-2 lg:p-4 border-b-2 border-pixel-border">
          <h2 className="text-lg text-center mb-1">Resources</h2>
          <div className="space-y-1">
              <ResourceItem icon={<SeedIcon />} label="Seeds" value={resources.seeds || 0} rate={autoGains.seeds || 0} />
          </div>
          {nextMilestone && (
            <div className="mt-3 rounded-lg border border-pixel-border/40 bg-pixel-panel/80 p-3 text-[11px] text-pixel-text/80">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-pixel-text/50">Next Milestone</p>
                  <p className="text-pixel-accent font-bold text-sm">{formatNumber(nextMilestone.value)} trees</p>
                </div>
                <button
                  type="button"
                  aria-expanded={milestoneOpen}
                  aria-label={milestoneOpen ? 'Hide milestone rewards' : 'Show milestone rewards'}
                  onClick={() => setMilestoneOpen(prev => !prev)}
                  className="season-button flex h-7 w-7 items-center justify-center rounded border border-pixel-border bg-pixel-panel text-lg leading-none text-pixel-accent shadow-pixel"
                >
                  {milestoneOpen ? '−' : '+'}
                </button>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-pixel-border/30 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pixel-tree via-pixel-accent to-yellow-200"
                  style={{ width: `${milestonePercent}%` }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] uppercase tracking-[0.3em] text-pixel-text/60">
                <span>{milestonePercent}%</span>
                <span>{milestoneRemaining.toLocaleString()} to go</span>
              </div>
              {milestoneOpen && (
                <div className="mt-2 border-t border-pixel-border/30 pt-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-pixel-text/60 mb-1">Rewards</p>
                  <ul className="space-y-1 list-disc list-inside text-[11px] leading-snug">
                    {nextMilestone.rewards.map((reward, index) => (
                      <li key={`milestone-reward-${reward.type}-${index}`}>
                        {reward.type === 'unlockUpgrade' ? (
                          <span>
                            <span className="font-bold text-pixel-accent">{UPGRADES[reward.upgradeId]?.name ?? reward.upgradeId}</span>
                            <span className="text-pixel-text/70">: Unlock at {formatNumber(nextMilestone.value)} trees</span>
                          </span>
                        ) : reward.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
      </div>
      
      <div className="flex border-b-2 border-pixel-border">
        {TABS.map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`season-tab-button flex-1 py-2 px-2 text-center font-bold whitespace-nowrap ${
              activeTab === tab ? 'season-tab-button-active' : ''
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-2 lg:p-4 flex-grow flex flex-col overflow-hidden min-h-0">
  <div className="flex-grow overflow-y-auto min-h-0 pb-2 sm:pb-4">
          {activeTab === 'Actions' && (
            <div className="space-y-3">
              {!useClassicActions && (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatusChip
                    label="Season"
                    value={<span className="capitalize">{gameState.currentSeason}</span>}
                  />
                  <StatusChip
                    label={
                      <span>
                        <span className="sm:hidden">Generation</span>
                        <span className="hidden sm:inline">GEN</span>
                      </span>
                    }
                    value={`${formatNumber(autoGains.seeds)} /s`}
                  />
                  <StatusChip
                    label="Manual"
                    value={`${formatNumber(autoGains.manual)} seeds`}
                  />
                  <StatusChip
                    label="Compost"
                    value={upgrades.shovel?.level > 0 ? `${formatNumber(autoGains.compost)} seeds` : '—'}
                  />
                </div>
              )}

              <ActionButton onClick={() => onAction('gatherSeeds')} disabled={healthyTreeCount === 0} compact>
                {gatherButtonText}
              </ActionButton>

              <ActionButton 
                onClick={() => onAction('plantTree')} 
                disabled={treeCount >= plotCapacity || gameState.resources.seeds < currentPlantingCost} 
                cost={currentPlantingCost}
                compact
              >
                Plant Tree ({treeCount}/{plotCapacity})
              </ActionButton>

              <ActionButton
                onClick={() => {
                  if (hasShovel) {
                    onAction('clearWithered');
                  }
                }}
                onMouseDown={handleHoldStart}
                onMouseUp={handleHoldEnd}
                onTouchStart={handleHoldStart}
                onTouchEnd={handleHoldEnd}
                onTouchCancel={handleHoldEnd}
                onPointerDown={handlePointerHoldStart}
                onPointerUp={handlePointerHoldEnd}
                onPointerCancel={handlePointerHoldEnd}
                disabled={!canClearWithered}
                progress={clearProgress}
                compact
              >
                <span className="flex items-center gap-1">
                  <span>{clearProgress > 0 ? 'Clearing...' : 'Clear Withered'}</span>
                  {clearProgress === 0 && witheredCount > 0 && (
                    <span className="text-xs text-pixel-accent">({witheredCount})</span>
                  )}
                </span>
              </ActionButton>
              {!hasShovel && (
                <p className="text-[10px] text-pixel-text/60 text-center">
                  Hold the button to clear when shovels are locked.
                </p>
              )}

              {!useClassicActions && (upgrades.autoPlanter?.level > 0 || upgrades.autoShovel?.level > 0) && (
                <div className="hidden md:block rounded-lg border-2 border-pixel-border bg-pixel-panel/70 p-3 text-xs text-pixel-text/80">
                  <h3 className="text-pixel-accent font-bold mb-2 text-sm tracking-widest">Automation Timers</h3>
                  <div className="space-y-1">
                    {upgrades.autoPlanter?.level > 0 && (
                      <div className="flex justify-between">
                        <span>Auto Planter</span>
                        <span className="font-bold text-pixel-text">
                          {formatTime(Math.max(0, gameState.autoPlanterCooldown))}
                          {autoPlanterInterval !== null && (
                            <span className="text-pixel-text/60 text-[10px] ml-1">/ {formatTime(autoPlanterInterval)}</span>
                          )}
                        </span>
                      </div>
                    )}
                    {upgrades.autoShovel?.level > 0 && (
                      <div className="flex justify-between">
                        <span>Auto Shovel</span>
                        <span className="font-bold text-pixel-text">
                          {formatTime(Math.max(0, gameState.autoShovelCooldown))}
                          {autoShovelInterval !== null && (
                            <span className="text-pixel-text/60 text-[10px] ml-1">/ {formatTime(autoShovelInterval)}</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'Upgrades' && (
            <div className="space-y-3">
              {useClassicUpgrades ? (
                <div className="space-y-4">
                  {UPGRADE_SECTIONS.map(section => (
                    <ClassicUpgradeSection
                      key={section.title}
                      title={section.title}
                      upgradeIds={section.upgradeIds}
                      gameState={gameState}
                      onBuy={onBuyUpgrade}
                      canAfford={canAffordUpgrade}
                    />
                  ))}
                </div>
              ) : (
                UPGRADE_SECTIONS.map(section => (
                  <UpgradeCategory
                    key={section.title}
                    title={section.title}
                    upgradeIds={section.upgradeIds}
                    gameState={gameState}
                    onBuy={onBuyUpgrade}
                    canAfford={canAffordUpgrade}
                    isExpanded={expandedCategories[section.title]}
                    onToggle={() => toggleCategory(section.title)}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === 'Stats' && (
            <div className="flex flex-col gap-4">
              {/* Season Info */}
              <div>
                <h3 className="text-lg text-pixel-accent mb-1">Season Info</h3>
                <div className="text-xs space-y-1 text-pixel-text/80">
                    <div className="flex justify-between">
                        <span>Current Season:</span>
                        <span className="font-bold text-pixel-text capitalize">{gameState.currentSeason}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Seed Bonus:</span>
                        <span className="font-bold text-pixel-accent">{SEASON_MULTIPLIERS[gameState.currentSeason]}x</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Time Remaining:</span>
                        <span className="font-bold text-pixel-text">{formatTime(gameState.seasonDuration)}</span>
                    </div>
                </div>
              </div>

              <div className="pt-2 border-t-2 border-pixel-border">
                <h3 className="text-lg text-pixel-accent mb-1">Info</h3>
                <div className="text-xs space-y-1 text-pixel-text/80">
                  <div className="flex justify-between">
                    <span>Manual Gather:</span>
                    <span className="font-bold text-pixel-text">{autoGains.manual} Seeds</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Generation:</span>
                    <span className="font-bold text-pixel-text">{formatNumber(autoGains.seeds)} Seeds/s</span>
                  </div>
                  {(autoGains.goldenTrees > 0 || autoGains.diamondTrees > 0) && (
                      <div className="pl-4 mt-1 text-pixel-text/80 text-xs space-y-0.5">
                          {autoGains.normalTrees > 0 && (
                              <div className="flex justify-between">
                                  <span>Normal Trees ({autoGains.normalTrees}):</span>
                                  <span className="font-bold text-pixel-text">{formatNumber(autoGains.normalTrees * seedGenerationRate * SEASON_MULTIPLIERS[gameState.currentSeason])}/s</span>
                              </div>
                          )}
                          {autoGains.goldenTrees > 0 && (
                              <div className="flex justify-between">
                                  <span>Golden Trees ({autoGains.goldenTrees}):</span>
                                  <span className="font-bold text-pixel-accent">{formatNumber(autoGains.goldenTrees * seedGenerationRate * 2 * SEASON_MULTIPLIERS[gameState.currentSeason])}/s</span>
                              </div>
                          )}
                          {autoGains.diamondTrees > 0 && (
                              <div className="flex justify-between">
                                  <span>Diamond Trees ({autoGains.diamondTrees}):</span>
                                  <span className="font-bold text-cyan-400">{formatNumber(autoGains.diamondTrees * seedGenerationRate * 5 * SEASON_MULTIPLIERS[gameState.currentSeason])}/s</span>
                              </div>
                          )}
                      </div>
                  )}
                  {upgrades.shovel?.level > 0 && (
                    <div className="flex justify-between">
                      <span>Compost Bonus:</span>
                      <span className="font-bold text-pixel-text">{autoGains.compost} Seeds</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Tree Lifespan:</span>
                    <span className="font-bold text-pixel-text">{gameState.treeLifespanSeeds} Seeds</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Peak Seeds:</span>
                    <span className="font-bold text-pixel-text">{formatNumber(gameState.peakSeeds)} Seeds</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Plant Cost Step:</span>
                    <span className="font-bold text-pixel-text">{formatNumber(plantingIncrement)} Seeds</span>
                  </div>
                </div>
              </div>

              {nextMilestone && (
                <div className="pt-2 border-t-2 border-pixel-border">
                  <h3 className="text-lg text-pixel-accent mb-1">Next Milestone</h3>
                  <p className="text-xs text-pixel-text/80">
                    Plant <span className="text-pixel-text font-bold">{nextMilestone.value - gameState.totalTreesPlanted}</span> more tree{nextMilestone.value - gameState.totalTreesPlanted === 1 ? '' : 's'} to reach {formatNumber(nextMilestone.value)} total.
                  </p>
                </div>
              )}

              {useClassicActions && (upgrades.autoPlanter?.level > 0 || upgrades.autoShovel?.level > 0) && (
                <div className="pt-2 border-t-2 border-pixel-border">
                  <h3 className="text-lg text-pixel-accent mb-1">Automation</h3>
                  <div className="text-xs space-y-1 text-pixel-text/80">
                    {upgrades.autoPlanter?.level > 0 && (
                      <div className="flex justify-between">
                        <span>Auto Planter:</span>
                        <span className="font-bold text-pixel-text">
                          {formatTime(Math.max(0, gameState.autoPlanterCooldown))}
                          {autoPlanterInterval !== null && (
                            <span className="text-pixel-text/60 text-[10px] ml-1">/ {formatTime(autoPlanterInterval)}</span>
                          )}
                        </span>
                      </div>
                    )}
                    {upgrades.autoShovel?.level > 0 && (
                      <div className="flex justify-between">
                        <span>Auto Shovel:</span>
                        <span className="font-bold text-pixel-text">
                          {formatTime(Math.max(0, gameState.autoShovelCooldown))}
                          {autoShovelInterval !== null && (
                            <span className="text-pixel-text/60 text-[10px] ml-1">/ {formatTime(autoShovelInterval)}</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Credits footer */}
              <div className="mt-4 pt-2 border-t-2 border-pixel-border text-xs text-pixel-text/70">
                <div className="font-bold text-pixel-accent mb-1">Credits</div>
                <div>Developer: Pasao</div>
                <div>Co-Developer: Scoggins</div>
                <div>Assets: Cuaresma, Mas</div>
                <div>Version: {GAME_VERSION}</div>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'Stats' && (
          <div className="mt-4 pt-2 border-t-2 border-pixel-border text-center">
            <button
              onMouseDown={onResetHoldStart}
              onMouseUp={onResetHoldEnd}
              onMouseLeave={onResetHoldEnd}
              onTouchStart={(e) => { e.preventDefault(); onResetHoldStart(e); }}
              onTouchEnd={(e) => { e.preventDefault(); onResetHoldEnd(e); }}
              onTouchCancel={(e) => { e.preventDefault(); onResetHoldEnd(e); }}
              className="relative overflow-hidden px-3 py-1 bg-red-700 text-pixel-bg font-bold shadow-pixel hover:bg-red-600 active:shadow-pixel-inset active:translate-y-px transition-colors whitespace-nowrap text-xs"
            >
              {resetProgress > 0 && (
                <div
                  className="absolute top-0 left-0 h-full bg-pixel-accent/50"
                  style={{ width: `${resetProgress}%` }}
                />
              )}
              <span className="relative">
                {resetProgress > 0 ? `Resetting...` : 'Reset Progress'}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;