import React, { useMemo } from 'react';
import { Season } from '../types';

interface ParticleConfig {
  count: number;
  colors: string[];
  size: [number, number];
  duration: [number, number];
  drift: number;
  shape: 'petal' | 'leaf' | 'snow' | 'sparkle';
  opacity: [number, number];
}

const PARTICLE_CONFIG: Record<Season, ParticleConfig> = {
  spring: {
    count: 26,
    colors: ['#ffd1e8', '#ffb3d9', '#ffc9e5'],
    size: [8, 16],
    duration: [10, 16],
    drift: 80,
    shape: 'petal',
    opacity: [0.45, 0.9],
  },
  summer: {
    count: 22,
    colors: ['rgba(255, 210, 127, 0.8)', 'rgba(255, 244, 189, 0.8)', 'rgba(255, 179, 102, 0.75)'],
    size: [6, 12],
    duration: [12, 18],
    drift: 40,
    shape: 'sparkle',
    opacity: [0.15, 0.35],
  },
  autumn: {
    count: 22,
    colors: ['#ffd47d', '#ffb347', '#ffce85'],
    size: [10, 18],
    duration: [11, 15],
    drift: 60,
    shape: 'leaf',
    opacity: [0.4, 0.85],
  },
  winter: {
    count: 28,
    colors: ['rgba(255,255,255,0.95)', 'rgba(233,246,255,0.95)', 'rgba(206,232,255,0.85)'],
    size: [6, 12],
    duration: [12, 18],
    drift: 25,
    shape: 'snow',
    opacity: [0.5, 0.9],
  },
};

const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

interface SeasonalParticlesProps {
  season: Season;
  reducedMotion?: boolean;
}

const SeasonalParticles: React.FC<SeasonalParticlesProps> = ({ season, reducedMotion }) => {
  const config = PARTICLE_CONFIG[season];

  const particles = useMemo(() => {
    if (!config || config.count === 0 || reducedMotion) {
      return [];
    }

    return Array.from({ length: config.count }).map((_, index) => {
      const size = randomInRange(config.size[0], config.size[1]);
      const duration = randomInRange(config.duration[0], config.duration[1]);
      const delay = randomInRange(0, config.duration[1]);
      const drift = randomInRange(-config.drift, config.drift);
      const spin = randomInRange(180, 540);
      const opacity = randomInRange(config.opacity[0], config.opacity[1]);
      const left = randomInRange(0, 100);
      const color = config.colors[Math.floor(Math.random() * config.colors.length)];

      const style: React.CSSProperties & { [key: string]: string | number } = {
        left: `${left}%`,
        width: `${size}px`,
        height: config.shape === 'snow' ? `${size}px` : `${size * 0.6}px`,
        background: color,
        opacity,
        animationDuration: `${duration}s`,
        animationDelay: `-${delay}s`,
      };

      style['--drift'] = `${drift}px`;
      style['--spin'] = `${spin}deg`;

      if (config.shape === 'petal') {
        style.borderRadius = '45% 55% 60% 40%';
      } else if (config.shape === 'leaf') {
        style.borderRadius = '40% 60% 30% 70%';
      } else if (config.shape === 'snow') {
        style.borderRadius = '50%';
        style.boxShadow = '0 0 6px rgba(255,255,255,0.6)';
      } else if (config.shape === 'sparkle') {
        style.borderRadius = '999px';
      }

      return {
        key: `season-particle-${season}-${index}`,
        className: `season-particle season-${config.shape}`,
        style,
      };
    });
  }, [config, season, reducedMotion]);

  if (particles.length === 0) {
    return null;
  }

  return (
    <div className="seasonal-particles pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.map(particle => (
        <span key={particle.key} className={particle.className} style={particle.style} />
      ))}
    </div>
  );
};

export default SeasonalParticles;
