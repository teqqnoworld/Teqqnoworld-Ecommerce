import type { ProductColor } from '../types/index.ts';

export interface MattyPoloVariant {
  name: string;
  shortLabel: string;
  hex: string;
  garmentHex: string;
  front: string;
  back: string;
}

/**
 * Image map for Matty Polo T-Shirt.
 * Exactly 15 colours, each with its Front View and Back View PNG image.
 */
export const MATTY_POLO_IMAGE_MAP: Record<string, { front: string; back: string }> = {
  'Black': {
    front: '/assets/matty/black-front.webp',
    back: '/assets/matty/black-back.webp',
  },
  'Navy Blue': {
    front: '/assets/matty/navy-blue-front.webp',
    back: '/assets/matty/navy-blue-back.webp',
  },
  'Red': {
    front: '/assets/matty/red-front.webp',
    back: '/assets/matty/red-back.webp',
  },
  'Gray': {
    front: '/assets/matty/gray-front.webp',
    back: '/assets/matty/gray-back.webp',
  },
  'White': {
    front: '/assets/matty/white-front.webp',
    back: '/assets/matty/white-back.webp',
  },
  'Maroon': {
    front: '/assets/matty/maroon-front.webp',
    back: '/assets/matty/maroon-back.webp',
  },
  'Royal Blue': {
    front: '/assets/matty/royal-blue-front.webp',
    back: '/assets/matty/royal-blue-back.webp',
  },
  'Orange': {
    front: '/assets/matty/orange-front.webp',
    back: '/assets/matty/orange-back.webp',
  },
  'Purple': {
    front: '/assets/matty/purple-front.webp',
    back: '/assets/matty/purple-back.webp',
  },
  'Pink': {
    front: '/assets/matty/pink-front.webp',
    back: '/assets/matty/pink-back.webp',
  },
  'Yellow': {
    front: '/assets/matty/yellow-front.webp',
    back: '/assets/matty/yellow-back.webp',
  },
  'Sky Blue': {
    front: '/assets/matty/sky-blue-front.webp',
    back: '/assets/matty/sky-blue-back.webp',
  },
  'Dark Green': {
    front: '/assets/matty/dark-green-front.webp',
    back: '/assets/matty/dark-green-back.webp',
  },
  'Lime': {
    front: '/assets/matty/lime-front.webp',
    back: '/assets/matty/lime-back.webp',
  },
  'Green': {
    front: '/assets/matty/green-front.webp',
    back: '/assets/matty/green-back.webp',
  },
};

/**
 * Exactly 15 colours in order requested by user:
 * 1. Black
 * 2. Navy Blue
 * 3. Red
 * 4. Gray
 * 5. White
 * 6. Maroon
 * 7. Royal Blue
 * 8. Orange
 * 9. Purple
 * 10. Pink
 * 11. Yellow
 * 12. Sky Blue
 * 13. Dark Green
 * 14. Lime
 * 15. Green
 */
