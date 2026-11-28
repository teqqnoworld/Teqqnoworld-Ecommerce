// ==============================================================================
// TEQQNOWORLD PHASE 5 — SEO ANALYTICS & MONITORING EXPRESS ROUTER
//
// Security Guarantees:
// - All /api/admin/seo-analytics/* routes enforce existing server-side
//   verifyAdminRequest (signed admin session Bearer token; HTTP 401 otherwise).
// - Zero Google API credentials or service account private keys ever returned.
// - Public POST /api/analytics/event strictly accepts non-PII attribution fields,
//   rejects email/phone/name/address keys, deduplicates purchases by transactionId,
//   and enforces per-IP rate limiting.
// ==============================================================================

import { Router, type Request, type Response } from 'express';
import {
  SeoAnalyticsStore,
  buildSeoAnalyticsDashboard,
  buildVerifiedSeoReport,
  fetchGa4ReportFromApi,
  fetchGscSearchAnalyticsFromApi,
  getGoogleApiEnvStatus,
  inspectSingleUrlViaGscApi,
  isValidIsoDate,
  normalizeChannelName,
  parseGa4CsvExport,
  parseGscCsvExport,
  parseGscUrlInspectionCsv,
  resolveDateRange,
  runLiveTechnicalSeoAudit,
  serializeSeoReportToCsv,
  type SeoStorageDeps,
} from './seoAnalyticsEngine.ts';
import type {
  AnalyticsEventName,
  GscSnapshotRecord,
  RecommendationStatus,
} from '../src/types/seoAnalytics.ts';

import type { BlogStore } from './blogEngine.ts';

export interface SeoAnalyticsRouterDeps extends SeoStorageDeps {
  verifyAdminRequest: (req: Request) => { valid: boolean; email?: string };
  localStoreOverridePath?: string;
  blogStore?: BlogStore;
}

const ALLOWED_EVENTS = new Set<AnalyticsEventName>([
  'page_view',
  'view_item',
  'view_item_list',
  'select_item',
  'add_to_cart',
  'begin_checkout',
  'purchase',
  'generate_lead',
  'form_submit',
  'whatsapp_enquiry',
  'quote_request',
  'blog_view',
  'blog_category_view',
  'blog_search',
  'related_product_click',
  'blog_cta_click',
  'blog_share',
]);

const ALLOWED_REC_STATUSES = new Set<RecommendationStatus>([
  'pending',
  'in_progress',
  'completed',
  'ignored',
]);

const ALLOWED_GSC_DIMENSIONS = new Set<GscSnapshotRecord['dimension']>([
  'query',
  'page',
  'country',
  'device',
  'search_appearance',
  'date',
]);

const MAX_CSV_CHARS = 2 * 1024 * 1024; // 2 MB CSV safety limit

