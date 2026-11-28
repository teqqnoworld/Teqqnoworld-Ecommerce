import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileText,
  FolderPlus,
  Globe,
  Image as ImageIcon,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  BlogCategory,
  BlogContentKind,
  BlogFaqItem,
  BlogPost,
  BlogPostStatus,
  BlogSlugRedirect,
  EditorialCalendarItem,
  TopicalClusterDefinition,
} from '../../../types/blog';
import {
  createAdminBlogPost,
  deleteAdminBlogCategory,
  deleteAdminBlogPost,
  fetchAdminBlogsInventory,
  saveAdminBlogCategory,
  updateAdminBlogPost,
  updateAdminBlogPostStatus,
  uploadAdminBlogImage,
} from '../../../services/blogService';
import { SafeArticleRenderer } from '../../blog/SafeArticleRenderer';
import { PRODUCTS } from '../../../data/mockData';
import { SEO_CATEGORIES, getProductH1 } from '../../../config/seoRoutes';

type AdminBlogTab = 'posts' | 'editor' | 'categories' | 'calendar';

interface EditorDraftState {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentKind: BlogContentKind;
  status: BlogPostStatus;
  featured: boolean;
  categorySlug: string;
  tagsText: string;
  featuredImageUrl: string;
  featuredImageAlt: string;
  featuredImageWidth: number;
  featuredImageHeight: number;
  authorName: string;
  authorRole: string;
  seoTitle: string;
  metaDescription: string;
  canonicalUrl: string;
  focusKeyword: string;
  secondaryKeywordsText: string;
  topicCluster: string;
  relatedCategorySlug: string;
  relatedProductIds: string[];
  relatedArticleSlugs: string[];
  faqs: BlogFaqItem[];
  scheduledAt: string;
}

function emptyEditorDraft(defaultCategorySlug = 'buying-guides'): EditorDraftState {
  return {
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    contentKind: 'guide',
    status: 'draft',
    featured: false,
    categorySlug: defaultCategorySlug,
    tagsText: '',
    featuredImageUrl: '',
    featuredImageAlt: '',
    featuredImageWidth: 1200,
    featuredImageHeight: 675,
    authorName: 'TeqqnoWorld Editorial Desk',
    authorRole: 'Custom Printing & Merchandising Team',
    seoTitle: '',
    metaDescription: '',
    canonicalUrl: '',
    focusKeyword: '',
    secondaryKeywordsText: '',
    topicCluster: '',
    relatedCategorySlug: '',
    relatedProductIds: [],
    relatedArticleSlugs: [],
    faqs: [],
    scheduledAt: '',
  };
}

function postToEditorDraft(post: BlogPost): EditorDraftState {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    contentKind: post.contentKind,
    status: post.status,
    featured: post.featured,
    categorySlug: post.categorySlug,
    tagsText: post.tags.join(', '),
    featuredImageUrl: post.featuredImageUrl,
    featuredImageAlt: post.featuredImageAlt,
    featuredImageWidth: post.featuredImageWidth || 1200,
    featuredImageHeight: post.featuredImageHeight || 675,
    authorName: post.authorName,
    authorRole: post.authorRole,
    seoTitle: post.seoTitle,
    metaDescription: post.metaDescription,
    canonicalUrl: post.canonicalUrl,
    focusKeyword: post.focusKeyword,
    secondaryKeywordsText: post.secondaryKeywords.join(', '),
    topicCluster: post.topicCluster,
    relatedCategorySlug: post.relatedCategorySlug,
    relatedProductIds: [...post.relatedProductIds],
    relatedArticleSlugs: [...post.relatedArticleSlugs],
    faqs: post.faqs.map((f) => ({ ...f })),
    scheduledAt: post.scheduledAt ? post.scheduledAt.slice(0, 16) : '',
  };
}

function slugifyQuick(val: string): string {
  return val
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110);
}

