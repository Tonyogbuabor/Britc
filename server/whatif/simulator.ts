import type { CustomerRecord } from '../../shared/types.js';

export interface WhatIfLevers {
  discountPercent?: number; // e.g. 15
  contractType?: 'Rolling Monthly' | '12 Months' | '24 Months';
  directDebit?: boolean;
  resolveComplaints?: boolean;
  neutralizeCompetitorOffer?: boolean;
  upgradeToUnlimited?: boolean;
}

export interface WhatIfSimulationResult {
  originalProbability: number;
  newProbability: number;
  probabilityDelta: number; // negative means risk reduced
  originalRiskTier: CustomerRecord['riskTier'];
  newRiskTier: CustomerRecord['riskTier'];
  monthlyCostGbp: number;
  oneOffCostGbp: number;
  annualRevenueProtectedGbp: number;
  annualCampaignCostGbp: number;
  netAnnualBenefitGbp: number;
  roiMultiplier: number;
  isViable: boolean;
  keyDriversSummary: string;
}

export function simulateCustomerWhatIf(
  record: CustomerRecord,
  levers: WhatIfLevers
): WhatIfSimulationResult {
  const originalProb = record.churnProbability ?? 0.35;
  let simulatedProb = originalProb;
  let monthlyCost = 0;
  let oneOffCost = 0;

  // 1. Contract upgrade lever
  if (levers.contractType && levers.contractType !== record.contractType) {
    if (record.contractType === 'Rolling Monthly' && levers.contractType === '12 Months') {
      simulatedProb -= 0.18; // significant lock-in reduction
    } else if (record.contractType === 'Rolling Monthly' && levers.contractType === '24 Months') {
      simulatedProb -= 0.26;
    } else if (record.contractType === '12 Months' && levers.contractType === '24 Months') {
      simulatedProb -= 0.08;
    }
  }

  // 2. Discount lever
  if (levers.discountPercent !== undefined && levers.discountPercent > record.discountPercent) {
    const additionalDiscount = (levers.discountPercent - record.discountPercent) / 100;
    // Each 10% discount reduces churn risk by approx 0.06
    simulatedProb -= additionalDiscount * 0.6;
    monthlyCost += record.monthlyChargeGbp * additionalDiscount;
  }

  // 3. Direct Debit switch
  if (levers.directDebit && !record.directDebit) {
    simulatedProb -= 0.07;
  }

  // 4. Resolving complaints / VIP Care
  if (levers.resolveComplaints && record.complaints12M > 0) {
    simulatedProb -= Math.min(0.20, record.complaints12M * 0.08);
    oneOffCost += 15; // £15 goodwill voucher
  }

  // 5. Neutralize competitor offer
  if (levers.neutralizeCompetitorOffer && record.competitorOfferReceived) {
    simulatedProb -= 0.14;
  }

  // 6. Unlimited upgrade
  if (levers.upgradeToUnlimited && !record.isUnlimitedData) {
    simulatedProb -= 0.09;
    monthlyCost += 2.0; // wholesale data cost
  }

  // Clamp probability between 0.02 and 0.98
  simulatedProb = Math.max(0.02, Math.min(0.98, simulatedProb));
  const probDelta = simulatedProb - originalProb;

  // Determine new risk tier
  let newTier: CustomerRecord['riskTier'] = 'Low';
  if (simulatedProb >= 0.65) newTier = 'Critical';
  else if (simulatedProb >= 0.40) newTier = 'High';
  else if (simulatedProb >= 0.20) newTier = 'Medium';

  // Economics
  const annualRevenueProtected = Math.max(0, -probDelta * (record.monthlyChargeGbp * 12));
  const annualCampaignCost = monthlyCost * 12 + oneOffCost;
  const netBenefit = annualRevenueProtected - annualCampaignCost;
  const roiMultiplier = annualCampaignCost > 0 ? Number((annualRevenueProtected / annualCampaignCost).toFixed(2)) : 5.0;

  let summary = 'Simulated changes reduce churn probability by ' + Math.abs(Math.round(probDelta * 100)) + ' percentage points.';
  if (netBenefit > 0) {
    summary += ` Net annual ROI is projected at ${roiMultiplier}x (£${netBenefit.toFixed(2)} net gain).`;
  } else {
    summary += ' Warning: Cost of intervention exceeds direct expected churn loss for this customer.';
  }

  return {
    originalProbability: originalProb,
    newProbability: Number(simulatedProb.toFixed(4)),
    probabilityDelta: Number(probDelta.toFixed(4)),
    originalRiskTier: record.riskTier,
    newRiskTier: newTier,
    monthlyCostGbp: Number(monthlyCost.toFixed(2)),
    oneOffCostGbp: Number(oneOffCost.toFixed(2)),
    annualRevenueProtectedGbp: Number(annualRevenueProtected.toFixed(2)),
    annualCampaignCostGbp: Number(annualCampaignCost.toFixed(2)),
    netAnnualBenefitGbp: Number(netBenefit.toFixed(2)),
    roiMultiplier,
    isViable: netBenefit >= 0,
    keyDriversSummary: summary,
  };
}
