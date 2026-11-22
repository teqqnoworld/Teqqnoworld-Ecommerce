import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  ArrowLeft, 
  Check, 
  CheckCircle2,
  Clock,
  CreditCard, 
  Building2, 
  FileCheck, 
  AlertTriangle,
  AlertCircle,
  Lock,
  Truck,
  Sparkles,
  Loader2,
  Wallet,
  Percent,
  MapPin,
  Tag,
  X
} from 'lucide-react';
import { NewCustomerPromoBanner } from './NewCustomerPromoBanner';
import { VoiceInstructionsCard } from './VoiceInstructionsCard';
import { CheckoutRecoveryOfferModal } from './CheckoutRecoveryOfferModal';
import { CartItem, ShippingAddress, Order, UserProfile } from '../types';
import { supabase } from '../lib/supabase';
import { 
  uploadDataUrlToStorage, 
  saveAbandonedCheckout, 
  markCheckoutRecovered 
} from '../services/supabaseService';
import { sendOrderConfirmationEmail, OrderEmailItem } from '../services/emailService';
import {
  ActiveRecoveryCoupon,
  activateRecoveryCoupon,
  clearRecoveryCoupon,
  formatRemainingCountdown,
  getActiveRecoveryCoupon,
  sendCheckoutDropRecoveryWhatsApp,
  sendOrderWhatsAppConfirmation,
  subscribeRecoveryCoupon,
} from '../services/aisensyService';
import {
  getRazorpayStatus,
  loadRazorpayCheckoutScript,
  createRazorpayOrder,
  verifyRazorpayPayment,
  checkDelhiveryPincode,
  RazorpayStatus,
  DelhiveryPincodeCheckResult,
} from '../services/paymentAndLogisticsService';
import {
  getSavedDelhiveryCheck,
  saveDelhiveryCheck,
  subscribeDelhiveryCheck,
} from '../services/delhiveryPincodeStore';
import { getWhatsAppLink } from '../config/business';
import {
  describeArtworkPlacement,
  extractArtworkAssetsFromItem,
  generateItemMockupSnapshots,
} from '../utils/mockupSnapshot';

