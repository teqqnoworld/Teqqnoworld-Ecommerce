// ==============================================================================
// TEQQNOWORLD PHASE 5 — SEO ANALYTICS & GOOGLE SEARCH MONITORING TYPES
// Shared between Express API (server/seoAnalyticsEngine.ts, server/seoAnalyticsRoutes.ts)
// and Admin Dashboard (src/components/admin/seo/*).
// ==============================================================================

import type { ContentPerformanceSummary } from './blog';

export type SeoDatePreset = '7d' | '28d' | '3m' | '6m' | '12m' | 'custom';

export type SeoDataSourceLabel =
  | 'Google Search Console API'
  | 'GSC CSV Import'
  | 'GA4 Data API'
  | 'GA4 CSV Import'
  | 'First-Party Event Attribution'
  | 'Live Technical Audit'
  | 'Unavailable';

export type TrafficChannel =
  | 'organic_search'
  | 'direct'
  | 'paid_search'
  | 'referral'
  | 'social';

export type AnalyticsEventName =
  | 'page_view'
  | 'view_item'
  | 'view_item_list'
  | 'select_item'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'generate_lead'
  | 'form_submit'
  | 'whatsapp_enquiry'
  | 'quote_request'
  | 'blog_view'
  | 'blog_category_view'
  | 'blog_search'
  | 'related_product_click'
  | 'blog_cta_click'
  | 'blog_share';

export type KeywordFilterGroup =
  | 'all'
  | 'product'
  | 'category'
  | 'brand'
  | 'bulk'
  | 'commercial'
  | 'informational';

export type RecommendationStatus = 'pending' | 'in_progress' | 'completed' | 'ignored';
export type RecommendationPriority = 'high' | 'medium' | 'low';

export interface GscMetricRow {
  key: string; // query, normalized pathname/url, country, device, searchAppearance, or YYYY-MM-DD
  clicks: number;
  impressions: number;
  ctr: number; // 0..100 percentage
  position: number; // GSC Average Position (not fixed rank)
}

export interface GscSnapshotRecord {
  id: string;
  propertyUrl: string;
  dateStart: string; // YYYY-MM-DD
  dateEnd: string; // YYYY-MM-DD
  dimension: 'query' | 'page' | 'country' | 'device' | 'search_appearance' | 'date';
  source: 'Google Search Console API' | 'GSC CSV Import';
  importedAt: string;
  importedBy: string;
  rows: GscMetricRow[];
}

export interface Ga4LandingRow {
  landingPath: string;
  channel: TrafficChannel;
  sessions: number;
  productViews: number;
  addToCarts: number;
  checkoutStarts: number;
  purchases: number;
  revenueInr: number;
  quoteEnquiries: number;
  whatsappEnquiries: number;
}

export interface Ga4SnapshotRecord {
  id: string;
  propertyId: string;
  dateStart: string;
  dateEnd: string;
  source: 'GA4 Data API' | 'GA4 CSV Import';
  importedAt: string;
  importedBy: string;
  rows: Ga4LandingRow[];
}

export interface UrlInspectionRecord {
  url: string;
  normalizedPath: string;
  status: 'indexed' | 'not_indexed' | 'unknown';
  coverageState: string;
  verdict: string;
  lastCrawlTime: string | null;
  source: 'GSC URL Inspection API' | 'GSC CSV Import' | 'Sitemap Only (Index Status Unknown)';
  checkedAt: string;
}

export interface FirstPartyAttributionEvent {
  id: string;
  eventName: AnalyticsEventName;
  eventKey?: string;
  transactionId?: string;
  sessionId: string;
  channel: TrafficChannel;
  landingPath: string;
  pagePath: string;
  productId?: string;
  productName?: string;
  categorySlug?: string;
  valueInr?: number;
  quantity?: number;
  sourceHost?: string;
  occurredAt: string;
}

export interface SeoKpiMetric<T = number | null> {
  value: T;
  available: boolean;
  previousValue: T;
  changePercent: number | null; // null when previous period has no valid data
  comparisonNote: string;
  source: SeoDataSourceLabel;
}

export interface KeywordPerformanceRow {
  keyword: string;
  targetType: 'product' | 'category';
  targetId: string;
  targetName: string;
  targetUrl: string;
  groups: Array<'product' | 'category' | 'brand' | 'bulk' | 'commercial' | 'informational'>;
  isPrimary: boolean;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null; // percentage 0..100
  averagePosition: number | null; // Explicitly Average Position, NOT fixed daily rank
  previousPosition: number | null;
  positionDelta: number | null; // positive = improved (lower numeric position)
  flags: Array<
    | 'impressions_few_clicks'
    | 'improving_position'
    | 'declining_position'
    | 'high_impressions_low_ctr'
    | 'no_recorded_data'
  >;
  searchVolume: 'Not verified';
  keywordDifficulty: 'Not verified';
  reportingPeriod: string;
  dataSource: SeoDataSourceLabel;
}

export interface ProductSeoPerformanceRow {
  productId: string;
  productName: string;
  productUrl: string;
  categorySlug: string;
  categoryName: string;
  primaryKeyword: string;
  secondaryKeywords: string[];
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  averagePosition: number | null;
  organicSessions: number | null;
  organicProductViews: number | null;
  organicAddToCart: number | null;
  organicPurchases: number | null;
  organicRevenueInr: number | null;
  dataSources: SeoDataSourceLabel[];
  observedRecommendations: string[];
  performanceTier: 'strong' | 'moderate' | 'needs_attention' | 'no_data';
}

