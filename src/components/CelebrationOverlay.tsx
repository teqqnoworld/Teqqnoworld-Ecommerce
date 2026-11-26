import React, { useEffect, useRef } from 'react';
import {
  CelebrationEvent,
  CelebrationLevel,
  subscribeCelebrations,
} from '../services/celebrationService';

type ParticleKind = 'ribbon' | 'foil' | 'star' | 'shimmer';

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  width: number;
  height: number;
  rotation: number;
  vRot: number;
  tilt: number;
  vTilt: number;
  swayPhase: number;
  swayFreq: number;
  swayAmp: number;
  color: string;
  highlight: string;
  alpha: number;
  age: number;
  life: number;
  glow: boolean;
}

interface GlowRing {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  age: number;
  life: number;
  color: string;
}

// Luxury TeqqnoWorld palette: Dark Navy, Orange (#FF7A00), Crisp White, Elegant Gold
const BRAND_RIBBON_PALETTE: Array<{ color: string; highlight: string; weight: number }> = [
  { color: '#FF7A00', highlight: '#FFB266', weight: 3 }, // Brand Orange
  { color: '#E5B84B', highlight: '#FFF3C4', weight: 3 }, // Champagne Gold
  { color: '#F6D365', highlight: '#FFF9DF', weight: 2 }, // Bright Luxury Gold
  { color: '#071B35', highlight: '#1D4476', weight: 2 }, // Deep Dark Navy
  { color: '#FFFFFF', highlight: '#F8FAFC', weight: 2 }, // Pure Satin White
];

const GOLD_PALETTE: Array<{ color: string; highlight: string }> = [
  { color: '#F6D365', highlight: '#FFF9E2' },
  { color: '#E5B84B', highlight: '#FFEFA8' },
  { color: '#FF9E3D', highlight: '#FFD8A8' },
  { color: '#FFFFFF', highlight: '#FFF6D6' },
];

