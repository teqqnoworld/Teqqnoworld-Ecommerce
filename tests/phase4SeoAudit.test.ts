import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PRODUCTS } from '../src/data/mockData.ts';
import {
  SEO_CATEGORIES,
  buildProductSeoTitle,
  buildProductSeoDescription,
  getProductH1,
  getProductPath,
  getCategoryForProduct,
} from '../src/config/seoRoutes.ts';
import {
  PRODUCT_KEYWORD_MAP,
  CATEGORY_KEYWORD_MAP,
  getProductKeywordEntry,
  getCategoryKeywordEntry,
} from '../src/data/seoKeywordMap.ts';
import { buildPageStructuredData } from '../src/config/structuredData.ts';
import {
  resolveSeoPageContext,
  injectSeoIntoHtml,
  buildRobotsTxt,
  buildSitemapXml,
} from '../server/seoMiddleware.ts';
import { buildDynamicProductFeed } from '../server/productFeed.ts';

const FEED_OPTIONS = {
  rootDir: process.cwd(),
  getSupabaseConfig: () => ({ url: '', apiKey: '' }),
};

const BASE_HTML = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');

test('Phase 4 Keyword Map covers all 11 active products and 5 canonical categories with 16 unique non-cannibalizing primary keywords', () => {
  assert.equal(PRODUCTS.length, 11, 'Expected 11 active products in mockData');
  assert.equal(SEO_CATEGORIES.length, 5, 'Expected 5 canonical SEO categories');

  const seenPrimaryKeywords = new Set<string>();
  const seenTitles = new Set<string>();
  const seenDescriptions = new Set<string>();

  for (const product of PRODUCTS) {
    const entry = getProductKeywordEntry(product.id);
    assert.ok(entry, `Missing ProductKeywordEntry for ${product.id}`);
    assert.equal(entry.existingUrl, getProductPath(product.slug), `URL mismatch for ${product.id}`);

    const pk = entry.primaryKeyword.trim().toLowerCase();
    assert.ok(pk.length > 5, `Primary keyword too short for ${product.id}`);
    assert.ok(!seenPrimaryKeywords.has(pk), `Cannibalized primary keyword detected: "${pk}"`);
    seenPrimaryKeywords.add(pk);

    assert.equal(entry.searchVolume, 'Not verified', `Search volume must not be fabricated for ${product.id}`);
    assert.equal(entry.competition, 'Not verified', `Competition must not be fabricated for ${product.id}`);
    assert.equal(entry.keywordDifficulty, 'Not verified', `KD must not be fabricated for ${product.id}`);

    assert.ok(entry.specs.length >= 4, `Product ${product.id} must have >= 4 verified specification rows`);
    assert.ok(entry.faqs.length >= 3, `Product ${product.id} must have >= 3 verified FAQs`);
    assert.ok(entry.businessUses.length >= 4, `Product ${product.id} must have >= 4 business use cases`);
    assert.ok(entry.recommendedRelatedIds.length >= 2, `Product ${product.id} must have >= 2 related IDs`);

    for (const relId of entry.recommendedRelatedIds) {
      assert.notEqual(relId, product.id, `Product ${product.id} must not link to itself`);
      assert.ok(
        PRODUCTS.some((p) => p.id === relId),
        `Broken recommendedRelatedId "${relId}" in ${product.id}`
      );
    }

    const title = buildProductSeoTitle(product.id, product.name);
    const description = buildProductSeoDescription({
      productId: product.id,
      name: product.name,
      description: product.shortDesc || product.description,
      priceInr: product.basePrice,
      moq: product.moq,
    });
    const h1 = getProductH1(product.id, product.name);

    assert.ok(!h1.includes('|'), `H1 must not contain pipe separators: ${h1}`);
    assert.ok(title.length >= 45 && title.length <= 72, `Title length out of healthy range (${title.length}): ${title}`);
    assert.ok(
      description.length >= 130 && description.length <= 168,
      `Description length out of healthy range (${description.length}): ${description}`
    );
    assert.ok(!seenTitles.has(title), `Duplicate product SEO title: ${title}`);
    assert.ok(!seenDescriptions.has(description), `Duplicate product meta description: ${description}`);
    seenTitles.add(title);
    seenDescriptions.add(description);
  }

  for (const cat of SEO_CATEGORIES) {
    const entry = getCategoryKeywordEntry(cat.slug);
    assert.ok(entry, `Missing CategoryKeywordEntry for ${cat.slug}`);
    assert.equal(entry.existingUrl, `/category/${cat.slug}`);

    const pk = entry.primaryKeyword.trim().toLowerCase();
    assert.ok(!seenPrimaryKeywords.has(pk), `Cannibalized primary keyword across category/product: "${pk}"`);
    seenPrimaryKeywords.add(pk);

    assert.equal(entry.searchVolume, 'Not verified');
    assert.equal(entry.competition, 'Not verified');
    assert.equal(entry.keywordDifficulty, 'Not verified');
    assert.ok(entry.buyingGuideParagraphs.length >= 2, `Category ${cat.slug} must have >= 2 buying guide paragraphs`);
    assert.ok(entry.faqs.length >= 3, `Category ${cat.slug} must have >= 3 FAQs`);
    assert.ok(!seenTitles.has(cat.title), `Duplicate category title: ${cat.title}`);
    assert.ok(!seenDescriptions.has(cat.description), `Duplicate category description: ${cat.description}`);
    seenTitles.add(cat.title);
    seenDescriptions.add(cat.description);
  }

  assert.equal(seenPrimaryKeywords.size, 16, 'Expected 16 unique primary keywords (11 products + 5 categories)');
  assert.equal(Object.keys(PRODUCT_KEYWORD_MAP).length, 11);
  assert.equal(Object.keys(CATEGORY_KEYWORD_MAP).length, 5);
});

