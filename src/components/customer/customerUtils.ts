import { CustomOrderRow, OrderStatus } from '../../lib/supabase';
import { PRODUCTS } from '../../data/mockData';
import {
  BulkEnquirySubmission,
  CustomerArtwork,
  NotificationItem,
  Order,
  PrintMethod,
  TaxInvoice,
  UserProfile,
} from '../../types';
import { parseOrderNotes } from '../admin/adminUtils';

export type CustomerTab =
  | 'overview'
  | 'orders'
  | 'reviews'
  | 'track'
  | 'artworks'
  | 'brand-assets'
  | 'addresses'
  | 'gst-invoices'
  | 'quotes'
  | 'wishlist'
  | 'account-security'
  | 'notifications'
  | 'support';

export type AccountSubSection =
  | 'profile'
  | 'password'
  | 'notifications'
  | 'gst'
  | 'security';

export interface CustomerOrderAnalyticsPoint {
  dateKey: string;
  label: string;
  ordersCount: number;
  revenue: number;
}

export interface CustomerStatusSegment {
  key: 'pending' | 'production' | 'dispatched' | 'delivered';
  label: string;
  count: number;
  percent: number;
  color: string;
  dotClass: string;
  bgClass: string;
}

export const BRAND_ASSET_ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'svg', 'pdf'];
export const BRAND_ASSET_MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export function validateBrandAssetFile(file: File): { valid: boolean; error?: string } {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const mime = (file.type || '').toLowerCase();

  const validExt = BRAND_ASSET_ALLOWED_EXTENSIONS.includes(ext);
  const validMime =
    mime.startsWith('image/png') ||
    mime.startsWith('image/jpeg') ||
    mime.includes('svg') ||
    mime === 'application/pdf';

  if (!validExt && !validMime) {
    return {
      valid: false,
      error: 'Unsupported format. Please upload PNG, JPG, JPEG, SVG, or PDF files.',
    };
  }

  if (file.size > BRAND_ASSET_MAX_BYTES) {
    return {
      valid: false,
      error: `File is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Maximum allowed size is 15 MB.`,
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isValidGstin(gstin: string): boolean {
  const trimmed = gstin.trim().toUpperCase();
  if (!trimmed) return true; // Optional for Individual shoppers or B2C buyers
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(trimmed);
}

function mapSupabaseStatusToOrderStatus(status: OrderStatus): Order['orderStatus'] {
  switch (status) {
    case 'approved':
      return 'Confirmed';
    case 'in-production':
      return 'Manufacturing';
    case 'dispatched':
      return 'Dispatched';
    case 'delivered':
      return 'Delivered';
    case 'pending':
    default:
      return 'Artwork Verification';
  }
}

function mapSupabaseStatusToProofStatus(status: OrderStatus): Order['proofStatus'] {
  switch (status) {
    case 'approved':
      return 'Approved by Client';
    case 'in-production':
    case 'dispatched':
    case 'delivered':
      return 'In Production';
    case 'pending':
    default:
      return 'Proof Ready - Needs Approval';
  }
}

function normalizeOrderRef(raw: string): string {
  const upper = (raw || '').trim().toUpperCase();
  return upper.startsWith('TQ-') ? upper : `TQ-${upper.slice(0, 8)}`;
}

/**
 * Converts a live Supabase `custom_orders` row into the UI `Order` model.
 */
export function mapSupabaseRowToOrder(row: CustomOrderRow): Order {
  const parsed = parseOrderNotes(row.custom_notes);
  const matchedProduct = PRODUCTS.find((p) => p.id === row.product_id) || PRODUCTS[0];
  const matchedColor =
    (parsed.color &&
      matchedProduct.colors.find((c) => c.name.toLowerCase() === parsed.color!.toLowerCase())) ||
    matchedProduct.colors[0];

  const qty = Math.max(1, Number(row.quantity) || matchedProduct.moq || 1);
  const unitPrice = matchedProduct.basePrice || 499;
  const subtotal = unitPrice * qty;
  const gstRate = 0.18;
  const gstAmount = Math.round(subtotal * gstRate);
  const total = subtotal + gstAmount;

  const isPartial =
    (parsed.balanceNumber !== null && parsed.balanceNumber > 0) ||
    Boolean(parsed.paymentPlan && parsed.paymentPlan.toLowerCase().includes('50%'));

  const paidAmount =
    parsed.paidNumber !== null
      ? parsed.paidNumber
      : isPartial
        ? Math.round(total * 0.5)
        : total;
  const balanceDue = parsed.balanceNumber !== null ? parsed.balanceNumber : Math.max(0, total - paidAmount);

  const printMethod = (parsed.method as PrintMethod) || matchedProduct.printMethods[0] || 'DTF Printing';
  const orderNumber = normalizeOrderRef(row.id);

  return {
    id: row.id,
    orderNumber,
    createdAt: row.created_at || new Date().toISOString(),
    items: [
      {
        id: `sb-item-${row.id}`,
        product: matchedProduct,
        color: matchedColor,
        size: parsed.size || matchedProduct.sizes?.[0],
        quantity: qty,
        unitPrice,
        totalPrice: subtotal,
        printMethod,
        printPlacement: parsed.placementSummary || 'Front Center',
        previewUrl: parsed.frontMockupUrl || undefined,
        backPreviewUrl: parsed.backMockupUrl || undefined,
        customNotes: parsed.customNotesText || undefined,
        voiceNoteUrl: parsed.voiceNoteUrl || undefined,
        artwork: row.logo_url
          ? {
              type: 'image',
              dataUrl: row.logo_url,
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0,
            }
          : undefined,
      },
    ],
    subtotal,
    gstRate,
    gstAmount,
    shippingFee: 0,
    total,
    shippingAddress: {
      fullName: row.customer_name || 'TeqqnoWorld Customer',
      companyName: row.company || undefined,
      email: row.customer_email || '',
      phone: row.phone || '',
      street: parsed.parsedAddress.street || parsed.parsedAddress.full || 'Address on file',
      city: parsed.parsedAddress.city || 'Hyderabad',
      state: parsed.parsedAddress.state || 'Telangana',
      pincode: parsed.parsedAddress.pincode || '500081',
      gstin: parsed.gstin || undefined,
      isB2BInvoice: Boolean(parsed.gstin || row.company),
    },
    proofStatus: mapSupabaseStatusToProofStatus(row.status),
    orderStatus: mapSupabaseStatusToOrderStatus(row.status),
    estimatedDispatch:
      row.status === 'delivered'
        ? 'Delivered'
        : row.status === 'dispatched'
          ? 'In Transit via Courier'
          : '24–48 hrs post proof approval',
    trackingNumber: row.tracking_number || undefined,
    courierPartner: row.courier_partner || (row.tracking_number ? 'Delhivery One' : undefined),
    paymentMode: isPartial ? 'Partial Payment (50% Advance)' : 'Full Prepaid (100% Online)',
    paymentStatus: isPartial
      ? '50% Advance Paid (Razorpay)'
      : parsed.razorpayId || paidAmount > 0
        ? 'Paid in Full (Razorpay)'
        : 'Pending Verification',
    amountPaid: paidAmount,
    balanceDue,
    razorpayPaymentId: parsed.razorpayId || undefined,
  };
}

/**
 * Returns true if the given Order is the legacy demo/mock order that should never pollute real customer portals.
 */
export function isLegacyMockOrder(order: Order): boolean {
  return order.id === 'order-tq-98104' || order.orderNumber?.toUpperCase() === 'TQ-98104';
}

/**
 * Checks whether an order belongs to the currently authenticated customer
 * based on normalized email or last 10 digits of phone number.
 */
export function doesOrderBelongToUser(order: Order, user?: UserProfile | null): boolean {
  if (!user) return false;
  if (isLegacyMockOrder(order)) return false;

  const userEmail = (user.email || '').trim().toLowerCase();
  const orderEmail = (order.shippingAddress?.email || '').trim().toLowerCase();
  if (userEmail && orderEmail && userEmail === orderEmail) {
    return true;
  }

  const userDigits = (user.mobile || '').replace(/[^0-9]/g, '').slice(-10);
  const orderDigits = (order.shippingAddress?.phone || '').replace(/[^0-9]/g, '').slice(-10);
  if (userDigits.length === 10 && orderDigits.length === 10 && userDigits === orderDigits) {
    return true;
  }

  return false;
}

/**
 * Merges local React/localStorage orders with live Supabase custom_orders rows
 * so status, courier partner, and AWB updates from Admin reflect immediately.
 * Strictly isolates orders to the currently logged-in customer.
 */
export function mergeCustomerOrders(
  localOrders: Order[],
  supabaseRows: CustomOrderRow[],
  user?: UserProfile | null
): Order[] {
  const byRef = new Map<string, Order>();

  const scopedLocalOrders = user
    ? localOrders.filter((order) => doesOrderBelongToUser(order, user))
    : localOrders.filter((order) => !isLegacyMockOrder(order));

  scopedLocalOrders.forEach((order) => {
    const key = order.orderNumber.toUpperCase();
    byRef.set(key, order);
  });

  supabaseRows.forEach((row) => {
    const mapped = mapSupabaseRowToOrder(row);
    const key = mapped.orderNumber.toUpperCase();
    const existing = byRef.get(key) || byRef.get(row.id.toUpperCase());

    if (existing) {
      byRef.set(key, {
        ...existing,
        orderStatus: mapped.orderStatus,
        proofStatus: mapped.proofStatus,
        trackingNumber: mapped.trackingNumber || existing.trackingNumber,
        courierPartner: mapped.courierPartner || existing.courierPartner,
      });
    } else {
      byRef.set(key, mapped);
    }
  });

  return Array.from(byRef.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/**
 * Derives GST / Tax Invoices dynamically from the customer's actual orders.
 */
export function deriveInvoicesFromOrders(orders: Order[]): TaxInvoice[] {
  return orders.map((order, idx) => {
    const isSameState = (order.shippingAddress?.state || '').toLowerCase().includes('telangana');
    const gstAmt = Math.round(order.gstAmount || order.subtotal * 0.18);
    const cgst = isSameState ? Number((gstAmt / 2).toFixed(2)) : 0;
    const sgst = isSameState ? Number((gstAmt / 2).toFixed(2)) : 0;
    const igst = isSameState ? 0 : gstAmt;
    const totalQty = order.items.reduce((sum, item) => sum + (item.quantity || 1), 0);

    return {
      id: `inv-${order.id}`,
      invoiceNumber: `TW-INV-${order.orderNumber || String(idx + 1).padStart(4, '0')}`,
      orderNumber: order.orderNumber,
      date: order.createdAt,
      itemsCount: Math.max(1, totalQty),
      taxableValue: Math.round(order.subtotal),
      cgst,
      sgst,
      igst,
      totalAmount: Math.round(order.total),
      status: order.paymentStatus === 'Pending Verification' ? 'Processing' : 'Paid',
      pdfFileName: `TeqqnoWorld_Tax_Invoice_${order.orderNumber}.pdf`,
    };
  });
}

/**
 * Extracts artwork logos directly submitted in the customer's orders.
 */
export function extractBrandAssetsFromOrders(orders: Order[]): CustomerArtwork[] {
  const seenUrls = new Set<string>();
  const assets: CustomerArtwork[] = [];

  orders.forEach((order) => {
    order.items.forEach((item, idx) => {
      const url = item.artwork?.dataUrl || item.artwork?.rawDataUrl;
      if (!url || url.startsWith('/assets/')) return;
      if (seenUrls.has(url)) return;
      seenUrls.add(url);

      const isSvg = url.includes('.svg') || url.startsWith('data:image/svg');
      const isPdf = url.includes('.pdf') || url.startsWith('data:application/pdf');
      const fileType: CustomerArtwork['fileType'] = isPdf ? 'pdf' : isSvg ? 'svg' : 'png';

      assets.push({
        id: `order-art-${order.id}-${idx}`,
        title: `${item.product.name.split('–')[0].split('|')[0].trim()} Artwork`,
        fileType,
        fileName: `${order.orderNumber}_Artwork.${fileType}`,
        fileSize: url.startsWith('http') ? 'Cloud CDN' : 'Embedded Asset',
        resolution: isSvg ? 'Scalable Vector' : 'Print-Ready Upload',
        uploadedAt: order.createdAt.slice(0, 10),
        status:
          order.proofStatus === 'Approved by Client' || order.proofStatus === 'In Production'
            ? 'Approved for Production'
            : 'Under Review',
        previewUrl: url,
        associatedOrdersCount: 1,
        category: 'artwork',
        isCloudSynced: url.startsWith('http'),
      });
    });
  });

  return assets;
}

/**
 * Builds real time-series analytics points over the selected window (7 / 30 / 90 days).
 */
export function buildOrderAnalyticsSeries(
  orders: Order[],
  days: 7 | 30 | 90
): CustomerOrderAnalyticsPoint[] {
  const bucketCount = days === 7 ? 7 : days === 30 ? 10 : 12;
  const spanDays = Math.max(1, Math.floor(days / bucketCount));
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const points: CustomerOrderAnalyticsPoint[] = [];

  for (let i = bucketCount - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * spanDays);
    const start = new Date(end);
    start.setDate(end.getDate() - spanDays + 1);
    start.setHours(0, 0, 0, 0);

    let ordersCount = 0;
    let revenue = 0;

    orders.forEach((order) => {
      const ts = new Date(order.createdAt).getTime();
      if (Number.isFinite(ts) && ts >= start.getTime() && ts <= end.getTime()) {
        ordersCount += 1;
        revenue += Number(order.total) || 0;
      }
    });

    points.push({
      dateKey: end.toISOString().slice(0, 10),
      label: end.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      ordersCount,
      revenue: Math.round(revenue),
    });
  }

  return points;
}

/**
 * Computes real order stage breakdown for the Order Status donut chart.
 */
export function computeStatusBreakdown(orders: Order[]): {
  total: number;
  segments: CustomerStatusSegment[];
} {
  let pending = 0;
  let production = 0;
  let dispatched = 0;
  let delivered = 0;

  orders.forEach((order) => {
    if (order.orderStatus === 'Delivered') delivered += 1;
    else if (order.orderStatus === 'Dispatched') dispatched += 1;
    else if (order.orderStatus === 'Manufacturing' || order.orderStatus === 'Quality Check') production += 1;
    else pending += 1;
  });

  const total = orders.length;
  const pct = (count: number) => (total > 0 ? Math.round((count / total) * 100) : 0);

  return {
    total,
    segments: [
      {
        key: 'pending',
        label: 'Pending Review',
        count: pending,
        percent: pct(pending),
        color: '#FF7900',
        dotClass: 'bg-[#FF7900]',
        bgClass: 'bg-orange-50 text-orange-700',
      },
      {
        key: 'production',
        label: 'In Production',
        count: production,
        percent: pct(production),
        color: '#2563EB',
        dotClass: 'bg-blue-600',
        bgClass: 'bg-blue-50 text-blue-700',
      },
      {
        key: 'dispatched',
        label: 'Dispatched',
        count: dispatched,
        percent: pct(dispatched),
        color: '#10B981',
        dotClass: 'bg-emerald-500',
        bgClass: 'bg-emerald-50 text-emerald-700',
      },
      {
        key: 'delivered',
        label: 'Delivered',
        count: delivered,
        percent: pct(delivered),
        color: '#8B5CF6',
        dotClass: 'bg-violet-500',
        bgClass: 'bg-violet-50 text-violet-700',
      },
    ],
  };
}

/**
 * Derives live notifications from the customer's actual orders & read state.
 */
export function deriveNotificationsFromOrders(
  orders: Order[],
  rfqs: BulkEnquirySubmission[],
  readIds: string[]
): NotificationItem[] {
  const list: NotificationItem[] = [];

  orders.slice(0, 8).forEach((order) => {
    const productName = order.items[0]?.product?.name?.split('–')[0]?.split('|')[0]?.trim() || 'Custom Merchandise';
    const createdLabel = new Date(order.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    if (order.trackingNumber) {
      const id = `notif-track-${order.orderNumber}-${order.trackingNumber}`;
      list.push({
        id,
        title: `Consignment AWB #${order.trackingNumber} Active`,
        message: `Order #${order.orderNumber} (${productName}) assigned to ${order.courierPartner || 'Delhivery One'}.`,
        timestamp: createdLabel,
        read: readIds.includes(id),
        type: 'order',
        orderId: order.id,
      });
    }

    if (order.proofStatus === 'Proof Ready - Needs Approval') {
      const id = `notif-proof-${order.orderNumber}`;
      list.push({
        id,
        title: `Digital Proof Ready for #${order.orderNumber}`,
        message: `Review artwork placement & print specs for ${productName} in Proof Studio.`,
        timestamp: createdLabel,
        read: readIds.includes(id),
        type: 'proof',
        orderId: order.id,
      });
    } else {
      const id = `notif-order-${order.orderNumber}-${order.orderStatus}`;
      list.push({
        id,
        title: `Order #${order.orderNumber}: ${order.orderStatus}`,
        message: `${productName} (${order.items.reduce((s, i) => s + i.quantity, 0)} units) — ₹${Math.round(order.total).toLocaleString('en-IN')}.`,
        timestamp: createdLabel,
        read: readIds.includes(id),
        type: 'order',
        orderId: order.id,
      });
    }
  });

  rfqs.slice(0, 3).forEach((rfq) => {
    const id = `notif-rfq-${rfq.id}`;
    list.push({
      id,
      title: `Bulk RFQ ${rfq.status}: ${rfq.productCategory}`,
      message: `${rfq.estimatedQty} units enquiry registered for ${rfq.companyName || rfq.contactPerson}.`,
      timestamp: rfq.createdAt.slice(0, 10),
      read: readIds.includes(id),
      type: 'quote',
    });
  });

  return list;
}

export function getThumbnailForOrder(order: Order): string | null {
  const first = order.items[0];
  if (!first) return null;
  return (
    first.previewUrl ||
    first.color?.imageFront ||
    first.product?.colors?.[0]?.imageFront ||
    first.artwork?.dataUrl ||
    null
  );
}

export function getOrderStatusBadgeMeta(status: Order['orderStatus']): {
  label: string;
  pillClass: string;
  dotClass: string;
} {
  switch (status) {
    case 'Delivered':
      return {
        label: 'Delivered',
        pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dotClass: 'bg-emerald-500',
      };
    case 'Dispatched':
      return {
        label: 'Dispatched',
        pillClass: 'bg-teal-50 text-teal-700 border-teal-200',
        dotClass: 'bg-teal-500',
      };
    case 'Manufacturing':
    case 'Quality Check':
      return {
        label: status,
        pillClass: 'bg-blue-50 text-blue-700 border-blue-200',
        dotClass: 'bg-blue-500',
      };
    case 'Confirmed':
      return {
        label: 'Confirmed',
        pillClass: 'bg-sky-50 text-sky-700 border-sky-200',
        dotClass: 'bg-sky-500',
      };
    case 'Artwork Verification':
    default:
      return {
        label: 'Artwork Verification',
        pillClass: 'bg-amber-50 text-amber-800 border-amber-200',
        dotClass: 'bg-[#FF7900]',
      };
  }
}

export function getPortalGreetingSubtext(user: UserProfile): string {
  if (user.accountType === 'business' || user.companyName) {
    return user.companyName
      ? `${user.companyName} • Individual & Business Portal`
      : 'For All Customers (Individual & Business)';
  }
  return 'For All Customers (Individual & Business)';
}
