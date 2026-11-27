// Client service for Razorpay (100% Prepaid + 50% Partial Advance) & Delhivery One APIs
// All secret keys stay strictly on the Express backend (/api/razorpay/* and /api/delhivery/*).

import { supabase } from '../lib/supabase';

export interface RazorpayStatus {
  configured: boolean;
  keyId: string | null;
  mode?: 'live' | 'test' | null;
  backendReachable: boolean;
}

export interface ServerVerifiedPricing {
  subtotal: number;
  discountedSubtotal?: number;
  discountAmount: number;
  shippingFee: number;
  shippingSaved: number;
  freeShippingApplied: boolean;
  gstAmount: number;
  finalTotal: number;
  payableNow: number;
  balanceDue: number;
  paymentPlan: 'prepaid_100' | 'partial_50';
  couponCode: string | null;
  couponId: string | null;
}

export interface CreateRazorpayOrderPayload {
  paymentPlan: 'prepaid_100' | 'partial_50';
  receipt: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  couponCode?: string;
  recoveryToken?: string;
  checkoutSessionId?: string;
  items: Array<{
    productId: string;
    productName?: string;
    category?: string;
    size?: string;
    variantSize?: string;
    quantity: number;
  }>;
}

export interface CreateRazorpayOrderResponse {
  success: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  reservationId?: string | null;
  releaseToken?: string;
  pricing?: ServerVerifiedPricing;
  reasonCode?: string;
  message?: string;
}

export interface VerifyRazorpayPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  reservationId?: string;
}

export interface VerifyRazorpayPaymentResponse {
  success: boolean;
  verified: boolean;
  paymentId?: string;
  orderId?: string;
  paymentStatus?: string;
  message?: string;
}

export interface PlaceServerOrderPayload {
  items: Array<{
    productId: string;
    productName?: string;
    category?: string;
    size?: string;
    variantSize?: string;
    quantity: number;
  }>;
  orderRows: Array<{
    logoUrl?: string | null;
    customNotes?: string;
  }>;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  companyName?: string;
  paymentPlan: 'prepaid_100' | 'partial_50';
  paymentModeLabel: string;
  couponCode?: string;
  reservationId?: string;
  recoveryToken?: string;
  checkoutSessionId?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}

export interface PlaceServerOrderResponse {
  success: boolean;
  primaryOrderId?: string;
  orderNumber?: string;
  insertedOrderIds?: string[];
  paymentStatus?: 'paid' | 'sandbox';
  pricing?: ServerVerifiedPricing;
  message?: string;
}

export interface DelhiveryPickupLocation {
  name: string;
  city: string;
  state: string;
  pin: string;
}

export interface DelhiveryStatus {
  configured: boolean;
  backendReachable: boolean;
  defaultPickup: string;
  defaultOriginPin: string;
  pickups: DelhiveryPickupLocation[];
}

export interface DelhiveryPincodeCheckResult {
  success: boolean;
  configured?: boolean;
  serviceable: boolean;
  pincode: string;
  city?: string;
  state?: string;
  areaName?: string;
  prepaid?: boolean;
  cod?: boolean;
  estimatedDays?: string;
  dispatchHub?: string;
  courier?: string;
  source?: string;
  message?: string;
}

export interface CreateDelhiveryShipmentPayload {
  orderId: string;
  orderNumber: string;
  pickupLocation: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  productDesc: string;
  quantity: number;
  totalAmount: number;
  weightGrams?: number;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
}

export interface CreateDelhiveryShipmentResponse {
  success: boolean;
  waybill?: string;
  uploadWbn?: string;
  courierPartner?: string;
  pickupLocation?: string;
  message: string;
  raw?: any;
}

export interface DelhiveryTrackScan {
  status: string;
  location: string;
  time: string;
  instructions: string;
}

export interface DelhiveryTrackResponse {
  success: boolean;
  waybill: string;
  currentStatus?: string;
  statusLocation?: string;
  expectedDelivery?: string;
  origin?: string;
  destination?: string;
  scans: DelhiveryTrackScan[];
  message?: string;
}

export interface DelhiveryPickupPayload {
  pickupLocation: string;
  pickupDate: string; // YYYY-MM-DD
  pickupTime: string; // HH:mm:ss
  expectedPackageCount: number;
}

let razorpayScriptPromise: Promise<boolean> | null = null;

export function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      razorpayScriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

export async function getRazorpayStatus(): Promise<RazorpayStatus> {
  try {
    const res = await fetch('/api/razorpay/status');
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) {
      throw new Error('Unavailable');
    }
    const data = await res.json();
    return {
      configured: Boolean(data.configured),
      keyId: data.keyId || null,
      mode: data.mode || null,
      backendReachable: true,
    };
  } catch {
    return { configured: false, keyId: null, mode: null, backendReachable: false };
  }
}

