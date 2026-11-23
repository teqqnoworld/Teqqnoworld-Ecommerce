import React from 'react';
import { ArrowRight } from 'lucide-react';
import { BUSINESS_CONFIG, getWhatsAppLink } from '../config/business';
import { WhatsAppIcon } from './WhatsAppIcon';

interface CtaBannerProps {
  onExploreCatalog: () => void;
}

export const CtaBanner: React.FC<CtaBannerProps> = ({ onExploreCatalog }) => {
  return (
    <section className="relative py-20 bg-[#16171B] text-white overflow-hidden border-b border-[#2A2A30]">
      {/* Warm orange radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#FF7A00]/14 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-5">
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#FF7A00]">
          ELEVATE YOUR CORPORATE PRESENCE
        </div>

        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
          Ready to Put Your Brand on Premium Merchandise?
        </h2>

        <p className="text-zinc-300 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
          Get instant factory pricing, request your free 1-hour digital proof, or speak directly with our branding specialists today.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
          <a
            href="/catalog"
            onClick={(e) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                e.preventDefault();
                onExploreCatalog();
              }
            }}
            className="bg-[#FF7A00] hover:bg-[#e06c00] text-white font-display font-semibold text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-[#FF7A00]/25 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2 group cursor-pointer"
          >
            <span>Explore Products</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-300" />
          </a>

          <a
            href={getWhatsAppLink('Hi TeqqnoWorld, I want to discuss custom merchandise for my company.')}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#202127] hover:bg-[#282a32] text-white border border-[#3A3B45] hover:border-[#FF7A00]/40 font-display font-medium text-xs sm:text-sm px-5 py-3.5 rounded-xl transition-all flex items-center gap-2 group cursor-pointer"
          >
            <WhatsAppIcon variant="badge" className="w-4.5 h-4.5 group-hover:animate-icon-ring transition-transform" />
            <span>WhatsApp ({BUSINESS_CONFIG.contact.whatsapp})</span>
          </a>
        </div>
      </div>
    </section>
  );
};
