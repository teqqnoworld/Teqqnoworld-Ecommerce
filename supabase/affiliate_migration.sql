-- ==============================================================================
-- TEQQNOWORLD — AFFILIATE PARTNER PROGRAM DATABASE MIGRATION (ADDITIVE / SAFE)
-- ==============================================================================
-- IMPORTANT:
--   1. This SQL migration is ADDITIVE and IDEMPOTENT (uses IF NOT EXISTS / OR REPLACE).
--   2. It contains NO DROP, TRUNCATE, or destructive ALTER commands on existing tables.
--   3. It does NOT modify existing products, custom_orders, or product_reviews tables.
--   4. Run this script manually in your Supabase SQL Editor when ready to enable
--      PostgreSQL-backed Affiliate Partner Program storage.
--   5. Prerequisites: Existing Supabase project with pgcrypto / gen_random_uuid()
--      and existing public.products / public.custom_orders tables.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Shared updated_at trigger helper (idempotent)
CREATE OR REPLACE FUNCTION public.affiliate_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ==============================================================================
-- 1. AFFILIATE PROGRAM SETTINGS (SINGLETON CONFIG)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_program_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  program_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  program_paused BOOLEAN NOT NULL DEFAULT FALSE,
  registration_open BOOLEAN NOT NULL DEFAULT TRUE,
  affiliate_id_prefix TEXT NOT NULL DEFAULT 'TW-AFF-',
  affiliate_id_digits INTEGER NOT NULL DEFAULT 6 CHECK (affiliate_id_digits BETWEEN 4 AND 10),
  affiliate_id_sequence BIGINT NOT NULL DEFAULT 0,
  cookie_duration_days INTEGER NOT NULL DEFAULT 30 CHECK (cookie_duration_days BETWEEN 1 AND 365),
  return_period_days INTEGER NOT NULL DEFAULT 7 CHECK (return_period_days BETWEEN 0 AND 90),
  min_withdrawal_paisa BIGINT NOT NULL DEFAULT 10000 CHECK (min_withdrawal_paisa >= 100),
  payout_processing_days_min INTEGER NOT NULL DEFAULT 5,
  payout_processing_days_max INTEGER NOT NULL DEFAULT 7,
  default_commission_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00 CHECK (default_commission_rate_pct >= 0 AND default_commission_rate_pct <= 50),
  terms_version TEXT NOT NULL DEFAULT 'v1.0',
  privacy_version TEXT NOT NULL DEFAULT 'v1.0',
  kyc_consent_version TEXT NOT NULL DEFAULT 'v1.0',
  official_domain TEXT NOT NULL DEFAULT 'https://teqqnoworld.com',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.affiliate_program_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_affiliate_program_settings_updated_at ON public.affiliate_program_settings;
CREATE TRIGGER trg_affiliate_program_settings_updated_at
  BEFORE UPDATE ON public.affiliate_program_settings
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_set_updated_at();

