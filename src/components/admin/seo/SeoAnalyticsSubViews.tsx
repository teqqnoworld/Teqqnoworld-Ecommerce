import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  Globe,
  Info,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  XCircle,
} from 'lucide-react';
import type {
  GscSnapshotRecord,
  KeywordFilterGroup,
  RecommendationStatus,
  SeoAnalyticsDashboardResponse,
  SeoDatePreset,
  SeoReportPayload,
} from '../../../types/seoAnalytics';
import {
  downloadSeoReportCsv,
  exportSeoReportPdf,
  fetchSeoReportJson,
  importGa4CsvApi,
  importGscCsvApi,
  inspectSingleUrlApi,
  syncGa4ApiNow,
  syncGscApiNow,
  updateRecommendationStatusApi,
} from '../../../services/seoAnalyticsService';

const fmtNum = (val: number | null | undefined, suffix = '', prefix = ''): string => {
  if (val === null || val === undefined || Number.isNaN(val)) return 'Data unavailable';
  return `${prefix}${val.toLocaleString('en-IN')}${suffix}`;
};

const FLAG_META: Record<string, { label: string; cls: string }> = {
  impressions_few_clicks: {
    label: 'Impressions · Few Clicks',
    cls: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  high_impressions_low_ctr: {
    label: 'High Impr. · Low CTR',
    cls: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  improving_position: {
    label: 'Improving Avg. Position',
    cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  declining_position: {
    label: 'Declining Avg. Position',
    cls: 'bg-red-50 text-red-800 border-red-200',
  },
  no_recorded_data: {
    label: 'No Recorded Data',
    cls: 'bg-slate-100 text-slate-600 border-slate-200',
  },
};

// ==============================================================================
// 2. SEARCH PERFORMANCE TAB
// ==============================================================================
export const SearchPerformanceTab: React.FC<{
  data: SeoAnalyticsDashboardResponse;
  onGoToConnections: () => void;
}> = ({ data, onGoToConnections }) => {
  const [dimTab, setDimTab] = useState<'queries' | 'pages' | 'countries' | 'devices' | 'appearances'>('queries');
  const [filterText, setFilterText] = useState('');

  const rows = useMemo(() => {
    const raw =
      dimTab === 'queries'
        ? data.searchPerformance.queries
        : dimTab === 'pages'
        ? data.searchPerformance.pages
        : dimTab === 'countries'
        ? data.searchPerformance.countries
        : dimTab === 'devices'
        ? data.searchPerformance.devices
        : data.searchPerformance.searchAppearances;

    const q = filterText.trim().toLowerCase();
    return q ? raw.filter((r) => r.key.toLowerCase().includes(q)) : raw;
  }, [data.searchPerformance, dimTab, filterText]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl border border-slate-200/90 p-4">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'queries', label: `Search Queries (${data.searchPerformance.queries.length})` },
            { id: 'pages', label: `Landing Pages (${data.searchPerformance.pages.length})` },
            { id: 'countries', label: `Countries (${data.searchPerformance.countries.length})` },
            { id: 'devices', label: `Devices (${data.searchPerformance.devices.length})` },
            { id: 'appearances', label: `Search Appearance (${data.searchPerformance.searchAppearances.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDimTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                dimTab === tab.id
                  ? 'bg-[#071B35] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter rows..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF7900]/30 focus:border-[#FF7900]"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
          <Globe className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-[#071B35]">
            No Google Search Console {dimTab} data recorded for this period
          </h3>
          <p className="text-xs text-slate-500 max-w-lg mx-auto">
            Actual GSC Reporting Period: <strong>{data.actualReportingPeriod.gscRangeLabel}</strong>.
            No synthetic or placeholder numbers are displayed. Import a GSC CSV export or configure
            server-side GSC API credentials to view verified search performance.
          </p>
          <button
            type="button"
            onClick={onGoToConnections}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] text-white text-xs font-semibold cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Import GSC CSV or Configure API
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <span>
              Source: <strong className="text-[#071B35]">{data.searchPerformance.dataSource}</strong> ·
              Period: <strong>{data.actualReportingPeriod.gscRangeLabel}</strong>
            </span>
            <span className="text-slate-500">
              Note: Average Position is GSC impression-weighted average, not a fixed daily rank.
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#071B35] text-white">
                <tr>
                  <th className="px-4 py-3 font-semibold capitalize">{dimTab === 'pages' ? 'Landing Page' : dimTab}</th>
                  <th className="px-4 py-3 font-semibold text-right">Clicks</th>
                  <th className="px-4 py-3 font-semibold text-right">Impressions</th>
                  <th className="px-4 py-3 font-semibold text-right">CTR</th>
                  <th className="px-4 py-3 font-semibold text-right">Average Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.slice(0, 100).map((r) => (
                  <tr key={r.key} className="hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-medium text-[#071B35] max-w-md truncate" title={r.key}>
                      {r.key}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#071B35]">
                      {r.clicks.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                      {r.impressions.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">{r.ctr}%</td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                      {r.position > 0 ? r.position.toFixed(1) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ==============================================================================
// 3. KEYWORD TRACKING TAB (PHASE 4 KEYWORD MAP CORRELATION)
// ==============================================================================
export const KeywordTrackingTab: React.FC<{ data: SeoAnalyticsDashboardResponse }> = ({ data }) => {
  const [groupFilter, setGroupFilter] = useState<KeywordFilterGroup>('all');
  const [flagFilter, setFlagFilter] = useState<string>('all');
  const [queryText, setQueryText] = useState('');

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return data.keywords.filter((row) => {
      if (groupFilter !== 'all' && !row.groups.includes(groupFilter)) return false;
      if (flagFilter !== 'all' && !row.flags.includes(flagFilter as any)) return false;
      if (
        q &&
        !row.keyword.toLowerCase().includes(q) &&
        !row.targetName.toLowerCase().includes(q) &&
        !row.targetUrl.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data.keywords, groupFilter, flagFilter, queryText]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-950 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <strong>Average Position Notice:</strong> Google Search Console <strong>Average Position</strong>{' '}
          is an impression-weighted average, not a fixed daily rank tracker. Keyword Search Volume and
          Keyword Difficulty remain explicitly marked <strong>Not verified</strong> (no fabricated estimates).
          Keywords are loaded directly from Phase 4 <code className="bg-amber-100 px-1 rounded">src/data/seoKeywordMap.ts</code>.
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'All Mapped Keywords'],
                ['product', 'Product Keywords'],
                ['category', 'Category Keywords'],
                ['brand', 'Brand Keywords'],
                ['bulk', 'Bulk-Order Keywords'],
                ['commercial', 'Commercial'],
                ['informational', 'Informational'],
              ] as Array<[KeywordFilterGroup, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setGroupFilter(id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                  groupFilter === id
                    ? 'bg-[#FF7900] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={flagFilter}
              onChange={(e) => setFlagFilter(e.target.value)}
              aria-label="Filter by performance signal"
              className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-white text-slate-700"
            >
              <option value="all">All Signals</option>
              <option value="high_impressions_low_ctr">High Impressions · Low CTR</option>
              <option value="impressions_few_clicks">Impressions · Few Clicks</option>
              <option value="improving_position">Improving Avg. Position</option>
              <option value="declining_position">Declining Avg. Position</option>
              <option value="no_recorded_data">No Recorded Performance Data</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="Search keyword or URL..."
                className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-52"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#071B35] text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Keyword</th>
                <th className="px-4 py-3 font-semibold">Target Product / Category</th>
                <th className="px-4 py-3 font-semibold">Target URL</th>
                <th className="px-4 py-3 font-semibold text-right">Clicks</th>
                <th className="px-4 py-3 font-semibold text-right">Impr.</th>
                <th className="px-4 py-3 font-semibold text-right">CTR</th>
                <th className="px-4 py-3 font-semibold text-right">Avg. Position</th>
                <th className="px-4 py-3 font-semibold">Signals / Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr key={`${row.targetUrl}-${row.keyword}`} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-[#071B35] flex items-center gap-1.5">
                      <span>{row.keyword}</span>
                      {row.isPrimary && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-orange-50 text-[#FF7900] border border-orange-200 font-bold">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Vol: {row.searchVolume} · KD: {row.keywordDifficulty}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{row.targetName}</div>
                    <div className="text-[10px] uppercase font-mono text-slate-400">{row.targetType}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{row.targetUrl}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-[#071B35]">
                    {row.clicks !== null ? row.clicks.toLocaleString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {row.impressions !== null ? row.impressions.toLocaleString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {row.ctr !== null ? `${row.ctr}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {row.averagePosition !== null ? (
                      <span className="inline-flex items-center gap-1">
                        {row.averagePosition.toFixed(1)}
                        {row.positionDelta !== null && row.positionDelta !== 0 && (
                          <span
                            className={`text-[10px] ${
                              row.positionDelta > 0 ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            ({row.positionDelta > 0 ? `+${row.positionDelta}` : row.positionDelta})
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.flags.map((fl) => (
                        <span
                          key={fl}
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${
                            FLAG_META[fl]?.cls || 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {FLAG_META[fl]?.label || fl}
                        </span>
                      ))}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {row.reportingPeriod} · {row.dataSource}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// 4. PRODUCT-WISE SEO TAB
// ==============================================================================
export const ProductSeoTab: React.FC<{ data: SeoAnalyticsDashboardResponse }> = ({ data }) => {
  const withData = data.products.filter((p) => p.clicks !== null || p.organicSessions !== null);
  const strongest = [...withData].sort(
    (a, b) => (b.clicks || 0) - (a.clicks || 0) || (b.organicSessions || 0) - (a.organicSessions || 0)
  )[0];
  const needsWork = data.products.find((p) => p.performanceTier === 'needs_attention');

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
          <div className="text-[11px] font-mono uppercase text-emerald-700 font-bold">
            Strongest Observed Product Page
          </div>
          {strongest ? (
            <div className="mt-1.5">
              <div className="font-bold text-sm text-[#071B35]">{strongest.productName}</div>
              <div className="text-xs text-slate-600 mt-0.5">
                {fmtNum(strongest.clicks)} clicks · {fmtNum(strongest.impressions)} impressions ·{' '}
                {fmtNum(strongest.organicSessions)} organic sessions
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-1.5">
              Insufficient verified search/organic session data to rank strongest product yet.
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
          <div className="text-[11px] font-mono uppercase text-[#FF7900] font-bold">
            Priority Product Opportunity (Observed)
          </div>
          {needsWork ? (
            <div className="mt-1.5">
              <div className="font-bold text-sm text-[#071B35]">{needsWork.productName}</div>
              <div className="text-xs text-slate-600 mt-0.5">
                {needsWork.observedRecommendations[0]}
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-1.5">
              No product-level CTR or technical defects observed in currently verified data.
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#071B35] text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Active Product (11)</th>
                <th className="px-4 py-3 font-semibold">Primary &amp; Secondary Keywords</th>
                <th className="px-4 py-3 font-semibold text-right">Clicks</th>
                <th className="px-4 py-3 font-semibold text-right">Impr.</th>
                <th className="px-4 py-3 font-semibold text-right">CTR</th>
                <th className="px-4 py-3 font-semibold text-right">Avg. Pos</th>
                <th className="px-4 py-3 font-semibold text-right">Org. Sess</th>
                <th className="px-4 py-3 font-semibold text-right">Org. ATC</th>
                <th className="px-4 py-3 font-semibold text-right">Org. Orders / Rev</th>
                <th className="px-4 py-3 font-semibold">Observed Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.products.map((p) => (
                <tr key={p.productId} className="hover:bg-slate-50/80 align-top">
                  <td className="px-4 py-3 min-w-[210px]">
                    <div className="font-bold text-[#071B35]">{p.productName}</div>
                    <a
                      href={p.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-[#FF7900] hover:underline mt-0.5"
                    >
                      <span>{p.productUrl}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                  <td className="px-4 py-3 min-w-[200px]">
                    <div className="font-semibold text-slate-800">{p.primaryKeyword}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {p.secondaryKeywords.slice(0, 2).join(' · ')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-[#071B35]">
                    {p.clicks !== null ? p.clicks.toLocaleString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {p.impressions !== null ? p.impressions.toLocaleString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {p.ctr !== null ? `${p.ctr}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {p.averagePosition !== null ? p.averagePosition.toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {p.organicSessions !== null ? p.organicSessions.toLocaleString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">
                    {p.organicAddToCart !== null ? p.organicAddToCart.toLocaleString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                    {p.organicPurchases !== null
                      ? `${p.organicPurchases} · ₹${(p.organicRevenueInr || 0).toLocaleString('en-IN')}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 min-w-[200px]">
                    {p.observedRecommendations.length > 0 ? (
                      <ul className="space-y-1">
                        {p.observedRecommendations.map((rec, i) => (
                          <li
                            key={i}
                            className="text-[11px] bg-orange-50 text-orange-950 border border-orange-200 rounded-lg px-2 py-1"
                          >
                            {rec}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        {p.performanceTier === 'no_data'
                          ? 'Awaiting verified search/session data'
                          : 'No observed issues'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// 5. CATEGORY-WISE SEO TAB
// ==============================================================================
export const CategorySeoTab: React.FC<{ data: SeoAnalyticsDashboardResponse }> = ({ data }) => (
  <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
    <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h3 className="font-bold text-sm text-[#071B35]">
          Canonical SEO Categories Performance (5 Active Categories)
        </h3>
        <p className="text-xs text-slate-500">
          All canonical category URLs preserved strictly from Phase 4 SEO architecture.
        </p>
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="bg-[#071B35] text-white">
          <tr>
            <th className="px-4 py-3 font-semibold">Category</th>
            <th className="px-4 py-3 font-semibold">Canonical URL</th>
            <th className="px-4 py-3 font-semibold">Primary Keyword</th>
            <th className="px-4 py-3 font-semibold text-right">Clicks</th>
            <th className="px-4 py-3 font-semibold text-right">Impr.</th>
            <th className="px-4 py-3 font-semibold text-right">CTR</th>
            <th className="px-4 py-3 font-semibold text-right">Avg. Pos</th>
            <th className="px-4 py-3 font-semibold text-right">Org. Sessions</th>
            <th className="px-4 py-3 font-semibold text-right">Org. Purchases / Rev</th>
            <th className="px-4 py-3 font-semibold">Observed Opportunities</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.categories.map((c) => (
            <tr key={c.categorySlug} className="hover:bg-slate-50/80">
              <td className="px-4 py-3 font-bold text-[#071B35]">
                {c.categoryName}
                <div className="text-[10px] font-normal text-slate-400">
                  {c.activeProductCount} active product{c.activeProductCount === 1 ? '' : 's'}
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-[11px] text-[#FF7900]">{c.categoryUrl}</td>
              <td className="px-4 py-3 text-slate-800 font-medium">{c.primaryKeyword}</td>
              <td className="px-4 py-3 text-right font-mono font-semibold text-[#071B35]">
                {c.clicks !== null ? c.clicks.toLocaleString('en-IN') : '—'}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-700">
                {c.impressions !== null ? c.impressions.toLocaleString('en-IN') : '—'}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-700">
                {c.ctr !== null ? `${c.ctr}%` : '—'}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-700">
                {c.averagePosition !== null ? c.averagePosition.toFixed(1) : '—'}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-700">
                {c.organicSessions !== null ? c.organicSessions.toLocaleString('en-IN') : '—'}
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                {c.organicPurchases !== null
                  ? `${c.organicPurchases} · ₹${(c.organicRevenueInr || 0).toLocaleString('en-IN')}`
                  : '—'}
              </td>
              <td className="px-4 py-3">
                {c.observedOpportunities.length > 0 ? (
                  <div className="space-y-1">
                    {c.observedOpportunities.map((op, i) => (
                      <div key={i} className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        {op}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">
                    {c.clicks === null && c.organicSessions === null
                      ? 'Awaiting verified search/session data'
                      : 'Healthy baseline'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ==============================================================================
// 6. ORGANIC CONVERSIONS & CHANNEL ATTRIBUTION TAB
// ==============================================================================
export const OrganicConversionsTab: React.FC<{ data: SeoAnalyticsDashboardResponse }> = ({ data }) => {
  const oc = data.organicConversions;
  const funnelSteps = [
    { label: 'Organic Sessions', value: oc.organicFunnel.sessions },
    { label: 'Product Views', value: oc.organicFunnel.productViews },
    { label: 'Add to Cart', value: oc.organicFunnel.addToCarts },
    { label: 'Checkout Starts', value: oc.organicFunnel.checkoutStarts },
    { label: 'Organic Purchases', value: oc.organicFunnel.purchases },
    { label: 'Organic Revenue', value: oc.organicFunnel.revenueInr, isCurrency: true },
    { label: 'Quote Enquiries', value: oc.organicFunnel.quoteEnquiries },
    { label: 'WhatsApp Enquiries', value: oc.organicFunnel.whatsappEnquiries },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-slate-900 text-white p-4 text-xs flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-[#FF7900] shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Strict Channel Attribution &amp; Privacy Safeguard</div>
          <p className="text-slate-300 mt-0.5">{oc.note}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {funnelSteps.map((st) => (
          <div key={st.label} className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500">{st.label}</div>
            <div className="mt-1.5 text-xl font-display font-bold text-[#071B35]">
              {st.value === null ? (
                <span className="text-xs font-normal text-slate-400">Data unavailable</span>
              ) : st.isCurrency ? (
                `₹${st.value.toLocaleString('en-IN')}`
              ) : (
                st.value.toLocaleString('en-IN')
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Source: {oc.attributionSource}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h3 className="font-bold text-sm text-[#071B35]">
            Traffic Channel Separation (Organic Search vs Direct, Paid, Referral &amp; Social)
          </h3>
          <p className="text-xs text-slate-500">
            Ensures purchases from Direct, Paid Search, Referral, or Social sessions are never misattributed to Organic Search.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#071B35] text-white">
              <tr>
                <th className="px-4 py-3 font-semibold">Channel</th>
                <th className="px-4 py-3 font-semibold text-right">Sessions</th>
                <th className="px-4 py-3 font-semibold text-right">Product Views</th>
                <th className="px-4 py-3 font-semibold text-right">Add to Cart</th>
                <th className="px-4 py-3 font-semibold text-right">Checkouts</th>
                <th className="px-4 py-3 font-semibold text-right">Purchases</th>
                <th className="px-4 py-3 font-semibold text-right">Revenue (INR)</th>
                <th className="px-4 py-3 font-semibold text-right">Quotes</th>
                <th className="px-4 py-3 font-semibold text-right">WhatsApp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {oc.channels.map((ch) => (
                <tr
                  key={ch.channel}
                  className={ch.channel === 'organic_search' ? 'bg-orange-50/40 font-semibold' : 'hover:bg-slate-50'}
                >
                  <td className="px-4 py-2.5 text-[#071B35] flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        ch.channel === 'organic_search' ? 'bg-[#FF7900]' : 'bg-slate-400'
                      }`}
                    />
                    {ch.label}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{oc.attributionAvailable ? ch.sessions.toLocaleString('en-IN') : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{oc.attributionAvailable ? ch.productViews.toLocaleString('en-IN') : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{oc.attributionAvailable ? ch.addToCarts.toLocaleString('en-IN') : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{oc.attributionAvailable ? ch.checkoutStarts.toLocaleString('en-IN') : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{oc.attributionAvailable ? ch.purchases.toLocaleString('en-IN') : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {oc.attributionAvailable ? `₹${ch.revenueInr.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">{oc.attributionAvailable ? ch.quoteEnquiries : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{oc.attributionAvailable ? ch.whatsappEnquiries : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// 7. INDEXING & TECHNICAL SEO HEALTH TAB
// ==============================================================================
export const TechnicalIndexingTab: React.FC<{
  data: SeoAnalyticsDashboardResponse;
  onRefresh: () => void;
  onToast: (msg: string, tone?: 'success' | 'error') => void;
}> = ({ data, onRefresh, onToast }) => {
  const tech = data.technicalAudit;
  const idx = tech.indexingSummary;
  const [inspectTarget, setInspectTarget] = useState('https://teqqnoworld.com/product/customized-plain-polo-t-shirt');
  const [inspecting, setInspecting] = useState(false);

  const handleInspectSingle = async () => {
    setInspecting(true);
    try {
      const rec = await inspectSingleUrlApi(inspectTarget);
      onToast(`URL inspected: ${rec.normalizedPath} (${rec.coverageState})`, 'success');
      onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'URL Inspection failed.', 'error');
    } finally {
      setInspecting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Technical Health Score Banner */}
      <div className="bg-gradient-to-r from-[#071B35] via-[#0B2547] to-[#071B35] text-white rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-[#FF7900] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Internal Technical SEO Health Score (Not Google Ranking Score)
          </div>
          <h3 className="font-display text-lg sm:text-xl font-bold">
            Live Technical Audit Across All 11 Products, 5 Categories, Sitemap &amp; Schema
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">{tech.methodologyNote}</p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="w-24 h-24 rounded-2xl bg-white/10 border border-white/15 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-extrabold text-[#FF7900]">
              {tech.technicalHealthScore}
            </span>
            <span className="text-[10px] font-mono uppercase text-slate-300">of 100 pts</span>
          </div>
        </div>
      </div>

      {/* 10 Live Technical SEO Checks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {tech.checks.map((chk) => (
          <div
            key={chk.id}
            className="bg-white rounded-2xl border border-slate-200/90 p-4 flex items-start justify-between gap-3"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                {chk.status === 'pass' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : chk.status === 'warning' ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                )}
                <h4 className="font-bold text-xs sm:text-sm text-[#071B35]">{chk.label}</h4>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{chk.details}</p>
              {chk.affectedUrls.length > 0 && (
                <div className="text-[11px] font-mono text-red-700 pt-1">
                  Affected: {chk.affectedUrls.slice(0, 4).join(', ')}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-xs font-bold text-[#071B35]">
                {chk.passedCount}/{chk.totalCount}
              </div>
              <div className="text-[10px] text-slate-400">
                {chk.earnedPoints}/{chk.weight} pts
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Separate Submitted / Indexed / Not Indexed / Unknown Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-[#071B35]">
              Google Indexing Status Breakdown (Strict Separation from Sitemap)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">{idx.note}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5">
            <div className="text-[11px] text-slate-500 font-semibold">Submitted URLs (Sitemap)</div>
            <div className="text-xl font-display font-bold text-[#071B35] mt-1">{idx.submittedUrls}</div>
          </div>
          <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3.5">
            <div className="text-[11px] text-emerald-800 font-semibold">Verified Indexed URLs</div>
            <div className="text-xl font-display font-bold text-emerald-900 mt-1">
              {idx.indexedUrls !== null ? idx.indexedUrls : 'Unknown'}
            </div>
          </div>
          <div className="rounded-xl bg-rose-50/70 border border-rose-200 p-3.5">
            <div className="text-[11px] text-rose-800 font-semibold">Verified Not Indexed</div>
            <div className="text-xl font-display font-bold text-rose-900 mt-1">
              {idx.notIndexedUrls !== null ? idx.notIndexedUrls : 'Unknown'}
            </div>
          </div>
          <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-3.5">
            <div className="text-[11px] text-amber-800 font-semibold">Unknown Status</div>
            <div className="text-xl font-display font-bold text-amber-900 mt-1">{idx.unknownUrls}</div>
          </div>
        </div>

        {/* On-Demand Single URL Inspection (Never bulk auto-submits) */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="url"
            value={inspectTarget}
            onChange={(e) => setInspectTarget(e.target.value)}
            placeholder="https://teqqnoworld.com/product/..."
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono"
          />
          <button
            type="button"
            disabled={inspecting || !idx.urlInspectionApiConnected}
            onClick={handleInspectSingle}
            className="px-4 py-2 rounded-xl bg-[#071B35] hover:bg-[#0e2d54] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {inspecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
            {idx.urlInspectionApiConnected ? 'Inspect Single URL (GSC API)' : 'GSC URL Inspection API Not Connected'}
          </button>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 sticky top-0">
              <tr>
                <th className="px-3 py-2 font-semibold">URL Path</th>
                <th className="px-3 py-2 font-semibold">Index Status</th>
                <th className="px-3 py-2 font-semibold">Coverage / Details</th>
                <th className="px-3 py-2 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {idx.inspections.map((item) => (
                <tr key={item.normalizedPath}>
                  <td className="px-3 py-2 font-mono text-[11px] text-[#071B35]">{item.normalizedPath}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        item.status === 'indexed'
                          ? 'bg-emerald-50 text-emerald-700'
                          : item.status === 'not_indexed'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{item.coverageState}</td>
                  <td className="px-3 py-2 text-slate-500 text-[11px]">{item.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// 8. ACTIONABLE SEO RECOMMENDATIONS CENTER TAB
// ==============================================================================
export const RecommendationsTab: React.FC<{
  data: SeoAnalyticsDashboardResponse;
  onRefresh: () => void;
  onToast: (msg: string, tone?: 'success' | 'error') => void;
}> = ({ data, onRefresh, onToast }) => {
  const [statusFilter, setStatusFilter] = useState<'all' | RecommendationStatus>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const visible = data.recommendations.filter(
    (r) => statusFilter === 'all' || r.status === statusFilter
  );

  const handleStatusChange = async (
    id: string,
    status: RecommendationStatus,
    issueTitle: string,
    affectedUrl: string
  ) => {
    setUpdatingId(id);
    try {
      await updateRecommendationStatusApi({ id, status, issueTitle, affectedUrl });
      onToast(`Recommendation marked "${status.replace('_', ' ')}"`, 'success');
      onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'Unable to update recommendation status.', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-2xl border border-slate-200/90 p-4">
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'pending', 'in_progress', 'completed', 'ignored'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#071B35] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-slate-500">
          Human-in-the-loop: Recommendations never auto-edit storefront SEO copy.
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center text-xs text-slate-500">
          No recommendations match this status filter.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((rec) => (
            <div
              key={rec.id}
              className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-2.5 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        rec.priority === 'high'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : rec.priority === 'medium'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}
                    >
                      {rec.priority} priority
                    </span>
                    <span className="font-mono text-[11px] text-[#FF7900]">{rec.affectedUrl}</span>
                    <span className="text-[10px] text-slate-400">Source: {rec.source}</span>
                  </div>
                  <h4 className="font-bold text-sm text-[#071B35]">{rec.issue}</h4>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(['pending', 'in_progress', 'completed', 'ignored'] as RecommendationStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={updatingId === rec.id}
                        onClick={() => handleStatusChange(rec.id, st, rec.issue, rec.affectedUrl)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize cursor-pointer transition-colors ${
                          rec.status === st
                            ? 'bg-[#FF7900] text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {st.replace('_', ' ')}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3">
                  <div className="text-[10px] font-mono uppercase text-slate-500 font-bold mb-0.5">
                    Observed Evidence
                  </div>
                  <p className="text-slate-700">{rec.evidence}</p>
                </div>
                <div className="rounded-xl bg-orange-50/50 border border-orange-200/70 p-3">
                  <div className="text-[10px] font-mono uppercase text-[#FF7900] font-bold mb-0.5">
                    Suggested Action
                  </div>
                  <p className="text-slate-800">{rec.suggestedAction}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ==============================================================================
// 9 & 10. WEEKLY & MONTHLY VERIFIED REPORTS TAB
// ==============================================================================
export const VerifiedReportTab: React.FC<{
  reportType: 'weekly' | 'monthly';
  preset: SeoDatePreset;
  startDate: string;
  endDate: string;
  onToast: (msg: string, tone?: 'success' | 'error') => void;
}> = ({ reportType, preset, startDate, endDate, onToast }) => {
  const [report, setReport] = useState<SeoReportPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const effectivePreset: SeoDatePreset =
    preset === 'custom' ? 'custom' : reportType === 'weekly' ? '7d' : '28d';

  const loadReport = async () => {
    setLoading(true);
    try {
      const r = await fetchSeoReportJson({
        type: reportType,
        preset: effectivePreset,
        startDate,
        endDate,
      });
      setReport(r);
    } catch (err: any) {
      onToast(err?.message || 'Failed to build report.', 'error');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadReport();
  }, [reportType, effectivePreset, startDate, endDate]);

  const handleExportCsv = async () => {
    try {
      await downloadSeoReportCsv({
        type: reportType,
        preset: effectivePreset,
        startDate,
        endDate,
      });
      onToast(`${reportType === 'weekly' ? 'Weekly' : 'Monthly'} CSV report downloaded.`, 'success');
    } catch (err: any) {
      onToast(err?.message || 'CSV export failed.', 'error');
    }
  };

  const handleExportPdf = async () => {
    if (!report) return;
    setExportingPdf(true);
    try {
      await exportSeoReportPdf(report);
      onToast(`${reportType === 'weekly' ? 'Weekly' : 'Monthly'} PDF report exported.`, 'success');
    } catch (err: any) {
      onToast(err?.message || 'PDF export failed.', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading && !report) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 flex items-center justify-center gap-2 text-xs text-slate-600">
        <Loader2 className="w-4 h-4 animate-spin text-[#FF7900]" />
        Compiling verified {reportType} SEO report...
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase text-[#FF7900] font-bold">
            {reportType === 'weekly' ? 'Weekly Executive SEO Report' : 'Monthly SEO & Conversion Report'}
          </span>
          <h3 className="font-display text-lg font-bold text-[#071B35] mt-0.5">
            Reporting Period: {report.dateRange.label}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Verified Data Sources: <strong>{report.dataSources.join(', ')}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-xl bg-[#071B35] hover:bg-[#0e2d54] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            disabled={exportingPdf}
            onClick={handleExportPdf}
            className="px-4 py-2 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            {exportingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export Branded PDF
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs text-slate-600">
        {report.honestyDisclaimer}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#071B35] text-white">
            <tr>
              <th className="px-4 py-3 font-semibold">Metric</th>
              <th className="px-4 py-3 font-semibold">Verified Value</th>
              <th className="px-4 py-3 font-semibold">Comparison / Context</th>
              <th className="px-4 py-3 font-semibold">Data Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.summaryMetrics.map((m) => (
              <tr key={m.label}>
                <td className="px-4 py-2.5 font-semibold text-[#071B35]">{m.label}</td>
                <td className="px-4 py-2.5 font-mono font-bold text-[#071B35]">{m.value}</td>
                <td className="px-4 py-2.5 text-slate-600">{m.comparison}</td>
                <td className="px-4 py-2.5 text-slate-500">{m.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2.5">
          <h4 className="font-bold text-sm text-[#071B35]">
            Open Recommended Actions ({report.recommendedActions.length})
          </h4>
          {report.recommendedActions.length === 0 ? (
            <p className="text-xs text-slate-500">No open actions recorded.</p>
          ) : (
            <ul className="space-y-2">
              {report.recommendedActions.slice(0, 6).map((r) => (
                <li key={r.id} className="text-xs border border-slate-100 rounded-xl p-2.5 bg-slate-50/70">
                  <div className="font-semibold text-[#071B35]">{r.issue}</div>
                  <div className="text-slate-500 mt-0.5">{r.suggestedAction}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2.5">
          <h4 className="font-bold text-sm text-[#071B35]">
            Completed SEO Improvements ({report.completedImprovements.length})
          </h4>
          {report.completedImprovements.length === 0 ? (
            <p className="text-xs text-slate-500">
              Mark items as &quot;Completed&quot; in SEO Recommendations to track completed milestones here.
            </p>
          ) : (
            <ul className="space-y-2">
              {report.completedImprovements.map((r) => (
                <li key={r.id} className="text-xs border border-emerald-200 rounded-xl p-2.5 bg-emerald-50/50">
                  <div className="font-semibold text-emerald-900">{r.issue}</div>
                  <div className="text-emerald-700 text-[11px] mt-0.5">
                    {r.affectedUrl} · Updated {r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('en-IN') : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

// ==============================================================================
// 11. SETTINGS & DATA CONNECTIONS TAB (CSV IMPORT + SERVER-SIDE API SYNC)
// ==============================================================================
export const DataConnectionsTab: React.FC<{
  data: SeoAnalyticsDashboardResponse;
  preset: SeoDatePreset;
  startDate: string;
  endDate: string;
  onRefresh: () => void;
  onToast: (msg: string, tone?: 'success' | 'error') => void;
}> = ({ data, preset, startDate, endDate, onRefresh, onToast }) => {
  const conn = data.connectionStatus;
  const [gscMode, setGscMode] = useState<'performance' | 'indexing'>('performance');
  const [gscDim, setGscDim] = useState<GscSnapshotRecord['dimension'] | 'auto'>('auto');
  const [gscStart, setGscStart] = useState(data.requestedRange.startDate);
  const [gscEnd, setGscEnd] = useState(data.requestedRange.endDate);
  const [gscCsvText, setGscCsvText] = useState('');
  const [importingGsc, setImportingGsc] = useState(false);

  const [ga4Start, setGa4Start] = useState(data.requestedRange.startDate);
  const [ga4End, setGa4End] = useState(data.requestedRange.endDate);
  const [ga4CsvText, setGa4CsvText] = useState('');
  const [importingGa4, setImportingGa4] = useState(false);

  const [syncingGsc, setSyncingGsc] = useState(false);
  const [syncingGa4, setSyncingGa4] = useState(false);

  const readFileInto = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result || ''));
    reader.readAsText(file);
  };

  const handleImportGsc = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportingGsc(true);
    try {
      const res = await importGscCsvApi({
        mode: gscMode,
        csvText: gscCsvText,
        dimension: gscDim,
        startDate: gscStart,
        endDate: gscEnd,
      });
      setGscCsvText('');
      onToast(
        gscMode === 'indexing'
          ? `Imported ${res.importedCount} GSC URL inspection rows (${res.indexedCount} indexed).`
          : `Imported ${res.rowCount} GSC ${res.dimension} rows (${gscStart} to ${gscEnd}).`,
        'success'
      );
      onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'GSC CSV import failed.', 'error');
    } finally {
      setImportingGsc(false);
    }
  };

  const handleImportGa4 = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportingGa4(true);
    try {
      const res = await importGa4CsvApi({
        csvText: ga4CsvText,
        startDate: ga4Start,
        endDate: ga4End,
      });
      setGa4CsvText('');
      onToast(`Imported ${res.rowCount} GA4 landing/channel rows (${ga4Start} to ${ga4End}).`, 'success');
      onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'GA4 CSV import failed.', 'error');
    } finally {
      setImportingGa4(false);
    }
  };

  const handleSyncGsc = async () => {
    setSyncingGsc(true);
    try {
      const res = await syncGscApiNow({ preset, startDate, endDate });
      onToast(`Synced GSC API (${res.dateStart} to ${res.dateEnd}).`, 'success');
      onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'GSC API sync unavailable.', 'error');
    } finally {
      setSyncingGsc(false);
    }
  };

  const handleSyncGa4 = async () => {
    setSyncingGa4(true);
    try {
      const res = await syncGa4ApiNow({ preset, startDate, endDate });
      onToast(`Synced GA4 Data API (${res.rowCount} rows).`, 'success');
      onRefresh();
    } catch (err: any) {
      onToast(err?.message || 'GA4 Data API sync unavailable.', 'error');
    } finally {
      setSyncingGa4(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Live Connection Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#071B35]">Google Search Console API</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                conn.gscApiConnected
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              {conn.gscApiConnected ? 'Connected' : 'CSV Mode'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {conn.gscApiConnected
              ? `Property: ${conn.gscSiteUrl}`
              : 'No server-side Service Account configured. Use CSV import below or add env vars.'}
          </p>
          <button
            type="button"
            disabled={!conn.gscApiConnected || syncingGsc}
            onClick={handleSyncGsc}
            className="w-full py-1.5 rounded-xl bg-[#071B35] disabled:opacity-45 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {syncingGsc ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Sync GSC API Now
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#071B35]">GA4 Data API</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                conn.ga4DataApiConnected
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              {conn.ga4DataApiConnected ? 'Connected' : 'Tag + CSV Mode'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            GTM <code className="bg-slate-100 px-1 rounded">{conn.gtmContainerId}</code>{' '}
            {conn.gtmInstalledInHtml ? 'verified in index.html' : 'not found'}.
          </p>
          <button
            type="button"
            disabled={!conn.ga4DataApiConnected || syncingGa4}
            onClick={handleSyncGa4}
            className="w-full py-1.5 rounded-xl bg-[#071B35] disabled:opacity-45 text-white text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {syncingGa4 ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Sync GA4 API Now
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#071B35]">First-Party Attribution</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700">
              Active (Non-PII)
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Recorded Events: <strong>{conn.firstPartyEventCount.toLocaleString('en-IN')}</strong> ·
            Deduplicated purchases &amp; channel tracking via GTM dataLayer.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#071B35]">Analytics Storage</span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                conn.supabaseTablesReady
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-sky-50 text-sky-800'
              }`}
            >
              {conn.supabaseTablesReady ? 'Supabase SQL' : 'Local Fallback'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            {conn.supabaseTablesReady
              ? 'Persisting snapshots & events to RLS-protected Supabase tables.'
              : 'Run supabase/seo_analytics_migration.sql manually to enable Supabase persistence.'}
          </p>
        </div>
      </div>

      {/* Working CSV Import Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form
          onSubmit={handleImportGsc}
          className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3.5"
        >
          <div>
            <h3 className="font-bold text-sm text-[#071B35]">
              Import Google Search Console CSV Export
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload Queries.csv, Pages.csv, Countries.csv, Devices.csv, Dates.csv, or Page Indexing CSV directly from Google Search Console.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Import Type</label>
              <select
                value={gscMode}
                onChange={(e) => setGscMode(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
              >
                <option value="performance">Search Performance CSV</option>
                <option value="indexing">Page Indexing / URL Status CSV</option>
              </select>
            </div>
            {gscMode === 'performance' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dimension</label>
                <select
                  value={gscDim}
                  onChange={(e) => setGscDim(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                >
                  <option value="auto">Auto-detect from CSV Header</option>
                  <option value="query">Search Queries</option>
                  <option value="page">Landing Pages</option>
                  <option value="country">Countries</option>
                  <option value="device">Devices</option>
                  <option value="search_appearance">Search Appearance</option>
                  <option value="date">Dates (Daily Trend)</option>
                </select>
              </div>
            )}
          </div>

          {gscMode === 'performance' && (
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period Start</label>
                <input
                  type="date"
                  value={gscStart}
                  onChange={(e) => setGscStart(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period End</label>
                <input
                  type="date"
                  value={gscEnd}
                  onChange={(e) => setGscEnd(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Upload CSV File or Paste Raw CSV
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => readFileInto(e, setGscCsvText)}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-orange-50 file:text-[#FF7900] file:font-semibold mb-2"
            />
            <textarea
              rows={4}
              value={gscCsvText}
              onChange={(e) => setGscCsvText(e.target.value)}
              placeholder="Top queries,Clicks,Impressions,CTR,Position&#10;custom polo t-shirt printing india,12,240,5.0%,8.4"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={importingGsc || !gscCsvText.trim()}
            className="w-full py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {importingGsc ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Import Verified GSC Snapshot
          </button>
        </form>

        <form
          onSubmit={handleImportGa4}
          className="bg-white rounded-2xl border border-slate-200/90 p-5 space-y-3.5"
        >
          <div>
            <h3 className="font-bold text-sm text-[#071B35]">
              Import Google Analytics 4 (GA4) CSV Export
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload a GA4 Landing Page or Traffic Acquisition CSV (Sessions, Items viewed, Add to carts, Purchases, Purchase revenue).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period Start</label>
              <input
                type="date"
                value={ga4Start}
                onChange={(e) => setGa4Start(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period End</label>
              <input
                type="date"
                value={ga4End}
                onChange={(e) => setGa4End(e.target.value)}
                required
                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Upload GA4 CSV File or Paste Raw CSV
            </label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => readFileInto(e, setGa4CsvText)}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-[#071B35] file:font-semibold mb-2"
            />
            <textarea
              rows={5}
              value={ga4CsvText}
              onChange={(e) => setGa4CsvText(e.target.value)}
              placeholder="Landing page,Session default channel group,Sessions,Items viewed,Add to carts,Purchases,Purchase revenue&#10;/product/customized-plain-polo-t-shirt,Organic Search,42,38,6,2,7980"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono text-[11px]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={importingGa4 || !ga4CsvText.trim()}
            className="w-full py-2.5 rounded-xl bg-[#071B35] hover:bg-[#0e2d54] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            {importingGa4 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
            Import Verified GA4 Snapshot
          </button>
        </form>
      </div>
    </div>
  );
};

// ==============================================================================
// 12. CONTENT PERFORMANCE TAB (PHASE 6 — BLOG & TOPICAL AUTHORITY ANALYTICS)
// ==============================================================================
export const ContentPerformanceTab: React.FC<{
  data: SeoAnalyticsDashboardResponse;
  onGoToConnections: () => void;
}> = ({ data, onGoToConnections }) => {
  const cp = data.contentPerformance;

  if (!cp) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center space-y-2">
        <FileText className="w-7 h-7 text-slate-300 mx-auto" />
        <p className="text-sm font-bold text-[#071B35]">Content Performance Data Unavailable</p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Connect the Blog CMS store or publish articles in Admin → Blog Management to begin measuring real content views, organic landings, and article-to-product clicks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Verified Source Attribution Notice */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-[#FF7900] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-[#071B35]">Active Data Sources:</span>{' '}
            {cp.dataSources.join(' · ')}.{' '}
            <span className="text-slate-600">{cp.engagementDataNote}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoToConnections}
          className="text-xs font-bold text-[#FF7900] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
        >
          GSC / GA4 Connections →
        </button>
      </div>

      {/* Primary Content Inventory & Performance KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
          <div className="text-[11px] font-semibold text-slate-500">Published Articles</div>
          <div className="font-display text-2xl font-extrabold text-[#071B35] mt-1 tabular-nums">
            {cp.publishedArticlesCount}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Drafts: <strong>{cp.draftArticlesCount}</strong> · Scheduled:{' '}
            <strong>{cp.scheduledArticlesCount}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
          <div className="text-[11px] font-semibold text-slate-500">Article Views (First-Party)</div>
          <div className="font-display text-2xl font-extrabold text-[#071B35] mt-1 tabular-nums">
            {cp.totalArticleViews.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Organic landing sessions: <strong>{cp.organicBlogSessions.toLocaleString('en-IN')}</strong>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
          <div className="text-[11px] font-semibold text-slate-500">Search Clicks &amp; Impressions (GSC)</div>
          <div className="font-display text-lg font-extrabold text-[#071B35] mt-1 tabular-nums">
            {cp.blogSearchClicks !== null
              ? `${cp.blogSearchClicks.toLocaleString('en-IN')} clicks`
              : 'Data unavailable'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {cp.blogSearchImpressions !== null
              ? `${cp.blogSearchImpressions.toLocaleString('en-IN')} GSC impressions`
              : 'Import or connect GSC to populate'}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
          <div className="text-[11px] font-semibold text-slate-500">Average Engagement (GA4)</div>
          <div className="font-display text-lg font-extrabold text-[#071B35] mt-1 tabular-nums">
            {cp.averageEngagementSeconds !== null
              ? `${cp.averageEngagementSeconds}s`
              : 'Data unavailable'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {cp.averageEngagementSeconds !== null
              ? 'From connected GA4 property'
              : 'Requires GA4 Data API engagement sync'}
          </div>
        </div>
      </div>

      {/* Article-to-Product Commercial Engagement Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
          <div className="text-[11px] font-semibold text-slate-500">Product Clicks from Articles</div>
          <div className="font-display text-xl font-extrabold text-[#FF7900] mt-1 tabular-nums">
            {cp.totalProductClicksFromArticles.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Event: related_product_click</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
          <div className="text-[11px] font-semibold text-slate-500">Article-to-Product Rate</div>
          <div className="font-display text-xl font-extrabold text-[#071B35] mt-1 tabular-nums">
            {cp.articleToProductEngagementRatePct !== null
              ? `${cp.articleToProductEngagementRatePct}%`
              : '—'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            (Product clicks + CTA clicks) / article views
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
          <div className="text-[11px] font-semibold text-slate-500">Blog CTA Clicks</div>
          <div className="font-display text-xl font-extrabold text-[#071B35] mt-1 tabular-nums">
            {cp.totalBlogCtaClicks.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Event: blog_cta_click</div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4">
          <div className="text-[11px] font-semibold text-slate-500">Shares &amp; Blog Searches</div>
          <div className="font-display text-xl font-extrabold text-[#071B35] mt-1 tabular-nums">
            {cp.totalBlogShares.toLocaleString('en-IN')} / {cp.totalBlogSearches.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">blog_share · blog_search</div>
        </div>
      </div>

      {/* Per-Article Breakdown Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-[#071B35]">
              Article-Level Search &amp; Conversion Engagement ({cp.articles.length})
            </h3>
            <p className="text-[11px] text-slate-500">
              Combines live first-party non-PII events with imported/API GSC landing-page clicks and impressions.
            </p>
          </div>
        </div>

        {cp.articles.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No articles created yet. Drafts and published articles created in Admin → Blog Management will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Article &amp; URL</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Views</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Organic Sessions</th>
                  <th className="px-3 py-2.5 font-semibold text-right">GSC Clicks</th>
                  <th className="px-3 py-2.5 font-semibold text-right">GSC Impr.</th>
                  <th className="px-3 py-2.5 font-semibold text-right">GA4 Eng.</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Product Clicks</th>
                  <th className="px-3 py-2.5 font-semibold text-right">CTA Clicks</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Engage %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cp.articles.map((row) => (
                  <tr key={row.postId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 max-w-[280px]">
                      <div className="font-semibold text-[#071B35] truncate" title={row.title}>
                        {row.title}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500 truncate">{row.path}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          row.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700'
                            : row.status === 'scheduled'
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{row.articleViews.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-right font-mono">
                      {row.organicLandingSessions.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {fmtNum(row.searchClicks)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                      {fmtNum(row.searchImpressions)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-500">
                      {row.averageEngagementSeconds !== null ? `${row.averageEngagementSeconds}s` : 'N/A'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#FF7900]">
                      {row.relatedProductClicks.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono">{row.ctaClicks.toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#071B35]">
                      {row.articleToProductRatePct !== null ? `${row.articleToProductRatePct}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

