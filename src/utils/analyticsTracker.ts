// ==============================================================================
// TEQQNOWORLD PHASE 5 — GA4 DATALAYER & NON-PII FIRST-PARTY ATTRIBUTION TRACKER
//
// Core Safeguards:
// - Uses the existing window.dataLayer initialized by GTM-5GLJDBBJ in index.html
//   (NEVER injects a duplicate GA4/gtag.js script).
// - Strictly strips/forbids PII (no email, phone, customer name, address, GSTIN).
// - Deduplicates purchase events by transaction_id in memory + sessionStorage.
// - Classifies first-touch traffic channel accurately (Organic Search, Paid Search,
//   Social, Referral, Direct) so non-organic orders are never misattributed.
// - Non-blocking keepalive fetch ensures zero impact on storefront speed / CWV.
// ==============================================================================

import type { AnalyticsEventName, TrafficChannel } from '../types/seoAnalytics';

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

const SESSION_ATTR_STORAGE_KEY = 'teqqno_seo_session_attr_v1';
const FIRED_PURCHASE_STORAGE_KEY = 'teqqno_ga4_fired_purchases_v1';
const FIRED_CHECKOUT_STORAGE_KEY = 'teqqno_ga4_fired_checkouts_v1';
const memoryFiredPurchases = new Set<string>();
const memoryFiredCheckouts = new Set<string>();
const memoryFiredKeys = new Set<string>();
let lastActiveProductViewKey: string | null = null;

interface SessionAttributionContext {
  sessionId: string;
  channel: TrafficChannel;
  landingPath: string;
  sourceHost: string;
  capturedAt: string;
}

const ORGANIC_SEARCH_HOSTS = [
  'google.',
  'bing.com',
  'search.yahoo.',
  'duckduckgo.com',
  'ecosia.org',
  'startpage.com',
  'yandex.',
  'baidu.com',
];

const SOCIAL_HOSTS = [
  'instagram.com',
  'l.instagram.com',
  'facebook.com',
  'm.facebook.com',
  'l.facebook.com',
  'linkedin.com',
  'lnkd.in',
  'youtube.com',
  'youtu.be',
  'pinterest.',
  't.co',
  'twitter.com',
  'x.com',
  'whatsapp.com',
];