export const AdminBlogManagementPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminBlogTab>('posts');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [redirects, setRedirects] = useState<BlogSlugRedirect[]>([]);
  const [calendar, setCalendar] = useState<EditorialCalendarItem[]>([]);
  const [clusters, setClusters] = useState<TopicalClusterDefinition[]>([]);
  const [storageMode, setStorageMode] = useState<'supabase' | 'local_dev_fallback'>('local_dev_fallback');

  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | BlogPostStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Editor & Preview state
  const [draft, setDraft] = useState<EditorDraftState>(() => emptyEditorDraft());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);

  // Category editor state
  const [newCatName, setNewCatName] = useState('');
  const [newCatSlug, setNewCatSlug] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 5000);
  };

  const loadInventory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminBlogsInventory();
      setPosts(res.posts);
      setCategories(res.categories);
      setRedirects(res.redirects);
      setCalendar(res.editorialCalendar);
      setClusters(res.topicClusters);
      setStorageMode(res.storageMode);
    } catch (err: any) {
      setError(err?.message || 'Unable to load blog management data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInventory();
  }, []);

  const counts = useMemo(() => {
    const published = posts.filter((p) => p.status === 'published').length;
    const drafts = posts.filter((p) => p.status === 'draft').length;
    const scheduled = posts.filter((p) => p.status === 'scheduled').length;
    return { total: posts.length, published, drafts, scheduled };
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const needle = searchTerm.trim().toLowerCase();
        const hay = `${p.title} ${p.slug} ${p.focusKeyword} ${p.categoryName || p.categorySlug}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [posts, statusFilter, searchTerm]);

  const handleNewPost = () => {
    setDraft(emptyEditorDraft(categories[0]?.slug || 'buying-guides'));
    setActiveTab('editor');
  };

  const handleEditPost = (post: BlogPost) => {
    setDraft(postToEditorDraft(post));
    setActiveTab('editor');
  };

  const handleStartDraftFromCalendar = (item: EditorialCalendarItem) => {
    const existing = posts.find((p) => p.slug === item.slug);
    if (existing) {
      handleEditPost(existing);
      showNotice(`Loaded existing article "${existing.title}" for editing.`);
      return;
    }
    const outlineBody = item.outline
      .map((heading, idx) => `## ${idx + 1}. ${heading}\n\n[Draft notes: Add verified TeqqnoWorld details here before publishing.]`)
      .join('\n\n');
    const linksBlock = item.suggestedInternalLinks
      .map((l) => `- [${l.label}](${l.href})`)
      .join('\n');

    setDraft({
      ...emptyEditorDraft(item.blogCategorySlug),
      title: item.title,
      slug: item.slug,
      excerpt: `Practical Indian buyer guide covering ${item.primaryKeyword}. Review and edit before publishing.`,
      content: `${outlineBody}\n\n## Helpful TeqqnoWorld Links\n\n${linksBlock}`,
      contentKind: item.contentKind,
      status: 'draft', // STRICT: Never auto-publish!
      categorySlug: item.blogCategorySlug,
      seoTitle: `${item.title.slice(0, 52).trim()} | TeqqnoWorld`,
      metaDescription: `Explore ${item.primaryKeyword} for Indian businesses with verified specs, low MOQs, and 18% GST billing at TeqqnoWorld.`,
      canonicalUrl: `https://teqqnoworld.com/blogs/${item.slug}`,
      focusKeyword: item.primaryKeyword,
      secondaryKeywordsText: item.secondaryKeywords.join(', '),
      topicCluster: item.topicCluster,
      relatedCategorySlug: item.relatedCategorySlug,
      relatedProductIds: [...item.relatedProductIds],
    });
    setActiveTab('editor');
    showNotice('Opened calendar topic as a DRAFT for manual review & editing.');
  };

  const handleSavePost = async (overrideStatus?: BlogPostStatus) => {
    setSaving(true);
    setError(null);
    try {
      const targetStatus = overrideStatus ?? draft.status;
      if (targetStatus === 'scheduled' && !draft.scheduledAt) {
        throw new Error('Select a scheduled publication date & time first.');
      }

      const payload: Partial<BlogPost> = {
        title: draft.title.trim(),
        slug: draft.slug.trim() || slugifyQuick(draft.title),
        excerpt: draft.excerpt.trim(),
        content: draft.content,
        contentKind: draft.contentKind,
        status: targetStatus,
        featured: draft.featured,
        categorySlug: draft.categorySlug,
        tags: draft.tagsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        featuredImageUrl: draft.featuredImageUrl.trim(),
        featuredImageAlt: draft.featuredImageAlt.trim(),
        featuredImageWidth: Number(draft.featuredImageWidth) || 1200,
        featuredImageHeight: Number(draft.featuredImageHeight) || 675,
        authorName: draft.authorName.trim(),
        authorRole: draft.authorRole.trim(),
        seoTitle: draft.seoTitle.trim(),
        metaDescription: draft.metaDescription.trim(),
        canonicalUrl: draft.canonicalUrl.trim(),
        focusKeyword: draft.focusKeyword.trim(),
        secondaryKeywords: draft.secondaryKeywordsText
          .split(',')
          .map((k) => k.trim())
          .filter(Boolean),
        topicCluster: draft.topicCluster.trim(),
        relatedCategorySlug: draft.relatedCategorySlug.trim(),
        relatedProductIds: draft.relatedProductIds,
        relatedArticleSlugs: draft.relatedArticleSlugs,
        faqs: draft.faqs.filter((f) => f.question.trim() && f.answer.trim()),
        scheduledAt:
          targetStatus === 'scheduled' && draft.scheduledAt
            ? new Date(draft.scheduledAt).toISOString()
            : null,
      };

      if (draft.id) {
        const res = await updateAdminBlogPost(draft.id, payload);
        setDraft(postToEditorDraft(res.post));
        showNotice(
          res.redirectCreated
            ? `Saved! Created 301 redirect: /blogs/${res.redirectCreated.oldSlug} → /blogs/${res.redirectCreated.newSlug}`
            : `Article saved (${res.post.status}).`
        );
      } else {
        const created = await createAdminBlogPost(payload);
        setDraft(postToEditorDraft(created));
        showNotice(`Created article "${created.title}" as ${created.status}.`);
      }
      await loadInventory();
    } catch (err: any) {
      setError(err?.message || 'Unable to save article.');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatusToggle = async (post: BlogPost, nextStatus: BlogPostStatus) => {
    setError(null);
    try {
      await updateAdminBlogPostStatus(post.id, nextStatus);
      showNotice(
        nextStatus === 'published'
          ? `Published "${post.title}" — now live on /blogs/${post.slug} and included in sitemap.xml.`
          : `Unpublished "${post.title}" — moved back to Draft and excluded from public pages & sitemap.`
      );
      await loadInventory();
    } catch (err: any) {
      setError(err?.message || 'Status update failed.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    try {
      await deleteAdminBlogPost(deleteTarget.id);
      showNotice(`Deleted "${deleteTarget.title}".`);
      if (draft.id === deleteTarget.id) {
        setDraft(emptyEditorDraft());
        setActiveTab('posts');
      }
      setDeleteTarget(null);
      await loadInventory();
    } catch (err: any) {
      setError(err?.message || 'Delete failed.');
    }
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const allowed = ['image/webp', 'image/avif', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setError('Unsupported image type. Please upload a WebP, AVIF, PNG, or JPEG file.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('Image exceeds the 3 MB maximum limit.');
      return;
    }

    setUploadingImage(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });
      const uploaded = await uploadAdminBlogImage({
        dataUrl,
        mime: file.type,
        filename: file.name,
      });
      setDraft((prev) => ({
        ...prev,
        featuredImageUrl: uploaded.url,
      }));
      showNotice(`Uploaded featured image (${Math.round(uploaded.bytes / 1024)} KB) to ${uploaded.url}`);
    } catch (err: any) {
      setError(err?.message || 'Image upload failed.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await saveAdminBlogCategory({
        name: newCatName,
        slug: newCatSlug || undefined,
        description: newCatDesc,
      });
      setNewCatName('');
      setNewCatSlug('');
      setNewCatDesc('');
      showNotice('Category saved.');
      await loadInventory();
    } catch (err: any) {
      setError(err?.message || 'Failed to save category.');
    }
  };

  const handleDeleteCategory = async (cat: BlogCategory) => {
    setError(null);
    try {
      await deleteAdminBlogCategory(cat.id);
      showNotice(`Deleted category "${cat.name}".`);
      await loadInventory();
    } catch (err: any) {
      setError(err?.message || 'Unable to delete category.');
    }
  };

  const toggleRelatedProduct = (productId: string) => {
    setDraft((prev) => {
      const exists = prev.relatedProductIds.includes(productId);
      return {
        ...prev,
        relatedProductIds: exists
          ? prev.relatedProductIds.filter((id) => id !== productId)
          : [...prev.relatedProductIds, productId],
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0B1530] text-white rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#FF7A00]">
            <BookOpen className="w-4 h-4" />
            <span>Phase 6 • Content SEO &amp; Blog CMS</span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold">
            Blog &amp; Buying Guide Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-300">
            Create, preview, schedule, and publish verified buying guides. Drafts remain strictly private (HTTP 404 publicly) until explicitly published.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadInventory()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleNewPost}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Article</span>
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 font-medium">Published Articles</div>
          <div className="text-2xl font-display font-bold text-emerald-700 mt-1">{counts.published}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Live on /blogs &amp; sitemap.xml</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 font-medium">Draft Articles</div>
          <div className="text-2xl font-display font-bold text-amber-700 mt-1">{counts.drafts}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Hidden publicly (review required)</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 font-medium">Scheduled</div>
          <div className="text-2xl font-display font-bold text-sky-700 mt-1">{counts.scheduled}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Publishes when scheduled time arrives</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="text-xs text-slate-500 font-medium">301 Slug Redirects</div>
          <div className="text-2xl font-display font-bold text-[#0B1530] mt-1">{redirects.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Storage: {storageMode === 'supabase' ? 'Supabase DB' : 'Local Dev Store'}
          </div>
        </div>
      </div>

      {/* Feedback Alerts */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-4 py-3 text-xs sm:text-sm flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-xs sm:text-sm flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'posts' as AdminBlogTab, label: `All Articles (${posts.length})`, icon: FileText },
          {
            id: 'editor' as AdminBlogTab,
            label: draft.id ? 'Edit Article' : 'Article Editor',
            icon: Edit3,
          },
          { id: 'categories' as AdminBlogTab, label: `Categories (${categories.length})`, icon: FolderPlus },
          { id: 'calendar' as AdminBlogTab, label: `90-Day Calendar (${calendar.length})`, icon: Calendar },
        ].map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                active
                  ? 'bg-[#0B1530] text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:border-[#FF7A00]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ARTICLES LIST */}
      {activeTab === 'posts' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'published', 'draft', 'scheduled'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#FF7A00] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by title or slug..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading blog articles...</span>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-[#0B1530]">No articles match this filter.</p>
              <p className="text-xs text-slate-500">
                Create a new article or open a planned topic from the 90-Day Editorial Calendar.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold uppercase ${
                          post.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : post.status === 'scheduled'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {post.status}
                      </span>
                      <span className="text-slate-500 font-medium">
                        {post.categoryName || post.categorySlug}
                      </span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-500">{post.readingTimeMinutes} min read</span>
                      {post.featured && (
                        <span className="text-[#FF7A00] font-semibold">★ Featured</span>
                      )}
                    </div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-[#0B1530]">
                      {post.title}
                    </h3>
                    <div className="text-xs text-slate-500 font-mono truncate">
                      /blogs/{post.slug}
                      {post.focusKeyword ? ` • Focus: "${post.focusKeyword}"` : ''}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditPost(post)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#0B1530] text-xs font-semibold text-[#0B1530] cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(postToEditorDraft(post));
                        setPreviewOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-[#FF7A00] text-xs font-semibold text-slate-700 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                    {post.status !== 'published' ? (
                      <button
                        type="button"
                        onClick={() => void handleQuickStatusToggle(post, 'published')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleQuickStatusToggle(post, 'draft')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-semibold cursor-pointer"
                      >
                        <span>Unpublish</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(post)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                      aria-label={`Delete ${post.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FULL ARTICLE EDITOR */}
      {activeTab === 'editor' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Main Content */}
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display text-base font-bold text-[#0B1530]">
                  {draft.id ? 'Edit Article' : 'Create New Article'}
                </h3>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#0B1530] cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Before Publishing</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Article Title (H1) *
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraft((prev) => ({
                      ...prev,
                      title: val,
                      slug: prev.id ? prev.slug : slugifyQuick(val),
                    }));
                  }}
                  placeholder="e.g., Pure Cotton vs Fine Matty vs COOLMAX Polo Fabric Guide India"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    URL Slug (/blogs/...) *
                  </label>
                  <input
                    type="text"
                    value={draft.slug}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, slug: slugifyQuick(e.target.value) }))
                    }
                    placeholder="custom-polo-fabric-guide-india"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                  />
                  {draft.id && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Changing a published article&apos;s slug automatically records a 301 redirect.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Content Type &amp; Category
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={draft.contentKind}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          contentKind: e.target.value as BlogContentKind,
                        }))
                      }
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    >
                      <option value="guide">Buying Guide</option>
                      <option value="resource">Print Resource</option>
                      <option value="article">Article</option>
                    </select>
                    <select
                      value={draft.categorySlug}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, categorySlug: e.target.value }))
                      }
                      className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white"
                    >
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Summary Excerpt
                </label>
                <textarea
                  rows={2}
                  value={draft.excerpt}
                  onChange={(e) => setDraft((prev) => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="Concise 1–2 sentence overview displayed on listing cards and article header..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Article Content (Structured Markdown: ## H2, ### H3, - bullets, **bold**, [Link](/product/...))
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Safe zero-HTML rendering (XSS-proof)
                  </span>
                </div>
                <textarea
                  rows={14}
                  value={draft.content}
                  onChange={(e) => setDraft((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder="Write verified, helpful content grounded in TeqqnoWorld's active products..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#FF7A00]"
                />
              </div>

              {/* FAQs Editor */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#0B1530] uppercase tracking-wider">
                      Article FAQs (Optional — emits FAQPage JSON-LD only when populated)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        faqs: [...prev.faqs, { question: '', answer: '' }],
                      }))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#0B1530] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add FAQ</span>
                  </button>
                </div>
                {draft.faqs.map((faq, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) => {
                          const next = [...draft.faqs];
                          next[idx] = { ...next[idx], question: e.target.value };
                          setDraft((prev) => ({ ...prev, faqs: next }));
                        }}
                        placeholder="Question..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            faqs: prev.faqs.filter((_, i) => i !== idx),
                          }))
                        }
                        className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={faq.answer}
                      onChange={(e) => {
                        const next = [...draft.faqs];
                        next[idx] = { ...next[idx], answer: e.target.value };
                        setDraft((prev) => ({ ...prev, faqs: next }));
                      }}
                      placeholder="Verified answer..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Publishing, Featured Image, SEO & Internal Links */}
          <div className="lg:col-span-4 space-y-5">
            {/* Publishing Actions Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
              <h3 className="font-display text-sm font-bold text-[#0B1530] uppercase tracking-wider">
                Publication Controls
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, status: e.target.value as BlogPostStatus }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-semibold"
                  >
                    <option value="draft">Draft (Hidden Publicly)</option>
                    <option value="published">Published (Live &amp; Sitemap)</option>
                    <option value="scheduled">Scheduled (Live after date/time)</option>
                  </select>
                </div>

                {draft.status === 'scheduled' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Scheduled Publish Date &amp; Time
                    </label>
                    <input
                      type="datetime-local"
                      value={draft.scheduledAt}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, scheduledAt: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.featured}
                    onChange={(e) => setDraft((prev) => ({ ...prev, featured: e.target.checked }))}
                    className="rounded border-slate-300 accent-[#FF7A00]"
                  />
                  <span>Feature on Blog &amp; Resource Center hero</span>
                </label>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSavePost('draft')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-300 hover:border-[#0B1530] text-xs font-semibold text-[#0B1530] cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Draft</span>
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSavePost(draft.status === 'scheduled' ? 'scheduled' : 'published')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>{draft.status === 'scheduled' ? 'Schedule' : 'Publish Live'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Featured Image Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#FF7A00]" />
                <h3 className="font-display text-sm font-bold text-[#0B1530] uppercase tracking-wider">
                  Featured Image
                </h3>
              </div>

              {draft.featuredImageUrl && (
                <img
                  src={draft.featuredImageUrl}
                  alt={draft.featuredImageAlt || 'Featured preview'}
                  width={400}
                  height={225}
                  className="w-full h-36 object-cover rounded-xl border border-slate-200"
                />
              )}

              <div>
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#0B1530] cursor-pointer">
                  {uploadingImage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>Upload WebP / AVIF / PNG / JPEG (Max 3 MB)</span>
                  <input
                    type="file"
                    accept="image/webp,image/avif,image/png,image/jpeg"
                    onChange={(e) => void handleImageFileSelect(e)}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Image URL</label>
                <input
                  type="text"
                  value={draft.featuredImageUrl}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, featuredImageUrl: e.target.value }))
                  }
                  placeholder="/assets/blog/..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descriptive Image ALT Text *
                </label>
                <input
                  type="text"
                  value={draft.featuredImageAlt}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, featuredImageAlt: e.target.value }))
                  }
                  placeholder="Describe the image clearly for accessibility & SEO"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>

            {/* SEO Metadata Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#FF7A00]" />
                <h3 className="font-display text-sm font-bold text-[#0B1530] uppercase tracking-wider">
                  SEO Metadata
                </h3>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-700">SEO Title</label>
                  <span className={draft.seoTitle.length > 65 ? 'text-amber-600' : 'text-slate-400'}>
                    {draft.seoTitle.length}/65
                  </span>
                </div>
                <input
                  type="text"
                  value={draft.seoTitle}
                  onChange={(e) => setDraft((prev) => ({ ...prev, seoTitle: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label className="font-semibold text-slate-700">Meta Description</label>
                  <span
                    className={
                      draft.metaDescription.length > 160 ? 'text-amber-600' : 'text-slate-400'
                    }
                  >
                    {draft.metaDescription.length}/160
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={draft.metaDescription}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, metaDescription: e.target.value }))
                  }
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Focus Keyword (Non-Cannibalizing Informational Query)
                </label>
                <input
                  type="text"
                  value={draft.focusKeyword}
                  onChange={(e) => setDraft((prev) => ({ ...prev, focusKeyword: e.target.value }))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Canonical URL
                </label>
                <input
                  type="text"
                  value={draft.canonicalUrl}
                  onChange={(e) => setDraft((prev) => ({ ...prev, canonicalUrl: e.target.value }))}
                  placeholder="https://teqqnoworld.com/blogs/..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Author</label>
                  <input
                    type="text"
                    value={draft.authorName}
                    onChange={(e) => setDraft((prev) => ({ ...prev, authorName: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={draft.tagsText}
                    onChange={(e) => setDraft((prev) => ({ ...prev, tagsText: e.target.value }))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Related Products & Category Linking */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#FF7A00]" />
                <h3 className="font-display text-sm font-bold text-[#0B1530] uppercase tracking-wider">
                  Related Category &amp; Products
                </h3>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Target Category
                </label>
                <select
                  value={draft.relatedCategorySlug}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, relatedCategorySlug: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="">None selected</option>
                  {SEO_CATEGORIES.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                <span className="block text-xs font-semibold text-slate-700">
                  Link Active Products ({draft.relatedProductIds.length} selected)
                </span>
                {PRODUCTS.map((p) => {
                  const checked = draft.relatedProductIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                        checked
                          ? 'bg-orange-50 border-[#FF7A00]/50 text-[#0B1530] font-semibold'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRelatedProduct(p.id)}
                        className="accent-[#FF7A00]"
                      />
                      <span className="truncate">{getProductH1(p.id, p.name)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CATEGORY MANAGEMENT */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <h3 className="font-display text-base font-bold text-[#0B1530]">
              Add / Update Blog Category
            </h3>
            <form onSubmit={(e) => void handleCreateCategory(e)} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => {
                    setNewCatName(e.target.value);
                    setNewCatSlug(slugifyQuick(e.target.value));
                  }}
                  placeholder="e.g., Corporate Gifting & Print"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(slugifyQuick(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#0B1530] hover:bg-[#FF7A00] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Save Category
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {categories.map((cat) => (
              <div key={cat.id} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-display font-bold text-sm text-[#0B1530]">{cat.name}</div>
                  <div className="text-[11px] font-mono text-slate-500">/{cat.slug}</div>
                  <p className="text-xs text-slate-600">{cat.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteCategory(cat)}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                  aria-label={`Delete category ${cat.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: 90-DAY EDITORIAL CALENDAR & TOPICAL CLUSTERS */}
      {activeTab === 'calendar' && (
        <div className="space-y-6">
          {/* Topical Authority Clusters Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#FF7A00]" />
              <h3 className="font-display text-base font-bold text-[#0B1530]">
                Topical Authority Clusters (Zero Cannibalization of Phase 4 Product Keywords)
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clusters.map((cl) => (
                <div
                  key={cl.id}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
                >
                  <div className="text-sm font-bold text-[#0B1530]">{cl.mainTopic}</div>
                  <div className="text-xs text-slate-600">
                    Target Category:{' '}
                    <span className="font-mono text-[#FF7A00]">{cl.targetCategoryUrl}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Supporting Articles: <strong>{cl.supportingArticles.length}</strong> • Linked Products:{' '}
                    <strong>{cl.targetProductIds.length}</strong>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {cl.cannibalizationGuardNote}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* 90-Day Editorial Plan Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-[#0B1530]">
                Proposed 90-Day Editorial Calendar ({calendar.length} Planned Topics)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Search Volume &amp; Keyword Difficulty are marked &quot;Not verified&quot; until live GSC or keyword API data is connected. Opening any topic creates a private DRAFT for manual editorial review.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {calendar.map((item) => {
                const existing = posts.find((p) => p.slug === item.slug);
                return (
                  <div
                    key={item.id}
                    className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-[#0B1530] text-white font-semibold">
                          Month {item.month} • Week {item.week}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-orange-50 text-[#FF7A00] font-semibold">
                          {item.priority} Priority
                        </span>
                        <span className="text-slate-500">{item.searchIntent}</span>
                        {existing && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold uppercase">
                            In CMS: {existing.status}
                          </span>
                        )}
                      </div>
                      <h4 className="font-display text-sm font-bold text-[#0B1530]">
                        {item.title}
                      </h4>
                      <div className="text-xs text-slate-600">
                        Primary Keyword: <strong className="text-[#0B1530]">{item.primaryKeyword}</strong>{' '}
                        <span className="text-slate-400">(Vol: {item.searchVolume} | KD: {item.keywordDifficulty})</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleStartDraftFromCalendar(item)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0B1530] hover:bg-[#FF7A00] text-white text-xs font-semibold transition-colors shrink-0 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{existing ? 'Open in Editor' : 'Open as Draft'}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-5 py-3.5 bg-[#071B35] text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <Eye className="w-4 h-4 text-[#FF7A00]" />
                <span>Live Editorial Preview ({draft.status.toUpperCase()})</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="p-1 hover:bg-white/10 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 sm:p-8 overflow-y-auto space-y-6">
              <div className="space-y-2 border-b border-slate-200 pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#FF7A00]">
                  {draft.categorySlug}
                </span>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1530]">
                  {draft.title || 'Untitled Draft'}
                </h1>
                <p className="text-sm text-slate-600">{draft.excerpt}</p>
                <div className="text-xs text-slate-500 flex items-center gap-3 pt-1">
                  <span>By {draft.authorName}</span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Preview Mode
                  </span>
                </div>
              </div>
              {draft.featuredImageUrl && (
                <img
                  src={draft.featuredImageUrl}
                  alt={draft.featuredImageAlt || draft.title}
                  className="w-full max-h-80 object-cover rounded-xl border border-slate-200"
                />
              )}
              <SafeArticleRenderer content={draft.content} />
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-display text-lg font-bold text-[#0B1530]">
              Delete Article Permanently?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Are you sure you want to delete <strong>&quot;{deleteTarget.title}&quot;</strong>? This removes the article and its slug redirect history immediately.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
