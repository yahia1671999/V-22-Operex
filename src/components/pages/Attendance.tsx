import React, { useState, useMemo } from 'react';
import { 
  Fingerprint, 
  Settings, 
  RefreshCw, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar,
  Search,
  Filter,
  Monitor,
  Activity,
  FileBarChart,
  CalendarDays,
  Plane,
  FileSpreadsheet,
  Upload,
  Download,
  FileUp,
  FileDown,
  Table,
  FileCheck,
  AlertCircle,
  HelpCircle,
  Check,
  FileText,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc, updateDoc } from '../../api';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../AuthContext';
import { 
  AttendanceRecord, 
  AttendanceDevice, 
  Employee, 
  AttendanceShift, 
  Mission, 
  AbsenceRecord, 
  AbsenceType as AbsenceTypeModel,
  LeaveRequest
} from '../../types';
import { format, isSameDay, startOfDay, parse, isAfter, addMinutes, getDay, isWithinInterval, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { usePermissions } from '../../hooks/usePermissions';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatTime12h, formatDateTime12h, createLocalTimestamp } from '../../utils/timeFormatter';

export interface ParsedSheetRow {
  id: string;
  employeeIdInput: string;
  employeeNameRef?: string;
  employeeObj?: Employee;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  notes: string;
  isValid: boolean;
  errorReason?: string;
}

export interface EditableSheetRow {
  id: string;
  employeeId: string;
  date: string;
  checkInTime: string;
  checkOutTime: string;
  notes: string;
}

