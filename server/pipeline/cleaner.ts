import type { RawCustomerRow, CustomerRecord, DataQualityReport } from '../../shared/types.js';

export function parseExcelDateOrString(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  
  // If numeric (Excel serial date)
  const num = Number(val);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    // Excel epoch: 1899-12-30 (due to 1900 leap year bug in Lotus 1-2-3)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const targetDate = new Date(excelEpoch.getTime() + num * 86400000);
    return targetDate.toISOString().split('T')[0];
  }

  // If string (e.g., M/D/YYYY or YYYY-MM-DD)
  const str = String(val).trim();
  if (str.includes('/')) {
    const parts = str.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${month}-${day}`;
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return str;
}

export function cleanAndValidateDataset(
  rawRows: RawCustomerRow[],
  source: DataQualityReport['source'],
  contentHash: string
): { cleanRecords: CustomerRecord[]; qualityReport: DataQualityReport } {
  const quarantinedReasons: Array<{ customerId: string; reason: string }> = [];
  const imputedNumericFields: Record<string, number> = {};
  const categoricalNormalizations: Record<string, number> = {};
  const outliersCapped: Record<string, number> = {};

  // 1. Deduplication on Customer ID
  const customerMap = new Map<string, { row: RawCustomerRow; completeness: number }>();
  let deduplicatedCount = 0;

  for (const raw of rawRows) {
    const rawId = String(raw['Customer ID'] || '').trim();
    if (!rawId || rawId.toLowerCase() === 'undefined' || rawId.toLowerCase() === 'null') {
      quarantinedReasons.push({ customerId: 'UNKNOWN_ID', reason: 'Missing Customer ID' });
      continue;
    }

    // Count non-empty values
    let completeness = 0;
    for (const val of Object.values(raw)) {
      if (val !== null && val !== undefined && String(val).trim() !== '') completeness++;
    }

    if (customerMap.has(rawId)) {
      deduplicatedCount++;
      const existing = customerMap.get(rawId)!;
      if (completeness > existing.completeness) {
        quarantinedReasons.push({ customerId: rawId, reason: 'Duplicate customer record (kept more complete record)' });
        customerMap.set(rawId, { row: raw, completeness });
      } else {
        quarantinedReasons.push({ customerId: rawId, reason: 'Duplicate customer record (ignored less complete duplicate)' });
      }
    } else {
      customerMap.set(rawId, { row: raw, completeness });
    }
  }

  // Helper numeric coersion
  const toNum = (val: any, def: number, fieldName: string): number => {
    if (val === null || val === undefined || String(val).trim() === '') {
      imputedNumericFields[fieldName] = (imputedNumericFields[fieldName] || 0) + 1;
      return def;
    }
    const n = Number(val);
    if (isNaN(n)) {
      imputedNumericFields[fieldName] = (imputedNumericFields[fieldName] || 0) + 1;
      return def;
    }
    return n;
  };

  // Helper boolean coersion
  const toBool = (val: any): boolean => {
    const s = String(val).trim().toLowerCase();
    return s === 'yes' || s === 'true' || s === '1';
  };

  const validRecords: CustomerRecord[] = [];

  for (const [customerId, { row }] of customerMap.entries()) {
    // Target integrity check
    const churnStatusStr = String(row['Churn Status'] || '').trim().toLowerCase();
    const churnFlagVal = Number(row['Churn Flag']);
    const isStatusChurned = churnStatusStr === 'churned';
    const isFlagChurned = churnFlagVal === 1;

    // Strict Target Integrity Check
    if (churnStatusStr && !isNaN(churnFlagVal)) {
      if (isStatusChurned !== isFlagChurned) {
        quarantinedReasons.push({
          customerId,
          reason: `Target integrity violation: Churn Status '${row['Churn Status']}' does not match Churn Flag ${churnFlagVal}`
        });
        continue;
      }
    }

    // Demographic and domain bounds validation
    const age = toNum(row['Age'], 42, 'Age');
    if (age < 16 || age > 110) {
      quarantinedReasons.push({
        customerId,
        reason: `Age out of valid domain: ${age} (valid: 16-110)`
      });
      continue;
    }

    const satisfaction = Math.max(1, Math.min(10, toNum(row['Satisfaction Score 1 10'], 7, 'Satisfaction Score')));
    const nps = Math.max(-100, Math.min(100, toNum(row['NPS Score'], 20, 'NPS Score')));

    const dataAllowanceGb = toNum(row['Data Allowance GB'], 0, 'Data Allowance GB');
    const isUnlimited = dataAllowanceGb === 999;
    const hasAllowance = dataAllowanceGb > 0 && dataAllowanceGb !== 999;

    const joinDate = parseExcelDateOrString(row['Join Date']) || '2024-01-01';
    const churnDate = isStatusChurned ? (parseExcelDateOrString(row['Churn Date']) || null) : null;
    const contractStartDate = parseExcelDateOrString(row['Contract Start Date']) || joinDate;
    const contractEndDate = parseExcelDateOrString(row['Contract End Date']) || contractStartDate;

    const tenure = Math.max(0, toNum(row['Tenure Months'], 12, 'Tenure Months'));
    const monthlyCharge = Math.max(0, toNum(row['Monthly Charge GBP'], 35, 'Monthly Charge GBP'));
    const avgUsageGb = Math.max(0, toNum(row['Average Monthly Usage GB'], 150, 'Average Monthly Usage GB'));
    const overage = Math.max(0, toNum(row['Overage Charges GBP'], 0, 'Overage Charges GBP'));
    const discount = Math.max(0, Math.min(100, toNum(row['Discount Percent'], 0, 'Discount Percent')));

    // Capping extreme outliers (e.g. overage > 200, complaints > 20)
    let cappedOverage = overage;
    if (overage > 250) {
      cappedOverage = 250;
      outliersCapped['Overage Charges GBP'] = (outliersCapped['Overage Charges GBP'] || 0) + 1;
    }

    const latePayments = Math.max(0, Math.round(toNum(row['Late Payments 12M'], 0, 'Late Payments 12M')));
    const failedPayments = Math.max(0, Math.round(toNum(row['Failed Payments 12M'], 0, 'Failed Payments 12M')));
    const supportTickets = Math.max(0, Math.round(toNum(row['Support Tickets 12M'], 0, 'Support Tickets 12M')));
    const complaints = Math.max(0, Math.round(toNum(row['Complaints 12M'], 0, 'Complaints 12M')));
    const avgResolutionHours = Math.max(0, toNum(row['Average Resolution Hours'], 0, 'Average Resolution Hours'));
    const networkOutages = Math.max(0, Math.round(toNum(row['Network Outages 12M'], 0, 'Network Outages 12M')));

    // Normalizing categorical values
    const segmentRaw = String(row['Customer Segment'] || '').trim();
    let segment: 'Consumer' | 'Small Business' | 'Enterprise' = 'Consumer';
    if (segmentRaw.toLowerCase().includes('enterprise') || segmentRaw.toLowerCase().includes('corp')) {
      segment = 'Enterprise';
    } else if (segmentRaw.toLowerCase().includes('business') || segmentRaw.toLowerCase().includes('sme')) {
      segment = 'Small Business';
    }

    const genderRaw = String(row['Gender'] || '').trim().toLowerCase();
    let gender: 'Male' | 'Female' | 'Other' | 'Prefer not to say' = 'Prefer not to say';
    if (genderRaw.startsWith('m')) gender = 'Male';
    else if (genderRaw.startsWith('f')) gender = 'Female';
    else if (genderRaw.includes('other')) gender = 'Other';

    const serviceRaw = String(row['Service Type'] || '').trim().toLowerCase();
    let serviceType: 'Mobile' | 'Home Broadband' | 'Fibre Broadband' | 'Mobile + Broadband Bundle' = 'Mobile';
    if (serviceRaw.includes('bundle')) serviceType = 'Mobile + Broadband Bundle';
    else if (serviceRaw.includes('fibre')) serviceType = 'Fibre Broadband';
    else if (serviceRaw.includes('home') || serviceRaw.includes('broadband')) serviceType = 'Home Broadband';

    const contractRaw = String(row['Contract Type'] || '').trim().toLowerCase();
    let contractType: 'Rolling Monthly' | '12 Months' | '24 Months' = '12 Months';
    if (contractRaw.includes('rolling') || contractRaw.includes('month to month') || contractRaw.includes('flex')) {
      contractType = 'Rolling Monthly';
    } else if (contractRaw.includes('24') || contractRaw.includes('2 year')) {
      contractType = '24 Months';
    }

    const nationRaw = String(row['UK Nation'] || '').trim().toLowerCase();
    let ukNation: 'England' | 'Scotland' | 'Wales' | 'Northern Ireland' = 'England';
    if (nationRaw.includes('scot')) ukNation = 'Scotland';
    else if (nationRaw.includes('wale')) ukNation = 'Wales';
    else if (nationRaw.includes('ireland')) ukNation = 'Northern Ireland';

    const competitorOffer = toBool(row['Competitor Offer Received']);
    const autoRenew = toBool(row['Auto Renew']);
    const directDebit = toBool(row['Direct Debit']);

    const lifetimeRev = Math.max(0, toNum(row['Lifetime Revenue GBP'], monthlyCharge * tenure, 'Lifetime Revenue GBP'));
    const monthlyRevAtRisk = isStatusChurned ? monthlyCharge : 0;

    validRecords.push({
      customerId,
      customerSegment: segment,
      age,
      ageBand: String(row['Age Band'] || '35-44').trim(),
      gender,
      ukNation,
      city: String(row['City'] || 'London').trim(),
      acquisitionChannel: String(row['Acquisition Channel'] || 'Direct').trim(),
      joinDate,
      tenureMonths: tenure,
      serviceType,
      planName: String(row['Plan Name'] || 'Standard').trim(),
      contractType,
      contractStartDate,
      contractEndDate,
      autoRenew,
      monthlyChargeGbp: monthlyCharge,
      averageMonthlyUsageGb: avgUsageGb,
      dataAllowanceGb,
      isUnlimitedData: isUnlimited,
      hasDataAllowance: hasAllowance,
      overageChargesGbp: cappedOverage,
      discountPercent: discount,
      paymentMethod: String(row['Payment Method'] || 'Direct Debit').trim(),
      directDebit,
      latePayments12M: latePayments,
      failedPayments12M: failedPayments,
      supportTickets12M: supportTickets,
      complaints12M: complaints,
      averageResolutionHours: avgResolutionHours,
      networkOutages12M: networkOutages,
      satisfactionScore: satisfaction,
      npsScore: nps,
      competitorOfferReceived: competitorOffer,
      churnStatus: isStatusChurned ? 'Churned' : 'Active',
      churnDate,
      churnReason: isStatusChurned ? String(row['Churn Reason'] || 'Unknown').trim() : null,
      lifetimeRevenueGbp: lifetimeRev,
      monthlyRevenueAtRiskGbp: monthlyRevAtRisk,
      churnFlag: isStatusChurned ? 1 : 0,
    });
  }

  const qualityReport: DataQualityReport = {
    totalRawRows: rawRows.length,
    validRows: validRecords.length,
    deduplicatedCount,
    quarantinedCount: quarantinedReasons.length,
    quarantinedReasons,
    imputedNumericFields,
    categoricalNormalizations,
    outliersCapped,
    lastLoadedAt: new Date().toISOString(),
    source,
    contentHash,
  };

  return { cleanRecords: validRecords, qualityReport };
}
