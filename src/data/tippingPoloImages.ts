import type { ProductColor } from '../types/index.ts';

export interface PoloVariant {
  name: string;
  shortLabel: string;
  hex: string;
  garmentHex: string;
  tippingHex: string;
  front: string;
  back: string;
}

export const TIPPING_POLO_IMAGE_MAP: Record<string, { front: string; back: string }> = {
  'Maroon / White Tipping': {
    front: '/assets/aistudio/Burgundy_Polo_with_White_Trim_0f8a4af9.webp',
    back: '/assets/aistudio/Maroon_Polo_Shirt_with_White_Trim_9485d379.webp',
  },
  'Navy Blue / White Tipping': {
    front: '/assets/aistudio/Navy_Polo_Shirt_with_White_Stripes_aedd082f.webp',
    back: '/assets/aistudio/Navy_Polo_Shirt_with_White_Tipping_1f8006d9.webp',
  },
  'Royal Blue / White Tipping': {
    front: '/assets/aistudio/Royal_Blue_Polo_with_White_Trim_2efbdf9b.webp',
    back: '/assets/aistudio/Cobalt_Blue_Polo_Shirt_Back_View_879cf8cd.webp',
  },
  'Apple Green / White Tipping': {
    front: '/assets/aistudio/Lime_Green_Striped_Collar_Polo_Shirt_45595fe7.webp',
    back: '/assets/aistudio/Lime_Green_Striped_Polo_Back_0d5f962a.webp',
  },
  'Turquoise / White Tipping': {
    front: '/assets/aistudio/Turquoise_Polo_with_White_Accents_293a7869.webp',
    back: '/assets/aistudio/Turquoise_Striped-Collar_Polo_Back_view_3f0aa153.webp',
  },
  'Black / Red Tipping': {
    front: '/assets/aistudio/Black_and_Red_Trim_Polo_Shirt_2de2260c.webp',
    back: '/assets/aistudio/Black_Polo_Shirt_with_Red_Striped_Trim_0d8ea50a.webp',
  },
  'Black / White Tipping': {
    front: '/assets/aistudio/Black_Polo_Shirt_with_White_Stripe_Details_d4a9bfd9.webp',
    back: '/assets/aistudio/Black_Striped-Collar_Polo_Shirt_Back_View_0240da1f.webp',
  },
  'White / Blue Tipping': {
    front: '/assets/aistudio/White_Polo_Shirt_with_Blue_Accents_73deb9e2.webp',
    back: '/assets/aistudio/White_Polo_Shirt_with_Blue_Striped_Details_bc9a0fc8.webp',
  },
  'White / Red Tipping': {
    front: '/assets/aistudio/White_Polo_Shirt_with_Red_Accents_1db646fb.webp',
    back: '/assets/aistudio/White_Polo_Shirt_Back_Mockup_75f870d7.webp',
  },
  'White / Black Tipping': {
    front: '/assets/aistudio/White_Polo_Shirt_with_Black_Stripe_Details-removebg-preview_b059ed2f.webp',
    back: '/assets/aistudio/Back_View_White_Polo_with_Black_Stripes_d0285f6a.webp',
  },
  'Air Force Blue / White Tipping': {
    front: '/assets/aistudio/Teal-Blue_Striped_Collar_Polo_Shirt_15ef3831.webp',
    back: '/assets/aistudio/Teal_Striped-Collar_Polo_Shirt_59e79a14.webp',
  },
  'Bottle Green / White Tipping': {
    front: '/assets/aistudio/Bottle_Green_Striped-Collar_Polo_Mockup_44fa00f7.webp',
    back: '/assets/aistudio/Forest_Green_Striped-Collar_Polo_Back_51e1b36f.webp',
  },
  'Charcoal Melange / White Tipping': {
    front: '/assets/aistudio/Charcoal_Striped_Collar_Polo_Shirt_f0c5cc08.webp',
    back: '/assets/aistudio/Charcoal_Polo_Shirt_Back_View_177343bd.webp',
  },
  'Grey Melange / Black Tipping': {
    front: '/assets/aistudio/Gray_Melange_Polo_Shirt_with_Contrast_Trim_29cef4d6.webp',
    back: '/assets/aistudio/Gray_Polo_Shirt_Back_View_Mockup_5e906dfe.webp',
  },
  'Red / White Tipping': {
    front: '/assets/aistudio/Red_Polo_Shirt_with_White_Accents_eaf6604d.webp',
    back: '/assets/aistudio/Red_Polo_Shirt_Back_View_91a1d4e7.webp',
  },
};

