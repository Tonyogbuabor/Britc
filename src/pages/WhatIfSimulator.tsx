import React, { useState } from 'react';
import { Sliders, Zap, TrendingDown, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import type { AppSnapshot, CustomerSegment } from '../../shared/types.js';

interface WhatIfSimulatorProps {
  snapshot: AppSnapshot;
  onSelectCustomer: (id: string) => void;
}

export const WhatIfSimulator: React.FC<WhatIfSimulatorProps> = ({ snapshot, onSelectCustomer }) => {
  const { segments, activeCustomers } = snapshot;

  // Cohort levers
  const [selectedCohort, setSelectedCohort] = useState<string>('all-rolling');
  const [discountPercent, setDiscountPercent] = useState<number>(15);
  const [contractExtension, setContractExtension] = useState<number>(12);
  const [offerGoodwillCredit, setOfferGoodwillCredit] = useState<boolean>(true);

  // Compute cohort scenario impact
  let targetAccounts = activeCustomers;
  if (selectedCohort === 'all-rolling') {
    targetAccounts = activeCustomers.filter(c => c.contractType === 'Rolling Monthly');
  } else if (selectedCohort === 'high-risk') {
    targetAccounts = activeCustomers.filter(c => c.riskTier === 'Critical' || c.riskTier === 'High');
  } else if (selectedCohort === 'competitor') {
    targetAccounts = activeCustomers.filter(c => c.competitorOfferReceived);
  }

  const count = targetAccounts.length;
  const currentAvgMrr = count > 0 ? targetAccounts.reduce((acc, c) => acc + c.monthlyChargeGbp, 0) / count : 40;
  const currentAvgRisk = count > 0 ? targetAccounts.reduce((acc, c) => acc + (c.churnProbability || 0), 0) / count : 0.45;

  // Modeling impact of policy
  let riskReduction = 0;
  if (contractExtension === 12) riskReduction += 0.16;
  if (contractExtension === 24) riskReduction += 0.24;
  riskReduction += (discountPercent / 100) * 0.4;
  if (offerGoodwillCredit) riskReduction += 0.05;

  const simulatedAvgRisk = Math.max(0.05, currentAvgRisk - riskReduction);
  const churnersPrevented = Math.round(count * (currentAvgRisk - simulatedAvgRisk));
  const annualRevenueSaved = churnersPrevented * currentAvgMrr * 12;
  const annualDiscountCost = count * (currentAvgMrr * (discountPercent / 100)) * Math.min(12, contractExtension);
  const oneOffCost = offerGoodwillCredit ? count * 15 : 0;
  const totalCampaignCost = annualDiscountCost + oneOffCost;
  const netBenefit = annualRevenueSaved - totalCampaignCost;
  const roi = totalCampaignCost > 0 ? Number((annualRevenueSaved / totalCampaignCost).toFixed(2)) : 0;

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="rounded-xl border border-[#C4BEAD]/40 bg-[#FAF6EA] p-6 shadow-sm">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-[#0F3D2E]">
          Macro Policy & Retention What-If Simulator
        </h1>
        <p className="mt-1 text-xs text-[#64746B] max-w-3xl">
          Simulate strategic commercial interventions across customer cohorts. Quantify risk reduction, discount expenditure, and net retained annual revenue before committing capital.
        </p>
      </div>

      {/* Simulator Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Levers */}
        <div className="rounded-xl border border-[#C4BEAD]/40 bg-white p-6 shadow-sm space-y-5 lg:col-span-1">
          <div className="flex items-center gap-2 pb-3 border-b border-[#C4BEAD]/30">
            <Sliders className="h-5 w-5 text-[#0F3D2E]" />
            <h3 className="font-serif text-base font-bold text-[#0F3D2E]">
              Policy Intervention Levers
            </h3>
          </div>

          <div>
            <label className="text-xs font-bold text-[#1B2A22]">Target Cohort Population</label>
            <select
              value={selectedCohort}
              onChange={e => setSelectedCohort(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[#C4BEAD]/60 bg-white p-2 text-xs font-medium text-[#1B2A22] focus:border-[#0F3D2E] focus:outline-none"
            >
              <option value="all-rolling">All Rolling Monthly Subscribers ({activeCustomers.filter(c => c.contractType === 'Rolling Monthly').length.toLocaleString()})</option>
              <option value="high-risk">Critical & High Risk Subscribers ({activeCustomers.filter(c => c.riskTier === 'Critical' || c.riskTier === 'High').length.toLocaleString()})</option>
              <option value="competitor">Active Competitor Comparing ({activeCustomers.filter(c => c.competitorOfferReceived).length.toLocaleString()})</option>
              <option value="all">Entire Active Subscriber Base ({activeCustomers.length.toLocaleString()})</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-bold text-[#1B2A22]">
              <span>Monthly Loyalty Discount</span>
              <span className="font-mono text-[#0F3D2E]">{discountPercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="5"
              value={discountPercent}
              onChange={e => setDiscountPercent(Number(e.target.value))}
              className="mt-2 w-full accent-[#0F3D2E]"
            />
            <div className="flex justify-between text-[10px] text-[#64746B] mt-0.5">
              <span>0% (No discount)</span>
              <span>15% (Recommended)</span>
              <span>30% (Aggressive)</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#1B2A22]">Mandatory Contract Extension</label>
            <select
              value={contractExtension}
              onChange={e => setContractExtension(Number(e.target.value))}
              className="mt-1.5 w-full rounded-lg border border-[#C4BEAD]/60 bg-white p-2 text-xs font-medium text-[#1B2A22] focus:border-[#0F3D2E] focus:outline-none"
            >
              <option value={12}>12 Months Re-commitment (Standard Lock-in)</option>
              <option value={24}>24 Months Re-commitment (Maximum Stability)</option>
              <option value={0}>No Contract Lock-in (Discount Only)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-[#C4BEAD]/30">
            <input
              type="checkbox"
              id="chk-credit"
              checked={offerGoodwillCredit}
              onChange={e => setOfferGoodwillCredit(e.target.checked)}
              className="rounded accent-[#0F3D2E]"
            />
            <label htmlFor="chk-credit" className="text-xs text-[#1B2A22]">
              Include £15 Account Credit / Priority Router
            </label>
          </div>
        </div>

        {/* Right Column: Projected Economic Outcomes */}
        <div className="space-y-6 lg:col-span-2">
          {/* Headline Outcomes */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#C4BEAD]/40 bg-[#FAF6EA] p-4 text-center">
              <span className="text-[10px] font-bold uppercase text-[#64746B]">Subscribers Targeted</span>
              <div className="font-mono text-2xl font-bold text-[#0F3D2E] mt-1">{count.toLocaleString()}</div>
              <p className="text-[10px] text-[#64746B] mt-0.5">Eligible in cohort</p>
            </div>

            <div className="rounded-xl border border-[#1F7A4D]/30 bg-[#1F7A4D]/10 p-4 text-center">
              <span className="text-[10px] font-bold uppercase text-[#1F7A4D]">Forecast Churn Reduction</span>
              <div className="font-mono text-2xl font-bold text-[#1F7A4D] mt-1">
                {(currentAvgRisk * 100).toFixed(0)}% → {(simulatedAvgRisk * 100).toFixed(0)}%
              </div>
              <p className="text-[10px] text-[#1F7A4D] mt-0.5">{churnersPrevented.toLocaleString()} churners saved</p>
            </div>

            <div className="rounded-xl border border-[#0F3D2E] bg-[#0F3D2E] p-4 text-center text-white">
              <span className="text-[10px] font-bold uppercase text-[#A8C3A0]">Net Return on Investment</span>
              <div className="font-mono text-2xl font-bold text-[#E4C766] mt-1">{roi}x ROI</div>
              <p className="text-[10px] text-white/70 mt-0.5">£{Math.round(netBenefit).toLocaleString()} net profit</p>
            </div>
          </div>

          {/* Financial Breakdown Table */}
          <div className="rounded-xl border border-[#C4BEAD]/40 bg-white p-6 shadow-sm">
            <h4 className="font-serif text-base font-bold text-[#0F3D2E] mb-3">
              Projected Commercial Balance Sheet
            </h4>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-[#C4BEAD]/20 pb-2">
                <span className="text-[#64746B]">Gross Annual Revenue Protected:</span>
                <span className="font-mono font-bold text-[#1F7A4D]">+£{Math.round(annualRevenueSaved).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between border-b border-[#C4BEAD]/20 pb-2">
                <span className="text-[#64746B]">Annual Discount Subsidy Cost:</span>
                <span className="font-mono font-bold text-[#B5483A]">-£{Math.round(annualDiscountCost).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between border-b border-[#C4BEAD]/20 pb-2">
                <span className="text-[#64746B]">Goodwill Credits / One-Off Equipment:</span>
                <span className="font-mono font-bold text-[#B5483A]">-£{Math.round(oneOffCost).toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between border-t border-[#0F3D2E]/20 pt-2 font-bold text-sm">
                <span className="text-[#0F3D2E]">Net Retained Annual Value:</span>
                <span className="font-mono text-[#0F3D2E]">£{Math.round(netBenefit).toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-[#FAF6EA] p-3.5 border border-[#C4BEAD]/30 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-[#1F7A4D] shrink-0 mt-0.5" />
              <p className="text-xs text-[#1B2A22] leading-relaxed">
                <span className="font-bold">Executive Decision: </span>
                {netBenefit > 0
                  ? `This intervention yields an estimated £${roi.toFixed(1)} of retained customer revenue per £1 invested. Highly viable for immediate campaign deployment.`
                  : `Intervention cost exceeds direct expected churn loss for this cohort. Recommend narrowing the targeting or lowering discount subsidy.`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
