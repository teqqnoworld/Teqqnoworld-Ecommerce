import React from 'react';
import { LegalLayout } from './LegalLayout';
import { BUSINESS_CONFIG, getWhatsAppLink } from '../../config/business';
import { WhatsAppIcon } from '../WhatsAppIcon';
import {
  ShieldAlert,
  Clock,
  Video,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  FileText,
  Scale,
  PackageCheck,
  ArrowRight,
} from 'lucide-react';

interface LegalViewProps {
  onNavigate: (route: string) => void;
}

export const ReturnReplacementPolicyView: React.FC<LegalViewProps> = ({ onNavigate }) => {
  const toc = [
    { id: 'official-policy', title: '1. No Return / Replacement Only Policy' },
    { id: 'replacement-eligibility', title: '2. When Replacement May Be Considered' },
    { id: 'complaint-deadline', title: '3. 24-Hour Complaint Deadline' },
    { id: 'unboxing-video', title: '4. Unboxing Video Guidelines & Rights' },
    { id: 'reporting-process', title: '5. How to Report an Issue' },
    { id: 'non-eligible-cases', title: '6. Non-Eligible Scenarios' },
    { id: 'support-channels', title: '7. Official Customer Support Channels' },
  ];

  const primaryEmail = BUSINESS_CONFIG.contact.secondaryEmail; // info@teqqnoworld.com
  const alternativeEmail = BUSINESS_CONFIG.contact.email; // teqqnoworld@gmail.com
  const whatsappDisplay = BUSINESS_CONFIG.contact.whatsapp; // +91 91245 60673
  const phoneDisplay = BUSINESS_CONFIG.contact.phone; // +91 91245 60673
  const replacementWhatsAppUrl = getWhatsAppLink(
    'Hello TeqqnoWorld Support, I would like to report a damaged/defective/incorrect item for replacement.\nOrder ID: \nIssue Description: \n(Attaching unboxing video proof)'
  );
  const emailSubject = encodeURIComponent('Replacement Request - Order ID [Enter Order ID]');
  const emailBody = encodeURIComponent(
    'Hello TeqqnoWorld Customer Care,\n\nI would like to report an issue with my delivered parcel within 24 hours of receipt.\n\nOrder ID:\nDescription of the issue:\nUnboxing video / supporting evidence attached.\n'
  );

  const handleInternalLink = (e: React.MouseEvent<HTMLAnchorElement>, route: string) => {
    if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      e.preventDefault();
      onNavigate(route);
    }
  };

  return (
    <LegalLayout
      currentRoute="/return-replacement-policy"
      title="Return and Replacement Policy"
      description="Official TeqqnoWorld No Return / Replacement Only policy covering eligible damaged, cracked, defective, or incorrect items, our 24-hour reporting window, unboxing video guidance, and verified customer support channels."
      lastUpdated="November 23, 2026"
      tableOfContents={toc}
      onNavigate={onNavigate}
    >
      <div className="space-y-8 text-slate-700">
        {/* At-a-Glance Policy Summary Strip (Dark Navy + Orange + White) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 not-prose">
          <div className="rounded-2xl bg-[#071B35] text-white p-4 border border-[#0E2A4F] shadow-xs">
            <div className="flex items-center gap-2 text-[#FF7A00] text-xs font-bold uppercase tracking-wider mb-1.5">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Policy Type</span>
            </div>
            <div className="font-display font-bold text-sm sm:text-base text-white">
              No Return / Replacement Only
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              No returns or refunds for change-of-mind reasons.
            </p>
          </div>

          <div className="rounded-2xl bg-[#FFF6EE] text-[#071B35] p-4 border border-[#FF7A00]/35 shadow-xs">
            <div className="flex items-center gap-2 text-[#FF7A00] text-xs font-bold uppercase tracking-wider mb-1.5">
              <Clock className="w-4 h-4 shrink-0" />
              <span>Complaint Deadline</span>
            </div>
            <div className="font-display font-bold text-sm sm:text-base text-[#071B35]">
              Within 24 Hours of Receipt
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Report damage, cracks, defects, or wrong items promptly.
            </p>
          </div>

          <div className="rounded-2xl bg-white text-[#071B35] p-4 border border-slate-200 shadow-xs">
            <div className="flex items-center gap-2 text-[#FF7A00] text-xs font-bold uppercase tracking-wider mb-1.5">
              <Video className="w-4 h-4 shrink-0" />
              <span>Unboxing Video Proof</span>
            </div>
            <div className="font-display font-bold text-sm sm:text-base text-[#071B35]">
              Clear, Continuous Video
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Record parcel opening while preserving applicable consumer rights.
            </p>
          </div>
        </div>

        {/* 1. Official Return & Replacement Policy */}
        <section id="official-policy">
          <h2 className="text-xl font-bold text-[#071B35] border-b border-slate-200 pb-2 mb-3">
            1. Official Policy: No Return / Replacement Only
          </h2>
          <p className="mb-3 text-sm leading-relaxed">
            <strong>TeqqnoWorld follows a strict No Return / Replacement Only policy.</strong> Because our products are prepared and customized to customer order specifications, customers <strong>cannot return products or request refunds for change-of-mind reasons</strong>.
          </p>
          <div className="not-prose rounded-xl bg-[#071B35] text-white p-4 sm:p-5 border-l-4 border-[#FF7A00] space-y-2">
            <div className="flex items-center gap-2 text-[#FF7A00] font-bold text-xs sm:text-sm uppercase tracking-wide">
              <Scale className="w-4 h-4 shrink-0" />
              <span>Verification &amp; Consumer Protection Notice</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              All replacement requests are subject to verification by the TeqqnoWorld quality and support team and are administered in accordance with applicable Indian consumer protection laws, including the Consumer Protection Act, 2019.
            </p>
          </div>
        </section>

        {/* 2. Replacement Eligibility */}
        <section id="replacement-eligibility">
          <h2 className="text-xl font-bold text-[#071B35] border-b border-slate-200 pb-2 mb-3">
            2. When Replacement May Be Considered
          </h2>
          <p className="mb-3 text-sm leading-relaxed">
            A replacement may be considered after verification when a customer receives any of the following:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 not-prose mb-3">
            {[
              {
                title: 'Damaged Product',
                desc: 'Physical damage sustained prior to or during delivery that compromises the usability or appearance of the product.',
              },
              {
                title: 'Cracked or Broken Product',
                desc: 'Visible cracks, fractures, shattered ceramics, or broken structural frames/hardware upon parcel opening.',
              },
              {
                title: 'Defective Product',
                desc: 'Manufacturing or material defects that make the delivered product faulty or unfit for its intended use.',
              },
              {
                title: 'Incorrect or Different Product',
                desc: 'An item received that is different from the product, variant, or specification confirmed in your order.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200"
              >
                <CheckCircle2 className="w-4 h-4 text-[#FF7A00] shrink-0 mt-0.5" />
                <div>
                  <div className="font-display font-bold text-xs sm:text-sm text-[#071B35]">
                    {item.title}
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. 24-Hour Complaint Deadline */}
        <section id="complaint-deadline">
          <h2 className="text-xl font-bold text-[#071B35] border-b border-slate-200 pb-2 mb-3">
            3. 24-Hour Complaint Reporting Deadline
          </h2>
          <div className="not-prose rounded-2xl bg-gradient-to-r from-[#FFF4E8] to-white border-2 border-[#FF7A00] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 mb-3">
            <div className="w-12 h-12 rounded-xl bg-[#FF7A00] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-[#FF7A00]">
                Important Reporting Window
              </div>
              <h3 className="font-display font-extrabold text-base sm:text-lg text-[#071B35] mt-0.5">
                Report Issues Within 24 Hours of Receiving the Parcel
              </h3>
              <p className="text-xs sm:text-sm text-slate-700 mt-1 leading-relaxed">
                Customers must report any damage, cracks, breakage, manufacturing defects, or incorrect products <strong>within 24 hours of parcel delivery</strong> so our team can verify the issue promptly and coordinate with our courier partners.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Unboxing Video Guidelines */}
        <section id="unboxing-video">
          <h2 className="text-xl font-bold text-[#071B35] border-b border-slate-200 pb-2 mb-3">
            4. Unboxing Video Guidelines
          </h2>
          <p className="mb-3 text-sm leading-relaxed">
            To help our team verify transit damage or incorrect dispatches quickly and transparently, customers should record a <strong>clear, continuous unboxing video</strong> while opening the delivered parcel.
          </p>

          <div className="not-prose bg-slate-50 rounded-xl p-4 sm:p-5 border border-slate-200 space-y-3 mb-4">
            <div className="flex items-center gap-2 font-display font-bold text-sm text-[#071B35]">
              <Video className="w-4 h-4 text-[#FF7A00] shrink-0" />
              <span>What Your Unboxing Video Should Clearly Show:</span>
            </div>
            <ol className="space-y-2.5 text-xs sm:text-sm text-slate-700">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#071B35] text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  <strong>Before Opening:</strong> The sealed outer parcel, shipping label, and exterior condition before cutting or tearing the packaging.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#071B35] text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  <strong>Complete Opening Process:</strong> Continuous, unedited footage of opening the package from start to finish without cuts or pauses.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#071B35] text-white font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  <strong>Received Product &amp; Issue:</strong> A clear, well-lit view of the received product showing the reported damage, crack, breakage, defect, or incorrect item.
                </span>
              </li>
            </ol>
          </div>

          <div className="not-prose rounded-xl bg-amber-50/70 border border-amber-200 p-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <strong className="text-[#071B35]">Fair Review &amp; Consumer Rights:</strong> While a clear, continuous unboxing video is strongly recommended to expedite verification, TeqqnoWorld does <strong>not</strong> enforce an automatic, unconditional rejection solely because a customer is unable to provide a video. If an unboxing video is unavailable, please still contact our support team within 24 hours with your Order ID, issue details, and clear photographs so we can fairly review your claim in accordance with applicable consumer protection laws.
          </div>
        </section>

        {/* 5. Customer-Friendly Step-by-Step Reporting Process */}
        <section id="reporting-process">
          <h2 className="text-xl font-bold text-[#071B35] border-b border-slate-200 pb-2 mb-3">
            5. How to Report a Replacement Request
          </h2>
          <p className="mb-4 text-sm leading-relaxed">
            Follow these three simple steps within 24 hours of receiving your parcel:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 not-prose">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FF7A00]">
                <FileText className="w-3.5 h-3.5" />
                <span>Step 1 · Prepare Details</span>
              </div>
              <h3 className="font-display font-bold text-sm text-[#071B35]">
                Gather Required Info
              </h3>
              <ul className="text-xs text-slate-600 space-y-1 list-disc pl-4">
                <li>Your <strong>Order ID</strong></li>
                <li>Clear <strong>description of the issue</strong></li>
                <li><strong>Unboxing video proof</strong> (and/or clear photos)</li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FF7A00]">
                <Clock className="w-3.5 h-3.5" />
                <span>Step 2 · Contact Within 24h</span>
              </div>
              <h3 className="font-display font-bold text-sm text-[#071B35]">
                Reach Official Support
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Send your details within 24 hours of parcel receipt via our official WhatsApp, customer care phone, or email channels below.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FF7A00]">
                <PackageCheck className="w-3.5 h-3.5" />
                <span>Step 3 · Verification</span>
              </div>
              <h3 className="font-display font-bold text-sm text-[#071B35]">
                Review &amp; Replacement
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Our support desk verifies your submission against order records and coordinates the approved replacement cleanly.
              </p>
            </div>
          </div>
        </section>

        {/* 6. Non-Eligible Scenarios */}
        <section id="non-eligible-cases">
          <h2 className="text-xl font-bold text-[#071B35] border-b border-slate-200 pb-2 mb-3">
            6. Situations Not Eligible for Return or Replacement
          </h2>
          <p className="mb-3 text-sm leading-relaxed">
            Subject to applicable consumer protection laws, requests are generally not eligible under the following circumstances:
          </p>
          <ul className="space-y-2 text-xs sm:text-sm text-slate-600 not-prose">
            {[
              {
                label: 'Change-of-Mind Requests:',
                text: 'Returning items or requesting refunds because of subjective preference changes after order confirmation or delivery.',
              },
              {
                label: 'Approved Custom Specifications:',
                text: 'Custom logos, spellings, colour choices, or size selections that were produced accurately according to the customer’s confirmed order or approved digital proof.',
              },
              {
                label: 'Post-Delivery Damage or Misuse:',
                text: 'Damage resulting from customer mishandling, unauthorized alterations, or improper laundering/care after delivery.',
              },
              {
                label: 'Claims Reported After 24 Hours:',
                text: 'Transit damage or incorrect-item reports raised after the 24-hour reporting window from delivery, except where protected by applicable statutory rights.',
              },
            ].map((item) => (
              <li
                key={item.label}
                className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80"
              >
                <XCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-[#071B35]">{item.label}</strong> {item.text}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 7. Official Customer Support Channels */}
        <section id="support-channels">
          <h2 className="text-xl font-bold text-[#071B35] border-b border-slate-200 pb-2 mb-3">
            7. Official Customer Support Channels
          </h2>
          <p className="mb-4 text-sm leading-relaxed">
            To submit a replacement request within 24 hours of parcel receipt, contact TeqqnoWorld using any of our official support channels below and share your <strong>Order ID</strong>, a <strong>description of the issue</strong>, and your <strong>unboxing video proof</strong>:
          </p>

          <div className="not-prose rounded-2xl bg-[#071B35] text-white p-5 sm:p-6 border border-[#0E2A4F] shadow-sm space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* WhatsApp */}
              <a
                href={replacementWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-4 rounded-xl bg-white/8 hover:bg-white/14 border border-white/15 hover:border-[#25D366]/60 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#25D366] text-white flex items-center justify-center shrink-0">
                  <WhatsAppIcon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#25D366]">
                    Official WhatsApp Support
                  </div>
                  <div className="font-display font-bold text-sm sm:text-base text-white mt-0.5">
                    {whatsappDisplay}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 inline-flex items-center gap-1 group-hover:text-white">
                    <span>Send Order ID &amp; unboxing video</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </a>

              {/* Customer Care Mobile */}
              <a
                href={BUSINESS_CONFIG.contact.telLink}
                className="flex items-start gap-3 p-4 rounded-xl bg-white/8 hover:bg-white/14 border border-white/15 hover:border-[#FF7A00]/60 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-[#FF7A00] text-white flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#FF7A00]">
                    Customer Care Mobile
                  </div>
                  <div className="font-display font-bold text-sm sm:text-base text-white mt-0.5">
                    {phoneDisplay}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 group-hover:text-white">
                    Call for immediate reporting guidance
                  </div>
                </div>
              </a>

              {/* Primary Email */}
              <a
                href={`mailto:${primaryEmail}?subject=${emailSubject}&body=${emailBody}`}
                className="flex items-start gap-3 p-4 rounded-xl bg-white/8 hover:bg-white/14 border border-white/15 hover:border-[#FF7A00]/60 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/15 text-[#FF7A00] flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#FF7A00]">
                    Primary Email
                  </div>
                  <div className="font-display font-bold text-sm text-white mt-0.5 break-all">
                    {primaryEmail}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 group-hover:text-white">
                    Email Order ID, issue details &amp; video
                  </div>
                </div>
              </a>

              {/* Alternative Email */}
              <a
                href={`mailto:${alternativeEmail}?subject=${emailSubject}&body=${emailBody}`}
                className="flex items-start gap-3 p-4 rounded-xl bg-white/8 hover:bg-white/14 border border-white/15 hover:border-[#FF7A00]/60 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-white/15 text-[#FF7A00] flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
                    Alternative Email
                  </div>
                  <div className="font-display font-bold text-sm text-white mt-0.5 break-all">
                    {alternativeEmail}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5 group-hover:text-white">
                    Official alternate support inbox
                  </div>
                </div>
              </a>
            </div>

            <div className="pt-3 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-300">
              <span>
                <strong className="text-white">Support Hours:</strong> {BUSINESS_CONFIG.contact.hours}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="/shipping-policy"
                  onClick={(e) => handleInternalLink(e, '/shipping-policy')}
                  className="text-[#FF7A00] hover:underline font-medium"
                >
                  Shipping Policy &rarr;
                </a>
                <a
                  href="/cancellation-refund-policy"
                  onClick={(e) => handleInternalLink(e, '/cancellation-refund-policy')}
                  className="text-[#FF7A00] hover:underline font-medium"
                >
                  Cancellation Policy &rarr;
                </a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </LegalLayout>
  );
};
