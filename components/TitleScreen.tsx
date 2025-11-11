import { useEffect, useRef, type CSSProperties, type FC, type MouseEvent, type TouchEvent } from 'react';

type TitleScreenProps = {
  onStart: () => void;
};

const containerBase: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 9999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#120c01',
  color: 'rgb(216, 129, 28)',
  overflow: 'hidden',
};

const titleWrapperBase: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  textAlign: 'center',
  userSelect: 'none',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: 12,
};

const titleLineBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  justifyContent: 'center',
};

const hintBase: CSSProperties = {
  marginTop: 10,
  fontSize: 12,
  color: 'rgba(216,129,28,0.95)',
};

const canvasStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 1,
};

const TREE_TEXTURE_URL = 'https://tinyurl.com/4fun7b8r';

type ParticleInstance = {
  update: (width: number, height: number) => void;
  draw: (ctx: CanvasRenderingContext2D) => void;
};

const TitleScreen: FC<TitleScreenProps> = ({ onStart }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const particlesRef = useRef<ParticleInstance[]>([]);
  const startedRef = useRef(false);

  const isMobile =
    typeof window !== 'undefined' &&
    (window.innerWidth <= 640 || /Mobi|Android/i.test(window.navigator.userAgent));
  const initialParticleCount = isMobile ? 60 : 150;
  const wordFontSize = isMobile ? 28 : 56;
  const treeWidth = isMobile ? 36 : 52;
  const treeTransform = isMobile
    ? 'translateY(2px) rotate(-3deg) scale(1.05)'
    : 'translateY(4px) rotate(-4deg) scale(1.05)';

  const containerStyle: CSSProperties = { ...containerBase };
  const titleWrapperStyle: CSSProperties = { ...titleWrapperBase };
  const titleLineStyle: CSSProperties = { ...titleLineBase };
  const wordStyle: CSSProperties = {
    fontSize: wordFontSize,
    fontFamily: "'Press Start 2P', cursive",
    color: 'rgb(216,129,28)',
    lineHeight: 1,
    textShadow: '0 0 8px rgba(216,129,28,0.35)',
  };
  const hintStyle: CSSProperties = {
    ...hintBase,
    fontSize: Math.max(10, Math.floor(wordFontSize / 4)),
  };
  const treeStyle: CSSProperties = {
    width: treeWidth,
    height: 'auto',
    display: 'inline-block',
    verticalAlign: 'baseline',
    transform: treeTransform,
    imageRendering: 'pixelated',
    filter: 'contrast(1.05) saturate(1.1)',
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return undefined;
    }

    const colors = ['#3A4330', '#C8934D', '#833A21'] as const;

    let width = 0;
    let height = 0;
    let particleCount = initialParticleCount;

    const getDpr = () => Math.max(1, Math.min(window.devicePixelRatio || 1, 2));

    class Particle {
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      color: string;

      constructor(private w: number, private h: number, private palette: readonly string[]) {
        this.x = Math.random() * this.w;
        this.y = Math.random() * this.h;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() - 0.5) * (isMobile ? 0.8 : 1.5);
        this.speedY = (Math.random() - 0.5) * (isMobile ? 0.8 : 1.5);
        this.color = this.palette[Math.floor(Math.random() * this.palette.length)];
      }

      update(w: number, h: number) {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x > w) this.x = 0;
        if (this.x < 0) this.x = w;
        if (this.y > h) this.y = 0;
        if (this.y < 0) this.y = h;

        if (Math.random() < 0.0001) {
          this.color = this.palette[Math.floor(Math.random() * this.palette.length)];
        }
      }

      draw(ctxLocal: CanvasRenderingContext2D) {
        ctxLocal.fillStyle = this.color;
        ctxLocal.beginPath();
        ctxLocal.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctxLocal.fill();
      }
    }

    const initParticles = () => {
      const arr = particlesRef.current;
      arr.length = 0;
      for (let i = 0; i < particleCount; i += 1) {
        arr.push(new Particle(width, height, colors));
      }
    };

    const setSize = () => {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      const dpr = getDpr();

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      width = w;
      height = h;

      particleCount =
        width < 480
          ? Math.max(40, Math.floor(initialParticleCount / 3))
          : width < 768
          ? Math.max(60, Math.floor(initialParticleCount / 2))
          : initialParticleCount;

      initParticles();
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      for (const particle of particlesRef.current) {
        particle.update(width, height);
        particle.draw(ctx);
      }
      rafRef.current = window.requestAnimationFrame(animate);
    };

    setSize();
    rafRef.current = window.requestAnimationFrame(animate);

    const onResize = () => setSize();

    window.addEventListener('resize', onResize);

    let detachResolutionListener: (() => void) | undefined;

    try {
      const mq = window.matchMedia(`(resolution: ${getDpr()}dppx)`);
      const onDprChange = () => setSize();

      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', onDprChange);
        detachResolutionListener = () => mq.removeEventListener('change', onDprChange);
      } else if (typeof mq.addListener === 'function') {
        mq.addListener(onDprChange);
        detachResolutionListener = () => mq.removeListener(onDprChange);
      }
    } catch {
      detachResolutionListener = undefined;
    }

    return () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener('resize', onResize);
      if (detachResolutionListener) {
        detachResolutionListener();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStart = (event?: MouseEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current);
    }

    onStart();

    event?.preventDefault();
  };

  return (
    <div
      style={containerStyle}
      onClick={handleStart}
      onTouchStart={handleStart}
      role="button"
      aria-label="Start game"
    >
      <canvas ref={canvasRef} style={canvasStyle} />
      <div style={titleWrapperStyle}>
        <div style={titleLineStyle}>
          <span style={wordStyle}>Pixel</span>
          <img
            src={TREE_TEXTURE_URL}
            alt="Stylized tree acting as the letter L"
            style={treeStyle}
            draggable={false}
          />
          <span style={wordStyle}>Garden</span>
        </div>
        <p style={hintStyle}>Tap anywhere to begin</p>
      </div>
    </div>
  );
};

export default TitleScreen;


