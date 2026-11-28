import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import http from 'node:http';
import {
  parseGscCsvExport,
  parseGscUrlInspectionCsv,
  parseGa4CsvExport,
  resolveDateRange,
  serializeSeoReportToCsv,
  buildVerifiedSeoReport,
  buildSeoAnalyticsDashboard,
  SeoAnalyticsStore,
  csvEscapeCell,
  inspectSingleUrlViaGscApi,
} from '../server/seoAnalyticsEngine.ts';
import { createSeoAnalyticsRouter } from '../server/seoAnalyticsRoutes.ts';
import {
  classifyTrafficChannel,
  resetActiveProductView,
  trackViewItem,
  trackAddToCart,
  trackAddToCartItems,
  trackBeginCheckout,
  trackPurchaseOnce,
  trackQuoteRequest,
  __resetAnalyticsTrackerForTests,
} from '../src/utils/analyticsTracker.ts';
import { calculateProductPrice } from '../src/data/pricingRules.ts';

function createTempStorePath(suffix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `teqqno-seo-p5-${suffix}-`));
  return path.join(dir, 'seo-store.json');
}

function makeDeps() {
  return {
    rootDir: process.cwd(),
    getSupabaseAdminConfig: () => ({ configured: false, url: '', serviceRoleKey: '' }),
    buildSupabaseAdminHeaders: () => ({}),
  };
}

test('1. GSC CSV parser validates headers, parses Queries/Pages/Countries/Devices/Indexing, and rejects malformed CSVs', () => {
  const queriesCsv = [
    'Top queries,Clicks,Impressions,CTR,Position',
    'customized plain cotton polo t-shirt with logo,18,450,4.0%,6.4',
    'custom printed ceramic coffee mug with logo,1,240,0.42%,14.8',
    '"=cmd|\' /C calc\'!A0",0,12,0%,22.0',
  ].join('\n');

  const parsedQ = parseGscCsvExport({ csvText: queriesCsv });
  assert.equal(parsedQ.dimension, 'query');
  assert.equal(parsedQ.rows.length, 3);
  assert.equal(parsedQ.rows[0].key, 'customized plain cotton polo t-shirt with logo');
  assert.equal(parsedQ.rows[0].clicks, 18);
  assert.equal(parsedQ.rows[0].impressions, 450);
  assert.equal(parsedQ.rows[0].ctr, 4);
  assert.equal(parsedQ.rows[0].position, 6.4);

  const pagesCsv = [
    'Top pages,Clicks,Impressions,CTR,Position',
    'https://teqqnoworld.com/product/customized-plain-polo-t-shirt/,25,600,4.17%,7.1',
    'https://teqqnoworld.com/category/custom-polo-t-shirts,10,550,1.82%,16.2',
  ].join('\n');

  const parsedP = parseGscCsvExport({ csvText: pagesCsv });
  assert.equal(parsedP.dimension, 'page');
  assert.equal(parsedP.rows[0].key, '/product/customized-plain-polo-t-shirt');
  assert.equal(parsedP.rows[1].key, '/category/custom-polo-t-shirts');

  const indexingCsv = [
    'URL,Status,Last crawled',
    'https://teqqnoworld.com/product/customized-plain-polo-t-shirt,Submitted and indexed,2026-11-24',
    'https://teqqnoworld.com/product/promo-table,Crawled - currently not indexed,2026-11-23',
  ].join('\n');

  const inspected = parseGscUrlInspectionCsv(indexingCsv);
  assert.equal(inspected.length, 2);
  assert.equal(inspected[0].status, 'indexed');
  assert.equal(inspected[1].status, 'not_indexed');

  assert.throws(() => parseGscCsvExport({ csvText: 'BadHeader1,BadHeader2\nfoo,bar' }));
  assert.throws(() => parseGscCsvExport({ csvText: '' }));
});