test('Structured Data (@graph) emits valid unified Product + FAQPage + BreadcrumbList with zero duplicate Product nodes or fake ratings', () => {
  for (const product of PRODUCTS) {
    const cat = getCategoryForProduct(product);
    const title = buildProductSeoTitle(product.id, product.name);
    const desc = buildProductSeoDescription({
      productId: product.id,
      name: product.name,
      description: product.shortDesc || product.description,
      priceInr: product.basePrice,
      moq: product.moq,
    });
    const ld = buildPageStructuredData({
      kind: 'product',
      product: {
        id: product.id,
        slug: product.slug,
        name: product.name,
        category: product.category,
        description: product.shortDesc || product.description,
        basePrice: product.basePrice,
        moq: product.moq,
        imageUrl: product.colors?.[0]?.imageFront,
      },
      title,
      metaDescription: desc,
    });

    assert.ok(ld, `Expected JSON-LD document for ${product.id}`);
    const graph = ld['@graph'] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(graph), `Expected @graph array for ${product.id}`);

    const productNodes = graph.filter((n) => n['@type'] === 'Product');
    assert.equal(productNodes.length, 1, `Expected exactly 1 Product node for ${product.id}`);

    const prodNode = productNodes[0];
    assert.ok(typeof prodNode.material === 'string' && prodNode.material.length > 3, `Missing material on Product schema for ${product.id}`);
    assert.ok(typeof prodNode.color === 'string' && prodNode.color.length > 2, `Missing color on Product schema for ${product.id}`);
    assert.equal(prodNode.aggregateRating, undefined, `Must NOT fabricate aggregateRating when none verified for ${product.id}`);
    assert.equal(prodNode.review, undefined, `Must NOT fabricate reviews for ${product.id}`);

    const faqNodes = graph.filter((n) => n['@type'] === 'FAQPage');
    assert.equal(faqNodes.length, 1, `Expected 1 FAQPage node for ${product.id}`);
    const mainEntity = faqNodes[0].mainEntity as Array<Record<string, unknown>>;
    const kwEntry = getProductKeywordEntry(product.id)!;
    assert.equal(mainEntity.length, kwEntry.faqs.length, `FAQPage count must match visible FAQs 1:1 for ${product.id}`);

    const breadcrumbNodes = graph.filter((n) => n['@type'] === 'BreadcrumbList');
    assert.equal(breadcrumbNodes.length, 1, `Expected 1 BreadcrumbList node for ${product.id}`);
    if (cat) {
      const items = breadcrumbNodes[0].itemListElement as Array<Record<string, unknown>>;
      assert.ok(
        items.some((i) => String(i.item || '').endsWith(`/category/${cat.slug}`)),
        `Breadcrumb must include canonical category /category/${cat.slug}`
      );
    }
  }

  for (const cat of SEO_CATEGORIES) {
    const ld = buildPageStructuredData({
      kind: 'category',
      category: cat,
      products: PRODUCTS.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        category: p.category,
        description: p.shortDesc || p.description,
        basePrice: p.basePrice,
        moq: p.moq,
        imageUrl: p.colors?.[0]?.imageFront,
      })),
    });
    assert.ok(ld, `Expected JSON-LD document for category ${cat.slug}`);
    const graph = ld['@graph'] as Array<Record<string, unknown>>;
    assert.equal(graph.filter((n) => n['@type'] === 'CollectionPage').length, 1);
    assert.equal(graph.filter((n) => n['@type'] === 'FAQPage').length, 1);
  }
});

