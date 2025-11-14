import React, { useEffect } from 'react';

export interface ConfettiParticle {
  id: string;
  left: number;
  topOffset: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  drift: number;
  rotationStart: number;
  rotationEnd: number;
}

export interface ConfettiBurst {
  id: string;
  particles: ConfettiParticle[];
}

type ConfettiStyle = React.CSSProperties & {
  '--confetti-drift'?: string;
  '--confetti-rotate-start'?: string;
  '--confetti-rotate-end'?: string;
};

interface ConfettiLayerProps {
  bursts: ConfettiBurst[];
}

const ensureConfettiStyles = () => {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById('confetti-keyframes');
  if (existing) return;
  const style = document.createElement('style');
  style.id = 'confetti-keyframes';
  style.textContent = `
    @keyframes confettiFall {
      0% {
        opacity: 0;
        transform: translate3d(0, -10vh, 0) rotate(var(--confetti-rotate-start, 0deg));
      }
      12% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translate3d(var(--confetti-drift, 0px), 110vh, 0) rotate(var(--confetti-rotate-end, 720deg));
      }
    }
  `;
  document.head.appendChild(style);
};

const ConfettiLayer: React.FC<ConfettiLayerProps> = ({ bursts }) => {
  useEffect(() => {
    ensureConfettiStyles();
  }, []);

  if (bursts.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden={true}>
      {bursts.map(burst =>
        burst.particles.map(particle => {
          const style: ConfettiStyle = {
            left: `${particle.left}%`,
            top: `${particle.topOffset}%`,
            width: `${particle.size}px`,
            height: `${Math.max(2, particle.size * 0.6)}px`,
            backgroundColor: particle.color,
            borderRadius: '2px',
            opacity: 0,
            animationName: 'confettiFall',
            animationDuration: `${particle.duration}ms`,
            animationDelay: `${particle.delay}ms`,
            animationTimingFunction: 'cubic-bezier(0.33, 0.66, 0.66, 1)',
            animationFillMode: 'forwards',
            '--confetti-drift': `${particle.drift}vw`,
            '--confetti-rotate-start': `${particle.rotationStart}deg`,
            '--confetti-rotate-end': `${particle.rotationEnd}deg`,
          };

          return (
            <span
              key={`${burst.id}-${particle.id}`}
              className="absolute block will-change-transform"
              style={style}
            />
          );
        })
      )}
    </div>
  );
};

export default ConfettiLayer;
