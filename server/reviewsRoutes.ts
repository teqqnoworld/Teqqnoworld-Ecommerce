import express, { Request, Response, Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ==============================================================================
// TEQQNOWORLD — PRODUCTION PRODUCT REVIEW & RATING SYSTEM API ROUTER
// - Zero fake/fabricated demo reviews (clean empty state until genuine reviews exist)
// - Individual per-product review isolation linked strictly by productId
// - Separate 5 rating categories + overall rating
// - Multiple photo + short video upload validation & safe local/Supabase serving
// - Strict server-side verified purchase validation against real completed orders
// - Duplicate prevention per (productId, normalizedEmail), unlimited distinct products
// - Full Admin moderation: approve, reject, hide, restore, reply, notes, flag, delete, audit log
// - Non-duplicate email notifications via existing SMTP infrastructure
// ==============================================================================

export type ReviewModerationStatus = 'pending' | 'approved' | 'rejected' | 'hidden';
export type ReviewModerationMode = 'auto_verified' | 'auto_all' | 'manual_all';
export type ReviewReportReason = 'spam' | 'inappropriate' | 'off_topic' | 'misleading';

export interface ReviewCategoryRatings {
  productQuality: number;
  printQuality: number;
  packaging: number;
  valueForMoney: number;
  overallExperience: number;
}

export interface ReviewMediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  mimeType?: string;
  fileName?: string;
}

export interface ReviewModerationLogEntry {
  at: string;
  action: string;
  actor: 'admin' | 'customer' | 'system';
  detail?: string;
}

export interface StoredProductReview {
  id: string;
  productId: string;
  productName: string;
  customerId?: string;
  customerName: string;
  customerEmail: string;
  companyName?: string;
  rating: number;
  categoryRatings: ReviewCategoryRatings;
  title: string;
  comment: string;
  photos: string[];
  videos: string[];
  media: ReviewMediaItem[];
  variantSummary?: string;
  wouldRecommend: boolean;
  verifiedPurchase: boolean;
  orderNumber?: string;
  status: ReviewModerationStatus;
  helpfulVoters: string[];
  isFeatured: boolean;
  reports: Array<{
    voterKey: string;
    reason: ReviewReportReason;
    createdAt: string;
  }>;
  adminReply?: string;
  adminRepliedAt?: string;
  moderationNote?: string;
  moderationHistory: ReviewModerationLogEntry[];
  notifiedAdminAt?: string;
  lastCustomerNotifiedStatus?: 'approved' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStoreSettings {
  moderationMode: ReviewModerationMode;
  allowGuestReviews: boolean;
  allowCustomerEdits: boolean;
  updatedAt: string;
}

interface ReviewStoreData {
  version: number;
  settings: ReviewStoreSettings;
  reviews: StoredProductReview[];
}

export interface ReviewsRouterDependencies {
  verifyAdminRequest: (req: Request) => boolean;
  getSupabaseAdminConfig: () => { url: string; serviceRoleKey: string };
  buildSupabaseAdminHeaders: (
    serviceRoleKey: string,
    includeJsonContentType?: boolean
  ) => Record<string, string>;
  sendNotificationEmail?: (params: {
    to: string;
    subject: string;
    heading: string;
    bodyText: string;
    badge: string;
    note?: string;
  }) => Promise<void>;
  getAdminEmails?: () => string[];
}

const VALID_REPORT_REASONS = new Set<ReviewReportReason>([
  'spam',
  'inappropriate',
  'off_topic',
  'misleading',
]);

const VALID_MODERATION_MODES = new Set<ReviewModerationMode>([
  'auto_verified',
  'auto_all',
  'manual_all',
]);

const VALID_STATUSES = new Set<ReviewModerationStatus>([
  'pending',
  'approved',
  'rejected',
  'hidden',
]);

const ALLOWED_PRODUCT_CATALOG: Record<string, string> = {
  'prod-ceramic-mug': 'Promotional Ceramic Mug',
  'prod-canopy-kiosk': 'Promotional Canopy Kiosk',
  'prod-rollup-standee': 'Rollup Standee',
  'prod-visiting-card-300gsm': 'Premium 300 GSM Visiting Card',
  'prod-promo-table': 'Promo Table',
  'prod-branding-umbrella': '5 Feet Promotional Umbrella',
  'prod-plain-polo': 'Cotton 230 GSM Plain Polo T-Shirt',
  'prod-polo-01': 'Premium Tipping Polo T-Shirt (260 GSM)',
  'prod-joab-coolmax': 'Mars COOLMAX Polo T-Shirt (220 GSM)',
  'prod-matty-polo': 'Matty Polo T-Shirt (230 GSM)',
  'prod-cotton-flexi-caps': 'Cotton Flexi Embroidered Caps',
};

const ALLOWED_MEDIA_MIMES: Record<string, { type: 'image' | 'video'; ext: string; maxBytes: number }> = {
  'image/jpeg': { type: 'image', ext: 'jpg', maxBytes: 8 * 1024 * 1024 },
  'image/jpg': { type: 'image', ext: 'jpg', maxBytes: 8 * 1024 * 1024 },
  'image/png': { type: 'image', ext: 'png', maxBytes: 8 * 1024 * 1024 },
  'image/webp': { type: 'image', ext: 'webp', maxBytes: 8 * 1024 * 1024 },
  'video/mp4': { type: 'video', ext: 'mp4', maxBytes: 25 * 1024 * 1024 },
  'video/webm': { type: 'video', ext: 'webm', maxBytes: 25 * 1024 * 1024 },
  'video/quicktime': { type: 'video', ext: 'mov', maxBytes: 25 * 1024 * 1024 },
};

// Sliding-window rate limiter per IP + action
const rateLimitBuckets = new Map<string, number[]>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateLimitBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    rateLimitBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitBuckets.set(key, timestamps);
  return true;
}

function getClientIp(req: Request): string {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.ip || 'unknown';
}

function normalizeEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function sanitizeText(input: unknown, maxLen: number): string {
  return String(input ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, maxLen);
}

function clampStar(val: unknown, fallback: number): number {
  const num = Math.round(Number(val));
  if (!Number.isFinite(num) || num < 1 || num > 5) return fallback;
  return num;
}

function sanitizeCategoryRatings(raw: unknown, overallRating: number): ReviewCategoryRatings {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    productQuality: clampStar(obj.productQuality, overallRating),
    printQuality: clampStar(obj.printQuality, overallRating),
    packaging: clampStar(obj.packaging, overallRating),
    valueForMoney: clampStar(obj.valueForMoney, overallRating),
    overallExperience: clampStar(obj.overallExperience, overallRating),
  };
}

