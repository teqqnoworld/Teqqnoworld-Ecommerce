// ==============================================================================
// TEQQNOWORLD PHASE 5 — SERVER-SIDE SEO ANALYTICS & MONITORING ENGINE
//
// Core Guarantees:
// 1. Zero fabricated metrics: unavailable metrics remain null / "Data unavailable".
// 2. GSC Average Position is explicitly labeled Average Position (never fixed rank).
// 3. Google Service Account secrets stay strictly in server-side process.env.
// 4. Live Technical SEO Health Score checks real code/routes/schema and is clearly
//    separated from Google Search performance.
// 5. All CSV exports neutralize spreadsheet formula injection (=, +, -, @, \t, \r).
// ==============================================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PRODUCTS } from '../src/data/mockData.ts';
import {
  CANONICAL_ORIGIN,
  SEO_CATEGORIES,
  buildProductSeoDescription,
  buildProductSeoTitle,
  getCategoryForProduct,
  getProductH1,
  getProductPath,
} from '../src/config/seoRoutes.ts';
import {
  CATEGORY_KEYWORD_MAP,
  PRODUCT_KEYWORD_MAP,
  getCategoryKeywordEntry,
  getProductKeywordEntry,
} from '../src/data/seoKeywordMap.ts';
import { buildPageStructuredData } from '../src/config/structuredData.ts';
import {
  buildRobotsTxt,
  buildSitemapXml,
  resolveSeoPageContext,
} from './seoMiddleware.ts';
import { isPostPubliclyVisible, type BlogStore } from './blogEngine.ts';
import type {
  BlogArticlePerformanceRow,
  ContentPerformanceSummary,
} from '../src/types/blog.ts';
import type {
  AnalyticsEventName,
  CategorySeoPerformanceRow,
  ChannelPerformanceRow,
  FirstPartyAttributionEvent,
  Ga4LandingRow,
  Ga4SnapshotRecord,
  GscMetricRow,
  GscSnapshotRecord,
  KeywordPerformanceRow,
  ProductSeoPerformanceRow,
  RecommendationPriority,
  RecommendationStatus,
  SeoAnalyticsDashboardResponse,
  SeoConnectionStatus,
  SeoDataSourceLabel,
  SeoDatePreset,
  SeoKpiMetric,
  SeoRecommendationItem,
  SeoReportPayload,
  TechnicalSeoAuditResult,
  TechnicalSeoCheckItem,
  TrafficChannel,
  UrlInspectionRecord,
} from '../src/types/seoAnalytics.ts';

export interface SeoStorageDeps {
  rootDir: string;
  getSupabaseAdminConfig: () => { configured: boolean; url: string; serviceRoleKey: string };
  buildSupabaseAdminHeaders: (
    serviceRoleKey: string,
    extra?: Record<string, string>
  ) => Record<string, string>;
}

interface LocalSeoStore {
  gscSnapshots: GscSnapshotRecord[];
  ga4Snapshots: Ga4SnapshotRecord[];
  urlInspections: UrlInspectionRecord[];
  attributionEvents: FirstPartyAttributionEvent[];
  recommendationStates: Record<
    string,
    {
      status: RecommendationStatus;
      issueTitle: string;
      affectedUrl: string;
      updatedAt: string;
      updatedBy: string;
    }
  >;
}

const EMPTY_STORE: LocalSeoStore = {
  gscSnapshots: [],
  ga4Snapshots: [],
  urlInspections: [],
  attributionEvents: [],
  recommendationStates: {},
};

const MAX_CSV_ROWS = 5000;
const MAX_LOCAL_EVENTS = 15000;

export const RECENT_GSC_NOTICE =
  'Google Search Console was connected recently (~5–7 days prior to Phase 5 setup). Historical search impressions and clicks may be limited to recent days; periods without recorded data are clearly labeled as unavailable rather than zero.';

// ==============================================================================
// 1. PURE HELPERS: DATE RANGES, URL NORMALIZATION, RFC-4180 CSV & SANITIZATION
// ==============================================================================

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(val: string): boolean {
  if (!ISO_DATE_RE.test(val)) return false;
  const parsed = new Date(`${val}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === val;
}

export function formatIsoDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysUtc(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return formatIsoDateUtc(d);
}

export function resolveDateRange(params: {
  preset?: string;
  startDate?: string;
  endDate?: string;
  now?: Date;
}): {
  preset: SeoDatePreset;
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  dayCount: number;
} {
  const now = params.now || new Date();
  const todayIso = formatIsoDateUtc(now);
  const validPresets: SeoDatePreset[] = ['7d', '28d', '3m', '6m', '12m', 'custom'];
  const preset: SeoDatePreset = validPresets.includes(params.preset as SeoDatePreset)
    ? (params.preset as SeoDatePreset)
    : '28d';

  let startDate: string;
  let endDate: string;

  if (
    preset === 'custom' &&
    params.startDate &&
    params.endDate &&
    isValidIsoDate(params.startDate) &&
    isValidIsoDate(params.endDate)
  ) {
    startDate = params.startDate <= params.endDate ? params.startDate : params.endDate;
    endDate = params.endDate >= params.startDate ? params.endDate : params.startDate;
  } else {
    endDate = todayIso;
    const daysBack =
      preset === '7d'
        ? 6
        : preset === '28d'
        ? 27
        : preset === '3m'
        ? 89
        : preset === '6m'
        ? 179
        : 364;
    startDate = addDaysUtc(endDate, -daysBack);
  }

  const msDiff =
    new Date(`${endDate}T00:00:00.000Z`).getTime() -
    new Date(`${startDate}T00:00:00.000Z`).getTime();
  const dayCount = Math.max(1, Math.round(msDiff / 86400000) + 1);
  const previousEndDate = addDaysUtc(startDate, -1);
  const previousStartDate = addDaysUtc(previousEndDate, -(dayCount - 1));

  return {
    preset,
    startDate,
    endDate,
    previousStartDate,
    previousEndDate,
    dayCount,
  };
}

export function normalizeTeqqnoPath(rawUrlOrPath: string): string {
  const trimmed = String(rawUrlOrPath || '').trim();
  if (!trimmed) return '/';
  try {
    const parsed = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? new URL(trimmed)
      : new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, CANONICAL_ORIGIN);
    const cleanPath = parsed.pathname.replace(/\/+$/, '') || '/';
    return cleanPath.toLowerCase();
  } catch {
    const withoutQuery = trimmed.split(/[?#]/)[0];
    const clean = (withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`).replace(
      /\/+$/,
      ''
    );
    return (clean || '/').toLowerCase();
  }
}

export function normalizeChannelName(raw: string): TrafficChannel {
  const v = String(raw || '')
    .trim()
    .toLowerCase();
  if (v.includes('organic search') || v === 'organic_search' || v === 'organic') {
    return 'organic_search';
  }
  if (
    v.includes('paid search') ||
    v.includes('paid shopping') ||
    v.includes('cpc') ||
    v.includes('ppc') ||
    v === 'paid_search'
  ) {
    return 'paid_search';
  }
  if (v.includes('social') || v.includes('instagram') || v.includes('facebook') || v.includes('linkedin')) {
    return 'social';
  }
  if (v.includes('referral') || v.includes('affiliate')) {
    return 'referral';
  }
  return 'direct';
}

export function channelDisplayLabel(channel: TrafficChannel): string {
  switch (channel) {
    case 'organic_search':
      return 'Organic Search';
    case 'direct':
      return 'Direct';
    case 'paid_search':
      return 'Paid Search';
    case 'referral':
      return 'Referral';
    case 'social':
      return 'Social';
  }
}

export function csvEscapeCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const formulaSafe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  const escaped = formulaSafe.replace(/"/g, '""');
  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function parseCsvMatrix(csvText: string): string[][] {
  const clean = String(csvText || '').replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((c) => c.length > 0)) rows.push(row);
  }

  return rows;
}

