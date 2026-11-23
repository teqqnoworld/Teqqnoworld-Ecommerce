import React, { useState, useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';

export interface OrbitalProduct {
  id: string;
  name: string;
  shortName: string;
  price: string;
  unit: string;
  tag: string;
  accentColor: string;
  customizerId: string;
}

export const ORBITAL_PRODUCTS: OrbitalProduct[] = [
  {
    id: 'prod-tipping-polo',
    name: 'Tipping Polo T-Shirt (230 GSM)',
    shortName: 'Tipping Polo',
    price: 'From ₹450',
    unit: '/ pc',
    tag: '230 GSM Cotton',
    accentColor: '#FF7A00',
    customizerId: 'prod-polo-01',
  },
  {
    id: 'prod-flexi-cap',
    name: 'Cotton Flexi Caps',
    shortName: 'Flexi Cap',
    price: 'From ₹135',
    unit: '/ pc',
    tag: 'Breathable Cotton',
    accentColor: '#38BDF8',
    customizerId: 'prod-cotton-flexi-caps',
  },
  {
    id: 'prod-ceramic-mug',
    name: 'Promotional Ceramic Mug',
    shortName: 'Ceramic Mug',
    price: '₹249',
    unit: '/ pc',
    tag: '325 ml Glossy',
    accentColor: '#A855F7',
    customizerId: 'prod-ceramic-mug',
  },
  {
    id: 'prod-visiting-card',
    name: 'Premium 300 GSM Visiting Cards',
    shortName: 'Visiting Cards',
    price: '₹300 / 100 pcs',
    unit: '/ 100 pcs',
    tag: '300 GSM Art Paper',
    accentColor: '#10B981',
    customizerId: 'prod-visiting-card-300gsm',
  },
  {
    id: 'prod-rollup-standee',
    name: 'Rollup Retractable Standee',
    shortName: 'Rollup Standee',
    price: 'From ₹1,399',
    unit: '/ pc',
    tag: '3 × 6 ft Display',
    accentColor: '#F59E0B',
    customizerId: 'prod-rollup-standee',
  },
  {
    id: 'prod-canopy-kiosk',
    name: 'Promotional Canopy Kiosk',
    shortName: 'Promo Canopy',
    price: '₹5,100',
    unit: '/ unit',
    tag: 'Navy Blue Stall',
    accentColor: '#6366F1',
    customizerId: 'prod-canopy-kiosk',
  },
  {
    id: 'prod-branded-umbrella',
    name: '5 Feet Promotional Umbrella',
    shortName: '5ft Umbrella',
    price: '₹1,499',
    unit: '/ pc',
    tag: '5ft UV Shield',
    accentColor: '#EC4899',
    customizerId: 'prod-branding-umbrella',
  },
];

// ==============================================================================
// 7 BESPOKE DUOTONE PRODUCT ICONS (#111217 Charcoal & #FF7A00 Brand Orange)
// ==============================================================================

// 1. Tipping Polo: Collar polo with orange collar & sleeve tipping + chest logo
const PoloIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Shirt Body & Short Sleeves */}
    <path
      d="M17 11L7 17L11 25L15 23V41H33V23L37 25L41 17L31 11"
      fill="#111217"
      fillOpacity="0.06"
      stroke="#111217"
      strokeWidth="2.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    {/* Sleeve Tipping Ribbed Accents */}
    <path d="M7.8 18.5L10.8 24.5" stroke="#FF7A00" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M40.2 18.5L37.2 24.5" stroke="#FF7A00" strokeWidth="2.5" strokeLinecap="round" />
    {/* Placket / Button Strip */}
    <path d="M24 13V24" stroke="#111217" strokeWidth="2" strokeLinecap="round" />
    <circle cx="24" cy="17" r="1.2" fill="#FF7A00" />
    <circle cx="24" cy="21" r="1.2" fill="#FF7A00" />
    {/* Collar with Orange Tipping Edge */}
    <path
      d="M17 11L21 16L24 13L27 16L31 11"
      stroke="#111217"
      strokeWidth="2.5"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
    <path
      d="M18.2 11.5L21.5 16L24 13.5L26.5 16L29.8 11.5"
      stroke="#FF7A00"
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    {/* Chest Brand Emblem */}
    <circle cx="20" cy="22" r="2.2" fill="#FF7A00" />
  </svg>
);

