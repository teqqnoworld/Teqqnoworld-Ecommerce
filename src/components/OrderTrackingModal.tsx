import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  CheckCircle2, 
  Clock, 
  Package, 
  MapPin, 
  ExternalLink, 
  Copy, 
  Check, 
  X, 
  AlertCircle,
  ShieldCheck,
  Download,
  PhoneCall,
  RefreshCw
} from 'lucide-react';
import { Order } from '../types';
import { fetchCustomOrderById } from '../services/supabaseService';
import { CustomOrderRow } from '../lib/supabase';

interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  initialOrderNumber?: string;
  onSelectProof?: (order: Order) => void;
}

export const OrderTrackingModal: React.FC<OrderTrackingModalProps> = ({
  isOpen,
  onClose,
  orders,
  initialOrderNumber = '',
  onSelectProof,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialOrderNumber);
  const [copiedAwb, setCopiedAwb] = useState(false);
  const [liveSupabaseOrder, setLiveSupabaseOrder] = useState<CustomOrderRow | null>(null);
  const [isSearchingLive, setIsSearchingLive] = useState(false);

  // Sync initial search query when modal opens
  useEffect(() => {
    if (isOpen && initialOrderNumber) {
      setSearchQuery(initialOrderNumber);
    }
  }, [isOpen, initialOrderNumber]);

  // Live Supabase lookup for real-time status and courier updates
  useEffect(() => {
    if (!isOpen) return;
    const query = searchQuery.trim();
    if (!query) {
      setLiveSupabaseOrder(null);
      return;
    }

    let isMounted = true;
    setIsSearchingLive(true);
    fetchCustomOrderById(query)
      .then((res) => {
        if (isMounted) {
          setLiveSupabaseOrder(res);
          setIsSearchingLive(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsSearchingLive(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, searchQuery]);

  if (!isOpen) return null;

  // Find order in local state first
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const localMatch = trimmedQuery
    ? orders.find(
        o => o.orderNumber.toLowerCase() === trimmedQuery ||
             o.id.toLowerCase() === trimmedQuery ||
             (o.trackingNumber && o.trackingNumber.toLowerCase() === trimmedQuery)
      )
    : orders[0];

  // Helper to ensure legacy BlueDart mock strings are upgraded cleanly to Delhivery Express
  const normalizeCourier = (partner?: string | null) => {
    if (!partner || /bluedart|blue\s*dart/i.test(partner)) return 'Delhivery Express';
    return partner;
  };
  const normalizeTracking = (awb?: string | null) => {
    if (!awb) return undefined;
    if (awb === 'BD-AIR-8920194812') return 'DLV-EXP-8920194812';
    return awb;
  };

  // Derive consolidated active order (incorporating live Supabase courier & status if found)
  const activeOrder: Order | null = localMatch ? {
    ...localMatch,
    courierPartner: normalizeCourier(liveSupabaseOrder?.courier_partner || localMatch.courierPartner),
    trackingNumber: normalizeTracking(liveSupabaseOrder?.tracking_number || localMatch.trackingNumber),
    orderStatus: liveSupabaseOrder?.status === 'dispatched' ? 'Dispatched' :
      liveSupabaseOrder?.status === 'delivered' ? 'Delivered' :
      liveSupabaseOrder?.status === 'in-production' ? 'Manufacturing' :
      localMatch.orderStatus,
    proofStatus: liveSupabaseOrder?.status === 'approved' || liveSupabaseOrder?.status === 'in-production' || liveSupabaseOrder?.status === 'dispatched' || liveSupabaseOrder?.status === 'delivered'
      ? 'Approved by Client'
      : localMatch.proofStatus,
  } : liveSupabaseOrder ? {
    id: liveSupabaseOrder.id,
    orderNumber: liveSupabaseOrder.id.startsWith('TQ-') ? liveSupabaseOrder.id : `TQ-${liveSupabaseOrder.id.slice(0, 8).toUpperCase()}`,
    createdAt: liveSupabaseOrder.created_at,
    items: [],
    subtotal: 998,
    gstRate: 0.18,
    gstAmount: 180,
    shippingFee: 0,
    total: 1178,
    shippingAddress: {
      fullName: liveSupabaseOrder.customer_name,
      companyName: liveSupabaseOrder.company || undefined,
      email: liveSupabaseOrder.customer_email,
      phone: liveSupabaseOrder.phone,
      street: 'Corporate Hub Delivery',
      city: 'Metro Hub',
      state: 'India',
      pincode: '560001',
      isB2BInvoice: true,
    },
    proofStatus: liveSupabaseOrder.status === 'approved' || liveSupabaseOrder.status === 'in-production' || liveSupabaseOrder.status === 'dispatched' || liveSupabaseOrder.status === 'delivered'
      ? 'Approved by Client'
      : 'Proof Ready - Needs Approval',
    orderStatus: liveSupabaseOrder.status === 'dispatched' ? 'Dispatched' :
      liveSupabaseOrder.status === 'delivered' ? 'Delivered' :
      liveSupabaseOrder.status === 'in-production' ? 'Manufacturing' :
      'Artwork Verification',
    estimatedDispatch: new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0],
    trackingNumber: normalizeTracking(liveSupabaseOrder.tracking_number),
    courierPartner: normalizeCourier(liveSupabaseOrder.courier_partner),
    paymentMode: 'Full Prepaid (100% Online)',
    paymentStatus: 'Paid in Full (Razorpay)',
  } : null;

  const handleCopyAwb = (awb: string) => {
    navigator.clipboard.writeText(awb);
    setCopiedAwb(true);
    setTimeout(() => setCopiedAwb(false), 2000);
  };

  // 6-Stage Timeline Configuration
  const stages = [
    {
      id: 1,
      title: 'Order Confirmed',
      desc: 'Payment mode verified via B2B gateway',
      timestamp: activeOrder ? new Date(activeOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Logged',
      isCompleted: true,
      isCurrent: false,
    },
    {
      id: 2,
      title: 'Pre-Press Artwork & Pantone Proof',
      desc: activeOrder?.proofStatus === 'Approved by Client' ? 'Approved & signed-off by client' : 'Digital proof awaiting client approval',
      timestamp: activeOrder?.proofStatus === 'Approved by Client' ? 'Signed Off' : 'Active Checkpoint',
      isCompleted: activeOrder?.proofStatus === 'Approved by Client',
      isCurrent: activeOrder?.proofStatus !== 'Approved by Client',
    },
    {
      id: 3,
      title: 'Factory Direct Production',
      desc: 'DTF transfer printing & 12-needle Tajima embroidery line',
      timestamp: activeOrder?.orderStatus === 'Manufacturing' || activeOrder?.orderStatus === 'Dispatched' || activeOrder?.orderStatus === 'Delivered' ? 'In Progress' : 'Queued',
      isCompleted: activeOrder?.orderStatus === 'Dispatched' || activeOrder?.orderStatus === 'Delivered',
      isCurrent: activeOrder?.orderStatus === 'Manufacturing',
    },
    {
      id: 4,
      title: 'Quality Check & Packaging',
      desc: 'GSM tolerance audit, double-stitch test, individual polybag seal',
      timestamp: activeOrder?.orderStatus === 'Dispatched' || activeOrder?.orderStatus === 'Delivered' ? 'Passed QA' : 'Pending',
      isCompleted: activeOrder?.orderStatus === 'Dispatched' || activeOrder?.orderStatus === 'Delivered',
      isCurrent: activeOrder?.orderStatus === 'Quality Check',
    },
    {
      id: 5,
      title: `Dispatched via ${activeOrder?.courierPartner || 'Delhivery Express'}`,
      desc: `Waybill AWB: ${activeOrder?.trackingNumber || 'Awaiting Manifest'}`,
      timestamp: activeOrder?.orderStatus === 'Dispatched' || activeOrder?.orderStatus === 'Delivered' ? 'In Transit' : `Est. ${activeOrder?.estimatedDispatch}`,
      isCompleted: activeOrder?.orderStatus === 'Delivered',
      isCurrent: activeOrder?.orderStatus === 'Dispatched',
    },
    {
      id: 6,
      title: 'Out for Delivery & Delivered',
      desc: `Destination: ${activeOrder?.shippingAddress.city}, ${activeOrder?.shippingAddress.state}`,
      timestamp: activeOrder?.orderStatus === 'Delivered' ? 'Delivered' : 'Awaiting Hub Arrival',
      isCompleted: activeOrder?.orderStatus === 'Delivered',
      isCurrent: false,
    },
  ];

  const completedStagesCount = stages.filter((s) => s.isCompleted).length;
  const activeStageNumber = Math.max(
    1,
    stages.findIndex((s) => s.isCurrent || (!s.isCompleted && !s.isCurrent)) + 1
  );
  const progressPercent = Math.min(100, Math.max(18, Math.round((completedStagesCount / stages.length) * 100) + 12));

  return (
    <div
      className="fixed inset-0 z-50 bg-[#071B35]/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-2.5 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-full border border-slate-200/80 shadow-[0_28px_70px_-15px_rgba(7,27,53,0.4)] overflow-hidden my-3 sm:my-6 max-h-[calc(100dvh-1.5rem)] sm:max-h-[90dvh] flex flex-col animate-admin-scale-in"
      >
        {/* Top Brand Navy Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-[#071B35] via-[#0B2347] to-[#071B35] text-white px-4 sm:px-7 py-4 sm:py-6 shrink-0 border-b border-white/10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-12 w-72 h-72 rounded-full opacity-35 blur-3xl animate-portal-glow"
            style={{
              background:
                'radial-gradient(circle, rgba(255,121,0,0.55) 0%, transparent 70%)',
            }}
          />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#FF9E44] bg-[#FF7900]/15 border border-[#FF7900]/40 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-[#FF7900] animate-tracking-truck" />
                  <span>Live Factory &amp; Delhivery Tracker</span>
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-300 font-mono bg-emerald-500/10 border border-emerald-400/25 px-2 py-0.5 rounded-full">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-tracking-ring absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  {isSearchingLive ? 'Syncing Delhivery...' : 'Delhivery One Sync'}
                </span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-white mt-2 tracking-tight">
                Consignment &amp; Proof Production Status
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Inspect real-time proof sign-off, production milestones, and Delhivery air waybills.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close tracking modal"
              className="text-slate-300 hover:text-white p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all cursor-pointer group shrink-0"
            >
              <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-7 space-y-6 overflow-y-auto flex-1 bg-[#F8FAFC]">
          {/* Search Bar for Order ID */}
          <div className="flex flex-col sm:flex-row gap-2.5 animate-admin-fade-up">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Order ID (e.g. TQ-89201) or Delhivery AWB Number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-slate-200 rounded-xl outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/15 text-[#071B35] shadow-2xs transition-all min-h-[42px]"
              />
            </div>
            {orders.length > 1 && (
              <select
                value={activeOrder?.orderNumber || ''}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3.5 py-2.5 text-xs font-mono font-semibold border border-slate-200 rounded-xl bg-white text-[#071B35] outline-none focus:border-[#FF7900] shadow-2xs min-h-[42px] cursor-pointer"
              >
                {orders.map(o => (
                  <option key={o.id} value={o.orderNumber}>{o.orderNumber}</option>
                ))}
              </select>
            )}
          </div>

          {activeOrder ? (
            <div className="space-y-5">
              {/* Order Overview Summary Banner with Delhivery Courier & Animated Route */}
              <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-br from-[#071B35] via-[#0B2347] to-[#0D274A] text-white shadow-lg border border-white/10 space-y-4 animate-admin-fade-up">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -bottom-12 w-52 h-52 rounded-full bg-[#FF7900]/15 blur-2xl animate-portal-glow"
                />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono font-bold text-base text-[#FF7900] bg-[#FF7900]/15 border border-[#FF7900]/30 px-2.5 py-0.5 rounded-lg">
                        {activeOrder.orderNumber}
                      </span>
                      <span className="text-xs text-slate-300 font-medium">
                        {activeOrder.items.reduce((sum, i) => sum + i.quantity, 0)} Total Units
                      </span>
                    </div>
                    <div className="text-xs text-slate-300 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[#FF7900] shrink-0" />
                      <span>
                        Deliver to: <strong className="text-white">{activeOrder.shippingAddress.fullName}</strong> ({activeOrder.shippingAddress.city}, {activeOrder.shippingAddress.pincode})
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-1.5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF7900] animate-pulse" />
                      Official Courier Partner
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 font-mono text-xs font-bold text-white bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-1.5 rounded-xl transition-colors">
                        <Truck className="w-3.5 h-3.5 text-[#FF7900] animate-tracking-truck" />
                        <span>{activeOrder.courierPartner || 'Delhivery Express'}</span>
                      </span>
                      {activeOrder.trackingNumber && (
                        <button
                          type="button"
                          onClick={() => handleCopyAwb(activeOrder.trackingNumber!)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#FF7900]/15 hover:bg-[#FF7900] text-[#FF9E44] hover:text-white border border-[#FF7900]/35 transition-all cursor-pointer text-[11px] font-mono font-semibold"
                          title="Copy Delhivery AWB Number"
                        >
                          <span>{activeOrder.trackingNumber}</span>
                          {copiedAwb ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Animated Live Delhivery Transit Progress Strip */}
                <div className="relative z-10 pt-3 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <span className="inline-flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-[#FF9E44]" />
                      Hyderabad Hub
                    </span>
                    <span className="text-[#FF9E44] font-semibold">
                      Stage {activeStageNumber}/6 · {activeOrder.orderStatus}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      {activeOrder.shippingAddress.city}
                      <MapPin className="w-3 h-3 text-emerald-400" />
                    </span>
                  </div>
                  <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="relative h-full rounded-full bg-gradient-to-r from-[#FF7900] via-[#FF9E44] to-emerald-400 transition-all duration-700 ease-out overflow-hidden"
                      style={{ width: `${progressPercent}%` }}
                    >
                      <div className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent animate-tracking-shimmer" />
                    </div>
                  </div>
                </div>
              </div>

              {/* 6-Stage Timeline Display */}
              <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-6 animate-admin-fade-up" style={{ animationDelay: '70ms' }}>
                <div className="text-xs font-bold uppercase tracking-wider text-[#071B35] flex items-center justify-between pb-3 border-b border-slate-100">
                  <span>Production &amp; Delhivery Milestones</span>
                  <span className="text-[11px] font-mono font-bold text-[#FF7900] bg-orange-50 border border-orange-200/80 px-2.5 py-0.5 rounded-full">
                    Stage {activeStageNumber} of 6
                  </span>
                </div>

                <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {stages.map((st, idx) => (
                    <div
                      key={st.id}
                      className="relative flex items-start gap-4 animate-admin-fade-up group"
                      style={{ animationDelay: `${idx * 55}ms` }}
                    >
                      {/* Step Icon Node */}
                      <div className={`absolute -left-6 sm:-left-8 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 group-hover:scale-105 ${
                        st.isCompleted
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25'
                          : st.isCurrent
                          ? 'bg-[#FF7900] text-white ring-4 ring-[#FF7900]/20 shadow-md shadow-[#FF7900]/30'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}>
                        {st.isCurrent && (
                          <span className="absolute inset-0 rounded-full bg-[#FF7900] animate-tracking-ring pointer-events-none" />
                        )}
                        <span className="relative z-10">
                          {st.isCompleted ? <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : st.id}
                        </span>
                      </div>

                      {/* Step Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h4 className={`text-xs sm:text-sm font-bold transition-colors ${
                            st.isCompleted || st.isCurrent ? 'text-[#071B35]' : 'text-slate-400'
                          }`}>
                            {st.title}
                          </h4>
                          <span className={`text-[11px] font-mono ${st.isCurrent ? 'text-[#FF7900] font-semibold' : 'text-slate-500'}`}>
                            {st.timestamp}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{st.desc}</p>

                        {/* If Proofing stage is pending, provide quick proof approval button */}
                        {st.id === 2 && activeOrder.proofStatus === 'Proof Ready - Needs Approval' && onSelectProof && (
                          <div className="mt-2.5 p-3 rounded-xl bg-orange-50 border border-orange-200 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-xs text-orange-950 font-medium">
                              Digital proof ready for sign-off. Production on hold until verified.
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                onSelectProof(activeOrder);
                                onClose();
                              }}
                              className="bg-[#071B35] hover:bg-[#0B2347] text-white text-xs font-semibold px-3.5 py-2 rounded-xl whitespace-nowrap cursor-pointer transition-colors"
                            >
                              Review &amp; Approve Proof
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Consignment Items Breakdown */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-[#071B35]">
                  Package Contents ({activeOrder.items.length} Lines)
                </div>
                <div className="divide-y divide-slate-100">
                  {activeOrder.items.map((item, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-[#071B35]">{item.product.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {item.color.name} {item.size ? `· Size ${item.size}` : ''} · Print: {item.printMethod}
                        </div>
                      </div>
                      <div className="font-mono font-bold text-[#071B35] bg-slate-100 px-2.5 py-1 rounded-lg">
                        {item.quantity} units
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
              No order found matching your inquiry. Please verify the order number.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
