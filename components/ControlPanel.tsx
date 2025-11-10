import React, { useState } from 'react';
import { GameState, Resources, UpgradeDefinition } from '../types';
import { SeedIcon } from './icons';
import { UPGRADES, getUpgradeCost, getUpgradeEffect, formatNumber, SEASON_MULTIPLIERS } from '../constants';

type Tab = 'Actions' | 'Upgrades' | 'Stats';

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
}> = ({ onClick, onMouseDown, onMouseUp, onMouseLeave, onTouchStart, onTouchEnd, onTouchCancel, children, disabled, cost, progress }) => {
  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      disabled={disabled}
      className={`relative w-full p-3 sm:p-4 bg-pixel-border text-pixel-text font-bold shadow-pixel hover:bg-pixel-accent/50 active:shadow-pixel-inset active:translate-y-px disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors flex items-center overflow-hidden`}
      aria-disabled={disabled}
    >
      {progress && progress > 0 && (
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

const UpgradeCard: React.FC<{ upgradeDef: UpgradeDefinition; level: number; onBuy: (id: string) => void; canAfford: boolean }> = ({ upgradeDef, level, onBuy, canAfford }) => {
    const cost = getUpgradeCost(upgradeDef.id, level);

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
          disabled={!canAfford}
          className="px-3 py-1 bg-pixel-tree text-pixel-bg font-bold shadow-pixel hover:bg-green-400 active:shadow-pixel-inset active:translate-y-px disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap text-xs"
        >
          Upgrade
        </button>
      </div>
    </div>
  )};


const UpgradeCategory: React.FC<{title: string; upgradeIds: string[]; gameState: GameState; onBuy: (id: string) => void; canAfford: (id: string) => boolean;}> = ({ title, upgradeIds, gameState, onBuy, canAfford }) => (
  <div>
    <h3 className="text-lg text-pixel-accent border-b-2 border-pixel-border mb-2 pb-1">{title}</h3>
    <div className="space-y-2">
      {upgradeIds.map(id => (
        <UpgradeCard 
          key={id}
          upgradeDef={UPGRADES[id]}
          level={gameState.upgrades[id].level}
          onBuy={onBuy}
          canAfford={canAfford(id)}
        />
      ))}
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
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('Actions');
  const { upgrades, costs, plot } = gameState;

  const treeCount = plot.filter(t => t.hasTree).length;
  const healthyTreeCount = plot.filter(t => t.hasTree && !t.isWithered).length;
  const witheredCount = plot.filter(t => t.isWithered).length;

  const plotCapacity = plot.length;
  const currentPlantingCost = costs.tree + (treeCount * 5);

  let gatherButtonText: React.ReactNode = 'Gather Seeds';
  if (treeCount === 0) gatherButtonText = 'No trees planted';
  else if (healthyTreeCount === 0 && treeCount > 0) gatherButtonText = 'All trees withered';

  const TABS: Tab[] = ['Actions', 'Upgrades', 'Stats'];

  return (
    <div className="bg-pixel-panel border-2 border-pixel-border shadow-pixel flex flex-col h-full">
      {/* Integrated Resources Display */}
      <div className="p-2 lg:p-4 border-b-2 border-pixel-border">
          <h2 className="text-lg text-center mb-1">Resources</h2>
          <div className="space-y-1">
              <ResourceItem icon={<SeedIcon />} label="Seeds" value={resources.seeds || 0} rate={autoGains.seeds || 0} />
          </div>
      </div>
      
      <div className="flex border-b-2 border-pixel-border">
        {TABS.map(tab => (
          <button 
            key={tab} 
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 px-2 text-center font-bold whitespace-nowrap
              ${activeTab === tab ? 'bg-pixel-border text-pixel-accent' : 'bg-transparent hover:bg-pixel-border/50'}
            `}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-2 lg:p-4 flex-grow overflow-y-auto">
        {activeTab === 'Actions' && (
          <div className="space-y-3">
            <ActionButton onClick={() => onAction('gatherSeeds')} disabled={healthyTreeCount === 0}>
              {gatherButtonText}
            </ActionButton>

            <ActionButton 
              onClick={() => onAction('plantTree')} 
              disabled={treeCount >= plotCapacity || gameState.resources.seeds < currentPlantingCost} 
              cost={currentPlantingCost}
            >
              Plant Tree ({treeCount}/{plotCapacity})
            </ActionButton>

            <ActionButton
              onClick={() => {
                if (upgrades.shovel?.level > 0) {
                  onAction('clearWithered');
                }
              }}
              onMouseDown={() => onClearHoldStart?.()}
              onMouseUp={() => onClearHoldEnd?.()}
              onMouseLeave={() => onClearHoldEnd?.()}
              onTouchStart={(e) => { e.preventDefault(); onClearHoldStart?.(e); }}
              onTouchEnd={(e) => {
                e.preventDefault();
                onClearHoldEnd?.(e);
                // Explicitly handle tap action for touch devices if shovel is owned,
                // because preventDefault() stops the 'click' event from firing.
                if (upgrades.shovel?.level > 0) {
                    onAction('clearWithered');
                }
              }}
              onTouchCancel={(e) => { e.preventDefault(); onClearHoldEnd?.(e); }}
              disabled={witheredCount === 0}
              progress={clearProgress}
            >
              {clearProgress > 0 ? 'Clearing...' : `Clear Withered (${witheredCount})`}
            </ActionButton>
          </div>
        )}

        {activeTab === 'Upgrades' && (
          <div className="space-y-3">
            <UpgradeCategory title="Tools" upgradeIds={['gloves', 'shovel']} gameState={gameState} onBuy={onBuyUpgrade} canAfford={canAffordUpgrade} />
            <UpgradeCategory title="Cultivation" upgradeIds={['betterSoil', 'composter', 'cleanseSoil', 'fertilizer']} gameState={gameState} onBuy={onBuyUpgrade} canAfford={canAffordUpgrade} />
            <UpgradeCategory title="Expansion" upgradeIds={['expandPlot']} gameState={gameState} onBuy={onBuyUpgrade} canAfford={canAffordUpgrade} />
            <UpgradeCategory title="Automation" upgradeIds={['autoPlanter', 'autoShovel']} gameState={gameState} onBuy={onBuyUpgrade} canAfford={canAffordUpgrade} />
          </div>
        )}

        {activeTab === 'Stats' && (
          <div>
            {/* Season Info */}
            <div className="mb-4">
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
              </div>
            </div>

            {/* Credits footer */}
            <div className="mt-4 pt-2 border-t-2 border-pixel-border text-xs text-pixel-text/70">
              <div className="font-bold text-pixel-accent mb-1">Credits</div>
              <div>Developer: Pasao,</div>
              <div>Co-Developer: Scoggins</div>
              <div>Assets: Cuaresma, Mas</div>
              <div>Version: 1.4.0</div>
            </div>

            {/* Reset Button */}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default ControlPanel;