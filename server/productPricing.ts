import {
  PRODUCT_PRICING_RULES,
  calculateProductPrice,
  resolvePricingRuleKey,
} from '../src/data/pricingRules.ts';

export interface SupabaseCatalogProductRow {
  id: string;
  name: string;
  category: string;
  base_price: number;
  moq?: number;
}

export interface CanonicalProductMeta {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  ruleKey: string;
}

export const CANONICAL_PRODUCT_CATALOG: Record<string, CanonicalProductMeta> = {
  'prod-plain-polo': {
    id: 'prod-plain-polo',
    name: 'Cotton 230 GSM Plain Polo T-Shirt',
    category: 'Apparel',
    aliases: ['apparel', 't-shirts', 'polo', 'polos'],
    ruleKey: 'cotton-230-polo',
  },
  'prod-polo-01': {
    id: 'prod-polo-01',
    name: 'Premium Cotton 230 GSM Tipping Collar Polo',
    category: 'Apparel',
    aliases: ['apparel', 't-shirts', 'polo', 'polos'],
    ruleKey: 'cotton-230-polo',
  },
  'prod-matty-polo': {
    id: 'prod-matty-polo',
    name: '220 GSM Matty Polo T-Shirt',
    category: 'Apparel',
    aliases: ['apparel', 't-shirts', 'polo', 'polos'],
    ruleKey: 'matty-polo',
  },
  'prod-joab-coolmax': {
    id: 'prod-joab-coolmax',
    name: 'Mars Coolmax Sports Polo T-Shirt',
    category: 'Apparel',
    aliases: ['apparel', 't-shirts', 'polo', 'polos'],
    ruleKey: 'mars-polo',
  },
  'prod-cotton-flexi-caps': {
    id: 'prod-cotton-flexi-caps',
    name: 'Cotton Flexi Promotional Caps',
    category: 'Apparel',
    aliases: ['apparel', 'caps', 'headwear'],
    ruleKey: 'cotton-caps',
  },
  'prod-ceramic-mug': {
    id: 'prod-ceramic-mug',
    name: 'Promotional Ceramic Coffee Mug',
    category: 'Corporate Gifts',
    aliases: ['corporate gifts', 'mugs', 'drinkware'],
    ruleKey: 'ceramic-mug',
  },
  'prod-canopy-kiosk': {
    id: 'prod-canopy-kiosk',
    name: 'Promotional Canopy Tent',
    category: 'Events',
    aliases: ['events', 'canopy', 'promotional canopy', 'outdoor', 'displays'],
    ruleKey: 'canopy-4x4',
  },
  'prod-rollup-standee': {
    id: 'prod-rollup-standee',
    name: 'Roll-Up Standee Banner (6x3 ft)',
    category: 'Events',
    aliases: ['events', 'standee', 'rollup', 'displays', 'banners'],
    ruleKey: 'rollup-standee',
  },
  'prod-promo-table': {
    id: 'prod-promo-table',
    name: 'Portable Promotional Demo Table',
    category: 'Events',
    aliases: ['events', 'promo table', 'promotional table', 'displays'],
    ruleKey: 'promo-table',
  },
  'prod-branding-umbrella': {
    id: 'prod-branding-umbrella',
    name: '5 Feet Promotional Branding Umbrella',
    category: 'Events',
    aliases: ['events', 'umbrella', 'outdoor', 'displays'],
    ruleKey: 'promotional-umbrella',
  },
  'prod-visiting-card-300gsm': {
    id: 'prod-visiting-card-300gsm',
    name: '300 GSM Matte Visiting Cards',
    category: 'Stationery',
    aliases: ['stationery', 'visiting cards', 'print', 'cards'],
    ruleKey: 'visiting-card-300gsm',
  },
};

export interface CartItemPricingInput {
  productId: string;
  quantity: number;
  size?: string;
  variantSize?: string;
  // Client-supplied unitPrice is accepted in the payload type for backward compatibility
  // with existing callers, but is STRICTLY IGNORED during authoritative pricing resolution.
  unitPrice?: number;
  productName?: string;
  category?: string;
}

export interface AuthoritativeCartLine {
  productId: string;
  productName: string;
  category: string;
  categoryAliases: string[];
  quantity: number;
  variantSize?: string;
  unitPrice: number;
  lineTotal: number;
  moq: number;
  maxQty: number;
  source: 'supabase_catalog' | 'canonical_pricing_rules';
}

export interface AuthoritativeCartPricingResult {
  valid: boolean;
  items: AuthoritativeCartLine[];
  subtotal: number;
  baseShippingFee: number;
  baseGstAmount: number;
  baseFinalTotal: number;
  errorCode?:
    | 'EMPTY_CART'
    | 'INVALID_PRODUCT'
    | 'INVALID_QUANTITY'
    | 'CATALOG_UNAVAILABLE';
  message?: string;
}

