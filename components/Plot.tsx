
import React from 'react';
import { PlotTile, Season } from '../types';
import { SEASON_TEXTURES } from '../constants';

interface PlotProps {
  tiles: PlotTile[];
  currentSeason: Season;
}

const getSeasonStyle = (season: Season, isWithered: boolean): React.CSSProperties => {
    const styles: React.CSSProperties = {};

    if (isWithered && !SEASON_TEXTURES[season].withered) {
        styles.filter = `grayscale(80%) sepia(30%) brightness(0.8)`.trim();
    }
    
    return styles;
};

// FIX: Destructured `currentSeason` from props to make it available in the component's scope.
const Tile: React.FC<{ tile: PlotTile; currentSeason: Season }> = ({ tile, currentSeason }) => {
    const bgColor = tile.hasTree ? 'bg-pixel-soil' : 'bg-pixel-soil/50';
    let ariaLabel = "Empty plot";
    
    const textureSet = SEASON_TEXTURES[currentSeason];
    const treeUrl = textureSet.tree;
    const witheredTreeUrl = textureSet.withered || textureSet.tree; // Fallback to tree url if no withered one
    
    const healthySeasonStyle = getSeasonStyle(currentSeason, false);
    const witheredSeasonStyle = getSeasonStyle(currentSeason, true);

    if (tile.hasTree) {
        if (tile.isDiamond) {
            ariaLabel = tile.isWithered ? "Withered Diamond Tree" : "Diamond Tree";
        } else if (tile.isGolden) {
            ariaLabel = tile.isWithered ? "Withered Golden Tree" : "Golden Tree";
        } else {
            ariaLabel = tile.isWithered ? "Withered Tree" : "Tree";
        }
    }
    
    const commonImageStyles: React.CSSProperties = {
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transition: 'opacity 1s ease-in-out',
    };
    
    let specialStyle: React.CSSProperties = {};
    if (tile.isDiamond) {
        specialStyle = {
            filter: 'drop-shadow(0 0 8px #a7f5ff) drop-shadow(0 0 3px #ffffff) brightness(1.7) contrast(1.5) saturate(0.5)',
        };
    } else if (tile.isGolden) {
        specialStyle = {
            filter: 'drop-shadow(0 0 6px #ffb400) brightness(1.5) saturate(2)',
        };
    }

    // Combine filters safely
    const combineFilters = (baseStyle: React.CSSProperties, specialStyle: React.CSSProperties): React.CSSProperties => {
        const newStyle = { ...baseStyle };
        if (newStyle.filter && specialStyle.filter) {
            newStyle.filter = `${newStyle.filter} ${specialStyle.filter}`;
        } else if (specialStyle.filter) {
            newStyle.filter = specialStyle.filter;
        }
        return newStyle;
    };

  return (
    <div 
        className={`relative w-full h-full border border-pixel-border/50 ${bgColor}`}
        role="img"
        aria-label={ariaLabel}
    >
        {tile.hasTree && (
            <>
                {/* Healthy Tree Layer */}
                <div
                    className="absolute inset-0"
                    style={{
                        ...commonImageStyles,
                        ...combineFilters(healthySeasonStyle, specialStyle),
                        backgroundImage: `url(${treeUrl})`,
                        opacity: tile.isWithered ? 0 : 1,
                    }}
                />
                {/* Withered Tree Layer */}
                <div
                    className="absolute inset-0"
                    style={{
                        ...commonImageStyles,
                        ...combineFilters(witheredSeasonStyle, specialStyle),
                        backgroundImage: `url(${witheredTreeUrl})`,
                        opacity: tile.isWithered ? 1 : 0,
                    }}
                />
            </>
        )}
    </div>
  );
};

const Plot: React.FC<PlotProps> = ({ tiles, currentSeason }) => {
  const gridSize = Math.ceil(Math.sqrt(tiles.length));

  return (
    <div className="w-full max-w-[280px] sm:max-w-sm lg:max-w-2xl aspect-square bg-pixel-panel border-4 border-pixel-border p-2 shadow-pixel">
        <div 
            className="w-full h-full grid gap-1"
            style={{
                gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
                gridTemplateRows: `repeat(${gridSize}, 1fr)`,
            }}
        >
            {tiles.map((tile) => (
                <Tile key={tile.id} tile={tile} currentSeason={currentSeason} />
            ))}
        </div>
    </div>
  );
};

export default Plot;