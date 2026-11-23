import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Filter,
  Sparkles,
  ArrowRight,
  Star,
  SlidersHorizontal,
  Heart,
  ShieldCheck,
  Clock,
  FileText,
  Calculator,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PRODUCTS } from '../data/mockData';
import { Product, ProductCategory, PrintMethod } from '../types';
import { ProductMockupCanvas } from './ProductMockupCanvas';
import {
  SEO_CATEGORIES,
  findCategoryBySlugOrAlias,
  getCategoryForProduct,
  getCategoryPath,
  getProductH1,
  getProductPath,
} from '../config/seoRoutes';

const SHOWCASE_BANNER_BY_PRODUCT_ID: Record<string, { src: string; fit: 'cover' | 'contain' }> = {
  'prod-ceramic-mug': {
    src: '/assets/aistudio/ceramic_mug_banner_1672x941_dc952a76.webp',
    fit: 'contain',
  },
  'prod-promo-table': {
    src: '/assets/promo-table/promo-table-banner.webp',
    fit: 'contain',
  },
  'prod-branding-umbrella': {
    src: '/assets/aistudio/Custom_Printed_Branding_Umbrella_Banner_ddb8aff0.webp',
    fit: 'contain',
  },
  'prod-canopy-kiosk': {
    src: '/assets/aistudio/Promotional_Canopy_Kiosk_Feature_Graphic_58ea1c0d.webp',
    fit: 'contain',
  },
  'prod-rollup-standee': {
    src: '/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp',
    fit: 'contain',
  },
  'prod-visiting-card-300gsm': {
    src: '/assets/aistudio/Premium_300_GSM_Business_Cards__1__cc07b248.webp',
    fit: 'contain',
  },
  'prod-plain-polo': {
    src: '/assets/aistudio/Classic_Plain_Polo_Color_Collection_17e25f68.webp',
    fit: 'cover',
  },
  'prod-polo-01': {
    src: '/assets/products/prod_tipping_polo.webp',
    fit: 'cover',
  },
  'prod-joab-coolmax': {
    src: '/assets/aistudio/JOAB_Coolmax_Polo_Shirt_Showcase_0673e0a4.webp',
    fit: 'cover',
  },
  'prod-matty-polo': {
    src: '/assets/aistudio/Premium_Matty_Polo_T-Shirt_Banner_45dae9b5.webp',
    fit: 'cover',
  },
  'prod-cotton-flexi-caps': {
    src: '/assets/aistudio/Cotton_Flexi_Caps_Product_Banner_7057e0bd.webp',
    fit: 'cover',
  },
};

interface ProductCatalogViewProps {
  initialCategory?: ProductCategory;
  searchQuery?: string;
  onCategoryChange?: (category: ProductCategory) => void;
  onNavigateHome?: () => void;
  onNavigateRoute?: (route: string) => void;
  onSelectProduct: (product: Product) => void;
  onCustomizeProduct: (productId: string) => void;
  onOpenQuoteCalculator?: () => void;
  onOpenDownloadCatalog?: () => void;
  wishlistIds?: string[];
  onToggleWishlist?: (productId: string) => void;
}

