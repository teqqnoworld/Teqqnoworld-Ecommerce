import React, { useRef } from 'react';
import { Star, Check, ShoppingCart, Sparkles, Edit3, Upload, CheckCircle2 } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { Product, ProductColor, CustomArtwork } from '../types';
import { ProductAssuranceCards } from './ProductAssuranceCards';
import { ProductMockupCanvas } from './ProductMockupCanvas';
import { compressImageFile } from '../utils/imageCompressor';
import { BUSINESS_CONFIG } from '../config/business';
import { getProductH1 } from '../config/seoRoutes';
import { ProductRatingBadge } from './reviews/ProductRatingBadge';

interface PromoTableBuyBoxProps {
  product: Product;
  totalPrice: number;
  totalMrp: number;
  unitPrice: number;
  savingsPercent: number;
  quantity: number;
  setQuantity: (qty: number) => void;
  nextTierUpsell: {
    minQty: number;
    price: number;
    diff: number;
    savingsPerPiece: number;
  } | null;
  onAddToCart: () => void;
  isAdding: boolean;
  addedSuccessToast: boolean;
  mainBuyButtonRef: React.RefObject<HTMLButtonElement | null>;
  selectedColor?: ProductColor;
  frontArtwork?: CustomArtwork | null;
  frontPlacement?: string;
  onOpenCustomizer?: () => void;
  onUpdateArtwork?: (artwork: CustomArtwork | null) => void;
}