export interface ProductCatalogFetcher {
  fetchProductsFromSupabase: () => Promise<Map<string, SupabaseCatalogProductRow> | null>;
}

const FREE_SHIPPING_THRESHOLD_INR = 1999;
const STANDARD_SHIPPING_FEE_INR = 149;
const GST_RATE = 0.18;

let cachedSupabaseProducts: {
  fetchedAt: number;
  map: Map<string, SupabaseCatalogProductRow>;
} | null = null;

const CATALOG_CACHE_TTL_MS = 60_000;

export function clearProductCatalogCache(): void {
  cachedSupabaseProducts = null;
}

export async function fetchSupabaseProductCatalog(
  getSupabaseAdminConfig: () => { configured: boolean; url: string; serviceRoleKey: string },
  buildSupabaseAdminHeaders: (serviceRoleKey: string) => Record<string, string>
): Promise<Map<string, SupabaseCatalogProductRow> | null> {
  if (
    cachedSupabaseProducts &&
    Date.now() - cachedSupabaseProducts.fetchedAt < CATALOG_CACHE_TTL_MS
  ) {
    return cachedSupabaseProducts.map;
  }

  const cfg = getSupabaseAdminConfig();
  if (!cfg.configured || !cfg.url || !cfg.serviceRoleKey) {
    return null;
  }

  try {
    const resp = await fetch(
      `${cfg.url}/rest/v1/products?select=id,name,category,base_price,moq&limit=500`,
      {
        headers: buildSupabaseAdminHeaders(cfg.serviceRoleKey),
      }
    );
    if (!resp.ok) {
      return null;
    }
    const rows = (await resp.json()) as any[];
    const map = new Map<string, SupabaseCatalogProductRow>();
    for (const r of rows) {
      if (!r?.id) continue;
      const basePrice = Number(r.base_price);
      if (!Number.isFinite(basePrice) || basePrice <= 0) continue;
      map.set(String(r.id).trim(), {
        id: String(r.id).trim(),
        name: String(r.name || r.id),
        category: String(r.category || 'General'),
        base_price: basePrice,
        moq: r.moq != null && Number(r.moq) >= 1 ? Math.floor(Number(r.moq)) : 1,
      });
    }
    cachedSupabaseProducts = { fetchedAt: Date.now(), map };
    return map;
  } catch {
    return null;
  }
}

/**
 * Resolves authoritative per-unit and subtotal pricing strictly on the server.
 * NEVER trusts client-supplied `unitPrice` or `amountInr`.
 */
