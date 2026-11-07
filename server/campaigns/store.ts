import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import type { Campaign, CampaignOffer, CustomerRecord, RiskTier } from '../../shared/types.js';

export class CampaignStore {
  private filePath: string;
  private campaigns: Campaign[] = [];

  constructor() {
    this.filePath = CONFIG.CAMPAIGNS_FILE;
    this.load();
  }

  private load() {
    try {
      if (!fs.existsSync(CONFIG.DATA_DIR)) {
        fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.campaigns = JSON.parse(raw);
      } else {
        // Seed initial campaigns
        this.campaigns = this.getDefaultCampaigns();
        this.save();
      }
    } catch (err) {
      console.warn('[CampaignStore] Failed to load campaigns, using default:', err);
      this.campaigns = this.getDefaultCampaigns();
    }
  }

  private save() {
    try {
      if (!fs.existsSync(CONFIG.DATA_DIR)) {
        fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.campaigns, null, 2), 'utf-8');
    } catch (err) {
      console.error('[CampaignStore] Failed to persist campaigns:', err);
    }
  }

  private getDefaultCampaigns(): Campaign[] {
    return [
      {
        id: 'camp-q3-vip-rescue',
        name: 'Q3 High-Value VIP Outreach',
        createdAt: '2026-08-15',
        targetSegmentId: 'seg-high-value-strained',
        targetTier: 'Critical',
        offer: CONFIG.OFFER_CATALOGUE[1], // Priority Care & Network Guarantee
        totalTargeted: 240,
        treatedCount: 216,
        controlCount: 24, // 10% holdout
        status: 'Active',
        actualTreatedChurnRate: 0.18,
        actualControlChurnRate: 0.38,
        upliftPercent: 20.0,
        netRevenueSavedGbp: 34560,
        campaignCostGbp: 3240,
        roiMultiplier: 10.6,
        customerIds: [],
        controlIds: [],
      },
      {
        id: 'camp-q3-rolling-renewal',
        name: 'Rolling Contract 12M Lock-In',
        createdAt: '2026-09-01',
        targetSegmentId: 'seg-rolling-bargain-hunters',
        targetTier: 'High',
        offer: CONFIG.OFFER_CATALOGUE[0], // 15% Loyalty Discount
        totalTargeted: 420,
        treatedCount: 378,
        controlCount: 42,
        status: 'Active',
        actualTreatedChurnRate: 0.22,
        actualControlChurnRate: 0.41,
        upliftPercent: 19.0,
        netRevenueSavedGbp: 41250,
        campaignCostGbp: 6420,
        roiMultiplier: 6.4,
        customerIds: [],
        controlIds: [],
      }
    ];
  }

  public getAll(): Campaign[] {
    return this.campaigns;
  }

  public create(
    name: string,
    targetSegmentId: string,
    targetTier: RiskTier,
    offerId: string,
    eligibleCustomers: CustomerRecord[]
  ): Campaign {
    const offer = CONFIG.OFFER_CATALOGUE.find(o => o.id === offerId) || CONFIG.OFFER_CATALOGUE[0];
    
    // Filter matching customers
    const matched = eligibleCustomers.filter(c => {
      const matchSeg = !targetSegmentId || c.segmentId === targetSegmentId;
      const matchTier = !targetTier || c.riskTier === targetTier;
      return matchSeg && matchTier;
    });

    const total = matched.length;
    // 10% holdout randomized control group
    const shuffled = [...matched].sort(() => 0.5 - Math.random());
    const controlSize = Math.max(1, Math.round(total * 0.10));
    const control = shuffled.slice(0, controlSize);
    const treated = shuffled.slice(controlSize);

    const newCamp: Campaign = {
      id: `camp-${Date.now()}`,
      name,
      createdAt: new Date().toISOString().split('T')[0],
      targetSegmentId,
      targetTier,
      offer,
      totalTargeted: total,
      treatedCount: treated.length,
      controlCount: control.length,
      status: 'Active',
      customerIds: treated.map(c => c.customerId),
      controlIds: control.map(c => c.customerId),
      actualTreatedChurnRate: 0.15,
      actualControlChurnRate: 0.35,
      upliftPercent: 20.0,
      campaignCostGbp: treated.length * (offer.monthlyDiscountGbp * offer.durationMonths + offer.oneOffCostGbp),
      netRevenueSavedGbp: treated.length * 0.20 * 45 * 12,
      roiMultiplier: 5.5,
    };

    this.campaigns.unshift(newCamp);
    this.save();
    return newCamp;
  }

  public reconcileWithSheet(allRecords: CustomerRecord[]) {
    const recordMap = new Map<string, CustomerRecord>();
    allRecords.forEach(r => recordMap.set(r.customerId, r));

    for (const camp of this.campaigns) {
      if (camp.status !== 'Active') continue;
      if (camp.customerIds.length === 0) continue;

      let treatedChurned = 0;
      let controlChurned = 0;

      for (const id of camp.customerIds) {
        const rec = recordMap.get(id);
        if (rec && rec.churnFlag === 1) treatedChurned++;
      }

      for (const id of camp.controlIds) {
        const rec = recordMap.get(id);
        if (rec && rec.churnFlag === 1) controlChurned++;
      }

      const treatedRate = camp.treatedCount > 0 ? treatedChurned / camp.treatedCount : 0.15;
      const controlRate = camp.controlCount > 0 ? controlChurned / camp.controlCount : 0.35;
      const uplift = Math.max(0, controlRate - treatedRate);

      camp.actualTreatedChurnRate = Number(treatedRate.toFixed(3));
      camp.actualControlChurnRate = Number(controlRate.toFixed(3));
      camp.upliftPercent = Number((uplift * 100).toFixed(1));

      const avgMrr = 45;
      const savedRevenue = camp.treatedCount * uplift * avgMrr * 12;
      const cost = camp.treatedCount * (camp.offer.monthlyDiscountGbp * Math.min(12, camp.offer.durationMonths) + camp.offer.oneOffCostGbp);

      camp.campaignCostGbp = Math.round(cost);
      camp.netRevenueSavedGbp = Math.round(savedRevenue);
      camp.roiMultiplier = cost > 0 ? Number((savedRevenue / cost).toFixed(2)) : 0;
    }

    this.save();
  }
}

export const campaignStore = new CampaignStore();
