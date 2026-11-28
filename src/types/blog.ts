// ==============================================================================
// TEQQNOWORLD PHASE 6 — CONTENT SEO & BLOG CMS SHARED TYPES
// Pure TypeScript module shared across Express API (server/blogEngine.ts,
// server/blogRoutes.ts, server/seoMiddleware.ts, server/seoAnalyticsEngine.ts)
// and React Storefront + Admin CMS (src/components/blog/*, src/components/admin/blog/*).
// ==============================================================================

export type BlogPostStatus = 'draft' | 'published' | 'scheduled';

export type BlogContentKind = 'article' | 'guide' | 'resource';

export interface BlogFaqItem {
  question: string;
  answer: string;
}

export interface BlogCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string; // Safe structured Markdown subset rendered without dangerouslySetInnerHTML
  contentKind: BlogContentKind;
  status: BlogPostStatus;
  featured: boolean;
  categorySlug: string;
  categoryName?: string;
  tags: string[];
  featuredImageUrl: string;
  featuredImageAlt: string;
  featuredImageWidth: number;
  featuredImageHeight: number;
  authorName: string;
  authorRole: string;
  readingTimeMinutes: number;
  // SEO Metadata
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  // Internal Linking & Topical Authority
  topicCluster: string;
  relatedCategorySlug: string;
  relatedProductIds: string[];
  relatedArticleSlugs: string[];
  faqs: BlogFaqItem[];
  // Publication Lifecycle
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface BlogSlugRedirect {
  oldSlug: string;
  newSlug: string;
  postId: string;
  createdAt: string;
}

export interface TopicalClusterDefinition {
  id: string;
  mainTopic: string;
  hubIntent: string;
  targetCategorySlug: string;
  targetCategoryUrl: string;
  targetProductIds: ReadonlyArray<string>;
  targetProductUrls: ReadonlyArray<string>;
  supportingArticles: ReadonlyArray<{
    slug: string;
    title: string;
    primaryKeyword: string;
    searchIntent: 'Informational' | 'Commercial Investigation' | 'Comparison / Buying Guide';
  }>;
  cannibalizationGuardNote: string;
}

export interface EditorialCalendarItem {
  id: string;
  month: 1 | 2 | 3;
  week: number;
  title: string;
  slug: string;
  contentKind: BlogContentKind;
  topicCluster: string;
  blogCategorySlug: string;
  searchIntent: 'Informational' | 'Commercial Investigation' | 'Comparison / Buying Guide';
  primaryKeyword: string;
  secondaryKeywords: ReadonlyArray<string>;
  searchVolume: 'Not verified';
  keywordDifficulty: 'Not verified';
  targetAudience: string;
  relatedCategorySlug: string;
  relatedProductIds: ReadonlyArray<string>;
  suggestedInternalLinks: ReadonlyArray<{ label: string; href: string }>;
  outline: ReadonlyArray<string>;
  priority: 'High' | 'Medium';
  ctaLabel: string;
  ctaHref: string;
}

export interface BlogArticlePerformanceRow {
  postId: string;
  slug: string;
  path: string;
  title: string;
  status: BlogPostStatus;
  categorySlug: string;
  publishedAt: string | null;
  articleViews: number;
  organicLandingSessions: number;
  searchClicks: number | null;
  searchImpressions: number | null;
  searchCtr: number | null;
  averagePosition: number | null;
  averageEngagementSeconds: number | null; // Null / Data unavailable unless GA4 engagement exists
  relatedProductClicks: number;
  ctaClicks: number;
  shareClicks: number;
  articleToProductRatePct: number | null;
}

export interface ContentPerformanceSummary {
  publishedArticlesCount: number;
  draftArticlesCount: number;
  scheduledArticlesCount: number;
  totalArticleViews: number;
  organicBlogSessions: number;
  blogSearchClicks: number | null;
  blogSearchImpressions: number | null;
  averageEngagementSeconds: number | null;
  engagementDataNote: string;
  totalProductClicksFromArticles: number;
  totalBlogCtaClicks: number;
  totalBlogShares: number;
  totalBlogSearches: number;
  articleToProductEngagementRatePct: number | null;
  articles: BlogArticlePerformanceRow[];
  dataSources: string[];
}