test('2. GA4 CSV parser separates channels & landing pages accurately without conflating direct/paid with organic', () => {
  const ga4Csv = [
    '# Exported from Google Analytics 4',
    'Landing page,Session default channel group,Sessions,Items viewed,Add to carts,Checkouts,Purchases,Purchase revenue',
    '/product/customized-plain-polo-t-shirt,Organic Search,48,40,7,4,2,8400',
    '/product/customized-plain-polo-t-shirt,Direct,30,22,5,3,3,15000',
    '/category/custom-polo-t-shirts,Paid Search,20,15,2,1,1,4000',
    'Grand total,Grand total,98,77,14,8,6,27400',
  ].join('\n');

  const parsed = parseGa4CsvExport(ga4Csv);
  assert.equal(parsed.rows.length, 3);
  const org = parsed.rows.find((r) => r.channel === 'organic_search');
  const direct = parsed.rows.find((r) => r.channel === 'direct');
  const paid = parsed.rows.find((r) => r.channel === 'paid_search');
  assert.equal(org?.purchases, 2);
  assert.equal(org?.revenueInr, 8400);
  assert.equal(direct?.purchases, 3);
  assert.equal(paid?.purchases, 1);
});

test('3. Date range handling supports 7d, 28d, 3m, 6m, 12m, and custom date ranges with exact previous periods', () => {
  const fixedNow = new Date('2026-11-26T12:00:00.000Z');
  const r7 = resolveDateRange({ preset: '7d', now: fixedNow });
  assert.equal(r7.startDate, '2026-11-20');
  assert.equal(r7.endDate, '2026-11-26');
  assert.equal(r7.previousStartDate, '2026-11-13');
  assert.equal(r7.previousEndDate, '2026-11-19');

  const r28 = resolveDateRange({ preset: '28d', now: fixedNow });
  assert.equal(r28.dayCount, 28);

  const rCustom = resolveDateRange({
    preset: 'custom',
    startDate: '2026-11-15',
    endDate: '2026-11-24',
    now: fixedNow,
  });
  assert.equal(rCustom.dayCount, 10);
  assert.equal(rCustom.previousStartDate, '2026-11-05');
  assert.equal(rCustom.previousEndDate, '2026-11-14');
});

test('4. Missing-data & zero-data handling never fabricates metrics, never claims sitemap URLs are indexed, and maps all 11 products & 5 categories', async () => {
  const storePath = createTempStorePath('empty');
  const deps = makeDeps();
  const store = new SeoAnalyticsStore(deps, storePath);

  const dashboard = await buildSeoAnalyticsDashboard({
    store,
    deps,
    preset: '7d',
  });

  // Zero fake GSC/GA4/Indexing metrics when nothing imported or connected
  assert.equal(dashboard.kpis.totalOrganicClicks.available, false);
  assert.equal(dashboard.kpis.totalOrganicClicks.value, null);
  assert.equal(dashboard.kpis.totalOrganicClicks.changePercent, null);
  assert.equal(dashboard.kpis.organicSessions.available, false);
  assert.equal(dashboard.kpis.organicPurchases.value, null);
  assert.equal(dashboard.kpis.indexedPages.available, false);
  assert.equal(dashboard.kpis.indexedPages.value, null);

  // Technical SEO audit is live & verified, yet sitemap URLs remain Unknown (never falsely Indexed)
  assert.ok(dashboard.technicalAudit.technicalHealthScore >= 95);
  assert.ok(dashboard.technicalAudit.indexingSummary.submittedUrls >= 16);
  assert.equal(dashboard.technicalAudit.indexingSummary.indexedUrls, null);
  assert.equal(
    dashboard.technicalAudit.indexingSummary.unknownUrls,
    dashboard.technicalAudit.indexingSummary.submittedUrls
  );

  // All 11 active products & 5 canonical categories mapped cleanly
  assert.equal(dashboard.products.length, 11);
  assert.equal(dashboard.categories.length, 5);
  assert.ok(dashboard.keywords.length >= 16);
  assert.ok(dashboard.keywords.every((k) => k.searchVolume === 'Not verified'));
  assert.ok(dashboard.keywords.every((k) => k.keywordDifficulty === 'Not verified'));
});

