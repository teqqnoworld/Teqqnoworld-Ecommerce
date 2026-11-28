// ==============================================================================
// TEQQNOWORLD PHASE 6 — BLOG CMS & PUBLIC RESOURCE CENTER EXPRESS ROUTER
//
// Security Guarantees:
// - Public GET /api/blogs* endpoints ONLY ever return published posts (and
//   scheduled posts whose scheduledAt <= now). Drafts and future-scheduled posts
//   strictly return HTTP 404 on single-slug lookup and are omitted from lists.
// - All /api/admin/blogs* endpoints enforce existing server-side
//   verifyAdminRequest (signed Admin Session Bearer token; HTTP 401 otherwise).
// - Featured image uploads enforce strict MIME allowlist, magic-byte binary
//   verification, 3 MB cap, and safe path confinement under public/assets/blog/.
// ==============================================================================

import { Router, type Request, type Response } from 'express';
import {
  BlogStore,
  saveValidatedBlogImage,
  type BlogStorageDeps,
} from './blogEngine.ts';
import type { BlogContentKind, BlogPostStatus } from '../src/types/blog.ts';
import {
  NINETY_DAY_EDITORIAL_CALENDAR,
  TOPICAL_AUTHORITY_CLUSTERS,
} from '../src/data/contentEditorialCalendar.ts';

export interface BlogRouterDeps extends BlogStorageDeps {
  verifyAdminRequest: (req: Request) => { valid: boolean; email?: string };
  localStoreOverridePath?: string;
  sharedStore?: BlogStore;
}

