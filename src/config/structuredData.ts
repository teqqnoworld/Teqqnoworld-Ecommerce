// ==============================================================================
// TEQQNOWORLD UNIFIED JSON-LD STRUCTURED DATA ENGINE (PHASE 2 — STEP 4)
// Pure TypeScript module shared by Express SSR (server/seoMiddleware.ts) and
// React SPA (src/App.tsx + src/utils/seoManager.ts).
//
// Strictly sourced from verified project configuration:
//   - BUSINESS_CONFIG (src/config/business.ts)
//   - SEO_CATEGORIES & route definitions (src/config/seoRoutes.ts)
//   - PRODUCT_PRICING_RULES (src/data/pricingRules.ts)
//
// Rules enforced:
//   - Exactly one consistent Organization entity (@id: .../#organization)
//   - Two separate LocalBusiness entities for the two verified Hyderabad addresses
//   - One consistent WebSite entity (@id: .../#website)
//   - Route-matched BreadcrumbList, CollectionPage + ItemList, and Product + Offer
//   - Zero AggregateRating, Review, invented stock/GTIN/MPN, hours, or coordinates
// ==============================================================================

import { BUSINESS_CONFIG } from './business.ts';
import {
  CANONICAL_ORIGIN,
  DEFAULT_OG_IMAGE_URL,
  SEO_CATALOG_META,
  SEO_CATEGORIES,
  SEO_HOME_META,
  buildCanonicalUrl,
  findCategoryBySlugOrAlias,
  getCategoryForProduct,
  getProductH1,
  getProductPath,
  getProductSocialImageUrl,
  type SeoCategoryDefinition,
} from './seoRoutes.ts';
import {
  PRODUCT_PRICING_RULES,
  resolvePricingRuleKey,
  type ProductPricingRule,
} from '../data/pricingRules.ts';

export const JSONLD_SCRIPT_ID = 'teqqnoworld-jsonld';

export const SCHEMA_IDS = {
  organization: `${CANONICAL_ORIGIN}/#organization`,
  logo: `${CANONICAL_ORIGIN}/#logo`,
  bachupallyLocation: `${CANONICAL_ORIGIN}/#bachupally-location`,
  gstPrincipalLocation: `${CANONICAL_ORIGIN}/#gst-principal-location`,
  website: `${CANONICAL_ORIGIN}/#website`,
  returnPolicy: `${CANONICAL_ORIGIN}/#return-policy`,
} as const;

export const RETURN_POLICY_URL = buildCanonicalUrl('/return-replacement-policy');

export const OFFICIAL_LOGO_URL = `${CANONICAL_ORIGIN}/assets/aistudio/Glossy_TeqqnoWorld_Branding_Badge-photoaidcom-cropped_1055f8dc.png`;

export interface JsonLdDocument {
  '@context': 'https://schema.org';
  '@graph': Record<string, unknown>[];
}

export interface StructuredDataProductInput {
  id: string;
  slug: string;
  name: string;
  description: string;
  category?: string;
  productType?: string;
  basePrice?: number;
  moq?: number;
  imageUrl?: string;
  /**
   * Optional explicit stock availability ONLY when backed by real inventory data.
   * Omitted when not verified (never defaulted or invented).
   */
  verifiedAvailability?: 'InStock' | 'OutOfStock' | 'PreOrder' | 'BackOrder';
}

export type StructuredDataPageInput =
  | {
      kind: 'home';
    }
  | {
      kind: 'catalog';
      products: ReadonlyArray<StructuredDataProductInput>;
    }
  | {
      kind: 'category';
      category: SeoCategoryDefinition;
      products: ReadonlyArray<StructuredDataProductInput>;
    }
  | {
      kind: 'product';
      product: StructuredDataProductInput;
      title: string;
      metaDescription: string;
    }
  | {
      kind: 'static';
      path: string;
      title: string;
      description: string;
      h1: string;
      pageType?: 'WebPage' | 'ContactPage';
    }
  | {
      kind: 'private-or-error';
    };

