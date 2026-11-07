import type { CustomerRecord, CustomerSegment } from '../../shared/types.js';

export function segmentCustomers(records: CustomerRecord[]): {
  segments: CustomerSegment[];
  assignedRecords: CustomerRecord[];
} {
  const activeRecords = records.filter(r => r.churnStatus === 'Active');
  if (activeRecords.length === 0) {
    return { segments: [], assignedRecords: records };
  }

  // Pre-defined archetype definitions mapped to data properties
  const segmentDefinitions: Array<{
    id: string;
    name: string;
    persona: string;
    quadrant: CustomerSegment['matrixQuadrant'];
    dominantRisk: string;
    intervention: string;
    matcher: (r: CustomerRecord) => boolean;
  }> = [
    {
      id: 'seg-high-value-strained',
      name: 'High-Value Strained',
      persona: 'Premium spenders (£50+/mo) experiencing service disruption, unresolved complaints, or network outages.',
      quadrant: 'Protect (High Val, High Risk)',
      dominantRisk: 'Service Friction & Unresolved Outages',
      intervention: 'VIP Account Manager outreach with £15 network guarantee credit and router upgrade.',
      matcher: (r) => (r.monthlyChargeGbp >= 45 && ((r.complaints12M > 0) || (r.networkOutages12M >= 2) || (r.churnProbability || 0) >= 0.40)),
    },
    {
      id: 'seg-rolling-bargain-hunters',
      name: 'Rolling Bargain Hunters',
      persona: 'Price-sensitive customers on rolling or expiring monthly plans actively comparing competitor offers.',
      quadrant: 'Fix (High Risk, Low Val)',
      dominantRisk: 'Price Sensitivity & Competitor Poaching',
      intervention: '15% Loyalty renewal discount tied to a 12-month re-commitment.',
      matcher: (r) => (r.contractType === 'Rolling Monthly' || r.competitorOfferReceived || (r.discountPercent === 0 && (r.churnProbability || 0) >= 0.35)),
    },
    {
      id: 'seg-contented-bundlers',
      name: 'Contented Bundlers',
      persona: 'High-LTV multi-product subscribers with direct debit enabled and consistently positive NPS.',
      quadrant: 'Nurture (Low Risk, High Val)',
      dominantRisk: 'Late-Stage Inactivity or Renewal Oversight',
      intervention: 'Complimentary speed boost or family SIM add-on at renewal cycle.',
      matcher: (r) => (r.serviceType === 'Mobile + Broadband Bundle' && r.npsScore >= 10 && (r.churnProbability || 0) < 0.30),
    },
    {
      id: 'seg-digital-mobile-natives',
      name: 'Digital Mobile Natives',
      persona: 'Single-service mobile users with heavy data consumption who face potential bill shock from overages.',
      quadrant: 'Monitor (Low Risk, Low Val)',
      dominantRisk: 'Data Capping & Overage Friction',
      intervention: 'Automated notification offering upgrade to Unlimited 5G tier.',
      matcher: (r) => true, // default catch-all
    }
  ];

  // Assign each record to the first matching segment
  const segmentCounts: Record<string, { count: number; churnedCount: number; totalCharge: number; totalTenure: number; totalNps: number }> = {};
  segmentDefinitions.forEach(s => {
    segmentCounts[s.id] = { count: 0, churnedCount: 0, totalCharge: 0, totalTenure: 0, totalNps: 0 };
  });

  const assignedRecords = records.map(record => {
    let matchedDef = segmentDefinitions[3]; // default
    for (const def of segmentDefinitions) {
      if (def.matcher(record)) {
        matchedDef = def;
        break;
      }
    }

    const stats = segmentCounts[matchedDef.id];
    stats.count++;
    if (record.churnFlag === 1 || (record.churnProbability || 0) >= 0.40) stats.churnedCount++;
    stats.totalCharge += record.monthlyChargeGbp;
    stats.totalTenure += record.tenureMonths;
    stats.totalNps += record.npsScore;

    return {
      ...record,
      segmentId: matchedDef.id,
      segmentName: matchedDef.name,
    };
  });

  const segments: CustomerSegment[] = segmentDefinitions.map(def => {
    const stats = segmentCounts[def.id];
    const n = Math.max(1, stats.count);
    return {
      id: def.id,
      name: def.name,
      persona: def.persona,
      customerCount: stats.count,
      churnRate: Number((stats.churnedCount / n).toFixed(3)),
      avgMonthlyCharge: Number((stats.totalCharge / n).toFixed(2)),
      avgTenureMonths: Number((stats.totalTenure / n).toFixed(1)),
      avgNps: Number((stats.totalNps / n).toFixed(1)),
      dominantRiskFactor: def.dominantRisk,
      recommendedIntervention: def.intervention,
      matrixQuadrant: def.quadrant,
    };
  });

  return { segments, assignedRecords };
}
