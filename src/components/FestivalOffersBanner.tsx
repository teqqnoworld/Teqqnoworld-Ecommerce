import React, { useEffect, useState } from 'react';
import { Check, Copy, Gift, Sparkles, Tag } from 'lucide-react';
import { fetchPublicStorefrontOffers } from '../services/couponService';
import type { PublicCouponSummary } from '../types/coupon';

interface FestivalOffersBannerProps {
  onApplyCodeToCart?: (code: string) => void;
}

function formatOfferTag(offer: PublicCouponSummary): string {
  if (offer.offerType === 'free_shipping') return 'FREE EXPRESS SHIPPING';
  if (offer.offerType === 'percentage') {
    return offer.maxDiscountCap
      ? `${offer.discountValue}% OFF (UP TO ₹${Number(offer.maxDiscountCap).toLocaleString('en-IN')})`
      : `${offer.discountValue}% OFF`;
  }
  return `₹${Number(offer.discountValue).toLocaleString('en-IN')} INSTANT OFF`;
}

export const FestivalOffersBanner: React.FC<FestivalOffersBannerProps> = ({
  onApplyCodeToCart,
}) => {
  const [festivalOffers, setFestivalOffers] = useState<PublicCouponSummary[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchPublicStorefrontOffers().then((res) => {
      if (!mounted) return;
      // Strict guard: only display active public storefront festival offers (never private coupons)
      const safe = (res.festivalOffers || []).filter((o) => !o.isPrivate && o.isFestival && o.showOnStorefront);
      setFestivalOffers(safe);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (festivalOffers.length === 0) return null;

  const handleCopyAndStage = async (offer: PublicCouponSummary) => {
    try {
      await navigator.clipboard.writeText(offer.code);
    } catch {
      // clipboard optional
    }
    try {
      sessionStorage.setItem('teqqno_applied_coupon', offer.code);
    } catch {
      // ignore storage errors
    }
    setCopiedId(offer.id);
    setTimeout(() => setCopiedId((prev) => (prev === offer.id ? null : prev)), 2200);
    onApplyCodeToCart?.(offer.code);
  };

  return (
    <section className="bg-[#071B35] border-y border-white/10 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-4">
        {festivalOffers.map((offer) => (
          <div
            key={offer.id}
            className="rounded-2xl bg-gradient-to-r from-[#0B2547] via-[#071B35] to-[#132F55] border border-white/15 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 shadow-lg"
          >
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              {offer.festivalBannerUrl ? (
                <img
                  src={offer.festivalBannerUrl}
                  alt={offer.festivalBannerHeadline || offer.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-white/20 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-[#FF7A00]/15 border border-[#FF7A00]/40 flex items-center justify-center shrink-0">
                  <Gift className="w-7 h-7 text-[#FF7A00]" />
                </div>
              )}

              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#FF7A00]">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{offer.campaignName || 'Limited-Time Festival Offer'}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white mt-0.5 leading-snug">
                  {offer.festivalBannerHeadline || offer.name}
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1 line-clamp-2">
                  {offer.festivalBannerSubtext ||
                    offer.description ||
                    'Apply this festive voucher at checkout for instant savings.'}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-300 tabular-nums">
                  <span className="font-bold text-[#FF7A00]">{formatOfferTag(offer)}</span>
                  {offer.minOrderAmount > 0 && (
                    <span>Min order: ₹{offer.minOrderAmount.toLocaleString('en-IN')}</span>
                  )}
                  {offer.expiresAt && (
                    <span>
                      Ends{' '}
                      {new Date(offer.expiresAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="px-4 py-2.5 rounded-xl bg-white/5 border border-dashed border-[#FF7A00]/80 text-center">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Promo Code</div>
                <div className="font-mono font-extrabold text-sm sm:text-base tracking-widest text-white">
                  {offer.code}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCopyAndStage(offer)}
                className="px-4 py-3 rounded-xl bg-[#FF7A00] hover:bg-[#e86d00] text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 shadow-md transition-colors cursor-pointer"
              >
                {copiedId === offer.id ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Code Ready!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy & Use</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
