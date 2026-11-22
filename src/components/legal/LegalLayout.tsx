import React, { useEffect } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  ShieldCheck, 
  ChevronRight, 
  Mail, 
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import { WhatsAppIcon } from '../WhatsAppIcon';
import { LEGAL_PAGES, BUSINESS_DETAILS } from '../../data/legalData';

interface SectionLink {
  id: string;
  title: string;
}

interface LegalLayoutProps {
  currentRoute: string;
  title: string;
  description: string;
  lastUpdated: string;
  tableOfContents?: SectionLink[];
  onNavigate: (route: string) => void;
  children: React.ReactNode;
}

export const LegalLayout: React.FC<LegalLayoutProps> = ({
  currentRoute,
  title,
  description,
  lastUpdated,
  tableOfContents = [],
  onNavigate,
  children,
}) => {
  // Update document title for SEO & compliance
  useEffect(() => {
    document.title = `${title} | TeqqnoWorld`;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [title]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFE] text-slate-900 pb-20">
      
      {/* Top Breadcrumb & Header Bar */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4 text-xs">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-slate-500 overflow-x-auto py-0.5">
            <a
              href="/"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  onNavigate('home');
                }
              }}
              className="hover:text-[#FF7A00] transition-colors flex items-center gap-1 font-medium shrink-0 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Store</span>
            </a>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-400 shrink-0">Legal & Compliance</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-900 truncate">{title}</span>
          </nav>

          {/* Quick Support Badge */}
          <div className="hidden md:flex items-center gap-3 text-slate-600">
            <span>Official Portal:</span>
            <a
              href="https://teqqnoworld.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF7A00] font-mono font-medium hover:underline flex items-center gap-1"
            >
              teqqnoworld.com
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Hero Header Area */}
      <header className="bg-gradient-to-b from-white via-orange-50/20 to-[#FBFBFE] border-b border-slate-200/70 pt-12 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFF0E2] border border-orange-200 text-[#FF7A00] text-[11px] font-bold tracking-wider uppercase mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Official Business Policy</span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#0B0B0D] tracking-tight">
              {title}
            </h1>

            <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed">
              {description}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-[#FF7A00]" />
                <span>Last Updated: <strong className="text-slate-800">{lastUpdated}</strong></span>
              </div>
              <span className="text-slate-300">•</span>
              <div>
                Applicable Entity: <span className="font-semibold text-slate-800">TeqqnoWorld</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Layout with 2-Column Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          
          {/* SIDEBAR NAVIGATION (Desktop: 4 columns) */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-18">
            
            {/* Table of Contents (if provided) */}
            {tableOfContents.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900 mb-3 flex items-center justify-between">
                  <span>ON THIS PAGE</span>
                  <span className="text-[10px] text-slate-400 font-normal">Jump to section</span>
                </h3>
                <nav className="space-y-1">
                  {tableOfContents.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className="w-full text-left py-1.5 px-2.5 rounded-lg text-xs text-slate-600 hover:text-[#FF7A00] hover:bg-orange-50/60 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <span className="truncate group-hover:translate-x-0.5 transition-transform">
                        {section.title}
                      </span>
                      <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-[#FF7A00] shrink-0" />
                    </button>
                  ))}
                </nav>
              </div>
            )}

            {/* Complete Legal & Policy Directory Navigation */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-900 mb-3">
                ALL LEGAL & POLICY DOCUMENTS
              </h3>
              <nav className="space-y-1.5">
                {LEGAL_PAGES.map((page) => {
                  const isActive = currentRoute === page.route || currentRoute === page.id;
                  return (
                    <button
                      key={page.id}
                      onClick={() => onNavigate(page.route)}
                      className={`w-full text-left py-2 px-3 rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                        isActive
                          ? 'bg-[#FF7A00] text-white shadow-xs font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent hover:border-slate-200/60'
                      }`}
                    >
                      <span className="truncate">{page.title}</span>
                      <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Support Assistance Box */}
            <div className="bg-gradient-to-br from-[#17171B] to-[#0B0B0D] text-white rounded-2xl p-5 border border-zinc-800 shadow-md">
              <div className="flex items-center gap-2 text-[#FF7A00] font-bold text-xs uppercase tracking-wider mb-2">
                <WhatsAppIcon variant="badge" className="w-4 h-4" />
                <span>Need Policy Clarification?</span>
              </div>
              <p className="text-zinc-300 text-xs leading-relaxed mb-4">
                Our procurement compliance & customer support team is available to assist with vendor onboarding, GST billing, or artwork proofs.
              </p>
              <div className="space-y-2 text-xs">
                <a
                  href={`https://wa.me/${BUSINESS_DETAILS.whatsappHelp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold transition-colors shadow-xs"
                >
                  <WhatsAppIcon className="w-4 h-4 text-white" />
                  <span>WhatsApp: {BUSINESS_DETAILS.whatsappHelp}</span>
                </a>
                <a
                  href={`mailto:${BUSINESS_DETAILS.supportEmail}`}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition-colors border border-zinc-700"
                >
                  <Mail className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>{BUSINESS_DETAILS.supportEmail}</span>
                </a>
              </div>
            </div>

          </aside>

          {/* MAIN ARTICLE BODY (Desktop: 8 columns) */}
          <main className="lg:col-span-8 bg-white rounded-2xl p-6 sm:p-10 border border-slate-200/80 shadow-2xs">
            <article className="prose prose-slate max-w-none prose-headings:font-display prose-headings:tracking-tight prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600">
              {children}
            </article>

            {/* Bottom Contact / Resolution Strip */}
            <div className="mt-12 pt-8 border-t border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-orange-50/40 rounded-xl p-5 border border-orange-100">
              <div>
                <h4 className="font-display font-bold text-sm text-slate-900">Have Questions Regarding This Policy?</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Reach out to our customer resolution desk for quick guidance.
                </p>
              </div>
              <button
                onClick={() => onNavigate('/contact-us')}
                className="bg-[#FF7A00] hover:bg-[#e66e00] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                Contact Support Desk &rarr;
              </button>
            </div>
          </main>

        </div>
      </div>
    </div>
  );
};

export const MerchantPlaceholderNotice: React.FC<{
  title: string;
  items: string[];
}> = ({ title, items }) => (
  <div className="my-6 p-4 rounded-xl border-l-4 border-amber-500 bg-amber-50/70 border-t border-r border-b border-amber-200 text-xs text-amber-950">
    <div className="flex items-center gap-2 font-bold text-amber-900 mb-1.5">
      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
      <span>{title}</span>
    </div>
    <ul className="list-disc list-inside space-y-1 text-amber-900/90 pl-1">
      {items.map((item, idx) => (
        <li key={idx} className="leading-snug">{item}</li>
      ))}
    </ul>
  </div>
);
