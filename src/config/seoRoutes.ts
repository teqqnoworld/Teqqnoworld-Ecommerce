// ==============================================================================
// TEQQNOWORLD CANONICAL SEO ROUTES, CATEGORIES & METADATA DEFINITIONS
// Pure TypeScript module shared by both Express server and React frontend
// Official Canonical Domain: https://teqqnoworld.com
// ==============================================================================

export const CANONICAL_ORIGIN = 'https://teqqnoworld.com';
export const DEFAULT_OG_IMAGE_PATH =
  '/assets/aistudio/Glossy_TeqqnoWorld_Branding_Badge_cb14788d.png';
export const DEFAULT_OG_IMAGE_URL = `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE_PATH}`;
export const DEFAULT_OG_IMAGE_ALT =
  'TeqqnoWorld — Custom Printing, Branded Merchandise & Corporate Gifts India';

export interface SeoCategoryHighlight {
  title: string;
  detail: string;
}

export interface SeoCategoryDefinition {
  slug: string;
  catalogCategory: string;
  name: string;
  h1: string;
  title: string;
  description: string;
  intro: string;
  gridHeading: string;
  guideHeading: string;
  highlights: ReadonlyArray<SeoCategoryHighlight>;
  image: string;
  aliases: string[];
}

export const SEO_CATEGORIES: ReadonlyArray<SeoCategoryDefinition> = [
  {
    slug: 'custom-polo-t-shirts',
    catalogCategory: 'custom-tshirt-printing',
    name: 'Custom Polo T-Shirts',
    h1: 'Custom Polo T-Shirt Printing in India',
    title: 'Custom Polo T-Shirt Printing India | Logo Polos | TeqqnoWorld',
    description:
      'Order custom polo T-shirt printing in India with your company logo. 220–230 GSM pure cotton, COOLMAX & matty polos from 2 pcs with bulk INR slabs & GST invoice.',
    intro:
      'Order custom polo T-shirt printing and precision logo embroidery across India for corporate teams, startups, and events. Compare 230 GSM 100% pure cotton plain and tipping polos, 220 GSM JOAB Mars COOLMAX moisture-wicking polos, and 230 GSM fine matty polos in 15–16 corporate colours starting at just 2 pieces.',
    gridHeading: 'Custom Polo T-Shirt Collection',
    guideHeading: 'Corporate Polo Fabric & Customization Guide',
    highlights: [
      {
        title: 'Verified 220–230 GSM Fabrics',
        detail: 'Available in 230 GSM 100% pure cotton (Plain & Tipping), 220 GSM JOAB Mars COOLMAX, and 230 GSM Fine Matty weaves for daily team wear.',
      },
      {
        title: 'Logo Printing & Embroidery',
        detail: 'Customize left chest, right chest, sleeve, or back placements with precision embroidery, DTF printing, or screen printing.',
      },
      {
        title: 'Low 2-Piece MOQ & Volume Slabs',
        detail: 'Start with a 2-piece sample order or scale to corporate bulk quantities from ₹350/pc with mixed sizes and 18% GST tax invoicing.',
      },
    ],
    image: '/assets/products/prod_tipping_polo.webp',
    aliases: ['apparel', 'polos', 'tshirts', 'custom-tshirt-printing', 'polo-t-shirts'],
  },
  {
    slug: 'corporate-gifting-drinkware',
    catalogCategory: 'corporate-gifting',
    name: 'Corporate Gifting & Drinkware',
    h1: 'Corporate Gifting & Custom Logo Drinkware in India',
    title: 'Corporate Gifting & Custom Logo Drinkware India | TeqqnoWorld',
    description:
      'Shop corporate gifting drinkware with custom company logo printing in India. 325 ml glossy white ceramic coffee mugs from 5 pcs, bulk INR slabs & 18% GST bill.',
    intro:
      'Explore corporate gifting drinkware customized with your company logo for employee onboarding kits, client appreciation, and trade events across India. Featuring our 325 ml (11 oz) glossy white ceramic coffee mug with an 8.5" × 3" wrap-around print area, microwave- and dishwasher-safe finish, and bulk INR slabs from 5 pieces.',
    gridHeading: 'Corporate Gifting & Branded Drinkware',
    guideHeading: 'Corporate Drinkware Specifications & Bulk Ordering Guide',
    highlights: [
      {
        title: '325 ml Glossy White Ceramic',
        detail: 'Standard 11 oz coffee mug with a smooth glossy white finish engineered for sharp, vibrant full-colour logo reproduction.',
      },
      {
        title: '8.5" × 3" Wrap Print Area',
        detail: 'Generous wrap-around print zone suitable for company logos, taglines, and event artwork with microwave and dishwasher safety.',
      },
      {
        title: '5-Piece MOQ & GST Billing',
        detail: 'Tiered INR volume pricing from ₹249 down to ₹149 per mug on bulk corporate orders with compliant 18% GST ITC invoices.',
      },
    ],
    image: '/assets/aistudio/ceramic_mug_banner_1672x941_dc952a76.webp',
    aliases: ['drinkware', 'corporate-gifting', 'gifting', 'kits', 'mugs'],
  },
  {
    slug: 'promotional-displays-signage',
    catalogCategory: 'promotional-items',
    name: 'Promotional Displays & Signage',
    h1: 'Promotional Displays, Standees, Umbrellas & Canopies',
    title: 'Promotional Displays, Standees & Canopies India | TeqqnoWorld',
    description:
      'Buy custom printed promotional displays in India: 3×6 ft rollup standees, promo tables, 5 ft umbrellas & 4×4/8×8 ft canopy kiosks. MOQ 1 unit & bulk INR rates.',
    intro:
      'Equip trade show booths, mall activations, retail storefronts, and outdoor BTL roadshows across India with custom printed promotional displays. Shop 3×6 ft retractable rollup standees, portable promo tables, 5 ft branding umbrellas with metal tripod stands, and 4×4 ft or 8×8 ft canopy kiosks starting from 1 unit.',
    gridHeading: 'Exhibition Displays & Outdoor Branding Equipment',
    guideHeading: 'Event Signage & Outdoor Display Buying Guide',
    highlights: [
      {
        title: 'Trade Show & Retail Counters',
        detail: '3×6 ft Rollup Standees with padded carry bag and portable Promo Tables featuring an overhead 31" × 10.3" header and 2-tier storage shelf.',
      },
      {
        title: 'Outdoor Umbrellas & Canopy Stalls',
        detail: '5 ft × 7 ft custom printed promotional umbrellas in 4 colours and 4×4 ft or 8×8 ft collapsible metal-frame canopy kiosks.',
      },
      {
        title: '1-Unit MOQ & Quick Tool-Free Setup',
        detail: 'Portable assembly engineered for repeated events, available from a single unit with multi-unit bulk slabs and 18% GST invoicing.',
      },
    ],
    image: '/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp',
    aliases: ['signage', 'display', 'event-signage', 'promotional-items'],
  },
  {
    slug: 'visiting-cards-printing',
    catalogCategory: 'printing-items',
    name: 'Visiting Cards & Printing',
    h1: 'Custom Business Visiting Card Printing in India',
    title: 'Custom Business Visiting Card Printing India | TeqqnoWorld',
    description:
      'Order custom 300 GSM business visiting card printing online in India. Sharp double-sided 92×52 mm art paper cards from 100 pcs (₹300) down to ₹1/card in bulk.',
    intro:
      'Order custom business visiting card printing online across India on thick 300 GSM smooth white art paper in the standard 92 × 52 mm format. Every pack includes crisp 300 DPI double-sided front and back digital printing, live online artwork preview, and bulk INR slabs from 100 cards (₹300) down to ₹1 per card.',
    gridHeading: 'Custom Business & Visiting Cards',
    guideHeading: '300 GSM Visiting Card Print Specifications & Artwork Guide',
    highlights: [
      {
        title: '300 GSM Smooth White Art Paper',
        detail: 'Stiff, professional-grade white art paper stock trimmed accurately to 92 mm × 52 mm (98 × 58 mm upload canvas with 3 mm bleed).',
      },
      {
        title: 'Double-Sided 300 DPI Digital Print',
        detail: 'Includes front and back full-colour printing for sharp brand logos, contact details, and scannable QR codes.',
      },
      {
        title: 'Packs From 100 Cards & Bulk Slabs',
        detail: 'Start at ₹300 for 100 cards and unlock bulk corporate rates down to ₹1 per card with 18% GST billing.',
      },
    ],
    image: '/assets/aistudio/Premium_300_GSM_Business_Cards__1__cc07b248.webp',
    aliases: ['stationery', 'visiting-cards', 'printing-items'],
  },
  {
    slug: 'custom-caps',
    catalogCategory: 'caps',
    name: 'Custom Cotton Caps',
    h1: 'Custom Logo Cotton Caps — Printing & Embroidery',
    title: 'Custom Logo Caps Wholesale & Printing India | TeqqnoWorld',
    description:
      'Order custom logo caps wholesale in India with embroidery or DTF printing. 100% breathable cotton flexi baseball caps in 6 colours, MOQ 1 pc, from ₹135 bulk.',
    intro:
      'Order custom logo caps wholesale and in single-piece samples across India. Our 100% breathable cotton twill 6-panel flexi baseball caps come in 6 corporate colours with an adjustable free-size buckle strap, front-panel embroidery or DTF logo printing, 1-piece MOQ, and bulk INR slabs starting from ₹135 per cap.',
    gridHeading: 'Custom Cotton Caps Collection',
    guideHeading: 'Custom Baseball Cap Specifications & Branding Guide',
    highlights: [
      {
        title: '100% Breathable Cotton Twill',
        detail: '6-panel mid-profile cotton crown with pre-curved sun visor and adjustable flexi buckle strap for universal free-size comfort.',
      },
      {
        title: '6 Corporate Colour Variants',
        detail: 'Available in Black, Navy Blue, Red, Gray, Yellow, and White with front-panel precision embroidery or DTF logo printing.',
      },
      {
        title: 'MOQ 1 Piece & Wholesale Savings',
        detail: 'Order 1 sample cap at ₹250 or outfit large teams and events with tiered INR rates down to ₹135 per unit.',
      },
    ],
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
      'TeqqnoWorld follows a No Return / Replacement Only policy. Report damaged, cracked, defective, or incorrect products within 24 hours with unboxing video proof.',
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
  '/affiliate-dashboard',
  '/checkout',
  '/orders',
  '/order-action',
];

export const SEO_HOME_META: SeoStaticPageDefinition = {
  path: '/',
  title: 'TeqqnoWorld | Custom T-Shirt Printing & Corporate Gifts India',
  description:
    'Order custom polo T-shirts, cotton caps, ceramic mugs, visiting cards & event displays in India with factory-direct INR pricing and 18% GST invoicing.',
  h1: 'Custom Printing & Corporate Merchandise in India',
  sitemapPriority: '1.0',
  sitemapChangefreq: 'daily',
};

export const SEO_CATALOG_META: SeoStaticPageDefinition = {
  path: '/catalog',
  title: 'All Custom Printed Products & Corporate Merchandise | TeqqnoWorld',
  description:
    'Browse custom printed polo T-shirts, cotton caps, ceramic mugs, 300 GSM visiting cards, standees, promo tables, umbrellas & canopies with bulk INR rates.',
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

export const SEO_AFFILIATE_PROGRAM_META: SeoStaticPageDefinition = {
  path: '/affiliate-program',
  title: 'Affiliate Partner Program | Earn Commission | TeqqnoWorld',
  description:
    'Join the official TeqqnoWorld Affiliate Partner Program for verified customers. Promote admin-enabled custom printing products, track clicks, and earn transparent INR commissions.',
  h1: 'TeqqnoWorld Affiliate Partner Program',
  sitemapPriority: '0.7',
  sitemapChangefreq: 'weekly',
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

// Clean, unique, keyword-aligned on-page H1 titles for all 11 storefront products
export const PRODUCT_H1_MAP: Readonly<Record<string, string>> = {
  'prod-ceramic-mug': 'Custom Printed Ceramic Coffee Mug with Logo (325 ml)',
  'prod-canopy-kiosk': 'Promotional Canopy Tent Kiosk (4×4 ft & 8×8 ft)',
  'prod-rollup-standee': 'Custom Printed 3×6 ft Rollup Standee with Carry Bag',
  'prod-visiting-card-300gsm': 'Premium 300 GSM Double-Sided Visiting Cards',
  'prod-promo-table': 'Portable Promo Table Display Counter with Custom Print',
  'prod-branding-umbrella': '5 Feet Custom Printed Promotional Branding Umbrella',
  'prod-plain-polo': '230 GSM Pure Cotton Plain Polo T-Shirt with Custom Logo',
  'prod-polo-01': '230 GSM 100% Cotton Tipping Polo T-Shirt with Logo',
  'prod-joab-coolmax': 'JOAB Mars COOLMAX 220 GSM Moisture-Wicking Polo T-Shirt',
  'prod-matty-polo': '230 GSM Fine Matty Corporate Polo T-Shirt with Logo',
  'prod-cotton-flexi-caps': 'Custom Printed & Embroidered Cotton Flexi Baseball Caps',
};

export function getProductH1(productId: string, fallbackName: string): string {
  if (PRODUCT_H1_MAP[productId]) {
    return PRODUCT_H1_MAP[productId];
  }
  return fallbackName.split('|')[0].trim();
}

export function getCategoryForProduct(product: {
  id?: string;
  category: string;
  productType?: string;
  name?: string;
}): SeoCategoryDefinition | undefined {
  if (
    product.id === 'prod-cotton-flexi-caps' ||
    product.productType === 'cap' ||
    (product.name && product.name.toLowerCase().includes('cap'))
  ) {
    return findCategoryBySlugOrAlias('custom-caps');
  }
  return findCategoryByCatalogKey(product.category);
}

// Concise, non-truncated, non-cannibalizing SEO titles for each storefront product (<= 65 chars)
export const PRODUCT_SEO_TITLE_MAP: Readonly<Record<string, string>> = {
  'prod-ceramic-mug': 'Custom Printed Ceramic Coffee Mug with Logo (325ml) | TeqqnoWorld',
  'prod-canopy-kiosk': 'Promotional Canopy Tent Kiosk Custom Printing | TeqqnoWorld',
  'prod-rollup-standee': '3x6 Rollup Standee Printing India with Carry Bag | TeqqnoWorld',
  'prod-visiting-card-300gsm': '300 GSM Double-Sided Visiting Cards Online India | TeqqnoWorld',
  'prod-promo-table': 'Portable Promo Table Display Counter Printing India | TeqqnoWorld',
  'prod-branding-umbrella': '5 Feet Promotional Branding Umbrella Custom Print | TeqqnoWorld',
  'prod-plain-polo': '230 GSM Plain Cotton Polo T-Shirt with Logo India | TeqqnoWorld',
  'prod-polo-01': 'Cotton Tipping Polo T-Shirt Custom Logo Printing | TeqqnoWorld',
  'prod-joab-coolmax': 'Moisture-Wicking COOLMAX Polo T-Shirt Custom Logo | TeqqnoWorld',
  'prod-matty-polo': '230 GSM Matty Polo T-Shirt Custom Printing India | TeqqnoWorld',
  'prod-cotton-flexi-caps': 'Custom Embroidered Cotton Baseball Caps India | TeqqnoWorld',
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

// Bespoke, verified meta descriptions for all 11 storefront products (155–160 chars, no auto-truncation)
export const PRODUCT_SEO_DESCRIPTION_MAP: Readonly<Record<string, string>> = {
  'prod-ceramic-mug':
    'Order custom printed 325 ml glossy white ceramic coffee mugs with your company logo in India. Microwave & dishwasher safe, 8.5"×3" wrap print, MOQ 5 pcs, ₹149+.',
  'prod-canopy-kiosk':
    'Buy custom printed promotional canopy tent kiosks in 4×4 ft & 8×8 ft sizes in India. Water-resistant navy blue polyester top, collapsible metal frame, MOQ 1.',
  'prod-rollup-standee':
    'Order 3×6 ft custom rollup standee printing in India with retractable black aluminum stand, HD flex banner & padded nylon carry bag. MOQ 1 unit, bulk INR rates.',
  'prod-visiting-card-300gsm':
    'Print 300 GSM double-sided smooth white art paper visiting cards (92×52 mm) in India. Sharp 300 DPI digital printing from ₹300/100 pcs down to ₹1/card in bulk.',
  'prod-promo-table':
    'Order portable promo table display counters with custom brand graphics in India. 63.2" height, overhead header board, 2-tier shelf & nylon carry bag. MOQ 1.',
  'prod-branding-umbrella':
    'Buy 5 ft wide × 7 ft tall custom printed promotional branding umbrellas in India. UV water-resistant polyester canopy in 4 colours, metal tripod stand, MOQ 1.',
  'prod-plain-polo':
    'Order 230 GSM 100% pure combed cotton plain polo T-shirts with custom logo embroidery or DTF print in India. 16 solid colours, sizes S–4XL, MOQ 2 pcs, ₹450+.',
  'prod-polo-01':
    'Customize 230 GSM 100% pure cotton contrast tipping polo T-shirts with company logo embroidery or DTF print in India. 15 colour combinations, S–4XL, MOQ 2 pcs.',
  'prod-joab-coolmax':
    'Order breathable 220 GSM JOAB Mars COOLMAX moisture-wicking polo T-shirts with custom logo print or embroidery in India. 15 corporate colours, S–3XL, MOQ 2 pcs.',
  'prod-matty-polo':
    'Buy 230 GSM fine matty polo T-shirts with custom logo printing or embroidery for Indian corporate teams. Soft breathable weave, 15 colours, S–4XL, from ₹350.',
  'prod-cotton-flexi-caps':
    'Order 100% breathable cotton twill flexi baseball caps with front-panel custom embroidery or DTF logo print in India. 6 colours, free size, MOQ 1 pc, ₹135+.',
};

// Verified, publicly accessible representative social preview image for each product
export const PRODUCT_SOCIAL_IMAGE_MAP: Readonly<Record<string, string>> = {
  'prod-ceramic-mug': '/assets/aistudio/ceramic_mug_banner_1672x941_dc952a76.webp',
  'prod-canopy-kiosk': '/assets/aistudio/Premium_Canopy_Kiosk_Feature_Banner_6cc78101.png',
  'prod-rollup-standee': '/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp',
  'prod-visiting-card-300gsm': '/assets/aistudio/Premium_300_GSM_Business_Cards__1__cc07b248.webp',
  'prod-promo-table': '/assets/promo-table/promo-table-banner.webp',
  'prod-branding-umbrella': '/assets/umbrella/red-front.webp',
  'prod-plain-polo': '/assets/aistudio/Navy_Blue_T-shirt_Front_View-Photoroom_fcdee5a1.webp',
  'prod-polo-01': '/assets/products/prod_tipping_polo.webp',
  'prod-joab-coolmax': '/assets/aistudio/JOAB_Coolmax_Polo_Shirt_Showcase_0673e0a4.webp',
  'prod-matty-polo': '/assets/aistudio/Premium_Matty_Polo_T-Shirt_Banner_45dae9b5.webp',
  'prod-cotton-flexi-caps': '/assets/aistudio/Cotton_Flexi_Caps_Product_Banner_7057e0bd.webp',
};

export function resolveAbsoluteSocialImageUrl(rawPath?: string): string {
  if (!rawPath) return DEFAULT_OG_IMAGE_URL;
  const trimmed = rawPath.trim();
  if (trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('http://')) return `https://${trimmed.slice(7)}`;
  if (trimmed.startsWith('/')) return `${CANONICAL_ORIGIN}${trimmed}`;
  return DEFAULT_OG_IMAGE_URL;
}

export function getProductSocialImageUrl(productId: string, fallbackPath?: string): string {
  const mappedPath = PRODUCT_SOCIAL_IMAGE_MAP[productId];
  if (mappedPath) {
    return `${CANONICAL_ORIGIN}${mappedPath}`;
  }
  return resolveAbsoluteSocialImageUrl(fallbackPath);
}

export function buildProductSeoDescription(params: {
  productId?: string;
  name: string;
  description: string;
  priceInr: number;
  moq?: number;
}): string {
  if (params.productId && PRODUCT_SEO_DESCRIPTION_MAP[params.productId]) {
    return PRODUCT_SEO_DESCRIPTION_MAP[params.productId];
  }
  const cleanName = params.name.split('|')[0].trim();
  const cleanDesc = params.description.replace(/\s+/g, ' ').trim();
  const priceLabel = `₹${Math.round(params.priceInr).toLocaleString('en-IN')}`;
  const moqPart = params.moq && params.moq > 1 ? ` MOQ ${params.moq} pcs.` : '';
  const prefix = `Order ${cleanName} from ${priceLabel}.${moqPart} `;
  const combined = `${prefix}${cleanDesc}`;
  if (combined.length <= 160) return combined;
  return `${combined.slice(0, 157).replace(/\s+\S*$/, '')}...`;
}
