import React, { useEffect, useId, useState } from 'react';
import {
  Truck,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ShieldCheck,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  checkDelhiveryPincode,
  DelhiveryPincodeCheckResult,
} from '../services/paymentAndLogisticsService';
import {
  getSavedDelhiveryCheck,
  saveDelhiveryCheck,
  subscribeDelhiveryCheck,
} from '../services/delhiveryPincodeStore';
import { getWhatsAppLink } from '../config/business';

interface DelhiveryPincodeCheckerProps {
  variant?: 'banner' | 'compact' | 'modal';
  onResultChange?: (result: DelhiveryPincodeCheckResult | null) => void;
  className?: string;
}

const SAMPLE_PINS = [
  { label: 'Hyderabad', pin: '500081' },
  { label: 'Bengaluru', pin: '560001' },
  { label: 'Mumbai', pin: '400001' },
  { label: 'Delhi NCR', pin: '110001' },
];

export const DelhiveryPincodeChecker: React.FC<DelhiveryPincodeCheckerProps> = ({
  variant = 'compact',
  onResultChange,
  className = '',
}) => {
  const [savedResult, setSavedResult] = useState<DelhiveryPincodeCheckResult | null>(() =>
    getSavedDelhiveryCheck()
  );
  const [pinInput, setPinInput] = useState<string>(() => getSavedDelhiveryCheck()?.pincode || '');
  const [isChecking, setIsChecking] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const pinInputId = useId();
  const [isEditing, setIsEditing] = useState<boolean>(() => !getSavedDelhiveryCheck());

  useEffect(() => {
    const unsubscribe = subscribeDelhiveryCheck((next) => {
      setSavedResult(next);
      if (next?.pincode) {
        setPinInput(next.pincode);
        setIsEditing(false);
      } else {
        setIsEditing(true);
      }
      onResultChange?.(next);
    });
    return unsubscribe;
  }, [onResultChange]);

  const runCheck = async (targetPin: string) => {
    const cleanPin = targetPin.replace(/[^0-9]/g, '').slice(0, 6);
    setPinInput(cleanPin);
    setInputError(null);

    if (cleanPin.length !== 6) {
      setInputError('Please enter a valid 6-digit Indian pincode.');
      return;
    }

    setIsChecking(true);
    try {
      const res = await checkDelhiveryPincode(cleanPin);
      setSavedResult(res);
      saveDelhiveryCheck(res);
      setIsEditing(false);
      onResultChange?.(res);
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runCheck(pinInput);
  };

  const handleReset = () => {
    setIsEditing(true);
    setInputError(null);
  };

  const formatLocationLine = (res: DelhiveryPincodeCheckResult) => {
    const parts = [res.areaName, res.city, res.state].filter(Boolean);
    const uniqueParts = parts.filter((part, idx) => parts.indexOf(part) === idx);
    return uniqueParts.length > 0 ? uniqueParts.join(', ') : `Pincode ${res.pincode}`;
  };

  if (variant === 'banner') {
    return (
      <section
        aria-label="Delhivery Delivery Availability Checker"
        className={`bg-[#FAF9FD] border-b border-[#E5E5EA] py-5 sm:py-6 text-[#0B0B0D] ${className}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-[#E5E5EA] shadow-xs p-4 sm:p-5 lg:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center">
              {/* Left Info + Animated Delivery Route */}
              <div className="lg:col-span-5 flex items-start gap-3.5">
                <div className="relative w-12 h-12 rounded-xl bg-[#071B35] text-white flex items-center justify-center shrink-0 shadow-xs overflow-hidden">
                  <div
                    className={
                      isChecking
                        ? 'animate-tracking-truck'
                        : savedResult?.serviceable
                        ? 'transition-transform duration-500 translate-x-0.5'
                        : 'transition-transform duration-300'
                    }
                  >
                    <Truck className="w-5 h-5 text-[#FF7A00]" />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display font-bold text-sm sm:text-base text-[#071B35] tracking-tight">
                      Check Delhivery Delivery in Your Area
                    </h2>
                    <span className="text-[11px] font-mono font-semibold text-[#B85000]">
                      Delhivery Express
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed">
                    Enter your 6-digit PIN code to verify courier availability &amp; delivery time from our Hyderabad dispatch hub.
                  </p>
                </div>
              </div>

              {/* Right Form & Live Result */}
              <div className="lg:col-span-7 space-y-2.5">
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <label htmlFor={pinInputId} className="sr-only">
                      Enter 6-digit pincode to check Delhivery delivery availability
                    </label>
                    <MapPin className="w-4 h-4 text-[#FF7A00] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                    <input
                      id={pinInputId}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={pinInput}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                        setPinInput(clean);
                        setInputError(null);
                      }}
                      placeholder="Enter 6-digit area pincode (e.g. 560001)"
                      aria-label="Enter 6-digit pincode to check Delhivery availability"
                      className="w-full pl-10 pr-4 py-2.5 min-h-[44px] text-sm font-mono tabular-nums bg-[#FAF9FD] border border-zinc-300 rounded-xl focus:bg-white focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/15 outline-none text-[#071B35] placeholder:font-sans placeholder:text-zinc-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isChecking}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#071B35] hover:bg-[#0c294f] text-white font-display font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-60 whitespace-nowrap shadow-xs"
                  >
                    {isChecking ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-[#FF7A00]" />
                        <span>Checking...</span>
                      </>
                    ) : (
                      <>
                        <Truck className="w-4 h-4 text-[#FF7A00]" />
                        <span>Check Availability</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Quick sample PIN shortcuts + inline error / result */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-zinc-600">
                    <span className="font-medium text-zinc-600">Popular cities:</span>
                    {SAMPLE_PINS.map((item) => (
                      <button
                        key={item.pin}
                        type="button"
                        onClick={() => void runCheck(item.pin)}
                        className="hover:text-[#B85000] font-medium transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {item.label}{' '}
                        <span className="font-mono tabular-nums text-zinc-600">({item.pin})</span>
                      </button>
                    ))}
                  </div>
                </div>

                {inputError && (
                  <p className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{inputError}</span>
                  </p>
                )}

                {savedResult && !isChecking && (
                  <div
                    key={`${savedResult.pincode}-${savedResult.serviceable}`}
                    className={`rounded-xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs transition-all duration-200 ${
                      savedResult.serviceable
                        ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                        : 'bg-red-50/80 border-red-200 text-red-900'
                    }`}
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      {savedResult.serviceable ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5 sm:mt-0" />
                      )}
                      <div className="min-w-0">
                        {savedResult.serviceable ? (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-bold text-emerald-900">
                              Delhivery Available in {formatLocationLine(savedResult)}
                            </span>
                            <span className="text-emerald-700/70">·</span>
                            <span className="font-mono font-semibold tabular-nums text-emerald-800">
                              Est. Delivery: {savedResult.estimatedDays || '2–4 business days'}
                            </span>
                            <span className="text-emerald-700/70">·</span>
                            <span className="text-emerald-700 font-medium">
                              Prepaid &amp; 50% Advance Eligible
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="font-bold">
                              Delivery Not Available for {savedResult.pincode}
                            </span>
                            <span className="text-red-700 ml-1.5">
                              — {savedResult.message || 'Check another nearby pincode.'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!savedResult.serviceable && (
                      <a
                        href={getWhatsAppLink(
                          `Hi TeqqnoWorld, I want to check custom corporate delivery availability for pincode ${savedResult.pincode}.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-[#071B35] hover:text-[#B85000] underline underline-offset-2 whitespace-nowrap shrink-0"
                      >
                        Ask Logistics Team →
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // 'compact' (Product Detail Page) or 'modal' (Navbar Popover/Dialog)
  return (
    <div
      className={`rounded-2xl border border-[#E5E5EA] ${
        variant === 'modal' ? 'bg-white p-5 sm:p-6' : 'bg-[#FAF9FD] p-4'
      } space-y-3 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#071B35] text-white flex items-center justify-center shrink-0">
            <div className={isChecking ? 'animate-tracking-truck' : ''}>
              <Truck className="w-4 h-4 text-[#FF7A00]" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="font-display font-bold text-xs sm:text-sm text-[#071B35] truncate">
              Check Delhivery Area Availability
            </div>
            <div className="text-[11px] text-zinc-600 truncate">
              Dispatched from Hyderabad Hub (502032) via Delhivery Express
            </div>
          </div>
        </div>

        {savedResult && !isEditing && (
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] font-semibold text-[#B85000] hover:text-[#964000] inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Change PIN</span>
          </button>
        )}
      </div>

      {/* Form shown if no saved check OR user clicked Change PIN OR modal variant */}
      {(isEditing || !savedResult || variant === 'modal') && (
        <form onSubmit={handleSubmit} className="flex items-stretch gap-2">
          <div className="relative flex-1">
            <label htmlFor={pinInputId} className="sr-only">
              6-digit delivery pincode
            </label>
            <MapPin className="w-3.5 h-3.5 text-[#FF7A00] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              id={pinInputId}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pinInput}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                setPinInput(clean);
                setInputError(null);
              }}
              placeholder="Enter 6-digit PIN"
              aria-label="6-digit delivery pincode"
              className="w-full pl-8 pr-3 py-2 min-h-[42px] text-xs sm:text-sm font-mono tabular-nums bg-white border border-zinc-300 rounded-xl focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/15 outline-none text-[#071B35] placeholder:font-sans placeholder:text-zinc-500"
            />
          </div>
          <button
            type="submit"
            disabled={isChecking}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#071B35] hover:bg-[#0d2c54] text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF7A00]" />
                <span>Checking</span>
              </>
            ) : (
              <span>Check</span>
            )}
          </button>
        </form>
      )}

      {variant === 'modal' && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
          <span className="text-zinc-600 font-medium">Quick check:</span>
          {SAMPLE_PINS.map((item) => (
            <button
              key={item.pin}
              type="button"
              onClick={() => void runCheck(item.pin)}
              className="hover:text-[#B85000] font-medium transition-colors cursor-pointer"
            >
              {item.label} <span className="font-mono text-zinc-600">({item.pin})</span>
            </button>
          ))}
        </div>
      )}

      {inputError && (
        <div className="text-xs text-red-600 font-medium flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{inputError}</span>
        </div>
      )}

      {savedResult && !isChecking && (
        <div
          key={`${savedResult.pincode}-${savedResult.serviceable}`}
          className={`rounded-xl border p-3 text-xs space-y-2 transition-all duration-200 ${
            savedResult.serviceable
              ? 'bg-white border-emerald-200 text-zinc-800'
              : 'bg-red-50/70 border-red-200 text-red-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {savedResult.serviceable ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="font-bold text-[#071B35]">
                {savedResult.serviceable
                  ? `Delhivery Serviceable · ${formatLocationLine(savedResult)} (${savedResult.pincode})`
                  : `Not Serviceable at ${savedResult.pincode}`}
              </div>
              {savedResult.serviceable ? (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
                  <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-700">
                    <Clock className="w-3 h-3" />
                    Delivery in {savedResult.estimatedDays || '2–4 business days'}
                  </span>
                  <span className="inline-flex items-center gap-1 text-zinc-600">
                    <ShieldCheck className="w-3 h-3 text-[#FF7A00]" />
                    Delhivery Prepaid Express
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-red-700 leading-relaxed">
                  {savedResult.message || 'This pincode is outside Delhivery courier coverage.'}
                </p>
              )}
            </div>
          </div>

          {savedResult.serviceable && (
            <div className="relative h-1.5 w-full bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full w-full bg-gradient-to-r from-[#FF7A00] to-emerald-500 rounded-full transition-all duration-500" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface DelhiveryAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DelhiveryAreaModal: React.FC<DelhiveryAreaModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delhivery-modal-title"
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl border border-[#E5E5EA] shadow-2xl overflow-hidden animate-admin-scale-in"
      >
        <div className="bg-[#071B35] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF7A00] flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 id="delhivery-modal-title" className="font-display font-bold text-sm sm:text-base">
                Delhivery Serviceability Check
              </h2>
              <p className="text-[11px] text-zinc-300">
                Pan-India Courier Coverage · 18,600+ PIN Codes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close delivery availability checker"
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <DelhiveryPincodeChecker variant="modal" />
        </div>
      </div>
    </div>
  );
};
