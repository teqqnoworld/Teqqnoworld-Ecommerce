export type CouponOfferType = 'percentage' | 'fixed' | 'free_shipping';

export type CouponStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'expired'
  | 'archived';

export type CouponApplicability =
  | 'entire_website'
  | 'selected_products'
  | 'selected_categories'
  | 'selected_customers'
  | 'new_customers_only'
  | 'existing_customers_only'
  | 'selected_customer_groups';

export type CustomerGroupType = 'individual' | 'business';

export type FestivalPresetId =
  | 'diwali'
  | 'holi'
  | 'eid'
  | 'christmas'
  | 'new_year'
  | 'independence_day'
  | 'republic_day'
  | 'custom';

export interface AssignedCustomerRef {
  customerId?: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
}

export interface CouponRecord {
  id: string;
  code: string;
  aliases: string[];
  name: string;
  campaignName?: string;
  description?: string;
  offerType: CouponOfferType;
  discountValue: number; // % for percentage (1-100), INR for fixed, 0 for free_shipping
  minOrderAmount: number;
  maxOrderAmount?: number | null;
  maxDiscountCap?: number | null;
  startAt?: string | null; // ISO UTC string
  expiresAt?: string | null; // ISO UTC string
  status: CouponStatus;
  effectiveStatus?: CouponStatus; // Computed by server clock
  applicability: CouponApplicability;
  eligibleProductIds: string[];
  eligibleCategories: string[];
  eligibleCustomerGroups: CustomerGroupType[];
  assignedCustomers: AssignedCustomerRef[];
  isPrivate: boolean;
  isFestival: boolean;
  festivalPreset?: FestivalPresetId | null;
  festivalBannerUrl?: string | null;
  festivalBannerHeadline?: string | null;
  festivalBannerSubtext?: string | null;
  showOnStorefront: boolean;
  totalUsageLimit?: number | null;
  perCustomerLimit?: number | null;
  oneTimePerCustomer: boolean;
  allowCombineWithCoupons: boolean;
  allowCombineWithPromotions: boolean;
  usageCount: number;
  totalDiscountGiven: number;
  totalRevenueGenerated: number;
  internalNote?: string;
  isLegacy: boolean;
  requiresRecoverySession?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCouponSummary {
  id: string;
  code: string;
  name: string;
  campaignName?: string;
  description?: string;
  offerType: CouponOfferType;
  discountValue: number;
  minOrderAmount: number;
  maxOrderAmount?: number | null;
  maxDiscountCap?: number | null;
  startAt?: string | null;
  expiresAt?: string | null;
  applicability: CouponApplicability;
  eligibleProductIds: string[];
  eligibleCategories: string[];
  isPrivate: boolean;
  isFestival: boolean;
  festivalPreset?: FestivalPresetId | null;
  festivalBannerUrl?: string | null;
  festivalBannerHeadline?: string | null;
  festivalBannerSubtext?: string | null;
  showOnStorefront: boolean;
  oneTimePerCustomer: boolean;
}

export interface CouponCartLineInput {
  productId: string;
  productName?: string;
  category?: string;
  size?: string;
  variantSize?: string;
  unitPrice?: number;
  quantity: number;
}

export interface CouponValidationRequest {
  code: string;
  subtotal?: number;
  items?: CouponCartLineInput[];
  customerId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAccountType?: CustomerGroupType;
  hasActiveRecoveryCoupon?: boolean;
  recoveryToken?: string;
  checkoutSessionId?: string;
  hasOtherPromotionsApplied?: boolean;
  otherCouponCodesApplied?: string[];
  paymentPlan?: 'prepaid_100' | 'partial_50';
}

export interface CouponValidationResult {
  valid: boolean;
  code?: string;
  couponId?: string;
  name?: string;
  description?: string;
  offerType?: CouponOfferType;
  discountValue?: number;
  discountAmount: number;
  shippingFee: number;
  shippingSaved: number;
  freeShippingApplied: boolean;
  subtotal: number;
  eligibleSubtotal: number;
  taxableSubtotal: number;
  gstAmount: number;
  finalTotal: number;
  advanceAmount50: number;
  balanceAmount50: number;
  isPrivate?: boolean;
  isFestival?: boolean;
  badgeText?: string;
  message: string;
  reasonCode?:
    | 'INVALID_CODE'
    | 'INACTIVE_STATUS'
    | 'NOT_STARTED'
    | 'EXPIRED'
    | 'MIN_ORDER_NOT_MET'
    | 'MAX_ORDER_EXCEEDED'
    | 'PRODUCT_NOT_ELIGIBLE'
    | 'CATEGORY_NOT_ELIGIBLE'
    | 'CUSTOMER_NOT_ELIGIBLE'
    | 'AUTH_REQUIRED'
    | 'INVALID_CART_ITEMS'
    | 'STORAGE_UNAVAILABLE'
    | 'NEW_CUSTOMER_ONLY'
    | 'EXISTING_CUSTOMER_ONLY'
    | 'CUSTOMER_GROUP_NOT_ELIGIBLE'
    | 'TOTAL_LIMIT_REACHED'
    | 'CUSTOMER_LIMIT_REACHED'
    | 'RECOVERY_SESSION_REQUIRED'
    | 'COMBINATION_NOT_ALLOWED'
    | 'VALID';
}

export interface CouponRedemptionRecord {
  id: string;
  couponId: string;
  couponCode: string;
  orderId: string;
  orderNumber?: string;
  paymentId?: string;
  reservationId?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  subtotalInr: number;
  discountInr: number;
  shippingSavedInr: number;
  finalTotalInr: number;
  paymentStatus: string;
  status: 'redeemed' | 'restored' | 'cancelled';
  redeemedAt: string;
  restoredAt?: string | null;
  restoredBy?: string | null;
}

export interface CouponAuditLogRecord {
  id: string;
  couponId?: string | null;
  couponCode?: string | null;
  action: string;
  actor: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CouponCustomerNotification {
  id: string;
  couponId: string;
  couponCode: string;
  customerId?: string;
  customerEmail: string;
  customerName?: string;
  title: string;
  message: string;
  channel: 'dashboard' | 'email' | 'both';
  emailSent: boolean;
  emailStatusNote?: string;
  readAt?: string | null;
  createdAt: string;
}

export interface CouponPolicySettings {
  restoreOnCancel: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export interface CouponCustomerDirectoryItem {
  customerId: string;
  name: string;
  email: string;
  phone: string;
  company?: string;
  accountType: CustomerGroupType;
  ordersCount: number;
  totalSpent: number;
  lastOrderAt?: string;
}

export interface CouponAnalyticsOverview {
  kpis: {
    totalCoupons: number;
    activeCoupons: number;
    scheduledCoupons: number;
    pausedCoupons: number;
    expiredCoupons: number;
    archivedCoupons: number;
    privateCoupons: number;
    festivalCoupons: number;
    totalRedemptions: number;
    totalDiscountGivenInr: number;
    totalShippingSavedInr: number;
    ordersGeneratedCount: number;
    totalRevenueGeneratedInr: number;
  };
  coupons: CouponRecord[];
  redemptions: CouponRedemptionRecord[];
  auditLogs: CouponAuditLogRecord[];
  campaignPerformance: Array<{
    campaignName: string;
    couponsCount: number;
    redemptionsCount: number;
    discountGivenInr: number;
    revenueGeneratedInr: number;
  }>;
  dailySeries: Array<{
    date: string;
    label: string;
    redemptions: number;
    discountInr: number;
    revenueInr: number;
  }>;
  settings: CouponPolicySettings;
  storageMode: 'supabase' | 'local_file';
  serverTime: string;
}

export interface CreateCouponPayload {
  code?: string;
  autoGenerateCode?: boolean;
  codePrefix?: string;
  aliases?: string[];
  name: string;
  campaignName?: string;
  description?: string;
  offerType: CouponOfferType;
  discountValue: number;
  minOrderAmount?: number;
  maxOrderAmount?: number | null;
  maxDiscountCap?: number | null;
  startAt?: string | null;
  expiresAt?: string | null;
  status?: CouponStatus;
  applicability: CouponApplicability;
  eligibleProductIds?: string[];
  eligibleCategories?: string[];
  eligibleCustomerGroups?: CustomerGroupType[];
  assignedCustomers?: AssignedCustomerRef[];
  isPrivate?: boolean;
  isFestival?: boolean;
  festivalPreset?: FestivalPresetId | null;
  festivalBannerUrl?: string | null;
  festivalBannerHeadline?: string | null;
  festivalBannerSubtext?: string | null;
  showOnStorefront?: boolean;
  totalUsageLimit?: number | null;
  perCustomerLimit?: number | null;
  oneTimePerCustomer?: boolean;
  allowCombineWithCoupons?: boolean;
  allowCombineWithPromotions?: boolean;
  internalNote?: string;
}

export interface BulkGenerateCouponsPayload {
  prefix: string;
  campaignName: string;
  nameTemplate: string;
  description?: string;
  offerType: CouponOfferType;
  discountValue: number;
  minOrderAmount?: number;
  maxOrderAmount?: number | null;
  maxDiscountCap?: number | null;
  startAt?: string | null;
  expiresAt?: string | null;
  oneTimePerCustomer?: boolean;
  perCustomerLimit?: number | null;
  totalUsageLimit?: number | null;
  customers: AssignedCustomerRef[];
  internalNote?: string;
  notifyChannel?: 'none' | 'dashboard' | 'email' | 'both';
}
