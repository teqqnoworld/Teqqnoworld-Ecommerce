import { Product, Order, UserProfile, SavedAddress, CustomerArtwork, TaxInvoice, NotificationItem, BulkEnquirySubmission } from '../types';
import { getTippingPoloProductColors } from './tippingPoloImages';
import { getPlainPoloProductColors } from './plainPoloImages';
import { getJoabCoolmaxProductColors, JOAB_COOLMAX_VARIANTS } from './joabCoolmaxImages';
import { getMattyPoloProductColors, MATTY_POLO_VARIANTS } from './mattyPoloImages';
import { getCapProductColors, COTTON_FLEXI_CAP_VARIANTS } from './capImages';

export interface CategoryItem {
  id: string;
  name: string;
  subtitle: string;
  priceTag: string;
  badge?: string;
  badgeColor?: string;
  image: string;
}

export const CATEGORIES_LIST: CategoryItem[] = [
  {
    id: 'tshirts',
    name: 'Custom T-Shirts',
    subtitle: 'Round Neck & Oversized',
    priceTag: 'Starts ₹249',
    badge: 'Top Seller',
    badgeColor: 'bg-[#FF7A00]',
    image: '/assets/categories/cat_tshirts.webp',
  },
  {
    id: 'polos',
    name: 'Premium Polos',
    subtitle: 'Embroidered & Pique Matty',
    priceTag: 'Starts ₹499',
    badge: 'Corporate',
    badgeColor: 'bg-zinc-800',
    image: '/assets/categories/cat_polos.webp',
  },
  {
    id: 'hoodies',
    name: 'Hoodies & Warmers',
    subtitle: 'Heavy Fleece Pullovers',
    priceTag: 'Starts ₹899',
    badge: '340 GSM',
    badgeColor: 'bg-zinc-700',
    image: '/assets/categories/cat_hoodies.webp',
  },
  {
    id: 'caps',
    name: 'Custom Caps',
    subtitle: 'Snapbacks & Dad Hats',
    priceTag: 'Starts ₹199',
    image: '/assets/categories/cat_caps.webp',
  },
  {
    id: 'gift-sets',
    name: 'Corporate Gift Sets',
    subtitle: 'Festive & Leadership Hampers',
    priceTag: 'Starts ₹799',
    badge: 'VIP Sets',
    badgeColor: 'bg-amber-600',
    image: '/assets/categories/cat_gift_sets.webp',
  },
  {
    id: 'joining-kits',
    name: 'Joining Kits',
    subtitle: 'Day 1 Onboarding Packages',
    priceTag: 'Starts ₹999',
    image: '/assets/categories/cat_joining_kits.webp',
  },
  {
    id: 'bags',
    name: 'Bags & Sleeves',
    subtitle: 'Laptop Packs, Totes & Duffles',
    priceTag: 'Starts ₹349',
    image: '/assets/categories/cat_bags.webp',
  },
  {
    id: 'pens',
    name: 'Pens & Desk Tech',
    subtitle: 'Laser Engraved Stylus Pens',
    priceTag: 'Starts ₹89',
    image: '/assets/categories/cat_pens.webp',
  },
  {
    id: 'visiting-cards',
    name: 'Visiting Cards',
    subtitle: 'Velvet Matte & Spot UV',
    priceTag: '₹199 / 100 pcs',
    badge: 'Foil + UV',
    badgeColor: 'bg-purple-700',
    image: '/assets/categories/cat_visiting_cards.webp',
  },
  {
    id: 'event-signage',
    name: 'Event Signage',
    subtitle: 'Roll-Up Standees & Canopies',
    priceTag: 'Starts ₹599',
    image: '/assets/categories/cat_event_signage.webp',
  },
  {
    id: 'drinkware',
    name: 'Ceramic Mugs & Drinkware',
    subtitle: 'Promotional Coffee Mugs · Custom Print',
    priceTag: 'Starts ₹119',
    badge: 'Popular Gift',
    badgeColor: 'bg-[#FF7A00]',
    image: '/assets/aistudio/Blank_White_Ceramic_Mug_b82bfadb.webp',
  },
];

export const CATEGORIES_DATA = CATEGORIES_LIST;

export interface BestSellerProduct {
  id: string;
  name: string;
  subtitle: string;
  badges: { text: string; color?: string }[];
  image: string;
  rating: number;
  reviewCount: number;
  deliveryTag: string;
  description: string;
  colors?: string[];
  optionsText?: string;
  price: number;
  mrp: number;
  priceUnit: string;
  ctaText: string;
  ctaType: 'orange' | 'dark';
  category: 'Apparel' | 'Gift Sets' | 'ID Badges' | 'Stationery' | 'Display' | 'Drinkware';
}

