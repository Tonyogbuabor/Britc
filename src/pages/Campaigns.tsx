import React, { useState } from 'react';
import { Radio, Plus, CheckCircle2, TrendingUp, Users, ShieldAlert, Award } from 'lucide-react';
import type { AppSnapshot, Campaign } from '../../shared/types.js';
import { createCampaign } from '../lib/api.js';
import { OFFER_CATALOGUE } from '../../shared/constants.js';

interface CampaignsProps {
  snapshot: AppSnapshot;
  onRefreshCampaigns: () => void;
}

export const Campaigns: React.FC<CampaignsProps> = ({ snapshot, onRefreshCampaigns }) => {
  const { campaigns, segments, activeCustomers } = snapshot;

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [targetSegmentId, setTargetSegmentId] = useState(segments[0]?.id || '');
  const [targetTier, setTargetTier] = useState('Critical');
  const [offerId, setOfferId] = useState(OFFER_CATALOGUE[0].id);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await createCampaign({
        name,
        targetSegmentId,
        targetTier,
        offerId,
      });
      setShowModal(false);
      setName('');
      onRefreshCampaigns();
    } catch (err) {
      console.error('Failed to create campaign:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Create Button */}
      <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#C4BEAD]/40 bg-[#FAF6EA] p-6 shadow-sm sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[#0F3D2E]">
            Retention Campaign Tracker & Holdout Uplift
          </h1>
          <p className="mt-1 text-xs text-[#64746B] max-w-3xl">
            Gold-standard causal incrementality measurement. Every campaign automatically enforces an un-contacted 10% randomized holdout control group to prove true incremental revenue saved.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0F3D2E] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#1F7A4D] transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Launch Retention Campaign</span>
        </button>
      </div>

      {/* Campaign List */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {campaigns.map(camp => (
          <div
            key={camp.id}
            className="rounded-xl border border-[#C4BEAD]/40 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="rounded bg-[#1F7A4D]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#1F7A4D]">
                  {camp.status} • 10% Control Holdout Active
                </span>
                <h3 className="font-serif text-lg font-bold text-[#0F3D2E] mt-1">{camp.name}</h3>
                <p className="text-xs text-[#64746B]">Initiated {camp.createdAt} • Target: {camp.targetTier} Tier</p>
              </div>

              <div className="text-right">
                <span className="font-mono text-xl font-bold text-[#0F3D2E]">
                  {camp.roiMultiplier}x
                </span>
                <div className="text-[10px] font-semibold text-[#1F7A4D]">Causal Net ROI</div>
              </div>
            </div>

            {/* Offer details */}
            <div className="rounded-lg bg-[#FAF6EA] p-3 text-xs border border-[#C4BEAD]/20">
              <span className="font-bold text-[#0F3D2E]">Applied Offer: </span>
              <span className="text-[#1B2A22]">{camp.offer.name}</span>
              <p className="mt-0.5 text-[11px] text-[#64746B]">{camp.offer.description}</p>
            </div>

            {/* Holdout experiment statistics */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-[#FAF6EA] p-2.5">
                <span className="text-[10px] text-[#64746B] block">Treated Group</span>
                <span className="font-mono font-bold text-[#0F3D2E]">{camp.treatedCount} subs</span>
                <span className="text-[10px] font-semibold text-[#1F7A4D] block mt-0.5">
                  {((camp.actualTreatedChurnRate || 0.15) * 100).toFixed(1)}% Churn
                </span>
              </div>

              <div className="rounded-lg bg-[#FAF6EA] p-2.5">
                <span className="text-[10px] text-[#64746B] block">10% Control Holdout</span>
                <span className="font-mono font-bold text-[#64746B]">{camp.controlCount} subs</span>
                <span className="text-[10px] font-semibold text-[#B5483A] block mt-0.5">
                  {((camp.actualControlChurnRate || 0.35) * 100).toFixed(1)}% Churn
                </span>
              </div>

              <div className="rounded-lg bg-[#0F3D2E] p-2.5 text-white">
                <span className="text-[10px] text-[#A8C3A0] block">Incremental Uplift</span>
                <span className="font-mono font-bold text-[#E4C766]">+{camp.upliftPercent}%</span>
                <span className="text-[10px] text-white/70 block mt-0.5">Saved Churners</span>
              </div>
            </div>

            {/* Financial ledger */}
            <div className="flex items-center justify-between border-t border-[#C4BEAD]/30 pt-3 text-xs">
              <div>
                <span className="text-[#64746B]">Campaign Spend: </span>
                <span className="font-mono font-bold text-[#B5483A]">£{camp.campaignCostGbp?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-[#64746B]">Net Annual Saved: </span>
                <span className="font-mono font-bold text-[#1F7A4D]">£{camp.netRevenueSavedGbp?.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Creating Campaign */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#C4BEAD]/50 bg-white p-6 shadow-2xl">
            <h3 className="font-serif text-lg font-bold text-[#0F3D2E]">Launch Retention Campaign</h3>
            <p className="text-xs text-[#64746B] mt-0.5 mb-4">
              A 10% un-contacted holdout control group will be automatically partitioned for causal evaluation.
            </p>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-[#1B2A22]">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Executive Fiber Retention"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#C4BEAD]/60 p-2 text-xs focus:border-[#0F3D2E] focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-[#1B2A22]">Target Segment</label>
                <select
                  value={targetSegmentId}
                  onChange={e => setTargetSegmentId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#C4BEAD]/60 p-2 text-xs focus:border-[#0F3D2E] focus:outline-none"
                >
                  {segments.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.customerCount} subs)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-[#1B2A22]">Target Risk Tier</label>
                <select
                  value={targetTier}
                  onChange={e => setTargetTier(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#C4BEAD]/60 p-2 text-xs focus:border-[#0F3D2E] focus:outline-none"
                >
                  <option value="Critical">Critical Risk (65%+)</option>
                  <option value="High">High Risk (40% - 64%)</option>
                  <option value="Medium">Medium Risk (20% - 39%)</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#1B2A22]">Commercial Offer</label>
                <select
                  value={offerId}
                  onChange={e => setOfferId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#C4BEAD]/60 p-2 text-xs focus:border-[#0F3D2E] focus:outline-none"
                >
                  {OFFER_CATALOGUE.map(o => (
                    <option key={o.id} value={o.id}>{o.name} (-£{o.monthlyDiscountGbp}/mo)</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#C4BEAD]/30">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-[#C4BEAD]/60 px-3 py-1.5 text-xs font-semibold text-[#1B2A22] hover:bg-[#FAF6EA]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-[#0F3D2E] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#1F7A4D] disabled:opacity-60"
                >
                  {creating ? 'Deploying...' : 'Deploy Campaign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
