// ==============================================================================
// TEQQNOWORLD — AFFILIATE PARTNER PROGRAM DOMAIN TYPES
// ==============================================================================

export type AffiliateApplicationStatus =
  | 'draft'
  | 'email_verification_pending'
  | 'submitted'
  | 'under_review'
  | 'kyc_pending'
  | 'kyc_under_review'
  | 'approved'
  | 'rejected';

export type AffiliatePartnerStatus = 'active' | 'suspended' | 'closed';

export type AffiliateKycStatus = 'pending' | 'under_review' | 'verified' | 'rejected';

export type AffiliateBankVerificationMethod = 'penny_drop' | 'manual_document' | 'both';

export type AffiliateCommissionStatus =
  | 'pending'
  | 'on_hold'
  | 'available'
  | 'cancelled'
  | 'paid'
  | 'adjusted'
  | 'under_review';

export type AffiliateWithdrawalStatus = 'pending' | 'processing' | 'paid' | 'rejected';

export type AffiliateWalletLedgerEntryType =
  | 'commission_pending'
  | 'commission_available'
  | 'commission_cancelled'
  | 'commission_refund_adjustment'
  | 'commission_hold'
  | 'commission_unhold'
  | 'withdrawal_requested'
  | 'withdrawal_paid'
  | 'withdrawal_rejected_restore'
  | 'reward_bonus_credit'
  | 'admin_adjustment';

export type AffiliateFraudFlagType =
  | 'self_referral'
  | 'suspicious_click_burst'
  | 'repeated_refund_pattern'
  | 'duplicate_kyc'
  | 'policy_violation'
  | 'manual_review';

export type AffiliateFraudFlagStatus = 'open' | 'investigating' | 'cleared' | 'confirmed_fraud';

export type AffiliateRewardType = 'cash_bonus' | 'gift' | 'product' | 'voucher' | 'custom';

export type AffiliateAnalyticsRange = 'live' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface AffiliateProgramSettings {
  programEnabled: boolean;
  programPaused: boolean;
  registrationOpen: boolean;
  affiliateIdPrefix: string;
  affiliateIdDigits: number;
  cookieDurationDays: number;
  returnPeriodDays: number;
  minWithdrawalPaisa: number;
  payoutProcessingDaysMin: number;
  payoutProcessingDaysMax: number;
  defaultCommissionRatePct: number;
  termsVersion: string;
  privacyVersion: string;
  kycConsentVersion: string;
  officialDomain: string;
  updatedAt: string;
}

export interface AffiliateEligibilityResult {
  eligible: boolean;
  reasons: string[];
  hasDeliveredOrder: boolean;
  deliveredOrderCount: number;
  qualifyingOrderId: string | null;
  qualifyingDeliveredAt: string | null;
  returnPeriodDays: number;
  returnPeriodRemainingDays: number;
  existingApplicationStatus: AffiliateApplicationStatus | null;
  existingPartnerStatus: AffiliatePartnerStatus | null;
  existingAffiliateId: string | null;
}

