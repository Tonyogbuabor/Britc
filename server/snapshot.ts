import fs from 'fs';
import { CONFIG } from './config.js';
import type { AppSnapshot, ExecutiveKPIs, CustomerRecord } from '../shared/types.js';
import { fetchLiveSheet } from './sheets/reader.js';
import { cleanAndValidateDataset } from './pipeline/cleaner.js';
import { runLeakageAudit } from './pipeline/firewall.js';
import { trainAndEvaluateAllModels } from './ml/algorithms.js';
import { segmentCustomers } from './segments/clustering.js';
import { campaignStore } from './campaigns/store.js';

class SnapshotManager {
  private currentSnapshot: AppSnapshot | null = null;
  private inFlightRefreshPromise: Promise<AppSnapshot> | null = null;
  private refreshListeners: Array<(status: string) => void> = [];

  public getSnapshot(): AppSnapshot {
    if (!this.currentSnapshot) {
      throw new Error('Snapshot not yet initialized. Please wait or trigger a refresh.');
    }
    return this.currentSnapshot;
  }

  public isInitialized(): boolean {
    return this.currentSnapshot !== null;
  }

  public onProgress(listener: (status: string) => void) {
    this.refreshListeners.push(listener);
    return () => {
      this.refreshListeners = this.refreshListeners.filter(l => l !== listener);
    };
  }

  private notifyProgress(msg: string) {
    this.refreshListeners.forEach(l => {
      try { l(msg); } catch (e) { /* ignore */ }
    });
  }