export const TIPPING_POLO_VARIANTS: PoloVariant[] = [
  {
    name: 'Maroon / White Tipping',
    shortLabel: 'Maroon',
    hex: '#6B1D2F',
    garmentHex: '#6B1D2F',
    tippingHex: '#FFFFFF',
    front: '/assets/aistudio/Burgundy_Polo_with_White_Trim_0f8a4af9.webp',
    back: '/assets/aistudio/Maroon_Polo_Shirt_with_White_Trim_9485d379.webp',
  },
  {
    name: 'Navy Blue / White Tipping',
    shortLabel: 'Navy Blue',
    hex: '#16233B',
    garmentHex: '#16233B',
    tippingHex: '#FFFFFF',
    front: '/assets/aistudio/Navy_Polo_Shirt_with_White_Stripes_aedd082f.webp',
    back: '/assets/aistudio/Navy_Polo_Shirt_with_White_Tipping_1f8006d9.webp',
  },
  {
    name: 'Royal Blue / White Tipping',
    shortLabel: 'Royal Blue',
    hex: '#1548A6',
    garmentHex: '#1548A6',
    tippingHex: '#FFFFFF',
    front: '/assets/aistudio/Royal_Blue_Polo_with_White_Trim_2efbdf9b.webp',
    back: '/assets/aistudio/Cobalt_Blue_Polo_Shirt_Back_View_879cf8cd.webp',
  },
  {
    name: 'Apple Green / White Tipping',
    shortLabel: 'Apple Green',
    hex: '#7CB534',
    garmentHex: '#7CB534',
    tippingHex: '#FFFFFF',
    front: '/assets/aistudio/Lime_Green_Striped_Collar_Polo_Shirt_45595fe7.webp',
    back: '/assets/aistudio/Lime_Green_Striped_Polo_Back_0d5f962a.webp',
  },
  {
    name: 'Turquoise / White Tipping',
    shortLabel: 'Turquoise',
    hex: '#00969E',
    garmentHex: '#00969E',
    tippingHex: '#FFFFFF',
    front: '/assets/aistudio/Turquoise_Polo_with_White_Accents_293a7869.webp',
    back: '/assets/aistudio/Turquoise_Striped-Collar_Polo_Back_view_3f0aa153.webp',
  },
  {
    name: 'Black / Red Tipping',
    shortLabel: 'Black/Red',
    hex: '#141418',
    garmentHex: '#141418',
    tippingHex: '#E53E3E',
    front: '/assets/aistudio/Black_and_Red_Trim_Polo_Shirt_2de2260c.webp',
    back: '/assets/aistudio/Black_Polo_Shirt_with_Red_Striped_Trim_0d8ea50a.webp',
  },
  {
    name: 'Black / White Tipping',
    shortLabel: 'Black/White',
    hex: '#111215',
    garmentHex: '#111215',
    tippingHex: '#FFFFFF',
    front: '/assets/aistudio/Black_Polo_Shirt_with_White_Stripe_Details_d4a9bfd9.webp',
    back: '/assets/aistudio/Black_Striped-Collar_Polo_Shirt_Back_View_0240da1f.webp',
  },
  {
    name: 'White / Blue Tipping',
    shortLabel: 'White/Blue',
    hex: '#FFFFFF',
    garmentHex: '#F0F4FA',
    tippingHex: '#1548A6',
    front: '/assets/aistudio/White_Polo_Shirt_with_Blue_Accents_73deb9e2.webp',
    back: '/assets/aistudio/White_Polo_Shirt_with_Blue_Striped_Details_bc9a0fc8.webp',
  },
  {
    name: 'White / Red Tipping',
    shortLabel: 'White/Red',
    hex: '#FFFFFF',
    garmentHex: '#FAF0F2',
    tippingHex: '#C61B2B',
    front: '/assets/aistudio/White_Polo_Shirt_with_Red_Accents_1db646fb.webp',
    back: '/assets/aistudio/White_Polo_Shirt_Back_Mockup_75f870d7.webp',
  },
  {
    name: 'White / Black Tipping',
    shortLabel: 'White/Black',
    hex: '#FFFFFF',
    garmentHex: '#F5F5F7',
    tippingHex: '#111215',
    front: '/assets/aistudio/White_Polo_Shirt_with_Black_Stripe_Details-removebg-preview_b059ed2f.webp',
    back: '/assets/aistudio/Back_View_White_Polo_with_Black_Stripes_d0285f6a.webp',
  },
  {
    name: 'Air Force Blue / White Tipping',
    shortLabel: 'Air Force',
    hex: '#1E4D6B',
    garmentHex: '#1E4D6B',
    tippingHex: '#FFFFFF',
    front: '/assets/aistudio/Teal-Blue_Striped_Collar_Polo_Shirt_15ef3831.webp',
    back: '/assets/aistudio/Teal_Striped-Collar_Polo_Shirt_59e79a14.webp',
  },
  {
    name: 'Bottle Green / White Tipping',
    shortLabel: 'Bottle Green',
    hex: '#123826',
    garmentHex: '#123826',
    tippingHex: '#FFFFFF',
    front: '/assets/aistudio/Bottle_Green_Striped-Collar_Polo_Mockup_44fa00f7.webp',
    back: '/assets/aistudio/Forest_Green_Striped-Collar_Polo_Back_51e1b36f.webp',
  },
  {
    name: 'Charcoal Melange / White Tipping',
    shortLabel: 'Charcoal',
    hex: '#43484F',
    garmentHex: '#43484F',
    tippingHex: '#FFFFFF',
    front: '/assets/aistudio/Charcoal_Striped_Collar_Polo_Shirt_f0c5cc08.webp',
    back: '/assets/aistudio/Charcoal_Polo_Shirt_Back_View_177343bd.webp',
  },
  {
    name: 'Grey Melange / Black Tipping',
    shortLabel: 'Grey Melange',
    hex: '#9E9E9E',
    garmentHex: '#9E9E9E',
    tippingHex: '#111215',
    front: '/assets/aistudio/Gray_Melange_Polo_Shirt_with_Contrast_Trim_29cef4d6.webp',
    back: '/assets/aistudio/Gray_Polo_Shirt_Back_View_Mockup_5e906dfe.webp',
  },
  {
    name: 'Red / White Tipping',
    shortLabel: 'Red',
    hex: '#C61B2B',
    garmentHex: '#C61B2B',
    tippingHex: '#FFFFFF',
    front: '/assets/aistudio/Red_Polo_Shirt_with_White_Accents_eaf6604d.webp',
    back: '/assets/aistudio/Red_Polo_Shirt_Back_View_91a1d4e7.webp',
  },
];

