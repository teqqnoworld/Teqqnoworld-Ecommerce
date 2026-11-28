import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { type Request, type Response, type Router } from 'express';
import {
  CANONICAL_PRODUCT_CATALOG,
  type SupabaseCatalogProductRow,
} from './productPricing.ts';

// ==============================================================================
// TYPES & CONSTANTS
// ==============================================================================

export type CustomOrderStatus =
  | 'pending'
  | 'approved'
  | 'in-production'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

export const ALLOWED_CUSTOM_ORDER_STATUSES: readonly CustomOrderStatus[] = [
  'pending',
  'approved',
  'in-production',
  'dispatched',
  'delivered',
  'cancelled',
] as const;

export const ALLOWED_STATUS_TRANSITIONS: Record<CustomOrderStatus, readonly CustomOrderStatus[]> = {
  pending: ['pending', 'approved', 'in-production', 'dispatched', 'delivered', 'cancelled'],
  approved: ['approved', 'in-production', 'dispatched', 'delivered', 'cancelled'],
  'in-production': ['in-production', 'dispatched', 'delivered', 'cancelled'],
  dispatched: ['dispatched', 'delivered'],
  delivered: ['delivered'],
  cancelled: ['cancelled'],
};

export interface CustomOrderDbRow {
  id: string;
  customer_name: string;
  customer_email: string;
  company: string | null;
  phone: string;
  product_id: string | null;
  quantity: number;
  logo_url: string | null;
  custom_notes: string | null;
  status: CustomOrderStatus | string;
  courier_partner?: string | null;
  tracking_number?: string | null;
  order_group_id?: string | null;
  line_subtotal_inr?: number | null;
  line_total_inr?: number | null;
  coupon_code?: string | null;
  discount_inr?: number | null;
  shipping_saved_inr?: number | null;
  final_total_inr?: number | null;
  amount_paid_inr?: number | null;
  balance_due_inr?: number | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  reservation_id?: string | null;
  created_at: string;
}

export interface AdminOrderProjection {
  id: string;
  customer_name: string;
  customer_email: string;
  company: string | null;
  phone: string;
  product_id: string | null;
  quantity: number;
  logo_url: string | null;
  custom_notes: string | null;
  status: CustomOrderStatus;
  courier_partner: string | null;
  tracking_number: string | null;
  order_group_id: string | null;
  line_subtotal_inr: number | null;
  line_total_inr: number | null;
  coupon_code: string | null;
  discount_inr: number | null;
  shipping_saved_inr: number | null;
  final_total_inr: number | null;
  amount_paid_inr: number | null;
  balance_due_inr: number | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  reservation_id: string | null;
  created_at: string;
}

export interface CustomerOrderProjection {
  id: string;
  customer_name: string;
  customer_email: string;
  company: string | null;
  phone: string;
  product_id: string | null;
  quantity: number;
  logo_url: string | null;
  custom_notes: string | null;
  status: CustomOrderStatus;
  courier_partner: string | null;
  tracking_number: string | null;
  order_group_id: string | null;
  line_subtotal_inr: number | null;
  line_total_inr: number | null;
  coupon_code: string | null;
  discount_inr: number | null;
  shipping_saved_inr: number | null;
  final_total_inr: number | null;
  amount_paid_inr: number | null;
  balance_due_inr: number | null;
  created_at: string;
}

/**
 * Strictly sanitized public tracking payload — NEVER contains customer PII
 * (no customer_email, customer_name, phone, company, street address,
 * custom_notes, payment secrets, or raw DB rows).
 */
export interface PublicOrderTrackingPayload {
  orderId: string;
  orderNumber: string;
  status: CustomOrderStatus;
  proofStatus: string;
  orderStatus: string;
  courierPartner: string;
  trackingNumber: string | null;
  createdAt: string;
  estimatedDispatch: string;
  quantity: number;
  productId: string | null;
}

export interface VerifiedCustomerSessionLike {
  customerId: string;
  email: string;
  phone?: string;
  accountType?: 'individual' | 'business';
  fullName?: string;
}

export interface CustomOrdersStorageAdapter {
  listAllOrders: (limit: number, status?: CustomOrderStatus) => Promise<CustomOrderDbRow[]>;
  getOrderById: (orderId: string) => Promise<CustomOrderDbRow | null>;
  findOrdersForCustomer: (identity: { email?: string; phoneLast10?: string }) => Promise<CustomOrderDbRow[]>;
  findOrdersByReference: (orderRef: string) => Promise<CustomOrderDbRow[]>;
  updateOrderStatus: (
    orderId: string,
    patch: {
      status: CustomOrderStatus;
      courier_partner?: string | null;
      tracking_number?: string | null;
    }
  ) => Promise<CustomOrderDbRow | null>;
  insertQuoteOrder: (record: {
    customer_name: string;
    customer_email: string;
    company: string | null;
    phone: string;
    product_id: string | null;
    quantity: number;
    logo_url: string | null;
    custom_notes: string | null;
    status: 'pending';
  }) => Promise<{ id: string; tableUsed: 'custom_orders' }>;
  insertAppointmentOrFallback: (record: {
    name: string;
    email: string;
    phone: string;
    company: string | null;
    appointment_date: string;
    appointment_time: string;
    service_type: string;
    meeting_mode: string;
    estimated_quantity: number | null;
    notes: string | null;
  }) => Promise<{ id: string; tableUsed: 'appointments' | 'custom_orders' }>;
}