-- ==============================================================================
-- 2. AFFILIATE APPLICATIONS & EMAIL OTP VERIFICATION
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id TEXT,
  customer_email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  company_name TEXT,
  date_of_birth DATE,
  is_adult_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  qualifying_order_id TEXT,
  qualifying_delivered_at TIMESTAMPTZ,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  terms_version TEXT NOT NULL DEFAULT 'v1.0',
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_version TEXT NOT NULL DEFAULT 'v1.0',
  privacy_accepted_at TIMESTAMPTZ,
  kyc_consent_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_consent_version TEXT NOT NULL DEFAULT 'v1.0',
  kyc_consent_accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (
    status IN (
      'draft',
      'email_verification_pending',
      'submitted',
      'under_review',
      'kyc_pending',
      'kyc_under_review',
      'approved',
      'rejected'
    )
  ),
  rejection_reason TEXT,
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  reapply_count INTEGER NOT NULL DEFAULT 0,
  previous_application_id UUID REFERENCES public.affiliate_applications(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_applications_email ON public.affiliate_applications (LOWER(customer_email));
CREATE INDEX IF NOT EXISTS idx_affiliate_applications_status ON public.affiliate_applications (status, created_at DESC);

DROP TRIGGER IF EXISTS trg_affiliate_applications_updated_at ON public.affiliate_applications;
CREATE TRIGGER trg_affiliate_applications_updated_at
  BEFORE UPDATE ON public.affiliate_applications
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_set_updated_at();

-- ==============================================================================
-- 3. AFFILIATE PARTNERS (ACTIVE / SUSPENDED / CLOSED)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID REFERENCES public.affiliate_applications(id) ON DELETE SET NULL,
  affiliate_id TEXT NOT NULL UNIQUE,
  referral_token TEXT NOT NULL UNIQUE,
  customer_user_id TEXT,
  customer_email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  company_name TEXT,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  suspension_reason TEXT,
  suspended_at TIMESTAMPTZ,
  suspended_by TEXT,
  closed_at TIMESTAMPTZ,
  closed_reason TEXT,
  certificate_number TEXT UNIQUE,
  verification_code TEXT UNIQUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_partners_status ON public.affiliate_partners (status);
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_email ON public.affiliate_partners (LOWER(customer_email));
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_token ON public.affiliate_partners (referral_token);
CREATE INDEX IF NOT EXISTS idx_affiliate_partners_verify_code ON public.affiliate_partners (verification_code);

DROP TRIGGER IF EXISTS trg_affiliate_partners_updated_at ON public.affiliate_partners;
CREATE TRIGGER trg_affiliate_partners_updated_at
  BEFORE UPDATE ON public.affiliate_partners
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_set_updated_at();

-- ==============================================================================
-- 4. AFFILIATE KYC & BANK VERIFICATION RECORDS (SENSITIVE FIELDS ENCRYPTED)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_kyc_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.affiliate_applications(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
  customer_email TEXT NOT NULL,
  aadhaar_masked TEXT NOT NULL,
  aadhaar_encrypted TEXT NOT NULL,
  pan_masked TEXT NOT NULL,
  pan_encrypted TEXT NOT NULL,
  bank_account_holder_name TEXT NOT NULL,
  bank_account_masked TEXT NOT NULL,
  bank_account_encrypted TEXT NOT NULL,
  bank_ifsc_code TEXT NOT NULL,
  bank_name TEXT,
  aadhaar_doc_url TEXT,
  pan_doc_url TEXT,
  bank_proof_doc_url TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'under_review', 'verified', 'rejected')),
  kyc_rejection_reason TEXT,
  kyc_verified_at TIMESTAMPTZ,
  kyc_verified_by TEXT,
  bank_verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (bank_verification_status IN ('pending', 'under_review', 'verified', 'rejected')),
  bank_verification_method TEXT CHECK (bank_verification_method IN ('penny_drop', 'manual_document', 'both')),
  penny_drop_reference TEXT,
  penny_drop_status TEXT,
  bank_rejection_reason TEXT,
  bank_verified_at TIMESTAMPTZ,
  bank_verified_by TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_kyc_application ON public.affiliate_kyc_records (application_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_kyc_status ON public.affiliate_kyc_records (kyc_status, bank_verification_status);

DROP TRIGGER IF EXISTS trg_affiliate_kyc_records_updated_at ON public.affiliate_kyc_records;
CREATE TRIGGER trg_affiliate_kyc_records_updated_at
  BEFORE UPDATE ON public.affiliate_kyc_records
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_set_updated_at();

-- ==============================================================================
-- 5. PRODUCT COMMISSION SETTINGS (DISABLED BY DEFAULT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_product_settings (
  product_id TEXT PRIMARY KEY,
  product_slug TEXT NOT NULL,
  product_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  commission_rate_pct NUMERIC(5,2) NOT NULL DEFAULT 5.00 CHECK (commission_rate_pct >= 0 AND commission_rate_pct <= 50),
  campaign_rate_pct NUMERIC(5,2) CHECK (campaign_rate_pct IS NULL OR (campaign_rate_pct >= 0 AND campaign_rate_pct <= 50)),
  campaign_label TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  updated_by TEXT,
  history JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_product_settings_enabled ON public.affiliate_product_settings (enabled);

DROP TRIGGER IF EXISTS trg_affiliate_product_settings_updated_at ON public.affiliate_product_settings;
CREATE TRIGGER trg_affiliate_product_settings_updated_at
  BEFORE UPDATE ON public.affiliate_product_settings
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_set_updated_at();

-- ==============================================================================
-- 6. AFFILIATE LINKS, CLICKS & LAST-CLICK ATTRIBUTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN ('website', 'product')),
  product_id TEXT,
  product_slug TEXT,
  product_name TEXT,
  referral_token TEXT NOT NULL,
  campaign_tag TEXT,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled', 'expired')),
  clicks_count BIGINT NOT NULL DEFAULT 0,
  orders_count BIGINT NOT NULL DEFAULT 0,
  commission_earned_paisa BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_links_partner ON public.affiliate_links (partner_id, link_type);
CREATE INDEX IF NOT EXISTS idx_affiliate_links_product ON public.affiliate_links (partner_id, product_id);

DROP TRIGGER IF EXISTS trg_affiliate_links_updated_at ON public.affiliate_links;
CREATE TRIGGER trg_affiliate_links_updated_at
  BEFORE UPDATE ON public.affiliate_links
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_set_updated_at();

CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL,
  link_id UUID REFERENCES public.affiliate_links(id) ON DELETE SET NULL,
  referral_token TEXT NOT NULL,
  landing_path TEXT NOT NULL,
  product_id TEXT,
  product_slug TEXT,
  device_type TEXT NOT NULL DEFAULT 'desktop',
  browser TEXT NOT NULL DEFAULT 'unknown',
  traffic_source TEXT NOT NULL DEFAULT 'direct',
  campaign TEXT,
  visitor_hash TEXT,
  is_suspicious BOOLEAN NOT NULL DEFAULT FALSE,
  suspicious_reason TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_partner_time ON public.affiliate_clicks (partner_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_token ON public.affiliate_clicks (referral_token, clicked_at DESC);

CREATE TABLE IF NOT EXISTS public.affiliate_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attribution_cookie_id TEXT NOT NULL UNIQUE,
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL,
  referral_token TEXT NOT NULL,
  last_click_id UUID REFERENCES public.affiliate_clicks(id) ON DELETE SET NULL,
  customer_user_id TEXT,
  customer_email TEXT,
  landing_path TEXT,
  product_id TEXT,
  campaign TEXT,
  attributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_attributions_customer ON public.affiliate_attributions (LOWER(customer_email), expires_at DESC);

-- ==============================================================================
-- 7. ORDER-ITEM COMMISSIONS (WITH IMMUTABLE CALCULATION SNAPSHOT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  order_number_masked TEXT NOT NULL,
  order_item_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  refunded_quantity INTEGER NOT NULL DEFAULT 0 CHECK (refunded_quantity >= 0),
  gross_item_amount_paisa BIGINT NOT NULL DEFAULT 0,
  discount_amount_paisa BIGINT NOT NULL DEFAULT 0,
  gst_inclusive_eligible_paisa BIGINT NOT NULL DEFAULT 0,
  shipping_excluded_paisa BIGINT NOT NULL DEFAULT 0,
  commission_rate_pct_snapshot NUMERIC(5,2) NOT NULL,
  commission_rate_source TEXT NOT NULL DEFAULT 'product_standard',
  commission_amount_paisa BIGINT NOT NULL DEFAULT 0,
  original_commission_paisa BIGINT NOT NULL DEFAULT 0,
  order_status TEXT NOT NULL DEFAULT 'placed',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'on_hold', 'available', 'cancelled', 'paid', 'adjusted', 'under_review')
  ),
  status_reason TEXT,
  delivered_at TIMESTAMPTZ,
  return_period_days_snapshot INTEGER NOT NULL DEFAULT 7,
  return_period_ends_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  fraud_flag_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_partner_status ON public.affiliate_commissions (partner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_order ON public.affiliate_commissions (order_id);

DROP TRIGGER IF EXISTS trg_affiliate_commissions_updated_at ON public.affiliate_commissions;
CREATE TRIGGER trg_affiliate_commissions_updated_at
  BEFORE UPDATE ON public.affiliate_commissions
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_set_updated_at();

-- ==============================================================================
-- 8. SEPARATE AFFILIATE WALLET & IMMUTABLE FINANCIAL LEDGER
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_wallets (
  partner_id UUID PRIMARY KEY REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL UNIQUE,
  pending_paisa BIGINT NOT NULL DEFAULT 0 CHECK (pending_paisa >= 0),
  available_paisa BIGINT NOT NULL DEFAULT 0 CHECK (available_paisa >= 0),
  processing_paisa BIGINT NOT NULL DEFAULT 0 CHECK (processing_paisa >= 0),
  total_withdrawn_paisa BIGINT NOT NULL DEFAULT 0 CHECK (total_withdrawn_paisa >= 0),
  lifetime_earned_paisa BIGINT NOT NULL DEFAULT 0 CHECK (lifetime_earned_paisa >= 0),
  funds_held BOOLEAN NOT NULL DEFAULT FALSE,
  hold_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_affiliate_wallets_updated_at ON public.affiliate_wallets;
CREATE TRIGGER trg_affiliate_wallets_updated_at
  BEFORE UPDATE ON public.affiliate_wallets
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_set_updated_at();

CREATE TABLE IF NOT EXISTS public.affiliate_wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (
    entry_type IN (
      'commission_pending',
      'commission_available',
      'commission_cancelled',
      'commission_refund_adjustment',
      'commission_hold',
      'commission_unhold',
      'withdrawal_requested',
      'withdrawal_paid',
      'withdrawal_rejected_restore',
      'reward_bonus_credit',
      'admin_adjustment'
    )
  ),
  amount_paisa BIGINT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('pending', 'available', 'processing', 'withdrawn')),
  balance_after_paisa BIGINT NOT NULL,
  reference_type TEXT,
  reference_id TEXT,
  description TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_ledger_partner_time ON public.affiliate_wallet_transactions (partner_id, created_at DESC);

-- Prevent UPDATE or DELETE on immutable financial ledger
CREATE OR REPLACE FUNCTION public.affiliate_prevent_ledger_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'affiliate_wallet_transactions is append-only and immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_affiliate_ledger_no_update ON public.affiliate_wallet_transactions;
CREATE TRIGGER trg_affiliate_ledger_no_update
  BEFORE UPDATE OR DELETE ON public.affiliate_wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_prevent_ledger_mutation();

-- ==============================================================================
-- 9. MANUAL WITHDRAWALS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  request_code TEXT NOT NULL UNIQUE,
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL,
  amount_paisa BIGINT NOT NULL CHECK (amount_paisa >= 10000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'rejected')),
  bank_holder_snapshot TEXT NOT NULL,
  bank_account_masked_snapshot TEXT NOT NULL,
  bank_ifsc_snapshot TEXT NOT NULL,
  transfer_reference TEXT,
  rejection_reason TEXT,
  admin_notes TEXT,
  processed_by TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_partner ON public.affiliate_withdrawals (partner_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_withdrawals_status ON public.affiliate_withdrawals (status, requested_at DESC);

DROP TRIGGER IF EXISTS trg_affiliate_withdrawals_updated_at ON public.affiliate_withdrawals;
CREATE TRIGGER trg_affiliate_withdrawals_updated_at
  BEFORE UPDATE ON public.affiliate_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.affiliate_set_updated_at();

-- ==============================================================================
-- 10. MONTHLY TARGETS, REWARDS & LEADERBOARDS (NO MEMBERSHIP TIERS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_sales_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key TEXT NOT NULL, -- YYYY-MM
  title TEXT NOT NULL,
  description TEXT,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('delivered_orders', 'delivered_sales_paisa')),
  target_value BIGINT NOT NULL CHECK (target_value > 0),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('cash_bonus', 'gift', 'product', 'voucher', 'custom')),
  reward_title TEXT NOT NULL,
  reward_value_paisa BIGINT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_targets_month ON public.affiliate_sales_targets (month_key, active);

CREATE TABLE IF NOT EXISTS public.affiliate_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('monthly_target', 'leaderboard_rank', 'admin_manual')),
  source_ref_id TEXT,
  period_label TEXT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('cash_bonus', 'gift', 'product', 'voucher', 'custom')),
  reward_title TEXT NOT NULL,
  reward_value_paisa BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'credited', 'dispatched', 'cancelled')),
  notes TEXT,
  awarded_by TEXT,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_rewards_partner ON public.affiliate_rewards (partner_id, awarded_at DESC);