function isSafeMediaUrl(url: string, expectedType: 'image' | 'video'): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (expectedType === 'image') {
    if (
      /^data:image\/(webp|jpeg|jpg|png);base64,[A-Za-z0-9+/=]+$/i.test(trimmed) &&
      trimmed.length <= 2_400_000
    ) {
      return true;
    }
    if (/^\/api\/reviews\/media\/[a-zA-Z0-9_-]+\.(webp|png|jpg|jpeg)$/i.test(trimmed)) {
      return true;
    }
    if (/^\/assets\/[a-zA-Z0-9._/-]+\.(webp|png|jpg|jpeg)$/i.test(trimmed)) {
      return true;
    }
  } else {
    if (/^\/api\/reviews\/media\/[a-zA-Z0-9_-]+\.(mp4|webm|mov)$/i.test(trimmed)) {
      return true;
    }
  }
  if (trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:' && trimmed.length <= 2048;
    } catch {
      return false;
    }
  }
  return false;
}

function sanitizeMediaCollections(raw: {
  photos?: unknown;
  videos?: unknown;
  media?: unknown;
}): { photos: string[]; videos: string[]; media: ReviewMediaItem[] } {
  const media: ReviewMediaItem[] = [];
  const seen = new Set<string>();

  const pushItem = (type: 'image' | 'video', url: string, mimeType?: string, fileName?: string) => {
    const clean = String(url || '').trim();
    if (!clean || seen.has(clean)) return;
    if (!isSafeMediaUrl(clean, type)) return;
    const imgCount = media.filter((m) => m.type === 'image').length;
    const vidCount = media.filter((m) => m.type === 'video').length;
    if (type === 'image' && imgCount >= 5) return;
    if (type === 'video' && vidCount >= 2) return;
    seen.add(clean);
    media.push({
      id: `med-${crypto.randomBytes(5).toString('hex')}`,
      type,
      url: clean,
      mimeType,
      fileName: fileName ? sanitizeText(fileName, 120) : undefined,
    });
  };

  if (Array.isArray(raw.media)) {
    for (const item of raw.media) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Record<string, unknown>;
      const t = rec.type === 'video' ? 'video' : 'image';
      pushItem(t, String(rec.url || ''), rec.mimeType ? String(rec.mimeType) : undefined, rec.fileName ? String(rec.fileName) : undefined);
    }
  }
  if (Array.isArray(raw.photos)) {
    for (const p of raw.photos) {
      if (typeof p === 'string') pushItem('image', p);
    }
  }
  if (Array.isArray(raw.videos)) {
    for (const v of raw.videos) {
      if (typeof v === 'string') pushItem('video', v);
    }
  }

  return {
    photos: media.filter((m) => m.type === 'image').map((m) => m.url),
    videos: media.filter((m) => m.type === 'video').map((m) => m.url),
    media,
  };
}

function resolveWritableDataDir(): string {
  const projectDataDir = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(projectDataDir)) {
      fs.mkdirSync(projectDataDir, { recursive: true });
    }
    const testPath = path.join(projectDataDir, '.write-check');
    fs.writeFileSync(testPath, 'ok', 'utf8');
    fs.unlinkSync(testPath);
    return projectDataDir;
  } catch {
    return os.tmpdir();
  }
}

