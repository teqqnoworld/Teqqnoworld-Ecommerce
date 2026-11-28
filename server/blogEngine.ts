// ==============================================================================
// TEQQNOWORLD PHASE 6 — BLOG CMS & CONTENT SEO ENGINE
//
// Architecture & Security Guarantees:
// - Uses existing Supabase PostgreSQL (public.blog_posts, public.blog_categories,
//   public.blog_slug_redirects) via SUPABASE_SERVICE_ROLE_KEY when available.
// - Falls back cleanly to `.data/blog-cms-store.json` when migration hasn't been
//   executed yet, ensuring full local & preview functionality without touching
//   production databases automatically.
// - Strict Draft Policy: NEVER auto-publishes AI-generated or starter content.
//   All seeded templates remain `status: 'draft'` until an Admin explicitly publishes.
// - Scheduled Publication Safety: `status === 'scheduled'` posts remain hidden (404)
//   until `scheduledAt <= now`.
// - Slug Change 301 Redirect Tracking: Automatically records oldSlug -> newSlug
//   whenever a post's slug changes, prevents redirect loops, and resolves chains.
// - Image Upload Hardening: Validates MIME allowlist, 3 MB limit, magic bytes
//   (WebP/AVIF/PNG/JPEG), and path.resolve confinement under `public/assets/blog/`.
// ==============================================================================

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  BlogCategory,
  BlogContentKind,
  BlogFaqItem,
  BlogPost,
  BlogPostStatus,
  BlogSlugRedirect,
} from '../src/types/blog.ts';
import {
  DEFAULT_BLOG_CATEGORIES,
  INITIAL_DRAFT_BLOG_TEMPLATES,
} from '../src/data/contentEditorialCalendar.ts';
import { buildCanonicalUrl } from '../src/config/seoRoutes.ts';
import { PRODUCT_KEYWORD_MAP } from '../src/data/seoKeywordMap.ts';

export interface BlogStorageDeps {
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  uploadDir?: string;
}

interface LocalBlogStoreFile {
  categories: BlogCategory[];
  posts: BlogPost[];
  redirects: BlogSlugRedirect[];
  updatedAt: string;
}

const DEFAULT_LOCAL_STORE_PATH = path.resolve(process.cwd(), '.data', 'blog-cms-store.json');
const DEFAULT_UPLOAD_DIR = path.resolve(process.cwd(), 'public', 'assets', 'blog');
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // 3 MB

const ALLOWED_STATUSES = new Set<BlogPostStatus>(['draft', 'published', 'scheduled']);
const ALLOWED_CONTENT_KINDS = new Set<BlogContentKind>(['article', 'guide', 'resource']);

// ==============================================================================
// SANITIZATION & VALIDATION UTILITIES
// ==============================================================================

export function slugifyBlogSegment(input: string): string {
  const cleaned = String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120);
  return cleaned;
}

export function calculateReadingTimeMinutes(content: string): number {
  const words = String(content || '')
    .replace(/[#*_`[\]()>-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}

export function sanitizePublicUrl(raw: string | undefined, fallback = ''): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return fallback;
  // Strictly allow site-relative paths or https:// URLs only (block javascript:, data:, vbscript:)
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return trimmed.slice(0, 500);
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().slice(0, 500);
    }
  } catch {
    // invalid URL
  }
  return fallback;
}

export function sanitizeFaqs(raw: unknown): BlogFaqItem[] {
  if (!Array.isArray(raw)) return [];
  const clean: BlogFaqItem[] = [];
  for (const item of raw.slice(0, 12)) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const q = String(rec.question || '').trim().slice(0, 240);
    const a = String(rec.answer || '').trim().slice(0, 1200);
    if (q && a) {
      clean.push({ question: q, answer: a });
    }
  }
  return clean;
}

export function sanitizeStringArray(raw: unknown, maxItems = 12, maxLen = 100): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const s = String(entry || '').trim().slice(0, maxLen);
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
      if (out.length >= maxItems) break;
    }
  }
  return out;
}

export function sanitizeRelatedProductIds(raw: unknown): string[] {
  const validIds = new Set(Object.keys(PRODUCT_KEYWORD_MAP));
  return sanitizeStringArray(raw, 8, 80).filter((id) => validIds.has(id));
}

/**
 * Determines whether a blog post is publicly visible at `nowMs`.
 * - Drafts are NEVER visible publicly.
 * - Published posts are visible when publishedAt is null or <= now.
 * - Scheduled posts remain hidden until scheduledAt <= now.
 */
