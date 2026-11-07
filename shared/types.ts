export type RiskTier = 'Critical' | 'High' | 'Medium' | 'Low';

export interface RawCustomerRow {
  'Customer ID': string;
  'Customer Segment': string;
  'Age': string | number;
  'Age Band': string;
  'Gender': string;
  'UK Nation': string;
  'City': string;
  'Acquisition Channel': string;
  'Join Date': string | number;
  'Tenure Months': string | number;
  'Service Type': string;
  'Plan Name': string;
  'Contract Type': string;
  'Contract Start Date': string | number;
  'Contract End Date': string | number;
  'Auto Renew': string;
  'Monthly Charge GBP': string | number;
  'Average Monthly Usage GB': string | number;
  'Data Allowance GB': string | number;
  'Overage Charges GBP': string | number;
  'Discount Percent': string | number;
  'Payment Method': string;
  'Direct Debit': string;
  'Late Payments 12M': string | number;
  'Failed Payments 12M': string | number;
  'Support Tickets 12M': string | number;
  'Complaints 12M': string | number;
  'Average Resolution Hours': string | number;
  'Network Outages 12M': string | number;
  'Satisfaction Score 1 10': string | number;
  'NPS Score': string | number;
  'Competitor Offer Received': string;
  'Churn Status': string;
  'Churn Date': string | number;
  'Churn Reason': string;
  'Lifetime Revenue GBP': string | number;
  'Monthly Revenue At Risk GBP': string | number;
  'Churn Flag': string | number;
}

export interface CustomerRecord {
  customerId: string;
  customerSegment: 'Consumer' | 'Small Business' | 'Enterprise';
  // Protected demographics (fairness audit & charts only, never model inputs)
  age: number;
  ageBand: string;
  gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say';
  ukNation: 'England' | 'Scotland' | 'Wales' | 'Northern Ireland';
  city: string;
  acquisitionChannel: string;
  
  // Product & Contract
  joinDate: string; // ISO format YYYY-MM-DD
  tenureMonths: number;
  serviceType: 'Mobile' | 'Home Broadband' | 'Fibre Broadband' | 'Mobile + Broadband Bundle';
  planName: string;
  contractType: 'Rolling Monthly' | '12 Months' | '24 Months';
  contractStartDate: string;
  contractEndDate: string;
  autoRenew: boolean;
  
  // Billing & Usage
  monthlyChargeGbp: number;
  averageMonthlyUsageGb: number;
  dataAllowanceGb: number; // 999 = unlimited, 0 = broadband/NA
  isUnlimitedData: boolean;
  hasDataAllowance: boolean;
  overageChargesGbp: number;
  discountPercent: number;
  paymentMethod: string;
  directDebit: boolean;
  latePayments12M: number;
  failedPayments12M: number;
  
  // Experience & Sentiment
  supportTickets12M: number;
  complaints12M: number;
  averageResolutionHours: number;
  networkOutages12M: number;
  satisfactionScore: number; // 1 to 10
  npsScore: number; // -100 to 100 continuous index
  competitorOfferReceived: boolean;
  
  // Outcome (ground truth)
  churnStatus: 'Active' | 'Churned';
  churnDate: string | null;
  churnReason: string | null;
  lifetimeRevenueGbp: number;
  monthlyRevenueAtRiskGbp: number;
  churnFlag: 0 | 1; // 1 = Churned, 0 = Active

  // ML Inferred & Pipeline fields (populated after model scoring)
  churnProbability?: number; // calibrated 0.0 - 1.0
  riskTier?: RiskTier;
  segmentId?: string;
  segmentName?: string;
  topDrivers?: SHAPDriver[];
  whatIfProbability?: number;
}

export interface SHAPDriver {
  feature: string;
  featureName: string;
  valStr: string;
  contribution: number; // positive = pushes risk UP, negative = pulls risk DOWN
  direction: 'increase' | 'decrease';
  category: 'Billing' | 'Contract' | 'Usage' | 'Service' | 'Outages' | 'Support';
}

export interface ModelMetrics {
  rocAuc: number;
  prAuc: number;
  accuracy: number;
  f1Score: number;
  precision: number;
  recall: number;
  brierScore: number;
  optimalThreshold: number;
  confusionMatrix: {
    tp: number;
    fp: number;
    tn: number;
    fn: number;
  };
  rocCurve: Array<{ fpr: number; tpr: number; threshold: number }>;
  prCurve: Array<{ recall: number; precision: number; threshold: number }>;
  calibrationCurve: Array<{ binMid: number; empiricalProb: number; count: number }>;
  gainCurve: Array<{ percentPopulation: number; percentChurnersCaptured: number }>;
}

export interface ModelComparison {
  logisticRegression: ModelMetrics & { trainingTimeMs: number };
  randomForest: ModelMetrics & { trainingTimeMs: number };
  gradientBoosted: ModelMetrics & { trainingTimeMs: number };
  activeModel: 'logisticRegression' | 'randomForest' | 'gradientBoosted';
}

export interface ProtectedGroupMetric {
  group: string;
  attribute: 'gender' | 'ageBand';
  count: number;
  actualChurnRate: number;
  predictedHighRiskRate: number; // selection rate at optimal threshold
  disparateImpactRatio: number; // vs benchmark group (80% rule: 0.8 to 1.25 is fair)
  fpr: number;
  fnr: number;
}

