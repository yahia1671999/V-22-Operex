import React, { useState, useMemo } from 'react';
import { 
  X, 
  Calculator, 
  ArrowUpRight, 
  ArrowDownRight, 
  Info, 
  HelpCircle, 
  FileText, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  Printer, 
  Copy, 
  Search,
  Scale,
  DollarSign,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  Plane,
  AlertTriangle,
  Receipt,
  Fingerprint
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Employee, Transaction, SystemSettings } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';

export interface CalculationItem {
  id: string;
  name: string;
  nameEn: string;
  type: 'earning' | 'deduction' | 'summary';
  category: string;
  source: string;
  originalValue: number | string;
  originalValueFormatted?: string;
  formula: string;
  unitsUsed: string;
  finalAmount: number;
  notes?: string;
  isApplied: boolean;
}

interface CalculationBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  transaction: Partial<Transaction> | null;
  month: string;
  systemSettings?: SystemSettings;
  onViewAttendanceDetails?: () => void;
  extraContext?: {
    penaltiesList?: any[];
    missionsList?: any[];
    leavesList?: any[];
    loansList?: any[];
    deductionTypesList?: any[];
    attendanceRecordsCount?: number;
    shiftInfo?: any;
  };
}

export const CalculationBreakdownModal: React.FC<CalculationBreakdownModalProps> = ({
  isOpen,
  onClose,
  employee,
  transaction,
  month,
  systemSettings,
  onViewAttendanceDetails,
  extraContext
}) => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar' || !language;
  const [activeFilter, setActiveFilter] = useState<'all' | 'earnings' | 'deductions' | 'summary'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Compute breakdown line items
  const calculationItems: CalculationItem[] = useMemo(() => {
    if (!employee || !transaction) return [];

    const basicSalary = Number(transaction.basicSalary || employee.basicSalary || 0);
    const housingAllowance = Number(transaction.housingAllowance || employee.housingAllowance || 0);
    const transportAllowance = Number(transaction.transportAllowance || employee.transportAllowance || 0);
    const subsistenceAllowance = Number(transaction.subsistenceAllowance || employee.subsistenceAllowance || 0);
    const mobileAllowance = Number(transaction.mobileAllowance || employee.mobileAllowance || 0);
    const managementAllowance = Number(transaction.managementAllowance || employee.managementAllowance || 0);
    const otherAllowances = Number(transaction.otherAllowances || employee.otherAllowances || 0);
    const missionAllowance = Number(transaction.missionAllowance || 0);
    const overtimeHours = Number(transaction.overtimeHours || 0);
    const overtimeValue = Number(transaction.overtimeValue || 0);
    const otherIncome = Number(transaction.otherIncome || 0);
    const salaryIncrease = Number(transaction.salaryIncrease || 0);

    const dailyWorkHours = Number(transaction.dailyWorkHours || employee.dailyWorkHours || 8);
    const absenceDays = Number(transaction.absenceDays || 0);
    const unpaidLeaveDays = Number(transaction.unpaidLeaveDays || 0);
    const deductionHours = Number(transaction.deductionHours || 0);
    const departureDelayDeduction = Number(transaction.departureDelayDeduction || 0);
    const socialInsurance = Number(transaction.socialInsurance || 0);
    const taxValue = Number(transaction.taxValue || 0);
    const loans = Number(transaction.loans || 0);
    const otherDeductions = Number(transaction.otherDeductions || 0);

    // Derived gross and deductible base
    const grossBase = basicSalary + housingAllowance + transportAllowance + subsistenceAllowance + mobileAllowance + managementAllowance + otherAllowances + missionAllowance;
    const deductibleSalary = Math.max(0, grossBase - housingAllowance);
    const dailyDeductionRate = deductibleSalary > 0 ? (deductibleSalary / 30) : 0;
    const basicHourRate = dailyWorkHours > 0 ? (basicSalary / (30 * dailyWorkHours)) : 0;
    const overtimeBase = (transaction as any).overtimeBaseSalary !== undefined ? Number((transaction as any).overtimeBaseSalary) : basicSalary;
    const hourlyOvertimeBase = dailyWorkHours > 0 ? (overtimeBase / (30 * dailyWorkHours)) : 0;

    const items: CalculationItem[] = [];

    // 1. Basic Salary
    items.push({
      id: 'basicSalary',
      name: isRtl ? 'الراتب الأساسي' : 'Basic Salary',
      nameEn: 'Basic Salary',
      type: 'earning',
      category: isRtl ? 'الراتب التعاقدي' : 'Contractual Salary',
      source: isRtl ? 'عقد العمل / ملف الموظف' : 'Employment Contract / Employee Profile',
      originalValue: basicSalary,
      originalValueFormatted: formatCurrency(basicSalary),
      formula: isRtl ? 'قيمة الراتب الأساسي التعاقدي الشهري (30 يوماً عمل تعاقدي)' : 'Contractual monthly basic salary (30 calendar work days)',
      unitsUsed: isRtl ? '30 يوماً / شهر تعاقدي كامل' : '30 days / full contractual month',
      finalAmount: basicSalary,
      notes: isRtl ? 'الأساس المعتمد لحساب التأمينات، أجر الساعة، ونهاية الخدمة' : 'Primary base for insurance, hourly base, and severance benefits',
      isApplied: basicSalary > 0
    });

    // 2. Housing Allowance
    if (housingAllowance > 0 || employee.housingAllowance) {
      items.push({
        id: 'housingAllowance',
        name: isRtl ? 'بدل السكن' : 'Housing Allowance',
        nameEn: 'Housing Allowance',
        type: 'earning',
        category: isRtl ? 'البدلات الثابتة' : 'Fixed Allowances',
        source: isRtl ? 'ملف الموظف التعاقدي' : 'Employee Contract Profile',
        originalValue: housingAllowance,
        originalValueFormatted: formatCurrency(housingAllowance),
        formula: isRtl ? 'بدل سكن شهري ثابت (يُستبعد نظاماً من الراتب الخاضع للاستقطاع عند الغياب)' : 'Fixed monthly housing allowance (Excluded from deductible salary on absence)',
        unitsUsed: isRtl ? '1 شهر تعاقدي' : '1 contractual month',
        finalAmount: housingAllowance,
        notes: isRtl ? 'يتم صرفه بالكامل ولا يُخصم منه مقابل أيام الغياب غير المبررة' : 'Paid in full; shielded from absence deductions',
        isApplied: housingAllowance > 0
      });
    }

    // 3. Transport Allowance
    if (transportAllowance > 0 || employee.transportAllowance) {
      items.push({
        id: 'transportAllowance',
        name: isRtl ? 'بدل الانتقال / المواصلات' : 'Transport Allowance',
        nameEn: 'Transport Allowance',
        type: 'earning',
        category: isRtl ? 'البدلات الثابتة' : 'Fixed Allowances',
        source: isRtl ? 'ملف الموظف التعاقدي' : 'Employee Contract Profile',
        originalValue: transportAllowance,
        originalValueFormatted: formatCurrency(transportAllowance),
        formula: isRtl ? 'قيمة بدل الانتقال الشهري المعتمد في العقد' : 'Monthly transport allowance per contract',
        unitsUsed: isRtl ? '1 شهر' : '1 month',
        finalAmount: transportAllowance,
        isApplied: transportAllowance > 0
      });
    }

    // 4. Subsistence Allowance
    if (subsistenceAllowance > 0 || employee.subsistenceAllowance) {
      items.push({
        id: 'subsistenceAllowance',
        name: isRtl ? 'بدل الإعاشة / الغذاء' : 'Subsistence Allowance',
        nameEn: 'Subsistence Allowance',
        type: 'earning',
        category: isRtl ? 'البدلات الثابتة' : 'Fixed Allowances',
        source: isRtl ? 'ملف الموظف التعاقدي' : 'Employee Contract Profile',
        originalValue: subsistenceAllowance,
        originalValueFormatted: formatCurrency(subsistenceAllowance),
        formula: isRtl ? 'قيمة بدل الإعاشة والوجبات الشهري المعتمد' : 'Monthly subsistence allowance per contract',
        unitsUsed: isRtl ? '1 شهر' : '1 month',
        finalAmount: subsistenceAllowance,
        isApplied: subsistenceAllowance > 0
      });
    }

    // 5. Mobile Allowance
    if (mobileAllowance > 0 || employee.mobileAllowance) {
      items.push({
        id: 'mobileAllowance',
        name: isRtl ? 'بدل الاتصالات / الهاتف' : 'Mobile Allowance',
        nameEn: 'Mobile Allowance',
        type: 'earning',
        category: isRtl ? 'البدلات الثابتة' : 'Fixed Allowances',
        source: isRtl ? 'ملف الموظف التعاقدي' : 'Employee Contract Profile',
        originalValue: mobileAllowance,
        originalValueFormatted: formatCurrency(mobileAllowance),
        formula: isRtl ? 'بدل اتصالات شهري ثابت لمتابعة الأعمال' : 'Monthly communication allowance',
        unitsUsed: isRtl ? '1 شهر' : '1 month',
        finalAmount: mobileAllowance,
        isApplied: mobileAllowance > 0
      });
    }

    // 6. Management Allowance
    if (managementAllowance > 0 || employee.managementAllowance) {
      items.push({
        id: 'managementAllowance',
        name: isRtl ? 'بدل الإدارة / المسؤولية' : 'Management Allowance',
        nameEn: 'Management Allowance',
        type: 'earning',
        category: isRtl ? 'البدلات الثابتة' : 'Fixed Allowances',
        source: isRtl ? 'ملف الموظف التعاقدي' : 'Employee Contract Profile',
        originalValue: managementAllowance,
        originalValueFormatted: formatCurrency(managementAllowance),
        formula: isRtl ? 'بدل المنصب والمسؤولية الإدارية المقررة بالهيكل' : 'Executive / management responsibility allowance',
        unitsUsed: isRtl ? '1 شهر' : '1 month',
        finalAmount: managementAllowance,
        isApplied: managementAllowance > 0
      });
    }

    // 7. Other Allowances
    if (otherAllowances > 0 || employee.otherAllowances) {
      items.push({
        id: 'otherAllowances',
        name: isRtl ? 'بدلات تعاقدية أخرى' : 'Other Contractual Allowances',
        nameEn: 'Other Allowances',
        type: 'earning',
        category: isRtl ? 'البدلات الثابتة' : 'Fixed Allowances',
        source: isRtl ? 'ملف الموظف التعاقدي' : 'Employee Contract Profile',
        originalValue: otherAllowances,
        originalValueFormatted: formatCurrency(otherAllowances),
        formula: isRtl ? 'إجمالي البدلات الإضافية المعتمدة بملف الموظف' : 'Sum of other allowances in employee profile',
        unitsUsed: isRtl ? '1 شهر' : '1 month',
        finalAmount: otherAllowances,
        isApplied: otherAllowances > 0
      });
    }

    // 8. Mission Allowance
    if (missionAllowance > 0 || (extraContext?.missionsList && extraContext.missionsList.length > 0)) {
      const missionCount = extraContext?.missionsList?.length || 0;
      items.push({
        id: 'missionAllowance',
        name: isRtl ? 'بدل المأموريات المعتمدة' : 'Approved Mission Allowance',
        nameEn: 'Mission Allowance',
        type: 'earning',
        category: isRtl ? 'المستحقات المتغيرة' : 'Variable Earnings',
        source: isRtl ? 'طلبات المأموريات المعتمدة' : 'Approved Mission Orders',
        originalValue: missionAllowance,
        originalValueFormatted: formatCurrency(missionAllowance),
        formula: isRtl ? 'مجموع (عدد أيام كل مأمورية معتمدة × بدل اليوم المقرر)' : 'Sum of (Approved mission days × daily mission rate)',
        unitsUsed: isRtl ? `${missionCount > 0 ? missionCount + ' مأمورية معتمدة' : 'مأموريات معتمدة للشهر'}` : `${missionCount} approved missions`,
        finalAmount: missionAllowance,
        notes: isRtl ? 'مستحق مصروف وفق اعتمادات إدارة التشغيل والموارد البشرية' : 'Disbursed per approved operational mission orders',
        isApplied: missionAllowance > 0
      });
    }

    // 9. Overtime
    if (overtimeHours > 0 || overtimeValue > 0) {
      items.push({
        id: 'overtimeValue',
        name: isRtl ? 'أجر العمل الإضافي (Overtime)' : 'Overtime Pay',
        nameEn: 'Overtime Pay',
        type: 'earning',
        category: isRtl ? 'المستحقات المتغيرة' : 'Variable Earnings',
        source: isRtl ? 'سجلات ساعات العمل الإضافي المعتمدة' : 'Approved Overtime Records',
        originalValue: hourlyOvertimeBase,
        originalValueFormatted: `${formatCurrency(hourlyOvertimeBase)} / ${isRtl ? 'ساعة أساسية' : 'base hour'}`,
        formula: isRtl 
          ? `(أساس أجر الإضافي [${formatCurrency(overtimeBase)}] ÷ 30 يوم ÷ ${dailyWorkHours} ساعات) × 1.5 (معامل إضافي) × ${overtimeHours} ساعة`
          : `(${formatCurrency(overtimeBase)} / 30 / ${dailyWorkHours}) × 1.5 × ${overtimeHours} hrs`,
        unitsUsed: isRtl ? `${overtimeHours} ساعة عمل إضافي معتمدة` : `${overtimeHours} approved overtime hours`,
        finalAmount: overtimeValue,
        notes: isRtl ? 'يتم تطبيق معامل 1.5x على أجر الساعة طبقاً لقانون العمل' : 'Standard 1.5x overtime multiplier applied',
        isApplied: overtimeValue > 0
      });
    }

    // 10. Other Income & Salary Increase
    if (otherIncome > 0 || salaryIncrease > 0) {
      const combinedExtra = otherIncome + salaryIncrease;
      items.push({
        id: 'otherIncome',
        name: isRtl ? 'مكافآت وإضافات أخرى' : 'Bonuses & Other Earnings',
        nameEn: 'Other Earnings',
        type: 'earning',
        category: isRtl ? 'المستحقات المتغيرة' : 'Variable Earnings',
        source: isRtl ? 'تسويات ومكافآت مالية معتمدة' : 'Approved Bonuses & Adjustments',
        originalValue: combinedExtra,
        originalValueFormatted: formatCurrency(combinedExtra),
        formula: isRtl ? 'مكافآت تشجيعية، زيادات استثنائية، أو تسويات مالية موجبة' : 'Incentive bonuses, extraordinary increments or adjustments',
        unitsUsed: isRtl ? 'تسوية شهرية' : 'Monthly adjustment',
        finalAmount: combinedExtra,
        isApplied: combinedExtra > 0
      });
    }

    // --- DEDUCTIONS ---

    // 11. Absence Deduction (الغياب بدون مرتب)
    if (absenceDays > 0 || (transaction.absenceDeduction && transaction.absenceDeduction > 0)) {
      const absVal = Number(transaction.absenceDeduction || (dailyDeductionRate * absenceDays));
      items.push({
        id: 'absenceDeduction',
        name: isRtl ? 'استقطاع الغياب بدون مرتب' : 'Unpaid Absence Deduction',
        nameEn: 'Unpaid Absence Deduction',
        type: 'deduction',
        category: isRtl ? 'استقطاعات الدوام والحضور' : 'Attendance Deductions',
        source: isRtl ? 'سجلات الحضور والانصراف والبصمة (الأيام الفعلية غير المسجلة)' : 'Biometric Attendance Logs (Actual Absent Days)',
        originalValue: dailyDeductionRate,
        originalValueFormatted: `${formatCurrency(dailyDeductionRate)} / ${isRtl ? 'يوم خاضع للاستقطاع' : 'deductible day'}`,
        formula: isRtl 
          ? `(الراتب الخاضع للاستقطاع [الراتب الشامل (${formatCurrency(grossBase)}) - بدل السكن (${formatCurrency(housingAllowance)}) = ${formatCurrency(deductibleSalary)}] ÷ 30) × ${absenceDays} يوم غياب فعلي`
          : `((Gross [${formatCurrency(grossBase)}] - Housing [${formatCurrency(housingAllowance)}]) / 30) × ${absenceDays} actual absent days`,
        unitsUsed: isRtl ? `${absenceDays} يوم غياب فعلي` : `${absenceDays} actual absent days`,
        finalAmount: absVal,
        notes: isRtl 
          ? 'يتم احتساب الأيام الفعلية فقط للغياب غير المبرر. تم استبعاد بدل السكن من الراتب الخاضع للاستقطاع كمعيار إداري معتمد. أيام العمل عن بعد والمأموريات المعتمدة لا تُحتسب غياباً.' 
          : 'Calculates actual absent days only. Housing allowance is protected from absence pro-ration. Approved Remote & Mission days are credited without deduction.',
        isApplied: absVal > 0
      });
    }

    // 12. Unpaid Leave Deduction (الإجازة بدون مرتب)
    if (unpaidLeaveDays > 0 || (transaction.unpaidLeaveDeduction && transaction.unpaidLeaveDeduction > 0)) {
      const unpaidVal = Number(transaction.unpaidLeaveDeduction || (dailyDeductionRate * unpaidLeaveDays));
      items.push({
        id: 'unpaidLeaveDeduction',
        name: isRtl ? 'استقطاع الإجازة بدون مرتب' : 'Unpaid Leave Deduction',
        nameEn: 'Unpaid Leave Deduction',
        type: 'deduction',
        category: isRtl ? 'استقطاعات الإجازات' : 'Leave Deductions',
        source: isRtl ? 'طلبات الإجازات المعتمدة (بدون مرتب أو المتجاوزة للرصيد المتاح)' : 'Approved Unpaid or Excess Leave Requests',
        originalValue: dailyDeductionRate,
        originalValueFormatted: `${formatCurrency(dailyDeductionRate)} / ${isRtl ? 'يوم' : 'day'}`,
        formula: isRtl 
          ? `(الراتب الخاضع للاستقطاع [الراتب الشامل (${formatCurrency(grossBase)}) - بدل السكن (${formatCurrency(housingAllowance)}) = ${formatCurrency(deductibleSalary)}] ÷ 30) × ${unpaidLeaveDays} يوم إجازة بدون مرتب`
          : `((Gross [${formatCurrency(grossBase)}] - Housing [${formatCurrency(housingAllowance)}]) / 30) × ${unpaidLeaveDays} unpaid leave days`,
        unitsUsed: isRtl ? `${unpaidLeaveDays} يوم إجازة بدون مرتب فعلية` : `${unpaidLeaveDays} actual unpaid leave days`,
        finalAmount: unpaidVal,
        notes: isRtl 
          ? 'يتم احتساب الأيام الفعلية المعتمدة فقط للإجازات غير المدفوعة أو المتجاوزة للرصيد السنوي. الإجازات الاعتيادية ضمن الرصيد لا يتم خصمها من الراتب.' 
          : 'Calculates actual approved unpaid days only. Approved regular leaves within balance are fully paid and deducted solely from leave balance.',
        isApplied: unpaidVal > 0
      });
    }

    // 13. Departure Delay / Late Arrival Deduction
    if (deductionHours > 0 || departureDelayDeduction > 0) {
      const delayVal = Number(departureDelayDeduction || (deductionHours * basicHourRate));
      const totalMinutes = Math.round(deductionHours * 60);
      items.push({
        id: 'departureDelayDeduction',
        name: isRtl ? 'استقطاع ساعات التأخير والانصراف المبكر' : 'Delay & Early Departure Deduction',
        nameEn: 'Delay Deduction',
        type: 'deduction',
        category: isRtl ? 'استقطاعات الدوام والحضور' : 'Attendance Deductions',
        source: isRtl ? 'بصمات الحضور والانصراف ومطابقة الوردية' : 'Attendance Punch vs Shift Schedule',
        originalValue: basicHourRate,
        originalValueFormatted: `${formatCurrency(basicHourRate)} / ${isRtl ? 'ساعة أساسية' : 'base hour'}`,
        formula: isRtl 
          ? `(الراتب الأساسي [${formatCurrency(basicSalary)}] ÷ (30 يوم × ${dailyWorkHours} ساعات)) × ${deductionHours} ساعة تأخير`
          : `(${formatCurrency(basicSalary)} / (30 × ${dailyWorkHours})) × ${deductionHours} delay hours`,
        unitsUsed: isRtl ? `${deductionHours} ساعة (${totalMinutes} دقيقة)` : `${deductionHours} hrs (${totalMinutes} mins)`,
        finalAmount: delayVal,
        notes: isRtl ? 'يتم احتسابه بعد استنفاد فترة السماح الرسمية للوردية' : 'Calculated after exceeding official shift grace period',
        isApplied: delayVal > 0
      });
    }

    // 14. Penalties
    const penaltiesSum = extraContext?.penaltiesList?.reduce((s, p) => s + (p.penaltyType === 'Amount Deduction' ? Number(p.deductionValue || 0) : Number(((basicSalary / 30) * Number(p.deductionValue || 0)).toFixed(2))), 0) || 0;
    if (penaltiesSum > 0 || (extraContext?.penaltiesList && extraContext.penaltiesList.length > 0)) {
      const penCount = extraContext?.penaltiesList?.length || 0;
      items.push({
        id: 'penaltiesDeduction',
        name: isRtl ? 'الجزاءات الإدارية والمالية المعتمدة' : 'Administrative Penalties',
        nameEn: 'Penalties',
        type: 'deduction',
        category: isRtl ? 'استقطاعات إدارية وقانونية' : 'Administrative Deductions',
        source: isRtl ? 'سجل الجزاءات المعتمدة (بعد حسم التظلمات)' : 'Approved Penalties (Post-Grievance)',
        originalValue: penaltiesSum,
        originalValueFormatted: formatCurrency(penaltiesSum),
        formula: isRtl ? 'مجموع الجزاءات المباشرة + (أيام الجزاء المعتمدة × أجر اليوم الأساسي)' : 'Sum of Direct Amounts + (Penalty Days × Basic Daily Rate)',
        unitsUsed: isRtl ? `${penCount} جزاء معتمد للشهر` : `${penCount} approved penalties`,
        finalAmount: penaltiesSum,
        notes: isRtl ? 'مبنية على قرارات التحقيق الإداري والتظلمات المعتمدة' : 'Enforced per formal HR investigation and approved grievance rulings',
        isApplied: penaltiesSum > 0
      });
    }

    // 15. Loans & Advances
    if (loans > 0 || (extraContext?.loansList && extraContext.loansList.length > 0)) {
      items.push({
        id: 'loans',
        name: isRtl ? 'سداد أقساط السلف والمساعدات المالية' : 'Loan Repayments & Advances',
        nameEn: 'Loan Repayments',
        type: 'deduction',
        category: isRtl ? 'استقطاعات مالية وسلف' : 'Financial Deductions',
        source: isRtl ? 'سجل السلف والمساعدات المالية المعتمدة' : 'Approved Loans & Advances Ledger',
        originalValue: loans,
        originalValueFormatted: formatCurrency(loans),
        formula: isRtl ? 'استقطاع القسط الشهري المعتمد للسلفة الممنوحة' : 'Deduction of the approved monthly installment',
        unitsUsed: isRtl ? '1 قسط شهري مستحق' : '1 monthly installment due',
        finalAmount: loans,
        notes: isRtl ? 'يتم خصمه آلياً وتحديث الرصيد المتبقي على الموظف' : 'Deducted automatically and balance is updated in loan ledger',
        isApplied: loans > 0
      });
    }

    // 16. Social Insurance
    if (socialInsurance > 0 || String(employee.subjectToSi).toLowerCase() === 'yes' || String(employee.subjectToSi).toLowerCase() === 'true') {
      items.push({
        id: 'socialInsurance',
        name: isRtl ? 'اشتراك التأمينات الاجتماعية (حصة الموظف)' : 'Social Insurance (Employee Share)',
        nameEn: 'Social Insurance',
        type: 'deduction',
        category: isRtl ? 'استقطاعات قانونية وتأمينية' : 'Statutory & Insurance',
        source: isRtl ? 'لائحة الاستقطاعات المعتمدة + خضوع الموظف للتأمين' : 'Deduction Master Types + SI Eligibility',
        originalValue: grossBase,
        originalValueFormatted: `${isRtl ? 'وعاء التأمين' : 'SI Base'}: ${formatCurrency(grossBase)}`,
        formula: isRtl ? 'حصة الموظف المقررة في لائحة التأمينات الاجتماعية (طبقاً للنسبة أو الشريحة)' : 'Employee statutory share defined in Deduction Rules',
        unitsUsed: isRtl ? 'اشتراك شهري قانوني' : 'Monthly statutory share',
        finalAmount: socialInsurance,
        notes: isRtl ? `حالة الخضوع في ملف الموظف: ${employee.subjectToSi === 'No' ? 'معفى / غير خاضع' : 'خاضع للتأمينات'}` : `Profile status: ${employee.subjectToSi === 'No' ? 'Exempt' : 'Subject to SI'}`,
        isApplied: socialInsurance > 0
      });
    }

    // 17. Income Tax
    if (taxValue > 0 || String(employee.subjectToTax).toLowerCase() === 'yes' || String(employee.subjectToTax).toLowerCase() === 'true') {
      items.push({
        id: 'taxValue',
        name: isRtl ? 'ضريبة كسب العمل / الدخل' : 'Income Tax Deduction',
        nameEn: 'Income Tax',
        type: 'deduction',
        category: isRtl ? 'استقطاعات قانونية وضريبية' : 'Statutory & Tax',
        source: isRtl ? 'لائحة الضرائب المعتمدة + خضوع الموظف للضريبة' : 'Tax Master Rules + Tax Eligibility',
        originalValue: grossBase,
        originalValueFormatted: `${isRtl ? 'الوعاء الضريبي' : 'Taxable Income'}: ${formatCurrency(grossBase)}`,
        formula: isRtl ? 'الشريحة الضريبية المطبقة على وعاء الدخل بعد خصم الإعفاءات المقررة' : 'Applicable tax bracket on taxable earnings post statutory exemptions',
        unitsUsed: isRtl ? 'ضريبة شهرية مستحقة' : 'Monthly tax levy',
        finalAmount: taxValue,
        notes: isRtl ? `حالة الخضوع في ملف الموظف: ${employee.subjectToTax === 'No' ? 'معفى / غير خاضع' : 'خاضع للضريبة'}` : `Profile status: ${employee.subjectToTax === 'No' ? 'Exempt' : 'Subject to Tax'}`,
        isApplied: taxValue > 0
      });
    }

    // 18. Other Deductions
    if (otherDeductions > 0) {
      items.push({
        id: 'otherDeductions',
        name: isRtl ? 'استقطاعات أخرى معتمدة' : 'Other Approved Deductions',
        nameEn: 'Other Deductions',
        type: 'deduction',
        category: isRtl ? 'استقطاعات متنوعة' : 'Miscellaneous Deductions',
        source: isRtl ? 'مسير الاستقطاعات / بنود الخصم الإدارية' : 'Deduction Payroll Master / Admin Lines',
        originalValue: otherDeductions,
        originalValueFormatted: formatCurrency(otherDeductions),
        formula: isRtl ? 'إجمالي بنود الاستقطاعات الإضافية المعتمدة للموظف' : 'Sum of other authorized deduction items',
        unitsUsed: isRtl ? 'بنود معتمدة' : 'Authorized line items',
        finalAmount: otherDeductions,
        isApplied: otherDeductions > 0
      });
    }

    return items;
  }, [employee, transaction, isRtl, extraContext]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return calculationItems.filter(item => {
      if (activeFilter === 'earnings' && item.type !== 'earning') return false;
      if (activeFilter === 'deductions' && item.type !== 'deduction') return false;
      if (activeFilter === 'summary') return true;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.nameEn.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q) ||
        item.formula.toLowerCase().includes(q) ||
        item.unitsUsed.toLowerCase().includes(q)
      );
    });
  }, [calculationItems, activeFilter, searchTerm]);

  const handleCopyExplanation = (item: CalculationItem) => {
    const text = `[${item.name}]\n- ${isRtl ? 'المصدر' : 'Source'}: ${item.source}\n- ${isRtl ? 'القيمة الأصلية' : 'Original'}: ${item.originalValueFormatted || item.originalValue}\n- ${isRtl ? 'طريقة الاحتساب' : 'Formula'}: ${item.formula}\n- ${isRtl ? 'الأيام/الساعات' : 'Units'}: ${item.unitsUsed}\n- ${isRtl ? 'الناتج النهائي' : 'Final'}: ${formatCurrency(item.finalAmount)}`;
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen || !employee || !transaction) return null;

  const totalEarnings = calculationItems.filter(i => i.type === 'earning').reduce((s, i) => s + i.finalAmount, 0);
  const totalDeductions = calculationItems.filter(i => i.type === 'deduction').reduce((s, i) => s + i.finalAmount, 0);
  const netSalary = Math.max(0, totalEarnings - totalDeductions);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[140] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose} 
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-md no-print" 
        />

        {/* Modal Window */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          exit={{ opacity: 0, scale: 0.95, y: 15 }} 
          className="relative bg-card text-foreground w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-border flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:rounded-none print:border-none"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-border bg-muted/40 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200 dark:border-indigo-800/40 shadow-sm">
                <Calculator className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl md:text-2xl font-black text-foreground">{t('تفاصيل وطرق احتساب مبالغ الراتب')}</h3>
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-black">
                    {month}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-medium mt-1">
                  {isRtl ? 'شفافية كاملة لمصادر الحركات، القيم الأصلية، المعادلات، والأيام والساعات المستخدمة' : 'Full provenance, base values, formulas, and operational units'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
              {onViewAttendanceDetails && (
                <button 
                  onClick={onViewAttendanceDetails}
                  className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 dark:bg-teal-950/30 hover:bg-teal-100 text-teal-700 dark:text-teal-300 font-black text-xs rounded-xl border border-teal-200 dark:border-teal-800/40 transition-all shadow-sm"
                  title={t('عرض تفاصيل وسجل الحضور والانصراف للشهر')}
                >
                  <Fingerprint className="w-4 h-4" />
                  <span>{t('تفاصيل الحضور الشهري')}</span>
                </button>
              )}
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2.5 bg-card hover:bg-muted text-foreground font-bold text-xs rounded-xl border border-border transition-all shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>{t('طباعة التقرير')}</span>
              </button>
              <button 
                onClick={onClose} 
                className="p-2.5 hover:bg-muted rounded-xl transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Employee Mini Card */}
          <div className="px-6 md:px-8 py-4 bg-muted/20 border-b border-border flex flex-wrap items-center justify-between gap-4 text-xs font-bold">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-black flex items-center justify-center text-sm">
                {employee.name.charAt(0)}
              </div>
              <div>
                <p className="font-black text-sm text-foreground">{employee.name}</p>
                <p className="text-muted-foreground text-[11px] tabular-nums">{employee.employeeId} • {employee.jobTitle || t('موظف')}</p>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px]">{t('أيام العمل الفعلية')}</span>
                <span className="font-black text-foreground tabular-nums text-sm">{transaction.actualWorkDays || 30} {t('يوم')}</span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div>
                <span className="text-emerald-800 dark:text-emerald-300 block text-[10px] font-bold">{t('إجمالي المستحقات')}</span>
                <span className="font-black text-emerald-800 dark:text-emerald-300 tabular-nums text-sm">+{formatCurrency(totalEarnings)}</span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div>
                <span className="text-rose-800 dark:text-rose-300 block text-[10px] font-bold">{t('إجمالي الاستقطاعات')}</span>
                <span className="font-black text-rose-800 dark:text-rose-300 tabular-nums text-sm">-{formatCurrency(totalDeductions)}</span>
              </div>
              <div className="h-6 w-px bg-border" />
              <div>
                <span className="text-primary block text-[10px] font-bold">{t('صافي الراتب المستحق')}</span>
                <span className="font-black text-primary tabular-nums text-base">{formatCurrency(netSalary)}</span>
              </div>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="px-6 md:px-8 py-3 border-b border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-2xl w-fit">
              <button 
                onClick={() => setActiveFilter('all')}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer",
                  activeFilter === 'all' 
                    ? "bg-card text-foreground shadow-xs border border-border" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t('كافة البنود')} ({calculationItems.length})
              </button>
              <button 
                onClick={() => setActiveFilter('earnings')}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                  activeFilter === 'earnings' 
                    ? "bg-emerald-600 text-white shadow-xs" 
                    : "text-emerald-800 dark:text-emerald-300 hover:text-emerald-900 dark:hover:text-emerald-200"
                )}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{t('المستحقات والبدلات')}</span>
              </button>
              <button 
                onClick={() => setActiveFilter('deductions')}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                  activeFilter === 'deductions' 
                    ? "bg-rose-600 text-white shadow-xs" 
                    : "text-rose-800 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-200"
                )}
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>{t('الاستقطاعات والخصومات')}</span>
              </button>
              <button 
                onClick={() => setActiveFilter('summary')}
                className={cn(
                  "px-4 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                  activeFilter === 'summary' 
                    ? "bg-primary text-primary-foreground shadow-xs" 
                    : "text-primary hover:text-primary/80"
                )}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>{t('ملخص القواعد والمعادلات')}</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative max-w-xs w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <input 
                type="text" 
                placeholder={t('البحث في البنود والمعادلات...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-9 pl-3 py-1.5 bg-muted/40 border border-border rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary outline-none"
              />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="p-6 md:p-8 overflow-y-auto space-y-6 custom-scrollbar flex-1">
            {/* Rules Summary Banner */}
            {activeFilter === 'summary' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-3xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-2">
                  <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-black text-sm">
                    <ShieldCheck className="w-4.5 h-4.5" />
                    <span>{isRtl ? 'قاعدة الراتب الخاضع للاستقطاع (Deductible Base)' : 'Deductible Salary Rule'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isRtl 
                      ? 'الراتب الخاضع للاستقطاع = (إجمالي الراتب الشامل - بدل السكن). يتم استبعاد بدل السكن قانونياً من وعاء خصم الغياب والإجازات دون أجر.'
                      : 'Deductible Salary = (Gross Salary - Housing Allowance). Housing allowance is strictly shielded from absence and unpaid leave deductions.'}
                  </p>
                  <div className="p-2.5 bg-card rounded-xl text-[11px] font-mono font-bold text-blue-800 dark:text-blue-300 border border-border">
                    Deductible Daily Rate = (Gross - Housing) / 30
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-800 dark:text-indigo-300 font-black text-sm">
                    <Clock className="w-4.5 h-4.5" />
                    <span>{isRtl ? 'قاعدة العمل الإضافي وساعات التأخير' : 'Overtime & Delay Hourly Rules'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isRtl 
                      ? 'أجر ساعة الإضافي = (أساس أجر الإضافي ÷ 30 ÷ ساعات الوردية) × 1.5. بينما خصم ساعات التأخير = (الأساسي ÷ 30 ÷ ساعات الوردية) × ساعات التأخير.'
                      : 'Overtime Hour Rate = (Base / 30 / Shift Hours) × 1.5. Delay Hour Rate = (Basic Salary / 30 / Shift Hours) × Delay Hours.'}
                  </p>
                  <div className="p-2.5 bg-card rounded-xl text-[11px] font-mono font-bold text-indigo-800 dark:text-indigo-300 border border-border">
                    Overtime = (Base / 30 / Hours) × 1.5 × OT_Hours
                  </div>
                </div>
              </div>
            )}

            {/* Line Items List */}
            <div className="space-y-4">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="font-bold text-sm">{t('لا توجد بنود مطابقة لخيارات البحث أو التصفية')}</p>
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isEarning = item.type === 'earning';
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={cn(
                        "p-5 md:p-6 rounded-3xl border-2 transition-all hover:shadow-md relative overflow-hidden group",
                        isEarning 
                          ? "bg-card border-emerald-500/25 dark:border-emerald-500/20 hover:border-emerald-500/50" 
                          : "bg-card border-rose-500/25 dark:border-rose-500/20 hover:border-rose-500/50"
                      )}
                    >
                      {/* Top Header: Title & Badges */}
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-border/60">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs",
                            isEarning 
                              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30" 
                              : "bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30"
                          )}>
                            {isEarning ? <ArrowUpRight className="w-5 h-5 stroke-[2.5]" /> : <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-base text-foreground">{item.name}</h4>
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider",
                                isEarning 
                                  ? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border border-emerald-500/25" 
                                  : "bg-rose-500/15 text-rose-900 dark:text-rose-300 border border-rose-500/25"
                              )}>
                                {item.category}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{item.nameEn}</p>
                          </div>
                        </div>

                        {/* Final Resulting Amount */}
                        <div className="flex items-center gap-3">
                          <div className="text-left">
                            <span className="text-[10px] font-bold text-muted-foreground block">{t('القيمة النهائية الناتجة')}</span>
                            <span className={cn(
                              "text-xl md:text-2xl font-black tabular-nums tracking-tight font-mono",
                              isEarning ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"
                            )}>
                              {isEarning ? '+' : '-'}{formatCurrency(item.finalAmount)}
                            </span>
                          </div>

                          <button 
                            type="button"
                            onClick={() => handleCopyExplanation(item)}
                            className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors no-print cursor-pointer"
                            title={t('نسخ تفاصيل وشرح الاحتساب')}
                          >
                            {copiedId === item.id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* 4-Box Provenance Matrix: Source, Original Value, Units Used, Formula */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 text-xs">
                        {/* 1. Source */}
                        <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                            {isRtl ? '📍 مصدر الحركة' : '📍 Source of Transaction'}
                          </span>
                          <span className="font-black text-foreground leading-snug block">
                            {item.source}
                          </span>
                        </div>

                        {/* 2. Original Value */}
                        <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                            {isRtl ? '💰 القيمة الأصلية / الأساس' : '💰 Base / Original Value'}
                          </span>
                          <span className="font-black text-foreground tabular-nums text-sm block font-mono">
                            {item.originalValueFormatted || formatCurrency(Number(item.originalValue) || 0)}
                          </span>
                        </div>

                        {/* 3. Days / Hours Used */}
                        <div className="p-3.5 bg-muted/40 rounded-2xl border border-border/60">
                          <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider block mb-1">
                            {isRtl ? '⏱️ عدد الأيام أو الساعات المستخدمة' : '⏱️ Days / Hours Used'}
                          </span>
                          <span className="font-black text-primary tabular-nums block font-mono">
                            {item.unitsUsed}
                          </span>
                        </div>
                      </div>

                      {/* Formula & Method Card */}
                      <div className="mt-3 p-3.5 bg-muted/40 rounded-2xl border border-border/70">
                        <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-black text-foreground">
                          <Receipt className="w-3.5 h-3.5 text-primary" />
                          <span>{isRtl ? 'المعادلة وطريقة الاحتساب المطبقة:' : 'Applied Formula & Calculation Method:'}</span>
                        </div>
                        <div className="font-mono text-xs text-primary font-bold bg-card p-2.5 rounded-xl border border-border overflow-x-auto">
                          {item.formula}
                        </div>
                        {item.notes && (
                          <p className="text-[11px] text-muted-foreground font-medium mt-2 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{item.notes}</span>
                          </p>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Total Reconciliation Summary Block (Fully adapts to Global Theme) */}
            <div className="p-6 md:p-8 rounded-[2rem] bg-slate-100 dark:bg-slate-900/90 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-700/80 shadow-md space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <Scale className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-foreground">{isRtl ? 'المعادلة الختامية الشاملة لصافي الراتب' : 'Net Salary Total Reconciliation'}</h4>
                    <p className="text-xs text-muted-foreground font-medium">
                      {isRtl ? 'صافي الراتب = إجمالي المستحقات والبدلات - إجمالي الاستقطاعات والخصومات' : 'Net Salary = Total Gross Earnings - Total Deductions'}
                    </p>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-muted-foreground font-bold uppercase block">{isRtl ? 'الصافي المستحق للصرف' : 'Final Net Payable'}</span>
                  <span className="text-3xl md:text-4xl font-black tabular-nums text-emerald-700 dark:text-emerald-400 font-mono">
                    {formatCurrency(netSalary)}
                  </span>
                </div>
              </div>

              {/* Equation line */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-card rounded-2xl border-2 border-emerald-500/30">
                  <span className="text-xs font-bold text-muted-foreground block mb-1">{isRtl ? 'إجمالي المستحقات (Earnings)' : 'Total Gross Earnings'}</span>
                  <span className="text-xl font-black text-emerald-800 dark:text-emerald-300 font-mono tabular-nums">+{formatCurrency(totalEarnings)}</span>
                </div>
                <div className="p-4 bg-card rounded-2xl border-2 border-rose-500/30">
                  <span className="text-xs font-bold text-muted-foreground block mb-1">{isRtl ? 'إجمالي الاستقطاعات (Deductions)' : 'Total Deductions'}</span>
                  <span className="text-xl font-black text-rose-800 dark:text-rose-300 font-mono tabular-nums">-{formatCurrency(totalDeductions)}</span>
                </div>
                <div className="p-4 bg-emerald-500/15 dark:bg-emerald-950/40 rounded-2xl border-2 border-emerald-500/40">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-1">{isRtl ? 'صافي المستحق (Net)' : 'Final Net'}</span>
                  <span className="text-2xl font-black text-emerald-800 dark:text-emerald-300 font-mono tabular-nums">{formatCurrency(netSalary)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-border bg-muted/40 flex justify-between items-center no-print">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{isRtl ? 'تمت مطابقة وحساب جميع الأرقام والبنود وفق اللوائح الإدارية والمالية المعتمدة' : 'All line items reconciled against approved HR and financial regulations'}</span>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-primary text-primary-foreground font-black text-xs rounded-xl shadow-md hover:bg-primary/90 transition-all"
            >
              {t('إغلاق')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
