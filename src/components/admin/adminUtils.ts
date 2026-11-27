import { CustomOrderRow, OrderStatus } from '../../lib/supabase';
import { PRODUCTS } from '../../data/mockData';

export type AdminSection =
  | 'dashboard'
  | 'orders'
  | 'dispatch'
  | 'products'
  | 'reviews'
  | 'affiliates'
  | 'coupons'
  | 'customers'
  | 'marketing'
  | 'analytics'
  | 'integrations'
  | 'security';

export type OrdersSubMode = 'queue' | 'all' | OrderStatus;

export const STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    shortLabel: string;
    pillClass: string;
    dotClass: string;
    barClass: string;
  }
> = {
  pending: {
    label: 'Pending Review',
    shortLabel: 'Pending',
    pillClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
    barClass: 'bg-amber-500',
  },
  approved: {
    label: 'Proof Approved',
    shortLabel: 'Approved',
    pillClass: 'bg-sky-50 text-sky-800 border-sky-200',
    dotClass: 'bg-sky-500',
    barClass: 'bg-sky-500',
  },
  'in-production': {
    label: 'In Production',
    shortLabel: 'In Production',
    pillClass: 'bg-violet-50 text-violet-800 border-violet-200',
    dotClass: 'bg-violet-500',
    barClass: 'bg-violet-500',
  },
  dispatched: {
    label: 'Dispatched',
    shortLabel: 'Dispatched',
    pillClass: 'bg-teal-50 text-teal-800 border-teal-200',
    dotClass: 'bg-teal-500',
    barClass: 'bg-teal-500',
  },
  delivered: {
    label: 'Delivered',
    shortLabel: 'Delivered',
    pillClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
    barClass: 'bg-emerald-500',
  },
};

export interface ParsedOrderNotes {
  frontMockupUrl: string | null;
  backMockupUrl: string | null;
  backLogoUrl: string | null;
  voiceNoteUrl: string | null;
  color: string | null;
  size: string | null;
  method: string | null;
  placementSummary: string | null;
  gstin: string | null;
  poNumber: string | null;
  paymentPlan: string | null;
  paidAmount: string | null;
  paidNumber: number | null;
  balanceDue: string | null;
  balanceNumber: number | null;
  razorpayId: string | null;
  customNotesText: string | null;
  parsedAddress: {
    full: string;
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
  cleanNotes: string;
}

export function parseOrderNotes(notes?: string | null): ParsedOrderNotes {
  const raw = notes || '';
  const frontMockupMatch = raw.match(/\[FrontMockup:\s*(https?:\/\/[^\s\]]+|data:image\/[^\s\]]+)\]/i);
  const backMockupMatch = raw.match(/\[BackMockup:\s*(https?:\/\/[^\s\]]+|data:image\/[^\s\]]+)\]/i);
  const backLogoMatch = raw.match(/\[BackLogo:\s*(https?:\/\/[^\s\]]+|data:image\/[^\s\]]+)\]/i);
  const voiceNoteMatch = raw.match(/\[VoiceNote:\s*(https?:\/\/[^\s\]]+|data:audio\/[^\s\]]+)\]/i);

  const cleanNotes = raw
    .replace(/\|\s*\[(FrontMockup|BackMockup|BackLogo|VoiceNote):[^\]]+\]/gi, '')
    .replace(/\[(FrontMockup|BackMockup|BackLogo|VoiceNote):[^\]]+\]/gi, '')
    .trim();

  const extractField = (prefixRegex: RegExp): string | null => {
    const match = cleanNotes.match(prefixRegex);
    return match?.[1]?.trim() || null;
  };

  const color = extractField(/(?:^|\|)\s*Color:\s*([^|]+)/i);
  const size = extractField(/(?:^|\|)\s*Size:\s*([^|]+)/i);
  const method = extractField(/(?:^|\|)\s*Method:\s*([^|]+)/i);
  const placementSummary = extractField(/(?:^|\|)\s*Position & Layout:\s*([^|]+)/i);
  const customNotesText = extractField(/(?:^|\|)\s*Notes:\s*([^|]+)/i);
  const gstin = extractField(/(?:^|\|)\s*GSTIN:\s*([^|]+)/i);
  const poNumber = extractField(/(?:^|\|)\s*PO#:\s*([^|]+)/i);
  const paymentPlan = extractField(/(?:^|\|)\s*Payment Plan:\s*([^|]+)/i);
  const rzpMatch = cleanNotes.match(/Razorpay ID:\s*([^|\s]+)/i);
  const paidMatch = cleanNotes.match(/Paid:\s*₹([0-9,]+)\s*\|\s*Balance Due:\s*₹([0-9,]+)/i);
  const addrMatch = cleanNotes.match(/Address:\s*([^|]+)/i);

  let street = '';
  let city = '';
  let state = '';
  let pincode = '';
  const fullAddr = addrMatch?.[1]?.trim() || '';
  if (fullAddr) {
    const pinSplit = fullAddr.match(/-\s*(\d{6})\s*$/);
    if (pinSplit) pincode = pinSplit[1];
    const withoutPin = fullAddr.replace(/-\s*\d{6}\s*$/, '').trim();
    const parts = withoutPin
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 3) {
      state = parts[parts.length - 1];
      city = parts[parts.length - 2];
      street = parts.slice(0, parts.length - 2).join(', ');
    } else {
      street = withoutPin;
    }
  }

  const paidStr = paidMatch?.[1] || null;
  const dueStr = paidMatch?.[2] || null;
  const paidNum = paidStr ? Number(paidStr.replace(/,/g, '')) : null;
  const dueNum = dueStr ? Number(dueStr.replace(/,/g, '')) : null;

  return {
    frontMockupUrl: frontMockupMatch?.[1] || null,
    backMockupUrl: backMockupMatch?.[1] || null,
    backLogoUrl: backLogoMatch?.[1] || null,
    voiceNoteUrl: voiceNoteMatch?.[1] || null,
    color,
    size,
    method,
    placementSummary,
    gstin,
    poNumber,
    paymentPlan,
    paidAmount: paidStr,
    paidNumber: Number.isFinite(paidNum) ? paidNum : null,
    balanceDue: dueStr,
    balanceNumber: Number.isFinite(dueNum) ? dueNum : null,
    razorpayId: rzpMatch?.[1] || null,
    customNotesText,
    parsedAddress: { full: fullAddr, street, city, state, pincode },
    cleanNotes,
  };
}

