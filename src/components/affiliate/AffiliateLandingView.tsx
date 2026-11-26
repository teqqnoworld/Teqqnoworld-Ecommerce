import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Award,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileCheck2,
  KeyRound,
  Link2,
  Lock,
  Mail,
  QrCode,
  ShieldCheck,
  TrendingUp,
  Upload,
  UserCheck,
  Wallet,
} from 'lucide-react';
import type { UserProfile } from '../../types';
import type {
  AffiliateApplicationRecord,
  AffiliateEligibilityResult,
  AffiliateKycMaskedView,
  AffiliatePartnerRecord,
  AffiliateProgramSettings,
} from '../../types/affiliate';
import {
  checkAffiliateEligibility,
  fetchAffiliateProgramPublic,
  formatShortDate,
  sendAffiliateEmailOtp,
  submitAffiliateApplication,
  submitAffiliateKyc,
  uploadAffiliateKycDocument,
  verifyAffiliateEmailOtp,
} from '../../services/affiliateService';
import { triggerCelebration } from '../../services/celebrationService';

interface AffiliateLandingViewProps {
  user: UserProfile | null;
  onNavigate: (tab: string) => void;
  onRequestLogin: () => void;
}

const FAQS = [
  {
    q: 'Who can join the TeqqnoWorld Affiliate Partner Program?',
    a: 'Existing TeqqnoWorld customers who are at least 18 years old, have a verified account, and have completed at least one delivered order past the return period are eligible to apply.',
  },
  {
    q: 'Which products earn affiliate commission?',
    a: 'Only products explicitly enabled by the TeqqnoWorld admin team earn affiliate commissions. Eligible products and their current commission rates are listed directly inside your Affiliate Dashboard.',
  },
  {
    q: 'How is affiliate commission calculated?',
    a: 'Commission is calculated on the GST-inclusive discounted amount of eligible products in a referred order, excluding shipping charges. The rate active at order placement is snapshotted permanently for that order.',
  },
  {
    q: 'When does my commission become available to withdraw?',
    a: 'Commissions start in Pending status when an order is placed and automatically move to Available balance after the order is delivered and the return period completes with no refund, cancellation, or fraud hold.',
  },
  {
    q: 'What is the minimum withdrawal amount and payout method?',
    a: 'Once your verified bank account is approved and your Available balance reaches ₹100 or more, you can request a manual bank transfer. Payouts are typically processed within 5–7 working days.',
  },
  {
    q: 'Can I earn commission on my own orders?',
    a: 'No. Self-referral orders are automatically detected and blocked by our server-side attribution engine.',
  },
];

