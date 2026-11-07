import React from 'react';
import {
  RotateCw,
  ShieldCheck,
  Radio,
  BarChart3,
  Users,
  Search,
  Sliders,
  Sparkles,
  FileSpreadsheet,
  BrainCircuit,
  PieChart,
  Activity
} from 'lucide-react';
import type { AppSnapshot } from '../../shared/types.js';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  snapshot: AppSnapshot | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  snapshot,
  isRefreshing,
  onRefresh,
}) => {
  const tabs = [
    { id: 'overview', label: 'Executive Overview', icon: BarChart3 },
    { id: 'explorer', label: 'Risk Explorer', icon: Search },
    { id: 'customer360', label: 'Customer 360', icon: Users },
    { id: 'analytics', label: 'Churn Analytics', icon: PieChart },
    { id: 'segments', label: 'Segments', icon: Users },
    { id: 'models', label: 'Model Lab', icon: BrainCircuit },
    { id: 'simulator', label: 'What-If Simulator', icon: Sliders },
    { id: 'campaigns', label: 'Campaigns', icon: Radio },
    { id: 'assistant', label: 'AI Assistant', icon: Sparkles },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'health', label: 'Data Health', icon: Activity },
  ];

  const formatTime = (ts?: string) => {
    if (!ts) return 'Just now';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#C4BEAD]/50 bg-[#0F3D2E] text-[#FAF6EA] shadow-md">
      {/* Top Banner with Brand and Controls */}
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F7A4D] border border-[#A8C3A0]/40 shadow-sm">
            <Radio className="h-5 w-5 text-[#E4C766]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl font-bold tracking-tight text-[#FAF6EA]">
                BritConnect
              </span>
              <span className="rounded bg-[#A8C3A0]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#A8C3A0] border border-[#A8C3A0]/30">
                UK Telecom AI
              </span>
            </div>
            <p className="text-xs text-[#FAF6EA]/70">
              Customer Churn Intelligence & Retention Platform
            </p>
          </div>
        </div>

        {/* Data Status and Single-flight Refresh Button */}
        <div className="flex items-center gap-3">
          {snapshot && (
            <button
              onClick={() => onSelectTab('health')}
              className="hidden items-center gap-1.5 rounded-lg border border-[#A8C3A0]/30 bg-[#1B2A22]/60 px-3 py-1.5 text-xs text-[#A8C3A0] hover:bg-[#1B2A22] transition-colors md:flex"
              title="Click to view full Data Health & Audit Report"
            >
              <ShieldCheck className="h-4 w-4 text-[#A8C3A0]" />
              <span className="font-mono font-medium">
                {snapshot.dataQuality.validRows.toLocaleString()} Active Records
              </span>
              <span className="text-[#A8C3A0]/50">•</span>
              <span className="text-[#E4C766]">0 Target Leakage</span>
            </button>
          )}

          <div className="hidden flex-col items-end text-xs text-[#FAF6EA]/60 lg:flex">
            <span>Live Sheet Synced</span>
            <span className="font-mono text-[#FAF6EA]/90">{formatTime(snapshot?.timestamp)}</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 rounded-lg border border-[#E4C766]/50 bg-[#C9A227] px-3.5 py-2 text-xs font-bold text-[#0F3D2E] shadow-sm transition-all hover:bg-[#E4C766] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60`}
            title="Trigger single-flight re-ingestion, leakage audit and ML recalibration"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Re-Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="overflow-x-auto border-t border-[#1B2A22] bg-[#0A291F] px-4 sm:px-6">
        <div className="mx-auto flex max-w-7xl space-x-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-[#E4C766] text-[#E4C766] bg-[#0F3D2E]/60'
                    : 'border-transparent text-[#FAF6EA]/70 hover:border-[#A8C3A0]/40 hover:text-[#FAF6EA]'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#E4C766]' : 'text-[#A8C3A0]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
};
