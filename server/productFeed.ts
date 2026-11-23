import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import type { Express, Request, Response } from 'express';

// ==============================================================================
// TEQQNOWORLD DYNAMIC PRODUCT FEED ENGINE (CSV + JSONL)
// Aligned strictly with the Official OpenAI ChatGPT Product Feed Schema
// ==============================================================================

export type FeedAvailability =
  | 'in_stock'
  | 'out_of_stock'
  | 'pre_order'
  | 'backorder'
  | 'unknown';

export type FeedCondition = 'new' | 'refurbished' | 'used';

export interface ProductFeedItem {
  // Core 11 Required OpenAI ChatGPT Product Feed Schema Fields
  item_id: string;
  title: string;
  description: string;
  url: string;
  brand: string;
  seller_name: string;
  image_url: string;
  availability: FeedAvailability;
  price: string;
  target_countries: string[];
  store_country: string;

  // Official OpenAI Product Feed Optional / Control Fields
  additional_image_urls: string[];
  is_eligible_search: boolean;
  is_eligible_checkout: boolean;
  condition: FeedCondition;
  product_category: string;
  inventory_quantity: number;
  seller_url: string;
  seller_privacy_policy: string;
  seller_tos: string;
  return_policy: string;
  color?: string;
  size?: string;
  material?: string;
  review_count?: number;
  star_rating?: string;
}

interface RawCatalogProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  basePrice: number;
  description: string;
  shortDesc?: string;
  moq?: number;
  rating?: number;
  reviewCount?: number;
  sizes?: string[];
  colors?: Array<{
    name?: string;
    imageFront?: string;
    imageBack?: string;
    imageSide?: string;
    imageDimensions?: string;
  }>;
  specs?: Record<string, string>;
  productType?: string;
  isActive?: boolean;
  availability?: string;
  stockQuantity?: number;
  brand?: string;
  condition?: string;
}

interface SupabaseProductRow {
  id?: string;
  slug?: string;
  name?: string;
  title?: string;
  category?: string;
  base_price?: number | string;
  price?: number | string;
  moq?: number | string;
  image_url?: string | null;
  image_link?: string | null;
  additional_images?: string[] | string | null;
  additional_image_urls?: string[] | string | null;
  available_colors?: Array<{ name?: string; imageFront?: string; imageBack?: string }> | string[] | null;
  available_sizes?: string[] | null;
  description?: string | null;
  brand?: string | null;
  condition?: string | null;
  availability?: string | null;
  in_stock?: boolean | null;
  stock_quantity?: number | string | null;
  inventory_quantity?: number | string | null;
  is_active?: boolean | null;
  active?: boolean | null;
  status?: string | null;
  material?: string | null;
  rating?: number | string | null;
  review_count?: number | string | null;
}

export interface ProductFeedOptions {
  rootDir: string;
  getSupabaseConfig: () => { url: string; apiKey: string };
}

const DEFAULT_PUBLIC_SITE_URL = 'https://teqqnoworld.com';
const DEFAULT_BRAND = 'TeqqnoWorld';
// TeqqnoWorld operates from Hyderabad, India and ships pan-India (ISO 3166-1 alpha-2: IN)
const DEFAULT_STORE_COUNTRY = 'IN';
const DEFAULT_TARGET_COUNTRIES: ReadonlyArray<string> = ['IN'];
const DEFAULT_INVENTORY_QTY = 100;
const SUPABASE_FETCH_TIMEOUT_MS = 2500;

// Verified catalog showcase banners matching ProductCatalogView.tsx
const SHOWCASE_BANNER_BY_PRODUCT_ID: Record<string, string> = {
  'prod-ceramic-mug': '/assets/aistudio/ceramic_mug_banner_1672x941_dc952a76.webp',
  'prod-promo-table': '/assets/promo-table/promo-table-banner.webp',
  'prod-branding-umbrella': '/assets/aistudio/Custom_Printed_Branding_Umbrella_Banner_ddb8aff0.webp',
  'prod-canopy-kiosk': '/assets/aistudio/Promotional_Canopy_Kiosk_Feature_Graphic_58ea1c0d.webp',
  'prod-rollup-standee': '/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp',
  'prod-visiting-card-300gsm': '/assets/aistudio/Premium_300_GSM_Business_Cards__1__cc07b248.webp',
  'prod-plain-polo': '/assets/aistudio/Classic_Plain_Polo_Color_Collection_17e25f68.webp',
  'prod-polo-01': '/assets/products/prod_tipping_polo.webp',
  'prod-joab-coolmax': '/assets/aistudio/JOAB_Coolmax_Polo_Shirt_Showcase_0673e0a4.webp',
  'prod-matty-polo': '/assets/aistudio/Premium_Matty_Polo_T-Shirt_Banner_45dae9b5.webp',
  'prod-cotton-flexi-caps': '/assets/aistudio/Cotton_Flexi_Caps_Product_Banner_7057e0bd.webp',
};

