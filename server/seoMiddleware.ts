import type { Express, NextFunction, Request, Response } from 'express';
import {
  buildDynamicProductFeed,
  type ProductFeedItem,
  type ProductFeedOptions,
} from './productFeed.ts';
import {
  CANONICAL_ORIGIN,
  DEFAULT_OG_IMAGE_ALT,
  DEFAULT_OG_IMAGE_URL,
  PRIVATE_NOINDEX_PATHS,
  PRODUCT_ID_TO_CANONICAL_SLUG,
  SEO_AFFILIATE_PROGRAM_META,
  SEO_BULK_META,
  SEO_BUNDLE_BUILDER_META,
  SEO_CATALOG_META,
  SEO_CATEGORIES,
  SEO_HOME_META,
  SEO_LEGAL_PAGES,
  SEO_QUOTE_CALCULATOR_META,
  buildCanonicalUrl,
  buildProductSeoDescription,
  buildProductSeoTitle,
  findCategoryBySlugOrAlias,
  getProductH1,
  getProductSocialImageUrl,
} from '../src/config/seoRoutes.ts';
import {
  JSONLD_SCRIPT_ID,
  buildPageStructuredData,
  serializeJsonLd,
  type JsonLdDocument,
  type StructuredDataProductInput,
} from '../src/config/structuredData.ts';
import { getPublishedReviewAggregateForSeo } from './reviewsRoutes.ts';

// ==============================================================================
// TEQQNOWORLD PHASE 1 SERVER-SIDE SEO ENGINE
// - Dynamic /robots.txt & /sitemap.xml (always canonical https://teqqnoworld.com)
// - Server-side 301 redirects for legacy product IDs, category aliases & slashes
// - Per-route HTML <head> meta/canonical/OG/Twitter/noindex injection
// - Real HTTP 404 Not Found responses for nonexistent routes
// ==============================================================================

const STATIC_ASSET_EXT_REGEX =
  /\.(js|mjs|cjs|ts|tsx|jsx|css|map|png|jpe?g|webp|avif|gif|svg|ico|woff2?|ttf|eot|otf|pdf|mp4|webm|mp3|wav|json|jsonl|csv|xml|txt)$/i;

const INDEX_ROBOTS =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const NOINDEX_ROBOTS = 'noindex, nofollow';

export interface ResolvedSeoPage {
  statusCode: 200 | 404;
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  ogType: 'website' | 'product';
  imageUrl: string;
  imageAlt: string;
  isPrivateNoindex: boolean;
  noscriptHtml: string;
  structuredData: JsonLdDocument | null;
}

