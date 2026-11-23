import React, { useState } from 'react';
import {
  Star,
  Check,
  ShoppingCart,
  Edit3,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { Product, VisitingCardDesignState } from '../types';
import { ProductAssuranceCards } from './ProductAssuranceCards';
import { BUSINESS_CONFIG } from '../config/business';
import { getProductH1 } from '../config/seoRoutes';

interface VisitingCardBuyBoxProps {
  product: Product;
  quantity: number; // in units (100, 200, 500, etc.)
  setQuantity: (qty: number) => void;
  design: VisitingCardDesignState;
  onOpenEditor: () => void;
  onAddToCart: () => void;
  isAdding: boolean;
  addedSuccessToast: boolean;
  mainBuyButtonRef: React.RefObject<HTMLButtonElement | null>;
}

export const VisitingCardBuyBox: React.FC<VisitingCardBuyBoxProps> = ({
  product,
  quantity,
  setQuantity,
  design,
  onOpenEditor,
  onAddToCart,
  isAdding,
  addedSuccessToast,
  mainBuyButtonRef,
}) => {
  // Exact Pricing Slabs for 300 GSM Visiting Card
  const tiers = [
    { minQty: 1, maxQty: 200, label: '1–200 pcs', pricePerCard: 3.0, pack100: 300 },
    { minQty: 201, maxQty: 499, label: '201–499 pcs', pricePerCard: 2.0, pack100: 200 },
    { minQty: 500, maxQty: 1000, label: '500–1,000 pcs', pricePerCard: 1.5, pack100: 150 },
    { minQty: 1001, maxQty: 2000, label: '1,001–2,000 pcs', pricePerCard: 1.0, pack100: 100 },
  ];

  // Calculate unit price and totals based on active tier
  let activeTier = tiers[0];
  for (const t of tiers) {
    if (quantity >= t.minQty && quantity <= t.maxQty) {
      activeTier = t;
      break;
    }
  }

  const isQuoteRequired = quantity > 2000;
  const unitPricePerCard = activeTier.pricePerCard;
  // Strict formula: Total Price = Selected Quantity × Applicable Per-Piece Price
  const totalPrice = quantity * unitPricePerCard;
  const packsCount = Math.max(1, Math.round(quantity / 100));

  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');
  const hasArtworks = Boolean(design.frontDataUrl || design.backDataUrl);
  const activePreviewUrl = previewSide === 'front' ? design.frontDataUrl : design.backDataUrl;

  const whatsappUrl = `https://wa.me/${BUSINESS_CONFIG.contact.whatsappDigits}?text=${encodeURIComponent(
    `Hello TeqqnoWorld! I'd like a custom bulk quotation for *Premium 300 GSM Visiting Cards* (92 × 52 MM, Both Side Digital Print, White Base Paper).\nQuantity: ${quantity} pieces\nEstimated Price: ${isQuoteRequired ? 'Bulk Quote Needed' : `₹${totalPrice.toLocaleString('en-IN')}`}.\nPlease share quotation and printing details.`
  )}`;

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4 sm:p-6 md:p-7 shadow-xs space-y-5 sm:space-y-6">
      
      {/* 1. Header & Title */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#FF7A00] bg-[#FF7A00]/10 px-2.5 py-0.5 rounded-md">
            Visiting Cards &amp; Printing
          </span>
          <span className="text-[11px] font-mono font-bold text-zinc-900 bg-zinc-100 px-2.5 py-0.5 rounded-md border border-zinc-200">
            WHITE Paper ONLY
          </span>
          <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
            Both Side Printing
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight leading-snug">
          {getProductH1(product.id, product.name)}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 mt-1 leading-relaxed">
          Premium quality 300 GSM visiting cards printed on smooth art paper with vibrant digital printing, sharp text and professional finishing. Ideal for business owners, professionals, startups and corporate branding.
        </p>

        {/* Feature Highlights Badges with Checkmarks */}
        <div className="flex flex-wrap items-center gap-2 mt-3.5">
          {[
            '300 GSM Stiff Art Paper',
            'Both Side Full-Color Printing',
            '92 MM × 52 MM Standard Size',
            '300 DPI High-Definition Press',
            'Smooth Art Paper Finish',
            'WHITE Base Paper ONLY',
            'Customer Artwork Upload'
          ].map((badgeText, idx) => (
            <div 
              key={idx}
              className="inline-flex items-center gap-1.5 bg-zinc-50 border border-zinc-200/80 px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-700"
            >
              <Check className="w-3.5 h-3.5 text-[#FF7A00] stroke-[2.5]" />
              <span>{badgeText}</span>
            </div>
          ))}
        </div>

        {/* Rating & Social Proof */}
        <div className="flex flex-wrap items-center gap-3 text-xs mt-3.5 pt-2.5 border-t border-zinc-100">
          <div className="flex items-center gap-1 text-amber-500">
            <div className="flex items-center">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-current" />
              ))}
            </div>
            <span className="font-bold text-zinc-800 ml-1">{product.rating}</span>
            <span className="text-zinc-500">({product.reviewCount} Reviews)</span>
          </div>
          <span className="text-zinc-300">|</span>
          <span className="text-emerald-700 font-semibold font-mono text-[11px]">
            120,000+ Cards Printed
          </span>
          <span className="text-zinc-300">|</span>
          <span className="text-zinc-500 font-mono text-[11px]">
            18% ITC GST Tax Invoice Available
          </span>
        </div>
      </div>

      {/* 2. Dynamic Price Display */}
      <div className="bg-[#FAF9FD] rounded-xl p-4 sm:p-5 border border-[#ECEAF3] flex flex-wrap items-baseline justify-between gap-3">
        {isQuoteRequired ? (
          <div>
            <div className="font-display font-bold text-lg text-amber-800">Custom Bulk Quote Required</div>
            <p className="text-xs text-zinc-600">Quantity exceeds standard 2,000 cards slab.</p>
          </div>
        ) : (
          <div>
            <div className="text-xs text-zinc-500 font-medium">Estimated Order Total</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#0B0B0D] tabular-nums tracking-tight">
                ₹{totalPrice.toLocaleString('en-IN')}{Number.isInteger(totalPrice) ? '.00' : ''}
              </span>
            </div>
          </div>
        )}
        <div className="text-[11px] font-mono text-zinc-500 font-medium">
          ₹{unitPricePerCard.toFixed(2)} / card · ₹{(unitPricePerCard * 100).toFixed(0)} per 100 pcs
        </div>
      </div>

      {/* 3. Paper Base Colour Notice (White Only) */}
      <div className="space-y-2 pt-1 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
            Paper Base Colour
          </span>
          <span className="bg-zinc-900 text-white text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
            WHITE ONLY
          </span>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-300 bg-white ring-1 ring-zinc-200 shadow-xs">
          <div className="w-8 h-8 rounded-lg border-2 border-zinc-400 bg-white shadow-xs flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-[#FF7A00] stroke-[3]" />
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-900">Pure White 300 GSM Art Paper</div>
            <div className="text-[10px] text-zinc-500 font-mono">
              The card base is ALWAYS white paper. Any multi-color artwork or background you design will be digitally printed directly onto it.
            </div>
          </div>
        </div>
      </div>

      {/* 4. Pack Quantity Selector & Stepper */}
      <div className="space-y-4 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
            Quantity (Packs of 100)
          </span>
          <span className="bg-[#FF7A00] text-white text-[11px] font-mono font-bold px-2.5 py-0.5 rounded shadow-2xs">
            {quantity} Cards ({packsCount} {packsCount === 1 ? 'pack' : 'packs'})
          </span>
        </div>

        {/* Quantity Stepper with Quick Pack Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
          <div className="flex items-center gap-1.5 bg-white border border-zinc-300 rounded-lg p-1 shadow-2xs">
            <button
              onClick={() => setQuantity(Math.max(100, quantity - 100))}
              disabled={quantity <= 100}
              className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Decrease by 100 cards"
            >
              -
            </button>
            <input
              type="number"
              min={100}
              step={100}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 100;
                setQuantity(Math.max(100, Math.round(val / 100) * 100));
              }}
              className="w-16 text-center font-mono font-bold text-sm text-[#0B0B0D] focus:outline-hidden"
            />
            <button
              onClick={() => setQuantity(quantity + 100)}
              className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              title="Increase by 100 cards"
            >
              +
            </button>
          </div>

          <div className="text-right">
            <div className="font-display font-extrabold text-base text-[#0B0B0D] tabular-nums">
              ₹{unitPricePerCard.toFixed(2)} <span className="text-xs font-normal text-zinc-500">per card</span>
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              ₹{totalPrice.toLocaleString('en-IN')} total for {quantity} cards
            </div>
          </div>
        </div>

        {/* Tiered Bulk Pricing Quick Grid */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-zinc-700 flex items-center justify-between">
            <span>Per-Piece Pricing Slabs</span>
            <span className="text-zinc-500 font-mono text-[10px]">Min: 100 pcs · Max: 2,000 pcs</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
            {tiers.map((t) => {
              const isActive = quantity >= t.minQty && quantity <= t.maxQty;
              return (
                <div
                  key={t.label}
                  onClick={() => setQuantity(t.minQty === 1 ? 100 : t.minQty)}
                  className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                    isActive
                      ? 'border-[#FF7A00] bg-[#FF7A00]/10 ring-1 ring-[#FF7A00] font-bold text-[#0B0B0D]'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-600'
                  }`}
                >
                  <div className="font-mono text-[11px] font-bold">{t.label}</div>
                  <div className="font-bold text-[#FF7A00]">₹{t.pricePerCard.toFixed(2)}<span className="text-[9px] font-normal text-zinc-500">/pc</span></div>
                  <div className="text-[9px] text-zinc-400 font-mono">₹{t.pack100}/100</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Customization & Live Front/Back Card Preview Section */}
      <div className="space-y-3 pt-4 border-t border-zinc-100">
        <button
          type="button"
          onClick={onOpenEditor}
          className="w-full bg-[#FF7A00] hover:bg-[#ff881a] text-white p-3.5 rounded-xl shadow-md transition-all text-center cursor-pointer"
        >
          <div className="font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2">
            <Edit3 className="w-4 h-4" />
            <span>Edit your design</span>
          </div>
          <div className="text-[11px] text-white/90 font-medium mt-0.5">
            Upload front &amp; back 92 × 52 MM artwork · check safe area &amp; 3D view
          </div>
        </button>

        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 className={`w-4 h-4 shrink-0 ${hasArtworks ? 'text-emerald-600' : 'text-amber-500'}`} />
              <span>{hasArtworks ? 'Your design is ready' : 'Ready for your card artwork'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPreviewSide((s) => (s === 'front' ? 'back' : 'front'))}
                className="text-[11px] font-semibold text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-300 px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3 h-3 text-[#FF7A00]" />
                <span>{previewSide === 'front' ? 'View Back' : 'View Front'}</span>
              </button>
              <button
                type="button"
                onClick={onOpenEditor}
                className="text-[11px] font-bold text-white bg-zinc-900 hover:bg-black px-3 py-1 rounded-lg shadow-2xs cursor-pointer"
              >
                Edit design
              </button>
            </div>
          </div>

          <div
            onClick={onOpenEditor}
            className="bg-white rounded-lg border border-zinc-200 p-4 relative flex items-center justify-center overflow-hidden min-h-[156px] cursor-pointer hover:border-[#FF7A00]/60 transition-colors"
          >
            <div className="w-56 sm:w-64 aspect-[92/52] bg-white rounded-lg border border-zinc-300 shadow-sm relative flex items-center justify-center overflow-hidden">
              {activePreviewUrl ? (
                <img
                  src={activePreviewUrl}
                  alt={`Premium 300 GSM Visiting Card – ${previewSide === 'front' ? 'Front' : 'Back'} Side Design Preview`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center px-4 space-y-1">
                  <div className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
                    Your Logo / Design Here
                  </div>
                  <div className="text-[10px] font-mono text-zinc-400">
                    Tap to upload {previewSide} side (92 × 52 MM)
                  </div>
                </div>
              )}
              <div className="absolute top-1.5 right-1.5 flex items-center gap-1 bg-white/95 border border-zinc-300 shadow-sm rounded-full px-2 py-0.5 text-[9px] font-bold text-zinc-800">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
                <span>{previewSide === 'front' ? 'FRONT SIDE' : 'BACK SIDE'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-zinc-500 font-mono gap-1 pt-0.5">
            <div className="truncate">
              <span>Front: <strong>{design.frontDataUrl ? 'Ready' : 'Tap Edit'}</strong></span>
              <span className="mx-1.5 text-zinc-300">·</span>
              <span>Back: <strong>{design.backDataUrl ? 'Ready' : 'Tap Edit'}</strong></span>
            </div>
            <span className="font-bold text-zinc-800 shrink-0">{quantity} cards - ₹{totalPrice.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* 6. Main Action Buttons */}
      <div className="space-y-3 pt-2">
        <button
          ref={mainBuyButtonRef}
          onClick={onAddToCart}
          disabled={isAdding}
          className={`w-full py-4 px-6 rounded-xl font-display font-bold text-base flex items-center justify-center gap-2.5 shadow-md transition-all cursor-pointer ${
            addedSuccessToast
              ? 'bg-emerald-600 text-white'
              : 'bg-[#FF7A00] hover:bg-[#E66E00] text-white hover:shadow-lg active:scale-99'
          }`}
        >
          {addedSuccessToast ? (
            <>
              <Check className="w-5 h-5 stroke-[2.5]" />
              <span>Added to Cart!</span>
            </>
          ) : (
            <>
              <ShoppingCart className="w-5 h-5" />
              <span>Add to Cart · ₹{totalPrice.toLocaleString('en-IN')}</span>
            </>
          )}
        </button>

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 px-6 rounded-xl border border-zinc-300 hover:border-zinc-400 font-display font-semibold text-sm text-zinc-800 flex items-center justify-center gap-2 bg-white hover:bg-zinc-50 transition-all cursor-pointer"
        >
          <WhatsAppIcon variant="badge" className="w-4.5 h-4.5" />
          <span>Chat / Get WhatsApp Bulk Quote</span>
        </a>
      </div>

      {/* 7. Product Specifications Table */}
      <div className="space-y-2.5 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
            Technical Specifications
          </span>
          <span className="text-[10px] font-mono text-[#FF7A00] font-bold">
            Print-Ready Standards
          </span>
        </div>

        <div className="bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden divide-y divide-zinc-200 text-xs">
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Paper Quality</span>
            <span className="font-bold text-zinc-900">Premium Art Paper (Smooth Finish)</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Paper Thickness</span>
            <span className="font-bold text-zinc-900 font-mono">300 GSM Heavyweight</span>
          </div>
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Finished Size</span>
            <span className="font-bold text-zinc-900 font-mono">92 MM (W) × 52 MM (H)</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Size with Bleed</span>
            <span className="font-bold text-zinc-900 font-mono">98 MM × 58 MM (3 MM Bleed)</span>
          </div>
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Printing Type</span>
            <span className="font-bold text-emerald-700">Both Side Full-Color Digital Press</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Base Paper Colour</span>
            <span className="font-bold text-zinc-900 font-mono">WHITE ONLY (Pure White Card)</span>
          </div>
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Minimum Order (MOQ)</span>
            <span className="font-bold text-zinc-900 font-mono">100 Pieces (Pack of 100)</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Production Dispatch</span>
            <span className="font-bold text-emerald-700">24–48 Hours Fast Dispatch</span>
          </div>
        </div>
      </div>

      {/* 8. Trust Badges */}
      <div className="pt-2 border-t border-zinc-100">
        <ProductAssuranceCards product={product} compact={true} />
      </div>

    </div>
  );
};
