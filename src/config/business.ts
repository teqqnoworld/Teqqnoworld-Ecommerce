/**
 * Official Business Configuration for TeqqnoWorld E-Commerce Platform.
 * Single source of truth for all corporate address, contact numbers, email, and Google Maps info.
 */

export const BUSINESS_CONFIG = {
  // Brand & Legal Identity
  name: 'TeqqnoWorld',
  legalName: 'TeqqnoWorld',
  brandName: 'TeqqnoWorld',
  tagline: "India's Custom Printing & Corporate Merchandise Platform",

  // Official Business Address
  address: {
    shopNo: 'Shop No. 504',
    floor: '5th Floor',
    plotNo: 'Plot No. 100 & 101',
    road: 'Mallampet Road',
    landmark: 'Above Vijetha Super Market',
    locality: 'Bachupally',
    city: 'Hyderabad',
    state: 'Telangana',
    stateCode: '36',
    pincode: '500090',
    country: 'India',
    countryCode: 'IN',
    
    // Complete official formatted address as requested
    full: 'Shop No. 504, 5th Floor, Plot No. 100 & 101, Mallampet Road, Above Vijetha Super Market, Bachupally, Hyderabad, Telangana – 500090, India.',
    
    // Line-broken formatting for invoices & headers
    line1: 'Shop No. 504, 5th Floor, Plot No. 100 & 101, Mallampet Road, Above Vijetha Super Market',
    line2: 'Bachupally, Hyderabad, Telangana – 500090, India',
    
    // Concise hub identifier for logistics & SLAs
    dispatchHub: 'Bachupally Facility, Hyderabad',
  },

  // Official Contact Channels
  contact: {
    // Official Mobile & Telephone
    phone: '+91 91245 60673',
    phoneRaw: '+919124560673',
    phoneDigits: '919124560673',
    telLink: 'tel:+919124560673',

    // Official WhatsApp Business Channel
    whatsapp: '+91 91245 60673',
    whatsappDigits: '919124560673',
    whatsappLink: 'https://wa.me/919124560673',

    // Official Email Addresses (both active & verified)
    email: 'teqqnoworld@gmail.com',
    secondaryEmail: 'info@teqqnoworld.com',
    emails: ['info@teqqnoworld.com', 'teqqnoworld@gmail.com'],
    mailtoLink: 'mailto:teqqnoworld@gmail.com',
    secondaryMailtoLink: 'mailto:info@teqqnoworld.com',

    // Web & Domain
    websiteUrl: 'https://teqqnoworld.com',
    canonicalUrl: 'https://teqqnoworld.com',

    // Operating Hours
    hours: 'Monday to Saturday, 9:30 AM to 6:30 PM IST (Excluding National Holidays)',
  },

  // Official Social Media Channels
  social: {
    facebook: 'https://www.facebook.com/teqqnoworld',
    instagram: 'https://www.instagram.com/teqqnoworld',
    linkedin: 'https://www.linkedin.com/company/teqqnoworld',
    youtube: 'https://www.youtube.com/@teqqnoworld',
    pinterest: 'https://www.pinterest.com/teqqnoworld',
  },

  // Google Maps Location & Navigation
  maps: {
    query: 'Shop No. 504, 5th Floor, Plot No. 100 & 101, Mallampet Road, Above Vijetha Super Market, Bachupally, Hyderabad, Telangana 500090, India',
    directionsUrl: 'https://www.google.com/maps/search/?api=1&query=Shop+No.+504%2C+5th+Floor%2C+Plot+No.+100+%26+101%2C+Mallampet+Road%2C+Above+Vijetha+Super+Market%2C+Bachupally%2C+Hyderabad%2C+Telangana+%E2%80%93+500090%2C+India',
  },

  // Statutory & Regulatory Declarations
  legal: {
    jurisdiction: 'Courts of competent jurisdiction in Hyderabad, Telangana, India',
    jurisdictionCity: 'Hyderabad, Telangana, India',
    grievanceOfficerPlaceholder: 'Nodal Grievance Officer, TeqqnoWorld, Bachupally, Hyderabad',
    cinPlaceholder: '[CIN: Subject to MCA Certificate of Incorporation]',
    gstinPlaceholder: '[GSTIN: Subject to Certificate of Registration - State: Telangana (36)]',
    gstState: 'Telangana',
    gstStateCode: '36',
    gstPrincipalPlaceOfBusiness:
      '5th Floor, Plot No-14, Ameenpur Road, Behind HDFC Bank, Suraksha Colony, Hyderabad, Rangareddy, Telangana – 502032.',
    legalEntityPlaceholder: 'TeqqnoWorld',
    reportingWindowPlaceholder: '48 Hours from physical delivery timestamp as confirmed by courier partner',
    refundSlaPlaceholder: '5 to 7 Working Days post quality audit and bank authorization',
  }
} as const;

/**
 * Helper to build pre-filled WhatsApp click-to-chat links
 */
export function getWhatsAppLink(prefilledText?: string): string {
  if (!prefilledText) return BUSINESS_CONFIG.contact.whatsappLink;
  return `https://wa.me/${BUSINESS_CONFIG.contact.whatsappDigits}?text=${encodeURIComponent(prefilledText)}`;
}

/**
 * Re-export flat constants for rapid component consumption
 */
export const OFFICIAL_BUSINESS_NAME = BUSINESS_CONFIG.name;
export const OFFICIAL_BUSINESS_ADDRESS = BUSINESS_CONFIG.address.full;
export const OFFICIAL_PHONE_NUMBER = BUSINESS_CONFIG.contact.phone;
export const OFFICIAL_TEL_LINK = BUSINESS_CONFIG.contact.telLink;
export const OFFICIAL_WHATSAPP_NUMBER = BUSINESS_CONFIG.contact.whatsapp;
export const OFFICIAL_WHATSAPP_LINK = BUSINESS_CONFIG.contact.whatsappLink;
export const OFFICIAL_EMAIL = BUSINESS_CONFIG.contact.email;
export const OFFICIAL_MAILTO_LINK = BUSINESS_CONFIG.contact.mailtoLink;
export const OFFICIAL_MAPS_DIRECTIONS = BUSINESS_CONFIG.maps.directionsUrl;
