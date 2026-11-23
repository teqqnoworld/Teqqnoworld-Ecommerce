export interface LegalPageMeta {
  id: string;
  route: string;
  title: string;
  shortTitle: string;
  description: string;
  lastUpdated: string;
}

export const LEGAL_PAGES: LegalPageMeta[] = [
  {
    id: 'privacy-policy',
    route: '/privacy-policy',
    title: 'Privacy Policy',
    shortTitle: 'Privacy',
    description: 'How TeqqnoWorld collects, uses, protects, and handles your personal information, artwork assets, and order details.',
    lastUpdated: 'October 25, 2026',
  },
  {
    id: 'terms-and-conditions',
    route: '/terms-and-conditions',
    title: 'Terms and Conditions',
    shortTitle: 'Terms',
    description: 'The legal terms, intellectual property covenants, proof sign-off rules, and conditions governing the use of TeqqnoWorld.',
    lastUpdated: 'October 25, 2026',
  },
  {
    id: 'shipping-policy',
    route: '/shipping-policy',
    title: 'Shipping and Delivery Policy',
    shortTitle: 'Shipping & Delivery',
    description: 'Production turnaround stages, dispatch timelines, serviceable pin codes, tracking AWBs, and delivery terms.',
    lastUpdated: 'October 25, 2026',
  },
  {
    id: 'cancellation-refund-policy',
    route: '/cancellation-refund-policy',
    title: 'Cancellation and Refund Policy',
    shortTitle: 'Cancellation & Refund',
    description: 'Clear rules for pre-production cancellations, custom merchandise exceptions, defective claims, and refund processing.',
    lastUpdated: 'October 25, 2026',
  },
  {
    id: 'return-replacement-policy',
    route: '/return-replacement-policy',
    title: 'Return and Replacement Policy',
    shortTitle: 'Return & Replacement',
    description: 'Official No Return / Replacement Only policy covering damaged, cracked, defective, or incorrect items reported within 24 hours with unboxing video proof.',
    lastUpdated: 'November 23, 2026',
  },
  {
    id: 'payment-policy',
    route: '/payment-policy',
    title: 'Payment Policy',
    shortTitle: 'Payment Policy',
    description: 'Supported payment methods, payment gateway security, corporate PO terms, and handling of failed transactions.',
    lastUpdated: 'October 25, 2026',
  },
  {
    id: 'pricing-and-taxes',
    route: '/pricing-and-taxes',
    title: 'Pricing, Taxes and GST Information',
    shortTitle: 'Pricing & Taxes',
    description: 'Pricing breakdown, volume discount slabs, 18% GST calculation, SAC 9989 classification, and B2B Input Tax Credit (ITC).',
    lastUpdated: 'October 25, 2026',
  },
  {
    id: 'cookie-policy',
    route: '/cookie-policy',
    title: 'Cookie Policy',
    shortTitle: 'Cookie Policy',
    description: 'Detailed explanation of essential local storage cookies used for cart persistence, session state, and user preferences.',
    lastUpdated: 'October 25, 2026',
  },
  {
    id: 'contact-us',
    route: '/contact-us',
    title: 'Contact Us & Customer Support',
    shortTitle: 'Contact Us',
    description: 'Official corporate communication channels, grievance officer contact, support desk, and interactive enquiry form.',
    lastUpdated: 'October 25, 2026',
  },
];

import { BUSINESS_CONFIG } from '../config/business';

export const BUSINESS_DETAILS = {
  brandName: BUSINESS_CONFIG.brandName,
  legalEntityPlaceholder: BUSINESS_CONFIG.legal.legalEntityPlaceholder,
  websiteUrl: BUSINESS_CONFIG.contact.websiteUrl,
  primaryEmail: BUSINESS_CONFIG.contact.secondaryEmail,
  alternativeEmail: BUSINESS_CONFIG.contact.email,
  supportEmail: BUSINESS_CONFIG.contact.secondaryEmail,
  privacyEmail: BUSINESS_CONFIG.contact.email,
  phoneHelp: BUSINESS_CONFIG.contact.phone,
  whatsappHelp: BUSINESS_CONFIG.contact.whatsapp,
  facilityAddress: BUSINESS_CONFIG.address.full,
  registeredOfficePlaceholder: BUSINESS_CONFIG.address.full,
  cinPlaceholder: BUSINESS_CONFIG.legal.cinPlaceholder,
  gstinPlaceholder: BUSINESS_CONFIG.legal.gstinPlaceholder,
  grievanceOfficerPlaceholder: BUSINESS_CONFIG.legal.grievanceOfficerPlaceholder,
  supportHours: BUSINESS_CONFIG.contact.hours,
  refundSlaPlaceholder: BUSINESS_CONFIG.legal.refundSlaPlaceholder,
  reportingWindowPlaceholder: BUSINESS_CONFIG.legal.reportingWindowPlaceholder,
  jurisdiction: BUSINESS_CONFIG.legal.jurisdiction,
};