export function createBlogRouter(deps: BlogRouterDeps) {
  const router = Router();
  const store = deps.sharedStore || new BlogStore(deps, deps.localStoreOverridePath);

  const requireAdmin = (req: Request, res: Response): string | null => {
    const auth = deps.verifyAdminRequest(req);
    if (!auth.valid) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized. Valid Admin session authentication is required.',
      });
      return null;
    }
    return auth.email || 'admin';
  };

  // ============================================================================
  // PUBLIC ENDPOINTS (PUBLISHED ARTICLES ONLY — NEVER LEAKS DRAFTS)
  // ============================================================================

  router.get('/blogs/categories', async (_req: Request, res: Response) => {
    try {
      const { categories } = await store.loadAll();
      const published = await store.listPublishedPosts();
      const counts = new Map<string, number>();
      for (const p of published) {
        counts.set(p.categorySlug, (counts.get(p.categorySlug) || 0) + 1);
      }
      res.status(200).json({
        success: true,
        categories: categories.map((c) => ({
          ...c,
          publishedCount: counts.get(c.slug) || 0,
        })),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Unable to load blog categories.',
      });
    }
  });

  router.get('/blogs/by-product/:productId', async (req: Request, res: Response) => {
    try {
      const productId = String(req.params.productId || '').trim().slice(0, 80);
      if (!productId) {
        res.status(200).json({ success: true, posts: [] });
        return;
      }
      const posts = await store.listPublishedPosts({ productId });
      res.status(200).json({
        success: true,
        posts: posts.slice(0, 4),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Unable to load related buying guides.',
      });
    }
  });

  router.get('/blogs', async (req: Request, res: Response) => {
    try {
      const category = typeof req.query.category === 'string' ? req.query.category : undefined;
      const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 120) : undefined;
      const featuredOnly = req.query.featured === 'true';
      const productId = typeof req.query.productId === 'string' ? req.query.productId : undefined;
      const rawType = typeof req.query.type === 'string' ? req.query.type.trim().toLowerCase() : '';
      const contentKind: BlogContentKind | undefined =
        rawType === 'guide' || rawType === 'guides'
          ? 'guide'
          : rawType === 'resource' || rawType === 'resources'
            ? 'resource'
            : rawType === 'article'
              ? 'article'
              : undefined;

      const [{ categories }, posts] = await Promise.all([
        store.loadAll(),
        store.listPublishedPosts({
          category,
          q,
          contentKind,
          featuredOnly,
          productId,
        }),
      ]);

      res.status(200).json({
        success: true,
        posts,
        categories,
        total: posts.length,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Unable to load blog posts.',
      });
    }
  });

  router.get('/blogs/:slug', async (req: Request, res: Response) => {
    try {
      const slug = decodeURIComponent(String(req.params.slug || '')).trim();
      const result = await store.getPublicPostBySlug(slug);
      if (result.redirectToSlug) {
        res.status(200).json({
          success: true,
          redirectToSlug: result.redirectToSlug,
          post: null,
          relatedArticles: [],
        });
        return;
      }
      if (!result.post) {
        res.status(404).json({
          success: false,
          error: 'Article not found.',
        });
        return;
      }
      res.status(200).json({
        success: true,
        post: result.post,
        relatedArticles: result.relatedArticles,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Unable to load article.',
      });
    }
  });

  // ============================================================================
  // ADMIN BLOG MANAGEMENT ENDPOINTS (STRICT ADMIN SESSION AUTH)
  // ============================================================================

  router.get('/admin/blogs', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const loaded = await store.loadAll();
      res.status(200).json({
        success: true,
        posts: loaded.posts,
        categories: loaded.categories,
        redirects: loaded.redirects,
        storageMode: loaded.storageMode,
        editorialCalendar: NINETY_DAY_EDITORIAL_CALENDAR,
        topicClusters: TOPICAL_AUTHORITY_CLUSTERS,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to load admin blog inventory.',
      });
    }
  });

  router.get('/admin/blogs/:id', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = String(req.params.id || '').trim();
      const loaded = await store.loadAll();
      const post = loaded.posts.find((p) => p.id === id);
      if (!post) {
        res.status(404).json({ success: false, error: 'Article not found.' });
        return;
      }
      res.status(200).json({ success: true, post });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to load article.',
      });
    }
  });

  router.post('/admin/blogs', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        any
      >;
      const post = await store.createPost(body, actor);
      res.status(201).json({ success: true, post });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Failed to create blog post.',
      });
    }
  });

  router.put('/admin/blogs/:id', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const id = String(req.params.id || '').trim();
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        any
      >;
      const result = await store.updatePost(id, body, actor);
      res.status(200).json({
        success: true,
        post: result.post,
        redirectCreated: result.redirectCreated || null,
      });
    } catch (err: any) {
      const status = String(err?.message || '').includes('not found') ? 404 : 400;
      res.status(status).json({
        success: false,
        error: err?.message || 'Failed to update blog post.',
      });
    }
  });

  router.patch('/admin/blogs/:id/status', async (req: Request, res: Response) => {
    const actor = requireAdmin(req, res);
    if (!actor) return;
    try {
      const id = String(req.params.id || '').trim();
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        any
      >;
      const status = String(body.status || '').trim() as BlogPostStatus;
      if (!['draft', 'published', 'scheduled'].includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Status must be draft, published, or scheduled.',
        });
        return;
      }
      const result = await store.updatePost(
        id,
        {
          status,
          scheduledAt: status === 'scheduled' ? String(body.scheduledAt || '') : null,
        },
        actor
      );
      res.status(200).json({ success: true, post: result.post });
    } catch (err: any) {
      const statusCode = String(err?.message || '').includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: err?.message || 'Failed to update post publication status.',
      });
    }
  });

  router.delete('/admin/blogs/:id', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = String(req.params.id || '').trim();
      const deleted = await store.deletePost(id);
      if (!deleted) {
        res.status(404).json({ success: false, error: 'Article not found.' });
        return;
      }
      res.status(200).json({ success: true, id });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to delete article.',
      });
    }
  });

  router.post('/admin/blogs/categories', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        any
      >;
      const category = await store.upsertCategory({
        id: typeof body.id === 'string' ? body.id : undefined,
        name: String(body.name || ''),
        slug: typeof body.slug === 'string' ? body.slug : undefined,
        description: typeof body.description === 'string' ? body.description : '',
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
      });
      res.status(200).json({ success: true, category });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Failed to save blog category.',
      });
    }
  });

  router.delete('/admin/blogs/categories/:id', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const id = String(req.params.id || '').trim();
      await store.deleteCategory(id);
      res.status(200).json({ success: true, id });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Failed to delete blog category.',
      });
    }
  });

  router.post('/admin/blogs/upload-image', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    try {
      const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<
        string,
        any
      >;
      const saved = saveValidatedBlogImage({
        dataUrlOrBase64: String(body.dataUrl || body.base64 || ''),
        declaredMime: typeof body.mime === 'string' ? body.mime : undefined,
        originalFilename: typeof body.filename === 'string' ? body.filename : undefined,
        uploadDir: deps.uploadDir,
      });
      res.status(201).json({ success: true, image: saved });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'Image upload failed validation.',
      });
    }
  });

  return { router, store };
}
