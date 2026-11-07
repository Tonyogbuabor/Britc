import React, { useState, useEffect } from 'react';
import {
  User,
  ShieldAlert,
  Sparkles,
  Sliders,
  FileDown,
  Copy,
  Check,
  CheckCircle2,
  TrendingDown,
  ArrowRight,
  PhoneCall,
  Calendar,
  CreditCard,
  Wifi,
  AlertCircle
} from 'lucide-react';
import jsPDF from 'jspdf';
import type { AppSnapshot, CustomerRecord, RetentionPlanAI, WhatIfSimulationResult } from '../../shared/types.js';
import { generateRetentionPlan, simulateWhatIf } from '../lib/api.js';
import { RiskBadge } from '../components/RiskBadge.js';

interface Customer360Props {
  snapshot: AppSnapshot;
  selectedCustomerId?: string;
  onSelectCustomer: (id: string) => void;
}

export const Customer360: React.FC<Customer360Props> = ({
  snapshot,
  selectedCustomerId,
  onSelectCustomer,
}) => {
  // Pick selected customer or first Critical risk customer
  const defaultCustomer = snapshot.activeCustomers.find(c => c.riskTier === 'Critical') || snapshot.activeCustomers[0];
  const activeId = selectedCustomerId || defaultCustomer?.customerId || '';
  const customer = snapshot.customers.find(c => c.customerId === activeId) || defaultCustomer;

  const [aiPlan, setAiPlan] = useState<RetentionPlanAI | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // What-If levers state
  const [discountPercent, setDiscountPercent] = useState<number>(customer?.discountPercent || 0);
  const [contractType, setContractType] = useState<CustomerRecord['contractType']>(customer?.contractType || '12 Months');
  const [directDebit, setDirectDebit] = useState<boolean>(customer?.directDebit ?? true);
  const [resolveComplaints, setResolveComplaints] = useState<boolean>(false);
  const [neutralizeCompetitor, setNeutralizeCompetitor] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<WhatIfSimulationResult | null>(null);

  // Reset controls when customer changes
  useEffect(() => {
    if (customer) {
      setDiscountPercent(customer.discountPercent || 0);
      setContractType(customer.contractType);
      setDirectDebit(customer.directDebit);
      setResolveComplaints(false);
      setNeutralizeCompetitor(false);
      setAiPlan(null);
      setSimResult(null);
    }
  }, [customer?.customerId]);

  if (!customer) {
    return (
      <div className="p-8 text-center text-[#64746B]">
        No customer account available.
      </div>
    );
  }

  const handleGenerateAIPlan = async () => {
    setLoadingAi(true);
    try {
      const plan = await generateRetentionPlan(customer.customerId);
      setAiPlan(plan);
    } catch (err) {
      console.error('Failed to generate AI plan:', err);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleRunSimulation = async () => {
    try {
      const result = await simulateWhatIf(customer.customerId, {
        discountPercent,
        contractType,
        directDebit,
        resolveComplaints,
        neutralizeCompetitorOffer: neutralizeCompetitor,
      });
      setSimResult(result);
    } catch (err) {
      console.error('Simulation error:', err);
    }
  };

  const handleCopyScript = () => {
    if (!aiPlan) return;
    const text = `Customer Retention Script: ${customer.customerId}\nTarget: ${aiPlan.recommendedOffer.title}\nChannel: ${aiPlan.communicationChannel}\n\nTalking Points:\n${aiPlan.scriptTalkingPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(15, 61, 46); // Forest
    doc.text('BritConnect Retention Intelligence Brief', 20, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 107);
    doc.text(`CONFIDENTIAL • CUSTOMER DOSSIER: ${customer.customerId} • DATE: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.line(20, 33, 190, 33);

    doc.setFontSize(12);
    doc.setTextColor(27, 42, 34);
    doc.text(`Subscriber Profile`, 20, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Segment: ${customer.customerSegment} | Service: ${customer.serviceType} (${customer.planName})`, 20, 50);
    doc.text(`Contract: ${customer.contractType} | Monthly Spend: £${customer.monthlyChargeGbp.toFixed(2)}`, 20, 56);
    doc.text(`Tenure: ${customer.tenureMonths} Months | Location: ${customer.city}, ${customer.ukNation}`, 20, 62);
    doc.text(`Calibrated Churn Risk: ${((customer.churnProbability || 0) * 100).toFixed(1)}% (${customer.riskTier} Tier)`, 20, 68);

    doc.line(20, 74, 190, 74);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Key Risk Drivers (SHAP Attribution)', 20, 83);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    let y = 91;
    (customer.topDrivers || []).forEach(d => {
      doc.text(`• ${d.featureName}: ${d.valStr} (pushes risk ${d.direction} by ${Math.abs(d.contribution * 100).toFixed(1)}%)`, 24, y);
      y += 6;
    });

    if (aiPlan) {
      y += 4;
      doc.line(20, y, 190, y);
      y += 8;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(`Recommended Retention Strategy: ${aiPlan.recommendedOffer.title}`, 20, y);
      y += 7;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(`Channel: ${aiPlan.communicationChannel} | Urgency: ${aiPlan.urgency} | Discount: £${aiPlan.recommendedOffer.monthlyDiscountGbp}/mo`, 20, y);
      y += 6;
      doc.text(`Rationale: ${aiPlan.recommendedOffer.rationale}`, 20, y);
      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.text('Retention Agent Script Points:', 20, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      aiPlan.scriptTalkingPoints.forEach(p => {
        const splitText = doc.splitTextToSize(`- ${p}`, 165);
        doc.text(splitText, 24, y);
        y += splitText.length * 5;
      });
    }

    doc.save(`BritConnect-Retention-Brief-${customer.customerId}.pdf`);
  };

  const prob = customer.churnProbability || (customer.churnFlag === 1 ? 1.0 : 0.05);

  return (
    <div className="space-y-6">
      {/* Top Customer Selector Bar */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#C4BEAD]/40 bg-[#FAF6EA] p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F3D2E] text-white">
            <User className="h-5 w-5 text-[#E4C766]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-lg font-bold text-[#0F3D2E]">
                {customer.customerId}
              </span>
              <RiskBadge tier={customer.riskTier} size="md" />
              <span className="text-xs text-[#64746B]">({customer.customerSegment})</span>
            </div>
            <p className="text-xs text-[#64746B]">
              {customer.city}, {customer.ukNation} • Enrolled {customer.joinDate} • {customer.tenureMonths} mo tenure
            </p>
          </div>
        </div>

        {/* Quick customer switcher */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#64746B]">Switch Account:</span>
          <select
            value={customer.customerId}
            onChange={e => onSelectCustomer(e.target.value)}
            className="rounded-lg border border-[#C4BEAD]/60 bg-white px-3 py-1.5 font-mono text-xs text-[#1B2A22] focus:border-[#0F3D2E] focus:outline-none"
          >
            {snapshot.activeCustomers.slice(0, 50).map(c => (
              <option key={c.customerId} value={c.customerId}>
                {c.customerId} - {c.riskTier} ({((c.churnProbability || 0) * 100).toFixed(0)}%) - £{c.monthlyChargeGbp}/mo
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 2-Column Dossier */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Churn Risk Gauge & Account Vital Signs */}
        <div className="space-y-6 lg:col-span-1">
          {/* Risk Gauge Card */}
          <div className="rounded-xl border border-[#C4BEAD]/40 bg-white p-6 shadow-sm text-center">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64746B]">
              Calibrated Churn Probability
            </span>

            <div className="my-4 flex flex-col items-center justify-center">
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-8 border-[#FAF6EA]">
                <div
                  className={`absolute inset-0 rounded-full border-8 ${
                    prob >= 0.65 ? 'border-[#B5483A]' : prob >= 0.40 ? 'border-[#C9A227]' : prob >= 0.20 ? 'border-[#1F7A4D]' : 'border-[#0F3D2E]'
                  }`}
                  style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%)` }}
                />
                <div className="text-center">
                  <span className="font-mono text-3xl font-extrabold text-[#0F3D2E]">
                    {(prob * 100).toFixed(1)}%
                  </span>
                  <div className="text-[10px] font-semibold text-[#64746B]">P(Churn)</div>
                </div>
              </div>
              <div className="mt-2">
                <RiskBadge tier={customer.riskTier} size="lg" />
              </div>
            </div>

            <p className="text-xs text-[#64746B] leading-relaxed">
              Model confidence: High. Calibrated via Platt scaling across 5-fold cross validation.
            </p>
          </div>

          {/* Account Metrics Grid */}
          <div className="rounded-xl border border-[#C4BEAD]/40 bg-[#FAF6EA] p-5 shadow-sm space-y-3.5">
            <h4 className="font-serif text-sm font-bold text-[#0F3D2E]">Commercial Snapshot</h4>
            
            <div className="flex items-center justify-between border-b border-[#C4BEAD]/20 pb-2 text-xs">
              <span className="text-[#64746B]">Monthly Recurring Revenue</span>
              <span className="font-mono font-bold text-[#0F3D2E]">£{customer.monthlyChargeGbp.toFixed(2)}/mo</span>
            </div>

            <div className="flex items-center justify-between border-b border-[#C4BEAD]/20 pb-2 text-xs">
              <span className="text-[#64746B]">Service & Plan</span>
              <span className="font-medium text-[#1B2A22]">{customer.serviceType}</span>
            </div>

            <div className="flex items-center justify-between border-b border-[#C4BEAD]/20 pb-2 text-xs">
              <span className="text-[#64746B]">Contract Commitment</span>
              <span className={`font-semibold ${customer.contractType === 'Rolling Monthly' ? 'text-[#B5483A]' : 'text-[#0F3D2E]'}`}>
                {customer.contractType}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#C4BEAD]/20 pb-2 text-xs">
              <span className="text-[#64746B]">Direct Debit Guarantee</span>
              <span className="font-medium text-[#1B2A22]">{customer.directDebit ? 'Active' : 'Manual / None'}</span>
            </div>

            <div className="flex items-center justify-between border-b border-[#C4BEAD]/20 pb-2 text-xs">
              <span className="text-[#64746B]">Customer NPS Sentiment</span>
              <span className={`font-mono font-bold ${customer.npsScore < 0 ? 'text-[#B5483A]' : 'text-[#1F7A4D]'}`}>
                {customer.npsScore > 0 ? `+${customer.npsScore}` : customer.npsScore}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-[#C4BEAD]/20 pb-2 text-xs">
              <span className="text-[#64746B]">Reported Network Outages</span>
              <span className="font-mono font-semibold text-[#1B2A22]">{customer.networkOutages12M} (12M)</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-[#64746B]">Active Competitor Offer</span>
              <span className={`font-bold ${customer.competitorOfferReceived ? 'text-[#B5483A]' : 'text-[#1F7A4D]'}`}>
                {customer.competitorOfferReceived ? 'Yes (Comparing)' : 'None Logged'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: SHAP Waterfall & Gemini Retention Plan & What-If */}
        <div className="space-y-6 lg:col-span-2">
          {/* SHAP Attribution Waterfall */}
          <div className="rounded-xl border border-[#C4BEAD]/40 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
                  Explainability: SHAP Risk Waterfall
                </h3>
                <p className="text-xs text-[#64746B]">
                  Exact Shapley contributions driving this subscriber's risk above or below the baseline
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#1F7A4D] bg-[#1F7A4D]/10 px-2 py-0.5 rounded border border-[#1F7A4D]/20">
                Exact Additive SHAP Verified
              </span>
            </div>

            <div className="space-y-2.5 pt-2">
              {(customer.topDrivers || []).map((driver, idx) => {
                const isIncrease = driver.direction === 'increase';
                const pct = Math.min(100, Math.abs(driver.contribution) * 200);

                return (
                  <div key={idx} className="rounded-lg border border-[#C4BEAD]/25 bg-[#FAF6EA]/50 p-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${isIncrease ? 'bg-[#B5483A]' : 'bg-[#1F7A4D]'}`} />
                        <span className="font-bold text-[#1B2A22]">{driver.featureName}</span>
                        <span className="text-[11px] text-[#64746B]">({driver.valStr})</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono font-bold">
                        <span className={isIncrease ? 'text-[#B5483A]' : 'text-[#1F7A4D]'}>
                          {isIncrease ? '+' : ''}{(driver.contribution * 100).toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-[#64746B]">
                          {isIncrease ? 'risk driver' : 'protective'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#E5DFCF]">
                      <div
                        className={`h-full ${isIncrease ? 'bg-[#B5483A]' : 'bg-[#1F7A4D]'}`}
                        style={{ width: `${Math.max(5, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gemini AI Retention Action Plan Card */}
          <div className="rounded-xl border border-[#C9A227]/40 bg-[#F1EAD3]/70 p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#C9A227]" />
                <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
                  Gemini AI Personalized Retention Plan
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {aiPlan && (
                  <>
                    <button
                      onClick={handleCopyScript}
                      className="inline-flex items-center gap-1 rounded border border-[#0F3D2E]/30 bg-white px-2.5 py-1 text-xs font-semibold text-[#0F3D2E] hover:bg-[#FAF6EA]"
                      title="Copy retention talking points"
                    >
                      {copiedScript ? <Check className="h-3.5 w-3.5 text-[#1F7A4D]" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedScript ? 'Copied' : 'Copy'}</span>
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="inline-flex items-center gap-1 rounded bg-[#0F3D2E] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#1F7A4D]"
                      title="Export executive brief to PDF"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      <span>PDF Brief</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {!aiPlan ? (
              <div className="py-6 text-center">
                <p className="text-xs text-[#1B2A22]/80 max-w-lg mx-auto mb-4">
                  Generate a structured, UK regulatory-compliant retention intervention plan tailored to this customer's contract, outages, and behavioral risk profile.
                </p>
                <button
                  onClick={handleGenerateAIPlan}
                  disabled={loadingAi}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0F3D2E] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1F7A4D] disabled:opacity-60"
                >
                  <Sparkles className="h-4 w-4 text-[#E4C766]" />
                  <span>{loadingAi ? 'Synthesizing with Gemini...' : 'Generate Personalized Retention Plan'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-white/80 p-3.5 text-xs border border-[#C4BEAD]/30">
                  <span className="font-bold text-[#0F3D2E]">Executive Diagnosis:</span>
                  <p className="mt-1 leading-relaxed text-[#1B2A22]">{aiPlan.customerSummary}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-white p-3 border border-[#C4BEAD]/30">
                    <span className="text-[10px] font-bold uppercase text-[#64746B]">Recommended Offer</span>
                    <p className="mt-1 font-bold text-[#0F3D2E] text-xs">{aiPlan.recommendedOffer.title}</p>
                    <p className="mt-0.5 text-[11px] text-[#1F7A4D] font-semibold">£{aiPlan.recommendedOffer.monthlyDiscountGbp}/mo credit ({aiPlan.recommendedOffer.termMonths}M commit)</p>
                  </div>

                  <div className="rounded-lg bg-white p-3 border border-[#C4BEAD]/30">
                    <span className="text-[10px] font-bold uppercase text-[#64746B]">Delivery Channel</span>
                    <p className="mt-1 font-bold text-[#0F3D2E] text-xs">{aiPlan.communicationChannel}</p>
                    <p className="mt-0.5 text-[11px] text-[#B5483A] font-semibold">Urgency: {aiPlan.urgency}</p>
                  </div>

                  <div className="rounded-lg bg-white p-3 border border-[#C4BEAD]/30">
                    <span className="text-[10px] font-bold uppercase text-[#64746B]">Projected Annual Net ROI</span>
                    <p className="mt-1 font-bold text-[#1F7A4D] text-xs">+{aiPlan.projectedChurnReductionPct}% Save Uplift</p>
                    <p className="mt-0.5 text-[11px] text-[#64746B]">£{aiPlan.expectedAnnualRoiGbp} expected saved</p>
                  </div>
                </div>

                {/* Script talking points */}
                <div className="rounded-lg bg-white p-3.5 border border-[#C4BEAD]/30">
                  <span className="font-bold text-xs text-[#0F3D2E]">Agent Retention Conversation Script:</span>
                  <ul className="mt-2 space-y-1.5 text-xs text-[#1B2A22]">
                    {aiPlan.scriptTalkingPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#1F7A4D] mt-0.5" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Customer What-If Simulator Lever Box */}
          <div className="rounded-xl border border-[#C4BEAD]/40 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-[#C4BEAD]/20">
              <div className="flex items-center gap-2">
                <Sliders className="h-5 w-5 text-[#0F3D2E]" />
                <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">
                  Simulate Retention Levers on {customer.customerId}
                </h3>
              </div>
              <button
                onClick={handleRunSimulation}
                className="rounded-lg bg-[#0F3D2E] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1F7A4D] shadow-xs"
              >
                Compute Impact
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-[#1B2A22]">Discount Offer: {discountPercent}%</label>
                <input
                  type="range"
                  min="0"
                  max="30"
                  step="5"
                  value={discountPercent}
                  onChange={e => setDiscountPercent(Number(e.target.value))}
                  className="w-full accent-[#0F3D2E] mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#1B2A22]">Re-commit Contract Commitment</label>
                <select
                  value={contractType}
                  onChange={e => setContractType(e.target.value as any)}
                  className="w-full rounded border border-[#C4BEAD]/60 p-1.5 text-xs mt-1"
                >
                  <option value="Rolling Monthly">Rolling Monthly</option>
                  <option value="12 Months">12 Months Renewal</option>
                  <option value="24 Months">24 Months Renewal</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-dd"
                  checked={directDebit}
                  onChange={e => setDirectDebit(e.target.checked)}
                  className="rounded accent-[#0F3D2E]"
                />
                <label htmlFor="chk-dd" className="text-xs text-[#1B2A22]">Switch to Direct Debit</label>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-comp"
                  checked={resolveComplaints}
                  onChange={e => setResolveComplaints(e.target.checked)}
                  className="rounded accent-[#0F3D2E]"
                />
                <label htmlFor="chk-comp" className="text-xs text-[#1B2A22]">Resolve Complaints with VIP Credit</label>
              </div>
            </div>

            {simResult && (
              <div className="mt-4 rounded-lg bg-[#FAF6EA] p-3.5 text-xs border border-[#C4BEAD]/30 space-y-2">
                <div className="flex items-center justify-between font-bold text-xs">
                  <span>Simulated Churn Probability:</span>
                  <span className="font-mono text-sm text-[#1F7A4D]">
                    {(simResult.newProbability * 100).toFixed(1)}% ({simResult.probabilityDelta > 0 ? '+' : ''}{(simResult.probabilityDelta * 100).toFixed(1)}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-[#64746B]">
                  <span>Annual Revenue Protected: £{simResult.annualRevenueProtectedGbp}</span>
                  <span>Annual Campaign Cost: £{simResult.annualCampaignCostGbp}</span>
                  <span className="font-bold text-[#0F3D2E]">Net ROI: {simResult.roiMultiplier}x</span>
                </div>
                <p className="text-[11px] text-[#1B2A22]/80 italic">{simResult.keyDriversSummary}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
