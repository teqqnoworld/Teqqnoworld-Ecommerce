import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import {
  createCustomOrdersRouter,
  createExpiringOrderActionToken,
  processSignedWhatsAppOrderAction,
  verifyExpiringOrderActionToken,
  type CustomOrderDbRow,
  type CustomOrdersStorageAdapter,
  type VerifiedCustomerSessionLike,
} from '../server/customOrdersRoutes.ts';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ name, passed: true });
    console.log(`  PASS  ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err?.message || String(err) });
    console.error(`  FAIL  ${name}\n        ${err?.message || err}`);
  }
}

function createInMemoryStorage(seedOrders: CustomOrderDbRow[]): {
  storage: CustomOrdersStorageAdapter;
  orders: CustomOrderDbRow[];
  appointments: any[];
} {
  const orders: CustomOrderDbRow[] = seedOrders.map((o) => ({ ...o }));
  const appointments: any[] = [];

  const storage: CustomOrdersStorageAdapter = {
    async listAllOrders(limit, status) {
      const filtered = status ? orders.filter((o) => o.status === status) : orders;
      return filtered.slice(0, limit).map((o) => ({ ...o }));
    },
    async getOrderById(orderId) {
      const found = orders.find((o) => o.id === orderId);
      return found ? { ...found } : null;
    },
    async findOrdersForCustomer({ email, phoneLast10 }) {
      const e = (email || '').trim().toLowerCase();
      const p = (phoneLast10 || '').replace(/[^0-9]/g, '').slice(-10);
      if (!e && !p) return [];
      return orders
        .filter((o) => {
          const oe = (o.customer_email || '').trim().toLowerCase();
          const op = (o.phone || '').replace(/[^0-9]/g, '').slice(-10);
          return (e && oe === e) || (p && op === p);
        })
        .map((o) => ({ ...o }));
    },
    async findOrdersByReference(orderRef) {
      const clean = orderRef.trim().toLowerCase();
      return orders
        .filter((o) => {
          const id = o.id.toLowerCase();
          const orderNum = `tq-${o.id.slice(0, 8)}`.toLowerCase();
          const awb = (o.tracking_number || '').toLowerCase();
          return id === clean || orderNum === clean || (awb && awb === clean);
        })
        .map((o) => ({ ...o }));
    },
    async updateOrderStatus(orderId, patch) {
      const idx = orders.findIndex((o) => o.id === orderId);
      if (idx === -1) return null;
      orders[idx] = {
        ...orders[idx],
        status: patch.status,
        ...(patch.courier_partner !== undefined ? { courier_partner: patch.courier_partner } : {}),
        ...(patch.tracking_number !== undefined ? { tracking_number: patch.tracking_number } : {}),
      };
      return { ...orders[idx] };
    },
    async insertQuoteOrder(record) {
      const id = `11111111-2222-4333-8444-${String(orders.length + 1).padStart(12, '0')}`;
      orders.unshift({
        id,
        ...record,
        courier_partner: null,
        tracking_number: null,
        created_at: new Date().toISOString(),
      });
      return { id, tableUsed: 'custom_orders' };
    },
    async insertAppointmentOrFallback(record) {
      appointments.push(record);
      const id = `22222222-3333-4444-8555-${String(appointments.length).padStart(12, '0')}`;
      return { id, tableUsed: 'custom_orders' };
    },
  };

  return { storage, orders, appointments };
}

async function startTestServer() {
  const SEED_ORDERS: CustomOrderDbRow[] = [
    {
      id: 'aaaa1111-0000-4000-8000-000000000001',
      customer_name: 'Aarav Mehta',
      customer_email: 'aarav@alpha-corp.in',
      company: 'Alpha Corp India',
      phone: '+91 9876543210',
      product_id: 'prod-polo-01',
      quantity: 50,
      logo_url: 'https://cdn.teqqnoworld.com/logo-a.webp',
      custom_notes: 'Address: 14 MG Road, Bengaluru | Payment: Razorpay rzp_live_secret_note',
      status: 'pending',
      courier_partner: 'Delhivery Express',
      tracking_number: 'DLV-AWB-100001',
      final_total_inr: 35000,
      created_at: '2026-11-20T10:00:00.000Z',
    },
    {
      id: 'bbbb2222-0000-4000-8000-000000000002',
      customer_name: 'Priya Sharma',
      customer_email: 'priya@beta-labs.in',
      company: 'Beta Labs Pvt Ltd',
      phone: '+91 9123456789',
      product_id: 'prod-ceramic-mug',
      quantity: 120,
      logo_url: 'https://cdn.teqqnoworld.com/logo-b.webp',
      custom_notes: 'Address: 88 Cyber City, Gurugram | Confidential VIP gift batch',
      status: 'dispatched',
      courier_partner: 'Delhivery Express',
      tracking_number: 'DLV-AWB-200002',
      final_total_inr: 29880,
      created_at: '2026-11-21T12:00:00.000Z',
    },
  ];

  const ADMIN_VALID_TOKEN = 'valid_admin_session_token_test';
  const CUSTOMER_A_JWT = 'customer_a_valid_jwt_token_1234567890';
  const CUSTOMER_B_JWT = 'customer_b_valid_jwt_token_1234567890';
  const WA_SECRET = 'test_whatsapp_hmac_secret_2026';

  const CUSTOMER_SESSIONS: Record<string, VerifiedCustomerSessionLike> = {
    [CUSTOMER_A_JWT]: {
      customerId: 'cust-a-uuid',
      email: 'aarav@alpha-corp.in',
      phone: '9876543210',
      accountType: 'business',
      fullName: 'Aarav Mehta',
    },
    [CUSTOMER_B_JWT]: {
      customerId: 'cust-b-uuid',
      email: 'priya@beta-labs.in',
      phone: '9123456789',
      accountType: 'business',
      fullName: 'Priya Sharma',
    },
  };

  const mem = createInMemoryStorage(SEED_ORDERS);
  const consumedWaTokens = new Set<string>();

  const app = express();
  app.use(express.json());

  const customOrders = createCustomOrdersRouter({
    verifyAdminRequest: (req) => {
      const auth = String(req.headers.authorization || '');
      const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      return { valid: token === ADMIN_VALID_TOKEN, email: 'admin@teqqnoworld.com' };
    },
    verifyCustomerJwt: async (req) => {
      const auth = String(req.headers.authorization || '');
      const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
      return CUSTOMER_SESSIONS[token] || null;
    },
    isProduction: () => true,
    getSupabaseAdminConfig: () => ({ configured: true, url: 'https://example.supabase.co', serviceRoleKey: 'mock' }),
    buildSupabaseAdminHeaders: () => ({}),
    storage: mem.storage,
    rateLimits: {
      trackMaxRequests: 25,
      trackWindowMs: 60_000,
      quoteMaxRequests: 3,
      quoteWindowMs: 60_000,
    },
  });

  app.use('/api', customOrders.router);

  // Mount test WhatsApp order-action endpoint using the exact production processor
  app.post('/api/aisensy/order-action', async (req, res) => {
    const { orderId, action, token } = req.body || {};
    const result = await processSignedWhatsAppOrderAction({
      orderId: String(orderId || ''),
      action,
      token,
      secret: WA_SECRET,
      hasConsumedToken: (h) => consumedWaTokens.has(h),
      markTokenConsumed: (h) => {
        consumedWaTokens.add(h);
      },
      storage: mem.storage,
    });
    return res.status(result.httpStatus).json({
      success: result.ok,
      code: result.code,
      whatsappActionStatus: result.targetStatus,
      orderStatus: result.dbOrderStatus,
      message: result.message,
    });
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    server,
    mem,
    ADMIN_VALID_TOKEN,
    CUSTOMER_A_JWT,
    CUSTOMER_B_JWT,
    WA_SECRET,
    SEED_ORDERS,
  };
}

async function main() {
  console.log('\n=== TEQQNOWORLD CUSTOM ORDERS SECURITY TEST SUITE ===\n');
  const ctx = await startTestServer();

  try {
    // ------------------------------------------------------------------------
    // A. ANONYMOUS ACCESS & SQL MIGRATION HARDENING VERIFICATION
    // ------------------------------------------------------------------------
    await runTest('A1. SQL migration drops unrestricted public & broad authenticated policies and revokes anon/authenticated grants', () => {
      const sqlPath = path.resolve(process.cwd(), 'supabase/custom_orders_rls_hardening_migration.sql');
      assert.ok(fs.existsSync(sqlPath), 'Migration file must exist');
      const sql = fs.readFileSync(sqlPath, 'utf8');
      assert.match(sql, /ALTER TABLE public\.custom_orders ENABLE ROW LEVEL SECURITY;/i);
      assert.match(sql, /DROP POLICY IF EXISTS "Public read custom_orders" ON public\.custom_orders;/i);
      assert.match(sql, /DROP POLICY IF EXISTS "Admins can view all custom order quotes" ON public\.custom_orders;/i);
      assert.match(sql, /DROP POLICY IF EXISTS "Admins can update custom order quote status" ON public\.custom_orders;/i);
      assert.match(sql, /DROP POLICY IF EXISTS "Public insert orders" ON public\.custom_orders;/i);
      assert.match(sql, /REVOKE ALL ON TABLE public\.custom_orders FROM PUBLIC, anon, authenticated;/i);
      assert.match(sql, /TO service_role/i);
      assert.doesNotMatch(sql, /FOR SELECT\s+TO\s+(public|anon|authenticated)/i);
    });

    await runTest('A2. Zero direct browser supabase.from("custom_orders") calls remain in src/', () => {
      const srcFiles = [
        'src/services/supabaseService.ts',
        'src/lib/supabase.ts',
        'src/components/AdminHubView.tsx',
        'src/components/OrderTrackingModal.tsx',
        'src/components/CustomerDashboard.tsx',
        'src/components/OrderActionView.tsx',
        'src/components/AppointmentBookingModal.tsx',
        'src/components/SupabaseDevModal.tsx',
        'src/hooks/useSupabase.ts',
      ];
      for (const rel of srcFiles) {
        const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
        assert.doesNotMatch(
          content,
          /\.from\(\s*['"]custom_orders['"]\s*\)/,
          `Direct browser supabase.from('custom_orders') must not exist in ${rel}`
        );
      }
    });

    await runTest('A3. Unauthenticated GET /api/admin/orders and PATCH /api/admin/orders/:id/status return 401', async () => {
      const r1 = await fetch(`${ctx.baseUrl}/api/admin/orders`);
      assert.equal(r1.status, 401);
      const r2 = await fetch(`${ctx.baseUrl}/api/admin/orders/${ctx.SEED_ORDERS[0].id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.equal(r2.status, 401);
    });

    await runTest('A4. Unauthenticated GET /api/customer/orders returns 401', async () => {
      const r = await fetch(`${ctx.baseUrl}/api/customer/orders?email=aarav@alpha-corp.in`);
      assert.equal(r.status, 401);
    });

    // ------------------------------------------------------------------------
    // B. CUSTOMER ISOLATION
    // ------------------------------------------------------------------------
    await runTest('B1. Customer A sees ONLY Customer A orders and NEVER Customer B orders', async () => {
      const r = await fetch(`${ctx.baseUrl}/api/customer/orders`, {
        headers: { Authorization: `Bearer ${ctx.CUSTOMER_A_JWT}` },
      });
      assert.equal(r.status, 200);
      const body = (await r.json()) as any;
      assert.equal(body.success, true);
      assert.equal(body.orders.length, 1);
      assert.equal(body.orders[0].id, ctx.SEED_ORDERS[0].id);
      assert.equal(body.orders[0].customer_email, 'aarav@alpha-corp.in');
    });

    await runTest('B2. Forged email/phone/userId query params cannot override verified customer JWT', async () => {
      const r = await fetch(
        `${ctx.baseUrl}/api/customer/orders?email=priya@beta-labs.in&phone=9123456789&userId=cust-b-uuid`,
        {
          headers: { Authorization: `Bearer ${ctx.CUSTOMER_A_JWT}` },
        }
      );
      assert.equal(r.status, 200);
      const body = (await r.json()) as any;
      assert.equal(body.orders.length, 1);
      assert.equal(body.orders[0].id, ctx.SEED_ORDERS[0].id);
      assert.ok(!JSON.stringify(body).includes('priya@beta-labs.in'));
      assert.ok(!JSON.stringify(body).includes('Beta Labs'));
    });

    await runTest('B3. Invalid customer JWT returns 401', async () => {
      const r = await fetch(`${ctx.baseUrl}/api/customer/orders`, {
        headers: { Authorization: 'Bearer invalid.forged.jwt.token' },
      });
      assert.equal(r.status, 401);
    });

    // ------------------------------------------------------------------------
    // C. SECURE ORDER TRACKING
    // ------------------------------------------------------------------------
    await runTest('C1. Guest phone-only order tracking is rejected (400)', async () => {
      const r = await fetch(`${ctx.baseUrl}/api/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderRef: '9876543210' }),
      });
      assert.equal(r.status, 400);
    });

    await runTest('C2. Guest orderRef without contact is rejected (400)', async () => {
      const r = await fetch(`${ctx.baseUrl}/api/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderRef: 'TQ-AAAA1111' }),
      });
      assert.equal(r.status, 400);
    });

    await runTest('C3. Guest orderRef + matching email succeeds and returns ONLY the 11 safe non-PII fields', async () => {
      const r = await fetch(`${ctx.baseUrl}/api/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderRef: 'TQ-AAAA1111',
          contact: 'aarav@alpha-corp.in',
        }),
      });
      assert.equal(r.status, 200);
      const body = (await r.json()) as any;
      assert.equal(body.success, true);

      const allowedKeys = [
        'courierPartner',
        'createdAt',
        'estimatedDispatch',
        'orderId',
        'orderNumber',
        'orderStatus',
        'productId',
        'proofStatus',
        'quantity',
        'status',
        'trackingNumber',
      ];
      assert.deepEqual(Object.keys(body.tracking).sort(), allowedKeys);

      const raw = JSON.stringify(body);
      assert.ok(!raw.includes('aarav@alpha-corp.in'), 'Must never leak customer email');
      assert.ok(!raw.includes('Aarav Mehta'), 'Must never leak customer name');
      assert.ok(!raw.includes('9876543210'), 'Must never leak phone');
      assert.ok(!raw.includes('Alpha Corp'), 'Must never leak company');
      assert.ok(!raw.includes('MG Road'), 'Must never leak address/custom_notes');
      assert.ok(!raw.includes('rzp_live_secret_note'), 'Must never leak payment secrets');
    });

    await runTest('C4. Guest orderRef + matching phone succeeds; wrong contact or wrong orderRef return identical generic 404', async () => {
      const okResp = await fetch(`${ctx.baseUrl}/api/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderRef: 'DLV-AWB-200002',
          contact: '9123456789',
        }),
      });
      assert.equal(okResp.status, 200);

      const wrongContact = await fetch(`${ctx.baseUrl}/api/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderRef: 'DLV-AWB-200002',
          contact: 'wrong@example.com',
        }),
      });
      const wrongOrder = await fetch(`${ctx.baseUrl}/api/orders/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderRef: 'TQ-99999999',
          contact: 'priya@beta-labs.in',
        }),
      });

      assert.equal(wrongContact.status, 404);
      assert.equal(wrongOrder.status, 404);
      const b1 = (await wrongContact.json()) as any;
      const b2 = (await wrongOrder.json()) as any;
      assert.equal(b1.message, b2.message, 'Error messages must be identical to prevent enumeration');
    });

    await runTest('C5. Signed-in Customer A can track own order without contact, but CANNOT track Customer B order', async () => {
      const own = await fetch(`${ctx.baseUrl}/api/orders/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.CUSTOMER_A_JWT}`,
        },
        body: JSON.stringify({ orderRef: 'TQ-AAAA1111' }),
      });
      assert.equal(own.status, 200);

      const other = await fetch(`${ctx.baseUrl}/api/orders/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.CUSTOMER_A_JWT}`,
        },
        body: JSON.stringify({ orderRef: 'TQ-BBBB2222' }),
      });
      assert.equal(other.status, 404);
    });

    // ------------------------------------------------------------------------
    // D. ADMIN AUTHORIZATION & STATUS TRANSITIONS
    // ------------------------------------------------------------------------
    await runTest('D1. Regular Supabase Auth customer JWT is rejected (401) on Admin endpoints', async () => {
      const r1 = await fetch(`${ctx.baseUrl}/api/admin/orders`, {
        headers: { Authorization: `Bearer ${ctx.CUSTOMER_A_JWT}` },
      });
      assert.equal(r1.status, 401);

      const r2 = await fetch(`${ctx.baseUrl}/api/admin/orders/${ctx.SEED_ORDERS[0].id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.CUSTOMER_A_JWT}`,
        },
        body: JSON.stringify({ status: 'approved' }),
      });
      assert.equal(r2.status, 401);
    });

    await runTest('D2. Valid Admin session lists orders and updates permitted statuses; invalid transition rejected (422)', async () => {
      const listResp = await fetch(`${ctx.baseUrl}/api/admin/orders`, {
        headers: { Authorization: `Bearer ${ctx.ADMIN_VALID_TOKEN}` },
      });
      assert.equal(listResp.status, 200);
      const listBody = (await listResp.json()) as any;
      assert.equal(listBody.orders.length, 2);

      // Valid transition: dispatched -> delivered
      const okUpdate = await fetch(`${ctx.baseUrl}/api/admin/orders/${ctx.SEED_ORDERS[1].id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.ADMIN_VALID_TOKEN}`,
        },
        body: JSON.stringify({
          status: 'delivered',
          courierPartner: 'Delhivery Express',
          trackingNumber: 'DLV-AWB-200002',
        }),
      });
      assert.equal(okUpdate.status, 200);
      const updated = (await okUpdate.json()) as any;
      assert.equal(updated.order.status, 'delivered');

      // Invalid transition: delivered -> pending must be blocked
      const badUpdate = await fetch(`${ctx.baseUrl}/api/admin/orders/${ctx.SEED_ORDERS[1].id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.ADMIN_VALID_TOKEN}`,
        },
        body: JSON.stringify({ status: 'pending' }),
      });
      assert.equal(badUpdate.status, 422);
    });

    // ------------------------------------------------------------------------
    // E. QUOTE, RFQ & CONSULTATION SUBMISSION + RATE LIMITING
    // ------------------------------------------------------------------------
    await runTest('E1. Invalid productId and invalid quantity are rejected (400)', async () => {
      const badProd = await fetch(`${ctx.baseUrl}/api/quotes/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Vikram Singh',
          customerEmail: 'vikram@company.in',
          phone: '9876500001',
          productId: 'prod-fake-nonexistent',
          quantity: 25,
        }),
      });
      assert.equal(badProd.status, 400);

      const badQty = await fetch(`${ctx.baseUrl}/api/quotes/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Vikram Singh',
          customerEmail: 'vikram@company.in',
          phone: '9876500001',
          productId: 'prod-polo-01',
          quantity: -5,
        }),
      });
      assert.equal(badQty.status, 400);
    });

    await runTest('E2. Valid quote submission succeeds, prevents mass assignment, returns minimal payload, and enforces rate limit (429)', async () => {
      const okQuote = await fetch(`${ctx.baseUrl}/api/quotes/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Sneha Rao',
          customerEmail: 'sneha@designstudio.in',
          phone: '+91 9988776655',
          productId: 'prod-polo-01',
          quantity: 40,
          status: 'delivered', // attempted mass assignment — must be ignored!
        }),
      });
      assert.equal(okQuote.status, 201);
      const quoteBody = (await okQuote.json()) as any;
      assert.deepEqual(Object.keys(quoteBody).sort(), ['orderId', 'orderNumber', 'success']);
      assert.ok(!JSON.stringify(quoteBody).includes('sneha@designstudio.in'));

      // Verify stored row forced status = 'pending'
      const saved = await ctx.mem.storage.getOrderById(quoteBody.orderId);
      assert.equal(saved?.status, 'pending');

      // Exceed configured quote rate limit (3 requests per window; 2 already used in E1 + 1 here = 3)
      const rateLimited = await fetch(`${ctx.baseUrl}/api/quotes/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: 'Rate Limit Check',
          customerEmail: 'rl@test.in',
          phone: '9988776655',
          productId: 'prod-polo-01',
          quantity: 10,
        }),
      });
      assert.equal(rateLimited.status, 429);
    });

    await runTest('E3. Consultation submission succeeds via /api/quotes/submit (admin bypasses public rate limit)', async () => {
      const resp = await fetch(`${ctx.baseUrl}/api/quotes/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ctx.ADMIN_VALID_TOKEN}`,
        },
        body: JSON.stringify({
          submissionType: 'consultation',
          name: 'Rohan Kapoor',
          email: 'rohan@enterprise.in',
          phone: '9811223344',
          appointmentDate: '2026-12-05',
          appointmentTime: '11:00 AM',
          serviceType: 'Corporate Apparel Consultation',
          meetingMode: 'Google Meet',
          estimatedQuantity: 200,
        }),
      });
      assert.equal(resp.status, 201);
      const body = (await resp.json()) as any;
      assert.equal(body.success, true);
      assert.ok(body.orderId);
      assert.ok(!JSON.stringify(body).includes('rohan@enterprise.in'));
    });

    // ------------------------------------------------------------------------
    // F. WHATSAPP HMAC ORDER ACTION SECURITY
    // ------------------------------------------------------------------------
    await runTest('F1. Missing, forged, wrong-action, and expired WhatsApp HMAC tokens are rejected (403)', async () => {
      const orderId = ctx.SEED_ORDERS[0].id;

      // Missing token
      const missing = await fetch(`${ctx.baseUrl}/api/aisensy/order-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'confirm' }),
      });
      assert.equal(missing.status, 403);

      // Forged token
      const forged = await fetch(`${ctx.baseUrl}/api/aisensy/order-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'confirm', token: '9999999999.deadbeefdeadbeefdeadbeefdeadbeef' }),
      });
      assert.equal(forged.status, 403);

      // Expired token
      const expiredToken = createExpiringOrderActionToken(orderId, 'confirm', ctx.WA_SECRET, 1_000, Date.now() - 60_000);
      const expiredCheck = verifyExpiringOrderActionToken(orderId, 'confirm', expiredToken, ctx.WA_SECRET);
      assert.equal(expiredCheck.valid, false);
      assert.equal(expiredCheck.expired, true);

      const expiredResp = await fetch(`${ctx.baseUrl}/api/aisensy/order-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'confirm', token: expiredToken }),
      });
      assert.equal(expiredResp.status, 403);

      // Valid confirm token attempted on cancel action (cross-action mismatch)
      const confirmToken = createExpiringOrderActionToken(orderId, 'confirm', ctx.WA_SECRET);
      const crossAction = await fetch(`${ctx.baseUrl}/api/aisensy/order-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'cancel', token: confirmToken }),
      });
      assert.equal(crossAction.status, 403);
    });

    await runTest('F2. Valid signed WhatsApp token updates custom_orders server-side and blocks replay (409)', async () => {
      const orderId = ctx.SEED_ORDERS[0].id;
      const validToken = createExpiringOrderActionToken(orderId, 'confirm', ctx.WA_SECRET);

      const first = await fetch(`${ctx.baseUrl}/api/aisensy/order-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'confirm', token: validToken }),
      });
      assert.equal(first.status, 200);
      const firstBody = (await first.json()) as any;
      assert.equal(firstBody.success, true);
      assert.equal(firstBody.whatsappActionStatus, 'confirmed');
      assert.equal(firstBody.orderStatus, 'approved');

      // Confirm DB row actually transitioned to approved on server
      const updated = await ctx.mem.storage.getOrderById(orderId);
      assert.equal(updated?.status, 'approved');

      // Replay of the same token must be rejected
      const replay = await fetch(`${ctx.baseUrl}/api/aisensy/order-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, action: 'confirm', token: validToken }),
      });
      assert.equal(replay.status, 409);
    });
  } finally {
    await new Promise<void>((resolve) => ctx.server.close(() => resolve()));
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\nSummary: ${passed}/${results.length} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
