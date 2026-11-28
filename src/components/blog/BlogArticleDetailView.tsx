import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Layers,
  Share2,
  ShoppingBag,
  Tag,
  User,
} from 'lucide-react';
import type { BlogPost } from '../../types/blog';
import { fetchPublicBlogBySlug } from '../../services/blogService';
import { SafeArticleRenderer } from './SafeArticleRenderer';
import { PRODUCTS } from '../../data/mockData';
import {
  CANONICAL_ORIGIN,
  findCategoryBySlugOrAlias,
  getProductH1,
  getProductPath,
} from '../../config/seoRoutes';
import { getProductCardImageAlt } from '../../data/seoKeywordMap';
import {
  trackBlogCtaClick,
  trackBlogShare,
  trackBlogView,
  trackRelatedProductClick,
} from '../../utils/analyticsTracker';

interface BlogArticleDetailViewProps {
  slug: string;
  onOpenArticle: (slug: string) => void;
  onNavigatePath: (path: string) => void;
  onArticleLoaded?: (post: BlogPost | null) => void;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const BlogArticleDetailView: React.FC<BlogArticleDetailViewProps> = ({
  slug,
  onOpenArticle,
  onNavigatePath,
  onArticleLoaded,
}) => {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    fetchPublicBlogBySlug(slug)
      .then((res) => {
        if (cancelled) return;
        if (res.redirectToSlug && res.redirectToSlug !== slug) {
          onOpenArticle(res.redirectToSlug);
          return;
        }
        if (!res.post) {
          setPost(null);
          setNotFound(true);
          onArticleLoaded?.(null);
          return;
        }
        setPost(res.post);
        setRelatedArticles(res.relatedArticles || []);
        onArticleLoaded?.(res.post);
        trackBlogView({
          slug: res.post.slug,
          title: res.post.title,
          categorySlug: res.post.categorySlug,
          contentKind: res.post.contentKind,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setPost(null);
        setNotFound(true);
        onArticleLoaded?.(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const relatedProducts = useMemo(() => {
    if (!post?.relatedProductIds?.length) return [];
    return post.relatedProductIds
      .map((id) => PRODUCTS.find((p) => p.id === id))
      .filter((p): p is (typeof PRODUCTS)[number] => Boolean(p));
  }, [post]);

  const relatedCategorySeo = useMemo(() => {
    if (!post?.relatedCategorySlug) return undefined;
    return findCategoryBySlugOrAlias(post.relatedCategorySlug);
  }, [post]);

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    handler: () => void
  ) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      e.preventDefault();
      handler();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF9FD] py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3" />
          <div className="h-10 bg-slate-200 rounded w-4/5" />
          <div className="h-72 bg-slate-200 rounded-2xl" />
          <div className="space-y-3">
            <div className="h-4 bg-slate-200 rounded w-full" />
            <div className="h-4 bg-slate-200 rounded w-11/12" />
            <div className="h-4 bg-slate-200 rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-[#FAF9FD] py-16 px-4">
        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#FF7A00]">
            404 — Article Unavailable
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1530]">
            This article could not be found
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            The guide you requested may have been moved, unpublished, or removed. Browse all published guides or explore our active custom printing products.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <a
              href="/blogs"
              onClick={(e) => handleLinkClick(e, () => onNavigatePath('/blogs'))}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B1530] hover:bg-[#162956] text-white text-sm font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>All Blogs &amp; Guides</span>
            </a>
            <a
              href="/catalog"
              onClick={(e) => handleLinkClick(e, () => onNavigatePath('/catalog'))}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-sm font-semibold"
            >
              <span>Browse Products</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  const shareUrl = post.canonicalUrl || `${CANONICAL_ORIGIN}/blogs/${encodeURIComponent(post.slug)}`;
  const encodedShareUrl = encodeURIComponent(shareUrl);
  const encodedShareTitle = encodeURIComponent(post.title);

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      trackBlogShare({ blogSlug: post.slug, method: 'copy_link' });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // clipboard blocked in sandbox
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9FD]">
      {/* Dark Navy Article Header */}
      <header className="bg-[#071B35] text-white border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-5">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, () => onNavigatePath('/'))}
              className="hover:text-[#FF7A00] transition-colors"
            >
              Home
            </a>
            <span>/</span>
            <a
              href="/blogs"
              onClick={(e) => handleLinkClick(e, () => onNavigatePath('/blogs'))}
              className="hover:text-[#FF7A00] transition-colors"
            >
              Blogs &amp; Guides
            </a>
            <span>/</span>
            <span className="text-[#FF7A00] font-medium">{post.categoryName || post.categorySlug}</span>
          </nav>

