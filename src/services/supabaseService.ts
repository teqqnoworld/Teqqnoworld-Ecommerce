import { 
  supabase, 
  isSupabaseConfigured, 
  ProductRow, 
  CustomOrderRow, 
  OrderStatus 
} from '../lib/supabase';
import { PRODUCTS } from '../data/mockData';
import { compressImageFile, compressDataUrl } from '../utils/imageCompressor';
import { getStoredAdminToken } from './adminSecurityService';

// Storage bucket name constant
export const STORAGE_BUCKET_NAME = 'brand-logos';

export interface QuoteRequestInput {
  customerName: string;
  customerEmail: string;
  company?: string;
  phone: string;
  productId: string;
  quantity: number;
  customNotes?: string;
  logoFile?: File | null;
  existingLogoUrl?: string | null;
  submissionType?: 'quote' | 'rfq';
}

export interface QuoteSubmissionResult {
  success: boolean;
  orderId?: string;
  orderNumber?: string;
  logoUrl?: string | null;
  data?: CustomOrderRow;
  message?: string;
  isMockFallback?: boolean;
}

export interface PublicOrderTrackingResult {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  proofStatus: string;
  orderStatus: string;
  courierPartner: string;
  trackingNumber: string | null;
  createdAt: string;
  estimatedDispatch: string;
  quantity: number;
  productId: string | null;
}

/**
 * 1. Fetch all products from Supabase `products` table.
 * Falls back gracefully to curated local mock catalog if Supabase is unconfigured or empty.
 */
export async function fetchProductsFromSupabase(): Promise<{
  data: ProductRow[];
  isFallback: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    // Return formatted mock data mapped to ProductRow
    const mapped: ProductRow[] = PRODUCTS.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      base_price: p.basePrice,
      moq: p.moq,
      image_url: p.colors[0]?.imageFront || '/assets/products/prod_tipping_polo.webp',
      available_colors: p.colors.map((c) => ({ name: c.name, hex: c.hex, garmentHex: c.garmentHex })),
      available_sizes: p.sizes || ['S', 'M', 'L', 'XL', '2XL'],
      description: p.description,
      created_at: new Date().toISOString(),
    }));
    return { data: mapped, isFallback: true };
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase] Error fetching products:', error.message);
      return {
        data: PRODUCTS.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          base_price: p.basePrice,
          moq: p.moq,
          image_url: p.colors[0]?.imageFront || '/assets/products/prod_tipping_polo.webp',
          available_colors: p.colors.map((c) => ({ name: c.name, hex: c.hex })),
          available_sizes: p.sizes || ['S', 'M', 'L', 'XL'],
          description: p.description,
          created_at: new Date().toISOString(),
        })),
        isFallback: true,
        error: error.message,
      };
    }

    if (!data || data.length === 0) {
      // Products table is created but currently empty -> Return fallbacks
      return {
        data: PRODUCTS.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          base_price: p.basePrice,
          moq: p.moq,
          image_url: p.colors[0]?.imageFront || '/assets/products/prod_tipping_polo.webp',
          available_colors: p.colors.map((c) => ({ name: c.name, hex: c.hex })),
          available_sizes: p.sizes || ['S', 'M', 'L', 'XL'],
          description: p.description,
          created_at: new Date().toISOString(),
        })),
        isFallback: true,
      };
    }

    return { data, isFallback: false };
  } catch (err: any) {
    console.error('[Supabase] Unexpected error in fetchProductsFromSupabase:', err);
    return {
      data: [],
      isFallback: true,
      error: err?.message || 'Failed to fetch products',
    };
  }
}

/**
 * 2. Upload brand logo file to Supabase Storage bucket `brand-logos`
 * Returns the public URL of the uploaded asset.
 */
