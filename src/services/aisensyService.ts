// Client service for AiSensy WhatsApp Business API Automation
// Supports:
// 1. Order confirmation notifications on WhatsApp with Confirm / Cancel Order options
// 2. Checkout Drop & Payment Back-Out limited-time 5% OFF WhatsApp recovery offer (SAVE5NOW)

export interface AiSensyStatusResponse {
  configured: boolean;
  backendReachable: boolean;
  endpoint?: string;
  orderConfirmCampaign: string;
  checkoutDropCampaign: string;
  webhookPath: string;
  recentLogsCount: number;
  trackedOrdersCount: number;
}

export interface WhatsAppDispatchLogItem {
  id: string;
  type: 'order_confirmation' | 'checkout_drop_5off' | 'order_action' | 'test';
  phone: string;
  customerName: string;
  campaignName: string;
  status: 'sent' | 'simulated' | 'failed' | 'action_recorded';
  orderNumber?: string;
  couponCode?: string;
  triggerReason?: string;
  actionResult?: string;
  messagePreview: string;
  createdAt: string;
}

export interface SendOrderWhatsAppPayload {
  orderId: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  paymentMode?: string;
  itemsSummary: string;
  shippingCity?: string;
}

export interface SendOrderWhatsAppResponse {
  success: boolean;
  simulated?: boolean;
  phone?: string;
  campaignName?: string;
  confirmUrl?: string;
  cancelUrl?: string;
  previewMessage?: string;
  whatsappActionStatus?: 'pending' | 'confirmed' | 'cancelled';
  message: string;
}

export interface SendCheckoutRecoveryPayload {
  checkoutSessionId: string;
  customerName?: string;
  phone: string;
  cartTotal: number;
  couponCode?: string;
  discountPercent?: number;
  validMinutes?: number;
  triggerReason: 'payment_cancelled' | 'payment_failed' | 'checkout_back' | 'checkout_hesitation' | 'admin_followup';
  itemsSummary?: string;
}

export interface SendCheckoutRecoveryResponse {
  success: boolean;
  simulated?: boolean;
  deduplicated?: boolean;
  phone?: string;
  couponCode?: string;
  discountPercent?: number;
  recoveryToken?: string;
  expiresAt?: string;
  resumeUrl?: string;
  previewMessage?: string;
  message: string;
}

export interface ActiveRecoveryCoupon {
  code: 'SAVE5NOW';
  discountPercent: 5;
  activatedAt: number;
  expiresAt: number;
  triggerReason: string;
  recoveryToken?: string;
  whatsappDispatched?: boolean;
  whatsappPhone?: string;
  whatsappSimulated?: boolean;
}

const RECOVERY_COUPON_STORAGE_KEY = 'teqqno_recovery_coupon_v1';
const RECOVERY_COUPON_EVENT = 'teqqno:recovery-coupon-updated';

export function getActiveRecoveryCoupon(): ActiveRecoveryCoupon | null {
  try {
    const raw = localStorage.getItem(RECOVERY_COUPON_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveRecoveryCoupon;
    if (!parsed || !parsed.expiresAt || Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(RECOVERY_COUPON_STORAGE_KEY);
      if (sessionStorage.getItem('teqqno_applied_coupon') === 'SAVE5NOW') {
        sessionStorage.removeItem('teqqno_applied_coupon');
      }
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function activateRecoveryCoupon(params: {
  triggerReason: string;
  validMinutes?: number;
  autoApply?: boolean;
  recoveryToken?: string;
  whatsappDispatched?: boolean;
  whatsappPhone?: string;
  whatsappSimulated?: boolean;
}): ActiveRecoveryCoupon {
  const validMs = (params.validMinutes || 15) * 60 * 1000;
  const existing = getActiveRecoveryCoupon();
  const now = Date.now();

  const next: ActiveRecoveryCoupon = {
    code: 'SAVE5NOW',
    discountPercent: 5,
    activatedAt: existing?.activatedAt || now,
    expiresAt: existing && existing.expiresAt > now + 60_000 ? existing.expiresAt : now + validMs,
    triggerReason: params.triggerReason || existing?.triggerReason || 'checkout_drop',
    recoveryToken: params.recoveryToken || existing?.recoveryToken,
    whatsappDispatched: params.whatsappDispatched ?? existing?.whatsappDispatched,
    whatsappPhone: params.whatsappPhone ?? existing?.whatsappPhone,
    whatsappSimulated: params.whatsappSimulated ?? existing?.whatsappSimulated,
  };

  try {
    localStorage.setItem(RECOVERY_COUPON_STORAGE_KEY, JSON.stringify(next));
    if (params.autoApply !== false) {
      const currentApplied = sessionStorage.getItem('teqqno_applied_coupon');
      if (!currentApplied) {
        sessionStorage.setItem('teqqno_applied_coupon', next.code);
      }
    }
  } catch {
    // ignore storage errors
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RECOVERY_COUPON_EVENT, { detail: next }));
  }
  return next;
}

export function clearRecoveryCoupon(): void {
  try {
    localStorage.removeItem(RECOVERY_COUPON_STORAGE_KEY);
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RECOVERY_COUPON_EVENT, { detail: null }));
  }
}