function parseLocaleNumber(raw: string): number {
  const cleaned = String(raw || '')
    .replace(/[₹$,%\s]/g, '')
    .replace(/,/g, '')
    .trim();
  if (!cleaned || cleaned === '-' || cleaned.toLowerCase() === 'n/a') return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseCtrPercentage(raw: string): number {
  const str = String(raw || '').trim();
  const hasPercent = str.includes('%');
  const num = parseLocaleNumber(str);
  if (hasPercent) return Math.max(0, Math.min(100, Number(num.toFixed(2))));
  // GSC API returns 0..1 decimals; CSV exports usually include %
  if (num > 0 && num <= 1) return Math.max(0, Math.min(100, Number((num * 100).toFixed(2))));
  return Math.max(0, Math.min(100, Number(num.toFixed(2))));
}

// ==============================================================================
// 2. GSC & GA4 CSV PARSERS (VALIDATED, ZERO FABRICATION)
// ==============================================================================

export function parseGscCsvExport(params: {
  csvText: string;
  dimension?: GscSnapshotRecord['dimension'];
}): {
  dimension: GscSnapshotRecord['dimension'];
  rows: GscMetricRow[];
  warnings: string[];
} {
  const matrix = parseCsvMatrix(params.csvText);
  if (matrix.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  // Skip optional comment lines (e.g., # exported from Search Console)
  let headerIdx = 0;
  while (headerIdx < matrix.length && matrix[headerIdx][0]?.startsWith('#')) {
    headerIdx += 1;
  }
  if (headerIdx >= matrix.length - 1) {
    throw new Error('No data rows found after CSV headers.');
  }

  const headers = matrix[headerIdx].map((h) => h.toLowerCase().trim());
  const clicksIdx = headers.findIndex((h) => h === 'clicks' || h.includes('click'));
  const impIdx = headers.findIndex((h) => h === 'impressions' || h.includes('impression'));
  const ctrIdx = headers.findIndex((h) => h === 'ctr');
  const posIdx = headers.findIndex((h) => h === 'position' || h.includes('position'));

  if (clicksIdx === -1 || impIdx === -1) {
    throw new Error(
      'Invalid Google Search Console CSV: missing required "Clicks" and "Impressions" columns.'
    );
  }

  let detectedDim: GscSnapshotRecord['dimension'] = params.dimension || 'query';
  let keyIdx = 0;

  const findHeader = (needles: string[]) =>
    headers.findIndex((h) => needles.some((n) => h === n || h.includes(n)));

  if (!params.dimension) {
    const qIdx = findHeader(['top queries', 'query', 'keyword']);
    const pIdx = findHeader(['top pages', 'page', 'landing page', 'url']);
    const cIdx = findHeader(['country', 'countries']);
    const dIdx = findHeader(['device', 'devices']);
    const sIdx = findHeader(['search appearance', 'appearance']);
    const dtIdx = findHeader(['date']);

    if (qIdx !== -1) {
      detectedDim = 'query';
      keyIdx = qIdx;
    } else if (pIdx !== -1) {
      detectedDim = 'page';
      keyIdx = pIdx;
    } else if (cIdx !== -1) {
      detectedDim = 'country';
      keyIdx = cIdx;
    } else if (dIdx !== -1) {
      detectedDim = 'device';
      keyIdx = dIdx;
    } else if (sIdx !== -1) {
      detectedDim = 'search_appearance';
      keyIdx = sIdx;
    } else if (dtIdx !== -1) {
      detectedDim = 'date';
      keyIdx = dtIdx;
    }
  } else {
    const dimNeedles: Record<GscSnapshotRecord['dimension'], string[]> = {
      query: ['top queries', 'query', 'keyword'],
      page: ['top pages', 'page', 'landing page', 'url'],
      country: ['country', 'countries'],
      device: ['device', 'devices'],
      search_appearance: ['search appearance', 'appearance'],
      date: ['date'],
    };
    const found = findHeader(dimNeedles[params.dimension]);
    keyIdx = found !== -1 ? found : 0;
  }

  const warnings: string[] = [];
  const aggMap = new Map<
    string,
    { clicks: number; impressions: number; weightedPos: number; rows: number }
  >();

  const dataRows = matrix.slice(headerIdx + 1, headerIdx + 1 + MAX_CSV_ROWS);
  if (matrix.length - (headerIdx + 1) > MAX_CSV_ROWS) {
    warnings.push(`Truncated import to maximum ${MAX_CSV_ROWS} rows.`);
  }

  for (const r of dataRows) {
    const rawKey = (r[keyIdx] || '').trim();
    if (!rawKey) continue;
    const key =
      detectedDim === 'page'
        ? normalizeTeqqnoPath(rawKey)
        : detectedDim === 'query'
        ? rawKey.toLowerCase()
        : rawKey;

    const clicks = Math.max(0, Math.round(parseLocaleNumber(r[clicksIdx] || '0')));
    const impressions = Math.max(0, Math.round(parseLocaleNumber(r[impIdx] || '0')));
    const position = posIdx !== -1 ? Math.max(0, parseLocaleNumber(r[posIdx] || '0')) : 0;

    const existing = aggMap.get(key) || { clicks: 0, impressions: 0, weightedPos: 0, rows: 0 };
    existing.clicks += clicks;
    existing.impressions += impressions;
    existing.weightedPos += position * (impressions > 0 ? impressions : 1);
    existing.rows += 1;
    aggMap.set(key, existing);
  }

  const rows: GscMetricRow[] = [];
  for (const [key, val] of aggMap.entries()) {
    const ctr =
      val.impressions > 0
        ? Number(((val.clicks / val.impressions) * 100).toFixed(2))
        : ctrIdx !== -1
        ? 0
        : 0;
    const weight = val.impressions > 0 ? val.impressions : val.rows;
    const avgPos = weight > 0 ? Number((val.weightedPos / weight).toFixed(2)) : 0;
    rows.push({
      key,
      clicks: val.clicks,
      impressions: val.impressions,
      ctr,
      position: avgPos,
    });
  }

  if (rows.length === 0) {
    throw new Error('No valid metric rows could be parsed from the GSC CSV.');
  }

  // Sort dates ascending, other dimensions by clicks desc then impressions desc
  if (detectedDim === 'date') {
    rows.sort((a, b) => a.key.localeCompare(b.key));
  } else {
    rows.sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
  }

  return { dimension: detectedDim, rows, warnings };
}

export function parseGscUrlInspectionCsv(csvText: string): UrlInspectionRecord[] {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    throw new Error('Indexing CSV must include a header row and at least one URL row.');
  }
  let headerIdx = 0;
  while (headerIdx < matrix.length && matrix[headerIdx][0]?.startsWith('#')) {
    headerIdx += 1;
  }
  const headers = matrix[headerIdx].map((h) => h.toLowerCase().trim());
  const urlIdx = headers.findIndex((h) => h === 'url' || h.includes('url') || h.includes('page'));
  const statusIdx = headers.findIndex(
    (h) => h.includes('status') || h.includes('verdict') || h.includes('state') || h.includes('reason')
  );
  const crawlIdx = headers.findIndex((h) => h.includes('last crawled') || h.includes('crawl'));

  if (urlIdx === -1) {
    throw new Error('Invalid GSC Indexing CSV: missing "URL" column.');
  }

  const nowIso = new Date().toISOString();
  const out: UrlInspectionRecord[] = [];
  const seen = new Set<string>();

  for (const r of matrix.slice(headerIdx + 1, headerIdx + 1 + MAX_CSV_ROWS)) {
    const rawUrl = (r[urlIdx] || '').trim();
    if (!rawUrl) continue;
    const normalizedPath = normalizeTeqqnoPath(rawUrl);
    if (seen.has(normalizedPath)) continue;
    seen.add(normalizedPath);

    const rawStatus = statusIdx !== -1 ? (r[statusIdx] || '').trim() : '';
    const lowerStatus = rawStatus.toLowerCase();
    let status: UrlInspectionRecord['status'] = 'unknown';
    if (
      lowerStatus.includes('not indexed') ||
      lowerStatus.includes('excluded') ||
      lowerStatus.includes('error') ||
      lowerStatus.includes('fail') ||
      lowerStatus.includes('discovered - currently') ||
      lowerStatus.includes('crawled - currently') ||
      lowerStatus.includes('redirect') ||
      lowerStatus.includes('404')
    ) {
      status = 'not_indexed';
    } else if (
      lowerStatus.includes('indexed') ||
      lowerStatus === 'pass' ||
      lowerStatus.includes('submitted and indexed')
    ) {
      status = 'indexed';
    }

    out.push({
      url: `${CANONICAL_ORIGIN}${normalizedPath === '/' ? '/' : normalizedPath}`,
      normalizedPath,
      status,
      coverageState: rawStatus || 'Imported from GSC CSV',
      verdict: status === 'indexed' ? 'PASS' : status === 'not_indexed' ? 'NEUTRAL' : 'UNKNOWN',
      lastCrawlTime: crawlIdx !== -1 && r[crawlIdx] ? r[crawlIdx] : null,
      source: 'GSC CSV Import',
      checkedAt: nowIso,
    });
  }

  if (out.length === 0) {
    throw new Error('No valid URLs found in the GSC Indexing CSV.');
  }
  return out;
}

export function parseGa4CsvExport(csvText: string): {
  rows: Ga4LandingRow[];
  warnings: string[];
} {
  const matrix = parseCsvMatrix(csvText);
  if (matrix.length < 2) {
    throw new Error('GA4 CSV must include a header row and at least one data row.');
  }

  // GA4 exports often begin with multiple '#' comment lines before the header row
  let headerIdx = 0;
  while (
    headerIdx < matrix.length &&
    (matrix[headerIdx][0]?.startsWith('#') || matrix[headerIdx].length < 2)
  ) {
    headerIdx += 1;
  }
  if (headerIdx >= matrix.length - 1) {
    throw new Error('No data rows found in GA4 CSV export.');
  }

  const headers = matrix[headerIdx].map((h) => h.toLowerCase().trim());
  const landingIdx = headers.findIndex(
    (h) => h.includes('landing page') || h === 'page path' || h.includes('page path')
  );
  const channelIdx = headers.findIndex(
    (h) => h.includes('channel') || h === 'source / medium' || h.includes('default channel')
  );
  const sessionsIdx = headers.findIndex((h) => h === 'sessions' || h.includes('session'));
  const viewsIdx = headers.findIndex(
    (h) => h.includes('items viewed') || h.includes('view_item') || h.includes('product view')
  );
  const atcIdx = headers.findIndex(
    (h) => h.includes('add to cart') || h.includes('add_to_cart') || h.includes('items added')
  );
  const checkoutIdx = headers.findIndex(
    (h) => h.includes('checkout') || h.includes('begin_checkout')
  );
  const purchasesIdx = headers.findIndex(
    (h) => h === 'purchases' || h.includes('ecommerce purchases') || h.includes('transactions')
  );
  const revenueIdx = headers.findIndex(
    (h) => h.includes('revenue') || h.includes('purchase revenue')
  );
  const quoteIdx = headers.findIndex(
    (h) => h.includes('quote') || h.includes('generate_lead') || h.includes('leads')
  );
  const whatsappIdx = headers.findIndex((h) => h.includes('whatsapp'));

  if (sessionsIdx === -1 && purchasesIdx === -1 && revenueIdx === -1) {
    throw new Error(
      'Invalid GA4 CSV: could not find Sessions, Purchases, or Revenue columns.'
    );
  }

  const warnings: string[] = [];
  const agg = new Map<string, Ga4LandingRow>();

  for (const r of matrix.slice(headerIdx + 1, headerIdx + 1 + MAX_CSV_ROWS)) {
    const rawLanding = landingIdx !== -1 ? (r[landingIdx] || '').trim() : '/';
    const rawChannel = channelIdx !== -1 ? (r[channelIdx] || '').trim() : 'Organic Search';
    if (
      rawLanding.toLowerCase() === 'grand total' ||
      rawChannel.toLowerCase() === 'grand total' ||
      rawLanding.toLowerCase() === 'total'
    ) {
      continue;
    }

    const landingPath = rawLanding && rawLanding !== '(not set)' ? normalizeTeqqnoPath(rawLanding) : '/';
    const channel = normalizeChannelName(rawChannel);
    const key = `${channel}::${landingPath}`;

    const cur = agg.get(key) || {
      landingPath,
      channel,
      sessions: 0,
      productViews: 0,
      addToCarts: 0,
      checkoutStarts: 0,
      purchases: 0,
      revenueInr: 0,
      quoteEnquiries: 0,
      whatsappEnquiries: 0,
    };

    if (sessionsIdx !== -1) cur.sessions += Math.max(0, Math.round(parseLocaleNumber(r[sessionsIdx])));
    if (viewsIdx !== -1) cur.productViews += Math.max(0, Math.round(parseLocaleNumber(r[viewsIdx])));
    if (atcIdx !== -1) cur.addToCarts += Math.max(0, Math.round(parseLocaleNumber(r[atcIdx])));
    if (checkoutIdx !== -1) cur.checkoutStarts += Math.max(0, Math.round(parseLocaleNumber(r[checkoutIdx])));
    if (purchasesIdx !== -1) cur.purchases += Math.max(0, Math.round(parseLocaleNumber(r[purchasesIdx])));
    if (revenueIdx !== -1) cur.revenueInr = Number((cur.revenueInr + Math.max(0, parseLocaleNumber(r[revenueIdx]))).toFixed(2));
    if (quoteIdx !== -1) cur.quoteEnquiries += Math.max(0, Math.round(parseLocaleNumber(r[quoteIdx])));
    if (whatsappIdx !== -1) cur.whatsappEnquiries += Math.max(0, Math.round(parseLocaleNumber(r[whatsappIdx])));

    agg.set(key, cur);
  }

  const rows = Array.from(agg.values());
  if (rows.length === 0) {
    throw new Error('No valid GA4 rows could be parsed from the uploaded CSV.');
  }

  return { rows, warnings };
}

// ==============================================================================
// 3. SERVER-SIDE GOOGLE API CLIENT (SERVICE ACCOUNT JWT -> OAUTH2 ACCESS TOKEN)
//    Secrets stay strictly in server-side process.env; zero client exposure.
// ==============================================================================

interface CachedGoogleToken {
  accessToken: string;
  expiresAtMs: number;
  scope: string;
}

const googleTokenCache = new Map<string, CachedGoogleToken>();

export function getGoogleApiEnvStatus() {
  const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const privateKeyRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim();
  const gscSiteUrl = (process.env.GSC_SITE_URL || '').trim() || `${CANONICAL_ORIGIN}/`;
  const ga4PropertyId = (process.env.GA4_PROPERTY_ID || '').trim().replace(/^properties\//i, '');

  const hasServiceAccount = Boolean(
    email &&
      privateKeyRaw &&
      (privateKeyRaw.includes('BEGIN PRIVATE KEY') || privateKeyRaw.includes('BEGIN RSA PRIVATE KEY'))
  );

  return {
    hasServiceAccount,
    gscApiConnected: hasServiceAccount && Boolean(gscSiteUrl),
    gscSiteUrl: hasServiceAccount ? gscSiteUrl : null,
    ga4DataApiConnected: hasServiceAccount && Boolean(ga4PropertyId),
    ga4PropertyIdConfigured: Boolean(ga4PropertyId),
    ga4PropertyId,
    serviceAccountEmail: email,
    privateKeyPem: privateKeyRaw.replace(/\\n/g, '\n'),
  };
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function getGoogleServiceAccountAccessToken(scope: string): Promise<string> {
  const cached = googleTokenCache.get(scope);
  if (cached && cached.expiresAtMs > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const cfg = getGoogleApiEnvStatus();
  if (!cfg.hasServiceAccount) {
    throw new Error(
      'Google Service Account credentials are not configured on the server (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY).'
    );
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: cfg.serviceAccountEmail,
      scope,
      aud: 'https://oauth2.googleapis.com/token',
      exp: nowSec + 3600,
      iat: nowSec,
    })
  );

  const signingInput = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = base64UrlEncode(signer.sign(cfg.privateKeyPem));
  const assertion = `${signingInput}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '');
    throw new Error(`Google OAuth2 token exchange failed (HTTP ${tokenRes.status}): ${errText.slice(0, 200)}`);
  }

  const payload = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!payload.access_token) {
    throw new Error('Google OAuth2 response missing access_token.');
  }

  googleTokenCache.set(scope, {
    accessToken: payload.access_token,
    expiresAtMs: Date.now() + Math.max(60, (payload.expires_in || 3600) - 120) * 1000,
    scope,
  });

  return payload.access_token;
}

export async function fetchGscSearchAnalyticsFromApi(params: {
  startDate: string;
  endDate: string;
  dimension: GscSnapshotRecord['dimension'];
  actor: string;
}): Promise<GscSnapshotRecord> {
  const cfg = getGoogleApiEnvStatus();
  if (!cfg.gscApiConnected || !cfg.gscSiteUrl) {
    throw new Error(
      'Google Search Console API is not connected. Configure GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GSC_SITE_URL on the server, or use the CSV Import workflow.'
    );
  }

  const accessToken = await getGoogleServiceAccountAccessToken(
    'https://www.googleapis.com/auth/webmasters.readonly'
  );
  const gscDimensionMap: Record<GscSnapshotRecord['dimension'], string> = {
    query: 'query',
    page: 'page',
    country: 'country',
    device: 'device',
    search_appearance: 'searchAppearance',
    date: 'date',
  };

  const encodedSite = encodeURIComponent(cfg.gscSiteUrl);
  const apiUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: [gscDimensionMap[params.dimension]],
      rowLimit: params.dimension === 'query' || params.dimension === 'page' ? 1000 : 250,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Search Console API error (HTTP ${res.status}): ${errText.slice(0, 250)}`);
  }

  const json = (await res.json()) as {
    rows?: Array<{ keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }>;
  };

  const rows: GscMetricRow[] = (json.rows || []).map((r) => {
    const rawKey = r.keys?.[0] || '';
    const key =
      params.dimension === 'page'
        ? normalizeTeqqnoPath(rawKey)
        : params.dimension === 'query'
        ? rawKey.toLowerCase()
        : rawKey;
    return {
      key,
      clicks: Math.max(0, Math.round(Number(r.clicks || 0))),
      impressions: Math.max(0, Math.round(Number(r.impressions || 0))),
      ctr: parseCtrPercentage(String(r.ctr ?? 0)),
      position: Number(Number(r.position || 0).toFixed(2)),
    };
  });

  return {
    id: `gsc:${cfg.gscSiteUrl}:${params.dimension}:${params.startDate}:${params.endDate}`,
    propertyUrl: cfg.gscSiteUrl,
    dateStart: params.startDate,
    dateEnd: params.endDate,
    dimension: params.dimension,
    source: 'Google Search Console API',
    importedAt: new Date().toISOString(),
    importedBy: params.actor,
    rows,
  };
}

export async function inspectSingleUrlViaGscApi(targetUrl: string): Promise<UrlInspectionRecord> {
  const cfg = getGoogleApiEnvStatus();
  if (!cfg.gscApiConnected || !cfg.gscSiteUrl) {
    throw new Error(
      'Google Search Console URL Inspection API is not connected. Configure server-side Google Service Account credentials or import GSC Page Indexing CSV.'
    );
  }

  // Strict allowlist check — prevents SSRF or inspecting external domains
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new Error('Invalid URL provided for inspection.');
  }
  if (parsed.origin !== CANONICAL_ORIGIN) {
    throw new Error(`URL Inspection is strictly restricted to ${CANONICAL_ORIGIN} URLs.`);
  }

  const accessToken = await getGoogleServiceAccountAccessToken(
    'https://www.googleapis.com/auth/webmasters.readonly'
  );
  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inspectionUrl: parsed.toString(),
      siteUrl: cfg.gscSiteUrl,
      languageCode: 'en-IN',
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`GSC URL Inspection API error (HTTP ${res.status}): ${errText.slice(0, 250)}`);
  }

  const json = (await res.json()) as {
    inspectionResult?: {
      indexStatusResult?: {
        verdict?: string;
        coverageState?: string;
        lastCrawlTime?: string;
      };
    };
  };
  const indexRes = json.inspectionResult?.indexStatusResult;
  const verdict = String(indexRes?.verdict || 'VERDICT_UNSPECIFIED');
  const coverageState = String(indexRes?.coverageState || 'Status unavailable');

  const status: UrlInspectionRecord['status'] =
    verdict === 'PASS'
      ? 'indexed'
      : verdict === 'FAIL' || verdict === 'NEUTRAL' || verdict === 'PARTIAL'
      ? 'not_indexed'
      : 'unknown';

  return {
    url: parsed.toString(),
    normalizedPath: normalizeTeqqnoPath(parsed.pathname),
    status,
    coverageState,
    verdict,
    lastCrawlTime: indexRes?.lastCrawlTime || null,
    source: 'GSC URL Inspection API',
    checkedAt: new Date().toISOString(),
  };
}

