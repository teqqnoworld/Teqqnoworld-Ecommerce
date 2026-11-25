import {
  ProductReview,
  ProductReviewSummary,
  ReviewCategoryRatings,
  ReviewFormPayload,
  ReviewMediaItem,
  ReviewModerationMode,
  ReviewModerationStatus,
  ReviewReportReason,
  ReviewSortOption,
  ReviewSystemSettings,
} from '../types';
import { getStoredAdminToken } from './adminSecurityService';
import { compressImageFile } from '../utils/imageCompressor';

// ==============================================================================
// PRODUCT REVIEW & RATING SYSTEM CLIENT SERVICE
// ==============================================================================

const VISITOR_KEY_STORAGE = 'teqqno_review_visitor_id';

export function getReviewVisitorKey(userEmail?: string): string {
  if (userEmail && userEmail.trim()) {
    return userEmail.trim().toLowerCase();
  }
  try {
    let id = localStorage.getItem(VISITOR_KEY_STORAGE);
    if (!id) {
      id = `vis-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(VISITOR_KEY_STORAGE, id);
    }
    return id;
  } catch {
    return 'vis-session';
  }
}

export interface ReviewGalleryPhoto {
  id?: string;
  type?: 'image' | 'video';
  photoUrl: string;
  reviewId: string;
  customerName: string;
  rating: number;
  title: string;
  variantSummary?: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface ProductReviewsResponse {
  success: boolean;
  summary: ProductReviewSummary;
  reviews: ProductReview[];
  viewerReview: ProductReview | null;
  galleryPhotos: ReviewGalleryPhoto[];
  pagination: {
    page: number;
    limit: number;
    totalFiltered: number;
    totalPages: number;
    hasMore: boolean;
  };
  settings: {
    allowGuestReviews: boolean;
    allowCustomerEdits: boolean;
    moderationMode: ReviewModerationMode;
  };
  message?: string;
}

export interface ReviewSummariesResponse {
  success: boolean;
  summaries: Record<string, ProductReviewSummary>;
  settings?: {
    allowGuestReviews: boolean;
    allowCustomerEdits: boolean;
    moderationMode: ReviewModerationMode;
  };
}

export interface AdminReviewsResponse {
  success: boolean;
  unauthorized?: boolean;
  kpis: {
    totalReviews: number;
    approvedCount: number;
    pendingCount: number;
    rejectedCount: number;
    hiddenCount: number;
    reportedCount: number;
    averageStoreRating: number;
  };
  ratingTrends: Array<{
    date: string;
    label: string;
    count: number;
    avgRating: number;
  }>;
  productSummaries: Array<
    ProductReviewSummary & {
      productName: string;
      pendingCount: number;
    }
  >;
  settings: ReviewSystemSettings;
  reviews: ProductReview[];
  message?: string;
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchAllProductReviewSummaries(): Promise<ReviewSummariesResponse> {
  try {
    const res = await fetch('/api/reviews/summaries');
    const data = await parseJsonSafe<ReviewSummariesResponse>(res);
    if (data?.success && data.summaries) return data;
  } catch {
    // graceful fallback below
  }
  return { success: false, summaries: {} };
}

export async function fetchProductReviews(params: {
  productId: string;
  rating?: number;
  verifiedOnly?: boolean;
  withPhotos?: boolean;
  search?: string;
  sort?: ReviewSortOption;
  page?: number;
  limit?: number;
  viewerEmail?: string;
}): Promise<ProductReviewsResponse> {
  const qs = new URLSearchParams();
  if (params.rating && params.rating >= 1 && params.rating <= 5) {
    qs.set('rating', String(params.rating));
  }
  if (params.verifiedOnly) qs.set('verifiedOnly', 'true');
  if (params.withPhotos) qs.set('withPhotos', 'true');
  if (params.search?.trim()) qs.set('search', params.search.trim());
  if (params.sort) qs.set('sort', params.sort);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.viewerEmail?.trim()) qs.set('viewerEmail', params.viewerEmail.trim().toLowerCase());
  qs.set('voterKey', getReviewVisitorKey(params.viewerEmail));

  const res = await fetch(
    `/api/reviews/product/${encodeURIComponent(params.productId)}?${qs.toString()}`
  );
  const data = await parseJsonSafe<ProductReviewsResponse>(res);
  if (!data || !data.success) {
    throw new Error(data?.message || 'Unable to load product reviews right now.');
  }
  return data;
}

export async function fetchCustomerOwnReviews(email: string): Promise<{
  reviews: ProductReview[];
  allowCustomerEdits: boolean;
}> {
  if (!email.trim()) return { reviews: [], allowCustomerEdits: true };
  const res = await fetch(
    `/api/reviews/customer?email=${encodeURIComponent(email.trim().toLowerCase())}`
  );
  const data = await parseJsonSafe<{
    success: boolean;
    reviews: ProductReview[];
    allowCustomerEdits?: boolean;
  }>(res);
  return {
    reviews: data?.success && Array.isArray(data.reviews) ? data.reviews : [],
    allowCustomerEdits: data?.allowCustomerEdits !== false,
  };
}

export async function submitProductReview(payload: ReviewFormPayload): Promise<{
  success: boolean;
  review?: ProductReview;
  summary?: ProductReviewSummary;
  duplicate?: boolean;
  existingReviewId?: string;
  message: string;
}> {
  const res = await fetch('/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe<{
    success: boolean;
    review?: ProductReview;
    summary?: ProductReviewSummary;
    duplicate?: boolean;
    existingReviewId?: string;
    message?: string;
  }>(res);
  if (!data) {
    return { success: false, message: `Review service unavailable (HTTP ${res.status}).` };
  }
  return {
    success: Boolean(data.success),
    review: data.review,
    summary: data.summary,
    duplicate: data.duplicate,
    existingReviewId: data.existingReviewId,
    message: data.message || (data.success ? 'Review submitted.' : 'Could not submit review.'),
  };
}

export async function updateCustomerReview(
  reviewId: string,
  payload: {
    customerEmail: string;
    rating: number;
    categoryRatings: ReviewCategoryRatings;
    title: string;
    comment: string;
    companyName?: string;
    variantSummary?: string;
    wouldRecommend: boolean;
    photos: string[];
    videos?: string[];
    media?: ReviewMediaItem[];
  }
): Promise<{
  success: boolean;
  review?: ProductReview;
  summary?: ProductReviewSummary;
  message: string;
}> {
  const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe<{
    success: boolean;
    review?: ProductReview;
    summary?: ProductReviewSummary;
    message?: string;
  }>(res);
  return {
    success: Boolean(data?.success),
    review: data?.review,
    summary: data?.summary,
    message: data?.message || 'Could not update review.',
  };
}

export async function deleteCustomerReview(
  reviewId: string,
  customerEmail: string
): Promise<{ success: boolean; summary?: ProductReviewSummary; message: string }> {
  const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerEmail }),
  });
  const data = await parseJsonSafe<{
    success: boolean;
    summary?: ProductReviewSummary;
    message?: string;
  }>(res);
  return {
    success: Boolean(data?.success),
    summary: data?.summary,
    message: data?.message || 'Could not remove review.',
  };
}

export async function toggleReviewHelpfulVote(
  reviewId: string,
  userEmail?: string
): Promise<{
  success: boolean;
  helpfulCount?: number;
  viewerHasVotedHelpful?: boolean;
  message?: string;
}> {
  const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/helpful`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ voterKey: getReviewVisitorKey(userEmail) }),
  });
  const data = await parseJsonSafe<{
    success: boolean;
    helpfulCount?: number;
    viewerHasVotedHelpful?: boolean;
    message?: string;
  }>(res);
  return data || { success: false, message: 'Unable to record vote.' };
}

