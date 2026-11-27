import { getStoredAdminToken } from './adminSecurityService';
import { supabase } from '../lib/supabase';
import type {
  BulkGenerateCouponsPayload,
  CouponAnalyticsOverview,
  CouponCustomerDirectoryItem,
  CouponCustomerNotification,
  CouponPolicySettings,
  CouponRecord,
  CouponRedemptionRecord,
  CouponStatus,
  CouponValidationRequest,
  CouponValidationResult,
  CreateCouponPayload,
  PublicCouponSummary,
} from '../types/coupon';

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

async function getCustomerAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

async function buildCustomerHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const accessToken = await getCustomerAccessToken();
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  return headers;
}

// ============================================================================
// PUBLIC & CUSTOMER STOREFRONT COUPON SERVICES
// ============================================================================

export async function fetchPublicStorefrontOffers(): Promise<{
  festivalOffers: PublicCouponSummary[];
  coupons: PublicCouponSummary[];
  serverTime?: string;
}> {
  try {
    const res = await fetch('/api/coupons/public');
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) {
      return { festivalOffers: [], coupons: [] };
    }
    const data = await res.json();
    return {
      festivalOffers: Array.isArray(data.festivalOffers) ? data.festivalOffers : [],
      coupons: Array.isArray(data.coupons) ? data.coupons : [],
      serverTime: data.serverTime,
    };
  } catch {
    return { festivalOffers: [], coupons: [] };
  }
}

// Strictly authenticated via Supabase Auth Bearer JWT (C1) — never trusts query params
export async function fetchMyPrivateOffers(_params?: {
  email?: string;
  phone?: string;
  customerId?: string;
}): Promise<{
  privateOffers: PublicCouponSummary[];
  notifications: CouponCustomerNotification[];
}> {
  const accessToken = await getCustomerAccessToken();
  if (!accessToken) {
    return { privateOffers: [], notifications: [] };
  }

  try {
    const res = await fetch('/api/coupons/my-offers', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return { privateOffers: [], notifications: [] };
    const data = await res.json();
    return {
      privateOffers: Array.isArray(data.privateOffers) ? data.privateOffers : [],
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
    };
  } catch {
    return { privateOffers: [], notifications: [] };
  }
}

export async function validateCouponServer(
  payload: CouponValidationRequest
): Promise<CouponValidationResult> {
  try {
    const headers = await buildCustomerHeaders();
    const res = await fetch('/api/coupons/validate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: payload.code,
        items: payload.items,
        subtotal: payload.subtotal,
        recoveryToken: payload.recoveryToken,
        checkoutSessionId: payload.checkoutSessionId,
        paymentPlan: payload.paymentPlan,
      }),
    });
    const data = await res.json();
    return {
      valid: Boolean(data.valid),
      code: data.code,
      couponId: data.couponId,
      name: data.name,
      description: data.description,
      offerType: data.offerType,
      discountValue: data.discountValue,
      discountAmount: Number(data.discountAmount || 0),
      shippingFee: Number(data.shippingFee ?? 149),
      shippingSaved: Number(data.shippingSaved || 0),
      freeShippingApplied: Boolean(data.freeShippingApplied),
      subtotal: Number(data.subtotal || payload.subtotal || 0),
      eligibleSubtotal: Number(data.eligibleSubtotal || 0),
      taxableSubtotal: Number(data.taxableSubtotal || payload.subtotal || 0),
      gstAmount: Number(data.gstAmount || 0),
      finalTotal: Number(data.finalTotal || 0),
      advanceAmount50: Number(data.advanceAmount50 || 0),
      balanceAmount50: Number(data.balanceAmount50 || 0),
      isPrivate: Boolean(data.isPrivate),
      isFestival: Boolean(data.isFestival),
      badgeText: data.badgeText,
      message: data.message || (data.valid ? 'Coupon applied.' : 'Coupon is not valid.'),
      reasonCode: data.reasonCode,
    };
  } catch (err: any) {
    const sub = Number(payload.subtotal || 0);
    const ship = sub >= 1999 || sub <= 0 ? 0 : 149;
    const gst = Math.round(sub * 0.18);
    const total = sub + gst + ship;
    return {
      valid: false,
      discountAmount: 0,
      shippingFee: ship,
      shippingSaved: 0,
      freeShippingApplied: false,
      subtotal: sub,
      eligibleSubtotal: 0,
      taxableSubtotal: sub,
      gstAmount: gst,
      finalTotal: total,
      advanceAmount50: Math.round(total * 0.5),
      balanceAmount50: Math.max(0, total - Math.round(total * 0.5)),
      message: err?.message || 'Unable to verify coupon with server right now.',
      reasonCode: 'INVALID_CODE',
    };
  }
}

