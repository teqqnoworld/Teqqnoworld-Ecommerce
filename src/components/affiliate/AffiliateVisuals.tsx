import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronDown, Wallet, CreditCard, TrendingUp } from 'lucide-react';
import type {
  AffiliateAnalyticsRange,
  AffiliateAnalyticsSeriesPoint,
  AffiliateCommissionRecord,
} from '../../types/affiliate';
import { formatInrPaisa } from '../../services/affiliateService';

export type AffiliateKpiTheme = 'orange' | 'blue' | 'green' | 'violet';

const KPI_THEMES: Record<
  AffiliateKpiTheme,
  {
    cardBg: string;
    iconBg: string;
    iconText: string;
    stroke: string;
    badgeBg: string;
  }
> = {
  orange: {
    cardBg: 'bg-gradient-to-br from-[#FFF9F3] via-white to-[#FFF3E6] border-orange-200/80',
    iconBg: 'bg-[#FF7900]/12 border-orange-200/80',
    iconText: 'text-[#FF7900]',
    stroke: '#FF7900',
    badgeBg: 'text-orange-700 bg-orange-50 border-orange-200/80',
  },
  blue: {
    cardBg: 'bg-gradient-to-br from-[#F4F8FF] via-white to-[#EDF4FF] border-blue-200/80',
    iconBg: 'bg-blue-500/12 border-blue-200/80',
    iconText: 'text-blue-600',
    stroke: '#2563EB',
    badgeBg: 'text-blue-700 bg-blue-50 border-blue-200/80',
  },
  green: {
    cardBg: 'bg-gradient-to-br from-[#F3FBF7] via-white to-[#EAF9F0] border-emerald-200/80',
    iconBg: 'bg-emerald-500/12 border-emerald-200/80',
    iconText: 'text-emerald-600',
    stroke: '#10B981',
    badgeBg: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
  },
  violet: {
    cardBg: 'bg-gradient-to-br from-[#F9F5FF] via-white to-[#F2EBFF] border-violet-200/80',
    iconBg: 'bg-violet-500/12 border-violet-200/80',
    iconText: 'text-violet-600',
    stroke: '#8B5CF6',
    badgeBg: 'text-violet-700 bg-violet-50 border-violet-200/80',
  },
};

/**
 * Smooth animated INR or integer counter honoring prefers-reduced-motion.
 */
export const AnimatedInrCounter: React.FC<{
  paisa: number;
  durationMs?: number;
}> = ({ paisa, durationMs = 520 }) => {
  const [displayPaisa, setDisplayPaisa] = useState<number>(paisa);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setDisplayPaisa(paisa);
      return;
    }
    const reduced =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || durationMs <= 0) {
      setDisplayPaisa(paisa);
      return;
    }
    let rafId = 0;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayPaisa(Math.round(paisa * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [paisa, durationMs]);

  return <span className="tabular-nums">{formatInrPaisa(displayPaisa)}</span>;
};

/**
 * Animated SVG Sparkline matching TeqqnoWorld Customer & Admin dashboard KPI cards.
 */
