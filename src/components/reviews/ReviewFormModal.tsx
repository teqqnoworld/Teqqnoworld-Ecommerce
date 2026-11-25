import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Film,
  Loader2,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  ProductReview,
  ProductReviewSummary,
  ReviewCategoryRatings,
  ReviewMediaItem,
  UserProfile,
} from '../../types';
import {
  submitProductReview,
  updateCustomerReview,
  uploadReviewMediaFile,
} from '../../services/reviewsService';
import { StarRatingInput } from './StarRating';

interface ReviewFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  defaultVariantSummary?: string;
  defaultOrderNumber?: string;
  user?: UserProfile | null;
  existingReview?: ProductReview | null;
  allowGuestReviews?: boolean;
  onRequestLogin?: () => void;
  onSuccess: (result: {
    review?: ProductReview;
    summary?: ProductReviewSummary;
    message: string;
  }) => void;
}

const CATEGORY_FIELDS: Array<{
  key: keyof ReviewCategoryRatings;
  label: string;
  hint: string;
}> = [
  { key: 'productQuality', label: 'Product Quality', hint: 'Material, finish & durability' },
  { key: 'printQuality', label: 'Print / Branding Quality', hint: 'Sharpness, colors & logo alignment' },
  { key: 'packaging', label: 'Packaging', hint: 'Transit safety & presentation' },
  { key: 'valueForMoney', label: 'Value for Money', hint: 'Pricing vs delivered quality' },
  { key: 'overallExperience', label: 'Overall Experience', hint: 'Proofing, support & delivery' },
];

const DEFAULT_CATEGORIES: ReviewCategoryRatings = {
  productQuality: 5,
  printQuality: 5,
  packaging: 5,
  valueForMoney: 5,
  overallExperience: 5,
};

