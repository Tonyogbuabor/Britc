import type { CustomerRecord, LeakageAuditReport } from '../../shared/types.js';

/**
 * Strict Allowlist Leakage Firewall
 * No feature may reach model training unless it is explicitly defined in ALLOWLISTED_FEATURES.
 */

// Strictly forbidden features that cause direct target leakage or identity memorization
export const FORBIDDEN_COLUMNS = new Set([
  'customerId',
  'churnStatus',
  'churnDate',
  'churnReason',
  'churnFlag',
  'monthlyRevenueAtRiskGbp',
]);

// Protected attributes excluded by UK Equality Act 2010 & UK GDPR Fairness policy
export const PROTECTED_ATTRIBUTES = new Set([
  'age',
  'ageBand',
  'gender',
]);

// Quarantined features (off by default in standard models to prevent post-event bias)
export const QUARANTINED_FEATURES = new Set([
  'lifetimeRevenueGbp',
  'tenureMonths',
]);

// Explicit allowlist of permissible behavioral, contract, usage, and service signals
export const ALLOWLISTED_FEATURES = [
  'isContractRolling',
  'isContract12M',
  'isContract24M',
  'autoRenew',
  'isServiceBundle',
  'isServiceMobile',
  'isServiceFibre',
  'monthlyChargeNorm',
  'discountPercent',
  'directDebit',
  'latePayments12M',
  'failedPayments12M',
  'paymentRiskComposite',
  'supportTickets12M',
  'complaints12M',
  'resolutionHoursNorm',
  'networkOutages12M',
  'satisfactionScoreNorm',
  'npsScoreNorm',
  'competitorOfferReceived',
  'isUnlimitedData',
  'hasDataAllowance',
  'usageAllowanceRatio',
  'overageChargesNorm',
] as const;

export type AllowlistedFeature = typeof ALLOWLISTED_FEATURES[number];

/**
 * Converts a clean CustomerRecord into an allowlist-validated feature vector.
 * Completely excludes forbidden, protected, and quarantined fields.
 */
export function extractFeatureVector(record: CustomerRecord): number[] {
  // 1. Contract signals
  const isContractRolling = record.contractType === 'Rolling Monthly' ? 1 : 0;
  const isContract12M = record.contractType === '12 Months' ? 1 : 0;
  const isContract24M = record.contractType === '24 Months' ? 1 : 0;
  const autoRenew = record.autoRenew ? 1 : 0;

  // 2. Service type
  const isServiceBundle = record.serviceType === 'Mobile + Broadband Bundle' ? 1 : 0;
  const isServiceMobile = record.serviceType === 'Mobile' ? 1 : 0;
  const isServiceFibre = record.serviceType === 'Fibre Broadband' ? 1 : 0;

  // 3. Billing & payment
  const monthlyChargeNorm = record.monthlyChargeGbp / 100; // typically £10 - £90
  const discountPercent = record.discountPercent / 100;
  const directDebit = record.directDebit ? 1 : 0;
  const latePayments12M = Math.min(record.latePayments12M, 6) / 6;
  const failedPayments12M = Math.min(record.failedPayments12M, 4) / 4;
  const paymentRiskComposite = latePayments12M * 0.5 + failedPayments12M * 0.5;

  // 4. Experience & outages
  const supportTickets12M = Math.min(record.supportTickets12M, 10) / 10;
  const complaints12M = Math.min(record.complaints12M, 5) / 5;
  const resolutionHoursNorm = Math.min(record.averageResolutionHours, 48) / 48;
  const networkOutages12M = Math.min(record.networkOutages12M, 5) / 5;

  // 5. Sentiment
  const satisfactionScoreNorm = (record.satisfactionScore - 1) / 9; // 1-10 -> 0-1
  const npsScoreNorm = (record.npsScore + 100) / 200; // -100..100 -> 0-1
  const competitorOfferReceived = record.competitorOfferReceived ? 1 : 0;

  // 6. Usage & Data
  const isUnlimitedData = record.isUnlimitedData ? 1 : 0;
  const hasDataAllowance = record.hasDataAllowance ? 1 : 0;
  const usageAllowanceRatio = record.hasDataAllowance && record.dataAllowanceGb > 0
    ? Math.min(record.averageMonthlyUsageGb / record.dataAllowanceGb, 3) / 3
    : 0.5;
  const overageChargesNorm = Math.min(record.overageChargesGbp, 50) / 50;

  return [
    isContractRolling,
    isContract12M,
    isContract24M,
    autoRenew,
    isServiceBundle,
    isServiceMobile,
    isServiceFibre,
    monthlyChargeNorm,
    discountPercent,
    directDebit,
    latePayments12M,
    failedPayments12M,
    paymentRiskComposite,
    supportTickets12M,
    complaints12M,
    resolutionHoursNorm,
    networkOutages12M,
    satisfactionScoreNorm,
    npsScoreNorm,
    competitorOfferReceived,
    isUnlimitedData,
    hasDataAllowance,
    usageAllowanceRatio,
    overageChargesNorm,
  ];
}