function escapeHtmlAttr(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parsePriceAmount(priceStr: string): number {
  const match = String(priceStr || '').match(/([\d.]+)/);
  const val = match ? Number(match[1]) : 0;
  return Number.isFinite(val) ? val : 0;
}

function extractProductSlug(productUrl: string): string {
  try {
    const parsed = new URL(productUrl);
    const match = parsed.pathname.match(/^\/product\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : '';
  } catch {
    return '';
  }
}

function feedItemToStructuredProduct(item: ProductFeedItem): StructuredDataProductInput {
  const verifiedReviewAggregate = getPublishedReviewAggregateForSeo(item.item_id);
  return {
    id: item.item_id,
    slug: extractProductSlug(item.url),
    name: item.title,
    description: item.description,
    category: item.product_category,
    basePrice: parsePriceAmount(item.price),
    imageUrl: item.image_url,
    ...(verifiedReviewAggregate ? { verifiedReviewAggregate } : {}),
  };
}

export function isNonHtmlRoutePath(pathname: string): boolean {
  if (
    pathname.startsWith('/api/') ||
    pathname === '/api' ||
    pathname.startsWith('/feeds/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/@') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/') ||
    pathname === '/health' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return true;
  }
  return STATIC_ASSET_EXT_REGEX.test(pathname);
}

function buildCrawlableNoscript(params: {
  h1: string;
  summary: string;
  products?: ProductFeedItem[];
}): string {
  const categoryLinks = SEO_CATEGORIES.map(
    (c) => `<li><a href="/category/${escapeHtmlAttr(c.slug)}">${escapeHtmlAttr(c.name)}</a></li>`
  ).join('');

  const productLinks = (params.products || [])
    .slice(0, 15)
    .map((p) => {
      const slug = extractProductSlug(p.url);
      if (!slug) return '';
      return `<li><a href="/product/${escapeHtmlAttr(slug)}">${escapeHtmlAttr(getProductH1(p.item_id, p.title))} (${escapeHtmlAttr(p.price)})</a></li>`;
    })
    .filter(Boolean)
    .join('');

  const legalLinks = SEO_LEGAL_PAGES.map(
    (l) => `<li><a href="${escapeHtmlAttr(l.path)}">${escapeHtmlAttr(l.h1)}</a></li>`
  ).join('');

  return `<noscript><main style="max-width:960px;margin:24px auto;padding:16px;font-family:sans-serif;line-height:1.6"><h1>${escapeHtmlAttr(params.h1)}</h1><p>${escapeHtmlAttr(params.summary)}</p><nav aria-label="Primary"><p><a href="/">TeqqnoWorld Home</a> | <a href="/catalog">All Custom Products</a> | <a href="/bulk">Bulk Corporate RFQ</a> | <a href="/contact-us">Contact Us</a></p><ul>${categoryLinks}</ul>${productLinks ? `<ul>${productLinks}</ul>` : ''}<ul>${legalLinks}</ul></nav></main></noscript>`;
}

/**
 * Resolves exact HTTP status code, SEO <head> metadata, canonical URL, and
 * crawlable <noscript> content for any incoming HTML route.
 */
export async function resolveSeoPageContext(
  rawPathname: string,
  options: ProductFeedOptions
): Promise<ResolvedSeoPage> {
  const normalizedPath =
    rawPathname === '/' ? '/' : rawPathname.replace(/\/+$/, '') || '/';

  // 1. Private / Transactional routes (200 OK, strictly noindex, nofollow)
  if (
    PRIVATE_NOINDEX_PATHS.includes(normalizedPath) ||
    normalizedPath.startsWith('/admin/') ||
    normalizedPath.startsWith('/dashboard/') ||
    normalizedPath.startsWith('/affiliate-dashboard/')
  ) {
    const labelMap: Record<string, string> = {
      '/admin': 'Admin Portal | TeqqnoWorld',
      '/dashboard': 'Customer Dashboard | TeqqnoWorld',
      '/affiliate-dashboard': 'Affiliate Partner Dashboard | TeqqnoWorld',
      '/checkout': 'Checkout | TeqqnoWorld',
      '/orders': 'Orders & Tracking | TeqqnoWorld',
      '/order-action': 'Order Confirmation | TeqqnoWorld',
    };
    return {
      statusCode: 200,
      title: labelMap[normalizedPath] || 'Account | TeqqnoWorld',
      description: 'TeqqnoWorld account, partner, and order management portal.',
      canonicalUrl: buildCanonicalUrl(normalizedPath),
      robots: NOINDEX_ROBOTS,
      ogType: 'website',
      imageUrl: DEFAULT_OG_IMAGE_URL,
      imageAlt: 'TeqqnoWorld',
      isPrivateNoindex: true,
      noscriptHtml: '',
      structuredData: buildPageStructuredData({ kind: 'private-or-error' }),
    };
  }

  // 1B. Public Affiliate Credential Verification Page (/affiliate/verify/:code)
  if (normalizedPath.startsWith('/affiliate/verify/')) {
    return {
      statusCode: 200,
      title: 'Affiliate Partner Credential Verification | TeqqnoWorld',
      description: 'Verify an official TeqqnoWorld Affiliate Partner Certificate or Digital ID Card.',
      canonicalUrl: buildCanonicalUrl(normalizedPath),
      robots: NOINDEX_ROBOTS,
      ogType: 'website',
      imageUrl: DEFAULT_OG_IMAGE_URL,
      imageAlt: 'TeqqnoWorld Affiliate Verification',
      isPrivateNoindex: true,
      noscriptHtml: '',
      structuredData: buildPageStructuredData({ kind: 'private-or-error' }),
    };
  }

  // Load live active products (merges mockData + Supabase)
  const activeProducts = await buildDynamicProductFeed(options);
  const structuredProducts = activeProducts
    .map(feedItemToStructuredProduct)
    .filter((p) => Boolean(p.slug));

  // 2. Homepage
  if (normalizedPath === '/') {
    return {
      statusCode: 200,
      title: SEO_HOME_META.title,
      description: SEO_HOME_META.description,
      canonicalUrl: buildCanonicalUrl('/'),
      robots: INDEX_ROBOTS,
      ogType: 'website',
      imageUrl: DEFAULT_OG_IMAGE_URL,
      imageAlt: DEFAULT_OG_IMAGE_ALT,
      isPrivateNoindex: false,
      noscriptHtml: buildCrawlableNoscript({
        h1: SEO_HOME_META.h1,
        summary: SEO_HOME_META.description,
        products: activeProducts,
      }),
      structuredData: buildPageStructuredData({ kind: 'home' }),
    };
  }

  // 3. All Products Catalog
  if (normalizedPath === '/catalog') {
    return {
      statusCode: 200,
      title: SEO_CATALOG_META.title,
      description: SEO_CATALOG_META.description,
      canonicalUrl: buildCanonicalUrl('/catalog'),
      robots: INDEX_ROBOTS,
      ogType: 'website',
      imageUrl: DEFAULT_OG_IMAGE_URL,
      imageAlt: SEO_CATALOG_META.h1,
      isPrivateNoindex: false,
      noscriptHtml: buildCrawlableNoscript({
        h1: SEO_CATALOG_META.h1,
        summary: SEO_CATALOG_META.description,
        products: activeProducts,
      }),
      structuredData: buildPageStructuredData({
        kind: 'catalog',
        products: structuredProducts,
      }),
    };
  }

  // 4. Bulk / Tools routes
  if (normalizedPath === '/bulk') {
    return {
      statusCode: 200,
      title: SEO_BULK_META.title,
      description: SEO_BULK_META.description,
      canonicalUrl: buildCanonicalUrl('/bulk'),
      robots: INDEX_ROBOTS,
      ogType: 'website',
      imageUrl: DEFAULT_OG_IMAGE_URL,
      imageAlt: SEO_BULK_META.h1,
      isPrivateNoindex: false,
      noscriptHtml: buildCrawlableNoscript({
        h1: SEO_BULK_META.h1,
        summary: SEO_BULK_META.description,
      }),
      structuredData: buildPageStructuredData({
        kind: 'static',
        path: '/bulk',
        title: SEO_BULK_META.title,
        description: SEO_BULK_META.description,
        h1: SEO_BULK_META.h1,
      }),
    };
  }

  if (normalizedPath === '/quote-calculator') {
    return {
      statusCode: 200,
      title: SEO_QUOTE_CALCULATOR_META.title,
      description: SEO_QUOTE_CALCULATOR_META.description,
      canonicalUrl: buildCanonicalUrl('/quote-calculator'),
      robots: INDEX_ROBOTS,
      ogType: 'website',
      imageUrl: DEFAULT_OG_IMAGE_URL,
      imageAlt: SEO_QUOTE_CALCULATOR_META.h1,
      isPrivateNoindex: false,
      noscriptHtml: buildCrawlableNoscript({
        h1: SEO_QUOTE_CALCULATOR_META.h1,
        summary: SEO_QUOTE_CALCULATOR_META.description,
      }),
      structuredData: buildPageStructuredData({
        kind: 'static',
        path: '/quote-calculator',
        title: SEO_QUOTE_CALCULATOR_META.title,
        description: SEO_QUOTE_CALCULATOR_META.description,
        h1: SEO_QUOTE_CALCULATOR_META.h1,
      }),
    };
  }

  if (normalizedPath === '/bundle-builder') {
    return {
      statusCode: 200,
      title: SEO_BUNDLE_BUILDER_META.title,
      description: SEO_BUNDLE_BUILDER_META.description,
      canonicalUrl: buildCanonicalUrl('/bundle-builder'),
      robots: INDEX_ROBOTS,
      ogType: 'website',
      imageUrl: DEFAULT_OG_IMAGE_URL,
      imageAlt: SEO_BUNDLE_BUILDER_META.h1,
      isPrivateNoindex: false,
      noscriptHtml: buildCrawlableNoscript({
        h1: SEO_BUNDLE_BUILDER_META.h1,
        summary: SEO_BUNDLE_BUILDER_META.description,
      }),
      structuredData: buildPageStructuredData({
        kind: 'static',
        path: '/bundle-builder',
        title: SEO_BUNDLE_BUILDER_META.title,
        description: SEO_BUNDLE_BUILDER_META.description,
        h1: SEO_BUNDLE_BUILDER_META.h1,
      }),
    };
  }

  if (normalizedPath === '/affiliate-program') {
    return {
      statusCode: 200,
      title: SEO_AFFILIATE_PROGRAM_META.title,
      description: SEO_AFFILIATE_PROGRAM_META.description,
      canonicalUrl: buildCanonicalUrl('/affiliate-program'),
      robots: INDEX_ROBOTS,
      ogType: 'website',
      imageUrl: DEFAULT_OG_IMAGE_URL,
      imageAlt: SEO_AFFILIATE_PROGRAM_META.h1,
      isPrivateNoindex: false,
      noscriptHtml: buildCrawlableNoscript({
        h1: SEO_AFFILIATE_PROGRAM_META.h1,
        summary: SEO_AFFILIATE_PROGRAM_META.description,
      }),
      structuredData: buildPageStructuredData({
        kind: 'static',
        path: '/affiliate-program',
        title: SEO_AFFILIATE_PROGRAM_META.title,
        description: SEO_AFFILIATE_PROGRAM_META.description,
        h1: SEO_AFFILIATE_PROGRAM_META.h1,
      }),
    };
  }

  // 5. Category Landing Pages (/category/<slug>)
  if (normalizedPath.startsWith('/category/')) {
    const slug = decodeURIComponent(normalizedPath.slice('/category/'.length));
    const category = SEO_CATEGORIES.find((c) => c.slug === slug);
    if (category) {
      return {
        statusCode: 200,
        title: category.title,
        description: category.description,
        canonicalUrl: buildCanonicalUrl(`/category/${category.slug}`),
        robots: INDEX_ROBOTS,
        ogType: 'website',
        imageUrl: `${CANONICAL_ORIGIN}${category.image}`,
        imageAlt: category.h1,
        isPrivateNoindex: false,
        noscriptHtml: buildCrawlableNoscript({
          h1: category.h1,
          summary: category.description,
          products: activeProducts,
        }),
        structuredData: buildPageStructuredData({
          kind: 'category',
          category,
          products: structuredProducts,
        }),
      };
    }
  }

  // 6. Product Detail Pages (/product/<slug>)
  if (normalizedPath.startsWith('/product/')) {
    const rawSlug = normalizedPath.slice('/product/'.length);
    let slug = rawSlug;
    try {
      slug = decodeURIComponent(rawSlug);
    } catch {
      // invalid encoding falls through to 404
    }

    const matchedProduct = activeProducts.find((item) => {
      const itemSlug = extractProductSlug(item.url);
      return itemSlug.toLowerCase() === slug.toLowerCase();
    });

    if (matchedProduct) {
      const canonicalSlug = extractProductSlug(matchedProduct.url);
      const priceNum = parsePriceAmount(matchedProduct.price);
      const cleanProductH1 = getProductH1(matchedProduct.item_id, matchedProduct.title);
      const title = buildProductSeoTitle(matchedProduct.item_id, matchedProduct.title);
      const description = buildProductSeoDescription({
        productId: matchedProduct.item_id,
        name: matchedProduct.title,
        description: matchedProduct.description,
        priceInr: priceNum,
      });

      return {
        statusCode: 200,
        title,
        description,
        canonicalUrl: buildCanonicalUrl(`/product/${canonicalSlug}`),
        robots: INDEX_ROBOTS,
        ogType: 'product',
        imageUrl: getProductSocialImageUrl(matchedProduct.item_id, matchedProduct.image_url),
        imageAlt: cleanProductH1,
        isPrivateNoindex: false,
        noscriptHtml: buildCrawlableNoscript({
          h1: cleanProductH1,
          summary: `${matchedProduct.price} — ${matchedProduct.description}`,
          products: activeProducts.filter((p) => p.item_id !== matchedProduct.item_id).slice(0, 6),
        }),
        structuredData: buildPageStructuredData({
          kind: 'product',
          product: feedItemToStructuredProduct(matchedProduct),
          title,
          metaDescription: description,
        }),
      };
    }
  }

  // 7. Legal & Policy Pages
  const legalPage = SEO_LEGAL_PAGES.find((p) => p.path === normalizedPath);
  if (legalPage) {
    return {
      statusCode: 200,
      title: legalPage.title,
      description: legalPage.description,
      canonicalUrl: buildCanonicalUrl(legalPage.path),
      robots: INDEX_ROBOTS,
      ogType: 'website',
      imageUrl: DEFAULT_OG_IMAGE_URL,
      imageAlt: legalPage.h1,
      isPrivateNoindex: false,
      noscriptHtml: buildCrawlableNoscript({
        h1: legalPage.h1,
        summary: legalPage.description,
      }),
      structuredData: buildPageStructuredData({
        kind: 'static',
        path: legalPage.path,
        title: legalPage.title,
        description: legalPage.description,
        h1: legalPage.h1,
      }),
    };
  }

  // 8. Real HTTP 404 Not Found for any unrecognized route
  return {
    statusCode: 404,
    title: 'Page Not Found (404) | TeqqnoWorld',
    description:
      'The requested page could not be found on TeqqnoWorld. Browse our custom printed corporate merchandise and promotional products catalog.',
    canonicalUrl: buildCanonicalUrl(normalizedPath),
    robots: NOINDEX_ROBOTS,
    ogType: 'website',
    imageUrl: DEFAULT_OG_IMAGE_URL,
    imageAlt: 'TeqqnoWorld',
    isPrivateNoindex: true,
    noscriptHtml: buildCrawlableNoscript({
      h1: '404 — Page Not Found',
      summary: 'The page you requested does not exist on TeqqnoWorld. Explore our active product catalog below.',
      products: activeProducts.slice(0, 6),
    }),
    structuredData: buildPageStructuredData({ kind: 'private-or-error' }),
  };
}

/**
 * Injects route-specific SEO tags into index.html cleanly with strict HTML escaping.
 */
export function injectSeoIntoHtml(rawHtml: string, page: ResolvedSeoPage): string {
  const safeTitle = escapeHtmlAttr(page.title);
  const safeDesc = escapeHtmlAttr(page.description);
  const safeRobots = escapeHtmlAttr(page.robots);
  const safeCanonical = escapeHtmlAttr(page.canonicalUrl);
  const safeOgType = escapeHtmlAttr(page.ogType);
  const safeImage = escapeHtmlAttr(page.imageUrl);
  const safeImageAlt = escapeHtmlAttr(page.imageAlt);

  let html = rawHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safeTitle}</title>`);
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${safeDesc}" />`
  );
  html = html.replace(
    /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="robots" content="${safeRobots}" />`
  );
  html = html.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${safeCanonical}" />`
  );
  html = html.replace(
    /<meta\s+property="og:type"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:type" content="${safeOgType}" />`
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${safeTitle}" />`
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${safeDesc}" />`
  );
  html = html.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${safeCanonical}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image" content="${safeImage}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image:alt"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:image:alt" content="${safeImageAlt}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:title" content="${safeTitle}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:description" content="${safeDesc}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:image"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:image" content="${safeImage}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:image:alt"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="twitter:image:alt" content="${safeImageAlt}" />`
  );

  // Inject or remove the single unified JSON-LD script block
  const jsonLdTag = page.structuredData
    ? `<script id="${JSONLD_SCRIPT_ID}" type="application/ld+json">${serializeJsonLd(page.structuredData)}</script>`
    : '';
  const jsonLdRegex = /<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi;
  if (jsonLdRegex.test(html)) {
    let replacedFirst = false;
    html = html.replace(jsonLdRegex, () => {
      if (!replacedFirst) {
        replacedFirst = true;
        return jsonLdTag;
      }
      return '';
    });
  } else if (jsonLdTag) {
    html = html.replace(/<\/head>/i, `    ${jsonLdTag}\n  </head>`);
  }

  if (html.includes('<!--SEO_NOSCRIPT_PLACEHOLDER-->')) {
    html = html.replace('<!--SEO_NOSCRIPT_PLACEHOLDER-->', page.noscriptHtml);
  }
  return html;
}

