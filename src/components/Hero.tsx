import React from 'react';
import { ArrowRight, Sparkles, CheckCircle2, Clock, Truck, FileText, Star, ShieldCheck } from 'lucide-react';
import { OrbitalProductSpinner } from './OrbitalProductSpinner';
import { DelhiveryPincodeChecker } from './DelhiveryPincodeChecker';

interface HeroProps {
  onStartCustomizing: () => void;
  onExploreCatalog: () => void;
  onRequestQuote: () => void;
  onBookAppointment?: () => void;
  onSelectProduct?: (productId: string) => void;
}

export const Hero: React.FC<HeroProps> = ({
  onStartCustomizing,
  onExploreCatalog,
  onBookAppointment,
  onSelectProduct,
}) => {
  return (
    <div className="bg-[#16171B] text-white">
      {/* 1. Main Hero Content */}
      <section className="relative lg:min-h-[calc(100vh-140px)] flex items-center justify-center py-8 sm:py-10 lg:py-16 border-b border-[#2A2A30] overflow-hidden">
        {/* Subtle orange radial ambient glow */}
        <div className="absolute top-1/3 right-1/4 w-[320px] sm:w-[500px] h-[320px] sm:h-[500px] bg-[#FF7A00]/12 rounded-full blur-[110px] sm:blur-[130px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full my-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-10 items-center my-auto">
            
            {/* Left Column (6 cols on lg / desktop): Headlines & Copy */}
            <div className="lg:col-span-6 space-y-4 sm:space-y-5 lg:space-y-6 text-left">
              
              {/* Kicker Pill */}
              <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#202127] border border-[#2F3038] text-zinc-300 text-xs shadow-xs max-w-full">
                <span className="w-2 h-2 rounded-full bg-[#FF7A00] shrink-0" />
                <span className="font-medium text-white tracking-wide text-[11px] sm:text-xs truncate">
                  <span className="sm:hidden">⚡ Fast Dispatch • Free 3D Proof in 1h</span>
                  <span className="hidden sm:inline">Pan-India Fast Dispatch • Free Mockup Proof in 1 Hour • In-House QA</span>
                </span>
              </div>

              {/* Main Headline */}
              <h1 className="font-display text-3xl sm:text-4xl md:text-4xl lg:text-5xl xl:text-6xl font-bold tracking-tight text-white leading-[1.1]">
                Your Logo.<br />
                Your Products.<br />
                <span className="text-[#FF7A00]">Your Brand.</span>
              </h1>

              {/* Subtitle */}
              <p className="text-zinc-300 text-xs sm:text-sm md:text-base max-w-xl font-normal leading-relaxed">
                Direct-from-factory customized printing, branded corporate apparel, and premium client gifts. Built for growing Indian businesses — from 2-piece sample test batches to 50,000+ enterprise rollouts.
              </p>

              {/* CTA Buttons - Full width on mobile for thumb ergonomics, row on tablet/desktop */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 pt-1 sm:pt-2">
                <button
                  onClick={onExploreCatalog}
                  className="w-full sm:w-auto bg-[#FF7A00] hover:bg-[#e06c00] text-white font-display font-semibold text-sm sm:text-base px-6 py-3.5 rounded-xl shadow-lg shadow-[#FF7A00]/25 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group cursor-pointer min-h-[48px]"
                >
                  <span>Shop Products</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
                </button>

                <button
                  onClick={onStartCustomizing}
                  className="w-full sm:w-auto bg-[#202127] hover:bg-[#282a32] text-white border border-[#3A3B45] hover:border-[#FF7A00]/40 font-display font-medium text-sm sm:text-base px-6 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 group cursor-pointer min-h-[48px]"
                >
                  <Sparkles className="w-4 h-4 text-[#FF7A00] group-hover:rotate-45 group-hover:scale-125 transition-all duration-300 animate-icon-pulse-glow" />
                  <span>Customize With Your Logo</span>
                </button>

                {onBookAppointment && (
                  <button
                    onClick={onBookAppointment}
                    className="w-full sm:w-auto bg-[#FF7A00]/10 hover:bg-[#FF7A00]/20 text-[#FF7A00] border border-[#FF7A00]/40 font-display font-semibold text-sm sm:text-base px-5 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 group cursor-pointer min-h-[48px]"
                  >
                    <span>📅 Book Consultation</span>
                  </button>
                )}
              </div>

              {/* 3-Column Metrics Strip */}
              <div className="pt-4 sm:pt-6 grid grid-cols-3 gap-2 sm:gap-4 border-t border-[#2A2A30]">
                <div className="group cursor-default min-w-0">
                  <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold font-display text-white">
                    <Star className="w-3.5 h-3.5 fill-[#FF7A00] text-[#FF7A00] group-hover:scale-125 group-hover:rotate-12 transition-all duration-300 shrink-0" />
                    <span className="truncate">4.9 / 5.0</span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">1,200+ Clients</div>
                </div>

                <div className="group cursor-default min-w-0">
                  <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold font-display text-white">
                    <Truck className="w-3.5 h-3.5 text-[#FF7A00] group-hover:translate-x-1 group-hover:scale-115 transition-all duration-300 shrink-0 animate-icon-drive" />
                    <span className="truncate">18k+ Units</span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">Pan-India Dispatch</div>
                </div>

                <div className="group cursor-default min-w-0">
                  <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-bold font-display text-white">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#FF7A00] group-hover:scale-125 transition-all duration-300 shrink-0 animate-icon-pulse-glow" />
                    <span className="truncate">Direct Factory</span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-zinc-400 mt-0.5 truncate">0% Middleman</div>
                </div>
              </div>

            </div>

            {/* Right Column (6 cols on lg / desktop): 7-Product 3D Orbital Spinner Showcase */}
            <div className="lg:col-span-6 w-full flex items-center justify-center my-auto relative mx-auto">
              <OrbitalProductSpinner
                onSelectProduct={onSelectProduct}
                onStartCustomizing={onStartCustomizing}
              />
            </div>

          </div>
        </div>
      </section>

      {/* 2. Trust Reassurance Strip (Light White / Soft Background) */}
      <div className="bg-white text-[#0B0B0D] border-b border-[#E5E5EA] py-5 sm:py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            
            {/* 1. Approve Before Print */}
            <div className="flex items-center gap-3 group cursor-default">
              <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-purple-200 transition-all duration-300">
                <CheckCircle2 className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300 animate-icon-pulse-glow" />
              </div>
              <div>
                <div className="font-display font-bold text-xs sm:text-sm text-[#0B0B0D] group-hover:text-purple-900 transition-colors">Approve Before Print</div>
                <div className="text-[11px] text-zinc-500">Zero risk with digital 3D proof</div>
              </div>
            </div>

            {/* 2. 24-48h Express Dispatch */}
            <div className="flex items-center gap-3 group cursor-default">
              <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-cyan-200 transition-all duration-300">
                <Clock className="w-5 h-5 group-hover:rotate-45 transition-transform duration-300 animate-icon-float" />
              </div>
              <div>
                <div className="font-display font-bold text-xs sm:text-sm text-[#0B0B0D] group-hover:text-cyan-900 transition-colors">24–48h Express Dispatch</div>
                <div className="text-[11px] text-zinc-500">Rapid turnaround on catalog lines</div>
              </div>
            </div>

            {/* 3. Pan-India Delivery */}
            <div className="flex items-center gap-3 group cursor-default">
              <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-orange-200 transition-all duration-300">
                <Truck className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300 animate-icon-drive" />
              </div>
              <div>
                <div className="font-display font-bold text-xs sm:text-sm text-[#0B0B0D] group-hover:text-[#FF7A00] transition-colors">Pan-India Delivery</div>
                <div className="text-[11px] text-zinc-500">Secure dispatch to all 19,000+ PINs</div>
              </div>
            </div>

            {/* 4. Corporate GST Invoicing */}
            <div className="flex items-center gap-3 group cursor-default">
              <div className="w-10 h-10 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-pink-200 transition-all duration-300">
                <FileText className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform duration-300 animate-icon-float-delayed" />
              </div>
              <div>
                <div className="font-display font-bold text-xs sm:text-sm text-[#0B0B0D] group-hover:text-pink-900 transition-colors">Corporate GST Invoicing</div>
                <div className="text-[11px] text-zinc-500">Claim full 18% ITC benefit</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 3. Interactive Delhivery Serviceability Checker for Storefront Visitors */}
      <DelhiveryPincodeChecker variant="banner" />
    </div>
  );
};
