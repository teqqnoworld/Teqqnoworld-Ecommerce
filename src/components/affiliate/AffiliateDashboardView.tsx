import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  BarChart3,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Globe,
  HelpCircle,
  History,
  IdCard,
  LayoutDashboard,
  Link2,
  Menu,
  MousePointerClick,
  Package,
  QrCode,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import type {
  AffiliateAnalyticsRange,
  AffiliateDashboardPayload,
} from '../../types/affiliate';
import {
  createAffiliateLink,
  createAffiliateSupportTicket,
  downloadAffiliateCertificatePdf,
  downloadAffiliateIdCardPdf,
  downloadAffiliateReportPdf,
  downloadCsvFile,
  fetchAffiliateDashboard,
  formatInrPaisa,
  formatShortDate,
  generateQrCodeDataUrl,
  markAffiliateNotificationRead,
  replyAffiliateSupportTicket,
  requestAffiliateWithdrawal,
  submitAffiliateClosureRequest,
  submitAffiliateReactivationRequest,
  uploadAffiliateIdCardPhoto,
} from '../../services/affiliateService';
import { buildAffiliateDemoDashboard } from '../../data/affiliateDemoData';
import {
  AffiliateCommissionDonutCard,
  AffiliateEarningsAreaChart,
  AffiliateKpiCard,
} from './AffiliateVisuals';

type AffiliateSectionId =
  | 'overview'
  | 'all-links'
  | 'website-link'
  | 'product-links'
  | 'qr-codes'
  | 'promotion-history'
  | 'click-history'
  | 'order-referrals'
  | 'analytics'
  | 'sales-reports'
  | 'conversion-reports'
  | 'commission-history'
  | 'wallet'
  | 'withdrawals'
  | 'targets'
  | 'rewards'
  | 'leaderboard'
  | 'certificate'
  | 'id-card'
  | 'profile'
  | 'kyc'
  | 'notifications'
  | 'support'
  | 'settings';

interface AffiliateDashboardViewProps {
  user: UserProfile | null;
  onNavigate: (tab: string) => void;
  onRequestLogin: () => void;
}

