import React from 'react';
import type { RiskTier } from '../../shared/types.js';

interface RiskBadgeProps {
  tier?: RiskTier;
  size?: 'sm' | 'md' | 'lg';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ tier = 'Low', size = 'md' }) => {
  const styles: Record<RiskTier, { bg: string; text: string; border: string; label: string }> = {
    Critical: {
      bg: 'bg-[#B5483A]/10',
      text: 'text-[#B5483A]',
      border: 'border-[#B5483A]/30',
      label: 'Critical Risk',
    },
    High: {
      bg: 'bg-[#C9A227]/15',
      text: 'text-[#9A7B1C]',
      border: 'border-[#C9A227]/30',
      label: 'High Risk',
    },
    Medium: {
      bg: 'bg-[#1F7A4D]/10',
      text: 'text-[#1F7A4D]',
      border: 'border-[#1F7A4D]/25',
      label: 'Medium Risk',
    },
    Low: {
      bg: 'bg-[#0F3D2E]/10',
      text: 'text-[#0F3D2E]',
      border: 'border-[#0F3D2E]/20',
      label: 'Low Risk',
    },
  };

  const current = styles[tier] || styles.Low;
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1 font-semibold',
    lg: 'text-sm px-3.5 py-1.5 font-bold',
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border ${current.bg} ${current.text} ${current.border} ${sizeClasses}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tier === 'Critical' ? 'bg-[#B5483A]' : tier === 'High' ? 'bg-[#C9A227]' : tier === 'Medium' ? 'bg-[#1F7A4D]' : 'bg-[#0F3D2E]'}`} />
      {current.label}
    </span>
  );
};