export const ReviewFormModal: React.FC<ReviewFormModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  defaultVariantSummary = '',
  defaultOrderNumber = '',
  user,
  existingReview,
  allowGuestReviews = true,
  onRequestLogin,
  onSuccess,
}) => {
  const prefersReduced = useReducedMotion();
  const isEditing = Boolean(existingReview);
  const draftKey = `teqqno_review_draft_${productId}`;
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [rating, setRating] = useState<number>(5);
  const [categoryRatings, setCategoryRatings] = useState<ReviewCategoryRatings>(DEFAULT_CATEGORIES);
  const [title, setTitle] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [variantSummary, setVariantSummary] = useState<string>('');
  const [orderNumber, setOrderNumber] = useState<string>('');
  const [wouldRecommend, setWouldRecommend] = useState<boolean>(true);
  const [media, setMedia] = useState<ReviewMediaItem[]>([]);

  const [uploadingMedia, setUploadingMedia] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedState, setSubmittedState] = useState<{
    message: string;
    status?: string;
  } | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<boolean>(false);

  // Initialize form from existingReview, saved draft, or user profile
  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSubmittedState(null);
    setRestoredDraft(false);

    if (existingReview) {
      setRating(existingReview.rating);
      setCategoryRatings(
        existingReview.categoryRatings || {
          productQuality: existingReview.rating,
          printQuality: existingReview.rating,
          packaging: existingReview.rating,
          valueForMoney: existingReview.rating,
          overallExperience: existingReview.rating,
        }
      );
      setTitle(existingReview.title);
      setComment(existingReview.comment);
      setCustomerName(existingReview.customerName);
      setCustomerEmail(existingReview.customerEmail || user?.email || '');
      setCompanyName(existingReview.companyName || '');
      setVariantSummary(existingReview.variantSummary || defaultVariantSummary);
      setOrderNumber(existingReview.orderNumber || defaultOrderNumber);
      setWouldRecommend(existingReview.wouldRecommend);
      setMedia(existingReview.media || []);
      return;
    }

    // Attempt to restore draft for this exact product
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (draft && typeof draft === 'object') {
          setRating(Number(draft.rating) || 5);
          setCategoryRatings(draft.categoryRatings || DEFAULT_CATEGORIES);
          setTitle(String(draft.title || ''));
          setComment(String(draft.comment || ''));
          setCustomerName(String(draft.customerName || user?.name || ''));
          setCustomerEmail(String(draft.customerEmail || user?.email || ''));
          setCompanyName(String(draft.companyName || user?.companyName || ''));
          setVariantSummary(String(draft.variantSummary || defaultVariantSummary));
          setOrderNumber(String(draft.orderNumber || defaultOrderNumber));
          setWouldRecommend(draft.wouldRecommend !== false);
          setMedia(Array.isArray(draft.media) ? draft.media : []);
          if (draft.title || draft.comment) setRestoredDraft(true);
          return;
        }
      }
    } catch {
      // ignore draft read errors
    }

    setRating(5);
    setCategoryRatings(DEFAULT_CATEGORIES);
    setTitle('');
    setComment('');
    setCustomerName(user?.name || '');
    setCustomerEmail(user?.email || '');
    setCompanyName(user?.companyName || '');
    setVariantSummary(defaultVariantSummary);
    setOrderNumber(defaultOrderNumber);
    setWouldRecommend(true);
    setMedia([]);
  }, [isOpen, existingReview, user, defaultVariantSummary, defaultOrderNumber, draftKey]);

  // Persist draft automatically while composing a new review
  useEffect(() => {
    if (!isOpen || isEditing || submittedState) return;
    const timer = window.setTimeout(() => {
      try {
        if (title.trim() || comment.trim() || media.length > 0) {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              rating,
              categoryRatings,
              title,
              comment,
              customerName,
              customerEmail,
              companyName,
              variantSummary,
              orderNumber,
              wouldRecommend,
              media,
            })
          );
        }
      } catch {
        // ignore storage quota errors
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    isOpen,
    isEditing,
    submittedState,
    draftKey,
    rating,
    categoryRatings,
    title,
    comment,
    customerName,
    customerEmail,
    companyName,
    variantSummary,
    orderNumber,
    wouldRecommend,
    media,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isOpen, submitting, onClose]);

  const handleOverallChange = (nextRating: number) => {
    setRating(nextRating);
    setCategoryRatings((prev) => ({
      ...prev,
      overallExperience: nextRating,
    }));
  };

  const handleMediaSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setUploadingMedia(true);

    try {
      const nextItems = [...media];
      for (const file of Array.from(files)) {
        const isVideo = file.type.startsWith('video/');
        const currentImgs = nextItems.filter((m) => m.type === 'image').length;
        const currentVids = nextItems.filter((m) => m.type === 'video').length;

        if (!isVideo && currentImgs >= 5) {
          setErrorMsg('You can attach up to 5 photos per review.');
          continue;
        }
        if (isVideo && currentVids >= 2) {
          setErrorMsg('You can attach up to 2 short videos per review.');
          continue;
        }

        const uploaded = await uploadReviewMediaFile(file);
        nextItems.push(uploaded);
      }
      setMedia(nextItems);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not upload selected file.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMediaItem = (id: string) => {
    setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (rating < 1 || rating > 5) {
      setErrorMsg('Please select an overall star rating.');
      return;
    }
    if (title.trim().length < 3) {
      setErrorMsg('Please enter a brief review headline (at least 3 characters).');
      return;
    }
    if (comment.trim().length < 10) {
      setErrorMsg('Please write at least 10 characters describing your experience.');
      return;
    }
    if (customerName.trim().length < 2) {
      setErrorMsg('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerEmail.trim())) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const photos = media.filter((m) => m.type === 'image').map((m) => m.url);
      const videos = media.filter((m) => m.type === 'video').map((m) => m.url);

      if (isEditing && existingReview) {
        const res = await updateCustomerReview(existingReview.id, {
          customerEmail: customerEmail.trim().toLowerCase(),
          rating,
          categoryRatings,
          title: title.trim(),
          comment: comment.trim(),
          companyName: companyName.trim() || undefined,
          variantSummary: variantSummary.trim() || undefined,
          wouldRecommend,
          photos,
          videos,
          media,
        });
        if (!res.success) {
          setErrorMsg(res.message);
          return;
        }
        setSubmittedState({ message: res.message, status: res.review?.status });
        onSuccess(res);
      } else {
        const res = await submitProductReview({
          productId,
          productName,
          rating,
          categoryRatings,
          title: title.trim(),
          comment: comment.trim(),
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim().toLowerCase(),
          customerId: user?.id,
          companyName: companyName.trim() || undefined,
          variantSummary: variantSummary.trim() || undefined,
          wouldRecommend,
          orderNumber: orderNumber.trim() || undefined,
          photos,
          videos,
          media,
        });
        if (!res.success) {
          setErrorMsg(res.message);
          return;
        }
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // ignore
        }
        setSubmittedState({ message: res.message, status: res.review?.status });
        onSuccess(res);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to submit review right now.');
    } finally {
      setSubmitting(false);
    }
  };

  const guestBlocked = !allowGuestReviews && !user && !isEditing;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[110] bg-[#071B35]/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          onClick={() => !submitting && onClose()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
        >
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl bg-white rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="px-5 sm:px-6 py-4 bg-[#071B35] text-white flex items-start justify-between gap-4 shrink-0">
              <div className="min-w-0">
                <h3
                  id="review-modal-title"
                  className="font-display font-bold text-lg leading-snug text-white"
                >
                  {isEditing ? 'Edit Your Product Review' : 'Write a Product Review'}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5 truncate">{productName}</p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={onClose}
                aria-label="Close review modal"
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1">
              {submittedState ? (
                <motion.div
                  initial={prefersReduced ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-10 text-center space-y-4 max-w-md mx-auto"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h4 className="font-display font-bold text-xl text-[#071B35]">
                    {isEditing ? 'Review Updated' : 'Thank You for Your Review'}
                  </h4>
                  <p className="text-sm text-zinc-600 leading-relaxed">{submittedState.message}</p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-6 py-2.5 rounded-xl bg-[#071B35] hover:bg-[#0d284d] text-white text-sm font-semibold transition-colors cursor-pointer min-h-[44px]"
                    >
                      Done
                    </button>
                  </div>
                </motion.div>
              ) : guestBlocked ? (
                <div className="py-8 text-center space-y-4 max-w-md mx-auto">
                  <h4 className="font-display font-bold text-lg text-[#071B35]">
                    Sign In Required to Review
                  </h4>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    Please sign in to your TeqqnoWorld account so we can link your review and verify your completed orders.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    {onRequestLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onRequestLogin();
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-sm font-semibold transition-colors cursor-pointer min-h-[44px]"
                      >
                        Sign In to Continue
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-sm font-medium transition-colors cursor-pointer min-h-[44px]"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                  {restoredDraft && (
                    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#FAF9FD] border border-zinc-200 text-xs text-zinc-700">
                      <span>Your saved draft for this product was restored.</span>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            localStorage.removeItem(draftKey);
                          } catch {
                            // ignore
                          }
                          setTitle('');
                          setComment('');
                          setMedia([]);
                          setRestoredDraft(false);
                        }}
                        className="font-semibold text-[#FF7A00] hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Clear draft
                      </button>
                    </div>
                  )}

                  {errorMsg && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                      <span>{errorMsg}</span>
                    </div>
                  )}

                  {/* 1. Overall Star Rating */}
                  <div>
                    <label className="block text-sm font-semibold text-[#071B35] mb-1.5">
                      Overall Rating <span className="text-rose-600">*</span>
                    </label>
                    <StarRatingInput value={rating} onChange={handleOverallChange} />
                  </div>

                  {/* 2. Separate Category Ratings */}
                  <div className="pt-4 border-t border-zinc-100">
                    <div className="flex items-baseline justify-between gap-2 mb-3">
                      <span className="text-sm font-semibold text-[#071B35]">
                        Detailed Ratings
                      </span>
                      <span className="text-xs text-zinc-500">Rate each aspect 1–5</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {CATEGORY_FIELDS.map((cat) => {
                        const val = categoryRatings[cat.key];
                        return (
                          <div
                            key={cat.key}
                            className="p-3 rounded-xl bg-[#FAF9FD] border border-zinc-200/80 flex items-center justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[#071B35] truncate">
                                {cat.label}
                              </div>
                              <div className="text-[11px] text-zinc-500 truncate">{cat.hint}</div>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  aria-label={`${cat.label}: ${s} stars`}
                                  onClick={() =>
                                    setCategoryRatings((prev) => ({ ...prev, [cat.key]: s }))
                                  }
                                  className="p-1 rounded hover:scale-110 transition-transform cursor-pointer"
                                >
                                  <Star
                                    className={`w-4 h-4 ${
                                      s <= val
                                        ? 'text-amber-500 fill-amber-500'
                                        : 'text-zinc-300 fill-zinc-100'
                                    }`}
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Headline & Detailed Review */}
                  <div className="space-y-4 pt-4 border-t border-zinc-100">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="review-title-input"
                          className="text-sm font-semibold text-[#071B35]"
                        >
                          Review Title <span className="text-rose-600">*</span>
                        </label>
                        <span className="text-[11px] font-mono tabular-nums text-zinc-400">
                          {title.length}/120
                        </span>
                      </div>
                      <input
                        id="review-title-input"
                        type="text"
                        maxLength={120}
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Summarize your impression in one line"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/15"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label
                          htmlFor="review-comment-input"
                          className="text-sm font-semibold text-[#071B35]"
                        >
                          Your Written Review <span className="text-rose-600">*</span>
                        </label>
                        <span className="text-[11px] font-mono tabular-nums text-zinc-400">
                          {comment.length}/2000
                        </span>
                      </div>
                      <textarea
                        id="review-comment-input"
                        rows={4}
                        maxLength={2000}
                        required
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Share details on fabric/material quality, logo print sharpness, packaging, and delivery turnaround..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/15 resize-y"
                      />
                    </div>
                  </div>

                  {/* 4. Photo & Video Uploads */}
                  <div className="pt-4 border-t border-zinc-100 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-semibold text-[#071B35]">
                          Add Photos or Video
                        </span>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Up to 5 photos (JPG, PNG, WebP) &amp; 2 short videos (MP4, WebM, max 25 MB)
                        </p>
                      </div>
                      <input
                        ref={mediaInputRef}
                        type="file"
                        multiple
                        accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={(e) => {
                          void handleMediaSelect(e.target.files);
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        disabled={uploadingMedia}
                        onClick={() => mediaInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-300 bg-white hover:bg-zinc-50 text-xs font-semibold text-[#071B35] transition-colors cursor-pointer min-h-[40px] disabled:opacity-50"
                      >
                        {uploadingMedia ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#FF7A00]" />
                        ) : (
                          <Camera className="w-4 h-4 text-[#FF7A00]" />
                        )}
                        <span>{uploadingMedia ? 'Uploading...' : 'Upload Media'}</span>
                      </button>
                    </div>

                    {media.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                        {media.map((item) => (
                          <div
                            key={item.id}
                            className="relative aspect-square rounded-xl overflow-hidden border border-zinc-200 bg-zinc-900 group"
                          >
                            {item.type === 'video' ? (
                              <div className="w-full h-full flex flex-col items-center justify-center text-white p-2 text-center">
                                <Film className="w-6 h-6 text-[#FF7A00] mb-1" />
                                <span className="text-[10px] truncate max-w-full opacity-80">
                                  {item.fileName || 'Video'}
                                </span>
                              </div>
                            ) : (
                              <img
                                src={item.url}
                                alt="Uploaded review media"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() => removeMediaItem(item.id)}
                              aria-label="Remove uploaded media"
                              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/75 text-white hover:bg-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 5. Recommendation Toggle */}
                  <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#071B35]">
                      Would you recommend this product?
                    </span>
                    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100">
                      <button
                        type="button"
                        onClick={() => setWouldRecommend(true)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
                          wouldRecommend
                            ? 'bg-white text-emerald-700 shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Yes</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setWouldRecommend(false)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[36px] ${
                          !wouldRecommend
                            ? 'bg-white text-rose-700 shadow-xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                        }`}
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>No</span>
                      </button>
                    </div>
                  </div>

                  {/* 6. Reviewer Details & Optional Order Verification */}
                  <div className="pt-4 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label
                        htmlFor="review-name-input"
                        className="block text-xs font-semibold text-[#071B35] mb-1"
                      >
                        Your Name <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="review-name-input"
                        type="text"
                        required
                        maxLength={80}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Full name"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:border-[#FF7A00]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="review-email-input"
                        className="block text-xs font-semibold text-[#071B35] mb-1"
                      >
                        Email Address <span className="text-rose-600">*</span>
                      </label>
                      <input
                        id="review-email-input"
                        type="email"
                        required
                        disabled={isEditing || Boolean(user?.email)}
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:border-[#FF7A00] disabled:bg-zinc-50 disabled:text-zinc-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="review-company-input"
                        className="block text-xs font-semibold text-[#071B35] mb-1"
                      >
                        Company / Organization <span className="text-zinc-400 font-normal">(Optional)</span>
                      </label>
                      <input
                        id="review-company-input"
                        type="text"
                        maxLength={100}
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. Acme Pvt Ltd, Hyderabad"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:border-[#FF7A00]"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="review-order-input"
                        className="block text-xs font-semibold text-[#071B35] mb-1"
                      >
                        Completed Order ID <span className="text-zinc-400 font-normal">(For Verified badge)</span>
                      </label>
                      <input
                        id="review-order-input"
                        type="text"
                        maxLength={64}
                        disabled={isEditing}
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        placeholder="Checked automatically against delivered orders"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 text-sm text-zinc-900 focus:outline-none focus:border-[#FF7A00] disabled:bg-zinc-50 disabled:text-zinc-500"
                      />
                    </div>
                  </div>

                  {/* Submit Footer */}
                  <div className="pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
                      Your email is never shown publicly. Verified Purchase status is confirmed automatically by our server.
                    </p>
                    <div className="flex items-center gap-2.5 ml-auto">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-xs sm:text-sm font-medium transition-colors cursor-pointer min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || uploadingMedia}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors cursor-pointer min-h-[44px] disabled:opacity-60"
                      >
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{isEditing ? 'Save Changes' : 'Submit Review'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
