/**
 * Responsive WebP variant helper for pre-generated optimized assets in /assets/opt/.
 * Preserves original asset paths as canonical fallbacks so SEO, OG tags, JSON-LD,
 * and product feeds continue referencing original high-resolution URLs unchanged.
 */

const OPTIMIZED_VARIANT_MAP: Record<string, readonly number[]> = {
  // 5 Circular Category Badges (1200x1200 originals)
  '/assets/aistudio/Corporate_Gifting_Badge_with_Branded_Essentials_11cc4d80.webp': [240, 400],
  '/assets/aistudio/Promotional_Products_Showcase_Badge_12258b82.webp': [240, 400],
  '/assets/aistudio/Tipping_and_Classic_Polo_Shirt_Showcase_e4ad53f7.webp': [240, 400],
  '/assets/aistudio/Professional_Printing_Items_Badge_03c76e87.webp': [240, 400],
  '/assets/aistudio/Custom_Caps_Promotional_Badge_4c597194.webp': [240, 400],

  // 11 Product Card Images (1200-1400px originals)
  '/assets/aistudio/ceramic_mug_banner_1672x941_dc952a76.webp': [480, 800],
  '/assets/promo-table/promo-table-banner.webp': [480, 800],
  '/assets/aistudio/Custom_Printed_Branding_Umbrella_Banner_ddb8aff0.webp': [480, 800],
  '/assets/aistudio/Promotional_Canopy_Kiosk_Feature_Graphic_58ea1c0d.webp': [480, 800],
  '/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp': [480, 800],
  '/assets/aistudio/Premium_300_GSM_Business_Cards__1__cc07b248.webp': [480, 800],
  '/assets/aistudio/Classic_Plain_Polo_Color_Collection_17e25f68.webp': [480, 800],
  '/assets/products/prod_tipping_polo.webp': [480, 800],
  '/assets/aistudio/JOAB_Coolmax_Polo_Shirt_Showcase_0673e0a4.webp': [480, 800],
  '/assets/aistudio/Premium_Matty_Polo_T-Shirt_Banner_45dae9b5.webp': [480, 800],
  '/assets/aistudio/Cotton_Flexi_Caps_Product_Banner_7057e0bd.webp': [480, 800],

  // 6 Client Logos (500x500 originals)
  '/assets/aistudio/Herbalife_Green_Circle_Logo-removebg-preview_2f94e509.webp': [128, 192],
  '/assets/aistudio/Castrol_Green_Circle_Emblem-removebg-preview_4fa7a82f.webp': [128, 192],
  '/assets/aistudio/Vasavi_Group_Circular_Badge_Logo-removebg-preview_823cc81a.webp': [128, 192],
  '/assets/aistudio/Delhivery_Circular_Logo_Badge-removebg-preview_0291f44c.webp': [128, 192],
  '/assets/aistudio/Priya_Cement_Lion_Emblem-removebg-preview_082e32cf.webp': [128, 192],
  '/assets/aistudio/Caarvin_Motors_Circular_Badge_Logo-removebg-preview_748db22f.webp': [128, 192],

  // FAQ Illustration (865x697 original)
  '/assets/faq_illustration.webp': [480],
};

function getBaseName(assetPath: string): string {
  const clean = assetPath.split('?')[0];
  const lastSlash = clean.lastIndexOf('/');
  const filename = lastSlash >= 0 ? clean.slice(lastSlash + 1) : clean;
  return filename.replace(/\.webp$/i, '');
}

/**
 * Returns optimized src (largest responsive variant when available, else original)
 * and a responsive srcSet string for pre-generated WebP variants.
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
  // Use the smallest crisp fallback or the primary variant in `src` so legacy/non-srcset loaders also save bytes
  const fallbackWidth = widths[0];
  return {
    src: `/assets/opt/${base}-w${fallbackWidth}.webp`,
    srcSet,
    ...(sizes ? { sizes } : {}),
  };
}
