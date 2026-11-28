import React, { useEffect, useRef, useState } from 'react';
import { triggerCelebration } from '../../services/celebrationService';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Heart,
  HelpCircle,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Package,
  Palette,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trash2,
  Truck,
  Upload,
  User,
  X,
} from 'lucide-react';
import {
  BulkEnquirySubmission,
  CustomerArtwork,
  NotificationPreferences,
  Order,
  Product,
  SavedAddress,
  TaxInvoice,
  UserProfile,
} from '../../types';
import { PRODUCTS } from '../../data/mockData';
import { BUSINESS_CONFIG, getWhatsAppLink } from '../../config/business';
import { supabase } from '../../lib/supabase';
import { evaluatePasswordStrength } from '../../utils/passwordStrength';
import { submitCustomOrderQuote, uploadBrandLogoToStorage } from '../../services/supabaseService';
import { DelhiveryTrackResponse, trackDelhiveryWaybill } from '../../services/paymentAndLogisticsService';
import { generateOrderTaxInvoicePdf, generateTaxInvoicePdf } from '../../utils/pdfGenerator';
import { WhatsAppIcon } from '../WhatsAppIcon';
import { AssetPreviewThumb } from './CustomerVisuals';
import { CustomerTwoStepCard } from './CustomerTwoStepCard';
import {
  AccountSubSection,
  formatFileSize,
  getOrderStatusBadgeMeta,
  getThumbnailForOrder,
  isValidGstin,
  validateBrandAssetFile,
} from './customerUtils';