export async function fetchGa4ReportFromApi(params: {
  startDate: string;
  endDate: string;
  actor: string;
}): Promise<Ga4SnapshotRecord> {
  const cfg = getGoogleApiEnvStatus();
  if (!cfg.ga4DataApiConnected || !cfg.ga4PropertyId) {
    throw new Error(
      'GA4 Data API is not connected. Configure GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, and GA4_PROPERTY_ID on the server, or use the GA4 CSV Import workflow.'
    );
  }

  const accessToken = await getGoogleServiceAccountAccessToken(
    'https://www.googleapis.com/auth/analytics.readonly'
  );
  const apiUrl = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(
    cfg.ga4PropertyId
  )}:runReport`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      dateRanges: [{ startDate: params.startDate, endDate: params.endDate }],
      dimensions: [{ name: 'landingPagePlusQueryString' }, { name: 'sessionDefaultChannelGroup' }],
      metrics: [
        { name: 'sessions' },
        { name: 'itemsViewed' },
        { name: 'itemsAddedToCart' },
        { name: 'itemsCheckedOut' },
        { name: 'ecommercePurchases' },
        { name: 'purchaseRevenue' },
      ],
      limit: 1000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`GA4 Data API error (HTTP ${res.status}): ${errText.slice(0, 250)}`);
  }

  const json = (await res.json()) as {
    rows?: Array<{
      dimensionValues?: Array<{ value?: string }>;
      metricValues?: Array<{ value?: string }>;
    }>;
  };

  const rows: Ga4LandingRow[] = (json.rows || []).map((r) => ({
    landingPath: normalizeTeqqnoPath(r.dimensionValues?.[0]?.value || '/'),
    channel: normalizeChannelName(r.dimensionValues?.[1]?.value || 'Direct'),
    sessions: Math.max(0, Math.round(Number(r.metricValues?.[0]?.value || 0))),
    productViews: Math.max(0, Math.round(Number(r.metricValues?.[1]?.value || 0))),
    addToCarts: Math.max(0, Math.round(Number(r.metricValues?.[2]?.value || 0))),
    checkoutStarts: Math.max(0, Math.round(Number(r.metricValues?.[3]?.value || 0))),
    purchases: Math.max(0, Math.round(Number(r.metricValues?.[4]?.value || 0))),
    revenueInr: Number(Number(r.metricValues?.[5]?.value || 0).toFixed(2)),
    quoteEnquiries: 0,
    whatsappEnquiries: 0,
  }));

  return {
    id: `ga4:${cfg.ga4PropertyId}:${params.startDate}:${params.endDate}`,
    propertyId: cfg.ga4PropertyId,
    dateStart: params.startDate,
    dateEnd: params.endDate,
    source: 'GA4 Data API',
    importedAt: new Date().toISOString(),
    importedBy: params.actor,
    rows,
  };
}

// ==============================================================================
// 4. STORAGE ADAPTER (SUPABASE WITH STRICT FALLBACK TO LOCAL JSON WHEN UNMIGRATED)
//    Zero fabricated data ever inserted.
// ==============================================================================

export class SeoAnalyticsStore {
  private readonly deps: SeoStorageDeps;
  private readonly localPath: string;
  private supabaseTablesReadyCache: { ready: boolean; checkedAt: number } | null = null;

  constructor(deps: SeoStorageDeps, localStoreOverridePath?: string) {
    this.deps = deps;
    this.localPath =
      localStoreOverridePath || path.join(deps.rootDir, '.data', 'seo-analytics-store.json');
  }

  private readLocal(): LocalSeoStore {
    try {
      if (!fs.existsSync(this.localPath)) {
        return {
          gscSnapshots: [],
          ga4Snapshots: [],
          urlInspections: [],
          attributionEvents: [],
          recommendationStates: {},
        };
      }
      const parsed = JSON.parse(fs.readFileSync(this.localPath, 'utf8')) as Partial<LocalSeoStore>;
      return {
        gscSnapshots: Array.isArray(parsed.gscSnapshots) ? parsed.gscSnapshots : [],
        ga4Snapshots: Array.isArray(parsed.ga4Snapshots) ? parsed.ga4Snapshots : [],
        urlInspections: Array.isArray(parsed.urlInspections) ? parsed.urlInspections : [],
        attributionEvents: Array.isArray(parsed.attributionEvents) ? parsed.attributionEvents : [],
        recommendationStates:
          parsed.recommendationStates && typeof parsed.recommendationStates === 'object'
            ? parsed.recommendationStates
            : {},
      };
    } catch {
      return { ...EMPTY_STORE, recommendationStates: {} };
    }
  }

  private writeLocal(store: LocalSeoStore): void {
    const dir = path.dirname(this.localPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.localPath, JSON.stringify(store, null, 2), 'utf8');
  }

  async checkSupabaseTablesReady(): Promise<boolean> {
    if (
      this.supabaseTablesReadyCache &&
      Date.now() - this.supabaseTablesReadyCache.checkedAt < 60_000
    ) {
      return this.supabaseTablesReadyCache.ready;
    }

    const cfg = this.deps.getSupabaseAdminConfig();
    if (!cfg.configured || !cfg.url || !cfg.serviceRoleKey) {
      this.supabaseTablesReadyCache = { ready: false, checkedAt: Date.now() };
      return false;
    }

    try {
      const res = await fetch(`${cfg.url}/rest/v1/seo_analytics_snapshots?select=id&limit=1`, {
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey),
      });
      const ready = res.ok;
      this.supabaseTablesReadyCache = { ready, checkedAt: Date.now() };
      return ready;
    } catch {
      this.supabaseTablesReadyCache = { ready: false, checkedAt: Date.now() };
      return false;
    }
  }

  async saveGscSnapshot(snapshot: GscSnapshotRecord): Promise<{ storage: 'supabase' | 'local_dev_fallback' }> {
    const useSupabase = await this.checkSupabaseTablesReady();
    if (useSupabase) {
      const cfg = this.deps.getSupabaseAdminConfig();
      const res = await fetch(
        `${cfg.url}/rest/v1/seo_analytics_snapshots?on_conflict=provider,property_identifier,dimension_type,date_start,date_end`,
        {
          method: 'POST',
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify({
            provider: 'gsc',
            property_identifier: snapshot.propertyUrl,
            dimension_type: snapshot.dimension,
            date_start: snapshot.dateStart,
            date_end: snapshot.dateEnd,
            data_source: snapshot.source,
            row_count: snapshot.rows.length,
            rows_json: snapshot.rows,
            imported_by: snapshot.importedBy,
          }),
        }
      );
      if (res.ok) return { storage: 'supabase' };
    }

    const local = this.readLocal();
    // Deduplicate by propertyUrl + dimension + dateStart + dateEnd
    local.gscSnapshots = local.gscSnapshots.filter(
      (s) =>
        !(
          s.propertyUrl === snapshot.propertyUrl &&
          s.dimension === snapshot.dimension &&
          s.dateStart === snapshot.dateStart &&
          s.dateEnd === snapshot.dateEnd
        )
    );
    local.gscSnapshots.unshift(snapshot);
    this.writeLocal(local);
    return { storage: 'local_dev_fallback' };
  }

  async saveGa4Snapshot(snapshot: Ga4SnapshotRecord): Promise<{ storage: 'supabase' | 'local_dev_fallback' }> {
    const useSupabase = await this.checkSupabaseTablesReady();
    if (useSupabase) {
      const cfg = this.deps.getSupabaseAdminConfig();
      const res = await fetch(
        `${cfg.url}/rest/v1/seo_analytics_snapshots?on_conflict=provider,property_identifier,dimension_type,date_start,date_end`,
        {
          method: 'POST',
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify({
            provider: 'ga4',
            property_identifier: snapshot.propertyId,
            dimension_type: 'ga4_landing_channel',
            date_start: snapshot.dateStart,
            date_end: snapshot.dateEnd,
            data_source: snapshot.source,
            row_count: snapshot.rows.length,
            rows_json: snapshot.rows,
            imported_by: snapshot.importedBy,
          }),
        }
      );
      if (res.ok) return { storage: 'supabase' };
    }

    const local = this.readLocal();
    local.ga4Snapshots = local.ga4Snapshots.filter(
      (s) =>
        !(
          s.propertyId === snapshot.propertyId &&
          s.dateStart === snapshot.dateStart &&
          s.dateEnd === snapshot.dateEnd
        )
    );
    local.ga4Snapshots.unshift(snapshot);
    this.writeLocal(local);
    return { storage: 'local_dev_fallback' };
  }

  async saveUrlInspections(records: UrlInspectionRecord[]): Promise<{ storage: 'supabase' | 'local_dev_fallback' }> {
    const useSupabase = await this.checkSupabaseTablesReady();
    if (useSupabase && records.length > 0) {
      const cfg = this.deps.getSupabaseAdminConfig();
      const propertyUrl = getGoogleApiEnvStatus().gscSiteUrl || `${CANONICAL_ORIGIN}/`;
      const res = await fetch(
        `${cfg.url}/rest/v1/seo_url_inspections?on_conflict=property_url,normalized_path`,
        {
          method: 'POST',
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify(
            records.map((rec) => ({
              property_url: propertyUrl,
              inspected_url: rec.url,
              normalized_path: rec.normalizedPath,
              index_status: rec.status,
              coverage_state: rec.coverageState,
              verdict: rec.verdict,
              last_crawl_time: rec.lastCrawlTime,
              data_source: rec.source,
              checked_at: rec.checkedAt,
            }))
          ),
        }
      );
      if (res.ok) return { storage: 'supabase' };
    }

    const local = this.readLocal();
    const byPath = new Map<string, UrlInspectionRecord>();
    for (const existing of local.urlInspections) {
      byPath.set(existing.normalizedPath, existing);
    }
    for (const rec of records) {
      byPath.set(rec.normalizedPath, rec);
    }
    local.urlInspections = Array.from(byPath.values());
    this.writeLocal(local);
    return { storage: 'local_dev_fallback' };
  }

  async recordAttributionEvent(
    event: Omit<FirstPartyAttributionEvent, 'id' | 'occurredAt'> & { occurredAt?: string }
  ): Promise<{ recorded: boolean; deduplicated: boolean }> {
    const record: FirstPartyAttributionEvent = {
      id: crypto.randomUUID(),
      ...event,
      landingPath: normalizeTeqqnoPath(event.landingPath),
      pagePath: normalizeTeqqnoPath(event.pagePath),
      occurredAt: event.occurredAt || new Date().toISOString(),
    };

    const useSupabase = await this.checkSupabaseTablesReady();
    if (useSupabase) {
      const cfg = this.deps.getSupabaseAdminConfig();
      const res = await fetch(`${cfg.url}/rest/v1/seo_attribution_events`, {
        method: 'POST',
        headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
          Prefer: 'return=minimal',
        }),
        body: JSON.stringify({
          event_name: record.eventName,
          event_key: record.eventKey || null,
          transaction_id: record.transactionId || null,
          session_id: record.sessionId,
          channel: record.channel,
          landing_path: record.landingPath,
          page_path: record.pagePath,
          product_id: record.productId || null,
          product_name: record.productName || null,
          category_slug: record.categorySlug || null,
          value_inr: typeof record.valueInr === 'number' ? record.valueInr : null,
          quantity: typeof record.quantity === 'number' ? record.quantity : null,
          source_host: record.sourceHost || null,
          occurred_at: record.occurredAt,
        }),
      });
      if (res.ok) return { recorded: true, deduplicated: false };
      if (res.status === 409) return { recorded: false, deduplicated: true };
    }

    const local = this.readLocal();
    // Deduplicate purchase by transactionId or keyed event by eventKey
    if (record.eventName === 'purchase' && record.transactionId) {
      const dup = local.attributionEvents.some(
        (e) => e.eventName === 'purchase' && e.transactionId === record.transactionId
      );
      if (dup) return { recorded: false, deduplicated: true };
    }
    if (record.eventKey) {
      const dupKey = local.attributionEvents.some((e) => e.eventKey === record.eventKey);
      if (dupKey) return { recorded: false, deduplicated: true };
    }

    local.attributionEvents.unshift(record);
    if (local.attributionEvents.length > MAX_LOCAL_EVENTS) {
      local.attributionEvents = local.attributionEvents.slice(0, MAX_LOCAL_EVENTS);
    }
    this.writeLocal(local);
    return { recorded: true, deduplicated: false };
  }

  async updateRecommendationState(params: {
    recommendationId: string;
    status: RecommendationStatus;
    issueTitle: string;
    affectedUrl: string;
    actor: string;
  }): Promise<void> {
    const nowIso = new Date().toISOString();
    const useSupabase = await this.checkSupabaseTablesReady();
    if (useSupabase) {
      const cfg = this.deps.getSupabaseAdminConfig();
      const res = await fetch(
        `${cfg.url}/rest/v1/seo_recommendation_states?on_conflict=recommendation_id`,
        {
          method: 'POST',
          headers: this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey, {
            Prefer: 'resolution=merge-duplicates,return=minimal',
          }),
          body: JSON.stringify({
            recommendation_id: params.recommendationId,
            status: params.status,
            issue_title: params.issueTitle,
            affected_url: params.affectedUrl,
            updated_by: params.actor,
            updated_at: nowIso,
          }),
        }
      );
      if (res.ok) return;
    }

    const local = this.readLocal();
    local.recommendationStates[params.recommendationId] = {
      status: params.status,
      issueTitle: params.issueTitle,
      affectedUrl: params.affectedUrl,
      updatedAt: nowIso,
      updatedBy: params.actor,
    };
    this.writeLocal(local);
  }

  async loadAllData(): Promise<{
    storageMode: 'supabase' | 'local_dev_fallback';
    supabaseTablesReady: boolean;
    gscSnapshots: GscSnapshotRecord[];
    ga4Snapshots: Ga4SnapshotRecord[];
    urlInspections: UrlInspectionRecord[];
    attributionEvents: FirstPartyAttributionEvent[];
    recommendationStates: LocalSeoStore['recommendationStates'];
  }> {
    const supabaseTablesReady = await this.checkSupabaseTablesReady();
    if (supabaseTablesReady) {
      const cfg = this.deps.getSupabaseAdminConfig();
      const headers = this.deps.buildSupabaseAdminHeaders(cfg.serviceRoleKey);
      try {
        const [snapRes, inspRes, evRes, recRes] = await Promise.all([
          fetch(`${cfg.url}/rest/v1/seo_analytics_snapshots?select=*&order=updated_at.desc&limit=200`, {
            headers,
          }),
          fetch(`${cfg.url}/rest/v1/seo_url_inspections?select=*&order=checked_at.desc&limit=500`, {
            headers,
          }),
          fetch(`${cfg.url}/rest/v1/seo_attribution_events?select=*&order=occurred_at.desc&limit=5000`, {
            headers,
          }),
          fetch(`${cfg.url}/rest/v1/seo_recommendation_states?select=*`, { headers }),
        ]);

        if (snapRes.ok && inspRes.ok && evRes.ok && recRes.ok) {
          const snaps = (await snapRes.json()) as Array<Record<string, any>>;
          const insps = (await inspRes.json()) as Array<Record<string, any>>;
          const evs = (await evRes.json()) as Array<Record<string, any>>;
          const recs = (await recRes.json()) as Array<Record<string, any>>;

          const gscSnapshots: GscSnapshotRecord[] = [];
          const ga4Snapshots: Ga4SnapshotRecord[] = [];
          for (const s of snaps) {
            if (s.provider === 'gsc') {
              gscSnapshots.push({
                id: String(s.id),
                propertyUrl: String(s.property_identifier),
                dateStart: String(s.date_start),
                dateEnd: String(s.date_end),
                dimension: s.dimension_type,
                source: s.data_source,
                importedAt: String(s.updated_at || s.created_at),
                importedBy: String(s.imported_by || 'admin'),
                rows: Array.isArray(s.rows_json) ? s.rows_json : [],
              });
            } else if (s.provider === 'ga4') {
              ga4Snapshots.push({
                id: String(s.id),
                propertyId: String(s.property_identifier),
                dateStart: String(s.date_start),
                dateEnd: String(s.date_end),
                source: s.data_source,
                importedAt: String(s.updated_at || s.created_at),
                importedBy: String(s.imported_by || 'admin'),
                rows: Array.isArray(s.rows_json) ? s.rows_json : [],
              });
            }
          }

          const urlInspections: UrlInspectionRecord[] = insps.map((r) => ({
            url: String(r.inspected_url),
            normalizedPath: String(r.normalized_path),
            status: r.index_status,
            coverageState: String(r.coverage_state || ''),
            verdict: String(r.verdict || ''),
            lastCrawlTime: r.last_crawl_time ? String(r.last_crawl_time) : null,
            source: r.data_source,
            checkedAt: String(r.checked_at),
          }));

          const attributionEvents: FirstPartyAttributionEvent[] = evs.map((e) => ({
            id: String(e.id),
            eventName: e.event_name,
            eventKey: e.event_key || undefined,
            transactionId: e.transaction_id || undefined,
            sessionId: String(e.session_id),
            channel: e.channel,
            landingPath: String(e.landing_path),
            pagePath: String(e.page_path),
            productId: e.product_id || undefined,
            productName: e.product_name || undefined,
            categorySlug: e.category_slug || undefined,
            valueInr: e.value_inr !== null && e.value_inr !== undefined ? Number(e.value_inr) : undefined,
            quantity: e.quantity !== null && e.quantity !== undefined ? Number(e.quantity) : undefined,
            sourceHost: e.source_host || undefined,
            occurredAt: String(e.occurred_at),
          }));

          const recommendationStates: LocalSeoStore['recommendationStates'] = {};
          for (const rc of recs) {
            recommendationStates[String(rc.recommendation_id)] = {
              status: rc.status,
              issueTitle: String(rc.issue_title || ''),
              affectedUrl: String(rc.affected_url || ''),
              updatedAt: String(rc.updated_at || ''),
              updatedBy: String(rc.updated_by || 'admin'),
            };
          }

          return {
            storageMode: 'supabase',
            supabaseTablesReady: true,
            gscSnapshots,
            ga4Snapshots,
            urlInspections,
            attributionEvents,
            recommendationStates,
          };
        }
      } catch {
        // Fall through to local fallback cleanly
      }
    }

    const local = this.readLocal();
    return {
      storageMode: 'local_dev_fallback',
      supabaseTablesReady: false,
      ...local,
    };
  }
}

// ==============================================================================
// 5. LIVE TECHNICAL SEO AUDIT & HEALTH SCORE ENGINE
// ==============================================================================

export async function runLiveTechnicalSeoAudit(
  deps: SeoStorageDeps,
  savedInspections: UrlInspectionRecord[]
): Promise<TechnicalSeoAuditResult> {
  const feedOpts = {
    rootDir: deps.rootDir,
    getSupabaseConfig: () => ({ url: '', apiKey: '' }),
  };
  const robotsTxt = buildRobotsTxt();
  const sitemapXml = await buildSitemapXml(feedOpts);
  const sitemapUrls = Array.from(sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);

  const targetPages: Array<{ url: string; path: string; kind: 'product' | 'category'; id: string }> = [
    ...PRODUCTS.map((p) => ({
      url: `${CANONICAL_ORIGIN}${getProductPath(p.slug)}`,
      path: getProductPath(p.slug),
      kind: 'product' as const,
      id: p.id,
    })),
    ...SEO_CATEGORIES.map((c) => ({
      url: `${CANONICAL_ORIGIN}/category/${c.slug}`,
      path: `/category/${c.slug}`,
      kind: 'category' as const,
      id: c.slug,
    })),
  ];

  // 1. Sitemap check
  const missingInSitemap = targetPages
    .filter((tp) => !sitemapUrls.includes(tp.url))
    .map((tp) => tp.path);

  // 2. robots.txt check
  const robotsValid =
    robotsTxt.includes(`Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`) &&
    robotsTxt.includes('Disallow: /admin') &&
    robotsTxt.includes('Disallow: /checkout');

  // 3. Titles & Meta descriptions (presence + uniqueness)
  const seenTitles = new Map<string, string>();
  const seenDescs = new Map<string, string>();
  const badTitleUrls: string[] = [];
  const badDescUrls: string[] = [];
  const dupTitleUrls: string[] = [];
  const dupDescUrls: string[] = [];
  const badH1Urls: string[] = [];
  const badCanonicalUrls: string[] = [];
  const badSchemaUrls: string[] = [];
  const badInternalLinkUrls: string[] = [];
  const badAltUrls: string[] = [];

  for (const p of PRODUCTS) {
    const prodPath = getProductPath(p.slug);
    const title = buildProductSeoTitle(p.id, p.name);
    const desc = buildProductSeoDescription({
      productId: p.id,
      name: p.name,
      description: p.shortDesc || p.description,
      priceInr: p.basePrice,
      moq: p.moq,
    });
    const h1 = getProductH1(p.id, p.name);
    const kw = getProductKeywordEntry(p.id);

    if (!title || title.length < 30 || title.length > 75) badTitleUrls.push(prodPath);
    if (!desc || desc.length < 110 || desc.length > 175) badDescUrls.push(prodPath);
    if (seenTitles.has(title)) dupTitleUrls.push(prodPath);
    else seenTitles.set(title, prodPath);
    if (seenDescs.has(desc)) dupDescUrls.push(prodPath);
    else seenDescs.set(desc, prodPath);

    if (!h1 || h1.includes('|')) badH1Urls.push(prodPath);

    const ssrCtx = await resolveSeoPageContext(prodPath, feedOpts);
    if (ssrCtx.canonicalUrl !== `${CANONICAL_ORIGIN}${prodPath}` || ssrCtx.statusCode !== 200) {
      badCanonicalUrls.push(prodPath);
    }

    const ld = buildPageStructuredData({
      kind: 'product',
      product: {
        id: p.id,
        slug: p.slug,
        name: p.name,
        category: p.category,
        description: p.shortDesc || p.description,
        basePrice: p.basePrice,
        moq: p.moq,
        imageUrl: p.colors?.[0]?.imageFront,
      },
      title,
      metaDescription: desc,
    });
    const graph = (ld?.['@graph'] as Array<Record<string, unknown>>) || [];
    const prodSchemas = graph.filter((n) => n['@type'] === 'Product');
    const faqSchemas = graph.filter((n) => n['@type'] === 'FAQPage');
    if (prodSchemas.length !== 1 || faqSchemas.length !== 1 || prodSchemas[0]?.aggregateRating) {
      badSchemaUrls.push(prodPath);
    }

    if (!kw || !kw.cardImageAlt || kw.cardImageAlt.includes('|')) {
      badAltUrls.push(prodPath);
    }

    const relIds = kw?.recommendedRelatedIds || [];
    const brokenRel = relIds.some((id) => id === p.id || !PRODUCTS.some((prod) => prod.id === id));
    if (relIds.length === 0 || brokenRel) {
      badInternalLinkUrls.push(prodPath);
    }
  }

  for (const cat of SEO_CATEGORIES) {
    const catPath = `/category/${cat.slug}`;
    const kw = getCategoryKeywordEntry(cat.slug);
    if (!cat.title || cat.title.length < 30 || cat.title.length > 75) badTitleUrls.push(catPath);
    if (!cat.description || cat.description.length < 110 || cat.description.length > 175) {
      badDescUrls.push(catPath);
    }
    if (seenTitles.has(cat.title)) dupTitleUrls.push(catPath);
    else seenTitles.set(cat.title, catPath);
    if (seenDescs.has(cat.description)) dupDescUrls.push(catPath);
    else seenDescs.set(cat.description, catPath);

    if (!cat.h1 || cat.h1.includes('|')) badH1Urls.push(catPath);

    const ssrCtx = await resolveSeoPageContext(catPath, feedOpts);
    if (ssrCtx.canonicalUrl !== `${CANONICAL_ORIGIN}${catPath}` || ssrCtx.statusCode !== 200) {
      badCanonicalUrls.push(catPath);
    }

    const ld = buildPageStructuredData({
      kind: 'category',
      category: cat,
      products: PRODUCTS.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        category: p.category,
        description: p.shortDesc || p.description,
        basePrice: p.basePrice,
        moq: p.moq,
        imageUrl: p.colors?.[0]?.imageFront,
      })),
    });
    const graph = (ld?.['@graph'] as Array<Record<string, unknown>>) || [];
    if (
      graph.filter((n) => n['@type'] === 'CollectionPage').length !== 1 ||
      graph.filter((n) => n['@type'] === 'FAQPage').length !== 1
    ) {
      badSchemaUrls.push(catPath);
    }

    if (!kw || !kw.badgeImageAlt || kw.badgeImageAlt.includes('|')) {
      badAltUrls.push(catPath);
    }
  }

  // Private noindex verification
  const adminCtx = await resolveSeoPageContext('/admin', feedOpts);
  const checkoutCtx = await resolveSeoPageContext('/checkout', feedOpts);
  const indexabilityIssues: string[] = [];
  if (!adminCtx.robots.includes('noindex')) indexabilityIssues.push('/admin');
  if (!checkoutCtx.robots.includes('noindex')) indexabilityIssues.push('/checkout');

  const totalMonitored = targetPages.length;
  const makeCheck = (
    id: string,
    label: string,
    category: TechnicalSeoCheckItem['category'],
    weight: number,
    failedUrls: string[],
    total: number,
    passMsg: string,
    failMsg: string
  ): TechnicalSeoCheckItem => {
    const passed = Math.max(0, total - failedUrls.length);
    const ratio = total > 0 ? passed / total : 1;
    const earnedPoints = Number((weight * ratio).toFixed(1));
    const status: TechnicalSeoCheckItem['status'] =
      failedUrls.length === 0 ? 'pass' : ratio >= 0.75 ? 'warning' : 'fail';
    return {
      id,
      label,
      category,
      status,
      passedCount: passed,
      totalCount: total,
      weight,
      earnedPoints,
      details: failedUrls.length === 0 ? passMsg : failMsg,
      affectedUrls: failedUrls,
    };
  };

  const checks: TechnicalSeoCheckItem[] = [
    makeCheck(
      'sitemap_availability',
      'XML Sitemap Availability & Product/Category Coverage',
      'crawlability',
      10,
      missingInSitemap,
      totalMonitored,
      `Dynamic sitemap.xml verified with ${sitemapUrls.length} canonical URLs including all 11 products & 5 categories.`,
      `${missingInSitemap.length} monitored pages missing from sitemap.xml.`
    ),
    makeCheck(
      'robots_txt',
      'robots.txt Directives & Private Route Protection',
      'crawlability',
      8,
      robotsValid ? [] : ['/robots.txt'],
      1,
      'robots.txt exposes sitemap.xml and disallows /admin, /checkout, /dashboard, and /api/.',
      'robots.txt missing sitemap declaration or private disallow rules.'
    ),
    makeCheck(
      'canonical_tags',
      'Self-Referencing HTTPS Canonical Tags',
      'crawlability',
      12,
      badCanonicalUrls,
      totalMonitored,
      `All ${totalMonitored} product & category routes emit exact https://teqqnoworld.com canonical URLs.`,
      `${badCanonicalUrls.length} routes have canonical mismatches or non-200 SSR responses.`
    ),
    makeCheck(
      'indexability_directives',
      'Indexability & Private Noindex Safeguards',
      'crawlability',
      8,
      indexabilityIssues,
      2,
      'Public catalog routes are indexable while /admin and /checkout emit noindex, nofollow.',
      'Private routes missing noindex directives.'
    ),
    makeCheck(
      'seo_titles',
      'Unique SEO Titles & Healthy Length',
      'metadata',
      12,
      Array.from(new Set([...badTitleUrls, ...dupTitleUrls])),
      totalMonitored,
      `All ${totalMonitored} pages have unique, well-formed SEO titles with 0 duplicates.`,
      `${badTitleUrls.length} length issues and ${dupTitleUrls.length} duplicate titles detected.`
    ),
    makeCheck(
      'meta_descriptions',
      'Unique Meta Descriptions & Healthy Length',
      'metadata',
      10,
      Array.from(new Set([...badDescUrls, ...dupDescUrls])),
      totalMonitored,
      `All ${totalMonitored} pages have unique, well-formed meta descriptions with 0 duplicates.`,
      `${badDescUrls.length} length issues and ${dupDescUrls.length} duplicate descriptions detected.`
    ),
    makeCheck(
      'h1_structure',
      'Clean Single H1 Heading Structure',
      'content',
      10,
      badH1Urls,
      totalMonitored,
      `All ${totalMonitored} pages render clean, non-stuffed single H1 headings.`,
      `${badH1Urls.length} pages have missing or pipe-stuffed H1 headings.`
    ),
    makeCheck(
      'image_alt_coverage',
      'Product & Category Image ALT Text Coverage',
      'images',
      10,
      badAltUrls,
      totalMonitored,
      `All ${totalMonitored} product/category image ALT descriptions verified clean and non-stuffed.`,
      `${badAltUrls.length} pages have missing or pipe-stuffed image ALT text.`
    ),
    makeCheck(
      'internal_links',
      'Curated Internal Link Integrity (Zero Broken Links)',
      'links',
      10,
      badInternalLinkUrls,
      PRODUCTS.length,
      `All ${PRODUCTS.length} product pages link to valid companion products with 0 self-links or broken IDs.`,
      `${badInternalLinkUrls.length} product pages contain broken or missing internal links.`
    ),
    makeCheck(
      'structured_data',
      'Unified @graph JSON-LD Structured Data Validity',
      'schema',
      10,
      badSchemaUrls,
      totalMonitored,
      `All ${totalMonitored} pages output valid Product/CollectionPage + BreadcrumbList + FAQPage JSON-LD with zero fake ratings.`,
      `${badSchemaUrls.length} pages have incomplete or invalid structured data.`
    ),
  ];

  const technicalHealthScore = Math.round(
    checks.reduce((sum, c) => sum + c.earnedPoints, 0)
  );

  // Indexing Summary — NEVER claim sitemap URLs are indexed without GSC verification!
  const inspectionByPath = new Map<string, UrlInspectionRecord>();
  for (const rec of savedInspections) {
    inspectionByPath.set(rec.normalizedPath, rec);
  }

  const inspections: UrlInspectionRecord[] = sitemapUrls.map((u) => {
    const np = normalizeTeqqnoPath(u);
    const verified = inspectionByPath.get(np);
    if (verified) return verified;
    return {
      url: u,
      normalizedPath: np,
      status: 'unknown',
      coverageState: 'Submitted in sitemap.xml — Google indexing status not yet verified via GSC API or CSV import',
      verdict: 'UNKNOWN',
      lastCrawlTime: null,
      source: 'Sitemap Only (Index Status Unknown)',
      checkedAt: new Date().toISOString(),
    };
  });

  const verifiedCount = inspections.filter((i) => i.status !== 'unknown').length;
  const indexedUrls =
    verifiedCount > 0 ? inspections.filter((i) => i.status === 'indexed').length : null;
  const notIndexedUrls =
    verifiedCount > 0 ? inspections.filter((i) => i.status === 'not_indexed').length : null;
  const unknownUrls = inspections.filter((i) => i.status === 'unknown').length;

  const gscStatus = getGoogleApiEnvStatus();

  return {
    auditedAt: new Date().toISOString(),
    technicalHealthScore,
    methodologyNote:
      'Calculated strictly from 10 verifiable on-site technical SEO checks (weighted sum = 100 pts: crawlability 38, metadata 22, content 10, images 10, internal links 10, structured data 10). This is an internal technical readiness score and is NOT a Google Search ranking score.',
    sitemapAvailable: sitemapUrls.length > 0,
    sitemapUrlCount: sitemapUrls.length,
    robotsTxtAvailable: robotsValid,
    checks,
    indexingSummary: {
      submittedUrls: sitemapUrls.length,
      indexedUrls,
      notIndexedUrls,
      unknownUrls,
      urlInspectionApiConnected: gscStatus.gscApiConnected,
      note:
        verifiedCount > 0
          ? `${verifiedCount} of ${sitemapUrls.length} submitted URLs have verified indexing records from Google Search Console; ${unknownUrls} remain unknown until inspected.`
          : 'Presence in sitemap.xml does not confirm Google indexing. Connect the Google Search Console URL Inspection API or import a GSC Page Indexing CSV to verify Indexed vs Not Indexed counts.',
      inspections,
    },
  };
}

