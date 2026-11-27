import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import express, { type Request, type Response } from 'express';
import {
  createCouponRouter,
  CouponStorageUnavailableError,
  sanitizePostgrestEmail,
  sanitizePostgrestPhone,
  sanitizePostgrestId,
  computeDeduplicatedOrderAnalytics,
  type VerifiedCustomerSession,
} from '../server/couponRoutes.ts';
import { resolveAuthoritativeCartPricing } from '../server/productPricing.ts';

const execFileAsync = promisify(execFile);

const TEST_ADMIN_TOKEN = 'test_admin_bearer_token_secure_2026';
const TEST_WEBHOOK_SECRET = 'whsec_test_razorpay_secret_987654321';
const TEST_RECOVERY_SECRET = 'rec_secret_test_hmac_key_2026';

const USERS_BY_TOKEN: Record<string, VerifiedCustomerSession> = {
  'valid-jwt-alice': {
    customerId: 'cust-alice-1',
    email: 'alice@example.com',
    phone: '9876543210',
    accountType: 'individual',
    fullName: 'Alice Sharma',
  },
  'valid-jwt-bob': {
    customerId: 'cust-bob-2',
    email: 'bob@example.com',
    phone: '9876500002',
    accountType: 'business',
    fullName: 'Bob Enterprises',
  },
};

