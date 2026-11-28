import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { AnnouncementBar } from './components/AnnouncementBar';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { CategoriesSection } from './components/CategoriesSection';
import { FeaturedProducts } from './components/FeaturedProducts';
import { ClientReviewsSection } from './components/ClientReviewsSection';
import { CtaBanner } from './components/CtaBanner';
import { Footer } from './components/Footer';
import { ClientLogosSection } from './components/ClientLogosSection';
import { DelhiveryAreaModal } from './components/DelhiveryPincodeChecker';
import { CelebrationOverlay } from './components/CelebrationOverlay';
import { FestivalOffersBanner } from './components/FestivalOffersBanner';
import { triggerCelebration } from './services/celebrationService';
import { BUSINESS_CONFIG, getWhatsAppLink } from './config/business';

// Lazy-loaded heavy below-the-fold homepage sections, routes, modals & legal pages
const MockupEngineSection = lazy(() =>
  import('./components/MockupEngineSection').then((m) => ({ default: m.MockupEngineSection }))
);
const WorkflowSection = lazy(() =>
  import('./components/WorkflowSection').then((m) => ({ default: m.WorkflowSection }))
);
const OrderProcessingStepsSection = lazy(() =>
  import('./components/OrderProcessingStepsSection').then((m) => ({ default: m.OrderProcessingStepsSection }))
);
const BulkEnquirySection = lazy(() =>
  import('./components/BulkEnquirySection').then((m) => ({ default: m.BulkEnquirySection }))
);
const AdvantageSection = lazy(() =>
  import('./components/AdvantageSection').then((m) => ({ default: m.AdvantageSection }))
);
const FaqSection = lazy(() =>
  import('./components/FaqSection').then((m) => ({ default: m.FaqSection }))
);
const ProductCatalogView = lazy(() =>
  import('./components/ProductCatalogView').then((m) => ({ default: m.ProductCatalogView }))
);
const ProductDetailView = lazy(() =>
  import('./components/ProductDetailView').then((m) => ({ default: m.ProductDetailView }))
);
const CartDrawer = lazy(() =>
  import('./components/CartDrawer').then((m) => ({ default: m.CartDrawer }))
);
const WishlistDrawer = lazy(() =>
  import('./components/WishlistDrawer').then((m) => ({ default: m.WishlistDrawer }))
);
const CheckoutView = lazy(() =>
  import('./components/CheckoutView').then((m) => ({ default: m.CheckoutView }))
);
const OrderConfirmationView = lazy(() =>
  import('./components/OrderConfirmationView').then((m) => ({ default: m.OrderConfirmationView }))
);
const SearchModal = lazy(() =>
  import('./components/SearchModal').then((m) => ({ default: m.SearchModal }))
);
const AccountModal = lazy(() =>
  import('./components/AccountModal').then((m) => ({ default: m.AccountModal }))
);
const AuthModal = lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);
const CustomerDashboard = lazy(() =>
  import('./components/CustomerDashboard').then((m) => ({ default: m.CustomerDashboard }))
);
const BulkQuotationCalculator = lazy(() =>
  import('./components/BulkQuotationCalculator').then((m) => ({ default: m.BulkQuotationCalculator }))
);
const CorporateGiftBundleBuilder = lazy(() =>
  import('./components/CorporateGiftBundleBuilder').then((m) => ({ default: m.CorporateGiftBundleBuilder }))
);
const DownloadCatalogModal = lazy(() =>
  import('./components/DownloadCatalogModal').then((m) => ({ default: m.DownloadCatalogModal }))
);
const OrderTrackingModal = lazy(() =>
  import('./components/OrderTrackingModal').then((m) => ({ default: m.OrderTrackingModal }))
);
const SupabaseDevModal = lazy(() =>
  import('./components/SupabaseDevModal').then((m) => ({ default: m.SupabaseDevModal }))
);
const AdminHubView = lazy(() =>
  import('./components/AdminHubView').then((m) => ({ default: m.AdminHubView }))
);
const OrderActionView = lazy(() =>
  import('./components/OrderActionView').then((m) => ({ default: m.OrderActionView }))
);
const AffiliateLandingView = lazy(() =>
  import('./components/affiliate/AffiliateLandingView').then((m) => ({ default: m.AffiliateLandingView }))
);
const AffiliateDashboardView = lazy(() =>
  import('./components/affiliate/AffiliateDashboardView').then((m) => ({ default: m.AffiliateDashboardView }))
);
const AffiliateVerificationView = lazy(() =>
  import('./components/affiliate/AffiliateVerificationView').then((m) => ({ default: m.AffiliateVerificationView }))
);
const BlogResourceCenterView = lazy(() =>
  import('./components/blog/BlogResourceCenterView').then((m) => ({ default: m.BlogResourceCenterView }))
);
const BlogArticleDetailView = lazy(() =>
  import('./components/blog/BlogArticleDetailView').then((m) => ({ default: m.BlogArticleDetailView }))
);

// Legal & Policy Views (route-split)
const PrivacyPolicyView = lazy(() =>
  import('./components/legal/PrivacyPolicyView').then((m) => ({ default: m.PrivacyPolicyView }))
);
const TermsAndConditionsView = lazy(() =>
  import('./components/legal/TermsAndConditionsView').then((m) => ({ default: m.TermsAndConditionsView }))
);
const ShippingPolicyView = lazy(() =>
  import('./components/legal/ShippingPolicyView').then((m) => ({ default: m.ShippingPolicyView }))
);
const CancellationRefundPolicyView = lazy(() =>
  import('./components/legal/CancellationRefundPolicyView').then((m) => ({ default: m.CancellationRefundPolicyView }))
);
const ReturnReplacementPolicyView = lazy(() =>
  import('./components/legal/ReturnReplacementPolicyView').then((m) => ({ default: m.ReturnReplacementPolicyView }))
);
const ContactUsView = lazy(() =>
  import('./components/legal/ContactUsView').then((m) => ({ default: m.ContactUsView }))
);
const PaymentPolicyView = lazy(() =>
  import('./components/legal/PaymentPolicyView').then((m) => ({ default: m.PaymentPolicyView }))
);
const PricingTaxesView = lazy(() =>
  import('./components/legal/PricingTaxesView').then((m) => ({ default: m.PricingTaxesView }))
);
const CookiePolicyView = lazy(() =>
  import('./components/legal/CookiePolicyView').then((m) => ({ default: m.CookiePolicyView }))
);

const RouteLoadingFallback: React.FC = () => (
  <div className="min-h-[55vh] flex items-center justify-center bg-[#F4F2FA] px-4 py-16">
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="w-9 h-9 rounded-full border-3 border-zinc-200 border-t-[#FF7A00] animate-spin" aria-hidden="true" />
      <p className="text-xs font-medium text-zinc-600">Loading TeqqnoWorld...</p>
    </div>
  </div>
);

const MockupSectionFallback: React.FC = () => (
  <section aria-label="Live Product Mockup Studio" className="py-20 bg-[#111216] text-white border-b border-[#25262F]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="h-[520px] rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-[#FF7A00] animate-spin" aria-hidden="true" />
          <span className="text-xs text-zinc-300 font-medium">Loading Interactive Logo Studio...</span>
        </div>
      </div>
    </div>
  </section>
);

const DeferredSection: React.FC<{
  children: React.ReactNode;
  fallback: React.ReactNode;
  rootMargin?: string;
}> = ({ children, fallback, rootMargin = '750px 0px' }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender) return;
    const node = hostRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShouldRender(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldRender, rootMargin]);

  if (!shouldRender) {
    return <div ref={hostRef}>{fallback}</div>;
  }

  return <Suspense fallback={fallback}>{children}</Suspense>;
};

const BelowFoldPlaceholder: React.FC<{ heightClass?: string; dark?: boolean }> = ({
  heightClass = 'min-h-[420px]',
  dark = false,
}) => (
  <div
    aria-hidden="true"
    className={`${heightClass} ${dark ? 'bg-[#16171B] border-b border-[#2A2A30]' : 'bg-[#F4F2FA] border-b border-[#E5E5EA]'}`}
  />
);

import { PRODUCTS } from './data/mockData';
import { calculateProductPrice } from './data/pricingRules';
import { Product, ProductCategory, CartItem, Order, CustomArtwork, PrintMethod, UserProfile } from './types';
import { doesOrderBelongToUser, isLegacyMockOrder } from './components/customer/customerUtils';
import { ShieldCheck, Sparkles, Home, LayoutGrid, ShoppingBag, Package, ArrowRight } from 'lucide-react';
import { WhatsAppIcon } from './components/WhatsAppIcon';
import {
  DEFAULT_OG_IMAGE_ALT,
  SEO_AFFILIATE_PROGRAM_META,
  SEO_BLOGS_META,
  SEO_BULK_META,
  SEO_BUNDLE_BUILDER_META,
  SEO_CATALOG_META,
  SEO_GUIDES_META,
  SEO_HOME_META,
  SEO_LEGAL_PAGES,
  SEO_QUOTE_CALCULATOR_META,
  SEO_RESOURCES_META,
  VALID_LEGAL_PATHS,
  buildProductSeoDescription,
  buildProductSeoTitle,
  findCategoryByCatalogKey,
  findCategoryBySlugOrAlias,
  getBlogPath,
  getCategoryPath,
  getProductH1,
  getProductPath,
  getProductSocialImageUrl,
} from './config/seoRoutes';
import { applyDocumentSeo } from './utils/seoManager';
import {
  buildPageStructuredData,
  type StructuredDataProductInput,
} from './config/structuredData';
import type { BlogPost } from './types/blog';
import { getProductKeywordEntry } from './data/seoKeywordMap';
import {
  trackAddToCart,
  trackBeginCheckout,
  trackPageView,
  trackPurchaseOnce,
  trackSelectItem,
  trackViewItem,
  trackViewItemList,
  trackWhatsAppEnquiry,
} from './utils/analyticsTracker';
import { useReviewSummaries } from './context/ReviewSummaryContext';
import { attributeOrderToAffiliate, trackAffiliateClick } from './services/affiliateService';

interface ResolvedClientRoute {
  tab: string;
  product?: Product;
  category?: ProductCategory;
  searchQuery?: string;
  blogHubPath?: '/blogs' | '/guides' | '/resources';
  blogSlug?: string;
  orderAction?: {
    action: 'confirm' | 'cancel';
    orderId: string;
    orderNumber: string;
    token?: string;
  };
  recoveryCoupon?: boolean;
  affiliateVerifyCode?: string;
  openModal?: 'catalogues' | 'tracking';
  replaceUrl?: string;
  preserveAuthHash?: boolean;
}

