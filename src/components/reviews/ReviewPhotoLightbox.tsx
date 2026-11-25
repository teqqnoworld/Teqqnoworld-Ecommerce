import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Film, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ReviewGalleryPhoto } from '../../services/reviewsService';
import { StarRatingDisplay } from './StarRating';

interface ReviewPhotoLightboxProps {
  photos: ReviewGalleryPhoto[];
  activeIndex: number | null;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}

export const ReviewPhotoLightbox: React.FC<ReviewPhotoLightboxProps> = ({
  photos,
  activeIndex,
  onClose,
  onNavigate,
}) => {
  const prefersReduced = useReducedMotion();
  const isOpen = activeIndex !== null && activeIndex >= 0 && activeIndex < photos.length;
  const active = isOpen ? photos[activeIndex] : null;

  useEffect(() => {
    if (!isOpen || activeIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && photos.length > 1) {
        onNavigate((activeIndex - 1 + photos.length) % photos.length);
      }
      if (e.key === 'ArrowRight' && photos.length > 1) {
        onNavigate((activeIndex + 1) % photos.length);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, activeIndex, photos.length, onClose, onNavigate]);

  return (
    <AnimatePresence>
      {isOpen && active && activeIndex !== null && (
        <motion.div
          initial={prefersReduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={prefersReduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Customer review media viewer"
        >
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl bg-white rounded-2xl overflow-hidden shadow-2xl border border-zinc-200 flex flex-col md:flex-row max-h-[90vh]"
          >
            {/* Media Stage */}
            <div className="relative flex-1 bg-zinc-950 flex items-center justify-center min-h-[260px] sm:min-h-[420px] p-4">
              {active.type === 'video' ? (
                <video
                  key={active.photoUrl}
                  src={active.photoUrl}
                  controls
                  playsInline
                  className="max-h-[65vh] w-full max-w-full rounded-lg bg-black"
                />
              ) : (
                <img
                  src={active.photoUrl}
                  alt={`Customer photo by ${active.customerName}: ${active.title}`}
                  referrerPolicy="no-referrer"
                  className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg select-none"
                />
              )}

              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => onNavigate((activeIndex - 1 + photos.length) % photos.length)}
                    aria-label="Previous media item"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-zinc-900 flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate((activeIndex + 1) % photos.length)}
                    aria-label="Next media item"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-zinc-900 flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/75 text-white text-xs font-mono tabular-nums px-3 py-1 rounded-md">
                {activeIndex + 1} / {photos.length}
              </div>
            </div>

            {/* Review Context Sidebar */}
            <div className="w-full md:w-80 shrink-0 p-5 sm:p-6 flex flex-col justify-between bg-white border-t md:border-t-0 md:border-l border-zinc-200 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <StarRatingDisplay rating={active.rating} size="md" />
                    <h3 className="font-display font-bold text-base text-[#071B35] mt-2 leading-snug">
                      {active.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close media viewer"
                    className="p-2 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer shrink-0 min-w-[40px] min-h-[40px] flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1.5 text-xs text-zinc-600 pt-3 border-t border-zinc-100">
                  <div className="font-semibold text-[#071B35]">{active.customerName}</div>
                  <div
                    className={`inline-flex items-center gap-1.5 font-medium ${
                      active.verifiedPurchase ? 'text-emerald-700' : 'text-zinc-500'
                    }`}
                  >
                    {active.verifiedPurchase && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                    <span>{active.verifiedPurchase ? 'Verified Purchase' : 'Unverified Review'}</span>
                  </div>
                  {active.variantSummary && (
                    <div className="text-zinc-500">{active.variantSummary}</div>
                  )}
                  <div className="text-zinc-400">
                    {new Date(active.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                </div>
              </div>

              {photos.length > 1 && (
                <div className="pt-4 mt-4 border-t border-zinc-100">
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {photos.map((p, idx) => (
                      <button
                        key={`${p.reviewId}-${idx}`}
                        type="button"
                        onClick={() => onNavigate(idx)}
                        className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer bg-zinc-900 flex items-center justify-center ${
                          idx === activeIndex
                            ? 'border-[#FF7A00] opacity-100'
                            : 'border-transparent opacity-65 hover:opacity-100'
                        }`}
                      >
                        {p.type === 'video' ? (
                          <Film className="w-5 h-5 text-white" />
                        ) : (
                          <img
                            src={p.photoUrl}
                            alt={`Thumbnail ${idx + 1}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