export const BEST_SELLERS: BestSellerProduct[] = [
  {
    id: 'bs-ceramic-mug',
    name: 'Promotional Ceramic Mug',
    subtitle: 'Custom Printed Ceramic Coffee Mug · ~325 ml (11 oz) · White ONLY',
    badges: [
      { text: 'Corporate Gifting', color: 'bg-emerald-600' },
      { text: 'Min: 5 pcs', color: 'bg-zinc-800' },
      { text: 'White ONLY', color: 'bg-[#FF7A00]' },
    ],
    deliveryTag: '⚡ 24h Ready',
    image: '/assets/aistudio/ceramic_mug_banner_1672x941_dc952a76.webp',
    rating: 4.9,
    reviewCount: 94,
    description: 'Premium Promotional Ceramic Mug designed for corporate gifting, office branding, promotional campaigns and everyday use. Made with a glossy ceramic finish, comfortable grip handle and smooth rounded rim. Personalize your mug with your company logo or artwork and create a memorable branded gift.',
    colors: ['#FFFFFF'],
    price: 249,
    mrp: 249,
    priceUnit: '/ pc',
    ctaText: 'Customize Now',
    ctaType: 'orange',
    category: 'Drinkware',
  },
  {
    id: 'bs-promo-table',
    name: 'Promo Table',
    subtitle: 'Portable Promotional Display Counter · Overhead Branding Panel',
    badges: [
      { text: 'Exhibition Ready', color: 'bg-emerald-600' },
      { text: 'White ONLY', color: 'bg-[#FF7A00]' },
    ],
    deliveryTag: '⚡ 24h Ready',
    image: '/assets/promo-table/promo-table-banner.webp',
    rating: 4.9,
    reviewCount: 48,
    description: 'Premium Portable Promo Table designed for exhibitions, promotional campaigns, product demonstrations, retail promotions and trade shows. Features a lightweight yet sturdy structure, spacious counter storage and an overhead branding display panel.',
    colors: ['#FFFFFF'],
    price: 3500,
    mrp: 3500,
    priceUnit: '/ unit',
    ctaText: 'View Details',
    ctaType: 'orange',
    category: 'Display',
  },
  {
    id: 'bs-branding-umbrella',
    name: '5 Feet Promotional Umbrella',
    subtitle: '5 ft (60 in) Width · 7 ft (84 in) Height · Sturdy Tripod Base',
    badges: [
      { text: 'Outdoor Branding', color: 'bg-emerald-600' },
      { text: '4 Colours', color: 'bg-[#FF7A00]' },
    ],
    deliveryTag: '⚡ 24h Ready',
    image: '/assets/aistudio/Custom_Printed_Branding_Umbrella_Banner_ddb8aff0.webp',
    rating: 4.9,
    reviewCount: 36,
    description: 'Premium Custom Printed Branding Umbrella designed for outdoor promotions, exhibitions, retail marketing, product demonstrations, brand activations and promotional events. Features a durable polyester canopy, sturdy tripod base, adjustable height pole and custom printing options.',
    colors: ['#E5252A', '#0A58CA', '#0E9F43', '#FF7A00'],
    price: 1499,
    mrp: 1499,
    priceUnit: '/ unit',
    ctaText: 'View Details',
    ctaType: 'orange',
    category: 'Display',
  },
  {
    id: 'bs-canopy-kiosk',
    name: 'Promotional Canopy Kiosk',
    subtitle: 'Portable Branding Kiosk / Promotion Stall · 4×4 ft & 8×8 ft · 7 ft Height',
    badges: [
      { text: 'Outdoor Branding', color: 'bg-emerald-600' },
      { text: 'Navy Blue ONLY', color: 'bg-[#162B4D]' },
    ],
    deliveryTag: '⚡ 24h Ready',
    image: '/assets/aistudio/Promotional_Canopy_Kiosk_Feature_Graphic_58ea1c0d.webp',
    rating: 4.9,
    reviewCount: 42,
    description: 'Promotional Canopy Kiosk is a portable branding and promotional stall designed for exhibitions, trade shows, retail promotions, outdoor campaigns, and brand activation events. It features a premium navy blue polyester fabric canopy, sturdy metal frame, durable stitching, and stable base support. Available in 4 × 4 ft and 8 × 8 ft sizes, making it ideal for businesses looking for a professional promotional display solution.',
    colors: ['#162B4D'],
    price: 5100,
    mrp: 5100,
    priceUnit: '/ unit',
    ctaText: 'View Details',
    ctaType: 'orange',
    category: 'Display',
  },
  {
    id: 'bs-rollup-standee',
    name: 'Rollup Standee',
    subtitle: 'Retractable Banner Stand · 3 ft × 6 ft (36 × 72 in) · Carry Bag Included',
    badges: [
      { text: 'Corporate Branding', color: 'bg-emerald-600' },
      { text: 'Black ONLY', color: 'bg-zinc-900' },
    ],
    deliveryTag: '⚡ 24h Ready',
    image: '/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp',
    rating: 4.9,
    reviewCount: 56,
    description: 'Rollup Standee is a premium retractable roll-up banner stand with sturdy metal construction, high-quality flex printing, easy tool-free installation, and carry bag included. Ideal for retail stores, exhibitions, trade shows, events, and corporate marketing campaigns.',
    colors: ['#111215'],
    price: 1799,
    mrp: 1799,
    priceUnit: '/ pc',
    ctaText: 'View Details',
    ctaType: 'orange',
    category: 'Display',
  },
  {
    id: 'bs-visiting-card-300gsm',
    name: 'Premium 300 GSM Visiting Card',
    subtitle: '92 × 52 MM · Both Side Printing · White Paper ONLY',
    badges: [
      { text: '300 GSM Art Paper', color: 'bg-emerald-600' },
      { text: 'White ONLY', color: 'bg-[#FF7A00]' },
    ],
    deliveryTag: '⚡ 24h Ready',
    image: '/assets/aistudio/Premium_300_GSM_Business_Cards__1__cc07b248.webp',
    rating: 4.9,
    reviewCount: 320,
    description: 'Premium quality 300 GSM visiting cards printed on smooth art paper with vibrant digital printing, sharp text and professional finishing. Ideal for business owners, professionals, startups and corporate branding.',
    colors: ['#FFFFFF'],
    price: 3,
    mrp: 3,
    priceUnit: '/ card',
    ctaText: 'Customize Design',
    ctaType: 'orange',
    category: 'Stationery',
  },
  {
    id: 'bs-plain-polo',
    name: 'Cotton 230 GSM Plain Polo T-Shirt',
    subtitle: '100% Pure Cotton 230 GSM Solid Ribbed Collar & Cuffs',
    badges: [
      { text: '16 Solid Colours', color: 'bg-[#FF7A00]' },
      { text: 'Min: 2 pcs', color: 'bg-zinc-800' },
    ],
    deliveryTag: '⚡ 24h Ready',
    image: '/assets/aistudio/Classic_Plain_Polo_Color_Collection_17e25f68.webp',
    rating: 4.9,
    reviewCount: 38,
    description: '100% Pure Combed Cotton 230 GSM with classic solid ribbed collar and sleeves without tipping. Breathable, durable, and ready for custom DTF printing or embroidery.',
    colors: [
      '#1B273D', // Navy Blue
      '#FFFFFF', // White
      '#1353BF', // Royal Blue
      '#D61C26', // Red
      '#7A1426', // Maroon
      '#3A3E45', // Charcoal Grey
      '#9A9FA7', // Grey Melange
      '#F4B301', // Golden Yellow
      '#F15A24', // Orange
      '#6CB8EB', // Sky Blue
      '#A4CDE7', // Ice Blue
      '#0F74D4', // True Blue
      '#00A7C7', // Turquoise Blue
      '#00A88F', // Turquoise Green
      '#88C137', // Liril Green
      '#96C964', // Pista Green
    ],
    price: 700,
    mrp: 700,
    priceUnit: '/ pc',
    ctaText: 'Customize Now',
    ctaType: 'orange',
    category: 'Apparel',
  },
  {
    id: 'bs-polo',
    name: 'Premium Tipping Polo T-Shirt',
    subtitle: '100% Cotton 230 GSM with Contrast Tipping Collar & Sleeves',
    badges: [
      { text: 'Contrast Tipping', color: 'bg-[#FF7A00]' },
      { text: 'Min: 2 pcs', color: 'bg-zinc-800' },
    ],
    deliveryTag: '⚡ 24h Ready',
    image: '/assets/products/prod_tipping_polo.webp',
    rating: 4.5,
    reviewCount: 42,
    description: '100% Cotton 230 GSM pique fabric with contrast tipping on collar & sleeves. Breathable, durable, and ready for custom embroidery or DTF print.',
    colors: [
      '#16233B', // Navy Blue / White
      '#111215', // Black / White
      '#1A1A1A', // Black / Red
      '#6B1D2F', // Maroon / White
      '#1548A6', // Royal Blue / White
      '#7CB534', // Apple Green / White
      '#00969E', // Turquoise / White
      '#1E4D6B', // Air Force Blue / White
      '#123826', // Bottle Green / White
      '#43484F', // Charcoal Melange / White
      '#9E9E9E', // Grey Melange / Black
      '#C61B2B', // Red / White
      '#F9FAFB', // White / Navy
      '#FDFDFD', // White / Red
      '#FFFFFF', // White / Royal
    ],
    price: 700,
    mrp: 700,
    priceUnit: '/ pc',
    ctaText: 'Customize Now',
    ctaType: 'orange',
    category: 'Apparel',
  },
  {
    id: 'bs-joab-polo',
    name: 'Mars COOLMAX Polo T-Shirt',
    subtitle: '220 GSM MARS Fabric · High Moisture-Wicking Performance Polo',
    badges: [
      { text: '220 GSM', color: 'bg-emerald-600' },
      { text: '15 Colours', color: 'bg-[#FF7A00]' },
    ],
    deliveryTag: '⚡ 24h Ready',
    image: '/assets/aistudio/JOAB_Coolmax_Polo_Shirt_Showcase_0673e0a4.webp',
    rating: 4.9,
    reviewCount: 52,
    description: 'Engineered with 220 GSM MARS fabric for advanced breathability and moisture-wicking comfort. Available in 15 vibrant corporate colours, sizes S to 3XL, ready for custom logo branding.',
    colors: JOAB_COOLMAX_VARIANTS.map(v => v.hex),
    price: 650,
    mrp: 650,
    priceUnit: '/ pc',
    ctaText: 'Customize Now',
    ctaType: 'orange',
    category: 'Apparel',
  },
  {
    id: 'bs-matty-polo',
    name: 'Matty Polo T-Shirt',
    subtitle: 'Fine Matty Fabric · 230 GSM Premium Soft-Touch & Durable Polo',
    badges: [
      { text: '230 GSM', color: 'bg-emerald-600' },
      { text: '15 Colours', color: 'bg-[#FF7A00]' },
    ],
    deliveryTag: '⚡ 24h Ready',
    image: '/assets/aistudio/Premium_Matty_Polo_T-Shirt_Banner_45dae9b5.webp',
    rating: 4.9,
    reviewCount: 46,
    description: 'Crafted from premium 230 GSM Fine Matty fabric with exceptional soft-touch comfort, breathability, and durability. Ideal for corporate uniforms, casual wear, and custom printing or embroidery in 15 vibrant colours.',
    colors: MATTY_POLO_VARIANTS.map(v => v.hex),
    price: 650,
    mrp: 650,
    priceUnit: '/ pc',
    ctaText: 'Customize Now',
    ctaType: 'orange',
    category: 'Apparel',
  },
  {
    id: 'bs-cotton-flexi-caps',
    name: 'Cotton Flexi Caps',
    subtitle: 'Plain Cotton Baseball Caps · Custom Logo Printing / Embroidery',
    badges: [
      { text: '6 Colours', color: 'bg-[#FF7A00]' },
      { text: 'Min: 1 pc', color: 'bg-zinc-800' },
    ],
    deliveryTag: '⚡ 24h Ready',
    image: '/assets/aistudio/Cotton_Flexi_Caps_Product_Banner_7057e0bd.webp',
    rating: 4.9,
    reviewCount: 168,
    description: 'Premium Cotton Flexi Caps designed for everyday comfort and style. Available in 6 attractive colours, perfect for corporate branding, promotional events, team uniforms and custom logo embroidery.',
    colors: COTTON_FLEXI_CAP_VARIANTS.map(v => v.hex),
    price: 250,
    mrp: 250,
    priceUnit: '/ pc',
    ctaText: 'Customize Now',
    ctaType: 'orange',
    category: 'Apparel',
  },
];