test('5. Traffic channel classifier and client/server duplicate purchase prevention work accurately', async () => {
  assert.equal(
    classifyTrafficChannel({ search: '', referrer: 'https://www.google.co.in/' }).channel,
    'organic_search'
  );
  assert.equal(
    classifyTrafficChannel({ search: '?gclid=abc123', referrer: 'https://www.google.co.in/' }).channel,
    'paid_search'
  );
  assert.equal(
    classifyTrafficChannel({ search: '', referrer: 'https://l.instagram.com/' }).channel,
    'social'
  );
  assert.equal(
    classifyTrafficChannel({ search: '?ref=PARTNER1', referrer: '' }).channel,
    'referral'
  );
  assert.equal(classifyTrafficChannel({ search: '', referrer: '' }).channel, 'direct');

  __resetAnalyticsTrackerForTests();
  const first = trackPurchaseOnce({
    transactionId: 'ORD-DEDUPE-1001',
    valueInr: 4500,
    items: [{ item_id: 'prod-plain-polo', item_name: 'Plain Polo', price: 450, quantity: 10 }],
  });
  const duplicate = trackPurchaseOnce({
    transactionId: 'ORD-DEDUPE-1001',
    valueInr: 4500,
    items: [{ item_id: 'prod-plain-polo', item_name: 'Plain Polo', price: 450, quantity: 10 }],
  });
  assert.equal(first, true);
  assert.equal(duplicate, false);

  // Server-side attribution store deduplication & channel separation
  const store = new SeoAnalyticsStore(makeDeps(), createTempStorePath('attr'));
  const r1 = await store.recordAttributionEvent({
    eventName: 'purchase',
    transactionId: 'ORD-SERVER-55',
    sessionId: 'sess-organic-1',
    channel: 'organic_search',
    landingPath: '/product/customized-plain-polo-t-shirt',
    pagePath: '/orders',
    productId: 'prod-plain-polo',
    valueInr: 5000,
    quantity: 10,
  });
  const r2 = await store.recordAttributionEvent({
    eventName: 'purchase',
    transactionId: 'ORD-SERVER-55',
    sessionId: 'sess-organic-1',
    channel: 'organic_search',
    landingPath: '/product/customized-plain-polo-t-shirt',
    pagePath: '/orders',
    productId: 'prod-plain-polo',
    valueInr: 5000,
    quantity: 10,
  });
  const rDirect = await store.recordAttributionEvent({
    eventName: 'purchase',
    transactionId: 'ORD-SERVER-56',
    sessionId: 'sess-direct-1',
    channel: 'direct',
    landingPath: '/',
    pagePath: '/orders',
    productId: 'prod-plain-polo',
    valueInr: 12000,
    quantity: 20,
  });

  assert.equal(r1.recorded, true);
  assert.equal(r2.deduplicated, true);
  assert.equal(rDirect.recorded, true);

  const dash = await buildSeoAnalyticsDashboard({ store, deps: makeDeps(), preset: '7d' });
  // Only the organic order (₹5,000) is counted under Organic Purchases/Revenue — NOT the Direct ₹12,000 order!
  assert.equal(dash.kpis.organicPurchases.value, 1);
  assert.equal(dash.kpis.organicRevenueInr.value, 5000);
  const directRow = dash.organicConversions.channels.find((c) => c.channel === 'direct');
  assert.equal(directRow?.purchases, 1);
  assert.equal(directRow?.revenueInr, 12000);
});