interface CheckoutViewProps {
  items: CartItem[];
  onBackToCart: () => void;
  onOrderPlaced: (order: Order) => void;
  user?: UserProfile | null;
  onRequestLogin?: () => void;
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  items,
  onBackToCart,
  onOrderPlaced,
  user,
  onRequestLogin,
}) => {
  // Unique session ID for tracking this checkout attempt
  const [checkoutSessionId] = useState<string>(() => {
    try {
      const existing = sessionStorage.getItem('teqqno_checkout_session_id');
      if (existing) return existing;
      const generated = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      sessionStorage.setItem('teqqno_checkout_session_id', generated);
      return generated;
    } catch {
      return `lead_${Date.now()}`;
    }
  });

  // Form State initialized from user & checked Delhivery pincode if available
  const defaultAddress = user?.savedAddresses?.find(a => a.isDefault) || user?.savedAddresses?.[0];
  const savedDelhiveryPin = getSavedDelhiveryCheck();

  const [fullName, setFullName] = useState(user?.name || 'Arjun Mehta');
  const [companyName, setCompanyName] = useState(user?.companyName || 'Nexus Dynamics India Pvt Ltd');
  const [email, setEmail] = useState(user?.email || 'arjun.mehta@nexusdynamics.in');
  const [phone, setPhone] = useState(user?.mobile ? `+91 ${user.mobile}` : '+91 98450 12345');
  const [street, setStreet] = useState(defaultAddress?.street || 'Level 4, Prestige Tech Cloud, Doddajala');
  const [city, setCity] = useState(
    (savedDelhiveryPin?.serviceable && savedDelhiveryPin.city) || defaultAddress?.city || 'Bengaluru'
  );
  const [state, setState] = useState(
    (savedDelhiveryPin?.serviceable && savedDelhiveryPin.state) || defaultAddress?.state || 'Karnataka'
  );
  const [pincode, setPincode] = useState(
    (savedDelhiveryPin?.serviceable && savedDelhiveryPin.pincode) || defaultAddress?.pincode || '562157'
  );
  const [isB2BInvoice, setIsB2BInvoice] = useState(true);
  const [gstin, setGstin] = useState(user?.gstin || '29AABCN8291P1ZX');
  const [poNumber, setPoNumber] = useState('');
  
  // Separate billing address
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [billingStreet, setBillingStreet] = useState('Unit 12, Corporate Tower, MG Road');
  const [billingCity, setBillingCity] = useState('Bengaluru');
  const [billingState, setBillingState] = useState('Karnataka');
  const [billingPincode, setBillingPincode] = useState('560001');

  // Payment Mode (100% Full Prepaid or 50% Partial Advance — NO COD)
  const [paymentMode, setPaymentMode] = useState<
    'Full Prepaid (100% Online)' | 'Partial Payment (50% Advance)'
  >('Full Prepaid (100% Online)');

  const [razorpayStatus, setRazorpayStatus] = useState<RazorpayStatus | null>(null);
  const [areaCheckPin, setAreaCheckPin] = useState<string>(savedDelhiveryPin?.pincode || '');
  const [areaCheckError, setAreaCheckError] = useState<string | null>(null);
  const [pincodeStatus, setPincodeStatus] = useState<DelhiveryPincodeCheckResult | null>(
    savedDelhiveryPin || null
  );
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [userEditedPin, setUserEditedPin] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [uploadStepStatus, setUploadStepStatus] = useState<string>('');
  const [orderVoiceNoteUrl, setOrderVoiceNoteUrl] = useState<string | null>(null);
  const [orderVoiceNotes, setOrderVoiceNotes] = useState<string>('');

  // Recovery Offer Modal & 5% OFF Limited-Time Coupon State
  const orderPlacedRef = React.useRef(false);
  const recoverySentRef = React.useRef(false);
  const [recoveryCoupon, setRecoveryCoupon] = useState<ActiveRecoveryCoupon | null>(() =>
    getActiveRecoveryCoupon()
  );
  const [recoveryCountdown, setRecoveryCountdown] = useState<string>(() => {
    const active = getActiveRecoveryCoupon();
    return active ? formatRemainingCountdown(active.expiresAt) : '';
  });
  const [recoveryOfferModal, setRecoveryOfferModal] = useState<{
    isOpen: boolean;
    triggerReason: string;
    expiresAt: number;
    whatsappStatusMessage?: string | null;
    whatsappSimulated?: boolean;
    leavingCheckout?: boolean;
  } | null>(null);

  // Promo Code State (synced with CartDrawer session & limited-time 5% recovery coupon)
  const [promoInput, setPromoInput] = useState<string>(() => {
    try {
      return sessionStorage.getItem('teqqno_applied_coupon') || '';
    } catch {
      return '';
    }
  });
  const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('teqqno_applied_coupon') || null;
    } catch {
      return null;
    }
  });
  const [promoFeedback, setPromoFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(() => {
    try {
      const existing = sessionStorage.getItem('teqqno_applied_coupon');
      if (existing === 'WELCOME10' || existing === 'TEQQNO10') {
        return { type: 'success', text: `🎉 ${existing} applied — 10% New Customer discount active!` };
      }
      if ((existing === 'SAVE5NOW' || existing === 'TEQQNO5') && getActiveRecoveryCoupon()) {
        return { type: 'success', text: `⚡ ${existing} applied — Limited-time 5% OFF Checkout Saver active!` };
      }
      if (existing === 'TEQQNOBULK') {
        return { type: 'success', text: `Bulk voucher TEQQNOBULK active!` };
      }
    } catch {}
    return null;
  });

  // Subscribe to recovery coupon updates & live countdown expiry
  useEffect(() => {
    const unsub = subscribeRecoveryCoupon((next) => {
      setRecoveryCoupon(next);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!recoveryCoupon) {
      setRecoveryCountdown('');
      return;
    }
    const tick = () => {
      const fresh = getActiveRecoveryCoupon();
      if (!fresh) {
        setRecoveryCoupon(null);
        setRecoveryCountdown('');
        if (appliedPromoCode === 'SAVE5NOW' || appliedPromoCode === 'TEQQNO5') {
          setAppliedPromoCode(null);
          setPromoFeedback({ type: 'error', text: 'Limited-time 5% OFF coupon expired.' });
        }
        return;
      }
      setRecoveryCountdown(formatRemainingCountdown(fresh.expiresAt));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [recoveryCoupon, appliedPromoCode]);

  // If user came back from AiSensy WhatsApp link (#checkout?coupon=SAVE5NOW), unlock & apply 5% OFF automatically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    const queryIdx = hash.indexOf('?');
    if (queryIdx !== -1) {
      const params = new URLSearchParams(hash.slice(queryIdx + 1));
      const urlCoupon = params.get('coupon')?.trim().toUpperCase();
      if (urlCoupon === 'SAVE5NOW' || urlCoupon === 'TEQQNO5') {
        const activated = activateRecoveryCoupon({
          triggerReason: 'whatsapp_recovery_link',
          validMinutes: 15,
          autoApply: true,
        });
        setRecoveryCoupon(activated);
        setAppliedPromoCode('SAVE5NOW');
        setPromoInput('SAVE5NOW');
        try {
          sessionStorage.setItem('teqqno_applied_coupon', 'SAVE5NOW');
        } catch {}
        setPromoFeedback({
          type: 'success',
          text: '⚡ WhatsApp 5% OFF Voucher (SAVE5NOW) applied for 15 minutes!',
        });
      }
    }
  }, []);

  // Financial calculations (with promo discount applied pre-GST)
  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const isRecovery5Valid = Boolean(getActiveRecoveryCoupon());
  const discountAmount =
    appliedPromoCode === 'WELCOME10' || appliedPromoCode === 'TEQQNO10'
      ? Math.round(subtotal * 0.1)
      : (appliedPromoCode === 'SAVE5NOW' || appliedPromoCode === 'TEQQNO5') && isRecovery5Valid
        ? Math.round(subtotal * 0.05)
        : appliedPromoCode === 'TEQQNOBULK'
          ? Math.min(subtotal, 500)
          : 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);
  const shippingFee = subtotal >= 1999 || subtotal === 0 ? 0 : 149;
  const gstRate = 0.18;
  const gstAmount = Math.round(discountedSubtotal * gstRate);
  const total = discountedSubtotal + shippingFee + gstAmount;
  const halfAdvanceAmount = Math.round(total * 0.5);
  const payableNow = paymentMode === 'Partial Payment (50% Advance)' ? halfAdvanceAmount : total;
  const balanceDue = Math.max(0, total - payableNow);

  const handleApplyPromoCode = (rawCode?: string) => {
    const code = (rawCode ?? promoInput).trim().toUpperCase();
    if (!code) {
      setPromoFeedback({ type: 'error', text: 'Enter code WELCOME10 to unlock 10% OFF.' });
      return;
    }
    if (code === 'WELCOME10' || code === 'TEQQNO10' || code === 'WELCOME12') {
      const normalized = code === 'WELCOME12' ? 'WELCOME10' : code;
      const saved = Math.round(subtotal * 0.1);
      setAppliedPromoCode(normalized);
      setPromoInput(normalized);
      try {
        sessionStorage.setItem('teqqno_applied_coupon', normalized);
      } catch {}
      setPromoFeedback({
        type: 'success',
        text: `🎉 Code ${normalized} applied! You saved ₹${saved.toLocaleString('en-IN')} (10% OFF).`,
      });
    } else if (code === 'SAVE5NOW' || code === 'TEQQNO5') {
      const active = getActiveRecoveryCoupon();
      if (!active) {
        setPromoFeedback({
          type: 'error',
          text: 'Limited-time 5% OFF voucher has expired or unlocks only when needed at checkout.',
        });
        return;
      }
      const saved = Math.round(subtotal * 0.05);
      setAppliedPromoCode('SAVE5NOW');
      setPromoInput('SAVE5NOW');
      try {
        sessionStorage.setItem('teqqno_applied_coupon', 'SAVE5NOW');
      } catch {}
      setPromoFeedback({
        type: 'success',
        text: `⚡ Limited-Time 5% OFF (SAVE5NOW) applied! You saved ₹${saved.toLocaleString('en-IN')}.`,
      });
    } else if (code === 'TEQQNOBULK') {
      const saved = Math.min(subtotal, 500);
      setAppliedPromoCode('TEQQNOBULK');
      setPromoInput('TEQQNOBULK');
      try {
        sessionStorage.setItem('teqqno_applied_coupon', 'TEQQNOBULK');
      } catch {}
      setPromoFeedback({
        type: 'success',
        text: `Bulk voucher applied! Saved ₹${saved.toLocaleString('en-IN')}.`,
      });
    } else {
      setPromoFeedback({
        type: 'error',
        text: 'Invalid promo code. Use WELCOME10 or your limited-time 5% OFF code.',
      });
    }
  };

  const handleRemovePromoCode = () => {
    setAppliedPromoCode(null);
    setPromoInput('');
    setPromoFeedback(null);
    try {
      sessionStorage.removeItem('teqqno_applied_coupon');
    } catch {}
  };

  const triggerCheckoutDropRecovery = async (
    reason: 'payment_cancelled' | 'payment_failed' | 'checkout_back' | 'checkout_hesitation',
    leavingCheckout = false
  ) => {
    if (orderPlacedRef.current || items.length === 0) return;

    // Avoid spamming the customer multiple times in the same checkout session
    const sessionSentKey = `teqqno_drop_sent_${checkoutSessionId}`;
    const alreadySentSession = (() => {
      try {
        return sessionStorage.getItem(sessionSentKey) === 'true';
      } catch {
        return false;
      }
    })();

    if (recoverySentRef.current || alreadySentSession) {
      if (leavingCheckout) {
        onBackToCart();
      }
      return;
    }

    recoverySentRef.current = true;
    try {
      sessionStorage.setItem(sessionSentKey, 'true');
    } catch {}

    const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');
    const validPhone = cleanPhoneDigits.length >= 10 ? phone.trim() : '';
    const itemsSummary = items
      .map((it) => `${it.product.name} (${it.quantity} pcs)`)
      .join(', ')
      .slice(0, 120);

    let waStatusMsg: string | null = null;
    let waSimulated = true;
    let expiresAtMs = Date.now() + 15 * 60 * 1000;

    if (validPhone) {
      const waRes = await sendCheckoutDropRecoveryWhatsApp({
        checkoutSessionId,
        customerName: fullName.trim(),
        phone: validPhone,
        cartTotal: total,
        couponCode: 'SAVE5NOW',
        discountPercent: 5,
        validMinutes: 15,
        triggerReason: reason,
        itemsSummary,
      });
      waStatusMsg = waRes.message;
      waSimulated = Boolean(waRes.simulated);
      if (waRes.expiresAt) {
        const parsed = new Date(waRes.expiresAt).getTime();
        if (Number.isFinite(parsed)) expiresAtMs = parsed;
      }
    }

    const activated = activateRecoveryCoupon({
      triggerReason: reason,
      validMinutes: 15,
      autoApply: false,
      whatsappDispatched: Boolean(validPhone),
      whatsappPhone: validPhone,
      whatsappSimulated: waSimulated,
    });
    setRecoveryCoupon(activated);

    setRecoveryOfferModal({
      isOpen: true,
      triggerReason: reason,
      expiresAt: activated.expiresAt || expiresAtMs,
      whatsappStatusMessage: waStatusMsg,
      whatsappSimulated: waSimulated,
      leavingCheckout,
    });
  };

  // Trigger recovery automatically ONLY on Checkout if customer hesitates/lingers (50s) or attempts desktop exit-intent without ordering
  useEffect(() => {
    if (items.length === 0 || orderPlacedRef.current) return;
    const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');
    if (cleanPhoneDigits.length < 10) return;

    const timer = setTimeout(() => {
      if (!orderPlacedRef.current && !recoverySentRef.current) {
        void triggerCheckoutDropRecovery('checkout_hesitation', false);
      }
    }, 50_000);

    const handleMouseLeaveTop = (e: MouseEvent) => {
      if (e.clientY <= 8 && !orderPlacedRef.current && !recoverySentRef.current) {
        void triggerCheckoutDropRecovery('checkout_hesitation', false);
      }
    };
    document.addEventListener('mouseleave', handleMouseLeaveTop);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseleave', handleMouseLeaveTop);
    };
  }, [checkoutSessionId, items.length, phone]);

  useEffect(() => {
    getRazorpayStatus().then(setRazorpayStatus).catch(() => {});
  }, []);

  const resolveIndianState = (rawState?: string): string | null => {
    if (!rawState) return null;
    const trimmed = rawState.trim();
    const codeMap: Record<string, string> = {
      KA: 'Karnataka',
      MH: 'Maharashtra',
      DL: 'Delhi',
      TN: 'Tamil Nadu',
      TS: 'Telangana',
      TG: 'Telangana',
      GJ: 'Gujarat',
      UP: 'Uttar Pradesh',
      WB: 'West Bengal',
      HR: 'Haryana',
      RJ: 'Rajasthan',
      KL: 'Kerala',
      MP: 'Madhya Pradesh',
      PB: 'Punjab',
      GA: 'Goa',
      AP: 'Andhra Pradesh',
      BR: 'Bihar',
      JH: 'Jharkhand',
      OR: 'Odisha',
      OD: 'Odisha',
      CG: 'Chhattisgarh',
      CT: 'Chhattisgarh',
      UK: 'Uttarakhand',
      UT: 'Uttarakhand',
      HP: 'Himachal Pradesh',
      AS: 'Assam',
      CH: 'Chandigarh',
      JK: 'Jammu & Kashmir',
      LA: 'Ladakh',
      SK: 'Sikkim',
      TR: 'Tripura',
      ML: 'Meghalaya',
      MN: 'Manipur',
      NL: 'Nagaland',
      MZ: 'Mizoram',
      AR: 'Arunachal Pradesh',
      PY: 'Puducherry',
    };
    const mapped = codeMap[trimmed.toUpperCase()] || trimmed;
    const match = indianStates.find(
      (s) => s.toLowerCase() === mapped.toLowerCase() || mapped.toLowerCase().includes(s.toLowerCase())
    );
    return match || null;
  };

  useEffect(() => {
    return subscribeDelhiveryCheck((next) => {
      if (next?.pincode) {
        setAreaCheckPin(next.pincode);
        setAreaCheckError(null);
        setPincode(next.pincode);
        setPincodeStatus(next);
        if (next.serviceable && next.city) {
          setCity(next.city);
        }
        const resolved = resolveIndianState(next.state);
        if (next.serviceable && resolved) {
          setState(resolved);
        }
      }
    });
  }, []);

  const handleManualDelhiveryCheck = async (targetPin?: string) => {
    const cleanPin = (targetPin ?? areaCheckPin).replace(/[^0-9]/g, '').slice(0, 6);
    setAreaCheckPin(cleanPin);
    setAreaCheckError(null);
    if (cleanPin.length !== 6) {
      setAreaCheckError('Please enter a valid 6-digit Indian pincode.');
      return;
    }
    setUserEditedPin(false);
    setPincode(cleanPin);
    setCheckingPincode(true);
    try {
      const res = await checkDelhiveryPincode(cleanPin);
      setPincodeStatus(res);
      saveDelhiveryCheck(res);
      if (res.serviceable) {
        if (res.city) setCity(res.city);
        const resolved = resolveIndianState(res.state);
        if (resolved) setState(resolved);
      }
    } finally {
      setCheckingPincode(false);
    }
  };

  useEffect(() => {
    if (!userEditedPin) return;
    const cleanPin = pincode.replace(/[^0-9]/g, '');
    if (cleanPin.length !== 6) {
      setPincodeStatus(null);
      return;
    }
    let cancelled = false;
    setCheckingPincode(true);
    const timer = setTimeout(() => {
      checkDelhiveryPincode(cleanPin)
        .then((res) => {
          if (!cancelled) {
            setPincodeStatus(res);
            setAreaCheckPin(cleanPin);
            setAreaCheckError(null);
            saveDelhiveryCheck(res);
          }
        })
        .finally(() => {
          if (!cancelled) setCheckingPincode(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pincode, userEditedPin]);

  // GSTIN State Detection
  const stateCodeMap: Record<string, string> = {
    '29': 'Karnataka (Intrastate CGST+SGST)',
    '27': 'Maharashtra (Interstate IGST)',
    '07': 'Delhi (Interstate IGST)',
    '06': 'Haryana (Interstate IGST)',
    '33': 'Tamil Nadu (Interstate IGST)',
    '36': 'Telangana (Interstate IGST)',
    '19': 'West Bengal (Interstate IGST)',
    '24': 'Gujarat (Interstate IGST)',
    '09': 'Uttar Pradesh (Interstate IGST)',
    '08': 'Rajasthan (Interstate IGST)',
    '32': 'Kerala (Interstate IGST)',
    '23': 'Madhya Pradesh (Interstate IGST)',
    '03': 'Punjab (Interstate IGST)',
    '30': 'Goa (Interstate IGST)',
    '37': 'Andhra Pradesh (Interstate IGST)',
  };

  const detectedGstinState = useMemo(() => {
    if (!gstin || gstin.length < 2) return null;
    const code = gstin.slice(0, 2);
    return stateCodeMap[code] || 'Verified Registered State';
  }, [gstin]);

  const isGstinValid = useMemo(() => {
    if (!gstin) return false;
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return regex.test(gstin.trim());
  }, [gstin]);

  // CRO: Automatically debounce & autosave partial lead data into abandoned_checkouts
  useEffect(() => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const hasPhone = cleanPhone.length >= 8;
    const hasEmail = email.includes('@') && email.includes('.');

    // Only record once customer has engaged with phone or email
    if (!hasPhone && !hasEmail) return;

    const timer = setTimeout(() => {
      saveAbandonedCheckout({
        id: checkoutSessionId,
        customerName: fullName?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        company: companyName?.trim() || null,
        cartItems: items.map(item => ({
          id: item.id,
          productId: item.product.id,
          productName: item.product.name,
          color: item.color?.name,
          size: item.size,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          printMethod: item.printMethod,
          printPlacement: item.printPlacement,
          previewUrl: item.previewUrl || item.product.colors[0]?.imageFront,
        })),
        cartTotal: total,
      }).catch(err => {
        console.warn('[Abandoned Checkout Capture]:', err);
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [checkoutSessionId, fullName, email, phone, companyName, items, total]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanShipPin = pincode.replace(/[^0-9]/g, '');
    if (cleanShipPin.length !== 6) {
      setOrderError('Please enter a valid 6-digit delivery pincode in Step 2 before placing your order.');
      return;
    }
    if (pincodeStatus && !pincodeStatus.serviceable) {
      setOrderError(`Delhivery courier delivery is currently unavailable for pincode ${cleanShipPin}. Please enter a serviceable pincode in Step 2 or contact our logistics team on WhatsApp.`);
      return;
    }

    setIsProcessing(true);
    setOrderError(null);
    setUploadStepStatus('Initiating order processing...');

    try {
      let razorpayOrderId: string | undefined;
      let razorpayPaymentId: string | undefined;

      // 0. If Razorpay status hasn't finished loading yet, fetch it synchronously first
      const liveRzpStatus = razorpayStatus ?? (await getRazorpayStatus().catch(() => null));
      if (liveRzpStatus && !razorpayStatus) {
        setRazorpayStatus(liveRzpStatus);
      }

      // If Razorpay live keys are configured on backend, collect 100% Prepaid or 50% Advance first
      if (liveRzpStatus?.configured) {
        setUploadStepStatus('Opening Razorpay secure checkout...');
        const scriptOk = await loadRazorpayCheckoutScript();
        if (!scriptOk || !(window as any).Razorpay) {
          throw new Error('Could not load Razorpay Checkout SDK. Check your internet connection.');
        }

        const rzpOrder = await createRazorpayOrder({
          amountInr: payableNow,
          totalOrderValue: total,
          balanceDue,
          paymentPlan: paymentMode === 'Partial Payment (50% Advance)' ? 'partial_50' : 'prepaid_100',
          receipt: `TQ_${Date.now()}`,
          customerName: fullName.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
        });

        if (!rzpOrder.success || !rzpOrder.orderId || !rzpOrder.keyId) {
          throw new Error(rzpOrder.message || 'Unable to create Razorpay payment session.');
        }

        const brandLogoUrl =
          typeof window !== 'undefined' && window.location.protocol === 'https:'
            ? `${window.location.origin}/assets/aistudio/Glossy_TeqqnoWorld_Branding_Badge-photoaidcom-cropped_1055f8dc.png`
            : undefined;

        const rzpResponse = await new Promise<{
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }>((resolve, reject) => {
          const rzpInstance = new (window as any).Razorpay({
            key: rzpOrder.keyId,
            amount: rzpOrder.amount,
            currency: rzpOrder.currency || 'INR',
            name: 'TeqqnoWorld',
            ...(brandLogoUrl ? { image: brandLogoUrl } : {}),
            description:
              paymentMode === 'Partial Payment (50% Advance)'
                ? `50% Advance (₹${payableNow.toLocaleString('en-IN')} of ₹${total.toLocaleString('en-IN')})`
                : `100% Full Prepaid Order`,
            order_id: rzpOrder.orderId,
            prefill: {
              name: fullName.trim(),
              email: email.trim(),
              contact: phone.replace(/[^0-9]/g, '').slice(-10),
            },
            notes: {
              company: companyName || 'Direct',
              payment_plan: paymentMode,
              balance_due_before_dispatch: String(balanceDue),
            },
            theme: { color: '#FF7A00' },
            modal: {
              ondismiss: () => {
                void triggerCheckoutDropRecovery('payment_cancelled', false);
                reject(new Error('Payment cancelled before completion. We unlocked a limited-time 5% OFF voucher for you!'));
              },
            },
            handler: (resp: any) => resolve(resp),
          });
          rzpInstance.on('payment.failed', (failResp: any) => {
            void triggerCheckoutDropRecovery('payment_failed', false);
            reject(new Error(failResp?.error?.description || 'Razorpay payment failed. Please try again.'));
          });
          rzpInstance.open();
        });

        setUploadStepStatus('Verifying Razorpay payment signature...');
        const verifyRes = await verifyRazorpayPayment(rzpResponse);
        if (!verifyRes.verified) {
          throw new Error(verifyRes.message || 'Razorpay signature verification failed.');
        }

        razorpayOrderId = rzpResponse.razorpay_order_id;
        razorpayPaymentId = rzpResponse.razorpay_payment_id;
      }

      const insertedOrderIds: string[] = [];
      const emailItems: OrderEmailItem[] = [];

      const safeUploadToSupabase = async (
        source: string | null | undefined,
        label: string
      ): Promise<{ publicUrl: string | null; emailSource: string | undefined }> => {
        if (!source) return { publicUrl: null, emailSource: undefined };
        if (source.startsWith('http://') || source.startsWith('https://')) {
          return { publicUrl: source, emailSource: source };
        }
        try {
          const uploaded = await uploadDataUrlToStorage(source, label);
          if (uploaded && (uploaded.startsWith('http://') || uploaded.startsWith('https://'))) {
            return { publicUrl: uploaded, emailSource: uploaded };
          }
        } catch (storageError) {
          console.warn(`[Supabase Storage Warning] Upload failed for ${label}:`, storageError);
        }
        // Fallback: pass base64 dataUrl directly to email backend so Admin still receives the image!
        return {
          publicUrl: null,
          emailSource: source.startsWith('data:') ? source : undefined,
        };
      };

      // 1. Process and insert each cart item into Supabase custom_orders
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        setUploadStepStatus(`Preparing artwork & mockup design for ${item.product.name} (${i + 1}/${items.length})...`);

        const { frontRawLogo, backRawLogo, extraRawLogos } = extractArtworkAssetsFromItem(item);
        const { frontMockupDataUrl, backMockupDataUrl } = await generateItemMockupSnapshots(item);
        const designPositionSummary = describeArtworkPlacement(item);

        setUploadStepStatus(`Uploading logo & placement mockup for ${item.product.name} to cloud storage...`);

        const slugBase = `${item.product.id}_${item.color?.name || 'custom'}`.replace(/[^a-zA-Z0-9_-]/g, '_');

        // Upload order-level voice note once if provided, otherwise item-level voice note
        const effectiveVoiceSource = item.voiceNoteUrl || orderVoiceNoteUrl || null;
        const [frontLogoRes, backLogoRes, frontMockupRes, backMockupRes, voiceNoteRes, ...extraLogoResList] = await Promise.all([
          safeUploadToSupabase(frontRawLogo, `${slugBase}_logo_front`),
          safeUploadToSupabase(backRawLogo, `${slugBase}_logo_back`),
          safeUploadToSupabase(frontMockupDataUrl, `${slugBase}_mockup_front`),
          safeUploadToSupabase(backMockupDataUrl, `${slugBase}_mockup_back`),
          safeUploadToSupabase(effectiveVoiceSource, `${slugBase}_voice_note`),
          ...extraRawLogos.slice(0, 4).map((extraSrc, idx) =>
            safeUploadToSupabase(extraSrc, `${slugBase}_extra_${idx + 1}`)
          ),
        ]);

        const primaryLogoDbUrl = frontLogoRes.publicUrl || backLogoRes.publicUrl || frontMockupRes.publicUrl || null;
        const combinedItemNotes = [item.customNotes, orderVoiceNotes.trim()]
          .filter(Boolean)
          .join(' | Checkout Instruction: ');

        // Map form fields to exact Supabase custom_orders columns
        const notesParts: string[] = [];
        if (item.color?.name) notesParts.push(`Color: ${item.color.name}`);
        if (item.size) notesParts.push(`Size: ${item.size}`);
        if (item.printMethod) notesParts.push(`Method: ${item.printMethod}`);
        if (designPositionSummary) notesParts.push(`Position & Layout: ${designPositionSummary}`);
        if (combinedItemNotes) notesParts.push(`Notes: ${combinedItemNotes}`);
        if (poNumber) notesParts.push(`PO#: ${poNumber}`);
        if (isB2BInvoice && gstin) notesParts.push(`GSTIN: ${gstin}`);
        notesParts.push(`Address: ${street}, ${city}, ${state} - ${pincode}`);
        if (appliedPromoCode && discountAmount > 0) {
          notesParts.push(`Promo: ${appliedPromoCode} (-₹${discountAmount})`);
        }
        notesParts.push(`Payment Plan: ${paymentMode}`);
        notesParts.push(`Paid: ₹${payableNow} | Balance Due: ₹${balanceDue}`);
        if (razorpayPaymentId) {
          notesParts.push(`Razorpay ID: ${razorpayPaymentId}`);
        } else {
          notesParts.push(`Gateway Mode: Sandbox (Awaiting Razorpay API Keys)`);
        }

        // Attach structured URLs at end of custom_notes for Admin Hub multi-preview gallery
        if (frontMockupRes.publicUrl) notesParts.push(`[FrontMockup: ${frontMockupRes.publicUrl}]`);
        if (backMockupRes.publicUrl) notesParts.push(`[BackMockup: ${backMockupRes.publicUrl}]`);
        if (backLogoRes.publicUrl) notesParts.push(`[BackLogo: ${backLogoRes.publicUrl}]`);
        if (voiceNoteRes.publicUrl) notesParts.push(`[VoiceNote: ${voiceNoteRes.publicUrl}]`);

        const orderRow = {
          customer_name: fullName.trim(),
          customer_email: email.trim(),
          company: companyName?.trim() || null,
          phone: phone.trim(),
          product_id: item.product.id,
          quantity: item.quantity,
          logo_url: primaryLogoDbUrl,
          custom_notes: notesParts.join(' | ') || 'Order placed via checkout',
          status: 'pending' as const,
        };

        console.log('[Supabase Order] Inserting into custom_orders:', orderRow);
        setUploadStepStatus(`Saving order for ${item.product.name} to Supabase database...`);

        // Real Supabase insert call:
        const { data, error } = await (supabase.from('custom_orders') as any)
          .insert([orderRow])
          .select();

        if (error) {
          console.error('[Supabase Insert Error in custom_orders]:', error);
          throw new Error(error.message || 'Failed to insert custom order into Supabase.');
        }

        console.log('[Supabase Insert Success]:', data);
        if (data && data[0]?.id) {
          insertedOrderIds.push(data[0].id);
        }

        emailItems.push({
          name: item.product.name,
          color: item.color?.name,
          size: item.size,
          sizeDistribution: item.sizeDistribution,
          printMethod: item.printMethod,
          printPlacement: item.printPlacement,
          frontPlacement: item.frontPlacement,
          backPlacement: item.backPlacement,
          designPositionSummary,
          logoUrl: frontLogoRes.emailSource,
          backLogoUrl: backLogoRes.emailSource,
          mockupFrontUrl: frontMockupRes.emailSource,
          mockupBackUrl: backMockupRes.emailSource,
          extraArtworkUrls: extraLogoResList.map((r) => r.emailSource).filter((u): u is string => Boolean(u)),
          customNotes: combinedItemNotes || undefined,
          voiceNoteUrl: voiceNoteRes.publicUrl || voiceNoteRes.emailSource,
          quantity: item.quantity,
          price: item.unitPrice,
          totalPrice: item.totalPrice,
        });
      }

      // 2. Prepare confirmation order object
      const primaryId = insertedOrderIds[0] || `TQ-${Math.floor(100000 + Math.random() * 900000)}`;
      const orderNumber = primaryId.startsWith('TQ-') 
        ? primaryId 
        : `TQ-${primaryId.slice(0, 8).toUpperCase()}`;

      const shippingAddress: ShippingAddress = {
        fullName,
        companyName: companyName || undefined,
        email,
        phone,
        street,
        city,
        state,
        pincode,
        gstin: isB2BInvoice ? gstin : undefined,
        isB2BInvoice,
      };

      const newOrder: Order = {
        id: primaryId,
        orderNumber,
        createdAt: new Date().toISOString(),
        items: [...items],
        subtotal: discountedSubtotal,
        gstRate,
        gstAmount,
        shippingFee,
        total,
        shippingAddress,
        proofStatus: 'Proof Ready - Needs Approval',
        orderStatus: 'Artwork Verification',
        estimatedDispatch: new Date(Date.now() + 48 * 3600 * 1000).toISOString().split('T')[0],
        trackingNumber: 'Awaiting Delhivery Manifest',
        courierPartner: 'Delhivery Express (Prepaid)',
        paymentMode,
        paymentStatus: razorpayPaymentId
          ? paymentMode === 'Partial Payment (50% Advance)'
            ? '50% Advance Paid (Razorpay)'
            : 'Paid in Full (Razorpay)'
          : 'Test Authenticated (Sandbox)',
        amountPaid: payableNow,
        balanceDue,
        razorpayOrderId,
        razorpayPaymentId,
        orderVoiceNoteUrl: orderVoiceNoteUrl || undefined,
        orderNotes: orderVoiceNotes.trim() || undefined,
      };

      // CRO: Mark abandoned lead as recovered upon successful placement
      orderPlacedRef.current = true;
      markCheckoutRecovered(checkoutSessionId, primaryId).catch(err => {
        console.warn('[Mark Checkout Recovered Warning]:', err);
      });
      clearRecoveryCoupon();
      try {
        sessionStorage.removeItem('teqqno_checkout_session_id');
        sessionStorage.removeItem('teqqno_applied_coupon');
        sessionStorage.removeItem(`teqqno_drop_sent_${checkoutSessionId}`);
      } catch {}

      // Trigger automated Hostinger SMTP order confirmation (Customer) & New Order Alert (Admin)
      setUploadStepStatus('Sending order confirmation emails & WhatsApp alert...');
      const itemsSummary = items
        .map((it) => `${it.product.name} (${it.quantity} pcs)`)
        .join(', ');

      const [emailResult, whatsappResult] = await Promise.all([
        sendOrderConfirmationEmail({
          orderId: primaryId,
          orderNumber,
          customerName: fullName.trim(),
          customerEmail: email.trim(),
          company: companyName?.trim() || undefined,
          phone: phone.trim(),
          gstin: isB2BInvoice && gstin ? gstin.trim() : undefined,
          paymentMode,
          amountPaid: payableNow,
          balanceDue,
          razorpayPaymentId,
          orderVoiceNoteUrl: orderVoiceNoteUrl || undefined,
          orderNotes: orderVoiceNotes.trim() || undefined,
          items: emailItems,
          subtotal: discountedSubtotal,
          gstAmount,
          shippingFee,
          total,
          estimatedDispatch: '24-48h Fast Dispatch via Delhivery',
          shippingAddress: {
            street,
            city,
            state,
            pincode,
          },
        }),
        sendOrderWhatsAppConfirmation({
          orderId: primaryId,
          orderNumber,
          customerName: fullName.trim(),
          phone: phone.trim(),
          total,
          amountPaid: payableNow,
          balanceDue,
          paymentMode,
          itemsSummary,
          shippingCity: city,
        }),
      ]);

      newOrder.emailNotification = {
        status: emailResult.simulated
          ? 'simulated'
          : emailResult.success
            ? 'sent'
            : 'failed',
        message: emailResult.message,
        customerSent: emailResult.customerSent,
        adminSent: emailResult.adminSent,
      };

      newOrder.whatsappActionStatus = whatsappResult.whatsappActionStatus || 'pending';
      newOrder.whatsappNotification = {
        status: whatsappResult.simulated
          ? 'simulated'
          : whatsappResult.success
            ? 'sent'
            : 'failed',
        phone: whatsappResult.phone || phone.trim(),
        message: whatsappResult.message,
        confirmUrl: whatsappResult.confirmUrl,
        cancelUrl: whatsappResult.cancelUrl,
        previewMessage: whatsappResult.previewMessage,
      };

      setIsProcessing(false);
      onOrderPlaced(newOrder);

    } catch (err: any) {
      console.error('[Order Placement Error]:', err);
      setOrderError(err?.message || 'Failed to place order in Supabase. Please verify your connection or RLS policy.');
      setIsProcessing(false);
    }
  };


  const indianStates = [
    'Karnataka', 'Maharashtra', 'Delhi', 'Delhi-NCR', 'Tamil Nadu', 'Telangana',
    'Gujarat', 'Uttar Pradesh', 'West Bengal', 'Haryana', 'Rajasthan',
    'Kerala', 'Madhya Pradesh', 'Punjab', 'Goa', 'Andhra Pradesh',
    'Bihar', 'Jharkhand', 'Odisha', 'Chhattisgarh', 'Uttarakhand',
    'Himachal Pradesh', 'Assam', 'Chandigarh', 'Jammu & Kashmir', 'Ladakh',
    'Sikkim', 'Tripura', 'Meghalaya', 'Manipur', 'Nagaland', 'Mizoram',
    'Arunachal Pradesh', 'Puducherry', 'Andaman & Nicobar Islands', 'Lakshadweep'
  ];

  return (
    <div className="bg-[#F5F5F7] min-h-screen py-6 sm:py-10 pb-12">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 space-y-6 sm:space-y-8">
        
        {/* Top Back & Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (!recoverySentRef.current && items.length > 0 && !orderPlacedRef.current) {
                void triggerCheckoutDropRecovery('checkout_back', true);
              } else {
                onBackToCart();
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-[#0B0B0D] transition-colors cursor-pointer min-h-[38px]"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>Return to Shopping Bag</span>
          </button>

          <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-mono text-zinc-500">
            <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="sm:hidden">256-Bit SSL Secure Checkout</span>
            <span className="hidden sm:inline">256-Bit SSL Encrypted Procurement Checkout</span>
          </div>
        </div>

        {/* New Customer 10% OFF Promo Banner with Old Festive Sparkler Animation */}
        <NewCustomerPromoBanner
          appliedCode={appliedPromoCode}
          discountAmount={discountAmount}
          onApplyPromo={(code) => handleApplyPromoCode(code)}
          onRemovePromo={handleRemovePromoCode}
        />

        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Order Error Alert Banner */}
          {orderError && (
            <div className="lg:col-span-12 p-4 rounded-2xl bg-red-50 border-2 border-red-300 text-red-800 text-xs sm:text-sm flex items-start gap-3 shadow-md animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold text-red-900">Supabase Order Insertion Failed</div>
                <p className="mt-0.5 text-red-700 leading-relaxed">{orderError}</p>
                <div className="mt-2 text-[11px] text-red-600 font-mono">
                  Make sure Supabase RLS Policy on table <code>custom_orders</code> allows <code>INSERT</code> for public/anon.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOrderError(null)}
                className="text-red-500 hover:text-red-800 text-xs font-bold px-2 py-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Left Column (7 cols): Address, GSTIN & Payment Selection */}
          <div className="lg:col-span-7 space-y-6">

            
            {/* Quick Login Prompt for Guests */}
            {!user && onRequestLogin && (
              <div className="bg-orange-50/70 border border-[#FF7A00]/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start sm:items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#FF7A00] shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-bold text-[#0B0B0D]">Already have a corporate account?</span>
                    <p className="text-zinc-600 text-[11px]">Log in to auto-fill GSTIN & verified company addresses.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onRequestLogin}
                  className="w-full sm:w-auto bg-[#FF7A00] hover:bg-[#ff881a] text-white font-semibold px-4 py-2.5 sm:py-2 rounded-xl shrink-0 transition-colors shadow-xs min-h-[42px] sm:min-h-[38px] cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            )}

            {/* Step 1: Contact & Company Profile */}
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4 sm:p-6 shadow-xs space-y-4">
              <h3 className="font-display font-bold text-base text-[#0B0B0D] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#FF7A00] text-white flex items-center justify-center text-xs">1</span>
                <span>Contact & GST Invoicing Details</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm sm:text-sm border border-zinc-300 rounded-xl focus:border-[#FF7A00] outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Company / Organization Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm sm:text-sm border border-zinc-300 rounded-xl focus:border-[#FF7A00] outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Email (For Digital Proof & Invoice) *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm sm:text-sm border border-zinc-300 rounded-xl focus:border-[#FF7A00] outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Mobile / WhatsApp (Dispatch Alerts) *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm sm:text-sm border border-zinc-300 rounded-xl focus:border-[#FF7A00] outline-none min-h-[44px]"
                  />
                </div>
              </div>

              {/* Purchase Order (PO) Number for Corporate Reconciliation */}
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Corporate Purchase Order (PO) Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. PO/2026/NX-9824"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono border border-zinc-300 rounded-xl focus:border-[#FF7A00] outline-none bg-white min-h-[44px]"
                />
              </div>

              {/* GSTIN Toggle & Live Verification Box */}
              <div className="bg-[#FAF9FD] p-4 rounded-xl border border-[#ECEAF3] space-y-3">
                <label className="flex items-center gap-2 text-xs text-zinc-800 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={isB2BInvoice}
                    onChange={(e) => setIsB2BInvoice(e.target.checked)}
                    className="rounded border-zinc-300 text-[#FF7A00] focus:ring-[#FF7A00]"
                  />
                  <span className="font-bold text-zinc-900">Generate official 18% GST Input Tax Credit (ITC) Tax Invoice</span>
                </label>

                {isB2BInvoice && (
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <input
                        type="text"
                        required={isB2BInvoice}
                        maxLength={15}
                        placeholder="15-Digit GSTIN (e.g. 29AABCN8291P1ZX)"
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                        className="w-full px-3.5 py-2.5 text-xs uppercase font-mono border border-zinc-300 rounded-xl focus:border-[#FF7A00] outline-none bg-white font-bold tracking-wider"
                      />
                      {gstin && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {isGstinValid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3 text-emerald-700" />
                              Valid GSTIN
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-mono">
                              {gstin.length}/15 digits
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {detectedGstinState && (
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-600 bg-white p-2.5 rounded-lg border border-zinc-200">
                        <span className="font-semibold text-zinc-800">State Jurisdiction: {detectedGstinState}</span>
                        <span className="text-emerald-700 font-bold">SAC 9989 · Claim ₹{gstAmount.toLocaleString('en-IN')} ITC</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Shipping & Corporate Billing Addresses */}
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-6 shadow-xs space-y-4">
              <h3 className="font-display font-bold text-base text-[#0B0B0D] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#FF7A00] text-white flex items-center justify-center text-xs">2</span>
                <span>Delivery & Corporate Billing Address</span>
              </h3>

              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Physical Delivery Address (Shipping) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Tower B, Tech Park, Outer Ring Road..."
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm sm:text-sm border border-zinc-300 rounded-xl focus:border-[#FF7A00] outline-none min-h-[44px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm sm:text-sm border border-zinc-300 rounded-xl focus:border-[#FF7A00] outline-none min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">State *</label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm sm:text-sm border border-zinc-300 rounded-xl focus:border-[#FF7A00] outline-none bg-white min-h-[44px]"
                    >
                      {indianStates.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">Pincode *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      value={pincode}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                        setUserEditedPin(true);
                        setPincode(clean);
                        setAreaCheckPin(clean);
                        setAreaCheckError(null);
                      }}
                      placeholder="6-digit PIN"
                      className="w-full px-3.5 py-2.5 text-sm sm:text-sm font-mono tabular-nums border border-zinc-300 rounded-xl focus:border-[#FF7A00] outline-none min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Interactive Delhivery Serviceability & Area Availability Checker in Checkout */}
                <div className="rounded-2xl border border-[#E5E5EA] bg-[#FAF9FD] p-4 space-y-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#071B35] text-white flex items-center justify-center shrink-0 overflow-hidden">
                      <motion.div
                        animate={checkingPincode ? { x: [-8, 8, -8] } : { x: 0 }}
                        transition={checkingPincode ? { repeat: Infinity, duration: 0.75 } : { duration: 0.2 }}
                      >
                        <Truck className="w-4 h-4 text-[#FF7A00]" />
                      </motion.div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-display font-bold text-xs sm:text-sm text-[#071B35]">
                        Check Delhivery Delivery in Your Area
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        Apne area ka 6-digit PIN code daal kar check karein (Hyderabad hub 502032 se dispatch)
                      </div>
                    </div>
                  </div>

                  {/* Dedicated Pincode Input + Check Button inside the selected box */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <MapPin className="w-4 h-4 text-[#FF7A00] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={areaCheckPin}
                        onChange={(e) => {
                          setAreaCheckPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6));
                          setAreaCheckError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleManualDelhiveryCheck(areaCheckPin);
                          }
                        }}
                        placeholder="Enter your 6-digit area PIN code (e.g. 110001)"
                        aria-label="Enter your area pincode to check Delhivery delivery"
                        className="w-full pl-10 pr-3.5 py-2.5 min-h-[42px] text-xs sm:text-sm font-mono tabular-nums bg-white border border-zinc-300 rounded-xl focus:border-[#FF7A00] focus:ring-2 focus:ring-[#FF7A00]/15 outline-none text-[#071B35] placeholder:font-sans placeholder:text-zinc-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleManualDelhiveryCheck(areaCheckPin)}
                      disabled={checkingPincode}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#071B35] hover:bg-[#0d2c54] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60 transition-colors whitespace-nowrap"
                    >
                      {checkingPincode ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF7A00]" />
                          <span>Checking...</span>
                        </>
                      ) : (
                        <>
                          <Truck className="w-3.5 h-3.5 text-[#FF7A00]" />
                          <span>Check Availability</span>
                        </>
                      )}
                    </button>
                  </div>

                  {areaCheckError && (
                    <div className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{areaCheckError}</span>
                    </div>
                  )}

                  {/* Quick Metro City Check Shortcuts */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500">
                    <span className="font-medium text-zinc-400">Quick test PIN:</span>
                    {[
                      { label: 'Hyderabad', pin: '500081' },
                      { label: 'Bengaluru', pin: '560001' },
                      { label: 'Mumbai', pin: '400001' },
                      { label: 'Delhi NCR', pin: '110001' },
                    ].map((sample) => (
                      <button
                        key={sample.pin}
                        type="button"
                        onClick={() => void handleManualDelhiveryCheck(sample.pin)}
                        className="hover:text-[#FF7A00] font-medium transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {sample.label} <span className="font-mono text-zinc-400">({sample.pin})</span>
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    {checkingPincode ? (
                      <motion.div
                        key="checking-delhivery"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-white border border-zinc-200 rounded-xl p-3 text-xs text-zinc-600 flex items-center gap-2"
                      >
                        <Loader2 className="w-4 h-4 animate-spin text-[#FF7A00] shrink-0" />
                        <span>
                          Checking Delhivery Express serviceability for pincode{' '}
                          <strong className="font-mono text-[#071B35]">{pincode}</strong>...
                        </span>
                      </motion.div>
                    ) : pincodeStatus ? (
                      <motion.div
                        key={`${pincodeStatus.pincode}-${pincodeStatus.serviceable}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        className={`rounded-xl border p-3 text-xs space-y-2 ${
                          pincodeStatus.serviceable
                            ? 'bg-white border-emerald-200 text-zinc-800'
                            : 'bg-red-50/80 border-red-200 text-red-900'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            {pincodeStatus.serviceable ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            )}
                            <div className="min-w-0 space-y-0.5">
                              <div className="font-bold text-[#071B35]">
                                {pincodeStatus.serviceable
                                  ? `Delhivery Available · ${
                                      [pincodeStatus.areaName, pincodeStatus.city, pincodeStatus.state]
                                        .filter(Boolean)
                                        .filter((v, idx, arr) => arr.indexOf(v) === idx)
                                        .join(', ') || pincodeStatus.pincode
                                    } (${pincodeStatus.pincode})`
                                  : `Delivery Not Available for ${pincodeStatus.pincode}`}
                              </div>
                              {pincodeStatus.serviceable ? (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-600">
                                  <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-700">
                                    <Clock className="w-3 h-3" />
                                    Est. Delivery: {pincodeStatus.estimatedDays || '2–4 business days'}
                                  </span>
                                  <span>Delhivery Prepaid Express · 100% Insured</span>
                                </div>
                              ) : (
                                <p className="text-[11px] text-red-700">
                                  {pincodeStatus.message || 'Please enter a valid serviceable Indian pincode.'}
                                </p>
                              )}
                            </div>
                          </div>

                          {pincodeStatus.serviceable &&
                            pincodeStatus.city &&
                            pincodeStatus.city.toLowerCase() !== city.trim().toLowerCase() && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (pincodeStatus.city) setCity(pincodeStatus.city);
                                  const resolved = resolveIndianState(pincodeStatus.state);
                                  if (resolved) setState(resolved);
                                }}
                                className="text-[11px] font-semibold text-[#FF7A00] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                Fill {pincodeStatus.city} in Address →
                              </button>
                            )}

                          {!pincodeStatus.serviceable && (
                            <a
                              href={getWhatsAppLink(
                                `Hi TeqqnoWorld, my checkout pincode ${pincodeStatus.pincode} showed unserviceable on Delhivery. Can you arrange corporate delivery?`
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] font-semibold text-[#071B35] hover:text-[#FF7A00] underline whitespace-nowrap shrink-0"
                            >
                              Ask Logistics Team →
                            </a>
                          )}
                        </div>

                        {pincodeStatus.serviceable && (
                          <div className="relative h-1.5 w-full bg-emerald-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: '100%' }}
                              transition={{ duration: 0.6, ease: 'easeOut' }}
                              className="h-full bg-gradient-to-r from-[#FF7A00] to-emerald-500 rounded-full"
                            />
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <div className="text-[11px] text-zinc-500">
                        Enter a 6-digit Indian pincode above and click <strong>Check Availability</strong> to verify Delhivery courier coverage.
                      </div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Separate Billing Address Toggle */}
                <div className="pt-2 border-t border-zinc-100">
                  <label className="flex items-center gap-2 text-xs text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={billingSameAsShipping}
                      onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                      className="rounded border-zinc-300 text-[#FF7A00] focus:ring-[#FF7A00]"
                    />
                    <span>Company Billing address is identical to shipping delivery address</span>
                  </label>

                  {!billingSameAsShipping && (
                    <div className="mt-3 p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
                      <div className="text-xs font-bold text-zinc-800">Corporate Registered Billing Address (For Tax Invoice)</div>
                      <input
                        type="text"
                        placeholder="Registered Corporate HQ Street Address"
                        value={billingStreet}
                        onChange={(e) => setBillingStreet(e.target.value)}
                        className="w-full p-2.5 text-xs border border-zinc-300 rounded-lg bg-white outline-none focus:border-[#FF7A00]"
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <input
                          type="text"
                          placeholder="City"
                          value={billingCity}
                          onChange={(e) => setBillingCity(e.target.value)}
                          className="p-2.5 sm:p-2 text-xs border border-zinc-300 rounded-lg bg-white outline-none min-h-[42px] sm:min-h-0"
                        />
                        <input
                          type="text"
                          placeholder="State"
                          value={billingState}
                          onChange={(e) => setBillingState(e.target.value)}
                          className="p-2.5 sm:p-2 text-xs border border-zinc-300 rounded-lg bg-white outline-none min-h-[42px] sm:min-h-0"
                        />
                        <input
                          type="text"
                          placeholder="Pincode"
                          maxLength={6}
                          value={billingPincode}
                          onChange={(e) => setBillingPincode(e.target.value)}
                          className="p-2.5 sm:p-2 text-xs border border-zinc-300 rounded-lg bg-white outline-none font-mono min-h-[42px] sm:min-h-0"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Step 3: Razorpay Payment Plan (100% Prepaid or 50% Partial Advance — NO COD) */}
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display font-bold text-base text-[#0B0B0D] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#FF7A00] text-white flex items-center justify-center text-xs">3</span>
                  <span>Online Payment Option (Prepaid / 50% Advance)</span>
                </h3>
                <span
                  className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${
                    razorpayStatus?.configured
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {razorpayStatus?.configured ? '● RAZORPAY LIVE' : '● SANDBOX MODE (RAZORPAY READY)'}
                </span>
              </div>

              {!razorpayStatus?.configured && (
                <div className="bg-amber-50 rounded-xl p-3.5 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed text-[11px] text-amber-800">
                    Razorpay keys (<code>RAZORPAY_KEY_ID</code> / <code>RAZORPAY_KEY_SECRET</code>) are pending on the server.
                    Your selected <strong>100% Prepaid</strong> or <strong>50% Partial Advance</strong> plan will still log your order & digital proof cleanly in Sandbox mode.
                  </p>
                </div>
              )}

              {/* Payment Methods (No COD) */}
              <div className="space-y-3 pt-1">
                {[
                  {
                    id: 'Full Prepaid (100% Online)' as const,
                    title: '100% Full Prepaid Online (Razorpay)',
                    desc: `Pay full ₹${total.toLocaleString('en-IN')} today via UPI, Cards, or NetBanking. Zero balance due later & fastest factory priority.`,
                    badge: `Pay ₹${total.toLocaleString('en-IN')} Now`,
                    icon: CreditCard,
                  },
                  {
                    id: 'Partial Payment (50% Advance)' as const,
                    title: '50% Partial Advance Payment (Razorpay)',
                    desc: `Pay 50% (₹${halfAdvanceAmount.toLocaleString('en-IN')}) now to confirm design proofing & start printing. Pay remaining ₹${(total - halfAdvanceAmount).toLocaleString('en-IN')} online before Delhivery dispatch.`,
                    badge: `50% Now: ₹${halfAdvanceAmount.toLocaleString('en-IN')}`,
                    icon: Percent,
                  },
                ].map((mode) => (
                  <label
                    key={mode.id}
                    className={`block p-4 rounded-xl border cursor-pointer transition-all ${
                      paymentMode === mode.id
                        ? 'border-[#FF7A00] bg-[#FF7A00]/5 ring-1 ring-[#FF7A00]'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="paymentMode"
                        checked={paymentMode === mode.id}
                        onChange={() => setPaymentMode(mode.id)}
                        className="mt-1 text-[#FF7A00] focus:ring-[#FF7A00]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs sm:text-sm font-semibold text-[#0B0B0D] flex items-center gap-2">
                            <mode.icon className="w-4 h-4 text-[#FF7A00] shrink-0" />
                            <span>{mode.title}</span>
                          </div>
                          <span className="text-[11px] font-mono font-bold text-[#FF7A00] bg-[#FF7A00]/10 px-2 py-0.5 rounded">
                            {mode.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{mode.desc}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5">
                <Wallet className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                <span>
                  <strong>Prepaid Policy:</strong> Cash on Delivery (COD) is not available on custom branded merchandise. Choose either 100% Prepaid or 50% Advance to start production.
                </span>
              </div>

            </div>

          </div>

          {/* Right Column (5 cols): Order Summary & Submit Button */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-6 shadow-xs space-y-5">
              <h3 className="font-display font-bold text-base text-[#0B0B0D] pb-3 border-b border-[#E5E5EA]">
                Order Summary ({items.length} items)
              </h3>

              {/* Items Preview */}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="text-xs pb-3 border-b border-zinc-100 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#0B0B0D]">{item.product.name}</div>
                        <div className="text-[11px] text-zinc-500">
                          {item.quantity} pcs · {item.color.name} {item.size ? `· ${item.size}` : ''}
                        </div>
                        <div className="text-[10px] text-[#FF7A00] font-mono">
                          {item.printMethod} ({item.printPlacement})
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-zinc-800">
                        ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                      </div>
                    </div>
                    {item.voiceNoteUrl && (
                      <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-2 space-y-1">
                        <div className="text-[10px] text-emerald-700 font-semibold">
                          🎙️ Attached Product Voice Note
                        </div>
                        <audio controls src={item.voiceNoteUrl} className="w-full h-8 rounded-md" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Order-Level Voice Instructions */}
              <VoiceInstructionsCard
                voiceNoteUrl={orderVoiceNoteUrl}
                onVoiceNoteChange={setOrderVoiceNoteUrl}
                textNotes={orderVoiceNotes}
                onTextNotesChange={setOrderVoiceNotes}
                title="Add Order Voice Instructions"
                subtitle="Leave delivery, packaging or urgent artwork voice notes"
                notesLabel="Order / Delivery Note (EN/HI dictation supported):"
                notesPlaceholder="e.g. Call before Delhivery delivery, deliver before 5 PM, pack sizes separately."
                compact
              />

              {/* Limited-Time 5% OFF Checkout Saver Countdown Strip */}
              {recoveryCoupon && recoveryCountdown && (
                <div className="rounded-xl border border-[#FF7A00]/45 bg-amber-50/90 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock className="w-4 h-4 text-[#FF7A00] shrink-0" />
                    <div className="min-w-0">
                      <div className="font-bold text-[#071B35] truncate">
                        5% OFF Saver Active ({recoveryCoupon.code})
                      </div>
                      <div className="text-[11px] text-zinc-600 font-mono">
                        Expires in {recoveryCountdown}
                      </div>
                    </div>
                  </div>
                  {appliedPromoCode !== 'SAVE5NOW' && (
                    <button
                      type="button"
                      onClick={() => handleApplyPromoCode('SAVE5NOW')}
                      className="px-2.5 py-1 rounded-lg bg-[#FF7A00] text-white text-[11px] font-bold shrink-0 cursor-pointer"
                    >
                      Apply 5%
                    </button>
                  )}
                </div>
              )}

              {/* Promo Code Input & Quick WELCOME10 Chip */}
              <div className="bg-[#FAF9FD] border border-[#ECEAF3] rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold text-[#0B0B0D]">
                  <span className="inline-flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span>Promo / New Customer Code</span>
                  </span>
                  {!appliedPromoCode && (
                    <button
                      type="button"
                      onClick={() => handleApplyPromoCode('WELCOME10')}
                      className="text-[11px] font-mono font-bold text-[#FF7A00] hover:underline cursor-pointer"
                    >
                      Tap to apply WELCOME10
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code (e.g. WELCOME10)"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyPromoCode();
                      }
                    }}
                    className="flex-1 px-3 py-2 text-xs font-mono uppercase bg-white border border-zinc-300 rounded-lg focus:border-[#FF7A00] outline-none"
                  />
                  {appliedPromoCode ? (
                    <button
                      type="button"
                      onClick={handleRemovePromoCode}
                      className="px-3 py-2 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-800 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleApplyPromoCode()}
                      className="px-4 py-2 rounded-lg bg-[#0B0B0D] hover:bg-zinc-800 text-white text-xs font-semibold cursor-pointer"
                    >
                      Apply
                    </button>
                  )}
                </div>

                {promoFeedback && (
                  <p
                    className={`text-[11px] font-semibold ${
                      promoFeedback.type === 'success' ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {promoFeedback.text}
                  </p>
                )}
              </div>

              {/* Cost Breakdown */}
              <div className="space-y-2 text-xs text-zinc-600 pt-2">
                <div className="flex justify-between">
                  <span>Product Subtotal:</span>
                  <span className="font-mono text-zinc-800">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>
                      Promo Discount ({appliedPromoCode}
                      {appliedPromoCode === 'SAVE5NOW' || appliedPromoCode === 'TEQQNO5'
                        ? ' · 5% OFF Limited-Time'
                        : appliedPromoCode === 'TEQQNOBULK'
                          ? ' · Bulk Voucher'
                          : ' · 10% OFF'}):
                    </span>
                    <span className="font-mono">-₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Pan-India Air Logistics:</span>
                  <span className="font-mono">
                    {shippingFee === 0 ? <strong className="text-emerald-600 font-semibold">FREE</strong> : `₹${shippingFee}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>GST (18% ITC Credit):</span>
                  <span className="font-mono text-zinc-800">+₹{gstAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="pt-3 border-t border-zinc-200 flex justify-between font-display font-bold text-base text-[#0B0B0D]">
                  <span>Total Order Value:</span>
                  <span className="font-mono">₹{total.toLocaleString('en-IN')}</span>
                </div>

                {/* Paid Now vs Balance Before Dispatch */}
                <div className="bg-[#FAF9FD] border border-[#ECEAF3] rounded-xl p-3 space-y-1.5 mt-2">
                  <div className="flex justify-between font-display font-bold text-base text-[#0B0B0D]">
                    <span>{paymentMode === 'Partial Payment (50% Advance)' ? 'Pay 50% Advance Now:' : 'Payable Now (100% Prepaid):'}</span>
                    <span className="text-[#FF7A00] font-mono">₹{payableNow.toLocaleString('en-IN')}</span>
                  </div>
                  {balanceDue > 0 && (
                    <div className="flex justify-between text-[11px] text-amber-800 font-semibold">
                      <span>Balance Before Dispatch (No COD):</span>
                      <span className="font-mono">₹{balanceDue.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Delhivery Area Verification Summary before Pay/Confirm CTA */}
              {pincodeStatus && (
                <div
                  className={`rounded-xl border px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 ${
                    pincodeStatus.serviceable
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Truck className={`w-4 h-4 shrink-0 ${pincodeStatus.serviceable ? 'text-emerald-600' : 'text-red-600'}`} />
                    <span className="truncate font-medium">
                      {pincodeStatus.serviceable
                        ? `Delhivery to ${pincodeStatus.city || city} (${pincodeStatus.pincode}) · ${pincodeStatus.estimatedDays || '2–4 business days'}`
                        : `Pincode ${pincodeStatus.pincode} is not serviceable — update in Step 2`}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-[#FF7A00] hover:bg-[#e06c00] text-white font-display font-semibold py-4 px-4 rounded-xl shadow-lg shadow-[#FF7A00]/25 transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 text-sm disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{uploadStepStatus || 'Processing order...'}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>
                      {razorpayStatus?.configured
                        ? `Pay ₹${payableNow.toLocaleString('en-IN')} via Razorpay`
                        : `Confirm Order (₹${payableNow.toLocaleString('en-IN')} ${
                            paymentMode === 'Partial Payment (50% Advance)' ? '50% Advance' : 'Prepaid'
                          })`}
                    </span>
                  </>
                )}
              </button>


              <div className="space-y-2 pt-2 text-[11px] text-zinc-500 text-center">
                <p>🔒 100% Satisfaction Guarantee: We do not start factory manufacturing until you inspect and approve your 1:1 digital proof.</p>
              </div>

            </div>

          </div>

        </form>

      </div>

      {/* Checkout Drop / Payment Back-Out Limited-Time 5% OFF Recovery Modal */}
      {recoveryOfferModal && (
        <CheckoutRecoveryOfferModal
          isOpen={recoveryOfferModal.isOpen}
          onClose={() => setRecoveryOfferModal(null)}
          onApplyCouponAndContinue={(code) => {
            handleApplyPromoCode(code);
            setRecoveryOfferModal(null);
          }}
          onContinueWithoutApplying={() => {
            setRecoveryOfferModal(null);
            onBackToCart();
          }}
          couponCode="SAVE5NOW"
          discountPercent={5}
          expiresAt={recoveryOfferModal.expiresAt}
          subtotal={subtotal}
          triggerReason={recoveryOfferModal.triggerReason}
          customerPhone={phone}
          customerName={fullName}
          whatsappStatusMessage={recoveryOfferModal.whatsappStatusMessage}
          whatsappSimulated={recoveryOfferModal.whatsappSimulated}
          leavingCheckout={recoveryOfferModal.leavingCheckout}
        />
      )}
    </div>
  );
};