export async function requestCheckoutRecoverySession(params: {
  checkoutSessionId?: string;
  phone?: string;
  validMinutes?: number;
  triggerReason?: string;
  items?: Array<{
    productId: string;
    quantity: number;
    size?: string;
    variantSize?: string;
  }>;
}): Promise<{
  success: boolean;
  recoveryToken?: string;
  expiresAt?: string;
}> {
  try {
    const headers = await buildCustomerHeaders();
    const res = await fetch('/api/coupons/recovery-session', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false };
    const data = await res.json();
    return {
      success: Boolean(data.success),
      recoveryToken: data.recoveryToken,
      expiresAt: data.expiresAt,
    };
  } catch {
    return { success: false };
  }
}

// ============================================================================
// ADMIN COUPON MANAGEMENT SERVICES (Bearer Authenticated)
// ============================================================================

export async function fetchAdminCouponOverview(filters?: {
  startDate?: string;
  endDate?: string;
  code?: string;
  campaign?: string;
  status?: string;
  customer?: string;
}): Promise<{ success: boolean; data?: CouponAnalyticsOverview; message?: string }> {
  const qs = new URLSearchParams();
  if (filters?.startDate) qs.set('startDate', filters.startDate);
  if (filters?.endDate) qs.set('endDate', filters.endDate);
  if (filters?.code) qs.set('code', filters.code);
  if (filters?.campaign) qs.set('campaign', filters.campaign);
  if (filters?.status && filters.status !== 'all') qs.set('status', filters.status);
  if (filters?.customer) qs.set('customer', filters.customer);

  const res = await fetch(`/api/admin/coupons/overview${qs.toString() ? `?${qs.toString()}` : ''}`, {
    headers: buildAdminHeaders(),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    return { success: false, message: data.message || 'Unable to load coupon overview.' };
  }
  return { success: true, data: data as CouponAnalyticsOverview };
}

export async function searchAdminCustomers(query: string): Promise<CouponCustomerDirectoryItem[]> {
  try {
    const res = await fetch(`/api/admin/coupons/customers?q=${encodeURIComponent(query)}`, {
      headers: buildAdminHeaders(),
    });
    const data = await res.json();
    return Array.isArray(data.customers) ? data.customers : [];
  } catch {
    return [];
  }
}

export async function generateAdminCouponCode(prefix = 'TQ'): Promise<string | null> {
  try {
    const res = await fetch('/api/admin/coupons/generate-code', {
      method: 'POST',
      headers: buildAdminHeaders(),
      body: JSON.stringify({ prefix }),
    });
    const data = await res.json();
    return data.success && data.code ? String(data.code) : null;
  } catch {
    return null;
  }
}

export async function createAdminCoupon(
  payload: CreateCouponPayload
): Promise<{ success: boolean; coupon?: CouponRecord; message?: string }> {
  const res = await fetch('/api/admin/coupons', {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return {
    success: Boolean(res.ok && data.success),
    coupon: data.coupon,
    message: data.message,
  };
}

export async function updateAdminCoupon(
  id: string,
  payload: Partial<CreateCouponPayload>
): Promise<{ success: boolean; coupon?: CouponRecord; message?: string }> {
  const res = await fetch(`/api/admin/coupons/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: buildAdminHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return {
    success: Boolean(res.ok && data.success),
    coupon: data.coupon,
    message: data.message,
  };
}

export async function changeAdminCouponStatus(
  id: string,
  status: CouponStatus
): Promise<{ success: boolean; coupon?: CouponRecord; message?: string }> {
  const res = await fetch(`/api/admin/coupons/${encodeURIComponent(id)}/status`, {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  return {
    success: Boolean(res.ok && data.success),
    coupon: data.coupon,
    message: data.message,
  };
}

export async function duplicateAdminCoupon(
  id: string
): Promise<{ success: boolean; coupon?: CouponRecord; message?: string }> {
  const res = await fetch(`/api/admin/coupons/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
    headers: buildAdminHeaders(),
  });
  const data = await res.json();
  return {
    success: Boolean(res.ok && data.success),
    coupon: data.coupon,
    message: data.message,
  };
}

export async function deleteAdminDraftCoupon(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`/api/admin/coupons/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: buildAdminHeaders(),
  });
  const data = await res.json();
  return {
    success: Boolean(res.ok && data.success),
    message: data.message,
  };
}

export async function bulkGenerateAdminCoupons(
  payload: BulkGenerateCouponsPayload
): Promise<{
  success: boolean;
  coupons?: CouponRecord[];
  count?: number;
  emailsSent?: number;
  emailsAttempted?: number;
  message?: string;
}> {
  const res = await fetch('/api/admin/coupons/bulk-generate', {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return {
    success: Boolean(res.ok && data.success),
    coupons: data.coupons,
    count: data.count,
    emailsSent: data.emailsSent,
    emailsAttempted: data.emailsAttempted,
    message: data.message,
  };
}

export async function notifyAdminCouponCustomers(
  couponId: string,
  channel: 'dashboard' | 'email' | 'both',
  customMessage?: string
): Promise<{
  success: boolean;
  emailsSent?: number;
  emailsAttempted?: number;
  emailNotice?: string;
  message?: string;
}> {
  const res = await fetch(`/api/admin/coupons/${encodeURIComponent(couponId)}/notify`, {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify({ channel, customMessage }),
  });
  const data = await res.json();
  return {
    success: Boolean(res.ok && data.success),
    emailsSent: data.emailsSent,
    emailsAttempted: data.emailsAttempted,
    emailNotice: data.emailNotice,
    message: data.message,
  };
}

export async function updateAdminCouponSettings(
  restoreOnCancel: boolean
): Promise<{ success: boolean; settings?: CouponPolicySettings; message?: string }> {
  const res = await fetch('/api/admin/coupons/settings', {
    method: 'PUT',
    headers: buildAdminHeaders(),
    body: JSON.stringify({ restoreOnCancel }),
  });
  const data = await res.json();
  return {
    success: Boolean(res.ok && data.success),
    settings: data.settings,
    message: data.message,
  };
}

export async function downloadAdminCouponCsv(
  type: 'redemptions' | 'coupons',
  filters?: {
    startDate?: string;
    endDate?: string;
    code?: string;
    campaign?: string;
    status?: string;
    customer?: string;
  }
): Promise<{ success: boolean; message?: string }> {
  const qs = new URLSearchParams({ type });
  if (filters?.startDate) qs.set('startDate', filters.startDate);
  if (filters?.endDate) qs.set('endDate', filters.endDate);
  if (filters?.code) qs.set('code', filters.code);
  if (filters?.campaign) qs.set('campaign', filters.campaign);
  if (filters?.status && filters.status !== 'all') qs.set('status', filters.status);
  if (filters?.customer) qs.set('customer', filters.customer);

  const res = await fetch(`/api/admin/coupons/export/csv?${qs.toString()}`, {
    headers: buildAdminHeaders(),
  });
  if (!res.ok) {
    return { success: false, message: 'Failed to export CSV report.' };
  }
  const csvText = await res.text();
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `teqqnoworld-coupons-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { success: true };
}

export async function restoreAdminCouponRedemption(
  redemptionId: string,
  force = true
): Promise<{
  success: boolean;
  restored?: boolean;
  alreadyRestored?: boolean;
  redemption?: CouponRedemptionRecord | null;
  message?: string;
}> {
  try {
    const res = await fetch(
      `/api/admin/coupons/redemptions/${encodeURIComponent(redemptionId)}/restore`,
      {
        method: 'POST',
        headers: buildAdminHeaders(),
        body: JSON.stringify({ force }),
      }
    );
    const data = await res.json();
    return {
      success: Boolean(res.ok && data.success),
      restored: Boolean(data.restored),
      alreadyRestored: Boolean(data.alreadyRestored),
      redemption: data.redemption || null,
      message: data.message,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to restore coupon redemption.',
    };
  }
}
