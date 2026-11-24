import React, { useState } from 'react';
import { Star, Sparkles, ArrowRight, Heart } from 'lucide-react';
import { BEST_SELLERS, BestSellerProduct } from '../data/mockData';
import { Product } from '../types';
import { getProductPath } from '../config/seoRoutes';
import { getResponsivePictureSources } from '../utils/responsiveImage';

interface FeaturedProductsProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onCustomizeProduct: (productId: string) => void;
  onQuickAddToCart: (product: Product) => void;
  wishlistIds?: string[];
  onToggleWishlist?: (productId: string) => void;
}

export const FeaturedProducts: React.FC<FeaturedProductsProps> = ({
  products,
  onSelectProduct,
  onCustomizeProduct,
  onQuickAddToCart,
  wishlistIds = [],
  onToggleWishlist,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>('All Best Sellers');

  const filterTabs = ['All Best Sellers', 'Apparel', 'Display', 'Drinkware', 'Stationery'];

  const displayedProducts = activeFilter === 'All Best Sellers'
    ? BEST_SELLERS
    : BEST_SELLERS.filter(p => p.category === activeFilter);

  const resolveFullProduct = (bs: BestSellerProduct): Product => {
    return products.find(p => {
      if (bs.id === 'bs-visiting-card-300gsm') return p.id === 'prod-visiting-card-300gsm' || p.slug === 'premium-300-gsm-visiting-card';
      if (bs.id === 'bs-rollup-standee') return p.id === 'prod-rollup-standee' || p.slug === 'rollup-standee';
      if (bs.id === 'bs-canopy-kiosk') return p.id === 'prod-canopy-kiosk' || p.slug === 'promotional-canopy-kiosk';
      if (bs.id === 'bs-ceramic-mug') return p.id === 'prod-ceramic-mug' || p.slug === 'promotional-ceramic-mug';
      if (bs.id === 'bs-branding-umbrella') return p.id === 'prod-branding-umbrella' || p.slug === 'custom-printed-branding-umbrella';
      if (bs.id === 'bs-promo-table') return p.id === 'prod-promo-table' || p.slug === 'promo-table';
      if (bs.id === 'bs-plain-polo') return p.id === 'prod-plain-polo' || p.slug === 'customized-plain-polo-t-shirt';
      if (bs.id === 'bs-joab-polo') return p.id === 'prod-joab-coolmax' || p.slug === 'joab-coolmax-polo-t-shirt';
      if (bs.id === 'bs-matty-polo') return p.id === 'prod-matty-polo' || p.slug === 'matty-polo-t-shirt';
      if (bs.id === 'bs-cotton-flexi-caps') return p.id === 'prod-cotton-flexi-caps' || p.slug === 'cotton-flexi-caps';
      if (bs.id === 'bs-polo') return p.id === 'prod-polo-01';
      return p.name.toLowerCase().includes(bs.name.split(' ')[0].toLowerCase());
    }) || products[0];
  };

  const handleCtaClick = (bs: BestSellerProduct) => {
    const fullProd = resolveFullProduct(bs);

    if (fullProd.id === 'prod-rollup-standee' || fullProd.productType === 'standee' || fullProd.id === 'prod-promo-table') {
      onSelectProduct(fullProd);
    } else {
      onCustomizeProduct(fullProd.id);
    }
  };

  return (
    <section className="py-16 bg-[#F4F2FA] border-b border-[#E5E5EA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header & Filter Tabs */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="font-display text-3xl font-bold text-[#0B0B0D] tracking-tight">
              Factory Best Sellers
            </h2>
            <p className="text-zinc-600 text-xs sm:text-sm mt-1">
              Ordered by 800+ businesses this month. Ready for high-precision branding.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x pb-1">
            {filterTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveFilter(tab)}
                className={`text-xs px-3.5 py-2 rounded-full font-medium whitespace-nowrap transition-colors min-h-[38px] flex items-center cursor-pointer ${
                  activeFilter === tab
                    ? 'bg-[#FF7A00] text-white shadow-xs font-semibold'
                    : 'bg-white/80 hover:bg-white text-zinc-600 border border-zinc-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 6 Products arranged in 2 rows of 3 on desktop, 2 cols on sm/tablet */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
          {displayedProducts.map((p) => {
            const fullProd = resolveFullProduct(p);
            const productHref = getProductPath(fullProd.slug || fullProd.id);
            const isWishlisted = wishlistIds.includes(fullProd.id);
            const onProductLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
              if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                e.preventDefault();
                handleCtaClick(p);
              }
            };
            const pic = getResponsivePictureSources(
              p.image,
              '(max-width: 640px) calc(100vw - 32px), (max-width: 1024px) calc(50vw - 40px), 384px'
            );
            return (
            <div
              key={p.id}
              className="group bg-white rounded-2xl border border-zinc-200/90 overflow-hidden shadow-xs hover:shadow-lg hover:border-[#FF7A00]/40 transition-all duration-300 flex flex-col justify-between"
            >
              {/* Product Image Box - 16:9 standard widescreen banner ratio */}
              <div className="relative aspect-[16/9] bg-zinc-100 overflow-hidden">
                <a
                  href={productHref}
                  onClick={onProductLinkClick}
                  aria-label={`View ${p.name}`}
                  className="block w-full h-full cursor-pointer"
                >
                  <picture className="block w-full h-full">
                    {pic.avifSrcSet && (
                      <source type="image/avif" srcSet={pic.avifSrcSet} sizes={pic.sizes} />
                    )}
                    {pic.webpSrcSet && (
                      <source type="image/webp" srcSet={pic.webpSrcSet} sizes={pic.sizes} />
                    )}
                    <img
                      src={pic.src}
                      srcSet={pic.webpSrcSet}
                      sizes={pic.sizes}
                      alt={p.name}
                      width={480}
                      height={270}
                      loading="lazy"
                      decoding="async"
                      className={`w-full h-full ${p.id === 'bs-promo-table' || p.id === 'bs-ceramic-mug' || p.id === 'bs-branding-umbrella' || p.id === 'bs-canopy-kiosk' || p.id === 'bs-rollup-standee' || p.id === 'bs-visiting-card-300gsm' ? 'object-contain bg-white' : 'object-cover object-center'} group-hover:scale-104 transition-transform duration-300`}
                    />
                  </picture>

                  {/* Top Left Badges */}
                  <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10 max-w-[calc(100%-64px)]">
                    {p.badges.map((b, idx) => (
                      <span
                        key={idx}
                        className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-md shadow-2xs ${b.color || 'bg-zinc-800'}`}
                      >
                        {b.text}
                      </span>
                    ))}
                  </div>

                  {/* Bottom Left Delivery Tag */}
                  {p.deliveryTag && (
                    <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-xs text-white text-[10px] font-medium px-2 py-0.5 rounded-md border border-white/10 z-10">
                      {p.deliveryTag}
                    </div>
                  )}
                </a>

                {/* Top Right Wishlist Toggle (sibling outside anchor for valid HTML) */}
                {onToggleWishlist && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWishlist(fullProd.id);
                    }}
                    aria-label={isWishlisted ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}
                    title={isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
                    className={`absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center border shadow-xs transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95 ${
                      isWishlisted
                        ? 'bg-rose-50 border-rose-200 text-rose-500'
                        : 'bg-white/95 backdrop-blur-xs border-zinc-200/90 text-zinc-600 hover:text-rose-500 hover:border-rose-200'
                    }`}
                  >
                    <Heart className={`w-4 h-4 transition-transform ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
                  </button>
                )}
              </div>

              {/* Card Details */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  {/* Rating */}
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-current group-hover:scale-125 group-hover:rotate-12 transition-all duration-300" />
                      <span className="font-bold text-zinc-800 text-xs">{p.rating}</span>
                    </div>
                    <span>({p.reviewCount} reviews)</span>
                  </div>

                  {/* Title */}
                  <h3 className="font-display font-bold text-base text-[#0B0B0D] leading-snug group-hover:text-[#FF7A00] transition-colors">
                    <a
                      href={productHref}
                      onClick={onProductLinkClick}
                      className="hover:text-[#FF7A00] transition-colors"
                    >
                      {p.name}
                    </a>
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed">
                    {p.description}
                  </p>

                  {/* Colors or Options */}
                  {p.colors && (
                    <div className="mt-3 pt-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] text-zinc-500 font-medium">Available Colors:</span>
                        {p.colors.length > 4 && (
                          <span className="text-[10px] font-mono text-[#FF7A00] font-bold bg-orange-50 px-1.5 py-0.2 rounded border border-orange-200">
                            {p.colors.length} Shades
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {p.colors.map((c, i) => (
                          <span
                            key={i}
                            className="w-3.5 h-3.5 rounded-full border border-black/20 shadow-2xs hover:scale-130 transition-transform cursor-pointer"
                            style={{ backgroundColor: c }}
                            title={`Color swatch ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {p.optionsText && (
                    <div className="text-[11px] text-zinc-500 mt-2 font-mono">
                      {p.optionsText}
                    </div>
                  )}
                </div>

                {/* Price and Action Button Row */}
                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-2 sm:gap-4">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display font-bold text-lg sm:text-xl text-[#0B0B0D] tabular-nums">
                        ₹{p.price}
                      </span>
                      <span className="text-[11px] sm:text-xs text-zinc-500 font-mono truncate">
                        {p.priceUnit}
                      </span>
                    </div>
                  </div>

                  <a
                    href={productHref}
                    onClick={onProductLinkClick}
                    className={`text-xs font-display font-bold px-3.5 sm:px-4 py-2.5 min-h-[42px] rounded-xl shadow-xs transition-all hover:scale-102 flex items-center gap-1.5 cursor-pointer group/cta shrink-0 ${
                      p.ctaType === 'orange'
                        ? 'bg-[#FF7A00] hover:bg-[#e06c00] text-white shadow-[#FF7A00]/25'
                        : 'bg-[#18191E] hover:bg-black text-white'
                    }`}
                  >
                    {p.ctaType === 'orange' ? (
                      <Sparkles className="w-3.5 h-3.5 group-hover/cta:rotate-45 group-hover/cta:scale-120 transition-all duration-300" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5 group-hover/cta:translate-x-1 transition-transform duration-300" />
                    )}
                    <span>{p.ctaText}</span>
                  </a>
                </div>

              </div>
            </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