export function isPostPubliclyVisible(post: BlogPost, nowMs = Date.now()): boolean {
  if (post.status === 'draft') return false;
  if (post.status === 'published') {
    if (!post.publishedAt) return true;
    const pubMs = Date.parse(post.publishedAt);
    return Number.isNaN(pubMs) ? true : pubMs <= nowMs;
  }
  if (post.status === 'scheduled') {
    if (!post.scheduledAt) return false;
    const schedMs = Date.parse(post.scheduledAt);
    return !Number.isNaN(schedMs) && schedMs <= nowMs;
  }
  return false;
}

// ==============================================================================
// MAGIC-BYTE VALIDATED FEATURED IMAGE UPLOADER
// ==============================================================================

function detectImageTypeFromMagicBytes(buf: Buffer): { mime: string; ext: string } | null {
  if (buf.length < 12) return null;
  // WebP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  // AVIF / ISO BMFF: ....ftypavif or ....ftypavis
  const boxType = buf.subarray(4, 12).toString('ascii');
  if (boxType.startsWith('ftypavif') || boxType.startsWith('ftypavis')) {
    return { mime: 'image/avif', ext: 'avif' };
  }
  return null;
}

export function saveValidatedBlogImage(params: {
  dataUrlOrBase64: string;
  declaredMime?: string;
  originalFilename?: string;
  uploadDir?: string;
}): { url: string; mime: string; bytes: number; filename: string } {
  const raw = String(params.dataUrlOrBase64 || '').trim();
  if (!raw) {
    throw new Error('Image payload is required.');
  }

  let declaredMime = String(params.declaredMime || '').trim().toLowerCase();
  let base64Body = raw;

  const dataUrlMatch = raw.match(/^data:([a-zA-Z0-9/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (dataUrlMatch) {
    declaredMime = dataUrlMatch[1].toLowerCase();
    base64Body = dataUrlMatch[2].replace(/\s+/g, '');
  }

  const allowedMimes = new Set(['image/webp', 'image/avif', 'image/png', 'image/jpeg', 'image/jpg']);
  if (declaredMime && !allowedMimes.has(declaredMime)) {
    throw new Error('Unsupported image format. Only WebP, AVIF, PNG, and JPEG images are allowed.');
  }

  const buffer = Buffer.from(base64Body, 'base64');
  if (!buffer.length) {
    throw new Error('Empty or invalid base64 image payload.');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error('Image exceeds the 3 MB maximum file size limit.');
  }

  // Verify actual magic bytes (blocks disguised SVG/HTML/JS uploads)
  const detected = detectImageTypeFromMagicBytes(buffer);
  if (!detected) {
    throw new Error(
      'Image failed binary signature verification. Upload a valid WebP, AVIF, PNG, or JPEG file.'
    );
  }

  const safePrefix = slugifyBlogSegment(
    (params.originalFilename || 'blog-image').replace(/\.[^.]+$/, '')
  ).slice(0, 48) || 'blog-image';
  const uniqueSuffix = crypto.randomBytes(6).toString('hex');
  const filename = `${safePrefix}-${uniqueSuffix}.${detected.ext}`;

  const targetDir = path.resolve(params.uploadDir || DEFAULT_UPLOAD_DIR);
  fs.mkdirSync(targetDir, { recursive: true });

  const resolvedFile = path.resolve(targetDir, filename);
  if (!resolvedFile.startsWith(`${targetDir}${path.sep}`)) {
    throw new Error('Invalid image destination path.');
  }

  fs.writeFileSync(resolvedFile, buffer);

  return {
    url: `/assets/blog/${filename}`,
    mime: detected.mime,
    bytes: buffer.length,
    filename,
  };
}

// ==============================================================================
// BLOG STORE (SUPABASE REST + SAFE LOCAL JSON FALLBACK)
// ==============================================================================

export class BlogStore {
  private readonly deps: BlogStorageDeps;
  private readonly localPath: string;
  private supabaseReady: boolean | null = null;

  constructor(deps: BlogStorageDeps, localStoreOverridePath?: string) {
    this.deps = deps;
    this.localPath = localStoreOverridePath || DEFAULT_LOCAL_STORE_PATH;
  }

  private get supabaseConfig(): { url: string; key: string } | null {
    const url = (this.deps.supabaseUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
    const key = (this.deps.supabaseServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!url || !key) return null;
    return { url: url.replace(/\/+$/, ''), key };
  }

  private async supabaseFetch(endpoint: string, init: RequestInit = {}): Promise<Response | null> {
    const cfg = this.supabaseConfig;
    if (!cfg) return null;
    try {
      const resp = await fetch(`${cfg.url}/rest/v1/${endpoint}`, {
        ...init,
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${cfg.key}`,
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });
      if (resp.status === 404 || resp.status === 400) {
        const text = await resp.clone().text().catch(() => '');
        if (text.includes('does not exist') || text.includes('PGRST205') || resp.status === 404) {
          this.supabaseReady = false;
          return null;
        }
      }
      if (resp.ok) {
        this.supabaseReady = true;
      }
      return resp;
    } catch {
      this.supabaseReady = false;
      return null;
    }
  }

  private createInitialLocalData(): LocalBlogStoreFile {
    return {
      categories: DEFAULT_BLOG_CATEGORIES.map((c) => ({ ...c })),
      // Strictly DRAFT-ONLY starter templates (NEVER auto-published!)
      posts: INITIAL_DRAFT_BLOG_TEMPLATES.map((p) => ({
        ...p,
        status: 'draft',
        publishedAt: null,
        scheduledAt: null,
        tags: [...p.tags],
        secondaryKeywords: [...p.secondaryKeywords],
        relatedProductIds: [...p.relatedProductIds],
        relatedArticleSlugs: [...p.relatedArticleSlugs],
        faqs: p.faqs.map((f) => ({ ...f })),
      })),
      redirects: [],
      updatedAt: new Date().toISOString(),
    };
  }

  private readLocalStore(): LocalBlogStoreFile {
    try {
      if (fs.existsSync(this.localPath)) {
        const raw = fs.readFileSync(this.localPath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<LocalBlogStoreFile>;
        return {
          categories: Array.isArray(parsed.categories) && parsed.categories.length > 0
            ? parsed.categories
            : DEFAULT_BLOG_CATEGORIES.map((c) => ({ ...c })),
          posts: Array.isArray(parsed.posts) ? parsed.posts : [],
          redirects: Array.isArray(parsed.redirects) ? parsed.redirects : [],
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
    } catch {
      // recreate clean store if unreadable
    }
    const seeded = this.createInitialLocalData();
    this.writeLocalStore(seeded);
    return seeded;
  }

  private writeLocalStore(data: LocalBlogStoreFile): void {
    const dir = path.dirname(this.localPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      this.localPath,
      JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    );
  }

  private mapSupabaseCategory(row: Record<string, any>): BlogCategory {
    return {
      id: String(row.id),
      slug: String(row.slug),
      name: String(row.name),
      description: String(row.description || ''),
      sortOrder: Number(row.sort_order || 0),
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
    };
  }

  private mapSupabasePost(row: Record<string, any>, catMap?: Map<string, BlogCategory>): BlogPost {
    const slug = String(row.slug);
    const categorySlug = String(row.category_slug || 'buying-guides');
    return {
      id: String(row.id),
      title: String(row.title),
      slug,
      excerpt: String(row.excerpt || ''),
      content: String(row.content || ''),
      contentKind: ALLOWED_CONTENT_KINDS.has(row.content_kind) ? row.content_kind : 'article',
      status: ALLOWED_STATUSES.has(row.status) ? row.status : 'draft',
      featured: Boolean(row.featured),
      categorySlug,
      categoryName: catMap?.get(categorySlug)?.name,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : [],
      featuredImageUrl: String(row.featured_image_url || ''),
      featuredImageAlt: String(row.featured_image_alt || ''),
      featuredImageWidth: Number(row.featured_image_width || 1200),
      featuredImageHeight: Number(row.featured_image_height || 675),
      authorName: String(row.author_name || 'TeqqnoWorld Editorial Desk'),
      authorRole: String(row.author_role || 'Custom Printing & Merchandising Team'),
      readingTimeMinutes: Number(row.reading_time_minutes || calculateReadingTimeMinutes(String(row.content || ''))),
      seoTitle: String(row.seo_title || ''),
      metaDescription: String(row.meta_description || ''),
      canonicalUrl: String(row.canonical_url || buildCanonicalUrl(`/blogs/${slug}`)),
      focusKeyword: String(row.focus_keyword || ''),
      secondaryKeywords: Array.isArray(row.secondary_keywords) ? row.secondary_keywords.map(String) : [],
      topicCluster: String(row.topic_cluster || ''),
      relatedCategorySlug: String(row.related_category_slug || ''),
      relatedProductIds: Array.isArray(row.related_product_ids) ? row.related_product_ids.map(String) : [],
      relatedArticleSlugs: Array.isArray(row.related_article_slugs) ? row.related_article_slugs.map(String) : [],
      faqs: sanitizeFaqs(row.faqs),
      publishedAt: row.published_at ? String(row.published_at) : null,
      scheduledAt: row.scheduled_at ? String(row.scheduled_at) : null,
      createdAt: String(row.created_at || new Date().toISOString()),
      updatedAt: String(row.updated_at || new Date().toISOString()),
      updatedBy: row.updated_by ? String(row.updated_by) : undefined,
    };
  }

  private toSupabasePostPayload(post: BlogPost): Record<string, unknown> {
    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      content_kind: post.contentKind,
      status: post.status,
      featured: post.featured,
      category_slug: post.categorySlug,
      tags: post.tags,
      featured_image_url: post.featuredImageUrl,
      featured_image_alt: post.featuredImageAlt,
      featured_image_width: post.featuredImageWidth,
      featured_image_height: post.featuredImageHeight,
      author_name: post.authorName,
      author_role: post.authorRole,
      reading_time_minutes: post.readingTimeMinutes,
      seo_title: post.seoTitle,
      meta_description: post.metaDescription,
      canonical_url: post.canonicalUrl,
      focus_keyword: post.focusKeyword,
      secondary_keywords: post.secondaryKeywords,
      topic_cluster: post.topicCluster,
      related_category_slug: post.relatedCategorySlug,
      related_product_ids: post.relatedProductIds,
      related_article_slugs: post.relatedArticleSlugs,
      faqs: post.faqs,
      published_at: post.publishedAt,
      scheduled_at: post.scheduledAt,
      updated_by: post.updatedBy || 'admin',
    };
  }

  public getStorageInfo(): { mode: 'supabase' | 'local_dev_fallback'; supabaseTablesReady: boolean } {
    const ready = this.supabaseReady === true;
    return {
      mode: ready ? 'supabase' : 'local_dev_fallback',
      supabaseTablesReady: ready,
    };
  }

  public async loadAll(): Promise<{
    categories: BlogCategory[];
    posts: BlogPost[];
    redirects: BlogSlugRedirect[];
    storageMode: 'supabase' | 'local_dev_fallback';
  }> {
    if (this.supabaseConfig && this.supabaseReady !== false) {
      const [catResp, postResp, redirResp] = await Promise.all([
        this.supabaseFetch('blog_categories?select=*&order=sort_order.asc,name.asc'),
        this.supabaseFetch('blog_posts?select=*&order=updated_at.desc'),
        this.supabaseFetch('blog_slug_redirects?select=*'),
      ]);
      if (catResp?.ok && postResp?.ok && redirResp?.ok) {
        const rawCats = (await catResp.json()) as Record<string, any>[];
        const rawPosts = (await postResp.json()) as Record<string, any>[];
        const rawRedirs = (await redirResp.json()) as Record<string, any>[];
        const categories =
          rawCats.length > 0
            ? rawCats.map((r) => this.mapSupabaseCategory(r))
            : DEFAULT_BLOG_CATEGORIES.map((c) => ({ ...c }));
        const catMap = new Map(categories.map((c) => [c.slug, c]));
        const posts = rawPosts.map((r) => this.mapSupabasePost(r, catMap));
        const redirects: BlogSlugRedirect[] = rawRedirs.map((r) => ({
          oldSlug: String(r.old_slug),
          newSlug: String(r.new_slug),
          postId: String(r.post_id),
          createdAt: String(r.created_at || new Date().toISOString()),
        }));
        return { categories, posts, redirects, storageMode: 'supabase' };
      }
    }

    const local = this.readLocalStore();
    const catMap = new Map(local.categories.map((c) => [c.slug, c]));
    const posts = local.posts.map((p) => ({
      ...p,
      categoryName: catMap.get(p.categorySlug)?.name || p.categoryName,
    }));
    return {
      categories: local.categories,
      posts,
      redirects: local.redirects,
      storageMode: 'local_dev_fallback',
    };
  }

  public async listPublishedPosts(filters?: {
    category?: string;
    q?: string;
    contentKind?: BlogContentKind;
    featuredOnly?: boolean;
    productId?: string;
    nowMs?: number;
  }): Promise<BlogPost[]> {
    const { posts } = await this.loadAll();
    const now = filters?.nowMs ?? Date.now();
    let visible = posts.filter((p) => isPostPubliclyVisible(p, now));

    if (filters?.category && filters.category !== 'all') {
      const targetCat = slugifyBlogSegment(filters.category);
      visible = visible.filter((p) => p.categorySlug === targetCat);
    }
    if (filters?.contentKind) {
      visible = visible.filter((p) => p.contentKind === filters.contentKind);
    }
    if (filters?.featuredOnly) {
      visible = visible.filter((p) => p.featured);
    }
    if (filters?.productId) {
      visible = visible.filter((p) => p.relatedProductIds.includes(filters.productId!));
    }
    if (filters?.q && filters.q.trim()) {
      const needle = filters.q.trim().toLowerCase();
      visible = visible.filter((p) => {
        const hay = [
          p.title,
          p.excerpt,
          p.focusKeyword,
          p.categoryName || p.categorySlug,
          ...p.tags,
          ...p.secondaryKeywords,
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    return visible.sort((a, b) => {
      const aTime = Date.parse(a.publishedAt || a.scheduledAt || a.updatedAt) || 0;
      const bTime = Date.parse(b.publishedAt || b.scheduledAt || b.updatedAt) || 0;
      return bTime - aTime;
    });
  }

  public async resolveSlugRedirect(slug: string): Promise<string | null> {
    const clean = slugifyBlogSegment(slug);
    if (!clean) return null;
    const { redirects, posts } = await this.loadAll();
    const redirectMap = new Map(redirects.map((r) => [r.oldSlug, r.newSlug]));

    let current = clean;
    const visited = new Set<string>([current]);
    while (redirectMap.has(current)) {
      const next = redirectMap.get(current)!;
      if (!next || visited.has(next)) break;
      visited.add(next);
      current = next;
    }

    if (current === clean) return null;
    // Only redirect if destination post exists and is publicly visible
    const targetPost = posts.find((p) => p.slug === current);
    if (!targetPost || !isPostPubliclyVisible(targetPost)) return null;
    return current;
  }

  public async getPublicPostBySlug(slug: string, nowMs = Date.now()): Promise<{
    post: BlogPost | null;
    redirectToSlug: string | null;
    relatedArticles: BlogPost[];
  }> {
    const clean = slugifyBlogSegment(slug);
    if (!clean) return { post: null, redirectToSlug: null, relatedArticles: [] };

    const { posts } = await this.loadAll();
    const matched = posts.find((p) => p.slug === clean);

    if (matched) {
      if (!isPostPubliclyVisible(matched, nowMs)) {
        // Strictly hide drafts & future scheduled articles publicly
        return { post: null, redirectToSlug: null, relatedArticles: [] };
      }
      const publishedOthers = posts.filter(
        (p) => p.id !== matched.id && isPostPubliclyVisible(p, nowMs)
      );
      const explicitRelated = matched.relatedArticleSlugs
        .map((s) => publishedOthers.find((p) => p.slug === s))
        .filter((p): p is BlogPost => Boolean(p));

      const sameCategory = publishedOthers.filter(
        (p) =>
          p.categorySlug === matched.categorySlug &&
          !explicitRelated.some((ex) => ex.id === p.id)
      );
      const fallbackOthers = publishedOthers.filter(
        (p) =>
          !explicitRelated.some((ex) => ex.id === p.id) &&
          !sameCategory.some((sc) => sc.id === p.id)
      );
      const relatedArticles = [...explicitRelated, ...sameCategory, ...fallbackOthers].slice(0, 3);
      return { post: matched, redirectToSlug: null, relatedArticles };
    }

    const redirectToSlug = await this.resolveSlugRedirect(clean);
    return { post: null, redirectToSlug, relatedArticles: [] };
  }

  public async createPost(
    input: Partial<BlogPost>,
    actor = 'admin'
  ): Promise<BlogPost> {
    const { categories, posts } = await this.loadAll();
    const title = String(input.title || '').trim().slice(0, 200);
    if (!title || title.length < 4) {
      throw new Error('Article title must be at least 4 characters long.');
    }

    const slug = slugifyBlogSegment(input.slug || title);
    if (!slug) {
      throw new Error('Valid URL slug is required.');
    }
    if (posts.some((p) => p.slug === slug)) {
      throw new Error(`Slug "${slug}" is already in use by another article.`);
    }

    const categorySlug = slugifyBlogSegment(input.categorySlug || 'buying-guides');
    const validCat = categories.find((c) => c.slug === categorySlug) || categories[0];
    const status: BlogPostStatus = ALLOWED_STATUSES.has(input.status as BlogPostStatus)
      ? (input.status as BlogPostStatus)
      : 'draft';

    const nowIso = new Date().toISOString();
    let publishedAt: string | null = null;
    let scheduledAt: string | null = null;

    if (status === 'published') {
      publishedAt = input.publishedAt && !Number.isNaN(Date.parse(input.publishedAt))
        ? new Date(input.publishedAt).toISOString()
        : nowIso;
    } else if (status === 'scheduled') {
      if (!input.scheduledAt || Number.isNaN(Date.parse(input.scheduledAt))) {
        throw new Error('A valid scheduledAt date/time is required for scheduled posts.');
      }
      scheduledAt = new Date(input.scheduledAt).toISOString();
    }

    const content = String(input.content || '').trim();
    const excerpt = String(input.excerpt || '').trim().slice(0, 420);
    const seoTitle = String(input.seoTitle || '').trim().slice(0, 90) || `${title} | TeqqnoWorld`.slice(0, 90);
    const metaDescription = String(input.metaDescription || excerpt).trim().slice(0, 220);
    const canonicalUrl = sanitizePublicUrl(
      input.canonicalUrl,
      buildCanonicalUrl(`/blogs/${slug}`)
    );

    const post: BlogPost = {
      id: `post-${crypto.randomUUID().slice(0, 12)}`,
      title,
      slug,
      excerpt,
      content,
      contentKind: ALLOWED_CONTENT_KINDS.has(input.contentKind as BlogContentKind)
        ? (input.contentKind as BlogContentKind)
        : 'article',
      status,
      featured: Boolean(input.featured),
      categorySlug: validCat ? validCat.slug : 'buying-guides',
      categoryName: validCat?.name,
      tags: sanitizeStringArray(input.tags, 10, 48),
      featuredImageUrl: sanitizePublicUrl(input.featuredImageUrl, ''),
      featuredImageAlt: String(input.featuredImageAlt || '').trim().slice(0, 220),
      featuredImageWidth: Math.max(200, Math.min(4000, Number(input.featuredImageWidth) || 1200)),
      featuredImageHeight: Math.max(150, Math.min(4000, Number(input.featuredImageHeight) || 675)),
      authorName: String(input.authorName || 'TeqqnoWorld Editorial Desk').trim().slice(0, 80),
      authorRole: String(input.authorRole || 'Custom Printing & Merchandising Team').trim().slice(0, 100),
      readingTimeMinutes: calculateReadingTimeMinutes(content),
      seoTitle,
      metaDescription,
      canonicalUrl: canonicalUrl || buildCanonicalUrl(`/blogs/${slug}`),
      focusKeyword: String(input.focusKeyword || '').trim().slice(0, 120),
      secondaryKeywords: sanitizeStringArray(input.secondaryKeywords, 10, 100),
      topicCluster: String(input.topicCluster || '').trim().slice(0, 140),
      relatedCategorySlug: slugifyBlogSegment(input.relatedCategorySlug || ''),
      relatedProductIds: sanitizeRelatedProductIds(input.relatedProductIds),
      relatedArticleSlugs: sanitizeStringArray(input.relatedArticleSlugs, 6, 120)
        .map(slugifyBlogSegment)
        .filter((s) => s && s !== slug),
      faqs: sanitizeFaqs(input.faqs),
      publishedAt,
      scheduledAt,
      createdAt: nowIso,
      updatedAt: nowIso,
      updatedBy: actor,
    };

    if (this.supabaseConfig && this.supabaseReady !== false) {
      const resp = await this.supabaseFetch('blog_posts', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(this.toSupabasePostPayload(post)),
      });
      if (resp?.ok) {
        return post;
      }
    }

    const local = this.readLocalStore();
    local.posts.unshift(post);
    this.writeLocalStore(local);
    return post;
  }

  public async updatePost(
    postId: string,
    patch: Partial<BlogPost>,
    actor = 'admin'
  ): Promise<{ post: BlogPost; redirectCreated?: BlogSlugRedirect }> {
    const { categories, posts, redirects } = await this.loadAll();
    const existing = posts.find((p) => p.id === postId);
    if (!existing) {
      throw new Error('Blog post not found.');
    }

    const nextTitle =
      patch.title !== undefined ? String(patch.title).trim().slice(0, 200) : existing.title;
    if (!nextTitle || nextTitle.length < 4) {
      throw new Error('Article title must be at least 4 characters long.');
    }

    const nextSlug =
      patch.slug !== undefined ? slugifyBlogSegment(patch.slug) : existing.slug;
    if (!nextSlug) {
      throw new Error('Valid URL slug is required.');
    }
    if (posts.some((p) => p.id !== postId && p.slug === nextSlug)) {
      throw new Error(`Slug "${nextSlug}" is already in use by another article.`);
    }

    const nextCategorySlug =
      patch.categorySlug !== undefined
        ? slugifyBlogSegment(patch.categorySlug)
        : existing.categorySlug;
    const validCat = categories.find((c) => c.slug === nextCategorySlug) || categories[0];

    const nextStatus: BlogPostStatus =
      patch.status !== undefined && ALLOWED_STATUSES.has(patch.status)
        ? patch.status
        : existing.status;

    const nowIso = new Date().toISOString();
    let publishedAt = existing.publishedAt;
    let scheduledAt = existing.scheduledAt;

    if (nextStatus === 'draft') {
      scheduledAt = null;
    } else if (nextStatus === 'published') {
      publishedAt =
        patch.publishedAt && !Number.isNaN(Date.parse(patch.publishedAt))
          ? new Date(patch.publishedAt).toISOString()
          : existing.publishedAt || nowIso;
      scheduledAt = null;
    } else if (nextStatus === 'scheduled') {
      const candidate = patch.scheduledAt ?? existing.scheduledAt;
      if (!candidate || Number.isNaN(Date.parse(candidate))) {
        throw new Error('A valid scheduledAt date/time is required for scheduled posts.');
      }
      scheduledAt = new Date(candidate).toISOString();
      publishedAt = null;
    }

    const nextContent =
      patch.content !== undefined ? String(patch.content).trim() : existing.content;
    const slugChanged = nextSlug !== existing.slug;

    // Auto-update canonicalUrl when it previously pointed to the old default slug URL
    let nextCanonical =
      patch.canonicalUrl !== undefined
        ? sanitizePublicUrl(patch.canonicalUrl, buildCanonicalUrl(`/blogs/${nextSlug}`))
        : existing.canonicalUrl;
    if (
      slugChanged &&
      (!nextCanonical || nextCanonical === buildCanonicalUrl(`/blogs/${existing.slug}`))
    ) {
      nextCanonical = buildCanonicalUrl(`/blogs/${nextSlug}`);
    }

    const updated: BlogPost = {
      ...existing,
      title: nextTitle,
      slug: nextSlug,
      excerpt:
        patch.excerpt !== undefined ? String(patch.excerpt).trim().slice(0, 420) : existing.excerpt,
      content: nextContent,
      contentKind:
        patch.contentKind !== undefined && ALLOWED_CONTENT_KINDS.has(patch.contentKind)
          ? patch.contentKind
          : existing.contentKind,
      status: nextStatus,
      featured: patch.featured !== undefined ? Boolean(patch.featured) : existing.featured,
      categorySlug: validCat ? validCat.slug : existing.categorySlug,
      categoryName: validCat?.name || existing.categoryName,
      tags: patch.tags !== undefined ? sanitizeStringArray(patch.tags, 10, 48) : existing.tags,
      featuredImageUrl:
        patch.featuredImageUrl !== undefined
          ? sanitizePublicUrl(patch.featuredImageUrl, '')
          : existing.featuredImageUrl,
      featuredImageAlt:
        patch.featuredImageAlt !== undefined
          ? String(patch.featuredImageAlt).trim().slice(0, 220)
          : existing.featuredImageAlt,
      featuredImageWidth:
        patch.featuredImageWidth !== undefined
          ? Math.max(200, Math.min(4000, Number(patch.featuredImageWidth) || 1200))
          : existing.featuredImageWidth,
      featuredImageHeight:
        patch.featuredImageHeight !== undefined
          ? Math.max(150, Math.min(4000, Number(patch.featuredImageHeight) || 675))
          : existing.featuredImageHeight,
      authorName:
        patch.authorName !== undefined
          ? String(patch.authorName).trim().slice(0, 80) || 'TeqqnoWorld Editorial Desk'
          : existing.authorName,
      authorRole:
        patch.authorRole !== undefined
          ? String(patch.authorRole).trim().slice(0, 100)
          : existing.authorRole,
      readingTimeMinutes: calculateReadingTimeMinutes(nextContent),
      seoTitle:
        patch.seoTitle !== undefined
          ? String(patch.seoTitle).trim().slice(0, 90)
          : existing.seoTitle,
      metaDescription:
        patch.metaDescription !== undefined
          ? String(patch.metaDescription).trim().slice(0, 220)
          : existing.metaDescription,
      canonicalUrl: nextCanonical || buildCanonicalUrl(`/blogs/${nextSlug}`),
      focusKeyword:
        patch.focusKeyword !== undefined
          ? String(patch.focusKeyword).trim().slice(0, 120)
          : existing.focusKeyword,
      secondaryKeywords:
        patch.secondaryKeywords !== undefined
          ? sanitizeStringArray(patch.secondaryKeywords, 10, 100)
          : existing.secondaryKeywords,
      topicCluster:
        patch.topicCluster !== undefined
          ? String(patch.topicCluster).trim().slice(0, 140)
          : existing.topicCluster,
      relatedCategorySlug:
        patch.relatedCategorySlug !== undefined
          ? slugifyBlogSegment(patch.relatedCategorySlug)
          : existing.relatedCategorySlug,
      relatedProductIds:
        patch.relatedProductIds !== undefined
          ? sanitizeRelatedProductIds(patch.relatedProductIds)
          : existing.relatedProductIds,
      relatedArticleSlugs:
        patch.relatedArticleSlugs !== undefined
          ? sanitizeStringArray(patch.relatedArticleSlugs, 6, 120)
              .map(slugifyBlogSegment)
              .filter((s) => s && s !== nextSlug)
          : existing.relatedArticleSlugs,
      faqs: patch.faqs !== undefined ? sanitizeFaqs(patch.faqs) : existing.faqs,
      publishedAt,
      scheduledAt,
      updatedAt: nowIso,
      updatedBy: actor,
    };

    let redirectCreated: BlogSlugRedirect | undefined;
    const shouldCreateRedirect =
      slugChanged && (existing.status === 'published' || nextStatus === 'published' || Boolean(existing.publishedAt));

    if (shouldCreateRedirect) {
      redirectCreated = {
        oldSlug: existing.slug,
        newSlug: nextSlug,
        postId,
        createdAt: nowIso,
      };
    }

    if (this.supabaseConfig && this.supabaseReady !== false) {
      const resp = await this.supabaseFetch(`blog_posts?id=eq.${encodeURIComponent(postId)}`, {
        method: 'PATCH',
        body: JSON.stringify(this.toSupabasePostPayload(updated)),
      });
      if (resp?.ok) {
        if (redirectCreated) {
          // Remove any reverse redirect matching nextSlug -> * to avoid loops
          await this.supabaseFetch(
            `blog_slug_redirects?old_slug=eq.${encodeURIComponent(nextSlug)}`,
            { method: 'DELETE' }
          );
          await this.supabaseFetch('blog_slug_redirects?on_conflict=old_slug', {
            method: 'POST',
            headers: { Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify({
              old_slug: redirectCreated.oldSlug,
              new_slug: redirectCreated.newSlug,
              post_id: redirectCreated.postId,
            }),
          });
        }
        return { post: updated, redirectCreated };
      }
    }

    const local = this.readLocalStore();
    local.posts = local.posts.map((p) => (p.id === postId ? updated : p));
    if (redirectCreated) {
      // Collapse existing redirects pointing to existing.slug so chains stay 1 hop,
      // and delete any old redirect whose oldSlug === nextSlug to prevent loops.
      const updatedRedirects = redirects
        .filter((r) => r.oldSlug !== nextSlug && r.oldSlug !== redirectCreated!.oldSlug)
        .map((r) => (r.newSlug === existing.slug ? { ...r, newSlug: nextSlug } : r));
      updatedRedirects.push(redirectCreated);
      local.redirects = updatedRedirects;
    }
    this.writeLocalStore(local);
    return { post: updated, redirectCreated };
  }

  public async deletePost(postId: string): Promise<boolean> {
    if (this.supabaseConfig && this.supabaseReady !== false) {
      const resp = await this.supabaseFetch(`blog_posts?id=eq.${encodeURIComponent(postId)}`, {
        method: 'DELETE',
      });
      if (resp?.ok) return true;
    }

    const local = this.readLocalStore();
    const before = local.posts.length;
    local.posts = local.posts.filter((p) => p.id !== postId);
    local.redirects = local.redirects.filter((r) => r.postId !== postId);
    if (local.posts.length !== before) {
      this.writeLocalStore(local);
      return true;
    }
    return false;
  }

  public async upsertCategory(input: {
    id?: string;
    name: string;
    slug?: string;
    description?: string;
    sortOrder?: number;
  }): Promise<BlogCategory> {
    const name = String(input.name || '').trim().slice(0, 80);
    if (!name || name.length < 2) {
      throw new Error('Category name must be at least 2 characters.');
    }
    const slug = slugifyBlogSegment(input.slug || name);
    if (!slug) {
      throw new Error('Valid category slug is required.');
    }
    const { categories } = await this.loadAll();
    const existing = categories.find((c) => c.id === input.id || c.slug === slug);
    const nowIso = new Date().toISOString();
    const category: BlogCategory = {
      id: existing?.id || input.id || `cat-${crypto.randomUUID().slice(0, 8)}`,
      slug,
      name,
      description: String(input.description || '').trim().slice(0, 320),
      sortOrder: Number.isFinite(Number(input.sortOrder))
        ? Number(input.sortOrder)
        : existing?.sortOrder ?? categories.length + 1,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (this.supabaseConfig && this.supabaseReady !== false) {
      const resp = await this.supabaseFetch('blog_categories?on_conflict=slug', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          id: category.id,
          slug: category.slug,
          name: category.name,
          description: category.description,
          sort_order: category.sortOrder,
        }),
      });
      if (resp?.ok) return category;
    }

    const local = this.readLocalStore();
    const idx = local.categories.findIndex((c) => c.id === category.id || c.slug === category.slug);
    if (idx >= 0) {
      local.categories[idx] = category;
    } else {
      local.categories.push(category);
    }
    local.categories.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    this.writeLocalStore(local);
    return category;
  }

  public async deleteCategory(categoryId: string): Promise<void> {
    const { categories, posts } = await this.loadAll();
    const target = categories.find((c) => c.id === categoryId);
    if (!target) {
      throw new Error('Category not found.');
    }
    if (categories.length <= 1) {
      throw new Error('At least one blog category must remain.');
    }
    if (posts.some((p) => p.categorySlug === target.slug)) {
      throw new Error('Cannot delete a category that is still assigned to existing articles.');
    }

    if (this.supabaseConfig && this.supabaseReady !== false) {
      const resp = await this.supabaseFetch(
        `blog_categories?id=eq.${encodeURIComponent(categoryId)}`,
        { method: 'DELETE' }
      );
      if (resp?.ok) return;
    }

    const local = this.readLocalStore();
    local.categories = local.categories.filter((c) => c.id !== categoryId);
    this.writeLocalStore(local);
  }
}
