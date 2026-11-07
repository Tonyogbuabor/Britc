import React from 'react';
import { Users, ShieldAlert, ArrowRight, Zap, Target } from 'lucide-react';
import type { AppSnapshot, CustomerSegment } from '../../shared/types.js';

interface SegmentsProps {
  snapshot: AppSnapshot;
  onExploreSegment: (segmentId: string) => void;
}

export const Segments: React.FC<SegmentsProps> = ({ snapshot, onExploreSegment }) => {
  const { segments } = snapshot;

  const quadrants: Array<{
    title: string;
    subtitle: string;
    bg: string;
    border: string;
    match: string;
  }> = [
    { title: 'Protect Quadrant', subtitle: 'High Value • High Churn Risk (Primary MRR Danger)', bg: 'bg-[#B5483A]/10', border: 'border-[#B5483A]/30', match: 'Protect' },
    { title: 'Nurture Quadrant', subtitle: 'High Value • Low Churn Risk (Loyal Core / Advocates)', bg: 'bg-[#1F7A4D]/10', border: 'border-[#1F7A4D]/30', match: 'Nurture' },
    { title: 'Fix Quadrant', subtitle: 'Low Value • High Churn Risk (Price Sensitive Swappers)', bg: 'bg-[#C9A227]/15', border: 'border-[#C9A227]/30', match: 'Fix' },
    { title: 'Monitor Quadrant', subtitle: 'Low Value • Low Churn Risk (Steady Single-Service)', bg: 'bg-[#0F3D2E]/10', border: 'border-[#0F3D2E]/20', match: 'Monitor' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#C4BEAD]/40 bg-[#FAF6EA] p-6 shadow-sm">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-[#0F3D2E]">
          Customer Behavioral Archetypes & 2x2 Matrix
        </h1>
        <p className="mt-1 text-xs text-[#64746B] max-w-3xl">
          Actionable segmentation separating high-exposure accounts requiring executive outreach from price-sensitive cohorts suited for automated contract renewal incentives.
        </p>
      </div>

      {/* 2x2 Strategic Action Matrix */}
      <div className="rounded-xl border border-[#C4BEAD]/40 bg-white p-6 shadow-sm">
        <h3 className="font-serif text-lg font-bold text-[#0F3D2E] mb-4">
          Strategic Risk x Value Matrix
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quadrants.map(q => {
            const seg = segments.find(s => s.matrixQuadrant.includes(q.match));
            return (
              <div
                key={q.title}
                className={`rounded-xl border ${q.border} ${q.bg} p-5 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#0F3D2E]">{q.title}</span>
                    <span className="rounded bg-white/80 px-2 py-0.5 font-mono text-xs font-bold text-[#0F3D2E] border border-[#C4BEAD]/30">
                      {seg ? `${(seg.churnRate * 100).toFixed(1)}% Churn` : 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs text-[#64746B] mt-0.5">{q.subtitle}</p>

                  {seg && (
                    <div className="mt-4 rounded-lg bg-white/80 p-3.5 border border-[#C4BEAD]/20">
                      <h4 className="font-bold text-xs text-[#1B2A22]">{seg.name}</h4>
                      <p className="text-xs text-[#64746B] mt-1 leading-relaxed">{seg.persona}</p>

                      <div className="mt-3 flex items-center justify-between text-xs border-t border-[#C4BEAD]/20 pt-2 font-mono">
                        <span>{seg.customerCount.toLocaleString()} Subscribers</span>
                        <span className="font-bold text-[#0F3D2E]">Avg £{seg.avgMonthlyCharge}/mo</span>
                      </div>
                    </div>
                  )}
                </div>

                {seg && (
                  <div className="mt-4 pt-3 border-t border-[#C4BEAD]/20 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#1B2A22]">
                      Intervention: <span className="text-[#0F3D2E]">{seg.recommendedIntervention}</span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Segment Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {segments.map(seg => (
          <div
            key={seg.id}
            className="rounded-xl border border-[#C4BEAD]/40 bg-white p-6 shadow-sm space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F7A4D]">
                  {seg.matrixQuadrant}
                </span>
                <h3 className="font-serif text-lg font-bold text-[#0F3D2E] mt-0.5">{seg.name}</h3>
              </div>
              <div className="text-right">
                <span className="font-mono text-lg font-bold text-[#B5483A]">
                  {(seg.churnRate * 100).toFixed(1)}%
                </span>
                <div className="text-[10px] text-[#64746B]">Churn Rate</div>
              </div>
            </div>

            <p className="text-xs text-[#1B2A22]/80 leading-relaxed bg-[#FAF6EA] p-3 rounded-lg border border-[#C4BEAD]/20">
              {seg.persona}
            </p>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-[#FAF6EA] p-2">
                <span className="text-[#64746B] text-[10px] block">Subscribers</span>
                <span className="font-mono font-bold text-[#0F3D2E]">{seg.customerCount.toLocaleString()}</span>
              </div>
              <div className="rounded-lg bg-[#FAF6EA] p-2">
                <span className="text-[#64746B] text-[10px] block">Avg Spend</span>
                <span className="font-mono font-bold text-[#0F3D2E]">£{seg.avgMonthlyCharge}</span>
              </div>
              <div className="rounded-lg bg-[#FAF6EA] p-2">
                <span className="text-[#64746B] text-[10px] block">Avg NPS</span>
                <span className="font-mono font-bold text-[#0F3D2E]">{seg.avgNps}</span>
              </div>
            </div>

            <div className="border-t border-[#C4BEAD]/30 pt-3 space-y-2 text-xs">
              <div>
                <span className="font-bold text-[#B5483A]">Dominant Vulnerability: </span>
                <span className="text-[#1B2A22]">{seg.dominantRiskFactor}</span>
              </div>
              <div>
                <span className="font-bold text-[#0F3D2E]">Prescribed Retention Play: </span>
                <span className="text-[#1B2A22]">{seg.recommendedIntervention}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
