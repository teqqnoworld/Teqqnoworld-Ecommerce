import {
  CANONICAL_ORIGIN,
  DEFAULT_OG_IMAGE_URL,
  buildCanonicalUrl,
} from '../config/seoRoutes';

export interface ClientSeoMeta {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
  ogType?: 'website' | 'product';
  imageUrl?: string;
  imageAlt?: string;
}

function upsertMetaTag(attr: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonicalLink(href: string): void {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function resolveAbsoluteImageUrl(raw?: string): string {
  if (!raw) return DEFAULT_OG_IMAGE_URL;
  const trimmed = raw.trim();
  if (trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('http://')) return `https://${trimmed.slice(7)}`;
  if (trimmed.startsWith('/')) return `${CANONICAL_ORIGIN}${trimmed}`;
  return DEFAULT_OG_IMAGE_URL;
}

/**
 * Synchronizes document <title>, meta description, robots, canonical URL,
 * OpenGraph, and Twitter Card metadata on every SPA route transition.
 */
export function applyDocumentSeo(meta: ClientSeoMeta): void {
  if (typeof document === 'undefined') return;

  const canonicalUrl = buildCanonicalUrl(meta.canonicalPath);
  const robots =
    meta.robots || 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const imageUrl = resolveAbsoluteImageUrl(meta.imageUrl);
  const imageAlt = meta.imageAlt || meta.title;
  const ogType = meta.ogType || 'website';

  document.title = meta.title;
  upsertMetaTag('name', 'description', meta.description);
  upsertMetaTag('name', 'robots', robots);
  upsertCanonicalLink(canonicalUrl);

  // OpenGraph
  upsertMetaTag('property', 'og:site_name', 'TeqqnoWorld');
  upsertMetaTag('property', 'og:type', ogType);
  upsertMetaTag('property', 'og:title', meta.title);
  upsertMetaTag('property', 'og:description', meta.description);
  upsertMetaTag('property', 'og:url', canonicalUrl);
  upsertMetaTag('property', 'og:image', imageUrl);
  upsertMetaTag('property', 'og:image:alt', imageAlt);
  upsertMetaTag('property', 'og:locale', 'en_IN');

  // Twitter Card
  upsertMetaTag('name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('name', 'twitter:site', '@TeqqnoWorld');
  upsertMetaTag('name', 'twitter:title', meta.title);
  upsertMetaTag('name', 'twitter:description', meta.description);
  upsertMetaTag('name', 'twitter:image', imageUrl);
}