export async function uploadBrandLogoToStorage(
  file: File | Blob,
  fileName?: string
): Promise<{ publicUrl: string; filePath: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local');
  }

  // Client-Side Canvas Compression: Max 1200px width/height, 80% WebP quality
  let processedFile: File | Blob = file;
  let targetContentType = (file instanceof File && file.type) ? file.type : 'image/webp';
  let cleanName = (fileName || (file instanceof File ? file.name : 'logo.webp')).replace(/[^a-zA-Z0-9._-]/g, '_').toLowerCase();

  try {
    const isAudio = (file.type && file.type.startsWith('audio/')) || /\.(webm|mp3|wav|m4a|ogg)$/i.test(cleanName);
    const isSvg = (file.type && file.type.includes('svg')) || cleanName.endsWith('.svg');
    const isPdf = (file.type && file.type.includes('pdf')) || cleanName.endsWith('.pdf');
    if (isAudio) {
      targetContentType = (file.type && file.type.split(';')[0]) || 'audio/webm';
    } else if (isPdf) {
      targetContentType = 'application/pdf';
    } else if (isSvg) {
      targetContentType = 'image/svg+xml';
    } else {
      const compressionResult = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
        format: 'image/webp',
      });
      processedFile = compressionResult.file;
      targetContentType = 'image/webp';
      if (!cleanName.endsWith('.webp')) {
        cleanName = `${cleanName.replace(/\.[^/.]+$/, '')}.webp`;
      }
      console.log(`[Image Compression] Compressed from ${(file.size / 1024).toFixed(1)} KB to ${(compressionResult.compressedSize / 1024).toFixed(1)} KB`);
    }
  } catch (compErr) {
    console.warn('[Image Compression] Canvas compression fallback to original:', compErr);
  }

  // Sanitize filename and create unique timestamped path
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 7);
  const filePath = `uploads/${timestamp}-${randomStr}-${cleanName}`;

  // Upload to Supabase Storage with 1 year cacheControl
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET_NAME)
    .upload(filePath, processedFile, {
      cacheControl: '31536000',
      upsert: false,
      contentType: targetContentType,
    });

  if (error) {
    console.error('[Supabase Storage] Upload error:', error);
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET_NAME)
    .getPublicUrl(data.path);

  return {
    publicUrl: urlData.publicUrl,
    filePath: data.path,
  };
}

/**
 * Uploads a base64 Data URL to Supabase Storage bucket `brand-logos`.
 * If already an HTTP(S) URL or local path, returns it as-is.
 * Compresses raster images on client canvas (max 1200px, 80% WebP) before upload.
 */
export async function uploadDataUrlToStorage(
  dataUrl?: string | null,
  fallbackName?: string
): Promise<string | null> {
  if (!dataUrl) return null;

  // Already a remote URL
  if (dataUrl.startsWith('http://') || dataUrl.startsWith('https://')) {
    return dataUrl;
  }

  // Not a base64 data URL (e.g. local /assets/... path)
  if (!dataUrl.startsWith('data:')) {
    return dataUrl;
  }

  try {
    const isAudioDataUrl = dataUrl.startsWith('data:audio/');
    // Compress raster image dataUrls using canvas prior to storage upload; skip compression for audio
    const optimizedDataUrl = isAudioDataUrl
      ? dataUrl
      : await compressDataUrl(dataUrl, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.8,
          format: 'image/webp',
        });

    const match = optimizedDataUrl.match(/^data:([a-zA-Z0-9/+.-]+)(?:;[^,]*)?;base64,(.+)$/);
    if (!match) {
      return null;
    }

    const mimeType = match[1];
    const base64Content = match[2];
    const byteCharacters = atob(base64Content);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const rawSubtype = mimeType.split('/')[1]?.replace('svg+xml', 'svg') || (isAudioDataUrl ? 'webm' : 'webp');
    const ext = rawSubtype === 'mpeg' ? 'mp3' : rawSubtype === 'x-m4a' ? 'm4a' : rawSubtype;
    const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, '');
    const filename = fallbackName
      ? `${fallbackName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.${cleanExt}`
      : `${isAudioDataUrl ? 'voice_note' : 'logo'}_${Date.now()}.${cleanExt}`;

    const { publicUrl } = await uploadBrandLogoToStorage(blob, filename);
    return publicUrl;
  } catch (err) {
    console.warn('[Supabase Storage] Failed to upload dataURL to brand-logos:', err);
    return null;
  }
}


