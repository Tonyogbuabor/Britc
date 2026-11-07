import type { CampaignOffer } from './types.js';

export const DEFAULT_RISK_THRESHOLDS = {
  CRITICAL: 0.65,
  HIGH: 0.40,
  MEDIUM: 0.20,
} as const;

export const OFFER_CATALOGUE: CampaignOffer[] = [
  {
    id: 'offer-loyalty-15',
    name: '15% Loyalty Discount (12M Commit)',
    category: 'Discount',
    monthlyDiscountGbp: 8.50,
    durationMonths: 12,
    oneOffCostGbp: 0,
    contractExtensionMonths: 12,
    expectedChurnReductionPct: 35,
    description: '15% off monthly bill for 12 months with contract re-commitment.'
  },
  {
    id: 'offer-vip-service',
    name: 'Priority Care & Network Guarantee',
    category: 'VIP Care',
    monthlyDiscountGbp: 0,
    durationMonths: 6,
    oneOffCostGbp: 15,
    contractExtensionMonths: 0,
    expectedChurnReductionPct: 28,
    description: 'Dedicated account manager line, free router upgrade, £15 goodwill credit.'
  },
  {
    id: 'offer-bundle-upgrade',
    name: 'Fibre Upgrade & Mobile SIM Add-on',
    category: 'Bundle Incentive',
    monthlyDiscountGbp: 5.00,
    durationMonths: 24,
    oneOffCostGbp: 20,
    contractExtensionMonths: 24,
    expectedChurnReductionPct: 45,
    description: 'Upgrade speed tier to Full Fibre with free unlimited SIM for 3 months.'
  },
  {
    id: 'offer-direct-debit-recommit',
    name: 'Direct Debit & Paperless Bonus',
    category: 'Contract Re-commit',
    monthlyDiscountGbp: 3.00,
    durationMonths: 12,
    oneOffCostGbp: 0,
    contractExtensionMonths: 12,
    expectedChurnReductionPct: 22,
    description: '£3 monthly discount when switching to Direct Debit with 12M renewal.'
  }
];
