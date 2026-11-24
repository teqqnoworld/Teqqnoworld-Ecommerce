import React, { useState, useEffect, useRef } from 'react';
import { ADVANTAGES_4 } from '../data/mockData';

export const AdvantageSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [activeCard, setActiveCard] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Trigger once smoothly
        }
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Custom high-definition animated SVG icons matching the reference Google Stitch blueprint
  const renderCardIcon = (iconType: string, isHovered: boolean) => {
    switch (iconType) {
      case 'precision-manufacturing':
        return (
          // Precision Manufacturing: Printing machine / production equipment with oscillating printhead & laser guide
          <svg
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-9 h-9 sm:w-10 sm:h-10 transition-transform duration-500"
          >
            {/* Base printer chassis */}
            <rect
              x="10"
              y="22"
              width="44"
              height="28"
              rx="6"
              stroke="#0C1D36"
              strokeWidth="3"
              fill="#FFFFFF"
              className="transition-colors duration-300"
            />
            {/* Top paper / garment guide */}
            <path
              d="M18 22V12C18 10.3431 19.3431 9 21 9H43C44.6569 9 46 10.3431 46 12V22"
              stroke="#0C1D36"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            {/* Horizontal precision carriage guide bar */}
            <line
              x1="16"
              y1="32"
              x2="48"
              y2="32"
              stroke="#D1D5DB"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Active sliding printhead carriage with orange accent */}
            <g
              className={`transition-transform duration-700 ease-out ${
                isHovered ? 'translate-x-3.5' : 'translate-x-0'
              }`}
            >
              <rect
                x="26"
                y="27"
                width="12"
                height="10"
                rx="2.5"
                fill="#FF7A00"
                stroke="#0C1D36"
                strokeWidth="2"
              />
              <circle cx="32" cy="32" r="1.5" fill="#FFFFFF" />
              {/* Laser / ink jet beam */}
              <line
                x1="32"
                y1="38"
                x2="32"
                y2="44"
                stroke="#FF7A00"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeDasharray="2 2"
                className="animate-pulse"
              />
            </g>
            {/* Output tray / printed garment slot */}
            <rect
              x="17"
              y="42"
              width="30"
              height="4"
              rx="1.5"
              fill="#E5E7EB"
            />
            {/* Micro status LED indicator */}
            <circle cx="16" cy="27" r="1.5" fill="#10B981" className="animate-ping opacity-75" />
            <circle cx="16" cy="27" r="1.5" fill="#10B981" />
          </svg>
        );

      case 'quality-checked':
        return (
          // Quality Checked: Shield-check with calibrated precision crosshairs & verified stamp
          <svg
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-9 h-9 sm:w-10 sm:h-10 transition-transform duration-500"
          >
            {/* Outer Shield boundary */}
            <path
              d="M32 9L15 15.5V28C15 40.5 22.5 50.8 32 55C41.5 50.8 49 40.5 49 28V15.5L32 9Z"
              fill="#ECFDF5"
              stroke="#0C1D36"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            {/* Inner shield accent contour */}
            <path
              d="M32 15L20 19.8V28.5C20 37.8 25.4 45.4 32 48.8C38.6 45.4 44 37.8 44 28.5V19.8L32 15Z"
              stroke="#10B981"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              opacity="0.8"
            />
            {/* Large verified Checkmark */}
            <path
              d="M24 31.5L29.5 37L40 25.5"
              stroke="#059669"
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-all duration-500 ${
                isHovered ? 'scale-110 -translate-y-0.5' : 'scale-100'
              }`}
              style={{ transformOrigin: '32px 32px' }}
            />
            {/* Micro QA Sparkle */}
            <path
              d="M42 12L43 14.5L45.5 15.5L43 16.5L42 19L41 16.5L38.5 15.5L41 14.5L42 12Z"
              fill="#FF7A00"
              className="animate-pulse"
            />
          </svg>
        );

      case 'flexible-quantities':
        return (
          // Flexible Quantities: Layered/stacked merchandise boxes representing small to bulk scalability
          <svg
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-9 h-9 sm:w-10 sm:h-10 transition-transform duration-500"
          >
            {/* Back secondary tier box (Bulk representation) */}
            <g
              className={`transition-transform duration-500 ${
                isHovered ? '-translate-y-1.5 translate-x-1' : 'translate-y-0'
              }`}
            >
              <path
                d="M36 12L49 19L36 26L23 19L36 12Z"
                fill="#F3E8FF"
                stroke="#0C1D36"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d="M23 19V32L36 39V26L23 19Z"
                fill="#E9D5FF"
                stroke="#0C1D36"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <path
                d="M49 19V32L36 39V26L49 19Z"
                fill="#D8B4FE"
                stroke="#0C1D36"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
            </g>

            {/* Front primary box (Sample / Flexible unit) */}
            <g
              className={`transition-transform duration-500 ${
                isHovered ? 'translate-y-0.5 -translate-x-1' : 'translate-y-0'
              }`}
            >
              {/* Top Face */}
              <path
                d="M27 25L41 32.5L27 40L13 32.5L27 25Z"
                fill="#FFFFFF"
                stroke="#0C1D36"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {/* Left Face */}
              <path
                d="M13 32.5V47L27 54.5V40L13 32.5Z"
                fill="#F5F3FF"
                stroke="#0C1D36"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {/* Right Face */}
              <path
                d="M41 32.5V47L27 54.5V40L41 32.5Z"
                fill="#EDE9FE"
                stroke="#0C1D36"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {/* Orange seal / sealing tape line */}
              <path
                d="M27 25L27 40"
                stroke="#FF7A00"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <path
                d="M27 40L27 47"
                stroke="#FF7A00"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </g>
          </svg>
        );

      case 'order-updates':
        return (
          // Order Updates & Delivery: Delivery truck with radar updates & motion trails
          <svg
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-9 h-9 sm:w-10 sm:h-10 transition-transform duration-500"
          >
            {/* Speed trails behind truck */}
            <g
              className={`transition-opacity duration-300 ${
                isHovered ? 'opacity-100' : 'opacity-70'
              }`}
            >
              <line
                x1="8"
                y1="34"
                x2="15"
                y2="34"
                stroke="#FF7A00"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="6"
                y1="40"
                x2="17"
                y2="40"
                stroke="#FF7A00"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <line
                x1="10"
                y1="46"
                x2="16"
                y2="46"
                stroke="#FF7A00"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>

            {/* Truck Cab & Cargo Box Body */}
            <g
              className={`transition-transform duration-500 ease-out ${
                isHovered ? 'translate-x-2' : 'translate-x-0'
              }`}
            >
              {/* Main Cargo Container Box */}
              <rect
                x="18"
                y="20"
                width="24"
                height="24"
                rx="3.5"
                fill="#EFF6FF"
                stroke="#0C1D36"
                strokeWidth="3"
              />
              {/* Truck Cabin */}
              <path
                d="M42 27H50.5C51.6 27 52.6 27.6 53.1 28.6L55.6 34.2C55.9 34.8 56 35.4 56 36.1V44H42V27Z"
                fill="#FFFFFF"
                stroke="#0C1D36"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              {/* Cabin Windshield Glass */}
              <path
                d="M44 30H49.8L52.8 35.5H44V30Z"
                fill="#BFDBFE"
                stroke="#0C1D36"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              {/* Truck Front Headlight */}
              <circle cx="54.5" cy="40.5" r="1.5" fill="#FF7A00" />

              {/* Rear Wheel */}
              <circle cx="26" cy="45" r="5.5" fill="#0C1D36" />
              <circle cx="26" cy="45" r="2.2" fill="#FFFFFF" />

              {/* Front Wheel */}
              <circle cx="48" cy="45" r="5.5" fill="#0C1D36" />
              <circle cx="48" cy="45" r="2.2" fill="#FFFFFF" />

              {/* Live Tracking GPS Pulse Signal on top */}
              <circle cx="30" cy="12" r="2" fill="#3B82F6" />
              <path
                d="M26 12C26 9.8 27.8 8 30 8C32.2 8 34 9.8 34 12"
                stroke="#3B82F6"
                strokeWidth="2"
                strokeLinecap="round"
                className="animate-pulse"
              />
              <path
                d="M23 12C23 8.1 26.1 5 30 5C33.9 5 37 8.1 37 12"
                stroke="#3B82F6"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.6"
              />
            </g>
          </svg>
        );

      default:
        return null;
    }
  };

  return (
    <section
      ref={sectionRef}
      id="advantage-section"
      className="relative py-20 sm:py-24 bg-[#F4F2FA] border-b border-[#E5E5EA] overflow-hidden"
    >
      {/* Background ambient light gradient for subtle depth */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[550px] bg-white/50 rounded-full blur-[140px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* ========================================================================= */}
        {/* SECTION HEADER: Exact Blueprint Alignment & Wording                       */}
        {/* ========================================================================= */}
        <div
          className={`text-center max-w-3xl mx-auto mb-16 sm:mb-20 space-y-3 transition-all duration-800 ease-out ${
            isVisible
              ? 'opacity-100 translate-y-0 blur-none'
              : 'opacity-0 translate-y-6 blur-[3px]'
          }`}
        >
          {/* Eyebrow Label */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/80 border border-orange-200/60 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-pulse" />
            <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-widest text-[#B85000]">
              THE TEQQNOWORLD ADVANTAGE
            </span>
          </div>

          {/* Main Heading */}
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold text-[#0B0B0D] tracking-tight leading-[1.18]">
            Built to Remove Corporate Merchandise Headaches
          </h2>

          {/* Supporting Text matching exact prompt brief */}
          <p className="text-zinc-600 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl mx-auto font-normal">
            We make custom merchandise simpler with reliable production, careful quality checks, flexible quantities, and transparent delivery updates.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* DESKTOP FOUR-CARD HORIZONTAL TIMELINE WITH PROGRESS CONNECTOR             */}
        {/* ========================================================================= */}
        <div className="hidden lg:block relative">
          
          {/* Connecting Line spanning horizontally across the four cards */}
          {/* Positioned behind cards and vertically aligned with the circular icon centers */}
          <div
            className="absolute left-[12.5%] right-[12.5%] top-[56px] z-0 pointer-events-none"
            aria-hidden="true"
          >
            {/* Background base dashed gray track */}
            <div className="w-full h-[3px] border-t-2 border-dashed border-zinc-300/80 relative" />

            {/* Active progressive orange reveal bar */}
            <div
              className="absolute top-0 left-0 h-[3px] bg-gradient-to-r from-[#FF7A00] via-[#FF9226] to-[#FF7A00] transition-all duration-1200 ease-out shadow-xs"
              style={{
                width: isVisible ? '100%' : '0%',
                transitionDelay: '300ms',
              }}
            >
              {/* Traveling energy sparkle particle */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-[#FF7A00] ring-4 ring-[#FF7A00]/25 shadow-md animate-ping" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border border-[#FF7A00]" />
            </div>
          </div>

          {/* Four Advantage Cards Grid */}
          <div className="grid grid-cols-4 gap-6 xl:gap-8 relative z-10">
            {ADVANTAGES_4.map((adv, idx) => {
              const isHovered = activeCard === idx;
              // Staggered reveal delay: 150ms, 350ms, 550ms, 750ms
              const delayMs = 150 + idx * 200;

              return (
                <div
                  key={adv.stage}
                  onMouseEnter={() => setActiveCard(idx)}
                  onMouseLeave={() => setActiveCard(null)}
                  className={`group relative bg-white rounded-2xl border transition-all duration-500 ease-out p-7 flex flex-col justify-between cursor-default ${
                    isVisible
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-0 translate-y-8 scale-[0.96]'
                  } ${
                    isHovered
                      ? 'shadow-2xl shadow-[#FF7A00]/12 -translate-y-2.5 border-[#FF7A00]/50 ring-1 ring-[#FF7A00]/30'
                      : 'shadow-sm border-zinc-200/90 hover:shadow-md'
                  }`}
                  style={{
                    transitionDelay: `${delayMs}ms`,
                  }}
                >
                  {/* Card Content Top Container */}
                  <div className="space-y-5">
                    
                    {/* Top Row: Stage Badge & Circular Icon Container */}
                    <div className="flex items-center justify-between relative">
                      
                      {/* Circular Icon Container */}
                      <div
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-400 border relative z-10 bg-white ${
                          isHovered
                            ? 'scale-110 shadow-lg border-[#FF7A00]/40 ring-4 ring-[#FF7A00]/10'
                            : 'shadow-xs border-zinc-200/80'
                        }`}
                        style={{
                          backgroundColor: isHovered ? '#FFF9F2' : '#FAFAFC',
                        }}
                      >
                        {renderCardIcon(adv.icon, isHovered)}
                      </div>

                      {/* Orange Stage Badge (e.g. 01, 02, 03, 04) */}
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-mono font-bold transition-all duration-300 shadow-2xs flex items-center gap-1 ${
                          isHovered
                            ? 'bg-[#FF7A00] text-white scale-105 shadow-md shadow-[#FF7A00]/25'
                            : 'bg-orange-50 text-[#B85000] border border-orange-200/70'
                        }`}
                      >
                        <span className="text-[10px] opacity-85">STEP</span>
                        <span>{adv.stage}</span>
                      </div>
                    </div>

                    {/* Card Title & Description */}
                    <div className="space-y-2 pt-1 text-left">
                      <h3
                        className={`font-display font-bold text-lg text-[#0B0B0D] leading-snug transition-colors duration-200 ${
                          isHovered ? 'text-[#FF7A00]' : ''
                        }`}
                      >
                        {adv.title}
                      </h3>

                      <p className="text-xs sm:text-[13px] text-zinc-600 leading-relaxed font-sans">
                        {adv.desc}
                      </p>
                    </div>

                  </div>

                  {/* Card Bottom subtle quality indicator bar */}
                  <div className="pt-5 mt-5 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono text-zinc-600">
                    <span className="capitalize">{adv.tag}</span>
                    <span
                      className={`inline-block w-2 h-2 rounded-full transition-all duration-300 ${
                        isHovered ? 'bg-[#FF7A00] scale-125' : 'bg-zinc-200'
                      }`}
                    />
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* ========================================================================= */}
        {/* TABLET LAYOUT (2x2 GRID WITH SEQUENTIAL STAGGER)                          */}
        {/* ========================================================================= */}
        <div className="hidden sm:grid lg:hidden grid-cols-2 gap-6 relative z-10">
          {ADVANTAGES_4.map((adv, idx) => {
            const isHovered = activeCard === idx;
            const delayMs = 150 + idx * 150;

            return (
              <div
                key={adv.stage}
                onClick={() => setActiveCard(activeCard === idx ? null : idx)}
                className={`bg-white rounded-2xl border p-6 flex flex-col justify-between transition-all duration-500 ${
                  isVisible
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-6 scale-[0.97]'
                } ${
                  isHovered
                    ? 'shadow-xl -translate-y-1.5 border-[#FF7A00]/50 ring-1 ring-[#FF7A00]/30'
                    : 'shadow-sm border-zinc-200/90'
                }`}
                style={{
                  transitionDelay: `${delayMs}ms`,
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-zinc-200/80 bg-[#FAFAFC] shadow-xs">
                      {renderCardIcon(adv.icon, isHovered)}
                    </div>
                    <div className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-orange-50 text-[#FF7A00] border border-orange-200/70">
                      STEP {adv.stage}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-left">
                    <h3 className="font-display font-bold text-base text-[#0B0B0D]">
                      {adv.title}
                    </h3>
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {adv.desc}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-zinc-100 flex items-center justify-between text-[11px] font-mono text-zinc-600">
                  <span>{adv.tag}</span>
                  <span className="w-2 h-2 rounded-full bg-[#FF7A00]" />
                </div>
              </div>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* MOBILE LAYOUT (CLEAN VERTICAL TIMELINE WITH CONNECTING LINE ALONG LEFT)    */}
        {/* ========================================================================= */}
        <div className="block sm:hidden relative pl-6">
          
          {/* Vertical progressive connecting line on the left */}
          <div
            className="absolute left-2.5 top-5 bottom-8 w-[2.5px] border-l-2 border-dashed border-zinc-300"
            aria-hidden="true"
          />

          <div
            className="absolute left-2.5 top-5 w-[2.5px] bg-[#FF7A00] transition-all duration-1200 ease-out"
            style={{
              height: isVisible ? 'calc(100% - 32px)' : '0%',
              transitionDelay: '300ms',
            }}
            aria-hidden="true"
          />

          <div className="space-y-5">
            {ADVANTAGES_4.map((adv, idx) => {
              const isHovered = activeCard === idx;
              const delayMs = 100 + idx * 120;

              return (
                <div
                  key={adv.stage}
                  onClick={() => setActiveCard(activeCard === idx ? null : idx)}
                  className={`relative bg-white rounded-2xl border p-5 transition-all duration-500 ${
                    isVisible
                      ? 'opacity-100 translate-y-0'
                      : 'opacity-0 translate-y-4'
                  } ${
                    isHovered
                      ? 'shadow-md border-[#FF7A00]/50 ring-1 ring-[#FF7A00]/30'
                      : 'shadow-xs border-zinc-200/90'
                  }`}
                  style={{
                    transitionDelay: `${delayMs}ms`,
                  }}
                >
                  {/* Left Node Dot intersecting the vertical line */}
                  <div
                    className="absolute -left-[27px] top-6 w-5 h-5 rounded-full bg-[#FF7A00] text-white text-[10px] font-mono font-bold flex items-center justify-center shadow-xs ring-4 ring-[#F4F2FA]"
                  >
                    {adv.num}
                  </div>

                  <div className="flex items-start gap-3.5">
                    {/* Icon container */}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-zinc-200/80 bg-[#FAFAFC] shrink-0">
                      {renderCardIcon(adv.icon, isHovered)}
                    </div>

                    {/* Text content */}
                    <div className="flex-1 text-left space-y-1">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display font-bold text-sm text-[#0B0B0D]">
                          {adv.title}
                        </h3>
                        <span className="text-[10px] font-mono font-bold text-[#FF7A00] bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200/60">
                          {adv.stage}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-600 leading-relaxed">
                        {adv.desc}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </div>

      </div>

      {/* Embedded CSS for smooth reduced motion and energy sparkle keyframes */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          #advantage-section * {
            animation: none !important;
            transition-duration: 0.01ms !important;
            transition-delay: 0ms !important;
          }
        }
      `}</style>
    </section>
  );
};