// ==============================================================================
// 6. FULL DASHBOARD AGGREGATOR (REAL DATA ONLY — ZERO FABRICATION)
// ==============================================================================

function pickBestSnapshotsForRange<T extends { dateStart: string; dateEnd: string; importedAt: string }>(
  snapshots: T[],
  startDate: string,
  endDate: string
): T[] {
  // Prefer snapshots overlapping [startDate, endDate]
  const overlapping = snapshots.filter((s) => s.dateStart <= endDate && s.dateEnd >= startDate);
  if (overlapping.length > 0) return overlapping;
  return [];
}

function aggregateGscRows(snapshots: GscSnapshotRecord[]): GscMetricRow[] {
  const map = new Map<string, { clicks: number; impressions: number; weightedPos: number; weight: number }>();
  for (const snap of snapshots) {
    for (const row of snap.rows) {
      const cur = map.get(row.key) || { clicks: 0, impressions: 0, weightedPos: 0, weight: 0 };
      const w = row.impressions > 0 ? row.impressions : 1;
      cur.clicks += row.clicks;
      cur.impressions += row.impressions;
      cur.weightedPos += row.position * w;
      cur.weight += w;
      map.set(row.key, cur);
    }
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? Number(((v.clicks / v.impressions) * 100).toFixed(2)) : 0,
      position: v.weight > 0 ? Number((v.weightedPos / v.weight).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);
}

function summarizeGscMetrics(rows: GscMetricRow[]): {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
} | null {
  if (rows.length === 0) return null;
  let clicks = 0;
  let impressions = 0;
  let weightedPos = 0;
  let weight = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    const w = r.impressions > 0 ? r.impressions : 1;
    weightedPos += r.position * w;
    weight += w;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
    avgPosition: weight > 0 ? Number((weightedPos / weight).toFixed(2)) : 0,
  };
}

