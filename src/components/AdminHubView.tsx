import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Lock,
  Unlock,
  Package,
  ShoppingCart,
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  Eye,
  Mail,
  BarChart3,
  Layers,
  Download,
  LogOut,
  ArrowLeft,
  X,
  Send,
  MapPin,
  Printer,
  Loader2,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Receipt,
  ArrowUpRight,
  Menu,
  Home,
  Users,
  Megaphone,
  Bell,
  HelpCircle,
  Plus,
  SlidersHorizontal,
  MoreHorizontal,
  Box,
  ShieldCheck,
  KeyRound,
  EyeOff,
  Star,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import {
  CustomOrderRow,
  OrderStatus,
  ProductRow,
  isSupabaseConfigured,
} from '../lib/supabase';
import {
  fetchCustomOrdersFromSupabase,
  fetchProductsFromSupabase,
  updateCustomOrderStatus,
  fetchAbandonedCheckoutsFromSupabase,
  markCheckoutRecovered,
  submitCustomOrderQuote,
} from '../services/supabaseService';
import {
  sendOrderConfirmationEmail,
  getSmtpStatus,
  sendTestEmail,
  SmtpStatusResponse,
} from '../services/emailService';
import {
  getRazorpayStatus,
  testRazorpayConnection,
  getDelhiveryStatus,
  checkDelhiveryPincode,
  createDelhiveryShipment,
  trackDelhiveryWaybill,
  requestDelhiveryPickup,
  getDelhiveryLabelUrl,
  RazorpayStatus,
  DelhiveryStatus,
  DelhiveryTrackResponse,
  DelhiveryPincodeCheckResult,
} from '../services/paymentAndLogisticsService';
import {
  getAiSensyStatus,
  getAiSensyLogs,
  testAiSensyConnection,
  AiSensyStatusResponse,
  WhatsAppDispatchLogItem,
} from '../services/aisensyService';
import { generateAdminOrderInvoicePdf } from '../utils/pdfGenerator';
import { getDirectClientWhatsAppUrl } from '../utils/whatsapp';
import { PRODUCTS } from '../data/mockData';
import {
  AdminSection,
  OrdersSubMode,
  STATUS_META,
  parseOrderNotes,
  getOrderEstimates,
  getOrderThumbnail,
  formatOrderRef,
  getPaymentBadge,
  buildDailyTrendSeries,
  resolveAdminOrderGroupKey,
  resolveAdminLineTotal,
} from './admin/adminUtils';
import { AdminKpiCard, OrderThumb } from './admin/AdminVisuals';
import {
  DashboardOverviewView,
  ProductsCatalogView,
  CustomersDirectoryView,
  MarketingRecoveryView,
  ReportsAnalyticsView,
  DispatchCenterView,
  IntegrationsSetupView,
  AnalyticsSummary,
} from './admin/AdminSubViews';
import { AdminSecurityPanel } from './admin/AdminSecurityPanel';
import { AdminCouponPanel } from './admin/AdminCouponPanel';
import { AdminReviewsPanel } from './admin/AdminReviewsPanel';
import { AdminAffiliatePanel } from './admin/AdminAffiliatePanel';
import { fetchAdminReviews } from '../services/reviewsService';
import {
  clearStoredAdminToken,
  getAdminAuthStatus,
  resendAdminLoginOtp,
  resetAdminPinWithOtp,
  sendAdminPinResetOtp,
  setStoredAdminToken,
  verifyAdminLoginOtp,
  verifyAdminPin,
  verifyAdminSession,
} from '../services/adminSecurityService';

interface AdminHubViewProps {
  onBackToStore: () => void;
  onNavigateToOrderTracking?: (orderNumber: string) => void;
}

const LOGO_BADGE_SRC = '/assets/aistudio/Glossy_TeqqnoWorld_Branding_Badge-photoaidcom-cropped_1055f8dc.png';

