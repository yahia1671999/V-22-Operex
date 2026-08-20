import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Briefcase, 
  Plane, 
  Home, 
  Sun, 
  CalendarDays, 
  Filter, 
  User, 
  Sparkles,
  Info,
  Building2,
  Fingerprint
} from 'lucide-react';
import { 
  Employee, 
  AttendanceRecord, 
  AttendanceShift, 
  Mission, 
  LeaveRequest, 
  AbsenceRecord, 
  AbsenceType as AbsenceTypeModel,
  AdministrativeNotice
} from '../../types';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../lib/utils';
import {
  MonthlyDayAttendanceDetail,
  calculateEmployeeMonthlyAttendance
} from '../../utils/monthlyAttendanceCalculation';

export type { MonthlyDayAttendanceDetail };

interface MonthlyAttendanceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  month: string; // YYYY-MM
  attendanceRecords: AttendanceRecord[];
  attendanceShifts: AttendanceShift[];
  missions: Mission[];
  leaveRequests: LeaveRequest[];
  absenceRecords: AbsenceRecord[];
  absenceTypes: AbsenceTypeModel[];
  administrativeNotices?: AdministrativeNotice[];
}

export const MonthlyAttendanceDetailsModal: React.FC<MonthlyAttendanceDetailsModalProps> = ({
  isOpen,
  onClose,
  employee,
  month,
  attendanceRecords,
  attendanceShifts,
  missions,
  leaveRequests,
  absenceRecords,
  absenceTypes,
  administrativeNotices = []
}) => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract shift
  const shift = useMemo(() => {
    if (!employee) return null;
    return attendanceShifts.find(s => s.id === employee.shiftId) || attendanceShifts[0] || null;
  }, [employee, attendanceShifts]);

  // Compute daily breakdown and KPI statistics using the single source of truth
  const calculationResult = useMemo(() => {
    if (!employee || !month) {
      return {
        days: [],
        stats: {
          presentCount: 0,
          lateCount: 0,
          missionCount: 0,
          leaveCount: 0,
          wfhCount: 0,
          absentCount: 0,
          weekendHolidayCount: 0,
          totalDelayMins: 0,
          totalOvertimeMins: 0,
          totalDays: 0,
          shiftName: isRtl ? 'بدون تقويم عمل' : 'No Shift'
        }
      };
    }

    return calculateEmployeeMonthlyAttendance({
      employee,
      month,
      attendanceRecords,
      attendanceShifts,
      missions,
      leaveRequests,
      absenceRecords,
      absenceTypes,
      administrativeNotices,
      language
    });
  }, [
    employee,
    month,
    attendanceRecords,
    attendanceShifts,
    missions,
    leaveRequests,
    absenceRecords,
    absenceTypes,
    administrativeNotices,
    language,
    isRtl
  ]);

  const monthlyDays = calculationResult.days;
  const stats = calculationResult.stats;

  // Filtered rows for display
  const filteredDays = useMemo(() => {
    return monthlyDays.filter(d => {
      // Status filter
      if (filterStatus === 'present' && !['present', 'late', 'off_overtime'].includes(d.statusKey)) return false;
      if (filterStatus === 'late' && d.delayMinutes === 0) return false;
      if (filterStatus === 'overtime' && d.overtimeMinutes === 0) return false;
      if (filterStatus === 'mission' && d.statusKey !== 'mission') return false;
      if (filterStatus === 'leave' && d.statusKey !== 'leave') return false;
      if (filterStatus === 'wfh' && !d.isWfh) return false;
      if (filterStatus === 'absent' && d.statusKey !== 'absent') return false;
      if (filterStatus === 'holidays' && !['weekend', 'holiday'].includes(d.statusKey)) return false;

      // Query search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesDate = d.dateStr.includes(q);
        const matchesDay = d.dayName.toLowerCase().includes(q);
        const matchesStatus = d.statusLabel.toLowerCase().includes(q);
        const matchesLeave = d.leaveType.toLowerCase().includes(q);
        const matchesMission = d.missionName.toLowerCase().includes(q);
        const matchesNotes = d.notes.toLowerCase().includes(q);
        return matchesDate || matchesDay || matchesStatus || matchesLeave || matchesMission || matchesNotes;
      }

      return true;
    });
  }, [monthlyDays, filterStatus, searchQuery]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!employee || monthlyDays.length === 0) return;

    const headers = [
      isRtl ? 'التاريخ' : 'Date',
      isRtl ? 'اليوم' : 'Day',
      isRtl ? 'الحضور' : 'Check-In',
      isRtl ? 'الانصراف' : 'Check-Out',
      isRtl ? 'التأخير (دقيقة)' : 'Delay (Mins)',
      isRtl ? 'الإضافي (ساعة)' : 'Overtime (Hours)',
      isRtl ? 'حالة اليوم' : 'Day Status',
      isRtl ? 'نوع الإجازة' : 'Leave Type',
      isRtl ? 'المأمورية' : 'Mission',
      isRtl ? 'العمل عن بُعد' : 'Remote / WFH',
      isRtl ? 'العطلة الرسمية / الأسبوعية' : 'Official / Weekly Holiday',
      isRtl ? 'ملاحظات' : 'Notes'
    ];

    const rows = monthlyDays.map(d => [
      `"${d.dateStr}"`,
      `"${d.dayName}"`,
      `"${d.inTimeStr}"`,
      `"${d.outTimeStr}"`,
      d.delayMinutes,
      (d.overtimeMinutes / 60).toFixed(2),
      `"${d.statusLabel}"`,
      `"${d.leaveType}"`,
      `"${d.missionName}"`,
      `"${d.isWfh ? (isRtl ? 'نعم' : 'Yes') : '-'}"`,
      `"${d.holidayLabel}"`,
      `"${d.notes || d.deviceName || ''}"`
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Attendance_Details_${employee.name}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger Print
  const handlePrint = () => {
    window.print();
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto print:p-0 print:bg-white">
      <div 
        id="monthly-attendance-details-modal"
        className="relative w-full max-w-7xl bg-card text-foreground rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none"
      >
        {/* Modal Header */}
        <div className="px-6 py-5 bg-muted/40 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/20 shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  {t('تفاصيل الحضور الشهري')} - {employee.name}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {month}
                </span>
                <span className="px-2 py-0.5 text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-md">
                  #{employee.employeeId || employee.id}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400 font-bold">
                {employee.jobTitle && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                    {employee.jobTitle}
                  </span>
                )}
                {shift && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {shift.name} ({shift.startTime} - {shift.endTime})
                  </span>
                )}
                {employee.workMode && (
                  <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                    <Home className="w-3.5 h-3.5" />
                    {employee.workMode === 'Remotely Work' ? t('نظام عمل عن بُعد') : t('عمل مكتبي')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto print:hidden">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-sm active:scale-95"
              title={t('تصدير إكسيل')}
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>{t('تصدير Excel')}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-sm active:scale-95"
              title={t('طباعة التقرير')}
            >
              <Printer className="w-4 h-4 text-primary" />
              <span>{t('طباعة')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
              title={t('إغلاق')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* KPI Stats Bar */}
        <div className="p-4 sm:p-5 bg-slate-100/60 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3 text-center">
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 shadow-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{t('حضور فعلي')}</span>
            <span className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{stats.presentCount} {t('يوم')}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 shadow-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{t('تأخير')}</span>
            <span className="text-base font-black text-destructive mt-0.5 block">{stats.totalDelayMins} {t('دقيقة')}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 shadow-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{t('عمل إضافي')}</span>
            <span className="text-base font-black text-blue-600 dark:text-blue-400 mt-0.5 block">{(stats.totalOvertimeMins / 60).toFixed(1)} {t('ساعة')}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 shadow-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{t('مأموريات')}</span>
            <span className="text-base font-black text-purple-600 dark:text-purple-400 mt-0.5 block">{stats.missionCount} {t('يوم')}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 shadow-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{t('إجازات')}</span>
            <span className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5 block">{stats.leaveCount} {t('يوم')}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 shadow-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{t('عمل عن بُعد')}</span>
            <span className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">{stats.wfhCount} {t('يوم')}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 shadow-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{t('غياب')}</span>
            <span className="text-base font-black text-red-600 dark:text-red-400 mt-0.5 block">{stats.absentCount} {t('يوم')}</span>
          </div>
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 shadow-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">{t('عطلات')}</span>
            <span className="text-base font-black text-slate-600 dark:text-slate-300 mt-0.5 block">{stats.weekendHolidayCount} {t('يوم')}</span>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                filterStatus === 'all' 
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {t('الكل')} ({monthlyDays.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('present')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                filterStatus === 'present' 
                  ? "bg-emerald-600 text-white shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              )}
            >
              {t('حضور')} ({stats.presentCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('late')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                filterStatus === 'late' 
                  ? "bg-destructive text-white shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              )}
            >
              {t('تأخير')} ({stats.lateCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('overtime')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                filterStatus === 'overtime' 
                  ? "bg-blue-600 text-white shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              )}
            >
              {t('إضافي')}
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('mission')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                filterStatus === 'mission' 
                  ? "bg-purple-600 text-white shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-purple-50 dark:hover:bg-purple-950/30"
              )}
            >
              {t('مأموريات')} ({stats.missionCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('leave')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                filterStatus === 'leave' 
                  ? "bg-amber-600 text-white shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              )}
            >
              {t('إجازات')} ({stats.leaveCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('wfh')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                filterStatus === 'wfh' 
                  ? "bg-indigo-600 text-white shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              )}
            >
              {t('عمل عن بُعد')} ({stats.wfhCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('absent')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                filterStatus === 'absent' 
                  ? "bg-red-700 text-white shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              )}
            >
              {t('غياب')} ({stats.absentCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('holidays')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                filterStatus === 'holidays' 
                  ? "bg-slate-700 text-white shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
            >
              {t('عطلات')} ({stats.weekendHolidayCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('بحث بالتاريخ، اليوم، الحالة...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-9 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-teal-500 transition-all"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto flex-1 p-0">
          <table className="w-full text-right border-collapse min-w-[1000px]">
            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 shadow-xs">
              <tr className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-3.5 py-3 text-center w-12">#</th>
                <th className="px-4 py-3">{t('التاريخ')}</th>
                <th className="px-4 py-3">{t('اليوم')}</th>
                <th className="px-4 py-3">{t('الحضور')}</th>
                <th className="px-4 py-3">{t('الانصراف')}</th>
                <th className="px-3 py-3 text-center">{t('التأخير')}</th>
                <th className="px-3 py-3 text-center">{t('الإضافي')}</th>
                <th className="px-4 py-3">{t('حالة اليوم')}</th>
                <th className="px-4 py-3">{t('نوع الإجازة')}</th>
                <th className="px-4 py-3">{t('المأمورية')}</th>
                <th className="px-3 py-3 text-center">{t('العمل عن بُعد')}</th>
                <th className="px-4 py-3">{t('العطلة الرسمية')}</th>
                <th className="px-4 py-3">{t('ملاحظات')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-bold">
              {filteredDays.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-slate-400">
                    <CalendarDays className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="font-black text-sm">{t('لا توجد سجلات مطابقة للفلتر المحدد')}</p>
                  </td>
                </tr>
              ) : (
                filteredDays.map((d) => {
                  const isWeekendOrHoliday = d.statusKey === 'weekend' || d.statusKey === 'holiday';
                  const isLate = d.delayMinutes > 0;
                  const isOvertime = d.overtimeMinutes > 0;
                  const isAbsent = d.statusKey === 'absent';
                  const isMission = d.statusKey === 'mission';
                  const isLeave = d.statusKey === 'leave';
                  const isWfh = d.isWfh;

                  return (
                    <tr 
                      key={d.dateStr}
                      className={cn(
                        "transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-850/50",
                        isWeekendOrHoliday && "bg-slate-50/40 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400",
                        isAbsent && "bg-red-50/30 dark:bg-red-950/10",
                        isMission && "bg-purple-50/30 dark:bg-purple-950/10",
                        isLeave && "bg-amber-50/30 dark:bg-amber-950/10",
                        isWfh && "bg-indigo-50/30 dark:bg-indigo-950/10"
                      )}
                    >
                      {/* Day Number */}
                      <td className="px-3.5 py-3 text-center font-mono font-bold text-slate-400">
                        {d.dayNumber}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                        {d.dateStr}
                      </td>

                      {/* Day Name */}
                      <td className="px-4 py-3 font-black text-slate-700 dark:text-slate-300">
                        <span className={cn(
                          !d.isWorkDay && "text-slate-400 font-bold"
                        )}>
                          {d.dayName}
                        </span>
                      </td>

                      {/* Check-In */}
                      <td className="px-4 py-3 font-mono">
                        {d.firstIn ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-emerald-700 dark:text-emerald-400 font-black">
                              {d.inTimeStr}
                            </span>
                            {d.firstIn.manual && (
                              <span className="px-1 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                {t('يدوي')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Check-Out */}
                      <td className="px-4 py-3 font-mono">
                        {d.lastOut ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-700 dark:text-slate-300 font-black">
                              {d.outTimeStr}
                            </span>
                            {d.lastOut.manual && (
                              <span className="px-1 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                                {t('يدوي')}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Delay */}
                      <td className="px-3 py-3 text-center">
                        {isLate ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                            {d.delayMinutes} {t('د')}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Overtime */}
                      <td className="px-3 py-3 text-center">
                        {isOvertime ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {(d.overtimeMinutes / 60).toFixed(1)} {t('س')}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Day Status */}
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-black border",
                          d.statusKey === 'present' && "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
                          d.statusKey === 'late' && "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
                          d.statusKey === 'off_overtime' && "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
                          d.statusKey === 'mission' && "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
                          d.statusKey === 'leave' && "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
                          d.statusKey === 'wfh' && "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
                          d.statusKey === 'absent' && "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
                          d.statusKey === 'holiday' && "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700",
                          d.statusKey === 'weekend' && "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        )}>
                          {d.statusKey === 'present' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {d.statusKey === 'late' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          {d.statusKey === 'mission' && <Plane className="w-3 h-3 text-purple-600" />}
                          {d.statusKey === 'wfh' && <Home className="w-3 h-3 text-indigo-600" />}
                          {d.statusKey === 'holiday' && <Sparkles className="w-3 h-3 text-amber-600" />}
                          {d.statusKey === 'absent' && <XCircle className="w-3 h-3 text-red-600" />}
                          {d.statusLabel}
                        </span>
                      </td>

                      {/* Leave Type */}
                      <td className="px-4 py-3">
                        {d.leaveType !== '-' ? (
                          <span className="font-bold text-amber-700 dark:text-amber-400">
                            {d.leaveType}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Mission */}
                      <td className="px-4 py-3">
                        {d.missionName !== '-' ? (
                          <div className="flex flex-col">
                            <span className="font-black text-purple-700 dark:text-purple-400">
                              {d.missionName}
                            </span>
                            {d.missionDestination && (
                              <span className="text-[10px] text-slate-400">
                                {d.missionDestination}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Remote / WFH */}
                      <td className="px-3 py-3 text-center">
                        {d.isWfh ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            <Home className="w-3 h-3" />
                            {isRtl ? 'معتمد' : 'Yes'}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Official Holiday / Weekend */}
                      <td className="px-4 py-3">
                        {d.holidayLabel !== '-' ? (
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                            {d.holidayLabel}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Notes / Device */}
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                        <div className="flex flex-col">
                          {d.notes && <span>{d.notes}</span>}
                          {d.deviceName && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Fingerprint className="w-3 h-3" />
                              {d.deviceName}
                            </span>
                          )}
                          {!d.notes && !d.deviceName && <span className="text-slate-400">-</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-muted/40 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground font-bold">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-teal-600" />
            <span>
              {t('يتم احتساب أيام العمل، المأموريات المعتمدة، والإجازات طبقاً لتقويم الوردية وقواعد الحضور الرسمية')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all font-black text-xs"
          >
            {t('إغلاق')}
          </button>
        </div>
      </div>
    </div>
  );
};
