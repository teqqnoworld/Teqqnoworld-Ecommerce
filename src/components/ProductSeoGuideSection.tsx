import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  FileText,
  Layers,
  Package,
  Palette,
  Printer,
  ShieldCheck,
  Briefcase,
  Calculator,
  ArrowRight,
} from 'lucide-react';
import { getProductKeywordEntry } from '../data/seoKeywordMap';
import type { SeoCategoryDefinition } from '../config/seoRoutes';

interface ProductSeoGuideSectionProps {
  productId: string;
  productDisplayTitle: string;
  categorySeo?: SeoCategoryDefinition;
  onSelectCategory?: (categorySlug: string) => void;
  onNavigateRoute?: (route: string) => void;
}

export const ProductSeoGuideSection: React.FC<ProductSeoGuideSectionProps> = ({
  productId,
  productDisplayTitle,
  categorySeo,
  onSelectCategory,
  onNavigateRoute,
}) => {
  const seoEntry = getProductKeywordEntry(productId);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  if (!seoEntry) return null;

  const handleLinkNav = (
    e: React.MouseEvent<HTMLAnchorElement>,
    handler?: () => void
  ) => {
    if (handler && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      e.preventDefault();
      handler();
    }
  };

  return (
    <section
      aria-label={`${productDisplayTitle} Specifications, Customization Guide and FAQs`}
      className="mt-14 sm:mt-16 pt-10 border-t border-[#E5E5EA] space-y-8"
    >
      {/* Product Overview */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-8 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#FF7900]">
              Product Overview &amp; Verified Details
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B1530] tracking-tight mt-1">
              About {productDisplayTitle}
            </h2>
          </div>
          {categorySeo && (
            <a
              href={`/category/${categorySeo.slug}`}
              onClick={(e) =>
                handleLinkNav(
                  e,
                  onSelectCategory ? () => onSelectCategory(categorySeo.slug) : undefined
                )
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1530] hover:text-[#FF7900] bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-[#FF7900]/40 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span>Browse {categorySeo.name}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <p className="text-sm text-zinc-700 leading-relaxed max-w-4xl">
          {seoEntry.overview}
        </p>

        {/* Verified Technical Specification Table */}
        <div className="pt-4">
          <h3 className="font-display text-base font-bold text-[#0B1530] mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#FF7900]" />
            <span>Product Specifications</span>
          </h3>
          <div className="overflow-hidden rounded-xl border border-slate-200/90">
            <dl className="divide-y divide-slate-100">
              {seoEntry.specs.map((row, idx) => (
                <div
                  key={row.label}
                  className={`grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 px-4 py-2.5 text-xs sm:text-sm ${
                    idx % 2 === 0 ? 'bg-[#FAF9FD]' : 'bg-white'
                  }`}
                >
                  <dt className="font-semibold text-[#0B1530]">{row.label}</dt>
                  <dd className="sm:col-span-2 text-zinc-700">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* 4 Structured Feature & Buyer Guidance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
        <article className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-2">
          <h3 className="font-display text-base font-bold text-[#0B1530] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FF7900] shrink-0" />
            <span>Material &amp; Quality</span>
          </h3>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            {seoEntry.materialAndQuality}
          </p>
        </article>

        <article className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-2">
          <h3 className="font-display text-base font-bold text-[#0B1530] flex items-center gap-2">
            <Printer className="w-4 h-4 text-[#FF7900] shrink-0" />
            <span>Customization &amp; Logo Printing</span>
          </h3>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            {seoEntry.customizationAndLogoPrinting}
          </p>
        </article>

        <article className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-2">
          <h3 className="font-display text-base font-bold text-[#0B1530] flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#FF7900] shrink-0" />
            <span>Available Sizes &amp; Colours</span>
          </h3>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            {seoEntry.sizesAndColours}
          </p>
        </article>

        <article className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-2">
          <h3 className="font-display text-base font-bold text-[#0B1530] flex items-center gap-2">
            <Package className="w-4 h-4 text-[#FF7900] shrink-0" />
            <span>Bulk Ordering &amp; 18% GST Billing</span>
          </h3>
          <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
            {seoEntry.bulkOrdering}
          </p>
          <div className="pt-2 flex flex-wrap gap-2">
            <a
              href="/bulk"
              onClick={(e) =>
                handleLinkNav(e, onNavigateRoute ? () => onNavigateRoute('bulk') : undefined)
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#0B1530] hover:bg-[#14234a] text-white transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Request Corporate Bulk Quote</span>
            </a>
            <a
              href="/quote-calculator"
              onClick={(e) =>
                handleLinkNav(
                  e,
                  onNavigateRoute ? () => onNavigateRoute('quote-calculator') : undefined
                )
              }
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-[#FF7900] text-[#FF7900] hover:text-white border border-orange-200 transition-colors"
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Calculate Bulk INR Price</span>
            </a>
          </div>
        </article>
      </div>

      {/* Suitable Business Uses */}
      <div className="bg-[#0B1530] text-white rounded-2xl p-5 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-[#FF7900]" />
          <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight">
            Suitable Business &amp; Event Uses Across India
          </h2>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {seoEntry.businessUses.map((useCase) => (
            <li
              key={useCase}
              className="flex items-start gap-2 text-xs sm:text-sm text-slate-200 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-[#FF7900] shrink-0 mt-0.5" />
              <span>{useCase}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Frequently Asked Questions (100% synced with FAQPage JSON-LD) */}
      {seoEntry.faqs.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-8 shadow-xs space-y-4">
          <div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#FF7900]">
              Buyer Questions Answered
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B1530] tracking-tight mt-0.5">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="divide-y divide-slate-200/80 border border-slate-200/80 rounded-xl overflow-hidden">
            {seoEntry.faqs.map((faq, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div key={faq.question} className="bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    className="w-full px-4 sm:px-5 py-3.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <h3 className="font-display font-semibold text-xs sm:text-sm text-[#0B1530] leading-snug">
                      {faq.question}
                    </h3>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-[#FF7900]' : ''
                      }`}
                    />
                  </button>
                  <div
                    className={`px-4 sm:px-5 pb-4 text-xs sm:text-sm text-zinc-600 leading-relaxed ${
                      isOpen ? 'block' : 'hidden'
                    }`}
                  >
                    {faq.answer}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};
