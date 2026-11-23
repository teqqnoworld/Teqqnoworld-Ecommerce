import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, Sparkles, Tag, X, CheckCircle2, ArrowRight, ShieldCheck } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { formatRemainingCountdown } from '../services/aisensyService';
import { getDirectClientWhatsAppUrl } from '../utils/whatsapp';
import { BUSINESS_CONFIG } from '../config/business';

interface CheckoutRecoveryOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCouponAndContinue: (code: string) => void;
  onContinueWithoutApplying?: () => void;
  couponCode: string;
  discountPercent: number;
  expiresAt: number;
  subtotal: number;
  triggerReason: 'payment_cancelled' | 'payment_failed' | 'checkout_back' | 'checkout_hesitation' | string;
  customerPhone?: string;
  customerName?: string;
  whatsappStatusMessage?: string | null;
  whatsappSimulated?: boolean;
  leavingCheckout?: boolean;
}

export const CheckoutRecoveryOfferModal: React.FC<CheckoutRecoveryOfferModalProps> = ({
  isOpen,
  onClose,
  onApplyCouponAndContinue,
  onContinueWithoutApplying,
  couponCode,
  discountPercent,
  expiresAt,
  subtotal,
  triggerReason,
  customerPhone,
  customerName,
  whatsappStatusMessage,
  whatsappSimulated,
  leavingCheckout,
}) => {
  const [countdown, setCountdown] = useState<string>(() => formatRemainingCountdown(expiresAt));

  useEffect(() => {
    if (!isOpen) return;
    setCountdown(formatRemainingCountdown(expiresAt));
    const timer = setInterval(() => {
      setCountdown(formatRemainingCountdown(expiresAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, expiresAt]);

  const estimatedSavings = Math.max(1, Math.round(subtotal * (discountPercent / 100)));

  const headline =
    triggerReason === 'payment_cancelled' || triggerReason === 'payment_failed'
      ? 'Payment ruk gayi? Extra 5% OFF unlock ho gaya!'
      : triggerReason === 'checkout_back'
        ? 'Jaane se pehle 5% OFF Voucher le lijiye!'
        : 'Checkout par help chahiye? Limited-Time 5% OFF paayein!';

  const subtext =
    triggerReason === 'payment_cancelled' || triggerReason === 'payment_failed'
      ? 'Aapne payment cancel ya back kiya — humne aapke liye limited-time 5% extra discount activate kar diya hai.'
      : 'Agar price zyada lag raha hai ya order complete karne mein koi dikkat aa rahi hai, toh yeh limited-time 5% OFF coupon abhi apply karein.';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#071B35]/70 backdrop-blur-xs"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden z-10"
          >
            {/* Dark Navy Header */}
            <div className="bg-gradient-to-br from-[#071B35] via-[#0B2547] to-[#071B35] p-5 text-white relative">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close offer"
                className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF7A00]/20 border border-[#FF7A00]/45 text-[#FF9B3D] text-[11px] font-mono font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>LIMITED-TIME CHECKOUT SAVER</span>
              </div>

              <h3 className="font-display font-bold text-lg sm:text-xl text-white mt-3 pr-6 leading-snug">
                {headline}
              </h3>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {subtext}
              </p>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Coupon + Countdown Card */}
              <div className="rounded-2xl border-2 border-dashed border-[#FF7A00]/50 bg-[#FAF9FD] p-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span>5% OFF Recovery Coupon</span>
                  </div>
                  <div className="font-mono font-extrabold text-xl tracking-wider text-[#071B35]">
                    {couponCode}
                  </div>
                  <div className="text-xs font-semibold text-emerald-700">
                    Extra ₹{estimatedSavings.toLocaleString('en-IN')} instant savings
                  </div>
                </div>

                <div className="text-right bg-[#071B35] text-white px-3 py-2 rounded-xl shrink-0">
                  <div className="text-[10px] text-slate-300 flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3 text-[#FF7A00]" />
                    <span>Expires in</span>
                  </div>
                  <div className="font-mono font-bold text-base tabular-nums text-[#FF9B3D]">
                    {countdown}
                  </div>
                </div>
              </div>

              {/* AiSensy WhatsApp Dispatch Notification Pill */}
              {customerPhone && (
                <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-3 flex items-start gap-2.5 text-xs text-emerald-900">
                  <div className="w-7 h-7 rounded-lg bg-[#1EBE5D] text-white flex items-center justify-center shrink-0 mt-0.5">
                    <WhatsAppIcon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        {whatsappSimulated
                          ? `WhatsApp 5% OFF alert queued for ${customerPhone}`
                          : `WhatsApp 5% OFF coupon sent to ${customerPhone}`}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-relaxed">
                      {whatsappStatusMessage ||
                        `AiSensy WhatsApp par ${couponCode} coupon aur checkout link bhej diya gaya hai.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => onApplyCouponAndContinue(couponCode)}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white font-display font-bold text-sm shadow-lg shadow-[#FF7A00]/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <span>Apply {discountPercent}% OFF ({couponCode}) & Save ₹{estimatedSavings.toLocaleString('en-IN')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-2">
                  {customerPhone && (
                    <a
                      href={getDirectClientWhatsAppUrl({
                        phone: BUSINESS_CONFIG.contact.whatsappDigits,
                        name: customerName,
                        type: 'abandoned',
                        cartTotal: subtotal,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Need Help on WhatsApp</span>
                    </a>
                  )}

                  {leavingCheckout && onContinueWithoutApplying ? (
                    <button
                      type="button"
                      onClick={onContinueWithoutApplying}
                      className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Return to Bag Anyway
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-600 text-xs font-medium cursor-pointer transition-colors"
                    >
                      Later
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Valid for 15 minutes on Prepaid & 50% Advance orders</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