test('6. Admin Express API enforces auth (401 without token), supports CSV imports, recommendation workflow, honest 503 on unconfigured Google APIs, and formula-safe CSV reports', async () => {
  const app = express();
  app.use(express.json());
  const storePath = createTempStorePath('api');
  const { router } = createSeoAnalyticsRouter({
    ...makeDeps(),
    localStoreOverridePath: storePath,
    verifyAdminRequest: (req) => ({
      valid: req.headers.authorization === 'Bearer valid-admin-test-token',
      email: 'admin@teqqnoworld.com',
    }),
  });
  app.use('/api', router);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}`;

  try {
    // 1. Unauthenticated admin call rejected with 401
    const unauth = await fetch(`${base}/api/admin/seo-analytics/overview`);
    assert.equal(unauth.status, 401);

    const authHeaders = {
      Authorization: 'Bearer valid-admin-test-token',
      'Content-Type': 'application/json',
    };

    // 2. Unconfigured GSC sync fails honestly with 503 (never returns fake data)
    const syncRes = await fetch(`${base}/api/admin/seo-analytics/sync/gsc`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ preset: '7d' }),
    });
    assert.equal(syncRes.status, 503);

    // 3. Import GSC Queries + Pages CSV for current period
    const today = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);

    const impQ = await fetch(`${base}/api/admin/seo-analytics/import/gsc`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        mode: 'performance',
        dimension: 'query',
        startDate: start,
        endDate: today,
        csvText: [
          'Top queries,Clicks,Impressions,CTR,Position',
          'customized plain cotton polo t-shirt with logo,12,300,4.0%,7.2',
          'custom printed ceramic coffee mug with logo,1,220,0.45%,15.5',
          '=HYPERLINK("http://evil.example","click"),2,100,2.0%,10.0',
        ].join('\n'),
      }),
    });
    assert.equal(impQ.status, 200);

    const impP = await fetch(`${base}/api/admin/seo-analytics/import/gsc`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        mode: 'performance',
        dimension: 'page',
        startDate: start,
        endDate: today,
        csvText: [
          'Top pages,Clicks,Impressions,CTR,Position',
          'https://teqqnoworld.com/product/promotional-ceramic-mug,1,250,0.4%,15.2',
        ].join('\n'),
      }),
    });
    assert.equal(impP.status, 200);

    // 4. Overview reflects imported GSC metrics & generates observed recommendation for low-CTR mug page
    const ovRes = await fetch(`${base}/api/admin/seo-analytics/overview?preset=7d`, {
      headers: authHeaders,
    });
    assert.equal(ovRes.status, 200);
    const ovJson = (await ovRes.json()) as any;
    assert.equal(ovJson.data.kpis.totalOrganicClicks.value, 1);
    assert.equal(ovJson.data.kpis.totalSearchImpressions.value, 250);
    const mugRec = ovJson.data.recommendations.find((r: any) => r.id === 'ctr:prod-ceramic-mug');
    assert.ok(mugRec, 'Expected observed low-CTR recommendation for prod-ceramic-mug');

    // 5. Update recommendation status to completed
    const patchRes = await fetch(
      `${base}/api/admin/seo-analytics/recommendations/${encodeURIComponent('ctr:prod-ceramic-mug')}`,
      {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          status: 'completed',
          issueTitle: mugRec.issue,
          affectedUrl: mugRec.affectedUrl,
        }),
      }
    );
    assert.equal(patchRes.status, 200);

    // 6. Export weekly CSV report & verify spreadsheet formula neutralization
    const csvRes = await fetch(`${base}/api/admin/seo-analytics/reports?type=weekly&format=csv`, {
      headers: authHeaders,
    });
    assert.equal(csvRes.status, 200);
    const csvBody = await csvRes.text();
    assert.ok(csvBody.includes('TeqqnoWorld SEO Analytics Report,WEEKLY'));
    assert.ok(csvBody.includes("'=hyperlink(") || csvBody.includes("'=HYPERLINK("));
    assert.equal(csvEscapeCell('=SUM(A1:A5)'), "'=SUM(A1:A5)");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('7. Additive Supabase migration enforces RLS, service-role-only access, deduplication, and safe search_path', () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/seo_analytics_migration.sql'),
    'utf8'
  );
  assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'));
  assert.ok(sql.includes('REVOKE ALL ON TABLE public.seo_analytics_snapshots FROM PUBLIC, anon, authenticated'));
  assert.ok(sql.includes('REVOKE ALL ON TABLE public.seo_attribution_events FROM PUBLIC, anon, authenticated'));
  assert.ok(sql.includes('CONSTRAINT seo_snapshots_unique_slice UNIQUE'));
  assert.ok(sql.includes('idx_seo_attribution_unique_purchase_tx'));
  assert.ok(sql.includes('SET search_path = pg_catalog, public, pg_temp'));
  // Ensure no destructive DROP TABLE / TRUNCATE statements exist
  assert.equal(/DROP\s+TABLE|TRUNCATE\s+/i.test(sql), false);
});

test('8. Phase 1 GA4 analytics: view_item dedupe, reorder/qty add_to_cart, direct checkout dedupe, coupon purchase without PII, and generate_lead numeric value', () => {
  const storageMap = new Map<string, string>();
  const dataLayer: Array<Record<string, unknown>> = [];
  const prevWindow = (globalThis as any).window;
  const prevDocument = (globalThis as any).document;
  const prevFetch = globalThis.fetch;

  (globalThis as any).window = {
    dataLayer,
    location: { origin: 'https://teqqnoworld.com', pathname: '/product/plain-polo', search: '', hostname: 'teqqnoworld.com' },
    sessionStorage: {
      getItem: (k: string) => (storageMap.has(k) ? storageMap.get(k)! : null),
      setItem: (k: string, v: string) => storageMap.set(k, String(v)),
      removeItem: (k: string) => storageMap.delete(k),
    },
  };
  (globalThis as any).document = { referrer: '' };
  globalThis.fetch = (async () => ({ ok: true, status: 200 })) as any;

  try {
    __resetAnalyticsTrackerForTests();

    // 1. view_item: suppresses duplicate pushes for same product view, re-arms on switch or leaving product page
    const v1 = trackViewItem({
      productId: 'prod-plain-polo',
      productName: 'Classic Matty Plain Polo T-Shirt',
      categorySlug: 'custom-polo-t-shirts',
      priceInr: 450,
      pagePath: '/product/customized-plain-polo-t-shirt',
    });
    const v2Dup = trackViewItem({
      productId: 'prod-plain-polo',
      productName: 'Classic Matty Plain Polo T-Shirt',
      categorySlug: 'custom-polo-t-shirts',
      priceInr: 450,
      pagePath: '/product/customized-plain-polo-t-shirt',
    });
    assert.equal(v1, true);
    assert.equal(v2Dup, false);

    resetActiveProductView();
    const v3GenuineRevisit = trackViewItem({
      productId: 'prod-plain-polo',
      productName: 'Classic Matty Plain Polo T-Shirt',
      categorySlug: 'custom-polo-t-shirts',
      priceInr: 450,
      pagePath: '/product/customized-plain-polo-t-shirt',
    });
    assert.equal(v3GenuineRevisit, true);

    const viewItemEvents = dataLayer.filter((e) => e.event === 'view_item');
    assert.equal(viewItemEvents.length, 2);

    // 2. add_to_cart: single quantity increase & multi-item reorder
    trackAddToCart({
      productId: 'prod-plain-polo',
      productName: 'Classic Matty Plain Polo T-Shirt',
      categorySlug: 'apparel',
      unitPriceInr: 450,
      quantity: 3,
      totalPriceInr: 1350,
    });
    const reorderOk = trackAddToCartItems({
      valueInr: 3198,
      items: [
        { item_id: 'prod-plain-polo', item_name: 'Plain Polo', item_category: 'apparel', price: 450, quantity: 4 },
        { item_id: 'prod-ceramic-mug', item_name: 'Ceramic Mug', item_category: 'drinkware', price: 149, quantity: 10 },
      ],
    });
    assert.equal(reorderOk, true);
    const addEvents = dataLayer.filter((e) => e.event === 'add_to_cart');
    assert.equal(addEvents.length, 2);
    assert.equal((addEvents[1].ecommerce as any).items.length, 2);
    assert.equal((addEvents[1].ecommerce as any).currency, 'INR');

    // 3. begin_checkout: rejects empty cart, emits once for direct /checkout or CartDrawer, suppresses duplicate reload, re-arms after cart change or purchase
    assert.equal(trackBeginCheckout({ valueInr: 0, items: [] }), false);
    const checkoutItems = [
      { item_id: 'prod-plain-polo', item_name: 'Plain Polo', item_category: 'apparel', price: 450, quantity: 10 },
    ];
    assert.equal(trackBeginCheckout({ valueInr: 4500, items: checkoutItems }), true);
    assert.equal(trackBeginCheckout({ valueInr: 4500, items: checkoutItems }), false);
    // Changing cart quantity creates a new checkout signature
    assert.equal(
      trackBeginCheckout({
        valueInr: 5400,
        items: [{ ...checkoutItems[0], quantity: 12 }],
      }),
      true
    );

    // 4. purchase: carries applied coupon, deduplicates by transaction_id, never includes PII, and re-arms checkout tracking
    const p1 = trackPurchaseOnce({
      transactionId: 'TQ-COUPON99',
      valueInr: 4779,
      taxInr: 729,
      shippingInr: 0,
      couponCode: 'save10',
      items: checkoutItems,
    });
    const p2Dup = trackPurchaseOnce({
      transactionId: 'TQ-COUPON99',
      valueInr: 4779,
      taxInr: 729,
      shippingInr: 0,
      couponCode: 'save10',
      items: checkoutItems,
    });
    assert.equal(p1, true);
    assert.equal(p2Dup, false);

    const purchaseEvents = dataLayer.filter((e) => e.event === 'purchase');
    assert.equal(purchaseEvents.length, 1);
    const purchaseEcom = purchaseEvents[0].ecommerce as Record<string, unknown>;
    assert.equal(purchaseEcom.transaction_id, 'TQ-COUPON99');
    assert.equal(purchaseEcom.currency, 'INR');
    assert.equal(purchaseEcom.value, 4779);
    assert.equal(purchaseEcom.coupon, 'SAVE10');

    // After purchase completes, a new checkout with identical items is allowed again
    assert.equal(trackBeginCheckout({ valueInr: 4500, items: checkoutItems }), true);

    // 5. generate_lead: pairs currency:'INR' with real calculated business value; omits currency if no valid value
    const realQuotePrice = calculateProductPrice('prod-plain-polo', 50).totalPrice;
    assert.ok(realQuotePrice > 0);
    trackQuoteRequest({
      leadId: 'lead-1001',
      formName: 'request_quote_modal',
      productId: 'prod-plain-polo',
      productName: 'Classic Matty Plain Polo T-Shirt',
      quantity: 50,
      valueInr: realQuotePrice,
    });
    trackQuoteRequest({
      leadId: 'lead-1002',
      formName: 'generic_lead_no_price',
      quantity: 10,
    });

    const leadEvents = dataLayer.filter((e) => e.event === 'generate_lead');
    assert.equal(leadEvents.length, 2);
    assert.equal(leadEvents[0].currency, 'INR');
    assert.equal(leadEvents[0].value, realQuotePrice);
    assert.equal('currency' in leadEvents[1], false);
    assert.equal('value' in leadEvents[1], false);

    // 6. Strict zero-PII verification across every dataLayer push
    const serialized = JSON.stringify(dataLayer).toLowerCase();
    for (const forbidden of ['email', 'phone', 'mobile', 'gstin', 'street', 'pincode', 'customer_name']) {
      assert.equal(serialized.includes(`"${forbidden}"`), false, `PII key "${forbidden}" must never appear in dataLayer`);
    }

    // 7. Source-level invariants: purchase only fires after backend order confirmation & view_item is decoupled from reviewSummaries SEO effect
    const checkoutSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/CheckoutView.tsx'), 'utf8');
    const confirmIdx = checkoutSrc.indexOf('if (!placeRes.success || !placeRes.primaryOrderId)');
    const onOrderPlacedIdx = checkoutSrc.indexOf('onOrderPlaced(newOrder);');
    assert.ok(confirmIdx > 0 && onOrderPlacedIdx > confirmIdx, 'onOrderPlaced must only run after backend order confirmation');
    assert.ok(checkoutSrc.includes('couponCode: resolvedCouponCode || undefined'), 'CheckoutView must attach resolvedCouponCode to confirmed order');

    const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf8');
    assert.ok(appSrc.includes('couponCode: newOrder.couponCode'), 'App.tsx must forward newOrder.couponCode into trackPurchaseOnce');
    assert.ok(appSrc.includes('}, [currentTab, selectedProduct?.id]);'), 'view_item effect must be isolated from reviewSummaries');
    assert.ok(appSrc.includes('trackAddToCartItems({'), 'handleReorder must emit add_to_cart');
    assert.ok(appSrc.includes("if (currentTab !== 'checkout' || cartItems.length === 0) return;"), 'Direct /checkout visits with valid items must trigger deduplicated begin_checkout');
  } finally {
    __resetAnalyticsTrackerForTests();
    (globalThis as any).window = prevWindow;
    (globalThis as any).document = prevDocument;
    globalThis.fetch = prevFetch;
  }
});
