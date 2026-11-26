import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { triggerCelebration } from '../services/celebrationService';
import {
  AlertTriangle,
  Bookmark,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  GitCompare,
  History,
  Lock,
  Maximize2,
  Minimize2,
  Monitor,
  MoreVertical,
  PanelLeftClose,
  PanelLeftOpen,
  Redo2,
  RotateCcw,
  RotateCw,
  Share2,
  ShieldCheck,
  Smartphone,
  SquareDashedBottom,
  Trash2,
  Undo2,
  Unlock,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CustomArtwork,
  PrintMethod,
  Product,
  ProductColor,
  StudioLayer,
  StudioShapeType,
} from '../types';
import { getTippingPoloImages } from '../data/tippingPoloImages';
import { getPlainPoloImages } from '../data/plainPoloImages';
import { getJoabCoolmaxImages } from '../data/joabCoolmaxImages';
import { getMattyPoloImages } from '../data/mattyPoloImages';
import { getCapImages } from '../data/capImages';
import { calculateProductPrice, formatCurrencyINR } from '../data/pricingRules';
import { compressImageFile } from '../utils/imageCompressor';
import {
  DEFAULT_LOGO_CLEANUP,
  EraserAction,
  LogoCleanupOptions,
  LogoPartItem,
  processLogoPipeline,
  rasterizePresetToDataUrl,
} from '../utils/logoProcessor';
import { getPoloVerticalCalibration } from './plain-polo-studio/plainPoloStudioTypes';
import { PlainPoloMagicEraserModal } from './plain-polo-studio/PlainPoloMagicEraserModal';
import { ProductStageSvg } from './product-studio/ProductStageSvg';
import { LeftAccordionId, ProductLeftToolkitPanel } from './product-studio/ProductLeftToolkitPanel';
import { ProductRightOrderPanel } from './product-studio/ProductRightOrderPanel';
import { ProductMobileWorkbench } from './product-studio/ProductMobileWorkbench';
import {
  CompareProductDesignsModal,
  ProductHistoryDrawer,
  SaveProductDesignModal,
  SavedProductDesignsDrawer,
} from './ProductStudioDrawers';
import {
  LogoFileMeta,
  ProductHistorySnapshot,
  ProductHistoryVersion,
  ProductModalCommitPayload,
  SavedProductDesign,
  buildInitialProductLayers,
  buildProductShareLink,
  computeProductDesignValidation,
  copyToClipboardSafe,
  createStudioUid,
  getProductStudioMeta,
  getRawLogoFromArtwork,
  getSurfaceHex,
  getZoneCoordinates,
  isSurfaceLight,
  loadSavedProductDesigns,
  persistSavedProductDesigns,
  renderPdfBadgeDataUrl,
  renderStudioSvgToPngDataUrl,
} from './productStudioConfigs';

interface ProductDesignStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  selectedColor: ProductColor;
  onSelectColor: (color: ProductColor) => void;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  unitPrice?: number;
  totalPrice?: number;
  moq?: number;
  sizeDistribution?: Record<string, number>;
  onSizeDistributionChange?: (next: Record<string, number>) => void;
  frontArtwork: CustomArtwork | null;
  backArtwork: CustomArtwork | null;
  frontPlacement: string;
  backPlacement: string;
  selectedPrintMethod: PrintMethod;
  onSelectPrintMethod: (pm: PrintMethod) => void;
  uploadedFrontLogoName: string;
  uploadedBackLogoName: string;
  initialArtworkApproved?: boolean;
  initialActiveSide?: 'front' | 'back';
  selectedVariantLabel?: string;
  onSelectVariantLabel?: (variant: string) => void;
  onCommitStudioChanges: (payload: ProductModalCommitPayload) => void;
  onDirectAddToCart?: (payload: ProductModalCommitPayload) => Promise<void> | void;
}