function resolveClientRouteFromLocation(): ResolvedClientRoute {
  if (typeof window === 'undefined') {
    return { tab: 'home' };
  }

  const rawPath = window.location.pathname || '/';
  const normalizedPath = rawPath === '/' ? '/' : rawPath.replace(/\/+$/, '') || '/';
  const search = window.location.search || '';
  const searchParams = new URLSearchParams(search);
  const hash = window.location.hash || '';

  // Never interfere with Supabase OAuth / email verification / password recovery callbacks
  if (
    hash.includes('access_token=') ||
    hash.includes('type=signup') ||
    hash.includes('type=recovery')
  ) {
    return { tab: 'home', preserveAuthHash: true };
  }

  // 1. Legacy hash URLs -> safely migrate via history.replaceState to clean SEO paths
  if (hash && hash !== '#') {
    if (hash.startsWith('#order-action')) {
      const qIdx = hash.indexOf('?');
      const params = new URLSearchParams(qIdx !== -1 ? hash.slice(qIdx + 1) : '');
      const rawAct = params.get('action');
      return {
        tab: 'order-action',
        orderAction: {
          action: rawAct === 'cancel' ? 'cancel' : 'confirm',
          orderId: params.get('orderId') || '',
          orderNumber: params.get('orderNumber') || params.get('orderId') || '',
          token: params.get('token') || undefined,
        },
        replaceUrl: qIdx !== -1 ? `/order-action${hash.slice(qIdx)}` : '/order-action',
      };
    }

    if (hash.startsWith('#checkout')) {
      const qIdx = hash.indexOf('?');
      const qStr = qIdx !== -1 ? hash.slice(qIdx) : search;
      const params = new URLSearchParams(qStr.replace(/^\?/, ''));
      const coupon = params.get('coupon')?.trim().toUpperCase();
      return {
        tab: 'checkout',
        recoveryCoupon: coupon === 'SAVE5NOW' || coupon === 'TEQQNO5',
        replaceUrl: `/checkout${qStr}`,
      };
    }

    if (hash.startsWith('#product/')) {
      const rawSeg = hash.slice('#product/'.length).split('?')[0].replace(/\/+$/, '');
      let slugOrId = rawSeg;
      try {
        slugOrId = decodeURIComponent(rawSeg);
      } catch {
        // leave raw
      }
      const found = PRODUCTS.find(
        (p) =>
          p.slug.toLowerCase() === slugOrId.toLowerCase() ||
          p.id.toLowerCase() === slugOrId.toLowerCase()
      );
      if (found) {
        return {
          tab: 'product-detail',
          product: found,
          replaceUrl: getProductPath(found.slug),
        };
      }
      return { tab: 'not-found' };
    }

    if (hash.startsWith('#category/')) {
      const rawSeg = hash.slice('#category/'.length).split('?')[0].replace(/\/+$/, '');
      let slugOrAlias = rawSeg;
      try {
        slugOrAlias = decodeURIComponent(rawSeg);
      } catch {
        // leave raw
      }
      const cat = findCategoryBySlugOrAlias(slugOrAlias);
      if (cat) {
        return {
          tab: 'catalog',
          category: cat.catalogCategory as ProductCategory,
          replaceUrl: `/category/${cat.slug}`,
        };
      }
      return { tab: 'not-found' };
    }

    if (hash === '#admin' || hash === '#admin/') {
      return { tab: 'admin', replaceUrl: '/admin' };
    }

    for (const legalRoute of VALID_LEGAL_PATHS) {
      if (hash === `#${legalRoute}` || hash === `#${legalRoute.slice(1)}`) {
        return { tab: legalRoute, replaceUrl: legalRoute };
      }
    }

    if (hash === '#catalog' || hash.startsWith('#catalog?')) {
      const qIdx = hash.indexOf('?');
      const params = new URLSearchParams(qIdx !== -1 ? hash.slice(qIdx + 1) : '');
      const catParam = params.get('category');
      const qParam = params.get('q') || '';
      if (catParam) {
        const matchedCat = findCategoryBySlugOrAlias(catParam);
        if (matchedCat) {
          return {
            tab: 'catalog',
            category: matchedCat.catalogCategory as ProductCategory,
            searchQuery: qParam,
            replaceUrl: `/category/${matchedCat.slug}`,
          };
        }
      }
      return {
        tab: 'catalog',
        category: 'all',
        searchQuery: qParam,
        replaceUrl: qParam ? `/catalog?q=${encodeURIComponent(qParam)}` : '/catalog',
      };
    }

    if (hash === '#customizer') {
      return { tab: 'customizer' };
    }
    if (hash === '#bulk') {
      return { tab: 'bulk', replaceUrl: '/bulk' };
    }
    if (hash === '#orders') {
      return { tab: 'orders', replaceUrl: '/orders' };
    }
    if (hash === '#dashboard') {
      return { tab: 'dashboard', replaceUrl: '/dashboard' };
    }
    if (hash === '#quote-calculator') {
      return { tab: 'quote-calculator', replaceUrl: '/quote-calculator' };
    }
    if (hash === '#bundle-builder') {
      return { tab: 'bundle-builder', replaceUrl: '/bundle-builder' };
    }
    if (hash === '#catalogues') {
      return { tab: 'home', openModal: 'catalogues', replaceUrl: '/' };
    }
    if (hash === '#track' || hash === '#track-order') {
      return { tab: 'home', openModal: 'tracking', replaceUrl: '/' };
    }
  }

  // 2. Clean path-based SEO routes
  if (normalizedPath === '/') {
    return { tab: 'home' };
  }

  if (normalizedPath === '/admin' || normalizedPath.startsWith('/admin/')) {
    return { tab: 'admin' };
  }

  if (normalizedPath === '/dashboard' || normalizedPath.startsWith('/dashboard/')) {
    return { tab: 'dashboard' };
  }

  if (normalizedPath === '/checkout') {
    const coupon = searchParams.get('coupon')?.trim().toUpperCase();
    return {
      tab: 'checkout',
      recoveryCoupon: coupon === 'SAVE5NOW' || coupon === 'TEQQNO5',
    };
  }

  if (normalizedPath === '/orders') {
    return { tab: 'orders' };
  }

  if (normalizedPath === '/order-action') {
    const rawAct = searchParams.get('action');
    return {
      tab: 'order-action',
      orderAction: {
        action: rawAct === 'cancel' ? 'cancel' : 'confirm',
        orderId: searchParams.get('orderId') || '',
        orderNumber: searchParams.get('orderNumber') || searchParams.get('orderId') || '',
        token: searchParams.get('token') || undefined,
      },
    };
  }

  if (normalizedPath === '/catalog') {
    const catParam = searchParams.get('category');
    const qParam = searchParams.get('q') || '';
    if (catParam) {
      const matchedCat = findCategoryBySlugOrAlias(catParam);
      if (matchedCat) {
        return {
          tab: 'catalog',
          category: matchedCat.catalogCategory as ProductCategory,
          searchQuery: qParam,
        };
      }
    }
    return {
      tab: 'catalog',
      category: 'all',
      searchQuery: qParam,
    };
  }

  if (normalizedPath.startsWith('/category/')) {
    const rawSeg = normalizedPath.slice('/category/'.length);
    let slugOrAlias = rawSeg;
    try {
      slugOrAlias = decodeURIComponent(rawSeg);
    } catch {
      // invalid encoding falls through to 404
    }
    const matchedCat = findCategoryBySlugOrAlias(slugOrAlias);
    if (matchedCat) {
      const canonicalCatPath = `/category/${matchedCat.slug}`;
      return {
        tab: 'catalog',
        category: matchedCat.catalogCategory as ProductCategory,
        searchQuery: searchParams.get('q') || '',
        replaceUrl: normalizedPath !== canonicalCatPath ? `${canonicalCatPath}${search}` : undefined,
      };
    }
    return { tab: 'not-found' };
  }

  if (normalizedPath.startsWith('/product/')) {
    const rawSeg = normalizedPath.slice('/product/'.length);
    let slugOrId = rawSeg;
    try {
      slugOrId = decodeURIComponent(rawSeg);
    } catch {
      // invalid encoding falls through to 404
    }
    const found = PRODUCTS.find(
      (p) =>
        p.slug.toLowerCase() === slugOrId.toLowerCase() ||
        p.id.toLowerCase() === slugOrId.toLowerCase()
    );
    if (found) {
      const canonicalProdPath = getProductPath(found.slug);
      return {
        tab: 'product-detail',
        product: found,
        replaceUrl: normalizedPath !== canonicalProdPath ? `${canonicalProdPath}${search}` : undefined,
      };
    }
    return { tab: 'not-found' };
  }

  if (normalizedPath === '/bulk') {
    return { tab: 'bulk' };
  }

  if (normalizedPath === '/quote-calculator') {
    return { tab: 'quote-calculator' };
  }

  if (normalizedPath === '/bundle-builder') {
    return { tab: 'bundle-builder' };
  }

  if (normalizedPath === '/affiliate-program') {
    return { tab: 'affiliate-program' };
  }

  if (normalizedPath === '/affiliate-dashboard' || normalizedPath.startsWith('/affiliate-dashboard/')) {
    return { tab: 'affiliate-dashboard' };
  }

  if (normalizedPath.startsWith('/affiliate/verify/')) {
    const rawCode = normalizedPath.slice('/affiliate/verify/'.length);
    return {
      tab: 'affiliate-verify',
      affiliateVerifyCode: decodeURIComponent(rawCode || ''),
    };
  }

  if (normalizedPath === '/blog') {
    return { tab: 'blogs', blogHubPath: '/blogs', replaceUrl: '/blogs' };
  }

  if (normalizedPath === '/blogs' || normalizedPath === '/guides' || normalizedPath === '/resources') {
    return { tab: 'blogs', blogHubPath: normalizedPath };
  }

  if (normalizedPath.startsWith('/blogs/')) {
    const rawSeg = normalizedPath.slice('/blogs/'.length).replace(/\/+$/, '');
    let slug = rawSeg;
    try {
      slug = decodeURIComponent(rawSeg);
    } catch {
      // leave raw
    }
    if (slug && !slug.includes('/')) {
      return { tab: 'blog-detail', blogSlug: slug };
    }
    return { tab: 'not-found' };
  }

  if (VALID_LEGAL_PATHS.includes(normalizedPath)) {
    return { tab: normalizedPath };
  }

  return { tab: 'not-found' };
}

