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
import { useData } from '../../contexts/DataContext';
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
  const { systemSettings, adminDepartments } = useData();
  const isRtl = language === 'ar';

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const orgName = systemSettings?.organizationName || (isRtl ? 'شركة الأفق الرقمي للتجارة والتقنية' : 'Paradise Solutions');
  const logoUrl = systemSettings?.logoUrl || '';
  const departmentName = employee 
    ? (adminDepartments.find(d => d.id === employee.departmentId)?.name || (isRtl ? 'الإدارة العامة' : 'General Admin'))
    : '';

  const [yearStr, monthNumStr] = (month || '').split('-');
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
    : month;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto print:p-0 print:m-0 print:bg-white print:static print:overflow-visible">
      {/* Screen Interactive Modal */}
      <div 
        id="monthly-attendance-details-modal"
        className="relative w-full max-w-7xl bg-card text-foreground rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col max-h-[92vh] print:hidden"
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

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-750 transition-all shadow-sm active:scale-95 cursor-pointer"
              title={t('تصدير إكسيل')}
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>{t('تصدير Excel')}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 dark:bg-primary dark:hover:bg-primary/90 border border-slate-900 dark:border-primary rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
              title={t('طباعة التقرير')}
            >
              <Printer className="w-4 h-4 text-emerald-400 dark:text-white" />
              <span>{t('طباعة التقرير')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
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
        <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
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
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
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
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
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
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
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
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
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
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
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
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
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
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
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
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
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
            className="px-6 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all font-black text-xs cursor-pointer"
          >
            {t('إغلاق')}
          </button>
        </div>
      </div>

      {/* =========================================================================
          OFFICIAL PRINTABLE A4 PORTRAIT DOCUMENT (Shown strictly when printing)
          ========================================================================= */}
      <div 
        id="monthly-attendance-printable-document"
        className="hidden print:block print:w-full bg-white text-slate-900 p-0 m-0 font-sans"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Print Stylesheet overrides for strict A4 portrait fit */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: A4 portrait;
              margin: 8mm 6mm 8mm 6mm;
            }
            body, html {
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: 'Cairo', 'Inter', system-ui, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .no-print, nav, header, aside, .modal-backdrop {
              display: none !important;
            }
            #monthly-attendance-printable-document {
              display: block !important;
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            thead {
              display: table-header-group;
            }
            tfoot {
              display: table-footer-group;
            }
            th, td {
              border: 1px solid #cbd5e1 !important;
            }
          }
        `}} />

        <div className="space-y-3">
          {/* Top Decorative Border Strip */}
          <div className="h-1.5 bg-slate-900 w-full" />

          {/* 1. Header: Top Right (Organization Name) | Center (Title) | Top Left (Logo) */}
          <div className="flex justify-between items-center pb-3 border-b-2 border-slate-900 gap-2">
            {/* Top Right: اسم المنشأة */}
            <div className="w-[30%] text-right space-y-0.5">
              <h1 className="text-sm font-black text-slate-900 leading-tight">
                {orgName}
              </h1>
              <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                {isRtl ? 'إدارة الموارد البشرية والشؤون الإدارية' : 'Human Resources & Admin Dept'}
              </p>
              <p className="text-[7.5px] text-slate-400 font-mono">
                DOC: ATT-{(month || '').replace('-', '')}-{employee.employeeId || employee.id}
              </p>
            </div>

            {/* In the Center: عنوان تقرير الحضور الشهري */}
            <div className="w-[40%] text-center space-y-0.5">
              <div className="inline-block bg-slate-900 text-white px-3.5 py-1 rounded-none">
                <h2 className="text-xs font-black tracking-wide">
                  {isRtl ? 'تقرير الحضور والانصراف الشهري' : 'Monthly Attendance & Departure Report'}
                </h2>
              </div>
              <p className="text-[8.5px] font-black text-slate-700 tracking-tight">
                {isRtl ? `عن شهر: ${monthDisplayName} ${yearStr}م` : `Period: ${monthDisplayName} ${yearStr}`}
              </p>
            </div>

            {/* Top Left: شعار المنشأة */}
            <div className="w-[30%] flex justify-end items-center">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="h-10 max-h-11 w-auto max-w-[130px] object-contain bg-transparent" 
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

          {/* 2. Below the Title: Employee & Report Metadata Strip */}
          <div className="border border-slate-900 bg-slate-50/70 p-2 text-[9px] font-bold text-slate-800">
            <div className="grid grid-cols-5 gap-2">
              <div className="border-l border-slate-200 pl-2">
                <span className="text-[7.5px] text-slate-500 font-bold block">{isRtl ? 'اسم الموظف / Employee' : 'Employee Name'}</span>
                <span className="text-[9.5px] font-black text-slate-900 block truncate">{employee.name}</span>
              </div>
              <div className="border-l border-slate-200 pl-2">
                <span className="text-[7.5px] text-slate-500 font-bold block">{isRtl ? 'كود الموظف / Code' : 'Employee Code'}</span>
                <span className="text-[9.5px] font-black text-slate-900 block font-mono">#{employee.employeeId || employee.id}</span>
              </div>
              <div className="border-l border-slate-200 pl-2">
                <span className="text-[7.5px] text-slate-500 font-bold block">{isRtl ? 'القسم / Department' : 'Department'}</span>
                <span className="text-[9.5px] font-black text-slate-900 block truncate">{departmentName}</span>
              </div>
              <div className="border-l border-slate-200 pl-2">
                <span className="text-[7.5px] text-slate-500 font-bold block">{isRtl ? 'الشهر / Month' : 'Month'}</span>
                <span className="text-[9.5px] font-black text-slate-900 block">{monthDisplayName}</span>
              </div>
              <div>
                <span className="text-[7.5px] text-slate-500 font-bold block">{isRtl ? 'السنة / Year' : 'Year'}</span>
                <span className="text-[9.5px] font-black text-slate-900 block font-mono">{yearStr}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 mt-1.5 pt-1.5 border-t border-slate-200 text-[8px]">
              <div>
                <span className="text-slate-500">{isRtl ? 'المسمى الوظيفي: ' : 'Job Title: '}</span>
                <span className="font-black text-slate-800">{employee.jobTitle || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">{isRtl ? 'الوردية المقررة: ' : 'Shift: '}</span>
                <span className="font-black text-slate-800">{shift ? `${shift.name} (${shift.startTime}-${shift.endTime})` : '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">{isRtl ? 'نظام العمل: ' : 'Work Mode: '}</span>
                <span className="font-black text-slate-800">{employee.workMode === 'Remotely Work' ? (isRtl ? 'عن بُعد' : 'Remote') : (isRtl ? 'حضوري' : 'On-site')}</span>
              </div>
              <div className="text-left">
                <span className="text-slate-500">{isRtl ? 'تاريخ التوليد: ' : 'Generated: '}</span>
                <span className="font-bold font-mono text-slate-700">{format(new Date(), 'yyyy-MM-dd HH:mm')}</span>
              </div>
            </div>
          </div>

          {/* 3. Organized Monthly Table for ALL Days of the Month */}
          <div className="overflow-hidden border border-slate-900">
            <table className="w-full text-right border-collapse text-[8px] leading-tight">
              <thead>
                <tr className="bg-slate-900 text-white font-black text-[8px] uppercase">
                  <th className="p-1 border border-slate-700 text-center w-[10%]">{isRtl ? 'التاريخ' : 'Date'}</th>
                  <th className="p-1 border border-slate-700 text-center w-[8%]">{isRtl ? 'اليوم' : 'Day'}</th>
                  <th className="p-1 border border-slate-700 text-center w-[8%]">{isRtl ? 'الحضور' : 'In'}</th>
                  <th className="p-1 border border-slate-700 text-center w-[8%]">{isRtl ? 'الانصراف' : 'Out'}</th>
                  <th className="p-1 border border-slate-700 text-center w-[7%]">{isRtl ? 'التأخير' : 'Delay'}</th>
                  <th className="p-1 border border-slate-700 text-center w-[7%]">{isRtl ? 'الإضافي' : 'Overtime'}</th>
                  <th className="p-1 border border-slate-700 text-center w-[10%]">{isRtl ? 'حالة اليوم' : 'Status'}</th>
                  <th className="p-1 border border-slate-700 text-center w-[9%]">{isRtl ? 'الإجازة' : 'Leave'}</th>
                  <th className="p-1 border border-slate-700 text-center w-[10%]">{isRtl ? 'المأمورية' : 'Mission'}</th>
                  <th className="p-1 border border-slate-700 text-center w-[7%]">{isRtl ? 'عن بُعد' : 'WFH'}</th>
                  <th className="p-1 border border-slate-700 text-center w-[9%]">{isRtl ? 'العطلة الرسمية' : 'Holiday'}</th>
                  <th className="p-1 border border-slate-700 text-center w-[7%]">{isRtl ? 'الملاحظات' : 'Notes'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 font-bold text-slate-800">
                {monthlyDays.map((d, idx) => {
                  const isWeekendOrHoliday = d.statusKey === 'weekend' || d.statusKey === 'holiday';
                  const isAbsent = d.statusKey === 'absent';
                  const isLate = d.delayMinutes > 0;
                  const isOvertime = d.overtimeMinutes > 0;

                  return (
                    <tr 
                      key={d.dateStr} 
                      className={cn(
                        idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white',
                        isWeekendOrHoliday && 'bg-slate-100/80 text-slate-600',
                        isAbsent && 'bg-red-50/40 text-red-900 font-black'
                      )}
                    >
                      {/* التاريخ */}
                      <td className="p-1 border border-slate-300 text-center font-mono font-bold">
                        {d.dateStr}
                      </td>

                      {/* اليوم */}
                      <td className="p-1 border border-slate-300 text-center font-black">
                        {d.dayName}
                      </td>

                      {/* الحضور */}
                      <td className="p-1 border border-slate-300 text-center font-mono">
                        {d.firstIn ? (
                          <span className="text-emerald-700 font-black">
                            {d.inTimeStr}
                          </span>
                        ) : '—'}
                      </td>

                      {/* الانصراف */}
                      <td className="p-1 border border-slate-300 text-center font-mono">
                        {d.lastOut ? (
                          <span className="text-slate-800 font-black">
                            {d.outTimeStr}
                          </span>
                        ) : '—'}
                      </td>

                      {/* التأخير */}
                      <td className="p-1 border border-slate-300 text-center font-mono">
                        {isLate ? (
                          <span className="text-red-700 font-black">
                            {d.delayMinutes} {isRtl ? 'د' : 'm'}
                          </span>
                        ) : '—'}
                      </td>

                      {/* الإضافي */}
                      <td className="p-1 border border-slate-300 text-center font-mono">
                        {isOvertime ? (
                          <span className="text-blue-700 font-black">
                            {(d.overtimeMinutes / 60).toFixed(1)} {isRtl ? 'س' : 'h'}
                          </span>
                        ) : '—'}
                      </td>

                      {/* حالة اليوم */}
                      <td className="p-1 border border-slate-300 text-center">
                        <span className={cn(
                          "px-1 py-0.2 rounded text-[7.5px] font-black inline-block",
                          d.statusKey === 'present' && "bg-emerald-100 text-emerald-900 border border-emerald-300",
                          d.statusKey === 'late' && "bg-amber-100 text-amber-900 border border-amber-300",
                          d.statusKey === 'off_overtime' && "bg-teal-100 text-teal-900 border border-teal-300",
                          d.statusKey === 'mission' && "bg-purple-100 text-purple-900 border border-purple-300",
                          d.statusKey === 'leave' && "bg-amber-100 text-amber-900 border border-amber-300",
                          d.statusKey === 'wfh' && "bg-indigo-100 text-indigo-900 border border-indigo-300",
                          d.statusKey === 'absent' && "bg-red-100 text-red-900 border border-red-400 font-black",
                          d.statusKey === 'holiday' && "bg-amber-50 text-amber-900 border border-amber-200",
                          d.statusKey === 'weekend' && "bg-slate-200 text-slate-700 border border-slate-300"
                        )}>
                          {d.statusLabel}
                        </span>
                      </td>

                      {/* الإجازة */}
                      <td className="p-1 border border-slate-300 text-center text-[7.5px] truncate max-w-[70px]">
                        {d.leaveType !== '-' ? d.leaveType : '—'}
                      </td>

                      {/* المأمورية */}
                      <td className="p-1 border border-slate-300 text-center text-[7.5px] truncate max-w-[80px]">
                        {d.missionName !== '-' ? d.missionName : '—'}
                      </td>

                      {/* العمل عن بُعد */}
                      <td className="p-1 border border-slate-300 text-center text-[7.5px]">
                        {d.isWfh ? (isRtl ? 'نعم' : 'Yes') : '—'}
                      </td>

                      {/* العطلة الرسمية */}
                      <td className="p-1 border border-slate-300 text-center text-[7.5px] truncate max-w-[70px]">
                        {d.holidayLabel !== '-' ? d.holidayLabel : '—'}
                      </td>

                      {/* الملاحظات */}
                      <td className="p-1 border border-slate-300 text-center text-[7px] text-slate-600 truncate max-w-[60px]">
                        {d.notes || d.deviceName || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 4. ملخص التقرير في النهاية (Summary Block: 8 Key Metrics) */}
          <div className="border-2 border-slate-900 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-2">
              <h3 className="text-[10px] font-black text-slate-900 uppercase">
                {isRtl ? 'ملخص الحضور والانصراف الشهري / Monthly KPI Summary' : 'Monthly Attendance & Absence Summary'}
              </h3>
              <span className="text-[8px] font-bold text-slate-500">
                {isRtl ? `إجمالي أيام الشهر: ${stats.totalDays} يوماً` : `Total Days: ${stats.totalDays}`}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-center">
              {/* 1. أيام الحضور */}
              <div className="bg-white border border-slate-300 p-1.5">
                <span className="text-[7.5px] font-bold text-slate-500 block">{isRtl ? 'أيام الحضور' : 'Present Days'}</span>
                <span className="text-xs font-black text-emerald-700 block mt-0.5 tabular-nums">{stats.presentCount} <span className="text-[7.5px]">{isRtl ? 'يوم' : 'd'}</span></span>
              </div>

              {/* 2. الغياب */}
              <div className="bg-white border border-slate-300 p-1.5">
                <span className="text-[7.5px] font-bold text-slate-500 block">{isRtl ? 'الغياب' : 'Absence Days'}</span>
                <span className="text-xs font-black text-red-700 block mt-0.5 tabular-nums">{stats.absentCount} <span className="text-[7.5px]">{isRtl ? 'يوم' : 'd'}</span></span>
              </div>

              {/* 3. المأموريات */}
              <div className="bg-white border border-slate-300 p-1.5">
                <span className="text-[7.5px] font-bold text-slate-500 block">{isRtl ? 'المأموريات' : 'Missions'}</span>
                <span className="text-xs font-black text-purple-700 block mt-0.5 tabular-nums">{stats.missionCount} <span className="text-[7.5px]">{isRtl ? 'يوم' : 'd'}</span></span>
              </div>

              {/* 4. الإجازات */}
              <div className="bg-white border border-slate-300 p-1.5">
                <span className="text-[7.5px] font-bold text-slate-500 block">{isRtl ? 'الإجازات' : 'Leaves'}</span>
                <span className="text-xs font-black text-amber-700 block mt-0.5 tabular-nums">{stats.leaveCount} <span className="text-[7.5px]">{isRtl ? 'يوم' : 'd'}</span></span>
              </div>

              {/* 5. العمل عن بُعد */}
              <div className="bg-white border border-slate-300 p-1.5">
                <span className="text-[7.5px] font-bold text-slate-500 block">{isRtl ? 'العمل عن بُعد' : 'Remote / WFH'}</span>
                <span className="text-xs font-black text-indigo-700 block mt-0.5 tabular-nums">{stats.wfhCount} <span className="text-[7.5px]">{isRtl ? 'يوم' : 'd'}</span></span>
              </div>

              {/* 6. العطلات */}
              <div className="bg-white border border-slate-300 p-1.5">
                <span className="text-[7.5px] font-bold text-slate-500 block">{isRtl ? 'العطلات' : 'Holidays'}</span>
                <span className="text-xs font-black text-slate-700 block mt-0.5 tabular-nums">{stats.weekendHolidayCount} <span className="text-[7.5px]">{isRtl ? 'يوم' : 'd'}</span></span>
              </div>

              {/* 7. إجمالي التأخير */}
              <div className="bg-white border border-slate-300 p-1.5">
                <span className="text-[7.5px] font-bold text-slate-500 block">{isRtl ? 'إجمالي التأخير' : 'Total Delay'}</span>
                <span className="text-xs font-black text-red-700 block mt-0.5 tabular-nums">{stats.totalDelayMins} <span className="text-[7.5px]">{isRtl ? 'دقيقة' : 'min'}</span></span>
              </div>

              {/* 8. إجمالي الإضافي */}
              <div className="bg-white border border-slate-300 p-1.5">
                <span className="text-[7.5px] font-bold text-slate-500 block">{isRtl ? 'إجمالي الإضافي' : 'Total Overtime'}</span>
                <span className="text-xs font-black text-blue-700 block mt-0.5 tabular-nums">{(stats.totalOvertimeMins / 60).toFixed(1)} <span className="text-[7.5px]">{isRtl ? 'ساعة' : 'hr'}</span></span>
              </div>
            </div>
          </div>

          {/* 5. تذييل التوقيعات والاعتمادات الرسمية (Signatures Block) */}
          <div className="pt-2 border-t border-slate-300 grid grid-cols-4 gap-3 text-center text-[8px] font-bold text-slate-800">
            <div className="space-y-6">
              <span className="block text-slate-500">{isRtl ? 'توقيع الموظف' : 'Employee Signature'}</span>
              <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto" />
            </div>
            <div className="space-y-6">
              <span className="block text-slate-500">{isRtl ? 'مسؤول الحضور والانصراف' : 'Attendance Officer'}</span>
              <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto" />
            </div>
            <div className="space-y-6">
              <span className="block text-slate-500">{isRtl ? 'مدير الموارد البشرية' : 'HR Manager'}</span>
              <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto" />
            </div>
            <div className="space-y-6">
              <span className="block text-slate-500">{isRtl ? 'الختم الرسمي للمنشأة' : 'Official Seal'}</span>
              <div className="border-b border-dotted border-slate-400 w-3/4 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
