-- ============================================================================
-- TeqqnoWorld Admin Coupon & Offer Management System — Additive Migration
-- ============================================================================
-- Safe & idempotent: does NOT drop or alter any existing tables or data.
-- Run manually in the Supabase SQL Editor when deploying to production.
-- ============================================================================

-- 1. Core Coupons & Festival Offers Table
CREATE TABLE IF NOT EXISTS public.coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  name TEXT NOT NULL,
  campaign_name TEXT,
  description TEXT,
  offer_type TEXT NOT NULL CHECK (offer_type IN ('percentage', 'fixed', 'free_shipping')),
  discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  min_order_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  max_order_amount NUMERIC(12, 2) CHECK (max_order_amount IS NULL OR max_order_amount >= 0),
  max_discount_cap NUMERIC(12, 2) CHECK (max_discount_cap IS NULL OR max_discount_cap >= 0),
  start_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('draft', 'scheduled', 'active', 'paused', 'expired', 'archived')
  ),
  applicability TEXT NOT NULL DEFAULT 'entire_website' CHECK (
    applicability IN (
      'entire_website',
      'selected_products',
      'selected_categories',
      'selected_customers',
      'new_customers_only',
      'existing_customers_only',
      'selected_customer_groups'
    )
  ),
  eligible_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  eligible_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  eligible_customer_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  assigned_customers JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  is_festival BOOLEAN NOT NULL DEFAULT FALSE,
  festival_preset TEXT,
  festival_banner_url TEXT,
  festival_banner_headline TEXT,
  festival_banner_subtext TEXT,
  show_on_storefront BOOLEAN NOT NULL DEFAULT FALSE,
  total_usage_limit INTEGER CHECK (total_usage_limit IS NULL OR total_usage_limit > 0),
  per_customer_limit INTEGER CHECK (per_customer_limit IS NULL OR per_customer_limit > 0),
  one_time_per_customer BOOLEAN NOT NULL DEFAULT FALSE,
  allow_combine_with_coupons BOOLEAN NOT NULL DEFAULT FALSE,
  allow_combine_with_promotions BOOLEAN NOT NULL DEFAULT TRUE,
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  total_discount_given NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_revenue_generated NUMERIC(12, 2) NOT NULL DEFAULT 0,
  internal_note TEXT,
  is_legacy BOOLEAN NOT NULL DEFAULT FALSE,
  requires_recovery_session BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce case-insensitive uniqueness on trimmed coupon code
CREATE UNIQUE INDEX IF NOT EXISTS coupons_code_upper_uidx
  ON public.coupons (UPPER(TRIM(code)));

CREATE INDEX IF NOT EXISTS coupons_status_idx
  ON public.coupons (status);

CREATE INDEX IF NOT EXISTS coupons_schedule_idx
  ON public.coupons (start_at, expires_at);

CREATE INDEX IF NOT EXISTS coupons_festival_idx
  ON public.coupons (is_festival, is_private, show_on_storefront);

-- 2. Coupon Redemptions History (Order-Linked, Idempotent)
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  coupon_code TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_number TEXT,
  customer_id TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  subtotal_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping_saved_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  final_total_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'redeemed' CHECK (status IN ('redeemed', 'restored', 'cancelled')),
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate redemption of the same coupon on the same order
CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_coupon_order_uidx
  ON public.coupon_redemptions (coupon_id, order_id);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx
  ON public.coupon_redemptions (coupon_id, redeemed_at DESC);

CREATE INDEX IF NOT EXISTS coupon_redemptions_customer_email_idx
  ON public.coupon_redemptions (LOWER(customer_email));

CREATE INDEX IF NOT EXISTS coupon_redemptions_customer_phone_idx
  ON public.coupon_redemptions (customer_phone);

