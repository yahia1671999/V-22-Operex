import React from 'react';
import { Building2 } from 'lucide-react';
import { Employee } from '../../types';
import { MonthlyDayAttendanceDetail, MonthlyAttendanceSummaryStats } from '../../utils/monthlyAttendanceCalculation';
import { format } from 'date-fns';

interface MonthlyJobCardPrintableProps {
  employee: Employee;
  month: string; // 'YYYY-MM'
  days: MonthlyDayAttendanceDetail[];
  stats: MonthlyAttendanceSummaryStats;
  orgName: string;
  logoUrl?: string;
  departmentName: string;
  shiftName: string;
  isRtl?: boolean;
}

export const MonthlyJobCardPrintable: React.FC<MonthlyJobCardPrintableProps> = ({
  employee,
  month,
  days = [],
  stats,
  orgName,
  logoUrl,
  departmentName,
  shiftName,
  isRtl = true,
}) => {
  // Parse Year and Month
  const [yearStr, monthNumStr] = (month || format(new Date(), 'yyyy-MM')).split('-');
  const dateObj = new Date(parseInt(yearStr, 10), parseInt(monthNumStr, 10) - 1, 1);
  const monthDisplayName = format(dateObj, 'MMMM');

  const monthNamesAr: { [key: string]: string } = {
    '01': 'يناير',
    '02': 'فبراير',
    '03': 'مارس',
    '04': 'أبريل',
    '05': 'مايو',
    '06': 'يونيو',
    '07': 'يوليو',
    '08': 'أغسطس',
    '09': 'سبتمبر',
    '10': 'أكتوبر',
    '11': 'نوفمبر',
    '12': 'ديسمبر'
  };

  const monthArName = monthNamesAr[monthNumStr] || monthDisplayName;

  // Work Mode & Type formatting
  const workModeText = employee.workMode === 'Remotely Work' 
    ? (isRtl ? 'عن بُعد (Remote)' : 'Remote') 
    : (isRtl ? 'حضوري (On-site)' : 'On-site');
    
  const workTypeText = employee.workType === 'Part time'
    ? (isRtl ? 'دوام جزئي' : 'Part-time')
    : (isRtl ? 'دوام كامل' : 'Full-time');

  const workSystemFormatted = `${workTypeText} • ${workModeText}`;

  // Split days into 2 balanced columns: Days 1-16 (Half 1) and Days 17-31 (Half 2)
  const half1Days = days.slice(0, 16);
  const half2Days = days.slice(16, 31);
  
  // Pad half2Days to have exactly 16 rows if month has fewer days (e.g. 28, 30 days)
  const maxRows = 16;
  const paddedHalf2Days: (MonthlyDayAttendanceDetail | null)[] = [...half2Days];
  while (paddedHalf2Days.length < maxRows) {
    paddedHalf2Days.push(null);
  }

  const printTimestamp = format(new Date(), 'yyyy-MM-dd HH:mm');

  return (
    <div 
      id="monthly-jobcard-printable-document"
      className="hidden print:block print:w-full bg-white text-slate-900 p-0 m-0 font-sans"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        color: '#0f172a'
      }}
    >
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: A4 landscape;
              margin: 4.5mm 6mm 4.5mm 6mm;
            }
            html, body {
              width: 100% !important;
              height: 100% !important;
              max-height: 100vh !important;
              overflow: hidden !important;
              background-color: #ffffff !important;
              color: #0f172a !important;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            #screen-monthly-paycard-modal,
            #monthly-attendance-details-modal,
            .no-print,
            header,
            nav,
            aside {
              display: none !important;
            }
            #monthly-jobcard-printable-document {
              display: block !important;
              width: 100% !important;
              height: 100% !important;
              max-height: 198mm !important;
              margin: 0 !important;
              padding: 0 !important;
              box-sizing: border-box !important;
              page-break-inside: avoid !important;
              page-break-after: avoid !important;
              overflow: hidden !important;
            }
            table {
              border-collapse: collapse !important;
              page-break-inside: avoid !important;
            }
          }
        `
      }} />

      {/* Main Single Page Container - Structured with exact proportions */}
      <div className="w-full flex flex-col justify-between" style={{ height: '100%', maxHeight: '198mm' }}>
        
        <div className="space-y-1.5 w-full">
          {/* 1. Header (أعلى اليمين: اسم المنشأة | في المنتصف: كارت العمل الشهري | أعلى اليسار: اللوجو الرسمي) */}
          <div className="flex justify-between items-center pb-1.5 border-b-2 border-slate-900">
            {/* Top Right: اسم المنشأة */}
            <div className="w-[32%] text-right space-y-0.5">
              <h1 className="text-[12.5px] font-black text-slate-900 tracking-tight leading-none">
                {orgName}
              </h1>
              <p className="text-[8px] font-bold text-slate-600">
                {isRtl ? 'سجل بطاقة العمل والتشغيل الشهري المعتمد' : 'Official Monthly Job & Time Card'}
              </p>
              <p className="text-[7px] font-semibold text-slate-500 font-mono">
                REF: JOB-{month}-{employee.employeeId || employee.id}
              </p>
            </div>

            {/* Center: العنوان في المنتصف */}
            <div className="w-[36%] text-center space-y-0.5">
              <div className="inline-block bg-slate-900 text-white px-4 py-1 rounded-sm shadow-xs">
                <h2 className="text-[12.5px] font-black uppercase tracking-wider text-white">
                  {isRtl ? 'كارت العمل الشهري' : 'Monthly Job Card'}
                </h2>
              </div>
              <p className="text-[8.5px] font-black text-slate-800 tracking-tight font-mono">
                {isRtl ? `عن شهر: ${monthArName} (${monthNumStr}) ${yearStr}م` : `Period: ${monthDisplayName} ${yearStr}`}
              </p>
            </div>

            {/* Top Left: اللوجو الرسمي */}
            <div className="w-[32%] flex justify-end items-center">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo" 
                  className="h-8 max-h-9 w-auto max-w-[120px] object-contain bg-transparent" 
                  referrerPolicy="no-referrer" 
                  crossOrigin="anonymous" 
                />
              ) : (
                <div className="h-8 px-2.5 border border-slate-300 flex items-center justify-center gap-1 text-slate-800 bg-slate-50">
                  <Building2 className="w-3.5 h-3.5 text-slate-700" />
                  <span className="text-[8px] font-black">{orgName}</span>
                </div>
              )}
            </div>
          </div>

          {/* 2. بيانات الموظف في صف منظم (الاسم، الكود، الوظيفة، الإدارة، نظام العمل، الوردية) */}
          <div className="border border-slate-900 bg-slate-50/80 px-2 py-1 text-[8.5px] font-bold text-slate-800">
            <div className="grid grid-cols-6 gap-2 items-center">
              {/* الاسم */}
              <div className="border-l border-slate-300 pl-1.5">
                <span className="text-[7px] text-slate-500 font-bold block">{isRtl ? 'اسم الموظف' : 'Employee Name'}</span>
                <span className="text-[9px] font-black text-slate-900 block truncate">{employee.name}</span>
              </div>

              {/* الكود */}
              <div className="border-l border-slate-300 pl-1.5">
                <span className="text-[7px] text-slate-500 font-bold block">{isRtl ? 'الكود الوظيفي' : 'Employee ID'}</span>
                <span className="text-[9px] font-black text-slate-900 block font-mono">#{employee.employeeId || employee.id}</span>
              </div>

              {/* الوظيفة */}
              <div className="border-l border-slate-300 pl-1.5">
                <span className="text-[7px] text-slate-500 font-bold block">{isRtl ? 'المسمى الوظيفي' : 'Job Title'}</span>
                <span className="text-[9px] font-black text-slate-900 block truncate">{employee.jobTitle || '—'}</span>
              </div>

              {/* الإدارة */}
              <div className="border-l border-slate-300 pl-1.5">
                <span className="text-[7px] text-slate-500 font-bold block">{isRtl ? 'الإدارة / القسم' : 'Department'}</span>
                <span className="text-[9px] font-black text-slate-900 block truncate">{departmentName || '—'}</span>
              </div>

              {/* نظام العمل */}
              <div className="border-l border-slate-300 pl-1.5">
                <span className="text-[7px] text-slate-500 font-bold block">{isRtl ? 'نظام العمل' : 'Work System'}</span>
                <span className="text-[9px] font-black text-teal-800 block truncate">{workSystemFormatted}</span>
              </div>

              {/* الوردية */}
              <div>
                <span className="text-[7px] text-slate-500 font-bold block">{isRtl ? 'الوردية المقررة' : 'Shift'}</span>
                <span className="text-[9px] font-black text-slate-900 block truncate">{shiftName || '—'}</span>
              </div>
            </div>
          </div>

          {/* 3. ملخص الشهر (أيام الحضور، الغياب، المأموريات، الإجازات، العمل عن بُعد، العطلات، التأخير، الإضافي) */}
          <div className="border border-slate-900 bg-white overflow-hidden">
            <div className="bg-slate-900 text-white px-2 py-0.5 flex items-center justify-between text-[8px] font-black">
              <span>{isRtl ? 'ملخص الشهر ومؤشرات الأداء التشغيلي (Monthly KPI Summary)' : 'Monthly Operational KPIs'}</span>
              <span className="text-[7px] font-mono text-slate-300 font-normal">
                {isRtl ? `إجمالي أيام الشهر: ${stats.totalDays || days.length} يوم` : `Total Days: ${stats.totalDays || days.length}`}
              </span>
            </div>
            
            <div className="grid grid-cols-8 divide-x divide-slate-300 divide-x-reverse text-center text-[7.5px] bg-slate-50/50">
              {/* 1. أيام الحضور */}
              <div className="p-1 bg-teal-50/60">
                <span className="text-teal-900 font-bold block mb-0.5">{isRtl ? 'أيام الحضور' : 'Present Days'}</span>
                <span className="font-black text-teal-800 text-[10px] font-mono">{stats.presentCount} {isRtl ? 'يوم' : 'd'}</span>
              </div>

              {/* 2. أيام الغياب */}
              <div className="p-1 bg-rose-50/50">
                <span className="text-rose-900 font-bold block mb-0.5">{isRtl ? 'أيام الغياب' : 'Absence Days'}</span>
                <span className="font-black text-rose-700 text-[10px] font-mono">{stats.absentCount} {isRtl ? 'يوم' : 'd'}</span>
              </div>

              {/* 3. أيام المأموريات */}
              <div className="p-1 bg-purple-50/50">
                <span className="text-purple-900 font-bold block mb-0.5">{isRtl ? 'أيام المأموريات' : 'Missions'}</span>
                <span className="font-black text-purple-800 text-[10px] font-mono">{stats.missionCount} {isRtl ? 'يوم' : 'd'}</span>
              </div>

              {/* 4. الإجازات */}
              <div className="p-1 bg-amber-50/50">
                <span className="text-amber-900 font-bold block mb-0.5">{isRtl ? 'الإجازات' : 'Leaves'}</span>
                <span className="font-black text-amber-800 text-[10px] font-mono">{stats.leaveCount} {isRtl ? 'يوم' : 'd'}</span>
              </div>

              {/* 5. العمل من المنزل/عن بُعد */}
              <div className="p-1 bg-indigo-50/50">
                <span className="text-indigo-900 font-bold block mb-0.5">{isRtl ? 'العمل عن بُعد' : 'WFH'}</span>
                <span className="font-black text-indigo-800 text-[10px] font-mono">{stats.wfhCount} {isRtl ? 'يوم' : 'd'}</span>
              </div>

              {/* 6. العطلات الرسمية والأسبوعية */}
              <div className="p-1 bg-slate-100/70">
                <span className="text-slate-700 font-bold block mb-0.5">{isRtl ? 'العطلات' : 'Holidays'}</span>
                <span className="font-black text-slate-800 text-[10px] font-mono">{stats.weekendHolidayCount} {isRtl ? 'يوم' : 'd'}</span>
              </div>

              {/* 7. إجمالي التأخير */}
              <div className="p-1 bg-orange-50/50">
                <span className="text-orange-900 font-bold block mb-0.5">{isRtl ? 'إجمالي التأخير' : 'Total Delay'}</span>
                <span className="font-black text-orange-700 text-[10px] font-mono">{stats.totalDelayMins} {isRtl ? 'دقيقة' : 'm'}</span>
              </div>

              {/* 8. إجمالي الإضافي */}
              <div className="p-1 bg-blue-50/50">
                <span className="text-blue-900 font-bold block mb-0.5">{isRtl ? 'إجمالي الإضافي' : 'Total Overtime'}</span>
                <span className="font-black text-blue-800 text-[10px] font-mono">{(stats.totalOvertimeMins / 60).toFixed(1)} {isRtl ? 'ساعة' : 'h'}</span>
              </div>
            </div>
          </div>

          {/* 4. مصفوفة الأيام التشغيلية للشهر (31 يوم مقسمة إلى نصفين متجاورين 1-16 و 17-31 في 16 سطر فقط لضمان صفحة واحدة) */}
          <div className="border border-slate-900 overflow-hidden bg-white">
            <div className="grid grid-cols-2 divide-x divide-slate-900 divide-x-reverse">
              
              {/* Half 1: Days 1 to 16 */}
              <div>
                <table className="w-full text-right border-collapse text-[7.5px] leading-tight">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black text-[7.5px]">
                      <th className="p-0.5 px-1 border border-slate-700 text-center w-[18%]">{isRtl ? 'اليوم والتاريخ' : 'Day / Date'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[12%]">{isRtl ? 'دخول' : 'In'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[12%]">{isRtl ? 'خروج' : 'Out'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[11%]">{isRtl ? 'تأخير' : 'Delay'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[11%]">{isRtl ? 'إضافي' : 'OT'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[20%]">{isRtl ? 'الحالة' : 'Status'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[16%]">{isRtl ? 'ملاحظات' : 'Notes'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 font-bold text-slate-900">
                    {half1Days.map((d, idx) => {
                      const isWeekendOrHoliday = d.statusKey === 'weekend' || d.statusKey === 'holiday';
                      const isAbsent = d.statusKey === 'absent';
                      const isLate = d.delayMinutes > 0;
                      const isOvertime = d.overtimeMinutes > 0;

                      return (
                        <tr 
                          key={d.dateStr} 
                          className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
                          style={{ height: '5mm' }}
                        >
                          <td className="p-0.5 px-1 border-r border-l border-slate-300 font-mono text-[7px] text-center">
                            <span className="font-bold text-slate-900">{d.dayNumber.toString().padStart(2, '0')}</span>{' '}
                            <span className="text-slate-500 font-sans">{d.dayName}</span>
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center font-mono text-[7px]">
                            {d.firstIn ? <span className="text-emerald-800 font-bold">{d.inTimeStr}</span> : '—'}
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center font-mono text-[7px]">
                            {d.lastOut ? <span className="text-slate-800 font-bold">{d.outTimeStr}</span> : '—'}
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center font-mono text-[7px]">
                            {isLate ? <span className="text-rose-700 font-bold">{d.delayMinutes}د</span> : '—'}
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center font-mono text-[7px]">
                            {isOvertime ? <span className="text-blue-700 font-bold">{(d.overtimeMinutes / 60).toFixed(1)}س</span> : '—'}
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center">
                            <span className={`px-1 py-0.2 rounded text-[6.5px] font-black inline-block leading-tight ${
                              d.statusKey === 'present' ? 'bg-teal-100/80 text-teal-900 border border-teal-300' :
                              d.statusKey === 'late' ? 'bg-amber-100/80 text-amber-900 border border-amber-300' :
                              d.statusKey === 'mission' ? 'bg-purple-100/80 text-purple-900 border border-purple-300' :
                              d.statusKey === 'leave' ? 'bg-amber-100/80 text-amber-900 border border-amber-300' :
                              d.statusKey === 'wfh' ? 'bg-indigo-100/80 text-indigo-900 border border-indigo-300' :
                              d.statusKey === 'absent' ? 'bg-rose-100/80 text-rose-900 border border-rose-400 font-black' :
                              d.statusKey === 'holiday' ? 'bg-amber-50 text-amber-900 border border-amber-200' :
                              d.statusKey === 'weekend' ? 'bg-slate-200/70 text-slate-700 border border-slate-300' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {d.statusLabel}
                            </span>
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center text-[6.5px] text-slate-600 truncate max-w-[65px]">
                            {d.leaveType !== '-' ? d.leaveType : d.missionName !== '-' ? d.missionName : d.holidayLabel !== '-' ? d.holidayLabel : d.notes || d.deviceName || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Half 2: Days 17 to 31 */}
              <div>
                <table className="w-full text-right border-collapse text-[7.5px] leading-tight">
                  <thead>
                    <tr className="bg-slate-900 text-white font-black text-[7.5px]">
                      <th className="p-0.5 px-1 border border-slate-700 text-center w-[18%]">{isRtl ? 'اليوم والتاريخ' : 'Day / Date'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[12%]">{isRtl ? 'دخول' : 'In'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[12%]">{isRtl ? 'خروج' : 'Out'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[11%]">{isRtl ? 'تأخير' : 'Delay'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[11%]">{isRtl ? 'إضافي' : 'OT'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[20%]">{isRtl ? 'الحالة' : 'Status'}</th>
                      <th className="p-0.5 border border-slate-700 text-center w-[16%]">{isRtl ? 'ملاحظات' : 'Notes'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 font-bold text-slate-900">
                    {paddedHalf2Days.map((d, idx) => {
                      if (!d) {
                        return (
                          <tr key={`pad-${idx}`} className="bg-slate-50/30" style={{ height: '5mm' }}>
                            <td colSpan={7} className="p-0.5 text-center text-slate-300 text-[6.5px]">
                              —
                            </td>
                          </tr>
                        );
                      }

                      const isWeekendOrHoliday = d.statusKey === 'weekend' || d.statusKey === 'holiday';
                      const isAbsent = d.statusKey === 'absent';
                      const isLate = d.delayMinutes > 0;
                      const isOvertime = d.overtimeMinutes > 0;

                      return (
                        <tr 
                          key={d.dateStr} 
                          className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
                          style={{ height: '5mm' }}
                        >
                          <td className="p-0.5 px-1 border-r border-l border-slate-300 font-mono text-[7px] text-center">
                            <span className="font-bold text-slate-900">{d.dayNumber.toString().padStart(2, '0')}</span>{' '}
                            <span className="text-slate-500 font-sans">{d.dayName}</span>
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center font-mono text-[7px]">
                            {d.firstIn ? <span className="text-emerald-800 font-bold">{d.inTimeStr}</span> : '—'}
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center font-mono text-[7px]">
                            {d.lastOut ? <span className="text-slate-800 font-bold">{d.outTimeStr}</span> : '—'}
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center font-mono text-[7px]">
                            {isLate ? <span className="text-rose-700 font-bold">{d.delayMinutes}د</span> : '—'}
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center font-mono text-[7px]">
                            {isOvertime ? <span className="text-blue-700 font-bold">{(d.overtimeMinutes / 60).toFixed(1)}س</span> : '—'}
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center">
                            <span className={`px-1 py-0.2 rounded text-[6.5px] font-black inline-block leading-tight ${
                              d.statusKey === 'present' ? 'bg-teal-100/80 text-teal-900 border border-teal-300' :
                              d.statusKey === 'late' ? 'bg-amber-100/80 text-amber-900 border border-amber-300' :
                              d.statusKey === 'mission' ? 'bg-purple-100/80 text-purple-900 border border-purple-300' :
                              d.statusKey === 'leave' ? 'bg-amber-100/80 text-amber-900 border border-amber-300' :
                              d.statusKey === 'wfh' ? 'bg-indigo-100/80 text-indigo-900 border border-indigo-300' :
                              d.statusKey === 'absent' ? 'bg-rose-100/80 text-rose-900 border border-rose-400 font-black' :
                              d.statusKey === 'holiday' ? 'bg-amber-50 text-amber-900 border border-amber-200' :
                              d.statusKey === 'weekend' ? 'bg-slate-200/70 text-slate-700 border border-slate-300' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {d.statusLabel}
                            </span>
                          </td>
                          <td className="p-0.5 border-l border-slate-300 text-center text-[6.5px] text-slate-600 truncate max-w-[65px]">
                            {d.leaveType !== '-' ? d.leaveType : d.missionName !== '-' ? d.missionName : d.holidayLabel !== '-' ? d.holidayLabel : d.notes || d.deviceName || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 5. أسفل التقرير: التوقيعات الأربعة + تاريخ الطباعة ورقم الصفحة */}
        <div className="space-y-1.5 w-full pt-1">
          {/* Signatures Row */}
          <div className="border border-slate-900 p-1.5 bg-slate-50/50">
            <div className="grid grid-cols-4 gap-3 text-center text-[7.5px]">
              {/* توقيع الموظف */}
              <div className="space-y-3.5">
                <span className="font-black text-slate-800 block">{isRtl ? 'توقيع الموظف' : 'Employee Signature'}</span>
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                <span className="text-[6.5px] text-slate-400 font-mono block">التاريخ: ___/___/202_</span>
              </div>

              {/* مسؤول الحضور والانصراف */}
              <div className="space-y-3.5">
                <span className="font-black text-slate-800 block">{isRtl ? 'مسؤول الحضور والانصراف' : 'Attendance Officer'}</span>
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                <span className="text-[6.5px] text-slate-400 font-mono block">التوقيع: _____________</span>
              </div>

              {/* مدير الموارد البشرية */}
              <div className="space-y-3.5">
                <span className="font-black text-slate-800 block">{isRtl ? 'مدير الموارد البشرية' : 'HR Manager'}</span>
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                <span className="text-[6.5px] text-slate-400 font-mono block">الاعتماد: _____________</span>
              </div>

              {/* الختم الرسمي */}
              <div className="space-y-3.5">
                <span className="font-black text-slate-800 block">{isRtl ? 'الختم الرسمي' : 'Official Seal'}</span>
                <div className="border-b border-dashed border-slate-400 w-3/4 mx-auto" />
                <span className="text-[6.5px] text-slate-400 font-mono block">STAMP / SEAL</span>
              </div>
            </div>
          </div>

          {/* Bottom Line: تاريخ الطباعة ورقم الصفحة */}
          <div className="flex justify-between items-center text-[7px] text-slate-500 px-1 font-mono">
            <div>
              <span>{isRtl ? 'تاريخ الطباعة:' : 'Printed on:'} {printTimestamp}</span>
            </div>
            <div className="font-sans font-bold text-slate-600">
              {isRtl ? 'نظام إدارة الموارد البشرية والرواتب المعتمد' : 'Official HR & Attendance System'}
            </div>
            <div>
              <span>{isRtl ? 'رقم الصفحة: 1 من 1' : 'Page 1 of 1'}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
