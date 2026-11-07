import { GoogleGenAI, Type, Schema } from '@google/genai';
import { CONFIG } from '../config.js';
import type { CustomerRecord, RetentionPlanAI } from '../../shared/types.js';

export async function generatePersonalizedRetentionPlan(record: CustomerRecord): Promise<RetentionPlanAI> {
  const apiKey = CONFIG.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });

      const topDriversSummary = (record.topDrivers || [])
        .map(d => `- ${d.featureName}: ${d.valStr} (Impact: ${d.direction}s risk by ${Math.abs(d.contribution)})`)
        .join('\n');

      const prompt = `
You are the Chief Customer Retention Officer at BritConnect, a major UK telecom provider.
Synthesize an executive-ready, highly tailored customer retention intervention plan.

CUSTOMER TELECOM DOSSIER:
- Customer ID: ${record.customerId}
- Segment: ${record.customerSegment}
- Service Type: ${record.serviceType} (${record.planName})
- Contract Type: ${record.contractType} (Auto-Renew: ${record.autoRenew ? 'Yes' : 'No'})
- Monthly Spend: £${record.monthlyChargeGbp.toFixed(2)}
- Current Discount: ${record.discountPercent}%
- Payment Method: ${record.paymentMethod} (Direct Debit: ${record.directDebit ? 'Yes' : 'No'})
- Payment Friction: ${record.latePayments12M} late, ${record.failedPayments12M} failed in 12M
- Experience: ${record.supportTickets12M} support tickets, ${record.complaints12M} complaints, ${record.networkOutages12M} outages
- Customer Sentiment: NPS ${record.npsScore} / 100, Satisfaction ${record.satisfactionScore} / 10
- Competitor Offer Active: ${record.competitorOfferReceived ? 'Yes' : 'No'}
- Predicted Churn Probability: ${((record.churnProbability || 0.4) * 100).toFixed(1)}% (${record.riskTier || 'High'} Risk)

KEY MODEL RISK DRIVERS (SHAP):
${topDriversSummary || 'Recent service dissatisfaction and competitive pricing comparison.'}

CRITICAL UK REGULATORY & FAIRNESS MANDATE:
Do NOT mention or offer based on Age or Gender. Ground your strategy solely on service stability, contract commitment, usage allowance, and commercial value.

Return your response strictly adhering to JSON format:
{
  "customerSummary": "Brief executive diagnosis of the customer situation and primary churn risk triggers.",
  "riskCategory": "${record.riskTier || 'High'}",
  "rootCauses": ["Root cause 1", "Root cause 2", "Root cause 3"],
  "recommendedOffer": {
    "title": "Clear commercial title for the retention offer",
    "monthlyDiscountGbp": 5.0,
    "termMonths": 12,
    "rationale": "Commercial justification for this offer tier"
  },
  "communicationChannel": "Phone Call",
  "scriptTalkingPoints": [
    "Acknowledge specific issues (e.g., outages or complaints)",
    "Present tailored value proposition",
    "Close with contract extension incentive"
  ],
  "projectedChurnReductionPct": 35,
  "expectedAnnualRoiGbp": 240.0,
  "urgency": "Immediate (24h)"
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        }
      });

      const text = response.text || '';
      const parsed = JSON.parse(text);

      return {
        customerId: record.customerId,
        customerSummary: parsed.customerSummary || `Customer ${record.customerId} flagged with elevated churn probability.`,
        riskCategory: record.riskTier || parsed.riskCategory || 'High',
        rootCauses: Array.isArray(parsed.rootCauses) ? parsed.rootCauses : ['Contract expiration risk', 'Competitor market comparison'],
        recommendedOffer: {
          title: parsed.recommendedOffer?.title || '15% Loyalty Renewal Package',
          monthlyDiscountGbp: Number(parsed.recommendedOffer?.monthlyDiscountGbp) || 5.0,
          termMonths: Number(parsed.recommendedOffer?.termMonths) || 12,
          rationale: parsed.recommendedOffer?.rationale || 'Incentivize 12-month re-commitment to protect annual revenue.'
        },
        communicationChannel: parsed.communicationChannel || (record.monthlyChargeGbp > 50 ? 'Phone Call' : 'Personal Email'),
        scriptTalkingPoints: Array.isArray(parsed.scriptTalkingPoints) ? parsed.scriptTalkingPoints : [
          'Acknowledge recent service interactions and confirm full resolution.',
          'Present priority loyalty renewal tariff with price protection.',
          'Activate immediate account credit as a token of appreciation.'
        ],
        projectedChurnReductionPct: Number(parsed.projectedChurnReductionPct) || 30,
        expectedAnnualRoiGbp: Number(parsed.expectedAnnualRoiGbp) || Math.round(record.monthlyChargeGbp * 12 * 0.3),
        urgency: parsed.urgency || (record.riskTier === 'Critical' ? 'Immediate (24h)' : 'High (48h)'),
      };
    } catch (err: any) {
      console.warn('[GeminiRecommend] Gemini API call failed or quota exceeded, using rule fallback:', err?.message || err);
    }
  }

  // High-fidelity fallback rule engine
  return generateRuleBasedRetentionPlan(record);
}

function generateRuleBasedRetentionPlan(record: CustomerRecord): RetentionPlanAI {
  const isHighSpend = record.monthlyChargeGbp >= 45;
  const hasOutagesOrComplaints = record.networkOutages12M >= 2 || record.complaints12M > 0;
  const isRolling = record.contractType === 'Rolling Monthly';

  let offerTitle = '15% Loyalty Contract Re-commit';
  let discountGbp = Number((record.monthlyChargeGbp * 0.15).toFixed(2));
  let termMonths = 12;
  let channel: RetentionPlanAI['communicationChannel'] = isHighSpend ? 'Phone Call' : 'Personal Email';
  let urgency: RetentionPlanAI['urgency'] = record.riskTier === 'Critical' ? 'Immediate (24h)' : 'High (48h)';

  const rootCauses: string[] = [];
  if (isRolling) rootCauses.push('Rolling contract offers zero switching barrier to competitor poaching.');
  if (hasOutagesOrComplaints) rootCauses.push(`Experienced ${record.networkOutages12M} network outages and ${record.complaints12M} formal complaints.`);
  if (record.competitorOfferReceived) rootCauses.push('Customer has actively received and reviewed competing telecom tariffs.');
  if (record.npsScore < 0) rootCauses.push(`Negative sentiment detected (NPS index: ${record.npsScore}).`);
  if (rootCauses.length === 0) rootCauses.push('High monthly spend with expiring initial promotion.');

  if (hasOutagesOrComplaints && isHighSpend) {
    offerTitle = 'Executive VIP Care & £15 Network Guarantee';
    discountGbp = 6.0;
    termMonths = 12;
    channel = 'Account Manager';
  } else if (record.competitorOfferReceived) {
    offerTitle = 'Price-Match Guarantee & Speed Boost';
    discountGbp = 7.50;
    termMonths = 12;
    channel = 'Phone Call';
  }

  const expectedSaved = Math.round(record.monthlyChargeGbp * 12 * 0.35);

  return {
    customerId: record.customerId,
    customerSummary: `Customer ${record.customerId} is currently on ${record.serviceType} paying £${record.monthlyChargeGbp.toFixed(2)}/mo. Churn risk is ${record.riskTier || 'High'} driven by ${isRolling ? 'contract flexibility' : 'service friction'}.`,
    riskCategory: record.riskTier || 'High',
    rootCauses,
    recommendedOffer: {
      title: offerTitle,
      monthlyDiscountGbp: discountGbp,
      termMonths,
      rationale: `Secures a ${termMonths}-month renewal commitment, protecting £${(record.monthlyChargeGbp * 12).toFixed(2)} in annual recurring revenue.`,
    },
    communicationChannel: channel,
    scriptTalkingPoints: [
      `Acknowledge customer's ${record.tenureMonths}-month relationship with BritConnect.`,
      hasOutagesOrComplaints
        ? `Apologize for recent network stability issues and confirm recent infrastructure upgrades.`
        : `Highlight exclusive loyalty pricing available before market contract indexation.`,
      `Offer ${offerTitle} (£${discountGbp}/mo reduction) conditional upon a ${termMonths}-month renewal.`,
      `Offer immediate setup of Direct Debit guarantee for additional bill peace of mind.`
    ],
    projectedChurnReductionPct: 35,
    expectedAnnualRoiGbp: expectedSaved,
    urgency,
  };
}
