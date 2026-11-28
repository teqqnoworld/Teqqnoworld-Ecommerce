import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Box,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Compass,
  FileBarChart2,
  Globe,
  Info,
  KeyRound,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import type {
  SeoAnalyticsDashboardResponse,
  SeoDatePreset,
  SeoKpiMetric,
} from '../../../types/seoAnalytics';
import { fetchSeoAnalyticsDashboard } from '../../../services/seoAnalyticsService';
import {
  CategorySeoTab,
  ContentPerformanceTab,
  DataConnectionsTab,
  KeywordTrackingTab,
  OrganicConversionsTab,
  ProductSeoTab,
  RecommendationsTab,
  SearchPerformanceTab,
  TechnicalIndexingTab,
  VerifiedReportTab,
} from './SeoAnalyticsSubViews';

type SeoDashboardTab =
  | 'overview'
  | 'search-performance'
  | 'keyword-tracking'
  | 'product-seo'
  | 'category-seo'
  | 'organic-conversions'
  | 'indexing-technical'
  | 'recommendations'
  | 'weekly-reports'
  | 'monthly-reports'
  | 'settings-connections'
  | 'content-performance';

interface AdminSeoAnalyticsPanelProps {
  onShowToast?: (message: string, tone?: 'success' | 'error') => void;
}

const TABS: Array<{ id: SeoDashboardTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: '1. Overview', icon: BarChart3 },
  { id: 'search-performance', label: '2. Search Performance', icon: Search },
  { id: 'keyword-tracking', label: '3. Keyword Tracking', icon: KeyRound },
  { id: 'product-seo', label: '4. Product SEO', icon: Box },
  { id: 'category-seo', label: '5. Category SEO', icon: Layers },
  { id: 'organic-conversions', label: '6. Organic Conversions', icon: TrendingUp },
  { id: 'indexing-technical', label: '7. Indexing & Technical SEO', icon: ShieldCheck },
  { id: 'recommendations', label: '8. SEO Recommendations', icon: ClipboardList },
  { id: 'weekly-reports', label: '9. Weekly Reports', icon: FileBarChart2 },
  { id: 'monthly-reports', label: '10. Monthly Reports', icon: Calendar },
  { id: 'settings-connections', label: '11. Settings & Data Connections', icon: Settings2 },
  { id: 'content-performance', label: '12. Content Performance', icon: BookOpen },
];

const DATE_PRESETS: Array<{ id: SeoDatePreset; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '28d', label: 'Last 28 days' },
  { id: '3m', label: 'Last 3 months' },
  { id: '6m', label: 'Last 6 months' },
  { id: '12m', label: 'Last 12 months' },
  { id: 'custom', label: 'Custom range' },
];

