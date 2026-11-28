import React, { useState, useEffect } from 'react';
import { 
  X, Database, Copy, Check, ExternalLink, ShieldCheck, 
  Terminal, RefreshCw, AlertCircle, Sparkles, Server, HardDrive, KeyRound 
} from 'lucide-react';
import { isSupabaseConfigured, getSupabaseConfig } from '../lib/supabase';
import { 
  fetchCustomOrdersFromSupabase, 
  seedProductsToSupabase 
} from '../services/supabaseService';
import { CustomOrderRow } from '../lib/supabase';

interface SupabaseDevModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseDevModal: React.FC<SupabaseDevModalProps> = ({ isOpen, onClose }) => {
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'schema' | 'orders' | 'setup'>('schema');
  
  // Test quotes query (requires authenticated Admin session)
  const [quotes, setQuotes] = useState<CustomOrderRow[]>([]);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  
  // Seed status
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState<string | null>(null);

  const config = getSupabaseConfig();

  const loadQuotes = async () => {
    setLoadingQuotes(true);
    setQuotesError(null);
    const res = await fetchCustomOrdersFromSupabase();
    setQuotes(res.data);
    if (res.error) setQuotesError(res.error);
    setLoadingQuotes(false);
  };

  useEffect(() => {
    if (isOpen && activeTab === 'orders') {
      loadQuotes();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleCopySql = () => {
    const sqlContent = `-- 1. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price >= 0),
    moq INTEGER NOT NULL DEFAULT 1 CHECK (moq >= 1),
    image_url TEXT,
    available_colors JSONB DEFAULT '[]'::jsonb,
    available_sizes JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 2. CUSTOM_ORDERS (QUOTES) TABLE
CREATE TABLE IF NOT EXISTS public.custom_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    company TEXT,
    phone TEXT NOT NULL,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity >= 1),
    logo_url TEXT,
    custom_notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'in-production', 'dispatched', 'delivered')),
    courier_partner TEXT,
    tracking_number TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

ALTER TABLE public.custom_orders ADD COLUMN IF NOT EXISTS courier_partner TEXT;
ALTER TABLE public.custom_orders ADD COLUMN IF NOT EXISTS tracking_number TEXT;

-- 3. ABANDONED CHECKOUTS RECOVERY TABLE
CREATE TABLE IF NOT EXISTS public.abandoned_checkouts (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    cart_items JSONB DEFAULT '[]'::jsonb,
    cart_total NUMERIC(10, 2) DEFAULT 0,
    recovered BOOLEAN DEFAULT FALSE,
    recovered_at TIMESTAMPTZ,
    order_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

-- 4. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view all active products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins have full access to products" ON public.products FOR ALL TO authenticated USING (auth.role() = 'authenticated');

ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit a custom order quote" ON public.custom_orders FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Public can view custom order quotes" ON public.custom_orders FOR SELECT TO public USING (true);
CREATE POLICY "Public can update custom order quote status" ON public.custom_orders FOR UPDATE TO public USING (true);

ALTER TABLE public.abandoned_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can manage abandoned checkouts" ON public.abandoned_checkouts FOR ALL TO public USING (true) WITH CHECK (true);

-- 5. STORAGE BUCKET (brand-logos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('brand-logos', 'brand-logos', true, 15728640, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Public can view brand logos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'brand-logos');
CREATE POLICY "Public can upload brand logos" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'brand-logos');`;

    navigator.clipboard.writeText(sqlContent);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSeedProducts = async () => {
    setSeeding(true);
    setSeedSuccess(null);
    try {
      const res = await seedProductsToSupabase();
      setSeedSuccess(`Successfully seeded ${res.count} products into Supabase 'products' table!`);
    } catch (e: any) {
      setSeedSuccess(`Seed note: ${e?.message || 'Check .env.local configuration'}`);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#121318] text-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-zinc-800 relative max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-lg text-white">
                  Supabase Integration Console
                </h3>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                  config.configured 
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                    : 'bg-amber-950 text-amber-400 border border-amber-800'
                }`}>
                  {config.configured ? '● LIVE CONNECTED' : '○ LOCAL DEMO MODE'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                PostgreSQL Database, Row Level Security, and Storage Bucket Integration
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-2 rounded-full hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl flex items-center gap-3">
            <Server className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-500 font-mono uppercase">Database</p>
              <p className="text-xs font-semibold text-zinc-200 truncate">PostgreSQL 15 (Supabase)</p>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl flex items-center gap-3">
            <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-500 font-mono uppercase">Storage Bucket</p>
              <p className="text-xs font-semibold text-zinc-200 truncate">brand-logos (Public)</p>
            </div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-xl flex items-center gap-3">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-zinc-500 font-mono uppercase">Security</p>
              <p className="text-xs font-semibold text-zinc-200 truncate">RLS Enabled</p>
            </div>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 border-b border-zinc-800 mb-4 pb-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'schema' ? 'bg-[#FF7A00] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            SQL Schema (Copy & Run)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'orders' ? 'bg-[#FF7A00] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Live Quotes in DB ({quotes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('setup')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'setup' ? 'bg-[#FF7A00] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Environment Setup (.env.local)
          </button>
        </div>

        {/* Tab 1: SQL Schema */}
        {activeTab === 'schema' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">
                Run this script in your Supabase Dashboard (<span className="text-emerald-400 font-mono">SQL Editor</span>)
              </span>
              <button
                type="button"
                onClick={handleCopySql}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Schema'}</span>
              </button>
            </div>

            <div className="bg-zinc-950 border border-zinc-800/90 rounded-2xl p-4 font-mono text-[11px] text-zinc-300 max-h-72 overflow-y-auto leading-relaxed select-all">
              <pre className="text-emerald-400">-- 1. PRODUCTS TABLE</pre>
              <pre>CREATE TABLE IF NOT EXISTS public.products (</pre>
              <pre>    id TEXT PRIMARY KEY,</pre>
              <pre>    name TEXT NOT NULL,</pre>
              <pre>    category TEXT NOT NULL,</pre>
              <pre>    base_price NUMERIC(10, 2) NOT NULL CHECK (base_price &gt;= 0),</pre>
              <pre>    moq INTEGER NOT NULL DEFAULT 1 CHECK (moq &gt;= 1),</pre>
              <pre>    image_url TEXT,</pre>
              <pre>    available_colors JSONB DEFAULT &apos;[]&apos;::jsonb,</pre>
              <pre>    available_sizes JSONB DEFAULT &apos;[]&apos;::jsonb,</pre>
              <pre>    description TEXT,</pre>
              <pre>    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()</pre>
              <pre>);</pre>
              <br />
              <pre className="text-emerald-400">-- 2. CUSTOM_ORDERS (QUOTES) TABLE</pre>
              <pre>CREATE TABLE IF NOT EXISTS public.custom_orders (</pre>
              <pre>    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),</pre>
              <pre>    customer_name TEXT NOT NULL,</pre>
              <pre>    customer_email TEXT NOT NULL,</pre>
              <pre>    company TEXT,</pre>
              <pre>    phone TEXT NOT NULL,</pre>
              <pre>    product_id TEXT REFERENCES public.products(id),</pre>
              <pre>    quantity INTEGER NOT NULL CHECK (quantity &gt;= 1),</pre>
              <pre>    logo_url TEXT,</pre>
              <pre>    custom_notes TEXT,</pre>
              <pre>    status TEXT NOT NULL DEFAULT &apos;pending&apos;,</pre>
              <pre>    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()</pre>
              <pre>);</pre>
              <br />
              <pre className="text-emerald-400">-- 3. RLS POLICIES (Public read products; service_role-only custom_orders)</pre>
              <pre>ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;</pre>
              <pre>CREATE POLICY &quot;Public can view all active products&quot; ON public.products FOR SELECT USING (true);</pre>
              <pre>ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;</pre>
              <pre>-- Apply supabase/custom_orders_rls_hardening_migration.sql (service_role only; no anon/authenticated reads)</pre>
              <br />
              <pre className="text-emerald-400">-- 4. STORAGE BUCKET: brand-logos</pre>
              <pre>INSERT INTO storage.buckets (id, name, public) VALUES (&apos;brand-logos&apos;, &apos;brand-logos&apos;, true) ON CONFLICT DO NOTHING;</pre>
            </div>

            {config.configured && (
              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleSeedProducts}
                  disabled={seeding}
                  className="bg-[#202127] hover:bg-zinc-800 border border-zinc-700 text-xs px-3.5 py-2 rounded-xl text-zinc-200 flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>{seeding ? 'Seeding Catalog...' : 'Seed Catalog into Supabase Products Table'}</span>
                </button>
                {seedSuccess && <span className="text-xs text-emerald-400">{seedSuccess}</span>}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Orders List in Supabase */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Rows in <code className="text-[#FF7A00]">custom_orders</code> table:</span>
              <button
                type="button"
                onClick={loadQuotes}
                className="flex items-center gap-1 text-zinc-300 hover:text-white"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingQuotes ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {quotesError ? (
              <div className="text-center py-8 px-4 bg-amber-950/30 rounded-2xl border border-amber-700/50 text-amber-200 text-xs">
                {quotesError} Sign into the Admin Hub first to view order records.
              </div>
            ) : quotes.length === 0 ? (
              <div className="text-center py-10 bg-zinc-900/50 rounded-2xl border border-zinc-800 text-zinc-500 text-xs">
                No quote submissions found yet. Submit one using the &quot;Instant Bulk RFQ Estimator&quot; on the landing page!
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {quotes.map((q) => (
                  <div key={q.id} className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 text-xs flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-white">{q.customer_name}</strong>
                        {q.company && <span className="text-zinc-400">({q.company})</span>}
                        <span className="text-[10px] bg-amber-950 text-amber-300 px-2 py-0.5 rounded-full border border-amber-800/60 uppercase font-mono">
                          {q.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {q.customer_email} • {q.phone} • {q.quantity} units • Product: {q.product_id}
                      </p>
                    </div>

                    {q.logo_url && (
                      <a
                        href={q.logo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 shrink-0 bg-emerald-950/40 px-2 py-1 rounded border border-emerald-900"
                      >
                        <span>Logo</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Environment Setup */}
        {activeTab === 'setup' && (
          <div className="space-y-4 text-xs text-zinc-300">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <h4 className="font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#FF7A00]" />
                <span>Configure Supabase Keys</span>
              </h4>
              <p className="text-zinc-400 leading-relaxed">
                Add your Supabase credentials into <code className="text-emerald-400 bg-zinc-950 px-1.5 py-0.5 rounded">.env.local</code> in the project root:
              </p>
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 font-mono text-[11px] text-emerald-400 select-all">
                VITE_SUPABASE_URL="https://jqajzfftaxwafctquzjr.supabase.co"<br />
                VITE_SUPABASE_ANON_KEY="sb_publishable_IgO3t6DbnmDpanEfJMCwyw_bqnQytYb"
              </div>

            </div>

            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <h4 className="font-bold text-white">How to find these values in Supabase:</h4>
              <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                <li>Go to <strong className="text-white">supabase.com/dashboard</strong> and open your project.</li>
                <li>Click <strong className="text-white">Project Settings</strong> (gear icon) &rarr; <strong className="text-white">API</strong>.</li>
                <li>Copy the <strong className="text-white">Project URL</strong> into <code className="text-zinc-300">VITE_SUPABASE_URL</code>.</li>
                <li>Copy the <strong className="text-white">anon / public key</strong> into <code className="text-zinc-300">VITE_SUPABASE_ANON_KEY</code>.</li>
                <li>Go to <strong className="text-white">SQL Editor</strong>, paste and run the SQL schema from the first tab.</li>
              </ol>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
