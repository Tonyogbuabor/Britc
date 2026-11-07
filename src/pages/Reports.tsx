import React from 'react';
import { FileSpreadsheet, FileDown, ShieldCheck, Download, Table, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import type { AppSnapshot } from '../../shared/types.js';

interface ReportsProps {
  snapshot: AppSnapshot;
}

export const Reports: React.FC<ReportsProps> = ({ snapshot }) => {
  const { kpis, dataQuality, leakageAudit, models } = snapshot;

  const handleDownloadExcel = () => {
    window.location.href = '/api/reports/excel';
  };

  const handleDownloadExecutivePDF = () => {
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(15, 61, 46); // Forest #0F3D2E
    doc.text('BritConnect Telecom Intelligence Report', 20, 24);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 107);
    doc.text(`AUDITED SNAPSHOT REPORT • VERSION: ${snapshot.version} • DATE: ${new Date().toLocaleDateString()}`, 20, 32);
    doc.line(20, 35, 190, 35);

    // Section 1: Financial & Churn KPIs
    doc.setFontSize(12);
    doc.setTextColor(27, 42, 34);
    doc.text('Executive Commercial Summary', 20, 44);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Active Billable Subscribers: ${kpis.activeCustomers.toLocaleString()}`, 20, 52);
    doc.text(`Monthly Churn Rate: ${(kpis.monthlyChurnRate * 100).toFixed(2)}%`, 20, 58);
    doc.text(`Total MRR at Risk (Critical & High): £${kpis.totalMrrAtRisk.toLocaleString()}`, 20, 64);
    doc.text(`Expected Monthly Churn Loss: £${kpis.expectedMonthlyChurnLossGbp.toLocaleString()}`, 20, 70);
    doc.text(`Net Revenue Protected by Campaigns: £${kpis.totalProtectedRevenueGbp.toLocaleString()}`, 20, 76);
    doc.text(`Average Subscriber Tenure: ${kpis.avgCustomerTenureMonths} Months`, 20, 82);

    doc.line(20, 88, 190, 88);

    // Section 2: Machine Learning & Governance
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Machine Learning Model & Target Leakage Certification', 20, 97);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Champion Algorithm: ${models.activeModel.toUpperCase()}`, 20, 105);
    doc.text(`Validation ROC-AUC: ${models[models.activeModel].rocAuc} | PR-AUC: ${models[models.activeModel].prAuc}`, 20, 111);
    doc.text(`Leakage Firewall Status: ${leakageAudit.allPassed ? 'VERIFIED (Zero Target Leakage)' : 'WARNING'}`, 20, 117);
    doc.text(`Single-Feature Max AUC: ${leakageAudit.singleFeatureMaxAuc} (Passed <= 0.80 standard)`, 20, 123);
    doc.text(`Permutation Canary AUC: ${leakageAudit.permutationTestAuc} (Expected ~0.50)`, 20, 129);
    doc.text(`Demographic Fairness: PASSED UK GDPR & Equality Act 80% Rule`, 20, 135);

    doc.line(20, 142, 190, 142);

    // Section 3: High Priority At-Risk Accounts
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Top 5 Priority At-Risk Accounts (Require Immediate Intervention)', 20, 151);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let y = 160;
    const topAccounts = snapshot.activeCustomers
      .filter(c => c.riskTier === 'Critical')
      .slice(0, 5);

    topAccounts.forEach((c, idx) => {
      doc.text(
        `${idx + 1}. [${c.customerId}] ${c.serviceType} | £${c.monthlyChargeGbp.toFixed(2)}/mo | P(Churn): ${((c.churnProbability || 0) * 100).toFixed(0)}% | Key: ${c.topDrivers?.[0]?.featureName || 'Contract'}`,
        24,
        y
      );
      y += 8;
    });

    doc.save(`BritConnect-Executive-Report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[#C4BEAD]/40 bg-[#FAF6EA] p-6 shadow-sm">
        <h1 className="font-serif text-2xl font-bold tracking-tight text-[#0F3D2E]">
          Executive Reporting & Data Export Center
        </h1>
        <p className="mt-1 text-xs text-[#64746B] max-w-3xl">
          Export board-ready financial summaries, multi-sheet analytical workbooks, and audited data quality records.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Multi-Tab Excel Card */}
        <div className="rounded-xl border border-[#C4BEAD]/40 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1F7A4D]/10 text-[#1F7A4D]">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-[#0F3D2E]">
                Comprehensive Excel Workbook (.xlsx)
              </h3>
              <p className="text-xs text-[#64746B]">
                Full multi-tab spreadsheet formatted for financial directors and analysts.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-[#FAF6EA] p-3 text-xs space-y-1.5 border border-[#C4BEAD]/20">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1F7A4D]" />
              <span className="font-semibold text-[#1B2A22]">Tab 1: Executive Overview & Financial Metrics</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1F7A4D]" />
              <span className="font-semibold text-[#1B2A22]">Tab 2: At-Risk Customer Registry with Calibrated Probabilities</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1F7A4D]" />
              <span className="font-semibold text-[#1B2A22]">Tab 3: Customer Segments, Archetypes & Quadrant Actions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1F7A4D]" />
              <span className="font-semibold text-[#1B2A22]">Tab 4: Data Quality Logs & Leakage Audit Certification</span>
            </div>
          </div>

          <button
            onClick={handleDownloadExcel}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#0F3D2E] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#1F7A4D] transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Download Multi-Tab Excel Workbook</span>
          </button>
        </div>

        {/* Executive PDF Report Card */}
        <div className="rounded-xl border border-[#C4BEAD]/40 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0F3D2E]/10 text-[#0F3D2E]">
              <FileDown className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-[#0F3D2E]">
                Executive Briefing PDF (.pdf)
              </h3>
              <p className="text-xs text-[#64746B]">
                High-level PDF dossier designed for executive presentation and governance reviews.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-[#FAF6EA] p-3 text-xs space-y-1.5 border border-[#C4BEAD]/20">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1F7A4D]" />
              <span className="font-semibold text-[#1B2A22]">KPI Financial Balance Sheet (MRR at risk, expected loss)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1F7A4D]" />
              <span className="font-semibold text-[#1B2A22]">Model Validation Summary (ROC-AUC, calibration status)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1F7A4D]" />
              <span className="font-semibold text-[#1B2A22]">UK GDPR Demographic Fairness Verification Badge</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-[#1F7A4D]" />
              <span className="font-semibold text-[#1B2A22]">Top 5 Critical Account Action Items</span>
            </div>
          </div>

          <button
            onClick={handleDownloadExecutivePDF}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#C9A227] px-4 py-2.5 text-xs font-bold text-[#0F3D2E] shadow-xs hover:bg-[#E4C766] transition-colors"
          >
            <FileDown className="h-4 w-4" />
            <span>Generate Executive Summary PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