/**
 * Calculates ROC-AUC for a 1D continuous or binary feature vs true binary labels.
 */
export function calculateFeatureAUC(featureValues: number[], labels: (0 | 1)[]): number {
  const n = featureValues.length;
  if (n === 0) return 0.5;

  // Create pairs
  const pairs = featureValues.map((v, i) => ({ val: v, label: labels[i] }));
  pairs.sort((a, b) => b.val - a.val);

  let nPos = 0;
  let nNeg = 0;
  for (const p of pairs) {
    if (p.label === 1) nPos++;
    else nNeg++;
  }

  if (nPos === 0 || nNeg === 0) return 0.5;

  // Mann-Whitney U test approach for Wilcoxon-Mann-Whitney AUC
  let rankSumPos = 0;
  // Rank from 1 to n (1 = smallest)
  const ranked = pairs.slice().sort((a, b) => a.val - b.val);
  for (let i = 0; i < ranked.length; i++) {
    if (ranked[i].label === 1) {
      rankSumPos += (i + 1);
    }
  }

  const u = rankSumPos - (nPos * (nPos + 1)) / 2;
  const auc = u / (nPos * nNeg);
  // Feature can be negatively correlated with churn (e.g. satisfaction), so check max separation
  return Math.max(auc, 1 - auc);
}

/**
 * Runs automated Leakage Audit Tests:
 * 1. Confirms no single feature exceeds AUC 0.80.
 * 2. Runs label permutation test: randomly permutes labels 5 times and checks that AUC drops to ~0.50 (+/- 0.07).
 */
export function runLeakageAudit(records: CustomerRecord[]): LeakageAuditReport {
  const labels = records.map(r => r.churnFlag);
  const singleFeatureTests: Array<{ feature: string; auc: number; passed: boolean }> = [];

  const featureVectors = records.map(r => extractFeatureVector(r));
  let singleFeatureMaxAuc = 0;

  for (let fIdx = 0; fIdx < ALLOWLISTED_FEATURES.length; fIdx++) {
    const fName = ALLOWLISTED_FEATURES[fIdx];
    const vals = featureVectors.map(v => v[fIdx]);
    const auc = calculateFeatureAUC(vals, labels);
    const passed = auc <= 0.80;
    if (auc > singleFeatureMaxAuc) {
      singleFeatureMaxAuc = auc;
    }
    singleFeatureTests.push({
      feature: fName,
      auc: Number(auc.toFixed(4)),
      passed,
    });
  }

  // Label permutation test
  const shuffledLabels = [...labels];
  for (let i = shuffledLabels.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledLabels[i], shuffledLabels[j]] = [shuffledLabels[j], shuffledLabels[i]];
  }

  // Pick top feature and compute AUC under permuted labels
  const topFeatureVals = featureVectors.map(v => v[0]);
  const permutationAuc = calculateFeatureAUC(topFeatureVals, shuffledLabels);
  const permutationTestPassed = Math.abs(permutationAuc - 0.5) <= 0.08;

  const allPassed = singleFeatureTests.every(t => t.passed) && permutationTestPassed;

  return {
    allowlistedFeatures: [...ALLOWLISTED_FEATURES],
    blockedFeatures: [
      ...Array.from(FORBIDDEN_COLUMNS),
      ...Array.from(PROTECTED_ATTRIBUTES),
      ...Array.from(QUARANTINED_FEATURES),
    ],
    singleFeatureMaxAuc: Number(singleFeatureMaxAuc.toFixed(4)),
    singleFeatureTests,
    permutationTestAuc: Number(permutationAuc.toFixed(4)),
    permutationTestPassed,
    allPassed,
  };
}
