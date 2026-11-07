import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Sliders,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Zap
} from 'lucide-react';
import type { AppSnapshot, CustomerRecord, RiskTier } from '../../shared/types.js';
import { RiskBadge } from '../components/RiskBadge.js';

interface RiskExplorerProps {
  snapshot: AppSnapshot;
  onSelectCustomer: (customerId: string) => void;
  initialFilterTier?: RiskTier;
}

export const RiskExplorer: React.FC<RiskExplorerProps> = ({
  snapshot,
  onSelectCustomer,
  initialFilterTier,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>(initialFilterTier || 'All');
  const [selectedService, setSelectedService] = useState<string>('All');
  const [selectedContract, setSelectedContract] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<'Active' | 'Churned' | 'All'>('Active');
  
  const [sortField, setSortField] = useState<keyof CustomerRecord>('churnProbability');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filter logic
  const filteredRecords = useMemo(() => {
    let list = snapshot.customers;

    if (selectedStatus !== 'All') {
      list = list.filter(c => c.churnStatus === selectedStatus);
    }

    if (selectedTier !== 'All') {
      list = list.filter(c => c.riskTier === selectedTier);
    }

    if (selectedService !== 'All') {
      list = list.filter(c => c.serviceType === selectedService);
    }

    if (selectedContract !== 'All') {
      list = list.filter(c => c.contractType === selectedContract);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        c =>
          c.customerId.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.planName.toLowerCase().includes(q)
      );
    }

    // Sort
    return [...list].sort((a, b) => {
      let valA: any = a[sortField] ?? 0;
      let valB: any = b[sortField] ?? 0;

      if (typeof valA === 'string') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [snapshot.customers, selectedStatus, selectedTier, selectedService, selectedContract, searchTerm, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const pageRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (field: keyof CustomerRecord) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const exportFilteredCSV = () => {
    const headers = ['Customer ID', 'Segment', 'Service Type', 'Plan Name', 'Contract Type', 'Monthly Charge GBP', 'Tenure Months', 'Churn Probability', 'Risk Tier', 'Top Driver'];
    const rows = filteredRecords.map(r => [
      r.customerId,
      r.customerSegment,
      r.serviceType,
      r.planName,
      r.contractType,
      r.monthlyChargeGbp.toFixed(2),
      r.tenureMonths,
      r.churnProbability ? (r.churnProbability * 100).toFixed(1) + '%' : 'N/A',
      r.riskTier || 'N/A',
      r.topDrivers?.[0]?.featureName || 'N/A',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BritConnect-Customer-Risk-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Title & Stats */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-[#0F3D2E]">
            Customer Risk Explorer
          </h1>
          <p className="text-xs text-[#64746B]">
            Interactive registry of {filteredRecords.length.toLocaleString()} matching customer accounts with calibrated churn probabilities and top SHAP drivers.
          </p>
        </div>

        <button
          onClick={exportFilteredCSV}
          className="inline-flex items-center gap-2 rounded-lg border border-[#0F3D2E]/30 bg-white px-3.5 py-2 text-xs font-semibold text-[#0F3D2E] shadow-xs hover:bg-[#FAF6EA] transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>Export Filtered CSV</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-[#C4BEAD]/40 bg-[#F1EAD3]/60 p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-5">
          {/* Search box */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64746B]" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              placeholder="Search by Customer ID (BCT-...), city, plan..."
              className="w-full rounded-lg border border-[#C4BEAD]/60 bg-white py-2 pl-9 pr-3 text-xs text-[#1B2A22] placeholder-[#64746B]/60 focus:border-[#0F3D2E] focus:outline-none"
            />
          </div>

          {/* Risk Tier Filter */}
          <div>
            <select
              value={selectedTier}
              onChange={e => { setSelectedTier(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-lg border border-[#C4BEAD]/60 bg-white px-3 py-2 text-xs text-[#1B2A22] focus:border-[#0F3D2E] focus:outline-none"
            >
              <option value="All">All Risk Tiers</option>
              <option value="Critical">Critical Risk (&gt;= 65%)</option>
              <option value="High">High Risk (40% - 64%)</option>
              <option value="Medium">Medium Risk (20% - 39%)</option>
              <option value="Low">Low Risk (&lt; 20%)</option>
            </select>
          </div>

          {/* Service Type Filter */}
          <div>
            <select
              value={selectedService}
              onChange={e => { setSelectedService(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-lg border border-[#C4BEAD]/60 bg-white px-3 py-2 text-xs text-[#1B2A22] focus:border-[#0F3D2E] focus:outline-none"
            >
              <option value="All">All Service Types</option>
              <option value="Mobile">Mobile Only</option>
              <option value="Home Broadband">Home Broadband</option>
              <option value="Fibre Broadband">Fibre Broadband</option>
              <option value="Mobile + Broadband Bundle">Mobile + Broadband Bundle</option>
            </select>
          </div>

          {/* Contract Type Filter */}
          <div>
            <select
              value={selectedContract}
              onChange={e => { setSelectedContract(e.target.value); setCurrentPage(1); }}
              className="w-full rounded-lg border border-[#C4BEAD]/60 bg-white px-3 py-2 text-xs text-[#1B2A22] focus:border-[#0F3D2E] focus:outline-none"
            >
              <option value="All">All Contracts</option>
              <option value="Rolling Monthly">Rolling Monthly</option>
              <option value="12 Months">12 Months</option>
              <option value="24 Months">24 Months</option>
            </select>
          </div>
        </div>

        {/* Churn status pill switcher */}
        <div className="mt-3 flex items-center justify-between border-t border-[#C4BEAD]/30 pt-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#64746B]">Status:</span>
            {(['Active', 'Churned', 'All'] as const).map(status => (
              <button
                key={status}
                onClick={() => { setSelectedStatus(status); setCurrentPage(1); }}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  selectedStatus === status
                    ? 'bg-[#0F3D2E] text-white'
                    : 'bg-white/70 text-[#1B2A22] hover:bg-white'
                }`}
              >
                {status === 'Active' ? 'Active Subscribers' : status === 'Churned' ? 'Historical Churned' : 'All Accounts'}
              </button>
            ))}
          </div>

          <div className="text-[#64746B]">
            Showing <span className="font-bold text-[#0F3D2E]">{filteredRecords.length.toLocaleString()}</span> accounts
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-hidden rounded-xl border border-[#C4BEAD]/40 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#C4BEAD]/40 bg-[#FAF6EA] text-[#0F3D2E]">
              <tr>
                <th
                  onClick={() => handleSort('customerId')}
                  className="cursor-pointer px-4 py-3 font-semibold hover:bg-[#F1EAD3]/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Customer ID</span>
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold">Service & Plan</th>
                <th className="px-4 py-3 font-semibold">Contract</th>
                <th
                  onClick={() => handleSort('monthlyChargeGbp')}
                  className="cursor-pointer px-4 py-3 font-semibold hover:bg-[#F1EAD3]/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Monthly Bill</span>
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('churnProbability')}
                  className="cursor-pointer px-4 py-3 font-semibold hover:bg-[#F1EAD3]/70"
                >
                  <div className="flex items-center gap-1">
                    <span>Churn Probability</span>
                    <ArrowUpDown className="h-3 w-3 opacity-60" />
                  </div>
                </th>
                <th className="px-4 py-3 font-semibold">Risk Tier</th>
                <th className="px-4 py-3 font-semibold">Top Risk Driver (SHAP)</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[#C4BEAD]/20">
              {pageRecords.map(customer => {
                const prob = customer.churnProbability || (customer.churnFlag === 1 ? 1.0 : 0.05);
                const topDriver = customer.topDrivers?.[0];

                return (
                  <tr
                    key={customer.customerId}
                    className="hover:bg-[#FAF6EA]/70 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onSelectCustomer(customer.customerId)}
                        className="font-mono font-bold text-[#0F3D2E] hover:underline"
                      >
                        {customer.customerId}
                      </button>
                      <div className="text-[10px] text-[#64746B]">{customer.city}, {customer.ukNation}</div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1B2A22]">{customer.serviceType}</div>
                      <div className="text-[10px] text-[#64746B]">{customer.planName}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${customer.contractType === 'Rolling Monthly' ? 'bg-[#B5483A]/10 text-[#B5483A]' : 'bg-[#0F3D2E]/10 text-[#0F3D2E]'}`}>
                        {customer.contractType}
                      </span>
                      <div className="text-[10px] text-[#64746B]">{customer.tenureMonths} mo tenure</div>
                    </td>

                    <td className="px-4 py-3 font-mono font-bold text-[#0F3D2E]">
                      £{customer.monthlyChargeGbp.toFixed(2)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs">
                          {(prob * 100).toFixed(1)}%
                        </span>
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E5DFCF]">
                          <div
                            className={`h-full ${
                              prob >= 0.65 ? 'bg-[#B5483A]' : prob >= 0.40 ? 'bg-[#C9A227]' : prob >= 0.20 ? 'bg-[#1F7A4D]' : 'bg-[#0F3D2E]'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(5, prob * 100))}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <RiskBadge tier={customer.riskTier} size="sm" />
                    </td>

                    <td className="px-4 py-3">
                      {topDriver ? (
                        <div>
                          <span className="font-semibold text-[#1B2A22]">{topDriver.featureName}</span>
                          <span className={`ml-1 text-[10px] ${topDriver.direction === 'increase' ? 'text-[#B5483A]' : 'text-[#1F7A4D]'}`}>
                            ({topDriver.valStr})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#64746B]/60 italic">Stable profile</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onSelectCustomer(customer.customerId)}
                        className="inline-flex items-center gap-1 rounded bg-[#0F3D2E] px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#1F7A4D] transition-colors"
                      >
                        <span>Inspect 360</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {pageRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#64746B]">
                    No customer accounts match the current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between border-t border-[#C4BEAD]/40 bg-[#FAF6EA] px-4 py-3">
          <div className="text-xs text-[#64746B]">
            Page <span className="font-bold text-[#0F3D2E]">{currentPage}</span> of <span className="font-bold text-[#0F3D2E]">{totalPages}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center gap-1 rounded border border-[#C4BEAD]/60 bg-white px-2.5 py-1 text-xs font-semibold text-[#1B2A22] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center gap-1 rounded border border-[#C4BEAD]/60 bg-white px-2.5 py-1 text-xs font-semibold text-[#1B2A22] disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
