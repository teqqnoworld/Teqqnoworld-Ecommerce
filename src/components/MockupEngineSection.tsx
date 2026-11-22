import React, { useState, useRef } from 'react';
import { 
  Upload, Sparkles, Check, Lock, ChevronDown, CheckCircle2, 
  Rotate3d, Download, Share2, X, AlertCircle, 
  ZoomIn, ZoomOut, Maximize2, ShieldCheck, ArrowRight,
  RotateCcw, RotateCw, Move, Plus, Minus, RefreshCw, Trash2, 
  Sliders, Eye, Layers
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { ProductColor, CustomArtwork, PrintMethod } from '../types';
import { ProductMockupCanvas } from './ProductMockupCanvas';
import { getPlainPoloProductColors } from '../data/plainPoloImages';
import { COTTON_FLEXI_CAP_VARIANTS } from '../data/capImages';
import { RequestQuoteModal } from './RequestQuoteModal';
import { compressImageFile } from '../utils/imageCompressor';


interface MockupEngineSectionProps {
  onExploreProduct?: (productId: string) => void;
  onAddToCart?: (item: any) => void;
}

// Exactly 5 merchandise options as requested by user
export type MerchType = 'polo' | 'hoodie' | 'mug' | 'cap' | 'visiting-card';

export interface MerchColorOption {
  name: string;
  hex: string;
  garmentHex: string;
  imageFront?: string;
  imageBack?: string;
}

interface MerchItemConfig {
  id: MerchType;
  name: string;
  shortName: string;
  category: string;
  priceDisplay: string;
  unitPrice: number;
  moqDisplay: string;
  catalogId: string;
  defaultPlacement: string;
  placements: string[];
  printMethod: PrintMethod;
  description: string;
  colors: MerchColorOption[];
  hasFrontBack: boolean;
  frontLabel: string;
  backLabel: string;
}

// 1. Polo T-Shirt 16 colours from Plain Polo (using transparent PNG images)
const POLO_COLORS: MerchColorOption[] = getPlainPoloProductColors().map(c => ({
  name: c.name,
  hex: c.hex,
  garmentHex: c.garmentHex || c.hex,
  imageFront: c.imageFront,
  imageBack: c.imageBack,
}));

// 2. Hoodie 6 core fleece colours
const HOODIE_COLORS: MerchColorOption[] = [
  { name: 'Onyx Black', hex: '#18191E', garmentHex: '#18191E' },
  { name: 'Navy Blue', hex: '#16233B', garmentHex: '#16233B' },
  { name: 'Charcoal Melange', hex: '#43484F', garmentHex: '#43484F' },
  { name: 'Maroon', hex: '#6B1D2F', garmentHex: '#6B1D2F' },
  { name: 'Pure White', hex: '#F0F1F5', garmentHex: '#F0F1F5' },
  { name: 'Vibrant Red', hex: '#C61B2B', garmentHex: '#C61B2B' },
];

// 3. Promotional Ceramic Mug (White ONLY)
const MUG_COLORS: MerchColorOption[] = [
  { 
    name: 'Pure White Ceramic', 
    hex: '#FFFFFF', 
    garmentHex: '#FFFFFF',
    imageFront: '/assets/aistudio/Blank_White_Ceramic_Mug_b82bfadb.webp',
    imageBack: '/assets/mug/mug_back_blank.webp',
  },
];

// 4. Cotton Flexi Caps 6 colours from capImages
const CAP_COLORS: MerchColorOption[] = COTTON_FLEXI_CAP_VARIANTS.map(v => ({
  name: v.name,
  hex: v.hex,
  garmentHex: v.garmentHex,
  imageFront: v.front,
  imageBack: v.back,
}));

// 5. Premium Visiting Card (300 GSM Pure White Art Paper ONLY)
const VISITING_CARD_COLORS: MerchColorOption[] = [
  { 
    name: 'Pure White 300 GSM Art Paper', 
    hex: '#FFFFFF', 
    garmentHex: '#FFFFFF',
  },
];

// Master Merchandise Configurations for all 5 products
export const MERCH_CONFIGS: Record<MerchType, MerchItemConfig> = {
  polo: {
    id: 'polo',
    name: 'Polo T-Shirt',
    shortName: 'Polo T-Shirt',
    category: 'Apparel',
    priceDisplay: 'From ₹450 / pc',
    unitPrice: 700,
    moqDisplay: 'Min: 2 pcs',
    catalogId: 'prod-plain-polo',
    defaultPlacement: 'Left Chest',
    placements: ['Left Chest', 'Center Chest', 'Full Front', 'Upper Back Center'],
    printMethod: 'DTF Printing',
    description: '100% Pure Combed Cotton 230 GSM solid pique polo with solid ribbed collar & cuffs.',
    colors: POLO_COLORS,
    hasFrontBack: true,
    frontLabel: 'FRONT VIEW',
    backLabel: 'BACK VIEW',
  },
  hoodie: {
    id: 'hoodie',
    name: 'Hoodie',
    shortName: 'Hoodie',
    category: 'Apparel',
    priceDisplay: '₹999 / pc',
    unitPrice: 999,
    moqDisplay: 'Min: 2 pcs',
    catalogId: 'prod-polo-01',
    defaultPlacement: 'Center Chest',
    placements: ['Center Chest', 'Left Chest', 'Full Front', 'Upper Back'],
    printMethod: 'DTF Printing',
    description: 'Heavy fleece 340 GSM pullover with double-stitched kangaroo pocket and warm lined hood.',
    colors: HOODIE_COLORS,
    hasFrontBack: true,
    frontLabel: 'FRONT VIEW',
    backLabel: 'BACK VIEW',
  },
  mug: {
    id: 'mug',
    name: 'Promotional Ceramic Mug',
    shortName: 'Ceramic Mug',
    category: 'Drinkware',
    priceDisplay: 'From ₹149 / pc',
    unitPrice: 249,
    moqDisplay: 'Min: 5 pcs',
    catalogId: 'prod-ceramic-mug',
    defaultPlacement: 'Front Print Area',
    placements: ['Front Print Area', 'Wrap-Around Print'],
    printMethod: 'High-Precision UV',
    description: 'Glossy ~325 ml (11 oz) microwave and dishwasher safe pure white ceramic mug.',
    colors: MUG_COLORS,
    hasFrontBack: true,
    frontLabel: 'FRONT SIDE',
    backLabel: 'BACK SIDE',
  },
  cap: {
    id: 'cap',
    name: 'Cotton Flexi Caps',
    shortName: 'Custom Caps',
    category: 'Apparel',
    priceDisplay: 'From ₹135 / pc',
    unitPrice: 250,
    moqDisplay: 'Min: 1 pc',
    catalogId: 'prod-cotton-flexi-caps',
    defaultPlacement: 'Front Crown',
    placements: ['Front Crown', 'Left Panel', 'Right Panel'],
    printMethod: 'Precision Embroidery',
    description: 'Premium Cotton Flexi Caps with pre-curved visor, sweatband and brass buckle strap.',
    colors: CAP_COLORS,
    hasFrontBack: true,
    frontLabel: 'FRONT VIEW',
    backLabel: 'REAR VIEW',
  },
  'visiting-card': {
    id: 'visiting-card',
    name: 'Premium Visiting Card',
    shortName: 'Visiting Card',
    category: 'Stationery',
    priceDisplay: 'From ₹1.00 / card',
    unitPrice: 3.00,
    moqDisplay: 'Min: 100 pcs',
    catalogId: 'prod-visiting-card-300gsm',
    defaultPlacement: 'Front Side',
    placements: ['Front Side', 'Back Side', 'Both Sides'],
    printMethod: 'High-Precision UV',
    description: '300 GSM Heavyweight Smooth Art Paper with clean laser die-cut edges (92 × 52 MM).',
    colors: VISITING_CARD_COLORS,
    hasFrontBack: true,
    frontLabel: 'FRONT SIDE',
    backLabel: 'BACK SIDE',
  },
};

// Logo transform state per merchandise
interface LogoTransform {
  scale: number;       // 0.4 to 2.2 (default 1.0)
  rotation: number;    // -180 to 180 (default 0)
  x: number;           // -35 to 35 percent within print zone
  y: number;           // -35 to 35 percent within print zone
}

const DEFAULT_TRANSFORM: LogoTransform = {
  scale: 1.0,
  rotation: 0,
  x: 0,
  y: 0,
};

export const MockupEngineSection: React.FC<MockupEngineSectionProps> = ({
  onExploreProduct,
}) => {
  // Merchandise selection (Defaults to polo)
  const [activeMerch, setActiveMerch] = useState<MerchType>('polo');

  // Selected color per merchandise
  const [colorPerMerch, setColorPerMerch] = useState<Record<MerchType, MerchColorOption>>({
    polo: POLO_COLORS[0], // Navy Blue default
    hoodie: HOODIE_COLORS[0], // Onyx Black
    mug: MUG_COLORS[0], // White
    cap: CAP_COLORS[0], // Black
    'visiting-card': VISITING_CARD_COLORS[0], // White Art Paper
  });

  // Print placement
  const [printPlacement, setPrintPlacement] = useState<string>('Left Chest');

  // Front vs Back view
  const [viewAngle, setViewAngle] = useState<'front' | 'back'>('front');

  // 3D Perspective Orbit & Tilt State
  const [orbitRotateY, setOrbitRotateY] = useState<number>(0);
  const [orbitRotateX, setOrbitRotateX] = useState<number>(0);
  const [previewZoom, setPreviewZoom] = useState<number>(1.0);
  const [isOrbitDragging, setIsOrbitDragging] = useState<boolean>(false);
  const orbitDragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Artwork state
  const [uploadedLogo, setUploadedLogo] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [logoFileSize, setLogoFileSize] = useState<string>('');
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Logo Transformation State per Merchandise (Independent controls)
  const [transforms, setTransforms] = useState<Record<MerchType, LogoTransform>>({
    polo: { ...DEFAULT_TRANSFORM },
    hoodie: { ...DEFAULT_TRANSFORM },
    mug: { ...DEFAULT_TRANSFORM },
    cap: { ...DEFAULT_TRANSFORM },
    'visiting-card': { ...DEFAULT_TRANSFORM },
  });

  // Active toolbar tab in editor ('transform' | 'nudge')
  const [activeEditorTab, setActiveEditorTab] = useState<'transform' | 'nudge'>('transform');

  // 3D Proof Modal State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isProofModalOpen, setIsProofModalOpen] = useState<boolean>(false);
  const [proofZoom, setProofZoom] = useState<number>(1);
  const [proofCopied, setProofCopied] = useState<boolean>(false);
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);


  const activeConfig = MERCH_CONFIGS[activeMerch];
  const activeColor = colorPerMerch[activeMerch] || activeConfig.colors[0];
  const activeTransform = transforms[activeMerch] || DEFAULT_TRANSFORM;

  // Update transform for current merchandise
  const updateActiveTransform = (partial: Partial<LogoTransform>) => {
    setTransforms(prev => ({
      ...prev,
      [activeMerch]: {
        ...prev[activeMerch],
        ...partial,
      },
    }));
  };

  // Reset transform for active merchandise
  const handleResetTransform = () => {
    updateActiveTransform({
      scale: 1.0,
      rotation: 0,
      x: 0,
      y: 0,
    });
  };

  // Switch Merchandise handler
  const handleSelectMerchandise = (type: MerchType) => {
    setActiveMerch(type);
    const cfg = MERCH_CONFIGS[type];
    setPrintPlacement(cfg.defaultPlacement);
    setViewAngle('front');
    // Reset orbit perspective when changing product
    setOrbitRotateX(0);
    setOrbitRotateY(0);
    setPreviewZoom(1.0);
  };

  // Process uploaded file
  const handleFileProcess = async (file: File) => {
    setUploadError(null);

    // Validate size (max 25MB)
    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File exceeds 25 MB limit. Please upload a smaller logo.');
      return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'application/pdf', 'image/webp'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(png|jpe?g|svg|pdf|webp)$/i)) {
      setUploadError('Unsupported format. Please upload PNG, JPG, SVG, WebP or PDF.');
      return;
    }

    setLogoFileName(file.name);

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const sizeInKb = (file.size / 1024).toFixed(1);
      setLogoFileSize(`${sizeInKb} KB`);
      const svgData = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" viewBox="0 0 200 80"><rect width="200" height="80" rx="8" fill="%23FF7A00" /><text x="50%" y="45%" text-anchor="middle" fill="white" font-family="sans-serif" font-size="14" font-weight="bold">${encodeURIComponent(file.name.slice(0, 16))}</text><text x="50%" y="70%" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-family="sans-serif" font-size="10">VECTOR PDF LOGO</text></svg>`;
      setUploadedLogo(svgData);
    } else {
      try {
        const { dataUrl, compressedSize } = await compressImageFile(file, {
          maxWidth: 1200,
          maxHeight: 1200,
          quality: 0.8,
          format: 'image/webp',
        });
        setLogoFileSize(`${(compressedSize / 1024).toFixed(1)} KB (Optimized)`);
        setUploadedLogo(dataUrl);
      } catch (err) {
        console.warn('[MockupEngineSection] Compression fallback to FileReader:', err);
        const sizeInKb = (file.size / 1024).toFixed(1);
        setLogoFileSize(`${sizeInKb} KB`);
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setUploadedLogo(e.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleRemoveLogo = () => {
    setUploadedLogo(null);
    setLogoFileName('');
    setLogoFileSize('');
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    handleResetTransform();
  };

  // Build current artwork object for canvas with live transforms
  const currentArtwork: CustomArtwork = {
    type: uploadedLogo ? 'image' : 'preset',
    dataUrl: uploadedLogo || undefined,
    presetId: 'your-logo',
    text: 'YOUR LOGO HERE',
    x: activeTransform.x,
    y: activeTransform.y,
    scale: activeTransform.scale,
    rotation: activeTransform.rotation,
  };

  const currentColor: ProductColor = {
    name: activeColor.name,
    hex: activeColor.hex,
    garmentHex: activeColor.garmentHex || activeColor.hex,
    imageFront: activeColor.imageFront,
    imageBack: activeColor.imageBack,
  };

  // Dragging directly on canvas updates position
  const handleArtworkPositionChange = (x: number, y: number) => {
    updateActiveTransform({
      x: Math.round(Math.max(-35, Math.min(35, x))),
      y: Math.round(Math.max(-35, Math.min(35, y))),
    });
  };

  // 3D Orbit Drag Handlers on Preview Container
  const handleOrbitMouseDown = (e: React.MouseEvent) => {
    setIsOrbitDragging(true);
    orbitDragStart.current = { x: e.clientX, y: e.clientY };
  };

  const handleOrbitMouseMove = (e: React.MouseEvent) => {
    if (!isOrbitDragging) return;
    const deltaX = (e.clientX - orbitDragStart.current.x) * 0.35;
    const deltaY = (e.clientY - orbitDragStart.current.y) * 0.25;
    orbitDragStart.current = { x: e.clientX, y: e.clientY };
    setOrbitRotateY(prev => Math.max(-35, Math.min(35, prev + deltaX)));
    setOrbitRotateX(prev => Math.max(-15, Math.min(15, prev - deltaY)));
  };

  const handleOrbitMouseUp = () => {
    setIsOrbitDragging(false);
  };

  // 3D Orbit Touch Handlers for Mobile
  const handleOrbitTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsOrbitDragging(true);
    orbitDragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleOrbitTouchMove = (e: React.TouchEvent) => {
    if (!isOrbitDragging || e.touches.length !== 1) return;
    const deltaX = (e.touches[0].clientX - orbitDragStart.current.x) * 0.35;
    const deltaY = (e.touches[0].clientY - orbitDragStart.current.y) * 0.25;
    orbitDragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setOrbitRotateY(prev => Math.max(-35, Math.min(35, prev + deltaX)));
    setOrbitRotateX(prev => Math.max(-15, Math.min(15, prev - deltaY)));
  };

  const handleOrbitTouchEnd = () => {
    setIsOrbitDragging(false);
  };

  // Reset 3D Orbit Viewing Angle
  const handleResetOrbit = () => {
    setOrbitRotateX(0);
    setOrbitRotateY(0);
    setPreviewZoom(1.0);
  };

  // Quick Rotate Angles (-20°, 0°, +20°)
  const handleStepRotate = (direction: 'left' | 'right') => {
    setOrbitRotateY(prev => {
      const delta = direction === 'left' ? -15 : 15;
      return Math.max(-35, Math.min(35, prev + delta));
    });
  };

  // Handle Generate 3D Preview
  const handleGeneratePreview = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setIsProofModalOpen(true);
      setProofZoom(1);
    }, 1000);
  };

  // WhatsApp share
  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Hello TeqqnoWorld! I just created a custom mockup of the ${activeConfig.name} in ${activeColor.name} (${printPlacement}) on your website. I would like to get a bulk quote and production proof.`
    );
    window.open(`https://api.whatsapp.com/send?phone=918309394934&text=${text}`, '_blank');
  };

  // Download proof simulation
  const handleDownloadProof = () => {
    setProofCopied(true);
    setTimeout(() => setProofCopied(false), 2500);

    if (uploadedLogo) {
      const a = document.createElement('a');
      a.href = uploadedLogo;
      a.download = `TeqqnoWorld_${activeConfig.name.replace(/\s+/g, '_')}_MockupProof.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <section id="customizer-section" className="py-20 bg-[#16171B] text-white border-b border-[#2A2A30] relative overflow-hidden">
      {/* Subtle radial ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#FF7A00]/8 rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#202127] border border-[#2F3038] text-xs font-mono text-[#FF7A00]">
            <Lock className="w-3.5 h-3.5 text-[#FF7A00]" />
            <span>Zero Obligation Mockup Engine</span>
          </div>

          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight">
            See Your Logo On Our Products in <span className="text-[#FF7A00]">10 Seconds</span>
          </h2>

          <p className="text-zinc-400 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
            Upload your company insignia, choose a product color, and instantly review high-definition mockups before spending a single rupee.
          </p>
        </div>

        {/* Large White Customization Container */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-10 text-[#0B0B0D] shadow-2xl border border-white/20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">
            
            {/* Left Column: Upload & Customization (5 cols on desktop, stacked on mobile/tablet) */}
            <div className="lg:col-span-5 space-y-5 order-2 lg:order-1">
              
              {/* Step 1: Upload Your Logo / Artwork */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold font-display text-zinc-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF7A00] text-white flex items-center justify-center text-[11px] font-bold">1</span>
                    <span>Upload Your Logo / Artwork</span>
                  </label>
                  <span className="text-[11px] font-mono text-zinc-400">PNG, SVG, JPG, PDF</span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept=".png,.jpg,.jpeg,.svg,.pdf"
                  className="hidden"
                />

                {uploadError && (
                  <div className="mb-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {!uploadedLogo ? (
                  /* Drag and drop upload box */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group text-center ${
                      isDraggingOver
                        ? 'border-[#FF7A00] bg-[#FF7A00]/10 scale-[1.01]'
                        : 'border-zinc-200 hover:border-[#FF7A00] bg-zinc-50/70 hover:bg-[#FF7A00]/5'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-50 text-[#FF7A00] flex items-center justify-center mb-2 group-hover:scale-110 group-hover:bg-orange-100 transition-all duration-300 shadow-2xs">
                      <Upload className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                    <div className="text-xs font-bold text-zinc-800">
                      Click or drag company logo here
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">
                      Transparent PNG, SVG or JPG works best (Max 15MB)
                    </div>
                  </div>
                ) : (
                  /* Uploaded Logo Preview Bar */
                  <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-11 h-11 rounded-lg bg-white border border-zinc-200 flex items-center justify-center p-1 overflow-hidden shrink-0">
                        <img
                          src={uploadedLogo}
                          alt="Uploaded Logo"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-zinc-900 truncate">
                            {logoFileName || 'Company Logo'}
                          </p>
                          <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full whitespace-nowrap">
                            ✓ Ready
                          </span>
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {logoFileSize || 'Transparent Artwork'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-semibold text-[#FF7A00] hover:text-[#e06c00] px-2 py-1 rounded-lg hover:bg-orange-50 transition-colors"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="text-zinc-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        title="Remove Logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------- */}
              {/* REQUIREMENT 4: Logo Editing Toolbar (Resize, Rotate, Move, Reset) */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-zinc-50/90 border border-zinc-200 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900 font-display">
                    <Sliders className="w-3.5 h-3.5 text-[#FF7A00]" />
                    <span>Logo Editing Controls</span>
                    {!uploadedLogo && (
                      <span className="text-[10px] font-normal text-zinc-500 font-sans">(Sample Logo)</span>
                    )}
                  </div>
                  
                  <button
                    type="button"
                    onClick={handleResetTransform}
                    className="text-[11px] font-semibold text-zinc-500 hover:text-[#FF7A00] flex items-center gap-1 transition-colors cursor-pointer"
                    title="Reset to center and standard size"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>

                {/* Sub-tabs: Scale & Rotation vs Directional Nudge */}
                <div className="flex items-center bg-zinc-200/70 p-0.5 rounded-lg text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveEditorTab('transform')}
                    className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                      activeEditorTab === 'transform'
                        ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Resize & Rotate
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEditorTab('nudge')}
                    className={`flex-1 py-1 rounded-md transition-all cursor-pointer ${
                      activeEditorTab === 'nudge'
                        ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                        : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Position & Nudge
                  </button>
                </div>

                {activeEditorTab === 'transform' ? (
                  <div className="space-y-3 pt-1">
                    {/* Control 1: Resize / Scale */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-600 font-medium">Logo Size:</span>
                        <span className="font-mono font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200 shadow-2xs">
                          {Math.round(activeTransform.scale * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateActiveTransform({ scale: Math.max(0.4, Number((activeTransform.scale - 0.1).toFixed(2))) })}
                          className="w-7 h-7 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-700 shadow-2xs cursor-pointer shrink-0"
                          title="Decrease Size"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="range"
                          min="0.4"
                          max="2.2"
                          step="0.05"
                          value={activeTransform.scale}
                          onChange={(e) => updateActiveTransform({ scale: parseFloat(e.target.value) })}
                          className="w-full accent-[#FF7A00] cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => updateActiveTransform({ scale: Math.min(2.2, Number((activeTransform.scale + 0.1).toFixed(2))) })}
                          className="w-7 h-7 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-700 shadow-2xs cursor-pointer shrink-0"
                          title="Increase Size"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Control 2: Rotation */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-600 font-medium">Rotation Angle:</span>
                        <span className="font-mono font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-200 shadow-2xs">
                          {activeTransform.rotation}°
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateActiveTransform({ rotation: (activeTransform.rotation - 15 + 360) % 360 })}
                          className="w-7 h-7 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-700 shadow-2xs cursor-pointer shrink-0"
                          title="Rotate Left 15°"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="1"
                          value={activeTransform.rotation < 0 ? activeTransform.rotation + 360 : activeTransform.rotation}
                          onChange={(e) => updateActiveTransform({ rotation: parseInt(e.target.value) })}
                          className="w-full accent-[#FF7A00] cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => updateActiveTransform({ rotation: (activeTransform.rotation + 15) % 360 })}
                          className="w-7 h-7 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 flex items-center justify-center text-zinc-700 shadow-2xs cursor-pointer shrink-0"
                          title="Rotate Right 15°"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Control 3: Move & Nudge within printable zone */
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-600 font-medium">Fine-tune Position:</span>
                      <span className="font-mono text-zinc-500 text-[10px]">
                        X: {activeTransform.x}%, Y: {activeTransform.y}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-zinc-200">
                      {/* 4-way D-pad */}
                      <div className="grid grid-cols-3 gap-1 w-24">
                        <div />
                        <button
                          type="button"
                          onClick={() => updateActiveTransform({ y: Math.max(-35, activeTransform.y - 4) })}
                          className="w-7 h-7 rounded bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 text-xs font-bold cursor-pointer"
                          title="Nudge Up"
                        >
                          ▲
                        </button>
                        <div />
                        <button
                          type="button"
                          onClick={() => updateActiveTransform({ x: Math.max(-35, activeTransform.x - 4) })}
                          className="w-7 h-7 rounded bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 text-xs font-bold cursor-pointer"
                          title="Nudge Left"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          onClick={() => updateActiveTransform({ x: 0, y: 0 })}
                          className="w-7 h-7 rounded bg-[#FF7A00]/10 hover:bg-[#FF7A00]/20 text-[#FF7A00] flex items-center justify-center text-[10px] font-bold cursor-pointer"
                          title="Center Logo"
                        >
                          ●
                        </button>
                        <button
                          type="button"
                          onClick={() => updateActiveTransform({ x: Math.min(35, activeTransform.x + 4) })}
                          className="w-7 h-7 rounded bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 text-xs font-bold cursor-pointer"
                          title="Nudge Right"
                        >
                          ▶
                        </button>
                        <div />
                        <button
                          type="button"
                          onClick={() => updateActiveTransform({ y: Math.min(35, activeTransform.y + 4) })}
                          className="w-7 h-7 rounded bg-zinc-100 hover:bg-zinc-200 flex items-center justify-center text-zinc-700 text-xs font-bold cursor-pointer"
                          title="Nudge Down"
                        >
                          ▼
                        </button>
                        <div />
                      </div>

                      <div className="text-[11px] text-zinc-500 leading-tight space-y-1">
                        <div className="font-semibold text-zinc-700 flex items-center gap-1">
                          <Move className="w-3 h-3 text-[#FF7A00]" />
                          <span>Direct Canvas Drag</span>
                        </div>
                        <p className="text-[10px]">You can also directly drag your logo on the preview canvas.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Choose Merchandise (EXACTLY 5 OPTIONS) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold font-display text-zinc-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF7A00] text-white flex items-center justify-center text-[11px] font-bold">2</span>
                    <span>Choose Merchandise</span>
                  </label>
                  <span className="text-[11px] font-bold text-[#FF7A00]">
                    {activeConfig.name}
                  </span>
                </div>

                {/* Exactly 5 Merchandise Selector Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['polo', 'hoodie', 'mug', 'cap', 'visiting-card'] as MerchType[]).map((type) => {
                    const cfg = MERCH_CONFIGS[type];
                    const isSelected = activeMerch === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleSelectMerchandise(type)}
                        className={`p-2.5 rounded-xl text-xs font-bold transition-all text-left flex items-center justify-between cursor-pointer border ${
                          isSelected
                            ? 'bg-[#0B0B0D] text-white border-[#0B0B0D] shadow-md ring-2 ring-[#0B0B0D]/20'
                            : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                        }`}
                      >
                        <div className="min-w-0 pr-1">
                          <div className="truncate font-display">{cfg.name}</div>
                          <div className={`text-[10px] font-mono mt-0.5 font-normal ${isSelected ? 'text-[#FF7A00]' : 'text-zinc-500'}`}>
                            {cfg.priceDisplay.split(' ')[0]}
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#FF7A00] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: Base Color Swatches & Placement */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#FF7A00] text-white flex items-center justify-center text-[11px] font-bold">3</span>
                    <span>Base Color:</span>
                    <span className="font-semibold text-zinc-700 font-sans">{activeColor.name}</span>
                  </label>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {activeConfig.colors.length} {activeConfig.colors.length === 1 ? 'Colour' : 'Colours'}
                  </span>
                </div>

                {/* Swatches Grid */}
                <div className="flex flex-wrap items-center gap-2 max-h-24 overflow-y-auto p-1 border border-zinc-100 rounded-xl bg-zinc-50/50">
                  {activeConfig.colors.map((color) => {
                    const isSelected = activeColor.name === color.name;
                    return (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => {
                          setColorPerMerch(prev => ({ ...prev, [activeMerch]: color }));
                        }}
                        title={color.name}
                        className={`w-7 h-7 rounded-full transition-all relative cursor-pointer border ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-[#FF7A00] scale-110 shadow-sm border-zinc-400'
                            : 'border-zinc-300 hover:scale-108'
                        }`}
                        style={{ backgroundColor: color.hex }}
                      >
                        {isSelected && (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <Check className={`w-3.5 h-3.5 ${color.hex === '#FFFFFF' || color.hex === '#F0F1F5' || color.hex === '#F6F7FA' ? 'text-zinc-900' : 'text-white'}`} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Print Placement Dropdown */}
              <div>
                <label className="block text-xs font-bold text-zinc-900 mb-1.5">
                  Print Placement
                </label>
                <div className="relative">
                  <select
                    value={printPlacement}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPrintPlacement(val);
                      if (val.includes('Back')) {
                        setViewAngle('back');
                      } else {
                        setViewAngle('front');
                      }
                    }}
                    className="w-full bg-zinc-50 border border-zinc-300 hover:border-[#FF7A00] rounded-xl px-3.5 py-2.5 text-xs font-semibold text-zinc-900 appearance-none focus:outline-none focus:ring-2 focus:ring-[#FF7A00]/20 focus:border-[#FF7A00] transition-colors cursor-pointer"
                  >
                    {activeConfig.placements.map((plc) => (
                      <option key={plc} value={plc}>
                        {plc}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* ✨ Generate My Free 3D Preview Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={isGenerating}
                  className="w-full bg-[#FF7A00] hover:bg-[#e06c00] active:scale-[0.99] text-white font-display font-bold text-sm sm:text-base py-3.5 sm:py-4 px-6 rounded-xl shadow-lg shadow-[#FF7A00]/25 hover:shadow-[#FF7A00]/40 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-80"
                >
                  {isGenerating ? (
                    <>
                      <Rotate3d className="w-5 h-5 animate-spin text-white" />
                      <span>Rendering 3D Visual Proof...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 fill-white/20 animate-pulse text-white" />
                      <span>Generate My Free 3D Preview</span>
                    </>
                  )}
                </button>

                {/* Value Props Strip */}
                <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-100 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>100% Free Preview</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-600">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>No Upfront Cost</span>
                  </div>
                  <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-600">
                    <Share2 className="w-3.5 h-3.5 text-[#FF7A00] shrink-0" />
                    <span>WhatsApp Ready</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Live Product Preview & 3D Interactive Controls (first on mobile/tablet so users see live preview immediately) */}
            <div className="lg:col-span-7 space-y-4 order-1 lg:order-2">
              
              {/* Preview Bar Top Controls (Views, Rotation, Reset) */}
              <div className="flex flex-wrap items-center justify-between bg-zinc-50 border border-zinc-200/90 rounded-xl px-3.5 py-2.5 gap-2">
                <div className="text-xs font-semibold text-zinc-700 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    Viewing: <strong className="text-zinc-900">{viewAngle.toUpperCase()}</strong> ({printPlacement})
                  </span>
                </div>

                {/* Interactive Multi-Angle & View Controls */}
                <div className="flex items-center gap-1.5">
                  {/* Front / Back Toggle Buttons */}
                  <div className="flex items-center bg-zinc-200/80 p-0.5 rounded-lg text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setViewAngle('front')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        viewAngle === 'front'
                          ? 'bg-[#FF7A00] text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {activeConfig.frontLabel}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewAngle('back')}
                      className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                        viewAngle === 'back'
                          ? 'bg-[#FF7A00] text-white shadow-xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {activeConfig.backLabel}
                    </button>
                  </div>

                  {/* 3D Perspective Rotate Buttons */}
                  <div className="hidden sm:flex items-center gap-1 bg-white border border-zinc-200 p-0.5 rounded-lg shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleStepRotate('left')}
                      className="p-1 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded cursor-pointer"
                      title="Rotate Left"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleResetOrbit}
                      className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-zinc-600 hover:text-[#FF7A00] cursor-pointer"
                      title="Reset View Angle"
                    >
                      {Math.round(orbitRotateY)}°
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStepRotate('right')}
                      className="p-1 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded cursor-pointer"
                      title="Rotate Right"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Fullscreen Proof Preview */}
                  <button
                    type="button"
                    onClick={handleGeneratePreview}
                    className="p-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:text-[#FF7A00] shadow-2xs hover:bg-zinc-50 transition-colors cursor-pointer"
                    title="Open Fullscreen Proof"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Large Product Mockup Canvas Frame with 3D Orbit Perspective */}
              <div 
                className="bg-[#F8F8FC] rounded-2xl border border-zinc-200/90 p-3 sm:p-6 flex items-center justify-center relative min-h-[300px] sm:min-h-[380px] lg:min-h-[460px] shadow-inner overflow-hidden select-none touch-pan-y"
                style={{ perspective: '1200px' }}
                onMouseDown={handleOrbitMouseDown}
                onMouseMove={handleOrbitMouseMove}
                onMouseUp={handleOrbitMouseUp}
                onMouseLeave={handleOrbitMouseUp}
                onTouchStart={handleOrbitTouchStart}
                onTouchMove={handleOrbitTouchMove}
                onTouchEnd={handleOrbitTouchEnd}
                onTouchCancel={handleOrbitTouchEnd}
              >
                {/* Product Badge Pill */}
                <div className="absolute top-2.5 sm:top-3.5 left-2.5 sm:left-3.5 z-20 flex items-center gap-1.5 sm:gap-2 pointer-events-none max-w-[calc(100%-84px)] sm:max-w-none">
                  <span className="text-[9px] sm:text-[10px] font-bold font-mono uppercase bg-white/95 backdrop-blur-xs text-zinc-800 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border border-zinc-200 shadow-2xs truncate">
                    {activeConfig.name} • {activeColor.name}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-white bg-[#FF7A00] px-1.5 sm:px-2 py-0.5 rounded-full shadow-2xs shrink-0">
                    {activeConfig.priceDisplay}
                  </span>
                </div>

                {/* 3D Orbit Drag Hint Badge */}
                <div className="absolute top-2.5 sm:top-3.5 right-2.5 sm:right-3.5 z-20 flex items-center gap-1 sm:gap-1.5 bg-black/60 backdrop-blur-xs text-white text-[9px] sm:text-[10px] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full pointer-events-none shrink-0">
                  <Rotate3d className="w-3 h-3 text-[#FF7A00]" />
                  <span className="hidden sm:inline">Drag to rotate 3D view</span>
                  <span className="sm:hidden">3D Orbit</span>
                </div>

                {/* Watermark / Preset notice if no user logo */}
                {!uploadedLogo && (
                  <div className="absolute bottom-2.5 sm:bottom-3.5 left-2.5 sm:left-3.5 z-20 text-[9px] sm:text-[10px] bg-black/60 backdrop-blur-xs text-white px-2 sm:px-2.5 py-1 rounded-md pointer-events-none max-w-[44%] sm:max-w-none truncate">
                    <span className="sm:hidden">Sample Logo</span>
                    <span className="hidden sm:inline">Sample Logo Shown • Upload your logo below</span>
                  </div>
                )}

                {/* Bottom Zoom & Reset Controls */}
                <div className="absolute bottom-2.5 sm:bottom-3.5 right-2.5 sm:right-3.5 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-xs p-1 rounded-lg border border-zinc-200 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.max(0.8, z - 0.1))}
                    className="p-1 text-zinc-600 hover:text-zinc-900 rounded cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono font-bold text-zinc-700 px-1">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.min(1.5, z + 0.1))}
                    className="p-1 text-zinc-600 hover:text-zinc-900 rounded cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-[1px] h-3 bg-zinc-200 mx-0.5" />
                  <button
                    type="button"
                    onClick={handleResetOrbit}
                    className="text-[10px] font-semibold text-zinc-600 hover:text-[#FF7A00] px-1 cursor-pointer"
                    title="Reset Angle & Zoom"
                  >
                    Reset
                  </button>
                </div>

                {/* 3D Rotatable Wrapper Container */}
                <div
                  className="w-full h-full flex items-center justify-center transition-transform duration-150 ease-out"
                  style={{
                    transform: `rotateY(${orbitRotateY}deg) rotateX(${orbitRotateX}deg) scale(${previewZoom})`,
                    transformStyle: 'preserve-3d',
                    cursor: isOrbitDragging ? 'grabbing' : 'grab',
                  }}
                >
                  <ProductMockupCanvas
                    productType={activeMerch}
                    color={currentColor}
                    artwork={currentArtwork}
                    printMethod={activeConfig.printMethod}
                    printPlacement={printPlacement}
                    view={viewAngle}
                    interactiveDrag={true}
                    onArtworkPositionChange={handleArtworkPositionChange}
                    className="w-full h-full max-h-[440px]"
                  />
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* REQUIREMENT 1 & 2: Quick Select Merchandise (EXACTLY 5 ITEMS) */}
              {/* ------------------------------------------------------------- */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 font-mono">
                    Quick Select Merchandise
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    5 Verified Options
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {(['polo', 'hoodie', 'mug', 'cap', 'visiting-card'] as MerchType[]).map((type) => {
                    const cfg = MERCH_CONFIGS[type];
                    const isSelected = activeMerch === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleSelectMerchandise(type)}
                        className={`p-2.5 rounded-xl text-center transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-orange-50/90 border-[#FF7A00] ring-1 ring-[#FF7A00] shadow-xs'
                            : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-600'
                        }`}
                      >
                        <div className={`text-xs font-bold truncate font-display ${isSelected ? 'text-[#FF7A00]' : 'text-zinc-800'}`}>
                          {cfg.shortName}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                          {cfg.priceDisplay}
                        </div>
                        <div className="text-[9px] text-zinc-400 font-mono mt-0.2">
                          {cfg.moqDisplay}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>

      {/* 3D Visual Proof Modal */}
      {isProofModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 text-[#0B0B0D] shadow-2xl relative max-h-[92vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-orange-100 text-[#FF7A00] flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-zinc-900 leading-tight">
                    Official Digital Production Proof
                  </h3>
                  <p className="text-xs text-zinc-500">
                    High-definition proof prepared for {activeConfig.name} in {activeColor.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsProofModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-2 rounded-full hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Proof Modal Body */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 my-6 items-center">
              
              {/* Preview Window (7 cols) */}
              <div className="md:col-span-7 bg-[#F7F7FA] rounded-2xl border border-zinc-200 p-6 flex flex-col items-center justify-center relative overflow-hidden min-h-[340px]">
                {/* Zoom controls */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-xs p-1 rounded-lg border border-zinc-200 shadow-2xs z-10">
                  <button
                    type="button"
                    onClick={() => setProofZoom((z) => Math.max(0.8, z - 0.15))}
                    className="p-1 text-zinc-600 hover:text-zinc-900 rounded cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono font-bold text-zinc-600 px-1">
                    {Math.round(proofZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setProofZoom((z) => Math.min(1.6, z + 0.15))}
                    className="p-1 text-zinc-600 hover:text-zinc-900 rounded cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div 
                  className="w-full h-full flex items-center justify-center transition-transform duration-200"
                  style={{ transform: `scale(${proofZoom})` }}
                >
                  <ProductMockupCanvas
                    productType={activeMerch}
                    color={currentColor}
                    artwork={currentArtwork}
                    printMethod={activeConfig.printMethod}
                    printPlacement={printPlacement}
                    view={viewAngle}
                    interactiveDrag={false}
                    className="w-full h-full max-h-[320px]"
                  />
                </div>

                <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded text-[10px] font-mono font-bold text-zinc-700 border border-zinc-200">
                  {viewAngle.toUpperCase()} • {printPlacement}
                </div>
              </div>

              {/* Proof Specs Column (5 cols) */}
              <div className="md:col-span-5 space-y-4">
                <div className="bg-orange-50/60 border border-orange-200/70 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-[#FF7A00] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Zero Obligation Proof Approved</span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed">
                    This vector proof will be matched by our industrial Heidelberg & Tajima printing equipment upon order confirmation.
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-zinc-100">
                    <span className="text-zinc-500">Merchandise:</span>
                    <strong className="text-zinc-900">{activeConfig.name}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-100">
                    <span className="text-zinc-500">Base Color:</span>
                    <strong className="text-zinc-900">{activeColor.name}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-100">
                    <span className="text-zinc-500">Placement:</span>
                    <strong className="text-zinc-900">{printPlacement}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-100">
                    <span className="text-zinc-500">Print Method:</span>
                    <strong className="text-zinc-900">{activeConfig.printMethod}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-100">
                    <span className="text-zinc-500">Base Unit Price:</span>
                    <strong className="text-zinc-900">{activeConfig.priceDisplay}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-zinc-100">
                    <span className="text-zinc-500">Turnaround:</span>
                    <strong className="text-emerald-700">⚡ 24–48 Hours Dispatch</strong>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-zinc-500">Digital Proof Cost:</span>
                    <strong className="text-[#FF7A00] font-bold">₹0.00 (Free)</strong>
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProofModalOpen(false);
                      setIsQuoteModalOpen(true);
                    }}
                    className="w-full bg-[#FF7A00] hover:bg-[#e06c00] text-white font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm shadow-[#FF7A00]/25 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Request Official Quote with this Mockup</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="w-full bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <WhatsAppIcon className="w-4 h-4 text-white" />
                    <span>Send Proof to WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadProof}
                    className="w-full bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs py-2 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-zinc-600" />
                    <span>{proofCopied ? 'Mockup Saved!' : 'Download Digital Mockup'}</span>
                  </button>

                  {onExploreProduct && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsProofModalOpen(false);
                        onExploreProduct(activeConfig.catalogId);
                      }}
                      className="w-full text-center text-xs font-bold text-[#FF7A00] hover:underline pt-1 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Configure Full Bulk Order ({activeConfig.name})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

      {/* Supabase Request Quote Modal */}
      <RequestQuoteModal
        isOpen={isQuoteModalOpen}
        onClose={() => setIsQuoteModalOpen(false)}
        preselectedProductId={activeConfig.catalogId}
        prefilledLogoUrl={uploadedLogo}
        prefilledColorName={activeColor.name}
        prefilledPlacement={printPlacement}
      />


    </section>
  );
};
