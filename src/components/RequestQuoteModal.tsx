import React, { useState } from 'react';
import { 
  X, Upload, CheckCircle2, AlertCircle, Loader2, 
  Building2, Mail, Phone, User, Package, FileText, Check, ShieldCheck 
} from 'lucide-react';
import { useRequestQuote } from '../hooks/useSupabase';
import { isSupabaseConfigured } from '../lib/supabase';
import { uploadDataUrlToStorage } from '../services/supabaseService';
import { PRODUCTS } from '../data/mockData';
import { calculateProductPrice } from '../data/pricingRules';
import { compressImageFile } from '../utils/imageCompressor';
import { VoiceInstructionsCard } from './VoiceInstructionsCard';
import { triggerCelebration } from '../services/celebrationService';
import { trackQuoteRequest } from '../utils/analyticsTracker';

interface RequestQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProductId?: string;
  prefilledLogoUrl?: string | null;
  prefilledColorName?: string;
  prefilledPlacement?: string;
  onSuccess?: (orderId: string) => void;
}

export const RequestQuoteModal: React.FC<RequestQuoteModalProps> = ({
  isOpen,
  onClose,
  preselectedProductId,
  prefilledLogoUrl,
  prefilledColorName,
  prefilledPlacement,
  onSuccess,
}) => {
  const { submitQuote, isSubmitting, isSuccess, error, result, reset } = useRequestQuote();

  // Form State
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [productId, setProductId] = useState(preselectedProductId || PRODUCTS[0].id);
  const [quantity, setQuantity] = useState(50);
  const [customNotes, setCustomNotes] = useState(
    prefilledColorName || prefilledPlacement
      ? `Preferences: Color: ${prefilledColorName || 'Default'}, Placement: ${prefilledPlacement || 'Chest'}`
      : ''
  );
  
  // File & voice note state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(prefilledLogoUrl || null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [voiceNoteUrl, setVoiceNoteUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    if (file.size > 25 * 1024 * 1024) {
      setFileError('File size exceeds 25 MB limit.');
      return;
    }

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
      console.warn('[RequestQuoteModal] Compression fallback to FileReader:', err);
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
      const storageUrl = await uploadDataUrlToStorage(voiceNoteUrl, 'modal_rfq_voice').catch(() => null);
      if (storageUrl) uploadedVoiceUrl = storageUrl;
    }

    const combinedNotes = [
      customNotes.trim(),
      uploadedVoiceUrl ? `[VoiceNote: ${uploadedVoiceUrl}]` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    const res = await submitQuote({
      customerName,
      customerEmail,
      company,
      phone,
      productId,
      quantity,
      customNotes: combinedNotes,
      logoFile,
      existingLogoUrl: !logoFile && prefilledLogoUrl ? prefilledLogoUrl : undefined,
    });

    if (res.success) {
      const selectedProd = PRODUCTS.find((p) => p.id === productId);
      const estimatedLeadValue =
        selectedProd && Number.isFinite(quantity) && quantity >= 1
          ? calculateProductPrice(selectedProd.id, quantity).totalPrice
          : undefined;
      trackQuoteRequest({
        leadId: res.orderId,
        formName: 'request_quote_modal',
        productId,
        productName: selectedProd?.name,
        quantity,
        valueInr: estimatedLeadValue,
      });
      triggerCelebration({
        level: 'premium',
        sound: 'celebration',
        eventKey: `quote-request:${res.orderId || Date.now()}`,
        dedupeWindowMs: 3000,
        action: 'quote_request_submitted',
      });
      if (res.orderId && onSuccess) {
        onSuccess(res.orderId);
      }
    }
  };

  const handleModalClose = () => {
    reset();
    onClose();
  };

  const selectedProduct = PRODUCTS.find((p) => p.id === productId) || PRODUCTS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 text-[#0B0B0D] shadow-2xl relative max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-[11px] font-mono text-[#FF7A00] font-semibold mb-1">
              <span>SUPABASE CONNECTED RFQ</span>
            </div>
            <h3 className="font-display font-bold text-xl text-zinc-900 leading-tight">
              Request a Custom Quote
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Submit your project details and brand logo for factory-direct wholesale pricing.
            </p>
          </div>

          <button
            type="button"
            onClick={handleModalClose}
            className="text-zinc-400 hover:text-zinc-700 p-2 rounded-full hover:bg-zinc-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success View */}
        {isSuccess ? (
          <div className="py-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="font-display font-bold text-xl text-zinc-900">
                Quote Request Registered!
              </h4>
              <p className="text-xs text-zinc-600 max-w-md mx-auto">
                Your order specification and brand insignia have been stored in the database.
              </p>
            </div>

            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 max-w-md mx-auto text-left space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-zinc-200/60">
                <span className="text-zinc-500">Reference ID:</span>
                <span className="font-mono font-bold text-zinc-900">{result?.orderId || 'PENDING'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-200/60">
                <span className="text-zinc-500">Customer:</span>
                <span className="font-semibold text-zinc-900">{customerName} ({company || 'Corporate'})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-200/60">
                <span className="text-zinc-500">Product:</span>
                <span className="font-semibold text-zinc-900">{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-zinc-200/60">
                <span className="text-zinc-500">Target Quantity:</span>
                <span className="font-bold text-[#FF7A00]">{quantity} units</span>
              </div>
              {result?.logoUrl && (
                <div className="flex items-center justify-between py-1">
                  <span className="text-zinc-500">Logo Asset:</span>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Stored in Supabase
                  </span>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleModalClose}
                className="w-full sm:w-auto bg-[#FF7A00] hover:bg-[#e06c00] text-white font-display font-bold text-xs py-3 px-6 rounded-xl transition-all shadow-md cursor-pointer"
              >
                Close & Continue Exploring
              </button>
              <button
                type="button"
                onClick={reset}
                className="w-full sm:w-auto bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-display font-semibold text-xs py-3 px-5 rounded-xl transition-colors cursor-pointer"
              >
                Submit Another Quote
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <form onSubmit={handleSubmit} className="space-y-4 my-5">
            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {fileError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Customer Name & Company */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Sharma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Company / Organization Name</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Acme Tech Solutions"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50"
                />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Business Email *</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="procurement@company.com"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Phone / WhatsApp *</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50"
                />
              </div>
            </div>

            {/* Product & Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Product Model *</span>
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50"
                >
                  {PRODUCTS.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} (MOQ: {prod.moq})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-700 mb-1 flex items-center justify-between">
                  <span>Target Quantity *</span>
                  <span className="font-mono text-[10px] text-zinc-500">MOQ: {selectedProduct.moq} pcs</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={selectedProduct.moq || 1}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50 font-mono font-bold"
                  />
                  <div className="flex items-center gap-1">
                    {[50, 200, 500].map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuantity(q)}
                        className={`text-[10px] px-2 py-2 rounded-lg border cursor-pointer font-mono ${
                          quantity === q ? 'bg-[#0B0B0D] text-white border-[#0B0B0D]' : 'bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Logo Upload Box (Supabase Storage: brand-logos) */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-[#FF7A00]" />
                  <span>Company Logo / Vector File</span>
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Bucket: brand-logos</span>
              </label>

              <div className="border-2 border-dashed border-zinc-200 hover:border-[#FF7A00] rounded-2xl p-4 bg-zinc-50/70 transition-all flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <div className="w-12 h-12 rounded-xl bg-white border border-zinc-200 flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-2xs">
                      <img src={logoPreview} alt="Uploaded Logo" className="w-full h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#FF7A00] flex items-center justify-center shrink-0">
                      <Upload className="w-5 h-5" />
                    </div>
                  )}

                  <div className="text-left">
                    <p className="text-xs font-bold text-zinc-800">
                      {logoFile ? logoFile.name : (prefilledLogoUrl ? 'Logo attached from Mockup Tool' : 'Select logo file')}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      PNG, JPG, SVG, or Vector PDF (Max 15MB)
                    </p>
                  </div>
                </div>

                <label className="bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer shadow-2xs transition-colors shrink-0">
                  <span>{logoPreview ? 'Change File' : 'Browse'}</span>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Voice Instructions */}
            <VoiceInstructionsCard
              voiceNoteUrl={voiceNoteUrl}
              onVoiceNoteChange={setVoiceNoteUrl}
              textNotes={customNotes}
              onTextNotesChange={setCustomNotes}
              title="Record Voice Instructions"
              subtitle="Dictate in EN/HI or attach an audio note alongside your RFQ"
              hideTextArea
              compact
            />

            {/* Custom Notes */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#FF7A00]" />
                <span>Custom Notes / Special Instructions</span>
              </label>
              <textarea
                rows={2}
                placeholder="Mention print placement (e.g. left chest), specific Pantone colors, or target delivery deadline."
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                className="w-full text-xs sm:text-sm px-3.5 py-2.5 border border-zinc-200 rounded-xl outline-none focus:border-[#FF7A00] bg-zinc-50 resize-none"
              />
            </div>

            {/* Backend Info Badge */}
            <div className="flex items-center justify-between text-[11px] bg-zinc-100/80 px-3.5 py-2 rounded-xl text-zinc-600">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>
                  {isSupabaseConfigured() 
                    ? 'Connected to Live Supabase Backend (RLS Protected)' 
                    : 'Running in Local Demo Mode (Plug in .env.local keys to sync live)'}
                </span>
              </div>
              <span className="font-mono text-[10px] text-zinc-500">table: custom_orders</span>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#FF7A00] hover:bg-[#e06c00] active:scale-[0.99] disabled:opacity-75 text-white font-display font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-[#FF7A00]/25 transition-all flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Uploading to Supabase Storage & Database...</span>
                  </>
                ) : (
                  <span>Submit RFQ & Request Official Quotation</span>
                )}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