/**
 * Generates dynamic robots.txt pointing to canonical https://teqqnoworld.com/sitemap.xml.
 */
function buildRobotsTxt(): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Allow: /feeds/',
    'Disallow: /admin',
    'Disallow: /dashboard',
    'Disallow: /affiliate-dashboard',
    'Disallow: /checkout',
    'Disallow: /orders',
    'Disallow: /order-action',
    'Disallow: /api/',
    '',
    `Sitemap: ${CANONICAL_ORIGIN}/sitemap.xml`,
    '',
  ].join('\n');
}

/**
 * Generates dynamic XML sitemap (with Google Image Sitemap namespace) for all
 * indexable public pages and live active products on https://teqqnoworld.com.
 */
async function buildSitemapXml(options: ProductFeedOptions): Promise<string> {
  const products = await buildDynamicProductFeed(options);
  const today = new Date().toISOString().split('T')[0];

  const entries: string[] = [];

  const pushUrl = (
    loc: string,
    changefreq: string,
    priority: string,
    images?: Array<{ loc: string; title: string }>
  ) => {
    const imageXml = (images || [])
      .map(
        (img) =>
          `    <image:image>\n      <image:loc>${escapeXml(img.loc)}</image:loc>\n      <image:title>${escapeXml(img.title)}</image:title>\n    </image:image>`
      )
      .join('\n');

    entries.push(
      [
        '  <url>',
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${today}</lastmod>`,
        `    <changefreq>${changefreq}</changefreq>`,
        `    <priority>${priority}</priority>`,
        imageXml,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n')
    );
  };

  // Core public pages
  pushUrl(buildCanonicalUrl('/'), 'daily', '1.0');
  pushUrl(buildCanonicalUrl('/catalog'), 'daily', '0.9');
  pushUrl(buildCanonicalUrl('/affiliate-program'), 'weekly', '0.7');

  // Category landing pages
  for (const cat of SEO_CATEGORIES) {
    pushUrl(buildCanonicalUrl(`/category/${cat.slug}`), 'weekly', '0.85', [
      { loc: `${CANONICAL_ORIGIN}${cat.image}`, title: cat.h1 },
    ]);
  }

  // Live active products (all 11+ active storefront products)
  for (const product of products) {
    const imgs: Array<{ loc: string; title: string }> = [];
    if (product.image_url) {
      imgs.push({ loc: product.image_url, title: product.title });
    }
    for (const extra of product.additional_image_urls.slice(0, 4)) {
      imgs.push({ loc: extra, title: product.title });
    }
    pushUrl(product.url, 'daily', '0.9', imgs);
  }

  // Secondary commercial & legal pages
  pushUrl(buildCanonicalUrl('/bulk'), 'monthly', '0.7');
  pushUrl(buildCanonicalUrl('/quote-calculator'), 'monthly', '0.6');
  pushUrl(buildCanonicalUrl('/bundle-builder'), 'monthly', '0.6');

  for (const legal of SEO_LEGAL_PAGES) {
    pushUrl(
      buildCanonicalUrl(legal.path),
      legal.sitemapChangefreq || 'monthly',
      legal.sitemapPriority || '0.4'
    );
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * Registers:
 *  0. Canonical host 301 redirect: www.teqqnoworld.com -> https://teqqnoworld.com
 *  1. GET /robots.txt
 *  2. GET /sitemap.xml
 *  3. Server-side 301 redirect middleware for legacy paths, trailing slashes & aliases
 */
export function registerSeoPublicEndpoints(app: Express, options: ProductFeedOptions): void {
  // 0. Canonical host 301 redirect (www.teqqnoworld.com -> https://teqqnoworld.com)
  //    Strictly scoped to www.teqqnoworld.com only; never alters teqqnoworld.in, localhost, or API routes.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    const reqPath = req.path || '/';
    if (reqPath.startsWith('/api/') || reqPath === '/api' || reqPath === '/health') {
      return next();
    }
    const rawForwardedHost = req.headers['x-forwarded-host'];
    const rawHost =
      (typeof rawForwardedHost === 'string' && rawForwardedHost.split(',')[0].trim()) ||
      (typeof req.headers.host === 'string' ? req.headers.host.trim() : '');
    const normalizedHost = rawHost.toLowerCase().replace(/:\d+$/, '');
    if (normalizedHost === 'www.teqqnoworld.com') {
      return res.redirect(301, `${CANONICAL_ORIGIN}${req.originalUrl || '/'}`);
    }
    return next();
  });

  // 1. Dynamic robots.txt
  app.get('/robots.txt', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(buildRobotsTxt());
  });

  // 2. Dynamic XML Sitemap
  app.get('/sitemap.xml', async (_req: Request, res: Response) => {
    try {
      const xml = await buildSitemapXml(options);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.status(200).send(xml);
    } catch (err) {
      console.error('[TeqqnoWorld] Error generating sitemap.xml:', err);
      res.status(500).type('text/plain; charset=utf-8').send('Unable to generate sitemap.');
    }
  });

  // 3. Server-side 301 Redirect Middleware for legacy paths & URL normalization
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    const reqPath = req.path || '/';
    if (isNonHtmlRoutePath(reqPath)) {
      return next();
    }

    const rawSearch = req.originalUrl.includes('?')
      ? req.originalUrl.slice(req.originalUrl.indexOf('?'))
      : '';

    // 3a. Strip trailing slashes on non-root paths (301 permanent)
    if (reqPath.length > 1 && reqPath.endsWith('/')) {
      const stripped = reqPath.replace(/\/+$/, '') || '/';
      return res.redirect(301, `${stripped}${rawSearch}`);
    }

    const lowerPath = reqPath.toLowerCase();

    // 3b. Legacy /products -> /catalog
    if (lowerPath === '/products' || lowerPath === '/shop') {
      return res.redirect(301, `/catalog${rawSearch}`);
    }

    // 3c. Legacy /product/<product-id> -> /product/<canonical-slug>
    if (lowerPath.startsWith('/product/')) {
      const segment = reqPath.slice('/product/'.length);
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // leave raw
      }
      const lowerSeg = decoded.toLowerCase();
      const canonicalSlug = PRODUCT_ID_TO_CANONICAL_SLUG[lowerSeg];
      if (canonicalSlug) {
        return res.redirect(301, `/product/${encodeURIComponent(canonicalSlug)}${rawSearch}`);
      }
      // Normalize uppercase product slug path
      if (reqPath !== lowerPath) {
        return res.redirect(301, `${lowerPath}${rawSearch}`);
      }
    }

    // 3d. Legacy category aliases (/category/apparel -> /category/custom-polo-t-shirts, etc.)
    if (lowerPath.startsWith('/category/')) {
      const segment = reqPath.slice('/category/'.length);
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        // leave raw
      }
      const matchedCat = findCategoryBySlugOrAlias(decoded);
      if (matchedCat && `/category/${matchedCat.slug}` !== reqPath) {
        return res.redirect(301, `/category/${matchedCat.slug}${rawSearch}`);
      }
    }

    // 3e. Normalize uppercase on known static/legal/app paths
    const knownLowerPaths = new Set([
      '/catalog',
      '/bulk',
      '/quote-calculator',
      '/bundle-builder',
      ...PRIVATE_NOINDEX_PATHS,
      ...SEO_LEGAL_PAGES.map((p) => p.path),
    ]);
    if (reqPath !== lowerPath && knownLowerPaths.has(lowerPath)) {
      return res.redirect(301, `${lowerPath}${rawSearch}`);
    }

    return next();
  });
}