// Deterministic mapping of the 11 verified active storefront product IDs to their
// canonical category slug (ensures 100% SSR == SPA parity even when feed items carry
// Google taxonomy strings instead of internal category keys).
const PRODUCT_ID_TO_CATEGORY_SLUG: Readonly<Record<string, string>> = {
  'prod-ceramic-mug': 'corporate-gifting-drinkware',
  'prod-canopy-kiosk': 'promotional-displays-signage',
  'prod-rollup-standee': 'promotional-displays-signage',
  'prod-visiting-card-300gsm': 'visiting-cards-printing',
  'prod-promo-table': 'promotional-displays-signage',
  'prod-branding-umbrella': 'promotional-displays-signage',
  'prod-plain-polo': 'custom-polo-t-shirts',
  'prod-polo-01': 'custom-polo-t-shirts',
  'prod-joab-coolmax': 'custom-polo-t-shirts',
  'prod-matty-polo': 'custom-polo-t-shirts',
  'prod-cotton-flexi-caps': 'custom-caps',
};

/**
 * Resolves the canonical SeoCategoryDefinition for any product (supports both
 * mockData Product objects and server ProductFeedItem snapshots).
 */
export function resolveSeoCategoryForProduct(
  product: Pick<StructuredDataProductInput, 'id' | 'category' | 'productType' | 'name'>
): SeoCategoryDefinition | undefined {
  const mappedSlug = PRODUCT_ID_TO_CATEGORY_SLUG[product.id];
  if (mappedSlug) {
    return SEO_CATEGORIES.find((c) => c.slug === mappedSlug);
  }

  if (product.category) {
    const direct = getCategoryForProduct({
      id: product.id,
      category: product.category,
      productType: product.productType,
      name: product.name,
    });
    if (direct) return direct;

    // Fallback for Google Product Taxonomy strings from dynamic feed rows
    const lowerTax = product.category.toLowerCase();
    if (lowerTax.includes('hat') || lowerTax.includes('cap')) {
      return findCategoryBySlugOrAlias('custom-caps');
    }
    if (lowerTax.includes('shirt') || lowerTax.includes('polo') || lowerTax.includes('apparel')) {
      return findCategoryBySlugOrAlias('custom-polo-t-shirts');
    }
    if (lowerTax.includes('mug') || lowerTax.includes('drinkware') || lowerTax.includes('gift')) {
      return findCategoryBySlugOrAlias('corporate-gifting-drinkware');
    }
    if (lowerTax.includes('business card') || lowerTax.includes('visiting')) {
      return findCategoryBySlugOrAlias('visiting-cards-printing');
    }
    if (
      lowerTax.includes('display') ||
      lowerTax.includes('signage') ||
      lowerTax.includes('umbrella') ||
      lowerTax.includes('canopy') ||
      lowerTax.includes('standee')
    ) {
      return findCategoryBySlugOrAlias('promotional-displays-signage');
    }
  }

  return undefined;
}

/**
 * Filters a product list strictly to products belonging to the given category slug.
 */
export function filterProductsForCategory<
  T extends Pick<StructuredDataProductInput, 'id' | 'category' | 'productType' | 'name'>,
>(products: ReadonlyArray<T>, categorySlug: string): T[] {
  return products.filter((p) => resolveSeoCategoryForProduct(p)?.slug === categorySlug);
}

function cleanText(input: string): string {
  return String(input || '').replace(/\s+/g, ' ').trim();
}