test('SSR SEO Middleware resolves every product & category with canonical tags, clean imageAlt, and crawlable noscript links', async () => {
  const sampleProduct = PRODUCTS[0];
  const productPath = getProductPath(sampleProduct.slug);
  const ctx = await resolveSeoPageContext(productPath, FEED_OPTIONS);
  assert.equal(ctx.statusCode, 200);
  assert.equal(ctx.canonicalUrl, `https://teqqnoworld.com${productPath}`);
  assert.ok(!ctx.imageAlt.includes('|'), `SSR imageAlt must not have pipe spam: ${ctx.imageAlt}`);
  assert.ok(ctx.noscriptHtml.includes('<h1>'), 'Product noscript must include H1');

  const html = injectSeoIntoHtml(BASE_HTML, ctx);
  assert.ok(html.includes(`<link rel="canonical" href="https://teqqnoworld.com${productPath}"`), 'Canonical missing in SSR HTML');
  assert.ok(html.includes('application/ld+json'), 'JSON-LD missing in SSR HTML');
  assert.ok(html.includes('"@type":"FAQPage"'), 'FAQPage missing in SSR JSON-LD');

  for (const cat of SEO_CATEGORIES) {
    const catCtx = await resolveSeoPageContext(`/category/${cat.slug}`, FEED_OPTIONS);
    assert.equal(catCtx.statusCode, 200);
    assert.equal(catCtx.canonicalUrl, `https://teqqnoworld.com/category/${cat.slug}`);
    assert.ok(
      catCtx.noscriptHtml.includes(cat.h1.replace(/&/g, '&amp;')),
      `Category noscript missing H1 for ${cat.slug}`
    );
  }

  // Private routes must stay noindex
  const adminCtx = await resolveSeoPageContext('/admin', FEED_OPTIONS);
  assert.ok(adminCtx.robots.includes('noindex'), '/admin must remain noindex');
});

test('robots.txt, sitemap.xml, and dynamic product feed preserve all 11 products & 5 categories cleanly', async () => {
  const robots = buildRobotsTxt();
  assert.ok(robots.includes('Sitemap: https://teqqnoworld.com/sitemap.xml'));
  assert.ok(robots.includes('Disallow: /admin'));

  const sitemap = await buildSitemapXml(FEED_OPTIONS);
  for (const product of PRODUCTS) {
    assert.ok(
      sitemap.includes(`<loc>https://teqqnoworld.com${getProductPath(product.slug)}</loc>`),
      `Product missing from sitemap.xml: ${product.slug}`
    );
  }
  for (const cat of SEO_CATEGORIES) {
    assert.ok(
      sitemap.includes(`<loc>https://teqqnoworld.com/category/${cat.slug}</loc>`),
      `Category missing from sitemap.xml: ${cat.slug}`
    );
  }
  assert.ok(!sitemap.includes('|'), 'sitemap.xml image titles must not contain pipe-stuffed product strings');

  const feedItems = await buildDynamicProductFeed(FEED_OPTIONS);
  assert.ok(feedItems.length >= 11, `Expected >= 11 items in dynamic product feed, got ${feedItems.length}`);
});

test('No pipe-stuffed raw product.name ALTs remain in ProductDetailView.tsx', () => {
  const pdv = fs.readFileSync(path.join(process.cwd(), 'src/components/ProductDetailView.tsx'), 'utf8');
  const badAltMatches = pdv.match(/alt=\{`\$\{product\.name\}/g);
  assert.equal(badAltMatches, null, 'Found raw ${product.name} in ProductDetailView alt attributes');
});
