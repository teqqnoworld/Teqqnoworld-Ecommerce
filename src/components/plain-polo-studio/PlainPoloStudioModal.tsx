import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { triggerCelebration } from '../../services/celebrationService';
import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Edit2,
  Eye,
  EyeOff,
  FlipHorizontal,
  FolderOpen,
  GitCompare,
  Grid,
  Image as ImageIcon,
  Layers,
  Lock,
  Maximize2,
  Minimize2,
  Monitor,
  MoreVertical,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Scissors,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  Truck,
  Type as TypeIcon,
  Undo2,
  Unlock,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CustomArtwork,
  PrintMethod,
  Product,
  ProductColor,
  StudioLayer,
  StudioShapeType,
} from '../../types';
import { getPlainPoloImages } from '../../data/plainPoloImages';
import {
  calculateProductPrice,
  formatCurrencyINR,
} from '../../data/pricingRules';
import {
  DEFAULT_LOGO_CLEANUP,
  LogoCleanupOptions,
  LogoPartItem,
  processLogoPipeline,
  rasterizePresetToDataUrl,
} from '../../utils/logoProcessor';
import { compressImageFile } from '../../utils/imageCompressor';
import { PlainPoloMagicEraserModal } from './PlainPoloMagicEraserModal';
import {
  CompareDesignsModal,
  DesignHistoryDrawer,
  SavedDesignsDrawer,
  SaveDesignModal,
} from './PlainPoloCustomerDrawers';
import {
  buildLayersFromExistingArtwork,
  buildPlainPoloShareLink,
  computePlainPoloDesignValidation,
  convertLayersToCustomArtwork,
  copyToClipboardSafe,
  createStudioUid,
  formatBytesCompact,
  getLogoLayoutOptions,
  getPlainPoloZoneCoordinates,
  loadSavedPlainPoloDesigns,
  LogoFileMeta,
  persistSavedPlainPoloDesigns,
  PLAIN_POLO_BACK_POSITIONS,
  PLAIN_POLO_FRONT_POSITIONS,
  PLAIN_POLO_PRINT_METHODS,
  PLAIN_POLO_QUICK_QUANTITIES,
  PlainPoloHistoryVersion,
  PlainPoloModalCommitPayload,
  PlainPoloSnapshotState,
  renderPdfBadgeDataUrl,
  renderStudioSvgToPngDataUrl,
  SAMPLE_CORPORATE_LOGOS,
  SavedPlainPoloDesign,
  STUDIO_FONT_FAMILIES,
  STUDIO_SHAPES,
  STUDIO_TEXT_COLORS,
} from './plainPoloStudioTypes';

export interface PlainPoloStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product;
  selectedColor: ProductColor;
  onSelectColor: (color: ProductColor) => void;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  sizeDistribution: Record<string, number>;
  onSizeDistributionChange: (dist: Record<string, number>) => void;
  frontArtwork: CustomArtwork | null;
  backArtwork: CustomArtwork | null;
  frontPlacement: string;
  backPlacement: string;
  selectedPrintMethod: PrintMethod;
  onSelectPrintMethod: (method: PrintMethod) => void;
  uploadedFrontLogoName: string;
  uploadedBackLogoName: string;
  initialArtworkApproved?: boolean;
  initialActiveSide?: 'front' | 'back';
  onCommitStudioChanges: (payload: PlainPoloModalCommitPayload) => void;
  onDirectAddToCart?: (payload: PlainPoloModalCommitPayload) => void;
}

type LeftAccordionSection =
  | 'product'
  | 'upload'
  | 'text'
  | 'quick'
  | 'print'
  | 'settings';

type MobileSectionId = 'upload' | 'product' | 'text' | 'layers' | 'price';

function cloneLayers(layers: StudioLayer[]): StudioLayer[] {
  return layers.map((l) => ({ ...l }));
}

