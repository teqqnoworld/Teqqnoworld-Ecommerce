-- ============================================================================
-- TeqqnoWorld Coupon System — Security Hardening & Atomic RPC Migration
-- ============================================================================
-- Strictly additive & idempotent. Safe to run after /supabase/coupons_migration.sql.
-- Do NOT execute automatically; apply manually via Supabase SQL Editor before go-live.
-- ============================================================================

-- 1. Enforce percentage discount <= 100% constraint on public.coupons (idempotent)
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

-- 2. Enforce case-insensitive uniqueness across primary codes & aliases
CREATE TABLE IF NOT EXISTS public.coupon_code_registry (
  code_upper TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  is_alias BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coupon_code_registry_coupon_idx
  ON public.coupon_code_registry (coupon_id);

ALTER TABLE public.coupon_code_registry ENABLE ROW LEVEL SECURITY;

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

-- Backfill existing coupons into coupon_code_registry safely
INSERT INTO public.coupon_code_registry (code_upper, coupon_id, is_alias)
SELECT UPPER(TRIM(code)), id, FALSE
FROM public.coupons
WHERE TRIM(COALESCE(code, '')) <> ''
ON CONFLICT (code_upper) DO NOTHING;

INSERT INTO public.coupon_code_registry (code_upper, coupon_id, is_alias)
SELECT UPPER(TRIM(alias_val)), c.id, TRUE
FROM public.coupons c
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.aliases, '[]'::jsonb)) AS alias_val
WHERE TRIM(COALESCE(alias_val, '')) <> ''
ON CONFLICT (code_upper) DO NOTHING;

-- 3. Tighten RLS on public.coupons (remove direct public SELECT exposing internal fields)
DROP POLICY IF EXISTS "public_read_active_public_coupons" ON public.coupons;

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

-- Harden customer RLS policies on coupon_redemptions & coupon_customer_notifications (C1)
-- Prevents empty/missing JWT email claims (phone OTP, anonymous auth) from matching NULL/empty guest emails.
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

-- 4. Structured Order Pricing, Grouping & Cancellation Status on public.custom_orders (Additive)
-- Prerequisite: supabase/schema.sql must be applied first so public.custom_orders exists.
ALTER TABLE public.custom_orders
  ADD COLUMN IF NOT EXISTS order_group_id TEXT,
  ADD COLUMN IF NOT EXISTS line_subtotal_inr NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS line_total_inr NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS coupon_id TEXT,
  ADD COLUMN IF NOT EXISTS subtotal_inr NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS discount_inr NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_fee_inr NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_saved_inr NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_shipping_applied BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gst_inr NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS final_total_inr NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS amount_paid_inr NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due_inr NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_plan TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS reservation_id TEXT;

-- Safely expand public.custom_orders.status CHECK constraint to support 'dispatched' (used by Admin/Tracking)
-- and 'cancelled' (used by Admin order cancellation & coupon restoration) without touching existing rows (C4).
DO $$
DECLARE
  v_con RECORD;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.custom_orders'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.custom_orders DROP CONSTRAINT IF EXISTS %I', v_con.conname);
  END LOOP;

  ALTER TABLE public.custom_orders
    ADD CONSTRAINT custom_orders_status_check
    CHECK (status IN ('pending', 'approved', 'in-production', 'dispatched', 'delivered', 'cancelled'));
END $$;

