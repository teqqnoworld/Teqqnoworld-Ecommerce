import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  Clock,
  FileText,
  Layers,
  Search,
  Sparkles,
  Tag,
  User,
} from 'lucide-react';
import type { BlogCategory, BlogContentKind, BlogPost } from '../../types/blog';
import { fetchPublicBlogs } from '../../services/blogService';
import {
  SEO_BLOGS_META,
  SEO_CATEGORIES,
  SEO_GUIDES_META,
  SEO_RESOURCES_META,
} from '../../config/seoRoutes';
import {
  trackBlogCategoryView,
  trackBlogSearch,
} from '../../utils/analyticsTracker';

interface BlogResourceCenterViewProps {
  hubPath: '/blogs' | '/guides' | '/resources';
  onOpenArticle: (slug: string) => void;
  onNavigatePath: (path: string) => void;
}

function formatPublishedDate(iso?: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const BlogResourceCenterView: React.FC<BlogResourceCenterViewProps> = ({
  hubPath,
  onOpenArticle,
  onNavigatePath,
}) => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  const pageMeta =
    hubPath === '/guides'
      ? SEO_GUIDES_META
      : hubPath === '/resources'
        ? SEO_RESOURCES_META
        : SEO_BLOGS_META;

  const contentTypeFilter: BlogContentKind | 'all' =
    hubPath === '/guides' ? 'guide' : hubPath === '/resources' ? 'resource' : 'all';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPublicBlogs({
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      q: activeSearch || undefined,
      type: contentTypeFilter,
    })
      .then((res) => {
        if (cancelled) return;
        setPosts(res.posts);
        setCategories(res.categories);
        if (activeSearch) {
          trackBlogSearch({
            query: activeSearch,
            resultCount: res.posts.length,
            pagePath: hubPath,
          });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Unable to load articles right now.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hubPath, selectedCategory, activeSearch, contentTypeFilter]);

  const featuredPosts = useMemo(
    () => posts.filter((p) => p.featured).slice(0, 2),
    [posts]
  );

  const latestPosts = useMemo(() => {
    if (featuredPosts.length === 0 || activeSearch || selectedCategory !== 'all') {
      return posts;
    }
    const featuredIds = new Set(featuredPosts.map((f) => f.id));
    const remaining = posts.filter((p) => !featuredIds.has(p.id));
    return remaining.length > 0 ? remaining : posts;
  }, [posts, featuredPosts, activeSearch, selectedCategory]);

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    handler: () => void
  ) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      e.preventDefault();
      handler();
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveSearch(searchInput.trim());
  };

  const handleCategorySelect = (slug: string) => {
    setSelectedCategory(slug);
    trackBlogCategoryView({ categorySlug: slug, pagePath: hubPath });
  };

  return (
    <div className="min-h-screen bg-[#FAF9FD]">
      {/* Dark Navy Hero Header */}
      <section className="bg-[#071B35] text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="text-xs text-slate-300 mb-5 flex items-center gap-2">
            <a
              href="/"
              onClick={(e) => handleLinkClick(e, () => onNavigatePath('/'))}
              className="hover:text-[#FF7A00] transition-colors"
            >
              Home
            </a>
            <span>/</span>
            <span className="text-white font-medium">
              {hubPath === '/guides'
                ? 'Buying Guides'
                : hubPath === '/resources'
                  ? 'Print Resources'
                  : 'Blogs & Guides'}
            </span>
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#FF7A00]">
                <BookOpen className="w-4 h-4" />
                <span>TeqqnoWorld Knowledge Hub • Pan India</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
                {pageMeta.h1}
              </h1>
              <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                {pageMeta.description}
              </p>

              {/* Hub Mode Tabs (/blogs, /guides, /resources) */}
              <div className="flex flex-wrap gap-2 pt-2">
                {[
                  { path: '/blogs', label: 'All Articles' },
                  { path: '/guides', label: 'Buying Guides' },
                  { path: '/resources', label: 'Artwork & B2B Resources' },
                ].map((tab) => {
                  const isActive = hubPath === tab.path;
                  return (
                    <a
                      key={tab.path}
                      href={tab.path}
                      onClick={(e) => handleLinkClick(e, () => onNavigatePath(tab.path))}
                      className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                        isActive
                          ? 'bg-[#FF7A00] text-white'
                          : 'bg-white/10 text-slate-200 hover:bg-white/20'
                      }`}
                    >
                      {tab.label}
                    </a>
                  );
                })}
              </div>
            </div>

            {/* Search Input */}
            <div className="lg:col-span-4">
              <form onSubmit={handleSearchSubmit} className="relative">
                <label htmlFor="blog-hub-search" className="sr-only">
                  Search buying guides and custom printing resources
                </label>
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="blog-hub-search"
                  type="search"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    if (!e.target.value.trim() && activeSearch) setActiveSearch('');
                  }}
                  placeholder="Search fabrics, standees, 300 GSM..."
                  className="w-full pl-10 pr-24 py-3 rounded-xl bg-white text-[#0B1530] placeholder:text-slate-400 text-sm border border-white/20 focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-lg bg-[#0B1530] hover:bg-[#FF7A00] text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Search
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-10">
        {/* Category Filters */}
        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-5">
            <button
              type="button"
              onClick={() => handleCategorySelect('all')}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#0B1530] text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-[#FF7A00] hover:text-[#FF7A00]'
              }`}
            >
              All Topics
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategorySelect(cat.slug)}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  selectedCategory === cat.slug
                    ? 'bg-[#0B1530] text-white'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-[#FF7A00] hover:text-[#FF7A00]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse"
              >
                <div className="h-48 bg-slate-200" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-6 bg-slate-200 rounded w-5/6" />
                  <div className="h-4 bg-slate-100 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-6 text-sm">
            {error}
          </div>
        )}

        {/* Featured Articles Section */}
        {!loading && !error && featuredPosts.length > 0 && !activeSearch && selectedCategory === 'all' && (
          <section aria-label="Featured Articles" className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF7A00]" />
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B1530]">
                Featured Buying Guides
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {featuredPosts.map((post) => (
                <article
                  key={post.id}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
                >
                  {post.featuredImageUrl && (
                    <a
                      href={`/blogs/${encodeURIComponent(post.slug)}`}
                      onClick={(e) => handleLinkClick(e, () => onOpenArticle(post.slug))}
                      className="block overflow-hidden bg-slate-100 aspect-[16/9]"
                    >
                      <img
                        src={post.featuredImageUrl}
                        alt={post.featuredImageAlt || post.title}
                        width={post.featuredImageWidth || 1200}
                        height={post.featuredImageHeight || 675}
                        className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                      />
                    </a>
                  )}
                  <div className="p-6 flex flex-col flex-1 justify-between space-y-4">
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="font-semibold text-[#FF7A00] uppercase tracking-wider">
                          {post.categoryName || post.categorySlug}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {post.readingTimeMinutes} min read
                        </span>
                        {post.publishedAt && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatPublishedDate(post.publishedAt)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-display text-xl font-bold text-[#0B1530] leading-snug">
                        <a
                          href={`/blogs/${encodeURIComponent(post.slug)}`}
                          onClick={(e) => handleLinkClick(e, () => onOpenArticle(post.slug))}
                          className="hover:text-[#FF7A00] transition-colors"
                        >
                          {post.title}
                        </a>
                      </h3>
                      <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {post.authorName}
                      </span>
                      <a
                        href={`/blogs/${encodeURIComponent(post.slug)}`}
                        onClick={(e) => handleLinkClick(e, () => onOpenArticle(post.slug))}
                        className="inline-flex items-center gap-1 font-semibold text-[#FF7A00] hover:text-[#d86400]"
                      >
                        <span>Read Guide</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Latest Articles Grid */}
        {!loading && !error && latestPosts.length > 0 && (
          <section aria-label="Latest Articles" className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B1530]">
                {activeSearch
                  ? `Search Results for "${activeSearch}" (${posts.length})`
                  : 'Latest Articles & Print Resources'}
              </h2>
              {activeSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setActiveSearch('');
                  }}
                  className="text-xs font-semibold text-[#FF7A00] hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestPosts.map((post) => (
                <article
                  key={post.id}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
                >
                  {post.featuredImageUrl && (
                    <a
                      href={`/blogs/${encodeURIComponent(post.slug)}`}
                      onClick={(e) => handleLinkClick(e, () => onOpenArticle(post.slug))}
                      className="block overflow-hidden bg-slate-100 aspect-[16/9]"
                    >
                      <img
                        src={post.featuredImageUrl}
                        alt={post.featuredImageAlt || post.title}
                        width={post.featuredImageWidth || 1200}
                        height={post.featuredImageHeight || 675}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                      />
                    </a>
                  )}
                  <div className="p-5 flex flex-col flex-1 justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-[#FF7A00] uppercase tracking-wider">
                          {post.categoryName || post.categorySlug}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {post.readingTimeMinutes} min read
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-[#0B1530] leading-snug">
                        <a
                          href={`/blogs/${encodeURIComponent(post.slug)}`}
                          onClick={(e) => handleLinkClick(e, () => onOpenArticle(post.slug))}
                          className="hover:text-[#FF7A00] transition-colors"
                        >
                          {post.title}
                        </a>
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-3">
                        {post.excerpt}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                      <span className="text-slate-500">
                        {formatPublishedDate(post.publishedAt) || post.authorName}
                      </span>
                      <a
                        href={`/blogs/${encodeURIComponent(post.slug)}`}
                        onClick={(e) => handleLinkClick(e, () => onOpenArticle(post.slug))}
                        className="inline-flex items-center gap-1 font-semibold text-[#0B1530] hover:text-[#FF7A00]"
                      >
                        <span>Read More</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Honest Empty State (When No Published Articles Match or Editorial Review Is Pending) */}
        {!loading && !error && posts.length === 0 && (
          <section className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center space-y-5">
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#FF7A00] flex items-center justify-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <div className="space-y-2 max-w-xl mx-auto">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B1530]">
                {activeSearch || selectedCategory !== 'all'
                  ? 'No matching published guides found'
                  : 'New Custom Printing Buying Guides Are Under Editorial Review'}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {activeSearch || selectedCategory !== 'all'
                  ? 'Try another search term or browse all topics. You can also explore our verified product categories and interactive calculators below.'
                  : 'Every TeqqnoWorld guide is manually verified against our live product specifications before publication. Meanwhile, browse our active custom merchandise categories or calculate instant INR bulk pricing.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              {(activeSearch || selectedCategory !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('');
                    setActiveSearch('');
                    setSelectedCategory('all');
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-[#0B1530] hover:border-[#FF7A00] cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
              <a
                href="/catalog"
                onClick={(e) => handleLinkClick(e, () => onNavigatePath('/catalog'))}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-sm font-semibold transition-colors"
              >
                <span>Browse All Custom Products</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="/quote-calculator"
                onClick={(e) => handleLinkClick(e, () => onNavigatePath('/quote-calculator'))}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B1530] hover:bg-[#152852] text-white text-sm font-semibold transition-colors"
              >
                <span>Open Bulk Quote Calculator</span>
              </a>
            </div>
          </section>
        )}

        {/* Contextual Product Category Navigation Band (Strengthens Internal Linking) */}
        <section
          aria-label="Shop by Custom Merchandise Category"
          className="bg-[#0B1530] text-white rounded-2xl p-6 sm:p-8 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#FF7A00]">
                Direct Product Categories
              </span>
              <h2 className="font-display text-xl sm:text-2xl font-bold mt-1">
                Explore Custom Printed Products Across India
              </h2>
            </div>
            <a
              href="/bulk"
              onClick={(e) => handleLinkClick(e, () => onNavigatePath('/bulk'))}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs sm:text-sm font-semibold transition-colors"
            >
              <Layers className="w-4 h-4" />
              <span>Request Corporate Bulk Quote</span>
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {SEO_CATEGORIES.map((cat) => (
              <a
                key={cat.slug}
                href={`/category/${cat.slug}`}
                onClick={(e) => handleLinkClick(e, () => onNavigatePath(`/category/${cat.slug}`))}
                className="group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#FF7A00]/60 rounded-xl p-4 transition-colors flex flex-col justify-between gap-2"
              >
                <div className="flex items-center gap-2 text-[#FF7A00]">
                  <Tag className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-sm font-semibold text-white group-hover:text-[#FF7A00] transition-colors">
                    {cat.name}
                  </span>
                </div>
                <span className="text-xs text-slate-300 inline-flex items-center gap-1">
                  <span>View Products</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </a>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
