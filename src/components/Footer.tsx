import React from 'react';
import { ShieldCheck, Lock, FileText, Mail, MapPin, Truck, RotateCcw, Headphones } from 'lucide-react';
import { BUSINESS_DETAILS, LEGAL_PAGES } from '../data/legalData';
import { WhatsAppIcon } from './WhatsAppIcon';

interface FooterProps {
  onNavigate: (tabOrRoute: string) => void;
  onOpenSupabaseDev?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenSupabaseDev }) => {
  return (

    <footer className="bg-[#111215] text-zinc-300 border-t border-[#2A2A30] text-xs">
      {/* 1. Pre-Footer 3-Column Trust Strip */}
      <div className="border-b border-[#2A2A30] py-6 bg-[#16171B]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Item 1 */}
            <div className="flex items-center gap-3 group cursor-default">
              <div className="w-10 h-10 rounded-full bg-[#FF7A00]/10 border border-[#FF7A00]/20 text-[#FF7A00] flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-[#FF7A00]/20 transition-all duration-300">
                <ShieldCheck className="w-5 h-5 group-hover:scale-115 transition-transform duration-300 animate-icon-pulse-glow" />
              </div>
              <div>
                <div className="font-display font-bold text-xs text-white group-hover:text-[#FF7A00] transition-colors">100% In-House QA Standards</div>
                <div className="text-[11px] text-zinc-300 mt-0.5">Manual digital & physical color calibration</div>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex items-center gap-3 group cursor-default">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300">
                <Lock className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform duration-300 animate-icon-float" />
              </div>
              <div>
                <div className="font-display font-bold text-xs text-white group-hover:text-emerald-400 transition-colors">RBI & PCI-DSS Gateway Compliant</div>
                <div className="text-[11px] text-zinc-300 mt-0.5">Secure Razorpay + UPI + NetBanking integration</div>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex items-center gap-3 group cursor-default">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-300">
                <FileText className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform duration-300 animate-icon-float-delayed" />
              </div>
              <div>
                <div className="font-display font-bold text-xs text-white group-hover:text-purple-400 transition-colors">GST Invoicing (SAC 9989)</div>
                <div className="text-[11px] text-zinc-300 mt-0.5">18% Input Tax Credit claim on all corporate orders</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 2. Main Multi-Column Footer Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-24 md:pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 sm:gap-10 pb-10 sm:pb-12 border-b border-[#2A2A30]">
          
          {/* Col 1 (4 cols): Brand Info & Verified Coordinates */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5 group cursor-default">
              <div className="w-8 h-8 rounded-lg bg-[#FF7A00] flex items-center justify-center font-display font-bold text-white text-base group-hover:scale-110 transition-transform duration-300 shadow-xs">
                T
              </div>
              <span className="font-display font-bold text-xl text-white">
                Teqqno<span className="text-[#FF7A00]">World</span>
              </span>
            </div>

            <p className="text-zinc-400 text-xs leading-relaxed max-w-sm">
              India's trusted custom printing and corporate merchandise partner. Direct from production to your office doorstep across India.
            </p>

            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-center gap-2 text-zinc-300 group">
                <WhatsAppIcon variant="badge" className="w-4 h-4 group-hover:animate-icon-ring transition-transform" />
                <a 
                  href={`https://wa.me/${BUSINESS_DETAILS.whatsappHelp.replace(/[^0-9]/g, '')}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-white transition-colors"
                >
                  WhatsApp / Help: {BUSINESS_DETAILS.whatsappHelp}
                </a>
              </div>

              <div className="flex items-center gap-2 text-zinc-300 group">
                <Mail className="w-3.5 h-3.5 text-[#FF7A00] group-hover:rotate-12 group-hover:scale-115 transition-transform" />
                <a 
                  href={`mailto:${BUSINESS_DETAILS.supportEmail}`} 
                  className="hover:text-white transition-colors"
                >
                  {BUSINESS_DETAILS.supportEmail}
                </a>
              </div>

              <div className="flex items-start gap-2 text-zinc-400 group pt-1">
                <MapPin className="w-3.5 h-3.5 text-[#FF7A00] shrink-0 mt-0.5 group-hover:-translate-y-0.5 transition-transform" />
                <span className="text-[11px] leading-snug">
                  {BUSINESS_DETAILS.facilityAddress}
                </span>
              </div>
            </div>
          </div>

          {/* Col 2 (2 cols): Product Categories */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white">
              PRODUCTS
            </h2>
            <ul className="space-y-2 text-zinc-300 text-xs">
              <li>
                <a
                  href="/category/custom-polo-t-shirts"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('/category/custom-polo-t-shirts');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left inline-block"
                >
                  Custom Polo T-Shirts
                </a>
              </li>
              <li>
                <a
                  href="/category/visiting-cards-printing"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('/category/visiting-cards-printing');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left inline-block"
                >
                  Visiting Cards & Stationery
                </a>
              </li>
              <li>
                <a
                  href="/category/corporate-gifting-drinkware"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('/category/corporate-gifting-drinkware');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left inline-block"
                >
                  Ceramic Mugs & Drinkware
                </a>
              </li>
              <li>
                <a
                  href="/category/promotional-displays-signage"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('/category/promotional-displays-signage');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left inline-block"
                >
                  Standees, Canopies & Displays
                </a>
              </li>
              <li>
                <a
                  href="/category/custom-caps"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('/category/custom-caps');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left inline-block"
                >
                  Custom Cotton Caps
                </a>
              </li>
              <li>
                <a
                  href="/catalog"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('catalog');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left inline-block"
                >
                  All Custom Products
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3 (3 cols): Corporate Solutions & Tracking */}
          <div className="lg:col-span-3 space-y-3">
            <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white">
              CORPORATE SOLUTIONS
            </h2>
            <ul className="space-y-2 text-zinc-300 text-xs">
              <li>
                <a
                  href="/orders"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('orders');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left flex items-center gap-1.5"
                >
                  <span className="text-emerald-400">●</span> Track Your Consignment
                </a>
              </li>
              <li>
                <a
                  href="/quote-calculator"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('quote-calculator');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left text-[#FF7A00] font-semibold inline-block"
                >
                  ⚡ B2B Volume Quote Calculator
                </a>
              </li>
              <li>
                <a
                  href="/bundle-builder"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('bundle-builder');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left text-emerald-400 font-semibold inline-block"
                >
                  🎁 Corporate Gift Bundle Builder
                </a>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('catalogues')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  📑 Download PDF Catalogues
                </button>
              </li>
              <li>
                <a
                  href="/bulk"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('bulk');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left inline-block"
                >
                  Enterprise Bulk RFQ
                </a>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('customizer')}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Online Custom Logo Studio
                </button>
              </li>
              <li>
                <a
                  href="/dashboard"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('dashboard');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left inline-block"
                >
                  Corporate Client Dashboard
                </a>
              </li>
              <li>
                <a
                  href="/pricing-and-taxes"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('/pricing-and-taxes');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left inline-block"
                >
                  B2B GST & Volume Discounts
                </a>
              </li>
              <li>
                <a
                  href="/contact-us"
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      onNavigate('/contact-us');
                    }
                  }}
                  className="hover:text-white transition-colors cursor-pointer text-left inline-block"
                >
                  Procurement Vendor Desk
                </a>
              </li>
            </ul>
          </div>

          {/* Col 4 (3 cols): Dedicated Legal & Policies Column */}
          <div className="lg:col-span-3 space-y-3">
            <h2 className="font-display font-bold text-xs uppercase tracking-wider text-white flex items-center gap-1.5">
              <span className="text-[#FF7A00]">§</span>
              <span>LEGAL &amp; POLICIES</span>
            </h2>
            <ul className="space-y-1.5 text-zinc-300 text-xs">
              {LEGAL_PAGES.map((page) => (
                <li key={page.id}>
                  <a
                    href={page.route}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                        e.preventDefault();
                        onNavigate(page.route);
                      }
                    }}
                    className="hover:text-[#FF7A00] transition-colors text-left flex items-center justify-between w-full group py-0.5 cursor-pointer"
                  >
                    <span className="truncate group-hover:translate-x-1 transition-transform">
                      {page.title}
                    </span>
                    <span className="text-zinc-600 group-hover:text-[#FF7A00] text-[10px] shrink-0 ml-1">
                      &rarr;
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Bottom Copyright & Quick Legal Strip */}
        <div className="pt-6 sm:pt-8 pb-2 md:pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-300">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FF7A00] animate-icon-pulse-glow shrink-0" />
              <span>© 2026 {BUSINESS_DETAILS.brandName}. All rights reserved.</span>
            </span>
            <span className="text-zinc-600 hidden sm:inline" aria-hidden="true">•</span>
            <span className="inline-flex items-center gap-1.5 text-zinc-300">
              <Truck className="w-3.5 h-3.5 text-emerald-400 animate-icon-drive shrink-0" />
              <span>Pan-India Delivery</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5 text-zinc-300">
            <a
              href="/privacy-policy"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  onNavigate('/privacy-policy');
                }
              }}
              className="group inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
            >
              <Lock className="w-3 h-3 text-emerald-400 animate-icon-float group-hover:scale-110 transition-transform" />
              <span>Privacy Policy</span>
            </a>
            <span className="text-zinc-700">•</span>
            <a
              href="/terms-and-conditions"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  onNavigate('/terms-and-conditions');
                }
              }}
              className="group inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
            >
              <FileText className="w-3 h-3 text-[#FF7A00] animate-icon-float-delayed group-hover:scale-110 transition-transform" />
              <span>Terms and Conditions</span>
            </a>
            <span className="text-zinc-700">•</span>
            <a
              href="/return-replacement-policy"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  onNavigate('/return-replacement-policy');
                }
              }}
              className="group inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-[#FF7A00] animate-icon-wiggle group-hover:-rotate-90 transition-transform duration-300" />
              <span>Return &amp; Replacement</span>
            </a>
            <span className="text-zinc-700">•</span>
            <a
              href="/cancellation-refund-policy"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  onNavigate('/cancellation-refund-policy');
                }
              }}
              className="group inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-amber-400 animate-icon-wiggle group-hover:-rotate-90 transition-transform duration-300" />
              <span>Cancellation &amp; Refund</span>
            </a>
            <span className="text-zinc-700">•</span>
            <a
              href="/contact-us"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  onNavigate('/contact-us');
                }
              }}
              className="group inline-flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
            >
              <Headphones className="w-3 h-3 text-sky-400 animate-icon-ring group-hover:scale-110 transition-transform" />
              <span>Contact Support</span>
            </a>
          </div>
        </div>
      </div>

    </footer>
  );
};