/**
 * 3. Handle Complete "Request a Quote" / Bulk RFQ Flow:
 *  a) Uploads optional brand logo file to Supabase Storage bucket `brand-logos`.
 *  b) Submits validated quote request through server-side POST /api/quotes/submit
 *     (never inserts directly into public.custom_orders from the browser).
 */
export async function submitCustomOrderQuote(
  payload: QuoteRequestInput
): Promise<QuoteSubmissionResult> {
  try {
    let finalLogoUrl: string | null = payload.existingLogoUrl || null;

    // a) Upload file to Supabase Storage if a File object was provided
    if (payload.logoFile && isSupabaseConfigured()) {
      const { publicUrl } = await uploadBrandLogoToStorage(payload.logoFile);
      finalLogoUrl = publicUrl;
    }

    // b) Submit through rate-limited, server-validated Express API
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const adminToken = getStoredAdminToken();
    if (adminToken) {
      headers.Authorization = `Bearer ${adminToken}`;
    }

    const resp = await fetch('/api/quotes/submit', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        submissionType: payload.submissionType || 'quote',
        customerName: payload.customerName,
        customerEmail: payload.customerEmail,
        company: payload.company || null,
        phone: payload.phone,
        productId: payload.productId,
        quantity: payload.quantity,
        logoUrl: finalLogoUrl,
        customNotes: payload.customNotes || null,
      }),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.success) {
      throw new Error(json?.message || `Failed to submit quote (HTTP ${resp.status}).`);
    }

    const orderId = String(json.orderId || 'SUBMITTED');
    const orderNumber = String(json.orderNumber || orderId);

    return {
      success: true,
      orderId,
      orderNumber,
      logoUrl: finalLogoUrl,
      message: 'Your quote request and brand logo have been successfully registered with our corporate production team.',
      isMockFallback: false,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'An error occurred while submitting your quote request.',
    };
  }
}

/**
 * 4. Fetch orders for Admin Hub via authenticated Express Admin API (GET /api/admin/orders).
 * Requires a valid Admin Bearer session token — never reads custom_orders with the public anon key.
 */
export async function fetchCustomOrdersFromSupabase(): Promise<{
  data: CustomOrderRow[];
  error?: string;
}> {
  const adminToken = getStoredAdminToken();
  if (!adminToken) {
    return { data: [], error: 'Admin authentication required to view orders.' };
  }

  try {
    const resp = await fetch('/api/admin/orders', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.success) {
      return {
        data: [],
        error: json?.message || `Unable to load orders (HTTP ${resp.status}).`,
      };
    }
    return { data: Array.isArray(json.orders) ? (json.orders as CustomOrderRow[]) : [] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Failed to load orders from server.' };
  }
}

/**
 * 5. Utility: One-click Seed function to populate Supabase `products` table
 */
export async function seedProductsToSupabase(): Promise<{ count: number; error?: string }> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Add credentials in .env.local first.');
  }

  const rowsToInsert = PRODUCTS.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    base_price: p.basePrice,
    moq: p.moq,
    image_url: p.colors[0]?.imageFront || '/assets/products/prod_tipping_polo.webp',
    available_colors: p.colors.map((c) => ({ name: c.name, hex: c.hex, garmentHex: c.garmentHex })),
    available_sizes: p.sizes || ['S', 'M', 'L', 'XL', '2XL'],
    description: p.description,
  }));

  const { data, error } = await (supabase.from('products') as any)
    .upsert(rowsToInsert, { onConflict: 'id' })
    .select();

  if (error) {
    console.error('[Supabase Seed] Upsert failed:', error);
    throw error;
  }

  return { count: (data as any[])?.length || 0 };
}

