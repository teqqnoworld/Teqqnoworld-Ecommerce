import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Film,
  Flag,
  MessageSquare,
  PenLine,
  Search,
  ShieldCheck,
  Star,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Order,
  Product,
  ProductReview,
  ProductReviewSummary,
  ReviewReportReason,
  ReviewSortOption,
  UserProfile,
} from '../../types';
import {
  deleteCustomerReview,
  fetchProductReviews,
  reportProductReview,
  ReviewGalleryPhoto,
  toggleReviewHelpfulVote,
} from '../../services/reviewsService';
import { useReviewSummaries } from '../../context/ReviewSummaryContext';
import { StarRatingDisplay } from './StarRating';
import { ReviewFormModal } from './ReviewFormModal';
import { ReviewPhotoLightbox } from './ReviewPhotoLightbox';

interface ProductReviewsSectionProps {
  product: Product;
  selectedVariantSummary?: string;
  user?: UserProfile | null;
  orders?: Order[];
  onRequestLogin?: () => void;
}

const EMPTY_SUMMARY = (productId: string): ProductReviewSummary => ({
  productId,
  averageRating: 0,
  totalReviews: 0,
  verifiedCount: 0,
  photoReviewCount: 0,
  videoReviewCount: 0,
  recommendPercent: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  categoryAverages: {
    productQuality: 0,
    printQuality: 0,
    packaging: 0,
    valueForMoney: 0,
    overallExperience: 0,
  },
});

const CATEGORY_LABELS: Array<{
  key: keyof ProductReviewSummary['categoryAverages'];
  label: string;
}> = [
  { key: 'productQuality', label: 'Product Quality' },
  { key: 'printQuality', label: 'Print & Branding' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'valueForMoney', label: 'Value for Money' },
  { key: 'overallExperience', label: 'Overall Experience' },
];

const REPORT_REASONS: Array<{ value: ReviewReportReason; label: string }> = [
  { value: 'spam', label: 'Spam or promotional content' },
  { value: 'inappropriate', label: 'Offensive or inappropriate language' },
  { value: 'off_topic', label: 'Not about this product' },
  { value: 'misleading', label: 'Misleading or inaccurate claim' },
];

