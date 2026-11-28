-- ==============================================================================
-- TEQQNOWORLD — CUSTOM ORDERS ROW LEVEL SECURITY (RLS) HARDENING MIGRATION
-- Target Database: Existing TeqqnoWorld Supabase PostgreSQL
-- Target Table:    public.custom_orders ONLY
--
-- DO NOT EXECUTE AUTOMATICALLY.
-- DEPLOYMENT ORDER (CRITICAL):
--   1. Deploy the updated Node.js/Express application (with /api/admin/orders,
--      /api/admin/orders/:orderId/status, /api/customer/orders, /api/orders/track,
--      /api/quotes/submit, and hardened /api/aisensy/order-action) to Hostinger.
--   2. Confirm SUPABASE_SERVICE_ROLE_KEY is configured on Hostinger (server-only,
--      NEVER prefixed with VITE_).
--   3. Take a Supabase database snapshot/backup.
--   4. Run this script manually in the Supabase SQL Editor.
--
-- SECURITY ISSUES RESOLVED:
--   - CRITICAL ISSUE A: Removes "Public read custom_orders" (public SELECT,
--     qual = true) which allowed anonymous internet users to read all customer
--     names, emails, phone numbers, companies, and order notes.
--   - CRITICAL ISSUE B: Removes "Admins can view all custom order quotes"
--     (authenticated SELECT) and "Admins can update custom order quote status"
--     (authenticated UPDATE), which used auth.role() = 'authenticated'. Because
--     ordinary Supabase Auth customers also receive the `authenticated` role
--     while real Admins authenticate via Express PIN + 2FA, those policies
--     allowed any logged-in customer to read or modify other customers' orders.
--   - CRITICAL ISSUE C: Removes unnecessary direct browser INSERT policies
--     ("Public insert orders" / "Anyone can submit a custom order quote") now
--     that all checkout orders (/api/orders/place) and quotes/RFQs/consultations
--     (/api/quotes/submit) are validated, rate-limited, and persisted server-side
--     using SUPABASE_SERVICE_ROLE_KEY.
--
-- GUARANTEES:
--   - Preserves 100% of existing rows, columns, constraints, and indexes on
--     public.custom_orders (zero data deletion or schema alteration).
--   - Does NOT modify unrelated tables (products, product_reviews, coupons,
--     affiliate_*, seo_*, blog_*).
--   - Idempotent (safe to re-run without error).
-- ==============================================================================

BEGIN;

-- 1. Ensure Row Level Security (RLS) is strictly enabled on public.custom_orders
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

-- 2. Remove unrestricted anonymous/public SELECT policy (Critical Issue A)
DROP POLICY IF EXISTS "Public read custom_orders" ON public.custom_orders;

-- 3. Remove overly broad `authenticated` policies that granted all regular
--    Supabase Auth customers full SELECT and UPDATE access (Critical Issue B)
DROP POLICY IF EXISTS "Admins can view all custom order quotes" ON public.custom_orders;
DROP POLICY IF EXISTS "Admins can update custom order quote status" ON public.custom_orders;

-- 4. Remove direct browser-side public INSERT policies now that all order,
--    quote, Bulk RFQ, and consultation writes flow through validated,
--    rate-limited Express backend APIs (/api/orders/place & /api/quotes/submit)
--    using server-side service_role credentials (Critical Issue C)
DROP POLICY IF EXISTS "Public insert orders" ON public.custom_orders;
DROP POLICY IF EXISTS "Anyone can submit a custom order quote" ON public.custom_orders;

-- 5. Grant explicit full access strictly to server-side `service_role`
DROP POLICY IF EXISTS "Service role full access custom_orders" ON public.custom_orders;
CREATE POLICY "Service role full access custom_orders"
  ON public.custom_orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 6. Defense-in-depth table privilege hardening:
--    Ensure `anon`, `authenticated`, and `PUBLIC` have ZERO direct table grants
--    on public.custom_orders, while `service_role` retains full backend access.
REVOKE ALL ON TABLE public.custom_orders FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.custom_orders TO service_role;

COMMIT;

-- ==============================================================================
-- POST-MIGRATION READ-ONLY VERIFICATION QUERIES (RUN MANUALLY AFTER APPLYING)
-- ==============================================================================
-- 1) Confirm RLS is enabled:
--    SELECT relname, relrowsecurity
--    FROM pg_class
--    WHERE relnamespace = 'public'::regnamespace AND relname = 'custom_orders';
--    -- Expected: relrowsecurity = true
--
-- 2) Confirm ONLY "Service role full access custom_orders" exists:
--    SELECT policyname, roles, cmd, qual, with_check
--    FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'custom_orders'
--    ORDER BY policyname;
--    -- Expected: 1 row (Service role full access custom_orders | {service_role} | ALL)
--
-- 3) Confirm anon and authenticated have ZERO table privileges:
--    SELECT grantee, privilege_type
--    FROM information_schema.role_table_grants
--    WHERE table_schema = 'public'
--      AND table_name = 'custom_orders'
--      AND grantee IN ('PUBLIC', 'anon', 'authenticated');
--    -- Expected: 0 rows
--
-- 4) Confirm existing order count is unchanged:
--    SELECT count(*) AS total_orders FROM public.custom_orders;

-- ==============================================================================
-- ROLLBACK GUIDANCE (ONLY IF EMERGENCY TEMPORARY ROLLBACK IS EVER REQUIRED)
-- ==============================================================================
-- WARNING: NEVER restore "Public read custom_orders" (qual = true) or broad
-- `authenticated` SELECT/UPDATE policies — both expose customer PII.
--
-- If you ever need to temporarily re-enable legacy direct browser INSERT ONLY
-- (for example, while diagnosing a server env var issue), run ONLY:
--
--   BEGIN;
--   GRANT INSERT ON TABLE public.custom_orders TO anon, authenticated;
--   CREATE POLICY "Public insert orders"
--     ON public.custom_orders
--     FOR INSERT
--     TO public
--     WITH CHECK (true);
--   COMMIT;
--
-- Do NOT re-grant SELECT or UPDATE to anon or authenticated.
