import React, { useState } from 'react';
import { triggerCelebration } from '../services/celebrationService';
import { 
  Calendar, 
  Clock, 
  User, 
  Mail, 
  Phone, 
  Building, 
  Video, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Send, 
  Database, 
  Copy, 
  Check, 
  ExternalLink,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { 
  saveAppointmentToSupabase, 
  AppointmentBookingData, 
  RECOMMENDED_SUPABASE_SQL, 
  SUPABASE_PROJECT_ID 
} from '../lib/supabase';
import { BUSINESS_CONFIG, getWhatsAppLink } from '../config/business';

interface AppointmentBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultService?: string;
}

export const AppointmentBookingModal: React.FC<AppointmentBookingModalProps> = ({
  isOpen,
  onClose,
  defaultService = 'Corporate Apparel Consultation (Polo / Hoodies)',
}) => {
  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  
  // Date & Time defaults
  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [appointmentDate, setAppointmentDate] = useState(getTomorrowDate());
  const [appointmentTime, setAppointmentTime] = useState('11:00 AM');
  const [serviceType, setServiceType] = useState(defaultService);
  const [meetingMode, setMeetingMode] = useState('Google Meet Video Call');
  const [estimatedQuantity, setEstimatedQuantity] = useState<number | ''>(100);
  const [notes, setNotes] = useState('');

  // Status State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedTable, setSavedTable] = useState<string | null>(null);
  const [needsSqlSetup, setNeedsSqlSetup] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [bookingRef, setBookingRef] = useState('');

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(RECOMMENDED_SUPABASE_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setNeedsSqlSetup(false);

    if (!name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid work or personal email address.');
      return;
    }
    if (!phone.trim() || phone.replace(/[^0-9]/g, '').length < 10) {
      setErrorMsg('Please enter a valid 10-digit phone number for appointment confirmation.');
      return;
    }
    if (!appointmentDate) {
      setErrorMsg('Please select a preferred appointment date.');
      return;
    }

    setIsSubmitting(true);
    const refCode = `APT-${Math.floor(100000 + Math.random() * 900000)}`;
    setBookingRef(refCode);

    const bookingData: AppointmentBookingData = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      company: company.trim() || undefined,
      appointmentDate,
      appointmentTime,
      serviceType,
      meetingMode,
      estimatedQuantity: estimatedQuantity ? Number(estimatedQuantity) : undefined,
      notes: notes.trim() || undefined,
    };

    // Save to local backup first
    try {
      const stored = JSON.parse(localStorage.getItem('teqqno_appointments') || '[]');
      stored.unshift({ ...bookingData, refCode, createdAt: new Date().toISOString() });
      localStorage.setItem('teqqno_appointments', JSON.stringify(stored));
    } catch (err) {
      console.warn('Local storage save error:', err);
    }

    // Submit to Supabase Backend
    try {
      const result = await saveAppointmentToSupabase(bookingData);
      
      if (result.success) {
        setSavedTable(result.tableUsed || 'appointments');
        setIsSuccess(true);
        triggerCelebration({
          level: 'premium',
          sound: 'celebration',
          eventKey: `appointment-booked:${refCode}`,
          action: 'appointment_booked',
        });
      } else {
        if (result.needsTableCreation) {
          setNeedsSqlSetup(true);
          setIsSuccess(true); // Show local-only notice + SQL setup instructions (not confirmed on server)
        } else {
          setErrorMsg(result.error || 'Failed to save to Supabase backend.');
        }
      }
    } catch (err: any) {
      console.error('Supabase submission failed:', err);
      setErrorMsg(err.message || 'Network error connecting to Supabase backend.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setPhone('');
    setCompany('');
    setNotes('');
    setIsSuccess(false);
    setNeedsSqlSetup(false);
    setErrorMsg('');
  };

  const timeSlots = [
    '10:00 AM',
    '11:00 AM',
    '12:30 PM',
    '02:30 PM',
    '04:00 PM',
    '05:30 PM',
    '07:00 PM',
  ];

  const serviceOptions = [
    'Corporate Apparel Consultation (Polo / Hoodies)',
    'Bulk Merchandise & Physical Swatch Review',
    'Pre-Press Logo Proofing & Color Matching',
    'Corporate Welcome Hampers & Custom Gift Boxes',
    'Event Displays (Canopy, Promo Tables & Standees)',
    'Urgent Fast-Track Dispatch Order (24-48 Hours)',
  ];

  const meetingModes = [
    { id: 'Google Meet Video Call', label: 'Google Meet (Online)', icon: Video },
    { id: 'Direct Phone Call', label: 'Direct Phone Call', icon: Phone },
    { id: 'WhatsApp Video', label: 'WhatsApp Video', icon: Video },
    { id: 'Studio / Factory Visit', label: 'Factory / Studio Visit (Hyderabad)', icon: Building },
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div 
        className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-zinc-100 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="bg-[#121316] text-white p-5 sm:p-6 relative">
          {/* Ambient Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF7A00]/20 rounded-full blur-3xl pointer-events-none" />

          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white bg-zinc-800/80 hover:bg-zinc-700 p-2 rounded-full transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FF7A00]/20 border border-[#FF7A00]/30 text-[#FF7A00] text-[11px] font-semibold tracking-wide uppercase">
              <Sparkles className="w-3 h-3" />
              1-on-1 Consultation
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
              <Database className="w-3 h-3" />
              Supabase Connected ({SUPABASE_PROJECT_ID})
            </span>
          </div>

          <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
            Schedule a Corporate Merchandising Appointment
          </h3>
          <p className="text-zinc-300 text-xs sm:text-sm mt-1 max-w-xl">
            Book a dedicated session with our apparel specialists for digital mockups, fabric hand-feel swatch samples, and bulk wholesale pricing.
          </p>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {isSuccess ? (
            <div className="py-6 space-y-5 text-center">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-md ${
                  needsSqlSetup
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {needsSqlSetup ? (
                  <AlertCircle className="w-9 h-9" />
                ) : (
                  <CheckCircle2 className="w-10 h-10" />
                )}
              </div>

              <div>
                <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider">
                  {needsSqlSetup ? 'Local Draft Reference (Not Synced)' : 'Booking Reference'}
                </span>
                <div className="text-2xl font-black text-slate-900 font-mono mt-0.5">
                  {bookingRef}
                </div>
                <h4 className="font-display font-bold text-lg text-slate-900 mt-2">
                  {needsSqlSetup
                    ? 'Saved Locally Only — Not Yet Confirmed on Server'
                    : 'Appointment Confirmed & Logged!'}
                </h4>
                <p className="text-xs sm:text-sm text-zinc-600 max-w-md mx-auto mt-1 leading-relaxed">
                  {needsSqlSetup ? (
                    <>
                      Your requested slot for{' '}
                      <strong className="text-slate-900">{appointmentDate}</strong> at{' '}
                      <strong className="text-slate-900">{appointmentTime}</strong> via{' '}
                      <strong className="text-slate-900">{meetingMode}</strong> could not be
                      saved to the server database yet and is stored only on this browser. Please
                      confirm via WhatsApp below or complete the database setup.
                    </>
                  ) : (
                    <>
                      Thank you, <strong>{name}</strong>! We have reserved your slot on{' '}
                      <strong className="text-slate-900">{appointmentDate}</strong> at{' '}
                      <strong className="text-slate-900">{appointmentTime}</strong> via{' '}
                      <strong className="text-slate-900">{meetingMode}</strong>.
                    </>
                  )}
                </p>
              </div>

              {/* Supabase Sync Feedback */}
              {savedTable && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left max-w-lg mx-auto flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <span>Saved to Supabase Backend</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-800 text-[10px] font-mono">
                        public.{savedTable}
                      </span>
                    </div>
                    <p className="text-emerald-800 mt-0.5">
                      Your booking row was successfully inserted into your Supabase project (<strong>{SUPABASE_PROJECT_ID}</strong>).
                    </p>
                  </div>
                </div>
              )}

              {/* If Table needs to be created in Supabase */}
              {needsSqlSetup && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left max-w-lg mx-auto space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <Database className="w-4 h-4" />
                    </div>
                    <div className="text-xs">
                      <div className="font-bold text-amber-950">
                        Supabase Connected: Table Setup Required
                      </div>
                      <p className="text-amber-800 mt-0.5">
                        Your project <strong>{SUPABASE_PROJECT_ID}</strong> is connected! The table <code>appointments</code> does not exist in your Supabase schema yet.
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-900 text-zinc-200 p-3 rounded-xl text-[11px] font-mono overflow-x-auto max-h-36">
                    <pre>{RECOMMENDED_SUPABASE_SQL}</pre>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL to Clipboard'}</span>
                    </button>
                    <a
                      href={`https://supabase.com/dashboard/project/${SUPABASE_PROJECT_ID}/sql/new`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Open Supabase SQL Editor</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href={`https://wa.me/${BUSINESS_CONFIG.contact.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hi TeqqnoWorld, I booked an appointment [${bookingRef}] for ${appointmentDate} at ${appointmentTime} (${meetingMode}). Name: ${name}, Service: ${serviceType}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <WhatsAppIcon className="w-4 h-4 text-white" />
                  <span>Confirm on WhatsApp ({BUSINESS_CONFIG.contact.whatsapp})</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-medium text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-[#FF7A00] font-semibold hover:underline"
                >
                  Book Another Appointment
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Consultation Type */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Consultation Focus / Topic <span className="text-red-500">*</span>
                </label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 focus:outline-hidden focus:border-[#FF7A00] focus:bg-white"
                >
                  {serviceOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date Selection */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span>Preferred Date</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 focus:outline-hidden focus:border-[#FF7A00] focus:bg-white"
                  />
                </div>

                {/* Time Slot Selection */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span>Preferred Time Slot</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={appointmentTime}
                    onChange={(e) => setAppointmentTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 focus:outline-hidden focus:border-[#FF7A00] focus:bg-white"
                  >
                    {timeSlots.map((time) => (
                      <option key={time} value={time}>
                        {time} (IST)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Meeting Mode Options */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Meeting Mode <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {meetingModes.map((mode) => {
                    const isSelected = meetingMode === mode.id;
                    const Icon = mode.icon;
                    return (
                      <button
                        type="button"
                        key={mode.id}
                        onClick={() => setMeetingMode(mode.id)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#FF7A00]/10 border-[#FF7A00] text-[#FF7A00] font-semibold shadow-2xs'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span className="text-[11px] text-center leading-tight">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Full Name</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 focus:outline-hidden focus:border-[#FF7A00] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Email Address</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ramesh@company.in"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 focus:outline-hidden focus:border-[#FF7A00] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Mobile / WhatsApp Number</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 focus:outline-hidden focus:border-[#FF7A00] focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Company Name (Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Acme Tech India"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 focus:outline-hidden focus:border-[#FF7A00] focus:bg-white"
                  />
                </div>
              </div>

              {/* Estimated Quantity & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Estimated Units</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={estimatedQuantity}
                    onChange={(e) => setEstimatedQuantity(e.target.value ? Number(e.target.value) : '')}
                    placeholder="e.g. 150"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 focus:outline-hidden focus:border-[#FF7A00] focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Specific Requirements or Questions (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Need physical fabric swatches and collar tipping samples"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-900 focus:outline-hidden focus:border-[#FF7A00] focus:bg-white"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#FF7A00] hover:bg-[#e06c00] active:scale-98 text-white font-display font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-[#FF7A00]/25 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-75 min-h-[48px]"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Appointment to Supabase...</span>
                    </>
                  ) : (
                    <>
                      <span>Confirm & Book Appointment</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              {/* Security & Supabase Notice */}
              <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1">
                <span className="flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  Synced with Supabase Backend ({SUPABASE_PROJECT_ID})
                </span>
                <span>No cancellation fee • Free consultation</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