export function getOrderEstimates(order: CustomOrderRow) {
  const product = PRODUCTS.find((p) => p.id === order.product_id);
  const unitPrice = product?.basePrice || 499;
  const subtotal = unitPrice * (order.quantity || 1);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;
  return { product, unitPrice, subtotal, gst, total };
}

export function getOrderThumbnail(order: CustomOrderRow, parsed: ParsedOrderNotes): string | null {
  if (parsed.frontMockupUrl) return parsed.frontMockupUrl;
  const product = PRODUCTS.find((p) => p.id === order.product_id);
  if (product) {
    if (parsed.color) {
      const colorMatch = product.colors.find(
        (c) => c.name.toLowerCase() === parsed.color!.toLowerCase()
      );
      if (colorMatch?.imageFront) return colorMatch.imageFront;
    }
    if (product.colors[0]?.imageFront) return product.colors[0].imageFront;
  }
  return order.logo_url || null;
}

export function formatOrderRef(id: string) {
  return id.startsWith('TQ-') ? id : `TQ-${id.slice(0, 8).toUpperCase()}`;
}

export function getPaymentBadge(
  parsed: ParsedOrderNotes,
  estimatedTotal: number
): { label: 'Paid' | 'Partial' | 'Pending'; kind: 'paid' | 'partial' | 'pending' } {
  const isPartial =
    (parsed.balanceNumber !== null && parsed.balanceNumber > 0) ||
    Boolean(parsed.paymentPlan && parsed.paymentPlan.toLowerCase().includes('50%'));
  if (isPartial) {
    return { label: 'Partial', kind: 'partial' };
  }
  if (
    parsed.razorpayId ||
    (parsed.paidNumber !== null && parsed.paidNumber >= Math.max(1, estimatedTotal * 0.85)) ||
    Boolean(parsed.paymentPlan && parsed.paymentPlan.toLowerCase().includes('full prepaid'))
  ) {
    return { label: 'Paid', kind: 'paid' };
  }
  if (parsed.paidNumber !== null && parsed.paidNumber > 0) {
    return { label: 'Paid', kind: 'paid' };
  }
  return { label: 'Pending', kind: 'pending' };
}

export function resolveAdminOrderGroupKey(
  order: CustomOrderRow,
  parsed?: ParsedOrderNotes
): string {
  const orderGroupId = String(order.order_group_id || '').trim();
  if (orderGroupId) return `grp:${orderGroupId}`;
  const rzpOrderId = String(order.razorpay_order_id || '').trim();
  if (rzpOrderId) return `rzp:${rzpOrderId}`;
  const reservationId = String(order.reservation_id || '').trim();
  if (reservationId) return `res:${reservationId}`;
  const noteRzpId = String((parsed ?? parseOrderNotes(order.custom_notes)).razorpayId || '').trim();
  if (noteRzpId) return `rzp_note:${noteRzpId}`;
  return `row:${order.id}`;
}

export function resolveAdminLineTotal(order: CustomOrderRow): number {
  if (typeof order.line_total_inr === 'number' && Number.isFinite(order.line_total_inr) && order.line_total_inr > 0) {
    return order.line_total_inr;
  }
  return getOrderEstimates(order).total;
}