const NAV_GROUPS: Array<{
  title: string;
  items: Array<{ id: AffiliateSectionId; label: string; icon: React.ComponentType<{ className?: string }> }>;
}> = [
  {
    title: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'all-links', label: 'My Affiliate Links', icon: Link2 },
      { id: 'website-link', label: 'Website Referral Link', icon: Globe },
      { id: 'product-links', label: 'Product Affiliate Links', icon: ShoppingBag },
      { id: 'qr-codes', label: 'QR Codes', icon: QrCode },
      { id: 'promotion-history', label: 'Product Promotion History', icon: History },
    ],
  },
  {
    title: 'Performance & Reports',
    items: [
      { id: 'click-history', label: 'Click History', icon: MousePointerClick },
      { id: 'order-referrals', label: 'Order Referrals', icon: Package },
      { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      { id: 'sales-reports', label: 'Sales Reports', icon: FileSpreadsheet },
      { id: 'conversion-reports', label: 'Conversion Reports', icon: TrendingUp },
      { id: 'commission-history', label: 'Commission History', icon: FileText },
    ],
  },
  {
    title: 'Finance & Incentives',
    items: [
      { id: 'wallet', label: 'Wallet', icon: Wallet },
      { id: 'withdrawals', label: 'Withdrawals', icon: CreditCard },
      { id: 'targets', label: 'Monthly Targets', icon: Target },
      { id: 'rewards', label: 'Rewards', icon: Award },
      { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
    ],
  },
  {
    title: 'Credentials & Account',
    items: [
      { id: 'certificate', label: 'Certificate', icon: BadgeCheck },
      { id: 'id-card', label: 'Digital ID Card', icon: IdCard },
      { id: 'profile', label: 'Profile', icon: User },
      { id: 'kyc', label: 'KYC Information', icon: ShieldCheck },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'support', label: 'Support Tickets', icon: HelpCircle },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

const ALL_SECTIONS = NAV_GROUPS.flatMap((g) => g.items);

export const AffiliateDashboardView: React.FC<AffiliateDashboardViewProps> = ({
  user,
  onNavigate,
  onRequestLogin,
}) => {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === '1') return true;
      return sessionStorage.getItem('tw_affiliate_demo_mode') === '1';
    } catch {
      return false;
    }
  });
  const [section, setSection] = useState<AffiliateSectionId>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [data, setData] = useState<AffiliateDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Analytics filter state
  const [range, setRange] = useState<AffiliateAnalyticsRange>('monthly');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  // Link & QR state
  const [campaignTag, setCampaignTag] = useState('');
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [verifyQrUrl, setVerifyQrUrl] = useState<string>('');

  // Withdrawal state
  const [withdrawAmountInr, setWithdrawAmountInr] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  // Leaderboard tab
  const [lbTab, setLbTab] = useState<'monthly' | 'yearly' | 'allTime'>('monthly');

  // Support ticket state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState('payouts');
  const [ticketMessage, setTicketMessage] = useState('');
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});

  // Reactivation / Closure request state
  const [reactivationReason, setReactivationReason] = useState('');
  const [closureReason, setClosureReason] = useState('');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3800);
  };

  const enterDemoMode = () => {
    try {
      sessionStorage.setItem('tw_affiliate_demo_mode', '1');
    } catch {
      // ignore
    }
    setIsDemoMode(true);
    setError(null);
    setData(buildAffiliateDemoDashboard(range));
    setLoading(false);
    showToast('Entered Demo Partner Account (TW-AFF-DEMO01)');
  };

  const exitDemoMode = () => {
    try {
      sessionStorage.removeItem('tw_affiliate_demo_mode');
    } catch {
      // ignore
    }
    setIsDemoMode(false);
    setData(null);
    onNavigate('affiliate-program');
  };

  const loadDashboard = async (
    overrideRange?: AffiliateAnalyticsRange,
    fromVal?: string,
    toVal?: string
  ) => {
    if (isDemoMode) {
      setError(null);
      setData(buildAffiliateDemoDashboard(overrideRange || range));
      setLoading(false);
      return;
    }
    if (!user?.email) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAffiliateDashboard(user.email, {
        range: overrideRange || range,
        from: fromVal ?? (customFrom || undefined),
        to: toVal ?? (customTo || undefined),
      });
      setData(res.dashboard);
    } catch (err: any) {
      setError(err?.message || 'Unable to load your Affiliate Partner Dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [user?.email, isDemoMode]);

  // Generate QR codes for verification + links when data updates
  useEffect(() => {
    if (!data) return;
    const domain = data.settings.officialDomain.replace(/\/+$/, '');
    const verifyUrl = `${domain}/affiliate/verify/${encodeURIComponent(
      data.partner.verificationCode
    )}`;
    generateQrCodeDataUrl(verifyUrl)
      .then(setVerifyQrUrl)
      .catch(() => undefined);

    Promise.all(
      data.links.slice(0, 12).map(async (link) => {
        const url = await generateQrCodeDataUrl(link.targetUrl);
        return [link.id, url] as const;
      })
    )
      .then((entries) => {
        const map: Record<string, string> = {};
        for (const [id, url] of entries) map[id] = url;
        setQrMap(map);
      })
      .catch(() => undefined);
  }, [data?.partner.verificationCode, data?.links.length]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedId(id);
    showToast('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCreateLink = async (linkType: 'website' | 'product', productId?: string) => {
    if (isDemoMode) {
      if (!data) return;
      const prod = productId ? data.enabledProducts.find((p) => p.productId === productId) : null;
      const cleanTag = campaignTag.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '') || null;
      const base = prod
        ? `${data.settings.officialDomain}/${prod.productSlug}`
        : `${data.settings.officialDomain}/`;
      const targetUrl = `${base}?ref=${data.partner.referralToken}${cleanTag ? `&campaign=${cleanTag}` : ''}`;
      setData({
        ...data,
        links: [
          {
            id: `demo-link-${Date.now()}`,
            partnerId: data.partner.id,
            affiliateId: data.partner.affiliateId,
            linkType,
            productId: prod?.productId || null,
            productSlug: prod?.productSlug || null,
            productName: prod?.productName || 'TeqqnoWorld Official Storefront',
            referralToken: data.partner.referralToken,
            campaignTag: cleanTag,
            targetUrl,
            status: 'active',
            clicksCount: 0,
            ordersCount: 0,
            commissionEarnedPaisa: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...data.links,
        ],
      });
      setCampaignTag('');
      showToast('Demo link generated in preview (not saved to database)');
      return;
    }
    if (!user?.email) return;
    try {
      await createAffiliateLink(user.email, {
        linkType,
        productId,
        campaignTag: campaignTag.trim() || undefined,
      });
      setCampaignTag('');
      showToast('Affiliate link ready');
      await loadDashboard();
    } catch (err: any) {
      showToast(err?.message || 'Unable to create affiliate link', 'error');
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemoMode) {
      showToast('Demo Preview Mode is read-only. Apply for a verified partner account for live withdrawals.', 'error');
      return;
    }
    if (!user?.email) return;
    const amt = Number(withdrawAmountInr);
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Enter a valid INR withdrawal amount', 'error');
      return;
    }
    setWithdrawing(true);
    try {
      const res = await requestAffiliateWithdrawal(
        user.email,
        amt,
        `wd-${Date.now()}-${Math.round(amt * 100)}`
      );
      setWithdrawAmountInr('');
      showToast(res.message || 'Withdrawal request submitted');
      await loadDashboard();
    } catch (err: any) {
      showToast(err?.message || 'Withdrawal request failed', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  const handleUploadCardPhoto = (file: File | null) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Upload a JPG, PNG, or WebP portrait image', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      if (isDemoMode) {
        setData((prev) =>
          prev ? { ...prev, partner: { ...prev.partner, avatarUrl: dataUrl } } : prev
        );
        showToast('Demo Digital ID Card portrait updated in preview');
        return;
      }
      if (!user?.email) return;
      try {
        await uploadAffiliateIdCardPhoto(user.email, dataUrl);
        showToast('Digital ID Card portrait updated');
        await loadDashboard();
      } catch (err: any) {
        showToast(err?.message || 'Unable to upload portrait', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemoMode) {
      showToast('Demo Preview Mode is read-only. Apply for a live partner account to open support tickets.', 'error');
      return;
    }
    if (!user?.email) return;
    try {
      await createAffiliateSupportTicket(user.email, {
        subject: ticketSubject,
        category: ticketCategory,
        message: ticketMessage,
      });
      setTicketSubject('');
      setTicketMessage('');
      showToast('Support ticket submitted');
      await loadDashboard();
    } catch (err: any) {
      showToast(err?.message || 'Unable to submit ticket', 'error');
    }
  };

  const handleReplyTicket = async (ticketId: string) => {
    if (isDemoMode) {
      showToast('Demo Preview Mode is read-only.', 'error');
      return;
    }
    if (!user?.email) return;
    const msg = (replyTextMap[ticketId] || '').trim();
    if (!msg) return;
    try {
      await replyAffiliateSupportTicket(user.email, ticketId, msg);
      setReplyTextMap((prev) => ({ ...prev, [ticketId]: '' }));
      showToast('Reply sent');
      await loadDashboard();
    } catch (err: any) {
      showToast(err?.message || 'Unable to send reply', 'error');
    }
  };

  const currentSectionMeta = useMemo(
    () => ALL_SECTIONS.find((s) => s.id === section) || ALL_SECTIONS[0],
    [section]
  );

  // Unauthenticated state (unless Demo Preview Mode is active)
  if (!user && !isDemoMode) {
    return (
      <div className="min-h-[75vh] bg-slate-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[#071B35] text-[#FF7A00] mx-auto flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="font-display text-xl font-bold text-[#071B35]">
            Sign In to Affiliate Partner Dashboard
          </h1>
          <p className="text-xs text-slate-600">
            Access your referral links, conversion analytics, commissions, wallet, and credentials — or explore the interactive Demo Partner Account right away.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={onRequestLogin}
              className="px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={enterDemoMode}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#071B35] hover:bg-[#0B2447] text-white text-xs font-semibold cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>Preview Demo Account</span>
            </button>
            <button
              onClick={() => onNavigate('affiliate-program')}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-[#071B35] text-xs font-semibold cursor-pointer"
            >
              Program Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="min-h-[75vh] bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-[#FF7A00] rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-600">Loading Affiliate Partner Dashboard...</p>
        </div>
      </div>
    );
  }

  if ((error || !data) && !isDemoMode) {
    return (
      <div className="min-h-[75vh] bg-slate-50 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-[#FF7A00] mx-auto" />
          <h1 className="font-display text-lg font-bold text-[#071B35]">
            Affiliate Partner Account Required
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {error ||
              'You do not have an active TeqqnoWorld Affiliate Partner account yet. Check your eligibility and submit your application from the Affiliate Program page, or explore the Demo Partner Dashboard first.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={enterDemoMode}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#071B35] hover:bg-[#0B2447] text-white text-xs font-semibold cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>Preview Demo Account</span>
            </button>
            <button
              onClick={() => onNavigate('affiliate-program')}
              className="px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold cursor-pointer"
            >
              Apply for Affiliate Program
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-[#071B35] text-xs font-semibold cursor-pointer"
            >
              Customer Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const websiteLink = data.links.find((l) => l.linkType === 'website');
  const maxSeriesClicks = Math.max(1, ...data.analyticsSeries.map((p) => p.clicks));
  const maxSeriesSales = Math.max(1, ...data.analyticsSeries.map((p) => p.salesPaisa));

  const exportAnalyticsCsv = () => {
    downloadCsvFile(
      `${data.partner.affiliateId}-analytics-${range}.csv`,
      ['Period', 'Clicks', 'Orders', 'Referred Sales (INR)', 'Commission (INR)'],
      data.analyticsSeries.map((p) => [
        p.label,
        p.clicks,
        p.orders,
        (p.salesPaisa / 100).toFixed(2),
        (p.commissionPaisa / 100).toFixed(2),
      ])
    );
  };

  const exportAnalyticsPdf = () => {
    downloadAffiliateReportPdf({
      title: `Affiliate Analytics Report (${range.toUpperCase()})`,
      subtitle: `${data.partner.fullName} (${data.partner.affiliateId})`,
      filename: `${data.partner.affiliateId}-analytics-${range}.pdf`,
      headers: ['Period', 'Clicks', 'Orders', 'Referred Sales (INR)', 'Commission (INR)'],
      rows: data.analyticsSeries.map((p) => [
        p.label,
        p.clicks,
        p.orders,
        formatInrPaisa(p.salesPaisa),
        formatInrPaisa(p.commissionPaisa),
      ]),
    });
  };

  const exportCommissionsCsv = () => {
    downloadCsvFile(
      `${data.partner.affiliateId}-commissions.csv`,
      [
        'Date',
        'Masked Order Ref',
        'Product',
        'Qty',
        'Eligible GST-Incl Base (INR)',
        'Rate Snapshot (%)',
        'Commission (INR)',
        'Order Status',
        'Commission Status',
      ],
      data.commissions.map((c) => [
        formatShortDate(c.createdAt),
        c.orderNumberMasked,
        c.productName,
        c.quantity,
        (c.gstInclusiveEligiblePaisa / 100).toFixed(2),
        `${c.commissionRatePctSnapshot}%`,
        (c.commissionAmountPaisa / 100).toFixed(2),
        c.orderStatus,
        c.status,
      ])
    );
  };

  const exportCommissionsPdf = () => {
    downloadAffiliateReportPdf({
      title: 'Sales & Commission Statement',
      subtitle: `${data.partner.fullName} (${data.partner.affiliateId})`,
      filename: `${data.partner.affiliateId}-commissions.pdf`,
      headers: ['Date', 'Order Ref', 'Product', 'Qty', 'Eligible Base', 'Rate', 'Commission', 'Status'],
      rows: data.commissions.map((c) => [
        formatShortDate(c.createdAt),
        c.orderNumberMasked,
        c.productName,
        c.quantity,
        formatInrPaisa(c.gstInclusiveEligiblePaisa),
        `${c.commissionRatePctSnapshot}%`,
        formatInrPaisa(c.commissionAmountPaisa),
        c.status.toUpperCase(),
      ]),
    });
  };

  const partnerInitials = (data.partner.fullName || 'TP')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');

  const sparkClicks = data.analyticsSeries.map((p) => p.clicks);
  const sparkSales = data.analyticsSeries.map((p) => Math.round(p.salesPaisa / 100));
  const sparkCommissions = data.analyticsSeries.map((p) => Math.round(p.commissionPaisa / 100));
  const sparkOrders = data.analyticsSeries.map((p) => p.orders * 10 + 4);

  return (
    <div className="min-h-screen bg-[#F5F7FB] text-slate-900 flex flex-col lg:flex-row pb-20 lg:pb-0">
      {/* Animated Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className={`fixed top-4 right-4 z-[60] flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold shadow-xl ${
              toast.type === 'success'
                ? 'bg-[#0B1530] text-white border-[#FF7900]/60'
                : 'bg-red-700 text-white border-red-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 text-[#FF7900] shrink-0" />
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR (256px Signature Midnight Navy — Matching Customer & Admin Portals) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-[#0B1530] text-white border-r border-slate-800/80 shrink-0 min-h-screen sticky top-0 max-h-screen overflow-y-auto">
        {/* Top TeqqnoWorld Brand Lockup */}
        <div className="px-5 pt-5 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF7900] text-white font-display font-extrabold text-lg flex items-center justify-center shadow-md shadow-[#FF7900]/30 shrink-0">
              T
            </div>
            <div className="min-w-0">
              <div className="font-display text-base font-extrabold tracking-tight leading-none">
                Teqqno<span className="text-[#FF7900]">World</span>
              </div>
              <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-slate-400 mt-1">
                AFFILIATE • PARTNER • PORTAL
              </div>
            </div>
          </div>

          {/* Circular Partner Avatar & Verified Badge (Exact Customer Dashboard DNA) */}
          <div className="mt-5 flex flex-col items-center text-center">
            <div className="relative">
              {data.partner.avatarUrl ? (
                <img
                  src={data.partner.avatarUrl}
                  alt={data.partner.fullName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white/25 shadow-lg"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0F766E] to-[#0D9488] border-2 border-white/25 flex items-center justify-center text-xl font-display font-bold text-white shadow-lg">
                  {partnerInitials}
                </div>
              )}
              <button
                type="button"
                onClick={() => setSection('id-card')}
                title="Update Partner Photo"
                className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#FF7900] hover:bg-[#e56d00] text-white border-2 border-[#0B1530] flex items-center justify-center shadow cursor-pointer transition-transform hover:scale-110"
              >
                <Camera className="w-3 h-3" />
              </button>
            </div>
            <div className="mt-2.5 text-sm font-bold text-white truncate max-w-full">
              {data.partner.firstName} {data.partner.lastName}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              {data.partner.affiliateId}
            </div>
            <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-[10px] font-semibold text-emerald-300">
              <CheckCircle2 className="w-3 h-3" />
              <span>{data.partner.status === 'active' ? 'Verified Partner' : data.partner.status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Grouped Navigation with Sliding Orange Active Pill */}
        <nav className="flex-1 px-3 py-4 space-y-5">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              <div className="px-3 mb-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400/80">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = section === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSection(item.id)}
                      className={`relative w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'text-white font-semibold'
                          : 'text-slate-300 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="affiliate-sidebar-active-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                          className="absolute inset-0 rounded-xl bg-[#FF7900] shadow-md shadow-[#FF7900]/30"
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-2.5 truncate">
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.id === 'notifications' && data.kpis.unreadNotifications > 0 && (
                        <span
                          className={`relative z-10 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded-full ${
                            active ? 'bg-white text-[#0B1530]' : 'bg-[#FF7900] text-white'
                          }`}
                        >
                          {data.kpis.unreadNotifications}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Signature Partner Card (Matching Customer & Admin Sidebar Bottom Card) */}
        <div className="p-3 border-t border-white/10 space-y-2.5">
          <div className="rounded-2xl bg-gradient-to-br from-[#13264B] to-[#0E1D3B] border border-white/10 p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#FF7900]/15 border border-[#FF7900]/30 text-[#FF7900] flex items-center justify-center shrink-0">
                <BadgeCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-white leading-tight">
                  Official Partner Kit
                </div>
                <div className="text-[10px] text-slate-400">Certificate &amp; QR ID Card</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSection('certificate')}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl bg-white/8 hover:bg-white/15 border border-white/10 text-[11px] font-semibold text-white transition-colors cursor-pointer"
            >
              <span>Download Credentials</span>
              <span className="w-5 h-5 rounded-full bg-[#FF7900] text-white flex items-center justify-center">
                <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          </div>

          <button
            onClick={() => onNavigate('dashboard')}
            className="w-full px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-white/10 hover:text-white text-left flex items-center gap-2 cursor-pointer transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            <span>Switch to Customer Portal</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT VIEWPORT */}
      <div className="flex-1 min-w-0 flex flex-col">
        {isDemoMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-[#0B1530] via-[#13254F] to-[#0B1530] text-white border-b border-[#FF7900]/40 px-4 sm:px-6 lg:px-8 py-2.5"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#FF7900] shrink-0" />
                <span className="font-semibold">Demo Partner Account Preview</span>
                <span className="hidden sm:inline text-slate-300">
                  — Sample data for <strong className="font-mono text-[#FF7900]">TW-AFF-DEMO01</strong> (all 24 sections, charts, exports &amp; PDF credentials unlocked; live payout actions disabled).
                </span>
              </div>
              <button
                onClick={exitDemoMode}
                className="px-3 py-1 rounded-lg bg-[#FF7900] hover:bg-[#e56d00] text-white font-semibold text-[11px] cursor-pointer transition-colors"
              >
                Exit Demo &amp; Apply
              </button>
            </div>
          </motion.div>
        )}

        {/* Top Sticky Header Bar (Exact Customer Dashboard Top Bar DNA) */}
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 rounded-xl text-[#0B1530] hover:bg-slate-100 cursor-pointer"
                aria-label="Open Affiliate Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 text-[#0B1530] font-semibold text-xs transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#FF7900]" />
                <span>Back to Storefront</span>
              </button>

              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-400 hidden md:inline">Affiliate Portal</span>
                <span className="text-slate-300 hidden md:inline">›</span>
                <span className="font-display font-bold text-[#0B1530] text-sm truncate">
                  {currentSectionMeta.label}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => loadDashboard()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0B1530] whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              {websiteLink && data.partner.status === 'active' && (
                <button
                  onClick={() => handleCopy(websiteLink.targetUrl, 'header-copy')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-orange-200 bg-orange-50/80 hover:bg-orange-100/80 text-[#0B1530] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                >
                  {copiedId === 'header-copy' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#FF7900]" />
                  )}
                  <span>{copiedId === 'header-copy' ? 'Copied!' : 'Copy Link'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setSection('notifications')}
                className="relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {data.kpis.unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF7900] text-white text-[10px] font-bold flex items-center justify-center shadow">
                    {data.kpis.unreadNotifications}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSection('profile')}
                className="hidden md:inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <span className="w-7 h-7 rounded-full bg-[#0D9488] text-white text-[11px] font-bold flex items-center justify-center">
                  {partnerInitials}
                </span>
                <span className="text-xs font-semibold text-[#0B1530] max-w-[100px] truncate">
                  {data.partner.firstName}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Suspension / Closure Notice Banner */}
        {data.partner.status !== 'active' && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 lg:px-8 py-3 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Account {data.partner.status.toUpperCase()}:</strong>{' '}
                {data.partner.suspensionReason || data.partner.closedReason || 'Referral links and withdrawals are currently disabled.'}
              </span>
            </div>
            {data.partner.status === 'suspended' && (
              <button
                onClick={() => setSection('settings')}
                className="font-bold underline text-[#0B1530] cursor-pointer"
              >
                Submit Reactivation Request
              </button>
            )}
          </div>
        )}

        {/* MAIN SECTION BODY WITH SMOOTH ANIMATED TRANSITIONS */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-6"
            >
              {/* 1. OVERVIEW (Matching TeqqnoWorld Customer & Admin Dashboard Screenshots) */}
              {section === 'overview' && (
                <div className="space-y-5">
                  {/* A. Signature Dark Navy Welcome Hero Banner (Screenshot 1 DNA) */}
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                    className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0B1530] via-[#12254E] to-[#192F61] text-white p-6 sm:p-7 shadow-lg shadow-[#0B1530]/15 border border-white/10"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-12 -top-12 w-60 h-60 rounded-full bg-[#FF7900]/15 blur-3xl"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute right-36 -bottom-16 w-48 h-48 rounded-full bg-blue-500/15 blur-3xl"
                    />

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                      <div className="space-y-2.5">
                        <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                          Welcome back,{' '}
                          <span className="text-[#FF7900]">
                            {data.partner.firstName} {data.partner.lastName}!
                          </span>
                        </h1>
                        <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
                          Manage your referral links, real-time analytics, commissions, wallet payouts, and official TeqqnoWorld credentials in one place.
                        </p>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/35 text-[11px] font-semibold text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified Affiliate Partner</span>
                          </span>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-mono font-semibold text-slate-100">
                            <BadgeCheck className="w-3.5 h-3.5 text-[#FF7900]" />
                            <span>
                              {data.partner.affiliateId} • {data.settings.cookieDurationDays}-Day Attribution
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            websiteLink
                              ? handleCopy(websiteLink.targetUrl, 'hero-copy')
                              : setSection('all-links')
                          }
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] text-white text-xs sm:text-sm font-bold shadow-lg shadow-[#FF7900]/30 transition-all hover:-translate-y-0.5 cursor-pointer"
                        >
                          {copiedId === 'hero-copy' ? (
                            <Check className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                          <span>{copiedId === 'hero-copy' ? 'Referral Link Copied' : '+ Copy Referral Link'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSection('withdrawals')}
                          className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/18 border border-white/20 text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4 text-[#FF7900]" />
                          <span>Withdraw</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>

                  {/* B. 4 Pastel-Bordered Animated KPI Cards with Sparklines (Both Screenshots DNA) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <AffiliateKpiCard
                      id="avail"
                      index={0}
                      title="Available Balance"
                      paisaValue={data.kpis.availableCommissionPaisa}
                      badgeText="Ready"
                      subtitle="Eligible for bank payout"
                      theme="orange"
                      icon={<Wallet className="w-5 h-5" />}
                      sparkPoints={sparkCommissions}
                      onClick={() => setSection('withdrawals')}
                    />
                    <AffiliateKpiCard
                      id="pend"
                      index={1}
                      title="Pending Commission"
                      paisaValue={data.kpis.pendingCommissionPaisa}
                      badgeText={`${data.settings.returnPeriodDays}d Hold`}
                      subtitle="Awaiting delivery & return window"
                      theme="blue"
                      icon={<Package className="w-5 h-5" />}
                      sparkPoints={sparkOrders}
                      onClick={() => setSection('commission-history')}
                    />
                    <AffiliateKpiCard
                      id="withdrawn"
                      index={2}
                      title="Total Withdrawn"
                      paisaValue={data.kpis.totalWithdrawnPaisa}
                      badgeText="Settled"
                      subtitle={`Processing: ${formatInrPaisa(data.kpis.processingPayoutPaisa)}`}
                      theme="green"
                      icon={<CreditCard className="w-5 h-5" />}
                      sparkPoints={sparkSales}
                      onClick={() => setSection('wallet')}
                    />
                    <AffiliateKpiCard
                      id="sales"
                      index={3}
                      title="Referred Orders"
                      customValueText={`${data.kpis.referredOrders}`}
                      badgeText={`${data.kpis.conversionRatePct}% CR`}
                      subtitle={`${data.kpis.totalClicks.toLocaleString('en-IN')} clicks • ${formatInrPaisa(data.kpis.totalReferredSalesPaisa)}`}
                      theme="violet"
                      icon={<TrendingUp className="w-5 h-5" />}
                      sparkPoints={sparkClicks}
                      onClick={() => setSection('analytics')}
                    />
                  </div>

                  {/* C. Quick Actions Horizontal Strip (Exact Customer Dashboard DNA) */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.12 }}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-xs px-4 py-3 flex flex-wrap items-center gap-2.5"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#0B1530] mr-1">
                      <Zap className="w-4 h-4 text-[#FF7900]" />
                      <span>Quick Actions:</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        websiteLink
                          ? handleCopy(websiteLink.targetUrl, 'qa-copy')
                          : setSection('website-link')
                      }
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B1530] hover:bg-[#142550] text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Link2 className="w-3.5 h-3.5 text-[#FF7900]" />
                      <span>{copiedId === 'qa-copy' ? 'Link Copied!' : 'Copy Website Link'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection('product-links')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 border border-orange-200 text-[#FF7900] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Product Links ({data.enabledProducts.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection('qr-codes')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-slate-500" />
                      <span>QR Codes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection('certificate')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <BadgeCheck className="w-3.5 h-3.5 text-slate-500" />
                      <span>Certificate PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSection('id-card')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <IdCard className="w-3.5 h-3.5 text-slate-500" />
                      <span>Digital ID Card</span>
                    </button>
                    <button
                      type="button"
                      onClick={exportCommissionsCsv}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Export CSV</span>
                    </button>
                  </motion.div>

                  {/* D. 2-Column Glowing Area Chart + Commission Pipeline Donut Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-8">
                      <AffiliateEarningsAreaChart
                        series={data.analyticsSeries}
                        range={range}
                        onChangeRange={(nextRange) => {
                          setRange(nextRange);
                          loadDashboard(nextRange);
                        }}
                        totalClicks={data.kpis.totalClicks}
                        totalReferredSalesPaisa={data.kpis.totalReferredSalesPaisa}
                        referredOrders={data.kpis.referredOrders}
                        onOpenAnalytics={() => setSection('analytics')}
                      />
                    </div>
                    <div className="lg:col-span-4">
                      <AffiliateCommissionDonutCard
                        commissions={data.commissions}
                        onWithdraw={() => setSection('withdrawals')}
                        onOpenWallet={() => setSection('wallet')}
                      />
                    </div>
                  </div>

                  {/* E. Recent Referred Orders Card (Exact Table DNA of Both Screenshots) */}
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.24 }}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden"
                  >
                    <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/70 text-[#FF7900] flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <h2 className="font-display text-base font-bold text-[#0B1530] leading-tight">
                            Recent Referred Orders
                          </h2>
                          <p className="text-xs text-slate-500">
                            Live commission status, rate snapshots &amp; return-period release tracking
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSection('order-referrals')}
                        className="text-xs font-bold text-[#FF7900] hover:underline cursor-pointer"
                      >
                        View All Referrals ({data.commissions.length}) →
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {data.commissions.length === 0 ? (
                        <div className="px-5 py-10 text-center text-xs text-slate-500">
                          No referred orders yet. Share your website or product referral links to start earning commissions.
                        </div>
                      ) : (
                        data.commissions.slice(0, 5).map((c) => {
                          const statusStyle =
                            c.status === 'available'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : c.status === 'paid'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : c.status === 'cancelled'
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200';
                          return (
                            <div
                              key={c.id}
                              className="px-5 py-3.5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200/80 text-[#0B1530] flex items-center justify-center shrink-0 font-mono text-[11px] font-bold">
                                  {c.commissionRatePctSnapshot}%
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-[#FF7900]">
                                      {c.orderNumberMasked}
                                    </span>
                                    <span className="text-xs font-bold text-[#0B1530] truncate">
                                      {c.productName}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    {formatShortDate(c.createdAt)} • Qty {c.quantity} • Eligible Base:{' '}
                                    <span className="font-mono font-semibold text-slate-700">
                                      {formatInrPaisa(c.gstInclusiveEligiblePaisa)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold capitalize ${statusStyle}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                  {c.status.replace(/_/g, ' ')}
                                </span>
                                <div className="text-right min-w-[88px]">
                                  <div className="font-mono text-sm font-bold text-[#0B1530] tabular-nums">
                                    {formatInrPaisa(c.commissionAmountPaisa)}
                                  </div>
                                  <div className="text-[10px] text-slate-400 capitalize">
                                    {c.orderStatus.replace(/_/g, ' ')}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>

                  {/* F. Bottom 2-Column Row: Monthly Targets & Announcements + 8 Pastel Tool Tiles (Screenshot 1 DNA) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left: Monthly Targets & Announcements */}
                    <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200/70 text-[#FF7900] flex items-center justify-center">
                            <Target className="w-4 h-4" />
                          </div>
                          <div>
                            <h2 className="font-display text-sm font-bold text-[#0B1530]">
                              Monthly Targets &amp; Campaigns
                            </h2>
                            <p className="text-[11px] text-slate-500">
                              Track provisional delivered &amp; final qualified milestones
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSection('targets')}
                          className="text-xs font-bold text-[#FF7900] hover:underline cursor-pointer"
                        >
                          All Targets →
                        </button>
                      </div>

                      <div className="space-y-3">
                        {data.targets.slice(0, 2).map((t) => (
                          <div
                            key={t.id}
                            className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/70 space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#0B1530]">{t.title}</span>
                              <span className="text-[11px] font-mono font-bold text-[#FF7900]">
                                {t.finalPct}% Final
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, t.finalPct)}%` }}
                                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                                className="h-full rounded-full bg-gradient-to-r from-[#FF7900] to-amber-500"
                              />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                              <span>Reward: {t.rewardTitle}</span>
                              <span className="font-mono text-emerald-700 font-semibold">
                                {t.achievedFinal ? 'Achieved ✓' : `${t.provisionalPct}% Delivered`}
                              </span>
                            </div>
                          </div>
                        ))}

                        {data.announcements.slice(0, 1).map((ann) => (
                          <div
                            key={ann.id}
                            className="p-3.5 rounded-xl bg-gradient-to-r from-orange-50/80 to-amber-50/50 border border-orange-200/70 flex items-start gap-2.5"
                          >
                            <Sparkles className="w-4 h-4 text-[#FF7900] shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <div className="text-xs font-bold text-[#0B1530]">{ann.title}</div>
                              <p className="text-[11px] text-slate-600 leading-relaxed">{ann.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right: 8 Pastel-Bordered Quick Access Tiles (Exact Customer Dashboard Bottom-Right Grid!) */}
                    <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200/70 text-[#FF7900] flex items-center justify-center">
                          <Settings className="w-4 h-4" />
                        </div>
                        <div>
                          <h2 className="font-display text-sm font-bold text-[#0B1530]">
                            Partner Tools &amp; Workspace
                          </h2>
                          <p className="text-[11px] text-slate-500">
                            One-click access to links, wallet, leaderboard, credentials &amp; KYC
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {(
                          [
                            { id: 'all-links', label: 'My Links', icon: Link2, style: 'bg-violet-50/70 border-violet-200/80 text-violet-700 hover:bg-violet-100/70' },
                            { id: 'qr-codes', label: 'QR Codes', icon: QrCode, style: 'bg-rose-50/70 border-rose-200/80 text-rose-700 hover:bg-rose-100/70' },
                            { id: 'wallet', label: 'Wallet & Ledger', icon: Wallet, style: 'bg-emerald-50/70 border-emerald-200/80 text-emerald-700 hover:bg-emerald-100/70' },
                            { id: 'leaderboard', label: 'Leaderboard', icon: Trophy, style: 'bg-purple-50/70 border-purple-200/80 text-purple-700 hover:bg-purple-100/70' },
                            { id: 'certificate', label: 'Certificate', icon: BadgeCheck, style: 'bg-amber-50/70 border-amber-200/80 text-amber-700 hover:bg-amber-100/70' },
                            { id: 'id-card', label: 'Digital ID', icon: IdCard, style: 'bg-sky-50/70 border-sky-200/80 text-sky-700 hover:bg-sky-100/70' },
                            { id: 'kyc', label: 'KYC & Bank', icon: ShieldCheck, style: 'bg-teal-50/70 border-teal-200/80 text-teal-700 hover:bg-teal-100/70' },
                            { id: 'support', label: 'Help Desk', icon: HelpCircle, style: 'bg-indigo-50/70 border-indigo-200/80 text-indigo-700 hover:bg-indigo-100/70' },
                          ] as const
                        ).map((tile) => {
                          const TileIcon = tile.icon;
                          return (
                            <motion.button
                              key={tile.id}
                              type="button"
                              whileHover={{ y: -2, scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setSection(tile.id)}
                              className={`flex flex-col items-center justify-center gap-2 rounded-xl border px-2 py-4 text-center transition-colors cursor-pointer ${tile.style}`}
                            >
                              <TileIcon className="w-5 h-5" />
                              <span className="text-[11px] font-bold text-[#0B1530] leading-tight">
                                {tile.label}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

          {/* 2, 3, 4. LINKS (ALL / WEBSITE / PRODUCT) */}
          {(section === 'all-links' || section === 'website-link' || section === 'product-links') && (
            <div className="space-y-6">
              {section !== 'product-links' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <h2 className="font-display text-base font-bold text-[#071B35]">
                    Generate Website Referral Link
                  </h2>
                  <p className="text-xs text-slate-600">
                    Share your clean storefront link. Any admin-enabled product purchased within the{' '}
                    {data.settings.cookieDurationDays}-day last-click window credits your account.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={campaignTag}
                      onChange={(e) => setCampaignTag(e.target.value)}
                      placeholder="Optional campaign tag (e.g., linkedin-q4)"
                      className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 text-xs"
                    />
                    <button
                      disabled={data.partner.status !== 'active'}
                      onClick={() => handleCreateLink('website')}
                      className="px-4 py-2 rounded-lg bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                    >
                      Generate Website Link
                    </button>
                  </div>
                </div>
              )}

              {section !== 'website-link' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base font-bold text-[#071B35]">
                        Admin-Enabled Affiliate Products ({data.enabledProducts.length})
                      </h2>
                      <p className="text-xs text-slate-500">
                        Only products enabled by TeqqnoWorld Admin earn affiliate commissions.
                      </p>
                    </div>
                  </div>
                  {data.enabledProducts.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                      No products are currently enabled for affiliate commissions by Admin.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                          <tr>
                            <th className="py-2.5 px-3">Product</th>
                            <th className="py-2.5 px-3 text-right">Base Price</th>
                            <th className="py-2.5 px-3 text-right">Commission Rate</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {data.enabledProducts.map((prod) => (
                            <tr key={prod.productId} className="hover:bg-slate-50">
                              <td className="py-3 px-3 font-semibold text-[#071B35]">
                                {prod.productName}
                                {prod.campaignLabel && (
                                  <span className="ml-2 text-[10px] font-mono text-[#FF7A00]">
                                    [{prod.campaignLabel}]
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums">
                                ₹{prod.basePriceInr.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                                {prod.campaignRatePct ?? prod.commissionRatePct}%
                              </td>
                              <td className="py-3 px-3 text-right">
                                <button
                                  disabled={data.partner.status !== 'active'}
                                  onClick={() => handleCreateLink('product', prod.productId)}
                                  className="px-3 py-1.5 rounded-lg bg-[#071B35] hover:bg-[#0c294f] text-white text-[11px] font-semibold cursor-pointer disabled:opacity-50"
                                >
                                  Create Product Link
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Active Links Table */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-[#071B35]">
                  Generated Referral Links ({data.links.length})
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Target</th>
                        <th className="py-2.5 px-3">Referral URL</th>
                        <th className="py-2.5 px-3 text-right">Clicks</th>
                        <th className="py-2.5 px-3 text-right">Orders</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                        <th className="py-2.5 px-3 text-right">Copy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.links
                        .filter((l) =>
                          section === 'website-link'
                            ? l.linkType === 'website'
                            : section === 'product-links'
                            ? l.linkType === 'product'
                            : true
                        )
                        .map((link) => (
                          <tr key={link.id} className="hover:bg-slate-50">
                            <td className="py-3 px-3 font-semibold text-[#071B35]">
                              {link.productName || 'Website-Wide Storefront'}
                              {link.campaignTag && (
                                <div className="text-[10px] font-mono text-slate-400">
                                  Campaign: {link.campaignTag}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] text-slate-600 max-w-xs truncate">
                              {link.targetUrl}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">{link.clicksCount}</td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums">{link.ordersCount}</td>
                            <td className="py-3 px-3 text-right uppercase font-mono text-[11px]">
                              {link.status}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleCopy(link.targetUrl, link.id)}
                                className="px-2.5 py-1 rounded-md border border-slate-300 hover:border-[#FF7A00] text-[11px] font-semibold text-[#071B35] cursor-pointer"
                              >
                                {copiedId === link.id ? 'Copied' : 'Copy'}
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 5. QR CODES */}
          {section === 'qr-codes' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.links.map((link) => (
                <div
                  key={link.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center text-center space-y-3"
                >
                  <div className="text-xs font-bold text-[#071B35]">
                    {link.productName || 'Website Referral Link'}
                  </div>
                  {qrMap[link.id] ? (
                    <img
                      src={qrMap[link.id]}
                      alt={`QR Code for ${link.productName || 'Website'}`}
                      className="w-44 h-44 border border-slate-200 rounded-lg p-1 bg-white"
                    />
                  ) : (
                    <div className="w-44 h-44 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400">
                      Generating QR...
                    </div>
                  )}
                  <div className="text-[10px] font-mono text-slate-500 break-all">{link.targetUrl}</div>
                  {qrMap[link.id] && (
                    <a
                      href={qrMap[link.id]}
                      download={`${data.partner.affiliateId}-${link.productSlug || 'website'}-qr.png`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#071B35] text-white text-xs font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download QR PNG</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 6. PRODUCT PROMOTION HISTORY */}
          {section === 'promotion-history' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="font-display text-base font-bold text-[#071B35]">
                Product Promotion Performance
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                      <th className="py-2.5 px-3 text-right">Clicks</th>
                      <th className="py-2.5 px-3 text-right">Orders</th>
                      <th className="py-2.5 px-3 text-right">Conv. %</th>
                      <th className="py-2.5 px-3 text-right">Sales</th>
                      <th className="py-2.5 px-3 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.productPromotionHistory.map((row) => (
                      <tr key={row.productId} className="hover:bg-slate-50">
                        <td className="py-3 px-3 font-semibold text-[#071B35]">{row.productName}</td>
                        <td className="py-3 px-3 text-right font-mono">{row.commissionRatePct}%</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">{row.clicks}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">{row.orders}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">{row.conversionRatePct}%</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums">{formatInrPaisa(row.salesPaisa)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                          {formatInrPaisa(row.commissionPaisa)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 7. CLICK HISTORY */}
          {section === 'click-history' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="font-display text-base font-bold text-[#071B35]">
                Referral Click History ({data.clicks.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Date &amp; Time</th>
                      <th className="py-2.5 px-3">Landing Page</th>
                      <th className="py-2.5 px-3">Device / Browser</th>
                      <th className="py-2.5 px-3">Source / Campaign</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.clicks.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          No referral clicks recorded yet. Share your affiliate link to start tracking clicks.
                        </td>
                      </tr>
                    ) : (
                      data.clicks.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                            {new Date(c.clickedAt).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-[#071B35]">
                            {c.productName || c.landingPath}
                          </td>
                          <td className="py-2.5 px-3 capitalize text-slate-600">
                            {c.deviceType} • {c.browser}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {c.trafficSource}
                            {c.campaign ? ` / ${c.campaign}` : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 8. ORDER REFERRALS & 12. COMMISSION HISTORY */}
          {(section === 'order-referrals' || section === 'commission-history') && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-[#071B35]">
                    {section === 'order-referrals' ? 'Referred Orders (Customer-Privacy Masked)' : 'Commission Ledger & Rate Snapshots'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Calculated on GST-inclusive discounted eligible product amounts (shipping excluded). Customer personal details are strictly protected.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportCommissionsCsv}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#071B35] cursor-pointer"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={exportCommissionsPdf}
                    className="px-3 py-1.5 rounded-lg bg-[#071B35] text-white text-xs font-semibold cursor-pointer"
                  >
                    Export PDF
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Masked Order Ref</th>
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Eligible Base</th>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                      <th className="py-2.5 px-3 text-right">Commission</th>
                      <th className="py-2.5 px-3">Order Status</th>
                      <th className="py-2.5 px-3">Commission Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.commissions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          No referred orders recorded yet.
                        </td>
                      </tr>
                    ) : (
                      data.commissions.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-[11px]">{formatShortDate(c.createdAt)}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#071B35]">{c.orderNumberMasked}</td>
                          <td className="py-2.5 px-3 font-medium">{c.productName}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">{c.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {formatInrPaisa(c.gstInclusiveEligiblePaisa)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {c.commissionRatePctSnapshot}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                            {formatInrPaisa(c.commissionAmountPaisa)}
                          </td>
                          <td className="py-2.5 px-3 uppercase font-mono text-[11px]">{c.orderStatus}</td>
                          <td className="py-2.5 px-3 uppercase font-mono text-[11px] font-bold text-[#071B35]">
                            {c.status.replace(/_/g, ' ')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 9, 10, 11. ANALYTICS, SALES REPORTS & CONVERSION REPORTS */}
          {(section === 'analytics' || section === 'sales-reports' || section === 'conversion-reports') && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['live', 'daily', 'weekly', 'monthly', 'yearly', 'custom'] as AffiliateAnalyticsRange[]).map(
                    (r) => (
                      <button
                        key={r}
                        onClick={() => {
                          setRange(r);
                          if (r !== 'custom') loadDashboard(r);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                          range === r
                            ? 'bg-[#071B35] text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {r}
                      </button>
                    )
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {range === 'custom' && (
                    <>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                      <button
                        onClick={() => loadDashboard('custom', customFrom, customTo)}
                        className="px-3 py-1.5 rounded-lg bg-[#FF7A00] text-white text-xs font-semibold cursor-pointer"
                      >
                        Apply
                      </button>
                    </>
                  )}
                  <button
                    onClick={exportAnalyticsCsv}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-[#071B35] cursor-pointer"
                  >
                    Download CSV
                  </button>
                  <button
                    onClick={exportAnalyticsPdf}
                    className="px-3 py-1.5 rounded-lg bg-[#071B35] text-white text-xs font-semibold cursor-pointer"
                  >
                    Download PDF
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h2 className="font-display text-sm font-bold text-[#071B35]">
                  {section === 'sales-reports'
                    ? 'Referred Sales Trend (INR)'
                    : section === 'conversion-reports'
                    ? 'Click-to-Order Conversion Breakdown'
                    : 'Clicks & Sales Performance'}
                </h2>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2 items-end h-44 pt-4">
                  {data.analyticsSeries.slice(-12).map((pt) => {
                    const metric = section === 'sales-reports' ? pt.salesPaisa : pt.clicks;
                    const maxVal = section === 'sales-reports' ? maxSeriesSales : maxSeriesClicks;
                    const pct = Math.max(8, Math.round((metric / maxVal) * 100));
                    return (
                      <div key={pt.label} className="flex flex-col items-center gap-1 h-full justify-end">
                        <div className="text-[10px] font-mono text-slate-600">
                          {section === 'sales-reports' ? `₹${Math.round(pt.salesPaisa / 100)}` : pt.clicks}
                        </div>
                        <div
                          className="w-full rounded-t bg-[#FF7A00]"
                          style={{ height: `${pct}%` }}
                        />
                        <div className="text-[9px] text-slate-400 truncate max-w-full">{pt.label}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="overflow-x-auto pt-3">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                      <tr>
                        <th className="py-2 px-3">Period</th>
                        <th className="py-2 px-3 text-right">Clicks</th>
                        <th className="py-2 px-3 text-right">Orders</th>
                        <th className="py-2 px-3 text-right">Conv. Rate</th>
                        <th className="py-2 px-3 text-right">Referred Sales</th>
                        <th className="py-2 px-3 text-right">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.analyticsSeries.map((pt) => (
                        <tr key={pt.label}>
                          <td className="py-2 px-3 font-medium">{pt.label}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{pt.clicks}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">{pt.orders}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {pt.clicks > 0 ? `${((pt.orders / pt.clicks) * 100).toFixed(1)}%` : '0.0%'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {formatInrPaisa(pt.salesPaisa)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums">
                            {formatInrPaisa(pt.commissionPaisa)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 13. SEPARATE AFFILIATE WALLET & IMMUTABLE LEDGER */}
          {section === 'wallet' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-[11px] text-slate-500">Pending Balance</div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#071B35]">
                    {formatInrPaisa(data.wallet.pendingPaisa)}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-[11px] text-slate-500">Available to Withdraw</div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#FF7A00]">
                    {formatInrPaisa(data.wallet.availablePaisa)}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-[11px] text-slate-500">Processing Payout</div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#071B35]">
                    {formatInrPaisa(data.wallet.processingPaisa)}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-[11px] text-slate-500">Total Withdrawn</div>
                  <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700">
                    {formatInrPaisa(data.wallet.totalWithdrawnPaisa)}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-[#071B35]">
                    Immutable Financial Ledger
                  </h2>
                  <button
                    onClick={() => setSection('withdrawals')}
                    className="px-3.5 py-1.5 rounded-lg bg-[#FF7A00] text-white text-xs font-semibold cursor-pointer"
                  >
                    Request Withdrawal
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Entry Type</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-right">Bucket Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.ledger.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">
                            No wallet transactions recorded yet.
                          </td>
                        </tr>
                      ) : (
                        data.ledger.map((l) => (
                          <tr key={l.id}>
                            <td className="py-2.5 px-3 font-mono text-[11px]">{formatShortDate(l.createdAt)}</td>
                            <td className="py-2.5 px-3 uppercase font-mono text-[11px]">
                              {l.entryType.replace(/_/g, ' ')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{l.description}</td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                                l.amountPaisa >= 0 ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              {l.amountPaisa >= 0 ? '+' : ''}
                              {formatInrPaisa(l.amountPaisa)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              {formatInrPaisa(l.balanceAfterPaisa)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 14. MANUAL WITHDRAWALS */}
          {section === 'withdrawals' && (
            <div className="space-y-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#071B35]">
                      Request Bank Transfer Withdrawal
                    </h2>
                    <p className="text-xs text-slate-500">
                      Minimum withdrawal: {formatInrPaisa(data.settings.minWithdrawalPaisa)} • Target
                      processing: {data.settings.payoutProcessingDaysMin}–{data.settings.payoutProcessingDaysMax} working days (manual bank transfer).
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Available Balance</div>
                    <div className="text-lg font-bold font-mono text-[#FF7A00] tabular-nums">
                      {formatInrPaisa(data.wallet.availablePaisa)}
                    </div>
                  </div>
                </div>

                {data.kyc && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-wrap gap-4">
                    <span>
                      Verified Payout Account: <strong className="font-mono">{data.kyc.bankAccountMasked}</strong>
                    </span>
                    <span>
                      IFSC: <strong className="font-mono">{data.kyc.bankIfscCode}</strong>
                    </span>
                    <span>
                      Holder: <strong>{data.kyc.bankAccountHolderName}</strong>
                    </span>
                  </div>
                )}

                <form onSubmit={handleWithdraw} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="number"
                    min={data.settings.minWithdrawalPaisa / 100}
                    step="0.01"
                    required
                    value={withdrawAmountInr}
                    onChange={(e) => setWithdrawAmountInr(e.target.value)}
                    placeholder={`Enter amount in INR (min ₹${data.settings.minWithdrawalPaisa / 100})`}
                    className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                  <button
                    type="submit"
                    disabled={withdrawing || data.partner.status !== 'active' || data.wallet.fundsHeld}
                    className="px-5 py-2.5 rounded-lg bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {withdrawing ? 'Submitting...' : 'Submit Withdrawal Request'}
                  </button>
                </form>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="font-display text-sm font-bold text-[#071B35]">Withdrawal History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Request Code</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Bank Account</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Reference / Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.withdrawals.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500">
                            No withdrawal requests yet.
                          </td>
                        </tr>
                      ) : (
                        data.withdrawals.map((w) => (
                          <tr key={w.id}>
                            <td className="py-2.5 px-3 font-mono font-bold text-[#071B35]">{w.requestCode}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">{formatShortDate(w.requestedAt)}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold tabular-nums">
                              {formatInrPaisa(w.amountPaisa)}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {w.bankAccountMaskedSnapshot} ({w.bankIfscSnapshot})
                            </td>
                            <td className="py-2.5 px-3 uppercase font-mono text-[11px] font-bold">
                              {w.status}
                            </td>
                            <td className="py-2.5 px-3 text-slate-600">
                              {w.transferReference || w.rejectionReason || 'Pending manual bank transfer'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 15. MONTHLY TARGETS */}
          {section === 'targets' && (
            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="font-display text-base font-bold text-[#071B35]">
                  Monthly Sales Targets
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Delivered orders count provisionally; final qualification completes after the return period ends with no cancellations, refunds, or fraud holds.
                </p>
              </div>
              {data.targets.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
                  No active monthly targets configured yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.targets.map((t) => (
                    <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-mono text-[#FF7A00]">{t.monthKey}</div>
                          <h3 className="font-display text-sm font-bold text-[#071B35]">{t.title}</h3>
                        </div>
                        <span className="text-xs font-mono font-bold text-emerald-700">
                          {t.rewardTitle}
                        </span>
                      </div>
                      {t.description && <p className="text-xs text-slate-600">{t.description}</p>}
                      <div className="space-y-2 text-xs">
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-slate-500">Final Qualified Progress</span>
                            <span className="font-mono font-bold">
                              {t.metricType === 'delivered_sales_paisa'
                                ? `${formatInrPaisa(t.finalQualifiedValue)} / ${formatInrPaisa(t.targetValue)}`
                                : `${t.finalQualifiedValue} / ${t.targetValue} orders`}
                            </span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#071B35]" style={{ width: `${t.finalPct}%` }} />
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Provisional Delivered:{' '}
                          <strong className="font-mono">
                            {t.metricType === 'delivered_sales_paisa'
                              ? formatInrPaisa(t.provisionalDeliveredValue)
                              : `${t.provisionalDeliveredValue} orders`}
                          </strong>{' '}
                          ({t.provisionalPct}%)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 16. REWARDS */}
          {section === 'rewards' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="font-display text-base font-bold text-[#071B35]">
                Earned Rewards &amp; Performance Bonuses
              </h2>
              {data.rewards.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No rewards awarded yet. Achieve monthly sales targets or leaderboard ranks to earn bonuses and gifts.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Period</th>
                        <th className="py-2.5 px-3">Reward</th>
                        <th className="py-2.5 px-3 text-right">Value</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data.rewards.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 px-3 font-mono text-[11px]">{formatShortDate(r.awardedAt)}</td>
                          <td className="py-2.5 px-3 font-mono">{r.periodLabel}</td>
                          <td className="py-2.5 px-3 font-semibold text-[#071B35]">{r.rewardTitle}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {r.rewardValuePaisa > 0 ? formatInrPaisa(r.rewardValuePaisa) : 'Gift / Voucher'}
                          </td>
                          <td className="py-2.5 px-3 uppercase font-mono text-[11px]">{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 17. LEADERBOARD (MONTHLY / YEARLY / ALL-TIME, NO MEMBERSHIP TIERS) */}
          {section === 'leaderboard' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-[#071B35]">
                    Affiliate Performance Leaderboard
                  </h2>
                  <p className="text-xs text-slate-500">
                    Rankings count final qualified delivered orders after return period completion. Other partners&apos; private commissions and customer details are never exposed.
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {(['monthly', 'yearly', 'allTime'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setLbTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                        lbTab === tab ? 'bg-[#071B35] text-white' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {tab === 'allTime' ? 'All-Time' : tab === 'yearly' ? 'Yearly' : 'Monthly'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Rank</th>
                      <th className="py-2.5 px-3">Partner</th>
                      <th className="py-2.5 px-3">Affiliate ID</th>
                      <th className="py-2.5 px-3 text-right">Qualified Orders</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.leaderboards[lbTab].length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          No qualified leaderboard rankings for this period yet.
                        </td>
                      </tr>
                    ) : (
                      data.leaderboards[lbTab].map((row) => (
                        <tr
                          key={row.affiliateId}
                          className={row.isCurrentPartner ? 'bg-orange-50/70 font-bold' : ''}
                        >
                          <td className="py-2.5 px-3 font-mono font-bold text-[#FF7A00]">#{row.rank}</td>
                          <td className="py-2.5 px-3 text-[#071B35]">
                            {row.partnerDisplayName} {row.isCurrentPartner ? '(You)' : ''}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{row.affiliateId}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {row.qualifiedOrdersCount}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 18. OFFICIAL AFFILIATE CERTIFICATE */}
          {section === 'certificate' && (
            <div className="space-y-4">
              <div className="bg-white border-4 border-[#071B35] rounded-2xl p-6 sm:p-10 text-center space-y-5 relative overflow-hidden">
                <div className="border-2 border-[#FF7A00] rounded-xl p-6 sm:p-8 space-y-4">
                  <div className="font-display text-2xl font-extrabold text-[#071B35]">
                    Teqqno<span className="text-[#FF7A00]">World</span>
                  </div>
                  <div className="text-xs font-mono uppercase tracking-[0.2em] text-[#FF7A00] font-bold">
                    Official Affiliate Partner Certificate
                  </div>
                  <p className="text-xs text-slate-500">This certifies that</p>
                  <div className="font-display text-2xl sm:text-3xl font-bold text-[#071B35]">
                    {data.partner.fullName}
                  </div>
                  <p className="text-xs text-slate-600 max-w-lg mx-auto">
                    is a verified official partner of the TeqqnoWorld Affiliate Partner Program.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
                    <div className="text-left text-xs space-y-1.5 font-mono bg-slate-50 border border-slate-200 rounded-xl p-4">
                      <div>Affiliate ID: <strong className="text-[#071B35]">{data.partner.affiliateId}</strong></div>
                      <div>Certificate No: <strong className="text-[#071B35]">{data.partner.certificateNumber}</strong></div>
                      <div>Joined: <strong>{formatShortDate(data.partner.joinedAt)}</strong></div>
                      <div>Status: <strong className="uppercase">{data.partner.status}</strong></div>
                    </div>
                    {verifyQrUrl && (
                      <div className="flex flex-col items-center gap-1">
                        <img src={verifyQrUrl} alt="Certificate Verification QR" className="w-28 h-28 border border-slate-200 rounded-lg p-1" />
                        <span className="text-[10px] font-mono text-slate-500">Scan to verify status</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() =>
                    downloadAffiliateCertificatePdf(data.partner, data.settings.officialDomain)
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Certificate PDF</span>
                </button>
                <a
                  href={`/affiliate/verify/${encodeURIComponent(data.partner.verificationCode)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(`/affiliate/verify/${data.partner.verificationCode}`);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-[#071B35]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Public Verification Page</span>
                </a>
              </div>
            </div>
          )}

          {/* 19. DIGITAL ID CARD */}
          {section === 'id-card' && (
            <div className="space-y-5 max-w-xl">
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-[#071B35] px-5 py-4 border-b-4 border-[#FF7A00] flex items-center justify-between text-white">
                  <div>
                    <div className="font-display text-lg font-extrabold">
                      Teqqno<span className="text-[#FF7A00]">World</span>
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-slate-300">
                      Official Affiliate Partner ID Card
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold uppercase ${
                      data.partner.status === 'active'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {data.partner.status}
                  </span>
                </div>

                <div className="p-5 flex flex-col sm:flex-row items-center gap-5">
                  {data.partner.avatarUrl ? (
                    <img
                      src={data.partner.avatarUrl}
                      alt={data.partner.fullName}
                      className="w-24 h-28 object-cover rounded-xl border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-28 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-display text-2xl font-bold text-[#071B35] shrink-0">
                      {data.partner.firstName.slice(0, 1)}
                      {data.partner.lastName.slice(0, 1)}
                    </div>
                  )}

                  <div className="flex-1 space-y-1 text-center sm:text-left">
                    <div className="font-display text-lg font-bold text-[#071B35]">
                      {data.partner.fullName}
                    </div>
                    <div className="text-xs text-slate-500">Affiliate Partner</div>
                    <div className="text-xs font-mono font-bold text-[#FF7A00]">
                      {data.partner.affiliateId}
                    </div>
                    <div className="text-[11px] font-mono text-slate-600">
                      Card: {data.partner.cardNumber}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Joined: {formatShortDate(data.partner.joinedAt)}
                    </div>
                  </div>

                  {verifyQrUrl && (
                    <img
                      src={verifyQrUrl}
                      alt="ID Card QR Verification"
                      className="w-24 h-24 border border-slate-200 rounded-lg p-1 shrink-0"
                    />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:border-[#FF7A00] text-xs font-semibold text-[#071B35] cursor-pointer">
                  <Upload className="w-4 h-4 text-[#FF7A00]" />
                  <span>Upload Partner Photo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleUploadCardPhoto(e.target.files?.[0] || null)}
                  />
                </label>
                <button
                  onClick={() =>
                    downloadAffiliateIdCardPdf(data.partner, data.settings.officialDomain)
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#071B35] hover:bg-[#0d2c54] text-white text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Digital ID Card PDF</span>
                </button>
              </div>
            </div>
          )}

          {/* 20. PROFILE & 21. KYC INFORMATION */}
          {(section === 'profile' || section === 'kyc') && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-2xl">
              <h2 className="font-display text-base font-bold text-[#071B35]">
                {section === 'profile' ? 'Affiliate Partner Profile' : 'Masked KYC & Verified Bank Details'}
              </h2>
              {section === 'profile' ? (
                <dl className="divide-y divide-slate-200 text-xs">
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">Affiliate ID (Non-Editable)</dt>
                    <dd className="font-mono font-bold text-[#071B35]">{data.partner.affiliateId}</dd>
                  </div>
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">Partner Name</dt>
                    <dd className="font-semibold">{data.partner.fullName}</dd>
                  </div>
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">Verified Email</dt>
                    <dd className="font-mono">{data.partner.customerEmail}</dd>
                  </div>
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">Mobile</dt>
                    <dd className="font-mono">+91 {data.partner.mobile}</dd>
                  </div>
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">Joining Date</dt>
                    <dd className="font-mono">{formatShortDate(data.partner.joinedAt)}</dd>
                  </div>
                </dl>
              ) : data.kyc ? (
                <dl className="divide-y divide-slate-200 text-xs">
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">Masked Aadhaar</dt>
                    <dd className="font-mono font-bold">{data.kyc.aadhaarMasked}</dd>
                  </div>
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">Masked PAN</dt>
                    <dd className="font-mono font-bold">{data.kyc.panMasked}</dd>
                  </div>
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">KYC Status</dt>
                    <dd className="uppercase font-mono font-bold text-emerald-700">{data.kyc.kycStatus}</dd>
                  </div>
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">Bank Account Holder</dt>
                    <dd className="font-semibold">{data.kyc.bankAccountHolderName}</dd>
                  </div>
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">Masked Bank Account</dt>
                    <dd className="font-mono font-bold">{data.kyc.bankAccountMasked}</dd>
                  </div>
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">IFSC Code</dt>
                    <dd className="font-mono">{data.kyc.bankIfscCode}</dd>
                  </div>
                  <div className="py-3 flex justify-between">
                    <dt className="text-slate-500">Bank Verification Status</dt>
                    <dd className="uppercase font-mono font-bold text-emerald-700">
                      {data.kyc.bankVerificationStatus}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-xs text-slate-500">No KYC record linked.</p>
              )}
            </div>
          )}

          {/* 22. NOTIFICATIONS */}
          {section === 'notifications' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[#071B35]">
                  Notification Center ({data.kpis.unreadNotifications} Unread)
                </h2>
                <button
                  onClick={async () => {
                    if (isDemoMode) {
                      setData((prev) =>
                        prev
                          ? {
                              ...prev,
                              notifications: prev.notifications.map((item) => ({
                                ...item,
                                isRead: true,
                              })),
                              kpis: { ...prev.kpis, unreadNotifications: 0 },
                            }
                          : prev
                      );
                      showToast('All demo notifications marked read');
                      return;
                    }
                    if (!user?.email) return;
                    await markAffiliateNotificationRead(user.email, 'all');
                    loadDashboard();
                  }}
                  className="text-xs font-semibold text-[#FF7A00] hover:underline cursor-pointer"
                >
                  Mark All Read
                </button>
              </div>
              <div className="divide-y divide-slate-200">
                {data.notifications.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">No notifications yet.</p>
                ) : (
                  data.notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`py-3 flex items-start justify-between gap-4 ${
                        n.isRead ? 'opacity-75' : ''
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-[#071B35]">{n.title}</div>
                        <p className="text-xs text-slate-600">{n.message}</p>
                        <div className="text-[10px] font-mono text-slate-400">
                          {new Date(n.createdAt).toLocaleString('en-IN')}
                        </div>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={async () => {
                            if (isDemoMode) {
                              setData((prev) => {
                                if (!prev) return prev;
                                const updated = prev.notifications.map((item) =>
                                  item.id === n.id ? { ...item, isRead: true } : item
                                );
                                return {
                                  ...prev,
                                  notifications: updated,
                                  kpis: {
                                    ...prev.kpis,
                                    unreadNotifications: updated.filter((item) => !item.isRead).length,
                                  },
                                };
                              });
                              return;
                            }
                            if (!user?.email) return;
                            await markAffiliateNotificationRead(user.email, n.id);
                            loadDashboard();
                          }}
                          className="text-[11px] font-semibold text-[#071B35] hover:text-[#FF7A00] shrink-0 cursor-pointer"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 23. SUPPORT TICKETS */}
          {section === 'support' && (
            <div className="space-y-5">
              <form
                onSubmit={handleCreateTicket}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
                <h2 className="font-display text-base font-bold text-[#071B35]">
                  Open Affiliate Support Ticket
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="Ticket subject"
                    className="sm:col-span-2 px-3.5 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value)}
                    className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="payouts">Payouts &amp; Withdrawals</option>
                    <option value="commissions">Commissions &amp; Attribution</option>
                    <option value="kyc">KYC &amp; Bank</option>
                    <option value="general">General Support</option>
                  </select>
                </div>
                <textarea
                  required
                  rows={3}
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Describe your question or issue clearly..."
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#071B35] text-white text-xs font-semibold cursor-pointer"
                >
                  Submit Ticket
                </button>
              </form>

              <div className="space-y-3">
                {data.tickets.map((t) => (
                  <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-[11px] text-[#FF7A00] font-bold">
                          {t.ticketNumber}
                        </span>
                        <h3 className="text-sm font-bold text-[#071B35]">{t.subject}</h3>
                      </div>
                      <span className="uppercase font-mono text-[11px] font-bold text-slate-600">
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="space-y-2 border-t border-slate-100 pt-2">
                      {t.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`p-2.5 rounded-lg text-xs ${
                            m.senderRole === 'admin'
                              ? 'bg-slate-100 text-[#071B35]'
                              : 'bg-orange-50/60 text-slate-800'
                          }`}
                        >
                          <div className="font-bold text-[11px]">{m.senderName}</div>
                          <p className="mt-0.5">{m.message}</p>
                        </div>
                      ))}
                    </div>
                    {t.status !== 'closed' && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={replyTextMap[t.id] || ''}
                          onChange={(e) =>
                            setReplyTextMap((prev) => ({ ...prev, [t.id]: e.target.value }))
                          }
                          placeholder="Write a reply..."
                          className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                        <button
                          onClick={() => handleReplyTicket(t.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-[#071B35] text-white text-xs font-semibold cursor-pointer"
                        >
                          Reply
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 24. SETTINGS (REACTIVATION & ACCOUNT CLOSURE) */}
          {section === 'settings' && (
            <div className="space-y-5 max-w-2xl">
              {data.partner.status === 'suspended' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h2 className="font-display text-base font-bold text-[#071B35]">
                    Request Account Reactivation
                  </h2>
                  <p className="text-xs text-slate-600">
                    Explain the corrective actions taken. TeqqnoWorld Admin will review your account and held commissions.
                  </p>
                  <textarea
                    rows={3}
                    value={reactivationReason}
                    onChange={(e) => setReactivationReason(e.target.value)}
                    placeholder="Provide details for reactivation review..."
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                  <button
                    onClick={async () => {
                      if (isDemoMode) {
                        showToast('Demo Preview Mode is read-only.', 'error');
                        return;
                      }
                      if (!user?.email) return;
                      try {
                        await submitAffiliateReactivationRequest(user.email, reactivationReason);
                        setReactivationReason('');
                        showToast('Reactivation request submitted');
                        loadDashboard();
                      } catch (err: any) {
                        showToast(err?.message || 'Submission failed', 'error');
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-[#FF7A00] text-white text-xs font-semibold cursor-pointer"
                  >
                    Submit Reactivation Request
                  </button>
                </div>
              )}

              {data.partner.status !== 'closed' && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                  <h2 className="font-display text-base font-bold text-red-700">
                    Request Affiliate Account Closure
                  </h2>
                  <p className="text-xs text-slate-600">
                    Upon admin approval, eligible Available balance will be settled, unpaid Pending
                    commissions will be cancelled, all referral links will be permanently disabled,
                    and your public QR verification status will show Closed.
                  </p>
                  <textarea
                    rows={3}
                    value={closureReason}
                    onChange={(e) => setClosureReason(e.target.value)}
                    placeholder="Reason for closing your affiliate partner account..."
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                  <button
                    onClick={async () => {
                      if (isDemoMode) {
                        showToast('Demo Preview Mode is read-only.', 'error');
                        return;
                      }
                      if (!user?.email) return;
                      try {
                        await submitAffiliateClosureRequest(user.email, closureReason);
                        setClosureReason('');
                        showToast('Closure request submitted for admin settlement');
                        loadDashboard();
                      } catch (err: any) {
                        showToast(err?.message || 'Submission failed', 'error');
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    Submit Closure Request
                  </button>
                </div>
              )}
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* MOBILE APP-LIKE FIXED BOTTOM NAVIGATION */}
      <nav
        aria-label="Mobile Affiliate Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B1530] text-white border-t border-white/10 grid grid-cols-5 h-16 px-1 shadow-2xl"
      >
        {(
          [
            { id: 'overview', label: 'Home', icon: LayoutDashboard },
            { id: 'all-links', label: 'Links', icon: Link2 },
            { id: 'analytics', label: 'Stats', icon: BarChart3 },
            { id: 'wallet', label: 'Wallet', icon: Wallet },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = section === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSection(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium cursor-pointer transition-colors ${
                active ? 'text-[#FF7900] font-semibold' : 'text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-slate-300 cursor-pointer"
        >
          <Menu className="w-4 h-4" />
          <span>More</span>
        </button>
      </nav>

      {/* ANIMATED MOBILE FULL SECTION DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
            onClick={() => setMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="w-72 max-w-[85vw] bg-[#0B1530] text-white h-full overflow-y-auto p-4 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <div className="text-sm font-bold">{data.partner.fullName}</div>
                  <div className="text-[11px] font-mono text-[#FF7900]">{data.partner.affiliateId}</div>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {NAV_GROUPS.map((group) => (
                <div key={group.title} className="space-y-1">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                    {group.title}
                  </div>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSection(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                          section === item.id
                            ? 'bg-[#FF7900] text-white font-semibold'
                            : 'text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