export const PRODUCTS: Product[] = [
  {
    id: 'prod-ceramic-mug',
    slug: 'promotional-ceramic-mug',
    name: 'Promotional Ceramic Mug',
    category: 'drinkware',
    basePrice: 249,
    mrp: 249,
    tieredPricing: [
      { minQty: 5, price: 249, savingsPercent: 0 },
      { minQty: 6, price: 230, savingsPercent: 8 },
      { minQty: 11, price: 199, savingsPercent: 20 },
      { minQty: 26, price: 175, savingsPercent: 30 },
      { minQty: 51, price: 149, savingsPercent: 40 },
    ],
    rating: 4.9,
    reviewCount: 94,
    moq: 5,
    dispatchTime: '24–48 hrs',
    badge: 'White Ceramic ONLY · Custom Logo',
    description: 'Premium Promotional Ceramic Mug designed for corporate gifting, office branding, promotional campaigns and everyday use. Made with a glossy ceramic finish, comfortable grip handle and smooth rounded rim. Personalize your mug with your company logo or artwork and create a memorable branded gift.',
    shortDesc: 'Custom Printed Ceramic Coffee Mug · ~325 ml (11 oz) · 8.5" × 3" Print Area · White ONLY',
    printMethods: ['High-Precision UV', 'Screen Printing', 'DTF Printing'],
    colors: [
      {
        name: 'White',
        hex: '#FFFFFF',
        garmentHex: '#FFFFFF',
        imageFront: '/assets/aistudio/Blank_White_Ceramic_Mug_b82bfadb.webp',
        imageBack: '/assets/mug/mug_back_blank.webp',
        imageSide: '/assets/aistudio/Top-Down_White_Ceramic_Mug_46e962e8.webp',
        imageDimensions: '/assets/aistudio/White_Mug_Dimensions_and_Features_Infographic_47e1f529.webp',
      }
    ],
    features: [
      'Premium Ceramic Material - High-Grade Glossy White Ceramic Body',
      'Vibrant & Long-Lasting Print - Fade-Proof High Definition Logo Printing',
      'Microwave Safe - Heat-Resistant Quality for Hot Coffee & Tea',
      'Dishwasher Safe - Durable Glaze Resisting Everyday Cleaning Cycles',
      'Ideal for Corporate Gifting - Perfect for Client & Employee Welcome Kits',
      'Custom Logo Printing - Expansive 8.5" × 3" Wrap-Around Printable Area'
    ],
    specs: {
      'Product Name': 'Promotional Ceramic Mug',
      'Category': 'Corporate Gifts & Promotional Products',
      'Product Colour': 'White ONLY',
      'Product Type': 'Custom Printed Ceramic Coffee Mug',
      'Product Description': 'Premium Promotional Ceramic Mug designed for corporate gifting, office branding, promotional campaigns and everyday use. Made with a glossy ceramic finish, comfortable grip handle and smooth rounded rim. Personalize your mug with your company logo or artwork and create a memorable branded gift.',
      'Capacity': '~ 325 ml (11 oz)',
      'Mug Width': '3.2 in (8.2 cm)',
      'Mug Height': '3.7 in (9.5 cm)',
      'Printing Area': '8.5 in × 3 in (21.6 cm × 7.6 cm)',
      'Finish': 'Premium Glossy Ceramic Finish',
      'Rim': 'Smooth & Rounded Rim',
      'Handle': 'Comfortable Grip Handle',
      'Base': 'Sturdy & Stable Base',
      'Care': 'Microwave & Dishwasher Safe',
      'MOQ': '5 Pieces (Tiered Pricing up to 100 pcs)'
    },
    productType: 'mug'
  },
  {
    id: 'prod-canopy-kiosk',
    slug: 'promotional-canopy-kiosk',
    name: 'Promotional Canopy Kiosk',
    category: 'signage',
    basePrice: 5100,
    mrp: 5100,
    tieredPricing: [
      { minQty: 1, price: 5100, savingsPercent: 0 },
      { minQty: 3, price: 4500, savingsPercent: 12 },
      { minQty: 6, price: 4200, savingsPercent: 18 },
    ],
    rating: 4.9,
    reviewCount: 42,
    moq: 1,
    dispatchTime: '24–48 hrs',
    badge: 'Navy Blue ONLY · 4×4 & 8×8 ft',
    description: 'Promotional Canopy Kiosk is a portable branding and promotional stall designed for exhibitions, trade shows, retail promotions, outdoor campaigns, and brand activation events. It features a premium navy blue polyester fabric canopy, sturdy metal frame, durable stitching, and stable base support. Available in 4 × 4 ft and 8 × 8 ft sizes, making it ideal for businesses looking for a professional promotional display solution.',
    shortDesc: 'Portable Branding Kiosk / Promotion Stall · Navy Blue ONLY · 4 × 4 ft & 8 × 8 ft · 7 ft Height',
    printMethods: ['High-Precision UV', 'Screen Printing', 'DTF Printing'],
    sizes: ['4 × 4 ft', '8 × 8 ft'],
    colors: [
      {
        name: 'Navy Blue',
        hex: '#162B4D',
        garmentHex: '#162B4D',
        imageFront: '/assets/aistudio/7_7_ft_Blue_Canopy_Booth_Infographic_3ac991cf.webp',
      }
    ],
    features: [
      'Premium Polyester Fabric - High-Quality Weather & Fade Resistant Fabric Canopy',
      'Heavy-Duty & Sturdy Frame - Reinforced Metal Frame Engineered for Maximum Stability',
      'Easy Assembly - Tool-Free Quick Kiosk Setup in Under 5 Minutes',
      'Lightweight & Portable - Compact Foldable Design for Easy Transportation',
      'Reusable & Long Lasting - Durable Heavy-Duty Stitching & Stable Base Support',
      'Custom Branding Available - Precision Logo Printing on Canopy Valance & Lower Walls'
    ],
    specs: {
      'Product Name': 'Promotional Canopy Kiosk',
      'Category': 'Promotional Products & Outdoor Branding',
      'Product Type': 'Portable Branding Kiosk / Promotion Stall',
      'Product Colour': 'Navy Blue ONLY',
      'Available Sizes': '4 × 4 ft (48 × 48 in) and 8 × 8 ft (96 × 96 in)',
      'Overall Height': '7 ft (84 inches)',
      'Fabric Material': 'High-Quality Water-Resistant Polyester Fabric Canopy with Durable Stitching',
      'Structure Frame': 'Heavy-Duty & Sturdy Metal Frame with Stable Base Support Footings',
      'Assembly Type': 'Tool-Free Quick Assembly & Collapsible Portability',
      'Custom Branding': 'Full Custom Logo & Artwork Printing on Fabric Panels',
      'Recommended Usage': 'Exhibitions, Trade Shows, Retail Promotions, Outdoor Campaigns, Brand Activations',
      'MOQ': '1 Unit (Max: 10 units, Quote for larger quantities)'
    },
    productType: 'canopy'
  },
  {
    id: 'prod-rollup-standee',
    slug: 'rollup-standee',
    name: 'Rollup Standee',
    category: 'signage',
    basePrice: 1799,
    mrp: 1799,
    tieredPricing: [
      { minQty: 1, price: 1799, savingsPercent: 0 },
      { minQty: 3, price: 1599, savingsPercent: 11 },
      { minQty: 6, price: 1499, savingsPercent: 17 },
      { minQty: 11, price: 1399, savingsPercent: 22 },
    ],
    rating: 4.9,
    reviewCount: 56,
    moq: 1,
    dispatchTime: '24–48 hrs',
    badge: 'Black ONLY · 3 × 6 ft',
    description: 'Rollup Standee is a premium retractable roll-up banner stand engineered for retail stores, exhibitions, trade shows, events, corporate branding, and marketing campaigns. Made with high-quality flex printing and a sturdy aluminum metal stand, it offers easy tool-free installation in minutes, lightweight portability, and includes a durable carry bag for effortless transport.',
    shortDesc: 'Retractable Roll-up Banner Stand · 3 ft × 6 ft (36 × 72 in) · Black ONLY · Carry Bag Included',
    printMethods: ['High-Precision UV', 'Screen Printing'],
    sizes: ['3 ft × 6 ft (36 × 72 in)'],
    colors: [
      {
        name: 'Black',
        hex: '#111215',
        garmentHex: '#111215',
        imageFront: '/assets/standee/front.webp',
        imageBack: '/assets/standee/back.webp',
        imageDimensions: '/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp'
      }
    ],
    features: [
      'Premium Metal Stand - Strong & Durable Sturdy Aluminum Construction',
      'High-Quality Flex Printing - Vibrant & Clear High-Definition Graphic Resolution',
      'Easy to Install - Quick Tool-Free Setup in Minutes',
      'Lightweight & Portable - Compact Retractable Mechanism for Carrying Anywhere',
      'Carry Bag Included - Heavy-Duty Padded Protective Carry Case for Easy Transport',
      'Ideal for Events, Exhibitions, Shops, Retail Promotions & Corporate Marketing Campaigns',
      'Product Colour - Black ONLY'
    ],
    specs: {
      'Product Name': 'Rollup Standee',
      'Category': 'Corporate Branding / Promotional Products',
      'Product Type': 'Retractable Roll-up Banner Stand',
      'Product Colour': 'Black ONLY',
      'Available Size': '3 ft Width × 6 ft Height (36 × 72 inches)',
      'Stand Material': 'Heavy-Duty Premium Metal Aluminium Alloy Base & Telescopic Pole',
      'Banner Media': 'Premium-Quality Flexible Tear-Resistant Flex Media with Vivid Color Printing',
      'Base Mechanism': 'Smooth Retractable Spring-Loaded Roller Cassette with Dual Rotating Stabilizing Feet',
      'Installation': 'Instant Tool-Free Setup & Take Down in under 2 Minutes',
      'Portability': 'Lightweight Foldable Profile with Protective Oxford Nylon Carry Bag Included',
      'Recommended Usage': 'Retail Stores, Exhibitions, Trade Shows, Events, Promotions, Corporate Branding, Marketing Campaigns',
      'MOQ': '1 Piece (Max: 20 pcs, Quote for larger quantities)'
    },
    productType: 'standee'
  },
  {
    id: 'prod-visiting-card-300gsm',
    slug: 'premium-300-gsm-visiting-card',
    name: 'Premium 300 GSM Visiting Card',
    category: 'stationery',
    basePrice: 3,
    mrp: 3,
    tieredPricing: [
      { minQty: 1, price: 3.0, savingsPercent: 0 },
      { minQty: 201, price: 2.0, savingsPercent: 33 },
      { minQty: 500, price: 1.5, savingsPercent: 50 },
      { minQty: 1001, price: 1.0, savingsPercent: 67 },
    ],
    rating: 4.9,
    reviewCount: 320,
    moq: 100,
    dispatchTime: '24–48 hrs',
    badge: '300 GSM Art Paper · White ONLY',
    description: 'Premium quality 300 GSM visiting cards printed on smooth art paper with vibrant digital printing, sharp text and professional finishing. Ideal for business owners, professionals, startups and corporate branding.',
    shortDesc: '300 GSM Art Paper · 92 × 52 MM · Both Side Digital Print · White Paper ONLY',
    printMethods: ['High-Precision UV', 'Screen Printing', 'DTF Printing'],
    colors: [
      {
        name: 'White',
        hex: '#FFFFFF',
        garmentHex: '#FFFFFF',
        imageFront: '/assets/aistudio/Blank_Business_Card_Stack_Mockup_1cf3577a.webp',
        imageBack: '/assets/aistudio/Stacked_Blank_Business_Cards_5668bb6f.webp',
        imageDimensions: '/assets/aistudio/Premium_300_GSM_Business_Cards__1__cc07b248.webp'
      }
    ],
    features: [
      'Paper Quality - Premium Heavyweight 300 GSM Smooth Art Paper',
      'Both Side Printing - Full Color High-Definition Digital Press Front & Back',
      'Exact Dimensions - Standard 92 MM (Width) × 52 MM (Height) Trim',
      'Bleed Guide - 3 MM Bleed Specification (98 × 58 MM) for Perfect Cutting',
      'Smooth Art Paper Finish - Elegant Tactile Feel with Clean Die-Cut Edges',
      'White Paper Base ONLY - High-Contrast Solid White Base for Vibrant Multi-Color Printing',
      'Custom Artwork - Independent Front and Back Customer File Upload (PNG, JPG, PDF)'
    ],
    specs: {
      'Product Name': 'Premium 300 GSM Visiting Card',
      'Category': 'Corporate Gifts & Promotional Products',
      'Paper Quality': 'Premium Art Paper',
      'Paper Thickness': '300 GSM Stiff Cardstock',
      'Finished Dimensions': '92 MM Width × 52 MM Height',
      'Dimensions with Bleed': '98 MM × 58 MM (3 MM Bleed)',
      'Printing Type': 'Both Side Full-Color Digital Printing',
      'Paper Finish': 'Smooth Art Paper Finish',
      'Print Resolution': 'High-Quality 300 DPI Digital Press',
      'Base Colour': 'WHITE ONLY (White Paper Base)',
      'Artwork Customization': 'Independent Front & Back Customer Upload',
      'Minimum Order Quantity': '100 Pieces (Pack of 100)'
    },
    productType: 'visiting-card'
  },
  {
    id: 'prod-promo-table',
    slug: 'promo-table',
    name: 'Promo Table',
    category: 'signage',
    basePrice: 3500,
    mrp: 3500,
    tieredPricing: [
      { minQty: 1, price: 3500, savingsPercent: 0 },
      { minQty: 3, price: 3300, savingsPercent: 6 },
      { minQty: 6, price: 3100, savingsPercent: 11 },
    ],
    rating: 4.9,
    reviewCount: 48,
    moq: 1,
    dispatchTime: '24–48 hrs',
    badge: 'White ONLY · Exhibition Ready',
    description: 'Premium Portable Promo Table designed for exhibitions, promotional campaigns, product demonstrations, retail promotions and trade shows. Features a lightweight yet sturdy structure, spacious counter storage and an overhead branding display panel. Easy to assemble, portable and suitable for professional promotional activities.',
    shortDesc: 'Portable Promotional Display Counter · Overhead Header Panel · White Only',
    printMethods: ['High-Precision UV', 'Screen Printing'],
    colors: [
      {
        name: 'White',
        hex: '#FFFFFF',
        garmentHex: '#FFFFFF',
        imageFront: '/assets/promo-table/front.webp',
        imageBack: '/assets/promo-table/back.webp',
        imageSide: '/assets/promo-table/side.webp',
        imageDimensions: '/assets/promo-table/dimensions.webp'
      }
    ],
    features: [
      'Brand Promotion - Overhead Header Display Panel (31" × 10.3")',
      'Lightweight & Portable - Foldable Structure with Carry Bag',
      'Quick Setup - Tool-Free Instant Assembly in 3 Minutes',
      'Reusable & Durable - High-Impact Polypropylene & Steel Rods',
      'Spacious Counter Storage with Two-Tier Shelving',
      'Suitable for Exhibitions, Mall Activations & Retail Promos',
      'Product Colour - White ONLY'
    ],
    specs: {
      'Product Name': 'Promo Table',
      'Category': 'Promotional Display & Marketing Products',
      'Product Colour': 'White ONLY',
      'Product Type': 'Portable Promotional Display Counter',
      'Overall Height': '63.2 inches',
      'Counter Height': '30.3 inches',
      'Counter Width': '31.6 inches',
      'Top Header Width': '31 inches',
      'Top Header Height': '10.3 inches',
      'Structure': 'Two-tier storage shelf, collapsible body, twin upright steel poles',
      'Material': 'High-Impact Polypropylene & Heavy-Duty Steel Support Rods',
      'Assembly': 'Tool-free quick setup in under 3 minutes',
      'Carrying Case': 'Heavy-duty nylon carry bag included',
      'MOQ': '1 Unit (Max: 10 units, Quote for larger quantities)'
    },
    productType: 'display'
  },
  {
    id: 'prod-branding-umbrella',
    slug: 'custom-printed-branding-umbrella',
    name: '5 Feet Promotional Umbrella',
    category: 'signage',
    basePrice: 1499,
    mrp: 1499,
    tieredPricing: [
      { minQty: 1, price: 1499, savingsPercent: 0 },
      { minQty: 3, price: 1399, savingsPercent: 7 },
      { minQty: 6, price: 1350, savingsPercent: 10 },
      { minQty: 11, price: 1199, savingsPercent: 20 },
    ],
    rating: 4.9,
    reviewCount: 36,
    moq: 1,
    dispatchTime: '24–48 hrs',
    badge: 'Outdoor Branding · 4 Colours',
    description: 'Premium Custom Printed 5 Feet Promotional Umbrella designed for outdoor promotions, exhibitions, retail marketing, product demonstrations, brand activations and promotional events. Features a durable polyester canopy, sturdy tripod base, adjustable height pole and custom printing options to showcase your brand professionally.',
    shortDesc: 'Custom Printed Promotional Umbrella with Stand · 5 ft (60 in) Width · 7 ft (84 in) Height',
    printMethods: ['Screen Printing', 'DTF Printing'],
    colors: [
      {
        name: 'Red + White',
        hex: '#E5252A',
        garmentHex: '#E5252A',
        tippingHex: '#FFFFFF',
        imageFront: '/assets/umbrella/red-dimensions.webp',
      },
      {
        name: 'Blue + White',
        hex: '#0A58CA',
        garmentHex: '#0A58CA',
        tippingHex: '#FFFFFF',
        imageFront: '/assets/umbrella/blue-dimensions.webp',
      },
      {
        name: 'Green + White',
        hex: '#0E9F43',
        garmentHex: '#0E9F43',
        tippingHex: '#FFFFFF',
        imageFront: '/assets/umbrella/green-dimensions.webp',
      },
      {
        name: 'Orange + White',
        hex: '#FF7A00',
        garmentHex: '#FF7A00',
        tippingHex: '#FFFFFF',
        imageFront: '/assets/umbrella/orange-dimensions.webp',
      }
    ],
    features: [
      'Premium Polyester Fabric - Water Resistant & Weather Proof',
      'UV Protection - High Sun Block & Heat Reduction',
      'Wind Resistant - Reinforced Heavy-Duty Rib Framework',
      'Easy Setup - Tool-Free Instant Tripod Assembly in 2 Minutes',
      'Lightweight & Portable - Compact Foldable Design with Carry Case',
      'Reusable & Durable - Long-Lasting Steel Telescopic Pole'
    ],
    specs: {
      'Product Name': '5 Feet Promotional Umbrella',
      'Category': 'Promotional Products & Outdoor Branding',
      'Product Type': 'Custom Printed Promotional Umbrella with Stand',
      'Umbrella Width': '5 ft (60 inches)',
      'Overall Height': '7 ft (84 inches)',
      'Canopy Fabric': 'Water-Resistant Premium Polyester Fabric with UV Shield',
      'Base Support': 'Heavy-Duty Folding Metal Tripod Stand Included',
      'Center Pole': 'Adjustable Height Telescopic Steel Pole with Secure Lock',
      'Internal Ribs': 'Strong & Durable Wind-Resistant Rib Framework',
      'Available Colours': 'Red + White, Blue + White, Green + White, Orange + White',
      'Printing Options': 'Custom Logo & Text Printing (All 8 Panels / Valance)',
      'Assembly': 'Tool-Free Quick Setup in 2 Minutes',
      'Carrying Bag': 'Heavy-Duty Portable Protective Bag Included',
      'MOQ': '1 Unit (Max: 20 pcs, Quote for larger quantities)'
    },
    productType: 'umbrella'
  },
  {
    id: 'prod-plain-polo',
    slug: 'customized-plain-polo-t-shirt',
    name: 'Cotton 230 GSM Plain Polo T-Shirt With Your Company Logo | Solid Color Corporate Polo | TeqqnoWorld',
    category: 'apparel',
    basePrice: 700,
    mrp: 700,
    tieredPricing: [
      { minQty: 2, price: 700, savingsPercent: 0 },
      { minQty: 3, price: 670, savingsPercent: 4 },
      { minQty: 6, price: 650, savingsPercent: 7 },
      { minQty: 11, price: 600, savingsPercent: 14 },
      { minQty: 21, price: 550, savingsPercent: 21 },
      { minQty: 51, price: 500, savingsPercent: 29 },
      { minQty: 76, price: 450, savingsPercent: 36 },
    ],
    rating: 4.9,
    reviewCount: 38,
    moq: 2,
    dispatchTime: '24–48 hrs',
    badge: '16 Solid Colours',
    description: '100% Premium Pure Cotton 230 GSM pique matty with solid color-matched ribbed collar and cuffs (no tipping). Breathable, ultra-soft, colorfast, and crafted for corporate uniforms, team apparel, and professional branding.',
    shortDesc: '230 GSM 100% Pure Cotton · Solid Ribbed Collar & Cuffs · 16 Vibrant Colours',
    printMethods: ['DTF Printing', 'Precision Embroidery', 'Screen Printing'],
    colors: getPlainPoloProductColors(),
    sizes: ['S (36)', 'M (38)', 'L (40)', 'XL (42)', '2XL (44)', '3XL (46)', '4XL (48)'],
    features: [
      'Tshirts Material - 100% Pure Combed Cotton',
      '230 GSM Heavy Pique Matty',
      'Printing - DTF Printing & Tajima Embroidery',
      'Solid Ribbed Collar & Cuffs (No Tipping)',
      'Soft & Breathable Fabric',
      'Perfect for Corporate & Daily Wear'
    ],
    specs: {
      'Material': '100% Pure Combed Cotton',
      'Weight': '230 GSM Pique Matty',
      'Collar & Sleeve': 'Solid Ribbed Collar & Cuffs (No Contrast Tipping)',
      'Printing Technology': 'Direct-to-Film (DTF) & Tajima Embroidery',
      'Fit': 'Regular Comfort Fit',
      'Wash Care': 'Bio-washed, Machine wash cold, do not iron on print',
      'MOQ': '2 Pieces (Max: 100 pcs, Quote for larger quantities)'
    },
    productType: 'polo'
  },
  {
    id: 'prod-polo-01',
    slug: 'customized-100-pure-cotton-polo-t-shirt',
    name: 'Customized 100% Pure Cotton Polo T-Shirt With Your Company Logo | Order Logo Printed Tees | TeqqnoWorld',
    category: 'apparel',
    basePrice: 700,
    mrp: 700,
    tieredPricing: [
      { minQty: 2, price: 700, savingsPercent: 0 },
      { minQty: 3, price: 670, savingsPercent: 4 },
      { minQty: 6, price: 650, savingsPercent: 7 },
      { minQty: 11, price: 600, savingsPercent: 14 },
      { minQty: 21, price: 550, savingsPercent: 21 },
      { minQty: 51, price: 500, savingsPercent: 29 },
      { minQty: 76, price: 450, savingsPercent: 36 },
    ],
    rating: 4.5,
    reviewCount: 42,
    moq: 2,
    dispatchTime: '24–48 hrs',
    badge: '15 Vibrant Colours',
    description: '100% Premium Pure Cotton 230 GSM pique fabric with contrast tipping on collar and sleeves. Breathable, durable, soft on skin, and crafted for everyday comfort and professional corporate branding.',
    shortDesc: '230 GSM 100% Pure Cotton · Contrast Tipping Collar & Sleeves · 15 Vibrant Colours',
    printMethods: ['DTF Printing', 'Precision Embroidery', 'Screen Printing'],
    colors: getTippingPoloProductColors(),
    sizes: ['S (36)', 'M (38)', 'L (40)', 'XL (42)', '2XL (44)', '3XL (46)', '4XL (48)'],
    features: [
      'Tshirts Material - 100% Pure Cotton',
      '230 GSM',
      'Printing - DTF Printing',
      'Soft & Breathable Fabric',
      'Perfect for Daily Wear'
    ],
    specs: {
      'Material': '100% Pure Combed Cotton',
      'Weight': '230 GSM Premium Pique Fabric',
      'Collar & Sleeve': 'Ribbed with Contrast Tipping',
      'Printing Technology': 'Direct-to-Film (DTF) & Tajima Embroidery',
      'Fit': 'Regular Comfort Fit',
      'Wash Care': 'Bio-washed, Machine wash cold, do not iron on print',
      'MOQ': '2 Pieces (Max: 100 pcs, Quote for larger quantities)'
    },
    productType: 'polo'
  },
  {
    id: 'prod-joab-coolmax',
    slug: 'joab-coolmax-polo-t-shirt',
    name: 'Mars COOLMAX Polo T-Shirt – 220 GSM MARS Fabric | Custom Logo Printing | TeqqnoWorld',
    category: 'apparel',
    basePrice: 650,
    mrp: 650,
    tieredPricing: [
      { minQty: 2, price: 650, savingsPercent: 0 },
      { minQty: 3, price: 600, savingsPercent: 8 },
      { minQty: 6, price: 530, savingsPercent: 18 },
      { minQty: 11, price: 500, savingsPercent: 23 },
      { minQty: 21, price: 450, savingsPercent: 31 },
      { minQty: 51, price: 430, savingsPercent: 34 },
      { minQty: 76, price: 399, savingsPercent: 39 },
    ],
    rating: 4.9,
    reviewCount: 52,
    moq: 2,
    dispatchTime: '24–48 hrs',
    badge: '220 GSM · 15 Colours',
    description: 'Engineered with cutting-edge 220 GSM MARS performance fabric, the Mars COOLMAX Polo T-Shirt offers superior moisture-wicking breathability, quick-drying comfort, and high color retention. Built for corporate teams, sports staff, and executive apparel with 15 vibrant colour options and precision custom logo branding.',
    shortDesc: '220 GSM MARS Fabric · High Moisture-Wicking · 15 Vibrant Colours · S–3XL',
    printMethods: ['DTF Printing', 'Precision Embroidery', 'Screen Printing'],
    colors: getJoabCoolmaxProductColors(),
    sizes: ['S (36)', 'M (38)', 'L (40)', 'XL (42)', '2XL (44)', '3XL (46)'],
    features: [
      'Brand - JOAB',
      'Fabric - 220 GSM MARS Performance Fabric',
      'High Moisture Wicking & Quick Dry',
      'Printing - DTF Printing & Tajima Embroidery',
      'Solid Ribbed Collar & Cuffs',
      '15 Vibrant Corporate Colours',
      'Sizes S (36) to 3XL (46)'
    ],
    specs: {
      'Brand': 'JOAB',
      'Product Category': 'Polo T-Shirts',
      'Fabric': 'MARS Performance Fabric',
      'Weight': '220 GSM',
      'Collar & Sleeve': 'Solid Ribbed Collar & Sleeves (No Tipping)',
      'Printing Technology': 'Direct-to-Film (DTF) & Tajima Embroidery',
      'Fit': 'Athletic Corporate Comfort Fit',
      'Sizes Available': 'S (36), M (38), L (40), XL (42), 2XL (44), 3XL (46)',
      'Wash Care': 'Bio-washed, Machine wash cold, do not iron on print',
      'MOQ': '2 Pieces (Max: 100 pcs, Quote for larger quantities)'
    },
    productType: 'polo'
  },
  {
    id: 'prod-matty-polo',
    slug: 'matty-polo-t-shirt',
    name: 'Matty Polo T-Shirt – 230 GSM Fine Matty Fabric | Custom Logo Printing | TeqqnoWorld',
    category: 'apparel',
    basePrice: 650,
    mrp: 650,
    tieredPricing: [
      { minQty: 2, price: 650, savingsPercent: 0 },
      { minQty: 3, price: 600, savingsPercent: 8 },
      { minQty: 6, price: 530, savingsPercent: 18 },
      { minQty: 11, price: 500, savingsPercent: 23 },
      { minQty: 21, price: 450, savingsPercent: 31 },
      { minQty: 51, price: 400, savingsPercent: 38 },
      { minQty: 76, price: 350, savingsPercent: 46 },
    ],
    rating: 4.9,
    reviewCount: 46,
    moq: 2,
    dispatchTime: '24–48 hrs',
    badge: '230 GSM · 15 Colours',
    description: 'Crafted from premium 230 GSM Fine Matty fabric with superior soft-touch texture, breathability, and long-lasting durability. Designed for everyday, casual and office wear, and optimized for high-definition custom printing and embroidery across 15 versatile corporate colours.',
    shortDesc: '230 GSM Fine Matty Fabric · Soft-Touch & Breathable · 15 Vibrant Colours · S–4XL',
    printMethods: ['DTF Printing', 'Precision Embroidery', 'Screen Printing'],
    colors: getMattyPoloProductColors(),
    sizes: ['S (36)', 'M (38)', 'L (40)', 'XL (42)', '2XL (44)', '3XL (46)', '4XL (48)'],
    features: [
      'Fabric - Fine Matty Fabric',
      'Weight - 230 GSM',
      'Premium soft-touch fabric',
      'Breathable and comfortable',
      'Durable and long-lasting',
      'Suitable for everyday, casual and office wear',
      'Suitable for custom printing and embroidery',
      'Solid Ribbed Collar & Cuffs (No Tipping)',
      '15 Vibrant Corporate Colours',
      'Sizes S (36) to 4XL (48)'
    ],
    specs: {
      'Product Name': 'Matty Polo T-Shirt',
      'Product Category': 'Polo T-Shirts',
      'Fabric': 'Fine Matty Fabric',
      'Weight': '230 GSM',
      'Collar & Sleeve': 'Solid Ribbed Collar & Cuffs (No Contrast Tipping)',
      'Printing Technology': 'Direct-to-Film (DTF) & Tajima Embroidery',
      'Fit': 'Regular Comfort Fit',
      'Sizes Available': 'S (36), M (38), L (40), XL (42), 2XL (44), 3XL (46), 4XL (48)',
      'Wash Care': 'Bio-washed, Machine wash cold, do not iron on print',
      'MOQ': '2 Pieces (Max: 100 pcs, Quote for larger quantities)'
    },
    productType: 'polo'
  },
  {
    id: 'prod-cotton-flexi-caps',
    slug: 'cotton-flexi-caps',
    name: 'Cotton Flexi Caps – Plain Cotton Baseball Caps | Custom Logo Printing / Embroidery | TeqqnoWorld',
    category: 'apparel',
    basePrice: 250,
    mrp: 250,
    tieredPricing: [
      { minQty: 1, price: 250, savingsPercent: 0 },
      { minQty: 10, price: 199, savingsPercent: 20 },
      { minQty: 26, price: 175, savingsPercent: 30 },
      { minQty: 51, price: 155, savingsPercent: 38 },
      { minQty: 101, price: 145, savingsPercent: 42 },
      { minQty: 151, price: 135, savingsPercent: 46 },
    ],
    rating: 4.9,
    reviewCount: 168,
    moq: 1,
    dispatchTime: '24–48 hrs',
    badge: '6 Colours · Custom Logo',
    description: 'Premium Cotton Flexi Caps designed for everyday comfort and style. Available in 6 attractive colours, perfect for corporate branding, promotional events, team uniforms and custom logo embroidery. Features pure breathable cotton fabric, pre-curved concertina stitched visor, structured front crown, and an adjustable strap.',
    shortDesc: '100% Breathable Cotton · Front Panel Logo Placement · 6 Colours · Adjustable Fit',
    printMethods: ['Precision Embroidery', 'DTF Printing'],
    colors: getCapProductColors(),
    features: [
      'Product - Cotton Flexi Caps',
      'Fabric - 100% Breathable Cotton Twill',
      'Style - Adjustable Baseball Cap with Pre-Curved Visor',
      'Front Panel Custom Logo Printing & Tajima 3D Embroidery',
      'Available in 6 Attractive Colours (Black, Navy Blue, Red, Gray, Yellow, White)',
      'Adjustable Strap – Universal Free Size (One Size Fits Most)',
      'Durable Stitched Eyelets & Sweatband Interior'
    ],
    specs: {
      'Product Name': 'Cotton Flexi Caps',
      'Product Category': 'Caps & Headwear',
      'Product Style': 'Adjustable Baseball Cap',
      'Fabric': '100% Breathable Cotton',
      'Panels': '6-Panel Mid-Profile Construction',
      'Visor': 'Pre-Curved Concertina Stitched Visor',
      'Closure': 'Adjustable Flexi Buckle Strap',
      'Size': 'Universal Adjustable (Free Size)',
      'Customization': 'Front Panel Custom Logo Printing / Precision Embroidery',
      'Colours Available': 'Black, Navy Blue, Red, Gray, Yellow, White',
      'MOQ': '1 Piece (Max: 200 pcs, Quote for larger quantities)'
    },
    productType: 'cap'
  }
];