export interface CustomOrdersRouterDeps {
  verifyAdminRequest: (req: Request) => { valid: boolean; email?: string };
  verifyCustomerJwt: (req: Request) => Promise<VerifiedCustomerSessionLike | null>;
  isProduction: () => boolean;
  getSupabaseAdminConfig: () => { configured: boolean; url: string; serviceRoleKey: string };
  buildSupabaseAdminHeaders: (
    serviceRoleKey: string,
    extra?: Record<string, string>
  ) => Record<string, string>;
  fetchSupabaseProductCatalog?: () => Promise<Map<string, SupabaseCatalogProductRow> | null>;
  storage?: CustomOrdersStorageAdapter;
  rateLimits?: {
    trackMaxRequests?: number;
    trackWindowMs?: number;
    quoteMaxRequests?: number;
    quoteWindowMs?: number;
  };
}

// ==============================================================================
// WHATSAPP ORDER ACTION SIGNED EXPIRING HMAC TOKENS (WITH REPLAY PROTECTION)
// ==============================================================================

const DEFAULT_ORDER_ACTION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function createExpiringOrderActionToken(
  orderId: string,
  action: 'confirm' | 'cancel',
  secret: string,
  ttlMs = DEFAULT_ORDER_ACTION_TTL_MS,
  nowMs = Date.now()
): string {
  const cleanOrderId = String(orderId || '').trim();
  const expUnixSec = Math.floor((nowMs + Math.max(1_000, ttlMs)) / 1000);
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`v2:${cleanOrderId}:${action}:${expUnixSec}`)
    .digest('hex')
    .slice(0, 32);
  return `${expUnixSec}.${sig}`;
}

export function verifyExpiringOrderActionToken(
  orderId: string,
  action: 'confirm' | 'cancel',
  token: string | undefined,
  secret: string,
  nowMs = Date.now()
): { valid: boolean; expired?: boolean; reason?: string } {
  const cleanToken = String(token || '').trim();
  const cleanOrderId = String(orderId || '').trim();
  if (!cleanToken || !cleanOrderId) {
    return { valid: false, reason: 'Missing order action token.' };
  }

  const dotIdx = cleanToken.indexOf('.');
  if (dotIdx <= 0) {
    return { valid: false, reason: 'Malformed or unsigned order action token.' };
  }

  const expPart = cleanToken.slice(0, dotIdx);
  const sigPart = cleanToken.slice(dotIdx + 1);
  if (!/^\d{9,13}$/.test(expPart) || !/^[a-f0-9]{32}$/i.test(sigPart)) {
    return { valid: false, reason: 'Invalid order action token format.' };
  }

  const expUnixSec = Number(expPart);
  if (!Number.isFinite(expUnixSec)) {
    return { valid: false, reason: 'Invalid token expiry timestamp.' };
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`v2:${cleanOrderId}:${action}:${expUnixSec}`)
    .digest('hex')
    .slice(0, 32);

  const bufA = Buffer.from(expectedSig, 'utf8');
  const bufB = Buffer.from(sigPart.toLowerCase(), 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return { valid: false, reason: 'Invalid order action token signature.' };
  }

  if (expUnixSec * 1000 < nowMs) {
    return { valid: false, expired: true, reason: 'This order action link has expired.' };
  }

  return { valid: true };
}

export interface SignedWhatsAppActionResult {
  ok: boolean;
  httpStatus: number;
  code?: string;
  message: string;
  targetStatus?: 'confirmed' | 'cancelled';
  dbUpdated?: boolean;
  dbOrderStatus?: CustomOrderStatus;
}

/**
 * Verifies an expiring HMAC WhatsApp order action token, enforces single-use replay
 * protection, validates permitted order transitions, and updates `public.custom_orders`
 * strictly on the server using the trusted storage adapter (service_role).
 */
export async function processSignedWhatsAppOrderAction(params: {
  orderId: string;
  action: 'confirm' | 'cancel';
  token?: string;
  secret: string;
  nowMs?: number;
  hasConsumedToken: (tokenHash: string) => boolean;
  markTokenConsumed: (tokenHash: string, metadata: { orderId: string; action: 'confirm' | 'cancel'; usedAt: string }) => void;
  storage?: Pick<CustomOrdersStorageAdapter, 'getOrderById' | 'updateOrderStatus'> | null;
}): Promise<SignedWhatsAppActionResult> {
  const cleanOrderId = String(params.orderId || '').trim();
  const cleanAction = params.action;
  const nowMs = params.nowMs ?? Date.now();

  if (!cleanOrderId || (cleanAction !== 'confirm' && cleanAction !== 'cancel')) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'INVALID_ACTION_REQUEST',
      message: 'Valid action (confirm/cancel) and orderId are required.',
    };
  }

  const verification = verifyExpiringOrderActionToken(
    cleanOrderId,
    cleanAction,
    params.token,
    params.secret,
    nowMs
  );

  if (!verification.valid) {
    return {
      ok: false,
      httpStatus: 403,
      code: verification.expired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
      message: verification.reason || 'Invalid or expired WhatsApp order action token.',
    };
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(`${cleanOrderId}:${cleanAction}:${String(params.token).trim()}`)
    .digest('hex');

  if (params.hasConsumedToken(tokenHash)) {
    return {
      ok: false,
      httpStatus: 409,
      code: 'TOKEN_ALREADY_USED',
      message: 'This WhatsApp order action link has already been used.',
    };
  }

  const targetStatus: 'confirmed' | 'cancelled' =
    cleanAction === 'confirm' ? 'confirmed' : 'cancelled';
  const desiredDbStatus: CustomOrderStatus =
    cleanAction === 'confirm' ? 'approved' : 'cancelled';

  let dbUpdated = false;
  let dbOrderStatus: CustomOrderStatus | undefined;

  if (params.storage) {
    const existing = await params.storage.getOrderById(cleanOrderId).catch(() => null);
    if (existing) {
      const current = normalizeOrderStatus(existing.status);
      // Only allow confirm from pending/approved, and cancel before dispatch/delivery
      const canApply =
        cleanAction === 'confirm'
          ? current === 'pending' || current === 'approved'
          : current === 'pending' || current === 'approved' || current === 'in-production';

      if (!canApply) {
        return {
          ok: false,
          httpStatus: 409,
          code: 'ORDER_STATE_NOT_ELIGIBLE',
          message: `Order cannot be ${targetStatus} because its current status is "${current}".`,
        };
      }

      if (current !== desiredDbStatus) {
        const updated = await params.storage.updateOrderStatus(cleanOrderId, {
          status: desiredDbStatus,
        });
        dbUpdated = Boolean(updated);
        dbOrderStatus = updated ? normalizeOrderStatus(updated.status) : current;
      } else {
        dbOrderStatus = current;
      }
    }
  }

  params.markTokenConsumed(tokenHash, {
    orderId: cleanOrderId,
    action: cleanAction,
    usedAt: new Date(nowMs).toISOString(),
  });

  return {
    ok: true,
    httpStatus: 200,
    targetStatus,
    dbUpdated,
    dbOrderStatus,
    message:
      targetStatus === 'confirmed'
        ? 'Order confirmed! Production & proof verification queued.'
        : 'Order has been marked cancelled per your WhatsApp request.',
  };
}