CREATE INDEX IF NOT EXISTS idx_custom_orders_order_group
  ON public.custom_orders (order_group_id)
  WHERE order_group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_custom_orders_razorpay_order
  ON public.custom_orders (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_custom_orders_razorpay_payment
  ON public.custom_orders (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_custom_orders_coupon_code
  ON public.custom_orders (coupon_code)
  WHERE coupon_code IS NOT NULL;

-- Deduplicated order-level analytics view (service_role only) preventing multi-item double counting (H4)
CREATE OR REPLACE VIEW public.order_level_analytics AS
SELECT DISTINCT ON (
  COALESCE(
    NULLIF(TRIM(razorpay_order_id), ''),
    NULLIF(TRIM(reservation_id), ''),
    NULLIF(TRIM(order_group_id), ''),
    id::text
  )
)
  COALESCE(
    NULLIF(TRIM(razorpay_order_id), ''),
    NULLIF(TRIM(reservation_id), ''),
    NULLIF(TRIM(order_group_id), ''),
    id::text
  ) AS analytics_order_key,
  id AS primary_order_id,
  order_group_id,
  razorpay_order_id,
  razorpay_payment_id,
  reservation_id,
  customer_name,
  customer_email,
  phone,
  status,
  coupon_code,
  coupon_id,
  subtotal_inr,
  discount_inr,
  shipping_fee_inr,
  shipping_saved_inr,
  free_shipping_applied,
  gst_inr,
  final_total_inr,
  amount_paid_inr,
  balance_due_inr,
  payment_plan,
  created_at
FROM public.custom_orders
ORDER BY
  COALESCE(
    NULLIF(TRIM(razorpay_order_id), ''),
    NULLIF(TRIM(reservation_id), ''),
    NULLIF(TRIM(order_group_id), ''),
    id::text
  ),
  created_at ASC,
  id ASC;

REVOKE ALL ON public.order_level_analytics FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.order_level_analytics TO service_role;

-- Extend payment/reservation idempotency columns on public.coupon_redemptions
ALTER TABLE public.coupon_redemptions
  ADD COLUMN IF NOT EXISTS payment_id TEXT,
  ADD COLUMN IF NOT EXISTS reservation_id TEXT,
  ADD COLUMN IF NOT EXISTS restored_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS restored_by TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_payment_uidx
  ON public.coupon_redemptions (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS coupon_redemptions_reservation_uidx
  ON public.coupon_redemptions (reservation_id)
  WHERE reservation_id IS NOT NULL;

-- 5. Atomic Coupon Reservations Table (Multi-Worker & Multi-Instance Concurrency Control)
CREATE TABLE IF NOT EXISTS public.coupon_reservations (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL REFERENCES public.coupons(id) ON DELETE RESTRICT,
  coupon_code TEXT NOT NULL,
  customer_id TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  order_id TEXT,
  subtotal_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping_fee_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  shipping_saved_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  free_shipping_applied BOOLEAN NOT NULL DEFAULT FALSE,
  gst_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  final_total_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payable_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  balance_due_inr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_plan TEXT NOT NULL DEFAULT 'prepaid_100',
  items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (
    status IN ('reserved', 'finalized', 'released', 'expired')
  ),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coupon_reservations_active_idx
  ON public.coupon_reservations (coupon_id, status, expires_at);

CREATE INDEX IF NOT EXISTS coupon_reservations_customer_email_idx
  ON public.coupon_reservations (LOWER(customer_email), status);

CREATE INDEX IF NOT EXISTS coupon_reservations_razorpay_order_idx
  ON public.coupon_reservations (razorpay_order_id)
  WHERE razorpay_order_id IS NOT NULL;

ALTER TABLE public.coupon_reservations ENABLE ROW LEVEL SECURITY;

-- 6. RPC: Atomically Reserve Coupon Capacity Before Razorpay Checkout
CREATE OR REPLACE FUNCTION public.teqqno_reserve_coupon(
  p_reservation_id TEXT,
  p_coupon_id TEXT,
  p_customer_id TEXT DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_subtotal_inr NUMERIC DEFAULT 0,
  p_discount_inr NUMERIC DEFAULT 0,
  p_shipping_fee_inr NUMERIC DEFAULT 0,
  p_shipping_saved_inr NUMERIC DEFAULT 0,
  p_free_shipping_applied BOOLEAN DEFAULT FALSE,
  p_gst_inr NUMERIC DEFAULT 0,
  p_final_total_inr NUMERIC DEFAULT 0,
  p_payable_inr NUMERIC DEFAULT 0,
  p_balance_due_inr NUMERIC DEFAULT 0,
  p_payment_plan TEXT DEFAULT 'prepaid_100',
  p_items_json JSONB DEFAULT '[]'::jsonb,
  p_ttl_seconds INTEGER DEFAULT 900
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_coupon public.coupons%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_expires TIMESTAMPTZ := NOW() + make_interval(secs => GREATEST(60, LEAST(COALESCE(p_ttl_seconds, 900), 3600)));
  v_redeemed_total INTEGER := 0;
  v_active_reserved_total INTEGER := 0;
  v_effective_total INTEGER := 0;
  v_per_customer_limit INTEGER := NULL;
  v_customer_used INTEGER := 0;
  v_customer_reserved INTEGER := 0;
  v_clean_email TEXT := NULLIF(LOWER(TRIM(COALESCE(p_customer_email, ''))), '');
  v_clean_phone TEXT := NULLIF(RIGHT(REGEXP_REPLACE(COALESCE(p_customer_phone, ''), '\D', '', 'g'), 10), '');
  v_clean_id TEXT := NULLIF(TRIM(COALESCE(p_customer_id, '')), '');
BEGIN
  -- Acquire row-level lock on the coupon so concurrent workers serialize cleanly
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'INVALID_CODE', 'message', 'Coupon not found.');
  END IF;

  -- Check server-clock status inside lock
  IF v_coupon.status IN ('draft', 'paused', 'archived', 'expired') THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'INACTIVE_STATUS', 'message', 'Coupon is not active.');
  END IF;
  IF v_coupon.start_at IS NOT NULL AND v_now < v_coupon.start_at THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'NOT_STARTED', 'message', 'Coupon has not started yet.');
  END IF;
  IF v_coupon.expires_at IS NOT NULL AND v_now >= v_coupon.expires_at THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'EXPIRED', 'message', 'Coupon has expired.');
  END IF;

  -- Expire any stale reservations for this coupon before checking capacity
  UPDATE public.coupon_reservations
  SET status = 'expired', updated_at = v_now
  WHERE coupon_id = v_coupon.id
    AND status = 'reserved'
    AND expires_at <= v_now;

  -- Enforce total usage limit including active reservations
  IF v_coupon.total_usage_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_redeemed_total
    FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id AND status = 'redeemed';

    SELECT COUNT(*) INTO v_active_reserved_total
    FROM public.coupon_reservations
    WHERE coupon_id = v_coupon.id AND status = 'reserved' AND expires_at > v_now;

    v_effective_total := GREATEST(COALESCE(v_coupon.usage_count, 0), v_redeemed_total) + v_active_reserved_total;
    IF v_effective_total >= v_coupon.total_usage_limit THEN
      RETURN jsonb_build_object(
        'ok', FALSE,
        'reason_code', 'TOTAL_LIMIT_REACHED',
        'message', 'This coupon has reached its maximum total redemption limit.'
      );
    END IF;
  END IF;

  -- Enforce per-customer limit strictly (requires verified identity)
  IF v_coupon.one_time_per_customer THEN
    v_per_customer_limit := 1;
  ELSE
    v_per_customer_limit := v_coupon.per_customer_limit;
  END IF;

  IF v_per_customer_limit IS NOT NULL THEN
    IF v_clean_id IS NULL AND v_clean_email IS NULL AND v_clean_phone IS NULL THEN
      RETURN jsonb_build_object(
        'ok', FALSE,
        'reason_code', 'AUTH_REQUIRED',
        'message', 'Please sign in to your account to use this per-customer coupon.'
      );
    END IF;

    SELECT COUNT(*) INTO v_customer_used
    FROM public.coupon_redemptions
    WHERE coupon_id = v_coupon.id
      AND status = 'redeemed'
      AND (
        (v_clean_id IS NOT NULL AND customer_id = v_clean_id)
        OR (v_clean_email IS NOT NULL AND LOWER(COALESCE(customer_email, '')) = v_clean_email)
        OR (v_clean_phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(COALESCE(customer_phone, ''), '\D', '', 'g'), 10) = v_clean_phone)
      );

    SELECT COUNT(*) INTO v_customer_reserved
    FROM public.coupon_reservations
    WHERE coupon_id = v_coupon.id
      AND status = 'reserved'
      AND expires_at > v_now
      AND (
        (v_clean_id IS NOT NULL AND customer_id = v_clean_id)
        OR (v_clean_email IS NOT NULL AND LOWER(COALESCE(customer_email, '')) = v_clean_email)
        OR (v_clean_phone IS NOT NULL AND RIGHT(REGEXP_REPLACE(COALESCE(customer_phone, ''), '\D', '', 'g'), 10) = v_clean_phone)
      );

    IF (v_customer_used + v_customer_reserved) >= v_per_customer_limit THEN
      RETURN jsonb_build_object(
        'ok', FALSE,
        'reason_code', 'CUSTOMER_LIMIT_REACHED',
        'message', 'You have already reached the usage limit for this coupon.'
      );
    END IF;
  END IF;

  INSERT INTO public.coupon_reservations (
    id, coupon_id, coupon_code,
    customer_id, customer_email, customer_phone,
    subtotal_inr, discount_inr, shipping_fee_inr, shipping_saved_inr,
    free_shipping_applied, gst_inr, final_total_inr, payable_inr, balance_due_inr,
    payment_plan, items_json, status, expires_at, created_at, updated_at
  ) VALUES (
    p_reservation_id, v_coupon.id, v_coupon.code,
    v_clean_id, v_clean_email, v_clean_phone,
    COALESCE(p_subtotal_inr, 0), COALESCE(p_discount_inr, 0), COALESCE(p_shipping_fee_inr, 0), COALESCE(p_shipping_saved_inr, 0),
    COALESCE(p_free_shipping_applied, FALSE), COALESCE(p_gst_inr, 0), COALESCE(p_final_total_inr, 0), COALESCE(p_payable_inr, 0), COALESCE(p_balance_due_inr, 0),
    COALESCE(p_payment_plan, 'prepaid_100'), COALESCE(p_items_json, '[]'::jsonb), 'reserved', v_expires, v_now, v_now
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'reservation_id', p_reservation_id,
    'coupon_id', v_coupon.id,
    'coupon_code', v_coupon.code,
    'expires_at', v_expires
  );