export function createSeoAnalyticsRouter(deps: SeoAnalyticsRouterDeps) {
  const router = Router();
  const store = new SeoAnalyticsStore(deps, deps.localStoreOverridePath);

  // Simple per-IP sliding window rate limiter for public /api/analytics/event
  const eventRateMap = new Map<string, { count: number; resetAt: number }>();
  const checkEventRateLimit = (ip: string): boolean => {
    const now = Date.now();
    const entry = eventRateMap.get(ip);
    if (!entry || entry.resetAt <= now) {
      eventRateMap.set(ip, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (entry.count >= 120) return false;
    entry.count += 1;
    return true;
  };

  const requireAdmin = (req: Request, res: Response): string | null => {
    const auth = deps.verifyAdminRequest(req);
    if (!auth.valid) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized. Valid Admin session authentication is required.',
      });
      return null;
    }
    return auth.email || 'admin';
  };

  // ============================================================================
  // 1. PUBLIC NON-PII FIRST-PARTY ATTRIBUTION EVENT RECORDER
  // ============================================================================
  router.post('/analytics/event', async (req: Request, res: Response) => {
    try {
      const clientIp = String(req.ip || req.socket?.remoteAddress || 'unknown');
      if (!checkEventRateLimit(clientIp)) {
        res.status(429).json({ success: false, error: 'Rate limit exceeded.' });
        return;
      }

      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const eventName = String(body.eventName || '').trim() as AnalyticsEventName;
      if (!ALLOWED_EVENTS.has(eventName)) {
        res.status(400).json({ success: false, error: 'Unsupported analytics eventName.' });
        return;
      }

      const sessionId = String(body.sessionId || '').trim().slice(0, 80);
      if (!sessionId || sessionId.length < 6) {
        res.status(400).json({ success: false, error: 'Valid sessionId is required.' });
        return;
      }

      const landingPath = String(body.landingPath || '/').trim().slice(0, 300);
      const pagePath = String(body.pagePath || landingPath).trim().slice(0, 300);
      const channel = normalizeChannelName(String(body.channel || 'direct'));
      const valueInr =
        body.valueInr !== undefined && body.valueInr !== null
          ? Number(body.valueInr)
          : undefined;
      const quantity =
        body.quantity !== undefined && body.quantity !== null
          ? Math.max(0, Math.round(Number(body.quantity)))
          : undefined;

      if (valueInr !== undefined && (!Number.isFinite(valueInr) || valueInr < 0 || valueInr > 50_000_000)) {
        res.status(400).json({ success: false, error: 'Invalid numeric valueInr.' });
        return;
      }

      const result = await store.recordAttributionEvent({
        eventName,
        eventKey:
          typeof body.eventKey === 'string' && body.eventKey.trim()
            ? body.eventKey.trim().slice(0, 120)
            : undefined,
        transactionId:
          typeof body.transactionId === 'string' && body.transactionId.trim()
            ? body.transactionId.trim().slice(0, 100)
            : undefined,
        sessionId,
        channel,
        landingPath,
        pagePath,
        productId:
          typeof body.productId === 'string' && body.productId.trim()
            ? body.productId.trim().slice(0, 80)
            : undefined,
        productName:
          typeof body.productName === 'string' && body.productName.trim()
            ? body.productName.trim().slice(0, 180)
            : undefined,
        categorySlug:
          typeof body.categorySlug === 'string' && body.categorySlug.trim()
            ? body.categorySlug.trim().slice(0, 100)
            : undefined,
        valueInr,
        quantity,
        sourceHost:
          typeof body.sourceHost === 'string' && body.sourceHost.trim()
            ? body.sourceHost.trim().slice(0, 120)
            : undefined,
      });

      res.status(200).json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Unable to record analytics event.',
      });
    }
  });

  // ============================================================================
  // 2. ADMIN: FULL SEO ANALYTICS & MONITORING OVERVIEW
  // ============================================================================
  router.get('/admin/seo-analytics/overview', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const preset = typeof req.query.preset === 'string' ? req.query.preset : '28d';
      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

      const data = await buildSeoAnalyticsDashboard({
        store,
        deps,
        blogStore: deps.blogStore,
        preset,
        startDate,
        endDate,
      });
      res.status(200).json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to build SEO analytics dashboard.',
      });
    }
  });

  // ============================================================================
  // 3. ADMIN: LIVE TECHNICAL SEO AUDIT ENDPOINT
  // ============================================================================
  router.get('/admin/seo-analytics/technical-audit', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const loaded = await store.loadAllData();
      const audit = await runLiveTechnicalSeoAudit(deps, loaded.urlInspections);
      res.status(200).json({ success: true, audit });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to run technical SEO audit.',
      });
    }
  });

  // ============================================================================
  // 4. ADMIN: IMPORT GOOGLE SEARCH CONSOLE CSV (SEARCH PERFORMANCE OR INDEXING)
  // ============================================================================
  router.post('/admin/seo-analytics/import/gsc', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;

    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const csvText = typeof body.csvText === 'string' ? body.csvText : '';
      const mode = String(body.mode || 'performance').trim();
      if (!csvText.trim()) {
        res.status(400).json({ success: false, error: 'CSV content is required.' });
        return;
      }
      if (csvText.length > MAX_CSV_CHARS) {
        res.status(413).json({ success: false, error: 'CSV file exceeds 2 MB safety limit.' });
        return;
      }

      if (mode === 'indexing') {
        const records = parseGscUrlInspectionCsv(csvText);
        const saved = await store.saveUrlInspections(records);
        res.status(200).json({
          success: true,
          mode: 'indexing',
          importedCount: records.length,
          indexedCount: records.filter((r) => r.status === 'indexed').length,
          notIndexedCount: records.filter((r) => r.status === 'not_indexed').length,
          storage: saved.storage,
        });
        return;
      }

      const startDate = String(body.startDate || '').trim();
      const endDate = String(body.endDate || '').trim();
      if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate) || endDate < startDate) {
        res.status(400).json({
          success: false,
          error: 'Valid startDate and endDate (YYYY-MM-DD, endDate >= startDate) are required for GSC import.',
        });
        return;
      }

      const rawDim = typeof body.dimension === 'string' ? body.dimension.trim() : '';
      const explicitDim = ALLOWED_GSC_DIMENSIONS.has(rawDim as GscSnapshotRecord['dimension'])
        ? (rawDim as GscSnapshotRecord['dimension'])
        : undefined;

      const parsed = parseGscCsvExport({ csvText, dimension: explicitDim });
      const propertyUrl = getGoogleApiEnvStatus().gscSiteUrl || 'https://teqqnoworld.com/';
      const snapshot: GscSnapshotRecord = {
        id: `gsc:${propertyUrl}:${parsed.dimension}:${startDate}:${endDate}`,
        propertyUrl,
        dateStart: startDate,
        dateEnd: endDate,
        dimension: parsed.dimension,
        source: 'GSC CSV Import',
        importedAt: new Date().toISOString(),
        importedBy: actor,
        rows: parsed.rows,
      };
      const saved = await store.saveGscSnapshot(snapshot);

      res.status(200).json({
        success: true,
        dimension: parsed.dimension,
        rowCount: parsed.rows.length,
        dateStart: startDate,
        dateEnd: endDate,
        warnings: parsed.warnings,
        storage: saved.storage,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Failed to parse Google Search Console CSV.',
      });
    }
  });

  // ============================================================================
  // 5. ADMIN: IMPORT GA4 CSV EXPORT (LANDING PAGES / TRAFFIC ACQUISITION)
  // ============================================================================
  router.post('/admin/seo-analytics/import/ga4', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;

    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const csvText = typeof body.csvText === 'string' ? body.csvText : '';
      const startDate = String(body.startDate || '').trim();
      const endDate = String(body.endDate || '').trim();

      if (!csvText.trim()) {
        res.status(400).json({ success: false, error: 'GA4 CSV content is required.' });
        return;
      }
      if (csvText.length > MAX_CSV_CHARS) {
        res.status(413).json({ success: false, error: 'CSV file exceeds 2 MB safety limit.' });
        return;
      }
      if (!isValidIsoDate(startDate) || !isValidIsoDate(endDate) || endDate < startDate) {
        res.status(400).json({
          success: false,
          error: 'Valid startDate and endDate (YYYY-MM-DD) are required for GA4 import.',
        });
        return;
      }

      const parsed = parseGa4CsvExport(csvText);
      const propertyId = getGoogleApiEnvStatus().ga4PropertyId || 'ga4-csv-import';
      const saved = await store.saveGa4Snapshot({
        id: `ga4:${propertyId}:${startDate}:${endDate}`,
        propertyId,
        dateStart: startDate,
        dateEnd: endDate,
        source: 'GA4 CSV Import',
        importedAt: new Date().toISOString(),
        importedBy: actor,
        rows: parsed.rows,
      });

      res.status(200).json({
        success: true,
        rowCount: parsed.rows.length,
        dateStart: startDate,
        dateEnd: endDate,
        warnings: parsed.warnings,
        storage: saved.storage,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Failed to parse GA4 CSV export.',
      });
    }
  });

  // ============================================================================
  // 6. ADMIN: SYNC GOOGLE SEARCH CONSOLE API (ONLY WHEN SERVER CREDENTIALS SET)
  // ============================================================================
  router.post('/admin/seo-analytics/sync/gsc', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;

    const env = getGoogleApiEnvStatus();
    if (!env.gscApiConnected) {
      res.status(503).json({
        success: false,
        code: 'GSC_API_NOT_CONFIGURED',
        error:
          'Google Search Console API is not configured on this server. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GSC_SITE_URL in server environment variables, or use the GSC CSV Import workflow.',
      });
      return;
    }

    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const range = resolveDateRange({
        preset: typeof body.preset === 'string' ? body.preset : '28d',
        startDate: typeof body.startDate === 'string' ? body.startDate : undefined,
        endDate: typeof body.endDate === 'string' ? body.endDate : undefined,
      });

      const dimensions: GscSnapshotRecord['dimension'][] = [
        'query',
        'page',
        'country',
        'device',
        'search_appearance',
        'date',
      ];
      const syncedCounts: Record<string, number> = {};

      for (const dim of dimensions) {
        const snap = await fetchGscSearchAnalyticsFromApi({
          startDate: range.startDate,
          endDate: range.endDate,
          dimension: dim,
          actor,
        });
        await store.saveGscSnapshot(snap);
        syncedCounts[dim] = snap.rows.length;
      }

      res.status(200).json({
        success: true,
        dateStart: range.startDate,
        dateEnd: range.endDate,
        syncedCounts,
      });
    } catch (err: any) {
      res.status(502).json({
        success: false,
        error: err?.message || 'Google Search Console API sync failed.',
      });
    }
  });

  // ============================================================================
  // 7. ADMIN: SYNC GA4 DATA API (ONLY WHEN SERVER CREDENTIALS SET)
  // ============================================================================
  router.post('/admin/seo-analytics/sync/ga4', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;

    const env = getGoogleApiEnvStatus();
    if (!env.ga4DataApiConnected) {
      res.status(503).json({
        success: false,
        code: 'GA4_API_NOT_CONFIGURED',
        error:
          'GA4 Data API is not configured on this server. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GA4_PROPERTY_ID in server environment variables, or use the GA4 CSV Import workflow.',
      });
      return;
    }

    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const range = resolveDateRange({
        preset: typeof body.preset === 'string' ? body.preset : '28d',
        startDate: typeof body.startDate === 'string' ? body.startDate : undefined,
        endDate: typeof body.endDate === 'string' ? body.endDate : undefined,
      });

      const snap = await fetchGa4ReportFromApi({
        startDate: range.startDate,
        endDate: range.endDate,
        actor,
      });
      await store.saveGa4Snapshot(snap);

      res.status(200).json({
        success: true,
        dateStart: range.startDate,
        dateEnd: range.endDate,
        rowCount: snap.rows.length,
      });
    } catch (err: any) {
      res.status(502).json({
        success: false,
        error: err?.message || 'GA4 Data API sync failed.',
      });
    }
  });

  // ============================================================================
  // 8. ADMIN: ON-DEMAND SINGLE-URL GSC INSPECTION (NO BULK AUTO-SPAM)
  // ============================================================================
  router.post('/admin/seo-analytics/inspect-url', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;

    const env = getGoogleApiEnvStatus();
    if (!env.gscApiConnected) {
      res.status(503).json({
        success: false,
        code: 'GSC_API_NOT_CONFIGURED',
        error:
          'Google Search Console URL Inspection API is not connected on this server. Import a GSC Page Indexing CSV or configure server-side Google Service Account credentials.',
      });
      return;
    }

    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const url = typeof body.url === 'string' ? body.url.trim() : '';
      if (!url) {
        res.status(400).json({ success: false, error: 'Target URL is required.' });
        return;
      }
      const record = await inspectSingleUrlViaGscApi(url);
      await store.saveUrlInspections([record]);
      res.status(200).json({ success: true, inspection: record });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'URL inspection failed.',
      });
    }
  });

  // ============================================================================
  // 9. ADMIN: UPDATE RECOMMENDATION WORKFLOW STATUS (NO AUTO CONTENT EDITS)
  // ============================================================================
  router.patch('/admin/seo-analytics/recommendations/:id', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;

    try {
      const id = decodeURIComponent(String(req.params.id || '')).trim().slice(0, 140);
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        unknown
      >;
      const status = String(body.status || '').trim() as RecommendationStatus;
      if (!id || !ALLOWED_REC_STATUSES.has(status)) {
        res.status(400).json({
          success: false,
          error: 'Valid recommendation ID and status (pending|in_progress|completed|ignored) required.',
        });
        return;
      }

      await store.updateRecommendationState({
        recommendationId: id,
        status,
        issueTitle: typeof body.issueTitle === 'string' ? body.issueTitle.slice(0, 200) : id,
        affectedUrl: typeof body.affectedUrl === 'string' ? body.affectedUrl.slice(0, 200) : '/',
        actor,
      });

      res.status(200).json({ success: true, id, status });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to update recommendation status.',
      });
    }
  });

  // ============================================================================
  // 10. ADMIN: WEEKLY / MONTHLY REPORT GENERATION (JSON OR FORMULA-SAFE CSV)
  // ============================================================================
  router.get('/admin/seo-analytics/reports', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;

    try {
      const reportType = req.query.type === 'monthly' ? 'monthly' : 'weekly';
      const format = req.query.format === 'csv' ? 'csv' : 'json';
      const defaultPreset = reportType === 'weekly' ? '7d' : '28d';
      const preset = typeof req.query.preset === 'string' ? req.query.preset : defaultPreset;
      const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

      const dashboard = await buildSeoAnalyticsDashboard({
        store,
        deps,
        blogStore: deps.blogStore,
        preset,
        startDate,
        endDate,
      });
      const report = buildVerifiedSeoReport(dashboard, reportType);

      if (format === 'csv') {
        const csv = serializeSeoReportToCsv(report);
        const filename = `teqqnoworld-seo-${reportType}-report-${report.dateRange.startDate}-to-${report.dateRange.endDate}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.status(200).send(csv);
        return;
      }

      res.status(200).json({ success: true, report });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to generate SEO report.',
      });
    }
  });

  return { router, store };
}
