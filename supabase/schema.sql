-- ==============================================================================
-- SUPABASE DATABASE & STORAGE SCHEMA
-- Custom Merchandise & Corporate Branding E-Commerce Web Application
-- ==============================================================================

-- 1. Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLE: products
-- Stores merchandise catalog: T-shirts, Polo shirts, Hoodies, Caps, Gifts, etc.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY, -- Supports text IDs like 'prod-polo-01' or UUIDs
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
    moq INTEGER NOT NULL DEFAULT 1 CHECK (moq >= 1),
    image_url TEXT,
    available_colors JSONB DEFAULT '[]'::jsonb, -- Array of color objects or color names
    available_sizes JSONB DEFAULT '[]'::jsonb,  -- Array of sizes e.g. ["S", "M", "L", "XL", "2XL"]
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Index for category search & fast sorting
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- ==============================================================================
-- 3. TABLE: custom_orders (also known as quotes)
-- Captures Request a Quote submissions with customer contact, order specs & logo URL
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.custom_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    company TEXT,
    phone TEXT NOT NULL,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 1),
    logo_url TEXT,
    custom_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in-production', 'delivered')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Indexes for querying quotes by status and customer email
CREATE INDEX IF NOT EXISTS idx_custom_orders_status ON public.custom_orders(status);
CREATE INDEX IF NOT EXISTS idx_custom_orders_email ON public.custom_orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_custom_orders_created_at ON public.custom_orders(created_at DESC);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on public.products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Public can view all active products" ON public.products;
DROP POLICY IF EXISTS "Admins have full access to products" ON public.products;

-- Allow public read access for all visitors to view products in the catalog
CREATE POLICY "Public can view all active products"
    ON public.products
    FOR SELECT
    USING (true);

-- Allow authenticated admins full access to insert, update, or delete products
CREATE POLICY "Admins have full access to products"
    ON public.products
    FOR ALL
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');


-- Enable RLS on public.custom_orders
ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Anyone can submit a custom order quote" ON public.custom_orders;
DROP POLICY IF EXISTS "Admins can view all custom order quotes" ON public.custom_orders;
DROP POLICY IF EXISTS "Admins can update custom order quote status" ON public.custom_orders;

-- Allow public (anonymous and authenticated) visitors to insert quotes/orders
CREATE POLICY "Anyone can submit a custom order quote"
    ON public.custom_orders
    FOR INSERT
    TO public
    WITH CHECK (true);

-- Allow authenticated admin users only to read custom orders
CREATE POLICY "Admins can view all custom order quotes"
    ON public.custom_orders
    FOR SELECT
    TO authenticated
    USING (auth.role() = 'authenticated');

-- Allow authenticated admin users only to update custom orders (e.g. status)
CREATE POLICY "Admins can update custom order quote status"
    ON public.custom_orders
    FOR UPDATE
    TO authenticated
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- ==============================================================================
-- 5. SUPABASE STORAGE BUCKET: brand-logos
-- Stores customer logos uploaded via "Request a Quote" or "See Your Logo" tool
-- ==============================================================================

-- Insert bucket if not already present
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'brand-logos',
    'brand-logos',
    true,
    15728640, -- 15MB file size limit
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 15728640,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'application/pdf'];

-- Storage RLS Policies for brand-logos bucket
DROP POLICY IF EXISTS "Public can view brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can upload brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage brand logos" ON storage.objects;

-- Allow anyone to view / download uploaded customer logos
CREATE POLICY "Public can view brand logos"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'brand-logos');

-- Allow anyone to upload their brand logo during quote request
CREATE POLICY "Public can upload brand logos"
    ON storage.objects
    FOR INSERT
    TO public
    WITH CHECK (bucket_id = 'brand-logos');

-- Allow authenticated admins to delete / update logo files
CREATE POLICY "Admins can manage brand logos"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (bucket_id = 'brand-logos' AND auth.role() = 'authenticated')
    WITH CHECK (bucket_id = 'brand-logos' AND auth.role() = 'authenticated');

-- ==============================================================================
-- 6. SEED DATA (POPULATE DEFAULT MERCHANDISE CATALOG)
-- ==============================================================================

