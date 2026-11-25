import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, Router } from 'express';
import {
  buildAffiliateBrandedEmailHtml,
  calculateCommissionPaisa,
  calculateProportionalRefundCommissionPaisa,
  encryptAffiliateSecret,
  formatInrFromPaisa,
  hashOtpCode,
  hashSensitiveIdentifier,
  inrToPaisa,
  isValidAadhaar,
  isValidBankAccount,
  isValidIfsc,
  isValidPan,
  maskAadhaarNumber,
  maskBankAccountNumber,
  maskOrderReference,
  maskPanNumber,
  normalizeEmail,
  normalizeMobile,
  sanitizePlainText,
} from './affiliateCrypto.ts';
import {
  CANONICAL_ORIGIN,
  PRODUCT_H1_MAP,
  PRODUCT_ID_TO_CANONICAL_SLUG,
} from '../src/config/seoRoutes.ts';
import type {
  AffiliateAnalyticsRange,
  AffiliateAnnouncementRecord,
  AffiliateApplicationRecord,
  AffiliateAuditLogRecord,
  AffiliateClickRecord,
  AffiliateClosureRequest,
  AffiliateCommissionRecord,
  AffiliateCommissionStatus,
  AffiliateEligibilityResult,
  AffiliateFraudFlagRecord,
  AffiliateKycMaskedView,
  AffiliateLeaderboardEntry,
  AffiliateLinkRecord,
  AffiliateNotificationRecord,
  AffiliatePartnerRecord,
  AffiliateProductSetting,
  AffiliateProgramSettings,
  AffiliatePublicVerificationResult,
  AffiliateReactivationRequest,
  AffiliateRewardRecord,
  AffiliateSalesTarget,
  AffiliateSupportTicket,
  AffiliateTargetProgress,
  AffiliateWalletLedgerEntry,
  AffiliateWalletSummary,
  AffiliateWithdrawalRecord,
} from '../src/types/affiliate.ts';

// ==============================================================================
// TEQQNOWORLD AFFILIATE PARTNER PROGRAM — SERVER-AUTHORITATIVE EXPRESS ROUTER
// ==============================================================================

export interface AffiliateRouterDeps {
  verifyAdminRequest: (req: Request) => boolean;
  getSupabaseAdminConfig: () => {
    configured: boolean;
    url: string;
    serviceRoleKey: string;
  };
  buildSupabaseAdminHeaders: (
    serviceRoleKey: string,
    extra?: Record<string, string>
  ) => Record<string, string>;
  getAdminEmails: () => string[];
  sendAffiliateEmail: (params: {
    to: string | string[];
    subject: string;
    html: string;
    text: string;
  }) => Promise<void>;
  storeFilePath?: string;
  kycUploadDir?: string;
}

interface InternalKycRecord extends AffiliateKycMaskedView {
  aadhaarEncrypted: string;
  aadhaarHash: string;
  panEncrypted: string;
  panHash: string;
  bankAccountEncrypted: string;
  bankAccountHash: string;
  aadhaarDocPath: string | null;
  panDocPath: string | null;
  bankProofDocPath: string | null;
  kycVerifiedBy: string | null;
  bankVerifiedBy: string | null;
}

interface InternalOtpRecord {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  verifiedAt: string | null;
  lastSentAt: string;
  sendCountHour: number;
  windowStartedAt: string;
}

interface InternalAttributionRecord {
  cookieId: string;
  partnerId: string;
  affiliateId: string;
  referralToken: string;
  lastClickId: string | null;
  customerEmail: string | null;
  customerUserId: string | null;
  landingPath: string;
  productId: string | null;
  campaign: string | null;
  attributedAt: string;
  expiresAt: string;
}

interface InternalTestDeliveredOrder {
  orderId: string;
  customerEmail: string;
  customerMobile: string;
  status: string;
  deliveredAt: string;
}

interface AffiliateStoreData {
  settings: AffiliateProgramSettings;
  affiliateIdSequence: number;
  withdrawalSequence: number;
  ticketSequence: number;
  applications: AffiliateApplicationRecord[];
  otps: Record<string, InternalOtpRecord>;
  partners: AffiliatePartnerRecord[];
  kycRecords: InternalKycRecord[];
  productSettings: AffiliateProductSetting[];
  links: AffiliateLinkRecord[];
  clicks: AffiliateClickRecord[];
  attributions: InternalAttributionRecord[];
  commissions: AffiliateCommissionRecord[];
  wallets: Record<string, AffiliateWalletSummary>;
  ledger: AffiliateWalletLedgerEntry[];
  withdrawals: AffiliateWithdrawalRecord[];
  targets: AffiliateSalesTarget[];
  rewards: AffiliateRewardRecord[];
  notifications: AffiliateNotificationRecord[];
  notificationEventKeys: string[];
  announcements: AffiliateAnnouncementRecord[];
  tickets: AffiliateSupportTicket[];
  fraudFlags: AffiliateFraudFlagRecord[];
  reactivationRequests: AffiliateReactivationRequest[];
  closureRequests: AffiliateClosureRequest[];
  auditLogs: AffiliateAuditLogRecord[];
  deliveredOrderMirror: InternalTestDeliveredOrder[];
}

const AFFILIATE_COOKIE_NAME = 'tw_aff_ref';

const CATALOG_PRODUCT_SEEDS: Array<{
  productId: string;
  productSlug: string;
  productName: string;
  basePriceInr: number;
}> = [
  { productId: 'prod-polo-01', productSlug: PRODUCT_ID_TO_CANONICAL_SLUG['prod-polo-01'], productName: PRODUCT_H1_MAP['prod-polo-01'], basePriceInr: 499 },
  { productId: 'prod-plain-polo', productSlug: PRODUCT_ID_TO_CANONICAL_SLUG['prod-plain-polo'], productName: PRODUCT_H1_MAP['prod-plain-polo'], basePriceInr: 449 },
  { productId: 'prod-joab-coolmax', productSlug: PRODUCT_ID_TO_CANONICAL_SLUG['prod-joab-coolmax'], productName: PRODUCT_H1_MAP['prod-joab-coolmax'], basePriceInr: 549 },
  { productId: 'prod-matty-polo', productSlug: PRODUCT_ID_TO_CANONICAL_SLUG['prod-matty-polo'], productName: PRODUCT_H1_MAP['prod-matty-polo'], basePriceInr: 499 },
  { productId: 'prod-cotton-flexi-caps', productSlug: PRODUCT_ID_TO_CANONICAL_SLUG['prod-cotton-flexi-caps'], productName: PRODUCT_H1_MAP['prod-cotton-flexi-caps'], basePriceInr: 185 },
  { productId: 'prod-ceramic-mug', productSlug: PRODUCT_ID_TO_CANONICAL_SLUG['prod-ceramic-mug'], productName: PRODUCT_H1_MAP['prod-ceramic-mug'], basePriceInr: 249 },
  { productId: 'prod-visiting-card-300gsm', productSlug: PRODUCT_ID_TO_CANONICAL_SLUG['prod-visiting-card-300gsm'], productName: PRODUCT_H1_MAP['prod-visiting-card-300gsm'], basePriceInr: 300 },
  { productId: 'prod-rollup-standee', productSlug: PRODUCT_ID_TO_CANONICAL_SLUG['prod-rollup-standee'], productName: PRODUCT_H1_MAP['prod-rollup-standee'], basePriceInr: 1899 },
  { productId: 'prod-promo-table', productSlug: PRODUCT_ID_TO_CANONICAL_SLUG['prod-promo-table'], productName: PRODUCT_H1_MAP['prod-promo-table'], basePriceInr: 4499 },
  { productId: 'prod-branding-umbrella', productSlug: PRODUCT_ID_TO_CANONICAL_SLUG['prod-branding-umbrella'], productName: PRODUCT_H1_MAP['prod-branding-umbrella'], basePriceInr: 2499 },
  { productId: 'prod-canopy-kiosk', productSlug: PRODUCT_ID_TO_CANONICAL_SLUG['prod-canopy-kiosk'], productName: PRODUCT_H1_MAP['prod-canopy-kiosk'], basePriceInr: 5999 },
];

function createDefaultStore(): AffiliateStoreData {
  const now = new Date().toISOString();
  return {
    settings: {
      programEnabled: true,
      programPaused: false,
      registrationOpen: true,
      affiliateIdPrefix: 'TW-AFF-',
      affiliateIdDigits: 6,
      cookieDurationDays: 30,
      returnPeriodDays: 7,
      minWithdrawalPaisa: 10000, // ₹100
      payoutProcessingDaysMin: 5,
      payoutProcessingDaysMax: 7,
      defaultCommissionRatePct: 5,
      termsVersion: 'v1.0',
      privacyVersion: 'v1.0',
      kycConsentVersion: 'v1.0',
      officialDomain: CANONICAL_ORIGIN,
      updatedAt: now,
    },
    affiliateIdSequence: 0,
    withdrawalSequence: 0,
    ticketSequence: 0,
    applications: [],
    otps: {},
    partners: [],
    kycRecords: [],
    // Products are strictly DISABLED by default — admin manually enables & configures each product
    productSettings: CATALOG_PRODUCT_SEEDS.map((p) => ({
      productId: p.productId,
      productSlug: p.productSlug,
      productName: p.productName,
      basePriceInr: p.basePriceInr,
      enabled: false,
      commissionRatePct: 5,
      campaignRatePct: null,
      campaignLabel: null,
      startDate: null,
      endDate: null,
      updatedBy: null,
      updatedAt: now,
      history: [],
    })),
    links: [],
    clicks: [],
    attributions: [],
    commissions: [],
    wallets: {},
    ledger: [],
    withdrawals: [],
    targets: [],
    rewards: [],
    notifications: [],
    notificationEventKeys: [],
    announcements: [
      {
        id: 'ann-welcome-program',
        title: 'Welcome to the TeqqnoWorld Affiliate Partner Program',
        message:
          'Earn verified commissions on admin-enabled TeqqnoWorld products. Commissions become available after order delivery and return period completion.',
        priority: 'normal',
        active: true,
        createdAt: now,
      },
    ],
    tickets: [],
    fraudFlags: [],
    reactivationRequests: [],
    closureRequests: [],
    auditLogs: [],
    deliveredOrderMirror: [],
  };
}

function parseCookiesHeader(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function parseUserAgentInfo(uaRaw?: string): {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
} {
  const ua = String(uaRaw || '').toLowerCase();
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/ipad|tablet|playbook|silk/.test(ua)) deviceType = 'tablet';
  else if (/mobile|iphone|android|blackberry|opera mini|iemobile/.test(ua)) deviceType = 'mobile';

  let browser = 'Other';
  if (ua.includes('edg/')) browser = 'Edge';
  else if (ua.includes('chrome/') && !ua.includes('edg/')) browser = 'Chrome';
  else if (ua.includes('firefox/')) browser = 'Firefox';
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Safari';
  else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';

  return { deviceType, browser };
}