export interface FairnessAudit {
  genderMetrics: ProtectedGroupMetric[];
  ageBandMetrics: ProtectedGroupMetric[];
  isFair: boolean;
  summary: string;
}

export interface LeakageAuditTest {
  name: string;
  passed: boolean;
  details: string;
  score?: number;
  threshold?: number;
}

export interface LeakageAuditReport {
  allowlistedFeatures: string[];
  blockedFeatures: string[];
  singleFeatureMaxAuc: number;
  singleFeatureTests: Array<{ feature: string; auc: number; passed: boolean }>;
  permutationTestAuc: number; // should be ~0.50 (+/- 0.07)
  permutationTestPassed: boolean;
  allPassed: boolean;
}

export interface CustomerSegment {
  id: string;
  name: string;
  persona: string;
  customerCount: number;
  churnRate: number;
  avgMonthlyCharge: number;
  avgTenureMonths: number;
  avgNps: number;
  dominantRiskFactor: string;
  recommendedIntervention: string;
  matrixQuadrant: 'Protect (High Val, High Risk)' | 'Fix (High Risk, Low Val)' | 'Nurture (Low Risk, High Val)' | 'Monitor (Low Risk, Low Val)';
}

export interface CampaignOffer {
  id: string;
  name: string;
  category: 'Discount' | 'Upgrade' | 'Contract Re-commit' | 'VIP Care' | 'Bundle Incentive';
  monthlyDiscountGbp: number;
  durationMonths: number;
  oneOffCostGbp: number;
  contractExtensionMonths: number;
  expectedChurnReductionPct: number;
  description: string;
}

export interface Campaign {
  id: string;
  name: string;
  createdAt: string;
  targetSegmentId: string;
  targetTier: RiskTier;
  offer: CampaignOffer;
  totalTargeted: number;
  treatedCount: number;
  controlCount: number; // 10% holdout
  status: 'Draft' | 'Active' | 'Completed' | 'Paused';
  // Performance metrics
  actualTreatedChurnRate?: number;
  actualControlChurnRate?: number;
  upliftPercent?: number; // difference in churn reduction
  netRevenueSavedGbp?: number;
  campaignCostGbp?: number;
  roiMultiplier?: number;
  customerIds: string[];
  controlIds: string[];
}

export interface DataQualityReport {
  totalRawRows: number;
  validRows: number;
  deduplicatedCount: number;
  quarantinedCount: number;
  quarantinedReasons: Array<{ customerId: string; reason: string }>;
  imputedNumericFields: Record<string, number>;
  categoricalNormalizations: Record<string, number>;
  outliersCapped: Record<string, number>;
  lastLoadedAt: string;
  source: 'Google Sheets API v4' | 'Public Sheet CSV' | 'Disk Snapshot Cache' | 'Bundled Data Seed';
  contentHash: string;
}

export interface ExecutiveKPIs {
  totalCustomers: number;
  activeCustomers: number;
  churnedCustomers: number;
  baselineChurnRate: number; // overall historical churn rate
  monthlyChurnRate: number; // annualized or rolling 30-day
  totalMrrAtRisk: number; // Sum of MRR for active customers flagged High/Critical
  expectedMonthlyChurnLossGbp: number; // Sum of (MRR * P(churn))
  totalProtectedRevenueGbp: number;
  avgCustomerTenureMonths: number;
  avgNpsScore: number;
  avgSatisfactionScore: number;
  riskDistribution: {
    critical: { count: number; mrr: number; percentage: number };
    high: { count: number; mrr: number; percentage: number };
    medium: { count: number; mrr: number; percentage: number };
    low: { count: number; mrr: number; percentage: number };
  };
  monthlyChurnTrend: Array<{
    month: string;
    churnCount: number;
    churnRate: number;
    mrrLost: number;
  }>;
}

export interface RetentionPlanAI {
  customerId: string;
  customerSummary: string;
  riskCategory: 'High' | 'Critical' | 'Medium' | 'Low';
  rootCauses: string[];
  recommendedOffer: {
    title: string;
    monthlyDiscountGbp: number;
    termMonths: number;
    rationale: string;
  };
  communicationChannel: 'Phone Call' | 'Personal Email' | 'SMS' | 'Account Manager';
  scriptTalkingPoints: string[];
  projectedChurnReductionPct: number;
  expectedAnnualRoiGbp: number;
  urgency: 'Immediate (24h)' | 'High (48h)' | 'Standard (7 days)';
}

export interface AppSnapshot {
  timestamp: string;
  version: string;
  dataQuality: DataQualityReport;
  kpis: ExecutiveKPIs;
  customers: CustomerRecord[]; // All records (both active & churned)
  activeCustomers: CustomerRecord[]; // Active subset with calibrated churn scores
  models: ModelComparison;
  fairness: FairnessAudit;
  leakageAudit: LeakageAuditReport;
  segments: CustomerSegment[];
  campaigns: Campaign[];
}

export interface WhatIfLevers {
  discountPercent?: number;
  contractType?: 'Rolling Monthly' | '12 Months' | '24 Months';
  directDebit?: boolean;
  resolveComplaints?: boolean;
  neutralizeCompetitorOffer?: boolean;
  upgradeToUnlimited?: boolean;
}

export interface WhatIfSimulationResult {
  originalProbability: number;
  newProbability: number;
  probabilityDelta: number;
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

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  toolCalls?: Array<{
    toolName: string;
    params: any;
    result: any;
  }>;
}