export const WORKFLOW_3_STEPS = [
  {
    step: '01',
    title: 'Choose Your Product & Share Your Logo',
    desc: 'Select your merchandise, choose your preferred options, and upload your logo or artwork.',
    footer: 'Product Selection · Logo Upload',
  },
  {
    step: '02',
    title: 'Review Your Design Proof',
    desc: 'Review your digital product preview and request any required adjustments before production begins.',
    footer: 'Preview · Review · Approval',
  },
  {
    step: '03',
    title: 'Production, Packing & Delivery',
    desc: 'After design approval, your order moves to production, careful packing, and dispatch.',
    footer: 'Production · Quality Check · Dispatch',
  },
];

export const ADVANTAGES_4 = [
  {
    stage: '01',
    num: 1,
    title: 'Precision Manufacturing',
    desc: 'Consistent branding and carefully produced merchandise.',
    icon: 'precision-manufacturing',
    color: 'bg-orange-50 text-[#FF7A00] border-orange-200',
    accentColor: '#FF7A00',
    tag: 'Production'
  },
  {
    stage: '02',
    num: 2,
    title: 'Quality Checked',
    desc: 'We check fabric, colours, prints, and finishing before dispatch.',
    icon: 'quality-checked',
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    accentColor: '#10B981',
    tag: 'Inspection'
  },
  {
    stage: '03',
    num: 3,
    title: 'Flexible Quantities',
    desc: 'Choose quantities that fit your team, event, or business needs.',
    icon: 'flexible-quantities',
    color: 'bg-purple-50 text-purple-600 border-purple-200',
    accentColor: '#8B5CF6',
    tag: 'Scalability'
  },
  {
    stage: '04',
    num: 4,
    title: 'Order Updates & Delivery',
    desc: 'Stay informed about your order’s progress and dispatch.',
    icon: 'order-updates',
    color: 'bg-blue-50 text-blue-600 border-blue-200',
    accentColor: '#3B82F6',
    tag: 'Tracking'
  },
];

