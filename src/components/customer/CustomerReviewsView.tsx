import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  EyeOff,
  MessageSquare,
  PenLine,
  Star,
  ThumbsUp,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Order, Product, ProductReview, UserProfile } from '../../types';
import { PRODUCTS } from '../../data/mockData';
import {
  deleteCustomerReview,
  fetchCustomerOwnReviews,
} from '../../services/reviewsService';
import { useReviewSummaries } from '../../context/ReviewSummaryContext';
import { StarRatingDisplay } from '../reviews/StarRating';
import { ReviewFormModal } from '../reviews/ReviewFormModal';

interface CustomerReviewsViewProps {
  user: UserProfile;
  orders: Order[];
  onOpenProduct?: (productId: string) => void;
  onToast?: (message: string, variant?: 'success' | 'error' | 'info') => void;
}

const STATUS_META: Record<
  ProductReview['status'],
  { label: string; textClass: string; icon: React.ReactNode }
> = {
  approved: {
    label: 'Published',
    textClass: 'text-emerald-700',
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  },
  pending: {
    label: 'Pending Moderation',
    textClass: 'text-amber-700',
    icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
  },
  rejected: {
    label: 'Not Published',
    textClass: 'text-rose-700',
    icon: <XCircle className="w-3.5 h-3.5 shrink-0" />,
  },
  hidden: {
    label: 'Hidden by Moderator',
    textClass: 'text-zinc-600',
    icon: <EyeOff className="w-3.5 h-3.5 shrink-0" />,
  },
};