END;
$$;

-- 7. RPC: Atomically Finalize Coupon Reservation After Confirmed Payment + Order Creation
-- Enforces canonical lock ordering: public.coupons FIRST -> public.coupon_reservations SECOND (C3)
-- Safely reconciles temporary 'RZP-...' order IDs to verified public.custom_orders UUIDs (C5)
CREATE OR REPLACE FUNCTION public.teqqno_finalize_coupon_reservation(
  p_reservation_id TEXT,
  p_redemption_id TEXT,
  p_order_id TEXT,
  p_order_number TEXT DEFAULT NULL,
  p_payment_id TEXT DEFAULT NULL,
  p_customer_name TEXT DEFAULT NULL,
  p_payment_status TEXT DEFAULT 'paid'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_coupon_id TEXT;
  v_res public.coupon_reservations%ROWTYPE;
  v_coupon public.coupons%ROWTYPE;
  v_existing public.coupon_redemptions%ROWTYPE;
  v_now TIMESTAMPTZ := NOW();
  v_redeemed_total INTEGER := 0;
  v_other_reserved_total INTEGER := 0;
  v_clean_order_id TEXT := NULLIF(TRIM(COALESCE(p_order_id, '')), '');
  v_clean_order_number TEXT := NULLIF(TRIM(COALESCE(p_order_number, '')), '');
  v_clean_customer_name TEXT := NULLIF(TRIM(COALESCE(p_customer_name, '')), '');
  v_reconciled BOOLEAN := FALSE;
  v_conflict_exists BOOLEAN := FALSE;
BEGIN
  IF v_clean_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'INVALID_ORDER_ID', 'message', 'Order ID is required.');
  END IF;

  -- Step 1: Non-locking lookup of coupon_id to establish canonical lock hierarchy
  SELECT coupon_id INTO v_coupon_id
  FROM public.coupon_reservations
  WHERE id = p_reservation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'RESERVATION_NOT_FOUND', 'message', 'Coupon reservation not found.');
  END IF;

  -- Step 2: Lock public.coupons FIRST (same order as teqqno_reserve_coupon to prevent deadlocks)
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE id = v_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'INVALID_CODE', 'message', 'Coupon not found.');
  END IF;

  -- Step 3: Lock and revalidate public.coupon_reservations SECOND
  SELECT * INTO v_res
  FROM public.coupon_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'RESERVATION_NOT_FOUND', 'message', 'Coupon reservation not found.');
  END IF;

  -- Idempotency check by reservation_id, payment_id, or (coupon_id, order_id)
  SELECT * INTO v_existing
  FROM public.coupon_redemptions
  WHERE reservation_id = p_reservation_id
     OR (p_payment_id IS NOT NULL AND payment_id = p_payment_id)
     OR (coupon_id = v_res.coupon_id AND order_id = v_clean_order_id)
  ORDER BY redeemed_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    -- Safe webhook-first reconciliation (C5):
    -- Only upgrade a temporary 'RZP-...' placeholder order_id to a verified real order ID
    -- when tied to this same reservation/payment, and NEVER overwrite a different real order ID.
    IF v_existing.order_id LIKE 'RZP-%'
       AND v_clean_order_id NOT LIKE 'RZP-%'
       AND (
         v_existing.reservation_id = p_reservation_id
         OR (p_payment_id IS NOT NULL AND v_existing.payment_id = p_payment_id)
       ) THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.coupon_redemptions
        WHERE coupon_id = v_existing.coupon_id
          AND order_id = v_clean_order_id
          AND id <> v_existing.id
      ) INTO v_conflict_exists;

      IF NOT v_conflict_exists THEN
        UPDATE public.coupon_redemptions
        SET order_id = v_clean_order_id,
            order_number = COALESCE(v_clean_order_number, order_number),
            customer_name = COALESCE(v_clean_customer_name, customer_name),
            payment_id = COALESCE(payment_id, p_payment_id)
        WHERE id = v_existing.id
          AND order_id LIKE 'RZP-%';

        UPDATE public.coupon_reservations
        SET status = 'finalized',
            order_id = v_clean_order_id,
            razorpay_payment_id = COALESCE(razorpay_payment_id, p_payment_id),
            updated_at = v_now
        WHERE id = p_reservation_id
          AND (order_id IS NULL OR order_id LIKE 'RZP-%');

        v_reconciled := TRUE;
      END IF;
    ELSE
      UPDATE public.coupon_reservations
      SET status = 'finalized',
          order_id = COALESCE(order_id, v_clean_order_id),
          razorpay_payment_id = COALESCE(razorpay_payment_id, p_payment_id),
          updated_at = v_now
      WHERE id = p_reservation_id AND status <> 'finalized';
    END IF;

    RETURN jsonb_build_object(
      'ok', TRUE,
      'already_finalized', TRUE,
      'reconciled', v_reconciled,
      'redemption_id', v_existing.id,
      'coupon_code', v_existing.coupon_code,
      'order_id', CASE WHEN v_reconciled THEN v_clean_order_id ELSE v_existing.order_id END
    );
  END IF;

  IF v_res.status = 'released' THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'RESERVATION_RELEASED', 'message', 'Coupon reservation was already released.');
  END IF;

  -- If reservation expired right as payment landed, re-check total limit (redeemed + other active reservations)
  -- inside the coupon lock before allowing grace-period capture finalization
  IF v_res.status = 'expired' OR v_res.expires_at <= v_now THEN
    IF v_coupon.total_usage_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_redeemed_total
      FROM public.coupon_redemptions
      WHERE coupon_id = v_coupon.id AND status = 'redeemed';

      SELECT COUNT(*) INTO v_other_reserved_total
      FROM public.coupon_reservations
      WHERE coupon_id = v_coupon.id
        AND id <> p_reservation_id
        AND status = 'reserved'
        AND expires_at > v_now;

      IF (GREATEST(COALESCE(v_coupon.usage_count, 0), v_redeemed_total) + v_other_reserved_total) >= v_coupon.total_usage_limit THEN
        RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'RESERVATION_EXPIRED', 'message', 'Coupon reservation expired and capacity is no longer available.');
      END IF;
    END IF;
  END IF;

  INSERT INTO public.coupon_redemptions (
    id, coupon_id, coupon_code, order_id, order_number,
    customer_id, customer_name, customer_email, customer_phone,
    subtotal_inr, discount_inr, shipping_saved_inr, final_total_inr,
    payment_status, payment_id, reservation_id, status, redeemed_at
  ) VALUES (
    p_redemption_id, v_res.coupon_id, v_res.coupon_code, v_clean_order_id, v_clean_order_number,
    v_res.customer_id, v_clean_customer_name, v_res.customer_email, v_res.customer_phone,
    v_res.subtotal_inr, v_res.discount_inr, v_res.shipping_saved_inr, v_res.final_total_inr,
    COALESCE(p_payment_status, 'paid'), p_payment_id, p_reservation_id, 'redeemed', v_now
  );

  UPDATE public.coupons
  SET usage_count = COALESCE(usage_count, 0) + 1,
      total_discount_given = COALESCE(total_discount_given, 0) + COALESCE(v_res.discount_inr, 0) + COALESCE(v_res.shipping_saved_inr, 0),
      total_revenue_generated = COALESCE(total_revenue_generated, 0) + COALESCE(v_res.final_total_inr, 0),
      updated_at = v_now
  WHERE id = v_coupon.id;

  UPDATE public.coupon_reservations
  SET status = 'finalized',
      order_id = v_clean_order_id,
      razorpay_payment_id = COALESCE(razorpay_payment_id, p_payment_id),
      updated_at = v_now
  WHERE id = p_reservation_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'already_finalized', FALSE,
    'reconciled', FALSE,
    'redemption_id', p_redemption_id,
    'coupon_code', v_res.coupon_code,
    'order_id', v_clean_order_id
  );