export function buildDailyTrendSeries(orders: CustomOrderRow[], days = 7) {
  // H4: Deduplicate multi-item custom_orders rows by order group so order count & revenue are never double-counted
  const groupedOrders = new Map<
    string,
    { dayKey: string; orderTotal: number; lineTotalSum: number; hasExplicitOrderTotal: boolean }
  >();
  orders.forEach((o) => {
    const parsed = parseOrderNotes(o.custom_notes);
    const groupKey = resolveAdminOrderGroupKey(o, parsed);
    const dayKey = (o.created_at || '').slice(0, 10);
    const lineTotal = resolveAdminLineTotal(o);
    const explicitOrderTotal =
      typeof o.final_total_inr === 'number' && Number.isFinite(o.final_total_inr) && o.final_total_inr > 0
        ? o.final_total_inr
        : null;
    const existing = groupedOrders.get(groupKey);
    if (!existing) {
      groupedOrders.set(groupKey, {
        dayKey,
        orderTotal: explicitOrderTotal ?? lineTotal,
        lineTotalSum: lineTotal,
        hasExplicitOrderTotal: explicitOrderTotal !== null,
      });
    } else {
      existing.lineTotalSum += lineTotal;
      if (explicitOrderTotal !== null) {
        existing.orderTotal = explicitOrderTotal;
        existing.hasExplicitOrderTotal = true;
      } else if (!existing.hasExplicitOrderTotal) {
        existing.orderTotal = existing.lineTotalSum;
      }
    }
  });

  const result: Array<{ label: string; count: number; revenue: number }> = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    let count = 0;
    let revenue = 0;
    groupedOrders.forEach((grp) => {
      if (grp.dayKey === key) {
        count += 1;
        revenue += grp.orderTotal;
      }
    });
    result.push({ label, count, revenue });
  }
  return result;
}

export interface CustomerAggregate {
  key: string;
  name: string;
  email: string;
  phone: string;
  company: string | null;
  gstin: string | null;
  city: string;
  ordersCount: number;
  totalUnits: number;
  totalSpent: number;
  lastOrderDate: string;
  latestOrder: CustomOrderRow;
}

export function aggregateCustomersFromOrders(orders: CustomOrderRow[]): CustomerAggregate[] {
  const map = new Map<string, CustomerAggregate>();
  const seenCustomerGroups = new Map<string, Map<string, { hasExplicitTotal: boolean }>>();

  orders.forEach((order) => {
    const cleanPhone = (order.phone || '').replace(/[^0-9]/g, '').slice(-10);
    const key = cleanPhone || (order.customer_email || order.id).toLowerCase();
    const parsed = parseOrderNotes(order.custom_notes);
    const groupKey = resolveAdminOrderGroupKey(order, parsed);
    const lineTotal = resolveAdminLineTotal(order);
    const explicitOrderTotal =
      typeof order.final_total_inr === 'number' &&
      Number.isFinite(order.final_total_inr) &&
      order.final_total_inr > 0
        ? order.final_total_inr
        : null;

    let customerGroups = seenCustomerGroups.get(key);
    if (!customerGroups) {
      customerGroups = new Map();
      seenCustomerGroups.set(key, customerGroups);
    }
    const existingGroup = customerGroups.get(groupKey);
    const isNewGroup = !existingGroup;
    if (isNewGroup) {
      customerGroups.set(groupKey, { hasExplicitTotal: explicitOrderTotal !== null });
    }

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        name: order.customer_name || 'Customer',
        email: order.customer_email || '',
        phone: order.phone || '',
        company: order.company || null,
        gstin: parsed.gstin || null,
        city: parsed.parsedAddress.city || '',
        ordersCount: 1,
        totalUnits: order.quantity || 1,
        totalSpent: explicitOrderTotal ?? lineTotal,
        lastOrderDate: order.created_at,
        latestOrder: order,
      });
    } else {
      if (isNewGroup) {
        existing.ordersCount += 1;
        existing.totalSpent += explicitOrderTotal ?? lineTotal;
      } else if (!existingGroup.hasExplicitTotal) {
        existing.totalSpent += lineTotal;
      }
      existing.totalUnits += order.quantity || 1;
      if (!existing.company && order.company) existing.company = order.company;
      if (!existing.gstin && parsed.gstin) existing.gstin = parsed.gstin;
      if (!existing.city && parsed.parsedAddress.city) existing.city = parsed.parsedAddress.city;
      if (new Date(order.created_at).getTime() > new Date(existing.lastOrderDate).getTime()) {
        existing.lastOrderDate = order.created_at;
        existing.latestOrder = order;
      }
    }
  });
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastOrderDate).getTime() - new Date(a.lastOrderDate).getTime()
  );
}
