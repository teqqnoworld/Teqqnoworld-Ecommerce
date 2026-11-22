import React from 'react';
import { X, Heart, Trash2, ShoppingBag, Sparkles, ArrowRight } from 'lucide-react';
import { Product } from '../types';
import { ProductMockupCanvas } from './ProductMockupCanvas';

interface WishlistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: Product[];
  onRemoveItem: (productId: string) => void;
  onClearAll: () => void;
  onSelectProduct: (product: Product) => void;
  onCustomizeProduct: (productId: string) => void;
  onQuickAddToCart: (product: Product) => void;
  onExploreCatalog: () => void;
}

const PRODUCT_THUMBNAIL_MAP: Record<string, string> = {
  'prod-promo-table': '/assets/promo-table/promo-table-banner.webp',
  'prod-branding-umbrella': '/assets/aistudio/Custom_Printed_Branding_Umbrella_Banner_ddb8aff0.webp',
  'prod-rollup-standee': '/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp',
  'prod-visiting-card-300gsm': '/assets/aistudio/Premium_300_GSM_Business_Cards__1__cc07b248.webp',
  'prod-canopy-kiosk': '/assets/aistudio/Promotional_Canopy_Kiosk_Feature_Graphic_58ea1c0d.webp',
  'prod-ceramic-mug': '/assets/aistudio/ceramic_mug_banner_1672x941_dc952a76.webp',
};

export const WishlistDrawer: React.FC<WishlistDrawerProps> = ({
  isOpen,
  onClose,
  items,
  onRemoveItem,
  onClearAll,
  onSelectProduct,
  onCustomizeProduct,
  onQuickAddToCart,
  onExploreCatalog,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10 h-[100dvh]">
        <div className="w-screen max-w-md h-full bg-white shadow-2xl flex flex-col justify-between">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-[#E5E5EA] flex items-center justify-between bg-[#FAF9FD]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center text-rose-500 shrink-0">
                <Heart className="w-4.5 h-4.5 fill-rose-500 text-rose-500" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-bold text-base sm:text-lg text-[#0B0B0D] leading-tight truncate">
                  Your Wishlist ({items.length})
                </h2>
                <p className="text-[11px] text-zinc-500 truncate">
                  Saved merchandise for quick bulk quotes & orders
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close wishlist"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/60 transition-colors group cursor-pointer shrink-0"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
            </button>
          </div>

          {/* Wishlist Items */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
            {items.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3.5">
                <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                  <Heart className="w-8 h-8" />
                </div>
                <div className="font-display font-bold text-base text-[#0B0B0D]">
                  Your wishlist is empty
                </div>
                <p className="text-xs text-zinc-500 max-w-xs mx-auto leading-relaxed">
                  Tap the heart icon on any polo, cap, mug, standee, or canopy kiosk to shortlist items for your team order.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onExploreCatalog();
                  }}
                  className="bg-[#FF7A00] hover:bg-[#e06c00] text-white text-xs font-semibold py-2.5 px-5 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Explore Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              items.map((product) => {
                const lowestTier = product.tieredPricing[product.tieredPricing.length - 1];
                const displayPrice = lowestTier ? lowestTier.price : product.basePrice;
                const thumbSrc = PRODUCT_THUMBNAIL_MAP[product.id];

                return (
                  <div
                    key={product.id}
                    className="bg-white rounded-xl border border-[#E5E5EA] hover:border-[#FF7A00]/50 p-3.5 transition-all space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail */}
                      <button
                        type="button"
                        onClick={() => {
                          onSelectProduct(product);
                          onClose();
                        }}
                        className="w-20 h-20 rounded-xl bg-[#F8F8FA] border border-zinc-200/80 overflow-hidden shrink-0 flex items-center justify-center p-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                      >
                        {thumbSrc ? (
                          <img
                            src={thumbSrc}
                            alt={product.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ProductMockupCanvas
                            productType={product.productType || 'polo'}
                            color={product.colors[0]}
                            className="w-full h-full"
                          />
                        )}
                      </button>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wide truncate">
                            {product.category} · MOQ {product.moq} {product.id === 'prod-visiting-card-300gsm' ? 'cards' : 'pcs'}
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(product.id)}
                            aria-label={`Remove ${product.name} from wishlist`}
                            className="text-zinc-400 hover:text-red-600 transition-colors p-1 -mr-1 -mt-1 cursor-pointer shrink-0"
                            title="Remove from wishlist"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onSelectProduct(product);
                            onClose();
                          }}
                          className="text-left font-display font-bold text-xs sm:text-sm text-[#0B0B0D] hover:text-[#FF7A00] transition-colors line-clamp-2 mt-0.5 cursor-pointer"
                        >
                          {product.name}
                        </button>

                        <div className="flex items-baseline gap-1.5 mt-1.5">
                          <span className="font-display font-bold text-sm text-[#0B0B0D] tabular-nums">
                            ₹{displayPrice.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-500">
                            / {product.id === 'prod-visiting-card-300gsm' ? 'card' : 'pc'} bulk rate
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100">
                      <button
                        type="button"
                        onClick={() => {
                          onCustomizeProduct(product.id);
                          onClose();
                        }}
                        className="bg-[#FF7A00] hover:bg-[#e06c00] text-white text-xs font-display font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px]"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Customize</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onQuickAddToCart(product);
                          onClose();
                        }}
                        className="bg-[#0B0B0D] hover:bg-zinc-800 text-white text-xs font-display font-semibold py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[38px]"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Move to Cart</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="p-4 sm:p-5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] border-t border-[#E5E5EA] bg-[#FAF9FD] space-y-2.5">
              <div className="flex items-center justify-between text-xs text-zinc-600">
                <span>
                  <strong className="text-[#0B0B0D]">{items.length}</strong> shortlisted {items.length === 1 ? 'item' : 'items'}
                </span>
                <button
                  type="button"
                  onClick={onClearAll}
                  className="text-xs font-semibold text-zinc-500 hover:text-red-600 transition-colors cursor-pointer"
                >
                  Clear Wishlist
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onExploreCatalog();
                }}
                className="w-full bg-white hover:bg-zinc-50 border border-zinc-300 text-[#0B0B0D] font-display font-semibold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-[42px]"
              >
                <span>Browse More Products</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