CREATE TABLE IF NOT EXISTS public.affiliate_leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'yearly', 'all_time')),
  period_key TEXT NOT NULL,
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL,
  partner_display_name TEXT NOT NULL,
  rank_position INTEGER NOT NULL,
  qualified_orders_count INTEGER NOT NULL DEFAULT 0,
  qualified_sales_paisa BIGINT NOT NULL DEFAULT 0,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 11. CERTIFICATES, DIGITAL ID CARDS, NOTIFICATIONS, SUPPORT, FRAUD & AUDIT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.affiliate_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL UNIQUE REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL UNIQUE,
  certificate_number TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_id_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL UNIQUE REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL UNIQUE,
  card_number TEXT NOT NULL UNIQUE,
  verification_code TEXT NOT NULL UNIQUE,
  photo_url TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT UNIQUE,
  partner_id UUID REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT,
  recipient_email TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_notifications_partner ON public.affiliate_notifications (partner_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.affiliate_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.affiliate_support_tickets(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('affiliate', 'admin')),
  sender_name TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES public.affiliate_partners(id) ON DELETE SET NULL,
  affiliate_id TEXT,
  flag_type TEXT NOT NULL CHECK (
    flag_type IN (
      'self_referral',
      'suspicious_click_burst',
      'repeated_refund_pattern',
      'duplicate_kyc',
      'policy_violation',
      'manual_review'
    )
  ),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  order_id TEXT,
  commission_id UUID REFERENCES public.affiliate_commissions(id) ON DELETE SET NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'cleared', 'confirmed_fraud')),
  resolution_notes TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_reactivation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_account_closure_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.affiliate_partners(id) ON DELETE CASCADE,
  affiliate_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  settlement_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_role TEXT NOT NULL CHECK (actor_role IN ('admin', 'system', 'affiliate')),
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_audit_logs_time ON public.affiliate_audit_logs (created_at DESC);

