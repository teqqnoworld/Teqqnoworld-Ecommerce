import React, { useState, useEffect } from 'react';
import { AnnouncementBar } from './components/AnnouncementBar';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { CategoriesSection } from './components/CategoriesSection';
import { FeaturedProducts } from './components/FeaturedProducts';
import { MockupEngineSection } from './components/MockupEngineSection';
import { WorkflowSection } from './components/WorkflowSection';
import { BulkEnquirySection } from './components/BulkEnquirySection';
import { AdvantageSection } from './components/AdvantageSection';
import { ClientReviewsSection } from './components/ClientReviewsSection';
import { FaqSection } from './components/FaqSection';
import { CtaBanner } from './components/CtaBanner';
import { Footer } from './components/Footer';

import { ProductCatalogView } from './components/ProductCatalogView';
import { ProductDetailView } from './components/ProductDetailView';
import { CartDrawer } from './components/CartDrawer';
import { WishlistDrawer } from './components/WishlistDrawer';
import { CheckoutView } from './components/CheckoutView';
import { OrderConfirmationView } from './components/OrderConfirmationView';
import { SearchModal } from './components/SearchModal';
import { AccountModal } from './components/AccountModal';
import { AuthModal } from './components/AuthModal';
import { CustomerDashboard } from './components/CustomerDashboard';
import { OrderProcessingStepsSection } from './components/OrderProcessingStepsSection';
import { ClientLogosSection } from './components/ClientLogosSection';
import { BulkQuotationCalculator } from './components/BulkQuotationCalculator';
import { CorporateGiftBundleBuilder } from './components/CorporateGiftBundleBuilder';
import { DownloadCatalogModal } from './components/DownloadCatalogModal';
import { OrderTrackingModal } from './components/OrderTrackingModal';
import { SupabaseDevModal } from './components/SupabaseDevModal';
import { AdminHubView } from './components/AdminHubView';
import { DelhiveryAreaModal } from './components/DelhiveryPincodeChecker';
import { OrderActionView } from './components/OrderActionView';
import { activateRecoveryCoupon } from './services/aisensyService';
import { sendRegistrationEmails } from './services/emailService';
import { supabase } from './lib/supabase';

// Legal & Policy Views
import { PrivacyPolicyView } from './components/legal/PrivacyPolicyView';
import { TermsAndConditionsView } from './components/legal/TermsAndConditionsView';
import { ShippingPolicyView } from './components/legal/ShippingPolicyView';
import { CancellationRefundPolicyView } from './components/legal/CancellationRefundPolicyView';
import { ReturnReplacementPolicyView } from './components/legal/ReturnReplacementPolicyView';
import { BUSINESS_CONFIG, getWhatsAppLink } from './config/business';
import { ContactUsView } from './components/legal/ContactUsView';
import { PaymentPolicyView } from './components/legal/PaymentPolicyView';
import { PricingTaxesView } from './components/legal/PricingTaxesView';
import { CookiePolicyView } from './components/legal/CookiePolicyView';

import { PRODUCTS } from './data/mockData';
import { calculateProductPrice } from './data/pricingRules';
import { Product, ProductCategory, CartItem, Order, CustomArtwork, PrintMethod, UserProfile } from './types';
import { doesOrderBelongToUser, isLegacyMockOrder } from './components/customer/customerUtils';
import { ShieldCheck, Sparkles, Home, LayoutGrid, ShoppingBag, Package } from 'lucide-react';
import { WhatsAppIcon } from './components/WhatsAppIcon';