export async function resolveAuthoritativeCartPricing(
  rawItems: CartItemPricingInput[] | undefined,
  options?: {
    supabaseProducts?: Map<string, SupabaseCatalogProductRow> | null;
    fetcher?: ProductCatalogFetcher;
    requireSupabaseInProduction?: boolean;
  }
): Promise<AuthoritativeCartPricingResult> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return {
      valid: false,
      items: [],
      subtotal: 0,
      baseShippingFee: 0,
      baseGstAmount: 0,
      baseFinalTotal: 0,
      errorCode: 'EMPTY_CART',
      message: 'Cart items are required to calculate authoritative pricing.',
    };
  }

  if (rawItems.length > 50) {
    return {
      valid: false,
      items: [],
      subtotal: 0,
      baseShippingFee: 0,
      baseGstAmount: 0,
      baseFinalTotal: 0,
      errorCode: 'INVALID_QUANTITY',
      message: 'Cart exceeds maximum allowed line items (50).',
    };
  }

  let dbProducts = options?.supabaseProducts ?? null;
  if (!dbProducts && options?.fetcher) {
    dbProducts = await options.fetcher.fetchProductsFromSupabase();
  }

  const resolvedItems: AuthoritativeCartLine[] = [];

  for (const raw of rawItems) {
    const productId = String(raw?.productId || '').trim();
    const rawQty = Number(raw?.quantity);
    const variantSize = String(raw?.variantSize || raw?.size || '').trim() || undefined;

    if (!productId || productId.length > 100) {
      return {
        valid: false,
        items: [],
        subtotal: 0,
        baseShippingFee: 0,
        baseGstAmount: 0,
        baseFinalTotal: 0,
        errorCode: 'INVALID_PRODUCT',
        message: 'One or more cart items are missing a valid product ID.',
      };
    }

    if (!Number.isFinite(rawQty) || !Number.isInteger(rawQty) || rawQty < 1 || rawQty > 10000) {
      return {
        valid: false,
        items: [],
        subtotal: 0,
        baseShippingFee: 0,
        baseGstAmount: 0,
        baseFinalTotal: 0,
        errorCode: 'INVALID_QUANTITY',
        message: `Invalid quantity (${String(raw?.quantity)}) for product ${productId}.`,
      };
    }

    const canonical = CANONICAL_PRODUCT_CATALOG[productId];
    const dbProduct = dbProducts?.get(productId) || null;

    if (!canonical && !dbProduct) {
      return {
        valid: false,
        items: [],
        subtotal: 0,
        baseShippingFee: 0,
        baseGstAmount: 0,
        baseFinalTotal: 0,
        errorCode: 'INVALID_PRODUCT',
        message: `Product "${productId}" is unavailable or does not exist in the TeqqnoWorld catalog.`,
      };
    }

    if (canonical) {
      const ruleKey = resolvePricingRuleKey(productId, variantSize);
      const rule = PRODUCT_PRICING_RULES[ruleKey] || PRODUCT_PRICING_RULES[canonical.ruleKey];
      const effectiveMinQty =
        ruleKey === 'visiting-card-300gsm' ? 1 : Math.min(rule.moq, dbProduct?.moq || rule.moq);

      if (rawQty < effectiveMinQty || rawQty > rule.maxQty) {
        return {
          valid: false,
          items: [],
          subtotal: 0,
          baseShippingFee: 0,
          baseGstAmount: 0,
          baseFinalTotal: 0,
          errorCode: 'INVALID_QUANTITY',
          message: `Quantity for ${dbProduct?.name || canonical.name} must be between ${effectiveMinQty} and ${rule.maxQty}.`,
        };
      }

      const calc = calculateProductPrice(productId, rawQty, variantSize);
      let authoritativeUnitPrice = calc.unitPrice;
      let source: AuthoritativeCartLine['source'] = 'canonical_pricing_rules';

      // If admin updated base_price in Supabase public.products (and it is not canopy 8x8 variant),
      // respect the live Supabase base_price proportionally across bulk tiers so admin edits stay authoritative.
      if (dbProduct && Number.isFinite(dbProduct.base_price) && dbProduct.base_price > 0) {
        source = 'supabase_catalog';
        const defaultFirstSlabPrice = rule.slabs[0]?.pricePerUnit || calc.unitPrice;
        if (
          ruleKey !== 'canopy-8x8' &&
          defaultFirstSlabPrice > 0 &&
          Math.abs(dbProduct.base_price - defaultFirstSlabPrice) > 0.01
        ) {
          const ratio = calc.unitPrice / defaultFirstSlabPrice;
          authoritativeUnitPrice = Math.round(dbProduct.base_price * ratio * 100) / 100;
        }
      }

      const lineTotal = Math.round(authoritativeUnitPrice * rawQty * 100) / 100;
      resolvedItems.push({
        productId,
        productName: dbProduct?.name || canonical.name,
        category: dbProduct?.category || canonical.category,
        categoryAliases: canonical.aliases,
        quantity: rawQty,
        variantSize,
        unitPrice: authoritativeUnitPrice,
        lineTotal,
        moq: rule.moq,
        maxQty: rule.maxQty,
        source,
      });
    } else if (dbProduct) {
      // Custom product created directly in Supabase products table
      const moq = Math.max(1, dbProduct.moq || 1);
      if (rawQty < moq) {
        return {
          valid: false,
          items: [],
          subtotal: 0,
          baseShippingFee: 0,
          baseGstAmount: 0,
          baseFinalTotal: 0,
          errorCode: 'INVALID_QUANTITY',
          message: `Minimum order quantity for ${dbProduct.name} is ${moq}.`,
        };
      }
      const authoritativeUnitPrice = Math.round(dbProduct.base_price * 100) / 100;
      const lineTotal = Math.round(authoritativeUnitPrice * rawQty * 100) / 100;
      resolvedItems.push({
        productId,
        productName: dbProduct.name,
        category: dbProduct.category,
        categoryAliases: [dbProduct.category.toLowerCase()],
        quantity: rawQty,
        variantSize,
        unitPrice: authoritativeUnitPrice,
        lineTotal,
        moq,
        maxQty: 10000,
        source: 'supabase_catalog',
      });
    }
  }

  const subtotal = Math.round(resolvedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return {
      valid: false,
      items: [],
      subtotal: 0,
      baseShippingFee: 0,
      baseGstAmount: 0,
      baseFinalTotal: 0,
      errorCode: 'INVALID_QUANTITY',
      message: 'Computed cart subtotal must be greater than ₹0.',
    };
  }

  const baseShippingFee =
    subtotal >= FREE_SHIPPING_THRESHOLD_INR ? 0 : STANDARD_SHIPPING_FEE_INR;
  const baseGstAmount = Math.round(subtotal * GST_RATE);
  const baseFinalTotal = subtotal + baseGstAmount + baseShippingFee;

  return {
    valid: true,
    items: resolvedItems,
    subtotal,
    baseShippingFee,
    baseGstAmount,
    baseFinalTotal,
  };
}