-- 3. Append-Only Admin Audit Logs for Coupon Operations
CREATE TABLE IF NOT EXISTS public.coupon_audit_logs (
  id TEXT PRIMARY KEY,
  coupon_id TEXT,
  coupon_code TEXT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'admin',
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coupon_audit_logs_created_idx
  ON public.coupon_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS coupon_audit_logs_coupon_idx
  ON public.coupon_audit_logs (coupon_id);

-- 4. Customer-Specific Offer Notifications (Private Portal Banner & Email Log)
CREATE TABLE IF NOT EXISTS public.coupon_customer_notifications (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  coupon_code TEXT NOT NULL,
  customer_id TEXT,
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'dashboard' CHECK (channel IN ('dashboard', 'email', 'both')),
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_status_note TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coupon_customer_notifications_email_idx
  ON public.coupon_customer_notifications (LOWER(customer_email), created_at DESC);

-- 5. Global Coupon Policy Settings (Singleton row id = 'default')
CREATE TABLE IF NOT EXISTS public.coupon_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  restore_on_cancel BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by TEXT DEFAULT 'admin',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.coupon_settings (id, restore_on_cancel)
VALUES ('default', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 6. Automatic updated_at Trigger on public.coupons
CREATE OR REPLACE FUNCTION public.teqqno_set_coupon_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.teqqno_set_coupon_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON public.coupons;
CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.teqqno_set_coupon_updated_at();

-- Enforce percentage discounts never exceed 100% at the database layer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coupons_percentage_max_100_chk'
  ) THEN
    ALTER TABLE public.coupons
      ADD CONSTRAINT coupons_percentage_max_100_chk
      CHECK (offer_type <> 'percentage' OR (discount_value > 0 AND discount_value <= 100));
  END IF;
END $$;

-- Enforce case-insensitive uniqueness across BOTH primary codes and aliases at the database level
CREATE TABLE IF NOT EXISTS public.coupon_code_registry (
  code_upper TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  is_alias BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coupon_code_registry_coupon_idx
  ON public.coupon_code_registry (coupon_id);

CREATE OR REPLACE FUNCTION public.teqqno_sync_coupon_code_registry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_alias TEXT;
  v_norm TEXT;
BEGIN
  DELETE FROM public.coupon_code_registry WHERE coupon_id = NEW.id;

  v_norm := UPPER(TRIM(COALESCE(NEW.code, '')));
  IF v_norm <> '' THEN
    INSERT INTO public.coupon_code_registry (code_upper, coupon_id, is_alias)
    VALUES (v_norm, NEW.id, FALSE);
  END IF;

  IF NEW.aliases IS NOT NULL AND jsonb_typeof(NEW.aliases) = 'array' THEN
    FOR v_alias IN SELECT jsonb_array_elements_text(NEW.aliases)
    LOOP
      v_norm := UPPER(TRIM(COALESCE(v_alias, '')));
      IF v_norm <> '' THEN
        INSERT INTO public.coupon_code_registry (code_upper, coupon_id, is_alias)
        VALUES (v_norm, NEW.id, TRUE);
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.teqqno_sync_coupon_code_registry() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_coupons_sync_code_registry ON public.coupons;
CREATE TRIGGER trg_coupons_sync_code_registry
  AFTER INSERT OR UPDATE OF code, aliases ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.teqqno_sync_coupon_code_registry();

-- 7. Row-Level Security (RLS)
-- All Admin writes, public summary serving (/api/coupons/public), and private validations happen server-side via SUPABASE_SERVICE_ROLE_KEY.
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_code_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_customer_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_settings ENABLE ROW LEVEL SECURITY;

-- Remove direct public SELECT on raw public.coupons so internal_note, usage_count,
-- total_discount_given, total_revenue_generated, created_by, and assigned_customers
-- are never readable via the public Supabase anon key.
DROP POLICY IF EXISTS "public_read_active_public_coupons" ON public.coupons;

-- Narrow storefront-safe view exposing ONLY public promotional metadata (no internal metrics or customer PII)
CREATE OR REPLACE VIEW public.public_storefront_coupons AS
SELECT
  id,
  code,
  name,
  campaign_name,
  description,
  offer_type,
  discount_value,
  min_order_amount,
  max_order_amount,
  max_discount_cap,
  start_at,
  expires_at,
  applicability,
  eligible_product_ids,
  eligible_categories,
  is_festival,
  festival_preset,
  festival_banner_url,
  festival_banner_headline,
  festival_banner_subtext,
  show_on_storefront,
  one_time_per_customer
FROM public.coupons
WHERE is_private = FALSE
  AND applicability <> 'selected_customers'
  AND requires_recovery_session = FALSE
  AND show_on_storefront = TRUE
  AND status = 'active'
  AND (start_at IS NULL OR start_at <= NOW())
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (total_usage_limit IS NULL OR usage_count < total_usage_limit);

GRANT SELECT ON public.public_storefront_coupons TO anon, authenticated;

-- Authenticated customers may read ONLY their own redemption records
-- Strictly requires BOTH a non-empty JWT email claim AND a non-NULL non-empty customer_email
-- so phone-OTP, anonymous, or email-less sessions can never match guest rows.
DROP POLICY IF EXISTS "customer_read_own_redemptions" ON public.coupon_redemptions;
CREATE POLICY "customer_read_own_redemptions"
  ON public.coupon_redemptions
  FOR SELECT
  TO authenticated
  USING (
    customer_email IS NOT NULL
    AND NULLIF(TRIM(customer_email), '') IS NOT NULL
    AND NULLIF(TRIM(COALESCE(auth.jwt() ->> 'email', '')), '') IS NOT NULL
    AND LOWER(TRIM(customer_email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
  );

-- Authenticated customers may read ONLY their own private coupon notifications
DROP POLICY IF EXISTS "customer_read_own_notifications" ON public.coupon_customer_notifications;
CREATE POLICY "customer_read_own_notifications"
  ON public.coupon_customer_notifications
  FOR SELECT
  TO authenticated
  USING (
    customer_email IS NOT NULL
    AND NULLIF(TRIM(customer_email), '') IS NOT NULL
    AND NULLIF(TRIM(COALESCE(auth.jwt() ->> 'email', '')), '') IS NOT NULL
    AND LOWER(TRIM(customer_email)) = LOWER(TRIM(auth.jwt() ->> 'email'))
  );

-- Audit logs, code registry, raw coupons, and settings are strictly admin/service-role only (no public/authenticated policies)
