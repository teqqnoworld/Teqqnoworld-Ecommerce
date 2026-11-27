import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  BarChart3,
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Gift,
  History,
  Image as ImageIcon,
  Layers,
  Lock,
  Mail,
  Pause,
  Percent,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Ticket,
  Trash2,
  TrendingUp,
  Truck,
  Upload,
  UserCheck,
  Users,
  Wand2,
  X,
  XCircle,
} from 'lucide-react';
import { PRODUCTS } from '../../data/mockData';
import { uploadBrandLogoToStorage } from '../../services/supabaseService';
import {
  bulkGenerateAdminCoupons,
  changeAdminCouponStatus,
  createAdminCoupon,
  deleteAdminDraftCoupon,
  downloadAdminCouponCsv,
  duplicateAdminCoupon,
  fetchAdminCouponOverview,
  generateAdminCouponCode,
  notifyAdminCouponCustomers,
  restoreAdminCouponRedemption,
  searchAdminCustomers,
  updateAdminCoupon,
  updateAdminCouponSettings,
} from '../../services/couponService';
import { generateCouponAnalyticsReportPdf } from '../../utils/pdfGenerator';
import type {
  AssignedCustomerRef,
  CouponAnalyticsOverview,
  CouponApplicability,
  CouponCustomerDirectoryItem,
  CouponOfferType,
  CouponRecord,
  CouponStatus,
  CreateCouponPayload,
  CustomerGroupType,
  FestivalPresetId,
} from '../../types/coupon';

export type CouponSubSection =
  | 'dashboard'
  | 'create'
  | 'all'
  | 'scheduled'
  | 'customer_specific'
  | 'festival'
  | 'reports'
  | 'expired';

interface AdminCouponPanelProps {
  onShowToast?: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

const SUB_TABS: Array<{ id: CouponSubSection; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'Coupon Dashboard', icon: BarChart3 },
  { id: 'create', label: 'Create New Coupon', icon: Plus },
  { id: 'all', label: 'All Coupons', icon: Ticket },
  { id: 'scheduled', label: 'Scheduled Offers', icon: CalendarClock },
  { id: 'customer_specific', label: 'Customer-Specific', icon: UserCheck },
  { id: 'festival', label: 'Festival Offers', icon: Sparkles },
  { id: 'reports', label: 'Usage & Reports', icon: FileSpreadsheet },
  { id: 'expired', label: 'Expired Coupons', icon: Clock },
];

const PRODUCT_CATEGORIES = [
  { id: 'apparel', label: 'Custom Apparel & Polos / Caps' },
  { id: 'drinkware', label: 'Ceramic Mugs & Drinkware' },
  { id: 'signage', label: 'Event Signage, Canopies & Displays' },
  { id: 'stationery', label: 'Visiting Cards & Stationery' },
  { id: 'gifts', label: 'Corporate Gift Sets & Kits' },
];

const FESTIVAL_PRESETS: Array<{
  id: FestivalPresetId;
  label: string;
  defaultCodePrefix: string;
  headline: string;
  subtext: string;
  accentGradient: string;
}> = [
  {
    id: 'diwali',
    label: 'Diwali',
    defaultCodePrefix: 'DIWALI',
    headline: 'Diwali Corporate Gifting & Branding Sale',
    subtext: 'Celebrate with extra festive savings on custom hampers, apparel & event displays.',
    accentGradient: 'from-[#071B35] via-[#1B2B4B] to-[#FF7A00]',
  },
  {
    id: 'holi',
    label: 'Holi',
    defaultCodePrefix: 'HOLI',
    headline: 'Holi Festival of Colors Mega Offer',
    subtext: 'Brighten your brand campaigns with vibrant DTF tees, mugs & promotional kits.',
    accentGradient: 'from-[#071B35] via-[#312E81] to-[#FF7A00]',
  },
  {
    id: 'eid',
    label: 'Eid',
    defaultCodePrefix: 'EID',
    headline: 'Eid Mubarak Exclusive Corporate Savings',
    subtext: 'Special festive discount on premium customized corporate gifting & apparel.',
    accentGradient: 'from-[#071B35] via-[#064E3B] to-[#D97706]',
  },
  {
    id: 'christmas',
    label: 'Christmas',
    defaultCodePrefix: 'XMAS',
    headline: 'Christmas & Year-End Gifting Celebration',
    subtext: 'Order branded employee hampers and winter polos with festive savings.',
    accentGradient: 'from-[#071B35] via-[#7F1D1D] to-[#FF7A00]',
  },
  {
    id: 'new_year',
    label: 'New Year',
    defaultCodePrefix: 'NEWYEAR',
    headline: 'New Year Brand Launch Special',
    subtext: 'Kickstart the new year with custom joining kits, visiting cards & polos.',
    accentGradient: 'from-[#071B35] via-[#1E3A8A] to-[#FF7A00]',
  },
  {
    id: 'independence_day',
    label: 'Independence Day',
    defaultCodePrefix: 'FREEDOM',
    headline: 'Independence Day Pride Offer',
    subtext: 'Special patriotic savings on custom team uniforms & outdoor branding.',
    accentGradient: 'from-[#071B35] via-[#1E293B] to-[#FF7A00]',
  },
  {
    id: 'republic_day',
    label: 'Republic Day',
    defaultCodePrefix: 'REPUBLIC',
    headline: 'Republic Day Business Branding Sale',
    subtext: 'Exclusive savings on Made-in-India corporate printing & promotional merchandise.',
    accentGradient: 'from-[#071B35] via-[#1E3A5F] to-[#FF7A00]',
  },
  {
    id: 'custom',
    label: 'Custom Event / Festival',
    defaultCodePrefix: 'FEST',
    headline: 'Limited-Time TeqqnoWorld Celebration Offer',
    subtext: 'Unlock instant savings across custom printing & corporate merchandise.',
    accentGradient: 'from-[#071B35] via-[#0F294A] to-[#FF7A00]',
  },
];

function toDatetimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatInr(amount: number): string {
  return `₹${Math.round(amount || 0).toLocaleString('en-IN')}`;
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadgeStyle(status: CouponStatus): { label: string; className: string } {
  switch (status) {
    case 'active':
      return { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'scheduled':
      return { label: 'Scheduled', className: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'paused':
      return { label: 'Paused', className: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'draft':
      return { label: 'Draft', className: 'bg-slate-100 text-slate-700 border-slate-200' };
    case 'expired':
      return { label: 'Expired', className: 'bg-rose-50 text-rose-700 border-rose-200' };
    case 'archived':
      return { label: 'Archived', className: 'bg-slate-100 text-slate-500 border-slate-200' };
    default:
      return { label: status, className: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
}

function formatOfferLabel(c: CouponRecord): string {
  if (c.offerType === 'free_shipping') return 'Free Shipping';
  if (c.offerType === 'percentage') {
    return c.maxDiscountCap
      ? `${c.discountValue}% OFF (Cap ${formatInr(c.maxDiscountCap)})`
      : `${c.discountValue}% OFF`;
  }
  return `${formatInr(c.discountValue)} OFF`;
}

function getApplicabilityLabel(app: CouponApplicability): string {
  switch (app) {
    case 'entire_website':
      return 'Entire Website';
    case 'selected_products':
      return 'Selected Products';
    case 'selected_categories':
      return 'Selected Categories';
    case 'selected_customers':
      return 'Private Customer(s)';
    case 'new_customers_only':
      return 'New Customers Only';
    case 'existing_customers_only':
      return 'Existing Customers Only';
    case 'selected_customer_groups':
      return 'Customer Groups';
    default:
      return app;
  }
}

const DEFAULT_FORM_STATE = {
  code: '',
  codePrefix: 'TQ',
  name: '',
  campaignName: '',
  description: '',
  offerType: 'percentage' as CouponOfferType,
  discountValue: '10',
  minOrderAmount: '0',
  maxOrderAmount: '',
  maxDiscountCap: '',
  startAt: '',
  expiresAt: '',
  status: 'active' as CouponStatus,
  applicability: 'entire_website' as CouponApplicability,
  eligibleProductIds: [] as string[],
  eligibleCategories: [] as string[],
  eligibleCustomerGroups: [] as CustomerGroupType[],
  assignedCustomers: [] as AssignedCustomerRef[],
  isPrivate: false,
  isFestival: false,
  festivalPreset: 'diwali' as FestivalPresetId,
  festivalBannerUrl: '',
  festivalBannerHeadline: '',
  festivalBannerSubtext: '',
  showOnStorefront: true,
  totalUsageLimit: '',
  perCustomerLimit: '',
  oneTimePerCustomer: false,
  allowCombineWithCoupons: false,
  allowCombineWithPromotions: true,
  internalNote: '',
};

export const AdminCouponPanel: React.FC<AdminCouponPanelProps> = ({ onShowToast }) => {
  const [activeTab, setActiveTab] = useState<CouponSubSection>('dashboard');
  const [overview, setOverview] = useState<CouponAnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localBanner, setLocalBanner] = useState<{ text: string; tone: 'success' | 'error' | 'info' } | null>(null);

  // Filters for All Coupons & Reports
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<string>('all');

  // Report Filters
  const [reportFilters, setReportFilters] = useState({
    startDate: '',
    endDate: '',
    code: '',
    campaign: '',
    status: 'all',
    customer: '',
  });
  const [reportSubTab, setReportSubTab] = useState<'redemptions' | 'campaigns' | 'audit'>('redemptions');
  const [restoringRedemptionId, setRestoringRedemptionId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);

  // Form state (Create / Edit)
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM_STATE });
  const [submittingForm, setSubmittingForm] = useState(false);

  // Customer search state (used in Create form + Customer-Specific subsection)
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CouponCustomerDirectoryItem[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [manualCustName, setManualCustName] = useState('');
  const [manualCustEmail, setManualCustEmail] = useState('');
  const [manualCustPhone, setManualCustPhone] = useState('');

  // Dedicated Customer-Specific Builder state
  const [privateMode, setPrivateMode] = useState<'single' | 'bulk'>('single');
  const [privateSelectedCustomers, setPrivateSelectedCustomers] = useState<AssignedCustomerRef[]>([]);
  const [privateForm, setPrivateForm] = useState({
    code: '',
    prefix: 'VIP',
    name: 'VIP Exclusive Discount',
    campaignName: 'Customer Retention',
    description: 'Private invitation-only discount crafted exclusively for your account.',
    offerType: 'percentage' as CouponOfferType,
    discountValue: '15',
    minOrderAmount: '999',
    maxDiscountCap: '1000',
    expiresAt: '',
    oneTimePerCustomer: true,
    totalUsageLimit: '1',
    internalNote: '',
    notifyChannel: 'both' as 'none' | 'dashboard' | 'email' | 'both',
  });
  const [savingPrivate, setSavingPrivate] = useState(false);

  // Dedicated Festival Builder state
  const [festivalForm, setFestivalForm] = useState({
    preset: 'diwali' as FestivalPresetId,
    code: '',
    name: 'Diwali Corporate Gifting Sale',
    campaignName: 'Diwali 2026',
    headline: FESTIVAL_PRESETS[0].headline,
    subtext: FESTIVAL_PRESETS[0].subtext,
    bannerUrl: '',
    offerType: 'percentage' as CouponOfferType,
    discountValue: '15',
    minOrderAmount: '1499',
    maxDiscountCap: '1500',
    startAt: '',
    expiresAt: '',
    applicability: 'entire_website' as CouponApplicability,
    eligibleCategories: [] as string[],
    totalUsageLimit: '',
    oneTimePerCustomer: false,
    showOnStorefront: true,
  });
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [savingFestival, setSavingFestival] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // History Drawer & Notify Modal
  const [inspectCoupon, setInspectCoupon] = useState<CouponRecord | null>(null);
  const [notifyModalCoupon, setNotifyModalCoupon] = useState<CouponRecord | null>(null);
  const [notifyChannel, setNotifyChannel] = useState<'dashboard' | 'email' | 'both'>('both');
  const [notifyCustomMsg, setNotifyCustomMsg] = useState('');
  const [sendingNotify, setSendingNotify] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const notify = useCallback(
    (text: string, tone: 'success' | 'error' | 'info' = 'success') => {
      setLocalBanner({ text, tone });
      onShowToast?.(text, tone);
      setTimeout(() => {
        setLocalBanner((prev) => (prev?.text === text ? null : prev));
      }, 4500);
    },
    [onShowToast]
  );

  const loadOverview = useCallback(
    async (overrideFilters?: typeof reportFilters) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetchAdminCouponOverview(overrideFilters || reportFilters);
        if (!res.success || !res.data) {
          setErrorMsg(res.message || 'Unable to fetch coupon overview.');
        } else {
          setOverview(res.data);
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to connect to coupon service.');
      } finally {
        setLoading(false);
      }
    },
    [reportFilters]
  );

  useEffect(() => {
    loadOverview();
  }, []);

  // Load customer directory when searching
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      setSearchingCustomers(true);
      const list = await searchAdminCustomers(customerSearch);
      if (active) {
        setCustomerResults(list);
        setSearchingCustomers(false);
      }
    }, 220);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [customerSearch]);

  const coupons = overview?.coupons || [];
  const redemptions = overview?.redemptions || [];
  const auditLogs = overview?.auditLogs || [];
  const kpis = overview?.kpis;

  const filteredCoupons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return coupons.filter((c) => {
      const eff = c.effectiveStatus || c.status;
      if (statusFilter !== 'all' && eff !== statusFilter) return false;
      if (typeFilter !== 'all' && c.offerType !== typeFilter) return false;
      if (scopeFilter === 'public' && (c.isPrivate || c.applicability === 'selected_customers')) return false;
      if (scopeFilter === 'private' && !c.isPrivate && c.applicability !== 'selected_customers') return false;
      if (scopeFilter === 'festival' && !c.isFestival) return false;
      if (q) {
        const hay = `${c.code} ${c.name} ${c.campaignName || ''} ${c.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [coupons, searchQuery, statusFilter, typeFilter, scopeFilter]);

  const scheduledCoupons = useMemo(
    () => coupons.filter((c) => (c.effectiveStatus || c.status) === 'scheduled'),
    [coupons]
  );

  const privateCoupons = useMemo(
    () => coupons.filter((c) => c.isPrivate || c.applicability === 'selected_customers'),
    [coupons]
  );

  const festivalCoupons = useMemo(() => coupons.filter((c) => c.isFestival), [coupons]);

  const expiredCoupons = useMemo(
    () =>
      coupons.filter((c) => {
        const st = c.effectiveStatus || c.status;
        return st === 'expired' || st === 'archived';
      }),
    [coupons]
  );

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1600);
    } catch {
      notify('Unable to copy coupon code to clipboard.', 'error');
    }
  };

  const handleAutoGenerateFormCode = async () => {
    const code = await generateAdminCouponCode(form.codePrefix || 'TQ');
    if (code) {
      setForm((prev) => ({ ...prev, code }));
    } else {
      notify('Failed to generate unique code.', 'error');
    }
  };

  const handleStartEdit = (c: CouponRecord) => {
    setEditingCouponId(c.id);
    setForm({
      code: c.code,
      codePrefix: 'TQ',
      name: c.name,
      campaignName: c.campaignName || '',
      description: c.description || '',
      offerType: c.offerType,
      discountValue: String(c.discountValue ?? 0),
      minOrderAmount: String(c.minOrderAmount ?? 0),
      maxOrderAmount: c.maxOrderAmount != null ? String(c.maxOrderAmount) : '',
      maxDiscountCap: c.maxDiscountCap != null ? String(c.maxDiscountCap) : '',
      startAt: toDatetimeLocalValue(c.startAt),
      expiresAt: toDatetimeLocalValue(c.expiresAt),
      status: c.status,
      applicability: c.applicability,
      eligibleProductIds: [...(c.eligibleProductIds || [])],
      eligibleCategories: [...(c.eligibleCategories || [])],
      eligibleCustomerGroups: [...(c.eligibleCustomerGroups || [])],
      assignedCustomers: [...(c.assignedCustomers || [])],
      isPrivate: Boolean(c.isPrivate),
      isFestival: Boolean(c.isFestival),
      festivalPreset: (c.festivalPreset as FestivalPresetId) || 'custom',
      festivalBannerUrl: c.festivalBannerUrl || '',
      festivalBannerHeadline: c.festivalBannerHeadline || '',
      festivalBannerSubtext: c.festivalBannerSubtext || '',
      showOnStorefront: Boolean(c.showOnStorefront),
      totalUsageLimit: c.totalUsageLimit != null ? String(c.totalUsageLimit) : '',
      perCustomerLimit: c.perCustomerLimit != null ? String(c.perCustomerLimit) : '',
      oneTimePerCustomer: Boolean(c.oneTimePerCustomer),
      allowCombineWithCoupons: Boolean(c.allowCombineWithCoupons),
      allowCombineWithPromotions: Boolean(c.allowCombineWithPromotions),
      internalNote: c.internalNote || '',
    });
    setActiveTab('create');
  };

  const handleResetForm = () => {
    setEditingCouponId(null);
    setForm({ ...DEFAULT_FORM_STATE });
  };

  const handleSubmitMainForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingForm(true);
    try {
      const payload: CreateCouponPayload = {
        code: form.code.trim() || undefined,
        autoGenerateCode: !form.code.trim(),
        codePrefix: form.codePrefix || 'TQ',
        name: form.name.trim(),
        campaignName: form.campaignName.trim() || undefined,
        description: form.description.trim() || undefined,
        offerType: form.offerType,
        discountValue: form.offerType === 'free_shipping' ? 0 : Number(form.discountValue || 0),
        minOrderAmount: Number(form.minOrderAmount || 0),
        maxOrderAmount: form.maxOrderAmount ? Number(form.maxOrderAmount) : null,
        maxDiscountCap:
          form.offerType === 'percentage' && form.maxDiscountCap
            ? Number(form.maxDiscountCap)
            : null,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        status: form.status,
        applicability: form.applicability,
        eligibleProductIds: form.eligibleProductIds,
        eligibleCategories: form.eligibleCategories,
        eligibleCustomerGroups: form.eligibleCustomerGroups,
        assignedCustomers: form.assignedCustomers,
        isPrivate: form.isPrivate || form.applicability === 'selected_customers',
        isFestival: form.isFestival,
        festivalPreset: form.isFestival ? form.festivalPreset : null,
        festivalBannerUrl: form.isFestival ? form.festivalBannerUrl.trim() || null : null,
        festivalBannerHeadline: form.isFestival ? form.festivalBannerHeadline.trim() || null : null,
        festivalBannerSubtext: form.isFestival ? form.festivalBannerSubtext.trim() || null : null,
        showOnStorefront:
          form.isPrivate || form.applicability === 'selected_customers'
            ? false
            : form.showOnStorefront,
        totalUsageLimit: form.totalUsageLimit ? Number(form.totalUsageLimit) : null,
        perCustomerLimit: form.perCustomerLimit ? Number(form.perCustomerLimit) : null,
        oneTimePerCustomer: form.oneTimePerCustomer,
        allowCombineWithCoupons: form.allowCombineWithCoupons,
        allowCombineWithPromotions: form.allowCombineWithPromotions,
        internalNote: form.internalNote.trim() || undefined,
      };

      const res = editingCouponId
        ? await updateAdminCoupon(editingCouponId, payload)
        : await createAdminCoupon(payload);

      if (!res.success) {
        notify(res.message || 'Unable to save coupon.', 'error');
        return;
      }

      notify(
        editingCouponId
          ? `Coupon ${res.coupon?.code} updated successfully.`
          : `Coupon ${res.coupon?.code} created successfully.`,
        'success'
      );
      handleResetForm();
      await loadOverview();
      setActiveTab('all');
    } finally {
      setSubmittingForm(false);
    }
  };

  const handleStatusChange = async (c: CouponRecord, status: CouponStatus) => {
    const res = await changeAdminCouponStatus(c.id, status);
    if (!res.success) {
      notify(res.message || 'Failed to update coupon status.', 'error');
      return;
    }
    notify(`Coupon ${c.code} marked as ${status}.`, 'success');
    await loadOverview();
  };

  const handleDuplicate = async (c: CouponRecord) => {
    const res = await duplicateAdminCoupon(c.id);
    if (!res.success) {
      notify(res.message || 'Failed to duplicate coupon.', 'error');
      return;
    }
    notify(`Duplicated as draft coupon ${res.coupon?.code}.`, 'success');
    await loadOverview();
  };

  const handleDeleteDraft = async (c: CouponRecord) => {
    const res = await deleteAdminDraftCoupon(c.id);
    if (!res.success) {
      notify(res.message || 'Unable to delete coupon.', 'error');
      return;
    }
    notify(`Deleted unused draft coupon ${c.code}.`, 'info');
    await loadOverview();
  };

  const handleSubmitPrivateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (privateSelectedCustomers.length === 0) {
      notify('Select or add at least one customer first.', 'error');
      return;
    }
    setSavingPrivate(true);
    try {
      if (privateMode === 'bulk') {
        const res = await bulkGenerateAdminCoupons({
          prefix: privateForm.prefix || 'VIP',
          campaignName: privateForm.campaignName || 'Private VIP Campaign',
          nameTemplate: `${privateForm.name} — {name}`,
          description: privateForm.description,
          offerType: privateForm.offerType,
          discountValue:
            privateForm.offerType === 'free_shipping' ? 0 : Number(privateForm.discountValue || 0),
          minOrderAmount: Number(privateForm.minOrderAmount || 0),
          maxDiscountCap:
            privateForm.offerType === 'percentage' && privateForm.maxDiscountCap
              ? Number(privateForm.maxDiscountCap)
              : null,
          expiresAt: privateForm.expiresAt ? new Date(privateForm.expiresAt).toISOString() : null,
          oneTimePerCustomer: privateForm.oneTimePerCustomer,
          perCustomerLimit: privateForm.oneTimePerCustomer ? 1 : null,
          totalUsageLimit: privateForm.totalUsageLimit ? Number(privateForm.totalUsageLimit) : 1,
          customers: privateSelectedCustomers,
          internalNote: privateForm.internalNote,
          notifyChannel: privateForm.notifyChannel,
        });
        if (!res.success) {
          notify(res.message || 'Bulk private coupon generation failed.', 'error');
          return;
        }
        const emailSuffix =
          privateForm.notifyChannel === 'email' || privateForm.notifyChannel === 'both'
            ? ` (Emails sent: ${res.emailsSent || 0}/${res.emailsAttempted || 0})`
            : '';
        notify(`Generated ${res.count} unique private coupons${emailSuffix}.`, 'success');
      } else {
        const createRes = await createAdminCoupon({
          code: privateForm.code.trim() || undefined,
          autoGenerateCode: !privateForm.code.trim(),
          codePrefix: privateForm.prefix || 'VIP',
          name: privateForm.name.trim(),
          campaignName: privateForm.campaignName.trim() || 'Private Customer Offer',
          description: privateForm.description.trim() || undefined,
          offerType: privateForm.offerType,
          discountValue:
            privateForm.offerType === 'free_shipping' ? 0 : Number(privateForm.discountValue || 0),
          minOrderAmount: Number(privateForm.minOrderAmount || 0),
          maxDiscountCap:
            privateForm.offerType === 'percentage' && privateForm.maxDiscountCap
              ? Number(privateForm.maxDiscountCap)
              : null,
          expiresAt: privateForm.expiresAt ? new Date(privateForm.expiresAt).toISOString() : null,
          applicability: 'selected_customers',
          assignedCustomers: privateSelectedCustomers,
          isPrivate: true,
          showOnStorefront: false,
          oneTimePerCustomer: privateForm.oneTimePerCustomer,
          totalUsageLimit: privateForm.totalUsageLimit ? Number(privateForm.totalUsageLimit) : null,
          internalNote: privateForm.internalNote.trim() || undefined,
        });
        if (!createRes.success || !createRes.coupon) {
          notify(createRes.message || 'Failed to create private coupon.', 'error');
          return;
        }
        let noticeText = `Private coupon ${createRes.coupon.code} assigned to ${privateSelectedCustomers.length} customer(s).`;
        if (privateForm.notifyChannel !== 'none') {
          const nRes = await notifyAdminCouponCustomers(
            createRes.coupon.id,
            privateForm.notifyChannel
          );
          if (nRes.emailNotice) noticeText += ` ${nRes.emailNotice}`;
        }
        notify(noticeText, 'success');
      }
      setPrivateSelectedCustomers([]);
      setPrivateForm((prev) => ({ ...prev, code: '' }));
      await loadOverview();
    } finally {
      setSavingPrivate(false);
    }
  };

  const handleFestivalPresetSelect = (presetId: FestivalPresetId) => {
    const preset = FESTIVAL_PRESETS.find((p) => p.id === presetId) || FESTIVAL_PRESETS[0];
    setFestivalForm((prev) => ({
      ...prev,
      preset: presetId,
      name: `${preset.label} Celebration Offer`,
      campaignName: `${preset.label} ${new Date().getFullYear()}`,
      headline: preset.headline,
      subtext: preset.subtext,
      code: `${preset.defaultCodePrefix}${prev.discountValue || '15'}`,
    }));
  };

  const handleBannerFileUpload = async (file: File) => {
    setUploadingBanner(true);
    try {
      const res = await uploadBrandLogoToStorage(file, `festival-banner-${Date.now()}-${file.name}`);
      setFestivalForm((prev) => ({ ...prev, bannerUrl: res.publicUrl }));
      notify('Festival banner uploaded to cloud storage.', 'success');
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        setFestivalForm((prev) => ({ ...prev, bannerUrl: String(reader.result || '') }));
        notify('Cloud upload unavailable — using local preview URL.', 'info');
      };
      reader.readAsDataURL(file);
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSubmitFestivalOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFestival(true);
    try {
      const presetObj = FESTIVAL_PRESETS.find((p) => p.id === festivalForm.preset);
      const res = await createAdminCoupon({
        code: festivalForm.code.trim() || undefined,
        autoGenerateCode: !festivalForm.code.trim(),
        codePrefix: presetObj?.defaultCodePrefix || 'FEST',
        name: festivalForm.name.trim(),
        campaignName: festivalForm.campaignName.trim() || `${presetObj?.label || 'Festival'} Sale`,
        description: festivalForm.subtext.trim(),
        offerType: festivalForm.offerType,
        discountValue:
          festivalForm.offerType === 'free_shipping' ? 0 : Number(festivalForm.discountValue || 0),
        minOrderAmount: Number(festivalForm.minOrderAmount || 0),
        maxDiscountCap:
          festivalForm.offerType === 'percentage' && festivalForm.maxDiscountCap
            ? Number(festivalForm.maxDiscountCap)
            : null,
        startAt: festivalForm.startAt ? new Date(festivalForm.startAt).toISOString() : null,
        expiresAt: festivalForm.expiresAt ? new Date(festivalForm.expiresAt).toISOString() : null,
        status:
          festivalForm.startAt && Date.parse(festivalForm.startAt) > Date.now()
            ? 'scheduled'
            : 'active',
        applicability: festivalForm.applicability,
        eligibleCategories: festivalForm.eligibleCategories,
        isPrivate: false,
        isFestival: true,
        festivalPreset: festivalForm.preset,
        festivalBannerUrl: festivalForm.bannerUrl.trim() || null,
        festivalBannerHeadline: festivalForm.headline.trim() || null,
        festivalBannerSubtext: festivalForm.subtext.trim() || null,
        showOnStorefront: festivalForm.showOnStorefront,
        totalUsageLimit: festivalForm.totalUsageLimit ? Number(festivalForm.totalUsageLimit) : null,
        oneTimePerCustomer: festivalForm.oneTimePerCustomer,
      });
      if (!res.success || !res.coupon) {
        notify(res.message || 'Failed to launch festival offer.', 'error');
        return;
      }
      notify(`Festival campaign "${res.coupon.name}" (${res.coupon.code}) saved.`, 'success');
      setFestivalForm((prev) => ({ ...prev, code: '' }));
      await loadOverview();
    } finally {
      setSavingFestival(false);
    }
  };

  const handleSendCustomerNotification = async () => {
    if (!notifyModalCoupon) return;
    setSendingNotify(true);
    try {
      const res = await notifyAdminCouponCustomers(
        notifyModalCoupon.id,
        notifyChannel,
        notifyCustomMsg.trim() || undefined
      );
      if (!res.success) {
        notify(res.message || 'Failed to notify customer.', 'error');
        return;
      }
      notify(res.emailNotice || 'Notification processed.', res.emailsAttempted && !res.emailsSent ? 'info' : 'success');
      setNotifyModalCoupon(null);
      setNotifyCustomMsg('');
      await loadOverview();
    } finally {
      setSendingNotify(false);
    }
  };

  const handleToggleRestorePolicy = async () => {
    if (!overview) return;
    const next = !overview.settings.restoreOnCancel;
    const res = await updateAdminCouponSettings(next);
    if (!res.success) {
      notify(res.message || 'Unable to update policy setting.', 'error');
      return;
    }
    notify(
      next
        ? 'Cancellation restoration policy ENABLED (manual/auto restore allowed).'
        : 'Cancellation restoration policy DISABLED (used coupons stay consumed on cancel).',
      'info'
    );
    await loadOverview();
  };

  const handleExportPdf = () => {
    if (!overview) return;
    const ok = generateCouponAnalyticsReportPdf({
      generatedAt: overview.serverTime || new Date().toISOString(),
      filterSummary: [
        reportFilters.startDate ? `From ${reportFilters.startDate}` : '',
        reportFilters.endDate ? `To ${reportFilters.endDate}` : '',
        reportFilters.code ? `Code: ${reportFilters.code}` : '',
        reportFilters.campaign ? `Campaign: ${reportFilters.campaign}` : '',
        reportFilters.status !== 'all' ? `Status: ${reportFilters.status}` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      kpis: overview.kpis,
      coupons: overview.coupons,
      redemptions: overview.redemptions,
    });
    notify(ok ? 'PDF analytics report downloaded.' : 'Failed to generate PDF report.', ok ? 'success' : 'error');
  };

  const addCustomerToList = (
    customer: AssignedCustomerRef,
    list: AssignedCustomerRef[],
    setter: (next: AssignedCustomerRef[]) => void
  ) => {
    const email = customer.email.trim().toLowerCase();
    if (!email) return;
    if (list.some((x) => x.email.toLowerCase() === email)) return;
    setter([...list, { ...customer, email }]);
  };

  // Reusable Coupon Table Renderer
  const renderCouponTable = (rows: CouponRecord[], emptyMessage: string) => {
    if (rows.length === 0) {
      return (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Ticket className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-[#071B35]">{emptyMessage}</p>
          <p className="text-xs text-slate-500 mt-1">
            Create a new coupon or adjust your search filters to view records.
          </p>
        </div>
      );
    }

    return (
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Coupon Code & Name</th>
                <th className="py-3.5 px-4">Offer Value</th>
                <th className="py-3.5 px-4">Applicability</th>
                <th className="py-3.5 px-4">Schedule</th>
                <th className="py-3.5 px-4 text-right">Usage</th>
                <th className="py-3.5 px-4 text-right">Discount Given</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {rows.map((c) => {
                const effStatus = c.effectiveStatus || c.status;
                const badge = getStatusBadgeStyle(effStatus);
                const canDelete = !c.isLegacy && c.status === 'draft' && c.usageCount === 0;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#071B35] text-xs tracking-wider bg-slate-100 border border-slate-200 px-2 py-1 rounded-md">
                          {c.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(c.code)}
                          className="text-slate-400 hover:text-[#FF7A00] transition-colors"
                          title="Copy coupon code"
                        >
                          {copiedCode === c.code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {c.isPrivate && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Private
                          </span>
                        )}
                        {c.isFestival && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Sparkles className="w-2.5 h-2.5" /> Festival
                          </span>
                        )}
                        {c.isLegacy && (
                          <span className="text-[10px] font-semibold text-slate-500">Built-in</span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-800 mt-1">{c.name}</div>
                      {c.campaignName && (
                        <div className="text-[11px] text-slate-500">Campaign: {c.campaignName}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[#071B35] tabular-nums text-xs">
                        {formatOfferLabel(c)}
                      </div>
                      {c.minOrderAmount > 0 && (
                        <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                          Min order: {formatInr(c.minOrderAmount)}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="text-xs font-medium text-slate-700">
                        {getApplicabilityLabel(c.applicability)}
                      </div>
                      {c.assignedCustomers?.length > 0 && (
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                          {c.assignedCustomers.map((x) => x.email).join(', ')}
                        </div>
                      )}
                      {c.eligibleCategories?.length > 0 && (
                        <div className="text-[11px] text-slate-500">
                          {c.eligibleCategories.join(', ')}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-600 tabular-nums">
                      <div>Start: {c.startAt ? formatDateShort(c.startAt) : 'Immediate'}</div>
                      <div className="text-slate-500">
                        End: {c.expiresAt ? formatDateShort(c.expiresAt) : 'No expiry'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right tabular-nums">
                      <div className="font-bold text-[#071B35] text-xs">
                        {c.usageCount}
                        {c.totalUsageLimit ? ` / ${c.totalUsageLimit}` : ''}
                      </div>
                      {c.oneTimePerCustomer && (
                        <div className="text-[10px] text-slate-500">1× / customer</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right tabular-nums">
                      <div className="font-semibold text-slate-800 text-xs">
                        {formatInr(c.totalDiscountGiven || 0)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Rev: {formatInr(c.totalRevenueGenerated || 0)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setInspectCoupon(c)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#071B35] hover:bg-slate-100 transition-colors"
                          title="View usage history & details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEdit(c)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#FF7A00] hover:bg-orange-50 transition-colors"
                          title="Edit coupon"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(c)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#071B35] hover:bg-slate-100 transition-colors"
                          title="Duplicate coupon"
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                        {effStatus === 'active' || effStatus === 'scheduled' ? (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(c, 'paused')}
                            className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                            title="Pause coupon"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        ) : effStatus === 'paused' || effStatus === 'draft' ? (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(c, 'active')}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Activate / Resume coupon"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        ) : null}
                        {c.isPrivate && c.assignedCustomers.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setNotifyModalCoupon(c);
                              setNotifyChannel('both');
                              setNotifyCustomMsg('');
                            }}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Notify assigned customer(s)"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {effStatus !== 'archived' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(c, 'archived')}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                            title="Archive / Deactivate"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(c)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                            title="Delete unused draft coupon"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const maxDailyCount = useMemo(() => {
    const arr = overview?.dailySeries || [];
    return Math.max(1, ...arr.map((d) => d.redemptions));
  }, [overview]);

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#071B35] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Ticket className="w-5 h-5 text-[#FF7A00]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#071B35] tracking-tight">
              Coupon & Offer Management
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Server-validated discounts, private VIP customer vouchers, scheduled festival offers & audit ledger.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => loadOverview()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={async () => {
              const res = await downloadAdminCouponCsv('redemptions', reportFilters);
              if (!res.success) notify(res.message || 'CSV export failed.', 'error');
              else notify('Redemptions CSV exported.', 'success');
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              handleResetForm();
              setActiveTab('create');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#e86d00] text-white text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Coupon
          </button>
        </div>
      </div>

      {/* Inline Status / Feedback Banner */}
      {localBanner && (
        <div
          className={`rounded-xl px-4 py-3 text-xs font-medium flex items-center justify-between border ${
            localBanner.tone === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : localBanner.tone === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-sky-50 border-sky-200 text-sky-800'
          }`}
        >
          <span>{localBanner.text}</span>
          <button type="button" onClick={() => setLocalBanner(null)} className="ml-3 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl px-4 py-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => loadOverview()}
            className="font-bold underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* 8 Subsection Navigation Strip */}
      <div className="bg-white border border-slate-200 rounded-2xl p-1.5 flex items-center gap-1 overflow-x-auto">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          let count: number | null = null;
          if (tab.id === 'all') count = coupons.length;
          else if (tab.id === 'scheduled') count = scheduledCoupons.length;
          else if (tab.id === 'customer_specific') count = privateCoupons.length;
          else if (tab.id === 'festival') count = festivalCoupons.length;
          else if (tab.id === 'expired') count = expiredCoupons.length;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-[#071B35] text-white shadow-xs'
                  : 'text-slate-600 hover:text-[#071B35] hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FF7A00]' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {count !== null && (
                <span
                  className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${
                    isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* 1. COUPON DASHBOARD SUBSECTION                                       */}
      {/* ==================================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI Summary Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Coupons
                </span>
                <Ticket className="w-4 h-4 text-[#FF7A00]" />
              </div>
              <div className="text-2xl font-bold text-[#071B35] tabular-nums mt-2">
                {kpis?.totalCoupons ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                {kpis?.activeCoupons ?? 0} active · {kpis?.scheduledCoupons ?? 0} scheduled · {kpis?.expiredCoupons ?? 0} expired
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total Redemptions
                </span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-[#071B35] tabular-nums mt-2">
                {kpis?.totalRedemptions ?? 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                {kpis?.ordersGeneratedCount ?? 0} unique orders converted
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Discount Given
                </span>
                <Percent className="w-4 h-4 text-[#FF7A00]" />
              </div>
              <div className="text-2xl font-bold text-[#071B35] tabular-nums mt-2">
                {formatInr((kpis?.totalDiscountGivenInr ?? 0) + (kpis?.totalShippingSavedInr ?? 0))}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                Includes {formatInr(kpis?.totalShippingSavedInr ?? 0)} shipping waived
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Revenue Generated
                </span>
                <ShieldCheck className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl font-bold text-[#071B35] tabular-nums mt-2">
                {formatInr(kpis?.totalRevenueGeneratedInr ?? 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                {kpis?.privateCoupons ?? 0} private · {kpis?.festivalCoupons ?? 0} festival offers
              </div>
            </div>
          </div>

          {/* 14-Day Activity + Campaign Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[#071B35]">14-Day Redemption Velocity</h3>
                  <p className="text-xs text-slate-500">Server-verified coupon orders by day</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className="text-xs font-semibold text-[#FF7A00] hover:underline"
                >
                  Full Reports →
                </button>
              </div>
              <div className="grid grid-cols-7 sm:grid-cols-14 gap-2 items-end h-40 pt-4">
                {(overview?.dailySeries || []).map((day) => {
                  const pct = Math.max(8, Math.round((day.redemptions / maxDailyCount) * 100));
                  return (
                    <div key={day.date} className="flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
                        {day.redemptions}
                      </span>
                      <div className="w-full max-w-[22px] bg-slate-100 rounded-md h-24 flex items-end overflow-hidden">
                        <div
                          className={`w-full rounded-md transition-all ${
                            day.redemptions > 0 ? 'bg-[#FF7A00]' : 'bg-slate-200'
                          }`}
                          style={{ height: `${day.redemptions > 0 ? pct : 10}%` }}
                          title={`${day.label}: ${day.redemptions} redemptions, ${formatInr(day.discountInr)} saved`}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 truncate max-w-full">
                        {day.label.split(' ')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#071B35]">Campaign Performance</h3>
                <p className="text-xs text-slate-500 mb-4">Top campaigns by redemptions & revenue</p>
                <div className="space-y-3">
                  {(overview?.campaignPerformance || []).slice(0, 5).map((camp) => (
                    <div
                      key={camp.campaignName}
                      className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="text-xs font-bold text-[#071B35] truncate">
                          {camp.campaignName}
                        </div>
                        <div className="text-[11px] text-slate-500 tabular-nums">
                          {camp.couponsCount} code(s) · {camp.redemptionsCount} uses
                        </div>
                      </div>
                      <div className="text-right tabular-nums shrink-0">
                        <div className="text-xs font-bold text-[#071B35]">
                          {formatInr(camp.revenueGeneratedInr)}
                        </div>
                        <div className="text-[11px] text-[#FF7A00]">
                          -{formatInr(camp.discountGivenInr)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!overview || overview.campaignPerformance.length === 0) && (
                    <p className="text-xs text-slate-400 py-6 text-center">No campaign activity yet.</p>
                  )}
                </div>
              </div>

              {/* Cancellation Policy Card */}
              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[#071B35]">
                    Order Cancellation Restoration Policy
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Default: OFF (used coupons are NOT automatically restored on order cancel/refund).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleToggleRestorePolicy}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                    overview?.settings.restoreOnCancel
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {overview?.settings.restoreOnCancel ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => {
                handleResetForm();
                setActiveTab('create');
              }}
              className="text-left bg-white border border-slate-200 hover:border-[#FF7A00] rounded-2xl p-4 transition-all group"
            >
              <div className="flex items-center gap-2.5 text-sm font-bold text-[#071B35] group-hover:text-[#FF7A00]">
                <Plus className="w-4 h-4 text-[#FF7A00]" />
                Create Storewide / Category Coupon
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Configure %, Fixed ₹, or Free Shipping with min/max cart value and max discount cap.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('customer_specific')}
              className="text-left bg-white border border-slate-200 hover:border-[#FF7A00] rounded-2xl p-4 transition-all group"
            >
              <div className="flex items-center gap-2.5 text-sm font-bold text-[#071B35] group-hover:text-[#FF7A00]">
                <UserCheck className="w-4 h-4 text-[#FF7A00]" />
                Assign Private VIP Customer Voucher
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Bind single or bulk unique codes to specific customer accounts with optional email notice.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('festival')}
              className="text-left bg-white border border-slate-200 hover:border-[#FF7A00] rounded-2xl p-4 transition-all group"
            >
              <div className="flex items-center gap-2.5 text-sm font-bold text-[#071B35] group-hover:text-[#FF7A00]">
                <Sparkles className="w-4 h-4 text-[#FF7A00]" />
                Launch Scheduled Festival Offer
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Diwali, Holi, Eid, Christmas, New Year & custom storefront banners with auto-expiry.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. CREATE / EDIT COUPON SUBSECTION                                   */}
      {/* ==================================================================== */}
      {activeTab === 'create' && (
        <form onSubmit={handleSubmitMainForm} className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-bold text-[#071B35]">
                  {editingCouponId ? `Edit Coupon (${form.code})` : 'Create New Coupon'}
                </h3>
                <p className="text-xs text-slate-500">
                  All discounts, dates, eligibility rules, and usage caps are strictly validated server-side.
                </p>
              </div>
              {editingCouponId && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            {/* Section A: Basic Information */}
            <div className="space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[#FF7A00]">
                A. Basic Information & Discount Configuration
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coupon Code (Case-Insensitive Unique)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. TEQQNO20 (leave blank to auto)"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:outline-none focus:border-[#FF7A00]"
                    />
                    <button
                      type="button"
                      onClick={handleAutoGenerateFormCode}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#071B35] inline-flex items-center gap-1 shrink-0"
                      title="Generate random unique code"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-[#FF7A00]" />
                      Auto
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Coupon Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Corporate Polo 15% Off"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Internal Campaign Name
                  </label>
                  <input
                    type="text"
                    value={form.campaignName}
                    onChange={(e) => setForm({ ...form, campaignName: e.target.value })}
                    placeholder="e.g. Q4 B2B Acquisition"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description (Customer-Facing Offer Details)
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Short description shown to eligible customers in cart & checkout"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#FF7A00]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Offer Type *
                  </label>
                  <select
                    value={form.offerType}
                    onChange={(e) =>
                      setForm({ ...form, offerType: e.target.value as CouponOfferType })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-[#FF7A00]"
                  >
                    <option value="percentage">Percentage Discount (%)</option>
                    <option value="fixed">Fixed Amount Discount (₹)</option>
                    <option value="free_shipping">Free Express Shipping</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {form.offerType === 'percentage'
                      ? 'Discount % (1–100) *'
                      : form.offerType === 'fixed'
                      ? 'Discount Amount (₹) *'
                      : 'Shipping Waiver'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={form.offerType === 'percentage' ? 100 : undefined}
                    disabled={form.offerType === 'free_shipping'}
                    value={form.offerType === 'free_shipping' ? '0' : form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums disabled:bg-slate-100 focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Discount Cap (₹, optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={form.offerType !== 'percentage'}
                    value={form.offerType === 'percentage' ? form.maxDiscountCap : ''}
                    onChange={(e) => setForm({ ...form, maxDiscountCap: e.target.value })}
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums disabled:bg-slate-100 focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as CouponStatus })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-[#FF7A00]"
                  >
                    <option value="active">Active</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="draft">Draft</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Min Order Value (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.minOrderAmount}
                    onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Order Value (₹, optional)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.maxOrderAmount}
                    onChange={(e) => setForm({ ...form, maxOrderAmount: e.target.value })}
                    placeholder="No upper limit"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date & Time (Server Clock)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiry Date & Time (Server Clock)
                  </label>
                  <input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#FF7A00]"
                  />
                </div>
              </div>
            </div>

            {/* Section B: Applicability */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="text-xs font-bold uppercase tracking-wider text-[#FF7A00]">
                B. Applicability & Targeting
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Applies To
                  </label>
                  <select
                    value={form.applicability}
                    onChange={(e) => {
                      const next = e.target.value as CouponApplicability;
                      setForm({
                        ...form,
                        applicability: next,
                        isPrivate: next === 'selected_customers' ? true : form.isPrivate,
                        showOnStorefront:
                          next === 'selected_customers' ? false : form.showOnStorefront,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-none focus:border-[#FF7A00]"
                  >
                    <option value="entire_website">Entire Website</option>
                    <option value="selected_products">Selected Products</option>
                    <option value="selected_categories">Selected Categories</option>
                    <option value="selected_customers">Selected Customer(s) — Private</option>
                    <option value="new_customers_only">New Customers Only (First Order)</option>
                    <option value="existing_customers_only">Existing / Returning Customers Only</option>
                    <option value="selected_customer_groups">Customer Groups (Individual / Business)</option>
                  </select>
                </div>

                <div className="flex items-end gap-4 pb-1">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isPrivate || form.applicability === 'selected_customers'}
                      disabled={form.applicability === 'selected_customers'}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          isPrivate: e.target.checked,
                          showOnStorefront: e.target.checked ? false : form.showOnStorefront,
                        })
                      }
                      className="rounded border-slate-300 text-[#FF7A00]"
                    />
                    Private Coupon (Hidden from Public List)
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.showOnStorefront && !form.isPrivate}
                      disabled={form.isPrivate || form.applicability === 'selected_customers'}
                      onChange={(e) => setForm({ ...form, showOnStorefront: e.target.checked })}
                      className="rounded border-slate-300 text-[#FF7A00]"
                    />
                    Feature on Storefront & Cart
                  </label>
                </div>
              </div>

              {/* Selected Products Picker */}
              {form.applicability === 'selected_products' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-bold text-[#071B35] mb-2">
                    Select Eligible Products ({form.eligibleProductIds.length} selected)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {PRODUCTS.map((p) => {
                      const checked = form.eligibleProductIds.includes(p.id);
                      return (
                        <label
                          key={p.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                            checked
                              ? 'bg-orange-50 border-[#FF7A00] text-[#071B35] font-semibold'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? form.eligibleProductIds.filter((x) => x !== p.id)
                                : [...form.eligibleProductIds, p.id];
                              setForm({ ...form, eligibleProductIds: next });
                            }}
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected Categories Picker */}
              {form.applicability === 'selected_categories' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-bold text-[#071B35] mb-2">
                    Select Eligible Categories ({form.eligibleCategories.length} selected)
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {PRODUCT_CATEGORIES.map((cat) => {
                      const checked = form.eligibleCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            const next = checked
                              ? form.eligibleCategories.filter((x) => x !== cat.id)
                              : [...form.eligibleCategories, cat.id];
                            setForm({ ...form, eligibleCategories: next });
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                            checked
                              ? 'bg-[#071B35] text-white border-[#071B35]'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-[#FF7A00]'
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected Customer Groups Picker */}
              {form.applicability === 'selected_customer_groups' && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-bold text-[#071B35] mb-2">
                    Select Customer Account Groups
                  </div>
                  <div className="flex gap-3">
                    {(['individual', 'business'] as CustomerGroupType[]).map((grp) => {
                      const checked = form.eligibleCustomerGroups.includes(grp);
                      return (
                        <label
                          key={grp}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? form.eligibleCustomerGroups.filter((x) => x !== grp)
                                : [...form.eligibleCustomerGroups, grp];
                              setForm({ ...form, eligibleCustomerGroups: next });
                            }}
                          />
                          {grp === 'business' ? 'Business / Corporate Accounts' : 'Individual Accounts'}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Selected Customers Picker */}
              {(form.applicability === 'selected_customers' || form.isPrivate) && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold text-[#071B35]">
                    Assigned Eligible Customers ({form.assignedCustomers.length})
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={manualCustName}
                      onChange={(e) => setManualCustName(e.target.value)}
                      placeholder="Customer Name"
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                    />
                    <input
                      type="email"
                      value={manualCustEmail}
                      onChange={(e) => setManualCustEmail(e.target.value)}
                      placeholder="Customer Email *"
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualCustPhone}
                        onChange={(e) => setManualCustPhone(e.target.value)}
                        placeholder="Mobile (optional)"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!manualCustEmail.trim()) return;
                          addCustomerToList(
                            {
                              name: manualCustName.trim() || manualCustEmail.split('@')[0],
                              email: manualCustEmail.trim(),
                              phone: manualCustPhone.trim() || undefined,
                            },
                            form.assignedCustomers,
                            (next) => setForm({ ...form, assignedCustomers: next })
                          );
                          setManualCustName('');
                          setManualCustEmail('');
                          setManualCustPhone('');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#071B35] text-white text-xs font-semibold shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                  {form.assignedCustomers.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.assignedCustomers.map((c) => (
                        <span
                          key={c.email}
                          className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs"
                        >
                          <span className="font-semibold text-[#071B35]">{c.name}</span>
                          <span className="text-slate-500">({c.email})</span>
                          <button
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                assignedCustomers: form.assignedCustomers.filter(
                                  (x) => x.email !== c.email
                                ),
                              })
                            }
                            className="text-slate-400 hover:text-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section C: Usage Restrictions */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="text-xs font-bold uppercase tracking-wider text-[#FF7A00]">
                C. Usage Limits & Stacking Rules
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Total Global Usage Limit (optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.totalUsageLimit}
                    onChange={(e) => setForm({ ...form, totalUsageLimit: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Uses Per Customer (optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    disabled={form.oneTimePerCustomer}
                    value={form.oneTimePerCustomer ? '1' : form.perCustomerLimit}
                    onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })}
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Internal Admin Note
                  </label>
                  <input
                    type="text"
                    value={form.internalNote}
                    onChange={(e) => setForm({ ...form, internalNote: e.target.value })}
                    placeholder="Private audit note (never shown to customers)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-5 pt-1">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.oneTimePerCustomer}
                    onChange={(e) => setForm({ ...form, oneTimePerCustomer: e.target.checked })}
                  />
                  One-Time Use Per Customer
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowCombineWithCoupons}
                    onChange={(e) =>
                      setForm({ ...form, allowCombineWithCoupons: e.target.checked })
                    }
                  />
                  Allow Combining with Other Coupons
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.allowCombineWithPromotions}
                    onChange={(e) =>
                      setForm({ ...form, allowCombineWithPromotions: e.target.checked })
                    }
                  />
                  Allow Combining with Bulk Tier Pricing
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Reset Form
              </button>
              <button
                type="submit"
                disabled={submittingForm}
                className="px-6 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] disabled:opacity-60 text-white text-xs font-bold shadow-sm transition-colors"
              >
                {submittingForm
                  ? 'Saving...'
                  : editingCouponId
                  ? 'Update Coupon'
                  : 'Create Coupon'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ==================================================================== */}
      {/* 3. ALL COUPONS SUBSECTION                                            */}
      {/* ==================================================================== */}
      {activeTab === 'all' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by code, name, or campaign..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#FF7A00]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="scheduled">Scheduled</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="expired">Expired</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
            >
              <option value="all">All Offer Types</option>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₹)</option>
              <option value="free_shipping">Free Shipping</option>
            </select>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
            >
              <option value="all">All Visibility</option>
              <option value="public">Public Storefront</option>
              <option value="private">Private Customer-Specific</option>
              <option value="festival">Festival Campaigns</option>
            </select>
          </div>
          {renderCouponTable(filteredCoupons, 'No coupons match your current filters.')}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 4. SCHEDULED OFFERS SUBSECTION                                       */}
      {/* ==================================================================== */}
      {activeTab === 'scheduled' && (
        <div className="space-y-4">
          <div className="bg-[#071B35] text-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#FF7A00]" />
                Server-Clock Automated Offer Scheduler
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Scheduled coupons automatically activate at their exact UTC start timestamp and automatically expire at their end timestamp.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                handleResetForm();
                setForm((prev) => ({ ...prev, status: 'scheduled' }));
                setActiveTab('create');
              }}
              className="px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#e86d00] text-white text-xs font-bold shrink-0"
            >
              + Schedule New Offer
            </button>
          </div>
          {renderCouponTable(scheduledCoupons, 'No scheduled upcoming offers right now.')}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. CUSTOMER-SPECIFIC PRIVATE COUPONS SUBSECTION                      */}
      {/* ==================================================================== */}
      {activeTab === 'customer_specific' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Customer Search & Selection Panel */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#071B35] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#FF7A00]" />
                  1. Find & Select Eligible Customer(s)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search existing TeqqnoWorld customers by name, email, mobile, or ID, or add an email manually.
                </p>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  placeholder="Search customer name, email, mobile, or ID..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#FF7A00]"
                />
              </div>

              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                {searchingCustomers && (
                  <div className="p-4 text-center text-xs text-slate-400">Searching directory...</div>
                )}
                {!searchingCustomers && customerResults.length === 0 && (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No matching orders/customers yet. Add a customer email below.
                  </div>
                )}
                {!searchingCustomers &&
                  customerResults.map((cust) => {
                    const selected = privateSelectedCustomers.some(
                      (x) => x.email.toLowerCase() === cust.email.toLowerCase()
                    );
                    return (
                      <button
                        key={cust.customerId + cust.email}
                        type="button"
                        onClick={() => {
                          if (selected) {
                            setPrivateSelectedCustomers((prev) =>
                              prev.filter((x) => x.email.toLowerCase() !== cust.email.toLowerCase())
                            );
                          } else {
                            addCustomerToList(
                              {
                                customerId: cust.customerId,
                                name: cust.name,
                                email: cust.email,
                                phone: cust.phone,
                                company: cust.company,
                              },
                              privateSelectedCustomers,
                              setPrivateSelectedCustomers
                            );
                          }
                        }}
                        className={`w-full text-left px-3 py-2.5 flex items-center justify-between transition-colors ${
                          selected ? 'bg-orange-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-[#071B35] truncate">
                            {cust.name}{' '}
                            {cust.company && (
                              <span className="font-normal text-slate-500">· {cust.company}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {cust.email} {cust.phone ? `· ${cust.phone}` : ''}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                            selected
                              ? 'bg-[#FF7A00] text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {selected ? 'Selected' : 'Select'}
                        </span>
                      </button>
                    );
                  })}
              </div>

              {/* Manual Add Customer */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Or Add Customer Manually
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={manualCustName}
                    onChange={(e) => setManualCustName(e.target.value)}
                    placeholder="Full Name"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                  <input
                    type="text"
                    value={manualCustPhone}
                    onChange={(e) => setManualCustPhone(e.target.value)}
                    placeholder="Mobile (optional)"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={manualCustEmail}
                    onChange={(e) => setManualCustEmail(e.target.value)}
                    placeholder="customer@company.com"
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!manualCustEmail.trim()) return;
                      addCustomerToList(
                        {
                          name: manualCustName.trim() || manualCustEmail.split('@')[0],
                          email: manualCustEmail.trim(),
                          phone: manualCustPhone.trim() || undefined,
                        },
                        privateSelectedCustomers,
                        setPrivateSelectedCustomers
                      );
                      setManualCustName('');
                      setManualCustEmail('');
                      setManualCustPhone('');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#071B35] text-white text-xs font-semibold shrink-0"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Selected Customers Chips */}
              {privateSelectedCustomers.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-[#071B35] mb-1.5">
                    Selected Recipients ({privateSelectedCustomers.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {privateSelectedCustomers.map((c) => (
                      <span
                        key={c.email}
                        className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-1 rounded-lg text-[11px] font-semibold"
                      >
                        {c.email}
                        <button
                          type="button"
                          onClick={() =>
                            setPrivateSelectedCustomers((prev) =>
                              prev.filter((x) => x.email !== c.email)
                            )
                          }
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Private Coupon Configuration Form */}
            <form
              onSubmit={handleSubmitPrivateCoupon}
              className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#071B35] flex items-center gap-2">
                    <Lock className="w-4 h-4 text-[#FF7A00]" />
                    2. Configure Private Coupon & Delivery
                  </h3>
                  <p className="text-xs text-slate-500">
                    Private coupons are never exposed in public listings and work ONLY for the assigned account(s).
                  </p>
                </div>
                <div className="inline-flex bg-slate-100 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setPrivateMode('single')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      privateMode === 'single' ? 'bg-[#071B35] text-white' : 'text-slate-600'
                    }`}
                  >
                    Single Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrivateMode('bulk')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                      privateMode === 'bulk' ? 'bg-[#071B35] text-white' : 'text-slate-600'
                    }`}
                  >
                    Bulk Unique Codes
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {privateMode === 'single' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Private Code (blank = auto-generate)
                    </label>
                    <input
                      type="text"
                      value={privateForm.code}
                      onChange={(e) =>
                        setPrivateForm({ ...privateForm, code: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g. VIPRAHUL15"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bulk Code Prefix (1 unique code per customer)
                    </label>
                    <input
                      type="text"
                      value={privateForm.prefix}
                      onChange={(e) =>
                        setPrivateForm({ ...privateForm, prefix: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g. VIP"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Offer Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={privateForm.name}
                    onChange={(e) => setPrivateForm({ ...privateForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discount Type
                  </label>
                  <select
                    value={privateForm.offerType}
                    onChange={(e) =>
                      setPrivateForm({
                        ...privateForm,
                        offerType: e.target.value as CouponOfferType,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Value
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={privateForm.offerType === 'free_shipping'}
                    value={
                      privateForm.offerType === 'free_shipping' ? '0' : privateForm.discountValue
                    }
                    onChange={(e) =>
                      setPrivateForm({ ...privateForm, discountValue: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={privateForm.offerType !== 'percentage'}
                    value={
                      privateForm.offerType === 'percentage' ? privateForm.maxDiscountCap : ''
                    }
                    onChange={(e) =>
                      setPrivateForm({ ...privateForm, maxDiscountCap: e.target.value })
                    }
                    placeholder="Optional"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Min Order (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={privateForm.minOrderAmount}
                    onChange={(e) =>
                      setPrivateForm({ ...privateForm, minOrderAmount: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Usage Limit
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={privateForm.totalUsageLimit}
                    onChange={(e) =>
                      setPrivateForm({ ...privateForm, totalUsageLimit: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Expiry Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={privateForm.expiresAt}
                    onChange={(e) => setPrivateForm({ ...privateForm, expiresAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Notification Channel
                  </label>
                  <select
                    value={privateForm.notifyChannel}
                    onChange={(e) =>
                      setPrivateForm({
                        ...privateForm,
                        notifyChannel: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="both">Customer Dashboard Banner + Email (SMTP)</option>
                    <option value="dashboard">Customer Dashboard Notification Only</option>
                    <option value="email">Email Notification Only (SMTP)</option>
                    <option value="none">Do Not Notify Automatically</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Internal Admin Note
                  </label>
                  <input
                    type="text"
                    value={privateForm.internalNote}
                    onChange={(e) =>
                      setPrivateForm({ ...privateForm, internalNote: e.target.value })
                    }
                    placeholder="Reason for VIP voucher (e.g. corporate apology / bulk deal)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privateForm.oneTimePerCustomer}
                    onChange={(e) =>
                      setPrivateForm({ ...privateForm, oneTimePerCustomer: e.target.checked })
                    }
                  />
                  One-time use per assigned customer
                </label>
                <button
                  type="submit"
                  disabled={savingPrivate || privateSelectedCustomers.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e86d00] disabled:opacity-50 text-white text-xs font-bold transition-colors"
                >
                  {savingPrivate
                    ? 'Creating...'
                    : privateMode === 'bulk'
                    ? `Generate ${privateSelectedCustomers.length || 0} Unique Codes`
                    : 'Assign Private Coupon'}
                </button>
              </div>
            </form>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#071B35] mb-3">
              Private Customer-Specific Coupons ({privateCoupons.length})
            </h3>
            {renderCouponTable(
              privateCoupons,
              'No private customer-specific coupons created yet.'
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. FESTIVAL OFFERS SUBSECTION                                        */}
      {/* ==================================================================== */}
      {activeTab === 'festival' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            <div>
              <h3 className="text-base font-bold text-[#071B35] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#FF7A00]" />
                Launch Festival & Seasonal Storefront Campaign
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pick a festival preset, customize your storefront banner, and schedule automatic activation & expiry.
              </p>
            </div>

            {/* Preset Chips */}
            <div className="flex flex-wrap gap-2">
              {FESTIVAL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleFestivalPresetSelect(preset.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    festivalForm.preset === preset.id
                      ? 'bg-[#071B35] text-white border-[#071B35]'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#FF7A00]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Live Storefront Banner Preview */}
            <div className="rounded-2xl overflow-hidden bg-gradient-to-r from-[#071B35] via-[#102A4C] to-[#071B35] text-white p-5 border border-slate-800 relative">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  {festivalForm.bannerUrl ? (
                    <img
                      src={festivalForm.bannerUrl}
                      alt="Festival banner preview"
                      className="w-16 h-16 rounded-xl object-cover border border-white/20 shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-[#FF7A00]/20 border border-[#FF7A00]/40 flex items-center justify-center shrink-0">
                      <Gift className="w-7 h-7 text-[#FF7A00]" />
                    </div>
                  )}
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-[#FF7A00]">
                      Storefront Banner Preview · {festivalForm.campaignName || 'Festival Offer'}
                    </div>
                    <div className="text-base font-bold mt-0.5">
                      {festivalForm.headline || festivalForm.name}
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">{festivalForm.subtext}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-dashed border-[#FF7A00] text-center">
                    <div className="text-[10px] text-slate-300 uppercase">Use Code</div>
                    <div className="font-mono font-extrabold text-sm tracking-wider text-white">
                      {festivalForm.code || 'AUTO-CODE'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitFestivalOffer} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Festival Coupon Code *
                  </label>
                  <input
                    type="text"
                    value={festivalForm.code}
                    onChange={(e) =>
                      setFestivalForm({ ...festivalForm, code: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. DIWALI15 (blank = auto)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={festivalForm.campaignName}
                    onChange={(e) =>
                      setFestivalForm({ ...festivalForm, campaignName: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Banner Artwork (Upload or URL)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={festivalForm.bannerUrl}
                      onChange={(e) =>
                        setFestivalForm({ ...festivalForm, bannerUrl: e.target.value })
                      }
                      placeholder="https://... or upload"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                    />
                    <input
                      ref={bannerInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleBannerFileUpload(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingBanner}
                      onClick={() => bannerInputRef.current?.click()}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#071B35] inline-flex items-center gap-1 shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingBanner ? '...' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Banner Headline
                  </label>
                  <input
                    type="text"
                    value={festivalForm.headline}
                    onChange={(e) => setFestivalForm({ ...festivalForm, headline: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Banner Subtext
                  </label>
                  <input
                    type="text"
                    value={festivalForm.subtext}
                    onChange={(e) => setFestivalForm({ ...festivalForm, subtext: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Offer Type
                  </label>
                  <select
                    value={festivalForm.offerType}
                    onChange={(e) =>
                      setFestivalForm({
                        ...festivalForm,
                        offerType: e.target.value as CouponOfferType,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (₹)</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Discount Value
                  </label>
                  <input
                    type="number"
                    min={0}
                    disabled={festivalForm.offerType === 'free_shipping'}
                    value={
                      festivalForm.offerType === 'free_shipping' ? '0' : festivalForm.discountValue
                    }
                    onChange={(e) =>
                      setFestivalForm({ ...festivalForm, discountValue: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Min Order (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={festivalForm.minOrderAmount}
                    onChange={(e) =>
                      setFestivalForm({ ...festivalForm, minOrderAmount: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date/Time
                  </label>
                  <input
                    type="datetime-local"
                    value={festivalForm.startAt}
                    onChange={(e) => setFestivalForm({ ...festivalForm, startAt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date/Time
                  </label>
                  <input
                    type="datetime-local"
                    value={festivalForm.expiresAt}
                    onChange={(e) =>
                      setFestivalForm({ ...festivalForm, expiresAt: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={festivalForm.showOnStorefront}
                    onChange={(e) =>
                      setFestivalForm({ ...festivalForm, showOnStorefront: e.target.checked })
                    }
                  />
                  Display promotional banner on public storefront when active
                </label>
                <button
                  type="submit"
                  disabled={savingFestival}
                  className="px-6 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] disabled:opacity-50 text-white text-xs font-bold shadow-sm"
                >
                  {savingFestival ? 'Publishing...' : 'Launch Festival Offer'}
                </button>
              </div>
            </form>
          </div>

          <div>
            <h3 className="text-sm font-bold text-[#071B35] mb-3">
              Festival & Seasonal Campaigns ({festivalCoupons.length})
            </h3>
            {renderCouponTable(festivalCoupons, 'No festival offers launched yet.')}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. COUPON USAGE & REPORTS SUBSECTION                                 */}
      {/* ==================================================================== */}
      {activeTab === 'reports' && (
        <div className="space-y-5">
          {/* Filter & Export Controls */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-bold text-[#071B35] flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-[#FF7A00]" />
                Report Filters & Exports
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const r = await downloadAdminCouponCsv('redemptions', reportFilters);
                    notify(r.success ? 'Redemptions CSV downloaded.' : r.message || 'Export failed', r.success ? 'success' : 'error');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  Redemptions CSV
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const r = await downloadAdminCouponCsv('coupons', reportFilters);
                    notify(r.success ? 'Coupons Portfolio CSV downloaded.' : r.message || 'Export failed', r.success ? 'success' : 'error');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Download className="w-3.5 h-3.5 text-sky-600" />
                  Coupons CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071B35] text-white text-xs font-semibold hover:bg-[#0d274b]"
                >
                  <FileText className="w-3.5 h-3.5 text-[#FF7A00]" />
                  Export PDF Report
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <input
                type="date"
                value={reportFilters.startDate}
                onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
              <input
                type="date"
                value={reportFilters.endDate}
                onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
              <input
                type="text"
                value={reportFilters.code}
                onChange={(e) => setReportFilters({ ...reportFilters, code: e.target.value })}
                placeholder="Coupon code"
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
              <input
                type="text"
                value={reportFilters.campaign}
                onChange={(e) => setReportFilters({ ...reportFilters, campaign: e.target.value })}
                placeholder="Campaign name"
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
              <input
                type="text"
                value={reportFilters.customer}
                onChange={(e) => setReportFilters({ ...reportFilters, customer: e.target.value })}
                placeholder="Customer / Order ref"
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs"
              />
              <button
                type="button"
                onClick={() => loadOverview(reportFilters)}
                className="px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#e86d00] text-white text-xs font-bold"
              >
                Apply Filters
              </button>
            </div>
          </div>

          {/* Sub-tabs inside Reports */}
          <div className="flex gap-2">
            {[
              { id: 'redemptions', label: `Redemption History (${redemptions.length})` },
              {
                id: 'campaigns',
                label: `Campaign Breakdown (${overview?.campaignPerformance.length || 0})`,
              },
              { id: 'audit', label: `Admin Audit Log (${auditLogs.length})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setReportSubTab(t.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                  reportSubTab === t.id
                    ? 'bg-[#071B35] text-white border-[#071B35]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {reportSubTab === 'redemptions' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4">Redeemed At</th>
                      <th className="py-3 px-4">Coupon</th>
                      <th className="py-3 px-4">Order Ref</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4 text-right">Subtotal</th>
                      <th className="py-3 px-4 text-right">Discount</th>
                      <th className="py-3 px-4 text-right">Final Total</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {redemptions.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-10 text-center text-slate-400">
                          No coupon redemptions found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      redemptions.map((r) => {
                        const isRestored = r.status === 'restored';
                        const isRestoring = restoringRedemptionId === r.id;
                        const isConfirming = confirmRestoreId === r.id;
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/70">
                            <td className="py-3 px-4 tabular-nums text-slate-600">
                              {formatDateTimeShort(r.redeemedAt)}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-[#071B35]">
                              {r.couponCode}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-700">
                              {r.orderNumber || r.orderId}
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-800">
                                {r.customerName || 'Guest Customer'}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {r.customerEmail || r.customerPhone || '—'}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums">
                              {formatInr(r.subtotalInr)}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-bold text-[#FF7A00]">
                              -{formatInr((r.discountInr || 0) + (r.shippingSavedInr || 0))}
                              {r.shippingSavedInr > 0 && (
                                <div className="text-[10px] font-medium text-emerald-600">
                                  Incl. Free Shipping
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums font-bold text-[#071B35]">
                              {formatInr(r.finalTotalInr)}
                            </td>
                            <td className="py-3 px-4 capitalize text-slate-600">
                              {r.paymentStatus}
                            </td>
                            <td className="py-3 px-4">
                              {isRestored ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                                  Restored
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                                  Redeemed
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {isRestored ? (
                                <span className="text-[11px] text-slate-400">
                                  {r.restoredAt ? formatDateTimeShort(r.restoredAt) : 'Done'}
                                </span>
                              ) : isConfirming ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={isRestoring}
                                    onClick={async () => {
                                      setRestoringRedemptionId(r.id);
                                      try {
                                        const res = await restoreAdminCouponRedemption(r.id, true);
                                        if (res.success && res.restored) {
                                          notify(
                                            res.message || `Coupon ${r.couponCode} usage restored atomically.`,
                                            'success'
                                          );
                                          setConfirmRestoreId(null);
                                          await loadOverview();
                                        } else {
                                          notify(res.message || 'Unable to restore coupon usage.', 'error');
                                        }
                                      } finally {
                                        setRestoringRedemptionId(null);
                                      }
                                    }}
                                    className="px-2 py-1 rounded-lg bg-[#FF7A00] text-white text-[11px] font-semibold hover:bg-[#e56e00] disabled:opacity-50"
                                  >
                                    {isRestoring ? 'Restoring...' : 'Confirm'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isRestoring}
                                    onClick={() => setConfirmRestoreId(null)}
                                    className="px-2 py-1 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-medium hover:bg-slate-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmRestoreId(r.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[#071B35] hover:bg-orange-50 hover:border-orange-200 hover:text-[#FF7A00] text-[11px] font-semibold transition-colors"
                                  title="Atomically restore coupon quota & reverse analytics for this order"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Restore
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportSubTab === 'campaigns' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Campaign</th>
                    <th className="py-3 px-4 text-right">Coupons</th>
                    <th className="py-3 px-4 text-right">Redemptions</th>
                    <th className="py-3 px-4 text-right">Total Discount Given</th>
                    <th className="py-3 px-4 text-right">Orders Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs tabular-nums">
                  {(overview?.campaignPerformance || []).map((c) => (
                    <tr key={c.campaignName} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-bold text-[#071B35]">{c.campaignName}</td>
                      <td className="py-3 px-4 text-right">{c.couponsCount}</td>
                      <td className="py-3 px-4 text-right font-semibold">{c.redemptionsCount}</td>
                      <td className="py-3 px-4 text-right text-[#FF7A00] font-semibold">
                        {formatInr(c.discountGivenInr)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-[#071B35]">
                        {formatInr(c.revenueGeneratedInr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reportSubTab === 'audit' && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-400">
                    No admin coupon actions recorded yet.
                  </div>
                ) : (
                  auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-start gap-2.5">
                        <History className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-[#071B35]">
                            {log.summary}{' '}
                            {log.couponCode && (
                              <span className="font-mono text-[11px] text-[#FF7A00]">
                                [{log.couponCode}]
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Action: {log.action} · By: {log.actor}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                        {formatDateTimeShort(log.createdAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 8. EXPIRED & ARCHIVED COUPONS SUBSECTION                             */}
      {/* ==================================================================== */}
      {activeTab === 'expired' && (
        <div className="space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600">
            Expired and archived coupons remain permanently preserved here for financial reporting and audit integrity. You can duplicate any past offer to relaunch a fresh campaign.
          </div>
          {renderCouponTable(expiredCoupons, 'No expired or archived coupons yet.')}
        </div>
      )}

      {/* ==================================================================== */}
      {/* USAGE HISTORY INSPECTION MODAL                                       */}
      {/* ==================================================================== */}
      {inspectCoupon && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col">
            <div className="bg-[#071B35] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#FF7A00] font-bold">
                  Coupon Details & Redemption History
                </div>
                <div className="text-base font-bold font-mono">{inspectCoupon.code}</div>
              </div>
              <button
                type="button"
                onClick={() => setInspectCoupon(null)}
                className="p-1.5 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="text-slate-500">Offer</div>
                  <div className="font-bold text-[#071B35] mt-0.5">
                    {formatOfferLabel(inspectCoupon)}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="text-slate-500">Uses</div>
                  <div className="font-bold text-[#071B35] mt-0.5 tabular-nums">
                    {inspectCoupon.usageCount}
                    {inspectCoupon.totalUsageLimit ? ` / ${inspectCoupon.totalUsageLimit}` : ''}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="text-slate-500">Discount Given</div>
                  <div className="font-bold text-[#FF7A00] mt-0.5 tabular-nums">
                    {formatInr(inspectCoupon.totalDiscountGiven)}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                  <div className="text-slate-500">Revenue</div>
                  <div className="font-bold text-[#071B35] mt-0.5 tabular-nums">
                    {formatInr(inspectCoupon.totalRevenueGenerated)}
                  </div>
                </div>
              </div>

              {inspectCoupon.internalNote && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900">
                  <strong>Internal Note:</strong> {inspectCoupon.internalNote}
                </div>
              )}

              <div>
                <h4 className="font-bold text-[#071B35] mb-2">Redemptions</h4>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {redemptions.filter((r) => r.couponId === inspectCoupon.id).length === 0 ? (
                    <div className="p-4 text-center text-slate-400">No redemptions recorded yet.</div>
                  ) : (
                    redemptions
                      .filter((r) => r.couponId === inspectCoupon.id)
                      .map((r) => (
                        <div key={r.id} className="p-3 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-[#071B35]">
                              {r.orderNumber || r.orderId} · {r.customerName || r.customerEmail || 'Guest'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {formatDateTimeShort(r.redeemedAt)}
                            </div>
                          </div>
                          <div className="text-right tabular-nums">
                            <div className="font-bold text-[#FF7A00]">
                              -{formatInr(r.discountInr + r.shippingSavedInr)}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Total: {formatInr(r.finalTotalInr)}
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* NOTIFY CUSTOMER MODAL                                                */}
      {/* ==================================================================== */}
      {notifyModalCoupon && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-[#071B35] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#FF7A00]" />
                <span className="text-sm font-bold">
                  Notify Customer — {notifyModalCoupon.code}
                </span>
              </div>
              <button type="button" onClick={() => setNotifyModalCoupon(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="text-slate-600">
                Recipients ({notifyModalCoupon.assignedCustomers.length}):{' '}
                <strong>
                  {notifyModalCoupon.assignedCustomers.map((x) => x.email).join(', ')}
                </strong>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Delivery Channel</label>
                <select
                  value={notifyChannel}
                  onChange={(e) => setNotifyChannel(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="both">Customer Dashboard + Email (Hostinger SMTP)</option>
                  <option value="dashboard">Customer Dashboard Notification Only</option>
                  <option value="email">Email Only (Hostinger SMTP)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Optional Custom Note
                </label>
                <textarea
                  rows={3}
                  value={notifyCustomMsg}
                  onChange={(e) => setNotifyCustomMsg(e.target.value)}
                  placeholder="Leave blank to use the branded default invitation message."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNotifyModalCoupon(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={sendingNotify}
                  onClick={handleSendCustomerNotification}
                  className="px-5 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white font-bold disabled:opacity-50"
                >
                  {sendingNotify ? 'Sending...' : 'Send Notification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
