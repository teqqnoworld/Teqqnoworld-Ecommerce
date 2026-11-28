-- ==============================================================================
-- TEQQNOWORLD PHASE 5 — SEO ANALYTICS & GOOGLE SEARCH MONITORING MIGRATION
-- Strictly ADDITIVE & IDEMPOTENT migration.
-- Does NOT modify, drop, or alter any existing orders, products, coupons,
-- affiliates, reviews, wallets, or customer tables.
--
-- Security Model:
-- - Strict Row Level Security (RLS) enabled on every table.
-- - Direct anon & authenticated table privileges REVOKED.
-- - Accessed exclusively by Express backend using verified Admin Session Auth
--   and SUPABASE_SERVICE_ROLE_KEY (never exposes Google credentials to client).
-- - Do NOT execute automatically; apply manually in Supabase SQL Editor.
-- ==============================================================================

-- 1. Google Search Console & GA4 Snapshot Storage (Deduplicated by property, range & dimension)
CREATE TABLE IF NOT EXISTS public.seo_analytics_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('gsc', 'ga4')),
  property_identifier TEXT NOT NULL,
  dimension_type TEXT NOT NULL CHECK (
    dimension_type IN ('query', 'page', 'country', 'device', 'search_appearance', 'date', 'ga4_landing_channel')
  ),
  date_start DATE NOT NULL,
  date_end DATE NOT NULL,
  data_source TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  rows_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_by TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seo_snapshots_date_range_check CHECK (date_end >= date_start),
  CONSTRAINT seo_snapshots_unique_slice UNIQUE (provider, property_identifier, dimension_type, date_start, date_end)
);

CREATE INDEX IF NOT EXISTS idx_seo_snapshots_provider_dates
  ON public.seo_analytics_snapshots (provider, date_start DESC, date_end DESC);

-- 2. Verified URL Inspection & Indexing Status Snapshots (GSC URL Inspection API or CSV Import)
CREATE TABLE IF NOT EXISTS public.seo_url_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_url TEXT NOT NULL,
  inspected_url TEXT NOT NULL,
  normalized_path TEXT NOT NULL,
  index_status TEXT NOT NULL CHECK (index_status IN ('indexed', 'not_indexed', 'unknown')),
  coverage_state TEXT NOT NULL DEFAULT '',
  verdict TEXT NOT NULL DEFAULT '',
  last_crawl_time TIMESTAMPTZ NULL,
  data_source TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seo_url_inspections_unique_url UNIQUE (property_url, normalized_path)
);

CREATE INDEX IF NOT EXISTS idx_seo_url_inspections_status
  ON public.seo_url_inspections (index_status, checked_at DESC);

-- 3. First-Party Consent-Compliant Non-PII Attribution Events
--    Stores strictly non-PII traffic channel, landing path, product ID, INR value & deduplicated transaction ID.
CREATE TABLE IF NOT EXISTS public.seo_attribution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name TEXT NOT NULL CHECK (
    event_name IN (
      'page_view', 'view_item', 'view_item_list', 'select_item',
      'add_to_cart', 'begin_checkout', 'purchase',
      'generate_lead', 'form_submit', 'whatsapp_enquiry', 'quote_request'
    )
  ),
  event_key TEXT NULL,
  transaction_id TEXT NULL,
  session_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('organic_search', 'direct', 'paid_search', 'referral', 'social')),
  landing_path TEXT NOT NULL,
  page_path TEXT NOT NULL,
  product_id TEXT NULL,
  product_name TEXT NULL,
  category_slug TEXT NULL,
  value_inr NUMERIC(12, 2) NULL CHECK (value_inr IS NULL OR value_inr >= 0),
  quantity INTEGER NULL CHECK (quantity IS NULL OR quantity >= 0),
  source_host TEXT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_attribution_occurred_channel
  ON public.seo_attribution_events (occurred_at DESC, channel, event_name);

CREATE INDEX IF NOT EXISTS idx_seo_attribution_product_landing
  ON public.seo_attribution_events (product_id, landing_path, occurred_at DESC);

-- Prevent duplicate purchase events for the same transaction_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_attribution_unique_purchase_tx
  ON public.seo_attribution_events (event_name, transaction_id)
  WHERE event_name = 'purchase' AND transaction_id IS NOT NULL;

-- Prevent duplicate keyed lead/enquiry events
CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_attribution_unique_event_key
  ON public.seo_attribution_events (event_key)
  WHERE event_key IS NOT NULL;

-- 4. Administrator Workflow Status for Actionable SEO Recommendations
CREATE TABLE IF NOT EXISTS public.seo_recommendation_states (
  recommendation_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'ignored')),
  issue_title TEXT NOT NULL,
  affected_url TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT 'admin',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_recommendation_states_status
  ON public.seo_recommendation_states (status, updated_at DESC);

-- 5. Safe updated_at Trigger Function (Hardened search_path)
CREATE OR REPLACE FUNCTION public.teqqno_set_seo_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.teqqno_set_seo_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_seo_snapshots_updated_at ON public.seo_analytics_snapshots;
CREATE TRIGGER trg_seo_snapshots_updated_at
  BEFORE UPDATE ON public.seo_analytics_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.teqqno_set_seo_updated_at();

DROP TRIGGER IF EXISTS trg_seo_url_inspections_updated_at ON public.seo_url_inspections;
CREATE TRIGGER trg_seo_url_inspections_updated_at
  BEFORE UPDATE ON public.seo_url_inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.teqqno_set_seo_updated_at();

-- 6. Strict Row Level Security (Service-Role Backend Admin Access Only)
ALTER TABLE public.seo_analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_url_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_attribution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_recommendation_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.seo_analytics_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.seo_url_inspections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.seo_attribution_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.seo_recommendation_states FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.seo_analytics_snapshots TO service_role;
GRANT ALL ON TABLE public.seo_url_inspections TO service_role;
GRANT ALL ON TABLE public.seo_attribution_events TO service_role;
GRANT ALL ON TABLE public.seo_recommendation_states TO service_role;

DROP POLICY IF EXISTS "service_role_full_access_seo_snapshots" ON public.seo_analytics_snapshots;
CREATE POLICY "service_role_full_access_seo_snapshots"
  ON public.seo_analytics_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_seo_url_inspections" ON public.seo_url_inspections;
CREATE POLICY "service_role_full_access_seo_url_inspections"
  ON public.seo_url_inspections
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_seo_attribution_events" ON public.seo_attribution_events;
CREATE POLICY "service_role_full_access_seo_attribution_events"
  ON public.seo_attribution_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_full_access_seo_recommendation_states" ON public.seo_recommendation_states;
CREATE POLICY "service_role_full_access_seo_recommendation_states"
  ON public.seo_recommendation_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