export async function reportProductReview(
  reviewId: string,
  reason: ReviewReportReason,
  userEmail?: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, voterKey: getReviewVisitorKey(userEmail) }),
  });
  const data = await parseJsonSafe<{ success: boolean; message?: string }>(res);
  return {
    success: Boolean(data?.success),
    message: data?.message || 'Could not submit report.',
  };
}

/**
 * Uploads a validated image or short video file to the server review-media endpoint.
 * Images are compressed client-side first for instant uploads; videos are streamed directly.
 */
export async function uploadReviewMediaFile(file: File): Promise<ReviewMediaItem> {
  const mime = (file.type || '').toLowerCase();
  const isImage = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime);
  const isVideo = ['video/mp4', 'video/webm', 'video/quicktime'].includes(mime);

  if (!isImage && !isVideo) {
    throw new Error('Unsupported format. Upload JPG, PNG, WebP photos or MP4/WebM/MOV videos.');
  }
  if (isImage && file.size > 8 * 1024 * 1024) {
    throw new Error('Photos must be under 8 MB.');
  }
  if (isVideo && file.size > 25 * 1024 * 1024) {
    throw new Error('Videos must be under 25 MB.');
  }

  let bodyBlob: Blob = file;
  let uploadMime = mime;

  if (isImage) {
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 1080,
        maxHeight: 1080,
        quality: 0.82,
      });
      if (compressed?.file) {
        bodyBlob = compressed.file;
        uploadMime = compressed.file.type || 'image/webp';
      }
    } catch {
      // keep original image blob
    }
  }

  const res = await fetch('/api/reviews/upload-media', {
    method: 'POST',
    headers: {
      'Content-Type': uploadMime,
      'X-File-Name': encodeURIComponent(file.name.slice(0, 100)),
    },
    body: bodyBlob,
  });

  const data = await parseJsonSafe<{
    success: boolean;
    media?: ReviewMediaItem;
    message?: string;
  }>(res);

  if (!res.ok || !data?.success || !data.media) {
    throw new Error(data?.message || `Media upload failed (HTTP ${res.status}).`);
  }
  return data.media;
}

