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
  Trash2,
  RefreshCw,
  Clock,
  UserCheck,
  RotateCcw
} from 'lucide-react';
import { 
  db, 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  query, 
  where,
  generateMissionAllowanceLines,
  submitMissionAllowanceRun,
  reviewMissionAllowanceRun,
  approveMissionAllowanceRun,
  lockMissionAllowanceRun,
  exportMissionAllowanceRunAudit,
  getMissionAllowanceRunLines
} from '../../api';
import { useData } from '../../contexts/DataContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { usePermissions } from '../../hooks/usePermissions';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

export interface MissionAllowanceRun {
  id: string;
  runNumber: string;
  periodFrom: string;
  periodTo: string;
  status: 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Locked';
  createdBy: string;
  createdAt: string;
  submittedBy?: string;
  submittedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  lockedBy?: string;
  lockedAt?: string;
  totalEmployees: number;
  totalMissions: number;
  totalAllowanceAmount: number;
  notes?: string;
}

export interface MissionAllowanceRunLine {
  id: string;
  runId: string;
  employeeId: string;
  employeeName: string;
  missionId: string;
  missionDateFrom: string;
  missionDateTo: string;
  missionDays: number;
  destination: string;
  allowanceType: string;
  dailyAllowanceRate: number;
  totalAllowanceAmount: number;
  paymentMethod: string;
  bankAccount: string;
  cashAmount: number;
  bankAmount: number;
  status: string;
  notes?: string;
}

