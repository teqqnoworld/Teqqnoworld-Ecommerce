import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getStoredAdminToken } from './adminSecurityService';
import type {
  AffiliateAnalyticsRange,
  AffiliateApplicationRecord,
  AffiliateDashboardPayload,
  AffiliateEligibilityResult,
  AffiliateKycMaskedView,
  AffiliateLinkRecord,
  AffiliatePartnerRecord,
  AffiliateProductSetting,
  AffiliateProgramSettings,
  AffiliatePublicVerificationResult,
} from '../types/affiliate';

// ==============================================================================
// TEQQNOWORLD AFFILIATE CLIENT SERVICE + QR / CSV / PDF GENERATORS
// ==============================================================================

async function apiRequest<T>(
  url: string,
  options: RequestInit = {},
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const resp = await fetch(url, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
      ...(options.headers || {}),
    },
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${resp.status})`);
  }
  return data as T;
}

function partnerHeaders(customerEmail: string): Record<string, string> {
  return { 'X-Affiliate-Email': customerEmail.trim().toLowerCase() };
}

function adminHeaders(): Record<string, string> {
  const token = getStoredAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function formatInrPaisa(paisa: number): string {
  const rupees = Math.round(paisa || 0) / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatShortDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ==============================================================================
// PUBLIC PROGRAM, ELIGIBILITY, OTP & KYC APIs
// ==============================================================================

export async function fetchAffiliateProgramPublic() {
  return apiRequest<{
    success: boolean;
    settings: AffiliateProgramSettings;
    summary: {
      enabledProductsCount: number;
      minRatePct: number;
      maxRatePct: number;
      minWithdrawalInr: number;
      cookieDurationDays: number;
      returnPeriodDays: number;
      payoutProcessingWindow: string;
    };
  }>('/api/affiliate/program');
}

export async function checkAffiliateEligibility(params: {
  customerEmail: string;
  customerMobile?: string;
}) {
  return apiRequest<{
    success: boolean;
    eligibility: AffiliateEligibilityResult;
    application: AffiliateApplicationRecord | null;
    kyc: AffiliateKycMaskedView | null;
    partner: {
      affiliateId: string;
      status: AffiliatePartnerRecord['status'];
      fullName: string;
      joinedAt: string;
    } | null;
  }>('/api/affiliate/eligibility', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function sendAffiliateEmailOtp(params: {
  email: string;
  firstName?: string;
}) {
  return apiRequest<{
    success: boolean;
    message: string;
    expiresAt: string;
    cooldownSeconds: number;
    devPreviewOtp?: string;
  }>('/api/affiliate/applications/send-otp', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function verifyAffiliateEmailOtp(params: {
  email: string;
  code: string;
}) {
  return apiRequest<{
    success: boolean;
    emailVerified: boolean;
    verifiedAt: string;
    message: string;
  }>('/api/affiliate/applications/verify-otp', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function submitAffiliateApplication(payload: {
  customerUserId?: string;
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  companyName?: string;
  dateOfBirth?: string;
  isAdultConfirmed: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  kycConsentAccepted: boolean;
}) {
  return apiRequest<{
    success: boolean;
    application: AffiliateApplicationRecord;
    message: string;
  }>('/api/affiliate/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadAffiliateKycDocument(
  customerEmail: string,
  payload: {
    docType: 'aadhaar' | 'pan' | 'bank_proof';
    fileName: string;
    dataUrl: string;
  }
) {
  return apiRequest<{
    success: boolean;
    storedRef: string;
    displayName: string;
  }>(
    '/api/affiliate/kyc/upload-doc',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    partnerHeaders(customerEmail)
  );
}

export async function submitAffiliateKyc(
  customerEmail: string,
  payload: {
    applicationId: string;
    aadhaarNumber: string;
    panNumber: string;
    bankAccountHolderName: string;
    bankAccountNumber: string;
    bankIfscCode: string;
    bankName?: string;
    aadhaarDocRef?: string | null;
    panDocRef?: string | null;
    bankProofDocRef?: string | null;
    aadhaarDocName?: string | null;
    panDocName?: string | null;
    bankProofDocName?: string | null;
  }
) {
  return apiRequest<{
    success: boolean;
    kyc: AffiliateKycMaskedView;
    applicationStatus: string;
    message: string;
  }>(
    '/api/affiliate/kyc',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    partnerHeaders(customerEmail)
  );
}

// ==============================================================================
// CLICK TRACKING, ORDER ATTRIBUTION & PUBLIC VERIFICATION
// ==============================================================================

export async function trackAffiliateClick(params: {
  ref: string;
  landingPath: string;
  productId?: string;
  productSlug?: string;
  trafficSource?: string;
  campaign?: string;
  customerEmail?: string;
  customerUserId?: string;
}) {
  try {
    return await apiRequest<{
      success: boolean;
      attributed: boolean;
      affiliateId?: string;
      expiresAt?: string;
    }>('/api/affiliate/track-click', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  } catch {
    return { success: false, attributed: false };
  }
}

export async function attributeOrderToAffiliate(payload: {
  orderId: string;
  orderNumber: string;
  customerEmail?: string;
  customerMobile?: string;
  customerUserId?: string;
  shippingInr?: number;
  items: Array<{
    orderItemId?: string;
    productId: string;
    quantity: number;
    grossGstInclusiveInr: number;
    discountInr?: number;
    gstInclusiveDiscountedAmountInr: number;
  }>;
}) {
  try {
    return await apiRequest<{
      success: boolean;
      attributed: boolean;
      selfReferralBlocked?: boolean;
      commissionsCreated?: number;
    }>('/api/affiliate/orders/attribute', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return { success: false, attributed: false };
  }
}

export async function verifyAffiliateCredentialPublic(code: string) {
  return apiRequest<{
    success: boolean;
    verification: AffiliatePublicVerificationResult;
  }>(`/api/affiliate/verify/${encodeURIComponent(code)}`);
}

// ==============================================================================
// PARTNER DASHBOARD APIs
// ==============================================================================

export async function fetchAffiliateDashboard(
  customerEmail: string,
  params?: { range?: AffiliateAnalyticsRange; from?: string; to?: string }
) {
  const qs = new URLSearchParams();
  if (params?.range) qs.set('range', params.range);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  const queryStr = qs.toString() ? `?${qs.toString()}` : '';

  return apiRequest<{
    success: boolean;
    dashboard: AffiliateDashboardPayload;
  }>(`/api/affiliate/dashboard${queryStr}`, {}, partnerHeaders(customerEmail));
}

export async function createAffiliateLink(
  customerEmail: string,
  payload: { linkType: 'website' | 'product'; productId?: string; campaignTag?: string }
) {
  return apiRequest<{ success: boolean; link: AffiliateLinkRecord; existing?: boolean }>(
    '/api/affiliate/links',
    { method: 'POST', body: JSON.stringify(payload) },
    partnerHeaders(customerEmail)
  );
}

export async function uploadAffiliateIdCardPhoto(customerEmail: string, photoDataUrl: string) {
  return apiRequest<{ success: boolean; avatarUrl: string }>(
    '/api/affiliate/id-card/photo',
    { method: 'POST', body: JSON.stringify({ photoDataUrl }) },
    partnerHeaders(customerEmail)
  );
}

export async function requestAffiliateWithdrawal(
  customerEmail: string,
  amountInr: number,
  idempotencyKey?: string
) {
  return apiRequest<{
    success: boolean;
    message: string;
  }>(
    '/api/affiliate/withdrawals',
    { method: 'POST', body: JSON.stringify({ amountInr, idempotencyKey }) },
    partnerHeaders(customerEmail)
  );
}

export async function markAffiliateNotificationRead(customerEmail: string, id: string) {
  return apiRequest<{ success: boolean }>(
    `/api/affiliate/notifications/${encodeURIComponent(id)}/read`,
    { method: 'PATCH' },
    partnerHeaders(customerEmail)
  );
}

export async function createAffiliateSupportTicket(
  customerEmail: string,
  payload: { subject: string; category: string; message: string }
) {
  return apiRequest<{ success: boolean }>(
    '/api/affiliate/support',
    { method: 'POST', body: JSON.stringify(payload) },
    partnerHeaders(customerEmail)
  );
}

export async function replyAffiliateSupportTicket(
  customerEmail: string,
  ticketId: string,
  message: string
) {
  return apiRequest<{ success: boolean }>(
    `/api/affiliate/support/${encodeURIComponent(ticketId)}/reply`,
    { method: 'POST', body: JSON.stringify({ message }) },
    partnerHeaders(customerEmail)
  );
}

export async function submitAffiliateReactivationRequest(customerEmail: string, reason: string) {
  return apiRequest<{ success: boolean }>(
    '/api/affiliate/reactivation-request',
    { method: 'POST', body: JSON.stringify({ reason }) },
    partnerHeaders(customerEmail)
  );
}

export async function submitAffiliateClosureRequest(customerEmail: string, reason: string) {
  return apiRequest<{ success: boolean }>(
    '/api/affiliate/closure-request',
    { method: 'POST', body: JSON.stringify({ reason }) },
    partnerHeaders(customerEmail)
  );
}

// ==============================================================================
// ADMIN AFFILIATE PANEL APIs (BEARER AUTH)
// ==============================================================================

export async function fetchAdminAffiliateOverview() {
  return apiRequest<any>('/api/admin/affiliate/overview', {}, adminHeaders());
}

export async function adminReviewApplication(
  id: string,
  payload: { action: 'approve_application' | 'reject'; reason?: string; adminNotes?: string }
) {
  return apiRequest<any>(
    `/api/admin/affiliate/applications/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminReviewKyc(
  id: string,
  payload: {
    action:
      | 'approve_kyc'
      | 'reject_kyc'
      | 'approve_bank'
      | 'reject_bank'
      | 'penny_drop_check'
      | 'activate_partner';
    reason?: string;
  }
) {
  return apiRequest<any>(
    `/api/admin/affiliate/kyc/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminUpdatePartnerStatus(
  id: string,
  payload: {
    action: 'suspend' | 'reactivate' | 'close';
    reason?: string;
    releaseHeldCommissions?: boolean;
  }
) {
  return apiRequest<any>(
    `/api/admin/affiliate/partners/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminUpdateProductCommission(
  productId: string,
  payload: {
    enabled: boolean;
    commissionRatePct: number;
    campaignRatePct: number | null;
    campaignLabel: string | null;
    startDate: string | null;
    endDate: string | null;
  }
) {
  return apiRequest<{ success: boolean; productSetting: AffiliateProductSetting }>(
    `/api/admin/affiliate/products/${encodeURIComponent(productId)}`,
    { method: 'PUT', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminUpdateCommission(
  id: string,
  payload: { action: 'release' | 'hold' | 'cancel'; reason?: string }
) {
  return apiRequest<any>(
    `/api/admin/affiliate/commissions/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminTriggerOrderLifecycle(payload: {
  event: 'delivered' | 'cancelled' | 'full_refund' | 'partial_refund' | 'release_due';
  orderId?: string;
  orderItemId?: string;
  refundedQuantity?: number;
  deliveredAt?: string;
  customerEmail?: string;
  customerMobile?: string;
}) {
  return apiRequest<any>(
    '/api/affiliate/orders/lifecycle',
    { method: 'POST', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminProcessWithdrawal(
  id: string,
  payload: {
    action: 'mark_paid' | 'reject';
    transferReference?: string;
    rejectionReason?: string;
    adminNotes?: string;
  }
) {
  return apiRequest<any>(
    `/api/admin/affiliate/withdrawals/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminUpdateFraudFlag(
  id: string,
  payload: { status: 'open' | 'investigating' | 'cleared' | 'confirmed_fraud'; resolutionNotes?: string }
) {
  return apiRequest<any>(
    `/api/admin/affiliate/fraud/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminCreateTarget(payload: {
  monthKey: string;
  title: string;
  description: string;
  metricType: 'delivered_orders' | 'delivered_sales_paisa';
  targetValue: number;
  rewardType: 'cash_bonus' | 'gift' | 'product' | 'voucher' | 'custom';
  rewardTitle: string;
  rewardValueInr: number;
}) {
  return apiRequest<any>(
    '/api/admin/affiliate/targets',
    { method: 'POST', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminAwardReward(payload: {
  partnerId: string;
  sourceType: 'monthly_target' | 'leaderboard_rank' | 'admin_manual';
  periodLabel: string;
  rewardType: 'cash_bonus' | 'gift' | 'product' | 'voucher' | 'custom';
  rewardTitle: string;
  rewardValueInr: number;
  notes?: string;
}) {
  return apiRequest<any>(
    '/api/admin/affiliate/rewards/award',
    { method: 'POST', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminCreateAnnouncement(payload: {
  title: string;
  message: string;
  priority: 'normal' | 'important';
}) {
  return apiRequest<any>(
    '/api/admin/affiliate/announcements',
    { method: 'POST', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminUpdateSupportTicket(
  id: string,
  payload: { reply?: string; status?: 'open' | 'in_progress' | 'resolved' | 'closed' }
) {
  return apiRequest<any>(
    `/api/admin/affiliate/support/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

export async function adminUpdateProgramSettings(payload: {
  programEnabled?: boolean;
  programPaused?: boolean;
  registrationOpen?: boolean;
  affiliateIdPrefix?: string;
  affiliateIdDigits?: number;
  cookieDurationDays?: number;
  returnPeriodDays?: number;
  minWithdrawalInr?: number;
  defaultCommissionRatePct?: number;
}) {
  return apiRequest<{ success: boolean; settings: AffiliateProgramSettings }>(
    '/api/admin/affiliate/settings',
    { method: 'PUT', body: JSON.stringify(payload) },
    adminHeaders()
  );
}

// ==============================================================================
// QR CODE, CSV EXPORT, PDF REPORT, CERTIFICATE & DIGITAL ID CARD GENERATORS
// ==============================================================================

export async function generateQrCodeDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, {
    width: 320,
    margin: 2,
    color: {
      dark: '#071B35',
      light: '#FFFFFF',
    },
  });
}

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadAffiliateReportPdf(params: {
  title: string;
  subtitle: string;
  filename: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFillColor(7, 27, 53);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 64, 'F');
  doc.setFillColor(255, 122, 0);
  doc.rect(0, 64, doc.internal.pageSize.getWidth(), 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('TeqqnoWorld — Affiliate Partner Program', 36, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${params.title}  |  ${params.subtitle}`, 36, 49);

  autoTable(doc, {
    startY: 86,
    head: [params.headers],
    body: params.rows.map((r) => r.map((v) => String(v ?? ''))),
    styles: { fontSize: 9, cellPadding: 6 },
    headStyles: { fillColor: [7, 27, 53], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(params.filename);
}

export async function downloadAffiliateCertificatePdf(
  partner: AffiliatePartnerRecord,
  officialDomain = 'https://teqqnoworld.com'
): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const verifyUrl = `${officialDomain.replace(/\/+$/, '')}/affiliate/verify/${encodeURIComponent(
    partner.verificationCode
  )}`;
  const qrDataUrl = await generateQrCodeDataUrl(verifyUrl);

  // Outer Dark Navy Border + Orange Accent Frame
  doc.setFillColor(7, 27, 53);
  doc.rect(0, 0, w, h, 'F');
  doc.setFillColor(255, 255, 255);
  doc.rect(24, 24, w - 48, h - 48, 'F');
  doc.setDrawColor(255, 122, 0);
  doc.setLineWidth(3);
  doc.rect(36, 36, w - 72, h - 72);
  doc.setDrawColor(7, 27, 53);
  doc.setLineWidth(1);
  doc.rect(44, 44, w - 88, h - 88);

  // Header Brand
  doc.setTextColor(7, 27, 53);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.text('TeqqnoWorld', w / 2, 102, { align: 'center' });
  doc.setTextColor(255, 122, 0);
  doc.setFontSize(12);
  doc.text('OFFICIAL AFFILIATE PARTNER CERTIFICATE', w / 2, 126, { align: 'center' });

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text('This certifies that', w / 2, 182, { align: 'center' });

  doc.setTextColor(7, 27, 53);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.text(partner.fullName, w / 2, 228, { align: 'center' });

  doc.setDrawColor(255, 122, 0);
  doc.setLineWidth(2);
  doc.line(w / 2 - 140, 242, w / 2 + 140, 242);

  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.text(
    'is an authorized and verified partner of the TeqqnoWorld Affiliate Partner Program',
    w / 2,
    276,
    { align: 'center' }
  );
  doc.text(
    'with verified KYC credentials and active referral partner privileges on teqqnoworld.com.',
    w / 2,
    296,
    { align: 'center' }
  );

  // Metadata Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(76, 336, w - 280, 112, 8, 8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(7, 27, 53);
  doc.text(`Affiliate Partner ID:  ${partner.affiliateId}`, 96, 368);
  doc.text(`Certificate Number:  ${partner.certificateNumber}`, 96, 394);
  doc.text(`Joining Date:  ${formatShortDate(partner.joinedAt)}`, 96, 420);
  doc.text(`Official Website:  ${officialDomain}`, 320, 368);
  doc.text(`Verification Code:  ${partner.verificationCode}`, 320, 394);
  doc.text(`Status at Issue:  ${partner.status.toUpperCase()}`, 320, 420);

  // QR Code
  doc.addImage(qrDataUrl, 'PNG', w - 184, 336, 110, 110);
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Scan to verify live status', w - 129, 458, { align: 'center' });

  // Signature Footer
  doc.setDrawColor(148, 163, 184);
  doc.line(96, 514, 260, 514);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(7, 27, 53);
  doc.text('Authorized Signatory', 178, 530, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TeqqnoWorld Partner Operations', 178, 544, { align: 'center' });

  doc.save(`${partner.affiliateId}-Certificate.pdf`);
}

export async function downloadAffiliateIdCardPdf(
  partner: AffiliatePartnerRecord,
  officialDomain = 'https://teqqnoworld.com'
): Promise<void> {
  // Credit-card style portrait/landscape badge PDF (340 x 216 pt)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [340, 216] });
  const verifyUrl = `${officialDomain.replace(/\/+$/, '')}/affiliate/verify/${encodeURIComponent(
    partner.verificationCode
  )}`;
  const qrDataUrl = await generateQrCodeDataUrl(verifyUrl);

  doc.setFillColor(7, 27, 53);
  doc.rect(0, 0, 340, 58, 'F');
  doc.setFillColor(255, 122, 0);
  doc.rect(0, 58, 340, 4, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('TeqqnoWorld', 16, 26);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL AFFILIATE PARTNER ID CARD', 16, 42);

  // Status tag
  doc.setFillColor(partner.status === 'active' ? 22 : 220, partner.status === 'active' ? 163 : 38, partner.status === 'active' ? 74 : 38);
  doc.roundedRect(256, 16, 68, 20, 4, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(partner.status.toUpperCase(), 290, 29, { align: 'center' });

  // Photo box or initials
  if (partner.avatarUrl && partner.avatarUrl.startsWith('data:image/')) {
    try {
      const fmt = partner.avatarUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(partner.avatarUrl, fmt, 16, 76, 68, 84);
    } catch {
      doc.setFillColor(241, 245, 249);
      doc.rect(16, 76, 68, 84, 'F');
    }
  } else {
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(16, 76, 68, 84, 6, 6, 'F');
    doc.setTextColor(7, 27, 53);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    const initials = `${partner.firstName.slice(0, 1)}${partner.lastName.slice(0, 1)}`.toUpperCase();
    doc.text(initials, 50, 124, { align: 'center' });
  }

  // Partner details
  doc.setTextColor(7, 27, 53);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(partner.fullName, 96, 92);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Affiliate Partner', 96, 106);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(7, 27, 53);
  doc.text(`ID: ${partner.affiliateId}`, 96, 126);
  doc.setFont('helvetica', 'normal');
  doc.text(`Card: ${partner.cardNumber}`, 96, 141);
  doc.text(`Joined: ${formatShortDate(partner.joinedAt)}`, 96, 156);

  // QR
  doc.addImage(qrDataUrl, 'PNG', 252, 76, 72, 72);
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('Scan to Verify', 288, 158, { align: 'center' });

  // Footer strip
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 182, 340, 34, 'F');
  doc.setFontSize(8);
  doc.setTextColor(7, 27, 53);
  doc.text(`${officialDomain}  •  Verify: /affiliate/verify/${partner.verificationCode}`, 170, 202, {
    align: 'center',
  });

  doc.save(`${partner.affiliateId}-Digital-ID-Card.pdf`);
}