// Node-native fallback snapshot of the 11 active storefront products (used only if
// runtime cannot directly import extensionless TS modules from src/data/mockData.ts)
const FALLBACK_CATALOG_PRODUCTS: RawCatalogProduct[] = [
  {
    id: 'prod-ceramic-mug',
    slug: 'promotional-ceramic-mug',
    name: 'Promotional Ceramic Mug',
    category: 'drinkware',
    basePrice: 249,
    moq: 5,
    rating: 4.9,
    reviewCount: 94,
    description:
      'Premium Promotional Ceramic Mug designed for corporate gifting, office branding, promotional campaigns and everyday use. Made with a glossy ceramic finish, comfortable grip handle and smooth rounded rim. Personalize your mug with your company logo or artwork and create a memorable branded gift.',
    colors: [
      {
        name: 'White',
        imageFront: '/assets/aistudio/Blank_White_Ceramic_Mug_b82bfadb.webp',
        imageBack: '/assets/mug/mug_back_blank.webp',
        imageSide: '/assets/aistudio/Top-Down_White_Ceramic_Mug_46e962e8.webp',
        imageDimensions: '/assets/aistudio/White_Mug_Dimensions_and_Features_Infographic_47e1f529.webp',
      },
    ],
    specs: { Finish: 'Premium Glossy Ceramic Finish' },
    productType: 'mug',
  },
  {
    id: 'prod-canopy-kiosk',
    slug: 'promotional-canopy-kiosk',
    name: 'Promotional Canopy Kiosk',
    category: 'signage',
    basePrice: 5100,
    moq: 1,
    rating: 4.9,
    reviewCount: 42,
    description:
      'Promotional Canopy Kiosk is a portable branding and promotional stall designed for exhibitions, trade shows, retail promotions, outdoor campaigns, and brand activation events. It features a premium navy blue polyester fabric canopy, sturdy metal frame, durable stitching, and stable base support. Available in 4 × 4 ft and 8 × 8 ft sizes, making it ideal for businesses looking for a professional promotional display solution.',
    sizes: ['4 × 4 ft', '8 × 8 ft'],
    colors: [
      {
        name: 'Navy Blue',
        imageFront: '/assets/aistudio/7_7_ft_Blue_Canopy_Booth_Infographic_3ac991cf.webp',
      },
    ],
    specs: { 'Fabric Material': 'High-Quality Water-Resistant Polyester Fabric Canopy' },
    productType: 'canopy',
  },
  {
    id: 'prod-rollup-standee',
    slug: 'rollup-standee',
    name: 'Rollup Standee',
    category: 'signage',
    basePrice: 1799,
    moq: 1,
    rating: 4.9,
    reviewCount: 56,
    description:
      'Rollup Standee is a premium retractable roll-up banner stand engineered for retail stores, exhibitions, trade shows, events, corporate branding, and marketing campaigns. Made with high-quality flex printing and a sturdy aluminum metal stand, it offers easy tool-free installation in minutes, lightweight portability, and includes a durable carry bag for effortless transport.',
    sizes: ['3 ft × 6 ft (36 × 72 in)'],
    colors: [
      {
        name: 'Black',
        imageFront: '/assets/standee/front.webp',
        imageBack: '/assets/standee/back.webp',
        imageDimensions: '/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp',
      },
    ],
    specs: { 'Stand Material': 'Heavy-Duty Premium Metal Aluminium Alloy Base & Telescopic Pole' },
    productType: 'standee',
  },
  {
    id: 'prod-visiting-card-300gsm',
    slug: 'premium-300-gsm-visiting-card',
    name: 'Premium 300 GSM Visiting Card',
    category: 'stationery',
    basePrice: 3,
    moq: 100,
    rating: 4.9,
    reviewCount: 320,
    description:
      'Premium quality 300 GSM visiting cards printed on smooth art paper with vibrant digital printing, sharp text and professional finishing. Ideal for business owners, professionals, startups and corporate branding.',
    colors: [
      {
        name: 'White',
        imageFront: '/assets/aistudio/Blank_Business_Card_Stack_Mockup_1cf3577a.webp',
        imageBack: '/assets/aistudio/Stacked_Blank_Business_Cards_5668bb6f.webp',
        imageDimensions: '/assets/aistudio/Premium_300_GSM_Business_Cards__1__cc07b248.webp',
      },
    ],
    specs: { 'Paper Quality': '300 GSM Premium Art Paper' },
    productType: 'visiting-card',
  },
  {
    id: 'prod-promo-table',
    slug: 'promo-table',
    name: 'Promo Table',
    category: 'signage',
    basePrice: 3500,
    moq: 1,
    rating: 4.9,
    reviewCount: 48,
    description:
      'Premium Portable Promo Table designed for exhibitions, promotional campaigns, product demonstrations, retail promotions and trade shows. Features a lightweight yet sturdy structure, spacious counter storage and an overhead branding display panel. Easy to assemble, portable and suitable for professional promotional activities.',
    colors: [
      {
        name: 'White',
        imageFront: '/assets/promo-table/front.webp',
        imageBack: '/assets/promo-table/back.webp',
        imageSide: '/assets/promo-table/side.webp',
        imageDimensions: '/assets/promo-table/dimensions.webp',
      },
    ],
    specs: { Material: 'High-Impact Polypropylene & Heavy-Duty Steel Support Rods' },
    productType: 'display',
  },
  {
    id: 'prod-branding-umbrella',
    slug: 'custom-printed-branding-umbrella',
    name: '5 Feet Promotional Umbrella',
    category: 'signage',
    basePrice: 1499,
    moq: 1,
    rating: 4.9,
    reviewCount: 36,
    description:
      'Premium Custom Printed 5 Feet Promotional Umbrella designed for outdoor promotions, exhibitions, retail marketing, product demonstrations, brand activations and promotional events. Features a durable polyester canopy, sturdy tripod base, adjustable height pole and custom printing options to showcase your brand professionally.',
    colors: [
      { name: 'Red + White', imageFront: '/assets/umbrella/red-dimensions.webp' },
      { name: 'Blue + White', imageFront: '/assets/umbrella/blue-dimensions.webp' },
      { name: 'Green + White', imageFront: '/assets/umbrella/green-dimensions.webp' },
      { name: 'Orange + White', imageFront: '/assets/umbrella/orange-dimensions.webp' },
    ],
    specs: { 'Canopy Fabric': 'Water-Resistant Premium Polyester Fabric with UV Shield' },
    productType: 'umbrella',
  },
  {
    id: 'prod-plain-polo',
    slug: 'customized-plain-polo-t-shirt',
    name: 'Cotton 230 GSM Plain Polo T-Shirt With Your Company Logo | Solid Color Corporate Polo | TeqqnoWorld',
    category: 'apparel',
    basePrice: 700,
    moq: 2,
    rating: 4.9,
    reviewCount: 38,
    description:
      '100% Premium Pure Cotton 230 GSM pique matty with solid color-matched ribbed collar and cuffs (no tipping). Breathable, ultra-soft, colorfast, and crafted for corporate uniforms, team apparel, and professional branding.',
    sizes: ['S (36)', 'M (38)', 'L (40)', 'XL (42)', '2XL (44)', '3XL (46)', '4XL (48)'],
    colors: [{ name: '16 Solid Colours' }],
    specs: { Material: '100% Pure Combed Cotton (230 GSM)' },
    productType: 'polo',
  },
  {
    id: 'prod-polo-01',
    slug: 'customized-100-pure-cotton-polo-t-shirt',
    name: 'Customized 100% Pure Cotton Polo T-Shirt With Your Company Logo | Order Logo Printed Tees | TeqqnoWorld',
    category: 'apparel',
    basePrice: 700,
    moq: 2,
    rating: 4.5,
    reviewCount: 42,
    description:
      '100% Premium Pure Cotton 230 GSM pique fabric with contrast tipping on collar and sleeves. Breathable, durable, soft on skin, and crafted for everyday comfort and professional corporate branding.',
    sizes: ['S (36)', 'M (38)', 'L (40)', 'XL (42)', '2XL (44)', '3XL (46)', '4XL (48)'],
    colors: [{ name: '15 Contrast Tipping Colours' }],
    specs: { Material: '100% Pure Combed Cotton (230 GSM)' },
    productType: 'polo',
  },
  {
    id: 'prod-joab-coolmax',
    slug: 'joab-coolmax-polo-t-shirt',
    name: 'Mars COOLMAX Polo T-Shirt – 220 GSM MARS Fabric | Custom Logo Printing | TeqqnoWorld',
    category: 'apparel',
    basePrice: 650,
    moq: 2,
    rating: 4.9,
    reviewCount: 52,
    description:
      'Engineered with cutting-edge 220 GSM MARS performance fabric, the Mars COOLMAX Polo T-Shirt offers superior moisture-wicking breathability, quick-drying comfort, and high color retention. Built for corporate teams, sports staff, and executive apparel with 15 vibrant colour options and precision custom logo branding.',
    sizes: ['S (36)', 'M (38)', 'L (40)', 'XL (42)', '2XL (44)', '3XL (46)'],
    colors: [{ name: '15 Corporate Colours' }],
    specs: { Fabric: '220 GSM MARS Performance Fabric' },
    productType: 'polo',
  },
  {
    id: 'prod-matty-polo',
    slug: 'matty-polo-t-shirt',
    name: 'Matty Polo T-Shirt – 230 GSM Fine Matty Fabric | Custom Logo Printing | TeqqnoWorld',
    category: 'apparel',
    basePrice: 650,
    moq: 2,
    rating: 4.9,
    reviewCount: 46,
    description:
      'Crafted from premium 230 GSM Fine Matty fabric with superior soft-touch texture, breathability, and long-lasting durability. Designed for everyday, casual and office wear, and optimized for high-definition custom printing and embroidery across 15 versatile corporate colours.',
    sizes: ['S (36)', 'M (38)', 'L (40)', 'XL (42)', '2XL (44)', '3XL (46)', '4XL (48)'],
    colors: [{ name: '15 Corporate Colours' }],
    specs: { Fabric: '230 GSM Fine Matty Fabric' },
    productType: 'polo',
  },
  {
    id: 'prod-cotton-flexi-caps',
    slug: 'cotton-flexi-caps',
    name: 'Cotton Flexi Caps – Plain Cotton Baseball Caps | Custom Logo Printing / Embroidery | TeqqnoWorld',
    category: 'apparel',
    basePrice: 250,
    moq: 1,
    rating: 4.9,
    reviewCount: 168,
    description:
      'Premium Cotton Flexi Caps designed for everyday comfort and style. Available in 6 attractive colours, perfect for corporate branding, promotional events, team uniforms and custom logo embroidery. Features pure breathable cotton fabric, pre-curved concertina stitched visor, structured front crown, and an adjustable strap.',
    colors: [
      { name: 'Black' },
      { name: 'Navy Blue' },
      { name: 'Red' },
      { name: 'Gray' },
      { name: 'Yellow' },
      { name: 'White' },
    ],
    specs: { Fabric: '100% Breathable Cotton Twill' },
    productType: 'cap',
  },
];

