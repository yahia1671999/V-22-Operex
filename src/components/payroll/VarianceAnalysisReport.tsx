import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Building2, 
  DollarSign,
  AlertCircle,
  ArrowRightLeft,
  FileText,
  UserCheck,
  UserX,
  CreditCard,
  Coins
} from 'lucide-react';
import { db, collection, query, where, getDocs } from '../../api';
import { PayrollRun, PayrollResult, Employee, SystemSettings } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { useData } from '../../contexts/DataContext';
import { useLanguage } from '../../contexts/LanguageContext';

interface VarianceAnalysisReportProps {
  currentRun: PayrollRun;
  currentResults: PayrollResult[];
  onClose: () => void;
  systemSettings: SystemSettings | null;
}

interface EmployeeVariance {
  employeeId: string;
  name: string;
  prevNet: number;
  currNet: number;
  diff: number;
  reason: string;
}

export const VarianceAnalysisReport: React.FC<VarianceAnalysisReportProps> = ({ 
  currentRun, 
  currentResults, 
  onClose,
  systemSettings 
}) => {
  const { payrollRuns, employees } = useData();
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

  const [prevRun, setPrevRun] = useState<PayrollRun | null>(null);
  const [prevResults, setPrevResults] = useState<PayrollResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPreviousData = async () => {
      setLoading(true);
      try {
        // Find the previous month's run
        const sortedRuns = [...payrollRuns].sort((a, b) => b.month.localeCompare(a.month));
        const currentIndex = sortedRuns.findIndex(r => r.id === currentRun.id);
        const previousRun = sortedRuns[currentIndex + 1];

        if (previousRun) {
          setPrevRun(previousRun);
          const q = query(collection(db, 'payrollResults'), where('payrollRunId', '==', previousRun.id));
          const snap = await getDocs(q);
          setPrevResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollResult)));
        }
      } catch (error) {
        console.error("Error fetching previous payroll data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviousData();
  }, [currentRun.id, payrollRuns]);

  const summary = useMemo(() => {
    const currTotalEarnings = currentResults.reduce((sum, r) => sum + r.totalIncome, 0);
    const prevTotalEarnings = prevResults.reduce((sum, r) => sum + r.totalIncome, 0);
    
    const currTotalDeductions = currentResults.reduce((sum, r) => sum + r.totalDeductions, 0);
    const prevTotalDeductions = prevResults.reduce((sum, r) => sum + r.totalDeductions, 0);

    const currTotalNet = currentResults.reduce((sum, r) => sum + r.netSalary, 0);
    const prevTotalNet = prevResults.reduce((sum, r) => sum + r.netSalary, 0);

    const currBank = currentResults.filter(r => r.paymentMethod === 'Bank').reduce((sum, r) => sum + r.netSalary, 0);
    const prevBank = prevResults.filter(r => r.paymentMethod === 'Bank').reduce((sum, r) => sum + r.netSalary, 0);

    const currCash = currentResults.filter(r => r.paymentMethod === 'Cash').reduce((sum, r) => sum + r.netSalary, 0);
    const prevCash = prevResults.filter(r => r.paymentMethod === 'Cash').reduce((sum, r) => sum + r.netSalary, 0);

    const currLeaveCount = employees.filter(e => e.status === 'Leave').length;
    // Note: We don't have historical leave status in this simple implementation, 
    // but in a real app we'd check leave records for that month.
    // For now, we'll just show current or zero for prev.

    return {
      earnings: { curr: currTotalEarnings, prev: prevTotalEarnings, diff: currTotalEarnings - prevTotalEarnings },
      deductions: { curr: currTotalDeductions, prev: prevTotalDeductions, diff: currTotalDeductions - prevTotalDeductions },
      net: { curr: currTotalNet, prev: prevTotalNet, diff: currTotalNet - prevTotalNet },
      bank: { curr: currBank, prev: prevBank, diff: currBank - prevBank },
      cash: { curr: currCash, prev: prevCash, diff: currCash - prevCash },
      leave: { curr: currLeaveCount, prev: 0, diff: currLeaveCount }
    };
  }, [currentResults, prevResults, employees]);

  const variances = useMemo(() => {
    const allEmployeeIds = Array.from(new Set([
      ...currentResults.map(r => r.employeeId),
      ...prevResults.map(r => r.employeeId)
    ]));

    return allEmployeeIds.map(empId => {
      const curr = currentResults.find(r => r.employeeId === empId);
      const prev = prevResults.find(r => r.employeeId === empId);
      const emp = employees.find(e => e.employeeId === empId);

      const currNet = curr?.netSalary || 0;
      const prevNet = prev?.netSalary || 0;
      const diff = currNet - prevNet;

      let reason = '';
      if (!prev && curr) {
        reason = isRtl ? 'موظف جديد' : 'New Employee';
      } else if (prev && !curr) {
        reason = isRtl ? 'غادر المؤسسة / لم يصرف له' : 'Left / Not Paid';
      } else if (curr && prev) {
        if (Math.abs(diff) < 0.01) {
          reason = isRtl ? 'لا يوجد تغيير' : 'No Change';
        } else if (curr.basicSalary > prev.basicSalary) {
          reason = isRtl ? 'زيادة في الأساسي' : 'Base Increase';
        } else if (curr.basicSalary < prev.basicSalary) {
          reason = isRtl ? 'نقص في الأساسي' : 'Base Decrease';
        } else if (curr.absenceDeduction > prev.absenceDeduction) {
          reason = isRtl ? 'خصم غياب / تأخير' : 'Absence/Delay';
        } else if (curr.overtimeValue > prev.overtimeValue) {
          reason = isRtl ? 'زيادة عمل إضافي' : 'Overtime Increase';
        } else {
          reason = isRtl ? 'تغير في البدلات / الإضافات' : 'Allowance/Earnings Change';
        }
      }

      return {
        employeeId: empId,
        name: curr?.employeeName || prev?.employeeName || (emp?.name || '---'),
        currNet,
        prevNet,
        diff,
        reason
      } as EmployeeVariance;
    });
  }, [currentResults, prevResults, employees, isRtl]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Modal Header */}
      <div className="flex items-center justify-between p-6 border-b border-border bg-card sticky top-0 z-10 no-print">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-foreground">
              {isRtl ? 'تحليل فروقات الرواتب' : 'Payroll Variance Analysis'}
            </h3>
            <p className="text-sm text-muted-foreground font-medium">
              {isRtl ? `مقارنة ${currentRun.month} مع ${prevRun?.month || '---'}` : `Comparing ${currentRun.month} with ${prevRun?.month || '---'}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/10"
          >
            <Printer className="w-5 h-5" />
            <span>{isRtl ? 'طباعة التقرير' : 'Print Report'}</span>
          </button>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 font-sans print:p-0">
        <div className="max-w-6xl mx-auto space-y-10">
          
          {/* Printable Header */}
          <div className="hidden print:flex justify-between items-start mb-12 border-b-2 border-primary pb-6">
            <div className="text-right">
              <h1 className="text-3xl font-black text-foreground mb-1">{systemSettings?.organizationName}</h1>
              <p className="text-sm font-bold text-muted-foreground">تقارير الموارد البشرية والرواتب</p>
              <div className="mt-4 space-y-1">
                <p className="text-sm font-black">تقرير تحليل الفروقات (Variance Analysis)</p>
                <p className="text-xs font-bold text-muted-foreground tabular-nums">
                  الفترة الحالية: {currentRun.month} | فترة المقارنة: {prevRun?.month || '---'}
                </p>
              </div>
            </div>
            {systemSettings?.logoUrl && (
              <img src={systemSettings.logoUrl} alt="Logo" className="h-20 object-contain" referrerPolicy="no-referrer" />
            )}
          </div>

          {/* Impact Summary Cards */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryCard 
              label={isRtl ? 'إجمالي المستحقات' : 'Total Earnings'} 
              value={summary.earnings.curr} 
              diff={summary.earnings.diff} 
              icon={<TrendingUp className="w-5 h-5" />}
              isRtl={isRtl}
            />
            <SummaryCard 
              label={isRtl ? 'إجمالي الاستقطاعات' : 'Total Deductions'} 
              value={summary.deductions.curr} 
              diff={summary.deductions.diff} 
              icon={<TrendingDown className="w-5 h-5 text-destructive" />}
              isRtl={isRtl}
              isNegative
            />
            <SummaryCard 
              label={isRtl ? 'صافي الرواتب' : 'Net Salary'} 
              value={summary.net.curr} 
              diff={summary.net.diff} 
              icon={<DollarSign className="w-5 h-5" />}
              isRtl={isRtl}
              highlight
            />
          </section>

          {/* Secondary Stats */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-card p-6 rounded-3xl border border-border flex items-center gap-4">
              <div className="p-4 bg-blue-500/10 text-blue-600 rounded-2xl">
                <CreditCard className="w-6 h-6" />
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-muted-foreground uppercase mb-1">{isRtl ? 'رواتب البنك' : 'Bank Salaries'}</p>
                <p className="text-xl font-black text-foreground">{formatCurrency(summary.bank.curr)}</p>
                <p className={cn("text-xs font-bold mt-1", summary.bank.diff >= 0 ? "text-emerald-600" : "text-destructive")}>
                  {summary.bank.diff >= 0 ? '+' : ''}{formatCurrency(summary.bank.diff)}
                </p>
              </div>
            </div>
            <div className="bg-card p-6 rounded-3xl border border-border flex items-center gap-4">
              <div className="p-4 bg-orange-500/10 text-orange-600 rounded-2xl">
                <Coins className="w-6 h-6" />
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-muted-foreground uppercase mb-1">{isRtl ? 'رواتب الكاش' : 'Cash Salaries'}</p>
                <p className="text-xl font-black text-foreground">{formatCurrency(summary.cash.curr)}</p>
                <p className={cn("text-xs font-bold mt-1", summary.cash.diff >= 0 ? "text-emerald-600" : "text-destructive")}>
                  {summary.cash.diff >= 0 ? '+' : ''}{formatCurrency(summary.cash.diff)}
                </p>
              </div>
            </div>
            <div className="bg-card p-6 rounded-3xl border border-border flex items-center gap-4">
              <div className="p-4 bg-indigo-500/10 text-indigo-600 rounded-2xl">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-muted-foreground uppercase mb-1">{isRtl ? 'موظفين في إجازة' : 'Employees on Leave'}</p>
                <p className="text-xl font-black text-foreground">{summary.leave.curr}</p>
                <p className="text-xs font-bold text-muted-foreground mt-1 lowercase">
                  {summary.leave.curr} {isRtl ? 'موظف حالياً' : 'current staff'}
                </p>
              </div>
            </div>
          </section>

          {/* Detailed Table */}
          <section className="bg-card rounded-3xl border border-border overflow-hidden print:border-none print:shadow-none">
            <div className="p-6 border-b border-border bg-muted/30">
              <h4 className="text-lg font-black text-foreground flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                {isRtl ? 'تفاصيل الفروقات لكل موظف' : 'Employee Variance Details'}
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className={cn("w-full", isRtl ? "text-right" : "text-left")}>
                <thead>
                  <tr className="bg-muted/50 text-xs font-black text-muted-foreground uppercase tracking-widest">
                    <th className="px-6 py-4">{isRtl ? 'الموظف' : 'Employee'}</th>
                    <th className="px-6 py-4">{isRtl ? 'الشهر السابق' : 'Prev Month'}</th>
                    <th className="px-6 py-4">{isRtl ? 'الشهر الحالي' : 'Curr Month'}</th>
                    <th className="px-6 py-4">{isRtl ? 'الفرق' : 'Variance'}</th>
                    <th className="px-6 py-4">{isRtl ? 'ملاحظة ذكية' : 'Smart Note'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {variances.filter(v => Math.abs(v.diff) > 0 || (v.reason !== (isRtl ? 'لا يوجد تغيير' : 'No Change'))).map((v, i) => (
                    <tr key={v.employeeId} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black",
                            v.diff > 0 ? "bg-emerald-500/10 text-emerald-600" : 
                            v.diff < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                          )}>
                            {v.reason === (isRtl ? 'موظف جديد' : 'New Employee') ? <UserCheck className="w-4 h-4" /> : 
                             v.reason === (isRtl ? 'غادر المؤسسة / لم يصرف له' : 'Left / Not Paid') ? <UserX className="w-4 h-4" /> : 
                             v.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-sm">{v.name}</p>
                            <p className="text-[10px] text-muted-foreground font-medium font-sans">#{v.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-muted-foreground tabular-nums">
                        {formatCurrency(v.prevNet)}
                      </td>
                      <td className="px-6 py-4 text-sm font-black text-foreground tabular-nums">
                        {formatCurrency(v.currNet)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-sm font-black tabular-nums py-1 px-3 rounded-full",
                          v.diff > 0 ? "bg-emerald-500/10 text-emerald-600" : 
                          v.diff < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                        )}>
                          {v.diff > 0 ? '+' : ''}{formatCurrency(v.diff)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <AlertCircle className={cn("w-4 h-4", 
                            v.diff > 0 ? "text-emerald-500" : 
                            v.diff < 0 ? "text-destructive" : "text-muted-foreground"
                          )} />
                          <span className="text-xs font-bold text-foreground">{v.reason}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {variances.filter(v => Math.abs(v.diff) === 0 && v.reason === (isRtl ? 'لا يوجد تغيير' : 'No Change')).length > 0 && (
                     <tr className="bg-muted/5 no-print">
                       <td colSpan={5} className="px-6 py-3 text-center text-xs text-muted-foreground font-bold italic">
                         {isRtl ? `+ تم إخفاء ${variances.filter(v => Math.abs(v.diff) === 0 && v.reason === (isRtl ? 'لا يوجد تغيير' : 'No Change')).length} موظفاً بدون تغييرات ملحوظة` 
                               : `+ ${variances.filter(v => Math.abs(v.diff) === 0 && v.reason === (isRtl ? 'لا يوجد تغيير' : 'No Change')).length} more employees with no notable changes hidden`}
                       </td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Signatures for Print */}
          <section className="hidden print:grid grid-cols-3 gap-12 mt-20 pt-10 border-t border-dashed border-muted-foreground/30">
            <SignatureBlock label={isRtl ? 'إعداد المحاسب' : 'Accountant Preparation'} />
            <SignatureBlock label={isRtl ? 'مراجعة المدير المالي' : 'Finance Manager Review'} />
            <SignatureBlock label={isRtl ? 'الاعتماد النهائي والختم' : 'Final Approval & Seal'} />
          </section>

          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              @page { size: portrait; margin: 1.5cm; }
              body { background: white !important; }
              .no-print { display: none !important; }
              .print-only { display: block !important; }
              table { width: 100% !important; border-collapse: collapse; }
              th, td { border-bottom: 1px solid #eee; }
              .bg-card { background: white !important; border: none !important; }
              .bg-muted { background: #f9fafb !important; }
              .text-emerald-600 { color: #059669 !important; }
              .text-destructive { color: #dc2626 !important; }
              .shadow-lg, .shadow-2xl { box-shadow: none !important; }
            }
          `}} />
        </div>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ 
  label: string; 
  value: number; 
  diff: number; 
  icon: React.ReactNode; 
  highlight?: boolean; 
  isRtl?: boolean;
  isNegative?: boolean;
}> = ({ label, value, diff, icon, highlight, isRtl, isNegative }) => {
  const isBetter = isNegative ? diff <= 0 : diff >= 0;

  return (
    <div className={cn(
      "p-6 rounded-3xl border transition-all",
      highlight ? "bg-primary text-primary-foreground border-primary shadow-xl shadow-primary/20" : "bg-card border-border"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-2xl", highlight ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
          {icon}
        </div>
        <div className={cn(
          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
          highlight ? "bg-white/20 text-white" : isBetter ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
        )}>
          {diff > 0 ? '+' : ''}{Math.round((diff / (value - diff || 1)) * 100)}%
        </div>
      </div>
      <p className={cn("text-xs font-black uppercase tracking-[0.2em] mb-1 opacity-80", highlight ? "text-white" : "text-muted-foreground")}>
        {label}
      </p>
      <p className="text-3xl font-black tabular-nums">{formatCurrency(value)}</p>
      <p className={cn("text-[10px] font-bold mt-2 flex items-center gap-1 opacity-80", highlight ? "text-white" : isBetter ? "text-emerald-600" : "text-destructive")}>
        {diff >= 0 ? '+' : ''}{formatCurrency(diff)} {isRtl ? 'عن الشهر السابق' : 'from prev month'}
      </p>
    </div>
  );
};

const SignatureBlock: React.FC<{ label: string }> = ({ label }) => (
  <div className="text-center space-y-12">
    <p className="text-sm font-black text-foreground">{label}</p>
    <div className="space-y-2">
      <div className="w-full border-b border-muted-foreground/30 h-10"></div>
      <p className="text-[10px] font-bold text-muted-foreground">الاسم والتوقيع</p>
    </div>
  </div>
);