// 2. Flexi Cap: Baseball cap with orange visor trim & front emblem
const CapIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Cap Crown Dome */}
    <path
      d="M8 29C8 19 15 12 25 12C33 12 39 17 40 25C40 27 39 29 37 29H8Z"
      fill="#111217"
      fillOpacity="0.06"
      stroke="#111217"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    {/* Panel Seam Line */}
    <path d="M25 12C26 17 27 23 27 29" stroke="#111217" strokeWidth="1.75" strokeDasharray="2 2" />
    {/* Top Button */}
    <ellipse cx="25" cy="11.5" rx="2.5" ry="1.5" fill="#FF7A00" stroke="#111217" strokeWidth="1.5" />
    {/* Eyelets */}
    <circle cx="18" cy="19" r="1" fill="#111217" />
    <circle cx="32" cy="19" r="1" fill="#111217" />
    {/* Front Logo Patch */}
    <rect x="16" y="21" width="6.5" height="5" rx="1.5" fill="#FF7A00" />
    <path d="M18 23.5L20.5 23.5" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" />
    {/* Visor Brim & Orange Tipping Piping */}
    <path
      d="M8 29C14 29 28 29.5 37 29C42 29 45 32 44 35C38 37 22 36.5 8 32V29Z"
      fill="#111217"
    />
    <path
      d="M10 32C23 35.5 38 36 44 34.5"
      stroke="#FF7A00"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

// 3. Ceramic Mug: Glossy coffee mug with handle & orange brand badge
const MugIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Steam wisps */}
    <path d="M16 8C15 10 17 11 16 13" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M22 6C21 8 23 10 22 12" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M28 8C27 10 29 11 28 13" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" />
    {/* Mug Body */}
    <rect
      x="10"
      y="14"
      width="24"
      height="26"
      rx="4"
      fill="#111217"
      fillOpacity="0.06"
      stroke="#111217"
      strokeWidth="2.5"
    />
    {/* Mug Handle */}
    <path
      d="M34 19C39 19 41 22 41 27C41 32 39 35 34 35"
      stroke="#111217"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* Center Orange Brand Emblem */}
    <circle cx="22" cy="27" r="5" fill="#FF7A00" fillOpacity="0.2" stroke="#FF7A00" strokeWidth="2" />
    <path d="M20 27L21.5 28.5L24.5 25.5" stroke="#FF7A00" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    {/* Base Rim */}
    <line x1="12" y1="40" x2="32" y2="40" stroke="#111217" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// 4. Visiting Cards: Overlapping business cards with orange logo square
const VisitingCardsIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Back Card (Angled) */}
    <rect
      x="12"
      y="8"
      width="28"
      height="18"
      rx="2"
      transform="rotate(8 12 8)"
      fill="#111217"
      fillOpacity="0.06"
      stroke="#111217"
      strokeWidth="2"
    />
    <rect
      x="14"
      y="11"
      width="5"
      height="5"
      rx="1"
      transform="rotate(8 14 11)"
      fill="#FF7A00"
      fillOpacity="0.6"
    />
    {/* Front Card */}
    <rect
      x="8"
      y="17"
      width="30"
      height="20"
      rx="2.5"
      fill="#FFFFFF"
      stroke="#111217"
      strokeWidth="2.5"
    />
    {/* Brand Square Logo */}
    <rect x="12" y="21" width="7" height="7" rx="1.5" fill="#FF7A00" />
    <circle cx="15.5" cy="24.5" r="1.5" fill="#FFFFFF" />
    {/* Text Lines */}
    <line x1="22" y1="22" x2="33" y2="22" stroke="#111217" strokeWidth="2" strokeLinecap="round" />
    <line x1="22" y1="26" x2="30" y2="26" stroke="#111217" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.6" />
    <line x1="12" y1="32" x2="34" y2="32" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// 5. Rollup Standee: Retractable banner stand with orange graphic accent
const StandeeIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Top Header Rail Accent */}
    <rect x="16" y="6" width="16" height="3" rx="1" fill="#FF7A00" stroke="#111217" strokeWidth="1.5" />
    {/* Vertical Banner Screen */}
    <rect
      x="17"
      y="9"
      width="14"
      height="27"
      fill="#111217"
      fillOpacity="0.06"
      stroke="#111217"
      strokeWidth="2"
    />
    {/* Graphic Accents inside Banner */}
    <circle cx="24" cy="16" r="3.5" fill="#FF7A00" />
    <line x1="20" y1="23" x2="28" y2="23" stroke="#111217" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="21" y1="26" x2="27" y2="26" stroke="#111217" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.6" />
    <path d="M17 31L23 27L28 32L31 29" stroke="#FF7A00" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    {/* Base Cassette & Feet */}
    <rect x="14" y="36" width="20" height="4" rx="1.5" fill="#111217" stroke="#111217" strokeWidth="1.5" />
    <line x1="10" y1="41" x2="20" y2="39" stroke="#111217" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="38" y1="41" x2="28" y2="39" stroke="#111217" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="24" cy="38" r="1.2" fill="#FF7A00" />
  </svg>
);

// 6. Promo Canopy: Gazebo stall tent with orange peaked roof
const CanopyIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Peaked Roof (Orange) */}
    <path
      d="M24 7L6 18H42L24 7Z"
      fill="#FF7A00"
      stroke="#111217"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    {/* Roof Center Seam */}
    <path d="M24 7V18" stroke="#111217" strokeWidth="1.5" />
    {/* Scalloped Valance / Canopy Pelmet */}
    <path
      d="M6 18V22C10 23 14 21 18 22C22 23 26 21 30 22C34 23 38 21 42 22V18H6Z"
      fill="#FF7A00"
      fillOpacity="0.85"
      stroke="#111217"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <circle cx="24" cy="20" r="1.5" fill="#FFFFFF" />
    {/* 4 Sturdy Legs / Truss Frame */}
    <line x1="10" y1="22" x2="10" y2="40" stroke="#111217" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="38" y1="22" x2="38" y2="40" stroke="#111217" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="18" y1="22" x2="18" y2="38" stroke="#111217" strokeWidth="1.75" strokeOpacity="0.5" strokeLinecap="round" />
    <line x1="30" y1="22" x2="30" y2="38" stroke="#111217" strokeWidth="1.75" strokeOpacity="0.5" strokeLinecap="round" />
    {/* Horizontal Back Truss */}
    <line x1="10" y1="27" x2="38" y2="27" stroke="#111217" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4" />
    {/* Footing Base Plates */}
    <line x1="7" y1="40" x2="13" y2="40" stroke="#FF7A00" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="35" y1="40" x2="41" y2="40" stroke="#FF7A00" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// 7. 5ft Umbrella: Large promotional patio umbrella with alternating orange/dark panels
