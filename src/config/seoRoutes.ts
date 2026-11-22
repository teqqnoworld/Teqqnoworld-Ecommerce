// ==============================================================================
// TEQQNOWORLD CANONICAL SEO ROUTES, CATEGORIES & METADATA DEFINITIONS
// Pure TypeScript module shared by both Express server and React frontend
// Official Canonical Domain: https://teqqnoworld.com
// ==============================================================================

export const CANONICAL_ORIGIN = 'https://teqqnoworld.com';
export const DEFAULT_OG_IMAGE_PATH = '/assets/products/prod_tipping_polo.webp';
export const DEFAULT_OG_IMAGE_URL = `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE_PATH}`;

export interface SeoCategoryDefinition {
  slug: string;
  catalogCategory: string;
  name: string;
  h1: string;
  title: string;
  description: string;
  image: string;
  aliases: string[];
}

export const SEO_CATEGORIES: ReadonlyArray<SeoCategoryDefinition> = [
  {
    slug: 'custom-polo-t-shirts',
    catalogCategory: 'custom-tshirt-printing',
    name: 'Custom Polo T-Shirts',
    h1: 'Custom Polo T-Shirt Printing in India',
    title: 'Custom Polo T-Shirt Printing India | Logo T-Shirts | TeqqnoWorld',
    description:
      'Order custom printed and embroidered 220–230 GSM corporate polo T-shirts with your company logo across India. MOQ 2 pcs, live mockup preview & 24–48h dispatch.',
    image: '/assets/products/prod_tipping_polo.webp',
    aliases: ['apparel', 'polos', 'tshirts', 'custom-tshirt-printing', 'polo-t-shirts'],
  },
  {
    slug: 'corporate-gifting-drinkware',
    catalogCategory: 'corporate-gifting',
    name: 'Corporate Gifting & Drinkware',
    h1: 'Custom Printed Ceramic Mugs & Corporate Gifts',
    title: 'Custom Ceramic Mugs & Corporate Gifts India | TeqqnoWorld',
    description:
      'Customize glossy 325 ml promotional ceramic mugs and branded corporate gifts with your company logo. Bulk INR pricing, 18% GST invoice & pan-India delivery.',
    image: '/assets/aistudio/ceramic_mug_banner_1672x941_dc952a76.webp',
    aliases: ['drinkware', 'corporate-gifting', 'gifting', 'kits', 'mugs'],
  },
  {
    slug: 'promotional-displays-signage',
    catalogCategory: 'promotional-items',
    name: 'Promotional Displays & Signage',
    h1: 'Promotional Displays, Standees, Umbrellas & Canopies',
    title: 'Rollup Standees, Promo Tables & Branding Umbrellas | TeqqnoWorld',
    description:
      'Shop custom printed rollup standees, portable promo tables, 5ft promotional umbrellas and canopy kiosks in India. Durable event branding with 24–48h dispatch.',
    image: '/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp',
    aliases: ['signage', 'display', 'event-signage', 'promotional-items'],
  },
  {
    slug: 'visiting-cards-printing',
    catalogCategory: 'printing-items',
    name: 'Visiting Cards & Printing',
    h1: 'Premium 300 GSM Visiting Card Printing',
    title: 'Premium 300 GSM Visiting Card Printing India | TeqqnoWorld',
    description:
      'Print custom 300 GSM smooth art paper visiting cards with vibrant double-sided digital printing. Bulk packs starting from ₹1/card with fast pan-India shipping.',
    image: '/assets/aistudio/Premium_300_GSM_Business_Cards__1__cc07b248.webp',
    aliases: ['stationery', 'visiting-cards', 'printing-items'],
  },
  {
    slug: 'custom-caps',
    catalogCategory: 'caps',
    name: 'Custom Cotton Caps',
    h1: 'Custom Printed & Embroidered Cotton Caps',
    title: 'Custom Cotton Caps with Company Logo India | TeqqnoWorld',
    description:
      'Order 100% breathable cotton flexi baseball caps with custom logo printing or Tajima embroidery. 6 colours, MOQ 1 pc, bulk wholesale INR rates across India.',
    image: '/assets/aistudio/Cotton_Flexi_Caps_Product_Banner_7057e0bd.webp',
    aliases: ['caps', 'headwear'],
  },
];

