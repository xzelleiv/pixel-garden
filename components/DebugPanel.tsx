import React, { useState } from 'react';
import { GameState, Season } from '../types';
import { EVENTS, SEASON_DURATION } from '../constants';

interface DebugPanelProps {
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  addLog: (message: string) => void;
}

const DebugButton: React.FC<{ onClick: () => void, children: React.ReactNode }> = ({ onClick, children }) => (
    <button
        onClick={onClick}
        className="season-button w-full text-left px-2 py-1 text-xs uppercase tracking-widest"
    >
        {children}
    </button>
);

const DebugPanel: React.FC<DebugPanelProps> = ({ setGameState, addLog }) => {
    const [isOpen, setIsOpen] = useState(true);

    const handleTriggerEvent = (eventId: string) => {
        const event = EVENTS.find(e => e.id === eventId);
        if (event) {
            setGameState(prev => {
                const newState = JSON.parse(JSON.stringify(prev));
                return event.apply(newState);
            });
            addLog(`DEBUG: Triggered event: ${event.description}`);
        }
    };
    
    const handleAddSeeds = () => {
        setGameState(prev => ({
            ...prev,
            resources: {
                ...prev.resources,
                seeds: (prev.resources.seeds || 0) + 10000
            }
        }));
        addLog("DEBUG: Added 10000 seeds.");
    };
    
    const handleFillPlot = () => {
        setGameState(prev => {
            const newPlot = prev.plot.map(tile => 
                tile.hasTree ? tile : { ...tile, hasTree: true, isWithered: false, seedsGenerated: 0 }
            );
            return { ...prev, plot: newPlot };
        });
        addLog("DEBUG: Filled empty plots with trees.");
    };

    const handleWitherAll = () => {
        setGameState(prev => {
            const newPlot = prev.plot.map(tile => 
                tile.hasTree && !tile.isWithered ? { ...tile, isWithered: true } : tile
            );
            return { ...prev, plot: newPlot };
        });
        addLog("DEBUG: Withered all healthy trees.");
    };

    const handleSetSeason = (season: Season) => {
        setGameState(prev => ({
            ...prev,
            currentSeason: season,
            seasonDuration: SEASON_DURATION
        }));
        addLog(`DEBUG: Season set to ${season}. Duration reset.`);
    };

    if (!isOpen) {
        return (
            <div className="fixed bottom-4 left-4">
                <button
                    onClick={() => setIsOpen(true)}
                    className="season-button rounded px-3 py-2 font-bold shadow-pixel"
                >
                    Debug
                </button>
            </div>
        );
    }

    return (
        <div className="fixed bottom-4 left-4 season-panel-solid bg-pixel-panel border-2 border-pixel-border shadow-pixel w-64 text-sm z-50">
            <div className="flex justify-between items-center p-2 bg-pixel-border">
                <h3 className="font-bold text-pixel-accent">Debug Menu</h3>
                <button onClick={() => setIsOpen(false)} className="season-button px-2 py-1 text-xs font-bold leading-none">
                    X
                </button>
            </div>
            <div className="p-2 max-h-64 overflow-y-auto">
                <div className="space-y-1">
                    <p className="text-xs text-pixel-text/70 border-b border-pixel-border pb-1 mb-1">Cheats</p>
                    <DebugButton onClick={handleAddSeeds}>+1000 Seeds</DebugButton>
                    <DebugButton onClick={handleFillPlot}>Fill Plot w/ Trees</DebugButton>
                    <DebugButton onClick={handleWitherAll}>Wither All Trees</DebugButton>
                </div>
                <div className="space-y-1 mt-2">
                    <p className="text-xs text-pixel-text/70 border-b border-pixel-border pb-1 mb-1">Events</p>
                    {EVENTS.map(event => (
                        <DebugButton key={event.id} onClick={() => handleTriggerEvent(event.id)}>
                            Trigger: {event.id}
                        </DebugButton>
                    ))}
                </div>
                <div className="space-y-1 mt-2">
                    <p className="text-xs text-pixel-text/70 border-b border-pixel-border pb-1 mb-1">Seasons</p>
                    <DebugButton onClick={() => handleSetSeason('spring')}>Set Spring</DebugButton>
                    <DebugButton onClick={() => handleSetSeason('summer')}>Set Summer</DebugButton>
                    <DebugButton onClick={() => handleSetSeason('autumn')}>Set Autumn</DebugButton>
                    <DebugButton onClick={() => handleSetSeason('winter')}>Set Winter</DebugButton>
                </div>
            </div>
            <div className="text-center text-xs p-1 bg-pixel-border/50 text-pixel-text/60">
                Ctrl+D to hide
            </div>
        </div>
    );
};

export default DebugPanel;