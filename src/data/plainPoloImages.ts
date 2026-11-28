import type { ProductColor } from '../types/index.ts';

export interface PlainPoloVariant {
  name: string;
  shortLabel: string;
  hex: string;
  garmentHex: string;
  front: string;
  back: string;
}

export const PLAIN_POLO_IMAGE_MAP: Record<string, { front: string; back: string }> = {
  'Navy Blue': {
    front: '/assets/aistudio/Navy_Blue_T-shirt_Front_View-Photoroom_fcdee5a1.webp',
    back: '/assets/aistudio/Navy_Blue_T-shirt_Back_View-Photoroom_8e898d02.webp',
  },
  'White': {
    front: '/assets/aistudio/White_T-shirt_Front_View-Photoroom_fa15acd8.webp',
    back: '/assets/aistudio/1._White_T-shirt_Back_View-Photoroom_04296f8f.webp',
  },
  'Royal Blue': {
    front: '/assets/aistudio/Royal_Blue_T-shirt_Front_View-Photoroom_7df80649.webp',
    back: '/assets/aistudio/Royal_Blue_T-shirt_Back_View-Photoroom_055369f9.webp',
  },
  'Red': {
    front: '/assets/aistudio/Red_T-shirt_Front_View-Photoroom_5141aa5d.webp',
    back: '/assets/aistudio/Red_T-shirt_Back_View-Photoroom_62eb9163.webp',
  },
  'Maroon': {
    front: '/assets/aistudio/Maroon_T-shirt_Front_View-Photoroom_66cf2a04.webp',
    back: '/assets/aistudio/Maroon_T-shirt_Back_View-Photoroom_7710ac38.webp',
  },
  'Charcoal Grey': {
    front: '/assets/aistudio/Charcoal_Grey_T-shirt_Front_View-Photoroom_0f149d00.webp',
    back: '/assets/aistudio/Charcoal_Grey_T-shirt_Back_View-Photoroom_790f7b3c.webp',
  },
  'Grey Melange': {
    front: '/assets/aistudio/Grey_Melange_T-shirt_Front_View-Photoroom_c0e9f2df.webp',
    back: '/assets/aistudio/Grey_Melange_T-shirt_Back_View-Photoroom_ea6aeb23.webp',
  },
  'Golden Yellow': {
    front: '/assets/aistudio/Golden_Yellow_T-shirt_Front_View-Photoroom_861d5f6c.webp',
    back: '/assets/aistudio/Golden_Yellow_T-shirt_Back_View-Photoroom_792b61b1.webp',
  },
  'Orange': {
    front: '/assets/aistudio/Orange_T-shirt_Front_View-Photoroom_f60e4be9.webp',
    back: '/assets/aistudio/Orange_T-shirt_Back_View-Photoroom_e8355113.webp',
  },
  'Sky Blue': {
    front: '/assets/aistudio/Sky_Blue_T-shirt_Front_View-removebg-preview_6f5e09bf.webp',
    back: '/assets/aistudio/Sky_Blue_T-shirt_Back_View-removebg-preview_3c736dc5.webp',
  },
  'Ice Blue': {
    front: '/assets/aistudio/Ice_Blue_T-shirt_Front_View-Photoroom_4213f409.webp',
    back: '/assets/aistudio/Ice_Blue_T-shirt_Back_View-Photoroom_dd632b97.webp',
  },
  'True Blue': {
    front: '/assets/aistudio/TBlue_T-shirt_Front_View-removebg-preview_72db49ba.webp',
    back: '/assets/aistudio/TBlue_T-shirt_Back_View-removebg-preview_563c43ce.webp',
  },
  'Turquoise Blue': {
    front: '/assets/aistudio/Turquoise_Blue_T-shirt_Front_View-Photoroom_e58f433c.webp',
    back: '/assets/aistudio/Turquoise_Blue_T-shirt_Back_View-Photoroom_af031699.webp',
  },
  'Turquoise Green': {
    front: '/assets/aistudio/Turquoise_Green_T-shirt_Front_View-Photoroom_602ccf5c.webp',
    back: '/assets/aistudio/Turquoise_Green_T-shirt_Back_View-Photoroom_78317005.webp',
  },
  'Liril Green': {
    front: '/assets/aistudio/Liril_Green_T-shirt_Front_View-Photoroom_fc41bf56.webp',
    back: '/assets/aistudio/Liril_Green_T-shirt_Back_View-Photoroom_8e90731b.webp',
  },
  'Pista Green': {
    front: '/assets/aistudio/Pista_Green_T-shirt_Front_View-Photoroom__1__2771d0cb.webp',
    back: '/assets/aistudio/Pista_Green_T-shirt_Back_View-removebg-preview_338f4ae3.webp',
  },
};

