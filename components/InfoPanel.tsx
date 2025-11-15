import React from 'react';
import { GameState } from '../types';
import { UPGRADES } from '../constants';

interface InfoPanelProps {
    upgrades: GameState['upgrades'];
}

const InfoPanel: React.FC<InfoPanelProps> = ({ upgrades }) => {
    const purchasedUpgrades = Object.keys(upgrades)
        .filter(id => upgrades[id].level > 0)
        .map(id => ({ ...UPGRADES[id], level: upgrades[id].level }));

    return (
        <div className="season-panel-solid bg-pixel-panel border-2 border-pixel-border shadow-pixel flex flex-col h-full p-4">
            <h2 className="text-lg text-pixel-accent border-b-2 border-pixel-border mb-3 pb-2 text-center">
                Garden Info
            </h2>
            {purchasedUpgrades.length > 0 ? (
                <div className="space-y-3 overflow-y-auto">
                    {purchasedUpgrades.map(upgrade => (
                        <div key={upgrade.id} className="text-xs">
                            <div className="flex justify-between items-baseline">
                                <h3 className="font-bold text-pixel-text">{upgrade.name}</h3>
                                <span className="text-pixel-text/70">{upgrade.level}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex-grow flex items-center justify-center text-center text-xs text-pixel-text/70">
                    <p>Purchase upgrades from the 'Upgrades' tab to see them here.</p>
                </div>
            )}
        </div>
    );
};

export default InfoPanel;