function getMonthKey(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function getYearKey(date = new Date()): string {
  return String(date.getUTCFullYear());
}

function daysBetween(olderIso: string, newerDate = new Date()): number {
  const olderMs = new Date(olderIso).getTime();
  if (!Number.isFinite(olderMs)) return 0;
  return (newerDate.getTime() - olderMs) / (1000 * 60 * 60 * 24);
}

function toPublicMaskedKyc(record: InternalKycRecord | null | undefined): AffiliateKycMaskedView | null {
  if (!record) return null;
  return {
    id: record.id,
    applicationId: record.applicationId,
    partnerId: record.partnerId,
    customerEmail: record.customerEmail,
    aadhaarMasked: record.aadhaarMasked,
    panMasked: record.panMasked,
    bankAccountHolderName: record.bankAccountHolderName,
    bankAccountMasked: record.bankAccountMasked,
    bankIfscCode: record.bankIfscCode,
    bankName: record.bankName,
    aadhaarDocName: record.aadhaarDocName,
    panDocName: record.panDocName,
    bankProofDocName: record.bankProofDocName,
    kycStatus: record.kycStatus,
    kycRejectionReason: record.kycRejectionReason,
    kycVerifiedAt: record.kycVerifiedAt,
    bankVerificationStatus: record.bankVerificationStatus,
    bankVerificationMethod: record.bankVerificationMethod,
    pennyDropStatus: record.pennyDropStatus,
    pennyDropReference: record.pennyDropReference,
    bankRejectionReason: record.bankRejectionReason,
    bankVerifiedAt: record.bankVerifiedAt,
    submittedAt: record.submittedAt,
    updatedAt: record.updatedAt,
  };
}

export function createAffiliateRouter(deps: AffiliateRouterDeps): Router {
  const router = express.Router();

  const storePath =
    deps.storeFilePath ||
    path.resolve(process.cwd(), 'data', 'teqqno-affiliate-store.json');
  const kycDir =
    deps.kycUploadDir || path.resolve(process.cwd(), 'data', 'affiliate-kyc');

  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  fs.mkdirSync(kycDir, { recursive: true });

  // Concurrency-safe in-process mutex for financial mutations (withdrawals, wallet credits, releases)
  let financialQueue: Promise<void> = Promise.resolve();
  function withFinancialLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = financialQueue.then(fn, fn);
    financialQueue = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  }

  function loadStore(): AffiliateStoreData {
    try {
      if (fs.existsSync(storePath)) {
        const raw = fs.readFileSync(storePath, 'utf8');
        const parsed = JSON.parse(raw) as Partial<AffiliateStoreData>;
        const defaults = createDefaultStore();
        const existingProducts = Array.isArray(parsed.productSettings)
          ? parsed.productSettings
          : [];
        const mergedProducts = [...existingProducts];
        for (const seed of defaults.productSettings) {
          if (!mergedProducts.some((p) => p.productId === seed.productId)) {
            mergedProducts.push(seed);
          }
        }
        return {
          ...defaults,
          ...parsed,
          settings: { ...defaults.settings, ...(parsed.settings || {}) },
          productSettings: mergedProducts,
          wallets: parsed.wallets || {},
          otps: parsed.otps || {},
          deliveredOrderMirror: parsed.deliveredOrderMirror || [],
        };
      }
    } catch (err) {
      console.error('[AffiliateStore] Failed to load store, using defaults:', err);
    }
    const fresh = createDefaultStore();
    saveStore(fresh);
    return fresh;
  }

  function saveStore(store: AffiliateStoreData): void {
    const tmpPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmpPath, storePath);
  }

  function appendAudit(
    store: AffiliateStoreData,
    actorRole: 'admin' | 'system' | 'affiliate',
    actorId: string,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata: Record<string, unknown> = {}
  ): void {
    store.auditLogs.unshift({
      id: crypto.randomUUID(),
      actorRole,
      actorId,
      action,
      entityType,
      entityId,
      metadata,
      createdAt: new Date().toISOString(),
    });
    if (store.auditLogs.length > 2000) {
      store.auditLogs.length = 2000;
    }
  }

  function ensureWallet(store: AffiliateStoreData, partner: AffiliatePartnerRecord): AffiliateWalletSummary {
    if (!store.wallets[partner.id]) {
      store.wallets[partner.id] = {
        partnerId: partner.id,
        affiliateId: partner.affiliateId,
        pendingPaisa: 0,
        availablePaisa: 0,
        processingPaisa: 0,
        totalWithdrawnPaisa: 0,
        lifetimeEarnedPaisa: 0,
        fundsHeld: partner.status === 'suspended',
        holdReason: partner.suspensionReason,
        updatedAt: new Date().toISOString(),
      };
    }
    return store.wallets[partner.id];
  }

  function appendLedgerEntry(
    store: AffiliateStoreData,
    entry: Omit<AffiliateWalletLedgerEntry, 'id' | 'createdAt'>
  ): boolean {
    if (store.ledger.some((l) => l.idempotencyKey === entry.idempotencyKey)) {
      return false;
    }
    store.ledger.unshift({
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    return true;
  }

  async function notifyPartnerAndEmail(
    store: AffiliateStoreData,
    params: {
      eventKey: string;
      partner?: AffiliatePartnerRecord | null;
      recipientEmail: string;
      recipientName: string;
      category: string;
      title: string;
      message: string;
      emailSubject?: string;
      highlightRows?: Array<{ label: string; value: string }>;
      ctaLabel?: string;
      ctaUrl?: string;
      notifyAdmins?: boolean;
    }
  ): Promise<void> {
    if (store.notificationEventKeys.includes(params.eventKey)) {
      return;
    }
    store.notificationEventKeys.push(params.eventKey);
    if (store.notificationEventKeys.length > 5000) {
      store.notificationEventKeys = store.notificationEventKeys.slice(-4000);
    }

    if (params.partner) {
      store.notifications.unshift({
        id: crypto.randomUUID(),
        partnerId: params.partner.id,
        affiliateId: params.partner.affiliateId,
        category: params.category,
        title: params.title,
        message: params.message,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
    }

    const emailDoc = buildAffiliateBrandedEmailHtml({
      badge: 'Affiliate Partner Program',
      heading: params.title,
      greeting: `Hello ${params.recipientName},`,
      bodyParagraphs: [params.message],
      highlightRows: params.highlightRows,
      ctaLabel: params.ctaLabel,
      ctaUrl: params.ctaUrl,
    });

    const targets: string[] = [];
    if (params.recipientEmail) targets.push(params.recipientEmail);
    if (params.notifyAdmins) {
      for (const adm of deps.getAdminEmails()) {
        if (adm && !targets.includes(adm)) targets.push(adm);
      }
    }

    if (targets.length > 0) {
      try {
        await deps.sendAffiliateEmail({
          to: targets,
          subject: params.emailSubject || `${params.title} — TeqqnoWorld Affiliate Program`,
          html: emailDoc.html,
          text: emailDoc.text,
        });
      } catch (err) {
        console.error('[AffiliateNotification] Email dispatch error:', err);
      }
    }
  }

  async function fetchCustomerDeliveredOrders(
    store: AffiliateStoreData,
    customerEmail: string,
    customerMobile?: string
  ): Promise<Array<{ orderId: string; deliveredAt: string }>> {
    const cleanEmail = normalizeEmail(customerEmail);
    const cleanPhone = normalizeMobile(customerMobile || '');
    const results: Array<{ orderId: string; deliveredAt: string }> = [];

    // 1. Check live Supabase custom_orders if configured
    const sb = deps.getSupabaseAdminConfig();
    if (sb.configured && (cleanEmail || cleanPhone)) {
      try {
        const filters: string[] = [];
        if (cleanEmail) filters.push(`customer_email.ilike.${encodeURIComponent(cleanEmail)}`);
        if (cleanPhone) filters.push(`phone.ilike.*${encodeURIComponent(cleanPhone)}*`);
        const url = `${sb.url}/rest/v1/custom_orders?select=id,status,created_at,customer_email,phone&status=eq.delivered&or=(${filters.join(',')})&order=created_at.asc`;
        const resp = await fetch(url, {
          headers: deps.buildSupabaseAdminHeaders(sb.serviceRoleKey),
        });
        if (resp.ok) {
          const rows = (await resp.json()) as Array<{
            id: string;
            status: string;
            created_at: string;
          }>;
          for (const row of rows || []) {
            if (row.status === 'delivered') {
              results.push({ orderId: row.id, deliveredAt: row.created_at });
            }
          }
        }
      } catch (err) {
        console.warn('[AffiliateEligibility] Supabase custom_orders lookup warning:', err);
      }
    }

    // 2. Also inspect server-side delivered order mirror (used when orders are updated via server or in non-Supabase test runs)
    for (const ord of store.deliveredOrderMirror) {
      if (ord.status !== 'delivered') continue;
      const emailMatch = cleanEmail && normalizeEmail(ord.customerEmail) === cleanEmail;
      const phoneMatch = cleanPhone && normalizeMobile(ord.customerMobile) === cleanPhone;
      if ((emailMatch || phoneMatch) && !results.some((r) => r.orderId === ord.orderId)) {
        results.push({ orderId: ord.orderId, deliveredAt: ord.deliveredAt });
      }
    }

    return results;
  }

  async function evaluateCustomerEligibility(
    store: AffiliateStoreData,
    params: {
      customerEmail: string;
      customerMobile?: string;
    }
  ): Promise<AffiliateEligibilityResult> {
    const email = normalizeEmail(params.customerEmail);
    const returnDays = store.settings.returnPeriodDays;
    const reasons: string[] = [];

    if (!store.settings.programEnabled) {
      reasons.push('The TeqqnoWorld Affiliate Partner Program is currently disabled.');
    }
    if (!store.settings.registrationOpen) {
      reasons.push('New affiliate partner registrations are currently closed.');
    }
    if (!email || !email.includes('@')) {
      reasons.push('Please sign in with a verified TeqqnoWorld customer email address.');
    }

    const existingPartner = store.partners.find((p) => normalizeEmail(p.customerEmail) === email);
    const latestApp = store.applications
      .filter((a) => normalizeEmail(a.customerEmail) === email)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (existingPartner) {
      if (existingPartner.status === 'active') {
        reasons.push('Your account is already an active TeqqnoWorld Affiliate Partner.');
      } else if (existingPartner.status === 'suspended') {
        reasons.push('Your affiliate partner account is currently suspended. Submit a reactivation request from your dashboard.');
      } else if (existingPartner.status === 'closed') {
        reasons.push('Your affiliate partner account has been closed and is not eligible to re-register.');
      }
    }

    if (
      latestApp &&
      !existingPartner &&
      ['submitted', 'under_review', 'kyc_pending', 'kyc_under_review', 'approved'].includes(latestApp.status)
    ) {
      reasons.push(`You already have an affiliate application in "${latestApp.status.replace(/_/g, ' ')}" status.`);
    }

    const deliveredOrders = email
      ? await fetchCustomerDeliveredOrders(store, email, params.customerMobile)
      : [];

    let qualifyingOrderId: string | null = null;
    let qualifyingDeliveredAt: string | null = null;
    let minRemainingDays = returnDays;

    for (const ord of deliveredOrders) {
      const elapsed = daysBetween(ord.deliveredAt);
      const remaining = Math.max(0, Math.ceil(returnDays - elapsed));
      if (remaining < minRemainingDays) {
        minRemainingDays = remaining;
      }
      if (elapsed >= returnDays && !qualifyingOrderId) {
        qualifyingOrderId = ord.orderId;
        qualifyingDeliveredAt = ord.deliveredAt;
      }
    }

    if (deliveredOrders.length === 0) {
      reasons.push(
        'You must be an existing TeqqnoWorld customer with at least one completed delivered order.'
      );
    } else if (!qualifyingOrderId) {
      reasons.push(
        `Your delivered order is still inside the ${returnDays}-day return period (${minRemainingDays} day(s) remaining).`
      );
    }

    return {
      eligible: reasons.length === 0,
      reasons,
      hasDeliveredOrder: deliveredOrders.length > 0,
      deliveredOrderCount: deliveredOrders.length,
      qualifyingOrderId,
      qualifyingDeliveredAt,
      returnPeriodDays: returnDays,
      returnPeriodRemainingDays: qualifyingOrderId ? 0 : deliveredOrders.length > 0 ? minRemainingDays : returnDays,
      existingApplicationStatus: latestApp?.status || null,
      existingPartnerStatus: existingPartner?.status || null,
      existingAffiliateId: existingPartner?.affiliateId || null,
    };
  }

  function resolveEffectiveProductCommission(
    productSetting: AffiliateProductSetting,
    atDate = new Date()
  ): {
    eligible: boolean;
    ratePct: number;
    rateSource: 'product_standard' | 'product_campaign';
  } {
    if (!productSetting.enabled) {
      return { eligible: false, ratePct: 0, rateSource: 'product_standard' };
    }
    const nowMs = atDate.getTime();
    if (productSetting.startDate) {
      const startMs = new Date(productSetting.startDate).getTime();
      if (Number.isFinite(startMs) && nowMs < startMs) {
        return { eligible: false, ratePct: 0, rateSource: 'product_standard' };
      }
    }
    if (productSetting.endDate) {
      const endMs = new Date(productSetting.endDate).getTime();
      if (Number.isFinite(endMs) && nowMs > endMs) {
        return { eligible: false, ratePct: 0, rateSource: 'product_standard' };
      }
    }
    if (
      productSetting.campaignRatePct !== null &&
      Number.isFinite(productSetting.campaignRatePct) &&
      productSetting.campaignRatePct > 0
    ) {
      return {
        eligible: true,
        ratePct: productSetting.campaignRatePct,
        rateSource: 'product_campaign',
      };
    }
    return {
      eligible: productSetting.commissionRatePct > 0,
      ratePct: productSetting.commissionRatePct,
      rateSource: 'product_standard',
    };
  }

  function releaseEligiblePendingCommissions(store: AffiliateStoreData, now = new Date()): number {
    let releasedCount = 0;
    for (const comm of store.commissions) {
      if (comm.status !== 'pending') continue;
      if (comm.orderStatus !== 'delivered' && comm.orderStatus !== 'partially_refunded') continue;
      if (!comm.returnPeriodEndsAt) continue;
      if (new Date(comm.returnPeriodEndsAt).getTime() > now.getTime()) continue;
      if (comm.fraudFlagId) {
        const flag = store.fraudFlags.find((f) => f.id === comm.fraudFlagId);
        if (flag && flag.status !== 'cleared') continue;
      }

      const partner = store.partners.find((p) => p.id === comm.partnerId);
      if (!partner || partner.status !== 'active') continue;
      const wallet = ensureWallet(store, partner);
      if (wallet.fundsHeld) continue;

      const amount = comm.commissionAmountPaisa;
      wallet.pendingPaisa = Math.max(0, wallet.pendingPaisa - amount);
      wallet.availablePaisa += amount;
      wallet.lifetimeEarnedPaisa += amount;
      wallet.updatedAt = now.toISOString();

      comm.status = 'available';
      comm.statusReason = 'Released after delivery and return period completion';
      comm.releasedAt = now.toISOString();
      comm.updatedAt = now.toISOString();

      appendLedgerEntry(store, {
        idempotencyKey: `release:${comm.id}`,
        partnerId: partner.id,
        affiliateId: partner.affiliateId,
        entryType: 'commission_available',
        amountPaisa: amount,
        bucket: 'available',
        balanceAfterPaisa: wallet.availablePaisa,
        referenceType: 'commission',
        referenceId: comm.id,
        description: `Commission released for order ${comm.orderNumberMasked} (${comm.productName})`,
        actor: 'system',
      });
      releasedCount += 1;
    }
    return releasedCount;
  }

  function buildLeaderboards(
    store: AffiliateStoreData,
    currentPartnerId?: string
  ): {
    monthly: AffiliateLeaderboardEntry[];
    yearly: AffiliateLeaderboardEntry[];
    allTime: AffiliateLeaderboardEntry[];
  } {
    const now = new Date();
    const curMonth = getMonthKey(now);
    const curYear = getYearKey(now);

    const buildForFilter = (
      predicate: (c: AffiliateCommissionRecord) => boolean
    ): AffiliateLeaderboardEntry[] => {
      const map = new Map<
        string,
        {
          partner: AffiliatePartnerRecord;
          orderIds: Set<string>;
          salesPaisa: number;
        }
      >();

      for (const comm of store.commissions) {
        // Leaderboard counts ONLY final qualified delivered orders after return period (available / paid)
        if (!['available', 'paid'].includes(comm.status)) continue;
        if (!predicate(comm)) continue;
        const partner = store.partners.find((p) => p.id === comm.partnerId);
        if (!partner || partner.status !== 'active') continue;

        const existing = map.get(partner.id) || {
          partner,
          orderIds: new Set<string>(),
          salesPaisa: 0,
        };
        existing.orderIds.add(comm.orderId);
        existing.salesPaisa += comm.gstInclusiveEligiblePaisa;
        map.set(partner.id, existing);
      }

      return Array.from(map.values())
        .sort((a, b) => {
          if (b.salesPaisa !== a.salesPaisa) return b.salesPaisa - a.salesPaisa;
          return b.orderIds.size - a.orderIds.size;
        })
        .slice(0, 25)
        .map((row, idx) => ({
          rank: idx + 1,
          affiliateId: row.partner.affiliateId,
          // Privacy-preserving public display name (First name + Last initial)
          partnerDisplayName: `${row.partner.firstName} ${row.partner.lastName.slice(0, 1).toUpperCase()}.`,
          qualifiedOrdersCount: row.orderIds.size,
          qualifiedSalesPaisa: row.salesPaisa,
          isCurrentPartner: row.partner.id === currentPartnerId,
        }));
    };

    return {
      monthly: buildForFilter((c) => (c.releasedAt || c.createdAt).startsWith(curMonth)),
      yearly: buildForFilter((c) => (c.releasedAt || c.createdAt).startsWith(curYear)),
      allTime: buildForFilter(() => true),
    };
  }

  function buildTargetProgressForPartner(
    store: AffiliateStoreData,
    partnerId: string
  ): AffiliateTargetProgress[] {
    const partnerComms = store.commissions.filter((c) => c.partnerId === partnerId);

    return store.targets
      .filter((t) => t.active)
      .map((target) => {
        const monthComms = partnerComms.filter((c) =>
          (c.deliveredAt || c.createdAt).startsWith(target.monthKey)
        );
        // Provisional = delivered orders (excluding cancelled/refunded/on_hold/under_review)
        const provisionalComms = monthComms.filter(
          (c) =>
            c.orderStatus === 'delivered' &&
            ['pending', 'available', 'paid'].includes(c.status)
        );
        // Final = completed return period (available or paid)
        const finalComms = monthComms.filter((c) =>
          ['available', 'paid'].includes(c.status)
        );

        const provisionalOrders = new Set(provisionalComms.map((c) => c.orderId)).size;
        const finalOrders = new Set(finalComms.map((c) => c.orderId)).size;
        const provisionalSales = provisionalComms.reduce(
          (s, c) => s + c.gstInclusiveEligiblePaisa,
          0
        );
        const finalSales = finalComms.reduce((s, c) => s + c.gstInclusiveEligiblePaisa, 0);

        const provisionalDeliveredValue =
          target.metricType === 'delivered_orders' ? provisionalOrders : provisionalSales;
        const finalQualifiedValue =
          target.metricType === 'delivered_orders' ? finalOrders : finalSales;

        const provisionalPct = Math.min(
          100,
          Math.round((provisionalDeliveredValue / Math.max(1, target.targetValue)) * 100)
        );
        const finalPct = Math.min(
          100,
          Math.round((finalQualifiedValue / Math.max(1, target.targetValue)) * 100)
        );

        return {
          ...target,
          provisionalDeliveredValue,
          finalQualifiedValue,
          provisionalPct,
          finalPct,
          achievedFinal: finalQualifiedValue >= target.targetValue,
        };
      });
  }

  function buildAnalyticsSeries(
    clicks: AffiliateClickRecord[],
    commissions: AffiliateCommissionRecord[],
    range: AffiliateAnalyticsRange,
    fromDate?: string,
    toDate?: string
  ) {
    const now = new Date();
    const buckets: Array<{
      key: string;
      label: string;
      startMs: number;
      endMs: number;
    }> = [];

    if (range === 'live') {
      for (let h = 23; h >= 0; h--) {
        const d = new Date(now.getTime() - h * 3600 * 1000);
        const start = new Date(d);
        start.setMinutes(0, 0, 0);
        const end = new Date(start.getTime() + 3600 * 1000 - 1);
        buckets.push({
          key: start.toISOString(),
          label: `${String(start.getHours()).padStart(2, '0')}:00`,
          startMs: start.getTime(),
          endMs: end.getTime(),
        });
      }
    } else if (range === 'daily' || range === 'weekly') {
      const days = range === 'daily' ? 7 : 28;
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - i);
        const end = new Date(d.getTime() + 86400000 - 1);
        buckets.push({
          key: d.toISOString().slice(0, 10),
          label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          startMs: d.getTime(),
          endMs: end.getTime(),
        });
      }
    } else if (range === 'monthly') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
        buckets.push({
          key: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
          label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
          startMs: d.getTime(),
          endMs: next.getTime() - 1,
        });
      }
    } else if (range === 'yearly') {
      for (let i = 4; i >= 0; i--) {
        const yr = now.getUTCFullYear() - i;
        const start = Date.UTC(yr, 0, 1);
        const end = Date.UTC(yr + 1, 0, 1) - 1;
        buckets.push({
          key: String(yr),
          label: String(yr),
          startMs: start,
          endMs: end,
        });
      }
    } else {
      const startDate = fromDate ? new Date(fromDate) : new Date(now.getTime() - 14 * 86400000);
      const endDate = toDate ? new Date(toDate) : now;
      const startDay = new Date(startDate);
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date(endDate);
      endDay.setHours(23, 59, 59, 999);
      const diffDays = Math.min(
        60,
        Math.max(1, Math.ceil((endDay.getTime() - startDay.getTime()) / 86400000))
      );
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(startDay.getTime() + i * 86400000);
        const e = new Date(d.getTime() + 86400000 - 1);
        buckets.push({
          key: d.toISOString().slice(0, 10),
          label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
          startMs: d.getTime(),
          endMs: e.getTime(),
        });
      }
    }

    return buckets.map((b) => {
      const bClicks = clicks.filter((c) => {
        const t = new Date(c.clickedAt).getTime();
        return t >= b.startMs && t <= b.endMs;
      }).length;
      const bComms = commissions.filter((c) => {
        const t = new Date(c.createdAt).getTime();
        return t >= b.startMs && t <= b.endMs && c.status !== 'cancelled';
      });
      const orders = new Set(bComms.map((c) => c.orderId)).size;
      const salesPaisa = bComms.reduce((s, c) => s + c.gstInclusiveEligiblePaisa, 0);
      const commissionPaisa = bComms.reduce((s, c) => s + c.commissionAmountPaisa, 0);
      return {
        label: b.label,
        clicks: bClicks,
        orders,
        salesPaisa,
        commissionPaisa,
      };
    });
  }

  function extractRequestPartnerEmail(req: Request): string {
    return normalizeEmail(
      req.headers['x-affiliate-email'] ||
        req.query.email ||
        (req.body && (req.body.customerEmail || req.body.email)) ||
        ''
    );
  }

  function resolveAuthorizedPartner(
    store: AffiliateStoreData,
    req: Request,
    explicitAffiliateId?: string
  ): { partner: AffiliatePartnerRecord | null; statusCode: number; error?: string } {
    const email = extractRequestPartnerEmail(req);
    if (!email) {
      return {
        partner: null,
        statusCode: 401,
        error: 'Please sign in to your TeqqnoWorld account to access the Affiliate Dashboard.',
      };
    }
    const partner = store.partners.find((p) => normalizeEmail(p.customerEmail) === email);
    if (!partner) {
      return {
        partner: null,
        statusCode: 404,
        error: 'No Affiliate Partner account found for this email address.',
      };
    }
    if (explicitAffiliateId && partner.affiliateId !== explicitAffiliateId && partner.id !== explicitAffiliateId) {
      return {
        partner: null,
        statusCode: 403,
        error: 'Access denied: you can only access your own affiliate partner account.',
      };
    }
    return { partner, statusCode: 200 };
  }

  function requireAdmin(req: Request, res: Response): boolean {
    if (!deps.verifyAdminRequest(req)) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized: valid TeqqnoWorld Admin session token required.',
      });
      return false;
    }
    return true;
  }

  // ============================================================================
  // 1. PUBLIC PROGRAM OVERVIEW & ELIGIBILITY
  // ============================================================================

  router.get('/affiliate/program', (_req: Request, res: Response) => {
    const store = loadStore();
    const enabledProductsCount = store.productSettings.filter((p) => p.enabled).length;
    const enabledRates = store.productSettings
      .filter((p) => p.enabled)
      .map((p) => resolveEffectiveProductCommission(p).ratePct)
      .filter((r) => r > 0);
    const maxRatePct = enabledRates.length ? Math.max(...enabledRates) : store.settings.defaultCommissionRatePct;
    const minRatePct = enabledRates.length ? Math.min(...enabledRates) : store.settings.defaultCommissionRatePct;

    return res.json({
      success: true,
      settings: store.settings,
      summary: {
        enabledProductsCount,
        minRatePct,
        maxRatePct,
        minWithdrawalInr: store.settings.minWithdrawalPaisa / 100,
        cookieDurationDays: store.settings.cookieDurationDays,
        returnPeriodDays: store.settings.returnPeriodDays,
        payoutProcessingWindow: `${store.settings.payoutProcessingDaysMin}–${store.settings.payoutProcessingDaysMax} working days`,
      },
    });
  });

  router.post('/affiliate/eligibility', async (req: Request, res: Response) => {
    try {
      const store = loadStore();
      const customerEmail = normalizeEmail(req.body?.customerEmail || req.body?.email);
      const customerMobile = normalizeMobile(req.body?.customerMobile || req.body?.mobile);
      const eligibility = await evaluateCustomerEligibility(store, {
        customerEmail,
        customerMobile,
      });
      const existingApp = store.applications
        .filter((a) => normalizeEmail(a.customerEmail) === customerEmail)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
      const existingKyc = existingApp
        ? toPublicMaskedKyc(
            store.kycRecords.find((k) => k.applicationId === existingApp.id) || null
          )
        : null;
      const existingPartner =
        store.partners.find((p) => normalizeEmail(p.customerEmail) === customerEmail) || null;

      return res.json({
        success: true,
        eligibility,
        application: existingApp,
        kyc: existingKyc,
        partner: existingPartner
          ? {
              affiliateId: existingPartner.affiliateId,
              status: existingPartner.status,
              fullName: existingPartner.fullName,
              joinedAt: existingPartner.joinedAt,
            }
          : null,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Unable to verify affiliate eligibility.',
      });
    }
  });

  // ============================================================================
  // 2. REGISTRATION, EMAIL OTP & APPLICATION SUBMISSION
  // ============================================================================

  router.post('/affiliate/applications/send-otp', async (req: Request, res: Response) => {
    try {
      const store = loadStore();
      const email = normalizeEmail(req.body?.email || req.body?.customerEmail);
      const firstName = sanitizePlainText(req.body?.firstName || 'Partner', 80);
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, error: 'Please provide a valid email address.' });
      }

      const now = new Date();
      const existing = store.otps[email];
      if (existing) {
        const secondsSinceLast = (now.getTime() - new Date(existing.lastSentAt).getTime()) / 1000;
        if (secondsSinceLast < 45) {
          return res.status(429).json({
            success: false,
            error: `Please wait ${Math.ceil(45 - secondsSinceLast)} seconds before requesting another OTP.`,
            cooldownSeconds: Math.ceil(45 - secondsSinceLast),
          });
        }
        const windowElapsedMin = (now.getTime() - new Date(existing.windowStartedAt).getTime()) / 60000;
        if (windowElapsedMin < 60 && existing.sendCountHour >= 5) {
          return res.status(429).json({
            success: false,
            error: 'OTP request limit reached for this hour. Please try again later.',
          });
        }
      }

      const code = String(crypto.randomInt(100000, 999999));
      const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
      const prevCount =
        existing && (now.getTime() - new Date(existing.windowStartedAt).getTime()) / 60000 < 60
          ? existing.sendCountHour
          : 0;

      store.otps[email] = {
        email,
        codeHash: hashOtpCode(email, code),
        expiresAt,
        attempts: 0,
        verifiedAt: null,
        lastSentAt: now.toISOString(),
        sendCountHour: prevCount + 1,
        windowStartedAt: prevCount === 0 ? now.toISOString() : existing.windowStartedAt,
      };
      saveStore(store);

      const emailDoc = buildAffiliateBrandedEmailHtml({
        badge: 'Email Verification OTP',
        heading: 'Verify your email for TeqqnoWorld Affiliate Program',
        greeting: `Hello ${firstName},`,
        bodyParagraphs: [
          'Use the 6-digit verification code below to verify your email address for your TeqqnoWorld Affiliate Partner application.',
          'This OTP is valid for 10 minutes. Never share this code with anyone.',
        ],
        highlightRows: [
          { label: 'Verification Code', value: code },
          { label: 'Valid For', value: '10 Minutes' },
        ],
      });

      await deps.sendAffiliateEmail({
        to: email,
        subject: `${code} is your TeqqnoWorld Affiliate verification code`,
        html: emailDoc.html,
        text: emailDoc.text,
      });

      const isNonProdNoSmtp =
        process.env.NODE_ENV !== 'production' && !process.env.HOSTINGER_SMTP_PASSWORD;

      return res.json({
        success: true,
        message: 'A 6-digit verification OTP has been sent to your email address.',
        expiresAt,
        cooldownSeconds: 45,
        ...(isNonProdNoSmtp ? { devPreviewOtp: code } : {}),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to send verification OTP.',
      });
    }
  });

  router.post('/affiliate/applications/verify-otp', (req: Request, res: Response) => {
    const store = loadStore();
    const email = normalizeEmail(req.body?.email || req.body?.customerEmail);
    const code = sanitizePlainText(req.body?.code || req.body?.otp, 10);

    const record = store.otps[email];
    if (!record) {
      return res.status(400).json({
        success: false,
        error: 'No OTP request found for this email. Please request a new code.',
      });
    }
    if (record.attempts >= 5) {
      return res.status(429).json({
        success: false,
        error: 'Too many invalid OTP attempts. Please request a new verification code.',
      });
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        error: 'This OTP has expired. Please request a fresh verification code.',
      });
    }
    if (hashOtpCode(email, code) !== record.codeHash) {
      record.attempts += 1;
      saveStore(store);
      return res.status(400).json({
        success: false,
        error: `Invalid OTP code (${5 - record.attempts} attempts remaining).`,
      });
    }

    record.verifiedAt = new Date().toISOString();
    saveStore(store);

    return res.json({
      success: true,
      emailVerified: true,
      verifiedAt: record.verifiedAt,
      message: 'Email verified successfully.',
    });
  });

  router.post('/affiliate/applications', async (req: Request, res: Response) => {
    try {
      const store = loadStore();
      const customerEmail = normalizeEmail(req.body?.email || req.body?.customerEmail);
      const firstName = sanitizePlainText(req.body?.firstName, 80);
      const lastName = sanitizePlainText(req.body?.lastName, 80);
      const mobile = normalizeMobile(req.body?.mobile);
      const companyName = sanitizePlainText(req.body?.companyName, 120);
      const customerUserId = sanitizePlainText(req.body?.customerUserId, 120) || undefined;
      const dateOfBirth = sanitizePlainText(req.body?.dateOfBirth, 20) || undefined;
      const isAdultConfirmed = Boolean(req.body?.isAdultConfirmed);
      const termsAccepted = Boolean(req.body?.termsAccepted);
      const privacyAccepted = Boolean(req.body?.privacyAccepted);
      const kycConsentAccepted = Boolean(req.body?.kycConsentAccepted);

      if (!firstName || !lastName) {
        return res.status(400).json({ success: false, error: 'First Name and Last Name are required.' });
      }
      if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
        return res.status(400).json({ success: false, error: 'A valid customer email is required.' });
      }
      if (mobile.length !== 10) {
        return res.status(400).json({ success: false, error: 'A valid 10-digit mobile number is required.' });
      }
      if (!isAdultConfirmed) {
        return res.status(400).json({
          success: false,
          error: 'You must confirm that you are at least 18 years old.',
        });
      }
      if (dateOfBirth) {
        const dobMs = new Date(dateOfBirth).getTime();
        if (Number.isFinite(dobMs)) {
          const ageYears = (Date.now() - dobMs) / (365.25 * 24 * 3600 * 1000);
          if (ageYears < 18) {
            return res.status(400).json({
              success: false,
              error: 'Applicants must be at least 18 years old to join the Affiliate Partner Program.',
            });
          }
        }
      }
      if (!termsAccepted || !privacyAccepted || !kycConsentAccepted) {
        return res.status(400).json({
          success: false,
          error: 'You must accept the Affiliate Program Terms, Privacy Policy, and KYC & Bank Verification Consent.',
        });
      }

      // Server-side Email OTP verification enforcement
      const otpRec = store.otps[customerEmail];
      if (!otpRec || !otpRec.verifiedAt) {
        return res.status(400).json({
          success: false,
          error: 'Email verification via OTP is required before submitting your application.',
        });
      }

      // Server-authoritative eligibility check
      const eligibility = await evaluateCustomerEligibility(store, {
        customerEmail,
        customerMobile: mobile,
      });
      if (!eligibility.eligible) {
        return res.status(403).json({
          success: false,
          error: eligibility.reasons[0] || 'You are not currently eligible for the Affiliate Partner Program.',
          eligibility,
        });
      }

      const previousApps = store.applications.filter(
        (a) => normalizeEmail(a.customerEmail) === customerEmail
      );
      const lastRejected = previousApps
        .filter((a) => a.status === 'rejected')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      const now = new Date().toISOString();
      const appRecord: AffiliateApplicationRecord = {
        id: crypto.randomUUID(),
        customerUserId,
        customerEmail,
        firstName,
        lastName,
        mobile,
        companyName: companyName || undefined,
        dateOfBirth,
        isAdultConfirmed: true,
        qualifyingOrderId: eligibility.qualifyingOrderId,
        qualifyingDeliveredAt: eligibility.qualifyingDeliveredAt,
        emailVerified: true,
        emailVerifiedAt: otpRec.verifiedAt,
        termsAccepted: true,
        termsVersion: store.settings.termsVersion,
        termsAcceptedAt: now,
        privacyAccepted: true,
        privacyVersion: store.settings.privacyVersion,
        privacyAcceptedAt: now,
        kycConsentAccepted: true,
        kycConsentVersion: store.settings.kycConsentVersion,
        kycConsentAcceptedAt: now,
        status: 'submitted',
        rejectionReason: null,
        adminNotes: null,
        reviewedBy: null,
        reviewedAt: null,
        reapplyCount: previousApps.length,
        previousApplicationId: lastRejected?.id || null,
        createdAt: now,
        updatedAt: now,
      };

      store.applications.unshift(appRecord);
      appendAudit(store, 'affiliate', customerEmail, 'application_submitted', 'application', appRecord.id, {
        qualifyingOrderId: eligibility.qualifyingOrderId,
        reapplyCount: appRecord.reapplyCount,
      });

      await notifyPartnerAndEmail(store, {
        eventKey: `app-submitted:${appRecord.id}`,
        recipientEmail: customerEmail,
        recipientName: `${firstName} ${lastName}`,
        category: 'application',
        title: 'Affiliate Partner Application Received',
        message:
          'We have received your TeqqnoWorld Affiliate Partner application. Please proceed to submit your KYC and Bank verification details so our team can review and activate your partner account.',
        highlightRows: [
          { label: 'Applicant', value: `${firstName} ${lastName}` },
          { label: 'Application Status', value: 'Submitted' },
          { label: 'Next Step', value: 'Complete KYC & Bank Details' },
        ],
        ctaLabel: 'Continue KYC Verification',
        ctaUrl: `${store.settings.officialDomain}/affiliate-program`,
        notifyAdmins: true,
      });

      saveStore(store);

      return res.status(201).json({
        success: true,
        application: appRecord,
        message: 'Application submitted successfully. Please complete KYC and Bank verification next.',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Unable to submit affiliate application.',
      });
    }
  });

  // ============================================================================
  // 3. KYC & BANK VERIFICATION SUBMISSION (AES-256-GCM ENCRYPTED AT REST)
  // ============================================================================

  router.post('/affiliate/kyc/upload-doc', (req: Request, res: Response) => {
    try {
      const customerEmail = extractRequestPartnerEmail(req);
      const docType = sanitizePlainText(req.body?.docType, 32);
      const fileName = sanitizePlainText(req.body?.fileName || 'document', 120);
      const dataUrl = String(req.body?.dataUrl || '');

      if (!customerEmail) {
        return res.status(401).json({ success: false, error: 'Customer authentication required.' });
      }
      if (!['aadhaar', 'pan', 'bank_proof'].includes(docType)) {
        return res.status(400).json({ success: false, error: 'Invalid KYC document type.' });
      }
      const match = dataUrl.match(/^data:(image\/jpeg|image\/png|application\/pdf);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) {
        return res.status(400).json({
          success: false,
          error: 'Only JPG, PNG, or PDF documents are allowed.',
        });
      }

      const mime = match[1];
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > 10 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: 'Document exceeds the 10 MB maximum file size limit.',
        });
      }

      const ext = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
      const storedName = `${docType}-${crypto.randomUUID()}.${ext}`;
      const targetPath = path.resolve(kycDir, storedName);
      if (!targetPath.startsWith(path.resolve(kycDir))) {
        return res.status(400).json({ success: false, error: 'Invalid upload destination.' });
      }
      fs.writeFileSync(targetPath, buffer);

      return res.status(201).json({
        success: true,
        storedRef: storedName,
        displayName: fileName,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to upload KYC document.',
      });
    }
  });

  router.post('/affiliate/kyc', async (req: Request, res: Response) => {
    try {
      const store = loadStore();
      const customerEmail = extractRequestPartnerEmail(req);
      const applicationId = sanitizePlainText(req.body?.applicationId, 80);
      const aadhaarNumber = sanitizePlainText(req.body?.aadhaarNumber, 24);
      const panNumber = sanitizePlainText(req.body?.panNumber, 16).toUpperCase();
      const bankAccountHolderName = sanitizePlainText(req.body?.bankAccountHolderName, 120);
      const bankAccountNumber = sanitizePlainText(req.body?.bankAccountNumber, 32);
      const bankIfscCode = sanitizePlainText(req.body?.bankIfscCode, 16).toUpperCase();
      const bankName = sanitizePlainText(req.body?.bankName, 120);
      const aadhaarDocRef = sanitizePlainText(req.body?.aadhaarDocRef, 140) || null;
      const panDocRef = sanitizePlainText(req.body?.panDocRef, 140) || null;
      const bankProofDocRef = sanitizePlainText(req.body?.bankProofDocRef, 140) || null;
      const aadhaarDocName = sanitizePlainText(req.body?.aadhaarDocName, 120) || null;
      const panDocName = sanitizePlainText(req.body?.panDocName, 120) || null;
      const bankProofDocName = sanitizePlainText(req.body?.bankProofDocName, 120) || null;

      if (!customerEmail) {
        return res.status(401).json({ success: false, error: 'Authentication required.' });
      }
      const application = store.applications.find(
        (a) =>
          (applicationId ? a.id === applicationId : true) &&
          normalizeEmail(a.customerEmail) === customerEmail
      );
      if (!application) {
        return res.status(404).json({
          success: false,
          error: 'No affiliate application found for this account.',
        });
      }

      if (!isValidAadhaar(aadhaarNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid 12-digit Aadhaar number.',
        });
      }
      if (!isValidPan(panNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid 10-character PAN number (e.g., ABCDE1234F).',
        });
      }
      if (!bankAccountHolderName) {
        return res.status(400).json({
          success: false,
          error: 'Bank Account Holder Name is required.',
        });
      }
      if (!isValidBankAccount(bankAccountNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid bank account number (9–18 digits).',
        });
      }
      if (!isValidIfsc(bankIfscCode)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid 11-character IFSC code (e.g., HDFC0001234).',
        });
      }

      const aadhaarDigits = aadhaarNumber.replace(/\D/g, '');
      const accountDigits = bankAccountNumber.replace(/\D/g, '');
      const aadhaarHash = hashSensitiveIdentifier(aadhaarDigits);
      const panHash = hashSensitiveIdentifier(panNumber);
      const bankAccountHash = hashSensitiveIdentifier(accountDigits);

      // Duplicate KYC / identity reuse check across distinct customer emails
      const duplicateKyc = store.kycRecords.find(
        (k) =>
          normalizeEmail(k.customerEmail) !== customerEmail &&
          (k.aadhaarHash === aadhaarHash || k.panHash === panHash)
      );
      if (duplicateKyc) {
        store.fraudFlags.unshift({
          id: crypto.randomUUID(),
          partnerId: null,
          affiliateId: null,
          flagType: 'duplicate_kyc',
          severity: 'high',
          orderId: null,
          commissionId: null,
          details: `Duplicate Aadhaar/PAN hash detected during KYC submission by ${customerEmail}.`,
          status: 'open',
          resolutionNotes: null,
          resolvedBy: null,
          resolvedAt: null,
          createdAt: new Date().toISOString(),
        });
      }

      const now = new Date().toISOString();
      const existingIdx = store.kycRecords.findIndex((k) => k.applicationId === application.id);
      const record: InternalKycRecord = {
        id: existingIdx >= 0 ? store.kycRecords[existingIdx].id : crypto.randomUUID(),
        applicationId: application.id,
        partnerId: existingIdx >= 0 ? store.kycRecords[existingIdx].partnerId : null,
        customerEmail,
        aadhaarMasked: maskAadhaarNumber(aadhaarDigits),
        aadhaarEncrypted: encryptAffiliateSecret(aadhaarDigits),
        aadhaarHash,
        panMasked: maskPanNumber(panNumber),
        panEncrypted: encryptAffiliateSecret(panNumber),
        panHash,
        bankAccountHolderName,
        bankAccountMasked: maskBankAccountNumber(accountDigits),
        bankAccountEncrypted: encryptAffiliateSecret(accountDigits),
        bankAccountHash,
        bankIfscCode,
        bankName: bankName || 'Indian Bank Account',
        aadhaarDocName,
        panDocName,
        bankProofDocName,
        aadhaarDocPath: aadhaarDocRef,
        panDocPath: panDocRef,
        bankProofDocPath: bankProofDocRef,
        kycStatus: 'under_review',
        kycRejectionReason: null,
        kycVerifiedAt: null,
        kycVerifiedBy: null,
        bankVerificationStatus: 'under_review',
        bankVerificationMethod: null,
        pennyDropStatus: null,
        pennyDropReference: null,
        bankRejectionReason: null,
        bankVerifiedAt: null,
        bankVerifiedBy: null,
        submittedAt: now,
        updatedAt: now,
      };

      if (existingIdx >= 0) {
        store.kycRecords[existingIdx] = record;
      } else {
        store.kycRecords.unshift(record);
      }

      application.status = 'kyc_under_review';
      application.updatedAt = now;

      appendAudit(store, 'affiliate', customerEmail, 'kyc_submitted', 'kyc', record.id, {
        applicationId: application.id,
        duplicateFlagged: Boolean(duplicateKyc),
      });

      await notifyPartnerAndEmail(store, {
        eventKey: `kyc-submitted:${record.id}:${now.slice(0, 16)}`,
        recipientEmail: customerEmail,
        recipientName: `${application.firstName} ${application.lastName}`,
        category: 'kyc',
        title: 'KYC & Bank Verification Submitted',
        message:
          'Your KYC and Bank details have been encrypted and submitted for TeqqnoWorld admin verification. You will be notified as soon as verification is completed.',
        highlightRows: [
          { label: 'Masked Aadhaar', value: record.aadhaarMasked },
          { label: 'Masked PAN', value: record.panMasked },
          { label: 'Masked Bank Account', value: `${record.bankAccountMasked} (${record.bankIfscCode})` },
        ],
        notifyAdmins: true,
      });

      saveStore(store);

      return res.status(201).json({
        success: true,
        kyc: toPublicMaskedKyc(record),
        applicationStatus: application.status,
        message: 'KYC and Bank details submitted securely for admin review.',
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Unable to submit KYC details.',
      });
    }
  });

  // ============================================================================
  // 4. PUBLIC CLICK TRACKING & LAST-CLICK ATTRIBUTION
  // ============================================================================

  router.post('/affiliate/track-click', (req: Request, res: Response) => {
    try {
      const store = loadStore();
      if (!store.settings.programEnabled || store.settings.programPaused) {
        return res.json({ success: false, attributed: false, reason: 'Program paused or disabled.' });
      }

      const referralToken = sanitizePlainText(req.body?.ref || req.body?.referralToken, 64);
      const landingPath = sanitizePlainText(req.body?.landingPath || '/', 240);
      const productId = sanitizePlainText(req.body?.productId, 80) || null;
      const productSlug = sanitizePlainText(req.body?.productSlug, 140) || null;
      const trafficSource = sanitizePlainText(req.body?.trafficSource || 'direct', 60);
      const campaign = sanitizePlainText(req.body?.campaign || '', 80) || null;
      const customerEmail = normalizeEmail(req.body?.customerEmail || '') || null;
      const customerUserId = sanitizePlainText(req.body?.customerUserId || '', 80) || null;

      if (!referralToken) {
        return res.status(400).json({ success: false, error: 'Referral token is required.' });
      }

      const partner = store.partners.find((p) => p.referralToken === referralToken);
      if (!partner || partner.status !== 'active') {
        return res.json({
          success: false,
          attributed: false,
          reason: 'Affiliate link is inactive, suspended, or closed.',
        });
      }

      // Check matching link record (website or product)
      const matchingLink = store.links.find(
        (l) =>
          l.partnerId === partner.id &&
          ((productId && l.productId === productId) ||
            (productSlug && l.productSlug === productSlug) ||
            (!productId && !productSlug && l.linkType === 'website'))
      );

      if (matchingLink && matchingLink.status !== 'active') {
        return res.json({
          success: false,
          attributed: false,
          reason: 'This affiliate link is currently paused or disabled.',
        });
      }

      const { deviceType, browser } = parseUserAgentInfo(req.headers['user-agent']);
      const now = new Date();
      const nowIso = now.toISOString();

      // Detect rapid burst click spam (> 25 clicks in 5 minutes for same partner)
      const fiveMinAgo = now.getTime() - 5 * 60 * 1000;
      const recentBurstCount = store.clicks.filter(
        (c) => c.partnerId === partner.id && new Date(c.clickedAt).getTime() >= fiveMinAgo
      ).length;
      const isSuspicious = recentBurstCount >= 25;

      const productSetting = productId
        ? store.productSettings.find((p) => p.productId === productId)
        : productSlug
        ? store.productSettings.find((p) => p.productSlug === productSlug)
        : null;

      const clickRecord: AffiliateClickRecord = {
        id: crypto.randomUUID(),
        partnerId: partner.id,
        affiliateId: partner.affiliateId,
        linkId: matchingLink?.id || null,
        referralToken,
        landingPath,
        productId: productSetting?.productId || productId,
        productSlug: productSetting?.productSlug || productSlug,
        productName: productSetting?.productName || null,
        deviceType,
        browser,
        trafficSource,
        campaign,
        isSuspicious,
        suspiciousReason: isSuspicious ? 'Rapid click burst detected (>25 clicks in 5 minutes)' : null,
        clickedAt: nowIso,
      };
      store.clicks.unshift(clickRecord);
      if (store.clicks.length > 10000) store.clicks.length = 10000;

      if (matchingLink) {
        matchingLink.clicksCount += 1;
        matchingLink.updatedAt = nowIso;
      }

      if (isSuspicious && recentBurstCount === 25) {
        store.fraudFlags.unshift({
          id: crypto.randomUUID(),
          partnerId: partner.id,
          affiliateId: partner.affiliateId,
          flagType: 'suspicious_click_burst',
          severity: 'medium',
          orderId: null,
          commissionId: null,
          details: `Click burst threshold reached (${recentBurstCount + 1} clicks within 5 minutes) for ${partner.affiliateId}.`,
          status: 'open',
          resolutionNotes: null,
          resolvedBy: null,
          resolvedAt: null,
          createdAt: nowIso,
        });
      }

      // Last-Click Attribution: overwrite existing cookie ID or create new one
      const cookies = parseCookiesHeader(req.headers.cookie);
      const cookieId = cookies[AFFILIATE_COOKIE_NAME] || crypto.randomUUID();
      const ttlMs = store.settings.cookieDurationDays * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

      const existingAttrIdx = store.attributions.findIndex((a) => a.cookieId === cookieId);
      const newAttr: InternalAttributionRecord = {
        cookieId,
        partnerId: partner.id,
        affiliateId: partner.affiliateId,
        referralToken,
        lastClickId: clickRecord.id,
        customerEmail,
        customerUserId,
        landingPath,
        productId: clickRecord.productId,
        campaign,
        attributedAt: nowIso,
        expiresAt,
      };
      if (existingAttrIdx >= 0) {
        store.attributions[existingAttrIdx] = newAttr;
      } else {
        store.attributions.unshift(newAttr);
      }

      // Also bind last-click attribution to signed-in customer email for cross-device accuracy
      if (customerEmail) {
        const emailAttrIdx = store.attributions.findIndex(
          (a) => a.cookieId !== cookieId && normalizeEmail(a.customerEmail || '') === customerEmail
        );
        if (emailAttrIdx >= 0) {
          store.attributions[emailAttrIdx] = {
            ...newAttr,
            cookieId: store.attributions[emailAttrIdx].cookieId,
          };
        }
      }

      saveStore(store);

      const isSecure =
        req.secure ||
        String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https' ||
        process.env.NODE_ENV === 'production';

      res.cookie(AFFILIATE_COOKIE_NAME, cookieId, {
        httpOnly: true,
        secure: isSecure,
        sameSite: isSecure ? 'none' : 'lax',
        maxAge: ttlMs,
        path: '/',
      });

      return res.json({
        success: true,
        attributed: true,
        affiliateId: partner.affiliateId,
        cookieDurationDays: store.settings.cookieDurationDays,
        expiresAt,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err?.message || 'Failed to record referral click.',
      });
    }
  });

  // ============================================================================
  // 5. ORDER ATTRIBUTION & COMMISSION CALCULATION ENGINE (SERVER-AUTHORITATIVE)
  // ============================================================================

  router.post('/affiliate/orders/attribute', async (req: Request, res: Response) => {
    return withFinancialLock(async () => {
      try {
        const store = loadStore();
        if (!store.settings.programEnabled || store.settings.programPaused) {
          return res.json({ success: true, attributed: false, reason: 'Program paused or disabled.' });
        }

        const orderId = sanitizePlainText(req.body?.orderId, 100);
        const orderNumber = sanitizePlainText(req.body?.orderNumber || orderId, 60);
        const buyerEmail = normalizeEmail(req.body?.customerEmail);
        const buyerMobile = normalizeMobile(req.body?.customerMobile);
        const buyerUserId = sanitizePlainText(req.body?.customerUserId, 100) || null;
        const shippingInr = Number(req.body?.shippingInr || 0);
        const items = Array.isArray(req.body?.items) ? req.body.items : [];

        if (!orderId || items.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'orderId and non-empty items array are required.',
          });
        }

        // Resolve last-click attribution from HttpOnly cookie first, then customer email binding
        const cookies = parseCookiesHeader(req.headers.cookie);
        const cookieId = cookies[AFFILIATE_COOKIE_NAME];
        const nowMs = Date.now();

        let attribution: InternalAttributionRecord | undefined;
        if (cookieId) {
          attribution = store.attributions.find(
            (a) => a.cookieId === cookieId && new Date(a.expiresAt).getTime() >= nowMs
          );
        }
        if (!attribution && buyerEmail) {
          attribution = store.attributions
            .filter(
              (a) =>
                normalizeEmail(a.customerEmail || '') === buyerEmail &&
                new Date(a.expiresAt).getTime() >= nowMs
            )
            .sort(
              (a, b) => new Date(b.attributedAt).getTime() - new Date(a.attributedAt).getTime()
            )[0];
        }
        // Optional explicit referralToken override only if cookie not present in API-to-API server calls
        if (!attribution && req.body?.referralToken) {
          const refTok = sanitizePlainText(req.body.referralToken, 64);
          const refPartner = store.partners.find(
            (p) => p.referralToken === refTok && p.status === 'active'
          );
          if (refPartner) {
            attribution = {
              cookieId: 'direct-token',
              partnerId: refPartner.id,
              affiliateId: refPartner.affiliateId,
              referralToken: refPartner.referralToken,
              lastClickId: null,
              customerEmail: buyerEmail || null,
              customerUserId: buyerUserId,
              landingPath: '/',
              productId: null,
              campaign: null,
              attributedAt: new Date().toISOString(),
              expiresAt: new Date(
                nowMs + store.settings.cookieDurationDays * 86400000
              ).toISOString(),
            };
          }
        }

        if (!attribution) {
          return res.json({
            success: true,
            attributed: false,
            reason: 'No active referral attribution window found.',
          });
        }

        const partner = store.partners.find((p) => p.id === attribution!.partnerId);
        if (!partner || partner.status !== 'active') {
          return res.json({
            success: true,
            attributed: false,
            reason: 'Attributed affiliate partner is not active.',
          });
        }

        // SELF-REFERRAL PREVENTION (authenticated email / userId / mobile identity — NEVER IP alone)
        const isSelfReferral =
          (buyerEmail && normalizeEmail(partner.customerEmail) === buyerEmail) ||
          (buyerUserId && partner.customerUserId && partner.customerUserId === buyerUserId) ||
          (buyerMobile && normalizeMobile(partner.mobile) === buyerMobile);

        if (isSelfReferral) {
          const flag: AffiliateFraudFlagRecord = {
            id: crypto.randomUUID(),
            partnerId: partner.id,
            affiliateId: partner.affiliateId,
            flagType: 'self_referral',
            severity: 'high',
            orderId,
            commissionId: null,
            details: `Self-referral purchase blocked automatically for partner ${partner.affiliateId} on order ${maskOrderReference(orderNumber)}.`,
            status: 'open',
            resolutionNotes: null,
            resolvedBy: null,
            resolvedAt: null,
            createdAt: new Date().toISOString(),
          };
          store.fraudFlags.unshift(flag);
          appendAudit(store, 'system', 'self-referral-guard', 'self_referral_blocked', 'order', orderId, {
            affiliateId: partner.affiliateId,
            flagId: flag.id,
          });
          await notifyPartnerAndEmail(store, {
            eventKey: `self-ref:${orderId}:${partner.id}`,
            partner,
            recipientEmail: partner.customerEmail,
            recipientName: partner.fullName,
            category: 'fraud',
            title: 'Self-Referral Commission Blocked',
            message: `Order ${maskOrderReference(orderNumber)} was detected as a self-referral purchase. Per TeqqnoWorld Affiliate Program rules, self-referrals do not qualify for affiliate commission.`,
            notifyAdmins: true,
          });
          saveStore(store);

          return res.json({
            success: true,
            attributed: false,
            selfReferralBlocked: true,
            reason: 'Self-referral orders are not eligible for affiliate commission.',
          });
        }

        const wallet = ensureWallet(store, partner);
        const nowIso = new Date().toISOString();
        const createdCommissions: AffiliateCommissionRecord[] = [];
        const maskedOrderNum = maskOrderReference(orderNumber);

        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const productId = sanitizePlainText(item.productId, 80);
          const orderItemId = sanitizePlainText(item.orderItemId || `${orderId}-item-${idx + 1}`, 120);
          const quantity = Math.max(1, Math.round(Number(item.quantity || 1)));

          const prodSetting = store.productSettings.find((p) => p.productId === productId);
          if (!prodSetting) continue;

          const effective = resolveEffectiveProductCommission(prodSetting, new Date());
          if (!effective.eligible) continue;

          const idempotencyKey = `order-item:${orderId}:${orderItemId}:${partner.id}`;
          if (store.commissions.some((c) => c.idempotencyKey === idempotencyKey)) {
            continue;
          }

          // Financial Basis: GST-inclusive discounted eligible product amount, shipping strictly excluded
          const grossInr = Number(item.grossGstInclusiveInr ?? item.gstInclusiveAmountInr ?? 0);
          const discountInr = Number(item.discountInr ?? 0);
          const explicitEligibleInr =
            item.gstInclusiveDiscountedAmountInr !== undefined
              ? Number(item.gstInclusiveDiscountedAmountInr)
              : Math.max(0, grossInr - discountInr);

          const grossPaisa = inrToPaisa(grossInr || explicitEligibleInr + discountInr);
          const discountPaisa = inrToPaisa(discountInr);
          const eligiblePaisa = inrToPaisa(explicitEligibleInr);
          const shippingExcludedPaisa = idx === 0 ? inrToPaisa(shippingInr) : 0;

          if (eligiblePaisa <= 0) continue;

          const commissionPaisa = calculateCommissionPaisa(eligiblePaisa, effective.ratePct);
          if (commissionPaisa <= 0) continue;

          const commRecord: AffiliateCommissionRecord = {
            id: crypto.randomUUID(),
            idempotencyKey,
            partnerId: partner.id,
            affiliateId: partner.affiliateId,
            orderId,
            orderNumberMasked: maskedOrderNum,
            orderItemId,
            productId: prodSetting.productId,
            productName: prodSetting.productName,
            quantity,
            refundedQuantity: 0,
            grossItemAmountPaisa: grossPaisa,
            discountAmountPaisa: discountPaisa,
            gstInclusiveEligiblePaisa: eligiblePaisa,
            shippingExcludedPaisa,
            commissionRatePctSnapshot: effective.ratePct,
            commissionRateSource: effective.rateSource,
            commissionAmountPaisa: commissionPaisa,
            originalCommissionPaisa: commissionPaisa,
            orderStatus: 'placed',
            status: 'pending',
            statusReason: 'Awaiting order delivery and return period completion',
            deliveredAt: null,
            returnPeriodDaysSnapshot: store.settings.returnPeriodDays,
            returnPeriodEndsAt: null,
            releasedAt: null,
            paidAt: null,
            fraudFlagId: null,
            createdAt: nowIso,
            updatedAt: nowIso,
          };

          store.commissions.unshift(commRecord);
          createdCommissions.push(commRecord);

          wallet.pendingPaisa += commissionPaisa;
          wallet.updatedAt = nowIso;

          appendLedgerEntry(store, {
            idempotencyKey: `pending:${commRecord.id}`,
            partnerId: partner.id,
            affiliateId: partner.affiliateId,
            entryType: 'commission_pending',
            amountPaisa: commissionPaisa,
            bucket: 'pending',
            balanceAfterPaisa: wallet.pendingPaisa,
            referenceType: 'commission',
            referenceId: commRecord.id,
            description: `Pending commission (${effective.ratePct}%) on order ${maskedOrderNum} — ${prodSetting.productName}`,
            actor: 'system',
          });

          // Update link stats
          const linkMatch =
            store.links.find((l) => l.partnerId === partner.id && l.productId === productId) ||
            store.links.find((l) => l.partnerId === partner.id && l.linkType === 'website');
          if (linkMatch) {
            linkMatch.ordersCount += 1;
            linkMatch.commissionEarnedPaisa += commissionPaisa;
            linkMatch.updatedAt = nowIso;
          }
        }

        if (createdCommissions.length > 0) {
          const totalCommPaisa = createdCommissions.reduce(
            (s, c) => s + c.commissionAmountPaisa,
            0
          );
          await notifyPartnerAndEmail(store, {
            eventKey: `new-referral:${orderId}:${partner.id}`,
            partner,
            recipientEmail: partner.customerEmail,
            recipientName: partner.fullName,
            category: 'order',
            title: 'New Referred Order Recorded',
            message: `Great news! A customer placed referred order ${maskedOrderNum}. Your pending commission of ${formatInrFromPaisa(totalCommPaisa)} will move to Available balance once the order is delivered and the ${store.settings.returnPeriodDays}-day return period finishes.`,
            highlightRows: [
              { label: 'Order Reference', value: maskedOrderNum },
              { label: 'Eligible Items', value: String(createdCommissions.length) },
              { label: 'Pending Commission', value: formatInrFromPaisa(totalCommPaisa) },
            ],
          });
        }

        saveStore(store);

        return res.status(201).json({
          success: true,
          attributed: createdCommissions.length > 0,
          affiliateId: partner.affiliateId,
          commissionsCreated: createdCommissions.length,
          totalPendingCommissionPaisa: createdCommissions.reduce(
            (s, c) => s + c.commissionAmountPaisa,
            0
          ),
          commissions: createdCommissions,
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          error: err?.message || 'Failed to process order attribution.',
        });
      }
    });
  });

  // Order Lifecycle Hook (Admin or server internal call: delivered, cancelled, full_refund, partial_refund, release_due)
  router.post('/affiliate/orders/lifecycle', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;

    return withFinancialLock(async () => {
      try {
        const store = loadStore();
        const event = sanitizePlainText(req.body?.event, 40);
        const orderId = sanitizePlainText(req.body?.orderId, 100);
        const now = new Date();
        const nowIso = now.toISOString();

        // Also record delivered order in mirror for customer eligibility verification
        if (event === 'delivered' && req.body?.customerEmail) {
          const deliveredAt = sanitizePlainText(req.body?.deliveredAt, 40) || nowIso;
          const existingMirror = store.deliveredOrderMirror.find((o) => o.orderId === orderId);
          if (!existingMirror) {
            store.deliveredOrderMirror.push({
              orderId,
              customerEmail: normalizeEmail(req.body.customerEmail),
              customerMobile: normalizeMobile(req.body.customerMobile || ''),
              status: 'delivered',
              deliveredAt,
            });
          } else {
            existingMirror.status = 'delivered';
            existingMirror.deliveredAt = deliveredAt;
          }
        }

        if (event === 'release_due') {
          const released = releaseEligiblePendingCommissions(store, now);
          saveStore(store);
          return res.json({ success: true, releasedCount: released });
        }

        const orderComms = store.commissions.filter((c) => c.orderId === orderId);
        if (orderComms.length === 0) {
          saveStore(store);
          return res.json({
            success: true,
            updatedCount: 0,
            message: 'No affiliate commissions associated with this order.',
          });
        }

        let updatedCount = 0;

        for (const comm of orderComms) {
          const partner = store.partners.find((p) => p.id === comm.partnerId);
          if (!partner) continue;
          const wallet = ensureWallet(store, partner);

          if (event === 'delivered') {
            const deliveredAtIso = sanitizePlainText(req.body?.deliveredAt, 40) || nowIso;
            const deliveredDate = new Date(deliveredAtIso);
            const endsAt = new Date(
              deliveredDate.getTime() + comm.returnPeriodDaysSnapshot * 86400000
            ).toISOString();
            comm.orderStatus = 'delivered';
            comm.deliveredAt = deliveredAtIso;
            comm.returnPeriodEndsAt = endsAt;
            comm.statusReason = `Delivered; scheduled for release after ${comm.returnPeriodDaysSnapshot}-day return period`;
            comm.updatedAt = nowIso;
            updatedCount += 1;
          } else if (event === 'cancelled') {
            comm.orderStatus = 'cancelled';
            if (comm.status === 'pending' || comm.status === 'on_hold') {
              const prevAmt = comm.commissionAmountPaisa;
              wallet.pendingPaisa = Math.max(0, wallet.pendingPaisa - prevAmt);
              wallet.updatedAt = nowIso;
              comm.status = 'cancelled';
              comm.commissionAmountPaisa = 0;
              comm.statusReason = 'Order cancelled prior to delivery';
              comm.updatedAt = nowIso;
              appendLedgerEntry(store, {
                idempotencyKey: `cancel:${comm.id}`,
                partnerId: partner.id,
                affiliateId: partner.affiliateId,
                entryType: 'commission_cancelled',
                amountPaisa: -prevAmt,
                bucket: 'pending',
                balanceAfterPaisa: wallet.pendingPaisa,
                referenceType: 'commission',
                referenceId: comm.id,
                description: `Commission cancelled due to order ${comm.orderNumberMasked} cancellation`,
                actor: 'admin',
              });
              await notifyPartnerAndEmail(store, {
                eventKey: `comm-cancelled:${comm.id}`,
                partner,
                recipientEmail: partner.customerEmail,
                recipientName: partner.fullName,
                category: 'commission',
                title: 'Commission Cancelled Due to Order Cancellation',
                message: `Order ${comm.orderNumberMasked} (${comm.productName}) was cancelled, so the pending commission of ${formatInrFromPaisa(prevAmt)} has been reversed.`,
              });
              updatedCount += 1;
            }
          } else if (event === 'full_refund') {
            comm.orderStatus = 'refunded';
            comm.refundedQuantity = comm.quantity;
            if (comm.status === 'paid') {
              // Already paid — NEVER create negative balance or silently delete; flag for admin review
              comm.status = 'under_review';
              comm.statusReason = 'Full refund occurred after commission payout; flagged for admin review';
              comm.updatedAt = nowIso;
              store.fraudFlags.unshift({
                id: crypto.randomUUID(),
                partnerId: partner.id,
                affiliateId: partner.affiliateId,
                flagType: 'repeated_refund_pattern',
                severity: 'medium',
                orderId: comm.orderId,
                commissionId: comm.id,
                details: `Full refund processed on already-paid commission (${formatInrFromPaisa(comm.commissionAmountPaisa)}) for order ${comm.orderNumberMasked}. Admin review required.`,
                status: 'open',
                resolutionNotes: null,
                resolvedBy: null,
                resolvedAt: null,
                createdAt: nowIso,
              });
              updatedCount += 1;
            } else if (comm.status === 'pending' || comm.status === 'on_hold' || comm.status === 'available') {
              const prevAmt = comm.commissionAmountPaisa;
              const bucket = comm.status === 'available' ? 'available' : 'pending';
              if (bucket === 'available') {
                wallet.availablePaisa = Math.max(0, wallet.availablePaisa - prevAmt);
              } else {
                wallet.pendingPaisa = Math.max(0, wallet.pendingPaisa - prevAmt);
              }
              wallet.updatedAt = nowIso;
              comm.status = 'cancelled';
              comm.commissionAmountPaisa = 0;
              comm.statusReason = 'Full order refund processed';
              comm.updatedAt = nowIso;
              appendLedgerEntry(store, {
                idempotencyKey: `full-refund:${comm.id}`,
                partnerId: partner.id,
                affiliateId: partner.affiliateId,
                entryType: 'commission_refund_adjustment',
                amountPaisa: -prevAmt,
                bucket,
                balanceAfterPaisa: bucket === 'available' ? wallet.availablePaisa : wallet.pendingPaisa,
                referenceType: 'commission',
                referenceId: comm.id,
                description: `Full refund reversed commission on order ${comm.orderNumberMasked}`,
                actor: 'admin',
              });
              await notifyPartnerAndEmail(store, {
                eventKey: `comm-full-refund:${comm.id}`,
                partner,
                recipientEmail: partner.customerEmail,
                recipientName: partner.fullName,
                category: 'commission',
                title: 'Commission Reversed Due to Refund',
                message: `A full refund was completed for order ${comm.orderNumberMasked} (${comm.productName}). The commission of ${formatInrFromPaisa(prevAmt)} has been reversed.`,
              });
              updatedCount += 1;
            }
          } else if (event === 'partial_refund') {
            const targetItemId = sanitizePlainText(req.body?.orderItemId, 120);
            const targetProductId = sanitizePlainText(req.body?.productId, 80);
            if (targetItemId && comm.orderItemId !== targetItemId) continue;
            if (!targetItemId && targetProductId && comm.productId !== targetProductId) continue;

            const refundedQty = Math.max(
              1,
              Math.min(comm.quantity, Math.round(Number(req.body?.refundedQuantity || 1)))
            );
            comm.orderStatus = refundedQty >= comm.quantity ? 'refunded' : 'partially_refunded';
            comm.refundedQuantity = refundedQty;

            if (comm.status === 'paid') {
              comm.status = 'under_review';
              comm.statusReason = 'Partial refund occurred after payout; flagged for admin review';
              comm.updatedAt = nowIso;
              updatedCount += 1;
              continue;
            }

            const newCommPaisa = calculateProportionalRefundCommissionPaisa({
              originalCommissionPaisa: comm.originalCommissionPaisa,
              totalQuantity: comm.quantity,
              refundedQuantity: refundedQty,
            });
            const delta = comm.commissionAmountPaisa - newCommPaisa;
            if (delta > 0) {
              const bucket = comm.status === 'available' ? 'available' : 'pending';
              if (bucket === 'available') {
                wallet.availablePaisa = Math.max(0, wallet.availablePaisa - delta);
              } else {
                wallet.pendingPaisa = Math.max(0, wallet.pendingPaisa - delta);
              }
              wallet.updatedAt = nowIso;
              comm.commissionAmountPaisa = newCommPaisa;
              comm.status = newCommPaisa === 0 ? 'cancelled' : comm.status;
              comm.statusReason = `Adjusted proportionally for ${refundedQty}/${comm.quantity} refunded units`;
              comm.updatedAt = nowIso;
              appendLedgerEntry(store, {
                idempotencyKey: `partial-refund:${comm.id}:${refundedQty}`,
                partnerId: partner.id,
                affiliateId: partner.affiliateId,
                entryType: 'commission_refund_adjustment',
                amountPaisa: -delta,
                bucket,
                balanceAfterPaisa: bucket === 'available' ? wallet.availablePaisa : wallet.pendingPaisa,
                referenceType: 'commission',
                referenceId: comm.id,
                description: `Partial refund (${refundedQty}/${comm.quantity} qty) adjusted commission on order ${comm.orderNumberMasked}`,
                actor: 'admin',
              });
              updatedCount += 1;
            }
          }
        }

        // Automatically release any now-due commissions
        const releasedCount = releaseEligiblePendingCommissions(store, now);
        saveStore(store);

        return res.json({
          success: true,
          updatedCount,
          releasedCount,
          commissions: store.commissions.filter((c) => c.orderId === orderId),
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          error: err?.message || 'Failed to process order lifecycle update.',
        });
      }
    });
  });

  // ============================================================================
  // 6. PUBLIC QR VERIFICATION PAGE API (STRICTLY PUBLIC FIELDS ONLY)
  // ============================================================================

  router.get('/affiliate/verify/:code', (req: Request, res: Response) => {
    const store = loadStore();
    const rawCode = sanitizePlainText(req.params.code, 80);
    const partner = store.partners.find(
      (p) =>
        p.verificationCode.toLowerCase() === rawCode.toLowerCase() ||
        p.affiliateId.toLowerCase() === rawCode.toLowerCase() ||
        p.certificateNumber.toLowerCase() === rawCode.toLowerCase()
    );

    if (!partner) {
      return res.status(404).json({
        success: false,
        valid: false,
        error: 'Affiliate credential could not be verified. No matching TeqqnoWorld partner record was found.',
      });
    }

    const labelMap: Record<AffiliatePartnerRecord['status'], string> = {
      active: 'Verified Active TeqqnoWorld Affiliate Partner',
      suspended: 'Partner Account Currently Suspended',
      closed: 'Partner Account Permanently Closed',
    };

    // STRICT PRIVACY: NEVER include Aadhaar, PAN, bank, email, mobile, earnings, or customer/order info
    const result: AffiliatePublicVerificationResult = {
      valid: partner.status === 'active',
      partnerName: partner.fullName,
      affiliateId: partner.affiliateId,
      certificateNumber: partner.certificateNumber,
      cardNumber: partner.cardNumber,
      status: partner.status,
      joinedAt: partner.joinedAt,
      verificationLabel: labelMap[partner.status],
      verifiedAt: new Date().toISOString(),
    };

    return res.json({ success: true, verification: result });
  });

  // ============================================================================
  // 7. AFFILIATE PARTNER DASHBOARD APIs (OWNERSHIP-ENFORCED)
  // ============================================================================

  router.get('/affiliate/dashboard', (req: Request, res: Response) => {
    const store = loadStore();
    releaseEligiblePendingCommissions(store, new Date());

    const explicitId = sanitizePlainText(req.query.affiliateId, 64) || undefined;
    const auth = resolveAuthorizedPartner(store, req, explicitId);
    if (!auth.partner) {
      return res.status(auth.statusCode).json({ success: false, error: auth.error });
    }

    const partner = auth.partner;
    const wallet = ensureWallet(store, partner);
    const kyc = toPublicMaskedKyc(
      store.kycRecords.find(
        (k) => k.partnerId === partner.id || k.applicationId === partner.applicationId
      ) || null
    );

    const range = (sanitizePlainText(req.query.range || 'monthly', 20) as AffiliateAnalyticsRange) || 'monthly';
    const fromDate = sanitizePlainText(req.query.from, 30) || undefined;
    const toDate = sanitizePlainText(req.query.to, 30) || undefined;

    const links = store.links.filter((l) => l.partnerId === partner.id);
    const clicks = store.clicks.filter((c) => c.partnerId === partner.id);
    const commissions = store.commissions.filter((c) => c.partnerId === partner.id);
    const ledger = store.ledger.filter((l) => l.partnerId === partner.id).slice(0, 200);
    const withdrawals = store.withdrawals.filter((w) => w.partnerId === partner.id);
    const rewards = store.rewards.filter((r) => r.partnerId === partner.id);
    const notifications = store.notifications.filter((n) => n.partnerId === partner.id);
    const tickets = store.tickets.filter((t) => t.partnerId === partner.id);
    const reactivationRequests = store.reactivationRequests.filter((r) => r.partnerId === partner.id);
    const closureRequests = store.closureRequests.filter((r) => r.partnerId === partner.id);
    const enabledProducts = store.productSettings.filter((p) => p.enabled);
    const targets = buildTargetProgressForPartner(store, partner.id);
    const leaderboards = buildLeaderboards(store, partner.id);

    const activeComms = commissions.filter((c) => c.status !== 'cancelled');
    const referredOrders = new Set(activeComms.map((c) => c.orderId)).size;
    const deliveredOrders = new Set(
      activeComms.filter((c) => c.orderStatus === 'delivered').map((c) => c.orderId)
    ).size;
    const totalClicks = clicks.length;
    const conversionRatePct =
      totalClicks > 0 ? Math.round((referredOrders / totalClicks) * 10000) / 100 : 0;
    const totalReferredSalesPaisa = activeComms.reduce(
      (s, c) => s + c.gstInclusiveEligiblePaisa,
      0
    );

    // Product Promotion History aggregation
    const promoMap = new Map<
      string,
      {
        productId: string;
        productSlug: string;
        productName: string;
        commissionRatePct: number;
        clicks: number;
        ordersSet: Set<string>;
        salesPaisa: number;
        commissionPaisa: number;
      }
    >();

    for (const p of enabledProducts) {
      promoMap.set(p.productId, {
        productId: p.productId,
        productSlug: p.productSlug,
        productName: p.productName,
        commissionRatePct: resolveEffectiveProductCommission(p).ratePct,
        clicks: 0,
        ordersSet: new Set<string>(),
        salesPaisa: 0,
        commissionPaisa: 0,
      });
    }
    for (const c of clicks) {
      if (!c.productId) continue;
      const entry = promoMap.get(c.productId);
      if (entry) entry.clicks += 1;
    }
    for (const c of activeComms) {
      const entry = promoMap.get(c.productId) || {
        productId: c.productId,
        productSlug: PRODUCT_ID_TO_CANONICAL_SLUG[c.productId] || c.productId,
        productName: c.productName,
        commissionRatePct: c.commissionRatePctSnapshot,
        clicks: 0,
        ordersSet: new Set<string>(),
        salesPaisa: 0,
        commissionPaisa: 0,
      };
      entry.ordersSet.add(c.orderId);
      entry.salesPaisa += c.gstInclusiveEligiblePaisa;
      entry.commissionPaisa += c.commissionAmountPaisa;
      promoMap.set(c.productId, entry);
    }

    const productPromotionHistory = Array.from(promoMap.values())
      .filter((p) => p.clicks > 0 || p.ordersSet.size > 0 || enabledProducts.some((ep) => ep.productId === p.productId))
      .map((p) => ({
        productId: p.productId,
        productSlug: p.productSlug,
        productName: p.productName,
        commissionRatePct: p.commissionRatePct,
        clicks: p.clicks,
        orders: p.ordersSet.size,
        salesPaisa: p.salesPaisa,
        commissionPaisa: p.commissionPaisa,
        conversionRatePct: p.clicks > 0 ? Math.round((p.ordersSet.size / p.clicks) * 10000) / 100 : 0,
      }));

    saveStore(store);

    return res.json({
      success: true,
      dashboard: {
        settings: store.settings,
        partner,
        kyc,
        wallet,
        ledger,
        links,
        enabledProducts,
        clicks: clicks.slice(0, 250),
        commissions,
        withdrawals,
        targets,
        rewards,
        leaderboards,
        notifications: notifications.slice(0, 100),
        announcements: store.announcements.filter((a) => a.active),
        tickets,
        reactivationRequests,
        closureRequests,
        kpis: {
          totalClicks,
          referredOrders,
          deliveredOrders,
          conversionRatePct,
          totalReferredSalesPaisa,
          pendingCommissionPaisa: wallet.pendingPaisa,
          availableCommissionPaisa: wallet.availablePaisa,
          processingPayoutPaisa: wallet.processingPaisa,
          totalWithdrawnPaisa: wallet.totalWithdrawnPaisa,
          unreadNotifications: notifications.filter((n) => !n.isRead).length,
        },
        productPromotionHistory,
        analyticsSeries: buildAnalyticsSeries(clicks, commissions, range, fromDate, toDate),
      },
    });
  });

  // Generate Product or Website Affiliate Link (Active Partners Only)
  router.post('/affiliate/links', (req: Request, res: Response) => {
    const store = loadStore();
    const auth = resolveAuthorizedPartner(store, req);
    if (!auth.partner) {
      return res.status(auth.statusCode).json({ success: false, error: auth.error });
    }
    const partner = auth.partner;
    if (partner.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Only active affiliate partners can generate referral links.',
      });
    }

    const linkType = req.body?.linkType === 'website' ? 'website' : 'product';
    const productId = sanitizePlainText(req.body?.productId, 80) || null;
    const campaignTag = sanitizePlainText(req.body?.campaignTag, 40) || null;
    const domain = store.settings.officialDomain.replace(/\/+$/, '');

    let targetUrl = `${domain}/?ref=${encodeURIComponent(partner.referralToken)}`;
    let productSlug: string | null = null;
    let productName: string | null = null;

    if (linkType === 'product') {
      const prodSetting = store.productSettings.find((p) => p.productId === productId);
      if (!prodSetting || !prodSetting.enabled) {
        return res.status(400).json({
          success: false,
          error: 'Only admin-enabled affiliate products can have product referral links generated.',
        });
      }
      productSlug = prodSetting.productSlug;
      productName = prodSetting.productName;
      targetUrl = `${domain}/product/${encodeURIComponent(productSlug)}?ref=${encodeURIComponent(partner.referralToken)}`;
    }
    if (campaignTag) {
      targetUrl += `&utm_campaign=${encodeURIComponent(campaignTag)}`;
    }

    const existing = store.links.find(
      (l) =>
        l.partnerId === partner.id &&
        l.linkType === linkType &&
        l.productId === productId &&
        (l.campaignTag || '') === (campaignTag || '')
    );
    if (existing) {
      return res.json({ success: true, link: existing, existing: true });
    }

    const nowIso = new Date().toISOString();
    const link: AffiliateLinkRecord = {
      id: crypto.randomUUID(),
      partnerId: partner.id,
      affiliateId: partner.affiliateId,
      linkType,
      productId,
      productSlug,
      productName,
      referralToken: partner.referralToken,
      campaignTag,
      targetUrl,
      status: 'active',
      clicksCount: 0,
      ordersCount: 0,
      commissionEarnedPaisa: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store.links.unshift(link);
    saveStore(store);

    return res.status(201).json({ success: true, link });
  });

  // Upload Partner Photo for Digital ID Card
  router.post('/affiliate/id-card/photo', (req: Request, res: Response) => {
    const store = loadStore();
    const auth = resolveAuthorizedPartner(store, req);
    if (!auth.partner) {
      return res.status(auth.statusCode).json({ success: false, error: auth.error });
    }
    const photoDataUrl = String(req.body?.photoDataUrl || '');
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photoDataUrl)) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a valid JPG, PNG, or WebP portrait image.',
      });
    }
    if (photoDataUrl.length > 2_500_000) {
      return res.status(400).json({
        success: false,
        error: 'Portrait image is too large. Please choose an image under 1.8 MB.',
      });
    }

    auth.partner.avatarUrl = photoDataUrl;
    auth.partner.updatedAt = new Date().toISOString();
    saveStore(store);

    return res.json({ success: true, avatarUrl: auth.partner.avatarUrl });
  });

  // Request Manual Withdrawal (Concurrency-Safe, Idempotent, Min ₹100)
  router.post('/affiliate/withdrawals', async (req: Request, res: Response) => {
    return withFinancialLock(async () => {
      try {
        const store = loadStore();
        const auth = resolveAuthorizedPartner(store, req);
        if (!auth.partner) {
          return res.status(auth.statusCode).json({ success: false, error: auth.error });
        }

        const partner = auth.partner;
        if (partner.status !== 'active') {
          return res.status(403).json({
            success: false,
            error: 'Withdrawals are disabled while your affiliate partner account is suspended or closed.',
          });
        }

        const wallet = ensureWallet(store, partner);
        if (wallet.fundsHeld) {
          return res.status(403).json({
            success: false,
            error: 'Your wallet funds are currently on hold pending admin review.',
          });
        }

        const kyc = store.kycRecords.find(
          (k) => k.partnerId === partner.id || k.applicationId === partner.applicationId
        );
        if (!kyc || kyc.kycStatus !== 'verified' || kyc.bankVerificationStatus !== 'verified') {
          return res.status(400).json({
            success: false,
            error: 'Verified KYC and Bank Account details are required before requesting a withdrawal.',
          });
        }

        const amountInr = Number(req.body?.amountInr || 0);
        const amountPaisa = inrToPaisa(amountInr);
        const idempotencyKey =
          sanitizePlainText(req.body?.idempotencyKey, 120) ||
          `wd:${partner.id}:${amountPaisa}:${Date.now()}`;

        const duplicate = store.withdrawals.find((w) => w.id === idempotencyKey || (w as any).idempotencyKey === idempotencyKey);
        if (duplicate) {
          return res.json({ success: true, withdrawal: duplicate, duplicate: true });
        }

        if (amountPaisa < store.settings.minWithdrawalPaisa) {
          return res.status(400).json({
            success: false,
            error: `Minimum withdrawal amount is ${formatInrFromPaisa(store.settings.minWithdrawalPaisa)}.`,
          });
        }
        if (amountPaisa > wallet.availablePaisa) {
          return res.status(400).json({
            success: false,
            error: `Insufficient available balance (${formatInrFromPaisa(wallet.availablePaisa)} available).`,
          });
        }

        // Atomic move: Available -> Processing
        const nowIso = new Date().toISOString();
        wallet.availablePaisa -= amountPaisa;
        wallet.processingPaisa += amountPaisa;
        wallet.updatedAt = nowIso;

        store.withdrawalSequence += 1;
        const requestCode = `TW-WD-${String(store.withdrawalSequence).padStart(6, '0')}`;

        const withdrawal: AffiliateWithdrawalRecord & { idempotencyKey?: string } = {
          id: crypto.randomUUID(),
          idempotencyKey,
          requestCode,
          partnerId: partner.id,
          affiliateId: partner.affiliateId,
          partnerName: partner.fullName,
          amountPaisa,
          status: 'processing',
          bankHolderSnapshot: kyc.bankAccountHolderName,
          bankAccountMaskedSnapshot: kyc.bankAccountMasked,
          bankIfscSnapshot: kyc.bankIfscCode,
          transferReference: null,
          rejectionReason: null,
          adminNotes: null,
          processedBy: null,
          requestedAt: nowIso,
          processedAt: null,
        };
        store.withdrawals.unshift(withdrawal);

        appendLedgerEntry(store, {
          idempotencyKey: `wd-req:${withdrawal.id}`,
          partnerId: partner.id,
          affiliateId: partner.affiliateId,
          entryType: 'withdrawal_requested',
          amountPaisa: -amountPaisa,
          bucket: 'available',
          balanceAfterPaisa: wallet.availablePaisa,
          referenceType: 'withdrawal',
          referenceId: withdrawal.id,
          description: `Withdrawal request ${requestCode} moved ${formatInrFromPaisa(amountPaisa)} to Processing`,
          actor: partner.affiliateId,
        });

        appendAudit(store, 'affiliate', partner.affiliateId, 'withdrawal_requested', 'withdrawal', withdrawal.id, {
          requestCode,
          amountPaisa,
        });

        await notifyPartnerAndEmail(store, {
          eventKey: `wd-req:${withdrawal.id}`,
          partner,
          recipientEmail: partner.customerEmail,
          recipientName: partner.fullName,
          category: 'withdrawal',
          title: 'Withdrawal Request Submitted',
          message: `Your withdrawal request ${requestCode} for ${formatInrFromPaisa(amountPaisa)} has been submitted and moved to Processing. Manual bank transfers typically complete within ${store.settings.payoutProcessingDaysMin}–${store.settings.payoutProcessingDaysMax} working days.`,
          highlightRows: [
            { label: 'Request Code', value: requestCode },
            { label: 'Amount', value: formatInrFromPaisa(amountPaisa) },
            { label: 'Destination Account', value: `${kyc.bankAccountMasked} (${kyc.bankIfscCode})` },
          ],
          notifyAdmins: true,
        });

        saveStore(store);

        return res.status(201).json({
          success: true,
          withdrawal,
          wallet,
          message: `Withdrawal request ${requestCode} submitted successfully.`,
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          error: err?.message || 'Unable to submit withdrawal request.',
        });
      }
    });
  });

  // Mark Notification Read
  router.patch('/affiliate/notifications/:id/read', (req: Request, res: Response) => {
    const store = loadStore();
    const auth = resolveAuthorizedPartner(store, req);
    if (!auth.partner) {
      return res.status(auth.statusCode).json({ success: false, error: auth.error });
    }
    const id = req.params.id;
    if (id === 'all') {
      store.notifications.forEach((n) => {
        if (n.partnerId === auth.partner!.id) n.isRead = true;
      });
    } else {
      const target = store.notifications.find(
        (n) => n.id === id && n.partnerId === auth.partner!.id
      );
      if (target) target.isRead = true;
    }
    saveStore(store);
    return res.json({ success: true });
  });

  // Partner Support Tickets
  router.post('/affiliate/support', async (req: Request, res: Response) => {
    const store = loadStore();
    const auth = resolveAuthorizedPartner(store, req);
    if (!auth.partner) {
      return res.status(auth.statusCode).json({ success: false, error: auth.error });
    }
    const partner = auth.partner;
    const subject = sanitizePlainText(req.body?.subject, 140);
    const category = sanitizePlainText(req.body?.category || 'general', 40);
    const message = sanitizePlainText(req.body?.message, 1500);
    if (!subject || !message) {
      return res.status(400).json({ success: false, error: 'Subject and message are required.' });
    }

    store.ticketSequence += 1;
    const nowIso = new Date().toISOString();
    const ticket: AffiliateSupportTicket = {
      id: crypto.randomUUID(),
      ticketNumber: `TW-SUP-${String(store.ticketSequence).padStart(5, '0')}`,
      partnerId: partner.id,
      affiliateId: partner.affiliateId,
      partnerName: partner.fullName,
      subject,
      category,
      status: 'open',
      priority: 'normal',
      messages: [
        {
          id: crypto.randomUUID(),
          senderRole: 'affiliate',
          senderName: partner.fullName,
          message,
          createdAt: nowIso,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    store.tickets.unshift(ticket);
    saveStore(store);

    return res.status(201).json({ success: true, ticket });
  });

  router.post('/affiliate/support/:id/reply', (req: Request, res: Response) => {
    const store = loadStore();
    const auth = resolveAuthorizedPartner(store, req);
    if (!auth.partner) {
      return res.status(auth.statusCode).json({ success: false, error: auth.error });
    }
    const ticket = store.tickets.find(
      (t) => t.id === req.params.id && t.partnerId === auth.partner!.id
    );
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Support ticket not found.' });
    }
    const message = sanitizePlainText(req.body?.message, 1500);
    if (!message) {
      return res.status(400).json({ success: false, error: 'Reply message is required.' });
    }
    const nowIso = new Date().toISOString();
    ticket.messages.push({
      id: crypto.randomUUID(),
      senderRole: 'affiliate',
      senderName: auth.partner.fullName,
      message,
      createdAt: nowIso,
    });
    ticket.updatedAt = nowIso;
    saveStore(store);
    return res.json({ success: true, ticket });
  });

  // Partner Reactivation Request (Suspended partners only)
  router.post('/affiliate/reactivation-request', async (req: Request, res: Response) => {
    const store = loadStore();
    const auth = resolveAuthorizedPartner(store, req);
    if (!auth.partner) {
      return res.status(auth.statusCode).json({ success: false, error: auth.error });
    }
    const partner = auth.partner;
    if (partner.status !== 'suspended') {
      return res.status(400).json({
        success: false,
        error: 'Reactivation requests are only applicable to suspended partner accounts.',
      });
    }
    const reason = sanitizePlainText(req.body?.reason, 1000);
    if (reason.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Please provide an explanation (at least 10 characters) for your reactivation request.',
      });
    }
    const reqRec: AffiliateReactivationRequest = {
      id: crypto.randomUUID(),
      partnerId: partner.id,
      affiliateId: partner.affiliateId,
      partnerName: partner.fullName,
      reason,
      status: 'pending',
      adminNotes: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    };
    store.reactivationRequests.unshift(reqRec);
    await notifyPartnerAndEmail(store, {
      eventKey: `reactivation-req:${reqRec.id}`,
      partner,
      recipientEmail: partner.customerEmail,
      recipientName: partner.fullName,
      category: 'account',
      title: 'Reactivation Request Submitted',
      message: 'Your affiliate account reactivation request has been submitted for admin review.',
      notifyAdmins: true,
    });
    saveStore(store);
    return res.status(201).json({ success: true, request: reqRec });
  });

  // Partner Account Closure Request
  router.post('/affiliate/closure-request', async (req: Request, res: Response) => {
    const store = loadStore();
    const auth = resolveAuthorizedPartner(store, req);
    if (!auth.partner) {
      return res.status(auth.statusCode).json({ success: false, error: auth.error });
    }
    const partner = auth.partner;
    if (partner.status === 'closed') {
      return res.status(400).json({ success: false, error: 'Account is already closed.' });
    }
    const reason = sanitizePlainText(req.body?.reason, 1000);
    if (reason.length < 5) {
      return res.status(400).json({ success: false, error: 'Please provide a reason for closing your affiliate account.' });
    }
    const reqRec: AffiliateClosureRequest = {
      id: crypto.randomUUID(),
      partnerId: partner.id,
      affiliateId: partner.affiliateId,
      partnerName: partner.fullName,
      reason,
      status: 'pending',
      settlementNotes: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    };
    store.closureRequests.unshift(reqRec);
    await notifyPartnerAndEmail(store, {
      eventKey: `closure-req:${reqRec.id}`,
      partner,
      recipientEmail: partner.customerEmail,
      recipientName: partner.fullName,
      category: 'account',
      title: 'Account Closure Request Received',
      message:
        'Your affiliate partner account closure request has been received. Upon admin approval, eligible available balance will be settled and unpaid pending commissions will be cancelled.',
      notifyAdmins: true,
    });
    saveStore(store);
    return res.status(201).json({ success: true, request: reqRec });
  });

  // ============================================================================
  // 8. ADMIN AFFILIATE MANAGEMENT PANEL APIs (BEARER AUTH REQUIRED)
  // ============================================================================

  router.get('/admin/affiliate/overview', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const store = loadStore();
    releaseEligiblePendingCommissions(store, new Date());
    saveStore(store);

    const activePartners = store.partners.filter((p) => p.status === 'active').length;
    const suspendedPartners = store.partners.filter((p) => p.status === 'suspended').length;
    const closedPartners = store.partners.filter((p) => p.status === 'closed').length;
    const pendingApplications = store.applications.filter((a) =>
      ['submitted', 'under_review', 'kyc_pending', 'kyc_under_review'].includes(a.status)
    ).length;
    const pendingKyc = store.kycRecords.filter(
      (k) => k.kycStatus !== 'verified' || k.bankVerificationStatus !== 'verified'
    ).length;
    const pendingWithdrawals = store.withdrawals.filter((w) =>
      ['pending', 'processing'].includes(w.status)
    );
    const openFraudFlags = store.fraudFlags.filter((f) =>
      ['open', 'investigating'].includes(f.status)
    ).length;
    const totalPendingCommissionPaisa = Object.values(store.wallets).reduce(
      (s, w) => s + w.pendingPaisa,
      0
    );
    const totalAvailableCommissionPaisa = Object.values(store.wallets).reduce(
      (s, w) => s + w.availablePaisa,
      0
    );
    const totalPaidOutPaisa = Object.values(store.wallets).reduce(
      (s, w) => s + w.totalWithdrawnPaisa,
      0
    );
    const totalReferredSalesPaisa = store.commissions
      .filter((c) => c.status !== 'cancelled')
      .reduce((s, c) => s + c.gstInclusiveEligiblePaisa, 0);

    return res.json({
      success: true,
      settings: store.settings,
      kpis: {
        totalPartners: store.partners.length,
        activePartners,
        suspendedPartners,
        closedPartners,
        pendingApplications,
        pendingKyc,
        enabledProducts: store.productSettings.filter((p) => p.enabled).length,
        totalProducts: store.productSettings.length,
        totalClicks: store.clicks.length,
        totalReferredOrders: new Set(
          store.commissions.filter((c) => c.status !== 'cancelled').map((c) => c.orderId)
        ).size,
        totalReferredSalesPaisa,
        totalPendingCommissionPaisa,
        totalAvailableCommissionPaisa,
        pendingWithdrawalsCount: pendingWithdrawals.length,
        pendingWithdrawalsPaisa: pendingWithdrawals.reduce((s, w) => s + w.amountPaisa, 0),
        totalPaidOutPaisa,
        openFraudFlags,
        openSupportTickets: store.tickets.filter((t) => ['open', 'in_progress'].includes(t.status))
          .length,
      },
      applications: store.applications,
      kycRecords: store.kycRecords.map((k) => toPublicMaskedKyc(k)),
      partners: store.partners.map((p) => ({
        ...p,
        wallet: ensureWallet(store, p),
      })),
      productSettings: store.productSettings,
      links: store.links,
      clicks: store.clicks.slice(0, 300),
      commissions: store.commissions,
      withdrawals: store.withdrawals,
      fraudFlags: store.fraudFlags,
      targets: store.targets,
      rewards: store.rewards,
      leaderboards: buildLeaderboards(store),
      announcements: store.announcements,
      tickets: store.tickets,
      reactivationRequests: store.reactivationRequests,
      closureRequests: store.closureRequests,
      auditLogs: store.auditLogs.slice(0, 300),
      pennyDropConfigured: Boolean(
        process.env.BANK_PENNY_DROP_PROVIDER && process.env.BANK_PENNY_DROP_API_KEY
      ),
    });
  });

  // Admin: Review Application (Approve for KYC / Reject with mandatory reason)
  router.patch('/admin/affiliate/applications/:id', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const store = loadStore();
    const appRec = store.applications.find((a) => a.id === req.params.id);
    if (!appRec) {
      return res.status(404).json({ success: false, error: 'Application not found.' });
    }

    const action = sanitizePlainText(req.body?.action, 32);
    const reason = sanitizePlainText(req.body?.reason || req.body?.rejectionReason, 600);
    const adminNotes = sanitizePlainText(req.body?.adminNotes, 600) || null;
    const nowIso = new Date().toISOString();

    if (action === 'reject') {
      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'A rejection reason is mandatory when rejecting an affiliate application.',
        });
      }
      appRec.status = 'rejected';
      appRec.rejectionReason = reason;
      appRec.adminNotes = adminNotes;
      appRec.reviewedBy = 'admin';
      appRec.reviewedAt = nowIso;
      appRec.updatedAt = nowIso;

      appendAudit(store, 'admin', 'admin', 'application_rejected', 'application', appRec.id, { reason });
      await notifyPartnerAndEmail(store, {
        eventKey: `app-rejected:${appRec.id}:${nowIso}`,
        recipientEmail: appRec.customerEmail,
        recipientName: `${appRec.firstName} ${appRec.lastName}`,
        category: 'application',
        title: 'Affiliate Application Update — Not Approved',
        message: `Thank you for applying to the TeqqnoWorld Affiliate Partner Program. Unfortunately, your application was not approved at this time. Reason: ${reason}. You may address this feedback and reapply.`,
      });
    } else if (action === 'approve_application') {
      const kyc = store.kycRecords.find((k) => k.applicationId === appRec.id);
      appRec.status = kyc ? 'kyc_under_review' : 'kyc_pending';
      appRec.rejectionReason = null;
      appRec.adminNotes = adminNotes;
      appRec.reviewedBy = 'admin';
      appRec.reviewedAt = nowIso;
      appRec.updatedAt = nowIso;

      appendAudit(store, 'admin', 'admin', 'application_approved_for_kyc', 'application', appRec.id, {});
      await notifyPartnerAndEmail(store, {
        eventKey: `app-approved-kyc:${appRec.id}`,
        recipientEmail: appRec.customerEmail,
        recipientName: `${appRec.firstName} ${appRec.lastName}`,
        category: 'application',
        title: 'Affiliate Application Approved — Complete KYC & Bank Verification',
        message: kyc
          ? 'Your affiliate application has been approved. Our team is now reviewing your submitted KYC and Bank details.'
          : 'Your affiliate application has been approved! Please submit your KYC and Bank account details to activate your partner account.',
        ctaLabel: 'Complete KYC Verification',
        ctaUrl: `${store.settings.officialDomain}/affiliate-program`,
      });
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported application review action.' });
    }

    saveStore(store);
    return res.json({ success: true, application: appRec });
  });

  // Admin: Verify KYC / Bank / Trigger Penny Drop / Final Partner Activation
  router.patch('/admin/affiliate/kyc/:id', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const store = loadStore();
    const kyc = store.kycRecords.find((k) => k.id === req.params.id);
    if (!kyc) {
      return res.status(404).json({ success: false, error: 'KYC record not found.' });
    }
    const appRec = store.applications.find((a) => a.id === kyc.applicationId);
    if (!appRec) {
      return res.status(404).json({ success: false, error: 'Associated application not found.' });
    }

    const action = sanitizePlainText(req.body?.action, 40);
    const reason = sanitizePlainText(req.body?.reason, 600);
    const nowIso = new Date().toISOString();

    if (action === 'penny_drop_check') {
      const provider = process.env.BANK_PENNY_DROP_PROVIDER;
      const apiKey = process.env.BANK_PENNY_DROP_API_KEY;
      if (!provider || !apiKey) {
        return res.status(400).json({
          success: false,
          pennyDropConfigured: false,
          error:
            'Bank Penny Drop provider credentials (BANK_PENNY_DROP_PROVIDER & BANK_PENNY_DROP_API_KEY) are not configured on this server. Please configure them or use Admin Manual Document Verification.',
        });
      }
      return res.status(501).json({
        success: false,
        error: `External Penny Drop adapter for provider "${provider}" requires live merchant activation before automated verification.`,
      });
    }

    if (action === 'approve_kyc') {
      kyc.kycStatus = 'verified';
      kyc.kycRejectionReason = null;
      kyc.kycVerifiedAt = nowIso;
      kyc.kycVerifiedBy = 'admin';
      kyc.updatedAt = nowIso;
      appendAudit(store, 'admin', 'admin', 'kyc_verified', 'kyc', kyc.id, {});
      await notifyPartnerAndEmail(store, {
        eventKey: `kyc-verified:${kyc.id}`,
        recipientEmail: appRec.customerEmail,
        recipientName: `${appRec.firstName} ${appRec.lastName}`,
        category: 'kyc',
        title: 'KYC Documents Verified',
        message: 'Your KYC identity documents have been verified by the TeqqnoWorld compliance team.',
      });
    } else if (action === 'reject_kyc') {
      if (!reason) {
        return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
      }
      kyc.kycStatus = 'rejected';
      kyc.kycRejectionReason = reason;
      kyc.updatedAt = nowIso;
      appRec.status = 'kyc_pending';
      appRec.updatedAt = nowIso;
      appendAudit(store, 'admin', 'admin', 'kyc_rejected', 'kyc', kyc.id, { reason });
      await notifyPartnerAndEmail(store, {
        eventKey: `kyc-rejected:${kyc.id}:${nowIso}`,
        recipientEmail: appRec.customerEmail,
        recipientName: `${appRec.firstName} ${appRec.lastName}`,
        category: 'kyc',
        title: 'KYC Verification Requires Resubmission',
        message: `Your KYC verification was not approved. Reason: ${reason}. Please update and resubmit your KYC details.`,
      });
    } else if (action === 'approve_bank') {
      kyc.bankVerificationStatus = 'verified';
      kyc.bankVerificationMethod = 'manual_document';
      kyc.bankRejectionReason = null;
      kyc.bankVerifiedAt = nowIso;
      kyc.bankVerifiedBy = 'admin';
      kyc.updatedAt = nowIso;
      appendAudit(store, 'admin', 'admin', 'bank_verified_manual', 'kyc', kyc.id, {});
      await notifyPartnerAndEmail(store, {
        eventKey: `bank-verified:${kyc.id}`,
        recipientEmail: appRec.customerEmail,
        recipientName: `${appRec.firstName} ${appRec.lastName}`,
        category: 'kyc',
        title: 'Bank Account Verified',
        message: `Your payout bank account (${kyc.bankAccountMasked} / ${kyc.bankIfscCode}) has been verified via admin document review.`,
      });
    } else if (action === 'reject_bank') {
      if (!reason) {
        return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
      }
      kyc.bankVerificationStatus = 'rejected';
      kyc.bankRejectionReason = reason;
      kyc.updatedAt = nowIso;
      appRec.status = 'kyc_pending';
      appRec.updatedAt = nowIso;
      appendAudit(store, 'admin', 'admin', 'bank_rejected', 'kyc', kyc.id, { reason });
      await notifyPartnerAndEmail(store, {
        eventKey: `bank-rejected:${kyc.id}:${nowIso}`,
        recipientEmail: appRec.customerEmail,
        recipientName: `${appRec.firstName} ${appRec.lastName}`,
        category: 'kyc',
        title: 'Bank Verification Requires Resubmission',
        message: `Your bank verification was not approved. Reason: ${reason}. Please resubmit accurate bank proof.`,
      });
    } else if (action === 'activate_partner') {
      // Strictly enforce ALL prerequisites: KYC verified + Bank verified
      if (kyc.kycStatus !== 'verified' || kyc.bankVerificationStatus !== 'verified') {
        return res.status(400).json({
          success: false,
          error: 'Partner activation requires both KYC verification and Bank Account verification to be completed first.',
        });
      }

      let partner = store.partners.find(
        (p) => normalizeEmail(p.customerEmail) === normalizeEmail(appRec.customerEmail)
      );
      if (!partner) {
        store.affiliateIdSequence += 1;
        const seqStr = String(store.affiliateIdSequence).padStart(
          store.settings.affiliateIdDigits,
          '0'
        );
        const affiliateId = `${store.settings.affiliateIdPrefix}${seqStr}`;
        const year = new Date().getUTCFullYear();
        const referralToken = `tw${crypto.randomBytes(5).toString('hex')}`;
        const verificationCode = `TWV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        partner = {
          id: crypto.randomUUID(),
          applicationId: appRec.id,
          affiliateId,
          referralToken,
          customerUserId: appRec.customerUserId,
          customerEmail: appRec.customerEmail,
          firstName: appRec.firstName,
          lastName: appRec.lastName,
          fullName: `${appRec.firstName} ${appRec.lastName}`.trim(),
          mobile: appRec.mobile,
          companyName: appRec.companyName,
          avatarUrl: null,
          status: 'active',
          suspensionReason: null,
          suspendedAt: null,
          closedAt: null,
          closedReason: null,
          certificateNumber: `TW-CERT-${year}-${seqStr}`,
          cardNumber: `TW-CARD-${year}-${seqStr}`,
          verificationCode,
          joinedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        store.partners.unshift(partner);
        ensureWallet(store, partner);

        // Auto-create default Website Referral Link
        const domain = store.settings.officialDomain.replace(/\/+$/, '');
        store.links.unshift({
          id: crypto.randomUUID(),
          partnerId: partner.id,
          affiliateId: partner.affiliateId,
          linkType: 'website',
          productId: null,
          productSlug: null,
          productName: 'TeqqnoWorld Storefront (Website-Wide)',
          referralToken: partner.referralToken,
          campaignTag: null,
          targetUrl: `${domain}/?ref=${encodeURIComponent(partner.referralToken)}`,
          status: 'active',
          clicksCount: 0,
          ordersCount: 0,
          commissionEarnedPaisa: 0,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      kyc.partnerId = partner.id;
      appRec.status = 'approved';
      appRec.reviewedBy = 'admin';
      appRec.reviewedAt = nowIso;
      appRec.updatedAt = nowIso;

      appendAudit(store, 'admin', 'admin', 'partner_activated', 'partner', partner.id, {
        affiliateId: partner.affiliateId,
        certificateNumber: partner.certificateNumber,
      });

      await notifyPartnerAndEmail(store, {
        eventKey: `partner-activated:${partner.id}`,
        partner,
        recipientEmail: partner.customerEmail,
        recipientName: partner.fullName,
        category: 'account',
        title: 'Congratulations! Your TeqqnoWorld Affiliate Account Is Active',
        message:
          'Your Affiliate Partner application, KYC, and Bank verification have been approved. Your unique Affiliate ID, Referral Links, Certificate, and Digital ID Card are now ready inside your Affiliate Dashboard.',
        highlightRows: [
          { label: 'Affiliate ID', value: partner.affiliateId },
          { label: 'Certificate Number', value: partner.certificateNumber },
          { label: 'Verification Code', value: partner.verificationCode },
        ],
        ctaLabel: 'Open Affiliate Dashboard',
        ctaUrl: `${store.settings.officialDomain}/affiliate-dashboard`,
      });

      saveStore(store);
      return res.json({
        success: true,
        partner,
        kyc: toPublicMaskedKyc(kyc),
        application: appRec,
      });
    } else {
      return res.status(400).json({ success: false, error: 'Unsupported KYC review action.' });
    }

    saveStore(store);
    return res.json({
      success: true,
      kyc: toPublicMaskedKyc(kyc),
      application: appRec,
    });
  });

  // Admin: Partner Management (Suspend with mandatory reason + hold funds, Reactivate, Close)
  router.patch('/admin/affiliate/partners/:id', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    return withFinancialLock(async () => {
      const store = loadStore();
      const partner = store.partners.find((p) => p.id === req.params.id);
      if (!partner) {
        return res.status(404).json({ success: false, error: 'Affiliate partner not found.' });
      }
      const wallet = ensureWallet(store, partner);
      const action = sanitizePlainText(req.body?.action, 40);
      const reason = sanitizePlainText(req.body?.reason, 600);
      const nowIso = new Date().toISOString();

      if (action === 'suspend') {
        if (!reason) {
          return res.status(400).json({
            success: false,
            error: 'A suspension reason is mandatory.',
          });
        }
        partner.status = 'suspended';
        partner.suspensionReason = reason;
        partner.suspendedAt = nowIso;
        partner.updatedAt = nowIso;

        // Immediately disable all partner links & hold BOTH pending and available funds
        store.links.forEach((l) => {
          if (l.partnerId === partner.id) {
            l.status = 'disabled';
            l.updatedAt = nowIso;
          }
        });
        wallet.fundsHeld = true;
        wallet.holdReason = reason;
        wallet.updatedAt = nowIso;

        // Place active pending commissions on hold
        store.commissions.forEach((c) => {
          if (c.partnerId === partner.id && c.status === 'pending') {
            c.status = 'on_hold';
            c.statusReason = `Account suspended: ${reason}`;
            c.updatedAt = nowIso;
          }
        });

        appendAudit(store, 'admin', 'admin', 'partner_suspended', 'partner', partner.id, { reason });
        await notifyPartnerAndEmail(store, {
          eventKey: `partner-suspended:${partner.id}:${nowIso}`,
          partner,
          recipientEmail: partner.customerEmail,
          recipientName: partner.fullName,
          category: 'account',
          title: 'Affiliate Partner Account Suspended',
          message: `Your TeqqnoWorld Affiliate Partner account (${partner.affiliateId}) has been suspended. Reason: ${reason}. Referral links are temporarily disabled and pending/available funds are on hold. You may submit a reactivation request from your dashboard.`,
        });
      } else if (action === 'reactivate') {
        if (partner.status !== 'suspended') {
          return res.status(400).json({
            success: false,
            error: 'Only suspended accounts can be reactivated.',
          });
        }
        const releaseHeldCommissions = req.body?.releaseHeldCommissions !== false;
        partner.status = 'active';
        partner.suspensionReason = null;
        partner.suspendedAt = null;
        partner.updatedAt = nowIso;

        store.links.forEach((l) => {
          if (l.partnerId === partner.id && l.status === 'disabled') {
            l.status = 'active';
            l.updatedAt = nowIso;
          }
        });

        wallet.fundsHeld = false;
        wallet.holdReason = null;
        wallet.updatedAt = nowIso;

        if (releaseHeldCommissions) {
          store.commissions.forEach((c) => {
            if (c.partnerId === partner.id && c.status === 'on_hold') {
              c.status = 'pending';
              c.statusReason = 'Restored to pending upon account reactivation';
              c.updatedAt = nowIso;
            }
          });
          releaseEligiblePendingCommissions(store, new Date());
        }

        store.reactivationRequests.forEach((r) => {
          if (r.partnerId === partner.id && r.status === 'pending') {
            r.status = 'approved';
            r.adminNotes = reason || 'Approved by admin';
            r.reviewedBy = 'admin';
            r.reviewedAt = nowIso;
          }
        });

        appendAudit(store, 'admin', 'admin', 'partner_reactivated', 'partner', partner.id, {
          releaseHeldCommissions,
        });
        await notifyPartnerAndEmail(store, {
          eventKey: `partner-reactivated:${partner.id}:${nowIso}`,
          partner,
          recipientEmail: partner.customerEmail,
          recipientName: partner.fullName,
          category: 'account',
          title: 'Affiliate Partner Account Reactivated',
          message: `Your TeqqnoWorld Affiliate Partner account (${partner.affiliateId}) has been reactivated. Your referral links and dashboard access are active again.`,
        });
      } else if (action === 'close') {
        partner.status = 'closed';
        partner.closedAt = nowIso;
        partner.closedReason = reason || 'Account closure approved by admin';
        partner.updatedAt = nowIso;

        // Disable links permanently
        store.links.forEach((l) => {
          if (l.partnerId === partner.id) {
            l.status = 'disabled';
            l.updatedAt = nowIso;
          }
        });

        // Cancel unpaid pending/on_hold commissions; settle eligible available balance
        let cancelledPendingTotal = 0;
        store.commissions.forEach((c) => {
          if (c.partnerId === partner.id && (c.status === 'pending' || c.status === 'on_hold')) {
            cancelledPendingTotal += c.commissionAmountPaisa;
            c.status = 'cancelled';
            c.commissionAmountPaisa = 0;
            c.statusReason = 'Cancelled upon affiliate account closure';
            c.updatedAt = nowIso;
          }
        });
        wallet.pendingPaisa = 0;
        const settledAvailablePaisa = wallet.availablePaisa;
        if (settledAvailablePaisa > 0) {
          wallet.availablePaisa = 0;
          wallet.totalWithdrawnPaisa += settledAvailablePaisa;
          appendLedgerEntry(store, {
            idempotencyKey: `closure-settle:${partner.id}:${nowIso}`,
            partnerId: partner.id,
            affiliateId: partner.affiliateId,
            entryType: 'withdrawal_paid',
            amountPaisa: settledAvailablePaisa,
            bucket: 'withdrawn',
            balanceAfterPaisa: wallet.totalWithdrawnPaisa,
            referenceType: 'closure',
            referenceId: partner.id,
            description: `Final account closure settlement of ${formatInrFromPaisa(settledAvailablePaisa)}`,
            actor: 'admin',
          });
        }
        wallet.fundsHeld = false;
        wallet.updatedAt = nowIso;

        store.closureRequests.forEach((r) => {
          if (r.partnerId === partner.id && r.status === 'pending') {
            r.status = 'approved';
            r.settlementNotes = `Settled available ${formatInrFromPaisa(settledAvailablePaisa)}; cancelled pending ${formatInrFromPaisa(cancelledPendingTotal)}`;
            r.reviewedBy = 'admin';
            r.reviewedAt = nowIso;
          }
        });

        appendAudit(store, 'admin', 'admin', 'partner_closed', 'partner', partner.id, {
          settledAvailablePaisa,
          cancelledPendingTotal,
        });
        await notifyPartnerAndEmail(store, {
          eventKey: `partner-closed:${partner.id}`,
          partner,
          recipientEmail: partner.customerEmail,
          recipientName: partner.fullName,
          category: 'account',
          title: 'Affiliate Partner Account Closed',
          message: `Your TeqqnoWorld Affiliate Partner account (${partner.affiliateId}) has been closed. Available balance settled: ${formatInrFromPaisa(settledAvailablePaisa)}. Unpaid pending commissions cancelled: ${formatInrFromPaisa(cancelledPendingTotal)}.`,
        });
      } else {
        return res.status(400).json({ success: false, error: 'Unsupported partner action.' });
      }

      saveStore(store);
      return res.json({ success: true, partner, wallet });
    });
  });

  // Admin: Product Commission Settings (Manual Enable/Disable, Rate %, Campaign %, Dates, History)
  router.put('/admin/affiliate/products/:productId', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const store = loadStore();
    const productId = req.params.productId;
    const setting = store.productSettings.find((p) => p.productId === productId);
    if (!setting) {
      return res.status(404).json({ success: false, error: 'Product not found in affiliate catalog.' });
    }

    const enabled = Boolean(req.body?.enabled);
    const commissionRatePct = Number(req.body?.commissionRatePct ?? setting.commissionRatePct);
    const campaignRatePct =
      req.body?.campaignRatePct === null || req.body?.campaignRatePct === '' || req.body?.campaignRatePct === undefined
        ? null
        : Number(req.body.campaignRatePct);
    const campaignLabel = sanitizePlainText(req.body?.campaignLabel || '', 80) || null;
    const startDate = sanitizePlainText(req.body?.startDate || '', 40) || null;
    const endDate = sanitizePlainText(req.body?.endDate || '', 40) || null;

    if (!Number.isFinite(commissionRatePct) || commissionRatePct < 0 || commissionRatePct > 50) {
      return res.status(400).json({
        success: false,
        error: 'Commission percentage must be between 0% and 50%.',
      });
    }
    if (campaignRatePct !== null && (!Number.isFinite(campaignRatePct) || campaignRatePct < 0 || campaignRatePct > 50)) {
      return res.status(400).json({
        success: false,
        error: 'Campaign commission percentage must be between 0% and 50%.',
      });
    }

    const nowIso = new Date().toISOString();
    setting.enabled = enabled;
    setting.commissionRatePct = Math.round(commissionRatePct * 100) / 100;
    setting.campaignRatePct = campaignRatePct !== null ? Math.round(campaignRatePct * 100) / 100 : null;
    setting.campaignLabel = campaignLabel;
    setting.startDate = startDate;
    setting.endDate = endDate;
    setting.updatedBy = 'admin';
    setting.updatedAt = nowIso;
    setting.history.unshift({
      changedAt: nowIso,
      changedBy: 'admin',
      enabled: setting.enabled,
      commissionRatePct: setting.commissionRatePct,
      campaignRatePct: setting.campaignRatePct,
      campaignLabel: setting.campaignLabel,
      startDate: setting.startDate,
      endDate: setting.endDate,
    });
    if (setting.history.length > 50) setting.history.length = 50;

    appendAudit(store, 'admin', 'admin', 'product_commission_updated', 'product', productId, {
      enabled: setting.enabled,
      commissionRatePct: setting.commissionRatePct,
      campaignRatePct: setting.campaignRatePct,
    });
    saveStore(store);

    return res.json({ success: true, productSetting: setting });
  });

  // Admin: Manual Commission Action (release / hold / cancel / adjust)
  router.patch('/admin/affiliate/commissions/:id', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    return withFinancialLock(async () => {
      const store = loadStore();
      const comm = store.commissions.find((c) => c.id === req.params.id);
      if (!comm) {
        return res.status(404).json({ success: false, error: 'Commission record not found.' });
      }
      const partner = store.partners.find((p) => p.id === comm.partnerId);
      if (!partner) {
        return res.status(404).json({ success: false, error: 'Partner not found.' });
      }
      const wallet = ensureWallet(store, partner);
      const action = sanitizePlainText(req.body?.action, 32);
      const reason = sanitizePlainText(req.body?.reason, 400) || 'Admin action';
      const nowIso = new Date().toISOString();

      if (action === 'release' && (comm.status === 'pending' || comm.status === 'on_hold')) {
        const amt = comm.commissionAmountPaisa;
        wallet.pendingPaisa = Math.max(0, wallet.pendingPaisa - amt);
        wallet.availablePaisa += amt;
        wallet.lifetimeEarnedPaisa += amt;
        wallet.updatedAt = nowIso;
        comm.status = 'available';
        comm.statusReason = reason;
        comm.releasedAt = nowIso;
        comm.updatedAt = nowIso;
        appendLedgerEntry(store, {
          idempotencyKey: `admin-release:${comm.id}:${nowIso}`,
          partnerId: partner.id,
          affiliateId: partner.affiliateId,
          entryType: 'commission_available',
          amountPaisa: amt,
          bucket: 'available',
          balanceAfterPaisa: wallet.availablePaisa,
          referenceType: 'commission',
          referenceId: comm.id,
          description: `Admin released commission for ${comm.orderNumberMasked}: ${reason}`,
          actor: 'admin',
        });
        await notifyPartnerAndEmail(store, {
          eventKey: `comm-available:${comm.id}`,
          partner,
          recipientEmail: partner.customerEmail,
          recipientName: partner.fullName,
          category: 'commission',
          title: 'Commission Now Available for Withdrawal',
          message: `Your commission of ${formatInrFromPaisa(amt)} for order ${comm.orderNumberMasked} is now available in your Affiliate Wallet.`,
        });
      } else if (action === 'hold' && comm.status === 'pending') {
        comm.status = 'on_hold';
        comm.statusReason = reason;
        comm.updatedAt = nowIso;
        appendLedgerEntry(store, {
          idempotencyKey: `admin-hold:${comm.id}:${nowIso}`,
          partnerId: partner.id,
          affiliateId: partner.affiliateId,
          entryType: 'commission_hold',
          amountPaisa: 0,
          bucket: 'pending',
          balanceAfterPaisa: wallet.pendingPaisa,
          referenceType: 'commission',
          referenceId: comm.id,
          description: `Admin placed commission on hold: ${reason}`,
          actor: 'admin',
        });
      } else if (action === 'cancel' && ['pending', 'on_hold', 'available', 'under_review'].includes(comm.status)) {
        const prevStatus: AffiliateCommissionStatus = comm.status;
        const amt = comm.commissionAmountPaisa;
        if (prevStatus === 'available') {
          wallet.availablePaisa = Math.max(0, wallet.availablePaisa - amt);
        } else if (prevStatus === 'pending' || prevStatus === 'on_hold') {
          wallet.pendingPaisa = Math.max(0, wallet.pendingPaisa - amt);
        }
        wallet.updatedAt = nowIso;
        comm.status = 'cancelled';
        comm.commissionAmountPaisa = 0;
        comm.statusReason = reason;
        comm.updatedAt = nowIso;
        appendLedgerEntry(store, {
          idempotencyKey: `admin-cancel:${comm.id}:${nowIso}`,
          partnerId: partner.id,
          affiliateId: partner.affiliateId,
          entryType: 'commission_cancelled',
          amountPaisa: -amt,
          bucket: prevStatus === 'available' ? 'available' : 'pending',
          balanceAfterPaisa: prevStatus === 'available' ? wallet.availablePaisa : wallet.pendingPaisa,
          referenceType: 'commission',
          referenceId: comm.id,
          description: `Admin cancelled commission: ${reason}`,
          actor: 'admin',
        });
      } else {
        return res.status(400).json({ success: false, error: 'Unsupported or invalid commission transition.' });
      }

      appendAudit(store, 'admin', 'admin', `commission_${action}`, 'commission', comm.id, { reason });
      saveStore(store);
      return res.json({ success: true, commission: comm, wallet });
    });
  });

  // Admin: Process Withdrawal (mark Paid with transfer ref, or Reject restoring Available balance)
  router.patch('/admin/affiliate/withdrawals/:id', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    return withFinancialLock(async () => {
      const store = loadStore();
      const wd = store.withdrawals.find((w) => w.id === req.params.id);
      if (!wd) {
        return res.status(404).json({ success: false, error: 'Withdrawal request not found.' });
      }
      if (wd.status === 'paid' || wd.status === 'rejected') {
        return res.status(400).json({
          success: false,
          error: `Withdrawal ${wd.requestCode} is already finalized (${wd.status}).`,
        });
      }
      const partner = store.partners.find((p) => p.id === wd.partnerId);
      if (!partner) {
        return res.status(404).json({ success: false, error: 'Affiliate partner not found.' });
      }
      const wallet = ensureWallet(store, partner);
      const action = sanitizePlainText(req.body?.action, 32);
      const transferReference = sanitizePlainText(req.body?.transferReference, 120);
      const rejectionReason = sanitizePlainText(req.body?.rejectionReason || req.body?.reason, 500);
      const adminNotes = sanitizePlainText(req.body?.adminNotes, 500) || null;
      const nowIso = new Date().toISOString();

      if (action === 'mark_paid') {
        if (!transferReference) {
          return res.status(400).json({
            success: false,
            error: 'Bank transfer reference / UTR number is required to mark a withdrawal as Paid.',
          });
        }
        wallet.processingPaisa = Math.max(0, wallet.processingPaisa - wd.amountPaisa);
        wallet.totalWithdrawnPaisa += wd.amountPaisa;
        wallet.updatedAt = nowIso;

        wd.status = 'paid';
        wd.transferReference = transferReference;
        wd.adminNotes = adminNotes;
        wd.processedBy = 'admin';
        wd.processedAt = nowIso;

        appendLedgerEntry(store, {
          idempotencyKey: `wd-paid:${wd.id}`,
          partnerId: partner.id,
          affiliateId: partner.affiliateId,
          entryType: 'withdrawal_paid',
          amountPaisa: wd.amountPaisa,
          bucket: 'withdrawn',
          balanceAfterPaisa: wallet.totalWithdrawnPaisa,
          referenceType: 'withdrawal',
          referenceId: wd.id,
          description: `Manual bank transfer completed for ${wd.requestCode} (Ref: ${transferReference})`,
          actor: 'admin',
        });

        await notifyPartnerAndEmail(store, {
          eventKey: `wd-paid:${wd.id}`,
          partner,
          recipientEmail: partner.customerEmail,
          recipientName: partner.fullName,
          category: 'withdrawal',
          title: 'Affiliate Payout Completed',
          message: `Your withdrawal request ${wd.requestCode} for ${formatInrFromPaisa(wd.amountPaisa)} has been transferred to your verified bank account.`,
          highlightRows: [
            { label: 'Request Code', value: wd.requestCode },
            { label: 'Amount Paid', value: formatInrFromPaisa(wd.amountPaisa) },
            { label: 'Bank Reference / UTR', value: transferReference },
          ],
        });
      } else if (action === 'reject') {
        if (!rejectionReason) {
          return res.status(400).json({
            success: false,
            error: 'A rejection reason is mandatory when rejecting a withdrawal.',
          });
        }
        // Restore Processing -> Available
        wallet.processingPaisa = Math.max(0, wallet.processingPaisa - wd.amountPaisa);
        wallet.availablePaisa += wd.amountPaisa;
        wallet.updatedAt = nowIso;

        wd.status = 'rejected';
        wd.rejectionReason = rejectionReason;
        wd.adminNotes = adminNotes;
        wd.processedBy = 'admin';
        wd.processedAt = nowIso;

        appendLedgerEntry(store, {
          idempotencyKey: `wd-reject:${wd.id}`,
          partnerId: partner.id,
          affiliateId: partner.affiliateId,
          entryType: 'withdrawal_rejected_restore',
          amountPaisa: wd.amountPaisa,
          bucket: 'available',
          balanceAfterPaisa: wallet.availablePaisa,
          referenceType: 'withdrawal',
          referenceId: wd.id,
          description: `Withdrawal ${wd.requestCode} rejected; restored ${formatInrFromPaisa(wd.amountPaisa)} to Available balance (${rejectionReason})`,
          actor: 'admin',
        });

        await notifyPartnerAndEmail(store, {
          eventKey: `wd-rejected:${wd.id}`,
          partner,
          recipientEmail: partner.customerEmail,
          recipientName: partner.fullName,
          category: 'withdrawal',
          title: 'Withdrawal Request Rejected — Funds Restored',
          message: `Your withdrawal request ${wd.requestCode} for ${formatInrFromPaisa(wd.amountPaisa)} could not be processed. Reason: ${rejectionReason}. The full amount has been restored to your Available Wallet balance.`,
        });
      } else {
        return res.status(400).json({ success: false, error: 'Unsupported withdrawal action.' });
      }

      appendAudit(store, 'admin', 'admin', `withdrawal_${action}`, 'withdrawal', wd.id, {
        requestCode: wd.requestCode,
        transferReference,
        rejectionReason,
      });
      saveStore(store);

      return res.json({ success: true, withdrawal: wd, wallet });
    });
  });

  // Admin: Resolve Fraud Flag
  router.patch('/admin/affiliate/fraud/:id', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const store = loadStore();
    const flag = store.fraudFlags.find((f) => f.id === req.params.id);
    if (!flag) {
      return res.status(404).json({ success: false, error: 'Fraud flag not found.' });
    }
    const status = sanitizePlainText(req.body?.status, 32);
    if (!['open', 'investigating', 'cleared', 'confirmed_fraud'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid fraud flag status.' });
    }
    flag.status = status as AffiliateFraudFlagRecord['status'];
    flag.resolutionNotes = sanitizePlainText(req.body?.resolutionNotes, 600) || null;
    flag.resolvedBy = 'admin';
    flag.resolvedAt = new Date().toISOString();
    appendAudit(store, 'admin', 'admin', 'fraud_flag_updated', 'fraud_flag', flag.id, { status });
    saveStore(store);
    return res.json({ success: true, fraudFlag: flag });
  });

  // Admin: Create / Update Monthly Sales Target
  router.post('/admin/affiliate/targets', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const store = loadStore();
    const monthKey = sanitizePlainText(req.body?.monthKey || getMonthKey(), 10);
    const title = sanitizePlainText(req.body?.title, 120);
    const description = sanitizePlainText(req.body?.description, 400);
    const metricType =
      req.body?.metricType === 'delivered_sales_paisa'
        ? 'delivered_sales_paisa'
        : 'delivered_orders';
    const rawTarget = Number(req.body?.targetValue || 0);
    const targetValue =
      metricType === 'delivered_sales_paisa'
        ? inrToPaisa(rawTarget)
        : Math.max(1, Math.round(rawTarget));
    const rewardType = sanitizePlainText(req.body?.rewardType || 'cash_bonus', 32) as AffiliateSalesTarget['rewardType'];
    const rewardTitle = sanitizePlainText(req.body?.rewardTitle, 120);
    const rewardValuePaisa = inrToPaisa(Number(req.body?.rewardValueInr || 0));

    if (!title || !rewardTitle || targetValue <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Target title, target value, and reward title are required.',
      });
    }

    const target: AffiliateSalesTarget = {
      id: crypto.randomUUID(),
      monthKey,
      title,
      description,
      metricType,
      targetValue,
      rewardType,
      rewardTitle,
      rewardValuePaisa,
      active: true,
      createdAt: new Date().toISOString(),
    };
    store.targets.unshift(target);
    appendAudit(store, 'admin', 'admin', 'sales_target_created', 'target', target.id, {
      monthKey,
      title,
    });
    saveStore(store);

    return res.status(201).json({ success: true, target });
  });

  // Admin: Award Reward (Cash bonus auto-credits Available Wallet)
  router.post('/admin/affiliate/rewards/award', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    return withFinancialLock(async () => {
      const store = loadStore();
      const partnerId = sanitizePlainText(req.body?.partnerId, 80);
      const partner = store.partners.find((p) => p.id === partnerId || p.affiliateId === partnerId);
      if (!partner) {
        return res.status(404).json({ success: false, error: 'Partner not found.' });
      }
      const rewardType = sanitizePlainText(req.body?.rewardType || 'cash_bonus', 32) as AffiliateRewardRecord['rewardType'];
      const rewardTitle = sanitizePlainText(req.body?.rewardTitle, 140);
      const rewardValuePaisa = inrToPaisa(Number(req.body?.rewardValueInr || 0));
      const periodLabel = sanitizePlainText(req.body?.periodLabel || getMonthKey(), 40);
      const sourceType = (sanitizePlainText(req.body?.sourceType || 'monthly_target', 32) as AffiliateRewardRecord['sourceType']);
      const notes = sanitizePlainText(req.body?.notes, 400) || null;

      if (!rewardTitle) {
        return res.status(400).json({ success: false, error: 'Reward title is required.' });
      }

      const nowIso = new Date().toISOString();
      const reward: AffiliateRewardRecord = {
        id: crypto.randomUUID(),
        partnerId: partner.id,
        affiliateId: partner.affiliateId,
        partnerName: partner.fullName,
        sourceType,
        sourceRefId: sanitizePlainText(req.body?.sourceRefId, 80) || null,
        periodLabel,
        rewardType,
        rewardTitle,
        rewardValuePaisa,
        status: rewardType === 'cash_bonus' && rewardValuePaisa > 0 ? 'credited' : 'approved',
        notes,
        awardedBy: 'admin',
        awardedAt: nowIso,
      };
      store.rewards.unshift(reward);

      if (rewardType === 'cash_bonus' && rewardValuePaisa > 0) {
        const wallet = ensureWallet(store, partner);
        wallet.availablePaisa += rewardValuePaisa;
        wallet.lifetimeEarnedPaisa += rewardValuePaisa;
        wallet.updatedAt = nowIso;
        appendLedgerEntry(store, {
          idempotencyKey: `reward-credit:${reward.id}`,
          partnerId: partner.id,
          affiliateId: partner.affiliateId,
          entryType: 'reward_bonus_credit',
          amountPaisa: rewardValuePaisa,
          bucket: 'available',
          balanceAfterPaisa: wallet.availablePaisa,
          referenceType: 'reward',
          referenceId: reward.id,
          description: `Reward bonus credited: ${rewardTitle} (${periodLabel})`,
          actor: 'admin',
        });
      }

      await notifyPartnerAndEmail(store, {
        eventKey: `reward-awarded:${reward.id}`,
        partner,
        recipientEmail: partner.customerEmail,
        recipientName: partner.fullName,
        category: 'reward',
        title: `Reward Awarded: ${rewardTitle}`,
        message:
          rewardType === 'cash_bonus' && rewardValuePaisa > 0
            ? `Congratulations! You have earned "${rewardTitle}" (${formatInrFromPaisa(rewardValuePaisa)}), which has been credited to your Available Affiliate Wallet.`
            : `Congratulations! You have been awarded "${rewardTitle}" for ${periodLabel}.`,
      });

      appendAudit(store, 'admin', 'admin', 'reward_awarded', 'reward', reward.id, {
        affiliateId: partner.affiliateId,
        rewardTitle,
        rewardValuePaisa,
      });
      saveStore(store);

      return res.status(201).json({ success: true, reward });
    });
  });

  // Admin: Post Announcement
  router.post('/admin/affiliate/announcements', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const store = loadStore();
    const title = sanitizePlainText(req.body?.title, 140);
    const message = sanitizePlainText(req.body?.message, 1200);
    const priority = req.body?.priority === 'important' ? 'important' : 'normal';
    if (!title || !message) {
      return res.status(400).json({ success: false, error: 'Title and message are required.' });
    }
    const ann: AffiliateAnnouncementRecord = {
      id: crypto.randomUUID(),
      title,
      message,
      priority,
      active: true,
      createdAt: new Date().toISOString(),
    };
    store.announcements.unshift(ann);
    // Notify active partners in dashboard
    for (const p of store.partners.filter((x) => x.status === 'active')) {
      store.notifications.unshift({
        id: crypto.randomUUID(),
        partnerId: p.id,
        affiliateId: p.affiliateId,
        category: 'announcement',
        title,
        message,
        isRead: false,
        createdAt: ann.createdAt,
      });
    }
    saveStore(store);
    return res.status(201).json({ success: true, announcement: ann });
  });

  // Admin: Reply / Update Support Ticket
  router.patch('/admin/affiliate/support/:id', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const store = loadStore();
    const ticket = store.tickets.find((t) => t.id === req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found.' });
    }
    const reply = sanitizePlainText(req.body?.reply, 1500);
    const status = sanitizePlainText(req.body?.status, 32);
    const nowIso = new Date().toISOString();

    if (reply) {
      ticket.messages.push({
        id: crypto.randomUUID(),
        senderRole: 'admin',
        senderName: 'TeqqnoWorld Affiliate Support',
        message: reply,
        createdAt: nowIso,
      });
    }
    if (['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
      ticket.status = status as AffiliateSupportTicket['status'];
    }
    ticket.updatedAt = nowIso;

    const partner = store.partners.find((p) => p.id === ticket.partnerId);
    if (partner && reply) {
      await notifyPartnerAndEmail(store, {
        eventKey: `ticket-reply:${ticket.id}:${ticket.messages.length}`,
        partner,
        recipientEmail: partner.customerEmail,
        recipientName: partner.fullName,
        category: 'support',
        title: `Support Reply — ${ticket.ticketNumber}`,
        message: reply,
      });
    }
    saveStore(store);
    return res.json({ success: true, ticket });
  });

  // Admin: Update Global Affiliate Program Settings
  router.put('/admin/affiliate/settings', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const store = loadStore();
    const s = store.settings;

    if (typeof req.body?.programEnabled === 'boolean') s.programEnabled = req.body.programEnabled;
    if (typeof req.body?.programPaused === 'boolean') s.programPaused = req.body.programPaused;
    if (typeof req.body?.registrationOpen === 'boolean') s.registrationOpen = req.body.registrationOpen;
    if (req.body?.affiliateIdPrefix) {
      s.affiliateIdPrefix = sanitizePlainText(req.body.affiliateIdPrefix, 16).toUpperCase();
    }
    if (req.body?.affiliateIdDigits !== undefined) {
      const digits = Math.round(Number(req.body.affiliateIdDigits));
      if (digits >= 4 && digits <= 10) s.affiliateIdDigits = digits;
    }
    if (req.body?.cookieDurationDays !== undefined) {
      const days = Math.round(Number(req.body.cookieDurationDays));
      if (days >= 1 && days <= 365) s.cookieDurationDays = days;
    }
    if (req.body?.returnPeriodDays !== undefined) {
      const days = Math.round(Number(req.body.returnPeriodDays));
      if (days >= 0 && days <= 90) s.returnPeriodDays = days;
    }
    if (req.body?.minWithdrawalInr !== undefined) {
      const paisa = inrToPaisa(Number(req.body.minWithdrawalInr));
      if (paisa >= 100) s.minWithdrawalPaisa = paisa;
    }
    if (req.body?.defaultCommissionRatePct !== undefined) {
      const rate = Number(req.body.defaultCommissionRatePct);
      if (Number.isFinite(rate) && rate >= 0 && rate <= 50) {
        s.defaultCommissionRatePct = Math.round(rate * 100) / 100;
      }
    }
    s.updatedAt = new Date().toISOString();

    appendAudit(store, 'admin', 'admin', 'program_settings_updated', 'settings', 'default', { ...s });
    saveStore(store);

    return res.json({ success: true, settings: s });
  });

  return router;
}