export const PlainPoloStudioModal: React.FC<PlainPoloStudioModalProps> = ({
  isOpen,
  onClose,
  product,
  selectedColor,
  onSelectColor,
  quantity,
  onQuantityChange,
  sizeDistribution,
  onSizeDistributionChange,
  frontArtwork,
  backArtwork,
  frontPlacement: initialFrontPlacement,
  backPlacement: initialBackPlacement,
  selectedPrintMethod,
  onSelectPrintMethod,
  uploadedFrontLogoName: initialFrontLogoName,
  uploadedBackLogoName: initialBackLogoName,
  initialArtworkApproved = false,
  initialActiveSide = 'front',
  onCommitStudioChanges,
  onDirectAddToCart,
}) => {
  // Core studio workspace view states
  const [activeSide, setActiveSide] = useState<'front' | 'back'>(initialActiveSide);
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [openSection, setOpenSection] = useState<LeftAccordionSection>('upload');
  const [activeMobileSection, setActiveMobileSection] = useState<MobileSectionId>('upload');
  const [tabletRightOpen, setTabletRightOpen] = useState(false);

  const [previewFrameMode, setPreviewFrameMode] = useState<'desktop' | 'mobile'>('desktop');
  const [zoomPercent, setZoomPercent] = useState<number>(100);
  const [showPrintArea, setShowPrintArea] = useState<boolean>(true);
  const [showLayersOverlay, setShowLayersOverlay] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Placements & no back print state
  const [frontPlacement, setFrontPlacement] = useState<string>(initialFrontPlacement || 'Left Chest');
  const [backPlacement, setBackPlacement] = useState<string>(initialBackPlacement || 'Upper Back Center');
  const [noBackPrint, setNoBackPrint] = useState<boolean>(initialBackPlacement === 'No back print');

  // Logo & asset pipeline states
  const [frontRawDataUrl, setFrontRawDataUrl] = useState<string | null>(
    frontArtwork?.rawDataUrl ||
      frontArtwork?.dataUrl ||
      (frontArtwork?.type === 'preset' ? rasterizePresetToDataUrl(frontArtwork.presetId || 'your-logo') : null)
  );
  const [backRawDataUrl, setBackRawDataUrl] = useState<string | null>(
    backArtwork?.rawDataUrl || backArtwork?.dataUrl || null
  );
  const [frontProcessedUrl, setFrontProcessedUrl] = useState<string | null>(frontArtwork?.dataUrl || null);
  const [backProcessedUrl, setBackProcessedUrl] = useState<string | null>(backArtwork?.dataUrl || null);
  const [frontLogoName, setFrontLogoName] = useState<string>(initialFrontLogoName || 'Company Logo');
  const [backLogoName, setBackLogoName] = useState<string>(initialBackLogoName || '');
  const [backUsesSameLogo, setBackUsesSameLogo] = useState<boolean>(
    !backArtwork?.rawDataUrl && !initialBackLogoName
  );
  const [frontFileMeta, setFrontFileMeta] = useState<LogoFileMeta | null>(null);
  const [backFileMeta, setBackFileMeta] = useState<LogoFileMeta | null>(null);

  const [frontCleanup, setFrontCleanup] = useState<LogoCleanupOptions>({ ...DEFAULT_LOGO_CLEANUP });
  const [backCleanup, setBackCleanup] = useState<LogoCleanupOptions>({ ...DEFAULT_LOGO_CLEANUP });
  const [detectedPartsFront, setDetectedPartsFront] = useState<LogoPartItem[]>([]);
  const [detectedPartsBack, setDetectedPartsBack] = useState<LogoPartItem[]>([]);

  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);

  // Studio layers state (Front + Back)
  const [frontLayers, setFrontLayers] = useState<StudioLayer[]>(() =>
    buildLayersFromExistingArtwork(frontArtwork, 'front', initialFrontPlacement || 'Left Chest', selectedColor.name)
  );
  const [backLayers, setBackLayers] = useState<StudioLayer[]>(() =>
    buildLayersFromExistingArtwork(backArtwork, 'back', initialBackPlacement || 'Upper Back Center', selectedColor.name)
  );

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [inlineEditingLayerId, setInlineEditingLayerId] = useState<string | null>(null);
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState<string>('');
  const [layersTabSide, setLayersTabSide] = useState<'front' | 'back'>(initialActiveSide);

  // Undo / Redo + Design History Version Stack
  const undoStackRef = useRef<PlainPoloSnapshotState[]>([]);
  const redoStackRef = useRef<PlainPoloSnapshotState[]>([]);
  const [historyCounters, setHistoryCounters] = useState({ undo: 0, redo: 0 });
  const [versionHistory, setVersionHistory] = useState<PlainPoloHistoryVersion[]>([]);

  // Text builder draft inputs
  const [draftText, setDraftText] = useState('TEQQNOWORLD');
  const [draftFontFamily, setDraftFontFamily] = useState(STUDIO_FONT_FAMILIES[0].value);
  const [draftFontSize, setDraftFontSize] = useState(14);
  const [draftTextColor, setDraftTextColor] = useState('#FFFFFF');
  const [companySublineEnabled, setCompanySublineEnabled] = useState<boolean>(false);
  const [companySublineText, setCompanySublineText] = useState<string>('YOUR COMPANY');

  // Customer Feature Drawers & Modals (10 features)
  const [artworkApproved, setArtworkApproved] = useState<boolean>(initialArtworkApproved);
  const [savedDesigns, setSavedDesigns] = useState<SavedPlainPoloDesign[]>(() =>
    loadSavedPlainPoloDesigns()
  );
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSavedDrawerOpen, setIsSavedDrawerOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [isMagicEraserOpen, setIsMagicEraserOpen] = useState(false);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [headerMoreOpen, setHeaderMoreOpen] = useState(false);
  const [showSizeMatrix, setShowSizeMatrix] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);

  // Refs
  const mainScrollRef = useRef<HTMLElement | null>(null);
  const stageRootRef = useRef<HTMLDivElement | null>(null);
  const svgStageRef = useRef<SVGSVGElement | null>(null);
  const frontFileInputRef = useRef<HTMLInputElement | null>(null);
  const backFileInputRef = useRef<HTMLInputElement | null>(null);
  const initialSnapshotRef = useRef<PlainPoloSnapshotState | null>(null);

  // Drag / Resize / Rotate interactive ref
  const dragStateRef = useRef<{
    layerId: string;
    mode: 'move' | 'resize' | 'rotate';
    corner?: 'nw' | 'ne' | 'se' | 'sw';
    startSvgX: number;
    startSvgY: number;
    origLayer: StudioLayer;
  } | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMsg(message);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === message ? null : prev));
    }, 3200);
  }, []);

  // Lock background PDP page scroll while Studio modal is open
  useEffect(() => {
    if (!isOpen) return;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [isOpen]);

  const scrollMobileToSection = useCallback((section: MobileSectionId | 'top') => {
    const container = mainScrollRef.current;
    if (!container) return;
    if (section === 'top') {
      container.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setActiveMobileSection(section);
    const target = document.getElementById(`polo-mob-${section}`);
    if (target) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - 56;
      container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    }
  }, []);

  // Capture clean initial baseline for "Reset to Original"
  useEffect(() => {
    if (isOpen && !initialSnapshotRef.current) {
      initialSnapshotRef.current = {
        frontLayers: cloneLayers(frontLayers),
        backLayers: cloneLayers(backLayers),
        frontPlacement,
        backPlacement,
        selectedColorName: selectedColor.name,
        printMethod: selectedPrintMethod,
        noBackPrint,
      };
    }
  }, [isOpen]);

  // Keep layers panel side synced when user toggles main canvas side
  useEffect(() => {
    setLayersTabSide(activeSide);
  }, [activeSide]);

  // Snapshot helpers
  const buildSnapshot = useCallback(
    (): PlainPoloSnapshotState => ({
      frontLayers: cloneLayers(frontLayers),
      backLayers: cloneLayers(backLayers),
      frontPlacement,
      backPlacement,
      selectedColorName: selectedColor.name,
      printMethod: selectedPrintMethod,
      noBackPrint,
    }),
    [frontLayers, backLayers, frontPlacement, backPlacement, selectedColor.name, selectedPrintMethod, noBackPrint]
  );

  const pushUndoSnapshot = useCallback(
    (label?: string) => {
      const snap = buildSnapshot();
      undoStackRef.current.push(snap);
      if (undoStackRef.current.length > 40) undoStackRef.current.shift();
      redoStackRef.current = [];
      setHistoryCounters({
        undo: undoStackRef.current.length,
        redo: 0,
      });
      if (label) {
        setVersionHistory((prev) => [
          {
            id: createStudioUid('ver'),
            label,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            snapshot: snap,
          },
          ...prev.slice(0, 19),
        ]);
      }
    },
    [buildSnapshot]
  );

  const applySnapshot = useCallback(
    (snap: PlainPoloSnapshotState) => {
      setFrontLayers(cloneLayers(snap.frontLayers));
      setBackLayers(cloneLayers(snap.backLayers));
      setFrontPlacement(snap.frontPlacement);
      setBackPlacement(snap.backPlacement);
      setNoBackPrint(snap.noBackPrint);
      onSelectPrintMethod(snap.printMethod);
      const matchedColor = product.colors.find((c) => c.name === snap.selectedColorName);
      if (matchedColor) onSelectColor(matchedColor);
    },
    [onSelectColor, onSelectPrintMethod, product.colors]
  );

  const handleUndo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(buildSnapshot());
    applySnapshot(prev);
    setHistoryCounters({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    });
  }, [applySnapshot, buildSnapshot]);

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(buildSnapshot());
    applySnapshot(next);
    setHistoryCounters({
      undo: undoStackRef.current.length,
      redo: redoStackRef.current.length,
    });
  }, [applySnapshot, buildSnapshot]);

  // Keyboard shortcuts (Ctrl/Cmd + Z / Ctrl+Shift+Z / Delete / Escape)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key === 'Delete' && selectedLayerId) {
        const list = activeSide === 'front' ? frontLayers : backLayers;
        const found = list.find((l) => l.id === selectedLayerId);
        if (found && !found.locked) {
          pushUndoSnapshot(`Removed ${found.name || 'layer'}`);
          if (activeSide === 'front') {
            setFrontLayers((prev) => prev.filter((l) => l.id !== selectedLayerId));
          } else {
            setBackLayers((prev) => prev.filter((l) => l.id !== selectedLayerId));
          }
          setSelectedLayerId(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleUndo, handleRedo, selectedLayerId, activeSide, frontLayers, backLayers, pushUndoSnapshot]);

  // Run logo segmentation & cleanup pipeline whenever Front raw/cleanup changes
  useEffect(() => {
    let cancelled = false;
    if (!frontRawDataUrl) return;
    (async () => {
      try {
        const res = await processLogoPipeline(
          frontRawDataUrl,
          frontCleanup,
          selectedColor.garmentHex || selectedColor.hex
        );
        if (cancelled) return;
        setDetectedPartsFront(res.parts || []);
        setFrontProcessedUrl(res.processedDataUrl);
        setFrontLayers((prev) =>
          prev.map((l) => (l.isMainLogo ? { ...l, dataUrl: res.processedDataUrl } : l))
        );
        if (backUsesSameLogo && !noBackPrint) {
          setBackProcessedUrl(res.processedDataUrl);
          setBackLayers((prev) =>
            prev.map((l) => (l.isMainLogo ? { ...l, dataUrl: res.processedDataUrl } : l))
          );
        }
      } catch (err) {
        console.warn('[PlainPoloStudio] Front pipeline error:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [frontRawDataUrl, frontCleanup, selectedColor.garmentHex, selectedColor.hex, backUsesSameLogo, noBackPrint]);

  // Run Back pipeline when Back uses independent logo
  useEffect(() => {
    let cancelled = false;
    const effectiveRaw = backUsesSameLogo ? frontRawDataUrl : backRawDataUrl;
    if (!effectiveRaw || backUsesSameLogo) return;
    (async () => {
      try {
        const res = await processLogoPipeline(
          effectiveRaw,
          backCleanup,
          selectedColor.garmentHex || selectedColor.hex
        );
        if (cancelled) return;
        setDetectedPartsBack(res.parts || []);
        setBackProcessedUrl(res.processedDataUrl);
        setBackLayers((prev) =>
          prev.map((l) => (l.isMainLogo ? { ...l, dataUrl: res.processedDataUrl } : l))
        );
      } catch (err) {
        console.warn('[PlainPoloStudio] Back pipeline error:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backRawDataUrl, backCleanup, backUsesSameLogo, frontRawDataUrl, selectedColor.garmentHex, selectedColor.hex]);

  // Sync company subline below main logo on active side when toggled
  useEffect(() => {
    const targetSetter = activeSide === 'front' ? setFrontLayers : setBackLayers;
    targetSetter((prev) => {
      const subId = `company-subline-${activeSide}`;
      const existingIdx = prev.findIndex((l) => l.id === subId);
      if (!companySublineEnabled) {
        return existingIdx >= 0 ? prev.filter((l) => l.id !== subId) : prev;
      }
      const mainLogo = prev.find((l) => l.isMainLogo) || prev.find((l) => l.kind === 'logo');
      const zone = getPlainPoloZoneCoordinates(
        activeSide,
        activeSide === 'front' ? frontPlacement : backPlacement,
        selectedColor.name
      );
      const anchorX = mainLogo ? mainLogo.x : zone.cx;
      const anchorY = mainLogo ? mainLogo.y + mainLogo.height / 2 + 12 : zone.cy + 28;
      const nextSubLayer: StudioLayer = {
        id: subId,
        kind: 'text',
        name: 'Company Name Subline',
        x: anchorX,
        y: anchorY,
        width: 110,
        height: 20,
        rotation: 0,
        opacity: 1,
        visible: true,
        text: companySublineText || 'YOUR COMPANY',
        fontSize: 10,
        fontFamily: 'Space Grotesk, sans-serif',
        fontWeight: '800',
        fontStyle: 'normal',
        textTransform: 'uppercase',
        textAlign: 'center',
        textColor: draftTextColor,
        letterSpacing: 1.2,
      };
      if (existingIdx >= 0) {
        const clone = [...prev];
        clone[existingIdx] = { ...clone[existingIdx], text: nextSubLayer.text };
        return clone;
      }
      return [...prev, nextSubLayer];
    });
  }, [companySublineEnabled, companySublineText, activeSide, frontPlacement, backPlacement, selectedColor.name, draftTextColor]);

  // Derived active variables
  const activeLayers = activeSide === 'front' ? frontLayers : noBackPrint ? [] : backLayers;
  const setActiveLayers = activeSide === 'front' ? setFrontLayers : setBackLayers;
  const activeCleanup = activeSide === 'front' || backUsesSameLogo ? frontCleanup : backCleanup;
  const setActiveCleanup = activeSide === 'front' || backUsesSameLogo ? setFrontCleanup : setBackCleanup;
  const activeParts = activeSide === 'front' || backUsesSameLogo ? detectedPartsFront : detectedPartsBack;
  const activeRawUrl = activeSide === 'front' || backUsesSameLogo ? frontRawDataUrl : backRawDataUrl;

  const selectedLayer = useMemo(
    () => activeLayers.find((l) => l.id === selectedLayerId) || null,
    [activeLayers, selectedLayerId]
  );

  const mainLogoLayer = useMemo(
    () => activeLayers.find((l) => l.isMainLogo) || activeLayers.find((l) => l.kind === 'logo') || null,
    [activeLayers]
  );

  const poloPhotos = useMemo(() => {
    if (selectedColor.imageFront && selectedColor.imageBack) {
      return { front: selectedColor.imageFront, back: selectedColor.imageBack };
    }
    return getPlainPoloImages(selectedColor.name, selectedColor.hex || selectedColor.garmentHex);
  }, [selectedColor]);

  const activePlacement = activeSide === 'front' ? frontPlacement : backPlacement;
  const activeZone = useMemo(
    () => getPlainPoloZoneCoordinates(activeSide, activePlacement, selectedColor.name),
    [activeSide, activePlacement, selectedColor.name]
  );

  // Pricing calculations strictly from src/data/pricingRules.ts
  const livePricing = useMemo(() => calculateProductPrice('prod-plain-polo', quantity), [quantity]);
  const baseUnitRate = livePricing.slabs[0]?.pricePerUnit || 700;
  const discountPercent = Math.max(
    0,
    Math.round(((baseUnitRate - livePricing.unitPrice) / baseUnitRate) * 100)
  );
  const nextTierUpsell = useMemo(() => {
    if (!livePricing.nextTierUpsell) return null;
    return {
      minQty: livePricing.nextTierUpsell.minQty,
      diff: livePricing.nextTierUpsell.diff,
      pricePerUnit: livePricing.nextTierUpsell.price,
      savingsPerPiece: livePricing.nextTierUpsell.savingsPerPiece,
    };
  }, [livePricing]);

  // Design validation diagnostics
  const validationIssues = useMemo(
    () =>
      computePlainPoloDesignValidation({
        frontLayers,
        backLayers,
        noBackPrint,
        frontMeta: frontFileMeta,
        backMeta: backFileMeta,
        printMethod: selectedPrintMethod,
        artworkApproved,
      }),
    [frontLayers, backLayers, noBackPrint, frontFileMeta, backFileMeta, selectedPrintMethod, artworkApproved]
  );
  const validationWarningCount = validationIssues.filter((i) => i.severity !== 'ok').length;

  // Quick position placement handler (Front or Back)
  const applyQuickPosition = (side: 'front' | 'back', posId: string) => {
    pushUndoSnapshot(`Moved ${side} to ${posId}`);
    if (side === 'back' && posId === 'No back print') {
      setNoBackPrint(true);
      setBackPlacement('No back print');
      setActiveSide('back');
      setSelectedLayerId(null);
      showToast('Back printing turned off — clean solid back');
      return;
    }

    if (side === 'front') {
      setFrontPlacement(posId);
      setActiveSide('front');
      const zone = getPlainPoloZoneCoordinates('front', posId, selectedColor.name);
      setFrontLayers((prev) =>
        prev.map((l) => {
          if (!l.isMainLogo && l.kind !== 'logo') return l;
          return {
            ...l,
            x: zone.cx,
            y: zone.cy,
            width: zone.boxSize,
            height: zone.boxSize,
          };
        })
      );
    } else {
      setNoBackPrint(false);
      setBackPlacement(posId);
      setActiveSide('back');
      const zone = getPlainPoloZoneCoordinates('back', posId, selectedColor.name);
      setBackLayers((prev) => {
        if (prev.length === 0 && (frontRawDataUrl || backRawDataUrl)) {
          const src = backUsesSameLogo ? frontProcessedUrl || frontRawDataUrl : backProcessedUrl || backRawDataUrl;
          if (src) {
            return [
              {
                id: createStudioUid('logo'),
                kind: 'logo',
                name: 'Back Logo',
                isMainLogo: true,
                x: zone.cx,
                y: zone.cy,
                width: zone.boxSize,
                height: zone.boxSize,
                rotation: 0,
                opacity: 1,
                visible: true,
                dataUrl: src,
              },
            ];
          }
        }
        return prev.map((l) => {
          if (!l.isMainLogo && l.kind !== 'logo') return l;
          return {
            ...l,
            x: zone.cx,
            y: zone.cy,
            width: zone.boxSize,
            height: zone.boxSize,
          };
        });
      });
    }
  };

  // Logo Upload Handler (PNG, JPG, SVG, PDF with progress indicator + natural resolution detection)
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetSide: 'front' | 'back') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isPdf = file.type === 'application/pdf' || ext === 'pdf';
    const isSvg = file.type === 'image/svg+xml' || ext === 'svg';

    if (file.size > 15 * 1024 * 1024) {
      showToast('File exceeds 15 MB limit. Please upload a smaller artwork file.');
      return;
    }

    setUploadNotice(null);
    setUploadProgress(18);
    pushUndoSnapshot(`Uploaded ${targetSide} logo`);

    try {
      let finalDataUrl = '';
      let naturalW = 0;
      let naturalH = 0;

      if (isPdf) {
        setUploadProgress(55);
        finalDataUrl = await renderPdfBadgeDataUrl(file.name);
        naturalW = 1200;
        naturalH = 900;
        setUploadProgress(92);
      } else if (isSvg) {
        setUploadProgress(48);
        finalDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        naturalW = 1000;
        naturalH = 1000;
        setUploadProgress(90);
      } else {
        setUploadProgress(42);
        const compressed = await compressImageFile(file, {
          maxWidth: 1400,
          maxHeight: 1400,
          quality: 0.92,
        });
        finalDataUrl = compressed.dataUrl;
        naturalW = compressed.width;
        naturalH = compressed.height;
        setUploadProgress(84);
        if (!naturalW || !naturalH) {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              naturalW = img.naturalWidth || img.width;
              naturalH = img.naturalHeight || img.height;
              resolve();
            };
            img.onerror = () => resolve();
            img.src = compressed.dataUrl;
          });
        }
      }

      const meta: LogoFileMeta = {
        fileName: file.name,
        fileSizeBytes: file.size,
        mimeType: file.type || ext,
        naturalWidth: naturalW,
        naturalHeight: naturalH,
        isPdf,
        isVector: isSvg,
      };

      const zone = getPlainPoloZoneCoordinates(
        targetSide,
        targetSide === 'front' ? frontPlacement : backPlacement,
        selectedColor.name
      );

      const newLogoLayer: StudioLayer = {
        id: createStudioUid('logo'),
        kind: 'logo',
        name: file.name.replace(/\.[^.]+$/, '').slice(0, 22) || 'Company Logo',
        isMainLogo: true,
        x: zone.cx,
        y: zone.cy,
        width: zone.boxSize,
        height: zone.boxSize,
        rotation: 0,
        opacity: 1,
        visible: true,
        dataUrl: finalDataUrl,
      };

      if (targetSide === 'front') {
        setFrontFileMeta(meta);
        setFrontLogoName(file.name);
        setFrontRawDataUrl(finalDataUrl);
        setFrontLayers((prev) => {
          const nonMain = prev.filter((l) => !l.isMainLogo);
          return [newLogoLayer, ...nonMain];
        });
        if (backUsesSameLogo && !noBackPrint) {
          setBackLayers((prev) => {
            const backZone = getPlainPoloZoneCoordinates('back', backPlacement, selectedColor.name);
            const nonMain = prev.filter((l) => !l.isMainLogo);
            return [{ ...newLogoLayer, id: createStudioUid('logo'), x: backZone.cx, y: backZone.cy, width: backZone.boxSize, height: backZone.boxSize }, ...nonMain];
          });
        }
      } else {
        setBackUsesSameLogo(false);
        setNoBackPrint(false);
        if (backPlacement === 'No back print') setBackPlacement('Upper Back Center');
        setBackFileMeta(meta);
        setBackLogoName(file.name);
        setBackRawDataUrl(finalDataUrl);
        setBackLayers((prev) => {
          const nonMain = prev.filter((l) => !l.isMainLogo);
          return [newLogoLayer, ...nonMain];
        });
      }

      setActiveSide(targetSide);
      setSelectedLayerId(newLogoLayer.id);
      setUploadProgress(100);
      setUploadNotice(
        naturalW > 0 && naturalW < 400
          ? `Low resolution (${naturalW}×${naturalH}px) — higher resolution recommended`
          : `Uploaded ${file.name} cleanly`
      );
      window.setTimeout(() => setUploadProgress(null), 700);
    } catch (err) {
      console.error('[PlainPoloStudio] Logo upload failed:', err);
      setUploadProgress(null);
      setUploadNotice('Could not read file. Try a standard PNG, JPG, SVG, or PDF.');
    }
  };

  const handleApplySamplePresetLogo = (presetId: string, label: string) => {
    pushUndoSnapshot(`Applied sample logo: ${label}`);
    const dataUrl = rasterizePresetToDataUrl(presetId, label);
    const zone = getPlainPoloZoneCoordinates(activeSide, activePlacement, selectedColor.name);
    const layer: StudioLayer = {
      id: createStudioUid('logo'),
      kind: 'logo',
      name: `${label} Crest`,
      isMainLogo: true,
      x: zone.cx,
      y: zone.cy,
      width: zone.boxSize,
      height: zone.boxSize,
      rotation: 0,
      opacity: 1,
      visible: true,
      dataUrl,
    };

    if (activeSide === 'front') {
      setFrontLogoName(`${label}.png`);
      setFrontFileMeta({ fileName: `${label}.png`, fileSizeBytes: 24000, mimeType: 'image/png', naturalWidth: 960, naturalHeight: 960 });
      setFrontRawDataUrl(dataUrl);
      setFrontLayers((prev) => [layer, ...prev.filter((l) => !l.isMainLogo)]);
      if (backUsesSameLogo && !noBackPrint) {
        const bZone = getPlainPoloZoneCoordinates('back', backPlacement, selectedColor.name);
        setBackLayers((prev) => [
          { ...layer, id: createStudioUid('logo'), x: bZone.cx, y: bZone.cy, width: bZone.boxSize, height: bZone.boxSize },
          ...prev.filter((l) => !l.isMainLogo),
        ]);
      }
    } else {
      setBackUsesSameLogo(false);
      setNoBackPrint(false);
      setBackLogoName(`${label}.png`);
      setBackFileMeta({ fileName: `${label}.png`, fileSizeBytes: 24000, mimeType: 'image/png', naturalWidth: 960, naturalHeight: 960 });
      setBackRawDataUrl(dataUrl);
      setBackLayers((prev) => [layer, ...prev.filter((l) => !l.isMainLogo)]);
    }
    setSelectedLayerId(layer.id);
    showToast(`Applied "${label}" corporate emblem`);
  };

  // Text & Shape creation
  const handleAddTextLayer = (curved: boolean) => {
    const cleanText = draftText.trim() || 'COMPANY NAME';
    pushUndoSnapshot(curved ? 'Added curved text' : 'Added custom text');
    if (activeSide === 'back' && noBackPrint) {
      setNoBackPrint(false);
      setBackPlacement('Upper Back Center');
    }
    const zone = getPlainPoloZoneCoordinates(activeSide, activePlacement, selectedColor.name);
    const layer: StudioLayer = {
      id: createStudioUid('text'),
      kind: curved ? 'curved-text' : 'text',
      name: cleanText.slice(0, 22),
      x: zone.cx,
      y: zone.cy + (mainLogoLayer ? Math.round(mainLogoLayer.height / 2 + 16) : 0),
      width: Math.max(96, cleanText.length * 9),
      height: curved ? 38 : 26,
      rotation: 0,
      opacity: 1,
      visible: true,
      text: cleanText,
      fontSize: draftFontSize,
      fontFamily: draftFontFamily,
      fontWeight: '700',
      fontStyle: 'normal',
      textTransform: 'none',
      textAlign: 'center',
      textColor: draftTextColor,
      letterSpacing: 0.8,
      curve: curved ? 36 : 0,
    };
    setActiveLayers((prev) => [...prev, layer]);
    setSelectedLayerId(layer.id);
  };

  const handleAddShapeLayer = (shapeType: StudioShapeType) => {
    pushUndoSnapshot(`Added shape: ${shapeType}`);
    if (activeSide === 'back' && noBackPrint) {
      setNoBackPrint(false);
      setBackPlacement('Upper Back Center');
    }
    const zone = getPlainPoloZoneCoordinates(activeSide, activePlacement, selectedColor.name);
    const layer: StudioLayer = {
      id: createStudioUid('shape'),
      kind: 'shape',
      name: `Shape · ${shapeType}`,
      shapeType,
      x: zone.cx,
      y: zone.cy,
      width: shapeType === 'line' ? 96 : 52,
      height: shapeType === 'line' ? 5 : 52,
      rotation: 0,
      opacity: 0.9,
      visible: true,
      fillColor: '#FF7900',
      strokeColor: '#FFFFFF',
      strokeWidth: shapeType === 'ring' ? 4 : 0,
      borderRadius: 6,
    };
    setActiveLayers((prev) => [layer, ...prev]);
    setSelectedLayerId(layer.id);
  };

  // Interactive SVG Pointer Drag / Resize / Rotate
  const toSvgCoords = (clientX: number, clientY: number) => {
    const svg = svgStageRef.current;
    if (!svg) return { x: 250, y: 250 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * 500,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * 500,
    };
  };

  const startLayerDrag = (
    e: React.PointerEvent,
    layer: StudioLayer,
    mode: 'move' | 'resize' | 'rotate',
    corner?: 'nw' | 'ne' | 'se' | 'sw'
  ) => {
    e.stopPropagation();
    setSelectedLayerId(layer.id);
    if (layer.locked) {
      showToast('Layer is locked — unlock it in the Layers panel to edit');
      return;
    }
    pushUndoSnapshot();
    const pt = toSvgCoords(e.clientX, e.clientY);
    dragStateRef.current = {
      layerId: layer.id,
      mode,
      corner,
      startSvgX: pt.x,
      startSvgY: pt.y,
      origLayer: { ...layer },
    };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };

  const handleStagePointerMove = (e: React.PointerEvent) => {
    const st = dragStateRef.current;
    if (!st) return;
    const pt = toSvgCoords(e.clientX, e.clientY);
    const dx = pt.x - st.startSvgX;
    const dy = pt.y - st.startSvgY;

    setActiveLayers((prev) =>
      prev.map((l) => {
        if (l.id !== st.layerId) return l;
        if (st.mode === 'move') {
          let nextX = Math.max(85, Math.min(415, st.origLayer.x + dx));
          // Subtle center magnet snap
          if (Math.abs(nextX - 250) < 4) nextX = 250;
          const nextY = Math.max(70, Math.min(440, st.origLayer.y + dy));
          return { ...l, x: Number(nextX.toFixed(1)), y: Number(nextY.toFixed(1)) };
        }
        if (st.mode === 'resize') {
          const signX = st.corner === 'nw' || st.corner === 'sw' ? -1 : 1;
          const signY = st.corner === 'nw' || st.corner === 'ne' ? -1 : 1;
          const delta = Math.abs(dx) > Math.abs(dy) ? dx * signX : dy * signY;
          const nextW = Math.max(18, Math.min(260, st.origLayer.width + delta * 1.4));
          const ratio = st.origLayer.height / Math.max(1, st.origLayer.width);
          const nextH = Math.max(8, Math.min(260, nextW * ratio));
          return { ...l, width: Number(nextW.toFixed(1)), height: Number(nextH.toFixed(1)) };
        }
        // Rotate around layer center
        const angle =
          (Math.atan2(pt.y - st.origLayer.y, pt.x - st.origLayer.x) * 180) / Math.PI + 90;
        const normalized = Math.round(((angle + 180) % 360 + 360) % 360 - 180);
        return { ...l, rotation: normalized };
      })
    );
  };

  const handleStagePointerUp = () => {
    dragStateRef.current = null;
  };

  const updateSelectedLayer = (patch: Partial<StudioLayer>) => {
    if (!selectedLayerId) return;
    setActiveLayers((prev) =>
      prev.map((l) => {
        if (l.id !== selectedLayerId) return l;
        if (l.locked) return l;
        return { ...l, ...patch };
      })
    );
  };

  // Layer list management helpers
  const targetLayerList = layersTabSide === 'front' ? frontLayers : noBackPrint ? [] : backLayers;
  const setTargetLayerList = layersTabSide === 'front' ? setFrontLayers : setBackLayers;

  const handleDuplicateLayer = (layer: StudioLayer) => {
    pushUndoSnapshot(`Duplicated ${layer.name || 'layer'}`);
    const clone: StudioLayer = {
      ...layer,
      id: createStudioUid(layer.kind),
      isMainLogo: false,
      locked: false,
      name: `${layer.name || 'Layer'} Copy`,
      x: Math.min(390, layer.x + 14),
      y: Math.min(420, layer.y + 14),
    };
    setTargetLayerList((prev) => [...prev, clone]);
    setSelectedLayerId(clone.id);
  };

  const handleMoveLayerOrder = (index: number, dir: -1 | 1) => {
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= targetLayerList.length) return;
    pushUndoSnapshot('Reordered layers');
    setTargetLayerList((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, moved);
      return copy;
    });
  };

  // Customer 10 Feature Actions
  const handleSaveDesignSubmit = async (designName: string) => {
    const thumb = await renderStudioSvgToPngDataUrl(svgStageRef.current, 320, '#F4F6F9');
    const newSaved: SavedPlainPoloDesign = {
      id: createStudioUid('design'),
      name: designName,
      updatedAt: new Date().toISOString(),
      colorName: selectedColor.name,
      colorHex: selectedColor.garmentHex || selectedColor.hex,
      quantity,
      printMethod: selectedPrintMethod,
      frontPlacement,
      backPlacement,
      noBackPrint,
      artworkApproved,
      frontLayers: cloneLayers(frontLayers),
      backLayers: cloneLayers(backLayers),
      frontCleanup: { ...frontCleanup },
      backCleanup: { ...backCleanup },
      backUsesSameLogo,
      uploadedFrontLogoName: frontLogoName,
      uploadedBackLogoName: backLogoName,
      thumbnailDataUrl: thumb || undefined,
    };
    const nextList = [newSaved, ...savedDesigns];
    setSavedDesigns(nextList);
    persistSavedPlainPoloDesigns(nextList);
    showToast(`Saved "${designName}" to My Saved Designs`);
    triggerCelebration({
      level: 'premium',
      sound: 'celebration',
      eventKey: `polo-design-saved:${newSaved.id}`,
      dedupeWindowMs: 1500,
      action: 'product_customization_saved',
    });
  };

  const handleLoadSavedDesign = (d: SavedPlainPoloDesign) => {
    pushUndoSnapshot(`Loaded "${d.name}"`);
    const matchedColor = product.colors.find((c) => c.name === d.colorName);
    if (matchedColor) onSelectColor(matchedColor);
    onQuantityChange(d.quantity);
    onSelectPrintMethod(d.printMethod);
    setFrontPlacement(d.frontPlacement);
    setBackPlacement(d.backPlacement);
    setNoBackPrint(d.noBackPrint);
    setArtworkApproved(d.artworkApproved);
    setFrontLayers(cloneLayers(d.frontLayers));
    setBackLayers(cloneLayers(d.backLayers));
    setFrontCleanup({ ...d.frontCleanup });
    setBackCleanup({ ...d.backCleanup });
    setBackUsesSameLogo(d.backUsesSameLogo);
    if (d.uploadedFrontLogoName) setFrontLogoName(d.uploadedFrontLogoName);
    if (d.uploadedBackLogoName) setBackLogoName(d.uploadedBackLogoName);
    showToast(`Loaded "${d.name}"`);
  };

  const handleDuplicateActiveDesign = async () => {
    await handleSaveDesignSubmit(`${selectedColor.name} Polo · Copy (${savedDesigns.length + 1})`);
  };

  const handleDownloadPreviewPng = async () => {
    setIsExportingPng(true);
    try {
      const pngUrl = await renderStudioSvgToPngDataUrl(svgStageRef.current, 1200, '#F4F6F9');
      if (!pngUrl) {
        showToast('Preview export failed — try again in a moment');
        return;
      }
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `TeqqnoWorld-PlainPolo-${selectedColor.name.replace(/\s+/g, '-')}-${activeSide}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast(`Downloaded high-res ${activeSide} preview PNG`);
    } finally {
      setIsExportingPng(false);
    }
  };

  const handleShareDesign = async () => {
    const shareUrl = buildPlainPoloShareLink({
      colorName: selectedColor.name,
      printMethod: selectedPrintMethod,
      quantity,
      frontPlacement,
      backPlacement,
    });
    if (navigator.share) {
      try {
        await navigator.share({
          title: `TeqqnoWorld Custom Plain Polo (${selectedColor.name})`,
          text: `Check out our customized ${selectedColor.name} 230 GSM Plain Polo (${quantity} pcs, ${selectedPrintMethod}).`,
          url: shareUrl,
        });
        showToast('Design link shared');
        return;
      } catch {
        // fallback to clipboard
      }
    }
    const copied = await copyToClipboardSafe(shareUrl);
    showToast(copied ? 'Shareable design link copied to clipboard' : 'Share link ready in URL bar');
  };

  const handleResetToOriginal = () => {
    pushUndoSnapshot('Reset to starter design');
    if (initialSnapshotRef.current) {
      applySnapshot(initialSnapshotRef.current);
    } else {
      setFrontLayers([]);
      setBackLayers([]);
      setFrontPlacement('Left Chest');
      setBackPlacement('Upper Back Center');
      setNoBackPrint(false);
    }
    setCompanySublineEnabled(false);
    setResetConfirmOpen(false);
    showToast('Design restored to original starting configuration');
  };

  // Build final commit payload to sync cleanly back to ProductDetailView / Cart
  const buildCommitPayload = (): PlainPoloModalCommitPayload => {
    const committedFront = convertLayersToCustomArtwork(
      frontLayers,
      frontRawDataUrl,
      frontProcessedUrl,
      'front',
      frontPlacement,
      selectedColor.name
    );
    const committedBack = noBackPrint
      ? null
      : convertLayersToCustomArtwork(
          backLayers,
          backUsesSameLogo ? frontRawDataUrl : backRawDataUrl,
          backUsesSameLogo ? frontProcessedUrl : backProcessedUrl,
          'back',
          backPlacement,
          selectedColor.name
        );

    const hasAnyArt = Boolean(committedFront || committedBack);
    return {
      frontArtwork: committedFront,
      backArtwork: committedBack,
      frontPlacement,
      backPlacement: noBackPrint ? 'No back print' : backPlacement,
      uploadedFrontLogoName: frontLogoName,
      uploadedBackLogoName: backUsesSameLogo ? frontLogoName : backLogoName,
      artworkStatus: artworkApproved ? 'approved' : hasAnyArt ? 'uploaded' : 'awaiting_review',
      selectedColor,
      selectedPrintMethod,
      quantity,
      sizeDistribution,
    };
  };

  const handleApplyAndClose = () => {
    onCommitStudioChanges(buildCommitPayload());
    onClose();
  };

  const handleAddToCartFromStudio = () => {
    const payload = buildCommitPayload();
    if (onDirectAddToCart) {
      onDirectAddToCart(payload);
    } else {
      onCommitStudioChanges(payload);
    }
    onClose();
  };

  // Quick size distribution helper
  const updateSizeCount = (sz: string, delta: number) => {
    const curr = sizeDistribution[sz] || 0;
    const nextVal = Math.max(0, curr + delta);
    const updated = { ...sizeDistribution, [sz]: nextVal };
    onSizeDistributionChange(updated);
    const sum = Object.values(updated).reduce((a, b) => a + b, 0);
    if (sum >= (product.moq || 2)) {
      onQuantityChange(sum);
    }
  };

  if (!isOpen) return null;

  const mainLogoPercent = mainLogoLayer
    ? Math.round((mainLogoLayer.width / Math.max(16, activeZone.boxSize)) * 100)
    : 100;

  const quickResizeTarget = selectedLayer || mainLogoLayer || activeLayers[0] || null;
  const isQuickTargetText =
    quickResizeTarget?.kind === 'text' || quickResizeTarget?.kind === 'curved-text';
  const quickTargetScalePercent = quickResizeTarget
    ? Math.max(35, Math.min(210, Math.round((quickResizeTarget.width / Math.max(16, activeZone.boxSize)) * 100)))
    : 100;

  const handleQuickTargetScalePercent = (pctNum: number) => {
    if (!quickResizeTarget) return;
    if (quickResizeTarget.locked) {
      showToast('Unlock layer before resizing');
      return;
    }
    const clamped = Math.max(35, Math.min(210, pctNum));
    const pct = clamped / 100;
    const ratio = quickResizeTarget.height / Math.max(1, quickResizeTarget.width);
    const nextW = Math.round(activeZone.boxSize * pct);
    setActiveLayers((prev) =>
      prev.map((l) =>
        l.id === quickResizeTarget.id
          ? { ...l, width: nextW, height: Math.max(8, Math.round(nextW * ratio)) }
          : l
      )
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`fixed inset-0 z-50 flex flex-col bg-[#F4F6F9] text-slate-900 overflow-hidden select-none ${
          isFullscreen ? '' : ''
        }`}
      >
        {/* ===================================================================== */}
        {/* TOP SAAS STUDIO HEADER BAR                                            */}
        {/* ===================================================================== */}
        <header className="h-14 bg-[#071B35] text-white border-b border-white/10 px-2.5 sm:px-4 lg:px-5 flex items-center justify-between gap-2 shrink-0 z-30">
          {/* Left: Studio Identity & Product Name */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setLeftSidebarOpen((v) => !v)}
              className="hidden md:flex w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 items-center justify-center text-white transition-colors cursor-pointer shrink-0"
              title={leftSidebarOpen ? 'Collapse Left Panel' : 'Expand Left Panel'}
            >
              {leftSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>

            <div className="w-8 h-8 rounded-lg bg-[#FF7900] flex items-center justify-center font-display font-black text-xs sm:text-sm text-white shrink-0 shadow-xs">
              TW
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs sm:text-sm font-bold tracking-tight truncate whitespace-nowrap">
                  Plain Polo Studio
                </span>
                <span className="hidden 2xl:inline text-[11px] text-slate-300 font-medium whitespace-nowrap shrink-0">
                  · 230 GSM Solid Pique
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-300 truncate flex items-center gap-1 whitespace-nowrap">
                <span className="truncate max-w-[90px] sm:max-w-none">{selectedColor.name}</span>
                <span aria-hidden="true">·</span>
                <span className="hidden xs:inline sm:inline truncate">{selectedPrintMethod.replace('Precision ', '')}</span>
                <span className="hidden xs:inline sm:inline" aria-hidden="true">·</span>
                <span className="font-mono tabular-nums shrink-0">{quantity} pcs</span>
              </div>
            </div>
          </div>

          {/* Center-Right: Responsive Customer Power Features */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Validation Indicator */}
            <button
              type="button"
              onClick={() => {
                setHeaderMoreOpen(false);
                setShowValidationPanel((v) => !v);
              }}
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap min-h-[36px] ${
                validationWarningCount > 0
                  ? 'bg-amber-500/15 border-amber-400/40 text-amber-200 hover:bg-amber-500/25'
                  : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/25'
              }`}
              title="Design Validation Checks"
            >
              {validationWarningCount > 0 ? (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              )}
              <span className="hidden lg:inline">
                {validationWarningCount > 0 ? `${validationWarningCount} Check` : 'Print Ready'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHeaderMoreOpen(false);
                setIsSaveModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer min-h-[36px] whitespace-nowrap"
              title="Save Design"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#FF7900] shrink-0" />
              <span className="hidden sm:inline">Save</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setHeaderMoreOpen(false);
                setIsSavedDrawerOpen(true);
              }}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer min-h-[36px] whitespace-nowrap"
              title="My Saved Designs"
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden xl:inline">Saved ({savedDesigns.length})</span>
            </button>

            <button
              type="button"
              onClick={handleDuplicateActiveDesign}
              className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer min-h-[36px] whitespace-nowrap"
              title="Duplicate Design"
            >
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span>Duplicate</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCompareOpen(true)}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer min-h-[36px] whitespace-nowrap"
              title="Compare Designs Side-by-Side"
            >
              <GitCompare className="w-3.5 h-3.5 shrink-0" />
              <span>Compare</span>
            </button>

            <button
              type="button"
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer min-h-[36px] whitespace-nowrap"
              title="Design History"
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>History</span>
            </button>

            <button
              type="button"
              disabled={isExportingPng}
              onClick={handleDownloadPreviewPng}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer min-h-[36px] disabled:opacity-50 whitespace-nowrap"
              title="Download PNG Preview"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden 2xl:inline">{isExportingPng ? 'Exporting...' : 'Download'}</span>
            </button>

            <button
              type="button"
              onClick={handleShareDesign}
              className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors cursor-pointer min-h-[36px] whitespace-nowrap"
              title="Share Design Link"
            >
              <Share2 className="w-3.5 h-3.5 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => {
                if (typeof document !== 'undefined') {
                  if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen?.().catch(() => {});
                    setIsFullscreen(true);
                  } else {
                    document.exitFullscreen?.().catch(() => {});
                    setIsFullscreen(false);
                  }
                }
              }}
              className="hidden lg:inline-flex w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 items-center justify-center text-white cursor-pointer shrink-0"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Responsive More Menu (exposes all tools cleanly on Mobile, Tablet & 1280px Laptops) */}
            <div className="relative 2xl:hidden">
              <button
                type="button"
                onClick={() => setHeaderMoreOpen((v) => !v)}
                className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer relative"
                aria-label="More studio tools"
                title="More studio tools"
              >
                <MoreVertical className="w-4 h-4" />
                {validationWarningCount > 0 && (
                  <span className="sm:hidden absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" />
                )}
              </button>

              {headerMoreOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setHeaderMoreOpen(false)}
                  />
                  <div className="absolute right-0 top-11 z-50 w-60 bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-2xl py-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        setShowValidationPanel(true);
                      }}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50 text-left font-semibold min-h-[42px]"
                    >
                      <span className="flex items-center gap-2.5">
                        {validationWarningCount > 0 ? (
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        )}
                        <span>Design Validation</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {validationWarningCount > 0 ? `${validationWarningCount} check` : 'OK'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        setIsSavedDrawerOpen(true);
                      }}
                      className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-slate-50 text-left font-semibold min-h-[42px]"
                    >
                      <span className="flex items-center gap-2.5">
                        <FolderOpen className="w-4 h-4 text-[#071B35]" />
                        <span>My Saved Designs</span>
                      </span>
                      <span className="font-mono text-slate-500">{savedDesigns.length}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        setIsCompareOpen(true);
                      }}
                      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 text-left font-semibold min-h-[42px]"
                    >
                      <GitCompare className="w-4 h-4 text-[#FF7900]" />
                      <span>Compare Designs</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        setIsHistoryDrawerOpen(true);
                      }}
                      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 text-left font-semibold min-h-[42px]"
                    >
                      <Clock className="w-4 h-4 text-[#071B35]" />
                      <span>Design History</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        handleDuplicateActiveDesign();
                      }}
                      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 text-left font-semibold min-h-[42px]"
                    >
                      <Copy className="w-4 h-4 text-slate-600" />
                      <span>Duplicate Design</span>
                    </button>

                    <button
                      type="button"
                      disabled={isExportingPng}
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        handleDownloadPreviewPng();
                      }}
                      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 text-left font-semibold min-h-[42px] disabled:opacity-50"
                    >
                      <Download className="w-4 h-4 text-slate-600" />
                      <span>{isExportingPng ? 'Exporting PNG...' : 'Download PNG Proof'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        handleShareDesign();
                      }}
                      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 text-left font-semibold min-h-[42px]"
                    >
                      <Share2 className="w-4 h-4 text-slate-600" />
                      <span>Share Design Link</span>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      onClick={() => {
                        setHeaderMoreOpen(false);
                        handleResetToOriginal();
                      }}
                      className="w-full px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-rose-50 text-rose-600 text-left font-semibold min-h-[42px]"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Reset Design</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleApplyAndClose}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg bg-[#FF7900] hover:bg-[#e56d00] text-white text-xs font-bold shadow-sm transition-colors cursor-pointer min-h-[36px] whitespace-nowrap"
            >
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>Save & Apply</span>
            </motion.button>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-white/10 hover:bg-rose-500/80 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
              aria-label="Close Customization Studio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Live Toast Banner */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-[85] bg-[#071B35] text-white border border-[#FF7900]/50 px-4 py-2 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 pointer-events-none"
            >
              <CheckCircle2 className="w-4 h-4 text-[#FF7900] shrink-0" />
              <span>{toastMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Validation Inspect Popover */}
        <AnimatePresence>
          {showValidationPanel && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="fixed top-16 right-4 z-[80] w-80 max-w-[92vw] bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[#071B35] uppercase tracking-wide">
                  Live Design Validation
                </h4>
                <button
                  type="button"
                  onClick={() => setShowValidationPanel(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {validationIssues.map((item) => (
                  <div
                    key={item.id}
                    className={`p-2.5 rounded-xl border text-xs ${
                      item.severity === 'ok'
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                        : 'bg-amber-50/80 border-amber-200 text-amber-950'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      {item.severity === 'ok' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      )}
                      <span>{item.title}</span>
                    </div>
                    <p className="text-[11px] opacity-85 mt-0.5 leading-snug">{item.detail}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===================================================================== */}
        {/* MAIN 3-PANE WORKSPACE                                                 */}
        {/* ===================================================================== */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          {/* ----------------------------------------------------------------- */}
          {/* A. LEFT CUSTOMIZATION PANEL (Desktop & Tablet Left Drawer)        */}
          {/* ----------------------------------------------------------------- */}
          {leftSidebarOpen && (
            <aside className="hidden md:flex w-[270px] lg:w-[280px] xl:w-[340px] bg-white border-r border-slate-200 flex-col min-h-0 shrink-0 z-20 shadow-xs">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Design Toolkit
                </span>
                <span className="text-[11px] font-semibold text-[#FF7900]">
                  Editing: {activeSide === 'front' ? 'Front Side' : 'Back Side'}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {/* 1. PRODUCT SECTION */}
                <div>
                  <button
                    type="button"
                    onClick={() => setOpenSection(openSection === 'product' ? 'upload' : 'product')}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Palette className="w-4 h-4 text-[#FF7900]" />
                      <div>
                        <div className="text-xs font-bold text-[#071B35]">PRODUCT & COLOURS</div>
                        <div className="text-[11px] text-slate-500">
                          {selectedColor.name} · 16 colours
                        </div>
                      </div>
                    </div>
                    {openSection === 'product' ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {openSection === 'product' && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1">
                        <div className="text-xs font-bold text-slate-900 leading-snug">
                          Cotton 230 GSM Plain Polo T-Shirt
                        </div>
                        <div className="text-[11px] text-slate-500">
                          100% Pure Combed Cotton · Solid Ribbed Collar & Cuffs · Bio-Washed
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 mb-2">
                          <span>Garment Colour</span>
                          <span className="font-mono text-[#071B35]">{selectedColor.name}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          {product.colors.map((c) => {
                            const active = selectedColor.name === c.name;
                            return (
                              <button
                                key={c.name}
                                type="button"
                                onClick={() => {
                                  pushUndoSnapshot(`Changed colour to ${c.name}`);
                                  onSelectColor(c);
                                }}
                                className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                                  active
                                    ? 'border-[#FF7900] ring-2 ring-[#FF7900]/20 bg-orange-50/40'
                                    : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                                title={c.name}
                              >
                                <span
                                  className="w-6 h-6 rounded-md border border-black/15 flex items-center justify-center"
                                  style={{ backgroundColor: c.garmentHex || c.hex }}
                                >
                                  {active && (
                                    <Check
                                      className={`w-3.5 h-3.5 stroke-[3] ${
                                        c.hex.toLowerCase() === '#ffffff' || c.name.includes('White')
                                          ? 'text-slate-900'
                                          : 'text-white'
                                      }`}
                                    />
                                  )}
                                </span>
                                <span className="text-[10px] font-medium text-slate-700 truncate max-w-full">
                                  {c.name.split(' ')[0]}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. LOGO UPLOAD SECTION */}
                <div>
                  <button
                    type="button"
                    onClick={() => setOpenSection(openSection === 'upload' ? 'quick' : 'upload')}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Upload className="w-4 h-4 text-[#FF7900]" />
                      <div>
                        <div className="text-xs font-bold text-[#071B35]">LOGO UPLOAD</div>
                        <div className="text-[11px] text-slate-500">
                          PNG, JPG, SVG, PDF · Front & Back
                        </div>
                      </div>
                    </div>
                    {openSection === 'upload' ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {openSection === 'upload' && (
                    <div className="px-4 pb-4 space-y-3">
                      <input
                        ref={frontFileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.svg,.pdf"
                        className="hidden"
                        onChange={(e) => handleLogoFileUpload(e, 'front')}
                      />
                      <input
                        ref={backFileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.svg,.pdf"
                        className="hidden"
                        onChange={(e) => handleLogoFileUpload(e, 'back')}
                      />

                      {/* Upload Dropzone Card */}
                      <div
                        onClick={() =>
                          activeSide === 'back' && !backUsesSameLogo
                            ? backFileInputRef.current?.click()
                            : frontFileInputRef.current?.click()
                        }
                        className="rounded-xl border-2 border-dashed border-slate-300 hover:border-[#FF7900] bg-slate-50/70 hover:bg-orange-50/30 p-4 text-center cursor-pointer transition-all space-y-1.5"
                      >
                        <div className="w-9 h-9 rounded-xl bg-[#071B35] text-white mx-auto flex items-center justify-center">
                          <Upload className="w-4 h-4 text-[#FF7900]" />
                        </div>
                        <div className="text-xs font-bold text-slate-900">
                          {mainLogoLayer ? 'Replace Company Logo' : 'Upload Company Logo'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Supports PNG, JPG, SVG, PDF · Transparent BG ready
                        </div>
                      </div>

                      {/* Upload Progress Bar */}
                      {uploadProgress !== null && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-mono text-slate-600">
                            <span>Processing artwork...</span>
                            <span>{uploadProgress}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#FF7900] transition-all duration-200"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {uploadNotice && (
                        <div className="text-[11px] font-medium px-3 py-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                          {uploadNotice}
                        </div>
                      )}

                      {/* Active File Metadata & Resolution Warning */}
                      {(activeSide === 'front' ? frontFileMeta : backFileMeta) && (
                        <div className="bg-white rounded-xl border border-slate-200 p-2.5 text-[11px] space-y-1">
                          {(() => {
                            const m = activeSide === 'front' ? frontFileMeta! : backFileMeta!;
                            const lowRes = !m.isPdf && !m.isVector && m.naturalWidth > 0 && m.naturalWidth < 400;
                            return (
                              <>
                                <div className="flex items-center justify-between font-semibold text-slate-800">
                                  <span className="truncate max-w-[170px]">{m.fileName}</span>
                                  <span className="font-mono text-slate-500">
                                    {formatBytesCompact(m.fileSizeBytes)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className={lowRes ? 'text-amber-700 font-semibold' : 'text-emerald-700 font-semibold'}>
                                    {m.isVector
                                      ? 'SVG Vector · Print Sharp'
                                      : m.isPdf
                                      ? 'PDF File · Prepress Queued'
                                      : `${m.naturalWidth}×${m.naturalHeight}px · ${lowRes ? 'Low Res Warning' : 'HD Print Ready'}`}
                                  </span>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Replace / Remove Actions */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            activeSide === 'back' && !backUsesSameLogo
                              ? backFileInputRef.current?.click()
                              : frontFileInputRef.current?.click()
                          }
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-[#FF7900]" />
                          <span>Replace</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            pushUndoSnapshot('Removed logo');
                            if (activeSide === 'front') {
                              setFrontRawDataUrl(null);
                              setFrontProcessedUrl(null);
                              setFrontFileMeta(null);
                              setFrontLayers((prev) => prev.filter((l) => !l.isMainLogo));
                            } else {
                              setBackRawDataUrl(null);
                              setBackProcessedUrl(null);
                              setBackFileMeta(null);
                              setBackLayers((prev) => prev.filter((l) => !l.isMainLogo));
                            }
                          }}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 text-xs font-semibold text-rose-600 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>

                      {/* Independent Back-Side Logo Control */}
                      <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-800">Back-Side Logo Mode</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = !backUsesSameLogo;
                              setBackUsesSameLogo(next);
                              if (!next) {
                                setActiveSide('back');
                              } else if (frontRawDataUrl && !noBackPrint) {
                                const bZone = getPlainPoloZoneCoordinates('back', backPlacement, selectedColor.name);
                                setBackLayers((prev) => [
                                  {
                                    id: createStudioUid('logo'),
                                    kind: 'logo',
                                    name: 'Back Logo (Synced)',
                                    isMainLogo: true,
                                    x: bZone.cx,
                                    y: bZone.cy,
                                    width: bZone.boxSize,
                                    height: bZone.boxSize,
                                    rotation: 0,
                                    opacity: 1,
                                    visible: true,
                                    dataUrl: frontProcessedUrl || frontRawDataUrl,
                                  },
                                  ...prev.filter((l) => !l.isMainLogo),
                                ]);
                              }
                            }}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold cursor-pointer ${
                              backUsesSameLogo
                                ? 'bg-[#071B35] text-white'
                                : 'bg-[#FF7900] text-white'
                            }`}
                          >
                            {backUsesSameLogo ? 'Synced with Front' : 'Independent'}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => backFileInputRef.current?.click()}
                          className="w-full py-1.5 rounded-lg border border-slate-300 bg-white hover:border-[#FF7900] text-[11px] font-semibold text-slate-700 cursor-pointer"
                        >
                          + Upload Separate Back Logo
                        </button>
                      </div>

                      {/* Auto Background Transparency Toggle */}
                      <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white cursor-pointer">
                        <div>
                          <div className="text-xs font-semibold text-slate-800">Auto-Remove White BG</div>
                          <div className="text-[10px] text-slate-500">Clean transparent edges on fabric</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={activeCleanup.removeBg}
                          onChange={(e) =>
                            setActiveCleanup((prev) => ({ ...prev, removeBg: e.target.checked }))
                          }
                          className="w-4 h-4 accent-[#FF7900]"
                        />
                      </label>

                      {/* Sample Corporate Logos */}
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Sample Corporate Logos
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {SAMPLE_CORPORATE_LOGOS.map((sample) => (
                            <button
                              key={sample.id}
                              type="button"
                              onClick={() => handleApplySamplePresetLogo(sample.id, sample.label)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-[#FF7900] bg-white text-[11px] font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: sample.accent }}
                              />
                              <span>{sample.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. TEXT & ADDITIONS SECTION */}
                <div>
                  <button
                    type="button"
                    onClick={() => setOpenSection(openSection === 'text' ? 'quick' : 'text')}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <TypeIcon className="w-4 h-4 text-[#FF7900]" />
                      <div>
                        <div className="text-xs font-bold text-[#071B35]">TEXT & ADDITIONS</div>
                        <div className="text-[11px] text-slate-500">
                          Custom text, tagline, curved text, shapes
                        </div>
                      </div>
                    </div>
                    {openSection === 'text' ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {openSection === 'text' && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={
                            selectedLayer && (selectedLayer.kind === 'text' || selectedLayer.kind === 'curved-text')
                              ? selectedLayer.text || ''
                              : draftText
                          }
                          onChange={(e) => {
                            if (selectedLayer && (selectedLayer.kind === 'text' || selectedLayer.kind === 'curved-text')) {
                              updateSelectedLayer({ text: e.target.value, name: e.target.value.slice(0, 22) });
                            } else {
                              setDraftText(e.target.value);
                            }
                          }}
                          placeholder="Company name, tagline, department..."
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:outline-hidden focus:border-[#FF7900]"
                        />

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddTextLayer(false)}
                            className="px-3 py-2 rounded-lg bg-[#071B35] hover:bg-[#0B264A] text-white text-xs font-bold cursor-pointer"
                          >
                            + Add Text
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddTextLayer(true)}
                            className="px-3 py-2 rounded-lg bg-[#FF7900] hover:bg-[#e56d00] text-white text-xs font-bold cursor-pointer"
                          >
                            + Curved Text
                          </button>
                        </div>
                      </div>

                      {/* Typography Formatting */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 block mb-1">Font</label>
                            <select
                              value={selectedLayer?.fontFamily || draftFontFamily}
                              onChange={(e) => {
                                setDraftFontFamily(e.target.value);
                                if (selectedLayer?.kind === 'text' || selectedLayer?.kind === 'curved-text') {
                                  updateSelectedLayer({ fontFamily: e.target.value });
                                }
                              }}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium"
                            >
                              {STUDIO_FONT_FAMILIES.map((f) => (
                                <option key={f.label} value={f.value}>
                                  {f.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                              Weight
                            </label>
                            <select
                              value={selectedLayer?.fontWeight || '700'}
                              onChange={(e) => updateSelectedLayer({ fontWeight: e.target.value })}
                              className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium"
                            >
                              <option value="500">Medium (500)</option>
                              <option value="600">SemiBold (600)</option>
                              <option value="700">Bold (700)</option>
                              <option value="800">ExtraBold (800)</option>
                            </select>
                          </div>
                        </div>

                        {/* Bold, Italic, Uppercase, Text Align */}
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedLayer({
                                  fontWeight: selectedLayer?.fontWeight === '800' ? '500' : '800',
                                })
                              }
                              className={`w-8 h-8 rounded-lg border text-xs font-black cursor-pointer ${
                                selectedLayer?.fontWeight === '800' || selectedLayer?.fontWeight === '700'
                                  ? 'bg-[#071B35] text-white border-[#071B35]'
                                  : 'bg-white text-slate-700 border-slate-200'
                              }`}
                              title="Bold"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedLayer({
                                  fontStyle: selectedLayer?.fontStyle === 'italic' ? 'normal' : 'italic',
                                })
                              }
                              className={`w-8 h-8 rounded-lg border text-xs italic font-serif cursor-pointer ${
                                selectedLayer?.fontStyle === 'italic'
                                  ? 'bg-[#071B35] text-white border-[#071B35]'
                                  : 'bg-white text-slate-700 border-slate-200'
                              }`}
                              title="Italic"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateSelectedLayer({
                                  textTransform: selectedLayer?.textTransform === 'uppercase' ? 'none' : 'uppercase',
                                })
                              }
                              className={`px-2 h-8 rounded-lg border text-[11px] font-bold cursor-pointer ${
                                selectedLayer?.textTransform === 'uppercase'
                                  ? 'bg-[#071B35] text-white border-[#071B35]'
                                  : 'bg-white text-slate-700 border-slate-200'
                              }`}
                              title="Uppercase"
                            >
                              AA
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            {(['left', 'center', 'right'] as const).map((align) => (
                              <button
                                key={align}
                                type="button"
                                onClick={() => updateSelectedLayer({ textAlign: align })}
                                className={`w-8 h-8 rounded-lg border flex items-center justify-center cursor-pointer ${
                                  (selectedLayer?.textAlign || 'center') === align
                                    ? 'bg-[#FF7900] text-white border-[#FF7900]'
                                    : 'bg-white text-slate-600 border-slate-200'
                                }`}
                                title={`Align ${align}`}
                              >
                                {align === 'left' ? (
                                  <AlignLeft className="w-3.5 h-3.5" />
                                ) : align === 'right' ? (
                                  <AlignRight className="w-3.5 h-3.5" />
                                ) : (
                                  <AlignCenter className="w-3.5 h-3.5" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Size, Spacing, Curve */}
                        <div className="space-y-2 text-[11px]">
                          <label className="flex items-center justify-between gap-2">
                            <span className="text-slate-600 font-medium">Size</span>
                            <input
                              type="range"
                              min={8}
                              max={36}
                              value={selectedLayer?.fontSize || draftFontSize}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setDraftFontSize(v);
                                updateSelectedLayer({ fontSize: v });
                              }}
                              className="flex-1 accent-[#FF7900]"
                            />
                            <span className="font-mono w-8 text-right tabular-nums">
                              {selectedLayer?.fontSize || draftFontSize}
                            </span>
                          </label>
                          <label className="flex items-center justify-between gap-2">
                            <span className="text-slate-600 font-medium">Spacing</span>
                            <input
                              type="range"
                              min={-1}
                              max={8}
                              step={0.5}
                              value={selectedLayer?.letterSpacing ?? 0.8}
                              onChange={(e) => updateSelectedLayer({ letterSpacing: Number(e.target.value) })}
                              className="flex-1 accent-[#071B35]"
                            />
                            <span className="font-mono w-8 text-right tabular-nums">
                              {selectedLayer?.letterSpacing ?? 0.8}
                            </span>
                          </label>
                          {selectedLayer?.kind === 'curved-text' && (
                            <label className="flex items-center justify-between gap-2">
                              <span className="text-slate-600 font-medium">Arc</span>
                              <input
                                type="range"
                                min={-90}
                                max={90}
                                value={selectedLayer.curve ?? 36}
                                onChange={(e) => updateSelectedLayer({ curve: Number(e.target.value) })}
                                className="flex-1 accent-[#FF7900]"
                              />
                              <span className="font-mono w-8 text-right tabular-nums">
                                {selectedLayer.curve ?? 36}°
                              </span>
                            </label>
                          )}
                        </div>

                        {/* Text Color Swatches */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          {STUDIO_TEXT_COLORS.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => {
                                setDraftTextColor(hex);
                                updateSelectedLayer({ textColor: hex });
                              }}
                              className={`w-6 h-6 rounded-full border cursor-pointer ${
                                (selectedLayer?.textColor || draftTextColor) === hex
                                  ? 'ring-2 ring-[#FF7900] border-white'
                                  : 'border-slate-300'
                              }`}
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                          <input
                            type="color"
                            value={selectedLayer?.textColor || draftTextColor}
                            onChange={(e) => {
                              setDraftTextColor(e.target.value);
                              updateSelectedLayer({ textColor: e.target.value });
                            }}
                            className="w-6 h-6 rounded border border-slate-300 cursor-pointer"
                            title="Custom Color"
                          />
                        </div>
                      </div>

                      {/* Shapes Quick Row */}
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Add Accent Shapes
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {STUDIO_SHAPES.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleAddShapeLayer(s.id)}
                              className="px-2 py-1.5 rounded-lg border border-slate-200 hover:border-[#FF7900] bg-white text-[11px] font-semibold text-slate-700 cursor-pointer"
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. QUICK DESIGN POSITIONS */}
                <div>
                  <button
                    type="button"
                    onClick={() => setOpenSection(openSection === 'quick' ? 'settings' : 'quick')}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Grid className="w-4 h-4 text-[#FF7900]" />
                      <div>
                        <div className="text-xs font-bold text-[#071B35]">QUICK DESIGN POSITIONS</div>
                        <div className="text-[11px] text-slate-500">
                          {activeSide === 'front' ? frontPlacement : backPlacement}
                        </div>
                      </div>
                    </div>
                    {openSection === 'quick' ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {openSection === 'quick' && (
                    <div className="px-4 pb-4 space-y-3">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Front Printing Positions
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {PLAIN_POLO_FRONT_POSITIONS.map((pos) => {
                            const active = frontPlacement === pos.id;
                            return (
                              <button
                                key={pos.id}
                                type="button"
                                onClick={() => applyQuickPosition('front', pos.id)}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                  active
                                    ? 'border-[#FF7900] bg-orange-50/60 text-[#071B35]'
                                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                                }`}
                              >
                                <div className="text-xs font-bold">{pos.label}</div>
                                <div className="text-[10px] text-slate-500 truncate">{pos.hint}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Back Printing Positions
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {PLAIN_POLO_BACK_POSITIONS.map((pos) => {
                            const active =
                              (pos.id === 'No back print' && noBackPrint) ||
                              (!noBackPrint && backPlacement === pos.id);
                            return (
                              <button
                                key={pos.id}
                                type="button"
                                onClick={() => applyQuickPosition('back', pos.id)}
                                className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                                  active
                                    ? 'border-[#FF7900] bg-orange-50/60 text-[#071B35]'
                                    : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                                }`}
                              >
                                <div className="text-xs font-bold">{pos.label}</div>
                                <div className="text-[10px] text-slate-500 truncate">{pos.hint}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. PRINT OPTIONS */}
                <div>
                  <button
                    type="button"
                    onClick={() => setOpenSection(openSection === 'print' ? 'settings' : 'print')}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Printer className="w-4 h-4 text-[#FF7900]" />
                      <div>
                        <div className="text-xs font-bold text-[#071B35]">PRINT OPTIONS</div>
                        <div className="text-[11px] text-slate-500">
                          {selectedPrintMethod} · {activeCleanup.printColorMode}
                        </div>
                      </div>
                    </div>
                    {openSection === 'print' ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {openSection === 'print' && (
                    <div className="px-4 pb-4 space-y-3">
                      <div className="space-y-1.5">
                        {PLAIN_POLO_PRINT_METHODS.map((pm) => {
                          const active = selectedPrintMethod === pm.id;
                          return (
                            <button
                              key={pm.id}
                              type="button"
                              onClick={() => {
                                pushUndoSnapshot(`Changed method to ${pm.title}`);
                                onSelectPrintMethod(pm.id);
                              }}
                              className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                active
                                  ? 'border-[#FF7900] bg-orange-50/50 ring-1 ring-[#FF7900]/30'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-[#071B35]">{pm.title}</span>
                                <span className="text-[10px] font-mono text-slate-500">{pm.turnaround}</span>
                              </div>
                              <div className="text-[11px] text-slate-600 mt-0.5">{pm.subtitle}</div>
                            </button>
                          );
                        })}
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                          Ink / Thread Colour Mode
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(
                            [
                              { id: 'full', label: 'Full colour' },
                              { id: 'white', label: 'White' },
                              { id: 'black', label: 'Black' },
                              { id: 'auto', label: 'Auto' },
                            ] as const
                          ).map((mode) => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() =>
                                setActiveCleanup((prev) => ({ ...prev, printColorMode: mode.id }))
                              }
                              className={`py-1.5 px-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                                activeCleanup.printColorMode === mode.id
                                  ? 'bg-[#071B35] text-white border-[#071B35]'
                                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. LOGO SETTINGS */}
                <div>
                  <button
                    type="button"
                    onClick={() => setOpenSection(openSection === 'settings' ? 'upload' : 'settings')}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Sliders className="w-4 h-4 text-[#FF7900]" />
                      <div>
                        <div className="text-xs font-bold text-[#071B35]">LOGO SETTINGS & CLEANUP</div>
                        <div className="text-[11px] text-slate-500">
                          Size, Rotation, Magic Eraser, Parts Layout
                        </div>
                      </div>
                    </div>
                    {openSection === 'settings' ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </button>

                  {openSection === 'settings' && (
                    <div className="px-4 pb-5 space-y-3.5 text-xs">
                      {/* Scale / Size Slider */}
                      <label className="block space-y-1">
                        <div className="flex justify-between font-semibold text-slate-700">
                          <span>Logo Size</span>
                          <span className="font-mono tabular-nums">{mainLogoPercent}%</span>
                        </div>
                        <input
                          type="range"
                          min={35}
                          max={210}
                          value={mainLogoPercent}
                          onChange={(e) => {
                            if (!mainLogoLayer || mainLogoLayer.locked) return;
                            const pct = Number(e.target.value) / 100;
                            const ratio = mainLogoLayer.height / Math.max(1, mainLogoLayer.width);
                            const nextW = Math.round(activeZone.boxSize * pct);
                            setActiveLayers((prev) =>
                              prev.map((l) =>
                                l.id === mainLogoLayer.id
                                  ? { ...l, width: nextW, height: Math.round(nextW * ratio) }
                                  : l
                              )
                            );
                          }}
                          className="w-full accent-[#FF7900]"
                        />
                      </label>

                      {/* Rotation Slider */}
                      <label className="block space-y-1">
                        <div className="flex justify-between font-semibold text-slate-700">
                          <span>Rotation</span>
                          <span className="font-mono tabular-nums">
                            {Math.round((selectedLayer || mainLogoLayer)?.rotation || 0)}°
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          value={Math.round((selectedLayer || mainLogoLayer)?.rotation || 0)}
                          onChange={(e) => {
                            const target = selectedLayer || mainLogoLayer;
                            if (!target || target.locked) return;
                            const val = Number(e.target.value);
                            setActiveLayers((prev) =>
                              prev.map((l) => (l.id === target.id ? { ...l, rotation: val } : l))
                            );
                          }}
                          className="w-full accent-[#071B35]"
                        />
                      </label>

                      {/* Opacity Slider */}
                      <label className="block space-y-1">
                        <div className="flex justify-between font-semibold text-slate-700">
                          <span>Opacity</span>
                          <span className="font-mono tabular-nums">
                            {Math.round(((selectedLayer || mainLogoLayer)?.opacity ?? 1) * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={15}
                          max={100}
                          value={Math.round(((selectedLayer || mainLogoLayer)?.opacity ?? 1) * 100)}
                          onChange={(e) => {
                            const target = selectedLayer || mainLogoLayer;
                            if (!target || target.locked) return;
                            const val = Number(e.target.value) / 100;
                            setActiveLayers((prev) =>
                              prev.map((l) => (l.id === target.id ? { ...l, opacity: val } : l))
                            );
                          }}
                          className="w-full accent-[#FF7900]"
                        />
                      </label>

                      {/* Alignment & Flip */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const target = selectedLayer || mainLogoLayer;
                            if (!target || target.locked) return;
                            pushUndoSnapshot('Centered layer horizontally');
                            setActiveLayers((prev) =>
                              prev.map((l) => (l.id === target.id ? { ...l, x: activeZone.cx } : l))
                            );
                          }}
                          className="py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold cursor-pointer"
                        >
                          Center H
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const target = selectedLayer || mainLogoLayer;
                            if (!target || target.locked) return;
                            pushUndoSnapshot('Centered layer in zone');
                            setActiveLayers((prev) =>
                              prev.map((l) =>
                                l.id === target.id ? { ...l, x: activeZone.cx, y: activeZone.cy } : l
                              )
                            );
                          }}
                          className="py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold cursor-pointer"
                        >
                          Center Zone
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const target = selectedLayer || mainLogoLayer;
                            if (!target || target.locked) return;
                            setActiveLayers((prev) =>
                              prev.map((l) => (l.id === target.id ? { ...l, flipX: !l.flipX } : l))
                            );
                          }}
                          className="py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <FlipHorizontal className="w-3 h-3" />
                          <span>Flip</span>
                        </button>
                      </div>

                      {/* Toggle: Add Company Name Below Logo */}
                      <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="font-semibold text-slate-800">
                            Add company name below logo
                          </span>
                          <input
                            type="checkbox"
                            checked={companySublineEnabled}
                            onChange={(e) => setCompanySublineEnabled(e.target.checked)}
                            className="w-4 h-4 accent-[#FF7900]"
                          />
                        </label>
                        {companySublineEnabled && (
                          <input
                            type="text"
                            value={companySublineText}
                            onChange={(e) => setCompanySublineText(e.target.value)}
                            placeholder="Company name..."
                            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                          />
                        )}
                      </div>

                      {/* Background Removal Strength + Margin Trim */}
                      <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                        <div className="font-bold text-[11px] uppercase tracking-wide text-slate-600">
                          Background & Margin Cleanup
                        </div>

                        <label className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-700">BG Threshold</span>
                          <input
                            type="range"
                            min={10}
                            max={85}
                            disabled={!activeCleanup.removeBg}
                            value={activeCleanup.bgStrength}
                            onChange={(e) =>
                              setActiveCleanup((prev) => ({
                                ...prev,
                                bgStrength: Number(e.target.value),
                              }))
                            }
                            className="flex-1 accent-[#FF7900] disabled:opacity-40"
                          />
                          <span className="font-mono text-[11px] w-7 text-right">
                            {activeCleanup.bgStrength}
                          </span>
                        </label>

                        <label className="flex items-center justify-between cursor-pointer">
                          <span className="text-[11px] text-slate-700">Trim empty transparent margins</span>
                          <input
                            type="checkbox"
                            checked={activeCleanup.trimEdges}
                            onChange={(e) =>
                              setActiveCleanup((prev) => ({ ...prev, trimEdges: e.target.checked }))
                            }
                            className="w-4 h-4 accent-[#071B35]"
                          />
                        </label>

                        <label className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-700">Edge Padding</span>
                          <input
                            type="range"
                            min={0}
                            max={24}
                            value={activeCleanup.trimPadding}
                            onChange={(e) =>
                              setActiveCleanup((prev) => ({
                                ...prev,
                                trimPadding: Number(e.target.value),
                              }))
                            }
                            className="flex-1 accent-[#071B35]"
                          />
                          <span className="font-mono text-[11px] w-8 text-right">
                            {activeCleanup.trimPadding}px
                          </span>
                        </label>
                      </div>

                      {/* Logo Parts Segmentation & Layout Mode */}
                      {activeParts.length > 0 && (
                        <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                          <div className="text-[11px] font-bold text-slate-800">
                            Detected Logo Parts ({activeParts.length})
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            {getLogoLayoutOptions().map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() =>
                                  setActiveCleanup((prev) => ({ ...prev, layoutMode: opt.id }))
                                }
                                className={`px-2 py-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                                  activeCleanup.layoutMode === opt.id
                                    ? 'bg-[#071B35] text-white border-[#071B35]'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          {activeParts.length > 1 && (
                            <>
                              <label className="flex items-center justify-between gap-2 pt-1">
                                <span className="text-[11px] text-slate-600">Part Gap</span>
                                <input
                                  type="range"
                                  min={0}
                                  max={200}
                                  value={activeCleanup.partSpacing}
                                  onChange={(e) =>
                                    setActiveCleanup((prev) => ({
                                      ...prev,
                                      partSpacing: Number(e.target.value),
                                    }))
                                  }
                                  className="flex-1 accent-[#FF7900]"
                                />
                              </label>
                              <div className="flex flex-wrap gap-1 pt-1">
                                {activeParts.map((part) => {
                                  const isHidden = activeCleanup.hiddenPartIndices.includes(part.index);
                                  return (
                                    <button
                                      key={part.index}
                                      type="button"
                                      onClick={() =>
                                        setActiveCleanup((prev) => ({
                                          ...prev,
                                          hiddenPartIndices: isHidden
                                            ? prev.hiddenPartIndices.filter((i) => i !== part.index)
                                            : [...prev.hiddenPartIndices, part.index],
                                        }))
                                      }
                                      className={`px-2 py-1 rounded-md text-[10px] font-semibold border flex items-center gap-1 cursor-pointer ${
                                        isHidden
                                          ? 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                                          : 'bg-orange-50 text-[#071B35] border-[#FF7900]/40'
                                      }`}
                                    >
                                      {part.dataUrl && (
                                        <img src={part.dataUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                                      )}
                                      {isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                      <span>Part {part.index + 1}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Magic Eraser Launch Button */}
                      <button
                        type="button"
                        disabled={!activeRawUrl}
                        onClick={() => setIsMagicEraserOpen(true)}
                        className="w-full py-2.5 rounded-xl bg-[#071B35] hover:bg-[#0B264A] disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                      >
                        <Scissors className="w-4 h-4 text-[#FF7900]" />
                        <span>Open Precision Magic Eraser</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </aside>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* B. CENTER PRODUCT PREVIEW WORKSPACE                               */}
          {/* ----------------------------------------------------------------- */}
          <main
            ref={mainScrollRef}
            className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto overscroll-contain md:overflow-hidden bg-[#F4F6F9] relative"
          >
            {/* Center Top Controls Bar */}
            <div className="sticky top-0 z-20 md:static px-2.5 sm:px-3 xl:px-5 py-2 bg-white/95 backdrop-blur-sm border-b border-slate-200 flex flex-wrap xl:flex-nowrap items-center justify-between gap-1.5 sm:gap-2 shrink-0">
              {/* Front / Back Segmented Switcher */}
              <div className="inline-flex items-center bg-slate-100 p-0.5 sm:p-1 rounded-xl border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSide('front');
                    setSelectedLayerId(null);
                  }}
                  className={`px-2.5 xl:px-4 py-1.5 rounded-lg text-[11px] xl:text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[32px] sm:min-h-[34px] ${
                    activeSide === 'front'
                      ? 'bg-[#071B35] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="xl:hidden">Front</span>
                  <span className="hidden xl:inline">Front View</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveSide('back');
                    setSelectedLayerId(null);
                  }}
                  className={`px-2.5 xl:px-4 py-1.5 rounded-lg text-[11px] xl:text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap min-h-[32px] sm:min-h-[34px] ${
                    activeSide === 'back'
                      ? 'bg-[#FF7900] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="xl:hidden">Back</span>
                  <span className="hidden xl:inline">Back View</span>
                  {noBackPrint && (
                    <span className="text-[9px] font-mono opacity-80">(Off)</span>
                  )}
                </button>
              </div>

              {/* Workspace Tools: Frame Switcher, Guides, Layers Visibility, Undo/Redo, Zoom */}
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Desktop vs Mobile Frame Preview Switcher (Tablet & Desktop only) */}
                <div className="hidden md:inline-flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setPreviewFrameMode('desktop')}
                    className={`px-1.5 xl:px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                      previewFrameMode === 'desktop'
                        ? 'bg-white text-[#071B35] shadow-2xs'
                        : 'text-slate-500'
                    }`}
                    title="Desktop Canvas Preview"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Desktop</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFrameMode('mobile')}
                    className={`px-1.5 xl:px-2 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                      previewFrameMode === 'mobile'
                        ? 'bg-white text-[#FF7900] shadow-2xs'
                        : 'text-slate-500'
                    }`}
                    title="Mobile Frame Preview"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span className="hidden xl:inline">Mobile</span>
                  </button>
                </div>

                {/* Guides & Hide Layers Toggles */}
                <button
                  type="button"
                  onClick={() => setShowPrintArea((v) => !v)}
                  className={`px-2 xl:px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap min-h-[32px] sm:min-h-[34px] shrink-0 ${
                    showPrintArea
                      ? 'bg-orange-50 border-[#FF7900]/40 text-[#071B35]'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                  title="Toggle Print Boundary Guides"
                >
                  <Grid className="w-3.5 h-3.5 text-[#FF7900]" />
                  <span className="hidden xl:inline">Guides</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowLayersOverlay((v) => !v)}
                  className={`px-2 xl:px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 cursor-pointer whitespace-nowrap min-h-[32px] sm:min-h-[34px] shrink-0 ${
                    showLayersOverlay
                      ? 'bg-white border-slate-200 text-slate-700'
                      : 'bg-[#071B35] border-[#071B35] text-white'
                  }`}
                  title="Show / Hide Customization Preview"
                >
                  {showLayersOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span className="hidden xl:inline">{showLayersOverlay ? 'Layers On' : 'Clean Blank'}</span>
                </button>

                {/* Undo / Redo */}
                <div className="inline-flex items-center bg-white rounded-lg border border-slate-200 p-0.5 shrink-0">
                  <button
                    type="button"
                    disabled={historyCounters.undo === 0}
                    onClick={handleUndo}
                    className="w-6 sm:w-7 h-7 rounded flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={historyCounters.redo === 0}
                    onClick={handleRedo}
                    className="w-6 sm:w-7 h-7 rounded flex items-center justify-center text-slate-700 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Zoom Controls */}
                <div className="inline-flex items-center bg-white rounded-lg border border-slate-200 px-1 py-0.5 gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setZoomPercent((z) => Math.max(60, z - 15))}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                    title="Zoom Out"
                    aria-label="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomPercent(100)}
                    className="text-[10px] sm:text-[11px] font-mono font-bold text-slate-700 px-1 tabular-nums cursor-pointer min-w-[36px] text-center"
                    title="Reset Zoom to 100%"
                  >
                    {zoomPercent}%
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomPercent((z) => Math.min(175, z + 15))}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
                    title="Zoom In"
                    aria-label="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Tablet Layers Drawer Button */}
                <button
                  type="button"
                  onClick={() => setTabletRightOpen((v) => !v)}
                  className="hidden md:flex lg:hidden px-2.5 py-1.5 rounded-lg bg-[#071B35] text-white text-xs font-bold items-center gap-1.5 cursor-pointer whitespace-nowrap min-h-[32px] shrink-0"
                >
                  <Layers className="w-3.5 h-3.5 text-[#FF7900]" />
                  <span>Layers</span>
                </button>
              </div>
            </div>

            {/* Interactive SVG Preview Stage */}
            <div
              ref={stageRootRef}
              onClick={() => {
                setSelectedLayerId(null);
                setInlineEditingLayerId(null);
              }}
              className="shrink-0 md:flex-1 md:min-h-0 md:overflow-auto flex flex-col items-center justify-center p-2 sm:p-5 relative gap-2"
            >
              <div
                className={`transition-all duration-300 flex items-center justify-center ${
                  previewFrameMode === 'mobile'
                    ? 'w-[320px] max-w-full rounded-[34px] border-[8px] border-[#071B35] bg-white shadow-2xl p-2.5 sm:p-3'
                    : 'w-full max-w-[320px] sm:max-w-[540px] rounded-2xl sm:rounded-3xl bg-white border border-slate-200/90 shadow-md sm:shadow-lg p-2 sm:p-5'
                }`}
              >
                <div
                  className="w-full aspect-square relative flex items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px]"
                >
                  <motion.div
                    key={`${activeSide}-${selectedColor.name}`}
                    initial={{ opacity: 0.85, scale: 0.985 }}
                    animate={{ opacity: 1, scale: zoomPercent / 100 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    className="w-full h-full flex items-center justify-center origin-center"
                  >
                    <svg
                      ref={svgStageRef}
                      viewBox="0 0 500 500"
                      className="w-full h-full touch-none"
                      onPointerMove={handleStagePointerMove}
                      onPointerUp={handleStagePointerUp}
                      onPointerLeave={handleStagePointerUp}
                    >
                      <defs>
                        <filter id="plainStudioPrintTexture">
                          <feDropShadow dx="0" dy="0.5" stdDeviation="0.4" floodOpacity="0.22" />
                        </filter>
                      </defs>

                      {/* Genuine Plain Polo WebP Photo */}
                      <image
                        href={activeSide === 'back' ? poloPhotos.back : poloPhotos.front}
                        x="30"
                        y="18"
                        width="440"
                        height="464"
                        preserveAspectRatio="xMidYMid meet"
                      />

                      {/* Print Area Safe Zone Guide */}
                      {showPrintArea && !(activeSide === 'back' && noBackPrint) && (
                        <g data-studio-chrome="true" className="pointer-events-none">
                          {activeSide === 'front' && (
                            <path
                              d="M 184 148 L 236 148 L 236 226 L 264 226 L 264 148 L 316 148 L 316 408 L 184 408 Z"
                              fill="none"
                              stroke="#94A3B8"
                              strokeOpacity="0.45"
                              strokeWidth="1"
                              strokeDasharray="4 4"
                            />
                          )}
                          <rect
                            x={activeZone.cx - activeZone.maxW / 2}
                            y={activeZone.cy - activeZone.maxH / 2}
                            width={activeZone.maxW}
                            height={activeZone.maxH}
                            rx="6"
                            fill="#FF7900"
                            fillOpacity="0.06"
                            stroke="#FF7900"
                            strokeWidth="1.2"
                            strokeDasharray="4 3"
                          />
                          <rect
                            x={activeZone.cx - 46}
                            y={activeZone.cy - activeZone.maxH / 2 - 15}
                            width="92"
                            height="13"
                            rx="3"
                            fill="#071B35"
                          />
                          <text
                            x={activeZone.cx}
                            y={activeZone.cy - activeZone.maxH / 2 - 6}
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="7"
                            fontWeight="700"
                            fontFamily="Space Grotesk, sans-serif"
                          >
                            {activeZone.label.toUpperCase()}
                          </text>
                        </g>
                      )}

                      {/* Back Print Off Banner Overlay */}
                      {activeSide === 'back' && noBackPrint && (
                        <g data-studio-chrome="true" className="pointer-events-none">
                          <rect
                            x="145"
                            y="220"
                            width="210"
                            height="42"
                            rx="10"
                            fill="#071B35"
                            fillOpacity="0.88"
                          />
                          <text
                            x="250"
                            y="240"
                            textAnchor="middle"
                            fill="#FFFFFF"
                            fontSize="11"
                            fontWeight="700"
                          >
                            No Back Print Selected
                          </text>
                          <text
                            x="250"
                            y="253"
                            textAnchor="middle"
                            fill="#CBD5E1"
                            fontSize="8.5"
                          >
                            Choose Upper/Centre/Full Back below to print back
                          </text>
                        </g>
                      )}

                      {/* Studio Artwork Layers */}
                      {showLayersOverlay &&
                        activeLayers
                          .filter((l) => l.visible !== false)
                          .map((layer) => {
                            const isSelected = selectedLayerId === layer.id;
                            const halfW = layer.width / 2;
                            const halfH = layer.height / 2;
                            const curveVal = layer.curve || 0;
                            const pathId = `plain-curve-${layer.id}`;
                            const displayText =
                              layer.textTransform === 'uppercase'
                                ? (layer.text || '').toUpperCase()
                                : layer.text || '';

                            return (
                              <g
                                key={layer.id}
                                transform={`translate(${layer.x}, ${layer.y}) rotate(${layer.rotation || 0})`}
                                opacity={layer.opacity ?? 1}
                                className={layer.locked ? 'cursor-not-allowed' : 'cursor-move'}
                                style={
                                  selectedPrintMethod === 'Precision Embroidery'
                                    ? { filter: 'url(#plainStudioPrintTexture)' }
                                    : undefined
                                }
                                onPointerDown={(e) => startLayerDrag(e, layer, 'move')}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedLayerId(layer.id);
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (layer.kind === 'text' || layer.kind === 'curved-text') {
                                    setSelectedLayerId(layer.id);
                                    setInlineEditingLayerId(layer.id);
                                  }
                                }}
                              >
                                {(layer.kind === 'logo' || layer.kind === 'image') && layer.dataUrl && (
                                  <g transform={layer.flipX ? 'scale(-1, 1)' : undefined}>
                                    <image
                                      href={layer.dataUrl}
                                      x={-halfW}
                                      y={-halfH}
                                      width={layer.width}
                                      height={layer.height}
                                      preserveAspectRatio="xMidYMid meet"
                                    />
                                  </g>
                                )}

                                {layer.kind === 'text' && (
                                  <text
                                    x={
                                      layer.textAlign === 'left'
                                        ? -halfW
                                        : layer.textAlign === 'right'
                                        ? halfW
                                        : 0
                                    }
                                    y={(layer.fontSize || 14) * 0.34}
                                    textAnchor={
                                      layer.textAlign === 'left'
                                        ? 'start'
                                        : layer.textAlign === 'right'
                                        ? 'end'
                                        : 'middle'
                                    }
                                    fill={layer.textColor || '#FFFFFF'}
                                    fontSize={layer.fontSize || 14}
                                    fontFamily={layer.fontFamily || 'Space Grotesk, sans-serif'}
                                    fontWeight={layer.fontWeight || '700'}
                                    fontStyle={layer.fontStyle || 'normal'}
                                    letterSpacing={layer.letterSpacing ?? 0.6}
                                  >
                                    {displayText}
                                  </text>
                                )}

                                {layer.kind === 'curved-text' && (
                                  <g>
                                    <defs>
                                      <path
                                        id={pathId}
                                        d={`M ${-halfW} ${curveVal > 0 ? 10 : -10} Q 0 ${
                                          -curveVal * 0.75
                                        } ${halfW} ${curveVal > 0 ? 10 : -10}`}
                                      />
                                    </defs>
                                    <text
                                      fill={layer.textColor || '#FFFFFF'}
                                      fontSize={layer.fontSize || 13}
                                      fontFamily={layer.fontFamily || 'Space Grotesk, sans-serif'}
                                      fontWeight={layer.fontWeight || '700'}
                                      fontStyle={layer.fontStyle || 'normal'}
                                      letterSpacing={layer.letterSpacing ?? 1}
                                      textAnchor="middle"
                                    >
                                      <textPath href={`#${pathId}`} startOffset="50%">
                                        {displayText}
                                      </textPath>
                                    </text>
                                  </g>
                                )}

                                {layer.kind === 'shape' && (
                                  <>
                                    {layer.shapeType === 'rect' && (
                                      <rect
                                        x={-halfW}
                                        y={-halfH}
                                        width={layer.width}
                                        height={layer.height}
                                        rx={layer.borderRadius ?? 6}
                                        fill={layer.fillColor || '#FF7900'}
                                        stroke={layer.strokeColor || 'none'}
                                        strokeWidth={layer.strokeWidth || 0}
                                      />
                                    )}
                                    {layer.shapeType === 'pill' && (
                                      <rect
                                        x={-halfW}
                                        y={-halfH}
                                        width={layer.width}
                                        height={layer.height}
                                        rx={Math.min(halfW, halfH)}
                                        fill={layer.fillColor || '#FF7900'}
                                      />
                                    )}
                                    {layer.shapeType === 'circle' && (
                                      <ellipse
                                        cx={0}
                                        cy={0}
                                        rx={halfW}
                                        ry={halfH}
                                        fill={layer.fillColor || '#FF7900'}
                                      />
                                    )}
                                    {layer.shapeType === 'ring' && (
                                      <ellipse
                                        cx={0}
                                        cy={0}
                                        rx={Math.max(4, halfW - 3)}
                                        ry={Math.max(4, halfH - 3)}
                                        fill="none"
                                        stroke={layer.strokeColor || layer.fillColor || '#FF7900'}
                                        strokeWidth={layer.strokeWidth || 4}
                                      />
                                    )}
                                    {layer.shapeType === 'triangle' && (
                                      <polygon
                                        points={`0,${-halfH} ${halfW},${halfH} ${-halfW},${halfH}`}
                                        fill={layer.fillColor || '#FF7900'}
                                      />
                                    )}
                                    {layer.shapeType === 'line' && (
                                      <rect
                                        x={-halfW}
                                        y={-Math.max(1.5, halfH / 2)}
                                        width={layer.width}
                                        height={Math.max(3, layer.height)}
                                        rx={2}
                                        fill={layer.fillColor || '#FF7900'}
                                      />
                                    )}
                                  </>
                                )}

                                {/* Interactive Selection Box + 4 Resize Corners + Top Rotation Handle */}
                                {isSelected && (
                                  <g data-studio-chrome="true">
                                    <rect
                                      x={-halfW - 4}
                                      y={-halfH - 4}
                                      width={layer.width + 8}
                                      height={layer.height + 8}
                                      fill="none"
                                      stroke={layer.locked ? '#64748B' : '#FF7900'}
                                      strokeWidth="1.3"
                                      strokeDasharray="3 2"
                                    />
                                    {!layer.locked && (
                                      <>
                                        <line
                                          x1={0}
                                          y1={-halfH - 4}
                                          x2={0}
                                          y2={-halfH - 18}
                                          stroke="#FF7900"
                                          strokeWidth="1.3"
                                        />
                                         <circle
                                           cx={0}
                                           cy={-halfH - 22}
                                           r={16}
                                           fill="transparent"
                                           className="cursor-grab"
                                           onPointerDown={(e) => startLayerDrag(e, layer, 'rotate')}
                                         />
                                         <circle
                                           cx={0}
                                           cy={-halfH - 22}
                                           r={5.5}
                                           fill="#FFFFFF"
                                           stroke="#FF7900"
                                           strokeWidth="1.8"
                                           className="pointer-events-none"
                                         />
                                         {(
                                           [
                                             { k: 'nw' as const, cx: -halfW - 4, cy: -halfH - 4, cur: 'cursor-nwse-resize' },
                                             { k: 'ne' as const, cx: halfW + 4, cy: -halfH - 4, cur: 'cursor-nesw-resize' },
                                             { k: 'se' as const, cx: halfW + 4, cy: halfH + 4, cur: 'cursor-nwse-resize' },
                                             { k: 'sw' as const, cx: -halfW - 4, cy: halfH + 4, cur: 'cursor-nesw-resize' },
                                           ]
                                         ).map((c) => (
                                           <g key={c.k}>
                                             <rect
                                               x={c.cx - 14}
                                               y={c.cy - 14}
                                               width={28}
                                               height={28}
                                               fill="transparent"
                                               className={c.cur}
                                               onPointerDown={(e) => startLayerDrag(e, layer, 'resize', c.k)}
                                             />
                                             <rect
                                               x={c.cx - 4.5}
                                               y={c.cy - 4.5}
                                               width={9}
                                               height={9}
                                               rx={2}
                                               fill="#FFFFFF"
                                               stroke="#FF7900"
                                               strokeWidth="1.7"
                                               className="pointer-events-none"
                                             />
                                           </g>
                                         ))}
                                      </>
                                    )}
                                  </g>
                                )}
                              </g>
                            );
                          })}
                    </svg>
                  </motion.div>

                  {/* Double-click Inline Text Edit Bar */}
                  {inlineEditingLayerId &&
                    selectedLayer &&
                    (selectedLayer.kind === 'text' || selectedLayer.kind === 'curved-text') && (
                      <div
                        className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white border-2 border-[#FF7900] rounded-xl shadow-xl px-3 py-1.5 flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={selectedLayer.text || ''}
                          onChange={(e) =>
                            updateSelectedLayer({ text: e.target.value, name: e.target.value.slice(0, 22) })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') setInlineEditingLayerId(null);
                          }}
                          autoFocus
                          className="text-xs font-bold text-slate-900 focus:outline-hidden w-40"
                        />
                        <button
                          type="button"
                          onClick={() => setInlineEditingLayerId(null)}
                          className="px-2 py-1 rounded bg-[#FF7900] text-white text-[10px] font-bold cursor-pointer"
                        >
                          Done
                        </button>
                      </div>
                    )}
                </div>
              </div>

              {/* Tablet / Laptop / Desktop Floating Layer Quick-Action Bar (md+) */}
              <AnimatePresence>
                {selectedLayer && !inlineEditingLayerId && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    onClick={(e) => e.stopPropagation()}
                    className="hidden md:flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-slate-200/90 shadow-md rounded-xl px-2.5 py-1.5 max-w-full overflow-x-auto no-scrollbar"
                  >
                    <span className="text-[11px] font-bold text-[#071B35] pr-1.5 border-r border-slate-200 truncate max-w-[110px]">
                      {selectedLayer.name || selectedLayer.text || 'Layer'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLayer.locked) return;
                        updateSelectedLayer({
                          width: Math.max(18, Math.round(selectedLayer.width * 0.9)),
                          height: Math.max(8, Math.round(selectedLayer.height * 0.9)),
                        });
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer shrink-0"
                      title="Decrease Size"
                    >
                      Size −
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLayer.locked) return;
                        updateSelectedLayer({
                          width: Math.min(280, Math.round(selectedLayer.width * 1.1)),
                          height: Math.min(280, Math.round(selectedLayer.height * 1.1)),
                        });
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer shrink-0"
                      title="Increase Size"
                    >
                      Size +
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLayer.locked) return;
                        pushUndoSnapshot('Centered layer in zone');
                        updateSelectedLayer({ x: activeZone.cx, y: activeZone.cy });
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#071B35] text-[11px] font-bold cursor-pointer shrink-0"
                      title="Center in Zone"
                    >
                      Center
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLayer.locked) return;
                        updateSelectedLayer({ rotation: ((selectedLayer.rotation || 0) + 15) % 360 });
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      title="Rotate +15°"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>15°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLayer.locked) return;
                        updateSelectedLayer({ flipX: !selectedLayer.flipX });
                      }}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
                      title="Flip Horizontal"
                    >
                      <FlipHorizontal className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDuplicateLayer(selectedLayer)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer shrink-0"
                      title="Duplicate Layer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelectedLayer({ locked: !selectedLayer.locked })}
                      className={`p-1.5 rounded-lg border cursor-pointer shrink-0 ${
                        selectedLayer.locked
                          ? 'bg-orange-50 border-[#FF7900] text-[#FF7900]'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={selectedLayer.locked ? 'Unlock' : 'Lock'}
                    >
                      {selectedLayer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLayer.locked) {
                          showToast('Unlock layer before deleting');
                          return;
                        }
                        pushUndoSnapshot('Deleted layer');
                        setActiveLayers((prev) => prev.filter((l) => l.id !== selectedLayer.id));
                        setSelectedLayerId(null);
                      }}
                      className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer shrink-0"
                      title="Delete Layer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mobile UP-TOP Instant Logo Resize & Quick Actions Deck (<md) */}
              {!inlineEditingLayerId && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="md:hidden w-full max-w-[340px] space-y-1.5"
                >
                  {quickResizeTarget ? (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="bg-white border border-slate-200/90 shadow-sm rounded-2xl p-2.5 space-y-2"
                    >
                      {/* Quick Action Buttons Row */}
                      <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#071B35] bg-slate-100 px-2 py-1 rounded-lg truncate max-w-[92px] shrink-0">
                          {isQuickTargetText ? 'Text' : quickResizeTarget.isMainLogo ? 'Logo' : 'Layer'}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (quickResizeTarget.locked) {
                                showToast('Unlock layer first');
                                return;
                              }
                              pushUndoSnapshot('Centered layer in zone');
                              setActiveLayers((prev) =>
                                prev.map((l) =>
                                  l.id === quickResizeTarget.id ? { ...l, x: activeZone.cx, y: activeZone.cy } : l
                                )
                              );
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-100 text-[#071B35] text-[10px] font-bold min-h-[30px]"
                          >
                            Center
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (quickResizeTarget.locked) return;
                              setActiveLayers((prev) =>
                                prev.map((l) =>
                                  l.id === quickResizeTarget.id
                                    ? { ...l, rotation: ((l.rotation || 0) + 15) % 360 }
                                    : l
                                )
                              );
                            }}
                            className="px-2 py-1 rounded-lg bg-slate-100 text-slate-800 text-[10px] font-bold flex items-center gap-0.5 min-h-[30px]"
                            title="Rotate +15°"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>15°</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              activeSide === 'back' && !backUsesSameLogo
                                ? backFileInputRef.current?.click()
                                : frontFileInputRef.current?.click()
                            }
                            className="px-2 py-1 rounded-lg bg-[#071B35] text-white text-[10px] font-bold flex items-center gap-1 min-h-[30px]"
                          >
                            <Upload className="w-3 h-3 text-[#FF7900]" />
                            <span>Logo</span>
                          </button>
                          {(quickResizeTarget.kind === 'logo' || quickResizeTarget.kind === 'image') &&
                            activeRawUrl && (
                              <button
                                type="button"
                                onClick={() => setIsMagicEraserOpen(true)}
                                className="px-2 py-1 rounded-lg bg-[#FF7900] text-white text-[10px] font-bold flex items-center gap-1 min-h-[30px]"
                              >
                                <Scissors className="w-3 h-3" />
                                <span>Eraser</span>
                              </button>
                            )}
                          {selectedLayer && (
                            <button
                              type="button"
                              onClick={() => updateSelectedLayer({ locked: !selectedLayer.locked })}
                              className={`p-1.5 rounded-lg border min-h-[30px] min-w-[30px] flex items-center justify-center ${
                                selectedLayer.locked
                                  ? 'bg-orange-50 border-[#FF7900] text-[#FF7900]'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                              aria-label="Lock or unlock layer"
                            >
                              {selectedLayer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Instant Logo / Text Chhota-Bada Size Slider Row */}
                      {isQuickTargetText ? (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[10px] font-bold text-slate-500 shrink-0">Size</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (quickResizeTarget.locked) return;
                              const nextSize = Math.max(8, (quickResizeTarget.fontSize || 14) - 1);
                              setActiveLayers((prev) =>
                                prev.map((l) => (l.id === quickResizeTarget.id ? { ...l, fontSize: nextSize } : l))
                              );
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-100 text-[#071B35] font-extrabold text-xs flex items-center justify-center shrink-0"
                            aria-label="Smaller text"
                          >
                            −
                          </button>
                          <input
                            type="range"
                            min={8}
                            max={36}
                            value={quickResizeTarget.fontSize || 14}
                            onChange={(e) => {
                              if (quickResizeTarget.locked) return;
                              const nextSize = Number(e.target.value);
                              setActiveLayers((prev) =>
                                prev.map((l) => (l.id === quickResizeTarget.id ? { ...l, fontSize: nextSize } : l))
                              );
                            }}
                            className="flex-1 accent-[#FF7900] h-1.5"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (quickResizeTarget.locked) return;
                              const nextSize = Math.min(36, (quickResizeTarget.fontSize || 14) + 1);
                              setActiveLayers((prev) =>
                                prev.map((l) => (l.id === quickResizeTarget.id ? { ...l, fontSize: nextSize } : l))
                              );
                            }}
                            className="w-7 h-7 rounded-lg bg-slate-100 text-[#071B35] font-extrabold text-xs flex items-center justify-center shrink-0"
                            aria-label="Larger text"
                          >
                            +
                          </button>
                          <span className="font-mono text-[11px] font-bold text-[#071B35] w-9 text-right tabular-nums shrink-0">
                            {quickResizeTarget.fontSize || 14}px
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[10px] font-bold text-slate-500 shrink-0">Logo Size</span>
                          <button
                            type="button"
                            onClick={() => handleQuickTargetScalePercent(quickTargetScalePercent - 10)}
                            className="w-7 h-7 rounded-lg bg-slate-100 text-[#071B35] font-extrabold text-xs flex items-center justify-center shrink-0"
                            aria-label="Shrink logo"
                          >
                            −
                          </button>
                          <input
                            type="range"
                            min={35}
                            max={210}
                            value={quickTargetScalePercent}
                            onChange={(e) => handleQuickTargetScalePercent(Number(e.target.value))}
                            className="flex-1 accent-[#FF7900] h-1.5"
                          />
                          <button
                            type="button"
                            onClick={() => handleQuickTargetScalePercent(quickTargetScalePercent + 10)}
                            className="w-7 h-7 rounded-lg bg-slate-100 text-[#071B35] font-extrabold text-xs flex items-center justify-center shrink-0"
                            aria-label="Enlarge logo"
                          >
                            +
                          </button>
                          <span className="font-mono text-[11px] font-bold text-[#071B35] w-10 text-right tabular-nums shrink-0">
                            {quickTargetScalePercent}%
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white border border-slate-200 shadow-2xs rounded-2xl p-2 flex items-center justify-between gap-1.5"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          activeSide === 'back' && !backUsesSameLogo
                            ? backFileInputRef.current?.click()
                            : frontFileInputRef.current?.click()
                        }
                        className="flex-1 py-2 px-3 rounded-xl bg-[#071B35] text-white text-xs font-bold flex items-center justify-center gap-1.5 min-h-[38px]"
                      >
                        <Upload className="w-3.5 h-3.5 text-[#FF7900]" />
                        <span>Upload Logo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddTextLayer(false)}
                        className="py-2 px-3 rounded-xl bg-[#FF7900] text-white text-xs font-bold min-h-[38px]"
                      >
                        + Text
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplySamplePresetLogo('teqqno', 'TeqqnoWorld')}
                        className="py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[#071B35] text-[11px] font-bold min-h-[38px]"
                      >
                        Sample
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile 1-Tap Polo Colour Swatches Strip (<md) — Instant live colour preview */}
            <div className="md:hidden px-2.5 py-2 bg-white border-t border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                Colour:
              </span>
              {product.colors.map((c) => {
                const active = selectedColor.name === c.name;
                return (
                  <motion.button
                    key={c.name}
                    type="button"
                    whileTap={{ scale: 0.92 }}
                    onClick={() => {
                      pushUndoSnapshot(`Changed colour to ${c.name}`);
                      onSelectColor(c);
                    }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border shrink-0 min-h-[34px] transition-all ${
                      active
                        ? 'border-[#FF7900] bg-orange-50/70 ring-1 ring-[#FF7900]'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-md border border-black/15 flex items-center justify-center shrink-0"
                      style={{ backgroundColor: c.garmentHex || c.hex }}
                    >
                      {active && (
                        <Check
                          className={`w-2.5 h-2.5 stroke-[3] ${
                            c.hex.toLowerCase() === '#ffffff' || c.name.includes('White')
                              ? 'text-slate-900'
                              : 'text-white'
                          }`}
                        />
                      )}
                    </span>
                    <span className="text-[11px] font-semibold text-[#071B35] whitespace-nowrap">
                      {c.name.split(' ')[0]}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Mobile Quick Zone Strip (<md) — 1-tap placement switching */}
            <div className="md:hidden px-2.5 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 pr-0.5">
                {activeSide === 'front' ? 'Zone:' : 'Back:'}
              </span>
              {(activeSide === 'front' ? PLAIN_POLO_FRONT_POSITIONS : PLAIN_POLO_BACK_POSITIONS).map((pos) => {
                const active =
                  activeSide === 'front'
                    ? frontPlacement === pos.id
                    : (pos.id === 'No back print' && noBackPrint) ||
                      (!noBackPrint && backPlacement === pos.id);
                return (
                  <motion.button
                    key={pos.id}
                    type="button"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => applyQuickPosition(activeSide, pos.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap border transition-all shrink-0 min-h-[36px] ${
                      active
                        ? 'bg-[#071B35] text-white border-[#071B35] shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {pos.shortLabel}
                  </motion.button>
                );
              })}
            </div>

            {/* ================================================================ */}
            {/* MOBILE INLINE CUSTOMIZATION WORKBENCH (<md) — Scroll Directly    */}
            {/* ================================================================ */}
            <div className="md:hidden shrink-0 bg-[#F4F6F9]">
              {/* Section Quick-Jump Strip */}
              <div className="px-2.5 py-2 bg-white border-y border-slate-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'upload', label: '1. Logo & Eraser', icon: Upload },
                    { id: 'product', label: '2. Colours & Print', icon: Palette },
                    { id: 'text', label: '3. Text & Shapes', icon: TypeIcon },
                    { id: 'layers', label: '4. Layers', icon: Layers },
                    { id: 'price', label: '5. Qty & Sizes', icon: Sparkles },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = activeMobileSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => scrollMobileToSection(item.id)}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 whitespace-nowrap border shrink-0 min-h-[36px] transition-colors ${
                        active
                          ? 'bg-[#FF7900] text-white border-[#FF7900] shadow-xs'
                          : 'bg-slate-50 text-[#071B35] border-slate-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Stacked Inline Editing Cards */}
              <div className="p-3 pb-8 space-y-3.5">
                {/* 1. UPLOAD LOGO & MAGIC ERASER */}
                <section
                  id="polo-mob-upload"
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#071B35] text-white flex items-center justify-center shrink-0">
                        <Upload className="w-3.5 h-3.5 text-[#FF7900]" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-extrabold text-[#071B35] truncate">
                          1. Upload Logo &amp; Magic Eraser
                        </h3>
                        <p className="text-[10px] text-slate-500 truncate">
                          Editing {activeSide === 'front' ? 'Front Side' : 'Back Side'} artwork
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => scrollMobileToSection('top')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-[#071B35] shrink-0"
                    >
                      ↑ Preview
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      activeSide === 'back' && !backUsesSameLogo
                        ? backFileInputRef.current?.click()
                        : frontFileInputRef.current?.click()
                    }
                    className="w-full py-3 rounded-xl bg-[#071B35] text-white text-xs font-bold flex items-center justify-center gap-2 min-h-[46px]"
                  >
                    <Upload className="w-4 h-4 text-[#FF7900]" />
                    <span>
                      {mainLogoLayer
                        ? 'Replace Logo (PNG, JPG, SVG, PDF)'
                        : 'Upload Company Logo (PNG, SVG, PDF)'}
                    </span>
                  </button>

                  {uploadProgress !== null && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono text-slate-600">
                        <span>Processing artwork...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#FF7900]" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {uploadNotice && (
                    <div className="text-[11px] font-medium px-3 py-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      {uploadNotice}
                    </div>
                  )}

                  {(activeSide === 'front' ? frontFileMeta : backFileMeta) && (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-2.5 text-[11px] flex items-center justify-between gap-2">
                      {(() => {
                        const m = activeSide === 'front' ? frontFileMeta! : backFileMeta!;
                        return (
                          <>
                            <span className="font-semibold text-slate-800 truncate">{m.fileName}</span>
                            <span className="font-mono text-slate-500 shrink-0">
                              {m.isVector ? 'SVG' : m.isPdf ? 'PDF' : `${m.naturalWidth}×${m.naturalHeight}`} ·{' '}
                              {formatBytesCompact(m.fileSizeBytes)}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => frontFileInputRef.current?.click()}
                      className="py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-[#FF7900]" />
                      <span>Upload Front</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => backFileInputRef.current?.click()}
                      className="py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#FF7900]" />
                      <span>Separate Back</span>
                    </button>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">Back Logo Mode</span>
                      <button
                        type="button"
                        onClick={() => setBackUsesSameLogo((v) => !v)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                          backUsesSameLogo ? 'bg-[#071B35] text-white' : 'bg-[#FF7900] text-white'
                        }`}
                      >
                        {backUsesSameLogo ? 'Synced with Front' : 'Independent'}
                      </button>
                    </div>

                    <label className="flex items-center justify-between pt-1 cursor-pointer">
                      <div>
                        <div className="text-xs font-semibold text-slate-800">Auto-Remove White BG</div>
                        <div className="text-[10px] text-slate-500">Clean transparent edges on fabric</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={activeCleanup.removeBg}
                        onChange={(e) =>
                          setActiveCleanup((prev) => ({ ...prev, removeBg: e.target.checked }))
                        }
                        className="w-5 h-5 accent-[#FF7900]"
                      />
                    </label>

                    {activeCleanup.removeBg && (
                      <label className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-600 font-medium">Threshold</span>
                        <input
                          type="range"
                          min={10}
                          max={85}
                          value={activeCleanup.bgStrength}
                          onChange={(e) =>
                            setActiveCleanup((prev) => ({ ...prev, bgStrength: Number(e.target.value) }))
                          }
                          className="flex-1 accent-[#FF7900]"
                        />
                        <span className="font-mono w-7 text-right tabular-nums">
                          {activeCleanup.bgStrength}
                        </span>
                      </label>
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Ink / Thread Colour Mode
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'full', label: 'Full colour' },
                          { id: 'white', label: 'White' },
                          { id: 'black', label: 'Black' },
                          { id: 'auto', label: 'Auto' },
                        ] as const
                      ).map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() =>
                            setActiveCleanup((prev) => ({ ...prev, printColorMode: mode.id }))
                          }
                          className={`py-2 px-1 rounded-lg border text-[11px] font-semibold min-h-[38px] ${
                            activeCleanup.printColorMode === mode.id
                              ? 'bg-[#071B35] text-white border-[#071B35]'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!activeRawUrl}
                      onClick={() => setIsMagicEraserOpen(true)}
                      className="py-2.5 rounded-xl bg-[#FF7900] disabled:opacity-40 text-white text-xs font-bold flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <Scissors className="w-4 h-4" />
                      <span>Magic Eraser</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        pushUndoSnapshot('Removed logo');
                        if (activeSide === 'front') {
                          setFrontRawDataUrl(null);
                          setFrontProcessedUrl(null);
                          setFrontFileMeta(null);
                          setFrontLayers((prev) => prev.filter((l) => !l.isMainLogo));
                        } else {
                          setBackRawDataUrl(null);
                          setBackProcessedUrl(null);
                          setBackFileMeta(null);
                          setBackLayers((prev) => prev.filter((l) => !l.isMainLogo));
                        }
                      }}
                      className="py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-rose-600 flex items-center justify-center gap-1.5 min-h-[44px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Logo</span>
                    </button>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Sample Corporate Logos
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {SAMPLE_CORPORATE_LOGOS.map((sample) => (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() => handleApplySamplePresetLogo(sample.id, sample.label)}
                          className="px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 flex items-center gap-1.5"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: sample.accent }} />
                          <span>{sample.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* 2. POLO COLOURS, ZONES & BRANDING METHOD */}
                <section
                  id="polo-mob-product"
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#071B35] text-white flex items-center justify-center shrink-0">
                        <Palette className="w-3.5 h-3.5 text-[#FF7900]" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-extrabold text-[#071B35] truncate">
                          2. Polo Colours &amp; Print Method
                        </h3>
                        <p className="text-[10px] text-slate-500 truncate">
                          {selectedColor.name} · {product.colors.length} shades
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => scrollMobileToSection('top')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-[#071B35] shrink-0"
                    >
                      ↑ Preview
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
                      <span>Garment Colour</span>
                      <span className="font-mono text-[#071B35]">{selectedColor.name}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {product.colors.map((c) => {
                        const active = selectedColor.name === c.name;
                        return (
                          <button
                            key={c.name}
                            type="button"
                            onClick={() => {
                              pushUndoSnapshot(`Changed colour to ${c.name}`);
                              onSelectColor(c);
                            }}
                            className={`p-2 rounded-xl border flex flex-col items-center gap-1 min-h-[56px] justify-center ${
                              active
                                ? 'border-[#FF7900] bg-orange-50/70 ring-1 ring-[#FF7900]'
                                : 'border-slate-200 bg-white'
                            }`}
                          >
                            <span
                              className="w-6 h-6 rounded-md border border-black/15 flex items-center justify-center"
                              style={{ backgroundColor: c.garmentHex || c.hex }}
                            >
                              {active && (
                                <Check
                                  className={`w-3.5 h-3.5 stroke-[3] ${
                                    c.hex.toLowerCase() === '#ffffff' || c.name.includes('White')
                                      ? 'text-slate-900'
                                      : 'text-white'
                                  }`}
                                />
                              )}
                            </span>
                            <span className="text-[10px] font-medium truncate max-w-full">
                              {c.name.split(' ')[0]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-700 mb-2">
                      {activeSide === 'front' ? 'Front Printing Zone' : 'Back Printing Zone'}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(activeSide === 'front' ? PLAIN_POLO_FRONT_POSITIONS : PLAIN_POLO_BACK_POSITIONS).map((pos) => {
                        const active =
                          activeSide === 'front'
                            ? frontPlacement === pos.id
                            : (pos.id === 'No back print' && noBackPrint) ||
                              (!noBackPrint && backPlacement === pos.id);
                        return (
                          <button
                            key={pos.id}
                            type="button"
                            onClick={() => applyQuickPosition(activeSide, pos.id)}
                            className={`p-2.5 rounded-xl border text-left min-h-[48px] ${
                              active
                                ? 'border-[#FF7900] bg-orange-50/70 text-[#071B35]'
                                : 'border-slate-200 bg-white text-slate-700'
                            }`}
                          >
                            <div className="text-xs font-bold">{pos.label}</div>
                            <div className="text-[10px] text-slate-500 truncate">{pos.hint}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-slate-700 mb-2">Branding Method</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {PLAIN_POLO_PRINT_METHODS.map((pm) => (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => {
                            pushUndoSnapshot(`Changed method to ${pm.title}`);
                            onSelectPrintMethod(pm.id);
                          }}
                          className={`p-2 rounded-xl border text-center min-h-[44px] text-[11px] font-bold ${
                            selectedPrintMethod === pm.id
                              ? 'bg-[#FF7900] text-white border-[#FF7900]'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {pm.title.replace('Precision ', '')}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* 3. CUSTOM TEXT, FONTS, SUBLINE & ACCENT SHAPES */}
                <section
                  id="polo-mob-text"
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#071B35] text-white flex items-center justify-center shrink-0">
                        <TypeIcon className="w-3.5 h-3.5 text-[#FF7900]" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-extrabold text-[#071B35] truncate">
                          3. Add Custom Text &amp; Shapes
                        </h3>
                        <p className="text-[10px] text-slate-500 truncate">
                          Company name, tagline, curved arc &amp; badges
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => scrollMobileToSection('top')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-[#071B35] shrink-0"
                    >
                      ↑ Preview
                    </button>
                  </div>

                  <input
                    type="text"
                    value={
                      selectedLayer && (selectedLayer.kind === 'text' || selectedLayer.kind === 'curved-text')
                        ? selectedLayer.text || ''
                        : draftText
                    }
                    onChange={(e) => {
                      if (selectedLayer && (selectedLayer.kind === 'text' || selectedLayer.kind === 'curved-text')) {
                        updateSelectedLayer({ text: e.target.value, name: e.target.value.slice(0, 22) });
                      } else {
                        setDraftText(e.target.value);
                      }
                    }}
                    placeholder="Company name, tagline, department..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddTextLayer(false)}
                      className="py-2.5 rounded-xl bg-[#071B35] text-white text-xs font-bold min-h-[44px]"
                    >
                      + Add Text
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddTextLayer(true)}
                      className="py-2.5 rounded-xl bg-[#FF7900] text-white text-xs font-bold min-h-[44px]"
                    >
                      + Curved Text
                    </button>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={selectedLayer?.fontFamily || draftFontFamily}
                        onChange={(e) => {
                          setDraftFontFamily(e.target.value);
                          if (selectedLayer?.kind === 'text' || selectedLayer?.kind === 'curved-text') {
                            updateSelectedLayer({ fontFamily: e.target.value });
                          }
                        }}
                        className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium min-h-[40px]"
                      >
                        {STUDIO_FONT_FAMILIES.map((f) => (
                          <option key={f.label} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={selectedLayer?.fontWeight || '700'}
                        onChange={(e) => updateSelectedLayer({ fontWeight: e.target.value })}
                        className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium min-h-[40px]"
                      >
                        <option value="500">Medium (500)</option>
                        <option value="600">SemiBold (600)</option>
                        <option value="700">Bold (700)</option>
                        <option value="800">ExtraBold (800)</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedLayer({
                              fontWeight: selectedLayer?.fontWeight === '800' ? '500' : '800',
                            })
                          }
                          className={`w-10 h-10 rounded-lg border text-xs font-black ${
                            selectedLayer?.fontWeight === '800' || selectedLayer?.fontWeight === '700'
                              ? 'bg-[#071B35] text-white border-[#071B35]'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedLayer({
                              fontStyle: selectedLayer?.fontStyle === 'italic' ? 'normal' : 'italic',
                            })
                          }
                          className={`w-10 h-10 rounded-lg border text-xs italic font-serif ${
                            selectedLayer?.fontStyle === 'italic'
                              ? 'bg-[#071B35] text-white border-[#071B35]'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          I
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateSelectedLayer({
                              textTransform: selectedLayer?.textTransform === 'uppercase' ? 'none' : 'uppercase',
                            })
                          }
                          className={`px-2.5 h-10 rounded-lg border text-xs font-bold ${
                            selectedLayer?.textTransform === 'uppercase'
                              ? 'bg-[#071B35] text-white border-[#071B35]'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          AA
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {(['left', 'center', 'right'] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => updateSelectedLayer({ textAlign: align })}
                            className={`w-10 h-10 rounded-lg border flex items-center justify-center ${
                              (selectedLayer?.textAlign || 'center') === align
                                ? 'bg-[#FF7900] text-white border-[#FF7900]'
                                : 'bg-white text-slate-600 border-slate-200'
                            }`}
                          >
                            {align === 'left' ? (
                              <AlignLeft className="w-4 h-4" />
                            ) : align === 'right' ? (
                              <AlignRight className="w-4 h-4" />
                            ) : (
                              <AlignCenter className="w-4 h-4" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      <label className="flex items-center justify-between gap-2">
                        <span className="text-slate-600 font-medium w-14">Size</span>
                        <input
                          type="range"
                          min={8}
                          max={36}
                          value={selectedLayer?.fontSize || draftFontSize}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setDraftFontSize(v);
                            updateSelectedLayer({ fontSize: v });
                          }}
                          className="flex-1 accent-[#FF7900]"
                        />
                        <span className="font-mono w-7 text-right tabular-nums">
                          {selectedLayer?.fontSize || draftFontSize}
                        </span>
                      </label>
                      <label className="flex items-center justify-between gap-2">
                        <span className="text-slate-600 font-medium w-14">Space</span>
                        <input
                          type="range"
                          min={-1}
                          max={8}
                          step={0.5}
                          value={selectedLayer?.letterSpacing ?? 0.8}
                          onChange={(e) => updateSelectedLayer({ letterSpacing: Number(e.target.value) })}
                          className="flex-1 accent-[#071B35]"
                        />
                        <span className="font-mono w-7 text-right tabular-nums">
                          {selectedLayer?.letterSpacing ?? 0.8}
                        </span>
                      </label>
                      {selectedLayer?.kind === 'curved-text' && (
                        <label className="flex items-center justify-between gap-2">
                          <span className="text-slate-600 font-medium w-14">Arc</span>
                          <input
                            type="range"
                            min={-90}
                            max={90}
                            value={selectedLayer.curve ?? 36}
                            onChange={(e) => updateSelectedLayer({ curve: Number(e.target.value) })}
                            className="flex-1 accent-[#FF7900]"
                          />
                          <span className="font-mono w-7 text-right tabular-nums">
                            {selectedLayer.curve ?? 36}°
                          </span>
                        </label>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {STUDIO_TEXT_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => {
                            setDraftTextColor(hex);
                            updateSelectedLayer({ textColor: hex });
                          }}
                          className={`w-7 h-7 rounded-full border ${
                            (selectedLayer?.textColor || draftTextColor) === hex
                              ? 'ring-2 ring-[#FF7900] border-white'
                              : 'border-slate-300'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                      <input
                        type="color"
                        value={selectedLayer?.textColor || draftTextColor}
                        onChange={(e) => {
                          setDraftTextColor(e.target.value);
                          updateSelectedLayer({ textColor: e.target.value });
                        }}
                        className="w-7 h-7 rounded border border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                    <label className="flex items-center justify-between cursor-pointer text-xs font-semibold text-slate-800">
                      <span>Add company name below logo</span>
                      <input
                        type="checkbox"
                        checked={companySublineEnabled}
                        onChange={(e) => setCompanySublineEnabled(e.target.checked)}
                        className="w-5 h-5 accent-[#FF7900]"
                      />
                    </label>
                    {companySublineEnabled && (
                      <input
                        type="text"
                        value={companySublineText}
                        onChange={(e) => setCompanySublineText(e.target.value)}
                        placeholder="Company name..."
                        className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                      Add Accent Shapes
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {STUDIO_SHAPES.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleAddShapeLayer(s.id)}
                          className="py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 min-h-[40px]"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>

                {/* 4. LAYERS, TRANSFORM SLIDERS & PRINT PRE-CHECK */}
                <section
                  id="polo-mob-layers"
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#071B35] text-white flex items-center justify-center shrink-0">
                        <Layers className="w-3.5 h-3.5 text-[#FF7900]" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-extrabold text-[#071B35] truncate">
                          4. Layers &amp; Size Transform
                        </h3>
                        <p className="text-[10px] text-slate-500 truncate">
                          {activeLayers.length} layer{activeLayers.length === 1 ? '' : 's'} on {activeSide} view
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => scrollMobileToSection('top')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-[#071B35] shrink-0"
                    >
                      ↑ Preview
                    </button>
                  </div>

                  {(selectedLayer || mainLogoLayer) && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2.5 text-xs">
                      <div className="font-bold text-[#071B35]">
                        Transform: {(selectedLayer || mainLogoLayer)?.name || 'Active Layer'}
                      </div>
                      {mainLogoLayer && (
                        <label className="flex items-center justify-between gap-2">
                          <span className="text-slate-600 w-16">Logo Size</span>
                          <input
                            type="range"
                            min={35}
                            max={210}
                            value={mainLogoPercent}
                            onChange={(e) => {
                              if (mainLogoLayer.locked) return;
                              const pct = Number(e.target.value) / 100;
                              const ratio = mainLogoLayer.height / Math.max(1, mainLogoLayer.width);
                              const nextW = Math.round(activeZone.boxSize * pct);
                              setActiveLayers((prev) =>
                                prev.map((l) =>
                                  l.id === mainLogoLayer.id
                                    ? { ...l, width: nextW, height: Math.round(nextW * ratio) }
                                    : l
                                )
                              );
                            }}
                            className="flex-1 accent-[#FF7900]"
                          />
                          <span className="font-mono w-10 text-right tabular-nums">{mainLogoPercent}%</span>
                        </label>
                      )}
                      <label className="flex items-center justify-between gap-2">
                        <span className="text-slate-600 w-16">Rotation</span>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          value={Math.round((selectedLayer || mainLogoLayer)?.rotation || 0)}
                          onChange={(e) => {
                            const target = selectedLayer || mainLogoLayer;
                            if (!target || target.locked) return;
                            const val = Number(e.target.value);
                            setActiveLayers((prev) =>
                              prev.map((l) => (l.id === target.id ? { ...l, rotation: val } : l))
                            );
                          }}
                          className="flex-1 accent-[#071B35]"
                        />
                        <span className="font-mono w-10 text-right tabular-nums">
                          {Math.round((selectedLayer || mainLogoLayer)?.rotation || 0)}°
                        </span>
                      </label>
                      <label className="flex items-center justify-between gap-2">
                        <span className="text-slate-600 w-16">Opacity</span>
                        <input
                          type="range"
                          min={15}
                          max={100}
                          value={Math.round(((selectedLayer || mainLogoLayer)?.opacity ?? 1) * 100)}
                          onChange={(e) => {
                            const target = selectedLayer || mainLogoLayer;
                            if (!target || target.locked) return;
                            const val = Number(e.target.value) / 100;
                            setActiveLayers((prev) =>
                              prev.map((l) => (l.id === target.id ? { ...l, opacity: val } : l))
                            );
                          }}
                          className="flex-1 accent-[#FF7900]"
                        />
                        <span className="font-mono w-10 text-right tabular-nums">
                          {Math.round(((selectedLayer || mainLogoLayer)?.opacity ?? 1) * 100)}%
                        </span>
                      </label>

                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            const target = selectedLayer || mainLogoLayer;
                            if (!target || target.locked) return;
                            setActiveLayers((prev) =>
                              prev.map((l) => (l.id === target.id ? { ...l, x: activeZone.cx } : l))
                            );
                          }}
                          className="py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold"
                        >
                          Center H
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const target = selectedLayer || mainLogoLayer;
                            if (!target || target.locked) return;
                            setActiveLayers((prev) =>
                              prev.map((l) =>
                                l.id === target.id ? { ...l, x: activeZone.cx, y: activeZone.cy } : l
                              )
                            );
                          }}
                          className="py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold"
                        >
                          Center Zone
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const target = selectedLayer || mainLogoLayer;
                            if (!target || target.locked) return;
                            setActiveLayers((prev) =>
                              prev.map((l) => (l.id === target.id ? { ...l, flipX: !l.flipX } : l))
                            );
                          }}
                          className="py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold flex items-center justify-center gap-1"
                        >
                          <FlipHorizontal className="w-3 h-3" />
                          <span>Flip</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {activeLayers.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      No layers on {activeSide} view. Upload a logo or add text above.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {activeLayers.map((l, index) => (
                        <div
                          key={l.id}
                          onClick={() => setSelectedLayerId(l.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                            selectedLayerId === l.id ? 'border-[#FF7900] bg-orange-50/40' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <span className="font-semibold truncate flex-1">{l.name || l.text || 'Layer'}</span>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveLayers((prev) =>
                                  prev.map((x) => (x.id === l.id ? { ...x, visible: x.visible === false } : x))
                                )
                              }
                              className="p-2 text-slate-500"
                            >
                              {l.visible === false ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveLayers((prev) =>
                                  prev.map((x) => (x.id === l.id ? { ...x, locked: !x.locked } : x))
                                )
                              }
                              className="p-2"
                            >
                              {l.locked ? <Lock className="w-4 h-4 text-[#FF7900]" /> : <Unlock className="w-4 h-4 text-slate-500" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateLayer(l)}
                              className="p-2 text-slate-500"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveLayerOrder(index, -1)}
                              className="p-1.5 text-slate-500 disabled:opacity-25"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === activeLayers.length - 1}
                              onClick={() => handleMoveLayerOrder(index, 1)}
                              className="p-1.5 text-slate-500 disabled:opacity-25"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (l.locked) {
                                  showToast('Unlock layer before deleting');
                                  return;
                                }
                                pushUndoSnapshot('Deleted layer');
                                setActiveLayers((prev) => prev.filter((x) => x.id !== l.id));
                              }}
                              className="p-2 text-rose-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Print Pre-Check ({validationWarningCount === 0 ? 'All Clear' : `${validationWarningCount} Notice`})
                    </div>
                    {validationIssues.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className={`p-2 rounded-lg border text-[11px] flex items-start gap-2 ${
                          item.severity === 'ok'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        {item.severity === 'ok' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-bold">{item.title}: </span>
                          <span>{item.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 5. QUANTITY, SIZES & ARTWORK APPROVAL */}
                <section
                  id="polo-mob-price"
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3.5 space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#071B35] text-white flex items-center justify-center shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-[#FF7900]" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-extrabold text-[#071B35] truncate">
                          5. Quantity, Sizes &amp; Approval
                        </h3>
                        <p className="text-[10px] text-slate-500 truncate tabular-nums">
                          {quantity} pcs · {formatCurrencyINR(livePricing.totalPrice)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => scrollMobileToSection('top')}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-[10px] font-bold text-[#071B35] shrink-0"
                    >
                      ↑ Preview
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {PLAIN_POLO_QUICK_QUANTITIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onQuantityChange(q)}
                        className={`py-2.5 rounded-xl border text-xs font-mono font-bold min-h-[42px] ${
                          quantity === q ? 'bg-[#071B35] text-white border-[#071B35]' : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        {q} pcs
                      </button>
                    ))}
                  </div>

                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => onQuantityChange(Math.max(product.moq || 2, quantity - 1))}
                          className="w-9 h-9 rounded font-bold text-slate-700"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={product.moq || 2}
                          value={quantity}
                          onChange={(e) =>
                            onQuantityChange(Math.max(product.moq || 2, parseInt(e.target.value, 10) || 2))
                          }
                          className="w-12 text-center font-mono text-sm font-bold text-[#071B35] tabular-nums focus:outline-hidden"
                        />
                        <button
                          type="button"
                          onClick={() => onQuantityChange(quantity + 1)}
                          className="w-9 h-9 rounded font-bold text-slate-700"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-extrabold text-[#071B35] tabular-nums">
                          {formatCurrencyINR(livePricing.totalPrice)}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {formatCurrencyINR(livePricing.unitPrice)}/pc · Incl. 18% GST
                        </div>
                      </div>
                    </div>

                    {nextTierUpsell && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 flex items-center justify-between gap-2 text-[11px] text-emerald-900">
                        <span>
                          Add <strong>{nextTierUpsell.diff} more</strong> →{' '}
                          <strong>{formatCurrencyINR(nextTierUpsell.pricePerUnit)}/pc</strong>
                        </span>
                        <button
                          type="button"
                          onClick={() => onQuantityChange(nextTierUpsell.minQty)}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white font-bold shrink-0"
                        >
                          Make {nextTierUpsell.minQty}
                        </button>
                      </div>
                    )}
                  </div>

                  {product.sizes && (
                    <div>
                      <div className="text-xs font-bold text-slate-700 mb-1.5">Size Mix Breakdown (S – 4XL)</div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {product.sizes.map((sz) => (
                          <div
                            key={sz}
                            className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs"
                          >
                            <span className="font-semibold text-slate-700">{sz.split(' ')[0]}</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateSizeCount(sz, -1)}
                                className="w-7 h-7 rounded-lg bg-slate-100 font-bold"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-mono tabular-nums">
                                {sizeDistribution[sz] || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateSizeCount(sz, 1)}
                                className="w-7 h-7 rounded-lg bg-slate-100 font-bold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-600 flex items-center justify-between px-1">
                    <span className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-[#FF7900]" />
                      <span>Dispatch: {product.dispatchTime}</span>
                    </span>
                    <span className="font-medium text-slate-500">Delhivery Express</span>
                  </div>

                  <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={artworkApproved}
                      onChange={(e) => setArtworkApproved(e.target.checked)}
                      className="w-5 h-5 accent-emerald-600 shrink-0"
                    />
                    <div>
                      <div className="font-bold text-[#071B35]">Approve Artwork for Production</div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Placement, colour &amp; spelling verified final.
                      </p>
                    </div>
                  </label>
                </section>
              </div>
            </div>

            {/* --------------------------------------------------------------- */}
            {/* D. BOTTOM FLOATING DESIGN CONTROL BAR (Desktop/Tablet)          */}
            {/* --------------------------------------------------------------- */}
            <div className="hidden md:flex px-3 xl:px-4 py-2 bg-white border-t border-slate-200 items-center justify-between gap-2 shrink-0 z-10">
              {/* Quick Position Shortcuts */}
              <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-0.5 shrink-0">
                  {activeSide === 'front' ? 'Zone:' : 'Back:'}
                </span>
                {(activeSide === 'front' ? PLAIN_POLO_FRONT_POSITIONS : PLAIN_POLO_BACK_POSITIONS).map((pos) => {
                  const active =
                    activeSide === 'front'
                      ? frontPlacement === pos.id
                      : (pos.id === 'No back print' && noBackPrint) ||
                        (!noBackPrint && backPlacement === pos.id);
                  return (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => applyQuickPosition(activeSide, pos.id)}
                      className={`px-2.5 xl:px-3 py-1.5 rounded-lg text-[11px] xl:text-xs font-semibold whitespace-nowrap border transition-all cursor-pointer shrink-0 ${
                        active
                          ? 'bg-[#071B35] text-white border-[#071B35] shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-[#FF7900]'
                      }`}
                    >
                      {pos.shortLabel}
                    </button>
                  );
                })}
              </div>

              {/* Reset Design Confirmation Action */}
              <div className="flex items-center gap-1.5 shrink-0">
                {resetConfirmOpen ? (
                  <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                    <span className="text-[11px] font-semibold text-rose-700">Reset?</span>
                    <button
                      type="button"
                      onClick={handleResetToOriginal}
                      className="px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-bold cursor-pointer"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setResetConfirmOpen(false)}
                      className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[11px] font-semibold cursor-pointer"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setResetConfirmOpen(true)}
                    className="px-2.5 xl:px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-[11px] xl:text-xs font-semibold text-slate-600 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset<span className="hidden xl:inline"> Design</span></span>
                  </button>
                )}
              </div>
            </div>
          </main>

          {/* ----------------------------------------------------------------- */}
          {/* C. RIGHT LAYERS, VALIDATION & SMART PRICING PANEL (Desktop lg+)   */}
          {/* ----------------------------------------------------------------- */}
          <aside className="hidden lg:flex w-[295px] xl:w-[355px] bg-white border-l border-slate-200 flex-col min-h-0 shrink-0 z-20">
            <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
              {/* 1. LAYERS MANAGER */}
              <section className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#FF7900]" />
                    <h3 className="text-xs font-bold uppercase tracking-wide text-[#071B35]">
                      Layers Stack
                    </h3>
                  </div>
                  <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setLayersTabSide('front');
                        setActiveSide('front');
                      }}
                      className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                        layersTabSide === 'front' ? 'bg-white text-[#071B35] shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      Front ({frontLayers.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLayersTabSide('back');
                        setActiveSide('back');
                      }}
                      className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                        layersTabSide === 'back' ? 'bg-white text-[#FF7900] shadow-2xs' : 'text-slate-500'
                      }`}
                    >
                      Back ({noBackPrint ? 0 : backLayers.length})
                    </button>
                  </div>
                </div>

                {targetLayerList.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 bg-slate-50">
                    {layersTabSide === 'back' && noBackPrint
                      ? 'Back print is currently disabled.'
                      : `No layers on ${layersTabSide}. Upload a logo or add text from the left panel.`}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {targetLayerList.map((layer, index) => {
                      const isSel = selectedLayerId === layer.id;
                      const isRenaming = renamingLayerId === layer.id;
                      return (
                        <div
                          key={layer.id}
                          onClick={() => setSelectedLayerId(layer.id)}
                          className={`rounded-xl border p-2.5 flex items-center justify-between gap-2 transition-all cursor-pointer ${
                            isSel
                              ? 'border-[#FF7900] bg-orange-50/40 ring-1 ring-[#FF7900]/25'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                              {layer.dataUrl ? (
                                <img src={layer.dataUrl} alt="" className="w-full h-full object-contain p-0.5" />
                              ) : layer.kind === 'text' || layer.kind === 'curved-text' ? (
                                <TypeIcon className="w-3.5 h-3.5 text-[#071B35]" />
                              ) : (
                                <ImageIcon className="w-3.5 h-3.5 text-[#FF7900]" />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              {isRenaming ? (
                                <input
                                  type="text"
                                  value={renameDraft}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => setRenameDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setTargetLayerList((prev) =>
                                        prev.map((l) =>
                                          l.id === layer.id ? { ...l, name: renameDraft.trim() || l.name } : l
                                        )
                                      );
                                      setRenamingLayerId(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    setTargetLayerList((prev) =>
                                      prev.map((l) =>
                                        l.id === layer.id ? { ...l, name: renameDraft.trim() || l.name } : l
                                      )
                                    );
                                    setRenamingLayerId(null);
                                  }}
                                  autoFocus
                                  className="w-full px-1.5 py-0.5 text-xs border border-[#FF7900] rounded bg-white"
                                />
                              ) : (
                                <div className="text-xs font-semibold text-slate-900 truncate">
                                  {layer.name || layer.text || 'Artwork Layer'}
                                </div>
                              )}
                              <div className="text-[10px] text-slate-400 font-mono tabular-nums">
                                {Math.round(layer.width)}×{Math.round(layer.height)} · {Math.round(layer.rotation || 0)}°
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingLayerId(layer.id);
                                setRenameDraft(layer.name || layer.text || 'Layer');
                              }}
                              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Rename layer"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setTargetLayerList((prev) =>
                                  prev.map((l) =>
                                    l.id === layer.id ? { ...l, visible: l.visible === false } : l
                                  )
                                )
                              }
                              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Toggle visibility"
                            >
                              {layer.visible === false ? (
                                <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                              ) : (
                                <Eye className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setTargetLayerList((prev) =>
                                  prev.map((l) => (l.id === layer.id ? { ...l, locked: !l.locked } : l))
                                )
                              }
                              className={`p-1 cursor-pointer ${
                                layer.locked ? 'text-[#FF7900]' : 'text-slate-400 hover:text-slate-700'
                              }`}
                              title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                            >
                              {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateLayer(layer)}
                              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                              title="Duplicate layer"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveLayerOrder(index, -1)}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25 cursor-pointer"
                              title="Move backward"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              disabled={index === targetLayerList.length - 1}
                              onClick={() => handleMoveLayerOrder(index, 1)}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-25 cursor-pointer"
                              title="Move forward"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (layer.locked) {
                                  showToast('Unlock layer before deleting');
                                  return;
                                }
                                pushUndoSnapshot('Deleted layer');
                                setTargetLayerList((prev) => prev.filter((l) => l.id !== layer.id));
                                if (selectedLayerId === layer.id) setSelectedLayerId(null);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Delete layer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 2. SMART PRICING & QUANTITY CALCULATOR */}
              <section className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#071B35]">
                    Smart Quantity & Pricing
                  </span>
                  {discountPercent > 0 && (
                    <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      Save {discountPercent}% Bulk
                    </span>
                  )}
                </div>

                {/* Quick Preset Quantity Chips */}
                <div className="grid grid-cols-6 gap-1.5">
                  {PLAIN_POLO_QUICK_QUANTITIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => onQuantityChange(q)}
                      className={`py-1.5 rounded-lg border text-xs font-mono font-bold tabular-nums cursor-pointer ${
                        quantity === q
                          ? 'bg-[#071B35] text-white border-[#071B35]'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-[#FF7900]'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Quantity Stepper + Live Breakdown */}
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => onQuantityChange(Math.max(product.moq || 2, quantity - 1))}
                        className="w-8 h-8 rounded font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={product.moq || 2}
                        value={quantity}
                        onChange={(e) =>
                          onQuantityChange(Math.max(product.moq || 2, parseInt(e.target.value, 10) || 2))
                        }
                        className="w-14 text-center font-mono text-sm font-bold text-[#071B35] focus:outline-hidden tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() => onQuantityChange(quantity + 1)}
                        className="w-8 h-8 rounded font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-extrabold font-display text-[#071B35] tabular-nums">
                        {formatCurrencyINR(livePricing.totalPrice)}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {formatCurrencyINR(livePricing.unitPrice)} / pc · Incl. 18% GST
                      </div>
                    </div>
                  </div>

                  {nextTierUpsell && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 flex items-center justify-between gap-2 text-[11px] text-emerald-900">
                      <span>
                        Add <strong>{nextTierUpsell.diff} more</strong> →{' '}
                        <strong>{formatCurrencyINR(nextTierUpsell.pricePerUnit)}/pc</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => onQuantityChange(nextTierUpsell.minQty)}
                        className="px-2 py-1 rounded bg-emerald-700 text-white font-bold shrink-0 cursor-pointer"
                      >
                        Make {nextTierUpsell.minQty}
                      </button>
                    </div>
                  )}

                  {/* Quick Size Breakdown Toggle */}
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowSizeMatrix((v) => !v)}
                      className="w-full text-left text-[11px] font-semibold text-[#071B35] flex items-center justify-between pt-1 cursor-pointer"
                    >
                      <span>Size Mix Breakdown (S – 4XL)</span>
                      <span className="text-[#FF7900]">{showSizeMatrix ? 'Hide' : 'Customize Sizes'}</span>
                    </button>
                    {showSizeMatrix && product.sizes && (
                      <div className="grid grid-cols-2 gap-1.5 pt-2">
                        {product.sizes.map((sz) => (
                          <div
                            key={sz}
                            className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px]"
                          >
                            <span className="font-semibold text-slate-700">{sz.split(' ')[0]}</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateSizeCount(sz, -1)}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 font-bold cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-mono tabular-nums">
                                {sizeDistribution[sz] || 0}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateSizeCount(sz, 1)}
                                className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 font-bold cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Production & Delivery Notice */}
                <div className="text-[11px] text-slate-600 flex items-center justify-between px-1">
                  <span className="flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#FF7900]" />
                    <span>Dispatch: {product.dispatchTime}</span>
                  </span>
                  <span className="font-medium text-slate-500">Delhivery Express</span>
                </div>
              </section>

              {/* 3. ARTWORK APPROVAL SIGN-OFF */}
              <section className="p-4 space-y-2.5">
                <label
                  className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all cursor-pointer ${
                    artworkApproved
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-[#FF7900]'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={artworkApproved}
                    onChange={(e) => {
                      setArtworkApproved(e.target.checked);
                      showToast(
                        e.target.checked
                          ? 'Artwork marked as Approved for Production'
                          : 'Artwork approval unchecked'
                      );
                    }}
                    className="w-4 h-4 mt-0.5 accent-emerald-600 shrink-0"
                  />
                  <div className="text-xs leading-snug">
                    <div className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Approve Artwork Preview</span>
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      I verify logo placement, colour, and spelling are final for print/embroidery production.
                    </p>
                  </div>
                </label>
              </section>
            </div>

            {/* Bottom Desktop Sticky CTA */}
            <div className="p-4 border-t border-slate-200 bg-white space-y-2 shrink-0">
              <button
                type="button"
                onClick={handleAddToCartFromStudio}
                className="w-full py-3 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] text-white font-display font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Add to Cart · {formatCurrencyINR(livePricing.totalPrice)}</span>
              </button>
              <button
                type="button"
                onClick={handleApplyAndClose}
                className="w-full py-2 rounded-xl border border-slate-300 hover:border-[#071B35] text-xs font-bold text-[#071B35] cursor-pointer"
              >
                Apply Design & Return to Product Page
              </button>
            </div>
          </aside>

          {/* Tablet Right Slide-Over Drawer (Animated, visible on md when opened) */}
          <AnimatePresence>
            {tabletRightOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-40 bg-[#071B35]/50 backdrop-blur-[1.5px] flex justify-end lg:hidden"
                onClick={() => setTabletRightOpen(false)}
              >
                <motion.div
                  initial={{ x: 340 }}
                  animate={{ x: 0 }}
                  exit={{ x: 340 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 34 }}
                  className="w-[345px] max-w-[92vw] bg-white h-full shadow-2xl flex flex-col overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#FF7900]" />
                      <span className="text-xs font-bold text-[#071B35] uppercase">Layers, Sizes &amp; Order</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTabletRightOpen(false)}
                      className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {/* Quick Resize / Transform for Tablet */}
                    {quickResizeTarget && (
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#071B35] truncate">
                            Size: {quickResizeTarget.name || 'Active Layer'}
                          </span>
                          <span className="font-mono font-bold text-[#FF7900] tabular-nums">
                            {isQuickTargetText ? `${quickResizeTarget.fontSize || 14}px` : `${quickTargetScalePercent}%`}
                          </span>
                        </div>
                        {isQuickTargetText ? (
                          <input
                            type="range"
                            min={8}
                            max={36}
                            value={quickResizeTarget.fontSize || 14}
                            onChange={(e) => {
                              if (quickResizeTarget.locked) return;
                              const nextSize = Number(e.target.value);
                              setActiveLayers((prev) =>
                                prev.map((l) => (l.id === quickResizeTarget.id ? { ...l, fontSize: nextSize } : l))
                              );
                            }}
                            className="w-full accent-[#FF7900]"
                          />
                        ) : (
                          <input
                            type="range"
                            min={35}
                            max={210}
                            value={quickTargetScalePercent}
                            onChange={(e) => handleQuickTargetScalePercent(Number(e.target.value))}
                            className="w-full accent-[#FF7900]"
                          />
                        )}
                      </div>
                    )}

                    {/* Front / Back Layers Tabs */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-slate-500">Layers Stack</span>
                        <div className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              setLayersTabSide('front');
                              setActiveSide('front');
                            }}
                            className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                              layersTabSide === 'front' ? 'bg-white text-[#071B35] shadow-2xs' : 'text-slate-500'
                            }`}
                          >
                            Front ({frontLayers.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLayersTabSide('back');
                              setActiveSide('back');
                            }}
                            className={`px-2 py-1 rounded-md font-semibold cursor-pointer ${
                              layersTabSide === 'back' ? 'bg-white text-[#FF7900] shadow-2xs' : 'text-slate-500'
                            }`}
                          >
                            Back ({noBackPrint ? 0 : backLayers.length})
                          </button>
                        </div>
                      </div>

                      {targetLayerList.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 p-3 text-center text-xs text-slate-500 bg-slate-50">
                          No layers on {layersTabSide} view.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {targetLayerList.map((l, index) => (
                            <div
                              key={l.id}
                              onClick={() => setSelectedLayerId(l.id)}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs cursor-pointer ${
                                selectedLayerId === l.id ? 'border-[#FF7900] bg-orange-50/40' : 'border-slate-200 bg-white'
                              }`}
                            >
                              <span className="truncate font-semibold flex-1">{l.name || l.text || 'Layer'}</span>
                              <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTargetLayerList((prev) =>
                                      prev.map((x) => (x.id === l.id ? { ...x, visible: x.visible === false } : x))
                                    )
                                  }
                                  className="p-1.5 text-slate-500"
                                >
                                  {l.visible === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTargetLayerList((prev) =>
                                      prev.map((x) => (x.id === l.id ? { ...x, locked: !x.locked } : x))
                                    )
                                  }
                                  className="p-1.5"
                                >
                                  {l.locked ? <Lock className="w-3.5 h-3.5 text-[#FF7900]" /> : <Unlock className="w-3.5 h-3.5 text-slate-500" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateLayer(l)}
                                  className="p-1.5 text-slate-500"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === 0}
                                  onClick={() => handleMoveLayerOrder(index, -1)}
                                  className="p-1 text-slate-500 disabled:opacity-25"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={index === targetLayerList.length - 1}
                                  onClick={() => handleMoveLayerOrder(index, 1)}
                                  className="p-1 text-slate-500 disabled:opacity-25"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (l.locked) {
                                      showToast('Unlock layer before deleting');
                                      return;
                                    }
                                    setTargetLayerList((prev) => prev.filter((x) => x.id !== l.id));
                                  }}
                                  className="p-1.5 text-rose-600"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quantity & Size Mix */}
                    <div className="space-y-2.5 border-t border-slate-200 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase text-slate-500">Quantity &amp; Bulk Price</span>
                        {discountPercent > 0 && (
                          <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            Save {discountPercent}%
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-6 gap-1">
                        {PLAIN_POLO_QUICK_QUANTITIES.map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => onQuantityChange(q)}
                            className={`py-1.5 rounded-lg border text-xs font-mono font-bold ${
                              quantity === q ? 'bg-[#071B35] text-white border-[#071B35]' : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5">
                          <button
                            type="button"
                            onClick={() => onQuantityChange(Math.max(product.moq || 2, quantity - 1))}
                            className="w-8 h-8 font-bold"
                          >
                            -
                          </button>
                          <span className="w-10 text-center font-mono text-xs font-bold tabular-nums">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => onQuantityChange(quantity + 1)}
                            className="w-8 h-8 font-bold"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-extrabold text-[#071B35] tabular-nums">
                            {formatCurrencyINR(livePricing.totalPrice)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 tabular-nums">
                            {formatCurrencyINR(livePricing.unitPrice)}/pc · Incl. 18% GST
                          </div>
                        </div>
                      </div>

                      {nextTierUpsell && (
                        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2 flex items-center justify-between gap-2 text-[11px] text-emerald-900">
                          <span>
                            Add <strong>{nextTierUpsell.diff} more</strong> →{' '}
                            <strong>{formatCurrencyINR(nextTierUpsell.pricePerUnit)}/pc</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => onQuantityChange(nextTierUpsell.minQty)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold shrink-0 cursor-pointer"
                          >
                            Make {nextTierUpsell.minQty}
                          </button>
                        </div>
                      )}

                      {product.sizes && (
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          {product.sizes.map((sz) => (
                            <div
                              key={sz}
                              className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-2 py-1 text-[11px]"
                            >
                              <span className="font-semibold text-slate-700">{sz.split(' ')[0]}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateSizeCount(sz, -1)}
                                  className="w-6 h-6 rounded bg-slate-100 font-bold"
                                >
                                  -
                                </button>
                                <span className="w-5 text-center font-mono tabular-nums">
                                  {sizeDistribution[sz] || 0}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateSizeCount(sz, 1)}
                                  className="w-6 h-6 rounded bg-slate-100 font-bold"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Artwork Approval */}
                    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={artworkApproved}
                        onChange={(e) => setArtworkApproved(e.target.checked)}
                        className="w-4 h-4 mt-0.5 accent-emerald-600 shrink-0"
                      />
                      <div>
                        <div className="font-bold text-[#071B35]">Approve Artwork Preview</div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Logo placement, colour &amp; spelling verified for production.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-white space-y-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleAddToCartFromStudio}
                      className="w-full py-2.5 rounded-xl bg-[#FF7900] text-white text-xs font-bold cursor-pointer min-h-[42px]"
                    >
                      Add to Cart · {formatCurrencyINR(livePricing.totalPrice)}
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyAndClose}
                      className="w-full py-2 rounded-xl border border-slate-300 text-[#071B35] text-xs font-bold cursor-pointer"
                    >
                      Apply &amp; Return to Product Page
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ===================================================================== */}
        {/* MOBILE COMPACT STICKY ACTION FOOTER (<md)                             */}
        {/* ===================================================================== */}
        <div className="md:hidden shrink-0 bg-white border-t border-slate-200 px-3 py-2 flex items-center justify-between gap-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] z-30">
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-[#071B35] font-mono tabular-nums leading-tight">
              {formatCurrencyINR(livePricing.totalPrice)}
            </div>
            <div className="text-[10px] text-slate-500 font-mono tabular-nums truncate">
              {formatCurrencyINR(livePricing.unitPrice)}/pc · {quantity} pcs
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => scrollMobileToSection('top')}
              className="px-2.5 py-2 rounded-xl bg-slate-100 text-[11px] font-bold text-[#071B35] min-h-[40px] whitespace-nowrap"
              title="Scroll up to Polo Preview"
            >
              ↑ Polo
            </button>
            <button
              type="button"
              onClick={handleApplyAndClose}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-[#071B35] min-h-[40px] whitespace-nowrap"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleAddToCartFromStudio}
              className="px-4 py-2 rounded-xl bg-[#FF7900] text-white text-xs font-bold flex items-center gap-1.5 min-h-[40px] whitespace-nowrap shadow-xs"
            >
              <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* CUSTOMER FEATURE MODALS & DRAWERS                                     */}
        {/* ===================================================================== */}
        <PlainPoloMagicEraserModal
          isOpen={isMagicEraserOpen}
          onClose={() => setIsMagicEraserOpen(false)}
          sourceDataUrl={activeRawUrl || ''}
          initialActions={activeCleanup.eraserActions}
          onApplyActions={(actions) =>
            setActiveCleanup((prev) => ({ ...prev, eraserActions: actions }))
          }
        />

        <SaveDesignModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          defaultName={`${selectedColor.name} Plain Polo · ${frontPlacement}`}
          colorName={selectedColor.name}
          quantity={quantity}
          printMethod={selectedPrintMethod}
          onSave={handleSaveDesignSubmit}
        />

        <SavedDesignsDrawer
          isOpen={isSavedDrawerOpen}
          onClose={() => setIsSavedDrawerOpen(false)}
          designs={savedDesigns}
          onLoadDesign={handleLoadSavedDesign}
          onDuplicateDesign={(d) => {
            const dup: SavedPlainPoloDesign = {
              ...d,
              id: createStudioUid('design'),
              name: `${d.name} (Copy)`,
              updatedAt: new Date().toISOString(),
            };
            const next = [dup, ...savedDesigns];
            setSavedDesigns(next);
            persistSavedPlainPoloDesigns(next);
            showToast(`Duplicated "${d.name}"`);
          }}
          onRenameDesign={(id, nextName) => {
            const next = savedDesigns.map((d) => (d.id === id ? { ...d, name: nextName } : d));
            setSavedDesigns(next);
            persistSavedPlainPoloDesigns(next);
          }}
          onDeleteDesign={(id) => {
            const next = savedDesigns.filter((d) => d.id !== id);
            setSavedDesigns(next);
            persistSavedPlainPoloDesigns(next);
          }}
        />

        <CompareDesignsModal
          isOpen={isCompareOpen}
          onClose={() => setIsCompareOpen(false)}
          availableColors={product.colors}
          currentColor={selectedColor}
          currentQuantity={quantity}
          currentPrintMethod={selectedPrintMethod}
          currentFrontPlacement={frontPlacement}
          currentBackPlacement={backPlacement}
          currentNoBackPrint={noBackPrint}
          currentFrontLayers={frontLayers}
          currentBackLayers={backLayers}
          savedDesigns={savedDesigns}
          onLoadSavedDesign={handleLoadSavedDesign}
          onSwitchColor={(color) => {
            pushUndoSnapshot(`Switched to ${color.name}`);
            onSelectColor(color);
          }}
        />

        <DesignHistoryDrawer
          isOpen={isHistoryDrawerOpen}
          onClose={() => setIsHistoryDrawerOpen(false)}
          versions={versionHistory}
          onRestoreVersion={(ver) => {
            pushUndoSnapshot(`Restored "${ver.label}"`);
            applySnapshot(ver.snapshot);
            showToast(`Restored checkpoint: ${ver.label}`);
          }}
          onCreateCheckpoint={() => {
            pushUndoSnapshot(`Checkpoint (${selectedColor.name})`);
            showToast('Created design checkpoint');
          }}
        />
      </div>
    </MotionConfig>
  );
};
