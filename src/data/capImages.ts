import type { ProductColor } from '../types/index.ts';

export interface CapVariant {
  name: string;
  shortLabel: string;
  hex: string;
  garmentHex: string;
  front: string;
  back: string;
}

/**
 * Image map for Cotton Flexi Caps.
 * Exactly 6 colours mapped to the uploaded transparent PNG images:
 * 1. Black
 * 2. Navy Blue
 * 3. Red
 * 4. Gray
 * 5. Yellow
 * 6. White
 */
export const COTTON_FLEXI_CAP_IMAGE_MAP: Record<string, { front: string; back: string }> = {
  'Black': {
    front: '/assets/caps/black.webp',
    back: '/assets/caps/black.webp',
  },
  'Navy Blue': {
    front: '/assets/caps/navy-blue.webp',
    back: '/assets/caps/navy-blue.webp',
  },
  'Red': {
    front: '/assets/caps/red.webp',
    back: '/assets/caps/red.webp',
  },
  'Gray': {
    front: '/assets/caps/gray.webp',
    back: '/assets/caps/gray.webp',
  },
  'Yellow': {
    front: '/assets/caps/yellow.webp',
    back: '/assets/caps/yellow.webp',
  },
  'White': {
    front: '/assets/caps/white.webp',
    back: '/assets/caps/white.webp',
  },
};

/**
 * Exactly 6 colour variants in the user requested order:
 * 1. Black
 * 2. Navy Blue
 * 3. Red
 * 4. Gray
 * 5. Yellow
 * 6. White
 */
export const COTTON_FLEXI_CAP_VARIANTS: CapVariant[] = [
  {
    name: 'Black',
    shortLabel: 'Black',
    hex: '#18181A',
    garmentHex: '#18181A',
    front: COTTON_FLEXI_CAP_IMAGE_MAP['Black'].front,
    back: COTTON_FLEXI_CAP_IMAGE_MAP['Black'].back,
  },
  {
    name: 'Navy Blue',
    shortLabel: 'Navy Blue',
    hex: '#162035',
    garmentHex: '#162035',
    front: COTTON_FLEXI_CAP_IMAGE_MAP['Navy Blue'].front,
    back: COTTON_FLEXI_CAP_IMAGE_MAP['Navy Blue'].back,
  },
  {
    name: 'Red',
    shortLabel: 'Red',
    hex: '#D31A2B',
    garmentHex: '#D31A2B',
    front: COTTON_FLEXI_CAP_IMAGE_MAP['Red'].front,
    back: COTTON_FLEXI_CAP_IMAGE_MAP['Red'].back,
  },
  {
    name: 'Gray',
    shortLabel: 'Gray',
    hex: '#7B8089',
    garmentHex: '#7B8089',
    front: COTTON_FLEXI_CAP_IMAGE_MAP['Gray'].front,
    back: COTTON_FLEXI_CAP_IMAGE_MAP['Gray'].back,
  },
  {
    name: 'Yellow',
    shortLabel: 'Yellow',
    hex: '#F4B301',
    garmentHex: '#F4B301',
    front: COTTON_FLEXI_CAP_IMAGE_MAP['Yellow'].front,
    back: COTTON_FLEXI_CAP_IMAGE_MAP['Yellow'].back,
  },
  {
    name: 'White',
    shortLabel: 'White',
    hex: '#FFFFFF',
    garmentHex: '#FFFFFF',
    front: COTTON_FLEXI_CAP_IMAGE_MAP['White'].front,
    back: COTTON_FLEXI_CAP_IMAGE_MAP['White'].back,
  },
];

/**
 * Returns front and back photographic image URLs for a Cotton Flexi Cap color
 */
export function getCapImages(colorName?: string, hex?: string): { front: string; back: string } {
  if (!colorName && !hex) {
    return COTTON_FLEXI_CAP_IMAGE_MAP['Black'];
  }

  if (colorName && COTTON_FLEXI_CAP_IMAGE_MAP[colorName]) {
    return COTTON_FLEXI_CAP_IMAGE_MAP[colorName];
  }

  if (hex) {
    const normHex = hex.trim().toLowerCase();
    const matched = COTTON_FLEXI_CAP_VARIANTS.find(
      v => v.hex.toLowerCase() === normHex || v.garmentHex.toLowerCase() === normHex
    );
    if (matched && matched.front) {
      return { front: matched.front, back: matched.back };
    }
  }

  const normalized = (colorName || '').trim().toLowerCase();
  for (const [key, val] of Object.entries(COTTON_FLEXI_CAP_IMAGE_MAP)) {
    if (key.toLowerCase() === normalized) {
      return val;
    }
  }

  for (const [key, val] of Object.entries(COTTON_FLEXI_CAP_IMAGE_MAP)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return val;
    }
  }

  return COTTON_FLEXI_CAP_IMAGE_MAP['Black'];
}

/**
 * Returns the 6 Cotton Flexi Cap colors formatted as ProductColor[]
 */
export function getCapProductColors(): ProductColor[] {
  return COTTON_FLEXI_CAP_VARIANTS.map(v => ({
    name: v.name,
    hex: v.hex,
    garmentHex: v.garmentHex,
    imageFront: v.front,
    imageBack: v.back,
  }));
}