export const AdminHubView: React.FC<AdminHubViewProps> = ({
  onBackToStore,
  onNavigateToOrderTracking,
}) => {
  // Server-Authoritative Authentication & Security Gate State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingSession, setCheckingSession] = useState<boolean>(true);
  const [gateMode, setGateMode] = useState<'pin' | 'two_step' | 'locked_reset'>('pin');
  const [pinLocked, setPinLocked] = useState<boolean>(false);
  const [twoStepEnabled, setTwoStepEnabled] = useState<boolean>(true);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [maskedOwnerEmail, setMaskedOwnerEmail] = useState<string>('owner email');

  // Step 1: PIN Entry
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [showEnteredPin, setShowEnteredPin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinSuccess, setPinSuccess] = useState<string | null>(null);
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);

  // Step 2: 2-Step Email OTP Entry
  const [challengeToken, setChallengeToken] = useState<string>('');
  const [loginOtp, setLoginOtp] = useState<string>('');
  const [loginOtpInfo, setLoginOtpInfo] = useState<string>('');
  const [loginOtpCooldown, setLoginOtpCooldown] = useState<number>(0);

  // Step 3: Locked / Forgot PIN -> Owner Email OTP + New PIN
  const [resetPinOtp, setResetPinOtp] = useState<string>('');
  const [newAdminPin, setNewAdminPin] = useState<string>('');
  const [confirmAdminPin, setConfirmAdminPin] = useState<string>('');
  const [resetOtpSent, setResetOtpSent] = useState<boolean>(false);
  const [resetOtpInfo, setResetOtpInfo] = useState<string>('');
  const [resetOtpCooldown, setResetOtpCooldown] = useState<number>(0);

  // Navigation & Responsive UI State
  const [activeSection, setActiveSection] = useState<AdminSection>('orders');
  const [ordersSubMode, setOrdersSubMode] = useState<OrdersSubMode>('queue');
  const [ordersMenuExpanded, setOrdersMenuExpanded] = useState<boolean>(true);
  const [integrationsMenuExpanded, setIntegrationsMenuExpanded] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [ordersViewMode, setOrdersViewMode] = useState<'table' | 'cards'>('table');

  // Header Popovers
  const [bellOpen, setBellOpen] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [profileOpen, setProfileOpen] = useState<boolean>(false);
  const globalSearchRef = useRef<HTMLInputElement | null>(null);

  // Data State
  const [orders, setOrders] = useState<CustomOrderRow[]>([]);
  const [dbProducts, setDbProducts] = useState<ProductRow[]>([]);
  const [abandonedLeads, setAbandonedLeads] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [loadingLeads, setLoadingLeads] = useState<boolean>(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [pendingReviewsCount, setPendingReviewsCount] = useState<number>(0);

  // Orders Filters, Selection & Pagination
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'partial' | 'pending'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest'>('newest');
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);

  // Toast Notifications (non-blocking, zero window.alert)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    const onAdminToast = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: 'success' | 'error'; message?: string }>).detail;
      if (detail?.message) {
        showToast(detail.type === 'error' ? 'error' : 'success', detail.message);
      }
    };
    window.addEventListener('teqqno:admin-toast', onAdminToast);
    return () => window.removeEventListener('teqqno:admin-toast', onAdminToast);
  }, []);

  // Order Inspector Drawer & Modals
  const [inspectingOrder, setInspectingOrder] = useState<CustomOrderRow | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(null);
  const [editingDispatchOrder, setEditingDispatchOrder] = useState<CustomOrderRow | null>(null);
  const [courierInput, setCourierInput] = useState<string>('Delhivery (Teqqnoworld)');
  const [awbInput, setAwbInput] = useState<string>('');
  const [delhiveryPickup, setDelhiveryPickup] = useState<string>('Teqqnoworld');
  const [shipAddress, setShipAddress] = useState<string>('');
  const [shipCity, setShipCity] = useState<string>('');
  const [shipState, setShipState] = useState<string>('');
  const [shipPincode, setShipPincode] = useState<string>('');
  const [shipWeight, setShipWeight] = useState<string>('500');
  const [creatingShipment, setCreatingShipment] = useState<boolean>(false);
  const [shipmentError, setShipmentError] = useState<string | null>(null);

  // Create Manual Order Modal State
  const [createOrderOpen, setCreateOrderOpen] = useState<boolean>(false);
  const [newOrdCustomer, setNewOrdCustomer] = useState<string>('');
  const [newOrdEmail, setNewOrdEmail] = useState<string>('');
  const [newOrdPhone, setNewOrdPhone] = useState<string>('');
  const [newOrdCompany, setNewOrdCompany] = useState<string>('');
  const [newOrdProductId, setNewOrdProductId] = useState<string>(PRODUCTS[0]?.id || 'prod-polo-01');
  const [newOrdQty, setNewOrdQty] = useState<number>(10);
  const [newOrdAddress, setNewOrdAddress] = useState<string>('');
  const [newOrdNotes, setNewOrdNotes] = useState<string>('');
  const [newOrdPaymentPlan, setNewOrdPaymentPlan] = useState<'Full Prepaid (100% Online)' | 'Partial Payment (50% Advance)'>('Full Prepaid (100% Online)');
  const [submittingNewOrder, setSubmittingNewOrder] = useState<boolean>(false);

  // Tracking State
  const [trackingModalData, setTrackingModalData] = useState<DelhiveryTrackResponse | null>(null);
  const [trackingOrderAwb, setTrackingOrderAwb] = useState<string | null>(null);
  const [loadingTrack, setLoadingTrack] = useState<boolean>(false);
  const [quickTrackAwb, setQuickTrackAwb] = useState<string>('');
  const [quickTrackResult, setQuickTrackResult] = useState<DelhiveryTrackResponse | null>(null);
  const [loadingQuickTrack, setLoadingQuickTrack] = useState<boolean>(false);

  // Diagnostics & Tools State
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingEmailOrderId, setSendingEmailOrderId] = useState<string | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<SmtpStatusResponse | null>(null);
  const [razorpayStatus, setRazorpayStatus] = useState<RazorpayStatus | null>(null);
  const [delhiveryStatus, setDelhiveryStatus] = useState<DelhiveryStatus | null>(null);
  const [aisensyStatus, setAiSensyStatus] = useState<AiSensyStatusResponse | null>(null);
  const [aisensyLogs, setAiSensyLogs] = useState<WhatsAppDispatchLogItem[]>([]);
  const [testWaPhone, setTestWaPhone] = useState<string>('');
  const [testingAiSensy, setTestingAiSensy] = useState<boolean>(false);
  const [aisensyTestResult, setAiSensyTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmailInput, setTestEmailInput] = useState<string>('teqqnoworld@gmail.com');
  const [testingSmtp, setTestingSmtp] = useState<boolean>(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testingRazorpay, setTestingRazorpay] = useState<boolean>(false);
  const [razorpayTestResult, setRazorpayTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Delhivery Dispatch Hub Pickup & Pincode Tools
  const [testPinInput, setTestPinInput] = useState<string>('502032');
  const [testingPin, setTestingPin] = useState<boolean>(false);
  const [testPinResult, setTestPinResult] = useState<DelhiveryPincodeCheckResult | null>(null);
  const [diagPickupName, setDiagPickupName] = useState<string>('Teqqnoworld');
  const [pickupDateInput, setPickupDateInput] = useState<string>(
    () => new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [pickupTimeInput, setPickupTimeInput] = useState<string>('14:00:00');
  const [pickupPkgCount, setPickupPkgCount] = useState<number>(1);
  const [schedulingPickup, setSchedulingPickup] = useState<boolean>(false);
  const [pickupResult, setPickupResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadData = async () => {
    setLoadingOrders(true);
    setLoadingLeads(true);
    try {
      const [ordersRes, leadsRes, prodRes, smtpRes, rzpRes, dlvRes, waStatusRes, waLogsRes] = await Promise.all([
        fetchCustomOrdersFromSupabase(),
        fetchAbandonedCheckoutsFromSupabase(),
        fetchProductsFromSupabase(),
        getSmtpStatus(),
        getRazorpayStatus(),
        getDelhiveryStatus(),
        getAiSensyStatus(),
        getAiSensyLogs(),
      ]);
      const loadedOrders = ordersRes.data || [];
      setOrders(loadedOrders);
      setAbandonedLeads(leadsRes.data || []);
      setDbProducts(prodRes.data || []);
      setSmtpStatus(smtpRes);
      setRazorpayStatus(rzpRes);
      setDelhiveryStatus(dlvRes);
      setAiSensyStatus(waStatusRes);
      setAiSensyLogs(waLogsRes.logs || []);
      setPickupPkgCount(Math.max(1, loadedOrders.filter((o) => o.status === 'dispatched').length || 1));
    } catch (err) {
      console.error('[AdminHub Load Error]:', err);
      showToast('error', 'Failed to refresh records from server.');
    } finally {
      setLoadingOrders(false);
      setLoadingLeads(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
      fetchAdminReviews({ status: 'pending' })
        .then((res) => {
          if (res.success && res.kpis) {
            setPendingReviewsCount(res.kpis.pendingCount);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  // Ctrl+K / Cmd+K Quick Search Shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        globalSearchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setBellOpen(false);
        setHelpOpen(false);
        setProfileOpen(false);
        setFiltersOpen(false);
        setOpenRowMenuId(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Verify existing signed session token & fetch Admin Gate lockout/2FA status on mount
  useEffect(() => {
    let active = true;
    const initAdminAuth = async () => {
      try {
        const [sessionValid, status] = await Promise.all([
          verifyAdminSession(),
          getAdminAuthStatus(),
        ]);
        if (!active) return;
        setPinLocked(status.pinLocked);
        setFailedAttempts(status.failedAttempts);
        setTwoStepEnabled(status.twoStepEnabled);
        setMaskedOwnerEmail(status.maskedOwnerEmail || 'owner email');
        if (sessionValid) {
          setIsAuthenticated(true);
        } else {
          clearStoredAdminToken();
          setIsAuthenticated(false);
          if (status.pinLocked) {
            setGateMode('locked_reset');
          }
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    };
    void initAdminAuth();
    return () => {
      active = false;
    };
  }, []);

  // Cooldown timers for Admin OTP resend buttons
  useEffect(() => {
    if (loginOtpCooldown <= 0) return;
    const t = setTimeout(() => setLoginOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [loginOtpCooldown]);

  useEffect(() => {
    if (resetOtpCooldown <= 0) return;
    const t = setTimeout(() => setResetOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [resetOtpCooldown]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [orderSearchQuery, statusFilter, paymentFilter, sortBy, pageSize]);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    if (!enteredPin.trim()) {
      setPinError('Please enter your Admin Master PIN.');
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = await verifyAdminPin(enteredPin.trim());
      if (typeof res.failedAttempts === 'number') setFailedAttempts(res.failedAttempts);
      if (res.maskedOwnerEmail) setMaskedOwnerEmail(res.maskedOwnerEmail);

      if (res.pinLocked) {
        setPinLocked(true);
        setGateMode('locked_reset');
        setEnteredPin('');
        setResetOtpSent(false);
        setResetOtpInfo('');
        setPinError(res.message);
        return;
      }

      if (!res.success) {
        setPinError(res.message || 'Incorrect Admin PIN.');
        return;
      }

      if (res.requiresTwoStep && res.challengeToken) {
        setChallengeToken(res.challengeToken);
        setLoginOtp('');
        setLoginOtpCooldown(30);
        setLoginOtpInfo(
          res.simulated && res.devOtp
            ? `Simulation Mode: Admin login code is ${res.devOtp}.`
            : `PIN verified! 6-digit login code sent to Owner Email (${res.maskedOwnerEmail || maskedOwnerEmail}).`
        );
        setGateMode('two_step');
        return;
      }

      if (res.sessionToken) {
        setStoredAdminToken(res.sessionToken);
        setIsAuthenticated(true);
        setEnteredPin('');
        setPinError(null);
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleVerifyLoginOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    const cleanOtp = loginOtp.replace(/[^0-9]/g, '').trim();
    if (cleanOtp.length !== 6) {
      setPinError('Please enter the 6-digit code sent to Owner Email.');
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await verifyAdminLoginOtp(challengeToken, cleanOtp);
      if (!res.success || !res.sessionToken) {
        setPinError(res.message || 'Invalid verification code.');
        return;
      }
      setStoredAdminToken(res.sessionToken);
      setIsAuthenticated(true);
      setEnteredPin('');
      setLoginOtp('');
      setChallengeToken('');
      setGateMode('pin');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleResendLoginOtpClick = async () => {
    if (loginOtpCooldown > 0 || authSubmitting) return;
    setPinError(null);
    setAuthSubmitting(true);
    try {
      const res = await resendAdminLoginOtp(challengeToken);
      if (!res.success) {
        if (res.retryAfterSec) setLoginOtpCooldown(res.retryAfterSec);
        setPinError(res.message);
        return;
      }
      setLoginOtpCooldown(30);
      setLoginOtpInfo(
        res.simulated && res.devOtp
          ? `Simulation Mode: New code is ${res.devOtp}.`
          : `New 6-digit login code sent to Owner Email (${res.maskedOwnerEmail || maskedOwnerEmail}).`
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSendResetPinOtpClick = async () => {
    if (resetOtpCooldown > 0 || authSubmitting) return;
    setPinError(null);
    setPinSuccess(null);
    setAuthSubmitting(true);
    try {
      const res = await sendAdminPinResetOtp('reset_pin');
      if (!res.success) {
        if (res.retryAfterSec) setResetOtpCooldown(res.retryAfterSec);
        setPinError(res.message);
        return;
      }
      if (res.maskedOwnerEmail) setMaskedOwnerEmail(res.maskedOwnerEmail);
      setResetOtpSent(true);
      setResetOtpCooldown(30);
      setResetOtpInfo(
        res.simulated && res.devOtp
          ? `Simulation Mode: Owner reset code is ${res.devOtp}.`
          : `6-digit Owner verification code sent to ${res.maskedOwnerEmail || maskedOwnerEmail}. Check Gmail inbox.`
      );
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleResetAdminPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setPinSuccess(null);

    const cleanOtp = resetPinOtp.replace(/[^0-9]/g, '').trim();
    const cleanNew = newAdminPin.replace(/[^0-9]/g, '').trim();
    const cleanConfirm = confirmAdminPin.replace(/[^0-9]/g, '').trim();

    if (cleanOtp.length !== 6) {
      setPinError('Please enter the 6-digit verification code sent to Owner Email.');
      return;
    }
    if (cleanNew.length < 4 || cleanNew.length > 8) {
      setPinError('New Admin PIN must be 4 to 8 numeric digits.');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setPinError('New PIN and Confirm New PIN do not match.');
      return;
    }

    setAuthSubmitting(true);
    try {
      const res = await resetAdminPinWithOtp({ otp: cleanOtp, newPin: cleanNew });
      if (!res.success || !res.pinUpdated) {
        setPinError(res.message || 'Could not reset Admin PIN.');
        return;
      }

      setPinLocked(false);
      setFailedAttempts(0);
      setResetPinOtp('');
      setNewAdminPin('');
      setConfirmAdminPin('');
      setResetOtpSent(false);
      setResetOtpInfo('');
      setEnteredPin('');
      setGateMode('pin');
      setPinSuccess('New Admin PIN saved & unlocked! Enter your new PIN below to sign in.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLock = () => {
    setIsAuthenticated(false);
    setEnteredPin('');
    setLoginOtp('');
    setChallengeToken('');
    setPinError(null);
    setPinSuccess(null);
    setGateMode(pinLocked ? 'locked_reset' : 'pin');
    clearStoredAdminToken();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSelectOrdersSubView = (mode: OrdersSubMode) => {
    setActiveSection('orders');
    setOrdersSubMode(mode);
    if (mode === 'queue' || mode === 'all') {
      setStatusFilter('all');
    } else {
      setStatusFilter(mode);
    }
    setMobileMenuOpen(false);
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const order = orders.find((o) => o.id === orderId);
      const res = await updateCustomOrderStatus(
        orderId,
        newStatus,
        order?.courier_partner || null,
        order?.tracking_number || null
      );

      if (res.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
        if (inspectingOrder?.id === orderId) {
          setInspectingOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        showToast('success', `${formatOrderRef(orderId)} updated to ${STATUS_META[newStatus].label}`);
      } else {
        showToast('error', res.error || 'Could not update order status.');
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const openDispatchModalForOrder = (order: CustomOrderRow) => {
    const parsed = parseOrderNotes(order.custom_notes);
    setEditingDispatchOrder(order);
    setCourierInput(order.courier_partner || `Delhivery (${delhiveryPickup})`);
    setAwbInput(order.tracking_number || '');
    setShipAddress(parsed.parsedAddress.street || '');
    setShipCity(parsed.parsedAddress.city || '');
    setShipState(parsed.parsedAddress.state || '');
    setShipPincode(parsed.parsedAddress.pincode || '');
    setShipmentError(null);
  };

  const handleBookDelhiveryShipment = async () => {
    if (!editingDispatchOrder) return;
    setCreatingShipment(true);
    setShipmentError(null);
    try {
      const { product, total } = getOrderEstimates(editingDispatchOrder);
      const orderNum = formatOrderRef(editingDispatchOrder.id);

      const res = await createDelhiveryShipment({
        orderId: editingDispatchOrder.id,
        orderNumber: orderNum,
        pickupLocation: delhiveryPickup,
        customerName: editingDispatchOrder.customer_name,
        phone: editingDispatchOrder.phone,
        address: shipAddress || `${shipCity}, ${shipState}`,
        city: shipCity,
        state: shipState,
        pincode: shipPincode,
        productDesc: product?.name || 'Custom Printed Corporate Merchandise',
        quantity: editingDispatchOrder.quantity || 1,
        totalAmount: total,
        weightGrams: Number(shipWeight) || 500,
      });

      if (!res.success || !res.waybill) {
        setShipmentError(res.message || 'Delhivery API could not manifest shipment.');
        return;
      }

      const partnerName = res.courierPartner || `Delhivery (${delhiveryPickup})`;
      const waybill = res.waybill;
      await updateCustomOrderStatus(editingDispatchOrder.id, 'dispatched', partnerName, waybill);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === editingDispatchOrder.id
            ? { ...o, status: 'dispatched', courier_partner: partnerName, tracking_number: waybill }
            : o
        )
      );
      if (inspectingOrder?.id === editingDispatchOrder.id) {
        setInspectingOrder((prev) =>
          prev
            ? { ...prev, status: 'dispatched', courier_partner: partnerName, tracking_number: waybill }
            : null
        );
      }
      setCourierInput(partnerName);
      setAwbInput(waybill);
      showToast('success', `Delhivery AWB ${waybill} generated from ${delhiveryPickup}!`);
      setEditingDispatchOrder(null);
    } finally {
      setCreatingShipment(false);
    }
  };

  const handleSaveDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDispatchOrder) return;
    setUpdatingOrderId(editingDispatchOrder.id);
    try {
      const newStatus: OrderStatus = 'dispatched';
      const res = await updateCustomOrderStatus(
        editingDispatchOrder.id,
        newStatus,
        courierInput,
        awbInput
      );
      if (res.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === editingDispatchOrder.id
              ? { ...o, status: newStatus, courier_partner: courierInput, tracking_number: awbInput }
              : o
          )
        );
        if (inspectingOrder?.id === editingDispatchOrder.id) {
          setInspectingOrder((prev) =>
            prev
              ? { ...prev, status: newStatus, courier_partner: courierInput, tracking_number: awbInput }
              : null
          );
        }
        showToast('success', `${formatOrderRef(editingDispatchOrder.id)} saved as Dispatched!`);
        setEditingDispatchOrder(null);
      } else {
        showToast('error', res.error || 'Failed to save dispatch details.');
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleTrackDelhiveryOrder = async (waybill: string) => {
    setTrackingOrderAwb(waybill);
    setLoadingTrack(true);
    setTrackingModalData(null);
    try {
      const res = await trackDelhiveryWaybill(waybill);
      setTrackingModalData(res);
    } finally {
      setLoadingTrack(false);
    }
  };

  const handleQuickTrackLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTrackAwb.trim()) return;
    setLoadingQuickTrack(true);
    setQuickTrackResult(null);
    try {
      const res = await trackDelhiveryWaybill(quickTrackAwb.trim());
      setQuickTrackResult(res);
    } finally {
      setLoadingQuickTrack(false);
    }
  };

  const handleSendOrderConfirmationEmail = async (order: CustomOrderRow) => {
    if (!order.customer_email) {
      showToast('error', 'Order does not have a customer email address.');
      return;
    }
    setSendingEmailOrderId(order.id);
    try {
      const { product, unitPrice, subtotal, gst, total } = getOrderEstimates(order);
      const parsedArt = parseOrderNotes(order.custom_notes);

      const res = await sendOrderConfirmationEmail({
        orderId: order.id,
        orderNumber: formatOrderRef(order.id),
        customerName: order.customer_name || 'Customer',
        customerEmail: order.customer_email,
        company: order.company || undefined,
        phone: order.phone,
        gstin: parsedArt.gstin || undefined,
        paymentMode: parsedArt.paymentPlan || undefined,
        amountPaid: parsedArt.paidNumber ?? undefined,
        balanceDue: parsedArt.balanceNumber ?? undefined,
        razorpayPaymentId: parsedArt.razorpayId || undefined,
        items: [
          {
            name: product?.name || `Custom Product (${order.product_id})`,
            color: parsedArt.color || undefined,
            size: parsedArt.size || undefined,
            printMethod: parsedArt.method || undefined,
            quantity: order.quantity || 1,
            price: unitPrice,
            totalPrice: subtotal,
            logoUrl: order.logo_url || undefined,
            backLogoUrl: parsedArt.backLogoUrl || undefined,
            mockupFrontUrl: parsedArt.frontMockupUrl || undefined,
            mockupBackUrl: parsedArt.backMockupUrl || undefined,
            designPositionSummary: parsedArt.placementSummary || parsedArt.cleanNotes || undefined,
          },
        ],
        subtotal,
        gstAmount: gst,
        shippingFee: 0,
        total,
        estimatedDispatch: '24-48h Fast Dispatch via Delhivery',
      });

      if (res.success) {
        showToast(
          'success',
          res.simulated
            ? `Email simulated for ${order.customer_email}`
            : `Order confirmation & artwork dispatched to ${order.customer_email}`
        );
      } else {
        showToast('error', res.message || 'Email delivery failed.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Error sending email.');
    } finally {
      setSendingEmailOrderId(null);
    }
  };

  const handleCreateManualOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrdCustomer.trim() || !newOrdPhone.trim() || !newOrdEmail.trim()) {
      showToast('error', 'Please fill Customer Name, Phone, and Email.');
      return;
    }
    setSubmittingNewOrder(true);
    try {
      const selectedProd = PRODUCTS.find((p) => p.id === newOrdProductId) || PRODUCTS[0];
      const qty = Math.max(1, Number(newOrdQty) || 1);
      const subtotal = (selectedProd?.basePrice || 499) * qty;
      const totalEst = subtotal + Math.round(subtotal * 0.18);
      const paidAmt = newOrdPaymentPlan.includes('50%') ? Math.round(totalEst * 0.5) : totalEst;
      const balanceAmt = Math.max(0, totalEst - paidAmt);

      const notesParts = [
        selectedProd?.colors[0]?.name ? `Color: ${selectedProd.colors[0].name}` : null,
        selectedProd?.printMethods[0] ? `Method: ${selectedProd.printMethods[0]}` : null,
        newOrdNotes.trim() ? `Notes: ${newOrdNotes.trim()}` : 'Notes: Manual Admin Entry',
        newOrdAddress.trim() ? `Address: ${newOrdAddress.trim()}` : null,
        `Payment Plan: ${newOrdPaymentPlan}`,
        `Paid: ₹${paidAmt.toLocaleString('en-IN')} | Balance Due: ₹${balanceAmt.toLocaleString('en-IN')}`,
      ].filter(Boolean);

      const res = await submitCustomOrderQuote({
        customerName: newOrdCustomer.trim(),
        customerEmail: newOrdEmail.trim(),
        company: newOrdCompany.trim() || undefined,
        phone: newOrdPhone.trim(),
        productId: newOrdProductId,
        quantity: qty,
        customNotes: notesParts.join(' | '),
      });

      if (res.success && res.data) {
        setOrders((prev) => [res.data!, ...prev]);
        showToast('success', `Order #${formatOrderRef(res.data.id)} created successfully!`);
        setCreateOrderOpen(false);
        setNewOrdCustomer('');
        setNewOrdEmail('');
        setNewOrdPhone('');
        setNewOrdCompany('');
        setNewOrdAddress('');
        setNewOrdNotes('');
        setActiveSection('orders');
      } else {
        showToast('error', res.message || 'Could not create order.');
      }
    } finally {
      setSubmittingNewOrder(false);
    }
  };

  const handleRecoverLead = async (leadId: string) => {
    await markCheckoutRecovered(leadId, 'MANUAL-RECOVERY');
    setAbandonedLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, recovered: true } : l))
    );
    showToast('success', 'Abandoned lead marked as Recovered.');
  };

  const handleTestSmtpEmail = async () => {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await sendTestEmail(testEmailInput.trim() || undefined);
      setSmtpTestResult({ success: res.success, message: res.message });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleTestDelhiveryPin = async () => {
    setTestingPin(true);
    setTestPinResult(null);
    try {
      const res = await checkDelhiveryPincode(testPinInput);
      setTestPinResult(res);
    } finally {
      setTestingPin(false);
    }
  };

  const handleSchedulePickup = async () => {
    setSchedulingPickup(true);
    setPickupResult(null);
    try {
      const res = await requestDelhiveryPickup({
        pickupLocation: diagPickupName,
        pickupDate: pickupDateInput,
        pickupTime: pickupTimeInput,
        expectedPackageCount: Math.max(1, Number(pickupPkgCount) || 1),
      });
      setPickupResult({ success: res.success, message: res.message });
      if (res.success) {
        showToast('success', res.message);
      }
    } finally {
      setSchedulingPickup(false);
    }
  };

  // Analytics & Derived Datasets (H4: deduplicated at order level, line-accurate at product level)
  const analytics: AnalyticsSummary = useMemo(() => {
    const statusCounts: Record<OrderStatus, number> = {
      pending: 0,
      approved: 0,
      'in-production': 0,
      dispatched: 0,
      delivered: 0,
    };
    const productStats = new Map<
      string,
      { name: string; orders: number; units: number; revenue: number }
    >();
    const orderGroups = new Map<
      string,
      {
        status: OrderStatus;
        orderTotal: number;
        lineTotalSum: number;
        hasExplicitOrderTotal: boolean;
        paid: number;
        balance: number;
      }
    >();

    orders.forEach((o) => {
      const { product } = getOrderEstimates(o);
      const parsed = parseOrderNotes(o.custom_notes);
      const lineTotal = resolveAdminLineTotal(o);
      const groupKey = resolveAdminOrderGroupKey(o, parsed);

      const explicitOrderTotal =
        typeof o.final_total_inr === 'number' &&
        Number.isFinite(o.final_total_inr) &&
        o.final_total_inr > 0
          ? o.final_total_inr
          : null;
      const paidVal =
        typeof o.amount_paid_inr === 'number' && Number.isFinite(o.amount_paid_inr)
          ? o.amount_paid_inr
          : parsed.paidNumber ?? 0;
      const balanceVal =
        typeof o.balance_due_inr === 'number' && Number.isFinite(o.balance_due_inr)
          ? o.balance_due_inr
          : parsed.balanceNumber ?? 0;

      const existingGroup = orderGroups.get(groupKey);
      if (!existingGroup) {
        orderGroups.set(groupKey, {
          status: o.status,
          orderTotal: explicitOrderTotal ?? lineTotal,
          lineTotalSum: lineTotal,
          hasExplicitOrderTotal: explicitOrderTotal !== null,
          paid: paidVal,
          balance: balanceVal,
        });
      } else {
        existingGroup.lineTotalSum += lineTotal;
        if (explicitOrderTotal !== null) {
          existingGroup.orderTotal = explicitOrderTotal;
          existingGroup.hasExplicitOrderTotal = true;
        } else if (!existingGroup.hasExplicitOrderTotal) {
          existingGroup.orderTotal = existingGroup.lineTotalSum;
        }
        if (existingGroup.paid === 0 && paidVal > 0) {
          existingGroup.paid = paidVal;
        }
        if (existingGroup.balance === 0 && balanceVal > 0) {
          existingGroup.balance = balanceVal;
        }
      }

      const prodKey = product?.id || o.product_id || 'custom';
      const prodName = product?.name || o.product_id || 'Custom Merchandise';
      const existing = productStats.get(prodKey) || {
        name: prodName,
        orders: 0,
        units: 0,
        revenue: 0,
      };
      existing.orders += 1;
      existing.units += o.quantity || 1;
      existing.revenue += lineTotal;
      productStats.set(prodKey, existing);
    });

    const totalOrdersCount = orderGroups.size;
    let totalRevenue = 0;
    let totalPaidRecorded = 0;
    let totalBalanceRecorded = 0;

    orderGroups.forEach((grp) => {
      totalRevenue += grp.orderTotal;
      totalPaidRecorded += grp.paid;
      totalBalanceRecorded += grp.balance;
      if (grp.status in statusCounts) {
        statusCounts[grp.status] = (statusCounts[grp.status] || 0) + 1;
      }
    });

    const topProducts = Array.from(productStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const totalAbandonedCount = abandonedLeads.length;
    const unrecoveredLeads = abandonedLeads.filter((l) => !l.recovered);
    const recoveredCount = abandonedLeads.filter((l) => l.recovered).length;
    const abandonedValueAtRisk = unrecoveredLeads.reduce(
      (acc, l) => acc + Number(l.cart_total || 0),
      0
    );

    const totalSessionsWithIntent = totalOrdersCount + totalAbandonedCount;
    const conversionRate =
      totalSessionsWithIntent > 0
        ? ((totalOrdersCount / totalSessionsWithIntent) * 100).toFixed(1)
        : '0.0';
    const recoveryRate =
      totalAbandonedCount > 0
        ? ((recoveredCount / totalAbandonedCount) * 100).toFixed(1)
        : '0.0';
    const aov = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

    return {
      totalOrdersCount,
      totalRevenue,
      totalPaidRecorded,
      totalBalanceRecorded,
      statusCounts,
      topProducts,
      totalAbandonedCount,
      unrecoveredCount: unrecoveredLeads.length,
      recoveredCount,
      abandonedValueAtRisk,
      conversionRate,
      recoveryRate,
      aov,
    };
  }, [orders, abandonedLeads]);

  const filteredOrders = useMemo(() => {
    const q = orderSearchQuery.toLowerCase().trim();
    const list = orders.filter((o) => {
      const prod = PRODUCTS.find((p) => p.id === o.product_id);
      const parsed = parseOrderNotes(o.custom_notes);
      const { total } = getOrderEstimates(o);
      const payBadge = getPaymentBadge(parsed, total);

      const matchesSearch =
        !q ||
        o.id.toLowerCase().includes(q) ||
        formatOrderRef(o.id).toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_email?.toLowerCase().includes(q) ||
        o.phone?.includes(q) ||
        o.company?.toLowerCase().includes(q) ||
        (prod?.name && prod.name.toLowerCase().includes(q)) ||
        (o.product_id && o.product_id.toLowerCase().includes(q)) ||
        (o.tracking_number && o.tracking_number.toLowerCase().includes(q));

      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchesPayment = paymentFilter === 'all' || payBadge.kind === paymentFilter;
      return matchesSearch && matchesStatus && matchesPayment;
    });

    if (sortBy === 'oldest') {
      return [...list].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }
    if (sortBy === 'highest') {
      return [...list].sort((a, b) => getOrderEstimates(b).total - getOrderEstimates(a).total);
    }
    return [...list].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [orders, orderSearchQuery, statusFilter, paymentFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, safePage, pageSize]);

  const readyToShipOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status !== 'delivered' &&
          (!o.tracking_number || o.tracking_number.toLowerCase().includes('awaiting'))
      ),
    [orders]
  );

  const activeAwbOrders = useMemo(
    () =>
      orders.filter(
        (o) =>
          Boolean(o.tracking_number) &&
          !o.tracking_number!.toLowerCase().includes('awaiting')
      ),
    [orders]
  );

  const exportOrdersListToCsv = (listToExport: CustomOrderRow[]) => {
    const headers = [
      'Order Ref',
      'Date',
      'Customer',
      'Company',
      'Phone',
      'Email',
      'Product',
      'Qty',
      'Est Total (INR)',
      'Status',
      'Payment Plan',
      'Paid (INR)',
      'Balance Due (INR)',
      'Courier',
      'AWB',
      'City',
      'Pincode',
    ];
    const escapeCsv = (val: unknown) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };
    const rows = listToExport.map((o) => {
      const { product, total } = getOrderEstimates(o);
      const parsed = parseOrderNotes(o.custom_notes);
      return [
        formatOrderRef(o.id),
        new Date(o.created_at).toLocaleString('en-IN'),
        o.customer_name,
        o.company || '',
        o.phone,
        o.customer_email,
        product?.name || o.product_id || '',
        o.quantity,
        total,
        STATUS_META[o.status].label,
        parsed.paymentPlan || '',
        parsed.paidAmount || '',
        parsed.balanceDue || '',
        o.courier_partner || '',
        o.tracking_number || '',
        parsed.parsedAddress.city,
        parsed.parsedAddress.pincode,
      ]
        .map(escapeCsv)
        .join(',');
    });
    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TeqqnoWorld_Orders_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', `Exported ${listToExport.length} orders to CSV.`);
  };

  const handleExportOrdersCsv = () => exportOrdersListToCsv(filteredOrders);

  // Sparkline data computed from real orders
  const sparkTotal = useMemo(() => buildDailyTrendSeries(orders, 7).map((d) => d.count), [orders]);
  const sparkPending = useMemo(
    () => buildDailyTrendSeries(orders.filter((o) => o.status === 'pending'), 7).map((d) => d.count),
    [orders]
  );
  const sparkProd = useMemo(
    () =>
      buildDailyTrendSeries(
        orders.filter((o) => o.status === 'approved' || o.status === 'in-production'),
        7
      ).map((d) => d.count),
    [orders]
  );
  const sparkShip = useMemo(
    () =>
      buildDailyTrendSeries(
        orders.filter((o) => o.status === 'dispatched' || o.status === 'delivered'),
        7
      ).map((d) => d.count),
    [orders]
  );

  // =========================================================================
  // SECURE ADMIN GATE (MASTER PIN + 2-STEP EMAIL OTP + 3-STRIKE LOCKOUT RESET)
  // =========================================================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#071B35] via-[#0B2547] to-[#071B35] flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl space-y-5 animate-admin-scale-in">
          <div className="text-center space-y-2.5">
            <div className="relative inline-flex items-center justify-center mx-auto">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
                  gateMode === 'locked_reset' && pinLocked
                    ? 'bg-red-600 text-white shadow-red-600/25'
                    : 'bg-gradient-to-br from-[#071B35] to-[#0D274A] border border-[#FF7900]/30 text-[#FF7900] shadow-[#071B35]/20'
                }`}
              >
                {gateMode === 'two_step' ? (
                  <ShieldCheck className="w-7 h-7" />
                ) : gateMode === 'locked_reset' ? (
                  <KeyRound className="w-7 h-7" />
                ) : (
                  <Lock className="w-7 h-7" />
                )}
              </div>
              <img
                src={LOGO_BADGE_SRC}
                alt="TeqqnoWorld"
                className="w-7 h-7 rounded-lg object-contain bg-white border border-slate-200 shadow-sm p-0.5 -bottom-1.5 -right-1.5 absolute"
              />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF4EB] border border-[#FFD8B8] text-[11px] font-semibold text-[#FF7900]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF7900] animate-pulse" />
              <span>
                {gateMode === 'two_step'
                  ? '2-Step Owner Email Verification'
                  : gateMode === 'locked_reset' && pinLocked
                  ? 'Security Lockout Activated'
                  : 'Authorized Owner Access Only'}
              </span>
            </div>

            <h1 className="font-display font-bold text-2xl tracking-tight text-[#071B35]">
              {gateMode === 'two_step'
                ? 'Verify Owner Login Code'
                : gateMode === 'locked_reset' && pinLocked
                ? 'Admin Panel Locked'
                : gateMode === 'locked_reset'
                ? 'Reset Admin Master PIN'
                : 'TeqqnoWorld Operations Hub'}
            </h1>

            <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
              {gateMode === 'two_step'
                ? loginOtpInfo || `Enter the 6-digit code sent to Owner Email (${maskedOwnerEmail}).`
                : gateMode === 'locked_reset' && pinLocked
                ? '3 wrong PIN attempts detected. Owner must verify a 6-digit Gmail code and set a new Admin PIN to unlock.'
                : gateMode === 'locked_reset'
                ? `Verify a 6-digit code sent to Owner Email (${maskedOwnerEmail}) to create a new Admin PIN.`
                : twoStepEnabled
                ? 'Protected by Master PIN + 2-Step Owner Email Verification and 3-attempt auto lockout.'
                : 'Protected by Master PIN and 3-attempt auto lockout.'}
            </p>
          </div>

          {checkingSession ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-6 h-6 text-[#FF7900] animate-spin" />
              <span>Checking security status...</span>
            </div>
          ) : (
            <>
              {pinSuccess && (
                <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 py-2.5 px-3 rounded-xl flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{pinSuccess}</span>
                </div>
              )}

              {pinError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 py-2.5 px-3 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{pinError}</span>
                </div>
              )}

              {/* MODE 1: MASTER PIN ENTRY */}
              {gateMode === 'pin' && (
                <form onSubmit={handleUnlock} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-600">
                        Master Security PIN
                      </label>
                      {failedAttempts > 0 && (
                        <span className="text-[11px] font-bold text-red-600">
                          {Math.max(0, 3 - failedAttempts)} / 3 tries left
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showEnteredPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={8}
                        autoFocus
                        placeholder="••••"
                        value={enteredPin}
                        onChange={(e) => {
                          setEnteredPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 8));
                          if (pinError) setPinError(null);
                        }}
                        className="w-full text-center tracking-[0.5em] text-2xl font-mono py-3.5 px-10 bg-slate-50 border border-slate-200 rounded-xl text-[#071B35] focus:border-[#FF7900] focus:bg-white outline-none transition-colors placeholder:text-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEnteredPin((v) => !v)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        aria-label="Toggle PIN visibility"
                      >
                        {showEnteredPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={authSubmitting || !enteredPin}
                    className="w-full bg-[#FF7900] hover:bg-[#e56d00] disabled:opacity-50 text-white font-semibold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm min-h-[44px] shadow-md shadow-[#FF7900]/20"
                  >
                    {authSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying Security PIN...</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>{twoStepEnabled ? 'Verify PIN & Send Email Code' : 'Unlock Operations Hub'}</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* MODE 2: 2-STEP OWNER EMAIL 6-DIGIT VERIFICATION */}
              {gateMode === 'two_step' && (
                <form onSubmit={handleVerifyLoginOtpSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5 text-center">
                      6-Digit Owner Email Code ({maskedOwnerEmail})
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      autoFocus
                      placeholder="• • • • • •"
                      value={loginOtp}
                      onChange={(e) => {
                        setLoginOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                        if (pinError) setPinError(null);
                      }}
                      className="w-full text-center tracking-[0.45em] text-2xl font-mono font-bold py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-[#071B35] focus:border-[#FF7900] focus:bg-white outline-none transition-colors placeholder:text-slate-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={authSubmitting || loginOtp.length !== 6}
                    className="w-full bg-[#FF7900] hover:bg-[#e56d00] disabled:opacity-50 text-white font-semibold py-3.5 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer text-sm min-h-[44px] shadow-md shadow-[#FF7900]/20"
                  >
                    {authSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Verifying 6-Digit Code...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify Code &amp; Unlock Hub</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setGateMode('pin');
                        setLoginOtp('');
                        setPinError(null);
                      }}
                      className="text-slate-500 hover:text-[#071B35] underline cursor-pointer"
                    >
                      Back to PIN
                    </button>
                    <button
                      type="button"
                      disabled={loginOtpCooldown > 0 || authSubmitting}
                      onClick={handleResendLoginOtpClick}
                      className="font-semibold text-[#FF7900] hover:underline disabled:text-slate-400 cursor-pointer"
                    >
                      {loginOtpCooldown > 0 ? `Resend in ${loginOtpCooldown}s` : 'Resend 6-Digit Code'}
                    </button>
                  </div>
                </form>
              )}

              {/* MODE 3: LOCKED AFTER 3 WRONG PINS OR FORGOT PIN -> OWNER EMAIL OTP + NEW PIN */}
              {gateMode === 'locked_reset' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#071B35]">
                      <Mail className="w-4 h-4 text-[#FF7900] shrink-0" />
                      <span>Step 1: Send Owner Verification Code</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {resetOtpInfo ||
                        `A 6-digit verification code will be emailed exclusively to Owner Email (${maskedOwnerEmail}).`}
                    </p>
                    <button
                      type="button"
                      disabled={authSubmitting || resetOtpCooldown > 0}
                      onClick={handleSendResetPinOtpClick}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#071B35] hover:bg-[#0D274A] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#FF7900]" />
                      <span>
                        {resetOtpCooldown > 0
                          ? `Resend Code in ${resetOtpCooldown}s`
                          : resetOtpSent
                          ? 'Resend 6-Digit Owner Code'
                          : 'Send 6-Digit Code to Owner Email'}
                      </span>
                    </button>
                  </div>

                  <form onSubmit={handleResetAdminPinSubmit} className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                        6-Digit Owner Email Code *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="• • • • • •"
                        value={resetPinOtp}
                        onChange={(e) => {
                          setResetPinOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                          if (pinError) setPinError(null);
                        }}
                        required
                        className="w-full text-center tracking-[0.35em] text-lg font-mono font-bold py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[#071B35] focus:border-[#FF7900] focus:bg-white outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          New PIN (4–8 Digits) *
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={8}
                          placeholder="e.g. 682491"
                          value={newAdminPin}
                          onChange={(e) => setNewAdminPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                          required
                          className="w-full text-center font-mono py-2.5 px-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#071B35] focus:border-[#FF7900] focus:bg-white outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                          Confirm New PIN *
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={8}
                          placeholder="Re-enter PIN"
                          value={confirmAdminPin}
                          onChange={(e) => setConfirmAdminPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                          required
                          className="w-full text-center font-mono py-2.5 px-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-[#071B35] focus:border-[#FF7900] focus:bg-white outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authSubmitting || resetPinOtp.length !== 6 || newAdminPin.length < 4}
                      className="w-full bg-[#FF7900] hover:bg-[#e56d00] disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
                    >
                      {authSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying &amp; Saving New PIN...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Verify Code &amp; Save New Admin PIN</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            {gateMode === 'pin' ? (
              <button
                type="button"
                onClick={() => {
                  setGateMode('locked_reset');
                  setPinError(null);
                  setPinSuccess(null);
                }}
                className="text-slate-600 hover:text-[#FF7900] font-semibold hover:underline cursor-pointer"
              >
                Forgot / Reset PIN?
              </button>
            ) : gateMode === 'locked_reset' && !pinLocked ? (
              <button
                type="button"
                onClick={() => {
                  setGateMode('pin');
                  setPinError(null);
                }}
                className="text-slate-600 hover:text-[#071B35] font-semibold hover:underline cursor-pointer"
              >
                ← Back to PIN Login
              </button>
            ) : (
              <span className="text-[11px] font-semibold text-red-600">
                Owner Email Verification Required
              </span>
            )}
            <button
              type="button"
              onClick={onBackToStore}
              className="text-[#FF7900] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Return to Store</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Breadcrumb & Page Title Meta
  const pageHeaderMeta: Record<
    AdminSection,
    { title: string; subtitle: string; breadcrumb: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    dashboard: {
      title: 'Executive Dashboard',
      subtitle: 'Live business overview across custom orders, revenue, and dispatch operations.',
      breadcrumb: 'Dashboard',
      icon: Home,
    },
    orders: {
      title:
        ordersSubMode === 'queue'
          ? 'Orders Queue'
          : ordersSubMode === 'all'
          ? 'All Orders'
          : `${STATUS_META[ordersSubMode].shortLabel} Orders`,
      subtitle: 'Manage, review and process all customer orders in one place.',
      breadcrumb:
        ordersSubMode === 'queue'
          ? 'Orders Queue'
          : ordersSubMode === 'all'
          ? 'All Orders'
          : `${STATUS_META[ordersSubMode].shortLabel} Orders`,
      icon: ShoppingCart,
    },
    dispatch: {
      title: 'Delhivery & Dispatch',
      subtitle: 'Schedule Hyderabad pickups, generate live AWBs, and track Express deliveries.',
      breadcrumb: 'Delhivery & Dispatch',
      icon: Truck,
    },
    products: {
      title: 'Products Catalog',
      subtitle: 'Browse active TeqqnoWorld SKUs, bulk MOQs, and customization pricing.',
      breadcrumb: 'Products',
      icon: Box,
    },
    reviews: {
      title: 'Product Reviews & Ratings',
      subtitle: 'Moderate customer reviews, verify purchases, publish replies, and manage review policy.',
      breadcrumb: 'Reviews',
      icon: Star,
    },
    affiliates: {
      title: 'Affiliate Partner Program',
      subtitle: 'Manage partner applications, masked KYC & bank verification, product commissions, payouts, fraud, targets & audit logs.',
      breadcrumb: 'Affiliate Program',
      icon: Sparkles,
    },
    coupons: {
      title: 'Coupon & Offer Management',
      subtitle: 'Create discount codes, private VIP customer vouchers, scheduled festival offers, usage limits & analytics.',
      breadcrumb: 'Coupons & Offers',
      icon: Ticket,
    },
    customers: {
      title: 'Customers Directory',
      subtitle: 'Verified B2B & corporate buyers aggregated from real storefront orders.',
      breadcrumb: 'Customers',
      icon: Users,
    },
    marketing: {
      title: 'Marketing & Lead Recovery',
      subtitle: 'Recover abandoned checkouts quickly via WhatsApp with direct cart context.',
      breadcrumb: 'Marketing',
      icon: Megaphone,
    },
    analytics: {
      title: 'Reports & Analytics',
      subtitle: 'Gross value, Razorpay collections, fulfillment velocity, and product leaders.',
      breadcrumb: 'Reports & Analytics',
      icon: BarChart3,
    },
    integrations: {
      title: 'Integrations & Setup',
      subtitle: 'Hostinger SMTP, Razorpay Live Gateway, Delhivery One, and Supabase PostgreSQL.',
      breadcrumb: 'Integrations & Setup',
      icon: Layers,
    },
    security: {
      title: 'Admin Security & 2FA',
      subtitle: 'Change Admin Master PIN, toggle 2-Step Owner Email Verification, and review security logs.',
      breadcrumb: 'Security & 2FA',
      icon: ShieldCheck,
    },
  };

  const currentMeta = pageHeaderMeta[activeSection];
  const HeaderIcon = currentMeta.icon;

  // Sidebar Content Renderer (Shared for Fixed Desktop Sidebar & Mobile Drawer)
  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full bg-gradient-to-b from-[#071B35] via-[#071B35] to-[#041226] text-white select-none">
      {/* Brand Lockup */}
      <div className="px-5 h-16 flex items-center justify-between border-b border-white/[0.08] shrink-0">
        <button
          onClick={onBackToStore}
          className="flex items-center gap-2.5 text-left group cursor-pointer min-w-0"
          title="Back to Customer Store"
        >
          <img
            src={LOGO_BADGE_SRC}
            alt="TeqqnoWorld"
            className="w-9 h-9 rounded-xl object-contain shrink-0 bg-white/5 p-0.5"
          />
          <div className="min-w-0">
            <div className="font-display font-bold text-[15px] tracking-tight text-white leading-tight truncate">
              Teqqno<span className="text-[#FF7900]">World</span>
              <sup className="text-[9px] text-slate-400 ml-0.5">®</sup>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Custom Printing &amp; Corporate Gifts
            </div>
          </div>
        </button>
        {isMobile && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 min-h-[40px] min-w-[40px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Tree */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto no-scrollbar text-xs">
        {/* 1. Dashboard */}
        <button
          onClick={() => {
            setActiveSection('dashboard');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
            activeSection === 'dashboard'
              ? 'bg-[#FF7900] text-white font-semibold shadow-md shadow-[#FF7900]/25'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Home className="w-4 h-4 shrink-0" />
          <span>Dashboard</span>
        </button>

        {/* 2. Orders (Expandable Accordion Submenu matching reference) */}
        <div className="pt-0.5">
          <button
            onClick={() => {
              if (activeSection !== 'orders') {
                setActiveSection('orders');
                setOrdersMenuExpanded(true);
              } else {
                setOrdersMenuExpanded((v) => !v);
              }
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
              activeSection === 'orders'
                ? 'bg-[#FF7900] text-white font-semibold shadow-md shadow-[#FF7900]/25'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <span className="flex items-center gap-3">
              <ShoppingCart className="w-4 h-4 shrink-0" />
              <span>Orders</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                ordersMenuExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>

          <div
            className={`grid transition-[grid-template-rows,opacity] duration-250 ease-out ${
              ordersMenuExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden pl-2 space-y-0.5">
              {(
                [
                  { id: 'queue', label: 'Orders Queue', count: orders.length },
                  { id: 'all', label: 'All Orders' },
                  { id: 'pending', label: 'Pending Orders', count: analytics.statusCounts.pending },
                  { id: 'approved', label: 'Approved Orders', count: analytics.statusCounts.approved },
                  { id: 'in-production', label: 'In Production', count: analytics.statusCounts['in-production'] },
                  { id: 'dispatched', label: 'Dispatched Orders', count: analytics.statusCounts.dispatched },
                  { id: 'delivered', label: 'Delivered Orders', count: analytics.statusCounts.delivered },
                ] as Array<{ id: OrdersSubMode; label: string; count?: number }>
              ).map((sub) => {
                const isSubActive = activeSection === 'orders' && ordersSubMode === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => handleSelectOrdersSubView(sub.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] transition-all duration-150 cursor-pointer ${
                      isSubActive
                        ? 'bg-white/[0.1] text-white font-semibold border border-white/[0.08]'
                        : 'text-slate-300/90 hover:text-white hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                          isSubActive ? 'bg-[#FF7900]' : 'bg-slate-500'
                        }`}
                      />
                      <span className="truncate">{sub.label}</span>
                    </span>
                    {typeof sub.count === 'number' && (
                      <span
                        className={`px-1.5 py-0.5 rounded-md font-mono tabular-nums text-[10px] font-semibold ${
                          isSubActive
                            ? 'bg-[#FF7900] text-white'
                            : 'bg-white/[0.08] text-slate-300'
                        }`}
                      >
                        {sub.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. Products */}
        <button
          onClick={() => {
            setActiveSection('products');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
            activeSection === 'products'
              ? 'bg-[#FF7900] text-white font-semibold shadow-md shadow-[#FF7900]/25'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <span className="flex items-center gap-3">
            <Package className="w-4 h-4 shrink-0" />
            <span>Products</span>
          </span>
          <span className="font-mono text-[10px] text-slate-400">{PRODUCTS.length}</span>
        </button>

        {/* 3B. Reviews & Ratings */}
        <button
          onClick={() => {
            setActiveSection('reviews');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
            activeSection === 'reviews'
              ? 'bg-[#FF7900] text-white font-semibold shadow-md shadow-[#FF7900]/25'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <span className="flex items-center gap-3">
            <Star className="w-4 h-4 shrink-0" />
            <span>Reviews</span>
          </span>
          {pendingReviewsCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-amber-500/20 text-amber-300">
              {pendingReviewsCount}
            </span>
          )}
        </button>

        {/* 3C. Affiliate Partner Program */}
        <button
          onClick={() => {
            setActiveSection('affiliates');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
            activeSection === 'affiliates'
              ? 'bg-[#FF7900] text-white font-semibold shadow-md shadow-[#FF7900]/25'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <span className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>Affiliate Program</span>
          </span>
        </button>

        {/* 3D. Coupon & Offer Management */}
        <button
          onClick={() => {
            setActiveSection('coupons');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
            activeSection === 'coupons'
              ? 'bg-[#FF7900] text-white font-semibold shadow-md shadow-[#FF7900]/25'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <span className="flex items-center gap-3">
            <Ticket className="w-4 h-4 shrink-0" />
            <span>Coupons & Offers</span>
          </span>
        </button>

        {/* 4. Customers */}
        <button
          onClick={() => {
            setActiveSection('customers');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
            activeSection === 'customers'
              ? 'bg-[#FF7900] text-white font-semibold shadow-md shadow-[#FF7900]/25'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <Users className="w-4 h-4 shrink-0" />
          <span>Customers</span>
        </button>

        {/* 5. Marketing */}
        <button
          onClick={() => {
            setActiveSection('marketing');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
            activeSection === 'marketing'
              ? 'bg-[#FF7900] text-white font-semibold shadow-md shadow-[#FF7900]/25'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <span className="flex items-center gap-3">
            <Megaphone className="w-4 h-4 shrink-0" />
            <span>Marketing</span>
          </span>
          {analytics.unrecoveredCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-md font-mono text-[10px] font-semibold bg-amber-500/20 text-amber-300">
              {analytics.unrecoveredCount}
            </span>
          )}
        </button>

        {/* 6. Reports & Analytics */}
        <button
          onClick={() => {
            setActiveSection('analytics');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
            activeSection === 'analytics'
              ? 'bg-[#FF7900] text-white font-semibold shadow-md shadow-[#FF7900]/25'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          <span>Reports &amp; Analytics</span>
        </button>

        {/* 7. Integrations & Setup (Expandable with Delhivery Dispatch + Gateways & SQL) */}
        <div>
          <button
            onClick={() => {
              setIntegrationsMenuExpanded((v) => !v);
              if (activeSection !== 'integrations' && activeSection !== 'dispatch') {
                setActiveSection('integrations');
              }
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
              activeSection === 'integrations' || activeSection === 'dispatch'
                ? 'bg-[#FF7900] text-white font-semibold shadow-md shadow-[#FF7900]/25'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <span className="flex items-center gap-3">
              <Layers className="w-4 h-4 shrink-0" />
              <span>Integrations &amp; Setup</span>
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${
                integrationsMenuExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>

          <div
            className={`grid transition-[grid-template-rows,opacity] duration-250 ease-out ${
              integrationsMenuExpanded || activeSection === 'dispatch' || activeSection === 'integrations'
                ? 'grid-rows-[1fr] opacity-100 mt-1'
                : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="overflow-hidden pl-2 space-y-0.5">
              <button
                onClick={() => {
                  setActiveSection('dispatch');
                  if (isMobile) setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[12px] cursor-pointer ${
                  activeSection === 'dispatch'
                    ? 'bg-white/[0.1] text-white font-semibold'
                    : 'text-slate-300/90 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      activeSection === 'dispatch' ? 'bg-[#FF7900]' : 'bg-slate-500'
                    }`}
                  />
                  <span>Delhivery Dispatch</span>
                </span>
                <span className="font-mono text-[10px] bg-white/[0.08] px-1.5 py-0.5 rounded">
                  {readyToShipOrders.length}
                </span>
              </button>
              <button
                onClick={() => {
                  setActiveSection('integrations');
                  if (isMobile) setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] cursor-pointer ${
                  activeSection === 'integrations'
                    ? 'bg-white/[0.1] text-white font-semibold'
                    : 'text-slate-300/90 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    activeSection === 'integrations' ? 'bg-[#FF7900]' : 'bg-slate-500'
                  }`}
                />
                <span>Gateways, SMTP &amp; SQL</span>
              </button>
            </div>
          </div>
        </div>

        {/* 8. Admin Security & 2-Step Verification */}
        <button
          onClick={() => {
            setActiveSection('security');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium transition-all duration-200 cursor-pointer ${
            activeSection === 'security'
              ? 'bg-[#FF7900] text-white font-semibold shadow-md shadow-[#FF7900]/25'
              : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
          }`}
        >
          <span className="flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Security &amp; 2FA</span>
          </span>
          <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
            PIN
          </span>
        </button>
      </nav>

      {/* Bottom Promo Card (matching reference aesthetic) */}
      <div className="p-3.5 shrink-0">
        <div
          onClick={() => {
            setActiveSection('analytics');
            if (isMobile) setMobileMenuOpen(false);
          }}
          className="relative overflow-hidden rounded-2xl border border-white/[0.12] bg-gradient-to-br from-[#0D274C] to-[#041022] p-3.5 cursor-pointer group hover:border-[#FF7900]/50 transition-all"
        >
          <div className="flex items-center gap-3 mb-2">
            <img
              src="/assets/categories/cat_gift_sets.webp"
              alt="TeqqnoWorld Business"
              className="w-12 h-12 rounded-xl object-cover border border-white/10 shrink-0 group-hover:scale-105 transition-transform"
            />
            <div className="text-[12px] font-bold leading-snug text-white">
              Grow Your Business with{' '}
              <span className="text-[#FF7900]">TeqqnoWorld</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-300 leading-relaxed">
            Manage orders, products and printing operations seamlessly.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#071B35] flex font-sans">
      {/* Non-blocking Status Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-[80] text-xs font-semibold px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 border animate-admin-scale-in ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ===================================================================== */}
      {/* DESKTOP FIXED DARK NAVY SIDEBAR (#071B35) */}
      {/* ===================================================================== */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-30 shadow-xl">
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Slide-Out Sidebar Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#071B35]/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[84vw] h-full z-10 shadow-2xl animate-admin-slide-left">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MAIN WORKSPACE CONTENT */}
      {/* ===================================================================== */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 relative">
        {/* Subtle Warm Orange Wave Mesh Glow behind Top Header (matches reference) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 w-full h-72 overflow-hidden z-0"
        >
          <div
            className="absolute -top-24 -right-20 w-[560px] h-[340px] rounded-full opacity-35 blur-3xl"
            style={{
              background:
                'radial-gradient(circle at center, rgba(255,121,0,0.28) 0%, rgba(255,180,107,0.12) 45%, transparent 72%)',
            }}
          />
        </div>

        {/* TOP BAR HEADER */}
        <header className="sticky top-0 z-20 h-16 bg-white/92 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#071B35] min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global Search Input with Ctrl+K */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={globalSearchRef}
                type="text"
                placeholder="Search orders, customers, products, AWB..."
                value={orderSearchQuery}
                onChange={(e) => {
                  setOrderSearchQuery(e.target.value);
                  if (e.target.value && activeSection !== 'orders') {
                    setActiveSection('orders');
                  }
                }}
                className="w-full pl-10 pr-16 py-2 bg-slate-100/80 hover:bg-slate-100 focus:bg-white border border-slate-200/80 focus:border-[#FF7900] rounded-xl text-xs text-[#071B35] placeholder:text-slate-400 outline-none transition-all"
              />
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2">
                Ctrl + K
              </span>
            </div>
          </div>

          {/* Right Action Controls (Notification Bell, Help, Admin Profile) */}
          <div className="flex items-center gap-2 shrink-0 relative">
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setBellOpen((v) => !v);
                  setHelpOpen(false);
                  setProfileOpen(false);
                }}
                className="relative p-2.5 rounded-xl text-slate-600 hover:text-[#071B35] hover:bg-slate-100 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="Pending Alerts & Notifications"
              >
                <Bell className="w-4 h-4" />
                {(analytics.statusCounts.pending > 0 || analytics.unrecoveredCount > 0) && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#FF7900] ring-2 ring-white" />
                )}
              </button>

              {bellOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 space-y-2 z-40 animate-admin-scale-in text-xs">
                  <div className="font-bold text-[#071B35] px-1">Live Operations Alerts</div>
                  <button
                    onClick={() => {
                      handleSelectOrdersSubView('pending');
                      setBellOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-amber-900 font-medium">Needs Proof Review</span>
                    <span className="font-mono font-bold text-amber-800">{analytics.statusCounts.pending}</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveSection('dispatch');
                      setBellOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-sky-50 hover:bg-sky-100/80 border border-sky-200/80 flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-sky-900 font-medium">Awaiting Delhivery AWB</span>
                    <span className="font-mono font-bold text-sky-800">{readyToShipOrders.length}</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveSection('marketing');
                      setBellOpen(false);
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-orange-50 hover:bg-orange-100/80 border border-orange-200/80 flex items-center justify-between cursor-pointer"
                  >
                    <span className="text-orange-900 font-medium">Abandoned Cart Leads</span>
                    <span className="font-mono font-bold text-orange-800">{analytics.unrecoveredCount}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Help Popover */}
            <div className="relative">
              <button
                onClick={() => {
                  setHelpOpen((v) => !v);
                  setBellOpen(false);
                  setProfileOpen(false);
                }}
                className="p-2.5 rounded-xl text-slate-600 hover:text-[#071B35] hover:bg-slate-100 transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="Admin Quick Guide"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {helpOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-2.5 z-40 animate-admin-scale-in text-xs">
                  <div className="font-bold text-[#071B35]">Admin Quick Guide</div>
                  <div className="text-slate-600 space-y-1.5 leading-relaxed">
                    <p>• Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px]">Ctrl+K</kbd> anytime to search Order IDs, Phones, or AWBs.</p>
                    <p>• Click any <strong className="text-[#FF7900]">#Order ID</strong> or Eye button to inspect raw logos, mockups &amp; shipping address.</p>
                    <p>• Use <strong className="text-[#071B35]">Book Delivery</strong> to manifest prepaid shipments via Delhivery One.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Admin Profile Dropdown */}
            <div className="relative pl-1 border-l border-slate-200">
              <button
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setBellOpen(false);
                  setHelpOpen(false);
                }}
                className="flex items-center gap-2.5 py-1 px-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-[#FF7900] text-white font-display font-bold text-xs flex items-center justify-center shadow-sm">
                  TW
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="text-xs font-bold text-[#071B35]">Teqqno Admin</div>
                  <div className="text-[10px] text-slate-500">Super Admin</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 space-y-1 z-40 animate-admin-scale-in text-xs">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <div className="font-bold text-[#071B35]">TeqqnoWorld Operations</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      DB: {isSupabaseConfigured() ? 'Supabase Connected' : 'Local'}
                    </div>
                  </div>
                  <button
                    onClick={onBackToStore}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-100 text-[#071B35] font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#FF7900]" />
                    <span>Open Customer Store</span>
                  </button>
                  <button
                    onClick={handleLock}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-50 text-red-600 font-medium flex items-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Lock Admin Hub</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Mobile Quick Section Strip (< lg) */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar z-10">
          {(
            [
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'orders', label: `Orders (${orders.length})` },
              { id: 'dispatch', label: `Dispatch (${readyToShipOrders.length})` },
              { id: 'products', label: 'Products' },
              { id: 'reviews', label: 'Reviews' },
              { id: 'affiliates', label: 'Affiliates' },
              { id: 'customers', label: 'Customers' },
              { id: 'marketing', label: 'Marketing' },
              { id: 'analytics', label: 'Analytics' },
              { id: 'integrations', label: 'Setup' },
              { id: 'security', label: 'Security & 2FA' },
            ] as Array<{ id: AdminSection; label: string }>
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer min-h-[36px] transition-colors ${
                activeSection === item.id
                  ? 'bg-[#FF7900] text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-[#071B35]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* MAIN PAGE CONTAINER */}
        <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
          {/* Page Breadcrumb & Title Banner */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <button
                  onClick={() => setActiveSection('dashboard')}
                  className="hover:text-[#FF7900] cursor-pointer"
                >
                  Operations
                </button>
                <span aria-hidden="true">»</span>
                <span className="font-semibold text-[#071B35]">{currentMeta.breadcrumb}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF7900] text-white flex items-center justify-center shadow-md shadow-[#FF7900]/20 shrink-0">
                  <HeaderIcon className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="font-display font-bold text-xl sm:text-2xl tracking-tight text-[#071B35]">
                    {currentMeta.title}
                  </h1>
                  <p className="text-xs text-slate-500">{currentMeta.subtitle}</p>
                </div>
              </div>
            </div>

            {/* Right Action Buttons: Refresh, Export CSV, + Create Order */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={loadData}
                disabled={loadingOrders || loadingLeads}
                className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-[#071B35] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs transition-all min-h-[40px]"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    loadingOrders || loadingLeads ? 'animate-spin text-[#FF7900]' : 'text-slate-500'
                  }`}
                />
                <span>Refresh</span>
              </button>

              <button
                onClick={handleExportOrdersCsv}
                className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-[#071B35] flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all min-h-[40px]"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setCreateOrderOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#FF7900]/25 transition-all active:scale-[0.98] min-h-[40px]"
              >
                <Plus className="w-4 h-4" />
                <span>Create Order</span>
              </button>
            </div>
          </div>

          {/* ================================================================= */}
          {/* SECTION RENDERER */}
          {/* ================================================================= */}
          {activeSection === 'dashboard' && (
            <DashboardOverviewView
              orders={orders}
              abandonedLeads={abandonedLeads}
              analytics={analytics}
              onNavigateSection={(sec) => setActiveSection(sec)}
              onFilterOrdersStatus={(st) => handleSelectOrdersSubView(st === 'all' ? 'all' : st)}
              onInspectOrder={(o) => setInspectingOrder(o)}
              onOpenCreateOrder={() => setCreateOrderOpen(true)}
            />
          )}

          {activeSection === 'orders' && (
            <div className="space-y-5 animate-admin-fade-up">
              {/* 4 Pastel Animated KPI Cards (Matching Reference) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <AdminKpiCard
                  title="Total Custom Orders"
                  value={orders.length}
                  subtext={
                    <span className="text-emerald-600 font-semibold font-mono tabular-nums">
                      ₹{analytics.totalRevenue.toLocaleString('en-IN')} est. value
                    </span>
                  }
                  icon={ShoppingCart}
                  tone="orange"
                  sparklinePoints={sparkTotal}
                  sparkId="ord-total"
                  onClick={() => handleSelectOrdersSubView('all')}
                  delayMs={0}
                />
                <AdminKpiCard
                  title="Needs Proof Review"
                  value={analytics.statusCounts.pending}
                  subtext="Awaiting verification"
                  icon={Clock}
                  tone="blue"
                  sparklinePoints={sparkPending}
                  sparkId="ord-pending"
                  onClick={() => handleSelectOrdersSubView('pending')}
                  delayMs={50}
                />
                <AdminKpiCard
                  title="Approved & Printing"
                  value={analytics.statusCounts.approved + analytics.statusCounts['in-production']}
                  subtext="Active production queue"
                  icon={Printer}
                  tone="violet"
                  sparklinePoints={sparkProd}
                  sparkId="ord-prod"
                  onClick={() => handleSelectOrdersSubView('in-production')}
                  delayMs={100}
                />
                <AdminKpiCard
                  title="Shipped & Delivered"
                  value={analytics.statusCounts.dispatched + analytics.statusCounts.delivered}
                  subtext="Delivery AWBs assigned"
                  icon={Truck}
                  tone="green"
                  sparklinePoints={sparkShip}
                  sparkId="ord-ship"
                  onClick={() => handleSelectOrdersSubView('dispatched')}
                  delayMs={150}
                />
              </div>

              {/* White Orders Queue Container */}
              <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_2px_14px_-4px_rgba(7,27,53,0.06)] overflow-visible">
                {/* Search Bar + Table/Cards Toggle + Status Tabs + Filters */}
                <div className="p-4 border-b border-slate-100 space-y-3">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search by Order ID, Customer, Phone, Email, Product, AWB..."
                        value={orderSearchQuery}
                        onChange={(e) => setOrderSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-[#071B35] placeholder:text-slate-400 focus:border-[#FF7900] focus:bg-white outline-none transition-colors min-h-[40px]"
                      />
                    </div>

                    {/* Desktop/Tablet View Switcher */}
                    <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
                      <button
                        onClick={() => setOrdersViewMode('table')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                          ordersViewMode === 'table'
                            ? 'bg-[#FF7900] text-white shadow-xs'
                            : 'text-slate-600 hover:text-[#071B35]'
                        }`}
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>Table</span>
                      </button>
                      <button
                        onClick={() => setOrdersViewMode('cards')}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all ${
                          ordersViewMode === 'cards'
                            ? 'bg-[#FF7900] text-white shadow-xs'
                            : 'text-slate-600 hover:text-[#071B35]'
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Cards</span>
                      </button>
                    </div>
                  </div>

                  {/* Clickable Status Filter Tabs + Filters Button */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      {(
                        [
                          { id: 'all', label: 'All Orders', count: orders.length },
                          { id: 'pending', label: 'Pending', count: analytics.statusCounts.pending },
                          { id: 'approved', label: 'Approved', count: analytics.statusCounts.approved },
                          { id: 'in-production', label: 'In Production', count: analytics.statusCounts['in-production'] },
                          { id: 'dispatched', label: 'Dispatched', count: analytics.statusCounts.dispatched },
                          { id: 'delivered', label: 'Delivered', count: analytics.statusCounts.delivered },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          onClick={() => {
                            setStatusFilter(st.id);
                            setOrdersSubMode(st.id === 'all' ? 'queue' : st.id);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-all min-h-[34px] ${
                            statusFilter === st.id
                              ? 'bg-[#FF7900] text-white font-semibold shadow-xs'
                              : 'bg-white text-slate-600 hover:text-[#071B35] border border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {st.label}{' '}
                          <span className="font-mono tabular-nums opacity-85">({st.count})</span>
                        </button>
                      ))}
                    </div>

                    {/* Filters Dropdown Popover */}
                    <div className="relative">
                      <button
                        onClick={() => setFiltersOpen((v) => !v)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors min-h-[34px] ${
                          paymentFilter !== 'all' || sortBy !== 'newest'
                            ? 'bg-orange-50 border-[#FF7900] text-[#FF7900]'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Filters</span>
                      </button>

                      {filtersOpen && (
                        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-4 space-y-3 z-40 animate-admin-scale-in text-xs">
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Payment Status
                            </label>
                            <select
                              value={paymentFilter}
                              onChange={(e) => setPaymentFilter(e.target.value as any)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2.5 text-[#071B35] outline-none focus:border-[#FF7900]"
                            >
                              <option value="all">All Payment Plans</option>
                              <option value="paid">Full Paid (100%)</option>
                              <option value="partial">Partial (50% Advance)</option>
                              <option value="pending">Pending / Review</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Sort Order
                            </label>
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value as any)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2.5 text-[#071B35] outline-none focus:border-[#FF7900]"
                            >
                              <option value="newest">Newest First</option>
                              <option value="oldest">Oldest First</option>
                              <option value="highest">Highest Order Value</option>
                            </select>
                          </div>
                          <div className="pt-1 flex justify-between items-center">
                            <button
                              onClick={() => {
                                setPaymentFilter('all');
                                setSortBy('newest');
                                setFiltersOpen(false);
                              }}
                              className="text-slate-500 hover:text-[#071B35] font-medium cursor-pointer"
                            >
                              Reset
                            </button>
                            <button
                              onClick={() => setFiltersOpen(false)}
                              className="px-3 py-1.5 rounded-lg bg-[#071B35] text-white font-semibold cursor-pointer"
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Batch Selection Toolbar */}
                  {selectedOrderIds.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200 flex flex-wrap items-center justify-between gap-2 text-xs animate-admin-fade-up">
                      <span className="font-semibold text-[#071B35]">
                        {selectedOrderIds.length} orders selected
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            exportOrdersListToCsv(
                              orders.filter((o) => selectedOrderIds.includes(o.id))
                            )
                          }
                          className="px-3 py-1 rounded-lg bg-[#FF7900] text-white font-semibold cursor-pointer"
                        >
                          Export Selected CSV
                        </button>
                        <button
                          onClick={() => setSelectedOrderIds([])}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-[#071B35] cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Orders Body: Skeleton / Empty / Table / Cards */}
                {loadingOrders ? (
                  <div className="p-5 space-y-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <div key={n} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : filteredOrders.length === 0 ? (
                  <div className="text-center py-16 px-4 space-y-3">
                    <Package className="w-10 h-10 text-slate-300 mx-auto" />
                    <h3 className="font-semibold text-[#071B35] text-base">No matching orders</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {orderSearchQuery || statusFilter !== 'all' || paymentFilter !== 'all'
                        ? 'Clear your search or filter selections to view all orders.'
                        : 'Custom orders placed on your storefront will appear here automatically.'}
                    </p>
                    {(orderSearchQuery || statusFilter !== 'all' || paymentFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setOrderSearchQuery('');
                          setStatusFilter('all');
                          setPaymentFilter('all');
                          setOrdersSubMode('queue');
                        }}
                        className="px-4 py-2 rounded-xl bg-[#FF7900] text-white text-xs font-semibold cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* DESKTOP TABLE VIEW */}
                    {ordersViewMode === 'table' && (
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600">
                              <th className="py-3 pl-4 pr-2 w-9">
                                <input
                                  type="checkbox"
                                  checked={
                                    paginatedOrders.length > 0 &&
                                    paginatedOrders.every((o) => selectedOrderIds.includes(o.id))
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedOrderIds((prev) =>
                                        Array.from(
                                          new Set([...prev, ...paginatedOrders.map((o) => o.id)])
                                        )
                                      );
                                    } else {
                                      const pageSet = new Set(paginatedOrders.map((o) => o.id));
                                      setSelectedOrderIds((prev) =>
                                        prev.filter((id) => !pageSet.has(id))
                                      );
                                    }
                                  }}
                                  className="rounded border-slate-300 text-[#FF7900] focus:ring-[#FF7900] cursor-pointer"
                                  aria-label="Select all orders on page"
                                />
                              </th>
                              <th className="py-3 px-3">Order ID &amp; Date</th>
                              <th className="py-3 px-3">Customer</th>
                              <th className="py-3 px-3">Artwork &amp; Product</th>
                              <th className="py-3 px-3">Amount &amp; Payment</th>
                              <th className="py-3 px-3">Stage</th>
                              <th className="py-3 px-3">Delivery / Courier</th>
                              <th className="py-3 pl-3 pr-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {paginatedOrders.map((order) => {
                              const { product, total } = getOrderEstimates(order);
                              const parsed = parseOrderNotes(order.custom_notes);
                              const thumb = getOrderThumbnail(order, parsed);
                              const payBadge = getPaymentBadge(parsed, total);
                              const hasRealAwb =
                                Boolean(order.tracking_number) &&
                                !order.tracking_number!.toLowerCase().includes('awaiting');
                              const isChecked = selectedOrderIds.includes(order.id);

                              return (
                                <tr
                                  key={order.id}
                                  className={`hover:bg-slate-50/90 transition-colors ${
                                    isChecked ? 'bg-orange-50/40' : ''
                                  }`}
                                >
                                  <td className="py-3.5 pl-4 pr-2 align-middle">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedOrderIds((prev) => [...prev, order.id]);
                                        } else {
                                          setSelectedOrderIds((prev) =>
                                            prev.filter((id) => id !== order.id)
                                          );
                                        }
                                      }}
                                      className="rounded border-slate-300 text-[#FF7900] focus:ring-[#FF7900] cursor-pointer"
                                      aria-label={`Select ${formatOrderRef(order.id)}`}
                                    />
                                  </td>

                                  <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                                    <button
                                      onClick={() => setInspectingOrder(order)}
                                      className="font-mono font-bold text-[#FF7900] hover:underline cursor-pointer block"
                                    >
                                      #{formatOrderRef(order.id)}
                                    </button>
                                    <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                                      {new Date(order.created_at).toLocaleDateString('en-IN', {
                                        day: '2-digit',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </div>
                                  </td>

                                  <td className="py-3.5 px-3 align-middle max-w-[180px]">
                                    <div className="font-semibold text-[#071B35] truncate">
                                      {order.customer_name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                                      {order.phone}
                                    </div>
                                    {order.company && (
                                      <div className="text-[10px] text-slate-400 truncate">
                                        {order.company}
                                      </div>
                                    )}
                                  </td>

                                  <td className="py-3.5 px-3 align-middle">
                                    <div className="flex items-center gap-3">
                                      <OrderThumb
                                        src={thumb}
                                        alt={product?.name || 'Product'}
                                        onClick={
                                          parsed.frontMockupUrl || order.logo_url
                                            ? () =>
                                                setPreviewLogoUrl(
                                                  parsed.frontMockupUrl || order.logo_url!
                                                )
                                            : undefined
                                        }
                                      />
                                      <div className="min-w-0 max-w-[230px]">
                                        <div className="font-semibold text-[#071B35] truncate">
                                          {product?.name || order.product_id || 'Custom Product'}
                                        </div>
                                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                          <span className="font-mono font-semibold text-slate-700">
                                            {order.quantity} pcs
                                          </span>
                                          {parsed.color && <span> · {parsed.color}</span>}
                                          {parsed.method && <span> · {parsed.method}</span>}
                                        </div>
                                        {(parsed.parsedAddress.city || parsed.parsedAddress.pincode) && (
                                          <div className="text-[11px] text-slate-400 truncate">
                                            {parsed.parsedAddress.city}
                                            {parsed.parsedAddress.pincode
                                              ? ` – ${parsed.parsedAddress.pincode}`
                                              : ''}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  <td className="py-3.5 px-3 align-middle whitespace-nowrap font-mono tabular-nums">
                                    <div className="font-bold text-[#071B35]">
                                      ₹{total.toLocaleString('en-IN')}
                                    </div>
                                    <div className="mt-1">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-sans font-semibold border ${
                                          payBadge.kind === 'paid'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : payBadge.kind === 'partial'
                                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                        }`}
                                      >
                                        {payBadge.label}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5 relative">
                                      <span
                                        className={`w-2 h-2 rounded-full shrink-0 ${STATUS_META[order.status].dotClass}`}
                                      />
                                      <select
                                        value={order.status}
                                        disabled={updatingOrderId === order.id}
                                        onChange={(e) =>
                                          handleStatusChange(order.id, e.target.value as OrderStatus)
                                        }
                                        className={`text-xs font-semibold py-1.5 px-2.5 rounded-xl border outline-none cursor-pointer transition-colors ${STATUS_META[order.status].pillClass}`}
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="approved">Approved</option>
                                        <option value="in-production">In Production</option>
                                        <option value="dispatched">Dispatched</option>
                                        <option value="delivered">Delivered</option>
                                      </select>
                                    </div>
                                  </td>

                                  <td className="py-3.5 px-3 align-middle whitespace-nowrap">
                                    {hasRealAwb ? (
                                      <div className="space-y-0.5">
                                        <div className="font-mono text-[#071B35] font-semibold">
                                          {order.tracking_number}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px]">
                                          <button
                                            onClick={() =>
                                              handleTrackDelhiveryOrder(order.tracking_number!)
                                            }
                                            className="text-[#FF7900] font-semibold hover:underline cursor-pointer"
                                          >
                                            Track
                                          </button>
                                          <span className="text-slate-300">·</span>
                                          <a
                                            href={getDelhiveryLabelUrl(order.tracking_number!)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-emerald-700 font-semibold hover:underline"
                                          >
                                            Label
                                          </a>
                                        </div>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => openDispatchModalForOrder(order)}
                                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FF7900] text-[#FF7900] hover:text-white border border-[#FF7900] text-[11px] font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                                      >
                                        <Truck className="w-3.5 h-3.5" />
                                        <span>Book Delivery</span>
                                      </button>
                                    )}
                                  </td>

                                  <td className="py-3.5 pl-3 pr-4 align-middle text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-1.5 relative">
                                      <button
                                        onClick={() => setInspectingOrder(order)}
                                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-[#071B35] text-slate-600 hover:text-white inline-flex items-center justify-center transition-colors cursor-pointer"
                                        title="Inspect order details & artwork"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <a
                                        href={getDirectClientWhatsAppUrl({
                                          phone: order.phone,
                                          name: order.customer_name,
                                          type: 'order',
                                          orderId: formatOrderRef(order.id),
                                          status: order.status,
                                          courier: order.courier_partner,
                                          trackingNumber: order.tracking_number,
                                        })}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-8 h-8 rounded-full bg-[#1EBE5D] hover:bg-[#19a851] text-white inline-flex items-center justify-center transition-colors shadow-2xs"
                                        title="WhatsApp client"
                                      >
                                        <WhatsAppIcon className="w-3.5 h-3.5 text-white" />
                                      </a>
                                      <button
                                        onClick={() =>
                                          setOpenRowMenuId((prev) =>
                                            prev === order.id ? null : order.id
                                          )
                                        }
                                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 inline-flex items-center justify-center transition-colors cursor-pointer"
                                        title="More order actions"
                                      >
                                        <MoreHorizontal className="w-4 h-4" />
                                      </button>

                                      {openRowMenuId === order.id && (
                                        <div className="absolute right-0 top-10 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 space-y-0.5 z-40 animate-admin-scale-in text-left">
                                          <button
                                            onClick={() => {
                                              setOpenRowMenuId(null);
                                              handleSendOrderConfirmationEmail(order);
                                            }}
                                            disabled={sendingEmailOrderId === order.id}
                                            className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 text-[#071B35] text-xs font-medium flex items-center gap-2 cursor-pointer"
                                          >
                                            <Mail className="w-3.5 h-3.5 text-[#FF7900]" />
                                            <span>Send Hostinger Email</span>
                                          </button>
                                          <button
                                            onClick={() => {
                                              setOpenRowMenuId(null);
                                              generateAdminOrderInvoicePdf(order, PRODUCTS);
                                            }}
                                            className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 text-[#071B35] text-xs font-medium flex items-center gap-2 cursor-pointer"
                                          >
                                            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Download Invoice PDF</span>
                                          </button>
                                          {onNavigateToOrderTracking && (
                                            <button
                                              onClick={() => {
                                                setOpenRowMenuId(null);
                                                onNavigateToOrderTracking(formatOrderRef(order.id));
                                              }}
                                              className="w-full px-2.5 py-2 rounded-lg hover:bg-slate-100 text-[#071B35] text-xs font-medium flex items-center gap-2 cursor-pointer"
                                            >
                                              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                                              <span>Customer View</span>
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* RESPONSIVE CARDS VIEW (Always on Mobile/Tablet, optional on Desktop) */}
                    <div
                      className={`${
                        ordersViewMode === 'table' ? 'md:hidden' : ''
                      } p-4 space-y-3.5 bg-slate-50/40`}
                    >
                      {paginatedOrders.map((order) => {
                        const { product, unitPrice, total } = getOrderEstimates(order);
                        const parsed = parseOrderNotes(order.custom_notes);
                        const thumb = getOrderThumbnail(order, parsed);
                        const payBadge = getPaymentBadge(parsed, total);
                        const hasRealAwb =
                          Boolean(order.tracking_number) &&
                          !order.tracking_number!.toLowerCase().includes('awaiting');

                        return (
                          <div
                            key={order.id}
                            className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs hover:shadow-md transition-shadow"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                              <div>
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <button
                                    onClick={() => setInspectingOrder(order)}
                                    className="font-mono font-bold text-[#FF7900] hover:underline cursor-pointer"
                                  >
                                    #{formatOrderRef(order.id)}
                                  </button>
                                  <span className="text-slate-300">·</span>
                                  <span className="text-slate-500 font-mono tabular-nums">
                                    {new Date(order.created_at).toLocaleDateString('en-IN', {
                                      day: '2-digit',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                <div className="text-sm font-bold text-[#071B35] mt-0.5">
                                  {order.customer_name}{' '}
                                  <span className="text-xs font-mono text-slate-500 font-normal">
                                    ({order.phone})
                                  </span>
                                </div>
                              </div>

                              <div className="text-right font-mono tabular-nums">
                                <div className="text-base font-bold text-[#071B35]">
                                  ₹{total.toLocaleString('en-IN')}
                                </div>
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-sans font-semibold border mt-0.5 ${
                                    payBadge.kind === 'paid'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : payBadge.kind === 'partial'
                                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {payBadge.label}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-start gap-3">
                              <OrderThumb
                                src={thumb}
                                alt={product?.name || 'Order'}
                                sizeClass="w-14 h-14"
                                onClick={
                                  parsed.frontMockupUrl || order.logo_url
                                    ? () =>
                                        setPreviewLogoUrl(parsed.frontMockupUrl || order.logo_url!)
                                    : undefined
                                }
                              />
                              <div className="min-w-0 flex-1 text-xs space-y-1">
                                <div className="font-semibold text-[#071B35]">
                                  {product?.name || order.product_id || 'Custom Product'}{' '}
                                  <span className="font-mono text-[#FF7900]">
                                    · {order.quantity} pcs @ ₹{unitPrice}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {[parsed.color, parsed.size, parsed.method]
                                    .filter(Boolean)
                                    .join(' · ') || 'Custom Specifications'}
                                </div>
                                {parsed.parsedAddress.city && (
                                  <div className="text-[11px] text-slate-400">
                                    {parsed.parsedAddress.city} {parsed.parsedAddress.pincode}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={order.status}
                                  disabled={updatingOrderId === order.id}
                                  onChange={(e) =>
                                    handleStatusChange(order.id, e.target.value as OrderStatus)
                                  }
                                  className={`text-xs font-semibold py-2 px-3 rounded-xl border outline-none cursor-pointer min-h-[40px] ${STATUS_META[order.status].pillClass}`}
                                >
                                  <option value="pending">Pending Review</option>
                                  <option value="approved">Proof Approved</option>
                                  <option value="in-production">In Production</option>
                                  <option value="dispatched">Dispatched</option>
                                  <option value="delivered">Delivered</option>
                                </select>

                                {hasRealAwb ? (
                                  <div className="flex items-center gap-2 text-xs font-mono text-[#071B35] bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                                    <span>AWB: {order.tracking_number}</span>
                                    <button
                                      onClick={() => handleTrackDelhiveryOrder(order.tracking_number!)}
                                      className="text-[#FF7900] hover:underline font-sans font-semibold cursor-pointer"
                                    >
                                      Track
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => openDispatchModalForOrder(order)}
                                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#FF7900] text-[#FF7900] hover:text-white border border-[#FF7900] text-xs font-semibold flex items-center gap-1.5 cursor-pointer min-h-[40px] transition-colors"
                                  >
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>Book Delivery</span>
                                  </button>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  onClick={() => setInspectingOrder(order)}
                                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-[#071B35] text-[#071B35] hover:text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer min-h-[40px] transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Inspect</span>
                                </button>
                                <button
                                  onClick={() => generateAdminOrderInvoicePdf(order, PRODUCTS)}
                                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#071B35] text-xs font-medium flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                                >
                                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Invoice</span>
                                </button>
                                <a
                                  href={getDirectClientWhatsAppUrl({
                                    phone: order.phone,
                                    name: order.customer_name,
                                    type: 'order',
                                    orderId: formatOrderRef(order.id),
                                    status: order.status,
                                    courier: order.courier_partner,
                                    trackingNumber: order.tracking_number,
                                  })}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-2 rounded-xl bg-[#1EBE5D] hover:bg-[#19a851] text-white text-xs font-semibold flex items-center gap-1.5 min-h-[40px]"
                                >
                                  <WhatsAppIcon className="w-3.5 h-3.5 text-white" />
                                  <span>WhatsApp</span>
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* PAGINATION FOOTER (Matching Reference) */}
                    <div className="px-4 py-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
                      <div className="flex items-center gap-3">
                        <span className="font-mono tabular-nums">
                          Showing{' '}
                          <strong className="text-[#071B35]">
                            {filteredOrders.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
                          </strong>
                          –
                          <strong className="text-[#071B35]">
                            {Math.min(safePage * pageSize, filteredOrders.length)}
                          </strong>{' '}
                          of <strong className="text-[#071B35]">{filteredOrders.length}</strong> orders
                        </span>
                        <select
                          value={pageSize}
                          onChange={(e) => setPageSize(Number(e.target.value))}
                          className="bg-slate-50 border border-slate-200 rounded-lg py-1 px-2 text-xs text-[#071B35] outline-none cursor-pointer"
                          aria-label="Rows per page"
                        >
                          <option value={10}>10 / page</option>
                          <option value={25}>25 / page</option>
                          <option value={50}>50 / page</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={safePage <= 1}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                          aria-label="First page"
                        >
                          <ChevronsLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                          let pageNum = idx + 1;
                          if (totalPages > 5 && safePage > 3) {
                            pageNum = Math.min(totalPages - 4 + idx, safePage - 2 + idx);
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 rounded-lg text-xs font-mono font-semibold flex items-center justify-center cursor-pointer transition-colors ${
                                safePage === pageNum
                                  ? 'bg-[#FF7900] text-white shadow-xs'
                                  : 'border border-slate-200 bg-white hover:bg-slate-50 text-[#071B35]'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                          aria-label="Next page"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={safePage >= totalPages}
                          className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 flex items-center justify-center cursor-pointer"
                          aria-label="Last page"
                        >
                          <ChevronsRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeSection === 'dispatch' && (
            <DispatchCenterView
              delhiveryStatus={delhiveryStatus}
              readyToShipOrders={readyToShipOrders}
              activeAwbOrders={activeAwbOrders}
              diagPickupName={diagPickupName}
              setDiagPickupName={setDiagPickupName}
              pickupDateInput={pickupDateInput}
              setPickupDateInput={setPickupDateInput}
              pickupTimeInput={pickupTimeInput}
              setPickupTimeInput={setPickupTimeInput}
              pickupPkgCount={pickupPkgCount}
              setPickupPkgCount={setPickupPkgCount}
              schedulingPickup={schedulingPickup}
              pickupResult={pickupResult}
              onSchedulePickup={handleSchedulePickup}
              quickTrackAwb={quickTrackAwb}
              setQuickTrackAwb={setQuickTrackAwb}
              loadingQuickTrack={loadingQuickTrack}
              quickTrackResult={quickTrackResult}
              onQuickTrackLookup={handleQuickTrackLookup}
              testPinInput={testPinInput}
              setTestPinInput={setTestPinInput}
              testingPin={testingPin}
              testPinResult={testPinResult}
              onTestDelhiveryPin={handleTestDelhiveryPin}
              onOpenDispatchModal={openDispatchModalForOrder}
              onTrackDelhiveryOrder={handleTrackDelhiveryOrder}
              onStatusChange={handleStatusChange}
            />
          )}

          {activeSection === 'products' && (
            <ProductsCatalogView
              dbProducts={dbProducts}
              onCreateOrderForProduct={(pid) => {
                setNewOrdProductId(pid);
                setCreateOrderOpen(true);
              }}
            />
          )}

          {activeSection === 'reviews' && (
            <AdminReviewsPanel
              onPendingCountChange={setPendingReviewsCount}
              onToast={showToast}
              onSessionExpired={handleLock}
            />
          )}

          {activeSection === 'affiliates' && (
            <AdminAffiliatePanel />
          )}

          {activeSection === 'coupons' && (
            <AdminCouponPanel onShowToast={(msg, tone) => showToast(tone === 'error' ? 'error' : 'success', msg)} />
          )}

          {activeSection === 'customers' && (
            <CustomersDirectoryView
              orders={orders}
              onInspectOrder={(o) => setInspectingOrder(o)}
            />
          )}

          {activeSection === 'marketing' && (
            <MarketingRecoveryView
              abandonedLeads={abandonedLeads}
              loadingLeads={loadingLeads}
              analytics={analytics}
              onRecoverLead={handleRecoverLead}
            />
          )}

          {activeSection === 'analytics' && (
            <ReportsAnalyticsView
              orders={orders}
              analytics={analytics}
              onExportCsv={handleExportOrdersCsv}
            />
          )}

          {activeSection === 'integrations' && (
            <IntegrationsSetupView
              smtpStatus={smtpStatus}
              razorpayStatus={razorpayStatus}
              delhiveryStatus={delhiveryStatus}
              aisensyStatus={aisensyStatus}
              aisensyLogs={aisensyLogs}
              testWaPhone={testWaPhone}
              setTestWaPhone={setTestWaPhone}
              testingAiSensy={testingAiSensy}
              aisensyTestResult={aisensyTestResult}
              onTestAiSensy={async (testType = 'order_confirmation') => {
                setTestingAiSensy(true);
                setAiSensyTestResult(null);
                try {
                  const res = await testAiSensyConnection(testWaPhone, testType);
                  setAiSensyTestResult({ success: res.success, message: res.message });
                  const logsRes = await getAiSensyLogs();
                  setAiSensyLogs(logsRes.logs || []);
                } finally {
                  setTestingAiSensy(false);
                }
              }}
              onRefreshAiSensyLogs={async () => {
                const [statusRes, logsRes] = await Promise.all([getAiSensyStatus(), getAiSensyLogs()]);
                setAiSensyStatus(statusRes);
                setAiSensyLogs(logsRes.logs || []);
              }}
              testEmailInput={testEmailInput}
              setTestEmailInput={setTestEmailInput}
              testingSmtp={testingSmtp}
              smtpTestResult={smtpTestResult}
              onTestSmtpEmail={handleTestSmtpEmail}
              testingRazorpay={testingRazorpay}
              razorpayTestResult={razorpayTestResult}
              onVerifyRazorpay={async () => {
                setTestingRazorpay(true);
                setRazorpayTestResult(null);
                try {
                  const res = await testRazorpayConnection();
                  setRazorpayTestResult({ success: res.success, message: res.message });
                } finally {
                  setTestingRazorpay(false);
                }
              }}
              onOpenDispatchTab={() => setActiveSection('dispatch')}
            />
          )}

          {activeSection === 'security' && (
            <AdminSecurityPanel
              onToast={showToast}
              onSessionExpired={handleLock}
            />
          )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* MODAL: CREATE CUSTOM ORDER (+ CREATE ORDER BUTTON) */}
      {/* ===================================================================== */}
      {createOrderOpen && (
        <div className="fixed inset-0 z-[60] bg-[#071B35]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-4 animate-admin-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#FF7900]/10 text-[#FF7900] flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-[#071B35] text-base">
                    Create Custom Order
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Saves directly into your live Supabase orders queue
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateOrderOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#071B35] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManualOrder} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newOrdCustomer}
                    onChange={(e) => setNewOrdCustomer(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#071B35] focus:border-[#FF7900] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={newOrdPhone}
                    onChange={(e) => setNewOrdPhone(e.target.value)}
                    placeholder="+91 9876543210"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#071B35] font-mono focus:border-[#FF7900] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    Customer Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={newOrdEmail}
                    onChange={(e) => setNewOrdEmail(e.target.value)}
                    placeholder="client@company.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#071B35] focus:border-[#FF7900] outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">
                    Company (Optional)
                  </label>
                  <input
                    type="text"
                    value={newOrdCompany}
                    onChange={(e) => setNewOrdCompany(e.target.value)}
                    placeholder="Acme Corp Pvt Ltd"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#071B35] focus:border-[#FF7900] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-600 mb-1">Product *</label>
                  <select
                    value={newOrdProductId}
                    onChange={(e) => setNewOrdProductId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#071B35] focus:border-[#FF7900] outline-none"
                  >
                    {PRODUCTS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.basePrice}/pc)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newOrdQty}
                    onChange={(e) => setNewOrdQty(Number(e.target.value) || 1)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#071B35] font-mono focus:border-[#FF7900] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">Payment Plan</label>
                <select
                  value={newOrdPaymentPlan}
                  onChange={(e) => setNewOrdPaymentPlan(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#071B35] focus:border-[#FF7900] outline-none"
                >
                  <option value="Full Prepaid (100% Online)">Full Prepaid (100% Online)</option>
                  <option value="Partial Payment (50% Advance)">Partial Payment (50% Advance)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Delivery Address &amp; Pincode
                </label>
                <input
                  type="text"
                  value={newOrdAddress}
                  onChange={(e) => setNewOrdAddress(e.target.value)}
                  placeholder="Street, City, State - 500001"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#071B35] focus:border-[#FF7900] outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-600 mb-1">
                  Print Instructions / Notes
                </label>
                <textarea
                  rows={2}
                  value={newOrdNotes}
                  onChange={(e) => setNewOrdNotes(e.target.value)}
                  placeholder="Logo size, print placement, special requests..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-[#071B35] focus:border-[#FF7900] outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOrderOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#071B35] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNewOrder}
                  className="px-5 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] text-white font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingNewOrder ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{submittingNewOrder ? 'Saving...' : 'Create Order'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SLIDE-OVER ORDER INSPECTOR DRAWER */}
      {/* ===================================================================== */}
      {inspectingOrder && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#071B35]/55 backdrop-blur-xs"
            onClick={() => setInspectingOrder(null)}
          />
          <div className="relative w-full max-w-2xl bg-white border-l border-slate-200 h-full overflow-y-auto z-10 flex flex-col shadow-2xl animate-admin-slide-right">
            {(() => {
              const { product, unitPrice, subtotal, gst, total } = getOrderEstimates(inspectingOrder);
              const parsed = parseOrderNotes(inspectingOrder.custom_notes);
              const hasRealAwb =
                Boolean(inspectingOrder.tracking_number) &&
                !inspectingOrder.tracking_number!.toLowerCase().includes('awaiting');

              return (
                <>
                  <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-slate-200 px-5 sm:px-6 py-4 flex items-center justify-between gap-3 z-10">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span className="text-[#FF7900] font-bold">
                          #{formatOrderRef(inspectingOrder.id)}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500">
                          {new Date(inspectingOrder.created_at).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <h2 className="font-display font-bold text-lg text-[#071B35] mt-0.5">
                        {inspectingOrder.customer_name}
                        {inspectingOrder.company ? ` — ${inspectingOrder.company}` : ''}
                      </h2>
                    </div>
                    <button
                      onClick={() => setInspectingOrder(null)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-[#071B35] cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-5 sm:p-6 space-y-6 text-xs">
                    {/* 5-Stage Pipeline */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Update Production Stage
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {(Object.keys(STATUS_META) as OrderStatus[]).map((st) => (
                          <button
                            key={st}
                            disabled={updatingOrderId === inspectingOrder.id}
                            onClick={() => handleStatusChange(inspectingOrder.id, st)}
                            className={`py-2 px-2.5 rounded-xl border text-[11px] font-semibold cursor-pointer transition-colors ${
                              inspectingOrder.status === st
                                ? 'bg-[#FF7900] border-[#FF7900] text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-[#071B35]'
                            }`}
                          >
                            {STATUS_META[st].label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Artwork & Placed Product Mockups */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="text-[11px] font-semibold text-slate-500">
                        Artwork &amp; Product Placement Files
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {[
                          { label: 'Client Raw Logo', url: inspectingOrder.logo_url },
                          { label: 'Front Placed Mockup', url: parsed.frontMockupUrl },
                          { label: 'Back Placed Mockup', url: parsed.backMockupUrl },
                          { label: 'Back Raw Logo', url: parsed.backLogoUrl },
                        ]
                          .filter((asset) => Boolean(asset.url))
                          .map((asset) => (
                            <div
                              key={asset.label}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2"
                            >
                              <button
                                onClick={() => setPreviewLogoUrl(asset.url!)}
                                className="w-full h-28 rounded-lg bg-white border border-slate-100 flex items-center justify-center p-1 overflow-hidden cursor-zoom-in"
                              >
                                <img
                                  src={asset.url!}
                                  alt={asset.label}
                                  className="max-w-full max-h-full object-contain"
                                />
                              </button>
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] text-slate-600 truncate">
                                  {asset.label}
                                </span>
                                <a
                                  href={asset.url!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download
                                  className="text-[#FF7900] font-semibold hover:underline text-[11px] shrink-0"
                                >
                                  Save
                                </a>
                              </div>
                            </div>
                          ))}
                        {!inspectingOrder.logo_url && !parsed.frontMockupUrl && (
                          <div className="col-span-full py-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500">
                            No custom logo or mockup uploaded for this order.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Production Specs & Client Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-slate-500">
                          Product &amp; Print Specifications
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                          <div className="font-bold text-[#071B35] text-sm">
                            {product?.name || inspectingOrder.product_id}
                          </div>
                          <div className="text-slate-700 font-mono tabular-nums">
                            {inspectingOrder.quantity} units × ₹{unitPrice} = ₹
                            {subtotal.toLocaleString('en-IN')}
                          </div>
                          <div className="text-slate-600">
                            GST (18%): ₹{gst.toLocaleString('en-IN')} · Est. Total:{' '}
                            <strong className="text-[#071B35]">
                              ₹{total.toLocaleString('en-IN')}
                            </strong>
                          </div>
                          {parsed.color && (
                            <div className="text-slate-600">
                              Color: <span className="text-[#071B35] font-medium">{parsed.color}</span>
                            </div>
                          )}
                          {parsed.size && (
                            <div className="text-slate-600">
                              Size: <span className="text-[#071B35] font-medium">{parsed.size}</span>
                            </div>
                          )}
                          {parsed.method && (
                            <div className="text-slate-600">
                              Method: <span className="text-[#071B35] font-medium">{parsed.method}</span>
                            </div>
                          )}
                          {parsed.placementSummary && (
                            <div className="text-slate-600 leading-relaxed pt-1 border-t border-slate-200">
                              Layout: <span className="text-[#071B35]">{parsed.placementSummary}</span>
                            </div>
                          )}
                          {parsed.customNotesText && (
                            <div className="text-slate-600 leading-relaxed">
                              Client Note: <span className="text-[#071B35]">{parsed.customNotesText}</span>
                            </div>
                          )}
                          {parsed.voiceNoteUrl && (
                            <div className="pt-2 border-t border-slate-200 space-y-1">
                              <div className="text-[11px] font-semibold text-emerald-700">
                                🎙️ Customer Voice Instructions
                              </div>
                              <audio controls src={parsed.voiceNoteUrl} className="w-full h-8 rounded-lg" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-slate-500">
                          Client, Billing &amp; Delivery Address
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#071B35]">
                              {inspectingOrder.customer_name}
                            </span>
                            <a
                              href={`tel:${inspectingOrder.phone}`}
                              className="font-mono font-semibold text-[#FF7900] hover:underline"
                            >
                              {inspectingOrder.phone}
                            </a>
                          </div>
                          <div className="text-slate-600 truncate">
                            {inspectingOrder.customer_email}
                          </div>
                          {parsed.gstin && (
                            <div className="font-mono text-[#071B35]">GSTIN: {parsed.gstin}</div>
                          )}
                          {parsed.parsedAddress.full && (
                            <div className="pt-2 border-t border-slate-200 space-y-1">
                              <div className="text-slate-700 leading-relaxed">
                                {parsed.parsedAddress.full}
                              </div>
                              <button
                                onClick={() =>
                                  handleCopy(parsed.parsedAddress.full, inspectingOrder.id + '-addr')
                                }
                                className="text-[11px] font-semibold text-[#FF7900] hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                {copiedId === inspectingOrder.id + '-addr' ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>Copied Address</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Shipping Address</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                          {(parsed.paymentPlan || parsed.paidAmount) && (
                            <div className="pt-2 border-t border-slate-200 space-y-0.5 font-mono">
                              {parsed.paymentPlan && (
                                <div className="text-[#071B35]">{parsed.paymentPlan}</div>
                              )}
                              {parsed.paidAmount && (
                                <div className="text-emerald-700 font-semibold">
                                  Paid: ₹{parsed.paidAmount}
                                  {parsed.balanceDue && parsed.balanceDue !== '0'
                                    ? ` · Balance Due: ₹${parsed.balanceDue}`
                                    : ''}
                                </div>
                              )}
                              {parsed.razorpayId && (
                                <div className="text-[11px] text-slate-500">
                                  Razorpay ID: {parsed.razorpayId}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={() => openDispatchModalForOrder(inspectingOrder)}
                        className="px-4 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Truck className="w-4 h-4" />
                        <span>{hasRealAwb ? 'Edit Delhivery / AWB' : 'Book Delhivery AWB'}</span>
                      </button>

                      {hasRealAwb && (
                        <>
                          <button
                            onClick={() =>
                              handleTrackDelhiveryOrder(inspectingOrder.tracking_number!)
                            }
                            className="px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold flex items-center gap-1.5 cursor-pointer"
                          >
                            <MapPin className="w-4 h-4" />
                            <span>Track Live</span>
                          </button>
                          <a
                            href={getDelhiveryLabelUrl(inspectingOrder.tracking_number!)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1.5"
                          >
                            <Printer className="w-4 h-4" />
                            <span>Label PDF</span>
                          </a>
                        </>
                      )}

                      <button
                        onClick={() => handleSendOrderConfirmationEmail(inspectingOrder)}
                        disabled={sendingEmailOrderId === inspectingOrder.id}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#071B35] font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <Mail className="w-4 h-4 text-[#FF7900]" />
                        <span>
                          {sendingEmailOrderId === inspectingOrder.id ? 'Sending...' : 'Send Email'}
                        </span>
                      </button>

                      <button
                        onClick={() => generateAdminOrderInvoicePdf(inspectingOrder, PRODUCTS)}
                        className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#071B35] font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>Invoice PDF</span>
                      </button>

                      <a
                        href={getDirectClientWhatsAppUrl({
                          phone: inspectingOrder.phone,
                          name: inspectingOrder.customer_name,
                          type: 'order',
                          orderId: formatOrderRef(inspectingOrder.id),
                          status: inspectingOrder.status,
                          courier: inspectingOrder.courier_partner,
                          trackingNumber: inspectingOrder.tracking_number,
                        })}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2.5 rounded-xl bg-[#1EBE5D] hover:bg-[#19a851] text-white font-semibold flex items-center gap-1.5"
                      >
                        <WhatsAppIcon className="w-4 h-4 text-white" />
                        <span>WhatsApp</span>
                      </a>

                      {onNavigateToOrderTracking && (
                        <button
                          onClick={() =>
                            onNavigateToOrderTracking(formatOrderRef(inspectingOrder.id))
                          }
                          className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#071B35] font-medium flex items-center gap-1.5 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Customer View</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: DELHIVERY MANIFEST BOOKING & COURIER DISPATCH EDITOR */}
      {/* ===================================================================== */}
      {editingDispatchOrder && (
        <div className="fixed inset-0 z-[60] bg-[#071B35]/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl space-y-5 animate-admin-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#FF7900]" />
                <h3 className="font-display font-bold text-[#071B35] text-base">
                  Book Delhivery Shipment / Edit AWB
                </h3>
              </div>
              <button
                onClick={() => setEditingDispatchOrder(null)}
                className="text-slate-400 hover:text-[#071B35] p-1.5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-orange-50/70 border border-orange-200 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[#FF7900]">
                  Delhivery One Live Manifest (Prepaid · No COD)
                </span>
                <span
                  className={`text-[11px] font-mono font-semibold ${
                    delhiveryStatus?.configured ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {delhiveryStatus?.configured ? 'API Active' : 'Set DELHIVERY_API_TOKEN'}
                </span>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1.5 text-[11px]">
                  Select Pickup Warehouse Facility
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: 'Teqqnoworld', sub: 'Hyderabad · 502032' },
                    { name: 'Teqqnoworld 2', sub: 'Hyderabad · 500090' },
                  ].map((wh) => (
                    <button
                      key={wh.name}
                      type="button"
                      onClick={() => setDelhiveryPickup(wh.name)}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        delhiveryPickup === wh.name
                          ? 'border-[#FF7900] bg-white text-[#071B35] shadow-xs'
                          : 'border-slate-200 bg-white/60 text-slate-600 hover:text-[#071B35]'
                      }`}
                    >
                      <div className="font-bold">{wh.name}</div>
                      <div className="text-[11px] font-mono text-slate-500">{wh.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block text-slate-600 mb-1 text-[11px]">
                    Delivery Street Address
                  </label>
                  <input
                    type="text"
                    value={shipAddress}
                    onChange={(e) => setShipAddress(e.target.value)}
                    placeholder="Plot / Tower / Street..."
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-[#071B35] outline-none focus:border-[#FF7900]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 text-[11px]">City</label>
                  <input
                    type="text"
                    value={shipCity}
                    onChange={(e) => setShipCity(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-[#071B35] outline-none focus:border-[#FF7900]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 text-[11px]">State</label>
                  <input
                    type="text"
                    value={shipState}
                    onChange={(e) => setShipState(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-[#071B35] outline-none focus:border-[#FF7900]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 text-[11px]">
                    Delivery Pincode (6 digits)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={shipPincode}
                    onChange={(e) => setShipPincode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-[#071B35] font-mono outline-none focus:border-[#FF7900]"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 text-[11px]">
                    Package Weight (grams)
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={shipWeight}
                    onChange={(e) => setShipWeight(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-[#071B35] font-mono outline-none focus:border-[#FF7900]"
                  />
                </div>
              </div>

              {shipmentError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-[11px]">
                  {shipmentError}
                </div>
              )}

              <button
                type="button"
                onClick={handleBookDelhiveryShipment}
                disabled={creatingShipment}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] text-white font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {creatingShipment ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Truck className="w-4 h-4" />
                )}
                <span>
                  {creatingShipment
                    ? 'Creating Delhivery Manifest...'
                    : `Generate Live Delhivery AWB (${delhiveryPickup})`}
                </span>
              </button>
            </div>

            <form
              onSubmit={handleSaveDispatch}
              className="space-y-4 text-xs pt-2 border-t border-slate-100"
            >
              <div className="text-slate-600 font-semibold">Manual Courier &amp; Waybill Assignment</div>
              <div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                    'Delhivery (Teqqnoworld)',
                    'Delhivery (Teqqnoworld 2)',
                    'Blue Dart Apex Express',
                    'DTDC Express Air',
                  ].map((partner) => (
                    <button
                      key={partner}
                      type="button"
                      onClick={() => setCourierInput(partner)}
                      className={`py-2 px-2 rounded-xl border text-center transition-colors cursor-pointer truncate ${
                        courierInput === partner
                          ? 'border-[#FF7900] bg-orange-50 text-[#FF7900] font-semibold'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-[#071B35]'
                      }`}
                    >
                      {partner}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Courier name..."
                  value={courierInput}
                  onChange={(e) => setCourierInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#071B35] focus:border-[#FF7900] outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1.5 font-medium">
                  Tracking Number / AWB
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1492819201928"
                  value={awbInput}
                  onChange={(e) => setAwbInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-[#071B35] font-mono focus:border-[#FF7900] outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDispatchOrder(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#071B35] font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingOrderId === editingDispatchOrder.id}
                  className="px-5 py-2 rounded-xl bg-[#071B35] text-white hover:bg-[#0d2a52] font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Manual AWB</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: LIVE DELHIVERY TRACKING */}
      {/* ===================================================================== */}
      {trackingOrderAwb && (
        <div className="fixed inset-0 z-[60] bg-[#071B35]/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-admin-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#FF7900]" />
                <h3 className="font-display font-bold text-[#071B35] text-base">
                  Delhivery Tracking: {trackingOrderAwb}
                </h3>
              </div>
              <button
                onClick={() => setTrackingOrderAwb(null)}
                className="text-slate-400 hover:text-[#071B35] p-1.5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingTrack ? (
              <div className="py-10 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#FF7900]" />
                <span>Fetching live scans from Delhivery...</span>
              </div>
            ) : trackingModalData ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">Current Status:</span>
                  <span className="font-bold text-emerald-700 font-mono">
                    {trackingModalData.currentStatus ||
                      (trackingModalData.success ? 'Manifested' : 'Pending')}
                  </span>
                </div>
                {trackingModalData.statusLocation && (
                  <div className="text-slate-700 font-mono text-[11px]">
                    Hub Location: {trackingModalData.statusLocation}
                  </div>
                )}
                {trackingModalData.message && !trackingModalData.success && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                    {trackingModalData.message}
                  </div>
                )}
                {trackingModalData.scans?.length > 0 && (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {trackingModalData.scans.map((scan, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-0.5"
                      >
                        <div className="font-semibold text-[#071B35]">{scan.status}</div>
                        <div className="text-[11px] text-slate-500">{scan.location}</div>
                        <div className="text-[10px] font-mono text-slate-400">{scan.time}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: FULL RESOLUTION LOGO & MOCKUP PREVIEW */}
      {/* ===================================================================== */}
      {previewLogoUrl && (
        <div className="fixed inset-0 z-[70] bg-[#071B35]/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4 animate-admin-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-display font-bold text-[#071B35] text-base">
                Artwork &amp; Product Placement Preview
              </h3>
              <button
                onClick={() => setPreviewLogoUrl(null)}
                className="text-slate-400 hover:text-[#071B35] p-1.5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center max-h-[60vh] overflow-hidden">
              <img
                src={previewLogoUrl}
                alt="High-resolution client artwork"
                className="max-w-full max-h-[50vh] object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-2 gap-3">
              <span className="text-xs font-mono text-slate-500 truncate max-w-sm">
                {previewLogoUrl}
              </span>
              <a
                href={previewLogoUrl}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="px-4 py-2 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] text-white text-xs font-semibold flex items-center gap-2 shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Asset</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