// Cache for dynamic import of src/data/mockData.ts keyed by file mtime
let cachedMockDataMtime = 0;
let cachedMockProducts: RawCatalogProduct[] | null = null;

function getPublicSiteOrigin(): string {
  const raw = (process.env.PUBLIC_SITE_URL || process.env.SITE_URL || DEFAULT_PUBLIC_SITE_URL).trim();
  if (!raw) return DEFAULT_PUBLIC_SITE_URL;
  try {
    const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    parsed.protocol = 'https:';
    return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
  } catch {
    return DEFAULT_PUBLIC_SITE_URL;
  }
}

function getStoreCountry(): string {
  const raw = (process.env.FEED_STORE_COUNTRY || DEFAULT_STORE_COUNTRY).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) ? raw : DEFAULT_STORE_COUNTRY;
}

function getTargetCountries(): string[] {
  const raw = (process.env.FEED_TARGET_COUNTRIES || '').trim();
  if (!raw) return [...DEFAULT_TARGET_COUNTRIES];
  const parsed = raw
    .split(',')
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));
  const unique = Array.from(new Set(parsed));
  return unique.length > 0 ? unique : [...DEFAULT_TARGET_COUNTRIES];
}

function cleanPlainText(input: unknown, maxLength: number): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function decodeURIComponentSafe(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function resolveVerifiedLocalAssetPath(rawPath: string, publicDir?: string): string | null {
  if (!publicDir) return rawPath;
  const decodedPath = rawPath
    .split('/')
    .map((seg) => decodeURIComponentSafe(seg))
    .join('/');

  const resolvedRoot = path.resolve(publicDir);
  const candidate = path.resolve(resolvedRoot, decodedPath.replace(/^\/+/, ''));

  // Enforce strict containment within publicDir
  if (candidate !== resolvedRoot && !candidate.startsWith(`${resolvedRoot}${path.sep}`)) {
    return null;
  }

  if (fs.existsSync(candidate)) {
    return decodedPath;
  }

  // Upgrade legacy .png/.jpg/.jpeg references to compressed .webp counterparts if present
  if (/\.(png|jpe?g)$/i.test(decodedPath)) {
    const webpRelative = decodedPath.replace(/\.(png|jpe?g)$/i, '.webp');
    const webpCandidate = path.resolve(resolvedRoot, webpRelative.replace(/^\/+/, ''));
    if (
      webpCandidate.startsWith(`${resolvedRoot}${path.sep}`) &&
      fs.existsSync(webpCandidate)
    ) {
      return webpRelative;
    }
  }

  return null;
}

function encodeUrlPath(rawPath: string): string {
  return rawPath
    .split('/')
    .map((seg) => encodeURIComponent(decodeURIComponentSafe(seg)))
    .join('/');
}

function resolveHttpsUrl(rawUrl: unknown, origin: string, publicDir?: string): string | null {
  if (typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Reject unsafe schemes immediately
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    const verifiedPath = resolveVerifiedLocalAssetPath(trimmed, publicDir);
    if (!verifiedPath) return null;
    // Percent-encode commas in URLs per OpenAI additional_image_urls requirement
    return `${origin}${encodeUrlPath(verifiedPath)}`.replace(/,/g, '%2C');
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    parsed.protocol = 'https:';

    // If the URL points to our own storefront /assets/* path, verify it exists on disk
    const originHost = new URL(origin).host.toLowerCase();
    if (parsed.host.toLowerCase() === originHost && parsed.pathname.startsWith('/assets/')) {
      const verifiedPath = resolveVerifiedLocalAssetPath(parsed.pathname, publicDir);
      if (!verifiedPath) return null;
      parsed.pathname = encodeUrlPath(verifiedPath);
    }

    return parsed.toString().replace(/,/g, '%2C');
  } catch {
    return null;
  }
}

function mapProductTaxonomy(rawCategory: string, productType?: string): string {
  const type = (productType || '').toLowerCase();
  const cat = rawCategory.trim().toLowerCase();

  if (type === 'cap') {
    return 'Apparel & Accessories > Clothing Accessories > Hats';
  }
  if (type === 'polo' || cat === 'apparel') {
    return 'Apparel & Accessories > Clothing > Shirts & Tops';
  }
  if (type === 'mug' || cat === 'drinkware') {
    return 'Home & Garden > Kitchen & Dining > Tableware > Drinkware > Mugs';
  }
  if (type === 'visiting-card' || cat === 'stationery') {
    return 'Office Supplies > General Office Supplies > Business Cards';
  }
  if (
    type === 'standee' ||
    type === 'canopy' ||
    type === 'display' ||
    type === 'umbrella' ||
    cat === 'signage' ||
    cat === 'display'
  ) {
    return 'Business & Industrial > Advertising & Marketing > Trade Show Displays';
  }
  if (cat === 'gifting') {
    return 'Arts & Entertainment > Party & Celebration > Gift Giving';
  }
  return 'Business & Industrial > Advertising & Marketing > Promotional Products';
}

/**
 * Normalizes stock status strictly into the official OpenAI Product Feed availability enum:
 *   in_stock | out_of_stock | pre_order | backorder | unknown
 */
function normalizeAvailability(
  rawAvailability?: unknown,
  inStock?: unknown,
  stockQty?: unknown
): { availability: FeedAvailability; inventoryQuantity: number } {
  const qtyNum =
    stockQty !== undefined && stockQty !== null && stockQty !== ''
      ? Number(stockQty)
      : undefined;

  if (typeof inStock === 'boolean' && !inStock) {
    return { availability: 'out_of_stock', inventoryQuantity: 0 };
  }

  if (typeof qtyNum === 'number' && Number.isFinite(qtyNum) && qtyNum <= 0) {
    return { availability: 'out_of_stock', inventoryQuantity: 0 };
  }

  if (typeof rawAvailability === 'string' && rawAvailability.trim()) {
    const normalized = rawAvailability.trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (
      normalized === 'out_of_stock' ||
      normalized === 'outofstock' ||
      normalized === 'unavailable'
    ) {
      return { availability: 'out_of_stock', inventoryQuantity: 0 };
    }
    if (normalized === 'pre_order' || normalized === 'preorder') {
      return {
        availability: 'pre_order',
        inventoryQuantity:
          typeof qtyNum === 'number' && Number.isFinite(qtyNum) && qtyNum > 0
            ? Math.floor(qtyNum)
            : DEFAULT_INVENTORY_QTY,
      };
    }
    if (normalized === 'backorder' || normalized === 'back_order') {
      return {
        availability: 'backorder',
        inventoryQuantity:
          typeof qtyNum === 'number' && Number.isFinite(qtyNum) && qtyNum > 0
            ? Math.floor(qtyNum)
            : 0,
      };
    }
    if (normalized === 'unknown') {
      return {
        availability: 'unknown',
        inventoryQuantity:
          typeof qtyNum === 'number' && Number.isFinite(qtyNum) && qtyNum >= 0
            ? Math.floor(qtyNum)
            : 0,
      };
    }
  }

  return {
    availability: 'in_stock',
    inventoryQuantity:
      typeof qtyNum === 'number' && Number.isFinite(qtyNum) && qtyNum > 0
        ? Math.floor(qtyNum)
        : DEFAULT_INVENTORY_QTY,
  };
}

function normalizeCondition(rawCondition?: unknown): FeedCondition {
  const val = String(rawCondition || '').trim().toLowerCase();
  if (val === 'refurbished' || val === 'used') return val;
  return 'new';
}

function isRowInactive(row: SupabaseProductRow): boolean {
  if (row.is_active === false || row.active === false) return true;
  if (typeof row.status === 'string') {
    const st = row.status.trim().toLowerCase();
    if (['inactive', 'archived', 'draft', 'disabled', 'deleted', 'hidden'].includes(st)) {
      return true;
    }
  }
  return false;
}

function formatPriceInr(amount: number): string {
  const safe = Number.isFinite(amount) && amount >= 0 ? amount : 0;
  return `${safe.toFixed(2)} INR`;
}

function extractMaterial(product: RawCatalogProduct): string | undefined {
  if (!product.specs) return undefined;
  const keys = [
    'Material',
    'Fabric',
    'Fabric Material',
    'Paper Quality',
    'Canopy Fabric',
    'Stand Material',
    'Finish',
  ];
  for (const key of keys) {
    const val = product.specs[key];
    if (val && typeof val === 'string') {
      return cleanPlainText(val, 100);
    }
  }
  return undefined;
}

function extractColorSummary(product: RawCatalogProduct): string | undefined {
  if (!Array.isArray(product.colors) || product.colors.length === 0) return undefined;
  const names = product.colors
    .map((c) => (typeof c?.name === 'string' ? c.name.trim() : ''))
    .filter(Boolean);
  if (names.length === 0) return undefined;
  if (names.length <= 4) {
    return cleanPlainText(names.join(', '), 80);
  }
  return cleanPlainText(`${names[0]} (+${names.length - 1} more colours)`, 80);
}

function collectProductImages(
  product: RawCatalogProduct,
  origin: string,
  publicDir: string,
  overridePrimaryUrl?: string | null,
  extraUrls?: string[]
): { primary: string; additional: string[] } {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const pushIfValid = (raw: unknown) => {
    const resolved = resolveHttpsUrl(raw, origin, publicDir);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      ordered.push(resolved);
    }
  };

  // 1. Live override image (e.g. from Supabase) takes highest priority
  if (overridePrimaryUrl) {
    pushIfValid(overridePrimaryUrl);
  }

  // 2. Curated catalog showcase banner
  if (SHOWCASE_BANNER_BY_PRODUCT_ID[product.id]) {
    pushIfValid(SHOWCASE_BANNER_BY_PRODUCT_ID[product.id]);
  }

  // 3. Additional explicitly passed URLs
  if (Array.isArray(extraUrls)) {
    for (const u of extraUrls) pushIfValid(u);
  }

  // 4. Product color gallery images (front, back, side, dimensions)
  if (Array.isArray(product.colors)) {
    for (const c of product.colors.slice(0, 6)) {
      pushIfValid(c?.imageFront);
      pushIfValid(c?.imageBack);
      pushIfValid(c?.imageSide);
      pushIfValid(c?.imageDimensions);
    }
  }

  // 5. Safe fallback image verified to exist in public/assets
  if (ordered.length === 0) {
    pushIfValid('/assets/products/prod_tipping_polo.webp');
  }

  return {
    primary: ordered[0],
    additional: ordered.slice(1, 10),
  };
}