export interface AffiliateApplicationRecord {
  id: string;
  customerUserId?: string;
  customerEmail: string;
  firstName: string;
  lastName: string;
  mobile: string;
  companyName?: string;
  dateOfBirth?: string;
  isAdultConfirmed: boolean;
  qualifyingOrderId: string | null;
  qualifyingDeliveredAt: string | null;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  termsAccepted: boolean;
  termsVersion: string;
  termsAcceptedAt: string;
  privacyAccepted: boolean;
  privacyVersion: string;
  privacyAcceptedAt: string;
  kycConsentAccepted: boolean;
  kycConsentVersion: string;
  kycConsentAcceptedAt: string;
  status: AffiliateApplicationStatus;
  rejectionReason: string | null;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reapplyCount: number;
  previousApplicationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateKycMaskedView {
  id: string;
  applicationId: string;
  partnerId: string | null;
  customerEmail: string;
  aadhaarMasked: string;
  panMasked: string;
  bankAccountHolderName: string;
  bankAccountMasked: string;
  bankIfscCode: string;
  bankName: string;
  aadhaarDocName: string | null;
  panDocName: string | null;
  bankProofDocName: string | null;
  kycStatus: AffiliateKycStatus;
  kycRejectionReason: string | null;
  kycVerifiedAt: string | null;
  bankVerificationStatus: AffiliateKycStatus;
  bankVerificationMethod: AffiliateBankVerificationMethod | null;
  pennyDropStatus: string | null;
  pennyDropReference: string | null;
  bankRejectionReason: string | null;
  bankVerifiedAt: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface AffiliatePartnerRecord {
  id: string;
  applicationId: string;
  affiliateId: string;
  referralToken: string;
  customerUserId?: string;
  customerEmail: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobile: string;
  companyName?: string;
  avatarUrl: string | null;
  status: AffiliatePartnerStatus;
  suspensionReason: string | null;
  suspendedAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
  certificateNumber: string;
  cardNumber: string;
  verificationCode: string;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateProductCommissionHistoryItem {
  changedAt: string;
  changedBy: string;
  enabled: boolean;
  commissionRatePct: number;
  campaignRatePct: number | null;
  campaignLabel: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface AffiliateProductSetting {
  productId: string;
  productSlug: string;
  productName: string;
  basePriceInr: number;
  enabled: boolean;
  commissionRatePct: number;
  campaignRatePct: number | null;
  campaignLabel: string | null;
  startDate: string | null;
  endDate: string | null;
  updatedBy: string | null;
  updatedAt: string;
  history: AffiliateProductCommissionHistoryItem[];
}

export interface AffiliateLinkRecord {
  id: string;
  partnerId: string;
  affiliateId: string;
  linkType: 'website' | 'product';
  productId: string | null;
  productSlug: string | null;
  productName: string | null;
  referralToken: string;
  campaignTag: string | null;
  targetUrl: string;
  status: 'active' | 'paused' | 'disabled' | 'expired';
  clicksCount: number;
  ordersCount: number;
  commissionEarnedPaisa: number;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateClickRecord {
  id: string;
  partnerId: string;
  affiliateId: string;
  linkId: string | null;
  referralToken: string;
  landingPath: string;
  productId: string | null;
  productSlug: string | null;
  productName: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  trafficSource: string;
  campaign: string | null;
  isSuspicious: boolean;
  suspiciousReason: string | null;
  clickedAt: string;
}

export interface AffiliateCommissionRecord {
  id: string;
  idempotencyKey: string;
  partnerId: string;
  affiliateId: string;
  orderId: string;
  orderNumberMasked: string;
  orderItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  refundedQuantity: number;
  grossItemAmountPaisa: number;
  discountAmountPaisa: number;
  gstInclusiveEligiblePaisa: number;
  shippingExcludedPaisa: number;
  commissionRatePctSnapshot: number;
  commissionRateSource: 'product_standard' | 'product_campaign';
  commissionAmountPaisa: number;
  originalCommissionPaisa: number;
  orderStatus: 'placed' | 'approved' | 'in-production' | 'dispatched' | 'delivered' | 'cancelled' | 'refunded' | 'partially_refunded';
  status: AffiliateCommissionStatus;
  statusReason: string | null;
  deliveredAt: string | null;
  returnPeriodDaysSnapshot: number;
  returnPeriodEndsAt: string | null;
  releasedAt: string | null;
  paidAt: string | null;
  fraudFlagId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateWalletSummary {
  partnerId: string;
  affiliateId: string;
  pendingPaisa: number;
  availablePaisa: number;
  processingPaisa: number;
  totalWithdrawnPaisa: number;
  lifetimeEarnedPaisa: number;
  fundsHeld: boolean;
  holdReason: string | null;
  updatedAt: string;
}

export interface AffiliateWalletLedgerEntry {
  id: string;
  idempotencyKey: string;
  partnerId: string;
  affiliateId: string;
  entryType: AffiliateWalletLedgerEntryType;
  amountPaisa: number;
  bucket: 'pending' | 'available' | 'processing' | 'withdrawn';
  balanceAfterPaisa: number;
  referenceType: string | null;
  referenceId: string | null;
  description: string;
  actor: string;
  createdAt: string;
}

export interface AffiliateWithdrawalRecord {
  id: string;
  requestCode: string;
  partnerId: string;
  affiliateId: string;
  partnerName: string;
  amountPaisa: number;
  status: AffiliateWithdrawalStatus;
  bankHolderSnapshot: string;
  bankAccountMaskedSnapshot: string;
  bankIfscSnapshot: string;
  transferReference: string | null;
  rejectionReason: string | null;
  adminNotes: string | null;
  processedBy: string | null;
  requestedAt: string;
  processedAt: string | null;
}

export interface AffiliateSalesTarget {
  id: string;
  monthKey: string; // YYYY-MM
  title: string;
  description: string;
  metricType: 'delivered_orders' | 'delivered_sales_paisa';
  targetValue: number;
  rewardType: AffiliateRewardType;
  rewardTitle: string;
  rewardValuePaisa: number;
  active: boolean;
  createdAt: string;
}

export interface AffiliateTargetProgress extends AffiliateSalesTarget {
  provisionalDeliveredValue: number;
  finalQualifiedValue: number;
  provisionalPct: number;
  finalPct: number;
  achievedFinal: boolean;
}

export interface AffiliateRewardRecord {
  id: string;
  partnerId: string;
  affiliateId: string;
  partnerName?: string;
  sourceType: 'monthly_target' | 'leaderboard_rank' | 'admin_manual';
  sourceRefId: string | null;
  periodLabel: string;
  rewardType: AffiliateRewardType;
  rewardTitle: string;
  rewardValuePaisa: number;
  status: 'pending_review' | 'approved' | 'credited' | 'dispatched' | 'cancelled';
  notes: string | null;
  awardedBy: string;
  awardedAt: string;
}

export interface AffiliateLeaderboardEntry {
  rank: number;
  affiliateId: string;
  partnerDisplayName: string;
  qualifiedOrdersCount: number;
  qualifiedSalesPaisa: number;
  isCurrentPartner: boolean;
}

export interface AffiliateNotificationRecord {
  id: string;
  partnerId: string | null;
  affiliateId: string | null;
  category: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AffiliateAnnouncementRecord {
  id: string;
  title: string;
  message: string;
  priority: 'normal' | 'important';
  active: boolean;
  createdAt: string;
}

export interface AffiliateSupportMessage {
  id: string;
  senderRole: 'affiliate' | 'admin';
  senderName: string;
  message: string;
  createdAt: string;
}

export interface AffiliateSupportTicket {
  id: string;
  ticketNumber: string;
  partnerId: string;
  affiliateId: string;
  partnerName: string;
  subject: string;
  category: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'normal' | 'high';
  messages: AffiliateSupportMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateFraudFlagRecord {
  id: string;
  partnerId: string | null;
  affiliateId: string | null;
  flagType: AffiliateFraudFlagType;
  severity: 'low' | 'medium' | 'high';
  orderId: string | null;
  commissionId: string | null;
  details: string;
  status: AffiliateFraudFlagStatus;
  resolutionNotes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AffiliateReactivationRequest {
  id: string;
  partnerId: string;
  affiliateId: string;
  partnerName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AffiliateClosureRequest {
  id: string;
  partnerId: string;
  affiliateId: string;
  partnerName: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  settlementNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AffiliateAuditLogRecord {
  id: string;
  actorRole: 'admin' | 'system' | 'affiliate';
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AffiliatePublicVerificationResult {
  valid: boolean;
  partnerName: string;
  affiliateId: string;
  certificateNumber: string;
  cardNumber: string;
  status: AffiliatePartnerStatus;
  joinedAt: string;
  verificationLabel: string;
  verifiedAt: string;
}

export interface AffiliateAnalyticsSeriesPoint {
  label: string;
  clicks: number;
  orders: number;
  salesPaisa: number;
  commissionPaisa: number;
}

export interface AffiliateDashboardPayload {
  settings: AffiliateProgramSettings;
  partner: AffiliatePartnerRecord;
  kyc: AffiliateKycMaskedView | null;
  wallet: AffiliateWalletSummary;
  ledger: AffiliateWalletLedgerEntry[];
  links: AffiliateLinkRecord[];
  enabledProducts: AffiliateProductSetting[];
  clicks: AffiliateClickRecord[];
  commissions: AffiliateCommissionRecord[];
  withdrawals: AffiliateWithdrawalRecord[];
  targets: AffiliateTargetProgress[];
  rewards: AffiliateRewardRecord[];
  leaderboards: {
    monthly: AffiliateLeaderboardEntry[];
    yearly: AffiliateLeaderboardEntry[];
    allTime: AffiliateLeaderboardEntry[];
  };
  notifications: AffiliateNotificationRecord[];
  announcements: AffiliateAnnouncementRecord[];
  tickets: AffiliateSupportTicket[];
  reactivationRequests: AffiliateReactivationRequest[];
  closureRequests: AffiliateClosureRequest[];
  kpis: {
    totalClicks: number;
    referredOrders: number;
    deliveredOrders: number;
    conversionRatePct: number;
    totalReferredSalesPaisa: number;
    pendingCommissionPaisa: number;
    availableCommissionPaisa: number;
    processingPayoutPaisa: number;
    totalWithdrawnPaisa: number;
    unreadNotifications: number;
  };
  productPromotionHistory: Array<{
    productId: string;
    productSlug: string;
    productName: string;
    commissionRatePct: number;
    clicks: number;
    orders: number;
    salesPaisa: number;
    commissionPaisa: number;
    conversionRatePct: number;
  }>;
  analyticsSeries: AffiliateAnalyticsSeriesPoint[];
}
