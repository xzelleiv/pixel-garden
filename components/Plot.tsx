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
        styles.filter = 'grayscale(80%) sepia(30%) brightness(0.8)';
    }

    return styles;
};

const Tile: React.FC<{ tile: PlotTile; currentSeason: Season }> = ({ tile, currentSeason }) => {
    const bgColor = tile.hasTree ? 'bg-pixel-soil' : 'bg-pixel-soil/50';
    let ariaLabel = 'Empty plot';

    const textureSet = SEASON_TEXTURES[currentSeason];
    const treeUrl = textureSet.tree;
    const witheredTreeUrl = textureSet.withered || textureSet.tree; // Fallback to tree url if no withered one

    const healthySeasonStyle = getSeasonStyle(currentSeason, false);
    const witheredSeasonStyle = getSeasonStyle(currentSeason, true);

    if (tile.hasTree) {
        if (tile.isDiamond) {
            ariaLabel = tile.isWithered ? 'Withered Diamond Tree' : 'Diamond Tree';
        } else if (tile.isGolden) {
            ariaLabel = tile.isWithered ? 'Withered Golden Tree' : 'Golden Tree';
        } else {
            ariaLabel = tile.isWithered ? 'Withered Tree' : 'Tree';
        }
    }

    const commonImageStyles: React.CSSProperties = {
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        transition: 'opacity 1s ease-in-out',
    };

    const isRare = tile.isGolden || tile.isDiamond;
    const showHealthyRare = isRare && !tile.isWithered;
    const showWitheredRare = isRare && tile.isWithered;

    const healthySpecialStyle: React.CSSProperties = showHealthyRare
        ? tile.isDiamond
            ? { filter: 'drop-shadow(0 0 10px rgba(167,245,255,0.9)) drop-shadow(0 0 4px #ffffff) brightness(1.7) contrast(1.5) saturate(0.5)' }
            : { filter: 'drop-shadow(0 0 8px rgba(255,180,0,0.9)) brightness(1.5) saturate(2)' }
        : {};

    const witheredSpecialStyle: React.CSSProperties = showWitheredRare
        ? tile.isDiamond
            ? { filter: 'drop-shadow(0 0 6px rgba(167,245,255,0.4)) brightness(1.2) contrast(1.1) saturate(0.7)' }
            : { filter: 'drop-shadow(0 0 5px rgba(255,180,0,0.35)) brightness(1.15) saturate(1.2)' }
        : {};

    const combineFilters = (baseStyle: React.CSSProperties, extraStyle: React.CSSProperties): React.CSSProperties => {
        const merged = { ...baseStyle };
        if (merged.filter && extraStyle.filter) {
            merged.filter = `${merged.filter} ${extraStyle.filter}`;
        } else if (extraStyle.filter) {
            merged.filter = extraStyle.filter;
        }
        return merged;
    };

    const rarityBadge = tile.isDiamond ? '◆' : tile.isGolden ? '✦' : null;

    return (
        <div
            className={`relative w-full h-full border border-pixel-border/50 ${bgColor}`}
            role="img"
            aria-label={ariaLabel}
        >
            {tile.hasTree && (
                <>
                    <div
                        className={`absolute inset-0 ${showHealthyRare ? 'animate-pulse' : ''}`}
                        style={{
                            ...commonImageStyles,
                            ...combineFilters(healthySeasonStyle, healthySpecialStyle),
                            backgroundImage: `url(${treeUrl})`,
                            opacity: tile.isWithered ? 0 : 1,
                        }}
                    />
                    <div
                        className="absolute inset-0"
                        style={{
                            ...commonImageStyles,
                            ...combineFilters(witheredSeasonStyle, witheredSpecialStyle),
                            backgroundImage: `url(${witheredTreeUrl})`,
                            opacity: tile.isWithered ? 1 : 0,
                        }}
                    />
                </>
            )}
            {rarityBadge && (
                <span className="absolute top-1 right-1 text-[0.6rem] text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.7)]" aria-hidden="true">
                    {rarityBadge}
                </span>
            )}
            {showHealthyRare && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(circle at 50% 40%, rgba(255,255,255,0.35), transparent 60%)' }}
                    aria-hidden="true"
                />
            )}
            {showWitheredRare && (
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.18), transparent 65%)' }}
                    aria-hidden="true"
                />
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