/**
 * Loads active storefront catalog products dynamically from src/data/mockData.ts
 * whenever the file changes on disk. Gracefully falls back to the built-in
 * snapshot under runtimes that cannot import extensionless TS files.
 */
async function loadBaseCatalogProducts(rootDir: string): Promise<RawCatalogProduct[]> {
  const mockDataPath = path.join(rootDir, 'src', 'data', 'mockData.ts');
  try {
    if (fs.existsSync(mockDataPath)) {
      const mtime = fs.statSync(mockDataPath).mtimeMs;
      if (cachedMockProducts && cachedMockDataMtime === mtime) {
        return cachedMockProducts;
      }
      const moduleUrl = `${pathToFileURL(mockDataPath).href}?v=${mtime}`;
      const mod = await import(moduleUrl);
      if (Array.isArray(mod?.PRODUCTS) && mod.PRODUCTS.length > 0) {
        cachedMockDataMtime = mtime;
        cachedMockProducts = mod.PRODUCTS as RawCatalogProduct[];
        return cachedMockProducts;
      }
    }
  } catch {
    // Expected under bare `node server.ts` due to extensionless imports inside src/data/mockData.ts;
    // safely fall back to the synchronized catalog snapshot and live Supabase merge.
  }
  return FALLBACK_CATALOG_PRODUCTS;
}

