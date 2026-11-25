import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  EyeOff,
  Film,
  Flag,
  History,
  Loader2,
  MessageSquareReply,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  StickyNote,
  ThumbsUp,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { PRODUCTS } from '../../data/mockData';
import {
  ProductReview,
  ReviewModerationMode,
  ReviewModerationStatus,
  ReviewReportReason,
  ReviewSystemSettings,
} from '../../types';
import {
  adminDeleteReview,
  adminModerateReview,
  adminUpdateReviewSettings,
  AdminReviewsResponse,
  fetchAdminReviews,
  ReviewGalleryPhoto,
} from '../../services/reviewsService';
import { useReviewSummaries } from '../../context/ReviewSummaryContext';
import { StarRatingDisplay } from '../reviews/StarRating';
import { ReviewPhotoLightbox } from '../reviews/ReviewPhotoLightbox';

interface AdminReviewsPanelProps {
  onPendingCountChange?: (count: number) => void;
  onToast?: (type: 'success' | 'error', message: string) => void;
  onSessionExpired?: () => void;
}

type AdminReviewStatusFilter = 'all' | ReviewModerationStatus | 'reported';
type AdminDateRangeFilter = 'all' | '7d' | '30d' | '90d';

const STATUS_TABS: Array<{ id: AdminReviewStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Published' },
  { id: 'hidden', label: 'Hidden' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'reported', label: 'Reported' },
];

const CATEGORY_LABELS: Array<{
  key: keyof ProductReview['categoryRatings'];
  label: string;
}> = [
  { key: 'productQuality', label: 'Product' },
  { key: 'printQuality', label: 'Print' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'valueForMoney', label: 'Value' },
  { key: 'overallExperience', label: 'Overall' },
];

const REPORT_REASONS: Array<{ id: ReviewReportReason; label: string }> = [
  { id: 'spam', label: 'Spam / Promo' },
  { id: 'inappropriate', label: 'Inappropriate / Abusive' },
  { id: 'misleading', label: 'Misleading / Suspected Fake' },
  { id: 'off_topic', label: 'Off-Topic' },
];

function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusBadge(status: ReviewModerationStatus): {
  label: string;
  classes: string;
} {
  switch (status) {
    case 'approved':
      return {
        label: 'Published',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'pending':
      return {
        label: 'Pending',
        classes: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'hidden':
      return {
        label: 'Hidden',
        classes: 'bg-slate-100 text-slate-700 border-slate-300',
      };
    case 'rejected':
    default:
      return {
        label: 'Rejected',
        classes: 'bg-rose-50 text-rose-700 border-rose-200',
      };
  }
}

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '').replace(/\r?\n/g, ' ');
  return `"${str.replace(/"/g, '""')}"`;
}