const UmbrellaIcon: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Top Finial */}
    <path d="M24 5V8" stroke="#111217" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="24" cy="5" r="1.5" fill="#FF7A00" />
    {/* Dome Umbrella Canopy */}
    <path
      d="M7 21C8 12 15 8 24 8C33 8 40 12 41 21C37 23 33 21 29 22C25 21 23 21 19 22C15 21 11 23 7 21Z"
      fill="#111217"
      fillOpacity="0.06"
      stroke="#111217"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    {/* Left Panel (Orange) */}
    <path d="M12 21.5C10 16 15 11 24 8C20 12 18 16 18 21.5" fill="#FF7A00" stroke="#111217" strokeWidth="1.5" />
    {/* Right Panel (Orange) */}
    <path d="M36 21.5C38 16 33 11 24 8C28 12 30 16 30 21.5" fill="#FF7A00" stroke="#111217" strokeWidth="1.5" />
    {/* Center Rib */}
    <line x1="24" y1="8" x2="24" y2="21" stroke="#111217" strokeWidth="2" />
    {/* Telescopic Center Pole */}
    <line x1="24" y1="21" x2="24" y2="39" stroke="#111217" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="24" cy="27" r="1.5" fill="#FF7A00" />
    {/* Tripod Stand / Base Support */}
    <line x1="16" y1="41" x2="24" y2="38" stroke="#111217" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="32" y1="41" x2="24" y2="38" stroke="#111217" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="24" y1="38" x2="24" y2="42" stroke="#FF7A00" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// Map product ID to duotone SVG icon with dynamic size
const renderProductIcon = (productId: string, iconClass: string) => {
  switch (productId) {
    case 'prod-tipping-polo':
      return <PoloIcon className={iconClass} />;
    case 'prod-flexi-cap':
      return <CapIcon className={iconClass} />;
    case 'prod-ceramic-mug':
      return <MugIcon className={iconClass} />;
    case 'prod-visiting-card':
      return <VisitingCardsIcon className={iconClass} />;
    case 'prod-rollup-standee':
      return <StandeeIcon className={iconClass} />;
    case 'prod-canopy-kiosk':
      return <CanopyIcon className={iconClass} />;
    case 'prod-branded-umbrella':
      return <UmbrellaIcon className={iconClass} />;
    default:
      return <PoloIcon className={iconClass} />;
  }
};

// ==============================================================================
// ORBITAL SPINNER COMPONENT WITH DYNAMIC BREAKPOINT SIZING
// ==============================================================================

type ScreenTier = 'mobile' | 'tablet' | 'desktop';

const getScreenTier = (): ScreenTier => {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  if (width < 640) return 'mobile';
  if (width <= 1024) return 'tablet';
  return 'desktop';
};

interface OrbitalProductSpinnerProps {
  onSelectProduct?: (customizerId: string) => void;
  onStartCustomizing?: () => void;
}

