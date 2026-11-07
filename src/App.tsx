import React, { useState, useEffect } from 'react';
import { RotateCw, AlertTriangle, Radio } from 'lucide-react';
import type { AppSnapshot, RiskTier } from '../shared/types.js';
import { fetchSnapshot, refreshSnapshot } from './lib/api.js';
import { Header } from './components/Header.js';

// Page Components
import { ExecutiveOverview } from './pages/ExecutiveOverview.js';
import { RiskExplorer } from './pages/RiskExplorer.js';
import { Customer360 } from './pages/Customer360.js';
import { ChurnAnalytics } from './pages/ChurnAnalytics.js';
import { Segments } from './pages/Segments.js';
import { ModelLab } from './pages/ModelLab.js';
import { WhatIfSimulator } from './pages/WhatIfSimulator.js';
import { Campaigns } from './pages/Campaigns.js';
import { AIAssistant } from './pages/AIAssistant.js';
import { Reports } from './pages/Reports.js';
import { DataHealth } from './pages/DataHealth.js';

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Navigation
  const [currentTab, setCurrentTab] = useState<string>('overview');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [explorerFilterTier, setExplorerFilterTier] = useState<RiskTier | undefined>(undefined);

  // Initial load
  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSnapshot();
      setSnapshot(data);
    } catch (err: any) {
      console.error('Snapshot load failed:', err);
      // Retry once after 2 seconds if server was warming up
      setTimeout(async () => {
        try {
          const data = await fetchSnapshot();
          setSnapshot(data);
          setError(null);
        } catch (retryErr: any) {
          setError(retryErr.message || 'Failed to connect to BritConnect data service.');
        } finally {
          setLoading(false);
        }
      }, 2000);
      return;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const updated = await refreshSnapshot();
      setSnapshot(updated);
    } catch (err: any) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleNavigateToCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCurrentTab('customer360');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateWithFilter = (tab: string, filter?: { tier?: RiskTier }) => {
    if (filter?.tier) {
      setExplorerFilterTier(filter.tier);
    } else {
      setExplorerFilterTier(undefined);
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Loading State
  if (loading && !snapshot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF6EA] p-4 text-[#0F3D2E]">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0F3D2E] text-white shadow-lg animate-pulse mb-4">
          <Radio className="h-7 w-7 text-[#E4C766]" />
        </div>
        <h2 className="font-serif text-xl font-bold tracking-tight text-[#0F3D2E]">
          BritConnect Churn Intelligence Platform
        </h2>
        <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-[#64746B]">
          <RotateCw className="h-4 w-4 animate-spin text-[#1F7A4D]" />
          <span>Synchronizing live customer database & calibrating ML models...</span>
        </div>
      </div>
    );
  }

  // Honest Error State (No fake fallback data!)
  if (error && !snapshot) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#FAF6EA] p-6 text-center">
        <div className="rounded-2xl border border-[#B5483A]/30 bg-white p-8 max-w-md shadow-xl text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#B5483A]/10 text-[#B5483A] mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="font-serif text-lg font-bold text-[#0F3D2E]">Data Connection Required</h2>
          <p className="mt-2 text-xs text-[#64746B] leading-relaxed">
            {error}
          </p>
          <p className="mt-2 text-[11px] text-[#64746B]">
            In accordance with platform governance, placeholder data is strictly prohibited. Please verify connectivity and retry.
          </p>
          <button
            onClick={loadData}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#0F3D2E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#1F7A4D]"
          >
            <RotateCw className="h-4 w-4" />
            <span>Retry Sync</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6EA] text-[#1B2A22]">
      {/* Top Header with Brand and Tab Nav */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        snapshot={snapshot}
        isRefreshing={refreshing}
        onRefresh={handleRefresh}
      />

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {snapshot && (
          <>
            {currentTab === 'overview' && (
              <ExecutiveOverview
                snapshot={snapshot}
                onNavigate={handleNavigateWithFilter}
              />
            )}

            {currentTab === 'explorer' && (
              <RiskExplorer
                snapshot={snapshot}
                onSelectCustomer={handleNavigateToCustomer}
                initialFilterTier={explorerFilterTier}
              />
            )}

            {currentTab === 'customer360' && (
              <Customer360
                snapshot={snapshot}
                selectedCustomerId={selectedCustomerId}
                onSelectCustomer={setSelectedCustomerId}
              />
            )}

            {currentTab === 'analytics' && (
              <ChurnAnalytics snapshot={snapshot} />
            )}

            {currentTab === 'segments' && (
              <Segments
                snapshot={snapshot}
                onExploreSegment={(segId) => {
                  setCurrentTab('explorer');
                }}
              />
            )}

            {currentTab === 'models' && (
              <ModelLab snapshot={snapshot} />
            )}

            {currentTab === 'simulator' && (
              <WhatIfSimulator
                snapshot={snapshot}
                onSelectCustomer={handleNavigateToCustomer}
              />
            )}

            {currentTab === 'campaigns' && (
              <Campaigns
                snapshot={snapshot}
                onRefreshCampaigns={handleRefresh}
              />
            )}

            {currentTab === 'assistant' && (
              <AIAssistant
                snapshot={snapshot}
                onSelectCustomer={handleNavigateToCustomer}
              />
            )}

            {currentTab === 'reports' && (
              <Reports snapshot={snapshot} />
            )}

            {currentTab === 'health' && (
              <DataHealth
                snapshot={snapshot}
                onRefresh={handleRefresh}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#C4BEAD]/40 bg-[#FAF6EA] py-6 text-center text-xs text-[#64746B]">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>BritConnect Telecom AI Intelligence • Confidential & Proprietary</span>
          <div className="flex items-center gap-3">
            <span>UK GDPR Compliant</span>
            <span>•</span>
            <span>Zero Target Leakage Firewall Active</span>
            <span>•</span>
            <span>Platt Calibrated</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