export const MissionAllowanceRuns: React.FC = () => {
  const { t, language } = useLanguage();
  const { canView, canCreate, canEdit, canDelete } = usePermissions();
  const { refreshData } = useData();
  const isRtl = language === 'ar';

  const [runs, setRuns] = useState<MissionAllowanceRun[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRun, setSelectedRun] = useState<MissionAllowanceRun | null>(null);
  const [results, setResults] = useState<MissionAllowanceRunLine[]>([]);
  
  // New Run fields
  const [periodFrom, setPeriodFrom] = useState(new Date().toISOString().slice(0, 10));
  const [periodTo, setPeriodTo] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const loadRuns = async () => {
    try {
      setLoading(true);
      const snap = await getDocs('mission-allowance-runs');
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as MissionAllowanceRun));
      setRuns(list);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const createRun = async () => {
    try {
      setIsGenerating(true);
      const runId = crypto.randomUUID();
      const runNumber = `MAR-${Date.now().toString().slice(-6)}`;
      const user = JSON.parse(localStorage.getItem('auth_user') || '{}');

      const newRun: MissionAllowanceRun = {
        id: runId,
        runNumber,
        periodFrom,
        periodTo,
        status: 'Draft',
        createdBy: user.name || user.email || 'system',
        createdAt: new Date().toISOString(),
        totalEmployees: 0,
        totalMissions: 0,
        totalAllowanceAmount: 0,
        notes
      };

      // Create Run header document
      await setDoc(doc(db, 'missionAllowanceRuns', runId), newRun);
      
      // Auto-trigger backend line generation
      await generateMissionAllowanceLines(runId);
      
      await loadRuns();
      setIsModalOpen(false);
      setNotes('');
    } catch (err: any) {
      alert(t('common.error') + ": " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteRun = async (id: string) => {
    if (!window.confirm(isRtl ? t('هل أنت متأكد من حذف هذا المسير نهائيًا؟') : 'Are you sure you want to delete this run?')) {
      return;
    }
    try {
      const response = await fetch(`/api/mission-allowance-runs/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t('فشل حذف المسير ماليًا'));
      }
      await loadRuns();
      if (selectedRun?.id === id) {
        setSelectedRun(null);
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const fetchResults = async (runId: string) => {
    try {
      const lines = await getMissionAllowanceRunLines(runId);
      setResults(lines);
    } catch (err: any) {
      console.error(err);
    }
  };

  const updateRunStatus = async (run: MissionAllowanceRun, newStatus: MissionAllowanceRun['status']) => {
    try {
      let updatedRun = { ...run, status: newStatus };
      if (newStatus === 'Submitted') {
        const res = await submitMissionAllowanceRun(run.id);
        updatedRun.status = res.status;
      } else if (newStatus === 'Under Review') {
        const res = await reviewMissionAllowanceRun(run.id);
        updatedRun.status = res.status;
      } else if (newStatus === 'Approved') {
        const res = await approveMissionAllowanceRun(run.id);
        updatedRun.status = res.status;
      } else if (newStatus === 'Locked') {
        const res = await lockMissionAllowanceRun(run.id);
        updatedRun.status = res.status;
      } else if (newStatus === 'Draft') {
        // Reopen mechanism for Mission runs:
        const response = await fetch(`/api/mission-allowance-runs/${run.id}/reopen`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        if (!response.ok) {
          const rawErr = await response.json().catch(() => ({}));
          throw new Error(rawErr.error || t('فشل إعادة فتح المسير'));
        }
        const res = await response.json();
        updatedRun.status = res.status;
      }

      await loadRuns();
      if (selectedRun && selectedRun.id === run.id) {
        setSelectedRun(updatedRun);
      }
    } catch (err: any) {
      alert(t('common.error') + ": " + err.message);
    }
  };

  const exportToExcel = async (run: MissionAllowanceRun, details: MissionAllowanceRunLine[]) => {
    try {
      await exportMissionAllowanceRunAudit(run.id, 'Excel');
    } catch (e) {}

    const listData = details.map((r) => ({
      'Run Details': run.runNumber,
      'Employee ID': r.employeeId,
      'Name': r.employeeName,
      'Mission Range': `${r.missionDateFrom} to ${r.missionDateTo}`,
      'Days': r.missionDays,
      'Rate': r.dailyAllowanceRate,
      'Total Allowance': r.totalAllowanceAmount,
      'Payment Method': r.paymentMethod,
      'Bank Account': r.bankAccount || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(listData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mission Allowance");
    XLSX.writeFile(wb, `Mission_Allowance_${run.runNumber}.xlsx`);
  };

  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [runs]);

  if (!canView('payroll')) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-card border border-border rounded-[2.5rem] shadow-sm max-w-xl mx-auto mt-12">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 flex items-center justify-center mb-6">
          <Trash2 className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold mb-2">{isRtl ? t('صلاحيات غير كافية') : 'Insufficient Permissions'}</h3>
        <p className="text-muted-foreground">{isRtl ? t('ليس لديك الصلاحية لاستعراض صفحة مسيرات بدلات المأموريات.') : 'You do not have permissions to view Mission Allowance Runs page.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-card p-6 rounded-none border border-border">
        <div>
          <h3 className="text-xl font-black text-foreground">
            {isRtl ? t('مسيرات بدلات المأموريات المستقلة') : 'Mission Allowance Runs'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {isRtl ? t('إدارة واعتماد بدلات مأموريات الموظفين بشكل منفصل وبدورة اعتماد آمنة وموثوقة.')
                  : 'Manage employee mission benefit allowances independently with modern approval pipelines.'}
          </p>
        </div>
        {canCreate('payroll') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/95 text-white font-bold rounded-none shadow-lg shadow-primary/20 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span>{isRtl ? t('إجراء احتساب بدلات مأموريات') : 'New Mission Run'}</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">{isRtl ? t('جاري جلب المسيرات...') : 'Loading runs...'}</p>
        </div>
      ) : sortedRuns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-card border border-border">
          <Calendar className="w-16 h-16 text-muted-foreground mb-4 opacity-50" />
          <h4 className="text-lg font-black text-foreground">{isRtl ? t('لا توجد مسيرات مسجلة') : 'No Runs Yet'}</h4>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {isRtl ? t('لم يتم احتساب أو إنشاء أي مسير مستقل لبدلات المأموريات بعد.') : 'No unique mission allowance runs calculated yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedRuns.map((run) => (
            <div key={run.id} className="bg-card p-6 rounded-none border border-border flex flex-col justify-between group">
              <div>
                <div className="flex justify-between items-start mb-6">
                  <div className="w-12 h-12 bg-primary/15 flex items-center justify-center text-primary">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div className={cn(
                    "px-3 py-1 text-[10px] font-black border uppercase tracking-wider",
                    run.status === 'Locked' ? "bg-slate-900 border-black text-white" :
                    run.status === 'Approved' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25" :
                    run.status === 'Submitted' ? "bg-blue-500/10 text-blue-600 border-blue-500/25" :
                    run.status === 'Under Review' ? "bg-amber-500/10 text-amber-600 border-amber-500/25" :
                    "bg-gray-500/10 text-muted-foreground border-gray-500/25"
                  )}>
                    {run.status}
                  </div>
                </div>

                <h4 className="text-lg font-black text-foreground mb-1">{run.runNumber}</h4>
                <p className="text-xs text-muted-foreground font-bold mb-4">
                  {run.periodFrom} {isRtl ? t('إلى') : 'to'} {run.periodTo}
                </p>

                <div className="grid grid-cols-2 gap-4 my-4 p-3 bg-muted">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold block">{isRtl ? t('المأموريات') : 'Missions'}</span>
                    <span className="text-sm font-black text-foreground">{run.totalMissions}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground font-bold block">{isRtl ? t('الموظفين') : 'Employees'}</span>
                    <span className="text-sm font-black text-foreground">{run.totalEmployees}</span>
                  </div>
                </div>

                <div className="p-3 bg-primary/5 border border-primary/10 rounded-none mb-6">
                  <span className="text-[10px] text-primary font-black block uppercase tracking-wide">{isRtl ? t('إجمالي البدلات') : 'Total Allowances'}</span>
                  <span className="text-xl font-black text-primary">{formatCurrency(run.totalAllowanceAmount)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => { setSelectedRun(run); fetchResults(run.id); }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-muted hover:bg-muted/80 text-foreground font-bold border border-border text-xs transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>{isRtl ? t('تفاصيل') : 'View'}</span>
                </button>
                {run.status === 'Draft' && canDelete('payroll') && (
                  <button 
                    onClick={() => deleteRun(run.id)}
                    className="p-3 bg-red-50 hover:bg-red-100 text-red-600 transition-colors border border-red-200"
                    title={isRtl ? t('حذف') : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Details Drawer / Modal */}
      <AnimatePresence>
        {selectedRun && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedRun(null)} className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="relative bg-card w-full max-w-6xl h-[85vh] rounded-none shadow-2xl overflow-hidden flex flex-col border border-border">
              <div className="p-8 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted/30">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black uppercase tracking-widest bg-primary/10 text-primary px-3 py-1">{selectedRun.runNumber}</span>
                    <span className={cn(
                      "text-xs px-2.5 py-0.5 border font-black",
                      selectedRun.status === 'Locked' ? "bg-black text-white" : "bg-card text-foreground"
                    )}>{selectedRun.status}</span>
                  </div>
                  <h3 className="text-xl font-black mt-2 text-foreground">
                    {isRtl ? t('مسير تفاصيل بدلات المأموريات المستقل') : 'Detailed Mission Allowance Run Results'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isRtl ? `من تاريخ ${selectedRun.periodFrom} إلى تاريخ ${selectedRun.periodTo}` : `Period from ${selectedRun.periodFrom} to ${selectedRun.periodTo}`}
                  </p>
                </div>

                {/* Workflow Transitions */}
                <div className="flex flex-wrap items-center gap-2">
                  {selectedRun.status === 'Draft' && (
                    <button 
                      onClick={() => updateRunStatus(selectedRun, 'Submitted')}
                      className="px-3.5 py-2 bg-primary text-white font-black text-xs hover:bg-primary/95 transition-all"
                    >
                      {isRtl ? t('تقديم للاعتماد') : 'Submit'}
                    </button>
                  )}
                  {selectedRun.status === 'Submitted' && (
                    <>
                      <button 
                        onClick={() => updateRunStatus(selectedRun, 'Under Review')}
                        className="px-3.5 py-2 bg-amber-500 text-white font-black text-xs hover:bg-amber-600 transition-all"
                      >
                        {isRtl ? t('بدء المراجعة') : 'Review'}
                      </button>
                      <button 
                        onClick={() => updateRunStatus(selectedRun, 'Approved')}
                        className="px-3.5 py-2 bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 transition-all"
                      >
                        {isRtl ? t('اعتماد المسير') : 'Approve'}
                      </button>
                    </>
                  )}
                  {selectedRun.status === 'Under Review' && (
                    <button 
                      onClick={() => updateRunStatus(selectedRun, 'Approved')}
                      className="px-3.5 py-2 bg-emerald-600 text-white font-black text-xs hover:bg-emerald-700 transition-all"
                    >
                      {isRtl ? t('اعتماد المسير') : 'Approve'}
                    </button>
                  )}
                  {selectedRun.status === 'Approved' && (
                    <>
                      <button 
                        onClick={() => updateRunStatus(selectedRun, 'Locked')}
                        className="px-3.5 py-2 bg-slate-950 text-white font-black text-xs hover:bg-black transition-all"
                      >
                        {isRtl ? t('إقفال مالي نهائي') : 'Lock Run'}
                      </button>
                      <button 
                        onClick={() => updateRunStatus(selectedRun, 'Draft')}
                        className="px-3.5 py-2 bg-red-600 text-white font-black text-xs hover:bg-red-700 transition-all"
                      >
                        {isRtl ? t('إعادة فتح') : 'Reopen'}
                      </button>
                    </>
                  )}
                  {selectedRun.status === 'Locked' && (
                    <button 
                      onClick={() => updateRunStatus(selectedRun, 'Draft')}
                      className="px-3.5 py-2 bg-red-600 text-white font-black text-xs hover:bg-red-700 transition-all"
                    >
                      {isRtl ? t('إعادة فتح المسير المغلق') : 'Reopen Locked Run'}
                    </button>
                  )}

                  <button 
                    onClick={() => exportToExcel(selectedRun, results)}
                    className="flex items-center gap-2 px-3.5 py-2 bg-gray-600 text-white font-black text-xs hover:bg-gray-700 transition-all"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{isRtl ? t('تصدير البدلات') : 'Export File'}</span>
                  </button>
                  <button onClick={() => setSelectedRun(null)} className="p-2 hover:bg-muted text-muted-foreground"><X className="w-6 h-6" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-8">
                {results.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-sm font-medium">
                    {isRtl ? t('لا توجد مأموريات تطابق الفلاتر في هذه الفترة.') : 'No allowances generated under this run.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className={cn("w-full min-w-[800px]", isRtl ? "text-right" : "text-left")}>
                      <thead className="sticky top-0 bg-card z-10 border-b border-border">
                        <tr>
                          <th className="pb-4 text-xs font-black text-muted-foreground uppercase">{isRtl ? t('الموظف') : 'Employee'}</th>
                          <th className="pb-4 text-xs font-black text-muted-foreground uppercase">{isRtl ? t('الجهة/الموقع') : 'Destination'}</th>
                          <th className="pb-4 text-xs font-black text-muted-foreground uppercase">{isRtl ? t('الفترة') : 'Dates'}</th>
                          <th className="pb-4 text-xs font-black text-muted-foreground uppercase">{isRtl ? t('الأيام') : 'Days'}</th>
                          <th className="pb-4 text-xs font-black text-muted-foreground uppercase">{isRtl ? t('المبلغ اليومي') : 'Daily Rate'}</th>
                          <th className="pb-4 text-xs font-black text-muted-foreground uppercase">{isRtl ? t('طريقة الصرف') : 'Payment Method'}</th>
                          <th className="pb-4 text-xs font-black text-muted-foreground uppercase">{isRtl ? t('الصافي') : 'Net Benefit'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {results.map((r) => (
                          <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-4 text-sm font-bold text-foreground">{r.employeeName}</td>
                            <td className="py-4 text-sm text-muted-foreground">{r.destination}</td>
                            <td className="py-4 text-sm text-muted-foreground font-mono">{r.missionDateFrom} ⇆ {r.missionDateTo}</td>
                            <td className="py-4 text-sm text-muted-foreground font-black">{r.missionDays}</td>
                            <td className="py-4 text-sm text-muted-foreground">{formatCurrency(r.dailyAllowanceRate)}</td>
                            <td className="py-4 text-sm">
                              <span className={cn(
                                "px-2 py-0.5 text-[10px] font-black border",
                                r.paymentMethod === 'Bank' ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                              )}>{r.paymentMethod === 'Bank' ? (isRtl ? t('بنك') : 'Bank') : (isRtl ? t('كاش') : 'Cash')}</span>
                            </td>
                            <td className="py-4 text-sm font-black text-emerald-600">+{formatCurrency(r.totalAllowanceAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Run Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card w-full max-w-md rounded-none shadow-2xl p-8 border border-border">
              <h3 className="text-xl font-black text-foreground mb-6 text-center">
                {isRtl ? t('احتساب بدلات مأموريات جديدة مستقلة') : 'New Mission Allowance Run'}
              </h3>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{isRtl ? t('من تاريخ مأموريات') : 'Period From'}</label>
                    <input type="date" className="w-full px-4 py-3 bg-muted border border-border focus:ring-1 focus:ring-primary outline-none font-bold text-foreground text-xs" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{isRtl ? t('إلى تاريخ مأموريات') : 'Period To'}</label>
                    <input type="date" className="w-full px-4 py-3 bg-muted border border-border focus:ring-1 focus:ring-primary outline-none font-bold text-foreground text-xs" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{isRtl ? t('ملاحظات') : 'Notes/Description'}</label>
                  <textarea 
                    className="w-full h-20 px-4 py-3 bg-muted border border-border focus:ring-1 focus:ring-primary outline-none font-medium text-foreground text-xs resize-none"
                    placeholder={isRtl ? t('ملاحظات إضافية على هذا المسير...') : 'Description notes...'}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="p-4 bg-primary/10 rounded-none border border-primary/20">
                  <p className="text-[11px] text-primary font-bold leading-relaxed">
                    {isRtl ? t('سيقوم الخادم تلقائيًا بالاستعلام عن المأموريات المعتمدة خلال هذه الفترة وصرف بدلاتها المستقلة، مع مراعاة منع التكرار تمامًا ماليًا.')
                          : 'The server will select unpaid approved missions in this range and compute payouts instantly while safely checking for potential double payouts.'}
                  </p>
                </div>

                <button 
                  onClick={createRun}
                  disabled={isGenerating}
                  className="w-full py-4 bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{isRtl ? t('جاري الاستعلام والاحتساب...') : 'CALCULATING...'}</span>
                    </>
                  ) : (
                    <span>{isRtl ? t('بدء الاحتساب وإنشاء المسير') : 'START COMPUTATION'}</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