END;
$$;

-- 8. RPC: Atomically Release a Reservation on Failed / Cancelled Checkout
CREATE OR REPLACE FUNCTION public.teqqno_release_coupon_reservation(
  p_reservation_id TEXT DEFAULT NULL,
  p_razorpay_order_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_updated_id TEXT;
BEGIN
  UPDATE public.coupon_reservations
  SET status = 'released', updated_at = NOW()
  WHERE status = 'reserved'
    AND (
      (p_reservation_id IS NOT NULL AND id = p_reservation_id)
      OR (p_razorpay_order_id IS NOT NULL AND razorpay_order_id = p_razorpay_order_id)
    )
  RETURNING id INTO v_updated_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'released', v_updated_id IS NOT NULL,
    'reservation_id', v_updated_id
  );
END;
$$;

-- 9. RPC: Atomic Redemption Restoration (Strictly redeemed -> restored, Single-Decrement Guaranteed)
-- Uses canonical lock order: public.coupons FIRST -> public.coupon_redemptions SECOND (C3)
CREATE OR REPLACE FUNCTION public.teqqno_restore_coupon_redemption(
  p_redemption_id TEXT,
  p_actor TEXT DEFAULT 'admin',
  p_force BOOLEAN DEFAULT FALSE,
  p_audit_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_coupon_id TEXT;
  v_redemption public.coupon_redemptions%ROWTYPE;
  v_coupon public.coupons%ROWTYPE;
  v_restore_enabled BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT restore_on_cancel INTO v_restore_enabled
  FROM public.coupon_settings
  WHERE id = 'default';

  IF NOT COALESCE(v_restore_enabled, FALSE) AND NOT COALESCE(p_force, FALSE) THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'reason_code', 'POLICY_DISABLED',
      'message', 'Coupon restoration on cancellation is disabled by policy.'
    );
  END IF;

  -- Non-locking lookup of coupon_id so public.coupons is locked FIRST (canonical order)
  SELECT coupon_id INTO v_coupon_id
  FROM public.coupon_redemptions
  WHERE id = p_redemption_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'NOT_FOUND', 'message', 'Redemption record not found.');
  END IF;

  -- Lock coupon row FIRST
  SELECT * INTO v_coupon
  FROM public.coupons
  WHERE id = v_coupon_id
  FOR UPDATE;

  -- Lock and revalidate redemption row SECOND
  SELECT * INTO v_redemption
  FROM public.coupon_redemptions
  WHERE id = p_redemption_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason_code', 'NOT_FOUND', 'message', 'Redemption record not found.');
  END IF;

  -- Enforce strict one-way state transition: ONLY redeemed -> restored
  IF v_redemption.status <> 'redeemed' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'already_restored', v_redemption.status = 'restored',
      'reason_code', 'INVALID_STATE_TRANSITION',
      'message', 'Redemption can only be restored when its current status is redeemed.'
    );
  END IF;

  UPDATE public.coupon_redemptions
  SET status = 'restored',
      restored_at = v_now,
      restored_by = COALESCE(p_actor, 'admin')
  WHERE id = v_redemption.id
    AND status = 'redeemed';

  IF FOUND AND v_coupon.id IS NOT NULL THEN
    UPDATE public.coupons
    SET usage_count = GREATEST(0, COALESCE(usage_count, 0) - 1),
        total_discount_given = GREATEST(0, COALESCE(total_discount_given, 0) - (COALESCE(v_redemption.discount_inr, 0) + COALESCE(v_redemption.shipping_saved_inr, 0))),
        total_revenue_generated = GREATEST(0, COALESCE(total_revenue_generated, 0) - COALESCE(v_redemption.final_total_inr, 0)),
        updated_at = v_now
    WHERE id = v_coupon.id;
  END IF;

  INSERT INTO public.coupon_audit_logs (id, coupon_id, coupon_code, action, actor, summary, metadata, created_at)
  VALUES (
    COALESCE(p_audit_id, 'caud_' || replace(pg_catalog.gen_random_uuid()::text, '-', '')),
    v_redemption.coupon_id,
    v_redemption.coupon_code,
    'RESTORE_REDEMPTION',
    COALESCE(p_actor, 'admin'),
    'Restored coupon usage for order ' || COALESCE(v_redemption.order_number, v_redemption.order_id),
    jsonb_build_object(
      'redemptionId', v_redemption.id,
      'orderId', v_redemption.order_id,
      'forceOverride', COALESCE(p_force, FALSE)
    ),
    v_now
  );

  RETURN jsonb_build_object(
    'ok', TRUE,
    'restored', TRUE,
    'redemption_id', v_redemption.id,
    'coupon_id', v_redemption.coupon_id,
    'coupon_code', v_redemption.coupon_code
  );
END;
$$;

-- Restrict RPC execution strictly to service_role (never callable directly by anon/authenticated clients)
REVOKE ALL ON FUNCTION public.teqqno_reserve_coupon(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.teqqno_finalize_coupon_reservation(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.teqqno_release_coupon_reservation(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.teqqno_restore_coupon_redemption(TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.teqqno_reserve_coupon(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.teqqno_finalize_coupon_reservation(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.teqqno_release_coupon_reservation(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.teqqno_restore_coupon_redemption(TEXT, TEXT, BOOLEAN, TEXT) TO service_role;