export const ProductDesignStudioModal: React.FC<ProductDesignStudioModalProps> = ({
  isOpen,
  onClose,
  product,
  selectedColor,
  onSelectColor,
  quantity,
  onQuantityChange,
  sizeDistribution = {},
  onSizeDistributionChange,
  frontArtwork,
  backArtwork,
  frontPlacement: propFrontPlacement,
  backPlacement: propBackPlacement,
  selectedPrintMethod,
  onSelectPrintMethod,
  uploadedFrontLogoName,
  uploadedBackLogoName,
  initialArtworkApproved = false,
  initialActiveSide = 'front',
  selectedVariantLabel,
  onSelectVariantLabel,
  onCommitStudioChanges,
  onDirectAddToCart,
}) => {
  const meta = useMemo(
    () => getProductStudioMeta(product, selectedVariantLabel),
    [product, selectedVariantLabel]
  );

  const isPoloOrTshirt = product.productType === 'polo' || product.productType === 'tshirt';
  const isCap = product.productType === 'cap';
  const poloYCalib = isPoloOrTshirt ? getPoloVerticalCalibration(selectedColor.name) : 0;

  const [activeSide, setActiveSide] = useState<'front' | 'back'>(
    meta.hasBackSide ? initialActiveSide : 'front'
  );
  const [frontPlacement, setFrontPlacement] = useState<string>(
    propFrontPlacement || meta.defaultFrontPlacement
  );
  const [backPlacement, setBackPlacement] = useState<string>(
    propBackPlacement || meta.defaultBackPlacement
  );
  const [noBackPrint, setNoBackPrint] = useState<boolean>(
    meta.supportsNoBackPrint && propBackPlacement === 'No back print'
  );

  const [backUsesSameLogoAsFront, setBackUsesSameLogoAsFront] = useState<boolean>(
    !backArtwork || backArtwork?.rawDataUrl === frontArtwork?.rawDataUrl
  );

  const initialFrontRaw = getRawLogoFromArtwork(frontArtwork, rasterizePresetToDataUrl);
  const initialBackRaw = getRawLogoFromArtwork(backArtwork, rasterizePresetToDataUrl);
  const starterLogoUrl = rasterizePresetToDataUrl('your-logo');

  const [frontRawLogo, setFrontRawLogo] = useState<string>(
    initialFrontRaw?.rawUrl || starterLogoUrl
  );
  const [backRawLogo, setBackRawLogo] = useState<string>(
    initialBackRaw?.rawUrl || initialFrontRaw?.rawUrl || starterLogoUrl
  );
  const [frontFileName, setFrontFileName] = useState<string>(
    uploadedFrontLogoName || initialFrontRaw?.label || 'Starter Corporate Crest'
  );
  const [backFileName, setBackFileName] = useState<string>(
    uploadedBackLogoName || initialBackRaw?.label || uploadedFrontLogoName || 'Starter Corporate Crest'
  );

  const [frontFileMeta, setFrontFileMeta] = useState<LogoFileMeta | null>(null);
  const [backFileMeta, setBackFileMeta] = useState<LogoFileMeta | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [frontCleanup, setFrontCleanup] = useState<LogoCleanupOptions>({ ...DEFAULT_LOGO_CLEANUP });
  const [backCleanup, setBackCleanup] = useState<LogoCleanupOptions>({ ...DEFAULT_LOGO_CLEANUP });
  const [frontParts, setFrontParts] = useState<LogoPartItem[]>([]);
  const [backParts, setBackParts] = useState<LogoPartItem[]>([]);
  const [frontEraserBaseUrl, setFrontEraserBaseUrl] = useState<string>(frontRawLogo);
  const [backEraserBaseUrl, setBackEraserBaseUrl] = useState<string>(backRawLogo);
  const [processedFrontUrl, setProcessedFrontUrl] = useState<string>(frontArtwork?.dataUrl || frontRawLogo);
  const [processedBackUrl, setProcessedBackUrl] = useState<string>(backArtwork?.dataUrl || backRawLogo);

  const baseHex = selectedColor.garmentHex || selectedColor.hex || '#162B4D';
  const frontSurfaceHex = getSurfaceHex(product.productType, baseHex, frontPlacement);
  const backSurfaceHex = getSurfaceHex(product.productType, baseHex, backPlacement);
  const activeSurfaceHex = activeSide === 'front' ? frontSurfaceHex : backSurfaceHex;

  const [frontLayers, setFrontLayers] = useState<StudioLayer[]>(() =>
    buildInitialProductLayers(
      frontArtwork,
      product.productType,
      'front',
      propFrontPlacement || meta.defaultFrontPlacement,
      poloYCalib,
      frontSurfaceHex,
      rasterizePresetToDataUrl
    )
  );
  const [backLayers, setBackLayers] = useState<StudioLayer[]>(() =>
    buildInitialProductLayers(
      backArtwork,
      product.productType,
      'back',
      propBackPlacement || meta.defaultBackPlacement,
      poloYCalib,
      backSurfaceHex,
      rasterizePresetToDataUrl
    )
  );

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<LeftAccordionId | null>('upload');
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isTabletRightOpen, setIsTabletRightOpen] = useState(false);

  const [canvasFrameMode, setCanvasFrameMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showPrintGuides, setShowPrintGuides] = useState(true);
  const [showLayersOnPreview, setShowLayersOnPreview] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [artworkApproved, setArtworkApproved] = useState(initialArtworkApproved);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const [companyNameText, setCompanyNameText] = useState('TEQQNOWORLD');
  const [inlineEditLayerId, setInlineEditLayerId] = useState<string | null>(null);

  // Header utilities & drawers
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isMagicEraserOpen, setIsMagicEraserOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [savedDesigns, setSavedDesigns] = useState<SavedProductDesign[]>(() =>
    loadSavedProductDesigns(product.id)
  );

  // Undo / Redo + named version history
  const [historyPast, setHistoryPast] = useState<ProductHistorySnapshot[]>([]);
  const [historyFuture, setHistoryFuture] = useState<ProductHistorySnapshot[]>([]);
  const [versionHistory, setVersionHistory] = useState<ProductHistoryVersion[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((curr) => (curr === msg ? null : curr)), 2600);
  }, []);

  const captureSnapshot = useCallback(
    (): ProductHistorySnapshot => ({
      frontLayers: frontLayers.map((l) => ({ ...l })),
      backLayers: backLayers.map((l) => ({ ...l })),
      frontPlacement,
      backPlacement,
      selectedColorName: selectedColor.name,
      printMethod: selectedPrintMethod,
      noBackPrint,
      variantLabel: selectedVariantLabel,
    }),
    [
      frontLayers,
      backLayers,
      frontPlacement,
      backPlacement,
      selectedColor.name,
      selectedPrintMethod,
      noBackPrint,
      selectedVariantLabel,
    ]
  );

  const pushHistory = useCallback(
    (label = 'Design edit') => {
      const snap = captureSnapshot();
      setHistoryPast((prev) => [...prev.slice(-24), snap]);
      setHistoryFuture([]);
      setVersionHistory((prev) => [
        {
          id: createStudioUid('ver'),
          label,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          snapshot: snap,
        },
        ...prev.slice(0, 19),
      ]);
    },
    [captureSnapshot]
  );

  const applySnapshot = useCallback(
    (snap: ProductHistorySnapshot) => {
      setFrontLayers(snap.frontLayers.map((l) => ({ ...l })));
      setBackLayers(snap.backLayers.map((l) => ({ ...l })));
      setFrontPlacement(snap.frontPlacement);
      setBackPlacement(snap.backPlacement);
      setNoBackPrint(snap.noBackPrint);
      const col = product.colors.find((c) => c.name === snap.selectedColorName);
      if (col) onSelectColor(col);
      onSelectPrintMethod(snap.printMethod);
      if (snap.variantLabel && onSelectVariantLabel) onSelectVariantLabel(snap.variantLabel);
      setSelectedLayerId(null);
    },
    [product.colors, onSelectColor, onSelectPrintMethod, onSelectVariantLabel]
  );

  const handleUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    setHistoryFuture((f) => [captureSnapshot(), ...f.slice(0, 24)]);
    setHistoryPast((p) => p.slice(0, -1));
    applySnapshot(prev);
  }, [historyPast, captureSnapshot, applySnapshot]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryPast((p) => [...p.slice(-24), captureSnapshot()]);
    setHistoryFuture((f) => f.slice(1));
    applySnapshot(next);
  }, [historyFuture, captureSnapshot, applySnapshot]);

  // Logo Processing Pipelines (Front & Back)
  useEffect(() => {
    let cancelled = false;
    if (!frontRawLogo) return;
    processLogoPipeline(frontRawLogo, frontCleanup, frontSurfaceHex)
      .then((res) => {
        if (cancelled) return;
        setFrontParts(res.parts);
        setFrontEraserBaseUrl(res.eraserBaseDataUrl);
        setProcessedFrontUrl(res.processedDataUrl);
        setFrontLayers((prev) => {
          const aspect = res.height > 0 ? res.width / res.height : 1;
          return prev.map((l) => {
            if (!l.isMainLogo) return l;
            const maxSide = Math.max(l.width, l.height);
            return {
              ...l,
              dataUrl: res.processedDataUrl,
              width: aspect >= 1 ? maxSide : maxSide * aspect,
              height: aspect >= 1 ? maxSide / aspect : maxSide,
            };
          });
        });
      })
      .catch((err) => console.warn('[ProductStudio] Front pipeline error:', err));
    return () => {
      cancelled = true;
    };
  }, [frontRawLogo, frontCleanup, frontSurfaceHex]);

  useEffect(() => {
    let cancelled = false;
    if (!backRawLogo || !meta.hasBackSide) return;
    processLogoPipeline(backRawLogo, backCleanup, backSurfaceHex)
      .then((res) => {
        if (cancelled) return;
        setBackParts(res.parts);
        setBackEraserBaseUrl(res.eraserBaseDataUrl);
        setProcessedBackUrl(res.processedDataUrl);
        setBackLayers((prev) => {
          const aspect = res.height > 0 ? res.width / res.height : 1;
          return prev.map((l) => {
            if (!l.isMainLogo) return l;
            const maxSide = Math.max(l.width, l.height);
            return {
              ...l,
              dataUrl: res.processedDataUrl,
              width: aspect >= 1 ? maxSide : maxSide * aspect,
              height: aspect >= 1 ? maxSide / aspect : maxSide,
            };
          });
        });
      })
      .catch((err) => console.warn('[ProductStudio] Back pipeline error:', err));
    return () => {
      cancelled = true;
    };
  }, [backRawLogo, backCleanup, backSurfaceHex, meta.hasBackSide]);

  const activeLayers = activeSide === 'front' ? frontLayers : backLayers;
  const setActiveLayers = activeSide === 'front' ? setFrontLayers : setBackLayers;
  const activePlacement = activeSide === 'front' ? frontPlacement : backPlacement;
  const activeCleanup = activeSide === 'front' ? frontCleanup : backCleanup;
  const setActiveCleanup = activeSide === 'front' ? setFrontCleanup : setBackCleanup;
  const activeParts = activeSide === 'front' ? frontParts : backParts;

  const activeZone = getZoneCoordinates(product.productType, activeSide, activePlacement, poloYCalib);
  const selectedLayer = activeLayers.find((l) => l.id === selectedLayerId) || null;
  const mainLogoLayer = activeLayers.find((l) => l.isMainLogo) || null;
  const logoSizePercent = mainLogoLayer
    ? Math.round((Math.max(mainLogoLayer.width, mainLogoLayer.height) / Math.max(16, activeZone.boxSize)) * 100)
    : 100;
  const hasCompanyNameLayer = activeLayers.some((l) => l.id.startsWith(`compname-${activeSide}`));

  const updateLayer = (id: string, patch: Partial<StudioLayer>) => {
    setActiveLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  // Drag / Resize / Rotate on SVG Canvas
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    mode: 'move' | 'resize' | 'rotate';
    layerId: string;
    startSvgX: number;
    startSvgY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    origFontSize: number;
    corner?: 'nw' | 'ne' | 'se' | 'sw';
    hasRecordedHistory: boolean;
  } | null>(null);

  const clientToSvgCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 250, y: 250 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 500,
      y: ((clientY - rect.top) / rect.height) * 500,
    };
  };

  const handleStartLayerDrag = (
    e: React.PointerEvent,
    layer: StudioLayer,
    mode: 'move' | 'resize' | 'rotate',
    corner?: 'nw' | 'ne' | 'se' | 'sw'
  ) => {
    if (layer.locked) {
      setSelectedLayerId(layer.id);
      return;
    }
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setSelectedLayerId(layer.id);
    const pt = clientToSvgCoords(e.clientX, e.clientY);
    dragStateRef.current = {
      mode,
      layerId: layer.id,
      startSvgX: pt.x,
      startSvgY: pt.y,
      origX: layer.x,
      origY: layer.y,
      origW: layer.width,
      origH: layer.height,
      origFontSize: layer.fontSize || 14,
      corner,
      hasRecordedHistory: false,
    };
  };

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    const ds = dragStateRef.current;
    if (!ds) return;
    const pt = clientToSvgCoords(e.clientX, e.clientY);
    const dx = pt.x - ds.startSvgX;
    const dy = pt.y - ds.startSvgY;

    if (!ds.hasRecordedHistory && (Math.abs(dx) > 1.2 || Math.abs(dy) > 1.2)) {
      pushHistory('Transform layer');
      ds.hasRecordedHistory = true;
    }

    if (ds.mode === 'move') {
      updateLayer(ds.layerId, {
        x: Math.max(55, Math.min(445, ds.origX + dx)),
        y: Math.max(50, Math.min(450, ds.origY + dy)),
      });
    } else if (ds.mode === 'rotate') {
      const angRad = Math.atan2(pt.y - ds.origY, pt.x - ds.origX);
      const deg = Math.round((angRad * 180) / Math.PI + 90);
      updateLayer(ds.layerId, { rotation: ((deg + 180) % 360 + 360) % 360 - 180 });
    } else if (ds.mode === 'resize') {
      const signX = ds.corner === 'nw' || ds.corner === 'sw' ? -1 : 1;
      const signY = ds.corner === 'nw' || ds.corner === 'ne' ? -1 : 1;
      const deltaW = dx * signX * 2;
      const deltaH = dy * signY * 2;
      const targetLayer = activeLayers.find((l) => l.id === ds.layerId);
      if (!targetLayer) return;

      if (targetLayer.kind === 'shape') {
        updateLayer(ds.layerId, {
          width: Math.max(16, Math.min(280, ds.origW + deltaW)),
          height: Math.max(6, Math.min(280, ds.origH + deltaH)),
        });
      } else {
        const scaleFactor = Math.max(
          0.3,
          Math.min(3.5, 1 + Math.max(deltaW / Math.max(20, ds.origW), deltaH / Math.max(20, ds.origH)) * 0.7)
        );
        updateLayer(ds.layerId, {
          width: Math.max(16, ds.origW * scaleFactor),
          height: Math.max(14, ds.origH * scaleFactor),
          ...(targetLayer.kind === 'text' || targetLayer.kind === 'curved-text'
            ? { fontSize: Math.max(7, Math.min(48, Math.round(ds.origFontSize * scaleFactor))) }
            : {}),
        });
      }
    }
  };

  const handleSvgPointerUp = () => {
    dragStateRef.current = null;
  };

  // Logo Upload Inputs
  const logoUploadInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetSideRef = useRef<'front' | 'back'>('front');
  const extraImageInputRef = useRef<HTMLInputElement>(null);

  const handleTriggerLogoUpload = (targetSide: 'front' | 'back') => {
    uploadTargetSideRef.current = targetSide;
    logoUploadInputRef.current?.click();
  };

  const handleLogoFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      showToast('File size exceeds 15 MB limit.');
      return;
    }

    const targetSide = uploadTargetSideRef.current;
    setUploadProgress(25);

    try {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isVector = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');

      let finalUrl = '';
      let naturalWidth = 800;
      let naturalHeight = 800;

      if (isPdf) {
        finalUrl = await renderPdfBadgeDataUrl(file.name);
        setUploadProgress(95);
      } else {
        const compressed = await compressImageFile(file, {
          maxWidth: 1000,
          maxHeight: 1000,
          quality: 0.9,
          format: 'image/png',
        });
        finalUrl = compressed.dataUrl;
        setUploadProgress(80);
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: 800, h: 800 });
          img.src = finalUrl;
        });
        naturalWidth = dims.w;
        naturalHeight = dims.h;
      }

      const fileMeta: LogoFileMeta = {
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: isPdf ? 'PDF Vector' : isVector ? 'SVG Vector' : file.type || 'Image',
        naturalWidth,
        naturalHeight,
        isPdf,
        isVector,
      };

      pushHistory(`Upload ${targetSide} logo`);

      if (targetSide === 'front') {
        setFrontFileMeta(fileMeta);
        setFrontRawLogo(finalUrl);
        setFrontFileName(file.name);
        setFrontCleanup((prev) => ({ ...prev, hiddenPartIndices: [], eraserActions: [] }));
        setFrontLayers((prev) => {
          if (prev.some((l) => l.isMainLogo)) return prev;
          const z = getZoneCoordinates(product.productType, 'front', frontPlacement, poloYCalib);
          return [
            ...prev,
            {
              id: createStudioUid('logo'),
              name: 'Front Logo',
              kind: 'logo',
              x: z.cx,
              y: z.cy,
              width: z.boxSize,
              height: z.boxSize,
              rotation: 0,
              opacity: 1,
              visible: true,
              dataUrl: finalUrl,
              isMainLogo: true,
            },
          ];
        });
        if (backUsesSameLogoAsFront && meta.hasBackSide) {
          setBackFileMeta(fileMeta);
          setBackRawLogo(finalUrl);
          setBackFileName(file.name);
          setBackCleanup((prev) => ({ ...prev, hiddenPartIndices: [], eraserActions: [] }));
        }
      } else {
        setBackUsesSameLogoAsFront(false);
        setBackFileMeta(fileMeta);
        setBackRawLogo(finalUrl);
        setBackFileName(file.name);
        setNoBackPrint(false);
        setBackCleanup((prev) => ({ ...prev, hiddenPartIndices: [], eraserActions: [] }));
        setBackLayers((prev) => {
          if (prev.some((l) => l.isMainLogo)) return prev;
          const z = getZoneCoordinates(product.productType, 'back', backPlacement, poloYCalib);
          return [
            ...prev,
            {
              id: createStudioUid('logo'),
              name: 'Back Logo',
              kind: 'logo',
              x: z.cx,
              y: z.cy,
              width: z.boxSize,
              height: z.boxSize,
              rotation: 0,
              opacity: 1,
              visible: true,
              dataUrl: finalUrl,
              isMainLogo: true,
            },
          ];
        });
      }
      setActiveSide(targetSide);
      showToast(`Uploaded ${file.name}`);
    } catch (err) {
      console.warn('[ProductStudio] Logo upload failed:', err);
      showToast('Could not read file. Try PNG, JPG, SVG, or PDF.');
    } finally {
      setTimeout(() => setUploadProgress(null), 250);
    }
  };

  const handleUploadExtraImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { dataUrl } = await compressImageFile(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.88,
        format: 'image/png',
      });
      pushHistory('Add secondary graphic');
      const id = createStudioUid('img');
      const size = Math.max(46, Math.min(88, activeZone.boxSize));
      setActiveLayers((prev) => [
        ...prev,
        {
          id,
          name: file.name,
          kind: 'image',
          x: activeZone.cx,
          y: activeZone.cy,
          width: size,
          height: size,
          rotation: 0,
          opacity: 1,
          visible: true,
          dataUrl,
          isMainLogo: false,
        },
      ]);
      setSelectedLayerId(id);
    } catch (err) {
      console.warn('[ProductStudio] Extra image upload failed:', err);
    }
  };

  // Placement Switching
  const handleSelectPlacement = (side: 'front' | 'back', placementId: string) => {
    pushHistory(`Move ${side} zone to ${placementId}`);
    if (side === 'front') {
      setActiveSide('front');
      setFrontPlacement(placementId);
      const z = getZoneCoordinates(product.productType, 'front', placementId, poloYCalib);
      setFrontLayers((prev) =>
        prev.map((l) => {
          if (!l.isMainLogo) return l;
          const aspect = l.height > 0 ? l.width / l.height : 1;
          return {
            ...l,
            x: z.cx,
            y: z.cy,
            width: aspect >= 1 ? z.boxSize : z.boxSize * aspect,
            height: aspect >= 1 ? z.boxSize / aspect : z.boxSize,
          };
        })
      );
    } else if (meta.hasBackSide) {
      setActiveSide('back');
      setBackPlacement(placementId);
      if (placementId === 'No back print') {
        setNoBackPrint(true);
        return;
      }
      setNoBackPrint(false);
      const z = getZoneCoordinates(product.productType, 'back', placementId, poloYCalib);
      setBackLayers((prev) => {
        if (!prev.some((l) => l.isMainLogo)) {
          return [
            ...prev,
            {
              id: createStudioUid('logo'),
              name: 'Back Logo',
              kind: 'logo',
              x: z.cx,
              y: z.cy,
              width: z.boxSize,
              height: z.boxSize,
              rotation: 0,
              opacity: 1,
              visible: true,
              dataUrl: processedBackUrl || backRawLogo || starterLogoUrl,
              isMainLogo: true,
            },
          ];
        }
        return prev.map((l) => {
          if (!l.isMainLogo) return l;
          const aspect = l.height > 0 ? l.width / l.height : 1;
          return {
            ...l,
            x: z.cx,
            y: z.cy,
            width: aspect >= 1 ? z.boxSize : z.boxSize * aspect,
            height: aspect >= 1 ? z.boxSize / aspect : z.boxSize,
          };
        });
      });
    }
  };

  // Layer actions
  const handleLogoSizeSlider = (pct: number) => {
    if (!mainLogoLayer) return;
    const clamped = Math.max(30, Math.min(200, pct));
    const ratio = mainLogoLayer.height > 0 ? mainLogoLayer.width / mainLogoLayer.height : 1;
    const targetMax = activeZone.boxSize * (clamped / 100);
    updateLayer(mainLogoLayer.id, {
      width: ratio >= 1 ? targetMax : targetMax * ratio,
      height: ratio >= 1 ? targetMax / ratio : targetMax,
    });
  };

  const handleCenterMainLogo = () => {
    if (!mainLogoLayer) return;
    pushHistory('Center main logo');
    updateLayer(mainLogoLayer.id, { x: activeZone.cx, y: activeZone.cy });
  };

  const handleAddTextLayer = (preset: {
    text: string;
    fontSize: number;
    fontWeight: string;
    letterSpacing?: number;
    curved?: boolean;
  }) => {
    pushHistory('Add text layer');
    const id = createStudioUid(preset.curved ? 'curve' : 'txt');
    const lightSurf = isSurfaceLight(activeSurfaceHex);
    const offset = (activeLayers.length % 4) * 10 - 12;
    setActiveLayers((prev) => [
      ...prev,
      {
        id,
        name: preset.text,
        kind: preset.curved ? 'curved-text' : 'text',
        x: activeZone.cx,
        y: activeZone.cy + offset,
        width: Math.max(85, preset.text.length * preset.fontSize * 0.62),
        height: preset.curved ? 44 : Math.max(20, preset.fontSize * 1.4),
        rotation: 0,
        opacity: 1,
        visible: true,
        text: preset.text,
        fontSize: preset.fontSize,
        fontFamily: 'Space Grotesk, sans-serif',
        fontWeight: preset.fontWeight,
        fontStyle: 'normal',
        textTransform: 'none',
        textAlign: 'center',
        textColor: lightSurf ? '#071B35' : '#FFFFFF',
        letterSpacing: preset.letterSpacing ?? 0.6,
        curve: preset.curved ? 45 : 0,
      },
    ]);
    setSelectedLayerId(id);
  };

  const handleAddShapeLayer = (shapeType: StudioShapeType) => {
    pushHistory('Add badge shape');
    const id = createStudioUid('shape');
    const fill = isSurfaceLight(activeSurfaceHex) ? '#071B35' : '#FF7900';
    setActiveLayers((prev) => [
      ...prev,
      {
        id,
        name: `Shape (${shapeType})`,
        kind: 'shape',
        x: activeZone.cx,
        y: activeZone.cy,
        width: shapeType === 'line' ? 96 : shapeType === 'pill' ? 84 : 52,
        height: shapeType === 'line' ? 10 : shapeType === 'pill' ? 32 : 52,
        rotation: 0,
        opacity: 1,
        visible: true,
        shapeType,
        fillColor: shapeType === 'ring' ? 'transparent' : fill,
        strokeColor: shapeType === 'ring' ? fill : '#FFFFFF',
        strokeWidth: shapeType === 'ring' ? 5 : 0,
        borderRadius: shapeType === 'rect' ? 6 : 24,
      },
    ]);
    setSelectedLayerId(id);
  };

  const handleToggleCompanyName = () => {
    pushHistory('Toggle company subline');
    const targetId = `compname-${activeSide}`;
    if (hasCompanyNameLayer) {
      setActiveLayers((prev) => prev.filter((l) => l.id !== targetId));
      if (selectedLayerId === targetId) setSelectedLayerId(null);
    } else {
      const anchorX = mainLogoLayer ? mainLogoLayer.x : activeZone.cx;
      const anchorY = mainLogoLayer ? mainLogoLayer.y + mainLogoLayer.height / 2 + 12 : activeZone.cy + 26;
      const fontSize = Math.max(9, Math.min(18, Math.round(activeZone.boxSize * 0.22)));
      setActiveLayers((prev) => [
        ...prev,
        {
          id: targetId,
          name: companyNameText || 'Company Name',
          kind: 'text',
          x: anchorX,
          y: anchorY,
          width: Math.max(70, companyNameText.length * fontSize * 0.62),
          height: fontSize * 1.4,
          rotation: 0,
          opacity: 1,
          visible: true,
          text: companyNameText,
          fontSize,
          fontFamily: 'Space Grotesk, sans-serif',
          fontWeight: '700',
          textTransform: 'uppercase',
          textAlign: 'center',
          textColor: isSurfaceLight(activeSurfaceHex) ? '#071B35' : '#FFFFFF',
          letterSpacing: 1,
        },
      ]);
      setSelectedLayerId(targetId);
    }
  };

  const handleDuplicateLayer = (id: string) => {
    const src = activeLayers.find((l) => l.id === id);
    if (!src) return;
    pushHistory('Duplicate layer');
    const copyId = createStudioUid('copy');
    setActiveLayers((prev) => [
      ...prev,
      {
        ...src,
        id: copyId,
        name: `${src.name || 'Layer'} Copy`,
        isMainLogo: false,
        x: Math.min(430, src.x + 14),
        y: Math.min(430, src.y + 14),
      },
    ]);
    setSelectedLayerId(copyId);
  };

  const handleDeleteLayer = (id: string) => {
    pushHistory('Delete layer');
    setActiveLayers((prev) => prev.filter((l) => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const handleMoveLayerOrder = (id: string, dir: 'up' | 'down') => {
    const idx = activeLayers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const nextIdx = dir === 'up' ? Math.min(activeLayers.length - 1, idx + 1) : Math.max(0, idx - 1);
    if (idx === nextIdx) return;
    pushHistory('Reorder layer');
    const next = [...activeLayers];
    const [item] = next.splice(idx, 1);
    next.splice(nextIdx, 0, item);
    setActiveLayers(next);
  };

  // Convert studio layers -> CustomArtwork
  const layersToArtwork = useCallback(
    (layers: StudioLayer[], side: 'front' | 'back', placement: string): CustomArtwork | null => {
      const visible = layers.filter((l) => l.visible !== false);
      if (visible.length === 0) return null;
      const main = visible.find((l) => l.isMainLogo);
      const z = getZoneCoordinates(product.productType, side, placement, poloYCalib);
      const rawUrl = side === 'front' ? frontRawLogo : backRawLogo;
      const relX = main ? Math.max(-35, Math.min(35, ((main.x - z.cx) / Math.max(10, z.maxW)) * 100)) : 0;
      const relY = main ? Math.max(-35, Math.min(35, ((main.y - z.cy) / Math.max(10, z.maxH)) * 100)) : 0;
      const relScale = main ? Math.max(0.4, Math.min(2.2, Math.max(main.width, main.height) / Math.max(14, z.boxSize))) : 1;

      return {
        type: main ? 'image' : 'text',
        dataUrl: main?.dataUrl,
        rawDataUrl: rawUrl,
        x: relX,
        y: relY,
        scale: relScale,
        rotation: main?.rotation || 0,
        studioLayers: visible,
      };
    },
    [product.productType, poloYCalib, frontRawLogo, backRawLogo]
  );

  // Live Pricing
  const pricing = useMemo(
    () => calculateProductPrice(product.id, quantity, selectedVariantLabel),
    [product.id, quantity, selectedVariantLabel]
  );

  // Design Validation
  const validationIssues = useMemo(
    () =>
      computeProductDesignValidation({
        meta,
        frontLayers,
        backLayers,
        noBackPrint,
        frontFileMeta,
        backFileMeta,
        printMethod: selectedPrintMethod,
        artworkApproved,
      }),
    [meta, frontLayers, backLayers, noBackPrint, frontFileMeta, backFileMeta, selectedPrintMethod, artworkApproved]
  );
  const warningCount = validationIssues.filter((i) => i.severity !== 'ok').length;

  // Customer Feature Handlers: Save / Saved / Duplicate / Download / Share / Reset
  const handleSaveDesign = async (name: string) => {
    const thumb = await renderStudioSvgToPngDataUrl(svgRef.current, 320);
    const entry: SavedProductDesign = {
      id: createStudioUid('saved'),
      productId: product.id,
      name,
      updatedAt: new Date().toISOString(),
      colorName: selectedColor.name,
      colorHex: selectedColor.hex || selectedColor.garmentHex || '#162B4D',
      variantLabel: selectedVariantLabel,
      quantity,
      printMethod: selectedPrintMethod,
      frontPlacement,
      backPlacement,
      noBackPrint,
      artworkApproved,
      frontLayers,
      backLayers,
      frontCleanup,
      backCleanup,
      backUsesSameLogo: backUsesSameLogoAsFront,
      uploadedFrontLogoName: frontFileName,
      uploadedBackLogoName: backFileName,
      thumbnailDataUrl: thumb || undefined,
    };
    const next = [entry, ...savedDesigns];
    setSavedDesigns(next);
    persistSavedProductDesigns(product.id, next);
    showToast(`Saved "${name}"`);
    triggerCelebration({
      level: 'premium',
      sound: 'celebration',
      eventKey: `design-saved:${entry.id}`,
      dedupeWindowMs: 1500,
      action: 'product_customization_saved',
    });
  };

  const handleLoadSavedDesign = (d: SavedProductDesign) => {
    pushHistory(`Load "${d.name}"`);
    const col = product.colors.find((c) => c.name === d.colorName);
    if (col) onSelectColor(col);
    onQuantityChange(d.quantity);
    onSelectPrintMethod(d.printMethod);
    if (d.variantLabel && onSelectVariantLabel) onSelectVariantLabel(d.variantLabel);
    setFrontPlacement(d.frontPlacement);
    setBackPlacement(d.backPlacement);
    setNoBackPrint(d.noBackPrint);
    setArtworkApproved(d.artworkApproved);
    setFrontLayers(d.frontLayers);
    setBackLayers(d.backLayers);
    setFrontCleanup(d.frontCleanup);
    setBackCleanup(d.backCleanup);
    setBackUsesSameLogoAsFront(d.backUsesSameLogo);
    if (d.uploadedFrontLogoName) setFrontFileName(d.uploadedFrontLogoName);
    if (d.uploadedBackLogoName) setBackFileName(d.uploadedBackLogoName);
    showToast(`Loaded "${d.name}"`);
  };

  const handleDownloadPreview = async () => {
    const png = await renderStudioSvgToPngDataUrl(svgRef.current, 1200);
    if (!png) return;
    const link = document.createElement('a');
    link.href = png;
    link.download = `${product.slug || product.id}-${activeSide}-preview.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded high-res PNG preview');
  };

  const handleShareDesign = async () => {
    const url = buildProductShareLink({
      slug: product.slug || product.id,
      colorName: selectedColor.name,
      printMethod: selectedPrintMethod,
      quantity,
      frontPlacement,
    });
    const ok = await copyToClipboardSafe(url);
    showToast(ok ? 'Share link copied to clipboard!' : 'Share URL ready in address bar');
  };

  const handleResetToDefault = () => {
    pushHistory('Reset to starter design');
    setFrontPlacement(meta.defaultFrontPlacement);
    setBackPlacement(meta.defaultBackPlacement);
    setNoBackPrint(false);
    setFrontRawLogo(starterLogoUrl);
    setBackRawLogo(starterLogoUrl);
    setFrontCleanup({ ...DEFAULT_LOGO_CLEANUP });
    setBackCleanup({ ...DEFAULT_LOGO_CLEANUP });
    setFrontLayers(
      buildInitialProductLayers(
        null,
        product.productType,
        'front',
        meta.defaultFrontPlacement,
        poloYCalib,
        frontSurfaceHex,
        rasterizePresetToDataUrl
      )
    );
    setBackLayers([]);
    setSelectedLayerId(null);
    setConfirmReset(false);
    showToast('Design reset to studio defaults');
  };

  const buildPayload = (): ProductModalCommitPayload => {
    const fArt = layersToArtwork(frontLayers, 'front', frontPlacement);
    const bArt =
      !meta.hasBackSide || noBackPrint ? null : layersToArtwork(backLayers, 'back', backPlacement);
    return {
      frontArtwork: fArt,
      backArtwork: bArt,
      frontPlacement,
      backPlacement: noBackPrint ? 'No back print' : backPlacement,
      uploadedFrontLogoName: frontFileName,
      uploadedBackLogoName: backFileName,
      artworkStatus: artworkApproved
        ? 'approved'
        : fArt || bArt
        ? 'uploaded'
        : 'awaiting_review',
      selectedColor,
      selectedPrintMethod,
      quantity,
      sizeDistribution,
      selectedVariantLabel,
    };
  };

  const handleApplyAndReturn = () => {
    onCommitStudioChanges(buildPayload());
    onClose();
  };

  const handleDirectCartClick = async () => {
    const payload = buildPayload();
    if (onDirectAddToCart) {
      setIsAddingToCart(true);
      try {
        await onDirectAddToCart(payload);
        showToast('Added customized product to cart!');
      } finally {
        setTimeout(() => setIsAddingToCart(false), 1400);
      }
    } else {
      onCommitStudioChanges(payload);
      onClose();
    }
  };

  // Auto-fill size mix
  const handleAutoFillSizes = () => {
    if (!onSizeDistributionChange || !product.sizes) return;
    const weights: Record<string, number> = { S: 0.12, M: 0.28, L: 0.3, XL: 0.18, '2XL': 0.08, '3XL': 0.04, '4XL': 0 };
    const next: Record<string, number> = {};
    let rem = quantity;
    product.sizes.forEach((sz, idx) => {
      const key = sz.split(' ')[0];
      if (idx === product.sizes!.length - 1) {
        next[sz] = Math.max(0, rem);
      } else {
        const alloc = Math.floor(quantity * (weights[key] ?? 0.15));
        next[sz] = alloc;
        rem -= alloc;
      }
    });
    onSizeDistributionChange(next);
  };

  // Photographic Image Asset Resolution
  const poloImages = isPoloOrTshirt
    ? product.id === 'prod-joab-coolmax'
      ? getJoabCoolmaxImages(selectedColor.name, baseHex)
      : product.id === 'prod-matty-polo'
      ? getMattyPoloImages(selectedColor.name, baseHex)
      : selectedColor.tippingHex
      ? getTippingPoloImages(selectedColor.name, baseHex)
      : getPlainPoloImages(selectedColor.name, baseHex)
    : null;
  const poloPhotoUrl = isPoloOrTshirt
    ? activeSide === 'back'
      ? selectedColor.imageBack || poloImages?.back
      : selectedColor.imageFront || poloImages?.front
    : undefined;
  const capImages = isCap ? getCapImages(selectedColor.name, baseHex) : null;
  const capPhotoUrl = isCap ? selectedColor.imageFront || capImages?.front : undefined;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 h-[100dvh] w-screen bg-[#F4F6FB] flex flex-col overflow-hidden select-none">
      {/* Hidden File Inputs */}
      <input
        ref={logoUploadInputRef}
        type="file"
        accept="image/*,.svg,.pdf"
        className="hidden"
        onChange={handleLogoFileSelected}
      />
      <input
        ref={extraImageInputRef}
        type="file"
        accept="image/*,.svg"
        className="hidden"
        onChange={handleUploadExtraImage}
      />

      {/* TOP NAVY BAR */}
      <header className="h-14 bg-[#071B35] text-white px-2.5 sm:px-4 flex items-center justify-between gap-2 shrink-0 border-b border-white/10">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {!isFullscreen && (
            <button
              type="button"
              onClick={() => setIsLeftSidebarOpen((o) => !o)}
              className="hidden lg:flex w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 items-center justify-center text-slate-200 cursor-pointer shrink-0"
              title={isLeftSidebarOpen ? 'Collapse Toolkit' : 'Expand Toolkit'}
            >
              {isLeftSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>
          )}

          <div className="w-8 h-8 rounded-lg bg-[#FF7900] text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
            TW
          </div>

          <div className="min-w-0 leading-tight">
            <div className="text-xs sm:text-sm font-extrabold text-white truncate">
              {meta.studioTitle}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-300 truncate">
              {meta.hasCanopyVariants ? `${selectedVariantLabel || '4 × 4 ft'} · ` : ''}
              {selectedColor.name} · {selectedPrintMethod} · {quantity} {meta.unitLabel === 'unit' && quantity === 1 ? 'unit' : meta.unitLabel === 'unit' ? 'units' : 'pcs'}
            </div>
          </div>

          <span className="hidden xl:inline-flex items-center px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-semibold text-slate-200 border border-white/10 shrink-0">
            {meta.specBadge}
          </span>
        </div>

        {/* Right Header Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0 relative">
          {/* Validation Status Pill */}
          <button
            type="button"
            onClick={() => setIsValidationOpen((v) => !v)}
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
              warningCount > 0
                ? 'bg-amber-500/15 border-amber-400/40 text-amber-200'
                : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
            }`}
          >
            {warningCount > 0 ? (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            )}
            <span>{warningCount > 0 ? `${warningCount} Check` : 'Print Ready'}</span>
          </button>

          {isValidationOpen && (
            <div className="absolute right-0 top-12 w-80 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-3.5 z-50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-[#071B35]">Pre-Press Artwork Check</span>
                <button
                  type="button"
                  onClick={() => setIsValidationOpen(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {validationIssues.map((iss) => (
                  <div
                    key={iss.id}
                    className={`p-2 rounded-xl border text-[11px] ${
                      iss.severity === 'ok'
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-amber-50/80 border-amber-200 text-amber-900'
                    }`}
                  >
                    <div className="font-bold">{iss.title}</div>
                    <div className="text-[10px] opacity-80">{iss.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsSaveModalOpen(true)}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold cursor-pointer"
          >
            <Bookmark className="w-3.5 h-3.5 text-[#FF7900]" />
            <span className="hidden md:inline">Save</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSavedDrawerOpen(true)}
            className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-slate-200" />
            <span>Saved ({savedDesigns.length})</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveDesign(`${product.name} Variant ${savedDesigns.length + 1}`)}
            className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCompareOpen(true)}
            className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold cursor-pointer"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPreview}
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-bold cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden 2xl:inline">Download</span>
          </button>

          <button
            type="button"
            onClick={handleShareDesign}
            className="hidden xl:flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 cursor-pointer"
            title="Share Design Link"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((f) => !f)}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Preview'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Compact More Menu for Mobile/Tablet/Laptop */}
          <div className="relative xl:hidden">
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen((m) => !m)}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 flex items-center justify-center cursor-pointer"
              title="More Studio Tools"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {isMoreMenuOpen && (
              <div className="absolute right-0 top-10 w-48 bg-white text-slate-900 rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setIsSaveModalOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2 sm:hidden"
                >
                  <Bookmark className="w-3.5 h-3.5 text-[#FF7900]" />
                  <span>Save Design</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsSavedDrawerOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#071B35]" />
                  <span>Saved ({savedDesigns.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCompareOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                >
                  <GitCompare className="w-3.5 h-3.5 text-[#071B35]" />
                  <span>Compare Designs</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsHistoryDrawerOpen(true);
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                >
                  <History className="w-3.5 h-3.5 text-[#071B35]" />
                  <span>Version History</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownloadPreview();
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-[#071B35]" />
                  <span>Download PNG</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleShareDesign();
                    setIsMoreMenuOpen(false);
                  }}
                  className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#071B35]" />
                  <span>Copy Share Link</span>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleApplyAndReturn}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF7900] hover:bg-[#e56d00] text-white text-xs font-extrabold cursor-pointer shadow-xs"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.8]" />
            <span>Save & Apply</span>
          </button>

          <button
            type="button"
            onClick={handleApplyAndReturn}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
            title="Close Studio"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN STUDIO WORKSPACE */}
      <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden min-h-0 relative">
        {/* LEFT TOOLKIT SIDEBAR (Tablet & Desktop) */}
        {!isFullscreen && isLeftSidebarOpen && (
          <div className="hidden md:block h-full shrink-0">
            <ProductLeftToolkitPanel
              product={product}
              meta={meta}
              activeSide={activeSide}
              selectedColor={selectedColor}
              onSelectColor={(c) => {
                pushHistory(`Colour: ${c.name}`);
                onSelectColor(c);
              }}
              selectedVariantLabel={selectedVariantLabel}
              onSelectVariantLabel={onSelectVariantLabel}
              selectedPrintMethod={selectedPrintMethod}
              onSelectPrintMethod={(pm) => {
                pushHistory(`Method: ${pm}`);
                onSelectPrintMethod(pm);
              }}
              openSection={openSection}
              onToggleSection={(id) => setOpenSection((prev) => (prev === id ? null : id))}
              frontRawLogo={frontRawLogo}
              backRawLogo={backRawLogo}
              frontFileName={frontFileName}
              backFileName={backFileName}
              frontFileMeta={frontFileMeta}
              backFileMeta={backFileMeta}
              uploadProgress={uploadProgress}
              backUsesSameLogoAsFront={backUsesSameLogoAsFront}
              onToggleBackSync={(same) => {
                setBackUsesSameLogoAsFront(same);
                if (same && frontRawLogo) {
                  setBackRawLogo(frontRawLogo);
                  setBackFileName(frontFileName);
                  setBackFileMeta(frontFileMeta);
                }
              }}
              onTriggerLogoUpload={handleTriggerLogoUpload}
              onTriggerExtraImageUpload={() => extraImageInputRef.current?.click()}
              onRemoveMainLogo={() => {
                if (!mainLogoLayer) return;
                handleDeleteLayer(mainLogoLayer.id);
              }}
              onApplySampleLogo={(sampleId, label) => {
                pushHistory(`Sample logo: ${label}`);
                const sampleUrl = rasterizePresetToDataUrl(sampleId, label);
                if (activeSide === 'front') {
                  setFrontRawLogo(sampleUrl);
                  setFrontFileName(`${label}.svg`);
                  if (backUsesSameLogoAsFront) {
                    setBackRawLogo(sampleUrl);
                    setBackFileName(`${label}.svg`);
                  }
                } else {
                  setBackUsesSameLogoAsFront(false);
                  setBackRawLogo(sampleUrl);
                  setBackFileName(`${label}.svg`);
                }
              }}
              activeCleanup={activeCleanup}
              onUpdateCleanup={(patch) => setActiveCleanup((prev) => ({ ...prev, ...patch }))}
              activeParts={activeParts}
              onTogglePartVisibility={(partIdx) =>
                setActiveCleanup((prev) => ({
                  ...prev,
                  hiddenPartIndices: prev.hiddenPartIndices.includes(partIdx)
                    ? prev.hiddenPartIndices.filter((i) => i !== partIdx)
                    : [...prev.hiddenPartIndices, partIdx],
                }))
              }
              onOpenMagicEraser={() => setIsMagicEraserOpen(true)}
              mainLogoLayer={mainLogoLayer}
              logoSizePercent={logoSizePercent}
              onLogoSizeSlider={handleLogoSizeSlider}
              onUpdateLayer={updateLayer}
              onCenterMainLogo={handleCenterMainLogo}
              selectedLayer={selectedLayer}
              companyNameText={companyNameText}
              onChangeCompanyNameText={setCompanyNameText}
              hasCompanyNameLayer={hasCompanyNameLayer}
              onToggleCompanyName={handleToggleCompanyName}
              onAddTextLayer={handleAddTextLayer}
              onAddShapeLayer={handleAddShapeLayer}
              frontPlacement={frontPlacement}
              backPlacement={backPlacement}
              noBackPrint={noBackPrint}
              onSelectPlacement={handleSelectPlacement}
            />
          </div>
        )}

        {/* CENTER WORKSPACE */}
        <main
          ref={canvasScrollRef}
          className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#F4F6FB] md:overflow-hidden"
        >
          {/* Canvas Top Toolbar (wraps cleanly so zoom never clips on tablets/mobile) */}
          <div className="px-2.5 sm:px-4 py-2 bg-white/85 backdrop-blur-xs border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Front/Back Switch OR Single-Side Badge */}
            <div className="flex items-center gap-1.5">
              {meta.hasBackSide ? (
                <div className="inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  {(['front', 'back'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => {
                        setActiveSide(side);
                        setSelectedLayerId(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold capitalize transition-all cursor-pointer ${
                        activeSide === side
                          ? 'bg-[#071B35] text-white shadow-xs'
                          : 'text-slate-600 hover:text-[#071B35]'
                      }`}
                    >
                      {side} View
                    </button>
                  ))}
                </div>
              ) : (
                <span className="px-3 py-1.5 rounded-xl bg-[#071B35] text-white text-xs font-extrabold">
                  {meta.singleSideBadge}
                </span>
              )}

              {/* Desktop / Mobile Frame Toggle */}
              <div className="hidden lg:inline-flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCanvasFrameMode('desktop')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                    canvasFrameMode === 'desktop' ? 'bg-white text-[#071B35] shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Desktop</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCanvasFrameMode('mobile')}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                    canvasFrameMode === 'mobile' ? 'bg-white text-[#071B35] shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile</span>
                </button>
              </div>
            </div>

            {/* Canvas Tools (Guides, Layers, Undo/Redo, Zoom, Tablet Layers Trigger) */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowPrintGuides((g) => !g)}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                  showPrintGuides
                    ? 'bg-orange-50 border-orange-300 text-[#FF7900]'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <SquareDashedBottom className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Guides</span>
              </button>

              <button
                type="button"
                onClick={() => setShowLayersOnPreview((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                  showLayersOnPreview
                    ? 'bg-white border-slate-200 text-[#071B35]'
                    : 'bg-slate-800 border-slate-800 text-white'
                }`}
              >
                {showLayersOnPreview ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{showLayersOnPreview ? 'Layers On' : 'Clean'}</span>
              </button>

              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyPast.length === 0}
                  className="p-1.5 text-slate-600 hover:text-[#071B35] disabled:opacity-30 cursor-pointer"
                  title="Undo"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyFuture.length === 0}
                  className="p-1.5 text-slate-600 hover:text-[#071B35] disabled:opacity-30 cursor-pointer"
                  title="Redo"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.7, Number((z - 0.1).toFixed(2))))}
                  className="p-1.5 text-slate-600 hover:text-[#071B35] cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono font-bold text-[#071B35] px-1.5 min-w-[40px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
                  className="p-1.5 text-slate-600 hover:text-[#071B35] cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tablet Right-Drawer Button (md to <lg) */}
              {!isFullscreen && (
                <button
                  type="button"
                  onClick={() => setIsTabletRightOpen(true)}
                  className="hidden md:flex lg:hidden items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FF7900] text-white text-[11px] font-extrabold cursor-pointer"
                >
                  <span>Order & Layers</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive SVG Canvas Area */}
          <div
            onClick={() => setSelectedLayerId(null)}
            className="flex-1 flex flex-col items-center justify-center p-2.5 sm:p-4 md:overflow-auto relative"
          >
            <div
              className={`bg-white rounded-2xl border border-slate-200/90 shadow-lg overflow-hidden transition-all duration-200 ${
                canvasFrameMode === 'mobile'
                  ? 'w-[min(360px,92vw)] aspect-square'
                  : 'w-[min(480px,94vw)] md:w-[min(500px,100%)] aspect-square'
              }`}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
              }}
            >
              <ProductStageSvg
                svgRef={svgRef}
                product={product}
                selectedColor={selectedColor}
                selectedVariantLabel={selectedVariantLabel}
                activeSide={activeSide}
                activeZone={activeZone}
                activeLayers={activeLayers}
                selectedLayerId={selectedLayerId}
                showPrintGuides={showPrintGuides}
                showLayersOnPreview={showLayersOnPreview}
                poloPhotoUrl={poloPhotoUrl}
                capPhotoUrl={capPhotoUrl}
                onPointerMove={handleSvgPointerMove}
                onPointerUp={handleSvgPointerUp}
                onSelectLayer={setSelectedLayerId}
                onDoubleClickTextLayer={(l) => setInlineEditLayerId(l.id)}
                onStartLayerDrag={handleStartLayerDrag}
              />
            </div>

            {/* Inline Quick Text Edit Popover */}
            {inlineEditLayerId &&
              (() => {
                const target = activeLayers.find((l) => l.id === inlineEditLayerId);
                if (!target) return null;
                return (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 bg-white border border-orange-300 rounded-xl px-3 py-2 shadow-lg flex items-center gap-2 z-20"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={target.text || ''}
                      onChange={(e) => updateLayer(target.id, { text: e.target.value })}
                      onKeyDown={(e) => e.key === 'Enter' && setInlineEditLayerId(null)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-[#071B35]"
                    />
                    <button
                      type="button"
                      onClick={() => setInlineEditLayerId(null)}
                      className="px-2.5 py-1 rounded-lg bg-[#071B35] text-white text-xs font-bold cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                );
              })()}

            {/* Floating Layer Quick Controls Toolbar (Tablet / Desktop) */}
            <AnimatePresence>
              {selectedLayer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  onClick={(e) => e.stopPropagation()}
                  className="hidden md:flex items-center gap-1 mt-2.5 px-2.5 py-1.5 rounded-2xl bg-[#071B35] text-white shadow-xl text-[11px] font-bold z-20"
                >
                  <button
                    type="button"
                    onClick={() => updateLayer(selectedLayer.id, { x: activeZone.cx, y: activeZone.cy })}
                    className="px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer"
                  >
                    Center
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateLayer(selectedLayer.id, {
                        width: Math.max(16, selectedLayer.width * 0.9),
                        height: Math.max(14, selectedLayer.height * 0.9),
                      })
                    }
                    className="px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer"
                  >
                    − Size
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateLayer(selectedLayer.id, {
                        width: Math.min(280, selectedLayer.width * 1.1),
                        height: Math.min(280, selectedLayer.height * 1.1),
                      })
                    }
                    className="px-2 py-1 rounded-lg hover:bg-white/10 cursor-pointer"
                  >
                    + Size
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateLayer(selectedLayer.id, { rotation: (selectedLayer.rotation || 0) + 15 })
                    }
                    className="px-2 py-1 rounded-lg hover:bg-white/10 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3 text-[#FF7900]" />
                    <span>15°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDuplicateLayer(selectedLayer.id)}
                    className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                    title="Duplicate"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateLayer(selectedLayer.id, { locked: !selectedLayer.locked })}
                    className="p-1.5 rounded-lg hover:bg-white/10 cursor-pointer"
                    title={selectedLayer.locked ? 'Unlock' : 'Lock'}
                  >
                    {selectedLayer.locked ? (
                      <Lock className="w-3.5 h-3.5 text-[#FF7900]" />
                    ) : (
                      <Unlock className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteLayer(selectedLayer.id)}
                    className="p-1.5 rounded-lg hover:bg-red-500/20 text-red-300 cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom Zone Quick Bar (Tablet & Desktop) */}
          <div className="hidden md:flex items-center justify-between gap-2 px-4 py-2 bg-white border-t border-slate-200 shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
                {activeSide === 'front' ? 'ZONE:' : 'BACK ZONE:'}
              </span>
              {(activeSide === 'front' ? meta.barFrontPositions : meta.backPositions).map((pos) => {
                const active =
                  activeSide === 'front'
                    ? frontPlacement === pos.id
                    : pos.id === 'No back print'
                    ? noBackPrint
                    : !noBackPrint && backPlacement === pos.id;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => handleSelectPlacement(activeSide, pos.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 border transition-all cursor-pointer ${
                      active
                        ? 'bg-[#071B35] text-white border-[#071B35]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {pos.shortLabel}
                  </button>
                );
              })}
            </div>

            {confirmReset ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-bold text-rose-600">Reset all?</span>
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-2 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-[#071B35] flex items-center gap-1.5 shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Design</span>
              </button>
            )}
          </div>

          {/* MOBILE WORKBENCH (<md) */}
          <ProductMobileWorkbench
            product={product}
            meta={meta}
            activeSide={activeSide}
            onChangeActiveSide={(s) => {
              setActiveSide(s);
              setSelectedLayerId(null);
            }}
            selectedColor={selectedColor}
            onSelectColor={(c) => {
              pushHistory(`Colour: ${c.name}`);
              onSelectColor(c);
            }}
            selectedVariantLabel={selectedVariantLabel}
            onSelectVariantLabel={onSelectVariantLabel}
            selectedPrintMethod={selectedPrintMethod}
            onSelectPrintMethod={(pm) => {
              pushHistory(`Method: ${pm}`);
              onSelectPrintMethod(pm);
            }}
            mainLogoLayer={mainLogoLayer}
            logoSizePercent={logoSizePercent}
            onLogoSizeSlider={handleLogoSizeSlider}
            onCenterMainLogo={handleCenterMainLogo}
            onRotateMainLogoStep={(deg) =>
              mainLogoLayer && updateLayer(mainLogoLayer.id, { rotation: (mainLogoLayer.rotation || 0) + deg })
            }
            onTriggerLogoUpload={handleTriggerLogoUpload}
            onOpenMagicEraser={() => setIsMagicEraserOpen(true)}
            frontRawLogo={frontRawLogo}
            backRawLogo={backRawLogo}
            frontPlacement={frontPlacement}
            backPlacement={backPlacement}
            noBackPrint={noBackPrint}
            onSelectPlacement={handleSelectPlacement}
            activeCleanup={activeCleanup}
            onUpdateCleanup={(patch) => setActiveCleanup((prev) => ({ ...prev, ...patch }))}
            onApplySampleLogo={(id, label) => {
              pushHistory(`Sample logo: ${label}`);
              const url = rasterizePresetToDataUrl(id, label);
              if (activeSide === 'front') {
                setFrontRawLogo(url);
                setFrontFileName(`${label}.svg`);
                if (backUsesSameLogoAsFront) setBackRawLogo(url);
              } else {
                setBackUsesSameLogoAsFront(false);
                setBackRawLogo(url);
                setBackFileName(`${label}.svg`);
              }
            }}
            backUsesSameLogoAsFront={backUsesSameLogoAsFront}
            onToggleBackSync={(same) => {
              setBackUsesSameLogoAsFront(same);
              if (same && frontRawLogo) setBackRawLogo(frontRawLogo);
            }}
            onAddTextLayer={handleAddTextLayer}
            onAddShapeLayer={handleAddShapeLayer}
            selectedLayer={selectedLayer}
            onUpdateLayer={updateLayer}
            activeLayers={activeLayers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onDuplicateLayer={handleDuplicateLayer}
            onDeleteLayer={handleDeleteLayer}
            quantity={quantity}
            onChangeQuantity={onQuantityChange}
            unitPrice={pricing.unitPrice}
            totalPrice={pricing.totalPrice}
            artworkApproved={artworkApproved}
            onToggleArtworkApproved={setArtworkApproved}
            onDirectAddToCart={handleDirectCartClick}
            onApplyAndReturn={handleApplyAndReturn}
            onScrollToPreview={() => canvasScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            isAddingToCart={isAddingToCart}
          />
        </main>

        {/* RIGHT ORDER & LAYERS SIDEBAR (Desktop lg+) */}
        {!isFullscreen && (
          <div className="hidden lg:block w-[320px] xl:w-[340px] border-l border-slate-200 h-full shrink-0">
            <ProductRightOrderPanel
              product={product}
              meta={meta}
              activeSide={activeSide}
              onChangeActiveSide={(s) => {
                setActiveSide(s);
                setSelectedLayerId(null);
              }}
              frontLayers={frontLayers}
              backLayers={backLayers}
              noBackPrint={noBackPrint}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
              onRenameLayer={(id, name) => updateLayer(id, { name })}
              onToggleVisibility={(id) => {
                const target = activeLayers.find((l) => l.id === id);
                if (target) updateLayer(id, { visible: target.visible === false });
              }}
              onToggleLock={(id) => {
                const target = activeLayers.find((l) => l.id === id);
                if (target) updateLayer(id, { locked: !target.locked });
              }}
              onDuplicateLayer={handleDuplicateLayer}
              onMoveLayerOrder={handleMoveLayerOrder}
              onDeleteLayer={handleDeleteLayer}
              quantity={quantity}
              onChangeQuantity={onQuantityChange}
              unitPrice={pricing.unitPrice}
              totalPrice={pricing.totalPrice}
              nextTierUpsell={pricing.nextTierUpsell}
              sizeDistribution={sizeDistribution}
              onChangeSizeDistribution={(next) => onSizeDistributionChange?.(next)}
              onAutoFillSizes={handleAutoFillSizes}
              selectedVariantLabel={selectedVariantLabel}
              onSelectVariantLabel={onSelectVariantLabel}
              artworkApproved={artworkApproved}
              onToggleArtworkApproved={setArtworkApproved}
              onDirectAddToCart={handleDirectCartClick}
              onApplyAndReturn={handleApplyAndReturn}
              isAddingToCart={isAddingToCart}
            />
          </div>
        )}
      </div>

      {/* TABLET SLIDE-OVER ORDER & LAYERS DRAWER (md to <lg) */}
      {isTabletRightOpen && (
        <div
          className="fixed inset-0 z-[80] bg-[#071B35]/60 backdrop-blur-xs flex justify-end lg:hidden"
          onClick={() => setIsTabletRightOpen(false)}
        >
          <div
            className="w-80 max-w-[90vw] h-full bg-white shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#071B35] text-white flex items-center justify-between shrink-0">
              <span className="text-xs font-extrabold uppercase tracking-wider">Layers & Checkout</span>
              <button
                type="button"
                onClick={() => setIsTabletRightOpen(false)}
                className="p-1 rounded-lg bg-white/10 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ProductRightOrderPanel
                product={product}
                meta={meta}
                activeSide={activeSide}
                onChangeActiveSide={(s) => {
                  setActiveSide(s);
                  setSelectedLayerId(null);
                }}
                frontLayers={frontLayers}
                backLayers={backLayers}
                noBackPrint={noBackPrint}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
                onRenameLayer={(id, name) => updateLayer(id, { name })}
                onToggleVisibility={(id) => {
                  const target = activeLayers.find((l) => l.id === id);
                  if (target) updateLayer(id, { visible: target.visible === false });
                }}
                onToggleLock={(id) => {
                  const target = activeLayers.find((l) => l.id === id);
                  if (target) updateLayer(id, { locked: !target.locked });
                }}
                onDuplicateLayer={handleDuplicateLayer}
                onMoveLayerOrder={handleMoveLayerOrder}
                onDeleteLayer={handleDeleteLayer}
                quantity={quantity}
                onChangeQuantity={onQuantityChange}
                unitPrice={pricing.unitPrice}
                totalPrice={pricing.totalPrice}
                nextTierUpsell={pricing.nextTierUpsell}
                sizeDistribution={sizeDistribution}
                onChangeSizeDistribution={(next) => onSizeDistributionChange?.(next)}
                onAutoFillSizes={handleAutoFillSizes}
                selectedVariantLabel={selectedVariantLabel}
                onSelectVariantLabel={onSelectVariantLabel}
                artworkApproved={artworkApproved}
                onToggleArtworkApproved={setArtworkApproved}
                onDirectAddToCart={handleDirectCartClick}
                onApplyAndReturn={handleApplyAndReturn}
                isAddingToCart={isAddingToCart}
              />
            </div>
          </div>
        </div>
      )}

      {/* CUSTOMER FEATURE MODALS & DRAWERS */}
      <SaveProductDesignModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        studioTitle={meta.studioTitle}
        defaultName={`${product.name} · ${selectedColor.name}`}
        colorName={selectedColor.name}
        quantity={quantity}
        unitLabel={meta.unitLabel}
        printMethod={selectedPrintMethod}
        onSave={handleSaveDesign}
      />

      <SavedProductDesignsDrawer
        isOpen={isSavedDrawerOpen}
        onClose={() => setIsSavedDrawerOpen(false)}
        designs={savedDesigns}
        onLoadDesign={handleLoadSavedDesign}
        onDuplicateDesign={(d) => {
          const copy: SavedProductDesign = {
            ...d,
            id: createStudioUid('saved'),
            name: `${d.name} (Copy)`,
            updatedAt: new Date().toISOString(),
          };
          const next = [copy, ...savedDesigns];
          setSavedDesigns(next);
          persistSavedProductDesigns(product.id, next);
        }}
        onRenameDesign={(id, nextName) => {
          const next = savedDesigns.map((d) => (d.id === id ? { ...d, name: nextName } : d));
          setSavedDesigns(next);
          persistSavedProductDesigns(product.id, next);
        }}
        onDeleteDesign={(id) => {
          const next = savedDesigns.filter((d) => d.id !== id);
          setSavedDesigns(next);
          persistSavedProductDesigns(product.id, next);
        }}
      />

      <CompareProductDesignsModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        product={product}
        hasBackSide={meta.hasBackSide}
        currentColor={selectedColor}
        currentVariantLabel={selectedVariantLabel}
        currentQuantity={quantity}
        currentPrintMethod={selectedPrintMethod}
        currentFrontPlacement={frontPlacement}
        currentBackPlacement={backPlacement}
        currentNoBackPrint={noBackPrint}
        currentFrontArtwork={layersToArtwork(frontLayers, 'front', frontPlacement)}
        currentBackArtwork={noBackPrint ? null : layersToArtwork(backLayers, 'back', backPlacement)}
        savedDesigns={savedDesigns}
        layersToArtwork={layersToArtwork}
        onLoadSavedDesign={handleLoadSavedDesign}
        onSwitchColor={(c) => {
          pushHistory(`Compare switch: ${c.name}`);
          onSelectColor(c);
        }}
      />

      <ProductHistoryDrawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        versions={versionHistory}
        onRestoreVersion={(v) => {
          pushHistory(`Restored: ${v.label}`);
          applySnapshot(v.snapshot);
        }}
        onCreateCheckpoint={() => pushHistory('Manual checkpoint')}
      />

      <PlainPoloMagicEraserModal
        isOpen={isMagicEraserOpen}
        onClose={() => setIsMagicEraserOpen(false)}
        sourceDataUrl={activeSide === 'front' ? frontEraserBaseUrl : backEraserBaseUrl}
        initialActions={activeCleanup.eraserActions}
        onApplyActions={(actions: EraserAction[]) => {
          pushHistory('Magic Eraser edit');
          setActiveCleanup((prev) => ({ ...prev, eraserActions: actions }));
          showToast('Background eraser strokes applied');
        }}
      />

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-16 md:bottom-5 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl bg-[#071B35] text-white text-xs font-bold shadow-2xl border border-white/15 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-[#FF7900]" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
