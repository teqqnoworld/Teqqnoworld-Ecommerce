/**
 * Responsive AVIF + WebP variant helper for pre-generated optimized assets in /assets/opt/.
 * Preserves original asset paths as canonical fallbacks so SEO, OG tags, JSON-LD,
 * and product feeds continue referencing original high-resolution URLs unchanged.
 */

const OPTIMIZED_VARIANT_MAP: Record<string, readonly number[]> = {
  // 5 Circular Category Badges (1200x1200 originals; rendered 162px mobile / 202px tablet / 222px desktop)
  '/assets/aistudio/Corporate_Gifting_Badge_with_Branded_Essentials_11cc4d80.webp': [180, 280, 380],
  '/assets/aistudio/Promotional_Products_Showcase_Badge_12258b82.webp': [180, 280, 380],
  '/assets/aistudio/Tipping_and_Classic_Polo_Shirt_Showcase_e4ad53f7.webp': [180, 280, 380],
  '/assets/aistudio/Professional_Printing_Items_Badge_03c76e87.webp': [180, 280, 380],
  '/assets/aistudio/Custom_Caps_Promotional_Badge_4c597194.webp': [180, 280, 380],

  // 11 Product Card Images (1200-1672px originals; rendered ~380px mobile / ~384px desktop)
  '/assets/aistudio/ceramic_mug_banner_1672x941_dc952a76.webp': [360, 560, 760],
  '/assets/promo-table/promo-table-banner.webp': [360, 560, 760],
  '/assets/aistudio/Custom_Printed_Branding_Umbrella_Banner_ddb8aff0.webp': [360, 560, 760],
  '/assets/aistudio/Promotional_Canopy_Kiosk_Feature_Graphic_58ea1c0d.webp': [360, 560, 760],
  '/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp': [360, 560, 760],
  '/assets/aistudio/Premium_300_GSM_Business_Cards__1__cc07b248.webp': [360, 560, 760],
  '/assets/aistudio/Classic_Plain_Polo_Color_Collection_17e25f68.webp': [360, 560, 760],
  '/assets/products/prod_tipping_polo.webp': [360, 560, 760],
  '/assets/aistudio/JOAB_Coolmax_Polo_Shirt_Showcase_0673e0a4.webp': [360, 560, 760],
  '/assets/aistudio/Premium_Matty_Polo_T-Shirt_Banner_45dae9b5.webp': [360, 560, 760],
  '/assets/aistudio/Cotton_Flexi_Caps_Product_Banner_7057e0bd.webp': [360, 560, 760],

  // 6 Client Logos (500x500 originals; rendered 64-96px)
  '/assets/aistudio/Herbalife_Green_Circle_Logo-removebg-preview_2f94e509.webp': [96, 160],
  '/assets/aistudio/Castrol_Green_Circle_Emblem-removebg-preview_4fa7a82f.webp': [96, 160],
  '/assets/aistudio/Vasavi_Group_Circular_Badge_Logo-removebg-preview_823cc81a.webp': [96, 160],
  '/assets/aistudio/Delhivery_Circular_Logo_Badge-removebg-preview_0291f44c.webp': [96, 160],
  '/assets/aistudio/Priya_Cement_Lion_Emblem-removebg-preview_082e32cf.webp': [96, 160],
  '/assets/aistudio/Caarvin_Motors_Circular_Badge_Logo-removebg-preview_748db22f.webp': [96, 160],

  // FAQ Illustration (865x697 original)
  '/assets/faq_illustration.webp': [360, 480],
};

function getBaseName(assetPath: string): string {
  const clean = assetPath.split('?')[0];
  const lastSlash = clean.lastIndexOf('/');
  const filename = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean;
  return filename.replace(/\.webp$/i, '');
}

/**
 * Returns optimized WebP src/srcSet props for standard <img> elements.
 */
export function getResponsiveImageProps(
  originalSrc: string,
  sizes?: string
): { src: string; srcSet?: string; sizes?: string } {
  const widths = OPTIMIZED_VARIANT_MAP[originalSrc];
  if (!widths || widths.length === 0) {
    return sizes ? { src: originalSrc, sizes } : { src: originalSrc };
  }

  const base = getBaseName(originalSrc);
  const srcSet = widths
    .map((w) => `/assets/opt/${base}-w${w}.webp ${w}w`)
    .join(', ');
  const fallbackWidth = widths[0];
  return {
    src: `/assets/opt/${base}-w${fallbackWidth}.webp`,
    srcSet,
    ...(sizes ? { sizes } : {}),
  };
}

/**
 * Returns both AVIF and WebP srcSets for <picture> elements so modern browsers
 * receive smaller AVIF files while falling back seamlessly to WebP.
 */
export function getResponsivePictureSources(
  originalSrc: string,
  sizes?: string
): { src: string; webpSrcSet?: string; avifSrcSet?: string; sizes?: string } {
  const widths = OPTIMIZED_VARIANT_MAP[originalSrc];
  if (!widths || widths.length === 0) {
    return sizes ? { src: originalSrc, sizes } : { src: originalSrc };
  }

  const base = getBaseName(originalSrc);
  const avifSrcSet = widths
    .map((w) => `/assets/opt/${base}-w${w}.avif ${w}w`)
    .join(', ');
  const webpSrcSet = widths
    .map((w) => `/assets/opt/${base}-w${w}.webp ${w}w`)
    .join(', ');

  return {
    src: `/assets/opt/${base}-w${widths[0]}.webp`,
    webpSrcSet,
    avifSrcSet,
    ...(sizes ? { sizes } : {}),
  };
}
