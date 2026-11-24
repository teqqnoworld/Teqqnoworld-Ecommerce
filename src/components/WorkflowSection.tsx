import React, { useState, useEffect, useRef } from 'react';
import { 
  UploadCloud, 
  Shirt, 
  Package, 
  Truck, 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Sliders, 
  Layers, 
  Tag,
  Check
} from 'lucide-react';

export const WorkflowSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedProductTab, setSelectedProductTab] = useState<'polo' | 'hoodie' | 'flask'>('polo');
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // Trigger once cleanly
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

  return (
    <section
      ref={sectionRef}
      id="workflow-section"
      className="relative py-20 sm:py-24 bg-[#F8F7FC] border-b border-[#E5E5EA] overflow-hidden"
    >
      {/* Background ambient lighting */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-white/60 rounded-full blur-[140px] pointer-events-none"
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
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#FFF3EB] border border-[#FFE2CC] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-pulse" />
            <span className="text-[11px] sm:text-xs font-mono font-bold uppercase tracking-widest text-[#B85000]">
              TRANSPARENT PRODUCTION FLOW
            </span>
          </div>

          {/* Main Heading */}
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[44px] font-bold text-[#0B0B0D] tracking-tight leading-tight">
            How It Works in 3 Simple Steps
          </h2>

          {/* Supporting Text */}
          <p className="text-zinc-600 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl mx-auto font-normal">
            From choosing your product to approving your design and receiving your order, we make custom merchandise simple.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* DESKTOP THREE-CARD HORIZONTAL TIMELINE WITH PROGRESS CONNECTOR             */}
        {/* ========================================================================= */}
        <div className="hidden lg:block relative">
          
          {/* Thin orange connecting line spanning across the 3 cards */}
          <div
            className="absolute left-[16%] right-[16%] top-[52px] z-0 pointer-events-none"
            aria-hidden="true"
          >
            {/* Base background line */}
            <div className="w-full h-[2px] bg-zinc-200 relative" />

            {/* Active animated progressive orange line */}
            <div
              className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-[#FF7A00] via-[#FF9226] to-[#FF7A00] transition-all duration-1000 ease-out shadow-xs"
              style={{
                width: isVisible ? '100%' : '0%',
                transitionDelay: '300ms',
              }}
            >
              {/* Traveling energy highlight particle */}
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#FF7A00] ring-4 ring-[#FF7A00]/25 shadow-md animate-ping" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white border border-[#FF7A00]" />
            </div>
          </div>

          {/* 3 Step Cards Grid */}
          <div className="grid grid-cols-3 gap-7 xl:gap-8 relative z-10 items-stretch">
            
            {/* --------------------------------------------------------------------- */}
            {/* CARD 01: Choose Your Product & Share Your Logo                        */}
            {/* --------------------------------------------------------------------- */}
            <div
              onMouseEnter={() => setHoveredCard(1)}
              onMouseLeave={() => setHoveredCard(null)}
              className={`group relative bg-white rounded-2xl border transition-all duration-500 ease-out p-6 sm:p-7 flex flex-col justify-between cursor-default ${
                isVisible
                  ? 'opacity-100 translate-y-0 scale-100'
                  : 'opacity-0 translate-y-8 scale-[0.97]'
              } ${
                hoveredCard === 1
                  ? 'shadow-xl shadow-[#FF7A00]/10 -translate-y-2 border-[#FF7A00]/60 ring-1 ring-[#FF7A00]/30'
                  : 'shadow-sm border-zinc-200/90 hover:shadow-md'
              }`}
              style={{ transitionDelay: '150ms' }}
            >
              <div className="space-y-5">
                
                {/* Top Row: Number 01 & Step Pill */}
                <div className="flex items-center justify-between relative">
                  {/* Solid orange circular badge 01 */}
                  <div className="w-11 h-11 rounded-full bg-[#FF7A00] text-white flex items-center justify-center font-display font-bold text-base shadow-sm ring-4 ring-white">
                    01
                  </div>

                  {/* Step 1 of 3 pill */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-zinc-500 bg-zinc-50 border border-zinc-200/80 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A00]" />
                    <span>Step 1 of 3</span>
                  </div>
                </div>

                {/* Miniature Interactive-Looking Product & Upload Interface */}
                <div className="bg-[#FAFAFD] rounded-xl border border-zinc-200/80 p-3.5 space-y-3 shadow-2xs">
                  
                  {/* Row 1: Product Choices */}
                  <div className="grid grid-cols-3 gap-1.5 text-[11px] font-medium">
                    <button
                      type="button"
                      onClick={() => setSelectedProductTab('polo')}
                      className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-all ${
                        selectedProductTab === 'polo'
                          ? 'bg-white text-[#FF7A00] font-bold border-[#FF7A00]/50 shadow-xs'
                          : 'bg-white/80 text-zinc-600 border-zinc-200/80 hover:bg-white'
                      }`}
                    >
                      <Shirt className="w-3.5 h-3.5 text-[#FF7A00]" />
                      <span className="truncate">Polo T-Shirt</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedProductTab('hoodie')}
                      className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-all ${
                        selectedProductTab === 'hoodie'
                          ? 'bg-white text-[#FF7A00] font-bold border-[#FF7A00]/50 shadow-xs'
                          : 'bg-white/80 text-zinc-600 border-zinc-200/80 hover:bg-white'
                      }`}
                    >
                      <Shirt className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="truncate">Hoodie</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedProductTab('flask')}
                      className={`py-1.5 px-2 rounded-lg border flex items-center justify-center gap-1 transition-all ${
                        selectedProductTab === 'flask'
                          ? 'bg-white text-[#FF7A00] font-bold border-[#FF7A00]/50 shadow-xs'
                          : 'bg-white/80 text-zinc-600 border-zinc-200/80 hover:bg-white'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="truncate">Flask</span>
                    </button>
                  </div>

                  {/* Row 2: Dashed Upload Area with Upload Cloud Icon */}
                  <div className={`border-2 border-dashed rounded-xl p-3 flex items-center justify-between transition-all duration-300 ${
                    hoveredCard === 1 
                      ? 'border-[#FF7A00] bg-orange-50/50' 
                      : 'border-orange-200/80 bg-orange-50/30'
                  }`}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-100 text-[#FF7A00] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <UploadCloud className="w-4 h-4 animate-icon-float" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-zinc-800 leading-tight">
                          Drop your logo file
                        </div>
                        <div className="text-[10px] text-zinc-600 leading-tight mt-0.5">
                          Vector or high-res image
                        </div>
                      </div>
                    </div>

                    {/* Subtle green upload-ready indicator */}
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-2xs ring-4 ring-emerald-100 animate-pulse" />
                  </div>

                  {/* Row 3: Format Chips & Upload Ready status */}
                  <div className="flex items-center justify-between text-[10px] pt-0.5">
                    <div className="flex items-center gap-1.5 font-mono">
                      <span className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded text-zinc-600 font-semibold">
                        PNG
                      </span>
                      <span className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded text-zinc-600 font-semibold">
                        SVG
                      </span>
                      <span className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded text-zinc-600 font-semibold">
                        PDF
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[#FF7A00] font-bold">
                      <Check className="w-3 h-3 text-[#FF7A00]" />
                      <span>Upload Ready</span>
                    </div>
                  </div>

                </div>

                {/* Card Title & Description */}
                <div className="space-y-1.5 text-left pt-1">
                  <h3 className="font-display font-bold text-lg text-[#0B0B0D] leading-snug group-hover:text-[#FF7A00] transition-colors">
                    Choose Your Product & Share Your Logo
                  </h3>
                  <p className="text-xs sm:text-[13px] text-zinc-600 leading-relaxed font-sans">
                    Select your merchandise, choose your preferred options, and upload your logo or artwork.
                  </p>
                </div>

              </div>

              {/* Footer Divider: Process Label & Directional Arrow */}
              <div className="pt-4 mt-6 border-t border-zinc-100 flex items-center justify-between text-xs text-[#B85000] font-semibold">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#B85000]" />
                  <span>Product Selection · Logo Upload</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-[#B85000] group-hover:translate-x-1.5 transition-all duration-300" />
              </div>

            </div>

            {/* --------------------------------------------------------------------- */}
            {/* CARD 02: Review Your Design Proof (Highlighted Center Card)           */}
            {/* --------------------------------------------------------------------- */}
            <div
              onMouseEnter={() => setHoveredCard(2)}
              onMouseLeave={() => setHoveredCard(null)}
              className={`group relative bg-white rounded-2xl border-2 transition-all duration-500 ease-out p-6 sm:p-7 flex flex-col justify-between cursor-default border-[#FF7A00] ${
                isVisible
                  ? 'opacity-100 translate-y-0 scale-100'
                  : 'opacity-0 translate-y-8 scale-[0.97]'
              } shadow-xl shadow-[#FF7A00]/12 ${
                hoveredCard === 2 ? '-translate-y-2 shadow-2xl ring-2 ring-[#FF7A00]/40' : ''
              }`}
              style={{ transitionDelay: '350ms' }}
            >
              {/* TOP CENTER MILESTONE BADGE (Exact match to reference image) */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 bg-[#FF7A00] text-white text-[10px] sm:text-[11px] font-display font-bold px-3.5 py-1 rounded-full shadow-md flex items-center gap-1.5 whitespace-nowrap ring-2 ring-white">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
                <span>KEY MILESTONE: APPROVAL REQUIRED</span>
              </div>

              <div className="space-y-5">
                
                {/* Top Row: Number 02 & Proof Preview green badge */}
                <div className="flex items-center justify-between relative pt-1">
                  {/* Solid orange circular badge 02 */}
                  <div className="w-11 h-11 rounded-full bg-[#FF7A00] text-white flex items-center justify-center font-display font-bold text-base shadow-sm ring-4 ring-white">
                    02
                  </div>

                  {/* Proof Preview badge */}
                  <div className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/90 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Proof Preview</span>
                  </div>
                </div>

                {/* Miniature Product Artwork-Preview & Approval Interface */}
                <div className="bg-[#FAFAFD] rounded-xl border border-zinc-200/80 p-3.5 space-y-3 shadow-2xs">
                  
                  {/* Row 1: Placement Dimensions & Scale */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 font-medium">
                    <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-zinc-200/70">
                      <Tag className="w-3 h-3 text-[#FF7A00]" />
                      <span className="font-semibold text-zinc-700">Chest Logo: 3.5" x 2.2"</span>
                    </div>

                    <span className="font-mono text-zinc-600 font-bold bg-white px-1.5 py-0.5 rounded border border-zinc-200/70">
                      Scale 1:1
                    </span>
                  </div>

                  {/* Row 2: Artwork Preview Box with EMBLEM AREA & Checkmark */}
                  <div className="bg-white rounded-lg border border-zinc-200/80 p-3.5 flex items-center justify-center relative min-h-[88px] overflow-hidden">
                    {/* Subtle grid background */}
                    <div 
                      className="absolute inset-0 opacity-20 pointer-events-none" 
                      style={{
                        backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
                        backgroundSize: '12px 12px'
                      }} 
                    />

                    {/* Dashed orange placement boundary with emblem text */}
                    <div className="relative border-2 border-dashed border-[#FF7A00] bg-orange-50/60 rounded-lg px-4 py-2.5 flex flex-col items-center justify-center text-center shadow-2xs group-hover:scale-105 transition-transform duration-300">
                      {/* Green corner verification checkmark */}
                      <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                        ✓
                      </div>

                      <div className="w-4 h-4 text-[#FF7A00] mb-0.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                        </svg>
                      </div>
                      <span className="text-[9px] font-mono font-bold text-zinc-700 tracking-wider">
                        EMBLEM AREA
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Digital Proof Approved Status Panel */}
                  <div className="bg-white rounded-lg border border-zinc-200/80 p-2.5 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shrink-0 shadow-2xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-zinc-900 leading-tight">
                          Digital Proof Approved
                        </div>
                        <div className="text-[10px] text-zinc-600 leading-tight mt-0.5">
                          Exact position &amp; colors verified
                        </div>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                      Ready
                    </span>
                  </div>

                </div>

                {/* Card Title & Description */}
                <div className="space-y-1.5 text-left pt-1">
                  <h3 className="font-display font-bold text-lg text-[#0B0B0D] leading-snug group-hover:text-[#FF7A00] transition-colors">
                    Review Your Design Proof
                  </h3>
                  <p className="text-xs sm:text-[13px] text-zinc-600 leading-relaxed font-sans">
                    Review your digital product preview and request any required adjustments before production begins.
                  </p>
                </div>

              </div>

              {/* Footer Divider: Process Label & Directional Arrow */}
              <div className="pt-4 mt-6 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-800 font-semibold">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Preview · Review · Approval</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-[#FF7A00] group-hover:translate-x-1.5 transition-all duration-300" />
              </div>

            </div>

            {/* --------------------------------------------------------------------- */}
            {/* CARD 03: Production, Packing & Delivery                              */}
            {/* --------------------------------------------------------------------- */}
            <div
              onMouseEnter={() => setHoveredCard(3)}
              onMouseLeave={() => setHoveredCard(null)}
              className={`group relative bg-white rounded-2xl border transition-all duration-500 ease-out p-6 sm:p-7 flex flex-col justify-between cursor-default ${
                isVisible
                  ? 'opacity-100 translate-y-0 scale-100'
                  : 'opacity-0 translate-y-8 scale-[0.97]'
              } ${
                hoveredCard === 3
                  ? 'shadow-xl shadow-[#FF7A00]/10 -translate-y-2 border-[#FF7A00]/60 ring-1 ring-[#FF7A00]/30'
                  : 'shadow-sm border-zinc-200/90 hover:shadow-md'
              }`}
              style={{ transitionDelay: '550ms' }}
            >
              <div className="space-y-5">
                
                {/* Top Row: Number 03 & Final Step pill */}
                <div className="flex items-center justify-between relative">
                  {/* Solid orange circular badge 03 */}
                  <div className="w-11 h-11 rounded-full bg-[#FF7A00] text-white flex items-center justify-center font-display font-bold text-base shadow-sm ring-4 ring-white">
                    03
                  </div>

                  {/* Final Step pill */}
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-zinc-600 bg-zinc-50 border border-zinc-200/80 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Final Step</span>
                  </div>
                </div>

                {/* Miniature Production & Packing Interface */}
                <div className="bg-[#FAFAFD] rounded-xl border border-zinc-200/80 p-3.5 space-y-3 shadow-2xs">
                  
                  {/* Row 1: Production Finished & QA Passed */}
                  <div className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1.5 text-zinc-700 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Production Finished</span>
                    </div>

                    <span className="font-bold text-[#FF7A00] bg-orange-50 px-2 py-0.5 rounded border border-orange-200/70">
                      QA Passed
                    </span>
                  </div>

                  {/* Row 2: Custom Sealed Package Box with poly-pack text & shield */}
                  <div className="bg-white rounded-lg border border-zinc-200/80 p-3 flex items-center justify-between shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#FF7A00] flex items-center justify-center shrink-0 border border-orange-200/60 group-hover:scale-105 transition-transform">
                        <Package className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <div className="text-xs font-bold text-zinc-900 leading-tight">
                          Custom Sealed Package
                        </div>
                        <div className="text-[10px] text-zinc-600 leading-tight mt-0.5">
                          Individually poly-packed &amp; boxed
                        </div>
                      </div>
                    </div>

                    {/* Shield verification icon */}
                    <div className="flex items-center text-emerald-600">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Row 3: Dispatch Indicator & Tracked Transit */}
                  <div className="flex items-center justify-between text-[10px] pt-0.5 text-zinc-500">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Ready for Dispatch</span>
                    </div>

                    <div className="flex items-center gap-1 font-medium text-zinc-500">
                      <Truck className="w-3.5 h-3.5 text-zinc-400 group-hover:translate-x-1 transition-transform" />
                      <span>Tracked Transit</span>
                    </div>
                  </div>

                </div>

                {/* Card Title & Description */}
                <div className="space-y-1.5 text-left pt-1">
                  <h3 className="font-display font-bold text-lg text-[#0B0B0D] leading-snug group-hover:text-[#FF7A00] transition-colors">
                    Production, Packing & Delivery
                  </h3>
                  <p className="text-xs sm:text-[13px] text-zinc-600 leading-relaxed font-sans">
                    After design approval, your order moves to production, careful packing, and dispatch.
                  </p>
                </div>

              </div>

              {/* Footer Divider: Process Label & Completion Icon */}
              <div className="pt-4 mt-6 border-t border-zinc-100 flex items-center justify-between text-xs text-[#B85000] font-semibold">
                <div className="flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-[#B85000]" />
                  <span>Production · Quality Check · Dispatch</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-zinc-500 group-hover:text-emerald-600 transition-colors" />
              </div>

            </div>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* MOBILE & TABLET RESPONSIVE TIMELINE                                       */}
        {/* ========================================================================= */}
        <div className="block lg:hidden relative pl-6 sm:pl-8">
          
          {/* Vertical progressive connecting line on the left */}
          <div
            className="absolute left-3 sm:left-4 top-6 bottom-10 w-[2px] bg-zinc-200"
            aria-hidden="true"
          />

          <div
            className="absolute left-3 sm:left-4 top-6 w-[2px] bg-[#FF7A00] transition-all duration-1000 ease-out"
            style={{
              height: isVisible ? 'calc(100% - 40px)' : '0%',
              transitionDelay: '300ms',
            }}
            aria-hidden="true"
          />

          <div className="space-y-7">
            
            {/* Mobile Step 01 */}
            <div
              className={`relative bg-white rounded-2xl border p-5 sm:p-6 transition-all duration-500 shadow-sm border-zinc-200/90 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              {/* Left node circle intersecting line */}
              <div className="absolute -left-[27px] sm:-left-[31px] top-6 w-6 h-6 rounded-full bg-[#FF7A00] text-white text-[11px] font-display font-bold flex items-center justify-center shadow-xs ring-4 ring-[#F8F7FC]">
                1
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-[#FF7A00] font-mono">STEP 01</div>
                <span className="text-[10px] font-medium text-zinc-500 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full">
                  Step 1 of 3
                </span>
              </div>

              {/* Upload preview mini */}
              <div className="bg-[#FAFAFD] rounded-xl border border-zinc-200 p-3 space-y-2 mb-3.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-800">Drop your logo file</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[9px] text-zinc-500">
                  <span className="bg-white border px-1.5 py-0.5 rounded">PNG</span>
                  <span className="bg-white border px-1.5 py-0.5 rounded">SVG</span>
                  <span className="bg-white border px-1.5 py-0.5 rounded">PDF</span>
                  <span className="text-[#FF7A00] font-bold ml-auto">Upload Ready</span>
                </div>
              </div>

              <h3 className="font-display font-bold text-base text-[#0B0B0D] mb-1">
                Choose Your Product & Share Your Logo
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                Select your merchandise, choose your preferred options, and upload your logo or artwork.
              </p>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-[#FF7A00] font-semibold">
                <span>Product Selection · Logo Upload</span>
                <ArrowRight className="w-4 h-4 text-zinc-400" />
              </div>
            </div>

            {/* Mobile Step 02 (Subtly Highlighted) */}
            <div
              className={`relative bg-white rounded-2xl border-2 border-[#FF7A00] p-5 sm:p-6 transition-all duration-500 shadow-md ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '150ms' }}
            >
              {/* Left node circle intersecting line */}
              <div className="absolute -left-[27px] sm:-left-[31px] top-6 w-6 h-6 rounded-full bg-[#FF7A00] text-white text-[11px] font-display font-bold flex items-center justify-center shadow-xs ring-4 ring-[#F8F7FC]">
                2
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-[#FF7A00] font-mono">STEP 02</div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  ✓ Proof Preview
                </span>
              </div>

              {/* Digital Proof Approved panel mini */}
              <div className="bg-[#FAFAFD] rounded-xl border border-zinc-200 p-3 space-y-2 mb-3.5">
                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>Chest Logo: 3.5" x 2.2"</span>
                  <span className="font-mono font-bold">Scale 1:1</span>
                </div>
                <div className="bg-white rounded border border-zinc-200 p-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
                    <span className="text-emerald-600">✓</span>
                    <span>Digital Proof Approved</span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">Ready</span>
                </div>
              </div>

              <h3 className="font-display font-bold text-base text-[#0B0B0D] mb-1">
                Review Your Design Proof
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                Review your digital product preview and request any required adjustments before production begins.
              </p>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-800 font-semibold">
                <span>Preview · Review · Approval</span>
                <ArrowRight className="w-4 h-4 text-zinc-400" />
              </div>
            </div>

            {/* Mobile Step 03 */}
            <div
              className={`relative bg-white rounded-2xl border p-5 sm:p-6 transition-all duration-500 shadow-sm border-zinc-200/90 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '300ms' }}
            >
              {/* Left node circle intersecting line */}
              <div className="absolute -left-[27px] sm:-left-[31px] top-6 w-6 h-6 rounded-full bg-[#FF7A00] text-white text-[11px] font-display font-bold flex items-center justify-center shadow-xs ring-4 ring-[#F8F7FC]">
                3
              </div>

              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold text-[#FF7A00] font-mono">STEP 03</div>
                <span className="text-[10px] font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full">
                  Final Step
                </span>
              </div>

              {/* Package & QA panel mini */}
              <div className="bg-[#FAFAFD] rounded-xl border border-zinc-200 p-3 space-y-2 mb-3.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-semibold text-zinc-700">Production Finished</span>
                  <span className="font-bold text-[#FF7A00] bg-orange-50 px-1.5 py-0.2 rounded">QA Passed</span>
                </div>
                <div className="bg-white rounded border border-zinc-200 p-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                    <Package className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span>Custom Sealed Package</span>
                  </div>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                </div>
              </div>

              <h3 className="font-display font-bold text-base text-[#0B0B0D] mb-1">
                Production, Packing & Delivery
              </h3>
              <p className="text-xs text-zinc-600 leading-relaxed mb-4">
                After design approval, your order moves to production, careful packing, and dispatch.
              </p>

              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs text-[#FF7A00] font-semibold">
                <span>Production · Quality Check · Dispatch</span>
                <CheckCircle2 className="w-4 h-4 text-zinc-400" />
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Accessibility: prefers-reduced-motion fallback */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          #workflow-section * {
            animation: none !important;
            transition-duration: 0.01ms !important;
            transition-delay: 0ms !important;
          }
        }
      `}</style>
    </section>
  );
};