function formatSchemaPrice(amount: number): string {
  if (!Number.isFinite(amount)) return '0';
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

// ==============================================================================
// CORE BRAND ENTITIES (Organization + 2 Separate LocalBusiness + WebSite)
// ==============================================================================

export function buildOrganizationEntity(): Record<string, unknown> {
  return {
    '@type': 'Organization',
    '@id': SCHEMA_IDS.organization,
    name: BUSINESS_CONFIG.name,
    legalName: BUSINESS_CONFIG.legalName,
    url: `${CANONICAL_ORIGIN}/`,
    logo: {
      '@type': 'ImageObject',
      '@id': SCHEMA_IDS.logo,
      url: OFFICIAL_LOGO_URL,
      contentUrl: OFFICIAL_LOGO_URL,
      caption: BUSINESS_CONFIG.name,
    },
    image: { '@id': SCHEMA_IDS.logo },
    description: BUSINESS_CONFIG.tagline,
    telephone: BUSINESS_CONFIG.contact.phoneRaw,
    email: BUSINESS_CONFIG.contact.secondaryEmail,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: BUSINESS_CONFIG.contact.phoneRaw,
        email: BUSINESS_CONFIG.contact.secondaryEmail,
        contactType: 'customer service',
        areaServed: BUSINESS_CONFIG.address.countryCode,
      },
      {
        '@type': 'ContactPoint',
        telephone: BUSINESS_CONFIG.contact.phoneRaw,
        email: BUSINESS_CONFIG.contact.email,
        contactType: 'customer support',
        areaServed: BUSINESS_CONFIG.address.countryCode,
      },
    ],
    areaServed: {
      '@type': 'Country',
      name: BUSINESS_CONFIG.address.country,
    },
    subOrganization: [
      { '@id': SCHEMA_IDS.bachupallyLocation },
      { '@id': SCHEMA_IDS.gstPrincipalLocation },
    ],
    hasMerchantReturnPolicy: { '@id': SCHEMA_IDS.returnPolicy },
    sameAs: [
      BUSINESS_CONFIG.social.facebook,
      BUSINESS_CONFIG.social.instagram,
      BUSINESS_CONFIG.social.linkedin,
      BUSINESS_CONFIG.social.youtube,
      BUSINESS_CONFIG.social.pinterest,
    ],
  };
}

/**
 * Location A — Existing Bachupally Shop / Office (from BUSINESS_CONFIG.address)
 */
