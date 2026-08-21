import React, { useState } from 'react';
import { 
  Printer, 
  X, 
  RotateCcw, 
  Fingerprint, 
  AlertTriangle, 
  Building2, 
  Calendar, 
  Briefcase, 
  User, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Clock, 
  Plane, 
  Home, 
  AlertCircle, 
  FileText,
  ShieldCheck,
  CreditCard,
  Layers,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Employee, Transaction } from '../../types';
import { useData } from '../../contexts/DataContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatCurrency, cn } from '../../lib/utils';
import { calculateEmployeeMonthlyAttendance } from '../../utils/monthlyAttendanceCalculation';
import { MonthlyJobCardPrintable } from './MonthlyJobCardPrintable';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface MonthlyPayCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  payCard: Transaction | null;
  employee: Employee | null;
  onOpenAttendanceDetails?: (emp: Employee, monthStr?: string) => void;
  onSyncApproved?: (empId: string) => void;
  isSyncingApproved?: boolean;
  onOpenDeductionsBreakdown?: () => void;
}

export const MonthlyPayCardModal: React.FC<MonthlyPayCardModalProps> = ({
  isOpen,
  onClose,
  payCard,
  employee,
  onOpenAttendanceDetails,
  onSyncApproved,
  isSyncingApproved = false,
  onOpenDeductionsBreakdown,
}) => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const [printDocType, setPrintDocType] = useState<'pay-card' | 'job-card'>('job-card');
  const { 
    systemSettings, 
    adminDepartments,
    attendanceRecords,
    attendanceShifts,
    missions,
    leaveRequests,
    absenceRecords,
    absenceTypes,
    administrativeNotices
  } = useData();

  if (!isOpen || !payCard || !employee) return null;

  const orgName = systemSettings?.organizationName || (isRtl ? 'شركة الأفق الرقمي للتجارة والتقنية' : 'Paradise Solutions');
  const logoUrl = systemSettings?.logoUrl || '';
  const departmentName = adminDepartments.find(d => d.id === employee.departmentId)?.name || employee.departmentId || (isRtl ? 'الإدارة العامة' : 'General Admin');
  const shift = (attendanceShifts || []).find(s => s.id === employee.shiftId);

  const [yearStr, monthNumStr] = (payCard.month || '').split('-');
  const monthNamesAr = [
    'يناير (01)', 'فبراير (02)', 'مارس (03)', 'أبريل (04)', 'مايو (05)', 'يونيو (06)',
    'يوليو (07)', 'أغسطس (08)', 'سبتمبر (09)', 'أكتوبر (10)', 'نوفمبر (11)', 'ديسمبر (12)'
  ];
  const monthNamesEn = [
    'January (01)', 'February (02)', 'March (03)', 'April (04)', 'May (05)', 'June (06)',
    'July (07)', 'August (08)', 'September (09)', 'October (10)', 'November (11)', 'December (12)'
  ];
  const monthIndex = parseInt(monthNumStr, 10) - 1;
  const monthDisplayName = (!isNaN(monthIndex) && (isRtl ? monthNamesAr[monthIndex] : monthNamesEn[monthIndex]))
    ? (isRtl ? monthNamesAr[monthIndex] : monthNamesEn[monthIndex])
    : payCard.month;

  // Unified attendance calculations for summary and matrix
  const { days: monthlyDays, stats } = calculateEmployeeMonthlyAttendance({
    employee,
    month: payCard.month,
    attendanceRecords,
    attendanceShifts,
    missions,
    leaveRequests,
    absenceRecords,
    absenceTypes,
    administrativeNotices,
    language
  });

  const shiftName = shift 
    ? `${shift.name} (${shift.startTime} - ${shift.endTime})` 
    : (stats.shiftName || (isRtl ? 'الوردية الصباحية المعتمدة' : 'Standard Shift'));

  const attendanceDaysCount = stats.presentCount;
  const missionsDaysCount = stats.missionCount;
  const wfhDaysCount = stats.wfhCount;
  const absenceDaysCount = payCard.absenceDays !== undefined ? payCard.absenceDays : stats.absentCount;
  const leavesDaysCount = stats.leaveCount;
  const totalDelayMins = stats.totalDelayMins;
  const totalOvertimeMins = stats.totalOvertimeMins;

  // Breakdown of Allowances & other earnings
  const allowancesAndOtherIncome = [
    { label: t('بدل سكن / Housing Allowance'), val: payCard.housingAllowance },
    { label: t('بدل نقل / Transport Allowance'), val: payCard.transportAllowance },
    { label: t('بدل إعاشة / Subsistence Allowance'), val: payCard.subsistenceAllowance },
    { label: t('بدل إدارة وإشراف / Management Allowance'), val: payCard.managementAllowance },
    { label: t('بدل اتصال وهاتف / Mobile Allowance'), val: payCard.mobileAllowance },
    { label: t('بدل مأموريات / Mission Allowance'), val: payCard.missionAllowance },
    { label: t('بدلات واستحقاقات أخرى / Other Allowances'), val: payCard.otherAllowances },
    { label: t('مكافآت وإضافات أخرى / Other Income'), val: payCard.otherIncome },
    { label: t('زيادة راتب / Salary Increase'), val: payCard.salaryIncrease },
  ].filter(item => item.val !== undefined && item.val > 0);

  // Breakdown of Penalties and deductions
  const penaltiesAndDeductions = [
    { 
      label: `${t('خصم أيام الغياب بدون مرتب')} (${payCard.absenceDays || 0} ${t('يوم')}) / Unpaid Absence`, 
      val: payCard.absenceDeduction 
    },
    { 
      label: `${t('خصم أيام الإجازة بدون مرتب')} (${payCard.unpaidLeaveDays || 0} ${t('يوم')}) / Unpaid Leave`, 
      val: payCard.unpaidLeaveDeduction 
    },
    { 
      label: t('خصم التأخر والانصراف المبكر / Late & Early Departure'), 
      val: payCard.departureDelayDeduction 
    },
    { 
      label: t('عقوبات وجزاءات مالية أخرى / Penalties & Financial Deductions'), 
      val: payCard.otherDeductions 
    },
  ].filter(item => item.val !== undefined && item.val > 0);

  // Breakdown of Advances / Loans / Pre-received
  const loansAndAdvances = [
    { label: t('سداد قسط قرض وسلف مستقطعة / Loan & Advances Repayment'), val: payCard.loans },
    { label: t('استلام مسبق (نقدي) / Pre-received Cash'), val: payCard.salaryReceived },
    { label: t('استلام مسبق (بنكي) / Pre-received Bank'), val: payCard.bankReceived },
  ].filter(item => item.val !== undefined && item.val > 0);

  // Trigger Print for Monthly Job Card (A4 Landscape - صفحة واحدة فقط)
  const handlePrintJobCard = () => {
    setPrintDocType('job-card');
    setTimeout(() => {
      window.print();
    }, 60);
  };

  // Trigger Print for Monthly Salary Card (A4 Portrait)
  const handlePrintPayCard = () => {
    setPrintDocType('pay-card');
    setTimeout(() => {
      window.print();
    }, 60);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-md overflow-y-auto print:p-0 print:m-0 print:bg-white print:static print:overflow-visible">
      {/* 1. SCREEN INTERACTIVE MODAL (Hidden on print) */}
      <motion.div 
        id="screen-monthly-paycard-modal"
        initial={{ opacity: 0, scale: 0.94, y: 15 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.94, y: 15 }} 
        className="relative bg-card text-card-foreground w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border-2 border-border flex flex-col max-h-[92vh] print:hidden"
      >
        {/* Header Toolbar */}
        <div className="p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-2xl text-primary border border-primary/20">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-foreground">{t('كارت الراتب والعمل الشهري')}</h3>
                <span className="px-3 py-0.5 rounded-full text-xs font-black bg-primary/15 text-primary border border-primary/25 font-mono">
                  {payCard.month}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-bold mt-0.5">
                {employee.name} • #{employee.employeeId || employee.id}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenAttendanceDetails && (
              <button 
                type="button"
                onClick={() => onOpenAttendanceDetails(employee, payCard.month)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/60 text-teal-800 dark:text-teal-300 font-black rounded-xl transition-all border border-teal-300 dark:border-teal-800 text-xs shadow-xs active:scale-95 cursor-pointer"
                title={t('عرض تفاصيل الحضور والانصراف والمؤثرات لهذا الشهر')}
              >
                <Fingerprint className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{t('تفاصيل الحضور')}</span>
              </button>
            )}

            {onSyncApproved && (
              <button 
                type="button"
                onClick={() => onSyncApproved(payCard.employeeId)}
                disabled={isSyncingApproved}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-black rounded-xl transition-all border border-emerald-300 dark:border-emerald-800 text-xs disabled:opacity-50 shadow-xs active:scale-95 cursor-pointer"
                title={t('مراجعة وترحيل المستحقات والاستقطاعات المعتمدة لهذا الموظف')}
              >
                <RotateCcw className={cn("w-4 h-4 text-emerald-600 dark:text-emerald-400", isSyncingApproved && "animate-spin")} />
                <span>{t('تحديث ومزامنة')}</span>
              </button>
            )}

            {/* زر طباعة كارت العمل الشهري (A4 Landscape - صفحة واحدة) */}
            <button 
              type="button"
              onClick={handlePrintJobCard}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white font-black rounded-xl transition-all text-xs shadow-sm active:scale-95 cursor-pointer"
              title={t('طباعة كارت العمل الشهري (A4 Landscape - صفحة واحدة)')}
            >
              <Printer className="w-4 h-4 text-teal-200" />
              <span>{t('طباعة كارت العمل')}</span>
            </button>

            {/* زر طباعة كارت الراتب الشهري (A4 Portrait) */}
            <button 
              type="button"
              onClick={handlePrintPayCard}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-xl transition-all text-xs shadow-md active:scale-95 cursor-pointer"
              title={t('طباعة كارت الراتب الشهري (A4 Portrait)')}
            >
              <Printer className="w-4 h-4" />
              <span>{t('طباعة كارت الراتب')}</span>
            </button>

            <button 
              type="button"
              onClick={onClose} 
              className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground cursor-pointer"
              title={t('إغلاق')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[calc(92vh-100px)] custom-scrollbar">
          {/* Employee Info Header */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 bg-muted/40 rounded-2xl border border-border">
            <div>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t('اسم الموظف')}</p>
              <p className="font-black text-foreground text-sm">{employee.name}</p>
            </div>
            <div>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t('الرقم الوظيفي')}</p>
              <p className="font-black text-foreground text-sm font-mono">{employee.employeeId || employee.id}</p>
            </div>
            <div>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t('المسمى الوظيفي')}</p>
              <p className="font-black text-foreground text-sm">{employee.jobTitle || '—'}</p>
            </div>
            <div>
              <p className="text-[11px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t('الإدارة / القسم')}</p>
              <p className="font-black text-foreground text-sm">{departmentName}</p>
            </div>
          </div>

          {/* Monthly Attendance Summary Strip */}
          <div className="border-2 border-border rounded-2xl p-4 bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-xs uppercase tracking-wider text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <span>{t('ملخص الحضور والانصراف المرتبط بالشهر')}</span>
              </h4>
              <span className="text-xs font-bold text-muted-foreground">
                {t('أيام العمل الفعلية')}: <strong className="text-foreground font-black font-mono">{payCard.actualWorkDays}</strong> {t('يوم')}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 text-center text-xs">
              <div className="p-3 bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 dark:border-emerald-700/50 rounded-xl">
                <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 block mb-1">{t('الحضور')}</span>
                <span className="font-black text-emerald-950 dark:text-emerald-200 font-mono text-sm">{attendanceDaysCount} {t('يوم')}</span>
              </div>
              <div className="p-3 bg-rose-500/10 dark:bg-rose-950/30 border border-rose-500/30 dark:border-rose-700/50 rounded-xl">
                <span className="text-[10px] font-black text-rose-800 dark:text-rose-400 block mb-1">{t('الغياب')}</span>
                <span className="font-black text-rose-950 dark:text-rose-200 font-mono text-sm">{absenceDaysCount} {t('يوم')}</span>
              </div>
              <div className="p-3 bg-teal-500/10 dark:bg-teal-950/30 border border-teal-500/30 dark:border-teal-700/50 rounded-xl">
                <span className="text-[10px] font-black text-teal-800 dark:text-teal-400 block mb-1">{t('المأموريات')}</span>
                <span className="font-black text-teal-950 dark:text-teal-200 font-mono text-sm">{missionsDaysCount} {t('يوم')}</span>
              </div>
              <div className="p-3 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 dark:border-amber-700/50 rounded-xl">
                <span className="text-[10px] font-black text-amber-800 dark:text-amber-400 block mb-1">{t('الإجازات')}</span>
                <span className="font-black text-amber-950 dark:text-amber-200 font-mono text-sm">{leavesDaysCount} {t('يوم')}</span>
              </div>
              <div className="p-3 bg-indigo-500/10 dark:bg-indigo-950/30 border border-indigo-500/30 dark:border-indigo-700/50 rounded-xl">
                <span className="text-[10px] font-black text-indigo-800 dark:text-indigo-400 block mb-1">{t('العمل عن بُعد')}</span>
                <span className="font-black text-indigo-950 dark:text-indigo-200 font-mono text-sm">{wfhDaysCount} {t('يوم')}</span>
              </div>
              <div className="p-3 bg-orange-500/10 dark:bg-orange-950/30 border border-orange-500/30 dark:border-orange-700/50 rounded-xl">
                <span className="text-[10px] font-black text-orange-800 dark:text-orange-400 block mb-1">{t('التأخير')}</span>
                <span className="font-black text-orange-950 dark:text-orange-200 font-mono text-sm">{totalDelayMins} {t('دقيقة')}</span>
              </div>
              <div className="p-3 bg-blue-500/10 dark:bg-blue-950/30 border border-blue-500/30 dark:border-blue-700/50 rounded-xl">
                <span className="text-[10px] font-black text-blue-800 dark:text-blue-400 block mb-1">{t('إضافي العمل')}</span>
                <span className="font-black text-blue-950 dark:text-blue-200 font-mono text-sm">{(totalOvertimeMins / 60).toFixed(1)} {t('ساعة')}</span>
              </div>
            </div>
          </div>

          {/* Financial Breakdown (2 Columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings */}
            <div className="p-5 bg-emerald-500/10 dark:bg-emerald-950/20 border-2 border-emerald-500/30 dark:border-emerald-700/40 rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-emerald-500/20 dark:border-emerald-800/40">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                  <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                  <h4 className="font-black text-sm uppercase tracking-wide">{t('الاستحقاقات / Earnings')}</h4>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-emerald-500/10">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{t('الراتب الأساسي')}</span>
                  <span className="font-black text-emerald-800 dark:text-emerald-300 font-mono text-sm tabular-nums">{formatCurrency(payCard.basicSalary)}</span>
                </div>

                {payCard.overtimeValue > 0 && (
                  <div className="flex justify-between items-center py-1 border-b border-emerald-500/10">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {t('إضافي العمل')} {payCard.overtimeHours > 0 ? `(${payCard.overtimeHours} ${t('ساعة')})` : ''}
                    </span>
                    <span className="font-black text-emerald-800 dark:text-emerald-300 font-mono text-sm tabular-nums">{formatCurrency(payCard.overtimeValue)}</span>
                  </div>
                )}

                {allowancesAndOtherIncome.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-emerald-500/10">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                    <span className="font-black text-emerald-800 dark:text-emerald-300 font-mono text-sm tabular-nums">{formatCurrency(item.val || 0)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t-2 border-emerald-500/30 dark:border-emerald-700/50 flex justify-between items-center bg-emerald-500/10 -mx-5 -mb-5 p-4 rounded-b-2xl">
                <span className="font-black text-emerald-900 dark:text-emerald-200 text-xs uppercase">{t('إجمالي الاستحقاقات')}</span>
                <span className="font-black text-emerald-900 dark:text-emerald-200 text-lg font-mono tabular-nums">+{formatCurrency(payCard.totalIncome)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="p-5 bg-rose-500/10 dark:bg-rose-950/20 border-2 border-rose-500/30 dark:border-rose-700/40 rounded-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b-2 border-rose-500/20 dark:border-rose-800/40">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300">
                  <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
                  <h4 className="font-black text-sm uppercase tracking-wide">{t('الاستقطاعات / Deductions')}</h4>
                </div>
                {onOpenDeductionsBreakdown && (
                  <button
                    type="button"
                    onClick={onOpenDeductionsBreakdown}
                    className="flex items-center gap-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-300 px-2.5 py-1 rounded-lg text-[11px] font-black transition-all border border-rose-500/30 dark:border-rose-800 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>{t('تفاصيل الجزاءات')}</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5 text-xs">
                {payCard.socialInsurance > 0 && (
                  <div className="flex justify-between items-center py-1 border-b border-rose-500/10">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{t('التأمينات الاجتماعية')}</span>
                    <span className="font-black text-rose-700 dark:text-rose-300 font-mono text-sm tabular-nums">-{formatCurrency(payCard.socialInsurance)}</span>
                  </div>
                )}

                {(payCard.taxValue !== undefined && payCard.taxValue > 0) && (
                  <div className="flex justify-between items-center py-1 border-b border-rose-500/10">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{t('ضريبة كسب العمل')}</span>
                    <span className="font-black text-rose-700 dark:text-rose-300 font-mono text-sm tabular-nums">-{formatCurrency(payCard.taxValue)}</span>
                  </div>
                )}

                {penaltiesAndDeductions.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-rose-500/10">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                    <span className="font-black text-rose-700 dark:text-rose-300 font-mono text-sm tabular-nums">-{formatCurrency(item.val || 0)}</span>
                  </div>
                ))}

                {loansAndAdvances.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center py-1 border-b border-rose-500/10">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.label}</span>
                    <span className="font-black text-rose-700 dark:text-rose-300 font-mono text-sm tabular-nums">-{formatCurrency(item.val || 0)}</span>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t-2 border-rose-500/30 dark:border-rose-700/50 flex justify-between items-center bg-rose-500/10 -mx-5 -mb-5 p-4 rounded-b-2xl">
                <span className="font-black text-rose-900 dark:text-rose-200 text-xs uppercase">{t('إجمالي الاستقطاعات')}</span>
                <span className="font-black text-rose-900 dark:text-rose-200 text-lg font-mono tabular-nums">-{formatCurrency(payCard.totalDeductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Result Bar (Adapts strictly to Global Theme) */}
          <div className="p-6 bg-slate-100 dark:bg-slate-900/90 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-700/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
            <div>
              <h4 className="text-lg font-black text-foreground">{t('صافي المستحق النهائي')}</h4>
              <p className="text-xs text-primary font-bold uppercase tracking-widest mt-0.5">Final Net Payable Amount</p>
            </div>
            <div className="text-right">
              <span className="text-3xl sm:text-4xl font-black font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                {formatCurrency(payCard.netSalary)}
              </span>
              <p className="text-xs font-bold text-muted-foreground mt-1">{t('مستحق الصرف والتحويل')}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 2. OFFICIAL PRINTABLE DOCUMENTS */}
      {printDocType === 'job-card' ? (
        <MonthlyJobCardPrintable
          employee={employee}
          month={payCard.month}
          days={monthlyDays}
          stats={stats}
          orgName={orgName}
          logoUrl={logoUrl}
          departmentName={departmentName}
          shiftName={shiftName}
          isRtl={isRtl}
        />
      ) : (
        /* OFFICIAL A4 PORTRAIT PRINTABLE PAY CARD DOCUMENT (Visible ONLY on print) */
        <div 
          id="monthly-paycard-printable-document"
          className="hidden print:block print:w-full bg-white text-slate-900 p-0 m-0 font-sans"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <style dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 8mm 8mm 8mm 8mm;
                }
                body {
                  background: white !important;
                  color: #0f172a !important;
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                #screen-monthly-paycard-modal, .no-print, header, nav, aside {
                  display: none !important;
                }
                #monthly-paycard-printable-document {
                  display: block !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                table {
                  page-break-inside: avoid;
                }
              }
            `
          }} />

        <div className="w-full space-y-3.5">
          {/* Header Section: Top Right (Org Name), Center (Title), Top Left (Logo) */}
          <div className="flex justify-between items-center pb-2.5 border-b-2 border-slate-900">
            {/* Top Right: اسم المنشأة */}
            <div className="w-[33%] text-right space-y-0.5">
              <h1 className="text-[13px] font-black text-slate-900 tracking-tight leading-tight">
                {orgName}
              </h1>
              <p className="text-[8.5px] font-bold text-slate-600">
                {isRtl ? 'سجل الرواتب والأجور الشهرية المعتمدة' : 'Official Monthly Payroll Record'}
              </p>
              <p className="text-[7.5px] font-semibold text-slate-500 font-mono">
                REF: PAY-{payCard.month}-{employee.employeeId || employee.id}
              </p>
            </div>

            {/* Center: العنوان في المنتصف */}
            <div className="w-[34%] text-center space-y-0.5">
              <div className="inline-block bg-slate-900 text-white px-3.5 py-1 rounded-sm">
                <h2 className="text-[12.5px] font-black uppercase tracking-wider">
                  {isRtl ? 'كارت الراتب الشهري' : 'Monthly Salary Card'}
                </h2>
              </div>
              <p className="text-[9px] font-black text-slate-800 tracking-tight font-mono">
                {isRtl ? `عن شهر: ${monthDisplayName} ${yearStr}م` : `Period: ${monthDisplayName} ${yearStr}`}
              </p>
            </div>

            {/* Top Left: شعار المنشأة */}
            <div className="w-[33%] flex justify-end items-center">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="h-10 max-h-12 w-auto max-w-[130px] object-contain bg-transparent" 
                  referrerPolicy="no-referrer" 
                  crossOrigin="anonymous" 
                />
              ) : (
                <div className="h-10 px-3 border border-slate-300 flex items-center justify-center gap-1.5 text-slate-800 bg-slate-50">
                  <Building2 className="w-4 h-4 text-slate-700" />
                  <span className="text-[8.5px] font-black">{orgName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Employee Metadata Box */}
          <div className="border border-slate-900 bg-slate-50/70 p-2 text-[9px] font-bold text-slate-800">
            <div className="grid grid-cols-5 gap-2">
              <div className="border-l border-slate-200 pl-2">
                <span className="text-[7.5px] text-slate-500 font-bold block">{isRtl ? 'اسم الموظف' : 'Employee Name'}</span>
                <span className="text-[9.5px] font-black text-slate-900 block truncate">{employee.name}</span>
              </div>
              <div className="border-l border-slate-200 pl-2">
                <span className="text-[7.5px] text-slate-500 font-bold block">{isRtl ? 'الكود الوظيفي' : 'Employee ID'}</span>
                <span className="text-[9.5px] font-black text-slate-900 block font-mono">#{employee.employeeId || employee.id}</span>
              </div>
              <div className="border-l border-slate-200 pl-2">
                <span className="text-[7.5px] text-slate-500 font-bold block">{isRtl ? 'المسمى الوظيفي' : 'Job Title'}</span>
                <span className="text-[9.5px] font-black text-slate-900 block truncate">{employee.jobTitle || '—'}</span>
              </div>
              <div className="border-l border-slate-200 pl-2">
                <span className="text-[7.5px] text-slate-500 font-bold block">{isRtl ? 'الإدارة / القسم' : 'Department'}</span>
                <span className="text-[9.5px] font-black text-slate-900 block truncate">{departmentName}</span>
              </div>
              <div>
                <span className="text-[7.5px] text-slate-500 font-bold block">{isRtl ? 'الشهر والسنة' : 'Month & Year'}</span>
                <span className="text-[9.5px] font-black text-slate-900 block font-mono">{monthDisplayName} {yearStr}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-1.5 pt-1.5 border-t border-slate-200 text-[8px]">
              <div>
                <span className="text-slate-500">{isRtl ? 'أيام العمل المقررة: ' : 'Working Days: '}</span>
                <span className="font-black text-slate-900 font-mono">{payCard.actualWorkDays} {isRtl ? 'يوم' : 'Days'}</span>
              </div>
              <div>
                <span className="text-slate-500">{isRtl ? 'حالة الاعتماد: ' : 'Status: '}</span>
                <span className="font-black text-slate-900">{payCard.status === 'Completed' ? (isRtl ? 'معتمد ومكتمل' : 'Approved & Completed') : (isRtl ? 'مسودة معتمدة' : 'Draft')}</span>
              </div>
              <div className="text-left">
                <span className="text-slate-500">{isRtl ? 'تاريخ التوليد: ' : 'Generated: '}</span>
                <span className="font-bold font-mono text-slate-700">{format(new Date(), 'yyyy-MM-dd HH:mm')}</span>
              </div>
            </div>
          </div>

          {/* Monthly Attendance Summary Table */}
          <div className="border border-slate-900 overflow-hidden">
            <div className="bg-slate-900 text-white px-2 py-1 flex items-center justify-between text-[8.5px] font-black">
              <span>{isRtl ? 'ملخص الحضور والانصراف المرتبط بالشهر' : 'Monthly Attendance & Operations Summary'}</span>
              <span className="text-[7.5px] font-normal">{isRtl ? 'سجل البصمات والمؤثرات المعتمدة' : 'Approved Attendance Stats'}</span>
            </div>
            <div className="grid grid-cols-7 divide-x divide-slate-300 divide-x-reverse text-center text-[8px] bg-white">
              <div className="p-1.5">
                <span className="text-slate-500 block mb-0.5">{isRtl ? 'الحضور' : 'Present'}</span>
                <span className="font-black text-emerald-700 text-[9.5px] font-mono">{attendanceDaysCount} {isRtl ? 'يوم' : 'd'}</span>
              </div>
              <div className="p-1.5">
                <span className="text-slate-500 block mb-0.5">{isRtl ? 'الغياب' : 'Absent'}</span>
                <span className="font-black text-red-700 text-[9.5px] font-mono">{absenceDaysCount} {isRtl ? 'يوم' : 'd'}</span>
              </div>
              <div className="p-1.5">
                <span className="text-slate-500 block mb-0.5">{isRtl ? 'المأموريات' : 'Missions'}</span>
                <span className="font-black text-teal-700 text-[9.5px] font-mono">{missionsDaysCount} {isRtl ? 'يوم' : 'd'}</span>
              </div>
              <div className="p-1.5">
                <span className="text-slate-500 block mb-0.5">{isRtl ? 'الإجازات' : 'Leaves'}</span>
                <span className="font-black text-amber-700 text-[9.5px] font-mono">{leavesDaysCount} {isRtl ? 'يوم' : 'd'}</span>
              </div>
              <div className="p-1.5">
                <span className="text-slate-500 block mb-0.5">{isRtl ? 'العمل عن بُعد' : 'WFH'}</span>
                <span className="font-black text-indigo-700 text-[9.5px] font-mono">{wfhDaysCount} {isRtl ? 'يوم' : 'd'}</span>
              </div>
              <div className="p-1.5">
                <span className="text-slate-500 block mb-0.5">{isRtl ? 'التأخير' : 'Delay'}</span>
                <span className="font-black text-orange-700 text-[9.5px] font-mono">{totalDelayMins} {isRtl ? 'دقيقة' : 'm'}</span>
              </div>
              <div className="p-1.5">
                <span className="text-slate-500 block mb-0.5">{isRtl ? 'الإضافي' : 'Overtime'}</span>
                <span className="font-black text-blue-700 text-[9.5px] font-mono">{(totalOvertimeMins / 60).toFixed(1)} {isRtl ? 'ساعة' : 'h'}</span>
              </div>
            </div>
          </div>

          {/* Earnings and Deductions 2-Column Tables */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* 1. الاستحقاقات */}
            <div className="border border-slate-900 flex flex-col justify-between">
              <div>
                <div className="bg-slate-100 border-b border-slate-900 px-2 py-1 flex justify-between items-center">
                  <span className="font-black text-[9px] text-slate-900">{isRtl ? 'الاستحقاقات (Earnings)' : 'Earnings'}</span>
                  <span className="text-[7.5px] font-bold text-slate-600">{isRtl ? 'المبلغ' : 'Amount'}</span>
                </div>
                <table className="w-full text-[8px] text-right border-collapse">
                  <tbody className="divide-y divide-slate-200">
                    <tr className="bg-white">
                      <td className="p-1 font-bold text-slate-700">{isRtl ? 'الراتب الأساسي' : 'Basic Salary'}</td>
                      <td className="p-1 font-black text-slate-900 font-mono text-left">{formatCurrency(payCard.basicSalary)}</td>
                    </tr>
                    {payCard.overtimeValue > 0 && (
                      <tr className="bg-slate-50/50">
                        <td className="p-1 font-bold text-slate-700">
                          {isRtl ? 'إضافي العمل' : 'Overtime'} {payCard.overtimeHours > 0 ? `(${payCard.overtimeHours} ${isRtl ? 'ساعة' : 'h'})` : ''}
                        </td>
                        <td className="p-1 font-black text-slate-900 font-mono text-left">{formatCurrency(payCard.overtimeValue)}</td>
                      </tr>
                    )}
                    {allowancesAndOtherIncome.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-1 font-bold text-slate-700">{item.label}</td>
                        <td className="p-1 font-black text-slate-900 font-mono text-left">{formatCurrency(item.val || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Earnings Footer */}
              <div className="bg-slate-100 border-t border-slate-900 p-1.5 flex justify-between items-center text-[9px]">
                <span className="font-black text-slate-900">{isRtl ? 'إجمالي الاستحقاقات' : 'Total Earnings'}</span>
                <span className="font-black text-emerald-800 font-mono text-[10px]">{formatCurrency(payCard.totalIncome)}</span>
              </div>
            </div>

            {/* 2. الاستقطاعات */}
            <div className="border border-slate-900 flex flex-col justify-between">
              <div>
                <div className="bg-slate-100 border-b border-slate-900 px-2 py-1 flex justify-between items-center">
                  <span className="font-black text-[9px] text-slate-900">{isRtl ? 'الاستقطاعات (Deductions)' : 'Deductions'}</span>
                  <span className="text-[7.5px] font-bold text-slate-600">{isRtl ? 'المبلغ' : 'Amount'}</span>
                </div>
                <table className="w-full text-[8px] text-right border-collapse">
                  <tbody className="divide-y divide-slate-200">
                    {payCard.socialInsurance > 0 && (
                      <tr className="bg-white">
                        <td className="p-1 font-bold text-slate-700">{isRtl ? 'التأمينات الاجتماعية' : 'Social Insurance'}</td>
                        <td className="p-1 font-black text-red-700 font-mono text-left">-{formatCurrency(payCard.socialInsurance)}</td>
                      </tr>
                    )}
                    {(payCard.taxValue !== undefined && payCard.taxValue > 0) && (
                      <tr className="bg-slate-50/50">
                        <td className="p-1 font-bold text-slate-700">{isRtl ? 'ضريبة كسب العمل' : 'Income Tax'}</td>
                        <td className="p-1 font-black text-red-700 font-mono text-left">-{formatCurrency(payCard.taxValue)}</td>
                      </tr>
                    )}
                    {penaltiesAndDeductions.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-1 font-bold text-slate-700">{item.label}</td>
                        <td className="p-1 font-black text-red-700 font-mono text-left">-{formatCurrency(item.val || 0)}</td>
                      </tr>
                    ))}
                    {loansAndAdvances.map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                        <td className="p-1 font-bold text-slate-700">{item.label}</td>
                        <td className="p-1 font-black text-red-700 font-mono text-left">-{formatCurrency(item.val || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Deductions Footer */}
              <div className="bg-slate-100 border-t border-slate-900 p-1.5 flex justify-between items-center text-[9px]">
                <span className="font-black text-slate-900">{isRtl ? 'إجمالي الاستقطاعات' : 'Total Deductions'}</span>
                <span className="font-black text-red-700 font-mono text-[10px]">-{formatCurrency(payCard.totalDeductions)}</span>
              </div>
            </div>
          </div>

          {/* 3. النتيجة النهائية: صافي المستحق النهائي بشكل بارز */}
          <div className="border-2 border-slate-900 bg-slate-900 text-white p-2.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider block">
                {isRtl ? 'صافي المستحق النهائي' : 'Final Net Payable Amount'}
              </span>
              <span className="text-[8px] text-slate-300 font-bold block mt-0.5">
                {isRtl ? 'المبلغ الصافي واجب الصرف للموظف عن الشهر المحدد' : 'Net salary approved for bank transfer / payment'}
              </span>
            </div>
            <div className="text-left font-mono">
              <span className="text-xl font-black text-emerald-400 tracking-tight">
                {formatCurrency(payCard.netSalary)}
              </span>
            </div>
          </div>

          {/* 4. Signatures & Official Accreditation Strip */}
          <div className="border border-slate-900 p-2 bg-slate-50/50">
            <div className="grid grid-cols-4 gap-3 text-center text-[8px]">
              <div className="space-y-6">
                <span className="font-black text-slate-800 block">{isRtl ? 'توقيع الموظف المستلم' : 'Employee Signature'}</span>
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                <span className="text-[7px] text-slate-400 font-mono block">DATE: ___/___/202_</span>
              </div>

              <div className="space-y-6">
                <span className="font-black text-slate-800 block">{isRtl ? 'إعداد ومراجعة الحسابات' : 'Payroll Accountant'}</span>
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                <span className="text-[7px] text-slate-400 font-mono block">SIGN: _____________</span>
              </div>

              <div className="space-y-6">
                <span className="font-black text-slate-800 block">{isRtl ? 'اعتماد الموارد البشرية' : 'HR Manager'}</span>
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                <span className="text-[7px] text-slate-400 font-mono block">SIGN: _____________</span>
              </div>

              <div className="space-y-6">
                <span className="font-black text-slate-800 block">{isRtl ? 'اعتماد الإدارة / الختم' : 'General Approval & Stamp'}</span>
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                <span className="text-[7px] text-slate-400 font-mono block">STAMP / SEAL</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
