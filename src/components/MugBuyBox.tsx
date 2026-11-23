import React, { useState, useRef } from 'react';
import { 
  Star, 
  Check, 
  ShoppingCart, 
  Sparkles, 
  Upload, 
  Trash2, 
  Edit3,
  Eye,
  CheckCircle2,
  Move
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { Product, ProductColor, CustomArtwork } from '../types';
import { BUSINESS_CONFIG } from '../config/business';
import { ProductAssuranceCards } from './ProductAssuranceCards';
import { ProductMockupCanvas } from './ProductMockupCanvas';
import { compressImageFile } from '../utils/imageCompressor';
import { getProductH1 } from '../config/seoRoutes';

interface MugBuyBoxProps {
  product: Product;
  selectedColor: ProductColor;
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
  frontArtwork?: CustomArtwork | null;
  backArtwork?: CustomArtwork | null;
  frontPlacement?: string;
  backPlacement?: string;
  onUpdateArtwork?: (artwork: CustomArtwork | null) => void;
  onOpenCustomizer?: (side?: 'front' | 'back') => void;
}

export const MugBuyBox: React.FC<MugBuyBoxProps> = ({
  product,
  selectedColor,
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
  frontArtwork,
  backArtwork,
  frontPlacement = 'Front Center',
  backPlacement = 'Back Center',
  onUpdateArtwork,
  onOpenCustomizer,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [previewSide, setPreviewSide] = useState<'front' | 'back'>('front');

  // Preset logo options
  const presetLogos = [
    { id: 'priya', name: 'Priya Cement', logoUrl: '/assets/aistudio/Priya_Cement_Lion_Emblem-removebg-preview_082e32cf.webp' },
    { id: 'vasavi', name: 'Vasavi Group', logoUrl: '/assets/aistudio/Vasavi_Group_Circular_Badge_Logo-removebg-preview_823cc81a.webp' },
    { id: 'your-logo', name: 'Your Logo Here', text: 'YOUR LOGO HERE' },
    { id: 'corporate', name: 'Corporate Gift', text: 'OFFICE TECH' },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateArtwork) {
      try {
        const { dataUrl } = await compressImageFile(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.8,
          format: 'image/webp',
        });
        onUpdateArtwork({
          type: 'image',
          dataUrl,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0,
        });
        setActivePreset(null);
      } catch (err) {
        console.warn('[MugBuyBox] Compression fallback to FileReader:', err);
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            onUpdateArtwork({
              type: 'image',
              dataUrl: event.target.result as string,
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0,
            });
            setActivePreset(null);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleSelectPreset = (preset: typeof presetLogos[0]) => {
    if (!onUpdateArtwork) return;
    setActivePreset(preset.id);
    if (preset.logoUrl) {
      onUpdateArtwork({
        type: 'image',
        dataUrl: preset.logoUrl,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
      });
    } else {
      onUpdateArtwork({
        type: 'preset',
        presetId: preset.id,
        text: preset.text,
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
      });
    }
  };

  const handleRemoveArtwork = () => {
    if (onUpdateArtwork) {
      onUpdateArtwork(null);
    }
    setActivePreset(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleScaleChange = (newScale: number) => {
    if (frontArtwork && onUpdateArtwork) {
      onUpdateArtwork({
        ...frontArtwork,
        scale: newScale,
      });
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4 sm:p-6 md:p-7 shadow-xs space-y-5 sm:space-y-6">
      
      {/* 1. Header & Category Pill */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-[#FF7A00] bg-[#FF7A00]/10 px-2.5 py-0.5 rounded-md">
            Corporate Gifts & Promotional Products
          </span>
          <span className="text-[11px] font-mono font-bold text-zinc-700 bg-zinc-100 px-2.5 py-0.5 rounded-md border border-zinc-200 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-white border border-zinc-300" />
            White ONLY
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight leading-snug">
          {getProductH1(product.id, product.name)}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-600 mt-1 leading-relaxed">
          Custom Printed Ceramic Coffee Mug · ~325 ml (11 oz) · 8.5" × 3" Printable Area
        </p>

        {/* Specification Badges with Checkmarks */}
        <div className="flex flex-wrap items-center gap-2 mt-3.5">
          {[
            'Premium Glossy Ceramic',
            'Capacity: ~325 ml (11 oz)',
            'Print Area: 8.5" × 3"',
            'Microwave & Dishwasher Safe',
            'Comfortable Grip Handle',
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
            1,450+ Mugs Delivered
          </span>
          <span className="text-zinc-300">|</span>
          <span className="text-zinc-500 font-mono text-[11px]">
            18% ITC GST Invoice
          </span>
        </div>
      </div>

      {/* 2. Color Selection: White Ceramic ONLY */}
      <div className="space-y-3 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-[#0B0B0D] uppercase tracking-wide flex items-center gap-2">
            <span>Available Colour:</span>
            <span className="text-[#FF7A00] font-mono font-bold">White ONLY</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Single Colour Variant
          </span>
        </div>

        <div className="flex items-center gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-white border-2 border-[#FF7A00] shadow-sm flex items-center justify-center ring-4 ring-[#FF7A00]/15">
              <Check className="w-4 h-4 text-[#FF7A00] stroke-[3]" />
            </div>
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-zinc-900 flex items-center gap-2">
              <span>Pure White Ceramic</span>
              <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">
                In Stock · Ready for Print
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              High-gloss white ceramic body engineered for ultra-vibrant sublimation and UV logo printing.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Studio Edit Section, Logo Upload & Live Mug Preview */}
      <div className="space-y-3 pt-4 border-t border-zinc-100">
        {onOpenCustomizer && (
          <button
            type="button"
            onClick={() => onOpenCustomizer(previewSide)}
            className="w-full bg-[#FF7A00] hover:bg-[#ff881a] text-white p-3.5 rounded-xl shadow-md transition-all text-center cursor-pointer"
          >
            <div className="font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2">
              <Edit3 className="w-4 h-4" />
              <span>Edit your design</span>
            </div>
            <div className="text-[11px] text-white/90 font-medium mt-0.5">
              Customize front &amp; back wrap (8.5&quot; × 3&quot;) · logo, size or text
            </div>
          </button>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          id="mug-logo-file-input"
        />

        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 p-3 rounded-xl cursor-pointer text-center transition-all shadow-2xs"
        >
          <div className="text-xs font-bold text-zinc-900 flex items-center justify-center gap-1.5">
            <Upload className="w-4 h-4 text-blue-600" />
            <span>{frontArtwork?.dataUrl ? 'Replace Uploaded Logo' : 'Just Upload Your Logo'}</span>
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            Our team will design &amp; share wrap-around mug proof for approval
          </div>
        </div>

        {/* Live Interactive "Your design is ready" Preview Card */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Your design is ready</span>
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
              {onOpenCustomizer && (
                <button
                  type="button"
                  onClick={() => onOpenCustomizer(previewSide)}
                  className="text-[11px] font-bold text-white bg-zinc-900 hover:bg-black px-3 py-1 rounded-lg shadow-2xs cursor-pointer"
                >
                  Edit design
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-zinc-200 p-3 sm:p-4 relative flex items-center justify-center overflow-hidden min-h-[168px]">
            <div className="w-40 sm:w-48 relative">
              <ProductMockupCanvas
                productType="mug"
                color={selectedColor}
                artwork={previewSide === 'back' ? backArtwork : frontArtwork}
                printPlacement={previewSide === 'back' ? backPlacement : frontPlacement}
                view={previewSide}
                className="w-full h-36 sm:h-40 drop-shadow-xs"
              />
              <div className="absolute top-1 right-0 flex items-center gap-1 bg-white/95 border border-zinc-300 shadow-sm rounded-full px-2 py-0.5 text-[10px] font-bold text-zinc-800">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span>{previewSide === 'front' ? 'FRONT MUG' : 'BACK MUG'}</span>
              </div>
            </div>
          </div>

          {/* Quick Preset Sample Logos & Size Control */}
          <div className="space-y-2 pt-1">
            <div className="text-[11px] text-zinc-500 font-medium flex items-center justify-between">
              <span>Quick sample logos:</span>
              <span className="text-[10px] text-zinc-400 font-mono">8.5&quot; × 3&quot; Print Zone</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {presetLogos.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`text-[11px] font-medium py-1.5 px-2 rounded-lg border text-center transition-all truncate cursor-pointer ${
                    activePreset === preset.id
                      ? 'bg-[#FF7A00] text-white border-[#FF7A00] shadow-xs font-bold'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:border-[#FF7A00]/50'
                  }`}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {frontArtwork && (
            <div className="bg-white rounded-xl p-2.5 border border-zinc-200 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-800 flex items-center gap-1.5">
                  <Move className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Logo Size ({Math.round((frontArtwork.scale || 1) * 100)}%)</span>
                </span>
                <button
                  type="button"
                  onClick={handleRemoveArtwork}
                  className="text-red-600 hover:text-red-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.8"
                step="0.05"
                value={frontArtwork.scale || 1}
                onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
                className="w-full accent-[#FF7A00] cursor-pointer h-1.5 bg-zinc-200 rounded-lg"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-zinc-500 font-mono gap-1 pt-0.5">
            <div className="truncate">
              <span>Front: <strong>{frontArtwork ? frontPlacement : 'None'}</strong></span>
              <span className="mx-1.5 text-zinc-300">·</span>
              <span>Back: <strong>{backArtwork ? backPlacement : 'None'}</strong></span>
            </div>
            <span className="font-bold text-zinc-800 shrink-0">{quantity} pcs - ₹{totalPrice.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* 4. Pricing Slabs Matrix */}
      <div className="space-y-3 pt-2 border-t border-zinc-100">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-[#0B0B0D] uppercase tracking-wide">
            Volume Pricing Slabs
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            Per-Piece Rate · MOQ 5 pcs
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: '5 pcs', minQty: 5, maxQty: 5, price: 249 },
            { label: '6–10 pcs', minQty: 6, maxQty: 10, price: 230 },
            { label: '11–25 pcs', minQty: 11, maxQty: 25, price: 199 },
            { label: '26–50 pcs', minQty: 26, maxQty: 50, price: 175 },
            { label: '51–100 pcs', minQty: 51, maxQty: 100, price: 149 },
          ].map((slab) => {
            const isCurrentSlab = quantity >= slab.minQty && quantity <= slab.maxQty;

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
                <div className="font-display font-bold text-sm text-[#0B0B0D] mt-0.5">
                  ₹{slab.price}
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
            Min Order: 5 pcs · Max Slab: 100 pcs
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Stepper */}
          <div className="flex items-center border border-zinc-300 rounded-xl bg-white shadow-2xs overflow-hidden h-12">
            <button
              onClick={() => setQuantity(Math.max(5, quantity - 1))}
              disabled={quantity <= 5}
              className="w-12 h-full flex items-center justify-center text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer text-base font-bold"
              aria-label="Decrease quantity"
            >
              -
            </button>
            <input
              type="number"
              min={5}
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
            {[5, 10, 25, 50, 100].map((quickQty) => (
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
                <strong className="text-zinc-900 font-mono">₹{nextTierUpsell.price}/pc</strong> rate!
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

      {/* 6. Pricing Summary & Final Calculations */}
      <div className="bg-zinc-50 rounded-2xl p-4 sm:p-5 border border-zinc-200/90 space-y-3">
        {quantity > 100 ? (
          <div className="space-y-1">
            <div className="text-xs text-amber-700 font-bold uppercase font-mono">Large Volume Order</div>
            <div className="font-display font-extrabold text-2xl text-[#0B0B0D]">
              Request a Custom Quote
            </div>
            <p className="text-xs text-zinc-600">
              Quantity exceeds standard 100 pieces slab. Contact our factory team for customized bulk pricing and box packaging options.
            </p>
          </div>
        ) : (
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs text-zinc-500 font-medium">Estimated Order Total</div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#0B0B0D] tabular-nums tracking-tight">
                  ₹{totalPrice.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono font-bold text-zinc-900 bg-zinc-200/70 px-2 py-0.5 rounded">
                ₹{unitPrice} / pc
              </span>
              <div className="text-[11px] text-zinc-500 font-mono mt-1">
                {quantity} pieces × ₹{unitPrice}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-2 border-t border-zinc-200/80 font-mono">
          <span>Includes Full UV Logo Print</span>
          <span>GST 18% Extra on Invoice</span>
        </div>
      </div>

      {/* 7. Action Buttons (Add to Cart / Request a Quote & WhatsApp) */}
      <div className="space-y-3">
        {quantity > 100 ? (
          <a
            href={`https://wa.me/${BUSINESS_CONFIG.contact.whatsappDigits}?text=${encodeURIComponent(
              `Hi TeqqnoWorld, I want a custom quote for Promotional Ceramic Mug (White ONLY, Quantity: ${quantity} pcs). Please share bulk rates and delivery schedule.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4 px-6 rounded-xl font-display font-extrabold text-base bg-[#FF7A00] hover:bg-[#e06c00] text-white transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <WhatsAppIcon className="w-5 h-5 text-white" />
            <span>Request a Quote for {quantity} Mugs</span>
          </a>
        ) : (
          <button
            ref={mainBuyButtonRef}
            onClick={onAddToCart}
            disabled={isAdding}
            className={`w-full py-4 px-6 rounded-xl font-display font-extrabold text-base transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
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
                <span>Add {quantity} Custom {quantity === 1 ? 'Mug' : 'Mugs'} to Cart</span>
                <span className="text-xs font-mono font-normal opacity-80">· ₹{totalPrice.toLocaleString('en-IN')}</span>
              </>
            )}
          </button>
        )}

        {/* WhatsApp Instant Quote Button */}
        <a
          href={`https://wa.me/${BUSINESS_CONFIG.contact.whatsappDigits}?text=${encodeURIComponent(
            `Hi TeqqnoWorld, I want a quote for Promotional Ceramic Mug (White ONLY, Quantity: ${quantity} pcs, Custom Logo: ${frontArtwork?.dataUrl ? 'Provided' : 'Will Share'}). Please share pricing and delivery schedule.`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] border border-[#25D366]/40 font-display font-bold text-xs sm:text-sm py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <WhatsAppIcon variant="badge" className="w-4.5 h-4.5" />
          <span>Get Instant WhatsApp Quote (Direct Factory Desk)</span>
        </a>
      </div>

      {/* 8. Assurance Pillars */}
      <div className="pt-2 border-t border-zinc-100">
        <ProductAssuranceCards product={product} compact={true} />
      </div>

    </div>
  );
};
