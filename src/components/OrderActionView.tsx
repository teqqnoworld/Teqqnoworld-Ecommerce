import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ArrowLeft, Package, ShieldCheck, AlertCircle } from 'lucide-react';
import { submitWhatsAppOrderAction } from '../services/aisensyService';
import { WhatsAppIcon } from './WhatsAppIcon';

interface OrderActionViewProps {
  action: 'confirm' | 'cancel';
  orderId: string;
  orderNumber: string;
  token?: string;
  onOrderActionComplete: (orderId: string, orderNumber: string, status: 'confirmed' | 'cancelled') => void;
  onViewOrder: (orderNumber: string) => void;
  onBackHome: () => void;
}

export const OrderActionView: React.FC<OrderActionViewProps> = ({
  action,
  orderId,
  orderNumber,
  token,
  onOrderActionComplete,
  onViewOrder,
  onBackHome,
}) => {
  const [loading, setLoading] = useState(true);
  const [resultStatus, setResultStatus] = useState<'confirmed' | 'cancelled' | null>(null);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const executeAction = async (targetAction: 'confirm' | 'cancel') => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await submitWhatsAppOrderAction({
        orderId,
        orderNumber,
        action: targetAction,
        token: targetAction === action ? token : undefined,
        source: 'whatsapp_link',
      });

      if (!res.success || !res.whatsappActionStatus) {
        setErrorMsg(res.message || 'Unable to verify your WhatsApp order action.');
        return;
      }

      setResultStatus(res.whatsappActionStatus);
      setMessage(res.message);
      setUpdatedAt(res.updatedAt || new Date().toISOString());

      onOrderActionComplete(orderId, orderNumber, res.whatsappActionStatus);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while updating your order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void executeAction(action);
  }, [action, orderId, orderNumber, token]);

  return (
    <div className="min-h-[75vh] bg-[#F4F2FA] py-12 px-4 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-[#071B35] p-6 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1EBE5D] text-white flex items-center justify-center shrink-0">
              <WhatsAppIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-[#FF9B3D]">
                TeqqnoWorld WhatsApp Action
              </div>
              <h1 className="font-display font-bold text-lg">
                Order #{orderNumber || orderId}
              </h1>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-5 text-center">
          {loading ? (
            <div className="py-8 space-y-3">
              <Loader2 className="w-10 h-10 animate-spin text-[#FF7A00] mx-auto" />
              <div className="font-display font-bold text-base text-[#071B35]">
                Updating Order Status...
              </div>
              <p className="text-xs text-slate-500">
                Processing your {action === 'confirm' ? 'Confirm Order' : 'Cancel Order'} request via WhatsApp verification.
              </p>
            </div>
          ) : errorMsg ? (
            <div className="py-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto border border-red-200">
                <AlertCircle className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="font-display font-bold text-lg text-[#071B35]">Action Verification Failed</h2>
                <p className="text-xs text-red-600">{errorMsg}</p>
              </div>
              <button
                type="button"
                onClick={onBackHome}
                className="px-5 py-2.5 rounded-xl bg-[#071B35] text-white text-xs font-semibold cursor-pointer"
              >
                Return to TeqqnoWorld
              </button>
            </div>
          ) : (
            <>
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto border ${
                  resultStatus === 'confirmed'
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}
              >
                {resultStatus === 'confirmed' ? (
                  <CheckCircle2 className="w-9 h-9" />
                ) : (
                  <XCircle className="w-9 h-9" />
                )}
              </div>

              <div className="space-y-2">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border ${
                    resultStatus === 'confirmed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {resultStatus === 'confirmed' ? 'CONFIRMED VIA WHATSAPP' : 'CANCELLED VIA WHATSAPP'}
                </span>

                <h2 className="font-display font-bold text-xl text-[#071B35]">
                  {resultStatus === 'confirmed'
                    ? 'Aapka Order Confirm Ho Gaya Hai!'
                    : 'Aapka Order Cancel Kar Diya Gaya Hai'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{message}</p>
                {updatedAt && (
                  <div className="text-[11px] font-mono text-slate-400">
                    Updated: {new Date(updatedAt).toLocaleString('en-IN')}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 flex items-start gap-2.5 text-left">
                <ShieldCheck className="w-4 h-4 text-[#FF7A00] shrink-0 mt-0.5" />
                <span>
                  {resultStatus === 'confirmed'
                    ? 'Our production team has received your WhatsApp confirmation and queued your digital proof for priority 24–48h dispatch.'
                    : 'Cancellation alert sent to TeqqnoWorld Admin desk. If you paid online, refund processing or design modification support will be initiated within 24 hours.'}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => onViewOrder(orderNumber || orderId)}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Package className="w-4 h-4" />
                  <span>View Order Details</span>
                </button>
                <button
                  type="button"
                  onClick={onBackHome}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#071B35] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Store</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