const WEIGHTED_RIBBONS = BRAND_RIBBON_PALETTE.flatMap((entry) =>
  Array.from({ length: entry.weight }, () => entry)
);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function drawFourPointStar(
  ctx: CanvasRenderingContext2D,
  outerRadius: number,
  innerRadius: number
): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = (i * Math.PI) / 4;
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export const CelebrationOverlay: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number | null = null;
    let lastFrameTime = 0;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const particles: Particle[] = [];
    const rings: GlowRing[] = [];
    const pendingTimers: number[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const prefersReducedMotion = () =>
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const getMaxParticles = () => (width < 640 ? 125 : 220);

    const trimPoolIfNeeded = () => {
      const cap = getMaxParticles();
      if (particles.length > cap) {
        particles.splice(0, particles.length - cap);
      }
    };

    const spawnBurst = (
      originX: number,
      originY: number,
      level: CelebrationLevel,
      spreadConfig?: {
        angleCenter?: number;
        spreadRad?: number;
        scaleMultiplier?: number;
      }
    ) => {
      const isMobile = width < 640;
      const scale = (spreadConfig?.scaleMultiplier ?? 1) * (isMobile ? 0.72 : 1);

      if (prefersReducedMotion()) {
        // Accessible gentle golden shimmer with minimal slow drift
        const count = level === 'grand' ? 14 : level === 'premium' ? 9 : 6;
        rings.push({
          x: originX,
          y: originY,
          radius: 8,
          maxRadius: level === 'grand' ? 110 : 68,
          age: 0,
          life: 0.75,
          color: '#E5B84B',
        });
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + rand(-0.2, 0.2);
          const dist = rand(18, level === 'grand' ? 76 : 48);
          const g = pick(GOLD_PALETTE);
          particles.push({
            kind: i % 2 === 0 ? 'star' : 'shimmer',
            x: originX + Math.cos(angle) * dist,
            y: originY + Math.sin(angle) * dist,
            vx: Math.cos(angle) * 8,
            vy: -6 + Math.sin(angle) * 6,
            gravity: 0,
            drag: 0.96,
            width: rand(4, 6.5),
            height: rand(4, 6.5),
            rotation: rand(0, Math.PI * 2),
            vRot: rand(-0.6, 0.6),
            tilt: 0,
            vTilt: 0,
            swayPhase: rand(0, Math.PI * 2),
            swayFreq: 1.5,
            swayAmp: 0,
            color: g.color,
            highlight: g.highlight,
            alpha: 1,
            age: 0,
            life: rand(0.75, 1.1),
            glow: true,
          });
        }
        trimPoolIfNeeded();
        return;
      }

      const angleCenter = spreadConfig?.angleCenter ?? -Math.PI / 2;
      const spreadRad =
        spreadConfig?.spreadRad ??
        (level === 'subtle' ? Math.PI * 1.15 : level === 'premium' ? Math.PI * 1.55 : Math.PI * 1.85);

      const baseCounts =
        level === 'subtle'
          ? { ribbons: 12, foils: 6, stars: 5, shimmers: 6 }
          : level === 'premium'
            ? { ribbons: 28, foils: 14, stars: 10, shimmers: 12 }
            : { ribbons: 42, foils: 20, stars: 14, shimmers: 16 };

      const ribbons = Math.max(6, Math.round(baseCounts.ribbons * scale));
      const foils = Math.max(3, Math.round(baseCounts.foils * scale));
      const stars = Math.max(3, Math.round(baseCounts.stars * scale));
      const shimmers = Math.max(4, Math.round(baseCounts.shimmers * scale));

      // Subtle luxury radial shimmer ring at origin
      if (level !== 'subtle') {
        rings.push({
          x: originX,
          y: originY,
          radius: 6,
          maxRadius: level === 'grand' ? (isMobile ? 115 : 165) : isMobile ? 74 : 102,
          age: 0,
          life: level === 'grand' ? 0.48 : 0.36,
          color: level === 'grand' ? '#F6D365' : '#FF7A00',
        });
      }

      const speedMin = level === 'subtle' ? 140 : level === 'premium' ? 210 : 270;
      const speedMax = level === 'subtle' ? 310 : level === 'premium' ? 490 : 650;

      // 1. Satin confetti ribbons (brand navy, orange, white, gold)
      for (let i = 0; i < ribbons; i++) {
        const angle = angleCenter + rand(-spreadRad / 2, spreadRad / 2);
        const speed = rand(speedMin, speedMax) * (isMobile ? 0.8 : 1);
        const swatch = pick(WEIGHTED_RIBBONS);
        particles.push({
          kind: 'ribbon',
          x: originX + rand(-6, 6),
          y: originY + rand(-6, 6),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - rand(20, 75),
          gravity: rand(310, 440),
          drag: rand(0.955, 0.976),
          width: rand(6.5, 11.5),
          height: rand(3.2, 5.4),
          rotation: rand(0, Math.PI * 2),
          vRot: rand(-5.5, 5.5),
          tilt: rand(0, Math.PI * 2),
          vTilt: rand(6, 12),
          swayPhase: rand(0, Math.PI * 2),
          swayFreq: rand(2.2, 4.4),
          swayAmp: rand(14, 34),
          color: swatch.color,
          highlight: swatch.highlight,
          alpha: 1,
          age: 0,
          life:
            level === 'subtle'
              ? rand(0.95, 1.35)
              : level === 'premium'
                ? rand(1.25, 1.85)
                : rand(1.65, 2.45),
          glow: false,
        });
      }

      // 2. Metallic champagne-gold foil glints
      for (let i = 0; i < foils; i++) {
        const angle = angleCenter + rand(-spreadRad / 2, spreadRad / 2);
        const speed = rand(speedMin * 0.85, speedMax * 0.95) * (isMobile ? 0.8 : 1);
        const swatch = pick(GOLD_PALETTE);
        const size = rand(3.5, 6);
        particles.push({
          kind: 'foil',
          x: originX + rand(-4, 4),
          y: originY + rand(-4, 4),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - rand(10, 60),
          gravity: rand(240, 340),
          drag: rand(0.95, 0.972),
          width: size,
          height: size,
          rotation: rand(0, Math.PI * 2),
          vRot: rand(-8, 8),
          tilt: rand(0, Math.PI * 2),
          vTilt: rand(8, 15),
          swayPhase: rand(0, Math.PI * 2),
          swayFreq: rand(3, 5.5),
          swayAmp: rand(10, 26),
          color: swatch.color,
          highlight: swatch.highlight,
          alpha: 1,
          age: 0,
          life: level === 'subtle' ? rand(0.85, 1.2) : rand(1.2, 1.9),
          glow: true,
        });
      }

      // 3. Glowing 4-point luxury stars
      for (let i = 0; i < stars; i++) {
        const angle = angleCenter + rand(-spreadRad / 2, spreadRad / 2);
        const speed = rand(speedMin * 0.6, speedMax * 0.85) * (isMobile ? 0.78 : 1);
        const swatch = pick(GOLD_PALETTE);
        const radius = level === 'grand' ? rand(5, 8.5) : rand(4, 6.8);
        particles.push({
          kind: 'star',
          x: originX + rand(-8, 8),
          y: originY + rand(-8, 8),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - rand(15, 55),
          gravity: rand(120, 200),
          drag: rand(0.935, 0.96),
          width: radius,
          height: radius,
          rotation: rand(0, Math.PI),
          vRot: rand(-3, 3),
          tilt: rand(0, Math.PI * 2),
          vTilt: rand(5, 9),
          swayPhase: rand(0, Math.PI * 2),
          swayFreq: rand(2, 4),
          swayAmp: rand(6, 16),
          color: swatch.color,
          highlight: swatch.highlight,
          alpha: 1,
          age: 0,
          life: level === 'subtle' ? rand(0.75, 1.1) : rand(1.1, 1.75),
          glow: true,
        });
      }

      // 4. Fine golden micro-shimmer dust
      for (let i = 0; i < shimmers; i++) {
        const angle = rand(0, Math.PI * 2);
        const speed = rand(65, level === 'grand' ? 320 : 210) * (isMobile ? 0.75 : 1);
        const swatch = pick(GOLD_PALETTE);
        const dot = rand(1.6, 3.2);
        particles.push({
          kind: 'shimmer',
          x: originX + rand(-4, 4),
          y: originY + rand(-4, 4),
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - rand(10, 40),
          gravity: rand(55, 110),
          drag: rand(0.92, 0.955),
          width: dot,
          height: dot,
          rotation: 0,
          vRot: 0,
          tilt: rand(0, Math.PI * 2),
          vTilt: rand(7, 13),
          swayPhase: 0,
          swayFreq: 0,
          swayAmp: 0,
          color: swatch.color,
          highlight: swatch.highlight,
          alpha: 1,
          age: 0,
          life: rand(0.6, 1.25),
          glow: true,
        });
      }

      trimPoolIfNeeded();
    };

    const startLoop = () => {
      if (rafId !== null) return;
      lastFrameTime = performance.now();
      rafId = requestAnimationFrame(tick);
    };

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000));
      lastFrameTime = now;

      ctx.clearRect(0, 0, width, height);

      // Render subtle expanding luxury shimmer rings
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.age += dt;
        const progress = r.age / r.life;
        if (progress >= 1) {
          rings.splice(i, 1);
          continue;
        }
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentR = r.radius + (r.maxRadius - r.radius) * eased;
        const opacity = (1 - progress) * 0.32;

        ctx.save();
        ctx.globalAlpha = opacity;
        const grad = ctx.createRadialGradient(r.x, r.y, currentR * 0.25, r.x, r.y, currentR);
        grad.addColorStop(0, 'rgba(246, 211, 101, 0.28)');
        grad.addColorStop(0.7, 'rgba(255, 122, 0, 0.14)');
        grad.addColorStop(1, 'rgba(255, 122, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(r.x, r.y, currentR, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = r.color;
        ctx.lineWidth = Math.max(0.8, 2 * (1 - progress));
        ctx.beginPath();
        ctx.arc(r.x, r.y, currentR * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Render particles
      const frameScale = dt * 60;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          particles.splice(i, 1);
          continue;
        }

        const dragFactor = Math.pow(p.drag, frameScale);
        p.vx *= dragFactor;
        p.vy = p.vy * dragFactor + p.gravity * dt;

        const sway =
          p.swayAmp > 0 ? Math.sin(p.swayPhase + p.age * p.swayFreq) * p.swayAmp * dt : 0;
        p.x += p.vx * dt + sway;
        p.y += p.vy * dt;

        p.rotation += p.vRot * dt;
        p.tilt += p.vTilt * dt;

        const lifeRatio = p.age / p.life;
        // Smooth fade-in over first 5% and graceful dissolve over last 35%
        let alpha = 1;
        if (lifeRatio < 0.05) alpha = lifeRatio / 0.05;
        else if (lifeRatio > 0.65) alpha = 1 - (lifeRatio - 0.65) / 0.35;
        alpha = Math.max(0, Math.min(1, alpha));

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = alpha;

        if (p.kind === 'ribbon') {
          ctx.rotate(p.rotation);
          const tiltCos = Math.cos(p.tilt);
          const scaleY = 0.22 + Math.abs(tiltCos) * 0.78;
          ctx.scale(1, scaleY);
          // Subtle specular glint when ribbon catches the light
          ctx.fillStyle = Math.abs(tiltCos) > 0.86 ? p.highlight : p.color;
          ctx.beginPath();
          const rw = p.width;
          const rh = p.height;
          ctx.roundRect ? ctx.roundRect(-rw / 2, -rh / 2, rw, rh, 1.2) : ctx.rect(-rw / 2, -rh / 2, rw, rh);
          ctx.fill();
        } else if (p.kind === 'foil') {
          ctx.rotate(p.rotation);
          const glint = 0.35 + Math.abs(Math.cos(p.tilt)) * 0.65;
          ctx.scale(glint, 1);
          ctx.fillStyle = glint > 0.85 ? p.highlight : p.color;
          ctx.beginPath();
          ctx.moveTo(0, -p.height * 0.65);
          ctx.lineTo(p.width * 0.65, 0);
          ctx.lineTo(0, p.height * 0.65);
          ctx.lineTo(-p.width * 0.65, 0);
          ctx.closePath();
          ctx.fill();
        } else if (p.kind === 'star') {
          ctx.rotate(p.rotation);
          const twinkle = 0.72 + Math.sin(p.tilt) * 0.28;
          const r = p.width * twinkle;
          ctx.shadowColor = 'rgba(246, 211, 101, 0.85)';
          ctx.shadowBlur = 8;
          ctx.fillStyle = p.highlight;
          drawFourPointStar(ctx, r, r * 0.34);
          ctx.fill();
        } else {
          // Micro golden shimmer orb
          const pulse = 0.6 + Math.abs(Math.sin(p.tilt)) * 0.4;
          ctx.globalAlpha = alpha * pulse;
          ctx.shadowColor = 'rgba(246, 211, 101, 0.9)';
          ctx.shadowBlur = 6;
          ctx.fillStyle = p.highlight;
          ctx.beginPath();
          ctx.arc(0, 0, p.width * pulse, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      if (particles.length > 0 || rings.length > 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, width, height);
        rafId = null;
      }
    };

    const handleCelebration = (event: CelebrationEvent) => {
      const ox = event.origin.x * width;
      const oy = event.origin.y * height;

      if (event.level === 'grand') {
        // Stage 1: Instant luxury centerpiece burst
        spawnBurst(ox, oy, 'grand', { scaleMultiplier: 0.9 });

        if (!prefersReducedMotion()) {
          // Stage 2: Twin graceful side arcs (luxury celebration sweep)
          const t1 = window.setTimeout(() => {
            spawnBurst(width * 0.2, height * 0.62, 'premium', {
              angleCenter: -Math.PI * 0.36,
              spreadRad: Math.PI * 0.55,
              scaleMultiplier: 0.72,
            });
            spawnBurst(width * 0.8, height * 0.62, 'premium', {
              angleCenter: -Math.PI * 0.64,
              spreadRad: Math.PI * 0.55,
              scaleMultiplier: 0.72,
            });
            startLoop();
          }, 150);
          pendingTimers.push(t1);
        }
      } else {
        spawnBurst(ox, oy, event.level);
      }

      startLoop();
    };

    const unsubscribe = subscribeCelebrations(handleCelebration);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', resize);
      for (const timer of pendingTimers) {
        window.clearTimeout(timer);
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-[9999] pointer-events-none select-none"
    />
  );
};