export const REVIEWS_LIST = [
  {
    quote: 'We ordered 250 polo t-shirts and magnetic badges for our annual developers conference in Bengaluru. The embroidery precision on the chest was incredible, and dispatch took just 3 days.',
    author: 'Aman Kumar Dhaka',
    role: 'Fintech Operations • 250 Polo Shirts',
    badge: 'Verified Buyer',
    avatar: 'AK',
  },
  {
    quote: 'The luxury soft-touch visiting cards with gold foil and the employee onboarding welcome kits blew our team away. The free 3D digital mockup within an hour saved us days of back-and-forth.',
    author: 'Jyoshna Reddy',
    role: 'Head of People • Onboarding Kits',
    badge: 'Verified Enterprise',
    avatar: 'JR',
  },
  {
    quote: 'Ordered 50 corporate gift boxes with laser engraved bottles and diaries for Diwali. Packaged neatly in individual gift boxes, direct GST input tax invoice supplied without having to follow up.',
    author: 'Chaitanya Asoori',
    role: 'Director • VIP Gift Boxes',
    badge: 'Verified Buyer',
    avatar: 'CA',
  },
];

export const FAQ_LIST = [
  {
    num: '01',
    q: 'What artwork and logo file formats do you accept?',
    a: 'We accept all standard high-resolution file formats: AI (Adobe Illustrator), EPS, SVG, PDF, PSD, and transparent background PNG files (300 DPI recommended). If you only have a low-resolution JPG, our in-house graphics prepress team will redraw and vector-convert it for you before production.',
  },
  {
    num: '02',
    q: 'Can I review a design proof before full printing starts?',
    a: 'Yes, absolutely. We operate a strict 100% digital proof sign-off policy. Within 1 hour of receiving your artwork, our prepress team shares an exact 1:1 scale millimeter-precise digital proof showing color Pantone codes and print boundary coordinates. We never start machine production until you click "Approve Proof".',
  },
  {
    num: '03',
    q: 'What is the typical production and delivery turnaround time?',
    a: 'Standard catalog lines (polos, round-neck tees, caps, and visiting cards) are manufactured and dispatched in 24–48 hours from digital proof approval. Air delivery to Mumbai, Bengaluru, Delhi-NCR, Hyderabad, and Pune arrives within 24–48 hours via Delhivery Express. Customized gift hampers take 3–5 working days.',
  },
  {
    num: '04',
    q: 'Do you provide proper B2B GST tax invoices for input credit?',
    a: 'Yes! TeqqnoWorld is an Indian registered corporate entity. Every order generates a compliant Tax Invoice showing your 15-digit company GSTIN with SAC code 9989 (custom printing services). You can claim the full 18% GST Input Tax Credit (ITC) directly in your monthly GSTR-2B filings.',
  },
  {
    num: '05',
    q: 'Can I request a physical sample kit before placing a bulk order?',
    a: 'Yes. For corporate orders exceeding 50 units, you can order a single sample unit directly through our portal or request a dedicated Swatch & Material Kit containing fabric swatches, collar samples, and print technique swatches dispatched directly to your office.',
  },
  {
    num: '06',
    q: 'Can I order different products for my company or event?',
    a: 'Yes! You can mix and match apparel, welcome kit gift sets, ID cards, drinkware, and stationery in a single consolidated purchase order. Each category will be coordinated under one dedicated account manager and unified shipping dispatch.',
  },
  {
    num: '07',
    q: 'Do bulk orders receive special pricing?',
    a: 'Our prices automatically discount based on order quantity milestones (e.g. 25, 50, 100, 250, and 500+ units). Discounts can reach up to 40% off standard catalog rates. You can view dynamic live pricing tiers right on each product page or request a custom quotation.',
  },
  {
    num: '08',
    q: 'How can I check my order status?',
    a: 'Once your order is confirmed, you can track real-time milestones directly in your TeqqnoWorld dashboard—from Artwork Review, Pre-press Proof Approval, Printing, and Quality Inspection, to dispatch with live courier tracking links.',
  },
];

