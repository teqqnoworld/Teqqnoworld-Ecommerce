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

interface RollupStandeeBuyBoxProps {
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

export const RollupStandeeBuyBox: React.FC<RollupStandeeBuyBoxProps> = ({
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
    name: 'Black ONLY',
    hex: '#111215',
    garmentHex: '#111215',
  };

  const tiers = [
    { minQty: 1, maxQty: 2, label: '1–2 pcs', price: 1799 },
    { minQty: 3, maxQty: 5, label: '3–5 pcs', price: 1599 },
    { minQty: 6, maxQty: 10, label: '6–10 pcs', price: 1499 },
    { minQty: 11, maxQty: 20, label: '11–20 pcs', price: 1399 },
  ];

  const whatsappUrl = `https://wa.me/${BUSINESS_CONFIG.contact.whatsappDigits}?text=${encodeURIComponent(
    `Hello TeqqnoWorld! I'd like a custom bulk quote for *Rollup Standee* (3 ft × 6 ft, Black ONLY).\nQuantity: ${quantity} units\nEstimated Price: ₹${totalPrice.toLocaleString('en-IN')}.\nPlease share quotation and printing details.`
  )}`;

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

  const isQuoteRequired = quantity > 20;

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4 sm:p-6 md:p-7 shadow-xs space-y-5 sm:space-y-6">
      
      {/* 1. Header & Title */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#FF7A00] bg-[#FF7A00]/10 px-2.5 py-0.5 rounded-md">
            Corporate Branding & Promotional Products
          </span>
          <span className="text-[11px] font-mono font-bold text-zinc-900 bg-zinc-100 px-2.5 py-0.5 rounded-md border border-zinc-200">
            Black ONLY
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight leading-snug">
          {getProductH1(product.id, product.name)}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 mt-1 leading-relaxed">
          Retractable Roll-up Banner Stand · 3 ft Width × 6 ft Height (36 × 72 inches) · Carry Bag Included
        </p>

        {/* Specification Badges with Checkmarks */}
        <div className="flex flex-wrap items-center gap-2 mt-3.5">
          {[
            '3 ft × 6 ft (36 × 72 inches)',
            'Premium Metal Stand',
            'High-Quality Flex Printing',
            'Easy Installation in 2 Mins',
            'Lightweight & Portable',
            'Carry Bag Included',
            'Black ONLY'
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
            480+ Units Delivered
          </span>
          <span className="text-zinc-300">|</span>
          <span className="text-zinc-500 font-mono text-[11px]">
            18% ITC GST Invoice Available
          </span>
        </div>
      </div>

      {/* 2. Dynamic Price Display */}
      <div className="bg-[#FAF9FD] rounded-xl p-4 sm:p-5 border border-[#ECEAF3] flex flex-wrap items-baseline justify-between gap-3">
        {isQuoteRequired ? (
          <div>
            <div className="font-display font-bold text-lg text-amber-800">Custom Bulk Quote Required</div>
            <p className="text-xs text-zinc-600">Quantity exceeds standard 20 pieces slab.</p>
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
          ₹{unitPrice.toLocaleString('en-IN')} / pc · GST 18% Extra on Invoice
        </div>
      </div>

      {/* 3. Product Overview / Description */}
      <div className="space-y-2 pt-1 border-t border-zinc-100">
        <div className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
          Product Overview
        </div>
        <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
          The Rollup Standee is a premier retractable roll-up display system crafted for maximum impact in retail spaces, trade shows, business events, and promotional exhibitions. Features high-resolution flex printing housed in a sturdy matte black metal stand with dual rotating feet. Effortless pull-up setup in under 2 minutes with zero tools needed, and packs away safely into the included travel-ready carry bag.
        </p>
      </div>

      {/* 4. Dimensions & Specifications */}
      <div className="space-y-2.5 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
            Technical Specifications
          </span>
          <span className="text-[10px] font-mono text-[#FF7A00] font-bold">
            Sturdy Metal Construction
          </span>
        </div>

        <div className="bg-zinc-50 rounded-xl border border-zinc-200 overflow-hidden divide-y divide-zinc-200 text-xs">
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Banner Dimensions</span>
            <span className="font-bold text-zinc-900 font-mono">3 ft Width × 6 ft Height (36 × 72 in)</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Product Colour</span>
            <span className="font-bold text-zinc-900 font-mono">Black ONLY</span>
          </div>
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Stand Material</span>
            <span className="font-bold text-zinc-900">Heavy-Duty Aluminum Metal Base & Telescopic Pole</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Banner Media</span>
            <span className="font-bold text-zinc-900">High-Quality Flexible Tear-Resistant Flex Media</span>
          </div>
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Print Resolution</span>
            <span className="font-bold text-emerald-700">Vivid & High-Definition UV / Screen Printing</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Mechanism</span>
            <span className="font-bold text-zinc-900">Spring-loaded retractable roller with locking top rail</span>
          </div>
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Stabilizer Base</span>
            <span className="font-bold text-zinc-900">Dual heavy-duty rotating stabilizing feet</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Assembly Time</span>
            <span className="font-bold text-emerald-700">Tool-Free Setup in under 2 minutes</span>
          </div>
          <div className="grid grid-cols-2 p-2.5 bg-white">
            <span className="text-zinc-500 font-medium">Carry Case</span>
            <span className="font-bold text-zinc-900">Padded zippered Oxford nylon bag included</span>
          </div>
          <div className="grid grid-cols-2 p-2.5">
            <span className="text-zinc-500 font-medium">Minimum Order</span>
            <span className="font-bold text-zinc-900 font-mono">1 Piece (MOQ = 1)</span>
          </div>
        </div>
      </div>

      {/* 5. Colour & Size Selection */}
      <div className="space-y-4 pt-2 border-t border-zinc-100">
        {/* Colour */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
              Available Colour
            </span>
            <span className="bg-zinc-900 text-white text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
              Black ONLY
            </span>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl border border-[#FF7A00] bg-[#FF7A00]/5 ring-2 ring-[#FF7A00]/25 shadow-xs">
            <div className="w-8 h-8 rounded-lg border border-black/30 bg-[#111215] shadow-inner flex items-center justify-center shrink-0">
              <Check className="w-4 h-4 text-white stroke-[3]" />
            </div>
            <div>
              <div className="text-xs font-bold text-zinc-900">Anodized Black Finish</div>
              <div className="text-[10px] text-zinc-500 font-mono">Matte Black Aluminium Stand & Cassette (Single Variant · Black ONLY)</div>
            </div>
          </div>
        </div>

        {/* Size Badge */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
              Standee Size
            </span>
            <span className="text-[11px] font-mono text-zinc-500 font-medium">
              Standard Exhibition Dimension
            </span>
          </div>

          <div className="p-3 rounded-xl border border-zinc-200 bg-zinc-50 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-zinc-900">3 ft × 6 ft</div>
              <div className="text-[10px] text-zinc-500 font-mono">36 inches (Width) × 72 inches (Height)</div>
            </div>
            <span className="text-[10px] font-mono font-bold text-[#FF7A00] bg-[#FF7A00]/10 px-2 py-0.5 rounded border border-[#FF7A00]/20">
              Included
            </span>
          </div>
        </div>
      </div>

      {/* 6. Quantity Selector & Stepper */}
      <div className="space-y-4 pt-4 border-t border-[#E5E5EA]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
            Quantity
          </span>
          <span className="bg-[#FF7A00] text-white text-[11px] font-mono font-bold px-2.5 py-0.5 rounded shadow-2xs">
            {quantity} {quantity === 1 ? 'piece' : 'pieces'}
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
              ₹{unitPrice} <span className="text-xs font-normal text-zinc-500">per piece</span>
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              ₹{totalPrice.toLocaleString('en-IN')} total
            </div>
          </div>
        </div>

        {/* Tiered Volume Pricing Table */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold text-zinc-700 flex items-center justify-between">
            <span>Tiered Bulk Pricing Slabs</span>
            <span className="text-zinc-500 font-mono text-[10px]">Min: 1 pc · Max: 20 pcs</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center">
            {tiers.map((t) => {
              const isActive = quantity >= t.minQty && quantity <= t.maxQty;
              return (
                <div
                  key={t.label}
                  onClick={() => setQuantity(t.minQty)}
                  className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                    isActive
                      ? 'border-[#FF7A00] bg-[#FF7A00]/10 ring-1 ring-[#FF7A00] font-bold text-[#0B0B0D]'
                      : 'border-zinc-200 bg-white hover:border-zinc-300 text-zinc-600'
                  }`}
                >
                  <div className="font-mono text-[11px] font-bold">{t.label}</div>
                  <div className="font-bold text-[#FF7A00]">₹{t.price.toLocaleString('en-IN')}</div>
                  <div className="text-[9px] text-zinc-400 font-mono">/pc</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Next Tier Upsell Badge */}
        {nextTierUpsell && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-amber-800">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Add <strong>{nextTierUpsell.diff} more</strong> to unlock <strong>₹{nextTierUpsell.price.toLocaleString('en-IN')}/pc</strong>!
              </span>
            </div>
            <button
              onClick={() => setQuantity(nextTierUpsell.minQty)}
              className="text-[11px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-200 px-2.5 py-1 rounded-md transition-colors shrink-0 cursor-pointer"
            >
              Select {nextTierUpsell.minQty} pcs
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
              Customize your 3 × 6 ft banner · logo, headline or contact info
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
              Our team will prepare standee flex layout &amp; share proof for approval
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
                  productType="standee"
                  color={activeColor}
                  artwork={frontArtwork}
                  printPlacement={frontPlacement}
                  className="w-full h-36 sm:h-40 drop-shadow-xs"
                />
                <div className="absolute top-1 right-0 flex items-center gap-1 bg-white/95 border border-zinc-300 shadow-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-zinc-800">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <span>3 × 6 FT BANNER</span>
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

      {/* 7. Action Buttons */}
      <div className="space-y-3 pt-2">
        {isQuoteRequired ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 px-6 rounded-xl font-display font-bold text-base flex items-center justify-center gap-2.5 shadow-md bg-[#FF7A00] hover:bg-[#E66E00] text-white cursor-pointer"
          >
            <WhatsAppIcon className="w-5 h-5 text-white" />
            <span>Request a Custom Bulk Quote ({quantity} pcs)</span>
          </a>
        ) : (
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
        )}

        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 px-6 rounded-xl border border-zinc-300 hover:border-zinc-400 font-display font-semibold text-sm text-zinc-800 flex items-center justify-center gap-2 bg-white hover:bg-zinc-50 transition-all cursor-pointer"
        >
          <WhatsAppIcon variant="badge" className="w-4.5 h-4.5" />
          <span>Chat / Get WhatsApp Quote</span>
        </a>
      </div>

      {/* 8. Assurance Trust Badges */}
      <div className="pt-2 border-t border-zinc-100">
        <ProductAssuranceCards product={product} compact={true} />
      </div>

    </div>
  );
};