export function buildBachupallyLocationEntity(): Record<string, unknown> {
  return {
    '@type': 'LocalBusiness',
    '@id': SCHEMA_IDS.bachupallyLocation,
    name: `${BUSINESS_CONFIG.name} — Bachupally Office`,
    description: `${BUSINESS_CONFIG.name} shop and office in ${BUSINESS_CONFIG.address.locality}, ${BUSINESS_CONFIG.address.city}, ${BUSINESS_CONFIG.address.state}.`,
    url: `${CANONICAL_ORIGIN}/`,
    image: DEFAULT_OG_IMAGE_URL,
    telephone: BUSINESS_CONFIG.contact.phoneRaw,
    email: BUSINESS_CONFIG.contact.secondaryEmail,
    parentOrganization: { '@id': SCHEMA_IDS.organization },
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${BUSINESS_CONFIG.address.line1}, ${BUSINESS_CONFIG.address.locality}`,
      addressLocality: BUSINESS_CONFIG.address.city,
      addressRegion: BUSINESS_CONFIG.address.state,
      postalCode: BUSINESS_CONFIG.address.pincode,
      addressCountry: BUSINESS_CONFIG.address.countryCode,
    },
  };
}

/**
 * Location B — GST Principal Place of Business (Telangana, GST State Code: 36)
 */
export function buildGstPrincipalLocationEntity(): Record<string, unknown> {
  return {
    '@type': 'LocalBusiness',
    '@id': SCHEMA_IDS.gstPrincipalLocation,
    name: `${BUSINESS_CONFIG.name} — GST Principal Place of Business`,
    description: `GST Principal Place of Business for ${BUSINESS_CONFIG.name} in ${BUSINESS_CONFIG.legal.gstState} (GST State Code: ${BUSINESS_CONFIG.legal.gstStateCode}).`,
    url: `${CANONICAL_ORIGIN}/`,
    image: DEFAULT_OG_IMAGE_URL,
    telephone: BUSINESS_CONFIG.contact.phoneRaw,
    email: BUSINESS_CONFIG.contact.secondaryEmail,
    parentOrganization: { '@id': SCHEMA_IDS.organization },
    address: {
      '@type': 'PostalAddress',
      streetAddress:
        '5th Floor, Plot No-14, Ameenpur Road, Behind HDFC Bank, Suraksha Colony',
      addressLocality: 'Hyderabad, Rangareddy',
      addressRegion: BUSINESS_CONFIG.legal.gstState,
      postalCode: '502032',
      addressCountry: BUSINESS_CONFIG.address.countryCode,
    },
  };
}

export function buildWebSiteEntity(): Record<string, unknown> {
  return {
    '@type': 'WebSite',
    '@id': SCHEMA_IDS.website,
    name: BUSINESS_CONFIG.name,
    url: `${CANONICAL_ORIGIN}/`,
    inLanguage: 'en-IN',
    publisher: { '@id': SCHEMA_IDS.organization },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${CANONICAL_ORIGIN}/catalog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

/**
 * Single canonical MerchantReturnPolicy entity linked via @id from Organization and Product Offers.
 * Truthfully declares MerchantReturnNotPermitted (No Return / Replacement Only for verified
 * damaged, cracked, defective, or incorrect items reported within 24 hours with unboxing video proof).
 * Omits unsupported or misleading fields (no merchantReturnDays, no refundType, no returnFees).
 */
export function buildMerchantReturnPolicyEntity(): Record<string, unknown> {
  return {
    '@type': 'MerchantReturnPolicy',
    '@id': SCHEMA_IDS.returnPolicy,
    name: 'TeqqnoWorld Return and Replacement Policy (No Return / Replacement Only)',
    description:
      'TeqqnoWorld follows a No Return / Replacement Only policy. Returns or refunds for change-of-mind reasons are not permitted. Replacement may be considered for damaged, cracked, broken, defective, or incorrect products reported within 24 hours of receiving the parcel with clear continuous unboxing video proof, subject to verification and applicable consumer protection laws.',
    applicableCountry: BUSINESS_CONFIG.address.countryCode,
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    merchantReturnLink: RETURN_POLICY_URL,
    url: RETURN_POLICY_URL,
  };
}

function buildCoreEntities(): Record<string, unknown>[] {
  return [
    buildOrganizationEntity(),
    buildMerchantReturnPolicyEntity(),
    buildBachupallyLocationEntity(),
    buildGstPrincipalLocationEntity(),
    buildWebSiteEntity(),
  ];
}

// ==============================================================================
// BREADCRUMB, COLLECTION, ITEMLIST & PRODUCT BUILDERS
// ==============================================================================

function buildBreadcrumbListEntity(
  breadcrumbId: string,
  items: ReadonlyArray<{ name: string; url: string }>
): Record<string, unknown> {
  return {
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: items.map((entry, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: entry.name,
      item: entry.url,
    })),
  };
}

function buildItemListEntity(
  itemListId: string,
  listName: string,
  products: ReadonlyArray<StructuredDataProductInput>
): Record<string, unknown> {
  return {
    '@type': 'ItemList',
    '@id': itemListId,
    name: listName,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: buildCanonicalUrl(getProductPath(product.slug)),
      name: getProductH1(product.id, product.name),
    })),
  };
}

function buildUnitPriceSpecifications(rule: ProductPricingRule): Record<string, unknown>[] {
  return rule.slabs.map((slab) => {
    const minVal = Math.max(rule.moq, slab.minQty);
    return {
      '@type': 'UnitPriceSpecification',
      price: formatSchemaPrice(slab.pricePerUnit),
      priceCurrency: 'INR',
      eligibleQuantity: {
        '@type': 'QuantitativeValue',
        minValue: minVal,
        maxValue: slab.maxQty,
        unitText: rule.unitLabel,
      },
    };
  });
}

function buildSingleRuleOffer(
  rule: ProductPricingRule,
  canonicalUrl: string,
  options?: {
    offerName?: string;
    verifiedAvailability?: StructuredDataProductInput['verifiedAvailability'];
  }
): Record<string, unknown> {
  const baseSlab = rule.slabs[0];
  const offer: Record<string, unknown> = {
    '@type': 'Offer',
    url: canonicalUrl,
    priceCurrency: 'INR',
    price: formatSchemaPrice(baseSlab.pricePerUnit),
    seller: { '@id': SCHEMA_IDS.organization },
    hasMerchantReturnPolicy: { '@id': SCHEMA_IDS.returnPolicy },
    eligibleQuantity: {
      '@type': 'QuantitativeValue',
      minValue: rule.moq,
      maxValue: rule.maxQty,
      unitText: rule.unitLabel,
    },
  };

  if (options?.offerName) {
    offer.name = options.offerName;
  }

  if (options?.verifiedAvailability) {
    offer.availability = `https://schema.org/${options.verifiedAvailability}`;
  }

  if (rule.slabs.length > 1) {
    offer.priceSpecification = buildUnitPriceSpecifications(rule);
  }

  return offer;
}

