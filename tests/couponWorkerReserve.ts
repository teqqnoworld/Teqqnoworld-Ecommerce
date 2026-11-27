import { createCouponRouter, type VerifiedCustomerSession } from '../server/couponRoutes.ts';

async function main() {
  const storageFilePath = process.env.TEST_COUPON_STORE_PATH;
  const code = process.env.TEST_COUPON_CODE || 'MULTIWORK1';
  const workerId = process.env.TEST_WORKER_ID || String(process.pid);

  if (!storageFilePath) {
    console.error(JSON.stringify({ ok: false, error: 'Missing TEST_COUPON_STORE_PATH' }));
    process.exit(2);
  }

  const customer: VerifiedCustomerSession = {
    customerId: `worker-user-${workerId}`,
    email: `worker-${workerId}@teqqnotest.com`,
    phone: `98000000${String(workerId).padStart(2, '0').slice(-2)}`,
    accountType: 'individual',
    fullName: `Worker ${workerId}`,
  };

  const { engine } = createCouponRouter({
    verifyAdminRequest: () => ({ valid: false }),
    verifyCustomerJwt: async () => customer,
    getSupabaseAdminConfig: () => ({ configured: false, url: '', serviceRoleKey: '' }),
    buildSupabaseAdminHeaders: () => ({}),
    isProduction: () => false,
    sendCouponEmail: async () => ({ sent: false, reason: 'test' }),
    escapeHtml: (s) => s,
    storageFilePath,
  });

  const outcome = await engine.reserveCouponAtomic({
    code,
    items: [{ productId: 'prod-plain-polo', quantity: 2 }],
    paymentPlan: 'prepaid_100',
    verifiedCustomer: customer,
  });

  console.log(
    JSON.stringify({
      workerId,
      success: outcome.success,
      httpStatus: outcome.httpStatus,
      reservationId: outcome.reservation?.id || null,
      reasonCode: outcome.validation?.reasonCode || null,
    })
  );
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }));
  process.exit(1);
});
