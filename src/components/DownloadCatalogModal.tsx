import React, { useState } from 'react';
import { 
  Download, 
  FileText, 
  BookOpen, 
  CheckCircle2, 
  Sparkles, 
  Mail, 
  X, 
  ExternalLink,
  Printer
} from 'lucide-react';
import { BUSINESS_DETAILS } from '../data/legalData';
import { generateCorporateCataloguePdf } from '../utils/pdfGenerator';
import { sendCatalogueEmail } from '../services/emailService';
import { triggerCelebration } from '../services/celebrationService';

interface CatalogItem {
  id: string;
  title: string;
  category: string;
  fileSize: string;
  pages: number;
  description: string;
  badge: string;
  coverGradient: string;
  downloadFileName: string;
}

const CATALOG_ITEMS: CatalogItem[] = [
  {
    id: 'master-catalog-2026',
    title: 'TeqqnoWorld 2026 Master Corporate Catalogue',
    category: 'Complete Range',
    fileSize: '14.2 MB PDF',
    pages: 48,
    description: 'Comprehensive guide covering all 11 merchandise product lines, volume discount tiers, print tolerances, and corporate gifting solutions.',
    badge: 'Master Guide',
    coverGradient: 'from-zinc-950 via-zinc-900 to-black',
    downloadFileName: 'TeqqnoWorld_Master_Corporate_Catalogue_2026.pdf',
  },
  {
    id: 'apparel-spec-sheet',
    title: 'Apparel & Uniforms Technical Spec Sheet',
    category: 'Textiles & Apparel',
    fileSize: '6.4 MB PDF',
    pages: 18,
    description: 'Detailed fabric GSM weights, pre-shrunk combed cotton standards, Coolmax Mars moisture wicking specs, sizing charts (S to 5XL), and embroidery thread charts.',
    badge: 'Technical Spec',
    coverGradient: 'from-orange-950 via-zinc-900 to-zinc-950',
    downloadFileName: 'TeqqnoWorld_Apparel_Uniforms_SpecSheet.pdf',
  },
  {
    id: 'signage-displays-lookbook',
    title: 'Promotional Signage & Event Displays Lookbook',
    category: 'Displays & Outdoor',
    fileSize: '8.1 MB PDF',
    pages: 24,
    description: 'Hardware schematics and wind-resistance engineering for Rollup Standees, Promo Tables, 4x4 / 8x8 Gazebo Canopies, and 5ft Promotional Umbrellas.',
    badge: 'Hardware & Media',
    coverGradient: 'from-blue-950 via-zinc-900 to-black',
    downloadFileName: 'TeqqnoWorld_Event_Displays_Signage_Guide.pdf',
  },
  {
    id: 'visiting-card-print-guide',
    title: '300 GSM Visiting Cards & Print Pre-Press Guide',
    category: 'Stationery & Cards',
    fileSize: '3.8 MB PDF',
    pages: 12,
    description: 'Artwork bleed lines (92x52mm), 300 GSM art card lamination choices (matte vs glossy), CMYK color calibration, and barcode readability guidelines.',
    badge: 'Artwork Pre-Press',
    coverGradient: 'from-emerald-950 via-zinc-900 to-zinc-950',
    downloadFileName: 'TeqqnoWorld_VisitingCards_Print_Guidelines.pdf',
  },
];

interface DownloadCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DownloadCatalogModal: React.FC<DownloadCatalogModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadSuccessId, setDownloadSuccessId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailSentMessage, setEmailSentMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownload = (item: CatalogItem) => {
    setDownloadingId(item.id);

    setTimeout(() => {
      // Generate authentic high-resolution corporate procurement catalogue PDF
      generateCorporateCataloguePdf(item);

      setDownloadingId(null);
      setDownloadSuccessId(item.id);
      triggerCelebration({
        level: 'subtle',
        sound: 'chime',
        eventKey: `catalog-download:${item.id}:${Date.now()}`,
        dedupeWindowMs: 1500,
        action: 'catalogue_downloaded',
      });
      setTimeout(() => setDownloadSuccessId(null), 3500);
    }, 400);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = emailInput.trim();
    if (!trimmedEmail || emailSending) return;

    setEmailSending(true);
    setEmailError(null);
    setEmailSentMessage(null);