/**
 * 6. Update Custom Order Status & Courier Dispatch Details via authenticated Admin API
 * Executes: PATCH /api/admin/orders/:orderId/status (Admin session token required).
 */
export async function updateCustomOrderStatus(
  orderId: string,
  status: OrderStatus,
  courierPartner?: string | null,
  trackingNumber?: string | null,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const adminToken = getStoredAdminToken();
  if (!adminToken) {
    return { success: false, error: 'Unauthorized: Valid Admin session token is required.' };
  }

  try {
    const resp = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status,
        ...(courierPartner !== undefined ? { courierPartner } : {}),
        ...(trackingNumber !== undefined ? { trackingNumber } : {}),
      }),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || `Failed to update order status (HTTP ${resp.status}).`,
      };
    }

    // Keep local UI cache in sync after confirmed server update
    try {
      const localOrders = JSON.parse(localStorage.getItem('teqqno_orders') || '[]');
      const oIdx = localOrders.findIndex((o: any) => o.id === orderId || o.orderNumber === orderId);
      if (oIdx !== -1) {
        localOrders[oIdx].orderStatus =
          status === 'pending' || status === 'approved'
            ? 'Artwork Verification'
            : status === 'in-production'
              ? 'Manufacturing'
              : status === 'dispatched'
                ? 'Dispatched'
                : status === 'cancelled'
                  ? 'Cancelled'
                  : 'Delivered';
        if (courierPartner) localOrders[oIdx].courierPartner = courierPartner;
        if (trackingNumber) localOrders[oIdx].trackingNumber = trackingNumber;
        localStorage.setItem('teqqno_orders', JSON.stringify(localOrders));
      }
    } catch {
      // ignore local storage sync warning
    }

    return { success: true, data: json.order };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update order status.' };
  }
}

/**
 * 7. Abandoned Cart Recovery - Autosave partial lead data
 * Debounced capture in CheckoutView when user enters contact info
 */
export async function saveAbandonedCheckout(lead: {
  id: string;
  customerName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  cartItems: any[];
  cartTotal: number;
}): Promise<{ success: boolean; error?: string }> {
  const row = {
    id: lead.id,
    customer_name: lead.customerName || null,
    email: lead.email || null,
    phone: lead.phone || null,
    company: lead.company || null,
    cart_items: lead.cartItems || [],
    cart_total: lead.cartTotal || 0,
    recovered: false,
    updated_at: new Date().toISOString(),
  };

  // 1. Save to LocalStorage cache
  try {
    const existing = JSON.parse(localStorage.getItem('teqqno_abandoned_checkouts') || '[]');
    const idx = existing.findIndex((e: any) => e.id === lead.id);
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...row };
    } else {
      existing.unshift({ ...row, created_at: new Date().toISOString() });
    }
    localStorage.setItem('teqqno_abandoned_checkouts', JSON.stringify(existing));
  } catch (err) {
    console.warn('[Abandoned Cart LocalStorage Error]:', err);
  }

  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    const { error } = await (supabase.from('abandoned_checkouts') as any)
      .upsert(row, { onConflict: 'id' });

    if (error) {
      // If table doesn't exist yet, silence error so customer checkout is never blocked
      console.warn('[Supabase Abandoned Checkouts Upsert]:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message };
  }
}

/**
 * 8. Mark Abandoned Checkout as Recovered when order completes
 */
export async function markCheckoutRecovered(
  sessionId: string,
  orderId: string
): Promise<{ success: boolean }> {
  const updateData = {
    recovered: true,
    order_id: orderId,
    recovered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // 1. Update in LocalStorage
  try {
    const existing = JSON.parse(localStorage.getItem('teqqno_abandoned_checkouts') || '[]');
    const idx = existing.findIndex((e: any) => e.id === sessionId);
    if (idx !== -1) {
      existing[idx] = { ...existing[idx], ...updateData };
      localStorage.setItem('teqqno_abandoned_checkouts', JSON.stringify(existing));
    }
  } catch (err) {
    console.warn('[Abandoned Cart Recovery LocalStorage Error]:', err);
  }

  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    await (supabase.from('abandoned_checkouts') as any)
      .update(updateData)
      .eq('id', sessionId);
    return { success: true };
  } catch (err) {
    return { success: false };
  }
}

