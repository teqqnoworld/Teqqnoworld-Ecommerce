import React, { useState } from 'react';
import { Search, X, ArrowRight, Sparkles } from 'lucide-react';
import { PRODUCTS } from '../data/mockData';
import { Product } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct: (product: Product) => void;
  onCustomizeProduct: (productId: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onSelectProduct,
  onCustomizeProduct,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const results = query.trim()
    ? PRODUCTS.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.category.toLowerCase().includes(query.toLowerCase()) ||
          p.description.toLowerCase().includes(query.toLowerCase()) ||
          p.printMethods.some((pm) => pm.toLowerCase().includes(query.toLowerCase()))
      )
    : PRODUCTS.slice(0, 4);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-6 sm:pt-20 px-3 sm:px-4 bg-[#071B35]/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-[0_28px_70px_-15px_rgba(7,27,53,0.42)] max-w-xl w-full overflow-hidden animate-admin-scale-in"
      >
        {/* Search Input Bar */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#071B35] to-[#0B2347] border-b border-white/10 flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-[#FF7900]/15 border border-[#FF7900]/40 flex items-center justify-center shrink-0">
            <Search className="w-4.5 h-4.5 text-[#FF7900] group-focus-within:scale-110 transition-transform duration-200" />
          </div>
          <input
            type="text"
            autoFocus
            placeholder="Search custom polos, hoodies, mugs, standees, MOQ..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm bg-transparent outline-none text-white placeholder-slate-400"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white group/close cursor-pointer transition-colors"
          >
            <X className="w-4.5 h-4.5 group-hover/close:rotate-90 transition-transform duration-200" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-3.5 sm:p-5 max-h-[calc(100dvh-9rem)] sm:max-h-[26rem] overflow-y-auto space-y-2 bg-[#F8FAFC]">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono text-slate-500 uppercase tracking-wider mb-2 px-1">
            <span>{query.trim() ? `Search Results (${results.length})` : 'Popular Corporate Merchandise'}</span>
            <span className="text-[10px] text-slate-400">Instant Customizer Ready</span>
          </div>

          {results.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500 bg-white rounded-2xl border border-slate-200/80">
              No matching merchandise found for "{query}".
            </div>
          ) : (
            results.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-white hover:bg-orange-50/40 transition-all border border-slate-200/80 hover:border-[#FF7900]/50 hover:shadow-sm group"
              >
                <div
                  onClick={() => {
                    onSelectProduct(p);
                    onClose();
                  }}
                  className="cursor-pointer flex-1 min-w-0 pr-2"
                >
                  <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1.5">
                    <span className="text-[#FF7900] font-semibold">{p.category}</span>
                    <span>·</span>
                    <span>MOQ: {p.moq} pcs</span>
                  </div>
                  <h4 className="font-display font-bold text-xs sm:text-sm text-[#071B35] group-hover:text-[#FF7900] transition-colors truncate mt-0.5">
                    {p.name}
                  </h4>
                  <div className="text-xs font-mono font-bold text-slate-700 mt-0.5 tabular-nums">
                    From ₹{p.tieredPricing[p.tieredPricing.length - 1]?.price || p.basePrice} / pc
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onCustomizeProduct(p.id);
                    onClose();
                  }}
                  className="bg-[#071B35] hover:bg-[#FF7900] text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ml-2 group/btn cursor-pointer shadow-xs min-h-[36px]"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FF7900] group-hover/btn:text-white group-hover/btn:rotate-45 transition-all duration-200" />
                  <span>Customize</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
