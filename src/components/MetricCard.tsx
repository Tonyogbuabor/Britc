import React from 'react';
import { HelpCircle } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  isPositive?: boolean;
  formulaTooltip?: string;
  highlight?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  change,
  isPositive,
  formulaTooltip,
  highlight = false,
}) => {
  return (
    <div
      className={`relative rounded-xl border p-5 transition-shadow hover:shadow-md ${
        highlight
          ? 'bg-[#0F3D2E] text-white border-[#0F3D2E]'
          : 'bg-[#F1EAD3]/70 text-[#1B2A22] border-[#C4BEAD]/40'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider ${highlight ? 'text-[#A8C3A0]' : 'text-[#64746B]'}`}>
          {title}
        </span>
        {formulaTooltip && (
          <div className="group relative cursor-pointer">
            <HelpCircle className={`h-4 w-4 ${highlight ? 'text-[#A8C3A0]/70' : 'text-[#64746B]/70'}`} />
            <div className="pointer-events-none absolute right-0 top-6 z-30 hidden w-64 rounded-lg bg-[#1B2A22] p-2.5 text-xs text-[#FAF6EA] shadow-xl group-hover:block">
              <span className="font-semibold text-[#E4C766]">Methodology / Formula:</span>
              <p className="mt-1 leading-relaxed opacity-90">{formulaTooltip}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className={`font-mono text-3xl font-extrabold tracking-tight ${highlight ? 'text-white' : 'text-[#0F3D2E]'}`}>
          {value}
        </span>
        {change && (
          <span
            className={`text-xs font-semibold ${
              isPositive
                ? highlight ? 'text-[#A8C3A0]' : 'text-[#1F7A4D]'
                : highlight ? 'text-[#E4C766]' : 'text-[#B5483A]'
            }`}
          >
            {change}
          </span>
        )}
      </div>

      {subtitle && (
        <p className={`mt-1.5 text-xs ${highlight ? 'text-white/70' : 'text-[#64746B]'}`}>
          {subtitle}
        </p>
      )}
    </div>
  );
};
