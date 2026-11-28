import {
  DEFAULT_OG_IMAGE_ALT,
  buildCanonicalUrl,
  resolveAbsoluteSocialImageUrl,
} from '../config/seoRoutes';
import {
  JSONLD_SCRIPT_ID,
  serializeJsonLd,
  type JsonLdDocument,
} from '../config/structuredData';

export interface ClientSeoMeta {
  title: string;
  description: string;
  canonicalPath: string;
  robots?: string;
  ogType?: 'website' | 'product' | 'article';
  imageUrl?: string;
  imageAlt?: string;
  structuredData?: JsonLdDocument | null;
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

function syncJsonLdScript(doc: JsonLdDocument | null): void {
  if (typeof document === 'undefined') return;

  // Clean up any stray/duplicate JSON-LD blocks so at most one unified graph exists
  const existingScripts = Array.from(
    document.head.querySelectorAll('script[type="application/ld+json"]')
  );
  let primaryEl: HTMLScriptElement | null = null;
  for (const node of existingScripts) {
    if (node.id === JSONLD_SCRIPT_ID && !primaryEl) {
      primaryEl = node as HTMLScriptElement;
    } else {
      node.remove();
    }
  }

  if (doc === null) {
    if (primaryEl) {
      primaryEl.remove();
    }
    return;
  }

  if (!primaryEl) {
    primaryEl = document.createElement('script');
    primaryEl.id = JSONLD_SCRIPT_ID;
    primaryEl.type = 'application/ld+json';
    document.head.appendChild(primaryEl);
  }

  const serialized = serializeJsonLd(doc);
  if (primaryEl.textContent !== serialized) {
    primaryEl.textContent = serialized;
  }
}

/**
 * Synchronizes document <title>, meta description, robots, canonical URL,
 * OpenGraph, Twitter Card, and unified JSON-LD structured data on every SPA route transition.
 */
export function applyDocumentSeo(meta: ClientSeoMeta): void {
  if (typeof document === 'undefined') return;

  const canonicalUrl = buildCanonicalUrl(meta.canonicalPath);
  const robots =
    meta.robots || 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
  const imageUrl = resolveAbsoluteSocialImageUrl(meta.imageUrl);
  const imageAlt = meta.imageAlt || DEFAULT_OG_IMAGE_ALT;
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
  upsertMetaTag('name', 'twitter:image:alt', imageAlt);

  // Unified JSON-LD Structured Data
  if (meta.structuredData !== undefined) {
    syncJsonLdScript(meta.structuredData);
  }
}