/**
 * Queries live Supabase `products` table using configured read-only public credentials.
 * Returns null if Supabase is unreachable or empty, ensuring zero downtime.
 */
async function fetchLiveSupabaseProducts(
  getSupabaseConfig: () => { url: string; apiKey: string }
): Promise<SupabaseProductRow[] | null> {
  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.apiKey) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);

  try {
    const endpoint = `${cfg.url.replace(/\/+$/, '')}/rest/v1/products?select=*&order=created_at.asc`;
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: cfg.apiKey,
        Authorization: `Bearer ${cfg.apiKey}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }
    return data as SupabaseProductRow[];
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Builds the live, normalized list of active product feed items strictly adhering
 * to the Official OpenAI ChatGPT Product Feed Schema.
 */
export async function buildDynamicProductFeed(
  options: ProductFeedOptions
): Promise<ProductFeedItem[]> {
  const origin = getPublicSiteOrigin();
  const storeCountry = getStoreCountry();
  const targetCountries = getTargetCountries();
  const publicDir = path.join(options.rootDir, 'public');

  const [baseProducts, supabaseRows] = await Promise.all([
    loadBaseCatalogProducts(options.rootDir),
    fetchLiveSupabaseProducts(options.getSupabaseConfig),
  ]);

  const supabaseByKey = new Map<string, SupabaseProductRow>();
  const matchedSupabaseIds = new Set<string>();
  const seenItemIds = new Set<string>();

  if (Array.isArray(supabaseRows)) {
    for (const row of supabaseRows) {
      if (row.id) supabaseByKey.set(String(row.id).trim().toLowerCase(), row);
      if (row.slug) supabaseByKey.set(String(row.slug).trim().toLowerCase(), row);
    }
  }

  const feedItems: ProductFeedItem[] = [];

  // 1. Emit active catalog products with live Supabase overrides applied
  for (const product of baseProducts) {
    if (product.isActive === false) continue;

    const itemId = cleanPlainText(product.id, 100);
    if (!itemId || seenItemIds.has(itemId.toLowerCase())) continue;

    const liveOverride =
      supabaseByKey.get(itemId.toLowerCase()) ||
      supabaseByKey.get(product.slug.toLowerCase());

    if (liveOverride) {
      if (liveOverride.id) matchedSupabaseIds.add(String(liveOverride.id).toLowerCase());
      if (liveOverride.slug) matchedSupabaseIds.add(String(liveOverride.slug).toLowerCase());
      if (isRowInactive(liveOverride)) {
        continue;
      }
    }

    const rawPrice =
      liveOverride?.base_price !== undefined && liveOverride?.base_price !== null
        ? Number(liveOverride.base_price)
        : liveOverride?.price !== undefined && liveOverride?.price !== null
        ? Number(liveOverride.price)
        : Number(product.basePrice);

    const effectivePrice = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : product.basePrice;
    const effectiveSlug = cleanPlainText(
      liveOverride?.slug || product.slug || slugify(product.name),
      120
    );
    const effectiveTitle = cleanPlainText(
      liveOverride?.title || liveOverride?.name || product.name,
      150
    );
    const effectiveDesc = cleanPlainText(
      liveOverride?.description || product.description || product.shortDesc || effectiveTitle,
      5000
    );
    const effectiveCategoryRaw = String(liveOverride?.category || product.category || 'promotional');
    const effectiveBrand =
      cleanPlainText(liveOverride?.brand || product.brand || DEFAULT_BRAND, 70) || DEFAULT_BRAND;
    const effectiveCondition = normalizeCondition(liveOverride?.condition || product.condition);

    const { availability, inventoryQuantity } = normalizeAvailability(
      liveOverride?.availability ?? product.availability,
      liveOverride?.in_stock,
      liveOverride?.inventory_quantity ?? liveOverride?.stock_quantity ?? product.stockQuantity
    );

    const rawExtraImages = liveOverride?.additional_image_urls ?? liveOverride?.additional_images;
    const overrideExtraImages = Array.isArray(rawExtraImages)
      ? rawExtraImages
      : typeof rawExtraImages === 'string'
      ? rawExtraImages.split(',').map((s) => s.trim())
      : undefined;

    const images = collectProductImages(
      product,
      origin,
      publicDir,
      liveOverride?.image_url || liveOverride?.image_link || undefined,
      overrideExtraImages
    );

    const sizesList =
      Array.isArray(liveOverride?.available_sizes) && liveOverride.available_sizes.length > 0
        ? liveOverride.available_sizes
        : product.sizes;

    const reviewCountVal = Number(liveOverride?.review_count ?? product.reviewCount);
    const ratingVal = Number(liveOverride?.rating ?? product.rating);
    const hasReviews = Number.isFinite(reviewCountVal) && reviewCountVal > 0;
    const hasValidRating = Number.isFinite(ratingVal) && ratingVal > 0 && ratingVal <= 5;

    seenItemIds.add(itemId.toLowerCase());

    feedItems.push({
      item_id: itemId,
      title: effectiveTitle,
      description: effectiveDesc,
      url: `${origin}/product/${encodeURIComponent(effectiveSlug)}`,
      brand: effectiveBrand,
      seller_name: DEFAULT_BRAND,
      image_url: images.primary,
      availability,
      price: formatPriceInr(effectivePrice),
      target_countries: [...targetCountries],
      store_country: storeCountry,
      additional_image_urls: images.additional,
      is_eligible_search: true,
      is_eligible_checkout: false,
      condition: effectiveCondition,
      product_category: mapProductTaxonomy(effectiveCategoryRaw, product.productType),
      inventory_quantity: inventoryQuantity,
      seller_url: origin,
      seller_privacy_policy: `${origin}/privacy-policy`,
      seller_tos: `${origin}/terms-and-conditions`,
      return_policy: `${origin}/return-replacement-policy`,
      color: extractColorSummary(product),
      size:
        Array.isArray(sizesList) && sizesList.length > 0
          ? cleanPlainText(sizesList.join(', '), 80)
          : undefined,
      material:
        cleanPlainText(liveOverride?.material || extractMaterial(product) || '', 100) || undefined,
      review_count: hasReviews ? Math.floor(reviewCountVal) : undefined,
      star_rating: hasReviews && hasValidRating ? ratingVal.toFixed(2) : undefined,
    });
  }

  // 2. Include any brand-new active products added directly in Supabase
  if (Array.isArray(supabaseRows)) {
    for (const row of supabaseRows) {
      if (isRowInactive(row)) continue;
      const rowId = cleanPlainText(row.id, 100);
      const rowName = cleanPlainText(row.title || row.name, 150);
      if (!rowId || !rowName) continue;
      if (matchedSupabaseIds.has(rowId.toLowerCase()) || seenItemIds.has(rowId.toLowerCase())) {
        continue;
      }

      const rowSlug = cleanPlainText(row.slug || slugify(rowName) || rowId, 120);
      if (matchedSupabaseIds.has(rowSlug.toLowerCase())) continue;

      const rawPrice = Number(row.base_price ?? row.price);
      if (!Number.isFinite(rawPrice) || rawPrice <= 0) continue;

      const { availability, inventoryQuantity } = normalizeAvailability(
        row.availability,
        row.in_stock,
        row.inventory_quantity ?? row.stock_quantity
      );

      const primaryImage =
        resolveHttpsUrl(row.image_url || row.image_link, origin, publicDir) ||
        `${origin}/assets/products/prod_tipping_polo.webp`;

      const additionalImages: string[] = [];
      const rawExtra = row.additional_image_urls ?? row.additional_images;
      const extraArr = Array.isArray(rawExtra)
        ? rawExtra
        : typeof rawExtra === 'string'
        ? rawExtra.split(',').map((s) => s.trim())
        : [];
      for (const u of extraArr) {
        const resolved = resolveHttpsUrl(u, origin, publicDir);
        if (resolved && resolved !== primaryImage && !additionalImages.includes(resolved)) {
          additionalImages.push(resolved);
        }
      }

      const categoryRaw = String(row.category || 'promotional');
      const reviewCountVal = Number(row.review_count);
      const ratingVal = Number(row.rating);
      const hasReviews = Number.isFinite(reviewCountVal) && reviewCountVal > 0;
      const hasValidRating = Number.isFinite(ratingVal) && ratingVal > 0 && ratingVal <= 5;

      seenItemIds.add(rowId.toLowerCase());

      feedItems.push({
        item_id: rowId,
        title: rowName,
        description: cleanPlainText(row.description || rowName, 5000),
        url: `${origin}/product/${encodeURIComponent(rowSlug)}`,
        brand: cleanPlainText(row.brand || DEFAULT_BRAND, 70) || DEFAULT_BRAND,
        seller_name: DEFAULT_BRAND,
        image_url: primaryImage,
        availability,
        price: formatPriceInr(rawPrice),
        target_countries: [...targetCountries],
        store_country: storeCountry,
        additional_image_urls: additionalImages.slice(0, 9),
        is_eligible_search: true,
        is_eligible_checkout: false,
        condition: normalizeCondition(row.condition),
        product_category: mapProductTaxonomy(categoryRaw),
        inventory_quantity: inventoryQuantity,
        seller_url: origin,
        seller_privacy_policy: `${origin}/privacy-policy`,
        seller_tos: `${origin}/terms-and-conditions`,
        return_policy: `${origin}/return-replacement-policy`,
        size:
          Array.isArray(row.available_sizes) && row.available_sizes.length > 0
            ? cleanPlainText(row.available_sizes.join(', '), 80)
            : undefined,
        material: cleanPlainText(row.material, 100) || undefined,
        review_count: hasReviews ? Math.floor(reviewCountVal) : undefined,
        star_rating: hasReviews && hasValidRating ? ratingVal.toFixed(2) : undefined,
      });
    }
  }

  return feedItems;
}

// ==============================================================================
// CSV & JSONL SERIALIZERS (Official OpenAI ChatGPT Product Feed Schema)
// ==============================================================================

const CSV_COLUMNS: ReadonlyArray<string> = [
  // 11 Required OpenAI ChatGPT Product Feed Schema columns
  'item_id',
  'title',
  'description',
  'url',
  'brand',
  'seller_name',
  'image_url',
  'availability',
  'price',
  'target_countries',
  'store_country',
  // Official OpenAI Product Feed optional / control columns
  'additional_image_urls',
  'is_eligible_search',
  'is_eligible_checkout',
  'condition',
  'product_category',
  'inventory_quantity',
  'seller_url',
  'seller_privacy_policy',
  'seller_tos',
  'return_policy',
  'color',
  'size',
  'material',
  'review_count',
  'star_rating',
];

/**
 * Escapes a single CSV field per RFC 4180 and neutralizes spreadsheet formula
 * prefixes (=, +, -, @) if ever introduced via dynamic database edits.
 */
function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value).replace(/[\r\n]+/g, ' ');
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatProductsCsv(items: ProductFeedItem[]): string {
  const lines: string[] = [CSV_COLUMNS.join(',')];

  for (const item of items) {
    const row = [
      item.item_id,
      item.title,
      item.description,
      item.url,
      item.brand,
      item.seller_name,
      item.image_url,
      item.availability,
      item.price,
      item.target_countries.join(','),
      item.store_country,
      item.additional_image_urls.join(','),
      item.is_eligible_search ? 'true' : 'false',
      item.is_eligible_checkout ? 'true' : 'false',
      item.condition,
      item.product_category,
      item.inventory_quantity,
      item.seller_url,
      item.seller_privacy_policy,
      item.seller_tos,
      item.return_policy,
      item.color ?? '',
      item.size ?? '',
      item.material ?? '',
      item.review_count ?? '',
      item.star_rating ?? '',
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  }

  return `${lines.join('\n')}\n`;
}

export function formatProductsJsonl(items: ProductFeedItem[]): string {
  return (
    items
      .map((item) => {
        const record: Record<string, unknown> = {
          item_id: item.item_id,
          title: item.title,
          description: item.description,
          url: item.url,
          brand: item.brand,
          seller_name: item.seller_name,
          image_url: item.image_url,
          availability: item.availability,
          price: item.price,
          target_countries: item.target_countries,
          store_country: item.store_country,
          is_eligible_search: item.is_eligible_search,
          is_eligible_checkout: item.is_eligible_checkout,
          condition: item.condition,
          product_category: item.product_category,
          inventory_quantity: item.inventory_quantity,
          seller_url: item.seller_url,
          seller_privacy_policy: item.seller_privacy_policy,
          seller_tos: item.seller_tos,
          return_policy: item.return_policy,
        };

        if (item.additional_image_urls.length > 0) {
          record.additional_image_urls = item.additional_image_urls;
        }
        if (item.color) record.color = item.color;
        if (item.size) record.size = item.size;
        if (item.material) record.material = item.material;
        if (item.review_count !== undefined) {
          record.review_count = item.review_count;
        }
        if (item.star_rating !== undefined) {
          record.star_rating = item.star_rating;
        }

        return JSON.stringify(record);
      })
      .join('\n') + '\n'
  );
}

function computeWeakEtag(body: string): string {
  const hash = crypto.createHash('sha256').update(body, 'utf8').digest('hex').slice(0, 24);
  return `W/"${hash}"`;
}

function sendFeedResponse(
  req: Request,
  res: Response,
  body: string,
  contentType: string,
  filename: string
): void {
  const etag = computeWeakEtag(body);

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Cache-Control', 'public, max-age=60, must-revalidate');
  res.setHeader('ETag', etag);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

  const ifNoneMatch = req.headers['if-none-match'];
  if (typeof ifNoneMatch === 'string' && ifNoneMatch.trim() === etag) {
    res.status(304).end();
    return;
  }

  res.status(200).send(body);
}

/**
 * Registers public read-only dynamic product feed endpoints:
 *   - GET /feeds/products.csv
 *   - GET /feeds/products.jsonl
 */
export function registerProductFeedRoutes(app: Express, options: ProductFeedOptions): void {
  app.options(['/feeds/products.csv', '/feeds/products.jsonl'], (_req: Request, res: Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.status(204).end();
  });

  app.get('/feeds/products.csv', async (req: Request, res: Response) => {
    try {
      const items = await buildDynamicProductFeed(options);
      const csvBody = formatProductsCsv(items);
      sendFeedResponse(req, res, csvBody, 'text/csv; charset=utf-8', 'products.csv');
    } catch (err) {
      console.error('[TeqqnoWorld] Error generating CSV product feed:', err);
      res.status(500).type('text/plain; charset=utf-8').send('Unable to generate product feed.');
    }
  });

  app.get('/feeds/products.jsonl', async (req: Request, res: Response) => {
    try {
      const items = await buildDynamicProductFeed(options);
      const jsonlBody = formatProductsJsonl(items);
      sendFeedResponse(
        req,
        res,
        jsonlBody,
        'application/jsonl; charset=utf-8',
        'products.jsonl'
      );
    } catch (err) {
      console.error('[TeqqnoWorld] Error generating JSONL product feed:', err);
      res.status(500).type('application/json; charset=utf-8').json({
        error: 'Unable to generate product feed.',
      });
    }
  });
}
