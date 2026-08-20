import { 
  Employee, 
  AttendanceRecord, 
  AttendanceShift, 
  Mission, 
  LeaveRequest, 
  AbsenceRecord, 
  AbsenceType as AbsenceTypeModel,
  AdministrativeNotice
} from '../types';
import { format, parse, isAfter, isBefore, addMinutes } from 'date-fns';
import { formatTime12h } from './timeFormatter';

export interface MonthlyDayAttendanceDetail {
  dayNumber: number;
  dateStr: string;
  dayName: string;
  isWorkDay: boolean;
  firstIn: AttendanceRecord | undefined;
  lastOut: AttendanceRecord | undefined;
  inTimeStr: string;
  outTimeStr: string;
  delayMinutes: number;
  earlyOutMinutes: number;
  overtimeMinutes: number;
  statusKey: 'present' | 'late' | 'mission' | 'leave' | 'wfh' | 'absent' | 'weekend' | 'holiday' | 'off_overtime';
  statusLabel: string;
  leaveType: string;
  leaveReason?: string;
  missionName: string;
  missionDestination?: string;
  isWfh: boolean;
  wfhNote?: string;
  holidayLabel: string;
  notes: string;
  deviceName?: string;
}

export interface MonthlyAttendanceSummaryStats {
  presentCount: number;
  lateCount: number;
  missionCount: number;
  leaveCount: number;
  wfhCount: number;
  absentCount: number;
  weekendHolidayCount: number;
  totalDelayMins: number;
  totalOvertimeMins: number;
  totalDays: number;
  shiftName: string;
}

export interface CalculateMonthlyAttendanceResult {
  days: MonthlyDayAttendanceDetail[];
  stats: MonthlyAttendanceSummaryStats;
}

export const isMissionApproved = (status?: string | null): boolean => {
  if (!status) return false;
  const s = status.trim();
  return [
    'Approved',
    'Completed',
    'Executed',
    'معتمدة',
    'مكتملة',
    'مكتملة ومُقيّمة',
    'منفذة',
    'تمت الموافقة'
  ].includes(s);
};

export const isLeaveApproved = (status?: string | null): boolean => {
  if (!status) return false;
  const s = status.trim();
  return [
    'Approved',
    'معتمدة',
    'مقبولة',
    'تمت الموافقة'
  ].includes(s);
};

export interface CalculateMonthlyAttendanceParams {
  employee: Employee;
  month: string; // 'YYYY-MM'
  attendanceRecords: AttendanceRecord[];
  attendanceShifts: AttendanceShift[];
  missions: Mission[];
  leaveRequests: LeaveRequest[];
  absenceRecords: AbsenceRecord[];
  absenceTypes: AbsenceTypeModel[];
  administrativeNotices?: AdministrativeNotice[];
  language?: 'ar' | 'en' | string;
}