export interface SeoStaticPageDefinition {
  path: string;
  title: string;
  description: string;
  h1: string;
  robots?: string;
  sitemapPriority?: string;
  sitemapChangefreq?: 'daily' | 'weekly' | 'monthly';
}

export const SEO_LEGAL_PAGES: ReadonlyArray<SeoStaticPageDefinition> = [
  {
    path: '/privacy-policy',
    title: 'Privacy Policy | TeqqnoWorld',
    description:
      'Read how TeqqnoWorld collects, protects, and processes customer, artwork, and order data for custom printing orders across India.',
    h1: 'Privacy Policy',
    sitemapPriority: '0.4',
    sitemapChangefreq: 'monthly',
  },
  {
    path: '/terms-and-conditions',
    title: 'Terms and Conditions | TeqqnoWorld',
    description:
      'Review TeqqnoWorld terms of service covering custom logo printing, digital proof approvals, bulk orders, GST billing, and delivery across India.',
    h1: 'Terms and Conditions',
    sitemapPriority: '0.4',
    sitemapChangefreq: 'monthly',
  },
  {
    path: '/shipping-policy',
    title: 'Shipping and Delivery Policy | TeqqnoWorld',
    description:
      'Learn about TeqqnoWorld production timelines (24–48h), pan-India courier partners covering 19,000+ pin codes, and free shipping criteria.',
    h1: 'Shipping and Delivery Policy',
    sitemapPriority: '0.5',
    sitemapChangefreq: 'monthly',
  },
  {
    path: '/cancellation-refund-policy',
    title: 'Cancellation and Refund Policy | TeqqnoWorld',
    description:
      'Understand cancellation windows prior to proof approval and refund timelines for custom-printed corporate merchandise at TeqqnoWorld.',
    h1: 'Cancellation and Refund Policy',
    sitemapPriority: '0.4',
    sitemapChangefreq: 'monthly',
  },
  {
    path: '/return-replacement-policy',
    title: 'Return and Replacement Policy | TeqqnoWorld',
    description:
      'Details on TeqqnoWorld quality assurance, transit damage reporting, and replacement eligibility for custom printed merchandise.',
    h1: 'Return and Replacement Policy',
    sitemapPriority: '0.4',
    sitemapChangefreq: 'monthly',
  },
  {
    path: '/contact-us',
    title: 'Contact Us | Custom Printing Hyderabad & India | TeqqnoWorld',
    description:
      'Contact TeqqnoWorld in Bachupally, Hyderabad for custom T-shirt printing, promotional merchandise quotes, bulk corporate orders, and order support.',
    h1: 'Contact TeqqnoWorld',
    sitemapPriority: '0.6',
    sitemapChangefreq: 'monthly',
  },
  {
    path: '/payment-policy',
    title: 'Payment Policy | Razorpay, UPI & B2B Billing | TeqqnoWorld',
    description:
      'Accepted payment modes at TeqqnoWorld including Razorpay, UPI, cards, net banking, and B2B GST invoicing for corporate merchandise orders.',
    h1: 'Payment Policy',
    sitemapPriority: '0.4',
    sitemapChangefreq: 'monthly',
  },
  {
    path: '/pricing-and-taxes',
    title: 'Pricing, Bulk Discounts & 18% GST Invoicing | TeqqnoWorld',
    description:
      'Transparent INR tiered volume pricing and compliant SAC 9989 GST tax invoices for 18% Input Tax Credit on TeqqnoWorld orders.',
    h1: 'Pricing and Taxes',
    sitemapPriority: '0.5',
    sitemapChangefreq: 'monthly',
  },
  {
    path: '/cookie-policy',
    title: 'Cookie Policy | TeqqnoWorld',
    description:
      'Information on essential session, cart, and preference cookies used on TeqqnoWorld.',
    h1: 'Cookie Policy',
    sitemapPriority: '0.3',
    sitemapChangefreq: 'monthly',
  },
];

