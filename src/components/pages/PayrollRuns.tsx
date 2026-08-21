import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Play, 
  CheckCircle2, 
  Lock, 
  FileSpreadsheet,
  Eye,
  ChevronLeft,
  X,
  Calendar,
  ArrowRightLeft,
  Percent
} from 'lucide-react';
import { db, collection, setDoc, doc, query, where, getDocs, OperationType, handleApiError, writeBatch, calculatePayrollRun, submitPayrollRun, reviewPayrollRun, approvePayrollRun, lockPayrollRun, exportPayrollRunAudit, reopenPayrollRun } from '../../api';
import { useData } from '../../contexts/DataContext';
import { Employee, PayrollRun, PayrollResult, Transaction } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { calculatePayrollDetails } from '../../lib/payrollUtils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { getDay } from 'date-fns';

import { useLanguage } from '../../contexts/LanguageContext';
import { VarianceAnalysisReport } from '../payroll/VarianceAnalysisReport';
import { usePermissions } from '../../hooks/usePermissions';

export const PayrollRuns: React.FC = () => {
  const { 
    payrollRuns: runs, 
    employees: allEmployees, 
    transactions: allTransactions,
    missions: allMissions,
    missionTypes,
    absenceRecords: allAbsences,
    absenceTypes,
    attendanceRecords: allAttendance,
    attendanceShifts,
    refreshData
  } = useData();
  const { t, language } = useLanguage();
  const { canView, canCreate, canEdit, canDelete } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [results, setResults] = useState<PayrollResult[]>([]);
  const [showVarianceReport, setShowVarianceReport] = useState(false);
  const [showDeductionsSummary, setShowDeductionsSummary] = useState(false);
  const { systemSettings } = useData();
  const isRtl = language === 'ar';
  
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  if (!canView('payroll')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card border border-border rounded-[2.5rem] shadow-sm max-w-xl mx-auto mt-12">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 flex items-center justify-center mb-6">
          <Lock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{t('غير مصرح لك بالدخول')}</h3>
        <p className="text-sm text-slate-500 max-w-md leading-relaxed">{t('حسابك الحالي لا يمتلك الصلاحية المطلوبة للوصول إلى مسيرات الرواتب الشهرية. يرجى التواصل مع إدارة النظام لتفعيل الصلاحية المناسبة.')}</p>
      </div>
    );
  }

  const calculatePayroll = async () => {
    try {
      await calculatePayrollRun(month);
      await refreshData();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(t('common.error') + ": " + err.message);
    }
  };

  const fetchResults = async (runId: string) => {
    const q = query(collection(db, 'payrollResults'), where('payrollRunId', '==', runId));
    const snap = await getDocs(q);
    const allResults = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PayrollResult));
    setResults(allResults.filter(r => r.payrollRunId === runId));
  };

  const updateStatus = async (run: PayrollRun, newStatus: PayrollRun['status']) => {
    try {
      let updatedRun = { ...run, status: newStatus };
      if (newStatus === 'Submitted') {
        const res = await submitPayrollRun(run.id);
        updatedRun.status = res.status;
      } else if (newStatus === 'Under Review') {
        const res = await reviewPayrollRun(run.id);
        updatedRun.status = res.status;
      } else if (newStatus === 'Approved') {
        const res = await approvePayrollRun(run.id);
        updatedRun.status = res.status;
      } else if (newStatus === 'Locked') {
        const res = await lockPayrollRun(run.id);
        updatedRun.status = res.status;
      } else if (newStatus === 'Draft') {
        const res = await reopenPayrollRun(run.id);
        updatedRun.status = res.status;
      }
      await refreshData();
      if (selectedRun && selectedRun.id === run.id) {
        setSelectedRun(updatedRun);
      }
    } catch (err: any) {
      alert(t('common.error') + ": " + err.message);
    }
  };

  const exportToExcel = async (run: PayrollRun, results: PayrollResult[]) => {
    try {
      await exportPayrollRunAudit(run.id, 'Excel');
    } catch (e) {}

    const employeeData = results.map((r) => ({
      'ID': r.employeeId,
      'Name': r.employeeName,
      'IQAMA/ID': r.iqamaNumber || '',
      'Basic': r.basicSalary,
      'Net': r.netSalary
    }));
    const ws = XLSX.utils.json_to_sheet(employeeData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payroll");
    XLSX.writeFile(wb, `Payroll_${run.month}.xlsx`);
  };

  const renderDeductionsSummary = () => {
    // Aggregation Logic
    const summaryMap: Record<string, { code: string; nameAr: string; nameEn: string; category: string; employeeSum: number; companySum: number; headCount: number }> = {};
    
    results.forEach(r => {
      let details: any[] = [];
      try {
        if (r.detailedDeductions) {
          details = typeof r.detailedDeductions === 'string' ? JSON.parse(r.detailedDeductions) : r.detailedDeductions;
        }
      } catch(e) {}
      
      if (Array.isArray(details)) {
        details.forEach((d: any) => {
          const lookupId = d.id || d.code || 'unknown';
          if (!summaryMap[lookupId]) {
            summaryMap[lookupId] = {
              code: d.code || '',
              nameAr: d.nameAr || d.name || t('استقطاع غامض'),
              nameEn: d.nameEn || d.name || 'Deduction',
              category: d.category || t('تأمينات - ضرائب - أخرى'),
              employeeSum: 0,
              companySum: 0,
              headCount: 0
            };
          }
          summaryMap[lookupId].employeeSum += Number(d.employeeVal) || 0;
          summaryMap[lookupId].companySum += Number(d.companyVal) || 0;
          summaryMap[lookupId].headCount += 1;
        });
      }
    });
    
    const summaryList = Object.values(summaryMap);
    
    // Grand totals
    const grandEmployee = summaryList.reduce((acc, curr) => acc + curr.employeeSum, 0);
    const grandCompany = summaryList.reduce((acc, curr) => acc + curr.companySum, 0);
    const grandTotalCost = grandEmployee + grandCompany;
    
    return (
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        className="absolute inset-0 z-[120] bg-background flex flex-col p-8 overflow-auto border border-border"
      >
        <div className="flex items-center justify-between border-b border-border pb-6 mb-6">
          <div>
            <h3 className="text-xl font-black text-foreground flex items-center gap-2">
              <Percent className="w-5 h-5 text-indigo-500 animate-bounce" />
              <span>{isRtl ? t('ملخص مجمع استقطاعات مسير الرواتب') : 'Deduction Master Payroll Summary'}</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-1 animate-pulse">
              {isRtl ? `شاشة ملخص موازين الاستقطاعات لمسير شهر ${selectedRun?.month}` : `Consolidated Balance Sheet for ${selectedRun?.month}`}
            </p>
          </div>
          <button 
            onClick={() => setShowDeductionsSummary(false)}
            className="px-4 py-2 bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-bold transition-all"
          >
            {isRtl ? t('إغلاق الملخص ×') : 'Close Summary ×'}
          </button>
        </div>

        {/* Quick Bento/Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="border border-border p-5 bg-muted/10">
            <span className="text-[10px] font-bold text-muted-foreground block uppercase font-mono">{t('إجمالي خصومات الموظفين (Total Employees Share)')}</span>
            <span className="text-2xl font-black text-destructive block mt-1 tracking-tight">{formatCurrency(grandEmployee)}</span>
          </div>
          <div className="border border-border p-5 bg-muted/10">
            <span className="text-[10px] font-bold text-muted-foreground block uppercase font-mono">{t('إجمالي مساهمة الشركة (Total Company Share)')}</span>
            <span className="text-2xl font-black text-primary block mt-1 tracking-tight">{formatCurrency(grandCompany)}</span>
          </div>
          <div className="border border-border p-5 bg-indigo-500/5 border-indigo-500/20">
            <span className="text-[10px] font-bold text-indigo-600 block uppercase font-mono">{t('إجمالي التدفق المالي الكلي (Grand Consolidated Cost)')}</span>
            <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 block mt-1 tracking-tight">{formatCurrency(grandTotalCost)}</span>
          </div>
        </div>

        {/* Table of values */}
        {summaryList.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-border py-12 text-center text-muted-foreground">
            <Percent className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-bold">{t('لا توجد استقطاعات مسجلة أو مستقطعة من الموظفين في هذا المسير حالياً.')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('تأكد من تفعيل استقطاعات الموظف أو اعتماد نماذج استقطاعات نشطة لتبويب البيانات.')}</p>
          </div>
        ) : (
          <div className="border border-border bg-card overflow-x-auto">
            <table className="w-full min-w-[650px] text-left rtl:text-right text-xs">
              <thead className="bg-muted text-foreground font-black border-b border-border uppercase tracking-widest font-mono">
                <tr>
                  <th className="px-6 py-4">{t('الاستقطاع')}</th>
                  <th className="px-6 py-4">{t('التصنيف الرئيسي')}</th>
                  <th className="px-6 py-4 text-center">{t('عدد المشمولين')}</th>
                  <th className="px-6 py-4 text-emerald-600 text-center">{t('خصم الموظف (جمع)')}</th>
                  <th className="px-6 py-4 text-primary text-center">{t('تكلفة الشركة (جمع)')}</th>
                  <th className="px-6 py-4 text-indigo-600 text-center">{t('التكلفة المالية الكلية')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground font-medium">
                {summaryList.map((st, i) => (
                  <tr key={st.code || i} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-extrabold text-foreground">{st.nameAr}</div>
                      <div className="text-[10px] text-muted-foreground font-semibold font-mono tracking-wider">{st.nameEn}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold">
                        {st.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-mono font-bold text-muted-foreground">{st.headCount} موظف</td>
                    <td className="px-6 py-4 text-center font-bold text-destructive">{formatCurrency(st.employeeSum)}</td>
                    <td className="px-6 py-4 text-center font-bold text-primary">{formatCurrency(st.companySum)}</td>
                    <td className="px-6 py-4 text-center font-extrabold text-indigo-600 dark:text-indigo-400 font-mono text-sm bg-indigo-500/5">
                      {formatCurrency(st.employeeSum + st.companySum)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    );
  };

  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => b.month.localeCompare(a.month));
  }, [runs]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-6 rounded-none border border-border transition-colors">
        <h3 className="text-xl font-black text-foreground">
          {isRtl ? t('مسير الرواتب الشهري') : 'Monthly Payroll Runs'}
        </h3>
        {canCreate('payroll') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-none transition-all shadow-lg shadow-primary/20"
          >
            <Play className="w-5 h-5" />
            <span>{isRtl ? t('احتساب رواتب شهر جديد') : 'New Payroll Run'}</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedRuns.map((run) => (
          <div key={run.id} className="bg-card p-6 rounded-none border border-border shadow-none transition-all group">
            <div className="flex justify-between items-start mb-6">
              <div className="w-14 h-14 bg-primary/10 rounded-none flex items-center justify-center text-primary">
                <Calendar className="w-7 h-7" />
              </div>
              <div className={cn(
                "px-4 py-1.5 rounded-none text-xs font-black border",
                run.status === 'Approved' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                run.status === 'Draft' ? "bg-primary/10 text-primary border-primary/20" : 
                "bg-orange-500/10 text-orange-600 border-orange-500/20"
              )}>
                {run.status}
              </div>
            </div>
            
            <h4 className="text-2xl font-black text-foreground mb-1">{run.month}</h4>
            <p className="text-sm text-muted-foreground font-medium mb-6">
              {run.employeeCount} {isRtl ? t('موظف تم احتسابهم') : 'Employees calculated'}
            </p>
            
            <div className="p-4 bg-muted rounded-none mb-6">
              <p className="text-xs text-muted-foreground font-bold mb-1 uppercase tracking-wider">{isRtl ? t('إجمالي الصافي') : 'Total Net'}</p>
              <p className="text-xl font-black text-foreground">{formatCurrency(run.totalNet)}</p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => { setSelectedRun(run); fetchResults(run.id); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-card border border-border rounded-none text-foreground font-bold hover:bg-muted transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>{isRtl ? t('عرض') : 'View'}</span>
              </button>
              {run.status === 'Draft' && (canEdit('payroll') || canDelete('payroll')) && (
                <button 
                  onClick={() => updateStatus(run, 'Approved')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-none font-bold hover:bg-emerald-700 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isRtl ? t('اعتماد') : 'Approve'}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedRun && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedRun(null)} className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-card w-full max-w-5xl h-[80vh] rounded-none shadow-2xl overflow-hidden flex flex-col border border-border">
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/50">
                <div>
                  <h3 className="text-2xl font-black text-foreground">
                    {isRtl ? `تفاصيل مسير ${selectedRun.month}` : `Payroll Details of ${selectedRun.month}`}
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium">{t('common.status')}: {selectedRun.status}</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* ERP Workflow Actions */}
                  {selectedRun.status === 'Draft' && (
                    <button 
                      onClick={() => updateStatus(selectedRun, 'Submitted')}
                      className="px-4 py-2.5 bg-primary text-primary-foreground font-black rounded-none hover:bg-primary/95 transition-all text-xs border border-transparent"
                    >
                      {isRtl ? t('تقديم المسير [مدخل بيانات]') : 'Submit Run'}
                    </button>
                  )}
                  {selectedRun.status === 'Submitted' && (
                    <>
                      <button 
                        onClick={() => updateStatus(selectedRun, 'Under Review')}
                        className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-none transition-all text-xs"
                      >
                        {isRtl ? t('بدء المراجعة [مدير رواتب]') : 'Review Run'}
                      </button>
                      <button 
                        onClick={() => updateStatus(selectedRun, 'Approved')}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-none transition-all text-xs"
                      >
                        {isRtl ? t('اعتماد المسير [المشرف]') : 'Approve Run'}
                      </button>
                    </>
                  )}
                  {selectedRun.status === 'Under Review' && (
                    <button 
                      onClick={() => updateStatus(selectedRun, 'Approved')}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-none transition-all text-xs"
                    >
                      {isRtl ? t('اعتماد المسير [المشرف]') : 'Approve Run'}
                    </button>
                  )}
                  {selectedRun.status === 'Approved' && (
                    <>
                      <button 
                        onClick={() => updateStatus(selectedRun, 'Locked')}
                        className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white font-black rounded-none transition-all text-xs"
                      >
                        {isRtl ? t('إقفال نهائي [المالية]') : 'Lock Run'}
                      </button>
                      <button 
                        onClick={() => updateStatus(selectedRun, 'Draft')}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-none transition-all text-xs"
                      >
                        {isRtl ? t('إعادة فتح المسير') : 'Reopen Run'}
                      </button>
                    </>
                  )}
                  {selectedRun.status === 'Locked' && (
                    <button 
                      onClick={() => updateStatus(selectedRun, 'Draft')}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-none transition-all text-xs"
                    >
                      {isRtl ? t('إعادة فتح المسير المغلق') : 'Reopen Locked Run'}
                    </button>
                  )}

                  <button 
                    onClick={() => setShowVarianceReport(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-none hover:bg-indigo-700 transition-all text-xs"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    <span>{isRtl ? t('تحليل الفروقات') : 'Variance Analysis'}</span>
                  </button>
                  <button 
                    onClick={() => setShowDeductionsSummary(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-none hover:bg-blue-700 transition-all text-xs"
                  >
                    <Percent className="w-4 h-4" />
                    <span>{isRtl ? t('ملخص الاستقطاعات') : 'Deductions Summary'}</span>
                  </button>
                  <button 
                    onClick={() => exportToExcel(selectedRun, results)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-none hover:bg-emerald-700 transition-all text-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{isRtl ? t('تصدير ملف البنك') : 'Export Bank File'}</span>
                  </button>
                  <button onClick={() => setSelectedRun(null)} className="p-2 hover:bg-muted rounded-none transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4 sm:p-8">
                <table className={cn("w-full min-w-[550px]", isRtl ? "text-right" : "text-left")}>
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border">
                      <th className="pb-4 text-sm font-black text-muted-foreground uppercase tracking-widest">{t('common.name')}</th>
                      <th className="pb-4 text-sm font-black text-muted-foreground uppercase tracking-widest">{isRtl ? t('الأساسي') : 'Basic'}</th>
                      <th className="pb-4 text-sm font-black text-muted-foreground uppercase tracking-widest">{isRtl ? t('إجمالي الاستحقاقات') : 'Earnings'}</th>
                      <th className="pb-4 text-sm font-black text-muted-foreground uppercase tracking-widest">{isRtl ? t('إجمالي الاستقطاعات') : 'Deductions'}</th>
                      <th className="pb-4 text-sm font-black text-muted-foreground uppercase tracking-widest">{isRtl ? t('الصافي') : 'Net'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {results.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-4 font-bold text-foreground tracking-tight">{r.employeeName}</td>
                        <td className="py-4 text-muted-foreground">{formatCurrency(r.basicSalary)}</td>
                        <td className="py-4 text-emerald-600 font-bold">+{formatCurrency(r.totalIncome)}</td>
                        <td className="py-4 text-destructive font-bold">-{formatCurrency(r.totalDeductions)}</td>
                        <td className="py-4 font-black text-foreground">{formatCurrency(r.netSalary)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <AnimatePresence>
                {showVarianceReport && (
                  <motion.div 
                    initial={{ opacity: 0, x: isRtl ? -100 : 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: isRtl ? -100 : 100 }}
                    className="absolute inset-0 z-[110] bg-background"
                  >
                    <VarianceAnalysisReport 
                      currentRun={selectedRun}
                      currentResults={results}
                      systemSettings={systemSettings}
                      onClose={() => setShowVarianceReport(false)}
                    />
                  </motion.div>
                )}
                {showDeductionsSummary && renderDeductionsSummary()}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Calculation Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card w-full max-w-md rounded-none shadow-2xl p-8 border border-border">
              <h3 className="text-2xl font-black text-foreground mb-6 text-center">
                {isRtl ? t('احتساب رواتب شهر جديد') : 'Calculate New Monthly Payroll'}
              </h3>
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground mx-2">{isRtl ? t('اختر الشهر') : 'Select Month'}</label>
                  <input type="month" className="w-full px-5 py-3 bg-muted border border-border rounded-none focus:ring-2 focus:ring-primary outline-none font-medium text-foreground" value={month} onChange={(e) => setMonth(e.target.value)} />
                </div>
                <div className="p-4 bg-primary/10 rounded-none border border-primary/20">
                  <p className="text-sm text-primary font-medium leading-relaxed">
                    {isRtl ? t('سيقوم النظام بسحب جميع الموظفين النشطين واحتساب رواتبهم بناءً على الحركات المسجلة لهذا الشهر.')
                          : 'The system will pull all active employees and calculate their salaries based on the recorded transactions for this month.'}
                  </p>
                </div>
                <button 
                  onClick={calculatePayroll}
                  className="w-full py-4 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-none transition-all shadow-lg shadow-primary/20"
                >
                  {isRtl ? t('بدء الاحتساب الآن') : 'Start Calculation'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