export interface CategorySeoPerformanceRow {
  categorySlug: string;
  categoryName: string;
  categoryUrl: string;
  primaryKeyword: string;
  activeProductCount: number;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  averagePosition: number | null;
  organicSessions: number | null;
  organicPurchases: number | null;
  organicRevenueInr: number | null;
  dataSources: SeoDataSourceLabel[];
  observedOpportunities: string[];
}

export interface ChannelPerformanceRow {
  channel: TrafficChannel;
  label: string;
  sessions: number;
  productViews: number;
  addToCarts: number;
  checkoutStarts: number;
  purchases: number;
  revenueInr: number;
  quoteEnquiries: number;
  whatsappEnquiries: number;
}

export interface TechnicalSeoCheckItem {
  id: string;
  label: string;
  category: 'crawlability' | 'metadata' | 'content' | 'images' | 'links' | 'schema';
  status: 'pass' | 'warning' | 'fail';
  passedCount: number;
  totalCount: number;
  weight: number;
  earnedPoints: number;
  details: string;
  affectedUrls: string[];
}

export interface TechnicalSeoAuditResult {
  auditedAt: string;
  technicalHealthScore: number; // 0..100 strictly technical checks, NOT Google ranking score
  methodologyNote: string;
  sitemapAvailable: boolean;
  sitemapUrlCount: number;
  robotsTxtAvailable: boolean;
  checks: TechnicalSeoCheckItem[];
  indexingSummary: {
    submittedUrls: number;
    indexedUrls: number | null;
    notIndexedUrls: number | null;
    unknownUrls: number;
    urlInspectionApiConnected: boolean;
    note: string;
    inspections: UrlInspectionRecord[];
  };
}

export interface SeoRecommendationItem {
  id: string;
  issue: string;
  affectedUrl: string;
  evidence: string;
  priority: RecommendationPriority;
  suggestedAction: string;
  source: SeoDataSourceLabel;
  status: RecommendationStatus;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface SeoConnectionStatus {
  gscApiConnected: boolean;
  gscSiteUrl: string | null;
  gscLastSyncedAt: string | null;
  gscSnapshotCount: number;
  gscAvailableDateRange: { start: string; end: string } | null;
  ga4DataApiConnected: boolean;
  ga4PropertyIdConfigured: boolean;
  ga4LastSyncedAt: string | null;
  ga4SnapshotCount: number;
  gtmContainerId: string;
  gtmInstalledInHtml: boolean;
  firstPartyEventCount: number;
  storageMode: 'supabase' | 'local_dev_fallback';
  supabaseTablesReady: boolean;
  recentGscNotice: string;
}

export interface SeoAnalyticsDashboardResponse {
  generatedAt: string;
  requestedRange: {
    preset: SeoDatePreset;
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
  };
  actualReportingPeriod: {
    gscRangeLabel: string;
    ga4RangeLabel: string;
    firstPartyRangeLabel: string;
    hasSufficientPreviousPeriod: boolean;
    historicalDataNotice: string;
  };
  connectionStatus: SeoConnectionStatus;
  kpis: {
    totalOrganicClicks: SeoKpiMetric<number | null>;
    totalSearchImpressions: SeoKpiMetric<number | null>;
    averageCtr: SeoKpiMetric<number | null>;
    averageSearchPosition: SeoKpiMetric<number | null>;
    organicSessions: SeoKpiMetric<number | null>;
    organicPurchases: SeoKpiMetric<number | null>;
    organicRevenueInr: SeoKpiMetric<number | null>;
    indexedPages: SeoKpiMetric<number | null>;
  };
  searchPerformance: {
    queries: GscMetricRow[];
    pages: GscMetricRow[];
    countries: GscMetricRow[];
    devices: GscMetricRow[];
    searchAppearances: GscMetricRow[];
    dailyTrend: GscMetricRow[];
    dataSource: SeoDataSourceLabel;
  };
  keywords: KeywordPerformanceRow[];
  products: ProductSeoPerformanceRow[];
  categories: CategorySeoPerformanceRow[];
  organicConversions: {
    attributionAvailable: boolean;
    attributionSource: SeoDataSourceLabel;
    note: string;
    organicFunnel: {
      sessions: number | null;
      productViews: number | null;
      addToCarts: number | null;
      checkoutStarts: number | null;
      purchases: number | null;
      revenueInr: number | null;
      quoteEnquiries: number | null;
      whatsappEnquiries: number | null;
    };
    channels: ChannelPerformanceRow[];
  };
  technicalAudit: TechnicalSeoAuditResult;
  recommendations: SeoRecommendationItem[];
  contentPerformance?: ContentPerformanceSummary;
}

export interface SeoReportPayload {
  reportType: 'weekly' | 'monthly';
  generatedAt: string;
  dateRange: { startDate: string; endDate: string; label: string };
  dataSources: string[];
  honestyDisclaimer: string;
  summaryMetrics: Array<{ label: string; value: string; comparison: string; source: string }>;
  topProducts: ProductSeoPerformanceRow[];
  topCategories: CategorySeoPerformanceRow[];
  topQueries: GscMetricRow[];
  keywordHighlights: KeywordPerformanceRow[];
  organicConversions: SeoAnalyticsDashboardResponse['organicConversions'];
  technicalHealthScore: number;
  newIssues: SeoRecommendationItem[];
  recommendedActions: SeoRecommendationItem[];
  completedImprovements: SeoRecommendationItem[];
}
