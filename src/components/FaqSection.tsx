import React, { useState } from 'react';
import { Plus, Minus, MessageSquare, Sparkles, HelpCircle } from 'lucide-react';
import { FAQ_LIST } from '../data/mockData';
import { getWhatsAppLink } from '../config/business';

export const FaqSection: React.FC = () => {
  // First item open by default as shown in the reference image blueprint
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenIndex(prev => (prev === idx ? null : idx));
  };

  return (
    <section 
      id="faq-section" 
      className="py-16 sm:py-20 bg-[#F5F3FB] border-b border-[#E5E5EA] relative overflow-hidden"
    >
      {/* Background soft ambient glows */}
      <div 
        aria-hidden="true" 
        className="absolute -top-32 left-1/4 w-96 h-96 bg-orange-100/35 rounded-full blur-3xl pointer-events-none" 
      />
      <div 
        aria-hidden="true" 
        className="absolute bottom-10 right-10 w-96 h-96 bg-purple-100/40 rounded-full blur-3xl pointer-events-none" 
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Heading Area - Exactly matching reference image */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 space-y-3.5">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#FFEFE5] border border-orange-200/70 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#FF7A00] animate-pulse" />
            <span className="text-[11px] sm:text-xs font-bold tracking-wider text-[#FF7A00] uppercase font-mono">
              FREQUENTLY ASKED QUESTIONS
            </span>
          </div>

          {/* Main Heading */}
          <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#111827] tracking-tight">
            Frequently Asked Questions (FAQs)
          </h2>

          {/* Supporting Text */}
          <p className="text-slate-600 text-xs sm:text-sm md:text-base leading-relaxed max-w-2xl mx-auto">
            We’ve compiled answers to some of the most common questions to help you better understand our services and processes.
          </p>
        </div>

        {/* 2-Column Responsive Layout: Left Illustration & Right Accordions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* LEFT COLUMN: 3D Illustration with layered interactive animations (5 cols on desktop) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center lg:sticky lg:top-28">
            <div className="relative w-full max-w-sm sm:max-w-md lg:max-w-none px-2 sm:px-0">
              
              {/* Backing Ambient Aura */}
              <div 
                aria-hidden="true" 
                className="absolute inset-0 bg-gradient-to-tr from-orange-200/30 to-amber-100/20 rounded-3xl blur-2xl transform -rotate-3 scale-95" 
              />

              {/* Main Illustration Asset */}
              <div className="relative rounded-3xl overflow-hidden bg-transparent">
                <img
                  src="/assets/faq_illustration.webp"
                  alt="TeqqnoWorld Customer Support and Production Team ready to assist with orders"
                  width={500}
                  height={400}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-auto object-contain transition-transform duration-500 hover:scale-[1.02] drop-shadow-sm"
                />
              </div>

              {/* Layered Micro-Animation: Floating Question Badge (Top Left) */}
              <div 
                className="absolute -top-2 left-2 sm:top-2 sm:left-4 z-20 animate-faq-float motion-reduce:animate-none pointer-events-none"
                aria-hidden="true"
              >
                <div className="bg-white/95 backdrop-blur-md px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl shadow-lg border border-orange-200/80 flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-[#FF7A00]">
                  <HelpCircle className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Ask Pre-press</span>
                </div>
              </div>

              {/* Layered Micro-Animation: Floating Speech Bubble (Top Right) */}
              <div 
                className="absolute -top-2 right-2 sm:top-4 sm:right-6 z-20 animate-faq-float-reverse motion-reduce:animate-none pointer-events-none"
                aria-hidden="true"
              >
                <div className="bg-[#FF7A00] text-white px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-2xl shadow-lg flex items-center gap-1.5 text-[11px] sm:text-xs font-bold">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Quick Proof ⚡</span>
                </div>
              </div>

              {/* Floating Sparkle Accents */}
              <div 
                className="absolute bottom-14 left-1 sm:-left-2 z-20 animate-faq-sparkle motion-reduce:animate-none text-[#FF7A00] pointer-events-none"
                aria-hidden="true"
              >
                <Sparkles className="w-5 h-5 drop-shadow-sm" />
              </div>
              <div 
                className="absolute top-24 right-1 sm:-right-2 z-20 animate-faq-sparkle motion-reduce:animate-none text-amber-500 pointer-events-none"
                style={{ animationDelay: '1.2s' }}
                aria-hidden="true"
              >
                <Sparkles className="w-4 h-4 drop-shadow-sm" />
              </div>

            </div>

            {/* Support Note below illustration */}
            <div className="mt-6 text-center w-full max-w-sm px-4 py-3 bg-white/70 backdrop-blur-xs rounded-xl border border-slate-200/80 shadow-2xs">
              <p className="text-xs text-slate-600">
                Need immediate assistance?{' '}
                <a 
                  href={getWhatsAppLink('Hi TeqqnoWorld, I have a question about custom merchandise')} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="font-bold text-[#FF7A00] hover:underline inline-flex items-center gap-1"
                >
                  Chat with our specialists &rarr;
                </a>
              </p>
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Accordion with all 8 questions (7 cols on desktop) */}
          <div className="lg:col-span-7 space-y-3 sm:space-y-3.5">
            {FAQ_LIST.map((faq, idx) => {
              const isOpen = openIndex === idx;
              const numStr = (faq as any).num || (idx < 9 ? `0${idx + 1}` : `${idx + 1}`);

              return (
                <div
                  key={idx}
                  className={`rounded-2xl transition-all duration-200 overflow-hidden ${
                    isOpen
                      ? 'bg-[#FFFDFC] border-2 border-[#FF7A00] shadow-md shadow-orange-500/5'
                      : 'bg-white border border-slate-200/85 hover:border-orange-300 shadow-2xs'
                  }`}
                >
                  {/* Accordion Header / Button */}
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${idx}`}
                    className="w-full text-left p-4 sm:p-5 flex items-center justify-between gap-3.5 group cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#FF7A00]/50"
                  >
                    <div className="flex items-center gap-3.5 sm:gap-4 flex-1 min-w-0">
                      {/* Number Badge (01, 02, etc.) */}
                      <span
                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-display font-bold text-xs shrink-0 transition-colors ${
                          isOpen
                            ? 'bg-[#FFE2CC] text-[#FF7A00]'
                            : 'bg-[#FFF0E2] text-[#FF7A00] group-hover:bg-[#FFE2CC]'
                        }`}
                      >
                        {numStr}
                      </span>

                      {/* Question Title */}
                      <span
                        className={`font-display text-xs sm:text-[14.5px] lg:text-[15px] font-bold leading-snug transition-colors ${
                          isOpen
                            ? 'text-[#0B0B0D]'
                            : 'text-[#1E293B] group-hover:text-[#FF7A00]'
                        }`}
                      >
                        {faq.q}
                      </span>
                    </div>

                    {/* Circular Action Toggle (Plus / Minus) */}
                    <span
                      className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isOpen
                          ? 'bg-[#FF7A00] text-white shadow-xs rotate-0'
                          : 'border border-slate-200 bg-slate-50/80 text-slate-500 group-hover:border-orange-300 group-hover:text-[#FF7A00] group-hover:bg-orange-50/50'
                      }`}
                      aria-hidden="true"
                    >
                      {isOpen ? (
                        <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      )}
                    </span>
                  </button>

                  {/* Accordion Expandable Answer */}
                  {isOpen && (
                    <div
                      id={`faq-answer-${idx}`}
                      role="region"
                      className="px-4 sm:px-5 pb-5 pt-0 text-slate-600 text-xs sm:text-sm leading-relaxed border-t border-orange-100/70 mt-1"
                    >
                      <div className="pt-3.5 text-slate-600 leading-relaxed font-normal">
                        {faq.a}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

      </div>
    </section>
  );
};