-- ==============================================================================
-- 12. STORAGE BUCKETS (PRIVATE KYC DOCS & PUBLIC AVATARS)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'affiliate-kyc-docs',
    'affiliate-kyc-docs',
    FALSE,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
  ),
  (
    'affiliate-avatars',
    'affiliate-avatars',
    TRUE,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 13. ROW LEVEL SECURITY (STRICT LEAST-PRIVILEGE POLICIES)
-- Note: Server-side backend routes use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS
-- after validating admin Bearer sessions or authenticated affiliate ownership.
-- Public anon key cannot read sensitive KYC, wallet, or admin tables directly.
-- ==============================================================================
ALTER TABLE public.affiliate_program_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_kyc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_product_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_sales_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_id_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_reactivation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_account_closure_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_audit_logs ENABLE ROW LEVEL SECURITY;

-- Public read-only access ONLY to non-sensitive program settings & active announcements
DROP POLICY IF EXISTS "affiliate_settings_public_read" ON public.affiliate_program_settings;
CREATE POLICY "affiliate_settings_public_read"
  ON public.affiliate_program_settings
  FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "affiliate_announcements_public_read" ON public.affiliate_announcements;
CREATE POLICY "affiliate_announcements_public_read"
  ON public.affiliate_announcements
  FOR SELECT
  USING (active = TRUE);

-- Authenticated user self-read policies (strictly matching auth.jwt() email)
DROP POLICY IF EXISTS "affiliate_applications_owner_select" ON public.affiliate_applications;
CREATE POLICY "affiliate_applications_owner_select"
  ON public.affiliate_applications
  FOR SELECT
  TO authenticated
  USING (LOWER(customer_email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')));

DROP POLICY IF EXISTS "affiliate_partners_owner_select" ON public.affiliate_partners;
CREATE POLICY "affiliate_partners_owner_select"
  ON public.affiliate_partners
  FOR SELECT
  TO authenticated
  USING (LOWER(customer_email) = LOWER(COALESCE(auth.jwt() ->> 'email', '')));

-- Strict deny for client-side direct access to sensitive KYC records (server service-role only)
DROP POLICY IF EXISTS "affiliate_kyc_deny_client" ON public.affiliate_kyc_records;
CREATE POLICY "affiliate_kyc_deny_client"
  ON public.affiliate_kyc_records
  FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

-- ==============================================================================
-- 14. POST-MIGRATION VERIFICATION QUERIES (RUN MANUALLY AFTER EXECUTING)
-- ==============================================================================
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'affiliate_%'
-- ORDER BY table_name;
--
-- SELECT * FROM public.affiliate_program_settings;
--
-- ==============================================================================
-- 15. SAFE ROLLBACK GUIDANCE (ONLY IF YOU EXPLICITLY WISH TO REMOVE AFFILIATE MODULE)
-- ==============================================================================
-- Because all tables are strictly prefixed with affiliate_* and do not alter
-- existing TeqqnoWorld tables, rollback is isolated to those affiliate_* tables
-- and storage buckets 'affiliate-kyc-docs' / 'affiliate-avatars' only.
-- Never run DROP statements on production data without first exporting backups.
-- ==============================================================================