export function createReviewsRouter(deps: ReviewsRouterDependencies): Router {
  const router = express.Router();
  const baseDataDir = resolveWritableDataDir();
  const storePath = path.join(baseDataDir, 'teqqno-product-reviews.json');
  const mediaDir = path.resolve(baseDataDir, 'review-media');

  try {
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
    }
  } catch {
    // ignore mkdir error if read-only
  }

  function loadStore(): ReviewStoreData {
    try {
      if (fs.existsSync(storePath)) {
        const parsed = JSON.parse(fs.readFileSync(storePath, 'utf8'));
        if (parsed && Array.isArray(parsed.reviews)) {
          // Ensure backwards compatibility if any legacy rows lack new fields
          const normalizedReviews: StoredProductReview[] = parsed.reviews
            .filter((r: any) => r && !String(r.id || '').startsWith('rev-mug-0') && !String(r.customerEmail || '').endsWith('.example'))
            .map((r: any) => {
              const rating = clampStar(r.rating, 5);
              const mediaBundle = sanitizeMediaCollections({
                photos: r.photos,
                videos: r.videos,
                media: r.media,
              });
              return {
                ...r,
                rating,
                categoryRatings: sanitizeCategoryRatings(r.categoryRatings, rating),
                photos: mediaBundle.photos,
                videos: mediaBundle.videos,
                media: mediaBundle.media,
                helpfulVoters: Array.isArray(r.helpfulVoters) ? r.helpfulVoters : [],
                reports: Array.isArray(r.reports) ? r.reports : [],
                moderationHistory: Array.isArray(r.moderationHistory) ? r.moderationHistory : [],
              };
            });

          return {
            version: 2,
            settings: {
              moderationMode: VALID_MODERATION_MODES.has(parsed.settings?.moderationMode)
                ? parsed.settings.moderationMode
                : 'auto_verified',
              allowGuestReviews:
                typeof parsed.settings?.allowGuestReviews === 'boolean'
                  ? parsed.settings.allowGuestReviews
                  : true,
              allowCustomerEdits:
                typeof parsed.settings?.allowCustomerEdits === 'boolean'
                  ? parsed.settings.allowCustomerEdits
                  : true,
              updatedAt: parsed.settings?.updatedAt || new Date().toISOString(),
            },
            reviews: normalizedReviews,
          };
        }
      }
    } catch (err) {
      console.warn('[Reviews Store Read Warning]:', err);
    }

    // Genuine production start: ZERO fabricated demo reviews!
    const initial: ReviewStoreData = {
      version: 2,
      settings: {
        moderationMode: 'auto_verified',
        allowGuestReviews: true,
        allowCustomerEdits: true,
        updatedAt: new Date().toISOString(),
      },
      reviews: [],
    };
    saveStore(initial);
    return initial;
  }

  function saveStore(data: ReviewStoreData): void {
    try {
      fs.writeFileSync(storePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn('[Reviews Store Write Warning]:', err);
    }
  }

  // Non-blocking mirror to Supabase `product_reviews` when service role key is configured
  async function mirrorReviewToSupabase(review: StoredProductReview): Promise<void> {
    try {
      const { url, serviceRoleKey } = deps.getSupabaseAdminConfig();
      if (!serviceRoleKey) return;
      await fetch(`${url}/rest/v1/product_reviews?on_conflict=product_id,customer_email_normalized`, {
        method: 'POST',
        headers: {
          ...deps.buildSupabaseAdminHeaders(serviceRoleKey, true),
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          product_id: review.productId,
          product_name: review.productName,
          customer_id: review.customerId || null,
          customer_name: review.customerName,
          customer_email: review.customerEmail,
          company_name: review.companyName || null,
          rating: review.rating,
          rating_product_quality: review.categoryRatings.productQuality,
          rating_print_quality: review.categoryRatings.printQuality,
          rating_packaging: review.categoryRatings.packaging,
          rating_value_for_money: review.categoryRatings.valueForMoney,
          rating_overall_experience: review.categoryRatings.overallExperience,
          title: review.title,
          comment: review.comment,
          photos: review.photos,
          videos: review.videos,
          variant_summary: review.variantSummary || null,
          would_recommend: review.wouldRecommend,
          verified_purchase: review.verifiedPurchase,
          order_number: review.orderNumber || null,
          status: review.status,
          helpful_count: review.helpfulVoters.length,
          is_featured: review.isFeatured,
          report_count: review.reports.length,
          admin_reply: review.adminReply || null,
          admin_replied_at: review.adminRepliedAt || null,
          moderation_note: review.moderationNote || null,
          moderation_history: review.moderationHistory,
          created_at: review.createdAt,
          updated_at: review.updatedAt,
        }),
      }).catch(() => undefined);
    } catch {
      // Non-blocking best-effort Supabase sync
    }
  }

  /**
   * Strict Server-Side Verified Purchase Validation.
   * Never trusts a client-supplied verified flag.
   * Validates against actual completed/delivered orders in Supabase `custom_orders`
   * matching customer email AND exact purchased productId (and optional order reference).
   */
  async function verifyPurchaseServerSide(params: {
    customerEmail: string;
    productId: string;
    orderNumber?: string;
  }): Promise<{ verified: boolean; matchedOrderNumber?: string }> {
    const cleanEmail = normalizeEmail(params.customerEmail);
    const cleanOrder = sanitizeText(params.orderNumber, 64);

    if (!cleanEmail || !params.productId) {
      return { verified: false };
    }

    try {
      const { url, serviceRoleKey } = deps.getSupabaseAdminConfig();
      if (!serviceRoleKey) {
        return { verified: false };
      }

      const query = new URLSearchParams({
        customer_email: `ilike.${cleanEmail}`,
        select: 'id,product_id,status,custom_notes,created_at',
        limit: '100',
      });

      const resp = await fetch(`${url}/rest/v1/custom_orders?${query.toString()}`, {
        method: 'GET',
        headers: deps.buildSupabaseAdminHeaders(serviceRoleKey, false),
      });

      if (!resp.ok) {
        return { verified: false };
      }

      const rows = (await resp.json()) as Array<{
        id?: string;
        product_id?: string | null;
        status?: string | null;
        custom_notes?: string | null;
      }>;

      if (!Array.isArray(rows) || rows.length === 0) {
        return { verified: false };
      }

      // Match strictly COMPLETED ('delivered') orders for this exact customer AND exact productId
      const matched = rows.find((row) => {
        const st = String(row.status || '').toLowerCase();
        if (st !== 'delivered') return false;

        const notes = String(row.custom_notes || '');
        const productMatched =
          row.product_id === params.productId || notes.includes(params.productId);
        if (!productMatched) return false;

        if (cleanOrder) {
          const orderMatched =
            String(row.id || '').toLowerCase().includes(cleanOrder.toLowerCase()) ||
            notes.toLowerCase().includes(cleanOrder.toLowerCase());
          return orderMatched;
        }
        return true;
      });

      if (matched) {
        return {
          verified: true,
          matchedOrderNumber:
            cleanOrder ||
            (matched.id ? `ORD-${String(matched.id).slice(0, 8).toUpperCase()}` : undefined),
        };
      }
    } catch {
      return { verified: false };
    }

    return { verified: false };
  }

  function toPublicReview(
    r: StoredProductReview,
    options?: { viewerEmail?: string; voterKey?: string; includePrivate?: boolean }
  ) {
    const cleanViewerEmail = normalizeEmail(options?.viewerEmail || '');
    const isOwner = Boolean(cleanViewerEmail && normalizeEmail(r.customerEmail) === cleanViewerEmail);
    const voterKey = options?.voterKey || '';
    const viewerHasVotedHelpful = Boolean(voterKey && r.helpfulVoters.includes(voterKey));
    const uniqueReasons = Array.from(new Set((r.reports || []).map((rep) => rep.reason)));

    return {
      id: r.id,
      productId: r.productId,
      productName: r.productName,
      customerId: r.customerId,
      customerName: r.customerName,
      ...(options?.includePrivate || isOwner ? { customerEmail: r.customerEmail } : {}),
      companyName: r.companyName,
      rating: r.rating,
      categoryRatings: r.categoryRatings,
      title: r.title,
      comment: r.comment,
      photos: r.photos || [],
      videos: r.videos || [],
      media: r.media || [],
      variantSummary: r.variantSummary,
      wouldRecommend: r.wouldRecommend,
      verifiedPurchase: r.verifiedPurchase,
      orderNumber: options?.includePrivate || isOwner ? r.orderNumber : undefined,
      status: r.status,
      helpfulCount: (r.helpfulVoters || []).length,
      viewerHasVotedHelpful,
      isOwner,
      isFeatured: Boolean(r.isFeatured),
      reportCount: (r.reports || []).length,
      ...(options?.includePrivate
        ? {
            reportReasons: uniqueReasons,
            moderationNote: r.moderationNote,
            moderationHistory: r.moderationHistory || [],
          }
        : {}),
      adminReply: r.adminReply,
      adminRepliedAt: r.adminRepliedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  /**
   * Computes ratings strictly from APPROVED (published) reviews only.
   * Pending, rejected, hidden, and deleted reviews NEVER affect public ratings.
   */
  function computeProductSummary(productId: string, allReviews: StoredProductReview[]) {
    const approved = allReviews.filter(
      (r) => r.productId === productId && r.status === 'approved'
    );
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    let verifiedCount = 0;
    let photoReviewCount = 0;
    let videoReviewCount = 0;
    let recommendCount = 0;

    const catSum = {
      productQuality: 0,
      printQuality: 0,
      packaging: 0,
      valueForMoney: 0,
      overallExperience: 0,
    };

    for (const r of approved) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
      dist[star] += 1;
      sum += star;
      if (r.verifiedPurchase) verifiedCount += 1;
      if (Array.isArray(r.photos) && r.photos.length > 0) photoReviewCount += 1;
      if (Array.isArray(r.videos) && r.videos.length > 0) videoReviewCount += 1;
      if (r.wouldRecommend) recommendCount += 1;

      const c = r.categoryRatings || sanitizeCategoryRatings(null, star);
      catSum.productQuality += c.productQuality;
      catSum.printQuality += c.printQuality;
      catSum.packaging += c.packaging;
      catSum.valueForMoney += c.valueForMoney;
      catSum.overallExperience += c.overallExperience;
    }

    const totalReviews = approved.length;
    const avg = (total: number) =>
      totalReviews > 0 ? Math.round((total / totalReviews) * 10) / 10 : 0;

    return {
      productId,
      averageRating: avg(sum),
      totalReviews,
      verifiedCount,
      photoReviewCount,
      videoReviewCount,
      recommendPercent:
        totalReviews > 0 ? Math.round((recommendCount / totalReviews) * 100) : 0,
      distribution: dist,
      categoryAverages: {
        productQuality: avg(catSum.productQuality),
        printQuality: avg(catSum.printQuality),
        packaging: avg(catSum.packaging),
        valueForMoney: avg(catSum.valueForMoney),
        overallExperience: avg(catSum.overallExperience),
      },
    };
  }

  function relevanceScore(r: StoredProductReview): number {
    const ageDays = Math.max(
      0,
      (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    const recencyBoost = Math.max(0, 30 - ageDays) * 0.4;
    const verifiedBoost = r.verifiedPurchase ? 18 : 0;
    const featuredBoost = r.isFeatured ? 25 : 0;
    const mediaBoost = (r.photos?.length || 0) * 4 + (r.videos?.length || 0) * 7;
    const helpfulBoost = (r.helpfulVoters?.length || 0) * 3;
    const depthBoost = Math.min(10, Math.floor((r.comment?.length || 0) / 80));
    return featuredBoost + verifiedBoost + mediaBoost + helpfulBoost + depthBoost + recencyBoost;
  }

  // ============================================================================
  // 0. MEDIA UPLOAD & SERVING (Images + Short Videos, Strict Validation)
  // ============================================================================
  router.post(
    '/reviews/upload-media',
    express.raw({ type: '*/*', limit: '26mb' }),
    async (req: Request, res: Response) => {
      try {
        const ip = getClientIp(req);
        if (!checkRateLimit(`upload-media:${ip}`, 25, 15 * 60 * 1000)) {
          return res.status(429).json({
            success: false,
            message: 'Too many file uploads. Please wait a few minutes.',
          });
        }

        const rawContentType = String(req.headers['content-type'] || '')
          .split(';')[0]
          .trim()
          .toLowerCase();
        const rule = ALLOWED_MEDIA_MIMES[rawContentType];
        if (!rule) {
          return res.status(400).json({
            success: false,
            message: 'Unsupported file format. Allowed: JPG, PNG, WebP images and MP4, WebM, MOV videos.',
          });
        }

        const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (buf.length === 0) {
          return res.status(400).json({ success: false, message: 'Uploaded file is empty.' });
        }
        if (buf.length > rule.maxBytes) {
          const maxMb = Math.round(rule.maxBytes / (1024 * 1024));
          return res.status(413).json({
            success: false,
            message: `File exceeds the ${maxMb} MB limit for ${rule.type}s.`,
          });
        }

        const safeFileName = `rev_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.${rule.ext}`;

        // Try Supabase Storage bucket `review-media` first if service key is configured
        const { url: sbUrl, serviceRoleKey } = deps.getSupabaseAdminConfig();
        if (serviceRoleKey) {
          try {
            const uploadResp = await fetch(
              `${sbUrl}/storage/v1/object/review-media/${encodeURIComponent(safeFileName)}`,
              {
                method: 'POST',
                headers: {
                  ...deps.buildSupabaseAdminHeaders(serviceRoleKey, false),
                  'Content-Type': rawContentType,
                  'x-upsert': 'true',
                },
                body: new Uint8Array(buf),
              }
            );
            if (uploadResp.ok) {
              const publicUrl = `${sbUrl}/storage/v1/object/public/review-media/${encodeURIComponent(safeFileName)}`;
              return res.status(201).json({
                success: true,
                media: {
                  id: `med-${crypto.randomBytes(5).toString('hex')}`,
                  type: rule.type,
                  url: publicUrl,
                  mimeType: rawContentType,
                  fileName: sanitizeText(req.headers['x-file-name'], 120) || safeFileName,
                },
              });
            }
          } catch {
            // Fall back cleanly to confined local storage below
          }
        }

        // Fallback: save to confined mediaDir and serve via /api/reviews/media/:filename
        const resolvedTarget = path.resolve(mediaDir, safeFileName);
        if (!resolvedTarget.startsWith(mediaDir + path.sep)) {
          return res.status(400).json({ success: false, message: 'Invalid file path.' });
        }
        fs.writeFileSync(resolvedTarget, buf);

        return res.status(201).json({
          success: true,
          media: {
            id: `med-${crypto.randomBytes(5).toString('hex')}`,
            type: rule.type,
            url: `/api/reviews/media/${safeFileName}`,
            mimeType: rawContentType,
            fileName: sanitizeText(req.headers['x-file-name'], 120) || safeFileName,
          },
        });
      } catch (err: any) {
        console.error('[Review Media Upload Error]:', err);
        return res.status(500).json({
          success: false,
          message: 'Could not upload review media. Please try again.',
        });
      }
    }
  );

  router.get('/reviews/media/:filename', (req: Request, res: Response) => {
    const filename = String(req.params.filename || '').trim();
    if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp|mp4|webm|mov)$/i.test(filename)) {
      return res.status(400).send('Invalid filename');
    }
    const resolved = path.resolve(mediaDir, filename);
    if (!resolved.startsWith(mediaDir + path.sep) || !fs.existsSync(resolved)) {
      return res.status(404).send('Media not found');
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(resolved);
  });

  // ============================================================================
  // 1. PUBLIC: ALL PRODUCT RATING SUMMARIES (strictly published reviews only)
  // ============================================================================
  router.get('/reviews/summaries', (_req: Request, res: Response) => {
    const store = loadStore();
    const productIds = new Set<string>(Object.keys(ALLOWED_PRODUCT_CATALOG));
    for (const r of store.reviews) {
      if (r.productId) productIds.add(r.productId);
    }

    const summaries: Record<string, ReturnType<typeof computeProductSummary>> = {};
    for (const pid of productIds) {
      summaries[pid] = computeProductSummary(pid, store.reviews);
    }

    return res.json({
      success: true,
      summaries,
      settings: {
        allowGuestReviews: store.settings.allowGuestReviews,
        allowCustomerEdits: store.settings.allowCustomerEdits,
        moderationMode: store.settings.moderationMode,
      },
    });
  });

  // ============================================================================
  // 2. PUBLIC: PER-PRODUCT REVIEWS (Filtered, Sorted, Paginated, Isolated)
  // ============================================================================
  router.get('/reviews/product/:productId', (req: Request, res: Response) => {
    const productId = sanitizeText(req.params.productId, 80);
    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    const store = loadStore();
    const viewerEmail = normalizeEmail(String(req.query.viewerEmail || ''));
    const voterKey = sanitizeText(req.query.voterKey, 100) || viewerEmail || getClientIp(req);
    const starFilter = Number(req.query.rating || 0);
    const verifiedOnly = String(req.query.verifiedOnly || '') === 'true';
    const withPhotos = String(req.query.withPhotos || '') === 'true';
    const search = sanitizeText(req.query.search, 100).toLowerCase();
    const sort = String(req.query.sort || 'relevant');
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 8) || 8));

    const summary = computeProductSummary(productId, store.reviews);

    // Strictly isolated to this exact productId
    const productReviews = store.reviews.filter((r) => r.productId === productId);

    const viewerExisting = viewerEmail
      ? productReviews.find((r) => normalizeEmail(r.customerEmail) === viewerEmail)
      : undefined;

    // Public list: strictly approved reviews + viewer's own pending review so they see their submission status
    let visible = productReviews.filter(
      (r) =>
        r.status === 'approved' ||
        (viewerEmail &&
          normalizeEmail(r.customerEmail) === viewerEmail &&
          r.status === 'pending')
    );

    // Collect gallery media (photos & videos) ONLY from approved reviews of THIS product
    const galleryMedia: Array<{
      id: string;
      type: 'image' | 'video';
      photoUrl: string;
      reviewId: string;
      customerName: string;
      rating: number;
      title: string;
      variantSummary?: string;
      verifiedPurchase: boolean;
      createdAt: string;
    }> = [];

    for (const r of productReviews) {
      if (r.status !== 'approved') continue;
      for (const m of r.media || []) {
        galleryMedia.push({
          id: m.id,
          type: m.type,
          photoUrl: m.url,
          reviewId: r.id,
          customerName: r.customerName,
          rating: r.rating,
          title: r.title,
          variantSummary: r.variantSummary,
          verifiedPurchase: r.verifiedPurchase,
          createdAt: r.createdAt,
        });
      }
    }

    if (starFilter >= 1 && starFilter <= 5) {
      visible = visible.filter((r) => Math.round(r.rating) === starFilter);
    }
    if (verifiedOnly) {
      visible = visible.filter((r) => r.verifiedPurchase);
    }
    if (withPhotos) {
      visible = visible.filter((r) => (r.media?.length || 0) > 0);
    }
    if (search) {
      visible = visible.filter(
        (r) =>
          r.title.toLowerCase().includes(search) ||
          r.comment.toLowerCase().includes(search) ||
          r.customerName.toLowerCase().includes(search) ||
          (r.companyName || '').toLowerCase().includes(search) ||
          (r.variantSummary || '').toLowerCase().includes(search)
      );
    }

    visible.sort((a, b) => {
      if (sort === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === 'helpful') {
        const diff = (b.helpfulVoters?.length || 0) - (a.helpfulVoters?.length || 0);
        if (diff !== 0) return diff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === 'highest') {
        if (b.rating !== a.rating) return b.rating - a.rating;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sort === 'lowest') {
        if (a.rating !== b.rating) return a.rating - b.rating;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      // Default: 'relevant'
      return relevanceScore(b) - relevanceScore(a);
    });

    const totalFiltered = visible.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / limit));
    const safePage = Math.min(page, totalPages);
    const startIdx = (safePage - 1) * limit;
    const paged = visible.slice(startIdx, startIdx + limit);

    return res.json({
      success: true,
      summary,
      reviews: paged.map((r) => toPublicReview(r, { viewerEmail, voterKey })),
      viewerReview: viewerExisting
        ? toPublicReview(viewerExisting, { viewerEmail, voterKey })
        : null,
      galleryPhotos: galleryMedia,
      pagination: {
        page: safePage,
        limit,
        totalFiltered,
        totalPages,
        hasMore: safePage < totalPages,
      },
      settings: {
        allowGuestReviews: store.settings.allowGuestReviews,
        allowCustomerEdits: store.settings.allowCustomerEdits,
        moderationMode: store.settings.moderationMode,
      },
    });
  });

  // ============================================================================
  // 3. CUSTOMER: FETCH OWN REVIEWS ACROSS ALL PRODUCTS
  // ============================================================================
  router.get('/reviews/customer', (req: Request, res: Response) => {
    const email = normalizeEmail(String(req.query.email || ''));
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Valid customer email is required.' });
    }
    const store = loadStore();
    const mine = store.reviews
      .filter((r) => normalizeEmail(r.customerEmail) === email)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({
      success: true,
      allowCustomerEdits: store.settings.allowCustomerEdits,
      reviews: mine.map((r) => toPublicReview(r, { viewerEmail: email, voterKey: email })),
    });
  });

  // ============================================================================
  // 4. CUSTOMER: CREATE NEW PRODUCT REVIEW
  // ============================================================================
  router.post('/reviews', async (req: Request, res: Response) => {
    try {
      const ip = getClientIp(req);
      if (!checkRateLimit(`create:${ip}`, 10, 15 * 60 * 1000)) {
        return res.status(429).json({
          success: false,
          message: 'Too many review submissions from this network. Please wait a few minutes.',
        });
      }

      const store = loadStore();
      const productId = sanitizeText(req.body?.productId, 80);
      const productName =
        sanitizeText(req.body?.productName, 160) ||
        ALLOWED_PRODUCT_CATALOG[productId] ||
        'TeqqnoWorld Custom Product';
      const rating = Math.round(Number(req.body?.rating));
      const categoryRatings = sanitizeCategoryRatings(req.body?.categoryRatings, rating);
      const title = sanitizeText(req.body?.title, 120);
      const comment = sanitizeText(req.body?.comment, 2000);
      const customerName = sanitizeText(req.body?.customerName, 80);
      const customerEmail = normalizeEmail(req.body?.customerEmail);
      const customerId = sanitizeText(req.body?.customerId, 80) || undefined;
      const companyName = sanitizeText(req.body?.companyName, 100) || undefined;
      const variantSummary = sanitizeText(req.body?.variantSummary, 140) || undefined;
      const orderNumber = sanitizeText(req.body?.orderNumber, 64) || undefined;
      const wouldRecommend = req.body?.wouldRecommend !== false;
      const mediaBundle = sanitizeMediaCollections({
        photos: req.body?.photos,
        videos: req.body?.videos,
        media: req.body?.media,
      });

      if (!productId) {
        return res.status(400).json({ success: false, message: 'Product ID is required.' });
      }
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: 'Please select an overall star rating between 1 and 5.',
        });
      }
      if (title.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a short review headline (min 3 characters).',
        });
      }
      if (comment.length < 10) {
        return res.status(400).json({
          success: false,
          message: 'Please share at least 10 characters of written feedback.',
        });
      }
      if (customerName.length < 2) {
        return res.status(400).json({ success: false, message: 'Please enter your name.' });
      }
      if (!isValidEmail(customerEmail)) {
        return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
      }
      if (!store.settings.allowGuestReviews && !customerId) {
        return res.status(403).json({
          success: false,
          message: 'Please sign in to your TeqqnoWorld account to submit a product review.',
        });
      }

      // Duplicate prevention strictly per (productId, customerEmail)
      // Customers CAN freely review multiple distinct products!
      const duplicate = store.reviews.find(
        (r) =>
          r.productId === productId &&
          normalizeEmail(r.customerEmail) === customerEmail
      );
      if (duplicate) {
        return res.status(409).json({
          success: false,
          duplicate: true,
          existingReviewId: duplicate.id,
          message:
            'You have already reviewed this product. You can edit your existing review or review a different product.',
        });
      }

      // Server-authoritative Verified Purchase validation (NEVER trusts client flag)
      const purchaseCheck = await verifyPurchaseServerSide({
        customerEmail,
        productId,
        orderNumber,
      });

      // Moderation decision strictly server-side (customers can never self-approve)
      let status: ReviewModerationStatus = 'pending';
      if (store.settings.moderationMode === 'manual_all') {
        status = 'pending';
      } else if (store.settings.moderationMode === 'auto_verified') {
        status = purchaseCheck.verified ? 'approved' : 'pending';
      } else {
        status = 'approved';
      }

      const nowIso = new Date().toISOString();
      const newReview: StoredProductReview = {
        id: `rev-${crypto.randomBytes(8).toString('hex')}`,
        productId,
        productName,
        customerId,
        customerName,
        customerEmail,
        companyName,
        rating,
        categoryRatings,
        title,
        comment,
        photos: mediaBundle.photos,
        videos: mediaBundle.videos,
        media: mediaBundle.media,
        variantSummary,
        wouldRecommend,
        verifiedPurchase: purchaseCheck.verified,
        orderNumber: purchaseCheck.matchedOrderNumber || orderNumber,
        status,
        helpfulVoters: [],
        isFeatured: false,
        reports: [],
        moderationHistory: [
          {
            at: nowIso,
            action: status === 'approved' ? 'submitted_auto_approved' : 'submitted_pending',
            actor: 'customer',
            detail: purchaseCheck.verified
              ? `Verified purchase (${purchaseCheck.matchedOrderNumber || 'matched order'})`
              : 'Unverified review submission',
          },
        ],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      // Notify admins once (non-blocking, duplicate-safe via notifiedAdminAt)
      if (deps.sendNotificationEmail && deps.getAdminEmails && !newReview.notifiedAdminAt) {
        const adminEmails = deps.getAdminEmails();
        if (adminEmails.length > 0) {
          newReview.notifiedAdminAt = nowIso;
          void deps
            .sendNotificationEmail({
              to: adminEmails.join(', '),
              subject: `New ${rating}★ Review Submitted — ${productName}`,
              badge: 'PRODUCT REVIEW NOTIFICATION',
              heading: `New ${rating}-Star Review on ${productName}`,
              bodyText: `${customerName} (${purchaseCheck.verified ? 'Verified Purchase' : 'Unverified Review'}) submitted "${title}". Status: ${status.toUpperCase()}. Open Admin Hub -> Reviews to moderate or reply.`,
              note: `Review ID: ${newReview.id}`,
            })
            .catch(() => undefined);
        }
      }

      store.reviews.unshift(newReview);
      saveStore(store);
      void mirrorReviewToSupabase(newReview);

      const summary = computeProductSummary(productId, store.reviews);
      return res.status(201).json({
        success: true,
        review: toPublicReview(newReview, { viewerEmail: customerEmail, voterKey: customerEmail }),
        summary,
        message:
          status === 'approved'
            ? 'Thank you! Your review has been published.'
            : 'Thank you! Your review has been received and is awaiting quick admin review.',
      });
    } catch (err: any) {
      console.error('[Reviews Create Error]:', err);
      return res.status(500).json({
        success: false,
        message: 'Could not save your review right now. Please try again.',
      });
    }
  });

  // ============================================================================
  // 5. CUSTOMER: EDIT OWN REVIEW (Cannot self-approve or alter verifiedPurchase)
  // ============================================================================
  router.put('/reviews/:id', (req: Request, res: Response) => {
    const reviewId = sanitizeText(req.params.id, 80);
    const customerEmail = normalizeEmail(req.body?.customerEmail);
    if (!reviewId || !isValidEmail(customerEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Valid review ID and account email are required.',
      });
    }

    const store = loadStore();
    if (!store.settings.allowCustomerEdits) {
      return res.status(403).json({
        success: false,
        message: 'Editing submitted reviews is currently disabled by store policy.',
      });
    }

    const idx = store.reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    const existing = store.reviews[idx];
    if (normalizeEmail(existing.customerEmail) !== customerEmail) {
      return res.status(403).json({ success: false, message: 'You can only edit your own review.' });
    }

    const rating = Math.round(Number(req.body?.rating ?? existing.rating));
    const categoryRatings = sanitizeCategoryRatings(
      req.body?.categoryRatings ?? existing.categoryRatings,
      rating
    );
    const title = sanitizeText(req.body?.title ?? existing.title, 120);
    const comment = sanitizeText(req.body?.comment ?? existing.comment, 2000);
    const companyName =
      req.body?.companyName !== undefined
        ? sanitizeText(req.body.companyName, 100) || undefined
        : existing.companyName;
    const variantSummary =
      req.body?.variantSummary !== undefined
        ? sanitizeText(req.body.variantSummary, 140) || undefined
        : existing.variantSummary;
    const wouldRecommend =
      req.body?.wouldRecommend !== undefined
        ? Boolean(req.body.wouldRecommend)
        : existing.wouldRecommend;

    const mediaBundle =
      req.body?.media !== undefined || req.body?.photos !== undefined || req.body?.videos !== undefined
        ? sanitizeMediaCollections({
            photos: req.body?.photos,
            videos: req.body?.videos,
            media: req.body?.media,
          })
        : { photos: existing.photos, videos: existing.videos, media: existing.media };

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }
    if (title.length < 3 || comment.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Headline (min 3 chars) and written review (min 10 chars) are required.',
      });
    }

    const nowIso = new Date().toISOString();
    // Explicitly preserve verifiedPurchase & status (customer cannot self-approve or spoof verification)
    const updated: StoredProductReview = {
      ...existing,
      rating,
      categoryRatings,
      title,
      comment,
      companyName,
      variantSummary,
      wouldRecommend,
      photos: mediaBundle.photos,
      videos: mediaBundle.videos,
      media: mediaBundle.media,
      moderationHistory: [
        ...(existing.moderationHistory || []),
        { at: nowIso, action: 'edited_by_customer', actor: 'customer' as const },
      ].slice(-25),
      updatedAt: nowIso,
    };

    store.reviews[idx] = updated;
    saveStore(store);
    void mirrorReviewToSupabase(updated);

    return res.json({
      success: true,
      review: toPublicReview(updated, { viewerEmail: customerEmail, voterKey: customerEmail }),
      summary: computeProductSummary(updated.productId, store.reviews),
      message: 'Your review has been updated.',
    });
  });

  // ============================================================================
  // 6. CUSTOMER: DELETE OWN REVIEW
  // ============================================================================
  router.delete('/reviews/:id', (req: Request, res: Response) => {
    const reviewId = sanitizeText(req.params.id, 80);
    const customerEmail = normalizeEmail(
      String(req.body?.customerEmail || req.query.customerEmail || '')
    );

    if (!reviewId || !isValidEmail(customerEmail)) {
      return res.status(400).json({ success: false, message: 'Valid review ID and email are required.' });
    }

    const store = loadStore();
    const idx = store.reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    const target = store.reviews[idx];
    if (normalizeEmail(target.customerEmail) !== customerEmail) {
      return res.status(403).json({ success: false, message: 'You can only delete your own review.' });
    }

    store.reviews.splice(idx, 1);
    saveStore(store);

    return res.json({
      success: true,
      summary: computeProductSummary(target.productId, store.reviews),
      message: 'Your review has been deleted.',
    });
  });

  // ============================================================================
  // 7. PUBLIC: TOGGLE HELPFUL VOTE
  // ============================================================================
  router.post('/reviews/:id/helpful', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`helpful:${ip}`, 40, 5 * 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Too many requests. Please slow down.' });
    }

    const reviewId = sanitizeText(req.params.id, 80);
    const voterKey = sanitizeText(req.body?.voterKey, 100) || `ip:${ip}`;
    const store = loadStore();
    const review = store.reviews.find((r) => r.id === reviewId);
    if (!review || review.status !== 'approved') {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    if (!Array.isArray(review.helpfulVoters)) review.helpfulVoters = [];
    const existingIdx = review.helpfulVoters.indexOf(voterKey);
    let voted = false;
    if (existingIdx >= 0) {
      review.helpfulVoters.splice(existingIdx, 1);
      voted = false;
    } else {
      review.helpfulVoters.push(voterKey);
      voted = true;
    }

    saveStore(store);
    return res.json({
      success: true,
      reviewId: review.id,
      helpfulCount: review.helpfulVoters.length,
      viewerHasVotedHelpful: voted,
    });
  });

  // ============================================================================
  // 8. PUBLIC: REPORT REVIEW FOR ABUSE / SPAM
  // ============================================================================
  router.post('/reviews/:id/report', (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`report:${ip}`, 10, 15 * 60 * 1000)) {
      return res.status(429).json({ success: false, message: 'Too many report submissions.' });
    }

    const reviewId = sanitizeText(req.params.id, 80);
    const reason = sanitizeText(req.body?.reason, 40) as ReviewReportReason;
    const voterKey = sanitizeText(req.body?.voterKey, 100) || `ip:${ip}`;

    if (!VALID_REPORT_REASONS.has(reason)) {
      return res.status(400).json({ success: false, message: 'Please select a valid report reason.' });
    }

    const store = loadStore();
    const review = store.reviews.find((r) => r.id === reviewId);
    if (!review) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    if (!Array.isArray(review.reports)) review.reports = [];
    const alreadyReported = review.reports.some((rep) => rep.voterKey === voterKey);
    if (!alreadyReported) {
      review.reports.push({
        voterKey,
        reason,
        createdAt: new Date().toISOString(),
      });
      saveStore(store);
    }

    return res.json({
      success: true,
      message: 'Thank you. This review has been flagged for our moderation team.',
    });
  });

  // ============================================================================
  // 9. ADMIN: LIST ALL REVIEWS + ANALYTICS + DATE FILTERS + RATING TRENDS
  // ============================================================================
  router.get('/admin/reviews', (req: Request, res: Response) => {
    if (!deps.verifyAdminRequest(req)) {
      return res.status(401).json({
        success: false,
        unauthorized: true,
        message: 'Admin authentication required.',
      });
    }

    const store = loadStore();
    const statusFilter = String(req.query.status || 'all');
    const productFilter = String(req.query.productId || 'all');
    const ratingFilter = Number(req.query.rating || 0);
    const dateRange = String(req.query.dateRange || 'all'); // 'all' | '7d' | '30d' | '90d'
    const search = sanitizeText(req.query.search, 120).toLowerCase();

    const all = store.reviews;
    const approved = all.filter((r) => r.status === 'approved');
    const pendingCount = all.filter((r) => r.status === 'pending').length;
    const rejectedCount = all.filter((r) => r.status === 'rejected').length;
    const hiddenCount = all.filter((r) => r.status === 'hidden').length;
    const reportedCount = all.filter((r) => (r.reports?.length || 0) > 0).length;
    const averageStoreRating =
      approved.length > 0
        ? Math.round(
            (approved.reduce((acc, r) => acc + r.rating, 0) / approved.length) * 10
          ) / 10
        : 0;

    // 14-day review volume & rating trend
    const trendDays = 14;
    const ratingTrends: Array<{ date: string; label: string; count: number; avgRating: number }> = [];
    const now = new Date();
    for (let i = trendDays - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayReviews = all.filter((r) => r.createdAt.slice(0, 10) === key);
      const dayAvg =
        dayReviews.length > 0
          ? Math.round(
              (dayReviews.reduce((acc, r) => acc + r.rating, 0) / dayReviews.length) * 10
            ) / 10
          : 0;
      ratingTrends.push({
        date: key,
        label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        count: dayReviews.length,
        avgRating: dayAvg,
      });
    }

    const productIds = Array.from(
      new Set([...Object.keys(ALLOWED_PRODUCT_CATALOG), ...all.map((r) => r.productId)])
    );
    const productSummaries = productIds.map((pid) => ({
      ...computeProductSummary(pid, all),
      productName:
        ALLOWED_PRODUCT_CATALOG[pid] ||
        all.find((r) => r.productId === pid)?.productName ||
        pid,
      pendingCount: all.filter((r) => r.productId === pid && r.status === 'pending').length,
    }));

    let filtered = [...all];
    if (statusFilter === 'reported') {
      filtered = filtered.filter((r) => (r.reports?.length || 0) > 0);
    } else if (VALID_STATUSES.has(statusFilter as ReviewModerationStatus)) {
      filtered = filtered.filter((r) => r.status === statusFilter);
    }

    if (productFilter && productFilter !== 'all') {
      filtered = filtered.filter((r) => r.productId === productFilter);
    }
    if (ratingFilter >= 1 && ratingFilter <= 5) {
      filtered = filtered.filter((r) => Math.round(r.rating) === ratingFilter);
    }
    if (dateRange === '7d' || dateRange === '30d' || dateRange === '90d') {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((r) => new Date(r.createdAt).getTime() >= cutoff);
    }
    if (search) {
      filtered = filtered.filter(
        (r) =>
          r.id.toLowerCase().includes(search) ||
          r.title.toLowerCase().includes(search) ||
          r.comment.toLowerCase().includes(search) ||
          r.customerName.toLowerCase().includes(search) ||
          r.customerEmail.toLowerCase().includes(search) ||
          r.productName.toLowerCase().includes(search) ||
          (r.companyName || '').toLowerCase().includes(search)
      );
    }

    filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.json({
      success: true,
      kpis: {
        totalReviews: all.length,
        approvedCount: approved.length,
        pendingCount,
        rejectedCount,
        hiddenCount,
        reportedCount,
        averageStoreRating,
      },
      ratingTrends,
      productSummaries,
      settings: store.settings,
      reviews: filtered.map((r) => toPublicReview(r, { includePrivate: true })),
    });
  });

  // ============================================================================
  // 10. ADMIN: MODERATE REVIEW (Approve / Reject / Hide / Restore / Flag / Reply / Notes)
  // ============================================================================
  router.patch('/admin/reviews/:id', (req: Request, res: Response) => {
    if (!deps.verifyAdminRequest(req)) {
      return res.status(401).json({
        success: false,
        unauthorized: true,
        message: 'Admin authentication required.',
      });
    }

    const reviewId = sanitizeText(req.params.id, 80);
    const store = loadStore();
    const idx = store.reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    const review = { ...store.reviews[idx] };
    const previousStatus = review.status;
    const nowIso = new Date().toISOString();
    const history = [...(review.moderationHistory || [])];

    if (req.body?.status !== undefined) {
      const nextStatus = String(req.body.status) as ReviewModerationStatus;
      if (!VALID_STATUSES.has(nextStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid moderation status.' });
      }
      if (nextStatus !== previousStatus) {
        review.status = nextStatus;
        history.push({
          at: nowIso,
          action: `status_${nextStatus}`,
          actor: 'admin',
          detail: `Changed from ${previousStatus} to ${nextStatus}`,
        });
      }
    }

    if (typeof req.body?.isFeatured === 'boolean' && req.body.isFeatured !== review.isFeatured) {
      review.isFeatured = req.body.isFeatured;
      history.push({
        at: nowIso,
        action: req.body.isFeatured ? 'featured' : 'unfeatured',
        actor: 'admin',
      });
    }

    if (req.body?.adminReply !== undefined) {
      const replyText = sanitizeText(req.body.adminReply, 1500);
      if (replyText) {
        review.adminReply = replyText;
        review.adminRepliedAt = nowIso;
        history.push({ at: nowIso, action: 'admin_replied', actor: 'admin' });
      } else {
        review.adminReply = undefined;
        review.adminRepliedAt = undefined;
        history.push({ at: nowIso, action: 'admin_reply_removed', actor: 'admin' });
      }
    }

    if (req.body?.moderationNote !== undefined) {
      review.moderationNote = sanitizeText(req.body.moderationNote, 500) || undefined;
      history.push({ at: nowIso, action: 'moderation_note_updated', actor: 'admin' });
    }

    if (req.body?.flagReason && VALID_REPORT_REASONS.has(req.body.flagReason)) {
      const reports = [...(review.reports || [])];
      reports.push({
        voterKey: `admin:${nowIso}`,
        reason: req.body.flagReason as ReviewReportReason,
        createdAt: nowIso,
      });
      review.reports = reports;
      history.push({
        at: nowIso,
        action: 'flagged_by_admin',
        actor: 'admin',
        detail: String(req.body.flagReason),
      });
    }

    if (req.body?.clearReports === true) {
      review.reports = [];
      history.push({ at: nowIso, action: 'reports_cleared', actor: 'admin' });
    }

    // Notify customer once when transitioning to 'approved' or 'rejected' (prevent duplicates)
    if (
      deps.sendNotificationEmail &&
      (review.status === 'approved' || review.status === 'rejected') &&
      review.status !== previousStatus &&
      review.lastCustomerNotifiedStatus !== review.status &&
      isValidEmail(review.customerEmail)
    ) {
      review.lastCustomerNotifiedStatus = review.status;
      const isApproved = review.status === 'approved';
      void deps
        .sendNotificationEmail({
          to: review.customerEmail,
          subject: isApproved
            ? `Your TeqqnoWorld review for ${review.productName} is now live`
            : `Update regarding your review for ${review.productName}`,
          badge: 'CUSTOMER REVIEW UPDATE',
          heading: isApproved
            ? 'Your Product Review Has Been Published'
            : 'Update on Your Product Review',
          bodyText: isApproved
            ? `Hi ${review.customerName}, thank you for sharing your experience with ${review.productName}. Your review "${review.title}" has been approved and is now live on TeqqnoWorld.`
            : `Hi ${review.customerName}, thank you for taking the time to review ${review.productName}. After review against our community guidelines, your submission "${review.title}" was not published.${review.moderationNote ? ` Note: ${review.moderationNote}` : ''}`,
          note: `Review ID: ${review.id}`,
        })
        .catch(() => undefined);
    }

    review.moderationHistory = history.slice(-30);
    review.updatedAt = nowIso;
    store.reviews[idx] = review;
    saveStore(store);
    void mirrorReviewToSupabase(review);

    return res.json({
      success: true,
      review: toPublicReview(review, { includePrivate: true }),
      summary: computeProductSummary(review.productId, store.reviews),
      message: 'Review updated successfully.',
    });
  });

  // ============================================================================
  // 11. ADMIN: PERMANENTLY DELETE REVIEW
  // ============================================================================
  router.delete('/admin/reviews/:id', (req: Request, res: Response) => {
    if (!deps.verifyAdminRequest(req)) {
      return res.status(401).json({
        success: false,
        unauthorized: true,
        message: 'Admin authentication required.',
      });
    }

    const reviewId = sanitizeText(req.params.id, 80);
    const store = loadStore();
    const idx = store.reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: 'Review not found.' });
    }

    const removed = store.reviews.splice(idx, 1)[0];
    saveStore(store);

    return res.json({
      success: true,
      summary: computeProductSummary(removed.productId, store.reviews),
      message: 'Review permanently deleted.',
    });
  });

  // ============================================================================
  // 12. ADMIN: UPDATE REVIEW MODERATION SETTINGS
  // ============================================================================
  router.put('/admin/reviews/settings', (req: Request, res: Response) => {
    if (!deps.verifyAdminRequest(req)) {
      return res.status(401).json({
        success: false,
        unauthorized: true,
        message: 'Admin authentication required.',
      });
    }

    const store = loadStore();
    const mode = String(req.body?.moderationMode || store.settings.moderationMode) as ReviewModerationMode;
    if (!VALID_MODERATION_MODES.has(mode)) {
      return res.status(400).json({ success: false, message: 'Invalid moderation mode.' });
    }

    store.settings = {
      moderationMode: mode,
      allowGuestReviews:
        typeof req.body?.allowGuestReviews === 'boolean'
          ? req.body.allowGuestReviews
          : store.settings.allowGuestReviews,
      allowCustomerEdits:
        typeof req.body?.allowCustomerEdits === 'boolean'
          ? req.body.allowCustomerEdits
          : store.settings.allowCustomerEdits,
      updatedAt: new Date().toISOString(),
    };
    saveStore(store);

    return res.json({
      success: true,
      settings: store.settings,
      message: 'Review moderation settings saved.',
    });
  });

  return router;
}