export const PromoTableBuyBox: React.FC<PromoTableBuyBoxProps> = ({
  product,
  totalPrice,
  totalMrp,
  unitPrice,
  savingsPercent,
  quantity,
  setQuantity,
  nextTierUpsell,
  onAddToCart,
  isAdding,
  addedSuccessToast,
  mainBuyButtonRef,
  selectedColor,
  frontArtwork,
  frontPlacement = 'Top Header',
  onOpenCustomizer,
  onUpdateArtwork,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeColor: ProductColor = selectedColor || product.colors[0] || {
    name: 'White ONLY',
    hex: '#FFFFFF',
    garmentHex: '#FFFFFF',
  };

  const handleQuickLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onUpdateArtwork) return;
    try {
      const { dataUrl } = await compressImageFile(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.9,
        format: 'image/png',
      });
      onUpdateArtwork({
        type: 'image',
        dataUrl,
        rawDataUrl: dataUrl,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
      });
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const url = ev.target.result as string;
          onUpdateArtwork({
            type: 'image',
            dataUrl: url,
            rawDataUrl: url,
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4 sm:p-6 md:p-7 shadow-xs space-y-5 sm:space-y-6">
      
      {/* 1. Header & Title */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#FF7A00] bg-[#FF7A00]/10 px-2.5 py-0.5 rounded-md">
            Promotional Display & Marketing Products
          </span>
          <span className="text-[11px] font-mono font-bold text-zinc-700 bg-zinc-100 px-2.5 py-0.5 rounded-md border border-zinc-200">
            White ONLY
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight leading-snug">
          {getProductH1(product.id, product.name)}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 mt-1 leading-relaxed">
          Portable Promotional Display Counter with Overhead Branding Panel
        </p>

        {/* Specification Badges with Checkmarks */}
        <div className="flex flex-wrap items-center gap-2 mt-3.5">
          {[
            'Portable Promotional Counter',
            'Overhead Header (31" × 10.3")',
            'Two-Tier Storage Shelves',
            'Tool-Free Quick Setup',
            'White ONLY'
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

        {/* Rating & Orders Social Proof */}
        <div className="flex flex-wrap items-center gap-3 text-xs mt-3.5 pt-2.5 border-t border-zinc-100">
          <ProductRatingBadge productId={product.id} variant="pdp" />
          <span className="text-zinc-300">|</span>
          <span className="text-emerald-700 font-semibold font-mono text-[11px]">
            320+ Units Delivered
          </span>
          <span className="text-zinc-300">|</span>
          <span className="text-zinc-500 font-mono text-[11px]">
            18% ITC GST Invoice
          </span>
        </div>
      </div>

      {/* 2. Dynamic Price Display */}
      <div className="bg-[#FAF9FD] rounded-xl p-4 sm:p-5 border border-[#ECEAF3] flex flex-wrap items-baseline justify-between gap-3">
        {quantity > 10 ? (
          <div>
            <div className="font-display font-bold text-lg text-amber-800">Custom Bulk Quote Required</div>
            <p className="text-xs text-zinc-600">Quantity exceeds standard 10 units slab.</p>
          </div>
        ) : (
          <div>
            <div className="text-xs text-zinc-500 font-medium">Estimated Order Total</div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#0B0B0D] tabular-nums tracking-tight">
                ₹{totalPrice.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        )}
        <div className="text-[11px] font-mono text-zinc-500 font-medium">
          ₹{unitPrice.toLocaleString('en-IN')}/unit · GST 18% Extra on Invoice
        </div>
      </div>

      {/* 3. Product Overview / Description */}
      <div className="space-y-2 pt-1 border-t border-zinc-100">
        <div className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
          Product Overview
        </div>
        <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
          Premium Portable Promo Table designed for exhibitions, promotional campaigns, product demonstrations, retail promotions and trade shows. Features a lightweight yet sturdy structure, spacious counter storage and an overhead branding display panel. Easy to assemble, portable and suitable for professional promotional activities.
        </p>
      </div>

      {/* 4. Dimensions & Technical Specifications Table */}
      <div className="space-y-2.5 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
            Dimensions & Technical Specifications
          </span>
          <span className="text-[10px] font-mono text-[#FF7A00] font-bold">
            Heavy-Duty PP Plastic & Steel
          </span>
        </div>

        <div className="bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden divide-y divide-zinc-200 text-xs">
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Overall Height</span>
            <span className="font-bold text-zinc-900 font-mono">63.2 inches</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Counter Height</span>
            <span className="font-bold text-zinc-900 font-mono">30.3 inches</span>
          </div>
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Counter Width</span>
            <span className="font-bold text-zinc-900 font-mono">31.6 inches</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Top Header Panel</span>
            <span className="font-bold text-zinc-900 font-mono">31 in (W) × 10.3 in (H)</span>
          </div>
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Internal Storage</span>
            <span className="font-bold text-zinc-900">Two-tier storage shelving, foldable counter body</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Material</span>
            <span className="font-bold text-zinc-900">Heavy-Duty PP Plastic & Twin Steel Support Rods</span>
          </div>
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Assembly</span>
            <span className="font-bold text-emerald-700">Tool-free quick setup in 3 minutes</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Carrying Case</span>
            <span className="font-bold text-zinc-900">Heavy-duty nylon carry bag included</span>
          </div>
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Product Colour</span>
            <span className="font-bold text-zinc-900">White ONLY</span>
          </div>
        </div>
      </div>

      {/* 5. Colour Selection (White ONLY) */}
      <div className="space-y-2.5 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
            Available Colour
          </span>
          <span className="bg-zinc-900 text-white text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
            White ONLY
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-[#FF7A00] bg-[#FF7A00]/5 ring-2 ring-[#FF7A00]/25 shadow-xs w-full">
            <div className="w-8 h-8 rounded-lg border border-zinc-300 bg-white shadow-inner flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-zinc-900 stroke-[3]" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900">Standard Exhibition White</div>
              <div className="text-[10px] text-zinc-500 font-mono">Factory Matte White Finish (Single Variant · White ONLY)</div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Quantity Selector & Bulk Tier Pricing */}
      <div className="space-y-4 pt-4 border-t border-[#E5E5EA]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
            Quantity
          </span>
          <span className="bg-[#FF7A00] text-white text-[11px] font-mono font-bold px-2.5 py-0.5 rounded shadow-2xs">
            {quantity} {quantity === 1 ? 'unit' : 'units'}
          </span>
        </div>

        {/* Stepper with unit price & total */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
          <div className="flex items-center gap-1.5 bg-white border border-zinc-300 rounded-lg p-1 shadow-2xs">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Decrease quantity"
            >
              -
            </button>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 text-center font-mono font-bold text-sm text-[#0B0B0D] focus:outline-hidden"
            />
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
              title="Increase quantity"
            >
              +
            </button>
          </div>

          <div className="text-right">
            <div className="font-display font-extrabold text-base text-[#0B0B0D] tabular-nums">
              ₹{unitPrice} <span className="text-xs font-normal text-zinc-500">per unit</span>
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              ₹{totalPrice.toLocaleString('en-IN')} total
            </div>
          </div>
        </div>

        {/* QUANTITY-WISE PRICE LIST */}
        <div className="space-y-2">
          <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
            QUANTITY-WISE PRICE LIST (MOQ: 1 unit · Max: 10 units)
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {[
              { range: '1–2 pcs', min: 1, max: 2, price: 3500 },
              { range: '3–5 pcs', min: 3, max: 5, price: 3300 },
              { range: '6–10 pcs', min: 6, max: 10, price: 3100 },
            ].map((tier) => {
              const isActive = quantity >= tier.min && quantity <= tier.max;
              return (
                <button
                  key={tier.range}
                  onClick={() => setQuantity(tier.min)}
                  className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${
                    isActive
                      ? 'border-[#FF7A00] bg-[#FF7A00]/5 ring-1 ring-[#FF7A00]/40 shadow-xs'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="text-[10px] font-mono font-bold text-zinc-500">{tier.range}</div>
                  <div className="font-display font-bold text-sm text-[#0B0B0D] mt-0.5">₹{tier.price.toLocaleString('en-IN')}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">/unit</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Upsell helper callout */}
        {nextTierUpsell && (
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-emerald-900">
            <div className="leading-snug">
              Add <strong className="font-bold text-emerald-950">{nextTierUpsell.diff} more</strong> unit → pay <strong className="font-bold">₹{nextTierUpsell.price.toLocaleString('en-IN')}/unit</strong>!
            </div>
            <button
              onClick={() => setQuantity(nextTierUpsell.minQty)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-2xs whitespace-nowrap transition-colors cursor-pointer"
            >
              Make it {nextTierUpsell.minQty}
            </button>
          </div>
        )}
      </div>

      {/* 6B. Customization & Logo Upload Studio Section */}
      {onOpenCustomizer && (
        <div className="space-y-3 pt-4 border-t border-[#E5E5EA]">
          <button
            type="button"
            onClick={onOpenCustomizer}
            className="w-full bg-[#FF7A00] hover:bg-[#ff881a] text-white p-3.5 rounded-xl shadow-md transition-all text-center cursor-pointer"
          >
            <div className="font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2">
              <Edit3 className="w-4 h-4" />
              <span>Edit your design</span>
            </div>
            <div className="text-[11px] text-white/90 font-medium mt-0.5">
              Customize header panel &amp; counter front · logo, text or shapes
            </div>
          </button>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 p-3 rounded-xl cursor-pointer text-center transition-all shadow-2xs"
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleQuickLogoUpload}
              accept=".png,.jpg,.jpeg,.svg,.webp"
              className="hidden"
            />
            <div className="text-xs font-bold text-zinc-900 flex items-center justify-center gap-1.5">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>Just Upload Your Logo</span>
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              Our team will prepare counter vinyl proof for approval
            </div>
          </div>

          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Your design is ready</span>
              </div>
              <button
                type="button"
                onClick={onOpenCustomizer}
                className="text-[11px] font-bold text-white bg-zinc-900 hover:bg-black px-3 py-1 rounded-lg shadow-2xs cursor-pointer"
              >
                Edit design
              </button>
            </div>

            <div className="bg-white rounded-lg border border-zinc-200 p-3 sm:p-4 relative flex items-center justify-center overflow-hidden min-h-[168px]">
              <div className="w-40 sm:w-48 relative">
                <ProductMockupCanvas
                  productType="display"
                  color={activeColor}
                  artwork={frontArtwork}
                  printPlacement={frontPlacement}
                  className="w-full h-36 sm:h-40 drop-shadow-xs"
                />
                <div className="absolute top-1 right-0 flex items-center gap-1 bg-white/95 border border-zinc-300 shadow-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-zinc-800">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <span>HEADER &amp; COUNTER</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-zinc-500 font-mono gap-1 pt-0.5">
              <div className="truncate">
                <span>Placement: <strong>{frontArtwork ? frontPlacement : 'Top Header'}</strong></span>
              </div>
              <span className="font-bold text-zinc-800 shrink-0">{quantity} pcs - ₹{totalPrice.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* 7. Purchase Buttons: ADD TO CART & WhatsApp Quote */}
      <div className="space-y-3 pt-2 border-t border-[#E5E5EA]">
        {quantity > 10 ? (
          <a
            href={`https://wa.me/${BUSINESS_CONFIG.contact.whatsappDigits}?text=${encodeURIComponent(`Hi TeqqnoWorld, I want a custom quote for Promo Table (Quantity: ${quantity} units). Please share pricing and delivery schedule.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-[#FF7A00] hover:bg-[#e06c00] text-white font-display font-extrabold text-sm sm:text-base py-4 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <WhatsAppIcon className="w-5 h-5 text-white" />
            <span>Request a Custom Bulk Quote ({quantity} units)</span>
          </a>
        ) : (
          <button
            ref={mainBuyButtonRef}
            onClick={onAddToCart}
            disabled={isAdding}
            className="w-full bg-[#0B0B0D] hover:bg-black text-white font-display font-extrabold text-sm sm:text-base py-4 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-101 active:scale-99 group cursor-pointer"
          >
            <ShoppingCart className="w-5 h-5 group-hover:-rotate-12 group-hover:scale-115 transition-transform duration-300" />
            <span>{isAdding ? 'Adding to Cart...' : `ADD ${quantity} ${quantity === 1 ? 'UNIT' : 'UNITS'} TO CART · ₹${totalPrice.toLocaleString('en-IN')}`}</span>
          </button>
        )}

        <a
          href={`https://wa.me/${BUSINESS_CONFIG.contact.whatsappDigits}?text=${encodeURIComponent(`Hi TeqqnoWorld, I want a quote for Promo Table (Quantity: ${quantity} units). Please share pricing and delivery schedule.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-display font-bold text-sm py-3.5 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <WhatsAppIcon className="w-4.5 h-4.5 text-white" />
          <span>Get Instant WhatsApp Quote</span>
        </a>

        {addedSuccessToast && (
          <div className="text-center text-xs font-semibold text-emerald-700 mt-2 flex items-center justify-center gap-1 animate-icon-pulse-glow">
            <Check className="w-4 h-4 text-emerald-600 stroke-[3]" />
            <span>Promo Table added to your cart! Reviewing in drawer...</span>
          </div>
        )}
      </div>

      {/* 8. Reassurance Trust Badges */}
      <div className="pt-2 border-t border-zinc-100">
        <ProductAssuranceCards product={product} compact={true} />
      </div>

    </div>
  );
};