export default function App() {
  const initialRoute = resolveClientRouteFromLocation();
  const { summaries: reviewSummaries } = useReviewSummaries();

  // Navigation & View Routing (Clean SEO-friendly paths + safe legacy hash migration)
  const [currentTab, setCurrentTab] = useState<string>(initialRoute.tab);
  const [blogHubPath, setBlogHubPath] = useState<'/blogs' | '/guides' | '/resources'>(
    initialRoute.blogHubPath || '/blogs'
  );
  const [activeBlogSlug, setActiveBlogSlug] = useState<string>(initialRoute.blogSlug || '');
  const [activeBlogPost, setActiveBlogPost] = useState<BlogPost | null>(null);
  const [orderActionParams, setOrderActionParams] = useState<{
    action: 'confirm' | 'cancel';
    orderId: string;
    orderNumber: string;
    token?: string;
  } | null>(initialRoute.orderAction || null);
  const [selectedProduct, setSelectedProduct] = useState<Product>(
    initialRoute.product || PRODUCTS[0]
  );
  const [catalogCategory, setCatalogCategory] = useState<ProductCategory>(
    initialRoute.category || 'all'
  );
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>(
    initialRoute.searchQuery || ''
  );
  const [affiliateVerifyCode, setAffiliateVerifyCode] = useState<string>(
    initialRoute.affiliateVerifyCode || ''
  );
  const [customizerProductId, setCustomizerProductId] = useState<string>('prod-polo-01');

  // Authentication State (Persisted in localStorage; fresh visitors start logged out)
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('teqqno_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  // Overlays
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isWishlistOpen, setIsWishlistOpen] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Wishlist State (Persisted in localStorage)
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('teqqno_wishlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalNote, setAuthModalNote] = useState<string>('');
  const [isQuoteCalculatorOpen, setIsQuoteCalculatorOpen] = useState<boolean>(false);
  const [isBundleBuilderOpen, setIsBundleBuilderOpen] = useState<boolean>(false);
  const [isDownloadCatalogOpen, setIsDownloadCatalogOpen] = useState<boolean>(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState<boolean>(false);
  const [isSupabaseDevOpen, setIsSupabaseDevOpen] = useState<boolean>(false);
  const [isDeliveryCheckOpen, setIsDeliveryCheckOpen] = useState<boolean>(false);


  // Cart State (Persisted in localStorage; clean empty cart for new visitors)
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('teqqno_cart');
      if (saved) {
        const parsed: CartItem[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((item) => item?.id !== 'initial-sample-polo');
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Orders State (Persisted in localStorage; never pre-seeded with fake mock orders)
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem('teqqno_orders');
      if (saved) {
        const parsed: Order[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((o) => !isLegacyMockOrder(o))
            .map((o) => ({
              ...o,
              courierPartner:
                o.courierPartner && /bluedart|blue\s*dart/i.test(o.courierPartner)
                  ? 'Delhivery Express'
                  : o.courierPartner,
              trackingNumber:
                o.trackingNumber === 'BD-AIR-8920194812'
                  ? 'DLV-EXP-8920194812'
                  : o.trackingNumber,
            }));
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [activeOrder, setActiveOrder] = useState<Order | null>(() => orders[0] || null);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('teqqno_cart', JSON.stringify(cartItems));
    } catch (e) {
      console.error(e);
    }
  }, [cartItems]);

  useEffect(() => {
    try {
      localStorage.setItem('teqqno_orders', JSON.stringify(orders));
    } catch (e) {
      console.error(e);
    }
  }, [orders]);

  useEffect(() => {
    try {
      localStorage.setItem('teqqno_wishlist', JSON.stringify(wishlistIds));
    } catch (e) {
      console.error(e);
    }
  }, [wishlistIds]);

  // Handle Supabase email confirmation & Google OAuth redirects (#access_token=... or ?code=...) cleanly
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    const searchParams = new URLSearchParams(window.location.search || '');
    const oauthCode = searchParams.get('code');
    const hasAuthHash =
      hash.includes('access_token=') ||
      hash.includes('type=signup') ||
      hash.includes('type=recovery');

    if (!hasAuthHash && !oauthCode) {
      return;
    }

    // Defensive popup guard: if an iframe popup ever landed on root instead of /auth/google-callback,
    // relay tokens back to the same-origin opener and close the popup immediately.
    if (window.name === 'teqqno_google_oauth' && window.opener && !window.opener.closed) {
      try {
        const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
        window.opener.postMessage(
          {
            type: 'TEQQNO_GOOGLE_AUTH',
            access_token: hashParams.get('access_token') || '',
            refresh_token: hashParams.get('refresh_token') || '',
            code: oauthCode || '',
            error:
              searchParams.get('error_description') ||
              hashParams.get('error_description') ||
              '',
          },
          window.location.origin
        );
        window.close();
        return;
      } catch {
        // Different origin fallback — proceed normally
      }
    }

    const resolveSession = async () => {
      try {
        const { supabase } = await import('./lib/supabase');
        if (oauthCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(oauthCode);
          if (exchangeError) return;
        }
        const { data } = await supabase.auth.getSession();
        const authUser = data?.session?.user;
        if (!authUser) return;

        const meta = authUser.user_metadata || {};
        let cached: Partial<UserProfile> | null = null;
        try {
          const raw = localStorage.getItem(`teqqno_user_profile_${authUser.id}`);
          if (raw) cached = JSON.parse(raw);
        } catch {
          cached = null;
        }

        const resolvedCompany =
          cached?.companyName ??
          (meta.company && meta.company !== 'Direct B2B Client' ? meta.company : '');
        const fullName =
          cached?.name ||
          meta.full_name ||
          meta.name ||
          `${meta.first_name || ''} ${meta.last_name || ''}`.trim() ||
          (authUser.email ? authUser.email.split('@')[0] : 'Customer');

        const verifiedProfile: UserProfile = {
          id: authUser.id,
          name: fullName,
          email: authUser.email || cached?.email || '',
          mobile: cached?.mobile || meta.phone || '',
          companyName: resolvedCompany || undefined,
          gstin: cached?.gstin,
          avatarUrl: cached?.avatarUrl || meta.avatar_url || meta.picture || undefined,
          accountType: cached?.accountType || (resolvedCompany ? 'business' : 'individual'),
          role: resolvedCompany ? 'Corporate Admin' : 'Individual Shopper',
          isVerified: true,
          createdAt:
            cached?.createdAt ||
            authUser.created_at?.split('T')[0] ||
            new Date().toISOString().split('T')[0],
          savedAddresses: Array.isArray(cached?.savedAddresses) ? cached.savedAddresses : [],
        };

        // Send Welcome email once if this is a brand-new Google OAuth signup
        const createdMs = authUser.created_at ? new Date(authUser.created_at).getTime() : 0;
        const welcomeFlagKey = `teqqno_welcome_sent_${authUser.id}`;
        const alreadySent = localStorage.getItem(welcomeFlagKey) === '1';
        if (!alreadySent && createdMs > 0 && Date.now() - createdMs < 120 * 1000 && verifiedProfile.email) {
          localStorage.setItem(welcomeFlagKey, '1');
          const nameParts = fullName.trim().split(/\s+/);
          import('./services/emailService')
            .then(({ sendRegistrationEmails }) =>
              sendRegistrationEmails({
                userId: verifiedProfile.id,
                firstName: nameParts[0] || fullName,
                lastName: nameParts.slice(1).join(' ') || '',
                fullName,
                email: verifiedProfile.email,
                phone: verifiedProfile.mobile || '',
                accountType: verifiedProfile.accountType || 'individual',
                registeredAt: new Date().toISOString(),
              })
            )
            .catch(() => {});
        }

        setUser(verifiedProfile);
        if (!hash.includes('type=recovery')) {
          triggerCelebration({
            level: 'subtle',
            sound: 'pop',
            eventKey: `auth-session:${verifiedProfile.id}`,
            dedupeWindowMs: 12000,
            action: 'customer_login',
          });
        }
        try {
          localStorage.setItem('teqqno_user', JSON.stringify(verifiedProfile));
          localStorage.setItem(
            `teqqno_user_profile_${verifiedProfile.id}`,
            JSON.stringify(verifiedProfile)
          );
          window.history.replaceState(null, '', '/dashboard');
        } catch {
          // ignore
        }
        setCurrentTab('dashboard');
      } catch {
        // ignore failed redirect parse
      }
    };

    void resolveSession();
  }, []);

  // Scroll to top on tab change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);

  // Synchronize clean browser paths, popstate/hashchange navigation, and safe legacy hash migration
  useEffect(() => {
    const syncLocationToState = () => {
      const resolved = resolveClientRouteFromLocation();
      if (resolved.preserveAuthHash) {
        return;
      }

      if (resolved.replaceUrl) {
        try {
          window.history.replaceState(null, '', resolved.replaceUrl);
        } catch {
          // ignore restricted history environments
        }
      }

      if (resolved.product) {
        setSelectedProduct(resolved.product);
      }
      if (resolved.category !== undefined) {
        setCatalogCategory(resolved.category);
      }
      if (resolved.searchQuery !== undefined) {
        setCatalogSearchQuery(resolved.searchQuery);
      }
      if (resolved.orderAction) {
        setOrderActionParams(resolved.orderAction);
      }
      if (resolved.affiliateVerifyCode !== undefined) {
        setAffiliateVerifyCode(resolved.affiliateVerifyCode);
      }
      if (resolved.blogHubPath) {
        setBlogHubPath(resolved.blogHubPath);
      }
      if (resolved.blogSlug !== undefined) {
        setActiveBlogSlug(resolved.blogSlug);
      }
      if (resolved.recoveryCoupon) {
        import('./services/aisensyService')
          .then(({ activateRecoveryCoupon }) =>
            activateRecoveryCoupon({
              triggerReason: 'whatsapp_recovery_link',
              validMinutes: 15,
              autoApply: true,
            })
          )
          .catch(() => {});
      }
      if (resolved.openModal === 'catalogues') {
        setIsDownloadCatalogOpen(true);
      } else if (resolved.openModal === 'tracking') {
        setIsTrackingModalOpen(true);
      }

      setCurrentTab(resolved.tab);
    };

    syncLocationToState();
    window.addEventListener('popstate', syncLocationToState);
    window.addEventListener('hashchange', syncLocationToState);
    return () => {
      window.removeEventListener('popstate', syncLocationToState);
      window.removeEventListener('hashchange', syncLocationToState);
    };
  }, []);

  // Dynamically synchronize <title>, meta description, canonical, robots, OpenGraph, Twitter, and JSON-LD
  useEffect(() => {
    const noindexRobots = 'noindex, nofollow';
    const toStructuredProduct = (p: Product): StructuredDataProductInput => {
      const liveSummary = reviewSummaries[p.id];
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        category: p.category,
        productType: p.productType,
        basePrice: p.basePrice,
        moq: p.moq,
        imageUrl: p.colors?.[0]?.imageFront,
        ...(liveSummary && liveSummary.totalReviews > 0 && liveSummary.averageRating > 0
          ? {
              verifiedReviewAggregate: {
                ratingValue: liveSummary.averageRating,
                reviewCount: liveSummary.totalReviews,
              },
            }
          : {}),
      };
    };

    if (currentTab === 'product-detail' && selectedProduct) {
      const cleanProductH1 = getProductH1(selectedProduct.id, selectedProduct.name);
      const productSeoEntry = getProductKeywordEntry(selectedProduct.id);
      const productTitle = buildProductSeoTitle(selectedProduct.id, selectedProduct.name);
      const productDescription = buildProductSeoDescription({
        productId: selectedProduct.id,
        name: selectedProduct.name,
        description: selectedProduct.shortDesc || selectedProduct.description,
        priceInr: selectedProduct.basePrice,
        moq: selectedProduct.moq,
      });
      applyDocumentSeo({
        title: productTitle,
        description: productDescription,
        canonicalPath: getProductPath(selectedProduct.slug),
        ogType: 'product',
        imageUrl: getProductSocialImageUrl(
          selectedProduct.id,
          selectedProduct.colors?.[0]?.imageFront
        ),
        imageAlt: productSeoEntry?.cardImageAlt || cleanProductH1,
        structuredData: buildPageStructuredData({
          kind: 'product',
          product: toStructuredProduct(selectedProduct),
          title: productTitle,
          metaDescription: productDescription,
        }),
      });
      const productPagePath = getProductPath(selectedProduct.slug);
      trackPageView({ pagePath: productPagePath, pageTitle: productTitle });
      trackViewItem({
        productId: selectedProduct.id,
        productName: cleanProductH1,
        categorySlug: productSeoEntry?.categorySlug || selectedProduct.category,
        priceInr: selectedProduct.basePrice,
        pagePath: productPagePath,
      });
      return;
    }

    if (currentTab === 'catalog') {
      const structuredCatalogProducts = PRODUCTS.map(toStructuredProduct);
      const matchedCat =
        catalogCategory && catalogCategory !== 'all'
          ? findCategoryByCatalogKey(catalogCategory)
          : undefined;
      if (matchedCat) {
        applyDocumentSeo({
          title: matchedCat.title,
          description: matchedCat.description,
          canonicalPath: `/category/${matchedCat.slug}`,
          imageUrl: matchedCat.image,
          imageAlt: matchedCat.h1,
          structuredData: buildPageStructuredData({
            kind: 'category',
            category: matchedCat,
            products: structuredCatalogProducts,
          }),
        });
        trackPageView({
          pagePath: `/category/${matchedCat.slug}`,
          pageTitle: matchedCat.title,
          categorySlug: matchedCat.slug,
        });
        trackViewItemList({
          listName: matchedCat.name,
          categorySlug: matchedCat.slug,
          pagePath: `/category/${matchedCat.slug}`,
          items: PRODUCTS.filter((p) => p.category === matchedCat.catalogCategory).map((p) => ({
            item_id: p.id,
            item_name: getProductH1(p.id, p.name),
            item_category: matchedCat.slug,
            price: p.basePrice,
          })),
        });
      } else {
        applyDocumentSeo({
          title: SEO_CATALOG_META.title,
          description: SEO_CATALOG_META.description,
          canonicalPath: '/catalog',
          imageAlt: SEO_CATALOG_META.h1,
          structuredData: buildPageStructuredData({
            kind: 'catalog',
            products: structuredCatalogProducts,
          }),
        });
        trackPageView({ pagePath: '/catalog', pageTitle: SEO_CATALOG_META.title });
        trackViewItemList({
          listName: 'All Custom Printed Products',
          pagePath: '/catalog',
          items: PRODUCTS.map((p) => ({
            item_id: p.id,
            item_name: getProductH1(p.id, p.name),
            item_category: p.category,
            price: p.basePrice,
          })),
        });
      }
      return;
    }

    if (currentTab === 'bulk') {
      applyDocumentSeo({
        title: SEO_BULK_META.title,
        description: SEO_BULK_META.description,
        canonicalPath: '/bulk',
        imageAlt: SEO_BULK_META.h1,
        structuredData: buildPageStructuredData({
          kind: 'static',
          path: '/bulk',
          title: SEO_BULK_META.title,
          description: SEO_BULK_META.description,
          h1: SEO_BULK_META.h1,
        }),
      });
      return;
    }

    if (currentTab === 'quote-calculator') {
      applyDocumentSeo({
        title: SEO_QUOTE_CALCULATOR_META.title,
        description: SEO_QUOTE_CALCULATOR_META.description,
        canonicalPath: '/quote-calculator',
        imageAlt: SEO_QUOTE_CALCULATOR_META.h1,
        structuredData: buildPageStructuredData({
          kind: 'static',
          path: '/quote-calculator',
          title: SEO_QUOTE_CALCULATOR_META.title,
          description: SEO_QUOTE_CALCULATOR_META.description,
          h1: SEO_QUOTE_CALCULATOR_META.h1,
        }),
      });
      return;
    }

    if (currentTab === 'bundle-builder') {
      applyDocumentSeo({
        title: SEO_BUNDLE_BUILDER_META.title,
        description: SEO_BUNDLE_BUILDER_META.description,
        canonicalPath: '/bundle-builder',
        imageAlt: SEO_BUNDLE_BUILDER_META.h1,
        structuredData: buildPageStructuredData({
          kind: 'static',
          path: '/bundle-builder',
          title: SEO_BUNDLE_BUILDER_META.title,
          description: SEO_BUNDLE_BUILDER_META.description,
          h1: SEO_BUNDLE_BUILDER_META.h1,
        }),
      });
      return;
    }

    const legalMeta = SEO_LEGAL_PAGES.find(
      (p) => p.path === currentTab || p.path === `/${currentTab}`
    );
    if (legalMeta) {
      applyDocumentSeo({
        title: legalMeta.title,
        description: legalMeta.description,
        canonicalPath: legalMeta.path,
        imageAlt: legalMeta.h1,
        structuredData: buildPageStructuredData({
          kind: 'static',
          path: legalMeta.path,
          title: legalMeta.title,
          description: legalMeta.description,
          h1: legalMeta.h1,
        }),
      });
      return;
    }

    if (currentTab === 'affiliate-program') {
      applyDocumentSeo({
        title: SEO_AFFILIATE_PROGRAM_META.title,
        description: SEO_AFFILIATE_PROGRAM_META.description,
        canonicalPath: '/affiliate-program',
        imageAlt: SEO_AFFILIATE_PROGRAM_META.h1,
        structuredData: buildPageStructuredData({
          kind: 'static',
          path: '/affiliate-program',
          title: SEO_AFFILIATE_PROGRAM_META.title,
          description: SEO_AFFILIATE_PROGRAM_META.description,
          h1: SEO_AFFILIATE_PROGRAM_META.h1,
        }),
      });
      return;
    }

    if (
      currentTab === 'admin' ||
      currentTab === 'dashboard' ||
      currentTab === 'affiliate-dashboard' ||
      currentTab === 'affiliate-verify' ||
      currentTab === 'checkout' ||
      currentTab === 'orders' ||
      currentTab === 'order-action'
    ) {
      const privateTitles: Record<string, string> = {
        admin: 'Admin Portal | TeqqnoWorld',
        dashboard: 'Customer Dashboard | TeqqnoWorld',
        'affiliate-dashboard': 'Affiliate Partner Dashboard | TeqqnoWorld',
        'affiliate-verify': 'Affiliate Partner Verification | TeqqnoWorld',
        checkout: 'Checkout | TeqqnoWorld',
        orders: 'Orders & Tracking | TeqqnoWorld',
        'order-action': 'Order Confirmation | TeqqnoWorld',
      };
      applyDocumentSeo({
        title: privateTitles[currentTab] || 'Account | TeqqnoWorld',
        description: 'TeqqnoWorld account, partner, and order management portal.',
        canonicalPath: `/${currentTab}`,
        robots: noindexRobots,
        imageAlt: 'TeqqnoWorld',
        structuredData: buildPageStructuredData({ kind: 'private-or-error' }),
      });
      return;
    }

    if (currentTab === 'not-found') {
      applyDocumentSeo({
        title: 'Page Not Found (404) | TeqqnoWorld',
        description:
          'The requested page could not be found on TeqqnoWorld. Browse our custom printed corporate merchandise and promotional products catalog.',
        canonicalPath:
          typeof window !== 'undefined' ? window.location.pathname || '/404' : '/404',
        robots: noindexRobots,
        imageAlt: 'TeqqnoWorld',
        structuredData: buildPageStructuredData({ kind: 'private-or-error' }),
      });
      return;
    }

    if (currentTab === 'blogs') {
      const meta =
        blogHubPath === '/guides'
          ? SEO_GUIDES_META
          : blogHubPath === '/resources'
            ? SEO_RESOURCES_META
            : SEO_BLOGS_META;
      applyDocumentSeo({
        title: meta.title,
        description: meta.description,
        canonicalPath: blogHubPath,
        imageAlt: meta.h1,
        structuredData: buildPageStructuredData({
          kind: 'blog-list',
          path: blogHubPath,
          title: meta.title,
          description: meta.description,
          h1: meta.h1,
          posts: [],
        }),
      });
      trackPageView({ pagePath: blogHubPath, pageTitle: meta.title });
      return;
    }

    if (currentTab === 'blog-detail') {
      if (activeBlogPost && activeBlogPost.slug === activeBlogSlug) {
        const artTitle = activeBlogPost.seoTitle || `${activeBlogPost.title} | TeqqnoWorld`;
        const artDesc = activeBlogPost.metaDescription || activeBlogPost.excerpt;
        const artPath = getBlogPath(activeBlogPost.slug);
        applyDocumentSeo({
          title: artTitle,
          description: artDesc,
          canonicalPath: activeBlogPost.canonicalUrl || artPath,
          ogType: 'article',
          imageUrl: activeBlogPost.featuredImageUrl || undefined,
          imageAlt: activeBlogPost.featuredImageAlt || activeBlogPost.title,
          structuredData: buildPageStructuredData({
            kind: 'blog-post',
            post: activeBlogPost,
          }),
        });
      }
      return;
    }

    // Default: Homepage (or customizer section on homepage)
    applyDocumentSeo({
      title: SEO_HOME_META.title,
      description: SEO_HOME_META.description,
      canonicalPath: '/',
      imageAlt: DEFAULT_OG_IMAGE_ALT,
      structuredData: buildPageStructuredData({ kind: 'home' }),
    });
  }, [
    currentTab,
    selectedProduct,
    catalogCategory,
    reviewSummaries,
    blogHubPath,
    activeBlogSlug,
    activeBlogPost,
  ]);

  // Helper to safely push clean path URLs
  const pushCleanUrl = (targetPath: string) => {
    try {
      if (window.location.pathname + window.location.search !== targetPath || window.location.hash) {
        window.history.pushState(null, '', targetPath);
      }
    } catch {
      // ignore restricted history environments
    }
  };

  // Navigation handlers
  const handleNavigate = (tabOrRoute: string) => {
    const cleanInput = tabOrRoute.trim();
    const normalized = cleanInput.startsWith('/') ? cleanInput : `/${cleanInput}`;

    if (VALID_LEGAL_PATHS.includes(normalized)) {
      pushCleanUrl(normalized);
      setCurrentTab(normalized);
      return;
    }

    if (normalized.startsWith('/category/')) {
      const slugOrAlias = decodeURIComponent(normalized.slice('/category/'.length));
      handleSelectCategory(slugOrAlias);
      return;
    }

    if (normalized.startsWith('/product/')) {
      const slugOrId = decodeURIComponent(normalized.slice('/product/'.length));
      const found = PRODUCTS.find(
        (p) => p.slug.toLowerCase() === slugOrId.toLowerCase() || p.id.toLowerCase() === slugOrId.toLowerCase()
      );
      if (found) {
        handleSelectProduct(found);
      } else {
        pushCleanUrl(normalized);
        setCurrentTab('not-found');
      }
      return;
    }

    if (cleanInput === 'home' || cleanInput === '/') {
      pushCleanUrl('/');
      setCurrentTab('home');
      return;
    }

    if (cleanInput === 'catalog' || cleanInput === '/catalog') {
      setCatalogCategory('all');
      setCatalogSearchQuery('');
      pushCleanUrl('/catalog');
      setCurrentTab('catalog');
      return;
    }

    if (cleanInput === 'customizer') {
      if (currentTab !== 'home') {
        pushCleanUrl('/');
        setCurrentTab('home');
        setTimeout(() => {
          document.getElementById('customizer-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      } else {
        document.getElementById('customizer-section')?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (cleanInput === 'quote-calculator' || cleanInput === '/quote-calculator') {
      pushCleanUrl('/quote-calculator');
      setCurrentTab('quote-calculator');
      return;
    }

    if (cleanInput === 'bundle-builder' || cleanInput === '/bundle-builder') {
      pushCleanUrl('/bundle-builder');
      setCurrentTab('bundle-builder');
      return;
    }

    if (cleanInput === 'catalogues') {
      setIsDownloadCatalogOpen(true);
      return;
    }

    if (cleanInput === 'track-order' || cleanInput === 'track') {
      setIsTrackingModalOpen(true);
      return;
    }

    if (cleanInput === 'admin' || cleanInput === '/admin' || cleanInput === '#admin') {
      pushCleanUrl('/admin');
      setCurrentTab('admin');
      return;
    }

    if (cleanInput === 'bulk' || cleanInput === '/bulk') {
      pushCleanUrl('/bulk');
      setCurrentTab('bulk');
      return;
    }

    if (cleanInput === 'dashboard' || cleanInput === '/dashboard') {
      pushCleanUrl('/dashboard');
      setCurrentTab('dashboard');
      return;
    }

    if (cleanInput === 'affiliate-program' || cleanInput === '/affiliate-program') {
      pushCleanUrl('/affiliate-program');
      setCurrentTab('affiliate-program');
      return;
    }

    if (cleanInput === 'affiliate-dashboard' || cleanInput === '/affiliate-dashboard') {
      pushCleanUrl('/affiliate-dashboard');
      setCurrentTab('affiliate-dashboard');
      return;
    }

    if (normalized.startsWith('/affiliate/verify/')) {
      const code = decodeURIComponent(normalized.slice('/affiliate/verify/'.length));
      setAffiliateVerifyCode(code);
      pushCleanUrl(`/affiliate/verify/${encodeURIComponent(code)}`);
      setCurrentTab('affiliate-verify');
      return;
    }

    if (cleanInput === 'checkout' || cleanInput === '/checkout') {
      pushCleanUrl('/checkout');
      setCurrentTab('checkout');
      return;
    }

    if (cleanInput === 'blogs' || cleanInput === '/blogs' || cleanInput === '/blog') {
      setBlogHubPath('/blogs');
      pushCleanUrl('/blogs');
      setCurrentTab('blogs');
      return;
    }

    if (cleanInput === 'guides' || cleanInput === '/guides') {
      setBlogHubPath('/guides');
      pushCleanUrl('/guides');
      setCurrentTab('blogs');
      return;
    }

    if (cleanInput === 'resources' || cleanInput === '/resources') {
      setBlogHubPath('/resources');
      pushCleanUrl('/resources');
      setCurrentTab('blogs');
      return;
    }

    if (normalized.startsWith('/blogs/')) {
      const slug = decodeURIComponent(normalized.slice('/blogs/'.length).replace(/\/+$/, ''));
      if (slug && !slug.includes('/')) {
        setActiveBlogSlug(slug);
        setActiveBlogPost(null);
        pushCleanUrl(getBlogPath(slug));
        setCurrentTab('blog-detail');
      } else {
        pushCleanUrl(normalized);
        setCurrentTab('not-found');
      }
      return;
    }

    if (cleanInput === 'orders' || cleanInput === '/orders') {
      pushCleanUrl('/orders');
      setCurrentTab('orders');
      return;
    }

    pushCleanUrl(normalized);
    setCurrentTab(cleanInput);
  };

  const handleSelectProduct = (product: Product) => {
    trackSelectItem({
      listName: currentTab === 'catalog' ? 'Catalog Grid' : 'Storefront Showcase',
      productId: product.id,
      productName: getProductH1(product.id, product.name),
      categorySlug: product.category,
      priceInr: product.basePrice,
    });
    setSelectedProduct(product);
    setCurrentTab('product-detail');
    pushCleanUrl(getProductPath(product.slug || product.id));
  };

  const handleCustomizeProduct = (productId: string) => {
    const prod = PRODUCTS.find(p => p.id === productId || p.slug === productId) || PRODUCTS[0];
    setSelectedProduct(prod);
    setCustomizerProductId(prod.id);
    setCurrentTab('product-detail');
    pushCleanUrl(getProductPath(prod.slug || prod.id));
  };

  const handleSelectCategory = (categoryId: string) => {
    let targetCategory: ProductCategory = 'all';
    const matchedSeoCat = findCategoryBySlugOrAlias(categoryId);
    if (matchedSeoCat) {
      targetCategory = matchedSeoCat.catalogCategory as ProductCategory;
    } else if (categoryId === 'all') {
      targetCategory = 'all';
    } else {
      targetCategory = categoryId as ProductCategory;
    }
    setCatalogCategory(targetCategory);
    setCatalogSearchQuery('');
    setCurrentTab('catalog');
    pushCleanUrl(getCategoryPath(targetCategory));
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignore
    }
  };

  const handleQuickAddProduct = (product: Product) => {
    const defaultQty = product.moq || 2;
    const pricing = calculateProductPrice(product.id, defaultQty);

    const newItem: CartItem = {
      id: `cart-${product.id}-${Date.now()}`,
      product,
      color: product.colors[0],
      size: product.sizes ? product.sizes[0] : undefined,
      quantity: defaultQty,
      unitPrice: pricing.unitPrice,
      totalPrice: pricing.totalPrice,
      printMethod: product.printMethods[0],
      printPlacement: product.productType === 'polo' ? 'Left Chest' : 'Center Chest',
      artwork: {
        type: 'preset',
        presetId: 'your-logo',
        text: 'YOUR LOGO HERE',
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0
      }
    };
    handleAddToCart(newItem);
  };

  const handleAddToCart = (newItem: CartItem) => {
    setCartItems(prev => {
      const existingIdx = prev.findIndex(item => 
        item.product.id === newItem.product.id &&
        item.color.name === newItem.color.name &&
        item.size === newItem.size &&
        item.printMethod === newItem.printMethod &&
        item.printPlacement === newItem.printPlacement
      );

      if (existingIdx > -1) {
        const updated = [...prev];
        const newQty = updated[existingIdx].quantity + newItem.quantity;
        const pricing = calculateProductPrice(newItem.product.id, newQty, newItem.size);
        updated[existingIdx].quantity = newQty;
        updated[existingIdx].unitPrice = pricing.unitPrice;
        updated[existingIdx].totalPrice = pricing.totalPrice;
        return updated;
      }
      return [newItem, ...prev];
    });
    setIsCartOpen(true);
    trackAddToCart({
      productId: newItem.product.id,
      productName: getProductH1(newItem.product.id, newItem.product.name),
      categorySlug: newItem.product.category,
      unitPriceInr: newItem.unitPrice,
      quantity: newItem.quantity,
      totalPriceInr: newItem.totalPrice,
    });
    triggerCelebration({
      level: 'premium',
      sound: 'celebration',
      eventKey: `add-to-cart:${newItem.id}`,
      dedupeWindowMs: 1200,
      action: 'add_to_cart',
    });
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setCartItems(prev => prev.map(item => {
      if (item.id === id) {
        const minAllowed = item.product.moq || 1;
        const newQty = Math.max(minAllowed, item.quantity + delta);
        const pricing = calculateProductPrice(item.product.id, newQty, item.size);
        return {
          ...item,
          quantity: newQty,
          unitPrice: pricing.unitPrice,
          totalPrice: pricing.totalPrice
        };
      }
      return item;
    }));
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    trackBeginCheckout({
      valueInr: cartItems.reduce((sum, i) => sum + i.totalPrice, 0),
      items: cartItems.map((i) => ({
        item_id: i.product.id,
        item_name: getProductH1(i.product.id, i.product.name),
        item_category: i.product.category,
        price: i.unitPrice,
        quantity: i.quantity,
      })),
    });
    handleNavigate('checkout');
  };

  // Capture ?ref=<TOKEN> on any landing URL for last-click server attribution
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const refToken = params.get('ref')?.trim();
    if (!refToken) return;
    const pathname = window.location.pathname || '/';
    const matchedProd = pathname.startsWith('/product/')
      ? PRODUCTS.find(
          (p) =>
            p.slug.toLowerCase() ===
            decodeURIComponent(pathname.slice('/product/'.length)).toLowerCase()
        )
      : undefined;
    const utmSource = params.get('utm_source') || (document.referrer ? new URL(document.referrer).hostname : 'direct');
    const utmCampaign = params.get('utm_campaign') || undefined;
    void trackAffiliateClick({
      ref: refToken,
      landingPath: pathname,
      productId: matchedProd?.id,
      productSlug: matchedProd?.slug,
      trafficSource: utmSource,
      campaign: utmCampaign,
      customerEmail: user?.email,
      customerUserId: user?.id,
    });
  }, [user?.email, user?.id]);

  const handleOrderPlaced = (newOrder: Order) => {
    setOrders(prev => [newOrder, ...prev]);
    setActiveOrder(newOrder);
    setCartItems([]);

    // Non-blocking server-authoritative affiliate order attribution (GST-inclusive discounted product amount, shipping excluded)
    if (newOrder.items && newOrder.items.length > 0) {
      const itemsSubtotal = newOrder.items.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0
      );
      const gstRatio = itemsSubtotal > 0 ? newOrder.gstAmount / itemsSubtotal : 0.18;
      const shippingFee = Number(newOrder.shippingFee || 0);
      const couponDiscount = Math.max(
        0,
        newOrder.subtotal + newOrder.gstAmount + shippingFee - newOrder.total
      );
      void attributeOrderToAffiliate({
        orderId: newOrder.id,
        orderNumber: newOrder.orderNumber,
        customerEmail: newOrder.shippingAddress?.email || user?.email,
        customerMobile: newOrder.shippingAddress?.phone || user?.mobile,
        customerUserId: user?.id,
        shippingInr: shippingFee,
        items: newOrder.items.map((item, idx) => {
          const lineBase = item.unitPrice * item.quantity;
          const grossGstIncl = lineBase * (1 + gstRatio);
          const lineShare = itemsSubtotal > 0 ? lineBase / itemsSubtotal : 0;
          const lineDiscount = couponDiscount * lineShare;
          const eligibleGstInclDiscounted = Math.max(0, grossGstIncl - lineDiscount);
          return {
            orderItemId: item.id || `${newOrder.id}-item-${idx + 1}`,
            productId: item.product.id,
            quantity: item.quantity,
            grossGstInclusiveInr: Math.round(grossGstIncl * 100) / 100,
            discountInr: Math.round(lineDiscount * 100) / 100,
            gstInclusiveDiscountedAmountInr:
              Math.round(eligibleGstInclDiscounted * 100) / 100,
          };
        }),
      });
    }

    // Non-PII GA4 purchase event + first-party attribution (deduplicated per transaction_id)
    trackPurchaseOnce({
      transactionId: newOrder.orderNumber || newOrder.id,
      valueInr: Number(newOrder.total || 0),
      taxInr: Number(newOrder.gstAmount || 0),
      shippingInr: Number(newOrder.shippingFee || 0),
      items: (newOrder.items || []).map((item) => ({
        item_id: item.product.id,
        item_name: getProductH1(item.product.id, item.product.name),
        item_category: item.product.category,
        price: item.unitPrice,
        quantity: item.quantity,
      })),
    });

    triggerCelebration({
      level: 'grand',
      sound: 'grand',
      eventKey: `order-placed:${newOrder.id}`,
      dedupeWindowMs: 30000,
      action: 'order_placed',
    });

    handleNavigate('orders');
  };

  const handleUpdateOrder = (updatedOrder: Order) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setActiveOrder(updatedOrder);
  };

  // Auth Handlers
  const handleLoginSuccess = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    const matchingOrders = orders.filter((o) => doesOrderBelongToUser(o, loggedInUser));
    setActiveOrder(matchingOrders[0] || null);
    try {
      localStorage.setItem('teqqno_user', JSON.stringify(loggedInUser));
      localStorage.setItem(`teqqno_user_profile_${loggedInUser.id}`, JSON.stringify(loggedInUser));
    } catch (e) {
      console.error(e);
    }
    if (currentTab === 'home' || currentTab === 'orders') {
      handleNavigate('dashboard');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setActiveOrder(null);
    try {
      localStorage.removeItem('teqqno_user');
    } catch (e) {
      console.error(e);
    }
    handleNavigate('home');
  };

  const handleOpenAccount = () => {
    if (user) {
      handleNavigate('dashboard');
    } else {
      setAuthModalNote('');
      setIsAuthModalOpen(true);
    }
  };

  const handleReorder = (order: Order) => {
    setCartItems(prev => [...order.items, ...prev]);
    setIsCartOpen(true);
    triggerCelebration({
      level: 'premium',
      sound: 'celebration',
      eventKey: `reorder:${order.id}:${Date.now()}`,
      dedupeWindowMs: 1200,
      action: 'reorder_to_cart',
    });
  };

  const handleToggleWishlist = (productId: string) => {
    const isAdding = !wishlistIds.includes(productId);
    setWishlistIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [productId, ...prev]
    );
    if (isAdding) {
      triggerCelebration({
        level: 'subtle',
        sound: 'pop',
        eventKey: `wishlist-add:${productId}`,
        dedupeWindowMs: 1500,
        action: 'wishlist_added',
      });
    }
  };

  const handleClearWishlist = () => {
    setWishlistIds([]);
  };

  const wishlistProducts = PRODUCTS.filter(p => wishlistIds.includes(p.id));
  const totalCartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const userScopedOrders = user
    ? orders.filter((o) => doesOrderBelongToUser(o, user))
    : orders.filter((o) => !isLegacyMockOrder(o));

  if (currentTab === 'admin') {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <AdminHubView
          onBackToStore={() => handleNavigate('home')}
          onNavigateToOrderTracking={(orderNumber) => {
            const match = orders.find(o => o.orderNumber === orderNumber);
            if (match) setActiveOrder(match);
            setIsTrackingModalOpen(true);
          }}
        />
        {isTrackingModalOpen && (
          <OrderTrackingModal
            isOpen={isTrackingModalOpen}
            onClose={() => setIsTrackingModalOpen(false)}
            orders={orders}
            initialOrderNumber={activeOrder?.orderNumber || ''}
            onSelectProof={(order) => {
              setActiveOrder(order);
              handleNavigate('orders');
            }}
          />
        )}
        <CelebrationOverlay />
      </Suspense>
    );
  }

  const isCustomerPortalFull =
    (currentTab === 'dashboard' && Boolean(user)) || currentTab === 'affiliate-dashboard';

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F2FA] text-[#1A1B22] font-sans w-full max-w-full overflow-x-clip">
      
      {/* 1. Global Announcement Ribbon */}
      {!isCustomerPortalFull && (
        <AnnouncementBar onTrackOrderClick={() => handleNavigate('orders')} />
      )}

      {/* 2. Top Navigation Bar */}
      {!isCustomerPortalFull && (
        <Navbar
          currentTab={currentTab}
          onNavigate={handleNavigate}
          cartCount={totalCartCount}
          cartTotal={totalCartPrice}
          onOpenCart={() => setIsCartOpen(true)}
          wishlistCount={wishlistProducts.length}
          onOpenWishlist={() => setIsWishlistOpen(true)}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenAccount={handleOpenAccount}
          user={user}
          onLogout={handleLogout}
          onOpenQuoteCalculator={() => setIsQuoteCalculatorOpen(true)}
          onOpenBundleBuilder={() => setIsBundleBuilderOpen(true)}
          onOpenDownloadCatalog={() => setIsDownloadCatalogOpen(true)}
          onOpenTracking={() => setIsTrackingModalOpen(true)}
          onOpenDeliveryCheck={() => setIsDeliveryCheckOpen(true)}
        />
      )}

      {/* 3. Main Views Routing */}
      <main className="flex-1">
        {/* VIEW A: HOMEPAGE (Exact match to IMAGE 2) */}
        {currentTab === 'home' && (
          <div>
            {/* 1. Hero Section + Reassurance Ribbon */}
            <Hero
              onStartCustomizing={() => handleCustomizeProduct('prod-polo-01')}
              onExploreCatalog={() => handleNavigate('catalog')}
              onRequestQuote={() => handleNavigate('bulk')}
              onSelectProduct={(productId) => handleCustomizeProduct(productId)}
            />

            {/* 1.1 Trusted Brands & Businesses We Serve (Client Logos Marquee) */}
            <ClientLogosSection />

            {/* 1.2 Active Public Festival & Seasonal Offers Banner (renders only when live public campaign exists) */}
            <FestivalOffersBanner />

            {/* 2. Comprehensive Product Matrix (Explore Popular Categories - 10 cards) */}
            <CategoriesSection onSelectCategory={handleSelectCategory} />

            {/* 3. Factory Best Sellers (6 cards in 2 rows of 3) */}
            <FeaturedProducts
              products={PRODUCTS}
              onSelectProduct={handleSelectProduct}
              onCustomizeProduct={handleCustomizeProduct}
              onQuickAddToCart={handleQuickAddProduct}
              wishlistIds={wishlistIds}
              onToggleWishlist={handleToggleWishlist}
            />

            {/* 4. See Your Logo On Our Products (Zero Obligation Mockup Engine — viewport-deferred) */}
            <DeferredSection fallback={<MockupSectionFallback />} rootMargin="550px 0px">
              <MockupEngineSection
                onExploreProduct={handleCustomizeProduct}
                onAddToCart={handleAddToCart}
              />
            </DeferredSection>

            {/* 5. Transparent Production Flow (How It Works in 3 Simple Steps — viewport-deferred) */}
            <DeferredSection fallback={<BelowFoldPlaceholder heightClass="min-h-[540px]" />}>
              <WorkflowSection />
            </DeferredSection>

            {/* 5.1 Animated Easy Steps for Order Processing (viewport-deferred) */}
            <DeferredSection fallback={<BelowFoldPlaceholder heightClass="min-h-[480px]" />}>
              <OrderProcessingStepsSection />
            </DeferredSection>

            {/* 6. Enterprise & Bulk Solutions (viewport-deferred) */}
            <DeferredSection fallback={<BelowFoldPlaceholder heightClass="min-h-[560px]" dark />}>
              <BulkEnquirySection />
            </DeferredSection>

            {/* 7. The TeqqnoWorld Advantage (viewport-deferred) */}
            <DeferredSection fallback={<BelowFoldPlaceholder heightClass="min-h-[520px]" />}>
              <AdvantageSection />
            </DeferredSection>

            {/* 8. Proven Client Satisfaction (What Our Customers Say) */}
            <ClientReviewsSection />

            {/* 9. Got Questions? (Everything You Need To Know — viewport-deferred) */}
            <DeferredSection fallback={<BelowFoldPlaceholder heightClass="min-h-[540px]" />}>
              <FaqSection />
            </DeferredSection>

            {/* 10. Elevate Your Corporate Presence (Final CTA Banner) */}
            <CtaBanner onExploreCatalog={() => handleNavigate('catalog')} />
          </div>
        )}

        {/* VIEW B+: ROUTE-SPLIT VIEWS */}
        <Suspense fallback={<RouteLoadingFallback />}>
        {/* VIEW B: CATALOG / SHOP */}
        {currentTab === 'catalog' && (
          <ProductCatalogView
            initialCategory={catalogCategory}
            searchQuery={catalogSearchQuery}
            onCategoryChange={(cat) => {
              setCatalogCategory(cat);
              pushCleanUrl(getCategoryPath(cat));
            }}
            onNavigateHome={() => handleNavigate('home')}
            onNavigateRoute={handleNavigate}
            onSelectProduct={handleSelectProduct}
            onCustomizeProduct={handleCustomizeProduct}
            onOpenQuoteCalculator={() => setIsQuoteCalculatorOpen(true)}
            onOpenDownloadCatalog={() => setIsDownloadCatalogOpen(true)}
            wishlistIds={wishlistIds}
            onToggleWishlist={handleToggleWishlist}
          />
        )}

        {/* VIEW C: PRODUCT DETAIL (PDP) */}
        {currentTab === 'product-detail' && (
          <ProductDetailView
            product={selectedProduct}
            onBack={() => handleNavigate('catalog')}
            onNavigateHome={() => handleNavigate('home')}
            onNavigate={handleNavigate}
            onSelectCategory={handleSelectCategory}
            onSelectProduct={handleSelectProduct}
            onCustomize={handleCustomizeProduct}
            onAddToCart={handleAddToCart}
            onRequestQuote={() => handleNavigate('bulk')}
            wishlistIds={wishlistIds}
            onToggleWishlist={handleToggleWishlist}
            user={user}
            orders={userScopedOrders}
            onRequestLogin={() => {
              setAuthModalNote('Sign in to connect your review with verified TeqqnoWorld orders');
              setIsAuthModalOpen(true);
            }}
          />
        )}

        {/* VIEW D: STANDALONE LIVE CUSTOMIZER / MOCKUP ENGINE */}
        {currentTab === 'customizer' && (
          <div>
            <MockupEngineSection
              onExploreProduct={handleCustomizeProduct}
              onAddToCart={handleAddToCart}
            />
          </div>
        )}

        {/* VIEW E: STANDALONE CORPORATE BULK RFQ */}
        {currentTab === 'bulk' && (
          <div className="py-8 bg-[#16171B]">
            <BulkEnquirySection />
          </div>
        )}

        {/* VIEW E1: B2B BULK QUOTATION CALCULATOR */}
        {currentTab === 'quote-calculator' && (
          <div className="py-8 bg-[#F4F2FA]">
            <div className="max-w-7xl mx-auto px-4">
              <BulkQuotationCalculator onAddToCart={handleAddToCart} />
            </div>
          </div>
        )}

        {/* VIEW E2: CORPORATE GIFT BUNDLE BUILDER */}
        {currentTab === 'bundle-builder' && (
          <div className="py-8 bg-[#F4F2FA]">
            <div className="max-w-7xl mx-auto px-4">
              <CorporateGiftBundleBuilder onAddToCart={handleAddToCart} />
            </div>
          </div>
        )}

        {/* VIEW F: CHECKOUT FLOW */}
        {currentTab === 'checkout' && (
          <CheckoutView
            items={cartItems}
            onBackToCart={() => setIsCartOpen(true)}
            onOrderPlaced={handleOrderPlaced}
            user={user}
            onRequestLogin={() => {
              setAuthModalNote('Sign in to auto-fill your saved address & GSTIN');
              setIsAuthModalOpen(true);
            }}
          />
        )}

        {/* VIEW G: ORDER TRACKING & DIGITAL PROOF CONFIRMATION */}
        {currentTab === 'orders' && (
          activeOrder ? (
            <OrderConfirmationView
              order={activeOrder}
              onUpdateOrder={handleUpdateOrder}
              onBackToHome={() => setCurrentTab('home')}
              onNavigateCatalog={() => setCurrentTab('catalog')}
              onNavigate={handleNavigate}
            />
          ) : (
            <div className="py-20 px-4 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#FF7A00]/10 text-[#FF7A00] mx-auto flex items-center justify-center">
                <Package className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold font-display text-zinc-900">No Active Order Yet</h2>
              <p className="text-xs text-zinc-500 leading-relaxed">
                You haven&apos;t placed an order yet. Customize your product with your logo or track an existing order using your Order ID.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setCurrentTab('catalog')}
                  className="bg-[#FF7A00] hover:bg-[#ff881a] text-white text-xs font-semibold px-5 py-3 rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Explore Products
                </button>
                <button
                  onClick={() => setIsTrackingModalOpen(true)}
                  className="bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 text-xs font-semibold px-5 py-3 rounded-xl transition-all cursor-pointer"
                >
                  Track Order by ID
                </button>
              </div>
            </div>
          )
        )}

        {/* VIEW G2: WHATSAPP ORDER CONFIRM / CANCEL ACTION PAGE */}
        {currentTab === 'order-action' && orderActionParams && (
          <OrderActionView
            action={orderActionParams.action}
            orderId={orderActionParams.orderId}
            orderNumber={orderActionParams.orderNumber}
            token={orderActionParams.token}
            onOrderActionComplete={(ordId, ordNum, status) => {
              setOrders((prev) =>
                prev.map((o) =>
                  o.id === ordId || o.orderNumber === ordNum
                    ? {
                        ...o,
                        whatsappActionStatus: status,
                        orderStatus: status === 'confirmed' ? 'Confirmed' : o.orderStatus,
                      }
                    : o
                )
              );
              setActiveOrder((prev) =>
                prev && (prev.id === ordId || prev.orderNumber === ordNum)
                  ? {
                      ...prev,
                      whatsappActionStatus: status,
                      orderStatus: status === 'confirmed' ? 'Confirmed' : prev.orderStatus,
                    }
                  : prev
              );
            }}
            onViewOrder={(ordNum) => {
              const found = orders.find((o) => o.orderNumber === ordNum || o.id === ordNum);
              if (found) setActiveOrder(found);
              handleNavigate('orders');
            }}
            onBackHome={() => handleNavigate('home')}
          />
        )}

        {/* VIEW H: CORPORATE ACCOUNT DASHBOARD */}
        {currentTab === 'dashboard' && (
          user ? (
            <CustomerDashboard
              user={user}
              orders={userScopedOrders}
              onUpdateUser={(updated) => {
                setUser(updated);
                try {
                  localStorage.setItem('teqqno_user', JSON.stringify(updated));
                  localStorage.setItem(`teqqno_user_profile_${updated.id}`, JSON.stringify(updated));
                } catch (e) {
                  console.error(e);
                }
              }}
              onLogout={handleLogout}
              onNavigateTab={handleNavigate}
              onCustomizeProduct={handleCustomizeProduct}
              onReorder={handleReorder}
              onSelectOrderProof={(order) => {
                setActiveOrder(order);
                setCurrentTab('orders');
              }}
              wishlistIds={wishlistIds}
              onToggleWishlist={handleToggleWishlist}
              cartCount={totalCartCount}
              onOpenCart={() => setIsCartOpen(true)}
              onOpenQuoteCalculator={() => setIsQuoteCalculatorOpen(true)}
              onOpenBundleBuilder={() => setIsBundleBuilderOpen(true)}
              onOpenAuth={() => {
                setAuthModalNote('Sign in with your verified email and password to update security settings');
                setIsAuthModalOpen(true);
              }}
            />
          ) : (
            <div className="py-20 px-4 text-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#FF7A00]/10 text-[#FF7A00] mx-auto flex items-center justify-center">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold font-display text-zinc-900">Sign in to Access Corporate Dashboard</h2>
              <p className="text-xs text-zinc-500">
                Enter your mobile number to view Pantone proofs, live Delhivery tracking, and 18% ITC GST invoices.
              </p>
              <button
                onClick={() => {
                  setAuthModalNote('');
                  setIsAuthModalOpen(true);
                }}
                className="bg-[#FF7A00] hover:bg-[#ff881a] text-white text-xs font-semibold px-6 py-3 rounded-xl shadow-md transition-all inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Login with Mobile OTP</span>
              </button>
            </div>
          )
        )}

        {/* VIEW H2: AFFILIATE PARTNER PROGRAM LANDING PAGE */}
        {currentTab === 'affiliate-program' && (
          <AffiliateLandingView
            user={user}
            onNavigate={handleNavigate}
            onRequestLogin={() => {
              setAuthModalNote('Sign in with your TeqqnoWorld customer account to check Affiliate Program eligibility');
              setIsAuthModalOpen(true);
            }}
          />
        )}

        {/* VIEW H3: DEDICATED AFFILIATE PARTNER DASHBOARD */}
        {currentTab === 'affiliate-dashboard' && (
          <AffiliateDashboardView
            user={user}
            onNavigate={handleNavigate}
            onRequestLogin={() => {
              setAuthModalNote('Sign in to access your TeqqnoWorld Affiliate Partner Dashboard');
              setIsAuthModalOpen(true);
            }}
          />
        )}

        {/* VIEW H4: PUBLIC AFFILIATE CREDENTIAL VERIFICATION PAGE */}
        {currentTab === 'affiliate-verify' && (
          <AffiliateVerificationView
            verificationCode={affiliateVerifyCode}
            onBackHome={() => handleNavigate('home')}
          />
        )}

        {/* VIEW H5: BLOG & RESOURCE CENTER (/blogs, /guides, /resources) */}
        {currentTab === 'blogs' && (
          <BlogResourceCenterView
            hubPath={blogHubPath}
            onOpenArticle={(slug) => handleNavigate(getBlogPath(slug))}
            onNavigatePath={(path) => handleNavigate(path)}
          />
        )}

        {/* VIEW H6: BLOG ARTICLE DETAIL PAGE (/blogs/:slug) */}
        {currentTab === 'blog-detail' && activeBlogSlug && (
          <BlogArticleDetailView
            slug={activeBlogSlug}
            onOpenArticle={(slug) => handleNavigate(getBlogPath(slug))}
            onNavigatePath={(path) => handleNavigate(path)}
            onArticleLoaded={(loadedPost) => setActiveBlogPost(loadedPost)}
          />
        )}

        {/* VIEW I: LEGAL & POLICY PAGES */}
        {(currentTab === '/privacy-policy' || currentTab === 'privacy-policy') && (
          <PrivacyPolicyView onNavigate={handleNavigate} />
        )}

        {(currentTab === '/terms-and-conditions' || currentTab === 'terms-and-conditions') && (
          <TermsAndConditionsView onNavigate={handleNavigate} />
        )}

        {(currentTab === '/shipping-policy' || currentTab === 'shipping-policy') && (
          <ShippingPolicyView onNavigate={handleNavigate} />
        )}

        {(currentTab === '/cancellation-refund-policy' || currentTab === 'cancellation-refund-policy') && (
          <CancellationRefundPolicyView onNavigate={handleNavigate} />
        )}

        {(currentTab === '/return-replacement-policy' || currentTab === 'return-replacement-policy') && (
          <ReturnReplacementPolicyView onNavigate={handleNavigate} />
        )}

        {(currentTab === '/contact-us' || currentTab === 'contact-us') && (
          <ContactUsView onNavigate={handleNavigate} />
        )}

        {(currentTab === '/payment-policy' || currentTab === 'payment-policy') && (
          <PaymentPolicyView onNavigate={handleNavigate} />
        )}

        {(currentTab === '/pricing-and-taxes' || currentTab === 'pricing-and-taxes') && (
          <PricingTaxesView onNavigate={handleNavigate} />
        )}

        {(currentTab === '/cookie-policy' || currentTab === 'cookie-policy') && (
          <CookiePolicyView onNavigate={handleNavigate} />
        )}
        </Suspense>

        {/* VIEW J: 404 PAGE NOT FOUND */}
        {currentTab === 'not-found' && (
          <section className="py-20 sm:py-28 px-4 text-center max-w-xl mx-auto space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FF7A00]/10 border border-[#FF7A00]/25 text-[#FF7A00] text-xs font-mono font-bold uppercase tracking-wider">
              HTTP 404 · Page Not Found
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#0B0B0D] tracking-tight">
              We couldn&apos;t find that page
            </h1>
            <p className="text-sm text-zinc-600 leading-relaxed">
              The link may have moved or no longer exists on TeqqnoWorld. Explore our custom printed corporate merchandise catalog or return to the homepage.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href="/"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    handleNavigate('home');
                  }
                }}
                className="bg-[#FF7A00] hover:bg-[#e06c00] text-white text-xs sm:text-sm font-display font-semibold px-5 py-3 rounded-xl shadow-md transition-all inline-flex items-center gap-2"
              >
                <Home className="w-4 h-4" />
                <span>Back to Homepage</span>
              </a>
              <a
                href="/catalog"
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                    e.preventDefault();
                    handleNavigate('catalog');
                  }
                }}
                className="bg-white hover:bg-zinc-50 border border-zinc-200 text-zinc-800 text-xs sm:text-sm font-display font-semibold px-5 py-3 rounded-xl transition-all inline-flex items-center gap-2"
              >
                <span>Browse All Products</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </section>
        )}
      </main>

      {/* 4. Global Footer with Pre-Footer Trust Strip */}
      {!isCustomerPortalFull && (
        <Footer 
          onNavigate={handleNavigate} 
          onOpenSupabaseDev={() => setIsSupabaseDevOpen(true)} 
        />
      )}


      {/* 5–14. Lazy-Loaded Drawers & Modals (only download & mount when opened) */}
      <Suspense fallback={null}>
        {isCartOpen && (
          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
            items={cartItems}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveItem={handleRemoveCartItem}
            onProceedToCheckout={handleProceedToCheckout}
            onOpenDeliveryCheck={() => setIsDeliveryCheckOpen(true)}
            user={user}
          />
        )}

        {isWishlistOpen && (
          <WishlistDrawer
            isOpen={isWishlistOpen}
            onClose={() => setIsWishlistOpen(false)}
            items={wishlistProducts}
            onRemoveItem={handleToggleWishlist}
            onClearAll={handleClearWishlist}
            onSelectProduct={handleSelectProduct}
            onCustomizeProduct={handleCustomizeProduct}
            onQuickAddToCart={(product) => {
              handleQuickAddProduct(product);
              setWishlistIds(prev => prev.filter(id => id !== product.id));
            }}
            onExploreCatalog={() => handleNavigate('catalog')}
          />
        )}

        {isSearchOpen && (
          <SearchModal
            isOpen={isSearchOpen}
            onClose={() => setIsSearchOpen(false)}
            onSelectProduct={handleSelectProduct}
            onCustomizeProduct={handleCustomizeProduct}
          />
        )}

        {isAccountOpen && (
          <AccountModal
            isOpen={isAccountOpen}
            onClose={() => setIsAccountOpen(false)}
            orders={userScopedOrders}
            onSelectOrder={(order) => {
              setActiveOrder(order);
              setCurrentTab('orders');
            }}
          />
        )}

        {isAuthModalOpen && (
          <AuthModal
            isOpen={isAuthModalOpen}
            onClose={() => setIsAuthModalOpen(false)}
            onLoginSuccess={handleLoginSuccess}
            destinationActionNote={authModalNote}
          />
        )}

        {isQuoteCalculatorOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
            <BulkQuotationCalculator
              isModal={true}
              onCloseModal={() => setIsQuoteCalculatorOpen(false)}
              onAddToCart={handleAddToCart}
            />
          </div>
        )}

        {isBundleBuilderOpen && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
            <CorporateGiftBundleBuilder
              isModal={true}
              onClose={() => setIsBundleBuilderOpen(false)}
              onAddToCart={handleAddToCart}
            />
          </div>
        )}

        {isDownloadCatalogOpen && (
          <DownloadCatalogModal
            isOpen={isDownloadCatalogOpen}
            onClose={() => setIsDownloadCatalogOpen(false)}
          />
        )}

        {isTrackingModalOpen && (
          <OrderTrackingModal
            isOpen={isTrackingModalOpen}
            onClose={() => setIsTrackingModalOpen(false)}
            orders={userScopedOrders}
            onSelectProof={(order) => {
              setActiveOrder(order);
              setCurrentTab('orders');
            }}
          />
        )}

        {isSupabaseDevOpen && (
          <SupabaseDevModal
            isOpen={isSupabaseDevOpen}
            onClose={() => setIsSupabaseDevOpen(false)}
          />
        )}
      </Suspense>

      {/* 14. Delhivery Serviceability Checker Modal */}
      {isDeliveryCheckOpen && (
        <DelhiveryAreaModal
          isOpen={isDeliveryCheckOpen}
          onClose={() => setIsDeliveryCheckOpen(false)}
        />
      )}



      {/* 8. Floating Direct WhatsApp Trigger (Desktop & Tablet) */}
      {!isCustomerPortalFull && (
        <a
          href={getWhatsAppLink('Hello TeqqnoWorld, I want to discuss custom branded merchandise for my company')}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            trackWhatsAppEnquiry({
              placement: 'floating_whatsapp_cta',
              productId: selectedProduct?.id,
              productName: selectedProduct ? getProductH1(selectedProduct.id, selectedProduct.name) : undefined,
            })
          }
          aria-label="Direct WhatsApp Print Consultant"
          className="hidden md:flex fixed bottom-6 right-6 z-40 bg-[#1EBE5D] hover:bg-[#19a851] text-white p-3.5 rounded-full shadow-xl shadow-[#1EBE5D]/30 hover:scale-105 active:scale-95 transition-all items-center gap-2 group"
        >
          <WhatsAppIcon className="w-6 h-6 text-white" />
          <span className="inline-block max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 text-xs font-semibold">
            Chat on WhatsApp ({BUSINESS_CONFIG.contact.whatsapp})
          </span>
        </a>
      )}

      {/* 9. Mobile Bottom App Navigation Dock (Phones & Small Tablets < 768px, outside PDP, Checkout & Full Customer Portal) */}
      {!isCustomerPortalFull && currentTab !== 'product-detail' && currentTab !== 'checkout' && (
        <nav
          aria-label="Mobile Bottom Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200 px-2 pt-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] shadow-lg flex items-center justify-around"
        >
          <button
            onClick={() => handleNavigate('home')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] min-h-[44px] cursor-pointer ${
              currentTab === 'home' ? 'text-[#FF7A00] font-bold scale-105' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Home</span>
          </button>

          <button
            onClick={() => handleNavigate('catalog')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] min-h-[44px] cursor-pointer ${
              currentTab === 'catalog' ? 'text-[#FF7A00] font-bold scale-105' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">Shop</span>
          </button>

          <button
            onClick={() => handleNavigate('customizer')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] min-h-[44px] cursor-pointer ${
              currentTab === 'customizer' ? 'text-[#FF7A00] font-bold scale-105' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <div className="relative">
              <Sparkles className="w-5 h-5 text-[#FF7A00]" />
              <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-[#FF7A00] rounded-full animate-ping" />
            </div>
            <span className="text-[10px] mt-0.5">Customize</span>
          </button>

          <button
            onClick={() => handleNavigate(user ? 'dashboard' : 'orders')}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all min-w-[56px] min-h-[44px] cursor-pointer ${
              currentTab === 'dashboard' || currentTab === 'orders' ? 'text-[#FF7A00] font-bold scale-105' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">{user ? 'Dashboard' : 'Orders'}</span>
          </button>

          <button
            onClick={() => setIsCartOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-zinc-500 hover:text-zinc-800 transition-all relative min-w-[56px] min-h-[44px] cursor-pointer"
          >
            <div className="relative">
              <ShoppingBag className="w-5 h-5" />
              {cartItems.length > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-[#FF7A00] text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-xs">
                  {cartItems.reduce((acc, it) => acc + it.quantity, 0)}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5">Cart</span>
          </button>
        </nav>
      )}

      {/* Global Website-Wide Luxury Celebration Canvas Overlay */}
      <CelebrationOverlay />

    </div>
  );
}