/**
 * Returns genuine published review aggregate + recent published reviews for a product ID
 * for SSR JSON-LD Product structured data. Returns undefined when 0 published reviews exist.
 */
export function getPublishedReviewAggregateForSeo(productId: string):
  | {
      ratingValue: number;
      reviewCount: number;
      reviews: Array<{
        authorName: string;
        ratingValue: number;
        headline?: string;
        reviewBody: string;
        datePublished: string;
      }>;
    }
  | undefined {
  const cleanId = String(productId || '').trim();
  if (!cleanId) return undefined;
  try {
    const storeFile = path.join(resolveWritableDataDir(), 'teqqno-product-reviews.json');
    if (!fs.existsSync(storeFile)) return undefined;
    const parsed = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    if (!parsed || !Array.isArray(parsed.reviews)) return undefined;

    const published: StoredProductReview[] = parsed.reviews
      .filter(
        (r: any) =>
          r &&
          r.productId === cleanId &&
          r.status === 'approved' &&
          !String(r.customerEmail || '').endsWith('.example')
      )
      .sort(
        (a: StoredProductReview, b: StoredProductReview) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    if (published.length === 0) return undefined;

    const sum = published.reduce((acc, r) => acc + clampStar(r.rating, 5), 0);
    const avg = Number((sum / published.length).toFixed(1));
    if (!Number.isFinite(avg) || avg < 1 || avg > 5) return undefined;

    return {
      ratingValue: avg,
      reviewCount: published.length,
      reviews: published.slice(0, 5).map((r) => ({
        authorName: r.customerName,
        ratingValue: clampStar(r.rating, 5),
        headline: r.title,
        reviewBody: r.comment,
        datePublished: r.createdAt,
      })),
    };
  } catch {
    return undefined;
  }
}