export const ProductCatalogView: React.FC<ProductCatalogViewProps> = ({
  initialCategory = 'all',
  searchQuery = '',
  onCategoryChange,
  onNavigateHome,
  onNavigateRoute,
  onSelectProduct,
  onCustomizeProduct,
  onOpenQuoteCalculator,
  onOpenDownloadCatalog,
  wishlistIds = [],
  onToggleWishlist,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>(initialCategory);
  const activeCategorySeo =
    selectedCategory !== 'all' ? findCategoryBySlugOrAlias(selectedCategory) : undefined;

  const handleCategorySelect = (cat: ProductCategory) => {
    setSelectedCategory(cat);
    onCategoryChange?.(cat);
  };
  const [searchTerm, setSearchTerm] = useState(searchQuery);
  const [selectedPrintMethod, setSelectedPrintMethod] = useState<string>('all');
  const [selectedPriceRange, setSelectedPriceRange] = useState<'all' | 'under-200' | '200-500' | '500-1000' | '1000-plus'>('all');
  const [selectedMoqRange, setSelectedMoqRange] = useState<'all' | '1-2' | '3-10' | '11-50' | '50-plus'>('all');
  const [selectedDispatch, setSelectedDispatch] = useState<'all' | 'fast-24' | 'standard'>('all');
  const [onlyWishlisted, setOnlyWishlisted] = useState(false);
  const [sortBy, setSortBy] = useState<'featured' | 'price-low' | 'price-high' | 'rating' | 'moq'>('featured');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [cardViews, setCardViews] = useState<Record<string, 'studio' | 'front' | 'back'>>({});

  // Sync state if category or search query props change dynamically
  useEffect(() => {
    setSelectedCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    setSearchTerm(searchQuery);
  }, [searchQuery]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter((p) => {
      // Category match
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'caps' || selectedCategory === 'custom-caps') {
          if (p.productType !== 'cap' && !p.name.toLowerCase().includes('cap')) return false;
        } else if (selectedCategory === 'apparel' || selectedCategory === 'custom-tshirt-printing') {
          if (p.category !== 'apparel') return false;
          if (selectedCategory === 'custom-tshirt-printing' && p.productType === 'cap') return false;
        } else if (selectedCategory === 'corporate-gifting' || selectedCategory === 'kits' || selectedCategory === 'drinkware') {
          if (p.category !== 'kits' && p.category !== 'drinkware') return false;
        } else if (selectedCategory === 'signage' || selectedCategory === 'promotional-items') {
          if (p.category !== 'signage') return false;
        } else if (selectedCategory === 'stationery' || selectedCategory === 'printing-items') {
          if (p.category !== 'stationery') return false;
        } else if (p.category !== selectedCategory) {
          return false;
        }
      }

      // Print method match
      if (selectedPrintMethod !== 'all' && !p.printMethods.includes(selectedPrintMethod as PrintMethod)) return false;

      // Price range match
      if (selectedPriceRange === 'under-200' && p.basePrice >= 200) return false;
      if (selectedPriceRange === '200-500' && (p.basePrice < 200 || p.basePrice > 500)) return false;
      if (selectedPriceRange === '500-1000' && (p.basePrice < 500 || p.basePrice > 1000)) return false;
      if (selectedPriceRange === '1000-plus' && p.basePrice <= 1000) return false;

      // MOQ range match
      if (selectedMoqRange === '1-2' && p.moq > 2) return false;
      if (selectedMoqRange === '3-10' && (p.moq < 3 || p.moq > 10)) return false;
      if (selectedMoqRange === '11-50' && (p.moq < 11 || p.moq > 50)) return false;
      if (selectedMoqRange === '50-plus' && p.moq < 50) return false;

      // Dispatch turnaround match
      if (selectedDispatch === 'fast-24' && !p.dispatchTime.includes('24')) return false;
      if (selectedDispatch === 'standard' && p.dispatchTime.includes('24')) return false;

      // Saved / Wishlist filter
      if (onlyWishlisted && !wishlistIds.includes(p.id)) return false;

      // Search term
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesDesc = p.description.toLowerCase().includes(query);
        const matchesCategory = p.category.toLowerCase().includes(query);
        const matchesPrint = p.printMethods.some(pm => pm.toLowerCase().includes(query));
        if (!matchesName && !matchesDesc && !matchesCategory && !matchesPrint) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price-low') return a.basePrice - b.basePrice;
      if (sortBy === 'price-high') return b.basePrice - a.basePrice;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'moq') return a.moq - b.moq;
      return 0; // featured default
    });
  }, [selectedCategory, selectedPrintMethod, selectedPriceRange, selectedMoqRange, selectedDispatch, onlyWishlisted, wishlistIds, searchTerm, sortBy]);

  const savedCatalogCount = PRODUCTS.filter(p => wishlistIds.includes(p.id)).length;

  const activeFiltersCount = (selectedCategory !== 'all' ? 1 : 0) +
    (selectedPrintMethod !== 'all' ? 1 : 0) +
    (selectedPriceRange !== 'all' ? 1 : 0) +
    (selectedMoqRange !== 'all' ? 1 : 0) +
    (selectedDispatch !== 'all' ? 1 : 0) +
    (onlyWishlisted ? 1 : 0) +
    (searchTerm.trim() !== '' ? 1 : 0);

  const resetAllFilters = () => {
    handleCategorySelect('all');
    setSelectedPrintMethod('all');
    setSelectedPriceRange('all');
    setSelectedMoqRange('all');
    setSelectedDispatch('all');
    setOnlyWishlisted(false);
    setSearchTerm('');
  };

  const categories = [
    {
      id: 'all',
      label: 'All Catalog',
      sub: 'Full Collection',
      image: '/assets/categories/cat_joining_kits.webp',
    },
    {
      id: 'corporate-gifting',
      label: 'Corporate Gifting',
      sub: 'Mugs & Kits',
      image: '/assets/aistudio/Corporate_Gifting_Badge_with_Branded_Essentials_11cc4d80.webp',
    },
    {
      id: 'promotional-items',
      label: 'Promotional Items',
      sub: 'Canopies & Events',
      image: '/assets/aistudio/Promotional_Products_Showcase_Badge_12258b82.webp',
    },
    {
      id: 'custom-tshirt-printing',
      label: 'Custom T-Shirts',
      sub: 'Polos & Apparel',
      image: '/assets/aistudio/Tipping_and_Classic_Polo_Shirt_Showcase_e4ad53f7.webp',
    },
    {
      id: 'printing-items',
      label: 'Printing Items',
      sub: 'Cards & Flyers',
      image: '/assets/aistudio/Professional_Printing_Items_Badge_03c76e87.webp',
    },
    {
      id: 'caps',
      label: 'Custom Caps',
      sub: 'Cotton Caps',
      image: '/assets/aistudio/Custom_Caps_Promotional_Badge_4c597194.webp',
    },
  ];

  const heroShowcaseTiles = [
    {
      productId: 'prod-plain-polo',
      title: '230 GSM Plain Polos',
      tag: '16 Colours',
      price: 'From ₹450',
      image: '/assets/aistudio/Classic_Plain_Polo_Color_Collection_17e25f68.webp',
    },
    {
      productId: 'prod-ceramic-mug',
      title: 'Ceramic Brand Mugs',
      tag: 'Min 5 pcs',
      price: 'From ₹149',
      image: '/assets/aistudio/ceramic_mug_banner_1672x941_dc952a76.webp',
    },
    {
      productId: 'prod-cotton-flexi-caps',
      title: 'Cotton Flexi Caps',
      tag: '6 Colours',
      price: 'From ₹135',
      image: '/assets/aistudio/Cotton_Flexi_Caps_Product_Banner_7057e0bd.webp',
    },
    {
      productId: 'prod-canopy-kiosk',
      title: 'Canopy & Display Gear',
      tag: '24–48h Ready',
      price: 'Exhibition',
      image: '/assets/aistudio/Promotional_Canopy_Kiosk_Feature_Graphic_58ea1c0d.webp',
    },
  ];

  const printMethodsList = [
    'all',
    'Precision Embroidery',
    'DTF Printing',
    'Laser Engraving',
    'High-Precision UV',
    'Screen Printing'
  ];

  return (
    <div className="bg-[#F4F2FA] min-h-screen py-6 sm:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        {/* Semantic Crawlable Breadcrumb Bar (Home > Category or Home > Catalog) */}
        <nav aria-label="Breadcrumb" className="flex items-center justify-between gap-3 text-xs text-zinc-500">
          <ol className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
            <li>
              <a
                href="/"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    onNavigateHome?.();
                  }
                }}
                className="hover:text-[#FF7900] transition-colors font-medium"
              >
                Home
              </a>
            </li>
            <li aria-hidden="true" className="text-zinc-300">/</li>
            {activeCategorySeo ? (
              <li aria-current="page" className="text-[#0B1530] font-semibold truncate">
                {activeCategorySeo.name}
              </li>
            ) : (
              <li aria-current="page" className="text-[#0B1530] font-semibold">
                All Custom Products
              </li>
            )}
          </ol>

          {activeCategorySeo && (
            <a
              href="/catalog"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  handleCategorySelect('all');
                }
              }}
              className="text-[11px] font-semibold text-[#FF7900] hover:underline shrink-0"
            >
              View Full Catalog →
            </a>
          )}
        </nav>

        {/* Premium Dark Navy Master Catalog / Category Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#0B1530] via-[#071B35] to-[#0E274E] text-white p-5 sm:p-8 lg:p-10 shadow-[0_24px_60px_-18px_rgba(7,27,53,0.45)] border border-white/10"
        >
          {/* Ambient Animated Orange & Navy Lighting */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-16 w-80 h-80 rounded-full bg-[#FF7900]/22 blur-[110px] animate-faq-float"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 w-72 h-72 rounded-full bg-sky-400/12 blur-[100px] animate-faq-float-reverse"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Left Copy & Quick Actions (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-xs text-[11px] font-mono uppercase tracking-wider text-orange-200">
                <span className="w-2 h-2 rounded-full bg-[#FF7900] animate-pulse" />
                <span>
                  {activeCategorySeo
                    ? `TeqqnoWorld / ${activeCategorySeo.name}`
                    : 'TeqqnoWorld / Master Catalog'}
                </span>
              </div>

              <h1 className="font-display text-2xl sm:text-4xl lg:text-[2.6rem] font-bold tracking-tight leading-[1.12] text-white">
                {activeCategorySeo ? (
                  activeCategorySeo.h1
                ) : (
                  <>
                    Corporate Merchandise &amp;{' '}
                    <span className="text-[#FF7900]">Custom Printing Catalog</span>
                  </>
                )}
              </h1>

              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                {activeCategorySeo
                  ? activeCategorySeo.intro
                  : 'Factory-direct branded polo T-shirts, cotton caps, corporate ceramic mugs, exhibition displays, and 300 GSM visiting cards with live volume tier discounts and 18% GST invoicing.'}
              </p>

              {/* Micro Reassurance Pills */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-200 bg-white/8 border border-white/12 px-3 py-1.5 rounded-xl">
                  <Clock className="w-3.5 h-3.5 text-[#FF7900]" />
                  24–48h Fast Dispatch
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-200 bg-white/8 border border-white/12 px-3 py-1.5 rounded-xl">
                  <Sparkles className="w-3.5 h-3.5 text-[#FF7900]" />
                  Free 3D Proof in 1 Hour
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-200 bg-white/8 border border-white/12 px-3 py-1.5 rounded-xl">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  18% GST ITC Invoice
                </span>
              </div>

              {/* Action Buttons (Mobile + Desktop Accessible) */}
              {(onOpenQuoteCalculator || onOpenDownloadCatalog) && (
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {onOpenQuoteCalculator && (
                    <a
                      href="/quote-calculator"
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                          e.preventDefault();
                          onOpenQuoteCalculator();
                        }
                      }}
                      className="bg-[#FF7900] hover:bg-[#e56d00] active:scale-[0.98] text-white text-xs font-display font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-[#FF7900]/25 transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>B2B Quote Calculator</span>
                    </a>
                  )}
                  {onOpenDownloadCatalog && (
                    <button
                      type="button"
                      onClick={onOpenDownloadCatalog}
                      className="bg-white/10 hover:bg-white/18 text-white border border-white/20 text-xs font-display font-semibold px-4 py-2.5 rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-orange-300" />
                      <span>Download Catalogues PDF</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right Visual Showcase Collage (5 cols) */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-3">
              {heroShowcaseTiles.map((tile, idx) => {
                const matchedProduct = PRODUCTS.find((p) => p.id === tile.productId);
                const tileHref = matchedProduct ? getProductPath(matchedProduct.slug) : '/catalog';
                return (
                  <motion.a
                    key={tile.productId}
                    href={tileHref}
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.4, delay: 0.08 + idx * 0.07 }}
                    whileHover={{ y: -4, scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                        e.preventDefault();
                        if (matchedProduct) onSelectProduct(matchedProduct);
                      }
                    }}
                    className="group relative bg-white/95 hover:bg-white rounded-2xl p-2 text-left shadow-xl border border-white/20 overflow-hidden cursor-pointer transition-shadow hover:shadow-2xl block"
                  >
                    <div className="relative aspect-[16/10] w-full rounded-xl overflow-hidden bg-slate-100">
                      <img
                        src={tile.image}
                        alt={tile.title}
                        width={240}
                        height={150}
                        loading={idx < 2 ? 'eager' : 'lazy'}
                        decoding="async"
                        className="w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-500"
                      />
                      <span className="absolute top-1.5 right-1.5 bg-[#0B1530]/85 backdrop-blur-xs text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md">
                        {tile.price}
                      </span>
                    </div>
                    <div className="px-1 pt-2 pb-0.5 flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-[#0B1530] truncate group-hover:text-[#FF7900] transition-colors">
                        {tile.title}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-500 shrink-0">{tile.tag}</span>
                    </div>
                  </motion.a>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Visual Category Showcase Strip (Matching Homepage CategoriesSection Images) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#FF7900]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#0B1530]">
                Browse by Merchandise Category
              </h2>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono hidden sm:inline">
              Tap a category to filter catalog
            </span>
          </div>

          <div className="flex lg:grid lg:grid-cols-6 gap-3 overflow-x-auto no-scrollbar touch-pan-x pb-1 pt-1">
            {categories.map((c, idx) => {
              const isActive = selectedCategory === c.id;
              return (
                <motion.a
                  key={c.id}
                  href={getCategoryPath(c.id)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.04 }}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={(e) => {
                    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                      e.preventDefault();
                      handleCategorySelect(c.id as ProductCategory);
                    }
                  }}
                  className={`group shrink-0 w-[132px] sm:w-[152px] lg:w-auto rounded-2xl p-3 border transition-all duration-200 flex flex-col items-center text-center cursor-pointer ${
                    isActive
                      ? 'bg-[#0B1530] text-white border-[#FF7900] shadow-lg shadow-[#0B1530]/18 ring-2 ring-[#FF7900]/25'
                      : 'bg-white text-[#0B1530] border-slate-200/90 hover:border-[#FF7900]/50 hover:shadow-md'
                  }`}
                >
                  <div
                    className={`w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden mb-2.5 p-0.5 transition-all duration-300 group-hover:scale-108 ${
                      isActive
                        ? 'ring-2 ring-[#FF7900] bg-white/10 shadow-md'
                        : 'ring-1 ring-slate-200 bg-slate-50 shadow-xs'
                    }`}
                  >
                    <img
                      src={c.image}
                      alt={c.label}
                      width={72}
                      height={72}
                      loading="eager"
                      decoding="async"
                      className="w-full h-full object-cover rounded-full"
                    />
                  </div>
                  <div className="text-xs font-display font-bold leading-tight line-clamp-1">
                    {c.label}
                  </div>
                  <div
                    className={`text-[10px] mt-0.5 line-clamp-1 ${
                      isActive ? 'text-orange-300 font-medium' : 'text-zinc-500'
                    }`}
                  >
                    {c.sub}
                  </div>
                </motion.a>
              );
            })}
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-[0_10px_30px_-14px_rgba(11,21,48,0.1)] space-y-4">
          
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search products (e.g. polo, bottle, hoodie, embroidery)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-14 py-2.5 text-sm sm:text-sm border border-zinc-200 rounded-xl focus:border-[#FF7A00] focus:ring-1 focus:ring-[#FF7A00] outline-none min-h-[44px]"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-zinc-600 px-2 py-1 min-h-[36px] flex items-center"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Print Technique Filter, Saved Toggle & Sort dropdowns */}
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyWishlisted(!onlyWishlisted)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-xl border transition-colors cursor-pointer min-h-[44px] whitespace-nowrap ${
                  onlyWishlisted
                    ? 'border-rose-300 bg-rose-50 text-rose-600 font-semibold'
                    : 'border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${onlyWishlisted || savedCatalogCount > 0 ? 'fill-rose-500 text-rose-500' : ''}`} />
                <span className="tabular-nums">Saved ({savedCatalogCount})</span>
              </button>

              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-xl border transition-colors cursor-pointer min-h-[44px] ${
                  showAdvancedFilters || activeFiltersCount > 0
                    ? 'border-[#FF7A00] bg-orange-50/50 text-[#FF7A00] font-semibold'
                    : 'border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filters {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
              </button>

              <div className="flex items-center gap-1.5 text-xs text-zinc-600 w-full sm:w-auto">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#FF7A00] shrink-0 hidden sm:inline" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full sm:w-auto border border-zinc-200 rounded-xl px-2.5 py-2 text-xs text-zinc-800 bg-white focus:border-[#FF7A00] outline-none min-h-[44px]"
                >
                  <option value="featured">Sort: Featured</option>
                  <option value="price-low">Price: Low-High</option>
                  <option value="price-high">Price: High-Low</option>
                  <option value="rating">Top Rated</option>
                  <option value="moq">Lowest MOQ</option>
                </select>
              </div>

              <select
                value={selectedPrintMethod}
                onChange={(e) => setSelectedPrintMethod(e.target.value)}
                className="w-full sm:w-auto border border-zinc-200 rounded-xl px-2.5 py-2 text-xs text-zinc-800 bg-white focus:border-[#FF7A00] outline-none min-h-[44px]"
              >
                <option value="all">All Print Methods</option>
                <option value="Precision Embroidery">Embroidery</option>
                <option value="DTF Printing">DTF Printing</option>
                <option value="Laser Engraving">Laser Engraving</option>
                <option value="High-Precision UV">UV Print</option>
                <option value="Screen Printing">Screen Printing</option>
              </select>
            </div>
          </div>

          {/* Expanded Multi-Facet Filter Drawers */}
          <AnimatePresence initial={false}>
          {showAdvancedFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
            <div className="pt-3 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-50/80 p-3.5 rounded-xl text-xs">
              
              {/* Filter 1: Price Range */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Price Per Unit
                </label>
                <select
                  value={selectedPriceRange}
                  onChange={(e) => setSelectedPriceRange(e.target.value as any)}
                  className="w-full border border-zinc-300 rounded-lg p-2 text-xs bg-white outline-none focus:border-[#FF7A00]"
                >
                  <option value="all">Any Price</option>
                  <option value="under-200">Under ₹200 (Badges, Caps, Accessories)</option>
                  <option value="200-500">₹200 – ₹500 (Polo, Mugs, Visiting Cards)</option>
                  <option value="500-1000">₹500 – ₹1,000 (Hoodies, Display Tables)</option>
                  <option value="1000-plus">₹1,000+ (Canopies, Standees, Umbrellas)</option>
                </select>
              </div>

              {/* Filter 2: MOQ Bracket */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Minimum Order Qty (MOQ)
                </label>
                <select
                  value={selectedMoqRange}
                  onChange={(e) => setSelectedMoqRange(e.target.value as any)}
                  className="w-full border border-zinc-300 rounded-lg p-2 text-xs bg-white outline-none focus:border-[#FF7A00]"
                >
                  <option value="all">All MOQs</option>
                  <option value="1-2">Ultra-Low MOQ (1–2 pcs)</option>
                  <option value="3-10">Small Team Batches (3–10 pcs)</option>
                  <option value="11-50">Department Orders (11–50 pcs)</option>
                  <option value="50-plus">Corporate Bulk (50+ pcs)</option>
                </select>
              </div>

              {/* Filter 3: Dispatch SLA */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1.5">
                  Production SLA Turnaround
                </label>
                <select
                  value={selectedDispatch}
                  onChange={(e) => setSelectedDispatch(e.target.value as any)}
                  className="w-full border border-zinc-300 rounded-lg p-2 text-xs bg-white outline-none focus:border-[#FF7A00]"
                >
                  <option value="all">All Dispatch Speeds</option>
                  <option value="fast-24">Express 24–48h Dispatch</option>
                  <option value="standard">Standard 3–5 Days</option>
                </select>
              </div>

            </div>
            </motion.div>
          )}
          </AnimatePresence>

          {/* Active Filter Pills Bar */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs border-t border-zinc-100">
              <span className="text-[11px] text-zinc-500 font-semibold">Active:</span>
              {selectedCategory !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-100 text-[#FF7A00] font-semibold text-[11px]">
                  Category: {categories.find(c => c.id === selectedCategory)?.label}
                  <button onClick={() => handleCategorySelect('all')} className="hover:text-black cursor-pointer">×</button>
                </span>
              )}
              {selectedPrintMethod !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-200 text-zinc-800 font-medium text-[11px]">
                  Print: {selectedPrintMethod}
                  <button onClick={() => setSelectedPrintMethod('all')} className="hover:text-black cursor-pointer">×</button>
                </span>
              )}
              {selectedPriceRange !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-200 text-zinc-800 font-medium text-[11px]">
                  Price: {selectedPriceRange}
                  <button onClick={() => setSelectedPriceRange('all')} className="hover:text-black cursor-pointer">×</button>
                </span>
              )}
              {selectedMoqRange !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-200 text-zinc-800 font-medium text-[11px]">
                  MOQ: {selectedMoqRange}
                  <button onClick={() => setSelectedMoqRange('all')} className="hover:text-black cursor-pointer">×</button>
                </span>
              )}
              {onlyWishlisted && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-semibold text-[11px]">
                  Wishlist Only
                  <button onClick={() => setOnlyWishlisted(false)} className="hover:text-black cursor-pointer">×</button>
                </span>
              )}
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-200 text-zinc-800 font-medium text-[11px]">
                  Query: "{searchTerm}"
                  <button onClick={() => setSearchTerm('')} className="hover:text-black cursor-pointer">×</button>
                </span>
              )}
              <button
                onClick={resetAllFilters}
                className="text-[11px] text-[#FF7A00] hover:underline font-semibold ml-2 cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          )}

        </div>

        {/* Section Heading & Results Counter */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#0B1530] tracking-tight">
              {activeCategorySeo ? activeCategorySeo.gridHeading : 'All Custom Printed Products'}
            </h2>
            <p className="text-xs text-zinc-500 font-mono mt-0.5">
              Displaying {filteredProducts.length} verified {filteredProducts.length === 1 ? 'product' : 'products'} {activeFiltersCount > 0 ? '(Filtered)' : ''}
            </p>
          </div>
          <span className="text-xs text-zinc-500 font-mono">Pan-India 24–48h Dispatch Eligible</span>
        </div>

        {/* Product Cards Grid */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E5EA] p-12 text-center space-y-3">
            <div className="text-zinc-400 font-display text-lg font-bold">No products matched your search</div>
            <p className="text-xs text-zinc-500">Try adjusting your keyword filter or browse all categories.</p>
            <button
              onClick={resetAllFilters}
              className="bg-[#0B0B0D] text-white text-xs px-4 py-2 rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {filteredProducts.map((product, idx) => {
              const lowestTier = product.tieredPricing[product.tieredPricing.length - 1];
              const isWishlisted = wishlistIds.includes(product.id);
              const showcaseConfig = SHOWCASE_BANNER_BY_PRODUCT_ID[product.id];
              const activeCardView = cardViews[product.id] || 'studio';
              const supportsGarmentToggle =
                product.productType === 'polo' ||
                product.productType === 'tshirt' ||
                product.productType === 'hoodie' ||
                product.productType === 'cap';
              const sampleLogoArtwork = {
                type: 'preset' as const,
                presetId: 'your-logo',
                text: 'YOUR LOGO HERE',
                x: 0,
                y: 0,
                scale: 0.9,
                rotation: 0,
              };

              const productHref = getProductPath(product.slug || product.id);
              const productDisplayTitle = getProductH1(product.id, product.name);
              const productCategorySeo = getCategoryForProduct(product);
              const productCategoryHref = productCategorySeo ? `/category/${productCategorySeo.slug}` : '/catalog';

              return (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(idx * 0.045, 0.25) }}
                  className="group bg-white rounded-2xl border border-slate-200/90 overflow-hidden hover:border-[#FF7900]/60 shadow-xs hover:shadow-[0_22px_45px_-16px_rgba(11,21,48,0.18)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                >
                  {/* Image / Studio Showcase Container (16:9 Matching Home Page Featured Products) */}
                  <div className="relative aspect-[16/10] bg-zinc-50 overflow-hidden flex items-center justify-center border-b border-slate-200/80">
                    <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-1 items-start max-w-[calc(100%-56px)] pointer-events-none">
                      {product.id === 'prod-rollup-standee' ? (
                        <>
                          <span className="bg-[#0B1530]/90 backdrop-blur-xs text-white text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full">
                            Black ONLY
                          </span>
                          <span className="bg-zinc-800/90 text-white text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full">
                            3 ft × 6 ft
                          </span>
                          <span className="bg-[#FF7900] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-2xs">
                            MOQ: 1 pc
                          </span>
                        </>
                      ) : product.id === 'prod-visiting-card-300gsm' ? (
                        <>
                          <span className="bg-[#0B1530]/90 backdrop-blur-xs text-white text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full">
                            White ONLY
                          </span>
                          <span className="bg-zinc-800/90 text-white text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full">
                            300 GSM
                          </span>
                          <span className="bg-[#FF7900] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-2xs">
                            MOQ: 100 pcs
                          </span>
                        </>
                      ) : (
                        <>
                          {product.badge && (
                            <span className="bg-[#0B1530]/90 backdrop-blur-xs text-white text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded-full">
                              {product.badge}
                            </span>
                          )}
                          <span className="bg-[#FF7900] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-2xs">
                            MOQ: {product.moq} pcs
                          </span>
                        </>
                      )}
                    </div>

                    {onToggleWishlist && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleWishlist(product.id);
                        }}
                        aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
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

                    <div className="absolute bottom-2.5 left-3 z-10 text-[10px] font-mono font-semibold text-zinc-700 bg-white/92 backdrop-blur-xs px-2 py-0.5 rounded-md border border-zinc-200/90 shadow-2xs pointer-events-none">
                      ⚡ {product.dispatchTime}
                    </div>

                    <a
                      href={productHref}
                      onClick={(e) => {
                        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                          e.preventDefault();
                          onSelectProduct(product);
                        }
                      }}
                      aria-label={`View ${productDisplayTitle}`}
                      className="w-full h-full group-hover:scale-105 transition-transform duration-500 flex items-center justify-center cursor-pointer"
                    >
                      {showcaseConfig && activeCardView === 'studio' ? (
                        <img
                          src={showcaseConfig.src}
                          alt={productDisplayTitle}
                          width={480}
                          height={300}
                          loading={idx < 3 ? 'eager' : 'lazy'}
                          decoding="async"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className={`w-full h-full ${
                            showcaseConfig.fit === 'cover' ? 'object-cover object-center' : 'object-contain bg-white p-1'
                          }`}
                        />
                      ) : (
                        <ProductMockupCanvas
                          productType={product.productType}
                          color={product.colors[0]}
                          artwork={sampleLogoArtwork}
                          printMethod={product.printMethods[0]}
                          printPlacement={
                            activeCardView === 'back'
                              ? 'Upper Back Center'
                              : product.productType === 'polo'
                              ? 'Left Chest'
                              : 'Center Chest'
                          }
                          view={activeCardView === 'back' ? 'back' : 'front'}
                          className="w-full h-full p-3"
                        />
                      )}
                    </a>

                    {supportsGarmentToggle && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-2.5 right-2.5 z-20 inline-flex items-center bg-white/95 backdrop-blur-xs border border-zinc-200 rounded-lg p-0.5 shadow-sm"
                      >
                        <button
                          type="button"
                          onClick={() => setCardViews((prev) => ({ ...prev, [product.id]: 'studio' }))}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                            activeCardView === 'studio'
                              ? 'bg-[#0B1530] text-white'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardViews((prev) => ({ ...prev, [product.id]: 'front' }))}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                            activeCardView === 'front'
                              ? 'bg-[#0B1530] text-white'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          Front
                        </button>
                        <button
                          type="button"
                          onClick={() => setCardViews((prev) => ({ ...prev, [product.id]: 'back' }))}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                            activeCardView === 'back'
                              ? 'bg-[#FF7900] text-white'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          Back
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                        <a
                          href={productCategoryHref}
                          onClick={(e) => {
                            if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                              e.preventDefault();
                              if (productCategorySeo) {
                                handleCategorySelect(productCategorySeo.catalogCategory as ProductCategory);
                              }
                            }
                          }}
                          className="uppercase font-mono text-[10px] tracking-wide text-[#FF7900] hover:underline font-semibold"
                        >
                          {productCategorySeo ? productCategorySeo.name : product.category}
                        </a>
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3.5 h-3.5 fill-current" />
                          <span className="font-semibold text-zinc-700 text-[11px]">{product.rating}</span>
                          <span className="text-zinc-400 text-[10px]">({product.reviewCount})</span>
                        </div>
                      </div>

                      <h3 className="font-display font-bold text-sm sm:text-base text-[#0B1530] group-hover:text-[#FF7900] transition-colors line-clamp-1">
                        <a
                          href={productHref}
                          onClick={(e) => {
                            if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                              e.preventDefault();
                              onSelectProduct(product);
                            }
                          }}
                          className="hover:text-[#FF7900] transition-colors"
                        >
                          {productDisplayTitle}
                        </a>
                      </h3>

                      <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
                        {product.shortDesc}
                      </p>

                      {/* Color Swatch Dots */}
                      {product.colors.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2.5">
                          {product.colors.slice(0, 6).map((c) => (
                            <span
                              key={c.name}
                              title={c.name}
                              className="w-3.5 h-3.5 rounded-full border border-zinc-300 shadow-2xs shrink-0"
                              style={{ backgroundColor: c.hex }}
                            />
                          ))}
                          {product.colors.length > 6 && (
                            <span className="text-[10px] font-mono text-zinc-500 font-semibold pl-0.5">
                              +{product.colors.length - 6}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Tiered Price Matrix */}
                    <div className="pt-2 border-t border-[#F0EFF5]">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <div className="text-[10px] text-zinc-400 uppercase font-mono">Bulk from:</div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="font-display font-bold text-lg text-[#0B0B0D] tabular-nums">
                              ₹{lowestTier ? lowestTier.price : product.basePrice}
                            </span>
                            <span className="text-xs text-zinc-500 font-mono">
                              / {product.id === 'prod-visiting-card-300gsm' ? 'card' : 'pc'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-zinc-600 font-bold bg-zinc-100 px-2 py-0.5 rounded font-mono">
                            Volume Rates
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {product.id === 'prod-rollup-standee' ? (
                      <div className="pt-1">
                        <a
                          href={getProductPath(product.slug || product.id)}
                          onClick={(e) => {
                            if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                              e.preventDefault();
                              onSelectProduct(product);
                            }
                          }}
                          className="w-full bg-[#FF7A00] hover:bg-[#e06c00] active:scale-98 text-white text-xs font-display font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <span>View Details</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <a
                          href={getProductPath(product.slug || product.id)}
                          onClick={(e) => {
                            if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                              e.preventDefault();
                              onCustomizeProduct(product.id);
                            }
                          }}
                          className="w-full bg-[#FF7A00] hover:bg-[#e06c00] text-white text-xs font-display font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Customize</span>
                        </a>

                        <a
                          href={getProductPath(product.slug || product.id)}
                          onClick={(e) => {
                            if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                              e.preventDefault();
                              onSelectProduct(product);
                            }
                          }}
                          className="w-full bg-[#0B0B0D] hover:bg-[#1f2026] text-white text-xs font-display font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <span>Details</span>
                          <ArrowRight className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Verified Category Specifications Guide & Internal Cross-Links */}
        <section
          aria-label={activeCategorySeo ? `${activeCategorySeo.name} Buying Guide` : 'Custom Printing Categories and Bulk Ordering'}
          className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-5"
        >
          <div className="space-y-1.5">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#0B1530] tracking-tight">
              {activeCategorySeo
                ? activeCategorySeo.guideHeading
                : 'Factory-Direct Custom Printing & Corporate Merchandise Across India'}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed max-w-3xl">
              {activeCategorySeo
                ? activeCategorySeo.intro
                : 'TeqqnoWorld supplies custom printed polo T-shirts, cotton caps, 325 ml ceramic mugs, 300 GSM visiting cards, rollup standees, promo tables, promotional umbrellas, and canopy kiosks with transparent INR slab pricing and 18% GST tax invoices.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(activeCategorySeo
              ? activeCategorySeo.highlights
              : [
                  {
                    title: 'Custom Polo T-Shirts & Cotton Caps',
                    detail: '230 GSM pure cotton plain & tipping polos, 220 GSM Mars COOLMAX, 230 GSM Fine Matty polos, and 6-colour cotton flexi caps.',
                  },
                  {
                    title: 'Ceramic Mugs & 300 GSM Visiting Cards',
                    detail: '325 ml glossy white promotional mugs (MOQ 5) and double-sided 92 × 52 mm smooth art paper visiting cards from 100 pcs.',
                  },
                  {
                    title: 'Event Displays & Outdoor Signage',
                    detail: '3×6 ft rollup standees, portable promo tables, 5×7 ft promotional umbrellas, and 4×4 ft or 8×8 ft canopy kiosks from 1 unit.',
                  },
                ]
            ).map((item) => (
              <div
                key={item.title}
                className="rounded-xl bg-[#FAF9FD] border border-slate-200/80 p-4 space-y-1"
              >
                <h3 className="font-display font-bold text-sm text-[#0B1530]">
                  {item.title}
                </h3>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-zinc-500 mr-1">
              {activeCategorySeo ? 'Explore Other Categories:' : 'Quick Category Links:'}
            </span>
            {SEO_CATEGORIES.filter((c) => c.slug !== activeCategorySeo?.slug).map((cat) => (
              <a
                key={cat.slug}
                href={`/category/${cat.slug}`}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    handleCategorySelect(cat.catalogCategory as ProductCategory);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-orange-50 text-zinc-700 hover:text-[#FF7900] border border-slate-200/90 hover:border-[#FF7900]/40 transition-colors font-medium"
              >
                {cat.name}
              </a>
            ))}
            <a
              href="/bulk"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  onNavigateRoute?.('bulk');
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-[#0B1530] hover:bg-[#14234a] text-white transition-colors font-medium"
            >
              Bulk Corporate Quote
            </a>
            <a
              href="/quote-calculator"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                  e.preventDefault();
                  if (onOpenQuoteCalculator) {
                    onOpenQuoteCalculator();
                  } else {
                    onNavigateRoute?.('quote-calculator');
                  }
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-[#FF7900] text-[#FF7900] hover:text-white border border-orange-200 transition-colors font-medium"
            >
              Bulk Quote Calculator
            </a>
          </div>
        </section>

      </div>
    </div>
  );
};