export function classifyTrafficChannel(params: {
  search: string;
  referrer: string;
  currentHost?: string;
}): { channel: TrafficChannel; sourceHost: string } {
  const sp = new URLSearchParams(params.search || '');
  const utmMedium = (sp.get('utm_medium') || '').trim().toLowerCase();
  const utmSource = (sp.get('utm_source') || '').trim().toLowerCase();
  const hasPaidClickId = Boolean(
    sp.get('gclid') || sp.get('gbraid') || sp.get('wbraid') || sp.get('msclkid')
  );

  let refHost = '';
  if (params.referrer) {
    try {
      const parsed = new URL(params.referrer);
      refHost = parsed.hostname.toLowerCase();
    } catch {
      refHost = '';
    }
  }

  const ownHost = (params.currentHost || '').toLowerCase();
  const isSelfReferral =
    Boolean(refHost) &&
    (refHost === ownHost ||
      refHost.endsWith('teqqnoworld.com') ||
      refHost.endsWith('teqqnoworld.in'));

  // 1. Paid Search takes priority over organic search referrer
  if (
    hasPaidClickId ||
    ['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'sem'].includes(utmMedium)
  ) {
    return { channel: 'paid_search', sourceHost: utmSource || refHost || 'paid_search' };
  }

  // 2. Explicit Organic UTM
  if (utmMedium === 'organic') {
    return { channel: 'organic_search', sourceHost: utmSource || refHost || 'google' };
  }

  // 3. Explicit Social UTM or Social Referrer
  if (
    ['social', 'paid_social', 'social-media', 'smm'].includes(utmMedium) ||
    SOCIAL_HOSTS.some((h) => utmSource.includes(h.replace(/\..*/, '')) || refHost.includes(h))
  ) {
    return { channel: 'social', sourceHost: utmSource || refHost || 'social' };
  }

  // 4. Organic Search Referrer (Google, Bing, DuckDuckGo, Yahoo, etc.)
  if (
    !isSelfReferral &&
    refHost &&
    ORGANIC_SEARCH_HOSTS.some((h) => refHost.includes(h))
  ) {
    return { channel: 'organic_search', sourceHost: refHost };
  }

  // 5. External Referral or Affiliate Link
  if (
    sp.get('ref') ||
    utmMedium === 'referral' ||
    utmMedium === 'affiliate' ||
    (!isSelfReferral && Boolean(refHost))
  ) {
    return { channel: 'referral', sourceHost: utmSource || refHost || 'referral' };
  }

  return { channel: 'direct', sourceHost: 'direct' };
}

function getOrCreateSessionAttribution(): SessionAttributionContext | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(SESSION_ATTR_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionAttributionContext;
      if (parsed && parsed.sessionId && parsed.channel && parsed.landingPath) {
        return parsed;
      }
    }
  } catch {
    // sessionStorage unavailable in restricted privacy modes
  }

  const classified = classifyTrafficChannel({
    search: window.location.search || '',
    referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
    currentHost: window.location.hostname || '',
  });

  const sessionId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? `tw_${crypto.randomUUID()}`
      : `tw_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const ctx: SessionAttributionContext = {
    sessionId,
    channel: classified.channel,
    landingPath: (window.location.pathname || '/').replace(/\/+$/, '') || '/',
    sourceHost: classified.sourceHost,
    capturedAt: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(SESSION_ATTR_STORAGE_KEY, JSON.stringify(ctx));
  } catch {
    // ignore
  }
  return ctx;
}

function hasPurchaseAlreadyFired(transactionId: string): boolean {
  const cleanId = transactionId.trim();
  if (!cleanId) return false;
  if (memoryFiredPurchases.has(cleanId)) return true;
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(FIRED_PURCHASE_STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list) && list.includes(cleanId)) {
      memoryFiredPurchases.add(cleanId);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function markPurchaseFired(transactionId: string): void {
  const cleanId = transactionId.trim();
  if (!cleanId) return;
  memoryFiredPurchases.add(cleanId);
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(FIRED_PURCHASE_STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = Array.from(new Set([...(Array.isArray(list) ? list : []), cleanId])).slice(-50);
    window.sessionStorage.setItem(FIRED_PURCHASE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function buildCheckoutSignature(valueInr: number, items: Ga4ProductItemInput[]): string {
  const normalizedItems = items
    .map((i) => ({
      id: String(i.item_id || '').trim(),
      qty: Math.max(1, Math.round(Number(i.quantity || 1))),
      price: Number(Number(i.price || 0).toFixed(2)),
    }))
    .sort((a, b) => a.id.localeCompare(b.id) || a.price - b.price || a.qty - b.qty);
  const normalizedValue = Number(Number(valueInr || 0).toFixed(2));
  return `${normalizedValue}|${normalizedItems.map((i) => `${i.id}:${i.qty}:${i.price}`).join(',')}`;
}

function hasCheckoutAlreadyFired(signature: string): boolean {
  if (!signature) return false;
  if (memoryFiredCheckouts.has(signature)) return true;
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.sessionStorage.getItem(FIRED_CHECKOUT_STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (Array.isArray(list) && list.includes(signature)) {
      memoryFiredCheckouts.add(signature);
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function markCheckoutFired(signature: string): void {
  if (!signature) return;
  memoryFiredCheckouts.add(signature);
  if (typeof window === 'undefined') return;
  try {
    const raw = window.sessionStorage.getItem(FIRED_CHECKOUT_STORAGE_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = Array.from(new Set([...(Array.isArray(list) ? list : []), signature])).slice(-20);
    window.sessionStorage.setItem(FIRED_CHECKOUT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function clearFiredCheckouts(): void {
  memoryFiredCheckouts.clear();
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(FIRED_CHECKOUT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function pushToDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    window.dataLayer = window.dataLayer || [];
    if ('ecommerce' in payload) {
      // Clear previous ecommerce object per GA4 GTM best practice
      window.dataLayer.push({ ecommerce: null });
    }
    window.dataLayer.push(payload);
  } catch {
    // Never disrupt storefront UX
  }
}

function sendFirstPartyAttributionBeacon(payload: {
  eventName: AnalyticsEventName;
  eventKey?: string;
  transactionId?: string;
  pagePath?: string;
  productId?: string;
  productName?: string;
  categorySlug?: string;
  valueInr?: number;
  quantity?: number;
}): void {
  if (typeof window === 'undefined') return;
  const ctx = getOrCreateSessionAttribution();
  if (!ctx) return;

  // Never record admin panel browsing as storefront customer traffic
  const currentPath =
    (payload.pagePath || window.location.pathname || '/').replace(/\/+$/, '') || '/';
  if (currentPath.startsWith('/admin')) return;

  const body = JSON.stringify({
    eventName: payload.eventName,
    eventKey: payload.eventKey,
    transactionId: payload.transactionId,
    sessionId: ctx.sessionId,
    channel: ctx.channel,
    landingPath: ctx.landingPath,
    pagePath: currentPath,
    productId: payload.productId,
    productName: payload.productName,
    categorySlug: payload.categorySlug,
    valueInr: typeof payload.valueInr === 'number' ? Number(payload.valueInr.toFixed(2)) : undefined,
    quantity: typeof payload.quantity === 'number' ? Math.round(payload.quantity) : undefined,
    sourceHost: ctx.sourceHost,
  });

  try {
    void fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // non-blocking
  }
}

export interface Ga4ProductItemInput {
  item_id: string;
  item_name: string;
  item_category?: string;
  price?: number;
  quantity?: number;
}

export function trackPageView(params: { pagePath: string; pageTitle: string; categorySlug?: string }) {
  const cleanPath = (params.pagePath || '/').replace(/\/+$/, '') || '/';
  if (cleanPath.startsWith('/admin')) return;

  // Leaving a product page clears the active view_item guard so revisiting the product later counts as a genuine view
  if (!cleanPath.startsWith('/product/')) {
    lastActiveProductViewKey = null;
  }

  const dedupeKey = `pv:${cleanPath}:${Math.floor(Date.now() / 3000)}`;
  if (memoryFiredKeys.has(dedupeKey)) return;
  memoryFiredKeys.add(dedupeKey);

  pushToDataLayer({
    event: 'page_view',
    page_path: cleanPath,
    page_title: params.pageTitle,
    page_location:
      typeof window !== 'undefined' ? `${window.location.origin}${cleanPath}` : cleanPath,
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'page_view',
    pagePath: cleanPath,
    categorySlug: params.categorySlug,
  });
}

export function resetActiveProductView(): void {
  lastActiveProductViewKey = null;
}

export function trackViewItem(params: {
  productId: string;
  productName: string;
  categorySlug?: string;
  priceInr: number;
  pagePath: string;
}): boolean {
  const cleanProductId = String(params.productId || '').trim();
  const cleanPath = (params.pagePath || '/').replace(/\/+$/, '') || '/';
  if (!cleanProductId) return false;

  // Prevent duplicate view_item pushes for the same active product view (e.g. async state updates or StrictMode double-effects)
  const viewKey = `${cleanProductId}:${cleanPath}`;
  if (lastActiveProductViewKey === viewKey) {
    return false;
  }
  lastActiveProductViewKey = viewKey;

  pushToDataLayer({
    event: 'view_item',
    ecommerce: {
      currency: 'INR',
      value: Number(params.priceInr || 0),
      items: [
        {
          item_id: cleanProductId,
          item_name: params.productName,
          item_category: params.categorySlug || 'custom-merchandise',
          price: Number(params.priceInr || 0),
          quantity: 1,
        },
      ],
    },
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'view_item',
    pagePath: cleanPath,
    productId: cleanProductId,
    productName: params.productName,
    categorySlug: params.categorySlug,
    valueInr: Number(params.priceInr || 0),
  });
  return true;
}

export function trackViewItemList(params: {
  listName: string;
  categorySlug?: string;
  items: Ga4ProductItemInput[];
  pagePath: string;
}) {
  pushToDataLayer({
    event: 'view_item_list',
    ecommerce: {
      item_list_name: params.listName,
      items: params.items.slice(0, 20),
    },
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'view_item_list',
    pagePath: params.pagePath,
    categorySlug: params.categorySlug,
  });
}

export function trackSelectItem(params: {
  listName: string;
  productId: string;
  productName: string;
  categorySlug?: string;
  priceInr: number;
}) {
  pushToDataLayer({
    event: 'select_item',
    ecommerce: {
      item_list_name: params.listName,
      items: [
        {
          item_id: params.productId,
          item_name: params.productName,
          item_category: params.categorySlug || 'custom-merchandise',
          price: Number(params.priceInr || 0),
        },
      ],
    },
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'select_item',
    productId: params.productId,
    productName: params.productName,
    categorySlug: params.categorySlug,
    valueInr: Number(params.priceInr || 0),
  });
}

export function trackAddToCart(params: {
  productId: string;
  productName: string;
  categorySlug?: string;
  unitPriceInr: number;
  quantity: number;
  totalPriceInr: number;
}) {
  const safeQty = Math.max(1, Math.round(params.quantity || 1));
  const safeUnitPrice = Number(params.unitPriceInr || 0);
  const safeTotal = Number(params.totalPriceInr || 0);

  pushToDataLayer({
    event: 'add_to_cart',
    ecommerce: {
      currency: 'INR',
      value: safeTotal,
      items: [
        {
          item_id: params.productId,
          item_name: params.productName,
          item_category: params.categorySlug || 'custom-merchandise',
          price: safeUnitPrice,
          quantity: safeQty,
        },
      ],
    },
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'add_to_cart',
    productId: params.productId,
    productName: params.productName,
    categorySlug: params.categorySlug,
    valueInr: safeTotal,
    quantity: safeQty,
  });
}

export function trackAddToCartItems(params: {
  valueInr: number;
  items: Ga4ProductItemInput[];
}): boolean {
  const validItems = (params.items || [])
    .filter((i) => Boolean(i?.item_id && i?.item_name))
    .map((i) => ({
      item_id: String(i.item_id).trim(),
      item_name: String(i.item_name).trim(),
      item_category: i.item_category || 'custom-merchandise',
      price: Number(i.price || 0),
      quantity: Math.max(1, Math.round(Number(i.quantity || 1))),
    }));
  if (validItems.length === 0) return false;

  const safeTotal = Number(params.valueInr || 0);
  pushToDataLayer({
    event: 'add_to_cart',
    ecommerce: {
      currency: 'INR',
      value: safeTotal,
      items: validItems,
    },
  });

  const primaryItem = validItems[0];
  sendFirstPartyAttributionBeacon({
    eventName: 'add_to_cart',
    productId: primaryItem.item_id,
    productName: primaryItem.item_name,
    categorySlug: primaryItem.item_category,
    valueInr: safeTotal,
    quantity: validItems.reduce((sum, i) => sum + i.quantity, 0),
  });
  return true;
}

export function trackBeginCheckout(params: {
  valueInr: number;
  items: Ga4ProductItemInput[];
}): boolean {
  const validItems = (params.items || [])
    .filter((i) => Boolean(i?.item_id && i?.item_name))
    .map((i) => ({
      item_id: String(i.item_id).trim(),
      item_name: String(i.item_name).trim(),
      item_category: i.item_category || 'custom-merchandise',
      price: Number(i.price || 0),
      quantity: Math.max(1, Math.round(Number(i.quantity || 1))),
    }));
  if (validItems.length === 0) return false;

  const safeValue = Number(params.valueInr || 0);
  const signature = buildCheckoutSignature(safeValue, validItems);
  if (hasCheckoutAlreadyFired(signature)) {
    return false;
  }
  markCheckoutFired(signature);

  pushToDataLayer({
    event: 'begin_checkout',
    ecommerce: {
      currency: 'INR',
      value: safeValue,
      items: validItems,
    },
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'begin_checkout',
    pagePath: '/checkout',
    valueInr: safeValue,
    quantity: validItems.reduce((sum, i) => sum + i.quantity, 0),
  });
  return true;
}

/**
 * Fires GA4 `purchase` event & first-party attribution once per transaction_id.
 * Zero PII (no email, name, phone, address, or GSTIN) is ever pushed.
 */
export function trackPurchaseOnce(params: {
  transactionId: string;
  valueInr: number;
  taxInr?: number;
  shippingInr?: number;
  couponCode?: string;
  items: Ga4ProductItemInput[];
}): boolean {
  const txId = String(params.transactionId || '').trim();
  if (!txId || hasPurchaseAlreadyFired(txId)) {
    return false;
  }
  markPurchaseFired(txId);
  clearFiredCheckouts();

  const cleanCoupon = String(params.couponCode || '').trim().toUpperCase();

  pushToDataLayer({
    event: 'purchase',
    ecommerce: {
      transaction_id: txId,
      currency: 'INR',
      value: Number(params.valueInr || 0),
      tax: Number(params.taxInr || 0),
      shipping: Number(params.shippingInr || 0),
      ...(cleanCoupon ? { coupon: cleanCoupon } : {}),
      items: params.items,
    },
  });

  const primaryItem = params.items[0];
  sendFirstPartyAttributionBeacon({
    eventName: 'purchase',
    transactionId: txId,
    pagePath: '/orders',
    productId: primaryItem?.item_id,
    productName: primaryItem?.item_name,
    categorySlug: primaryItem?.item_category,
    valueInr: Number(params.valueInr || 0),
    quantity: params.items.reduce((sum, i) => sum + (i.quantity || 1), 0),
  });

  return true;
}

export function trackQuoteRequest(params: {
  leadId?: string;
  formName: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  valueInr?: number;
}) {
  const eventKey = params.leadId ? `quote:${params.leadId}` : undefined;
  if (eventKey && memoryFiredKeys.has(eventKey)) return;
  if (eventKey) memoryFiredKeys.add(eventKey);

  const hasValidBusinessValue =
    typeof params.valueInr === 'number' &&
    Number.isFinite(params.valueInr) &&
    params.valueInr > 0;
  const roundedValue = hasValidBusinessValue
    ? Number(params.valueInr!.toFixed(2))
    : undefined;

  pushToDataLayer({
    event: 'generate_lead',
    lead_type: 'quote_request',
    form_name: params.formName,
    item_id: params.productId || 'bulk-quote',
    item_name: params.productName || 'Bulk Corporate Quote',
    quantity: params.quantity || 1,
    ...(roundedValue !== undefined ? { currency: 'INR', value: roundedValue } : {}),
  });
  pushToDataLayer({
    event: 'form_submit',
    form_name: params.formName,
    form_type: 'quote_request',
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'quote_request',
    eventKey,
    productId: params.productId,
    productName: params.productName,
    valueInr: roundedValue,
    quantity: params.quantity,
  });
}

export function trackWhatsAppEnquiry(params: {
  placement: string;
  productId?: string;
  productName?: string;
}) {
  pushToDataLayer({
    event: 'whatsapp_enquiry',
    enquiry_placement: params.placement,
    item_id: params.productId || 'general',
    item_name: params.productName || 'WhatsApp Consultant',
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'whatsapp_enquiry',
    productId: params.productId,
    productName: params.productName,
  });
}

// ==============================================================================
// PHASE 6 — CONTENT SEO & BLOG ENGAGEMENT TRACKING (ZERO PII, EXISTING DATALAYER)
// ==============================================================================

export function trackBlogView(params: {
  slug: string;
  title: string;
  categorySlug: string;
  contentKind?: string;
}) {
  const pagePath = `/blogs/${params.slug}`;
  const dedupeKey = `blog_view:${params.slug}:${Math.floor(Date.now() / 5000)}`;
  if (memoryFiredKeys.has(dedupeKey)) return;
  memoryFiredKeys.add(dedupeKey);

  pushToDataLayer({
    event: 'blog_view',
    blog_slug: params.slug,
    blog_title: params.title,
    blog_category: params.categorySlug,
    blog_kind: params.contentKind || 'article',
    page_path: pagePath,
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'blog_view',
    pagePath,
    categorySlug: params.categorySlug,
    productName: params.title.slice(0, 180),
  });
}

export function trackBlogCategoryView(params: { categorySlug: string; pagePath?: string }) {
  pushToDataLayer({
    event: 'blog_category_view',
    blog_category: params.categorySlug,
    page_path: params.pagePath || '/blogs',
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'blog_category_view',
    pagePath: params.pagePath || '/blogs',
    categorySlug: params.categorySlug,
  });
}

export function trackBlogSearch(params: { query: string; resultCount: number; pagePath?: string }) {
  const cleanQuery = params.query.trim().slice(0, 80);
  if (!cleanQuery) return;
  pushToDataLayer({
    event: 'blog_search',
    search_term: cleanQuery,
    result_count: params.resultCount,
    page_path: params.pagePath || '/blogs',
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'blog_search',
    pagePath: params.pagePath || '/blogs',
    quantity: params.resultCount,
  });
}

export function trackRelatedProductClick(params: {
  blogSlug: string;
  productId: string;
  productName: string;
  categorySlug?: string;
}) {
  const pagePath = `/blogs/${params.blogSlug}`;
  pushToDataLayer({
    event: 'related_product_click',
    blog_slug: params.blogSlug,
    item_id: params.productId,
    item_name: params.productName,
    item_category: params.categorySlug || 'custom-merchandise',
    page_path: pagePath,
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'related_product_click',
    pagePath,
    productId: params.productId,
    productName: params.productName,
    categorySlug: params.categorySlug,
  });
}

export function trackBlogCtaClick(params: {
  blogSlug: string;
  ctaLabel: string;
  targetPath: string;
  categorySlug?: string;
}) {
  const pagePath = `/blogs/${params.blogSlug}`;
  pushToDataLayer({
    event: 'blog_cta_click',
    blog_slug: params.blogSlug,
    cta_label: params.ctaLabel,
    target_path: params.targetPath,
    page_path: pagePath,
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'blog_cta_click',
    pagePath,
    productName: params.ctaLabel.slice(0, 180),
    categorySlug: params.categorySlug,
  });
}

export function trackBlogShare(params: {
  blogSlug: string;
  method: 'whatsapp' | 'linkedin' | 'x' | 'copy_link';
}) {
  const pagePath = `/blogs/${params.blogSlug}`;
  pushToDataLayer({
    event: 'blog_share',
    blog_slug: params.blogSlug,
    share_method: params.method,
    page_path: pagePath,
  });
  sendFirstPartyAttributionBeacon({
    eventName: 'blog_share',
    pagePath,
    productName: params.method,
  });
}

export function __resetAnalyticsTrackerForTests(): void {
  memoryFiredPurchases.clear();
  memoryFiredCheckouts.clear();
  memoryFiredKeys.clear();
  lastActiveProductViewKey = null;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(FIRED_PURCHASE_STORAGE_KEY);
      window.sessionStorage.removeItem(FIRED_CHECKOUT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