export const AdminReviewsPanel: React.FC<AdminReviewsPanelProps> = ({
  onPendingCountChange,
  onToast,
  onSessionExpired,
}) => {
  const { refreshSummaries } = useReviewSummaries();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<AdminReviewsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<AdminReviewStatusFilter>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [ratingFilter, setRatingFilter] = useState<number>(0);
  const [dateRangeFilter, setDateRangeFilter] = useState<AdminDateRangeFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Per-card interactive state
  const [busyReviewId, setBusyReviewId] = useState<string | null>(null);
  const [replyOpenId, setReplyOpenId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<string>('');
  const [noteOpenId, setNoteOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [flagMenuId, setFlagMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Settings drawer
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [settingsDraft, setSettingsDraft] = useState<{
    moderationMode: ReviewModerationMode;
    allowGuestReviews: boolean;
    allowCustomerEdits: boolean;
  }>({
    moderationMode: 'auto_verified',
    allowGuestReviews: true,
    allowCustomerEdits: true,
  });
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Lightbox state
  const [lightboxState, setLightboxState] = useState<{
    photos: ReviewGalleryPhoto[];
    index: number;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 260);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminReviews({
        status: statusFilter,
        productId: productFilter,
        rating: ratingFilter > 0 ? ratingFilter : undefined,
        dateRange: dateRangeFilter,
        search: debouncedSearch || undefined,
      });

      if (res.unauthorized) {
        onToast?.('error', 'Admin session expired. Please sign in again.');
        onSessionExpired?.();
        return;
      }

      if (!res.success) {
        setError(res.message || 'Could not load reviews.');
        return;
      }

      setData(res);
      onPendingCountChange?.(res.kpis.pendingCount);
      if (res.settings) {
        setSettingsDraft({
          moderationMode: res.settings.moderationMode,
          allowGuestReviews: res.settings.allowGuestReviews,
          allowCustomerEdits: res.settings.allowCustomerEdits,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reviews.');
    } finally {
      setLoading(false);
    }
  }, [
    statusFilter,
    productFilter,
    ratingFilter,
    dateRangeFilter,
    debouncedSearch,
    onPendingCountChange,
    onSessionExpired,
    onToast,
  ]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const handleModerate = async (
    reviewId: string,
    patch: Parameters<typeof adminModerateReview>[1],
    successToast: string
  ) => {
    setBusyReviewId(reviewId);
    try {
      const res = await adminModerateReview(reviewId, patch);
      if (!res.success) {
        onToast?.('error', res.message || 'Moderation action failed.');
        return;
      }
      onToast?.('success', successToast);
      setReplyOpenId((prev) => (prev === reviewId && patch.adminReply !== undefined ? null : prev));
      setNoteOpenId((prev) => (prev === reviewId && patch.moderationNote !== undefined ? null : prev));
      setFlagMenuId((prev) => (prev === reviewId ? null : prev));
      await Promise.all([loadReviews(), refreshSummaries()]);
    } finally {
      setBusyReviewId(null);
    }
  };

  const handleDelete = async (reviewId: string) => {
    setBusyReviewId(reviewId);
    try {
      const res = await adminDeleteReview(reviewId);
      if (!res.success) {
        onToast?.('error', res.message || 'Could not delete review.');
        return;
      }
      setConfirmDeleteId(null);
      onToast?.('success', 'Review permanently removed.');
      await Promise.all([loadReviews(), refreshSummaries()]);
    } finally {
      setBusyReviewId(null);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await adminUpdateReviewSettings(settingsDraft);
      if (!res.success) {
        onToast?.('error', res.message || 'Failed to save review policy.');
        return;
      }
      onToast?.('success', 'Review moderation settings updated.');
      setSettingsOpen(false);
      await loadReviews();
    } finally {
      setSavingSettings(false);
    }
  };

  const handleExportCsv = () => {
    const reviews = data?.reviews || [];
    if (reviews.length === 0) {
      onToast?.('error', 'No reviews in the current view to export.');
      return;
    }
    const headers = [
      'Review ID',
      'Date',
      'Status',
      'Verified Purchase',
      'Order Ref',
      'Product ID',
      'Product Name',
      'Customer Name',
      'Customer Email',
      'Company',
      'Overall Rating',
      'Product Quality',
      'Print Quality',
      'Packaging',
      'Value for Money',
      'Overall Experience',
      'Would Recommend',
      'Title',
      'Review Comment',
      'Helpful Votes',
      'Reports',
      'Admin Reply',
      'Internal Note',
    ];
    const rows = reviews.map((r) => [
      r.id,
      r.createdAt,
      r.status,
      r.verifiedPurchase ? 'Verified' : 'Unverified',
      r.orderNumber || '',
      r.productId,
      r.productName,
      r.customerName,
      r.customerEmail,
      r.companyName || '',
      r.rating,
      r.categoryRatings?.productQuality ?? r.rating,
      r.categoryRatings?.printQuality ?? r.rating,
      r.categoryRatings?.packaging ?? r.rating,
      r.categoryRatings?.valueForMoney ?? r.rating,
      r.categoryRatings?.overallExperience ?? r.rating,
      r.wouldRecommend ? 'Yes' : 'No',
      r.title,
      r.comment,
      r.helpfulCount,
      r.reportCount,
      r.adminReply || '',
      r.moderationNote || '',
    ]);

    const csv = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((row) => row.map(escapeCsvCell).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `teqqnoworld-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onToast?.('success', `Exported ${reviews.length} review${reviews.length === 1 ? '' : 's'} to CSV.`);
  };

  const openReviewMediaLightbox = (review: ProductReview, startIndex: number) => {
    const mediaList: ReviewGalleryPhoto[] =
      review.media && review.media.length > 0
        ? review.media.map((m) => ({
            id: m.id,
            type: m.type,
            photoUrl: m.url,
            reviewId: review.id,
            customerName: review.customerName,
            rating: review.rating,
            title: review.title,
            variantSummary: review.variantSummary,
            verifiedPurchase: review.verifiedPurchase,
            createdAt: review.createdAt,
          }))
        : [
            ...(review.photos || []).map((url, idx) => ({
              id: `img-${idx}`,
              type: 'image' as const,
              photoUrl: url,
              reviewId: review.id,
              customerName: review.customerName,
              rating: review.rating,
              title: review.title,
              variantSummary: review.variantSummary,
              verifiedPurchase: review.verifiedPurchase,
              createdAt: review.createdAt,
            })),
            ...(review.videos || []).map((url, idx) => ({
              id: `vid-${idx}`,
              type: 'video' as const,
              photoUrl: url,
              reviewId: review.id,
              customerName: review.customerName,
              rating: review.rating,
              title: review.title,
              variantSummary: review.variantSummary,
              verifiedPurchase: review.verifiedPurchase,
              createdAt: review.createdAt,
            })),
          ];

    if (mediaList.length > 0) {
      setLightboxState({ photos: mediaList, index: startIndex });
    }
  };

  const kpis = data?.kpis || {
    totalReviews: 0,
    approvedCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    hiddenCount: 0,
    reportedCount: 0,
    averageStoreRating: 0,
  };
  const reviews = data?.reviews || [];
  const ratingTrends = data?.ratingTrends || [];
  const productSummaries = data?.productSummaries || [];
  const maxTrendCount = useMemo(
    () => Math.max(1, ...ratingTrends.map((t) => t.count)),
    [ratingTrends]
  );

  const statusTabCount = (id: AdminReviewStatusFilter): number => {
    switch (id) {
      case 'all':
        return kpis.totalReviews;
      case 'pending':
        return kpis.pendingCount;
      case 'approved':
        return kpis.approvedCount;
      case 'hidden':
        return kpis.hiddenCount;
      case 'rejected':
        return kpis.rejectedCount;
      case 'reported':
        return kpis.reportedCount;
      default:
        return 0;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#071B35] tracking-tight">
            Product Reviews &amp; Ratings
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Moderate customer reviews, verify purchases, respond publicly, and monitor per-product rating health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              settingsOpen
                ? 'bg-[#071B35] text-white border-[#071B35]'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Moderation Policy
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void loadReviews()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#FF7900] text-white hover:bg-[#e56d00] transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Total Reviews</span>
            <MessageSquareReply className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[#071B35] tabular-nums">
              {kpis.totalReviews}
            </span>
            <span className="text-xs text-emerald-700 font-medium tabular-nums">
              {kpis.approvedCount} live
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Published Avg Rating</span>
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[#071B35] tabular-nums">
              {kpis.approvedCount > 0 ? kpis.averageStoreRating.toFixed(1) : '—'}
            </span>
            <span className="text-xs text-slate-500">
              {kpis.approvedCount > 0 ? 'out of 5.0' : 'No published reviews'}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setStatusFilter('pending')}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-colors cursor-pointer ${
            kpis.pendingCount > 0
              ? 'bg-amber-50/70 border-amber-200 hover:bg-amber-50'
              : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Pending Moderation</span>
            <Clock className={`w-4 h-4 ${kpis.pendingCount > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[#071B35] tabular-nums">
              {kpis.pendingCount}
            </span>
            <span className="text-xs text-amber-800 font-medium">
              {kpis.pendingCount > 0 ? 'Awaiting approval' : 'All caught up'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter('reported')}
          className={`text-left rounded-2xl border p-4 shadow-2xs transition-colors cursor-pointer ${
            kpis.reportedCount > 0
              ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-50'
              : 'bg-white border-slate-200/80 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
            <span>Reported / Flagged</span>
            <Flag className={`w-4 h-4 ${kpis.reportedCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-[#071B35] tabular-nums">
              {kpis.reportedCount}
            </span>
            <span className="text-xs text-slate-500">
              {kpis.hiddenCount > 0 ? `${kpis.hiddenCount} hidden` : 'Review queue'}
            </span>
          </div>
        </button>
      </div>

      {/* Collapsible Moderation Policy Settings */}
      {settingsOpen && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-display font-bold text-sm text-[#071B35]">
                Storefront Review &amp; Moderation Policy
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Control whether new reviews publish automatically or require manual approval.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Close moderation policy"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(
              [
                {
                  id: 'auto_verified' as ReviewModerationMode,
                  title: 'Auto-Publish Verified Buyers',
                  desc: 'Delivered order reviews publish right away; unverified submissions enter pending review.',
                },
                {
                  id: 'manual_all' as ReviewModerationMode,
                  title: 'Manual Approval for All',
                  desc: 'Every review (verified or unverified) waits in the Pending queue until approved by admin.',
                },
                {
                  id: 'auto_all' as ReviewModerationMode,
                  title: 'Auto-Publish All Reviews',
                  desc: 'All valid reviews go live immediately; admins can hide, reject, or delete anytime.',
                },
              ]
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() =>
                  setSettingsDraft((prev) => ({ ...prev, moderationMode: mode.id }))
                }
                className={`text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                  settingsDraft.moderationMode === mode.id
                    ? 'border-[#FF7900] bg-orange-50/50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#071B35]">{mode.title}</span>
                  {settingsDraft.moderationMode === mode.id && (
                    <CheckCircle2 className="w-4 h-4 text-[#FF7900] shrink-0" />
                  )}
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{mode.desc}</p>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-5">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsDraft.allowGuestReviews}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      allowGuestReviews: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-300 text-[#FF7900] focus:ring-[#FF7900]"
                />
                Allow guest reviews (labeled Unverified unless email matches delivered order)
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settingsDraft.allowCustomerEdits}
                  onChange={(e) =>
                    setSettingsDraft((prev) => ({
                      ...prev,
                      allowCustomerEdits: e.target.checked,
                    }))
                  }
                  className="rounded border-slate-300 text-[#FF7900] focus:ring-[#FF7900]"
                />
                Allow customers to edit their submitted reviews
              </label>
            </div>

            <button
              type="button"
              onClick={() => void handleSaveSettings()}
              disabled={savingSettings}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#071B35] text-white hover:bg-[#0d2a4d] transition-colors cursor-pointer disabled:opacity-60 shrink-0"
            >
              {savingSettings ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Save Policy
            </button>
          </div>
        </div>
      )}

      {/* 14-Day Trend & Per-Product Rating Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 14-Day Trend Chart */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#FF7900]" />
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-700">
                14-Day Review Trend
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Daily submissions</span>
          </div>

          <div className="h-28 flex items-end gap-1.5 pt-2">
            {ratingTrends.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                No recent submissions
              </div>
            ) : (
              ratingTrends.map((point) => {
                const heightPct = point.count > 0 ? Math.max(16, Math.round((point.count / maxTrendCount) * 100)) : 6;
                return (
                  <div
                    key={point.date}
                    className="flex-1 flex flex-col items-center gap-1 group"
                    title={`${point.label}: ${point.count} review${point.count === 1 ? '' : 's'}${
                      point.avgRating > 0 ? ` · ${point.avgRating.toFixed(1)}★ avg` : ''
                    }`}
                  >
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          point.count > 0
                            ? 'bg-[#FF7900] group-hover:bg-[#071B35]'
                            : 'bg-slate-100'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-400 tabular-nums truncate w-full text-center">
                      {point.label.split(' ')[0]}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Per-Product Rating Summary */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-slate-700">
              Per-Product Rating Isolation
            </h3>
            {productFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setProductFilter('all')}
                className="text-[11px] font-semibold text-[#FF7900] hover:underline cursor-pointer"
              >
                Show All Products
              </button>
            )}
          </div>

          {productSummaries.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No product reviews have been submitted yet. Ratings are calculated individually per product ID.
            </p>
          ) : (
            <div className="overflow-x-auto max-h-32 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                    <th className="py-1.5 pr-3 font-semibold">Product</th>
                    <th className="py-1.5 px-2 font-semibold text-right">Avg</th>
                    <th className="py-1.5 px-2 font-semibold text-right">Published</th>
                    <th className="py-1.5 pl-2 font-semibold text-right">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {productSummaries.map((ps) => {
                    const isSelected = productFilter === ps.productId;
                    return (
                      <tr
                        key={ps.productId}
                        onClick={() =>
                          setProductFilter(isSelected ? 'all' : ps.productId)
                        }
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-orange-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2 pr-3 font-medium text-[#071B35] truncate max-w-[220px]">
                          {ps.productName}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold tabular-nums text-slate-800">
                          {ps.totalReviews > 0 ? `${ps.averageRating.toFixed(1)}★` : '—'}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-slate-600">
                          {ps.totalReviews}
                        </td>
                        <td className="py-2 pl-2 text-right tabular-nums">
                          {ps.pendingCount > 0 ? (
                            <span className="font-semibold text-amber-700">{ps.pendingCount}</span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => {
            const count = statusTabCount(tab.id);
            const active = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#071B35] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                    active ? 'bg-white/20 text-white' : 'bg-white text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search + Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
          <div className="lg:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer, product, title, or review ID..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-[#FF7900] text-slate-800 placeholder:text-slate-400"
            />
          </div>

          <div className="lg:col-span-3">
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              aria-label="Filter by product"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#FF7900]"
            >
              <option value="all">All Products</option>
              {PRODUCTS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name.split('–')[0].split('|')[0].trim()}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(Number(e.target.value))}
              aria-label="Filter by star rating"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#FF7900]"
            >
              <option value={0}>All Ratings</option>
              <option value={5}>5 Stars</option>
              <option value={4}>4 Stars</option>
              <option value={3}>3 Stars</option>
              <option value={2}>2 Stars</option>
              <option value={1}>1 Star</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={dateRangeFilter}
              onChange={(e) => setDateRangeFilter(e.target.value as AdminDateRangeFilter)}
              aria-label="Filter by date range"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#FF7900]"
            >
              <option value="all">All Time</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => void loadReviews()}
            className="text-xs font-semibold text-rose-800 underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Review Moderation List */}
      {loading && !data ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-[#FF7900]" />
          <p className="text-xs font-medium">Loading customer reviews…</p>
        </div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Star className="w-6 h-6" />
          </div>
          <h3 className="font-display font-bold text-base text-[#071B35]">
            No matching reviews
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {kpis.totalReviews === 0
              ? 'No customer reviews have been submitted yet. Verified and customer reviews will appear here as soon as shoppers submit them on product pages.'
              : 'Try clearing one of your active filters or search query to inspect other reviews.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const statusMeta = getStatusBadge(review.status);
            const isBusy = busyReviewId === review.id;
            const mediaItems =
              review.media && review.media.length > 0
                ? review.media
                : [
                    ...(review.photos || []).map((url, idx) => ({
                      id: `p-${idx}`,
                      type: 'image' as const,
                      url,
                      mimeType: 'image/jpeg',
                      sizeBytes: 0,
                    })),
                    ...(review.videos || []).map((url, idx) => ({
                      id: `v-${idx}`,
                      type: 'video' as const,
                      url,
                      mimeType: 'video/mp4',
                      sizeBytes: 0,
                    })),
                  ];

            return (
              <article
                key={review.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4"
              >
                {/* Top Meta Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-bold text-sm text-[#071B35]">
                        {review.customerName}
                      </span>
                      {review.companyName && (
                        <span className="text-xs text-slate-500">· {review.companyName}</span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">{review.customerEmail}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">{review.productName}</span>
                      {review.variantSummary && (
                        <span className="text-slate-500">({review.variantSummary})</span>
                      )}
                      <span>·</span>
                      <span className="font-mono text-[11px]">{review.id}</span>
                      <span>·</span>
                      <span>{formatDateTime(review.createdAt)}</span>
                    </div>
                  </div>

                  {/* Status + Verification Signals */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {review.verifiedPurchase ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Verified Purchase
                        {review.orderNumber ? ` (#${review.orderNumber})` : ''}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                        Unverified Review
                      </span>
                    )}

                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${statusMeta.classes}`}
                    >
                      {statusMeta.label}
                    </span>

                    {review.isFeatured && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF7900]">
                        <Sparkles className="w-3.5 h-3.5" />
                        Featured
                      </span>
                    )}
                  </div>
                </div>

                {/* Reported Warning Banner */}
                {review.reportCount > 0 && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-rose-800">
                      <Flag className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>
                        <strong>
                          {review.reportCount} report{review.reportCount === 1 ? '' : 's'}
                        </strong>
                        {review.reportReasons && review.reportReasons.length > 0
                          ? ` — ${review.reportReasons.join(', ')}`
                          : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void handleModerate(
                          review.id,
                          { clearReports: true },
                          'Report flags cleared.'
                        )
                      }
                      className="text-xs font-semibold text-rose-800 hover:underline cursor-pointer self-start sm:self-auto"
                    >
                      Clear Reports
                    </button>
                  </div>
                )}

                {/* Rating + Content */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <StarRatingDisplay rating={review.rating} size="sm" />
                    <span className="text-xs font-bold text-[#071B35] tabular-nums">
                      {review.rating}.0 / 5
                    </span>
                    <span className="text-xs text-slate-500">
                      {review.wouldRecommend
                        ? 'Recommends this product'
                        : 'Does not recommend'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <ThumbsUp className="w-3 h-3" />
                      {review.helpfulCount} helpful
                    </span>
                  </div>

                  <h4 className="font-display font-bold text-sm text-[#071B35]">
                    {review.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                    {review.comment}
                  </p>

                  {/* 5 Category Ratings Row */}
                  {review.categoryRatings && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1 text-[11px] text-slate-600">
                      {CATEGORY_LABELS.map((cat) => (
                        <span key={cat.key} className="inline-flex items-center gap-1 tabular-nums">
                          <span className="text-slate-400">{cat.label}:</span>
                          <strong className="text-slate-800">
                            {review.categoryRatings[cat.key]}/5
                          </strong>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Customer Photos & Videos */}
                  {mediaItems.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2.5 pt-2">
                      {mediaItems.map((item, idx) => (
                        <button
                          key={item.id || idx}
                          type="button"
                          onClick={() => openReviewMediaLightbox(review, idx)}
                          className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 hover:border-[#FF7900] transition-colors cursor-pointer bg-slate-100 group"
                          aria-label={`View customer ${item.type} ${idx + 1}`}
                        >
                          {item.type === 'video' ? (
                            <div className="w-full h-full bg-[#071B35] flex flex-col items-center justify-center text-white gap-0.5">
                              <Film className="w-5 h-5 text-[#FF7900]" />
                              <span className="text-[9px] font-semibold uppercase">Video</span>
                            </div>
                          ) : (
                            <img
                              src={item.url}
                              alt={`Customer upload ${idx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              loading="lazy"
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Existing Public Brand Reply */}
                {review.adminReply && replyOpenId !== review.id && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#071B35]">
                        Public Brand Reply (TeqqnoWorld Team)
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {formatDateTime(review.adminRepliedAt)}
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                      {review.adminReply}
                    </p>
                  </div>
                )}

                {/* Existing Internal Moderation Note */}
                {review.moderationNote && noteOpenId !== review.id && (
                  <div className="rounded-xl bg-amber-50/60 border border-amber-200/80 p-3 text-xs space-y-0.5">
                    <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                      <StickyNote className="w-3.5 h-3.5" />
                      Internal Admin Note (Private)
                    </span>
                    <p className="text-amber-900/90 leading-relaxed">{review.moderationNote}</p>
                  </div>
                )}

                {/* Inline Public Reply Editor */}
                {replyOpenId === review.id && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2.5">
                    <label className="block text-xs font-semibold text-[#071B35]">
                      Public Response from TeqqnoWorld (Visible on Product Page &amp; Customer Dashboard)
                    </label>
                    <textarea
                      rows={3}
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Thank the customer or address their feedback professionally..."
                      maxLength={1200}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#FF7900]"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setReplyOpenId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/70 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleModerate(
                            review.id,
                            { adminReply: replyDraft.trim() },
                            replyDraft.trim() ? 'Public brand reply saved.' : 'Public reply removed.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#071B35] text-white hover:bg-[#0d2a4d] cursor-pointer disabled:opacity-60"
                      >
                        {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                        Save Reply
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Internal Moderation Note Editor */}
                {noteOpenId === review.id && (
                  <div className="rounded-xl bg-amber-50/50 border border-amber-200 p-3.5 space-y-2.5">
                    <label className="block text-xs font-semibold text-amber-950">
                      Internal Moderation Note (Admin-only, never shown to customers)
                    </label>
                    <textarea
                      rows={2}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Record verification details, refund follow-up, or rejection reason..."
                      maxLength={600}
                      className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-[#FF7900]"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setNoteOpenId(null)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-amber-100/70 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleModerate(
                            review.id,
                            { moderationNote: noteDraft.trim() },
                            'Internal moderation note saved.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-700 text-white hover:bg-amber-800 cursor-pointer disabled:opacity-60"
                      >
                        {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                        Save Note
                      </button>
                    </div>
                  </div>
                )}

                {/* Moderation History Drawer */}
                {historyOpenId === review.id && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2">
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Moderation Audit History
                    </h5>
                    {!review.moderationHistory || review.moderationHistory.length === 0 ? (
                      <p className="text-xs text-slate-500">No moderation events logged yet.</p>
                    ) : (
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {review.moderationHistory.map((entry, idx) => (
                          <li key={idx} className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-400">
                              {formatDateTime(entry.at)}
                            </span>
                            <span className="font-semibold text-[#071B35]">{entry.action}</span>
                            <span className="text-slate-500">by {entry.actor}</span>
                            {entry.detail && (
                              <span className="text-slate-600">— {entry.detail}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    {review.status !== 'approved' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleModerate(
                            review.id,
                            { status: 'approved' },
                            review.status === 'hidden'
                              ? 'Review restored and published.'
                              : 'Review approved and published.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        {review.status === 'hidden' ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        {review.status === 'hidden' ? 'Restore' : 'Approve'}
                      </button>
                    )}

                    {review.status === 'approved' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleModerate(
                            review.id,
                            { status: 'hidden' },
                            'Review hidden from storefront.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        Hide
                      </button>
                    )}

                    {review.status !== 'rejected' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleModerate(
                            review.id,
                            { status: 'rejected' },
                            'Review marked as rejected.'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-60"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    )}

                    {review.status === 'approved' && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          void handleModerate(
                            review.id,
                            { isFeatured: !review.isFeatured },
                            review.isFeatured ? 'Removed featured highlight.' : 'Marked as featured review.'
                          )
                        }
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-60 ${
                          review.isFeatured
                            ? 'bg-orange-50 text-[#FF7900] border-orange-200'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {review.isFeatured ? 'Featured' : 'Feature'}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setReplyOpenId(replyOpenId === review.id ? null : review.id);
                        setReplyDraft(review.adminReply || '');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <MessageSquareReply className="w-3.5 h-3.5" />
                      {review.adminReply ? 'Edit Reply' : 'Reply'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNoteOpenId(noteOpenId === review.id ? null : review.id);
                        setNoteDraft(review.moderationNote || '');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      Note
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setHistoryOpenId(historyOpenId === review.id ? null : review.id)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      History
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${
                          historyOpenId === review.id ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Flag Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setFlagMenuId(flagMenuId === review.id ? null : review.id)
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5" />
                        Flag
                      </button>
                      {flagMenuId === review.id && (
                        <div className="absolute left-0 bottom-full mb-1.5 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-20">
                          {REPORT_REASONS.map((reason) => (
                            <button
                              key={reason.id}
                              type="button"
                              onClick={() =>
                                void handleModerate(
                                  review.id,
                                  { flagReason: reason.id },
                                  `Review flagged (${reason.label}).`
                                )
                              }
                              className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              {reason.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Delete with inline confirm */}
                  <div>
                    {confirmDeleteId === review.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-rose-700">
                          Delete permanently?
                        </span>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleDelete(review.id)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer disabled:opacity-60"
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(review.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Fullscreen Photo & Video Lightbox */}
      <ReviewPhotoLightbox
        photos={lightboxState?.photos || []}
        activeIndex={lightboxState ? lightboxState.index : null}
        onNavigate={(nextIndex) =>
          setLightboxState((prev) => (prev ? { ...prev, index: nextIndex } : null))
        }
        onClose={() => setLightboxState(null)}
      />
    </div>
  );
};