export const OrbitalProductSpinner: React.FC<OrbitalProductSpinnerProps> = ({
  onSelectProduct,
  onStartCustomizing,
}) => {
  // Orbital Physics state
  const [wheelAngle, setWheelAngle] = useState<number>(0);
  const [activeProductIndex, setActiveProductIndex] = useState<number>(0);
  const [isHoveredPod, setIsHoveredPod] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Dynamic breakpoint screen tier + measured wrapper width for zero-clipping mobile/tablet fit
  const [screenTier, setScreenTier] = useState<ScreenTier>(getScreenTier);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.min(window.innerWidth - 32, 530) : 340
  );

  useEffect(() => {
    const handleResize = () => {
      setScreenTier(getScreenTier());
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width;
      if (width && width > 0) {
        setMeasuredWidth(width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Breakpoint responsive parameters with dynamic clamping to container width
  const isCompactMobile = screenTier === 'mobile' && measuredWidth < 340;
  const mobileStageDim = Math.max(264, Math.min(Math.floor(measuredWidth), 350));
  const mobileOrbitRadius = Math.round(mobileStageDim * 0.35);

  const tabletStageDim = Math.max(360, Math.min(Math.floor(measuredWidth), 430));
  const tabletOrbitRadius = Math.round(tabletStageDim * 0.39);

  const config = {
    mobile: {
      orbitRadius: mobileOrbitRadius,
      hubSizeClass: isCompactMobile ? 'w-26 h-26' : 'w-30 h-30',
      podSizeClass: isCompactMobile ? 'w-12 h-12' : 'w-14 h-14',
      iconSizeClass: isCompactMobile ? 'w-6 h-6' : 'w-7 h-7',
      stageDim: mobileStageDim,
    },
    tablet: {
      orbitRadius: tabletOrbitRadius,
      hubSizeClass: 'w-36 h-36',
      podSizeClass: 'w-18 h-18',
      iconSizeClass: 'w-9 h-9',
      stageDim: tabletStageDim,
    },
    desktop: {
      orbitRadius: 215,
      hubSizeClass: 'w-44 h-44',
      podSizeClass: 'w-24 h-24',
      iconSizeClass: 'w-11 h-11',
      stageDim: 530,
    },
  }[screenTier];

  const orbitRadius = config.orbitRadius;
  const stageDimension = config.stageDim;
  const stageCenter = stageDimension / 2;

  // Physics animation refs
  const wheelAngleRef = useRef<number>(0);
  const velocityRef = useRef<number>(0.22); // ambient rotational speed
  const isDraggingRef = useRef<boolean>(false);
  const isHoveredPodRef = useRef<boolean>(false);
  const dragCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastDragAngleRef = useRef<number>(0);
  const lastDragTimeRef = useRef<number>(0);
  const touchGestureRef = useRef<{ startX: number; startY: number; mode: 'undecided' | 'spin' | 'scroll' }>({
    startX: 0,
    startY: 0,
    mode: 'undecided',
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Sync refs with state
  useEffect(() => {
    isHoveredPodRef.current = isHoveredPod;
  }, [isHoveredPod]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const TOTAL_PODS = ORBITAL_PRODUCTS.length;
  const ANGLE_STEP = 360 / TOTAL_PODS; // 51.42857 degrees

  // 60FPS Physics Engine loop with rotational inertia and friction decay
  useEffect(() => {
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTimestamp) / 16.666, 2.0); // normalize frame step
      lastTimestamp = timestamp;

      if (!isDraggingRef.current) {
        if (isHoveredPodRef.current) {
          // Gently brake/pause when hovering over a pod so the user can inspect comfortably
          velocityRef.current *= 0.82;
        } else {
          const currentVel = velocityRef.current;
          const ambient = 0.22;

          if (Math.abs(currentVel) > ambient) {
            // Fidget spinner friction decay
            velocityRef.current = currentVel * Math.pow(0.978, dt);
          } else {
            // Keep smooth ambient rotation in whichever direction it was spinning
            const dir = currentVel >= 0 ? 1 : -1;
            velocityRef.current = ambient * dir;
          }
        }

        wheelAngleRef.current = (wheelAngleRef.current + velocityRef.current * dt) % 360;
        setWheelAngle(wheelAngleRef.current);
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // -------------------------------------------------------------
  // RADIAL DRAG-TO-SPIN HANDLERS
  // -------------------------------------------------------------
  const getAngleFromEvent = (clientX: number, clientY: number): number => {
    if (!containerRef.current) return 0;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    dragCenterRef.current = { x: centerX, y: centerY };
    
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  };

  const handlePointerDown = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    const startAngle = getAngleFromEvent(clientX, clientY);
    lastDragAngleRef.current = startAngle;
    lastDragTimeRef.current = performance.now();
    velocityRef.current = 0;
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;
    const currentAngle = getAngleFromEvent(clientX, clientY);
    const now = performance.now();
    const dt = Math.max(now - lastDragTimeRef.current, 8);

    let delta = currentAngle - lastDragAngleRef.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    wheelAngleRef.current = (wheelAngleRef.current + delta) % 360;
    setWheelAngle(wheelAngleRef.current);

    // Track angular velocity
    const instantaneousVelocity = (delta / dt) * 16.666;
    velocityRef.current = instantaneousVelocity * 0.75 + velocityRef.current * 0.25;

    lastDragAngleRef.current = currentAngle;
    lastDragTimeRef.current = now;
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    // Clamp high flick velocity for smooth decay
    if (Math.abs(velocityRef.current) > 28) {
      velocityRef.current = Math.sign(velocityRef.current) * 28;
    }
  };

  // Mouse events
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input, label')) return;
    e.preventDefault();
    handlePointerDown(e.clientX, e.clientY);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    handlePointerMove(e.clientX, e.clientY);
  };

  const onMouseUp = () => {
    handlePointerUp();
  };

  // Touch events: yield vertical swipes to natural page scrolling, engage spin on horizontal flicks
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, label')) return;
    if (e.touches.length === 1) {
      touchGestureRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        mode: 'undecided',
      };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const gesture = touchGestureRef.current;

    if (gesture.mode === 'scroll') return;

    if (gesture.mode === 'undecided') {
      const dx = Math.abs(touch.clientX - gesture.startX);
      const dy = Math.abs(touch.clientY - gesture.startY);
      if (dy > 8 && dy > dx * 1.1) {
        gesture.mode = 'scroll';
        return;
      }
      if (dx > 8 && dx >= dy) {
        gesture.mode = 'spin';
        handlePointerDown(touch.clientX, touch.clientY);
      }
      return;
    }

    if (gesture.mode === 'spin' && isDraggingRef.current) {
      handlePointerMove(touch.clientX, touch.clientY);
    }
  };

  const onTouchEnd = () => {
    touchGestureRef.current.mode = 'undecided';
    handlePointerUp();
  };

  // Fast Spin Trigger
  const triggerFastSpin = () => {
    const currentDir = velocityRef.current >= 0 ? 1 : -1;
    velocityRef.current = 20 * currentDir;
  };

  // Pod click handler
  const handlePodClick = (product: OrbitalProduct, index: number) => {
    setActiveProductIndex(index);
    if (onSelectProduct) {
      onSelectProduct(product.customizerId);
    } else if (onStartCustomizing) {
      onStartCustomizing();
    }
  };

  const activeProduct = ORBITAL_PRODUCTS[activeProductIndex];

  return (
    <div 
      ref={wrapperRef}
      className="w-full max-w-[350px] sm:max-w-[440px] lg:max-w-[580px] aspect-square mx-auto flex items-center justify-center relative overflow-visible my-2 sm:my-4 select-none touch-pan-y"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Soft Ambient Radial Orange Glow behind Center Hub */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] sm:w-[400px] lg:w-[480px] h-[260px] sm:h-[400px] lg:h-[480px] pointer-events-none rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,122,0,0.18) 0%, rgba(255,122,0,0.05) 50%, transparent 75%)',
        }}
      />

      {/* ========================================================= */}
      {/* PURE ORBITAL STAGE (FRAMELESS, RESPONSIVELY SIZED) */}
      {/* ========================================================= */}
      <div 
        ref={containerRef}
        className="relative flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{
          width: `${stageDimension}px`,
          height: `${stageDimension}px`,
        }}
      >
        <div 
          className="relative shrink-0 flex items-center justify-center transition-transform duration-300"
          style={{
            width: `${stageDimension}px`,
            height: `${stageDimension}px`,
          }}
        >
          {/* Outer Ambient Orbital Track Ring */}
          <div 
            className="absolute rounded-full border border-white/10 pointer-events-none"
            style={{ 
              width: `${orbitRadius * 2}px`, 
              height: `${orbitRadius * 2}px`,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />

          {/* Precision SVG Radial Spokes & Dashed Energy Ring */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
            style={{
              transform: `rotate(${wheelAngle}deg)`,
              transformOrigin: '50% 50%',
            }}
          >
            {/* Rotating dashed outer perimeter ring */}
            <circle
              cx={stageCenter}
              cy={stageCenter}
              r={orbitRadius}
              fill="none"
              stroke="rgba(255, 122, 0, 0.28)"
              strokeWidth="1.5"
              strokeDasharray="4 6"
            />

            {/* 7 Precision Spokes from Center Hub to Pod Anchors */}
            {ORBITAL_PRODUCTS.map((prod, idx) => {
              const spokeAngleRad = (idx * ANGLE_STEP * Math.PI) / 180;
              const x2 = stageCenter + orbitRadius * Math.cos(spokeAngleRad);
              const y2 = stageCenter + orbitRadius * Math.sin(spokeAngleRad);
              const isSelected = activeProductIndex === idx;

              return (
                <g key={`spoke-${prod.id}`}>
                  <line
                    x1={stageCenter}
                    y1={stageCenter}
                    x2={x2}
                    y2={y2}
                    stroke={isSelected ? '#FF7A00' : 'rgba(255, 255, 255, 0.12)'}
                    strokeWidth={isSelected ? '2' : '1'}
                    strokeDasharray={isSelected ? 'none' : '2 4'}
                  />
                  <circle
                    cx={x2}
                    cy={y2}
                    r={isSelected ? '3.5' : '2'}
                    fill={isSelected ? '#FF7A00' : 'rgba(255, 122, 0, 0.6)'}
                    className="transition-all duration-300"
                  />
                </g>
              );
            })}
          </svg>

          {/* ========================================================= */}
          {/* ROTATING ORBITAL WHEEL WITH 7 COUNTER-ROTATING PODS */}
          {/* ========================================================= */}
          <div 
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              transform: `rotate(${wheelAngle}deg)`,
              transformOrigin: '50% 50%',
            }}
          >
            {ORBITAL_PRODUCTS.map((product, index) => {
              const podSlotAngle = index * ANGLE_STEP;
              const isActive = activeProductIndex === index;

              return (
                <div
                  key={product.id}
                  className="absolute pointer-events-auto cursor-pointer"
                  style={{
                    top: '50%',
                    left: '50%',
                    // Polar positioning around responsive orbit radius, followed by exact counter-rotation
                    transform: `rotate(${podSlotAngle}deg) translate(${orbitRadius}px) rotate(${-podSlotAngle - wheelAngle}deg)`,
                    transformOrigin: 'center center',
                    width: '0px',
                    height: '0px',
                  }}
                  onMouseEnter={() => {
                    setIsHoveredPod(true);
                    setActiveProductIndex(index);
                  }}
                  onMouseLeave={() => {
                    setIsHoveredPod(false);
                  }}
                  onClick={() => handlePodClick(product, index)}
                >
                  {/* Visual Pod Box */}
                  <div 
                    className={`relative -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group transition-all duration-300 ${
                      isActive ? 'scale-110 z-30' : 'scale-100 hover:scale-105 z-10'
                    }`}
                  >
                    {/* Glowing ring wrapper */}
                    <div className="relative flex items-center justify-center">
                      {/* Subtle outer glowing orange ring */}
                      <div 
                        className={`absolute -inset-1 sm:-inset-1.5 rounded-full transition-opacity duration-300 pointer-events-none ${
                          isActive 
                            ? 'bg-[#FF7A00]/40 blur-md opacity-100' 
                            : 'bg-[#FF7A00]/20 blur-sm opacity-60 group-hover:opacity-100'
                        }`} 
                      />

                      {/* PURE WHITE CIRCULAR POD WITH BESPOKE DUOTONE SVG ICON */}
                      <div 
                        className={`${config.podSizeClass} rounded-full bg-white flex items-center justify-center border-2 sm:border-[3px] border-[#FF7A00] shadow-[0_8px_20px_rgba(255,122,0,0.3),inset_0_2px_4px_rgba(0,0,0,0.08)] transition-all duration-300 relative z-10 ${
                          isActive ? 'ring-2 sm:ring-4 ring-[#FF7A00]/30 scale-105' : ''
                        }`}
                      >
                        {renderProductIcon(product.id, config.iconSizeClass)}
                      </div>
                    </div>

                    {/* Floating Pill Badge at bottom edge of circle (Compact on mobile) */}
                    <div className="relative z-20 -mt-1.5 sm:-mt-2.5 bg-[#111217]/95 backdrop-blur-md px-1.5 sm:px-2.5 py-0.5 rounded-full border border-white/15 shadow-lg text-center flex items-center gap-1 sm:gap-1.5 whitespace-nowrap pointer-events-none group-hover:border-[#FF7A00]/60 transition-colors">
                      <span className="text-[8px] xs:text-[9px] sm:text-[11px] font-semibold text-white tracking-tight">
                        {product.shortName}
                      </span>
                      <span className="hidden xs:inline text-[7px] sm:text-[9px] text-zinc-500">•</span>
                      <span className="hidden xs:inline text-[8px] sm:text-[10px] font-mono font-bold text-[#FF7A00]">
                        {product.price}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ========================================================= */}
          {/* CENTER PRECISION HUB (RESPONSIVE CORE BEARING) */}
          {/* ========================================================= */}
          <div 
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${config.hubSizeClass} rounded-full bg-gradient-to-b from-[#1C1E26] via-[#121319] to-[#0A0B0E] border-2 border-[#FF7A00]/50 shadow-[0_0_45px_rgba(255,122,0,0.3),inset_0_2px_10px_rgba(255,255,255,0.08)] flex flex-col items-center justify-center p-2 sm:p-3 text-center z-20 group`}
          >
            {/* Outer Rotating Energy Ring */}
            <div 
              className="absolute inset-[-3px] sm:inset-[-4px] rounded-full border border-dashed border-[#FF7A00]/40 pointer-events-none"
              style={{
                transform: `rotate(${-wheelAngle * 1.5}deg)`,
              }}
            />

            {/* Inner Metallic Bezel */}
            <div className="absolute inset-1.5 sm:inset-2 rounded-full border border-white/10 pointer-events-none" />

            {/* TeqqnoWorld Brand Micro-badge */}
            <div className="flex flex-col items-center leading-none mb-0.5 sm:mb-1">
              <span className="text-[7px] sm:text-[8px] md:text-[9px] font-mono font-bold tracking-widest text-[#FF7A00] uppercase">
                TEQQNOWORLD
              </span>
              <span className="text-[6px] sm:text-[7px] tracking-wider text-zinc-400 font-medium">
                PRINTING • SOLUTIONS
              </span>
            </div>

            {/* Hub Title */}
            <h3 className="text-[10px] sm:text-xs md:text-sm font-bold text-white tracking-tight leading-tight">
              3D Customize & Spin
            </h3>

            {/* Dynamic Active Product Price Pill */}
            <div className="mt-1 sm:mt-1.5 px-1.5 sm:px-2.5 py-0.5 rounded-full bg-[#FF7A00]/15 border border-[#FF7A00]/40 text-[#FF7A00] font-mono text-[8px] sm:text-[10px] md:text-[11px] font-bold shadow-xs truncate max-w-[100px] sm:max-w-[130px]">
              {activeProduct.shortName} • {activeProduct.price}
            </div>

            {/* Interactive "⚡ Fast Spin" trigger button */}
            <button
              type="button"
              onClick={triggerFastSpin}
              className="mt-1 sm:mt-2 inline-flex items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#FF7A00] hover:bg-[#E56E00] text-white text-[8px] sm:text-[9px] md:text-[10px] font-semibold tracking-wide shadow-md shadow-[#FF7A00]/30 transition-all hover:scale-105 active:scale-95 cursor-pointer z-30"
              title="Give the wheel an energetic fidget-spinner burst"
            >
              <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-white" />
              <span>⚡ Fast Spin</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};