// ============================================================================
// 1. ORDER DETAIL SLIDE-OVER DRAWER
// ============================================================================
export const OrderDetailDrawer: React.FC<{
  order: Order | null;
  onClose: () => void;
  onOpenProofStudio: (order: Order) => void;
  onTrackOrder: (order: Order) => void;
  onReorder: (order: Order) => void;
  onToast: (msg: string, variant?: 'success' | 'error' | 'info') => void;
}> = ({ order, onClose, onOpenProofStudio, onTrackOrder, onReorder, onToast }) => {
  if (!order) return null;
  const statusMeta = getOrderStatusBadgeMeta(order.orderStatus);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0B1530]/60 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`Order ${order.orderNumber} details`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl border-l border-slate-200 flex flex-col animate-admin-slide-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0B1530] text-white px-5 py-4 flex items-center justify-between border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold font-display text-[#FF7900]">
                #{order.orderNumber}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusMeta.pillClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`} />
                {statusMeta.label}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Placed on{' '}
              {new Date(order.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order details"
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 flex-1">
          {/* Action Quick Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenProofStudio(order);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0B1530] hover:bg-[#132550] text-white text-xs font-semibold cursor-pointer min-h-[44px]"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#FF7900]" />
              <span>Proof Studio</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onTrackOrder(order);
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer min-h-[44px]"
            >
              <Truck className="w-3.5 h-3.5 text-[#FF7900]" />
              <span>Track</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const ok = generateOrderTaxInvoicePdf(order);
                onToast(
                  ok ? `Downloaded Tax Invoice for #${order.orderNumber}` : 'Unable to generate PDF',
                  ok ? 'success' : 'error'
                );
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold cursor-pointer min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tax PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onReorder(order);
                onClose();
                onToast(`Added items from #${order.orderNumber} to cart`, 'success');
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] text-white text-xs font-semibold cursor-pointer min-h-[44px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reorder</span>
            </button>
          </div>

          {/* Items Breakdown */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Line Items & Custom Branding ({order.items.length})
            </h4>
            {order.items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex gap-3.5"
              >
                <AssetPreviewThumb
                  src={
                    item.previewUrl ||
                    item.color?.imageFront ||
                    item.product?.colors?.[0]?.imageFront ||
                    item.artwork?.dataUrl
                  }
                  alt={item.product.name}
                  className="w-16 h-16 rounded-xl bg-white"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-[#0B1530] leading-snug">
                    {item.product.name}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-semibold tabular-nums">
                      {item.quantity} pcs
                    </span>
                    {item.color?.name && (
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                        Color: {item.color.name}
                      </span>
                    )}
                    {item.size && (
                      <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                        Size: {item.size}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                      {item.printMethod}
                    </span>
                    {item.printPlacement && (
                      <span className="px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200/70">
                        {item.printPlacement}
                      </span>
                    )}
                  </div>
                  {item.customNotes && (
                    <p className="text-[11px] text-slate-500 mt-1.5 italic">
                      Note: {item.customNotes}
                    </p>
                  )}
                  {(item.voiceNoteUrl || order.orderVoiceNoteUrl) && (
                    <div className="mt-2 bg-emerald-50/80 border border-emerald-200 rounded-lg p-2 space-y-1">
                      <div className="text-[10px] font-semibold text-emerald-700">
                        🎙️ Voice Instructions
                      </div>
                      <audio
                        controls
                        src={item.voiceNoteUrl || order.orderVoiceNoteUrl}
                        className="w-full h-8 rounded-md"
                      />
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between text-xs font-bold text-[#0B1530] tabular-nums">
                    <span className="text-slate-500 font-medium">
                      ₹{item.unitPrice.toLocaleString('en-IN')}/pc
                    </span>
                    <span>₹{item.totalPrice.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Payment & Tax Summary */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Payment & GST Summary
            </h4>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Payment Mode</span>
              <span className="font-semibold text-[#0B1530]">{order.paymentMode}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>Payment Status</span>
              <span className="font-semibold text-emerald-700">{order.paymentStatus}</span>
            </div>
            {order.razorpayPaymentId && (
              <div className="flex justify-between text-xs text-slate-600">
                <span>Razorpay Ref</span>
                <span className="font-mono text-slate-800">{order.razorpayPaymentId}</span>
              </div>
            )}
            <hr className="border-slate-100" />
            <div className="flex justify-between text-xs text-slate-600 tabular-nums">
              <span>Taxable Subtotal</span>
              <span>₹{Math.round(order.subtotal).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600 tabular-nums">
              <span>GST (18% SAC 9989)</span>
              <span>₹{Math.round(order.gstAmount).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600 tabular-nums">
              <span>Courier Shipping</span>
              <span>{order.shippingFee === 0 ? 'FREE' : `₹${order.shippingFee}`}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-[#0B1530] pt-1 border-t border-slate-200 tabular-nums">
              <span>Grand Total</span>
              <span>₹{Math.round(order.total).toLocaleString('en-IN')}</span>
            </div>
            {typeof order.balanceDue === 'number' && order.balanceDue > 0 && (
              <div className="flex justify-between text-xs font-bold text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 tabular-nums">
                <span>Balance Due (Before Final Dispatch)</span>
                <span>₹{Math.round(order.balanceDue).toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          {/* Delivery Address & Courier */}
          <div className="rounded-2xl border border-slate-200 p-4 space-y-2 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Delivery & Dispatch
            </h4>
            <div className="text-xs font-bold text-[#0B1530]">
              {order.shippingAddress.fullName}
              {order.shippingAddress.companyName ? ` • ${order.shippingAddress.companyName}` : ''}
            </div>
            <div className="text-xs text-slate-600">
              {order.shippingAddress.street}, {order.shippingAddress.city},{' '}
              {order.shippingAddress.state} - {order.shippingAddress.pincode}
            </div>
            <div className="text-xs text-slate-500">
              {order.shippingAddress.phone}
              {order.shippingAddress.gstin ? ` • GSTIN: ${order.shippingAddress.gstin}` : ''}
            </div>
            {order.trackingNumber && (
              <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">
                  {order.courierPartner || 'Delhivery One'}: {order.trackingNumber}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onTrackOrder(order);
                  }}
                  className="text-[#FF7900] font-bold hover:underline cursor-pointer"
                >
                  Live Scan →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 2. TRACK CONSIGNMENT VIEW (LIVE DELHIVERY ONE + PRODUCTION MILESTONES)
// ============================================================================
export const CustomerTrackConsignmentView: React.FC<{
  orders: Order[];
  selectedOrder: Order | null;
  onSelectOrder: (order: Order) => void;
  onToast: (msg: string, variant?: 'success' | 'error' | 'info') => void;
}> = ({ orders, selectedOrder, onSelectOrder, onToast }) => {
  const activeOrder = selectedOrder || orders[0] || null;
  const [copied, setCopied] = useState(false);
  const [liveTrack, setLiveTrack] = useState<DelhiveryTrackResponse | null>(null);
  const [isFetchingTrack, setIsFetchingTrack] = useState(false);

  const handleCopyAwb = (awb: string) => {
    navigator.clipboard.writeText(awb);
    setCopied(true);
    onToast('AWB number copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 1800);
  };

  const handleFetchLiveDelhivery = async () => {
    if (!activeOrder?.trackingNumber) return;
    setIsFetchingTrack(true);
    const res = await trackDelhiveryWaybill(activeOrder.trackingNumber);
    setLiveTrack(res);
    setIsFetchingTrack(false);
    if (!res.success && res.message) {
      onToast(res.message, 'info');
    }
  };

  useEffect(() => {
    setLiveTrack(null);
  }, [activeOrder?.id]);

  if (!activeOrder) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
        <Truck className="w-12 h-12 text-slate-300 mx-auto" />
        <h3 className="text-lg font-bold text-[#0B1530] font-display">
          No Active Consignments Yet
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Once you place an order, real-time factory milestones and courier AWB scans will appear here.
        </p>
      </div>
    );
  }

  const stageIndex =
    activeOrder.orderStatus === 'Delivered'
      ? 5
      : activeOrder.orderStatus === 'Dispatched'
        ? 4
        : activeOrder.orderStatus === 'Quality Check'
          ? 3
          : activeOrder.orderStatus === 'Manufacturing'
            ? 2
            : activeOrder.orderStatus === 'Confirmed'
              ? 1
              : 0;

  const milestones = [
    { label: 'Order Placed', desc: 'Order specs & files received' },
    { label: 'Artwork Proof Review', desc: 'Pre-press dimensions & color check' },
    { label: 'Approved & Printing', desc: 'Active factory production line' },
    { label: 'Quality Check', desc: 'Multi-point stitch & print inspection' },
    { label: 'Dispatched via Courier', desc: activeOrder.courierPartner || 'Delhivery One Express' },
    { label: 'Delivered', desc: 'Handed over at delivery address' },
  ];

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1530] font-display flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#FF7900]" />
            <span>Track Consignment</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time manufacturing stages & live Delhivery courier telemetry
          </p>
        </div>

        <select
          aria-label="Select order to track"
          value={activeOrder.id}
          onChange={(e) => {
            const found = orders.find((o) => o.id === e.target.value);
            if (found) onSelectOrder(found);
          }}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900] min-h-[44px]"
        >
          {orders.map((o) => (
            <option key={o.id} value={o.id}>
              #{o.orderNumber} — {o.items[0]?.product?.name?.slice(0, 26) || 'Custom Order'} ({o.orderStatus})
            </option>
          ))}
        </select>
      </div>

      {/* Dark Navy AWB Hero Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0B1530] via-[#0F1E45] to-[#071B35] text-white p-5 sm:p-6 border border-white/10 shadow-lg relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-[#FF7900]/20 blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#FF7900]/20 text-[#FF9D42] border border-[#FF7900]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF7900]" />
              {activeOrder.orderStatus}
            </span>
            <h3 className="text-lg sm:text-xl font-bold font-display">
              Order #{activeOrder.orderNumber}
            </h3>
            <p className="text-xs text-slate-300">
              {activeOrder.items.map((i) => `${i.quantity}x ${i.product.name.split('–')[0].trim()}`).join(', ')}
            </p>
            <p className="text-xs text-slate-400">
              Destination: {activeOrder.shippingAddress.city}, {activeOrder.shippingAddress.state} —{' '}
              {activeOrder.shippingAddress.pincode}
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <div className="text-[11px] text-slate-300 font-medium">
                {activeOrder.courierPartner || 'Delhivery One Air'} AWB
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="font-mono text-sm sm:text-base font-bold text-white">
                  {activeOrder.trackingNumber || 'Awaiting Dispatch Manifest'}
                </span>
                {activeOrder.trackingNumber && (
                  <button
                    type="button"
                    onClick={() => handleCopyAwb(activeOrder.trackingNumber!)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                    aria-label="Copy AWB number"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {activeOrder.trackingNumber && (
              <button
                type="button"
                onClick={handleFetchLiveDelhivery}
                disabled={isFetchingTrack}
                className="px-4 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isFetchingTrack ? 'animate-spin' : ''}`} />
                <span>{isFetchingTrack ? 'Syncing Scans...' : 'Refresh Live Scan'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Delhivery Scans if fetched */}
      {liveTrack && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[#0B1530] font-display">
              Live Courier Telemetry ({liveTrack.waybill})
            </h4>
            {liveTrack.currentStatus && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                {liveTrack.currentStatus}
              </span>
            )}
          </div>
          {liveTrack.scans.length > 0 ? (
            <div className="space-y-2.5">
              {liveTrack.scans.map((scan, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
                >
                  <div>
                    <span className="font-bold text-[#0B1530]">{scan.status}</span>
                    {scan.instructions && <span className="text-slate-600 ml-2">— {scan.instructions}</span>}
                  </div>
                  <div className="text-slate-500 font-medium">
                    {scan.location} • {scan.time}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              {liveTrack.message || 'Courier scans will populate once the parcel is picked up from our Hyderabad plant.'}
            </p>
          )}
        </div>
      )}

      {/* 6-Stage Production & Logistics Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
        <h4 className="text-sm font-bold text-[#0B1530] font-display mb-4">
          Production & Dispatch Milestones
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {milestones.map((m, idx) => {
            const done = idx <= stageIndex;
            const current = idx === stageIndex;
            return (
              <div
                key={m.label}
                className={`p-3.5 rounded-2xl border transition-all ${
                  current
                    ? 'bg-orange-50/70 border-[#FF7900]/50 shadow-xs'
                    : done
                      ? 'bg-emerald-50/50 border-emerald-200/80'
                      : 'bg-slate-50/70 border-slate-200/70 opacity-75'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      current
                        ? 'bg-[#FF7900] text-white'
                        : done
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {done && !current ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0B1530] truncate">{m.label}</div>
                    <div className="text-[11px] text-slate-500 truncate">{m.desc}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 3. BRAND ASSETS & ARTWORK MANAGER VIEW
// ============================================================================
export const CustomerBrandAssetsView: React.FC<{
  mode: 'artworks' | 'brand-assets';
  assets: CustomerArtwork[];
  onAddAsset: (asset: CustomerArtwork) => void;
  onReplaceAsset: (assetId: string, updated: CustomerArtwork) => void;
  onDeleteAsset: (assetId: string) => void;
  onApplyAssetToProduct: (asset: CustomerArtwork, productId: string) => void;
  onToast: (msg: string, variant?: 'success' | 'error' | 'info') => void;
}> = ({ mode, assets, onAddAsset, onReplaceAsset, onDeleteAsset, onApplyAssetToProduct, onToast }) => {
  const [titleInput, setTitleInput] = useState('');
  const [categoryInput, setCategoryInput] = useState<'company' | 'personal'>('company');
  const [filterCat, setFilterCat] = useState<'all' | 'company' | 'personal' | 'artwork'>(
    mode === 'brand-assets' ? 'company' : 'all'
  );
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<CustomerArtwork | null>(null);
  const [applyTargetProduct, setApplyTargetProduct] = useState<string>(PRODUCTS[0].id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);

  useEffect(() => {
    setFilterCat(mode === 'brand-assets' ? 'all' : 'all');
  }, [mode]);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const handleUploadFile = async (file: File, replaceTargetId?: string) => {
    const check = validateBrandAssetFile(file);
    if (!check.valid) {
      onToast(check.error || 'Invalid file', 'error');
      return;
    }

    setUploadProgress(20);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const fileType: CustomerArtwork['fileType'] =
      ext === 'pdf' ? 'pdf' : ext === 'svg' ? 'svg' : 'png';

    let finalUrl = '';
    let storagePath: string | undefined;
    let isCloudSynced = false;

    try {
      setUploadProgress(50);
      const uploaded = await uploadBrandLogoToStorage(file, file.name);
      finalUrl = uploaded.publicUrl;
      storagePath = uploaded.filePath;
      isCloudSynced = true;
      setUploadProgress(95);
    } catch {
      // Fallback safely to Data URL when cloud storage is unconfigured or offline
      try {
        finalUrl = await readFileAsDataUrl(file);
        setUploadProgress(90);
      } catch {
        setUploadProgress(null);
        onToast('Could not process the selected file. Please try again.', 'error');
        return;
      }
    }

    const baseTitle =
      titleInput.trim() || file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');

    if (replaceTargetId) {
      const existing = assets.find((a) => a.id === replaceTargetId);
      if (existing) {
        onReplaceAsset(replaceTargetId, {
          ...existing,
          fileName: file.name,
          fileType,
          fileSize: formatFileSize(file.size),
          mimeType: file.type || undefined,
          previewUrl: finalUrl,
          storagePath,
          isCloudSynced,
          uploadedAt: new Date().toISOString().slice(0, 10),
        });
        if (isCloudSynced) {
          onToast(`Updated "${existing.title}" successfully`, 'success');
          triggerCelebration({
            level: 'premium',
            sound: 'celebration',
            eventKey: `brand-asset-replace:${replaceTargetId}:${storagePath || finalUrl}`,
            dedupeWindowMs: 1500,
            action: 'brand_asset_uploaded',
          });
        } else {
          onToast(
            'File preview saved locally only. It has not been uploaded or synced to the server.',
            'info'
          );
        }
      }
    } else {
      const newAsset: CustomerArtwork = {
        id: `asset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: baseTitle,
        fileType,
        fileName: file.name,
        fileSize: formatFileSize(file.size),
        resolution:
          fileType === 'svg'
            ? 'Infinite Vector (SVG)'
            : fileType === 'pdf'
              ? 'Print-Ready Vector PDF'
              : 'High-Resolution Print Asset',
        uploadedAt: new Date().toISOString().slice(0, 10),
        status: 'Approved for Production',
        previewUrl: finalUrl,
        associatedOrdersCount: 0,
        category: categoryInput,
        mimeType: file.type || undefined,
        storagePath,
        isCloudSynced,
      };
      onAddAsset(newAsset);
      setTitleInput('');
      if (isCloudSynced) {
        onToast(`Uploaded "${newAsset.title}" (${newAsset.fileSize})`, 'success');
        triggerCelebration({
          level: 'premium',
          sound: 'celebration',
          eventKey: `brand-asset-upload:${newAsset.id}`,
          dedupeWindowMs: 1500,
          action: 'brand_asset_uploaded',
        });
      } else {
        onToast(
          'File preview saved locally only. It has not been uploaded or synced to the server.',
          'info'
        );
      }
    }

    setTimeout(() => setUploadProgress(null), 350);
  };

  const handleDownloadAsset = (asset: CustomerArtwork) => {
    const a = document.createElement('a');
    a.href = asset.previewUrl;
    a.download = asset.fileName || `${asset.title}.${asset.fileType}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const visibleAssets = assets.filter((a) => {
    if (filterCat === 'all') return true;
    return (a.category || 'company') === filterCat;
  });

  return (
    <div className="space-y-5">
      {/* Header & Drag-and-Drop Upload Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#0B1530] font-display flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#FF7900]" />
              <span>{mode === 'brand-assets' ? 'My Brand Assets' : 'My Artwork & Logos'}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload company or personal logos (.PNG, .JPG, .JPEG, .SVG, .PDF up to 15 MB) and apply them in 1 click.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'all', label: `All (${assets.length})` },
                { key: 'company', label: 'Company Logos' },
                { key: 'personal', label: 'Personal Logos' },
                { key: 'artwork', label: 'Order Artworks' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterCat(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  filterCat === tab.key
                    ? 'bg-[#0B1530] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) handleUploadFile(dropped);
          }}
          className={`rounded-2xl border-2 border-dashed p-5 transition-all ${
            isDragging
              ? 'border-[#FF7900] bg-orange-50/70'
              : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
          }`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-5 space-y-2.5">
              <label className="block text-xs font-bold text-[#0B1530]">
                Asset Name (optional)
              </label>
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                placeholder="e.g. Primary Brand Vector Logo"
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryInput('company')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                    categoryInput === 'company'
                      ? 'bg-[#0B1530] text-white border-[#0B1530]'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  Company Asset
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryInput('personal')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                    categoryInput === 'personal'
                      ? 'bg-[#0B1530] text-white border-[#0B1530]'
                      : 'bg-white text-slate-600 border-slate-200'
                  }`}
                >
                  Personal Logo
                </button>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200/80 p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-50 border border-orange-200 text-[#FF7900] flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0B1530]">
                    Drag & drop logo or artwork here
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    PNG, JPG, JPEG, SVG, PDF supported • Max 15 MB
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadFile(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer min-h-[44px] shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Select File</span>
              </button>
            </div>
          </div>

          {uploadProgress !== null && (
            <div className="mt-3">
              <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                <span>Uploading & verifying brand asset...</span>
                <span className="tabular-nums">{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#FF7900] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Replace Input */}
      <input
        ref={replaceInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.svg,.pdf,image/png,image/jpeg,image/svg+xml,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && replacingId) handleUploadFile(file, replacingId);
          setReplacingId(null);
          e.target.value = '';
        }}
      />

      {/* Assets Grid */}
      {visibleAssets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
          <Palette className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-[#0B1530]">No logos uploaded in this folder yet</h3>
          <p className="text-xs text-slate-500">
            Upload your brand logo above or customize a product so your artwork appears here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleAssets.map((asset) => (
            <div
              key={asset.id}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col justify-between gap-3 hover:border-[#FF7900]/40 hover:shadow-md transition-all"
            >
              <div className="flex items-start gap-3">
                <AssetPreviewThumb
                  src={asset.previewUrl}
                  alt={asset.title}
                  isPdf={asset.fileType === 'pdf'}
                  className="w-16 h-16 rounded-xl"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-bold text-[#0B1530] truncate">{asset.title}</h4>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">
                      {asset.fileType}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {asset.fileName} • {asset.fileSize}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        asset.status === 'Approved for Production'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {asset.status}
                    </span>
                    {asset.isCloudSynced && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                        Cloud Synced
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedPreview(asset)}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    title="Preview file"
                    aria-label={`Preview ${asset.title}`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadAsset(asset)}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    title="Download file"
                    aria-label={`Download ${asset.title}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplacingId(asset.id);
                      replaceInputRef.current?.click();
                    }}
                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                    title="Replace file"
                    aria-label={`Replace ${asset.title}`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  {!asset.id.startsWith('order-art-') && (
                    <button
                      type="button"
                      onClick={() => onDeleteAsset(asset.id)}
                      className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                      title="Delete asset"
                      aria-label={`Delete ${asset.title}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onApplyAssetToProduct(asset, applyTargetProduct)}
                  className="px-3 py-1.5 rounded-xl bg-[#0B1530] hover:bg-[#132550] text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 text-[#FF7900]" />
                  <span>Use on Product</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1-click Apply Product Selector bar */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-600 font-medium">
          Target product when clicking <strong className="text-[#0B1530]">Use on Product</strong>:
        </div>
        <select
          aria-label="Target product for 1-click logo application"
          value={applyTargetProduct}
          onChange={(e) => setApplyTargetProduct(e.target.value)}
          className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
        >
          {PRODUCTS.slice(0, 8).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name.split('–')[0].split('|')[0].trim()}
            </option>
          ))}
        </select>
      </div>

      {/* Asset Preview Modal */}
      {selectedPreview && (
        <div
          className="fixed inset-0 z-50 bg-[#0B1530]/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedPreview(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-admin-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#0B1530] text-white px-5 py-4 flex items-center justify-between">
              <div className="min-w-0">
                <h4 className="text-sm font-bold truncate">{selectedPreview.title}</h4>
                <p className="text-[11px] text-slate-300 truncate">
                  {selectedPreview.fileName} • {selectedPreview.fileSize} • {selectedPreview.resolution}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreview(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                aria-label="Close preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 bg-slate-50 flex items-center justify-center min-h-[260px]">
              {selectedPreview.fileType === 'pdf' ? (
                <div className="text-center space-y-3">
                  <FileText className="w-16 h-16 text-red-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">{selectedPreview.fileName}</p>
                  <button
                    type="button"
                    onClick={() => handleDownloadAsset(selectedPreview)}
                    className="px-4 py-2 rounded-xl bg-[#FF7900] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Open / Download PDF</span>
                  </button>
                </div>
              ) : (
                <img
                  src={selectedPreview.previewUrl}
                  alt={selectedPreview.title}
                  referrerPolicy="no-referrer"
                  className="max-h-[340px] w-auto object-contain rounded-xl shadow-xs bg-white p-3 border border-slate-200"
                />
              )}
            </div>
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleDownloadAsset(selectedPreview)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = selectedPreview;
                  setSelectedPreview(null);
                  onApplyAssetToProduct(target, applyTargetProduct);
                }}
                className="px-4 py-2 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] text-white text-xs font-bold cursor-pointer"
              >
                Apply to Product →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. SAVED ADDRESSES VIEW (ADD / EDIT / DELETE / DEFAULT)
// ============================================================================
export const CustomerAddressesView: React.FC<{
  user: UserProfile;
  addresses: SavedAddress[];
  onSaveAddresses: (next: SavedAddress[]) => void;
  onToast: (msg: string, variant?: 'success' | 'error' | 'info') => void;
}> = ({ user, addresses, onSaveAddresses, onToast }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SavedAddress | null>(null);
  const [form, setForm] = useState({
    title: 'Home / Office',
    fullName: user.name,
    companyName: user.companyName || '',
    phone: user.mobile || '',
    street: '',
    city: '',
    state: '',
    pincode: '',
    type: 'both' as 'shipping' | 'billing' | 'both',
    isDefault: false,
  });

  const openAdd = () => {
    setEditing(null);
    setForm({
      title: 'Delivery Address',
      fullName: user.name,
      companyName: user.companyName || '',
      phone: user.mobile || '',
      street: '',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      type: 'both',
      isDefault: addresses.length === 0,
    });
    setModalOpen(true);
  };

  const openEdit = (addr: SavedAddress) => {
    setEditing(addr);
    setForm({
      title: addr.title,
      fullName: addr.fullName,
      companyName: addr.companyName || '',
      phone: addr.phone,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      type: addr.type,
      isDefault: addr.isDefault,
    });
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.street.trim() || !form.city.trim() || !form.pincode.trim()) {
      onToast('Please complete street, city, and 6-digit pincode', 'error');
      return;
    }

    let next: SavedAddress[];
    if (editing) {
      next = addresses.map((a) =>
        a.id === editing.id ? { ...a, ...form } : form.isDefault ? { ...a, isDefault: false } : a
      );
      onToast('Address updated successfully', 'success');
    } else {
      const created: SavedAddress = {
        id: `addr-${Date.now()}`,
        ...form,
      };
      next = form.isDefault
        ? [created, ...addresses.map((a) => ({ ...a, isDefault: false }))]
        : [created, ...addresses];
      onToast('New address saved', 'success');
    }
    onSaveAddresses(next);
    setModalOpen(false);
    triggerCelebration({
      level: 'subtle',
      sound: 'pop',
      eventKey: `address-save:${editing ? editing.id : 'new'}:${Date.now()}`,
      dedupeWindowMs: 1500,
      action: editing ? 'address_updated' : 'address_added',
    });
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#0B1530] font-display flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#FF7900]" />
            <span>Saved Delivery & Billing Addresses</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage personal, home, warehouse, and corporate office addresses for fast checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="px-4 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Address</span>
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
          <MapPin className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-[#0B1530]">No saved addresses yet</p>
          <p className="text-xs text-slate-500">Add your delivery address to speed up orders.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {addresses.map((addr) => (
            <div
              key={addr.id}
              className={`bg-white rounded-2xl border p-5 flex flex-col justify-between gap-3 transition-all ${
                addr.isDefault ? 'border-[#FF7900] shadow-sm' : 'border-slate-200/80'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold text-[#0B1530]">{addr.title}</span>
                  <div className="flex items-center gap-1">
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-[#FF7900] border border-orange-200">
                        Default
                      </span>
                    )}
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {addr.type}
                    </span>
                  </div>
                </div>
                <div className="mt-2.5 text-xs font-semibold text-slate-800">{addr.fullName}</div>
                {addr.companyName && (
                  <div className="text-[11px] text-slate-500">{addr.companyName}</div>
                )}
                <div className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                  {addr.street}, {addr.city}, {addr.state} — {addr.pincode}
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5 font-medium">{addr.phone}</div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {!addr.isDefault ? (
                  <button
                    type="button"
                    onClick={() => {
                      onSaveAddresses(addresses.map((a) => ({ ...a, isDefault: a.id === addr.id })));
                      onToast(`Set "${addr.title}" as default address`, 'success');
                    }}
                    className="text-xs font-semibold text-[#FF7900] hover:underline cursor-pointer"
                  >
                    Set as Default
                  </button>
                ) : (
                  <span className="text-[11px] font-semibold text-emerald-600 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active Default
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(addr)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSaveAddresses(addresses.filter((a) => a.id !== addr.id));
                      onToast('Address removed', 'info');
                    }}
                    aria-label={`Delete ${addr.title}`}
                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Address Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#0B1530]/65 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalOpen(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 animate-admin-scale-in max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#0B1530] font-display">
                {editing ? 'Edit Address' : 'Add Delivery / Billing Address'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600">Address Label</label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Recipient Name</label>
                <input
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Company (Optional)</label>
                <input
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Contact Phone</label>
                <input
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600">Street / Building</label>
                <input
                  required
                  value={form.street}
                  onChange={(e) => setForm({ ...form, street: e.target.value })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">City</label>
                <input
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">State</label>
                <input
                  required
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Pincode</label>
                <input
                  required
                  maxLength={6}
                  value={form.pincode}
                  onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/[^0-9]/g, '') })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530]"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Address Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530]"
                >
                  <option value="both">Shipping & Billing</option>
                  <option value="shipping">Shipping Only</option>
                  <option value="billing">Billing Only</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                className="rounded accent-[#FF7900]"
              />
              <span>Use as default checkout address</span>
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] text-white text-xs font-bold cursor-pointer"
              >
                Save Address
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 5. GST & TAX INVOICES VIEW (REAL DERIVED INVOICES + OPTIONAL BUSINESS GSTIN)
// ============================================================================
export const CustomerGstInvoicesView: React.FC<{
  user: UserProfile;
  orders: Order[];
  invoices: TaxInvoice[];
  onUpdateUser: (updated: UserProfile) => void;
  onToast: (msg: string, variant?: 'success' | 'error' | 'info') => void;
}> = ({ user, orders, invoices, onUpdateUser, onToast }) => {
  const [gstinInput, setGstinInput] = useState(user.gstin || '');
  const [companyInput, setCompanyInput] = useState(user.companyName || '');
  const [previewInv, setPreviewInv] = useState<TaxInvoice | null>(null);

  const handleSaveGst = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = gstinInput.trim().toUpperCase();
    if (cleaned && !isValidGstin(cleaned)) {
      onToast('Please enter a valid 15-character Indian GSTIN or leave blank', 'error');
      return;
    }
    onUpdateUser({
      ...user,
      gstin: cleaned || undefined,
      companyName: companyInput.trim() || undefined,
      gstStateCode: cleaned ? cleaned.slice(0, 2) : undefined,
    });
    onToast(cleaned ? 'GSTIN & billing entity updated' : 'Cleared optional GSTIN', 'success');
    if (cleaned) {
      triggerCelebration({
        level: 'subtle',
        sound: 'pop',
        eventKey: `gst-save:${cleaned}`,
        dedupeWindowMs: 2500,
        action: 'billing_gst_updated',
      });
    }
  };

  const handleDownloadInvoice = (inv: TaxInvoice) => {
    const matchedOrder = orders.find((o) => o.orderNumber === inv.orderNumber);
    const ok = matchedOrder
      ? generateOrderTaxInvoicePdf(matchedOrder)
      : generateTaxInvoicePdf(inv, user);
    onToast(
      ok ? `Downloaded ${inv.pdfFileName}` : 'Unable to generate PDF',
      ok ? 'success' : 'error'
    );
  };

  return (
    <div className="space-y-5">
      {/* Header + Optional Business GSTIN Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#0B1530] font-display flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#FF7900]" />
              <span>GST & Tax Invoices</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Every TeqqnoWorld order includes an official SAC 9989 GST Tax Invoice. Business buyers with a GSTIN can claim 18% Input Tax Credit (GSTR-2B); individual customers can simply leave GSTIN blank.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="text-[11px] text-slate-500 font-medium">Total Invoices</div>
              <div className="text-lg font-bold text-[#0B1530] tabular-nums">{invoices.length}</div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
              <div className="text-[11px] text-emerald-700 font-medium">Total Tax (18% GST)</div>
              <div className="text-lg font-bold text-emerald-800 tabular-nums">
                ₹{Math.round(invoices.reduce((s, i) => s + i.cgst + i.sgst + i.igst, 0)).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-orange-50/70 border border-orange-200/80 col-span-2 sm:col-span-1">
              <div className="text-[11px] text-orange-800 font-medium">SAC Classification</div>
              <div className="text-lg font-bold text-[#0B1530] font-mono">9989</div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSaveGst}
          className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0B1530] font-display">
              Billing & Optional GSTIN
            </h3>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Optional
            </span>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600">
              Company / Legal Billing Name
            </label>
            <input
              type="text"
              value={companyInput}
              onChange={(e) => setCompanyInput(e.target.value)}
              placeholder="Optional for personal purchases"
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600">
              15-Digit GSTIN (For Business ITC)
            </label>
            <input
              type="text"
              maxLength={15}
              value={gstinInput}
              onChange={(e) => setGstinInput(e.target.value.toUpperCase())}
              placeholder="e.g. 29AAACN1234F1Z8"
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#0B1530] hover:bg-[#132550] text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <Save className="w-3.5 h-3.5 text-[#FF7900]" />
            <span>Save Billing Details</span>
          </button>
        </form>
      </div>

      {/* Invoices Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0B1530] font-display">
            Order Tax Invoices ({invoices.length})
          </h3>
        </div>
        {invoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Invoices will automatically generate here once your first order is placed.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Taxable</th>
                  <th className="py-3 px-4">18% GST</th>
                  <th className="py-3 px-4">Grand Total</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0B1530]">
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[#FF7900]">#{inv.orderNumber}</td>
                    <td className="py-3.5 px-4 text-slate-600 tabular-nums">
                      {new Date(inv.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums">
                      ₹{inv.taxableValue.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 tabular-nums text-emerald-700 font-semibold">
                      ₹{Math.round(inv.cgst + inv.sgst + inv.igst).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[#0B1530] tabular-nums">
                      ₹{inv.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'Paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewInv(inv)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadInvoice(inv)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#0B1530] hover:bg-[#132550] text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-[#FF7900]" />
                          <span>PDF</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Printable Invoice Preview Modal */}
      {previewInv && (
        <div
          className="fixed inset-0 z-50 bg-[#0B1530]/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewInv(null)}
        >
          <div
            id="printable-dashboard-invoice"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-admin-scale-in"
          >
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-[#FF7900]">
                  TeqqnoWorld Tax Invoice
                </div>
                <h3 className="text-lg font-bold text-[#0B1530] font-display">
                  {previewInv.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Order #{previewInv.orderNumber} •{' '}
                  {new Date(previewInv.date).toLocaleDateString('en-IN')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewInv(null)}
                className="no-print p-2 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
              <div>
                <div className="font-bold text-slate-500 uppercase text-[10px]">Supplier</div>
                <div className="font-bold text-[#0B1530] mt-0.5">TeqqnoWorld Private Limited</div>
                <div className="text-slate-600">{BUSINESS_CONFIG.address.line1}</div>
                <div className="text-slate-600 font-mono">GSTIN: 36AAACT9810P1Z2</div>
              </div>
              <div>
                <div className="font-bold text-slate-500 uppercase text-[10px]">Billed To</div>
                <div className="font-bold text-[#0B1530] mt-0.5">
                  {user.companyName || user.name}
                </div>
                <div className="text-slate-600">{user.email}</div>
                {user.gstin && <div className="text-slate-600 font-mono">GSTIN: {user.gstin}</div>}
              </div>
            </div>

            <div className="space-y-1.5 text-xs border-t border-slate-200 pt-3 tabular-nums">
              <div className="flex justify-between text-slate-600">
                <span>Items Count</span>
                <span>{previewInv.itemsCount} units</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxable Value</span>
                <span>₹{previewInv.taxableValue.toLocaleString('en-IN')}</span>
              </div>
              {previewInv.cgst > 0 ? (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST (9%)</span>
                    <span>₹{previewInv.cgst.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST (9%)</span>
                    <span>₹{previewInv.sgst.toLocaleString('en-IN')}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-slate-600">
                  <span>IGST (18%)</span>
                  <span>₹{previewInv.igst.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-[#0B1530] pt-2 border-t border-slate-200">
                <span>Total Invoice Amount</span>
                <span>₹{previewInv.totalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="no-print flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                type="button"
                onClick={() => handleDownloadInvoice(previewInv)}
                className="px-4 py-2 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Tax Invoice PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 6. BULK RFQ ENQUIRIES VIEW (SUBMIT TO SUPABASE + HISTORY)
// ============================================================================
export const CustomerBulkRfqView: React.FC<{
  user: UserProfile;
  rfqs: BulkEnquirySubmission[];
  onAddRfq: (rfq: BulkEnquirySubmission) => void;
  onToast: (msg: string, variant?: 'success' | 'error' | 'info') => void;
}> = ({ user, rfqs, onAddRfq, onToast }) => {
  const [category, setCategory] = useState('Custom Polos & Apparel');
  const [qty, setQty] = useState(50);
  const [targetDate, setTargetDate] = useState('');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitRfq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!details.trim()) {
      onToast('Please enter product & customization requirements', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await submitCustomOrderQuote({
        submissionType: 'rfq',
        customerName: user.name,
        customerEmail: user.email,
        company: user.companyName,
        phone: user.mobile,
        productId: PRODUCTS[0].id,
        quantity: Math.max(10, qty),
        customNotes: `[BULK RFQ: ${category}] Target: ${targetDate || 'Standard'} | ${details}`,
      });

      if (!res.success) {
        onToast(
          res.message || 'Unable to submit Bulk RFQ enquiry. Please try again.',
          'error'
        );
        return;
      }

      const newRfq: BulkEnquirySubmission = {
        id: res.orderId || `rfq-${Date.now()}`,
        companyName: user.companyName || user.name,
        contactPerson: user.name,
        email: user.email,
        phone: user.mobile,
        productCategory: category,
        estimatedQty: Math.max(10, qty),
        targetDeliveryDate: targetDate || 'Flexible',
        customizationDetails: details.trim(),
        hasGst: Boolean(user.gstin),
        gstin: user.gstin,
        createdAt: new Date().toISOString().slice(0, 10),
        status: 'Received',
      };

      onAddRfq(newRfq);
      setDetails('');
      onToast('Bulk RFQ enquiry submitted to production desk', 'success');
      triggerCelebration({
        level: 'premium',
        sound: 'celebration',
        eventKey: `bulk-rfq:${newRfq.id}`,
        action: 'bulk_rfq_submitted',
      });
    } catch (err: any) {
      onToast(
        err?.message || 'Unable to submit Bulk RFQ enquiry. Please try again.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={handleSubmitRfq}
          className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-3.5"
        >
          <div>
            <h2 className="text-lg font-bold text-[#0B1530] font-display flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#FF7900]" />
              <span>Request Bulk RFQ Quote</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Open for businesses, teams, events, and individual group orders (10 to 10,000+ units).
            </p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">Product Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-[#0B1530]"
            >
              <option>Custom Polos & Apparel</option>
              <option>Corporate Welcome / Joining Kits</option>
              <option>Custom Drinkware & Mugs</option>
              <option>Custom Caps & Headwear</option>
              <option>Promotional Umbrellas & Canopies</option>
              <option>Visiting Cards & Print Stationery</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-600">Estimated Qty</label>
              <input
                type="number"
                min={10}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value) || 10)}
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530] tabular-nums"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">Target Delivery</label>
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530]"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600">
              Branding Specs & Notes
            </label>
            <textarea
              rows={3}
              required
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Colors, fabric GSM, logo print positions, size split..."
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSubmitting ? 'Submitting RFQ...' : 'Submit Bulk Enquiry'}</span>
          </button>
        </form>

        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#0B1530] font-display">
                Your Bulk RFQ Enquiries ({rfqs.length})
              </h3>
              <p className="text-xs text-slate-500">Live status of submitted volume quotations</p>
            </div>
            <a
              href={getWhatsAppLink(
                `Hello TeqqnoWorld, I am ${user.name} (${user.companyName || 'Customer'}) inquiring about bulk quotation.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-[#1EBE5D] hover:bg-[#19a851] text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <WhatsAppIcon className="w-3.5 h-3.5 text-white" />
              <span>WhatsApp Desk</span>
            </a>
          </div>

          {rfqs.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-slate-50 border border-slate-200/70 space-y-1.5">
              <Building2 className="w-9 h-9 text-slate-300 mx-auto" />
              <div className="text-xs font-bold text-[#0B1530]">No bulk RFQ enquiries yet</div>
              <p className="text-[11px] text-slate-500">
                Use the form on the left to request custom slab pricing for any quantity.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rfqs.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-[#0B1530]">{r.productCategory}</span>
                      <span className="ml-2 text-[11px] font-semibold text-[#FF7900] tabular-nums">
                        {r.estimatedQty} Units
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {r.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">{r.customizationDetails}</p>
                  <div className="text-[11px] text-slate-400 flex flex-wrap gap-3">
                    <span>Ref: {r.id}</span>
                    <span>Created: {r.createdAt}</span>
                    {r.targetDeliveryDate && <span>Target: {r.targetDeliveryDate}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 7. SAVED WISHLIST VIEW (SYNCED WITH APP WISHLIST)
// ============================================================================
export const CustomerWishlistView: React.FC<{
  products: Product[];
  onCustomizeProduct: (productId: string) => void;
  onRemoveWishlist: (productId: string) => void;
  onExploreCatalog: () => void;
}> = ({ products, onCustomizeProduct, onRemoveWishlist, onExploreCatalog }) => (
  <div className="space-y-5">
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-[#0B1530] font-display flex items-center gap-2">
          <Heart className="w-5 h-5 text-[#FF7900]" />
          <span>Saved Wishlist ({products.length})</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Shortlisted merchandise ready for 2D/3D logo preview & instant ordering
        </p>
      </div>
      <button
        type="button"
        onClick={onExploreCatalog}
        className="px-4 py-2.5 rounded-xl bg-[#0B1530] hover:bg-[#132550] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer min-h-[44px]"
      >
        <ShoppingBag className="w-4 h-4 text-[#FF7900]" />
        <span>Browse Catalog</span>
      </button>
    </div>

    {products.length === 0 ? (
      <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
        <Heart className="w-11 h-11 text-slate-300 mx-auto" />
        <h3 className="text-base font-bold text-[#0B1530] font-display">
          Your saved wishlist is empty
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Tap the heart icon on any product in the catalog to bookmark it here for quick reordering.
        </p>
        <button
          type="button"
          onClick={onExploreCatalog}
          className="px-5 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] text-white text-xs font-bold cursor-pointer"
        >
          Explore Products
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between"
          >
            <div className="p-4 flex gap-3.5">
              <AssetPreviewThumb
                src={product.colors?.[0]?.imageFront}
                alt={product.name}
                className="w-20 h-20 rounded-xl"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-[#0B1530] line-clamp-2">{product.name}</h4>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-sm font-bold text-[#FF7900] tabular-nums">
                    ₹{product.basePrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-slate-500">MOQ {product.moq} pcs</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 truncate">
                  {product.printMethods.join(' • ')}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onRemoveWishlist(product.id)}
                className="text-xs font-semibold text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
              <button
                type="button"
                onClick={() => onCustomizeProduct(product.id)}
                className="px-3.5 py-2 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Customize</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ============================================================================
// 8. ACCOUNT & SECURITY VIEW (PROFILE, AVATAR, REAL PASSWORD, PREFS, GST)
// ============================================================================
export const CustomerAccountSecurityView: React.FC<{
  user: UserProfile;
  subSection: AccountSubSection;
  onChangeSubSection: (sub: AccountSubSection) => void;
  onUpdateUser: (updated: UserProfile) => void;
  onLogout: () => void;
  onOpenAuth?: () => void;
  onToast: (msg: string, variant?: 'success' | 'error' | 'info') => void;
}> = ({
  user,
  subSection,
  onChangeSubSection,
  onUpdateUser,
  onLogout,
  onOpenAuth,
  onToast,
}) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [mobile, setMobile] = useState(user.mobile);
  const [accountType, setAccountType] = useState<'individual' | 'business'>(
    user.accountType || (user.companyName || user.gstin ? 'business' : 'individual')
  );
  const [companyName, setCompanyName] = useState(user.companyName || '');
  const [designation, setDesignation] = useState(user.designation || '');
  const [gstin, setGstin] = useState(user.gstin || '');
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Supabase Auth real session check for Change Password
  const [hasSupabaseSession, setHasSupabaseSession] = useState<boolean | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  const [prefs, setPrefs] = useState<NotificationPreferences>(
    user.notificationPreferences || {
      orderUpdates: true,
      proofAlerts: true,
      invoiceEmails: true,
      promotionalOffers: false,
    }
  );

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setMobile(user.mobile);
    setCompanyName(user.companyName || '');
    setDesignation(user.designation || '');
    setGstin(user.gstin || '');
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setHasSupabaseSession(Boolean(data.session?.user));
        setSessionEmail(data.session?.user?.email || '');
      } catch {
        if (mounted) setHasSupabaseSession(false);
      }
    };
    checkSession();
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (!mounted) return;
      setHasSupabaseSession(Boolean(session?.user));
      setSessionEmail(session?.user?.email || '');
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      onToast('Name and email address are required', 'error');
      return;
    }
    const cleanGstin = gstin.trim().toUpperCase();
    if (cleanGstin && !isValidGstin(cleanGstin)) {
      onToast('Please enter a valid 15-character GSTIN or leave blank', 'error');
      return;
    }

    onUpdateUser({
      ...user,
      name: name.trim(),
      email: email.trim(),
      mobile: mobile.trim(),
      accountType,
      companyName: companyName.trim() || undefined,
      designation: designation.trim() || undefined,
      gstin: cleanGstin || undefined,
      role: accountType === 'business' ? 'Corporate Admin' : 'Individual Shopper',
    });
    onToast('Profile & preferences saved', 'success');
    triggerCelebration({
      level: 'subtle',
      sound: 'pop',
      eventKey: `profile-save:${user.id}:${Date.now()}`,
      dedupeWindowMs: 1500,
      action: 'profile_updated',
    });
  };

  const handleAvatarUpload = async (file: File) => {
    const check = validateBrandAssetFile(file);
    if (!check.valid || file.name.toLowerCase().endsWith('.pdf')) {
      onToast('Please upload a PNG, JPG, JPEG, or SVG profile image (max 15 MB)', 'error');
      return;
    }
    setAvatarUploading(true);
    try {
      const uploaded = await uploadBrandLogoToStorage(file, `avatar-${user.id}-${file.name}`);
      onUpdateUser({ ...user, avatarUrl: uploaded.publicUrl });
      onToast('Profile picture uploaded to cloud storage', 'success');
      triggerCelebration({
        level: 'premium',
        sound: 'celebration',
        eventKey: `profile-avatar:${user.id}:${uploaded.filePath || uploaded.publicUrl}`,
        dedupeWindowMs: 1500,
        action: 'profile_picture_uploaded',
      });
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        onUpdateUser({ ...user, avatarUrl: String(reader.result || '') });
        onToast(
          'Cloud upload failed — saved as a local preview on this device only (not synced to cloud).',
          'info'
        );
      };
      reader.onerror = () => {
        onToast('Profile picture upload failed. Please try again.', 'error');
      };
      reader.readAsDataURL(file);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasSupabaseSession) {
      onToast('Sign in with your verified email session to change password', 'error');
      return;
    }
    const pwCheck = evaluatePasswordStrength(newPassword, sessionEmail || email || user.email);
    if (!pwCheck.isValid) {
      onToast(
        pwCheck.errorMessage || 'Create a strong password (8+ chars, A-Z, a-z, 0-9 & symbol like @#$!)',
        'error'
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      onToast('Passwords do not match', 'error');
      return;
    }

    setPasswordLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordLoading(false);

    if (error) {
      onToast(error.message || 'Unable to update password', 'error');
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    onToast('Account password updated securely via Supabase Auth', 'success');
    triggerCelebration({
      level: 'subtle',
      sound: 'chime',
      eventKey: `password-changed:${user.id}:${Date.now()}`,
      dedupeWindowMs: 2500,
      action: 'password_changed',
    });
  };

  const handleSendResetEmail = async () => {
    const targetEmail = (sessionEmail || email || user.email).trim();
    if (!targetEmail) {
      onToast('Enter your account email first', 'error');
      return;
    }
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(targetEmail);
    setResetSending(false);
    if (error) {
      onToast(error.message || 'Could not send password reset email', 'error');
      return;
    }
    onToast(`Password reset link sent to ${targetEmail}`, 'success');
  };

  const handleTogglePref = (key: keyof NotificationPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    onUpdateUser({ ...user, notificationPreferences: next });
    onToast('Notification preference updated', 'success');
  };

  const handleGlobalSignOut = async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch {
      // proceed to clear local profile session
    }
    onLogout();
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#0B1530] font-display flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#FF7900]" />
            <span>Account & Security</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Update profile photo, contact details, password, notification alerts, and GSTIN settings
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'profile', label: 'Update Profile' },
              { id: 'password', label: 'Change Password' },
              { id: 'notifications', label: 'Notifications' },
              { id: 'gst', label: 'GST & Billing' },
              { id: 'security', label: 'Security & 2FA' },
            ] as { id: AccountSubSection; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onChangeSubSection(t.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                subSection === t.id
                  ? 'bg-[#0B1530] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-Section: PROFILE */}
      {(subSection === 'profile' || subSection === 'gst') && (
        <form
          onSubmit={handleSaveProfile}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-5"
        >
          {/* Avatar Upload Row */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 border-b border-slate-100">
            <div className="relative w-20 h-20 rounded-full bg-[#0B1530] text-white flex items-center justify-center overflow-hidden border-2 border-[#FF7900]/50 shrink-0">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold font-display">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="text-sm font-bold text-[#0B1530]">Profile Picture</div>
              <p className="text-xs text-slate-500">
                Upload a photo or brand emblem (PNG, JPG, SVG). Synced across your customer portal.
              </p>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                  e.target.value = '';
                }}
              />
              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0B1530] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-[#FF7900]" />
                <span>{avatarUploading ? 'Uploading...' : 'Upload New Photo'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                Customer Profile Mode
              </label>
              <div className="inline-flex rounded-xl bg-slate-100 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setAccountType('individual')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    accountType === 'individual'
                      ? 'bg-[#0B1530] text-white shadow-xs'
                      : 'text-slate-600 hover:text-[#0B1530]'
                  }`}
                >
                  Individual Customer
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('business')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                    accountType === 'business'
                      ? 'bg-[#0B1530] text-white shadow-xs'
                      : 'text-slate-600 hover:text-[#0B1530]'
                  }`}
                >
                  Business / Enterprise Buyer
                </button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600">Full Name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600">Email Address</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600">Mobile Number</label>
              <input
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600">
                Company / Organization Name (Optional)
              </label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Optional for personal accounts"
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600">Role / Designation (Optional)</label>
              <input
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600">
                GSTIN for Business ITC Invoices (Optional)
              </label>
              <input
                maxLength={15}
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="15-character GSTIN (if applicable)"
                className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#0B1530] focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e86d00] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      )}

      {/* Sub-Section: PASSWORD (HONEST SUPABASE AUTH CHECK) */}
      {subSection === 'password' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF7900] border border-orange-200 flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B1530] font-display">
                Change Account Password
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasSupabaseSession
                  ? `Authenticated as ${sessionEmail || user.email}. Password changes take effect immediately across devices.`
                  : 'Password updates require an authenticated Email & Password session.'}
              </p>
            </div>
          </div>

          {hasSupabaseSession ? (
            <form onSubmit={handleUpdatePassword} className="space-y-3 max-w-md">
              <div>
                <label className="text-[11px] font-bold text-slate-600">
                  New Strong Password (8+ chars, A-Z, a-z, 0-9 &amp; @#$!)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="e.g. Teqqno@2026"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#0B1530]"
                />
                {newPassword && (() => {
                  const s = evaluatePasswordStrength(newPassword, sessionEmail || email || user.email);
                  const barTone =
                    s.score === 4 ? 'bg-emerald-500' : s.score === 3 ? 'bg-sky-500' : s.score === 2 ? 'bg-amber-500' : 'bg-red-500';
                  const labelTone =
                    s.score === 4 ? 'text-emerald-600' : s.score === 3 ? 'text-sky-600' : s.score === 2 ? 'text-amber-600' : 'text-red-600';
                  return (
                    <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Password Strength</span>
                        <span className={`font-bold ${labelTone}`}>{s.label}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map((n) => (
                          <div key={n} className={`h-1.5 rounded-full ${n <= s.score ? barTone : 'bg-slate-200'}`} />
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.checks.map((c) => (
                          <span
                            key={c.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                              c.passed
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-white border-slate-200 text-slate-500'
                            }`}
                          >
                            <span>{c.passed ? '✓' : '•'}</span>
                            <span>{c.label}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Confirm New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-[#0B1530]"
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading || !evaluatePasswordStrength(newPassword, sessionEmail || email || user.email).isValid}
                className="px-5 py-2.5 rounded-xl bg-[#0B1530] hover:bg-[#132550] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer min-h-[44px]"
              >
                <Lock className="w-3.5 h-3.5 text-[#FF7900]" />
                <span>{passwordLoading ? 'Updating...' : 'Update Password'}</span>
              </button>
            </form>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="flex items-start gap-2 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  You are currently viewing the portal without an active Supabase login session. Sign in with your verified credentials or request an official password reset email.
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {onOpenAuth && (
                  <button
                    type="button"
                    onClick={onOpenAuth}
                    className="px-4 py-2 rounded-xl bg-[#0B1530] hover:bg-[#132550] text-white text-xs font-bold cursor-pointer"
                  >
                    Sign In with Email & Password
                  </button>
                )}
                <button
                  type="button"
                  disabled={resetSending}
                  onClick={handleSendResetEmail}
                  className="px-4 py-2 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-bold cursor-pointer"
                >
                  {resetSending ? 'Sending Link...' : 'Send Reset Email'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-Section: NOTIFICATION PREFERENCES */}
      {subSection === 'notifications' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
          <h3 className="text-base font-bold text-[#0B1530] font-display flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#FF7900]" />
            <span>Notification Preferences</span>
          </h3>
          <div className="space-y-3">
            {(
              [
                {
                  key: 'orderUpdates',
                  title: 'Order & Dispatch Updates',
                  desc: 'Receive live courier AWB generation & shipping alerts via Email & WhatsApp',
                },
                {
                  key: 'proofAlerts',
                  title: 'Artwork Proof Verification Alerts',
                  desc: 'Instant notification when our design team uploads a pre-production proof',
                },
                {
                  key: 'invoiceEmails',
                  title: 'GST & Tax Invoice Emails',
                  desc: 'Automatic SAC 9989 tax invoice PDF delivery after checkout',
                },
                {
                  key: 'promotionalOffers',
                  title: 'Seasonal Merch & Volume Rebate Offers',
                  desc: 'Festive gifting discounts & new fabric drops',
                },
              ] as { key: keyof NotificationPreferences; title: string; desc: string }[]
            ).map((item) => {
              const enabled = prefs[item.key];
              return (
                <div
                  key={item.key}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-xs font-bold text-[#0B1530]">{item.title}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{item.desc}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => handleTogglePref(item.key)}
                    className={`w-11 h-6 rounded-full transition-colors p-0.5 cursor-pointer shrink-0 ${
                      enabled ? 'bg-[#FF7900]' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                        enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Section: SECURITY & 2FA */}
      {subSection === 'security' && (
        <div className="space-y-5">
          <CustomerTwoStepCard
            hasSupabaseSession={hasSupabaseSession}
            sessionEmail={sessionEmail}
            fallbackEmail={user.email}
            onOpenAuth={onOpenAuth}
            onToast={onToast}
          />

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
            <h3 className="text-base font-bold text-[#0B1530] font-display">
              Account Verification &amp; Session Security
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="text-slate-500 font-medium">Verification Status</div>
                <div className="font-bold text-[#0B1530] flex items-center gap-1.5">
                  {user.isVerified ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Verified Account</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Pending Verification</span>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                <div className="text-slate-500 font-medium">Active Authentication</div>
                <div className="font-bold text-[#0B1530]">
                  {hasSupabaseSession ? `Signed in (${sessionEmail})` : 'Local Storefront Session'}
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">
                Sign out from all active sessions across browsers and mobile devices.
              </p>
              <button
                type="button"
                onClick={handleGlobalSignOut}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer min-h-[44px]"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out All Sessions</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 9. HELP & SUPPORT VIEW
// ============================================================================
export const CustomerSupportView: React.FC<{
  user: UserProfile;
  orders: Order[];
  onTrackOrder: (order: Order) => void;
}> = ({ user, orders, onTrackOrder }) => (
  <div className="space-y-5">
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
      <h2 className="text-xl font-bold text-[#0B1530] font-display flex items-center gap-2">
        <HelpCircle className="w-5 h-5 text-[#FF7900]" />
        <span>Dedicated Print & Order Support</span>
      </h2>
      <p className="text-xs text-slate-500 mt-0.5">
        Direct access to our Hyderabad production specialists for artworks, sizing, urgent events & dispatches.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
        <div className="w-10 h-10 rounded-xl bg-[#1EBE5D]/15 text-[#1EBE5D] flex items-center justify-center">
          <WhatsAppIcon className="w-5 h-5 text-[#1EBE5D]" />
        </div>
        <h3 className="text-sm font-bold text-[#0B1530]">WhatsApp Print Desk</h3>
        <p className="text-xs text-slate-500">
          Instant mockup help, fabric swatches & urgent dispatch assistance ({BUSINESS_CONFIG.contact.whatsapp}).
        </p>
        <a
          href={getWhatsAppLink(`Hi TeqqnoWorld Support, I am ${user.name} (${user.email}). I need help with my order.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1EBE5D] hover:bg-[#19a851] text-white text-xs font-bold"
        >
          <span>Chat on WhatsApp</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
        <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF7900] flex items-center justify-center">
          <Mail className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-[#0B1530]">Email Production & Billing</h3>
        <p className="text-xs text-slate-500">
          For vector artwork files, PO approvals & GST invoice queries.
        </p>
        <a
          href={`mailto:${BUSINESS_CONFIG.contact.email}`}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0B1530] hover:bg-[#132550] text-white text-xs font-bold"
        >
          <Mail className="w-3.5 h-3.5 text-[#FF7900]" />
          <span>{BUSINESS_CONFIG.contact.email}</span>
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <Phone className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-bold text-[#0B1530]">Plant & Helpline</h3>
        <p className="text-xs text-slate-500">
          {BUSINESS_CONFIG.address.full}
        </p>
        <div className="text-xs font-bold text-[#0B1530]">{BUSINESS_CONFIG.contact.phone}</div>
      </div>
    </div>

    {orders.length > 0 && (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#0B1530] font-display">
          Quick Order Issue Lookup
        </h3>
        <div className="space-y-2">
          {orders.slice(0, 4).map((o) => {
            const thumb = getThumbnailForOrder(o);
            return (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/70"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <AssetPreviewThumb src={thumb} alt={o.orderNumber} className="w-10 h-10 rounded-lg" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#0B1530]">#{o.orderNumber}</div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {o.items[0]?.product?.name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onTrackOrder(o)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-[#0B1530] cursor-pointer"
                  >
                    Track
                  </button>
                  <a
                    href={getWhatsAppLink(
                      `Hi TeqqnoWorld, I need support regarding Order #${o.orderNumber}.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#1EBE5D] text-white text-xs font-bold"
                  >
                    Get Help
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    )}
  </div>
);
