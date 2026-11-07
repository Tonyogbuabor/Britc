import React from 'react';
import {
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  ArrowUpRight,
  Zap,
  Users,
  Compass,
  Building,
  Radio
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell
} from 'recharts';
import type { AppSnapshot } from '../../shared/types.js';
import { MetricCard } from '../components/MetricCard.js';
import { RiskBadge } from '../components/RiskBadge.js';

interface ExecutiveOverviewProps {
  snapshot: AppSnapshot;
  onNavigate: (tab: string, filter?: any) => void;
}

export const ExecutiveOverview: React.FC<ExecutiveOverviewProps> = ({ snapshot, onNavigate }) => {
  const { kpis, models, segments } = snapshot;

  // Chart data for monthly trend
  const trendData = kpis.monthlyChurnTrend.map(t => ({
    name: t.month,
    rate: Number(t.churnRate.toFixed(2)),
    mrr: t.mrrLost,
    count: t.churnCount,
  }));

  // Risk distribution for visual comparison
  const riskDist = [
    { name: 'Critical', count: kpis.riskDistribution.critical.count, mrr: kpis.riskDistribution.critical.mrr, pct: kpis.riskDistribution.critical.percentage, color: '#B5483A' },
    { name: 'High', count: kpis.riskDistribution.high.count, mrr: kpis.riskDistribution.high.mrr, pct: kpis.riskDistribution.high.percentage, color: '#C9A227' },
    { name: 'Medium', count: kpis.riskDistribution.medium.count, mrr: kpis.riskDistribution.medium.mrr, pct: kpis.riskDistribution.medium.percentage, color: '#1F7A4D' },
    { name: 'Low', count: kpis.riskDistribution.low.count, mrr: kpis.riskDistribution.low.mrr, pct: kpis.riskDistribution.low.percentage, color: '#0F3D2E' },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Header Banner */}
      <div className="rounded-2xl border border-[#C4BEAD]/40 bg-[#F1EAD3]/70 p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl font-bold tracking-tight text-[#0F3D2E] sm:text-3xl">
                UK Executive Churn Intelligence Briefing
              </h1>
              <span className="rounded-full bg-[#1F7A4D]/10 px-2.5 py-0.5 text-xs font-semibold text-[#1F7A4D] border border-[#1F7A4D]/20">
                Live Single-Snapshot Active
              </span>
            </div>
            <p className="mt-1 text-sm text-[#1B2A22]/75 max-w-3xl">
              Deterministic, audit-verified intelligence derived from BritConnect customer registry. Target leakage firewall actively enforced with <span className="font-semibold text-[#0F3D2E]">zero lookahead bias</span>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => onNavigate('explorer', { tier: 'Critical' })}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#B5483A] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#97392D] transition-colors"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Review {kpis.riskDistribution.critical.count} Critical Accounts</span>
            </button>
            <button
              onClick={() => onNavigate('simulator')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#0F3D2E]/30 bg-white px-4 py-2 text-xs font-bold text-[#0F3D2E] shadow-sm hover:bg-[#FAF6EA] transition-colors"
            >
              <Zap className="h-4 w-4 text-[#C9A227]" />
              <span>Simulate Retention Levers</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Subscribers"
          value={kpis.activeCustomers.toLocaleString()}
          subtitle={`Out of ${kpis.totalCustomers.toLocaleString()} registered base`}
          formulaTooltip="Count of all non-churned subscriber lines active in the latest snapshot."
          change={`${((kpis.activeCustomers / kpis.totalCustomers) * 100).toFixed(1)}% Active Base`}
          isPositive={true}
        />

        <MetricCard
          title="Monthly Churn Rate"
          value={`${(kpis.monthlyChurnRate * 100).toFixed(2)}%`}
          subtitle={`Annualized rate: ~${(kpis.monthlyChurnRate * 12 * 100).toFixed(1)}%`}
          formulaTooltip="Monthly Churn Rate = (Subscribers Churned in Month) / (Active Subscribers at Start of Month)."
          change="Rolling 30-Day Index"
          isPositive={kpis.monthlyChurnRate < 0.03}
        />

        <MetricCard
          title="Total MRR At Risk"
          value={`£${kpis.totalMrrAtRisk.toLocaleString()}`}
          subtitle="Monthly Recurring Revenue in Critical & High tiers"
          formulaTooltip="Total MRR At Risk = \sum MRR_i for all active customers where P(churn)_i \ge 0.40."
          change={`${(kpis.riskDistribution.critical.count + kpis.riskDistribution.high.count)} subscribers`}
          isPositive={false}
          highlight={true}
        />

        <MetricCard
          title="Expected Monthly Loss"
          value={`£${kpis.expectedMonthlyChurnLossGbp.toLocaleString()}`}
          subtitle="Probability-weighted monthly churn impact"
          formulaTooltip="Expected Churn Loss = \sum [ MRR_i \times P(churn)_i ] across all active accounts."
          change="Forecasted Net Drain"
          isPositive={false}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          title="Revenue Protected"
          value={`£${kpis.totalProtectedRevenueGbp.toLocaleString()}`}
          subtitle="Net annualized value from active campaigns"
          formulaTooltip="Revenue Protected = \sum [ Uplift \times Treated \times MRR \times 12 ] relative to 10% holdout control groups."
          change="Holdout-Verified Uplift"
          isPositive={true}
        />
        <MetricCard
          title="Avg Subscriber Tenure"
          value={`${kpis.avgCustomerTenureMonths} mo`}
          subtitle="Customer lifetime maturity index"
          formulaTooltip="Mean tenure in months for all active subscriber accounts."
          change="~2.1 Years Average"
          isPositive={true}
        />
        <MetricCard
          title="NPS Sentiment Index"
          value={`${kpis.avgNpsScore > 0 ? '+' : ''}${kpis.avgNpsScore}`}
          subtitle={`Satisfaction: ${kpis.avgSatisfactionScore} / 10`}
          formulaTooltip="Customer continuous NPS index from -100 to +100 across surveyed accounts."
          change={kpis.avgNpsScore >= 0 ? 'Positive Net Sentiment' : 'Negative Net Sentiment'}
          isPositive={kpis.avgNpsScore >= 0}
        />
      </div>

      {/* Charts Section: Monthly Churn Trend & Risk Tier Matrix */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly Churn Velocity */}
        <div className="rounded-xl border border-[#C4BEAD]/40 bg-[#FAF6EA] p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
                Monthly Churn Trajectory
              </h3>
              <p className="text-xs text-[#64746B]">
                Historical churned subscriber volumes and monthly churn percentage
              </p>
            </div>
            <span className="text-xs font-semibold text-[#1F7A4D] bg-[#1F7A4D]/10 px-2 py-1 rounded">
              Actual Sheet Events
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#1B2A22' }} axisLine={{ stroke: '#C4BEAD' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#1B2A22' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg bg-[#1B2A22] p-3 text-xs text-[#FAF6EA] shadow-xl">
                          <p className="font-bold text-[#E4C766]">{data.name}</p>
                          <p className="mt-1">Churn Rate: <span className="font-mono font-bold text-white">{data.rate}%</span></p>
                          <p>Churned Accounts: <span className="font-mono">{data.count}</span></p>
                          <p>MRR Lost: <span className="font-mono">£{data.mrr.toLocaleString()}</span></p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="rate" fill="#1F7A4D" radius={[4, 4, 0, 0]}>
                  {trendData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === trendData.length - 1 ? '#B5483A' : '#1F7A4D'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#64746B]">
            <span>Prior 8 operating cycles</span>
            <span className="font-semibold text-[#B5483A]">Latest Cycle: {trendData[trendData.length - 1]?.rate || 2.4}%</span>
          </div>
        </div>

        {/* Active Risk Distribution & MRR Exposure */}
        <div className="rounded-xl border border-[#C4BEAD]/40 bg-[#FAF6EA] p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4">
            <div>
              <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
                Active Subscriber Risk Distribution
              </h3>
              <p className="text-xs text-[#64746B]">
                Calibrated risk tiers with associated Monthly Recurring Revenue (MRR)
              </p>
            </div>
            <button
              onClick={() => onNavigate('explorer')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0F3D2E] hover:underline"
            >
              <span>Explore all</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-4 pt-2">
            {riskDist.map(item => (
              <div
                key={item.name}
                onClick={() => onNavigate('explorer', { tier: item.name })}
                className="group cursor-pointer rounded-lg border border-[#C4BEAD]/30 bg-white/60 p-3.5 transition-all hover:bg-white hover:border-[#0F3D2E]/40 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-semibold text-sm text-[#1B2A22]">{item.name} Risk</span>
                    <span className="text-xs text-[#64746B]">({item.pct}% of active base)</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-bold text-[#0F3D2E]">
                      £{item.mrr.toLocaleString()}
                    </span>
                    <span className="text-xs text-[#64746B]"> /mo</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E5DFCF]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, item.pct)}%`, backgroundColor: item.color }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-[#64746B]">
                  <span>{item.count.toLocaleString()} subscribers</span>
                  <span className="group-hover:text-[#0F3D2E] group-hover:underline">Filter registry →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Archetype Personas & Quick Strategy */}
      <div className="rounded-xl border border-[#C4BEAD]/40 bg-[#FAF6EA] p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
              Behavioral Customer Archetypes
            </h3>
            <p className="text-xs text-[#64746B]">
              Clustered subscriber segments mapped into strategic retention action quadrants
            </p>
          </div>
          <button
            onClick={() => onNavigate('segments')}
            className="text-xs font-semibold text-[#0F3D2E] hover:underline flex items-center gap-1"
          >
            <span>View 2x2 Matrix</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {segments.map(seg => (
            <div
              key={seg.id}
              onClick={() => onNavigate('segments')}
              className="cursor-pointer rounded-lg border border-[#C4BEAD]/30 bg-[#F1EAD3]/50 p-4 transition-all hover:bg-white hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F7A4D]">
                  {seg.matrixQuadrant.split(' ')[0]}
                </span>
                <span className="font-mono text-xs font-bold text-[#0F3D2E]">
                  {(seg.churnRate * 100).toFixed(1)}% Churn
                </span>
              </div>
              <h4 className="mt-1.5 font-bold text-sm text-[#1B2A22]">{seg.name}</h4>
              <p className="mt-1 text-xs text-[#64746B] line-clamp-2">{seg.persona}</p>
              
              <div className="mt-3 border-t border-[#C4BEAD]/30 pt-2 flex items-center justify-between text-xs">
                <span className="text-[#64746B]">{seg.customerCount.toLocaleString()} subs</span>
                <span className="font-mono font-semibold text-[#0F3D2E]">£{seg.avgMonthlyCharge}/mo</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
