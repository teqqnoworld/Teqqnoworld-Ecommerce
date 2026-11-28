// ==============================================================================
// TEQQNOWORLD PHASE 6 — CONTENT SEO & TOPICAL AUTHORITY AUTOMATED TEST SUITE
//
// Verifies:
// 1. Strict Draft Policy (zero auto-published articles)
// 2. Admin Authorization (401 without valid Admin session)
// 3. Full Blog CRUD, publish/unpublish, safe scheduled publication, delete
// 4. Category CRUD & in-use delete protection
// 5. Slug-change HTTP 301 redirect tracking, chain collapse & loop prevention
// 6. SSR metadata, og:type="article", HTTP 200/404/301, canonical & single H1
// 7. Structured Data (BlogPosting + BreadcrumbList + conditional FAQPage)
// 8. Sitemap published-only inclusion (never leaks drafts/scheduled posts)
// 9. Featured image upload security (MIME + magic bytes + size cap + SVG block)
// 10. XSS & URL protocol safety (blocks javascript:, data:, vbscript:, //evil)
// 11. Editorial Calendar, Topical Authority & Zero Phase 4 Keyword Cannibalization
// 12. Phase 6 Content Analytics events & Admin Content Performance aggregation
// 13. Static SQL migration audit (RLS, search_path, additive/idempotent)
// ==============================================================================

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import express from 'express';

import {
  BlogStore,
  isPostPubliclyVisible,
  sanitizePublicUrl,
  saveValidatedBlogImage,
} from '../server/blogEngine.ts';
import { createBlogRouter } from '../server/blogRoutes.ts';
import { createSeoAnalyticsRouter } from '../server/seoAnalyticsRoutes.ts';
import {
  buildSitemapXml,
  injectSeoIntoHtml,
  registerSeoPublicEndpoints,
  resolveSeoPageContext,
} from '../server/seoMiddleware.ts';
import { isSafeArticleHref } from '../src/components/blog/SafeArticleRenderer.tsx';
import {
  INITIAL_DRAFT_BLOG_TEMPLATES,
  NINETY_DAY_EDITORIAL_CALENDAR,
  TOPICAL_AUTHORITY_CLUSTERS,
} from '../src/data/contentEditorialCalendar.ts';
import {
  CATEGORY_KEYWORD_MAP,
  PRODUCT_KEYWORD_MAP,
} from '../src/data/seoKeywordMap.ts';
import { PRODUCTS } from '../src/data/mockData.ts';
import { SEO_CATEGORIES } from '../src/config/seoRoutes.ts';
import type { BlogPost } from '../src/types/blog.ts';

const VALID_ADMIN_TOKEN = 'test-phase6-admin-session-token';

