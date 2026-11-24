import React from 'react';
import { Star } from 'lucide-react';
import { REVIEWS_LIST } from '../data/mockData';

export const ClientReviewsSection: React.FC = () => {
  return (
    <section className="py-16 bg-[#F4F2FA] border-b border-[#E5E5EA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#B85000] mb-1.5">
              PROVEN CLIENT SATISFACTION
            </div>
            <h2 className="font-display text-3xl font-bold text-[#0B0B0D] tracking-tight">
              What Our Customers Say
            </h2>
            <p className="text-zinc-600 text-xs sm:text-sm mt-1">
              Trusted by 1,200+ founders, HR managers, and corporate branding leads across India.
            </p>
          </div>

          {/* Right rating badge */}
          <div className="bg-white border border-zinc-200/90 rounded-2xl p-3 flex items-center gap-3 shrink-0 shadow-2xs group cursor-default">
            <span className="font-display font-bold text-2xl text-[#0B0B0D]">4.9</span>
            <div>
              <div className="flex items-center text-amber-500 gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#FF7A00] text-[#FF7A00] group-hover:scale-120 group-hover:rotate-12 transition-all duration-300" />
                ))}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">340+ Verified Reviews</div>
            </div>
          </div>
        </div>

        {/* 3 Review Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {REVIEWS_LIST.map((r, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-zinc-200/90 p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4 hover:shadow-md hover:border-[#FF7A00]/40 transition-all duration-300 group cursor-default"
            >
              <div>
                {/* Rating stars & verified badge */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-[#FF7A00] text-[#FF7A00] group-hover:scale-115 transition-transform duration-300" />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {r.badge}
                  </span>
                </div>

                {/* Quote */}
                <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed italic">
                  "{r.quote}"
                </p>
              </div>

              {/* Author footer with initials avatar */}
              <div className="pt-4 border-t border-zinc-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs flex items-center justify-center shrink-0 border border-zinc-200">
                  {r.avatar}
                </div>
                <div>
                  <h3 className="font-display font-bold text-xs text-[#0B0B0D]">
                    {r.author}
                  </h3>
                  <p className="text-[11px] text-zinc-600">
                    {r.role}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