export const MATTY_POLO_VARIANTS: MattyPoloVariant[] = [
  {
    name: 'Black',
    shortLabel: 'Black',
    hex: '#18181A',
    garmentHex: '#18181A',
    front: MATTY_POLO_IMAGE_MAP['Black'].front,
    back: MATTY_POLO_IMAGE_MAP['Black'].back,
  },
  {
    name: 'Navy Blue',
    shortLabel: 'Navy Blue',
    hex: '#162035',
    garmentHex: '#162035',
    front: MATTY_POLO_IMAGE_MAP['Navy Blue'].front,
    back: MATTY_POLO_IMAGE_MAP['Navy Blue'].back,
  },
  {
    name: 'Red',
    shortLabel: 'Red',
    hex: '#D31A2B',
    garmentHex: '#D31A2B',
    front: MATTY_POLO_IMAGE_MAP['Red'].front,
    back: MATTY_POLO_IMAGE_MAP['Red'].back,
  },
  {
    name: 'Gray',
    shortLabel: 'Gray',
    hex: '#6E7175',
    garmentHex: '#6E7175',
    front: MATTY_POLO_IMAGE_MAP['Gray'].front,
    back: MATTY_POLO_IMAGE_MAP['Gray'].back,
  },
  {
    name: 'White',
    shortLabel: 'White',
    hex: '#FFFFFF',
    garmentHex: '#FFFFFF',
    front: MATTY_POLO_IMAGE_MAP['White'].front,
    back: MATTY_POLO_IMAGE_MAP['White'].back,
  },
  {
    name: 'Maroon',
    shortLabel: 'Maroon',
    hex: '#6A1A24',
    garmentHex: '#6A1A24',
    front: MATTY_POLO_IMAGE_MAP['Maroon'].front,
    back: MATTY_POLO_IMAGE_MAP['Maroon'].back,
  },
  {
    name: 'Royal Blue',
    shortLabel: 'Royal Blue',
    hex: '#184594',
    garmentHex: '#184594',
    front: MATTY_POLO_IMAGE_MAP['Royal Blue'].front,
    back: MATTY_POLO_IMAGE_MAP['Royal Blue'].back,
  },
  {
    name: 'Orange',
    shortLabel: 'Orange',
    hex: '#FF6600',
    garmentHex: '#FF6600',
    front: MATTY_POLO_IMAGE_MAP['Orange'].front,
    back: MATTY_POLO_IMAGE_MAP['Orange'].back,
  },
  {
    name: 'Purple',
    shortLabel: 'Purple',
    hex: '#6F2DA8',
    garmentHex: '#6F2DA8',
    front: MATTY_POLO_IMAGE_MAP['Purple'].front,
    back: MATTY_POLO_IMAGE_MAP['Purple'].back,
  },
  {
    name: 'Pink',
    shortLabel: 'Pink',
    hex: '#E73879',
    garmentHex: '#E73879',
    front: MATTY_POLO_IMAGE_MAP['Pink'].front,
    back: MATTY_POLO_IMAGE_MAP['Pink'].back,
  },
  {
    name: 'Yellow',
    shortLabel: 'Yellow',
    hex: '#F4B301',
    garmentHex: '#F4B301',
    front: MATTY_POLO_IMAGE_MAP['Yellow'].front,
    back: MATTY_POLO_IMAGE_MAP['Yellow'].back,
  },
  {
    name: 'Sky Blue',
    shortLabel: 'Sky Blue',
    hex: '#6AA9DE',
    garmentHex: '#6AA9DE',
    front: MATTY_POLO_IMAGE_MAP['Sky Blue'].front,
    back: MATTY_POLO_IMAGE_MAP['Sky Blue'].back,
  },
  {
    name: 'Dark Green',
    shortLabel: 'Dark Grn',
    hex: '#143823',
    garmentHex: '#143823',
    front: MATTY_POLO_IMAGE_MAP['Dark Green'].front,
    back: MATTY_POLO_IMAGE_MAP['Dark Green'].back,
  },
  {
    name: 'Lime',
    shortLabel: 'Lime',
    hex: '#9DE828',
    garmentHex: '#9DE828',
    front: MATTY_POLO_IMAGE_MAP['Lime'].front,
    back: MATTY_POLO_IMAGE_MAP['Lime'].back,
  },
  {
    name: 'Green',
    shortLabel: 'Green',
    hex: '#227C44',
    garmentHex: '#227C44',
    front: MATTY_POLO_IMAGE_MAP['Green'].front,
    back: MATTY_POLO_IMAGE_MAP['Green'].back,
  },
];

/**
 * Returns front and back photographic image URLs for a Matty Polo color
 */
export function getMattyPoloImages(colorName?: string, hex?: string): { front: string; back: string } {
  if (!colorName && !hex) {
    return MATTY_POLO_IMAGE_MAP['Black'];
  }

  if (colorName && MATTY_POLO_IMAGE_MAP[colorName]) {
    return MATTY_POLO_IMAGE_MAP[colorName];
  }

  if (hex) {
    const normHex = hex.trim().toLowerCase();
    const matched = MATTY_POLO_VARIANTS.find(
      v => v.hex.toLowerCase() === normHex || v.garmentHex.toLowerCase() === normHex
    );
    if (matched && matched.front) {
      return { front: matched.front, back: matched.back };
    }
  }

  const normalized = (colorName || '').trim().toLowerCase();
  for (const [key, val] of Object.entries(MATTY_POLO_IMAGE_MAP)) {
    if (key.toLowerCase() === normalized) {
      return val;
    }
  }

  for (const [key, val] of Object.entries(MATTY_POLO_IMAGE_MAP)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return val;
    }
  }

  return MATTY_POLO_IMAGE_MAP['Black'];
}

/**
 * Returns the 15 Matty Polo colors formatted as ProductColor[]
 */
export function getMattyPoloProductColors(): ProductColor[] {
  return MATTY_POLO_VARIANTS.map(v => ({
    name: v.name,
    hex: v.hex,
    garmentHex: v.garmentHex,
    imageFront: v.front,
    imageBack: v.back,
  }));
}