export function calculateEmployeeMonthlyAttendance({
  employee,
  month,
  attendanceRecords = [],
  attendanceShifts = [],
  missions = [],
  leaveRequests = [],
  absenceRecords = [],
  absenceTypes = [],
  administrativeNotices = [],
  language = 'ar'
}: CalculateMonthlyAttendanceParams): CalculateMonthlyAttendanceResult {
  const isRtl = language === 'ar';
  const langCode: 'ar' | 'en' = language === 'en' ? 'en' : 'ar';

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

  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(monthNum)) {
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

  const shift = attendanceShifts.find(s => s.id === employee.shiftId) || attendanceShifts[0] || null;
  const shiftName = shift?.name || (isRtl ? 'بدون تقويم عمل' : 'No Shift');
  const shiftWorkDays = shift?.workDays || [0, 1, 2, 3, 4]; // Default Sun-Thu

  const lastDay = new Date(year, monthNum, 0).getDate();

  const candidateIds = [
    employee.id, 
    employee.employeeId, 
    employee.userId, 
    employee.email
  ].filter(Boolean).map(x => String(x).trim().toLowerCase());

  const approvedMissions = (missions || []).filter(m => 
    candidateIds.includes(String(m.employeeId || '').trim().toLowerCase()) &&
    isMissionApproved(m.status)
  );

  const approvedLeaves = (leaveRequests || []).filter(l => 
    candidateIds.includes(String(l.employeeId || '').trim().toLowerCase()) &&
    isLeaveApproved(l.status)
  );

  const daysList: MonthlyDayAttendanceDetail[] = [];

  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${month}-${String(day).padStart(2, '0')}`;
    const dateObj = new Date(year, monthNum - 1, day);
    const dayOfWeek = dateObj.getDay();
    const isWorkDay = shiftWorkDays.includes(dayOfWeek);

    // Arabic and English Day Names
    const dayNamesAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = isRtl ? dayNamesAr[dayOfWeek] : dayNamesEn[dayOfWeek];

    // Day attendance logs
    const dayRecords = (attendanceRecords || []).filter(r => 
      candidateIds.includes(String(r.employeeId || '').trim().toLowerCase()) && 
      r.timestamp && 
      r.timestamp.startsWith(dateStr)
    );

    const sortedRecords = [...dayRecords].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const firstIn = sortedRecords.find(r => r.type === 'In');
    const lastOut = sortedRecords.find(r => r.type === 'Out') || 
                    [...sortedRecords].reverse().find(r => r.type === 'Out');

    // Check Mission
    const mission = approvedMissions.find(m => dateStr >= m.startDate && dateStr <= m.endDate);

    // Check Leave & WFH & Official Holiday
    const leave = approvedLeaves.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
    const isWfhLeave = Boolean(leave && (
      leave.type === 'WorkFromHome' || 
      leave.type === 'WFH' || 
      leave.type === 'العمل من المنزل' || 
      leave.type === 'Work From Home' ||
      leave.type?.includes('عن بعد') ||
      leave.type?.includes('من المنزل')
    ));

    const isOfficialHolidayLeave = Boolean(leave && (
      leave.type === 'OfficialHoliday' || 
      leave.type === 'Official' || 
      leave.type === 'إجازة رسمية' || 
      leave.type === 'عطلة رسمية' ||
      leave.type?.includes('رسمية')
    ));

    const isRemoteEmployee = employee.workMode === 'Remotely Work';
    const isWfh = isWfhLeave || isRemoteEmployee;

    // Check Official Holiday notices
    const matchingNotice = (administrativeNotices || []).find(n => 
      n.status === 'Published' &&
      (n.category === 'circular' || n.category === 'decision' || n.category === 'event') &&
      ((n.startDate && n.endDate && dateStr >= n.startDate && dateStr <= n.endDate) || n.noticeDate === dateStr) &&
      (n.title?.includes('عطلة') || n.title?.includes('إجازة رسمية') || n.title?.includes('عيد') || n.content?.includes('عطلة'))
    );

    let delayMinutes = 0;
    let earlyOutMinutes = 0;
    let overtimeMinutes = 0;

    if (firstIn) {
      if (shift) {
        try {
          const shiftStart = parse(shift.startTime, 'HH:mm', dateObj);
          const actualIn = new Date(firstIn.timestamp);
          const graceThreshold = addMinutes(shiftStart, shift.graceMinutes || 0);

          if (isAfter(actualIn, graceThreshold)) {
            delayMinutes = Math.max(0, Math.floor((actualIn.getTime() - shiftStart.getTime()) / (1000 * 60)));
          }

          if (lastOut) {
            const shiftEnd = parse(shift.endTime, 'HH:mm', dateObj);
            const actualOut = new Date(lastOut.timestamp);

            if (isBefore(actualOut, shiftEnd)) {
              earlyOutMinutes = Math.max(0, Math.floor((shiftEnd.getTime() - actualOut.getTime()) / (1000 * 60)));
            } else if (isAfter(actualOut, shiftEnd)) {
              overtimeMinutes = Math.max(0, Math.floor((actualOut.getTime() - shiftEnd.getTime()) / (1000 * 60)));
            }
          }
        } catch (err) {
          console.error("Error calculating shift times for monthly details:", err);
        }
      } else if (lastOut) {
        const actualIn = new Date(firstIn.timestamp);
        const actualOut = new Date(lastOut.timestamp);
        const workedMins = Math.max(0, Math.floor((actualOut.getTime() - actualIn.getTime()) / (1000 * 60)));
        if (workedMins > 480) {
          overtimeMinutes = workedMins - 480;
        }
      }

      // If present on a weekend/rest day, count the attendance as full overtime
      if (!isWorkDay && firstIn) {
        if (lastOut) {
          const actualIn = new Date(firstIn.timestamp);
          const actualOut = new Date(lastOut.timestamp);
          const weekendWorked = Math.max(0, Math.floor((actualOut.getTime() - actualIn.getTime()) / (1000 * 60)));
          overtimeMinutes = weekendWorked > 0 ? weekendWorked : 480;
        } else {
          overtimeMinutes = 480;
        }
      }
    }

    const isOfficialHoliday = isOfficialHolidayLeave || Boolean(matchingNotice);
    const holidayTitle = (isOfficialHolidayLeave ? leave?.reason : matchingNotice?.title) || (isRtl ? 'إجازة رسمية' : 'Official Holiday');

    // Determine strict non-conflicting Day Status (Exactly ONE status per day)
    let statusKey: MonthlyDayAttendanceDetail['statusKey'] = 'present';
    let statusLabel = isRtl ? 'حاضر' : 'Present';
    let leaveType = '-';
    let missionName = '-';
    let holidayLabel = '-';
    let notes = '';

    if (isOfficialHoliday) {
      holidayLabel = holidayTitle;
    }

    if (!isWorkDay) {
      // Non-work Day (Weekend / Weekly Rest)
      if (!isOfficialHoliday) {
        holidayLabel = isRtl ? 'عطلة أسبوعية' : 'Weekly Rest';
      }
      if (firstIn) {
        statusKey = 'off_overtime';
        statusLabel = isRtl ? 'حاضر (يوم عطلة / إضافي)' : 'Present on Rest Day (OT)';
        notes = isRtl ? 'حضور في يوم راحة أسبوعية احتُسب إضافي' : 'Weekend punch calculated as overtime';
      } else if (mission) {
        statusKey = 'mission';
        statusLabel = isRtl ? 'مأمورية عمل' : 'On Mission';
        missionName = mission.destination || mission.reason || (isRtl ? 'مأمورية معتمدة' : 'Approved Mission');
      } else if (isOfficialHoliday) {
        statusKey = 'holiday';
        statusLabel = holidayTitle;
        notes = (isOfficialHolidayLeave ? leave?.reviewNote : '') || (isRtl ? 'إجازة رسمية مدفوعة الأجر' : 'Paid Official Holiday');
      } else {
        statusKey = 'weekend';
        statusLabel = isRtl ? 'عطلة أسبوعية' : 'Weekend Rest';
      }
    } else {
      // Scheduled Work Day
      if (mission) {
        statusKey = 'mission';
        statusLabel = isRtl ? 'مأمورية عمل' : 'On Mission';
        missionName = mission.destination || mission.reason || (isRtl ? 'مأمورية معتمدة' : 'Approved Mission');
        notes = isRtl ? 'مأمورية معتمدة - يوم عمل كامل بدون خصم' : 'Approved mission - full work day';
      } else if (isOfficialHoliday) {
        if (firstIn) {
          statusKey = 'off_overtime';
          statusLabel = isRtl ? 'حاضر (يوم إجازة رسمية / إضافي)' : 'Present on Holiday (OT)';
          notes = isRtl ? 'حضور في يوم إجازة رسمية احتُسب إضافي' : 'Official holiday punch calculated as overtime';
        } else {
          statusKey = 'holiday';
          statusLabel = holidayTitle;
          leaveType = isRtl ? 'إجازة رسمية' : 'Official Holiday';
          notes = (isOfficialHolidayLeave ? leave?.reviewNote : '') || (isRtl ? 'إجازة رسمية معتمدة ومدفوعة الأجر بالكامل' : 'Paid official holiday - full work day');
        }
      } else if (isWfh) {
        statusKey = 'wfh';
        statusLabel = isRtl ? 'عمل عن بُعد' : 'Remote / WFH';
        notes = isRtl ? 'عمل عن بُعد / منزلي معتمد' : 'Approved remote work';
      } else if (leave && !isWfhLeave) {
        statusKey = 'leave';
        if (leave.type === 'Sick') {
          statusLabel = isRtl ? 'إجازة مرضية' : 'Sick Leave';
          leaveType = isRtl ? 'إجازة مرضية' : 'Sick Leave';
        } else if (leave.type === 'Vacation' || leave.type === 'Annual') {
          statusLabel = isRtl ? 'إجازة اعتيادية' : 'Annual Leave';
          leaveType = isRtl ? 'إجازة اعتيادية' : 'Annual Leave';
        } else if (leave.type === 'Unpaid') {
          statusLabel = isRtl ? 'إجازة بدون مرتب' : 'Unpaid Leave';
          leaveType = isRtl ? 'إجازة بدون مرتب' : 'Unpaid Leave';
        } else if (leave.type === 'Permission') {
          statusLabel = isRtl ? 'تصريح' : 'Permission';
          leaveType = isRtl ? 'تصريح' : 'Permission';
        } else {
          statusLabel = isRtl ? `إجازة (${leave.type})` : `Leave (${leave.type})`;
          leaveType = leave.type;
        }
        notes = leave.reason || '';
      } else if (firstIn) {
        if (delayMinutes > 0) {
          statusKey = 'late';
          statusLabel = isRtl ? 'حاضر (متأخر)' : 'Late Present';
        } else {
          statusKey = 'present';
          statusLabel = isRtl ? 'حاضر' : 'Present';
        }
        if (firstIn.note) notes = firstIn.note;
      } else {
        // No punches, no mission, no holiday, no leave on a scheduled work day
        const customAbsence = (absenceRecords || []).find(a => 
          candidateIds.includes(String(a.employeeId || '').trim().toLowerCase()) && 
          a.date === dateStr
        );
        if (customAbsence) {
          const absType = (absenceTypes || []).find(at => at.id === customAbsence.absenceTypeId);
          statusKey = 'absent';
          statusLabel = absType ? `${isRtl ? 'غياب' : 'Absent'} (${absType.name})` : (isRtl ? 'غياب مسجل' : 'Logged Absence');
          notes = customAbsence.note || '';
        } else {
          statusKey = 'absent';
          statusLabel = isRtl ? 'غائب' : 'Absent';
        }
      }
    }

    const inTimeStr = firstIn ? formatTime12h(firstIn.timestamp, langCode) : '-';
    const outTimeStr = lastOut ? formatTime12h(lastOut.timestamp, langCode) : '-';
    const deviceName = firstIn?.deviceName || lastOut?.deviceName || '';

    daysList.push({
      dayNumber: day,
      dateStr,
      dayName,
      isWorkDay,
      firstIn,
      lastOut,
      inTimeStr,
      outTimeStr,
      delayMinutes,
      earlyOutMinutes,
      overtimeMinutes,
      statusKey,
      statusLabel,
      leaveType,
      leaveReason: leave?.reason,
      missionName,
      missionDestination: mission?.destination,
      isWfh,
      wfhNote: isWfh ? (isRtl ? 'عمل عن بُعد معتمد' : 'Approved Remote') : undefined,
      holidayLabel,
      notes,
      deviceName
    });
  }

  // Aggregate KPI Statistics
  let presentCount = 0;
  let lateCount = 0;
  let missionCount = 0;
  let leaveCount = 0;
  let wfhCount = 0;
  let absentCount = 0;
  let weekendHolidayCount = 0;
  let totalDelayMins = 0;
  let totalOvertimeMins = 0;

  daysList.forEach(d => {
    if (d.statusKey === 'present') {
      presentCount++;
    } else if (d.statusKey === 'late') {
      presentCount++;
      lateCount++;
    } else if (d.statusKey === 'mission') {
      missionCount++;
    } else if (d.statusKey === 'leave') {
      leaveCount++;
    } else if (d.statusKey === 'wfh') {
      wfhCount++;
      presentCount++;
    } else if (d.statusKey === 'absent') {
      absentCount++;
    } else if (d.statusKey === 'weekend' || d.statusKey === 'holiday') {
      weekendHolidayCount++;
    } else if (d.statusKey === 'off_overtime') {
      presentCount++;
      weekendHolidayCount++;
    }

    totalDelayMins += d.delayMinutes;
    totalOvertimeMins += d.overtimeMinutes;
  });

  return {
    days: daysList,
    stats: {
      presentCount,
      lateCount,
      missionCount,
      leaveCount,
      wfhCount,
      absentCount,
      weekendHolidayCount,
      totalDelayMins,
      totalOvertimeMins,
      totalDays: daysList.length,
      shiftName
    }
  };
}