export const INITIAL_MOCK_ORDER: Order = {
  id: 'order-tq-98104',
  orderNumber: 'TQ-98104',
  createdAt: '2026-10-24T10:30:00Z',
  items: [
    {
      id: 'cart-item-1',
      product: PRODUCTS[0],
      color: PRODUCTS[0].colors[0],
      size: 'L',
      quantity: 50,
      unitPrice: 399,
      totalPrice: 19950,
      printMethod: 'Precision Embroidery',
      printPlacement: 'Left Chest',
      artwork: {
        type: 'preset',
        presetId: 'your-logo',
        text: 'YOUR LOGO HERE',
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0
      }
    }
  ],
  subtotal: 19950,
  gstRate: 0.18,
  gstAmount: 3591,
  shippingFee: 0,
  total: 23541,
  shippingAddress: {
    fullName: 'Aman Kumar Dhaka',
    companyName: 'FinPulse Technologies Pvt Ltd',
    email: 'aman@finpulse.in',
    phone: '+91 8309394934',
    street: 'Plot 42, HSR Layout Sector 1',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560102',
    gstin: '29AAACN1234F1Z8',
    isB2BInvoice: true
  },
  proofStatus: 'Proof Ready - Needs Approval',
  orderStatus: 'Artwork Verification',
  estimatedDispatch: '2026-10-26',
  trackingNumber: 'DLV-EXP-8920194812',
  courierPartner: 'Delhivery Express',
  paymentMode: 'Test Gateway (Pre-Integration)',
  paymentStatus: 'Test Authenticated (Sandbox)'
};

