import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { type Request, type Response, type Router } from 'express';
import {
  fetchSupabaseProductCatalog,
  resolveAuthoritativeCartPricing,
  type AuthoritativeCartLine,
  type SupabaseCatalogProductRow,
} from './productPricing.ts';
import type {
  AssignedCustomerRef,
  BulkGenerateCouponsPayload,
  CouponAnalyticsOverview,
  CouponApplicability,
  CouponAuditLogRecord,
  CouponCartLineInput,
  CouponCustomerDirectoryItem,
  CouponCustomerNotification,
  CouponOfferType,
  CouponPolicySettings,
  CouponRecord,
  CouponRedemptionRecord,
  CouponStatus,
  CouponValidationRequest,
  CouponValidationResult,
  CreateCouponPayload,
  CustomerGroupType,
  PublicCouponSummary,
} from '../src/types/coupon';

export interface VerifiedCustomerSession {
  customerId: string;
  email: string;
  phone?: string;
  accountType: CustomerGroupType;
  fullName?: string;
}

export interface CouponReservationRecord {
  id: string;
  couponId: string;
  couponCode: string;
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  orderId?: string;
  subtotalInr: number;
  discountInr: number;
  shippingFeeInr: number;
  shippingSavedInr: number;
  freeShippingApplied: boolean;
  gstInr: number;
  finalTotalInr: number;
  payableInr: number;
  balanceDueInr: number;
  paymentPlan: 'prepaid_100' | 'partial_50';
  itemsJson: AuthoritativeCartLine[];
  status: 'reserved' | 'finalized' | 'released' | 'expired';
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export class CouponStorageUnavailableError extends Error {
  readonly httpStatus = 503;
  readonly code = 'STORAGE_UNAVAILABLE';
  constructor(message = 'Coupon service storage is temporarily unavailable. Please try again shortly.') {
    super(message);
    this.name = 'CouponStorageUnavailableError';
  }
}

export interface CouponRouterDeps {
  verifyAdminRequest: (req: Request) => { valid: boolean; email?: string };
  verifyCustomerJwt: (req: Request) => Promise<VerifiedCustomerSession | null>;
  verifyRecoveryEligibility?: (params: {
    recoveryToken?: string;
    checkoutSessionId?: string;
    customerPhone?: string;
    customerEmail?: string;
  }) => boolean;
  getSupabaseAdminConfig: () => { configured: boolean; url: string; serviceRoleKey: string };
  buildSupabaseAdminHeaders: (
    serviceRoleKey: string,
    extra?: Record<string, string>
  ) => Record<string, string>;
  fetchProductsFromSupabase?: () => Promise<Map<string, SupabaseCatalogProductRow> | null>;
  isProduction?: () => boolean;
  sendCouponEmail: (params: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }) => Promise<{ sent: boolean; reason?: string }>;
  escapeHtml: (input: string) => string;
  storageFilePath?: string;
}

interface CouponStoreData {
  coupons: CouponRecord[];
  redemptions: CouponRedemptionRecord[];
  reservations: CouponReservationRecord[];
  auditLogs: CouponAuditLogRecord[];
  notifications: CouponCustomerNotification[];
  settings: CouponPolicySettings;
}

const FREE_SHIPPING_THRESHOLD_INR = 1999;
const STANDARD_SHIPPING_FEE_INR = 149;
const GST_RATE = 0.18;

// Canonical catalog lookup for server-side product -> category resolution
const SERVER_PRODUCT_CATALOG: Record<string, { name: string; category: string; aliases: string[] }> = {
  'prod-ceramic-mug': {
    name: 'Promotional Ceramic Mug',
    category: 'drinkware',
    aliases: ['drinkware', 'ceramic-mugs', 'mugs'],
  },
  'prod-canopy-kiosk': {
    name: 'Branded Promotional Canopy Tent',
    category: 'signage',
    aliases: ['signage', 'event-signage', 'display'],
  },
  'prod-rollup-standee': {
    name: 'Roll-Up Standee Banner',
    category: 'signage',
    aliases: ['signage', 'event-signage', 'display'],
  },
  'prod-visiting-card-300gsm': {
    name: '300 GSM Velvet Matte Visiting Cards',
    category: 'stationery',
    aliases: ['stationery', 'visiting-cards'],
  },
  'prod-promo-table': {
    name: 'Portable Promotional Demo Table',
    category: 'signage',
    aliases: ['signage', 'event-signage', 'display'],
  },
  'prod-branding-umbrella': {
    name: '5 Feet Promotional Branding Umbrella',
    category: 'signage',
    aliases: ['signage', 'event-signage', 'display'],
  },
  'prod-plain-polo': {
    name: 'Cotton 230 GSM Plain Polo T-Shirt',
    category: 'apparel',
    aliases: ['apparel', 'polos', 'tshirts'],
  },
  'prod-polo-01': {
    name: 'Contrast Tipping Collar Polo T-Shirt',
    category: 'apparel',
    aliases: ['apparel', 'polos', 'tshirts'],
  },
  'prod-joab-coolmax': {
    name: 'Joab Coolmax Performance Polo',
    category: 'apparel',
    aliases: ['apparel', 'polos', 'tshirts'],
  },
  'prod-matty-polo': {
    name: '240 GSM Matty Pique Polo T-Shirt',
    category: 'apparel',
    aliases: ['apparel', 'polos', 'tshirts'],
  },
  'prod-cotton-flexi-caps': {
    name: 'Cotton Flexi Embroidered Cap',
    category: 'apparel',
    aliases: ['apparel', 'caps'],
  },
};

function normalizeCategorySlug(value?: string | null): string {
  const s = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
  if (s === 'event-signage' || s === 'display') return 'signage';
  if (s === 'visiting-cards') return 'stationery';
  return s;
}

export function normalizeCouponCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function normalizeEmail(email?: string | null): string {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function normalizePhone(phone?: string | null): string {
  const digits = String(phone || '').replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

// Strict PostgREST filter sanitization to prevent filter syntax injection (commas, parens, wildcards, quotes)
const SAFE_EMAIL_RE = /^[^\s,()*"'\\;]+@[^\s,()*"'\\;]+\.[^\s,()*"'\\;]+$/;
const SAFE_ID_RE = /^[a-zA-Z0-9._:@-]{1,128}$/;

export function sanitizePostgrestEmail(email?: string | null): string {
  const clean = normalizeEmail(email);
  if (!clean || clean.length > 254 || !SAFE_EMAIL_RE.test(clean)) return '';
  return clean;
}

export function sanitizePostgrestPhone(phone?: string | null): string {
  const raw = String(phone || '').trim();
  if (!raw || !/^[0-9+\-\s()]{7,24}$/.test(raw)) return '';
  const digits = normalizePhone(raw);
  if (!digits || digits.length < 7 || digits.length > 15 || !/^[0-9]+$/.test(digits)) return '';
  return digits;
}

export function sanitizePostgrestId(id?: string | null): string {
  const clean = String(id || '').trim();
  if (!clean || !SAFE_ID_RE.test(clean)) return '';
  return clean;
}

export interface OrderAnalyticsRowInput {
  id: string;
  order_group_id?: string | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  reservation_id?: string | null;
  product_id?: string | null;
  quantity?: number | null;
  status?: string | null;
  coupon_code?: string | null;
  subtotal_inr?: number | null;
  discount_inr?: number | null;
  shipping_fee_inr?: number | null;
  shipping_saved_inr?: number | null;
  gst_inr?: number | null;
  final_total_inr?: number | null;
  amount_paid_inr?: number | null;
  balance_due_inr?: number | null;
  line_subtotal_inr?: number | null;
  line_total_inr?: number | null;
  customer_name?: string | null;
  customer_email?: string | null;
  phone?: string | null;
  company?: string | null;
  created_at?: string | null;
}

export interface DeduplicatedOrderAnalyticsResult {
  uniqueOrderCount: number;
  totalRevenueInr: number;
  totalDiscountInr: number;
  totalShippingSavedInr: number;
  totalPaidInr: number;
  totalBalanceDueInr: number;
  couponOrdersCount: number;
  productBreakdown: Array<{
    productId: string;
    lineCount: number;
    units: number;
    lineSubtotalInr: number;
    lineTotalInr: number;
  }>;
  orderKeys: string[];
}

export function resolveOrderDedupeKey(row: OrderAnalyticsRowInput): string {
  const rzpOrder = String(row.razorpay_order_id || '').trim();
  if (rzpOrder) return `rzp:${rzpOrder}`;
  const resId = String(row.reservation_id || '').trim();
  if (resId) return `res:${resId}`;
  const groupId = String(row.order_group_id || '').trim();
  if (groupId) return `grp:${groupId}`;
  return `row:${String(row.id || '').trim()}`;
}

// H4: Deduplicates multi-item custom_orders rows at the order level while preserving product-level totals
export function computeDeduplicatedOrderAnalytics(
  rows: OrderAnalyticsRowInput[]
): DeduplicatedOrderAnalyticsResult {
  const seenOrders = new Map<string, OrderAnalyticsRowInput>();
  const productMap = new Map<
    string,
    { productId: string; lineCount: number; units: number; lineSubtotalInr: number; lineTotalInr: number }
  >();

  for (const row of rows) {
    const key = resolveOrderDedupeKey(row);
    if (!seenOrders.has(key)) {
      seenOrders.set(key, row);
    }

    const prodId = String(row.product_id || 'custom').trim() || 'custom';
    const qty = Math.max(1, Number(row.quantity || 1));
    const lineSub = Number(
      row.line_subtotal_inr != null ? row.line_subtotal_inr : row.subtotal_inr || 0
    );
    const lineTot = Number(
      row.line_total_inr != null ? row.line_total_inr : row.final_total_inr || 0
    );
    const prev = productMap.get(prodId) || {
      productId: prodId,
      lineCount: 0,
      units: 0,
      lineSubtotalInr: 0,
      lineTotalInr: 0,
    };
    prev.lineCount += 1;
    prev.units += qty;
    prev.lineSubtotalInr = Math.round((prev.lineSubtotalInr + lineSub) * 100) / 100;
    prev.lineTotalInr = Math.round((prev.lineTotalInr + lineTot) * 100) / 100;
    productMap.set(prodId, prev);
  }

  let totalRevenueInr = 0;
  let totalDiscountInr = 0;
  let totalShippingSavedInr = 0;
  let totalPaidInr = 0;
  let totalBalanceDueInr = 0;
  let couponOrdersCount = 0;

  for (const order of seenOrders.values()) {
    totalRevenueInr += Number(order.final_total_inr || 0);
    totalDiscountInr += Number(order.discount_inr || 0);
    totalShippingSavedInr += Number(order.shipping_saved_inr || 0);
    totalPaidInr += Number(order.amount_paid_inr || 0);
    totalBalanceDueInr += Number(order.balance_due_inr || 0);
    if (String(order.coupon_code || '').trim()) {
      couponOrdersCount += 1;
    }
  }

  return {
    uniqueOrderCount: seenOrders.size,
    totalRevenueInr: Math.round(totalRevenueInr * 100) / 100,
    totalDiscountInr: Math.round(totalDiscountInr * 100) / 100,
    totalShippingSavedInr: Math.round(totalShippingSavedInr * 100) / 100,
    totalPaidInr: Math.round(totalPaidInr * 100) / 100,
    totalBalanceDueInr: Math.round(totalBalanceDueInr * 100) / 100,
    couponOrdersCount,
    productBreakdown: Array.from(productMap.values()),
    orderKeys: Array.from(seenOrders.keys()),
  };
}

function parsePostgrestTotalCount(contentRangeHeader: string | null): number | null {
  if (!contentRangeHeader) return null;
  const slashIdx = contentRangeHeader.lastIndexOf('/');
  if (slashIdx === -1) return null;
  const totalStr = contentRangeHeader.slice(slashIdx + 1).trim();
  if (totalStr === '*') return null;
  const parsed = Number(totalStr);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
}

async function withLocalFileLock<T>(targetFilePath: string, task: () => Promise<T>): Promise<T> {
  const lockPath = `${targetFilePath}.lock`;
  const dir = path.dirname(targetFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const deadline = Date.now() + 10_000;
  let fd: number | null = null;
  while (fd === null) {
    try {
      fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, `${process.pid}:${Date.now()}`);
    } catch (err: any) {
      if (err?.code !== 'EEXIST') throw err;
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > 15_000) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch {
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error('Timed out acquiring local coupon lock.');
      }
      await new Promise((r) => setTimeout(r, 10 + Math.floor(Math.random() * 15)));
    }
  }

  try {
    return await task();
  } finally {
    try {
      fs.closeSync(fd);
    } catch {}
    try {
      fs.unlinkSync(lockPath);
    } catch {}
  }
}

function buildLegacySeedCoupons(): CouponRecord[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'legacy_welcome10',
      code: 'WELCOME10',
      aliases: ['WELCOME12'],
      name: 'Welcome 10% Storefront Offer',
      campaignName: 'Evergreen Welcome',
      description: '10% OFF on custom printing & corporate merchandise orders across TeqqnoWorld.',
      offerType: 'percentage',
      discountValue: 10,
      minOrderAmount: 0,
      maxOrderAmount: null,
      maxDiscountCap: null,
      startAt: null,
      expiresAt: null,
      status: 'active',
      applicability: 'entire_website',
      eligibleProductIds: [],
      eligibleCategories: [],
      eligibleCustomerGroups: [],
      assignedCustomers: [],
      isPrivate: false,
      isFestival: false,
      festivalPreset: null,
      festivalBannerUrl: null,
      festivalBannerHeadline: null,
      festivalBannerSubtext: null,
      showOnStorefront: true,
      totalUsageLimit: null,
      perCustomerLimit: null,
      oneTimePerCustomer: false,
      allowCombineWithCoupons: false,
      allowCombineWithPromotions: true,
      usageCount: 0,
      totalDiscountGiven: 0,
      totalRevenueGenerated: 0,
      internalNote: 'Built-in storefront welcome code (preserves WELCOME10 & WELCOME12 alias).',
      isLegacy: true,
      requiresRecoverySession: false,
      createdBy: 'system',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'legacy_teqqno10',
      code: 'TEQQNO10',
      aliases: [],
      name: 'TeqqnoWorld 10% Brand Discount',
      campaignName: 'Brand Promo',
      description: 'Flat 10% OFF on customized apparel, mugs, and event displays.',
      offerType: 'percentage',
      discountValue: 10,
      minOrderAmount: 0,
      maxOrderAmount: null,
      maxDiscountCap: null,
      startAt: null,
      expiresAt: null,
      status: 'active',
      applicability: 'entire_website',
      eligibleProductIds: [],
      eligibleCategories: [],
      eligibleCustomerGroups: [],
      assignedCustomers: [],
      isPrivate: false,
      isFestival: false,
      festivalPreset: null,
      festivalBannerUrl: null,
      festivalBannerHeadline: null,
      festivalBannerSubtext: null,
      showOnStorefront: false,
      totalUsageLimit: null,
      perCustomerLimit: null,
      oneTimePerCustomer: false,
      allowCombineWithCoupons: false,
      allowCombineWithPromotions: true,
      usageCount: 0,
      totalDiscountGiven: 0,
      totalRevenueGenerated: 0,
      internalNote: 'Built-in legacy brand coupon code.',
      isLegacy: true,
      requiresRecoverySession: false,
      createdBy: 'system',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'legacy_teqqnobulk',
      code: 'TEQQNOBULK',
      aliases: [],
      name: 'Corporate Bulk ₹500 Instant Savings',
      campaignName: 'Corporate Bulk',
      description: 'Flat ₹500 OFF on corporate & bulk merchandise orders.',
      offerType: 'fixed',
      discountValue: 500,
      minOrderAmount: 0,
      maxOrderAmount: null,
      maxDiscountCap: null,
      startAt: null,
      expiresAt: null,
      status: 'active',
      applicability: 'entire_website',
      eligibleProductIds: [],
      eligibleCategories: [],
      eligibleCustomerGroups: [],
      assignedCustomers: [],
      isPrivate: false,
      isFestival: false,
      festivalPreset: null,
      festivalBannerUrl: null,
      festivalBannerHeadline: null,
      festivalBannerSubtext: null,
      showOnStorefront: true,
      totalUsageLimit: null,
      perCustomerLimit: null,
      oneTimePerCustomer: false,
      allowCombineWithCoupons: false,
      allowCombineWithPromotions: true,
      usageCount: 0,
      totalDiscountGiven: 0,
      totalRevenueGenerated: 0,
      internalNote: 'Built-in legacy ₹500 bulk discount coupon.',
      isLegacy: true,
      requiresRecoverySession: false,
      createdBy: 'system',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'legacy_save5now',
      code: 'SAVE5NOW',
      aliases: ['TEQQNO5'],
      name: 'Cart Recovery 5% Express Voucher',
      campaignName: 'Cart Recovery',
      description: '5% instant checkout recovery discount (includes TEQQNO5 alias).',
      offerType: 'percentage',
      discountValue: 5,
      minOrderAmount: 0,
      maxOrderAmount: null,
      maxDiscountCap: null,
      startAt: null,
      expiresAt: null,
      status: 'active',
      applicability: 'entire_website',
      eligibleProductIds: [],
      eligibleCategories: [],
      eligibleCustomerGroups: [],
      assignedCustomers: [],
      isPrivate: false,
      isFestival: false,
      festivalPreset: null,
      festivalBannerUrl: null,
      festivalBannerHeadline: null,
      festivalBannerSubtext: null,
      showOnStorefront: false,
      totalUsageLimit: null,
      perCustomerLimit: null,
      oneTimePerCustomer: false,
      allowCombineWithCoupons: false,
      allowCombineWithPromotions: true,
      usageCount: 0,
      totalDiscountGiven: 0,
      totalRevenueGenerated: 0,
      internalNote: 'Built-in cart recovery offer (requires active recovery session timer).',
      isLegacy: true,
      requiresRecoverySession: true,
      createdBy: 'system',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}

export function resolveEffectiveCouponStatus(
  coupon: CouponRecord,
  nowMs: number = Date.now()
): CouponStatus {
  if (coupon.status === 'draft' || coupon.status === 'paused' || coupon.status === 'archived') {
    return coupon.status;
  }
  if (coupon.status === 'expired') {
    return 'expired';
  }
  const startMs = coupon.startAt ? Date.parse(coupon.startAt) : NaN;
  const expiryMs = coupon.expiresAt ? Date.parse(coupon.expiresAt) : NaN;
  if (Number.isFinite(expiryMs) && nowMs >= expiryMs) {
    return 'expired';
  }
  if (Number.isFinite(startMs) && nowMs < startMs) {
    return 'scheduled';
  }
  return 'active';
}

function formatOfferBadge(coupon: CouponRecord): string {
  if (coupon.offerType === 'free_shipping') {
    return 'FREE SHIPPING';
  }
  if (coupon.offerType === 'percentage') {
    return coupon.maxDiscountCap
      ? `${coupon.discountValue}% OFF (UP TO ₹${Number(coupon.maxDiscountCap).toLocaleString('en-IN')})`
      : `${coupon.discountValue}% OFF`;
  }
  return `₹${Number(coupon.discountValue).toLocaleString('en-IN')} OFF`;
}

function toPublicSummary(coupon: CouponRecord): PublicCouponSummary {
  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    campaignName: coupon.campaignName,
    description: coupon.description,
    offerType: coupon.offerType,
    discountValue: coupon.discountValue,
    minOrderAmount: coupon.minOrderAmount,
    maxOrderAmount: coupon.maxOrderAmount ?? null,
    maxDiscountCap: coupon.maxDiscountCap ?? null,
    startAt: coupon.startAt ?? null,
    expiresAt: coupon.expiresAt ?? null,
    applicability: coupon.applicability,
    eligibleProductIds: coupon.eligibleProductIds || [],
    eligibleCategories: coupon.eligibleCategories || [],
    isPrivate: coupon.isPrivate,
    isFestival: coupon.isFestival,
    festivalPreset: coupon.festivalPreset ?? null,
    festivalBannerUrl: coupon.festivalBannerUrl ?? null,
    festivalBannerHeadline: coupon.festivalBannerHeadline ?? null,
    festivalBannerSubtext: coupon.festivalBannerSubtext ?? null,
    showOnStorefront: coupon.showOnStorefront,
    oneTimePerCustomer: coupon.oneTimePerCustomer,
  };
}

