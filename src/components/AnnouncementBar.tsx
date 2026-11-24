import React, { useState, useEffect, useRef } from 'react';
import { Copy, Check, Sparkles } from 'lucide-react';

interface AnnouncementBarProps {
  onTrackOrderClick?: () => void;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alpha: number;
  decay: number;
  size: number;
  color: string;
  history: { x: number; y: number }[];
}

export const AnnouncementBar: React.FC<AnnouncementBarProps> = ({ onTrackOrderClick }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Handle promo code copy
  const handleCopyCode = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText('WELCOME10');
      setCopied(true);
      setToastMessage('Promo code WELCOME10 copied!');
      setTimeout(() => setCopied(false), 2400);
      setTimeout(() => setToastMessage(null), 2800);
    } catch {
      setCopied(true);
      setToastMessage('WELCOME10 copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Diwali Fuljhari Sparkler Canvas Simulation (zero forced reflow, pauses when offscreen)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    let animationFrameId = 0;
    let startTimerId: number | null = null;
    let isRunning = false;
    let isVisible = true;
    let particles: SparkParticle[] = [];
    let width = 0;
    let height = 38;

    const parentEl = canvas.parentElement;

    const applySize = (w: number, h: number) => {
      const nextW = Math.max(1, Math.round(w));
      const nextH = Math.max(1, Math.round(h));
      if (nextW !== width || nextH !== height) {
        width = canvas.width = nextW;
        height = canvas.height = nextH;
      }
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && parentEl
        ? new ResizeObserver((entries) => {
            const rect = entries[0]?.contentRect;
            if (rect) {
              applySize(rect.width, rect.height || 38);
            }
          })
        : null;

    if (resizeObserver && parentEl) {
      resizeObserver.observe(parentEl);
    }

    const sparkColors = [
      '#FFF4CC', // hot warm white
      '#FFD700', // radiant gold
      '#FFA500', // pure amber
      '#FF7A00', // TeqqnoWorld orange
      '#FFE880', // light sparkle gold
      '#FFFFFF'  // brilliant core
    ];

    // Fuljhari emitter positions (slowly oscillating points across the bar)
    let emitterPhase = 0;

    const createSpark = (originX: number, originY: number, burst: boolean = false): SparkParticle => {
      const angle = Math.random() * Math.PI * 2;
      const speed = burst ? Math.random() * 2.8 + 0.8 : Math.random() * 1.8 + 0.4;
      const maxLife = Math.random() * 25 + 15;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.7 - 0.2, // slight upward tendency
        alpha: 1,
        decay: 1 / maxLife,
        size: Math.random() * 1.8 + 0.8,
        color: sparkColors[Math.floor(Math.random() * sparkColors.length)],
        history: [{ x: originX, y: originY }]
      };
    };

    let frameCount = 0;

    const render = () => {
      if (!isVisible || document.hidden) {
        isRunning = false;
        return;
      }

      if (width === 0) {
        applySize(window.innerWidth, 38);
      }

      frameCount++;
      ctx.clearRect(0, 0, width, height);

      emitterPhase += 0.015;

      // Spawn periodic gentle sparkler bursts from 3 focal areas (like glowing Diwali fuljharis)
      if (frameCount % 4 === 0 && particles.length < 40) {
        // Emitter 1 (left-to-middle sweep)
        const e1X = ((Math.sin(emitterPhase) * 0.4 + 0.5) * width) % width;
        const e1Y = height * 0.45 + Math.cos(emitterPhase * 1.8) * (height * 0.25);
        particles.push(createSpark(e1X, e1Y));

        // Emitter 2 (periodic subtle edge sparks)
        if (Math.random() > 0.45) {
          const edgeX = Math.random() * width;
          const edgeY = Math.random() > 0.5 ? 2 : height - 2;
          particles.push(createSpark(edgeX, edgeY, false));
        }

        // Emitter 3 (sparkler cluster burst occasionally)
        if (frameCount % 45 === 0) {
          const clusterX = Math.random() * width;
          const clusterY = height * 0.5;
          for (let i = 0; i < 4; i++) {
            particles.push(createSpark(clusterX, clusterY, true));
          }
        }
      }

      // Update & Draw particles (avoid per-particle shadowBlur overhead for smooth mobile main thread)
      ctx.lineCap = 'round';
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.history.push({ x: p.x, y: p.y });
        if (p.history.length > 3) {
          p.history.shift();
        }

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.035; // gentle gravity
        p.vx *= 0.98;  // air resistance
        p.alpha -= p.decay;

        if (p.alpha <= 0 || p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
          particles.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;

        ctx.beginPath();
        if (p.history.length > 1) {
          ctx.moveTo(p.history[0].x, p.history[0].y);
          ctx.lineTo(p.x, p.y);
        } else {
          ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2);
        }
        ctx.stroke();

        // Tiny white hot spark core
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      animationFrameId = requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (isRunning || !isVisible || document.hidden) return;
      isRunning = true;
      animationFrameId = requestAnimationFrame(render);
    };

    const intersectionObserver =
      typeof IntersectionObserver !== 'undefined' && parentEl
        ? new IntersectionObserver(
            ([entry]) => {
              isVisible = Boolean(entry?.isIntersecting);
              if (isVisible && !document.hidden) {
                startLoop();
              } else if (isRunning) {
                cancelAnimationFrame(animationFrameId);
                isRunning = false;
              }
            },
            { threshold: 0 }
          )
        : null;

    if (intersectionObserver && parentEl) {
      intersectionObserver.observe(parentEl);
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (isRunning) {
          cancelAnimationFrame(animationFrameId);
          isRunning = false;
        }
      } else if (isVisible) {
        startLoop();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Defer sparkler animation slightly so initial hydration & first paint stay unblocked
    startTimerId = window.setTimeout(() => {
      startLoop();
    }, 350);

    return () => {
      if (startTimerId !== null) window.clearTimeout(startTimerId);
      cancelAnimationFrame(animationFrameId);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // One distinct announcement message item
  const renderAnnouncementSegment = (keyPrefix: string) => (
    <div key={keyPrefix} className="inline-flex items-center gap-4 sm:gap-6 px-4 shrink-0 select-none">
      {/* Exact required text: 🎉 FIRST ORDER PAR 10% OFF  •  CODE: WELCOME10  •  FREE SHIPPING ON BULK ORDERS 🚚 */}
      <div className="flex items-center gap-2 font-medium tracking-wide text-xs sm:text-[13px] text-white">
        <span className="text-base sm:text-lg leading-none" role="img" aria-label="Party popper">
          🎉
        </span>
        <span className="text-zinc-100 font-semibold uppercase tracking-wider">
          FIRST ORDER PAR{' '}
          <span className="text-[#FF7A00] font-black drop-shadow-[0_0_8px_rgba(255,122,0,0.6)]">
            10% OFF
          </span>
        </span>
      </div>

      {/* Separator dot */}
      <span className="text-[#F59E0B] text-xs opacity-75 font-bold" aria-hidden="true">
        •
      </span>

      {/* CODE: WELCOME10 (Interactive copy pill) */}
      <div className="flex items-center gap-1.5 text-xs sm:text-[13px]">
        <span className="text-zinc-300 font-medium uppercase text-[11px] sm:text-xs tracking-wider">
          CODE:
        </span>
        <button
          type="button"
          onClick={handleCopyCode}
          title="Click to copy promo code WELCOME10"
          aria-label="Copy promo code WELCOME10"
          className="group/code relative inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-[#FF7A00]/50 bg-[#FF7A00]/15 hover:bg-[#FF7A00]/30 active:scale-95 text-[#FFA959] hover:text-white transition-all shadow-[0_0_12px_rgba(255,122,0,0.25)] cursor-pointer"
        >
          <span className="font-mono font-bold tracking-wider text-xs sm:text-[13px] text-white group-hover/code:text-[#FFD700] transition-colors">
            WELCOME10
          </span>
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-400 animate-scale-in" />
          ) : (
            <Copy className="w-3 h-3 text-[#FF7A00] group-hover/code:text-white transition-colors opacity-80 group-hover/code:opacity-100" />
          )}

          {/* Micro hover indicator */}
          <span className="hidden group-hover/code:inline text-[10px] text-zinc-300 font-sans font-normal ml-0.5">
            {copied ? 'Copied!' : 'Copy'}
          </span>
        </button>
      </div>

      {/* Separator dot */}
      <span className="text-[#F59E0B] text-xs opacity-75 font-bold" aria-hidden="true">
        •
      </span>

      {/* FREE SHIPPING ON BULK ORDERS 🚚 */}
      <div className="flex items-center gap-1.5 text-xs sm:text-[13px] font-semibold text-zinc-100 uppercase tracking-wider">
        <span>FREE SHIPPING ON BULK ORDERS</span>
        <span className="text-base sm:text-lg leading-none" role="img" aria-label="Delivery truck">
          🚚
        </span>
      </div>

      {/* Subtle festive sparkle divider between repeats */}
      <div className="flex items-center gap-1.5 px-2 text-[#FFD700]/70" aria-hidden="true">
        <Sparkles className="w-3.5 h-3.5 animate-pulse text-[#FFD700]" />
      </div>
    </div>
  );

  return (
    <aside
      aria-label="Festive Announcement Bar"
      className="announcement-marquee-track relative w-full h-9 sm:h-10 bg-gradient-to-r from-[#111215] via-[#17171C] to-[#111215] border-b border-[#2A2B33] overflow-hidden select-none z-30 flex items-center shadow-inner"
    >
      {/* Background Diwali Warm Glow Layer */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#FF7A00]/30 via-transparent to-transparent"
        aria-hidden="true"
      />

      {/* Left and Right subtle vignette masks so the marquee seamlessly fades at the view boundaries */}
      <div
        className="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-[#111215] to-transparent z-20 pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-[#111215] to-transparent z-20 pointer-events-none"
        aria-hidden="true"
      />

      {/* Diwali Fuljhari Sparkler Particles Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        aria-hidden="true"
      />

      {/* Decorative Diwali Twinkle Stars at top/bottom border edges */}
      <div className="absolute top-0.5 left-[12%] text-[#FFD700] pointer-events-none z-10 animate-sparkler-twinkle opacity-60 text-[10px]">
        ✦
      </div>
      <div className="absolute bottom-0.5 left-[38%] text-[#FFA500] pointer-events-none z-10 animate-sparkler-twinkle opacity-70 text-[9px] [animation-delay:1.2s]">
        ✦
      </div>
      <div className="absolute top-0.5 right-[24%] text-[#FFF4CC] pointer-events-none z-10 animate-sparkler-twinkle opacity-60 text-[11px] [animation-delay:0.7s]">
        ✦
      </div>
      <div className="absolute bottom-0.5 right-[8%] text-[#FF7A00] pointer-events-none z-10 animate-sparkler-twinkle opacity-70 text-[9px] [animation-delay:1.8s]">
        ✦
      </div>

      {/* Marquee Track: duplicated two times inside animate-announcement-marquee for perfect infinite loop without seams */}
      <div className="animate-announcement-marquee relative z-10 py-1">
        {/* Set 1: repeated 3 times to cover wide screens seamlessly */}
        <div className="flex items-center shrink-0">
          {renderAnnouncementSegment('seg-1a')}
          {renderAnnouncementSegment('seg-1b')}
          {renderAnnouncementSegment('seg-1c')}
        </div>

        {/* Set 2 (Identical clone for seamless translateX(-50%) continuous wrap) */}
        <div className="flex items-center shrink-0">
          {renderAnnouncementSegment('seg-2a')}
          {renderAnnouncementSegment('seg-2b')}
          {renderAnnouncementSegment('seg-2c')}
        </div>
      </div>

      {/* Floating Copy Feedback Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-[#17171C] border border-[#FF7A00] text-white px-4 py-2 rounded-lg shadow-2xl shadow-orange-500/20 text-xs sm:text-sm font-medium flex items-center gap-2 animate-bounce"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[#FF9E40] font-bold">✨ {toastMessage}</span>
          <span className="text-zinc-400 text-xs">(10% discount ready)</span>
        </div>
      )}
    </aside>
  );
};
