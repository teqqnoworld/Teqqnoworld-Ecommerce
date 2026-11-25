import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Megaphone,
  Percent,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Target,
  Users,
  XCircle,
} from 'lucide-react';
import {
  adminAwardReward,
  adminCreateAnnouncement,
  adminCreateTarget,
  adminProcessWithdrawal,
  adminReviewApplication,
  adminReviewKyc,
  adminTriggerOrderLifecycle,
  adminUpdateCommission,
  adminUpdateFraudFlag,
  adminUpdatePartnerStatus,
  adminUpdateProductCommission,
  adminUpdateProgramSettings,
  adminUpdateSupportTicket,
  downloadAffiliateReportPdf,
  downloadCsvFile,
  fetchAdminAffiliateOverview,
  formatInrPaisa,
  formatShortDate,
} from '../../services/affiliateService';
import type {
  AffiliateApplicationRecord,
  AffiliateAuditLogRecord,
  AffiliateClosureRequest,
  AffiliateCommissionRecord,
  AffiliateFraudFlagRecord,
  AffiliateKycMaskedView,
  AffiliatePartnerRecord,
  AffiliateProductSetting,
  AffiliateProgramSettings,
  AffiliateReactivationRequest,
  AffiliateRewardRecord,
  AffiliateSalesTarget,
  AffiliateSupportTicket,
  AffiliateWalletSummary,
  AffiliateWithdrawalRecord,
} from '../../types/affiliate';

type AdminAffiliateTab =
  | 'overview'
  | 'applications'
  | 'kyc'
  | 'partners'
  | 'products'
  | 'commissions'
  | 'withdrawals'
  | 'fraud'
  | 'incentives'
  | 'support'
  | 'settings'
  | 'audit';