  public async refresh(force = false): Promise<AppSnapshot> {
    // Single-flight locking: if a refresh is already running, return the ongoing promise
    if (this.inFlightRefreshPromise) {
      return this.inFlightRefreshPromise;
    }

    this.inFlightRefreshPromise = (async () => {
      try {
        console.log('[SnapshotManager] Starting atomic snapshot refresh...');
        this.notifyProgress('Connecting to Google Sheet source...');

        // 1. Fetch raw rows
        const sheetResult = await fetchLiveSheet();
        this.notifyProgress(`Received ${sheetResult.rows.length} rows from ${sheetResult.source}. Validating data quality...`);

        // 2. Clean and validate dataset
        const { cleanRecords, qualityReport } = cleanAndValidateDataset(
          sheetResult.rows,
          sheetResult.source,
          sheetResult.contentHash
        );
        this.notifyProgress(`Validated ${cleanRecords.length} records. Auditing leakage firewall...`);

        // 3. Run Leakage Audit
        const leakageAudit = runLeakageAudit(cleanRecords);
        this.notifyProgress('Firewall verified. Training machine learning models & computing SHAP...');

        // 4. Train ML Models, calibrate probabilities, compute SHAP & fairness audit
        const { comparison, fairness, scoredActiveRecords } = trainAndEvaluateAllModels(cleanRecords);
        this.notifyProgress('Models trained. Segmenting customer base into archetypes...');

        // Create unified record list with scored active customers + historical churned records
        const activeMap = new Map<string, CustomerRecord>();
        scoredActiveRecords.forEach(r => activeMap.set(r.customerId, r));
        const allRecords = cleanRecords.map(r => activeMap.get(r.customerId) || r);

        // 5. Customer Segmentation
        const { segments, assignedRecords } = segmentCustomers(allRecords);
        const finalActiveCustomers = assignedRecords.filter(r => r.churnStatus === 'Active');

        // 6. Campaign Reconciliation
        this.notifyProgress('Reconciling active retention campaigns...');
        campaignStore.reconcileWithSheet(assignedRecords);
        const campaigns = campaignStore.getAll();

        // 7. Calculate Executive KPIs
        const totalCustomers = assignedRecords.length;
        const activeCount = finalActiveCustomers.length;
        const churnedCount = totalCustomers - activeCount;
        const baselineChurnRate = totalCustomers > 0 ? churnedCount / totalCustomers : 0;

        // Risk distribution among active customers
        let criticalCount = 0, criticalMrr = 0;
        let highCount = 0, highMrr = 0;
        let mediumCount = 0, mediumMrr = 0;
        let lowCount = 0, lowMrr = 0;

        let totalActiveMrr = 0;
        let expectedMonthlyLoss = 0;
        let sumTenure = 0;
        let sumNps = 0;
        let sumSat = 0;

        for (const c of finalActiveCustomers) {
          totalActiveMrr += c.monthlyChargeGbp;
          expectedMonthlyLoss += c.monthlyChargeGbp * (c.churnProbability || 0);
          sumTenure += c.tenureMonths;
          sumNps += c.npsScore;
          sumSat += c.satisfactionScore;

          if (c.riskTier === 'Critical') {
            criticalCount++;
            criticalMrr += c.monthlyChargeGbp;
          } else if (c.riskTier === 'High') {
            highCount++;
            highMrr += c.monthlyChargeGbp;
          } else if (c.riskTier === 'Medium') {
            mediumCount++;
            mediumMrr += c.monthlyChargeGbp;
          } else {
            lowCount++;
            lowMrr += c.monthlyChargeGbp;
          }
        }

        const totalMrrAtRisk = criticalMrr + highMrr;
        const totalProtectedRev = campaigns.reduce((acc, c) => acc + (c.netRevenueSavedGbp || 0), 0);

        // Monthly churn trend from churn dates
        const monthCounts: Record<string, { count: number; mrr: number }> = {};
        for (const r of assignedRecords) {
          if (r.churnStatus === 'Churned' && r.churnDate) {
            const m = r.churnDate.substring(0, 7); // YYYY-MM
            if (!monthCounts[m]) monthCounts[m] = { count: 0, mrr: 0 };
            monthCounts[m].count++;
            monthCounts[m].mrr += r.monthlyChargeGbp;
          }
        }

        const sortedMonths = Object.keys(monthCounts).sort().slice(-8);
        const monthlyChurnTrend = sortedMonths.map(m => ({
          month: m,
          churnCount: monthCounts[m].count,
          churnRate: Number((monthCounts[m].count / Math.max(1, activeCount) * 100).toFixed(2)),
          mrrLost: Math.round(monthCounts[m].mrr),
        }));

        const kpis: ExecutiveKPIs = {
          totalCustomers,
          activeCustomers: activeCount,
          churnedCustomers: churnedCount,
          baselineChurnRate: Number(baselineChurnRate.toFixed(4)),
          monthlyChurnRate: monthlyChurnTrend.length > 0
            ? Number((monthlyChurnTrend[monthlyChurnTrend.length - 1].churnRate / 100).toFixed(4))
            : 0.024,
          totalMrrAtRisk: Math.round(totalMrrAtRisk),
          expectedMonthlyChurnLossGbp: Math.round(expectedMonthlyLoss),
          totalProtectedRevenueGbp: Math.round(totalProtectedRev),
          avgCustomerTenureMonths: Number((sumTenure / Math.max(1, activeCount)).toFixed(1)),
          avgNpsScore: Number((sumNps / Math.max(1, activeCount)).toFixed(1)),
          avgSatisfactionScore: Number((sumSat / Math.max(1, activeCount)).toFixed(1)),
          riskDistribution: {
            critical: { count: criticalCount, mrr: Math.round(criticalMrr), percentage: Number((criticalCount / Math.max(1, activeCount) * 100).toFixed(1)) },
            high: { count: highCount, mrr: Math.round(highMrr), percentage: Number((highCount / Math.max(1, activeCount) * 100).toFixed(1)) },
            medium: { count: mediumCount, mrr: Math.round(mediumMrr), percentage: Number((mediumCount / Math.max(1, activeCount) * 100).toFixed(1)) },
            low: { count: lowCount, mrr: Math.round(lowMrr), percentage: Number((lowCount / Math.max(1, activeCount) * 100).toFixed(1)) },
          },
          monthlyChurnTrend,
        };

        const newSnapshot: AppSnapshot = {
          timestamp: new Date().toISOString(),
          version: `snap-${Date.now()}`,
          dataQuality: qualityReport,
          kpis,
          customers: assignedRecords,
          activeCustomers: finalActiveCustomers,
          models: comparison,
          fairness,
          leakageAudit,
          segments,
          campaigns,
        };

        // Cache snapshot to disk
        try {
          if (!fs.existsSync(CONFIG.DATA_DIR)) {
            fs.mkdirSync(CONFIG.DATA_DIR, { recursive: true });
          }
          fs.writeFileSync(
            CONFIG.SNAPSHOT_CACHE_FILE,
            JSON.stringify({
              rawRows: sheetResult.rows,
              headers: sheetResult.headers,
              source: sheetResult.source,
              contentHash: sheetResult.contentHash,
              timestamp: newSnapshot.timestamp,
            }),
            'utf-8'
          );
        } catch (e) {
          console.warn('[SnapshotManager] Failed to cache snapshot to disk:', e);
        }

        this.currentSnapshot = newSnapshot;
        this.notifyProgress('Snapshot ready.');
        console.log(`[SnapshotManager] Refresh completed: ${activeCount} active, ${churnedCount} churned. MRR at risk: £${totalMrrAtRisk}`);
        return newSnapshot;
      } finally {
        this.inFlightRefreshPromise = null;
      }
    })();

    return this.inFlightRefreshPromise;
  }
}

export const snapshotManager = new SnapshotManager();
