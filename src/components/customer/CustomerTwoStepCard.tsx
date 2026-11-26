import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Mail,
  CheckCircle2,
  AlertCircle,
  Lock,
  RefreshCw,
  ArrowRight,
  KeyRound,
  Smartphone,
  QrCode,
  Copy,
  Check,
} from 'lucide-react';
import {
  confirmCustomerTotpSetup,
  disableCustomerTotp,
  getCustomerTwoStepStatus,
  sendCustomerTwoStepSetupOtp,
  startCustomerTotpSetup,
  toggleCustomerTwoStep,
} from '../../services/customerTwoStepService';
import { triggerCelebration } from '../../services/celebrationService';

interface CustomerTwoStepCardProps {
  hasSupabaseSession: boolean | null;
  sessionEmail: string;
  fallbackEmail: string;
  onOpenAuth?: () => void;
  onToast: (msg: string, variant?: 'success' | 'error' | 'info') => void;
}

export const CustomerTwoStepCard: React.FC<CustomerTwoStepCardProps> = ({
  hasSupabaseSession,
  sessionEmail,
  fallbackEmail,
  onOpenAuth,
  onToast,
}) => {
  const [loading, setLoading] = useState(true);

  // Method 1: Google Authenticator (TOTP) state
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpUpdatedAt, setTotpUpdatedAt] = useState<string | null>(null);
  const [totpMode, setTotpMode] = useState<'idle' | 'setup' | 'disable'>('idle');
  const [totpQrUrl, setTotpQrUrl] = useState('');
  const [totpManualKey, setTotpManualKey] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [totpBusy, setTotpBusy] = useState(false);
  const [totpError, setTotpError] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  // Method 2: Email 6-Digit OTP state
  const [enabled, setEnabled] = useState(false);
  const [activeEmail, setActiveEmail] = useState(sessionEmail || fallbackEmail || '');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [mode, setMode] = useState<'idle' | 'enable' | 'change_email' | 'disable'>('idle');
  const [targetEmailInput, setTargetEmailInput] = useState(sessionEmail || fallbackEmail || '');
  const [otpSentTo, setOtpSentTo] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const loadStatus = async () => {
    if (!hasSupabaseSession) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await getCustomerTwoStepStatus();
    if (res.success) {
      setEnabled(Boolean(res.enabled));
      setTotpEnabled(Boolean(res.totpEnabled));
      setTotpUpdatedAt(res.totpUpdatedAt || null);
      const resolvedEmail =
        res.twoStepEmail || res.accountEmail || sessionEmail || fallbackEmail || '';
      setActiveEmail(resolvedEmail);
      setTargetEmailInput(resolvedEmail);
      setUpdatedAt(res.updatedAt || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (hasSupabaseSession === null) return;
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSupabaseSession, sessionEmail]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // ------------------------------------------------------------------
  // GOOGLE AUTHENTICATOR (QR CODE TOTP) HANDLERS
  // ------------------------------------------------------------------
  const resetTotpFlow = () => {
    setTotpMode('idle');
    setTotpQrUrl('');
    setTotpManualKey('');
    setTotpCode('');
    setTotpError('');
    setCopiedKey(false);
  };

  const handleStartTotpSetup = async () => {
    setTotpError('');
    setTotpBusy(true);
    try {
      const res = await startCustomerTotpSetup();
      if (!res.success || !res.qrDataUrl) {
        setTotpError(res.message || 'Could not generate QR code. Please try again.');
        return;
      }
      setTotpQrUrl(res.qrDataUrl);
      setTotpManualKey(res.manualKey || '');
      setTotpCode('');
      setTotpMode('setup');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleConfirmTotpSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError('');
    const clean = totpCode.replace(/[^0-9]/g, '').trim();
    if (clean.length !== 6) {
      setTotpError('Please enter the 6-digit code shown in Google Authenticator.');
      return;
    }

    setTotpBusy(true);
    try {
      const res = await confirmCustomerTotpSetup(clean);
      if (!res.success) {
        setTotpError(res.message || 'Incorrect 6-digit code. Please try again.');
        return;
      }
      setTotpEnabled(true);
      setTotpUpdatedAt(res.totpUpdatedAt || new Date().toISOString());
      resetTotpFlow();
      onToast(res.message || 'Google Authenticator 2-Step Verification is now ACTIVE!', 'success');
      triggerCelebration({
        level: 'subtle',
        sound: 'chime',
        eventKey: `2fa-totp-enabled:${sessionEmail || fallbackEmail}`,
        action: 'verification_successful',
      });
    } finally {
      setTotpBusy(false);
    }
  };

  const handleDisableTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTotpError('');
    const clean = totpCode.replace(/[^0-9]/g, '').trim();
    if (clean.length !== 6) {
      setTotpError('Enter the current 6-digit code from Google Authenticator to confirm.');
      return;
    }

    setTotpBusy(true);
    try {
      const res = await disableCustomerTotp(clean);
      if (!res.success) {
        setTotpError(res.message || 'Incorrect 6-digit Authenticator code.');
        return;
      }
      setTotpEnabled(false);
      setTotpUpdatedAt(res.totpUpdatedAt || new Date().toISOString());
      resetTotpFlow();
      onToast(res.message || 'Google Authenticator turned OFF.', 'info');
    } finally {
      setTotpBusy(false);
    }
  };

  const handleCopyManualKey = () => {
    if (!totpManualKey) return;
    navigator.clipboard?.writeText(totpManualKey.replace(/\s+/g, '')).catch(() => {});
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // ------------------------------------------------------------------
  // EMAIL 6-DIGIT OTP HANDLERS
  // ------------------------------------------------------------------
  const resetActionFlow = () => {
    setMode('idle');
    setOtpSentTo('');
    setOtpCode('');
    setErrorMsg('');
    setInfoMsg('');
  };

  const handleSendOtp = async (action: 'enable' | 'disable' | 'change_email') => {
    setErrorMsg('');
    setInfoMsg('');

    const emailToUse =
      action === 'disable'
        ? activeEmail || sessionEmail || fallbackEmail
        : targetEmailInput.trim().toLowerCase();

    if (!emailToUse || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailToUse)) {
      setErrorMsg('Please enter a valid email address (e.g. name@gmail.com).');
      return;
    }

    setSendingOtp(true);
    try {
      const res = await sendCustomerTwoStepSetupOtp({
        email: emailToUse,
        action,
      });
      if (!res.success) {
        if (res.retryAfterSec) setCooldown(res.retryAfterSec);
        setErrorMsg(res.message || 'Could not send 6-digit verification code.');
        return;
      }

      setMode(action);
      setOtpSentTo(res.targetEmail || emailToUse);
      setOtpCode('');
      setCooldown(30);
      setInfoMsg(
        res.simulated && res.devOtp
          ? `Simulation Mode: Use verification code ${res.devOtp}.`
          : `6-digit verification code sent to ${res.targetEmail || emailToUse}. Check your inbox to confirm.`
      );
      onToast(
        res.simulated
          ? `Verification code generated (${res.devOtp})`
          : `6-digit code sent to ${res.targetEmail || emailToUse}`,
        'info'
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'idle') return;
    setErrorMsg('');

    const cleanOtp = otpCode.replace(/[^0-9]/g, '').trim();
    if (cleanOtp.length !== 6) {
      setErrorMsg('Please enter the complete 6-digit code sent to your email.');
      return;
    }

    const nextEnabled = mode === 'disable' ? false : true;
    setVerifying(true);
    try {
      const res = await toggleCustomerTwoStep({
        enabled: nextEnabled,
        action: mode,
        otp: cleanOtp,
      });
      if (!res.success) {
        setErrorMsg(res.message || 'Invalid or expired verification code.');
        return;
      }

      setEnabled(Boolean(res.enabled));
      if (res.twoStepEmail) {
        setActiveEmail(res.twoStepEmail);
        setTargetEmailInput(res.twoStepEmail);
      }
      setUpdatedAt(res.updatedAt || new Date().toISOString());
      resetActionFlow();
      onToast(
        res.message ||
          (nextEnabled
            ? 'Two-Step Email Verification is now ACTIVE!'
            : 'Two-Step Verification turned OFF.'),
        'success'
      );
      if (nextEnabled) {
        triggerCelebration({
          level: 'subtle',
          sound: 'chime',
          eventKey: `2fa-email-enabled:${res.twoStepEmail || sessionEmail || fallbackEmail}`,
          action: 'email_verification_successful',
        });
      }
    } finally {
      setVerifying(false);
    }
  };

  const anyActive = totpEnabled || enabled;

  return (
    <div className="space-y-5">
      {/* ================================================================= */}
      {/* CARD 1: GOOGLE AUTHENTICATOR APP (QR CODE TOTP)                   */}
      {/* ================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                totpEnabled
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-[#0B1530] text-[#FF7900]'
              }`}
            >
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-[#0B1530] font-display">
                  Google Authenticator (QR Code 2FA)
                </h3>
                {hasSupabaseSession && !loading && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                      totpEnabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-orange-50 text-[#C2410C] border-orange-200'
                    }`}
                  >
                    {totpEnabled ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ACTIVE</span>
                      </>
                    ) : (
                      <span>RECOMMENDED</span>
                    )}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Scan a QR code with <strong>Google Authenticator</strong>, Microsoft Authenticator, or Authy to get instant offline 6-digit login codes every 30 seconds.
              </p>
            </div>
          </div>
        </div>

        {/* Non-Supabase / Demo Account Notice */}
        {hasSupabaseSession === false && (
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-amber-900 space-y-0.5">
              <div className="font-bold">Sign in with your registered account to activate 2-Step Verification</div>
              <div className="text-amber-800/90">
                You are currently browsing with a local demo preview session.
              </div>
            </div>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-4 py-2 rounded-xl bg-[#0B1530] hover:bg-[#132550] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#FF7900]" />
              </button>
            )}
          </div>
        )}

        {hasSupabaseSession && loading && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-500 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-[#FF7900]" />
            <span>Loading Authenticator status...</span>
          </div>
        )}

        {hasSupabaseSession && !loading && (
          <div className="space-y-4">
            {totpError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{totpError}</span>
              </div>
            )}

            {/* TOTP OFF & IDLE */}
            {!totpEnabled && totpMode === 'idle' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-600 space-y-0.5">
                  <div className="font-bold text-[#0B1530]">Fastest &amp; Strongest Protection</div>
                  <div>Works offline on Android &amp; iPhone with zero SMS or email delay.</div>
                </div>
                <button
                  type="button"
                  disabled={totpBusy}
                  onClick={handleStartTotpSetup}
                  className="px-4 py-2.5 rounded-xl bg-[#0B1530] hover:bg-[#132550] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer min-h-[44px] disabled:opacity-60"
                >
                  {totpBusy ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-[#FF7900]" />
                      <span>Generating QR...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4 text-[#FF7900]" />
                      <span>Setup Google Authenticator</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* TOTP SETUP STEP: QR CODE + MANUAL KEY + 6-DIGIT VERIFY */}
            {totpMode === 'setup' && (
              <form
                onSubmit={handleConfirmTotpSetup}
                className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-[#FF7900]/35 space-y-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#0B1530] flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-[#FF7900]" />
                    <span>Step 1: Scan QR Code in Google Authenticator</span>
                  </div>
                  <button
                    type="button"
                    onClick={resetTotpFlow}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 items-center">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center mx-auto md:mx-0">
                    {totpQrUrl && (
                      <img
                        src={totpQrUrl}
                        alt="TeqqnoWorld Google Authenticator QR Code"
                        className="w-44 h-44 object-contain"
                      />
                    )}
                  </div>

                  <div className="space-y-3.5 text-xs text-slate-600">
                    <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                      <li>
                        Open <strong>Google Authenticator</strong> (or Microsoft Authenticator) on your phone.
                      </li>
                      <li>
                        Tap <strong>+</strong> &rarr; <strong>Scan a QR code</strong> and scan this code.
                      </li>
                      <li>
                        Enter the <strong>6-digit code</strong> shown for <strong>TeqqnoWorld</strong> below to finish activation.
                      </li>
                    </ol>

                    {totpManualKey && (
                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                          Can&apos;t scan? Enter Manual Setup Key:
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <code className="font-mono text-xs font-bold text-[#0B1530] break-all">
                            {totpManualKey}
                          </code>
                          <button
                            type="button"
                            onClick={handleCopyManualKey}
                            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#0B1530] text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80 space-y-3">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Step 2: Enter 6-Digit Code From Google Authenticator App
                  </label>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={totpCode}
                      onChange={(e) => {
                        setTotpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                        if (totpError) setTotpError('');
                      }}
                      placeholder="• • • • • •"
                      autoFocus
                      required
                      className="w-52 bg-white text-[#0B1530] text-center font-mono text-xl font-bold tracking-[0.4em] py-2.5 px-4 rounded-xl border-2 border-slate-300 focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/20 outline-none"
                    />
                    <button
                      type="submit"
                      disabled={totpBusy || totpCode.length !== 6}
                      className="px-5 py-3 rounded-xl bg-[#FF7900] hover:bg-[#E56D00] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer min-h-[46px] disabled:opacity-50"
                    >
                      {totpBusy ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Activating...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Verify &amp; Activate Authenticator</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* TOTP ACTIVE & IDLE */}
            {totpEnabled && totpMode === 'idle' && (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Google Authenticator App Connected</span>
                  </div>
                  <div className="text-xs text-emerald-800">
                    Sign-ins require a live 6-digit code from your Authenticator app.
                  </div>
                  {totpUpdatedAt && (
                    <div className="text-[11px] text-emerald-800/80">
                      Activated on{' '}
                      {new Date(totpUpdatedAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTotpMode('disable');
                    setTotpCode('');
                    setTotpError('');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-red-50 border border-red-200 text-red-700 text-xs font-bold cursor-pointer min-h-[40px]"
                >
                  Turn OFF Authenticator
                </button>
              </div>
            )}

            {/* TOTP DISABLE CONFIRMATION */}
            {totpEnabled && totpMode === 'disable' && (
              <form
                onSubmit={handleDisableTotp}
                className="p-4 rounded-xl bg-red-50/60 border border-red-200 space-y-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-red-900">
                    Confirm Turning OFF Google Authenticator
                  </span>
                  <button
                    type="button"
                    onClick={resetTotpFlow}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <p className="text-xs text-red-800">
                  Enter the current 6-digit code from your Google Authenticator app to disable app-based 2-Step Verification.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => {
                      setTotpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                      if (totpError) setTotpError('');
                    }}
                    placeholder="• • • • • •"
                    autoFocus
                    required
                    className="w-48 bg-white text-[#0B1530] text-center font-mono text-lg font-bold tracking-[0.4em] py-2.5 px-3 rounded-xl border border-red-300 focus:border-red-500 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={totpBusy || totpCode.length !== 6}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer min-h-[44px] disabled:opacity-50"
                  >
                    {totpBusy ? 'Verifying...' : 'Confirm & Turn OFF'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* CARD 2: EMAIL 6-DIGIT OTP TWO-STEP VERIFICATION                   */}
      {/* ================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                enabled
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : 'bg-orange-50 text-[#FF7900] border border-orange-200'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-[#0B1530] font-display">
                  Email 6-Digit OTP Verification
                </h3>
                {hasSupabaseSession && !loading && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${
                      enabled
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {enabled ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>ACTIVE</span>
                      </>
                    ) : (
                      <span>{anyActive ? 'BACKUP OPTION' : 'OFF'}</span>
                    )}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Receive a fresh 6-digit login code on your verified Email ID. Works great either standalone or as a backup if you don&apos;t have your phone with Google Authenticator.
              </p>
            </div>
          </div>
        </div>

        {/* Authenticated Email 2FA Controls */}
        {hasSupabaseSession && !loading && (
          <div className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {infoMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                <Mail className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{infoMsg}</span>
              </div>
            )}

            {/* STATE 1: OFF & IDLE */}
            {!enabled && mode === 'idle' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3.5">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Verification Email ID (6-Digit Login Codes Will Be Sent Here)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={targetEmailInput}
                      onChange={(e) => {
                        setTargetEmailInput(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      placeholder="yourname@gmail.com"
                      className="w-full bg-white text-[#0B1530] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/20 text-xs sm:text-sm outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={sendingOtp || cooldown > 0}
                  onClick={() => handleSendOtp('enable')}
                  className="px-5 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#E56D00] text-white text-xs font-bold inline-flex items-center gap-2 transition-all shadow-sm disabled:opacity-60 cursor-pointer min-h-[44px]"
                >
                  {sendingOtp ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Sending 6-Digit Code...</span>
                    </>
                  ) : cooldown > 0 ? (
                    <span>Please wait {cooldown}s...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Send 6-Digit Code &amp; Enable Email 2-Step</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* STATE 2: ACTIVE & IDLE */}
            {enabled && mode === 'idle' && (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Protected Login Email</span>
                    </div>
                    <div className="text-sm font-mono font-bold text-[#0B1530]">{activeEmail}</div>
                    {updatedAt && (
                      <div className="text-[11px] text-emerald-800/80">
                        Updated on{' '}
                        {new Date(updatedAt).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('change_email');
                        setOtpSentTo('');
                        setOtpCode('');
                        setErrorMsg('');
                        setInfoMsg('');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-[#0B1530] text-xs font-bold cursor-pointer min-h-[40px]"
                    >
                      Change 2-Step Email
                    </button>
                    <button
                      type="button"
                      disabled={sendingOtp}
                      onClick={() => handleSendOtp('disable')}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-red-50 border border-red-200 text-red-700 text-xs font-bold cursor-pointer min-h-[40px] disabled:opacity-60"
                    >
                      {sendingOtp ? 'Sending Code...' : 'Turn OFF Email 2-Step'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STATE 3: CHANGE EMAIL */}
            {mode === 'change_email' && !otpSentTo && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#0B1530]">Update Two-Step Verification Email</span>
                  <button
                    type="button"
                    onClick={resetActionFlow}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={targetEmailInput}
                    onChange={(e) => {
                      setTargetEmailInput(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="new-email@gmail.com"
                    className="w-full bg-white text-[#0B1530] pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/20 text-xs sm:text-sm outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={sendingOtp || cooldown > 0}
                  onClick={() => handleSendOtp('change_email')}
                  className="px-4 py-2.5 rounded-xl bg-[#0B1530] hover:bg-[#132550] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer min-h-[42px] disabled:opacity-60"
                >
                  {sendingOtp ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5 text-[#FF7900]" />
                      <span>Send 6-Digit Code to New Email</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* STATE 4: VERIFY 6-DIGIT EMAIL OTP */}
            {mode !== 'idle' && otpSentTo && (
              <form
                onSubmit={handleVerifyAndSave}
                className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-[#FF7900]/35 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-[#0B1530] flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-[#FF7900]" />
                    <span>
                      {mode === 'disable'
                        ? 'Confirm Turning OFF Email Two-Step Verification'
                        : mode === 'change_email'
                        ? 'Verify Your New 2-Step Email'
                        : 'Verify Code to Activate Email Two-Step Verification'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={resetActionFlow}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Enter 6-Digit Code Sent to {otpSentTo}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="• • • • • •"
                    autoFocus
                    required
                    className="w-full max-w-xs bg-white text-[#0B1530] text-center font-mono text-xl font-bold tracking-[0.45em] py-3 px-4 rounded-xl border-2 border-slate-300 focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/20 outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={verifying || otpCode.length !== 6}
                    className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer min-h-[44px] disabled:opacity-50 ${
                      mode === 'disable'
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-[#FF7900] hover:bg-[#E56D00]'
                    }`}
                  >
                    {verifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {mode === 'disable'
                            ? 'Confirm & Turn OFF'
                            : mode === 'change_email'
                            ? 'Verify & Save New Email'
                            : 'Verify & Activate Email 2-Step'}
                        </span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={cooldown > 0 || sendingOtp}
                    onClick={() => handleSendOtp(mode)}
                    className="text-xs font-semibold text-[#FF7900] hover:text-[#D96600] disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend 6-Digit Code'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