export const Attendance: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { user } = useAuth();
  const { canView, canCreate, canEdit, canDelete } = usePermissions();
  const { 
    employees, 
    attendanceRecords, 
    attendanceDevices, 
    attendanceShifts,
    missions,
    absenceRecords,
    absenceTypes,
    leaveRequests,
    adminDepartments,
    refreshData
  } = useData();

  const hasViewAccess = canView('attendance');

  const [activeTab, setActiveTab] = useState<'records' | 'reports' | 'absence-records' | 'shifts' | 'devices' | 'absence-types' | 'leave-requests' | 'sheet-import-export'>('records');
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isAbsenceTypeModalOpen, setIsAbsenceTypeModalOpen] = useState(false);
  const [isLeaveRequestModalOpen, setIsLeaveRequestModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily');

  // Sheet Import / Export States
  const [parsedSheetRows, setParsedSheetRows] = useState<ParsedSheetRow[]>([]);
  const [sheetGridRows, setSheetGridRows] = useState<EditableSheetRow[]>([
    { id: '1', employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), checkInTime: '08:30', checkOutTime: '17:00', notes: '' },
    { id: '2', employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), checkInTime: '08:30', checkOutTime: '17:00', notes: '' }
  ]);
  const [isImportingSheet, setIsImportingSheet] = useState(false);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'invalid'>('all');

  const [exportStartDate, setExportStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [exportEndDate, setExportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exportDeptId, setExportDeptId] = useState('');
  const [exportEmpId, setExportEmpId] = useState('');

  // Shift Form State
  const [shiftForm, setShiftForm] = useState<Omit<AttendanceShift, 'id'>>({
    name: '',
    startTime: '08:00',
    endTime: '17:00',
    graceMinutes: 15,
    workDays: [0, 1, 2, 3, 4] // Sun-Thu by default
  });

  // Leave Request Form State
  const [leaveRequestForm, setLeaveRequestForm] = useState<Partial<LeaveRequest>>({
    employeeId: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    type: 'Vacation',
    reason: '',
    status: 'Pending'
  });

  const [balanceAlert, setBalanceAlert] = useState<{ show: boolean; entitled: number; consumed: number; remaining: number; requested: number } | null>(null);

  // Absence Type Form State
  const [absenceTypeForm, setAbsenceTypeForm] = useState<Omit<AbsenceTypeModel, 'id'>>({
    name: '',
    deductionRatio: 1
  });

  // Absence Record Form State
  const [absenceRecordForm, setAbsenceRecordForm] = useState<Omit<AbsenceRecord, 'id'>>({
    employeeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    absenceTypeId: '',
    note: ''
  });

  const [isAbsenceRecordModalOpen, setIsAbsenceRecordModalOpen] = useState(false);

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    employeeId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
    type: 'In' as 'In' | 'Out',
    note: ''
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, type: 'shift' | 'absenceRecord' | 'absenceType', show: boolean }>({ id: '', type: 'shift', show: false });

  // Device Form State
  const [deviceForm, setDeviceForm] = useState<Omit<AttendanceDevice, 'id'>>({
    name: '',
    ipAddress: '',
    port: 4370,
    status: 'Offline'
  });

  const getDaysDifference = (start: string | undefined, end: string | undefined) => {
    if (!start || !end) return 0;
    const sDate = new Date(start);
    const eDate = new Date(end);
    const diffTime = eDate.getTime() - sDate.getTime();
    if (diffTime < 0) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const selectedEmployeeInfo = useMemo(() => {
    if (!leaveRequestForm.employeeId) return null;
    const employee = employees.find(e => e.id === leaveRequestForm.employeeId);
    if (!employee) return null;

    const entitled = Number(employee.leavePlan || 21);
    const currentYear = new Date().getFullYear();
    const approvedList = leaveRequests.filter(lr => 
      lr.employeeId === employee.id &&
      lr.status === 'Approved' &&
      (lr.type === 'Vacation' || lr.type === 'Annual' || lr.type === t('إجازة اعتيادية') || lr.type === t('اعتيادي')) &&
      (lr.startDate && lr.startDate.startsWith(String(currentYear)))
    );

    const consumed = approvedList.reduce((sum, lr) => {
      const days = getDaysDifference(lr.startDate, lr.endDate);
      return sum + days;
    }, 0);

    const requested = getDaysDifference(leaveRequestForm.startDate, leaveRequestForm.endDate);
    const remaining = entitled - (consumed + requested);

    return {
      entitled,
      requested,
      consumed,
      remaining
    };
  }, [leaveRequestForm.employeeId, employees, leaveRequests, leaveRequestForm.startDate, leaveRequestForm.endDate]);

  const handleAddLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    
    // Check vacation leave balance before submission
    if (leaveRequestForm.type === 'Vacation' && leaveRequestForm.employeeId) {
      const requestedDays = getDaysDifference(leaveRequestForm.startDate, leaveRequestForm.endDate);
      if (selectedEmployeeInfo && selectedEmployeeInfo.remaining < 0) {
        setBalanceAlert({
          show: true,
          entitled: selectedEmployeeInfo.entitled,
          consumed: selectedEmployeeInfo.consumed,
          remaining: selectedEmployeeInfo.entitled - selectedEmployeeInfo.consumed, // remaining before this request
          requested: requestedDays
        });
        return; // Prevent submission
      }
    }
    
    const newRequest: LeaveRequest = {
      ...(leaveRequestForm as LeaveRequest),
      id,
      employeeId: leaveRequestForm.employeeId || '', // Should be caught by required attribute
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    try {
      await setDoc(doc(db, 'leaveRequests', id), newRequest);
      await refreshData();
      setIsLeaveRequestModalOpen(false);
      setBalanceAlert(null);
      setLeaveRequestForm({
        employeeId: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        type: 'Vacation',
        reason: '',
        status: 'Pending'
      });
    } catch (error) {
       console.error('Error adding leave request', error);
    }
  };

  const handleUpdateLeaveRequestStatus = async (id: string, newStatus: LeaveRequest['status'], reviewNote: string = '') => {
    try {
      await updateDoc(doc(db, 'leaveRequests', id), {
        status: newStatus,
        managerId: user?.uid || '',
        reviewNote,
        updatedAt: new Date().toISOString()
      });
      await refreshData();
    } catch (error) {
      console.error('Error updating leave request status', error);
    }
  };

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'attendanceShifts', id), { ...shiftForm, id });
    await refreshData();
    setIsShiftModalOpen(false);
    setShiftForm({ name: '', startTime: '08:00', endTime: '17:00', graceMinutes: 15, workDays: [0, 1, 2, 3, 4] });
  };

  const handleAddAbsenceType = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'absenceTypes', id), { ...absenceTypeForm, id });
    await refreshData();
    setIsAbsenceTypeModalOpen(false);
    setAbsenceTypeForm({ name: '', deductionRatio: 1 });
  };

  const handleAddAbsenceRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    
    // Sanitize foreign keys
    const sanitizedRecord = {
      ...absenceRecordForm,
      id,
      employeeId: absenceRecordForm.employeeId || '', // NOT NULL in schema
      absenceTypeId: absenceRecordForm.absenceTypeId || null // OPTIONAL in schema
    };

    await setDoc(doc(db, 'absenceRecords', id), sanitizedRecord);
    await refreshData();
    setIsAbsenceRecordModalOpen(false);
    setAbsenceRecordForm({
      employeeId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      absenceTypeId: '',
      note: ''
    });
  };

  const handleDeleteShift = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'attendanceShifts', id));
      await refreshData();
    } catch (error) {
      console.error('Error deleting shift', error);
    }
  };

  const calculateReport = useMemo(() => {
    const targetDate = new Date(reportDate);
    const targetDateStr = format(targetDate, 'yyyy-MM-dd');
    const dayOfWeek = getDay(targetDate);
    
    return employees.map(emp => {
      const shift = attendanceShifts.find(s => s.id === emp.shiftId) || attendanceShifts[0];
      const isWorkDay = shift?.workDays.includes(dayOfWeek);
      
      const empCandidateIds = [emp.id, emp.employeeId, emp.userId, emp.email].filter(Boolean).map(x => String(x).trim().toLowerCase());
      const dayRecords = attendanceRecords.filter(r => 
        empCandidateIds.includes(String(r.employeeId || '').trim().toLowerCase()) && 
        isSameDay(new Date(r.timestamp), targetDate)
      ).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      const firstIn = dayRecords.find(r => r.type === 'In');
      const lastOut = [...dayRecords].reverse().find(r => r.type === 'Out');

      // Check missions (ماموريات)
      const isMission = missions.some(m => 
        m.employeeId === emp.id && 
        m.status === 'Approved' &&
        targetDateStr >= m.startDate && 
        targetDateStr <= m.endDate
      );

      // Check custom absence records
      const customAbsence = absenceRecords.find(a => 
        a.employeeId === emp.id && 
        a.date === targetDateStr
      );
      const absenceType = customAbsence ? absenceTypes.find(at => at.id === customAbsence.absenceTypeId) : null;

      // Check approved leave requests
      const isLeave = leaveRequests.find(lr => 
        lr.employeeId === emp.id && 
        lr.status === 'Approved' && 
        targetDateStr >= lr.startDate && 
        targetDateStr <= lr.endDate
      );

      let delayMinutes = 0;
      let overtimeMinutes = 0;
      let status: 'Present' | 'Absent' | 'Off' | 'Mission' | string = 'Absent';

      if (firstIn) {
        status = 'Present';
        if (shift) {
          const shiftStart = parse(shift.startTime, 'HH:mm', targetDate);
          const graceThreshold = addMinutes(shiftStart, shift.graceMinutes);
          const actualIn = new Date(firstIn.timestamp);
          
          if (isAfter(actualIn, graceThreshold)) {
            delayMinutes = Math.floor((actualIn.getTime() - shiftStart.getTime()) / (1000 * 60));
          }

          if (lastOut) {
            const shiftEnd = parse(shift.endTime, 'HH:mm', targetDate);
            const actualOut = new Date(lastOut.timestamp);
            if (isAfter(actualOut, shiftEnd)) {
              overtimeMinutes = Math.floor((actualOut.getTime() - shiftEnd.getTime()) / (1000 * 60));
            }
          }
        } else if (firstIn && lastOut) {
          const actualIn = new Date(firstIn.timestamp);
          const actualOut = new Date(lastOut.timestamp);
          const workedMins = Math.floor((actualOut.getTime() - actualIn.getTime()) / (1000 * 60));
          if (workedMins > 480) {
            overtimeMinutes = workedMins - 480;
          }
        }
      } else if (isMission) {
        status = 'Mission';
      } else if (isLeave) {
        status = isLeave.type === 'Vacation' ? t('إجازة اعتيادية') : 
                 isLeave.type === 'Sick' ? t('إجازة مرضية') : 
                 isLeave.type === 'Unpaid' ? t('بدون مرتب') : 
                 isLeave.type === 'WorkFromHome' ? t('العمل من المنزل') :
                 isLeave.type === 'Permission' ? t('تصريح') : t('أخرى');
      } else if (absenceType) {
        status = absenceType.name;
      } else if (!isWorkDay) {
        status = 'Off';
      }

      return {
        ...emp,
        firstIn,
        lastOut,
        delayMinutes,
        overtimeMinutes,
        status,
        shiftName: shift?.name || t('بدون تقويم عمل')
      };
    });
  }, [employees, attendanceRecords, attendanceShifts, reportDate, missions, absenceRecords, absenceTypes, leaveRequests]);

  const monthlyReport = useMemo(() => {
    return employees.map(emp => {
      const shift = attendanceShifts.find(s => s.id === emp.shiftId) || attendanceShifts[0];
      const empCandidateIds = [emp.id, emp.employeeId, emp.userId, emp.email].filter(Boolean).map(x => String(x).trim().toLowerCase());
      const monthRecords = attendanceRecords.filter(r => 
        empCandidateIds.includes(String(r.employeeId || '').trim().toLowerCase()) && 
        r.timestamp.startsWith(reportMonth)
      );

      const monthMissions = missions.filter(m => 
        m.employeeId === emp.id && 
        m.status === 'Approved' &&
        (m.startDate.startsWith(reportMonth) || m.endDate.startsWith(reportMonth))
      );

      const monthLeaves = leaveRequests.filter(l => 
        l.employeeId === emp.id && 
        l.status === 'Approved' &&
        (l.startDate.startsWith(reportMonth) || l.endDate.startsWith(reportMonth))
      );

      // Group records by day
      const daysInMonth = monthRecords.reduce((acc, r) => {
        const day = r.timestamp.split('T')[0];
        if (!acc[day]) acc[day] = [];
        acc[day].push(r);
        return acc;
      }, {} as Record<string, AttendanceRecord[]>);

      let totalDelay = 0;
      let totalOvertime = 0;
      let presentDays = 0;
      let lateDays = 0;
      let missionDays = 0;
      let absentDays = 0;
      let leaveDays = 0;

      const year = parseInt(reportMonth.split('-')[0]);
      const month = parseInt(reportMonth.split('-')[1]);
      const lastDay = new Date(year, month, 0).getDate();

      for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${reportMonth}-${String(d).padStart(2, '0')}`;
        const targetDate = new Date(dateStr);
        const dayOfWeek = getDay(targetDate);
        const isWorkDay = shift?.workDays.includes(dayOfWeek);

        if (!isWorkDay) continue;

        const records = daysInMonth[dateStr] || [];
        const sorted = records.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        const firstIn = sorted.find(r => r.type === 'In');
        const lastOut = sorted.find(r => r.type === 'Out') || [...sorted].reverse().find(r => r.type === 'Out');

        const isMission = monthMissions.some(m => dateStr >= m.startDate && dateStr <= m.endDate);
        const matchingLeave = monthLeaves.find(l => dateStr >= l.startDate && dateStr <= l.endDate);
        const isWfh = Boolean(matchingLeave && (matchingLeave.type === 'WorkFromHome' || matchingLeave.type === 'WFH' || matchingLeave.type === t('العمل من المنزل') || matchingLeave.type === 'Work From Home'));
        const isLeave = Boolean(matchingLeave && !isWfh);
        const customAbsence = absenceRecords.find(a => a.employeeId === emp.id && a.date === dateStr);

        if (firstIn) {
          presentDays++;
          if (shift) {
            const shiftStart = parse(shift.startTime, 'HH:mm', targetDate);
            const actualIn = new Date(firstIn.timestamp);
            const graceThreshold = addMinutes(shiftStart, shift.graceMinutes);
            
            if (isAfter(actualIn, graceThreshold)) {
              totalDelay += Math.floor((actualIn.getTime() - shiftStart.getTime()) / (1000 * 60));
              lateDays++;
            }

            if (lastOut) {
              const shiftEnd = parse(shift.endTime, 'HH:mm', targetDate);
              const actualOut = new Date(lastOut.timestamp);
              if (isAfter(actualOut, shiftEnd)) {
                totalOvertime += Math.floor((actualOut.getTime() - shiftEnd.getTime()) / (1000 * 60));
              }
            }
          } else if (lastOut) {
            const actualIn = new Date(firstIn.timestamp);
            const actualOut = new Date(lastOut.timestamp);
            const workedMins = Math.floor((actualOut.getTime() - actualIn.getTime()) / (1000 * 60));
            if (workedMins > 480) {
              totalOvertime += (workedMins - 480);
            }
          }
        } else if (isMission) {
          missionDays++;
        } else if (isWfh) {
          // أيام العمل من المنزل والعمل عن بعد المعتمدة: يوم عمل فعلي كامل ولا يعتبر غياباً
          presentDays++;
        } else if (isLeave) {
          leaveDays++;
        } else if (customAbsence) {
          const type = absenceTypes.find(at => at.id === customAbsence.absenceTypeId);
          if (type && type.deductionRatio > 0) {
            absentDays += type.deductionRatio;
          }
        } else {
          absentDays++;
        }
      }

      return {
        ...emp,
        presentDays,
        lateDays,
        missionDays,
        leaveDays,
        absentDays,
        totalDelay,
        totalOvertime,
        shiftName: shift?.name || t('بدون تقويم عمل')
      };
    });
  }, [employees, attendanceRecords, attendanceShifts, reportMonth, missions, absenceRecords, absenceTypes, leaveRequests]);

  const handleAddManualRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    const timestamp = createLocalTimestamp(manualForm.date, manualForm.time);
    
    const record: AttendanceRecord = {
      id,
      employeeId: manualForm.employeeId,
      timestamp,
      type: manualForm.type,
      manual: true,
      note: manualForm.note,
      deviceName: t('إضافة يدوية')
    };

    await setDoc(doc(db, 'attendanceRecords', id), record);
    await refreshData();
    setIsManualModalOpen(false);
    setManualForm({
      employeeId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
      type: 'In',
      note: ''
    });
  };

  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = crypto.randomUUID();
    await setDoc(doc(db, 'attendanceDevices', id), deviceForm);
    await refreshData();
    setIsDeviceModalOpen(false);
    setDeviceForm({ name: '', ipAddress: '', port: 4370, status: 'Offline' });
  };

  const handleSync = async (device: AttendanceDevice) => {
    setIsSyncing(true);
    // Simulate API call to device IP
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update last sync
    await setDoc(doc(db, 'attendanceDevices', device.id), {
      ...device,
      lastSync: new Date().toISOString(),
      status: 'Online'
    }, { merge: true });

    // Mock: Add a new record
    const mockRecord: AttendanceRecord = {
      id: crypto.randomUUID(),
      employeeId: employees[0]?.id || 'mock-id',
      timestamp: new Date().toISOString(),
      type: 'In',
      deviceId: device.id,
      deviceName: device.name
    };
    await setDoc(doc(db, 'attendanceRecords', mockRecord.id), mockRecord);
    await refreshData();
    setIsSyncing(false);
  };

  // --- Sheet Import & Export Handlers ---
  const handleDownloadTemplate = () => {
    const sampleEmp1 = employees[0];
    const sampleEmp2 = employees[1];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    const headers = ['كود الموظف', 'اسم الموظف', 'التاريخ', 'وقت الدخول', 'وقت الخروج', 'ملاحظات'];
    const sampleRows = [
      [sampleEmp1?.employeeId || 'EMP001', sampleEmp1?.name || 'أحمد علي', todayStr, '08:30', '17:00', 'حضور اعتيادي'],
      [sampleEmp2?.employeeId || 'EMP002', sampleEmp2?.name || 'محمود حسن', todayStr, '09:00', '17:30', 'تأخير بعذر']
    ];
    
    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...sampleRows.map(row => row.map(val => `"${val}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `نموذج_حضور_وانصراف_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportSuccessMsg(null);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) return;

      const firstLine = lines[0];
      const separator = firstLine.includes(',') ? ',' : firstLine.includes(';') ? ';' : '\t';

      const rawHeaders = firstLine.split(separator).map(h => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
      
      let empCodeIdx = rawHeaders.findIndex(h => h.includes('كود') || h.includes('رمز') || h.includes('رقم') || h.includes('code') || h.includes('empid') || h.includes('employeeid') || h.includes('id'));
      let nameIdx = rawHeaders.findIndex(h => h.includes('اسم') || h.includes('name'));
      let dateIdx = rawHeaders.findIndex(h => h.includes('تاريخ') || h.includes('date'));
      let checkInIdx = rawHeaders.findIndex(h => h.includes('دخول') || h.includes('حضور') || h.includes('checkin') || h.includes('in'));
      let checkOutIdx = rawHeaders.findIndex(h => h.includes('خروج') || h.includes('انصراف') || h.includes('checkout') || h.includes('out'));
      let notesIdx = rawHeaders.findIndex(h => h.includes('ملاحظ') || h.includes('note'));

      let dataStartLine = 1;
      if (empCodeIdx === -1) {
        empCodeIdx = 0;
        nameIdx = 1;
        dateIdx = 2;
        checkInIdx = 3;
        checkOutIdx = 4;
        notesIdx = 5;
        const looksLikeHeader = rawHeaders.some(h => h.includes('كود') || h.includes('emp') || h.includes('date') || h.includes('اسم'));
        dataStartLine = looksLikeHeader ? 1 : 0;
      }

      const parsed: ParsedSheetRow[] = [];

      for (let i = dataStartLine; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const cols = line.split(separator).map(c => c.replace(/^["']|["']$/g, '').trim());
        if (cols.length === 0 || cols.every(c => !c)) continue;

        const empIdVal = cols[empCodeIdx >= 0 ? empCodeIdx : 0] || '';
        const nameVal = nameIdx >= 0 && cols[nameIdx] ? cols[nameIdx] : '';
        let dateVal = dateIdx >= 0 && cols[dateIdx] ? cols[dateIdx] : format(new Date(), 'yyyy-MM-dd');
        let checkInVal = checkInIdx >= 0 && cols[checkInIdx] ? cols[checkInIdx] : '';
        let checkOutVal = checkOutIdx >= 0 && cols[checkOutIdx] ? cols[checkOutIdx] : '';
        const notesVal = notesIdx >= 0 && cols[notesIdx] ? cols[notesIdx] : '';

        if (dateVal.includes('/')) {
          const parts = dateVal.split('/');
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              dateVal = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
              dateVal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
        }

        const matchedEmp = employees.find(e => 
          (e.employeeId && e.employeeId.toLowerCase() === empIdVal.toLowerCase()) ||
          e.id === empIdVal ||
          (e.name && e.name.toLowerCase() === empIdVal.toLowerCase()) ||
          (nameVal && e.name.toLowerCase() === nameVal.toLowerCase())
        );

        let isValid = true;
        let errorReason = '';

        if (!matchedEmp) {
          isValid = false;
          errorReason = t('كود الموظف غير مسجل بالنظام');
        } else if (!dateVal || isNaN(new Date(dateVal).getTime())) {
          isValid = false;
          errorReason = t('صيغة التاريخ غير صحيحة');
        } else if (!checkInVal && !checkOutVal) {
          isValid = false;
          errorReason = t('يجب توفر وقت دخول أو وقت خروج على الأقل');
        }

        parsed.push({
          id: crypto.randomUUID(),
          employeeIdInput: empIdVal,
          employeeNameRef: nameVal || matchedEmp?.name || '',
          employeeObj: matchedEmp,
          date: dateVal,
          checkInTime: checkInVal,
          checkOutTime: checkOutVal,
          notes: notesVal,
          isValid,
          errorReason
        });
      }

      setParsedSheetRows(parsed);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleExecuteImport = async () => {
    const validRows = parsedSheetRows.filter(r => r.isValid && r.employeeObj);
    if (validRows.length === 0) return;

    setIsImportingSheet(true);
    try {
      let count = 0;
      for (const row of validRows) {
        const emp = row.employeeObj!;
        
        if (row.checkInTime) {
          const checkInIso = createLocalTimestamp(row.date, row.checkInTime);
          const inRecord: AttendanceRecord = {
            id: crypto.randomUUID(),
            employeeId: emp.id,
            timestamp: checkInIso,
            type: 'In',
            manual: false,
            note: row.notes || t('استيراد شيت Excel'),
            deviceName: t('استيراد شيت Excel')
          };
          await setDoc(doc(db, 'attendanceRecords', inRecord.id), inRecord);
          count++;
        }

        if (row.checkOutTime) {
          const checkOutIso = createLocalTimestamp(row.date, row.checkOutTime);
          const outRecord: AttendanceRecord = {
            id: crypto.randomUUID(),
            employeeId: emp.id,
            timestamp: checkOutIso,
            type: 'Out',
            manual: false,
            note: row.notes || t('استيراد شيت Excel'),
            deviceName: t('استيراد شيت Excel')
          };
          await setDoc(doc(db, 'attendanceRecords', outRecord.id), outRecord);
          count++;
        }
      }

      await refreshData();
      setImportSuccessMsg(t(`تم استيراد ${count} سجل حضور وانصراف بنجاح!`));
      setParsedSheetRows([]);
    } catch (err: any) {
      console.error('Error importing sheet:', err);
      alert(t('حدث خطأ أثناء استيراد البيانات: ') + err.message);
    } finally {
      setIsImportingSheet(false);
    }
  };

  const handleAddGridRow = () => {
    setSheetGridRows(prev => [
      ...prev,
      { id: crypto.randomUUID(), employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), checkInTime: '08:30', checkOutTime: '17:00', notes: '' }
    ]);
  };

  const handleRemoveGridRow = (id: string) => {
    setSheetGridRows(prev => prev.filter(r => r.id !== id));
  };

  const handleSaveGridSheet = async () => {
    const validGridRows = sheetGridRows.filter(r => r.employeeId && (r.checkInTime || r.checkOutTime));
    if (validGridRows.length === 0) {
      alert(t('يرجى اختيار موظف ووقت دخول أو خروج واحد على الأقل في الشيت التفاعلي!'));
      return;
    }

    setIsImportingSheet(true);
    try {
      let count = 0;
      for (const row of validGridRows) {
        if (row.checkInTime) {
          const checkInIso = createLocalTimestamp(row.date, row.checkInTime);
          const inRec: AttendanceRecord = {
            id: crypto.randomUUID(),
            employeeId: row.employeeId,
            timestamp: checkInIso,
            type: 'In',
            manual: true,
            note: row.notes || t('إدخال شيت تفاعلي'),
            deviceName: t('شيت الحضور التفاعلي')
          };
          await setDoc(doc(db, 'attendanceRecords', inRec.id), inRec);
          count++;
        }
        if (row.checkOutTime) {
          const checkOutIso = createLocalTimestamp(row.date, row.checkOutTime);
          const outRec: AttendanceRecord = {
            id: crypto.randomUUID(),
            employeeId: row.employeeId,
            timestamp: checkOutIso,
            type: 'Out',
            manual: true,
            note: row.notes || t('إدخال شيت تفاعلي'),
            deviceName: t('شيت الحضور التفاعلي')
          };
          await setDoc(doc(db, 'attendanceRecords', outRec.id), outRec);
          count++;
        }
      }
      await refreshData();
      setImportSuccessMsg(t(`تم حفظ وتوثيق ${count} سجل من الشيت التفاعلي بنجاح!`));
      setSheetGridRows([
        { id: crypto.randomUUID(), employeeId: '', date: format(new Date(), 'yyyy-MM-dd'), checkInTime: '08:30', checkOutTime: '17:00', notes: '' }
      ]);
    } catch (err: any) {
      console.error('Error saving grid sheet:', err);
      alert(t('حدث خطأ أثناء حفظ الشيت: ') + err.message);
    } finally {
      setIsImportingSheet(false);
    }
  };

  const handleExportRawSheet = () => {
    const filtered = attendanceRecords.filter(r => {
      const rDate = r.timestamp.split('T')[0];
      if (exportStartDate && rDate < exportStartDate) return false;
      if (exportEndDate && rDate > exportEndDate) return false;
      if (exportEmpId && r.employeeId !== exportEmpId) return false;
      if (exportDeptId) {
        const emp = employees.find(e => e.id === r.employeeId);
        if (emp?.departmentId !== exportDeptId) return false;
      }
      return true;
    });

    const headers = ['كود الموظف', 'اسم الموظف', 'التاريخ', 'الوقت', 'نوع البصمة (دخول/خروج)', 'المصدر / الجهاز', 'الملاحظات'];
    const rows = filtered.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      const dateStr = format(new Date(r.timestamp), 'yyyy-MM-dd');
      const timeStr = format(new Date(r.timestamp), 'HH:mm:ss');
      const typeStr = r.type === 'In' ? 'دخول' : 'خروج';
      return [
        emp?.employeeId || '',
        emp?.name || '',
        dateStr,
        timeStr,
        typeStr,
        r.deviceName || (r.manual ? 'يدوي' : 'جهاز بصمة'),
        r.note || ''
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `سجلات_الحضور_والانصراف_الخام_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const handleExportSummarySheet = () => {
    const headers = ['كود الموظف', 'اسم الموظف', 'نوع الدوام', 'أيام الحضور', 'أيام التأخير', 'إجمالي دقائق التأخير', 'إجمالي الساعات الإضافية (س)', 'أيام الغياب', 'أيام الإجازات', 'أيام المأموريات'];
    const rows = monthlyReport.map(r => [
      r.employeeId || '',
      r.name || '',
      r.shiftName || '',
      r.presentDays,
      r.lateDays,
      r.totalDelay,
      r.totalOvertime ? (r.totalOvertime / 60).toFixed(1) : '0',
      r.absentDays,
      r.leaveDays,
      r.missionDays
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `تقرير_حضور_وانصراف_شامل_${reportMonth}.csv`;
    a.click();
  };

  const filteredRecords = useMemo(() => {
    return attendanceRecords
      .filter(record => {
        const employee = employees.find(e => e.id === record.employeeId);
        const searchLower = searchTerm.toLowerCase();
        return (
          employee?.name.toLowerCase().includes(searchLower) ||
          employee?.employeeId.toLowerCase().includes(searchLower) ||
          record.type.toLowerCase().includes(searchLower) ||
          (record.deviceName || '').toLowerCase().includes(searchLower)
        );
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [attendanceRecords, employees, searchTerm]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const todayRecords = attendanceRecords.filter(r => r.timestamp.startsWith(today));
    const presentIds = new Set(todayRecords.map(r => r.employeeId));
    
    return {
      total: employees.length,
      present: presentIds.size,
      absent: employees.length - presentIds.size,
      onlineDevices: attendanceDevices.filter(d => d.status === 'Online').length
    };
  }, [employees, attendanceRecords, attendanceDevices]);

  const currentEmp = useMemo(() => {
    return employees.find(e => 
      e.userId === user?.uid || 
      (e.email && user?.email && e.email.toLowerCase().trim() === user.email.toLowerCase().trim()) ||
      (e.id === (user as any)?.employeeId)
    );
  }, [employees, user]);

  const isNotSubject = useMemo(() => {
    if (!currentEmp) return false;
    const val = String(currentEmp.subjectToAttendance || (currentEmp as any).isSubjectToAttendance || '').trim().toLowerCase();
    return val === 'no' || val === 'false' || val === 'لا' || (currentEmp as any).isSubjectToAttendance === false;
  }, [currentEmp]);

  if (isNotSubject && !canEdit('employees')) {
    return (
      <div className="p-8 bg-card border-2 border-destructive/40 rounded-xl flex items-center gap-6 my-12 shadow-xl max-w-2xl mx-auto">
        <ShieldAlert className="w-12 h-12 text-destructive shrink-0" />
        <div>
          <h3 className="font-black text-lg text-foreground mb-1">
            {t('أنت غير خاضع لنظام الحضور والانصراف')}
          </h3>
          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
            {t('عذراً، حسابك الوظيفي مسجل حالياً كـ "غير خاضع لنظام الحضور والانصراف" طبقاً لقرارات الموارد البشرية. لا يمكنك الوصول لصفحة الحضور أو تسجيل الحضور والانصراف.')}
          </p>
        </div>
      </div>
    );
  }

  if (!hasViewAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-card border border-border text-center">
        <p className="text-lg font-black text-destructive uppercase tracking-widest leading-relaxed">{t('عذرًا، ليس لديك صلاحيات كافية لزيارة هذه الصفحة.')}</p>
        <p className="text-xs font-bold text-muted-foreground mt-2 italic">{t('يرجى التواصل مع إدارة النظام لتفعيل الصلاحية المطلوبة.')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: t('إجمالي الموظفين'), value: stats.total, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-500/10' },
          { label: t('حضور اليوم'), value: stats.present, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10' },
          { label: t('غياب اليوم'), value: stats.absent, icon: XCircle, color: 'text-red-600', bg: 'bg-red-500/10' },
          { label: t('أجهزة متصلة'), value: stats.onlineDevices, icon: Monitor, color: 'text-purple-600', bg: 'bg-purple-500/10' },
        ].map((stat, i) => (
          <div key={i} className="bg-card p-6 rounded-none border border-border shadow-sm flex items-center gap-4 transition-colors">
            <div className={cn("w-12 h-12 rounded-none flex items-center justify-center", stat.bg, stat.color)}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-foreground leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-muted rounded-none w-fit border border-border">
        {[
          { id: 'records', label: t('سجلات الحضور'), icon: Clock },
          { id: 'sheet-import-export', label: t('استيراد وتصدير الشيت (CSV / Excel)'), icon: FileSpreadsheet },
          { id: 'reports', label: t('تقارير التأخير والغياب'), icon: FileBarChart },
          { id: 'leave-requests', label: t('طلبات الإجازة والتصريح'), icon: Plane },
          { id: 'absence-records', label: t('تسجيل الغيابات المسبقة'), icon: Calendar },
          { id: 'shifts', label: t('مواعيد الدوام'), icon: CalendarDays },
          { id: 'absence-types', label: t('أنواع الغيابات'), icon: Filter },
          { id: 'devices', label: t('أجهزة البصمة (IP)'), icon: Monitor },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-6 py-2.5 rounded-none text-xs font-black transition-all flex items-center gap-2 uppercase tracking-widest outline-none cursor-pointer",
              activeTab === tab.id ? "bg-card text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'records' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center px-2">
             <div className="relative flex-1 max-w-md w-full group">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 transition-colors group-focus-within:text-primary" />
                <input 
                  type="text" 
                  placeholder={t('بحث في السجلات...')}
                  className="w-full pr-12 pl-4 py-3 bg-card border border-border rounded-none focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-foreground shadow-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
             </div>
             <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <button 
                  onClick={() => setActiveTab('sheet-import-export')}
                  className="flex-1 md:flex-none p-3 bg-emerald-600 text-white rounded-none hover:bg-emerald-700 font-black shadow-lg shadow-emerald-600/20 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 outline-none cursor-pointer active:scale-95"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{t('استيراد / تصدير شيت Excel')}</span>
                </button>
                <button className="flex-1 md:flex-none p-3 bg-card border border-border rounded-none text-muted-foreground hover:text-foreground hover:bg-muted font-black shadow-sm transition-colors text-xs uppercase tracking-widest flex items-center justify-center gap-2 outline-none">
                  <Filter className="w-4 h-4" />
                  <span>{t('تصفية')}</span>
                </button>
                <button 
                  onClick={() => setIsManualModalOpen(true)}
                  className="flex-1 md:flex-none p-3 bg-primary text-primary-foreground rounded-none hover:bg-primary/90 font-black shadow-lg shadow-primary/20 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 outline-none active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t('إضافة يدوي')}</span>
                </button>
             </div>
          </div>

          <div className="bg-card rounded-none shadow-sm border border-border overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-muted border-b border-border text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    <th className="px-8 py-5 text-right">{t('الموظف')}</th>
                    <th className="px-8 py-5 text-right">{t('التاريخ')}</th>
                    <th className="px-8 py-5 text-right">{t('الوقت')}</th>
                    <th className="px-8 py-5 text-right">{t('النوع')}</th>
                    <th className="px-8 py-5 text-right">{t('المصدر')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRecords.map((record) => {
                    const employee = employees.find(e => e.id === record.employeeId);
                    return (
                      <tr key={record.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-primary/10 border border-primary/20 rounded-none flex items-center justify-center text-primary font-black shadow-sm transition-transform group-hover:scale-105">
                              {employee?.name?.[0] || 'U'}
                            </div>
                            <div>
                               <p className="font-black text-foreground leading-tight">{employee?.name || t('موظف مجهول')}</p>
                               <p className="text-[10px] text-muted-foreground font-bold italic">#{employee?.employeeId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 font-bold text-muted-foreground">
                          {format(new Date(record.timestamp), 'yyyy/MM/dd', { locale: ar })}
                        </td>
                        <td className="px-8 py-5 font-black text-foreground tracking-widest">
                          {formatTime12h(record.timestamp, language)}
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "px-3 py-1 rounded-none text-[10px] font-black uppercase tracking-tighter border",
                            record.type === 'In' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                          )}>
                            {record.type === 'In' ? t('دخول') : t('خروج')}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                           <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase opacity-60">
                              <Fingerprint className="w-3 h-3" />
                              {record.deviceName || t('جهاز خارجي')}
                           </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card p-6 rounded-none border border-border shadow-sm transition-colors">
             <div className="flex items-center gap-6">
                <div className="flex items-center gap-4">
                  <FileBarChart className="w-8 h-8 text-primary" />
                  <div>
                    <h3 className="text-xl font-black text-foreground">{t('تقارير الحضور')}</h3>
                    <p className="text-sm font-bold text-muted-foreground">{t('حساب التأخير والغياب')}</p>
                  </div>
                </div>

                <div className="flex p-1 bg-muted rounded-none border border-border">
                  <button 
                    onClick={() => setReportType('daily')}
                    className={cn(
                      "px-4 py-1.5 rounded-none text-[10px] font-black transition-all uppercase tracking-widest",
                      reportType === 'daily' ? "bg-card text-primary shadow-sm border border-border" : "text-muted-foreground"
                    )}
                  >{t('يومي')}</button>
                  <button 
                    onClick={() => setReportType('monthly')}
                    className={cn(
                      "px-4 py-1.5 rounded-none text-[10px] font-black transition-all uppercase tracking-widest",
                      reportType === 'monthly' ? "bg-card text-primary shadow-sm border border-border" : "text-muted-foreground"
                    )}
                  >{t('شهري')}</button>
                </div>
             </div>
             
             {reportType === 'daily' ? (
                <input 
                  type="date"
                  className="px-6 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground transition-all"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
             ) : (
                <input 
                  type="month"
                  className="px-6 py-3 bg-muted/30 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground transition-all"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                />
             )}
          </div>

          <div className="bg-card rounded-none shadow-sm border border-border overflow-hidden transition-colors">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-muted border-b border-border text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    <th className="px-8 py-5">{t('الموظف')}</th>
                    {reportType === 'daily' ? (
                      <>
                        <th className="px-8 py-5">{t('الحالة')}</th>
                        <th className="px-8 py-5">{t('وقت الحضـور')}</th>
                        <th className="px-8 py-5">{t('وقت الانصراف')}</th>
                        <th className="px-8 py-5">{t('التأخير (دقيقة)')}</th>
                        <th className="px-8 py-5">{t('الساعات الإضافية')}</th>
                      </>
                    ) : (
                      <>
                        <th className="px-8 py-5">{t('أيام الحضور')}</th>
                        <th className="px-8 py-5">{t('إجمالي التأخير (د)')}</th>
                        <th className="px-8 py-5">{t('إجمالي الإضافي (س)')}</th>
                        <th className="px-8 py-5">{t('أيام المأموريات')}</th>
                        <th className="px-8 py-5">{t('الإجازات والتصاريح')}</th>
                        <th className="px-8 py-5">{t('أيام الغياب')}</th>
                      </>
                    )}
                    <th className="px-8 py-5">{t('تقويم العمل')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reportType === 'daily' ? (
                    calculateReport.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-8 py-5 text-sm">
                           <p className="font-black text-foreground">{row.name}</p>
                           <p className="text-[10px] text-muted-foreground font-bold">#{row.employeeId}</p>
                        </td>
                        <td className="px-8 py-5">
                          <span className={cn(
                            "px-3 py-1 rounded-none text-[10px] font-black uppercase tracking-tighter border",
                            row.status === 'Present' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : 
                            row.status === 'Mission' ? "bg-purple-500/10 text-purple-600 border-purple-500/20" :
                            row.status.includes(t('إجازة')) || row.status === t('تصريح') ? "bg-primary/10 text-primary border-primary/20" :
                            row.status === 'Absent' ? "bg-destructive/10 text-destructive border-destructive/20" : 
                            "bg-muted text-muted-foreground border-border"
                          )}>
                            {row.status === 'Present' ? t('حاضر') : 
                             row.status === 'Mission' ? t('مأمورية') :
                             row.status === 'Absent' ? t('غائب') : row.status === 'Off' ? t('خارج العمل') : row.status}
                          </span>
                        </td>
                        <td className="px-8 py-5 font-bold text-muted-foreground">
                          {row.firstIn ? (
                            <div className="flex flex-col">
                              <span className="text-foreground tracking-widest">{formatTime12h(row.firstIn.timestamp, language)}</span>
                              {row.firstIn.note === t('سجل عبر الخدمة الذاتية') && (
                                <span className="text-[9px] text-primary font-black uppercase italic">{t('الخدمة الذاتية')}</span>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-8 py-5 font-bold text-muted-foreground">
                          {row.lastOut ? (
                            <div className="flex flex-col">
                              <span className="text-foreground tracking-widest">{formatTime12h(row.lastOut.timestamp, language)}</span>
                              {row.lastOut.note === t('سجل عبر الخدمة الذاتية') && (
                                <span className="text-[9px] text-primary font-black uppercase italic">{t('الخدمة الذاتية')}</span>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="px-8 py-5">
                           <span className={cn(
                             "font-black text-sm",
                             row.delayMinutes > 0 ? "text-destructive" : "text-emerald-600"
                           )}>
                              {row.delayMinutes > 0 ? `${row.delayMinutes} د` : '0'}
                           </span>
                        </td>
                        <td className="px-8 py-5">
                           <span className={cn(
                             "font-black text-sm",
                             row.overtimeMinutes > 0 ? "text-blue-600 dark:text-blue-400 font-extrabold" : "text-muted-foreground"
                           )}>
                              {row.overtimeMinutes > 0 ? `${(row.overtimeMinutes / 60).toFixed(1)} س (${row.overtimeMinutes} د)` : '0'}
                           </span>
                        </td>
                        <td className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase opacity-70">
                          {row.shiftName}
                        </td>
                      </tr>
                    ))
                  ) : (
                    monthlyReport.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-8 py-5 text-sm">
                           <p className="font-black text-foreground">{row.name}</p>
                           <p className="text-[10px] text-muted-foreground font-bold">#{row.employeeId}</p>
                        </td>
                        <td className="px-8 py-5 font-bold text-foreground">{row.presentDays} يوم</td>
                        <td className="px-8 py-5 font-black text-destructive tracking-widest">{row.totalDelay} دقيقة</td>
                        <td className="px-8 py-5 font-black text-blue-600 dark:text-blue-400 tracking-widest">
                          {row.totalOvertime > 0 ? `${(row.totalOvertime / 60).toFixed(1)} ساعة (${row.totalOvertime} د)` : '0'}
                        </td>
                        <td className="px-8 py-5 font-bold text-purple-600">{row.missionDays} يوم</td>
                        <td className="px-8 py-5 font-bold text-primary">{row.leaveDays} يوم</td>
                        <td className="px-8 py-5 font-bold text-destructive">{row.absentDays} يوم</td>
                        <td className="px-8 py-5 text-[10px] font-black text-muted-foreground uppercase opacity-70">{row.shiftName}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'leave-requests' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-card p-6 rounded-none border border-border shadow-sm transition-colors">
             <div>
               <h3 className="text-xl font-black text-foreground">{t('طلبات الإجازة والتصريح')}</h3>
               <p className="text-sm font-bold text-muted-foreground italic">{t('إدارة طلبات إجازات الموظفين واعتمادها يدوياً')}</p>
             </div>
             <button 
               onClick={() => setIsLeaveRequestModalOpen(true)}
               className="px-6 py-3 bg-primary text-primary-foreground font-black rounded-none hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center gap-2 active:scale-95 text-xs uppercase tracking-widest"
             >
               <Plus className="w-5 h-5" />{t('إنشاء طلب إجازة')}</button>
          </div>

          <div className="bg-card rounded-none shadow-sm border border-border overflow-hidden transition-colors">
            <div className="overflow-x-auto">
               <table className="w-full text-right block md:table border-collapse">
                 <thead className="hidden md:table-header-group">
                   <tr className="bg-muted border-b border-border text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                     <th className="px-8 py-5 text-right">{t('الموظف')}</th>
                     <th className="px-8 py-5 text-right">{t('المدة / التاريخ')}</th>
                     <th className="px-8 py-5 text-right">{t('نوع الإجازة / السبب')}</th>
                     <th className="px-8 py-5 text-right">{t('حالة الطلب')}</th>
                     <th className="px-8 py-5 text-center">{t('الرد')}</th>
                   </tr>
                 </thead>
                 <tbody className="block md:table-row-group divide-y divide-border">
                   {leaveRequests.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(request => {
                     const emp = employees.find(e => e.id === request.employeeId);
                     return (
                       <tr key={request.id} className="block md:table-row hover:bg-muted/30 transition-colors p-4 md:p-0 group">
                         <td className="md:px-8 md:py-5 flex md:table-cell flex-col mb-2 md:mb-0">
                            <span className="md:hidden text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t('الموظف')}</span>
                            <span className="font-black text-foreground">{emp?.name || t('مجهول')}</span>
                         </td>
                         <td className="md:px-8 md:py-5 flex md:table-cell flex-col mb-2 md:mb-0">
                            <span className="md:hidden text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t('المدة')}</span>
                            <span className="font-bold text-muted-foreground tracking-tighter">{request.startDate} - {request.endDate}</span>
                         </td>
                         <td className="md:px-8 md:py-5 flex md:table-cell flex-col mb-2 md:mb-0">
                            <span className="md:hidden text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t('النوع/السبب')}</span>
                            <span className="font-black text-primary bg-primary/10 px-2 py-0.5 rounded-none border border-primary/20 w-fit text-[10px] uppercase tracking-tighter border-primary/20">
                              {request.type === 'Vacation' ? t('إجازة اعتيادية') : 
                               request.type === 'Sick' ? t('إجازة مرضية') : 
                               request.type === 'Unpaid' ? t('بدون مرتب') : 
                               request.type === 'WorkFromHome' ? t('العمل من المنزل') :
                               request.type === 'Permission' ? t('تصريح مغادرة/تأخير') : t('أخرى')}
                            </span>
                            <p className="text-[10px] font-medium text-muted-foreground mt-1 italic">"{request.reason}"</p>
                         </td>
                         <td className="md:px-8 md:py-5 flex md:table-cell flex-col mb-4 md:mb-0">
                            <span className="md:hidden text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">{t('الحالة')}</span>
                            <span className={cn(
                              "px-3 py-1 rounded-none text-[10px] font-black w-fit uppercase tracking-tighter border",
                              request.status === 'Pending' ? "bg-orange-500/10 text-orange-600 border-orange-500/20" :
                              request.status === 'Approved' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                              request.status === 'Postponed' ? "bg-primary/10 text-primary border-primary/20" :
                              "bg-destructive/10 text-destructive border-destructive/20"
                            )}>
                              {request.status === 'Pending' ? t('قيد المراجعة') :
                               request.status === 'Approved' ? t('تمت الموافقة') :
                               request.status === 'Postponed' ? t('تم التأجيل') : t('مرفوض')}
                            </span>
                         </td>
                         <td className="md:px-8 md:py-5 text-center">
                            {request.status === 'Pending' ? (
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => {
                                  const note = prompt('ملاحظة للاعتماد (اختياري):', '');
                                  if (note !== null) handleUpdateLeaveRequestStatus(request.id, 'Approved', note);
                                }} className="p-2 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-none font-black text-[10px] transition uppercase outline-none">{t('موافقة')}</button>
                                <button onClick={() => {
                                  const note = prompt('سبب التأجيل (مطلوب):', '');
                                  if (note) handleUpdateLeaveRequestStatus(request.id, 'Postponed', note);
                                }} className="p-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-none font-black text-[10px] transition uppercase outline-none">{t('تأجيل')}</button>
                                <button onClick={() => {
                                  const note = prompt('سبب الرفض (مطلوب):', '');
                                  if (note) handleUpdateLeaveRequestStatus(request.id, 'Rejected', note);
                                }} className="p-2 bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20 rounded-none font-black text-[10px] transition uppercase outline-none">{t('رفض')}</button>
                              </div>
                            ) : (
                               <div className="text-[10px] font-black text-muted-foreground uppercase opacity-60">
                                 {request.reviewNote ? `"${request.reviewNote}"` : t('بدون ملاحظات')}
                               </div>
                            )}
                         </td>
                       </tr>
                     );
                   })}
                   {leaveRequests.length === 0 && (
                     <tr className="block md:table-row">
                        <td colSpan={5} className="text-center p-12 text-muted-foreground font-black italic block md:table-cell uppercase tracking-widest text-sm">{t('لا توجد طلبات إجازة حالياً.')}</td>
                     </tr>
                   )}
                 </tbody>
               </table>
            </div>
          </div>
        </div>
      )}

       {activeTab === 'absence-records' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-card p-6 rounded-none border border-border shadow-sm transition-colors">
             <div>
               <h3 className="text-xl font-black text-foreground">{t('تسجيل الغيابات')}</h3>
               <p className="text-sm font-bold text-muted-foreground italic">{t('سجل الغيابات المسبقة والأعذار الرسمية')}</p>
             </div>
             <button 
               onClick={() => setIsAbsenceRecordModalOpen(true)}
               className="px-6 py-3 bg-primary text-primary-foreground font-black rounded-none hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 active:scale-95 text-xs uppercase tracking-widest"
             >{t('تسجيل غياب')}</button>
          </div>

          <div className="bg-card rounded-none shadow-sm border border-border overflow-hidden transition-colors">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-muted border-b border-border text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                  <th className="px-8 py-5">{t('الموظف')}</th>
                  <th className="px-8 py-5">{t('التاريخ')}</th>
                  <th className="px-8 py-5">{t('النوع')}</th>
                  <th className="px-8 py-5 text-left">{t('العمليات')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {absenceRecords.sort((a,b) => b.date.localeCompare(a.date)).map((record) => {
                  const emp = employees.find(e => e.id === record.employeeId);
                  const type = absenceTypes.find(t => t.id === record.absenceTypeId);
                  return (
                    <tr key={record.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-8 py-5 font-black text-foreground">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-muted border border-border rounded-none flex items-center justify-center font-black text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                               {emp?.name?.[0]}
                            </div>
                            <span className="font-black text-foreground">{emp?.name}</span>
                         </div>
                      </td>
                      <td className="px-8 py-5 font-bold text-muted-foreground tracking-tighter">{record.date}</td>
                      <td className="px-8 py-5">
                         <span className="px-3 py-1 bg-primary/10 text-primary rounded-none border border-primary/20 text-[10px] font-black uppercase tracking-tighter">
                            {type?.name}
                         </span>
                      </td>
                      <td className="px-8 py-5">
                        <button 
                          onClick={() => setDeleteConfirm({ id: record.id, type: 'absenceRecord', show: true })}
                          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-none border border-transparent hover:border-destructive/20 transition-all outline-none"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sheet-import-export' && (
        <div className="space-y-8">
          {/* Header Card */}
          <div className="bg-card p-6 border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-black">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-foreground">{t('استيراد وتصدير شيت الحضور والانصراف')}</h2>
                <p className="text-xs font-bold text-muted-foreground mt-1">
                  {t('يمكنك رفع ملف Excel / CSV لتسجيل البصمات جماعيًا، أو استخدام المحرر التفاعلي، أو تصدير التقارير جاهزة.')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button 
                onClick={handleDownloadTemplate}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{t('تحميل نموذج الشيت (Template CSV)')}</span>
              </button>
            </div>
          </div>

          {importSuccessMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 font-black text-sm flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>{importSuccessMsg}</span>
              </div>
              <button onClick={() => setImportSuccessMsg(null)} className="text-xs underline cursor-pointer">{t('إغلاق')}</button>
            </motion.div>
          )}

          {/* Grid Layout: Import File vs Live Web Spreadsheet */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Box 1: File Upload & CSV Parsing */}
            <div className="bg-card p-6 border border-border shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <FileUp className="w-5 h-5 text-primary" />
                <h3 className="text-base font-black text-foreground">{t('1. استيراد ملف شيت (CSV / Excel)')}</h3>
              </div>

              {/* Upload Dropzone */}
              <div className="border-2 border-dashed border-border p-8 text-center hover:border-primary/50 transition-colors bg-muted/10 relative group">
                <input 
                  type="file" 
                  accept=".csv,.txt,.xlsx"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-none group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-black text-foreground text-sm">{t('اضغط هنا أو اسحب ملف الشيت لرفعه')}</p>
                    <p className="text-xs text-muted-foreground font-bold mt-1">{t('يدعم صيغ .csv أو ملفات النص ذات التنسيق المجدول')}</p>
                  </div>
                </div>
              </div>

              {/* Uploaded Records Preview Table */}
              {parsedSheetRows.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-muted p-3 border border-border text-xs font-black">
                    <div className="flex items-center gap-3">
                      <span>{t('إجمالي الصفوف:')} <strong className="text-foreground">{parsedSheetRows.length}</strong></span>
                      <span className="text-emerald-600">{t('سليمة:')} <strong>{parsedSheetRows.filter(r => r.isValid).length}</strong></span>
                      <span className="text-destructive">{t('غير صحيحة:')} <strong>{parsedSheetRows.filter(r => !r.isValid).length}</strong></span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setPreviewFilter('all')}
                        className={cn("px-2.5 py-1 text-[10px] font-black cursor-pointer", previewFilter === 'all' ? "bg-card text-primary border border-border" : "text-muted-foreground")}
                      >{t('الكل')}</button>
                      <button 
                        onClick={() => setPreviewFilter('valid')}
                        className={cn("px-2.5 py-1 text-[10px] font-black cursor-pointer", previewFilter === 'valid' ? "bg-card text-emerald-600 border border-border" : "text-muted-foreground")}
                      >{t('السليمة فقط')}</button>
                      <button 
                        onClick={() => setPreviewFilter('invalid')}
                        className={cn("px-2.5 py-1 text-[10px] font-black cursor-pointer", previewFilter === 'invalid' ? "bg-card text-destructive border border-border" : "text-muted-foreground")}
                      >{t('الأخطاء فقط')}</button>
                    </div>
                  </div>

                  {/* Scrollable Preview List */}
                  <div className="max-h-64 overflow-y-auto border border-border">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-muted text-[10px] font-black uppercase text-muted-foreground sticky top-0 border-b border-border">
                        <tr>
                          <th className="p-3">{t('كود الموظف')}</th>
                          <th className="p-3">{t('الموظف')}</th>
                          <th className="p-3">{t('التاريخ')}</th>
                          <th className="p-3">{t('دخول')}</th>
                          <th className="p-3">{t('خروج')}</th>
                          <th className="p-3">{t('الحالة')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {parsedSheetRows
                          .filter(r => previewFilter === 'all' ? true : previewFilter === 'valid' ? r.isValid : !r.isValid)
                          .map((row) => (
                            <tr key={row.id} className={cn("hover:bg-muted/30", !row.isValid && "bg-destructive/5")}>
                              <td className="p-3 font-mono font-bold">{row.employeeIdInput}</td>
                              <td className="p-3 font-bold">{row.employeeNameRef || '-'}</td>
                              <td className="p-3">{row.date}</td>
                              <td className="p-3 font-mono text-emerald-600 font-bold">{row.checkInTime ? formatTime12h(row.checkInTime, language) : '-'}</td>
                              <td className="p-3 font-mono text-orange-600 font-bold">{row.checkOutTime ? formatTime12h(row.checkOutTime, language) : '-'}</td>
                              <td className="p-3">
                                {row.isValid ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {t('جاهز')}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-destructive bg-destructive/10 px-2 py-0.5 border border-destructive/20" title={row.errorReason}>
                                    <AlertCircle className="w-3 h-3" />
                                    {row.errorReason}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={handleExecuteImport}
                    disabled={isImportingSheet || parsedSheetRows.filter(r => r.isValid).length === 0}
                    className="w-full py-3.5 bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all cursor-pointer active:scale-95"
                  >
                    {isImportingSheet ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileCheck className="w-4 h-4" />
                    )}
                    <span>{t('تأكيد واستيراد')} ({parsedSheetRows.filter(r => r.isValid).length}) {t('سجل في النظام')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Box 2: Live Interactive Web Sheet Editor */}
            <div className="bg-card p-6 border border-border shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <Table className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-base font-black text-foreground">{t('2. محرر الشيت التفاعلي المباشر')}</h3>
                </div>
                <button 
                  onClick={handleAddGridRow}
                  className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 font-black text-xs flex items-center gap-1 border border-emerald-500/20 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('إضافة سطر جديد')}</span>
                </button>
              </div>

              <p className="text-xs text-muted-foreground font-bold">
                {t('يمكنك إدخال أو تعديل سجلات الحضور مباشرة في هذا الجدول السريع دون الحاجة لملفات خارجية.')}
              </p>

              <div className="overflow-x-auto border border-border max-h-72">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted text-[10px] font-black uppercase text-muted-foreground sticky top-0 border-b border-border">
                    <tr>
                      <th className="p-3 w-44">{t('الموظف')}</th>
                      <th className="p-3 w-32">{t('التاريخ')}</th>
                      <th className="p-3 w-24">{t('الدخول')}</th>
                      <th className="p-3 w-24">{t('الخروج')}</th>
                      <th className="p-3">{t('ملاحظات')}</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sheetGridRows.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/20">
                        <td className="p-2">
                          <select 
                            value={row.employeeId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSheetGridRows(prev => prev.map(r => r.id === row.id ? { ...r, employeeId: val } : r));
                            }}
                            className="w-full p-2 bg-background border border-border font-bold text-xs outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">{t('-- اختر موظف --')}</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.name} ({emp.employeeId || emp.id})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input 
                            type="date"
                            value={row.date}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSheetGridRows(prev => prev.map(r => r.id === row.id ? { ...r, date: val } : r));
                            }}
                            className="w-full p-2 bg-background border border-border font-bold text-xs outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="time"
                            value={row.checkInTime}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSheetGridRows(prev => prev.map(r => r.id === row.id ? { ...r, checkInTime: val } : r));
                            }}
                            className="w-full p-2 bg-background border border-border font-bold text-xs outline-none focus:ring-1 focus:ring-primary font-mono text-emerald-600"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="time"
                            value={row.checkOutTime}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSheetGridRows(prev => prev.map(r => r.id === row.id ? { ...r, checkOutTime: val } : r));
                            }}
                            className="w-full p-2 bg-background border border-border font-bold text-xs outline-none focus:ring-1 focus:ring-primary font-mono text-orange-600"
                          />
                        </td>
                        <td className="p-2">
                          <input 
                            type="text"
                            placeholder={t('ملاحظة...')}
                            value={row.notes}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSheetGridRows(prev => prev.map(r => r.id === row.id ? { ...r, notes: val } : r));
                            }}
                            className="w-full p-2 bg-background border border-border font-bold text-xs outline-none focus:ring-1 focus:ring-primary"
                          />
                        </td>
                        <td className="p-2 text-center">
                          {sheetGridRows.length > 1 && (
                            <button 
                              onClick={() => handleRemoveGridRow(row.id)}
                              className="text-muted-foreground hover:text-destructive p-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveGridSheet}
                  disabled={isImportingSheet}
                  className="flex-1 py-3 bg-emerald-600 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-md hover:bg-emerald-700 transition-all cursor-pointer active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>{t('حفظ وتوثيق سجلات الشيت التفاعلي')}</span>
                </button>
                <button
                  onClick={handleAddGridRow}
                  className="px-4 py-3 bg-muted border border-border font-black text-xs uppercase tracking-widest hover:bg-muted/80 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>

          {/* Export Section */}
          <div className="bg-card p-6 border border-border shadow-sm space-y-6">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <FileDown className="w-5 h-5 text-blue-600" />
              <h3 className="text-base font-black text-foreground">{t('3. تصدير شيتات الحضور والتقارير (Export)')}</h3>
            </div>

            {/* Filter controls for export */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/30 border border-border">
              <div>
                <label className="text-[10px] font-black text-muted-foreground block mb-1 uppercase tracking-widest">{t('من تاريخ')}</label>
                <input 
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="w-full p-2.5 bg-card border border-border font-bold text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-muted-foreground block mb-1 uppercase tracking-widest">{t('إلى تاريخ')}</label>
                <input 
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="w-full p-2.5 bg-card border border-border font-bold text-xs outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-muted-foreground block mb-1 uppercase tracking-widest">{t('القسم الأدري')}</label>
                <select 
                  value={exportDeptId}
                  onChange={(e) => setExportDeptId(e.target.value)}
                  className="w-full p-2.5 bg-card border border-border font-bold text-xs outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">{t('جميع الأقسام')}</option>
                  {(adminDepartments || []).map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-muted-foreground block mb-1 uppercase tracking-widest">{t('الموظف')}</label>
                <select 
                  value={exportEmpId}
                  onChange={(e) => setExportEmpId(e.target.value)}
                  className="w-full p-2.5 bg-card border border-border font-bold text-xs outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">{t('جميع الموظفين')}</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Option 1: Export Raw Punches */}
              <div className="p-6 border border-border bg-card space-y-3 hover:border-blue-500/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 text-blue-600 flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-foreground text-sm">{t('شيت سجلات الحضور الخام (Raw Punch Log)')}</h4>
                    <p className="text-xs text-muted-foreground font-bold">{t('تصدير كافة حركات الدخول والخروج بالتفصيل')}</p>
                  </div>
                </div>
                <button 
                  onClick={handleExportRawSheet}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('تصدير الشيت الخام (CSV/Excel)')}</span>
                </button>
              </div>

              {/* Option 2: Export Aggregated Report */}
              <div className="p-6 border border-border bg-card space-y-3 hover:border-emerald-500/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <FileBarChart className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-foreground text-sm">{t('تقرير الشيت المجمع (Monthly Summary Sheet)')}</h4>
                    <p className="text-xs text-muted-foreground font-bold">{t('تصدير إحصائيات أيام الحضور والغياب والتأخيرات')}</p>
                  </div>
                </div>
                <button 
                  onClick={handleExportSummarySheet}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  <span>{t('تصدير الشيت المجمع (CSV/Excel)')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'shifts' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <AnimatePresence>
            {attendanceShifts.map((shift) => (
              <motion.div 
                layout
                key={shift.id}
                className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50/30 rounded-full -translate-y-16 translate-x-16 -z-0" />
                
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                      <CalendarDays className="w-6 h-6" />
                    </div>
                    <button 
                      onClick={() => setDeleteConfirm({ id: shift.id, type: 'shift', show: true })}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div>
                     <h3 className="text-lg font-black text-gray-900">{shift.name}</h3>
                     <div className="flex items-center gap-3 mt-2">
                        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-black">
                           {formatTime12h(shift.startTime, language)} - {formatTime12h(shift.endTime, language)}
                        </span>
                        <span className="text-xs font-bold text-gray-400">
                           فترة سماح: {shift.graceMinutes} دقيقة
                        </span>
                     </div>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-4 border-t border-gray-50">
                    {[t('ح'), t('ن'), t('ث'), t('ر'), t('خ'), t('ج'), t('س')].map((day, i) => (
                      <div 
                        key={i}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black transition-all",
                          shift.workDays.includes(i) ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200" : "bg-gray-50 text-gray-300"
                        )}
                      >
                        {day}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}

            <button 
              onClick={() => setIsShiftModalOpen(true)}
              className="border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center py-12 gap-4 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all group p-6"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                 <Plus className="w-8 h-8" />
              </div>
              <p className="font-black">{t('إضافة تقويم عمل جديد')}</p>
            </button>
           </AnimatePresence>
        </div>
      )}

      {activeTab === 'absence-types' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <AnimatePresence>
            {absenceTypes.map((type) => (
              <motion.div 
                layout
                key={type.id}
                className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50/30 rounded-full -translate-y-16 translate-x-16 -z-0" />
                
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                      <Filter className="w-6 h-6" />
                    </div>
                    <button 
                      onClick={() => setDeleteConfirm({ id: type.id, type: 'absenceType', show: true })}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div>
                     <h3 className="text-lg font-black text-gray-900">{type.name}</h3>
                     <p className="text-sm font-bold text-gray-400">نسبة الخصم من اليوم: {type.deductionRatio * 100}%</p>
                  </div>
                </div>
              </motion.div>
            ))}

            <button 
              onClick={() => setIsAbsenceTypeModalOpen(true)}
              className="border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center py-12 gap-4 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all group p-6"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                 <Plus className="w-8 h-8" />
              </div>
              <p className="font-black">{t('إضافة نوع غياب جديد')}</p>
            </button>
           </AnimatePresence>
        </div>
      )}

      {activeTab === 'devices' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           <AnimatePresence>
            {attendanceDevices.map((device) => (
              <motion.div 
                layout
                key={device.id}
                className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm relative group overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/30 rounded-full -translate-y-16 translate-x-16 -z-0" />
                
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <Monitor className="w-6 h-6" />
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
                      device.status === 'Online' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                    )}>
                      {device.status}
                    </div>
                  </div>

                  <div>
                     <h3 className="text-lg font-black text-gray-900">{device.name}</h3>
                     <p className="text-sm font-mono text-gray-400">{device.ipAddress}:{device.port}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                    <div className="text-[10px] font-bold text-gray-400">
                       آخر مزامنة: {device.lastSync ? formatDateTime12h(device.lastSync, { lang: language }) : t('لم تتم بعد')}
                    </div>
                    <button 
                      onClick={() => handleSync(device)}
                      disabled={isSyncing}
                      className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all disabled:opacity-50"
                    >
                      <RefreshCw className={cn("w-5 h-5", isSyncing && "animate-spin")} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}

            <button 
              onClick={() => setIsDeviceModalOpen(true)}
              className="border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center py-12 gap-4 text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-all group p-6"
            >
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                 <Plus className="w-8 h-8" />
              </div>
              <p className="font-black">{t('إضافة جهاز بصمة جديد')}</p>
            </button>
           </AnimatePresence>
        </div>
      )}

      {/* Shift Modal */}
      <AnimatePresence>
        {isShiftModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShiftModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-card text-foreground border border-border w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/30">
                <h3 className="text-2xl font-black text-foreground flex items-center gap-3">
                   <CalendarDays className="w-6 h-6 text-primary" />{t('إعداد جدول دوام')}</h3>
              </div>
              <form onSubmit={handleAddShift} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('اسم الجدول')}</label>
                    <input 
                      required
                      placeholder={t('مثال: الدوام الصباحي')}
                      className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                      value={shiftForm.name}
                      onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-muted-foreground mr-2">{t('وقت الحضور')}</label>
                      <input 
                        type="time"
                        required
                        className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                        value={shiftForm.startTime}
                        onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-muted-foreground mr-2">{t('وقت الانصراف')}</label>
                      <input 
                        type="time"
                        required
                        className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                        value={shiftForm.endTime}
                        onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('فترة السماح (بالدقائق)')}</label>
                    <input 
                      type="number"
                      required
                      className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                      value={shiftForm.graceMinutes || 0}
                      onChange={(e) => setShiftForm({ ...shiftForm, graceMinutes: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('أيام العمل')}</label>
                    <div className="flex flex-wrap gap-2">
                      {[t('أحد'), t('اثنين'), t('ثلاثاء'), t('أربعاء'), t('خميس'), t('جمعة'), t('سبت')].map((day, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            const newDays = shiftForm.workDays.includes(i)
                              ? shiftForm.workDays.filter(d => d !== i)
                              : [...shiftForm.workDays, i];
                            setShiftForm({ ...shiftForm, workDays: newDays });
                          }}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-black transition-all border",
                            shiftForm.workDays.includes(i)
                              ? "bg-primary/10 border-primary text-primary"
                              : "bg-background border-border text-muted-foreground hover:border-muted-foreground/30"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-2xl transition-all hover:bg-primary/95 shadow-sm">{t('حفظ تقويم العمل')}</button>
                  <button type="button" onClick={() => setIsShiftModalOpen(false)} className="flex-1 py-4 bg-muted hover:bg-muted/80 text-foreground border border-border font-black rounded-2xl">{t('إلغاء')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Entry Modal */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManualModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-card text-foreground border border-border w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/30">
                <h3 className="text-2xl font-black text-foreground flex items-center gap-3">
                   <Plus className="w-6 h-6 text-primary" />{t('إضافة سجل يدوي')}</h3>
              </div>
              <form onSubmit={handleAddManualRecord} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('الموظف')}</label>
                    <select
                      required
                      className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                      value={manualForm.employeeId || ''}
                      onChange={(e) => setManualForm({ ...manualForm, employeeId: e.target.value })}
                    >
                      <option value="">{t('اختر الموظف...')}</option>
                      {employees.map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.employeeId})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-muted-foreground mr-2">{t('التاريخ')}</label>
                      <input 
                        type="date"
                        required
                        className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                        value={manualForm.date}
                        onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mr-2">
                        <label className="text-sm font-bold text-muted-foreground">{t('الوقت')}</label>
                        {manualForm.time && (
                          <span className="text-xs font-black text-primary font-mono bg-primary/10 px-2 py-0.5 border border-primary/20">
                            {formatTime12h(manualForm.time, language)}
                          </span>
                        )}
                      </div>
                      <input 
                        type="time"
                        required
                        className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                        value={manualForm.time}
                        onChange={(e) => setManualForm({ ...manualForm, time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('النوع')}</label>
                    <div className="flex gap-4">
                      {(['In', 'Out'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setManualForm({ ...manualForm, type })}
                          className={cn(
                            "flex-1 py-3 rounded-2xl font-black transition-all border",
                            manualForm.type === type 
                              ? (type === 'In' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600" : "bg-orange-500/10 border-orange-500/30 text-orange-600")
                              : "bg-background border-border text-muted-foreground hover:border-muted-foreground/30"
                          )}
                        >
                          {type === 'In' ? t('دخول') : t('خروج')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('ملاحظة')}</label>
                    <textarea 
                      placeholder={t('سبب الإضافة اليدوية...')}
                      className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary resize-none h-24"
                      value={manualForm.note}
                      onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-2xl transition-all hover:bg-primary/95 shadow-sm">{t('إضافة السجل')}</button>
                  <button type="button" onClick={() => setIsManualModalOpen(false)} className="flex-1 py-4 bg-muted hover:bg-muted/80 text-foreground border border-border font-black rounded-2xl">{t('إلغاء')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Absence Record Modal */}
      <AnimatePresence>
        {isAbsenceRecordModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAbsenceRecordModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card text-foreground border border-border w-full max-w-md rounded-[2.5rem] shadow-2xl p-8">
              <h3 className="text-2xl font-black text-foreground mb-6">{t('تسجيل غياب يدوي')}</h3>
              <form onSubmit={handleAddAbsenceRecord} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground mr-2">{t('الموظف')}</label>
                  <select
                    required
                    className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    value={absenceRecordForm.employeeId || ''}
                    onChange={(e) => setAbsenceRecordForm({ ...absenceRecordForm, employeeId: e.target.value })}
                  >
                    <option value="">{t('اختر الموظف...')}</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.employeeId})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground mr-2">{t('التاريخ')}</label>
                  <input 
                    type="date"
                    required
                    className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl focus:ring-2 focus:ring-primary font-medium"
                    value={absenceRecordForm.date}
                    onChange={(e) => setAbsenceRecordForm({ ...absenceRecordForm, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-muted-foreground mr-2">{t('نوع الغياب')}</label>
                  <select
                    required
                    className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                    value={absenceRecordForm.absenceTypeId || ''}
                    onChange={(e) => setAbsenceRecordForm({ ...absenceRecordForm, absenceTypeId: e.target.value })}
                  >
                    <option value="">{t('اختر النوع...')}</option>
                    {absenceTypes.map(t => (
                      <option key={t.id} value={t.id}>{t.name} (خصم {t.deductionRatio * 100}%)</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-2xl hover:bg-primary/95 shadow-sm">{t('حفظ')}</button>
                  <button type="button" onClick={() => setIsAbsenceRecordModalOpen(false)} className="flex-1 py-4 bg-muted hover:bg-muted/80 text-foreground border border-border font-black rounded-2xl">{t('إلغاء')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Device Modal */}
      <AnimatePresence>
        {isDeviceModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeviceModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-card text-foreground border border-border w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/30">
                <h3 className="text-2xl font-black text-foreground flex items-center gap-3">
                   <Settings className="w-6 h-6 text-primary" />{t('إعداد جهاز البصمة')}</h3>
              </div>
              <form onSubmit={handleAddDevice} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('اسم الجهاز')}</label>
                    <input 
                      required
                      placeholder={t('مثال: بصمة الموقع الرئيسي')}
                      className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                      value={deviceForm.name}
                      onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="space-y-2 flex-1">
                      <label className="text-sm font-bold text-muted-foreground mr-2">{t('عنوان IP')}</label>
                      <input 
                        required
                        placeholder="192.168.1.100"
                        className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono"
                        value={deviceForm.ipAddress}
                        onChange={(e) => setDeviceForm({ ...deviceForm, ipAddress: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 w-32">
                      <label className="text-sm font-bold text-muted-foreground mr-2">{t('المنفذ')}</label>
                      <input 
                        type="number"
                        required
                        className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary font-mono"
                        value={deviceForm.port || 0}
                        onChange={(e) => setDeviceForm({ ...deviceForm, port: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-primary/5 rounded-2x border border-primary/10">
                    <p className="text-[10px] text-primary font-bold leading-relaxed">
                      {t('* ملاحظة: يجب أن يدعم الجهاز بروتوكول ZKTeco/TCP وأن يكون المنفذ مفتوحاً في شبكتك المحلية. التطبيق سيحاول الاتصال بهذا العنوان لاستيراد السجلات.')}
                    </p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-2xl transition-all hover:bg-primary/95 shadow-sm">{t('حفظ الجهاز')}</button>
                  <button type="button" onClick={() => setIsDeviceModalOpen(false)} className="flex-1 py-4 bg-muted hover:bg-muted/80 text-foreground border border-border font-black rounded-2xl">{t('إلغاء')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Absence Type Modal */}
      <AnimatePresence>
        {isAbsenceTypeModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAbsenceTypeModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-card text-foreground border border-border w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/30">
                <h3 className="text-2xl font-black text-foreground flex items-center gap-3">
                   <Filter className="w-6 h-6 text-primary" />{t('إعداد نوع غياب')}</h3>
              </div>
              <form onSubmit={handleAddAbsenceType} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('اسم النوع')}</label>
                    <input 
                      required
                      placeholder={t('مثال: غياب بعذر، غياب بدون عذر')}
                      className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                      value={absenceTypeForm.name}
                      onChange={(e) => setAbsenceTypeForm({ ...absenceTypeForm, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('نسبة الخصم (من يوم واحد)')}</label>
                    <select
                      className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                      value={absenceTypeForm.deductionRatio !== undefined && absenceTypeForm.deductionRatio !== null ? absenceTypeForm.deductionRatio : ''}
                      onChange={(e) => setAbsenceTypeForm({ ...absenceTypeForm, deductionRatio: parseFloat(e.target.value) })}
                    >
                      <option value="1">{t('يوم كامل (100%)')}</option>
                      <option value="0.5">{t('نصف يوم (50%)')}</option>
                      <option value="0.25">{t('ربع يوم (25%)')}</option>
                      <option value="0">{t('بدون خصم (0%)')}</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-2xl transition-all hover:bg-primary/95 shadow-sm">{t('حفظ النوع')}</button>
                  <button type="button" onClick={() => setIsAbsenceTypeModalOpen(false)} className="flex-1 py-4 bg-muted hover:bg-muted/80 text-foreground border border-border font-black rounded-2xl">{t('إلغاء')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leave Request Modal */}
      <AnimatePresence>
        {isLeaveRequestModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLeaveRequestModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-card text-foreground border border-border w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-border flex items-center justify-between bg-muted/30">
                <h3 className="text-2xl font-black text-foreground flex items-center gap-3">
                   <Plane className="w-6 h-6 text-primary" />{t('تقديم طلب إجازة / تصريح')}</h3>
              </div>
              <form onSubmit={handleAddLeaveRequest} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('الموظف')}</label>
                    <select
                      required
                      className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                      value={leaveRequestForm.employeeId || ''}
                      onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, employeeId: e.target.value })}
                    >
                      <option value="">{t('اختر الموظف...')}</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <label className="text-sm font-bold text-muted-foreground mr-2">{t('من تاريخ')}</label>
                       <input 
                         type="date"
                         required
                         className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                         value={leaveRequestForm.startDate}
                         onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, startDate: e.target.value })}
                       />
                     </div>
                     <div className="space-y-2">
                       <label className="text-sm font-bold text-muted-foreground mr-2">{t('إلى تاريخ')}</label>
                       <input 
                         type="date"
                         required
                         className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                         value={leaveRequestForm.endDate}
                         onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, endDate: e.target.value })}
                       />
                     </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('نوع الإجازة / التصريح')}</label>
                    <select
                      className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary"
                      value={leaveRequestForm.type || ''}
                      onChange={(e) => {
                        setBalanceAlert(null);
                        setLeaveRequestForm({ ...leaveRequestForm, type: e.target.value });
                      }}
                    >
                      <option value="Vacation">{t('إجازة اعتيادية')}</option>
                      <option value="Sick">{t('إجازة مرضية')}</option>
                      <option value="Unpaid">{t('إجازة بدون مرتب')}</option>
                      <option value="Permission">{t('تصريح مغادرة / تأخير')}</option>
                      <option value="Other">{t('أخرى')}</option>
                    </select>
                  </div>

                  {leaveRequestForm.type === 'Vacation' && selectedEmployeeInfo && (
                    <div className="p-5 bg-card border-2 border-primary/20 rounded-xl text-right text-xs text-foreground space-y-3 font-semibold shadow-inner">
                      <p className="font-black text-sm text-primary border-b border-border pb-1.5">{t('📊 تفاصيل رصيد الإجازة الاعتيادية الذكي:')}</p>
                      
                      <div className="flex justify-between items-center bg-muted/40 p-2.5 border border-border/60">
                        <span className="text-muted-foreground font-bold">{t('1. الرصيد الإجمالي المستحق (من ملف الموظف):')}</span>
                        <span className="font-extrabold text-foreground text-sm">{selectedEmployeeInfo.entitled} يوم</span>
                      </div>

                      <div className="flex justify-between items-center bg-blue-500/5 p-2.5 border border-blue-500/10">
                        <span className="text-blue-700 dark:text-blue-400 font-extrabold">{t('2. الأيام المطلوبة (لهذا الطلب حالياً):')}</span>
                        <span className="font-extrabold text-blue-600 text-sm">{selectedEmployeeInfo.requested} يوم</span>
                      </div>
                      
                      <div className="flex justify-between items-center bg-red-500/5 p-2.5 border border-red-500/10">
                        <span className="text-red-700 dark:text-red-400 font-extrabold">{t('3. الرصيد المستهلك سابقاً (الإجازات المعتمدة):')}</span>
                        <span className="font-extrabold text-red-600 text-sm">{selectedEmployeeInfo.consumed} يوم</span>
                      </div>

                      <div className="flex justify-between items-center bg-emerald-500/10 text-emerald-950 dark:text-emerald-50 p-3 border-2 border-emerald-500/20 rounded-lg">
                        <span className="font-black">{t('4. الرصيد المتاح المتبقي (الصافي بعد الخصم):')}</span>
                        <span className={cn(
                          "text-base font-black px-2 py-0.5 rounded",
                          selectedEmployeeInfo.remaining >= 0 ? "text-emerald-600 font-extrabold" : "text-destructive font-extrabold bg-destructive/10 animate-pulse"
                        )}>
                          {selectedEmployeeInfo.remaining} يوم
                        </span>
                      </div>
                    </div>
                  )}

                  {balanceAlert && (
                    <div className="p-5 bg-red-600 text-white rounded-2xl text-right text-sm space-y-3 font-semibold shadow-md">
                      <div className="flex items-center gap-2 font-black text-white">
                        <XCircle className="w-5 h-5 flex-shrink-0 animate-bounce" />
                        <span>{t('تنبيه: لا يوجد رصيد إجازة سنوية كافٍ لإتمام طلبك!')}</span>
                      </div>
                      <p className="text-xs text-white/90 leading-relaxed">{t('عذراً، الرصيد المتبقي المتاح لك هو')}<span className="font-extrabold underline">{balanceAlert.remaining}</span>{t('يوم فقط، بينما المدة المطلوبة الحالية هي')}<span className="font-extrabold underline">{balanceAlert.requested}</span>{t('يوم.')}</p>
                      <p className="text-xs text-white/90 font-bold">{t('يرجى تغيير نوع الإجازة أو تقليص عدد الأيام ثم إعادة محاولة الإرسال.')}</p>
                      <button 
                        type="button" 
                        onClick={() => setBalanceAlert(null)}
                        className="text-[10px] bg-white text-red-600 px-3 py-1.5 font-black hover:bg-white/90 cursor-pointer border-none"
                      >{t('فهمت، مراجعة وتعديل الطلب')}</button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground mr-2">{t('السبب / الملاحظات')}</label>
                    <textarea 
                      required
                      placeholder={t('اذكر سبب الإجازة أو تفاصيل التصريح...')}
                      className="w-full px-5 py-3 bg-background text-foreground border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary h-24 resize-none"
                      value={leaveRequestForm.reason}
                      onChange={(e) => setLeaveRequestForm({ ...leaveRequestForm, reason: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-2xl transition-all hover:bg-primary/95 shadow-sm">{t('تقديم الطلب')}</button>
                  <button type="button" onClick={() => setIsLeaveRequestModalOpen(false)} className="flex-1 py-4 bg-muted hover:bg-muted/80 text-foreground border border-border font-black rounded-2xl">{t('إلغاء')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ ...deleteConfirm, show: false })}
        onConfirm={async () => {
          if (deleteConfirm.type === 'shift') await handleDeleteShift(deleteConfirm.id);
          else if (deleteConfirm.type === 'absenceRecord') await deleteDoc(doc(db, 'absenceRecords', deleteConfirm.id));
          else if (deleteConfirm.type === 'absenceType') await deleteDoc(doc(db, 'absenceTypes', deleteConfirm.id));
          await refreshData();
          setDeleteConfirm({ ...deleteConfirm, show: false });
        }}
        title={t('تأكيد الحذف')}
        description={t('هل أنت متأكد من حذف هذا السجل؟ لا يمكن التراجع عن هذا الإجراء.')}
      />
    </div>
  );
};
