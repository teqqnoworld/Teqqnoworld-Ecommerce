import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ==============================================================================
// SUPABASE TYPES & INTERFACES
// ==============================================================================

export type OrderStatus = 'pending' | 'approved' | 'in-production' | 'dispatched' | 'delivered' | 'cancelled';

export interface ProductColorOption {
  name: string;
  hex: string;
  garmentHex?: string;
}

export interface ProductRow {
  id: string;
  name: string;
  category: string;
  base_price: number;
  moq: number;
  image_url: string | null;
  available_colors: ProductColorOption[] | string[] | any;
  available_sizes: string[] | any;
  description: string | null;
  created_at: string;
}

export interface CustomOrderRow {
  id: string;
  customer_name: string;
  customer_email: string;
  company: string | null;
  phone: string;
  product_id: string | null;
  quantity: number;
  logo_url: string | null;
  custom_notes: string | null;
  status: OrderStatus;
  courier_partner?: string | null;
  tracking_number?: string | null;
  order_group_id?: string | null;
  line_subtotal_inr?: number | null;
  line_total_inr?: number | null;
  coupon_code?: string | null;
  discount_inr?: number | null;
  shipping_saved_inr?: number | null;
  final_total_inr?: number | null;
  amount_paid_inr?: number | null;
  balance_due_inr?: number | null;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  reservation_id?: string | null;
  created_at: string;
}

export interface AbandonedCheckoutRow {
  id: string;
  customer_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  cart_items: any[];
  cart_total: number;
  recovered: boolean;
  recovered_at?: string | null;
  order_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      products: {
        Row: ProductRow;
        Insert: {
          id: string;
          name: string;
          category: string;
          base_price: number;
          moq?: number;
          image_url?: string | null;
          available_colors?: Json;
          available_sizes?: Json;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category?: string;
          base_price?: number;
          moq?: number;
          image_url?: string | null;
          available_colors?: Json;
          available_sizes?: Json;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      custom_orders: {
        Row: CustomOrderRow;
        Insert: {
          id?: string;
          customer_name: string;
          customer_email: string;
          company?: string | null;
          phone: string;
          product_id?: string | null;
          quantity: number;
          logo_url?: string | null;
          custom_notes?: string | null;
          status?: OrderStatus;
          courier_partner?: string | null;
          tracking_number?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_name?: string;
          customer_email?: string;
          company?: string | null;
          phone?: string;
          product_id?: string | null;
          quantity?: number;
          logo_url?: string | null;
          custom_notes?: string | null;
          status?: OrderStatus;
          courier_partner?: string | null;
          tracking_number?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      abandoned_checkouts: {
        Row: AbandonedCheckoutRow;
        Insert: {
          id: string;
          customer_name?: string | null;
          email?: string | null;
          phone?: string | null;
          company?: string | null;
          cart_items?: any[];
          cart_total?: number;
          recovered?: boolean;
          recovered_at?: string | null;
          order_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_name?: string | null;
          email?: string | null;
          phone?: string | null;
          company?: string | null;
          cart_items?: any[];
          cart_total?: number;
          recovered?: boolean;
          recovered_at?: string | null;
          order_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}


// ==============================================================================
// ENVIRONMENT VARIABLES & CLIENT INITIALIZATION
// ==============================================================================

// Live project credentials
const LIVE_SUPABASE_URL = 'https://jqajzfftaxwafctquzjr.supabase.co';
const LIVE_SUPABASE_ANON_KEY = 'sb_publishable_IgO3t6DbnmDpanEfJMCwyw_bqnQytYb';

// Read environment variables (supports standard VITE_ prefixes with direct live fallback)
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL && !import.meta.env.VITE_SUPABASE_URL.includes('your-project'))
  ? import.meta.env.VITE_SUPABASE_URL
  : LIVE_SUPABASE_URL;

const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY && !import.meta.env.VITE_SUPABASE_ANON_KEY.includes('your-anon'))
  ? import.meta.env.VITE_SUPABASE_ANON_KEY
  : LIVE_SUPABASE_ANON_KEY;

/**
 * Checks whether valid, non-placeholder Supabase credentials are configured.
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('your-project') &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('your-anon')
  );
};

const effectiveUrl = supabaseUrl;
const effectiveKey = supabaseAnonKey;


/**
 * Shared Supabase Client instance with full TypeScript Database typing.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  effectiveUrl,
  effectiveKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

/**
 * Helper to inspect the current Supabase connection info
 */
export const getSupabaseConfig = () => ({
  configured: isSupabaseConfigured(),
  url: supabaseUrl || '(not configured)',
  hasKey: Boolean(supabaseAnonKey),
  storageBucket: 'brand-logos',
});

// ==============================================================================
// APPOINTMENTS & CONSULTATIONS COMPATIBILITY HELPERS
// ==============================================================================

export const SUPABASE_PROJECT_ID = 'jqajzfftaxwafctquzjr';

export interface AppointmentBookingData {
  name: string;
  email: string;
  phone: string;
  company?: string;
  appointmentDate: string;
  appointmentTime: string;
  serviceType: string;
  meetingMode: string;
  estimatedQuantity?: number;
  notes?: string;
}

export const RECOMMENDED_SUPABASE_SQL = `-- Appointments Table for Consultations
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    company TEXT,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    service_type TEXT NOT NULL,
    meeting_mode TEXT NOT NULL,
    estimated_quantity INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can book appointments" ON public.appointments FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can view appointments" ON public.appointments FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
`;

export async function saveAppointmentToSupabase(bookingData: AppointmentBookingData): Promise<{
  success: boolean;
  tableUsed?: string;
  needsTableCreation?: boolean;
  error?: string;
  data?: any;
}> {
  try {
    const resp = await fetch('/api/quotes/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submissionType: 'consultation',
        name: bookingData.name,
        email: bookingData.email,
        phone: bookingData.phone,
        company: bookingData.company || null,
        appointmentDate: bookingData.appointmentDate,
        appointmentTime: bookingData.appointmentTime,
        serviceType: bookingData.serviceType,
        meetingMode: bookingData.meetingMode,
        estimatedQuantity: bookingData.estimatedQuantity || null,
        notes: bookingData.notes || null,
      }),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok || !json?.success) {
      return {
        success: false,
        error: json?.message || `Failed to submit consultation booking (HTTP ${resp.status}).`,
      };
    }

    return {
      success: true,
      tableUsed: json.tableUsed || 'custom_orders',
      data: { id: json.orderId, orderNumber: json.orderNumber },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to submit appointment' };
  }
}