export function subscribeRecoveryCoupon(
  listener: (coupon: ActiveRecoveryCoupon | null) => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => listener(getActiveRecoveryCoupon());
  window.addEventListener(RECOVERY_COUPON_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(RECOVERY_COUPON_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function formatRemainingCountdown(expiresAt: number): string {
  const diff = Math.max(0, expiresAt - Date.now());
  const totalSec = Math.floor(diff / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export async function getAiSensyStatus(): Promise<AiSensyStatusResponse> {
  try {
    const res = await fetch('/api/aisensy/status');
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) throw new Error('Unavailable');
    const data = await res.json();
    return {
      configured: Boolean(data.configured),
      backendReachable: true,
      endpoint: data.endpoint,
      orderConfirmCampaign: data.orderConfirmCampaign || 'order_confirmation_action',
      checkoutDropCampaign: data.checkoutDropCampaign || 'checkout_drop_5_off',
      webhookPath: data.webhookPath || '/api/aisensy/webhook',
      recentLogsCount: Number(data.recentLogsCount) || 0,
      trackedOrdersCount: Number(data.trackedOrdersCount) || 0,
    };
  } catch {
    return {
      configured: false,
      backendReachable: false,
      orderConfirmCampaign: 'order_confirmation_action',
      checkoutDropCampaign: 'checkout_drop_5_off',
      webhookPath: '/api/aisensy/webhook',
      recentLogsCount: 0,
      trackedOrdersCount: 0,
    };
  }
}

export async function getAiSensyLogs(): Promise<{
  success: boolean;
  logs: WhatsAppDispatchLogItem[];
}> {
  try {
    const res = await fetch('/api/aisensy/logs');
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) return { success: false, logs: [] };
    const data = await res.json();
    return { success: true, logs: Array.isArray(data.logs) ? data.logs : [] };
  } catch {
    return { success: false, logs: [] };
  }
}

export async function testAiSensyConnection(
  phone: string,
  testType: 'order_confirmation' | 'checkout_drop_5off' = 'order_confirmation',
  campaignName?: string
): Promise<{ success: boolean; simulated?: boolean; message: string }> {
  try {
    const originUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const res = await fetch('/api/aisensy/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, testType, campaignName, originUrl }),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, message: err?.message || 'Unable to connect to AiSensy endpoint.' };
  }
}

export async function sendOrderWhatsAppConfirmation(
  payload: SendOrderWhatsAppPayload
): Promise<SendOrderWhatsAppResponse> {
  try {
    const originUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const res = await fetch('/api/aisensy/send-order-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, originUrl }),
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) throw new Error('Invalid server response');
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      simulated: true,
      message: err?.message || 'Unable to reach AiSensy WhatsApp endpoint.',
    };
  }
}

export async function sendCheckoutDropRecoveryWhatsApp(
  payload: SendCheckoutRecoveryPayload
): Promise<SendCheckoutRecoveryResponse> {
  try {
    const originUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
    const res = await fetch('/api/aisensy/send-checkout-recovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        couponCode: 'SAVE5NOW',
        discountPercent: 5,
        validMinutes: 15,
        ...payload,
        originUrl,
      }),
    });
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) throw new Error('Invalid server response');
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      simulated: true,
      message: err?.message || 'Unable to send WhatsApp recovery offer.',
    };
  }
}

export async function submitWhatsAppOrderAction(params: {
  orderId?: string;
  orderNumber?: string;
  action: 'confirm' | 'cancel';
  token?: string;
  source?: string;
}): Promise<{
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  whatsappActionStatus?: 'confirmed' | 'cancelled';
  updatedAt?: string;
  message: string;
}> {
  try {
    const res = await fetch('/api/aisensy/order-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Unable to update WhatsApp order confirmation.',
    };
  }
}

export async function getWhatsAppOrderActionStatus(
  orderId?: string,
  orderNumber?: string
): Promise<{ found: boolean; whatsappActionStatus: 'pending' | 'confirmed' | 'cancelled'; updatedAt?: string }> {
  try {
    const q = new URLSearchParams();
    if (orderId) q.set('orderId', orderId);
    if (orderNumber) q.set('orderNumber', orderNumber);
    const res = await fetch(`/api/aisensy/order-status?${q.toString()}`);
    if (!res.ok) return { found: false, whatsappActionStatus: 'pending' };
    return await res.json();
  } catch {
    return { found: false, whatsappActionStatus: 'pending' };
  }
}