function buildProductOffers(
  product: StructuredDataProductInput,
  canonicalUrl: string
): Record<string, unknown> | undefined {
  // Special case: Canopy Kiosk has two verified size variants (4×4 ft & 8×8 ft)
  if (product.id === 'prod-canopy-kiosk' || product.slug === 'promotional-canopy-kiosk') {
    const rule4x4 = PRODUCT_PRICING_RULES['canopy-4x4'];
    const rule8x8 = PRODUCT_PRICING_RULES['canopy-8x8'];
    const allPrices = [
      ...rule4x4.slabs.map((s) => s.pricePerUnit),
      ...rule8x8.slabs.map((s) => s.pricePerUnit),
    ];
    const lowPrice = Math.min(...allPrices);
    const highPrice = Math.max(...allPrices);

    return {
      '@type': 'AggregateOffer',
      url: canonicalUrl,
      priceCurrency: 'INR',
      lowPrice: formatSchemaPrice(lowPrice),
      highPrice: formatSchemaPrice(highPrice),
      offerCount: 2,
      offers: [
        buildSingleRuleOffer(rule4x4, canonicalUrl, {
          offerName: '4 × 4 ft Promotional Canopy Kiosk',
          verifiedAvailability: product.verifiedAvailability,
        }),
        buildSingleRuleOffer(rule8x8, canonicalUrl, {
          offerName: '8 × 8 ft Promotional Canopy Kiosk',
          verifiedAvailability: product.verifiedAvailability,
        }),
      ],
    };
  }

  // Known storefront products with verified pricingRules.ts entries
  const isKnownStorefrontProduct = Boolean(PRODUCT_ID_TO_CATEGORY_SLUG[product.id]);
  if (isKnownStorefrontProduct) {
    const ruleKey = resolvePricingRuleKey(product.id || product.slug);
    const rule = PRODUCT_PRICING_RULES[ruleKey];
    if (rule && rule.slabs.length > 0) {
      return buildSingleRuleOffer(rule, canonicalUrl, {
        verifiedAvailability: product.verifiedAvailability,
      });
    }
  }

  // Fallback for any future database-added product with a verified positive basePrice
  if (typeof product.basePrice === 'number' && Number.isFinite(product.basePrice) && product.basePrice > 0) {
    const fallbackOffer: Record<string, unknown> = {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'INR',
      price: formatSchemaPrice(product.basePrice),
      seller: { '@id': SCHEMA_IDS.organization },
      hasMerchantReturnPolicy: { '@id': SCHEMA_IDS.returnPolicy },
    };
    if (product.moq && product.moq > 1) {
      fallbackOffer.eligibleQuantity = {
        '@type': 'QuantitativeValue',
        minValue: product.moq,
      };
    }
    if (product.verifiedAvailability) {
      fallbackOffer.availability = `https://schema.org/${product.verifiedAvailability}`;
    }
    return fallbackOffer;
  }

  return undefined;
}

