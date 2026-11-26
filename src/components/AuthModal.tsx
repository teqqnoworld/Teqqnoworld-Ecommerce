import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  Building2, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  KeyRound,
  Smartphone
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';
import {
  sendEmailVerificationOtp,
  sendForgotPasswordOtp,
  sendRegistrationEmails,
  verifyEmailVerificationOtp,
  verifyOtpAndResetPassword,
} from '../services/emailService';
import { evaluatePasswordStrength } from '../utils/passwordStrength';
import {
  customerLoginResendOtp,
  customerLoginStep1,
  customerLoginVerifyOtp,
} from '../services/customerTwoStepService';
import { triggerCelebration } from '../services/celebrationService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  destinationActionNote?: string;
  defaultTab?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  destinationActionNote,
  defaultTab = 'login',
}) => {
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Login Step 2: Customer Two-Step Verification (Google Authenticator TOTP or Email OTP) state
  const [loginStep, setLoginStep] = useState<'credentials' | 'two_step'>('credentials');
  const [loginTwoStepMethod, setLoginTwoStepMethod] = useState<'totp' | 'email'>('email');
  const [loginCanSwitchToEmail, setLoginCanSwitchToEmail] = useState(false);
  const [loginChallengeToken, setLoginChallengeToken] = useState('');
  const [loginTwoStepOtp, setLoginTwoStepOtp] = useState('');
  const [loginTwoStepMaskedEmail, setLoginTwoStepMaskedEmail] = useState('');
  const [loginTwoStepInfo, setLoginTwoStepInfo] = useState('');
  const [loginTwoStepCooldown, setLoginTwoStepCooldown] = useState(0);
  const [loginTwoStepResending, setLoginTwoStepResending] = useState(false);

  // Continue with Google OAuth state
  const [googleLoading, setGoogleLoading] = useState(false);

  // Register form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccessMessage, setRegSuccessMessage] = useState('');

  // 2-Step Gmail 6-Digit OTP Verification State (Register)
  const [regStep, setRegStep] = useState<'form' | 'otp'>('form');
  const [otpCode, setOtpCode] = useState('');
  const [otpInfoMessage, setOtpInfoMessage] = useState('');
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpResending, setOtpResending] = useState(false);

  // Forgot password 3-step 6-digit Gmail OTP flow
  const [forgotPasswordModal, setForgotPasswordModal] = useState(false);
  const [resetStep, setResetStep] = useState<'email' | 'verify' | 'done'>('email');
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newResetPassword, setNewResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showNewResetPassword, setShowNewResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetInfoMessage, setResetInfoMessage] = useState('');
  const [resetCooldown, setResetCooldown] = useState(0);
  const [resetResending, setResetResending] = useState(false);

  // Sync tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setTab(defaultTab);
      setLoginError('');
      setLoginStep('credentials');
      setLoginTwoStepMethod('email');
      setLoginCanSwitchToEmail(false);
      setLoginChallengeToken('');
      setLoginTwoStepOtp('');
      setLoginTwoStepMaskedEmail('');
      setLoginTwoStepInfo('');
      setLoginTwoStepCooldown(0);
      setGoogleLoading(false);
      setRegError('');
      setRegSuccessMessage('');
      setRegStep('form');
      setOtpCode('');
      setOtpInfoMessage('');
      setOtpCooldown(0);
      setForgotPasswordModal(false);
      setResetStep('email');
      setResetOtp('');
      setNewResetPassword('');
      setConfirmResetPassword('');
      setResetError('');
      setResetInfoMessage('');
      setResetCooldown(0);
    }
  }, [isOpen, defaultTab]);

  // Cooldown timer for Resend OTP button (Login 2-Step Verification)
  useEffect(() => {
    if (loginTwoStepCooldown <= 0) return;
    const t = setTimeout(() => setLoginTwoStepCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [loginTwoStepCooldown]);

  // Cooldown timer for Resend OTP button (Register)
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const t = setTimeout(() => setOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [otpCooldown]);

  // Cooldown timer for Resend OTP button (Forgot Password)
  useEffect(() => {
    if (resetCooldown <= 0) return;
    const t = setTimeout(() => setResetCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [resetCooldown]);

  // Listen for iframe-safe Google OAuth popup completion postMessage
  useEffect(() => {
    if (!isOpen) return;
    const handleGooglePopupMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const msg = event.data;
      if (!msg || msg.type !== 'TEQQNO_GOOGLE_AUTH') return;

      if (msg.error) {
        setGoogleLoading(false);
        const readableErr = String(msg.error).replace(/\+/g, ' ');
        if (tab === 'register') setRegError(readableErr);
        else setLoginError(readableErr);
        return;
      }

      try {
        setGoogleLoading(true);
        let authUser: any = null;
        let tokens: { access_token: string; refresh_token: string } | undefined;

        if (msg.code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(String(msg.code));
          if (error) throw error;
          authUser = data.user || data.session?.user;
          if (data.session?.access_token && data.session?.refresh_token) {
            tokens = {
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            };
          }
        } else if (msg.access_token && msg.refresh_token) {
          const { data, error } = await supabase.auth.setSession({
            access_token: String(msg.access_token),
            refresh_token: String(msg.refresh_token),
          });
          if (error) throw error;
          authUser = data.user || data.session?.user;
        }

        if (!authUser) {
          throw new Error('Google sign-in completed, but session could not be verified. Please try again.');
        }

        // Send welcome confirmation email once if this is a brand-new Google signup
        const createdMs = authUser.created_at ? new Date(authUser.created_at).getTime() : 0;
        const isBrandNewUser = createdMs > 0 && Date.now() - createdMs < 90 * 1000;
        if (isBrandNewUser && authUser.email) {
          const meta = authUser.user_metadata || {};
          const gFullName =
            meta.full_name || meta.name || String(authUser.email).split('@')[0] || 'Customer';
          const parts = gFullName.trim().split(/\s+/);
          sendRegistrationEmails({
            userId: authUser.id,
            firstName: parts[0] || gFullName,
            lastName: parts.slice(1).join(' ') || '',
            fullName: gFullName,
            email: authUser.email,
            phone: meta.phone || '',
            accountType: 'individual',
            registeredAt: new Date().toISOString(),
          }).catch(() => {});
        }

        await completeAuthenticatedLogin(authUser, tokens, authUser.email || '');
      } catch (err: any) {
        const errMsg = err?.message || 'Google Sign-In failed. Please try again.';
        if (tab === 'register') setRegError(errMsg);
        else setLoginError(errMsg);
      } finally {
        setGoogleLoading(false);
      }
    };

    window.addEventListener('message', handleGooglePopupMessage);
    return () => window.removeEventListener('message', handleGooglePopupMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, tab]);

  if (!isOpen) return null;

  // Validation helpers
  const isValidEmail = (emailStr: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr);
  const cleanMobile = (m: string) => m.replace(/[^\d]/g, '');

  const regPasswordStrength = evaluatePasswordStrength(regPassword, regEmail);
  const resetPasswordStrength = evaluatePasswordStrength(newResetPassword, resetEmail);

  const renderStrengthMeter = (
    strength: ReturnType<typeof evaluatePasswordStrength>,
    passwordVal: string
  ) => {
    if (!passwordVal) return null;
    const barColors: Record<number, string> = {
      1: 'bg-red-500',
      2: 'bg-amber-500',
      3: 'bg-sky-500',
      4: 'bg-emerald-500',
    };
    const textColors: Record<number, string> = {
      1: 'text-red-400',
      2: 'text-amber-400',
      3: 'text-sky-400',
      4: 'text-emerald-400',
    };
    return (
      <div className="mt-2 p-2.5 rounded-xl bg-zinc-950/75 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-medium">Password Strength</span>
          <span className={`font-bold ${textColors[strength.score] || 'text-zinc-400'}`}>
            {strength.label}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={`h-1.5 rounded-full transition-all ${
                step <= strength.score ? barColors[strength.score] : 'bg-zinc-800'
              }`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {strength.checks.map((c) => (
            <span
              key={c.id}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                c.passed
                  ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              <span>{c.passed ? '✓' : '•'}</span>
              <span>{c.label}</span>
            </span>
          ))}
        </div>
      </div>
    );
  };

  // Shared helper to finalize authenticated customer login after Step 1 (or Step 2 2FA)
  const completeAuthenticatedLogin = async (
    authUser: any,
    sessionTokens: { access_token: string; refresh_token: string } | undefined,
    fallbackEmail: string
  ) => {
    if (sessionTokens?.access_token && sessionTokens?.refresh_token) {
      await supabase.auth.setSession({
        access_token: sessionTokens.access_token,
        refresh_token: sessionTokens.refresh_token,
      });
    }

    const meta = authUser?.user_metadata || {};
    const userId = authUser?.id || `user-${Date.now()}`;
    const fullName =
      meta.full_name ||
      meta.name ||
      `${meta.first_name || ''} ${meta.last_name || ''}`.trim() ||
      fallbackEmail.split('@')[0];

    let cachedUserProfile: Partial<UserProfile> | null = null;
    try {
      const rawCached = localStorage.getItem(`teqqno_user_profile_${userId}`);
      if (rawCached) cachedUserProfile = JSON.parse(rawCached);
    } catch {
      cachedUserProfile = null;
    }

    const resolvedCompany =
      cachedUserProfile?.companyName ??
      (meta.company && meta.company !== 'Direct B2B Client' ? meta.company : '');
    const profile: UserProfile = {
      id: userId,
      name: cachedUserProfile?.name || fullName || 'Valued Customer',
      email: authUser?.email || fallbackEmail,
      mobile: cachedUserProfile?.mobile || meta.phone || '',
      companyName: resolvedCompany || undefined,
      gstin: cachedUserProfile?.gstin,
      avatarUrl: cachedUserProfile?.avatarUrl || meta.avatar_url || meta.picture || undefined,
      accountType: cachedUserProfile?.accountType || (resolvedCompany ? 'business' : 'individual'),
      role: resolvedCompany ? 'Corporate Admin' : 'Individual Shopper',
      isVerified: true,
      createdAt:
        cachedUserProfile?.createdAt ||
        authUser?.created_at?.split('T')[0] ||
        new Date().toISOString().split('T')[0],
      savedAddresses: Array.isArray(cachedUserProfile?.savedAddresses)
        ? cachedUserProfile.savedAddresses
        : [],
    };

    localStorage.setItem('teqqno_user', JSON.stringify(profile));
    localStorage.setItem(`teqqno_user_profile_${profile.id}`, JSON.stringify(profile));
    triggerCelebration({
      level: 'subtle',
      sound: 'pop',
      eventKey: `auth-session:${profile.id}`,
      dedupeWindowMs: 12000,
      action: 'customer_login',
    });
    onLoginSuccess(profile);
    onClose();
  };

  // -------------------------------------------------------------
  // CONTINUE WITH GOOGLE (DIRECT SAME-TAB REDIRECT ON LIVE SITE; POPUP ONLY IN IFRAME)
  // -------------------------------------------------------------
  const handleContinueWithGoogle = async () => {
    setLoginError('');
    setRegError('');
    setGoogleLoading(true);
    try {
      let isInIframe = false;
      try {
        isInIframe = window.self !== window.top;
      } catch {
        isInIframe = true;
      }

      const redirectTo = isInIframe
        ? `${window.location.origin}/auth/google-callback`
        : `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (error || !data?.url) {
        const rawMsg = error?.message || 'Google login is not enabled yet in Supabase.';
        const friendly = rawMsg.toLowerCase().includes('provider is not enabled')
          ? 'Google Sign-In needs to be enabled in Supabase Dashboard → Authentication → Providers → Google (add your free Google Client ID & Secret).'
          : rawMsg;
        if (tab === 'register') setRegError(friendly);
        else setLoginError(friendly);
        setGoogleLoading(false);
        return;
      }

      // On normal standalone browser tabs (teqqnoworld.com, teqqnoworld-ecommerce.ai.studio, mobile),
      // redirect the SAME main tab directly — no extra popup window!
      if (!isInIframe) {
        window.location.assign(data.url);
        return;
      }

      // Inside embedded preview iframe: Google blocks iframes, so open in a centered popup
      const width = 520;
      const height = 640;
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
      const popup = window.open(
        data.url,
        'teqqno_google_oauth',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        const blockedMsg = 'Popup was blocked by your browser. Please allow popups for this site and click Continue with Google again.';
        if (tab === 'register') setRegError(blockedMsg);
        else setLoginError(blockedMsg);
        setGoogleLoading(false);
        return;
      }

      // Reset spinner if user closes the Google window manually
      const pollClosed = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(pollClosed);
          setGoogleLoading(false);
        }
      }, 600);
    } catch (err: any) {
      const msg = err?.message || 'Could not start Google Sign-In. Please try again.';
      if (tab === 'register') setRegError(msg);
      else setLoginError(msg);
      setGoogleLoading(false);
    }
  };

  // -------------------------------------------------------------
  // LOGIN STEP 1: CREDENTIALS CHECK (SERVER-GATED FOR 2FA)
  // -------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setLoginError('Please enter a valid business email address.');
      return;
    }
    if (!loginPassword) {
      setLoginError('Please enter your password.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await customerLoginStep1({
        email: cleanEmail,
        password: loginPassword,
      });

      if (!res.success) {
        setLoginError(res.message || 'Invalid email or password. Please verify and try again.');
        return;
      }

      if (res.requiresTwoStep && res.challengeToken) {
        const method = res.method === 'totp' ? 'totp' : 'email';
        setLoginChallengeToken(res.challengeToken);
        setLoginTwoStepMethod(method);
        setLoginCanSwitchToEmail(Boolean(res.canSwitchToEmail));
        setLoginTwoStepMaskedEmail(res.maskedEmail || cleanEmail);
        setLoginTwoStepOtp('');
        setLoginTwoStepCooldown(method === 'email' ? 30 : 0);
        setLoginTwoStepInfo(
          method === 'totp'
            ? 'Password verified! Open Google Authenticator on your phone and enter the 6-digit code for TeqqnoWorld.'
            : res.simulated && res.devOtp
            ? `Simulation Mode: Use 2-Step login code ${res.devOtp}.`
            : `Password verified! Enter the 6-digit code sent to ${res.maskedEmail || cleanEmail}.`
        );
        setLoginStep('two_step');
        return;
      }

      await completeAuthenticatedLogin(res.user, res.session, cleanEmail);
    } catch (err: any) {
      console.error('Login error:', err);
      setLoginError(err?.message || 'Failed to authenticate. Please check connection and try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  // -------------------------------------------------------------
  // LOGIN STEP 2: VERIFY 6-DIGIT EMAIL 2FA CODE
  // -------------------------------------------------------------
  const handleVerifyLoginTwoStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const cleanOtp = loginTwoStepOtp.replace(/[^0-9]/g, '').trim();
    if (cleanOtp.length !== 6) {
      setLoginError('Please enter the complete 6-digit code sent to your email.');
      return;
    }

    setLoginLoading(true);
    try {
      const res = await customerLoginVerifyOtp({
        challengeToken: loginChallengeToken,
        otp: cleanOtp,
      });

      if (!res.success || !res.session) {
        setLoginError(res.message || 'Incorrect or expired 6-digit verification code.');
        if (res.expired) {
          setLoginStep('credentials');
          setLoginChallengeToken('');
          setLoginTwoStepOtp('');
        }
        return;
      }

      await completeAuthenticatedLogin(res.user, res.session, loginEmail.trim().toLowerCase());
    } catch (err: any) {
      console.error('Login 2FA verify error:', err);
      setLoginError(err?.message || 'Failed to verify login code. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResendLoginTwoStep = async () => {
    if (loginTwoStepCooldown > 0 || loginTwoStepResending || !loginChallengeToken) return;
    setLoginError('');
    setLoginTwoStepResending(true);
    try {
      const res = await customerLoginResendOtp(loginChallengeToken);
      if (!res.success) {
        if (res.retryAfterSec) setLoginTwoStepCooldown(res.retryAfterSec);
        setLoginError(res.message || 'Failed to resend login code.');
        if (res.expired) {
          setLoginStep('credentials');
          setLoginChallengeToken('');
        }
        return;
      }
      setLoginTwoStepMethod('email');
      setLoginTwoStepCooldown(30);
      setLoginTwoStepInfo(
        res.simulated && res.devOtp
          ? `Simulation Mode: 2-Step Email code is ${res.devOtp}.`
          : `6-digit verification code sent to ${res.maskedEmail || loginTwoStepMaskedEmail}.`
      );
    } finally {
      setLoginTwoStepResending(false);
    }
  };

  // -------------------------------------------------------------
  // REGISTER STEP 1: VALIDATE & SEND 6-DIGIT GMAIL OTP
  // -------------------------------------------------------------
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccessMessage('');

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = regEmail.trim().toLowerCase();
    const cleanPhone = cleanMobile(mobileNumber);

    if (!trimmedFirst) {
      setRegError('Please enter your First Name.');
      return;
    }
    if (!trimmedLast) {
      setRegError('Please enter your Last Name.');
      return;
    }
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setRegError('Please enter a valid work or corporate email address.');
      return;
    }
    if (cleanPhone.length < 10) {
      setRegError('Please enter a valid 10-digit Indian mobile number (+91).');
      return;
    }
    const pwCheck = evaluatePasswordStrength(regPassword, trimmedEmail);
    if (!pwCheck.isValid) {
      setRegError(pwCheck.errorMessage || 'Please create a strong password (8+ chars, A-Z, a-z, 0-9 & symbol like @#$!).');
      return;
    }

    setRegLoading(true);
    try {
      const fullName = `${trimmedFirst} ${trimmedLast}`.trim();
      const otpRes = await sendEmailVerificationOtp({
        email: trimmedEmail,
        fullName,
        purpose: 'register',
      });

      if (!otpRes.success) {
        if (otpRes.retryAfterSec) setOtpCooldown(otpRes.retryAfterSec);
        setRegError(otpRes.message || 'Could not send verification code to your email. Please try again.');
        return;
      }

      setOtpCode('');
      setOtpCooldown(30);
      setOtpInfoMessage(
        otpRes.simulated && otpRes.devOtp
          ? `Simulation Mode: Use verification code ${otpRes.devOtp} (configure Hostinger SMTP for live email delivery).`
          : `6-digit verification code sent to ${trimmedEmail}. Please check your Gmail inbox (and Spam/Promotions folder).`
      );
      setRegStep('otp');
    } catch (err: any) {
      console.error('Send OTP error:', err);
      setRegError(err?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  // Resend 6-digit OTP
  const handleResendOtp = async () => {
    if (otpCooldown > 0 || otpResending) return;
    setRegError('');
    setOtpResending(true);
    try {
      const trimmedEmail = regEmail.trim().toLowerCase();
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const otpRes = await sendEmailVerificationOtp({
        email: trimmedEmail,
        fullName,
        purpose: 'register',
      });
      if (!otpRes.success) {
        if (otpRes.retryAfterSec) setOtpCooldown(otpRes.retryAfterSec);
        setRegError(otpRes.message || 'Failed to resend code.');
        return;
      }
      setOtpCooldown(30);
      setOtpInfoMessage(
        otpRes.simulated && otpRes.devOtp
          ? `Simulation Mode: New verification code is ${otpRes.devOtp}.`
          : `New 6-digit verification code sent to ${trimmedEmail}.`
      );
    } finally {
      setOtpResending(false);
    }
  };

  // -------------------------------------------------------------
  // REGISTER STEP 2: VERIFY 6-DIGIT OTP -> CREATE ACCOUNT & LOGIN
  // -------------------------------------------------------------
  const handleVerifyOtpAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');
    setRegSuccessMessage('');

    const cleanOtp = otpCode.replace(/[^0-9]/g, '').trim();
    if (cleanOtp.length !== 6) {
      setRegError('Please enter the complete 6-digit code sent to your email.');
      return;
    }

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = regEmail.trim().toLowerCase();
    const cleanPhone = cleanMobile(mobileNumber);
    const fullPhone = cleanPhone.startsWith('91') ? `+${cleanPhone}` : `+91 ${cleanPhone.slice(-10)}`;
    const fullName = `${trimmedFirst} ${trimmedLast}`.trim();

    setRegLoading(true);
    try {
      // 1. Verify 6-digit Gmail OTP strictly on backend first
      const verifyRes = await verifyEmailVerificationOtp({
        email: trimmedEmail,
        otp: cleanOtp,
        purpose: 'register',
      });

      if (!verifyRes.success || !verifyRes.verified) {
        setRegError(verifyRes.message || 'Invalid or expired verification code.');
        return;
      }

      // 2. OTP verified -> Create Supabase Auth account with proper live redirect URL
      const redirectOrigin =
        typeof window !== 'undefined' && window.location.origin
          ? `${window.location.origin}/#dashboard`
          : 'https://teqqnoworld.com/#dashboard';

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: regPassword,
        options: {
          emailRedirectTo: redirectOrigin,
          data: {
            first_name: trimmedFirst,
            last_name: trimmedLast,
            phone: fullPhone,
            full_name: fullName,
            company: companyName.trim() || '',
            email_otp_verified: true,
          },
        },
      });

      if (error) {
        if (error.message.includes('User already registered')) {
          setRegError('An account with this email already exists. Please switch to Sign In.');
        } else {
          setRegError(error.message);
        }
        return;
      }

      const authUser = data.user;
      const trimmedCompany = companyName.trim();
      const accountType: 'individual' | 'business' = trimmedCompany ? 'business' : 'individual';
      const registeredIso = new Date().toISOString();

      const profile: UserProfile = {
        id: authUser?.id || `user-${Date.now()}`,
        name: fullName,
        email: trimmedEmail,
        mobile: fullPhone,
        companyName: trimmedCompany || undefined,
        accountType,
        role: trimmedCompany ? 'Corporate Admin' : 'Individual Shopper',
        isVerified: true,
        createdAt: registeredIso.split('T')[0],
        savedAddresses: [],
      };

      // Persist clean per-user profile in localStorage
      localStorage.setItem('teqqno_user', JSON.stringify(profile));
      localStorage.setItem(`teqqno_user_profile_${profile.id}`, JSON.stringify(profile));

      // Dispatch Congratulations email to customer + full details alert to Admin (awaited for guaranteed delivery)
      setRegSuccessMessage('Email verified! Sending welcome confirmation email...');
      try {
        const regEmailRes = await sendRegistrationEmails({
          userId: profile.id,
          firstName: trimmedFirst,
          lastName: trimmedLast,
          fullName,
          email: trimmedEmail,
          phone: fullPhone,
          company: trimmedCompany || undefined,
          accountType,
          registeredAt: registeredIso,
        });
        console.log('[Registration Emails Dispatched]:', regEmailRes);
      } catch (emailErr) {
        console.warn('[Registration Emails Warning]:', emailErr);
      }

      setRegSuccessMessage('Congratulations! Account created & confirmation email sent. Opening your dashboard...');
      triggerCelebration({
        level: 'premium',
        sound: 'celebration',
        eventKey: `auth-session:${profile.id}`,
        dedupeWindowMs: 12000,
        action: 'customer_registration',
      });

      setTimeout(() => {
        onLoginSuccess(profile);
        onClose();
      }, 650);
    } catch (err: any) {
      console.error('Registration verification error:', err);
      setRegError(err?.message || 'Failed to complete registration. Please try again.');
    } finally {
      setRegLoading(false);
    }
  };

  // -------------------------------------------------------------
  // FORGOT PASSWORD (3-STEP 6-DIGIT GMAIL OTP VERIFICATION)
  // -------------------------------------------------------------
  const openForgotPasswordFlow = () => {
    setResetEmail(loginEmail.trim());
    setResetStep('email');
    setResetOtp('');
    setNewResetPassword('');
    setConfirmResetPassword('');
    setResetError('');
    setResetInfoMessage('');
    setResetCooldown(0);
    setForgotPasswordModal(true);
  };

  const handleSendPasswordResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      setResetError('Please enter a valid registered email address.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await sendForgotPasswordOtp(cleanEmail);
      if (!res.success) {
        if (res.retryAfterSec) setResetCooldown(res.retryAfterSec);
        setResetError(res.message || 'Could not send password reset code. Please try again.');
        return;
      }

      setResetOtp('');
      setNewResetPassword('');
      setConfirmResetPassword('');
      setResetCooldown(30);
      setResetInfoMessage(
        res.simulated && res.devOtp
          ? `Simulation Mode: Use reset code ${res.devOtp}.`
          : `6-digit verification code sent to ${cleanEmail}. Check your Gmail inbox to set a new password.`
      );
      setResetStep('verify');
    } catch (err: any) {
      console.error('Forgot password OTP error:', err);
      setResetError(err?.message || 'Failed to send verification code. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResendResetOtp = async () => {
    if (resetCooldown > 0 || resetResending) return;
    setResetError('');
    setResetResending(true);
    try {
      const cleanEmail = resetEmail.trim().toLowerCase();
      const res = await sendForgotPasswordOtp(cleanEmail);
      if (!res.success) {
        if (res.retryAfterSec) setResetCooldown(res.retryAfterSec);
        setResetError(res.message || 'Failed to resend verification code.');
        return;
      }
      setResetCooldown(30);
      setResetInfoMessage(
        res.simulated && res.devOtp
          ? `Simulation Mode: New reset code is ${res.devOtp}.`
          : `New 6-digit verification code sent to ${cleanEmail}.`
      );
    } finally {
      setResetResending(false);
    }
  };

  const handleVerifyOtpAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');

    const cleanEmail = resetEmail.trim().toLowerCase();
    const cleanOtp = resetOtp.replace(/[^0-9]/g, '').trim();

    if (cleanOtp.length !== 6) {
      setResetError('Please enter the complete 6-digit verification code sent to your Gmail.');
      return;
    }
    const resetPwCheck = evaluatePasswordStrength(newResetPassword, cleanEmail);
    if (!resetPwCheck.isValid) {
      setResetError(
        resetPwCheck.errorMessage ||
          'Please create a strong password (8+ chars, A-Z, a-z, 0-9 & symbol like @#$!).'
      );
      return;
    }
    if (newResetPassword !== confirmResetPassword) {
      setResetError('New password and Confirm password do not match.');
      return;
    }

    setResetLoading(true);
    try {
      const res = await verifyOtpAndResetPassword({
        email: cleanEmail,
        otp: cleanOtp,
        newPassword: newResetPassword,
      });

      if (!res.success || !res.passwordUpdated) {
        setResetError(res.message || 'Invalid or expired verification code.');
        return;
      }

      setLoginEmail(cleanEmail);
      setLoginPassword('');
      setResetStep('done');
      triggerCelebration({
        level: 'subtle',
        sound: 'chime',
        eventKey: `password-reset:${cleanEmail}`,
        action: 'password_changed',
      });
    } catch (err: any) {
      console.error('Password reset error:', err);
      setResetError(err?.message || 'Failed to update password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-[#071B35]/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#091830] border border-white/15 rounded-2xl sm:rounded-3xl shadow-[0_30px_80px_-15px_rgba(4,12,28,0.85)] overflow-hidden my-3 sm:my-8 animate-admin-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-[#071B35] via-[#0D274A] to-[#081A33] p-5 sm:p-6 border-b border-white/10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-12 w-64 h-64 rounded-full opacity-35 blur-3xl"
            style={{
              background:
                'radial-gradient(circle, rgba(255,121,0,0.55) 0%, transparent 70%)',
            }}
          />
          <button
            type="button"
            onClick={onClose}
            className="relative z-20 float-right p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer group"
            aria-label="Close"
          >
            <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
          </button>

          <div className="relative z-10 flex items-center gap-2 mb-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#FF7900]/15 text-[#FF9E44] border border-[#FF7900]/40">
              <Sparkles className="w-3 h-3 text-[#FF7900]" />
              B2B CORPORATE PORTAL
            </span>
          </div>

          <h2 className="relative z-10 font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
            {tab === 'login' ? 'Welcome Back' : 'Create Business Account'}
          </h2>
          <p className="relative z-10 text-xs sm:text-sm text-slate-300 mt-1">
            {destinationActionNote || 'Access custom pricing, GST tax invoices & instant mockups.'}
          </p>

          {/* DUAL TAB SWITCHER */}
          <div className="relative z-10 grid grid-cols-2 p-1 mt-5 bg-[#051224]/80 border border-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => { setTab('login'); setLoginError(''); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                tab === 'login'
                  ? 'bg-[#FF7900] text-white shadow-md shadow-[#FF7900]/25'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setRegError(''); }}
              className={`py-2 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                tab === 'register'
                  ? 'bg-[#FF7900] text-white shadow-md shadow-[#FF7900]/25'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Register (New Account)
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {/* ======================================================== */}
          {/* TAB 1: LOGIN FORM (STEP 1 CREDENTIALS + STEP 2 EMAIL 2FA) */}
          {/* ======================================================== */}
          {tab === 'login' && loginStep === 'credentials' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {loginError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Corporate Email ID
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                    className="w-full bg-zinc-900/90 text-white pl-10 pr-4 py-2.5 rounded-xl border border-zinc-700/80 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 text-sm outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={openForgotPasswordFlow}
                    className="text-xs font-semibold text-[#FF7A00] hover:text-[#FF9E44] hover:underline cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter account password"
                    required
                    className="w-full bg-zinc-900/90 text-white pl-10 pr-11 py-2.5 rounded-xl border border-zinc-700/80 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 text-sm outline-none transition-all placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loginLoading || googleLoading}
                className="w-full bg-[#FF7A00] hover:bg-[#E56E00] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF7A00]/25 disabled:opacity-60 cursor-pointer mt-2"
              >
                {loginLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in securely...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* OR Divider + Continue with Google */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-[#091830] px-3 text-slate-400 font-semibold">or continue with</span>
                </div>
              </div>

              <button
                type="button"
                disabled={googleLoading || loginLoading}
                onClick={handleContinueWithGoogle}
                className="w-full bg-white hover:bg-slate-100 text-[#0B1530] font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-sm border border-white/20 disabled:opacity-60 cursor-pointer text-sm"
              >
                {googleLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#0B1530]/30 border-t-[#0B1530] rounded-full animate-spin" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                      <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z" />
                      <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z" />
                      <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 1 - STEP 2: 2-STEP VERIFICATION (GOOGLE AUTHENTICATOR OR EMAIL OTP) */}
          {tab === 'login' && loginStep === 'two_step' && (
            <form onSubmit={handleVerifyLoginTwoStep} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#0D213F] border border-[#FF7900]/35 text-xs text-slate-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[#FF9E44]">
                    {loginTwoStepMethod === 'totp' ? (
                      <>
                        <Smartphone className="w-4 h-4" />
                        <span>Google Authenticator Verification</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Two-Step Email Verification</span>
                      </>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep('credentials');
                      setLoginChallengeToken('');
                      setLoginTwoStepOtp('');
                      setLoginError('');
                    }}
                    className="text-[11px] text-slate-300 hover:text-white underline cursor-pointer"
                  >
                    Back
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {loginTwoStepInfo ||
                    (loginTwoStepMethod === 'totp'
                      ? 'Open Google Authenticator on your phone and enter the 6-digit code for TeqqnoWorld.'
                      : `Enter the 6-digit code sent to ${loginTwoStepMaskedEmail} to complete sign-in.`)}
                </p>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider text-center">
                  {loginTwoStepMethod === 'totp'
                    ? 'Enter 6-Digit Google Authenticator Code *'
                    : 'Enter 6-Digit Email Code *'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={loginTwoStepOtp}
                  onChange={(e) => {
                    setLoginTwoStepOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                    if (loginError) setLoginError('');
                  }}
                  placeholder="• • • • • •"
                  autoFocus
                  required
                  className="w-full bg-zinc-900/95 text-white text-center font-mono text-2xl font-bold tracking-[0.45em] py-3.5 px-4 rounded-2xl border-2 border-zinc-700 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/25 outline-none transition-all placeholder:text-zinc-600 placeholder:tracking-[0.35em]"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading || loginTwoStepOtp.length !== 6}
                className="w-full bg-[#FF7A00] hover:bg-[#E56E00] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF7A00]/25 disabled:opacity-50 cursor-pointer"
              >
                {loginLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying 2-Step Code...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify Code &amp; Sign In</span>
                  </>
                )}
              </button>

              {loginTwoStepMethod === 'email' ? (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-zinc-400">Didn&apos;t receive the code?</span>
                  <button
                    type="button"
                    disabled={loginTwoStepCooldown > 0 || loginTwoStepResending}
                    onClick={handleResendLoginTwoStep}
                    className="font-semibold text-[#FF9E44] hover:text-[#FF7A00] disabled:text-zinc-500 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loginTwoStepResending
                      ? 'Resending...'
                      : loginTwoStepCooldown > 0
                      ? `Resend in ${loginTwoStepCooldown}s`
                      : 'Resend 6-Digit Code'}
                  </button>
                </div>
              ) : loginCanSwitchToEmail ? (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-zinc-400">Don&apos;t have your phone handy?</span>
                  <button
                    type="button"
                    disabled={loginTwoStepResending}
                    onClick={handleResendLoginTwoStep}
                    className="font-semibold text-[#FF9E44] hover:text-[#FF7A00] disabled:text-zinc-500 cursor-pointer"
                  >
                    {loginTwoStepResending ? 'Sending Email Code...' : 'Use Email 6-Digit Code Instead'}
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-zinc-400 text-center pt-1">
                  Open the Google Authenticator app on your phone for your fresh 6-digit code.
                </p>
              )}
            </form>
          )}

          {/* ======================================================== */}
          {/* TAB 2: REGISTER FORM (2-STEP GMAIL OTP + GOOGLE SIGN-UP) */}
          {/* ======================================================== */}
          {tab === 'register' && regStep === 'form' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              {/* Quick One-Click Google Account Creation */}
              <button
                type="button"
                disabled={googleLoading || regLoading}
                onClick={handleContinueWithGoogle}
                className="w-full bg-white hover:bg-slate-100 text-[#0B1530] font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2.5 transition-all shadow-sm border border-white/20 disabled:opacity-60 cursor-pointer text-sm"
              >
                {googleLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#0B1530]/30 border-t-[#0B1530] rounded-full animate-spin" />
                    <span>Connecting to Google...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
                      <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z" />
                      <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z" />
                      <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
                    </svg>
                    <span>Continue with Google (Instant Account)</span>
                  </>
                )}
              </button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-[#091830] px-3 text-slate-400 font-semibold">or register with email</span>
                </div>
              </div>
              {regError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{regSuccessMessage}</span>
                </div>
              )}

              {/* First & Last Name */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                    First Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <User className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Aman"
                      required
                      className="w-full bg-zinc-900/90 text-white pl-9 pr-3 py-2 rounded-xl border border-zinc-700/80 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 text-xs sm:text-sm outline-none transition-all placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Sharma"
                    required
                    className="w-full bg-zinc-900/90 text-white px-3 py-2 rounded-xl border border-zinc-700/80 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 text-xs sm:text-sm outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                  Email ID (6-Digit Verification Code will be sent here) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Mail className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    required
                    className="w-full bg-zinc-900/90 text-white pl-9 pr-3 py-2 rounded-xl border border-zinc-700/80 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 text-xs sm:text-sm outline-none transition-all placeholder:text-zinc-600"
                  />
                </div>
              </div>

              {/* Mobile Number & Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                    Mobile Number *
                  </label>
                  <div className="relative flex">
                    <span className="inline-flex items-center px-2.5 rounded-l-xl border border-r-0 border-zinc-700/80 bg-zinc-800 text-zinc-400 text-xs font-mono">
                      🇮🇳 +91
                    </span>
                    <input
                      type="tel"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      required
                      className="w-full bg-zinc-900/90 text-white px-3 py-2 rounded-r-xl border border-zinc-700/80 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 text-xs sm:text-sm outline-none transition-all font-mono placeholder:text-zinc-600"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                    Company Name (Optional)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Acme Tech Labs"
                      className="w-full bg-zinc-900/90 text-white pl-9 pr-3 py-2 rounded-xl border border-zinc-700/80 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 text-xs sm:text-sm outline-none transition-all placeholder:text-zinc-600"
                    />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                  Create Strong Password (8+ chars, A-Z, a-z, 0-9 &amp; @#$!) *
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    value={regPassword}
                    onChange={(e) => {
                      setRegPassword(e.target.value);
                      if (regError) setRegError('');
                    }}
                    placeholder="e.g. Teqqno@2026"
                    minLength={8}
                    required
                    className="w-full bg-zinc-900/90 text-white pl-9 pr-10 py-2 rounded-xl border border-zinc-700/80 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 text-xs sm:text-sm outline-none transition-all placeholder:text-zinc-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {renderStrengthMeter(regPasswordStrength, regPassword)}
              </div>

              {/* Submit Step 1 -> Send 6-Digit Email Code */}
              <button
                type="submit"
                disabled={regLoading}
                className="w-full bg-[#FF7A00] hover:bg-[#E56E00] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF7A00]/25 disabled:opacity-60 cursor-pointer mt-3"
              >
                {regLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Sending 6-Digit Code to Email...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code &amp; Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2 - STEP 2: ENTER 6-DIGIT GMAIL VERIFICATION CODE */}
          {tab === 'register' && regStep === 'otp' && (
            <form onSubmit={handleVerifyOtpAndRegister} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-[#0D213F] border border-[#FF7900]/35 text-xs text-slate-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-bold text-[#FF9E44]">
                    <Mail className="w-4 h-4" />
                    Verify Your Email Address
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRegStep('form');
                      setRegError('');
                      setOtpCode('');
                    }}
                    className="text-[11px] text-slate-300 hover:text-white underline cursor-pointer"
                  >
                    Change Email
                  </button>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {otpInfoMessage || `Enter the 6-digit code sent to ${regEmail.trim()} to complete signup.`}
                </p>
              </div>

              {regError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{regSuccessMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider text-center">
                  Enter 6-Digit Email Code *
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                    if (regError) setRegError('');
                  }}
                  placeholder="• • • • • •"
                  autoFocus
                  required
                  className="w-full bg-zinc-900/95 text-white text-center font-mono text-2xl font-bold tracking-[0.45em] py-3.5 px-4 rounded-2xl border-2 border-zinc-700 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/25 outline-none transition-all placeholder:text-zinc-600 placeholder:tracking-[0.35em]"
                />
              </div>

              <button
                type="submit"
                disabled={regLoading || otpCode.length !== 6}
                className="w-full bg-[#FF7A00] hover:bg-[#E56E00] text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF7A00]/25 disabled:opacity-50 cursor-pointer"
              >
                {regLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying Code &amp; Creating Account...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Verify Code &amp; Create Account</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-zinc-400">Didn&apos;t receive the code?</span>
                <button
                  type="button"
                  disabled={otpCooldown > 0 || otpResending}
                  onClick={handleResendOtp}
                  className="font-semibold text-[#FF9E44] hover:text-[#FF7A00] disabled:text-zinc-500 disabled:cursor-not-allowed cursor-pointer"
                >
                  {otpResending
                    ? 'Resending...'
                    : otpCooldown > 0
                    ? `Resend in ${otpCooldown}s`
                    : 'Resend 6-Digit Code'}
                </button>
              </div>
            </form>
          )}

          {/* Trust badges */}
          <div className="mt-5 pt-4 border-t border-zinc-800/80 flex items-center justify-center gap-4 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              256-Bit SSL Encrypted
            </span>
            <span>•</span>
            <span>GST Invoice Ready</span>
            <span>•</span>
            <span>Direct WhatsApp Support</span>
          </div>
        </div>

        {/* FORGOT PASSWORD 3-STEP GMAIL OTP MODAL SUB-POPUP */}
        {forgotPasswordModal && (
          <div className="absolute inset-0 bg-[#091830]/98 backdrop-blur-md p-6 flex flex-col justify-center z-20 overflow-y-auto animate-fade-in">
            <div className="max-w-sm mx-auto w-full">
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#FF7A00]/15 border border-[#FF7A00]/30 text-[#FF7A00] flex items-center justify-center mx-auto mb-3">
                  {resetStep === 'done' ? <CheckCircle2 className="w-6 h-6 text-emerald-400" /> : <KeyRound className="w-6 h-6" />}
                </div>
                <h3 className="text-lg font-bold text-white mb-1">
                  {resetStep === 'email' && 'Forgot Password?'}
                  {resetStep === 'verify' && 'Verify Code & Set New Password'}
                  {resetStep === 'done' && 'Password Updated!'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {resetStep === 'email' &&
                    'Enter your registered Gmail / email ID. We will send a 6-digit verification code before you can reset your password.'}
                  {resetStep === 'verify' &&
                    (resetInfoMessage || `Enter the 6-digit code sent to ${resetEmail.trim()} and choose your new password.`)}
                  {resetStep === 'done' &&
                    'Your TeqqnoWorld password has been updated securely. You can now sign in with your new password.'}
                </p>
              </div>

              {resetError && (
                <div className="p-3 mb-4 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5 text-left">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{resetError}</span>
                </div>
              )}

              {/* STEP 1: ENTER EMAIL TO RECEIVE 6-DIGIT CODE */}
              {resetStep === 'email' && (
                <form onSubmit={handleSendPasswordResetOtp} className="space-y-3.5 mb-4">
                  <div className="space-y-1 text-left">
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                      Registered Email ID *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => {
                          setResetEmail(e.target.value);
                          if (resetError) setResetError('');
                        }}
                        placeholder="yourname@gmail.com"
                        required
                        autoFocus
                        className="w-full bg-zinc-900/95 text-white pl-10 pr-3.5 py-2.5 rounded-xl border border-zinc-700 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/20 text-sm outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full bg-[#FF7A00] hover:bg-[#E56E00] text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF7A00]/25 disabled:opacity-60 cursor-pointer"
                  >
                    {resetLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Sending 6-Digit Code...</span>
                      </>
                    ) : (
                      <>
                        <span>Send 6-Digit Verification Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* STEP 2: ENTER 6-DIGIT GMAIL CODE + NEW PASSWORD */}
              {resetStep === 'verify' && (
                <form onSubmit={handleVerifyOtpAndResetPassword} className="space-y-3 mb-4 text-left">
                  <div className="flex items-center justify-between text-[11px] text-slate-300 bg-[#0D213F] border border-[#FF7900]/30 rounded-xl px-3 py-2">
                    <span className="truncate font-mono text-white">{resetEmail.trim()}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setResetStep('email');
                        setResetError('');
                        setResetOtp('');
                      }}
                      className="text-[#FF9E44] hover:text-white underline shrink-0 ml-2 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider text-center">
                      6-Digit Gmail Verification Code *
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={resetOtp}
                      onChange={(e) => {
                        setResetOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                        if (resetError) setResetError('');
                      }}
                      placeholder="• • • • • •"
                      autoFocus
                      required
                      className="w-full bg-zinc-900/95 text-white text-center font-mono text-xl font-bold tracking-[0.42em] py-2.5 px-3 rounded-xl border-2 border-zinc-700 focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/25 outline-none placeholder:text-zinc-600 placeholder:tracking-[0.3em]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                      New Strong Password (8+ chars, A-Z, a-z, 0-9 &amp; @#$!) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type={showNewResetPassword ? 'text' : 'password'}
                        value={newResetPassword}
                        onChange={(e) => {
                          setNewResetPassword(e.target.value);
                          if (resetError) setResetError('');
                        }}
                        placeholder="e.g. Teqqno@2026"
                        minLength={8}
                        required
                        className="w-full bg-zinc-900/95 text-white pl-9 pr-10 py-2 rounded-xl border border-zinc-700 focus:border-[#FF7A00] text-xs sm:text-sm outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewResetPassword(!showNewResetPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer"
                      >
                        {showNewResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {renderStrengthMeter(resetPasswordStrength, newResetPassword)}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
                      Confirm New Password *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type={showNewResetPassword ? 'text' : 'password'}
                        value={confirmResetPassword}
                        onChange={(e) => {
                          setConfirmResetPassword(e.target.value);
                          if (resetError) setResetError('');
                        }}
                        placeholder="Re-enter strong password"
                        minLength={8}
                        required
                        className="w-full bg-zinc-900/95 text-white pl-9 pr-3 py-2 rounded-xl border border-zinc-700 focus:border-[#FF7A00] text-xs sm:text-sm outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading || resetOtp.length !== 6 || !resetPasswordStrength.isValid}
                    className="w-full bg-[#FF7A00] hover:bg-[#E56E00] text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF7A00]/25 disabled:opacity-50 cursor-pointer mt-1"
                  >
                    {resetLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Verifying &amp; Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify Code &amp; Reset Password</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-zinc-400">Didn&apos;t receive the code?</span>
                    <button
                      type="button"
                      disabled={resetCooldown > 0 || resetResending}
                      onClick={handleResendResetOtp}
                      className="font-semibold text-[#FF9E44] hover:text-[#FF7A00] disabled:text-zinc-500 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {resetResending
                        ? 'Resending...'
                        : resetCooldown > 0
                        ? `Resend in ${resetCooldown}s`
                        : 'Resend 6-Digit Code'}
                    </button>
                  </div>
                </form>
              )}

              {/* STEP 3: SUCCESS CONFIRMATION */}
              {resetStep === 'done' && (
                <div className="space-y-3.5 mb-4">
                  <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs text-left">
                    <div className="flex items-center gap-2 font-semibold mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      Password Reset Successful
                    </div>
                    A security confirmation email has also been sent to <span className="font-mono text-white">{resetEmail.trim()}</span>.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordModal(false);
                      setTab('login');
                      setLoginError('');
                    }}
                    className="w-full bg-[#FF7A00] hover:bg-[#E56E00] text-white font-semibold py-2.5 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF7A00]/25 cursor-pointer"
                  >
                    <span>Sign In with New Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {resetStep !== 'done' && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setForgotPasswordModal(false)}
                    className="text-xs text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    Return to Sign In
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