          {/* Single H1 */}
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            {post.title}
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            {post.excerpt}
          </p>

          {/* Author, Date & Reading Time */}
          <div className="flex flex-wrap items-center gap-4 pt-2 text-xs sm:text-sm text-slate-300 border-t border-white/10">
            <div className="inline-flex items-center gap-2">
              <User className="w-4 h-4 text-[#FF7A00]" />
              <span className="font-semibold text-white">{post.authorName}</span>
              {post.authorRole && <span className="text-slate-400">• {post.authorRole}</span>}
            </div>
            {post.publishedAt && (
              <div className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#FF7A00]" />
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              </div>
            )}
            <div className="inline-flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#FF7A00]" />
              <span>{post.readingTimeMinutes} min read</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Article Body + Sidebar/Recommendations */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* Featured Image — explicit width/height, descriptive ALT, NO unwanted popup/lightbox */}
        {post.featuredImageUrl && (
          <figure className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <img
              src={post.featuredImageUrl}
              alt={post.featuredImageAlt || post.title}
              width={post.featuredImageWidth || 1200}
              height={post.featuredImageHeight || 675}
              className="w-full h-auto max-h-[480px] object-cover block select-none"
            />
            {post.featuredImageAlt && (
              <figcaption className="px-5 py-3 text-xs text-slate-500 border-t border-slate-100 bg-slate-50/70">
                {post.featuredImageAlt}
              </figcaption>
            )}
          </figure>
        )}

        {/* Structured Article Body (Safe zero-XSS renderer) */}
        <article className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-10 shadow-xs space-y-8">
          <SafeArticleRenderer
            content={post.content}
            onInternalNavigate={(targetPath, label) => {
              trackBlogCtaClick({
                blogSlug: post.slug,
                ctaLabel: label,
                targetPath,
                categorySlug: post.categorySlug,
              });
              onNavigatePath(targetPath);
            }}
          />

          {/* Tags & Social Sharing Bar */}
          <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md"
                >
                  <Tag className="w-3 h-3 text-[#FF7A00]" />
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-slate-500 font-semibold mr-1">
                <Share2 className="w-3.5 h-3.5" />
                Share:
              </span>
              <a
                href={`https://wa.me/?text=${encodedShareTitle}%20${encodedShareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackBlogShare({ blogSlug: post.slug, method: 'whatsapp' })}
                className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold transition-colors"
              >
                WhatsApp
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodedShareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackBlogShare({ blogSlug: post.slug, method: 'linkedin' })}
                className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold transition-colors"
              >
                LinkedIn
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodedShareTitle}&url=${encodedShareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackBlogShare({ blogSlug: post.slug, method: 'x' })}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200 font-semibold transition-colors"
              >
                X
              </a>
              <button
                type="button"
                onClick={handleCopyShare}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-orange-50 text-[#FF7A00] hover:bg-orange-100 font-semibold transition-colors cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>
        </article>

        {/* Visible Article FAQs (Strictly synced with conditional FAQPage JSON-LD) */}
        {post.faqs.length > 0 && (
          <section
            aria-label="Frequently Asked Questions"
            className="bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-4"
          >
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#FF7A00]">
                Quick Answers
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B1530] mt-0.5">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {post.faqs.map((faq, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div key={faq.question} className="bg-white">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      className="w-full px-4 sm:px-5 py-3.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <h3 className="font-display font-semibold text-sm text-[#0B1530]">
                        {faq.question}
                      </h3>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                          isOpen ? 'rotate-180 text-[#FF7A00]' : ''
                        }`}
                      />
                    </button>
                    <div
                      className={`px-4 sm:px-5 pb-4 text-sm text-slate-600 leading-relaxed ${
                        isOpen ? 'block' : 'hidden'
                      }`}
                    >
                      {faq.answer}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Related Products Recommendations (Active Inventory Only) */}
        {relatedProducts.length > 0 && (
          <section aria-label="Recommended Custom Printed Products" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#FF7A00]">
                  Featured in This Guide
                </span>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B1530]">
                  Recommended Custom Printed Products
                </h2>
              </div>
              {relatedCategorySeo && (
                <a
                  href={`/category/${relatedCategorySeo.slug}`}
                  onClick={(e) =>
                    handleLinkClick(e, () => {
                      trackBlogCtaClick({
                        blogSlug: post.slug,
                        ctaLabel: `Browse ${relatedCategorySeo.name}`,
                        targetPath: `/category/${relatedCategorySeo.slug}`,
                        categorySlug: post.categorySlug,
                      });
                      onNavigatePath(`/category/${relatedCategorySeo.slug}`);
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1530] hover:text-[#FF7A00]"
                >
                  <span>Explore {relatedCategorySeo.name}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {relatedProducts.map((prod) => {
                const prodHref = getProductPath(prod.slug);
                const prodTitle = getProductH1(prod.id, prod.name);
                const prodImg = prod.colors?.[0]?.imageFront || '';
                const prodAlt = getProductCardImageAlt(prod.id, prodTitle);
                return (
                  <a
                    key={prod.id}
                    href={prodHref}
                    onClick={(e) =>
                      handleLinkClick(e, () => {
                        trackRelatedProductClick({
                          blogSlug: post.slug,
                          productId: prod.id,
                          productName: prodTitle,
                          categorySlug: relatedCategorySeo?.slug,
                        });
                        onNavigatePath(prodHref);
                      })
                    }
                    className="group bg-white rounded-2xl border border-slate-200/90 hover:border-[#FF7A00] p-4 flex items-center gap-4 shadow-xs transition-all"
                  >
                    {prodImg && (
                      <img
                        src={prodImg}
                        alt={prodAlt}
                        width={96}
                        height={96}
                        loading="lazy"
                        decoding="async"
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover bg-slate-50 shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="font-display text-sm sm:text-base font-bold text-[#0B1530] group-hover:text-[#FF7A00] transition-colors line-clamp-2">
                        {prodTitle}
                      </h3>
                      <p className="text-xs text-slate-500">
                        From ₹{Math.round(prod.basePrice).toLocaleString('en-IN')} • MOQ {prod.moq || 1}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF7A00] pt-1">
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Customize &amp; Order</span>
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Clear Commercial CTA Band */}
        <section className="bg-[#0B1530] text-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <span className="text-xs font-mono uppercase tracking-wider text-[#FF7A00]">
              Pan-India Custom Printing • 18% GST Invoice
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold">
              Ready to customize merchandise for your team or event?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Get transparent INR volume slabs, pre-production digital proofs, and reliable dispatch across India.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <a
              href={relatedCategorySeo ? `/category/${relatedCategorySeo.slug}` : '/catalog'}
              onClick={(e) => {
                const target = relatedCategorySeo
                  ? `/category/${relatedCategorySeo.slug}`
                  : '/catalog';
                handleLinkClick(e, () => {
                  trackBlogCtaClick({
                    blogSlug: post.slug,
                    ctaLabel: relatedCategorySeo ? `Shop ${relatedCategorySeo.name}` : 'Shop Catalog',
                    targetPath: target,
                    categorySlug: post.categorySlug,
                  });
                  onNavigatePath(target);
                });
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-sm font-semibold transition-colors"
            >
              <span>{relatedCategorySeo ? `Shop ${relatedCategorySeo.name}` : 'Browse Catalog'}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="/bulk"
              onClick={(e) =>
                handleLinkClick(e, () => {
                  trackBlogCtaClick({
                    blogSlug: post.slug,
                    ctaLabel: 'Request Bulk Quote',
                    targetPath: '/bulk',
                    categorySlug: post.categorySlug,
                  });
                  onNavigatePath('/bulk');
                })
              }
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
            >
              <Layers className="w-4 h-4" />
              <span>Request Bulk Quote</span>
            </a>
          </div>
        </section>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <section aria-label="Related Articles" className="space-y-4">
            <h2 className="font-display text-xl font-bold text-[#0B1530]">
              Related Guides &amp; Resources
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedArticles.map((rel) => (
                <a
                  key={rel.id}
                  href={`/blogs/${encodeURIComponent(rel.slug)}`}
                  onClick={(e) => handleLinkClick(e, () => onOpenArticle(rel.slug))}
                  className="bg-white rounded-xl border border-slate-200 hover:border-[#FF7A00] p-4 flex flex-col justify-between gap-3 transition-colors"
                >
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#FF7A00]">
                      {rel.categoryName || rel.categorySlug}
                    </span>
                    <h3 className="font-display text-sm font-bold text-[#0B1530] line-clamp-2">
                      {rel.title}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 inline-flex items-center gap-1">
                    <span>{rel.readingTimeMinutes} min read</span>
                    <ArrowRight className="w-3 h-3 text-[#FF7A00]" />
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Back to Resource Center */}
        <div>
          <a
            href="/blogs"
            onClick={(e) => handleLinkClick(e, () => onNavigatePath('/blogs'))}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0B1530] hover:text-[#FF7A00]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Blogs &amp; Guides</span>
          </a>
        </div>
      </main>
    </div>
  );
};