/**
 * Returns the exact front and back image URLs for a given color name.
 * Supports exact match, normalized variant name, or fuzzy prefix matching.
 */
export function getTippingPoloImages(colorName?: string, hex?: string): { front: string; back: string } {
  if (!colorName && !hex) {
    return TIPPING_POLO_IMAGE_MAP['Navy Blue / White Tipping'];
  }

  // 1. Direct match by exact name
  if (colorName && TIPPING_POLO_IMAGE_MAP[colorName]) {
    return TIPPING_POLO_IMAGE_MAP[colorName];
  }

  // 2. Match by garment hex if provided
  if (hex) {
    const normHex = hex.trim().toLowerCase();
    const matchedVariant = TIPPING_POLO_VARIANTS.find(
      v => v.hex.toLowerCase() === normHex || v.garmentHex.toLowerCase() === normHex
    );
    if (matchedVariant) {
      return { front: matchedVariant.front, back: matchedVariant.back };
    }
  }

  // 3. Normalized lowercase comparison
  const normalized = (colorName || '').trim().toLowerCase();
  for (const [key, val] of Object.entries(TIPPING_POLO_IMAGE_MAP)) {
    if (key.toLowerCase() === normalized) {
      return val;
    }
  }

  // 3. Substring / Prefix matching
  for (const [key, val] of Object.entries(TIPPING_POLO_IMAGE_MAP)) {
    const keyLower = key.toLowerCase();
    // Check specific distinct sub-names
    if (normalized.includes('maroon') || normalized.includes('burgundy')) {
      if (keyLower.includes('maroon')) return val;
    }
    if (normalized.includes('navy')) {
      if (keyLower.includes('navy')) return val;
    }
    if (normalized.includes('royal')) {
      if (keyLower.includes('royal')) return val;
    }
    if (normalized.includes('apple') || normalized.includes('lime')) {
      if (keyLower.includes('apple')) return val;
    }
    if (normalized.includes('turquoise') || normalized.includes('teal')) {
      if (keyLower.includes('turquoise')) return val;
    }
    if (normalized.includes('black') && normalized.includes('red')) {
      if (keyLower.includes('black / red')) return val;
    }
    if (normalized.includes('black') && (normalized.includes('white') || !normalized.includes('red'))) {
      if (keyLower.includes('black / white')) return val;
    }
    if (normalized.includes('white') && normalized.includes('blue')) {
      if (keyLower.includes('white / blue')) return val;
    }
    if (normalized.includes('white') && normalized.includes('red')) {
      if (keyLower.includes('white / red')) return val;
    }
    if (normalized.includes('white') && (normalized.includes('black') || normalized.includes('stripe'))) {
      if (keyLower.includes('white / black')) return val;
    }
    if (normalized.includes('air force') || normalized.includes('force')) {
      if (keyLower.includes('air force')) return val;
    }
    if (normalized.includes('bottle') || normalized.includes('forest')) {
      if (keyLower.includes('bottle')) return val;
    }
    if (normalized.includes('charcoal')) {
      if (keyLower.includes('charcoal')) return val;
    }
    if (normalized.includes('grey') || normalized.includes('gray')) {
      if (keyLower.includes('grey melange')) return val;
    }
    if (normalized.includes('red')) {
      if (keyLower.includes('red / white')) return val;
    }
  }

  // Fallback to default
  return TIPPING_POLO_IMAGE_MAP['Navy Blue / White Tipping'];
}

/**
 * Helper to convert TIPPING_POLO_VARIANTS into standard ProductColor[]
 */
export function getTippingPoloProductColors(): ProductColor[] {
  return TIPPING_POLO_VARIANTS.map(v => ({
    name: v.name,
    hex: v.hex,
    garmentHex: v.garmentHex,
    tippingHex: v.tippingHex,
    imageFront: v.front,
    imageBack: v.back,
  }));
}
