import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import type { AffiliatePublicVerificationResult } from '../../types/affiliate';
import { formatShortDate, verifyAffiliateCredentialPublic } from '../../services/affiliateService';

interface AffiliateVerificationViewProps {
  verificationCode: string;
  onBackHome: () => void;
}

export const AffiliateVerificationView: React.FC<AffiliateVerificationViewProps> = ({
  verificationCode,
  onBackHome,
}) => {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<AffiliatePublicVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    verifyAffiliateCredentialPublic(verificationCode)
      .then((res) => {
        if (!active) return;
        setResult(res.verification);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message || 'Unable to verify this affiliate credential.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [verificationCode]);

  return (
    <div className="min-h-[75vh] bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="bg-[#071B35] px-6 py-5 border-b-4 border-[#FF7A00] text-white">
            <div className="text-[11px] font-mono uppercase tracking-widest text-slate-300">
              TeqqnoWorld Official Verification Registry
            </div>
            <h1 className="font-display text-xl font-bold mt-1">
              Affiliate Partner Credential Verification
            </h1>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {loading ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Verifying credential code <span className="font-mono font-bold">{verificationCode}</span>...
              </div>
            ) : error || !result ? (
              <div className="space-y-4 text-center py-4">
                <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 text-red-600 mx-auto flex items-center justify-center">
                  <XCircle className="w-7 h-7" />
                </div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Credential Not Found
                </h2>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  {error || 'No official TeqqnoWorld Affiliate Partner record matches this code.'}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div
                  className={`p-4 rounded-xl border flex items-center gap-3 ${
                    result.status === 'active'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : result.status === 'suspended'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  {result.status === 'active' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                  ) : result.status === 'suspended' ? (
                    <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-bold">{result.verificationLabel}</div>
                    <div className="text-[11px] opacity-80">
                      Verified on {formatShortDate(result.verifiedAt)} via teqqnoworld.com
                    </div>
                  </div>
                </div>

                {/* STRICT PUBLIC FIELDS ONLY — ZERO KYC / FINANCIAL / CONTACT LEAKAGE */}
                <dl className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <div className="px-4 py-3 flex items-center justify-between gap-4 bg-white">
                    <dt className="text-slate-500 font-medium">Partner Name</dt>
                    <dd className="font-bold text-[#071B35]">{result.partnerName}</dd>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between gap-4 bg-slate-50/70">
                    <dt className="text-slate-500 font-medium">Affiliate ID</dt>
                    <dd className="font-mono font-bold text-[#071B35]">{result.affiliateId}</dd>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between gap-4 bg-white">
                    <dt className="text-slate-500 font-medium">Certificate Number</dt>
                    <dd className="font-mono font-semibold text-slate-800">{result.certificateNumber}</dd>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between gap-4 bg-slate-50/70">
                    <dt className="text-slate-500 font-medium">Digital ID Card Number</dt>
                    <dd className="font-mono font-semibold text-slate-800">{result.cardNumber}</dd>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between gap-4 bg-white">
                    <dt className="text-slate-500 font-medium">Current Account Status</dt>
                    <dd className="font-bold uppercase tracking-wider text-slate-900">{result.status}</dd>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between gap-4 bg-slate-50/70">
                    <dt className="text-slate-500 font-medium">Joining Date</dt>
                    <dd className="font-mono text-slate-800">{formatShortDate(result.joinedAt)}</dd>
                  </div>
                </dl>

                <div className="flex items-start gap-2 text-[11px] text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-[#FF7A00] shrink-0 mt-0.5" />
                  <span>
                    For partner privacy and compliance, personal contact details, KYC documents,
                    bank accounts, earnings, and customer order records are never exposed on public
                    verification pages.
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
              <button
                type="button"
                onClick={onBackHome}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#071B35] hover:text-[#FF7A00] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to TeqqnoWorld Store</span>
              </button>
              <span className="text-[11px] font-mono text-slate-400">teqqnoworld.com</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