INSERT INTO public.products (id, name, category, base_price, moq, image_url, available_colors, available_sizes, description)
VALUES
(
    'prod-polo-01',
    'Customized 100% Cotton Pique Polo T-Shirt (260 GSM)',
    'apparel',
    670.00,
    2,
    '/assets/products/prod_tipping_polo.webp',
    '[
        {"name": "Royal Blue", "hex": "#1B3F8B"},
        {"name": "Navy Blue", "hex": "#16233B"},
        {"name": "Onyx Black", "hex": "#1A1A1A"},
        {"name": "White", "hex": "#FFFFFF"},
        {"name": "Burgundy Maroon", "hex": "#5B1D28"}
    ]'::jsonb,
    '["S", "M", "L", "XL", "2XL", "3XL"]'::jsonb,
    'Heavyweight 260 GSM cotton pique knit with double-needle collar tipping and moisture-wicking weave.'
),
(
    'prod-plain-polo',
    'Classic Matty Plain Polo T-Shirt (240 GSM)',
    'apparel',
    450.00,
    2,
    '/assets/joab/navy-blue-front.webp',
    '[
        {"name": "Navy Blue", "hex": "#1B2A4A"},
        {"name": "Black", "hex": "#1F2024"},
        {"name": "Forest Green", "hex": "#1C3829"},
        {"name": "Charcoal Grey", "hex": "#3A3D40"},
        {"name": "Pure White", "hex": "#F4F5F7"}
    ]'::jsonb,
    '["S", "M", "L", "XL", "2XL", "3XL"]'::jsonb,
    'Durable 240 GSM Matty pique polo suitable for corporate uniforms, outdoor events, and employee kits.'
),
(
    'prod-hoodie-01',
    'Custom Heavy Fleece Pullover Hoodie (340 GSM)',
    'hoodies',
    999.00,
    2,
    '/assets/products/prod_hoodie.webp',
    '[
        {"name": "Jet Black", "hex": "#18191E"},
        {"name": "Navy Blue", "hex": "#16233B"},
        {"name": "Heather Grey", "hex": "#43484F"},
        {"name": "Crimson Red", "hex": "#C61B2B"}
    ]'::jsonb,
    '["M", "L", "XL", "2XL"]'::jsonb,
    '340 GSM warm brushed fleece pullover hoodie with double-stitched kangaroo pocket and brass drawstring eyelets.'
),
(
    'prod-cotton-flexi-caps',
    'Cotton Flexi Embroidered Baseball Caps',
    'caps',
    135.00,
    5,
    '/assets/caps/navy-blue.webp',
    '[
        {"name": "Navy Blue", "hex": "#1B2A4A"},
        {"name": "Onyx Black", "hex": "#1A1A1A"},
        {"name": "Vibrant Red", "hex": "#C61B2B"},
        {"name": "Pure White", "hex": "#FFFFFF"},
        {"name": "Golden Yellow", "hex": "#F5A623"}
    ]'::jsonb,
    '["Free Size (Adjustable Buckle)"]'::jsonb,
    '100% Cotton twill 6-panel structured cap with pre-curved peak, absorbent sweatband and metal buckle closure.'
),
(
    'prod-ceramic-mug',
    'Sublimation Glossy Ceramic Mug (325 ml)',
    'drinkware',
    149.00,
    5,
    '/assets/aistudio/Blank_White_Ceramic_Mug_b82bfadb.webp',
    '[
        {"name": "Pure White Ceramic", "hex": "#FFFFFF"}
    ]'::jsonb,
    '["325 ml (11 oz)"]'::jsonb,
    'Grade-A pure white ceramic mug with high-gloss heat-transfer coating. Microwave and dishwasher safe.'
),
(
    'prod-visiting-card-300gsm',
    'Premium Corporate Visiting Cards (300 GSM)',
    'visiting-cards',
    1.00,
    100,
    '/assets/visiting-card/cover.webp',
    '[
        {"name": "300 GSM Art Card (White)", "hex": "#FFFFFF"}
    ]'::jsonb,
    '["92 mm x 52 mm (Standard)"]'::jsonb,
    'High-resolution digital offset print on 300 GSM imported art paper with thermal matte or velvet lamination.'
),
(
    'prod-gift-set-01',
    'Executive Corporate Welcome Hamper (4-in-1)',
    'gift-sets',
    1250.00,
    5,
    '/assets/products/prod_gift_set.webp',
    '[
        {"name": "Midnight Matte Black", "hex": "#1D1E24"},
        {"name": "Executive Royal Navy", "hex": "#1B3F8B"}
    ]'::jsonb,
    '["Custom Gift Box (Standard)"]'::jsonb,
    'Includes thermal temperature flask (500ml), A5 leatherette journal, metal roller pen, and keychain in a foam-cushioned gift box.'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    base_price = EXCLUDED.base_price,
    moq = EXCLUDED.moq,
    image_url = EXCLUDED.image_url,
    available_colors = EXCLUDED.available_colors,
    available_sizes = EXCLUDED.available_sizes,
    description = EXCLUDED.description;