// ==============================================================================
// SANITIZATION, VALIDATION & PROJECTION HELPERS
// ==============================================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeOrderStatus(raw: unknown): CustomOrderStatus {
  const s = String(raw || '').trim().toLowerCase() as CustomOrderStatus;
  return (ALLOWED_CUSTOM_ORDER_STATUSES as readonly string[]).includes(s) ? s : 'pending';
}

export function isAllowedOrderStatus(raw: unknown): raw is CustomOrderStatus {
  return (ALLOWED_CUSTOM_ORDER_STATUSES as readonly string[]).includes(
    String(raw || '').trim().toLowerCase()
  );
}

export function isValidStatusTransition(
  currentStatus: CustomOrderStatus,
  nextStatus: CustomOrderStatus
): boolean {
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

export function formatOrderNumber(orderId: string): string {
  const clean = String(orderId || '').trim();
  if (!clean) return 'TQ-ORDER';
  if (clean.toUpperCase().startsWith('TQ-')) return clean.toUpperCase();
  return `TQ-${clean.slice(0, 8).toUpperCase()}`;
}

export function normalizeEmail(raw: unknown): string {
  return String(raw || '').trim().toLowerCase();
}

export function extractPhoneLast10(raw: unknown): string {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (digits.length < 10) return '';
  return digits.slice(-10);
}

export function sanitizePlainText(raw: unknown, maxLength: number): string {
  return String(raw ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeOptionalUrl(raw: unknown): string | null {
  const clean = String(raw ?? '').trim();
  if (!clean) return null;
  if (clean.startsWith('/') && !clean.startsWith('//')) {
    return clean.slice(0, 500);
  }
  try {
    const parsed = new URL(clean);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().slice(0, 500);
    }
  } catch {
    // invalid URL
  }
  return null;
}

export function normalizeCourierName(partner?: string | null): string {
  if (!partner || /bluedart|blue\s*dart/i.test(partner)) return 'Delhivery Express';
  return sanitizePlainText(partner, 80) || 'Delhivery Express';
}

export function toAdminOrderProjection(row: CustomOrderDbRow): AdminOrderProjection {
  return {
    id: String(row.id),
    customer_name: String(row.customer_name || ''),
    customer_email: String(row.customer_email || ''),
    company: row.company ?? null,
    phone: String(row.phone || ''),
    product_id: row.product_id ?? null,
    quantity: Number(row.quantity) || 1,
    logo_url: row.logo_url ?? null,
    custom_notes: row.custom_notes ?? null,
    status: normalizeOrderStatus(row.status),
    courier_partner: row.courier_partner ?? null,
    tracking_number: row.tracking_number ?? null,
    order_group_id: row.order_group_id ?? null,
    line_subtotal_inr: row.line_subtotal_inr ?? null,
    line_total_inr: row.line_total_inr ?? null,
    coupon_code: row.coupon_code ?? null,
    discount_inr: row.discount_inr ?? null,
    shipping_saved_inr: row.shipping_saved_inr ?? null,
    final_total_inr: row.final_total_inr ?? null,
    amount_paid_inr: row.amount_paid_inr ?? null,
    balance_due_inr: row.balance_due_inr ?? null,
    razorpay_order_id: row.razorpay_order_id ?? null,
    razorpay_payment_id: row.razorpay_payment_id ?? null,
    reservation_id: row.reservation_id ?? null,
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

export function toCustomerOrderProjection(row: CustomOrderDbRow): CustomerOrderProjection {
  return {
    id: String(row.id),
    customer_name: String(row.customer_name || ''),
    customer_email: String(row.customer_email || ''),
    company: row.company ?? null,
    phone: String(row.phone || ''),
    product_id: row.product_id ?? null,
    quantity: Number(row.quantity) || 1,
    logo_url: row.logo_url ?? null,
    custom_notes: row.custom_notes ?? null,
    status: normalizeOrderStatus(row.status),
    courier_partner: row.courier_partner ?? null,
    tracking_number: row.tracking_number ?? null,
    order_group_id: row.order_group_id ?? null,
    line_subtotal_inr: row.line_subtotal_inr ?? null,
    line_total_inr: row.line_total_inr ?? null,
    coupon_code: row.coupon_code ?? null,
    discount_inr: row.discount_inr ?? null,
    shipping_saved_inr: row.shipping_saved_inr ?? null,
    final_total_inr: row.final_total_inr ?? null,
    amount_paid_inr: row.amount_paid_inr ?? null,
    balance_due_inr: row.balance_due_inr ?? null,
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

export function toPublicTrackingProjection(row: CustomOrderDbRow): PublicOrderTrackingPayload {
  const status = normalizeOrderStatus(row.status);
  const createdMs = Date.parse(row.created_at);
  const estimatedDispatchDate = new Date(
    (Number.isFinite(createdMs) ? createdMs : Date.now()) + 48 * 3600 * 1000
  )
    .toISOString()
    .split('T')[0];

  const proofStatus =
    status === 'approved' ||
    status === 'in-production' ||
    status === 'dispatched' ||
    status === 'delivered'
      ? 'Approved by Client'
      : status === 'cancelled'
        ? 'Cancelled'
        : 'Proof Ready - Needs Approval';

  const orderStatus =
    status === 'dispatched'
      ? 'Dispatched'
      : status === 'delivered'
        ? 'Delivered'
        : status === 'in-production'
          ? 'Manufacturing'
          : status === 'cancelled'
            ? 'Cancelled'
            : 'Artwork Verification';

  return {
    orderId: String(row.id),
    orderNumber: formatOrderNumber(row.id),
    status,
    proofStatus,
    orderStatus,
    courierPartner: normalizeCourierName(row.courier_partner),
    trackingNumber: row.tracking_number ? String(row.tracking_number).trim() : null,
    createdAt: String(row.created_at || new Date().toISOString()),
    estimatedDispatch: estimatedDispatchDate,
    quantity: Math.max(1, Number(row.quantity) || 1),
    productId: row.product_id ? String(row.product_id) : null,
  };
}

export function doesOrderMatchOwner(
  row: CustomOrderDbRow,
  identity: { email?: string; phoneLast10?: string }
): boolean {
  const targetEmail = normalizeEmail(identity.email);
  const targetPhone = extractPhoneLast10(identity.phoneLast10);
  if (!targetEmail && !targetPhone) return false;

  const rowEmail = normalizeEmail(row.customer_email);
  const rowPhone = extractPhoneLast10(row.phone);

  const emailMatches = Boolean(targetEmail && rowEmail && targetEmail === rowEmail);
  const phoneMatches = Boolean(targetPhone && rowPhone && targetPhone === rowPhone);
  return emailMatches || phoneMatches;
}

export function doesOrderMatchReference(row: CustomOrderDbRow, rawRef: string): boolean {
  const clean = String(rawRef || '').trim().toLowerCase();
  if (!clean) return false;
  const rowId = String(row.id || '').trim().toLowerCase();
  const orderNum = formatOrderNumber(row.id).toLowerCase();
  const awb = String(row.tracking_number || '').trim().toLowerCase();
  const groupId = String(row.order_group_id || '').trim().toLowerCase();

  if (rowId === clean || orderNum === clean) return true;
  if (awb && awb === clean) return true;
  if (groupId && groupId === clean) return true;

  // Match TQ-XXXXXXXX prefix against UUID start (8+ hex chars)
  const strippedPrefix = clean.startsWith('tq-') ? clean.slice(3) : clean;
  if (/^[a-f0-9]{8}$/i.test(strippedPrefix) && rowId.startsWith(strippedPrefix)) {
    return true;
  }
  return false;
}

function getClientIp(req: Request): string {
  const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.ip || req.socket?.remoteAddress || 'unknown';
}

function createSlidingWindowRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    check(key: string): { allowed: boolean; retryAfterSec: number } {
      const now = Date.now();
      const cutoff = now - windowMs;
      const existing = (hits.get(key) || []).filter((ts) => ts > cutoff);
      if (existing.length >= maxRequests) {
        const oldest = existing[0] || now;
        const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
        hits.set(key, existing);
        return { allowed: false, retryAfterSec };
      }
      existing.push(now);
      hits.set(key, existing);
      if (hits.size > 1000) {
        for (const [k, v] of hits.entries()) {
          if (v.every((ts) => ts <= cutoff)) hits.delete(k);
        }
      }
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

// ==============================================================================
// DEFAULT SUPABASE SERVICE-ROLE STORAGE ADAPTER (WITH DEV-ONLY LOCAL FALLBACK)
// ==============================================================================

const LOCAL_DEV_ORDERS_PATH = path.resolve(process.cwd(), '.data', 'custom-orders-dev.json');

function readLocalDevOrders(): CustomOrderDbRow[] {
  try {
    if (!fs.existsSync(LOCAL_DEV_ORDERS_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(LOCAL_DEV_ORDERS_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalDevOrders(rows: CustomOrderDbRow[]): void {
  const dir = path.dirname(LOCAL_DEV_ORDERS_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(LOCAL_DEV_ORDERS_PATH, JSON.stringify(rows, null, 2), 'utf8');
}

function createSupabaseCustomOrdersStorage(
  deps: Pick<
    CustomOrdersRouterDeps,
    'getSupabaseAdminConfig' | 'buildSupabaseAdminHeaders' | 'isProduction'
  >
): CustomOrdersStorageAdapter {
  const requireServiceCfg = () => {
    const cfg = deps.getSupabaseAdminConfig();
    if (cfg.configured && cfg.url && cfg.serviceRoleKey) {
      return cfg;
    }
    if (deps.isProduction()) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not configured on the server; refusing insecure order access in production.'
      );
    }
    return null;
  };

  return {
    async listAllOrders(limit: number, status?: CustomOrderStatus): Promise<CustomOrderDbRow[]> {
      const cfg = requireServiceCfg();
      if (!cfg) {
        const local = readLocalDevOrders();
        const filtered = status ? local.filter((r) => normalizeOrderStatus(r.status) === status) : local;
        return filtered.slice(0, limit);
      }
      const params = new URLSearchParams();
      params.set('select', '*');
      params.set('order', 'created_at.desc');
      params.set('limit', String(limit));
      if (status) {
        params.set('status', `eq.${status}`);
      }
      const resp = await fetch(`${cfg.url}/rest/v1/custom_orders?${params.toString()}`, {
        method: 'GET',
        headers: deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`Failed to fetch orders (${resp.status}): ${errText.slice(0, 160)}`);
      }
      const rows = (await resp.json().catch(() => [])) as CustomOrderDbRow[];
      return Array.isArray(rows) ? rows : [];
    },

    async getOrderById(orderId: string): Promise<CustomOrderDbRow | null> {
      const cfg = requireServiceCfg();
      if (!cfg) {
        return readLocalDevOrders().find((r) => r.id === orderId) || null;
      }
      const resp = await fetch(
        `${cfg.url}/rest/v1/custom_orders?id=eq.${encodeURIComponent(orderId)}&select=*&limit=1`,
        {
          method: 'GET',
          headers: deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
        }
      );
      if (!resp.ok) return null;
      const rows = (await resp.json().catch(() => [])) as CustomOrderDbRow[];
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    },

    async findOrdersForCustomer(identity: {
      email?: string;
      phoneLast10?: string;
    }): Promise<CustomOrderDbRow[]> {
      const email = normalizeEmail(identity.email);
      const phoneLast10 = extractPhoneLast10(identity.phoneLast10);
      if (!email && !phoneLast10) return [];

      const cfg = requireServiceCfg();
      if (!cfg) {
        return readLocalDevOrders().filter((row) => doesOrderMatchOwner(row, { email, phoneLast10 }));
      }

      const orFilters: string[] = [];
      if (email) {
        const safeEmail = email.replace(/[,()]/g, '');
        if (safeEmail) orFilters.push(`customer_email.ilike.${safeEmail}`);
      }
      if (phoneLast10) {
        orFilters.push(`phone.ilike.*${phoneLast10}*`);
      }
      if (orFilters.length === 0) return [];

      const params = new URLSearchParams();
      params.set('select', '*');
      params.set('or', `(${orFilters.join(',')})`);
      params.set('order', 'created_at.desc');
      params.set('limit', '100');

      const resp = await fetch(`${cfg.url}/rest/v1/custom_orders?${params.toString()}`, {
        method: 'GET',
        headers: deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`Failed to fetch customer orders (${resp.status}): ${errText.slice(0, 160)}`);
      }
      const rows = (await resp.json().catch(() => [])) as CustomOrderDbRow[];
      // Defense-in-depth: re-verify exact ownership match in Node.js (blocks wildcard/substring bypasses)
      return (Array.isArray(rows) ? rows : []).filter((row) =>
        doesOrderMatchOwner(row, { email, phoneLast10 })
      );
    },

    async findOrdersByReference(orderRef: string): Promise<CustomOrderDbRow[]> {
      const clean = String(orderRef || '').trim();
      if (!clean) return [];

      const cfg = requireServiceCfg();
      if (!cfg) {
        return readLocalDevOrders().filter((row) => doesOrderMatchReference(row, clean));
      }

      const headers = deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey);

      // 1. Direct UUID match
      if (UUID_RE.test(clean)) {
        const resp = await fetch(
          `${cfg.url}/rest/v1/custom_orders?id=eq.${encodeURIComponent(clean)}&select=*&limit=5`,
          { method: 'GET', headers }
        );
        if (resp.ok) {
          const rows = (await resp.json().catch(() => [])) as CustomOrderDbRow[];
          if (Array.isArray(rows) && rows.length > 0) return rows;
        }
      }

      // 2. Tracking number (AWB) exact case-insensitive match
      const awbResp = await fetch(
        `${cfg.url}/rest/v1/custom_orders?tracking_number=ilike.${encodeURIComponent(clean)}&select=*&limit=5`,
        { method: 'GET', headers }
      );
      if (awbResp.ok) {
        const rows = (await awbResp.json().catch(() => [])) as CustomOrderDbRow[];
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.filter((r) => doesOrderMatchReference(r, clean));
        }
      }

      // 3. TQ-XXXXXXXX prefix / order_group_id fallback (scans recent orders server-side only)
      const recentResp = await fetch(
        `${cfg.url}/rest/v1/custom_orders?select=*&order=created_at.desc&limit=500`,
        { method: 'GET', headers }
      );
      if (!recentResp.ok) return [];
      const recent = (await recentResp.json().catch(() => [])) as CustomOrderDbRow[];
      return (Array.isArray(recent) ? recent : []).filter((r) => doesOrderMatchReference(r, clean));
    },

    async updateOrderStatus(
      orderId: string,
      patch: {
        status: CustomOrderStatus;
        courier_partner?: string | null;
        tracking_number?: string | null;
      }
    ): Promise<CustomOrderDbRow | null> {
      const cfg = requireServiceCfg();
      if (!cfg) {
        const local = readLocalDevOrders();
        const idx = local.findIndex((r) => r.id === orderId);
        if (idx === -1) return null;
        local[idx] = {
          ...local[idx],
          status: patch.status,
          ...(patch.courier_partner !== undefined ? { courier_partner: patch.courier_partner } : {}),
          ...(patch.tracking_number !== undefined ? { tracking_number: patch.tracking_number } : {}),
        };
        writeLocalDevOrders(local);
        return local[idx];
      }

      const headers = deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
        Prefer: 'return=representation',
      });
      const updatePayload: Record<string, unknown> = { status: patch.status };
      if (patch.courier_partner !== undefined) updatePayload.courier_partner = patch.courier_partner;
      if (patch.tracking_number !== undefined) updatePayload.tracking_number = patch.tracking_number;

      let resp = await fetch(
        `${cfg.url}/rest/v1/custom_orders?id=eq.${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify(updatePayload),
        }
      );

      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        // Graceful fallback if optional courier columns do not exist yet
        if (errText.includes('42703') || errText.includes('column') || errText.includes('schema cache')) {
          resp = await fetch(
            `${cfg.url}/rest/v1/custom_orders?id=eq.${encodeURIComponent(orderId)}`,
            {
              method: 'PATCH',
              headers,
              body: JSON.stringify({ status: patch.status }),
            }
          );
        } else {
          throw new Error(`Order update failed (${resp.status}): ${errText.slice(0, 160)}`);
        }
      }

      if (!resp.ok) {
        const errText2 = await resp.text().catch(() => '');
        throw new Error(`Order update failed (${resp.status}): ${errText2.slice(0, 160)}`);
      }

      const rows = (await resp.json().catch(() => [])) as CustomOrderDbRow[];
      return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    },

    async insertQuoteOrder(record): Promise<{ id: string; tableUsed: 'custom_orders' }> {
      const cfg = requireServiceCfg();
      if (!cfg) {
        const local = readLocalDevOrders();
        const newId = crypto.randomUUID();
        local.unshift({
          id: newId,
          ...record,
          courier_partner: null,
          tracking_number: null,
          created_at: new Date().toISOString(),
        });
        writeLocalDevOrders(local);
        return { id: newId, tableUsed: 'custom_orders' };
      }

      const resp = await fetch(`${cfg.url}/rest/v1/custom_orders`, {
        method: 'POST',
        headers: deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(record),
      });
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(`Quote persistence failed (${resp.status}): ${errText.slice(0, 160)}`);
      }
      const rows = (await resp.json().catch(() => [])) as CustomOrderDbRow[];
      const inserted = Array.isArray(rows) ? rows[0] : (rows as any);
      return { id: String(inserted?.id || crypto.randomUUID()), tableUsed: 'custom_orders' };
    },

    async insertAppointmentOrFallback(
      record
    ): Promise<{ id: string; tableUsed: 'appointments' | 'custom_orders' }> {
      const cfg = requireServiceCfg();
      const consultationNotes = `[Consultation: ${record.service_type} / ${record.meeting_mode} on ${record.appointment_date} at ${record.appointment_time}] ${record.notes || ''}`.trim();

      if (!cfg) {
        const fallback = await this.insertQuoteOrder({
          customer_name: record.name,
          customer_email: record.email,
          company: record.company,
          phone: record.phone,
          product_id: null,
          quantity: Math.max(1, record.estimated_quantity || 50),
          logo_url: null,
          custom_notes: consultationNotes,
          status: 'pending',
        });
        return { id: fallback.id, tableUsed: 'custom_orders' };
      }

      // 1. Try dedicated public.appointments table first via service_role
      const apptResp = await fetch(`${cfg.url}/rest/v1/appointments`, {
        method: 'POST',
        headers: deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
          Prefer: 'return=representation',
        }),
        body: JSON.stringify(record),
      });

      if (apptResp.ok) {
        const rows = (await apptResp.json().catch(() => [])) as any[];
        const inserted = Array.isArray(rows) ? rows[0] : rows;
        return { id: String(inserted?.id || crypto.randomUUID()), tableUsed: 'appointments' };
      }

      // 2. Safe fallback to public.custom_orders via service_role
      const fallback = await this.insertQuoteOrder({
        customer_name: record.name,
        customer_email: record.email,
        company: record.company,
        phone: record.phone,
        product_id: null,
        quantity: Math.max(1, record.estimated_quantity || 50),
        logo_url: null,
        custom_notes: consultationNotes,
        status: 'pending',
      });
      return { id: fallback.id, tableUsed: 'custom_orders' };
    },
  };
}

// ==============================================================================
// EXPRESS ROUTER FACTORY
// ==============================================================================

export function createCustomOrdersRouter(deps: CustomOrdersRouterDeps): {
  router: Router;
  storage: CustomOrdersStorageAdapter;
} {
  const router = express.Router();
  const storage = deps.storage || createSupabaseCustomOrdersStorage(deps);

  const trackLimiter = createSlidingWindowRateLimiter(
    deps.rateLimits?.trackMaxRequests ?? 15,
    deps.rateLimits?.trackWindowMs ?? 5 * 60 * 1000
  );
  const quoteLimiter = createSlidingWindowRateLimiter(
    deps.rateLimits?.quoteMaxRequests ?? 10,
    deps.rateLimits?.quoteWindowMs ?? 10 * 60 * 1000
  );

  // ----------------------------------------------------------------------------
  // 1. ADMIN: LIST ORDERS — GET /api/admin/orders
  // ----------------------------------------------------------------------------
  router.get('/admin/orders', async (req: Request, res: Response) => {
    const adminAuth = deps.verifyAdminRequest(req);
    if (!adminAuth.valid) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Valid Admin session token is required.',
      });
    }

    try {
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(500, Math.floor(rawLimit)))
        : 250;
      const rawStatus = req.query.status ? String(req.query.status).trim().toLowerCase() : '';
      let statusFilter: CustomOrderStatus | undefined;
      if (rawStatus && rawStatus !== 'all') {
        if (!isAllowedOrderStatus(rawStatus)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid order status filter.',
          });
        }
        statusFilter = rawStatus;
      }

      const rows = await storage.listAllOrders(limit, statusFilter);
      return res.json({
        success: true,
        orders: rows.map(toAdminOrderProjection),
      });
    } catch (err: any) {
      return res.status(503).json({
        success: false,
        message: err?.message || 'Unable to load orders from server.',
      });
    }
  });

  // ----------------------------------------------------------------------------
  // 2. ADMIN: UPDATE ORDER STATUS & DISPATCH — PATCH /api/admin/orders/:orderId/status
  // ----------------------------------------------------------------------------
  router.patch('/admin/orders/:orderId/status', async (req: Request, res: Response) => {
    const adminAuth = deps.verifyAdminRequest(req);
    if (!adminAuth.valid) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Valid Admin session token is required.',
      });
    }

    try {
      const orderId = sanitizePlainText(req.params.orderId, 80);
      if (!orderId) {
        return res.status(400).json({ success: false, message: 'Order ID is required.' });
      }

      const body = (req.body || {}) as Record<string, unknown>;
      if (!isAllowedOrderStatus(body.status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid order status. Allowed values: ${ALLOWED_CUSTOM_ORDER_STATUSES.join(', ')}.`,
        });
      }
      const nextStatus: CustomOrderStatus = normalizeOrderStatus(body.status);

      const existing = await storage.getOrderById(orderId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Order not found.',
        });
      }

      const currentStatus = normalizeOrderStatus(existing.status);
      if (!isValidStatusTransition(currentStatus, nextStatus)) {
        return res.status(422).json({
          success: false,
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition order from "${currentStatus}" to "${nextStatus}".`,
        });
      }

      const courierPartner =
        body.courierPartner !== undefined
          ? body.courierPartner === null
            ? null
            : sanitizePlainText(body.courierPartner, 80) || null
          : undefined;

      const trackingNumber =
        body.trackingNumber !== undefined
          ? body.trackingNumber === null
            ? null
            : sanitizePlainText(body.trackingNumber, 80) || null
          : undefined;

      const updated = await storage.updateOrderStatus(orderId, {
        status: nextStatus,
        ...(courierPartner !== undefined ? { courier_partner: courierPartner } : {}),
        ...(trackingNumber !== undefined ? { tracking_number: trackingNumber } : {}),
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Order not found.',
        });
      }

      return res.json({
        success: true,
        order: toAdminOrderProjection(updated),
      });
    } catch (err: any) {
      return res.status(502).json({
        success: false,
        message: err?.message || 'Failed to update order status.',
      });
    }
  });

  // ----------------------------------------------------------------------------
  // 3. CUSTOMER: VERIFIED ORDER HISTORY — GET /api/customer/orders
  // ----------------------------------------------------------------------------
  router.get('/customer/orders', async (req: Request, res: Response) => {
    const verifiedCustomer = await deps.verifyCustomerJwt(req);
    if (!verifiedCustomer) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to view your order history.',
      });
    }

    // STRICT: Derive identity ONLY from verified Supabase JWT claims.
    // Ignore any email, phone, or userId passed in req.query or req.body.
    const verifiedEmail = normalizeEmail(verifiedCustomer.email);
    const verifiedPhone = extractPhoneLast10(verifiedCustomer.phone);

    if (!verifiedEmail && !verifiedPhone) {
      return res.json({
        success: true,
        orders: [],
      });
    }

    try {
      const rows = await storage.findOrdersForCustomer({
        email: verifiedEmail || undefined,
        phoneLast10: verifiedPhone || undefined,
      });

      return res.json({
        success: true,
        orders: rows.map(toCustomerOrderProjection),
      });
    } catch (err: any) {
      return res.status(503).json({
        success: false,
        message: err?.message || 'Unable to load your order history right now.',
      });
    }
  });

  // ----------------------------------------------------------------------------
  // 4. PUBLIC / AUTHENTICATED ORDER TRACKING — POST /api/orders/track
  // ----------------------------------------------------------------------------
  router.post('/orders/track', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const rl = trackLimiter.check(`track:${ip}`);
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message: 'Too many tracking requests. Please wait a few minutes and try again.',
      });
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const orderRef = sanitizePlainText(body.orderRef ?? body.orderId ?? body.query, 80);
    const rawContact = sanitizePlainText(body.contact ?? body.email ?? body.phone, 160);

    if (!orderRef || orderRef.length < 4) {
      return res.status(400).json({
        success: false,
        code: 'INVALID_TRACKING_QUERY',
        message: 'Please enter a valid Order ID, TQ Order Number, or Delhivery AWB.',
      });
    }

    // Reject phone-only tracking queries explicitly
    const refDigitsOnly = orderRef.replace(/[^0-9]/g, '');
    const isLikelyPhoneOnly =
      /^[+\s\-()0-9]{10,15}$/.test(orderRef) &&
      (refDigitsOnly.length === 10 || (refDigitsOnly.length === 12 && refDigitsOnly.startsWith('91'))) &&
      !rawContact;
    if (isLikelyPhoneOnly) {
      return res.status(400).json({
        success: false,
        code: 'ORDER_REF_AND_CONTACT_REQUIRED',
        message:
          'Phone-only order lookup is not allowed. Please enter your Order ID / AWB together with your registered email or phone number.',
      });
    }

    const verifiedCustomer = await deps.verifyCustomerJwt(req);

    // Guest customers MUST provide BOTH orderRef AND matching contact (email or phone)
    let guestEmail = '';
    let guestPhoneLast10 = '';
    if (!verifiedCustomer) {
      if (!rawContact) {
        return res.status(400).json({
          success: false,
          code: 'CONTACT_VERIFICATION_REQUIRED',
          message:
            'Please provide both your Order ID / AWB and your registered email or phone number to track this order.',
        });
      }
      if (rawContact.includes('@')) {
        if (!EMAIL_RE.test(rawContact)) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_CONTACT',
            message: 'Please enter a valid registered email address or 10-digit phone number.',
          });
        }
        guestEmail = normalizeEmail(rawContact);
      } else {
        guestPhoneLast10 = extractPhoneLast10(rawContact);
        if (!guestPhoneLast10) {
          return res.status(400).json({
            success: false,
            code: 'INVALID_CONTACT',
            message: 'Please enter a valid registered email address or 10-digit phone number.',
          });
        }
      }
    }

    try {
      const candidates = await storage.findOrdersByReference(orderRef);

      const matched = candidates.find((row) => {
        if (!doesOrderMatchReference(row, orderRef)) return false;
        if (verifiedCustomer) {
          return doesOrderMatchOwner(row, {
            email: verifiedCustomer.email,
            phoneLast10: verifiedCustomer.phone,
          });
        }
        return doesOrderMatchOwner(row, {
          email: guestEmail || undefined,
          phoneLast10: guestPhoneLast10 || undefined,
        });
      });

      // Generic 404 prevents enumerating whether an order ID, email, or phone exists independently
      if (!matched) {
        return res.status(404).json({
          success: false,
          code: 'ORDER_NOT_FOUND',
          message:
            'No matching order was found. Please check your Order ID / AWB and registered contact details.',
        });
      }

      return res.json({
        success: true,
        tracking: toPublicTrackingProjection(matched),
      });
    } catch {
      return res.status(503).json({
        success: false,
        message: 'Order tracking is temporarily unavailable. Please try again shortly.',
      });
    }
  });

  // ----------------------------------------------------------------------------
  // 5. SECURE QUOTE, BULK RFQ & CONSULTATION SUBMISSION — POST /api/quotes/submit
  // ----------------------------------------------------------------------------
  router.post('/quotes/submit', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const adminAuth = deps.verifyAdminRequest(req);
    if (!adminAuth.valid) {
      const rl = quoteLimiter.check(`quote:${ip}`);
      if (!rl.allowed) {
        res.setHeader('Retry-After', String(rl.retryAfterSec));
        return res.status(429).json({
          success: false,
          code: 'RATE_LIMITED',
          message: 'Too many quote submissions from this network. Please wait a few minutes.',
        });
      }
    }

    const body = (req.body || {}) as Record<string, unknown>;
    const rawType = String(body.submissionType || 'quote').trim().toLowerCase();
    const submissionType: 'quote' | 'rfq' | 'consultation' =
      rawType === 'consultation' ? 'consultation' : rawType === 'rfq' ? 'rfq' : 'quote';

    const customerName = sanitizePlainText(body.customerName ?? body.name, 120);
    const customerEmail = normalizeEmail(body.customerEmail ?? body.email);
    const company = sanitizePlainText(body.company, 140) || null;
    const rawPhone = sanitizePlainText(body.phone, 24);
    const phoneDigits = extractPhoneLast10(rawPhone);
    const customNotes = sanitizePlainText(body.customNotes ?? body.notes, 1800) || null;
    const logoUrl = sanitizeOptionalUrl(body.logoUrl ?? body.existingLogoUrl);

    if (!customerName || customerName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your full name (at least 2 characters).',
      });
    }
    if (!customerEmail || !EMAIL_RE.test(customerEmail) || customerEmail.length > 180) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }
    if (!phoneDigits) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid 10-digit phone number.',
      });
    }

    try {
      if (submissionType === 'consultation') {
        const appointmentDate = sanitizePlainText(body.appointmentDate, 40);
        const appointmentTime = sanitizePlainText(body.appointmentTime, 40);
        const serviceType = sanitizePlainText(body.serviceType, 160);
        const meetingMode = sanitizePlainText(body.meetingMode, 80);
        const rawEstQty =
          body.estimatedQuantity !== undefined && body.estimatedQuantity !== null && body.estimatedQuantity !== ''
            ? Number(body.estimatedQuantity)
            : null;

        if (!appointmentDate || !appointmentTime || !serviceType || !meetingMode) {
          return res.status(400).json({
            success: false,
            message: 'Appointment date, time, service type, and meeting mode are required.',
          });
        }
        if (
          rawEstQty !== null &&
          (!Number.isInteger(rawEstQty) || rawEstQty < 1 || rawEstQty > 100000)
        ) {
          return res.status(400).json({
            success: false,
            message: 'Estimated quantity must be a whole number between 1 and 100,000.',
          });
        }

        const saved = await storage.insertAppointmentOrFallback({
          name: customerName,
          email: customerEmail,
          phone: rawPhone,
          company,
          appointment_date: appointmentDate,
          appointment_time: appointmentTime,
          service_type: serviceType,
          meeting_mode: meetingMode,
          estimated_quantity: rawEstQty,
          notes: customNotes,
        });

        return res.status(201).json({
          success: true,
          orderId: saved.id,
          orderNumber: formatOrderNumber(saved.id),
          tableUsed: saved.tableUsed,
        });
      }

      // Quote / Bulk RFQ path — strictly validate productId and quantity
      const productId = sanitizePlainText(body.productId, 80);
      const rawQty = Number(body.quantity);
      if (!Number.isInteger(rawQty) || rawQty < 1 || rawQty > 100000) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_QUANTITY',
          message: 'Quantity must be a whole number between 1 and 100,000.',
        });
      }

      const supabaseCatalog = deps.fetchSupabaseProductCatalog
        ? await deps.fetchSupabaseProductCatalog().catch(() => null)
        : null;
      const validProduct =
        Boolean(productId) &&
        (Boolean(CANONICAL_PRODUCT_CATALOG[productId]) || Boolean(supabaseCatalog?.has(productId)));

      if (!validProduct) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_PRODUCT',
          message: 'Selected product is not recognized in the active TeqqnoWorld catalog.',
        });
      }

      // Strict allowlist prevents mass assignment (client cannot inject status, pricing, razorpay IDs, etc.)
      const saved = await storage.insertQuoteOrder({
        customer_name: customerName,
        customer_email: customerEmail,
        company,
        phone: rawPhone,
        product_id: productId,
        quantity: rawQty,
        logo_url: logoUrl,
        custom_notes: customNotes,
        status: 'pending',
      });

      return res.status(201).json({
        success: true,
        orderId: saved.id,
        orderNumber: formatOrderNumber(saved.id),
      });
    } catch (err: any) {
      return res.status(503).json({
        success: false,
        message: err?.message || 'Unable to save your request right now. Please try again.',
      });
    }
  });

  return { router, storage };
}
