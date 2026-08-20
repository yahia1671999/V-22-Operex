import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  History as HistoryIcon,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  Printer,
  Copy,
  CheckCircle2,
  Clock3,
  Clock,
  AlertTriangle,
  SkipForward,
  Fingerprint,
  LayoutGrid,
  List,
  Eye,
  FileText,
  BadgeCheck,
  TrendingUp,
  User,
  Settings,
  Plane,
  Home,
  AlertCircle,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Calculator,
  HelpCircle,
  Receipt
} from 'lucide-react';
import { MonthlyAttendanceDetailsModal } from '../attendance/MonthlyAttendanceDetailsModal';
import { db, collection, setDoc, doc, deleteDoc, serverTimestamp, OperationType, handleApiError, writeBatch } from '../../api';
import { useData } from '../../contexts/DataContext';
import { Employee, Transaction } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { calculatePayrollDetails } from '../../lib/payrollUtils';
import { calculateEmployeeMonthlyAttendance } from '../../utils/monthlyAttendanceCalculation';
import { safeEvaluateArithmetic } from '../../utils/safeMath';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { parse, isAfter, isBefore, addMinutes, format } from 'date-fns';
import * as XLSX from 'xlsx';

import { useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDateTime12h } from '../../utils/timeFormatter';

export const Transactions: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { transactions, employees, attendanceRecords, attendanceShifts, missions, missionTypes, leaveRequests, absenceRecords, absenceTypes, administrativeNotices, refreshData, systemSettings, adminDepartments, penalties } = useData();
  const [activeTab, setActiveTab] = useState<'history' | 'processing'>('processing');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPayCard, setSelectedPayCard] = useState<Transaction | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isCopying, setIsCopying] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditTargetTx, setAuditTargetTx] = useState<any | null>(null);
  const [selectedMissionEmp, setSelectedMissionEmp] = useState<Employee | null>(null);
  const [isMissionListModalOpen, setIsMissionListModalOpen] = useState(false);
  const [deductionTypes, setDeductionTypes] = useState<any[]>([]);
  const [financialAdvancesList, setFinancialAdvancesList] = useState<any[]>([]);
  const [activeProfileDeductionDetails, setActiveProfileDeductionDetails] = useState<any[]>([]);
  const [showDeductionsBreakdown, setShowDeductionsBreakdown] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceModalEmployee, setAttendanceModalEmployee] = useState<Employee | null>(null);
  const [attendanceModalMonth, setAttendanceModalMonth] = useState<string>(selectedMonth);
  const [isSyncingApproved, setIsSyncingApproved] = useState(false);

  const handleOpenAttendanceDetails = (emp: Employee, monthStr?: string) => {
    setAttendanceModalEmployee(emp);
    setAttendanceModalMonth(monthStr || selectedMonth);
    setIsAttendanceModalOpen(true);
  };
  const [syncSummaryModal, setSyncSummaryModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    totalCount: number;
    createdCount: number;
    updatedCount: number;
    syncedResults?: any[];
  } | null>(null);

  useEffect(() => {
    const fetchExtraData = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (!token) return;
        const [dRes, aRes] = await Promise.all([
          fetch('/api/deduction-types', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/financial-advances', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        if (dRes.ok) {
          const data = await dRes.json();
          setDeductionTypes(data || []);
        }
        if (aRes.ok) {
          const advData = await aRes.json();
          setFinancialAdvancesList(advData || []);
        }
      } catch (err) {
        console.error("Failed to fetch deduction types or financial advances:", err);
      }
    };
    fetchExtraData();
  }, []);

  // Helper to calculate active profile deductions for an employee
  const calculateProfileDeductionsForEmployee = (emp: any, grossBaseVal: number, basicSalaryVal: number) => {
    let calculatedSocialInsurance = 0;
    let calculatedTax = 0;
    let calculatedOtherDeductions = 0;
    const detailsList: any[] = [];

    const activeDeductionsList = (deductionTypes || []).filter(dt => dt.status === 'Active');

    activeDeductionsList.forEach(dt => {
      const dtCat = String(dt.category || '').toLowerCase().trim();
      const dtNameAr = String(dt.nameAr || '').toLowerCase().trim();
      const dtName = String(dt.name || '').toLowerCase().trim();

      // Check if it's Social Insurance
      const isSocialInsurance = 
        dtCat === 'تأمينات' || 
        dtCat === 'تأمينات اجتماعية' || 
        dtCat === 'social insurance' || 
        dtCat === 'social_insurance' || 
        dtCat === 'insurance' || 
        dtCat === t('تأمينات');

      // Check if it's strictly Labor Income Tax (ضريبة كسب العمل)
      // Must NOT include general 'ضرائب' or 'ضرائب ورسوم أخرى' or substring matching on 'ضريب' / 'tax'
      const isIncomeTax = 
        !isSocialInsurance && (
          dtCat === 'ضريبة كسب العمل' || 
          dtCat === 'كسب العمل' || 
          dtCat === 'ضريبة كسب عمل' || 
          dtCat === 'كسب عمل' || 
          dtCat === 'labor income tax' || 
          dtCat === 'labor_income_tax' || 
          dtCat === 'payroll tax' || 
          dtCat === 'payroll_tax' || 
          dtCat === 'income tax' || 
          dtCat === 'income_tax' || 
          dtCat === t('ضريبة كسب العمل')
        );

      // Check SI (social insurance) eligibility
      if (isSocialInsurance && (emp.subjectToSi === 'No' || emp.subjectToSi === false)) {
        return;
      }
      // Check tax eligibility strictly for Income Tax
      if (isIncomeTax && (emp.subjectToTax === 'No' || emp.subjectToTax === false || emp.taxExempt === 'Yes' || emp.taxExempt === true)) {
        return;
      }

      // Check if this deduction is active for this employee
      let isActiveForEmp = false;
      let activeArray: string[] = [];
      try {
        if (emp.activeDeductions) {
          activeArray = typeof emp.activeDeductions === 'string' ? JSON.parse(emp.activeDeductions) : emp.activeDeductions;
        }
      } catch (e) {}

      if (Array.isArray(activeArray) && activeArray.length > 0) {
        isActiveForEmp = activeArray.includes(dt.id);
      } else {
        // Default to true if no explicit list is configured
        isActiveForEmp = true;
      }

      if (!isActiveForEmp) {
        return;
      }

      // Calculate base value
      let baseValue = 0;
      const isFixed = dt.calculationMethod === t('مبلغ ثابت') || dt.calculationMethod === 'مبلغ ثابت' || dt.calculationMethod === 'Fixed' || dt.calculationMethod === 'fixed';
      const isPercentage = dt.calculationMethod === t('نسبة مئوية') || dt.calculationMethod === 'نسبة مئوية' || dt.calculationMethod === 'Percentage' || dt.calculationMethod === 'percentage';
      const isBrackets = dt.calculationMethod === t('شرائح') || dt.calculationMethod === 'شرائح' || dt.calculationMethod === 'Brackets' || dt.calculationMethod === 'brackets';
      const isEquation = dt.calculationMethod === t('معادلة') || dt.calculationMethod === 'معادلة' || dt.calculationMethod === 'Equation' || dt.calculationMethod === 'equation';

      if (isFixed) {
        baseValue = Number(dt.fixedAmount) || 0;
      } else if (isPercentage) {
        baseValue = grossBaseVal * ((Number(dt.percentage) || 0) / 100);
      } else if (isBrackets) {
        let bracketList: any[] = [];
        try {
          bracketList = typeof dt.brackets === 'string' ? JSON.parse(dt.brackets) : dt.brackets;
        } catch (e) {}
        if (!Array.isArray(bracketList)) bracketList = [];
        
        const matchedBracket = bracketList.find(b => grossBaseVal >= Number(b.from) && grossBaseVal <= Number(b.to));
        if (matchedBracket) {
          baseValue = grossBaseVal * ((Number(matchedBracket.percentage) || 0) / 100);
        } else {
          baseValue = 0;
        }
      } else if (isEquation) {
        let eqStr = (dt.equation || '').toLowerCase();
        eqStr = eqStr.replace(/basic salary/g, String(basicSalaryVal));
        eqStr = eqStr.replace(/allowances/g, String(grossBaseVal - basicSalaryVal));
        eqStr = eqStr.replace(/taxable income/g, String(grossBaseVal));
        const mathVal = safeEvaluateArithmetic(eqStr);
        baseValue = Math.max(0, mathVal);
      }

      // Distribute based on charge type
      let employeeVal = 0;

      const isEmployeeFull = dt.chargeType === t('يتحمله الموظف بالكامل') || dt.chargeType === 'يتحمله الموظف بالكامل' || dt.chargeType === 'Fully paid by employee' || dt.chargeType === 'Employee Full' || dt.chargeType === 'employee';
      const isCompanyFull = dt.chargeType === t('تتمله الشركة بالكامل') || dt.chargeType === t('تتحمله الشركة بالكامل') || dt.chargeType === 'تتمله الشركة بالكامل' || dt.chargeType === 'تتحمله الشركة بالكامل' || dt.chargeType === 'Fully paid by company' || dt.chargeType === 'Company Full' || dt.chargeType === 'company';
      const isShared = dt.chargeType === t('مشاركة بين الموظف والشركة') || dt.chargeType === t('مشاركة') || dt.chargeType === 'مشاركة بين الموظف والشركة' || dt.chargeType === 'مشاركة' || dt.chargeType === 'Shared' || dt.chargeType === 'shared';

      if (isEmployeeFull) {
        employeeVal = baseValue;
      } else if (isCompanyFull) {
        employeeVal = 0;
      } else if (isShared) {
        employeeVal = baseValue * ((Number(dt.employeePercentage) || 100) / 100);
      }

      if (employeeVal > 0) {
        detailsList.push({
          id: dt.id,
          nameAr: dt.nameAr || dt.name,
          category: isIncomeTax 
            ? 'ضريبة كسب العمل' 
            : (isSocialInsurance 
                ? 'تأمينات اجتماعية' 
                : (dtCat === 'ضرائب' || dtCat === 'ضرائب ورسوم أخرى' || dtCat === 'other taxes' || dt.category === t('ضرائب')
                    ? 'ضرائب ورسوم أخرى' 
                    : (dt.category || 'خصومات أخرى'))),
          employeeVal: Number(employeeVal.toFixed(2))
        });
      }

      if (isSocialInsurance) {
        calculatedSocialInsurance += employeeVal;
      } else if (isIncomeTax) {
        // Strictly Labor Income Tax
        calculatedTax += employeeVal;
      } else {
        // All other deductions including Other Taxes & Fees, Union, Fellowship Fund, Miscellaneous
        calculatedOtherDeductions += employeeVal;
      }
    });

    return {
      socialInsurance: Number(calculatedSocialInsurance.toFixed(2)),
      taxValue: Number(calculatedTax.toFixed(2)),
      otherDeductions: Number(calculatedOtherDeductions.toFixed(2)),
      details: detailsList
    };
  };

  // Helper to calculate total financial penalties for employee in target month
  const getApprovedPenaltiesSumForMonth = (employeeId: string, month: string) => {
    if (!penalties) return 0;
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return 0;
    const basic = Number(emp.basicSalary) || 0;

    return penalties
      .filter(p => 
        p.employeeId === employeeId && 
        p.status === 'Approved' && 
        (p.targetMonth === month || (p.penaltyDate && p.penaltyDate.startsWith(month)) || (p.violationDate && p.violationDate.startsWith(month)))
      )
      .reduce((sum, p) => {
        if (p.hasGrievance && p.grievanceStatus === 'Accepted_Cancelled') {
          return sum; // التظلم ألغى الجزاء
        }
        let pType = p.penaltyType;
        let dVal = Number(p.deductionValue) || 0;
        if (p.hasGrievance && p.grievanceStatus === 'Accepted_Modified') {
          pType = p.postGrievancePenaltyType || pType;
          dVal = Number(p.postGrievanceDeductionValue) || dVal;
        }

        if (pType === 'Amount Deduction' || p.deductionType === 'Amount') {
          return sum + dVal;
        } else if (pType === 'Day Deduction' || p.deductionType === 'Days') {
          return sum + Number(((basic / 30) * dVal).toFixed(2));
        }
        return sum;
      }, 0);
  };

  // Helper to generate dynamic draft calculations on-the-fly
  const getDraftTransactionForEmp = useMemo(() => {
    return (emp: any, month: string): any => {
      const empCandidateIds = [emp.id, emp.employeeId, emp.userId, emp.email].filter(Boolean).map(x => String(x).trim().toLowerCase());
      const records = attendanceRecords.filter(r => 
        empCandidateIds.includes(String(r.employeeId || '').trim().toLowerCase()) && 
        r.timestamp && r.timestamp.startsWith(month)
      );

      const shift = attendanceShifts.find(s => s.id === emp.shiftId) || attendanceShifts[0];
      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr) || new Date().getFullYear();
      const monthIndex = (parseInt(monthStr) || (new Date().getMonth() + 1)) - 1;
      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      const now = new Date();

      const isCurrentMonth = (new Date().toISOString().slice(0, 7) === month);

      let shiftWorkDays: number[] = [0, 1, 2, 3, 4];
      if (shift && shift.workDays) {
        try {
          const parsedDays = typeof shift.workDays === 'string' ? JSON.parse(shift.workDays) : shift.workDays;
          if (Array.isArray(parsedDays)) {
            shiftWorkDays = parsedDays.map((d: any) => Number(d));
          }
        } catch (e) {}
      }

      const approvedLeavesList = (leaveRequests || []).filter(l => 
        l.employeeId === emp.id && 
        ((l.status as string) === 'Approved' || (l.status as string) === 'معتمدة' || (l.status as string) === 'مقبولة')
      );

      const isMissionApproved = (status?: string | null) => {
        if (!status) return false;
        const s = status.trim();
        return ['Approved', 'Completed', 'Executed', 'معتمدة', 'مكتملة', 'مكتملة ومُقيّمة', 'منفذة'].includes(s);
      };

      const approvedMissionsList = (missions || []).filter(m => 
        m.employeeId === emp.id && 
        isMissionApproved(m.status)
      );

      let actualWorkDaysCount = 0;
      let presenceDaysCount = 0;
      let missionDaysCount = 0;
      let paidLeaveDaysCount = 0;
      let unpaidLeaveDaysCount = 0;
      let absenceDaysCount = 0;

      let totalDelayMinutes = 0;
      let totalEarlyOutMinutes = 0;
      let totalOvertimeMinutes = 0;

      // Precompute annual leave entitlement & consumed vacation days map for this employee
      const entitledVacationDays = Number(emp.leavePlan || 21);
      const yearStrPrefix = String(year);
      const approvedVacationLeavesInYear = approvedLeavesList
        .filter(l => {
          const isVacationType = l.type === 'Vacation' || l.type === 'Annual' || l.type === t('إجازة اعتيادية') || l.type === t('اعتيادي') || l.type === t('اعتيادية') || l.type === 'اعتيادية' || l.type === 'اعتيادي';
          return isVacationType && (l.startDate.startsWith(yearStrPrefix) || l.endDate.startsWith(yearStrPrefix));
        })
        .sort((a, b) => a.startDate.localeCompare(b.startDate));

      let cumulativeVacationDays = 0;
      const vacationDaysWithBalance = new Set<string>();
      const vacationDaysExceedingBalance = new Set<string>();

      for (const vLeave of approvedVacationLeavesInYear) {
        let curr = new Date(vLeave.startDate);
        const end = new Date(vLeave.endDate);
        while (curr <= end) {
          const cStr = format(curr, 'yyyy-MM-dd');
          if (cStr.startsWith(yearStrPrefix)) {
            cumulativeVacationDays++;
            if (cumulativeVacationDays <= entitledVacationDays) {
              vacationDaysWithBalance.add(cStr);
            } else {
              vacationDaysExceedingBalance.add(cStr);
            }
          }
          curr.setDate(curr.getDate() + 1);
        }
      }

      for (let d = 1; d <= lastDay; d++) {
        const date = new Date(year, monthIndex, d);
        if (isCurrentMonth && date > now) continue;

        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = date.getDay();
        const isWorkDay = shiftWorkDays.includes(dayOfWeek);

        // 1. Check for mission FIRST (priority: not absent, not deducted)
        const mission = approvedMissionsList.find(m => m.startDate <= dateStr && m.endDate >= dateStr);
        if (mission) {
          missionDaysCount++;
          if (isWorkDay) actualWorkDaysCount++;
          continue;
        }

        // 2. Check for leave or work from home
        const leave = approvedLeavesList.find(l => {
          let activeEndDate = l.endDate;
          if (l.returnRequestStatus === 'Approved' && l.actualReturnDate) {
            try {
              const returnDate = new Date(l.actualReturnDate);
              const dayBefore = new Date(returnDate.getTime() - 24 * 60 * 60 * 1000);
              activeEndDate = dayBefore.toISOString().split('T')[0];
            } catch (e) {
              activeEndDate = l.endDate;
            }
          }
          return l.startDate <= dateStr && activeEndDate >= dateStr;
        });

        if (leave) {
          const isUnpaid = leave.type === 'Unpaid' || leave.type === t('دون راتب') || leave.type === t('إجازة غير مدفوعة') || leave.type === 'Unpaid Leave';
          const isWfh = leave.type === 'WorkFromHome' || leave.type === 'WFH' || leave.type === t('العمل من المنزل') || leave.type === 'Work From Home' || leave.type === t('عن بعد');
          const isVacation = leave.type === 'Vacation' || leave.type === 'Annual' || leave.type === t('إجازة اعتيادية') || leave.type === t('اعتيادي') || leave.type === t('اعتيادية') || leave.type === 'اعتيادية' || leave.type === 'اعتيادي';

          if (isWfh) {
            // أيام العمل من المنزل والعمل عن بُعد المعتمدة: يوم عمل فعلي كامل ولا يُحتسب غياباً ولا يخصم من الراتب
            if (isWorkDay) actualWorkDaysCount++;
            
            const dayRecords = records.filter(r => r.timestamp && r.timestamp.startsWith(dateStr));
            const firstIn = dayRecords.find(r => r.type === 'In');
            const lastOut = dayRecords.find(r => r.type === 'Out');

            if (firstIn) {
              presenceDaysCount++;
              if (shift && shift.startTime) {
                try {
                  const shiftStart = parse(shift.startTime, 'HH:mm', new Date(dateStr));
                  const actualIn = new Date(firstIn.timestamp);
                  const graceThreshold = addMinutes(shiftStart, shift.graceMinutes || 0);
                  if (isAfter(actualIn, graceThreshold)) {
                    totalDelayMinutes += Math.max(0, Math.floor((actualIn.getTime() - shiftStart.getTime()) / (1000 * 60)));
                  }
                } catch (err) {}
              }

              if (lastOut && shift && shift.endTime) {
                try {
                  const shiftEnd = parse(shift.endTime, 'HH:mm', new Date(dateStr));
                  const actualOut = new Date(lastOut.timestamp);
                  if (isBefore(actualOut, shiftEnd)) {
                    totalEarlyOutMinutes += Math.max(0, Math.floor((shiftEnd.getTime() - actualOut.getTime()) / (1000 * 60)));
                  } else if (isAfter(actualOut, shiftEnd)) {
                    totalOvertimeMinutes += Math.max(0, Math.floor((actualOut.getTime() - shiftEnd.getTime()) / (1000 * 60)));
                  }
                } catch (err) {}
              }
            }
          } else if (isVacation) {
            // التحقق من كفاية رصيد الإجازات السنوي للاعتيادي
            const hasSufficientBalance = !vacationDaysExceedingBalance.has(dateStr);
            if (hasSufficientBalance) {
              // رصيد كافٍ: مدفوعة بالكامل ولا تخصم من الراتب
              paidLeaveDaysCount++;
              if (isWorkDay) actualWorkDaysCount++;
            } else {
              // تجاوز الرصيد: استقطاع إجازة بدون راتب للأيام الفعلية
              if (isWorkDay) unpaidLeaveDaysCount++;
            }
          } else if (isUnpaid) {
            if (isWorkDay) unpaidLeaveDaysCount++;
          } else {
            // إجازات مدفوعة أخرى (مرضي، زواج، إلخ)
            paidLeaveDaysCount++;
            if (isWorkDay) actualWorkDaysCount++;
          }
          continue;
        }

        // 3. If not a shift work day (weekend / rest day), skip without absence
        if (!isWorkDay) continue;

        // 4. Regular scheduled shift work day: check biometric punches
        const dayRecords = records.filter(r => r.timestamp && r.timestamp.startsWith(dateStr));
        const firstIn = dayRecords.find(r => r.type === 'In');
        const lastOut = dayRecords.find(r => r.type === 'Out');

        const isNotSubjectToAttendance = emp.subjectToAttendance === 'No' || (emp as any).isSubjectToAttendance === false;

        if (firstIn || isNotSubjectToAttendance) {
          presenceDaysCount++;
          actualWorkDaysCount++;

          if (firstIn && shift && shift.startTime) {
            try {
              const shiftStart = parse(shift.startTime, 'HH:mm', new Date(dateStr));
              const actualIn = new Date(firstIn.timestamp);
              const graceThreshold = addMinutes(shiftStart, shift.graceMinutes || 0);
              if (isAfter(actualIn, graceThreshold)) {
                totalDelayMinutes += Math.max(0, Math.floor((actualIn.getTime() - shiftStart.getTime()) / (1000 * 60)));
              }
            } catch (err) {}
          }

          if (lastOut && shift && shift.endTime) {
            try {
              const shiftEnd = parse(shift.endTime, 'HH:mm', new Date(dateStr));
              const actualOut = new Date(lastOut.timestamp);
              if (isBefore(actualOut, shiftEnd)) {
                totalEarlyOutMinutes += Math.max(0, Math.floor((shiftEnd.getTime() - actualOut.getTime()) / (1000 * 60)));
              } else if (isAfter(actualOut, shiftEnd)) {
                totalOvertimeMinutes += Math.max(0, Math.floor((actualOut.getTime() - shiftEnd.getTime()) / (1000 * 60)));
              }
            } catch (err) {}
          }
        } else {
          // No punches and subject to attendance => absence without pay
          absenceDaysCount++;
        }
      }

      const basic = emp.basicSalary || 0;
      const housing = emp.housingAllowance || 0;
      const transport = emp.transportAllowance || 0;
      const subsistence = emp.subsistenceAllowance || 0;
      const otherAllsSum = (emp.otherAllowances || 0) + (emp.mobileAllowance || 0) + (emp.managementAllowance || 0);
      const grossBase = basic + housing + transport + subsistence + otherAllsSum;
      const deductibleSalary = grossBase - housing;

      const hourlyRate = deductibleSalary / 30 / (emp.dailyWorkHours || 8);
      const delayDeduction = (totalDelayMinutes / 60) * hourlyRate;
      const earlyOutDeduction = (totalEarlyOutMinutes / 60) * hourlyRate;
      const totalAttendancePenalty = Number((delayDeduction + earlyOutDeduction).toFixed(2));

      const calculatedOvertimeHours = Number((totalOvertimeMinutes / 60).toFixed(1));
      const overtimeRate = 1.5;
      const calculatedOvertimeValue = Number(((basic / 30 / (emp.dailyWorkHours || 8)) * overtimeRate * calculatedOvertimeHours).toFixed(2));

      const profileDeductions = calculateProfileDeductionsForEmployee(emp, grossBase, basic);
      const calculatedActualWorkDays = Math.max(0, 30 - absenceDaysCount - unpaidLeaveDaysCount);

      const approvedPenaltiesVal = getApprovedPenaltiesSumForMonth(emp.id, month);

      const empLoansVal = (financialAdvancesList || [])
        .filter(a => 
          (a.employeeId === emp.id || a.employee_id === emp.id) &&
          (a.month === month || (a.disbursementDate && a.disbursementDate.startsWith(month))) &&
          (a.status === 'Approved' || a.status === 'Paid' || a.status === 'معتمد' || a.status === 'مدفوع')
        )
        .reduce((sum, a) => sum + (Number(a.installmentAmount || a.amount) || 0), 0);

      const draftTx: any = {
        employeeId: emp.id,
        month: month,
        actualWorkDays: calculatedActualWorkDays,
        basicSalary: Number(emp.basicSalary || 0),
        housingAllowance: Number(emp.housingAllowance || 0),
        transportAllowance: Number(emp.transportAllowance || 0),
        subsistenceAllowance: Number(emp.subsistenceAllowance || 0),
        otherAllowances: Number(emp.otherAllowances || 0),
        mobileAllowance: Number(emp.mobileAllowance || 0),
        managementAllowance: Number(emp.managementAllowance || 0),
        dailyWorkHours: emp.dailyWorkHours || 8,
        absenceDays: absenceDaysCount,
        absenceDeduction: Number((absenceDaysCount * (deductibleSalary / 30)).toFixed(2)),
        unpaidLeaveDays: unpaidLeaveDaysCount,
        unpaidLeaveDeduction: Number((unpaidLeaveDaysCount * (deductibleSalary / 30)).toFixed(2)),
        departureDelayDeduction: totalAttendancePenalty,
        overtimeHours: calculatedOvertimeHours,
        overtimeValue: calculatedOvertimeValue,
        socialInsurance: profileDeductions.socialInsurance,
        taxValue: profileDeductions.taxValue,
        otherDeductions: Number((profileDeductions.otherDeductions + approvedPenaltiesVal).toFixed(2)),
        loans: Number(empLoansVal.toFixed(2)),
        otherIncome: 0,
        salaryReceived: 0,
        bankReceived: 0,
        status: 'Draft',
        notes: `[حساب تلقائي مسودة: حضور=${presenceDaysCount}، غياب=${absenceDaysCount}، مأموريات=${missionDaysCount}، إجازات مدفوعة=${paidLeaveDaysCount}]`
      };

      const totals = calculateTotals(draftTx);
      return {
        ...draftTx,
        ...totals
      };
    };
  }, [employees, attendanceRecords, attendanceShifts, leaveRequests, missions, deductionTypes, penalties, financialAdvancesList]);

  const fetchAuditLogs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const res = await fetch('/api/transactions-audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch transaction audit logs', err);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [transactions]);

  const handleCompleteReview = async (transactionId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      const tx = transactions.find(t => t.id === transactionId);
      if (!tx) return;

      const updatedTx = {
        ...tx,
        status: 'Completed'
      };

      const res = await fetch(`/api/transactions/${transactionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedTx)
      });

      if (res.ok) {
        alert('تمت المراجعة والاعتماد المالي للمؤثرات بنجاح.');
        refreshData();
      } else {
        const errData = await res.json();
        alert('فشل في اعتماد المراجعة: ' + (errData.message || 'خطأ غير معروف'));
      }
    } catch (err: any) {
      alert('فشل في اعتماد المراجعة: ' + err.message);
    }
  };

  const handleAutomateAttendance = () => {
    if (!formData.employeeId || !formData.month) return;
    setIsCalculating(true);
    
    const emp = employees.find(e => e.id === formData.employeeId);
    if (!emp) {
      setIsCalculating(false);
      return;
    }

    const shift = attendanceShifts.find(s => s.id === emp.shiftId) || attendanceShifts[0];
    const month = formData.month;
    
    // Filter attendance records of this employee for this month
    const empCandidateIds = [emp.id, emp.employeeId, emp.userId, emp.email].filter(Boolean).map(x => String(x).trim().toLowerCase());
    const records = attendanceRecords.filter(r => 
      empCandidateIds.includes(String(r.employeeId || '').trim().toLowerCase()) && 
      r.timestamp && r.timestamp.startsWith(month)
    );

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr) || new Date().getFullYear();
    const monthIndex = (parseInt(monthStr) || (new Date().getMonth() + 1)) - 1;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const now = new Date();

    const isCurrentMonth = (new Date().toISOString().slice(0, 7) === month);

    // Get work days set from shift
    let shiftWorkDays: number[] = [0, 1, 2, 3, 4]; // Default Sun-Thu
    if (shift && shift.workDays) {
      try {
        const parsedDays = typeof shift.workDays === 'string' ? JSON.parse(shift.workDays) : shift.workDays;
        if (Array.isArray(parsedDays)) {
          shiftWorkDays = parsedDays.map((d: any) => Number(d));
        }
      } catch (e) {
        console.error("Failed to parse shift.workDays", e);
      }
    }

    // Approved leaves list
    const approvedLeavesList = (leaveRequests || []).filter(l => 
      l.employeeId === emp.id && 
      ((l.status as string) === 'Approved' || (l.status as string) === 'معتمدة' || (l.status as string) === 'مقبولة')
    );

    const isMissionApproved = (status?: string | null) => {
      if (!status) return false;
      const s = status.trim();
      return ['Approved', 'Completed', 'Executed', 'معتمدة', 'مكتملة', 'مكتملة ومُقيّمة', 'منفذة'].includes(s);
    };

    // Approved missions list
    const approvedMissionsList = (missions || []).filter(m => 
      m.employeeId === emp.id && 
      isMissionApproved(m.status)
    );

    let actualWorkDaysCount = 0; // Days of shift in month (excluding weekend/holiday)
    let presenceDaysCount = 0;
    let missionDaysCount = 0;
    let paidLeaveDaysCount = 0;
    let unpaidLeaveDaysCount = 0;
    let absenceDaysCount = 0;

    let totalDelayMinutes = 0;
    let totalEarlyOutMinutes = 0;
    let totalOvertimeMinutes = 0;

    // Precompute annual leave entitlement & consumed vacation days map for this employee
    const entitledVacationDays = Number(emp.leavePlan || 21);
    const yearStrPrefix = String(year);
    const approvedVacationLeavesInYear = approvedLeavesList
      .filter(l => {
        const isVacationType = l.type === 'Vacation' || l.type === 'Annual' || l.type === t('إجازة اعتيادية') || l.type === t('اعتيادي') || l.type === t('اعتيادية') || l.type === 'اعتيادية' || l.type === 'اعتيادي';
        return isVacationType && (l.startDate.startsWith(yearStrPrefix) || l.endDate.startsWith(yearStrPrefix));
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate));

    let cumulativeVacationDays = 0;
    const vacationDaysWithBalance = new Set<string>();
    const vacationDaysExceedingBalance = new Set<string>();

    for (const vLeave of approvedVacationLeavesInYear) {
      let curr = new Date(vLeave.startDate);
      const end = new Date(vLeave.endDate);
      while (curr <= end) {
        const cStr = format(curr, 'yyyy-MM-dd');
        if (cStr.startsWith(yearStrPrefix)) {
          cumulativeVacationDays++;
          if (cumulativeVacationDays <= entitledVacationDays) {
            vacationDaysWithBalance.add(cStr);
          } else {
            vacationDaysExceedingBalance.add(cStr);
          }
        }
        curr.setDate(curr.getDate() + 1);
      }
    }

    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, monthIndex, d);
      // Skip future days if current month
      if (isCurrentMonth && date > now) continue;

      const dateStr = format(date, 'yyyy-MM-dd');
      const dayOfWeek = date.getDay(); // JS getDay: 0 is Sunday, ..., 6 is Saturday
      const isWorkDay = shiftWorkDays.includes(dayOfWeek);

      // 1. Check for approved mission covering this day FIRST (priority)
      const mission = approvedMissionsList.find(m => m.startDate <= dateStr && m.endDate >= dateStr);
      if (mission) {
        missionDaysCount++;
        if (isWorkDay) actualWorkDaysCount++;
        continue; // Covered by mission: not absent, not deducted
      }

      // 2. Check for approved leave covering this day
      const leave = approvedLeavesList.find(l => {
        let activeEndDate = l.endDate;
        if (l.returnRequestStatus === 'Approved' && l.actualReturnDate) {
          try {
            const returnDate = new Date(l.actualReturnDate);
            const dayBefore = new Date(returnDate.getTime() - 24 * 60 * 60 * 1000);
            activeEndDate = dayBefore.toISOString().split('T')[0];
          } catch (e) {
            activeEndDate = l.endDate;
          }
        }
        return l.startDate <= dateStr && activeEndDate >= dateStr;
      });

      if (leave) {
        const isUnpaid = leave.type === 'Unpaid' || leave.type === t('دون راتب') || leave.type === t('إجازة غير مدفوعة') || leave.type === 'Unpaid Leave';
        const isWfh = leave.type === 'WorkFromHome' || leave.type === 'WFH' || leave.type === t('العمل من المنزل') || leave.type === 'Work From Home' || leave.type === t('عن بعد');
        const isVacation = leave.type === 'Vacation' || leave.type === 'Annual' || leave.type === t('إجازة اعتيادية') || leave.type === t('اعتيادي') || leave.type === t('اعتيادية') || leave.type === 'اعتيادية' || leave.type === 'اعتيادي';

        if (isWfh) {
          // أيام العمل من المنزل والعمل عن بُعد المعتمدة: يوم عمل فعلي كامل ولا يُحتسب غياباً ولا يخصم من الراتب
          if (isWorkDay) actualWorkDaysCount++;

          const dayRecords = records.filter(r => r.timestamp && r.timestamp.startsWith(dateStr));
          const firstIn = dayRecords.find(r => r.type === 'In');
          const lastOut = dayRecords.find(r => r.type === 'Out');

          if (firstIn) {
            presenceDaysCount++;
            if (shift && shift.startTime) {
              try {
                const shiftStart = parse(shift.startTime, 'HH:mm', new Date(dateStr));
                const actualIn = new Date(firstIn.timestamp);
                const graceThreshold = addMinutes(shiftStart, shift.graceMinutes || 0);
                if (isAfter(actualIn, graceThreshold)) {
                  totalDelayMinutes += Math.max(0, Math.floor((actualIn.getTime() - shiftStart.getTime()) / (1000 * 60)));
                }
              } catch (err) {}
            }

            if (lastOut && shift && shift.endTime) {
              try {
                const shiftEnd = parse(shift.endTime, 'HH:mm', new Date(dateStr));
                const actualOut = new Date(lastOut.timestamp);
                if (isBefore(actualOut, shiftEnd)) {
                  totalEarlyOutMinutes += Math.max(0, Math.floor((shiftEnd.getTime() - actualOut.getTime()) / (1000 * 60)));
                } else if (isAfter(actualOut, shiftEnd)) {
                  totalOvertimeMinutes += Math.max(0, Math.floor((actualOut.getTime() - shiftEnd.getTime()) / (1000 * 60)));
                }
              } catch (err) {}
            }
          }
        } else if (isVacation) {
          // التحقق من كفاية رصيد الإجازات السنوي للاعتيادي
          const hasSufficientBalance = !vacationDaysExceedingBalance.has(dateStr);
          if (hasSufficientBalance) {
            // رصيد كافٍ: مدفوعة بالكامل ولا تخصم من الراتب
            paidLeaveDaysCount++;
            if (isWorkDay) actualWorkDaysCount++;
          } else {
            // تجاوز الرصيد: استقطاع إجازة بدون راتب للأيام الفعلية
            if (isWorkDay) unpaidLeaveDaysCount++;
          }
        } else if (isUnpaid) {
          if (isWorkDay) unpaidLeaveDaysCount++;
        } else {
          // إجازات مدفوعة أخرى (مرضي، زواج، إلخ)
          paidLeaveDaysCount++;
          if (isWorkDay) actualWorkDaysCount++;
        }
        continue; // Covered by leave: proceed to next day
      }

      // 3. If not a shift work day (weekend / rest day), skip without absence
      if (!isWorkDay) continue;

      // 4. Regular scheduled shift work day: check biometric punches
      const dayRecords = records.filter(r => r.timestamp && r.timestamp.startsWith(dateStr));
      const firstIn = dayRecords.find(r => r.type === 'In');
      const lastOut = dayRecords.find(r => r.type === 'Out');

      const isNotSubjectToAttendance = emp.subjectToAttendance === 'No' || (emp as any).isSubjectToAttendance === false;

      if (firstIn || isNotSubjectToAttendance) {
        presenceDaysCount++;
        actualWorkDaysCount++;

        if (firstIn && shift && shift.startTime) {
          try {
            const shiftStart = parse(shift.startTime, 'HH:mm', new Date(dateStr));
            const actualIn = new Date(firstIn.timestamp);
            const graceThreshold = addMinutes(shiftStart, shift.graceMinutes || 0);
            if (isAfter(actualIn, graceThreshold)) {
              totalDelayMinutes += Math.max(0, Math.floor((actualIn.getTime() - shiftStart.getTime()) / (1000 * 60)));
            }
          } catch (err) {
            console.error("Error calculating delay in automate:", err);
          }
        }

        if (lastOut && shift && shift.endTime) {
          try {
            const shiftEnd = parse(shift.endTime, 'HH:mm', new Date(dateStr));
            const actualOut = new Date(lastOut.timestamp);
            if (isBefore(actualOut, shiftEnd)) {
              totalEarlyOutMinutes += Math.max(0, Math.floor((shiftEnd.getTime() - actualOut.getTime()) / (1000 * 60)));
            } else if (isAfter(actualOut, shiftEnd)) {
              totalOvertimeMinutes += Math.max(0, Math.floor((actualOut.getTime() - shiftEnd.getTime()) / (1000 * 60)));
            }
          } catch (err) {
            console.error("Error calculating early departure in automate:", err);
          }
        }
      } else {
        // No attendance and subject to attendance => Absence
        absenceDaysCount++;
      }
    }

    // Now calculate deductions based on rules
    const basic = emp.basicSalary || 0;
    const housing = emp.housingAllowance || 0;
    const transport = emp.transportAllowance || 0;
    const subsistence = emp.subsistenceAllowance || 0;
    const otherAllsSum = (emp.otherAllowances || 0) + (emp.mobileAllowance || 0) + (emp.managementAllowance || 0);
    const grossBase = basic + housing + transport + subsistence + otherAllsSum;
    const deductibleSalary = grossBase - housing;

    // قيمه الساعه = الراتب الخاضع للخصم / 30 / عدد ساعات العمل اليومية
    const hourlyRate = deductibleSalary / 30 / (emp.dailyWorkHours || 8);
    const delayDeduction = (totalDelayMinutes / 60) * hourlyRate;
    const earlyOutDeduction = (totalEarlyOutMinutes / 60) * hourlyRate;
    const totalAttendancePenalty = Number((delayDeduction + earlyOutDeduction).toFixed(2));

    const calculatedOvertimeHours = Number((totalOvertimeMinutes / 60).toFixed(1));
    const overtimeRate = 1.5;
    const calculatedOvertimeValue = Number(((basic / 30 / (emp.dailyWorkHours || 8)) * overtimeRate * calculatedOvertimeHours).toFixed(2));

    const profileDeductions = calculateProfileDeductionsForEmployee(emp, grossBase, basic);

    const calculatedActualWorkDays = Math.max(0, 30 - absenceDaysCount - unpaidLeaveDaysCount);

    const approvedPenaltiesVal = getApprovedPenaltiesSumForMonth(emp.id, month);

    const empLoansVal = (financialAdvancesList || [])
      .filter(a => 
        (a.employeeId === emp.id || a.employee_id === emp.id) &&
        (a.month === month || (a.disbursementDate && a.disbursementDate.startsWith(month))) &&
        (a.status === 'Approved' || a.status === 'Paid' || a.status === 'معتمد' || a.status === 'مدفوع')
      )
      .reduce((sum, a) => sum + (Number(a.installmentAmount || a.amount) || 0), 0);

    const newFormData = {
      ...formData,
      basicSalary: Number(emp.basicSalary || 0),
      housingAllowance: Number(emp.housingAllowance || 0),
      transportAllowance: Number(emp.transportAllowance || 0),
      subsistenceAllowance: Number(emp.subsistenceAllowance || 0),
      otherAllowances: Number(emp.otherAllowances || 0),
      mobileAllowance: Number(emp.mobileAllowance || 0),
      managementAllowance: Number(emp.managementAllowance || 0),
      dailyWorkHours: emp.dailyWorkHours || 8,
      actualWorkDays: calculatedActualWorkDays,
      absenceDays: absenceDaysCount,
      absenceDeduction: Number((absenceDaysCount * (deductibleSalary / 30)).toFixed(2)),
      unpaidLeaveDays: unpaidLeaveDaysCount,
      unpaidLeaveDeduction: Number((unpaidLeaveDaysCount * (deductibleSalary / 30)).toFixed(2)),
      departureDelayDeduction: totalAttendancePenalty,
      overtimeHours: calculatedOvertimeHours,
      overtimeValue: calculatedOvertimeValue,
      socialInsurance: profileDeductions.socialInsurance,
      taxValue: profileDeductions.taxValue,
      otherDeductions: Number((profileDeductions.otherDeductions + approvedPenaltiesVal).toFixed(2)),
      loans: Number(empLoansVal.toFixed(2)),
      notes: `${formData.notes || ''}\n[حساب تلقائي: حضور=${presenceDaysCount}، مأمورية=${missionDaysCount}، إجازة مدفوعة=${paidLeaveDaysCount}، إجازة غير مدفوعة=${unpaidLeaveDaysCount}، غياب=${absenceDaysCount}، إضافي=${calculatedOvertimeHours}ساعة، تأخير=${totalDelayMinutes}دقيقة، خروج مبكر=${totalEarlyOutMinutes}دقيقة]`.trim()
    };

    const totals = calculateTotals(newFormData as any);

    setFormData({
      ...newFormData,
      ...totals
    });
    
    setIsCalculating(false);
    alert('تم جلب بيانات الحضور والغياب والإجازات والمأموريات بنجاح وإعادة احتساب الاستقطاعات.');
  };

  // Form State
  const [formData, setFormData] = useState<Omit<Transaction, 'id' | 'createdAt'>>({
    employeeId: '',
    month: new Date().toISOString().slice(0, 7),
    actualWorkDays: 30,
    basicSalary: 0,
    housingAllowance: 0,
    transportAllowance: 0,
    subsistenceAllowance: 0,
    otherAllowances: 0,
    mobileAllowance: 0,
    managementAllowance: 0,
    otherIncome: 0,
    overtimeHours: 0,
    overtimeValue: 0,
    totalIncome: 0,
    socialInsurance: 0,
    salaryReceived: 0,
    loans: 0,
    bankReceived: 0,
    taxValue: 0,
    otherDeductions: 0,
    deductionHours: 0,
    departureDelayDeduction: 0,
    absenceDays: 0,
    absenceDeduction: 0,
    unpaidLeaveDays: 0,
    unpaidLeaveDeduction: 0,
    totalDeductions: 0,
    netSalary: 0,
    status: 'Draft',
    salaryIncrease: 0,
    dailyWorkHours: 8,
    notes: ''
  });

  const handleEmployeeChange = (empId: string) => {
    const emp = employees.find(e => e.id === empId);
    if (emp) {
      const month = selectedMonth;

      // 1. Calculate Attendance based on employee schedule (workDays)
      const records = attendanceRecords.filter(r => 
        r.employeeId === emp.id && 
        r.timestamp && r.timestamp.startsWith(month)
      );

      const shift = attendanceShifts.find(s => s.id === emp.shiftId) || attendanceShifts[0];
      let derivedAbsenceDays = 0;
      let derivedUnpaidLeaveDays = 0;

      const approvedLeavesList = (leaveRequests || []).filter(l => 
        l.employeeId === emp.id && 
        l.status === 'Approved'
      );

      const daysInMonthSet = records.reduce((acc, r) => {
        if (r.timestamp) {
          const d = r.timestamp.substring(0, 10);
          acc.add(d);
        }
        return acc;
      }, new Set<string>());

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr) || new Date().getFullYear();
      const monthIndex = (parseInt(monthStr) || (new Date().getMonth() + 1)) - 1;
      const lastDay = new Date(year, monthIndex + 1, 0).getDate();
      const now = new Date();

      let shiftWorkDays: number[] = [0, 1, 2, 3, 4];
      if (shift && shift.workDays) {
        try {
          const parsedDays = typeof shift.workDays === 'string' ? JSON.parse(shift.workDays) : shift.workDays;
          if (Array.isArray(parsedDays)) {
            shiftWorkDays = parsedDays.map((d: any) => Number(d));
          }
        } catch (e) {}
      }

      // Precompute annual leave entitlement & consumed vacation days map for this employee
      const entitledVacationDays = Number(emp.leavePlan || 21);
      const yearStrPrefix = String(year);
      const approvedVacationLeavesInYear = approvedLeavesList
        .filter(l => {
          const isVacationType = l.type === 'Vacation' || l.type === 'Annual' || l.type === t('إجازة اعتيادية') || l.type === t('اعتيادي') || l.type === t('اعتيادية') || l.type === 'اعتيادية' || l.type === 'اعتيادي';
          return isVacationType && (l.startDate.startsWith(yearStrPrefix) || l.endDate.startsWith(yearStrPrefix));
        })
        .sort((a, b) => a.startDate.localeCompare(b.startDate));

      let cumulativeVacationDays = 0;
      const vacationDaysExceedingBalance = new Set<string>();

      for (const vLeave of approvedVacationLeavesInYear) {
        let curr = new Date(vLeave.startDate);
        const end = new Date(vLeave.endDate);
        while (curr <= end) {
          const cStr = format(curr, 'yyyy-MM-dd');
          if (cStr.startsWith(yearStrPrefix)) {
            cumulativeVacationDays++;
            if (cumulativeVacationDays > entitledVacationDays) {
              vacationDaysExceedingBalance.add(cStr);
            }
          }
          curr.setDate(curr.getDate() + 1);
        }
      }

      for (let d = 1; d <= lastDay; d++) {
        const date = new Date(year, monthIndex, d);
        if (date > now) continue;
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayOfWeek = date.getDay();

        // Check for approved mission covering this day FIRST
        const isMission = (missions || []).some(m => 
          m.employeeId === emp.id && 
          m.status === 'Approved' && 
          dateStr >= m.startDate && 
          dateStr <= m.endDate
        );
        if (isMission) {
          continue;
        }

        // Check for approved leave or work from home covering this day
        const leave = approvedLeavesList.find(l => {
          let activeEndDate = l.endDate;
          if (l.returnRequestStatus === 'Approved' && l.actualReturnDate) {
            try {
              const returnDate = new Date(l.actualReturnDate);
              const dayBefore = new Date(returnDate.getTime() - 24 * 60 * 60 * 1000);
              activeEndDate = dayBefore.toISOString().split('T')[0];
            } catch (e) {
              activeEndDate = l.endDate;
            }
          }
          return l.startDate <= dateStr && activeEndDate >= dateStr;
        });

        if (leave) {
          const isUnpaid = leave.type === 'Unpaid' || leave.type === t('دون راتب') || leave.type === t('إجازة غير مدفوعة') || leave.type === 'Unpaid Leave';
          const isWfh = leave.type === 'WorkFromHome' || leave.type === 'WFH' || leave.type === t('العمل من المنزل') || leave.type === 'Work From Home';
          const isVacation = leave.type === 'Vacation' || leave.type === 'Annual' || leave.type === t('إجازة اعتيادية') || leave.type === t('اعتيادي') || leave.type === t('اعتيادية') || leave.type === 'اعتيادية' || leave.type === 'اعتيادي';

          if (isVacation) {
            if (vacationDaysExceedingBalance.has(dateStr)) {
              // تجاوز الرصيد المتاح: يُطبق الاستقطاع طبقاً للقواعد الحالية
              derivedUnpaidLeaveDays++;
            }
            // إذا كان الرصيد كافياً: لا يُحتسب غياباً ولا يخصم من الراتب ويخصم فقط من رصيد الإجازات
          } else if (isUnpaid) {
            derivedUnpaidLeaveDays++;
          } else if (isWfh) {
            // العمل من المنزل / العمل عن بعد المعتمد: يوم عمل فعلي كامل ولا يُحتسب غياباً ولا يخصم من الراتب
          }
          continue;
        }

        const isWorkDay = shiftWorkDays.includes(dayOfWeek);
        if (isWorkDay) {
          if (!daysInMonthSet.has(dateStr)) {
            derivedAbsenceDays++;
          }
        }
      }

      // Calc Delay
      let totalDelayMinutes = 0;
      const grouped = records.reduce((acc, r) => {
        if (r.timestamp) {
          const d = r.timestamp.substring(0, 10);
          if (!acc[d]) acc[d] = [];
          acc[d].push(r);
        }
        return acc;
      }, {} as Record<string, typeof records>);

      Object.entries(grouped).forEach(([day, dayRecords]) => {
        const firstIn = dayRecords.find(r => r.type === 'In');
        if (firstIn && shift) {
          try {
            const shiftStart = parse(shift.startTime, 'HH:mm', new Date(day));
            const actualIn = new Date(firstIn.timestamp);
            const graceThreshold = addMinutes(shiftStart, shift.graceMinutes);
            if (isAfter(actualIn, graceThreshold)) {
              totalDelayMinutes += Math.floor((actualIn.getTime() - shiftStart.getTime()) / (1000 * 60));
            }
          } catch (err) {
            console.error(err);
          }
        }
      });

      const basic = emp.basicSalary || 0;
      const hourlyRate = basic / (30 * (emp.dailyWorkHours || 8));
      const delayDeduction = (totalDelayMinutes / 60) * hourlyRate;

      // 2. Fetch approved missions & allowances for this employee in the selected month
      const userMissions = (missions || []).filter(m => 
        m.employeeId === emp.id && 
        m.status === 'Approved' && 
        (m.startDate.startsWith(month) || m.endDate.startsWith(month))
      );

      let totalMissionsAllowance = 0;
      userMissions.forEach(m => {
        try {
          const start = new Date(m.startDate);
          const end = new Date(m.endDate);
          const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);

          const rawAllowances = m.allowances;
          const allowances = Array.isArray(rawAllowances) 
            ? rawAllowances 
            : (typeof rawAllowances === 'string' ? JSON.parse(rawAllowances) : []);
          
          allowances.forEach((allowance: any) => {
            const amt = Number(allowance.amount) || 0;
            if (allowance.type === 'Daily') {
              totalMissionsAllowance += amt * diffDays;
            } else {
              totalMissionsAllowance += amt;
            }
          });
        } catch (err) {
          console.error(err);
        }
      });

      const basicSalaryVal = emp.basicSalary || 0;
      const housingAllowanceVal = emp.housingAllowance || 0;
      const otherAlls = (emp.transportAllowance || 0) + (emp.subsistenceAllowance || 0) + (emp.otherAllowances || 0) + (emp.mobileAllowance || 0) + (emp.managementAllowance || 0);
      const grossBaseVal = basicSalaryVal + housingAllowanceVal + otherAlls;
      const profileDeductions = calculateProfileDeductionsForEmployee(emp, grossBaseVal, basicSalaryVal);
      setActiveProfileDeductionDetails(profileDeductions.details || []);

      const initialActualWorkDays = Math.max(0, 30 - derivedAbsenceDays - derivedUnpaidLeaveDays);
      const proRate = (val: number) => Number(((val / 30) * initialActualWorkDays).toFixed(2));

      const approvedPenaltiesVal = getApprovedPenaltiesSumForMonth(emp.id, month);

      setFormData({
        ...formData,
        employeeId: empId,
        month: month,
        actualWorkDays: initialActualWorkDays,
        basicSalary: proRate(emp.basicSalary || 0),
        housingAllowance: proRate(emp.housingAllowance || 0),
        transportAllowance: proRate(emp.transportAllowance || 0),
        subsistenceAllowance: proRate(emp.subsistenceAllowance || 0),
        otherAllowances: proRate(emp.otherAllowances || 0),
        mobileAllowance: proRate(emp.mobileAllowance || 0),
        managementAllowance: proRate(emp.managementAllowance || 0),
        dailyWorkHours: emp.dailyWorkHours || 8,
        absenceDays: derivedAbsenceDays,
        unpaidLeaveDays: derivedUnpaidLeaveDays,
        departureDelayDeduction: Number(delayDeduction.toFixed(2)),
        socialInsurance: profileDeductions.socialInsurance,
        taxValue: profileDeductions.taxValue,
        otherDeductions: Number((profileDeductions.otherDeductions + approvedPenaltiesVal).toFixed(2)),
        otherIncome: 0, // يتم صرف بدلات المأموريات بشكل منفصل في الموديول المستقل ولا تدمج مع الراتب
      });
    } else {
      setFormData({ ...formData, employeeId: empId });
    }
  };

  // Re-run calculations and pro-rating if key inputs change
  useEffect(() => {
    if (!formData.employeeId) {
      setActiveProfileDeductionDetails([]);
      return;
    }
    const emp = employees.find(e => e.id === formData.employeeId);
    if (!emp) return;

    const updatedActualWorkDays = Math.max(0, 30 - (formData.absenceDays || 0) - (formData.unpaidLeaveDays || 0));
    const proRateDays = Math.min(30, updatedActualWorkDays + (formData.absenceDays || 0) + (formData.unpaidLeaveDays || 0));
    const proRate = (val: number) => Number(((val / 30) * proRateDays).toFixed(2));

    const updatedBase = {
      basicSalary: proRate(emp.basicSalary || 0),
      housingAllowance: proRate(emp.housingAllowance || 0),
      transportAllowance: proRate(emp.transportAllowance || 0),
      subsistenceAllowance: proRate(emp.subsistenceAllowance || 0),
      otherAllowances: proRate(emp.otherAllowances || 0),
      mobileAllowance: proRate(emp.mobileAllowance || 0),
      managementAllowance: proRate(emp.managementAllowance || 0),
    };

    // Calculate dynamic profile deductions automatically
    const grossBaseVal = (emp.basicSalary || 0) + (emp.housingAllowance || 0) + (emp.transportAllowance || 0) + (emp.subsistenceAllowance || 0) + (emp.otherAllowances || 0) + (emp.mobileAllowance || 0) + (emp.managementAllowance || 0);
    const profileDeductions = calculateProfileDeductionsForEmployee(emp, grossBaseVal, emp.basicSalary || 0);
    setActiveProfileDeductionDetails(profileDeductions.details || []);

    // Requirement 1, 2, 5: Centralized calculation of absence and overtime
    // Requirement: Overtime calculation must use original basic salary from employee profile
    const details = calculatePayrollDetails({ 
      ...formData, 
      ...updatedBase,
      overtimeBaseSalary: emp.basicSalary 
    });

    setFormData(prev => {
      const approvedPenaltiesVal = getApprovedPenaltiesSumForMonth(emp.id, formData.month);
      const isNew = !(prev as any).id && !(formData as any).id;
      const isEmpOrMonthChanged = isNew && (prev.employeeId !== formData.employeeId || prev.month !== formData.month);

      return {
        ...prev,
        ...updatedBase,
        actualWorkDays: updatedActualWorkDays,
        overtimeValue: details.overtimeValue,
        absenceDeduction: details.absenceDeduction,
        unpaidLeaveDeduction: details.unpaidLeaveDeduction,
        socialInsurance: (isEmpOrMonthChanged || prev.socialInsurance === undefined || prev.socialInsurance === null) ? profileDeductions.socialInsurance : prev.socialInsurance,
        taxValue: (isEmpOrMonthChanged || prev.taxValue === undefined || prev.taxValue === null) ? profileDeductions.taxValue : prev.taxValue,
        otherDeductions: (isEmpOrMonthChanged || prev.otherDeductions === undefined || prev.otherDeductions === null) 
          ? Number((profileDeductions.otherDeductions + approvedPenaltiesVal).toFixed(2)) 
          : prev.otherDeductions,
      };
    });
  }, [formData.actualWorkDays, formData.overtimeHours, formData.absenceDays, formData.unpaidLeaveDays, formData.dailyWorkHours, formData.employeeId, formData.month, deductionTypes, penalties]);

  const calculateTotals = (data: typeof formData) => {
    const emp = employees.find(e => e.id === data.employeeId);
    // Requirement: Ensure overtime calculation always uses the contract basic salary from the employee profile
    const details = calculatePayrollDetails({
      ...data,
      overtimeBaseSalary: emp?.basicSalary
    });
    return {
      totalIncome: details.totalIncome,
      totalDeductions: details.totalDeductions,
      netSalary: details.netSalary,
      overtimeValue: details.overtimeValue,
      absenceDeduction: details.absenceDeduction,
      unpaidLeaveDeduction: details.unpaidLeaveDeduction,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formData.otherIncome > 0 && (!formData.otherIncomeReason || !formData.otherIncomeReason.trim())) {
        alert("الرجاء إدخال سبب الدخل الإضافي كحقل إلزامي.");
        return;
      }
      const totals = calculateTotals(formData);
      const isEdit = (formData as any).id;
      
      let targetDocId = isEdit;
      if (!isEdit) {
        // Enforce: employee has only one row per month, cannot be repeated
        const existingTx = transactions.find(t => t.employeeId === formData.employeeId && t.month === formData.month);
        if (existingTx) {
          const emp = employees.find(e => e.id === formData.employeeId);
          const confirmMerge = window.confirm(
            `الموظف (${emp?.name}) لديه حركة مالية مسجلة بالفعل لشهر ${formData.month}. هل تريد تعديل وتحديث السطر الحالي بدلاً من تكراره؟`
          );
          if (!confirmMerge) {
            return;
          }
          targetDocId = existingTx.id;
        }
      }

      const docRef = targetDocId ? doc(db, 'transactions', targetDocId) : doc(collection(db, 'transactions'));
      
      await setDoc(docRef, {
        ...formData,
        ...totals,
        createdAt: (formData as any).createdAt || new Date().toISOString()
      }, { merge: true });
      
      setIsModalOpen(false);
      resetForm();
      await refreshData();
      await fetchAuditLogs();
    } catch (err: any) {
      alert("حدث خطأ أثناء حفظ الحركة المالية: " + err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      employeeId: '',
      month: new Date().toISOString().slice(0, 7),
      actualWorkDays: 30,
      basicSalary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      subsistenceAllowance: 0,
      otherAllowances: 0,
      mobileAllowance: 0,
      managementAllowance: 0,
      otherIncome: 0,
      overtimeHours: 0,
      overtimeValue: 0,
      totalIncome: 0,
      socialInsurance: 0,
      taxValue: 0,
      salaryReceived: 0,
      loans: 0,
      bankReceived: 0,
      otherDeductions: 0,
      deductionHours: 0,
      departureDelayDeduction: 0,
      absenceDays: 0,
      absenceDeduction: 0,
      totalDeductions: 0,
      netSalary: 0,
      status: 'Draft',
      salaryIncrease: 0,
      dailyWorkHours: 8,
      notes: ''
    });
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'transactions', id));
    setDeleteConfirmId(null);
  };

  const handleEdit = (t: Transaction) => {
    setFormData({ ...t });
    setIsModalOpen(true);
  };

  const handleCopyFromPreviousMonth = async () => {
    if (!selectedMonth) return;
    setIsCopying(true);
    try {
      const prevDate = new Date(selectedMonth + '-01');
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevMonth = prevDate.toISOString().slice(0, 7);
      
      const prevTransactions = transactions.filter(t => t.month === prevMonth);
      const currentTransactionsEmps = new Set(transactions.filter(t => t.month === selectedMonth).map(t => t.employeeId));
      
      const toCopy = prevTransactions.filter(t => !currentTransactionsEmps.has(t.employeeId));
      
      if (toCopy.length === 0) {
        alert('لا توجد حركات جديدة لنسخها من الشهر السابق.');
        return;
      }

      if (!confirm(`هل أنت متأكد من نسخ ${toCopy.length} حركات من شهر ${prevMonth} إلى شهر ${selectedMonth}؟`)) return;

      const batch = writeBatch(db);
      toCopy.forEach(t => {
        const docRef = doc(collection(db, 'transactions'));
        const { id, createdAt, ...data } = t;
        batch.set(docRef, {
          ...data,
          month: selectedMonth,
          createdAt: new Date().toISOString(),
          status: 'Draft'
        });
      });

      await batch.commit();
      await refreshData();
      alert('تم نسخ الحركات بنجاح');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء النسخ');
    } finally {
      setIsCopying(false);
    }
  };

  const handleSyncApproved = async (empId?: string) => {
    try {
      setIsSyncingApproved(true);
      const token = localStorage.getItem('auth_token');
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

      const targetEmpName = empId ? employees.find(e => e.id === empId)?.name : null;
      const promptMsg = empId 
        ? (isRtl ? `هل ترغب في مراجعة وتحديث كافة المستحقات والاستقطاعات المعتمدة للموظف "${targetEmpName}" لشهر ${selectedMonth} وترحيلها للحركات الشهرية؟` : `Do you want to review and sync all approved allowances and deductions for "${targetEmpName}" in month ${selectedMonth}?`)
        : (isRtl ? `هل ترغب في مراجعة كافة المستحقات والاستقطاعات الفعلية المعتمدة لجميع الموظفين لشهر ${selectedMonth} وترحيلها تلقائياً مع منع التكرار؟` : `Do you want to review and sync all approved allowances and deductions for all employees in month ${selectedMonth}?`);

      if (!window.confirm(promptMsg)) {
        setIsSyncingApproved(false);
        return;
      }

      const res = await fetch('/api/transactions/sync-approved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders
        },
        body: JSON.stringify({
          month: selectedMonth,
          employeeId: empId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || (isRtl ? 'فشلت عملية المراجعة والمزامنة' : 'Sync operation failed'));
      }

      await refreshData();

      setSyncSummaryModal({
        isOpen: true,
        title: isRtl ? 'تمت مراجعة وترحيل المستحقات والاستقطاعات بنجاح' : 'Allowances & Deductions Synced Successfully',
        message: isRtl 
          ? `تم فحص ومطابقة جميع البدلات والاستقطاعات الفعلية المعتمدة لشهر ${selectedMonth} وتحديث الحركات الشهرية بدون أي تكرار.`
          : `All approved allowances and deductions for month ${selectedMonth} have been reconciled and merged into monthly transactions without duplicates.`,
        totalCount: data.totalCount || 0,
        createdCount: data.createdCount || 0,
        updatedCount: data.updatedCount || 0,
        syncedResults: data.syncedResults || []
      });
    } catch (err: any) {
      console.error("Sync error:", err);
      alert(err.message || (isRtl ? 'حدث خطأ أثناء المزامنة' : 'An error occurred during synchronization'));
    } finally {
      setIsSyncingApproved(false);
    }
  };

  const handleSkipEmployee = async (empId: string) => {
    if (!confirm(t('هل تريد استبعاد هذا الموظف من شهر الحالي؟ سيتم إضافة حركة بصافي صفر.'))) return;
    
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const data: Omit<Transaction, 'id' | 'createdAt'> = {
      employeeId: empId,
      month: selectedMonth,
      actualWorkDays: 0,
      basicSalary: 0,
      housingAllowance: 0,
      transportAllowance: 0,
      subsistenceAllowance: 0,
      otherAllowances: 0,
      mobileAllowance: 0,
      managementAllowance: 0,
      otherIncome: 0,
      overtimeHours: 0,
      overtimeValue: 0,
      totalIncome: 0,
      socialInsurance: 0,
      salaryReceived: 0,
      loans: 0,
      bankReceived: 0,
      otherDeductions: 0,
      deductionHours: 0,
      departureDelayDeduction: 0,
      absenceDays: 30,
      absenceDeduction: 0,
      totalDeductions: 0,
      netSalary: 0,
      status: 'Skipped',
      salaryIncrease: 0,
      dailyWorkHours: emp.dailyWorkHours || 8,
      notes: t('تخطي تلقائي (لا يستحق راتب)')
    };

    const docRef = doc(collection(db, 'transactions'));
    await setDoc(docRef, { ...data, createdAt: new Date().toISOString() });
    await refreshData();
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataArr = evt.target?.result;
      const wb = XLSX.read(dataArr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const batch = writeBatch(db);
      data.forEach((row) => {
        const emp = employees.find(e => e.name === row[t('اسم الموظف')] || e.employeeId === row[t('رقم الموظف')]);
        if (emp) {
          const docRef = doc(collection(db, 'transactions'));
          const basic = Number(row[t('الأساسي')] || row[t('الراتب الأساسي')]) || emp.basicSalary || 0;
          const housing = Number(row[t('بدل سكن')]) || emp.housingAllowance || 0;
          const transport = Number(row[t('بدل نقل')]) || emp.transportAllowance || 0;
          const subsistence = Number(row[t('بدل إعاشه')]) || emp.subsistenceAllowance || 0;
          const otherAlls = Number(row[t('بدلات اخرى')]) || emp.otherAllowances || 0;
          const mobile = Number(row[t('بدل جوال')]) || emp.mobileAllowance || 0;
          const management = Number(row[t('بدل ادارة')]) || emp.managementAllowance || 0;

          const grossBase = basic + housing + transport + subsistence + otherAlls + mobile + management;
          const profileDeductions = calculateProfileDeductionsForEmployee(emp, grossBase, basic);

          const rawData = {
            employeeId: emp.id,
            month: row[t('الشهر')] || new Date().toISOString().slice(0, 7),
            actualWorkDays: Number(row[t('أيام العمل')]) || 30,
            basicSalary: basic,
            housingAllowance: housing,
            transportAllowance: transport,
            subsistenceAllowance: subsistence,
            otherAllowances: otherAlls,
            mobileAllowance: mobile,
            managementAllowance: management,
            otherIncome: Number(row[t('دخل آخر')]) || 0,
            overtimeHours: Number(row[t('ساعات الإضافي')]) || 0,
            overtimeValue: Number(row[t('قيمة الإضافي')]) || 0,
            socialInsurance: (row[t('تأمين اجتماعي')] !== undefined && row[t('تأمين اجتماعي')] !== null && row[t('تأمين اجتماعي')] !== '') ? Number(row[t('تأمين اجتماعي')]) : profileDeductions.socialInsurance,
            taxValue: (row[t('ضريبة')] !== undefined && row[t('ضريبة')] !== null && row[t('ضريبة')] !== '') ? Number(row[t('ضريبة')]) : profileDeductions.taxValue,
            salaryReceived: Number(row[t('استلام راتب')]) || 0,
            loans: Number(row[t('سلف')]) || 0,
            bankReceived: Number(row[t('استلام بنك')]) || 0,
            otherDeductions: (row[t('خصومات أخرى')] !== undefined && row[t('خصومات أخرى')] !== null && row[t('خصومات أخرى')] !== '') ? Number(row[t('خصومات أخرى')]) : profileDeductions.otherDeductions,
            deductionHours: Number(row[t('ساعات الخصم')]) || 0,
            departureDelayDeduction: 0,
            absenceDays: Number(row[t('أيام الغياب')]) || 0,
            absenceDeduction: Number(row[t('خصم الغياب')]) || 0,
            salaryIncrease: Number(row[t('زيادة راتب')]) || 0,
            dailyWorkHours: Number(row[t('ساعات العمل اليومية')] || emp.dailyWorkHours) || 8,
            notes: row[t('ملاحظات')] || '',
            status: 'Draft'
          };

          const totals = calculateTotals(rawData as any);
          batch.set(docRef, { ...rawData, ...totals, createdAt: new Date().toISOString() });
        }
      });

      await batch.commit();
      alert('تم استيراد الحركات بنجاح');
    };
    reader.readAsBinaryString(file);
  };

  const handleExportExcel = () => {
    const data = sortedTransactions.map((tx) => {
      const emp = employees.find(e => e.id === tx.employeeId);
      return {
        [t('اسم الموظف')]: emp?.name || t('موظف محذوف'),
        [t('الشهر')]: tx.month,
        [t('أيام العمل')]: tx.actualWorkDays,
        [t('الأساسي')]: tx.basicSalary,
        [t('بدل سكن')]: tx.housingAllowance,
        [t('إضافي')]: tx.overtimeValue,
        [t('كافة الإيرادات')]: tx.totalIncome,
        [t('الخصومات')]: tx.totalDeductions,
        [t('الصافي')]: tx.netSalary,
        [t('ملاحظات')]: tx.notes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, `OPerix_Monthly_Transactions_${selectedMonth}.xlsx`);
  };

  const sortedTransactions = useMemo(() => {
    return [...transactions]
      .filter(t => {
        const empName = employees.find(e => e.id === t.employeeId)?.name || '';
        return (empName || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
               (t.month || '').includes(searchTerm || '');
      })
      .filter(t => t.month === selectedMonth)
      .sort((a, b) => b.createdAt?.localeCompare(a.createdAt));
  }, [transactions, employees, searchTerm, selectedMonth]);

  const monthlyProcessingData = useMemo(() => {
    const monthTransactions = transactions.filter(t => t.month === selectedMonth);
    
    return employees
      .filter(e => e.status === 'Active' || e.status === 'Leave')
      .map(emp => {
        const savedTransaction = monthTransactions.find(t => t.employeeId === emp.id);
        const isNewThisMonth = emp.joinDate?.startsWith(selectedMonth);
        
        let status = 'Pending';
        if (savedTransaction) {
          status = savedTransaction.status || 'Draft';
        } else if (emp.status === 'Leave') {
          status = 'On Leave';
        }
        
        return {
          emp,
          status,
          savedTransaction,
          isNewThisMonth
        };
      });
  }, [employees, transactions, selectedMonth]);

  const { totalBasicAndAllowances, totalAdditionsOnly, totalAllDeductions, totalNetSalary } = useMemo(() => {
    const monthTransactions = transactions.filter(t => t.month === selectedMonth);
    
    const basicAndAllowances = monthTransactions.reduce((acc, t) => {
      const grossBase = (Number(t.basicSalary) || 0) + 
                        (Number(t.housingAllowance) || 0) + 
                        (Number(t.transportAllowance) || 0) + 
                        (Number(t.subsistenceAllowance) || 0) + 
                        (Number(t.otherAllowances) || 0) + 
                        (Number(t.mobileAllowance) || 0) + 
                        (Number(t.managementAllowance) || 0);
      return acc + grossBase;
    }, 0);

    const additions = monthTransactions.reduce((acc, t) => {
      return acc + (Number(t.otherIncome) || 0) + (Number(t.overtimeValue) || 0) + (Number(t.salaryIncrease) || 0);
    }, 0);

    const deductions = monthTransactions.reduce((acc, t) => {
      return acc + (Number(t.totalDeductions) || 0);
    }, 0);

    const netSalarySum = monthTransactions.reduce((acc, t) => {
      return acc + (Number(t.netSalary) || 0);
    }, 0);

    return {
      totalBasicAndAllowances: basicAndAllowances,
      totalAdditionsOnly: additions,
      totalAllDeductions: deductions,
      totalNetSalary: netSalarySum
    };
  }, [transactions, selectedMonth]);

  return (
    <div className="space-y-6">
      {/* Header & Month Selector */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 no-print">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex bg-muted p-1.5 rounded-2xl border border-border">
            <button 
              onClick={() => setActiveTab('processing')}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all",
                activeTab === 'processing' 
                  ? "bg-card text-primary shadow-md border border-border/50" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>{t('كارت العمل الميداني')}</span>
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all",
                activeTab === 'history' 
                  ? "bg-card text-primary shadow-md border border-border/50" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <HistoryIcon className="w-4 h-4" />
              <span>{t('سجل الحركات الشهرية')}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 bg-card border border-border px-4 py-2 rounded-2xl shadow-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <input 
              type="month" 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent outline-none font-black text-sm text-foreground"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeTab === 'processing' && (
            <>
              <button 
                onClick={() => handleSyncApproved()}
                disabled={isSyncingApproved}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-200 dark:shadow-none disabled:opacity-50"
                title={t('مراجعة جميع المستحقات والاستقطاعات المعتمدة للموظفين للشهر المحدد وترحيلها تلقائياً بدون تكرار')}
              >
                <RotateCcw className={cn("w-4 h-4", isSyncingApproved && "animate-spin")} />
                <span>{isSyncingApproved ? t('جاري المراجعة والترحيل...') : t('مراجعة وترحيل المستحقات والاستقطاعات')}</span>
              </button>
              <button 
                onClick={handleCopyFromPreviousMonth}
                disabled={isCopying}
                className="flex items-center gap-2 px-5 py-3 bg-primary/10 text-primary font-black rounded-2xl hover:bg-primary/20 transition-all border border-primary/20 disabled:opacity-50"
              >
                <Copy className="w-4 h-4" />
                <span>{t('النسخ من الشهر السابق')}</span>
              </button>
            </>
          )}
          <label className="cursor-pointer p-3 bg-card border border-border rounded-xl text-muted-foreground hover:bg-muted transition-colors shadow-sm flex items-center gap-2 font-bold">
            <Upload className="w-5 h-5" />
            <span className="hidden md:inline">{t('استيراد')}</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
          </label>
          <button 
            onClick={handleExportExcel}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm flex items-center gap-2 font-bold"
          >
            <Download className="w-5 h-5" />
            <span className="hidden md:inline">{t('تصدير')}</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200 dark:shadow-none"
          >
            <Plus className="w-5 h-5" />
            <span>{t('إضافة حركة')}</span>
          </button>
        </div>
      </div>

      {activeTab === 'processing' ? (
        <div className="space-y-6">
          {/* Dynamic Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 no-print">
            <div className="bg-card border border-border p-6 rounded-3xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">{t('إجمالي الرواتب الأساسية والبدلات')}</p>
                <h3 className="text-3xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{formatCurrency(totalBasicAndAllowances)}</h3>
              </div>
              <div className="w-12 h-12 bg-blue-500/10 text-blue-600 rounded-full flex items-center justify-center">
                <FileText className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-card border border-border p-6 rounded-3xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">{t('الدخل الإضافي فقط')}</p>
                <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(totalAdditionsOnly)}</h3>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center">
                <ArrowUpRight className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-card border border-border p-6 rounded-3xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">{t('إجمالي الاستقطاعات والجزاءات')}</p>
                <h3 className="text-3xl font-black text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(totalAllDeductions)}</h3>
              </div>
              <div className="w-12 h-12 bg-red-500/10 text-red-600 rounded-full flex items-center justify-center">
                <ArrowDownRight className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-card border border-border p-6 rounded-3xl shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">{t('صافي المستحقات (المستحق النهائي)')}</p>
                <h3 className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {formatCurrency(totalNetSalary)}
                </h3>
              </div>
              <div className="w-12 h-12 bg-indigo-500/10 text-indigo-600 rounded-full flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Professional Table */}
          <div className="bg-card border border-border rounded-[2rem] overflow-hidden shadow-sm no-print">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="p-5 text-sm font-black text-slate-500 uppercase tracking-wider">{t('كود الموظف')}</th>
                    <th className="p-5 text-sm font-black text-slate-500 uppercase tracking-wider">{t('اسم الموظف')}</th>
                    <th className="p-5 text-sm font-black text-slate-500 uppercase tracking-wider">{t('القسم')}</th>
                    <th className="p-5 text-sm font-black text-slate-500 uppercase tracking-wider">{t('أيام الغياب')}</th>
                    <th className="p-5 text-sm font-black text-slate-500 uppercase tracking-wider">{t('الدخل الإضافي')}</th>
                    <th className="p-5 text-sm font-black text-slate-500 uppercase tracking-wider">{t('الجزاءات')}</th>
                    <th className="p-5 text-sm font-black text-slate-500 uppercase tracking-wider">{t('المستحق النهائي للموظف')}</th>
                    <th className="p-5 text-sm font-black text-slate-500 uppercase tracking-wider">{t('حالة استكمال البيانات')}</th>
                    <th className="p-5 text-sm font-black text-slate-500 uppercase tracking-wider">{t('الإجراءات')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {monthlyProcessingData.map(({ emp, status: savedStatus, savedTransaction, isNewThisMonth }) => {
                    const deptName = adminDepartments?.find(d => d.id === emp.departmentId)?.name || t('غير محدد');
                    const transaction = savedTransaction || getDraftTransactionForEmp(emp, selectedMonth);
                    const hasSavedTransaction = !!savedTransaction;

                    const rowBg = hasSavedTransaction && savedStatus === 'Completed' 
                      ? "bg-emerald-500/5 dark:bg-emerald-500/10 hover:bg-emerald-500/10 text-emerald-950 dark:text-emerald-50 font-medium" 
                      : hasSavedTransaction
                        ? "bg-amber-500/5 dark:bg-amber-500/10 hover:bg-amber-500/10 text-amber-950 dark:text-amber-50"
                        : "bg-card hover:bg-muted/40 text-foreground";

                    return (
                      <tr key={emp.id} className={cn("transition-all duration-300", rowBg)}>
                        {/* Code */}
                        <td className="p-5 text-sm font-bold tabular-nums">
                          <div className="flex items-center gap-2">
                            <span>{emp.employeeId}</span>
                            {isNewThisMonth && (
                              <span className="bg-primary text-primary-foreground px-2 py-0.5 text-[9px] font-black uppercase rounded-full">NEW</span>
                            )}
                          </div>
                        </td>

                        {/* Name */}
                        <td className="p-5 text-sm font-black text-slate-950 dark:text-white">
                          {emp.name}
                        </td>

                        {/* Department */}
                        <td className="p-5 text-sm text-slate-800 dark:text-slate-350 font-bold">
                          {deptName}
                        </td>

                        {/* Absence Days */}
                        <td className="p-5 text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">
                          {transaction ? `${transaction.absenceDays} ${t('يوم')}` : t('غير مسجل')}
                        </td>

                        {/* Additional Income */}
                        <td className="p-5 text-sm font-bold tabular-nums">
                          {transaction && transaction.otherIncome > 0 ? (
                            <div className="flex flex-col">
                              <span className="text-emerald-700 dark:text-emerald-400 font-black">+{formatCurrency(transaction.otherIncome)}</span>
                              {transaction.otherIncomeReason && (
                                <span className="text-[10px] text-slate-800 dark:text-slate-200 font-bold max-w-[150px] truncate" title={transaction.otherIncomeReason}>
                                  السبب: {transaction.otherIncomeReason}
                                </span>
                              )}
                            </div>
                          ) : '-'}
                        </td>

                        {/* Penalties */}
                        <td className="p-5 text-sm font-bold tabular-nums">
                          {transaction && transaction.otherDeductions > 0 ? (
                            <span className="text-rose-700 dark:text-rose-400 font-black">-{formatCurrency(transaction.otherDeductions)}</span>
                          ) : '-'}
                        </td>

                        {/* Net Salary (المستحق النهائي) */}
                        <td className="p-5 text-sm font-black tabular-nums">
                          {transaction ? (
                            <span className="text-blue-600 dark:text-blue-500 text-base font-black">
                              {formatCurrency(transaction.netSalary)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs font-bold leading-relaxed block max-w-[140px]">{t('بانتظار الحساب')}<span className="text-[10px] block opacity-75 font-medium mt-0.5">
                                الأساسي: {formatCurrency((emp.basicSalary || 0) + (emp.housingAllowance || 0))}
                              </span>
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="p-5 text-sm font-black">
                          {hasSavedTransaction && savedStatus === 'Completed' ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{t('تم استكمال المؤثرات المراجعة')}</span>
                            </div>
                          ) : hasSavedTransaction ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
                              <Clock3 className="w-4 h-4" />
                              <span>{t('بانتظار المراجعة والاعتماد')}</span>
                            </div>
                          ) : emp.status === 'Leave' ? (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs">
                              <Clock className="w-4 h-4" />
                              <span>{t('في إجازة معتمدة')}</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs">
                              <AlertTriangle className="w-4 h-4" />
                              <span>{t('بانتظار إدخال البيانات (مسودة)')}</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-5 text-sm">
                          <div className="flex items-center gap-2">
                            {/* Monthly Attendance Details Button */}
                            <button 
                              onClick={() => handleOpenAttendanceDetails(emp, selectedMonth)}
                              className="p-2.5 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400 rounded-xl border border-teal-100 dark:border-teal-900/30 transition-all hover:scale-[1.05] duration-150"
                              title={t('تفاصيل الحضور الشهري (سجل الأيام، التأخير، الإضافي، المأموريات والإجازات)')}
                            >
                              <Fingerprint className="w-4 h-4" />
                            </button>

                            {/* Pay Card (كارت الراتب) is always available! */}
                            <button 
                              onClick={() => setSelectedPayCard(transaction)}
                              className="p-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-900/30 transition-all hover:scale-[1.05] duration-150"
                              title={t('كارت الرواتب')}
                            >
                              <FileText className="w-4 h-4" />
                            </button>

                            {/* Quick Sync Button for Employee */}
                            <button 
                              onClick={() => handleSyncApproved(emp.id)}
                              disabled={isSyncingApproved}
                              className="p-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/30 transition-all hover:scale-[1.05] duration-150 disabled:opacity-50"
                              title={t('مراجعة وترحيل المستحقات والاستقطاعات المعتمدة لهذا الموظف')}
                            >
                              <RotateCcw className={cn("w-4 h-4", isSyncingApproved && "animate-spin")} />
                            </button>

                            {hasSavedTransaction ? (
                              <>
                                <button 
                                  onClick={() => handleEdit(savedTransaction)}
                                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-bold text-xs rounded-xl transition-all border border-slate-200 dark:border-slate-700"
                                >{t('تعديل')}</button>
                                
                                {savedStatus !== 'Completed' ? (
                                  <button 
                                    onClick={() => handleCompleteReview(savedTransaction.id)}
                                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl transition-all shadow-sm active:scale-95"
                                  >
                                    {t('إتمام المراجعة والاعتماد')}
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-1 rounded-lg text-xs font-black border border-emerald-100 dark:border-emerald-900/20">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{t('معتمد مالياً')}</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => {
                                    handleEmployeeChange(emp.id);
                                    setIsModalOpen(true);
                                  }}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-blue-200 dark:shadow-none"
                                >{t('إدخال')}</button>
                                <button 
                                  onClick={() => handleSkipEmployee(emp.id)}
                                  className="p-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-xl border border-border transition-all"
                                  title={t('تخطي')}
                                >
                                  <SkipForward className="w-4 h-4" />
                                </button>
                              </>
                            )}
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
      ) : (
        /* History List Mode */
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden no-print">
          <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/30 dark:bg-slate-800/20">
            <div className="flex items-center gap-3">
              <HistoryIcon className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{t('سجل حركات الشهر')}</h3>
            </div>
            <div className="relative max-w-xs w-full">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder={t('البحث في السجل...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-sm transition-all"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">{t('الموظف')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 text-center">{t('أيام العمل')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">{t('إجمالي الدخل')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">{t('إجمالي الخصومات')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">{t('صافي الراتب')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">{t('الحالة')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">{t('سجل التدقيق (التاريخ والمعدل)')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">{t('الإجراءات')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {sortedTransactions.map((tx) => {
                  const emp = employees.find(e => e.id === tx.employeeId);
                  const logsForTx = auditLogs.filter(log => log.entityId === tx.id);
                  const lastLog = logsForTx[0];
                  const modifiedBy = lastLog?.userName || t('النظام');
                  const modifiedDate = lastLog?.timestamp 
                    ? new Date(lastLog.timestamp).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) 
                    : new Date(tx.createdAt || Date.now()).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
                  return (
                    <motion.tr 
                      key={tx.id} 
                      className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all group backdrop-blur-[2px]"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-black text-slate-600 dark:text-slate-300">
                            {emp?.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 dark:text-white leading-tight">{emp?.name || t('موظف محذوف')}</p>
                            <p className="text-xs text-slate-400 font-bold tabular-nums">{emp?.employeeId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center font-black text-slate-600 dark:text-slate-400 tabular-nums">{tx.actualWorkDays}</td>
                      <td className="px-8 py-5 font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(tx.totalIncome)}</td>
                      <td className="px-8 py-5 font-black text-red-600 dark:text-red-400 tabular-nums">{formatCurrency(tx.totalDeductions)}</td>
                      <td className="px-8 py-5 font-black text-blue-600 dark:text-blue-400 tabular-nums text-lg">{formatCurrency(tx.netSalary)}</td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                          tx.status === 'Completed' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                          tx.status === 'Skipped' ? "bg-slate-100 dark:bg-slate-800 text-slate-500" :
                          "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        )}>
                          {tx.status === 'Draft' ? t('مسودة') : tx.status === 'Skipped' ? t('تخطي') : t('مكتمل')}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-500 whitespace-nowrap">
                            {modifiedBy} - {modifiedDate}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setAuditTargetTx(tx);
                              setIsAuditModalOpen(true);
                            }}
                            className="p-1 px-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg border border-slate-100 dark:border-slate-800 transition-all flex items-center gap-1"
                            title={t('عرض سجل التعديلات بالكامل')}
                          >
                            <Settings className="w-3.5 h-3.5 animate-spin-hover" />
                            <span className="text-[10px] font-black tracking-tighter">{t('سجل')}</span>
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              if (emp) handleOpenAttendanceDetails(emp, tx.month);
                            }}
                            className="p-2.5 text-teal-600 dark:text-teal-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"
                            title={t('تفاصيل الحضور الشهري')}
                          >
                            <Fingerprint className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setSelectedPayCard(tx)}
                            className="p-2.5 text-blue-600 dark:text-blue-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"
                            title={t('عرض الكارت')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEdit(tx)}
                            className="p-2.5 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"
                            title={t('تعديل')}
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmId(tx.id)}
                            className="p-2.5 text-red-600 dark:text-red-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm"
                            title={t('حذف')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payslip Modal (Pay Card) */}
      <AnimatePresence>
        {selectedPayCard && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedPayCard(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md no-print" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.9, y: 20 }} 
              className="relative bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[3rem] shadow-2xl overflow-hidden print:shadow-none print:rounded-none"
            >
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between no-print">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-2xl text-blue-600">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{t('كارت الراتب الشهري')}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{selectedMonth}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button 
                    onClick={() => {
                      if (selectedPayCard) {
                        const emp = employees.find(e => e.id === selectedPayCard.employeeId);
                        if (emp) {
                          handleOpenAttendanceDetails(emp, selectedPayCard.month);
                        }
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 dark:bg-teal-950/30 hover:bg-teal-100 text-teal-700 dark:text-teal-300 font-black rounded-xl transition-all border border-teal-200 dark:border-teal-800/40 text-xs"
                    title={t('عرض تفاصيل الحضور والانصراف والمؤثرات لهذا الشهر')}
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span>{t('تفاصيل الحضور الشهري')}</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (selectedPayCard) {
                        handleSyncApproved(selectedPayCard.employeeId);
                      }
                    }}
                    disabled={isSyncingApproved}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 font-black rounded-xl transition-all border border-emerald-200 dark:border-emerald-800/40 text-xs disabled:opacity-50"
                    title={t('مراجعة وترحيل المستحقات والاستقطاعات المعتمدة لهذا الموظف')}
                  >
                    <RotateCcw className={cn("w-4 h-4", isSyncingApproved && "animate-spin")} />
                    <span>{t('تحديث ومزامنة المستحقات')}</span>
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black rounded-xl transition-all"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{t('طباعة الكارت')}</span>
                  </button>
                  <button onClick={() => setSelectedPayCard(null)} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="p-10 space-y-10 overflow-y-auto max-h-[80vh] print:max-h-none print:p-0">
                {/* Pay Card Content (Printable) */}
                <div className="print-card space-y-8">
                  {/* Card Header */}
                  <div className="flex justify-between items-start pb-8 border-b-2 border-slate-100 dark:border-slate-800 border-dashed">
                    <div className="space-y-4">
                      {systemSettings?.logoUrl ? (
                        <div className="bg-white dark:bg-slate-800 p-2 rounded-2xl inline-block shadow-sm">
                           <img src={systemSettings.logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
                        </div>
                      ) : (
                        <div className="h-16 px-6 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 flex items-center rounded-2xl font-black tracking-tighter text-2xl uppercase italic">
                          {systemSettings?.organizationName || 'OPerix'}
                        </div>
                      )}
                      <div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{t('كارت العمل الشهري')}</h2>
                        <p className="text-sm text-slate-500 font-bold uppercase tracking-widest mt-1">Monthly Job Card Record</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('التاريخ / Date')}</p>
                      <p className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{selectedMonth}</p>
                      <div className="pt-4 no-print">
                         <div className="bg-blue-600 text-white px-6 py-2 rounded-xl font-black text-xs uppercase tracking-tighter shadow-lg shadow-blue-200">
                           OFFICIAL DOCUMENT
                         </div>
                      </div>
                    </div>
                  </div>

                  {/* Employee Info Block */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 p-8 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('اسم الموظف / Name')}</p>
                      <p className="font-black text-slate-900 dark:text-white">{employees.find(e => e.id === selectedPayCard.employeeId)?.name}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('الرقم الوظيفي / ID')}</p>
                      <p className="font-black text-slate-900 dark:text-white tabular-nums">{employees.find(e => e.id === selectedPayCard.employeeId)?.employeeId}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('المسمى الوظيفي / Title')}</p>
                      <p className="font-black text-slate-900 dark:text-white">{employees.find(e => e.id === selectedPayCard.employeeId)?.jobTitle}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{t('أيام العمل / Days')}</p>
                      <p className="font-black text-slate-900 dark:text-white tabular-nums">{selectedPayCard.actualWorkDays} يوم</p>
                    </div>
                  </div>

                  {/* Monthly Allocation of Days */}
                  {(() => {
                    const emp = employees.find(e => e.id === selectedPayCard.employeeId);
                    const targetMonth = selectedPayCard.month;

                    if (!emp) return null;

                    const { stats } = calculateEmployeeMonthlyAttendance({
                      employee: emp,
                      month: targetMonth,
                      attendanceRecords,
                      attendanceShifts,
                      missions,
                      leaveRequests,
                      absenceRecords,
                      absenceTypes,
                      administrativeNotices,
                      language
                    });

                    const attendanceDaysCount = stats.presentCount;
                    const missionsDaysCount = stats.missionCount;
                    const wfhDaysCount = stats.wfhCount;
                    const absenceDaysCount = selectedPayCard.absenceDays !== undefined ? selectedPayCard.absenceDays : stats.absentCount;
                    const leavesDaysCount = stats.leaveCount;

                    return (
                      <div className="border-2 border-slate-150/80 dark:border-slate-850/80 rounded-[2rem] overflow-hidden bg-[#fafbfc] dark:bg-[#0b101f] p-6 space-y-4 shadow-sm">
                        <h4 className="font-black text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                          <Clock className="w-4.5 h-4.5 text-blue-500 animate-spin-slow" />
                          <span>{t('إحصائيات الأيام التشغيلية الفعلية / Operational Days Breakdown')}</span>
                        </h4>
                        
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          {/* 1. الحضور */}
                          <div className="bg-gradient-to-br from-emerald-50/70 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10 p-5 border border-emerald-100/50 dark:border-emerald-950/40 text-center rounded-2xl flex flex-col justify-between items-center shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                            <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                              <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                            </div>
                            <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-wide block mb-3 z-10">{t('أيام الحضور')}</span>
                            <div className="flex items-center gap-1.5 z-10">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                              <span className="text-xl font-black text-emerald-950 dark:text-emerald-50 tabular-nums">{attendanceDaysCount} {t('يوم')}</span>
                            </div>
                          </div>

                          {/* 2. المأموريات */}
                          <div className="bg-gradient-to-br from-teal-50/70 to-teal-100/30 dark:from-teal-950/20 dark:to-teal-900/10 p-5 border border-teal-100/50 dark:border-teal-950/40 text-center rounded-2xl flex flex-col justify-between items-center shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                            <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                              <Plane className="w-12 h-12 text-teal-600" />
                            </div>
                            <span className="text-[10px] font-black text-teal-800 dark:text-teal-400 uppercase tracking-wide block mb-3 z-10">{t('أيام المأموريات')}</span>
                            <div className="flex items-center gap-1.5 z-10">
                              <Plane className="w-4 h-4 text-teal-600 dark:text-teal-500" />
                              <span className="text-xl font-black text-teal-950 dark:text-teal-50 tabular-nums">{missionsDaysCount} {t('يوم')}</span>
                            </div>
                          </div>

                          {/* 3. العمل من المنزل */}
                          <div className="bg-gradient-to-br from-[#eef2ff] to-[#e0e7ff]/30 dark:from-indigo-950/20 dark:to-indigo-900/10 p-5 border border-indigo-100/50 dark:border-indigo-950/40 text-center rounded-2xl flex flex-col justify-between items-center shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                            <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                              <Home className="w-12 h-12 text-indigo-600" />
                            </div>
                            <span className="text-[10px] font-black text-indigo-800 dark:text-indigo-400 uppercase tracking-wide block mb-3 z-10">{t('العمل من المنزل')}</span>
                            <div className="flex items-center gap-1.5 z-10">
                              <Home className="w-4 h-4 text-indigo-600 dark:text-indigo-500" />
                              <span className="text-xl font-black text-indigo-950 dark:text-indigo-50 tabular-nums">{wfhDaysCount} {t('يوم')}</span>
                            </div>
                          </div>

                          {/* 4. الغياب */}
                          <div className="bg-gradient-to-br from-rose-50/70 to-rose-100/30 dark:from-rose-950/20 dark:to-rose-900/10 p-5 border border-rose-100/50 dark:border-rose-950/40 text-center rounded-2xl flex flex-col justify-between items-center shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                            <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                              <AlertCircle className="w-12 h-12 text-rose-600" />
                            </div>
                            <span className="text-[10px] font-black text-rose-800 dark:text-rose-400 uppercase tracking-wide block mb-3 z-10">{t('أيام الغياب')}</span>
                            <div className="flex items-center gap-1.5 z-10">
                              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-500" />
                              <span className="text-xl font-black text-red-600 dark:text-red-400 tabular-nums">{absenceDaysCount} {t('يوم')}</span>
                            </div>
                          </div>

                          {/* 5. الإجازات */}
                          <div className="bg-gradient-to-br from-amber-50/70 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10 p-5 border border-amber-100/50 dark:border-amber-950/40 text-center rounded-2xl flex flex-col justify-between items-center shadow-sm relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                            <div className="absolute right-2 top-2 opacity-10 group-hover:opacity-20 transition-opacity">
                              <Calendar className="w-12 h-12 text-amber-600" />
                            </div>
                            <span className="text-[10px] font-black text-amber-800 dark:text-amber-400 uppercase tracking-wide block mb-3 z-10">{t('أيام الإجازات')}</span>
                            <div className="flex items-center gap-1.5 z-10">
                              <Calendar className="w-4 h-4 text-amber-600 dark:text-amber-500" />
                              <span className="text-xl font-black text-slate-900 dark:text-white tabular-nums">{leavesDaysCount} {t('يوم')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Financial Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Earnings */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-emerald-600 mb-2 border-b-2 border-emerald-50 dark:border-emerald-900/30 pb-2">
                        <ArrowUpRight className="w-5 h-5" />
                        <h4 className="font-black uppercase text-sm tracking-widest">{t('المستحقات / Earnings')}</h4>
                      </div>
                      <div className="space-y-3">
                        {[
                          { label: t('الراتب الأساسي'), val: selectedPayCard.basicSalary },
                          { label: t('بدل سكن'), val: selectedPayCard.housingAllowance },
                          { label: t('بدل نقل'), val: selectedPayCard.transportAllowance },
                          { label: t('بدل إعاشة'), val: selectedPayCard.subsistenceAllowance },
                          { label: t('بدلات أخرى'), val: (selectedPayCard.otherAllowances || 0) + (selectedPayCard.managementAllowance || 0) + (selectedPayCard.mobileAllowance || 0) },
                          { label: t('إضافي العمل'), val: selectedPayCard.overtimeValue },
                          { label: t('أخرى / إضافات'), val: (selectedPayCard.otherIncome || 0) + (selectedPayCard.salaryIncrease || 0) }
                        ].map((item, i) => item.val > 0 && (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">{item.label}</span>
                            <span className="font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(item.val)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex justify-between items-center">
                         <span className="font-black text-emerald-600 uppercase text-[10px]">{t('إجمالي المستحقات')}</span>
                         <span className="font-black text-emerald-600 text-lg tabular-nums">{formatCurrency(selectedPayCard.totalIncome)}</span>
                      </div>
                    </div>

                    {/* Deductions */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-2 border-b-2 border-rose-100/40 dark:border-rose-900/30 pb-2">
                        <div className="flex items-center gap-2 text-red-600">
                          <ArrowDownRight className="w-5 h-5" />
                          <h4 className="font-black uppercase text-sm tracking-widest">{t('الاستقطاعات / Deductions')}</h4>
                        </div>
                        {/* Interactive Detail Action */}
                        <button
                          type="button"
                          onClick={() => setShowDeductionsBreakdown(true)}
                          className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-700 dark:text-rose-455 px-3 py-1 rounded-xl text-xs font-black border border-rose-100 dark:border-rose-900/40 cursor-pointer shadow-sm hover:scale-[1.03] active:scale-95 transition-all no-print"
                          title={t('عرض تفاصيل الجزاءات والاستقطاعات')}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                          <span>{t('تفاصيل الاستقطاعات والجزاءات')}</span>
                        </button>
                      </div>
                      <div className="space-y-3">
                        {[
                          { label: t('اشتراك التأمينات الاجتماعية والغطاء الاجتماعي / Social Insurance Contribution'), val: selectedPayCard.socialInsurance },
                          { label: t('ضريبة كسب العمل / Income Tax'), val: selectedPayCard.taxValue || 0 },
                          { label: t('سداد قسط قرض وسلف مستقطعة (سلف مستردة) / Loan Repayment & Advances'), val: selectedPayCard.loans },
                          { label: `${t('خصم أيام الغياب بدون مرتب')} (${selectedPayCard.absenceDays || 0} ${t('يوم')}) / Unpaid Absence Deduction`, val: selectedPayCard.absenceDeduction },
                          { label: `${t('خصم أيام الإجازة بدون مرتب')} (${selectedPayCard.unpaidLeaveDays || 0} ${t('يوم')}) / Unpaid Leave Deduction`, val: selectedPayCard.unpaidLeaveDeduction },
                          { label: t('خصم التأخر والانصراف المبكر / Late Arrival & Early Departure Deduction'), val: selectedPayCard.departureDelayDeduction },
                          { label: t('استلام مسبق (نقدي) / Pre-received Cash'), val: selectedPayCard.salaryReceived },
                          { label: t('استلام مسبق (بنكي) / Pre-received Bank'), val: selectedPayCard.bankReceived },
                          { label: t('عقوبات وجزاءات مالية أخرى (جزاء مالي) / Financial Penalty & Other Deductions'), val: selectedPayCard.otherDeductions }
                        ].map((item, i) => (item.val !== undefined && item.val > 0) && (
                          <div key={i} className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-500">{item.label}</span>
                            <span className="font-black text-slate-900 dark:text-white tabular-nums">-{formatCurrency(item.val)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex justify-between items-center">
                         <span className="font-black text-red-600 uppercase text-[10px]">{t('إجمالي الاستقطاعات')}</span>
                         <span className="font-black text-red-600 text-lg tabular-nums">-{formatCurrency(selectedPayCard.totalDeductions)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Net Salary Footer */}
                  <div className="relative mt-12 bg-slate-100 dark:bg-slate-800 p-8 rounded-[2.5rem] overflow-hidden shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
                       <div>
                          <h4 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-2">{t('صافي المستحق النهائي')}</h4>
                          <p className="text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-widest">Final Net Payable Amount</p>
                       </div>
                       <div className="text-right">
                          <p className="text-5xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">{formatCurrency(selectedPayCard.netSalary)}</p>
                          <p className="text-emerald-600 dark:text-emerald-400 font-black text-xs mt-2 uppercase">{t('مستحق الصرف فوراً')}</p>
                       </div>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-10 pt-12 text-center">
                     <div className="space-y-8">
                        <div className="h-px bg-slate-200 dark:bg-slate-700 w-full" />
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{t('توقيع المراجعة المالية')}</p>
                     </div>
                     <div className="space-y-8">
                        <div className="h-px bg-slate-200 dark:bg-slate-700 w-full" />
                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">{t('اعتماد المدير العام')}</p>
                     </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deductions Breakdown Modal */}
      <AnimatePresence>
        {showDeductionsBreakdown && selectedPayCard && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowDeductionsBreakdown(false)} 
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 z-10 p-6 text-right"
              dir="rtl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 dark:text-white leading-tight">{t('تفاصيل الاستقطاعات والجزاءات')}</h4>
                    <p className="text-[10px] text-slate-455 dark:text-slate-400 font-bold uppercase tracking-wider">{selectedPayCard.month}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowDeductionsBreakdown(false)} 
                  className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-6 space-y-4">
                <div className="text-center bg-rose-50/20 dark:bg-rose-950/10 p-4 rounded-2xl border border-rose-100/30 dark:border-rose-900/10 mb-4 font-black">
                  <p className="text-xs text-slate-400 dark:text-slate-455 font-bold">{t('إجمالي الاستقطاعات والجزاءات المطبقة')}</p>
                  <h3 className="text-2xl font-black text-rose-650 dark:text-rose-450 mt-1 tabular-nums">
                    -{formatCurrency(selectedPayCard.totalDeductions)}
                  </h3>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 space-y-3 pt-2">
                  <div className="py-2.5 flex justify-between items-center text-sm font-bold border-none">
                    <div className="flex flex-col text-right">
                      <span className="text-slate-800 dark:text-slate-200">{t('اشتراك التأمينات الاجتماعية والغطاء الاجتماعي')}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Social Insurance Contribution</span>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(selectedPayCard.socialInsurance || 0)}
                    </span>
                  </div>

                  {selectedPayCard.taxValue > 0 && (
                    <div className="py-2.5 flex justify-between items-center text-sm font-bold">
                      <div className="flex flex-col text-right">
                        <span className="text-slate-800 dark:text-slate-200">{t('ضريبة كسب العمل')}</span>
                        <span className="text-[10px] text-slate-400 font-medium">Income Tax</span>
                      </div>
                      <span className="font-black text-slate-900 dark:text-white tabular-nums">
                        {formatCurrency(selectedPayCard.taxValue || 0)}
                      </span>
                    </div>
                  )}

                  <div className="py-2.5 flex justify-between items-center text-sm font-bold">
                    <div className="flex flex-col text-right">
                      <span className="text-slate-800 dark:text-slate-200">{t('سداد قسط قرض وسلف مستقطعة')}</span>
                      <span className="text-[10px] text-slate-450 dark:text-slate-500 font-medium">Loan Repayment & Advances</span>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(selectedPayCard.loans || 0)}
                    </span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center text-sm font-bold">
                    <div className="flex flex-col text-right">
                      <span className="text-slate-800 dark:text-slate-200">
                        {t('استقطاع الغياب بدون مرتب')} ({selectedPayCard.absenceDays || 0} {t('يوم')})
                      </span>
                      <span className="text-[10px] text-slate-450 dark:text-slate-500 font-medium">Unpaid Absence Days Deduction</span>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(selectedPayCard.absenceDeduction || 0)}
                    </span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center text-sm font-bold">
                    <div className="flex flex-col text-right">
                      <span className="text-slate-800 dark:text-slate-200">
                        {t('استقطاع الإجازة بدون مرتب')} ({selectedPayCard.unpaidLeaveDays || 0} {t('يوم')})
                      </span>
                      <span className="text-[10px] text-slate-450 dark:text-slate-500 font-medium">Unpaid Leaves Deduction</span>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(selectedPayCard.unpaidLeaveDeduction || 0)}
                    </span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center text-sm font-bold">
                    <div className="flex flex-col text-right">
                      <span className="text-slate-800 dark:text-slate-200">{t('خصم التأخر والانصراف المبكر')}</span>
                      <span className="text-[10px] text-slate-450 dark:text-slate-500 font-medium">Late Arrival & Early Departure Deduction</span>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(selectedPayCard.departureDelayDeduction || 0)}
                    </span>
                  </div>

                  <div className="py-2.5 flex justify-between items-center text-sm font-bold">
                    <div className="flex flex-col text-right">
                      <span className="text-slate-800 dark:text-slate-200">{t('عقوبات وجزاءات مالية أخرى (جزاء مالي)')}</span>
                      <span className="text-[10px] text-slate-455 dark:text-slate-500 font-medium">Financial Penalty & Other Deductions</span>
                    </div>
                    <span className="font-black text-slate-900 dark:text-white tabular-nums">
                      {formatCurrency(selectedPayCard.otherDeductions || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex justify-end">
                <button 
                  onClick={() => setShowDeductionsBreakdown(false)} 
                  className="px-6 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-rose-200 dark:shadow-none font-bold"
                >
                  {t('إغلاق')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 z-10">
              <div className="p-8 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">{(formData as any).id ? t('تعديل الحركة المالية') : t('إضافة حركة شهرية تفصيلية')}</h3>
                    <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Transaction Management</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Employee Selector */}
                  <div className="md:col-span-3 space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('الموظف / Employee')}</label>
                    <div className="relative">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input 
                        type="text"
                        placeholder={t('ابحث بالاسم هنا للتصفية...')}
                        className="w-full pr-10 pl-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none font-bold mb-2 dark:text-white"
                        value={empSearch || ''}
                        onChange={(e) => setEmpSearch(e.target.value)}
                        disabled={!!(formData as any).id}
                      />
                      <select 
                        required 
                        disabled={!!(formData as any).id}
                        className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none font-black text-lg dark:text-white" 
                        value={formData.employeeId || ''} 
                        onChange={(e) => handleEmployeeChange(e.target.value)}
                      >
                        <option value="">{t('اختار الموظف / Select Employee')}</option>
                        {employees
                          .filter(e => e.status === 'Active' || e.status === 'Leave')
                          .filter(e => (e.name || '').toLowerCase().includes((empSearch || '').toLowerCase()))
                          .map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.employeeId})</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Month */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('الشهر / Month')}</label>
                    <input 
                      type="month" 
                      required 
                      disabled={!!(formData as any).id}
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none font-black text-lg dark:text-white" 
                      value={formData.month || ''} 
                      onChange={(e) => setFormData({...formData, month: e.target.value})} 
                    />
                  </div>

                  {/* Actual Work Days */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('أيام العمل الفعلية')}</label>
                    <input 
                      type="number" 
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl focus:border-blue-500 outline-none font-black text-lg dark:text-white tabular-nums" 
                      value={formData.actualWorkDays || 0} 
                      onChange={(e) => setFormData({...formData, actualWorkDays: Number(e.target.value) || 0})} 
                    />
                  </div>

                  {/* Daily Work Hours */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('ساعات العمل اليومية')}</label>
                    <input 
                      type="number" 
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl focus:border-blue-500 outline-none font-black text-lg dark:text-white tabular-nums" 
                      value={formData.dailyWorkHours || 0} 
                      onChange={(e) => setFormData({...formData, dailyWorkHours: Number(e.target.value) || 0})} 
                    />
                  </div>

                  {/* Earnings Influences Header with Clear Dedicated Auto Fetch Button */}
                  <div className="md:col-span-3 border-b-2 border-emerald-50 dark:border-emerald-900/30 pb-3 mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ArrowUpRight className="w-5 h-5 text-emerald-600" />
                      <h4 className="font-black text-sm uppercase tracking-widest text-emerald-600">{t('المؤثرات الشهرية والإضافات')}</h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button 
                        type="button" 
                        disabled={!formData.employeeId || !formData.month}
                        onClick={() => {
                          const emp = employees.find(e => e.id === formData.employeeId);
                          if (emp) handleOpenAttendanceDetails(emp, formData.month);
                        }}
                        className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all"
                        title={t('عرض تفاصيل الحضور والانصراف والإجازات والمأموريات لهذا الشهر')}
                      >
                        <Fingerprint className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        <span>{t('تفاصيل الحضور الشهري')}</span>
                      </button>
                      <button 
                        type="button" 
                        id="btn-fetch-monthly-data"
                        disabled={isCalculating || !formData.employeeId || !formData.month}
                        onClick={handleAutomateAttendance}
                        className="relative z-20 flex items-center justify-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-xl shadow-md shadow-teal-500/20 hover:shadow-teal-500/30 transition-all text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        title={t('جلب وحساب أيام الحضور والغياب والمأموريات والإجازات والإضافي من سجلات الشهر المحدد')}
                      >
                        <Sparkles className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : ''}`} />
                        <span>{isCalculating ? t('جاري جلب واحتساب البيانات...') : t('جلب البيانات من الحضور والمؤثرات')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Absence Days */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('أيام الغياب')}</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-red-500 outline-none font-bold tabular-nums dark:text-white" 
                      value={formData.absenceDays || 0} 
                      onChange={(e) => setFormData({...formData, absenceDays: Number(e.target.value) || 0})} 
                    />
                  </div>

                  {/* Unexcused Absence Deduction */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('خصم الغياب المحتسب')}</label>
                    <input 
                      type="number" 
                      disabled
                      className="w-full px-5 py-3 bg-red-50/50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl outline-none font-black text-red-600 tabular-nums cursor-not-allowed" 
                      value={formData.absenceDeduction || 0} 
                    />
                  </div>

                  {/* Unpaid Leave Days */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('أيام الإجازة بدون راتب')}</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-red-500 outline-none font-bold tabular-nums dark:text-white" 
                      value={formData.unpaidLeaveDays || 0} 
                      onChange={(e) => setFormData({...formData, unpaidLeaveDays: Number(e.target.value) || 0})} 
                    />
                  </div>

                  {/* Unpaid Leave Deduction */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('خصم الإجازة بدون راتب المحتسب')}</label>
                    <input 
                      type="number" 
                      disabled
                      className="w-full px-5 py-3 bg-red-50/50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl outline-none font-black text-red-600 tabular-nums cursor-not-allowed" 
                      value={formData.unpaidLeaveDeduction || 0} 
                    />
                  </div>

                  {/* Overtime Hours */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('ساعات الإضافي')}</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 outline-none font-bold tabular-nums dark:text-white" 
                      value={formData.overtimeHours || 0} 
                      onChange={(e) => setFormData({...formData, overtimeHours: Number(e.target.value) || 0})} 
                    />
                  </div>

                  {/* Overtime Value */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('قيمة الإضافي المحتسبة')}</label>
                    <input 
                      type="number" 
                      disabled
                      className="w-full px-5 py-3 bg-emerald-50/50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-950/40 rounded-xl outline-none font-black text-emerald-600 tabular-nums cursor-not-allowed" 
                      value={formData.overtimeValue || 0} 
                    />
                  </div>

                  {/* Additional Income */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('الدخل الإضافي')}</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 outline-none font-bold tabular-nums dark:text-white" 
                      value={formData.otherIncome || 0} 
                      onChange={(e) => setFormData({...formData, otherIncome: Number(e.target.value) || 0})} 
                    />
                  </div>

                  {/* Reason for Additional Income - Mandatory if otherIncome > 0 */}
                  <div className={cn("space-y-2 md:col-span-1 transition-all duration-300", formData.otherIncome > 0 ? "opacity-100 scale-100 mb-0" : "opacity-0 scale-95 pointer-events-none")}>
                    <label className="text-xs font-black text-red-600 uppercase tracking-widest mr-2">{t('سبب الدخل الإضافي * (إلزامي)')}</label>
                    <input 
                      type="text" 
                      required={formData.otherIncome > 0}
                      placeholder={t('أدخل سبب صرف هذا الدخل الإضافي للموظف')}
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-red-300 dark:border-red-900/40 rounded-xl focus:border-blue-500 outline-none font-bold dark:text-white" 
                      value={formData.otherIncomeReason || ''} 
                      onChange={(e) => setFormData({...formData, otherIncomeReason: e.target.value})} 
                    />
                  </div>

                  {/* Section Title: Deductions & Penalties */}
                  <div className="md:col-span-3 border-b-2 border-red-50 dark:border-red-900/30 pb-3 mt-6 flex items-center gap-3">
                    <ArrowDownRight className="w-5 h-5 text-red-600" />
                    <h4 className="font-black text-sm uppercase tracking-widest text-red-600">{t('الجزاءات والخصومات الأخرى')}</h4>
                  </div>

                  {/* Dynamic Profile Deductions Card */}
                  {activeProfileDeductionDetails && activeProfileDeductionDetails.length > 0 && (
                    <div className="md:col-span-3 bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/20 p-6 rounded-3xl space-y-4">
                      <div className="flex items-center gap-2 text-rose-800 dark:text-rose-400">
                        <AlertTriangle className="w-5 h-5 text-rose-500" />
                        <h4 className="font-black text-sm uppercase tracking-widest">{t('الاستقطاعات النشطة في ملف الموظف (تلقائية كل شهر)')}</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {activeProfileDeductionDetails.map((item, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-rose-100/50 dark:border-rose-900/10 flex flex-col justify-between hover:shadow-sm transition-all">
                            <div className="flex justify-between items-start gap-1 pb-1">
                              <span className="text-[10px] font-black text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md">
                                {item.category}
                              </span>
                            </div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                              {item.nameAr}
                            </span>
                            <span className="text-lg font-black text-red-600 dark:text-red-400 mt-2">
                              {formatCurrency(item.employeeVal)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-rose-500/80 font-bold">{t('* يتم احتسابه وإضافته تلقائياً لقيمتي "تأمين اجتماعي" والـ "الجزاءات والخصومات الأخرى" أدناه بناءً على إعدادات الاستقطاعات النشطة في كارت الموظف.')}</p>
                    </div>
                  )}

                  {/* Penalties (otherDeductions) */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2 font-black">{t('الجزاءات والخصومات الأخرى (خصم مالي)')}</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-red-500 outline-none font-bold tabular-nums dark:text-white text-red-600" 
                      value={formData.otherDeductions || 0} 
                      onChange={(e) => setFormData({...formData, otherDeductions: Number(e.target.value) || 0})} 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('سداد سلف')}</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-red-500 outline-none font-bold tabular-nums dark:text-white text-red-605" 
                      value={formData.loans || 0} 
                      onChange={(e) => setFormData({...formData, loans: Number(e.target.value) || 0})} 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('تأمين اجتماعي')}</label>
                    <input 
                      type="number" 
                      step="0.5"
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-red-500 outline-none font-bold tabular-nums dark:text-white text-red-600" 
                      value={formData.socialInsurance || 0} 
                      onChange={(e) => setFormData({...formData, socialInsurance: Number(e.target.value) || 0})} 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('ضريبة كسب العمل')}</label>
                    <input 
                      type="number" 
                      step="0.1"
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-red-500 outline-none font-bold tabular-nums dark:text-white text-red-600" 
                      value={formData.taxValue || 0} 
                      onChange={(e) => setFormData({...formData, taxValue: Number(e.target.value) || 0})} 
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('خصم التأخير والانصراف المبكر')}</label>
                    <input 
                      type="number" 
                      step="0.01"
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-red-500 outline-none font-bold tabular-nums dark:text-white text-red-600" 
                      value={formData.departureDelayDeduction || 0} 
                      onChange={(e) => setFormData({...formData, departureDelayDeduction: Number(e.target.value) || 0})} 
                    />
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-3 pt-6">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">{t('ملاحظات / Notes')}</label>
                    <textarea 
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-[2rem] focus:border-blue-500 outline-none font-bold h-28 dark:text-white" 
                      value={formData.notes || ''} 
                      onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-8 shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-6 justify-center md:justify-start">
                    <div className="text-center md:text-right">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('إجمالي المستحقات / Income')}</p>
                      <p className="text-xl font-black text-emerald-650 dark:text-emerald-400 tabular-nums">{formatCurrency(calculateTotals(formData).totalIncome)}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                    <div className="text-center md:text-right">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('إجمالي الاستقطاعات / Deductions')}</p>
                      <p className="text-xl font-black text-red-650 dark:text-red-400 tabular-nums">{formatCurrency(calculateTotals(formData).totalDeductions)}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                    <div className="text-center md:text-right">
                      <p className="text-[10px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-widest">{t('صافي الراتب / Net Salary')}</p>
                      <p className="text-3xl font-black text-blue-600 dark:text-blue-400 tabular-nums tracking-tighter">{formatCurrency(calculateTotals(formData).netSalary)}</p>
                    </div>
                  </div>
                  <button type="submit" className="w-full md:w-auto px-16 py-5 bg-blue-500 hover:bg-blue-600 text-white font-black rounded-3xl transition-all shadow-xl shadow-blue-500/20 active:scale-95 uppercase tracking-widest text-xs">{t('حفظ الحركة الشهرية')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title={t('تأكيد حذف الحركة')}
        description={t('هل أنت متأكد من حذف هذه الحركة؟ لا يمكن التراجع عن هذا الإجراء.')}
      />

      {/* Audit Trail Logs Modal */}
      <AnimatePresence>
        {isAuditModalOpen && auditTargetTx && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto no-print">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-100 dark:border-slate-800 max-w-2xl w-full overflow-hidden text-right"
              dir="rtl"
            >
              <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <HistoryIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('سجل تعديلات الحركة المالية')}</h3>
                    <p className="text-xs text-slate-400 font-bold">
                      للموظف: {employees.find(e => e.id === auditTargetTx.employeeId)?.name || t('غير معروف')}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsAuditModalOpen(false);
                    setAuditTargetTx(null);
                  }} 
                  className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {auditLogs.filter(log => log.entityId === auditTargetTx.id).length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                    <Clock3 className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-3 animate-pulse" />
                    <p className="font-bold text-slate-500 dark:text-slate-400 text-sm">{t('لا توجد سجلات تعديل مسجلة لهذه الحركة.')}</p>
                    <p className="text-xs text-slate-400 mt-1">{t('تم إنشاء هذه الحركة قبل تفعيل ميزة التدقيق أو بواسطة النظام مباشرة.')}</p>
                  </div>
                ) : (
                  <div className="relative border-r-2 border-slate-100 dark:border-slate-800 pr-6 space-y-8">
                    {auditLogs
                      .filter(log => log.entityId === auditTargetTx.id)
                      .map((log) => {
                        const isUpdate = log.action === 'update_entity';
                        const isCreate = log.action === 'create_entity';
                        let detailsObj: any = {};
                        try {
                          detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                        } catch (e) {}

                        return (
                          <div key={log.id} className="relative">
                            {/* Dot indicator */}
                            <div className={cn(
                              "absolute -right-[31px] top-1 w-4 h-4 rounded-full border-4 border-white dark:border-slate-900",
                              isCreate ? "bg-emerald-500 shadow-md shadow-emerald-500/30" : 
                              isUpdate ? "bg-amber-500 shadow-md shadow-amber-500/30" : "bg-red-500"
                            )} />
                            
                            <div className="space-y-2">
                              <div className="flex items-center gap-3">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight",
                                  isCreate ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600" :
                                  isUpdate ? "bg-amber-50 dark:bg-amber-950/20 text-amber-600" : "bg-red-50 text-red-600"
                                )}>
                                  {isCreate ? t('عملية إنشاء') : isUpdate ? t('عملية تعديل') : t('عملية حذف')}
                                </span>
                                <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                                  بواسطة: {log.userName || t('موظف مجهول')}
                                </span>
                                <span className="text-[10px] text-slate-400 font-bold tabular-nums mr-auto">
                                  {formatDateTime12h(log.timestamp, { lang: language })}
                                </span>
                              </div>

                              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100/50 dark:border-slate-800/40 text-xs text-slate-600 dark:text-slate-400 space-y-1">
                                {detailsObj.ip && (
                                  <p className="font-mono text-[10px] text-slate-400">IP address: {detailsObj.ip}</p>
                                )}
                                {detailsObj.fieldsModified && detailsObj.fieldsModified.length > 0 && (
                                  <div>
                                    <p className="font-semibold text-slate-700 dark:text-slate-300">{t('الحقول المعدلة:')}</p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {detailsObj.fieldsModified.map((f: string) => {
                                        // Dictionary translate
                                        const arabMap: Record<string, string> = {
                                          actualWorkDays: t('أيام العمل الفعلية'),
                                          basicSalary: t('الراتب الأساسي'),
                                          housingAllowance: t('بدل السكن'),
                                          transportAllowance: t('بدل النقل'),
                                          subsistenceAllowance: t('بدل الإعاشة'),
                                          mobileAllowance: t('بدل الجوال'),
                                          managementAllowance: t('بدل الإدارة'),
                                          otherAllowances: t('بدلات أخرى'),
                                          overtimeHours: t('ساعات الإضافي'),
                                          overtimeValue: t('قيمة الإضافي'),
                                          salaryIncrease: t('زيادة راتب'),
                                          otherIncome: t('دخل آخر'),
                                          socialInsurance: t('تأمين اجتماعي'),
                                          salaryReceived: t('استلام راتب'),
                                          loans: t('سلف'),
                                          deductionHours: t('ساعات الخصم'),
                                          absenceDays: t('أيام الغياب'),
                                          absenceDeduction: t('خصم الغياب'),
                                          notes: t('ملاحظات')
                                        };
                                        return (
                                          <span key={f} className="bg-slate-200/50 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                            {arabMap[f] || f}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-slate-50 dark:border-slate-800 bg-slate-50/20 dark:bg-slate-800/10 flex justify-end">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAuditModalOpen(false);
                    setAuditTargetTx(null);
                  }}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-all"
                >{t('إغلاق النافذة')}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sync Summary Modal */}
      <AnimatePresence>
        {syncSummaryModal?.isOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSyncSummaryModal(null)} 
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-border"
            >
              <div className="p-6 border-b border-border bg-emerald-500/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-md shadow-emerald-500/20">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-foreground">{syncSummaryModal.title}</h3>
                    <p className="text-xs text-muted-foreground font-bold">{selectedMonth}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSyncSummaryModal(null)} 
                  className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto custom-scrollbar">
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {syncSummaryModal.message}
                </p>

                {/* Statistics Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-muted/40 p-4 rounded-2xl border border-border text-center">
                    <p className="text-xs font-bold text-muted-foreground mb-1">{t('إجمالي الموظفين')}</p>
                    <p className="text-2xl font-black text-foreground tabular-nums">{syncSummaryModal.totalCount}</p>
                  </div>
                  <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/20 text-center">
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mb-1">{t('حركات محدثة')}</p>
                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{syncSummaryModal.updatedCount}</p>
                  </div>
                  <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20 text-center">
                    <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">{t('حركات جديدة (منع التكرار)')}</p>
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{syncSummaryModal.createdCount}</p>
                  </div>
                </div>

                {/* Synced Employees Table */}
                {syncSummaryModal.syncedResults && syncSummaryModal.syncedResults.length > 0 && (
                  <div className="border border-border rounded-2xl overflow-hidden mt-4">
                    <div className="bg-muted/60 px-4 py-2.5 text-xs font-black text-muted-foreground">
                      {t('تفاصيل الموظفين المرحلة بياناتهم')}
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-border text-xs">
                      {syncSummaryModal.syncedResults.map((r: any) => (
                        <div key={r.employeeId} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                          <div>
                            <span className="font-black text-foreground">{r.employeeName}</span>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              {r.penalties > 0 && <span className="text-red-500">{t('جزاءات')}: {formatCurrency(r.penalties)}</span>}
                              {r.loans > 0 && <span className="text-amber-500">{t('سلف')}: {formatCurrency(r.loans)}</span>}
                              {r.si > 0 && <span>{t('تأمينات')}: {formatCurrency(r.si)}</span>}
                              {r.tax > 0 && <span>{t('ضرائب')}: {formatCurrency(r.tax)}</span>}
                            </div>
                          </div>
                          <div className="text-left">
                            <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm tabular-nums">
                              {formatCurrency(r.netSalary)}
                            </span>
                            <p className="text-[10px] text-muted-foreground">{t('صافي المستحق')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-border bg-muted/20 flex justify-end gap-3">
                <button 
                  type="button"
                  onClick={() => setSyncSummaryModal(null)}
                  className="px-6 py-2.5 bg-primary text-primary-foreground font-black text-xs rounded-xl shadow-md hover:bg-primary/90 transition-all"
                >
                  {t('تم، إغلاق')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Monthly Attendance Details Modal */}
      <MonthlyAttendanceDetailsModal
        isOpen={isAttendanceModalOpen}
        onClose={() => {
          setIsAttendanceModalOpen(false);
          setAttendanceModalEmployee(null);
        }}
        employee={attendanceModalEmployee}
        month={attendanceModalMonth}
        attendanceRecords={attendanceRecords}
        attendanceShifts={attendanceShifts}
        missions={missions}
        leaveRequests={leaveRequests}
        absenceRecords={absenceRecords}
        absenceTypes={absenceTypes}
        administrativeNotices={administrativeNotices}
      />
    </div>
  );
};
