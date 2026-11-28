// ==============================================================================
// TEQQNOWORLD PHASE 5 — ADMIN SEO ANALYTICS API CLIENT & REPORT EXPORTERS
// Authenticated exclusively via existing signed Admin Bearer Session Token.
// Branded Dark Navy + Orange PDF export loads jsPDF dynamically on demand.
// ==============================================================================

import { getStoredAdminToken } from './adminSecurityService';
import type {
  GscSnapshotRecord,
  RecommendationStatus,
  SeoAnalyticsDashboardResponse,
  SeoDatePreset,
  SeoReportPayload,
  TechnicalSeoAuditResult,
  UrlInspectionRecord,
} from '../types/seoAnalytics';

function buildAdminHeaders(): Record<string, string> {
  const token = getStoredAdminToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Unexpected server response (HTTP ${res.status}).`);
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.error || `Request failed with HTTP ${res.status}.`);
  }
  return json as T;
}

export async function fetchSeoAnalyticsDashboard(params: {
  preset: SeoDatePreset;
  startDate?: string;
  endDate?: string;
}): Promise<SeoAnalyticsDashboardResponse> {
  const qs = new URLSearchParams({ preset: params.preset });
  if (params.preset === 'custom' && params.startDate && params.endDate) {
    qs.set('startDate', params.startDate);
    qs.set('endDate', params.endDate);
  }
  const res = await fetch(`/api/admin/seo-analytics/overview?${qs.toString()}`, {
    headers: buildAdminHeaders(),
  });
  const json = await parseJsonResponse<{ success: true; data: SeoAnalyticsDashboardResponse }>(res);
  return json.data;
}

export async function runTechnicalSeoAuditApi(): Promise<TechnicalSeoAuditResult> {
  const res = await fetch('/api/admin/seo-analytics/technical-audit', {
    headers: buildAdminHeaders(),
  });
  const json = await parseJsonResponse<{ success: true; audit: TechnicalSeoAuditResult }>(res);
  return json.audit;
}

export async function importGscCsvApi(params: {
  mode: 'performance' | 'indexing';
  csvText: string;
  dimension?: GscSnapshotRecord['dimension'] | 'auto';
  startDate?: string;
  endDate?: string;
}): Promise<{
  dimension?: string;
  rowCount?: number;
  importedCount?: number;
  indexedCount?: number;
  notIndexedCount?: number;
  storage: string;
  warnings?: string[];
}> {
  const res = await fetch('/api/admin/seo-analytics/import/gsc', {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify({
      mode: params.mode,
      csvText: params.csvText,
      dimension: params.dimension && params.dimension !== 'auto' ? params.dimension : undefined,
      startDate: params.startDate,
      endDate: params.endDate,
    }),
  });
  return parseJsonResponse(res);
}

export async function importGa4CsvApi(params: {
  csvText: string;
  startDate: string;
  endDate: string;
}): Promise<{ rowCount: number; storage: string; warnings?: string[] }> {
  const res = await fetch('/api/admin/seo-analytics/import/ga4', {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify(params),
  });
  return parseJsonResponse(res);
}

export async function syncGscApiNow(params: {
  preset: SeoDatePreset;
  startDate?: string;
  endDate?: string;
}): Promise<{ dateStart: string; dateEnd: string; syncedCounts: Record<string, number> }> {
  const res = await fetch('/api/admin/seo-analytics/sync/gsc', {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify(params),
  });
  return parseJsonResponse(res);
}

export async function syncGa4ApiNow(params: {
  preset: SeoDatePreset;
  startDate?: string;
  endDate?: string;
}): Promise<{ dateStart: string; dateEnd: string; rowCount: number }> {
  const res = await fetch('/api/admin/seo-analytics/sync/ga4', {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify(params),
  });
  return parseJsonResponse(res);
}

export async function inspectSingleUrlApi(url: string): Promise<UrlInspectionRecord> {
  const res = await fetch('/api/admin/seo-analytics/inspect-url', {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify({ url }),
  });
  const json = await parseJsonResponse<{ success: true; inspection: UrlInspectionRecord }>(res);
  return json.inspection;
}

export async function updateRecommendationStatusApi(params: {
  id: string;
  status: RecommendationStatus;
  issueTitle: string;
  affectedUrl: string;
}): Promise<void> {
  const res = await fetch(
    `/api/admin/seo-analytics/recommendations/${encodeURIComponent(params.id)}`,
    {
      method: 'PATCH',
      headers: buildAdminHeaders(),
      body: JSON.stringify({
        status: params.status,
        issueTitle: params.issueTitle,
        affectedUrl: params.affectedUrl,
      }),
    }
  );
  await parseJsonResponse(res);
}

export async function fetchSeoReportJson(params: {
  type: 'weekly' | 'monthly';
  preset?: SeoDatePreset;
  startDate?: string;
  endDate?: string;
}): Promise<SeoReportPayload> {
  const qs = new URLSearchParams({
    type: params.type,
    format: 'json',
    preset: params.preset || (params.type === 'weekly' ? '7d' : '28d'),
  });
  if (params.preset === 'custom' && params.startDate && params.endDate) {
    qs.set('startDate', params.startDate);
    qs.set('endDate', params.endDate);
  }
  const res = await fetch(`/api/admin/seo-analytics/reports?${qs.toString()}`, {
    headers: buildAdminHeaders(),
  });
  const json = await parseJsonResponse<{ success: true; report: SeoReportPayload }>(res);
  return json.report;
}

export async function downloadSeoReportCsv(params: {
  type: 'weekly' | 'monthly';
  preset?: SeoDatePreset;
  startDate?: string;
  endDate?: string;
}): Promise<void> {
  const qs = new URLSearchParams({
    type: params.type,
    format: 'csv',
    preset: params.preset || (params.type === 'weekly' ? '7d' : '28d'),
  });
  if (params.preset === 'custom' && params.startDate && params.endDate) {
    qs.set('startDate', params.startDate);
    qs.set('endDate', params.endDate);
  }
  const res = await fetch(`/api/admin/seo-analytics/reports?${qs.toString()}`, {
    headers: buildAdminHeaders(),
  });
  if (!res.ok) {
    throw new Error(`Failed to export CSV report (HTTP ${res.status}).`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `teqqnoworld-seo-${params.type}-report.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Generates a branded Dark Navy + Orange TeqqnoWorld SEO PDF Report
 * using verified report data only (dynamically imports jsPDF on demand).
 */
export async function exportSeoReportPdf(report: SeoReportPayload): Promise<void> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const autoTable = autoTableMod.default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Branded Dark Navy Header Banner
  doc.setFillColor(7, 27, 53); // #071B35
  doc.rect(0, 0, pageWidth, 86, 'F');
  doc.setFillColor(255, 121, 0); // #FF7900 accent stripe
  doc.rect(0, 86, pageWidth, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TeqqnoWorld — Google Search & SEO Analytics Report', 36, 36);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(226, 232, 240);
  doc.text(
    `${report.reportType === 'weekly' ? 'Weekly' : 'Monthly'} Performance Report  |  Period: ${report.dateRange.label}`,
    36,
    56
  );
  doc.text(
    `Sources: ${report.dataSources.join(', ')}  |  Generated: ${new Date(report.generatedAt).toLocaleString('en-IN')}`,
    36,
    72
  );

  // Honesty Disclaimer Callout
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8.5);
  const disclaimerLines = doc.splitTextToSize(report.honestyDisclaimer, pageWidth - 72);
  doc.text(disclaimerLines, 36, 108);

  let nextY = 108 + disclaimerLines.length * 11 + 10;

  // Section 1: Summary Metrics
  autoTable(doc, {
    startY: nextY,
    head: [['Metric', 'Verified Value', 'Comparison / Context', 'Data Source']],
    body: report.summaryMetrics.map((m) => [m.label, m.value, m.comparison, m.source]),
    headStyles: { fillColor: [7, 27, 53], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 36, right: 36 },
  });

  nextY = ((doc as any).lastAutoTable?.finalY || nextY + 120) + 18;

  // Section 2: Product Performance
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(7, 27, 53);
  doc.text('Product-Wise SEO Performance (11 Active Products)', 36, nextY);

  autoTable(doc, {
    startY: nextY + 8,
    head: [['Product', 'Primary Keyword', 'Clicks', 'Impr.', 'CTR', 'Avg Pos', 'Org. Sessions']],
    body: report.topProducts.map((p) => [
      p.productName,
      p.primaryKeyword,
      p.clicks ?? 'N/A',
      p.impressions ?? 'N/A',
      p.ctr !== null ? `${p.ctr}%` : 'N/A',
      p.averagePosition ?? 'N/A',
      p.organicSessions ?? 'N/A',
    ]),
    headStyles: { fillColor: [255, 121, 0], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    margin: { left: 36, right: 36 },
  });

  nextY = ((doc as any).lastAutoTable?.finalY || nextY + 120) + 18;
  if (nextY > 700) {
    doc.addPage();
    nextY = 48;
  }

  // Section 3: Category Performance
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(7, 27, 53);
  doc.text('Category-Wise SEO Performance (5 Canonical Categories)', 36, nextY);

  autoTable(doc, {
    startY: nextY + 8,
    head: [['Category', 'URL', 'Primary Keyword', 'Clicks', 'Impr.', 'Avg Pos']],
    body: report.topCategories.map((c) => [
      c.categoryName,
      c.categoryUrl,
      c.primaryKeyword,
      c.clicks ?? 'N/A',
      c.impressions ?? 'N/A',
      c.averagePosition ?? 'N/A',
    ]),
    headStyles: { fillColor: [7, 27, 53], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    margin: { left: 36, right: 36 },
  });

  nextY = ((doc as any).lastAutoTable?.finalY || nextY + 100) + 18;
  if (nextY > 680) {
    doc.addPage();
    nextY = 48;
  }

  // Section 4: Recommendations & Completed Improvements
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(7, 27, 53);
  doc.text('Actionable SEO Recommendations & Completed Improvements', 36, nextY);

  const recRows = [...report.recommendedActions, ...report.completedImprovements];
  autoTable(doc, {
    startY: nextY + 8,
    head: [['Priority', 'Status', 'Issue', 'Affected URL', 'Suggested Action']],
    body:
      recRows.length > 0
        ? recRows.map((r) => [
            r.priority.toUpperCase(),
            r.status,
            r.issue,
            r.affectedUrl,
            r.suggestedAction,
          ])
        : [['—', '—', 'No open SEO recommendations for this period.', '—', '—']],
    headStyles: { fillColor: [7, 27, 53], textColor: [255, 255, 255], fontSize: 8 },
    bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
    margin: { left: 36, right: 36 },
  });

  doc.save(
    `teqqnoworld-seo-${report.reportType}-report-${report.dateRange.startDate}-to-${report.dateRange.endDate}.pdf`
  );
}