function KpiCard({
  code,
  label,
  metric,
  prefix = '',
  suffix = '',
  subtitle,
  invertGood = false,
}: {
  code: string;
  label: string;
  metric: SeoKpiMetric<number | null>;
  prefix?: string;
  suffix?: string;
  subtitle?: string;
  invertGood?: boolean;
}) {
  const isPositiveChange =
    metric.changePercent !== null &&
    (invertGood ? metric.changePercent < 0 : metric.changePercent > 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-[#FF7900]/40 transition-colors flex flex-col justify-between gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-semibold text-slate-500">{label}</span>
        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-mono font-bold text-[#071B35]">
          {code}
        </span>
      </div>

      <div>
        {metric.available && metric.value !== null ? (
          <div className="font-display text-2xl font-extrabold text-[#071B35] tabular-nums">
            {prefix}
            {metric.value.toLocaleString('en-IN')}
            {suffix}
          </div>
        ) : (
          <div className="text-sm font-semibold text-slate-400 py-1">Data unavailable</div>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
          {metric.changePercent !== null ? (
            <span
              className={`inline-flex items-center gap-0.5 font-mono font-bold px-1.5 py-0.5 rounded ${
                isPositiveChange
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              {metric.changePercent > 0 ? (
                <ArrowUpRight className="w-3 h-3" />
              ) : (
                <ArrowDownRight className="w-3 h-3" />
              )}
              {metric.changePercent > 0 ? `+${metric.changePercent}%` : `${metric.changePercent}%`}
            </span>
          ) : null}
          <span className="text-slate-500 truncate" title={metric.comparisonNote}>
            {metric.comparisonNote}
          </span>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <span>{subtitle || metric.source}</span>
        <span className="font-mono">{metric.source}</span>
      </div>
    </div>
  );
}

export const AdminSeoAnalyticsPanel: React.FC<AdminSeoAnalyticsPanelProps> = ({ onShowToast }) => {
  const [activeTab, setActiveTab] = useState<SeoDashboardTab>('overview');
  const [preset, setPreset] = useState<SeoDatePreset>('28d');
  const todayIso = new Date().toISOString().slice(0, 10);
  const weekAgoIso = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const [customStart, setCustomStart] = useState(weekAgoIso);
  const [customEnd, setCustomEnd] = useState(todayIso);

  const [data, setData] = useState<SeoAnalyticsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const notify = (msg: string, tone: 'success' | 'error' = 'success') => {
    onShowToast?.(msg, tone);
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSeoAnalyticsDashboard({
        preset,
        startDate: preset === 'custom' ? customStart : undefined,
        endDate: preset === 'custom' ? customEnd : undefined,
      });
      setData(res);
    } catch (err: any) {
      const msg = err?.message || 'Unable to load SEO Analytics dashboard.';
      setError(msg);
      notify(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  return (
    <div className="space-y-5">
      {/* Executive Header & Date Range Filter */}
      <div className="bg-gradient-to-r from-[#071B35] via-[#0B2344] to-[#071B35] text-white rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#FF7900] font-bold">
              <Globe className="w-3.5 h-3.5" />
              teqqnoworld.com · Pan-India Organic Search Monitoring
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">
              SEO Analytics &amp; Google Search Monitoring
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl">
              Real-data monitoring across Google Search Console, GA4 / first-party channel attribution,
              Phase 4 keyword mapping (11 products · 5 categories), and live technical SEO checks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings-connections')}
              className="px-3.5 py-2 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              Data Connections &amp; CSV Import
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  preset === p.id
                    ? 'bg-[#FF7900] text-white shadow-xs'
                    : 'bg-white/10 text-slate-200 hover:bg-white/20'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-white text-[#071B35] font-mono text-xs"
              />
              <span className="text-slate-300">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-white text-[#071B35] font-mono text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Honest GSC Recency & Actual Reporting Period Banner */}
      {data && (
        <div className="rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3 text-xs text-sky-950 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <div>
              <strong>Actual Available Reporting Period:</strong> GSC:{' '}
              <span className="font-mono">{data.actualReportingPeriod.gscRangeLabel}</span> · GA4:{' '}
              <span className="font-mono">{data.actualReportingPeriod.ga4RangeLabel}</span> ·
              First-Party: <span className="font-mono">{data.actualReportingPeriod.firstPartyRangeLabel}</span>
            </div>
            <div className="text-sky-900/90">{data.actualReportingPeriod.historicalDataNotice}</div>
          </div>
        </div>
      )}

      {/* 11-Section Sub-Navigation */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#071B35] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-[#071B35]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-[#FF7900]' : 'text-slate-400'}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-900 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Initial Loading State */}
      {loading && !data && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3 text-xs text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin text-[#FF7900]" />
          <span>Loading verified Google Search &amp; Technical SEO Analytics...</span>
        </div>
      )}

      {/* Active Tab Content */}
      {data && (
        <>
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* 8 Executive KPI Cards (A–H) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard
                  code="A"
                  label="Total Organic Clicks"
                  metric={data.kpis.totalOrganicClicks}
                />
                <KpiCard
                  code="B"
                  label="Total Search Impressions"
                  metric={data.kpis.totalSearchImpressions}
                />
                <KpiCard
                  code="C"
                  label="Average CTR"
                  metric={data.kpis.averageCtr}
                  suffix="%"
                />
                <KpiCard
                  code="D"
                  label="Average Search Position"
                  metric={data.kpis.averageSearchPosition}
                  subtitle="GSC Average Position (not fixed rank)"
                  invertGood
                />
                <KpiCard
                  code="E"
                  label="Organic Sessions"
                  metric={data.kpis.organicSessions}
                />
                <KpiCard
                  code="F"
                  label="Organic Purchases"
                  metric={data.kpis.organicPurchases}
                />
                <KpiCard
                  code="G"
                  label="Organic Revenue"
                  metric={data.kpis.organicRevenueInr}
                  prefix="₹"
                />
                <KpiCard
                  code="H"
                  label="Verified Indexed Pages"
                  metric={data.kpis.indexedPages}
                  subtitle={`${data.technicalAudit.indexingSummary.submittedUrls} submitted in sitemap`}
                />
              </div>

              {/* Technical SEO Health vs Search Performance Separation Card */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#071B35]">
                      Technical SEO Health Score
                    </span>
                    <span className="font-mono text-lg font-extrabold text-[#FF7900]">
                      {data.technicalAudit.technicalHealthScore}/100
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Based on 10 live on-site checks across all 11 products &amp; 5 categories
                    (sitemap, robots.txt, canonicals, titles, descriptions, H1, ALTs, links, JSON-LD).
                    Kept separate from Google Search rankings.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('indexing-technical')}
                    className="text-xs font-bold text-[#FF7900] hover:underline cursor-pointer"
                  >
                    Inspect Full Technical Audit →
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#071B35]">
                      Phase 4 Keyword Inventory Monitored
                    </span>
                    <span className="font-mono text-lg font-extrabold text-[#071B35]">
                      {data.keywords.length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tracking 16 unique non-cannibalizing primary keywords plus bulk, commercial,
                    brand &amp; informational clusters across all 11 products &amp; 5 categories.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('keyword-tracking')}
                    className="text-xs font-bold text-[#FF7900] hover:underline cursor-pointer"
                  >
                    Open Keyword Performance Table →
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#071B35]">
                      Open Actionable Recommendations
                    </span>
                    <span className="font-mono text-lg font-extrabold text-[#071B35]">
                      {data.recommendations.filter((r) => r.status === 'pending').length}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Every recommendation is backed by observed evidence from live technical checks,
                    GSC exports, or organic funnel metrics. No automatic content edits.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('recommendations')}
                    className="text-xs font-bold text-[#FF7900] hover:underline cursor-pointer"
                  >
                    Review Recommendations Center →
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'search-performance' && (
            <SearchPerformanceTab
              data={data}
              onGoToConnections={() => setActiveTab('settings-connections')}
            />
          )}

          {activeTab === 'keyword-tracking' && <KeywordTrackingTab data={data} />}

          {activeTab === 'product-seo' && <ProductSeoTab data={data} />}

          {activeTab === 'category-seo' && <CategorySeoTab data={data} />}

          {activeTab === 'organic-conversions' && <OrganicConversionsTab data={data} />}

          {activeTab === 'indexing-technical' && (
            <TechnicalIndexingTab
              data={data}
              onRefresh={() => void loadDashboard()}
              onToast={notify}
            />
          )}

          {activeTab === 'recommendations' && (
            <RecommendationsTab
              data={data}
              onRefresh={() => void loadDashboard()}
              onToast={notify}
            />
          )}

          {activeTab === 'weekly-reports' && (
            <VerifiedReportTab
              reportType="weekly"
              preset={preset}
              startDate={customStart}
              endDate={customEnd}
              onToast={notify}
            />
          )}

          {activeTab === 'monthly-reports' && (
            <VerifiedReportTab
              reportType="monthly"
              preset={preset}
              startDate={customStart}
              endDate={customEnd}
              onToast={notify}
            />
          )}

          {activeTab === 'settings-connections' && (
            <DataConnectionsTab
              data={data}
              preset={preset}
              startDate={customStart}
              endDate={customEnd}
              onRefresh={() => void loadDashboard()}
              onToast={notify}
            />
          )}

          {activeTab === 'content-performance' && (
            <ContentPerformanceTab
              data={data}
              onGoToConnections={() => setActiveTab('settings-connections')}
            />
          )}
        </>
      )}
    </div>
  );
};