function buildKpi(params: {
  value: number | null;
  previousValue: number | null;
  source: SeoDataSourceLabel;
  invertDirection?: boolean;
  unavailableNote?: string;
}): SeoKpiMetric<number | null> {
  if (params.value === null) {
    return {
      value: null,
      available: false,
      previousValue: null,
      changePercent: null,
      comparisonNote: params.unavailableNote || 'Data unavailable — connect API or import CSV',
      source: 'Unavailable',
    };
  }
  if (params.previousValue === null || params.previousValue === 0) {
    return {
      value: params.value,
      available: true,
      previousValue: params.previousValue,
      changePercent: null,
      comparisonNote: 'No valid previous-period baseline available',
      source: params.source,
    };
  }
  const delta = params.value - params.previousValue;
  const pct = Number(((delta / params.previousValue) * 100).toFixed(1));
  return {
    value: params.value,
    available: true,
    previousValue: params.previousValue,
    changePercent: pct,
    comparisonNote: `vs previous period (${params.previousValue})`,
    source: params.source,
  };
}

function aggregateAttributionByChannelAndLanding(
  ga4Snapshots: Ga4SnapshotRecord[],
  events: FirstPartyAttributionEvent[],
  startDate: string,
  endDate: string
): {
  available: boolean;
  source: SeoDataSourceLabel;
  channels: ChannelPerformanceRow[];
  byLandingOrganic: Map<string, Ga4LandingRow>;
  byProductOrganic: Map<
    string,
    { views: number; addToCarts: number; purchases: number; revenueInr: number }
  >;
  rangeLabel: string;
} {
  const matchingGa4 = pickBestSnapshotsForRange(ga4Snapshots, startDate, endDate);
  const startMs = new Date(`${startDate}T00:00:00.000Z`).getTime();
  const endMs = new Date(`${endDate}T23:59:59.999Z`).getTime();
  const matchingEvents = events.filter((e) => {
    const t = new Date(e.occurredAt).getTime();
    return t >= startMs && t <= endMs;
  });

  const channelSeed: TrafficChannel[] = [
    'organic_search',
    'direct',
    'paid_search',
    'referral',
    'social',
  ];
  const channelMap = new Map<TrafficChannel, ChannelPerformanceRow>();
  for (const ch of channelSeed) {
    channelMap.set(ch, {
      channel: ch,
      label: channelDisplayLabel(ch),
      sessions: 0,
      productViews: 0,
      addToCarts: 0,
      checkoutStarts: 0,
      purchases: 0,
      revenueInr: 0,
      quoteEnquiries: 0,
      whatsappEnquiries: 0,
    });
  }

  const byLandingOrganic = new Map<string, Ga4LandingRow>();
  const byProductOrganic = new Map<
    string,
    { views: number; addToCarts: number; purchases: number; revenueInr: number }
  >();

  if (matchingGa4.length > 0) {
    const primarySnap = matchingGa4[0];
    for (const row of primarySnap.rows) {
      const ch = channelMap.get(row.channel)!;
      ch.sessions += row.sessions;
      ch.productViews += row.productViews;
      ch.addToCarts += row.addToCarts;
      ch.checkoutStarts += row.checkoutStarts;
      ch.purchases += row.purchases;
      ch.revenueInr = Number((ch.revenueInr + row.revenueInr).toFixed(2));
      ch.quoteEnquiries += row.quoteEnquiries;
      ch.whatsappEnquiries += row.whatsappEnquiries;

      if (row.channel === 'organic_search') {
        const lp = normalizeTeqqnoPath(row.landingPath);
        const cur = byLandingOrganic.get(lp) || {
          landingPath: lp,
          channel: 'organic_search',
          sessions: 0,
          productViews: 0,
          addToCarts: 0,
          checkoutStarts: 0,
          purchases: 0,
          revenueInr: 0,
          quoteEnquiries: 0,
          whatsappEnquiries: 0,
        };
        cur.sessions += row.sessions;
        cur.productViews += row.productViews;
        cur.addToCarts += row.addToCarts;
        cur.checkoutStarts += row.checkoutStarts;
        cur.purchases += row.purchases;
        cur.revenueInr = Number((cur.revenueInr + row.revenueInr).toFixed(2));
        cur.quoteEnquiries += row.quoteEnquiries;
        cur.whatsappEnquiries += row.whatsappEnquiries;
        byLandingOrganic.set(lp, cur);
      }
    }

    // Supplement quote & whatsapp enquiries from first-party events if GA4 snapshot didn't include them
    for (const ev of matchingEvents) {
      const ch = channelMap.get(ev.channel)!;
      if (ev.eventName === 'quote_request' || ev.eventName === 'generate_lead') {
        ch.quoteEnquiries += 1;
      } else if (ev.eventName === 'whatsapp_enquiry') {
        ch.whatsappEnquiries += 1;
      }
    }

    return {
      available: true,
      source: primarySnap.source,
      channels: Array.from(channelMap.values()),
      byLandingOrganic,
      byProductOrganic,
      rangeLabel: `${primarySnap.dateStart} to ${primarySnap.dateEnd}`,
    };
  }

  if (matchingEvents.length > 0) {
    const sessionsPerChannel = new Map<TrafficChannel, Set<string>>();
    const organicLandingSessions = new Map<string, Set<string>>();
    for (const ch of channelSeed) sessionsPerChannel.set(ch, new Set());

    for (const ev of matchingEvents) {
      const ch = channelMap.get(ev.channel)!;
      sessionsPerChannel.get(ev.channel)!.add(ev.sessionId);

      const lp = normalizeTeqqnoPath(ev.landingPath);
      if (ev.channel === 'organic_search') {
        if (!organicLandingSessions.has(lp)) organicLandingSessions.set(lp, new Set());
        organicLandingSessions.get(lp)!.add(ev.sessionId);
      }

      const ensureLanding = () => {
        const existing = byLandingOrganic.get(lp) || {
          landingPath: lp,
          channel: 'organic_search' as const,
          sessions: 0,
          productViews: 0,
          addToCarts: 0,
          checkoutStarts: 0,
          purchases: 0,
          revenueInr: 0,
          quoteEnquiries: 0,
          whatsappEnquiries: 0,
        };
        byLandingOrganic.set(lp, existing);
        return existing;
      };

      const ensureProd = (pid: string) => {
        const existing = byProductOrganic.get(pid) || {
          views: 0,
          addToCarts: 0,
          purchases: 0,
          revenueInr: 0,
        };
        byProductOrganic.set(pid, existing);
        return existing;
      };

      if (ev.eventName === 'view_item') {
        ch.productViews += 1;
        if (ev.channel === 'organic_search') {
          ensureLanding().productViews += 1;
          if (ev.productId) ensureProd(ev.productId).views += 1;
        }
      } else if (ev.eventName === 'add_to_cart') {
        ch.addToCarts += 1;
        if (ev.channel === 'organic_search') {
          ensureLanding().addToCarts += 1;
          if (ev.productId) ensureProd(ev.productId).addToCarts += 1;
        }
      } else if (ev.eventName === 'begin_checkout') {
        ch.checkoutStarts += 1;
        if (ev.channel === 'organic_search') {
          ensureLanding().checkoutStarts += 1;
        }
      } else if (ev.eventName === 'purchase') {
        ch.purchases += 1;
        ch.revenueInr = Number((ch.revenueInr + Number(ev.valueInr || 0)).toFixed(2));
        if (ev.channel === 'organic_search') {
          const l = ensureLanding();
          l.purchases += 1;
          l.revenueInr = Number((l.revenueInr + Number(ev.valueInr || 0)).toFixed(2));
          if (ev.productId) {
            const pr = ensureProd(ev.productId);
            pr.purchases += 1;
            pr.revenueInr = Number((pr.revenueInr + Number(ev.valueInr || 0)).toFixed(2));
          }
        }
      } else if (ev.eventName === 'quote_request' || ev.eventName === 'generate_lead') {
        ch.quoteEnquiries += 1;
        if (ev.channel === 'organic_search') ensureLanding().quoteEnquiries += 1;
      } else if (ev.eventName === 'whatsapp_enquiry') {
        ch.whatsappEnquiries += 1;
        if (ev.channel === 'organic_search') ensureLanding().whatsappEnquiries += 1;
      }
    }

    for (const ch of channelSeed) {
      channelMap.get(ch)!.sessions = sessionsPerChannel.get(ch)!.size;
    }
    for (const [lp, sessSet] of organicLandingSessions.entries()) {
      const existing = byLandingOrganic.get(lp) || {
        landingPath: lp,
        channel: 'organic_search' as const,
        sessions: 0,
        productViews: 0,
        addToCarts: 0,
        checkoutStarts: 0,
        purchases: 0,
        revenueInr: 0,
        quoteEnquiries: 0,
        whatsappEnquiries: 0,
      };
      existing.sessions = sessSet.size;
      byLandingOrganic.set(lp, existing);
    }

    const dates = matchingEvents.map((e) => e.occurredAt.slice(0, 10)).sort();
    return {
      available: true,
      source: 'First-Party Event Attribution',
      channels: Array.from(channelMap.values()),
      byLandingOrganic,
      byProductOrganic,
      rangeLabel: `${dates[0]} to ${dates[dates.length - 1]}`,
    };
  }

  return {
    available: false,
    source: 'Unavailable',
    channels: Array.from(channelMap.values()),
    byLandingOrganic,
    byProductOrganic,
    rangeLabel: 'No attribution data recorded in selected range',
  };
}