export const VALID_LEGAL_PATHS: ReadonlyArray<string> = SEO_LEGAL_PAGES.map((p) => p.path);

export const PRIVATE_NOINDEX_PATHS: ReadonlyArray<string> = [
  '/admin',
  '/dashboard',
  '/checkout',
  '/orders',
  '/order-action',
];

export const SEO_HOME_META: SeoStaticPageDefinition = {
  path: '/',
  title: 'TeqqnoWorld | Custom T-Shirt Printing & Corporate Gifts India',
  description:
    'Order custom logo polo T-shirts, ceramic mugs, rollup standees, promo tables, umbrellas & visiting cards in India. Factory-direct INR pricing & 24–48h dispatch.',
  h1: 'Custom Printing & Corporate Merchandise in India',
  sitemapPriority: '1.0',
  sitemapChangefreq: 'daily',
};

export const SEO_CATALOG_META: SeoStaticPageDefinition = {
  path: '/catalog',
  title: 'All Custom Printed Products & Corporate Merchandise | TeqqnoWorld',
  description:
    'Browse all custom printable polo T-shirts, cotton caps, ceramic mugs, visiting cards, rollup standees, promo tables, canopies & umbrellas with bulk INR pricing.',
  h1: 'Custom Printed Products Catalog',
  sitemapPriority: '0.9',
  sitemapChangefreq: 'daily',
};

export const SEO_BULK_META: SeoStaticPageDefinition = {
  path: '/bulk',
  title: 'Bulk Corporate Merchandise & Custom Printing RFQ | TeqqnoWorld',
  description:
    'Request wholesale corporate printing quotes for teams, events, and trade shows across Hyderabad and India. Tiered bulk discounts & 18% GST tax invoicing.',
  h1: 'Bulk Corporate Printing & Enterprise RFQ',
  sitemapPriority: '0.7',
  sitemapChangefreq: 'monthly',
};

export const SEO_QUOTE_CALCULATOR_META: SeoStaticPageDefinition = {
  path: '/quote-calculator',
  title: 'B2B Bulk Quote Calculator | Custom Printing INR | TeqqnoWorld',
  description:
    'Calculate instant tiered INR bulk pricing for custom polo T-shirts, caps, mugs, visiting cards, and promotional displays with GST breakdown.',
  h1: 'B2B Bulk Quotation Calculator',
  sitemapPriority: '0.6',
  sitemapChangefreq: 'monthly',
};

export const SEO_BUNDLE_BUILDER_META: SeoStaticPageDefinition = {
  path: '/bundle-builder',
  title: 'Corporate Gift Bundle Builder | Branded Kits India | TeqqnoWorld',
  description:
    'Build custom corporate welcome kits and branded event gift bundles with live INR pricing and company logo printing across India.',
  h1: 'Corporate Gift Bundle Builder',
  sitemapPriority: '0.6',
  sitemapChangefreq: 'monthly',
};

// Product ID -> Canonical SEO Slug mapping (used for 301 redirects from /product/<id>)
export const PRODUCT_ID_TO_CANONICAL_SLUG: Readonly<Record<string, string>> = {
  'prod-ceramic-mug': 'promotional-ceramic-mug',
  'prod-canopy-kiosk': 'promotional-canopy-kiosk',
  'prod-rollup-standee': 'rollup-standee',
  'prod-visiting-card-300gsm': 'premium-300-gsm-visiting-card',
  'prod-promo-table': 'promo-table',
  'prod-branding-umbrella': 'custom-printed-branding-umbrella',
  'prod-plain-polo': 'customized-plain-polo-t-shirt',
  'prod-polo-01': 'customized-100-pure-cotton-polo-t-shirt',
  'prod-joab-coolmax': 'joab-coolmax-polo-t-shirt',
  'prod-matty-polo': 'matty-polo-t-shirt',
  'prod-cotton-flexi-caps': 'cotton-flexi-caps',
};