export const AdminAffiliatePanel: React.FC = () => {
  const [tab, setTab] = useState<AdminAffiliateTab>('overview');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reason / input states (never window.prompt or window.alert)
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [utrMap, setUtrMap] = useState<Record<string, string>>({});
  const [ticketReplyMap, setTicketReplyMap] = useState<Record<string, string>>({});
  const [productDrafts, setProductDrafts] = useState<
    Record<
      string,
      {
        enabled: boolean;
        commissionRatePct: string;
        campaignRatePct: string;
        campaignLabel: string;
        startDate: string;
        endDate: string;
      }
    >
  >({});

  // Target & Reward creation forms
  const [targetMonth, setTargetMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [targetTitle, setTargetTitle] = useState('');
  const [targetMetric, setTargetMetric] = useState<'delivered_orders' | 'delivered_sales_paisa'>('delivered_orders');
  const [targetValue, setTargetValue] = useState('10');
  const [targetRewardTitle, setTargetRewardTitle] = useState('');
  const [targetRewardInr, setTargetRewardInr] = useState('1000');

  const [awardPartnerId, setAwardPartnerId] = useState('');
  const [awardTitle, setAwardTitle] = useState('');
  const [awardType, setAwardType] = useState<'cash_bonus' | 'gift' | 'product' | 'voucher' | 'custom'>('cash_bonus');
  const [awardInr, setAwardInr] = useState('500');

  // Announcement form
  const [annTitle, setAnnTitle] = useState('');
  const [annMessage, setAnnMessage] = useState('');
  const [annPriority, setAnnPriority] = useState<'normal' | 'important'>('normal');

  // Program settings draft
  const [settingsDraft, setSettingsDraft] = useState<{
    programEnabled: boolean;
    programPaused: boolean;
    registrationOpen: boolean;
    affiliateIdPrefix: string;
    cookieDurationDays: number;
    returnPeriodDays: number;
    minWithdrawalInr: number;
    defaultCommissionRatePct: number;
  } | null>(null);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4500);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const res = await fetchAdminAffiliateOverview();
      setData(res);
      const s: AffiliateProgramSettings = res.settings;
      setSettingsDraft({
        programEnabled: s.programEnabled,
        programPaused: s.programPaused,
        registrationOpen: s.registrationOpen,
        affiliateIdPrefix: s.affiliateIdPrefix,
        cookieDurationDays: s.cookieDurationDays,
        returnPeriodDays: s.returnPeriodDays,
        minWithdrawalInr: s.minWithdrawalPaisa / 100,
        defaultCommissionRatePct: s.defaultCommissionRatePct,
      });
      const drafts: typeof productDrafts = {};
      for (const p of (res.productSettings || []) as AffiliateProductSetting[]) {
        drafts[p.productId] = {
          enabled: p.enabled,
          commissionRatePct: String(p.commissionRatePct),
          campaignRatePct: p.campaignRatePct !== null ? String(p.campaignRatePct) : '',
          campaignLabel: p.campaignLabel || '',
          startDate: p.startDate ? p.startDate.slice(0, 10) : '',
          endDate: p.endDate ? p.endDate.slice(0, 10) : '',
        };
      }
      setProductDrafts(drafts);
    } catch (err: any) {
      notify(err?.message || 'Failed to load Affiliate Admin data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  if (loading && !data) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-xs text-slate-500">
        Loading Affiliate Partner Program Admin Console...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-[#FF7A00] mx-auto" />
        <p className="text-xs text-slate-600">{feedback?.text || 'Unable to load affiliate console.'}</p>
        <button
          onClick={loadAll}
          className="px-4 py-2 rounded-lg bg-[#071B35] text-white text-xs font-semibold cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  const kpis = data.kpis;
  const applications: AffiliateApplicationRecord[] = data.applications || [];
  const kycRecords: AffiliateKycMaskedView[] = data.kycRecords || [];
  const partners: Array<AffiliatePartnerRecord & { wallet: AffiliateWalletSummary }> = data.partners || [];
  const productSettings: AffiliateProductSetting[] = data.productSettings || [];
  const commissions: AffiliateCommissionRecord[] = data.commissions || [];
  const withdrawals: AffiliateWithdrawalRecord[] = data.withdrawals || [];
  const fraudFlags: AffiliateFraudFlagRecord[] = data.fraudFlags || [];
  const targets: AffiliateSalesTarget[] = data.targets || [];
  const rewards: AffiliateRewardRecord[] = data.rewards || [];
  const tickets: AffiliateSupportTicket[] = data.tickets || [];
  const reactivationRequests: AffiliateReactivationRequest[] = data.reactivationRequests || [];
  const closureRequests: AffiliateClosureRequest[] = data.closureRequests || [];
  const auditLogs: AffiliateAuditLogRecord[] = data.auditLogs || [];

  const exportAdminPartnersCsv = () => {
    downloadCsvFile(
      'teqqnoworld-affiliate-partners.csv',
      ['Affiliate ID', 'Name', 'Email', 'Status', 'Pending INR', 'Available INR', 'Withdrawn INR', 'Joined'],
      partners.map((p) => [
        p.affiliateId,
        p.fullName,
        p.customerEmail,
        p.status,
        (p.wallet.pendingPaisa / 100).toFixed(2),
        (p.wallet.availablePaisa / 100).toFixed(2),
        (p.wallet.totalWithdrawnPaisa / 100).toFixed(2),
        formatShortDate(p.joinedAt),
      ])
    );
  };

  const exportAdminPayoutsPdf = () => {
    downloadAffiliateReportPdf({
      title: 'Affiliate Withdrawals & Payout Audit Report',
      subtitle: `Generated ${formatShortDate(new Date().toISOString())}`,
      filename: 'teqqnoworld-affiliate-payouts.pdf',
      headers: ['Code', 'Affiliate ID', 'Partner', 'Amount', 'Bank', 'Status', 'Reference'],
      rows: withdrawals.map((w) => [
        w.requestCode,
        w.affiliateId,
        w.partnerName,
        formatInrPaisa(w.amountPaisa),
        `${w.bankAccountMaskedSnapshot} (${w.bankIfscSnapshot})`,
        w.status.toUpperCase(),
        w.transferReference || w.rejectionReason || '—',
      ]),
    });
  };

  const subTabs: Array<{ id: AdminAffiliateTab; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'applications', label: 'Applications', count: kpis.pendingApplications },
    { id: 'kyc', label: 'KYC & Bank', count: kpis.pendingKyc },
    { id: 'partners', label: 'Partners', count: kpis.totalPartners },
    { id: 'products', label: 'Product Rates', count: kpis.enabledProducts },
    { id: 'commissions', label: 'Commissions' },
    { id: 'withdrawals', label: 'Withdrawals', count: kpis.pendingWithdrawalsCount },
    { id: 'fraud', label: 'Fraud & Holds', count: kpis.openFraudFlags },
    { id: 'incentives', label: 'Targets & Rewards' },
    { id: 'support', label: 'Announcements & Support', count: kpis.openSupportTickets },
    { id: 'settings', label: 'Settings' },
    { id: 'audit', label: 'Audit Logs' },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {subTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
                tab === t.id
                  ? 'bg-[#071B35] text-white'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-[#071B35]'
              }`}
            >
              <span>{t.label}</span>
              {typeof t.count === 'number' && t.count > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded font-mono text-[10px] ${
                    tab === t.id ? 'bg-[#FF7A00] text-white' : 'bg-slate-200 text-slate-800'
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportAdminPartnersCsv}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#071B35] hover:bg-slate-50 cursor-pointer flex items-center gap-1"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            onClick={exportAdminPayoutsPdf}
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-[#071B35] hover:bg-slate-50 cursor-pointer flex items-center gap-1"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
          <button
            onClick={loadAll}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#071B35] cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* 1. OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Active Partners', value: String(kpis.activePartners), sub: `${kpis.suspendedPartners} suspended • ${kpis.closedPartners} closed` },
              { label: 'Pending Apps / KYC', value: `${kpis.pendingApplications} / ${kpis.pendingKyc}`, sub: 'Require admin review' },
              { label: 'Referred Sales', value: formatInrPaisa(kpis.totalReferredSalesPaisa), sub: `${kpis.totalReferredOrders} orders • ${kpis.totalClicks} clicks` },
              { label: 'Pending Withdrawals', value: formatInrPaisa(kpis.pendingWithdrawalsPaisa), sub: `${kpis.pendingWithdrawalsCount} requests • Paid: ${formatInrPaisa(kpis.totalPaidOutPaisa)}` },
            ].map((card) => (
              <div key={card.label} className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
                <div className="text-[11px] text-slate-500">{card.label}</div>
                <div className="text-xl font-bold font-mono tabular-nums text-[#071B35]">{card.value}</div>
                <div className="text-[11px] text-slate-500">{card.sub}</div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-600">
              <strong className="text-[#071B35]">Return-Period Release Sweep:</strong> Release all
              delivered commissions whose return period has elapsed and have no refund/fraud holds.
            </div>
            <button
              onClick={async () => {
                try {
                  const res = await adminTriggerOrderLifecycle({ event: 'release_due' });
                  notify(`Released ${res.releasedCount || 0} eligible pending commission(s) to Available wallet.`);
                  loadAll();
                } catch (err: any) {
                  notify(err?.message || 'Release sweep failed.', 'error');
                }
              }}
              className="px-4 py-2 rounded-lg bg-[#FF7A00] hover:bg-[#e56d00] text-white text-xs font-semibold cursor-pointer"
            >
              Run Release Sweep Now
            </button>
          </div>
        </div>
      )}

      {/* 2. APPLICATIONS */}
      {tab === 'applications' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-sm font-bold text-[#071B35]">
            Affiliate Partner Applications ({applications.length})
          </h3>
          {applications.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No affiliate applications submitted yet.</p>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div key={app.id} className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong className="text-sm text-[#071B35]">
                        {app.firstName} {app.lastName}
                      </strong>{' '}
                      <span className="font-mono text-slate-500">({app.customerEmail} • +91 {app.mobile})</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded bg-slate-100 font-mono uppercase font-bold text-[#071B35]">
                      {app.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-4">
                    <span>Qualifying Order: <strong className="font-mono">{app.qualifyingOrderId || '—'}</strong></span>
                    <span>Email Verified: <strong>{app.emailVerified ? 'Yes' : 'No'}</strong></span>
                    <span>Terms: <strong>{app.termsVersion}</strong></span>
                    <span>Submitted: <strong>{formatShortDate(app.createdAt)}</strong></span>
                  </div>
                  {app.status !== 'approved' && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <input
                        type="text"
                        value={reasonMap[app.id] || ''}
                        onChange={(e) => setReasonMap((p) => ({ ...p, [app.id]: e.target.value }))}
                        placeholder="Rejection reason (mandatory if rejecting) or admin note"
                        className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                      <button
                        onClick={async () => {
                          try {
                            await adminReviewApplication(app.id, {
                              action: 'approve_application',
                              adminNotes: reasonMap[app.id],
                            });
                            notify('Application approved for KYC verification.');
                            loadAll();
                          } catch (err: any) {
                            notify(err?.message || 'Action failed', 'error');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                      >
                        Approve for KYC
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await adminReviewApplication(app.id, {
                              action: 'reject',
                              reason: reasonMap[app.id] || '',
                            });
                            notify('Application rejected with recorded reason.');
                            loadAll();
                          } catch (err: any) {
                            notify(err?.message || 'Rejection reason required', 'error');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-red-600 text-white font-semibold cursor-pointer"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. KYC & BANK VERIFICATION (MASKED ONLY + HONEST PENNY DROP CHECK) */}
      {tab === 'kyc' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold text-[#071B35]">
                KYC &amp; Bank Verification Queue ({kycRecords.length})
              </h3>
              <p className="text-xs text-slate-500">
                Sensitive identifiers are encrypted at rest and displayed masked. Penny Drop status:{' '}
                <strong>
                  {data.pennyDropConfigured
                    ? 'External Provider Configured'
                    : 'Not Configured (Use Admin Manual Document Review)'}
                </strong>
              </p>
            </div>
          </div>

          {kycRecords.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No KYC submissions yet.</p>
          ) : (
            <div className="space-y-3">
              {kycRecords.map((k) => (
                <div key={k.id} className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-mono font-bold text-[#071B35]">{k.customerEmail}</div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span>KYC: <strong className="uppercase">{k.kycStatus}</strong></span>
                      <span>Bank: <strong className="uppercase">{k.bankVerificationStatus}</strong></span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-lg font-mono text-[11px]">
                    <div>Aadhaar: <strong>{k.aadhaarMasked}</strong></div>
                    <div>PAN: <strong>{k.panMasked}</strong></div>
                    <div>Bank: <strong>{k.bankAccountMasked}</strong></div>
                    <div>IFSC: <strong>{k.bankIfscCode}</strong> ({k.bankAccountHolderName})</div>
                  </div>
                  <div className="text-[11px] text-slate-500 flex flex-wrap gap-3">
                    <span>Aadhaar Doc: {k.aadhaarDocName || 'Not uploaded'}</span>
                    <span>PAN Doc: {k.panDocName || 'Not uploaded'}</span>
                    <span>Bank Proof: {k.bankProofDocName || 'Not uploaded'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <input
                      type="text"
                      value={reasonMap[k.id] || ''}
                      onChange={(e) => setReasonMap((p) => ({ ...p, [k.id]: e.target.value }))}
                      placeholder="Rejection reason if rejecting KYC/Bank"
                      className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    {k.kycStatus !== 'verified' && (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              await adminReviewKyc(k.id, { action: 'approve_kyc' });
                              notify('KYC marked verified.');
                              loadAll();
                            } catch (err: any) {
                              notify(err?.message || 'Error', 'error');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#071B35] text-white font-semibold cursor-pointer"
                        >
                          Verify KYC
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await adminReviewKyc(k.id, { action: 'reject_kyc', reason: reasonMap[k.id] || '' });
                              notify('KYC rejected.');
                              loadAll();
                            } catch (err: any) {
                              notify(err?.message || 'Rejection reason required', 'error');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold cursor-pointer"
                        >
                          Reject KYC
                        </button>
                      </>
                    )}
                    {k.bankVerificationStatus !== 'verified' && (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              await adminReviewKyc(k.id, { action: 'penny_drop_check' });
                              loadAll();
                            } catch (err: any) {
                              notify(err?.message || 'Penny drop unavailable', 'error');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-[#071B35] font-semibold cursor-pointer"
                        >
                          Penny Drop Check
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await adminReviewKyc(k.id, { action: 'approve_bank' });
                              notify('Bank verified via manual document review.');
                              loadAll();
                            } catch (err: any) {
                              notify(err?.message || 'Error', 'error');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                        >
                          Verify Bank (Manual)
                        </button>
                      </>
                    )}
                    {k.kycStatus === 'verified' && k.bankVerificationStatus === 'verified' && !k.partnerId && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await adminReviewKyc(k.id, { action: 'activate_partner' });
                            notify(`Partner activated! Assigned Affiliate ID: ${res.partner?.affiliateId}`);
                            loadAll();
                          } catch (err: any) {
                            notify(err?.message || 'Activation failed', 'error');
                          }
                        }}
                        className="px-4 py-1.5 rounded-lg bg-[#FF7A00] hover:bg-[#e56d00] text-white font-bold cursor-pointer"
                      >
                        Final Approve &amp; Activate Partner
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. PARTNERS (SUSPEND / REACTIVATE / CLOSE) */}
      {tab === 'partners' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="font-display text-sm font-bold text-[#071B35]">
              Affiliate Partners Directory ({partners.length})
            </h3>
            {partners.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No activated partners yet.</p>
            ) : (
              <div className="space-y-3">
                {partners.map((p) => (
                  <div key={p.id} className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-[#FF7A00]">{p.affiliateId}</span>{' '}
                        <strong className="text-sm text-[#071B35]">{p.fullName}</strong>{' '}
                        <span className="text-slate-500">({p.customerEmail})</span>
                      </div>
                      <span className="uppercase font-mono font-bold text-[#071B35]">{p.status}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-2.5 rounded-lg font-mono text-[11px]">
                      <div>Pending: <strong>{formatInrPaisa(p.wallet.pendingPaisa)}</strong></div>
                      <div>Available: <strong>{formatInrPaisa(p.wallet.availablePaisa)}</strong></div>
                      <div>Processing: <strong>{formatInrPaisa(p.wallet.processingPaisa)}</strong></div>
                      <div>Withdrawn: <strong>{formatInrPaisa(p.wallet.totalWithdrawnPaisa)}</strong></div>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Cert: {p.certificateNumber} • Card: {p.cardNumber} • Verify Code: {p.verificationCode}
                    </div>
                    {p.status !== 'closed' && (
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        <input
                          type="text"
                          value={reasonMap[p.id] || ''}
                          onChange={(e) => setReasonMap((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder="Mandatory reason for suspension or closure note"
                          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                        {p.status === 'active' && (
                          <button
                            onClick={async () => {
                              try {
                                await adminUpdatePartnerStatus(p.id, {
                                  action: 'suspend',
                                  reason: reasonMap[p.id] || '',
                                });
                                notify(`Suspended ${p.affiliateId} and placed funds on hold.`);
                                loadAll();
                              } catch (err: any) {
                                notify(err?.message || 'Reason required', 'error');
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-semibold cursor-pointer"
                          >
                            Suspend &amp; Hold Funds
                          </button>
                        )}
                        {p.status === 'suspended' && (
                          <button
                            onClick={async () => {
                              try {
                                await adminUpdatePartnerStatus(p.id, {
                                  action: 'reactivate',
                                  reason: reasonMap[p.id] || 'Reactivated by admin',
                                  releaseHeldCommissions: true,
                                });
                                notify(`Reactivated ${p.affiliateId}.`);
                                loadAll();
                              } catch (err: any) {
                                notify(err?.message || 'Error', 'error');
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                          >
                            Approve Reactivation
                          </button>
                        )}
                        <button
                          onClick={async () => {
                            try {
                              await adminUpdatePartnerStatus(p.id, {
                                action: 'close',
                                reason: reasonMap[p.id] || 'Account closure approved',
                              });
                              notify(`Closed ${p.affiliateId}, settled available balance, cancelled unpaid pending.`);
                              loadAll();
                            } catch (err: any) {
                              notify(err?.message || 'Error', 'error');
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold cursor-pointer"
                        >
                          Close &amp; Settle Account
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {(reactivationRequests.length > 0 || closureRequests.length > 0) && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
              <h4 className="font-display font-bold text-[#071B35]">
                Partner Reactivation &amp; Closure Requests
              </h4>
              {reactivationRequests.map((r) => (
                <div key={r.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <strong>Reactivation ({r.affiliateId})</strong> — {r.status.toUpperCase()}: {r.reason}
                </div>
              ))}
              {closureRequests.map((r) => (
                <div key={r.id} className="p-3 rounded-lg bg-red-50 border border-red-200">
                  <strong>Closure ({r.affiliateId})</strong> — {r.status.toUpperCase()}: {r.reason}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. PRODUCT COMMISSION SETTINGS (DISABLED BY DEFAULT) */}
      {tab === 'products' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="font-display text-sm font-bold text-[#071B35]">
              Product-Level Affiliate Commission Controls
            </h3>
            <p className="text-xs text-slate-500">
              All products are disabled by default. Manually enable products, assign custom commission %, optional special campaign %, and active dates. Historical order snapshots are never altered by updates.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3">Enabled</th>
                  <th className="py-2.5 px-3">Rate %</th>
                  <th className="py-2.5 px-3">Campaign %</th>
                  <th className="py-2.5 px-3">Campaign Label</th>
                  <th className="py-2.5 px-3">Start / End</th>
                  <th className="py-2.5 px-3 text-right">Save</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {productSettings.map((p) => {
                  const draft = productDrafts[p.productId];
                  if (!draft) return null;
                  return (
                    <tr key={p.productId}>
                      <td className="py-2.5 px-3 font-semibold text-[#071B35]">
                        {p.productName}
                        <div className="text-[10px] font-mono text-slate-400">
                          {p.history.length} config update(s)
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={draft.enabled}
                          onChange={(e) =>
                            setProductDrafts((prev) => ({
                              ...prev,
                              [p.productId]: { ...draft, enabled: e.target.checked },
                            }))
                          }
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max="50"
                          value={draft.commissionRatePct}
                          onChange={(e) =>
                            setProductDrafts((prev) => ({
                              ...prev,
                              [p.productId]: { ...draft, commissionRatePct: e.target.value },
                            }))
                          }
                          className="w-20 px-2 py-1 rounded border border-slate-300 font-mono"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          max="50"
                          placeholder="—"
                          value={draft.campaignRatePct}
                          onChange={(e) =>
                            setProductDrafts((prev) => ({
                              ...prev,
                              [p.productId]: { ...draft, campaignRatePct: e.target.value },
                            }))
                          }
                          className="w-20 px-2 py-1 rounded border border-slate-300 font-mono"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          placeholder="Optional label"
                          value={draft.campaignLabel}
                          onChange={(e) =>
                            setProductDrafts((prev) => ({
                              ...prev,
                              [p.productId]: { ...draft, campaignLabel: e.target.value },
                            }))
                          }
                          className="w-32 px-2 py-1 rounded border border-slate-300"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1">
                          <input
                            type="date"
                            value={draft.startDate}
                            onChange={(e) =>
                              setProductDrafts((prev) => ({
                                ...prev,
                                [p.productId]: { ...draft, startDate: e.target.value },
                              }))
                            }
                            className="px-1.5 py-1 rounded border border-slate-300 text-[11px]"
                          />
                          <input
                            type="date"
                            value={draft.endDate}
                            onChange={(e) =>
                              setProductDrafts((prev) => ({
                                ...prev,
                                [p.productId]: { ...draft, endDate: e.target.value },
                              }))
                            }
                            className="px-1.5 py-1 rounded border border-slate-300 text-[11px]"
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={async () => {
                            try {
                              await adminUpdateProductCommission(p.productId, {
                                enabled: draft.enabled,
                                commissionRatePct: Number(draft.commissionRatePct || 0),
                                campaignRatePct: draft.campaignRatePct ? Number(draft.campaignRatePct) : null,
                                campaignLabel: draft.campaignLabel || null,
                                startDate: draft.startDate || null,
                                endDate: draft.endDate || null,
                              });
                              notify(`Saved affiliate config for ${p.productName}`);
                              loadAll();
                            } catch (err: any) {
                              notify(err?.message || 'Save failed', 'error');
                            }
                          }}
                          className="px-3 py-1 rounded-lg bg-[#071B35] text-white font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. COMMISSIONS MANAGEMENT */}
      {tab === 'commissions' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-sm font-bold text-[#071B35]">
            Order-Item Commissions ({commissions.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="py-2.5 px-3">Affiliate</th>
                  <th className="py-2.5 px-3">Order</th>
                  <th className="py-2.5 px-3">Product</th>
                  <th className="py-2.5 px-3 text-right">Base</th>
                  <th className="py-2.5 px-3 text-right">Rate</th>
                  <th className="py-2.5 px-3 text-right">Commission</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {commissions.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-[#071B35]">{c.affiliateId}</td>
                    <td className="py-2.5 px-3 font-mono">{c.orderNumberMasked}</td>
                    <td className="py-2.5 px-3">{c.productName}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{formatInrPaisa(c.gstInclusiveEligiblePaisa)}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{c.commissionRatePctSnapshot}%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      {formatInrPaisa(c.commissionAmountPaisa)}
                    </td>
                    <td className="py-2.5 px-3 uppercase font-mono text-[11px]">{c.status}</td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      {(c.status === 'pending' || c.status === 'on_hold') && (
                        <button
                          onClick={async () => {
                            await adminUpdateCommission(c.id, { action: 'release', reason: 'Admin verified release' });
                            notify('Commission released to Available wallet.');
                            loadAll();
                          }}
                          className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] cursor-pointer"
                        >
                          Release
                        </button>
                      )}
                      {c.status === 'pending' && (
                        <button
                          onClick={async () => {
                            await adminUpdateCommission(c.id, { action: 'hold', reason: 'Placed on admin review hold' });
                            notify('Commission placed on hold.');
                            loadAll();
                          }}
                          className="px-2 py-1 rounded bg-amber-600 text-white text-[11px] cursor-pointer"
                        >
                          Hold
                        </button>
                      )}
                      {['pending', 'on_hold', 'available', 'under_review'].includes(c.status) && (
                        <button
                          onClick={async () => {
                            await adminUpdateCommission(c.id, { action: 'cancel', reason: 'Cancelled by admin' });
                            notify('Commission cancelled.');
                            loadAll();
                          }}
                          className="px-2 py-1 rounded bg-red-600 text-white text-[11px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. MANUAL WITHDRAWALS QUEUE */}
      {tab === 'withdrawals' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-sm font-bold text-[#071B35]">
            Manual Bank Withdrawal Requests ({withdrawals.length})
          </h3>
          {withdrawals.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No withdrawal requests yet.</p>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div key={w.id} className="border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-[#FF7A00]">{w.requestCode}</span> •{' '}
                      <strong className="text-[#071B35]">{w.partnerName}</strong> ({w.affiliateId})
                    </div>
                    <div className="font-mono font-bold text-base text-[#071B35]">
                      {formatInrPaisa(w.amountPaisa)} <span className="text-[11px] uppercase ml-2">[{w.status}]</span>
                    </div>
                  </div>
                  <div className="text-[11px] font-mono text-slate-600">
                    Bank: {w.bankHolderSnapshot} • {w.bankAccountMaskedSnapshot} • IFSC: {w.bankIfscSnapshot}
                  </div>
                  {['pending', 'processing'].includes(w.status) ? (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                      <input
                        type="text"
                        value={utrMap[w.id] || ''}
                        onChange={(e) => setUtrMap((p) => ({ ...p, [w.id]: e.target.value }))}
                        placeholder="Bank UTR / Transfer Ref (for Paid) OR Rejection Reason"
                        className="flex-1 min-w-[220px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                      <button
                        onClick={async () => {
                          try {
                            await adminProcessWithdrawal(w.id, {
                              action: 'mark_paid',
                              transferReference: utrMap[w.id] || '',
                            });
                            notify(`Marked ${w.requestCode} as PAID.`);
                            loadAll();
                          } catch (err: any) {
                            notify(err?.message || 'UTR reference required', 'error');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                      >
                        Mark Paid
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await adminProcessWithdrawal(w.id, {
                              action: 'reject',
                              rejectionReason: utrMap[w.id] || '',
                            });
                            notify(`Rejected ${w.requestCode} and restored Available wallet balance.`);
                            loadAll();
                          } catch (err: any) {
                            notify(err?.message || 'Rejection reason required', 'error');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-red-600 text-white font-semibold cursor-pointer"
                      >
                        Reject &amp; Restore Funds
                      </button>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500">
                      {w.transferReference ? `Paid Ref: ${w.transferReference}` : `Rejection: ${w.rejectionReason}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. FRAUD MONITORING */}
      {tab === 'fraud' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h3 className="font-display text-sm font-bold text-[#071B35]">
            Fraud Flags &amp; Abuse Monitoring ({fraudFlags.length})
          </h3>
          {fraudFlags.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No fraud flags logged.</p>
          ) : (
            <div className="space-y-3">
              {fraudFlags.map((f) => (
                <div key={f.id} className="border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono font-bold uppercase text-red-700">
                      {f.flagType.replace(/_/g, ' ')} ({f.severity})
                    </span>
                    <span className="font-mono uppercase font-bold">{f.status}</span>
                  </div>
                  <p className="text-slate-700">{f.details}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(['investigating', 'cleared', 'confirmed_fraud'] as const).map((st) => (
                      <button
                        key={st}
                        onClick={async () => {
                          await adminUpdateFraudFlag(f.id, { status: st });
                          notify(`Updated fraud flag to ${st}.`);
                          loadAll();
                        }}
                        className="px-2.5 py-1 rounded border border-slate-300 text-[11px] font-semibold cursor-pointer hover:bg-slate-100"
                      >
                        Mark {st.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9. TARGETS & REWARDS */}
      {tab === 'incentives' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="font-display text-sm font-bold text-[#071B35]">Create Monthly Sales Target</h3>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <input
                type="month"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300"
              />
              <select
                value={targetMetric}
                onChange={(e) => setTargetMetric(e.target.value as any)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="delivered_orders">Delivered Orders Count</option>
                <option value="delivered_sales_paisa">Delivered Sales Value (INR)</option>
              </select>
              <input
                type="text"
                placeholder="Target title (e.g., 10 Delivered Orders)"
                value={targetTitle}
                onChange={(e) => setTargetTitle(e.target.value)}
                className="col-span-2 px-3 py-2 rounded-lg border border-slate-300"
              />
              <input
                type="number"
                placeholder="Target value"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
              <input
                type="number"
                placeholder="Reward value (INR)"
                value={targetRewardInr}
                onChange={(e) => setTargetRewardInr(e.target.value)}
                className="px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
              <input
                type="text"
                placeholder="Reward label (e.g., ₹1,000 Cash Bonus)"
                value={targetRewardTitle}
                onChange={(e) => setTargetRewardTitle(e.target.value)}
                className="col-span-2 px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <button
              onClick={async () => {
                try {
                  await adminCreateTarget({
                    monthKey: targetMonth,
                    title: targetTitle,
                    description: 'Applies to delivered orders after return period completion.',
                    metricType: targetMetric,
                    targetValue: Number(targetValue),
                    rewardType: 'cash_bonus',
                    rewardTitle: targetRewardTitle,
                    rewardValueInr: Number(targetRewardInr),
                  });
                  setTargetTitle('');
                  setTargetRewardTitle('');
                  notify('Monthly sales target created.');
                  loadAll();
                } catch (err: any) {
                  notify(err?.message || 'Unable to create target', 'error');
                }
              }}
              className="px-4 py-2 rounded-lg bg-[#071B35] text-white text-xs font-semibold cursor-pointer"
            >
              Create Target
            </button>

            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              {targets.map((t) => (
                <div key={t.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <strong>{t.monthKey}:</strong> {t.title} → {t.rewardTitle}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="font-display text-sm font-bold text-[#071B35]">
              Award Partner Reward / Bonus
            </h3>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <select
                value={awardPartnerId}
                onChange={(e) => setAwardPartnerId(e.target.value)}
                className="col-span-2 px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="">Select Affiliate Partner...</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.affiliateId} — {p.fullName}
                  </option>
                ))}
              </select>
              <select
                value={awardType}
                onChange={(e) => setAwardType(e.target.value as any)}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white"
              >
                <option value="cash_bonus">Cash Bonus (Credits Wallet)</option>
                <option value="gift">Physical Gift</option>
                <option value="product">Free Product</option>
                <option value="voucher">Voucher</option>
              </select>
              <input
                type="number"
                value={awardInr}
                onChange={(e) => setAwardInr(e.target.value)}
                placeholder="Value in INR"
                className="px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
              <input
                type="text"
                value={awardTitle}
                onChange={(e) => setAwardTitle(e.target.value)}
                placeholder="Reward title (e.g., Top Performer Bonus)"
                className="col-span-2 px-3 py-2 rounded-lg border border-slate-300"
              />
            </div>
            <button
              onClick={async () => {
                try {
                  await adminAwardReward({
                    partnerId: awardPartnerId,
                    sourceType: 'admin_manual',
                    periodLabel: targetMonth,
                    rewardType: awardType,
                    rewardTitle: awardTitle,
                    rewardValueInr: Number(awardInr || 0),
                  });
                  setAwardTitle('');
                  notify('Reward awarded and partner notified.');
                  loadAll();
                } catch (err: any) {
                  notify(err?.message || 'Reward failed', 'error');
                }
              }}
              className="px-4 py-2 rounded-lg bg-[#FF7A00] text-white text-xs font-semibold cursor-pointer"
            >
              Award Reward
            </button>
            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              {rewards.slice(0, 6).map((r) => (
                <div key={r.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <strong>{r.affiliateId}</strong> — {r.rewardTitle} ({r.status})
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 10. ANNOUNCEMENTS & SUPPORT */}
      {tab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="font-display text-sm font-bold text-[#071B35]">
              Broadcast Partner Announcement
            </h3>
            <input
              type="text"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="Announcement headline"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <textarea
              rows={3}
              value={annMessage}
              onChange={(e) => setAnnMessage(e.target.value)}
              placeholder="Announcement body shown in partner dashboards..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <div className="flex items-center justify-between">
              <select
                value={annPriority}
                onChange={(e) => setAnnPriority(e.target.value as any)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="normal">Normal Priority</option>
                <option value="important">Important</option>
              </select>
              <button
                onClick={async () => {
                  try {
                    await adminCreateAnnouncement({
                      title: annTitle,
                      message: annMessage,
                      priority: annPriority,
                    });
                    setAnnTitle('');
                    setAnnMessage('');
                    notify('Announcement published to all active affiliate dashboards.');
                    loadAll();
                  } catch (err: any) {
                    notify(err?.message || 'Failed', 'error');
                  }
                }}
                className="px-4 py-2 rounded-lg bg-[#071B35] text-white text-xs font-semibold cursor-pointer"
              >
                Publish Announcement
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h3 className="font-display text-sm font-bold text-[#071B35]">
              Partner Support Tickets ({tickets.length})
            </h3>
            {tickets.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No support tickets open.</p>
            ) : (
              tickets.map((t) => (
                <div key={t.id} className="border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-[#071B35]">
                    <span>{t.ticketNumber}: {t.subject}</span>
                    <span className="uppercase font-mono text-[11px]">{t.status}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {t.partnerName} ({t.affiliateId}) — {t.messages[t.messages.length - 1]?.message}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ticketReplyMap[t.id] || ''}
                      onChange={(e) => setTicketReplyMap((p) => ({ ...p, [t.id]: e.target.value }))}
                      placeholder="Reply to partner..."
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <button
                      onClick={async () => {
                        await adminUpdateSupportTicket(t.id, {
                          reply: ticketReplyMap[t.id],
                          status: 'resolved',
                        });
                        setTicketReplyMap((p) => ({ ...p, [t.id]: '' }));
                        notify('Support reply sent & ticket marked resolved.');
                        loadAll();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#FF7A00] text-white font-semibold cursor-pointer"
                    >
                      Reply &amp; Resolve
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 11. PROGRAM SETTINGS */}
      {tab === 'settings' && settingsDraft && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 max-w-2xl text-xs">
          <h3 className="font-display text-sm font-bold text-[#071B35]">
            Global Affiliate Program Settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={settingsDraft.programEnabled}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, programEnabled: e.target.checked })}
              />
              <span>Program Enabled</span>
            </label>
            <label className="flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={settingsDraft.programPaused}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, programPaused: e.target.checked })}
              />
              <span>Pause New Clicks &amp; Attribution</span>
            </label>
            <label className="flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={settingsDraft.registrationOpen}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, registrationOpen: e.target.checked })}
              />
              <span>Accept New Partner Registrations</span>
            </label>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Affiliate ID Prefix</label>
              <input
                type="text"
                value={settingsDraft.affiliateIdPrefix}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, affiliateIdPrefix: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Cookie Duration (Days)</label>
              <input
                type="number"
                value={settingsDraft.cookieDurationDays}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, cookieDurationDays: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Return Period Hold (Days)</label>
              <input
                type="number"
                value={settingsDraft.returnPeriodDays}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, returnPeriodDays: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Minimum Withdrawal (INR)</label>
              <input
                type="number"
                value={settingsDraft.minWithdrawalInr}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, minWithdrawalInr: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-600 mb-1">Suggested Default Rate (%)</label>
              <input
                type="number"
                step="0.25"
                value={settingsDraft.defaultCommissionRatePct}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, defaultCommissionRatePct: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
              />
            </div>
          </div>
          <button
            onClick={async () => {
              try {
                await adminUpdateProgramSettings(settingsDraft);
                notify('Affiliate program settings saved.');
                loadAll();
              } catch (err: any) {
                notify(err?.message || 'Failed to update settings', 'error');
              }
            }}
            className="px-5 py-2.5 rounded-lg bg-[#071B35] text-white font-semibold cursor-pointer"
          >
            Save Program Settings
          </button>
        </div>
      )}

      {/* 12. AUDIT LOGS */}
      {tab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-[#071B35]">
            Affiliate Admin &amp; Security Audit Log ({auditLogs.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-y border-slate-200 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="py-2 px-3">Timestamp</th>
                  <th className="py-2 px-3">Actor</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 px-3 font-mono text-[11px]">
                      {new Date(log.createdAt).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px]">
                      {log.actorRole}:{log.actorId}
                    </td>
                    <td className="py-2 px-3 font-semibold text-[#071B35]">{log.action}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                      {log.entityType} {log.entityId ? `(${log.entityId.slice(0, 8)})` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