export const AffiliateSparkline: React.FC<{
  points: number[];
  strokeColor: string;
  id: string;
}> = ({ points, strokeColor, id }) => {
  const hasData = points.length >= 2 && points.some((p) => p > 0);
  const safePoints = hasData ? points : [12, 18, 15, 24, 21, 32];

  const width = 92;
  const height = 34;
  const max = Math.max(...safePoints, 1);
  const min = Math.min(...safePoints, 0);
  const span = Math.max(max - min, 1);

  const coords = safePoints.map((val, idx) => {
    const x = (idx / (safePoints.length - 1)) * (width - 8) + 4;
    const y = height - 5 - ((val - min) / span) * (height - 12);
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
  });

  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cx = Number(((prev.x + curr.x) / 2).toFixed(1));
    const cy = Number(((prev.y + curr.y) / 2).toFixed(1));
    pathD += ` Q ${prev.x} ${prev.y}, ${cx} ${cy}`;
    if (i === coords.length - 1) {
      pathD += ` T ${curr.x} ${curr.y}`;
    }
  }
  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id={`aff-spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.26" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={areaD}
        fill={`url(#aff-spark-${id})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.55, delay: 0.15 }}
      />
      <motion.path
        d={pathD}
        stroke={strokeColor}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
};

/**
 * Pastel-bordered KPI Stat Card matching Customer & Executive Admin Dashboards.
 */
export const AffiliateKpiCard: React.FC<{
  id: string;
  index: number;
  title: string;
  paisaValue?: number;
  customValueText?: string;
  subtitle: string;
  badgeText?: string;
  theme: AffiliateKpiTheme;
  icon: React.ReactNode;
  sparkPoints: number[];
  onClick?: () => void;
}> = ({
  id,
  index,
  title,
  paisaValue,
  customValueText,
  subtitle,
  badgeText,
  theme,
  icon,
  sparkPoints,
  onClick,
}) => {
  const palette = KPI_THEMES[theme];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      className={`text-left rounded-2xl border p-4 sm:p-5 transition-shadow duration-200 hover:shadow-lg hover:shadow-[#FF7900]/10 hover:border-[#FF7900]/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF7900] cursor-pointer group ${palette.cardBg}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${palette.iconBg} ${palette.iconText}`}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-600 truncate">{title}</div>
            <div className="text-xl sm:text-[24px] font-bold text-[#0B1530] leading-tight mt-0.5 font-display tabular-nums">
              {typeof paisaValue === 'number' ? (
                <AnimatedInrCounter paisa={paisaValue} />
              ) : (
                customValueText
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {badgeText && (
            <span
              className={`inline-flex items-center text-[10px] font-semibold border px-1.5 py-0.5 rounded-md mr-1.5 ${palette.badgeBg}`}
            >
              {badgeText}
            </span>
          )}
          <span className="text-[11px] text-slate-500 font-medium leading-tight block truncate mt-0.5">
            {subtitle}
          </span>
        </div>
        <AffiliateSparkline id={id} points={sparkPoints} strokeColor={palette.stroke} />
      </div>
    </motion.button>
  );
};

/**
 * Interactive Glowing Orange Bezier Area Chart + 3-Stat Strip (Customer + Admin Dashboard DNA).
 */
export const AffiliateEarningsAreaChart: React.FC<{
  series: AffiliateAnalyticsSeriesPoint[];
  range: AffiliateAnalyticsRange;
  onChangeRange: (next: AffiliateAnalyticsRange) => void;
  totalClicks: number;
  totalReferredSalesPaisa: number;
  referredOrders: number;
  onOpenAnalytics: () => void;
}> = ({
  series,
  range,
  onChangeRange,
  totalClicks,
  totalReferredSalesPaisa,
  referredOrders,
  onOpenAnalytics,
}) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const periodCommissionPaisa = useMemo(
    () => series.reduce((sum, pt) => sum + pt.commissionPaisa, 0),
    [series]
  );
  const periodOrders = useMemo(
    () => series.reduce((sum, pt) => sum + pt.orders, 0),
    [series]
  );

  const growthLabel = useMemo(() => {
    if (series.length < 2) return null;
    const mid = Math.floor(series.length / 2);
    const firstHalf = series.slice(0, mid).reduce((s, p) => s + p.commissionPaisa, 0);
    const secondHalf = series.slice(mid).reduce((s, p) => s + p.commissionPaisa, 0);
    if (firstHalf === 0 && secondHalf === 0) return null;
    if (firstHalf === 0) return '+100%';
    const pct = Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
    return `${pct >= 0 ? '+' : ''}${pct}%`;
  }, [series]);

  const width = 580;
  const height = 172;
  const padX = 22;
  const padTop = 30;
  const padBottom = 24;

  const coords = useMemo(() => {
    const safeSeries =
      series.length > 0
        ? series
        : [{ label: 'Today', clicks: 0, orders: 0, salesPaisa: 0, commissionPaisa: 0 }];
    const maxVal = Math.max(...safeSeries.map((s) => s.commissionPaisa), 10000);
    return safeSeries.map((pt, idx) => {
      const x =
        safeSeries.length === 1
          ? width / 2
          : padX + (idx / (safeSeries.length - 1)) * (width - padX * 2);
      const ratio = pt.commissionPaisa / maxVal;
      const y = height - padBottom - ratio * (height - padTop - padBottom);
      return {
        ...pt,
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
      };
    });
  }, [series]);

  const { linePath, areaPath } = useMemo(() => {
    if (coords.length === 0) return { linePath: '', areaPath: '' };
    if (coords.length === 1) {
      const p = coords[0];
      return {
        linePath: `M ${padX} ${p.y} L ${width - padX} ${p.y}`,
        areaPath: `M ${padX} ${p.y} L ${width - padX} ${p.y} L ${width - padX} ${height - padBottom} L ${padX} ${height - padBottom} Z`,
      };
    }

    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const midX = Number(((curr.x + next.x) / 2).toFixed(1));
      d += ` C ${midX} ${curr.y}, ${midX} ${next.y}, ${next.x} ${next.y}`;
    }

    const last = coords[coords.length - 1];
    const first = coords[0];
    const area = `${d} L ${last.x} ${height - padBottom} L ${first.x} ${height - padBottom} Z`;
    return { linePath: d, areaPath: area };
  }, [coords]);

  const defaultFocusIdx = useMemo(() => {
    if (coords.length === 0) return 0;
    let bestIdx = coords.length - 1;
    let bestVal = -1;
    coords.forEach((pt, idx) => {
      if (pt.commissionPaisa >= bestVal && pt.commissionPaisa > 0) {
        bestVal = pt.commissionPaisa;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }, [coords]);

  const activeIdx = hoverIdx !== null ? hoverIdx : defaultFocusIdx;
  const activePoint = coords[activeIdx];
  const avgOrderPaisa = referredOrders > 0 ? Math.round(totalReferredSalesPaisa / referredOrders) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between h-full"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/70 text-[#FF7900] flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0B1530] font-display leading-tight">
              Commission &amp; Referral Overview
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Interactive earnings &amp; conversion curve across your links
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              aria-label="Affiliate chart timeframe"
              value={range}
              onChange={(e) => onChangeRange(e.target.value as AffiliateAnalyticsRange)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 pl-3 pr-8 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FF7900]"
            >
              <option value="live">Live (Today)</option>
              <option value="daily">Last 7 Days</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Last 6 Months</option>
              <option value="yearly">Yearly</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-500 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
          <button
            type="button"
            onClick={onOpenAnalytics}
            className="hidden sm:inline-flex items-center text-xs font-semibold text-[#FF7900] hover:underline px-2 py-1 cursor-pointer"
          >
            Full Analytics ↗
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
        <span className="text-2xl sm:text-[26px] font-bold text-[#0B1530] font-display tabular-nums">
          <AnimatedInrCounter paisa={periodCommissionPaisa} />
        </span>
        {growthLabel && (
          <span
            className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md ${
              growthLabel.startsWith('-')
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {growthLabel}
          </span>
        )}
        <span className="text-xs text-slate-400 font-medium tabular-nums">
          ({periodOrders} {periodOrders === 1 ? 'referred order' : 'referred orders'} in period)
        </span>
      </div>

      <div className="relative mt-2 w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-40 sm:h-44 overflow-visible select-none"
          role="img"
          aria-label="Affiliate commission performance curve"
        >
          <defs>
            <linearGradient id="aff-earnings-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF7900" stopOpacity="0.32" />
              <stop offset="85%" stopColor="#FF7900" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#FF7900" stopOpacity="0" />
            </linearGradient>
          </defs>

          {[0.25, 0.55, 0.85].map((r) => (
            <line
              key={r}
              x1={padX}
              x2={width - padX}
              y1={padTop + (height - padTop - padBottom) * r}
              y2={padTop + (height - padTop - padBottom) * r}
              stroke="#E2E8F0"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          ))}

          <motion.path
            key={`area-${range}-${periodCommissionPaisa}`}
            d={areaPath}
            fill="url(#aff-earnings-area-grad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45 }}
          />

          {activePoint && (
            <line
              x1={activePoint.x}
              x2={activePoint.x}
              y1={activePoint.y}
              y2={height - padBottom}
              stroke="#0B1530"
              strokeOpacity="0.22"
              strokeDasharray="3 3"
              strokeWidth="1.2"
            />
          )}

          <motion.path
            key={`line-${range}-${periodCommissionPaisa}`}
            d={linePath}
            fill="none"
            stroke="#FF7900"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />

          {coords.map((pt, idx) => {
            const isActive = idx === activeIdx;
            return (
              <g
                key={`${pt.label}-${idx}`}
                className="cursor-pointer"
                onMouseEnter={() => setHoverIdx(idx)}
                onMouseLeave={() => setHoverIdx(null)}
                onClick={() => setHoverIdx(idx)}
              >
                <circle cx={pt.x} cy={pt.y} r="16" fill="transparent" />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isActive ? 5.5 : 3.4}
                  fill={isActive ? '#FF7900' : '#FFFFFF'}
                  stroke="#FF7900"
                  strokeWidth={isActive ? 3 : 2}
                  className="transition-all duration-150"
                />
                <text
                  x={pt.x}
                  y={height - 5}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px] font-medium"
                >
                  {pt.label}
                </text>
              </g>
            );
          })}
        </svg>

        {activePoint && (
          <motion.div
            key={`${activePoint.label}-${activeIdx}`}
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.16 }}
            className="pointer-events-none absolute -top-1 -translate-x-1/2 bg-[#0B1530] text-white rounded-xl px-3 py-1.5 shadow-lg border border-white/10 text-center z-10"
            style={{
              left: `${Math.min(84, Math.max(16, (activePoint.x / width) * 100))}%`,
            }}
          >
            <div className="text-[11px] font-bold leading-tight tabular-nums whitespace-nowrap">
              {activePoint.orders} {activePoint.orders === 1 ? 'Order' : 'Orders'} • {activePoint.label}
            </div>
            <div className="text-[11px] font-semibold text-[#FF7900] tabular-nums">
              {formatInrPaisa(activePoint.commissionPaisa)} ({activePoint.clicks} clicks)
            </div>
          </motion.div>
        )}
      </div>

      {/* Bottom 3-stat strip matching Executive Admin Dashboard screenshot */}
      <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-slate-50/90 border border-slate-200/60 px-3 py-2.5">
          <div className="text-[11px] text-slate-500 font-medium">Avg. Order Value</div>
          <div className="text-sm font-bold text-[#0B1530] font-mono tabular-nums mt-0.5">
            {formatInrPaisa(avgOrderPaisa)}
          </div>
        </div>
        <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/60 px-3 py-2.5">
          <div className="text-[11px] text-slate-500 font-medium">Referred Sales</div>
          <div className="text-sm font-bold text-emerald-700 font-mono tabular-nums mt-0.5">
            {formatInrPaisa(totalReferredSalesPaisa)}
          </div>
        </div>
        <div className="rounded-xl bg-orange-50/60 border border-orange-200/60 px-3 py-2.5">
          <div className="text-[11px] text-slate-500 font-medium">Total Link Clicks</div>
          <div className="text-sm font-bold text-[#FF7900] font-mono tabular-nums mt-0.5">
            {totalClicks.toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/**
 * Animated SVG Donut Ring + Pipeline Bars + Dual CTA Buttons (Customer + Admin DNA).
 */
export const AffiliateCommissionDonutCard: React.FC<{
  commissions: AffiliateCommissionRecord[];
  onWithdraw: () => void;
  onOpenWallet: () => void;
}> = ({ commissions, onWithdraw, onOpenWallet }) => {
  const counts = useMemo(() => {
    const pending = commissions.filter((c) => c.status === 'pending' || c.status === 'on_hold').length;
    const available = commissions.filter((c) => c.status === 'available').length;
    const paid = commissions.filter((c) => c.status === 'paid').length;
    const cancelled = commissions.filter((c) => c.status === 'cancelled' || c.status === 'under_review').length;
    const total = commissions.length;
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      total,
      segments: [
        { key: 'pending', label: 'Pending / Hold', count: pending, pct: pct(pending), color: '#FF7900', dot: 'bg-[#FF7900]', bar: 'bg-[#FF7900]' },
        { key: 'available', label: 'Available Now', count: available, pct: pct(available), color: '#10B981', dot: 'bg-emerald-500', bar: 'bg-emerald-500' },
        { key: 'paid', label: 'Paid to Bank', count: paid, pct: pct(paid), color: '#2563EB', dot: 'bg-blue-600', bar: 'bg-blue-600' },
        { key: 'cancelled', label: 'Cancelled / Review', count: cancelled, pct: pct(cancelled), color: '#8B5CF6', dot: 'bg-violet-500', bar: 'bg-violet-500' },
      ],
    };
  }, [commissions]);

  const size = 136;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulative = 0;
  const arcs = counts.segments
    .filter((s) => s.count > 0)
    .map((seg) => {
      const length = counts.total > 0 ? (seg.count / counts.total) * circumference : 0;
      const offset = circumference - cumulative;
      cumulative += length;
      return {
        ...seg,
        dashArray: `${Math.max(0, length)} ${circumference}`,
        dashOffset: offset,
      };
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between h-full"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200/70 text-[#FF7900] flex items-center justify-center shrink-0">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0B1530] font-display leading-tight">
              Commission Pipeline
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">Live Payout Status</p>
          </div>
        </div>
      </div>

      <div className="my-4 flex flex-col items-center gap-4">
        <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90"
            role="img"
            aria-label="Commission status donut chart"
          >
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#EEF2F6"
              strokeWidth={strokeWidth}
            />
            {arcs.map((arc, idx) => (
              <motion.circle
                key={arc.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeLinecap={arcs.length === 1 ? 'butt' : 'round'}
                strokeDasharray={arc.dashArray}
                strokeDashoffset={arc.dashOffset}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.1 + idx * 0.08 }}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-2xl font-bold text-[#0B1530] font-display tabular-nums leading-none">
              {counts.total}
            </span>
            <span className="text-[10px] font-medium text-slate-500 mt-1">Commissions</span>
          </div>
        </div>

        <div className="w-full space-y-2.5">
          {counts.segments.map((seg) => (
            <div key={seg.key} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${seg.dot}`} />
                  <span className="font-medium text-slate-700 truncate">{seg.label}</span>
                </div>
                <span className="font-bold text-[#0B1530] tabular-nums shrink-0">
                  {seg.count}{' '}
                  <span className="font-medium text-slate-400">({seg.pct}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${seg.pct}%` }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className={`h-full rounded-full ${seg.bar}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dual CTA Buttons matching Executive Admin Dashboard screenshot */}
      <div className="grid grid-cols-2 gap-2.5 pt-2">
        <button
          type="button"
          onClick={onWithdraw}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#FF7900] hover:bg-[#e56d00] text-white text-xs font-semibold shadow-sm shadow-[#FF7900]/25 transition-colors cursor-pointer"
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Withdraw</span>
        </button>
        <button
          type="button"
          onClick={onOpenWallet}
          className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0B1530] hover:bg-[#13254f] text-white text-xs font-semibold transition-colors cursor-pointer"
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Wallet Hub</span>
        </button>
      </div>
    </motion.div>
  );
};