export const MOCK_SAVED_ADDRESSES: SavedAddress[] = [
  {
    id: 'addr-1',
    title: 'Headquarters / Bengaluru',
    fullName: 'Aman Kumar Dhaka',
    companyName: 'FinPulse Technologies Pvt Ltd',
    phone: '+91 8309394934',
    street: 'Plot 42, 3rd Floor, HSR Layout Sector 1, Outer Ring Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560102',
    isDefault: true,
    type: 'both',
  },
  {
    id: 'addr-2',
    title: 'Regional Fulfillment Hub',
    fullName: 'Divya Sharma (Procurement Lead)',
    companyName: 'FinPulse Technologies Pvt Ltd',
    phone: '+91 98450 12345',
    street: 'Building 7A, DLF Cyber City, Phase 3',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122002',
    isDefault: false,
    type: 'shipping',
  },
  {
    id: 'addr-3',
    title: 'Registered Corporate Office',
    fullName: 'Accounts Dept - FinPulse',
    companyName: 'FinPulse Technologies Pvt Ltd',
    phone: '+91 8309394934',
    street: '1402, Trade Tower, Bandra Kurla Complex',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400051',
    isDefault: false,
    type: 'billing',
  }
];

export const MOCK_ARTWORKS: CustomerArtwork[] = [
  {
    id: 'art-01',
    title: 'FinPulse Master Primary Vector Logo',
    fileType: 'vector',
    fileName: 'FinPulse_Master_CMYK.ai',
    fileSize: '3.4 MB',
    resolution: '300 DPI Vector (Pantone Validated)',
    uploadedAt: '2026-10-20',
    status: 'Approved for Production',
    previewUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
    associatedOrdersCount: 4,
  },
  {
    id: 'art-02',
    title: 'FinPulse Emblem Monogram (Left Chest Embroidery)',
    fileType: 'svg',
    fileName: 'FinPulse_Emblem_DST_Embroidery.svg',
    fileSize: '840 KB',
    resolution: 'Infinite Scalable Vector',
    uploadedAt: '2026-10-22',
    status: 'Approved for Production',
    previewUrl: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=400&q=80',
    associatedOrdersCount: 2,
  },
  {
    id: 'art-03',
    title: 'Annual Kickoff 2026 Typography Print',
    fileType: 'png',
    fileName: 'Kickoff_Backprint_4000px.png',
    fileSize: '5.2 MB',
    resolution: '4000 x 3200 px (Transparent Alpha)',
    uploadedAt: '2026-10-23',
    status: 'Proof Ready',
    previewUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=400&q=80',
    associatedOrdersCount: 1,
  },
  {
    id: 'art-04',
    title: 'Festive Leadership Gift Laser Marking Spec',
    fileType: 'pdf',
    fileName: 'GiftBox_Laser_Guide_v2.pdf',
    fileSize: '1.8 MB',
    resolution: 'Print-Ready PDF/X-1a',
    uploadedAt: '2026-10-24',
    status: 'Under Review',
    previewUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=400&q=80',
    associatedOrdersCount: 0,
  }
];