export const AffiliateLandingView: React.FC<AffiliateLandingViewProps> = ({
  user,
  onNavigate,
  onRequestLogin,
}) => {
  const [settings, setSettings] = useState<AffiliateProgramSettings | null>(null);
  const [summary, setSummary] = useState<{
    enabledProductsCount: number;
    minRatePct: number;
    maxRatePct: number;
    minWithdrawalInr: number;
    cookieDurationDays: number;
    returnPeriodDays: number;
    payoutProcessingWindow: string;
  } | null>(null);

  const [eligibility, setEligibility] = useState<AffiliateEligibilityResult | null>(null);
  const [application, setApplication] = useState<AffiliateApplicationRecord | null>(null);
  const [kyc, setKyc] = useState<AffiliateKycMaskedView | null>(null);
  const [partner, setPartner] = useState<{
    affiliateId: string;
    status: AffiliatePartnerRecord['status'];
    fullName: string;
    joinedAt: string;
  } | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);

  // Multi-step application form state
  const [showApplyForm, setShowApplyForm] = useState(false);
  const nameParts = (user?.name || '').trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [email, setEmail] = useState(user?.email || '');
  const [mobile, setMobile] = useState((user?.mobile || '').replace(/\D/g, '').slice(-10));
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [isAdultConfirmed, setIsAdultConfirmed] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [kycConsentAccepted, setKycConsentAccepted] = useState(false);

  // Email OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [devPreviewOtp, setDevPreviewOtp] = useState<string | null>(null);

  // KYC form state
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [bankHolderName, setBankHolderName] = useState(user?.name || '');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfscCode, setBankIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [aadhaarDoc, setAadhaarDoc] = useState<{ ref: string; name: string } | null>(null);
  const [panDoc, setPanDoc] = useState<{ ref: string; name: string } | null>(null);
  const [bankProofDoc, setBankProofDoc] = useState<{ ref: string; name: string } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    fetchAffiliateProgramPublic()
      .then((res) => {
        setSettings(res.settings);
        setSummary(res.summary);
      })
      .catch(() => undefined);
  }, []);

  const refreshEligibility = async () => {
    if (!user?.email) return;
    setLoadingEligibility(true);
    try {
      const res = await checkAffiliateEligibility({
        customerEmail: user.email,
        customerMobile: user.mobile,
      });
      setEligibility(res.eligibility);
      setApplication(res.application);
      setKyc(res.kyc);
      setPartner(res.partner);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Unable to verify eligibility.' });
    } finally {
      setLoadingEligibility(false);
    }
  };

  useEffect(() => {
    if (user?.email) {
      const parts = (user.name || '').trim().split(/\s+/);
      setFirstName(parts[0] || '');
      setLastName(parts.slice(1).join(' ') || '');
      setEmail(user.email);
      setMobile((user.mobile || '').replace(/\D/g, '').slice(-10));
      setCompanyName(user.companyName || '');
      setBankHolderName(user.name || '');
      refreshEligibility();
    }
  }, [user?.email, user?.mobile, user?.name]);

  const handleSendOtp = async () => {
    setFeedback(null);
    setOtpBusy(true);
    try {
      const res = await sendAffiliateEmailOtp({ email, firstName });
      setOtpSent(true);
      setDevPreviewOtp(res.devPreviewOtp || null);
      setFeedback({ type: 'success', text: res.message });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Failed to send OTP.' });
    } finally {
      setOtpBusy(false);
    }
  };

  const handleVerifyOtp = async () => {
    setFeedback(null);
    setOtpBusy(true);
    try {
      const res = await verifyAffiliateEmailOtp({ email, code: otpCode });
      setOtpVerified(res.emailVerified);
      setFeedback({ type: 'success', text: res.message });
      if (res.emailVerified) {
        triggerCelebration({
          level: 'subtle',
          sound: 'chime',
          eventKey: `aff-otp-verified:${email}`,
          action: 'affiliate_email_verified',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'OTP verification failed.' });
    } finally {
      setOtpBusy(false);
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await submitAffiliateApplication({
        customerUserId: user?.id,
        email,
        firstName,
        lastName,
        mobile,
        companyName: companyName || undefined,
        dateOfBirth: dateOfBirth || undefined,
        isAdultConfirmed,
        termsAccepted,
        privacyAccepted,
        kycConsentAccepted,
      });
      setApplication(res.application);
      setFeedback({ type: 'success', text: res.message });
      triggerCelebration({
        level: 'premium',
        sound: 'celebration',
        eventKey: `aff-app-submitted:${res.application?.id || email}`,
        action: 'affiliate_application_submitted',
      });
      await refreshEligibility();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Unable to submit application.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDocFileChange = async (
    docType: 'aadhaar' | 'pan' | 'bank_proof',
    file: File | null
  ) => {
    if (!file || !user?.email) return;
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      setFeedback({ type: 'error', text: 'Only JPG, PNG, or PDF files are accepted.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'File size must not exceed 10 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await uploadAffiliateKycDocument(user.email, {
          docType,
          fileName: file.name,
          dataUrl: String(reader.result || ''),
        });
        const uploaded = { ref: res.storedRef, name: res.displayName };
        if (docType === 'aadhaar') setAadhaarDoc(uploaded);
        else if (docType === 'pan') setPanDoc(uploaded);
        else setBankProofDoc(uploaded);
        setFeedback({ type: 'success', text: `Uploaded ${file.name} securely.` });
      } catch (err: any) {
        setFeedback({ type: 'error', text: err?.message || 'Document upload failed.' });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitKyc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email || !application) return;
    setFeedback(null);
    setSubmitting(true);
    try {
      const res = await submitAffiliateKyc(user.email, {
        applicationId: application.id,
        aadhaarNumber,
        panNumber: panNumber.toUpperCase(),
        bankAccountHolderName: bankHolderName,
        bankAccountNumber,
        bankIfscCode: bankIfscCode.toUpperCase(),
        bankName,
        aadhaarDocRef: aadhaarDoc?.ref || null,
        panDocRef: panDoc?.ref || null,
        bankProofDocRef: bankProofDoc?.ref || null,
        aadhaarDocName: aadhaarDoc?.name || null,
        panDocName: panDoc?.name || null,
        bankProofDocName: bankProofDoc?.name || null,
      });
      setKyc(res.kyc);
      setFeedback({ type: 'success', text: res.message });
      triggerCelebration({
        level: 'premium',
        sound: 'celebration',
        eventKey: `aff-kyc-submitted:${res.kyc?.id || application.id}`,
        action: 'affiliate_kyc_submitted',
      });
      await refreshEligibility();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'KYC submission failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  const needsKycSubmission =
    application &&
    !partner &&
    ['submitted', 'under_review', 'kyc_pending'].includes(application.status) &&
    (!kyc || kyc.kycStatus === 'rejected' || kyc.bankVerificationStatus === 'rejected');

  return (
    <div className="bg-white text-slate-900">
      {/* 1. HERO SECTION — Editorial Dark Navy & Orange Brand Authority */}
      <section className="bg-[#071B35] text-white border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-[#FF7A00] font-semibold">
                TeqqnoWorld Official Partner Program
              </div>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.12] text-white">
                Partner With TeqqnoWorld &amp; Earn Verified Commissions
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                Built exclusively for verified TeqqnoWorld customers. Share clean product and
                storefront referral links, track real-time last-click performance, and receive
                transparent INR bank payouts backed by an auditable financial ledger.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                {partner ? (
                  <button
                    onClick={() => onNavigate('affiliate-dashboard')}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white font-semibold text-sm transition-colors cursor-pointer"
                  >
                    <span>Open Affiliate Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : user ? (
                  <button
                    onClick={() => {
                      setShowApplyForm(true);
                      document.getElementById('affiliate-apply-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white font-semibold text-sm transition-colors cursor-pointer"
                  >
                    <span>{application ? 'View Application & KYC Status' : 'Check Eligibility & Apply Now'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={onRequestLogin}
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white font-semibold text-sm transition-colors cursor-pointer"
                  >
                    <span>Sign In to Apply</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => {
                    try {
                      sessionStorage.setItem('tw_affiliate_demo_mode', '1');
                    } catch {
                      // ignore storage restrictions
                    }
                    onNavigate('affiliate-dashboard');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  <Eye className="w-4 h-4 text-[#FF7A00]" />
                  <span>Preview Demo Dashboard</span>
                </button>

                <a
                  href="#affiliate-how-it-works"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-xl border border-slate-600 hover:border-slate-400 text-slate-100 font-semibold text-sm transition-colors"
                >
                  <span>How It Works</span>
                </a>
              </div>
            </div>

            {/* Right Key Program Numbers (Flat, Clean Tabular Grid) */}
            <div className="lg:col-span-5">
              <div className="bg-[#0B2447] border border-slate-700/80 rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-300">
                    Program Terms Summary
                  </span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {settings?.programPaused ? 'Paused' : 'Open to Customers'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-[#071B35] border border-slate-700/60">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      Attribution Window
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-white">
                      {summary?.cookieDurationDays ?? 30} Days
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Last-click website-wide</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#071B35] border border-slate-700/60">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      Min. Withdrawal
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#FF7A00]">
                      ₹{summary?.minWithdrawalInr ?? 100}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Direct bank transfer</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#071B35] border border-slate-700/60">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      Return Hold
                    </div>
                    <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-white">
                      {summary?.returnPeriodDays ?? 7} Days
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">After order delivery</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#071B35] border border-slate-700/60">
                    <div className="text-[11px] uppercase tracking-wider text-slate-400">
                      Payout SLA
                    </div>
                    <div className="mt-1 text-xl font-bold font-mono tabular-nums text-white">
                      5–7 Days
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Working days (manual)</div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Single common partner membership for all verified affiliates. Monthly targets,
                  performance rewards, official QR-verifiable Certificate &amp; Digital ID Card included.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. HOW IT WORKS */}
      <section id="affiliate-how-it-works" className="py-16 border-b border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#071B35]">
              How the Affiliate Program Works
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              A transparent, server-verified workflow from verified customer registration to direct INR payouts.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {[
              {
                step: '01',
                icon: UserCheck,
                title: 'Verify Customer Eligibility',
                desc: 'Sign in with your TeqqnoWorld customer account (at least 1 delivered order past return period & age 18+) and verify your email via OTP.',
              },
              {
                step: '02',
                icon: ShieldCheck,
                title: 'Complete KYC & Bank Verification',
                desc: 'Submit Aadhaar, PAN, and bank details with supporting documents. Sensitive numbers are AES-256 encrypted and admin-verified.',
              },
              {
                step: '03',
                icon: Link2,
                title: 'Share Links & QR Codes',
                desc: 'Receive your unique Affiliate ID (TW-AFF-XXXXXX), website-wide & product links, downloadable QR codes, Certificate & Digital ID Card.',
              },
              {
                step: '04',
                icon: Wallet,
                title: 'Earn & Withdraw INR',
                desc: 'Commissions calculate on GST-inclusive discounted eligible products (excluding shipping) and release to Available balance post-return period.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="w-10 h-10 rounded-lg bg-[#071B35] text-white flex items-center justify-center">
                        <Icon className="w-5 h-5 text-[#FF7A00]" />
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-400">{item.step}</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[#071B35]">{item.title}</h3>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. ELIGIBILITY, COMMISSION RULES & BENEFITS */}
      <section className="py-16 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="border border-slate-200 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#071B35] font-display font-bold text-base">
              <FileCheck2 className="w-5 h-5 text-[#FF7A00]" />
              <span>Strict Eligibility Rules</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li>• Existing TeqqnoWorld customers only (no anonymous public registration).</li>
              <li>• Minimum 1 completed delivered order past the configured return period.</li>
              <li>• Applicant must be 18+ years old with verified email OTP.</li>
              <li>• Mandatory Aadhaar, PAN, and Bank verification prior to partner activation.</li>
              <li>• Suspended or closed partner accounts cannot bypass restrictions.</li>
            </ul>
          </div>

          <div className="border border-slate-200 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#071B35] font-display font-bold text-base">
              <TrendingUp className="w-5 h-5 text-[#FF7A00]" />
              <span>Commission &amp; Attribution Engine</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li>• Last-click attribution with a {summary?.cookieDurationDays ?? 30}-day HTTP-only cookie window.</li>
              <li>• Website-wide attribution on any admin-enabled product bought within the window.</li>
              <li>• Calculated on GST-inclusive discounted product amount; shipping excluded.</li>
              <li>• Permanent order-item commission snapshot so future rate edits never alter past orders.</li>
              <li>• Automatic self-referral blocking &amp; proportional refund adjustments.</li>
            </ul>
          </div>

          <div className="border border-slate-200 rounded-xl p-6 space-y-3">
            <div className="flex items-center gap-2 text-[#071B35] font-display font-bold text-base">
              <Award className="w-5 h-5 text-[#FF7A00]" />
              <span>Partner Credentials &amp; Rewards</span>
            </div>
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li>• Official downloadable Partner Certificate &amp; Digital ID Card with live QR verification.</li>
              <li>• Dedicated Affiliate Dashboard separate from your Customer Dashboard.</li>
              <li>• Monthly sales targets with cash bonuses, gifts, products, or vouchers.</li>
              <li>• Monthly, Yearly &amp; All-Time Leaderboards with strict partner privacy protection.</li>
              <li>• CSV &amp; PDF exports for analytics, sales, conversion, and commission reports.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. APPLICATION, ELIGIBILITY CHECKER & KYC PORTAL */}
      <section id="affiliate-apply-section" className="py-16 bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-5">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-[#071B35]">
                  Partner Eligibility &amp; Application Portal
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Eligibility is verified live against your TeqqnoWorld order history on the server.
                </p>
              </div>
              {partner && (
                <button
                  onClick={() => onNavigate('affiliate-dashboard')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#071B35] hover:bg-[#0c294f] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  <span>Go to Affiliate Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>

            {feedback && (
              <div
                className={`p-3.5 rounded-xl text-xs font-medium border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {feedback.text}
              </div>
            )}

            {!user ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-[#071B35] text-[#FF7A00] mx-auto flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <h3 className="font-display text-lg font-bold text-[#071B35]">
                  Sign In With Your TeqqnoWorld Customer Account
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto">
                  The Affiliate Partner Program is exclusively available to verified TeqqnoWorld
                  customers with at least one completed delivered order.
                </p>
                <button
                  onClick={onRequestLogin}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold cursor-pointer"
                >
                  <span>Sign In / Verify Account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : partner ? (
              <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-slate-500">AFFILIATE PARTNER ID</div>
                    <div className="text-lg font-bold font-mono text-[#071B35]">
                      {partner.affiliateId}
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-md text-xs font-bold uppercase ${
                      partner.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800'
                        : partner.status === 'suspended'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {partner.status}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Partner: <strong className="text-slate-900">{partner.fullName}</strong> • Joined{' '}
                  {formatShortDate(partner.joinedAt)}
                </p>
                <button
                  onClick={() => onNavigate('affiliate-dashboard')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold cursor-pointer"
                >
                  <span>Open Dedicated Affiliate Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Eligibility Summary Strip */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#071B35]">
                      Server Eligibility Check ({user.email})
                    </span>
                    <button
                      type="button"
                      onClick={refreshEligibility}
                      disabled={loadingEligibility}
                      className="text-xs font-semibold text-[#FF7A00] hover:underline cursor-pointer"
                    >
                      {loadingEligibility ? 'Checking...' : 'Re-verify'}
                    </button>
                  </div>
                  {eligibility && (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 ${
                            eligibility.eligible ? 'text-emerald-600' : 'text-amber-600'
                          }`}
                        />
                        <span className="font-semibold text-slate-900">
                          {eligibility.eligible
                            ? 'Eligible to Apply — Delivered order past return period verified'
                            : application
                            ? `Application Status: ${application.status.replace(/_/g, ' ').toUpperCase()}`
                            : 'Not Yet Eligible'}
                        </span>
                      </div>
                      {!eligibility.eligible && eligibility.reasons.length > 0 && (
                        <ul className="pl-6 space-y-1 text-slate-600 list-disc">
                          {eligibility.reasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Application Status Banner if already submitted */}
                {application && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[#071B35]">
                        Current Application ({formatShortDate(application.createdAt)})
                      </span>
                      <span className="font-mono font-bold uppercase text-[#FF7A00]">
                        {application.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {application.rejectionReason && (
                      <p className="text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                        Rejection Reason: {application.rejectionReason}
                      </p>
                    )}
                    {kyc && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <span className="text-slate-500">KYC Status:</span>{' '}
                          <strong className="uppercase">{kyc.kycStatus}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Bank Status:</span>{' '}
                          <strong className="uppercase">{kyc.bankVerificationStatus}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500">Masked Account:</span>{' '}
                          <strong className="font-mono">{kyc.bankAccountMasked}</strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 2: KYC & BANK VERIFICATION FORM */}
                {needsKycSubmission && (
                  <form onSubmit={handleSubmitKyc} className="space-y-4 border-t border-slate-200 pt-5">
                    <div>
                      <h3 className="font-display text-base font-bold text-[#071B35]">
                        Step 2: Mandatory KYC &amp; Bank Account Verification
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Sensitive Aadhaar, PAN, and Bank numbers are encrypted using AES-256-GCM at rest
                        and displayed only in masked form to compliance reviewers.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Aadhaar Number (12 digits) *
                        </label>
                        <input
                          type="text"
                          required
                          value={aadhaarNumber}
                          onChange={(e) => setAadhaarNumber(e.target.value)}
                          placeholder="12-digit Aadhaar number"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-[#071B35]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          PAN Number (10 chars) *
                        </label>
                        <input
                          type="text"
                          required
                          value={panNumber}
                          onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                          placeholder="ABCDE1234F"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono uppercase focus:outline-none focus:border-[#071B35]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Bank Account Holder Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={bankHolderName}
                          onChange={(e) => setBankHolderName(e.target.value)}
                          placeholder="Full name as per bank passbook"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#071B35]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Bank Account Number *
                        </label>
                        <input
                          type="text"
                          required
                          value={bankAccountNumber}
                          onChange={(e) => setBankAccountNumber(e.target.value)}
                          placeholder="9 to 18 digit account number"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-[#071B35]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          IFSC Code *
                        </label>
                        <input
                          type="text"
                          required
                          value={bankIfscCode}
                          onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())}
                          placeholder="HDFC0001234"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono uppercase focus:outline-none focus:border-[#071B35]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="e.g., HDFC Bank, SBI, ICICI Bank"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#071B35]"
                        />
                      </div>
                    </div>

                    {/* Supporting KYC Document Uploads */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { key: 'aadhaar' as const, label: 'Aadhaar Copy (JPG/PNG/PDF)', doc: aadhaarDoc },
                        { key: 'pan' as const, label: 'PAN Card Copy (JPG/PNG/PDF)', doc: panDoc },
                        { key: 'bank_proof' as const, label: 'Cancelled Cheque / Passbook', doc: bankProofDoc },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className="flex flex-col gap-1.5 p-3 rounded-xl border border-dashed border-slate-300 hover:border-[#FF7A00] cursor-pointer bg-slate-50"
                        >
                          <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                            <Upload className="w-3.5 h-3.5 text-[#FF7A00]" />
                            {item.label}
                          </span>
                          <span className="text-[11px] text-slate-500 truncate">
                            {item.doc ? `Uploaded: ${item.doc.name}` : 'Click to upload (max 10 MB)'}
                          </span>
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.pdf"
                            className="hidden"
                            onChange={(e) => handleDocFileChange(item.key, e.target.files?.[0] || null)}
                          />
                        </label>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#071B35] hover:bg-[#0d2c54] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4 text-[#FF7A00]" />
                      <span>{submitting ? 'Encrypting & Submitting...' : 'Submit KYC & Bank Details'}</span>
                    </button>
                  </form>
                )}

                {/* STEP 1: APPLICATION FORM (When Eligible or Reapplying after Rejection) */}
                {(eligibility?.eligible || showApplyForm) &&
                  (!application || application.status === 'rejected') && (
                    <form onSubmit={handleSubmitApplication} className="space-y-4 border-t border-slate-200 pt-5">
                      <h3 className="font-display text-base font-bold text-[#071B35]">
                        Step 1: Affiliate Partner Registration &amp; Email OTP
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            First Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#071B35]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Last Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#071B35]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Mobile Number (10 digits) *
                          </label>
                          <input
                            type="tel"
                            required
                            value={mobile}
                            onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-mono focus:outline-none focus:border-[#071B35]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Company Name (Optional)
                          </label>
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#071B35]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Date of Birth (Must be 18+) *
                          </label>
                          <input
                            type="date"
                            required
                            value={dateOfBirth}
                            onChange={(e) => setDateOfBirth(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#071B35]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Customer Email (OTP Required) *
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                setOtpVerified(false);
                              }}
                              className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-[#071B35]"
                            />
                            <button
                              type="button"
                              onClick={handleSendOtp}
                              disabled={otpBusy || !email}
                              className="px-3.5 py-2 rounded-lg bg-[#071B35] text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                            >
                              {otpSent ? 'Resend OTP' : 'Send OTP'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {otpSent && !otpVerified && (
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 space-y-1">
                            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                              <KeyRound className="w-3.5 h-3.5 text-[#FF7A00]" />
                              Enter 6-digit Email OTP
                            </label>
                            {devPreviewOtp && (
                              <div className="text-[11px] font-mono text-slate-500">
                                Preview SMTP Simulation OTP: <strong>{devPreviewOtp}</strong>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={otpCode}
                              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="6-digit OTP"
                              className="w-32 px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono tracking-widest text-center"
                            />
                            <button
                              type="button"
                              onClick={handleVerifyOtp}
                              disabled={otpBusy || otpCode.length !== 6}
                              className="px-4 py-2 rounded-lg bg-[#FF7A00] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              Verify OTP
                            </button>
                          </div>
                        </div>
                      )}

                      {otpVerified && (
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                          <Mail className="w-4 h-4" />
                          <span>Email verified via OTP.</span>
                        </div>
                      )}

                      {/* Mandatory Consents */}
                      <div className="space-y-2.5 pt-2 text-xs text-slate-700">
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAdultConfirmed}
                            onChange={(e) => setIsAdultConfirmed(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>I confirm that I am at least 18 years of age.</span>
                        </label>
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            I agree to the TeqqnoWorld Affiliate Program Terms &amp; Conditions (
                            {settings?.termsVersion || 'v1.0'}) including no self-referrals, no paid brand-bidding, and return-period commission hold rules.
                          </span>
                        </label>
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={privacyAccepted}
                            onChange={(e) => setPrivacyAccepted(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            I agree to the TeqqnoWorld Privacy Policy ({settings?.privacyVersion || 'v1.0'}).
                          </span>
                        </label>
                        <label className="flex items-start gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={kycConsentAccepted}
                            onChange={(e) => setKycConsentAccepted(e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            I consent to mandatory Aadhaar, PAN, and Bank Verification ({settings?.kycConsentVersion || 'v1.0'}) for payout compliance and fraud prevention.
                          </span>
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting || !otpVerified || !eligibility?.eligible}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                      >
                        <span>{submitting ? 'Submitting Application...' : 'Submit Affiliate Application'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. FAQ SECTION */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-[#071B35] mb-6">
            Frequently Asked Questions
          </h2>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left gap-4 hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="text-sm font-semibold text-[#071B35]">{item.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#FF7A00] shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs text-slate-600 leading-relaxed">{item.a}</div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-2.5">
              <QrCode className="w-5 h-5 text-[#FF7A00] shrink-0" />
              <span>
                Verify an official TeqqnoWorld Partner Certificate or Digital ID Card by scanning its
                QR code or visiting <code className="font-mono text-[#071B35]">/affiliate/verify/&lt;code&gt;</code>.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/terms-and-conditions')}
                className="font-semibold text-[#071B35] hover:text-[#FF7A00] cursor-pointer"
              >
                Terms &amp; Conditions
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => onNavigate('/privacy-policy')}
                className="font-semibold text-[#071B35] hover:text-[#FF7A00] cursor-pointer"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