export const PLAIN_POLO_VARIANTS: PlainPoloVariant[] = [
  {
    name: 'Navy Blue',
    shortLabel: 'Navy Blue',
    hex: '#1B273D',
    garmentHex: '#1B273D',
    front: '/assets/aistudio/Navy_Blue_T-shirt_Front_View-Photoroom_fcdee5a1.webp',
    back: '/assets/aistudio/Navy_Blue_T-shirt_Back_View-Photoroom_8e898d02.webp',
  },
  {
    name: 'White',
    shortLabel: 'White',
    hex: '#FFFFFF',
    garmentHex: '#F6F7FA',
    front: '/assets/aistudio/White_T-shirt_Front_View-Photoroom_fa15acd8.webp',
    back: '/assets/aistudio/1._White_T-shirt_Back_View-Photoroom_04296f8f.webp',
  },
  {
    name: 'Royal Blue',
    shortLabel: 'Royal Blue',
    hex: '#1353BF',
    garmentHex: '#1353BF',
    front: '/assets/aistudio/Royal_Blue_T-shirt_Front_View-Photoroom_7df80649.webp',
    back: '/assets/aistudio/Royal_Blue_T-shirt_Back_View-Photoroom_055369f9.webp',
  },
  {
    name: 'Red',
    shortLabel: 'Red',
    hex: '#D61C26',
    garmentHex: '#D61C26',
    front: '/assets/aistudio/Red_T-shirt_Front_View-Photoroom_5141aa5d.webp',
    back: '/assets/aistudio/Red_T-shirt_Back_View-Photoroom_62eb9163.webp',
  },
  {
    name: 'Maroon',
    shortLabel: 'Maroon',
    hex: '#7A1426',
    garmentHex: '#7A1426',
    front: '/assets/aistudio/Maroon_T-shirt_Front_View-Photoroom_66cf2a04.webp',
    back: '/assets/aistudio/Maroon_T-shirt_Back_View-Photoroom_7710ac38.webp',
  },
  {
    name: 'Charcoal Grey',
    shortLabel: 'Charcoal Grey',
    hex: '#3A3E45',
    garmentHex: '#3A3E45',
    front: '/assets/aistudio/Charcoal_Grey_T-shirt_Front_View-Photoroom_0f149d00.webp',
    back: '/assets/aistudio/Charcoal_Grey_T-shirt_Back_View-Photoroom_790f7b3c.webp',
  },
  {
    name: 'Grey Melange',
    shortLabel: 'Grey Melange',
    hex: '#9A9FA7',
    garmentHex: '#9A9FA7',
    front: '/assets/aistudio/Grey_Melange_T-shirt_Front_View-Photoroom_c0e9f2df.webp',
    back: '/assets/aistudio/Grey_Melange_T-shirt_Back_View-Photoroom_ea6aeb23.webp',
  },
  {
    name: 'Golden Yellow',
    shortLabel: 'Golden Yellow',
    hex: '#F4B301',
    garmentHex: '#F4B301',
    front: '/assets/aistudio/Golden_Yellow_T-shirt_Front_View-Photoroom_861d5f6c.webp',
    back: '/assets/aistudio/Golden_Yellow_T-shirt_Back_View-Photoroom_792b61b1.webp',
  },
  {
    name: 'Orange',
    shortLabel: 'Orange',
    hex: '#F15A24',
    garmentHex: '#F15A24',
    front: '/assets/aistudio/Orange_T-shirt_Front_View-Photoroom_f60e4be9.webp',
    back: '/assets/aistudio/Orange_T-shirt_Back_View-Photoroom_e8355113.webp',
  },
  {
    name: 'Sky Blue',
    shortLabel: 'Sky Blue',
    hex: '#6CB8EB',
    garmentHex: '#6CB8EB',
    front: '/assets/aistudio/Sky_Blue_T-shirt_Front_View-removebg-preview_6f5e09bf.webp',
    back: '/assets/aistudio/Sky_Blue_T-shirt_Back_View-removebg-preview_3c736dc5.webp',
  },
  {
    name: 'Ice Blue',
    shortLabel: 'Ice Blue',
    hex: '#A4CDE7',
    garmentHex: '#A4CDE7',
    front: '/assets/aistudio/Ice_Blue_T-shirt_Front_View-Photoroom_4213f409.webp',
    back: '/assets/aistudio/Ice_Blue_T-shirt_Back_View-Photoroom_dd632b97.webp',
  },
  {
    name: 'True Blue',
    shortLabel: 'True Blue',
    hex: '#0F74D4',
    garmentHex: '#0F74D4',
    front: '/assets/aistudio/TBlue_T-shirt_Front_View-removebg-preview_72db49ba.webp',
    back: '/assets/aistudio/TBlue_T-shirt_Back_View-removebg-preview_563c43ce.webp',
  },
  {
    name: 'Turquoise Blue',
    shortLabel: 'Turquoise Blue',
    hex: '#00A7C7',
    garmentHex: '#00A7C7',
    front: '/assets/aistudio/Turquoise_Blue_T-shirt_Front_View-Photoroom_e58f433c.webp',
    back: '/assets/aistudio/Turquoise_Blue_T-shirt_Back_View-Photoroom_af031699.webp',
  },
  {
    name: 'Turquoise Green',
    shortLabel: 'Turquoise Green',
    hex: '#00A88F',
    garmentHex: '#00A88F',
    front: '/assets/aistudio/Turquoise_Green_T-shirt_Front_View-Photoroom_602ccf5c.webp',
    back: '/assets/aistudio/Turquoise_Green_T-shirt_Back_View-Photoroom_78317005.webp',
  },
  {
    name: 'Liril Green',
    shortLabel: 'Liril Green',
    hex: '#88C137',
    garmentHex: '#88C137',
    front: '/assets/aistudio/Liril_Green_T-shirt_Front_View-Photoroom_fc41bf56.webp',
    back: '/assets/aistudio/Liril_Green_T-shirt_Back_View-Photoroom_8e90731b.webp',
  },
  {
    name: 'Pista Green',
    shortLabel: 'Pista Green',
    hex: '#96C964',
    garmentHex: '#96C964',
    front: '/assets/aistudio/Pista_Green_T-shirt_Front_View-Photoroom__1__2771d0cb.webp',
    back: '/assets/aistudio/Pista_Green_T-shirt_Back_View-removebg-preview_338f4ae3.webp',
  },
];