function buildProductEntity(
  product: StructuredDataProductInput,
  canonicalUrl: string,
  category?: SeoCategoryDefinition
): Record<string, unknown> {
  const displayName = getProductH1(product.id, product.name);
  const imageUrl = getProductSocialImageUrl(product.id, product.imageUrl);
  const entity: Record<string, unknown> = {
    '@type': 'Product',
    '@id': `${canonicalUrl}#product`,
    name: displayName,
    description: cleanText(product.description),
    image: [imageUrl],
    url: canonicalUrl,
    sku: product.id.toUpperCase(),
    brand: {
      '@type': 'Brand',
      name: BUSINESS_CONFIG.brandName,
    },
  };

  if (category) {
    entity.category = category.name;
  }

  const offers = buildProductOffers(product, canonicalUrl);
  if (offers) {
    entity.offers = offers;
  }

  return entity;
}

// ==============================================================================
// MAIN PAGE GRAPH BUILDER
// ==============================================================================

/**
 * Generates the single unified JSON-LD `@graph` document for any route.
 * Returns `null` for private (`noindex`) and 404 routes so no commerce schema
 * is emitted on non-indexable pages.
 */
export function buildPageStructuredData(input: StructuredDataPageInput): JsonLdDocument | null {
  if (input.kind === 'private-or-error') {
    return null;
  }

  const graph: Record<string, unknown>[] = [...buildCoreEntities()];

  if (input.kind === 'home') {
    const homeUrl = buildCanonicalUrl('/');
    const breadcrumbId = `${CANONICAL_ORIGIN}/#breadcrumb`;
    graph.push(
      {
        '@type': 'WebPage',
        '@id': `${CANONICAL_ORIGIN}/#webpage`,
        url: homeUrl,
        name: SEO_HOME_META.title,
        description: SEO_HOME_META.description,
        inLanguage: 'en-IN',
        isPartOf: { '@id': SCHEMA_IDS.website },
        about: { '@id': SCHEMA_IDS.organization },
        breadcrumb: { '@id': breadcrumbId },
      },
      buildBreadcrumbListEntity(breadcrumbId, [{ name: 'Home', url: homeUrl }])
    );
    return { '@context': 'https://schema.org', '@graph': graph };
  }

  if (input.kind === 'catalog') {
    const catalogUrl = buildCanonicalUrl('/catalog');
    const breadcrumbId = `${catalogUrl}#breadcrumb`;
    const itemListId = `${catalogUrl}#itemlist`;
    graph.push(
      {
        '@type': 'CollectionPage',
        '@id': `${catalogUrl}#collection`,
        url: catalogUrl,
        name: SEO_CATALOG_META.h1,
        description: SEO_CATALOG_META.description,
        inLanguage: 'en-IN',
        isPartOf: { '@id': SCHEMA_IDS.website },
        about: { '@id': SCHEMA_IDS.organization },
        breadcrumb: { '@id': breadcrumbId },
        mainEntity: { '@id': itemListId },
      },
      buildBreadcrumbListEntity(breadcrumbId, [
        { name: 'Home', url: buildCanonicalUrl('/') },
        { name: 'All Custom Products', url: catalogUrl },
      ]),
      buildItemListEntity(itemListId, SEO_CATALOG_META.h1, input.products)
    );
    return { '@context': 'https://schema.org', '@graph': graph };
  }

  if (input.kind === 'category') {
    const categoryUrl = buildCanonicalUrl(`/category/${input.category.slug}`);
    const breadcrumbId = `${categoryUrl}#breadcrumb`;
    const itemListId = `${categoryUrl}#itemlist`;
    const categoryProducts = filterProductsForCategory(input.products, input.category.slug);

    graph.push(
      {
        '@type': 'CollectionPage',
        '@id': `${categoryUrl}#collection`,
        url: categoryUrl,
        name: input.category.h1,
        description: input.category.description,
        inLanguage: 'en-IN',
        isPartOf: { '@id': SCHEMA_IDS.website },
        about: { '@id': SCHEMA_IDS.organization },
        breadcrumb: { '@id': breadcrumbId },
        mainEntity: { '@id': itemListId },
      },
      buildBreadcrumbListEntity(breadcrumbId, [
        { name: 'Home', url: buildCanonicalUrl('/') },
        { name: input.category.name, url: categoryUrl },
      ]),
      buildItemListEntity(itemListId, input.category.name, categoryProducts)
    );
    return { '@context': 'https://schema.org', '@graph': graph };
  }

  if (input.kind === 'product') {
    const productUrl = buildCanonicalUrl(getProductPath(input.product.slug));
    const breadcrumbId = `${productUrl}#breadcrumb`;
    const productEntityId = `${productUrl}#product`;
    const category = resolveSeoCategoryForProduct(input.product);
    const displayName = getProductH1(input.product.id, input.product.name);

    const breadcrumbItems: Array<{ name: string; url: string }> = [
      { name: 'Home', url: buildCanonicalUrl('/') },
    ];
    if (category) {
      breadcrumbItems.push({
        name: category.name,
        url: buildCanonicalUrl(`/category/${category.slug}`),
      });
    } else {
      breadcrumbItems.push({
        name: 'Catalog',
        url: buildCanonicalUrl('/catalog'),
      });
    }
    breadcrumbItems.push({
      name: displayName,
      url: productUrl,
    });

    graph.push(
      {
        '@type': 'ItemPage',
        '@id': `${productUrl}#webpage`,
        url: productUrl,
        name: input.title,
        description: input.metaDescription,
        inLanguage: 'en-IN',
        isPartOf: { '@id': SCHEMA_IDS.website },
        breadcrumb: { '@id': breadcrumbId },
        mainEntity: { '@id': productEntityId },
      },
      buildBreadcrumbListEntity(breadcrumbId, breadcrumbItems),
      buildProductEntity(input.product, productUrl, category)
    );
    return { '@context': 'https://schema.org', '@graph': graph };
  }

  // Secondary public static / legal pages
  const pageUrl = buildCanonicalUrl(input.path);
  const breadcrumbId = `${pageUrl}#breadcrumb`;
  const pageType =
    input.pageType || (input.path === '/contact-us' ? 'ContactPage' : 'WebPage');

  const webPageNode: Record<string, unknown> = {
    '@type': pageType,
    '@id': `${pageUrl}#webpage`,
    url: pageUrl,
    name: input.title,
    description: input.description,
    inLanguage: 'en-IN',
    isPartOf: { '@id': SCHEMA_IDS.website },
    about: { '@id': SCHEMA_IDS.organization },
    breadcrumb: { '@id': breadcrumbId },
  };

  if (input.path === '/return-replacement-policy') {
    webPageNode.mainEntity = { '@id': SCHEMA_IDS.returnPolicy };
  }

  graph.push(
    webPageNode,
    buildBreadcrumbListEntity(breadcrumbId, [
      { name: 'Home', url: buildCanonicalUrl('/') },
      { name: input.h1, url: pageUrl },
    ])
  );
  return { '@context': 'https://schema.org', '@graph': graph };
}

/**
 * Safely serializes JSON-LD for embedding inside a `<script type="application/ld+json">` tag.
 * Escapes `<`, `\u2028`, and `\u2029` so script closing sequences can never break HTML parsing.
 */
export function serializeJsonLd(doc: JsonLdDocument): string {
  return JSON.stringify(doc)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
