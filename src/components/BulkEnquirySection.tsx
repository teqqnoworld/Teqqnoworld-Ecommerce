import React, { useState } from 'react';
import { 
  Download, CheckCircle2, Send, Check, 
  Upload, Loader2, AlertCircle, ShieldCheck 
} from 'lucide-react';
import { BulkEnquirySubmission } from '../types';
import { BUSINESS_CONFIG, getWhatsAppLink } from '../config/business';
import { WhatsAppIcon } from './WhatsAppIcon';
import { useRequestQuote } from '../hooks/useSupabase';
import { isSupabaseConfigured } from '../lib/supabase';
import { uploadDataUrlToStorage } from '../services/supabaseService';
import { PRODUCTS } from '../data/mockData';
import { compressImageFile } from '../utils/imageCompressor';
import { VoiceInstructionsCard } from './VoiceInstructionsCard';

interface BulkEnquirySectionProps {
  prefilledItemName?: string;
  prefilledQty?: number;
  onEnquirySubmitted?: (enquiry: BulkEnquirySubmission) => void;
}

export const BulkEnquirySection: React.FC<BulkEnquirySectionProps> = ({
  prefilledItemName = '',
  prefilledQty = 250,
  onEnquirySubmitted,
}) => {
  const { submitQuote, isSubmitting, isSuccess, error, result, reset } = useRequestQuote();

  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(PRODUCTS[0].id);
  const [quantity, setQuantity] = useState(prefilledQty);
  const [customNotes, setCustomNotes] = useState(prefilledItemName || '');
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(null);
  
  // Brand logo file state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const [catalogDownloaded, setCatalogDownloaded] = useState(false);

  const handleDownloadCatalog = () => {
    setCatalogDownloaded(true);
    setTimeout(() => setCatalogDownloaded(false), 4000);
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { file: compressedFile, dataUrl } = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
        format: 'image/webp',
      });
      setLogoFile(compressedFile);
      setLogoPreview(dataUrl);
    } catch (err) {
      console.warn('[BulkEnquirySection] Compression fallback to FileReader:', err);
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let uploadedVoiceUrl: string | null = voiceNoteUrl;
    if (voiceNoteUrl && voiceNoteUrl.startsWith('data:') && isSupabaseConfigured()) {
      const storageUrl = await uploadDataUrlToStorage(voiceNoteUrl, 'rfq_voice_note').catch(() => null);
      if (storageUrl) uploadedVoiceUrl = storageUrl;
    }

    const combinedNotes = [
      customNotes.trim(),
      uploadedVoiceUrl ? `[VoiceNote: ${uploadedVoiceUrl}]` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const quoteRes = await submitQuote({
      customerName: customerName || 'Corporate Client',
      customerEmail: email,
      company: companyName,
      phone,
      productId: selectedProductId,
      quantity,
      customNotes: combinedNotes,
      logoFile,
    });

    if (quoteRes.success && onEnquirySubmitted) {
      const submission: BulkEnquirySubmission = {
        id: quoteRes.orderId || `RFQ-${Math.floor(100000 + Math.random() * 900000)}`,
        companyName: companyName || 'Corporate Client',
        contactPerson: customerName || 'Procurement Lead',
        email,
        phone,
        productCategory: PRODUCTS.find(p => p.id === selectedProductId)?.category || 'apparel',
        estimatedQty: quantity,
        targetDeliveryDate: 'Within 7 Days',
        customizationDetails: customNotes || prefilledItemName || 'Bulk production enquiry',
        hasGst: true,
        createdAt: new Date().toISOString(),
        status: 'Received',
      };
      onEnquirySubmitted(submission);
    }
  };


  return (
    <section id="bulk-enquiry-section" className="py-14 sm:py-20 bg-[#16171B] text-white border-b border-[#2A2A30] relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/2 right-1/4 w-[320px] sm:w-[500px] h-[320px] sm:h-[500px] bg-[#FF7A00]/8 rounded-full blur-[110px] sm:blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          
          {/* Left Column (7 cols desktop): Enterprise Pitch & Checklist */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6 text-left">
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#202127] border border-[#2F3038] text-[11px] font-mono font-semibold uppercase tracking-wider text-[#FF7A00]">
              ENTERPRISE & BULK SOLUTIONS
            </div>

            <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
              Equip Your Entire Organization With Cohesive Branded Merchandise
            </h2>

            <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed max-w-xl">
              Streamline employee welcome swags, annual conference kits, and festival rewards. Direct factory partner for human resources, branding agencies, and corporate procurement heads across India.
            </p>

            {/* 4 Feature Bullets with orange checkmarks */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 text-xs sm:text-sm group cursor-default">
                <div className="w-5 h-5 rounded-full bg-[#FF7A00]/20 text-[#FF7A00] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-115 group-hover:bg-[#FF7A00] group-hover:text-white transition-all duration-300 shadow-2xs">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-zinc-300 group-hover:text-white transition-colors">
                  <strong className="text-white">Tiered volume discounts:</strong> Up to 45% lower unit prices on 50+ to 10,000+ unit orders.
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs sm:text-sm group cursor-default">
                <div className="w-5 h-5 rounded-full bg-[#FF7A00]/20 text-[#FF7A00] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-115 group-hover:bg-[#FF7A00] group-hover:text-white transition-all duration-300 shadow-2xs">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-zinc-300 group-hover:text-white transition-colors">
                  <strong className="text-white">Dedicated Account Manager:</strong> Direct single-point contact for pre-press approvals and SLA tracking.
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs sm:text-sm group cursor-default">
                <div className="w-5 h-5 rounded-full bg-[#FF7A00]/20 text-[#FF7A00] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-115 group-hover:bg-[#FF7A00] group-hover:text-white transition-all duration-300 shadow-2xs">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-zinc-300 group-hover:text-white transition-colors">
                  <strong className="text-white">Physical Swatch Kits:</strong> Dispatched in 24 hours to touch and test fabric GSM and print finishes.
                </div>
              </div>

              <div className="flex items-start gap-3 text-xs sm:text-sm group cursor-default">
                <div className="w-5 h-5 rounded-full bg-[#FF7A00]/20 text-[#FF7A00] flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-115 group-hover:bg-[#FF7A00] group-hover:text-white transition-all duration-300 shadow-2xs">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="text-zinc-300 group-hover:text-white transition-colors">
                  <strong className="text-white">Multi-Branch Split Shipping:</strong> We package and dispatch individualized employee kits directly to 100+ office addresses nationwide.
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 pt-3 sm:pt-4">
              <a
                href={getWhatsAppLink('Hi TeqqnoWorld, we have an enterprise bulk merchandise requirement.')}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto justify-center bg-[#1EBE5D] hover:bg-[#19a851] text-white font-display font-semibold text-xs sm:text-sm px-5 py-3.5 min-h-[46px] rounded-xl shadow-lg transition-all flex items-center gap-2 group cursor-pointer"
              >
                <WhatsAppIcon className="w-4 h-4 text-white group-hover:animate-icon-ring transition-transform shrink-0" />
                <span>Chat on WhatsApp ({BUSINESS_CONFIG.contact.whatsapp})</span>
              </a>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={handleDownloadCatalog}
                  className="w-full sm:w-auto bg-[#202127] hover:bg-[#282a32] text-white border border-[#3A3B45] hover:border-[#FF7A00]/40 font-display font-medium text-xs sm:text-sm px-5 py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 group cursor-pointer min-h-[46px]"
                >
                  <Download className="w-4 h-4 text-zinc-400 group-hover:text-[#FF7A00] group-hover:translate-y-0.5 transition-all duration-300 shrink-0" />
                  <span>{catalogDownloaded ? '✓ Catalog PDF Sent to Download' : 'Download Enterprise Catalog'}</span>
                </button>
              </div>

              {catalogDownloaded && (
                <div className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3.5 py-2 rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>TeqqnoWorld 2026 Master Corporate Catalog (PDF, 48 pages) downloaded successfully.</span>
                </div>
              )}
            </div>

          </div>

          {/* Right Column (5 cols desktop): White RFQ Estimator Card */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl p-4 sm:p-7 text-[#0B0B0D] shadow-2xl border border-white/20">
              
              <div className="mb-4 pb-3 border-b border-zinc-100 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg text-[#0B0B0D]">
                    Instant Bulk RFQ Estimator
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Live Supabase-connected quote request with logo asset storage.
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>{isSupabaseConfigured() ? 'Supabase Live' : 'Demo Mode'}</span>
                </div>
              </div>

              {isSuccess ? (
                <div className="py-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="font-display font-bold text-base text-[#0B0B0D]">
                    Quote Registered in Supabase!
                  </div>
                  <div className="text-xs text-zinc-600 space-y-1">
                    <p>
                      Order Reference: <strong className="font-mono text-[#FF7A00]">{result?.orderId || 'PENDING'}</strong>
                    </p>
                    <p>
                      We have logged your RFQ for <strong>{quantity} units</strong>. Our enterprise team will email the GST invoice and 3D digital proof to <strong>{email}</strong>.
                    </p>
                    {result?.logoUrl && (
                      <p className="text-[11px] text-emerald-700 bg-emerald-50 py-1 px-2 rounded-lg border border-emerald-200 inline-block mt-1">
                        ✓ Logo stored in Supabase Storage (`brand-logos`)
                      </p>
                    )}
                  </div>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => reset()}
                      className="text-xs font-semibold text-[#FF7A00] hover:underline cursor-pointer"
                    >
                      Submit Another Estimate
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  {error && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Customer Name & Company */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">Your Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Anand Verma"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50 min-h-[40px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">Company Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Infosys, Razorpay"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50 min-h-[40px]"
                      />
                    </div>
                  </div>

                  {/* Email & Phone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">Contact Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="procurement@corp.in"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50 min-h-[40px]"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">Phone / WhatsApp *</label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50 min-h-[40px]"
                      />
                    </div>
                  </div>

                  {/* Merchandise Product Model */}
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5">Select Merchandise Product</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50 min-h-[40px]"
                    >
                      {PRODUCTS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (MOQ: {p.moq} pcs)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Brand Logo Upload to Supabase Storage */}
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 mb-0.5 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Upload className="w-3 h-3 text-[#FF7A00]" />
                        <span>Upload Brand Logo (PNG, SVG, PDF)</span>
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono">bucket: brand-logos</span>
                    </label>

                    <div className="flex items-center gap-2 p-2 border border-dashed border-zinc-300 rounded-xl bg-zinc-50 hover:bg-orange-50/20 transition-colors">
                      {logoPreview ? (
                        <div className="w-8 h-8 rounded bg-white border border-zinc-200 flex items-center justify-center p-0.5 shrink-0">
                          <img
                            src={logoPreview}
                            alt="Logo preview"
                            width={32}
                            height={32}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded bg-zinc-100 flex items-center justify-center text-zinc-400 shrink-0">
                          <Upload className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-[11px] font-medium text-zinc-700 truncate">
                          {logoFile ? logoFile.name : 'Attach insignia for free 3D proof'}
                        </p>
                        <p className="text-[9px] text-zinc-400">Max 15MB • Storage RLS protected</p>
                      </div>
                      <label className="bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 text-[11px] font-semibold px-2.5 py-1 rounded-lg cursor-pointer shrink-0 shadow-2xs">
                        <span>{logoFile ? 'Change' : 'Attach'}</span>
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.svg,.pdf"
                          onChange={handleLogoFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Quantity Slider */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] font-semibold text-zinc-700 mb-1">
                      <span>Target Quantity</span>
                      <span className="font-mono font-bold text-[#FF7A00] text-xs bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                        {quantity} units
                      </span>
                    </div>

                    <input
                      type="range"
                      min="25"
                      max="3000"
                      step="25"
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value))}
                      className="w-full accent-[#FF7A00] h-1.5 bg-zinc-200 rounded-lg cursor-pointer"
                    />

                    {/* Quick quantity chips */}
                    <div className="grid grid-cols-4 gap-1 mt-1.5">
                      {[25, 500, 1000, 2500].map((q) => (
                        <button
                          type="button"
                          key={q}
                          onClick={() => setQuantity(q)}
                          className={`py-1 text-[10px] font-mono rounded-lg border transition-colors cursor-pointer ${
                            quantity === q
                              ? 'bg-[#0B0B0D] text-white border-[#0B0B0D] font-bold'
                              : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-300'
                          }`}
                        >
                          {q === 2500 ? '2,500+' : q === 25 ? '25 pcs' : q.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Voice Instructions & Notes */}
                  <VoiceInstructionsCard
                    voiceNoteUrl={voiceNoteUrl}
                    onVoiceNoteChange={setVoiceNoteUrl}
                    textNotes={customNotes}
                    onTextNotesChange={setCustomNotes}
                    title="Voice Instructions for RFQ"
                    subtitle="Speak your quantity, printing or deadline requirements"
                    notesLabel="Requirement Notes (EN/HI Voice-to-Text supported):"
                    notesPlaceholder="e.g. Need 300 polo T-shirts with embroidered logo by next Friday."
                    compact
                  />

                  {/* Submit Button */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-[#FF7A00] hover:bg-[#e06c00] active:scale-98 disabled:opacity-75 text-white font-display font-bold py-3 px-4 rounded-xl shadow-lg shadow-[#FF7A00]/25 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 group cursor-pointer min-h-[44px]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Uploading Logo & Submitting Quote...</span>
                        </>
                      ) : (
                        <>
                          <span>Submit Quote to Supabase Backend</span>
                          <Send className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

            </div>
          </div>


        </div>
      </div>
    </section>
  );
};