/**
 * Returns the exact front and back image URLs for a given color name or hex for Plain Polo.
 */
export function getPlainPoloImages(colorName?: string, hex?: string): { front: string; back: string } {
  if (!colorName && !hex) {
    return PLAIN_POLO_IMAGE_MAP['Navy Blue'];
  }

  if (colorName && PLAIN_POLO_IMAGE_MAP[colorName]) {
    return PLAIN_POLO_IMAGE_MAP[colorName];
  }

  if (hex) {
    const normHex = hex.trim().toLowerCase();
    const matched = PLAIN_POLO_VARIANTS.find(
      v => v.hex.toLowerCase() === normHex || v.garmentHex.toLowerCase() === normHex
    );
    if (matched) {
      return { front: matched.front, back: matched.back };
    }
  }

  const normalized = (colorName || '').trim().toLowerCase();
  for (const [key, val] of Object.entries(PLAIN_POLO_IMAGE_MAP)) {
    if (key.toLowerCase() === normalized) {
      return val;
    }
  }

  for (const [key, val] of Object.entries(PLAIN_POLO_IMAGE_MAP)) {
    if (normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)) {
      return val;
    }
  }

  return PLAIN_POLO_IMAGE_MAP['Navy Blue'];
}

/**
 * Returns the 16 Plain Polo variants formatted as ProductColor[]
 */
export function getPlainPoloProductColors(): ProductColor[] {
  return PLAIN_POLO_VARIANTS.map(v => ({
    name: v.name,
    hex: v.hex,
    garmentHex: v.garmentHex,
    imageFront: v.front,
    imageBack: v.back,
  }));
}