export const CustomerReviewsView: React.FC<CustomerReviewsViewProps> = ({
  user,
  orders,
  onOpenProduct,
  onToast,
}) => {
  const { updateSingleSummary } = useReviewSummaries();
  const [myReviews, setMyReviews] = useState<ProductReview[]>([]);
  const [allowCustomerEdits, setAllowCustomerEdits] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [modalTarget, setModalTarget] = useState<{
    productId: string;
    productName: string;
    orderNumber?: string;
    variantSummary?: string;
    existingReview?: ProductReview | null;
  } | null>(null);

  const loadMyReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCustomerOwnReviews(user.email);
      setMyReviews(res.reviews);
      setAllowCustomerEdits(res.allowCustomerEdits);
    } finally {
      setLoading(false);
    }
  }, [user.email]);

  useEffect(() => {
    void loadMyReviews();
  }, [loadMyReviews]);

  // Distinct purchased products from this customer's orders that they haven't reviewed yet
  const eligibleToReview = useMemo(() => {
    const reviewedProductIds = new Set(myReviews.map((r) => r.productId));
    const seen = new Map<
      string,
      {
        productId: string;
        productName: string;
        orderNumber: string;
        orderStatus: string;
        variantSummary: string;
        imageUrl?: string;
      }
    >();

    for (const order of orders) {
      for (const item of order.items || []) {
        const pid = item.product?.id;
        if (!pid || reviewedProductIds.has(pid) || seen.has(pid)) continue;
        const catalogProduct: Product | undefined = PRODUCTS.find((p) => p.id === pid);
        const variantParts = [
          item.color?.name,
          item.printMethod,
          item.quantity ? `${item.quantity} pcs` : '',
        ].filter(Boolean);
        seen.set(pid, {
          productId: pid,
          productName: item.product?.name || catalogProduct?.name || pid,
          orderNumber: order.orderNumber,
          orderStatus: order.orderStatus,
          variantSummary: variantParts.join(' · '),
          imageUrl:
            item.previewUrl ||
            item.color?.imageFront ||
            catalogProduct?.colors?.[0]?.imageFront,
        });
      }
    }
    return Array.from(seen.values());
  }, [orders, myReviews]);

  const handleDelete = async (review: ProductReview) => {
    const res = await deleteCustomerReview(review.id, user.email);
    setConfirmDeleteId(null);
    if (res.success) {
      if (res.summary) updateSingleSummary(res.summary);
      onToast?.('Review removed successfully.', 'success');
      void loadMyReviews();
    } else {
      onToast?.(res.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl sm:text-2xl text-[#071B35]">
            My Product Reviews
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
            Manage your reviews across every TeqqnoWorld product you have ordered or evaluated.
          </p>
        </div>
        <div className="text-xs text-zinc-500 tabular-nums">
          {myReviews.length} submitted · {eligibleToReview.length} awaiting review
        </div>
      </div>

      {/* Eligible Purchased Products Awaiting Review */}
      {eligibleToReview.length > 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200/90 p-5 space-y-4">
          <div>
            <h3 className="font-display font-bold text-base text-[#071B35]">
              Products Ready for Your Review
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Each product has its own independent review — rate as many different products as you like.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {eligibleToReview.map((item) => (
              <div
                key={item.productId}
                className="p-4 rounded-xl border border-zinc-200 bg-[#FAF9FD] flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200 overflow-hidden shrink-0 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.productName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Star className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[#071B35] truncate">
                      {item.productName}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                      Order {item.orderNumber} · {item.orderStatus}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setModalTarget({
                      productId: item.productId,
                      productName: item.productName,
                      orderNumber: item.orderNumber,
                      variantSummary: item.variantSummary,
                      existingReview: null,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold transition-colors cursor-pointer shrink-0 min-h-[40px]"
                >
                  <PenLine className="w-3.5 h-3.5" />
                  <span>Write Review</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submitted Reviews List */}
      <div className="space-y-4">
        <h3 className="font-display font-bold text-base text-[#071B35]">
          Your Submitted Reviews ({myReviews.length})
        </h3>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-zinc-200 p-5 animate-pulse space-y-3"
              >
                <div className="h-4 w-48 bg-zinc-100 rounded" />
                <div className="h-3.5 w-full bg-zinc-100 rounded" />
              </div>
            ))}
          </div>
        ) : myReviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center space-y-2">
            <Star className="w-8 h-8 text-zinc-300 mx-auto" />
            <div className="font-display font-bold text-base text-[#071B35]">
              You haven&apos;t submitted any reviews yet
            </div>
            <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto">
              Visit any product page or review items from your completed orders above to share your feedback.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {myReviews.map((rev) => {
              const statusMeta = STATUS_META[rev.status] || STATUS_META.pending;
              return (
                <article
                  key={rev.id}
                  className="bg-white rounded-2xl border border-zinc-200/90 p-5 space-y-3.5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenProduct?.(rev.productId)}
                        className="text-xs font-semibold text-[#FF7A00] hover:underline cursor-pointer text-left"
                      >
                        {rev.productName}
                      </button>
                      <h4 className="font-display font-bold text-base text-[#071B35] mt-0.5">
                        {rev.title}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs mt-1">
                        <span className={`inline-flex items-center gap-1 font-medium ${statusMeta.textClass}`}>
                          {statusMeta.icon}
                          <span>{statusMeta.label}</span>
                        </span>
                        <span aria-hidden="true" className="text-zinc-300">·</span>
                        <span className={rev.verifiedPurchase ? 'text-emerald-700 font-medium' : 'text-zinc-400'}>
                          {rev.verifiedPurchase ? 'Verified Purchase' : 'Unverified Review'}
                        </span>
                        <span aria-hidden="true" className="text-zinc-300">·</span>
                        <span className="text-zinc-500">
                          {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <StarRatingDisplay rating={rev.rating} size="sm" />
                      <span className="text-xs font-bold text-[#071B35] tabular-nums">
                        {rev.rating.toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-line">
                    {rev.comment}
                  </p>

                  {rev.adminReply && (
                    <div className="rounded-xl bg-[#FAF9FD] border border-zinc-200 p-3.5 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#071B35]">
                        <MessageSquare className="w-3.5 h-3.5 text-[#FF7A00]" />
                        <span>Official TeqqnoWorld Response</span>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-700 leading-relaxed">
                        {rev.adminReply}
                      </p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="inline-flex items-center gap-1.5 text-zinc-500 tabular-nums">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      <span>{rev.helpfulCount} found this helpful</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {allowCustomerEdits && (
                        <button
                          type="button"
                          onClick={() =>
                            setModalTarget({
                              productId: rev.productId,
                              productName: rev.productName,
                              orderNumber: rev.orderNumber,
                              variantSummary: rev.variantSummary,
                              existingReview: rev,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium cursor-pointer min-h-[36px]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}

                      {confirmDeleteId === rev.id ? (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleDelete(rev)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-semibold cursor-pointer min-h-[36px]"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 rounded-lg text-zinc-600 hover:bg-zinc-100 cursor-pointer min-h-[36px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(rev.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-zinc-500 hover:text-rose-600 hover:bg-rose-50 cursor-pointer min-h-[36px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {modalTarget && (
        <ReviewFormModal
          isOpen={Boolean(modalTarget)}
          onClose={() => setModalTarget(null)}
          productId={modalTarget.productId}
          productName={modalTarget.productName}
          defaultOrderNumber={modalTarget.orderNumber}
          defaultVariantSummary={modalTarget.variantSummary}
          user={user}
          existingReview={modalTarget.existingReview}
          onSuccess={({ summary, message }) => {
            if (summary) updateSingleSummary(summary);
            onToast?.(message, 'success');
            void loadMyReviews();
          }}
        />
      )}
    </div>
  );
};
