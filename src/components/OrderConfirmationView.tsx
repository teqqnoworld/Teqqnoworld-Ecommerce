import React, { useState } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Truck, 
  FileText, 
  ShieldCheck, 
  Printer, 
  Eye, 
  Download, 
  Share2, 
  Sparkles,
  ArrowRight,
  AlertCircle,
  Loader2,
  MapPin,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { Order } from '../types';
import { ProductMockupCanvas } from './ProductMockupCanvas';
import { generateOrderTaxInvoicePdf } from '../utils/pdfGenerator';
import { trackDelhiveryWaybill, DelhiveryTrackResponse } from '../services/paymentAndLogisticsService';
import {
  getWhatsAppOrderActionStatus,
  submitWhatsAppOrderAction,
} from '../services/aisensyService';
import { WhatsAppIcon } from './WhatsAppIcon';
import { BUSINESS_CONFIG, getWhatsAppLink } from '../config/business';

interface OrderConfirmationViewProps {
  order: Order;
  onUpdateOrder: (updated: Order) => void;
  onBackToHome: () => void;
  onNavigateCatalog: () => void;
  onNavigate?: (route: string) => void;
}

export const OrderConfirmationView: React.FC<OrderConfirmationViewProps> = ({
  order,
  onUpdateOrder,
  onBackToHome,
  onNavigateCatalog,
  onNavigate,
}) => {
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [proofNote, setProofNote] = useState('');
  const [revisionRequested, setRevisionRequested] = useState(false);
  const [proofView, setProofView] = useState<'front' | 'back'>('front');
  const [liveTrackData, setLiveTrackData] = useState<DelhiveryTrackResponse | null>(null);
  const [isTrackingShipment, setIsTrackingShipment] = useState(false);
  const [waActionStatus, setWaActionStatus] = useState<'pending' | 'confirmed' | 'cancelled'>(
    order.whatsappActionStatus || 'pending'
  );
  const [waActionLoading, setWaActionLoading] = useState(false);
  const [showWaPreview, setShowWaPreview] = useState(false);

  React.useEffect(() => {
    setWaActionStatus(order.whatsappActionStatus || 'pending');
    getWhatsAppOrderActionStatus(order.id, order.orderNumber)
      .then((res) => {
        if (res.found && res.whatsappActionStatus) {
          setWaActionStatus(res.whatsappActionStatus);
        }
      })
      .catch(() => {});
  }, [order.id, order.orderNumber, order.whatsappActionStatus]);

  const handleTriggerWaAction = async (action: 'confirm' | 'cancel') => {
    setWaActionLoading(true);
    try {
      const res = await submitWhatsAppOrderAction({
        orderId: order.id,
        orderNumber: order.orderNumber,
        action,
        source: 'order_confirmation_card',
      });
      if (res.success && res.whatsappActionStatus) {
        setWaActionStatus(res.whatsappActionStatus);
        onUpdateOrder({
          ...order,
          whatsappActionStatus: res.whatsappActionStatus,
          orderStatus: res.whatsappActionStatus === 'confirmed' ? 'Confirmed' : order.orderStatus,
        });
      }
    } finally {
      setWaActionLoading(false);
    }
  };

  const handleLiveTrack = async () => {
    const awb = order.trackingNumber?.trim();
    if (!awb || awb.toLowerCase().includes('awaiting')) return;
    setIsTrackingShipment(true);
    try {
      const res = await trackDelhiveryWaybill(awb);
      setLiveTrackData(res);
    } finally {
      setIsTrackingShipment(false);
    }
  };

  // Approve digital proof
  const handleApproveProof = () => {
    const updated: Order = {
      ...order,
      proofStatus: 'Approved by Client',
      orderStatus: 'Manufacturing',
    };
    onUpdateOrder(updated);
  };

  // Request proof revision
  const handleRequestRevision = (e: React.FormEvent) => {
    e.preventDefault();
    setRevisionRequested(true);
    const updated: Order = {
      ...order,
      proofStatus: 'Proof Generating',
    };
    onUpdateOrder(updated);
  };

  return (
    <div className="bg-[#F5F5F7] min-h-screen py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Top Order Success Banner */}
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-[#FF7A00] bg-[#FF7A00]/10 px-2 py-0.5 rounded">
                  Order {order.orderNumber}
                </span>
                <span className="text-xs text-zinc-500 font-mono">
                  {new Date(order.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#0B0B0D] tracking-tight mt-1">
                Order Confirmed & Proof Generated
              </h1>
              {order.emailNotification?.status === 'simulated' || order.emailNotification?.status === 'failed' ? (
                <p className="text-xs sm:text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1.5 inline-flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    Order saved for <strong className="text-zinc-900">{order.shippingAddress.email}</strong> — email notification pending SMTP server setup.
                  </span>
                </p>
              ) : (
                <p className="text-xs sm:text-sm text-zinc-600 mt-1">
                  Receipt and digital proof dispatched to <strong className="text-zinc-900">{order.shippingAddress.email}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={() => generateOrderTaxInvoicePdf(order)}
              className="bg-[#FF7A00] hover:bg-[#ff881a] text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Download official SAC 9989 B2B Tax Invoice (PDF)"
            >
              <Download className="w-4 h-4" />
              <span>Download Tax Invoice (PDF)</span>
            </button>

            <button
              onClick={() => setShowInvoiceModal(true)}
              className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold py-2.5 px-3.5 rounded-xl flex items-center gap-1.5 transition-colors border border-zinc-200 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-zinc-600" />
              <span>View Invoice</span>
            </button>

            <button
              onClick={onNavigateCatalog}
              className="bg-[#0B0B0D] hover:bg-zinc-800 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
            >
              Back to Catalog
            </button>
          </div>
        </div>

        {/* AiSensy WhatsApp Order Alert & Customer Confirm / Cancel Card */}
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1EBE5D]/15 border border-[#1EBE5D]/30 text-[#1EBE5D] flex items-center justify-center shrink-0">
                <WhatsAppIcon className="w-5 h-5 text-[#1EBE5D]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display font-bold text-sm sm:text-base text-[#071B35]">
                    WhatsApp Order Notification (AiSensy)
                  </h2>
                  <span
                    className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      waActionStatus === 'confirmed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : waActionStatus === 'cancelled'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {waActionStatus === 'confirmed'
                      ? 'CONFIRMED BY CUSTOMER'
                      : waActionStatus === 'cancelled'
                        ? 'CANCELLED VIA WHATSAPP'
                        : 'CONFIRM / CANCEL SENT'}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 mt-0.5">
                  {order.whatsappNotification?.status === 'sent'
                    ? `WhatsApp notification sent to ${order.whatsappNotification.phone || order.shippingAddress.phone} with Confirm & Cancel options.`
                    : `WhatsApp alert ready for ${order.whatsappNotification?.phone || order.shippingAddress.phone} with Confirm & Cancel Order options.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {waActionStatus === 'pending' && (
                <>
                  <button
                    type="button"
                    disabled={waActionLoading}
                    onClick={() => void handleTriggerWaAction('confirm')}
                    className="px-3.5 py-2 rounded-xl bg-[#1EBE5D] hover:bg-[#19a851] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Order</span>
                  </button>
                  <button
                    type="button"
                    disabled={waActionLoading}
                    onClick={() => void handleTriggerWaAction('cancel')}
                    className="px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel Order</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={async () => {
                  const fresh = await getWhatsAppOrderActionStatus(order.id, order.orderNumber);
                  if (fresh.found) setWaActionStatus(fresh.whatsappActionStatus);
                }}
                className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium inline-flex items-center gap-1 cursor-pointer"
                title="Refresh WhatsApp status"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync</span>
              </button>
              {order.whatsappNotification?.previewMessage && (
                <button
                  type="button"
                  onClick={() => setShowWaPreview((v) => !v)}
                  className="px-3 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:border-[#FF7A00] text-xs font-medium cursor-pointer"
                >
                  {showWaPreview ? 'Hide Message' : 'View WhatsApp Msg'}
                </button>
              )}
            </div>
          </div>

          {showWaPreview && order.whatsappNotification?.previewMessage && (
            <div className="rounded-xl bg-[#0B141A] text-[#E9EDEF] p-4 text-xs font-sans whitespace-pre-line border border-zinc-800 leading-relaxed">
              {order.whatsappNotification.previewMessage}
            </div>
          )}
        </div>

        {/* 1:1 Scale Pre-Press Proof Approval Studio Card */}
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E5E5EA] gap-2">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#FF7A00] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Pre-Press Approval Checkpoint</span>
              </div>
              <h2 className="font-display font-bold text-xl text-[#0B0B0D] mt-0.5">
                Digital Production Proof
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full ${
                order.proofStatus === 'Approved by Client'
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
              }`}>
                ● {order.proofStatus}
              </span>
            </div>
          </div>

          {/* Proof Preview Canvas Display */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            <div className="md:col-span-5 bg-[#FAF9FD] rounded-xl p-4 border border-[#ECEAF3] flex flex-col items-center justify-center">
              {order.items[0] && (
                <div className="w-full flex flex-col items-center">
                  <ProductMockupCanvas
                    productType={order.items[0].product.productType}
                    color={order.items[0].color}
                    artwork={proofView === 'front' ? (order.items[0].frontArtwork || order.items[0].artwork) : (order.items[0].backArtwork || order.items[0].artwork)}
                    printMethod={order.items[0].printMethod}
                    printPlacement={proofView === 'front' ? (order.items[0].frontPlacement || order.items[0].printPlacement) : (order.items[0].backPlacement || order.items[0].printPlacement)}
                    view={proofView}
                    showPrintBoundary={true}
                    className="w-full h-64"
                  />
                  {(order.items[0].frontArtwork || order.items[0].backArtwork) && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setProofView('front')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          proofView === 'front' ? 'bg-[#FF7A00] text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700'
                        }`}
                      >
                        Front Proof
                      </button>
                      <button
                        type="button"
                        onClick={() => setProofView('back')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                          proofView === 'back' ? 'bg-[#FF7A00] text-white shadow-xs' : 'bg-white border border-zinc-200 text-zinc-700'
                        }`}
                      >
                        Back Proof
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="text-[10px] text-zinc-400 font-mono mt-2 text-center">
                1:1 Calibrated Print Tolerance ±1.5mm · Pantone PMS Coated
              </div>
            </div>

            <div className="md:col-span-7 space-y-4">
              <div className="space-y-2 text-xs">
                <div className="font-semibold text-zinc-800">Pre-Press Verification Specs:</div>
                <div className="grid grid-cols-2 gap-2 text-zinc-600 bg-zinc-50 p-3 rounded-xl border border-zinc-200">
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Print Method:</span>
                    <span className="font-medium text-zinc-900">{order.items[0]?.printMethod}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Print Position:</span>
                    <span className="font-medium text-zinc-900">{order.items[0]?.printPlacement}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Resolution Check:</span>
                    <span className="text-emerald-700 font-medium">300 DPI Vector Verified</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block text-[10px]">Color Matching:</span>
                    <span className="font-medium text-zinc-900">Standard Direct Emulsion</span>
                  </div>
                </div>
              </div>

              {order.proofStatus === 'Proof Ready - Needs Approval' ? (
                <div className="space-y-3 pt-2">
                  <p className="text-xs text-zinc-600">
                    Please inspect your digital proof above. Once approved, our automated manufacturing line will queue production and schedule 24–48h express dispatch.
                  </p>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleApproveProof}
                      className="bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-semibold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-2 hover:-translate-y-0.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve Digital Proof & Queue Production</span>
                    </button>

                    <button
                      onClick={() => setRevisionRequested(true)}
                      className="text-xs text-zinc-600 hover:text-zinc-900 underline"
                    >
                      Request Adjustment
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                  <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Proof Officially Approved by Client</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Job order sent to our automated manufacturing floor. Live machine queue active.
                  </p>
                </div>
              )}

              {/* Revision form if requested */}
              {revisionRequested && order.proofStatus !== 'Approved by Client' && (
                <form onSubmit={handleRequestRevision} className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2 text-xs">
                  <div className="font-semibold text-zinc-800">Specify Desired Adjustment:</div>
                  <textarea
                    rows={2}
                    value={proofNote}
                    onChange={(e) => setProofNote(e.target.value)}
                    placeholder="e.g. Move logo 2cm higher or enlarge logo by 15%..."
                    className="w-full p-2 border border-zinc-300 rounded-lg text-xs outline-none focus:border-[#FF7A00]"
                  />
                  <button
                    type="submit"
                    className="bg-[#0B0B0D] text-white px-3 py-1.5 rounded-lg text-xs font-medium"
                  >
                    Submit Revision Request
                  </button>
                </form>
              )}

            </div>

          </div>
        </div>

        {/* 4-Stage Manufacturing & Delivery Pipeline Tracker */}
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E5E5EA] gap-2">
            <div>
              <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#FF7A00]">
                Live Logistics Tracker
              </div>
              <h3 className="font-display font-bold text-lg text-[#0B0B0D]">
                Manufacturing & Delivery Lifecycle
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-zinc-600">
              <span>
                Partner: <strong>{order.courierPartner || 'Delhivery Express (Prepaid)'}</strong> · Waybill:{' '}
                <strong>{order.trackingNumber || 'Awaiting Manifest'}</strong>
              </span>
              {order.trackingNumber && !order.trackingNumber.toLowerCase().includes('awaiting') && (
                <button
                  type="button"
                  onClick={handleLiveTrack}
                  disabled={isTrackingShipment}
                  className="bg-[#FF7A00] hover:bg-[#ff881a] text-white px-2.5 py-1 rounded-lg font-sans font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer disabled:opacity-60"
                >
                  {isTrackingShipment ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
                  <span>Live Track</span>
                </button>
              )}
            </div>
          </div>

          {liveTrackData && (
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-[#0B0B0D]">
                  Delhivery Status: {liveTrackData.currentStatus || (liveTrackData.success ? 'Manifested' : 'Pending Scan')}
                </span>
                {liveTrackData.statusLocation && (
                  <span className="font-mono text-zinc-600">Location: {liveTrackData.statusLocation}</span>
                )}
              </div>
              {liveTrackData.message && !liveTrackData.success && (
                <p className="text-zinc-600">{liveTrackData.message}</p>
              )}
              {liveTrackData.scans?.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-zinc-200 max-h-40 overflow-y-auto">
                  {liveTrackData.scans.slice(0, 5).map((s, idx) => (
                    <div key={idx} className="flex justify-between gap-3 text-[11px] text-zinc-700">
                      <span className="font-medium">{s.status} — {s.location}</span>
                      <span className="font-mono text-zinc-500 shrink-0">{s.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 6-Stage Production Timeline */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            {[
              {
                step: '1',
                title: 'Order Logged',
                desc: order.paymentMode,
                done: true,
              },
              {
                step: '2',
                title: 'Proof Verification',
                desc: order.proofStatus === 'Approved by Client' ? 'Approved & Signed off' : 'Pending Client Review',
                done: order.proofStatus === 'Approved by Client',
              },
              {
                step: '3',
                title: 'Factory Run',
                desc: order.proofStatus === 'Approved by Client' ? 'Active on Machines' : 'Queued post-proof',
                done: order.proofStatus === 'Approved by Client',
              },
              {
                step: '4',
                title: 'Quality Check',
                desc: 'GSM & print tolerance audit',
                done: order.orderStatus === 'Dispatched' || order.orderStatus === 'Delivered',
              },
              {
                step: '5',
                title: 'Delhivery Dispatch',
                desc: `${order.courierPartner?.split(' ')[0] || 'Delhivery'}: ${order.trackingNumber || 'Awaiting Manifest'}`,
                done: order.orderStatus === 'Dispatched' || order.orderStatus === 'Delivered',
              },
              {
                step: '6',
                title: 'Delivered',
                desc: `ETA: ${order.estimatedDispatch}`,
                done: order.orderStatus === 'Delivered',
              },
            ].map((st) => (
              <div
                key={st.step}
                className={`p-3.5 rounded-xl border transition-colors text-xs ${
                  st.done
                    ? 'border-emerald-300 bg-emerald-50/60 text-emerald-950'
                    : 'border-zinc-200 bg-zinc-50/60 text-zinc-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    st.done ? 'bg-emerald-600 text-white' : 'bg-zinc-200 text-zinc-600'
                  }`}>
                    {st.step}
                  </span>
                  {st.done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <h4 className="font-display font-bold text-xs text-[#0B0B0D] truncate">{st.title}</h4>
                <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{st.desc}</p>
              </div>
            ))}
          </div>

          <div className="pt-2 text-xs text-zinc-500 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#FF7A00]" />
              <span>Deliver to: {order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.pincode}</span>
            </span>
            <span className="font-mono text-zinc-700">Contact: {order.shippingAddress.phone}</span>
          </div>
        </div>

        {/* Itemized Order Details Card */}
        <div className="bg-white rounded-2xl border border-[#E5E5EA] p-6 shadow-xs space-y-4">
          <h3 className="font-display font-bold text-base text-[#0B0B0D] pb-3 border-b border-[#E5E5EA]">
            Order Specifications & B2B Financial Summary
          </h3>

          <div className="divide-y divide-zinc-100">
            {order.items.map((item) => (
              <div key={item.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                <div>
                  <h4 className="font-semibold text-[#0B0B0D] text-sm">{item.product.name}</h4>
                  <div className="text-zinc-500 text-[11px] mt-0.5">
                    Color: {item.color.name} {item.size ? `· Size: ${item.size}` : ''} · Tech: {item.printMethod} ({item.printPlacement})
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-zinc-500">{item.quantity} units @ ₹{item.unitPrice}</div>
                  <div className="font-mono font-bold text-sm text-[#0B0B0D]">
                    ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#FAF9FD] rounded-xl p-4 border border-[#ECEAF3] space-y-2 text-xs">
            <div className="flex justify-between text-zinc-600">
              <span>Subtotal:</span>
              <span className="font-mono text-zinc-900">₹{order.subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>Pan-India Logistics:</span>
              <span className="font-mono text-emerald-700 font-semibold">
                {order.shippingFee === 0 ? 'FREE' : `₹${order.shippingFee}`}
              </span>
            </div>
            <div className="flex justify-between text-zinc-600">
              <span>GST (18% ITC Credit):</span>
              <span className="font-mono text-zinc-900">₹{order.gstAmount.toLocaleString('en-IN')}</span>
            </div>
            <div className="pt-2 border-t border-zinc-200 flex justify-between font-display font-bold text-base text-[#0B0B0D]">
              <span>Total Order Value:</span>
              <span className="text-[#FF7A00] font-mono">₹{order.total.toLocaleString('en-IN')}</span>
            </div>
            {typeof order.amountPaid === 'number' && (
              <div className="pt-2 border-t border-dashed border-zinc-200 space-y-1">
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Paid Online ({order.paymentMode}):</span>
                  <span className="font-mono">₹{order.amountPaid.toLocaleString('en-IN')}</span>
                </div>
                {(order.balanceDue || 0) > 0 && (
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>Remaining 50% Balance (Before Dispatch · No COD):</span>
                    <span className="font-mono">₹{(order.balanceDue || 0).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {order.razorpayPaymentId && (
                  <div className="flex justify-between text-zinc-500 text-[11px]">
                    <span>Razorpay Transaction ID:</span>
                    <span className="font-mono text-zinc-700">{order.razorpayPaymentId}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Delivery Inspection & Replacement Policy Notice */}
        <div className="bg-[#071B35] text-white rounded-2xl border border-[#0E2A4F] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#FF7A00]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Delivery Inspection &amp; Replacement Policy</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-2xl">
              TeqqnoWorld follows a <strong className="text-white">No Return / Replacement Only</strong> policy. Please record a clear, continuous unboxing video when opening your parcel and report any damaged, cracked, defective, or incorrect item within <strong className="text-white">24 hours of receipt</strong> along with Order ID <strong className="text-white">{order.orderNumber}</strong>.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300 pt-0.5">
              <a
                href={getWhatsAppLink(`Hello TeqqnoWorld Support, regarding Order ID: ${order.orderNumber}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#25D366] hover:underline font-medium"
              >
                WhatsApp: {BUSINESS_CONFIG.contact.whatsapp}
              </a>
              <a
                href={`mailto:${BUSINESS_CONFIG.contact.secondaryEmail}`}
                className="text-[#FF7A00] hover:underline font-medium"
              >
                {BUSINESS_CONFIG.contact.secondaryEmail}
              </a>
              <a
                href={`mailto:${BUSINESS_CONFIG.contact.email}`}
                className="text-slate-300 hover:text-white hover:underline font-medium"
              >
                {BUSINESS_CONFIG.contact.email}
              </a>
            </div>
          </div>
          <a
            href="/return-replacement-policy"
            onClick={(e) => {
              if (onNavigate && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
                e.preventDefault();
                onNavigate('/return-replacement-policy');
              }
            }}
            className="bg-[#FF7A00] hover:bg-[#e66e00] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors shrink-0 text-center"
          >
            View Full Policy &rarr;
          </a>
        </div>

      </div>

      {/* Official GST Tax Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div id="printable-tax-invoice" className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto shadow-2xl">
            
            {/* Invoice Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <div className="text-xs font-mono font-bold text-[#FF7A00]">ORIGINAL FOR RECIPIENT</div>
                <h3 className="font-display font-bold text-xl text-[#0B0B0D]">TAX INVOICE</h3>
                <p className="text-[11px] text-zinc-500 font-mono">Invoice #{order.orderNumber}-INV · Date: {new Date(order.createdAt).toLocaleDateString('en-IN')}</p>
              </div>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="no-print text-zinc-400 hover:text-zinc-700 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Company & Client Addresses */}
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div>
                <span className="font-bold text-zinc-400 uppercase text-[10px]">Supplier:</span>
                <div className="font-bold text-[#0B0B0D] mt-1">TeqqnoWorld Custom E-Commerce Pvt Ltd</div>
                <div className="text-zinc-600 mt-0.5">Unit 14, MIDC Industrial Area, Andheri (E), Mumbai 400093</div>
                <div className="font-mono text-[11px] text-zinc-700 mt-1">GSTIN: 27AABCT9841P1ZB (Maharashtra)</div>
                <div className="text-zinc-500 text-[10px]">State Code: 27 (MH)</div>
              </div>

              <div>
                <span className="font-bold text-zinc-400 uppercase text-[10px]">Billed & Shipped To:</span>
                <div className="font-bold text-[#0B0B0D] mt-1">{order.shippingAddress.companyName || order.shippingAddress.fullName}</div>
                <div className="text-zinc-600 mt-0.5">{order.shippingAddress.street}, {order.shippingAddress.city}, {order.shippingAddress.state} - {order.shippingAddress.pincode}</div>
                <div className="font-mono text-[11px] text-[#FF7A00] font-bold mt-1">
                  GSTIN: {order.shippingAddress.gstin || 'B2C Consumer'}
                </div>
              </div>
            </div>

            {/* Invoice Line Items */}
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b bg-zinc-50 text-[11px] font-mono text-zinc-600">
                  <th className="py-2 px-2">Description</th>
                  <th className="py-2 px-2">SAC/HSN</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2 text-right">Rate</th>
                  <th className="py-2 px-2 text-right">Taxable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td className="py-2 px-2 font-medium">
                      {i.product.name} ({i.printMethod})
                    </td>
                    <td className="py-2 px-2 font-mono text-zinc-500">9989</td>
                    <td className="py-2 px-2 text-right font-mono">{i.quantity}</td>
                    <td className="py-2 px-2 text-right font-mono">₹{i.unitPrice}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold">
                      ₹{(i.unitPrice * i.quantity).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tax Computation */}
            <div className="bg-[#FAF9FD] p-4 rounded-xl border border-[#ECEAF3] text-xs space-y-1.5">
              <div className="flex justify-between">
                <span>Total Taxable Amount:</span>
                <span className="font-mono font-bold">₹{order.subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Integrated GST (IGST 18%):</span>
                <span className="font-mono">₹{order.gstAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Logistics:</span>
                <span className="font-mono">₹{order.shippingFee}</span>
              </div>
              <div className="pt-2 border-t flex justify-between font-bold text-sm text-[#0B0B0D]">
                <span>Total Invoice Value:</span>
                <span className="text-[#FF7A00]">₹{order.total.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="no-print flex flex-wrap justify-end gap-3 pt-2">
              <button
                onClick={() => generateOrderTaxInvoicePdf(order)}
                className="bg-[#FF7A00] hover:bg-[#ff881a] text-white text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Official PDF</span>
              </button>

              <button
                onClick={() => window.print()}
                className="bg-[#0B0B0D] hover:bg-zinc-800 text-white text-xs font-semibold py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Document</span>
              </button>

              <button
                onClick={() => setShowInvoiceModal(false)}
                className="border border-zinc-300 text-zinc-700 text-xs font-semibold py-2 px-4 rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