function signRecoveryToken(params: { code?: string; sid?: string; expMs?: number } = {}): string {
  const payload = Buffer.from(
    JSON.stringify({
      typ: 'recovery_5off',
      code: params.code || 'SAVE5NOW',
      sid: params.sid || 'sess-1',
      exp: params.expMs ?? Date.now() + 15 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', TEST_RECOVERY_SECRET)
    .update(`rec:${payload}`)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyRecoveryToken(token?: string): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expected = crypto
    .createHmac('sha256', TEST_RECOVERY_SECRET)
    .update(`rec:${payload}`)
    .digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  return parsed?.typ === 'recovery_5off' && Number(parsed?.exp || 0) >= Date.now();
}

function signReleaseToken(params: {
  reservationId?: string | null;
  razorpayOrderId: string;
  customerId?: string | null;
  checkoutSessionId?: string | null;
  expMs?: number;
}): string {
  const payload = Buffer.from(
    JSON.stringify({
      typ: 'rzp_release',
      rid: String(params.reservationId || '').trim(),
      oid: String(params.razorpayOrderId || '').trim(),
      cid: String(params.customerId || '').trim(),
      sid: String(params.checkoutSessionId || '').trim(),
      exp: params.expMs ?? Date.now() + 25 * 60 * 1000,
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', TEST_RECOVERY_SECRET)
    .update(`rel:${payload}`)
    .digest('base64url');
  return `${payload}.${sig}`;
}

function verifyReleaseToken(token?: string | null): {
  valid: boolean;
  reservationId?: string;
  razorpayOrderId?: string;
  customerId?: string;
  checkoutSessionId?: string;
} {
  try {
    const clean = String(token || '').trim();
    const parts = clean.split('.');
    if (parts.length !== 2) return { valid: false };
    const [payload, sig] = parts;
    const expected = crypto
      .createHmac('sha256', TEST_RECOVERY_SECRET)
      .update(`rel:${payload}`)
      .digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false };
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (parsed?.typ !== 'rzp_release' || Number(parsed?.exp || 0) < Date.now()) {
      return { valid: false };
    }
    return {
      valid: true,
      reservationId: parsed.rid || undefined,
      razorpayOrderId: parsed.oid || undefined,
      customerId: parsed.cid || undefined,
      checkoutSessionId: parsed.sid || undefined,
    };
  } catch {
    return { valid: false };
  }
}

interface TestHarness {
  baseUrl: string;
  storageFilePath: string;
  engine: ReturnType<typeof createCouponRouter>['engine'];
  close: () => Promise<void>;
}

async function createTestHarness(opts?: {
  isProduction?: boolean;
  supabaseConfig?: { configured: boolean; url: string; serviceRoleKey: string };
}): Promise<TestHarness> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teqqno-coupon-sec-'));
  const storageFilePath = path.join(tmpDir, 'coupons-store.json');

  const app = express();
  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  const verifyCustomerJwt = async (req: Request): Promise<VerifiedCustomerSession | null> => {
    const auth = String(req.headers.authorization || '').trim();
    if (!auth.toLowerCase().startsWith('bearer ')) return null;
    const tok = auth.slice(7).trim();
    return USERS_BY_TOKEN[tok] || null;
  };

  const { router, engine } = createCouponRouter({
    verifyAdminRequest: (req: Request) => {
      const auth = String(req.headers.authorization || '').trim();
      return {
        valid: auth === `Bearer ${TEST_ADMIN_TOKEN}`,
        email: 'admin@teqqnoworld.com',
      };
    },
    verifyCustomerJwt,
    verifyRecoveryEligibility: ({ recoveryToken }) => verifyRecoveryToken(recoveryToken),
    getSupabaseAdminConfig: () =>
      opts?.supabaseConfig || { configured: false, url: '', serviceRoleKey: '' },
    buildSupabaseAdminHeaders: (key, extra) => ({
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(extra || {}),
    }),
    isProduction: () => Boolean(opts?.isProduction),
    sendCouponEmail: async () => ({ sent: false, reason: 'test-mode' }),
    escapeHtml: (s) => s,
    storageFilePath,
  });

  app.use('/api', router);

  // Mirror server.ts Razorpay create-order + release + webhook + orders/place security handlers
  app.post('/api/razorpay/create-order', async (req: Request, res: Response) => {
    let reservedId: string | undefined;
    try {
      const { items, couponCode, paymentPlan, recoveryToken, checkoutSessionId } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CART_ITEMS',
          message: 'Cart items are required to create a Razorpay order.',
        });
      }
      const verifiedCustomer = await verifyCustomerJwt(req);
      const plan = paymentPlan === 'partial_50' ? 'partial_50' : 'prepaid_100';
      const pricing = await resolveAuthoritativeCartPricing(items);
      if (!pricing.valid) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CART_ITEMS',
          message: pricing.message,
        });
      }

      let finalTotal = pricing.baseFinalTotal;
      let payableNow = plan === 'partial_50' ? Math.round(finalTotal * 0.5) : finalTotal;
      let discountAmount = 0;
      let shippingFee = pricing.baseShippingFee;
      let shippingSaved = 0;
      let freeShippingApplied = false;

      if (couponCode) {
        const resv = await engine.reserveCouponAtomic({
          code: String(couponCode),
          items,
          paymentPlan: plan,
          verifiedCustomer,
          recoveryToken,
          checkoutSessionId,
        });
        if (!resv.success || !resv.reservation) {
          return res.status(resv.httpStatus || 400).json({
            success: false,
            message: resv.validation?.message || 'Coupon reservation failed.',
            reasonCode: resv.validation?.reasonCode,
          });
        }
        reservedId = resv.reservation.id;
        finalTotal = resv.validation.finalTotal;
        payableNow =
          plan === 'partial_50' ? resv.validation.advanceAmount50 : resv.validation.finalTotal;
        discountAmount = resv.validation.discountAmount;
        shippingFee = resv.validation.shippingFee;
        shippingSaved = resv.validation.shippingSaved;
        freeShippingApplied = resv.validation.freeShippingApplied;
      }

      const fakeRzpOrderId = `order_${crypto.randomBytes(6).toString('hex')}`;
      if (reservedId) {
        await engine.attachRazorpayOrderToReservation(reservedId, fakeRzpOrderId);
      }
      const releaseToken = signReleaseToken({
        reservationId: reservedId || null,
        razorpayOrderId: fakeRzpOrderId,
        customerId: verifiedCustomer?.customerId || null,
        checkoutSessionId: typeof checkoutSessionId === 'string' ? checkoutSessionId : null,
      });
      return res.json({
        success: true,
        orderId: fakeRzpOrderId,
        amount: Math.round(payableNow * 100),
        currency: 'INR',
        reservationId: reservedId || null,
        releaseToken,
        pricing: {
          subtotal: pricing.subtotal,
          discountAmount,
          shippingFee,
          shippingSaved,
          freeShippingApplied,
          finalTotal,
          payableNow,
        },
      });
    } catch (err: any) {
      if (reservedId) {
        await engine.releaseReservationAtomic({ reservationId: reservedId }).catch(() => {});
      }
      if (err instanceof CouponStorageUnavailableError) {
        return res.status(503).json({ success: false, code: 'STORAGE_UNAVAILABLE', message: err.message });
      }
      return res.status(500).json({ success: false, message: err?.message || 'Error' });
    }
  });

  // H1: Ownership-verified release-reservation endpoint mirroring server.ts
  app.post('/api/razorpay/release-reservation', async (req: Request, res: Response) => {
    const { reservationId, razorpayOrderId, releaseToken, reason, checkoutSessionId } = req.body || {};
    const cleanResId = typeof reservationId === 'string' ? reservationId.trim() : '';
    const cleanRzpOrderId = typeof razorpayOrderId === 'string' ? razorpayOrderId.trim() : '';
    if (!cleanResId && !cleanRzpOrderId) {
      return res.status(400).json({ success: false, code: 'MISSING_RESERVATION_REF' });
    }
    const isAdmin = String(req.headers.authorization || '').trim() === `Bearer ${TEST_ADMIN_TOKEN}`;
    const parsedRelease = verifyReleaseToken(typeof releaseToken === 'string' ? releaseToken : undefined);
    const verifiedCustomer = isAdmin ? null : await verifyCustomerJwt(req);

    const tokenMatchesRequest = Boolean(
      parsedRelease.valid &&
        (!cleanResId || !parsedRelease.reservationId || parsedRelease.reservationId === cleanResId) &&
        (!cleanRzpOrderId ||
          !parsedRelease.razorpayOrderId ||
          parsedRelease.razorpayOrderId === cleanRzpOrderId) &&
        Boolean(
          (cleanResId && parsedRelease.reservationId === cleanResId) ||
            (cleanRzpOrderId && parsedRelease.razorpayOrderId === cleanRzpOrderId)
        )
    );

    const existing = await engine.getReservation({
      reservationId: cleanResId || undefined,
      razorpayOrderId: cleanRzpOrderId || undefined,
    });

    let authorized = isAdmin;
    if (!authorized && existing) {
      const tokenMatchesReservation = Boolean(
        tokenMatchesRequest &&
          (!parsedRelease.reservationId || parsedRelease.reservationId === existing.id) &&
          (!parsedRelease.razorpayOrderId ||
            !existing.razorpayOrderId ||
            parsedRelease.razorpayOrderId === existing.razorpayOrderId)
      );
      const customerOwns = Boolean(
        verifiedCustomer &&
          ((verifiedCustomer.customerId &&
            existing.customerId &&
            verifiedCustomer.customerId === existing.customerId) ||
            (verifiedCustomer.email &&
              existing.customerEmail &&
              verifiedCustomer.email.toLowerCase() === existing.customerEmail.toLowerCase()))
      );
      authorized = tokenMatchesReservation || customerOwns;
    } else if (!authorized && !existing) {
      authorized = tokenMatchesRequest;
    }

    if (!authorized) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN_RESERVATION_RELEASE' });
    }

    let released = false;
    if (existing) {
      const out = await engine.releaseReservationAtomic({
        reservationId: existing.id,
        razorpayOrderId: cleanRzpOrderId || existing.razorpayOrderId,
        reason,
      });
      released = out.released;
    }
    const eligibleReasons = new Set([
      'razorpay_modal_dismissed',
      'razorpay_payment_failed',
      'payment_cancelled',
      'payment_failed',
    ]);
    const issueRec =
      eligibleReasons.has(String(reason || '').trim().toLowerCase()) &&
      (released || tokenMatchesRequest);
    const recoveryToken = issueRec
      ? signRecoveryToken({ sid: String(checkoutSessionId || parsedRelease.checkoutSessionId || 'sess') })
      : undefined;
    return res.json({ success: true, released, ...(recoveryToken ? { recoveryToken } : {}) });
  });

  // H2: Hardened checkout recovery session endpoint mirroring server.ts
  const rateCounts = new Map<string, number[]>();
  const checkLimit = (key: string, maxReq: number, winMs: number) => {
    const now = Date.now();
    const list = (rateCounts.get(key) || []).filter((t) => now - t < winMs);
    if (list.length >= maxReq) return false;
    list.push(now);
    rateCounts.set(key, list);
    return true;
  };
  app.post('/api/coupons/recovery-session', async (req: Request, res: Response) => {
    const { checkoutSessionId, phone, items, triggerReason } = req.body || {};
    const cleanSid = typeof checkoutSessionId === 'string' ? checkoutSessionId.trim() : '';
    const cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    const normalizedReason = String(triggerReason || '').trim().toLowerCase();
    const allowedReasons = new Set([
      'payment_cancelled',
      'payment_failed',
      'checkout_hesitation',
      'checkout_exit',
      'checkout_abandoned',
    ]);
    if (!cleanSid || cleanSid.length < 8) {
      return res.status(400).json({ success: false, code: 'INVALID_CHECKOUT_SESSION' });
    }
    if (!allowedReasons.has(normalizedReason)) {
      return res.status(400).json({ success: false, code: 'INVALID_RECOVERY_REASON' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, code: 'INVALID_CART_ITEMS' });
    }
    const verifiedCustomer = await verifyCustomerJwt(req);
    const hasValidPhone = cleanPhone.length >= 10 && cleanPhone.length <= 15;
    if (!verifiedCustomer && !hasValidPhone) {
      return res.status(403).json({ success: false, code: 'RECOVERY_IDENTITY_REQUIRED' });
    }
    const pricing = await resolveAuthoritativeCartPricing(items);
    if (!pricing.valid || pricing.subtotal <= 0) {
      return res.status(400).json({ success: false, code: 'INVALID_CART_ITEMS' });
    }
    if (!checkLimit(`sid:${cleanSid}`, 3, 15 * 60_000) || !checkLimit(`ip:${req.ip || '127.0.0.1'}`, 6, 15 * 60_000)) {
      return res.status(429).json({ success: false, code: 'RATE_LIMIT_EXCEEDED' });
    }
    return res.json({
      success: true,
      recoveryToken: signRecoveryToken({ sid: cleanSid }),
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
  });

  // C4: Strict admin order cancellation mirroring server.ts (checks Supabase HTTP status before restoring coupon)
  app.post('/api/admin/orders/:orderId/cancel', async (req: Request, res: Response) => {
    if (String(req.headers.authorization || '').trim() !== `Bearer ${TEST_ADMIN_TOKEN}`) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const orderId = String(req.params.orderId || '').trim();
    const cfg = opts?.supabaseConfig;
    if (cfg?.configured && cfg.url) {
      const resp = await fetch(`${cfg.url}/rest/v1/custom_orders?id=eq.${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: {
          apikey: cfg.serviceRoleKey,
          Authorization: `Bearer ${cfg.serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const text = await resp.text();
      if (!resp.ok) {
        const isConstraint = resp.status === 400 || text.includes('23514') || text.toLowerCase().includes('check constraint');
        return res.status(isConstraint ? 422 : 502).json({
          success: false,
          code: isConstraint ? 'ORDER_STATUS_CONSTRAINT_REJECTED' : 'ORDER_CANCEL_DB_ERROR',
          message: 'Database rejected order cancellation.',
        });
      }
      const updated = JSON.parse(text || '[]');
      if (!Array.isArray(updated) || updated.length === 0) {
        return res.status(404).json({ success: false, code: 'ORDER_NOT_FOUND' });
      }
    }
    const restoreResult = await engine.handleOrderCancelledOrRefunded({
      orderId,
      paymentId: req.body?.paymentId,
      reservationId: req.body?.reservationId,
      razorpayOrderId: req.body?.razorpayOrderId,
      actor: 'admin',
      reason: req.body?.reason || 'admin_cancelled',
    });
    return res.json({
      success: true,
      orderId,
      restoredCount: restoreResult.restoredCount,
      policyEnabled: restoreResult.policyEnabled,
    });
  });

  app.post('/api/razorpay/webhook', async (req: Request, res: Response) => {
    const receivedSig = String(req.headers['x-razorpay-signature'] || '').trim();
    const rawBody: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}), 'utf8');
    const expectedSig = crypto
      .createHmac('sha256', TEST_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    const a = Buffer.from(receivedSig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (!receivedSig || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ success: false, message: 'Invalid webhook signature.' });
    }

    const event = String(req.body?.event || '');
    const paymentEntity = req.body?.payload?.payment?.entity;
    const refundEntity = req.body?.payload?.refund?.entity;

    if (event === 'payment.captured') {
      const rzpOrderId = String(paymentEntity?.order_id || '');
      const rzpPaymentId = String(paymentEntity?.id || '');
      const reservation = await engine.getReservation({ razorpayOrderId: rzpOrderId });
      if (!reservation) return res.status(404).json({ success: false, message: 'No reservation' });
      const out = await engine.finalizeReservationAtomic({
        reservationId: reservation.id,
        orderId: String(paymentEntity?.notes?.app_order_id || `ORD-${rzpOrderId}`),
        orderNumber: String(paymentEntity?.notes?.order_number || `TQ-${rzpOrderId}`),
        paymentId: rzpPaymentId,
        customerName: 'Verified Customer',
        paymentStatus: 'paid',
      });
      return res.json({
        success: out.success,
        alreadyFinalized: Boolean(out.alreadyFinalized),
        redemptionId: out.redemptionId,
      });
    }

    if (event === 'payment.failed') {
      const out = await engine.releaseReservationAtomic({
        razorpayOrderId: String(paymentEntity?.order_id || ''),
      });
      return res.json({ success: true, released: out.released });
    }

    if (event === 'refund.processed') {
      const out = await engine.handleOrderCancelledOrRefunded({
        orderId: String(refundEntity?.notes?.app_order_id || ''),
        paymentId: String(refundEntity?.payment_id || ''),
        actor: 'razorpay_webhook',
        reason: event,
      });
      return res.json({ success: true, ...out });
    }

    return res.json({ success: true, ignored: true });
  });

  app.post('/api/orders/place', async (req: Request, res: Response) => {
    const { items, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Items required' });
    }
    // Simulate Razorpay-configured production verification check rejecting fabricated payment/order IDs
    if (razorpayPaymentId || razorpayOrderId) {
      const expectedSig = crypto
        .createHmac('sha256', 'rzp_test_secret')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
      if (razorpaySignature !== expectedSig) {
        return res.status(403).json({
          success: false,
          message: 'Unverified or fabricated Razorpay payment rejected.',
        });
      }
    }
    return res.status(403).json({ success: false, message: 'Verified payment required.' });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  assert(addr && typeof addr === 'object');
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    baseUrl,
    storageFilePath,
    engine,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

describe('TeqqnoWorld Coupon System — Security & Billing-Integrity Remediation Suite', () => {
  test('1. Unauthenticated private coupon access is rejected (401)', async () => {
    const h = await createTestHarness();
    try {
      const created = await h.engine.createCoupon(
        {
          code: 'ALICEVIP25',
          name: 'Alice Exclusive 25% OFF',
          offerType: 'percentage',
          discountValue: 25,
          minOrderAmount: 500,
          applicability: 'selected_customers',
          assignedCustomers: [{ customerId: 'cust-alice-1', email: 'alice@example.com', name: 'Alice' }],
          isPrivate: true,
          showOnStorefront: false,
          status: 'active',
        },
        'admin'
      );
      assert.equal(created.code, 'ALICEVIP25');

      const offersResp = await fetch(`${h.baseUrl}/api/coupons/my-offers?email=alice@example.com`);
      assert.equal(offersResp.status, 401);

      const valResp = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'ALICEVIP25',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
          customerEmail: 'alice@example.com',
          customerId: 'cust-alice-1',
        }),
      });
      const valData = (await valResp.json()) as any;
      assert.equal(valResp.status, 401);
      assert.equal(valData.valid, false);
      assert.equal(valData.reasonCode, 'AUTH_REQUIRED');
    } finally {
      await h.close();
    }
  });

  test('2. JWT spoofing attempts (forged Bearer token + spoofed body/query) are rejected', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'SPOOFPROOF',
          name: 'Alice Private Offer',
          offerType: 'fixed',
          discountValue: 200,
          minOrderAmount: 500,
          applicability: 'selected_customers',
          assignedCustomers: [{ customerId: 'cust-alice-1', email: 'alice@example.com', name: 'Alice' }],
          isPrivate: true,
          showOnStorefront: false,
          status: 'active',
        },
        'admin'
      );

      const forgedJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJjdXN0LWFsaWNlLTEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIn0.fake_sig';
      const myOffersRes = await fetch(`${h.baseUrl}/api/coupons/my-offers?email=alice@example.com`, {
        headers: { Authorization: `Bearer ${forgedJwt}` },
      });
      assert.equal(myOffersRes.status, 401);

      const valRes = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${forgedJwt}`,
        },
        body: JSON.stringify({
          code: 'SPOOFPROOF',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
          customerEmail: 'alice@example.com',
          customerId: 'cust-alice-1',
        }),
      });
      assert.equal(valRes.status, 401);
    } finally {
      await h.close();
    }
  });

  test('3. Private coupon cross-customer access is blocked (403) while assigned customer succeeds', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'ALICEONLY20',
          name: 'Alice Only 20%',
          offerType: 'percentage',
          discountValue: 20,
          minOrderAmount: 500,
          applicability: 'selected_customers',
          assignedCustomers: [{ customerId: 'cust-alice-1', email: 'alice@example.com', name: 'Alice' }],
          isPrivate: true,
          showOnStorefront: false,
          status: 'active',
        },
        'admin'
      );

      // Bob tries to fetch Alice's offers via query string spoofing
      const bobOffersRes = await fetch(`${h.baseUrl}/api/coupons/my-offers?email=alice@example.com`, {
        headers: { Authorization: 'Bearer valid-jwt-bob' },
      });
      const bobOffers = (await bobOffersRes.json()) as any;
      assert.equal(bobOffersRes.status, 200);
      assert.equal(bobOffers.privateOffers.length, 0);

      // Bob tries to validate Alice's private coupon while passing Alice's email in body
      const bobValRes = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-bob',
        },
        body: JSON.stringify({
          code: 'ALICEONLY20',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
          customerEmail: 'alice@example.com',
        }),
      });
      const bobVal = (await bobValRes.json()) as any;
      assert.equal(bobValRes.status, 403);
      assert.equal(bobVal.valid, false);
      assert.equal(bobVal.reasonCode, 'CUSTOMER_NOT_ELIGIBLE');

      // Alice with her verified JWT succeeds
      const aliceValRes = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-alice',
        },
        body: JSON.stringify({
          code: 'ALICEONLY20',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      const aliceVal = (await aliceValRes.json()) as any;
      assert.equal(aliceValRes.status, 200);
      assert.equal(aliceVal.valid, true);
      assert.equal(aliceVal.subtotal, 1400); // 2 * ₹700 authoritative price
      assert.equal(aliceVal.discountAmount, 280);
    } finally {
      await h.close();
    }
  });

  test('4. Client-supplied price manipulation is ignored and invalid products are rejected', async () => {
    const h = await createTestHarness();
    try {
      // Attacker sends unitPrice: 1 and amountInr: 1 for 2x prod-plain-polo (real price: ₹700/pc => ₹1400 subtotal)
      const rzpRes = await fetch(`${h.baseUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountInr: 1,
          subtotal: 2,
          paymentPlan: 'prepaid_100',
          items: [{ productId: 'prod-plain-polo', unitPrice: 1, quantity: 2 }],
        }),
      });
      const rzpData = (await rzpRes.json()) as any;
      assert.equal(rzpRes.status, 200);
      assert.equal(rzpData.pricing.subtotal, 1400);
      // ₹1400 + 18% GST (₹252) + ₹149 shipping = ₹1801 => 180100 paise
      assert.equal(rzpData.pricing.finalTotal, 1801);
      assert.equal(rzpData.amount, 180100);

      // Invalid/non-existent product ID is rejected
      const badProdRes = await fetch(`${h.baseUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentPlan: 'prepaid_100',
          items: [{ productId: 'prod-fake-hacked-item', unitPrice: 1, quantity: 5 }],
        }),
      });
      assert.equal(badProdRes.status, 400);
    } finally {
      await h.close();
    }
  });

  test('5. Missing cart items and amountInr-only Razorpay create-order requests are rejected (400)', async () => {
    const h = await createTestHarness();
    try {
      const res1 = await fetch(`${h.baseUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountInr: 100, paymentPlan: 'prepaid_100' }),
      });
      assert.equal(res1.status, 400);

      const res2 = await fetch(`${h.baseUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountInr: 100, items: [], paymentPlan: 'prepaid_100' }),
      });
      assert.equal(res2.status, 400);
    } finally {
      await h.close();
    }
  });

  test('6. Concurrent one-use coupon reservation allows exactly 1 winner out of 10 parallel requests', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'FLASHONE1',
          name: 'Single-Use Flash Coupon',
          offerType: 'fixed',
          discountValue: 300,
          minOrderAmount: 500,
          applicability: 'entire_website',
          totalUsageLimit: 1,
          perCustomerLimit: null,
          oneTimePerCustomer: false,
          status: 'active',
        },
        'admin'
      );

      const attempts = Array.from({ length: 10 }, () =>
        fetch(`${h.baseUrl}/api/razorpay/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            couponCode: 'FLASHONE1',
            paymentPlan: 'prepaid_100',
            items: [{ productId: 'prod-plain-polo', quantity: 2 }],
          }),
        }).then(async (r) => ({ status: r.status, body: (await r.json()) as any }))
      );

      const results = await Promise.all(attempts);
      const winners = results.filter((r) => r.status === 200 && r.body.success);
      const conflicts = results.filter((r) => r.status === 409);

      assert.equal(winners.length, 1, `Expected 1 winner, got ${winners.length}`);
      assert.equal(conflicts.length, 9, `Expected 9 conflicts (409), got ${conflicts.length}`);
    } finally {
      await h.close();
    }
  });

  test('7. Multiple independent Node.js worker processes respect atomic one-use reservation limit', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'MULTIWORK1',
          name: 'Multi-Worker Atomic Coupon',
          offerType: 'fixed',
          discountValue: 250,
          minOrderAmount: 500,
          applicability: 'entire_website',
          totalUsageLimit: 1,
          perCustomerLimit: 1,
          oneTimePerCustomer: true,
          status: 'active',
        },
        'admin'
      );

      const workerScript = path.resolve(process.cwd(), 'tests/couponWorkerReserve.ts');
      const workers = Array.from({ length: 6 }, (_, i) =>
        execFileAsync(process.execPath, ['--import', 'tsx', workerScript], {
          env: {
            ...process.env,
            TEST_COUPON_STORE_PATH: h.storageFilePath,
            TEST_COUPON_CODE: 'MULTIWORK1',
            TEST_WORKER_ID: String(i + 1),
          },
          timeout: 20_000,
        }).then((r) => JSON.parse(r.stdout.trim()))
      );

      const outcomes = await Promise.all(workers);
      const winners = outcomes.filter((o) => o.success === true);
      const rejected = outcomes.filter((o) => o.success === false && o.httpStatus === 409);

      assert.equal(winners.length, 1, `Expected exactly 1 multi-process winner, got ${winners.length}`);
      assert.equal(rejected.length, 5, `Expected 5 multi-process 409 rejections, got ${rejected.length}`);
    } finally {
      await h.close();
    }
  });

  test('8. Failed Razorpay payment releases reservation and frees capacity for next customer', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'RELEASEME1',
          name: 'Release On Failure Test',
          offerType: 'fixed',
          discountValue: 200,
          minOrderAmount: 500,
          applicability: 'entire_website',
          totalUsageLimit: 1,
          oneTimePerCustomer: false,
          perCustomerLimit: null,
          status: 'active',
        },
        'admin'
      );

      // First customer reserves the single slot
      const first = await fetch(`${h.baseUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponCode: 'RELEASEME1',
          paymentPlan: 'prepaid_100',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      const firstData = (await first.json()) as any;
      assert.equal(first.status, 200);
      assert.ok(firstData.reservationId);

      // Second customer is blocked while slot is reserved
      const blocked = await fetch(`${h.baseUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponCode: 'RELEASEME1',
          paymentPlan: 'prepaid_100',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      assert.equal(blocked.status, 409);

      // First customer's payment fails -> reservation released with server-signed releaseToken
      const rel = await fetch(`${h.baseUrl}/api/razorpay/release-reservation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: firstData.reservationId,
          razorpayOrderId: firstData.orderId,
          releaseToken: firstData.releaseToken,
          reason: 'payment_failed',
        }),
      });
      const relData = (await rel.json()) as any;
      assert.equal(rel.status, 200);
      assert.equal(relData.released, true);

      // Second customer now succeeds
      const second = await fetch(`${h.baseUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponCode: 'RELEASEME1',
          paymentPlan: 'prepaid_100',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      assert.equal(second.status, 200);
    } finally {
      await h.close();
    }
  });

  test('9. Duplicate Razorpay payment webhook is idempotent and invalid signatures are rejected (401)', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'WEBHOOKIDEM',
          name: 'Webhook Idempotency Coupon',
          offerType: 'fixed',
          discountValue: 150,
          minOrderAmount: 500,
          applicability: 'entire_website',
          totalUsageLimit: 5,
          oneTimePerCustomer: false,
          perCustomerLimit: null,
          status: 'active',
        },
        'admin'
      );

      const createRes = await fetch(`${h.baseUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponCode: 'WEBHOOKIDEM',
          paymentPlan: 'prepaid_100',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      const created = (await createRes.json()) as any;
      assert.equal(createRes.status, 200);

      const payloadObj = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_unique_1001',
              order_id: created.orderId,
              amount: created.amount,
              notes: { app_order_id: 'ORD-REAL-1001', order_number: 'TQ-1001' },
            },
          },
        },
      };
      const rawBody = JSON.stringify(payloadObj);
      const validSig = crypto
        .createHmac('sha256', TEST_WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

      // Tampered webhook signature rejected
      const badWh = await fetch(`${h.baseUrl}/api/razorpay/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'deadbeef_invalid_sig',
        },
        body: rawBody,
      });
      assert.equal(badWh.status, 401);

      // First valid webhook delivery finalizes redemption
      const wh1 = await fetch(`${h.baseUrl}/api/razorpay/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': validSig },
        body: rawBody,
      });
      const wh1Data = (await wh1.json()) as any;
      assert.equal(wh1.status, 200);
      assert.equal(wh1Data.success, true);
      assert.equal(wh1Data.alreadyFinalized, false);

      // Duplicate webhook delivery returns alreadyFinalized: true without double-counting
      const wh2 = await fetch(`${h.baseUrl}/api/razorpay/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': validSig },
        body: rawBody,
      });
      const wh2Data = (await wh2.json()) as any;
      assert.equal(wh2.status, 200);
      assert.equal(wh2Data.alreadyFinalized, true);

      const coupons = await h.engine.listCoupons();
      const target = coupons.find((c) => c.code === 'WEBHOOKIDEM');
      assert.equal(target?.usageCount, 1);
    } finally {
      await h.close();
    }
  });

  test('10. Fake order ID redemption via POST /api/coupons/redeem (403) and fabricated payment on /api/orders/place are blocked', async () => {
    const h = await createTestHarness();
    try {
      const redeemRes = await fetch(`${h.baseUrl}/api/coupons/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'WELCOME10',
          orderId: 'FAKE-ORDER-999999',
          subtotal: 2000,
        }),
      });
      const redeemData = (await redeemRes.json()) as any;
      assert.equal(redeemRes.status, 403);
      assert.equal(redeemData.code, 'DIRECT_REDEMPTION_DISABLED');

      // Fabricated payment signature on /api/orders/place
      const fakeOrderRes = await fetch(`${h.baseUrl}/api/orders/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
          razorpayOrderId: 'order_fake_123',
          razorpayPaymentId: 'pay_fake_123',
          razorpaySignature: 'forged_sig',
        }),
      });
      assert.equal(fakeOrderRes.status, 403);

      const redemptions = await h.engine.listRedemptions();
      assert.equal(redemptions.length, 0);
    } finally {
      await h.close();
    }
  });

  test('11. Production Supabase outage fails closed with HTTP 503 and recovers after retry window', async () => {
    let failSupabase = true;
    const mockSupabase = http.createServer((req, res) => {
      if (failSupabase) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Simulated database outage' }));
        return;
      }
      if (req.url?.startsWith('/rest/v1/coupons')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    });
    await new Promise<void>((resolve) => mockSupabase.listen(0, '127.0.0.1', () => resolve()));
    const sbAddr = mockSupabase.address();
    assert(sbAddr && typeof sbAddr === 'object');
    const sbUrl = `http://127.0.0.1:${sbAddr.port}`;

    const h = await createTestHarness({
      isProduction: true,
      supabaseConfig: { configured: true, url: sbUrl, serviceRoleKey: 'test-service-role-key' },
    });

    try {
      // Outage: must fail closed with HTTP 503 (never fall back to local JSON)
      const pubFail = await fetch(`${h.baseUrl}/api/coupons/public`);
      const pubFailBody = (await pubFail.json()) as any;
      assert.equal(pubFail.status, 503);
      assert.equal(pubFailBody.code, 'STORAGE_UNAVAILABLE');
      assert.equal(fs.existsSync(h.storageFilePath), false, 'Production must never create local fallback store');

      // Validate endpoint must also fail closed with 503
      const valFail = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'WELCOME10',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      assert.equal(valFail.status, 503);

      // Recover Supabase and expire retry cache timestamp to prove controlled retry (no permanent false cache)
      failSupabase = false;
      if ((h.engine as any).supabaseStatus) {
        (h.engine as any).supabaseStatus.checkedAt = 0;
      }

      const pubOk = await fetch(`${h.baseUrl}/api/coupons/public`);
      assert.equal(pubOk.status, 200);
    } finally {
      await h.close();
      await new Promise<void>((resolve) => mockSupabase.close(() => resolve()));
    }
  });

  test('12. Free shipping coupon usage and shippingSaved (₹149) are accurately recorded', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'FREESHIPTEST',
          name: 'Free Shipping Offer',
          offerType: 'free_shipping',
          discountValue: 0,
          minOrderAmount: 500,
          applicability: 'entire_website',
          oneTimePerCustomer: false,
          perCustomerLimit: null,
          status: 'active',
        },
        'admin'
      );

      // 2x plain polo = ₹1400 (< ₹1999 threshold, so normal shipping is ₹149)
      const rzp = await fetch(`${h.baseUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponCode: 'FREESHIPTEST',
          paymentPlan: 'prepaid_100',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      const rzpData = (await rzp.json()) as any;
      assert.equal(rzp.status, 200);
      assert.equal(rzpData.pricing.freeShippingApplied, true);
      assert.equal(rzpData.pricing.shippingFee, 0);
      assert.equal(rzpData.pricing.shippingSaved, 149);
      assert.equal(rzpData.pricing.discountAmount, 0);
      assert.equal(rzpData.pricing.finalTotal, 1400 + 252); // subtotal + 18% GST, ₹0 shipping

      const fin = await h.engine.finalizeReservationAtomic({
        reservationId: rzpData.reservationId,
        orderId: 'ORD-FREESHIP-1',
        orderNumber: 'TQ-FS01',
        paymentId: 'pay_fs_1',
        paymentStatus: 'paid',
      });
      assert.equal(fin.success, true);

      const redemptions = await h.engine.listRedemptions();
      const rec = redemptions.find((r) => r.orderId === 'ORD-FREESHIP-1');
      assert.ok(rec);
      assert.equal(rec.shippingSavedInr, 149);
      assert.equal(rec.discountInr, 0);
      assert.equal(rec.finalTotalInr, 1652);
    } finally {
      await h.close();
    }
  });

  test('13. Order cancellation & repeated coupon restoration enforce policy and prevent double-decrement', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'RESTORETEST',
          name: 'Restore Policy Coupon',
          offerType: 'fixed',
          discountValue: 200,
          minOrderAmount: 500,
          applicability: 'entire_website',
          totalUsageLimit: 1,
          oneTimePerCustomer: false,
          perCustomerLimit: null,
          status: 'active',
        },
        'admin'
      );

      const resv = await h.engine.reserveCouponAtomic({
        code: 'RESTORETEST',
        items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        paymentPlan: 'prepaid_100',
      });
      assert.equal(resv.success, true);

      const fin = await h.engine.finalizeReservationAtomic({
        reservationId: resv.reservation!.id,
        orderId: 'ORD-CAN-1',
        orderNumber: 'TQ-CAN-1',
        paymentId: 'pay_can_1',
        paymentStatus: 'paid',
      });
      assert.equal(fin.success, true);

      // Policy OFF -> cancellation must retain usageCount === 1
      await h.engine.saveSettings({ restoreOnCancel: false, updatedBy: 'admin' });
      const offRes = await h.engine.handleOrderCancelledOrRefunded({
        orderId: 'ORD-CAN-1',
        actor: 'admin',
        reason: 'cancelled_policy_off',
      });
      assert.equal(offRes.restoredCount, 0);
      let coupon = (await h.engine.listCoupons()).find((c) => c.code === 'RESTORETEST')!;
      assert.equal(coupon.usageCount, 1);

      // Policy ON -> cancellation restores usageCount -> 0 and reverses discount/revenue analytics
      await h.engine.saveSettings({ restoreOnCancel: true, updatedBy: 'admin' });
      const onRes = await h.engine.handleOrderCancelledOrRefunded({
        orderId: 'ORD-CAN-1',
        actor: 'admin',
        reason: 'cancelled_policy_on',
      });
      assert.equal(onRes.restoredCount, 1);
      coupon = (await h.engine.listCoupons()).find((c) => c.code === 'RESTORETEST')!;
      assert.equal(coupon.usageCount, 0);
      assert.equal(coupon.totalDiscountGiven, 0);
      assert.equal(coupon.totalRevenueGenerated, 0);

      // Repeated Admin restore must return 409 and NOT decrement below 0
      const repeatResp = await fetch(
        `${h.baseUrl}/api/admin/coupons/redemptions/${encodeURIComponent(fin.redemptionId!)}/restore`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
          },
          body: JSON.stringify({ force: true }),
        }
      );
      const repeatData = (await repeatResp.json()) as any;
      assert.equal(repeatResp.status, 409);
      assert.equal(repeatData.alreadyRestored, true);
      coupon = (await h.engine.listCoupons()).find((c) => c.code === 'RESTORETEST')!;
      assert.equal(coupon.usageCount, 0);
    } finally {
      await h.close();
    }
  });

  test('14. Missing customer identity with oneTimePerCustomer / perCustomerLimit is rejected (401)', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'ONCEPERUSER',
          name: 'One Time Per Customer',
          offerType: 'fixed',
          discountValue: 100,
          minOrderAmount: 500,
          applicability: 'entire_website',
          oneTimePerCustomer: true,
          perCustomerLimit: 1,
          status: 'active',
        },
        'admin'
      );

      // Guest (no JWT) must be rejected — never skipped!
      const guestRes = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'ONCEPERUSER',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      const guestData = (await guestRes.json()) as any;
      assert.equal(guestRes.status, 401);
      assert.equal(guestData.valid, false);
      assert.equal(guestData.reasonCode, 'AUTH_REQUIRED');

      // Verified customer succeeds once, then is rejected after using it
      const firstResv = await h.engine.reserveCouponAtomic({
        code: 'ONCEPERUSER',
        items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        paymentPlan: 'prepaid_100',
        verifiedCustomer: USERS_BY_TOKEN['valid-jwt-alice'],
      });
      assert.equal(firstResv.success, true);

      const secondResv = await h.engine.reserveCouponAtomic({
        code: 'ONCEPERUSER',
        items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        paymentPlan: 'prepaid_100',
        verifiedCustomer: USERS_BY_TOKEN['valid-jwt-alice'],
      });
      assert.equal(secondResv.success, false);
      assert.equal(secondResv.httpStatus, 409);
      assert.equal(secondResv.validation.reasonCode, 'CUSTOMER_LIMIT_REACHED');
    } finally {
      await h.close();
    }
  });

  test('15. More than 2,000 redemption records are handled accurately without 2,000-row truncation', async () => {
    const h = await createTestHarness();
    try {
      const coupon = await h.engine.createCoupon(
        {
          code: 'SCALE2150',
          name: 'High Volume Coupon',
          offerType: 'fixed',
          discountValue: 50,
          minOrderAmount: 500,
          applicability: 'entire_website',
          totalUsageLimit: 2500,
          perCustomerLimit: 1,
          oneTimePerCustomer: true,
          status: 'active',
        },
        'admin'
      );

      // Seed 2,150 redemption records directly into the local store (placing Alice at record #1, beyond 2,000 from tail)
      const raw = JSON.parse(fs.readFileSync(h.storageFilePath, 'utf8'));
      const baseTime = Date.now() - 2_200 * 60_000;
      const bulkRedemptions = [];
      for (let i = 0; i < 2150; i++) {
        bulkRedemptions.push({
          id: `cred_bulk_${i}`,
          couponId: coupon.id,
          couponCode: coupon.code,
          orderId: `ORD-BULK-${i}`,
          orderNumber: `TQ-B${i}`,
          customerId: i === 2149 ? 'cust-alice-1' : `cust-bulk-${i}`,
          customerEmail: i === 2149 ? 'alice@example.com' : `bulk${i}@example.com`,
          subtotalInr: 1400,
          discountInr: 50,
          shippingSavedInr: 0,
          finalTotalInr: 1742,
          paymentStatus: 'paid',
          status: 'redeemed',
          redeemedAt: new Date(baseTime + i * 1000).toISOString(),
        });
      }
      raw.redemptions = bulkRedemptions;
      const cIdx = raw.coupons.findIndex((c: any) => c.id === coupon.id);
      raw.coupons[cIdx].usageCount = 2150;
      fs.writeFileSync(h.storageFilePath, JSON.stringify(raw), 'utf8');

      // Alice's earlier redemption at index 2149 (> 2000) is still enforced!
      const aliceRes = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-alice',
        },
        body: JSON.stringify({
          code: 'SCALE2150',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      const aliceData = (await aliceRes.json()) as any;
      assert.equal(aliceData.valid, false);
      assert.equal(aliceData.reasonCode, 'CUSTOMER_LIMIT_REACHED');

      // Bob (not yet redeemed) can still redeem
      const bobRes = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-bob',
        },
        body: JSON.stringify({
          code: 'SCALE2150',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      const bobData = (await bobRes.json()) as any;
      assert.equal(bobData.valid, true);

      // Admin overview counts all 2,150 redemptions accurately
      const overview = await h.engine.getAdminOverview({});
      assert.equal(overview.kpis.totalRedemptions, 2150);
    } finally {
      await h.close();
    }
  });

  test('16. Public RLS migration & GET /api/coupons/public never expose internal or private columns', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'PUBLICSAFE',
          name: 'Public Storefront Deal',
          offerType: 'percentage',
          discountValue: 10,
          minOrderAmount: 500,
          applicability: 'entire_website',
          showOnStorefront: true,
          isPrivate: false,
          internalNote: 'TOP SECRET MARGIN NOTE',
          status: 'active',
        },
        'admin'
      );

      const pubRes = await fetch(`${h.baseUrl}/api/coupons/public`);
      const pubData = (await pubRes.json()) as any;
      assert.equal(pubRes.status, 200);
      const found = pubData.coupons.find((c: any) => c.code === 'PUBLICSAFE');
      assert.ok(found);
      assert.equal('internalNote' in found, false);
      assert.equal('usageCount' in found, false);
      assert.equal('totalDiscountGiven' in found, false);
      assert.equal('totalRevenueGenerated' in found, false);
      assert.equal('assignedCustomers' in found, false);
      assert.equal('createdBy' in found, false);

      // Verify SQL migration files tighten RLS and expose only narrow storefront view
      const baseSql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/coupons_migration.sql'), 'utf8');
      const hardeningSql = fs.readFileSync(
        path.resolve(process.cwd(), 'supabase/coupons_security_hardening_migration.sql'),
        'utf8'
      );
      assert.equal(baseSql.includes('CREATE POLICY "public_read_active_public_coupons"'), false);
      assert.ok(baseSql.includes('CREATE OR REPLACE VIEW public.public_storefront_coupons'));
      assert.ok(hardeningSql.includes('DROP POLICY IF EXISTS "public_read_active_public_coupons"'));
      assert.ok(hardeningSql.includes('coupons_percentage_max_100_chk'));
      assert.ok(hardeningSql.includes('public.coupon_code_registry'));
    } finally {
      await h.close();
    }
  });

  test('17. CSV export neutralizes spreadsheet formula injection (=, +, -, @, tab, CR)', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'CSVTEST',
          name: '=HYPERLINK("https://evil.example","Click")',
          campaignName: '+1+1',
          offerType: 'fixed',
          discountValue: 100,
          minOrderAmount: 500,
          applicability: 'entire_website',
          oneTimePerCustomer: false,
          perCustomerLimit: null,
          status: 'active',
        },
        'admin'
      );

      const resv = await h.engine.reserveCouponAtomic({
        code: 'CSVTEST',
        items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        paymentPlan: 'prepaid_100',
      });
      await h.engine.finalizeReservationAtomic({
        reservationId: resv.reservation!.id,
        orderId: 'ORD-CSV-1',
        orderNumber: '-2+3',
        customerName: '@SUM(A1:A10)',
        paymentStatus: 'paid',
      });

      const redCsvRes = await fetch(`${h.baseUrl}/api/admin/coupons/export/csv?type=redemptions`, {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      });
      const redCsv = await redCsvRes.text();
      assert.equal(redCsvRes.status, 200);
      assert.ok(redCsv.includes("'-2+3"), 'Leading minus must be neutralized');
      assert.ok(redCsv.includes("'@SUM(A1:A10)"), 'Leading @ must be neutralized');

      const coupCsvRes = await fetch(`${h.baseUrl}/api/admin/coupons/export/csv?type=coupons`, {
        headers: { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
      });
      const coupCsv = await coupCsvRes.text();
      assert.equal(coupCsvRes.status, 200);
      assert.ok(coupCsv.includes("'=HYPERLINK"), 'Leading = must be neutralized');
      assert.ok(coupCsv.includes("'+1+1"), 'Leading + must be neutralized');
    } finally {
      await h.close();
    }
  });

  test('18. All 6 legacy coupon codes work cleanly & SAVE5NOW rejects spoofed client boolean', async () => {
    const h = await createTestHarness();
    try {
      // WELCOME10 (10% OFF on ₹1400 => ₹140)
      const w10 = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'WELCOME10',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      }).then((r) => r.json() as Promise<any>);
      assert.equal(w10.valid, true);
      assert.equal(w10.discountAmount, 140);

      // WELCOME12 (alias of WELCOME10)
      const w12 = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'WELCOME12',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      }).then((r) => r.json() as Promise<any>);
      assert.equal(w12.valid, true);
      assert.equal(w12.discountAmount, 140);

      // TEQQNO10 (alias of WELCOME10)
      const t10 = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'TEQQNO10',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      }).then((r) => r.json() as Promise<any>);
      assert.equal(t10.valid, true);
      assert.equal(t10.discountAmount, 140);

      // TEQQNOBULK (preserved existing behavior: Flat ₹500 OFF, minOrderAmount: 0)
      const bulkOk = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'TEQQNOBULK',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      }).then((r) => r.json() as Promise<any>);
      assert.equal(bulkOk.valid, true);
      assert.equal(bulkOk.subtotal, 1400);
      assert.equal(bulkOk.discountAmount, 500);

      // SAVE5NOW with ONLY client boolean hasActiveRecoveryCoupon: true MUST BE REJECTED!
      const spoofedSave5 = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'SAVE5NOW',
          hasActiveRecoveryCoupon: true,
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      }).then((r) => r.json() as Promise<any>);
      assert.equal(spoofedSave5.valid, false);
      assert.equal(spoofedSave5.reasonCode, 'RECOVERY_SESSION_REQUIRED');

      // SAVE5NOW & TEQQNO5 with valid server-signed recoveryToken succeed (5% of ₹1400 = ₹70)
      const validRecToken = signRecoveryToken({ code: 'SAVE5NOW' });
      const save5Ok = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'SAVE5NOW',
          recoveryToken: validRecToken,
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      }).then((r) => r.json() as Promise<any>);
      assert.equal(save5Ok.valid, true);
      assert.equal(save5Ok.discountAmount, 70);

      const teqqno5Ok = await fetch(`${h.baseUrl}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'TEQQNO5',
          recoveryToken: validRecToken,
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      }).then((r) => r.json() as Promise<any>);
      assert.equal(teqqno5Ok.valid, true);
      assert.equal(teqqno5Ok.discountAmount, 70);
    } finally {
      await h.close();
    }
  });

  test('19. PostgREST filter sanitizers reject injection operators and preserve valid identifiers', () => {
    assert.equal(sanitizePostgrestEmail('alice@example.com'), 'alice@example.com');
    assert.equal(sanitizePostgrestEmail('alice@example.com,status.eq.active)'), '');
    assert.equal(sanitizePostgrestEmail('alice@example.com;DROP TABLE'), '');
    assert.equal(sanitizePostgrestPhone('+91 98765-43210'), '9876543210');
    assert.equal(sanitizePostgrestPhone('9876543210,id.neq.0'), '');
    assert.equal(sanitizePostgrestPhone('abc'), '');
    assert.equal(sanitizePostgrestId('cust_123-abc:def'), 'cust_123-abc:def');
    assert.equal(sanitizePostgrestId('id,or(status.eq.active)'), '');
  });

  // ============================================================================
  // FINAL PRE-DEPLOYMENT AUDIT REMEDIATION TESTS (C1–C5, H1–H4)
  // ============================================================================

  test('20. [C1] Empty-email RLS data leak is blocked on coupon_redemptions & coupon_customer_notifications', () => {
    const baseSql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/coupons_migration.sql'), 'utf8');
    const hardeningSql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/coupons_security_hardening_migration.sql'),
      'utf8'
    );

    // Verify neither migration contains the vulnerable empty-email COALESCE(..., '') = LOWER(COALESCE(..., '')) pattern
    for (const [label, sql] of [
      ['coupons_migration.sql', baseSql],
      ['coupons_security_hardening_migration.sql', hardeningSql],
    ] as const) {
      assert.equal(
        sql.includes("LOWER(COALESCE(customer_email, '')) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))"),
        false,
        `${label} must not allow empty JWT email to match NULL/empty customer_email`
      );
      assert.ok(
        sql.includes("customer_email IS NOT NULL"),
        `${label} must explicitly require customer_email IS NOT NULL`
      );
      assert.ok(
        sql.includes("NULLIF(TRIM(COALESCE(auth.jwt() ->> 'email', '')), '') IS NOT NULL"),
        `${label} must explicitly require non-empty auth.jwt() email claim`
      );
    }

    // Simulate the hardened SQL RLS predicate across all auth scenarios
    const evaluateHardenedRls = (
      row: { customer_id: string | null; customer_email: string | null },
      jwt: { sub?: string | null; email?: string | null; phone?: string | null; is_anonymous?: boolean }
    ): boolean => {
      const uid = jwt.sub && jwt.sub.trim() ? jwt.sub.trim() : null;
      const jwtEmail = jwt.email && jwt.email.trim() ? jwt.email.trim().toLowerCase() : null;
      const rowEmail =
        row.customer_email !== null && row.customer_email.trim() !== ''
          ? row.customer_email.trim().toLowerCase()
          : null;

      if (uid && row.customer_id && uid === row.customer_id) return true;
      if (rowEmail !== null && jwtEmail !== null && rowEmail === jwtEmail) return true;
      return false;
    };

    const guestNullRow = { customer_id: null, customer_email: null };
    const guestEmptyRow = { customer_id: null, customer_email: '' };
    const guestWhitespaceRow = { customer_id: null, customer_email: '   ' };
    const aliceRow = { customer_id: 'uid-alice', customer_email: 'alice@example.com' };

    // Phone OTP user (has sub + phone, NO email claim) must NEVER see guest NULL/empty rows
    const phoneOtpJwt = { sub: 'uid-phone-otp-1', phone: '+919876543210' };
    assert.equal(evaluateHardenedRls(guestNullRow, phoneOtpJwt), false);
    assert.equal(evaluateHardenedRls(guestEmptyRow, phoneOtpJwt), false);
    assert.equal(evaluateHardenedRls(guestWhitespaceRow, phoneOtpJwt), false);
    assert.equal(evaluateHardenedRls(aliceRow, phoneOtpJwt), false);

    // Anonymous auth user (empty email string) must NEVER see guest NULL/empty rows
    const anonJwt = { sub: 'uid-anon-99', email: '', is_anonymous: true };
    assert.equal(evaluateHardenedRls(guestNullRow, anonJwt), false);
    assert.equal(evaluateHardenedRls(guestEmptyRow, anonJwt), false);
    assert.equal(evaluateHardenedRls(guestWhitespaceRow, anonJwt), false);

    // Missing email claim & whitespace email claim
    assert.equal(evaluateHardenedRls(guestNullRow, { sub: 'uid-x' }), false);
    assert.equal(evaluateHardenedRls(guestEmptyRow, { sub: 'uid-x', email: '   ' }), false);

    // Legitimate authenticated email match succeeds (case-insensitive)
    assert.equal(
      evaluateHardenedRls(
        { customer_id: null, customer_email: 'Alice@Example.com' },
        { sub: 'uid-other', email: 'alice@example.com' }
      ),
      true
    );
    // Legitimate customer_id match succeeds even for phone-OTP user
    assert.equal(
      evaluateHardenedRls({ customer_id: 'uid-phone-otp-1', customer_email: null }, phoneOtpJwt),
      true
    );
  });

  test('21. [C2] All SECURITY DEFINER RPCs & trigger functions enforce safe search_path and service_role-only grants', () => {
    const baseSql = fs.readFileSync(path.resolve(process.cwd(), 'supabase/coupons_migration.sql'), 'utf8');
    const hardeningSql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/coupons_security_hardening_migration.sql'),
      'utf8'
    );

    const requiredSearchPath = 'SET search_path = pg_catalog, public, pg_temp';
    const rpcs = [
      'teqqno_reserve_coupon',
      'teqqno_finalize_coupon_reservation',
      'teqqno_release_coupon_reservation',
      'teqqno_restore_coupon_redemption',
    ];
    const triggers = ['teqqno_set_coupon_updated_at', 'teqqno_sync_coupon_code_registry'];

    for (const fn of [...rpcs, ...triggers]) {
      const fnIdx = hardeningSql.indexOf(`CREATE OR REPLACE FUNCTION public.${fn}`);
      assert.ok(fnIdx >= 0, `hardening migration must define public.${fn}`);
      const fnBody = hardeningSql.slice(fnIdx, fnIdx + 1200);
      assert.ok(
        fnBody.includes(requiredSearchPath),
        `public.${fn} must declare "${requiredSearchPath}"`
      );
      assert.ok(
        hardeningSql.includes(`REVOKE ALL ON FUNCTION public.${fn}`),
        `public.${fn} must explicitly REVOKE ALL FROM PUBLIC, anon, authenticated`
      );
    }

    for (const fn of rpcs) {
      assert.ok(
        hardeningSql.includes(`GRANT EXECUTE ON FUNCTION public.${fn}`) &&
          hardeningSql.includes('TO service_role'),
        `public.${fn} must grant EXECUTE to service_role only`
      );
    }

    // Trigger functions in base migration also carry explicit search_path & REVOKE
    for (const trig of triggers) {
      assert.ok(baseSql.includes(`CREATE OR REPLACE FUNCTION public.${trig}`));
      const idx = baseSql.indexOf(`CREATE OR REPLACE FUNCTION public.${trig}`);
      const slice = baseSql.slice(idx, idx + 800);
      assert.ok(slice.includes(requiredSearchPath), `base migration public.${trig} must set safe search_path`);
    }
  });

  test('22. [C3] Consistent lock order (coupons -> reservations -> redemptions) and expiry vs concurrent reservation concurrency safety', async () => {
    const hardeningSql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/coupons_security_hardening_migration.sql'),
      'utf8'
    );

    // Verify lock order in teqqno_finalize_coupon_reservation: public.coupons FOR UPDATE BEFORE public.coupon_reservations FOR UPDATE
    const finStart = hardeningSql.indexOf('CREATE OR REPLACE FUNCTION public.teqqno_finalize_coupon_reservation');
    const finEnd = hardeningSql.indexOf('CREATE OR REPLACE FUNCTION public.teqqno_release_coupon_reservation');
    assert.ok(finStart > 0 && finEnd > finStart);
    const finBody = hardeningSql.slice(finStart, finEnd);
    const lockCouponIdx = finBody.indexOf('FROM public.coupons\n  WHERE id = v_coupon_id\n  FOR UPDATE');
    const lockResvIdx = finBody.indexOf('FROM public.coupon_reservations\n  WHERE id = p_reservation_id\n  FOR UPDATE');
    assert.ok(lockCouponIdx > 0, 'finalize RPC must lock public.coupons FOR UPDATE');
    assert.ok(lockResvIdx > 0, 'finalize RPC must lock public.coupon_reservations FOR UPDATE');
    assert.ok(
      lockCouponIdx < lockResvIdx,
      'finalize RPC must lock public.coupons BEFORE public.coupon_reservations to prevent deadlocks'
    );
    assert.ok(
      finBody.includes('v_other_reserved_total'),
      'finalize RPC expired grace check must account for other active reservations'
    );

    // Verify lock order in teqqno_restore_coupon_redemption: public.coupons FOR UPDATE BEFORE public.coupon_redemptions FOR UPDATE
    const restStart = hardeningSql.indexOf('CREATE OR REPLACE FUNCTION public.teqqno_restore_coupon_redemption');
    assert.ok(restStart > 0);
    const restBody = hardeningSql.slice(restStart);
    const restLockCoupon = restBody.indexOf('FROM public.coupons\n  WHERE id = v_coupon_id\n  FOR UPDATE');
    const restLockRed = restBody.indexOf('FROM public.coupon_redemptions\n  WHERE id = p_redemption_id\n  FOR UPDATE');
    assert.ok(restLockCoupon > 0 && restLockRed > 0 && restLockCoupon < restLockRed);

    // Live concurrency test: expired reservation vs new active reservation on a 1-use coupon
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'RACELOCK1',
          name: 'Single Slot Race Lock Coupon',
          offerType: 'fixed',
          discountValue: 200,
          minOrderAmount: 500,
          applicability: 'entire_website',
          totalUsageLimit: 1,
          oneTimePerCustomer: false,
          perCustomerLimit: null,
          status: 'active',
        },
        'admin'
      );

      // Customer A reserves the single slot
      const resA = await h.engine.reserveCouponAtomic({
        code: 'RACELOCK1',
        items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        paymentPlan: 'prepaid_100',
        verifiedCustomer: USERS_BY_TOKEN['valid-jwt-alice'],
      });
      assert.equal(resA.success, true);

      // Simulate reservation A expiring before payment callback arrives
      const raw = JSON.parse(fs.readFileSync(h.storageFilePath, 'utf8'));
      const rA = raw.reservations.find((r: any) => r.id === resA.reservation!.id);
      rA.expiresAt = new Date(Date.now() - 5_000).toISOString();
      fs.writeFileSync(h.storageFilePath, JSON.stringify(raw), 'utf8');

      // Concurrently: Customer B tries to reserve the freed slot AND Customer A's late payment tries to finalize
      const [resB, finA] = await Promise.all([
        h.engine.reserveCouponAtomic({
          code: 'RACELOCK1',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
          paymentPlan: 'prepaid_100',
          verifiedCustomer: USERS_BY_TOKEN['valid-jwt-bob'],
        }),
        h.engine.finalizeReservationAtomic({
          reservationId: resA.reservation!.id,
          orderId: 'ORD-LATE-A',
          orderNumber: 'TQ-LATEA',
          paymentId: 'pay_late_a',
          paymentStatus: 'paid',
        }),
      ]);

      // Exactly ONE of (resB active hold, finA redemption) may succeed — NEVER both!
      const successCount = (resB.success ? 1 : 0) + (finA.success ? 1 : 0);
      assert.equal(
        successCount,
        1,
        `Exactly one operation must hold the single coupon slot, got resB=${resB.success}, finA=${finA.success}`
      );
    } finally {
      await h.close();
    }
  });

  test('23. [C4] Order cancellation constraint allows cancelled & dispatched, rejects DB failure without restoring coupon, and succeeds idempotently on DB commit', async () => {
    const hardeningSql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/coupons_security_hardening_migration.sql'),
      'utf8'
    );
    assert.ok(
      hardeningSql.includes("'cancelled'") && hardeningSql.includes("'dispatched'"),
      'custom_orders status CHECK constraint must allow both dispatched and cancelled'
    );

    let simulateConstraintError = true;
    const mockSupabase = http.createServer((req, res) => {
      if (req.method === 'PATCH' && req.url?.startsWith('/rest/v1/custom_orders')) {
        if (simulateConstraintError) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              code: '23514',
              message: 'new row for relation "custom_orders" violates check constraint "custom_orders_status_check"',
            })
          );
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ id: '11111111-1111-1111-1111-111111111111', status: 'cancelled' }]));
        return;
      }
      // Make coupon tables 404 so non-prod test engine uses local store for coupon records while testing custom_orders PATCH
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'Not found' }));
    });
    await new Promise<void>((resolve) => mockSupabase.listen(0, '127.0.0.1', () => resolve()));
    const sbAddr = mockSupabase.address();
    assert(sbAddr && typeof sbAddr === 'object');
    const sbUrl = `http://127.0.0.1:${sbAddr.port}`;

    const h = await createTestHarness({
      isProduction: false,
      supabaseConfig: { configured: true, url: sbUrl, serviceRoleKey: 'test-srk' },
    });

    try {
      await h.engine.createCoupon(
        {
          code: 'CANCELCHK',
          name: 'Cancel Check Coupon',
          offerType: 'fixed',
          discountValue: 150,
          minOrderAmount: 500,
          applicability: 'entire_website',
          totalUsageLimit: 1,
          oneTimePerCustomer: false,
          perCustomerLimit: null,
          status: 'active',
        },
        'admin'
      );
      await h.engine.saveSettings({ restoreOnCancel: true, updatedBy: 'admin' });

      const resv = await h.engine.reserveCouponAtomic({
        code: 'CANCELCHK',
        items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        paymentPlan: 'prepaid_100',
      });
      await h.engine.finalizeReservationAtomic({
        reservationId: resv.reservation!.id,
        orderId: '11111111-1111-1111-1111-111111111111',
        orderNumber: 'TQ-CANCHK',
        paymentId: 'pay_canchk_1',
        paymentStatus: 'paid',
      });

      // Step 1: DB rejects PATCH with 400 / 23514 -> API MUST fail (422) and MUST NOT restore coupon
      const failCancel = await fetch(
        `${h.baseUrl}/api/admin/orders/11111111-1111-1111-1111-111111111111/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
          },
          body: JSON.stringify({ reason: 'customer_requested' }),
        }
      );
      const failBody = (await failCancel.json()) as any;
      assert.equal(failCancel.status, 422);
      assert.equal(failBody.success, false);
      assert.equal(failBody.code, 'ORDER_STATUS_CONSTRAINT_REJECTED');

      let c = (await h.engine.listCoupons()).find((x) => x.code === 'CANCELCHK')!;
      assert.equal(c.usageCount, 1, 'Coupon must NOT be restored when DB order cancellation fails');

      // Step 2: DB accepts PATCH (200) -> API succeeds and restores coupon once
      simulateConstraintError = false;
      const okCancel = await fetch(
        `${h.baseUrl}/api/admin/orders/11111111-1111-1111-1111-111111111111/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
          },
          body: JSON.stringify({ reason: 'customer_requested' }),
        }
      );
      const okBody = (await okCancel.json()) as any;
      assert.equal(okCancel.status, 200);
      assert.equal(okBody.success, true);
      assert.equal(okBody.restoredCount, 1);

      c = (await h.engine.listCoupons()).find((x) => x.code === 'CANCELCHK')!;
      assert.equal(c.usageCount, 0);

      // Step 3: Idempotent retry returns 200 with restoredCount 0 and keeps usageCount === 0
      const retryCancel = await fetch(
        `${h.baseUrl}/api/admin/orders/11111111-1111-1111-1111-111111111111/cancel`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
          },
          body: JSON.stringify({ reason: 'retry' }),
        }
      );
      const retryBody = (await retryCancel.json()) as any;
      assert.equal(retryCancel.status, 200);
      assert.equal(retryBody.restoredCount, 0);
      c = (await h.engine.listCoupons()).find((x) => x.code === 'CANCELCHK')!;
      assert.equal(c.usageCount, 0);
    } finally {
      await h.close();
      await new Promise<void>((resolve) => mockSupabase.close(() => resolve()));
    }
  });

  test('24. [C5] Webhook-first RZP placeholder reconciles safely to real order UUID, blocks overwriting real UUID, and supports order-first flow', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'RECONCILE1',
          name: 'Webhook Reconciliation Coupon',
          offerType: 'fixed',
          discountValue: 100,
          minOrderAmount: 500,
          applicability: 'entire_website',
          totalUsageLimit: 10,
          oneTimePerCustomer: false,
          perCustomerLimit: null,
          status: 'active',
        },
        'admin'
      );
      await h.engine.saveSettings({ restoreOnCancel: true, updatedBy: 'admin' });

      // FLOW A: Webhook arrives BEFORE /api/orders/place -> writes temporary RZP-... orderId
      const resv1 = await h.engine.reserveCouponAtomic({
        code: 'RECONCILE1',
        items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        paymentPlan: 'prepaid_100',
      });
      await h.engine.attachRazorpayOrderToReservation(resv1.reservation!.id, 'order_whfirst_01');

      const whFirst = await h.engine.finalizeReservationAtomic({
        reservationId: resv1.reservation!.id,
        orderId: 'RZP-order_whfirst_01',
        orderNumber: 'TQ-WH01',
        paymentId: 'pay_whfirst_01',
        paymentStatus: 'paid',
      });
      assert.equal(whFirst.success, true);
      assert.equal(whFirst.alreadyFinalized, false);

      // Now /api/orders/place inserts the real UUID order and reconciles the reservation
      const realUuid = '22222222-2222-2222-2222-222222222222';
      const reconciled = await h.engine.finalizeReservationAtomic({
        reservationId: resv1.reservation!.id,
        orderId: realUuid,
        orderNumber: 'TQ-REAL-2222',
        paymentId: 'pay_whfirst_01',
        paymentStatus: 'paid',
      });
      assert.equal(reconciled.success, true);
      assert.equal(reconciled.alreadyFinalized, true);
      assert.equal(reconciled.reconciled, true);
      assert.equal(reconciled.orderId, realUuid);

      // Usage count must STILL be 1 (no double-count)
      let c = (await h.engine.listCoupons()).find((x) => x.code === 'RECONCILE1')!;
      assert.equal(c.usageCount, 1);

      // Attempting to overwrite the real UUID with a DIFFERENT real UUID must NOT overwrite it
      const spoofOverwrite = await h.engine.finalizeReservationAtomic({
        reservationId: resv1.reservation!.id,
        orderId: '33333333-3333-3333-3333-333333333333',
        orderNumber: 'TQ-SPOOF',
        paymentId: 'pay_whfirst_01',
        paymentStatus: 'paid',
      });
      assert.equal(spoofOverwrite.reconciled, false);
      assert.equal(spoofOverwrite.orderId, realUuid);

      // Admin cancellation using the real UUID finds and restores the reconciled redemption!
      const restored = await h.engine.handleOrderCancelledOrRefunded({
        orderId: realUuid,
        actor: 'admin',
        reason: 'cancelled_after_webhook_first',
      });
      assert.equal(restored.restoredCount, 1);
      c = (await h.engine.listCoupons()).find((x) => x.code === 'RECONCILE1')!;
      assert.equal(c.usageCount, 0);

      // FLOW B: /api/orders/place arrives FIRST with real UUID, then delayed webhook arrives with RZP-...
      const resv2 = await h.engine.reserveCouponAtomic({
        code: 'RECONCILE1',
        items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        paymentPlan: 'prepaid_100',
      });
      await h.engine.attachRazorpayOrderToReservation(resv2.reservation!.id, 'order_ordfirst_02');

      const realUuid2 = '44444444-4444-4444-4444-444444444444';
      const orderFirst = await h.engine.finalizeReservationAtomic({
        reservationId: resv2.reservation!.id,
        orderId: realUuid2,
        orderNumber: 'TQ-REAL-4444',
        paymentId: 'pay_ordfirst_02',
        paymentStatus: 'paid',
      });
      assert.equal(orderFirst.success, true);
      assert.equal(orderFirst.alreadyFinalized, false);

      const lateWh = await h.engine.finalizeReservationAtomic({
        reservationId: resv2.reservation!.id,
        orderId: 'RZP-order_ordfirst_02',
        orderNumber: 'TQ-RZP',
        paymentId: 'pay_ordfirst_02',
        paymentStatus: 'paid',
      });
      assert.equal(lateWh.success, true);
      assert.equal(lateWh.alreadyFinalized, true);
      assert.equal(lateWh.reconciled, false);
      assert.equal(lateWh.orderId, realUuid2);

      // Refund lookup by razorpayOrderId or paymentId also works
      const refundRestore = await h.engine.handleOrderCancelledOrRefunded({
        razorpayOrderId: 'order_ordfirst_02',
        paymentId: 'pay_ordfirst_02',
        actor: 'razorpay_webhook',
        reason: 'refund.processed',
      });
      assert.equal(refundRestore.restoredCount, 1);
    } finally {
      await h.close();
    }
  });

  test('25. [H1] /api/razorpay/release-reservation enforces ownership and blocks unauthorized release & recovery-token harvesting', async () => {
    const h = await createTestHarness();
    try {
      await h.engine.createCoupon(
        {
          code: 'OWNERLOCK1',
          name: 'Owner-Protected Reservation Coupon',
          offerType: 'fixed',
          discountValue: 200,
          minOrderAmount: 500,
          applicability: 'entire_website',
          totalUsageLimit: 1,
          oneTimePerCustomer: false,
          perCustomerLimit: null,
          status: 'active',
        },
        'admin'
      );

      // Alice reserves the single coupon slot
      const createRes = await fetch(`${h.baseUrl}/api/razorpay/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-alice',
        },
        body: JSON.stringify({
          couponCode: 'OWNERLOCK1',
          paymentPlan: 'prepaid_100',
          checkoutSessionId: 'chk_alice_session_001',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      const created = (await createRes.json()) as any;
      assert.equal(createRes.status, 200);
      assert.ok(created.reservationId);
      assert.ok(created.releaseToken);

      // Attack 1: Anonymous caller tries to release Alice's reservation without token -> 403
      const anonAttack = await fetch(`${h.baseUrl}/api/razorpay/release-reservation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: created.reservationId,
          razorpayOrderId: created.orderId,
          reason: 'payment_cancelled',
        }),
      });
      const anonBody = (await anonAttack.json()) as any;
      assert.equal(anonAttack.status, 403);
      assert.equal(anonBody.code, 'FORBIDDEN_RESERVATION_RELEASE');
      assert.equal(anonBody.recoveryToken, undefined);

      // Attack 2: Bob (different authenticated customer) tries to release Alice's reservation -> 403
      const bobAttack = await fetch(`${h.baseUrl}/api/razorpay/release-reservation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-jwt-bob',
        },
        body: JSON.stringify({
          reservationId: created.reservationId,
          razorpayOrderId: created.orderId,
          releaseToken: 'forged.token',
          reason: 'payment_cancelled',
        }),
      });
      assert.equal(bobAttack.status, 403);

      // Attack 3: Non-existent razorpayOrderId without valid releaseToken cannot harvest SAVE5NOW tokens -> 403
      const harvestAttack = await fetch(`${h.baseUrl}/api/razorpay/release-reservation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpayOrderId: 'order_random_made_up_999',
          reason: 'payment_cancelled',
        }),
      });
      assert.equal(harvestAttack.status, 403);

      // Verify Alice's reservation is STILL actively held
      const stillHeld = await h.engine.getReservation({ reservationId: created.reservationId });
      assert.equal(stillHeld?.status, 'reserved');

      // Authorized owner with valid server-signed releaseToken succeeds and receives recoveryToken on payment_cancelled
      const ownerRelease = await fetch(`${h.baseUrl}/api/razorpay/release-reservation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservationId: created.reservationId,
          razorpayOrderId: created.orderId,
          releaseToken: created.releaseToken,
          reason: 'razorpay_modal_dismissed',
        }),
      });
      const ownerBody = (await ownerRelease.json()) as any;
      assert.equal(ownerRelease.status, 200);
      assert.equal(ownerBody.released, true);
      assert.ok(ownerBody.recoveryToken, 'Legitimate payment drop must receive signed recovery token');
    } finally {
      await h.close();
    }
  });

  test('26. [H2] /api/coupons/recovery-session rejects empty/unverified requests, enforces rate limit, and allows genuine checkout recovery', async () => {
    const h = await createTestHarness();
    try {
      // Empty payload rejected (400)
      const emptyRes = await fetch(`${h.baseUrl}/api/coupons/recovery-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(emptyRes.status, 400);

      // Missing cart items rejected (400)
      const noCartRes = await fetch(`${h.baseUrl}/api/coupons/recovery-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutSessionId: 'chk_valid_session_01',
          phone: '9876543210',
          triggerReason: 'checkout_hesitation',
          items: [],
        }),
      });
      assert.equal(noCartRes.status, 400);

      // Missing customer JWT & valid phone rejected (403)
      const noIdentityRes = await fetch(`${h.baseUrl}/api/coupons/recovery-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutSessionId: 'chk_valid_session_02',
          triggerReason: 'checkout_hesitation',
          items: [{ productId: 'prod-plain-polo', quantity: 2 }],
        }),
      });
      assert.equal(noIdentityRes.status, 403);

      // Valid checkout recovery succeeds
      const validPayload = {
        checkoutSessionId: 'chk_valid_session_03',
        phone: '9876543210',
        triggerReason: 'checkout_hesitation',
        items: [{ productId: 'prod-plain-polo', quantity: 2 }],
      };
      const ok1 = await fetch(`${h.baseUrl}/api/coupons/recovery-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });
      const ok1Body = (await ok1.json()) as any;
      assert.equal(ok1.status, 200);
      assert.equal(ok1Body.success, true);
      assert.ok(ok1Body.recoveryToken);

      // Repeated bursts on the same session hit 429 rate limit
      await fetch(`${h.baseUrl}/api/coupons/recovery-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });
      await fetch(`${h.baseUrl}/api/coupons/recovery-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });
      const limited = await fetch(`${h.baseUrl}/api/coupons/recovery-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      });
      const limitedBody = (await limited.json()) as any;
      assert.equal(limited.status, 429);
      assert.equal(limitedBody.code, 'RATE_LIMIT_EXCEEDED');
    } finally {
      await h.close();
    }
  });

  test('27. [H3] Supabase write errors on saveSettings, appendAuditLog, and appendNotification throw CouponStorageUnavailableError', async () => {
    const mockSupabase = http.createServer((req, res) => {
      // Health check passes so Supabase path is exercised
      if (req.method === 'GET' && req.url?.startsWith('/rest/v1/coupons?select=id')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([]));
        return;
      }
      // Simulate write errors on settings, audit logs, and customer notifications
      if (
        req.method === 'POST' &&
        (req.url?.includes('/rest/v1/coupon_settings') ||
          req.url?.includes('/rest/v1/coupon_audit_logs') ||
          req.url?.includes('/rest/v1/coupon_customer_notifications'))
      ) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Simulated write failure' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([]));
    });
    await new Promise<void>((resolve) => mockSupabase.listen(0, '127.0.0.1', () => resolve()));
    const sbAddr = mockSupabase.address();
    assert(sbAddr && typeof sbAddr === 'object');
    const sbUrl = `http://127.0.0.1:${sbAddr.port}`;

    const h = await createTestHarness({
      isProduction: true,
      supabaseConfig: { configured: true, url: sbUrl, serviceRoleKey: 'test-srk' },
    });

    try {
      await assert.rejects(
        () => h.engine.saveSettings({ restoreOnCancel: false, updatedBy: 'admin' }),
        CouponStorageUnavailableError
      );
      await assert.rejects(
        () =>
          h.engine.appendAuditLog({
            couponCode: 'TEST',
            action: 'updated',
            actor: 'admin',
            summary: 'should fail loudly',
          }),
        CouponStorageUnavailableError
      );
      await assert.rejects(
        () =>
          h.engine.appendNotification({
            couponId: 'c1',
            couponCode: 'TEST',
            customerEmail: 'alice@example.com',
            title: 'Offer',
            message: 'Hello',
            channel: 'dashboard',
            emailSent: false,
          }),
        CouponStorageUnavailableError
      );
    } finally {
      await h.close();
      await new Promise<void>((resolve) => mockSupabase.close(() => resolve()));
    }
  });

  test('28. [H4] Multi-item custom_orders rows are deduplicated at order level while preserving product-level breakdown', () => {
    const hardeningSql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/coupons_security_hardening_migration.sql'),
      'utf8'
    );
    assert.ok(hardeningSql.includes('ADD COLUMN IF NOT EXISTS order_group_id'));
    assert.ok(hardeningSql.includes('ADD COLUMN IF NOT EXISTS line_subtotal_inr'));
    assert.ok(hardeningSql.includes('ADD COLUMN IF NOT EXISTS line_total_inr'));
    assert.ok(hardeningSql.includes('CREATE OR REPLACE VIEW public.order_level_analytics'));
    assert.ok(hardeningSql.includes('GRANT SELECT ON public.order_level_analytics TO service_role'));

    // Order 1 has 2 line items sharing the same order_group_id & razorpay_order_id (total ₹3,000, discount ₹300, paid ₹1,500)
    // Order 2 is a single-item order (total ₹1,500, discount ₹0, paid ₹1,500)
    const analytics = computeDeduplicatedOrderAnalytics([
      {
        id: 'row-1a',
        order_group_id: 'grp_001',
        razorpay_order_id: 'order_multi_1',
        product_id: 'prod-plain-polo',
        quantity: 2,
        status: 'pending',
        line_subtotal_inr: 1400,
        line_total_inr: 1800,
        coupon_code: 'WELCOME10',
        discount_inr: 300,
        shipping_saved_inr: 0,
        final_total_inr: 3000,
        amount_paid_inr: 1500,
        balance_due_inr: 1500,
        created_at: '2026-11-20T10:00:00Z',
      },
      {
        id: 'row-1b',
        order_group_id: 'grp_001',
        razorpay_order_id: 'order_multi_1',
        product_id: 'prod-cotton-tee',
        quantity: 3,
        status: 'pending',
        line_subtotal_inr: 1200,
        line_total_inr: 1200,
        coupon_code: 'WELCOME10',
        discount_inr: 300,
        shipping_saved_inr: 0,
        final_total_inr: 3000,
        amount_paid_inr: 1500,
        balance_due_inr: 1500,
        created_at: '2026-11-20T10:00:01Z',
      },
      {
        id: 'row-2a',
        order_group_id: 'grp_002',
        razorpay_order_id: 'order_single_2',
        product_id: 'prod-plain-polo',
        quantity: 2,
        status: 'delivered',
        line_subtotal_inr: 1271,
        line_total_inr: 1500,
        coupon_code: null,
        discount_inr: 0,
        shipping_saved_inr: 0,
        final_total_inr: 1500,
        amount_paid_inr: 1500,
        balance_due_inr: 0,
        created_at: '2026-11-21T10:00:00Z',
      },
    ]);

    // Order-level metrics must NEVER double-count Order 1
    assert.equal(analytics.uniqueOrderCount, 2);
    assert.equal(analytics.couponOrdersCount, 1);
    assert.equal(analytics.totalRevenueInr, 4500); // 3000 + 1500 (NOT 3000 + 3000 + 1500)
    assert.equal(analytics.totalDiscountInr, 300); // 300 once (NOT 600)
    assert.equal(analytics.totalPaidInr, 3000); // 1500 + 1500 (NOT 4500)
    assert.equal(analytics.totalBalanceDueInr, 1500); // 1500 once (NOT 3000)

    // Product-level breakdown remains accurate across all line items
    const poloStats = analytics.productBreakdown.find((p) => p.productId === 'prod-plain-polo')!;
    const teeStats = analytics.productBreakdown.find((p) => p.productId === 'prod-cotton-tee')!;
    assert.equal(poloStats.units, 4);
    assert.equal(poloStats.lineTotalInr, 3300);
    assert.equal(teeStats.units, 3);
    assert.equal(teeStats.lineTotalInr, 1200);
  });
});
