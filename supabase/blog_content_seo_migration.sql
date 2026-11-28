-- ==============================================================================
-- TEQQNOWORLD PHASE 6 — CONTENT SEO, BLOG CMS & SLUG REDIRECTS MIGRATION
-- Target Database: Supabase PostgreSQL (Existing TeqqnoWorld Project)
--
-- SAFETY & COMPATIBILITY GUARANTEES:
-- 1. Strictly ADDITIVE and IDEMPOTENT (safe to re-run without data loss).
-- 2. Does NOT alter, drop, or touch existing products, orders, coupons,
--    affiliates, reviews, or customer tables.
-- 3. Enables Row Level Security (RLS) on all new tables:
--    - Public (anon / authenticated) can SELECT ONLY published articles whose
--      published_at is NULL or <= now() (NEVER drafts or future scheduled posts).
--    - Public can SELECT blog_categories and blog_slug_redirects (needed for 301).
--    - ALL INSERT / UPDATE / DELETE and draft/scheduled SELECT operations are
--      restricted exclusively to service_role (validated by Admin Session API).
-- 4. Trigger function hardened with SET search_path = pg_catalog, public, pg_temp.
-- 5. DO NOT execute automatically — run manually in Supabase SQL Editor after review.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDENED UPDATED_AT TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.teqqno_set_blog_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. BLOG CATEGORIES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_categories (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_categories_slug_format_chk CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS idx_blog_categories_sort
  ON public.blog_categories (sort_order ASC, name ASC);

DROP TRIGGER IF EXISTS trg_blog_categories_updated_at ON public.blog_categories;
CREATE TRIGGER trg_blog_categories_updated_at
  BEFORE UPDATE ON public.blog_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.teqqno_set_blog_updated_at();

-- ------------------------------------------------------------------------------
-- 3. BLOG POSTS TABLE (STRICT DRAFT DEFAULT — NEVER AUTO-PUBLISHED)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id text PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  content_kind text NOT NULL DEFAULT 'article'
    CHECK (content_kind IN ('article', 'guide', 'resource')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'scheduled')),
  featured boolean NOT NULL DEFAULT false,
  category_slug text NOT NULL REFERENCES public.blog_categories (slug) ON UPDATE CASCADE ON DELETE RESTRICT,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  featured_image_url text NOT NULL DEFAULT '',
  featured_image_alt text NOT NULL DEFAULT '',
  featured_image_width integer NOT NULL DEFAULT 1200 CHECK (featured_image_width > 0),
  featured_image_height integer NOT NULL DEFAULT 675 CHECK (featured_image_height > 0),
  author_name text NOT NULL DEFAULT 'TeqqnoWorld Editorial Desk',
  author_role text NOT NULL DEFAULT 'Custom Printing & Merchandising Team',
  reading_time_minutes integer NOT NULL DEFAULT 3 CHECK (reading_time_minutes >= 1),
  seo_title text NOT NULL DEFAULT '',
  meta_description text NOT NULL DEFAULT '',
  canonical_url text NOT NULL DEFAULT '',
  focus_keyword text NOT NULL DEFAULT '',
  secondary_keywords text[] NOT NULL DEFAULT '{}'::text[],
  topic_cluster text NOT NULL DEFAULT '',
  related_category_slug text NOT NULL DEFAULT '',
  related_product_ids text[] NOT NULL DEFAULT '{}'::text[],
  related_article_slugs text[] NOT NULL DEFAULT '{}'::text[],
  faqs jsonb NOT NULL DEFAULT '[]'::jsonb,
  published_at timestamptz NULL,
  scheduled_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'admin',
  CONSTRAINT blog_posts_slug_format_chk CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT blog_posts_faqs_is_array_chk CHECK (jsonb_typeof(faqs) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published_at
  ON public.blog_posts (status, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_blog_posts_category_status
  ON public.blog_posts (category_slug, status);

CREATE INDEX IF NOT EXISTS idx_blog_posts_featured_status
  ON public.blog_posts (featured, status)
  WHERE featured = true;

CREATE INDEX IF NOT EXISTS idx_blog_posts_related_products_gin
  ON public.blog_posts USING gin (related_product_ids);

DROP TRIGGER IF EXISTS trg_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.teqqno_set_blog_updated_at();

-- ------------------------------------------------------------------------------
-- 4. SLUG CHANGE 301 REDIRECT HISTORY TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.blog_slug_redirects (
  old_slug text PRIMARY KEY,
  new_slug text NOT NULL,
  post_id text NOT NULL REFERENCES public.blog_posts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_slug_redirects_distinct_chk CHECK (old_slug <> new_slug),
  CONSTRAINT blog_slug_redirects_old_slug_fmt_chk CHECK (old_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT blog_slug_redirects_new_slug_fmt_chk CHECK (new_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE INDEX IF NOT EXISTS idx_blog_slug_redirects_post_id
  ON public.blog_slug_redirects (post_id);

-- ------------------------------------------------------------------------------
-- 5. STRICT ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_slug_redirects ENABLE ROW LEVEL SECURITY;

-- blog_categories: public read-only, service_role full management
DROP POLICY IF EXISTS blog_categories_public_read ON public.blog_categories;
CREATE POLICY blog_categories_public_read
  ON public.blog_categories
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS blog_categories_service_all ON public.blog_categories;
CREATE POLICY blog_categories_service_all
  ON public.blog_categories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- blog_posts: public can read ONLY published posts whose published_at <= now() (never drafts or future scheduled posts)
DROP POLICY IF EXISTS blog_posts_public_published_read ON public.blog_posts;
CREATE POLICY blog_posts_public_published_read
  ON public.blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND (published_at IS NULL OR published_at <= now())
  );

DROP POLICY IF EXISTS blog_posts_service_all ON public.blog_posts;
CREATE POLICY blog_posts_service_all
  ON public.blog_posts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- blog_slug_redirects: public read-only for 301 redirects, service_role full management
DROP POLICY IF EXISTS blog_slug_redirects_public_read ON public.blog_slug_redirects;
CREATE POLICY blog_slug_redirects_public_read
  ON public.blog_slug_redirects
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS blog_slug_redirects_service_all ON public.blog_slug_redirects;
CREATE POLICY blog_slug_redirects_service_all
  ON public.blog_slug_redirects
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. SAFE ADDITIVE EXTENSION OF PHASE 5 seo_analytics_events CHECK CONSTRAINT
--    (Only runs if public.seo_analytics_events already exists)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'seo_analytics_events'
  ) THEN
    ALTER TABLE public.seo_analytics_events
      DROP CONSTRAINT IF EXISTS seo_analytics_events_event_name_check;
    ALTER TABLE public.seo_analytics_events
      ADD CONSTRAINT seo_analytics_events_event_name_check
      CHECK (
        event_name IN (
          'page_view',
          'view_item',
          'view_item_list',
          'select_item',
          'add_to_cart',
          'begin_checkout',
          'purchase',
          'generate_lead',
          'form_submit',
          'whatsapp_enquiry',
          'quote_request',
          'blog_view',
          'blog_category_view',
          'blog_search',
          'related_product_click',
          'blog_cta_click',
          'blog_share'
        )
      );
  END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. SEED DEFAULT BLOG CATEGORIES ONLY (IDEMPOTENT — NO AUTO-PUBLISHED POSTS)
-- ------------------------------------------------------------------------------
INSERT INTO public.blog_categories (id, slug, name, description, sort_order)
VALUES
  (
    'cat-corporate-apparel',
    'corporate-apparel-polos',
    'Corporate Apparel & Polos',
    'Fabric comparisons, GSM guides, logo embroidery vs DTF printing tips, and uniform sizing guides for Indian corporate polo T-shirts and cotton caps.',
    1
  ),
  (
    'cat-event-displays',
    'event-exhibition-displays',
    'Event & Exhibition Displays',
    'Practical setup checklists, artwork sizing guides, and booth equipment comparisons for 3x6 ft rollup standees, promo tables, 5 ft umbrellas, and canopy kiosks.',
    2
  ),
  (
    'cat-gifting-print',
    'corporate-gifting-print',
    'Corporate Gifting & Business Print',
    'Onboarding kit planning, custom mug print preparation, and 300 GSM visiting card artwork bleed guides for Indian startups and B2B teams.',
    3
  ),
  (
    'cat-buying-guides',
    'buying-guides',
    'Buying Guides & Print Prep',
    'Step-by-step buyer guides covering artwork resolution, print methods, MOQ planning, bulk INR slab budgeting, and 18% GST invoicing for Indian businesses.',
    4
  )
ON CONFLICT (slug) DO NOTHING;