-- ==============================================================================
-- 7. PRODUCT REVIEW & RATING SYSTEM TABLES
-- Independent per-product reviews with duplicate prevention per (product, customer),
-- separate rating categories, media storage, helpful votes, reports & moderation.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_email_normalized TEXT GENERATED ALWAYS AS (LOWER(TRIM(customer_email))) STORED,
    company_name TEXT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    rating_product_quality INTEGER NOT NULL DEFAULT 5 CHECK (rating_product_quality >= 1 AND rating_product_quality <= 5),
    rating_print_quality INTEGER NOT NULL DEFAULT 5 CHECK (rating_print_quality >= 1 AND rating_print_quality <= 5),
    rating_packaging INTEGER NOT NULL DEFAULT 5 CHECK (rating_packaging >= 1 AND rating_packaging <= 5),
    rating_value_for_money INTEGER NOT NULL DEFAULT 5 CHECK (rating_value_for_money >= 1 AND rating_value_for_money <= 5),
    rating_overall_experience INTEGER NOT NULL DEFAULT 5 CHECK (rating_overall_experience >= 1 AND rating_overall_experience <= 5),
    title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 140),
    comment TEXT NOT NULL CHECK (char_length(comment) >= 10 AND char_length(comment) <= 2500),
    photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    videos JSONB NOT NULL DEFAULT '[]'::jsonb,
    variant_summary TEXT,
    would_recommend BOOLEAN NOT NULL DEFAULT true,
    verified_purchase BOOLEAN NOT NULL DEFAULT false,
    order_number TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'hidden')),
    helpful_count INTEGER NOT NULL DEFAULT 0 CHECK (helpful_count >= 0),
    is_featured BOOLEAN NOT NULL DEFAULT false,
    report_count INTEGER NOT NULL DEFAULT 0 CHECK (report_count >= 0),
    admin_reply TEXT,
    admin_replied_at TIMESTAMPTZ,
    moderation_note TEXT,
    moderation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Enforce one review per customer per product (customers can review multiple different products freely)
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_reviews_product_customer
    ON public.product_reviews(product_id, customer_email_normalized);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_status
    ON public.product_reviews(product_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_email
    ON public.product_reviews(customer_email_normalized, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_reviews_status_created
    ON public.product_reviews(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.review_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    media_url TEXT NOT NULL,
    mime_type TEXT,
    file_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_review_media_review_id ON public.review_media(review_id);

CREATE TABLE IF NOT EXISTS public.review_helpful_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
    voter_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE (review_id, voter_key)
);

CREATE TABLE IF NOT EXISTS public.review_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
    voter_key TEXT NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'off_topic', 'misleading')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    UNIQUE (review_id, voter_key)
);

CREATE TABLE IF NOT EXISTS public.review_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    moderation_mode TEXT NOT NULL DEFAULT 'auto_verified' CHECK (moderation_mode IN ('auto_verified', 'auto_all', 'manual_all')),
    allow_guest_reviews BOOLEAN NOT NULL DEFAULT true,
    allow_customer_edits BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

INSERT INTO public.review_settings (id, moderation_mode, allow_guest_reviews, allow_customer_edits)
VALUES ('default', 'auto_verified', true, true)
ON CONFLICT (id) DO NOTHING;

-- Storage bucket for customer review photos & short videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'review-media',
    'review-media',
    true,
    26214400, -- 25MB max for short review videos
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];

-- RLS Policies for review tables
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_helpful_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read approved product reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Customers can read own product reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Admins manage all product reviews" ON public.product_reviews;
DROP POLICY IF EXISTS "Public can read approved review media" ON public.review_media;
DROP POLICY IF EXISTS "Admins manage all review media" ON public.review_media;

-- Public visitors can read only approved/published reviews
CREATE POLICY "Public can read approved product reviews"
    ON public.product_reviews
    FOR SELECT
    TO public
    USING (status = 'approved');

-- Signed-in customers can view their own pending/rejected/hidden reviews
CREATE POLICY "Customers can read own product reviews"
    ON public.product_reviews
    FOR SELECT
    TO authenticated
    USING (LOWER(TRIM(customer_email)) = LOWER(TRIM(auth.jwt() ->> 'email')));

-- Server service-role / admin manages moderation & updates (customers cannot self-approve or alter verified_purchase)
CREATE POLICY "Admins manage all product reviews"
    ON public.product_reviews
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Public can read approved review media"
    ON public.review_media
    FOR SELECT
    TO public
    USING (
        EXISTS (
            SELECT 1 FROM public.product_reviews pr
            WHERE pr.id = review_media.review_id AND pr.status = 'approved'
        )
    );

CREATE POLICY "Admins manage all review media"
    ON public.review_media
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);