export default function App() {
  // Navigation & View Routing (Supports direct URL path e.g. /admin, /privacy-policy, etc.)
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path === '/admin' || path === '/admin/' || hash === '#admin' || hash === '#admin/') return 'admin';
      if (path.startsWith('/product/') || hash.startsWith('#product/')) return 'product-detail';
      const validLegal = [
        '/privacy-policy',
        '/terms-and-conditions',
        '/shipping-policy',
        '/cancellation-refund-policy',
        '/return-replacement-policy',
        '/contact-us',
        '/payment-policy',
        '/pricing-and-taxes',
        '/cookie-policy',
      ];
      if (validLegal.includes(path)) return path;
      for (const r of validLegal) {
        if (hash === `#${r}` || hash === `#${r.slice(1)}`) return r;
      }
      if (hash === '#catalog') return 'catalog';
      if (hash === '#customizer') return 'customizer';
      if (hash === '#bulk') return 'bulk';
      if (hash === '#orders') return 'orders';
      if (hash === '#dashboard') return 'dashboard';
      if (hash.startsWith('#checkout')) return 'checkout';
      if (hash.startsWith('#order-action')) return 'order-action';
    }
    return 'home';
  });

  const [orderActionParams, setOrderActionParams] = useState<{
    action: 'confirm' | 'cancel';
    orderId: string;
    orderNumber: string;
    token?: string;
  } | null>(() => {
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#order-action')) {
      const qIdx = window.location.hash.indexOf('?');
      const params = new URLSearchParams(qIdx !== -1 ? window.location.hash.slice(qIdx + 1) : '');
      const rawAct = params.get('action');
      return {
        action: rawAct === 'cancel' ? 'cancel' : 'confirm',
        orderId: params.get('orderId') || '',
        orderNumber: params.get('orderNumber') || params.get('orderId') || '',
        token: params.get('token') || undefined,
      };
    }
    return null;
  });
  const [selectedProduct, setSelectedProduct] = useState<Product>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      const hash = window.location.hash;
      if (path.startsWith('/product/')) {
        const slug = decodeURIComponent(path.replace('/product/', ''));
        const found = PRODUCTS.find(p => p.slug === slug || p.id === slug);
        if (found) return found;
      }
      if (hash.startsWith('#product/')) {
        const slug = decodeURIComponent(hash.replace('#product/', ''));
        const found = PRODUCTS.find(p => p.slug === slug || p.id === slug);
        if (found) return found;
      }
    }
    return PRODUCTS[0];
  });
  const [catalogCategory, setCatalogCategory] = useState<ProductCategory>('all');
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
        if (oauthCode) {
          await supabase.auth.exchangeCodeForSession(oauthCode);
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
          sendRegistrationEmails({
            userId: verifiedProfile.id,
            firstName: nameParts[0] || fullName,
            lastName: nameParts.slice(1).join(' ') || '',
            fullName,
            email: verifiedProfile.email,
            phone: verifiedProfile.mobile || '',
            accountType: verifiedProfile.accountType || 'individual',
            registeredAt: new Date().toISOString(),
          }).catch(() => {});
        }

        setUser(verifiedProfile);
        try {
          localStorage.setItem('teqqno_user', JSON.stringify(verifiedProfile));
          localStorage.setItem(
            `teqqno_user_profile_${verifiedProfile.id}`,
            JSON.stringify(verifiedProfile)
          );
          window.history.replaceState(null, '', '/#dashboard');
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

  // Support direct product deep-linking and browser path/popstate routing
  useEffect(() => {
    const syncLocationToState = () => {
      const path = window.location.pathname;
      const hash = window.location.hash;
      const validLegal = [
        '/privacy-policy',
        '/terms-and-conditions',
        '/shipping-policy',
        '/cancellation-refund-policy',
        '/return-replacement-policy',
        '/contact-us',
        '/payment-policy',
        '/pricing-and-taxes',
        '/cookie-policy',
      ];

      if (validLegal.includes(path)) {
        setCurrentTab(path);
        return;
      }

      for (const r of validLegal) {
        if (hash === `#${r}` || hash === `#${r.slice(1)}`) {
          setCurrentTab(r);
          return;
        }
      }

      if (path === '/admin' || path === '/admin/' || hash === '#admin' || hash === '#admin/') {
        setCurrentTab('admin');
        return;
      }

      if (hash.startsWith('#product/') || path.startsWith('/product/')) {
        const slugOrId = path.startsWith('/product/')
          ? decodeURIComponent(path.replace('/product/', ''))
          : decodeURIComponent(hash.replace('#product/', ''));
        const found = PRODUCTS.find(p => p.slug === slugOrId || p.id === slugOrId);
        if (found) {
          setSelectedProduct(found);
          setCurrentTab('product-detail');
          return;
        }
      }

      if (hash.startsWith('#order-action')) {
        const qIdx = hash.indexOf('?');
        const params = new URLSearchParams(qIdx !== -1 ? hash.slice(qIdx + 1) : '');
        const rawAct = params.get('action');
        setOrderActionParams({
          action: rawAct === 'cancel' ? 'cancel' : 'confirm',
          orderId: params.get('orderId') || '',
          orderNumber: params.get('orderNumber') || params.get('orderId') || '',
          token: params.get('token') || undefined,
        });
        setCurrentTab('order-action');
        return;
      }

      if (hash.startsWith('#checkout')) {
        const qIdx = hash.indexOf('?');
        if (qIdx !== -1) {
          const params = new URLSearchParams(hash.slice(qIdx + 1));
          const coupon = params.get('coupon')?.trim().toUpperCase();
          if (coupon === 'SAVE5NOW' || coupon === 'TEQQNO5') {
            activateRecoveryCoupon({
              triggerReason: 'whatsapp_recovery_link',
              validMinutes: 15,
              autoApply: true,
            });
          }
        }
        setCurrentTab('checkout');
        return;
      }

      if (hash === '#catalog') {
        setCurrentTab('catalog');
      } else if (hash === '#customizer') {
        setCurrentTab('customizer');
      } else if (hash === '#bulk') {
        setCurrentTab('bulk');
      } else if (hash === '#orders') {
        setCurrentTab('orders');
      } else if (hash === '#dashboard') {
        setCurrentTab('dashboard');
      } else if (hash === '#quote-calculator') {
        setCurrentTab('quote-calculator');
      } else if (hash === '#bundle-builder') {
        setCurrentTab('bundle-builder');
      } else if (hash === '#catalogues') {
        setIsDownloadCatalogOpen(true);
      } else if (hash === '#track' || hash === '#track-order') {
        setIsTrackingModalOpen(true);
      } else if (path === '/' && (!hash || hash === '#')) {
        setCurrentTab('home');
      }
    };

    syncLocationToState();
    window.addEventListener('popstate', syncLocationToState);
    window.addEventListener('hashchange', syncLocationToState);
    return () => {
      window.removeEventListener('popstate', syncLocationToState);
      window.removeEventListener('hashchange', syncLocationToState);
    };
  }, []);

  // Navigation handlers
  const handleNavigate = (tabOrRoute: string) => {
    const validLegal = [
      '/privacy-policy',
      '/terms-and-conditions',
      '/shipping-policy',
      '/cancellation-refund-policy',
      '/return-replacement-policy',
      '/contact-us',
      '/payment-policy',
      '/pricing-and-taxes',
      '/cookie-policy',
    ];

    const normalized = tabOrRoute.startsWith('/') ? tabOrRoute : `/${tabOrRoute}`;
    if (validLegal.includes(normalized)) {
      try {
        window.history.pushState(null, '', normalized);
      } catch (e) {}
      setCurrentTab(normalized);
      return;
    }

    if (tabOrRoute === 'home') {
      try {
        window.history.pushState(null, '', '/');
      } catch (e) {}
      setCurrentTab('home');
      return;
    }

    if (tabOrRoute === 'customizer') {
      if (currentTab !== 'home') {
        setCurrentTab('home');
        setTimeout(() => {
          document.getElementById('customizer-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      } else {
        document.getElementById('customizer-section')?.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (tabOrRoute === 'quote-calculator') {
      setCurrentTab('quote-calculator');
      return;
    }

    if (tabOrRoute === 'bundle-builder') {
      setCurrentTab('bundle-builder');
      return;
    }

    if (tabOrRoute === 'catalogues') {
      setIsDownloadCatalogOpen(true);
      return;
    }

    if (tabOrRoute === 'track-order' || tabOrRoute === 'track') {
      setIsTrackingModalOpen(true);
      return;
    }

    if (tabOrRoute === 'admin' || tabOrRoute === '/admin' || tabOrRoute === '#admin') {
      try {
        window.history.pushState(null, '', '#admin');
      } catch (e) {}
      setCurrentTab('admin');
      return;
    }

    try {
      window.history.pushState(null, '', `#${tabOrRoute}`);
    } catch (e) {}
    setCurrentTab(tabOrRoute);
  };

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setCurrentTab('product-detail');
    try {
      window.history.pushState(null, '', `#product/${product.slug || product.id}`);
    } catch (e) {}
  };

  const handleCustomizeProduct = (productId: string) => {
    const prod = PRODUCTS.find(p => p.id === productId || p.slug === productId) || PRODUCTS[0];
    setSelectedProduct(prod);
    setCustomizerProductId(prod.id);
    setCurrentTab('product-detail');
    try {
      window.history.pushState(null, '', `#product/${prod.slug || prod.id}`);
    } catch (e) {}
  };

  const handleSelectCategory = (categoryId: string) => {
    let targetCategory: ProductCategory = 'all';
    if (categoryId === 'event-signage' || categoryId === 'promotional-items' || categoryId === 'signage') {
      targetCategory = 'promotional-items';
    } else if (categoryId === 'visiting-cards' || categoryId === 'printing-items' || categoryId === 'stationery') {
      targetCategory = 'printing-items';
    } else if (categoryId === 'custom-tshirt-printing' || categoryId === 'tshirts' || categoryId === 'polos' || categoryId === 'apparel') {
      targetCategory = 'custom-tshirt-printing';
    } else if (categoryId === 'corporate-gifting' || categoryId === 'kits' || categoryId === 'drinkware') {
      targetCategory = 'corporate-gifting';
    } else if (categoryId === 'custom-caps' || categoryId === 'caps') {
      targetCategory = 'caps';
    } else {
      targetCategory = categoryId as ProductCategory;
    }
    setCatalogCategory(targetCategory);
    setCurrentTab('catalog');
    try {
      window.history.pushState(null, '', `#catalog`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {}
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
    setCurrentTab('checkout');
  };

  const handleOrderPlaced = (newOrder: Order) => {
    setOrders(prev => [newOrder, ...prev]);
    setActiveOrder(newOrder);
    setCartItems([]);
    setCurrentTab('orders');
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
      setCurrentTab('dashboard');
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
    setCurrentTab('home');
  };

  const handleOpenAccount = () => {
    if (user) {
      setCurrentTab('dashboard');
    } else {
      setAuthModalNote('');
      setIsAuthModalOpen(true);
    }
  };

  const handleReorder = (order: Order) => {
    setCartItems(prev => [...order.items, ...prev]);
    setIsCartOpen(true);
  };

  const handleToggleWishlist = (productId: string) => {
    setWishlistIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [productId, ...prev]
    );
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
      <>
        <AdminHubView
          onBackToStore={() => handleNavigate('home')}
          onNavigateToOrderTracking={(orderNumber) => {
            const match = orders.find(o => o.orderNumber === orderNumber);
            if (match) setActiveOrder(match);
            setIsTrackingModalOpen(true);
          }}
        />
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
      </>
    );
  }

  const isCustomerPortalFull = currentTab === 'dashboard' && Boolean(user);

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F2FA] text-[#1A1B22] font-sans w-full max-w-full overflow-x-clip">
      
      {/* 1. Global Announcement Ribbon */}
      {!isCustomerPortalFull && (
        <AnnouncementBar onTrackOrderClick={() => setCurrentTab('orders')} />
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
              onExploreCatalog={() => {
                setCatalogCategory('all');
                setCurrentTab('catalog');
              }}
              onRequestQuote={() => setCurrentTab('bulk')}
              onSelectProduct={(productId) => handleCustomizeProduct(productId)}
            />

            {/* 1.1 Trusted Brands & Businesses We Serve (Client Logos Marquee) */}
            <ClientLogosSection />

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

            {/* 4. See Your Logo On Our Products (Zero Obligation Mockup Engine) */}
            <MockupEngineSection
              onExploreProduct={handleCustomizeProduct}
              onAddToCart={handleAddToCart}
            />

            {/* 5. Transparent Production Flow (How It Works in 3 Simple Steps) */}
            <WorkflowSection />

            {/* 5.1 Animated Easy Steps for Order Processing (Exact Blueprint Reference) */}
            <OrderProcessingStepsSection />

            {/* 6. Enterprise & Bulk Solutions (Equip Your Entire Organization...) */}
            <BulkEnquirySection />

            {/* 7. The TeqqnoWorld Advantage (Built to Remove Corporate Merchandise Headaches) */}
            <AdvantageSection />

            {/* 8. Proven Client Satisfaction (What Our Customers Say) */}
            <ClientReviewsSection />

            {/* 9. Got Questions? (Everything You Need To Know) */}
            <FaqSection />

            {/* 10. Elevate Your Corporate Presence (Final CTA Banner) */}
            <CtaBanner onExploreCatalog={() => setCurrentTab('catalog')} />
          </div>
        )}

        {/* VIEW B: CATALOG / SHOP */}
        {currentTab === 'catalog' && (
          <ProductCatalogView
            initialCategory={catalogCategory}
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
            onBack={() => setCurrentTab('catalog')}
            onCustomize={handleCustomizeProduct}
            onAddToCart={handleAddToCart}
            onRequestQuote={() => setCurrentTab('bulk')}
            wishlistIds={wishlistIds}
            onToggleWishlist={handleToggleWishlist}
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
      </main>

      {/* 4. Global Footer with Pre-Footer Trust Strip */}
      {!isCustomerPortalFull && (
        <Footer 
          onNavigate={handleNavigate} 
          onOpenSupabaseDev={() => setIsSupabaseDevOpen(true)} 
        />
      )}


      {/* 5. Cart Slide-Over Drawer */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveCartItem}
        onProceedToCheckout={handleProceedToCheckout}
        onOpenDeliveryCheck={() => setIsDeliveryCheckOpen(true)}
      />

      {/* 5.1 Wishlist Slide-Over Drawer */}
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

      {/* 6. Real-Time Search Overlay */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectProduct={handleSelectProduct}
        onCustomizeProduct={handleCustomizeProduct}
      />

      {/* 7. Account & Order Lookup Modal */}
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        orders={userScopedOrders}
        onSelectOrder={(order) => {
          setActiveOrder(order);
          setCurrentTab('orders');
        }}
      />

      {/* 8. Mobile Number OTP Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        destinationActionNote={authModalNote}
      />

      {/* 9. B2B Bulk Quotation Calculator Modal */}
      {isQuoteCalculatorOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
          <BulkQuotationCalculator
            isModal={true}
            onCloseModal={() => setIsQuoteCalculatorOpen(false)}
            onAddToCart={handleAddToCart}
          />
        </div>
      )}

      {/* 10. Corporate Gift Bundle Builder Modal */}
      {isBundleBuilderOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
          <CorporateGiftBundleBuilder
            isModal={true}
            onClose={() => setIsBundleBuilderOpen(false)}
            onAddToCart={handleAddToCart}
          />
        </div>
      )}

      {/* 11. Downloadable Corporate Catalogues Modal */}
      <DownloadCatalogModal
        isOpen={isDownloadCatalogOpen}
        onClose={() => setIsDownloadCatalogOpen(false)}
      />

      {/* 12. Order Tracking & Consignment Milestone Modal */}
      <OrderTrackingModal
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
        orders={userScopedOrders}
        onSelectProof={(order) => {
          setActiveOrder(order);
          setCurrentTab('orders');
        }}
      />

      {/* 13. Supabase Integration Console Modal */}
      <SupabaseDevModal
        isOpen={isSupabaseDevOpen}
        onClose={() => setIsSupabaseDevOpen(false)}
      />

      {/* 14. Delhivery Serviceability Checker Modal */}
      <DelhiveryAreaModal
        isOpen={isDeliveryCheckOpen}
        onClose={() => setIsDeliveryCheckOpen(false)}
      />



      {/* 8. Floating Direct WhatsApp Trigger (Desktop & Tablet) */}
      {!isCustomerPortalFull && (
        <a
          href={getWhatsAppLink('Hello TeqqnoWorld, I want to discuss custom branded merchandise for my company')}
          target="_blank"
          rel="noopener noreferrer"
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

    </div>
  );
}