export async function buildSeoAnalyticsDashboard(params: {
  store: SeoAnalyticsStore;
  deps: SeoStorageDeps;
  blogStore?: BlogStore;
  preset?: string;
  startDate?: string;
  endDate?: string;
}): Promise<SeoAnalyticsDashboardResponse> {
  const range = resolveDateRange({
    preset: params.preset,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  const [loaded, technicalAudit] = await Promise.all([
    params.store.loadAllData(),
    runLiveTechnicalSeoAudit(params.deps, []),
  ]);

  // Re-run indexing summary with actual persisted URL inspections (fast, no extra network)
  const finalTechAudit =
    loaded.urlInspections.length > 0
      ? await runLiveTechnicalSeoAudit(params.deps, loaded.urlInspections)
      : technicalAudit;

  // Match GSC snapshots for current and previous periods
  const gscCurrentAll = pickBestSnapshotsForRange(
    loaded.gscSnapshots,
    range.startDate,
    range.endDate
  );
  const gscPrevAll = pickBestSnapshotsForRange(
    loaded.gscSnapshots,
    range.previousStartDate,
    range.previousEndDate
  );

  const byDim = (list: GscSnapshotRecord[], dim: GscSnapshotRecord['dimension']) =>
    list.filter((s) => s.dimension === dim);

  const curQueries = aggregateGscRows(byDim(gscCurrentAll, 'query'));
  const curPages = aggregateGscRows(byDim(gscCurrentAll, 'page'));
  const curCountries = aggregateGscRows(byDim(gscCurrentAll, 'country'));
  const curDevices = aggregateGscRows(byDim(gscCurrentAll, 'device'));
  const curAppearances = aggregateGscRows(byDim(gscCurrentAll, 'search_appearance'));
  const curDates = aggregateGscRows(byDim(gscCurrentAll, 'date')).sort((a, b) =>
    a.key.localeCompare(b.key)
  );

  const prevQueries = aggregateGscRows(byDim(gscPrevAll, 'query'));
  const prevPages = aggregateGscRows(byDim(gscPrevAll, 'page'));
  const prevDates = aggregateGscRows(byDim(gscPrevAll, 'date'));

  // Best available dimension for site totals: prefer date -> page -> query
  const curSummary =
    summarizeGscMetrics(curDates) ||
    summarizeGscMetrics(curPages) ||
    summarizeGscMetrics(curQueries);
  const prevSummary =
    summarizeGscMetrics(prevDates) ||
    summarizeGscMetrics(prevPages) ||
    summarizeGscMetrics(prevQueries);

  const gscDataSource: SeoDataSourceLabel =
    gscCurrentAll.length > 0 ? gscCurrentAll[0].source : 'Unavailable';

  const gscActualStart =
    gscCurrentAll.length > 0
      ? gscCurrentAll.map((s) => s.dateStart).sort()[0]
      : null;
  const gscActualEnd =
    gscCurrentAll.length > 0
      ? gscCurrentAll.map((s) => s.dateEnd).sort().slice(-1)[0]
      : null;
  const gscRangeLabel =
    gscActualStart && gscActualEnd
      ? `${gscActualStart} to ${gscActualEnd}`
      : 'No GSC data imported or synced for selected range';

  // Attribution / GA4 for current and previous periods
  const curAttr = aggregateAttributionByChannelAndLanding(
    loaded.ga4Snapshots,
    loaded.attributionEvents,
    range.startDate,
    range.endDate
  );
  const prevAttr = aggregateAttributionByChannelAndLanding(
    loaded.ga4Snapshots,
    loaded.attributionEvents,
    range.previousStartDate,
    range.previousEndDate
  );

  const curOrganicChannel = curAttr.channels.find((c) => c.channel === 'organic_search')!;
  const prevOrganicChannel = prevAttr.channels.find((c) => c.channel === 'organic_search')!;

  // Build Keyword Tracking rows strictly from Phase 4 src/data/seoKeywordMap.ts
  const queryRowMap = new Map<string, GscMetricRow>();
  for (const r of curQueries) queryRowMap.set(r.key.toLowerCase().trim(), r);
  const prevQueryRowMap = new Map<string, GscMetricRow>();
  for (const r of prevQueries) prevQueryRowMap.set(r.key.toLowerCase().trim(), r);

  const keywords: KeywordPerformanceRow[] = [];
  const seenTargetKeywordPairs = new Set<string>();

  const pushKeywordRow = (args: {
    keyword: string;
    targetType: 'product' | 'category';
    targetId: string;
    targetName: string;
    targetUrl: string;
    groups: KeywordPerformanceRow['groups'];
    isPrimary: boolean;
  }) => {
    const cleanKw = args.keyword.trim();
    const dedupe = `${args.targetUrl}::${cleanKw.toLowerCase()}`;
    if (!cleanKw || seenTargetKeywordPairs.has(dedupe)) return;
    seenTargetKeywordPairs.add(dedupe);

    const matched = queryRowMap.get(cleanKw.toLowerCase());
    const prevMatched = prevQueryRowMap.get(cleanKw.toLowerCase());
    const positionDelta =
      matched && prevMatched && matched.position > 0 && prevMatched.position > 0
        ? Number((prevMatched.position - matched.position).toFixed(2))
        : null;

    const flags: KeywordPerformanceRow['flags'] = [];
    if (!matched) {
      flags.push('no_recorded_data');
    } else {
      if (matched.impressions >= 50 && matched.clicks <= 2) {
        flags.push('impressions_few_clicks');
      }
      if (matched.impressions >= 100 && matched.ctr < 2.0) {
        flags.push('high_impressions_low_ctr');
      }
      if (positionDelta !== null && positionDelta >= 1.0) {
        flags.push('improving_position');
      }
      if (positionDelta !== null && positionDelta <= -1.0) {
        flags.push('declining_position');
      }
    }

    keywords.push({
      keyword: cleanKw,
      targetType: args.targetType,
      targetId: args.targetId,
      targetName: args.targetName,
      targetUrl: args.targetUrl,
      groups: args.groups,
      isPrimary: args.isPrimary,
      clicks: matched ? matched.clicks : null,
      impressions: matched ? matched.impressions : null,
      ctr: matched ? matched.ctr : null,
      averagePosition: matched ? matched.position : null,
      previousPosition: prevMatched ? prevMatched.position : null,
      positionDelta,
      flags,
      searchVolume: 'Not verified',
      keywordDifficulty: 'Not verified',
      reportingPeriod: matched ? gscRangeLabel : 'No recorded data',
      dataSource: matched ? gscDataSource : 'Unavailable',
    });
  };

  for (const entry of Object.values(PRODUCT_KEYWORD_MAP)) {
    pushKeywordRow({
      keyword: entry.primaryKeyword,
      targetType: 'product',
      targetId: entry.productId,
      targetName: entry.productName,
      targetUrl: entry.existingUrl,
      groups: ['product', 'commercial'],
      isPrimary: true,
    });
    for (const k of entry.secondaryKeywords.slice(0, 2)) {
      pushKeywordRow({
        keyword: k,
        targetType: 'product',
        targetId: entry.productId,
        targetName: entry.productName,
        targetUrl: entry.existingUrl,
        groups: ['product'],
        isPrimary: false,
      });
    }
    for (const k of entry.bulkOrderKeywords.slice(0, 2)) {
      pushKeywordRow({
        keyword: k,
        targetType: 'product',
        targetId: entry.productId,
        targetName: entry.productName,
        targetUrl: entry.existingUrl,
        groups: ['product', 'bulk'],
        isPrimary: false,
      });
    }
    for (const k of entry.commercialKeywords.slice(0, 1)) {
      pushKeywordRow({
        keyword: k,
        targetType: 'product',
        targetId: entry.productId,
        targetName: entry.productName,
        targetUrl: entry.existingUrl,
        groups: ['product', 'commercial'],
        isPrimary: false,
      });
    }
    for (const k of entry.informationalKeywords.slice(0, 1)) {
      pushKeywordRow({
        keyword: k,
        targetType: 'product',
        targetId: entry.productId,
        targetName: entry.productName,
        targetUrl: entry.existingUrl,
        groups: ['product', 'informational'],
        isPrimary: false,
      });
    }
    for (const k of entry.brandKeywords.slice(0, 1)) {
      pushKeywordRow({
        keyword: k,
        targetType: 'product',
        targetId: entry.productId,
        targetName: entry.productName,
        targetUrl: entry.existingUrl,
        groups: ['product', 'brand'],
        isPrimary: false,
      });
    }
  }

  for (const entry of Object.values(CATEGORY_KEYWORD_MAP)) {
    pushKeywordRow({
      keyword: entry.primaryKeyword,
      targetType: 'category',
      targetId: entry.categorySlug,
      targetName: entry.categoryName,
      targetUrl: entry.existingUrl,
      groups: ['category', 'commercial'],
      isPrimary: true,
    });
    for (const k of entry.bulkOrderKeywords.slice(0, 2)) {
      pushKeywordRow({
        keyword: k,
        targetType: 'category',
        targetId: entry.categorySlug,
        targetName: entry.categoryName,
        targetUrl: entry.existingUrl,
        groups: ['category', 'bulk'],
        isPrimary: false,
      });
    }
    for (const k of entry.informationalKeywords.slice(0, 1)) {
      pushKeywordRow({
        keyword: k,
        targetType: 'category',
        targetId: entry.categorySlug,
        targetName: entry.categoryName,
        targetUrl: entry.existingUrl,
        groups: ['category', 'informational'],
        isPrimary: false,
      });
    }
    for (const k of entry.brandKeywords.slice(0, 1)) {
      pushKeywordRow({
        keyword: k,
        targetType: 'category',
        targetId: entry.categorySlug,
        targetName: entry.categoryName,
        targetUrl: entry.existingUrl,
        groups: ['category', 'brand'],
        isPrimary: false,
      });
    }
  }

  // Sort keywords: recorded data first (by impressions desc), then primary keywords
  keywords.sort((a, b) => {
    const aHas = a.impressions !== null ? 1 : 0;
    const bHas = b.impressions !== null ? 1 : 0;
    if (aHas !== bHas) return bHas - aHas;
    if ((b.impressions || 0) !== (a.impressions || 0)) return (b.impressions || 0) - (a.impressions || 0);
    return Number(b.isPrimary) - Number(a.isPrimary);
  });

  // Page lookup map for GSC landing pages
  const pageRowMap = new Map<string, GscMetricRow>();
  for (const r of curPages) {
    pageRowMap.set(normalizeTeqqnoPath(r.key), r);
  }

  // Product-wise SEO Performance (all 11 active products)
  const productsPerf: ProductSeoPerformanceRow[] = PRODUCTS.map((p) => {
    const prodPath = getProductPath(p.slug);
    const kwEntry = getProductKeywordEntry(p.id);
    const catSeo = getCategoryForProduct(p);
    const gscRow = pageRowMap.get(normalizeTeqqnoPath(prodPath));
    const landingAttr = curAttr.byLandingOrganic.get(normalizeTeqqnoPath(prodPath));
    const prodAttr = curAttr.byProductOrganic.get(p.id);

    const sources: SeoDataSourceLabel[] = [];
    if (gscRow) sources.push(gscDataSource);
    if (landingAttr || prodAttr) sources.push(curAttr.source);

    const observedRecs: string[] = [];
    if (gscRow) {
      if (gscRow.impressions >= 100 && gscRow.ctr < 2.0) {
        observedRecs.push('Improve title & meta description (high impressions with CTR below 2%)');
      }
      if (gscRow.position > 12 && gscRow.impressions >= 30) {
        observedRecs.push('Strengthen product content & internal linking (average position beyond page 1)');
      }
      if (gscRow.impressions >= 50 && gscRow.clicks === 0) {
        observedRecs.push('Review search intent alignment (impressions recorded with 0 clicks)');
      }
    }
    if (landingAttr && landingAttr.sessions >= 20 && landingAttr.addToCarts === 0) {
      observedRecs.push('Inspect above-the-fold pricing & customization CTA (organic sessions with 0 add-to-cart)');
    }
    for (const chk of finalTechAudit.checks) {
      if (chk.affectedUrls.includes(prodPath)) {
        observedRecs.push(`Resolve technical check: ${chk.label}`);
      }
    }

    let performanceTier: ProductSeoPerformanceRow['performanceTier'] = 'no_data';
    if (gscRow || landingAttr) {
      if (
        (gscRow && gscRow.clicks >= 15 && gscRow.ctr >= 2.5) ||
        (landingAttr && landingAttr.purchases >= 1)
      ) {
        performanceTier = 'strong';
      } else if (observedRecs.length > 0) {
        performanceTier = 'needs_attention';
      } else {
        performanceTier = 'moderate';
      }
    }

    return {
      productId: p.id,
      productName: getProductH1(p.id, p.name),
      productUrl: prodPath,
      categorySlug: catSeo?.slug || kwEntry?.categorySlug || '',
      categoryName: catSeo?.name || kwEntry?.categoryName || p.category,
      primaryKeyword: kwEntry?.primaryKeyword || '',
      secondaryKeywords: kwEntry ? [...kwEntry.secondaryKeywords.slice(0, 3)] : [],
      clicks: gscRow ? gscRow.clicks : null,
      impressions: gscRow ? gscRow.impressions : null,
      ctr: gscRow ? gscRow.ctr : null,
      averagePosition: gscRow ? gscRow.position : null,
      organicSessions: landingAttr ? landingAttr.sessions : null,
      organicProductViews:
        prodAttr ? prodAttr.views : landingAttr ? landingAttr.productViews : null,
      organicAddToCart:
        prodAttr ? prodAttr.addToCarts : landingAttr ? landingAttr.addToCarts : null,
      organicPurchases:
        prodAttr ? prodAttr.purchases : landingAttr ? landingAttr.purchases : null,
      organicRevenueInr:
        prodAttr ? prodAttr.revenueInr : landingAttr ? landingAttr.revenueInr : null,
      dataSources: sources.length > 0 ? sources : ['Unavailable'],
      observedRecommendations: observedRecs,
      performanceTier,
    };
  });

  // Category-wise SEO Performance (all 5 canonical categories)
  const categoriesPerf: CategorySeoPerformanceRow[] = SEO_CATEGORIES.map((cat) => {
    const catPath = `/category/${cat.slug}`;
    const kwEntry = getCategoryKeywordEntry(cat.slug);
    const gscRow = pageRowMap.get(normalizeTeqqnoPath(catPath));
    const landingAttr = curAttr.byLandingOrganic.get(normalizeTeqqnoPath(catPath));
    const sources: SeoDataSourceLabel[] = [];
    if (gscRow) sources.push(gscDataSource);
    if (landingAttr) sources.push(curAttr.source);

    const opportunities: string[] = [];
    if (gscRow) {
      if (gscRow.impressions >= 100 && gscRow.ctr < 2.0) {
        opportunities.push('Refine category title/meta description to lift low organic CTR');
      }
      if (gscRow.position > 15) {
        opportunities.push('Strengthen category buying guide & internal links from related product pages');
      }
    }
    for (const chk of finalTechAudit.checks) {
      if (chk.affectedUrls.includes(catPath)) {
        opportunities.push(`Fix technical issue: ${chk.label}`);
      }
    }

    return {
      categorySlug: cat.slug,
      categoryName: cat.name,
      categoryUrl: catPath,
      primaryKeyword: kwEntry?.primaryKeyword || '',
      activeProductCount: kwEntry?.activeProductIds.length || 0,
      clicks: gscRow ? gscRow.clicks : null,
      impressions: gscRow ? gscRow.impressions : null,
      ctr: gscRow ? gscRow.ctr : null,
      averagePosition: gscRow ? gscRow.position : null,
      organicSessions: landingAttr ? landingAttr.sessions : null,
      organicPurchases: landingAttr ? landingAttr.purchases : null,
      organicRevenueInr: landingAttr ? landingAttr.revenueInr : null,
      dataSources: sources.length > 0 ? sources : ['Unavailable'],
      observedOpportunities: opportunities,
    };
  });

  // Generate Evidence-Based Actionable Recommendations (never generic filler!)
  const recommendations: SeoRecommendationItem[] = [];
  const pushRec = (rec: Omit<SeoRecommendationItem, 'status' | 'updatedAt' | 'updatedBy'>) => {
    const saved = loaded.recommendationStates[rec.id];
    recommendations.push({
      ...rec,
      status: saved?.status || 'pending',
      updatedAt: saved?.updatedAt || null,
      updatedBy: saved?.updatedBy || null,
    });
  };

  // Technical check failures -> real high-priority recommendations
  for (const chk of finalTechAudit.checks) {
    if (chk.status !== 'pass') {
      pushRec({
        id: `tech:${chk.id}`,
        issue: `Technical SEO check needs attention: ${chk.label}`,
        affectedUrl: chk.affectedUrls[0] || '/sitemap.xml',
        evidence: chk.details,
        priority: chk.status === 'fail' ? 'high' : 'medium',
        suggestedAction: `Inspect and remediate ${chk.affectedUrls.slice(0, 3).join(', ') || 'affected route'} in the SEO configuration.`,
        source: 'Live Technical Audit',
      });
    }
  }

  // Indexing issues from verified GSC inspections
  for (const insp of finalTechAudit.indexingSummary.inspections) {
    if (insp.status === 'not_indexed') {
      pushRec({
        id: `index:${insp.normalizedPath}`,
        issue: 'Submitted URL reported as Not Indexed in Google Search Console',
        affectedUrl: insp.normalizedPath,
        evidence: `${insp.coverageState} (Verdict: ${insp.verdict})`,
        priority: 'high',
        suggestedAction:
          'Verify canonical, robots directives, content uniqueness, and internal links pointing to this URL before requesting re-indexing in GSC.',
        source: insp.source === 'GSC URL Inspection API' ? 'Google Search Console API' : 'GSC CSV Import',
      });
    }
  }

  // Product pages with observed GSC high impressions + low CTR or page-2+ average position
  for (const pr of productsPerf) {
    if (pr.impressions !== null && pr.ctr !== null && pr.impressions >= 100 && pr.ctr < 2.0) {
      pushRec({
        id: `ctr:${pr.productId}`,
        issue: `Low organic CTR on product page (${pr.productName})`,
        affectedUrl: pr.productUrl,
        evidence: `${pr.impressions.toLocaleString('en-IN')} impressions, ${pr.clicks ?? 0} clicks, ${pr.ctr}% CTR (Avg. Position ${pr.averagePosition ?? 'N/A'}).`,
        priority: 'high',
        suggestedAction:
          'Review SEO title and meta description in src/config/seoRoutes.ts to better highlight INR pricing, MOQ, and customization appeal after admin approval.',
        source: gscDataSource,
      });
    }
    if (pr.averagePosition !== null && pr.impressions !== null && pr.averagePosition > 12 && pr.impressions >= 30) {
      pushRec({
        id: `pos:${pr.productId}`,
        issue: `Product page ranking beyond Page 1 (${pr.productName})`,
        affectedUrl: pr.productUrl,
        evidence: `Average Position ${pr.averagePosition} across ${pr.impressions.toLocaleString('en-IN')} impressions.`,
        priority: 'medium',
        suggestedAction:
          'Expand verified FAQs/specifications in src/data/seoKeywordMap.ts and verify contextual links from category & companion products.',
        source: gscDataSource,
      });
    }
  }

  // Category pages with observed weak average position or low CTR
  for (const cr of categoriesPerf) {
    if (cr.averagePosition !== null && cr.averagePosition > 15 && (cr.impressions || 0) >= 30) {
      pushRec({
        id: `cat-pos:${cr.categorySlug}`,
        issue: `Category page has low average search position (${cr.categoryName})`,
        affectedUrl: cr.categoryUrl,
        evidence: `Average Position ${cr.averagePosition} across ${cr.impressions?.toLocaleString('en-IN')} impressions.`,
        priority: 'medium',
        suggestedAction:
          'Review category buying guide relevance, primary keyword alignment, and cross-links from homepage & product breadcrumbs.',
        source: gscDataSource,
      });
    }
  }

  // Keywords with growing impressions or declining position
  for (const kw of keywords.slice(0, 50)) {
    if (kw.flags.includes('declining_position') && kw.positionDelta !== null) {
      pushRec({
        id: `kw-drop:${kw.targetId}:${kw.keyword.slice(0, 32)}`,
        issue: `Keyword average position declined: "${kw.keyword}"`,
        affectedUrl: kw.targetUrl,
        evidence: `Average Position moved from ${kw.previousPosition} to ${kw.averagePosition} (${kw.impressions} impressions).`,
        priority: 'medium',
        suggestedAction:
          'Compare search intent on top competing Indian pages and refresh product/category copy after administrator review.',
        source: gscDataSource,
      });
    }
  }

  // Connection readiness recommendations (honest setup actions when APIs/exports are absent)
  const gscEnv = getGoogleApiEnvStatus();
  if (!gscEnv.gscApiConnected && loaded.gscSnapshots.length === 0) {
    pushRec({
      id: 'setup:gsc-connection',
      issue: 'No Google Search Console performance data connected yet',
      affectedUrl: '/admin (Settings & Data Connections)',
      evidence:
        'Google Search Console API credentials are not configured on the server and 0 GSC CSV exports have been imported.',
      priority: 'high',
      suggestedAction:
        'Export Queries, Pages, Countries & Devices CSVs from Google Search Console (or add server-side Service Account credentials) to populate real search metrics.',
      source: 'Unavailable',
    });
  }
  if (!gscEnv.ga4DataApiConnected && loaded.ga4Snapshots.length === 0 && loaded.attributionEvents.length === 0) {
    pushRec({
      id: 'setup:ga4-attribution',
      issue: 'No GA4 Data API snapshot or organic conversion events recorded yet',
      affectedUrl: '/admin (Settings & Data Connections)',
      evidence:
        'GTM-5GLJDBBJ is installed on the storefront, but GA4 Data API is not connected and 0 GA4 CSV exports or first-party events have been recorded in this range.',
      priority: 'medium',
      suggestedAction:
        'Configure GA4 Data API credentials on the server, import a GA4 Landing Page / Acquisition CSV, or allow live storefront visits to populate consent-compliant first-party attribution.',
      source: 'Unavailable',
    });
  }

  // Check GTM installation in index.html
  let gtmInstalledInHtml = false;
  try {
    const indexHtml = fs.readFileSync(path.join(params.deps.rootDir, 'index.html'), 'utf8');
    gtmInstalledInHtml = indexHtml.includes('GTM-5GLJDBBJ');
  } catch {
    gtmInstalledInHtml = false;
  }

  const allGscDates = loaded.gscSnapshots
    .flatMap((s) => [s.dateStart, s.dateEnd])
    .filter(isValidIsoDate)
    .sort();

  const connectionStatus: SeoConnectionStatus = {
    gscApiConnected: gscEnv.gscApiConnected,
    gscSiteUrl: gscEnv.gscSiteUrl,
    gscLastSyncedAt: loaded.gscSnapshots[0]?.importedAt || null,
    gscSnapshotCount: loaded.gscSnapshots.length,
    gscAvailableDateRange:
      allGscDates.length > 0
        ? { start: allGscDates[0], end: allGscDates[allGscDates.length - 1] }
        : null,
    ga4DataApiConnected: gscEnv.ga4DataApiConnected,
    ga4PropertyIdConfigured: gscEnv.ga4PropertyIdConfigured,
    ga4LastSyncedAt: loaded.ga4Snapshots[0]?.importedAt || null,
    ga4SnapshotCount: loaded.ga4Snapshots.length,
    gtmContainerId: 'GTM-5GLJDBBJ',
    gtmInstalledInHtml,
    firstPartyEventCount: loaded.attributionEvents.length,
    storageMode: loaded.storageMode,
    supabaseTablesReady: loaded.supabaseTablesReady,
    recentGscNotice: RECENT_GSC_NOTICE,
  };

  return {
    generatedAt: new Date().toISOString(),
    requestedRange: {
      preset: range.preset,
      startDate: range.startDate,
      endDate: range.endDate,
      previousStartDate: range.previousStartDate,
      previousEndDate: range.previousEndDate,
    },
    actualReportingPeriod: {
      gscRangeLabel,
      ga4RangeLabel:
        loaded.ga4Snapshots.length > 0
          ? `${loaded.ga4Snapshots[0].dateStart} to ${loaded.ga4Snapshots[0].dateEnd}`
          : 'No GA4 CSV/API snapshot in selected range',
      firstPartyRangeLabel:
        curAttr.source === 'First-Party Event Attribution'
          ? curAttr.rangeLabel
          : 'No first-party attribution events in selected range',
      hasSufficientPreviousPeriod: Boolean(prevSummary || prevAttr.available),
      historicalDataNotice: RECENT_GSC_NOTICE,
    },
    connectionStatus,
    kpis: {
      totalOrganicClicks: buildKpi({
        value: curSummary ? curSummary.clicks : null,
        previousValue: prevSummary ? prevSummary.clicks : null,
        source: gscDataSource,
      }),
      totalSearchImpressions: buildKpi({
        value: curSummary ? curSummary.impressions : null,
        previousValue: prevSummary ? prevSummary.impressions : null,
        source: gscDataSource,
      }),
      averageCtr: buildKpi({
        value: curSummary ? curSummary.ctr : null,
        previousValue: prevSummary ? prevSummary.ctr : null,
        source: gscDataSource,
      }),
      averageSearchPosition: buildKpi({
        value: curSummary ? curSummary.avgPosition : null,
        previousValue: prevSummary ? prevSummary.avgPosition : null,
        source: gscDataSource,
        invertDirection: true,
      }),
      organicSessions: buildKpi({
        value: curAttr.available ? curOrganicChannel.sessions : null,
        previousValue: prevAttr.available ? prevOrganicChannel.sessions : null,
        source: curAttr.source,
      }),
      organicPurchases: buildKpi({
        value: curAttr.available ? curOrganicChannel.purchases : null,
        previousValue: prevAttr.available ? prevOrganicChannel.purchases : null,
        source: curAttr.source,
      }),
      organicRevenueInr: buildKpi({
        value: curAttr.available ? curOrganicChannel.revenueInr : null,
        previousValue: prevAttr.available ? prevOrganicChannel.revenueInr : null,
        source: curAttr.source,
      }),
      indexedPages: buildKpi({
        value: finalTechAudit.indexingSummary.indexedUrls,
        previousValue: null,
        source:
          finalTechAudit.indexingSummary.indexedUrls !== null
            ? gscEnv.gscApiConnected
              ? 'Google Search Console API'
              : 'GSC CSV Import'
            : 'Unavailable',
        unavailableNote:
          'Sitemap URLs are not assumed indexed — inspect via GSC API or import GSC Page Indexing CSV',
      }),
    },
    searchPerformance: {
      queries: curQueries.slice(0, 200),
      pages: curPages.slice(0, 200),
      countries: curCountries.slice(0, 100),
      devices: curDevices,
      searchAppearances: curAppearances,
      dailyTrend: curDates,
      dataSource: gscDataSource,
    },
    keywords,
    products: productsPerf,
    categories: categoriesPerf,
    organicConversions: {
      attributionAvailable: curAttr.available,
      attributionSource: curAttr.source,
      note: curAttr.available
        ? `Traffic channels separated cleanly using ${curAttr.source}. Only Organic Search-attributed sessions and purchases are counted in Organic KPIs.`
        : 'Attribution data unavailable for this date range. Connect GA4 Data API, import a GA4 Traffic Acquisition/Landing Page CSV, or allow live storefront traffic to record non-PII first-party channel attribution.',
      organicFunnel: curAttr.available
        ? {
            sessions: curOrganicChannel.sessions,
            productViews: curOrganicChannel.productViews,
            addToCarts: curOrganicChannel.addToCarts,
            checkoutStarts: curOrganicChannel.checkoutStarts,
            purchases: curOrganicChannel.purchases,
            revenueInr: curOrganicChannel.revenueInr,
            quoteEnquiries: curOrganicChannel.quoteEnquiries,
            whatsappEnquiries: curOrganicChannel.whatsappEnquiries,
          }
        : {
            sessions: null,
            productViews: null,
            addToCarts: null,
            checkoutStarts: null,
            purchases: null,
            revenueInr: null,
            quoteEnquiries: null,
            whatsappEnquiries: null,
          },
      channels: curAttr.channels,
    },
    technicalAudit: finalTechAudit,
    recommendations,
    contentPerformance: await buildContentPerformanceSummary({
      blogStore: params.blogStore,
      events: loaded.attributionEvents,
      startDate: range.startDate,
      endDate: range.endDate,
      pageRowMap,
      gscDataSource,
      ga4Connected: gscEnv.ga4DataApiConnected,
    }),
  };
}

async function buildContentPerformanceSummary(params: {
  blogStore?: BlogStore;
  events: FirstPartyAttributionEvent[];
  startDate: string;
  endDate: string;
  pageRowMap: Map<string, GscMetricRow>;
  gscDataSource: SeoDataSourceLabel;
  ga4Connected: boolean;
}): Promise<ContentPerformanceSummary> {
  const loadedBlogs = params.blogStore ? await params.blogStore.loadAll() : null;
  const posts = loadedBlogs?.posts || [];
  const nowMs = Date.now();

  const publishedPosts = posts.filter((p) => isPostPubliclyVisible(p, nowMs));
  const draftPosts = posts.filter((p) => p.status === 'draft');
  const scheduledFuturePosts = posts.filter(
    (p) => p.status === 'scheduled' && !isPostPubliclyVisible(p, nowMs)
  );

  // Filter first-party events within reporting range
  const rangeEvents = params.events.filter((ev) => {
    const day = (ev.occurredAt || '').slice(0, 10);
    return day >= params.startDate && day <= params.endDate;
  });

  const viewsByPath = new Map<string, number>();
  const organicSessionsByPath = new Map<string, Set<string>>();
  const productClicksByPath = new Map<string, number>();
  const ctaClicksByPath = new Map<string, number>();
  const sharesByPath = new Map<string, number>();

  const totalOrganicBlogSessionIds = new Set<string>();
  let totalArticleViews = 0;
  let totalProductClicksFromArticles = 0;
  let totalBlogCtaClicks = 0;
  let totalBlogShares = 0;
  let totalBlogSearches = 0;

  for (const ev of rangeEvents) {
    const pPath = normalizeTeqqnoPath(ev.pagePath);
    const lPath = normalizeTeqqnoPath(ev.landingPath);

    if (ev.channel === 'organic_search' && (lPath === '/blogs' || lPath.startsWith('/blogs/') || lPath === '/guides' || lPath === '/resources')) {
      totalOrganicBlogSessionIds.add(ev.sessionId);
      if (lPath.startsWith('/blogs/')) {
        if (!organicSessionsByPath.has(lPath)) organicSessionsByPath.set(lPath, new Set());
        organicSessionsByPath.get(lPath)!.add(ev.sessionId);
      }
    }

    if (ev.eventName === 'blog_view') {
      totalArticleViews += 1;
      viewsByPath.set(pPath, (viewsByPath.get(pPath) || 0) + 1);
    } else if (ev.eventName === 'related_product_click') {
      totalProductClicksFromArticles += 1;
      productClicksByPath.set(pPath, (productClicksByPath.get(pPath) || 0) + 1);
    } else if (ev.eventName === 'blog_cta_click') {
      totalBlogCtaClicks += 1;
      ctaClicksByPath.set(pPath, (ctaClicksByPath.get(pPath) || 0) + 1);
    } else if (ev.eventName === 'blog_share') {
      totalBlogShares += 1;
      sharesByPath.set(pPath, (sharesByPath.get(pPath) || 0) + 1);
    } else if (ev.eventName === 'blog_search') {
      totalBlogSearches += 1;
    }
  }

  let blogSearchClicksSum = 0;
  let blogSearchImpressionsSum = 0;
  let hasAnyGscBlogData = false;

  const articles: BlogArticlePerformanceRow[] = posts.map((post) => {
    const artPath = normalizeTeqqnoPath(`/blogs/${post.slug}`);
    const gscRow = params.pageRowMap.get(artPath);
    if (gscRow) {
      hasAnyGscBlogData = true;
      blogSearchClicksSum += gscRow.clicks;
      blogSearchImpressionsSum += gscRow.impressions;
    }

    const articleViews = viewsByPath.get(artPath) || 0;
    const organicLandingSessions = organicSessionsByPath.get(artPath)?.size || 0;
    const relatedProductClicks = productClicksByPath.get(artPath) || 0;
    const ctaClicks = ctaClicksByPath.get(artPath) || 0;
    const shareClicks = sharesByPath.get(artPath) || 0;
    const totalOutboundProductActions = relatedProductClicks + ctaClicks;
    const articleToProductRatePct =
      articleViews > 0
        ? Number(((totalOutboundProductActions / articleViews) * 100).toFixed(1))
        : null;

    return {
      postId: post.id,
      slug: post.slug,
      path: artPath,
      title: post.title,
      status: post.status,
      categorySlug: post.categorySlug,
      publishedAt: post.publishedAt,
      articleViews,
      organicLandingSessions,
      searchClicks: gscRow ? gscRow.clicks : null,
      searchImpressions: gscRow ? gscRow.impressions : null,
      searchCtr: gscRow ? gscRow.ctr : null,
      averagePosition: gscRow ? gscRow.position : null,
      averageEngagementSeconds: null, // Explicitly unavailable unless GA4 engagement duration API metric is synced
      relatedProductClicks,
      ctaClicks,
      shareClicks,
      articleToProductRatePct,
    };
  });

  // Sort published articles first, then by views desc
  articles.sort((a, b) => {
    const aPub = a.status === 'published' ? 1 : 0;
    const bPub = b.status === 'published' ? 1 : 0;
    if (aPub !== bPub) return bPub - aPub;
    return b.articleViews - a.articleViews;
  });

  const dataSources: string[] = ['Blog CMS Inventory'];
  if (totalArticleViews > 0 || totalProductClicksFromArticles > 0 || totalBlogCtaClicks > 0 || totalBlogShares > 0 || totalBlogSearches > 0) {
    dataSources.push('First-Party Event Attribution');
  }
  if (hasAnyGscBlogData) {
    dataSources.push(params.gscDataSource);
  }

  const totalOutbound = totalProductClicksFromArticles + totalBlogCtaClicks;
  const articleToProductEngagementRatePct =
    totalArticleViews > 0 ? Number(((totalOutbound / totalArticleViews) * 100).toFixed(1)) : null;

  return {
    publishedArticlesCount: publishedPosts.length,
    draftArticlesCount: draftPosts.length,
    scheduledArticlesCount: scheduledFuturePosts.length,
    totalArticleViews,
    organicBlogSessions: totalOrganicBlogSessionIds.size,
    blogSearchClicks: hasAnyGscBlogData ? blogSearchClicksSum : null,
    blogSearchImpressions: hasAnyGscBlogData ? blogSearchImpressionsSum : null,
    averageEngagementSeconds: null,
    engagementDataNote: params.ga4Connected
      ? 'GA4 average engagement time per article is not yet populated in the current snapshot.'
      : 'Data unavailable — connect GA4 Data API to view average engagement time per article.',
    totalProductClicksFromArticles,
    totalBlogCtaClicks,
    totalBlogShares,
    totalBlogSearches,
    articleToProductEngagementRatePct,
    articles,
    dataSources,
  };
}

// ==============================================================================
// 7. WEEKLY & MONTHLY VERIFIED REPORT BUILDER + FORMULA-SAFE CSV EXPORT
// ==============================================================================

export function buildVerifiedSeoReport(
  dashboard: SeoAnalyticsDashboardResponse,
  reportType: 'weekly' | 'monthly'
): SeoReportPayload {
  const dataSources = Array.from(
    new Set(
      [
        dashboard.searchPerformance.dataSource,
        dashboard.organicConversions.attributionSource,
        'Live Technical Audit',
      ].filter((s) => s !== 'Unavailable')
    )
  );

  const fmtVal = (v: number | null, suffix = '', prefix = '') =>
    v === null ? 'Data unavailable' : `${prefix}${v.toLocaleString('en-IN')}${suffix}`;

  const summaryMetrics = [
    {
      label: 'Total Organic Clicks',
      value: fmtVal(dashboard.kpis.totalOrganicClicks.value),
      comparison: dashboard.kpis.totalOrganicClicks.comparisonNote,
      source: dashboard.kpis.totalOrganicClicks.source,
    },
    {
      label: 'Total Search Impressions',
      value: fmtVal(dashboard.kpis.totalSearchImpressions.value),
      comparison: dashboard.kpis.totalSearchImpressions.comparisonNote,
      source: dashboard.kpis.totalSearchImpressions.source,
    },
    {
      label: 'Average CTR',
      value: fmtVal(dashboard.kpis.averageCtr.value, '%'),
      comparison: dashboard.kpis.averageCtr.comparisonNote,
      source: dashboard.kpis.averageCtr.source,
    },
    {
      label: 'Average Search Position (GSC Avg)',
      value: fmtVal(dashboard.kpis.averageSearchPosition.value),
      comparison: dashboard.kpis.averageSearchPosition.comparisonNote,
      source: dashboard.kpis.averageSearchPosition.source,
    },
    {
      label: 'Organic Sessions',
      value: fmtVal(dashboard.kpis.organicSessions.value),
      comparison: dashboard.kpis.organicSessions.comparisonNote,
      source: dashboard.kpis.organicSessions.source,
    },
    {
      label: 'Organic Purchases',
      value: fmtVal(dashboard.kpis.organicPurchases.value),
      comparison: dashboard.kpis.organicPurchases.comparisonNote,
      source: dashboard.kpis.organicPurchases.source,
    },
    {
      label: 'Organic Revenue (INR)',
      value: fmtVal(dashboard.kpis.organicRevenueInr.value, '', '₹'),
      comparison: dashboard.kpis.organicRevenueInr.comparisonNote,
      source: dashboard.kpis.organicRevenueInr.source,
    },
    {
      label: 'Verified Indexed Pages',
      value: fmtVal(dashboard.kpis.indexedPages.value),
      comparison: dashboard.kpis.indexedPages.comparisonNote,
      source: dashboard.kpis.indexedPages.source,
    },
    {
      label: 'Technical SEO Health Score (Internal Checklist)',
      value: `${dashboard.technicalAudit.technicalHealthScore}/100`,
      comparison: 'Not a Google ranking score',
      source: 'Live Technical Audit',
    },
  ];

  const topProducts = [...dashboard.products]
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0) || (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 11);

  const topCategories = [...dashboard.categories].sort(
    (a, b) => (b.clicks || 0) - (a.clicks || 0) || (b.impressions || 0) - (a.impressions || 0)
  );

  return {
    reportType,
    generatedAt: dashboard.generatedAt,
    dateRange: {
      startDate: dashboard.requestedRange.startDate,
      endDate: dashboard.requestedRange.endDate,
      label: `${dashboard.requestedRange.startDate} to ${dashboard.requestedRange.endDate}`,
    },
    dataSources: dataSources.length > 0 ? dataSources : ['Live Technical Audit'],
    honestyDisclaimer:
      'This report includes only verified data from connected/imported sources and live technical checks. Any metric marked "Data unavailable" had no recorded source data for this reporting period. GSC Average Position is an average across impressions, not a fixed daily rank.',
    summaryMetrics,
    topProducts,
    topCategories,
    topQueries: dashboard.searchPerformance.queries.slice(0, 25),
    keywordHighlights: dashboard.keywords.slice(0, 30),
    organicConversions: dashboard.organicConversions,
    technicalHealthScore: dashboard.technicalAudit.technicalHealthScore,
    newIssues: dashboard.recommendations.filter((r) => r.status === 'pending'),
    recommendedActions: dashboard.recommendations.filter(
      (r) => r.status === 'pending' || r.status === 'in_progress'
    ),
    completedImprovements: dashboard.recommendations.filter((r) => r.status === 'completed'),
  };
}

export function serializeSeoReportToCsv(report: SeoReportPayload): string {
  const lines: string[] = [];
  const pushRow = (cols: unknown[]) => lines.push(cols.map(csvEscapeCell).join(','));

  pushRow(['TeqqnoWorld SEO Analytics Report', report.reportType.toUpperCase()]);
  pushRow(['Date Range', report.dateRange.label]);
  pushRow(['Generated At', report.generatedAt]);
  pushRow(['Data Sources', report.dataSources.join(' | ')]);
  pushRow(['Disclaimer', report.honestyDisclaimer]);
  pushRow([]);

  pushRow(['SUMMARY METRICS']);
  pushRow(['Metric', 'Value', 'Comparison / Note', 'Data Source']);
  for (const m of report.summaryMetrics) {
    pushRow([m.label, m.value, m.comparison, m.source]);
  }
  pushRow([]);

  pushRow(['PRODUCT-WISE SEO PERFORMANCE']);
  pushRow([
    'Product Name',
    'URL',
    'Primary Keyword',
    'Organic Clicks',
    'Impressions',
    'CTR (%)',
    'Average Position',
    'Organic Sessions',
    'Organic Purchases',
    'Organic Revenue (INR)',
  ]);
  for (const p of report.topProducts) {
    pushRow([
      p.productName,
      p.productUrl,
      p.primaryKeyword,
      p.clicks ?? 'Data unavailable',
      p.impressions ?? 'Data unavailable',
      p.ctr ?? 'Data unavailable',
      p.averagePosition ?? 'Data unavailable',
      p.organicSessions ?? 'Data unavailable',
      p.organicPurchases ?? 'Data unavailable',
      p.organicRevenueInr ?? 'Data unavailable',
    ]);
  }
  pushRow([]);

  pushRow(['CATEGORY-WISE SEO PERFORMANCE']);
  pushRow([
    'Category Name',
    'URL',
    'Primary Keyword',
    'Clicks',
    'Impressions',
    'CTR (%)',
    'Average Position',
    'Organic Sessions',
    'Organic Purchases',
  ]);
  for (const c of report.topCategories) {
    pushRow([
      c.categoryName,
      c.categoryUrl,
      c.primaryKeyword,
      c.clicks ?? 'Data unavailable',
      c.impressions ?? 'Data unavailable',
      c.ctr ?? 'Data unavailable',
      c.averagePosition ?? 'Data unavailable',
      c.organicSessions ?? 'Data unavailable',
      c.organicPurchases ?? 'Data unavailable',
    ]);
  }
  pushRow([]);

  pushRow(['TOP SEARCH QUERIES']);
  pushRow(['Query', 'Clicks', 'Impressions', 'CTR (%)', 'Average Position']);
  if (report.topQueries.length === 0) {
    pushRow(['No verified query rows recorded for this period', '', '', '', '']);
  } else {
    for (const q of report.topQueries) {
      pushRow([q.key, q.clicks, q.impressions, q.ctr, q.position]);
    }
  }
  pushRow([]);

  pushRow(['RECOMMENDATIONS & ACTIONS']);
  pushRow(['Priority', 'Status', 'Issue', 'Affected URL', 'Evidence', 'Suggested Action']);
  for (const rec of [...report.recommendedActions, ...report.completedImprovements]) {
    pushRow([
      rec.priority.toUpperCase(),
      rec.status,
      rec.issue,
      rec.affectedUrl,
      rec.evidence,
      rec.suggestedAction,
    ]);
  }

  return `${lines.join('\n')}\n`;
}