export const MOCK_INVOICES: TaxInvoice[] = [
  {
    id: 'inv-2026-0041',
    invoiceNumber: 'INV/2026/0041',
    orderNumber: 'TQ-98104',
    date: '2026-10-24',
    itemsCount: 50,
    taxableValue: 19950,
    cgst: 1795.5,
    sgst: 1795.5,
    igst: 0,
    totalAmount: 23541,
    status: 'Paid',
    pdfFileName: 'Teqqno_Tax_Invoice_TQ-98104.pdf',
  },
  {
    id: 'inv-2026-0038',
    invoiceNumber: 'INV/2026/0038',
    orderNumber: 'TQ-89211',
    date: '2026-09-18',
    itemsCount: 120,
    taxableValue: 47880,
    cgst: 4309.2,
    sgst: 4309.2,
    igst: 0,
    totalAmount: 56498,
    status: 'Paid',
    pdfFileName: 'Teqqno_Tax_Invoice_TQ-89211.pdf',
  },
  {
    id: 'inv-2026-0029',
    invoiceNumber: 'INV/2026/0029',
    orderNumber: 'TQ-77402',
    date: '2026-08-05',
    itemsCount: 25,
    taxableValue: 18725,
    cgst: 1685.25,
    sgst: 1685.25,
    igst: 0,
    totalAmount: 22095,
    status: 'Paid',
    pdfFileName: 'Teqqno_Tax_Invoice_TQ-77402.pdf',
  }
];

export const MOCK_BULK_QUOTES: BulkEnquirySubmission[] = [
  {
    id: 'rfq-2026-902',
    companyName: 'FinPulse Technologies Pvt Ltd',
    contactPerson: 'Aman Kumar Dhaka',
    email: 'aman@finpulse.in',
    phone: '+91 8309394934',
    productCategory: 'Joining Kits',
    estimatedQty: 150,
    targetDeliveryDate: '2026-11-15',
    customizationDetails: 'Complete Welcome Hamper with black matte bottle, hardbound journal, metal pen & premium polo with dual embroidery.',
    hasGst: true,
    gstin: '29AAACN1234F1Z8',
    createdAt: '2026-10-23',
    status: 'Quote Sent',
  },
  {
    id: 'rfq-2026-881',
    companyName: 'FinPulse Technologies Pvt Ltd',
    contactPerson: 'Aman Kumar Dhaka',
    email: 'aman@finpulse.in',
    phone: '+91 8309394934',
    productCategory: 'Heavy Fleece Hoodies',
    estimatedQty: 80,
    targetDeliveryDate: '2026-12-01',
    customizationDetails: '340 GSM oversized charcoal hoodies with silicone high-density chest print and custom woven inner neck labels.',
    hasGst: true,
    gstin: '29AAACN1234F1Z8',
    createdAt: '2026-10-15',
    status: 'Proof Generating',
  }
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Digital Proof Ready for Review',
    message: 'Your 3D visual proof for Order #TQ-98104 (50x Signature Matty Polo) is generated and awaits your sign-off.',
    timestamp: '2 hours ago',
    read: false,
    type: 'proof',
  },
  {
    id: 'notif-2',
    title: 'Delhivery Tracking AWB Generated',
    message: 'Consignment AWB #DLV-EXP-8920194812 created for your order. Expected dispatch within 24 hours.',
    timestamp: '5 hours ago',
    read: false,
    type: 'order',
  },
  {
    id: 'notif-3',
    title: 'B2B Custom Quote #RFQ-902 Issued',
    message: 'Our corporate sales lead has uploaded the tiered quote for 150x Welcome Kits with ₹12,400 volume savings.',
    timestamp: '1 day ago',
    read: true,
    type: 'quote',
  },
  {
    id: 'notif-4',
    title: 'Diwali Corporate Pre-Booking Open',
    message: 'Book custom gift hampers before Oct 30 and unlock an additional 12% early-bird factory rebate.',
    timestamp: '3 days ago',
    read: true,
    type: 'promo',
  }
];

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'usr-finpulse-01',
  name: 'Aman Kumar Dhaka',
  mobile: '8309394934',
  email: 'aman@finpulse.in',
  companyName: 'FinPulse Technologies Pvt Ltd',
  designation: 'VP of People & Culture / Corporate Procurement',
  alternatePhone: '+91 98450 12345',
  gstin: '29AAACN1234F1Z8',
  role: 'Corporate Admin',
  isVerified: true,
  createdAt: '2026-01-14',
  gstStateCode: '29 (Karnataka)',
  savedAddresses: MOCK_SAVED_ADDRESSES,
};

