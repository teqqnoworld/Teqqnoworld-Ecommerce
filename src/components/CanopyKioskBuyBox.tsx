import React, { useRef } from 'react';
import { 
  Star, 
  Check, 
  ShoppingCart, 
  Sparkles,
  Edit3,
  Upload,
  CheckCircle2
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { Product, ProductColor, CustomArtwork } from '../types';
import { BUSINESS_CONFIG } from '../config/business';
import { ProductAssuranceCards } from './ProductAssuranceCards';
import { ProductMockupCanvas } from './ProductMockupCanvas';
import { compressImageFile } from '../utils/imageCompressor';
import { calculateProductPrice, formatCurrencyINR } from '../data/pricingRules';
import { getProductH1 } from '../config/seoRoutes';
import { ProductRatingBadge } from './reviews/ProductRatingBadge';

export interface CanopyKioskBuyBoxProps {
  product: Product;
  selectedSize: '4 × 4 ft' | '8 × 8 ft';
  onSelectSize: (size: '4 × 4 ft' | '8 × 8 ft') => void;
  totalPrice: number;
  totalMrp?: number;
  unitPrice: number;
  savingsPercent?: number;
  quantity: number;
  setQuantity: (qty: number) => void;
  nextTierUpsell?: {
    minQty: number;
    price: number;
    diff: number;
    savingsPerPiece: number;
  } | null;
  onAddToCart: () => void;
  isAdding: boolean;
  addedSuccessToast: boolean;
  mainBuyButtonRef: React.RefObject<HTMLButtonElement | null>;
  sizePricingMap?: Record<string, any>;
  onRequestQuote?: () => void;
  selectedColor?: ProductColor;
  frontArtwork?: CustomArtwork | null;
  frontPlacement?: string;
  onOpenCustomizer?: () => void;
  onUpdateArtwork?: (artwork: CustomArtwork | null) => void;
}

export const CanopyKioskBuyBox: React.FC<CanopyKioskBuyBoxProps> = ({
  product,
  selectedSize,
  onSelectSize,
  quantity,
  setQuantity,
  onAddToCart,
  isAdding,
  addedSuccessToast,
  mainBuyButtonRef,
  onRequestQuote,
  selectedColor,
  frontArtwork,
  frontPlacement = 'Top Valance Header',
  onOpenCustomizer,
  onUpdateArtwork,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeColor: ProductColor = selectedColor || product.colors[0] || {
    name: 'Navy Blue ONLY',
    hex: '#162B4D',
    garmentHex: '#162B4D',
  };

  // Centralized pricing calculation
  const pricingResult = calculateProductPrice('prod-canopy-kiosk', quantity, selectedSize);
  const { unitPrice, totalPrice, isQuoteRequired, activeSlab, nextTierUpsell, slabs } = pricingResult;

  const whatsappUrl = `https://wa.me/${BUSINESS_CONFIG.contact.whatsappDigits}?text=${encodeURIComponent(
    `Hello TeqqnoWorld! I would like a quote for *Promotional Canopy Kiosk* (Size: ${selectedSize}, Navy Blue ONLY, Height: 7 ft, Quantity: ${quantity} units).\nTotal: ${isQuoteRequired ? 'Bulk Quote Needed' : formatCurrencyINR(totalPrice)}.\nPlease share quotation and delivery timeline.`
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

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4 sm:p-6 md:p-7 shadow-xs space-y-5 sm:space-y-6">
      
      {/* 1. Header & Badges */}
      <div className="space-y-2 border-b border-zinc-100 pb-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="bg-[#FF7A00]/10 text-[#FF7A00] font-mono font-bold text-[11px] px-2.5 py-1 rounded-md">
              Outdoor Branding · 1 Unit MOQ
            </span>
            <span className="bg-emerald-50 text-emerald-700 font-mono text-[11px] px-2 py-0.5 rounded border border-emerald-200 font-semibold">
              Ready Stock
            </span>
          </div>

          <ProductRatingBadge productId={product.id} variant="pdp" />
        </div>

        <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-[#0B0B0D] tracking-tight">
          {getProductH1(product.id, product.name)}
        </h1>

        <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
          {product.description}
        </p>

        {/* Height Specifications Ribbon */}
        <div className="flex items-center gap-3 pt-1 text-xs text-zinc-600">
          <div className="flex items-center gap-1 font-mono font-bold text-zinc-800 bg-zinc-100 px-2.5 py-1 rounded-md">
            <span>Overall Height:</span>
            <span className="text-[#FF7A00]">7 ft (84 inches)</span>
          </div>
          <span className="text-zinc-400">·</span>
          <span className="font-mono text-zinc-500">Heavy-Duty Collapsible Metal Frame</span>
        </div>
      </div>

      {/* 2. Size Selection: 4 × 4 ft vs 8 × 8 ft */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[#0B0B0D] uppercase tracking-wide flex items-center gap-2">
            <span>Select Kiosk Size:</span>
            <span className="text-[#FF7A00] font-mono font-bold">{selectedSize}</span>
          </label>
          <span className="text-[11px] font-mono text-zinc-400">
            Height: 7 ft (84 in) for both sizes
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Card 1: 4 × 4 ft */}
          <div
            onClick={() => onSelectSize('4 × 4 ft')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative bg-white flex flex-col justify-between ${
              selectedSize === '4 × 4 ft'
                ? 'border-[#FF7A00] bg-[#FFF8F3] shadow-sm ring-2 ring-[#FF7A00]/20'
                : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display font-bold text-base text-[#0B0B0D] flex items-center gap-2">
                  <span>4 × 4 ft</span>
                  {selectedSize === '4 × 4 ft' && (
                    <span className="bg-[#FF7A00] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Check className="w-3 h-3 stroke-[3]" /> Selected
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-1 font-mono">
                  Width: 4 ft (48 in) · Depth: 4 ft (48 in)
                </div>
                <div className="text-[11px] text-zinc-600 mt-0.5 font-medium">
                  Height: 7 ft (84 in)
                </div>
              </div>

              <div className="text-right">
                <div className="font-display font-bold text-base text-[#0B0B0D]">
                  ₹5,100
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  1–2 pcs rate
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-zinc-200/80 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Compact Promotional Kiosk</span>
              <span className="text-emerald-700 font-mono font-bold">Standard Size</span>
            </div>
          </div>

          {/* Card 2: 8 × 8 ft */}
          <div
            onClick={() => onSelectSize('8 × 8 ft')}
            className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative bg-white flex flex-col justify-between ${
              selectedSize === '8 × 8 ft'
                ? 'border-[#FF7A00] bg-[#FFF8F3] shadow-sm ring-2 ring-[#FF7A00]/20'
                : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-display font-bold text-base text-[#0B0B0D] flex items-center gap-2">
                  <span>8 × 8 ft</span>
                  {selectedSize === '8 × 8 ft' && (
                    <span className="bg-[#FF7A00] text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Check className="w-3 h-3 stroke-[3]" /> Selected
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-1 font-mono">
                  Width: 8 ft (96 in) · Depth: 8 ft (96 in)
                </div>
                <div className="text-[11px] text-zinc-600 mt-0.5 font-medium">
                  Height: 7 ft (84 in)
                </div>
              </div>

              <div className="text-right">
                <div className="font-display font-bold text-base text-[#0B0B0D]">
                  ₹6,100
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">
                  1–2 pcs rate
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-zinc-200/80 flex items-center justify-between text-[11px]">
              <span className="text-zinc-500">Extra Large Pavilion</span>
              <span className="text-emerald-700 font-mono font-bold">+100% Display Area</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Colour Selection: Navy Blue ONLY */}
      <div className="space-y-3 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-[#0B0B0D] uppercase tracking-wide flex items-center gap-2">
            <span>Available Colour:</span>
            <span className="text-[#162B4D] font-mono font-bold">Navy Blue ONLY</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Single Colour Variant
          </span>
        </div>

        <div className="flex items-center gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-[#162B4D] border-2 border-white shadow-xs flex items-center justify-center ring-2 ring-[#162B4D]/30">
              <Check className="w-4 h-4 text-white stroke-[3]" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-zinc-900 flex items-center gap-2">
              <span>Navy Blue Canopy</span>
              <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                Factory Ready · In Stock
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-snug">
              High-density weather-resistant navy blue polyester fabric canopy with sturdy metal frame, reinforced seams, and stable base support.
            </p>
          </div>
        </div>
      </div>

      {/* 4. Pricing Slabs for Selected Size */}
      <div className="space-y-3 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-[#0B0B0D] uppercase tracking-wide">
            Volume Pricing Slabs ({selectedSize})
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Per-Piece Rate
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {slabs.map((slab) => {
            const isCurrentSlab = !isQuoteRequired && activeSlab?.label === slab.label;
            return (
              <div
                key={slab.label}
                onClick={() => setQuantity(slab.minQty)}
                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                  isCurrentSlab
                    ? 'border-[#FF7A00] bg-[#FFF8F3] shadow-xs ring-2 ring-[#FF7A00]/20'
                    : 'border-zinc-200 bg-white hover:border-zinc-300'
                }`}
              >
                <div className="text-[11px] font-mono text-zinc-500 font-medium">
                  {slab.label}
                </div>
                <div className="font-display font-bold text-sm sm:text-base text-[#0B0B0D] mt-0.5">
                  ₹{slab.pricePerUnit.toLocaleString('en-IN')}
                  <span className="text-[10px] text-zinc-500 font-normal">/pc</span>
                </div>
                <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                  Direct Rate
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Quantity Stepper & Quick Select */}
      <div className="space-y-3 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[#0B0B0D] uppercase tracking-wide">
            Order Quantity (Pieces)
          </label>
          <span className="text-[11px] font-mono text-zinc-500">
            Min: 1 pc · Max: 10 pcs
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Stepper */}
          <div className="flex items-center border border-zinc-300 rounded-xl bg-white shadow-2xs overflow-hidden h-12">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="w-12 h-full flex items-center justify-center text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-base font-bold"
              aria-label="Decrease quantity"
            >
              -
            </button>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1) {
                  setQuantity(val);
                }
              }}
              className="w-20 text-center font-display font-bold text-base text-[#0B0B0D] focus:outline-none"
            />
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-12 h-full flex items-center justify-center text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 transition-colors cursor-pointer text-base font-bold"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          {/* Quick Quantity Buttons */}
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
            {[1, 2, 3, 5, 10].map((quickQty) => (
              <button
                key={quickQty}
                onClick={() => setQuantity(quickQty)}
                className={`flex-1 min-w-[42px] py-2.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                  quantity === quickQty
                    ? 'border-[#FF7A00] bg-[#FF7A00] text-white shadow-xs'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100'
                }`}
              >
                {quickQty}
              </button>
            ))}
          </div>
        </div>

        {/* Next Tier Upsell Banner */}
        {nextTierUpsell && (
          <div className="bg-[#FFF8F3] border border-[#FFD4B8] rounded-xl p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF7A00] shrink-0" />
              <span className="text-zinc-700">
                Add <strong className="text-[#FF7A00] font-mono">{nextTierUpsell.diff} more</strong> to get{' '}
                <strong className="text-zinc-900 font-mono">₹{nextTierUpsell.price.toLocaleString('en-IN')}/pc</strong> rate!
              </span>
            </div>
            <button
              onClick={() => setQuantity(nextTierUpsell.minQty)}
              className="text-[#FF7A00] font-bold hover:underline shrink-0 text-[11px] cursor-pointer"
            >
              Select {nextTierUpsell.minQty} pcs
            </button>
          </div>
        )}
      </div>

      {/* 5B. Customization & Logo Upload Studio Section */}
      {onOpenCustomizer && (
        <div className="space-y-3 pt-4 border-t border-zinc-100">
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
              Customize canopy header &amp; lower wall · logo, text or shapes
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
              Our team will prepare canopy print proof for approval
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
                  productType="canopy"
                  color={activeColor}
                  artwork={frontArtwork}
                  printPlacement={frontPlacement}
                  selectedVariantLabel={selectedSize}
                  className="w-full h-36 sm:h-40 drop-shadow-xs"
                />
                <div className="absolute top-1 right-0 flex items-center gap-1 bg-white/95 border border-zinc-300 shadow-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-zinc-800">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                  <span>{selectedSize}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-zinc-500 font-mono gap-1 pt-0.5">
              <div className="truncate">
                <span>Placement: <strong>{frontArtwork ? frontPlacement : 'Top Valance Header'}</strong></span>
              </div>
              <span className="font-bold text-zinc-800 shrink-0">{quantity} pcs - {formatCurrencyINR(totalPrice)}</span>
            </div>
          </div>
        </div>
      )}

      {/* 6. Pricing Summary & Final Calculations */}
      <div className="bg-zinc-50 rounded-2xl p-4 sm:p-5 border border-zinc-200/90 space-y-3">
        {isQuoteRequired ? (
          <div className="space-y-1">
            <div className="text-xs text-amber-700 font-bold uppercase font-mono">High Quantity Custom Sourcing</div>
            <div className="font-display font-extrabold text-2xl text-[#0B0B0D]">
              Request a Custom Quote
            </div>
            <p className="text-xs text-zinc-600">
              Quantity exceeds standard 10 units slab. Contact our factory desk for wholesale bulk quotation and logistics support.
            </p>
          </div>
        ) : (
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div>
              <div className="text-xs text-zinc-500 font-medium">Order Total ({selectedSize})</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#0B0B0D] tabular-nums tracking-tight">
                  {formatCurrencyINR(totalPrice)}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-mono font-bold text-zinc-900 bg-zinc-200/70 px-2 py-0.5 rounded">
                ₹{unitPrice.toLocaleString('en-IN')} / pc
              </div>
              <div className="text-[11px] text-zinc-500 font-mono mt-1">
                {quantity} {quantity === 1 ? 'piece' : 'pieces'} × ₹{unitPrice.toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-200/80 font-mono">
          <span>Complete Canopy + Frame Kit</span>
          <span>GST 18% Extra on Invoice</span>
        </div>
      </div>

      {/* 7. Action Buttons (Add to Cart / Request a Quote & WhatsApp) */}
      <div className="space-y-3">
        {isQuoteRequired ? (
          onRequestQuote ? (
            <button
              type="button"
              onClick={onRequestQuote}
              className="w-full py-4 px-6 rounded-xl font-display font-extrabold text-base bg-[#FF7A00] hover:bg-[#e06c00] text-white transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <WhatsAppIcon className="w-5 h-5 text-white" />
              <span>Request a Quote for {quantity} Units</span>
            </button>
          ) : (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 px-6 rounded-xl font-display font-extrabold text-base bg-[#FF7A00] hover:bg-[#e06c00] text-white transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            >
              <WhatsAppIcon className="w-5 h-5 text-white" />
              <span>Request a Quote for {quantity} Units</span>
            </a>
          )
        ) : (
          <button
            ref={mainBuyButtonRef}
            onClick={onAddToCart}
            disabled={isAdding}
            className={`w-full py-4 px-5 sm:px-6 rounded-xl font-display font-extrabold text-sm sm:text-base transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
              addedSuccessToast
                ? 'bg-emerald-600 text-white'
                : 'bg-[#0B0B0D] hover:bg-black active:scale-99 text-white hover:shadow-xl'
            }`}
          >
            {addedSuccessToast ? (
              <>
                <Check className="w-5 h-5 text-white stroke-[3]" />
                <span>Added to Cart!</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-5 h-5 text-[#FF7A00]" />
                <span>Add {quantity} {selectedSize} {quantity === 1 ? 'Kiosk' : 'Kiosks'} to Cart</span>
                <span className="text-xs font-mono font-normal opacity-80">· {formatCurrencyINR(totalPrice)}</span>
              </>
            )}
          </button>
        )}

        {/* WhatsApp Instant Quote Link */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] border border-[#25D366]/40 font-display font-bold text-xs sm:text-sm py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <WhatsAppIcon variant="badge" className="w-4.5 h-4.5" />
          <span>Get Instant WhatsApp Quote (Factory Desk)</span>
        </a>
      </div>

      {/* 8. Assurance Pillars */}
      <div className="pt-2 border-t border-zinc-100">
        <ProductAssuranceCards product={product} compact={true} />
      </div>

    </div>
  );
};