export const ProductReviewsSection: React.FC<ProductReviewsSectionProps> = ({
  product,
  selectedVariantSummary,
  user,
  orders = [],
  onRequestLogin,
}) => {
  const prefersReduced = useReducedMotion();
  const { updateSingleSummary } = useReviewSummaries();

  const [summary, setSummary] = useState<ProductReviewSummary>(() => EMPTY_SUMMARY(product.id));
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [viewerReview, setViewerReview] = useState<ProductReview | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<ReviewGalleryPhoto[]>([]);
  const [allowGuestReviews, setAllowGuestReviews] = useState<boolean>(true);
  const [allowCustomerEdits, setAllowCustomerEdits] = useState<boolean>(true);

  // Filters & Pagination
  const [starFilter, setStarFilter] = useState<number>(0);
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [withMediaOnly, setWithMediaOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<ReviewSortOption>('relevant');
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [totalFiltered, setTotalFiltered] = useState<number>(0);

  // UI states
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((curr) => (curr === msg ? null : curr)), 3500);
  };

  // Find a completed/delivered order for this exact product if signed in
  const matchedDeliveredOrder = useMemo(() => {
    return orders.find(
      (ord) =>
        ord.orderStatus === 'Delivered' &&
        ord.items.some((it) => it.product?.id === product.id)
    );
  }, [orders, product.id]);

  // Debounce search input
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 260);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  // Reset filters when switching product
  useEffect(() => {
    setStarFilter(0);
    setVerifiedOnly(false);
    setWithMediaOnly(false);
    setSearchQuery('');
    setDebouncedSearch('');
    setSortBy('relevant');
    setPage(1);
  }, [product.id]);

  const loadReviews = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setErrorMsg(null);

      try {
        const res = await fetchProductReviews({
          productId: product.id,
          rating: starFilter || undefined,
          verifiedOnly,
          withPhotos: withMediaOnly,
          search: debouncedSearch || undefined,
          sort: sortBy,
          page: targetPage,
          limit: 6,
          viewerEmail: user?.email,
        });

        setSummary(res.summary);
        updateSingleSummary(res.summary);
        setViewerReview(res.viewerReview);
        setGalleryPhotos(res.galleryPhotos || []);
        setAllowGuestReviews(res.settings.allowGuestReviews);
        setAllowCustomerEdits(res.settings.allowCustomerEdits);
        setHasMore(res.pagination.hasMore);
        setTotalFiltered(res.pagination.totalFiltered);
        setReviews((prev) => (append ? [...prev, ...res.reviews] : res.reviews));
      } catch (err: any) {
        setErrorMsg(err?.message || 'Unable to load product reviews.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      product.id,
      starFilter,
      verifiedOnly,
      withMediaOnly,
      debouncedSearch,
      sortBy,
      user?.email,
      updateSingleSummary,
    ]
  );

  useEffect(() => {
    void loadReviews(1, false);
  }, [loadReviews]);

  const handleToggleHelpful = async (reviewId: string) => {
    // Optimistic toggle
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? {
              ...r,
              viewerHasVotedHelpful: !r.viewerHasVotedHelpful,
              helpfulCount: Math.max(0, r.helpfulCount + (r.viewerHasVotedHelpful ? -1 : 1)),
            }
          : r
      )
    );

    const res = await toggleReviewHelpfulVote(reviewId, user?.email);
    if (res.success && typeof res.helpfulCount === 'number') {
      setReviews((prev) =>
        prev.map((r) =>
          r.id === reviewId
            ? {
                ...r,
                helpfulCount: res.helpfulCount!,
                viewerHasVotedHelpful: Boolean(res.viewerHasVotedHelpful),
              }
            : r
        )
      );
    } else {
      void loadReviews(1, false);
    }
  };

  const handleReport = async (reviewId: string, reason: ReviewReportReason) => {
    const res = await reportProductReview(reviewId, reason, user?.email);
    setReportingId(null);
    showToast(res.message);
  };

  const handleDeleteOwn = async (review: ProductReview) => {
    const email = review.customerEmail || user?.email || '';
    if (!email) return;
    const res = await deleteCustomerReview(review.id, email);
    setConfirmDeleteId(null);
    if (res.success) {
      if (res.summary) updateSingleSummary(res.summary);
      showToast('Your review was deleted.');
      void loadReviews(1, false);
    } else {
      showToast(res.message);
    }
  };

  const openLightboxForUrl = (url: string) => {
    const idx = galleryPhotos.findIndex((p) => p.photoUrl === url);
    if (idx >= 0) {
      setLightboxIndex(idx);
    }
  };

  const hasActiveFilters =
    starFilter > 0 || verifiedOnly || withMediaOnly || debouncedSearch.trim().length > 0;

  return (
    <section
      id="product-reviews"
      aria-labelledby="product-reviews-heading"
      className="mt-16 sm:mt-20 pt-10 sm:pt-12 border-t border-[#E5E5EA] scroll-mt-24"
    >
      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[105] bg-[#071B35] text-white text-xs sm:text-sm font-medium px-4 py-3 rounded-xl shadow-xl border border-white/10 max-w-sm"
        >
          {toastMsg}
        </div>
      )}

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h2
            id="product-reviews-heading"
            className="font-display text-2xl sm:text-3xl font-bold text-[#071B35] tracking-tight"
          >
            Customer Reviews &amp; Ratings
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1">
            Verified customer feedback exclusively for {product.name}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {viewerReview ? (
            allowCustomerEdits ? (
              <button
                type="button"
                onClick={() => {
                  setEditingReview(viewerReview);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#071B35] hover:bg-[#0d284d] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer min-h-[44px] whitespace-nowrap"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Your Review</span>
              </button>
            ) : (
              <span className="text-xs text-zinc-500 font-medium">
                You have reviewed this product
              </span>
            )
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingReview(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer min-h-[44px] whitespace-nowrap"
            >
              <PenLine className="w-4 h-4" />
              <span>Write a Review</span>
            </button>
          )}
        </div>
      </div>

      {/* Rating Summary & Distribution Grid */}
      <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 sm:p-7 mb-8">
        {loading && summary.totalReviews === 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-pulse">
            <div className="lg:col-span-4 space-y-3">
              <div className="h-12 w-28 bg-zinc-100 rounded-lg" />
              <div className="h-4 w-44 bg-zinc-100 rounded" />
              <div className="h-4 w-36 bg-zinc-100 rounded" />
            </div>
            <div className="lg:col-span-4 space-y-2.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-3.5 w-full bg-zinc-100 rounded" />
              ))}
            </div>
            <div className="lg:col-span-4 space-y-2.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-3.5 w-full bg-zinc-100 rounded" />
              ))}
            </div>
          </div>
        ) : summary.totalReviews === 0 ? (
          <div className="py-6 sm:py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex items-center gap-2.5">
                <StarRatingDisplay rating={0} size="md" />
                <span className="text-sm font-semibold text-[#071B35]">No published reviews yet</span>
              </div>
              <p className="text-sm text-zinc-600 leading-relaxed">
                Have you ordered {product.name}? Share your honest impression of the material, branding quality, and delivery to help other teams choose with confidence.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingReview(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#071B35] hover:bg-[#0d284d] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer min-h-[44px] shrink-0"
            >
              <PenLine className="w-4 h-4" />
              <span>Be the First to Review</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-8 items-start">
            {/* Left Column: Big Score */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex items-baseline gap-2.5">
                <span className="font-display font-bold text-5xl text-[#071B35] tabular-nums tracking-tight">
                  {summary.averageRating.toFixed(1)}
                </span>
                <span className="text-sm text-zinc-400 font-medium tabular-nums">out of 5</span>
              </div>
              <StarRatingDisplay rating={summary.averageRating} size="lg" />
              <div className="text-xs text-zinc-600 space-y-1 pt-1">
                <div className="font-medium text-[#071B35] tabular-nums">
                  Based on {summary.totalReviews}{' '}
                  {summary.totalReviews === 1 ? 'published review' : 'published reviews'}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-zinc-500">
                  <span className="tabular-nums">{summary.verifiedCount} verified buyers</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-emerald-700 font-medium">
                    {summary.recommendPercent}% recommend
                  </span>
                </div>
              </div>
            </div>

            {/* Middle Column: Interactive 5-to-1 Star Distribution Bars */}
            <div className="lg:col-span-5 space-y-2">
              <div className="text-xs font-semibold text-[#071B35] mb-2">Rating Breakdown</div>
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = summary.distribution[star] || 0;
                const pct =
                  summary.totalReviews > 0 ? Math.round((count / summary.totalReviews) * 100) : 0;
                const isSelected = starFilter === star;

                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => {
                      setStarFilter((curr) => (curr === star ? 0 : star));
                      setPage(1);
                    }}
                    className={`w-full flex items-center gap-3 py-1 px-2 rounded-lg transition-colors cursor-pointer text-left ${
                      isSelected ? 'bg-orange-50' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <span className="text-xs font-semibold text-zinc-700 w-10 shrink-0 tabular-nums">
                      {star} star
                    </span>
                    <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={prefersReduced ? false : { width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${
                          isSelected ? 'bg-[#FF7A00]' : 'bg-[#071B35]'
                        }`}
                      />
                    </div>
                    <span className="text-xs font-mono tabular-nums text-zinc-500 w-14 text-right shrink-0">
                      {pct}% ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Separate Category Averages */}
            <div className="lg:col-span-4 space-y-2.5 lg:border-l lg:border-zinc-100 lg:pl-7">
              <div className="text-xs font-semibold text-[#071B35] mb-2">Category Scores</div>
              {CATEGORY_LABELS.map((cat) => {
                const score = summary.categoryAverages?.[cat.key] || 0;
                const pct = Math.round((score / 5) * 100);
                return (
                  <div key={cat.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-600">{cat.label}</span>
                      <span className="font-mono font-semibold text-[#071B35] tabular-nums">
                        {score.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={prefersReduced ? false : { width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full bg-[#FF7A00] rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Customer Photos & Videos Strip */}
      {galleryPhotos.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#071B35]">
              Customer Photos &amp; Videos ({galleryPhotos.length})
            </h3>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
            {galleryPhotos.map((item, idx) => (
              <button
                key={`${item.reviewId}-${idx}`}
                type="button"
                onClick={() => setLightboxIndex(idx)}
                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-zinc-200 bg-zinc-900 shrink-0 group cursor-pointer focus-visible:outline-2 focus-visible:outline-[#FF7A00]"
              >
                {item.type === 'video' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-white">
                    <Film className="w-6 h-6 text-[#FF7A00]" />
                    <span className="text-[10px] mt-1 font-medium">Video</span>
                  </div>
                ) : (
                  <img
                    src={item.photoUrl}
                    alt={`Customer photo by ${item.customerName}`}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Sort Toolbar (shown when product has reviews or viewer has pending review) */}
      {(summary.totalReviews > 0 || viewerReview) && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-5 mb-6 border-b border-zinc-200">
          {/* Interactive Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100">
              <button
                type="button"
                onClick={() => {
                  setStarFilter(0);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap min-h-[36px] ${
                  starFilter === 0
                    ? 'bg-white text-[#071B35] font-semibold shadow-2xs'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                All Stars
              </button>
              {[5, 4, 3, 2, 1].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStarFilter((curr) => (curr === s ? 0 : s));
                    setPage(1);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap min-h-[36px] tabular-nums ${
                    starFilter === s
                      ? 'bg-white text-[#071B35] font-semibold shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {s}★
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setVerifiedOnly((v) => !v);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
                verifiedOnly
                  ? 'bg-[#071B35] border-[#071B35] text-white'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Only</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWithMediaOnly((v) => !v);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer min-h-[40px] whitespace-nowrap ${
                withMediaOnly
                  ? 'bg-[#071B35] border-[#071B35] text-white'
                  : 'bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
              }`}
            >
              With Photos/Videos
            </button>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reviews..."
                aria-label="Search product reviews"
                className="w-full sm:w-48 pl-8 pr-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:border-[#FF7A00] min-h-[40px]"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as ReviewSortOption);
                setPage(1);
              }}
              aria-label="Sort reviews"
              className="px-3 py-2 rounded-xl border border-zinc-200 bg-white text-xs font-medium text-zinc-800 focus:outline-none focus:border-[#FF7A00] min-h-[40px] cursor-pointer"
            >
              <option value="relevant">Sort: Most Relevant</option>
              <option value="recent">Sort: Most Recent</option>
              <option value="helpful">Sort: Most Helpful</option>
              <option value="highest">Sort: Highest Rating</option>
              <option value="lowest">Sort: Lowest Rating</option>
            </select>
          </div>
        </div>
      )}

      {/* Error State */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 mb-6 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => void loadReviews(1, false)}
            className="text-xs font-semibold underline cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((k) => (
            <div
              key={k}
              className="bg-white rounded-2xl border border-zinc-200/80 p-5 sm:p-6 animate-pulse space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-100" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-36 bg-zinc-100 rounded" />
                  <div className="h-3 w-52 bg-zinc-100 rounded" />
                </div>
              </div>
              <div className="h-4 w-2/5 bg-zinc-100 rounded" />
              <div className="h-3.5 w-full bg-zinc-100 rounded" />
              <div className="h-3.5 w-4/5 bg-zinc-100 rounded" />
            </div>
          ))}
        </div>
      ) : reviews.length === 0 && hasActiveFilters ? (
        <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-[#071B35]">
            No reviews match your selected filters
          </p>
          <button
            type="button"
            onClick={() => {
              setStarFilter(0);
              setVerifiedOnly(false);
              setWithMediaOnly(false);
              setSearchQuery('');
              setPage(1);
            }}
            className="text-xs font-semibold text-[#FF7A00] hover:underline cursor-pointer"
          >
            Clear all filters
          </button>
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => {
            const isLong = review.comment.length > 340;
            const isExpanded = Boolean(expandedIds[review.id]);
            const displayBody =
              isLong && !isExpanded ? `${review.comment.slice(0, 340)}…` : review.comment;
            const reviewDate = new Date(review.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            const initials = review.customerName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <motion.article
                key={review.id}
                initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl border border-zinc-200/90 p-5 sm:p-6 space-y-4"
              >
                {/* Top Row: Author + Rating + Date */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#071B35] text-white font-display font-bold text-xs flex items-center justify-center shrink-0">
                      {initials || 'TW'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-sm text-[#071B35]">
                          {review.customerName}
                        </span>
                        {review.companyName && (
                          <>
                            <span aria-hidden="true" className="text-zinc-300">·</span>
                            <span className="text-xs text-zinc-500">{review.companyName}</span>
                          </>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mt-0.5">
                        {review.verifiedPurchase ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Verified Purchase</span>
                          </span>
                        ) : (
                          <span className="text-zinc-400">Unverified Review</span>
                        )}
                        <span aria-hidden="true" className="text-zinc-300">·</span>
                        <time dateTime={review.createdAt} className="text-zinc-500">
                          {reviewDate}
                        </time>
                        {review.status === 'pending' && (
                          <>
                            <span aria-hidden="true" className="text-zinc-300">·</span>
                            <span className="text-amber-700 font-medium">Pending Moderation</span>
                          </>
                        )}
                        {review.isFeatured && (
                          <>
                            <span aria-hidden="true" className="text-zinc-300">·</span>
                            <span className="text-[#FF7A00] font-medium">Featured Review</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StarRatingDisplay rating={review.rating} size="sm" />
                    <span className="text-xs font-bold text-[#071B35] tabular-nums">
                      {review.rating.toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Title & Body */}
                <div className="space-y-2">
                  <h3 className="font-display font-bold text-base text-[#071B35] leading-snug">
                    {review.title}
                  </h3>
                  {review.variantSummary && (
                    <div className="text-xs text-zinc-500">{review.variantSummary}</div>
                  )}
                  <p className="text-sm text-zinc-700 leading-relaxed max-w-[72ch] whitespace-pre-line">
                    {displayBody}
                  </p>
                  {isLong && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIds((prev) => ({ ...prev, [review.id]: !prev[review.id] }))
                      }
                      className="text-xs font-semibold text-[#FF7A00] hover:underline cursor-pointer"
                    >
                      {isExpanded ? 'Show less' : 'Read full review'}
                    </button>
                  )}
                </div>

                {/* Compact Category Scores Inline Metadata */}
                {review.categoryRatings && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-500 pt-1">
                    {CATEGORY_LABELS.map((cat) => (
                      <span key={cat.key} className="inline-flex items-center gap-1">
                        <span>{cat.label}:</span>
                        <span className="font-mono font-semibold text-[#071B35] tabular-nums">
                          {review.categoryRatings[cat.key]}/5
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Uploaded Review Media */}
                {review.media && review.media.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    {review.media.map((m) =>
                      m.type === 'video' ? (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => openLightboxForUrl(m.url)}
                          className="w-24 h-20 rounded-xl bg-zinc-900 border border-zinc-200 flex flex-col items-center justify-center text-white hover:border-[#FF7A00] transition-colors cursor-pointer"
                        >
                          <Film className="w-5 h-5 text-[#FF7A00]" />
                          <span className="text-[10px] mt-1 font-medium">Play Video</span>
                        </button>
                      ) : (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => openLightboxForUrl(m.url)}
                          className="w-20 h-20 rounded-xl overflow-hidden border border-zinc-200 hover:border-[#FF7A00] transition-colors cursor-pointer bg-zinc-50"
                        >
                          <img
                            src={m.url}
                            alt={`Review photo by ${review.customerName}`}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      )
                    )}
                  </div>
                )}

                {/* Official TeqqnoWorld Response (clean neutral surface, hairline border, no thick left bar) */}
                {review.adminReply && (
                  <div className="rounded-xl bg-[#FAF9FD] border border-zinc-200/90 p-4 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <MessageSquare className="w-3.5 h-3.5 text-[#FF7A00]" />
                      <span className="font-semibold text-[#071B35]">
                        Response from TeqqnoWorld
                      </span>
                      {review.adminRepliedAt && (
                        <>
                          <span aria-hidden="true" className="text-zinc-300">·</span>
                          <span className="text-zinc-500">
                            {new Date(review.adminRepliedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed whitespace-pre-line">
                      {review.adminReply}
                    </p>
                  </div>
                )}

                {/* Footer Actions Row */}
                <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {review.status === 'approved' && (
                      <button
                        type="button"
                        onClick={() => void handleToggleHelpful(review.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors cursor-pointer min-h-[36px] ${
                          review.viewerHasVotedHelpful
                            ? 'bg-orange-50 border-[#FF7A00]/40 text-[#FF7A00] font-semibold'
                            : 'bg-white border-zinc-200 text-zinc-600 hover:text-[#071B35] hover:border-zinc-300'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Helpful</span>
                        <span className="font-mono tabular-nums">({review.helpfulCount})</span>
                      </button>
                    )}

                    {review.wouldRecommend && (
                      <span className="text-zinc-500">Recommends this product</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    {review.isOwner && allowCustomerEdits && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingReview(review);
                          setModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-zinc-600 hover:text-[#071B35] hover:bg-zinc-100 transition-colors cursor-pointer min-h-[36px]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}

                    {review.isOwner &&
                      (confirmDeleteId === review.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleDeleteOwn(review)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer min-h-[36px]"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 cursor-pointer min-h-[36px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(review.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer min-h-[36px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      ))}

                    {!review.isOwner && review.status === 'approved' && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setReportingId((curr) => (curr === review.id ? null : review.id))
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer min-h-[36px]"
                        >
                          <Flag className="w-3.5 h-3.5" />
                          <span>Report</span>
                        </button>

                        {reportingId === review.id && (
                          <div className="absolute right-0 bottom-10 z-30 w-60 bg-white rounded-xl border border-zinc-200 shadow-xl p-2 space-y-1">
                            <div className="px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
                              Report this review
                            </div>
                            {REPORT_REASONS.map((r) => (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() => void handleReport(review.id, r.value)}
                                className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}

          {/* Pagination / Load More */}
          {hasMore && (
            <div className="pt-4 text-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  void loadReviews(next, true);
                }}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs sm:text-sm font-semibold text-[#071B35] transition-colors cursor-pointer min-h-[44px] disabled:opacity-50"
              >
                <span>
                  {loadingMore
                    ? 'Loading more reviews...'
                    : `Load More Reviews (${reviews.length} of ${totalFiltered})`}
                </span>
              </button>
            </div>
          )}
        </div>
      ) : null}

      {/* Write / Edit Review Modal */}
      <ReviewFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingReview(null);
        }}
        productId={product.id}
        productName={product.name}
        defaultVariantSummary={selectedVariantSummary}
        defaultOrderNumber={matchedDeliveredOrder?.orderNumber}
        user={user}
        existingReview={editingReview}
        allowGuestReviews={allowGuestReviews}
        onRequestLogin={onRequestLogin}
        onSuccess={({ summary: nextSummary, message }) => {
          if (nextSummary) {
            setSummary(nextSummary);
            updateSingleSummary(nextSummary);
          }
          showToast(message);
          void loadReviews(1, false);
        }}
      />

      {/* Media Lightbox */}
      <ReviewPhotoLightbox
        photos={galleryPhotos}
        activeIndex={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onNavigate={(idx) => setLightboxIndex(idx)}
      />
    </section>
  );
};