// ==============================================================================
// ADMIN MODERATION API METHODS
// ==============================================================================

export async function fetchAdminReviews(params?: {
  status?: 'all' | ReviewModerationStatus | 'reported';
  productId?: string;
  rating?: number;
  dateRange?: 'all' | '7d' | '30d' | '90d';
  search?: string;
}): Promise<AdminReviewsResponse> {
  const token = getStoredAdminToken();
  const qs = new URLSearchParams();
  if (params?.status && params.status !== 'all') qs.set('status', params.status);
  if (params?.productId && params.productId !== 'all') qs.set('productId', params.productId);
  if (params?.rating && params.rating >= 1 && params.rating <= 5) {
    qs.set('rating', String(params.rating));
  }
  if (params?.dateRange && params.dateRange !== 'all') {
    qs.set('dateRange', params.dateRange);
  }
  if (params?.search?.trim()) qs.set('search', params.search.trim());

  const res = await fetch(`/api/admin/reviews?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe<AdminReviewsResponse>(res);
  if (!data) {
    return {
      success: false,
      unauthorized: res.status === 401,
      kpis: {
        totalReviews: 0,
        approvedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        hiddenCount: 0,
        reportedCount: 0,
        averageStoreRating: 0,
      },
      ratingTrends: [],
      productSummaries: [],
      settings: {
        moderationMode: 'auto_verified',
        allowGuestReviews: true,
        allowCustomerEdits: true,
        updatedAt: new Date().toISOString(),
      },
      reviews: [],
      message: `Admin reviews service unavailable (HTTP ${res.status}).`,
    };
  }
  return data;
}

export async function adminModerateReview(
  reviewId: string,
  patch: {
    status?: ReviewModerationStatus;
    isFeatured?: boolean;
    adminReply?: string;
    moderationNote?: string;
    flagReason?: ReviewReportReason;
    clearReports?: boolean;
  }
): Promise<{
  success: boolean;
  review?: ProductReview;
  summary?: ProductReviewSummary;
  message: string;
}> {
  const token = getStoredAdminToken();
  const res = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  const data = await parseJsonSafe<{
    success: boolean;
    review?: ProductReview;
    summary?: ProductReviewSummary;
    message?: string;
  }>(res);
  return {
    success: Boolean(data?.success),
    review: data?.review,
    summary: data?.summary,
    message: data?.message || 'Failed to update review.',
  };
}

export async function adminDeleteReview(
  reviewId: string
): Promise<{ success: boolean; summary?: ProductReviewSummary; message: string }> {
  const token = getStoredAdminToken();
  const res = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await parseJsonSafe<{
    success: boolean;
    summary?: ProductReviewSummary;
    message?: string;
  }>(res);
  return {
    success: Boolean(data?.success),
    summary: data?.summary,
    message: data?.message || 'Failed to delete review.',
  };
}

export async function adminUpdateReviewSettings(patch: {
  moderationMode: ReviewModerationMode;
  allowGuestReviews: boolean;
  allowCustomerEdits: boolean;
}): Promise<{ success: boolean; settings?: ReviewSystemSettings; message: string }> {
  const token = getStoredAdminToken();
  const res = await fetch('/api/admin/reviews/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  const data = await parseJsonSafe<{
    success: boolean;
    settings?: ReviewSystemSettings;
    message?: string;
  }>(res);
  return {
    success: Boolean(data?.success),
    settings: data?.settings,
    message: data?.message || 'Failed to save review settings.',
  };
}
