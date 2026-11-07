import { GoogleGenAI } from '@google/genai';
import { CONFIG } from '../config.js';
import type { AppSnapshot, CustomerRecord } from '../../shared/types.js';

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

export async function processChatQuery(
  snapshot: AppSnapshot,
  query: string,
  history: ChatMessage[]
): Promise<ChatMessage> {
  const queryLower = query.toLowerCase().trim();
  const toolCalls: ChatMessage['toolCalls'] = [];

  // 1. Tool implementations over in-memory snapshot
  const tools = {
    getCustomer: (customerId: string) => {
      const match = snapshot.customers.find(
        c => c.customerId.toLowerCase() === customerId.toLowerCase()
      );
      if (!match) return { error: `Customer '${customerId}' not found.` };
      return {
        customerId: match.customerId,
        segment: match.customerSegment,
        serviceType: match.serviceType,
        plan: match.planName,
        contractType: match.contractType,
        monthlyCharge: `£${match.monthlyChargeGbp.toFixed(2)}`,
        tenureMonths: match.tenureMonths,
        churnProbability: `${((match.churnProbability || 0) * 100).toFixed(1)}%`,
        riskTier: match.riskTier || 'Low',
        topDrivers: match.topDrivers || [],
        npsScore: match.npsScore,
        complaints: match.complaints12M,
        outages: match.networkOutages12M,
      };
    },

    getTopAtRisk: (limit = 5) => {
      const active = [...snapshot.activeCustomers]
        .sort((a, b) => (b.churnProbability || 0) * b.monthlyChargeGbp - (a.churnProbability || 0) * a.monthlyChargeGbp)
        .slice(0, limit)
        .map(c => ({
          customerId: c.customerId,
          monthlyCharge: `£${c.monthlyChargeGbp.toFixed(2)}`,
          serviceType: c.serviceType,
          contractType: c.contractType,
          churnProbability: `${((c.churnProbability || 0) * 100).toFixed(1)}%`,
          riskTier: c.riskTier,
          expectedLoss: `£${((c.churnProbability || 0) * c.monthlyChargeGbp).toFixed(2)}/mo`,
        }));
      return active;
    },

    getOverviewKPIs: () => {
      return {
        totalCustomers: snapshot.kpis.totalCustomers,
        activeSubscribers: snapshot.kpis.activeCustomers,
        monthlyChurnRate: `${(snapshot.kpis.monthlyChurnRate * 100).toFixed(2)}%`,
        totalMrrAtRisk: `£${snapshot.kpis.totalMrrAtRisk.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
        expectedMonthlyLoss: `£${snapshot.kpis.expectedMonthlyChurnLossGbp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
        revenueProtected: `£${snapshot.kpis.totalProtectedRevenueGbp.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
        avgNps: snapshot.kpis.avgNpsScore.toFixed(1),
        modelChampion: snapshot.models.activeModel,
        championAuc: snapshot.models[snapshot.models.activeModel].rocAuc,
      };
    },

    getSegments: () => {
      return snapshot.segments.map(s => ({
        id: s.id,
        name: s.name,
        customerCount: s.customerCount,
        churnRate: `${(s.churnRate * 100).toFixed(1)}%`,
        avgSpend: `£${s.avgMonthlyCharge.toFixed(2)}`,
        quadrant: s.matrixQuadrant,
        intervention: s.recommendedIntervention,
      }));
    }
  };

  // Check if query is looking for a specific Customer ID (e.g. BCT-000001)
  const idMatch = query.match(/BCT-\d{6}/i);
  if (idMatch) {
    const custId = idMatch[0].toUpperCase();
    const custData = tools.getCustomer(custId);
    toolCalls.push({
      toolName: 'getCustomer',
      params: { customerId: custId },
      result: custData,
    });

    if ('error' in custData) {
      return {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: `I searched the live customer registry for **${custId}**, but no record was found. Please check the identifier.`,
        timestamp: new Date().toISOString(),
        toolCalls,
      };
    }

    const text = `### Customer Dossier: ${custData.customerId}
- **Segment / Plan:** ${custData.segment} | ${custData.serviceType} (${custData.plan})
- **Contract:** ${custData.contractType} (${custData.tenureMonths} months tenure)
- **Monthly Spend:** ${custData.monthlyCharge}
- **Model Assessment:** **${custData.riskTier} Risk** (Calibrated P(churn): **${custData.churnProbability}**)
- **Sentiment & Quality:** NPS ${custData.npsScore}, ${custData.complaints} complaints, ${custData.outages} outages

**Primary Model Risk Drivers:**
${(custData.topDrivers || []).map((d: any) => `• **${d.featureName}** (${d.valStr}): pushes risk ${d.direction} by ${(d.contribution * 100).toFixed(1)}%`).join('\n')}

**Recommended Action:** Navigate to the Customer 360 tab for ${custData.customerId} to simulate retention levers or generate a Gemini AI retention brief.`;

    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text,
      timestamp: new Date().toISOString(),
      toolCalls,
    };
  }

  // Check if query asks for top at-risk accounts or high risk
  if (queryLower.includes('at risk') || queryLower.includes('highest risk') || queryLower.includes('top risk') || queryLower.includes('who is churning')) {
    const atRisk = tools.getTopAtRisk(5);
    toolCalls.push({
      toolName: 'getTopAtRisk',
      params: { limit: 5 },
      result: atRisk,
    });

    let text = `Here are the top active subscribers ranked by total monthly revenue at risk:\n\n`;
    text += `| Customer ID | Monthly Bill | Plan Type | Contract | P(Churn) | Expected Loss |\n`;
    text += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    atRisk.forEach(r => {
      text += `| **${r.customerId}** | ${r.monthlyCharge} | ${r.serviceType} | ${r.contractType} | **${r.churnProbability}** | ${r.expectedLoss} |\n`;
    });
    text += `\n*Tip: You can query any of these Customer IDs directly (e.g. "${atRisk[0]?.customerId || 'BCT-000001'}") to inspect their full SHAP waterfall.*`;

    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text,
      timestamp: new Date().toISOString(),
      toolCalls,
    };
  }

  // Check if query asks for segments or cohorts
  if (queryLower.includes('segment') || queryLower.includes('persona') || queryLower.includes('quadrant')) {
    const segs = tools.getSegments();
    toolCalls.push({
      toolName: 'getSegments',
      params: {},
      result: segs,
    });

    let text = `BritConnect currently tracks 4 behavioral customer archetypes:\n\n`;
    segs.forEach(s => {
      text += `#### ${s.name} (${s.quadrant})\n`;
      text += `- **Subscribers:** ${s.customerCount.toLocaleString()} | **Churn Rate:** ${s.churnRate} | **Avg Spend:** ${s.avgSpend}/mo\n`;
      text += `- **Strategy:** ${s.intervention}\n\n`;
    });

    return {
      id: `msg-${Date.now()}`,
      sender: 'assistant',
      text,
      timestamp: new Date().toISOString(),
      toolCalls,
    };
  }

  // Default: Overview KPIs and financial summary
  const kpis = tools.getOverviewKPIs();
  toolCalls.push({
    toolName: 'getOverviewKPIs',
    params: {},
    result: kpis,
  });

  const text = `### BritConnect Platform Financial Summary
- **Active Customer Base:** ${kpis.activeSubscribers.toLocaleString()} subscribers
- **Monthly Churn Rate:** **${kpis.monthlyChurnRate}**
- **Total MRR at Risk (High + Critical):** **${kpis.totalMrrAtRisk}**
- **Expected Monthly Churn Loss:** **${kpis.expectedMonthlyLoss}**
- **Net Revenue Protected:** **${kpis.revenueProtected}**
- **Active ML Model:** ${kpis.modelChampion.toUpperCase()} (Validation ROC-AUC: **${kpis.championAuc}**)

How can I assist you further? You can ask me to:
1. "Show top at-risk accounts"
2. "Analyze Customer BCT-000001"
3. "Summarize customer segments and interventions"
4. "What is our disparate impact fairness rating?"`;

  return {
    id: `msg-${Date.now()}`,
    sender: 'assistant',
    text,
    timestamp: new Date().toISOString(),
    toolCalls,
  };
}
