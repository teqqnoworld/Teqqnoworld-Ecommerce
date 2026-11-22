import React, { useState, useEffect, useRef } from 'react';
import { 
  Star, 
  ArrowLeft, 
  Check, 
  ShoppingCart, 
  Layers, 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  X, 
  Upload, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ShieldCheck, 
  Share2, 
  Sparkles,
  Info,
  Eye,
  Megaphone,
  Feather,
  Wrench,
  Recycle,
  Wind,
  ZoomIn,
  Heart
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { Product, ProductColor, PrintMethod, CartItem, CustomArtwork, VisitingCardDesignState } from '../types';
import { PRODUCTS } from '../data/mockData';
import { ProductMockupCanvas } from './ProductMockupCanvas';
import { getTippingPoloImages } from '../data/tippingPoloImages';
import { getPlainPoloImages } from '../data/plainPoloImages';
import { getJoabCoolmaxImages } from '../data/joabCoolmaxImages';
import { getMattyPoloImages } from '../data/mattyPoloImages';
import { getCapImages } from '../data/capImages';
import { PromoTableBuyBox } from './PromoTableBuyBox';
import { UmbrellaBuyBox } from './UmbrellaBuyBox';
import { MugBuyBox } from './MugBuyBox';
import { CanopyKioskBuyBox } from './CanopyKioskBuyBox';
import { RollupStandeeBuyBox } from './RollupStandeeBuyBox';
import { VisitingCardBuyBox } from './VisitingCardBuyBox';
import { VisitingCardDesignEditor } from './VisitingCardDesignEditor';
import { ProductAssuranceCards } from './ProductAssuranceCards';
import { BUSINESS_CONFIG, getWhatsAppLink } from '../config/business';
import { calculateProductPrice, formatCurrencyINR } from '../data/pricingRules';
import { compressImageFile } from '../utils/imageCompressor';
import { ProductDesignStudioModal } from './ProductDesignStudioModal';
import { ProductModalCommitPayload } from './productStudioConfigs';
import { PlainPoloStudioModal } from './plain-polo-studio/PlainPoloStudioModal';
import { PlainPoloModalCommitPayload } from './plain-polo-studio/plainPoloStudioTypes';
import { generateItemMockupSnapshots } from '../utils/mockupSnapshot';
import { VoiceInstructionsCard } from './VoiceInstructionsCard';
import { DelhiveryPincodeChecker } from './DelhiveryPincodeChecker';

interface ProductDetailViewProps {
  product: Product;
  onBack: () => void;
  onCustomize: (productId: string) => void;
  onAddToCart: (item: CartItem) => void;
  onRequestQuote: (product: Product, qty: number) => void;
  wishlistIds?: string[];
  onToggleWishlist?: (productId: string) => void;
}

// 6 Promotional Ceramic Mug Infographic Banners in logical sequential storytelling order
export const CERAMIC_MUG_INFOGRAPHIC_BANNERS = [
  {
    id: 'mug-banner-intro',
    src: '/assets/aistudio/Custom_Logo_Ceramic_Mug_Banner_dd930fbb.png',
    alt: 'Promotional Ceramic Mug - Custom Printed Mug for Branding, Gifting & Promotions',
    title: 'Promotional Ceramic Mug Overview',
  },
  {
    id: 'mug-banner-quality',
    src: '/assets/aistudio/Premium_Ceramic_Mug_Advertisement_2314edad.png',
    alt: 'Premium Quality Ceramic & Long-Lasting Print - High-Quality Ceramic Body, Glossy & Smooth Finish, Vibrant Print',
    title: 'Premium Quality Ceramic & Long-Lasting Print',
  },
  {
    id: 'mug-banner-dimensions',
    src: '/assets/aistudio/Product_Dimensions___Key_Details_28562fe6.png',
    alt: 'Product Dimensions & Key Details - 325 ml (11 oz) Capacity, 8.5 x 3 in Print Area, 3.2 x 3.7 in Mug Size',
    title: 'Product Dimensions & Specifications',
  },
  {
    id: 'mug-banner-durability',
    src: '/assets/aistudio/Durable_Everyday_Mug_Feature_Banner_45013b70.png',
    alt: 'Durable, Safe & Everyday Ready Mug - Microwave Safe, Dishwasher Safe, Food Grade, BPA Free, Hot & Cold Beverages',
    title: 'Durable, Safe & Everyday Ready Mug',
  },
  {
    id: 'mug-banner-promotions',
    src: '/assets/aistudio/Custom_Mug_Branding_Promotions_Banner_05f3a203.png',
    alt: 'Outdoor Promotions, Events & Business Branding - Corporate Gifting, Office & Team Use, Events & Exhibitions',
    title: 'Outdoor Promotions, Events & Business Branding',
  },
  {
    id: 'mug-banner-process',
    src: '/assets/aistudio/From_Branding_to_Delivery__Complete_Process_311405d8.png',
    alt: 'From Branding to Delivery Complete Process - 1. Upload Logo, 2. Design & Approval, 3. Printing, 4. Packaging, 5. Fast Delivery',
    title: 'From Branding to Delivery Complete Process',
  },
];

// 5 Premium Promo Table Infographic Banners in logical sequential storytelling order
export const PROMO_TABLE_INFOGRAPHIC_BANNERS = [
  {
    id: 'promo-table-banner-intro',
    src: '/assets/aistudio/Premium_Portable_Promo_Table_Display_b8df359a.png',
    alt: 'Premium Promo Table Portable Display Counter - Sturdy, Lightweight, Tool-Free Setup, Overhead Panel',
    title: 'Portable Display Counter Overview',
  },
  {
    id: 'promo-table-banner-dimensions',
    src: '/assets/aistudio/Promo_Table_Views_and_Dimensions_841dc968.png',
    alt: 'Promo Table Product Views & Dimensions - Front, Back, Side Views, 31.6 in x 63.2 in Overall Height',
    title: 'Product Views & Full Dimensions',
  },
  {
    id: 'promo-table-banner-quality',
    src: '/assets/aistudio/Premium_Promo_Counter_Quality_Guide_17c3b030.png',
    alt: 'Premium Material Quality & Durable Construction - Heavy-Duty PP Plastic Body, Sturdy Steel Rods, Two-Tier Shelves',
    title: 'Material Quality & Construction',
  },
  {
    id: 'promo-table-banner-showcase',
    src: '/assets/aistudio/Promo_Table_Branding_Showcase_19673c2f.png',
    alt: 'Promo Table Perfect for Branding & Promotions - Retail Stores, Exhibitions, Events, Product Demonstrations',
    title: 'Branding & Promotion Needs',
  },
  {
    id: 'promo-table-banner-steps',
    src: '/assets/aistudio/Promo_Table_Ordering_Made_Easy_5d944a25.png',
    alt: 'Order Your Promo Table in 4 Easy Steps - Upload Design, Confirm Size & Qty, Review Order, Fast Delivery',
    title: 'Order in 4 Easy Steps',
  },
];

// 5 Custom Printed Branding Umbrella Infographic Banners in logical sequential storytelling order
export const BRANDING_UMBRELLA_INFOGRAPHIC_BANNERS = [
  {
    id: 'umbrella-banner-intro-colors',
    src: '/assets/aistudio/Custom_Printed_Branding_Umbrella_Infographic__3__911d37fa.png',
    alt: 'Custom Printed Branding Umbrella - 6 ft Width, 7 ft Height, Available in Red, Blue, Green, Orange + White with Screen & Sublimation Printing',
    title: 'Custom Printed Branding Umbrella & Color Options',
  },
  {
    id: 'umbrella-banner-dimensions',
    src: '/assets/aistudio/5_Feet_Promotional_Umbrella_Infographic_3eec08b7.png',
    alt: '5 Feet Promotional Umbrella Product Dimensions & Component Details - 6 ft Width, 7 ft Height, Tripod Base, Adjustable Center Pole',
    title: 'Product Dimensions & Component Details',
  },
  {
    id: 'umbrella-banner-weather-quality',
    src: '/assets/aistudio/Premium_Weather_Protection_Umbrella_Banner_d8fb33cf.png',
    alt: '5 Feet Promotional Umbrella Premium Fabric Quality & Weather Protection - UV Protection Coating, Water-Repellent, Fade-Resistant & Wind-Resistant',
    title: 'Fabric Quality & Weather Protection',
  },
  {
    id: 'umbrella-banner-promotions-showcase',
    src: '/assets/aistudio/Branded_Umbrellas_for_Outdoor_Promotions_f738b3b1.png',
    alt: '5 Feet Promotional Umbrella for Outdoor Promotions & Business Branding - Real World Client Activations (Coca-Cola, Pepsi, Amazon, Oppo, Vivo)',
    title: 'Outdoor Promotions & Brand Activations',
  },
  {
    id: 'umbrella-banner-ordering-steps',
    src: '/assets/aistudio/Promotional_Umbrella_Ordering_Guide_52a22a88.png',
    alt: 'Easy Steps to Order Your Promotional Umbrella - Upload Design, Confirm Size & Quantity, Review & Confirm, Fast Delivery (24-48h Dispatch)',
    title: 'Easy 4-Step Ordering Guide',
  },
];

// 5 Premium 300 GSM Visiting Card Infographic Banners in logical sequential storytelling order
export const VISITING_CARD_INFOGRAPHIC_BANNERS = [
  {
    id: 'visiting-card-banner-intro-specs',
    src: '/assets/aistudio/Premium_Visiting_Cards_Promotional_Banner_800f38c4.png',
    alt: 'Premium Visiting Cards - Make a Lasting First Impression with 300 GSM Art Paper, Matte Finish & Both Side Printing',
    title: 'Premium Visiting Cards Overview',
  },
  {
    id: 'visiting-card-banner-paper-quality',
    src: '/assets/aistudio/Premium_300_GSM_Business_Cards__2__93d5dd76.png',
    alt: '300 GSM Premium Paper Quality - Thick, Durable, Professional Smooth Matte Finish, Fade Resistant',
    title: '300 GSM Premium Paper Quality',
  },
  {
    id: 'visiting-card-banner-digital-print',
    src: '/assets/aistudio/High-Quality_Digital_Printing_Banner_ca26ee72.png',
    alt: 'High Quality Digital Printing - Vibrant Colors, Sharp & Clear Details, HD Crystal Clear Print Quality',
    title: 'High Quality Digital Printing',
  },
  {
    id: 'visiting-card-banner-showcase-styles',
    src: '/assets/aistudio/Customized_Visiting_Cards_Showcase_17a3b075.png',
    alt: 'Customized Visiting Cards Showcase - Front & Back Side Branding, Corporate, Creative, Minimal & Modern Styles',
    title: 'Styles & Custom Branding Showcase',
  },
  {
    id: 'visiting-card-banner-order-steps',
    src: '/assets/aistudio/Custom_Visiting_Cards_in_Four_Easy_Steps_4be143bf.png',
    alt: 'Order Your Custom Visiting Cards in 4 Easy Steps - Upload Details, Choose Quantity (100 - 2,000+ pcs), Review, Fast Delivery',
    title: 'Order in 4 Easy Steps',
  },
];

// 5 Premium Rollup Standee Infographic Banners in logical sequential storytelling order
export const ROLLUP_STANDEE_INFOGRAPHIC_BANNERS = [
  {
    id: 'standee-banner-intro-specs',
    src: '/assets/aistudio/Premium_Rollup_Standee_Promotional_Banner_79aa861a.png',
    alt: 'Premium Rollup Standee - Portable, Durable, Professional Display (3 ft x 6 ft, Heavy-Duty Metal Stand, Carry Bag Included)',
    title: 'Premium Rollup Standee Overview',
  },
  {
    id: 'standee-banner-dimensions-blueprint',
    src: '/assets/aistudio/Rollup_Standee_Product_Specifications_1283e81d.png',
    alt: 'Rollup Standee Product Details & Specifications - Front, Back & Side Views, 3 ft Width x 6 ft Height, Top Rail, Support Pole & Base Stand',
    title: 'Product Details & Specifications',
  },
  {
    id: 'standee-banner-printing-quality',
    src: '/assets/aistudio/Premium_Rollup_Standee_Printing_Banner_ff09c3f5.png',
    alt: 'Premium Printing Quality for Rollup Standee - Vibrant Colors, Tear-Resistant Flex, Water-Resistant & High-Definition UV Printing',
    title: 'Printing Quality & Material Durability',
  },
  {
    id: 'standee-banner-branding-showcase',
    src: '/assets/aistudio/Rollup_Standee_Branding_Showcase_9dbe762e.png',
    alt: 'Rollup Standee Perfect for Branding Needs - Retail Stores, Exhibitions & Trade Shows, Events, Corporate Branding & Product Launches',
    title: 'All Branding Needs Showcase',
  },
  {
    id: 'standee-banner-order-steps',
    src: '/assets/aistudio/Rollup_Standee_Ordering_Guide_8852379d.png',
    alt: 'Order Your Rollup Standee in 4 Easy Steps - Upload Design, Confirm Size & Qty (3 ft x 6 ft), Review Order, Fast 24-48h Dispatch',
    title: 'Order in 4 Easy Steps',
  },
];

// 5 Promotional Canopy Kiosk Infographic Banners in logical sequential storytelling order
export const CANOPY_KIOSK_INFOGRAPHIC_BANNERS = [
  {
    id: 'canopy-banner-intro-stall',
    src: '/assets/aistudio/Promotional_Canopy_Kiosk_Infographic__1__0ef248e5.png',
    alt: 'Promotional Canopy Kiosk - Portable Branding & Promotion Stall (7 ft Height, 4 ft Width & Depth, Front View Only)',
    title: 'Promotional Canopy Kiosk Overview',
  },
  {
    id: 'canopy-banner-dimensions-components',
    src: '/assets/aistudio/Canopy_Kiosk_Dimensions_and_Components_d4d905b8.png',
    alt: 'Canopy Kiosk Product Dimensions & Component Details - 4 x 4 ft Standard & 8 x 8 ft Extra Large Sizes, Sturdy Frame & Stable Support',
    title: 'Product Dimensions & Components',
  },
  {
    id: 'canopy-banner-fabric-construction',
    src: '/assets/aistudio/Premium_Canopy_Kiosk_Feature_Banner_6cc78101.png',
    alt: 'Canopy Kiosk Premium Fabric Quality & Heavy-Duty Metal Construction - Tear-Resistant Polyester, Durable Stitching & Stable Base Support',
    title: 'Fabric Quality & Heavy-Duty Construction',
  },
  {
    id: 'canopy-banner-outdoor-promotions',
    src: '/assets/aistudio/Flat-Top_Canopy_Kiosk_Promotions_031ff207.png',
    alt: 'Canopy Kiosk Perfect for Exhibitions, Events, Retail & Outdoor Promotions - Expo Brand, Retail Activations, Brand Activations',
    title: 'Exhibitions, Events & Promotions Showcase',
  },
  {
    id: 'canopy-banner-order-steps',
    src: '/assets/aistudio/Canopy_Kiosk_Ordering_Guide_2dd86db3.png',
    alt: 'Order Your Canopy Kiosk in 4 Easy Steps - Upload Design, Confirm Size (4x4 or 8x8 ft), Review Order, Fast 24-48h Dispatch',
    title: 'Order in 4 Easy Steps',
  },
];

// 5 Customized Caps Infographic Banners in logical sequential storytelling order
export const CUSTOM_CAPS_INFOGRAPHIC_BANNERS = [
  {
    id: 'caps-banner-intro-wear-brand',
    src: '/assets/aistudio/Customized_Caps__Wear_Your_Brand_e2b62c19.png',
    alt: 'Customized Caps - Wear Your Brand, Stand Out Everywhere with Printed Company Logo, Premium Quality & Adjustable Strap',
    title: 'Customized Caps Overview',
  },
  {
    id: 'caps-banner-fabric-fit',
    src: '/assets/aistudio/Customized_Caps__Premium_Quality__Adjustable_Fit_1c209c8c.png',
    alt: 'Customized Caps with Your Logo - Premium Quality Fabric, 100% Pure Breathable Cotton, Double Stitching & Adjustable Fit',
    title: 'Fabric Quality & Adjustable Fit',
  },
  {
    id: 'caps-banner-color-showcase',
    src: '/assets/aistudio/Custom_Caps_Feature_Showcase_502131d4.png',
    alt: 'Custom Caps Feature Showcase - 8 Color Variants, Adjustable Snapback, Custom Caps for Teams, Events & Your Brand',
    title: 'Color Variants & Features Showcase',
  },
  {
    id: 'caps-banner-why-choose',
    src: '/assets/aistudio/Why_Choose_Teqqno_World__5439b4ce.png',
    alt: 'Why Choose Teqqno World - Seamless Ordering Process, Customization Options, Fast & Reliable Delivery & Affordable Bulk Option',
    title: 'Why Choose Teqqno World',
  },
  {
    id: 'caps-banner-order-processing-steps',
    src: '/assets/aistudio/Easy_Order_Processing_Steps_52585447.png',
    alt: 'Easy Steps for Order Processing - Order Received, Order Previews, Processing Order (24-48h), Packed with Care, Dispatch (4-6 working days)',
    title: 'Easy 5-Step Order Processing',
  },
];

// 6 Tipping Polo T-Shirt Infographic Banners (Striped Collar & Cuffs)
export const TIPPING_POLO_INFOGRAPHIC_BANNERS = [
  {
    id: 'tipping-polo-banner-quality-customization',
    src: '/assets/aistudio/TeqqnoWorld_Polo_Quality_Showcase_59788e06.png',
    alt: 'Product Quality & Customization - 100% Pure Cotton (230 GSM), Premium Fabric & Durable Stitching, Printing & Embroidery, Polo Collar, Sleeve Design, Quality Stitching',
    title: 'Product Quality & Customization',
  },
  {
    id: 'tipping-polo-banner-product-features',
    src: '/assets/aistudio/TeqqnoWorld_Polo_Product_Features_489bbc5f.png',
    alt: 'Product Features Showcase - Soft & Breathable Fabric, Classic Polo Collar, Comfortable Ribbed Sleeves, Strong & Durable Stitching',
    title: 'Product Features Showcase',
  },
  {
    id: 'tipping-polo-banner-15-colors',
    src: '/assets/aistudio/Premium_Polo_Colour_Options_f5d6732e.png',
    alt: 'Colour Options - Available in 15 Premium Colours for Teams, Events & Branding (Maroon, Navy, Royal, Apple, Turquoise, Black, White, Air, Bottle, Charcoal, Grey, Red)',
    title: 'Available in 15 Premium Colours',
  },
  {
    id: 'tipping-polo-banner-wear-your-brand',
    src: '/assets/aistudio/Custom_Polo_Shirts_for_Every_Brand_7a62fe36.png',
    alt: 'Wear Your Brand - Custom Polo T-Shirts for Corporate Teams, Retail Staff, Events & Campaigns, Clubs & Organizations - Add Your Logo, Build Your Identity',
    title: 'Wear Your Brand - Corporate & Events',
  },
  {
    id: 'tipping-polo-banner-why-choose-teqqnoworld',
    src: '/assets/aistudio/Navy_Polos_with_White_Tipping_ccfd08ee.png',
    alt: 'Why Choose TeqqnoWorld - High-Quality Custom Apparel, Corporate & Bulk Orders, Your Logo, Reliable Quality & On-Time Delivery, Trusted by Businesses & Teams',
    title: 'Why Choose TeqqnoWorld',
  },
  {
    id: 'tipping-polo-banner-easy-order-steps',
    src: '/assets/aistudio/Easy_Order_Processing_Steps_be356af5.png',
    alt: 'Easy Order Processing Steps - From Your Idea to Branded Apparel in 5 Simple Steps: 1. Choose Product, 2. Upload Logo, 3. Confirm Design, 4. Place Order, 5. On-Time Delivery',
    title: 'Easy 5-Step Order Processing',
  },
];

// 6 MARS Fabric 220 GSM / Solid Polo T-Shirt Infographic Banners
export const MARS_POLO_INFOGRAPHIC_BANNERS = [
  {
    id: 'mars-polo-banner-quality-customization',
    src: '/assets/aistudio/230_GSM_Premium_Polo_Quality_2f5dba54.png',
    alt: 'Product Quality & Customization - Premium MARS Fabric (230 GSM), Custom Logo Printing, Bulk & Corporate Orders, Soft Feel, Durable Stitching, Breathable & Comfortable',
    title: 'Product Quality & Customization - MARS Fabric 230 GSM',
  },
  {
    id: 'mars-polo-banner-product-features',
    src: '/assets/aistudio/230_GSM_Product_Features_Showcase_6aa94d75.png',
    alt: 'Product Features Showcase - MARS Fabric (230 GSM), Premium Comfort, High Durability, Breathable Fabric, Color Fastness, Perfect Fit',
    title: 'Product Features Showcase',
  },
  {
    id: 'mars-polo-banner-15-colors',
    src: '/assets/aistudio/Premium_Polo_Color_Options_4177c894.png',
    alt: 'Colour Options - Available in 15 Premium Colours (230 GSM): Black, Navy, Red, Grey, White, Maroon, Royal, Orange, Purple, Pink, Yellow, Sky, D. Green, Lime, L. Green',
    title: 'Available in 15 Premium Colours',
  },
  {
    id: 'mars-polo-banner-wear-your-brand',
    src: '/assets/aistudio/Wear_Your_Brand__Custom_Polo_Teamwear_2a9e71b8.png',
    alt: 'Wear Your Brand - Premium Polo T-Shirts for Corporate Teams, Events & Promotions, Client Gifting, Staff Uniforms - Add Your Logo, Build Your Identity',
    title: 'Wear Your Brand - Team, Business & Events',
  },
  {
    id: 'mars-polo-banner-why-choose-teqqnoworld',
    src: '/assets/aistudio/Premium_230_GSM_Polo_Promotion_d60debc7.png',
    alt: 'Why Choose TeqqnoWorld - Premium MARS Fabric 230 GSM, High-Quality Custom Printing, Bulk & Corporate Orders, On-Time Delivery, Solid Colour Classic Polo Design',
    title: 'Why Choose TeqqnoWorld',
  },
  {
    id: 'mars-polo-banner-easy-order-steps',
    src: '/assets/aistudio/Easy_Order_Processing_Steps__1__af92cab6.png',
    alt: 'Easy Order Processing Steps - Step 1: Browse & Select Products, Step 2: Customize Your Design, Step 3: Place Your Order, Step 4: Track & Get On-Time Delivery',
    title: 'Easy 4-Step Order Processing',
  },
];

export const POLO_TSHIRT_INFOGRAPHIC_BANNERS = MARS_POLO_INFOGRAPHIC_BANNERS;

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({
  product,
  onBack,
  onCustomize,
  onAddToCart,
  onRequestQuote,
  wishlistIds = [],
  onToggleWishlist,
}) => {
  const isWishlisted = wishlistIds.includes(product.id);
  // Check if product is Polo T-Shirt
  const isPoloMerch = product.productType === 'polo' || product.id?.includes('polo') || product.slug?.includes('polo') || product.name.toLowerCase().includes('polo') || product.id === 'prod-polo-01';
  // Check if product is Rollup Standee
  const isStandee = product.id === 'prod-rollup-standee' || product.slug === 'rollup-standee' || product.productType === 'standee' || product.name.toLowerCase().includes('rollup standee');
  // Check if product is Canopy Kiosk
  const isCanopy = product.id === 'prod-canopy-kiosk' || product.slug === 'promotional-canopy-kiosk' || product.productType === 'canopy' || product.name.toLowerCase().includes('canopy');
  // Check if product is a Cap
  const isCap = product.productType === 'cap' || product.id === 'prod-cotton-flexi-caps' || product.slug?.includes('cap');
  // Check if product is Promo Table
  const isPromoTable = product.id === 'prod-promo-table' || product.slug === 'promo-table' || product.productType === 'display' || product.productType === 'table' || product.name.toLowerCase().includes('promo table');
  // Check if product is Custom Printed Branding Umbrella
  const isUmbrella = product.id === 'prod-branding-umbrella' || product.slug === 'custom-printed-branding-umbrella' || product.productType === 'umbrella' || product.name.toLowerCase().includes('umbrella');
  // Check if product is Promotional Ceramic Mug
  const isMug = product.id === 'prod-ceramic-mug' || product.slug === 'promotional-ceramic-mug' || product.productType === 'mug' || product.name.toLowerCase().includes('ceramic mug') || product.name.toLowerCase().includes('mug');
  // Check if product is Premium 300 GSM Visiting Card
  const isVisitingCard = product.id === 'prod-visiting-card-300gsm' || product.slug === 'premium-300-gsm-visiting-card' || product.productType === 'visiting-card' || product.name.toLowerCase().includes('visiting card');

  // Visiting Card Customization State
  const [visitingCardDesign, setVisitingCardDesign] = useState<VisitingCardDesignState>({
    paperGsm: 300,
    widthMm: 92,
    heightMm: 52,
    withBleed: true,
    frontSettings: { x: 0, y: 0, scale: 1, rotation: 0 },
    backSettings: { x: 0, y: 0, scale: 1, rotation: 0 },
  });
  const [isVisitingCardEditorOpen, setIsVisitingCardEditorOpen] = useState(false);

  // Standee Images
  const standeeImages = {
    front: '/assets/standee/front.webp',
    back: '/assets/standee/back.webp',
  };

  // Canopy Kiosk Size Selection state ('4 × 4 ft' | '8 × 8 ft')
  const [selectedCanopySize, setSelectedCanopySize] = useState<'4 × 4 ft' | '8 × 8 ft'>('4 × 4 ft');

  // Canopy Kiosk Size Pricing Map
  const canopyPricingConfig = {
    '4 × 4 ft': {
      basePrice: 5100,
      mrp: 5100,
      tiers: [
        { minQty: 1, price: 5100, savingsPercent: 0 },
        { minQty: 3, price: 4500, savingsPercent: 0 },
        { minQty: 6, price: 4200, savingsPercent: 0 },
      ]
    },
    '8 × 8 ft': {
      basePrice: 6100,
      mrp: 6100,
      tiers: [
        { minQty: 1, price: 6100, savingsPercent: 0 },
        { minQty: 3, price: 5500, savingsPercent: 0 },
        { minQty: 6, price: 5200, savingsPercent: 0 },
      ]
    }
  };

  // 1. Color Selection (Default to first configured color)
  const [selectedColor, setSelectedColor] = useState<ProductColor>(product.colors[0] || {
    name: isVisitingCard ? 'White' : (isStandee ? 'Black' : (isCanopy ? 'Navy Blue' : 'Navy')),
    hex: isVisitingCard ? '#FFFFFF' : (isStandee ? '#111215' : (isCanopy ? '#162B4D' : '#16233B')),
    garmentHex: isVisitingCard ? '#FFFFFF' : (isStandee ? '#111215' : (isCanopy ? '#162B4D' : '#16233B'))
  });

  // Helper to resolve default placements & starter artwork per product category
  const getDefaultFrontPlacement = () => {
    if (isCap) return 'Front Crown';
    if (isMug) return 'Front Center';
    if (isUmbrella) return 'Center Panel';
    if (isCanopy) return 'Top Valance Header';
    if (isStandee || isPromoTable) return 'Top Header';
    return 'Left Chest';
  };

  const getDefaultBackPlacement = () => {
    if (isCap) return 'Back Arch';
    if (isMug) return 'Back Center';
    if (isUmbrella) return 'Back Center Panel';
    return 'Upper Back Center';
  };

  // When product changes, reset color, view orientation, quantity & starter artwork cleanly
  useEffect(() => {
    if (product.colors && product.colors.length > 0) {
      setSelectedColor(product.colors[0]);
    }
    setViewOrientation('front');
    setActiveThumbnailIndex(0);
    setQuantity(product.moq || (isVisitingCard ? 100 : (isCanopy || isStandee || isPromoTable || isUmbrella ? 1 : isMug ? 5 : 2)));

    const starterBadge: CustomArtwork = {
      type: 'preset',
      presetId: 'your-logo',
      text: 'YOUR LOGO HERE',
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
    };

    const nextFrontPlacement = getDefaultFrontPlacement();
    const nextBackPlacement = getDefaultBackPlacement();
    setFrontPlacement(nextFrontPlacement);
    setBackPlacement(nextBackPlacement);
    setUploadedFrontLogoName('Your_Logo_Here.png');
    setUploadedBackLogoName('Your_Logo_Here.png');
    setSelectedPrintMethod(product.printMethods?.[0] || 'DTF Printing');

    if (isVisitingCard) {
      setFrontArtwork(null);
      setBackArtwork(null);
    } else if (isCanopy || isStandee || isPromoTable) {
      setFrontArtwork({ ...starterBadge });
      setBackArtwork(null);
    } else {
      setFrontArtwork({ ...starterBadge });
      setBackArtwork({ ...starterBadge });
    }

    // Initialize size distribution for apparel
    if (product.sizes) {
      const initialSizes: Record<string, number> = {};
      product.sizes.forEach(sz => { initialSizes[sz] = 0; });
      setSizeDistribution(initialSizes);
    }
  }, [product.id]);

  // 2. Quantity & Bulk Tier Calculations
  const [quantity, setQuantity] = useState<number>(product.moq || (isVisitingCard ? 100 : (isCanopy || isStandee ? 1 : 2)));

  // Calculate pricing based on centralized rules
  const calculatePricing = (qty: number) => {
    const pResult = calculateProductPrice(product.id, qty, isCanopy ? selectedCanopySize : undefined);
    return {
      unitPrice: pResult.unitPrice,
      totalPrice: pResult.totalPrice,
      totalMrp: pResult.totalPrice,
      savingsPercent: 0,
      nextTierUpsell: pResult.nextTierUpsell,
      isQuoteRequired: pResult.isQuoteRequired,
      activeSlab: pResult.activeSlab,
      moq: pResult.moq,
      maxQty: pResult.maxQty,
      slabs: pResult.slabs,
      unitLabel: pResult.unitLabel,
    };
  };

  const { unitPrice, totalPrice, totalMrp, savingsPercent, nextTierUpsell, isQuoteRequired, maxQty, moq, slabs, unitLabel } = calculatePricing(quantity);

  // 3. Size Distribution State
  const defaultSizes = product.sizes || ['S (36)', 'M (38)', 'L (40)', 'XL (42)', '2XL (44)', '3XL (46)', '4XL (48)'];
  const [sizeDistribution, setSizeDistribution] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    defaultSizes.forEach(s => { initial[s] = 0; });
    return initial;
  });

  const totalAssignedSizes = Object.values(sizeDistribution).reduce((sum, q) => sum + q, 0);

  const handleUpdateSizeQty = (sizeKey: string, delta: number) => {
    setSizeDistribution(prev => {
      const current = prev[sizeKey] || 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [sizeKey]: updated };
    });
  };

  const handleAutoDistributeSizes = () => {
    // Distribute quantity across popular corporate sizes (M, L, XL)
    const newDist: Record<string, number> = {};
    defaultSizes.forEach(s => { newDist[s] = 0; });
    
    const popular = defaultSizes.filter(s => s.startsWith('M') || s.startsWith('L') || s.startsWith('XL'));
    const targetSizes = popular.length > 0 ? popular : defaultSizes.slice(0, 3);
    
    let remaining = quantity;
    const perSize = Math.floor(quantity / targetSizes.length);
    targetSizes.forEach((s, idx) => {
      if (idx === targetSizes.length - 1) {
        newDist[s] = remaining;
      } else {
        newDist[s] = perSize;
        remaining -= perSize;
      }
    });
    setSizeDistribution(newDist);
  };

  // 4. Custom Artwork & Logo Customization (Independent Front & Back Artworks)
  const [frontArtwork, setFrontArtwork] = useState<CustomArtwork | null>(isVisitingCard ? null : {
    type: 'preset',
    presetId: 'your-logo',
    text: 'YOUR LOGO HERE',
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
  });
  const [frontPlacement, setFrontPlacement] = useState<string>(getDefaultFrontPlacement());
  const [uploadedFrontLogoName, setUploadedFrontLogoName] = useState<string>('Your_Logo_Here.png');

  const [backArtwork, setBackArtwork] = useState<CustomArtwork | null>((isVisitingCard || isCanopy || isStandee || isPromoTable) ? null : {
    type: 'preset',
    presetId: 'your-logo',
    text: 'YOUR LOGO HERE',
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
  });
  const [backPlacement, setBackPlacement] = useState<string>(getDefaultBackPlacement());
  const [uploadedBackLogoName, setUploadedBackLogoName] = useState<string>('Your_Logo_Here.png');

  const [artworkStatus, setArtworkStatus] = useState<'uploaded' | 'awaiting_review' | 'approved'>('uploaded');
  const [selectedPrintMethod, setSelectedPrintMethod] = useState<PrintMethod>(
    product.printMethods[0] || 'DTF Printing'
  );

  // Design Studio Modal & Active Editing Side
  const [isDesignModalOpen, setIsDesignModalOpen] = useState(false);
  const [modalActiveSide, setModalActiveSide] = useState<'front' | 'back'>('front');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { dataUrl, file: compressedFile } = await compressImageFile(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.85,
          format: 'image/png',
        });

        const newArt: CustomArtwork = {
          type: 'image',
          dataUrl,
          rawDataUrl: dataUrl,
          x: 0,
          y: 0,
          scale: 1,
          rotation: 0
        };

        const finalName = compressedFile.name || file.name;
        if (isDesignModalOpen) {
          if (modalActiveSide === 'front') {
            setFrontArtwork(newArt);
            setUploadedFrontLogoName(finalName);
          } else {
            setBackArtwork(newArt);
            setUploadedBackLogoName(finalName);
          }
        } else {
          // Main page upload: apply to both front and back so both views showcase customer logo
          setFrontArtwork(newArt);
          setUploadedFrontLogoName(finalName);
          setBackArtwork(newArt);
          setUploadedBackLogoName(finalName);
        }
        setArtworkStatus('uploaded');
      } catch (err) {
        console.warn('[Logo Upload Compression Failed, fallback to FileReader]:', err);
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            const rawStr = event.target.result as string;
            const newArt: CustomArtwork = {
              type: 'image',
              dataUrl: rawStr,
              rawDataUrl: rawStr,
              x: 0,
              y: 0,
              scale: 1,
              rotation: 0
            };
            setFrontArtwork(newArt);
            setUploadedFrontLogoName(file.name);
            setBackArtwork(newArt);
            setUploadedBackLogoName(file.name);
            setArtworkStatus('uploaded');
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // 5. Voice Note & Written Instructions
  const [voiceNoteBlobUrl, setVoiceNoteBlobUrl] = useState<string | null>(null);
  const [additionalTextNotes, setAdditionalTextNotes] = useState('');

  // 6. Gallery Views & Lightbox
  const [activeThumbnailIndex, setActiveThumbnailIndex] = useState(0);
  const [viewOrientation, setViewOrientation] = useState<'front' | 'back' | 'side' | 'top' | 'dimensions'>('front');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Resolve accurate photographic images for Plain Polo vs Tipping Polo vs JOAB COOLMAX Polo Shirts vs Matty Polo
  const isMattyPolo = product.id === 'prod-matty-polo' || product.slug?.includes('matty-polo');
  const isJoabPolo = product.id === 'prod-joab-coolmax' || product.slug?.includes('joab-coolmax');
  const isPlainPolo = product.id === 'prod-plain-polo' || product.slug?.includes('plain-polo');
  const isStrictPlainPolo =
    product.id === 'prod-plain-polo' || product.slug === 'customized-plain-polo-t-shirt';
  const isPolo = product.productType === 'polo' || product.id === 'prod-polo-01' || isPlainPolo || isJoabPolo || isMattyPolo;
  const poloImages = isMattyPolo
    ? (selectedColor.imageFront && selectedColor.imageBack
        ? { front: selectedColor.imageFront, back: selectedColor.imageBack }
        : getMattyPoloImages(selectedColor.name, selectedColor.hex || selectedColor.garmentHex))
    : (isJoabPolo
        ? (selectedColor.imageFront && selectedColor.imageBack
            ? { front: selectedColor.imageFront, back: selectedColor.imageBack }
            : getJoabCoolmaxImages(selectedColor.name, selectedColor.hex || selectedColor.garmentHex))
        : (isPlainPolo
            ? (selectedColor.imageFront && selectedColor.imageBack
                ? { front: selectedColor.imageFront, back: selectedColor.imageBack }
                : getPlainPoloImages(selectedColor.name, selectedColor.hex || selectedColor.garmentHex))
            : getTippingPoloImages(selectedColor.name, selectedColor.hex || selectedColor.garmentHex)));

  const umbrellaImages = {
    front: selectedColor.imageFront || '/assets/umbrella/red-dimensions.webp',
  };

  interface GalleryViewItem {
    id: string;
    label: string;
    type: string;
    orientation?: 'front' | 'back' | 'side' | 'top' | 'dimensions';
    focus?: string;
    image?: string;
  }

  // Gallery items matching requirements:
  const galleryViews: GalleryViewItem[] = isVisitingCard ? [
    { id: 'front', label: 'FRONT SIDE', type: 'mockup', orientation: 'front' as const },
    { id: 'back', label: 'BACK SIDE', type: 'mockup', orientation: 'back' as const },
  ] : isCanopy ? [
    { id: 'front', label: 'Live Design', type: 'mockup', orientation: 'front' as const, image: selectedCanopySize === '8 × 8 ft' ? '/assets/aistudio/7_7_ft_Blue_Canopy_Booth_Infographic_3ac991cf.webp' : '/assets/aistudio/Blue_Canopy_Booth_Dimensions_Infographic_320b507e.webp' },
    { id: 'dimensions', label: 'Specs & Size', type: 'photo', orientation: 'dimensions' as const, image: selectedCanopySize === '8 × 8 ft' ? '/assets/aistudio/7_7_ft_Blue_Canopy_Booth_Infographic_3ac991cf.webp' : '/assets/aistudio/Blue_Canopy_Booth_Dimensions_Infographic_320b507e.webp' },
  ] : isStandee ? [
    { id: 'front', label: 'Live Design', type: 'mockup', orientation: 'front' as const, image: standeeImages.front },
    { id: 'dimensions', label: 'Specs View', type: 'photo', orientation: 'dimensions' as const, image: standeeImages.front },
    { id: 'back', label: 'Back View', type: 'photo', orientation: 'back' as const, image: standeeImages.back },
  ] : isMug ? [
    { id: 'front', label: 'Front View', type: 'mockup', orientation: 'front' as const, image: '/assets/aistudio/Blank_White_Ceramic_Mug_b82bfadb.webp' },
    { id: 'back', label: 'Back View', type: 'photo', orientation: 'back' as const, image: '/assets/mug/mug_back_blank.webp' },
    { id: 'top', label: 'Top View', type: 'photo', orientation: 'top' as const, image: '/assets/aistudio/Top-Down_White_Ceramic_Mug_46e962e8.webp' },
    { id: 'dimensions', label: 'Dimensions & Features', type: 'photo', orientation: 'dimensions' as const, image: '/assets/aistudio/White_Mug_Dimensions_and_Features_Infographic_47e1f529.webp' },
  ] : isPromoTable ? [
    { id: 'front', label: 'Live Design', type: 'mockup', orientation: 'front' as const, image: '/assets/promo-table/front.webp' },
    { id: 'back', label: 'Back View', type: 'photo', orientation: 'back' as const, image: '/assets/promo-table/back.webp' },
    { id: 'side', label: 'Side View', type: 'photo', orientation: 'side' as const, image: '/assets/promo-table/side.webp' },
    { id: 'dimensions', label: 'Dimensions', type: 'photo', orientation: 'dimensions' as const, image: '/assets/promo-table/dimensions.webp' },
  ] : isUmbrella ? [
    { id: 'front', label: 'Front Panel', type: 'mockup', orientation: 'front' as const, image: umbrellaImages.front },
    { id: 'back', label: 'Back Panel', type: 'mockup', orientation: 'back' as const, image: umbrellaImages.front },
    { id: 'dimensions', label: 'Dimensions', type: 'photo', orientation: 'dimensions' as const, image: umbrellaImages.front },
  ] : isCap ? [
    { id: 'front', label: 'Front View', type: 'mockup', orientation: 'front' as const },
    { id: 'crown', label: 'Front Crown', type: 'detail', focus: 'crown' },
    { id: 'visor', label: 'Stitched Visor', type: 'detail', focus: 'visor' },
    { id: 'strap', label: 'Adjustable Strap', type: 'mockup', orientation: 'back' as const },
    { id: 'fabric', label: 'Cotton Twill', type: 'detail', focus: 'fabric' },
    { id: 'embroidery', label: 'Embroidery', type: 'detail', focus: 'embroidery' },
  ] : [
    { id: 'front', label: 'Front View', type: 'mockup', orientation: 'front' as const },
    { id: 'back', label: 'Back View', type: 'mockup', orientation: 'back' as const },
    { id: 'collar', label: (isPlainPolo || isJoabPolo || isMattyPolo) ? 'Ribbed Collar' : 'Tipping Collar', type: 'detail', focus: 'collar' },
    { id: 'sleeve', label: (isPlainPolo || isJoabPolo || isMattyPolo) ? 'Ribbed Sleeves' : 'Tipping Sleeves', type: 'detail', focus: 'sleeve' },
    { id: 'fabric', label: isMattyPolo ? '230 GSM Matty' : (isJoabPolo ? '220 GSM MARS' : (isPlainPolo ? '240 GSM Fabric' : '260 GSM Fabric')), type: 'detail', focus: 'fabric' },
    { id: 'embroidery', label: 'DTF & Embroidery', type: 'detail', focus: 'embroidery' },
  ];

  const handlePrevImage = () => {
    setActiveThumbnailIndex(prev => {
      const nextIdx = prev === 0 ? galleryViews.length - 1 : prev - 1;
      const targetView = galleryViews[nextIdx];
      if (targetView?.orientation) {
        setViewOrientation(targetView.orientation);
      }
      return nextIdx;
    });
  };

  const handleNextImage = () => {
    setActiveThumbnailIndex(prev => {
      const nextIdx = prev === galleryViews.length - 1 ? 0 : prev + 1;
      const targetView = galleryViews[nextIdx];
      if (targetView?.orientation) {
        setViewOrientation(targetView.orientation);
      }
      return nextIdx;
    });
  };

  // 7. Sticky Bottom Purchase Bar Scroll Visibility
  const [showStickyBar, setShowStickyBar] = useState(false);
  const mainBuyButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (mainBuyButtonRef.current) {
        const rect = mainBuyButtonRef.current.getBoundingClientRect();
        // Show sticky bar when the main button scrolls out of view
        setShowStickyBar(rect.bottom < 0);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 8. Add to Cart Handler
  const [isAdding, setIsAdding] = useState(false);
  const [addedSuccessToast, setAddedSuccessToast] = useState(false);

  const handleAddToCartClick = async () => {
    if (isAdding) return;
    setIsAdding(true);

    // Ensure size distribution matches quantity if apparel
    let finalDistribution = { ...sizeDistribution };
    if (product.sizes) {
      if (totalAssignedSizes !== quantity) {
        // Auto-assign to default sizes so order isn't blocked
        const popular = defaultSizes.filter(s => s.startsWith('M') || s.startsWith('L') || s.startsWith('XL'));
        const target = popular.length > 0 ? popular : defaultSizes.slice(0, 2);
        const per = Math.floor(quantity / target.length);
        let rem = quantity;
        target.forEach((sz, idx) => {
          if (idx === target.length - 1) finalDistribution[sz] = rem;
          else {
            finalDistribution[sz] = per;
            rem -= per;
          }
        });
        setSizeDistribution(finalDistribution);
      }
    }

    const activeArtworkForLegacy = frontArtwork || backArtwork || undefined;
    const activePlacementForLegacy = frontArtwork ? frontPlacement : (backArtwork ? backPlacement : 'Custom Print');

    const newItem: CartItem = isCanopy ? {
      id: `cart-${product.id}-${Date.now()}`,
      product,
      color: { name: 'Navy Blue', hex: '#162B4D', garmentHex: '#162B4D' },
      size: selectedCanopySize,
      quantity,
      unitPrice,
      totalPrice,
      printMethod: 'Screen Printing',
      printPlacement: frontArtwork ? frontPlacement : 'Standard Canopy Kiosk',
      artwork: frontArtwork || undefined,
      frontArtwork: frontArtwork || null,
      frontPlacement: frontArtwork ? frontPlacement : undefined,
      customNotes: additionalTextNotes || `Promotional Canopy Kiosk (${selectedCanopySize}, Navy Blue ONLY)`,
      voiceNoteUrl: voiceNoteBlobUrl || undefined,
      artworkStatus: frontArtwork ? 'uploaded' : 'no_artwork'
    } : isMug ? {
      id: `cart-${product.id}-${Date.now()}`,
      product,
      color: selectedColor,
      quantity,
      unitPrice,
      totalPrice,
      printMethod: 'High-Precision UV',
      printPlacement: frontArtwork ? frontPlacement : (backArtwork ? backPlacement : 'Front Printable Area (8.5" × 3")'),
      artwork: activeArtworkForLegacy,
      frontArtwork: frontArtwork || null,
      backArtwork: backArtwork || null,
      frontPlacement: frontArtwork ? frontPlacement : undefined,
      backPlacement: backArtwork ? backPlacement : undefined,
      customNotes: additionalTextNotes || 'Promotional Ceramic Mug (White ONLY)',
      voiceNoteUrl: voiceNoteBlobUrl || undefined,
      artworkStatus: (frontArtwork || backArtwork) ? 'uploaded' : 'no_artwork'
    } : isUmbrella ? {
      id: `cart-${product.id}-${Date.now()}`,
      product,
      color: selectedColor,
      quantity,
      unitPrice,
      totalPrice,
      printMethod: 'Screen Printing',
      printPlacement: frontArtwork ? frontPlacement : (backArtwork ? backPlacement : 'All Panels / Valance'),
      artwork: activeArtworkForLegacy,
      frontArtwork: frontArtwork || null,
      backArtwork: backArtwork || null,
      frontPlacement: frontArtwork ? frontPlacement : undefined,
      backPlacement: backArtwork ? backPlacement : undefined,
      customNotes: additionalTextNotes || `Custom Printed Branding Umbrella (${selectedColor.name})`,
      voiceNoteUrl: voiceNoteBlobUrl || undefined,
      artworkStatus: (frontArtwork || backArtwork) ? 'uploaded' : 'no_artwork'
    } : isVisitingCard ? {
      id: `cart-${product.id}-${Date.now()}`,
      product,
      color: { name: 'White', hex: '#FFFFFF', garmentHex: '#FFFFFF' },
      size: '92 × 52 MM',
      quantity,
      unitPrice,
      totalPrice,
      printMethod: 'High-Precision UV',
      printPlacement: 'Both Side Printing (Front & Back)',
      frontArtwork: visitingCardDesign.frontDataUrl ? {
        type: 'image',
        dataUrl: visitingCardDesign.frontDataUrl,
        x: visitingCardDesign.frontSettings.x,
        y: visitingCardDesign.frontSettings.y,
        scale: visitingCardDesign.frontSettings.scale,
        rotation: visitingCardDesign.frontSettings.rotation,
      } : null,
      backArtwork: visitingCardDesign.backDataUrl ? {
        type: 'image',
        dataUrl: visitingCardDesign.backDataUrl,
        x: visitingCardDesign.backSettings.x,
        y: visitingCardDesign.backSettings.y,
        scale: visitingCardDesign.backSettings.scale,
        rotation: visitingCardDesign.backSettings.rotation,
      } : null,
      frontPlacement: 'Front Side (92 × 52 MM)',
      backPlacement: 'Back Side (92 × 52 MM)',
      customNotes: additionalTextNotes || 'Premium 300 GSM Visiting Card · Both Side Digital Print · White Paper Base ONLY',
      voiceNoteUrl: voiceNoteBlobUrl || undefined,
      artworkStatus: (visitingCardDesign.frontDataUrl || visitingCardDesign.backDataUrl) ? 'uploaded' : 'no_artwork',
      visitingCardDesign: { ...visitingCardDesign },
    } : isStandee ? {
      id: `cart-${product.id}-${Date.now()}`,
      product,
      color: { name: 'Black', hex: '#111215', garmentHex: '#111215' },
      size: '3 ft × 6 ft (36 × 72 in)',
      quantity,
      unitPrice,
      totalPrice,
      printMethod: 'Screen Printing',
      printPlacement: frontArtwork ? frontPlacement : 'Rollup Banner (3 ft × 6 ft)',
      artwork: frontArtwork || undefined,
      frontArtwork: frontArtwork || null,
      frontPlacement: frontArtwork ? frontPlacement : undefined,
      customNotes: additionalTextNotes || 'Rollup Standee · 3 ft × 6 ft · Black ONLY · Carry Bag Included',
      voiceNoteUrl: voiceNoteBlobUrl || undefined,
      artworkStatus: frontArtwork ? 'uploaded' : 'no_artwork'
    } : isPromoTable ? {
      id: `cart-${product.id}-${Date.now()}`,
      product,
      color: selectedColor,
      quantity,
      unitPrice,
      totalPrice,
      printMethod: 'High-Precision UV',
      printPlacement: frontArtwork ? frontPlacement : 'Header & Counter Display',
      artwork: frontArtwork || undefined,
      frontArtwork: frontArtwork || null,
      frontPlacement: frontArtwork ? frontPlacement : undefined,
      customNotes: additionalTextNotes || 'Portable Promo Table (White)',
      voiceNoteUrl: voiceNoteBlobUrl || undefined,
      artworkStatus: frontArtwork ? 'uploaded' : 'no_artwork'
    } : {
      id: `cart-${product.id}-${Date.now()}`,
      product,
      color: selectedColor,
      size: product.sizes ? Object.keys(finalDistribution).find(k => finalDistribution[k] > 0) || 'L' : undefined,
      sizeDistribution: finalDistribution,
      quantity,
      unitPrice,
      totalPrice,
      printMethod: selectedPrintMethod,
      printPlacement: activePlacementForLegacy,
      artwork: activeArtworkForLegacy,
      frontArtwork: frontArtwork || null,
      backArtwork: backArtwork || null,
      frontPlacement: frontArtwork ? frontPlacement : undefined,
      backPlacement: backArtwork ? backPlacement : undefined,
      customNotes: additionalTextNotes || 'Custom corporate branding order',
      voiceNoteUrl: voiceNoteBlobUrl || undefined,
      artworkStatus: artworkStatus
    };

    try {
      const { frontMockupDataUrl, backMockupDataUrl } = await generateItemMockupSnapshots(newItem);
      if (frontMockupDataUrl) newItem.previewUrl = frontMockupDataUrl;
      if (backMockupDataUrl) newItem.backPreviewUrl = backMockupDataUrl;
    } catch (snapErr) {
      console.warn('[ProductDetailView] Snapshot generation skipped:', snapErr);
    }

    onAddToCart(newItem);
    setAddedSuccessToast(true);
    setTimeout(() => {
      setIsAdding(false);
      setAddedSuccessToast(false);
    }, 1500);
  };

  // Related products filtered from catalog
  const relatedProducts = PRODUCTS.filter(p => p.id !== product.id).slice(0, 4);

  return (
    <div className="bg-[#FAF9FD] min-h-screen text-[#0B0B0D] pb-36 sm:pb-28">
      
      {/* Breadcrumb Navigation Ribbon */}
      <div className="bg-white border-b border-[#E5E5EA]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1">
            <button 
              onClick={onBack}
              className="hover:text-[#FF7A00] transition-colors font-medium flex items-center gap-1 group cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform duration-300" />
              <span>Back</span>
            </button>
            <span>/</span>
            <span className="hover:text-zinc-800 cursor-pointer">Home</span>
            <span>/</span>
            <span className="capitalize hover:text-zinc-800 cursor-pointer">{product.category}</span>
            <span>/</span>
            <span className="text-zinc-800 font-semibold truncate max-w-xs sm:max-w-md">
              {product.name}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 font-mono text-[11px] text-zinc-400">
            <span>SKU: {product.id.toUpperCase()}</span>
            <span>·</span>
            <span className="text-emerald-600 font-semibold">18% ITC GST Invoice</span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Product Studio Area */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-start">
          
          {/* ========================================================================= */}
          {/* LEFT COLUMN (6 cols on desktop, full width on mobile/tablet): Sticky Gallery & Visualizer */}
          {/* ========================================================================= */}
          <div className="lg:col-span-6 space-y-4 lg:sticky lg:top-24">
            
            {/* Primary Image & Interactive Canvas Container */}
            <div className="relative bg-white rounded-2xl border border-[#E5E5EA] shadow-xs overflow-hidden group">
              
              {/* Top Controls Bar: Badges & View Switcher (Fluid, non-overlapping flex layout) */}
              <div className="absolute top-2.5 sm:top-3 inset-x-2.5 sm:inset-x-3 z-20 flex items-start justify-between gap-1.5 pointer-events-none">
                {/* Left: Badges */}
                <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto shrink-0 max-w-[46%] sm:max-w-none">
                  <span className="bg-[#FF7A00] text-white text-[9px] sm:text-[11px] font-bold px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md shadow-xs truncate">
                    {product.badge || '15% Bulk Off'}
                  </span>
                  <span className="hidden xs:inline-block bg-zinc-900/80 backdrop-blur-xs text-white text-[9px] sm:text-[11px] font-mono px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-white/10 shrink-0">
                    Min {product.moq || (isUmbrella || isPromoTable ? 1 : 2)} {isUmbrella || isPromoTable ? 'unit' : 'pcs'}
                  </span>
                </div>

                {/* Right: Front/Back View Switcher & Maximize Button */}
                {!isVisitingCard && (
                  <div className="flex items-center gap-1 sm:gap-1.5 pointer-events-auto shrink-0">
                    {!isCanopy && !isPromoTable && !isMug && !isStandee && (
                      <div className="inline-flex items-center bg-white/95 backdrop-blur-xs border border-zinc-200 rounded-lg p-0.5 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            setViewOrientation('front');
                            setActiveThumbnailIndex(0);
                          }}
                          className={`px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                            viewOrientation !== 'back'
                              ? 'bg-[#0B0B0D] text-white shadow-2xs'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          <span className="sm:hidden">Front</span>
                          <span className="hidden sm:inline">Front View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setViewOrientation('back');
                            setActiveThumbnailIndex(isUmbrella ? 1 : (isCap ? 3 : 1));
                          }}
                          className={`px-2 sm:px-3 py-1 rounded-md text-[10px] sm:text-xs font-bold transition-all cursor-pointer ${
                            viewOrientation === 'back'
                              ? 'bg-[#FF7A00] text-white shadow-2xs'
                              : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                        >
                          <span className="sm:hidden">Back</span>
                          <span className="hidden sm:inline">Back View</span>
                        </button>
                      </div>
                    )}
                    {onToggleWishlist && (
                      <button
                        type="button"
                        onClick={() => onToggleWishlist(product.id)}
                        aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                        title={isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center shadow-2xs transition-all cursor-pointer shrink-0 ${
                          isWishlisted
                            ? 'bg-rose-50 border-rose-200 text-rose-500'
                            : 'bg-white/90 hover:bg-white border-zinc-200 text-zinc-700 hover:text-rose-500'
                        }`}
                      >
                        <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 shadow-2xs transition-colors cursor-pointer shrink-0"
                      title="Fullscreen Zoom"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Main Visual Display (Mockup Canvas or High-Def Detail Focus) */}
              <div className="p-4 pt-12 sm:p-10 flex items-center justify-center min-h-[320px] sm:min-h-[440px] lg:min-h-[460px] bg-gradient-to-b from-zinc-50/70 to-white relative">
                
                {/* Visual Header Watermark / Title Overlay (Positioned in bottom-left above size strip to avoid covering product collar, chest & top controls) */}
                {!isPromoTable && !isUmbrella && !isMug && !isCanopy && !isStandee && !isVisitingCard && (
                  <div className="absolute bottom-12 sm:bottom-14 left-3 sm:left-5 z-10 pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-zinc-200/80 shadow-2xs">
                      <div className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold leading-tight">
                        {isCap
                          ? '100% Pure Cotton Twill'
                          : (viewOrientation === 'back' ? 'Back View · Seamless Finish' : '100% Pure Cotton')}
                      </div>
                      <div className="font-display font-black text-xs sm:text-sm text-[#0B0B0D] tracking-tight leading-tight">
                        {isCap
                          ? 'COTTON FLEXI CAPS'
                          : (viewOrientation === 'back' ? 'BACK ARTWORK PRINT' : 'PRINTED T-SHIRTS')}
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-semibold text-[#FF7A00] tracking-wide leading-tight">
                        {isCap
                          ? 'FRONT PANEL LOGO EMBROIDERY'
                          : (viewOrientation === 'back' ? 'CENTER BACK / NAPE PLACEMENT' : 'WITH YOUR COMPANY LOGO')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Central Display */}
                {isCanopy ? (
                  activeThumbnailIndex === 1 || viewOrientation === 'dimensions' ? (
                    <div 
                      onClick={() => setIsLightboxOpen(true)}
                      className="w-full max-w-sm sm:max-w-md mx-auto relative transition-transform duration-300 flex items-center justify-center cursor-zoom-in group/img py-2"
                    >
                      <div className="w-full relative flex flex-col items-center justify-center">
                        <img
                          src={selectedCanopySize === '8 × 8 ft' ? '/assets/aistudio/7_7_ft_Blue_Canopy_Booth_Infographic_3ac991cf.webp' : '/assets/aistudio/Blue_Canopy_Booth_Dimensions_Infographic_320b507e.webp'}
                          alt={`Promotional Canopy Kiosk - ${selectedCanopySize} Specifications`}
                          width={600}
                          height={600}
                          loading="eager"
                          fetchPriority="high"
                          decoding="async"
                          className="w-full max-h-[440px] sm:max-h-[500px] object-contain drop-shadow-md transition-transform duration-300 group-hover/img:scale-101"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-sm sm:max-w-md mx-auto relative flex items-center justify-center">
                      <ProductMockupCanvas
                        productType="canopy"
                        color={selectedColor}
                        artwork={frontArtwork}
                        printMethod="Screen Printing"
                        printPlacement={frontPlacement}
                        view="front"
                        selectedVariantLabel={selectedCanopySize}
                        className="w-full h-80 sm:h-96 drop-shadow-md"
                      />
                    </div>
                  )
                ) : isUmbrella ? (
                  activeThumbnailIndex === 2 || viewOrientation === 'dimensions' ? (
                    <div 
                      onClick={() => setIsLightboxOpen(true)}
                      className="w-full max-w-xl mx-auto relative transition-transform duration-300 flex items-center justify-center cursor-zoom-in group/img p-1 sm:p-2"
                    >
                      <img
                        src={selectedColor.imageFront || '/assets/umbrella/red-dimensions.webp'}
                        alt={`${product.name} - ${selectedColor.name} Dimensions`}
                        width={600}
                        height={600}
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        className="w-full h-auto max-h-[520px] object-contain drop-shadow-sm transition-transform duration-300 group-hover/img:scale-[1.01]"
                      />
                    </div>
                  ) : (
                    <div className="w-full max-w-sm sm:max-w-md mx-auto relative flex items-center justify-center">
                      <ProductMockupCanvas
                        productType="umbrella"
                        color={selectedColor}
                        artwork={viewOrientation === 'back' || activeThumbnailIndex === 1 ? backArtwork : frontArtwork}
                        printMethod="Screen Printing"
                        printPlacement={viewOrientation === 'back' || activeThumbnailIndex === 1 ? backPlacement : frontPlacement}
                        view={viewOrientation === 'back' || activeThumbnailIndex === 1 ? 'back' : 'front'}
                        className="w-full h-80 sm:h-96 drop-shadow-md"
                      />
                    </div>
                  )
                ) : isMug ? (
                  <div 
                    onClick={() => {
                      if (activeThumbnailIndex > 0) setIsLightboxOpen(true);
                    }}
                    className={`w-full max-w-sm sm:max-w-md mx-auto relative transition-transform duration-300 flex items-center justify-center ${activeThumbnailIndex > 0 ? 'cursor-zoom-in' : ''} group/img py-2`}
                  >
                    {activeThumbnailIndex === 3 || viewOrientation === 'dimensions' ? (
                      <div className="w-full flex flex-col items-center justify-center">
                        <img
                          src="/assets/aistudio/White_Mug_Dimensions_and_Features_Infographic_47e1f529.webp"
                          alt="Promotional Ceramic Mug Specifications & Dimensions"
                          width={600}
                          height={600}
                          loading="eager"
                          fetchPriority="high"
                          decoding="async"
                          className="w-full max-h-[440px] sm:max-h-[500px] object-contain drop-shadow-md rounded-xl"
                        />
                      </div>
                    ) : activeThumbnailIndex === 2 || viewOrientation === 'top' ? (
                      <div className="w-full flex flex-col items-center justify-center py-2">
                        <img
                          src="/assets/aistudio/Top-Down_White_Ceramic_Mug_46e962e8.webp"
                          alt="Top View - Ceramic Mug Interior & Rim"
                          width={500}
                          height={500}
                          loading="eager"
                          decoding="async"
                          className="w-full max-h-[380px] sm:max-h-[440px] object-contain drop-shadow-md"
                        />
                        <span className="text-[11px] font-mono font-bold text-zinc-500 mt-2 bg-white px-3 py-1 rounded-full border border-zinc-200 shadow-2xs">
                          Top-Down View · Smooth Rounded Rim & Interior
                        </span>
                      </div>
                    ) : activeThumbnailIndex === 1 || viewOrientation === 'back' ? (
                      <div className="w-full relative flex flex-col items-center justify-center">
                        {backArtwork ? (
                          <ProductMockupCanvas
                            productType="mug"
                            color={selectedColor}
                            artwork={backArtwork}
                            printMethod="High-Precision UV"
                            printPlacement={backPlacement}
                            view="back"
                            className="w-full h-80 sm:h-96 drop-shadow-md"
                          />
                        ) : (
                          <>
                            <img
                              src="/assets/mug/mug_back_blank.webp"
                              alt="Back View - Plain White Ceramic Mug"
                              width={500}
                              height={500}
                              loading="eager"
                              decoding="async"
                              className="w-full max-h-[380px] sm:max-h-[440px] object-contain drop-shadow-md"
                            />
                            <span className="text-[11px] font-mono font-bold text-zinc-500 mt-2 bg-white px-3 py-1 rounded-full border border-zinc-200 shadow-2xs">
                              Back View · Seamless Blank White Ceramic Surface
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="w-full relative flex items-center justify-center">
                        <ProductMockupCanvas
                          productType="mug"
                          color={selectedColor}
                          artwork={frontArtwork}
                          printMethod="High-Precision UV"
                          printPlacement={frontPlacement}
                          view="front"
                          className="w-full h-80 sm:h-96 drop-shadow-md"
                        />
                      </div>
                    )}
                  </div>
                ) : isPromoTable ? (
                  activeThumbnailIndex === 0 && viewOrientation === 'front' ? (
                    <div className="w-full max-w-sm sm:max-w-md mx-auto relative flex items-center justify-center">
                      <ProductMockupCanvas
                        productType="display"
                        color={selectedColor}
                        artwork={frontArtwork}
                        printMethod="High-Precision UV"
                        printPlacement={frontPlacement}
                        view="front"
                        className="w-full h-80 sm:h-96 drop-shadow-md"
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => setIsLightboxOpen(true)}
                      className="w-full max-w-sm sm:max-w-md mx-auto relative transition-transform duration-300 flex items-center justify-center cursor-zoom-in group/img py-2"
                    >
                      <img
                        src={
                          activeThumbnailIndex === 3
                            ? '/assets/promo-table/dimensions.webp'
                            : activeThumbnailIndex === 2
                            ? '/assets/promo-table/side.webp'
                            : activeThumbnailIndex === 1
                            ? '/assets/promo-table/back.webp'
                            : '/assets/promo-table/front.webp'
                        }
                        alt={
                          activeThumbnailIndex === 3
                            ? 'Promo Table Dimensions Infographic'
                            : activeThumbnailIndex === 2
                            ? 'Promo Table Side View'
                            : activeThumbnailIndex === 1
                            ? 'Promo Table Back View with Storage Shelves'
                            : 'Promo Table Front View - Dimensions Infographic'
                        }
                        width={600}
                        height={600}
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        className="w-full max-h-[420px] sm:max-h-[500px] object-contain drop-shadow-md transition-transform duration-300 group-hover/img:scale-101"
                      />
                    </div>
                  )
                ) : isVisitingCard ? (
                  <div className="w-full max-w-lg mx-auto relative flex flex-col items-center justify-center py-2">
                    {/* Clean Single Navigation Selector: FRONT SIDE / BACK SIDE */}
                    <div className="w-full flex items-center justify-between mb-4 px-1 gap-2">
                      <div className="inline-flex p-1 bg-zinc-100 rounded-xl border border-zinc-200/90 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => {
                            setViewOrientation('front');
                            setActiveThumbnailIndex(0);
                          }}
                          className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold font-display uppercase tracking-wider transition-all cursor-pointer ${
                            viewOrientation === 'front' || activeThumbnailIndex === 0
                              ? 'bg-[#FF7A00] text-white shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60'
                          }`}
                        >
                          FRONT SIDE
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setViewOrientation('back');
                            setActiveThumbnailIndex(1);
                          }}
                          className={`px-3.5 sm:px-4 py-2 rounded-lg text-xs font-bold font-display uppercase tracking-wider transition-all cursor-pointer ${
                            viewOrientation === 'back' || activeThumbnailIndex === 1
                              ? 'bg-[#FF7A00] text-white shadow-xs'
                              : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60'
                          }`}
                        >
                          BACK SIDE
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono font-bold text-zinc-700 bg-white px-3 py-1.5 rounded-lg border border-zinc-200 shadow-2xs whitespace-nowrap">
                          92 × 52 MM
                        </span>
                        {onToggleWishlist && (
                          <button
                            type="button"
                            onClick={() => onToggleWishlist(product.id)}
                            aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                            title={isWishlisted ? 'Saved in Wishlist' : 'Save to Wishlist'}
                            className={`w-8 h-8 rounded-lg border shadow-2xs flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                              isWishlisted
                                ? 'bg-rose-50 border-rose-200 text-rose-500'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:text-rose-500 hover:bg-zinc-50'
                            }`}
                          >
                            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsLightboxOpen(true)}
                          className="w-8 h-8 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900 shadow-2xs flex items-center justify-center hover:bg-zinc-50 transition-colors cursor-pointer shrink-0"
                          title="Fullscreen Zoom"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Realistic 2D White Visiting Card Mockup Canvas */}
                    <div className="w-full aspect-[92/52] max-w-[480px] relative group/card flex items-center justify-center p-3">
                      {/* Subtle stack effect undercard layers for tactile realism */}
                      <div className="absolute inset-x-5 bottom-1 top-4 bg-zinc-200/90 rounded-md rotate-1 blur-[0.5px] -z-10 shadow-md" />
                      <div className="absolute inset-x-5 bottom-2.5 top-2.5 bg-zinc-100 rounded-md -rotate-0.5 -z-10 shadow-sm" />

                      {/* Top Card Face: Clean Pure White Art Paper */}
                      <div
                        className="w-full h-full bg-white rounded-md border border-zinc-300 relative overflow-hidden flex items-center justify-center transition-all duration-300 shadow-xl"
                        style={{
                          boxShadow: '0 20px 30px -10px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06)',
                        }}
                      >
                        {/* Current side artwork or clean placeholder */}
                        {((viewOrientation === 'front' || activeThumbnailIndex === 0)
                          ? visitingCardDesign.frontDataUrl
                          : visitingCardDesign.backDataUrl) ? (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{
                              transform:
                                viewOrientation === 'front' || activeThumbnailIndex === 0
                                  ? `translate(${visitingCardDesign.frontSettings.x}%, ${visitingCardDesign.frontSettings.y}%) rotate(${visitingCardDesign.frontSettings.rotation}deg) scale(${visitingCardDesign.frontSettings.scale})`
                                  : `translate(${visitingCardDesign.backSettings.x}%, ${visitingCardDesign.backSettings.y}%) rotate(${visitingCardDesign.backSettings.rotation}deg) scale(${visitingCardDesign.backSettings.scale})`,
                            }}
                          >
                            <img
                              src={
                                viewOrientation === 'front' || activeThumbnailIndex === 0
                                  ? visitingCardDesign.frontDataUrl
                                  : visitingCardDesign.backDataUrl
                              }
                              alt={`Visiting Card ${viewOrientation === 'front' || activeThumbnailIndex === 0 ? 'Front' : 'Back'} Artwork`}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center p-4 space-y-2 pointer-events-none">
                            <span className="text-[11px] font-mono font-bold tracking-widest text-zinc-400 uppercase">
                              {viewOrientation === 'front' || activeThumbnailIndex === 0
                                ? 'FRONT SIDE'
                                : 'BACK SIDE'}
                            </span>
                            <div className="w-10 h-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FF7A00]">
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <span className="text-xs font-mono font-semibold text-zinc-600">
                              300 GSM Pure White Art Paper
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsVisitingCardEditorOpen(true)}
                              className="pointer-events-auto text-[11px] font-bold text-[#FF7A00] hover:underline"
                            >
                              + Upload{' '}
                              {viewOrientation === 'front' || activeThumbnailIndex === 0
                                ? 'FRONT SIDE'
                                : 'BACK SIDE'}{' '}
                              Artwork
                            </button>
                          </div>
                        )}

                        {/* Paper subtle sheen overlay */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-black/2 via-transparent to-white/10 pointer-events-none" />
                      </div>
                    </div>

                    {/* View Label & Dimensions */}
                    <div className="mt-4 flex items-center justify-between w-full max-w-[480px] px-1">
                      <span className="text-xs font-mono font-semibold text-zinc-500">
                        {viewOrientation === 'front' || activeThumbnailIndex === 0
                          ? 'Viewing: FRONT SIDE (92 × 52 MM)'
                          : 'Viewing: BACK SIDE (92 × 52 MM)'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsVisitingCardEditorOpen(true)}
                        className="text-xs font-bold text-[#FF7A00] hover:text-[#E06900] bg-[#FF7A00]/10 hover:bg-[#FF7A00]/15 px-3 py-1.5 rounded-lg border border-[#FF7A00]/30 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Upload / Edit Artwork</span>
                      </button>
                    </div>
                  </div>
                ) : isStandee ? (
                  activeThumbnailIndex === 0 && viewOrientation === 'front' ? (
                    <div className="w-full max-w-sm sm:max-w-md mx-auto relative flex items-center justify-center">
                      <ProductMockupCanvas
                        productType="standee"
                        color={selectedColor}
                        artwork={frontArtwork}
                        printMethod="Screen Printing"
                        printPlacement={frontPlacement}
                        view="front"
                        className="w-full h-80 sm:h-96 drop-shadow-md"
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => setIsLightboxOpen(true)}
                      className="w-full max-w-sm sm:max-w-md mx-auto relative transition-transform duration-300 flex items-center justify-center cursor-zoom-in group/img py-2"
                    >
                      <div className="w-full relative flex flex-col items-center justify-center">
                        <img
                          key={viewOrientation === 'back' || activeThumbnailIndex === 2 ? 'standee-back' : 'standee-specs'}
                          src={
                            viewOrientation === 'back' || activeThumbnailIndex === 2
                              ? '/assets/standee/back.webp'
                              : '/assets/standee/front.webp'
                          }
                          alt={
                            viewOrientation === 'back' || activeThumbnailIndex === 2
                              ? 'Rollup Standee - Black ONLY Back View (Rear Telescopic Pole & Stabilizer Footing)'
                              : 'Rollup Standee - Black ONLY Front View (3 ft × 6 ft Retractable Banner & Specifications)'
                          }
                          className="w-full max-h-[460px] sm:max-h-[520px] object-contain drop-shadow-md transition-all duration-300 group-hover/img:scale-101"
                        />
                        <div className="mt-2.5 text-center">
                          <span className="text-[11px] font-mono font-bold text-zinc-700 bg-white/95 px-3 py-1 rounded-full border border-zinc-200 shadow-2xs">
                            {viewOrientation === 'back' || activeThumbnailIndex === 2
                              ? 'Back View · Rear Support Pole & Base Mechanism'
                              : 'Specs View · 3 ft × 6 ft Banner Infographic & Specifications'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="w-full max-w-sm sm:max-w-md mx-auto relative transition-transform duration-300">
                    <ProductMockupCanvas
                      productType={product.productType || 'polo'}
                      color={selectedColor}
                      artwork={viewOrientation === 'back' ? backArtwork : frontArtwork}
                      printMethod={selectedPrintMethod}
                      printPlacement={viewOrientation === 'back' ? backPlacement : frontPlacement}
                      view={viewOrientation === 'back' ? 'back' : 'front'}
                      className="w-full h-80 sm:h-96 drop-shadow-md"
                    />

                    {/* Visual Indicator when current view has no artwork placed (Positioned safely near bottom to avoid top control collision) */}
                    {viewOrientation === 'back' && !backArtwork && (
                      <div className="absolute bottom-10 sm:bottom-12 inset-x-0 mx-auto w-fit z-20 bg-white/95 backdrop-blur-xs border border-zinc-200/90 shadow-sm rounded-full px-3 py-1 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-500">Back view is clean</span>
                        <button
                          type="button"
                          onClick={() => {
                            setModalActiveSide('back');
                            setIsDesignModalOpen(true);
                          }}
                          className="text-[10px] font-bold text-[#FF7A00] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>+ Add Back Logo / Print</span>
                        </button>
                      </div>
                    )}

                    {viewOrientation === 'front' && !frontArtwork && (
                      <div className="absolute bottom-10 sm:bottom-12 inset-x-0 mx-auto w-fit z-20 bg-white/95 backdrop-blur-xs border border-zinc-200/90 shadow-sm rounded-full px-3 py-1 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-500">Front view is clean</span>
                        <button
                          type="button"
                          onClick={() => {
                            setModalActiveSide('front');
                            setIsDesignModalOpen(true);
                          }}
                          className="text-[10px] font-bold text-[#FF7A00] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>+ Add Front Logo</span>
                        </button>
                      </div>
                    )}

                    {/* Circular Detail Inset Loupe (Hidden on small mobile to avoid covering product details) */}
                    <div className="absolute bottom-14 sm:bottom-16 right-2 sm:right-4 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full border-2 border-white shadow-xl overflow-hidden bg-white/95 hidden sm:flex flex-col items-center justify-center pointer-events-none z-10">
                      <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-zinc-100">
                        <img
                          src={isCap ? (selectedColor.imageFront || '/assets/caps/black.webp') : (viewOrientation === 'back' ? poloImages.back : poloImages.front)}
                          alt="Detail Zoom"
                          className="w-48 h-48 object-cover object-top -translate-y-3 scale-150 drop-shadow-xs"
                        />
                        <div className="absolute bottom-1 inset-x-0 text-center bg-black/60 backdrop-blur-2xs py-0.5">
                          <span className="text-[8px] font-mono font-bold text-white uppercase tracking-wider">
                            {isCap ? 'Front Crown' : (viewOrientation === 'back' ? 'Back Yoke' : ((isPlainPolo || isJoabPolo || isMattyPolo) ? 'Collar Detail' : 'Tipping Detail'))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Left & Right Prev/Next Image Navigation Arrows */}
                {!isVisitingCard && (
                  <>
                    <button
                      onClick={handlePrevImage}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white border border-zinc-200 shadow-md flex items-center justify-center text-zinc-700 hover:text-[#0B0B0D] transition-all z-20 group cursor-pointer"
                      aria-label="Previous view"
                    >
                      <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-300" />
                    </button>

                    <button
                      onClick={handleNextImage}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white border border-zinc-200 shadow-md flex items-center justify-center text-zinc-700 hover:text-[#0B0B0D] transition-all z-20 group cursor-pointer"
                      aria-label="Next view"
                    >
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform duration-300" />
                    </button>
                  </>
                )}

                {/* Bottom Sizes Banner for apparel */}
                {!isPromoTable && !isUmbrella && !isMug && !isCanopy && !isStandee && !isVisitingCard && (
                  <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-6 right-2 sm:right-6 z-10 flex items-center justify-between gap-1.5 sm:gap-2 border-t border-zinc-200/80 pt-2 bg-white/85 backdrop-blur-xs px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg">
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold text-zinc-700 overflow-x-auto no-scrollbar">
                      <span className="text-zinc-400 shrink-0">Sizes:</span>
                      <div className="flex items-center gap-1 font-mono text-[10px]">
                        {(product.sizes ? product.sizes.map(s => s.split(' ')[0]) : ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']).map((s) => (
                          <span key={s} className="px-1.5 py-0.5 bg-zinc-100 rounded border border-zinc-200 text-zinc-800 font-bold shrink-0">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-zinc-400 hidden sm:inline shrink-0">
                      Precision Fit
                    </span>
                  </div>
                )}

              </div>

            </div>

            {/* Thumbnail Strip Gallery */}
            {!isVisitingCard && (
              isCanopy ? (
                <div className="grid grid-cols-2 gap-2.5 pt-1 px-0.5">
                  {galleryViews.map((gv, idx) => (
                    <button
                      key={gv.id}
                      onClick={() => {
                        setActiveThumbnailIndex(idx);
                        if (gv.orientation) setViewOrientation(gv.orientation);
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all bg-white flex items-center justify-center gap-2.5 cursor-pointer min-h-[60px] ${
                        activeThumbnailIndex === idx
                          ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/25 shadow-xs font-bold'
                          : 'border-zinc-200 hover:border-zinc-300 text-zinc-700'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-lg border border-zinc-200/80 shadow-2xs flex items-center justify-center overflow-hidden bg-zinc-50 p-1 shrink-0">
                        <img
                          src={gv.image || '/assets/aistudio/Blue_Canopy_Booth_Dimensions_Infographic_320b507e.webp'}
                          alt={gv.label}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="text-left min-w-0">
                        <div className="text-xs font-bold text-zinc-900 font-display truncate">
                          {gv.label}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono truncate">
                          {idx === 0 ? `${selectedCanopySize} Preview` : 'Frame & Specs'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : isUmbrella ? (
                <div className="grid grid-cols-3 gap-2.5 pt-1 px-0.5">
                  {galleryViews.map((gv, idx) => (
                    <button
                      key={gv.id}
                      onClick={() => {
                        setActiveThumbnailIndex(idx);
                        if (gv.orientation) setViewOrientation(gv.orientation);
                      }}
                      className={`p-2 rounded-xl border text-center transition-all bg-white flex flex-col items-center justify-center gap-1 cursor-pointer min-h-[60px] ${
                        activeThumbnailIndex === idx
                          ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/25 shadow-xs'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="w-12 h-10 rounded-lg border border-zinc-200/80 shadow-2xs flex items-center justify-center overflow-hidden bg-zinc-50 p-1">
                        <img
                          src={gv.image || umbrellaImages.front}
                          alt={gv.label}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-zinc-800 truncate max-w-full leading-tight font-display">
                        {gv.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : isMug ? (
                <div className="grid grid-cols-4 gap-2.5 pt-1 px-0.5">
                  {galleryViews.map((gv, idx) => (
                    <button
                      key={gv.id}
                      onClick={() => {
                        setActiveThumbnailIndex(idx);
                        if (gv.orientation) setViewOrientation(gv.orientation);
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all bg-white flex flex-col items-center justify-center gap-1.5 cursor-pointer min-h-[64px] ${
                        activeThumbnailIndex === idx
                          ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/25 shadow-xs'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="w-14 h-11 rounded-lg border border-zinc-200/80 shadow-2xs flex items-center justify-center overflow-hidden bg-zinc-50 p-1">
                        <img
                          src={gv.image || '/assets/aistudio/Blank_White_Ceramic_Mug_b82bfadb.webp'}
                          alt={gv.label}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[10px] font-bold text-zinc-800 truncate max-w-full leading-tight font-display">
                        {gv.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : isStandee ? (
                <div className="grid grid-cols-3 gap-2.5 pt-1 px-0.5">
                  {galleryViews.map((gv, idx) => (
                    <button
                      key={gv.id}
                      onClick={() => {
                        setActiveThumbnailIndex(idx);
                        if (gv.orientation) setViewOrientation(gv.orientation);
                      }}
                      className={`p-2 rounded-xl border text-center transition-all bg-white flex flex-col items-center justify-center gap-1 cursor-pointer min-h-[64px] ${
                        activeThumbnailIndex === idx
                          ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/25 shadow-xs font-bold'
                          : 'border-zinc-200 hover:border-zinc-300 text-zinc-700'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-lg border border-zinc-200/80 shadow-2xs flex items-center justify-center overflow-hidden bg-zinc-50 p-1 shrink-0">
                        <img
                          src={gv.image || '/assets/standee/front.webp'}
                          alt={gv.label}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="text-[10px] font-bold text-zinc-900 font-display truncate max-w-full">
                        {gv.label}
                      </div>
                    </button>
                  ))}
                </div>
              ) : isPromoTable ? (
                <div className="grid grid-cols-4 gap-2 pt-1 px-0.5">
                  {galleryViews.map((gv, idx) => (
                    <button
                      key={gv.id}
                      onClick={() => {
                        setActiveThumbnailIndex(idx);
                        if (gv.orientation) setViewOrientation(gv.orientation);
                      }}
                      className={`p-2 rounded-xl border text-center transition-all bg-white flex flex-col items-center justify-center gap-1 cursor-pointer min-h-[58px] ${
                        activeThumbnailIndex === idx
                          ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/25 shadow-xs'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div className="w-12 h-10 rounded-lg border border-zinc-200/80 shadow-2xs flex items-center justify-center overflow-hidden bg-zinc-50 p-0.5">
                        <img
                          src={gv.image || '/assets/promo-table/front.webp'}
                          alt={gv.label}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className="text-[10px] font-medium text-zinc-700 truncate max-w-full leading-tight font-display">
                        {gv.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex sm:grid sm:grid-cols-6 gap-2 pt-1 overflow-x-auto pb-1 no-scrollbar touch-pan-x px-0.5">
                  {galleryViews.map((gv, idx) => (
                    <button
                      key={gv.id}
                      onClick={() => {
                        setActiveThumbnailIndex(idx);
                        if (gv.orientation) setViewOrientation(gv.orientation);
                      }}
                      className={`min-w-[74px] sm:min-w-0 flex-1 shrink-0 p-2 rounded-xl border text-center transition-all bg-white flex flex-col items-center justify-center gap-1 cursor-pointer min-h-[44px] ${
                        activeThumbnailIndex === idx
                          ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/20 shadow-xs'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      <div 
                        className="w-8 h-8 rounded-lg border border-zinc-200/80 shadow-2xs flex items-center justify-center overflow-hidden bg-zinc-50"
                      >
                        {gv.id === 'front' ? (
                          <img 
                            src={isCap ? (selectedColor.imageFront || '/assets/caps/black.webp') : poloImages.front} 
                            alt="Front View" 
                            className="w-full h-full object-contain p-0.5" 
                          />
                        ) : gv.id === 'back' || gv.id === 'strap' ? (
                          <img 
                            src={isCap ? (selectedColor.imageBack || selectedColor.imageFront || '/assets/caps/black.webp') : poloImages.back} 
                            alt="Back View" 
                            className="w-full h-full object-contain p-0.5" 
                          />
                        ) : (
                          <div 
                            className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: selectedColor.garmentHex || selectedColor.hex }}
                          >
                            {gv.id === 'collar' ? '⌁' : gv.id === 'sleeve' ? '═' : gv.id === 'fabric' ? '▦' : gv.id === 'crown' ? '▲' : gv.id === 'visor' ? '⌒' : '✦'}
                          </div>
                        )}
                      </div>
                      <span className="text-[9px] font-medium text-zinc-600 truncate max-w-full leading-tight">
                        {gv.label}
                      </span>
                    </button>
                  ))}
                </div>
              )
            )}

            {/* Feature Highlights Bar under gallery */}
            {isVisitingCard ? (
              <div className="space-y-3.5">
                <div className="bg-[#FFF4EC] rounded-2xl p-3.5 sm:p-4 border border-[#FFE0CC] shadow-xs">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-white rounded-xl p-2.5 border border-[#FFD4B8] text-center shadow-2xs">
                      <div className="text-[11px] font-bold text-zinc-900 font-display">300 GSM Pure Art</div>
                      <div className="text-[10px] text-zinc-500 font-mono">Premium Weight Paper</div>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-[#FFD4B8] text-center shadow-2xs">
                      <div className="text-[11px] font-bold text-zinc-900 font-display">White Paper ONLY</div>
                      <div className="text-[10px] text-zinc-500 font-mono">Full-Color Print Ready</div>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-[#FFD4B8] text-center shadow-2xs">
                      <div className="text-[11px] font-bold text-zinc-900 font-display">92 × 52 MM Size</div>
                      <div className="text-[10px] text-zinc-500 font-mono">Clean Laser Die-Cut</div>
                    </div>
                    <div className="bg-white rounded-xl p-2.5 border border-[#FFD4B8] text-center shadow-2xs">
                      <div className="text-[11px] font-bold text-zinc-900 font-display">Both Side Printing</div>
                      <div className="text-[10px] text-zinc-500 font-mono">Front + Back Included</div>
                    </div>
                  </div>
                </div>

                {/* ROW 1: Print Quality Badges (High Quality Digital Print, Art Paper, 300 GSM, Vibrant Color) */}
                <div className="w-full rounded-2xl border border-zinc-200/90 bg-white p-2 sm:p-2.5 shadow-2xs overflow-hidden flex items-center justify-center">
                  <img
                    src="/assets/visiting-card/quality-features.webp"
                    alt="Print Quality Features: High Quality Digital Print, Art Paper (Smooth Finish), 300 GSM Thick & Durable, Vibrant Color Print"
                    width={600}
                    height={80}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto object-contain block"
                  />
                </div>

                {/* ROW 2: Premium Feature Badges (Premium Look & Feel, Long Lasting, Sharp & Clear Print, 100% Customizable) */}
                <div className="w-full rounded-2xl border border-zinc-200/90 bg-white p-2 sm:p-2.5 shadow-2xs overflow-hidden flex items-center justify-center">
                  <img
                    src="/assets/aistudio/Premium_Badge_Features_Row_97df853d.webp"
                    alt="Premium Features: Premium Look & Feel, Long Lasting, Sharp & Clear Print, 100% Customizable Design"
                    width={600}
                    height={80}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto object-contain block"
                  />
                </div>
              </div>
            ) : isCanopy ? (
              <div className="bg-[#FFF4EC] rounded-2xl p-3 sm:p-4 border border-[#FFE0CC] shadow-xs">
                {/* 6-Feature Visual Graphic Banner Strip */}
                <div className="bg-white rounded-xl p-2 sm:p-3 border border-[#FFD4B8] shadow-2xs overflow-hidden flex items-center justify-center">
                  <img
                    src="/assets/aistudio/image_8bb3a6aa.webp"
                    alt="Canopy Kiosk Features: Premium Polyester Fabric, Heavy-Duty & Sturdy, Easy Assembly, Lightweight & Portable, Reusable & Long Lasting, Custom Branding Available"
                    className="w-full max-w-3xl h-auto object-contain mx-auto"
                  />
                </div>
              </div>
            ) : isStandee ? (
              <div className="space-y-3 pt-2">
                {/* 1. Rollup Standee Premium Quality Feature Strip */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-zinc-200/90 shadow-xs overflow-hidden flex items-center justify-center">
                  <img
                    src="/assets/standee/features.webp"
                    alt="Rollup Standee Features: Premium Metal Stand, High-Quality Flex Printing, Easy to Install, Lightweight & Portable, Carry Bag Included, Ideal for Events"
                    className="w-full max-w-2xl h-auto object-contain rounded-xl"
                  />
                </div>

                {/* 2. Perfect For Banner Strip */}
                <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-zinc-200/90 shadow-xs overflow-hidden flex items-center justify-center">
                  <img
                    src="/assets/standee/perfect-for.webp"
                    alt="Perfect For: Retail Stores, Exhibitions & Trade Shows, Events & Promotions, Corporate Branding, Product Launches, Marketing Campaigns"
                    className="w-full max-w-2xl h-auto object-contain rounded-xl"
                  />
                </div>
              </div>
            ) : isUmbrella ? (
              <div className="bg-[#FFF4EC] rounded-2xl p-3.5 sm:p-4 border border-[#FFE0CC] shadow-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  {/* 1. Premium Polyester Fabric */}
                  <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/70 hover:bg-white border border-[#FFD4B8]/70 hover:border-[#FF7A00]/40 transition-all duration-300 hover:scale-103 shadow-2xs group">
                    <div 
                      className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-[#FFD4B8] flex items-center justify-center text-[#FF7A00] mb-1.5 transition-transform duration-300 group-hover:scale-110"
                    >
                      <Layers className="w-5 h-5 text-[#FF7A00] animate-icon-layers" style={{ animationDelay: '0ms' }} />
                    </div>
                    <div className="font-display font-bold text-[11px] sm:text-xs text-[#0B0B0D] leading-tight">
                      Premium Polyester Fabric
                    </div>
                  </div>

                  {/* 2. UV Protection */}
                  <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/70 hover:bg-white border border-[#FFD4B8]/70 hover:border-[#FF7A00]/40 transition-all duration-300 hover:scale-103 shadow-2xs group">
                    <div 
                      className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-[#FFD4B8] flex items-center justify-center text-[#FF7A00] mb-1.5 transition-transform duration-300 group-hover:scale-110"
                    >
                      <ShieldCheck className="w-5 h-5 text-[#FF7A00] animate-icon-shield" style={{ animationDelay: '150ms' }} />
                    </div>
                    <div className="font-display font-bold text-[11px] sm:text-xs text-[#0B0B0D] leading-tight">
                      UV Protection
                    </div>
                  </div>

                  {/* 3. Wind Resistant */}
                  <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/70 hover:bg-white border border-[#FFD4B8]/70 hover:border-[#FF7A00]/40 transition-all duration-300 hover:scale-103 shadow-2xs group">
                    <div 
                      className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-[#FFD4B8] flex items-center justify-center text-[#FF7A00] mb-1.5 transition-transform duration-300 group-hover:scale-110"
                    >
                      <Wind className="w-5 h-5 text-[#FF7A00] animate-icon-wind" style={{ animationDelay: '300ms' }} />
                    </div>
                    <div className="font-display font-bold text-[11px] sm:text-xs text-[#0B0B0D] leading-tight">
                      Wind Resistant
                    </div>
                  </div>

                  {/* 4. Easy Setup */}
                  <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/70 hover:bg-white border border-[#FFD4B8]/70 hover:border-[#FF7A00]/40 transition-all duration-300 hover:scale-103 shadow-2xs group">
                    <div 
                      className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-[#FFD4B8] flex items-center justify-center text-[#FF7A00] mb-1.5 transition-transform duration-300 group-hover:scale-110"
                    >
                      <Wrench className="w-5 h-5 text-[#FF7A00] animate-icon-wrench" style={{ animationDelay: '450ms' }} />
                    </div>
                    <div className="font-display font-bold text-[11px] sm:text-xs text-[#0B0B0D] leading-tight">
                      Easy Setup
                    </div>
                  </div>

                  {/* 5. Lightweight & Portable */}
                  <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/70 hover:bg-white border border-[#FFD4B8]/70 hover:border-[#FF7A00]/40 transition-all duration-300 hover:scale-103 shadow-2xs group">
                    <div 
                      className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-[#FFD4B8] flex items-center justify-center text-[#FF7A00] mb-1.5 transition-transform duration-300 group-hover:scale-110"
                    >
                      <Feather className="w-5 h-5 text-[#FF7A00] animate-icon-feather" style={{ animationDelay: '600ms' }} />
                    </div>
                    <div className="font-display font-bold text-[11px] sm:text-xs text-[#0B0B0D] leading-tight">
                      Lightweight & Portable
                    </div>
                  </div>

                  {/* 6. Reusable & Durable */}
                  <div className="flex flex-col items-center text-center p-2 rounded-xl bg-white/70 hover:bg-white border border-[#FFD4B8]/70 hover:border-[#FF7A00]/40 transition-all duration-300 hover:scale-103 shadow-2xs group">
                    <div 
                      className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-[#FFD4B8] flex items-center justify-center text-[#FF7A00] mb-1.5 transition-transform duration-300 group-hover:scale-110"
                    >
                      <Recycle className="w-5 h-5 text-[#FF7A00] animate-icon-recycle" style={{ animationDelay: '750ms' }} />
                    </div>
                    <div className="font-display font-bold text-[11px] sm:text-xs text-[#0B0B0D] leading-tight">
                      Reusable & Durable
                    </div>
                  </div>
                </div>
              </div>
            ) : isMug ? (
              <div className="bg-[#FFF4EC] rounded-2xl p-3 sm:p-4 border border-[#FFE0CC] shadow-xs">
                {/* 6-Feature Visual Graphic Banner Strip */}
                <div className="bg-white rounded-xl p-2 sm:p-3 border border-[#FFD4B8] shadow-2xs overflow-hidden flex items-center justify-center">
                  <img
                    src="/assets/aistudio/image_548e2a36.webp"
                    alt="Ceramic Mug Features: Premium Ceramic Material, Vibrant & Long-Lasting Print, Microwave Safe, Dishwasher Safe, Ideal for Corporate Gifting, Custom Logo Printing"
                    className="w-full max-w-3xl h-auto object-contain mx-auto"
                  />
                </div>
              </div>
            ) : isPromoTable ? (
              <div className="bg-[#FFF4EC] rounded-2xl p-4 sm:p-5 border border-[#FFE0CC] shadow-xs">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0 lg:divide-x lg:divide-[#FFD4B8]">
                  {/* 1. Brand Promotion */}
                  <div className="flex flex-col items-center text-center px-2 sm:px-3">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-[#FFD4B8] flex items-center justify-center text-[#FF7A00] mb-2">
                      <Megaphone className="w-5 h-5 animate-icon-megaphone" />
                    </div>
                    <div className="font-display font-bold text-xs sm:text-sm text-[#0B0B0D]">
                      Brand Promotion
                    </div>
                    <div className="text-[11px] text-zinc-600 mt-0.5">
                      Overhead Header Panel
                    </div>
                  </div>

                  {/* 2. Lightweight & Portable */}
                  <div className="flex flex-col items-center text-center px-2 sm:px-3">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-[#FFD4B8] flex items-center justify-center text-[#FF7A00] mb-2">
                      <Feather className="w-5 h-5 animate-icon-feather" />
                    </div>
                    <div className="font-display font-bold text-xs sm:text-sm text-[#0B0B0D]">
                      Lightweight & Portable
                    </div>
                    <div className="text-[11px] text-zinc-600 mt-0.5">
                      Foldable + Carry Bag
                    </div>
                  </div>

                  {/* 3. Quick Setup */}
                  <div className="flex flex-col items-center text-center px-2 sm:px-3">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-[#FFD4B8] flex items-center justify-center text-[#FF7A00] mb-2">
                      <Wrench className="w-5 h-5 animate-icon-wrench" />
                    </div>
                    <div className="font-display font-bold text-xs sm:text-sm text-[#0B0B0D]">
                      Quick Setup
                    </div>
                    <div className="text-[11px] text-zinc-600 mt-0.5">
                      Tool-Free in 3 Mins
                    </div>
                  </div>

                  {/* 4. Reusable & Durable */}
                  <div className="flex flex-col items-center text-center px-2 sm:px-3">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-2xs border border-[#FFD4B8] flex items-center justify-center text-[#FF7A00] mb-2">
                      <Recycle className="w-5 h-5 animate-icon-recycle" />
                    </div>
                    <div className="font-display font-bold text-xs sm:text-sm text-[#0B0B0D]">
                      Reusable & Durable
                    </div>
                    <div className="text-[11px] text-zinc-600 mt-0.5">
                      Heavy-Duty PP & Steel
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Quality & Corporate Dispatch Assurance Cards - Shared Component for ALL Products */}
            <ProductAssuranceCards product={product} />

          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN (6 cols on desktop, full width on mobile/tablet): Product Configuration */}
          {/* ========================================================================= */}
          <div className="lg:col-span-6 space-y-6">
            {isVisitingCard ? (
              <VisitingCardBuyBox
                product={product}
                quantity={quantity}
                setQuantity={setQuantity}
                design={visitingCardDesign}
                onOpenEditor={() => setIsVisitingCardEditorOpen(true)}
                onAddToCart={handleAddToCartClick}
                isAdding={isAdding}
                addedSuccessToast={addedSuccessToast}
                mainBuyButtonRef={mainBuyButtonRef}
              />
            ) : isCanopy ? (
              <CanopyKioskBuyBox
                product={product}
                selectedSize={selectedCanopySize}
                onSelectSize={(sz) => setSelectedCanopySize(sz)}
                totalPrice={totalPrice}
                totalMrp={totalMrp}
                unitPrice={unitPrice}
                savingsPercent={savingsPercent}
                quantity={quantity}
                setQuantity={setQuantity}
                nextTierUpsell={nextTierUpsell}
                onAddToCart={handleAddToCartClick}
                isAdding={isAdding}
                addedSuccessToast={addedSuccessToast}
                mainBuyButtonRef={mainBuyButtonRef}
                sizePricingMap={canopyPricingConfig}
                selectedColor={selectedColor}
                frontArtwork={frontArtwork}
                frontPlacement={frontPlacement}
                onUpdateArtwork={(art) => setFrontArtwork(art)}
                onOpenCustomizer={() => {
                  setModalActiveSide('front');
                  setIsDesignModalOpen(true);
                }}
              />
            ) : isStandee ? (
              <RollupStandeeBuyBox
                product={product}
                totalPrice={totalPrice}
                totalMrp={totalMrp}
                unitPrice={unitPrice}
                savingsPercent={savingsPercent}
                quantity={quantity}
                setQuantity={setQuantity}
                nextTierUpsell={nextTierUpsell}
                onAddToCart={handleAddToCartClick}
                isAdding={isAdding}
                addedSuccessToast={addedSuccessToast}
                mainBuyButtonRef={mainBuyButtonRef}
                selectedColor={selectedColor}
                frontArtwork={frontArtwork}
                frontPlacement={frontPlacement}
                onUpdateArtwork={(art) => setFrontArtwork(art)}
                onOpenCustomizer={() => {
                  setModalActiveSide('front');
                  setIsDesignModalOpen(true);
                }}
              />
            ) : isUmbrella ? (
              <UmbrellaBuyBox
                product={product}
                totalPrice={totalPrice}
                totalMrp={totalMrp}
                unitPrice={unitPrice}
                savingsPercent={savingsPercent}
                quantity={quantity}
                setQuantity={setQuantity}
                nextTierUpsell={nextTierUpsell}
                onAddToCart={handleAddToCartClick}
                isAdding={isAdding}
                addedSuccessToast={addedSuccessToast}
                mainBuyButtonRef={mainBuyButtonRef}
                selectedColor={selectedColor}
                onSelectColor={setSelectedColor}
                frontArtwork={frontArtwork}
                backArtwork={backArtwork}
                frontPlacement={frontPlacement}
                backPlacement={backPlacement}
                onUpdateArtwork={(art) => {
                  setFrontArtwork(art);
                  if (art) setBackArtwork(art);
                }}
                onOpenCustomizer={(side) => {
                  setModalActiveSide(side || 'front');
                  setIsDesignModalOpen(true);
                }}
              />
            ) : isMug ? (
              <MugBuyBox
                product={product}
                selectedColor={selectedColor}
                totalPrice={totalPrice}
                totalMrp={totalMrp}
                unitPrice={unitPrice}
                savingsPercent={savingsPercent}
                quantity={quantity}
                setQuantity={setQuantity}
                nextTierUpsell={nextTierUpsell}
                onAddToCart={handleAddToCartClick}
                isAdding={isAdding}
                addedSuccessToast={addedSuccessToast}
                mainBuyButtonRef={mainBuyButtonRef}
                frontArtwork={frontArtwork}
                backArtwork={backArtwork}
                frontPlacement={frontPlacement}
                backPlacement={backPlacement}
                onUpdateArtwork={(art) => {
                  setFrontArtwork(art);
                  if (art) setBackArtwork(art);
                }}
                onOpenCustomizer={(side) => {
                  setModalActiveSide(side || 'front');
                  setIsDesignModalOpen(true);
                }}
              />
            ) : isPromoTable ? (
              <PromoTableBuyBox
                product={product}
                totalPrice={totalPrice}
                totalMrp={totalMrp}
                unitPrice={unitPrice}
                savingsPercent={savingsPercent}
                quantity={quantity}
                setQuantity={setQuantity}
                nextTierUpsell={nextTierUpsell}
                onAddToCart={handleAddToCartClick}
                isAdding={isAdding}
                addedSuccessToast={addedSuccessToast}
                mainBuyButtonRef={mainBuyButtonRef}
                selectedColor={selectedColor}
                frontArtwork={frontArtwork}
                frontPlacement={frontPlacement}
                onUpdateArtwork={(art) => setFrontArtwork(art)}
                onOpenCustomizer={() => {
                  setModalActiveSide('front');
                  setIsDesignModalOpen(true);
                }}
              />
            ) : (
            <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4 sm:p-6 md:p-8 shadow-xs space-y-6">
              
              {/* Product Title & Brand */}
              <div>
                <h1 className="font-display text-xl sm:text-2xl font-bold text-[#0B0B0D] tracking-tight leading-snug">
                  {product.name}
                </h1>

                {/* Specification Badges with Checkmarks (matching screenshot 1) */}
                <div className="flex flex-wrap items-center gap-2 mt-3.5">
                  {(product.features && product.features.length > 0 ? product.features.slice(0, 5) : [
                    'Tshirts Material - 100% Pure Cotton',
                    '250 - 260 GSM',
                    `Printing - ${selectedPrintMethod}`,
                    'Soft & Breathable Fabric',
                    'Perfect for Daily Wear'
                  ]).map((badgeText, idx) => (
                    <div 
                      key={idx}
                      className="inline-flex items-center gap-1.5 bg-zinc-50 border border-zinc-200/80 px-2.5 py-1 rounded-md text-[11px] font-medium text-zinc-700"
                    >
                      <Check className="w-3.5 h-3.5 text-[#FF7A00] stroke-[2.5]" />
                      <span>{badgeText}</span>
                    </div>
                  ))}
                </div>

                {/* Rating & Orders Social Proof */}
                <div className="flex items-center gap-3 text-xs mt-3 pt-2 border-t border-zinc-100">
                  <div className="flex items-center gap-1 text-amber-500">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                    <span className="font-bold text-zinc-800 ml-1">{product.rating}</span>
                    <span className="text-zinc-500">({product.reviewCount} Reviews)</span>
                  </div>
                  <span className="text-zinc-300">|</span>
                  <span className="text-emerald-700 font-semibold font-mono text-[11px]">
                    1650+ Orders Delivered
                  </span>
                </div>
              </div>

              {/* Dynamic Price Display */}
              <div className="bg-[#FAF9FD] rounded-xl p-4 border border-[#ECEAF3] flex flex-wrap items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-2.5">
                  <span className="font-display font-extrabold text-2xl sm:text-3xl text-[#0B0B0D] tabular-nums tracking-tight">
                    {formatCurrencyINR(totalPrice)}
                  </span>
                  {quantity > (maxQty || 100) && (
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded font-mono">
                      Quote on Request (&gt; {maxQty || 100} pcs)
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-zinc-600 font-medium">
                  {formatCurrencyINR(unitPrice)}/{unitLabel || 'pc'} · Inclusive of All Taxes
                </div>
              </div>

              {/* ------------------------------------------------------------------- */}
              {/* SECTION: Colour Selection Grid (24 Swatches matching screenshot 1) */}
              {/* ------------------------------------------------------------------- */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
                    Colour
                  </span>
                  <span className="bg-zinc-900 text-white text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                    {selectedColor.name}
                  </span>
                </div>

                {/* Swatches Grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                  {product.colors.map((c) => {
                    const isSelected = selectedColor.name === c.name;
                    return (
                      <button
                        key={c.name}
                        onClick={() => {
                          setSelectedColor(c);
                          setViewOrientation('front');
                          setActiveThumbnailIndex(0);
                        }}
                        className={`group relative p-1.5 rounded-xl border flex flex-col items-center justify-center transition-all bg-white cursor-pointer ${
                          isSelected
                            ? 'border-[#FF7A00] ring-2 ring-[#FF7A00]/25 shadow-xs scale-103'
                            : 'border-zinc-200 hover:border-zinc-300'
                        }`}
                        title={c.name}
                      >
                        {/* Mini Polo Swatch with garmentHex and contrast tipping */}
                        <div 
                          className="w-7 h-7 rounded-md border border-black/15 shadow-inner flex flex-col items-center justify-between relative overflow-hidden"
                          style={{ backgroundColor: c.garmentHex || c.hex }}
                        >
                          {/* Contrast Tipping Stripe */}
                          {c.tippingHex && (
                            <div 
                              className="w-full h-1.5 shrink-0 border-b border-black/15" 
                              style={{ backgroundColor: c.tippingHex }}
                            />
                          )}
                          <div className="flex-1 flex items-center justify-center">
                            {isSelected && (
                              <Check className={`w-3.5 h-3.5 stroke-[3] ${c.hex === '#FFFFFF' || c.hex === '#F8F9FA' ? 'text-zinc-900' : 'text-white'}`} />
                            )}
                          </div>
                        </div>
                        <span className="text-[9px] font-medium text-zinc-600 truncate max-w-full mt-1">
                          {c.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ------------------------------------------------------------------- */}
              {/* SECTION: Quantity Selector & Bulk Pricing (matching screenshot 2)   */}
              {/* ------------------------------------------------------------------- */}
              <div className="space-y-4 pt-4 border-t border-[#E5E5EA]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
                    Quantity
                  </span>
                  <span className="bg-[#FF7A00] text-white text-[11px] font-mono font-bold px-2.5 py-0.5 rounded shadow-2xs">
                    {quantity} pcs
                  </span>
                </div>

                {/* Stepper with per piece and total price */}
                <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-50 p-3 rounded-xl border border-zinc-200/80">
                  <div className="flex items-center gap-1.5 bg-white border border-zinc-300 rounded-lg p-1 shadow-2xs">
                    <button
                      onClick={() => setQuantity(Math.max(product.moq || 2, quantity - 1))}
                      disabled={quantity <= (product.moq || 2)}
                      className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-zinc-700 hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={product.moq || 2}
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(product.moq || 2, parseInt(e.target.value) || (product.moq || 2)))}
                      className="w-14 text-center font-mono font-bold text-sm text-[#0B0B0D] focus:outline-hidden"
                    />
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-8 h-8 rounded flex items-center justify-center text-sm font-bold text-zinc-700 hover:bg-zinc-100 transition-colors"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right">
                    <div className="font-display font-extrabold text-base text-[#0B0B0D] tabular-nums">
                      {formatCurrencyINR(unitPrice)} <span className="text-xs font-normal text-zinc-500">per piece</span>
                    </div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {formatCurrencyINR(totalPrice)} total
                    </div>
                  </div>
                </div>

                {/* QUANTITY-WISE PRICE LIST (Clickable Tier Cards strictly matching pricing rules) */}
                <div className="space-y-2">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                    QUANTITY-WISE PRICE LIST
                  </div>

                  <div className={`grid grid-cols-2 sm:grid-cols-4 ${(slabs && slabs.length >= 7) ? 'lg:grid-cols-4 xl:grid-cols-7' : 'md:grid-cols-4'} gap-1.5`}>
                    {(slabs || []).map((slab) => {
                      const isActive = quantity >= slab.minQty && quantity <= slab.maxQty;
                      return (
                        <button
                          key={slab.label}
                          onClick={() => setQuantity(slab.minQty)}
                          className={`p-2 rounded-lg border text-center transition-all cursor-pointer ${
                            isActive
                              ? 'border-[#FF7A00] bg-[#FF7A00]/5 ring-1 ring-[#FF7A00]/40 shadow-xs'
                              : 'border-zinc-200 bg-white hover:border-zinc-300'
                          }`}
                        >
                          <div className="text-[9px] font-mono font-bold text-zinc-500">{slab.label}</div>
                          <div className="font-display font-bold text-xs text-[#0B0B0D] mt-0.5">{formatCurrencyINR(slab.pricePerUnit)}</div>
                          <div className={`text-[9px] font-semibold mt-0.5 ${isActive ? 'text-[#FF7A00]' : 'text-zinc-500'}`}>
                            per piece
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic Upsell helper callout (mint green box from reference) */}
                {nextTierUpsell && quantity <= (maxQty || 100) && (
                  <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-emerald-900">
                    <div className="leading-snug">
                      Add <strong className="font-bold text-emerald-950">{nextTierUpsell.diff} more</strong> piece → pay <strong className="font-bold">{formatCurrencyINR(nextTierUpsell.price)}/pc</strong> and save {formatCurrencyINR(nextTierUpsell.savingsPerPiece)} on every piece.
                    </div>
                    <button
                      onClick={() => setQuantity(nextTierUpsell.minQty)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-2xs whitespace-nowrap transition-colors"
                    >
                      Make it {nextTierUpsell.minQty}
                    </button>
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------------- */}
              {/* SECTION: Customization & Logo Upload Buttons                        */}
              {/* ------------------------------------------------------------------- */}
              <div className="space-y-3 pt-4 border-t border-[#E5E5EA]">
                
                {/* 1. Primary Studio Button */}
                {isStrictPlainPolo ? (
                  <button
                    onClick={() => setIsDesignModalOpen(true)}
                    className="w-full bg-gradient-to-r from-[#071B35] to-[#0E2B52] hover:from-[#0B2344] hover:to-[#133563] text-white p-3.5 sm:p-4 rounded-xl shadow-md border border-[#FF7900]/40 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-display font-bold text-xs sm:text-sm tracking-wide flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-[#FF7900] text-white flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </span>
                        <span className="truncate">Open 230 GSM Polo Studio</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase bg-[#FF7900] text-white px-2 py-0.5 rounded font-bold shrink-0">
                        Pro Studio
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 font-medium mt-1.5 pl-9 leading-snug">
                      Layers · Magic Eraser · Front &amp; Back zones · Save, Compare &amp; PNG Proof
                    </div>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsDesignModalOpen(true)}
                    className="w-full bg-[#FF7A00] hover:bg-[#ff881a] text-white p-3.5 rounded-xl shadow-md transition-all text-center group"
                  >
                    <div className="font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2">
                      <Edit3 className="w-4 h-4" />
                      <span>Edit your design</span>
                    </div>
                    <div className="text-[11px] text-white/90 font-medium mt-0.5">
                      Your logo is on it · change colour, size or text
                    </div>
                  </button>
                )}

                {/* 2. White Card: Just Upload Your Logo */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-white hover:bg-zinc-50 border border-zinc-200 p-3 rounded-xl cursor-pointer text-center transition-all group shadow-2xs"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".png,.jpg,.jpeg,.svg,.pdf"
                    className="hidden"
                  />
                  <div className="text-xs font-bold text-zinc-900 flex items-center justify-center gap-1.5">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>Just Upload Your Logo</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    Our team will design & share preview for approval
                  </div>
                </div>

                {/* 3. "✓ Your design is ready" Status Panel (matching screenshot 2 & 4) */}
                <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 sm:p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Your design is ready</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setViewOrientation(v => (v === 'front' ? 'back' : 'front'));
                          setActiveThumbnailIndex(viewOrientation === 'front' ? 1 : 0);
                        }}
                        className="text-[11px] font-semibold text-zinc-700 hover:text-zinc-900 bg-white border border-zinc-300 px-2.5 py-1 rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
                        title="Toggle Front/Back View"
                      >
                        <Eye className="w-3 h-3 text-[#FF7A00]" />
                        <span>{viewOrientation === 'front' ? 'View Back' : 'View Front'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setModalActiveSide(viewOrientation === 'back' ? 'back' : 'front');
                          setIsDesignModalOpen(true);
                        }}
                        className="text-[11px] font-bold text-white bg-zinc-900 hover:bg-black px-3 py-1 rounded-lg shadow-2xs cursor-pointer"
                      >
                        Edit design
                      </button>
                    </div>
                  </div>

                  {/* Representative Interactive Preview with Zoom Loupe */}
                  <div className="bg-white rounded-lg border border-zinc-200 p-4 relative flex items-center justify-center overflow-hidden min-h-[180px]">
                    <div className="w-40 sm:w-48 relative">
                      <ProductMockupCanvas
                        productType={product.productType || 'polo'}
                        color={selectedColor}
                        artwork={viewOrientation === 'back' ? backArtwork : frontArtwork}
                        printMethod={selectedPrintMethod}
                        printPlacement={viewOrientation === 'back' ? backPlacement : frontPlacement}
                        view={viewOrientation === 'back' ? 'back' : 'front'}
                        className="w-full h-36 drop-shadow-xs"
                      />

                      {/* Interactive Zoom Loupe Badge connected to active side */}
                      <div className="absolute top-2 right-0 flex items-center gap-1 bg-white/95 border border-zinc-300 shadow-md rounded-full px-2 py-0.5 text-[10px] font-bold text-zinc-800">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                        <span>zoom {viewOrientation === 'front' ? 'FRONT LOGO' : 'BACK PRINT'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-zinc-500 font-mono gap-1 pt-1">
                    <div className="truncate">
                      <span>Front: <strong>{frontArtwork ? frontPlacement : 'None'}</strong></span>
                      <span className="mx-1.5 text-zinc-300">·</span>
                      <span>Back: <strong>{backArtwork ? backPlacement : 'None'}</strong></span>
                    </div>
                    <span className="font-bold text-zinc-800 shrink-0">{quantity} pcs - ₹{totalPrice.toLocaleString('en-IN')}</span>
                  </div>
                </div>

              </div>

              {/* ------------------------------------------------------------------- */}
              {/* SECTION: T-Shirt Size Distribution (matching screenshot 3)          */}
              {/* ------------------------------------------------------------------- */}
              {product.sizes && (
                <div className="space-y-3 pt-4 border-t border-[#E5E5EA]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-900 tracking-wide uppercase font-mono">
                      T-shirt sizes
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAutoDistributeSizes}
                        className="text-[10px] text-[#FF7A00] font-semibold hover:underline"
                      >
                        Auto-fill Sizes
                      </button>
                      <span className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full shadow-2xs ${
                        totalAssignedSizes === quantity
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                      }`}>
                        {totalAssignedSizes}/{quantity} Selected
                      </span>
                    </div>
                  </div>

                  {/* Size Counters Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {defaultSizes.map((sz) => (
                      <div 
                        key={sz}
                        className="bg-zinc-50 border border-zinc-200 rounded-xl p-2.5 flex items-center justify-between"
                      >
                        <span className="font-mono font-bold text-xs text-zinc-800">{sz}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleUpdateSizeQty(sz, -1)}
                            disabled={(sizeDistribution[sz] || 0) <= 0}
                            className="w-6 h-6 rounded bg-white border border-zinc-300 flex items-center justify-center text-xs font-bold disabled:opacity-30"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-mono font-bold text-xs text-zinc-900">
                            {sizeDistribution[sz] || 0}
                          </span>
                          <button
                            onClick={() => handleUpdateSizeQty(sz, 1)}
                            className="w-6 h-6 rounded bg-white border border-zinc-300 flex items-center justify-center text-xs font-bold hover:bg-zinc-100"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Size Distribution Status Message */}
                  <div className="text-[11px] font-mono">
                    {totalAssignedSizes < quantity ? (
                      <span className="text-amber-700 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Choose sizes for {quantity - totalAssignedSizes} more (or click Auto-fill)
                      </span>
                    ) : totalAssignedSizes === quantity ? (
                      <span className="text-emerald-700 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        All {quantity} pieces assigned across sizes!
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {totalAssignedSizes - quantity} extra sizes assigned. Please adjust to {quantity}.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------------- */}
              {/* SECTION: Voice Note & Written Instructions                          */}
              {/* ------------------------------------------------------------------- */}
              <div className="pt-4 border-t border-[#E5E5EA]">
                <VoiceInstructionsCard
                  voiceNoteUrl={voiceNoteBlobUrl}
                  onVoiceNoteChange={setVoiceNoteBlobUrl}
                  textNotes={additionalTextNotes}
                  onTextNotesChange={setAdditionalTextNotes}
                  title="Record a voice note"
                  subtitle={
                    voiceNoteBlobUrl
                      ? 'Voice instructions recorded & ready to attach'
                      : 'Record up to 60s instructions in Hindi / English or type notes'
                  }
                />
              </div>

              {/* ------------------------------------------------------------------- */}
              {/* SECTION: Artwork Approval & Trust Notice (matching screenshot 3)    */}
              {/* ------------------------------------------------------------------- */}
              <div className="space-y-2.5 pt-2">
                <div className="bg-[#FAF9FD] border border-[#ECEAF3] rounded-xl p-3 flex items-start gap-2.5 text-xs text-zinc-700">
                  <div className="w-5 h-5 rounded-md bg-[#FF7A00]/10 text-[#FF7A00] flex items-center justify-center shrink-0 mt-0.5">
                    📋
                  </div>
                  <div className="leading-relaxed">
                    We'll Send <strong className="font-bold text-zinc-900">Design for Approval</strong> After <strong className="font-bold text-zinc-900">Order is Placed/Confirmed</strong>
                  </div>
                </div>

                <div className="bg-[#FAF9FD] border border-[#ECEAF3] rounded-xl p-3 flex items-start gap-2.5 text-xs text-zinc-700">
                  <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                    💬
                  </div>
                  <div className="leading-relaxed">
                    <strong className="font-bold text-zinc-900">Don't have a logo? No problem!</strong> Place your order with text only — our team will create and share a custom design for you.
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------------- */}
              {/* SECTION: Primary ADD TO CART Button / Bulk Quote                     */}
              {/* ------------------------------------------------------------------- */}
              <div className="pt-2">
                {quantity > (maxQty || 100) ? (
                  <a
                    href={getWhatsAppLink(`Hi TeqqnoWorld, I need a bulk quote for ${product.name} (Colour: ${selectedColor.name}, Quantity: ${quantity} pcs). Please share corporate enterprise pricing.`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full bg-[#FF7A00] hover:bg-[#e66e00] text-white font-display font-bold text-sm sm:text-base py-4 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <WhatsAppIcon className="w-5 h-5 text-white" />
                    <span>Request a Bulk Quote for {quantity} Pieces</span>
                  </a>
                ) : (
                  <button
                    ref={mainBuyButtonRef}
                    onClick={handleAddToCartClick}
                    disabled={isAdding}
                    className="w-full bg-[#0B0B0D] hover:bg-black text-white font-display font-extrabold text-sm sm:text-base py-4 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 hover:scale-101 active:scale-99 group cursor-pointer"
                  >
                    <ShoppingCart className="w-5 h-5 group-hover:-rotate-12 group-hover:scale-115 transition-transform duration-300" />
                    <span>{isAdding ? 'Adding to Cart...' : 'ADD TO CART'}</span>
                  </button>
                )}

                {addedSuccessToast && (
                  <div className="text-center text-xs font-semibold text-emerald-700 mt-2 flex items-center justify-center gap-1 animate-icon-pulse-glow">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-bounce" />
                    <span>Added to your cart! Reviewing in drawer...</span>
                  </div>
                )}
              </div>

            </div>
            )}

            {(isVisitingCard || isCanopy || isStandee || isUmbrella || isMug || isPromoTable) && (
              <div className="bg-white rounded-2xl border border-[#E5E5EA] p-4 shadow-xs">
                <VoiceInstructionsCard
                  voiceNoteUrl={voiceNoteBlobUrl}
                  onVoiceNoteChange={setVoiceNoteBlobUrl}
                  textNotes={additionalTextNotes}
                  onTextNotesChange={setAdditionalTextNotes}
                  title="Record a voice note"
                  subtitle={
                    voiceNoteBlobUrl
                      ? 'Voice instructions recorded & ready to attach'
                      : 'Record up to 60s instructions in Hindi / English or type notes'
                  }
                />
              </div>
            )}

            {/* Live Delhivery Area Availability & ETA Checker */}
            <DelhiveryPincodeChecker variant="compact" className="bg-white shadow-xs" />

          </div>

        </div>

        {/* ========================================================================= */}
        {/* PROMOTIONAL CERAMIC MUG: 6 HIGH-DEFINITION INFOGRAPHIC BANNERS (LINE-WISE)*/}
        {/* ========================================================================= */}
        {isMug && (
          <section
            aria-label="Promotional Ceramic Mug Product Overview and Specifications"
            className="mt-14 sm:mt-18 pt-8 sm:pt-10 border-t border-[#E5E5EA]"
          >
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2 px-4">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF3EB] border border-[#FFE2CC] text-xs font-semibold text-[#FF7A00]">
                <span>Product Overview & Full Specifications</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight">
                Everything You Need to Know About Our Ceramic Mugs
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500">
                Detailed dimensions, printing specifications, everyday durability, and the 5-step order fulfillment process.
              </p>
            </div>

            {/* Line-wise Stack of 6 Panoramic Banners */}
            <div className="space-y-4 sm:space-y-6">
              {CERAMIC_MUG_INFOGRAPHIC_BANNERS.map((banner, index) => (
                <div
                  key={banner.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200/90 shadow-xs hover:shadow-md transition-shadow duration-300 overflow-hidden flex items-center justify-center p-1 sm:p-2"
                >
                  <img
                    src={banner.src}
                    alt={banner.alt}
                    width={2170}
                    height={725}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="w-full h-auto object-contain rounded-xl sm:rounded-2xl select-none"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* PROMO TABLE: 5 HIGH-DEFINITION INFOGRAPHIC BANNERS (LINE-WISE)            */}
        {/* ========================================================================= */}
        {isPromoTable && (
          <section
            aria-label="Promo Table Product Overview and Specifications"
            className="mt-14 sm:mt-18 pt-8 sm:pt-10 border-t border-[#E5E5EA]"
          >
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2 px-4">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF3EB] border border-[#FFE2CC] text-xs font-semibold text-[#FF7A00]">
                <span>Product Overview & Full Specifications</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight">
                Everything You Need to Know About Our Promo Tables
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500">
                Full 360° views, exact dimensions, heavy-duty construction details, and 4-step ordering guide.
              </p>
            </div>

            {/* Line-wise Stack of 5 Panoramic Banners */}
            <div className="space-y-4 sm:space-y-6">
              {PROMO_TABLE_INFOGRAPHIC_BANNERS.map((banner, index) => (
                <div
                  key={banner.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200/90 shadow-xs hover:shadow-md transition-shadow duration-300 overflow-hidden flex items-center justify-center p-1 sm:p-2"
                >
                  <img
                    src={banner.src}
                    alt={banner.alt}
                    width={2170}
                    height={725}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="w-full h-auto object-contain rounded-xl sm:rounded-2xl select-none"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* BRANDING UMBRELLA: 5 HIGH-DEFINITION INFOGRAPHIC BANNERS (LINE-WISE)      */}
        {/* ========================================================================= */}
        {isUmbrella && (
          <section
            aria-label="Custom Printed Branding Umbrella Product Overview and Specifications"
            className="mt-14 sm:mt-18 pt-8 sm:pt-10 border-t border-[#E5E5EA]"
          >
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2 px-4">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF3EB] border border-[#FFE2CC] text-xs font-semibold text-[#FF7A00]">
                <span>Product Overview & Full Specifications</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight">
                Everything You Need to Know About Our Branding Umbrellas
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500">
                Full 6 ft canopy specifications, weather protection fabric, multi-color branding options, and 4-step ordering guide.
              </p>
            </div>

            {/* Line-wise Stack of 5 Panoramic Banners */}
            <div className="space-y-4 sm:space-y-6">
              {BRANDING_UMBRELLA_INFOGRAPHIC_BANNERS.map((banner, index) => (
                <div
                  key={banner.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200/90 shadow-xs hover:shadow-md transition-shadow duration-300 overflow-hidden flex items-center justify-center p-1 sm:p-2"
                >
                  <img
                    src={banner.src}
                    alt={banner.alt}
                    width={2170}
                    height={725}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="w-full h-auto object-contain rounded-xl sm:rounded-2xl select-none"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* VISITING CARDS: 5 HIGH-DEFINITION INFOGRAPHIC BANNERS (LINE-WISE)         */}
        {/* ========================================================================= */}
        {isVisitingCard && (
          <section
            aria-label="Premium Visiting Cards Product Overview and Specifications"
            className="mt-14 sm:mt-18 pt-8 sm:pt-10 border-t border-[#E5E5EA]"
          >
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2 px-4">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF3EB] border border-[#FFE2CC] text-xs font-semibold text-[#FF7A00]">
                <span>Product Overview & Full Specifications</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight">
                Everything You Need to Know About Our Visiting Cards
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500">
                300 GSM pure art paper, high-definition digital printing, double-sided layouts, and 4-step ordering guide.
              </p>
            </div>

            {/* Line-wise Stack of 5 Panoramic Banners */}
            <div className="space-y-4 sm:space-y-6">
              {VISITING_CARD_INFOGRAPHIC_BANNERS.map((banner, index) => (
                <div
                  key={banner.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200/90 shadow-xs hover:shadow-md transition-shadow duration-300 overflow-hidden flex items-center justify-center p-1 sm:p-2"
                >
                  <img
                    src={banner.src}
                    alt={banner.alt}
                    width={2170}
                    height={725}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="w-full h-auto object-contain rounded-xl sm:rounded-2xl select-none"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* ROLLUP STANDEE: 5 HIGH-DEFINITION INFOGRAPHIC BANNERS (LINE-WISE)         */}
        {/* ========================================================================= */}
        {isStandee && (
          <section
            aria-label="Rollup Standee Product Overview and Specifications"
            className="mt-14 sm:mt-18 pt-8 sm:pt-10 border-t border-[#E5E5EA]"
          >
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2 px-4">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF3EB] border border-[#FFE2CC] text-xs font-semibold text-[#FF7A00]">
                <span>Product Overview & Full Specifications</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight">
                Everything You Need to Know About Our Rollup Standees
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500">
                Full 3 ft × 6 ft retractable banner specifications, heavy-duty aluminium base, HD UV flex printing, and 4-step ordering guide.
              </p>
            </div>

            {/* Line-wise Stack of 5 Panoramic Banners */}
            <div className="space-y-4 sm:space-y-6">
              {ROLLUP_STANDEE_INFOGRAPHIC_BANNERS.map((banner, index) => (
                <div
                  key={banner.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200/90 shadow-xs hover:shadow-md transition-shadow duration-300 overflow-hidden flex items-center justify-center p-1 sm:p-2"
                >
                  <img
                    src={banner.src}
                    alt={banner.alt}
                    width={2170}
                    height={725}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="w-full h-auto object-contain rounded-xl sm:rounded-2xl select-none"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* CANOPY KIOSK: 5 HIGH-DEFINITION INFOGRAPHIC BANNERS (LINE-WISE)            */}
        {/* ========================================================================= */}
        {isCanopy && (
          <section
            aria-label="Promotional Canopy Kiosk Product Overview and Specifications"
            className="mt-14 sm:mt-18 pt-8 sm:pt-10 border-t border-[#E5E5EA]"
          >
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2 px-4">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF3EB] border border-[#FFE2CC] text-xs font-semibold text-[#FF7A00]">
                <span>Product Overview & Full Specifications</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight">
                Everything You Need to Know About Our Canopy Kiosks
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500">
                4×4 ft & 8×8 ft stall specifications, heavy-duty metal frame, weather-resistant fabric, and 4-step ordering guide.
              </p>
            </div>

            {/* Line-wise Stack of 5 Panoramic Banners */}
            <div className="space-y-4 sm:space-y-6">
              {CANOPY_KIOSK_INFOGRAPHIC_BANNERS.map((banner, index) => (
                <div
                  key={banner.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200/90 shadow-xs hover:shadow-md transition-shadow duration-300 overflow-hidden flex items-center justify-center p-1 sm:p-2"
                >
                  <img
                    src={banner.src}
                    alt={banner.alt}
                    width={2170}
                    height={725}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="w-full h-auto object-contain rounded-xl sm:rounded-2xl select-none"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* CUSTOMIZED CAPS: 5 HIGH-DEFINITION INFOGRAPHIC BANNERS (LINE-WISE)        */}
        {/* ========================================================================= */}
        {isCap && (
          <section
            aria-label="Customized Caps Product Overview and Specifications"
            className="mt-14 sm:mt-18 pt-8 sm:pt-10 border-t border-[#E5E5EA]"
          >
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2 px-4">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF3EB] border border-[#FFE2CC] text-xs font-semibold text-[#FF7A00]">
                <span>Product Overview & Full Specifications</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight">
                Everything You Need to Know About Our Customized Caps
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500">
                100% breathable pure cotton, adjustable snapback fit, 8 vibrant color choices, and 5-step seamless order processing.
              </p>
            </div>

            {/* Line-wise Stack of 5 Panoramic Banners */}
            <div className="space-y-4 sm:space-y-6">
              {CUSTOM_CAPS_INFOGRAPHIC_BANNERS.map((banner, index) => (
                <div
                  key={banner.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200/90 shadow-xs hover:shadow-md transition-shadow duration-300 overflow-hidden flex items-center justify-center p-1 sm:p-2"
                >
                  <img
                    src={banner.src}
                    alt={banner.alt}
                    width={2170}
                    height={725}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="w-full h-auto object-contain rounded-xl sm:rounded-2xl select-none"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* POLO T-SHIRTS: 6 HIGH-DEFINITION INFOGRAPHIC BANNERS (LINE-WISE)          */}
        {/* ========================================================================= */}
        {isPoloMerch && (
          <section
            aria-label="Polo T-Shirt Product Overview and Specifications"
            className="mt-14 sm:mt-18 pt-8 sm:pt-10 border-t border-[#E5E5EA]"
          >
            {/* Section Header */}
            <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10 space-y-2 px-4">
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF3EB] border border-[#FFE2CC] text-xs font-semibold text-[#FF7A00]">
                <span>Product Overview & Full Specifications</span>
              </div>
              <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight">
                Everything You Need to Know About Our Polo T-Shirts
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500">
                Premium 220 GSM MARS fabric, 15 vibrant corporate colors, high-definition printing & embroidery, and seamless 4-step delivery.
              </p>
            </div>

            {/* Line-wise Stack of 6 Panoramic Banners */}
            <div className="space-y-4 sm:space-y-6">
              {POLO_TSHIRT_INFOGRAPHIC_BANNERS.map((banner, index) => (
                <div
                  key={banner.id}
                  className="bg-white rounded-2xl sm:rounded-3xl border border-zinc-200/90 shadow-xs hover:shadow-md transition-shadow duration-300 overflow-hidden flex items-center justify-center p-1 sm:p-2"
                >
                  <img
                    src={banner.src}
                    alt={banner.alt}
                    width={2170}
                    height={725}
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="w-full h-auto object-contain rounded-xl sm:rounded-2xl select-none"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* RELATED PRODUCTS ("You May Also Like")                                   */}
        {/* ========================================================================= */}
        <div className="mt-16 sm:mt-20 pt-10 border-t border-[#E5E5EA]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display text-2xl font-bold text-[#0B0B0D] tracking-tight">
                You May Also Like
              </h3>
              <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                Popular companion merchandise ordered by top corporate clients.
              </p>
            </div>
            <button
              onClick={onBack}
              className="text-xs font-semibold text-[#FF7A00] hover:underline"
            >
              View Full Catalog →
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.map((rel) => {
              const isRelWishlisted = wishlistIds.includes(rel.id);
              return (
              <div
                key={rel.id}
                className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="relative aspect-[16/9] bg-zinc-100 overflow-hidden p-4 flex items-center justify-center">
                  <ProductMockupCanvas
                    productType={rel.productType || 'polo'}
                    color={rel.colors[0]}
                    className="w-full h-full drop-shadow-xs"
                  />
                  <div className="absolute top-2 left-2 bg-zinc-900/80 text-white text-[10px] font-mono px-2 py-0.5 rounded">
                    Min: {rel.moq || 2} pcs
                  </div>
                  {onToggleWishlist && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWishlist(rel.id);
                      }}
                      aria-label={isRelWishlisted ? `Remove ${rel.name} from wishlist` : `Save ${rel.name} to wishlist`}
                      className={`absolute top-2 right-2 z-20 w-7 h-7 rounded-full border flex items-center justify-center shadow-xs transition-all cursor-pointer ${
                        isRelWishlisted
                          ? 'bg-rose-50 border-rose-200 text-rose-500'
                          : 'bg-white/95 border-zinc-200 text-zinc-600 hover:text-rose-500'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isRelWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[10px] font-mono uppercase text-zinc-400">
                      {rel.category}
                    </div>
                    <h4 className="font-display font-bold text-sm text-[#0B0B0D] line-clamp-1 mt-0.5">
                      {rel.name}
                    </h4>
                    <p className="text-xs text-zinc-500 line-clamp-2 mt-1">
                      {rel.shortDesc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                    <div>
                      <div className="font-display font-bold text-sm text-[#0B0B0D]">
                        ₹{rel.basePrice} <span className="text-[10px] font-normal text-zinc-500">/ pc</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onCustomize(rel.id)}
                      className="text-xs font-bold bg-[#FF7A00] hover:bg-[#e06c00] text-white px-3 py-1.5 rounded-lg shadow-2xs transition-colors"
                    >
                      Customize Now
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* STICKY BOTTOM PURCHASE BAR (Optimized for Mobile Safe-Area & Touch)       */}
      {/* ========================================================================= */}
      {showStickyBar && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-300 shadow-xl px-3 sm:px-4 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] transition-transform animate-in fade-in slide-in-from-bottom duration-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
            
            {/* Left: Thumbnail & Details */}
            <div className="flex items-center gap-2 sm:gap-3 truncate">
              <div 
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg border border-zinc-300 shadow-inner shrink-0 flex items-center justify-center overflow-hidden bg-white"
                style={{ backgroundColor: selectedColor.garmentHex || selectedColor.hex }}
              >
                {isVisitingCard ? (
                  <img
                    src={visitingCardDesign.frontDataUrl || '/assets/visiting-card/cover.webp'}
                    alt="Visiting Card"
                    width={40}
                    height={40}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain p-0.5"
                  />
                ) : isCanopy ? (
                  <img
                    src={selectedCanopySize === '8 × 8 ft' ? '/assets/aistudio/7_7_ft_Blue_Canopy_Booth_Infographic_3ac991cf.webp' : '/assets/aistudio/Blue_Canopy_Booth_Dimensions_Infographic_320b507e.webp'}
                    alt="Canopy Kiosk"
                    width={40}
                    height={40}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain p-0.5"
                  />
                ) : isStandee ? (
                  <img src="/assets/aistudio/Premium_Rollup_Standee_Infographic_4941e995.webp" alt="Rollup Standee" width={40} height={40} loading="lazy" decoding="async" className="w-full h-full object-contain p-0.5" />
                ) : isUmbrella ? (
                  <img src={umbrellaImages.front} alt={product.name} width={40} height={40} loading="lazy" decoding="async" className="w-full h-full object-contain p-0.5" />
                ) : isMug ? (
                  <img src="/assets/aistudio/Blank_White_Ceramic_Mug_b82bfadb.webp" alt="Promotional Ceramic Mug" width={40} height={40} loading="lazy" decoding="async" className="w-full h-full object-contain p-0.5" />
                ) : isPromoTable ? (
                  <img src="/assets/promo-table/front.webp" alt="Promo Table" width={40} height={40} loading="lazy" decoding="async" className="w-full h-full object-contain p-0.5" />
                ) : (
                  <div className="w-2 h-2 rounded-full bg-white opacity-80" />
                )}
              </div>

              <div className="truncate">
                <div className="text-xs font-bold text-[#0B0B0D] truncate">
                  {isVisitingCard
                    ? `Premium 300 GSM Visiting Card (White ONLY) · ${quantity} pcs`
                    : isCanopy
                    ? `Promotional Canopy Kiosk (${selectedCanopySize}) · ${quantity} ${quantity === 1 ? 'unit' : 'units'}`
                    : isStandee
                    ? `Rollup Standee (3 ft × 6 ft, Black ONLY) · ${quantity} ${quantity === 1 ? 'unit' : 'units'}`
                    : isUmbrella
                    ? `${product.name} (${selectedColor.name}) · ${quantity} ${quantity === 1 ? 'unit' : 'units'}`
                    : isMug
                    ? `Promotional Ceramic Mug (White) · ${quantity} ${quantity === 1 ? 'pc' : 'pcs'}`
                    : isPromoTable
                    ? `Promo Table · ${quantity} ${quantity === 1 ? 'unit' : 'units'}`
                    : `${selectedColor.name} · ${quantity} pcs`}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] font-mono text-zinc-600">
                  <span className="font-bold text-[#0B0B0D] tabular-nums">{formatCurrencyINR(totalPrice)}</span>
                  <span className="text-zinc-500">({formatCurrencyINR(unitPrice)}/{unitLabel || 'pc'})</span>
                </div>
              </div>
            </div>

            {/* Right: Actions (WhatsApp Quote + Buy Button) */}
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={getWhatsAppLink(
                  isVisitingCard
                    ? `Hi TeqqnoWorld, I want a quote for Premium 300 GSM Visiting Cards (White ONLY, 92×52mm, Quantity: ${quantity} pcs). Please share pricing and dispatch schedule.`
                    : isCanopy
                    ? `Hi TeqqnoWorld, I want a quote for Promotional Canopy Kiosk (Size: ${selectedCanopySize}, Navy Blue ONLY, Quantity: ${quantity} units). Please share pricing and dispatch schedule.`
                    : isStandee
                    ? `Hi TeqqnoWorld, I want a quote for Rollup Standee (3 ft × 6 ft, Black ONLY, Quantity: ${quantity} units). Please share pricing and dispatch schedule.`
                    : isUmbrella
                    ? `Hi TeqqnoWorld, I want a quote for Custom Printed Branding Umbrella (${selectedColor.name}, Quantity: ${quantity} units). Please share pricing and delivery schedule.`
                    : isMug
                    ? `Hi TeqqnoWorld, I want a quote for Promotional Ceramic Mug (White ONLY, Quantity: ${quantity} pcs). Please share pricing and delivery schedule.`
                    : isPromoTable 
                    ? `Hi TeqqnoWorld, I want a quote for Promo Table (Quantity: ${quantity} units). Please share pricing and delivery schedule.`
                    : `Hi TeqqnoWorld, I'm customizing ${product.name} (${selectedColor.name}, ${quantity} pcs). Please share bulk quote.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 transition-colors flex items-center justify-center gap-1.5 min-w-[42px] min-h-[44px]"
                title="Instant WhatsApp Quote"
                aria-label="WhatsApp Quote"
              >
                <WhatsAppIcon variant="badge" className="w-4.5 h-4.5" />
                <span className="hidden sm:inline text-xs font-semibold">Quote</span>
              </a>

              <button
                onClick={handleAddToCartClick}
                disabled={isAdding}
                className="bg-[#FF7A00] hover:bg-[#e06c00] active:scale-95 text-white font-display font-bold text-xs sm:text-sm px-4 sm:px-6 py-2.5 rounded-xl shadow-md whitespace-nowrap transition-all min-h-[44px] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{isAdding ? 'Adding...' : 'Add to cart'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Fullscreen Interactive Design Studio Modal                         */}
      {/* ========================================================================= */}
      {isDesignModalOpen && isStrictPlainPolo && (
        <PlainPoloStudioModal
          key={`plain-polo-studio-${product.id}`}
          isOpen={isDesignModalOpen}
          onClose={() => setIsDesignModalOpen(false)}
          product={product}
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          quantity={quantity}
          onQuantityChange={setQuantity}
          sizeDistribution={sizeDistribution}
          onSizeDistributionChange={setSizeDistribution}
          frontArtwork={frontArtwork}
          backArtwork={backArtwork}
          frontPlacement={frontPlacement}
          backPlacement={backPlacement}
          selectedPrintMethod={selectedPrintMethod}
          onSelectPrintMethod={setSelectedPrintMethod}
          uploadedFrontLogoName={uploadedFrontLogoName}
          uploadedBackLogoName={uploadedBackLogoName}
          initialArtworkApproved={artworkStatus === 'approved'}
          initialActiveSide={modalActiveSide}
          onCommitStudioChanges={(payload: PlainPoloModalCommitPayload) => {
            setFrontArtwork(payload.frontArtwork);
            setBackArtwork(payload.backArtwork);
            setFrontPlacement(payload.frontPlacement);
            setBackPlacement(payload.backPlacement);
            setUploadedFrontLogoName(payload.uploadedFrontLogoName);
            setUploadedBackLogoName(payload.uploadedBackLogoName);
            if (payload.selectedColor) setSelectedColor(payload.selectedColor);
            if (payload.selectedPrintMethod) setSelectedPrintMethod(payload.selectedPrintMethod);
            if (typeof payload.quantity === 'number') setQuantity(payload.quantity);
            if (payload.sizeDistribution) setSizeDistribution(payload.sizeDistribution);
            setArtworkStatus(
              payload.artworkStatus === 'approved'
                ? 'approved'
                : payload.frontArtwork || payload.backArtwork
                ? 'uploaded'
                : 'awaiting_review'
            );
          }}
          onDirectAddToCart={async (payload: PlainPoloModalCommitPayload) => {
            setFrontArtwork(payload.frontArtwork);
            setBackArtwork(payload.backArtwork);
            setFrontPlacement(payload.frontPlacement);
            setBackPlacement(payload.backPlacement);
            setUploadedFrontLogoName(payload.uploadedFrontLogoName);
            setUploadedBackLogoName(payload.uploadedBackLogoName);
            if (payload.selectedColor) setSelectedColor(payload.selectedColor);
            if (payload.selectedPrintMethod) setSelectedPrintMethod(payload.selectedPrintMethod);
            if (typeof payload.quantity === 'number') setQuantity(payload.quantity);
            if (payload.sizeDistribution) setSizeDistribution(payload.sizeDistribution);
            const nextStatus =
              payload.artworkStatus === 'approved'
                ? 'approved'
                : payload.frontArtwork || payload.backArtwork
                ? 'uploaded'
                : 'awaiting_review';
            setArtworkStatus(nextStatus);

            const qtyToUse = payload.quantity ?? quantity;
            const colorToUse = payload.selectedColor ?? selectedColor;
            const methodToUse = payload.selectedPrintMethod ?? selectedPrintMethod;
            const pricingForCart = calculateProductPrice(product.id, qtyToUse);
            const activeArt = payload.frontArtwork || payload.backArtwork || undefined;
            const activePlace = payload.frontArtwork
              ? payload.frontPlacement
              : payload.backArtwork
              ? payload.backPlacement
              : 'Custom Print';

            const directItem: CartItem = {
              id: `cart-${product.id}-${Date.now()}`,
              product,
              color: colorToUse,
              size: product.sizes
                ? Object.keys(payload.sizeDistribution || sizeDistribution).find(
                    (k) => (payload.sizeDistribution || sizeDistribution)[k] > 0
                  ) || 'L'
                : undefined,
              sizeDistribution: payload.sizeDistribution || sizeDistribution,
              quantity: qtyToUse,
              unitPrice: pricingForCart.unitPrice,
              totalPrice: pricingForCart.totalPrice,
              printMethod: methodToUse,
              printPlacement: activePlace,
              artwork: activeArt,
              frontArtwork: payload.frontArtwork || null,
              backArtwork: payload.backArtwork || null,
              frontPlacement: payload.frontArtwork ? payload.frontPlacement : undefined,
              backPlacement: payload.backArtwork ? payload.backPlacement : undefined,
              customNotes: additionalTextNotes || 'Custom Plain Polo corporate order',
              voiceNoteUrl: voiceNoteBlobUrl || undefined,
              artworkStatus: nextStatus,
            };

            try {
              const { frontMockupDataUrl, backMockupDataUrl } = await generateItemMockupSnapshots(directItem);
              if (frontMockupDataUrl) directItem.previewUrl = frontMockupDataUrl;
              if (backMockupDataUrl) directItem.backPreviewUrl = backMockupDataUrl;
            } catch (snapErr) {
              console.warn('[PlainPoloStudio] Direct cart snapshot skipped:', snapErr);
            }

            onAddToCart(directItem);
          }}
        />
      )}

      {isDesignModalOpen && !isStrictPlainPolo && (
        <ProductDesignStudioModal
          key={product.id}
          isOpen={isDesignModalOpen}
          onClose={() => setIsDesignModalOpen(false)}
          product={product}
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          quantity={quantity}
          onQuantityChange={setQuantity}
          unitPrice={unitPrice}
          totalPrice={totalPrice}
          moq={moq}
          sizeDistribution={sizeDistribution}
          onSizeDistributionChange={setSizeDistribution}
          frontArtwork={frontArtwork}
          backArtwork={backArtwork}
          frontPlacement={frontPlacement}
          backPlacement={backPlacement}
          selectedPrintMethod={selectedPrintMethod}
          onSelectPrintMethod={setSelectedPrintMethod}
          uploadedFrontLogoName={uploadedFrontLogoName}
          uploadedBackLogoName={uploadedBackLogoName}
          initialArtworkApproved={artworkStatus === 'approved'}
          initialActiveSide={modalActiveSide}
          selectedVariantLabel={isCanopy ? selectedCanopySize : undefined}
          onSelectVariantLabel={
            isCanopy
              ? (v: string) => setSelectedCanopySize(v === '8 × 8 ft' ? '8 × 8 ft' : '4 × 4 ft')
              : undefined
          }
          onCommitStudioChanges={(payload: ProductModalCommitPayload) => {
            setFrontArtwork(payload.frontArtwork);
            setBackArtwork(payload.backArtwork);
            setFrontPlacement(payload.frontPlacement);
            setBackPlacement(payload.backPlacement);
            setUploadedFrontLogoName(payload.uploadedFrontLogoName);
            setUploadedBackLogoName(payload.uploadedBackLogoName);
            if (payload.selectedColor) setSelectedColor(payload.selectedColor);
            if (payload.selectedPrintMethod) setSelectedPrintMethod(payload.selectedPrintMethod);
            if (typeof payload.quantity === 'number') setQuantity(payload.quantity);
            if (payload.sizeDistribution) setSizeDistribution(payload.sizeDistribution);
            if (isCanopy && payload.selectedVariantLabel) {
              setSelectedCanopySize(payload.selectedVariantLabel === '8 × 8 ft' ? '8 × 8 ft' : '4 × 4 ft');
            }
            setArtworkStatus(
              payload.artworkStatus === 'approved'
                ? 'approved'
                : payload.frontArtwork || payload.backArtwork
                ? 'uploaded'
                : 'awaiting_review'
            );
          }}
          onDirectAddToCart={async (payload: ProductModalCommitPayload) => {
            setFrontArtwork(payload.frontArtwork);
            setBackArtwork(payload.backArtwork);
            setFrontPlacement(payload.frontPlacement);
            setBackPlacement(payload.backPlacement);
            setUploadedFrontLogoName(payload.uploadedFrontLogoName);
            setUploadedBackLogoName(payload.uploadedBackLogoName);
            if (payload.selectedColor) setSelectedColor(payload.selectedColor);
            if (payload.selectedPrintMethod) setSelectedPrintMethod(payload.selectedPrintMethod);
            if (typeof payload.quantity === 'number') setQuantity(payload.quantity);
            if (payload.sizeDistribution) setSizeDistribution(payload.sizeDistribution);
            const variantToUse = isCanopy ? payload.selectedVariantLabel || selectedCanopySize : undefined;
            if (isCanopy && payload.selectedVariantLabel) {
              setSelectedCanopySize(payload.selectedVariantLabel === '8 × 8 ft' ? '8 × 8 ft' : '4 × 4 ft');
            }

            const nextStatus =
              payload.artworkStatus === 'approved'
                ? 'approved'
                : payload.frontArtwork || payload.backArtwork
                ? 'uploaded'
                : 'awaiting_review';
            setArtworkStatus(nextStatus);

            const qtyToUse = payload.quantity ?? quantity;
            const colorToUse = payload.selectedColor ?? selectedColor;
            const methodToUse = payload.selectedPrintMethod ?? selectedPrintMethod;
            const pricingForCart = calculateProductPrice(product.id, qtyToUse, variantToUse);
            const activeArt = payload.frontArtwork || payload.backArtwork || undefined;
            const activePlace = payload.frontArtwork
              ? payload.frontPlacement
              : payload.backArtwork
              ? payload.backPlacement
              : 'Custom Print';
            const distToUse = payload.sizeDistribution || sizeDistribution;

            const directItem: CartItem = isCanopy
              ? {
                  id: `cart-${product.id}-${Date.now()}`,
                  product,
                  color: { name: 'Navy Blue', hex: '#162B4D', garmentHex: '#162B4D' },
                  size: variantToUse || '4 × 4 ft',
                  quantity: qtyToUse,
                  unitPrice: pricingForCart.unitPrice,
                  totalPrice: pricingForCart.totalPrice,
                  printMethod: 'Screen Printing',
                  printPlacement: payload.frontArtwork ? payload.frontPlacement : 'Standard Canopy Kiosk',
                  artwork: payload.frontArtwork || undefined,
                  frontArtwork: payload.frontArtwork || null,
                  frontPlacement: payload.frontArtwork ? payload.frontPlacement : undefined,
                  customNotes: additionalTextNotes || `Promotional Canopy Kiosk (${variantToUse || '4 × 4 ft'}, Navy Blue ONLY)`,
                  voiceNoteUrl: voiceNoteBlobUrl || undefined,
                  artworkStatus: nextStatus,
                }
              : isMug
              ? {
                  id: `cart-${product.id}-${Date.now()}`,
                  product,
                  color: colorToUse,
                  quantity: qtyToUse,
                  unitPrice: pricingForCart.unitPrice,
                  totalPrice: pricingForCart.totalPrice,
                  printMethod: methodToUse || 'High-Precision UV',
                  printPlacement: activePlace,
                  artwork: activeArt,
                  frontArtwork: payload.frontArtwork || null,
                  backArtwork: payload.backArtwork || null,
                  frontPlacement: payload.frontArtwork ? payload.frontPlacement : undefined,
                  backPlacement: payload.backArtwork ? payload.backPlacement : undefined,
                  customNotes: additionalTextNotes || 'Promotional Ceramic Mug (White ONLY)',
                  voiceNoteUrl: voiceNoteBlobUrl || undefined,
                  artworkStatus: nextStatus,
                }
              : isUmbrella
              ? {
                  id: `cart-${product.id}-${Date.now()}`,
                  product,
                  color: colorToUse,
                  quantity: qtyToUse,
                  unitPrice: pricingForCart.unitPrice,
                  totalPrice: pricingForCart.totalPrice,
                  printMethod: methodToUse || 'Screen Printing',
                  printPlacement: activePlace,
                  artwork: activeArt,
                  frontArtwork: payload.frontArtwork || null,
                  backArtwork: payload.backArtwork || null,
                  frontPlacement: payload.frontArtwork ? payload.frontPlacement : undefined,
                  backPlacement: payload.backArtwork ? payload.backPlacement : undefined,
                  customNotes: additionalTextNotes || `Custom Printed Branding Umbrella (${colorToUse.name})`,
                  voiceNoteUrl: voiceNoteBlobUrl || undefined,
                  artworkStatus: nextStatus,
                }
              : isStandee
              ? {
                  id: `cart-${product.id}-${Date.now()}`,
                  product,
                  color: { name: 'Black', hex: '#111215', garmentHex: '#111215' },
                  size: '3 ft × 6 ft (36 × 72 in)',
                  quantity: qtyToUse,
                  unitPrice: pricingForCart.unitPrice,
                  totalPrice: pricingForCart.totalPrice,
                  printMethod: methodToUse || 'Screen Printing',
                  printPlacement: payload.frontArtwork ? payload.frontPlacement : 'Rollup Banner (3 ft × 6 ft)',
                  artwork: payload.frontArtwork || undefined,
                  frontArtwork: payload.frontArtwork || null,
                  frontPlacement: payload.frontArtwork ? payload.frontPlacement : undefined,
                  customNotes: additionalTextNotes || 'Rollup Standee · 3 ft × 6 ft · Black ONLY · Carry Bag Included',
                  voiceNoteUrl: voiceNoteBlobUrl || undefined,
                  artworkStatus: nextStatus,
                }
              : isPromoTable
              ? {
                  id: `cart-${product.id}-${Date.now()}`,
                  product,
                  color: colorToUse,
                  quantity: qtyToUse,
                  unitPrice: pricingForCart.unitPrice,
                  totalPrice: pricingForCart.totalPrice,
                  printMethod: methodToUse || 'High-Precision UV',
                  printPlacement: payload.frontArtwork ? payload.frontPlacement : 'Header & Counter Display',
                  artwork: payload.frontArtwork || undefined,
                  frontArtwork: payload.frontArtwork || null,
                  frontPlacement: payload.frontArtwork ? payload.frontPlacement : undefined,
                  customNotes: additionalTextNotes || 'Portable Promo Table (White)',
                  voiceNoteUrl: voiceNoteBlobUrl || undefined,
                  artworkStatus: nextStatus,
                }
              : {
                  id: `cart-${product.id}-${Date.now()}`,
                  product,
                  color: colorToUse,
                  size: product.sizes
                    ? Object.keys(distToUse).find((k) => distToUse[k] > 0) || 'L'
                    : undefined,
                  sizeDistribution: distToUse,
                  quantity: qtyToUse,
                  unitPrice: pricingForCart.unitPrice,
                  totalPrice: pricingForCart.totalPrice,
                  printMethod: methodToUse,
                  printPlacement: activePlace,
                  artwork: activeArt,
                  frontArtwork: payload.frontArtwork || null,
                  backArtwork: payload.backArtwork || null,
                  frontPlacement: payload.frontArtwork ? payload.frontPlacement : undefined,
                  backPlacement: payload.backArtwork ? payload.backPlacement : undefined,
                  customNotes: additionalTextNotes || 'Custom corporate branding order',
                  voiceNoteUrl: voiceNoteBlobUrl || undefined,
                  artworkStatus: nextStatus,
                };

            try {
              const { frontMockupDataUrl, backMockupDataUrl } = await generateItemMockupSnapshots(directItem);
              if (frontMockupDataUrl) directItem.previewUrl = frontMockupDataUrl;
              if (backMockupDataUrl) directItem.backPreviewUrl = backMockupDataUrl;
            } catch (snapErr) {
              console.warn('[ProductStudio] Direct cart snapshot skipped:', snapErr);
            }

            onAddToCart(directItem);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: Fullscreen Lightbox Zoom View                                     */}
      {/* ========================================================================= */}
      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-4xl w-full bg-white rounded-2xl p-6 relative">
            <button
              onClick={() => setIsLightboxOpen(false)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700 hover:bg-zinc-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-4">
              <h3 className="font-display font-bold text-lg text-zinc-900">{product.name}</h3>
              <p className="text-xs text-zinc-500 font-mono">
                {isVisitingCard
                  ? `300 GSM Pure White Art Paper · 92 × 52 MM · ${viewOrientation === 'front' || activeThumbnailIndex === 0 ? 'FRONT SIDE' : 'BACK SIDE'}`
                  : isCanopy
                  ? `Navy Blue ONLY · ${selectedCanopySize} · Height: 7 ft (84 in)`
                  : isStandee
                  ? `Rollup Standee · Black ONLY · 3 ft × 6 ft (36 × 72 in) · ${viewOrientation === 'front' || activeThumbnailIndex === 0 ? 'Front View (Banner & Infographic)' : 'Back View (Rear Support Pole & Base)'}`
                  : isUmbrella
                  ? `${selectedColor.name} · Product Specifications & Views`
                  : isMug
                  ? `Promotional Ceramic Mug (White) · ${galleryViews[activeThumbnailIndex]?.label || 'High-Definition View'}`
                  : isPromoTable
                  ? (activeThumbnailIndex === 3 ? 'Dimensions Infographic' : activeThumbnailIndex === 2 ? 'Side Profile View' : activeThumbnailIndex === 1 ? 'Back Storage Shelves View' : 'Front View')
                  : `${selectedColor.name} · ${viewOrientation === 'front' ? 'Front High-Definition View' : 'Back View'}`}
              </p>
            </div>

            <div className="flex items-center justify-center py-4 relative">
              {isCanopy ? (
                activeThumbnailIndex === 1 || viewOrientation === 'dimensions' ? (
                  <img
                    src={selectedCanopySize === '8 × 8 ft' ? '/assets/aistudio/7_7_ft_Blue_Canopy_Booth_Infographic_3ac991cf.webp' : '/assets/aistudio/Blue_Canopy_Booth_Dimensions_Infographic_320b507e.webp'}
                    alt={`${product.name} ${selectedCanopySize} Zoom`}
                    className="max-h-[80vh] w-auto max-w-full object-contain drop-shadow-xl"
                  />
                ) : (
                  <ProductMockupCanvas
                    productType="canopy"
                    color={selectedColor}
                    artwork={frontArtwork}
                    printMethod="Screen Printing"
                    printPlacement={frontPlacement}
                    view="front"
                    selectedVariantLabel={selectedCanopySize}
                    className="w-full h-[450px]"
                  />
                )
              ) : isUmbrella ? (
                activeThumbnailIndex === 2 || viewOrientation === 'dimensions' ? (
                  <img
                    src={selectedColor.imageFront || '/assets/umbrella/red-dimensions.webp'}
                    alt={`${product.name} Zoom`}
                    className="max-h-[80vh] w-auto max-w-full object-contain drop-shadow-xl"
                  />
                ) : (
                  <ProductMockupCanvas
                    productType="umbrella"
                    color={selectedColor}
                    artwork={viewOrientation === 'back' || activeThumbnailIndex === 1 ? backArtwork : frontArtwork}
                    printMethod="Screen Printing"
                    printPlacement={viewOrientation === 'back' || activeThumbnailIndex === 1 ? backPlacement : frontPlacement}
                    view={viewOrientation === 'back' || activeThumbnailIndex === 1 ? 'back' : 'front'}
                    className="w-full h-[450px]"
                  />
                )
              ) : isMug ? (
                <div className="flex flex-col items-center justify-center max-w-2xl w-full">
                  {activeThumbnailIndex === 3 || viewOrientation === 'dimensions' ? (
                    <img
                      src="/assets/aistudio/White_Mug_Dimensions_and_Features_Infographic_47e1f529.webp"
                      alt="Promotional Ceramic Mug Specifications & Dimensions"
                      className="max-h-[75vh] w-auto max-w-full object-contain drop-shadow-xl rounded-xl"
                    />
                  ) : activeThumbnailIndex === 2 || viewOrientation === 'top' ? (
                    <div className="flex flex-col items-center justify-center">
                      <img
                        src="/assets/aistudio/Top-Down_White_Ceramic_Mug_46e962e8.webp"
                        alt="Top View - Ceramic Mug Interior & Rim"
                        className="max-h-[65vh] w-auto max-w-full object-contain drop-shadow-xl"
                      />
                      <span className="text-xs font-mono font-bold text-zinc-600 mt-3 bg-white px-4 py-1.5 rounded-full border border-zinc-200 shadow-2xs">
                        Top-Down View · Smooth Rounded Rim & Interior
                      </span>
                    </div>
                  ) : activeThumbnailIndex === 1 || viewOrientation === 'back' ? (
                    backArtwork ? (
                      <ProductMockupCanvas
                        productType="mug"
                        color={selectedColor}
                        artwork={backArtwork}
                        printMethod="High-Precision UV"
                        printPlacement={backPlacement}
                        view="back"
                        className="w-full h-[450px]"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <img
                          src="/assets/mug/mug_back_blank.webp"
                          alt="Back View - Plain White Ceramic Mug"
                          className="max-h-[65vh] w-auto max-w-full object-contain drop-shadow-xl"
                        />
                        <span className="text-xs font-mono font-bold text-zinc-600 mt-3 bg-white px-4 py-1.5 rounded-full border border-zinc-200 shadow-2xs">
                          Back View · Seamless Blank White Ceramic Surface
                        </span>
                      </div>
                    )
                  ) : (
                    <ProductMockupCanvas
                      productType="mug"
                      color={selectedColor}
                      artwork={frontArtwork}
                      printMethod="High-Precision UV"
                      printPlacement={frontPlacement}
                      view="front"
                      className="w-full h-[450px]"
                    />
                  )}
                </div>
              ) : isPromoTable ? (
                activeThumbnailIndex === 0 ? (
                  <ProductMockupCanvas
                    productType="display"
                    color={selectedColor}
                    artwork={frontArtwork}
                    printMethod="High-Precision UV"
                    printPlacement={frontPlacement}
                    view="front"
                    className="w-full h-[450px]"
                  />
                ) : (
                  <img
                    src={
                      activeThumbnailIndex === 3
                        ? '/assets/promo-table/dimensions.webp'
                        : activeThumbnailIndex === 2
                        ? '/assets/promo-table/side.webp'
                        : '/assets/promo-table/back.webp'
                    }
                    alt="Promo Table Zoom"
                    className="max-h-[500px] w-auto object-contain drop-shadow-xl"
                  />
                )
              ) : isStandee ? (
                activeThumbnailIndex === 0 ? (
                  <ProductMockupCanvas
                    productType="standee"
                    color={selectedColor}
                    artwork={frontArtwork}
                    printMethod="Screen Printing"
                    printPlacement={frontPlacement}
                    view="front"
                    className="w-full h-[450px]"
                  />
                ) : (
                  <img
                    src={
                      activeThumbnailIndex === 2 || viewOrientation === 'back'
                        ? '/assets/standee/back.webp'
                        : '/assets/standee/front.webp'
                    }
                    alt={
                      activeThumbnailIndex === 2 || viewOrientation === 'back'
                        ? 'Rollup Standee - Back View Zoom'
                        : 'Rollup Standee - Specs View Zoom'
                    }
                    className="max-h-[75vh] w-auto max-w-full object-contain drop-shadow-xl"
                  />
                )
              ) : isVisitingCard ? (
                <div className="w-full max-w-xl aspect-[92/52] bg-white rounded-lg border border-zinc-300 shadow-2xl p-4 flex items-center justify-center relative overflow-hidden">
                  {((viewOrientation === 'front' || activeThumbnailIndex === 0)
                    ? visitingCardDesign.frontDataUrl
                    : visitingCardDesign.backDataUrl) ? (
                    <img
                      src={
                        viewOrientation === 'front' || activeThumbnailIndex === 0
                          ? visitingCardDesign.frontDataUrl
                          : visitingCardDesign.backDataUrl
                      }
                      alt={`Visiting Card ${viewOrientation === 'front' || activeThumbnailIndex === 0 ? 'Front' : 'Back'} Zoom`}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <div className="text-center space-y-2">
                      <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">
                        {viewOrientation === 'front' || activeThumbnailIndex === 0 ? 'FRONT SIDE' : 'BACK SIDE'}
                      </span>
                      <div className="text-sm font-semibold text-zinc-700">300 GSM Pure White Art Paper</div>
                      <div className="text-xs text-zinc-400 font-mono">92 × 52 MM</div>
                    </div>
                  )}
                </div>
              ) : (
                <ProductMockupCanvas
                  productType={product.productType || 'polo'}
                  color={selectedColor}
                  artwork={viewOrientation === 'back' ? backArtwork : frontArtwork}
                  printMethod={selectedPrintMethod}
                  printPlacement={viewOrientation === 'back' ? backPlacement : frontPlacement}
                  view={viewOrientation === 'back' ? 'back' : 'front'}
                  className="w-full h-[450px]"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {isCanopy || isUmbrella || isMug || isPromoTable || isStandee ? (
                galleryViews.map((v, idx) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setActiveThumbnailIndex(idx);
                      if (v.orientation) setViewOrientation(v.orientation);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      activeThumbnailIndex === idx
                        ? 'bg-[#FF7A00] text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    {v.label}
                  </button>
                ))
              ) : isVisitingCard ? (
                <>
                  <button
                    onClick={() => {
                      setViewOrientation('front');
                      setActiveThumbnailIndex(0);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold font-display cursor-pointer transition-colors ${
                      viewOrientation === 'front' || activeThumbnailIndex === 0
                        ? 'bg-[#FF7A00] text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    FRONT SIDE
                  </button>
                  <button
                    onClick={() => {
                      setViewOrientation('back');
                      setActiveThumbnailIndex(1);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-bold font-display cursor-pointer transition-colors ${
                      viewOrientation === 'back' || activeThumbnailIndex === 1
                        ? 'bg-[#FF7A00] text-white shadow-xs'
                        : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
                    }`}
                  >
                    BACK SIDE
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setViewOrientation('front')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                      viewOrientation === 'front' ? 'bg-[#FF7A00] text-white' : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    Front View
                  </button>
                  <button
                    onClick={() => setViewOrientation('back')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                      viewOrientation === 'back' ? 'bg-[#FF7A00] text-white' : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    Back View
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Visiting Card Design Editor Modal */}
      {isVisitingCard && (
        <VisitingCardDesignEditor
          isOpen={isVisitingCardEditorOpen}
          onClose={() => setIsVisitingCardEditorOpen(false)}
          initialDesign={visitingCardDesign}
          quantity={quantity}
          onQuantityChange={setQuantity}
          initialApproved={artworkStatus === 'approved'}
          onConfirm={(updatedDesign, approved) => {
            setVisitingCardDesign(updatedDesign);
            if (approved) setArtworkStatus('approved');
            else if (updatedDesign.frontDataUrl || updatedDesign.backDataUrl) setArtworkStatus('uploaded');
            setIsVisitingCardEditorOpen(false);
          }}
          onDirectAddToCart={async ({ design, quantity: vcQty, artworkApproved: approved }) => {
            setVisitingCardDesign(design);
            setQuantity(vcQty);
            const nextStatus = approved
              ? 'approved'
              : design.frontDataUrl || design.backDataUrl
              ? 'uploaded'
              : 'no_artwork';
            setArtworkStatus(nextStatus === 'no_artwork' ? 'awaiting_review' : nextStatus);

            const pricingForVc = calculateProductPrice(product.id, vcQty);
            const vcItem: CartItem = {
              id: `cart-${product.id}-${Date.now()}`,
              product,
              color: { name: 'White', hex: '#FFFFFF', garmentHex: '#FFFFFF' },
              size: '92 × 52 MM',
              quantity: vcQty,
              unitPrice: pricingForVc.unitPrice,
              totalPrice: pricingForVc.totalPrice,
              printMethod: 'High-Precision UV',
              printPlacement: 'Both Side Printing (Front & Back)',
              frontArtwork: design.frontDataUrl
                ? {
                    type: 'image',
                    dataUrl: design.frontDataUrl,
                    x: design.frontSettings.x,
                    y: design.frontSettings.y,
                    scale: design.frontSettings.scale,
                    rotation: design.frontSettings.rotation,
                  }
                : null,
              backArtwork: design.backDataUrl
                ? {
                    type: 'image',
                    dataUrl: design.backDataUrl,
                    x: design.backSettings.x,
                    y: design.backSettings.y,
                    scale: design.backSettings.scale,
                    rotation: design.backSettings.rotation,
                  }
                : null,
              frontPlacement: 'Front Side (92 × 52 MM)',
              backPlacement: 'Back Side (92 × 52 MM)',
              customNotes:
                additionalTextNotes ||
                'Premium 300 GSM Visiting Card · Both Side Digital Print · White Paper Base ONLY',
              voiceNoteUrl: voiceNoteBlobUrl || undefined,
              artworkStatus: nextStatus,
              visitingCardDesign: { ...design },
            };

            try {
              const { frontMockupDataUrl, backMockupDataUrl } = await generateItemMockupSnapshots(vcItem);
              if (frontMockupDataUrl) vcItem.previewUrl = frontMockupDataUrl;
              if (backMockupDataUrl) vcItem.backPreviewUrl = backMockupDataUrl;
            } catch (snapErr) {
              console.warn('[VisitingCardStudio] Direct cart snapshot skipped:', snapErr);
            }

            onAddToCart(vcItem);
          }}
        />
      )}

    </div>
  );
};