// Concise, non-truncated SEO titles for each storefront product (<= 65 chars)
const PRODUCT_SEO_TITLE_MAP: Readonly<Record<string, string>> = {
  'prod-ceramic-mug': 'Custom Printed Promotional Ceramic Mug (325 ml) | TeqqnoWorld',
  'prod-canopy-kiosk': 'Promotional Canopy Kiosk (4x4 & 8x8 ft) India | TeqqnoWorld',
  'prod-rollup-standee': 'Rollup Standee Printing (3x6 ft) with Carry Bag | TeqqnoWorld',
  'prod-visiting-card-300gsm': 'Premium 300 GSM Visiting Card Printing India | TeqqnoWorld',
  'prod-promo-table': 'Portable Promo Table Display Counter Printing | TeqqnoWorld',
  'prod-branding-umbrella': '5 Feet Custom Printed Promotional Umbrella | TeqqnoWorld',
  'prod-plain-polo': 'Cotton 230 GSM Plain Polo T-Shirt with Logo | TeqqnoWorld',
  'prod-polo-01': '100% Cotton Tipping Polo T-Shirt with Logo | TeqqnoWorld',
  'prod-joab-coolmax': 'Mars COOLMAX 220 GSM Polo T-Shirt with Logo | TeqqnoWorld',
  'prod-matty-polo': 'Matty 230 GSM Polo T-Shirt Custom Logo Print | TeqqnoWorld',
  'prod-cotton-flexi-caps': 'Custom Printed & Embroidered Cotton Flexi Caps | TeqqnoWorld',
};

export function findCategoryBySlugOrAlias(slugOrAlias: string): SeoCategoryDefinition | undefined {
  const clean = slugOrAlias.trim().toLowerCase();
  return SEO_CATEGORIES.find(
    (c) =>
      c.slug === clean ||
      c.catalogCategory.toLowerCase() === clean ||
      c.aliases.includes(clean)
  );
}

export function findCategoryByCatalogKey(catalogCategory: string): SeoCategoryDefinition | undefined {
  const clean = catalogCategory.trim().toLowerCase();
  return SEO_CATEGORIES.find(
    (c) =>
      c.catalogCategory.toLowerCase() === clean ||
      c.slug === clean ||
      c.aliases.includes(clean)
  );
}

export function getCategoryPath(categoryIdOrSlug: string): string {
  if (!categoryIdOrSlug || categoryIdOrSlug === 'all') return '/catalog';
  const found = findCategoryBySlugOrAlias(categoryIdOrSlug);
  return found ? `/category/${found.slug}` : '/catalog';
}

export function getProductPath(slug: string): string {
  return `/product/${encodeURIComponent(slug.trim())}`;
}

export function buildCanonicalUrl(pathname: string): string {
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (cleanPath === '/') return `${CANONICAL_ORIGIN}/`;
  return `${CANONICAL_ORIGIN}${cleanPath.replace(/\/+$/, '')}`;
}

export function buildProductSeoTitle(productId: string, productName: string): string {
  if (PRODUCT_SEO_TITLE_MAP[productId]) {
    return PRODUCT_SEO_TITLE_MAP[productId];
  }
  const cleanName = productName.split('|')[0].trim();
  const candidate = `${cleanName} | TeqqnoWorld`;
  return candidate.length <= 65 ? candidate : `${cleanName.slice(0, 50).trim()} | TeqqnoWorld`;
}

export function buildProductSeoDescription(params: {
  name: string;
  description: string;
  priceInr: number;
  moq?: number;
}): string {
  const cleanName = params.name.split('|')[0].trim();
  const cleanDesc = params.description.replace(/\s+/g, ' ').trim();
  const priceLabel = `₹${Math.round(params.priceInr).toLocaleString('en-IN')}`;
  const moqPart = params.moq && params.moq > 1 ? ` MOQ ${params.moq} pcs.` : '';
  const prefix = `Order ${cleanName} from ${priceLabel}.${moqPart} `;
  const combined = `${prefix}${cleanDesc}`;
  if (combined.length <= 160) return combined;
  return `${combined.slice(0, 157).replace(/\s+\S*$/, '')}...`;
}
