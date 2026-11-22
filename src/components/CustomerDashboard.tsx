import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Building2,
  Calculator,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Gift,
  Heart,
  HelpCircle,
  Home,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  LogOut,
  MapPin,
  Menu,
  MoreHorizontal,
  Package,
  Palette,
  PenTool,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Truck,
  Upload,
  User,
  X,
} from 'lucide-react';
import { PRODUCTS } from '../data/mockData';
import { BUSINESS_CONFIG, getWhatsAppLink } from '../config/business';
import { CustomOrderRow, supabase } from '../lib/supabase';
import { fetchCustomerCustomOrders, uploadBrandLogoToStorage } from '../services/supabaseService';
import {
  BulkEnquirySubmission,
  CustomerArtwork,
  Order,
  SavedAddress,
  UserProfile,
} from '../types';
import { generateOrderTaxInvoicePdf } from '../utils/pdfGenerator';
import {
  AccountSubSection,
  buildOrderAnalyticsSeries,
  computeStatusBreakdown,
  CustomerTab,
  deriveInvoicesFromOrders,
  deriveNotificationsFromOrders,
  extractBrandAssetsFromOrders,
  getOrderStatusBadgeMeta,
  getPortalGreetingSubtext,
  getThumbnailForOrder,
  mergeCustomerOrders,
  validateBrandAssetFile,
} from './customer/customerUtils';
import {
  AssetPreviewThumb,
  CustomerKpiCard,
  OrdersAreaChart,
  OrderStatusDonut,
  PortalToast,
  PortalToastList,
} from './customer/CustomerVisuals';
import {
  CustomerAccountSecurityView,
  CustomerAddressesView,
  CustomerBrandAssetsView,
  CustomerBulkRfqView,
  CustomerGstInvoicesView,
  CustomerSupportView,
  CustomerTrackConsignmentView,
  CustomerWishlistView,
  OrderDetailDrawer,
} from './customer/CustomerSections';

export type DashboardTab = CustomerTab;