    try {
      const res = await sendCatalogueEmail(trimmedEmail);
      if (!res.success) {
        setEmailError(
          res.message || 'Email delivery is currently unavailable. Please download the PDFs directly above.'
        );
        return;
      }

      setEmailSentMessage(res.message || `Catalogue email sent to ${trimmedEmail}.`);
      setEmailInput('');
      triggerCelebration({
        level: 'subtle',
        sound: 'pop',
        eventKey: `catalog-email:${res.messageId || trimmedEmail}`,
        dedupeWindowMs: 4000,
        action: 'catalogue_emailed',
      });
    } catch (err: any) {
      setEmailError(
        err?.message || 'Unable to send catalogue email right now. Please download the PDFs directly above.'
      );
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#071B35]/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200/80 shadow-[0_28px_70px_-15px_rgba(7,27,53,0.4)] overflow-hidden my-6 max-h-[90vh] flex flex-col animate-admin-scale-in"
      >
        {/* Top Navy Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#071B35] via-[#0B2347] to-[#071B35] text-white px-5 sm:px-7 py-5 sm:py-6 shrink-0 border-b border-white/10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-10 w-72 h-72 rounded-full opacity-35 blur-3xl"
            style={{
              background:
                'radial-gradient(circle, rgba(255,121,0,0.55) 0%, transparent 70%)',
            }}
          />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#FF9E44] bg-[#FF7900]/15 border border-[#FF7900]/40 px-2.5 py-0.5 rounded-full">
                  Enterprise Procurement Library
                </span>
                <span className="text-[11px] text-slate-300 font-mono">Updated October 2026</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white mt-2 tracking-tight">
                Download Official Corporate Catalogues &amp; Spec Sheets
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close catalogues modal"
              className="text-slate-300 hover:text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer group shrink-0"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-7 space-y-6 overflow-y-auto flex-1 bg-[#F8FAFC]">
          {/* Catalog Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {CATALOG_ITEMS.map((item) => {
              const isDownloading = downloadingId === item.id;
              const isSuccess = downloadSuccessId === item.id;
              return (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl border border-slate-200/90 hover:border-[#FF7900]/50 hover:shadow-md transition-all bg-white flex flex-col justify-between space-y-4 group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-[#071B35] text-white">
                        {item.badge}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {item.pages} Pages · {item.fileSize}
                      </span>
                    </div>

                    <h3 className="font-display font-bold text-sm text-[#071B35] group-hover:text-[#FF7900] transition-colors">
                      {item.title}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {item.category}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      disabled={isDownloading}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[38px] ${
                        isSuccess
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-[#071B35] hover:bg-[#FF7900] text-white shadow-xs'
                      }`}
                    >
                      {isSuccess ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Downloaded!</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 text-[#FF7900] group-hover:text-white transition-colors" />
                          <span>{isDownloading ? 'Preparing...' : 'Download PDF'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Email Full Catalog Suite */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#071B35] to-[#0D274A] text-white border border-white/10 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-display font-bold text-sm text-white flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[#FF7900]" />
                  <span>Email All Catalogues to Procurement Team</span>
                </h4>
                <p className="text-xs text-slate-300">
                  Receive the complete 2026 corporate catalogue guide in your inbox.
                </p>
              </div>

              <form onSubmit={handleSendEmail} className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="company@domain.com"
                  value={emailInput}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (emailError) setEmailError(null);
                  }}
                  disabled={emailSending}
                  className="px-3.5 py-2 text-xs rounded-xl bg-white/10 border border-white/15 text-white placeholder-slate-400 outline-none focus:border-[#FF7900] min-w-[200px] min-h-[40px] disabled:opacity-60"
                  required
                />
                <button
                  type="submit"
                  disabled={emailSending}
                  className="bg-[#FF7900] hover:bg-[#e56d00] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-xl transition-all whitespace-nowrap cursor-pointer min-h-[40px] shadow-md shadow-[#FF7900]/25"
                >
                  {emailSending ? 'Sending...' : 'Send All'}
                </button>
              </form>
            </div>

            {emailSentMessage && (
              <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 rounded-xl px-3.5 py-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{emailSentMessage}</span>
              </div>
            )}

            {emailError && (
              <div className="text-xs text-amber-200 bg-amber-500/15 border border-amber-400/30 rounded-xl px-3.5 py-2">
                {emailError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
