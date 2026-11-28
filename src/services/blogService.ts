// ==============================================================================
// TEQQNOWORLD PHASE 6 — BLOG CMS & PUBLIC RESOURCE CENTER API CLIENT
// ==============================================================================

import { getStoredAdminToken } from './adminSecurityService';
import type {
  BlogCategory,
  BlogContentKind,
  BlogPost,
  BlogPostStatus,
  BlogSlugRedirect,
  EditorialCalendarItem,
  TopicalClusterDefinition,
} from '../types/blog';

export interface PublicBlogsResponse {
  success: boolean;
  posts: BlogPost[];
  categories: BlogCategory[];
  total: number;
  error?: string;
}

export interface PublicBlogDetailResponse {
  success: boolean;
  post: BlogPost | null;
  relatedArticles: BlogPost[];
  redirectToSlug?: string | null;
  error?: string;
}

export interface AdminBlogsInventoryResponse {
  success: boolean;
  posts: BlogPost[];
  categories: BlogCategory[];
  redirects: BlogSlugRedirect[];
  storageMode: 'supabase' | 'local_dev_fallback';
  editorialCalendar: EditorialCalendarItem[];
  topicClusters: TopicalClusterDefinition[];
  error?: string;
}

function getAdminAuthHeaders(): HeadersInit {
  const token = getStoredAdminToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ==============================================================================
// PUBLIC STOREFRONT READ CALLS (PUBLISHED ONLY)
// ==============================================================================

export async function fetchPublicBlogs(params?: {
  category?: string;
  q?: string;
  type?: BlogContentKind | 'all';
  featured?: boolean;
  productId?: string;
}): Promise<PublicBlogsResponse> {
  const sp = new URLSearchParams();
  if (params?.category && params.category !== 'all') sp.set('category', params.category);
  if (params?.q && params.q.trim()) sp.set('q', params.q.trim());
  if (params?.type && params.type !== 'all') sp.set('type', params.type);
  if (params?.featured) sp.set('featured', 'true');
  if (params?.productId) sp.set('productId', params.productId);

  const qs = sp.toString();
  const res = await fetch(`/api/blogs${qs ? `?${qs}` : ''}`);
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Unable to load articles.');
  }
  return json as PublicBlogsResponse;
}

export async function fetchPublicBlogBySlug(slug: string): Promise<PublicBlogDetailResponse> {
  const res = await fetch(`/api/blogs/${encodeURIComponent(slug)}`);
  if (res.status === 404) {
    return { success: false, post: null, relatedArticles: [], error: 'Article not found.' };
  }
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Unable to load article.');
  }
  return json as PublicBlogDetailResponse;
}

export async function fetchPublishedGuidesForProduct(productId: string): Promise<BlogPost[]> {
  if (!productId) return [];
  try {
    const res = await fetch(`/api/blogs/by-product/${encodeURIComponent(productId)}`);
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.posts) ? (json.posts as BlogPost[]) : [];
  } catch {
    return [];
  }
}

// ==============================================================================
// ADMIN CMS MANAGEMENT CALLS (SIGNED ADMIN SESSION REQUIRED)
// ==============================================================================

export async function fetchAdminBlogsInventory(): Promise<AdminBlogsInventoryResponse> {
  const res = await fetch('/api/admin/blogs', {
    headers: getAdminAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Unauthorized or unable to load blog CMS.');
  }
  return json as AdminBlogsInventoryResponse;
}

export async function createAdminBlogPost(payload: Partial<BlogPost>): Promise<BlogPost> {
  const res = await fetch('/api/admin/blogs', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Failed to create article.');
  }
  return json.post as BlogPost;
}

export async function updateAdminBlogPost(
  id: string,
  payload: Partial<BlogPost>
): Promise<{ post: BlogPost; redirectCreated: BlogSlugRedirect | null }> {
  const res = await fetch(`/api/admin/blogs/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Failed to update article.');
  }
  return {
    post: json.post as BlogPost,
    redirectCreated: (json.redirectCreated as BlogSlugRedirect) || null,
  };
}

export async function updateAdminBlogPostStatus(
  id: string,
  status: BlogPostStatus,
  scheduledAt?: string | null
): Promise<BlogPost> {
  const res = await fetch(`/api/admin/blogs/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify({ status, scheduledAt: scheduledAt || null }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Failed to update article status.');
  }
  return json.post as BlogPost;
}

export async function deleteAdminBlogPost(id: string): Promise<void> {
  const res = await fetch(`/api/admin/blogs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Failed to delete article.');
  }
}

export async function saveAdminBlogCategory(payload: {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  sortOrder?: number;
}): Promise<BlogCategory> {
  const res = await fetch('/api/admin/blogs/categories', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Failed to save category.');
  }
  return json.category as BlogCategory;
}

export async function deleteAdminBlogCategory(id: string): Promise<void> {
  const res = await fetch(`/api/admin/blogs/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getAdminAuthHeaders(),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Failed to delete category.');
  }
}

export async function uploadAdminBlogImage(params: {
  dataUrl: string;
  mime?: string;
  filename?: string;
}): Promise<{ url: string; mime: string; bytes: number; filename: string }> {
  const res = await fetch('/api/admin/blogs/upload-image', {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: JSON.stringify(params),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json?.error || 'Image upload failed validation.');
  }
  return json.image;
}