// Minimal valid 1x1 PNG binary (authentic PNG signature + IHDR + IDAT + IEND)
const VALID_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// Minimal valid RIFF....WEBP header (> 16 bytes)
function makeFakeValidWebpBuffer(): Buffer {
  const buf = Buffer.alloc(32);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(24, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8 ', 12, 'ascii');
  return buf;
}

describe('Phase 6 — Content SEO, Blog CMS, Security & Content Analytics', () => {
  let tmpDir: string;
  let blogStorePath: string;
  let analyticsStorePath: string;
  let uploadDir: string;
  let blogStore: BlogStore;
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'teqqno-phase6-'));
    blogStorePath = path.join(tmpDir, 'blog-cms-store.json');
    analyticsStorePath = path.join(tmpDir, 'seo-analytics-store.json');
    uploadDir = path.join(tmpDir, 'uploads');

    blogStore = new BlogStore(
      { uploadDir },
      blogStorePath
    );

    const app = express();
    app.use(express.json({ limit: '6mb' }));

    const verifyAdminRequest = (req: express.Request) => {
      const auth = req.headers.authorization || '';
      if (auth === `Bearer ${VALID_ADMIN_TOKEN}`) {
        return { valid: true, email: 'admin@teqqnoworld.com' };
      }
      return { valid: false };
    };

    const blogSystem = createBlogRouter({
      verifyAdminRequest,
      uploadDir,
      sharedStore: blogStore,
    });

    const analyticsSystem = createSeoAnalyticsRouter({
      rootDir: process.cwd(),
      getSupabaseAdminConfig: () => ({ configured: false, url: '', serviceRoleKey: '' }),
      buildSupabaseAdminHeaders: () => ({}),
      verifyAdminRequest,
      localStoreOverridePath: analyticsStorePath,
      blogStore,
    });

    registerSeoPublicEndpoints(app, {
      rootDir: process.cwd(),
      getSupabaseConfig: () => ({ url: '', apiKey: '' }),
      blogStore,
    });

    app.use('/api', blogSystem.router);
    app.use('/api', analyticsSystem.router);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        assert(addr && typeof addr === 'object');
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (tmpDir && fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('1. Strict Draft Policy: seeded starter templates remain draft and are NEVER publicly exposed', async () => {
    assert.ok(INITIAL_DRAFT_BLOG_TEMPLATES.length >= 3);
    for (const tpl of INITIAL_DRAFT_BLOG_TEMPLATES) {
      assert.equal(tpl.status, 'draft');
      assert.equal(tpl.publishedAt, null);
    }

    const publicRes = await fetch(`${baseUrl}/api/blogs`);
    assert.equal(publicRes.status, 200);
    const publicJson: any = await publicRes.json();
    assert.equal(publicJson.success, true);
    assert.equal(publicJson.posts.length, 0, 'No draft articles may leak on public /api/blogs');

    const firstDraftSlug = INITIAL_DRAFT_BLOG_TEMPLATES[0].slug;
    const draftLookup = await fetch(`${baseUrl}/api/blogs/${firstDraftSlug}`);
    assert.equal(draftLookup.status, 404, 'Draft slug must return HTTP 404 publicly');
  });

  it('2. Admin Authorization: unauthenticated requests to /api/admin/blogs* return HTTP 401', async () => {
    const endpoints: Array<{ method: string; path: string; body?: unknown }> = [
      { method: 'GET', path: '/api/admin/blogs' },
      { method: 'POST', path: '/api/admin/blogs', body: { title: 'Unauth' } },
      { method: 'PUT', path: '/api/admin/blogs/any-id', body: { title: 'Unauth' } },
      { method: 'PATCH', path: '/api/admin/blogs/any-id/status', body: { status: 'published' } },
      { method: 'DELETE', path: '/api/admin/blogs/any-id' },
      { method: 'POST', path: '/api/admin/blogs/categories', body: { name: 'Hack' } },
      { method: 'POST', path: '/api/admin/blogs/upload-image', body: {} },
    ];

    for (const ep of endpoints) {
      const res = await fetch(`${baseUrl}${ep.path}`, {
        method: ep.method,
        headers: { 'Content-Type': 'application/json' },
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      assert.equal(res.status, 401, `${ep.method} ${ep.path} must require admin auth`);
    }
  });

  it('3. Full Blog CRUD, publish/unpublish, safe scheduled publication, and delete', async () => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VALID_ADMIN_TOKEN}`,
    };

    // Create draft
    const createRes = await fetch(`${baseUrl}/api/admin/blogs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Custom Polo Fabric Guide for Indian Corporate Teams',
        slug: 'custom-polo-fabric-guide-test',
        excerpt: 'Compare 230 GSM pure combed cotton pique, 220 GSM Coolmax, and 230 GSM fine matty.',
        content:
          '## Comparing Verified Polo Fabrics\n\nChoose between [230 GSM Plain Polo](/product/customized-plain-polo-t-shirt) and [JOAB Coolmax Polo](/product/joab-coolmax-polo-t-shirt).\n\n### Practical Bulk Advice\n\n- Check MOQ starting from 2 pieces\n- Request digital proofs before production',
        contentKind: 'guide',
        status: 'draft',
        featured: true,
        categorySlug: 'buying-guides',
        tags: ['corporate polo', 'bulk t-shirts'],
        featuredImageUrl: '/assets/polo-plain-black.png',
        featuredImageAlt: 'Custom printed 230 GSM corporate polo t-shirt by TeqqnoWorld',
        authorName: 'TeqqnoWorld Editorial Desk',
        seoTitle: 'Custom Polo Fabric Guide for Indian Corporate Teams | TeqqnoWorld',
        metaDescription:
          'Compare 230 GSM pure combed cotton, 220 GSM Coolmax, and 230 GSM fine matty custom corporate polo fabrics available at TeqqnoWorld India.',
        focusKeyword: 'corporate polo fabric comparison india',
        relatedCategorySlug: 'corporate-apparel',
        relatedProductIds: ['prod-plain-polo', 'prod-joab-coolmax'],
        faqs: [
          {
            question: 'What is the minimum order quantity for custom polo t-shirts?',
            answer: 'TeqqnoWorld custom polo t-shirts start at an MOQ of 2 pieces with bulk tiers available.',
          },
        ],
      }),
    });
    assert.equal(createRes.status, 201);
    const created: any = await createRes.json();
    const postId: string = created.post.id;
    assert.equal(created.post.status, 'draft');

    // Draft must remain 404 publicly
    assert.equal((await fetch(`${baseUrl}/api/blogs/custom-polo-fabric-guide-test`)).status, 404);

    // Schedule for future -> must STILL remain 404 publicly
    const futureIso = new Date(Date.now() + 86_400_000).toISOString();
    const schedFutureRes = await fetch(`${baseUrl}/api/admin/blogs/${postId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'scheduled', scheduledAt: futureIso }),
    });
    assert.equal(schedFutureRes.status, 200);
    assert.equal(
      (await fetch(`${baseUrl}/api/blogs/custom-polo-fabric-guide-test`)).status,
      404,
      'Future scheduled post must NOT be visible publicly'
    );

    // Publish -> becomes visible publicly (HTTP 200)
    const pubRes = await fetch(`${baseUrl}/api/admin/blogs/${postId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'published' }),
    });
    assert.equal(pubRes.status, 200);

    const liveGet = await fetch(`${baseUrl}/api/blogs/custom-polo-fabric-guide-test`);
    assert.equal(liveGet.status, 200);
    const liveJson: any = await liveGet.json();
    assert.equal(liveJson.post.slug, 'custom-polo-fabric-guide-test');
    assert.equal(liveJson.post.faqs.length, 1);

    // Bidirectional product lookup returns this published guide
    const byProdRes = await fetch(`${baseUrl}/api/blogs/by-product/prod-plain-polo`);
    assert.equal(byProdRes.status, 200);
    const byProdJson: any = await byProdRes.json();
    assert.ok(byProdJson.posts.some((p: BlogPost) => p.id === postId));

    // Unpublish -> returns 404 publicly again
    const unpubRes = await fetch(`${baseUrl}/api/admin/blogs/${postId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'draft' }),
    });
    assert.equal(unpubRes.status, 200);
    assert.equal((await fetch(`${baseUrl}/api/blogs/custom-polo-fabric-guide-test`)).status, 404);

    // Scheduled in the past -> visible publicly
    const pastIso = new Date(Date.now() - 60_000).toISOString();
    const schedPastRes = await fetch(`${baseUrl}/api/admin/blogs/${postId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'scheduled', scheduledAt: pastIso }),
    });
    assert.equal(schedPastRes.status, 200);
    assert.equal((await fetch(`${baseUrl}/api/blogs/custom-polo-fabric-guide-test`)).status, 200);

    // Re-publish so subsequent SSR/Sitemap/Redirect tests have a live published article
    await fetch(`${baseUrl}/api/admin/blogs/${postId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ status: 'published' }),
    });

    // Verify helper directly
    assert.equal(
      isPostPubliclyVisible({
        ...liveJson.post,
        status: 'scheduled',
        scheduledAt: futureIso,
      }),
      false
    );
  });

  it('4. Category CRUD & protection against deleting a category still used by posts', async () => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VALID_ADMIN_TOKEN}`,
    };

    const createCat = await fetch(`${baseUrl}/api/admin/blogs/categories`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Exhibition Playbooks',
        slug: 'exhibition-playbooks',
        description: 'Guides for Indian trade shows and dealer meets.',
      }),
    });
    assert.equal(createCat.status, 200);
    const createdCatJson: any = await createCat.json();
    assert.ok(createdCatJson.category?.id);

    // Fetch categories to get the id of 'buying-guides'
    const invRes = await fetch(`${baseUrl}/api/admin/blogs`, { headers: authHeaders });
    const invJson: any = await invRes.json();
    const buyingGuidesCat = invJson.categories.find((c: any) => c.slug === 'buying-guides');
    assert.ok(buyingGuidesCat?.id);

    // Cannot delete default 'buying-guides' because posts reference it
    const blockedDel = await fetch(
      `${baseUrl}/api/admin/blogs/categories/${buyingGuidesCat.id}`,
      {
        method: 'DELETE',
        headers: authHeaders,
      }
    );
    assert.equal(blockedDel.status, 400);

    // Can delete unused 'exhibition-playbooks' by id
    const okDel = await fetch(
      `${baseUrl}/api/admin/blogs/categories/${createdCatJson.category.id}`,
      {
        method: 'DELETE',
        headers: authHeaders,
      }
    );
    assert.equal(okDel.status, 200);
  });

  it('5. Slug Change 301 Redirect Tracking, Chain Collapse & SSR Verification', async () => {
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${VALID_ADMIN_TOKEN}`,
    };

    // Find our published test post
    const listRes = await fetch(`${baseUrl}/api/admin/blogs`, { headers: authHeaders });
    const listJson: any = await listRes.json();
    const target = listJson.posts.find((p: BlogPost) => p.slug === 'custom-polo-fabric-guide-test');
    assert.ok(target);

    // Rename slug A -> B -> C to test chain collapsing
    const rename1 = await fetch(`${baseUrl}/api/admin/blogs/${target.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ slug: 'polo-fabric-guide-v2' }),
    });
    assert.equal(rename1.status, 200);

    const rename2 = await fetch(`${baseUrl}/api/admin/blogs/${target.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ slug: 'corporate-polo-fabric-comparison-india' }),
    });
    assert.equal(rename2.status, 200);

    // Old slug A and B should return real HTTP 301 directly to final slug C via Express SEO middleware
    const resOldA = await fetch(`${baseUrl}/blogs/custom-polo-fabric-guide-test`, {
      redirect: 'manual',
    });
    assert.equal(resOldA.status, 301);
    assert.equal(resOldA.headers.get('location'), '/blogs/corporate-polo-fabric-comparison-india');

    const resOldB = await fetch(`${baseUrl}/blogs/polo-fabric-guide-v2`, {
      redirect: 'manual',
    });
    assert.equal(resOldB.status, 301);
    assert.equal(resOldB.headers.get('location'), '/blogs/corporate-polo-fabric-comparison-india');

    // Legacy /blog redirects 301 to /blogs
    const resLegacyBlog = await fetch(`${baseUrl}/blog`, { redirect: 'manual' });
    assert.equal(resLegacyBlog.status, 301);
    assert.equal(resLegacyBlog.headers.get('location'), '/blogs');
  });

  it('6. Published Article SSR, Canonical, Single H1 & Conditional Structured Data (BlogPosting + BreadcrumbList + FAQPage)', async () => {
    const seoOpts = {
      rootDir: process.cwd(),
      getSupabaseConfig: () => ({ url: '', apiKey: '' }),
      blogStore,
    };
    const ssrPub = await resolveSeoPageContext(
      '/blogs/corporate-polo-fabric-comparison-india',
      seoOpts
    );
    assert.equal(ssrPub.statusCode, 200);
    assert.equal(ssrPub.ogType, 'article');
    assert.equal(
      ssrPub.canonicalUrl,
      'https://teqqnoworld.com/blogs/corporate-polo-fabric-comparison-india'
    );

    const graph = (ssrPub.structuredData as any)['@graph'] as Array<Record<string, unknown>>;
    const types = graph.map((n) => n['@type']);
    assert.ok(types.includes('BlogPosting'), 'Published article must include BlogPosting schema');
    assert.ok(types.includes('BreadcrumbList'), 'Published article must include BreadcrumbList schema');
    assert.ok(
      types.includes('FAQPage'),
      'Published article WITH visible FAQs must include FAQPage schema'
    );

    // Inject into real index.html shell and verify SSR head tags + single H1
    const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const html = injectSeoIntoHtml(indexHtml, ssrPub);
    assert.ok(html.includes('property="og:type" content="article"'));
    assert.ok(
      html.includes('href="https://teqqnoworld.com/blogs/corporate-polo-fabric-comparison-india"')
    );
    const h1Matches = html.match(/<h1[^>]*>/g) || [];
    assert.equal(h1Matches.length, 1, 'SSR noscript article must have exactly one H1');

    // Create a second published article WITHOUT FAQs -> FAQPage must NOT be emitted
    const noFaqPost = await blogStore.createPost({
      title: 'Visiting Card Bleed & Trim Margin Checklist',
      slug: 'visiting-card-bleed-checklist-no-faq',
      excerpt: '3 mm bleed and 92 x 52 mm trim guide for 300 GSM visiting cards.',
      content: '## Print-Ready Bleed Rules\n\nKeep important text inside the safe zone.',
      status: 'published',
      categorySlug: 'printing-tips',
      relatedProductIds: ['prod-visiting-card-300gsm'],
      faqs: [],
    });

    const ssrNoFaq = await resolveSeoPageContext(`/blogs/${noFaqPost.slug}`, seoOpts);
    assert.equal(ssrNoFaq.statusCode, 200);
    const noFaqTypes = ((ssrNoFaq.structuredData as any)['@graph'] as Array<Record<string, unknown>>).map(
      (n) => n['@type']
    );
    assert.ok(noFaqTypes.includes('BlogPosting'));
    assert.ok(
      !noFaqTypes.includes('FAQPage'),
      'Article without visible FAQs MUST NOT emit empty/ineligible FAQPage schema'
    );

    // Draft & missing slugs must return HTTP 404 + noindex, nofollow
    const ssrDraft = await resolveSeoPageContext(
      `/blogs/${INITIAL_DRAFT_BLOG_TEMPLATES[0].slug}`,
      seoOpts
    );
    assert.equal(ssrDraft.statusCode, 404);
    assert.equal(ssrDraft.robots, 'noindex, nofollow');

    const ssrMissing = await resolveSeoPageContext('/blogs/does-not-exist-xyz', seoOpts);
    assert.equal(ssrMissing.statusCode, 404);
    assert.equal(ssrMissing.robots, 'noindex, nofollow');

    // Hub routes /blogs, /guides, /resources return HTTP 200 with CollectionPage/Blog
    for (const hub of ['/blogs', '/guides', '/resources']) {
      const ssrHub = await resolveSeoPageContext(hub, seoOpts);
      assert.equal(ssrHub.statusCode, 200, `${hub} must return HTTP 200`);
      assert.equal(ssrHub.canonicalUrl, `https://teqqnoworld.com${hub}`);
    }
  });

  it('7. XML Sitemap includes /blogs, /guides, /resources and ONLY published posts (never drafts)', async () => {
    const xml = await buildSitemapXml({
      rootDir: process.cwd(),
      getSupabaseConfig: () => ({ url: '', apiKey: '' }),
      blogStore,
    });
    assert.ok(xml.includes('<loc>https://teqqnoworld.com/blogs</loc>'));
    assert.ok(xml.includes('<loc>https://teqqnoworld.com/guides</loc>'));
    assert.ok(xml.includes('<loc>https://teqqnoworld.com/resources</loc>'));
    assert.ok(
      xml.includes('<loc>https://teqqnoworld.com/blogs/corporate-polo-fabric-comparison-india</loc>')
    );
    for (const draftTpl of INITIAL_DRAFT_BLOG_TEMPLATES) {
      assert.ok(
        !xml.includes(draftTpl.slug),
        `Draft slug ${draftTpl.slug} MUST NEVER appear in sitemap.xml`
      );
    }
  });

  it('8. Featured Image Upload Security: magic-byte verification, SVG rejection & 3 MB cap', () => {
    // Valid PNG succeeds
    const pngRes = saveValidatedBlogImage({
      originalFilename: 'polo-guide.png',
      declaredMime: 'image/png',
      dataUrlOrBase64: VALID_PNG_BASE64,
      uploadDir,
    });
    assert.ok(pngRes.url.startsWith('/assets/blog/'));
    assert.ok(fs.existsSync(path.join(uploadDir, path.basename(pngRes.url))));

    // Valid WebP succeeds
    const webpRes = saveValidatedBlogImage({
      originalFilename: 'banner.webp',
      declaredMime: 'image/webp',
      dataUrlOrBase64: makeFakeValidWebpBuffer().toString('base64'),
      uploadDir,
    });
    assert.ok(webpRes.url.endsWith('.webp'));

    // SVG disguised as PNG must be rejected by magic-byte check
    assert.throws(() => {
      saveValidatedBlogImage({
        originalFilename: 'evil.png',
        declaredMime: 'image/png',
        dataUrlOrBase64: Buffer.from('<svg onload="alert(1)"></svg>').toString('base64'),
        uploadDir,
      });
    }, /signature|verification|binary/i);

    // Unsupported SVG MIME must be rejected
    assert.throws(() => {
      saveValidatedBlogImage({
        originalFilename: 'evil.svg',
        declaredMime: 'image/svg+xml',
        dataUrlOrBase64: Buffer.from('<svg></svg>').toString('base64'),
        uploadDir,
      });
    }, /Unsupported/i);

    // Payload > 3 MB must be rejected
    assert.throws(() => {
      const oversize = Buffer.concat([
        Buffer.from(VALID_PNG_BASE64, 'base64'),
        Buffer.alloc(3 * 1024 * 1024 + 100),
      ]);
      saveValidatedBlogImage({
        originalFilename: 'huge.png',
        declaredMime: 'image/png',
        dataUrlOrBase64: oversize.toString('base64'),
        uploadDir,
      });
    }, /3 MB/i);
  });

  it('9. XSS & URL Protocol Safety blocks javascript:, data:, vbscript: and protocol-relative URLs', () => {
    assert.equal(isSafeArticleHref('/product/customized-plain-polo-t-shirt'), true);
    assert.equal(isSafeArticleHref('https://teqqnoworld.com/blogs'), true);
    assert.equal(isSafeArticleHref('javascript:alert(1)'), false);
    assert.equal(isSafeArticleHref('data:text/html,<script>alert(1)</script>'), false);
    assert.equal(isSafeArticleHref('vbscript:msgbox(1)'), false);
    assert.equal(isSafeArticleHref('//evil.example/phish'), false);

    assert.equal(sanitizePublicUrl('javascript:alert(1)'), '');
    assert.equal(sanitizePublicUrl('/assets/blog/test.webp'), '/assets/blog/test.webp');
  });

  it('10. Editorial Calendar & Topical Clusters: valid inventory links, honest "Not verified" volume, ZERO Phase 4 cannibalization', () => {
    const productIds = new Set(PRODUCTS.map((p) => p.id));
    const categorySlugs = new Set(SEO_CATEGORIES.map((c) => c.slug));

    const phase4PrimaryKeywords = new Set([
      ...Object.values(PRODUCT_KEYWORD_MAP).map((e) => e.primaryKeyword.toLowerCase().trim()),
      ...Object.values(CATEGORY_KEYWORD_MAP).map((e) => e.primaryKeyword.toLowerCase().trim()),
    ]);

    // Every active product must be represented in at least one topical cluster
    const clusteredProductIds = new Set<string>();
    for (const cluster of TOPICAL_AUTHORITY_CLUSTERS) {
      assert.ok(categorySlugs.has(cluster.targetCategorySlug), `Invalid cluster category: ${cluster.targetCategorySlug}`);
      for (const pid of cluster.targetProductIds) {
        assert.ok(productIds.has(pid), `Unknown product in cluster ${cluster.id}: ${pid}`);
        clusteredProductIds.add(pid);
      }
    }
    for (const p of PRODUCTS) {
      assert.ok(
        clusteredProductIds.has(p.id),
        `Active product ${p.id} must be covered in Topical Authority Clusters`
      );
    }

    assert.ok(NINETY_DAY_EDITORIAL_CALENDAR.length >= 15);
    const seenSlugs = new Set<string>();
    for (const item of NINETY_DAY_EDITORIAL_CALENDAR) {
      assert.equal(item.searchVolume, 'Not verified');
      assert.equal(item.keywordDifficulty, 'Not verified');
      assert.ok(!seenSlugs.has(item.slug), `Duplicate calendar slug: ${item.slug}`);
      seenSlugs.add(item.slug);

      assert.ok(
        !phase4PrimaryKeywords.has(item.primaryKeyword.toLowerCase().trim()),
        `Cannibalization detected: editorial keyword "${item.primaryKeyword}" duplicates a Phase 4 primary keyword`
      );

      assert.ok(categorySlugs.has(item.relatedCategorySlug));
      for (const pid of item.relatedProductIds) {
        assert.ok(productIds.has(pid), `Unknown product ${pid} in calendar item ${item.slug}`);
      }
      for (const link of item.suggestedInternalLinks) {
        assert.ok(link.href.startsWith('/'), `Internal link must be root-relative: ${link.href}`);
      }
    }
  });

  it('11. Content Analytics Events & Admin Content Performance Dashboard Aggregation', async () => {
    const sessionId = 'sess_phase6_test_01';
    const articlePath = '/blogs/corporate-polo-fabric-comparison-india';

    const events = [
      {
        eventName: 'blog_view',
        sessionId,
        channel: 'organic_search',
        landingPath: articlePath,
        pagePath: articlePath,
        pageTitle: 'Custom Polo Fabric Guide',
        blogSlug: 'corporate-polo-fabric-comparison-india',
        categorySlug: 'buying-guides',
      },
      {
        eventName: 'blog_category_view',
        sessionId,
        channel: 'organic_search',
        pagePath: '/blogs',
        categorySlug: 'buying-guides',
      },
      {
        eventName: 'blog_search',
        sessionId,
        channel: 'organic_search',
        pagePath: '/blogs',
        searchTerm: '230 gsm polo',
      },
      {
        eventName: 'related_product_click',
        sessionId,
        channel: 'organic_search',
        pagePath: articlePath,
        blogSlug: 'corporate-polo-fabric-comparison-india',
        productId: 'prod-plain-polo',
      },
      {
        eventName: 'blog_cta_click',
        sessionId,
        channel: 'organic_search',
        pagePath: articlePath,
        blogSlug: 'corporate-polo-fabric-comparison-india',
      },
      {
        eventName: 'blog_share',
        sessionId,
        channel: 'organic_search',
        pagePath: articlePath,
        blogSlug: 'corporate-polo-fabric-comparison-india',
        shareChannel: 'whatsapp',
      },
    ];

    for (const ev of events) {
      const res = await fetch(`${baseUrl}/api/analytics/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ev),
      });
      assert.equal(res.status, 200, `Analytics event ${ev.eventName} must be accepted`);
    }

    const dashRes = await fetch(`${baseUrl}/api/admin/seo-analytics/overview?preset=28d`, {
      headers: { Authorization: `Bearer ${VALID_ADMIN_TOKEN}` },
    });
    assert.equal(dashRes.status, 200);
    const dashJson: any = await dashRes.json();
    const cp = dashJson.data.contentPerformance;

    assert.ok(cp, 'contentPerformance summary must be present in SEO analytics overview');
    assert.equal(cp.publishedArticlesCount, 2);
    assert.equal(cp.draftArticlesCount, INITIAL_DRAFT_BLOG_TEMPLATES.length);
    assert.equal(cp.totalArticleViews, 1);
    assert.equal(cp.organicBlogSessions, 1);
    assert.equal(cp.totalProductClicksFromArticles, 1);
    assert.equal(cp.totalBlogCtaClicks, 1);
    assert.equal(cp.totalBlogShares, 1);
    assert.equal(cp.totalBlogSearches, 1);
    assert.equal(cp.averageEngagementSeconds, null, 'Must remain null honestly when GA4 engagement is unavailable');

    const articleRow = cp.articles.find(
      (a: any) => a.slug === 'corporate-polo-fabric-comparison-india'
    );
    assert.ok(articleRow);
    assert.equal(articleRow.articleViews, 1);
    assert.equal(articleRow.relatedProductClicks, 1);
    assert.equal(articleRow.ctaClicks, 1);
    assert.equal(articleRow.shareClicks, 1);
  });

  it('12. Static SQL Migration Audit: additive, idempotent, RLS enabled, hardened search_path, zero auto-published posts', () => {
    const sqlPath = path.resolve(process.cwd(), 'supabase', 'blog_content_seo_migration.sql');
    assert.ok(fs.existsSync(sqlPath), 'supabase/blog_content_seo_migration.sql must exist');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    assert.ok(/CREATE TABLE IF NOT EXISTS public\.blog_categories/i.test(sql));
    assert.ok(/CREATE TABLE IF NOT EXISTS public\.blog_posts/i.test(sql));
    assert.ok(/CREATE TABLE IF NOT EXISTS public\.blog_slug_redirects/i.test(sql));
    assert.ok(/ENABLE ROW LEVEL SECURITY/i.test(sql));
    assert.ok(/status\s*=\s*'published'/i.test(sql));
    assert.ok(/SET search_path\s*=\s*pg_catalog,\s*public,\s*pg_temp/i.test(sql));
    assert.ok(!/DROP TABLE/i.test(sql), 'Migration must be strictly additive (no DROP TABLE)');
    assert.ok(!/TRUNCATE/i.test(sql), 'Migration must never truncate existing data');
    assert.ok(
      !/INSERT INTO public\.blog_posts/i.test(sql),
      'Migration must NOT auto-insert or auto-publish articles'
    );
  });
});