export async function testRazorpayConnection(): Promise<{
  success: boolean;
  mode: 'live' | 'test' | null;
  message: string;
}> {
  try {
    const res = await fetch('/api/razorpay/test');
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      mode: null,
      message: err?.message || 'Unable to verify Razorpay connection.',
    };
  }
}

async function buildCustomerAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // proceed as guest
  }
  return headers;
}

export async function createRazorpayOrder(
  payload: CreateRazorpayOrderPayload
): Promise<CreateRazorpayOrderResponse> {
  try {
    const headers = await buildCustomerAuthHeaders();
    const res = await fetch('/api/razorpay/create-order', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to initiate Razorpay order.',
    };
  }
}

export async function releaseRazorpayReservation(params: {
  reservationId?: string;
  razorpayOrderId?: string;
  releaseToken?: string;
  reason?: string;
  checkoutSessionId?: string;
  phone?: string;
}): Promise<{
  success: boolean;
  released?: boolean;
  recoveryToken?: string;
  recoveryExpiresAt?: string;
}> {
  try {
    const headers = await buildCustomerAuthHeaders();
    const res = await fetch('/api/razorpay/release-reservation', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch {
    return { success: false };
  }
}

export async function verifyRazorpayPayment(
  payload: VerifyRazorpayPaymentPayload
): Promise<VerifyRazorpayPaymentResponse> {
  try {
    const headers = await buildCustomerAuthHeaders();
    const res = await fetch('/api/razorpay/verify-payment', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      verified: false,
      message: err?.message || 'Payment verification request failed.',
    };
  }
}

export async function placeServerOrder(
  payload: PlaceServerOrderPayload
): Promise<PlaceServerOrderResponse> {
  try {
    const headers = await buildCustomerAuthHeaders();
    const res = await fetch('/api/orders/place', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to save order on server.',
    };
  }
}

export async function getDelhiveryStatus(): Promise<DelhiveryStatus> {
  try {
    const res = await fetch('/api/delhivery/status');
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) {
      throw new Error('Unavailable');
    }
    const data = await res.json();
    return {
      configured: Boolean(data.configured),
      backendReachable: true,
      defaultPickup: data.defaultPickup || 'Teqqnoworld',
      defaultOriginPin: data.defaultOriginPin || '502032',
      pickups: Array.isArray(data.pickups) ? data.pickups : [],
    };
  } catch {
    return {
      configured: false,
      backendReachable: false,
      defaultPickup: 'Teqqnoworld',
      defaultOriginPin: '502032',
      pickups: [
        { name: 'Teqqnoworld', city: 'Hyderabad', state: 'Telangana', pin: '502032' },
        { name: 'Teqqnoworld 2', city: 'Hyderabad', state: 'Telangana', pin: '500090' },
      ],
    };
  }
}

export async function checkDelhiveryPincode(pincode: string): Promise<DelhiveryPincodeCheckResult> {
  const cleanPin = pincode.replace(/[^0-9]/g, '').slice(0, 6);
  if (cleanPin.length !== 6) {
    return {
      success: false,
      serviceable: false,
      pincode: cleanPin,
      message: 'Please enter a valid 6-digit pincode.',
    };
  }
  try {
    const res = await fetch(`/api/delhivery/pincode?pin=${encodeURIComponent(cleanPin)}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      throw new Error('Serviceability lookup temporarily unavailable.');
    }
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      serviceable: false,
      pincode: cleanPin,
      message: err?.message || 'Unable to verify pincode with Delhivery right now.',
    };
  }
}

export async function createDelhiveryShipment(
  payload: CreateDelhiveryShipmentPayload
): Promise<CreateDelhiveryShipmentResponse> {
  try {
    const res = await fetch('/api/delhivery/create-shipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to connect to Delhivery shipment API.',
    };
  }
}

export async function trackDelhiveryWaybill(waybill: string): Promise<DelhiveryTrackResponse> {
  try {
    const res = await fetch(`/api/delhivery/track?waybill=${encodeURIComponent(waybill.trim())}`);
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      waybill,
      scans: [],
      message: err?.message || 'Unable to fetch Delhivery tracking status.',
    };
  }
}

export async function requestDelhiveryPickup(
  payload: DelhiveryPickupPayload
): Promise<{ success: boolean; pickupId?: string; message: string }> {
  try {
    const res = await fetch('/api/delhivery/pickup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Failed to schedule Delhivery pickup.',
    };
  }
}

export function getDelhiveryLabelUrl(waybill: string): string {
  return `/api/delhivery/label?wbns=${encodeURIComponent(waybill.trim())}`;
}
