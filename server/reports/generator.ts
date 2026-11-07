import ExcelJS from 'exceljs';
import type { AppSnapshot } from '../../shared/types.js';

export async function generateExcelReport(snapshot: AppSnapshot): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'BritConnect AI Churn Intelligence';
  workbook.created = new Date();

  // Tab 1: Executive Overview
  const summarySheet = workbook.addWorksheet('Executive Overview');
  summarySheet.columns = [
    { header: 'Metric', key: 'metric', width: 35 },
    { header: 'Value', key: 'value', width: 25 },
    { header: 'Notes / Context', key: 'notes', width: 45 },
  ];

  summarySheet.addRow({ metric: 'Snapshot Timestamp', value: snapshot.timestamp, notes: 'Single-source in-memory snapshot' });
  summarySheet.addRow({ metric: 'Total Tracked Customers', value: snapshot.kpis.totalCustomers, notes: 'Cleaned and validated customer base' });
  summarySheet.addRow({ metric: 'Active Subscribers', value: snapshot.kpis.activeCustomers, notes: 'Currently billable subscriber accounts' });
  summarySheet.addRow({ metric: 'Historical Churned Customers', value: snapshot.kpis.churnedCustomers, notes: 'Ground truth churn events' });
  summarySheet.addRow({ metric: 'Baseline Churn Rate', value: `${(snapshot.kpis.baselineChurnRate * 100).toFixed(2)}%`, notes: 'Overall historical churn percentage' });
  summarySheet.addRow({ metric: 'Monthly Churn Rate', value: `${(snapshot.kpis.monthlyChurnRate * 100).toFixed(2)}%`, notes: 'Recent monthly churn velocity' });
  summarySheet.addRow({ metric: 'Total MRR at Risk (Critical + High)', value: `£${snapshot.kpis.totalMrrAtRisk.toLocaleString()}`, notes: 'Monthly recurring revenue from accounts >= 40% risk' });
  summarySheet.addRow({ metric: 'Expected Monthly Churn Loss', value: `£${snapshot.kpis.expectedMonthlyChurnLossGbp.toLocaleString()}`, notes: 'Probability-weighted monthly revenue loss' });
  summarySheet.addRow({ metric: 'Total Revenue Protected', value: `£${snapshot.kpis.totalProtectedRevenueGbp.toLocaleString()}`, notes: 'Net saved revenue from active retention campaigns' });
  summarySheet.addRow({ metric: 'Active Champion Model', value: snapshot.models.activeModel.toUpperCase(), notes: `ROC-AUC: ${snapshot.models[snapshot.models.activeModel].rocAuc}` });

  // Tab 2: High & Critical Risk Accounts
  const riskSheet = workbook.addWorksheet('At-Risk Customer Registry');
  riskSheet.columns = [
    { header: 'Customer ID', key: 'id', width: 16 },
    { header: 'Segment', key: 'segment', width: 18 },
    { header: 'Service Type', key: 'service', width: 24 },
    { header: 'Plan Name', key: 'plan', width: 20 },
    { header: 'Contract Type', key: 'contract', width: 18 },
    { header: 'Monthly Bill (£)', key: 'mrr', width: 16 },
    { header: 'Churn Prob', key: 'prob', width: 14 },
    { header: 'Risk Tier', key: 'tier', width: 14 },
    { header: 'Top Risk Driver 1', key: 'driver1', width: 30 },
    { header: 'Top Risk Driver 2', key: 'driver2', width: 30 },
  ];

  const atRisk = snapshot.activeCustomers
    .filter(c => c.riskTier === 'Critical' || c.riskTier === 'High')
    .sort((a, b) => (b.churnProbability || 0) - (a.churnProbability || 0));

  atRisk.forEach(c => {
    riskSheet.addRow({
      id: c.customerId,
      segment: c.customerSegment,
      service: c.serviceType,
      plan: c.planName,
      contract: c.contractType,
      mrr: c.monthlyChargeGbp.toFixed(2),
      prob: `${((c.churnProbability || 0) * 100).toFixed(1)}%`,
      tier: c.riskTier,
      driver1: c.topDrivers?.[0] ? `${c.topDrivers[0].featureName} (${c.topDrivers[0].valStr})` : 'None',
      driver2: c.topDrivers?.[1] ? `${c.topDrivers[1].featureName} (${c.topDrivers[1].valStr})` : 'None',
    });
  });

  // Tab 3: Customer Segments
  const segSheet = workbook.addWorksheet('Segments & Interventions');
  segSheet.columns = [
    { header: 'Segment Name', key: 'name', width: 24 },
    { header: 'Quadrant', key: 'quadrant', width: 30 },
    { header: 'Subscribers', key: 'count', width: 14 },
    { header: 'Churn Rate', key: 'churn', width: 14 },
    { header: 'Avg Monthly Spend (£)', key: 'spend', width: 22 },
    { header: 'Avg Tenure (mo)', key: 'tenure', width: 16 },
    { header: 'Recommended Strategy', key: 'strategy', width: 45 },
  ];

  snapshot.segments.forEach(s => {
    segSheet.addRow({
      name: s.name,
      quadrant: s.matrixQuadrant,
      count: s.customerCount,
      churn: `${(s.churnRate * 100).toFixed(1)}%`,
      spend: s.avgMonthlyCharge.toFixed(2),
      tenure: s.avgTenureMonths,
      strategy: s.recommendedIntervention,
    });
  });

  // Tab 4: Data Quality & Governance
  const dqSheet = workbook.addWorksheet('Data Quality & Leakage Audit');
  dqSheet.columns = [
    { header: 'Audit Check', key: 'check', width: 35 },
    { header: 'Result / Status', key: 'status', width: 25 },
    { header: 'Audit Details', key: 'details', width: 50 },
  ];

  dqSheet.addRow({ check: 'Data Ingestion Source', status: snapshot.dataQuality.source, details: `SHA-256: ${snapshot.dataQuality.contentHash.substring(0, 16)}...` });
  dqSheet.addRow({ check: 'Total Ingested Rows', status: snapshot.dataQuality.totalRawRows, details: 'Raw sheet rows read' });
  dqSheet.addRow({ check: 'Valid Rows in Model', status: snapshot.dataQuality.validRows, details: 'Passed domain range and completeness filters' });
  dqSheet.addRow({ check: 'Duplicate IDs Removed', status: snapshot.dataQuality.deduplicatedCount, details: 'Kept most complete record' });
  dqSheet.addRow({ check: 'Quarantined Target Violations', status: snapshot.dataQuality.quarantinedCount, details: 'Filtered from training due to status/flag mismatch or null IDs' });
  dqSheet.addRow({ check: 'Leakage Firewall Status', status: snapshot.leakageAudit.allPassed ? 'PASSED (Zero Leakage)' : 'WARNING', details: 'Allowlist enforced; no post-event target columns accessible' });
  dqSheet.addRow({ check: 'Single-Feature Max AUC', status: snapshot.leakageAudit.singleFeatureMaxAuc, details: 'Max AUC for any candidate feature (Must be <= 0.80)' });
  dqSheet.addRow({ check: 'Label Permutation Test AUC', status: snapshot.leakageAudit.permutationTestAuc, details: 'Must be ~0.50 (+/- 0.08) under randomized targets' });
  dqSheet.addRow({ check: 'Demographic Fairness (UK GDPR)', status: snapshot.fairness.isFair ? 'PASSED' : 'NEEDS REVIEW', details: snapshot.fairness.summary });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