// Per-coupon async mutex queue to guarantee atomic, race-free redemptions
const couponLockQueues = new Map<string, Promise<unknown>>();

export function withCouponLock<T>(lockKey: string, task: () => Promise<T>): Promise<T> {
  const prev = couponLockQueues.get(lockKey) || Promise.resolve();
  let releaseNext!: () => void;
  const gate = new Promise<void>((resolve) => {
    releaseNext = resolve;
  });
  const chained = prev.then(() => gate);
  couponLockQueues.set(lockKey, chained);

  return prev
    .catch(() => undefined)
    .then(async () => {
      try {
        return await task();
      } finally {
        releaseNext();
        if (couponLockQueues.get(lockKey) === chained) {
          couponLockQueues.delete(lockKey);
        }
      }
    });
}

// ==============================================================================
// STORAGE LAYER (Supabase REST primary when migrated, atomic local JSON fallback)
// ==============================================================================

function dbRowToCoupon(row: any): CouponRecord {
  return {
    id: String(row.id),
    code: normalizeCouponCode(row.code),
    aliases: Array.isArray(row.aliases) ? row.aliases.map(normalizeCouponCode) : [],
    name: String(row.name || ''),
    campaignName: row.campaign_name || undefined,
    description: row.description || undefined,
    offerType: row.offer_type as CouponOfferType,
    discountValue: Number(row.discount_value || 0),
    minOrderAmount: Number(row.min_order_amount || 0),
    maxOrderAmount: row.max_order_amount != null ? Number(row.max_order_amount) : null,
    maxDiscountCap: row.max_discount_cap != null ? Number(row.max_discount_cap) : null,
    startAt: row.start_at || null,
    expiresAt: row.expires_at || null,
    status: row.status as CouponStatus,
    applicability: (row.applicability || 'entire_website') as CouponApplicability,
    eligibleProductIds: Array.isArray(row.eligible_product_ids) ? row.eligible_product_ids : [],
    eligibleCategories: Array.isArray(row.eligible_categories) ? row.eligible_categories : [],
    eligibleCustomerGroups: Array.isArray(row.eligible_customer_groups)
      ? row.eligible_customer_groups
      : [],
    assignedCustomers: Array.isArray(row.assigned_customers) ? row.assigned_customers : [],
    isPrivate: Boolean(row.is_private),
    isFestival: Boolean(row.is_festival),
    festivalPreset: row.festival_preset || null,
    festivalBannerUrl: row.festival_banner_url || null,
    festivalBannerHeadline: row.festival_banner_headline || null,
    festivalBannerSubtext: row.festival_banner_subtext || null,
    showOnStorefront: Boolean(row.show_on_storefront),
    totalUsageLimit: row.total_usage_limit != null ? Number(row.total_usage_limit) : null,
    perCustomerLimit: row.per_customer_limit != null ? Number(row.per_customer_limit) : null,
    oneTimePerCustomer: Boolean(row.one_time_per_customer),
    allowCombineWithCoupons: Boolean(row.allow_combine_with_coupons),
    allowCombineWithPromotions:
      row.allow_combine_with_promotions === undefined ? true : Boolean(row.allow_combine_with_promotions),
    usageCount: Number(row.usage_count || 0),
    totalDiscountGiven: Number(row.total_discount_given || 0),
    totalRevenueGenerated: Number(row.total_revenue_generated || 0),
    internalNote: row.internal_note || undefined,
    isLegacy: Boolean(row.is_legacy),
    requiresRecoverySession: Boolean(row.requires_recovery_session),
    createdBy: String(row.created_by || 'admin'),
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function couponToDbRow(c: CouponRecord) {
  return {
    id: c.id,
    code: normalizeCouponCode(c.code),
    aliases: (c.aliases || []).map(normalizeCouponCode),
    name: c.name,
    campaign_name: c.campaignName || null,
    description: c.description || null,
    offer_type: c.offerType,
    discount_value: c.discountValue,
    min_order_amount: c.minOrderAmount || 0,
    max_order_amount: c.maxOrderAmount ?? null,
    max_discount_cap: c.maxDiscountCap ?? null,
    start_at: c.startAt || null,
    expires_at: c.expiresAt || null,
    status: c.status,
    applicability: c.applicability,
    eligible_product_ids: c.eligibleProductIds || [],
    eligible_categories: c.eligibleCategories || [],
    eligible_customer_groups: c.eligibleCustomerGroups || [],
    assigned_customers: c.assignedCustomers || [],
    is_private: Boolean(c.isPrivate),
    is_festival: Boolean(c.isFestival),
    festival_preset: c.festivalPreset || null,
    festival_banner_url: c.festivalBannerUrl || null,
    festival_banner_headline: c.festivalBannerHeadline || null,
    festival_banner_subtext: c.festivalBannerSubtext || null,
    show_on_storefront: Boolean(c.showOnStorefront),
    total_usage_limit: c.totalUsageLimit ?? null,
    per_customer_limit: c.perCustomerLimit ?? null,
    one_time_per_customer: Boolean(c.oneTimePerCustomer),
    allow_combine_with_coupons: Boolean(c.allowCombineWithCoupons),
    allow_combine_with_promotions: Boolean(c.allowCombineWithPromotions),
    usage_count: c.usageCount || 0,
    total_discount_given: c.totalDiscountGiven || 0,
    total_revenue_generated: c.totalRevenueGenerated || 0,
    internal_note: c.internalNote || null,
    is_legacy: Boolean(c.isLegacy),
    requires_recovery_session: Boolean(c.requiresRecoverySession),
    created_by: c.createdBy || 'admin',
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function dbRowToRedemption(row: any): CouponRedemptionRecord {
  return {
    id: String(row.id),
    couponId: String(row.coupon_id),
    couponCode: normalizeCouponCode(row.coupon_code),
    orderId: String(row.order_id),
    orderNumber: row.order_number || undefined,
    paymentId: row.payment_id || undefined,
    reservationId: row.reservation_id || undefined,
    customerId: row.customer_id || undefined,
    customerName: row.customer_name || undefined,
    customerEmail: row.customer_email || undefined,
    customerPhone: row.customer_phone || undefined,
    subtotalInr: Number(row.subtotal_inr || 0),
    discountInr: Number(row.discount_inr || 0),
    shippingSavedInr: Number(row.shipping_saved_inr || 0),
    finalTotalInr: Number(row.final_total_inr || 0),
    paymentStatus: String(row.payment_status || 'pending'),
    status: (row.status || 'redeemed') as CouponRedemptionRecord['status'],
    redeemedAt: String(row.redeemed_at || new Date().toISOString()),
    restoredAt: row.restored_at || null,
    restoredBy: row.restored_by || null,
  };
}

function dbRowToReservation(row: any): CouponReservationRecord {
  return {
    id: String(row.id),
    couponId: String(row.coupon_id),
    couponCode: normalizeCouponCode(row.coupon_code),
    customerId: row.customer_id || undefined,
    customerEmail: row.customer_email || undefined,
    customerPhone: row.customer_phone || undefined,
    razorpayOrderId: row.razorpay_order_id || undefined,
    razorpayPaymentId: row.razorpay_payment_id || undefined,
    orderId: row.order_id || undefined,
    subtotalInr: Number(row.subtotal_inr || 0),
    discountInr: Number(row.discount_inr || 0),
    shippingFeeInr: Number(row.shipping_fee_inr || 0),
    shippingSavedInr: Number(row.shipping_saved_inr || 0),
    freeShippingApplied: Boolean(row.free_shipping_applied),
    gstInr: Number(row.gst_inr || 0),
    finalTotalInr: Number(row.final_total_inr || 0),
    payableInr: Number(row.payable_inr || 0),
    balanceDueInr: Number(row.balance_due_inr || 0),
    paymentPlan: row.payment_plan === 'partial_50' ? 'partial_50' : 'prepaid_100',
    itemsJson: Array.isArray(row.items_json) ? row.items_json : [],
    status: (row.status || 'reserved') as CouponReservationRecord['status'],
    expiresAt: String(row.expires_at || new Date().toISOString()),
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function dbRowToAudit(row: any): CouponAuditLogRecord {
  return {
    id: String(row.id),
    couponId: row.coupon_id || null,
    couponCode: row.coupon_code || null,
    action: String(row.action || ''),
    actor: String(row.actor || 'admin'),
    summary: String(row.summary || ''),
    metadata: row.metadata || {},
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function dbRowToNotification(row: any): CouponCustomerNotification {
  return {
    id: String(row.id),
    couponId: String(row.coupon_id),
    couponCode: normalizeCouponCode(row.coupon_code),
    customerId: row.customer_id || undefined,
    customerEmail: String(row.customer_email || ''),
    customerName: row.customer_name || undefined,
    title: String(row.title || ''),
    message: String(row.message || ''),
    channel: (row.channel || 'dashboard') as CouponCustomerNotification['channel'],
    emailSent: Boolean(row.email_sent),
    emailStatusNote: row.email_status_note || undefined,
    readAt: row.read_at || null,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

const SUPABASE_HEALTH_OK_TTL_MS = 60_000;
const SUPABASE_HEALTH_RETRY_TTL_MS = 15_000;
const DEFAULT_RESERVATION_TTL_SECONDS = 900; // 15 minutes

export class CouponEngine {
  private deps: CouponRouterDeps;
  private filePath: string;
  private supabaseStatus: {
    ok: boolean;
    checkedAt: number;
    retryAfterMs?: number;
    lastError?: string;
  } | null = null;
  private devFallbackLogged = false;
  private seededLegacy = false;

  constructor(deps: CouponRouterDeps) {
    this.deps = deps;
    this.filePath =
      deps.storageFilePath || path.resolve(process.cwd(), '.data', 'coupons-store.json');
  }

  private isProductionMode(): boolean {
    if (this.deps.isProduction) return this.deps.isProduction();
    return process.env.NODE_ENV === 'production';
  }

  private invalidateSupabaseHealth(reason: string, retryAfterMs?: number): void {
    this.supabaseStatus = {
      ok: false,
      checkedAt: Date.now(),
      retryAfterMs,
      lastError: reason,
    };
    if (this.isProductionMode()) {
      console.error(`[CouponEngine Storage Error] Supabase unavailable: ${reason}`);
    } else if (!this.devFallbackLogged) {
      this.devFallbackLogged = true;
      console.info(
        `[CouponEngine] Supabase coupon tables not ready (${reason}); using local dev store until SQL migration is applied.`
      );
    }
  }

  private ensureLocalFile(): CouponStoreData {
    if (this.isProductionMode()) {
      throw new CouponStorageUnavailableError(
        'Production coupon storage requires Supabase. Local JSON fallback is disabled in production.'
      );
    }
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      const initial: CouponStoreData = {
        coupons: buildLegacySeedCoupons(),
        redemptions: [],
        reservations: [],
        auditLogs: [],
        notifications: [],
        settings: { restoreOnCancel: false, updatedBy: 'system', updatedAt: new Date().toISOString() },
      };
      this.writeLocalFile(initial);
      return initial;
    }
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<CouponStoreData>;
      const data: CouponStoreData = {
        coupons: Array.isArray(parsed.coupons) ? parsed.coupons : [],
        redemptions: Array.isArray(parsed.redemptions) ? parsed.redemptions : [],
        reservations: Array.isArray(parsed.reservations) ? parsed.reservations : [],
        auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs : [],
        notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        settings: parsed.settings || { restoreOnCancel: false },
      };
      if (!this.seededLegacy) {
        const legacySeeds = buildLegacySeedCoupons();
        let added = false;
        for (const seed of legacySeeds) {
          const exists = data.coupons.some(
            (c) => c.id === seed.id || normalizeCouponCode(c.code) === seed.code
          );
          if (!exists) {
            data.coupons.push(seed);
            added = true;
          }
        }
        this.seededLegacy = true;
        if (added) this.writeLocalFile(data);
      }
      return data;
    } catch {
      const fallback: CouponStoreData = {
        coupons: buildLegacySeedCoupons(),
        redemptions: [],
        reservations: [],
        auditLogs: [],
        notifications: [],
        settings: { restoreOnCancel: false },
      };
      this.writeLocalFile(fallback);
      return fallback;
    }
  }

  private writeLocalFile(data: CouponStoreData): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.filePath);
  }

  private async checkSupabaseReady(): Promise<boolean> {
    const now = Date.now();
    const isProd = this.isProductionMode();
    const cfg = this.deps.getSupabaseAdminConfig();

    if (!cfg.configured || !cfg.url || !cfg.serviceRoleKey) {
      if (isProd) {
        console.error(
          '[CouponEngine Storage Error] Production requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
        );
        throw new CouponStorageUnavailableError(
          'Coupon storage is not configured for production. Please configure Supabase credentials.'
        );
      }
      this.supabaseStatus = { ok: false, checkedAt: now, lastError: 'Supabase not configured' };
      return false;
    }

    if (this.supabaseStatus) {
      const ttl = this.supabaseStatus.ok
        ? SUPABASE_HEALTH_OK_TTL_MS
        : this.supabaseStatus.retryAfterMs || SUPABASE_HEALTH_RETRY_TTL_MS;
      if (now - this.supabaseStatus.checkedAt < ttl) {
        if (this.supabaseStatus.ok) return true;
        if (isProd) {
          throw new CouponStorageUnavailableError(
            'Coupon database is temporarily unavailable. Please try again shortly.'
          );
        }
        return false;
      }
    }

    try {
      const resp = await fetch(`${cfg.url}/rest/v1/coupons?select=id&limit=1`, {
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
      });
      if (resp.ok) {
        this.supabaseStatus = { ok: true, checkedAt: now };
        this.devFallbackLogged = false;
        await this.ensureLegacyInSupabase();
        return true;
      }
      const devMissingSchemaTtl = !isProd && resp.status === 404 ? 60_000 : undefined;
      this.invalidateSupabaseHealth(
        `HTTP ${resp.status} checking public.coupons`,
        devMissingSchemaTtl
      );
      if (isProd) {
        throw new CouponStorageUnavailableError(
          'Coupon database is temporarily unavailable. Please try again shortly.'
        );
      }
      return false;
    } catch (err: any) {
      if (err instanceof CouponStorageUnavailableError) throw err;
      this.invalidateSupabaseHealth(err?.message || 'Network error reaching Supabase');
      if (isProd) {
        throw new CouponStorageUnavailableError(
          'Coupon database is temporarily unreachable. Please try again shortly.'
        );
      }
      return false;
    }
  }

  private async ensureLegacyInSupabase(): Promise<void> {
    if (this.seededLegacy) return;
    const cfg = this.deps.getSupabaseAdminConfig();
    try {
      const seeds = buildLegacySeedCoupons();
      const existingResp = await fetch(`${cfg.url}/rest/v1/coupons?select=id,code&limit=500`, {
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
      });
      if (!existingResp.ok) return;
      const existingRows = (await existingResp.json()) as Array<{ id: string; code: string }>;
      const existingCodes = new Set(existingRows.map((r) => normalizeCouponCode(r.code)));
      const missing = seeds.filter((s) => !existingCodes.has(s.code));
      if (missing.length > 0) {
        await fetch(`${cfg.url}/rest/v1/coupons`, {
          method: 'POST',
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Prefer: 'resolution=ignore-duplicates,return=minimal',
          }),
          body: JSON.stringify(missing.map(couponToDbRow)),
        });
      }
      this.seededLegacy = true;
    } catch {
      // Non-fatal; will retry on next health check if needed
    }
  }

  async getStorageMode(): Promise<'supabase' | 'local_file'> {
    return (await this.checkSupabaseReady()) ? 'supabase' : 'local_file';
  }

  async listCoupons(): Promise<CouponRecord[]> {
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      return this.ensureLocalFile().coupons.map((c) => ({
        ...c,
        effectiveStatus: resolveEffectiveCouponStatus(c),
      }));
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    let resp: globalThis.Response;
    try {
      resp = await fetch(`${cfg.url}/rest/v1/coupons?select=*&order=created_at.desc&limit=1000`, {
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
      });
    } catch (err: any) {
      this.invalidateSupabaseHealth(err?.message || 'Network failure reading coupons');
      throw new CouponStorageUnavailableError('Unable to load coupons from database.');
    }
    if (!resp.ok) {
      this.invalidateSupabaseHealth(`HTTP ${resp.status} reading public.coupons`);
      throw new CouponStorageUnavailableError('Unable to load coupons from database.');
    }
    const rows = (await resp.json()) as any[];
    return rows.map((r) => {
      const c = dbRowToCoupon(r);
      return { ...c, effectiveStatus: resolveEffectiveCouponStatus(c) };
    });
  }

  // Paginated fetch across all redemptions (never silently truncated at 2,000 rows)
  async listRedemptions(maxRows = 50_000): Promise<CouponRedemptionRecord[]> {
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      return this.ensureLocalFile().redemptions;
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    const pageSize = 1000;
    const collected: CouponRedemptionRecord[] = [];
    for (let offset = 0; offset < maxRows; offset += pageSize) {
      const end = Math.min(offset + pageSize - 1, maxRows - 1);
      let resp: globalThis.Response;
      try {
        resp = await fetch(`${cfg.url}/rest/v1/coupon_redemptions?select=*&order=redeemed_at.desc`, {
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Range: `${offset}-${end}`,
            'Range-Unit': 'items',
          }),
        });
      } catch (err: any) {
        this.invalidateSupabaseHealth(err?.message || 'Network failure reading redemptions');
        throw new CouponStorageUnavailableError('Unable to load redemption history from database.');
      }
      // 416 Range Not Satisfiable means we reached the exact end of the table
      if (resp.status === 416) break;
      if (!resp.ok) {
        this.invalidateSupabaseHealth(`HTTP ${resp.status} reading public.coupon_redemptions`);
        throw new CouponStorageUnavailableError('Unable to load redemption history from database.');
      }
      const rows = (await resp.json()) as any[];
      for (const r of rows) collected.push(dbRowToRedemption(r));
      if (rows.length < pageSize) break;
    }
    return collected;
  }

  // Targeted indexed DB counts (H6) — O(1) index scan, accurate at any table size
  async countActiveRedemptionsForCoupon(couponId: string): Promise<number> {
    const safeCouponId = sanitizePostgrestId(couponId);
    if (!safeCouponId) return 0;
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      return this.ensureLocalFile().redemptions.filter(
        (r) => r.couponId === safeCouponId && r.status === 'redeemed'
      ).length;
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    let resp: globalThis.Response;
    try {
      resp = await fetch(
        `${cfg.url}/rest/v1/coupon_redemptions?coupon_id=eq.${encodeURIComponent(safeCouponId)}&status=eq.redeemed&select=id&limit=1`,
        {
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Prefer: 'count=exact',
          }),
        }
      );
    } catch (err: any) {
      this.invalidateSupabaseHealth(err?.message || 'Network failure counting redemptions');
      throw new CouponStorageUnavailableError('Unable to verify coupon usage count.');
    }
    if (!resp.ok) {
      this.invalidateSupabaseHealth(`HTTP ${resp.status} counting coupon_redemptions`);
      throw new CouponStorageUnavailableError('Unable to verify coupon usage count.');
    }
    const exact = parsePostgrestTotalCount(resp.headers.get('content-range'));
    if (exact !== null) return exact;
    const rows = (await resp.json()) as any[];
    return rows.length;
  }

  async countActiveReservationsForCoupon(couponId: string, nowMs: number = Date.now()): Promise<number> {
    const safeCouponId = sanitizePostgrestId(couponId);
    if (!safeCouponId) return 0;
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      return this.ensureLocalFile().reservations.filter(
        (r) => r.couponId === safeCouponId && r.status === 'reserved' && Date.parse(r.expiresAt) > nowMs
      ).length;
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    const nowIso = new Date(nowMs).toISOString();
    try {
      const resp = await fetch(
        `${cfg.url}/rest/v1/coupon_reservations?coupon_id=eq.${encodeURIComponent(safeCouponId)}&status=eq.reserved&expires_at=gt.${encodeURIComponent(nowIso)}&select=id&limit=1`,
        {
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Prefer: 'count=exact',
          }),
        }
      );
      if (!resp.ok) {
        // If hardening migration table hasn't been applied yet, return 0 in non-prod; fail closed in prod
        if (this.isProductionMode() && resp.status >= 500) {
          this.invalidateSupabaseHealth(`HTTP ${resp.status} counting coupon_reservations`);
          throw new CouponStorageUnavailableError('Unable to verify active coupon reservations.');
        }
        return 0;
      }
      const exact = parsePostgrestTotalCount(resp.headers.get('content-range'));
      if (exact !== null) return exact;
      const rows = (await resp.json()) as any[];
      return rows.length;
    } catch (err: any) {
      if (err instanceof CouponStorageUnavailableError) throw err;
      this.invalidateSupabaseHealth(err?.message || 'Network failure counting reservations');
      throw new CouponStorageUnavailableError('Unable to verify active coupon reservations.');
    }
  }

  async countCustomerCouponUsage(
    couponId: string,
    identity: { customerId?: string; customerEmail?: string; customerPhone?: string },
    nowMs: number = Date.now()
  ): Promise<number> {
    const safeCouponId = sanitizePostgrestId(couponId);
    const cleanId = sanitizePostgrestId(identity.customerId);
    const cleanEmail = sanitizePostgrestEmail(identity.customerEmail);
    const cleanPhone = sanitizePostgrestPhone(identity.customerPhone);
    if (!safeCouponId || (!cleanId && !cleanEmail && !cleanPhone)) return 0;

    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      const store = this.ensureLocalFile();
      const matchCustomer = (r: { customerId?: string; customerEmail?: string; customerPhone?: string }) => {
        if (cleanId && r.customerId && r.customerId === cleanId) return true;
        if (cleanEmail && normalizeEmail(r.customerEmail) === cleanEmail) return true;
        if (cleanPhone && normalizePhone(r.customerPhone) === cleanPhone) return true;
        return false;
      };
      const redeemed = store.redemptions.filter(
        (r) => r.couponId === safeCouponId && r.status === 'redeemed' && matchCustomer(r)
      ).length;
      const reserved = store.reservations.filter(
        (r) =>
          r.couponId === safeCouponId &&
          r.status === 'reserved' &&
          Date.parse(r.expiresAt) > nowMs &&
          matchCustomer(r)
      ).length;
      return redeemed + reserved;
    }

    const cfg = this.deps.getSupabaseAdminConfig();
    const orFilters: string[] = [];
    if (cleanId) orFilters.push(`customer_id.eq.${encodeURIComponent(cleanId)}`);
    if (cleanEmail) orFilters.push(`customer_email.ilike.${encodeURIComponent(cleanEmail)}`);
    if (cleanPhone) orFilters.push(`customer_phone.ilike.*${encodeURIComponent(cleanPhone)}*`);
    if (orFilters.length === 0) return 0;

    const orExpr = `or=(${orFilters.join(',')})`;
    let redeemedCount = 0;
    try {
      const rResp = await fetch(
        `${cfg.url}/rest/v1/coupon_redemptions?coupon_id=eq.${encodeURIComponent(safeCouponId)}&status=eq.redeemed&${orExpr}&select=id&limit=1`,
        {
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Prefer: 'count=exact',
          }),
        }
      );
      if (!rResp.ok) {
        this.invalidateSupabaseHealth(`HTTP ${rResp.status} counting customer redemptions`);
        throw new CouponStorageUnavailableError('Unable to verify customer coupon usage.');
      }
      const exact = parsePostgrestTotalCount(rResp.headers.get('content-range'));
      redeemedCount = exact !== null ? exact : ((await rResp.json()) as any[]).length;
    } catch (err: any) {
      if (err instanceof CouponStorageUnavailableError) throw err;
      this.invalidateSupabaseHealth(err?.message || 'Network failure counting customer redemptions');
      throw new CouponStorageUnavailableError('Unable to verify customer coupon usage.');
    }

    let reservedCount = 0;
    try {
      const nowIso = new Date(nowMs).toISOString();
      const resResp = await fetch(
        `${cfg.url}/rest/v1/coupon_reservations?coupon_id=eq.${encodeURIComponent(safeCouponId)}&status=eq.reserved&expires_at=gt.${encodeURIComponent(nowIso)}&${orExpr}&select=id&limit=1`,
        {
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Prefer: 'count=exact',
          }),
        }
      );
      if (resResp.ok) {
        const exact = parsePostgrestTotalCount(resResp.headers.get('content-range'));
        reservedCount = exact !== null ? exact : ((await resResp.json()) as any[]).length;
      }
    } catch {
      // Non-fatal if reservation table not yet migrated in preview
    }

    return redeemedCount + reservedCount;
  }

  async findRedemptionsByOrderRef(params: {
    orderId?: string;
    orderNumber?: string;
    paymentId?: string;
    reservationId?: string;
    razorpayOrderId?: string;
  }): Promise<CouponRedemptionRecord[]> {
    const cleanOrderId = sanitizePostgrestId(params.orderId);
    const cleanOrderNum = sanitizePostgrestId(params.orderNumber);
    const cleanPaymentId = sanitizePostgrestId(params.paymentId);
    const cleanReservationId = sanitizePostgrestId(params.reservationId);
    const cleanRzpOrderId = sanitizePostgrestId(params.razorpayOrderId);
    const rzpPlaceholderOrderId = cleanRzpOrderId ? `RZP-${cleanRzpOrderId}` : '';
    if (!cleanOrderId && !cleanOrderNum && !cleanPaymentId && !cleanReservationId && !rzpPlaceholderOrderId) {
      return [];
    }

    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      return this.ensureLocalFile().redemptions.filter((r) => {
        if (cleanOrderId && r.orderId === cleanOrderId) return true;
        if (cleanOrderNum && r.orderNumber === cleanOrderNum) return true;
        if (cleanPaymentId && r.paymentId === cleanPaymentId) return true;
        if (cleanReservationId && r.reservationId === cleanReservationId) return true;
        if (rzpPlaceholderOrderId && r.orderId === rzpPlaceholderOrderId) return true;
        return false;
      });
    }

    const cfg = this.deps.getSupabaseAdminConfig();
    const orFilters: string[] = [];
    if (cleanOrderId) orFilters.push(`order_id.eq.${encodeURIComponent(cleanOrderId)}`);
    if (cleanOrderNum) orFilters.push(`order_number.eq.${encodeURIComponent(cleanOrderNum)}`);
    if (cleanPaymentId) orFilters.push(`payment_id.eq.${encodeURIComponent(cleanPaymentId)}`);
    if (cleanReservationId) orFilters.push(`reservation_id.eq.${encodeURIComponent(cleanReservationId)}`);
    if (rzpPlaceholderOrderId) orFilters.push(`order_id.eq.${encodeURIComponent(rzpPlaceholderOrderId)}`);
    const resp = await fetch(
      `${cfg.url}/rest/v1/coupon_redemptions?select=*&or=(${orFilters.join(',')})&limit=20`,
      { headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey) }
    );
    if (!resp.ok) {
      this.invalidateSupabaseHealth(`HTTP ${resp.status} looking up redemptions by order`);
      throw new CouponStorageUnavailableError('Unable to look up order coupon redemptions.');
    }
    const rows = (await resp.json()) as any[];
    return rows.map(dbRowToRedemption);
  }

  async listAuditLogs(): Promise<CouponAuditLogRecord[]> {
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      return this.ensureLocalFile().auditLogs;
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    let resp: globalThis.Response;
    try {
      resp = await fetch(
        `${cfg.url}/rest/v1/coupon_audit_logs?select=*&order=created_at.desc&limit=500`,
        { headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey) }
      );
    } catch (err: any) {
      this.invalidateSupabaseHealth(err?.message || 'Network failure reading audit logs');
      throw new CouponStorageUnavailableError('Unable to load coupon audit logs.');
    }
    if (!resp.ok) {
      this.invalidateSupabaseHealth(`HTTP ${resp.status} reading public.coupon_audit_logs`);
      throw new CouponStorageUnavailableError('Unable to load coupon audit logs.');
    }
    const rows = (await resp.json()) as any[];
    return rows.map(dbRowToAudit);
  }

  async listNotifications(customerFilter?: {
    customerEmail?: string;
    customerId?: string;
  }): Promise<CouponCustomerNotification[]> {
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      const all = this.ensureLocalFile().notifications;
      if (!customerFilter) return all;
      const cleanEmail = sanitizePostgrestEmail(customerFilter.customerEmail);
      const cleanId = sanitizePostgrestId(customerFilter.customerId);
      return all.filter(
        (n) =>
          (cleanEmail && normalizeEmail(n.customerEmail) === cleanEmail) ||
          (cleanId && n.customerId && n.customerId === cleanId)
      );
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    let query = `${cfg.url}/rest/v1/coupon_customer_notifications?select=*&order=created_at.desc&limit=100`;
    if (customerFilter) {
      const orParts: string[] = [];
      const cleanEmail = sanitizePostgrestEmail(customerFilter.customerEmail);
      const cleanId = sanitizePostgrestId(customerFilter.customerId);
      if (cleanEmail) orParts.push(`customer_email.ilike.${encodeURIComponent(cleanEmail)}`);
      if (cleanId) orParts.push(`customer_id.eq.${encodeURIComponent(cleanId)}`);
      if (orParts.length === 0) return [];
      query += `&or=(${orParts.join(',')})`;
    }
    let resp: globalThis.Response;
    try {
      resp = await fetch(query, {
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
      });
    } catch (err: any) {
      this.invalidateSupabaseHealth(err?.message || 'Network failure reading notifications');
      throw new CouponStorageUnavailableError('Unable to load customer notifications.');
    }
    if (!resp.ok) {
      this.invalidateSupabaseHealth(`HTTP ${resp.status} reading public.coupon_customer_notifications`);
      throw new CouponStorageUnavailableError('Unable to load customer notifications.');
    }
    const rows = (await resp.json()) as any[];
    return rows.map(dbRowToNotification);
  }

  async getSettings(): Promise<CouponPolicySettings> {
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      return this.ensureLocalFile().settings;
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    let resp: globalThis.Response;
    try {
      resp = await fetch(`${cfg.url}/rest/v1/coupon_settings?id=eq.default&limit=1`, {
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
      });
    } catch (err: any) {
      this.invalidateSupabaseHealth(err?.message || 'Network failure reading settings');
      throw new CouponStorageUnavailableError('Unable to load coupon policy settings.');
    }
    if (!resp.ok) {
      this.invalidateSupabaseHealth(`HTTP ${resp.status} reading public.coupon_settings`);
      throw new CouponStorageUnavailableError('Unable to load coupon policy settings.');
    }
    const rows = (await resp.json()) as any[];
    if (!rows.length) return { restoreOnCancel: false };
    return {
      restoreOnCancel: Boolean(rows[0].restore_on_cancel),
      updatedBy: rows[0].updated_by || undefined,
      updatedAt: rows[0].updated_at || undefined,
    };
  }

  async saveSettings(settings: CouponPolicySettings): Promise<CouponPolicySettings> {
    const updated: CouponPolicySettings = {
      restoreOnCancel: Boolean(settings.restoreOnCancel),
      updatedBy: settings.updatedBy || 'admin',
      updatedAt: new Date().toISOString(),
    };
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      const store = this.ensureLocalFile();
      store.settings = updated;
      this.writeLocalFile(store);
      return updated;
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    let resp: globalThis.Response;
    try {
      resp = await fetch(`${cfg.url}/rest/v1/coupon_settings`, {
        method: 'POST',
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
          Prefer: 'resolution=merge-duplicates,return=minimal',
        }),
        body: JSON.stringify({
          id: 'default',
          restore_on_cancel: updated.restoreOnCancel,
          updated_by: updated.updatedBy,
          updated_at: updated.updatedAt,
        }),
      });
    } catch (err: any) {
      this.invalidateSupabaseHealth(err?.message || 'Network failure saving coupon_settings');
      throw new CouponStorageUnavailableError('Failed to persist coupon policy settings in database.');
    }
    if (!resp.ok) {
      const errTxt = await resp.text().catch(() => '');
      this.invalidateSupabaseHealth(`HTTP ${resp.status} writing public.coupon_settings: ${errTxt.slice(0, 120)}`);
      throw new CouponStorageUnavailableError('Database rejected coupon policy settings update.');
    }
    return updated;
  }

  async saveCoupon(coupon: CouponRecord, isNew: boolean): Promise<CouponRecord> {
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      const store = this.ensureLocalFile();
      if (isNew) {
        store.coupons.unshift(coupon);
      } else {
        const idx = store.coupons.findIndex((c) => c.id === coupon.id);
        if (idx >= 0) store.coupons[idx] = coupon;
        else store.coupons.unshift(coupon);
      }
      this.writeLocalFile(store);
      return { ...coupon, effectiveStatus: resolveEffectiveCouponStatus(coupon) };
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    if (isNew) {
      const resp = await fetch(`${cfg.url}/rest/v1/coupons`, {
        method: 'POST',
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(couponToDbRow(coupon)),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Failed to create coupon in database: ${errText}`);
      }
    } else {
      const resp = await fetch(`${cfg.url}/rest/v1/coupons?id=eq.${encodeURIComponent(coupon.id)}`, {
        method: 'PATCH',
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(couponToDbRow(coupon)),
      });
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Failed to update coupon in database: ${errText}`);
      }
    }
    return { ...coupon, effectiveStatus: resolveEffectiveCouponStatus(coupon) };
  }

  async deleteCoupon(id: string): Promise<void> {
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      const store = this.ensureLocalFile();
      store.coupons = store.coupons.filter((c) => c.id !== id);
      this.writeLocalFile(store);
      return;
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    const resp = await fetch(`${cfg.url}/rest/v1/coupons?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
    });
    if (!resp.ok) {
      throw new Error('Failed to delete coupon from database.');
    }
  }

  async appendAuditLog(entry: Omit<CouponAuditLogRecord, 'id' | 'createdAt'>): Promise<void> {
    const record: CouponAuditLogRecord = {
      id: generateId('caud'),
      ...entry,
      createdAt: new Date().toISOString(),
    };
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      const store = this.ensureLocalFile();
      store.auditLogs.unshift(record);
      store.auditLogs = store.auditLogs.slice(0, 500);
      this.writeLocalFile(store);
      return;
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    let resp: globalThis.Response;
    try {
      resp = await fetch(`${cfg.url}/rest/v1/coupon_audit_logs`, {
        method: 'POST',
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({
          id: record.id,
          coupon_id: record.couponId || null,
          coupon_code: record.couponCode || null,
          action: record.action,
          actor: record.actor,
          summary: record.summary,
          metadata: record.metadata || {},
          created_at: record.createdAt,
        }),
      });
    } catch (err: any) {
      this.invalidateSupabaseHealth(err?.message || 'Network failure writing coupon_audit_logs');
      throw new CouponStorageUnavailableError('Failed to persist coupon audit log in database.');
    }
    if (!resp.ok) {
      const errTxt = await resp.text().catch(() => '');
      this.invalidateSupabaseHealth(`HTTP ${resp.status} writing public.coupon_audit_logs: ${errTxt.slice(0, 120)}`);
      throw new CouponStorageUnavailableError('Database rejected coupon audit log write.');
    }
  }

  async appendNotification(
    entry: Omit<CouponCustomerNotification, 'id' | 'createdAt'>
  ): Promise<CouponCustomerNotification> {
    const record: CouponCustomerNotification = {
      id: generateId('cnot'),
      ...entry,
      createdAt: new Date().toISOString(),
    };
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      const store = this.ensureLocalFile();
      store.notifications.unshift(record);
      store.notifications = store.notifications.slice(0, 1000);
      this.writeLocalFile(store);
      return record;
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    let resp: globalThis.Response;
    try {
      resp = await fetch(`${cfg.url}/rest/v1/coupon_customer_notifications`, {
        method: 'POST',
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({
          id: record.id,
          coupon_id: record.couponId,
          coupon_code: record.couponCode,
          customer_id: record.customerId || null,
          customer_email: record.customerEmail,
          customer_name: record.customerName || null,
          title: record.title,
          message: record.message,
          channel: record.channel,
          email_sent: record.emailSent,
          email_status_note: record.emailStatusNote || null,
          read_at: record.readAt || null,
          created_at: record.createdAt,
        }),
      });
    } catch (err: any) {
      this.invalidateSupabaseHealth(err?.message || 'Network failure writing coupon_customer_notifications');
      throw new CouponStorageUnavailableError('Failed to persist customer coupon notification in database.');
    }
    if (!resp.ok) {
      const errTxt = await resp.text().catch(() => '');
      this.invalidateSupabaseHealth(
        `HTTP ${resp.status} writing public.coupon_customer_notifications: ${errTxt.slice(0, 120)}`
      );
      throw new CouponStorageUnavailableError('Database rejected customer coupon notification write.');
    }
    return record;
  }

  async saveRedemption(redemption: CouponRedemptionRecord): Promise<void> {
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      const store = this.ensureLocalFile();
      store.redemptions.unshift(redemption);
      this.writeLocalFile(store);
      return;
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    const resp = await fetch(`${cfg.url}/rest/v1/coupon_redemptions`, {
      method: 'POST',
      headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
        Prefer: 'return=minimal',
      }),
      body: JSON.stringify({
        id: redemption.id,
        coupon_id: redemption.couponId,
        coupon_code: redemption.couponCode,
        order_id: redemption.orderId,
        order_number: redemption.orderNumber || null,
        payment_id: redemption.paymentId || null,
        reservation_id: redemption.reservationId || null,
        customer_id: redemption.customerId || null,
        customer_name: redemption.customerName || null,
        customer_email: redemption.customerEmail || null,
        customer_phone: redemption.customerPhone || null,
        subtotal_inr: redemption.subtotalInr,
        discount_inr: redemption.discountInr,
        shipping_saved_inr: redemption.shippingSavedInr,
        final_total_inr: redemption.finalTotalInr,
        payment_status: redemption.paymentStatus,
        status: redemption.status,
        redeemed_at: redemption.redeemedAt,
      }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`Redemption insert failed: ${txt}`);
    }
  }

  async updateRedemptionStatus(
    redemptionId: string,
    status: CouponRedemptionRecord['status']
  ): Promise<CouponRedemptionRecord | null> {
    const safeId = sanitizePostgrestId(redemptionId);
    if (!safeId) return null;
    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      const store = this.ensureLocalFile();
      const target = store.redemptions.find((r) => r.id === safeId);
      if (!target) return null;
      target.status = status;
      this.writeLocalFile(store);
      return target;
    }
    const cfg = this.deps.getSupabaseAdminConfig();
    const resp = await fetch(
      `${cfg.url}/rest/v1/coupon_redemptions?id=eq.${encodeURIComponent(safeId)}`,
      {
        method: 'PATCH',
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
          Prefer: 'return=representation',
        }),
        body: JSON.stringify({ status }),
      }
    );
    if (!resp.ok) return null;
    const rows = (await resp.json()) as any[];
    return rows.length ? dbRowToRedemption(rows[0]) : null;
  }

  // Fetch customer prior order count using sanitized indexed PostgREST queries (no 2,000-row cap)
  async getCustomerPriorOrderCount(params: {
    customerEmail?: string;
    customerPhone?: string;
    customerId?: string;
  }): Promise<number> {
    const cleanEmail = sanitizePostgrestEmail(params.customerEmail);
    const cleanPhone = sanitizePostgrestPhone(params.customerPhone);
    const cleanId = sanitizePostgrestId(params.customerId);
    if (!cleanEmail && !cleanPhone && !cleanId) return 0;

    let count = 0;
    const cfg = this.deps.getSupabaseAdminConfig();
    if (cfg.configured && cfg.url && cfg.serviceRoleKey) {
      try {
        const orderFilters: string[] = [];
        if (cleanEmail) orderFilters.push(`customer_email.ilike.${encodeURIComponent(cleanEmail)}`);
        if (cleanPhone) orderFilters.push(`phone.ilike.*${encodeURIComponent(cleanPhone)}*`);
        if (orderFilters.length > 0) {
          const resp = await fetch(
            `${cfg.url}/rest/v1/custom_orders?select=id&or=(${orderFilters.join(',')})&limit=1`,
            {
              headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
                Prefer: 'count=exact',
              }),
            }
          );
          if (resp.ok) {
            const exact = parsePostgrestTotalCount(resp.headers.get('content-range'));
            if (exact !== null) {
              count = Math.max(count, exact);
            } else {
              const rows = (await resp.json()) as any[];
              count = Math.max(count, rows.length);
            }
          }
        }
      } catch {
        // continue to redemption check
      }
    }

    const useSb = await this.checkSupabaseReady();
    if (!useSb) {
      const redemptions = this.ensureLocalFile().redemptions;
      const matchedOrders = new Set<string>();
      for (const r of redemptions) {
        if (r.status === 'cancelled') continue;
        const emailMatch = cleanEmail && normalizeEmail(r.customerEmail) === cleanEmail;
        const phoneMatch = cleanPhone && normalizePhone(r.customerPhone) === cleanPhone;
        const idMatch = cleanId && r.customerId && r.customerId === cleanId;
        if (emailMatch || phoneMatch || idMatch) {
          matchedOrders.add(r.orderId);
        }
      }
      return Math.max(count, matchedOrders.size);
    }

    const rFilters: string[] = [];
    if (cleanId) rFilters.push(`customer_id.eq.${encodeURIComponent(cleanId)}`);
    if (cleanEmail) rFilters.push(`customer_email.ilike.${encodeURIComponent(cleanEmail)}`);
    if (cleanPhone) rFilters.push(`customer_phone.ilike.*${encodeURIComponent(cleanPhone)}*`);
    if (rFilters.length > 0) {
      const resp = await fetch(
        `${cfg.url}/rest/v1/coupon_redemptions?select=id&status=neq.cancelled&or=(${rFilters.join(',')})&limit=1`,
        {
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Prefer: 'count=exact',
          }),
        }
      );
      if (resp.ok) {
        const exact = parsePostgrestTotalCount(resp.headers.get('content-range'));
        if (exact !== null) count = Math.max(count, exact);
      }
    }
    return count;
  }

  async searchCustomerDirectory(query: string): Promise<CouponCustomerDirectoryItem[]> {
    const q = String(query || '').trim().toLowerCase();
    const map = new Map<string, CouponCustomerDirectoryItem>();

    const upsert = (item: {
      customerId?: string;
      name?: string;
      email?: string;
      phone?: string;
      company?: string;
      accountType?: CustomerGroupType;
      spent?: number;
      date?: string;
      addOrder?: boolean;
    }) => {
      const email = normalizeEmail(item.email);
      const phone = normalizePhone(item.phone);
      const key = email || phone || item.customerId || '';
      if (!key) return;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          customerId: item.customerId || `cust_${crypto.createHash('md5').update(key).digest('hex').slice(0, 8)}`,
          name: item.name || 'Customer',
          email: item.email || '',
          phone: item.phone || '',
          company: item.company || undefined,
          accountType: item.accountType || (item.company ? 'business' : 'individual'),
          ordersCount: item.addOrder ? 1 : 0,
          totalSpent: item.spent || 0,
          lastOrderAt: item.date,
        });
      } else {
        if (item.addOrder) existing.ordersCount += 1;
        existing.totalSpent += item.spent || 0;
        if (!existing.name && item.name) existing.name = item.name;
        if (!existing.email && item.email) existing.email = item.email;
        if (!existing.phone && item.phone) existing.phone = item.phone;
        if (!existing.company && item.company) {
          existing.company = item.company;
          existing.accountType = 'business';
        }
        if (item.date && (!existing.lastOrderAt || item.date > existing.lastOrderAt)) {
          existing.lastOrderAt = item.date;
        }
      }
    };

    // 1. Pull real customers from Supabase custom_orders (deduplicated at order level for multi-item carts — H4)
    const cfg = this.deps.getSupabaseAdminConfig();
    if (cfg.configured && cfg.url && cfg.serviceRoleKey) {
      try {
        let resp = await fetch(
          `${cfg.url}/rest/v1/custom_orders?select=id,customer_name,customer_email,phone,company,quantity,final_total_inr,razorpay_order_id,reservation_id,order_group_id,created_at&order=created_at.desc&limit=500`,
          { headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey) }
        );
        if (!resp.ok) {
          resp = await fetch(
            `${cfg.url}/rest/v1/custom_orders?select=id,customer_name,customer_email,phone,company,quantity,created_at&order=created_at.desc&limit=500`,
            { headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey) }
          );
        }
        if (resp.ok) {
          const rows = (await resp.json()) as any[];
          const seenOrderKeys = new Set<string>();
          for (const row of rows) {
            const dedupeKey = resolveOrderDedupeKey(row);
            const isFirstLineOfOrder = !seenOrderKeys.has(dedupeKey);
            seenOrderKeys.add(dedupeKey);
            const hasStructuredTotal = row.final_total_inr != null && Number.isFinite(Number(row.final_total_inr));
            upsert({
              name: row.customer_name,
              email: row.customer_email,
              phone: row.phone,
              company: row.company,
              spent: hasStructuredTotal
                ? isFirstLineOfOrder
                  ? Number(row.final_total_inr)
                  : 0
                : (Number(row.quantity) || 1) * 499,
              date: row.created_at,
              addOrder: isFirstLineOfOrder,
            });
          }
        }
      } catch {
        // ignore if unreachable
      }
    }

    // 2. Include customers from redemptions and assigned private coupons
    const [redemptions, coupons] = await Promise.all([this.listRedemptions(), this.listCoupons()]);
    for (const r of redemptions) {
      upsert({
        customerId: r.customerId,
        name: r.customerName,
        email: r.customerEmail,
        phone: r.customerPhone,
        spent: r.finalTotalInr,
        date: r.redeemedAt,
        addOrder: true,
      });
    }
    for (const c of coupons) {
      for (const a of c.assignedCustomers || []) {
        upsert({
          customerId: a.customerId,
          name: a.name,
          email: a.email,
          phone: a.phone,
          company: a.company,
          addOrder: false,
        });
      }
    }

    let results = Array.from(map.values());
    if (q) {
      results = results.filter((c) => {
        return (
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.phone.toLowerCase().includes(q) ||
          c.customerId.toLowerCase().includes(q) ||
          (c.company && c.company.toLowerCase().includes(q))
        );
      });
    }
    return results.sort((a, b) => b.ordersCount - a.ordersCount).slice(0, 60);
  }

  private doesItemMatchCategories(item: CouponCartLineInput, allowedCategories: string[]): boolean {
    if (!allowedCategories.length) return false;
    const normalizedAllowed = new Set(allowedCategories.map(normalizeCategorySlug));
    const itemCat = normalizeCategorySlug(item.category);
    if (itemCat && normalizedAllowed.has(itemCat)) return true;

    const catalogEntry = SERVER_PRODUCT_CATALOG[item.productId];
    if (catalogEntry) {
      if (normalizedAllowed.has(normalizeCategorySlug(catalogEntry.category))) return true;
      for (const alias of catalogEntry.aliases) {
        if (normalizedAllowed.has(normalizeCategorySlug(alias))) return true;
      }
    }
    return false;
  }

  private doesCustomerMatchAssigned(
    assigned: AssignedCustomerRef[],
    customerEmail?: string,
    customerPhone?: string,
    customerId?: string
  ): boolean {
    const cleanEmail = normalizeEmail(customerEmail);
    const cleanPhone = normalizePhone(customerPhone);
    const cleanId = String(customerId || '').trim();
    if (!cleanEmail && !cleanPhone && !cleanId) return false;

    return assigned.some((a) => {
      const aEmail = normalizeEmail(a.email);
      const aPhone = normalizePhone(a.phone);
      const aId = String(a.customerId || '').trim();
      if (cleanEmail && aEmail && cleanEmail === aEmail) return true;
      if (cleanPhone && aPhone && cleanPhone === aPhone) return true;
      if (cleanId && aId && cleanId === aId) return true;
      return false;
    });
  }

  async resolveCartLines(rawItems: CouponCartLineInput[] | undefined) {
    const fetcher = {
      fetchProductsFromSupabase: async () => {
        if (this.deps.fetchProductsFromSupabase) {
          return this.deps.fetchProductsFromSupabase();
        }
        return fetchSupabaseProductCatalog(
          this.deps.getSupabaseAdminConfig,
          (key) => this.deps.buildSupabaseAdminHeaders(key)
        );
      },
    };
    return resolveAuthoritativeCartPricing(rawItems, { fetcher });
  }

  // ============================================================================
  // UNIFIED SERVER-SIDE COUPON VALIDATION ENGINE
  // Strictly uses verified Supabase JWT customer identity, server-side catalog
  // pricing, server-signed recovery verification, and indexed DB count queries.
  // ============================================================================
  async evaluateCoupon(
    input: CouponValidationRequest,
    options?: {
      verifiedCustomer?: VerifiedCustomerSession | null;
      recoveryVerified?: boolean;
      nowMs?: number;
    }
  ): Promise<CouponValidationResult & { authoritativeItems?: AuthoritativeCartLine[] }> {
    const nowMs = options?.nowMs ?? Date.now();
    const verifiedCustomer = options?.verifiedCustomer ?? null;
    const recoveryVerified = Boolean(options?.recoveryVerified);

    // 0. Resolve authoritative server-side product pricing (NEVER trusts client unitPrice or subtotal)
    const cartPricing = await this.resolveCartLines(input.items);
    if (!cartPricing.valid) {
      return {
        valid: false,
        discountAmount: 0,
        shippingFee: STANDARD_SHIPPING_FEE_INR,
        shippingSaved: 0,
        freeShippingApplied: false,
        subtotal: 0,
        eligibleSubtotal: 0,
        taxableSubtotal: 0,
        gstAmount: 0,
        finalTotal: 0,
        advanceAmount50: 0,
        balanceAmount50: 0,
        message: cartPricing.message || 'Valid cart items are required to apply a coupon.',
        reasonCode: 'INVALID_CART_ITEMS',
      };
    }

    const items = cartPricing.items;
    const subtotal = cartPricing.subtotal;
    const baseShipping = cartPricing.baseShippingFee;
    const baseGst = cartPricing.baseGstAmount;
    const baseTotal = cartPricing.baseFinalTotal;
    const baseAdvance50 = Math.round(baseTotal * 0.5);

    const reject = (
      reasonCode: NonNullable<CouponValidationResult['reasonCode']>,
      message: string
    ): CouponValidationResult => ({
      valid: false,
      discountAmount: 0,
      shippingFee: baseShipping,
      shippingSaved: 0,
      freeShippingApplied: false,
      subtotal,
      eligibleSubtotal: 0,
      taxableSubtotal: subtotal,
      gstAmount: baseGst,
      finalTotal: baseTotal,
      advanceAmount50: baseAdvance50,
      balanceAmount50: Math.max(0, baseTotal - baseAdvance50),
      message,
      reasonCode,
    });

    const normalizedCode = normalizeCouponCode(input.code);
    if (!normalizedCode) {
      return reject('INVALID_CODE', 'Please enter a coupon code.');
    }

    const coupons = await this.listCoupons();
    const coupon = coupons.find(
      (c) =>
        normalizeCouponCode(c.code) === normalizedCode ||
        (c.aliases || []).some((a) => normalizeCouponCode(a) === normalizedCode)
    );

    if (!coupon) {
      return reject(
        'INVALID_CODE',
        'Invalid coupon code. Please verify the code and try again.'
      );
    }

    // 1. Server-clock status check
    const effectiveStatus = resolveEffectiveCouponStatus(coupon, nowMs);
    if (effectiveStatus === 'scheduled') {
      const startLabel = coupon.startAt
        ? new Date(coupon.startAt).toLocaleString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'a future date';
      return reject('NOT_STARTED', `This coupon is scheduled and will become active on ${startLabel}.`);
    }
    if (effectiveStatus === 'expired') {
      return reject('EXPIRED', `Coupon ${coupon.code} has expired.`);
    }
    if (effectiveStatus !== 'active') {
      return reject(
        'INACTIVE_STATUS',
        `Coupon ${coupon.code} is currently ${effectiveStatus} and cannot be applied.`
      );
    }

    // 2. Trusted server-side recovery session check (SAVE5NOW / TEQQNO5)
    // NEVER trusts client-supplied `hasActiveRecoveryCoupon` boolean.
    if (coupon.requiresRecoverySession) {
      const trustedRecovery =
        recoveryVerified ||
        Boolean(
          this.deps.verifyRecoveryEligibility?.({
            recoveryToken: input.recoveryToken,
            checkoutSessionId: input.checkoutSessionId,
            customerPhone: verifiedCustomer?.phone,
            customerEmail: verifiedCustomer?.email,
          })
        );
      if (!trustedRecovery) {
        return reject(
          'RECOVERY_SESSION_REQUIRED',
          `Coupon ${coupon.code} is valid only with an active server-verified checkout recovery offer.`
        );
      }
    }

    // 3. Combination rules
    if (
      !coupon.allowCombineWithCoupons &&
      Array.isArray(input.otherCouponCodesApplied) &&
      input.otherCouponCodesApplied.some((other) => normalizeCouponCode(other) !== coupon.code)
    ) {
      return reject(
        'COMBINATION_NOT_ALLOWED',
        `Coupon ${coupon.code} cannot be combined with other coupon codes.`
      );
    }
    if (!coupon.allowCombineWithPromotions && input.hasOtherPromotionsApplied) {
      return reject(
        'COMBINATION_NOT_ALLOWED',
        `Coupon ${coupon.code} cannot be combined with other active promotions.`
      );
    }

    // Derive customer identity EXCLUSIVELY from verified Supabase Auth JWT
    const trustedId = verifiedCustomer?.customerId || '';
    const trustedEmail = verifiedCustomer?.email || '';
    const trustedPhone = verifiedCustomer?.phone || '';
    const trustedAccountType = verifiedCustomer?.accountType;

    // 4. Customer-specific / private check (STRICTLY requires verified JWT)
    if (coupon.isPrivate || coupon.applicability === 'selected_customers') {
      if (!verifiedCustomer) {
        return reject(
          'AUTH_REQUIRED',
          'Please sign in to your TeqqnoWorld account to apply this private customer coupon.'
        );
      }
      const eligible = this.doesCustomerMatchAssigned(
        coupon.assignedCustomers || [],
        trustedEmail,
        trustedPhone,
        trustedId
      );
      if (!eligible) {
        return reject(
          'CUSTOMER_NOT_ELIGIBLE',
          'This coupon is private and is not eligible for your signed-in account.'
        );
      }
    }

    // 5. New vs Existing customer check (STRICTLY requires verified JWT)
    if (coupon.applicability === 'new_customers_only') {
      if (!verifiedCustomer) {
        return reject(
          'AUTH_REQUIRED',
          'Please sign in to verify first-time customer eligibility for this coupon.'
        );
      }
      const priorOrders = await this.getCustomerPriorOrderCount({
        customerEmail: trustedEmail,
        customerPhone: trustedPhone,
        customerId: trustedId,
      });
      if (priorOrders > 0) {
        return reject(
          'NEW_CUSTOMER_ONLY',
          `Coupon ${coupon.code} is valid exclusively for new customers placing their first order.`
        );
      }
    }

    if (coupon.applicability === 'existing_customers_only') {
      if (!verifiedCustomer) {
        return reject(
          'AUTH_REQUIRED',
          'Please sign in with your existing customer account to use this loyalty coupon.'
        );
      }
      const priorOrders = await this.getCustomerPriorOrderCount({
        customerEmail: trustedEmail,
        customerPhone: trustedPhone,
        customerId: trustedId,
      });
      if (priorOrders === 0) {
        return reject(
          'EXISTING_CUSTOMER_ONLY',
          `Coupon ${coupon.code} is exclusively for returning TeqqnoWorld customers.`
        );
      }
    }

    // 6. Customer group check (STRICTLY uses verified accountType from JWT metadata)
    if (
      coupon.applicability === 'selected_customer_groups' &&
      (coupon.eligibleCustomerGroups || []).length > 0
    ) {
      if (!verifiedCustomer) {
        return reject(
          'AUTH_REQUIRED',
          `Please sign in to verify ${coupon.eligibleCustomerGroups.join(' / ')} account eligibility.`
        );
      }
      if (!trustedAccountType || !coupon.eligibleCustomerGroups.includes(trustedAccountType)) {
        return reject(
          'CUSTOMER_GROUP_NOT_ELIGIBLE',
          `Coupon ${coupon.code} is restricted to ${coupon.eligibleCustomerGroups.join(' / ')} accounts.`
        );
      }
    }

    // 7. Min & Max cart value check (against authoritative server subtotal)
    if (coupon.minOrderAmount > 0 && subtotal < coupon.minOrderAmount) {
      return reject(
        'MIN_ORDER_NOT_MET',
        `Minimum order value of ₹${Number(coupon.minOrderAmount).toLocaleString('en-IN')} is required for ${coupon.code}. Add ₹${(coupon.minOrderAmount - subtotal).toLocaleString('en-IN')} more to unlock.`
      );
    }
    if (coupon.maxOrderAmount != null && coupon.maxOrderAmount > 0 && subtotal > coupon.maxOrderAmount) {
      return reject(
        'MAX_ORDER_EXCEEDED',
        `Coupon ${coupon.code} applies to orders up to ₹${Number(coupon.maxOrderAmount).toLocaleString('en-IN')}.`
      );
    }

    // 8. Usage limits (Targeted indexed DB counts — no 2,000-row cap)
    if (coupon.totalUsageLimit != null) {
      const [redeemedCount, activeReservedCount] = await Promise.all([
        this.countActiveRedemptionsForCoupon(coupon.id),
        this.countActiveReservationsForCoupon(coupon.id, nowMs),
      ]);
      const actualUsageCount = Math.max(coupon.usageCount || 0, redeemedCount) + activeReservedCount;
      if (actualUsageCount >= coupon.totalUsageLimit) {
        return reject(
          'TOTAL_LIMIT_REACHED',
          `Coupon ${coupon.code} has reached its maximum total redemption limit.`
        );
      }
    }

    // H5: Per-customer / one-time limits strictly require a verified customer identity
    const effectivePerCustomerLimit = coupon.oneTimePerCustomer
      ? 1
      : coupon.perCustomerLimit ?? null;

    if (effectivePerCustomerLimit != null) {
      if (!verifiedCustomer || (!trustedId && !trustedEmail && !trustedPhone)) {
        return reject(
          'AUTH_REQUIRED',
          `Please sign in to your TeqqnoWorld account to apply ${coupon.code} (per-customer usage limit applies).`
        );
      }

      const customerUsedCount = await this.countCustomerCouponUsage(
        coupon.id,
        {
          customerId: trustedId,
          customerEmail: trustedEmail,
          customerPhone: trustedPhone,
        },
        nowMs
      );

      if (customerUsedCount >= effectivePerCustomerLimit) {
        return reject(
          'CUSTOMER_LIMIT_REACHED',
          coupon.oneTimePerCustomer
            ? `Coupon ${coupon.code} is valid for one-time use per customer and has already been used by your account.`
            : `You have reached the maximum usage limit (${effectivePerCustomerLimit}) for coupon ${coupon.code}.`
        );
      }
    }

    // 9. Product & Category Applicability (using authoritative server-resolved lines)
    let eligibleSubtotal = subtotal;
    if (coupon.applicability === 'selected_products') {
      const allowedSet = new Set(coupon.eligibleProductIds || []);
      const matchingItems = items.filter((item) => allowedSet.has(item.productId));
      eligibleSubtotal = Math.round(
        matchingItems.reduce((sum, i) => sum + i.lineTotal, 0)
      );
      if (matchingItems.length === 0 || eligibleSubtotal <= 0) {
        return reject(
          'PRODUCT_NOT_ELIGIBLE',
          `Coupon ${coupon.code} applies only to selected eligible products not present in your cart.`
        );
      }
    } else if (coupon.applicability === 'selected_categories') {
      const matchingItems = items.filter((item) =>
        this.doesItemMatchCategories(
          {
            productId: item.productId,
            productName: item.productName,
            category: item.category,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
          },
          coupon.eligibleCategories || []
        )
      );
      eligibleSubtotal = Math.round(
        matchingItems.reduce((sum, i) => sum + i.lineTotal, 0)
      );
      if (matchingItems.length === 0 || eligibleSubtotal <= 0) {
        return reject(
          'CATEGORY_NOT_ELIGIBLE',
          `Coupon ${coupon.code} applies only to selected categories (${(coupon.eligibleCategories || []).join(', ')}).`
        );
      }
    }

    // 10. Authoritative Discount, Shipping, GST & Payable Calculation
    let discountAmount = 0;
    let shippingFee = baseShipping;
    let shippingSaved = 0;
    let freeShippingApplied = false;

    if (coupon.offerType === 'percentage') {
      const rawDiscount = Math.round((eligibleSubtotal * Math.min(100, Math.max(0, coupon.discountValue))) / 100);
      const capped =
        coupon.maxDiscountCap != null && coupon.maxDiscountCap > 0
          ? Math.min(rawDiscount, Math.round(coupon.maxDiscountCap))
          : rawDiscount;
      discountAmount = Math.min(eligibleSubtotal, Math.max(0, capped));
    } else if (coupon.offerType === 'fixed') {
      discountAmount = Math.min(eligibleSubtotal, Math.max(0, Math.round(coupon.discountValue)));
    } else if (coupon.offerType === 'free_shipping') {
      discountAmount = 0;
      freeShippingApplied = true;
      shippingSaved = baseShipping;
      shippingFee = 0;
    }

    const taxableSubtotal = Math.max(0, subtotal - discountAmount);
    const gstAmount = Math.round(taxableSubtotal * GST_RATE);
    const finalTotal = taxableSubtotal + gstAmount + shippingFee;
    const advanceAmount50 = Math.round(finalTotal * 0.5);
    const balanceAmount50 = Math.max(0, finalTotal - advanceAmount50);

    const savingsMessage =
      coupon.offerType === 'free_shipping'
        ? shippingSaved > 0
          ? `${coupon.code} applied — Free Shipping unlocked (₹${shippingSaved} saved)!`
          : `${coupon.code} applied — Free Express Shipping confirmed!`
        : `${coupon.code} applied — You save ₹${discountAmount.toLocaleString('en-IN')}!`;

    return {
      valid: true,
      code: coupon.code,
      couponId: coupon.id,
      name: coupon.name,
      description: coupon.description,
      offerType: coupon.offerType,
      discountValue: coupon.discountValue,
      discountAmount,
      shippingFee,
      shippingSaved,
      freeShippingApplied,
      subtotal,
      eligibleSubtotal,
      taxableSubtotal,
      gstAmount,
      finalTotal,
      advanceAmount50,
      balanceAmount50,
      isPrivate: coupon.isPrivate,
      isFestival: coupon.isFestival,
      badgeText: formatOfferBadge(coupon),
      message: savingsMessage,
      reasonCode: 'VALID',
      authoritativeItems: items,
    };
  }

  // ============================================================================
  // ATOMIC COUPON RESERVATION -> PAYMENT FINALIZATION -> RELEASE -> RESTORE
  // Backed by PostgreSQL RPC transactions (SELECT ... FOR UPDATE) in Supabase
  // mode and cross-process OS lockfiles in local dev/test mode.
  // ============================================================================
  async reserveCouponAtomic(params: {
    code: string;
    items: CouponCartLineInput[];
    paymentPlan: 'prepaid_100' | 'partial_50';
    verifiedCustomer?: VerifiedCustomerSession | null;
    recoveryToken?: string;
    checkoutSessionId?: string;
    recoveryVerified?: boolean;
    ttlSeconds?: number;
  }): Promise<{
    success: boolean;
    reservation?: CouponReservationRecord;
    validation: CouponValidationResult;
    httpStatus: number;
  }> {
    const validation = await this.evaluateCoupon(
      {
        code: params.code,
        items: params.items,
        paymentPlan: params.paymentPlan,
        recoveryToken: params.recoveryToken,
        checkoutSessionId: params.checkoutSessionId,
      },
      {
        verifiedCustomer: params.verifiedCustomer ?? null,
        recoveryVerified: params.recoveryVerified,
      }
    );

    if (!validation.valid || !validation.couponId || !validation.code) {
      const status =
        validation.reasonCode === 'AUTH_REQUIRED'
          ? 401
          : validation.reasonCode === 'CUSTOMER_NOT_ELIGIBLE'
          ? 403
          : validation.reasonCode === 'TOTAL_LIMIT_REACHED' ||
            validation.reasonCode === 'CUSTOMER_LIMIT_REACHED'
          ? 409
          : 400;
      return { success: false, validation, httpStatus: status };
    }

    const reservationId = generateId('cres');
    const ttlSeconds = Math.max(60, Math.min(params.ttlSeconds ?? DEFAULT_RESERVATION_TTL_SECONDS, 3600));
    const payableInr =
      params.paymentPlan === 'partial_50' ? validation.advanceAmount50 : validation.finalTotal;
    const balanceDueInr =
      params.paymentPlan === 'partial_50' ? validation.balanceAmount50 : 0;
    const authItems = validation.authoritativeItems || [];
    const verifiedCustomer = params.verifiedCustomer ?? null;

    const useSb = await this.checkSupabaseReady();
    if (useSb) {
      const cfg = this.deps.getSupabaseAdminConfig();
      let rpcResp: globalThis.Response;
      try {
        rpcResp = await fetch(`${cfg.url}/rest/v1/rpc/teqqno_reserve_coupon`, {
          method: 'POST',
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
          body: JSON.stringify({
            p_reservation_id: reservationId,
            p_coupon_id: validation.couponId,
            p_customer_id: verifiedCustomer?.customerId || null,
            p_customer_email: verifiedCustomer?.email || null,
            p_customer_phone: verifiedCustomer?.phone || null,
            p_subtotal_inr: validation.subtotal,
            p_discount_inr: validation.discountAmount,
            p_shipping_fee_inr: validation.shippingFee,
            p_shipping_saved_inr: validation.shippingSaved,
            p_free_shipping_applied: validation.freeShippingApplied,
            p_gst_inr: validation.gstAmount,
            p_final_total_inr: validation.finalTotal,
            p_payable_inr: payableInr,
            p_balance_due_inr: balanceDueInr,
            p_payment_plan: params.paymentPlan,
            p_items_json: authItems,
            p_ttl_seconds: ttlSeconds,
          }),
        });
      } catch (err: any) {
        this.invalidateSupabaseHealth(err?.message || 'RPC teqqno_reserve_coupon network error');
        throw new CouponStorageUnavailableError('Unable to reserve coupon capacity right now.');
      }
      if (!rpcResp.ok) {
        const errTxt = await rpcResp.text().catch(() => '');
        this.invalidateSupabaseHealth(`RPC teqqno_reserve_coupon HTTP ${rpcResp.status}: ${errTxt.slice(0, 120)}`);
        throw new CouponStorageUnavailableError(
          'Atomic coupon reservation RPC is unavailable. Ensure security hardening SQL migration is applied.'
        );
      }
      const rpcResult = (await rpcResp.json()) as any;
      if (!rpcResult?.ok) {
        const reason = rpcResult?.reason_code || 'TOTAL_LIMIT_REACHED';
        const httpStatus =
          reason === 'AUTH_REQUIRED'
            ? 401
            : reason === 'TOTAL_LIMIT_REACHED' || reason === 'CUSTOMER_LIMIT_REACHED'
            ? 409
            : 400;
        return {
          success: false,
          validation: {
            ...validation,
            valid: false,
            reasonCode: reason,
            message: rpcResult?.message || 'Unable to reserve coupon.',
          },
          httpStatus,
        };
      }

      const nowIso = new Date().toISOString();
      const reservation: CouponReservationRecord = {
        id: reservationId,
        couponId: validation.couponId,
        couponCode: validation.code,
        customerId: verifiedCustomer?.customerId,
        customerEmail: verifiedCustomer?.email,
        customerPhone: verifiedCustomer?.phone,
        subtotalInr: validation.subtotal,
        discountInr: validation.discountAmount,
        shippingFeeInr: validation.shippingFee,
        shippingSavedInr: validation.shippingSaved,
        freeShippingApplied: validation.freeShippingApplied,
        gstInr: validation.gstAmount,
        finalTotalInr: validation.finalTotal,
        payableInr,
        balanceDueInr,
        paymentPlan: params.paymentPlan,
        itemsJson: authItems,
        status: 'reserved',
        expiresAt: rpcResult.expires_at || new Date(Date.now() + ttlSeconds * 1000).toISOString(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      return { success: true, reservation, validation, httpStatus: 200 };
    }

    // Local dev/test atomic reservation guarded by OS-level lockfile (multi-worker safe)
    return withLocalFileLock(this.filePath, async () => {
      const store = this.ensureLocalFile();
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const coupon = store.coupons.find((c) => c.id === validation.couponId);
      if (!coupon) {
        return {
          success: false,
          validation: { ...validation, valid: false, reasonCode: 'INVALID_CODE', message: 'Coupon not found.' },
          httpStatus: 404,
        };
      }

      // Expire stale reservations inside lock
      let mutated = false;
      for (const r of store.reservations) {
        if (r.couponId === coupon.id && r.status === 'reserved' && Date.parse(r.expiresAt) <= nowMs) {
          r.status = 'expired';
          r.updatedAt = nowIso;
          mutated = true;
        }
      }

      if (coupon.totalUsageLimit != null) {
        const redeemedTotal = store.redemptions.filter(
          (r) => r.couponId === coupon.id && r.status === 'redeemed'
        ).length;
        const activeReservedTotal = store.reservations.filter(
          (r) => r.couponId === coupon.id && r.status === 'reserved' && Date.parse(r.expiresAt) > nowMs
        ).length;
        if (Math.max(coupon.usageCount || 0, redeemedTotal) + activeReservedTotal >= coupon.totalUsageLimit) {
          if (mutated) this.writeLocalFile(store);
          return {
            success: false,
            validation: {
              ...validation,
              valid: false,
              reasonCode: 'TOTAL_LIMIT_REACHED',
              message: `Coupon ${coupon.code} has reached its maximum total redemption limit.`,
            },
            httpStatus: 409,
          };
        }
      }

      const effectivePerCustomerLimit = coupon.oneTimePerCustomer
        ? 1
        : coupon.perCustomerLimit ?? null;
      if (effectivePerCustomerLimit != null) {
        const cId = verifiedCustomer?.customerId || '';
        const cEmail = verifiedCustomer?.email || '';
        const cPhone = verifiedCustomer?.phone || '';
        if (!cId && !cEmail && !cPhone) {
          return {
            success: false,
            validation: {
              ...validation,
              valid: false,
              reasonCode: 'AUTH_REQUIRED',
              message: 'Please sign in to your account to reserve this per-customer coupon.',
            },
            httpStatus: 401,
          };
        }
        const matches = (r: { customerId?: string; customerEmail?: string; customerPhone?: string }) =>
          Boolean(
            (cId && r.customerId && r.customerId === cId) ||
              (cEmail && normalizeEmail(r.customerEmail) === cEmail) ||
              (cPhone && normalizePhone(r.customerPhone) === cPhone)
          );
        const usedByCustomer = store.redemptions.filter(
          (r) => r.couponId === coupon.id && r.status === 'redeemed' && matches(r)
        ).length;
        const reservedByCustomer = store.reservations.filter(
          (r) =>
            r.couponId === coupon.id &&
            r.status === 'reserved' &&
            Date.parse(r.expiresAt) > nowMs &&
            matches(r)
        ).length;

        if (usedByCustomer + reservedByCustomer >= effectivePerCustomerLimit) {
          if (mutated) this.writeLocalFile(store);
          return {
            success: false,
            validation: {
              ...validation,
              valid: false,
              reasonCode: 'CUSTOMER_LIMIT_REACHED',
              message: `You have already reached the usage limit for coupon ${coupon.code}.`,
            },
            httpStatus: 409,
          };
        }
      }

      const reservation: CouponReservationRecord = {
        id: reservationId,
        couponId: coupon.id,
        couponCode: coupon.code,
        customerId: verifiedCustomer?.customerId,
        customerEmail: verifiedCustomer?.email,
        customerPhone: verifiedCustomer?.phone,
        subtotalInr: validation.subtotal,
        discountInr: validation.discountAmount,
        shippingFeeInr: validation.shippingFee,
        shippingSavedInr: validation.shippingSaved,
        freeShippingApplied: validation.freeShippingApplied,
        gstInr: validation.gstAmount,
        finalTotalInr: validation.finalTotal,
        payableInr,
        balanceDueInr,
        paymentPlan: params.paymentPlan,
        itemsJson: authItems,
        status: 'reserved',
        expiresAt: new Date(nowMs + ttlSeconds * 1000).toISOString(),
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      store.reservations.unshift(reservation);
      this.writeLocalFile(store);
      return { success: true, reservation, validation, httpStatus: 200 };
    });
  }

  async attachRazorpayOrderToReservation(
    reservationId: string,
    razorpayOrderId: string
  ): Promise<void> {
    const safeResId = sanitizePostgrestId(reservationId);
    const safeRzpId = sanitizePostgrestId(razorpayOrderId);
    if (!safeResId || !safeRzpId) return;

    const useSb = await this.checkSupabaseReady();
    if (useSb) {
      const cfg = this.deps.getSupabaseAdminConfig();
      const resp = await fetch(
        `${cfg.url}/rest/v1/coupon_reservations?id=eq.${encodeURIComponent(safeResId)}`,
        {
          method: 'PATCH',
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Prefer: 'return=minimal',
          }),
          body: JSON.stringify({
            razorpay_order_id: safeRzpId,
            updated_at: new Date().toISOString(),
          }),
        }
      );
      if (!resp.ok) {
        this.invalidateSupabaseHealth(`HTTP ${resp.status} updating reservation razorpay_order_id`);
        throw new CouponStorageUnavailableError('Failed to bind Razorpay order to coupon reservation.');
      }
      return;
    }

    await withLocalFileLock(this.filePath, async () => {
      const store = this.ensureLocalFile();
      const target = store.reservations.find((r) => r.id === safeResId);
      if (target) {
        target.razorpayOrderId = safeRzpId;
        target.updatedAt = new Date().toISOString();
        this.writeLocalFile(store);
      }
    });
  }

  async getReservation(params: {
    reservationId?: string;
    razorpayOrderId?: string;
  }): Promise<CouponReservationRecord | null> {
    const safeResId = sanitizePostgrestId(params.reservationId);
    const safeRzpId = sanitizePostgrestId(params.razorpayOrderId);
    if (!safeResId && !safeRzpId) return null;

    const useSb = await this.checkSupabaseReady();
    if (useSb) {
      const cfg = this.deps.getSupabaseAdminConfig();
      const filter = safeResId
        ? `id=eq.${encodeURIComponent(safeResId)}`
        : `razorpay_order_id=eq.${encodeURIComponent(safeRzpId)}`;
      const resp = await fetch(
        `${cfg.url}/rest/v1/coupon_reservations?select=*&${filter}&limit=1`,
        { headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey) }
      );
      if (!resp.ok) {
        this.invalidateSupabaseHealth(`HTTP ${resp.status} reading reservation`);
        throw new CouponStorageUnavailableError('Unable to fetch coupon reservation.');
      }
      const rows = (await resp.json()) as any[];
      return rows.length ? dbRowToReservation(rows[0]) : null;
    }

    const store = this.ensureLocalFile();
    return (
      store.reservations.find(
        (r) =>
          (safeResId && r.id === safeResId) ||
          (safeRzpId && r.razorpayOrderId === safeRzpId)
      ) || null
    );
  }

  async releaseReservationAtomic(params: {
    reservationId?: string;
    razorpayOrderId?: string;
    reason?: string;
  }): Promise<{ ok: boolean; released: boolean; reservationId?: string | null }> {
    const safeResId = sanitizePostgrestId(params.reservationId);
    const safeRzpId = sanitizePostgrestId(params.razorpayOrderId);
    if (!safeResId && !safeRzpId) return { ok: true, released: false };

    const useSb = await this.checkSupabaseReady();
    if (useSb) {
      const cfg = this.deps.getSupabaseAdminConfig();
      const rpcResp = await fetch(`${cfg.url}/rest/v1/rpc/teqqno_release_coupon_reservation`, {
        method: 'POST',
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
        body: JSON.stringify({
          p_reservation_id: safeResId || null,
          p_razorpay_order_id: safeRzpId || null,
        }),
      });
      if (!rpcResp.ok) {
        this.invalidateSupabaseHealth(`RPC teqqno_release_coupon_reservation HTTP ${rpcResp.status}`);
        throw new CouponStorageUnavailableError('Unable to release coupon reservation.');
      }
      const data = (await rpcResp.json()) as any;
      return {
        ok: Boolean(data?.ok),
        released: Boolean(data?.released),
        reservationId: data?.reservation_id || null,
      };
    }

    return withLocalFileLock(this.filePath, async () => {
      const store = this.ensureLocalFile();
      const target = store.reservations.find(
        (r) =>
          r.status === 'reserved' &&
          ((safeResId && r.id === safeResId) || (safeRzpId && r.razorpayOrderId === safeRzpId))
      );
      if (!target) return { ok: true, released: false, reservationId: null };
      target.status = 'released';
      target.updatedAt = new Date().toISOString();
      this.writeLocalFile(store);
      return { ok: true, released: true, reservationId: target.id };
    });
  }

  // Server-internal atomic finalization (ONLY invoked after confirmed payment + real order creation)
  async finalizeReservationAtomic(params: {
    reservationId?: string;
    razorpayOrderId?: string;
    orderId: string;
    orderNumber?: string;
    paymentId?: string;
    customerName?: string;
    paymentStatus?: string;
  }): Promise<{
    success: boolean;
    alreadyFinalized?: boolean;
    reconciled?: boolean;
    redemptionId?: string;
    couponCode?: string;
    orderId?: string;
    message: string;
    httpStatus: number;
  }> {
    let reservationId = sanitizePostgrestId(params.reservationId);
    if (!reservationId && params.razorpayOrderId) {
      const found = await this.getReservation({ razorpayOrderId: params.razorpayOrderId });
      if (found) reservationId = found.id;
    }
    if (!reservationId) {
      return {
        success: false,
        message: 'Coupon reservation not found.',
        httpStatus: 404,
      };
    }

    const cleanOrderId = String(params.orderId || '').trim();
    if (!cleanOrderId) {
      return {
        success: false,
        message: 'Order ID is required to finalize coupon reservation.',
        httpStatus: 400,
      };
    }

    const redemptionId = generateId('cred');
    const useSb = await this.checkSupabaseReady();
    if (useSb) {
      const cfg = this.deps.getSupabaseAdminConfig();
      const rpcResp = await fetch(`${cfg.url}/rest/v1/rpc/teqqno_finalize_coupon_reservation`, {
        method: 'POST',
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
        body: JSON.stringify({
          p_reservation_id: reservationId,
          p_redemption_id: redemptionId,
          p_order_id: cleanOrderId,
          p_order_number: params.orderNumber || null,
          p_payment_id: params.paymentId || null,
          p_customer_name: params.customerName || null,
          p_payment_status: params.paymentStatus || 'paid',
        }),
      });
      if (!rpcResp.ok) {
        const errTxt = await rpcResp.text().catch(() => '');
        this.invalidateSupabaseHealth(
          `RPC teqqno_finalize_coupon_reservation HTTP ${rpcResp.status}: ${errTxt.slice(0, 120)}`
        );
        throw new CouponStorageUnavailableError('Failed to finalize coupon redemption in database.');
      }
      const data = (await rpcResp.json()) as any;
      if (!data?.ok) {
        return {
          success: false,
          message: data?.message || 'Unable to finalize coupon reservation.',
          httpStatus: data?.reason_code === 'RESERVATION_NOT_FOUND' ? 404 : 409,
        };
      }
      return {
        success: true,
        alreadyFinalized: Boolean(data.already_finalized),
        reconciled: Boolean(data.reconciled),
        redemptionId: data.redemption_id,
        couponCode: data.coupon_code,
        orderId: data.order_id || cleanOrderId,
        message: data.reconciled
          ? 'Coupon redemption reconciled with final order ID.'
          : data.already_finalized
          ? 'Coupon redemption was already finalized.'
          : 'Coupon redemption finalized.',
        httpStatus: 200,
      };
    }

    return withLocalFileLock(this.filePath, async () => {
      const store = this.ensureLocalFile();
      const nowMs = Date.now();
      const nowIso = new Date(nowMs).toISOString();
      const resRec = store.reservations.find((r) => r.id === reservationId);
      if (!resRec) {
        return { success: false, message: 'Coupon reservation not found.', httpStatus: 404 };
      }

      // Idempotent check on reservationId, paymentId, or (couponId, orderId)
      const existing = store.redemptions.find(
        (r) =>
          r.reservationId === reservationId ||
          (params.paymentId && r.paymentId === params.paymentId) ||
          (r.couponId === resRec.couponId && r.orderId === cleanOrderId)
      );
      if (existing) {
        let reconciled = false;
        let mutated = false;
        // Safe webhook-first reconciliation (C5): upgrade temporary 'RZP-...' placeholder to real order ID
        // ONLY when linked to this same reservation/payment and never overwriting a different real order ID.
        if (
          existing.orderId.startsWith('RZP-') &&
          !cleanOrderId.startsWith('RZP-') &&
          (existing.reservationId === reservationId ||
            (params.paymentId && existing.paymentId === params.paymentId))
        ) {
          const conflictExists = store.redemptions.some(
            (r) => r.id !== existing.id && r.couponId === existing.couponId && r.orderId === cleanOrderId
          );
          if (!conflictExists) {
            existing.orderId = cleanOrderId;
            if (params.orderNumber && params.orderNumber.trim()) {
              existing.orderNumber = params.orderNumber.trim();
            }
            if (params.customerName && params.customerName.trim()) {
              existing.customerName = params.customerName.trim();
            }
            if (params.paymentId && !existing.paymentId) {
              existing.paymentId = params.paymentId;
            }
            if (!resRec.orderId || resRec.orderId.startsWith('RZP-')) {
              resRec.orderId = cleanOrderId;
            }
            resRec.status = 'finalized';
            resRec.razorpayPaymentId = resRec.razorpayPaymentId || params.paymentId;
            resRec.updatedAt = nowIso;
            reconciled = true;
            mutated = true;
          }
        } else if (resRec.status !== 'finalized') {
          resRec.status = 'finalized';
          resRec.orderId = resRec.orderId || cleanOrderId;
          resRec.razorpayPaymentId = resRec.razorpayPaymentId || params.paymentId;
          resRec.updatedAt = nowIso;
          mutated = true;
        }
        if (mutated) this.writeLocalFile(store);
        return {
          success: true,
          alreadyFinalized: true,
          reconciled,
          redemptionId: existing.id,
          couponCode: existing.couponCode,
          orderId: existing.orderId,
          message: reconciled
            ? 'Coupon redemption reconciled with final order ID.'
            : 'Coupon redemption was already finalized.',
          httpStatus: 200,
        };
      }

      if (resRec.status === 'released') {
        return {
          success: false,
          message: 'Coupon reservation was already released.',
          httpStatus: 409,
        };
      }

      const coupon = store.coupons.find((c) => c.id === resRec.couponId);
      if (!coupon) {
        return { success: false, message: 'Coupon no longer exists.', httpStatus: 404 };
      }

      if (resRec.status === 'expired' || Date.parse(resRec.expiresAt) <= nowMs) {
        if (coupon.totalUsageLimit != null) {
          const redeemedTotal = store.redemptions.filter(
            (r) => r.couponId === coupon.id && r.status === 'redeemed'
          ).length;
          const otherActiveReserved = store.reservations.filter(
            (r) =>
              r.couponId === coupon.id &&
              r.id !== reservationId &&
              r.status === 'reserved' &&
              Date.parse(r.expiresAt) > nowMs
          ).length;
          if (Math.max(coupon.usageCount || 0, redeemedTotal) + otherActiveReserved >= coupon.totalUsageLimit) {
            return {
              success: false,
              message: 'Coupon reservation expired and capacity is no longer available.',
              httpStatus: 409,
            };
          }
        }
      }

      const redemption: CouponRedemptionRecord = {
        id: redemptionId,
        couponId: coupon.id,
        couponCode: coupon.code,
        orderId: cleanOrderId,
        orderNumber: params.orderNumber,
        paymentId: params.paymentId,
        reservationId,
        customerId: resRec.customerId,
        customerName: params.customerName,
        customerEmail: resRec.customerEmail,
        customerPhone: resRec.customerPhone,
        subtotalInr: resRec.subtotalInr,
        discountInr: resRec.discountInr,
        shippingSavedInr: resRec.shippingSavedInr,
        finalTotalInr: resRec.finalTotalInr,
        paymentStatus: params.paymentStatus || 'paid',
        status: 'redeemed',
        redeemedAt: nowIso,
      };
      store.redemptions.unshift(redemption);

      coupon.usageCount = (coupon.usageCount || 0) + 1;
      coupon.totalDiscountGiven =
        Math.round(((coupon.totalDiscountGiven || 0) + resRec.discountInr + resRec.shippingSavedInr) * 100) /
        100;
      coupon.totalRevenueGenerated =
        Math.round(((coupon.totalRevenueGenerated || 0) + resRec.finalTotalInr) * 100) / 100;
      coupon.updatedAt = nowIso;

      resRec.status = 'finalized';
      resRec.orderId = cleanOrderId;
      resRec.razorpayPaymentId = params.paymentId || resRec.razorpayPaymentId;
      resRec.updatedAt = nowIso;

      this.writeLocalFile(store);
      return {
        success: true,
        alreadyFinalized: false,
        reconciled: false,
        redemptionId: redemption.id,
        couponCode: coupon.code,
        orderId: cleanOrderId,
        message: 'Coupon redemption finalized.',
        httpStatus: 200,
      };
    });
  }

  // Atomic single-transition restoration: strictly `redeemed` -> `restored` (H3)
  async restoreRedemptionAtomic(params: {
    redemptionId: string;
    actor: string;
    force?: boolean;
  }): Promise<{
    success: boolean;
    restored: boolean;
    alreadyRestored?: boolean;
    redemption?: CouponRedemptionRecord;
    message: string;
    httpStatus: number;
  }> {
    const safeId = sanitizePostgrestId(params.redemptionId);
    if (!safeId) {
      return {
        success: false,
        restored: false,
        message: 'Valid redemption ID is required.',
        httpStatus: 400,
      };
    }

    const useSb = await this.checkSupabaseReady();
    if (useSb) {
      const cfg = this.deps.getSupabaseAdminConfig();
      const auditId = generateId('caud');
      const rpcResp = await fetch(`${cfg.url}/rest/v1/rpc/teqqno_restore_coupon_redemption`, {
        method: 'POST',
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
        body: JSON.stringify({
          p_redemption_id: safeId,
          p_actor: params.actor || 'admin',
          p_force: Boolean(params.force),
          p_audit_id: auditId,
        }),
      });
      if (!rpcResp.ok) {
        const errTxt = await rpcResp.text().catch(() => '');
        this.invalidateSupabaseHealth(
          `RPC teqqno_restore_coupon_redemption HTTP ${rpcResp.status}: ${errTxt.slice(0, 120)}`
        );
        throw new CouponStorageUnavailableError('Failed to execute atomic coupon restoration.');
      }
      const data = (await rpcResp.json()) as any;
      if (!data?.ok) {
        const reason = data?.reason_code;
        const httpStatus =
          reason === 'NOT_FOUND' ? 404 : reason === 'INVALID_STATE_TRANSITION' ? 409 : 400;
        return {
          success: false,
          restored: false,
          alreadyRestored: Boolean(data?.already_restored),
          message: data?.message || 'Unable to restore coupon redemption.',
          httpStatus,
        };
      }
      return {
        success: true,
        restored: true,
        message: `Coupon ${data.coupon_code || ''} usage restored atomically.`,
        httpStatus: 200,
      };
    }

    return withLocalFileLock(this.filePath, async () => {
      const store = this.ensureLocalFile();
      if (!store.settings.restoreOnCancel && !params.force) {
        return {
          success: false,
          restored: false,
          message:
            'Coupon restoration on cancellation is disabled by policy. Enable it in Coupon Settings or confirm manual override.',
          httpStatus: 400,
        };
      }

      const target = store.redemptions.find((r) => r.id === safeId);
      if (!target) {
        return {
          success: false,
          restored: false,
          message: 'Redemption record not found.',
          httpStatus: 404,
        };
      }

      // Strictly allow transition ONLY from `redeemed` -> `restored`
      if (target.status !== 'redeemed') {
        return {
          success: false,
          restored: false,
          alreadyRestored: target.status === 'restored',
          redemption: target,
          message:
            target.status === 'restored'
              ? 'This redemption has already been restored. Usage count will not be decremented again.'
              : `Redemption in status "${target.status}" cannot be restored.`,
          httpStatus: 409,
        };
      }

      const nowIso = new Date().toISOString();
      target.status = 'restored';
      target.restoredAt = nowIso;
      target.restoredBy = params.actor || 'admin';

      const parent = store.coupons.find((c) => c.id === target.couponId);
      if (parent) {
        parent.usageCount = Math.max(0, (parent.usageCount || 0) - 1);
        parent.totalDiscountGiven = Math.max(
          0,
          Math.round(
            ((parent.totalDiscountGiven || 0) - (target.discountInr + target.shippingSavedInr)) * 100
          ) / 100
        );
        parent.totalRevenueGenerated = Math.max(
          0,
          Math.round(((parent.totalRevenueGenerated || 0) - target.finalTotalInr) * 100) / 100
        );
        parent.updatedAt = nowIso;
      }

      store.auditLogs.unshift({
        id: generateId('caud'),
        couponId: target.couponId,
        couponCode: target.couponCode,
        action: 'RESTORE_REDEMPTION',
        actor: params.actor || 'admin',
        summary: `Restored coupon usage for order ${target.orderNumber || target.orderId}`,
        metadata: {
          redemptionId: target.id,
          orderId: target.orderId,
          forceOverride: Boolean(params.force),
        },
        createdAt: nowIso,
      });
      store.auditLogs = store.auditLogs.slice(0, 500);

      this.writeLocalFile(store);
      return {
        success: true,
        restored: true,
        redemption: target,
        message: `Coupon ${target.couponCode} usage restored atomically.`,
        httpStatus: 200,
      };
    });
  }

  // Order cancellation / refund hook wired to `restoreOnCancel` policy (H3 + C5)
  async handleOrderCancelledOrRefunded(params: {
    orderId?: string;
    orderNumber?: string;
    paymentId?: string;
    reservationId?: string;
    razorpayOrderId?: string;
    actor: string;
    reason: string;
  }): Promise<{
    matchedRedemptions: number;
    restoredCount: number;
    policyEnabled: boolean;
  }> {
    const settings = await this.getSettings();
    const matches = await this.findRedemptionsByOrderRef({
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      paymentId: params.paymentId,
      reservationId: params.reservationId,
      razorpayOrderId: params.razorpayOrderId,
    });
    const activeMatches = matches.filter((r) => r.status === 'redeemed');
    let restoredCount = 0;

    for (const r of activeMatches) {
      if (settings.restoreOnCancel) {
        const res = await this.restoreRedemptionAtomic({
          redemptionId: r.id,
          actor: params.actor,
          force: false,
        });
        if (res.restored) restoredCount += 1;
      } else {
        await this.appendAuditLog({
          couponId: r.couponId,
          couponCode: r.couponCode,
          action: 'ORDER_CANCELLED_POLICY_RETAINED',
          actor: params.actor,
          summary: `Order ${r.orderNumber || r.orderId} ${params.reason}; coupon usage retained (restoreOnCancel is OFF).`,
          metadata: { redemptionId: r.id, orderId: r.orderId, reason: params.reason },
        });
      }
    }

    return {
      matchedRedemptions: activeMatches.length,
      restoredCount,
      policyEnabled: settings.restoreOnCancel,
    };
  }

  async generateUniqueCode(prefix?: string): Promise<string> {
    const cleanPrefix = normalizeCouponCode(prefix || 'TQ')
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
    const coupons = await this.listCoupons();
    const taken = new Set<string>();
    for (const c of coupons) {
      taken.add(normalizeCouponCode(c.code));
      for (const a of c.aliases || []) taken.add(normalizeCouponCode(a));
    }

    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 50; attempt++) {
      let suffix = '';
      const bytes = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) {
        suffix += alphabet[bytes[i] % alphabet.length];
      }
      const candidate = `${cleanPrefix || 'TQ'}${suffix}`;
      if (!taken.has(candidate)) return candidate;
    }
    return `${cleanPrefix || 'TQ'}${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  private async assertCodeUnique(
    code: string,
    aliases: string[],
    excludeCouponId?: string
  ): Promise<void> {
    const coupons = await this.listCoupons();
    const candidates = [normalizeCouponCode(code), ...aliases.map(normalizeCouponCode)].filter(Boolean);
    const seenInSelf = new Set<string>();
    for (const cand of candidates) {
      if (seenInSelf.has(cand)) {
        throw new Error(`Duplicate coupon code/alias "${cand}" in request.`);
      }
      seenInSelf.add(cand);
    }

    for (const existing of coupons) {
      if (excludeCouponId && existing.id === excludeCouponId) continue;
      const existingAll = [
        normalizeCouponCode(existing.code),
        ...(existing.aliases || []).map(normalizeCouponCode),
      ];
      for (const cand of candidates) {
        if (existingAll.includes(cand)) {
          throw new Error(`Coupon code "${cand}" is already in use (case-insensitive unique).`);
        }
      }
    }
  }

  private validateAdminPayload(payload: CreateCouponPayload): void {
    if (!payload.name || !String(payload.name).trim()) {
      throw new Error('Coupon name is required.');
    }
    if (!['percentage', 'fixed', 'free_shipping'].includes(payload.offerType)) {
      throw new Error('Invalid offer type.');
    }
    const discountValue = Number(payload.discountValue || 0);
    if (payload.offerType === 'percentage' && (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 100)) {
      throw new Error('Percentage discount must be between 1 and 100.');
    }
    if (payload.offerType === 'fixed' && (!Number.isFinite(discountValue) || discountValue <= 0)) {
      throw new Error('Fixed discount amount must be greater than ₹0.');
    }
    if (payload.minOrderAmount != null && Number(payload.minOrderAmount) < 0) {
      throw new Error('Minimum order amount cannot be negative.');
    }
    if (
      payload.maxOrderAmount != null &&
      payload.minOrderAmount != null &&
      Number(payload.maxOrderAmount) > 0 &&
      Number(payload.maxOrderAmount) < Number(payload.minOrderAmount)
    ) {
      throw new Error('Maximum order amount must be greater than or equal to minimum order amount.');
    }
    if (payload.startAt && payload.expiresAt) {
      const s = Date.parse(payload.startAt);
      const e = Date.parse(payload.expiresAt);
      if (Number.isFinite(s) && Number.isFinite(e) && e <= s) {
        throw new Error('Expiry date/time must be after the start date/time.');
      }
    }
    if (
      (payload.applicability === 'selected_customers' || payload.isPrivate) &&
      (!Array.isArray(payload.assignedCustomers) || payload.assignedCustomers.length === 0)
    ) {
      throw new Error('Select at least one eligible customer for a private/customer-specific coupon.');
    }
    if (
      payload.applicability === 'selected_products' &&
      (!Array.isArray(payload.eligibleProductIds) || payload.eligibleProductIds.length === 0)
    ) {
      throw new Error('Select at least one eligible product.');
    }
    if (
      payload.applicability === 'selected_categories' &&
      (!Array.isArray(payload.eligibleCategories) || payload.eligibleCategories.length === 0)
    ) {
      throw new Error('Select at least one eligible category.');
    }
  }

  async createCoupon(payload: CreateCouponPayload, actor: string): Promise<CouponRecord> {
    this.validateAdminPayload(payload);
    const code = payload.autoGenerateCode
      ? await this.generateUniqueCode(payload.codePrefix || 'TQ')
      : normalizeCouponCode(payload.code || '');

    if (!code || code.length < 3 || code.length > 32 || !/^[A-Z0-9_-]+$/.test(code)) {
      throw new Error('Coupon code must be 3–32 characters (letters, numbers, hyphen, underscore).');
    }

    const aliases = (payload.aliases || []).map(normalizeCouponCode).filter(Boolean);
    await this.assertCodeUnique(code, aliases);

    const nowIso = new Date().toISOString();
    const isPrivate =
      Boolean(payload.isPrivate) || payload.applicability === 'selected_customers';

    // Determine initial status respecting startAt / expiresAt
    let initialStatus: CouponStatus = payload.status || 'active';
    if (initialStatus === 'active' && payload.startAt && Date.parse(payload.startAt) > Date.now()) {
      initialStatus = 'scheduled';
    }

    const record: CouponRecord = {
      id: generateId('cpn'),
      code,
      aliases,
      name: String(payload.name).trim(),
      campaignName: payload.campaignName?.trim() || undefined,
      description: payload.description?.trim() || undefined,
      offerType: payload.offerType,
      discountValue: payload.offerType === 'free_shipping' ? 0 : Number(payload.discountValue || 0),
      minOrderAmount: Math.max(0, Number(payload.minOrderAmount || 0)),
      maxOrderAmount:
        payload.maxOrderAmount != null && Number(payload.maxOrderAmount) > 0
          ? Number(payload.maxOrderAmount)
          : null,
      maxDiscountCap:
        payload.offerType === 'percentage' &&
        payload.maxDiscountCap != null &&
        Number(payload.maxDiscountCap) > 0
          ? Number(payload.maxDiscountCap)
          : null,
      startAt: payload.startAt ? new Date(payload.startAt).toISOString() : null,
      expiresAt: payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null,
      status: initialStatus,
      applicability: payload.applicability || 'entire_website',
      eligibleProductIds: payload.eligibleProductIds || [],
      eligibleCategories: (payload.eligibleCategories || []).map(normalizeCategorySlug),
      eligibleCustomerGroups: payload.eligibleCustomerGroups || [],
      assignedCustomers: (payload.assignedCustomers || []).map((c) => ({
        customerId: c.customerId,
        name: String(c.name || '').trim() || 'Customer',
        email: normalizeEmail(c.email),
        phone: c.phone ? String(c.phone).trim() : undefined,
        company: c.company ? String(c.company).trim() : undefined,
      })),
      isPrivate,
      isFestival: Boolean(payload.isFestival),
      festivalPreset: payload.festivalPreset || null,
      festivalBannerUrl: payload.festivalBannerUrl || null,
      festivalBannerHeadline: payload.festivalBannerHeadline?.trim() || null,
      festivalBannerSubtext: payload.festivalBannerSubtext?.trim() || null,
      showOnStorefront: isPrivate ? false : Boolean(payload.showOnStorefront),
      totalUsageLimit:
        payload.totalUsageLimit != null && Number(payload.totalUsageLimit) > 0
          ? Math.floor(Number(payload.totalUsageLimit))
          : null,
      perCustomerLimit:
        payload.perCustomerLimit != null && Number(payload.perCustomerLimit) > 0
          ? Math.floor(Number(payload.perCustomerLimit))
          : null,
      oneTimePerCustomer: Boolean(payload.oneTimePerCustomer),
      allowCombineWithCoupons: Boolean(payload.allowCombineWithCoupons),
      allowCombineWithPromotions:
        payload.allowCombineWithPromotions === undefined
          ? true
          : Boolean(payload.allowCombineWithPromotions),
      usageCount: 0,
      totalDiscountGiven: 0,
      totalRevenueGenerated: 0,
      internalNote: payload.internalNote?.trim() || undefined,
      isLegacy: false,
      requiresRecoverySession: false,
      createdBy: actor,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const saved = await this.saveCoupon(record, true);
    await this.appendAuditLog({
      couponId: saved.id,
      couponCode: saved.code,
      action: 'CREATE_COUPON',
      actor,
      summary: `Created coupon ${saved.code} (${formatOfferBadge(saved)}, ${saved.applicability})`,
      metadata: {
        offerType: saved.offerType,
        discountValue: saved.discountValue,
        isPrivate: saved.isPrivate,
        isFestival: saved.isFestival,
      },
    });
    return saved;
  }

  async updateCoupon(
    id: string,
    payload: Partial<CreateCouponPayload>,
    actor: string
  ): Promise<CouponRecord> {
    const coupons = await this.listCoupons();
    const existing = coupons.find((c) => c.id === id);
    if (!existing) throw new Error('Coupon not found.');

    const merged: CreateCouponPayload = {
      code: payload.code !== undefined ? normalizeCouponCode(payload.code) : existing.code,
      aliases: payload.aliases !== undefined ? payload.aliases : existing.aliases,
      name: payload.name !== undefined ? payload.name : existing.name,
      campaignName: payload.campaignName !== undefined ? payload.campaignName : existing.campaignName,
      description: payload.description !== undefined ? payload.description : existing.description,
      offerType: payload.offerType !== undefined ? payload.offerType : existing.offerType,
      discountValue:
        payload.discountValue !== undefined ? payload.discountValue : existing.discountValue,
      minOrderAmount:
        payload.minOrderAmount !== undefined ? payload.minOrderAmount : existing.minOrderAmount,
      maxOrderAmount:
        payload.maxOrderAmount !== undefined ? payload.maxOrderAmount : existing.maxOrderAmount,
      maxDiscountCap:
        payload.maxDiscountCap !== undefined ? payload.maxDiscountCap : existing.maxDiscountCap,
      startAt: payload.startAt !== undefined ? payload.startAt : existing.startAt,
      expiresAt: payload.expiresAt !== undefined ? payload.expiresAt : existing.expiresAt,
      status: payload.status !== undefined ? payload.status : existing.status,
      applicability:
        payload.applicability !== undefined ? payload.applicability : existing.applicability,
      eligibleProductIds:
        payload.eligibleProductIds !== undefined
          ? payload.eligibleProductIds
          : existing.eligibleProductIds,
      eligibleCategories:
        payload.eligibleCategories !== undefined
          ? payload.eligibleCategories
          : existing.eligibleCategories,
      eligibleCustomerGroups:
        payload.eligibleCustomerGroups !== undefined
          ? payload.eligibleCustomerGroups
          : existing.eligibleCustomerGroups,
      assignedCustomers:
        payload.assignedCustomers !== undefined
          ? payload.assignedCustomers
          : existing.assignedCustomers,
      isPrivate: payload.isPrivate !== undefined ? payload.isPrivate : existing.isPrivate,
      isFestival: payload.isFestival !== undefined ? payload.isFestival : existing.isFestival,
      festivalPreset:
        payload.festivalPreset !== undefined ? payload.festivalPreset : existing.festivalPreset,
      festivalBannerUrl:
        payload.festivalBannerUrl !== undefined
          ? payload.festivalBannerUrl
          : existing.festivalBannerUrl,
      festivalBannerHeadline:
        payload.festivalBannerHeadline !== undefined
          ? payload.festivalBannerHeadline
          : existing.festivalBannerHeadline,
      festivalBannerSubtext:
        payload.festivalBannerSubtext !== undefined
          ? payload.festivalBannerSubtext
          : existing.festivalBannerSubtext,
      showOnStorefront:
        payload.showOnStorefront !== undefined
          ? payload.showOnStorefront
          : existing.showOnStorefront,
      totalUsageLimit:
        payload.totalUsageLimit !== undefined ? payload.totalUsageLimit : existing.totalUsageLimit,
      perCustomerLimit:
        payload.perCustomerLimit !== undefined
          ? payload.perCustomerLimit
          : existing.perCustomerLimit,
      oneTimePerCustomer:
        payload.oneTimePerCustomer !== undefined
          ? payload.oneTimePerCustomer
          : existing.oneTimePerCustomer,
      allowCombineWithCoupons:
        payload.allowCombineWithCoupons !== undefined
          ? payload.allowCombineWithCoupons
          : existing.allowCombineWithCoupons,
      allowCombineWithPromotions:
        payload.allowCombineWithPromotions !== undefined
          ? payload.allowCombineWithPromotions
          : existing.allowCombineWithPromotions,
      internalNote: payload.internalNote !== undefined ? payload.internalNote : existing.internalNote,
    };

    this.validateAdminPayload(merged);
    const code = normalizeCouponCode(merged.code || existing.code);
    const aliases = (merged.aliases || []).map(normalizeCouponCode).filter(Boolean);
    await this.assertCodeUnique(code, aliases, existing.id);

    const isPrivate = Boolean(merged.isPrivate) || merged.applicability === 'selected_customers';
    const updated: CouponRecord = {
      ...existing,
      code,
      aliases,
      name: String(merged.name).trim(),
      campaignName: merged.campaignName?.trim() || undefined,
      description: merged.description?.trim() || undefined,
      offerType: merged.offerType,
      discountValue: merged.offerType === 'free_shipping' ? 0 : Number(merged.discountValue || 0),
      minOrderAmount: Math.max(0, Number(merged.minOrderAmount || 0)),
      maxOrderAmount:
        merged.maxOrderAmount != null && Number(merged.maxOrderAmount) > 0
          ? Number(merged.maxOrderAmount)
          : null,
      maxDiscountCap:
        merged.offerType === 'percentage' &&
        merged.maxDiscountCap != null &&
        Number(merged.maxDiscountCap) > 0
          ? Number(merged.maxDiscountCap)
          : null,
      startAt: merged.startAt ? new Date(merged.startAt).toISOString() : null,
      expiresAt: merged.expiresAt ? new Date(merged.expiresAt).toISOString() : null,
      status: merged.status || existing.status,
      applicability: merged.applicability,
      eligibleProductIds: merged.eligibleProductIds || [],
      eligibleCategories: (merged.eligibleCategories || []).map(normalizeCategorySlug),
      eligibleCustomerGroups: merged.eligibleCustomerGroups || [],
      assignedCustomers: (merged.assignedCustomers || []).map((c) => ({
        customerId: c.customerId,
        name: String(c.name || '').trim() || 'Customer',
        email: normalizeEmail(c.email),
        phone: c.phone ? String(c.phone).trim() : undefined,
        company: c.company ? String(c.company).trim() : undefined,
      })),
      isPrivate,
      isFestival: Boolean(merged.isFestival),
      festivalPreset: merged.festivalPreset || null,
      festivalBannerUrl: merged.festivalBannerUrl || null,
      festivalBannerHeadline: merged.festivalBannerHeadline?.trim() || null,
      festivalBannerSubtext: merged.festivalBannerSubtext?.trim() || null,
      showOnStorefront: isPrivate ? false : Boolean(merged.showOnStorefront),
      totalUsageLimit:
        merged.totalUsageLimit != null && Number(merged.totalUsageLimit) > 0
          ? Math.floor(Number(merged.totalUsageLimit))
          : null,
      perCustomerLimit:
        merged.perCustomerLimit != null && Number(merged.perCustomerLimit) > 0
          ? Math.floor(Number(merged.perCustomerLimit))
          : null,
      oneTimePerCustomer: Boolean(merged.oneTimePerCustomer),
      allowCombineWithCoupons: Boolean(merged.allowCombineWithCoupons),
      allowCombineWithPromotions: Boolean(merged.allowCombineWithPromotions),
      internalNote: merged.internalNote?.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.saveCoupon(updated, false);
    await this.appendAuditLog({
      couponId: saved.id,
      couponCode: saved.code,
      action: 'UPDATE_COUPON',
      actor,
      summary: `Updated coupon ${saved.code}`,
    });
    return saved;
  }

  async changeCouponStatus(id: string, nextStatus: CouponStatus, actor: string): Promise<CouponRecord> {
    const coupons = await this.listCoupons();
    const existing = coupons.find((c) => c.id === id);
    if (!existing) throw new Error('Coupon not found.');

    const updated: CouponRecord = {
      ...existing,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    const saved = await this.saveCoupon(updated, false);
    await this.appendAuditLog({
      couponId: saved.id,
      couponCode: saved.code,
      action: `STATUS_${nextStatus.toUpperCase()}`,
      actor,
      summary: `Changed status of ${saved.code} from ${existing.status} to ${nextStatus}`,
    });
    return saved;
  }

  async notifyCustomersForCoupon(params: {
    coupon: CouponRecord;
    channel: 'dashboard' | 'email' | 'both';
    customMessage?: string;
    actor: string;
  }): Promise<{
    notifications: CouponCustomerNotification[];
    emailsAttempted: number;
    emailsSent: number;
    emailNotice: string;
  }> {
    const targets = params.coupon.assignedCustomers || [];
    if (targets.length === 0) {
      throw new Error('No customers are assigned to this coupon to notify.');
    }

    const notifications: CouponCustomerNotification[] = [];
    let emailsAttempted = 0;
    let emailsSent = 0;
    let lastReason = '';

    const badge = formatOfferBadge(params.coupon);
    const expiryLabel = params.coupon.expiresAt
      ? new Date(params.coupon.expiresAt).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'Limited time';

    for (const customer of targets) {
      const title = `Exclusive Offer Unlocked: ${badge}`;
      const bodyMessage =
        params.customMessage?.trim() ||
        `Hi ${customer.name}, use your private TeqqnoWorld coupon code ${params.coupon.code} to enjoy ${badge}${params.coupon.minOrderAmount > 0 ? ` on orders above ₹${params.coupon.minOrderAmount.toLocaleString('en-IN')}` : ''}. Valid until ${expiryLabel}.`;

      let emailSent = false;
      let emailStatusNote = 'Dashboard notification only.';

      if ((params.channel === 'email' || params.channel === 'both') && customer.email) {
        emailsAttempted += 1;
        const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#F4F6F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px;background:#F4F6F9;">
    <tr><td align="center">
      <table role="presentation" width="540" cellspacing="0" cellpadding="0" style="max-width:540px;width:100%;background:#FFFFFF;border-radius:14px;overflow:hidden;border:1px solid #E2E8F0;">
        <tr><td style="background:#071B35;padding:20px 24px;border-bottom:3px solid #FF7A00;">
          <div style="font-size:20px;font-weight:800;color:#FFFFFF;">Teqqno<span style="color:#FF7A00;">World</span></div>
          <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#CBD5E1;margin-top:4px;">Exclusive Customer Offer</div>
        </td></tr>
        <tr><td style="padding:24px;">
          <h1 style="margin:0 0 10px 0;font-size:18px;color:#071B35;">${this.deps.escapeHtml(title)}</h1>
          <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#334155;">${this.deps.escapeHtml(bodyMessage)}</p>
          <div style="background:#FFF7ED;border:1px dashed #FF7A00;border-radius:10px;padding:16px;text-align:center;margin-bottom:18px;">
            <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9A3412;margin-bottom:4px;">Your Private Coupon Code</div>
            <div style="font-size:24px;font-weight:800;letter-spacing:2px;color:#071B35;">${this.deps.escapeHtml(params.coupon.code)}</div>
            <div style="font-size:12px;color:#64748B;margin-top:6px;">${this.deps.escapeHtml(badge)} · Valid till ${this.deps.escapeHtml(expiryLabel)}</div>
          </div>
          <p style="margin:0;font-size:12px;color:#64748B;">This code is tied exclusively to your TeqqnoWorld account (${this.deps.escapeHtml(customer.email)}) and cannot be transferred.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        try {
          const mailRes = await this.deps.sendCouponEmail({
            to: customer.email,
            subject: `${title} — Code: ${params.coupon.code}`,
            text: `${title}\n\n${bodyMessage}\n\nCode: ${params.coupon.code}\nValid until: ${expiryLabel}`,
            html,
          });
          emailSent = Boolean(mailRes.sent);
          emailStatusNote = emailSent
            ? 'Email accepted by SMTP server.'
            : mailRes.reason || 'SMTP is not configured on this server; email was not sent.';
          if (emailSent) emailsSent += 1;
          else lastReason = emailStatusNote;
        } catch (err: any) {
          emailSent = false;
          emailStatusNote = err?.message || 'SMTP delivery failed.';
          lastReason = emailStatusNote;
        }
      }

      const savedNotif = await this.appendNotification({
        couponId: params.coupon.id,
        couponCode: params.coupon.code,
        customerId: customer.customerId,
        customerEmail: customer.email,
        customerName: customer.name,
        title,
        message: bodyMessage,
        channel: params.channel,
        emailSent,
        emailStatusNote,
        readAt: null,
      });
      notifications.push(savedNotif);
    }

    await this.appendAuditLog({
      couponId: params.coupon.id,
      couponCode: params.coupon.code,
      action: 'NOTIFY_CUSTOMERS',
      actor: params.actor,
      summary: `Notified ${targets.length} customer(s) via ${params.channel} (emails sent: ${emailsSent}/${emailsAttempted})`,
    });

    const emailNotice =
      emailsAttempted === 0
        ? 'Dashboard notification saved for customer account.'
        : emailsSent === emailsAttempted
        ? `Email sent to ${emailsSent} customer(s) via SMTP and dashboard banner updated.`
        : `Dashboard notification saved. Email sent to ${emailsSent}/${emailsAttempted}: ${lastReason || 'SMTP not configured on server.'}`;

    return { notifications, emailsAttempted, emailsSent, emailNotice };
  }

  async getAdminOverview(filters: {
    startDate?: string;
    endDate?: string;
    code?: string;
    campaign?: string;
    status?: string;
    customer?: string;
  }): Promise<CouponAnalyticsOverview> {
    const [allCoupons, allRedemptions, auditLogs, settings, storageMode] = await Promise.all([
      this.listCoupons(),
      this.listRedemptions(),
      this.listAuditLogs(),
      this.getSettings(),
      this.getStorageMode(),
    ]);

    const nowMs = Date.now();
    const coupons = allCoupons.map((c) => ({
      ...c,
      effectiveStatus: resolveEffectiveCouponStatus(c, nowMs),
    }));

    const startMs = filters.startDate ? Date.parse(filters.startDate) : NaN;
    const endMs = filters.endDate ? Date.parse(`${filters.endDate}T23:59:59.999Z`) : NaN;
    const codeFilter = normalizeCouponCode(filters.code || '');
    const campaignFilter = String(filters.campaign || '').trim().toLowerCase();
    const statusFilter = String(filters.status || '').trim().toLowerCase();
    const customerFilter = String(filters.customer || '').trim().toLowerCase();

    const couponById = new Map(coupons.map((c) => [c.id, c]));

    const matchingHistoryRedemptions = allRedemptions.filter((r) => {
      const t = Date.parse(r.redeemedAt);
      if (Number.isFinite(startMs) && t < startMs) return false;
      if (Number.isFinite(endMs) && t > endMs) return false;
      if (codeFilter && !normalizeCouponCode(r.couponCode).includes(codeFilter)) return false;
      if (campaignFilter) {
        const parent = couponById.get(r.couponId);
        if (!(parent?.campaignName || '').toLowerCase().includes(campaignFilter)) return false;
      }
      if (statusFilter && statusFilter !== 'all') {
        const parent = couponById.get(r.couponId);
        if ((parent?.effectiveStatus || parent?.status) !== statusFilter) return false;
      }
      if (customerFilter) {
        const hay = `${r.customerName || ''} ${r.customerEmail || ''} ${r.customerPhone || ''} ${r.orderNumber || ''} ${r.orderId || ''}`.toLowerCase();
        if (!hay.includes(customerFilter)) return false;
      }
      return true;
    });

    const filteredRedemptions = matchingHistoryRedemptions.filter((r) => r.status === 'redeemed');

    let activeCoupons = 0;
    let scheduledCoupons = 0;
    let pausedCoupons = 0;
    let expiredCoupons = 0;
    let archivedCoupons = 0;
    let privateCoupons = 0;
    let festivalCoupons = 0;

    for (const c of coupons) {
      const st = c.effectiveStatus || c.status;
      if (st === 'active') activeCoupons += 1;
      else if (st === 'scheduled') scheduledCoupons += 1;
      else if (st === 'paused') pausedCoupons += 1;
      else if (st === 'expired') expiredCoupons += 1;
      else if (st === 'archived') archivedCoupons += 1;
      if (c.isPrivate || c.applicability === 'selected_customers') privateCoupons += 1;
      if (c.isFestival) festivalCoupons += 1;
    }

    const totalDiscountGivenInr = Math.round(
      filteredRedemptions.reduce((s, r) => s + Number(r.discountInr || 0), 0)
    );
    const totalShippingSavedInr = Math.round(
      filteredRedemptions.reduce((s, r) => s + Number(r.shippingSavedInr || 0), 0)
    );
    const totalRevenueGeneratedInr = Math.round(
      filteredRedemptions.reduce((s, r) => s + Number(r.finalTotalInr || 0), 0)
    );
    const distinctOrders = new Set(filteredRedemptions.map((r) => r.orderId));

    // Campaign performance breakdown
    const campMap = new Map<
      string,
      {
        campaignName: string;
        couponsCount: number;
        redemptionsCount: number;
        discountGivenInr: number;
        revenueGeneratedInr: number;
      }
    >();
    for (const c of coupons) {
      const key = c.campaignName?.trim() || 'General Offers';
      const entry = campMap.get(key) || {
        campaignName: key,
        couponsCount: 0,
        redemptionsCount: 0,
        discountGivenInr: 0,
        revenueGeneratedInr: 0,
      };
      entry.couponsCount += 1;
      campMap.set(key, entry);
    }
    for (const r of filteredRedemptions) {
      const parent = couponById.get(r.couponId);
      const key = parent?.campaignName?.trim() || 'General Offers';
      const entry = campMap.get(key) || {
        campaignName: key,
        couponsCount: 0,
        redemptionsCount: 0,
        discountGivenInr: 0,
        revenueGeneratedInr: 0,
      };
      entry.redemptionsCount += 1;
      entry.discountGivenInr += Number(r.discountInr || 0) + Number(r.shippingSavedInr || 0);
      entry.revenueGeneratedInr += Number(r.finalTotalInr || 0);
      campMap.set(key, entry);
    }

    // 14-day daily trend series
    const dailySeries: CouponAnalyticsOverview['dailySeries'] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const isoDay = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      let redemptionsCount = 0;
      let discountInr = 0;
      let revenueInr = 0;
      for (const r of filteredRedemptions) {
        if (r.redeemedAt.slice(0, 10) === isoDay) {
          redemptionsCount += 1;
          discountInr += Number(r.discountInr || 0) + Number(r.shippingSavedInr || 0);
          revenueInr += Number(r.finalTotalInr || 0);
        }
      }
      dailySeries.push({
        date: isoDay,
        label,
        redemptions: redemptionsCount,
        discountInr: Math.round(discountInr),
        revenueInr: Math.round(revenueInr),
      });
    }

    return {
      kpis: {
        totalCoupons: coupons.length,
        activeCoupons,
        scheduledCoupons,
        pausedCoupons,
        expiredCoupons,
        archivedCoupons,
        privateCoupons,
        festivalCoupons,
        totalRedemptions: filteredRedemptions.length,
        totalDiscountGivenInr,
        totalShippingSavedInr,
        ordersGeneratedCount: distinctOrders.size,
        totalRevenueGeneratedInr,
      },
      coupons,
      redemptions: matchingHistoryRedemptions,
      auditLogs: auditLogs.slice(0, 200),
      campaignPerformance: Array.from(campMap.values()).sort(
        (a, b) => b.redemptionsCount - a.redemptionsCount || b.discountGivenInr - a.discountGivenInr
      ),
      dailySeries,
      settings,
      storageMode,
      serverTime: new Date().toISOString(),
    };
  }
}

// ==============================================================================
// EXPRESS ROUTER FACTORY + SHARED ENGINE INSTANCE ACCESS
// ==============================================================================

let sharedCouponEngine: CouponEngine | null = null;

export function getSharedCouponEngine(): CouponEngine | null {
  return sharedCouponEngine;
}

export function createCouponRouter(deps: CouponRouterDeps): {
  router: Router;
  engine: CouponEngine;
} {
  const router = express.Router();
  const engine = new CouponEngine(deps);
  sharedCouponEngine = engine;

  const requireAdmin = (req: Request, res: Response): string | null => {
    const auth = deps.verifyAdminRequest(req);
    if (!auth.valid) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized: Valid Admin session token is required.',
      });
      return null;
    }
    return auth.email || 'admin';
  };

  const handleRouteError = (res: Response, err: any, fallbackMsg: string, defaultStatus = 500) => {
    if (err instanceof CouponStorageUnavailableError) {
      return res.status(503).json({
        success: false,
        code: 'STORAGE_UNAVAILABLE',
        message: err.message,
      });
    }
    return res.status(defaultStatus).json({
      success: false,
      message: err?.message || fallbackMsg,
    });
  };

  // ============================================================================
  // PUBLIC & CUSTOMER STOREFRONT ROUTES (Zero private data leakage)
  // ============================================================================

  // GET /api/coupons/public — Active public storefront coupons & active public festival banners ONLY
  router.get('/coupons/public', async (_req: Request, res: Response) => {
    try {
      const coupons = await engine.listCoupons();
      const nowMs = Date.now();
      const publicActive = coupons.filter((c) => {
        if (c.isPrivate || c.applicability === 'selected_customers') return false;
        if (c.requiresRecoverySession) return false;
        const st = resolveEffectiveCouponStatus(c, nowMs);
        if (st !== 'active') return false;
        if (c.totalUsageLimit != null && c.usageCount >= c.totalUsageLimit) return false;
        return true;
      });

      const festivalOffers = publicActive
        .filter((c) => c.isFestival && c.showOnStorefront)
        .map(toPublicSummary);

      const publicCoupons = publicActive
        .filter((c) => c.showOnStorefront || c.isLegacy)
        .map(toPublicSummary);

      return res.json({
        success: true,
        serverTime: new Date(nowMs).toISOString(),
        festivalOffers,
        coupons: publicCoupons,
      });
    } catch (err: any) {
      return handleRouteError(res, err, 'Unable to load storefront offers.');
    }
  });

  // GET /api/coupons/my-offers — STRICTLY authenticated via Supabase Auth Bearer JWT (C1)
  // Ignores any query parameters (email/phone/customerId) to prevent cross-customer leakage.
  router.get('/coupons/my-offers', async (req: Request, res: Response) => {
    try {
      const verifiedCustomer = await deps.verifyCustomerJwt(req);
      if (!verifiedCustomer) {
        return res.status(401).json({
          success: false,
          code: 'AUTH_REQUIRED',
          message: 'Valid authenticated customer session is required to access private offers.',
          privateOffers: [],
          notifications: [],
        });
      }

      const email = verifiedCustomer.email;
      const phone = verifiedCustomer.phone || '';
      const customerId = verifiedCustomer.customerId;

      const [coupons, notifications] = await Promise.all([
        engine.listCoupons(),
        engine.listNotifications({ customerEmail: email, customerId }),
      ]);
      const nowMs = Date.now();

      const privateOffers: PublicCouponSummary[] = [];
      for (const c of coupons) {
        if (!c.isPrivate && c.applicability !== 'selected_customers') continue;
        const st = resolveEffectiveCouponStatus(c, nowMs);
        if (st !== 'active') continue;
        if (c.totalUsageLimit != null && c.usageCount >= c.totalUsageLimit) continue;

        const isAssigned = (c.assignedCustomers || []).some((a) => {
          if (email && normalizeEmail(a.email) === email) return true;
          if (phone && normalizePhone(a.phone) === phone) return true;
          if (customerId && a.customerId && a.customerId === customerId) return true;
          return false;
        });
        if (!isAssigned) continue;

        const limit = c.oneTimePerCustomer ? 1 : c.perCustomerLimit ?? null;
        if (limit != null) {
          const used = await engine.countCustomerCouponUsage(
            c.id,
            { customerId, customerEmail: email, customerPhone: phone },
            nowMs
          );
          if (used >= limit) continue;
        }

        privateOffers.push(toPublicSummary(c));
      }

      return res.json({
        success: true,
        privateOffers,
        notifications: notifications.slice(0, 20),
      });
    } catch (err: any) {
      return handleRouteError(res, err, 'Unable to load customer offers.');
    }
  });

  // POST /api/coupons/validate — Server-authoritative validation using verified JWT + server catalog pricing
  router.post('/coupons/validate', async (req: Request, res: Response) => {
    try {
      const body = (req.body || {}) as CouponValidationRequest;
      const verifiedCustomer = await deps.verifyCustomerJwt(req);

      const result = await engine.evaluateCoupon(
        {
          code: body.code,
          items: body.items,
          paymentPlan: body.paymentPlan,
          recoveryToken: body.recoveryToken,
          checkoutSessionId: body.checkoutSessionId,
          hasOtherPromotionsApplied: body.hasOtherPromotionsApplied,
          otherCouponCodesApplied: body.otherCouponCodesApplied,
        },
        { verifiedCustomer }
      );

      const { authoritativeItems: _omit, ...publicResult } = result;
      const httpStatus =
        result.valid
          ? 200
          : result.reasonCode === 'AUTH_REQUIRED'
          ? 401
          : result.reasonCode === 'CUSTOMER_NOT_ELIGIBLE'
          ? 403
          : 200;

      return res.status(httpStatus).json({
        success: result.valid,
        ...publicResult,
      });
    } catch (err: any) {
      if (err instanceof CouponStorageUnavailableError) {
        return res.status(503).json({
          success: false,
          valid: false,
          code: 'STORAGE_UNAVAILABLE',
          reasonCode: 'STORAGE_UNAVAILABLE',
          discountAmount: 0,
          shippingFee: STANDARD_SHIPPING_FEE_INR,
          shippingSaved: 0,
          freeShippingApplied: false,
          message: err.message,
        });
      }
      return res.status(500).json({
        success: false,
        valid: false,
        discountAmount: 0,
        shippingFee: STANDARD_SHIPPING_FEE_INR,
        shippingSaved: 0,
        freeShippingApplied: false,
        message: err?.message || 'Unable to validate coupon right now.',
      });
    }
  });

  // POST /api/coupons/redeem — REMOVED from public browser access (C4)
  // Coupon redemption is finalized strictly inside server-side verified payment/order placement.
  router.post('/coupons/redeem', (_req: Request, res: Response) => {
    return res.status(403).json({
      success: false,
      code: 'DIRECT_REDEMPTION_DISABLED',
      message:
        'Direct client coupon redemption is disabled. Coupons are reserved and finalized automatically on the server upon verified payment and order confirmation.',
    });
  });

  // ============================================================================
  // ADMIN-ONLY COUPON MANAGEMENT ROUTES (Strictly Bearer-token authenticated)
  // ============================================================================

  // GET /api/admin/coupons/overview
  router.get('/admin/coupons/overview', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const overview = await engine.getAdminOverview({
        startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
        endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
        code: typeof req.query.code === 'string' ? req.query.code : undefined,
        campaign: typeof req.query.campaign === 'string' ? req.query.campaign : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        customer: typeof req.query.customer === 'string' ? req.query.customer : undefined,
      });
      return res.json({ success: true, ...overview });
    } catch (err: any) {
      return handleRouteError(res, err, 'Failed to load coupon analytics overview.');
    }
  });

  // GET /api/admin/coupons/customers?q=
  router.get('/admin/coupons/customers', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const customers = await engine.searchCustomerDirectory(q);
      return res.json({ success: true, customers });
    } catch (err: any) {
      return handleRouteError(res, err, 'Failed to search customers.');
    }
  });

  // POST /api/admin/coupons/generate-code
  router.post('/admin/coupons/generate-code', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const prefix = typeof req.body?.prefix === 'string' ? req.body.prefix : 'TQ';
      const code = await engine.generateUniqueCode(prefix);
      return res.json({ success: true, code });
    } catch (err: any) {
      return handleRouteError(res, err, 'Failed to generate code.');
    }
  });

  // POST /api/admin/coupons — Create single coupon
  router.post('/admin/coupons', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const coupon = await engine.createCoupon(req.body as CreateCouponPayload, actor);
      return res.status(201).json({ success: true, coupon });
    } catch (err: any) {
      return handleRouteError(res, err, 'Failed to create coupon.', 400);
    }
  });

  // POST /api/admin/coupons/bulk-generate — Bulk unique customer-specific coupons
  router.post('/admin/coupons/bulk-generate', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const payload = req.body as BulkGenerateCouponsPayload;
      if (!Array.isArray(payload.customers) || payload.customers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Select at least one customer for bulk unique coupon generation.',
        });
      }
      if (payload.customers.length > 100) {
        return res.status(400).json({
          success: false,
          message: 'Bulk generation is limited to 100 customers per batch.',
        });
      }

      const created: CouponRecord[] = [];
      let totalEmailsSent = 0;
      let totalEmailsAttempted = 0;

      for (const customer of payload.customers) {
        const coupon = await engine.createCoupon(
          {
            autoGenerateCode: true,
            codePrefix: payload.prefix || 'VIP',
            name: (payload.nameTemplate || 'Exclusive Offer for {name}').replace(
              '{name}',
              customer.name || customer.email
            ),
            campaignName: payload.campaignName || 'VIP Customer Campaign',
            description: payload.description,
            offerType: payload.offerType,
            discountValue: payload.discountValue,
            minOrderAmount: payload.minOrderAmount,
            maxOrderAmount: payload.maxOrderAmount,
            maxDiscountCap: payload.maxDiscountCap,
            startAt: payload.startAt,
            expiresAt: payload.expiresAt,
            applicability: 'selected_customers',
            assignedCustomers: [customer],
            isPrivate: true,
            showOnStorefront: false,
            oneTimePerCustomer:
              payload.oneTimePerCustomer === undefined ? true : Boolean(payload.oneTimePerCustomer),
            perCustomerLimit: payload.perCustomerLimit ?? 1,
            totalUsageLimit: payload.totalUsageLimit ?? 1,
            internalNote: payload.internalNote,
          },
          actor
        );
        created.push(coupon);

        if (payload.notifyChannel && payload.notifyChannel !== 'none') {
          const notifyRes = await engine.notifyCustomersForCoupon({
            coupon,
            channel: payload.notifyChannel,
            actor,
          });
          totalEmailsSent += notifyRes.emailsSent;
          totalEmailsAttempted += notifyRes.emailsAttempted;
        }
      }

      return res.status(201).json({
        success: true,
        coupons: created,
        count: created.length,
        emailsSent: totalEmailsSent,
        emailsAttempted: totalEmailsAttempted,
      });
    } catch (err: any) {
      return handleRouteError(res, err, 'Bulk coupon generation failed.', 400);
    }
  });

  // PUT /api/admin/coupons/settings — Configure cancellation/refund policy
  router.put('/admin/coupons/settings', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const restoreOnCancel = Boolean(req.body?.restoreOnCancel);
      const settings = await engine.saveSettings({
        restoreOnCancel,
        updatedBy: actor,
      });
      await engine.appendAuditLog({
        action: 'UPDATE_POLICY_SETTINGS',
        actor,
        summary: `Set restore-on-cancel policy to ${restoreOnCancel ? 'ENABLED' : 'DISABLED'}`,
        metadata: { restoreOnCancel },
      });
      return res.json({ success: true, settings });
    } catch (err: any) {
      return handleRouteError(res, err, 'Failed to update settings.', 400);
    }
  });

  // GET /api/admin/coupons/export/csv — CSV report export
  router.get('/admin/coupons/export/csv', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const overview = await engine.getAdminOverview({
        startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
        endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
        code: typeof req.query.code === 'string' ? req.query.code : undefined,
        campaign: typeof req.query.campaign === 'string' ? req.query.campaign : undefined,
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        customer: typeof req.query.customer === 'string' ? req.query.customer : undefined,
      });

      const csvEscape = (v: unknown) => {
        let s = String(v ?? '');
        // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR)
        if (/^[\t\r\n]*[=+\-@]/.test(s) || /^[\t\r]/.test(s)) {
          s = `'${s}`;
        }
        if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };

      const reportType = req.query.type === 'coupons' ? 'coupons' : 'redemptions';
      let lines: string[] = [];

      if (reportType === 'coupons') {
        lines.push(
          [
            'Code',
            'Name',
            'Campaign',
            'Offer Type',
            'Discount Value',
            'Min Order (INR)',
            'Max Cap (INR)',
            'Status',
            'Applicability',
            'Private',
            'Festival',
            'Redemptions',
            'Usage Limit',
            'Discount Given (INR)',
            'Revenue Generated (INR)',
            'Start Date',
            'Expiry Date',
          ].join(',')
        );
        for (const c of overview.coupons) {
          lines.push(
            [
              c.code,
              c.name,
              c.campaignName || '',
              c.offerType,
              c.discountValue,
              c.minOrderAmount,
              c.maxDiscountCap ?? '',
              c.effectiveStatus || c.status,
              c.applicability,
              c.isPrivate ? 'Yes' : 'No',
              c.isFestival ? c.festivalPreset || 'Yes' : 'No',
              c.usageCount,
              c.totalUsageLimit ?? 'Unlimited',
              c.totalDiscountGiven,
              c.totalRevenueGenerated,
              c.startAt || '',
              c.expiresAt || '',
            ]
              .map(csvEscape)
              .join(',')
          );
        }
      } else {
        lines.push(
          [
            'Redemption ID',
            'Coupon Code',
            'Order ID',
            'Order Number',
            'Customer Name',
            'Customer Email',
            'Customer Phone',
            'Subtotal (INR)',
            'Discount (INR)',
            'Shipping Saved (INR)',
            'Final Total (INR)',
            'Payment Status',
            'Redemption Status',
            'Redeemed At',
          ].join(',')
        );
        for (const r of overview.redemptions) {
          lines.push(
            [
              r.id,
              r.couponCode,
              r.orderId,
              r.orderNumber || '',
              r.customerName || '',
              r.customerEmail || '',
              r.customerPhone || '',
              r.subtotalInr,
              r.discountInr,
              r.shippingSavedInr,
              r.finalTotalInr,
              r.paymentStatus,
              r.status,
              r.redeemedAt,
            ]
              .map(csvEscape)
              .join(',')
          );
        }
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="teqqnoworld-coupons-${reportType}-${new Date().toISOString().slice(0, 10)}.csv"`
      );
      return res.send(lines.join('\n'));
    } catch (err: any) {
      return handleRouteError(res, err, 'CSV export failed.');
    }
  });

  // PUT /api/admin/coupons/:id — Edit coupon
  router.put('/admin/coupons/:id', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const updated = await engine.updateCoupon(
        req.params.id,
        req.body as Partial<CreateCouponPayload>,
        actor
      );
      return res.json({ success: true, coupon: updated });
    } catch (err: any) {
      return handleRouteError(res, err, 'Failed to update coupon.', 400);
    }
  });

  // POST /api/admin/coupons/:id/duplicate — Duplicate coupon with new unique code
  router.post('/admin/coupons/:id/duplicate', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const coupons = await engine.listCoupons();
      const source = coupons.find((c) => c.id === req.params.id);
      if (!source) {
        return res.status(404).json({ success: false, message: 'Coupon not found.' });
      }
      const newCode = await engine.generateUniqueCode(source.code.slice(0, 6));
      const duplicated = await engine.createCoupon(
        {
          code: newCode,
          name: `${source.name} (Copy)`,
          campaignName: source.campaignName,
          description: source.description,
          offerType: source.offerType,
          discountValue: source.discountValue,
          minOrderAmount: source.minOrderAmount,
          maxOrderAmount: source.maxOrderAmount,
          maxDiscountCap: source.maxDiscountCap,
          startAt: source.startAt,
          expiresAt: source.expiresAt,
          status: 'draft',
          applicability: source.applicability,
          eligibleProductIds: source.eligibleProductIds,
          eligibleCategories: source.eligibleCategories,
          eligibleCustomerGroups: source.eligibleCustomerGroups,
          assignedCustomers: source.assignedCustomers,
          isPrivate: source.isPrivate,
          isFestival: source.isFestival,
          festivalPreset: source.festivalPreset,
          festivalBannerUrl: source.festivalBannerUrl,
          festivalBannerHeadline: source.festivalBannerHeadline,
          festivalBannerSubtext: source.festivalBannerSubtext,
          showOnStorefront: source.showOnStorefront,
          totalUsageLimit: source.totalUsageLimit,
          perCustomerLimit: source.perCustomerLimit,
          oneTimePerCustomer: source.oneTimePerCustomer,
          allowCombineWithCoupons: source.allowCombineWithCoupons,
          allowCombineWithPromotions: source.allowCombineWithPromotions,
          internalNote: source.internalNote,
        },
        actor
      );
      return res.status(201).json({ success: true, coupon: duplicated });
    } catch (err: any) {
      return handleRouteError(res, err, 'Failed to duplicate coupon.', 400);
    }
  });

  // POST /api/admin/coupons/:id/status — Pause, resume, activate, expire, archive
  router.post('/admin/coupons/:id/status', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const nextStatus = String(req.body?.status || '') as CouponStatus;
      if (!['draft', 'scheduled', 'active', 'paused', 'expired', 'archived'].includes(nextStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid target coupon status.' });
      }
      const updated = await engine.changeCouponStatus(req.params.id, nextStatus, actor);
      return res.json({ success: true, coupon: updated });
    } catch (err: any) {
      return handleRouteError(res, err, 'Status update failed.', 400);
    }
  });

  // DELETE /api/admin/coupons/:id — Strictly ONLY unused draft coupons
  router.delete('/admin/coupons/:id', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const [coupons, redemptions] = await Promise.all([
        engine.listCoupons(),
        engine.listRedemptions(),
      ]);
      const target = coupons.find((c) => c.id === req.params.id);
      if (!target) {
        return res.status(404).json({ success: false, message: 'Coupon not found.' });
      }
      if (target.isLegacy) {
        return res.status(400).json({
          success: false,
          message: 'Built-in legacy coupons cannot be deleted. Pause or archive them instead.',
        });
      }
      const hasRedemptions =
        target.usageCount > 0 || redemptions.some((r) => r.couponId === target.id);
      if (hasRedemptions || target.status !== 'draft') {
        return res.status(400).json({
          success: false,
          message:
            'Only unused draft coupons can be permanently deleted. Please pause or archive active/used coupons to preserve audit history.',
        });
      }

      await engine.deleteCoupon(target.id);
      await engine.appendAuditLog({
        couponId: target.id,
        couponCode: target.code,
        action: 'DELETE_DRAFT_COUPON',
        actor,
        summary: `Deleted unused draft coupon ${target.code}`,
      });
      return res.json({ success: true, deletedId: target.id });
    } catch (err: any) {
      return handleRouteError(res, err, 'Delete failed.', 400);
    }
  });

  // POST /api/admin/coupons/:id/notify — Notify assigned customers (Dashboard + Honest SMTP)
  router.post('/admin/coupons/:id/notify', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const coupons = await engine.listCoupons();
      const coupon = coupons.find((c) => c.id === req.params.id);
      if (!coupon) {
        return res.status(404).json({ success: false, message: 'Coupon not found.' });
      }
      const channel = (req.body?.channel || 'both') as 'dashboard' | 'email' | 'both';
      if (!['dashboard', 'email', 'both'].includes(channel)) {
        return res.status(400).json({ success: false, message: 'Invalid notification channel.' });
      }
      const result = await engine.notifyCustomersForCoupon({
        coupon,
        channel,
        customMessage: typeof req.body?.customMessage === 'string' ? req.body.customMessage : undefined,
        actor,
      });
      return res.json({ success: true, ...result });
    } catch (err: any) {
      return handleRouteError(res, err, 'Notification failed.', 400);
    }
  });

  // POST /api/admin/coupons/redemptions/:id/restore — Atomic, single-decrement Admin Restore (H3)
  router.post('/admin/coupons/redemptions/:id/restore', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const outcome = await engine.restoreRedemptionAtomic({
        redemptionId: req.params.id,
        actor,
        force: Boolean(req.body?.force),
      });
      return res.status(outcome.httpStatus).json({
        success: outcome.success,
        restored: outcome.restored,
        alreadyRestored: Boolean(outcome.alreadyRestored),
        redemption: outcome.redemption || null,
        message: outcome.message,
      });
    } catch (err: any) {
      return handleRouteError(res, err, 'Restore failed.', 400);
    }
  });

  return { router, engine };
}