interface CustomerDashboardProps {
  user: UserProfile;
  orders: Order[];
  onUpdateUser: (updatedUser: UserProfile) => void;
  onLogout: () => void;
  onNavigateTab: (tab: string) => void;
  onCustomizeProduct: (productId: string) => void;
  onReorder: (order: Order) => void;
  onSelectOrderProof: (order: Order) => void;
  wishlistIds?: string[];
  onToggleWishlist?: (productId: string) => void;
  cartCount?: number;
  onOpenCart?: () => void;
  onOpenQuoteCalculator?: () => void;
  onOpenBundleBuilder?: () => void;
  onOpenAuth?: () => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  user,
  orders: propOrders,
  onUpdateUser,
  onLogout,
  onNavigateTab,
  onCustomizeProduct,
  onReorder,
  onSelectOrderProof,
  wishlistIds = [],
  onToggleWishlist,
  cartCount = 0,
  onOpenCart,
  onOpenQuoteCalculator,
  onOpenBundleBuilder,
  onOpenAuth,
}) => {
  const [activeTab, setActiveTab] = useState<CustomerTab>('overview');
  const [accountSubSection, setAccountSubSection] = useState<AccountSubSection>('profile');
  const [accountMenuExpanded, setAccountMenuExpanded] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Live Supabase Custom Orders Sync
  const [supabaseOrders, setSupabaseOrders] = useState<CustomOrderRow[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncLiveOrders = async () => {
    setIsSyncing(true);
    try {
      const res = await fetchCustomerCustomOrders(user.email, user.mobile);
      setSupabaseOrders(res.data || []);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    setSupabaseOrders([]);
    syncLiveOrders();
  }, [user.id, user.email, user.mobile]);

  // Merged real orders (local React state + live Supabase rows, strictly scoped to this customer)
  const mergedOrders = useMemo(
    () => mergeCustomerOrders(propOrders, supabaseOrders, user),
    [propOrders, supabaseOrders, user]
  );

  // Toast feedback system (never uses window.alert)
  const [toasts, setToasts] = useState<PortalToast[]>([]);
  const pushToast = (message: string, variant: PortalToast['variant'] = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setToasts((prev) => [...prev.slice(-3), { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  };

  // Profile picture quick upload from sidebar
  const sidebarAvatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const handleQuickAvatarUpload = async (file: File) => {
    const check = validateBrandAssetFile(file);
    if (!check.valid || file.name.toLowerCase().endsWith('.pdf')) {
      pushToast('Please select a PNG, JPG, JPEG, or SVG photo (max 15 MB)', 'error');
      return;
    }
    setUploadingAvatar(true);
    try {
      const res = await uploadBrandLogoToStorage(file, `avatar-${user.id}-${file.name}`);
      onUpdateUser({ ...user, avatarUrl: res.publicUrl });
      pushToast('Profile photo updated', 'success');
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        onUpdateUser({ ...user, avatarUrl: String(reader.result || '') });
        pushToast('Profile photo updated locally', 'success');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Persisted per-user Brand Assets (merged with order-submitted artworks)
  const brandStorageKey = `teqqno_brand_assets_${user.id}`;
  const [uploadedAssets, setUploadedAssets] = useState<CustomerArtwork[]>(() => {
    try {
      const saved = localStorage.getItem(brandStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(brandStorageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      setUploadedAssets(Array.isArray(parsed) ? parsed : []);
    } catch {
      setUploadedAssets([]);
    }
  }, [brandStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(brandStorageKey, JSON.stringify(uploadedAssets));
    } catch {
      // ignore
    }
  }, [uploadedAssets, brandStorageKey]);

  const orderDerivedAssets = useMemo(
    () => extractBrandAssetsFromOrders(mergedOrders),
    [mergedOrders]
  );

  const allBrandAssets = useMemo(
    () => [...uploadedAssets, ...orderDerivedAssets],
    [uploadedAssets, orderDerivedAssets]
  );

  // Persisted per-user Bulk RFQs
  const rfqStorageKey = `teqqno_customer_rfqs_${user.id}`;
  const [customerRfqs, setCustomerRfqs] = useState<BulkEnquirySubmission[]>(() => {
    try {
      const saved = localStorage.getItem(rfqStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(rfqStorageKey);
      const parsed = saved ? JSON.parse(saved) : [];
      setCustomerRfqs(Array.isArray(parsed) ? parsed : []);
    } catch {
      setCustomerRfqs([]);
    }
  }, [rfqStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(rfqStorageKey, JSON.stringify(customerRfqs));
    } catch {
      // ignore
    }
  }, [customerRfqs, rfqStorageKey]);

  // Derived Invoices (real orders)
  const invoices = useMemo(() => deriveInvoicesFromOrders(mergedOrders), [mergedOrders]);

  // Persisted read notifications
  const notifReadKey = `teqqno_notif_read_${user.id}`;
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(notifReadKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(notifReadKey);
      const parsed = saved ? JSON.parse(saved) : [];
      setReadNotifIds(Array.isArray(parsed) ? parsed : []);
    } catch {
      setReadNotifIds([]);
    }
  }, [notifReadKey]);

  const [notifPopoverOpen, setNotifPopoverOpen] = useState(false);

  const notifications = useMemo(
    () => deriveNotificationsFromOrders(mergedOrders, customerRfqs, readNotifIds),
    [mergedOrders, customerRfqs, readNotifIds]
  );
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  const markAllNotifsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotifIds(allIds);
    try {
      localStorage.setItem(notifReadKey, JSON.stringify(allIds));
    } catch {
      // ignore
    }
    pushToast('All notifications marked as read', 'info');
  };

  // Synced Wishlist
  const [localWishlistIds, setLocalWishlistIds] = useState<string[]>(wishlistIds);
  useEffect(() => {
    setLocalWishlistIds(wishlistIds);
  }, [wishlistIds]);

  const activeWishlistIds = onToggleWishlist ? wishlistIds : localWishlistIds;
  const wishlistProducts = useMemo(
    () => PRODUCTS.filter((p) => activeWishlistIds.includes(p.id)),
    [activeWishlistIds]
  );

  const handleToggleWish = (productId: string) => {
    if (onToggleWishlist) {
      onToggleWishlist(productId);
    } else {
      setLocalWishlistIds((prev) =>
        prev.includes(productId) ? prev.filter((id) => id !== productId) : [productId, ...prev]
      );
    }
    pushToast('Updated saved wishlist', 'info');
  };

  // Analytics Chart Timeframe + Real Series + Donut Breakdown
  const [chartDays, setChartDays] = useState<7 | 30 | 90>(30);
  const analyticsSeries = useMemo(
    () => buildOrderAnalyticsSeries(mergedOrders, chartDays),
    [mergedOrders, chartDays]
  );
  const statusBreakdown = useMemo(
    () => computeStatusBreakdown(mergedOrders),
    [mergedOrders]
  );

  // KPI Metrics (100% Real Data)
  const totalOrdersCount = mergedOrders.length;
  const activeProductionCount = mergedOrders.filter(
    (o) => o.orderStatus !== 'Delivered'
  ).length;
  const invoicesCount = invoices.length;
  const brandAssetsCount = allBrandAssets.length;

  // Sparkline series from real order timeline (padded gently for visual balance if < 2 points)
  const orderSparkPoints = analyticsSeries.map((pt) => pt.ordersCount);
  const valueSparkPoints = analyticsSeries.map((pt) => pt.revenue);

  // Order Table Filtering, Sorting, Pagination & Detail Drawer
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState<
    'All' | 'Artwork Verification' | 'Confirmed' | 'Manufacturing' | 'Dispatched' | 'Delivered'
  >('All');
  const [orderSort, setOrderSort] = useState<'newest' | 'oldest' | 'highest'>('newest');
  const [ordersPage, setOrdersPage] = useState(1);
  const ORDERS_PER_PAGE = 6;

  const [detailDrawerOrder, setDetailDrawerOrder] = useState<Order | null>(null);
  const [trackTargetOrder, setTrackTargetOrder] = useState<Order | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    const list = mergedOrders.filter((o) => {
      const matchesStatus = orderFilter === 'All' || o.orderStatus === orderFilter;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.items.some(
          (it) =>
            it.product.name.toLowerCase().includes(q) ||
            it.printMethod.toLowerCase().includes(q) ||
            (it.color?.name || '').toLowerCase().includes(q)
        )
      );
    });

    return [...list].sort((a, b) => {
      if (orderSort === 'highest') return b.total - a.total;
      const ta = new Date(a.createdAt).getTime();
      const tb = new Date(b.createdAt).getTime();
      return orderSort === 'oldest' ? ta - tb : tb - ta;
    });
  }, [mergedOrders, orderSearch, orderFilter, orderSort]);

  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const pagedOrders = filteredOrders.slice(
    (ordersPage - 1) * ORDERS_PER_PAGE,
    ordersPage * ORDERS_PER_PAGE
  );

  useEffect(() => {
    setOrdersPage(1);
  }, [orderSearch, orderFilter, orderSort]);

  // Helper to apply saved brand logo onto product in customizer
  const handleApplyAssetToProduct = (asset: CustomerArtwork, productId: string) => {
    try {
      sessionStorage.setItem(
        'teqqno_pending_brand_asset',
        JSON.stringify({ title: asset.title, url: asset.previewUrl })
      );
    } catch {
      // ignore
    }
    pushToast(`Applying "${asset.title}" in Product Customizer`, 'success');
    onCustomizeProduct(productId);
  };

  // Global Sign-Out handler (signs out Supabase Auth + clears local profile)
  const handleFullLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    onLogout();
  };

  // Navigation Helper
  const goToTab = (tab: CustomerTab, sub?: AccountSubSection) => {
    setActiveTab(tab);
    if (sub) setAccountSubSection(sub);
    setMobileDrawerOpen(false);
    setOpenActionMenuId(null);
  };

  // Sidebar items definition
  const primaryNavItems: Array<{
    id: CustomerTab;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'overview', label: 'Dashboard Overview', icon: <Home className="w-4 h-4" /> },
    {
      id: 'orders',
      label: 'My Orders & Proofs',
      icon: <Package className="w-4 h-4" />,
      badge: totalOrdersCount,
    },
    { id: 'track', label: 'Track Consignment', icon: <Truck className="w-4 h-4" /> },
    {
      id: 'artworks',
      label: 'My Artwork & Logos',
      icon: <Palette className="w-4 h-4" />,
      badge: brandAssetsCount,
    },
    { id: 'brand-assets', label: 'My Brand Assets', icon: <Layers className="w-4 h-4" /> },
    { id: 'addresses', label: 'Saved Addresses', icon: <MapPin className="w-4 h-4" /> },
    { id: 'gst-invoices', label: 'GST & Invoices', icon: <FileText className="w-4 h-4" /> },
    { id: 'quotes', label: 'Bulk RFQ Enquiries', icon: <Building2 className="w-4 h-4" /> },
    {
      id: 'wishlist',
      label: 'Saved Wishlist',
      icon: <Heart className="w-4 h-4" />,
      badge: wishlistProducts.length,
    },
  ];

  // Shared Sidebar Content (Desktop/Tablet fixed + Mobile Drawer)
  const renderSidebarBody = () => (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#0B1530] via-[#091834] to-[#071B35] text-white select-none overflow-hidden">
      {/* Brand Logo (Pinned at top) */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between border-b border-white/10 shrink-0">
        <button
          type="button"
          onClick={() => onNavigateTab('home')}
          className="flex items-center gap-2.5 text-left cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#FF7900] flex items-center justify-center font-display font-bold text-white text-lg shadow-lg shadow-[#FF7900]/30 group-hover:scale-105 transition-transform">
            T
          </div>
          <div>
            <div className="font-display font-bold text-lg tracking-tight leading-none text-white">
              Teqqno<span className="text-[#FF7900]">World</span>
            </div>
            <div className="text-[9px] font-semibold tracking-widest text-slate-400 uppercase mt-1">
              PRINTING · BRANDING · SOLUTIONS
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(false)}
          aria-label="Close sidebar"
          className="lg:hidden p-2 rounded-xl bg-white/10 text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Inner Area (Profile + Nav + Promo) so shorter tablet landscape screens never clip nav items */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar flex flex-col">
      {/* Customer Profile Card inside Sidebar */}
      <div className="px-5 py-4 flex flex-col items-center text-center border-b border-white/10 shrink-0">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-white text-[#0B1530] flex items-center justify-center overflow-hidden border-[3px] border-white/85 shadow-xl">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold font-display">
                {user.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <input
            ref={sidebarAvatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleQuickAvatarUpload(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={uploadingAvatar}
            onClick={() => sidebarAvatarInputRef.current?.click()}
            title="Upload or change profile picture"
            aria-label="Change profile picture"
            className="absolute -bottom-0.5 -right-0.5 w-8 h-8 rounded-full bg-[#FF7900] hover:bg-[#ff8a20] text-white flex items-center justify-center border-2 border-[#0B1530] shadow-md cursor-pointer transition-transform hover:scale-105"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>

        <h2 className="mt-3 text-sm font-bold text-white font-display leading-snug max-w-full truncate">
          {user.name}
        </h2>
        <p className="text-[11px] text-slate-300 mt-0.5 max-w-full truncate">
          {user.companyName || (user.accountType === 'business' ? 'Business Account' : 'Individual Customer')}
        </p>

        {/* Conditional Verified Account badge ONLY when user.isVerified is true */}
        {user.isVerified && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified Account</span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav aria-label="Customer Dashboard Navigation" className="px-3 py-3 space-y-1 shrink-0">
        {primaryNavItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => goToTab(item.id)}
              className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[42px] ${
                active
                  ? 'bg-gradient-to-r from-[#FF7900] to-[#ff8c24] text-white shadow-md shadow-[#FF7900]/25'
                  : 'text-slate-300 hover:text-white hover:bg-white/8'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className={active ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badge === 'number' && item.badge > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums shrink-0 ${
                    active ? 'bg-white/25 text-white' : 'bg-[#FF7900] text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        {/* Collapsible Account & Security Menu */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setAccountMenuExpanded((p) => !p)}
            className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[42px] ${
              activeTab === 'account-security'
                ? 'bg-white/12 text-white border border-white/15'
                : 'text-slate-300 hover:text-white hover:bg-white/8'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Account & Security</span>
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                accountMenuExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>

          {accountMenuExpanded && (
            <div className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-1">
              {(
                [
                  { id: 'profile', label: 'Update Profile' },
                  { id: 'password', label: 'Change Password' },
                  { id: 'notifications', label: 'Notification Preferences' },
                  { id: 'gst', label: 'Billing & GST Details' },
                  { id: 'security', label: 'Security Settings' },
                ] as { id: AccountSubSection; label: string }[]
              ).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => goToTab('account-security', sub.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                    activeTab === 'account-security' && accountSubSection === sub.id
                      ? 'text-[#FF7900] bg-white/5 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => goToTab('support')}
          className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[42px] ${
            activeTab === 'support'
              ? 'bg-gradient-to-r from-[#FF7900] to-[#ff8c24] text-white shadow-md shadow-[#FF7900]/25'
              : 'text-slate-300 hover:text-white hover:bg-white/8'
          }`}
        >
          <HelpCircle className="w-4 h-4 text-slate-400" />
          <span>Help & Support</span>
        </button>
      </nav>

      {/* Bottom Promo Card */}
      <div className="p-3.5 mt-auto shrink-0">
        <div className="rounded-2xl bg-gradient-to-br from-[#13254D] via-[#0F1E3F] to-[#081228] border border-white/10 p-4 relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-[#FF7900]/25 blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-2.5">
            <img
              src="/assets/categories/cat_gift_sets.webp"
              alt="Corporate Gifting"
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-xl object-cover border border-white/15 shrink-0"
            />
            <div className="text-xs font-bold leading-snug text-white">
              Create, Customize and Order Easily
            </div>
          </div>
          <ul className="space-y-1 text-[11px] text-slate-300">
            <li className="flex items-center gap-1.5">
              <span className="text-[#FF7900] font-bold">✓</span> Branded Products
            </li>
            <li className="flex items-center gap-1.5">
              <span className="text-[#FF7900] font-bold">✓</span> Corporate Gifting
            </li>
            <li className="flex items-center gap-1.5">
              <span className="text-[#FF7900] font-bold">✓</span> Bulk & Custom Orders
            </li>
          </ul>
          <button
            type="button"
            onClick={() => onNavigateTab('customizer')}
            aria-label="Start new custom order"
            className="mt-3 w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-[#FF7900] text-white text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Start Customizing</span>
            <span className="w-6 h-6 rounded-full bg-[#FF7900] flex items-center justify-center">
              <ArrowRight className="w-3.5 h-3.5 text-white" />
            </span>
          </button>
        </div>
      </div>
      </div>
    </div>
  );

  // Order Rows Renderer (shared between Overview Recent Orders & Full Orders Tab)
  const renderOrderActions = (order: Order) => (
    <div className="flex items-center justify-end gap-1.5 relative">
      <button
        type="button"
        onClick={() => {
          setDetailDrawerOrder(order);
          setOpenActionMenuId(null);
        }}
        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
      >
        <Eye className="w-3 h-3" />
        <span className="hidden xl:inline">View</span>
      </button>
      <button
        type="button"
        onClick={() => onSelectOrderProof(order)}
        className="px-2.5 py-1.5 rounded-lg bg-[#0B1530] hover:bg-[#132550] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
      >
        <span>Proof Studio</span>
        <ExternalLink className="w-3 h-3 text-[#FF7900]" />
      </button>
      <button
        type="button"
        onClick={() => {
          setTrackTargetOrder(order);
          goToTab('track');
        }}
        className="px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
      >
        <MapPin className="w-3 h-3 text-slate-500" />
        <span>Track</span>
      </button>
      <button
        type="button"
        onClick={() => {
          onReorder(order);
          pushToast(`Added items from #${order.orderNumber} to cart`, 'success');
        }}
        className="px-2.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200/80 text-[#FF7900] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
      >
        <ShoppingBag className="w-3 h-3" />
        <span>Reorder</span>
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() =>
            setOpenActionMenuId((prev) => (prev === order.id ? null : order.id))
          }
          aria-label={`More actions for ${order.orderNumber}`}
          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {openActionMenuId === order.id && (
          <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-left">
            <button
              type="button"
              onClick={() => {
                setDetailDrawerOrder(order);
                setOpenActionMenuId(null);
              }}
              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-slate-500" />
              <span>View Order Details</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const ok = generateOrderTaxInvoicePdf(order);
                setOpenActionMenuId(null);
                pushToast(
                  ok ? `Downloaded Tax Invoice for #${order.orderNumber}` : 'PDF error',
                  ok ? 'success' : 'error'
                );
              }}
              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Download GST Invoice PDF</span>
            </button>
            <a
              href={getWhatsAppLink(`Hi TeqqnoWorld, help with Order #${order.orderNumber}`)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpenActionMenuId(null)}
              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#1EBE5D]" />
              <span>WhatsApp Support</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );

  // Manage Account 8-Tile Palette
  const accountTiles: Array<{
    title: string;
    icon: React.ReactNode;
    cardClass: string;
    iconColor: string;
    action: () => void;
  }> = [
    {
      title: 'Update Profile',
      icon: <User className="w-5 h-5" />,
      cardClass: 'bg-purple-50/80 hover:bg-purple-100/80 border-purple-200/70',
      iconColor: 'text-purple-600',
      action: () => goToTab('account-security', 'profile'),
    },
    {
      title: 'Change Password',
      icon: <Lock className="w-5 h-5" />,
      cardClass: 'bg-rose-50/80 hover:bg-rose-100/80 border-rose-200/70',
      iconColor: 'text-rose-600',
      action: () => goToTab('account-security', 'password'),
    },
    {
      title: 'Manage & Brand Kit',
      icon: <Palette className="w-5 h-5" />,
      cardClass: 'bg-emerald-50/80 hover:bg-emerald-100/80 border-emerald-200/70',
      iconColor: 'text-emerald-600',
      action: () => goToTab('brand-assets'),
    },
    {
      title: 'Saved Addresses',
      icon: <MapPin className="w-5 h-5" />,
      cardClass: 'bg-violet-50/80 hover:bg-violet-100/80 border-violet-200/70',
      iconColor: 'text-violet-600',
      action: () => goToTab('addresses'),
    },
    {
      title: 'Notification Preferences',
      icon: <Bell className="w-5 h-5" />,
      cardClass: 'bg-orange-50/80 hover:bg-orange-100/80 border-orange-200/70',
      iconColor: 'text-[#FF7900]',
      action: () => goToTab('account-security', 'notifications'),
    },
    {
      title: 'Billing & GST Details',
      icon: <FileText className="w-5 h-5" />,
      cardClass: 'bg-sky-50/80 hover:bg-sky-100/80 border-sky-200/70',
      iconColor: 'text-sky-600',
      action: () => goToTab('gst-invoices'),
    },
    {
      title: 'Order History & Downloads',
      icon: <Download className="w-5 h-5" />,
      cardClass: 'bg-teal-50/80 hover:bg-teal-100/80 border-teal-200/70',
      iconColor: 'text-teal-600',
      action: () => goToTab('orders'),
    },
    {
      title: 'Account Settings',
      icon: <SlidersHorizontal className="w-5 h-5" />,
      cardClass: 'bg-indigo-50/80 hover:bg-indigo-100/80 border-indigo-200/70',
      iconColor: 'text-indigo-600',
      action: () => goToTab('account-security', 'security'),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#0B1530] flex flex-col lg:flex-row w-full max-w-full overflow-x-clip">
      {/* Desktop & Landscape Tablet Viewport-Pinned Dark Navy Sidebar (never scrolls away or leaves white gap) */}
      <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-[272px] bg-[#071B35] shadow-xl z-30">
        {renderSidebarBody()}
      </aside>

      {/* Mobile & Portrait Tablet Slide-Out Sidebar Drawer */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-[#0B1530]/60 backdrop-blur-xs flex"
          onClick={() => setMobileDrawerOpen(false)}
        >
          <div
            className="w-[280px] max-w-[85vw] h-[100dvh] bg-[#071B35] shadow-2xl animate-admin-slide-left"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarBody()}
          </div>
        </div>
      )}

      {/* Main Content Area (offset by fixed 272px sidebar on lg+) */}
      <div className="flex-1 min-w-0 flex flex-col lg:pl-[272px]">
        {/* Top Portal Utility Header */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open portal navigation"
              className="lg:hidden min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-[#0B1530] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('home')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#0B1530] cursor-pointer min-h-[40px]"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#FF7900]" />
              <span className="hidden sm:inline">Back to Storefront</span>
              <span className="sm:hidden">Store</span>
            </button>

            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-medium pl-2">
              <span>Customer Portal</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-[#0B1530] font-semibold capitalize">
                {activeTab.replace('-', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                syncLiveOrders();
                pushToast('Synced live orders from factory database', 'info');
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer min-h-[40px]"
              title="Refresh live order updates"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#FF7900]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {onOpenCart && (
              <button
                type="button"
                onClick={onOpenCart}
                className="relative px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#0B1530] inline-flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                aria-label="Open shopping cart"
              >
                <ShoppingBag className="w-4 h-4 text-[#FF7900]" />
                <span className="hidden sm:inline">Cart</span>
                {cartCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#FF7900] text-white text-[10px] font-bold tabular-nums">
                    {cartCount}
                  </span>
                )}
              </button>
            )}

            {/* Notifications Bell & Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifPopoverOpen((p) => !p)}
                aria-label="Notifications"
                className="relative min-w-[40px] min-h-[40px] px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-[#0B1530] cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF7900] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {notifPopoverOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setNotifPopoverOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-1.5rem))] sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-40 animate-admin-scale-in">
                  <div className="px-4 py-3 bg-[#0B1530] text-white flex items-center justify-between">
                    <span className="text-xs font-bold">
                      Alerts & Proof Updates ({notifications.length})
                    </span>
                    {unreadNotifCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllNotifsRead}
                        className="text-[11px] font-semibold text-[#FF7900] hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        You're all caught up! Order & proof updates will appear here.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setNotifPopoverOpen(false);
                            if (n.orderId) {
                              const match = mergedOrders.find((o) => o.id === n.orderId);
                              if (match) setDetailDrawerOrder(match);
                            }
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${
                            n.read ? 'opacity-75' : 'bg-orange-50/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-[#0B1530]">{n.title}</span>
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-[#FF7900] shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                            {n.message}
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            {n.timestamp}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => goToTab('account-security', 'profile')}
              className="hidden sm:inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 hover:border-[#FF7900]/50 bg-white cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-[#0B1530] text-white text-xs font-bold flex items-center justify-center overflow-hidden">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-xs font-bold text-[#0B1530] max-w-[110px] truncate">
                {user.name.split(' ')[0]}
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable Content Workspace */}
        <main className="flex-1 p-3.5 sm:p-5 lg:p-6 max-w-[1440px] w-full mx-auto space-y-5">
          {/* ==============================================================
              TAB: DASHBOARD OVERVIEW (REFERENCE LAYOUT)
             ============================================================== */}
          {activeTab === 'overview' && (
            <>
              {/* 1. Premium Navy Welcome Banner */}
              <section className="rounded-3xl bg-gradient-to-r from-[#071B35] via-[#0B1530] to-[#1A1A2E] text-white p-5 sm:p-7 shadow-xl border border-white/10 relative overflow-hidden">
                {/* Animated subtle orange glow */}
                <div className="animate-portal-glow pointer-events-none absolute -right-10 -bottom-16 w-80 h-80 rounded-full bg-gradient-to-tr from-[#FF7900]/45 via-[#FF7900]/20 to-transparent blur-3xl" />
                <div className="pointer-events-none absolute left-1/3 -top-20 w-72 h-72 rounded-full bg-blue-500/15 blur-3xl" />

                <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                  <div className="space-y-3 max-w-xl">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-bold font-display leading-tight">
                        Welcome back,{' '}
                        <span className="text-[#FF7900]">{user.name}!</span>
                      </h1>
                      <p className="text-xs sm:text-sm text-slate-300 mt-1.5">
                        Manage your orders, designs, brand assets and account, all in one place.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {user.isVerified && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Verified Account</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-slate-200 text-xs font-medium">
                        <User className="w-3.5 h-3.5 text-[#FF7900]" />
                        <span>{getPortalGreetingSubtext(user)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Product Visuals + Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
                    {/* Curated Local Product Visual Cluster */}
                    <div className="hidden md:flex items-center -space-x-2.5">
                      {[
                        { src: '/assets/categories/cat_polos.webp', alt: 'Custom Polo Shirt' },
                        {
                          src: '/assets/aistudio/Blank_White_Ceramic_Mug_b82bfadb.webp',
                          alt: 'Custom Ceramic Mug',
                        },
                        { src: '/assets/categories/cat_caps.webp', alt: 'Custom Branded Cap' },
                        { src: '/assets/categories/cat_gift_sets.webp', alt: 'Corporate Gift Box' },
                      ].map((prod) => (
                        <div
                          key={prod.alt}
                          className="w-16 h-16 rounded-2xl bg-white/95 border-2 border-[#FF7900]/40 shadow-lg overflow-hidden p-1 hover:-translate-y-1 transition-transform"
                        >
                          <img
                            src={prod.src}
                            alt={prod.alt}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain rounded-xl"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => onNavigateTab('customizer')}
                        className="flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-[#FF7900] hover:bg-[#ff881c] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-[#FF7900]/30 transition-all cursor-pointer min-h-[44px]"
                      >
                        <Plus className="w-4 h-4" />
                        <span>New Custom Order</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleFullLogout}
                        className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px]"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. Four Real-Data KPI Cards */}
              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <CustomerKpiCard
                  id="orders-placed"
                  title="Total Orders Placed"
                  value={totalOrdersCount}
                  badgeText={totalOrdersCount > 0 ? 'Synced' : undefined}
                  subtitle="Confirmed & queued custom orders"
                  theme="orange"
                  icon={<Package className="w-5 h-5" />}
                  sparkPoints={orderSparkPoints}
                  onClick={() => goToTab('orders')}
                />
                <CustomerKpiCard
                  id="active-prod"
                  title="Active In Production"
                  value={activeProductionCount}
                  subtitle="In progress & proof review orders"
                  theme="blue"
                  icon={<Clock className="w-5 h-5" />}
                  sparkPoints={orderSparkPoints}
                  onClick={() => goToTab('track')}
                />
                <CustomerKpiCard
                  id="tax-invoices"
                  title="GST / Tax Invoices"
                  value={invoicesCount}
                  subtitle="Official SAC 9989 GST documents"
                  theme="green"
                  icon={<FileText className="w-5 h-5" />}
                  sparkPoints={valueSparkPoints}
                  onClick={() => goToTab('gst-invoices')}
                />
                <CustomerKpiCard
                  id="brand-assets"
                  title="Brand Assets"
                  value={brandAssetsCount}
                  subtitle="Logos & order-ready artworks"
                  theme="violet"
                  icon={<Layers className="w-5 h-5" />}
                  sparkPoints={brandAssetsCount > 0 ? [1, 2, brandAssetsCount] : [0, 0, 0]}
                  onClick={() => goToTab('brand-assets')}
                />
              </section>

              {/* 3. Quick Actions Functional Strip */}
              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs px-4 py-3.5 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0B1530] mr-1">
                  <Sparkles className="w-4 h-4 text-[#FF7900]" />
                  <span>Quick Actions:</span>
                </span>

                <button
                  type="button"
                  onClick={() =>
                    onOpenQuoteCalculator
                      ? onOpenQuoteCalculator()
                      : onNavigateTab('quote-calculator')
                  }
                  className="px-3.5 py-2 rounded-xl bg-[#0B1530] hover:bg-[#132550] text-white text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer min-h-[40px]"
                >
                  <Calculator className="w-3.5 h-3.5 text-[#FF7900]" />
                  <span>B2B Quote Calculator</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onOpenBundleBuilder
                      ? onOpenBundleBuilder()
                      : onNavigateTab('bundle-builder')
                  }
                  className="px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#FF7900] text-xs font-bold inline-flex items-center gap-2 transition-all cursor-pointer min-h-[40px]"
                >
                  <Gift className="w-3.5 h-3.5" />
                  <span>Gift Bundle Builder</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab('customizer')}
                  className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0B1530] text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer min-h-[40px]"
                >
                  <PenTool className="w-3.5 h-3.5 text-slate-600" />
                  <span>Customize Product</span>
                </button>

                <button
                  type="button"
                  onClick={() => goToTab('brand-assets')}
                  className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0B1530] text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer min-h-[40px]"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  <span>Upload / Manage Logo</span>
                </button>

                <button
                  type="button"
                  onClick={() => goToTab('quotes')}
                  className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0B1530] text-xs font-semibold inline-flex items-center gap-2 transition-all cursor-pointer min-h-[40px]"
                >
                  <Building2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>Bulk RFQ</span>
                </button>
              </section>

              {/* 4. Orders Analytics Charts (Area Chart + Donut Chart) */}
              <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                <div className="xl:col-span-7">
                  <OrdersAreaChart
                    series={analyticsSeries}
                    days={chartDays}
                    onChangeDays={setChartDays}
                  />
                </div>
                <div className="xl:col-span-5">
                  <OrderStatusDonut
                    total={statusBreakdown.total}
                    segments={statusBreakdown.segments}
                    onSelectStatus={(segKey) => {
                      if (segKey === 'pending') setOrderFilter('Artwork Verification');
                      else if (segKey === 'production') setOrderFilter('Manufacturing');
                      else if (segKey === 'dispatched') setOrderFilter('Dispatched');
                      else if (segKey === 'delivered') setOrderFilter('Delivered');
                      goToTab('orders');
                    }}
                  />
                </div>
              </section>

              {/* 5. Recent Orders Snapshot Table & Mobile Cards */}
              <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/70 text-[#FF7900] flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0B1530] font-display">
                        Recent Orders
                      </h3>
                      <p className="text-xs text-slate-500">
                        Live manufacturing status, proof reviews and order tracking.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToTab('orders')}
                    className="text-xs font-bold text-[#FF7900] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All Orders ({totalOrdersCount})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {mergedOrders.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <Package className="w-10 h-10 text-slate-300 mx-auto" />
                    <div className="text-sm font-bold text-[#0B1530]">No orders placed yet</div>
                    <p className="text-xs text-slate-500">
                      Customize a product to place your first order and track live proofs here.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                            <th className="py-3 px-4">Order ID & Date</th>
                            <th className="py-3 px-4">Product Details</th>
                            <th className="py-3 px-4">Amount</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {mergedOrders.slice(0, 4).map((order) => {
                            const first = order.items[0];
                            const thumb = getThumbnailForOrder(order);
                            const badge = getOrderStatusBadgeMeta(order.orderStatus);
                            const totalUnits = order.items.reduce(
                              (sum, it) => sum + (it.quantity || 1),
                              0
                            );

                            return (
                              <tr
                                key={order.id}
                                className="hover:bg-slate-50/70 transition-colors"
                              >
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3">
                                    <AssetPreviewThumb
                                      src={thumb}
                                      alt={first?.product?.name || order.orderNumber}
                                      className="w-12 h-12 rounded-xl"
                                    />
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => setDetailDrawerOrder(order)}
                                        className="font-bold text-[#FF7900] hover:underline text-sm cursor-pointer"
                                      >
                                        {order.orderNumber}
                                      </button>
                                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 tabular-nums">
                                        <Calendar className="w-3 h-3 text-slate-400" />
                                        <span>
                                          {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 max-w-xs">
                                  <div className="font-bold text-[#0B1530] truncate">
                                    {first?.product?.name?.split('|')[0]?.trim() ||
                                      'Custom Merchandise'}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    {totalUnits} pcs • {first?.color?.name || 'Custom'} •{' '}
                                    {first?.printMethod || 'DTF Printing'}
                                  </div>
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-[#0B1530] tabular-nums">
                                    ₹{Math.round(order.total).toLocaleString('en-IN')}
                                  </div>
                                  <div className="text-[11px] text-slate-500">(incl. 18% GST)</div>
                                </td>

                                <td className="py-3.5 px-4">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap ${badge.pillClass}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                                    {badge.label}
                                  </span>
                                </td>

                                <td className="py-3.5 px-4 text-right">
                                  {renderOrderActions(order)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Stacked Cards */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {mergedOrders.slice(0, 4).map((order) => {
                        const first = order.items[0];
                        const thumb = getThumbnailForOrder(order);
                        const badge = getOrderStatusBadgeMeta(order.orderStatus);
                        const totalUnits = order.items.reduce(
                          (sum, it) => sum + (it.quantity || 1),
                          0
                        );
                        return (
                          <div key={order.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <AssetPreviewThumb
                                  src={thumb}
                                  alt={first?.product?.name || order.orderNumber}
                                  className="w-12 h-12 rounded-xl"
                                />
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => setDetailDrawerOrder(order)}
                                    className="font-bold text-sm text-[#FF7900]"
                                  >
                                    #{order.orderNumber}
                                  </button>
                                  <div className="text-xs font-bold text-[#0B1530] truncate">
                                    {first?.product?.name?.split('|')[0]?.trim()}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {totalUnits} pcs • ₹{Math.round(order.total).toLocaleString('en-IN')}
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0 ${badge.pillClass}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                                {badge.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => onSelectOrderProof(order)}
                                className="flex-1 py-2 px-3 rounded-xl bg-[#0B1530] text-white text-xs font-semibold min-h-[40px]"
                              >
                                Proof Studio
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTrackTargetOrder(order);
                                  goToTab('track');
                                }}
                                className="py-2 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold min-h-[40px]"
                              >
                                Track
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onReorder(order);
                                  pushToast(`Added #${order.orderNumber} to cart`, 'success');
                                }}
                                className="py-2 px-3 rounded-xl bg-orange-50 text-[#FF7900] text-xs font-bold min-h-[40px]"
                              >
                                Reorder
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </section>

              {/* 6. Bottom Split Row: Master Brand Assets + Manage Account & Preferences */}
              <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                {/* Master Brand Assets */}
                <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/70 text-[#FF7900] flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#0B1530] font-display">
                          Master Brand Assets
                        </h3>
                        <p className="text-xs text-slate-500">
                          Your approved logos, artwork and brand resources.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => goToTab('brand-assets')}
                      className="text-xs font-bold text-[#FF7900] hover:underline inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>Manage Artworks</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {allBrandAssets.length === 0 ? (
                    <div className="p-5 rounded-2xl bg-slate-50 border border-dashed border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-xs text-slate-600 text-center sm:text-left">
                        <strong className="text-[#0B1530] block">No brand logos saved yet</strong>
                        Upload your PNG, SVG, or PDF logo once and apply it to any product in 1 click.
                      </div>
                      <button
                        type="button"
                        onClick={() => goToTab('brand-assets')}
                        className="px-4 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload Logo</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {allBrandAssets.slice(0, 2).map((asset) => (
                        <div
                          key={asset.id}
                          className="p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 flex items-center justify-between gap-2.5 hover:border-[#FF7900]/40 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AssetPreviewThumb
                              src={asset.previewUrl}
                              alt={asset.title}
                              isPdf={asset.fileType === 'pdf'}
                              className="w-12 h-12 rounded-xl bg-white"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#0B1530] truncate">
                                {asset.title}
                              </div>
                              <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                {asset.status}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleApplyAssetToProduct(asset, PRODUCTS[0].id)}
                            title="Apply logo to product"
                            className="p-2 rounded-xl bg-white border border-slate-200 hover:border-[#FF7900] text-[#0B1530] cursor-pointer shrink-0"
                          >
                            <ArrowRight className="w-3.5 h-3.5 text-[#FF7900]" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Manage Account & Preferences 8-Tile Grid */}
                <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/70 text-[#FF7900] flex items-center justify-center shrink-0">
                      <Settings className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-[#0B1530] font-display">
                        Manage Account & Preferences
                      </h3>
                      <p className="text-xs text-slate-500">
                        Quick access to profile, security, billing & addresses.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {accountTiles.map((tile) => (
                      <button
                        key={tile.title}
                        type="button"
                        onClick={tile.action}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm cursor-pointer min-h-[92px] ${tile.cardClass}`}
                      >
                        <span className={tile.iconColor}>{tile.icon}</span>
                        <span className="text-[11px] font-bold text-[#0B1530] leading-tight">
                          {tile.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {/* ==============================================================
              TAB: MY ORDERS & PROOFS (FULL SEARCH, FILTER, SORT, PAGINATION)
             ============================================================== */}
          {activeTab === 'orders' && (
            <section className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-[#0B1530] font-display flex items-center gap-2">
                      <Package className="w-5 h-5 text-[#FF7900]" />
                      <span>My Orders & Proofs ({filteredOrders.length})</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Inspect order proofs, live production status, GST invoices & courier AWBs
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('customizer')}
                    className="px-4 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer min-h-[44px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Custom Order</span>
                  </button>
                </div>

                {/* Search + Status Filter + Sort */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      placeholder="Search by Order ID, Product Name, Color or Print Method..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label="Filter orders by status"
                      value={orderFilter}
                      onChange={(e) => setOrderFilter(e.target.value as any)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#0B1530]"
                    >
                      <option value="All">All Stages</option>
                      <option value="Artwork Verification">Artwork Verification</option>
                      <option value="Confirmed">Confirmed</option>
                      <option value="Manufacturing">In Production</option>
                      <option value="Dispatched">Dispatched</option>
                      <option value="Delivered">Delivered</option>
                    </select>

                    <select
                      aria-label="Sort orders"
                      value={orderSort}
                      onChange={(e) => setOrderSort(e.target.value as any)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#0B1530]"
                    >
                      <option value="newest">Newest First</option>
                      <option value="oldest">Oldest First</option>
                      <option value="highest">Highest Amount</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                {pagedOrders.length === 0 ? (
                  <div className="p-10 text-center space-y-2">
                    <Search className="w-10 h-10 text-slate-300 mx-auto" />
                    <div className="text-sm font-bold text-[#0B1530]">
                      No orders match your filters
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setOrderSearch('');
                        setOrderFilter('All');
                      }}
                      className="text-xs font-bold text-[#FF7900] hover:underline cursor-pointer"
                    >
                      Clear all filters
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                            <th className="py-3 px-4">Order ID & Date</th>
                            <th className="py-3 px-4">Product & Specifications</th>
                            <th className="py-3 px-4">Amount & Payment</th>
                            <th className="py-3 px-4">Proof & Order Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {pagedOrders.map((order) => {
                            const first = order.items[0];
                            const thumb = getThumbnailForOrder(order);
                            const badge = getOrderStatusBadgeMeta(order.orderStatus);
                            const totalUnits = order.items.reduce(
                              (sum, it) => sum + (it.quantity || 1),
                              0
                            );
                            return (
                              <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3.5 px-4">
                                  <div className="flex items-center gap-3">
                                    <AssetPreviewThumb
                                      src={thumb}
                                      alt={first?.product?.name || order.orderNumber}
                                      className="w-12 h-12 rounded-xl"
                                    />
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => setDetailDrawerOrder(order)}
                                        className="font-bold text-[#FF7900] hover:underline text-sm cursor-pointer"
                                      >
                                        {order.orderNumber}
                                      </button>
                                      <div className="text-[11px] text-slate-500 tabular-nums">
                                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                                          day: '2-digit',
                                          month: 'short',
                                          year: 'numeric',
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 max-w-xs">
                                  <div className="font-bold text-[#0B1530] truncate">
                                    {first?.product?.name?.split('|')[0]?.trim()}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    {totalUnits} pcs • {first?.color?.name || 'Custom'} •{' '}
                                    {first?.printMethod}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <div className="font-bold text-[#0B1530] tabular-nums">
                                    ₹{Math.round(order.total).toLocaleString('en-IN')}
                                  </div>
                                  <div className="text-[10px] font-semibold text-emerald-700">
                                    {order.paymentStatus}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${badge.pillClass}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                                    {badge.label}
                                  </span>
                                  <div className="text-[10px] text-slate-500 mt-1">
                                    {order.proofStatus}
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-right">
                                  {renderOrderActions(order)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {pagedOrders.map((order) => {
                        const first = order.items[0];
                        const thumb = getThumbnailForOrder(order);
                        const badge = getOrderStatusBadgeMeta(order.orderStatus);
                        const totalUnits = order.items.reduce(
                          (sum, it) => sum + (it.quantity || 1),
                          0
                        );
                        return (
                          <div key={order.id} className="p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3 min-w-0">
                                <AssetPreviewThumb
                                  src={thumb}
                                  alt={first?.product?.name || order.orderNumber}
                                  className="w-12 h-12 rounded-xl"
                                />
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => setDetailDrawerOrder(order)}
                                    className="font-bold text-sm text-[#FF7900]"
                                  >
                                    #{order.orderNumber}
                                  </button>
                                  <div className="text-xs font-bold text-[#0B1530] truncate">
                                    {first?.product?.name?.split('|')[0]?.trim()}
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    {totalUnits} pcs • ₹{Math.round(order.total).toLocaleString('en-IN')} •{' '}
                                    {order.paymentStatus}
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold shrink-0 ${badge.pillClass}`}
                              >
                                {badge.label}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailDrawerOrder(order)}
                                className="py-2 px-3 rounded-xl bg-slate-100 text-[#0B1530] text-xs font-semibold min-h-[40px]"
                              >
                                Details
                              </button>
                              <button
                                type="button"
                                onClick={() => onSelectOrderProof(order)}
                                className="flex-1 py-2 px-3 rounded-xl bg-[#0B1530] text-white text-xs font-semibold min-h-[40px]"
                              >
                                Proof Studio
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTrackTargetOrder(order);
                                  goToTab('track');
                                }}
                                className="py-2 px-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold min-h-[40px]"
                              >
                                Track
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  onReorder(order);
                                  pushToast(`Added #${order.orderNumber} to cart`, 'success');
                                }}
                                className="py-2 px-3 rounded-xl bg-orange-50 text-[#FF7900] text-xs font-bold min-h-[40px]"
                              >
                                Reorder
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination Footer */}
                    {totalOrderPages > 1 && (
                      <div className="px-5 py-3.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                        <span className="tabular-nums">
                          Page {ordersPage} of {totalOrderPages}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={ordersPage <= 1}
                            onClick={() => setOrdersPage((p) => Math.max(1, p - 1))}
                            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                            aria-label="Previous orders page"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            disabled={ordersPage >= totalOrderPages}
                            onClick={() => setOrdersPage((p) => Math.min(totalOrderPages, p + 1))}
                            className="p-2 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                            aria-label="Next orders page"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          )}

          {/* ==============================================================
              OTHER SUB-VIEWS
             ============================================================== */}
          {activeTab === 'track' && (
            <CustomerTrackConsignmentView
              orders={mergedOrders}
              selectedOrder={trackTargetOrder}
              onSelectOrder={setTrackTargetOrder}
              onToast={pushToast}
            />
          )}

          {(activeTab === 'artworks' || activeTab === 'brand-assets') && (
            <CustomerBrandAssetsView
              mode={activeTab}
              assets={allBrandAssets}
              onAddAsset={(asset) => setUploadedAssets((prev) => [asset, ...prev])}
              onReplaceAsset={(id, updated) =>
                setUploadedAssets((prev) => prev.map((a) => (a.id === id ? updated : a)))
              }
              onDeleteAsset={(id) => {
                setUploadedAssets((prev) => prev.filter((a) => a.id !== id));
                pushToast('Removed brand asset', 'info');
              }}
              onApplyAssetToProduct={handleApplyAssetToProduct}
              onToast={pushToast}
            />
          )}

          {activeTab === 'addresses' && (
            <CustomerAddressesView
              user={user}
              addresses={user.savedAddresses || []}
              onSaveAddresses={(next: SavedAddress[]) =>
                onUpdateUser({ ...user, savedAddresses: next })
              }
              onToast={pushToast}
            />
          )}

          {activeTab === 'gst-invoices' && (
            <CustomerGstInvoicesView
              user={user}
              orders={mergedOrders}
              invoices={invoices}
              onUpdateUser={onUpdateUser}
              onToast={pushToast}
            />
          )}

          {activeTab === 'quotes' && (
            <CustomerBulkRfqView
              user={user}
              rfqs={customerRfqs}
              onAddRfq={(rfq) => setCustomerRfqs((prev) => [rfq, ...prev])}
              onToast={pushToast}
            />
          )}

          {activeTab === 'wishlist' && (
            <CustomerWishlistView
              products={wishlistProducts}
              onCustomizeProduct={onCustomizeProduct}
              onRemoveWishlist={handleToggleWish}
              onExploreCatalog={() => onNavigateTab('catalog')}
            />
          )}

          {activeTab === 'account-security' && (
            <CustomerAccountSecurityView
              user={user}
              subSection={accountSubSection}
              onChangeSubSection={setAccountSubSection}
              onUpdateUser={onUpdateUser}
              onLogout={handleFullLogout}
              onOpenAuth={onOpenAuth}
              onToast={pushToast}
            />
          )}

          {activeTab === 'support' && (
            <CustomerSupportView
              user={user}
              orders={mergedOrders}
              onTrackOrder={(o) => {
                setTrackTargetOrder(o);
                goToTab('track');
              }}
            />
          )}
        </main>
      </div>

      {/* Order Detail Slide-Over Drawer */}
      <OrderDetailDrawer
        order={detailDrawerOrder}
        onClose={() => setDetailDrawerOrder(null)}
        onOpenProofStudio={onSelectOrderProof}
        onTrackOrder={(o) => {
          setTrackTargetOrder(o);
          goToTab('track');
        }}
        onReorder={onReorder}
        onToast={pushToast}
      />

      {/* Toast Notifications */}
      <PortalToastList
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
};
