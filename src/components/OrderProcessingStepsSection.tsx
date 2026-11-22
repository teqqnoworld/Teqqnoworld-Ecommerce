import React, { useState } from 'react';

interface OrderProcessingStepsSectionProps {
  processingTime?: string;
  dispatchTime?: string;
}

export const OrderProcessingStepsSection: React.FC<OrderProcessingStepsSectionProps> = ({
  processingTime = '(Takes 24-48 hours)',
  dispatchTime = '(Delivery in 4-6 working days)',
}) => {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);

  const steps = [
    {
      num: 1,
      titleLine1: 'Order',
      titleLine2: 'Received',
      subtext: null,
      description: 'Your order is received and confirmed.',
      icon: (
        // Clipboard with bullet list + shopping bag in front
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 sm:w-12 sm:h-12 transition-transform duration-300 group-hover:scale-110"
        >
          {/* Clipboard body */}
          <rect
            x="12"
            y="12"
            width="32"
            height="42"
            rx="5"
            stroke="#0C1D36"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Clipboard top clip */}
          <path
            d="M20 12V8C20 6.89543 20.8954 6 22 6H34C35.1046 6 36 6.89543 36 8V12"
            stroke="#0C1D36"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Clip inner hole */}
          <rect x="25" y="9" width="6" height="3" rx="1.5" fill="#0C1D36" />
          {/* Checklist Row 1 */}
          <circle cx="19" cy="22" r="2.2" fill="#0C1D36" />
          <path d="M25 22H36" stroke="#0C1D36" strokeWidth="2.8" strokeLinecap="round" />
          {/* Checklist Row 2 */}
          <circle cx="19" cy="30" r="2.2" fill="#0C1D36" />
          <path d="M25 30H34" stroke="#0C1D36" strokeWidth="2.8" strokeLinecap="round" />
          {/* Checklist Row 3 */}
          <circle cx="19" cy="38" r="2.2" fill="#0C1D36" />
          <path d="M25 38H30" stroke="#0C1D36" strokeWidth="2.8" strokeLinecap="round" />

          {/* Foreground Shopping Bag in Orange Accent */}
          <g className="filter drop-shadow-xs">
            {/* Bag Body */}
            <path
              d="M31 38L33.2 53.5C33.4 54.9 34.6 56 36 56H48C49.4 56 50.6 54.9 50.8 53.5L53 38C53.2 36.6 52.1 35.4 50.7 35.4H33.3C31.9 35.4 30.8 36.6 31 38Z"
              fill="#FFF4EC"
              stroke="#FF5500"
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            {/* Bag Handle */}
            <path
              d="M37 35.4V31C37 28.2 39.2 26 42 26C44.8 26 47 28.2 47 31V35.4"
              stroke="#FF5500"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        </svg>
      ),
    },
    {
      num: 2,
      titleLine1: 'Order',
      titleLine2: 'Preview',
      subtext: null,
      description: 'We review your design and customization details.',
      icon: (
        // Photo frame with sun and mountain + eye icon in front
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 sm:w-12 sm:h-12 transition-transform duration-300 group-hover:scale-110"
        >
          {/* Picture frame */}
          <rect
            x="10"
            y="14"
            width="38"
            height="32"
            rx="5"
            stroke="#0C1D36"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Sun */}
          <circle cx="21" cy="23" r="3" fill="#0C1D36" />
          {/* Mountains */}
          <path
            d="M12 40L21 29L28 37L35 30L44 41"
            stroke="#0C1D36"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Eye Icon in Orange Accent */}
          <g className="filter drop-shadow-xs">
            {/* Eye Outer Contour */}
            <path
              d="M31 43C31 43 36.5 35 44.5 35C52.5 35 58 43 58 43C58 43 52.5 51 44.5 51C36.5 51 31 43 31 43Z"
              fill="#FFF4EC"
              stroke="#FF5500"
              strokeWidth="3.2"
              strokeLinejoin="round"
            />
            {/* Pupil */}
            <circle cx="44.5" cy="43" r="4" fill="#FF5500" />
            <circle cx="43" cy="41.5" r="1.3" fill="white" />
          </g>
        </svg>
      ),
    },
    {
      num: 3,
      titleLine1: 'Processing',
      titleLine2: 'Order',
      subtext: processingTime,
      description: 'Your custom merchandise enters production.',
      icon: (
        // Laser engraving / printhead nozzle + laser emission sparks
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 sm:w-12 sm:h-12 transition-transform duration-300 group-hover:scale-110"
        >
          {/* Printhead top bar */}
          <rect
            x="14"
            y="12"
            width="36"
            height="7"
            rx="3.5"
            stroke="#0C1D36"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Nozzle funnel body */}
          <path
            d="M18 19L24 33H40L46 19"
            stroke="#0C1D36"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Vertical nozzle tip shaft */}
          <path
            d="M28 33V43L32 46L36 43V33"
            stroke="#0C1D36"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Orange Laser Beam and Sparks */}
          <g className="filter drop-shadow-xs">
            {/* Center laser point / beam */}
            <line
              x1="32"
              y1="47"
              x2="32"
              y2="55"
              stroke="#FF5500"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            {/* Left spark rays */}
            <line
              x1="24"
              y1="56"
              x2="27"
              y2="52"
              stroke="#FF5500"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <line
              x1="22"
              y1="49"
              x2="26"
              y2="48"
              stroke="#FF5500"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            {/* Right spark rays */}
            <line
              x1="40"
              y1="56"
              x2="37"
              y2="52"
              stroke="#FF5500"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            <line
              x1="42"
              y1="49"
              x2="38"
              y2="48"
              stroke="#FF5500"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        </svg>
      ),
    },
    {
      num: 4,
      titleLine1: 'Packed With',
      titleLine2: 'Care',
      subtext: null,
      description: 'Your products are checked and carefully packed.',
      icon: (
        // Open box in isometric view + 3 radiating shine rays
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 sm:w-12 sm:h-12 transition-transform duration-300 group-hover:scale-110"
        >
          {/* Radiating shine rays above box in Orange Accent */}
          <g className="filter drop-shadow-xs">
            {/* Left ray */}
            <line
              x1="22"
              y1="19"
              x2="25"
              y2="24"
              stroke="#FF5500"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            {/* Center ray */}
            <line
              x1="32"
              y1="15"
              x2="32"
              y2="22"
              stroke="#FF5500"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            {/* Right ray */}
            <line
              x1="42"
              y1="19"
              x2="39"
              y2="24"
              stroke="#FF5500"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>

          {/* Open Cardboard Box body */}
          {/* Left Flap */}
          <path
            d="M15 27L24 23L32 30L22 33L15 27Z"
            stroke="#0C1D36"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Right Flap */}
          <path
            d="M49 27L40 23L32 30L42 33L49 27Z"
            stroke="#0C1D36"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Main Box Bottom Base & Front Panels */}
          <path
            d="M18 31V48L32 56L46 48V31"
            stroke="#0C1D36"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Front Center Crease */}
          <line
            x1="32"
            y1="34"
            x2="32"
            y2="55.5"
            stroke="#0C1D36"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Top Opening Rim */}
          <path
            d="M18 31L32 37L46 31"
            stroke="#0C1D36"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      num: 5,
      titleLine1: 'Dispatch',
      titleLine2: '',
      subtext: dispatchTime,
      description: 'Your order is dispatched with tracking when available.',
      icon: (
        // Delivery truck with orange speed lines
        <svg
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-10 h-10 sm:w-12 sm:h-12 transition-transform duration-300 group-hover:scale-110"
        >
          {/* Orange Speed Lines behind the truck */}
          <g className="filter drop-shadow-xs">
            <line
              x1="9"
              y1="33"
              x2="19"
              y2="33"
              stroke="#FF5500"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <line
              x1="7"
              y1="39"
              x2="22"
              y2="39"
              stroke="#FF5500"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <line
              x1="11"
              y1="45"
              x2="17"
              y2="45"
              stroke="#FF5500"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
          </g>

          {/* Delivery Truck Body */}
          {/* Cargo Container */}
          <rect
            x="20"
            y="21"
            width="25"
            height="23"
            rx="3"
            stroke="#0C1D36"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Cabin */}
          <path
            d="M45 28H52L57 35V44H45"
            stroke="#0C1D36"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Cabin Window */}
          <path
            d="M47 31H51L54 36H47V31Z"
            fill="#0C1D36"
          />
          {/* Left Wheel */}
          <circle cx="27" cy="46" r="4.2" stroke="#0C1D36" strokeWidth="3" fill="#E8F4FD" />
          {/* Right Wheel */}
          <circle cx="50" cy="46" r="4.2" stroke="#0C1D36" strokeWidth="3" fill="#E8F4FD" />
          {/* Underbody Chassis line */}
          <line x1="31.5" y1="44" x2="45.5" y2="44" stroke="#0C1D36" strokeWidth="3.2" />
        </svg>
      ),
    },
  ];

  return (
    <section 
      aria-label="Easy Steps for Order Processing" 
      className="py-16 sm:py-24 bg-white relative overflow-hidden transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ===================================================================== */}
        {/* SECTION HEADER (EXACT REPLICA OF REFERENCE IMAGE)                     */}
        {/* ===================================================================== */}
        <div className="text-center mb-16 sm:mb-20">
          
          {/* Top Line: "EASY STEPS FOR" */}
          <h2 className="text-[#0B1B3D] text-2xl sm:text-3xl md:text-4xl font-extrabold uppercase tracking-tight font-display">
            EASY STEPS FOR
          </h2>

          {/* Bottom Line: "ORDER PROCESSING" with flanking orange accent rays */}
          <div className="inline-flex items-center justify-center gap-1.5 sm:gap-4 mt-2 sm:mt-2.5 relative max-w-full">
            
            {/* Left Accent Rays */}
            <div className="hidden xs:flex flex-col items-end gap-1.5 select-none -translate-y-1">
              {/* Upper ray (longer, ~35 deg) */}
              <div 
                className="w-4 sm:w-6 h-1 sm:h-1.5 bg-[#FF5500] rounded-full transform -rotate-[35deg] origin-right transition-transform duration-300 hover:scale-110" 
              />
              {/* Lower ray (shorter, ~20 deg) */}
              <div 
                className="w-2.5 sm:w-4.5 h-1 sm:h-1.5 bg-[#FF5500] rounded-full transform -rotate-[18deg] origin-right transition-transform duration-300 hover:scale-110" 
              />
            </div>

            {/* Pill Container for ORDER PROCESSING */}
            <div className="bg-[#FFF2EA] px-3 sm:px-8 py-1 sm:py-2 rounded-2xl shadow-2xs border border-[#FFE3D1] max-w-full">
              <span className="text-[#FF5500] text-base xs:text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tight sm:tracking-normal font-display whitespace-nowrap">
                ORDER PROCESSING
              </span>
            </div>

            {/* Right Accent Rays */}
            <div className="hidden xs:flex flex-col items-start gap-1.5 select-none -translate-y-1">
              {/* Upper ray (longer, ~35 deg) */}
              <div 
                className="w-4 sm:w-6 h-1 sm:h-1.5 bg-[#FF5500] rounded-full transform rotate-[35deg] origin-left transition-transform duration-300 hover:scale-110" 
              />
              {/* Lower ray (shorter, ~20 deg) */}
              <div 
                className="w-2.5 sm:w-4.5 h-1 sm:h-1.5 bg-[#FF5500] rounded-full transform rotate-[18deg] origin-left transition-transform duration-300 hover:scale-110" 
              />
            </div>

          </div>
        </div>

        {/* ===================================================================== */}
        {/* TIMELINE STEPS CONTAINER                                              */}
        {/* ===================================================================== */}
        
        {/* DESKTOP TIMELINE (EXACT HORIZONTAL 5-STEP BLUEPRINT — LG+ ONLY TO PREVENT TABLET CRAMPING) */}
        <div className="hidden lg:block relative">
          
          {/* Dotted horizontal connector line spanning behind the circles */}
          <div 
            className="absolute left-16 right-16 top-13 z-0 pointer-events-none" 
            aria-hidden="true"
          >
            {/* SVG dashed connector with animated pulse */}
            <svg className="w-full h-4 overflow-visible" preserveAspectRatio="none">
              {/* Dark navy dotted line matching reference */}
              <line
                x1="0"
                y1="8"
                x2="100%"
                y2="8"
                stroke="#0C1D36"
                strokeWidth="2.8"
                strokeDasharray="6 6"
                strokeLinecap="round"
                className="opacity-90"
              />
              {/* Subtle animated orange traveling energy highlight */}
              <line
                x1="0"
                y1="8"
                x2="100%"
                y2="8"
                stroke="#FF5500"
                strokeWidth="2.8"
                strokeDasharray="16 240"
                strokeLinecap="round"
                className="animate-[dash_6s_linear_infinite] opacity-75"
              />
            </svg>
          </div>

          {/* 5 Step Columns in balanced grid */}
          <div className="grid grid-cols-5 gap-4 relative z-10">
            {steps.map((step) => {
              const isHovered = hoveredStep === step.num;
              return (
                <div
                  key={step.num}
                  onMouseEnter={() => setHoveredStep(step.num)}
                  onMouseLeave={() => setHoveredStep(null)}
                  className="flex flex-col items-center text-center group cursor-pointer transition-all duration-300"
                >
                  {/* Pale Blue Circular Icon Bubble */}
                  <div className="relative mb-5">
                    
                    {/* Orange Number Badge at Top Center */}
                    <div 
                      className={`absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#FF5500] text-white flex items-center justify-center font-display font-bold text-xs sm:text-sm shadow-md transition-transform duration-300 z-20 ${
                        isHovered ? 'scale-115 ring-3 ring-orange-200' : 'scale-100'
                      }`}
                    >
                      {step.num}
                    </div>

                    {/* Pale Blue Circle Container */}
                    <div 
                      className={`w-24 h-24 sm:w-26 sm:h-26 md:w-27 md:h-27 rounded-full bg-[#E8F4FD] flex items-center justify-center transition-all duration-300 border border-[#D5EBFB] ${
                        isHovered 
                          ? 'shadow-xl shadow-[#FF5500]/15 -translate-y-1.5 bg-[#DCF0FD]' 
                          : 'shadow-xs hover:shadow-md'
                      }`}
                    >
                      {step.icon}
                    </div>
                  </div>

                  {/* Step Titles matching exact reference casing & hierarchy */}
                  <div className="space-y-0.5 px-2">
                    <h3 className="text-[#0B1B3D] text-base sm:text-lg font-bold leading-tight font-display transition-colors group-hover:text-[#FF5500]">
                      <div>{step.titleLine1}</div>
                      {step.titleLine2 && <div>{step.titleLine2}</div>}
                    </h3>

                    {/* Optional Bracket Subtext (e.g. "(Takes 24-48 hours)" / "(Delivery in 4-6 working days)") */}
                    {step.subtext && (
                      <div className="text-zinc-500 font-medium text-xs sm:text-[13px] pt-0.5 font-sans">
                        {step.subtext}
                      </div>
                    )}

                    {/* Helpful tooltip / business guarantee description */}
                    <p className={`text-[11px] text-zinc-500 max-w-[170px] mx-auto pt-1 leading-snug transition-opacity duration-200 ${
                      isHovered ? 'opacity-100 text-zinc-700 font-medium' : 'opacity-70'
                    }`}>
                      {step.description}
                    </p>
                  </div>

                </div>
              );
            })}
          </div>

        </div>

        {/* MOBILE & TABLET TIMELINE (ADAPTIVE CLEAN VERTICAL FLOW) */}
        <div className="lg:hidden relative max-w-md md:max-w-xl mx-auto space-y-7 sm:space-y-8 pl-2 sm:pl-4">
          
          {/* Vertical Dotted Connector Line (centered behind 80px circle: pl-2(8px)+40px=48px / sm:pl-4(16px)+40px=56px) */}
          <div 
            className="absolute left-[47px] sm:left-[55px] top-6 bottom-6 w-0.5 z-0" 
            aria-hidden="true"
          >
            <div className="w-full h-full border-l-[3px] border-dashed border-[#0C1D36] opacity-80" />
          </div>

          {/* Vertical Steps */}
          {steps.map((step) => {
            const isHovered = hoveredStep === step.num;
            return (
              <div
                key={step.num}
                onClick={() => setHoveredStep(hoveredStep === step.num ? null : step.num)}
                className="flex items-start gap-5 relative z-10 group cursor-pointer"
              >
                {/* Pale Blue Circular Icon Bubble */}
                <div className="relative shrink-0">
                  {/* Orange Number Badge */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#FF5500] text-white flex items-center justify-center font-display font-bold text-xs shadow-md z-20">
                    {step.num}
                  </div>

                  {/* Pale Blue Circle */}
                  <div className={`w-20 h-20 rounded-full bg-[#E8F4FD] flex items-center justify-center border border-[#D5EBFB] transition-transform duration-300 ${
                    isHovered ? 'scale-105 shadow-md shadow-[#FF5500]/15' : ''
                  }`}>
                    {step.icon}
                  </div>
                </div>

                {/* Text Content */}
                <div className="pt-2 text-left">
                  <h3 className="text-[#0B1B3D] text-base font-bold leading-tight font-display">
                    {step.titleLine1} {step.titleLine2}
                  </h3>

                  {step.subtext && (
                    <div className="text-zinc-500 font-medium text-xs pt-0.5">
                      {step.subtext}
                    </div>
                  )}

                  <p className="text-xs text-zinc-600 pt-1 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}

        </div>

      </div>

      {/* Embedded CSS animation for traveling dotted pulse highlight */}
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -1000;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[dash_6s_linear_infinite\\] {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
};