/**
 * 9. Fetch all Abandoned Leads for Admin Hub
 */
export async function fetchAbandonedCheckoutsFromSupabase(): Promise<{
  data: any[];
  error?: string;
}> {
  // Always get local leads first as base
  let localLeads: any[] = [];
  try {
    localLeads = JSON.parse(localStorage.getItem('teqqno_abandoned_checkouts') || '[]');
  } catch {
    localLeads = [];
  }

  if (!isSupabaseConfigured()) {
    return { data: localLeads };
  }

  try {
    const { data, error } = await (supabase.from('abandoned_checkouts') as any)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('[Supabase Fetch Abandoned Checkouts Error]:', error.message);
      return { data: localLeads, error: error.message };
    }

    // Merge remote and local leads without duplicates
    const mergedMap = new Map<string, any>();
    (data || []).forEach((row: any) => mergedMap.set(row.id, row));
    localLeads.forEach((row: any) => {
      if (!mergedMap.has(row.id)) mergedMap.set(row.id, row);
    });

    return { data: Array.from(mergedMap.values()) };
  } catch (err: any) {
    return { data: localLeads, error: err?.message };
  }
}

/**
 * 10. Secure Public / Authenticated Order Tracking via POST /api/orders/track.
 * - Logged-in customers authenticate with their Supabase JWT and can track their own orders.
 * - Guest customers must supply BOTH orderRef (Order ID / TQ number / AWB) AND matching contact (email or phone).
 * - Returns strictly sanitized non-PII tracking fields only.
 */
export async function trackPublicOrder(params: {
  orderRef: string;
  contact?: string;
}): Promise<{
  success: boolean;
  tracking?: PublicOrderTrackingResult;
  code?: string;
  message?: string;
}> {
  const orderRef = (params.orderRef || '').trim();
  const contact = (params.contact || '').trim();
  if (!orderRef) {
    return { success: false, code: 'INVALID_TRACKING_QUERY', message: 'Please enter an Order ID or AWB number.' };
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const { data: sessionData } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
    const accessToken = sessionData?.session?.access_token;
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const resp = await fetch('/api/orders/track', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderRef,
        ...(contact ? { contact } : {}),
      }),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.success || !json?.tracking) {
      return {
        success: false,
        code: json?.code,
        message:
          json?.message ||
          'No matching order was found. Please check your Order ID / AWB and registered contact details.',
      };
    }

    return {
      success: true,
      tracking: json.tracking as PublicOrderTrackingResult,
    };
  } catch {
    return {
      success: false,
      message: 'Unable to reach order tracking service right now.',
    };
  }
}

/**
 * 11. Fetch Signed-In Customer's Own Orders via GET /api/customer/orders.
 * Identity is derived strictly from the verified Supabase JWT on the server;
 * client-supplied email/phone arguments are never trusted or sent to the API.
 */
export async function fetchCustomerCustomOrders(
  _email?: string | null,
  _phone?: string | null
): Promise<{ data: CustomOrderRow[]; error?: string }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      return { data: [], error: 'Sign in required to load your order history.' };
    }

    const resp = await fetch('/api/customer/orders', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.success) {
      return {
        data: [],
        error: json?.message || `Unable to sync customer orders (HTTP ${resp.status}).`,
      };
    }

    return { data: Array.isArray(json.orders) ? (json.orders as CustomOrderRow[]) : [] };
  } catch (err: any) {
    return { data: [], error: err?.message || 'Unable to sync customer orders' };
  }
}


