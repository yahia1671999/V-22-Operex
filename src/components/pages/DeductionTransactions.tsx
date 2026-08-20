import React, { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../AuthContext';
import { useData } from '../../contexts/DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Briefcase, 
  Filter, 
  Search, 
  Printer, 
  Download, 
  Percent, 
  Layers, 
  TrendingDown, 
  Coins, 
  ShieldCheck, 
  RotateCcw,
  AlertCircle,
  Building,
  User,
  Users,
  ChevronDown,
  Info,
  DollarSign
} from 'lucide-react';

interface Bracket {
  name: string;
  from: string;
  to: string;
  percentage: string;
}

interface DeductionType {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  category: string;
  status: string;
  calculationMethod: string;
  fixedAmount: number;
  percentage: number;
  brackets: Bracket[] | string;
  equation: string;
  chargeType: string;
  employeePercentage: number;
  companyPercentage: number;
}

interface Employee {
  id: string;
  employeeId: string;
  name: string;
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  subsistenceAllowance: number;
  mobileAllowance: number;
  managementAllowance: number;
  allowances: any;
  departmentId: string;
  subjectToSi: string;
  subjectToTax: string;
}

interface DeductionLine {
  id: string;
  transactionId: string;
  employeeId: string;
  deductionTypeId: string;
  calculatedValue: number;
  companyValue: number;
  notes: string;
}

interface Penalty {
  id: string;
  employeeId: string;
  violationDate: string;
  deductionDays: number;
  amount: number;
  status: string;
}

interface DeductionTransaction {
  id: string;
  month: string;
  year: string;
  status: string;
}

export const DeductionTransactions: React.FC = () => {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';

  const { 
    transactions: payrollTransactions, 
    employees: allDbEmployees, 
    adminDepartments: dbDepartments 
  } = useData();

  // Filter States
  const [targetYear, setTargetYear] = useState(String(new Date().getFullYear()));
  const [targetMonth, setTargetMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [selectedDept, setSelectedDept] = useState('ALL'); // "ALL" means all departments
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'SI' | 'TAX' | 'LOAN' | 'OTHER'>('ALL');

  // Database states
  const [deductionTypes, setDeductionTypes] = useState<DeductionType[]>([]);
  const [deductionLines, setDeductionLines] = useState<DeductionLine[]>([]);
  const [deductionTransactions, setDeductionTransactions] = useState<DeductionTransaction[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<'empCode' | 'empName' | 'totalDeduction' | 'totalCompany'>('empCode');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Months & Years ranges
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - 2 + i));

  // Currency Formatter - system-wide set to Egyptian Pound (ج.م. / EGP)
  const formatCurrency = (amount: number) => {
    return isRtl 
      ? `${amount.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م.`
      : `EGP ${amount.toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getMonthName = (m: string) => {
    const monthsAr = [t('يناير'), t('فبراير'), t('مارس'), t('أبريل'), t('مايو'), t('يونيو'), t('يوليو'), t('أغسطس'), t('سبتمبر'), t('أكتوبر'), t('نوفمبر'), t('ديسمبر')];
    const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const idx = parseInt(m, 10) - 1;
    return isRtl ? monthsAr[idx] : monthsEn[idx];
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('auth_token');
      const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

      const [resTypes, resLines, resPenalties, resTransactions] = await Promise.all([
        fetch('/api/deduction-types', { headers: authHeaders }),
        fetch('/api/deduction-transaction-lines', { headers: authHeaders }),
        fetch('/api/penalties', { headers: authHeaders }),
        fetch('/api/deduction-transactions', { headers: authHeaders })
      ]).catch(() => {
        throw new Error(isRtl ? t('فشل الاتصال بالخادم وتحميل البيانات') : 'Failed to retrieve database collections');
      });

      if (!resTypes.ok || !resLines.ok) {
        throw new Error(isRtl ? t('حدث خطأ أثناء تحميل بيانات الاستقطاعات') : 'Failed to retrieve full deduction dataset');
      }

      const typesData = await resTypes.json();
      const linesData = await resLines.json();
      const penaltiesData = resPenalties.ok ? await resPenalties.json() : [];
      const transactionsData = resTransactions.ok ? await resTransactions.json() : [];

      setDeductionTypes(typesData);
      setDeductionLines(linesData);
      setPenalties(penaltiesData);
      setDeductionTransactions(transactionsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute final detailed report rows based on selected target month, filters, and dynamic calculations
  const reportData = useMemo(() => {
    const periodString = `${targetYear}-${targetMonth}`;

    // 1. Get filtered employee list based on department selection
    const filteredEmployees = allDbEmployees.filter(emp => {
      if (selectedDept === 'ALL') return true;
      return emp.departmentId === selectedDept;
    });

    // 3. For every employee, construct detailed deduction records
    const rows = filteredEmployees.map(emp => {
      const dept = dbDepartments.find(d => d.id === emp.departmentId);
      const payrollTx = payrollTransactions.find(t => t.employeeId === emp.id && t.month === periodString);
      
      const basicSalary = Number(emp.basicSalary) || 0;
      const grossBase = basicSalary + (payrollTx ? (
        (Number(payrollTx.housingAllowance) || 0) +
        (Number(payrollTx.transportAllowance) || 0) +
        (Number(payrollTx.subsistenceAllowance) || 0) +
        (Number(payrollTx.mobileAllowance) || 0) +
        (Number(payrollTx.managementAllowance) || 0) +
        (Number(payrollTx.otherAllowances) || 0)
      ) : 0);

      // --- A. Social Insurance (التأمينات الاجتماعية) ---
      // Employee share from transactions fallback, or dynamic calculated share if eligible (subjectToSi === 'Yes')
      let empSi = payrollTx ? (Number(payrollTx.socialInsurance) || 0) : 0;
      let compSi = 0;

      // Look up if there's any explicit social insurance configuration in deductionTypes
      const siType = deductionTypes.find(dtype => dtype.category === t('تأمينات') && dtype.status === 'Active');
      if (siType && emp.subjectToSi !== 'No') {
        const empPct = Number(siType.employeePercentage) || 0;
        const compPct = Number(siType.companyPercentage) || 0;
        
        // Calculate GOSI (usually based on basicSalary + housing)
        const siBase = basicSalary + (payrollTx ? (Number(payrollTx.housingAllowance) || 0) : 0);
        if (empSi === 0) {
          empSi = siBase * (empPct / 100);
        }
        compSi = siBase * (compPct / 100);
      }

      // --- B. Taxes (ضريبة كسب العمل فقط) ---
      let empTax = 0;
      let compTax = 0;
      
      const taxType = deductionTypes.find(dtype => 
        (dtype.category === 'ضريبة كسب العمل' || dtype.category === t('ضريبة كسب العمل') || dtype.category === 'كسب العمل') && 
        dtype.status === 'Active'
      );
      if (emp.subjectToTax !== 'No' && emp.taxExempt !== 'Yes') {
        // Simple Work Gain tax formulation (tax bracket or flat percentage)
        const flatTaxPct = taxType ? (Number(taxType.percentage) || Number(taxType.employeePercentage) || 10) : 10;
        empTax = grossBase * (flatTaxPct / 100);
        compTax = taxType ? (grossBase * ((Number(taxType.companyPercentage) || 0) / 100)) : 0;
      }

      // --- C. Loans & Advances (سلف وقروض) ---
      let empLoans = payrollTx ? (Number(payrollTx.loans) || 0) : 0;
      let compLoans = 0;

      // --- D. Other Deductions (الغياب، التأخيرات، الجزاءات، إلخ) ---
      let empAbsence = payrollTx ? (Number(payrollTx.absenceDeduction) || 0) : 0;
      let empDelay = payrollTx ? (Number(payrollTx.departureDelayDeduction) || 0) : 0;
      let empPenalties = 0;
      
      // Look up penalties assigned to user for this month
      const empMonthPenalties = penalties.filter(p => 
        p.employeeId === emp.id && 
        p.violationDate.startsWith(periodString) &&
        p.status === 'Approved'
      );
      empPenalties = empMonthPenalties.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      
      let empOtherGeneral = payrollTx ? (Number(payrollTx.otherDeductions) || 0) : 0;
      
      // Let's see if we have manual deduction transaction lines to override calculated values
      const manualLines = deductionLines.filter(line => {
        // Find if this line belongs to an approved transaction in target month and year
        const parentTx = deductionTransactions.find(t => t.id === line.transactionId);
        if (!parentTx) return false;
        return (
          line.employeeId === emp.id &&
          parentTx.month === targetMonth &&
          parentTx.year === targetYear &&
          parentTx.status === 'Approved'
        );
      });

      // Override with manual transaction inputs per category
      manualLines.forEach(line => {
        const type = deductionTypes.find(t => t.id === line.deductionTypeId);
        if (type) {
          if (type.category === t('تأمينات')) {
            empSi = Number(line.calculatedValue) || empSi;
            compSi = Number(line.companyValue) || compSi;
          } else if (type.category === 'ضريبة كسب العمل' || type.category === t('ضريبة كسب العمل') || type.category === 'كسب العمل') {
            empTax = Number(line.calculatedValue) || empTax;
            compTax = Number(line.companyValue) || compTax;
          } else if (type.category === t('سلف وقروض')) {
            empLoans = Number(line.calculatedValue) || empLoans;
            compLoans = Number(line.companyValue) || compLoans;
          } else {
            empOtherGeneral += Number(line.calculatedValue) || 0;
            compLoans += Number(line.companyValue) || 0; // Bear other
          }
        }
      });

      // Sum of other deductions category
      const empOtherTotal = empAbsence + empDelay + empPenalties + empOtherGeneral;

      // Combined Totals
      const totalBorneByEmployee = empSi + empTax + empLoans + empOtherTotal;
      const totalBorneByCompany = compSi + compTax + compLoans;
      const grandTotalFinancialImpact = totalBorneByEmployee + totalBorneByCompany;

      return {
        id: emp.id,
        empCode: emp.employeeId,
        empName: emp.name,
        deptId: emp.departmentId,
        deptName: dept?.name || (isRtl ? t('عام / غير محدد') : 'General / Not Specified'),
        basicSalary,
        socialShareEmp: empSi,
        socialShareComp: compSi,
        taxShareEmp: empTax,
        taxShareComp: compTax,
        loansShareEmp: empLoans,
        loansShareComp: compLoans,
        absenceDeduction: empAbsence,
        delayDeduction: empDelay,
        penaltiesDeduction: empPenalties,
        otherDeductionsGeneral: empOtherGeneral,
        otherDeductionsTotal: empOtherTotal,
        totalDeduction: totalBorneByEmployee,
        totalCompany: totalBorneByCompany,
        grandTotal: grandTotalFinancialImpact
      };
    })
    // 4. Search Filter
    .filter(row => {
      if (!searchQuery) return true;
      const s = searchQuery.toLowerCase();
      return (
        row.empName.toLowerCase().includes(s) ||
        row.empCode.toLowerCase().includes(s) ||
        row.deptName.toLowerCase().includes(s)
      );
    });

    // Compute sums based on filtered rows
    let sumSiEmp = 0;
    let sumSiComp = 0;
    let sumTaxEmp = 0;
    let sumTaxComp = 0;
    let sumLoanEmp = 0;
    let sumLoanComp = 0;
    let sumOtherEmp = 0;
    let sumTotalEmp = 0;
    let sumTotalComp = 0;
    let totalCombinedImpact = 0;
    let affectedEmployeesCount = 0;

    rows.forEach(r => {
      sumSiEmp += r.socialShareEmp;
      sumSiComp += r.socialShareComp;
      sumTaxEmp += r.taxShareEmp;
      sumTaxComp += r.taxShareComp;
      sumLoanEmp += r.loansShareEmp;
      sumLoanComp += r.loansShareComp;
      sumOtherEmp += r.otherDeductionsTotal;
      sumTotalEmp += r.totalDeduction;
      sumTotalComp += r.totalCompany;
      totalCombinedImpact += r.grandTotal;
      if (r.totalDeduction > 0 || r.totalCompany > 0) {
        affectedEmployeesCount++;
      }
    });

    // Sort rows
    const sortedRows = [...rows].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      
      if (typeof valA === 'string') {
        const order = sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return order;
      } else {
        return sortOrder === 'asc' ? (valA - valB) : (valB - valA);
      }
    });

    return {
      rows: sortedRows,
      sums: {
        sumSiEmp,
        sumSiComp,
        sumTaxEmp,
        sumTaxComp,
        sumLoanEmp,
        sumLoanComp,
        sumOtherEmp,
        sumTotalEmp,
        sumTotalComp,
        totalCombinedImpact,
        affectedEmployeesCount
      }
    };
  }, [allDbEmployees, dbDepartments, payrollTransactions, deductionTypes, deductionLines, deductionTransactions, penalties, targetYear, targetMonth, selectedDept, searchQuery, sortField, sortOrder, isRtl]);

  const handleExportCSV = () => {
    const csvHeaders = isRtl 
      ? [t('الكود الوظيفي'), t('اسم الموظف'), t('الإدارة'), t('تأمينات موظف'), t('تأمينات شركة'), t('ضرائب كسب العمل'), t('ضرائب شركة'), t('السلف والقروض'), t('خصومات الغياب والتأخر والجزاءات'), t('إجمالي استقطاع الموظف'), t('إجمالي تحمل الشركة'), t('العبء المالي المدمج')]
      : ['Employee Code', 'Name', 'Department', 'SI Employee Share', 'SI Company Bear', 'Tax Employee Share', 'Tax Company Bear', 'Loans Deduction', 'Absence/Delay/Penalties', 'Total Employee Borne', 'Total Company Bear', 'Combined Impact'];

    const csvRows = reportData.rows.map(r => [
      r.empCode,
      r.empName,
      r.deptName,
      r.socialShareEmp.toFixed(2),
      r.socialShareComp.toFixed(2),
      r.taxShareEmp.toFixed(2),
      r.taxShareComp.toFixed(2),
      r.loansShareEmp.toFixed(2),
      r.otherDeductionsTotal.toFixed(2),
      r.totalDeduction.toFixed(2),
      r.totalCompany.toFixed(2),
      r.grandTotal.toFixed(2)
    ]);

    const BOM = '\uFEFF'; 
    const csvContent = BOM + [csvHeaders.join(','), ...csvRows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Deductions_Analysis_Report_${targetYear}_${targetMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 print:p-0 print:bg-white print:text-black">
      {/* Page Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-black heading-gradient uppercase tracking-widest flex items-center gap-2">
            <Percent className="w-7 h-7 text-primary" />
            {isRtl ? t('تقرير إجماليات الاستقطاعات والتحملات التفصيلية') : 'Deductions & Benefits Bearings Detailed Report'}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-bold">
            {isRtl 
              ? t('تحليل شامل ومفصل للتأمينات الاجتماعية والضرائب والسلف والجزاءات المستقطعة من الموظفين وفوارق تحمل الشركة.') 
              : 'Detailed breakdown of employee social insurance, taxes, loans, penalties, and company-borne costs.'}
          </p>
        </div>
        
        {/* Export & Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-black uppercase tracking-wider transition-all"
          >
            <Printer className="w-4 h-4" />
            {isRtl ? t('طباعة التقرير') : 'Print Report'}
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
          >
            <Download className="w-4 h-4" />
            {isRtl ? t('تصدير Excel (CSV)') : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Main Filter Panel */}
      <div className="bg-card border-2 border-border p-6 shadow-sm print:hidden">
        <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-primary" />
          {isRtl ? t('محاور وخيارات الفرز المتقدم') : 'Report Parameters & Filtering Options'}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Target Month */}
          <div>
            <label className="block text-xs font-black text-foreground uppercase tracking-wider mb-2">
              {isRtl ? t('الشهر المستهدف') : 'Target Month'}
            </label>
            <select
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="w-full p-3 bg-muted/50 border border-border font-bold text-sm focus:ring-2 focus:ring-primary outline-none"
            >
              {months.map(m => (
                <option key={m} value={m}>{m} - {getMonthName(m)}</option>
              ))}
            </select>
          </div>

          {/* Target Year */}
          <div>
            <label className="block text-xs font-black text-foreground uppercase tracking-wider mb-2">
              {isRtl ? t('السنة المستهدفة') : 'Target Year'}
            </label>
            <select
              value={targetYear}
              onChange={(e) => setTargetYear(e.target.value)}
              className="w-full p-3 bg-muted/50 border border-border font-bold text-sm focus:ring-2 focus:ring-primary outline-none"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Administration / Department Select */}
          <div>
            <label className="block text-xs font-black text-foreground uppercase tracking-wider mb-2">
              {isRtl ? t('تحليل لإدارة معينة أو الإدارة بالكامل') : 'Selected Department/Entire Department'}
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full p-3 bg-muted/50 border border-border font-bold text-sm focus:ring-2 focus:ring-primary outline-none text-right"
            >
              <option value="ALL">
                {isRtl ? t('شعب وأقسام المنظمة بالكامل') : '◆ All Departments (Organization-wide)'}
              </option>
              {dbDepartments.map(dept => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div>
            <label className="block text-xs font-black text-foreground uppercase tracking-wider mb-2">
              {isRtl ? t('بحث في معلومات الموظف') : 'Search Employee Name/Code'}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isRtl ? t('ابحث بالاسم أو الكود...') : 'Search by name, code...'}
                className="w-full p-3 pl-10 pr-4 bg-muted/50 border border-border font-bold text-sm focus:ring-2 focus:ring-primary outline-none"
              />
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Printer Header (Only shown when printing) */}
      <div className="hidden print:block border-b-4 border-black pb-4 mb-6 text-center">
        <h1 className="text-3xl font-black">{isRtl ? t('شركة أوبريكس للأنظمة والموارد البشرية') : 'OPerix Systems & HR Solutions'}</h1>
        <h2 className="text-xl font-bold mt-2">
          {isRtl 
            ? `تقرير الاستقطاعات والتحملات الشامل لشهر: ${getMonthName(targetMonth)} ${targetYear}` 
            : `Comprehensive Deductions & Bearings Report for: ${getMonthName(targetMonth)} ${targetYear}`}
        </h2>
        <div className="flex justify-between text-xs font-bold mt-4 px-2">
          <span>{isRtl ? `الإدارة: ${selectedDept === 'ALL' ? t('كل أقسام المنشأة') : dbDepartments.find(d => d.id === selectedDept)?.name}` : `Dept: ${selectedDept === 'ALL' ? 'All' : selectedDept}`}</span>
          <span>{isRtl ? `العملة المعتمدة: ج.م. (Egyptian Pound)` : `Approved Currency: EGP`}</span>
          <span>{isRtl ? `تاريخ الإصدار: ${new Date().toLocaleDateString('ar-EG')}` : `Date: ${new Date().toLocaleDateString()}`}</span>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-destructive/10 border-2 border-destructive text-destructive font-bold flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button onClick={fetchData} className="underline text-xs ml-auto hover:text-foreground">
            {isRtl ? t('إعادة المحاولة') : 'Retry'}
          </button>
        </div>
      )}

      {/* 4 Beautiful Metrics summary cards (Bento Style in EGP) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Employee Deductions card */}
        <div className="bg-card border-2 border-border p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              {isRtl ? t('إجمالي مستقطع من الموظفين') : 'Total Employee Deductions'}
            </span>
            <div className="w-8 h-8 rounded-none bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-orange-500" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-orange-600">
              {formatCurrency(reportData.sums.sumTotalEmp)}
            </h2>
            <div className="text-[10px] mt-2 text-muted-foreground font-black flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" />
              <span>{isRtl ? `${reportData.sums.affectedEmployeesCount} موظفين خاضعين للاستقطاع` : `${reportData.sums.affectedEmployeesCount} employees targeted`}</span>
            </div>
          </div>
        </div>

        {/* Company Bearing card */}
        <div className="bg-card border-2 border-border p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              {isRtl ? t('مستحقات تتحملها الشركة') : 'Total Company-Borne Share'}
            </span>
            <div className="w-8 h-8 rounded-none bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-center">
              <Building className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-emerald-600">
              {formatCurrency(reportData.sums.sumTotalComp)}
            </h2>
            <p className="text-[10px] mt-2 text-muted-foreground font-bold">
              {isRtl ? t('تأمينات وضرائب مدعومة ومتحملة من المرفق') : 'Subsidized SI and organizational liabilities'}
            </p>
          </div>
        </div>

        {/* Combined Monthly Burden card */}
        <div className="bg-card border-2 border-border p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              {isRtl ? t('العبء الاستقطاعي الكامل') : 'Combined Monthly Financial Impact'}
            </span>
            <div className="w-8 h-8 rounded-none bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center">
              <Layers className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-blue-600">
              {formatCurrency(reportData.sums.totalCombinedImpact)}
            </h2>
            <p className="text-[10px] mt-2 text-muted-foreground font-bold">
              {isRtl ? t('مجموع استقطاعات الموظف + تكاليف ومساهمة الشركة') : 'Sum of employee portion + company contribution'}
            </p>
          </div>
        </div>

        {/* Organization Status card */}
        <div className="bg-card border-2 border-border p-6 flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              {isRtl ? t('حالة التقرير والعملة المعتمدة') : 'Report State & Base Currency'}
            </span>
            <div className="w-8 h-8 rounded-none bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-900/60 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-violet-500" />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-black text-violet-600 uppercase flex items-center gap-1.5 leading-none">
              <span>{t('ج.م (EGP)')}</span>
            </h2>
            <p className="text-[10px] mt-2.5 text-muted-foreground font-black uppercase text-right leading-relaxed">
              {isRtl ? t('العملة المعتمدة لإعدادات الاستقطاعات ومطابقة الرواتب') : 'Official Approved System Currency'}
            </p>
          </div>
        </div>

      </div>

      {/* Category-Specific Detailed Analyzer Panels */}
      <div className="space-y-6">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          {isRtl ? t('التحليلات التفصيلية المفصلة حسب فروع وتصنيفات الاستقطاعات') : 'Detailed Deduction Category Breakdown Panels'}
        </h2>

        {/* Grid for SI, Taxes, Loans, Other Deductions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 1. SOCIAL INSURANCE ANALYSIS PANEL */}
          <div className="bg-card border-2 border-border p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  {isRtl ? t('التأمينات الاجتماعية والتقاعد') : 'Social Insurance (SI / GOSI)'}
                </h3>
                <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-[10px] px-2.5 py-1 font-bold rounded-full">
                  {isRtl ? t('موزعة بالتحمل') : 'Dual Share'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4 bg-muted/40 p-4 border border-border">
                <div>
                  <span className="block text-[10px] text-muted-foreground font-bold mb-1">{isRtl ? t('حصة الموظف المستقطعة') : 'Employee Deducted Share'}</span>
                  <span className="text-base font-black text-foreground">{formatCurrency(reportData.sums.sumSiEmp)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground font-bold mb-1">{isRtl ? t('حصة المنشأة (تتحملها الشركة)') : 'Company Contribution Share'}</span>
                  <span className="text-base font-black text-emerald-600">{formatCurrency(reportData.sums.sumSiComp)}</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {isRtl 
                  ? t('تفاصيل التأمينات الاجتماعية تظهر المبالغ التي يتم سحبها من صافي راتب الموظف ونظيراتها التي تلتزم الشركة بدفعها للمحافظة التأمينية.')
                  : 'Social Insurance shows portions taken from the employee against the liability paid by the organization.'}
              </p>
            </div>
          </div>

          {/* 2. INCOME TAXES ANALYSIS PANEL */}
          <div className="bg-card border-2 border-border p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-600" />
                  {isRtl ? t('ضريبة كسب العمل والرسوم الحكومية') : 'Salary Income Tax (Work Gain Tax)'}
                </h3>
                <span className="bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 text-[10px] px-2.5 py-1 font-bold rounded-full">
                  {isRtl ? t('على الموظف') : 'Employee Levy'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4 bg-muted/40 p-4 border border-border">
                <div>
                  <span className="block text-[10px] text-muted-foreground font-bold mb-1">{isRtl ? t('ضريبة كسب العمل للموظفين') : 'Employee Income Tax sum'}</span>
                  <span className="text-base font-black text-foreground">{formatCurrency(reportData.sums.sumTaxEmp)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground font-bold mb-1">{isRtl ? t('ضرائب ومبالغ مدعومة') : 'Direct Company bearing Tax'}</span>
                  <span className="text-base font-black text-emerald-600">{formatCurrency(reportData.sums.sumTaxComp)}</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {isRtl 
                  ? t('محاسبة الضرائب تطبق حسب الشرائح والشرط القانوني لخضوع الموظف للضريبة بناءً على مجموع دخله الإجمالي الخاضع للضريبة.')
                  : 'Income tax calculations are segmented by the legal framework according to taxable gross earnings.'}
              </p>
            </div>
          </div>

          {/* 3. LOANS & ADVANCES PANEL */}
          <div className="bg-card border-2 border-border p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  {isRtl ? t('السلف المالية والعهود والقروض المستردة') : 'Active Loans & Financial Advances'}
                </h3>
                <span className="bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-[10px] px-2.5 py-1 font-bold rounded-full">
                  {isRtl ? t('سداد أقساط') : 'Instalments Repaid'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4 bg-muted/40 p-4 border border-border">
                <div>
                  <span className="block text-[10px] text-muted-foreground font-bold mb-1">{isRtl ? t('أقساط سلف مستردة من الموظف') : 'Loans deductive installments'}</span>
                  <span className="text-base font-black text-foreground">{formatCurrency(reportData.sums.sumLoanEmp)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-muted-foreground font-bold mb-1">{isRtl ? t('تخفيضات أو سلف مدعومة') : 'Company Subsidies'}</span>
                  <span className="text-base font-black text-emerald-600">{formatCurrency(reportData.sums.sumLoanComp)}</span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {isRtl 
                  ? t('العهود والسلف المستحقة يتم اقتطاعها كدفعات شهرية ثابتة بناءً على النماذج المعتمدة وجداول السداد المحاسبية.')
                  : 'Approved financial advances are recovered on scheduled monthly repayments.'}
              </p>
            </div>
          </div>

          {/* 4. OTHER DEDUCTIONS PANEL */}
          <div className="bg-card border-2 border-border p-6 flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between border-b pb-3 mb-4">
                <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />
                  {isRtl ? t('الغياب، التأخيرات، والجزاءات الإدارية مع أنواعها') : 'Absence, Delays & Administrative Penalties'}
                </h3>
                <span className="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-[10px] px-2.5 py-1 font-bold rounded-full">
                  {isRtl ? t('اقتطاعات سلوكية وزمنية') : 'Performance Deductions'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-4 bg-muted/40 p-3 border border-border">
                <div className="text-center border-r border-border/60 last:border-0">
                  <span className="block text-[8px] text-muted-foreground font-black mb-1">{isRtl ? t('أيام الغياب') : 'Absence'}</span>
                  <span className="text-xs font-black text-foreground block truncate">
                    {reportData.rows.reduce((s, r) => s + r.absenceDeduction, 0) > 0 
                      ? formatCurrency(reportData.rows.reduce((s, r) => s + r.absenceDeduction, 0)) 
                      : '—'}
                  </span>
                </div>
                <div className="text-center border-r border-border/60 last:border-0">
                  <span className="block text-[8px] text-muted-foreground font-black mb-1">{isRtl ? t('ساعات التأخير') : 'Delay'}</span>
                  <span className="text-xs font-black text-foreground block truncate">
                    {reportData.rows.reduce((s, r) => s + r.delayDeduction, 0) > 0 
                      ? formatCurrency(reportData.rows.reduce((s, r) => s + r.delayDeduction, 0)) 
                      : '—'}
                  </span>
                </div>
                <div className="text-center border-r border-border/60 last:border-0">
                  <span className="block text-[8px] text-muted-foreground font-black mb-1">{isRtl ? t('الجزاءات المعتمدة') : 'Confirmed Penalties'}</span>
                  <span className="text-xs font-black text-foreground block truncate">
                    {reportData.rows.reduce((s, r) => s + r.penaltiesDeduction, 0) > 0 
                      ? formatCurrency(reportData.rows.reduce((s, r) => s + r.penaltiesDeduction, 0)) 
                      : '—'}
                  </span>
                </div>
                <div className="text-center last:border-0">
                  <span className="block text-[8px] text-muted-foreground font-black mb-1">{isRtl ? t('اقتطاعات أخرى') : 'Other General'}</span>
                  <span className="text-xs font-black text-foreground block truncate">
                    {reportData.rows.reduce((s, r) => s + r.otherDeductionsGeneral, 0) > 0 
                      ? formatCurrency(reportData.rows.reduce((s, r) => s + r.otherDeductionsGeneral, 0)) 
                      : '—'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {isRtl 
                  ? t('تشمل الاقتطاعات الجزائية أيام الغياب بدون عذر، وتأخير الحضور والغياب المسلكي المصدّق عليه بلجان الموارد البشرية.')
                  : 'Administrative, absence, and delay deductions are compiled directly as penal guidelines.'}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Main Master Detailed Table */}
      <div className="bg-card border-2 border-border shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-border gap-4 print:hidden">
          <h3 className="font-black text-sm uppercase tracking-wider text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            {isRtl ? t('جدول تسويات وكشف كلي تفصيلي باستقطاعات الموظفين والتحملات') : 'Detailed Employees Deduction Matrix Ledger'}
          </h3>
          
          {/* Sorting Indicators */}
          <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground">
            <span>{isRtl ? t('ترتيب على أساس:') : 'Sorted by:'}</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as any)}
              className="bg-muted p-1 border border-border outline-none font-bold text-xs"
            >
              <option value="empCode">{isRtl ? t('الكود الوظيفي') : 'Employee ID'}</option>
              <option value="empName">{isRtl ? t('اسم الموظف') : 'Employee Name'}</option>
              <option value="totalDeduction">{isRtl ? t('إجمالي خصم الموظف') : 'Total Deduction'}</option>
              <option value="totalCompany">{isRtl ? t('تحمل الشركة') : 'Company Share'}</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1 hover:bg-muted text-primary"
            >
              {sortOrder === 'asc' ? '▲' : '▼'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs border-collapse">
            <thead>
              <tr className="bg-muted text-muted-foreground font-black uppercase tracking-wider border-b-2 border-border text-[10px]">
                <th className="p-4 text-right print:p-2">{isRtl ? t('الموظف / الإدارة') : 'Employee / Dept'}</th>
                <th className="p-4 text-center print:p-2 bg-blue-50/50 dark:bg-blue-950/20">{isRtl ? t('تأمينات موظف') : 'SI Emp'}</th>
                <th className="p-4 text-center print:p-2 bg-blue-50/50 dark:bg-blue-950/20">{isRtl ? t('تحمل تأمينات شركة') : 'SI Company'}</th>
                <th className="p-4 text-center print:p-2 bg-rose-50/50 dark:bg-rose-950/20">{isRtl ? t('ضرائب موظف') : 'Tax Emp'}</th>
                <th className="p-4 text-center print:p-2 bg-rose-50/50 dark:bg-rose-950/20">{isRtl ? t('تحمل ضرائب شركة') : 'Tax Company'}</th>
                <th className="p-4 text-center print:p-2 bg-amber-50/50 dark:bg-amber-950/20">{isRtl ? t('سلف وقروض') : 'Loans'}</th>
                <th className="p-4 text-center print:p-2 bg-violet-50/50 dark:bg-violet-950/20">{isRtl ? t('خصومات جزائية وأخرى') : 'Other Deductions'}</th>
                <th className="p-4 text-center print:p-2 font-black text-orange-600 bg-orange-50/20">{isRtl ? t('إجمالي مستقطع') : 'Total Employee Borne'}</th>
                <th className="p-4 text-center print:p-2 font-black text-emerald-600 bg-emerald-50/20">{isRtl ? t('إجمالي الشركة') : 'Total Company Bear'}</th>
                <th className="p-4 text-center print:p-2 font-black text-purple-600 bg-purple-50/20">{isRtl ? t('صافي العبء') : 'Combined Burden'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reportData.rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-muted-foreground font-bold">
                    {isRtl ? t('لا يوجد استقطاعات مسجلة أو محسوبة لهذا الشهر والإدارة المحددة.') : 'No deductions matching criteria.'}
                  </td>
                </tr>
              ) : (
                reportData.rows.map((row, index) => (
                  <tr 
                    key={row.id} 
                    className="hover:bg-muted/30 transition-all font-bold group"
                  >
                    {/* Employee Profile info */}
                    <td className="p-4 print:p-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-primary/10 rounded-none flex items-center justify-center text-primary font-black text-[10px]">
                          {row.empName[0] || 'E'}
                        </div>
                        <div>
                          <div className="text-foreground font-black text-xs group-hover:text-primary transition-colors">
                            {row.empName}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-bold mt-0.5">
                            <span className="bg-muted px-1.5 py-0.5 border text-foreground">{row.empCode}</span>
                            <span>•</span>
                            <span>{row.deptName}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Social Insurance Share (Emp) */}
                    <td className="p-4 text-center print:p-2 bg-blue-50/10 dark:bg-blue-950/5">
                      {row.socialShareEmp > 0 ? (
                        <span className="text-foreground font-bold">{formatCurrency(row.socialShareEmp)}</span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>

                    {/* Social Insurance Contribution (Comp) */}
                    <td className="p-4 text-center print:p-2 bg-blue-50/10 dark:bg-blue-950/5 text-emerald-600">
                      {row.socialShareComp > 0 ? (
                        <span className="font-bold">{formatCurrency(row.socialShareComp)}</span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>

                    {/* Taxes Share (Emp) */}
                    <td className="p-4 text-center print:p-2 bg-rose-50/10 dark:bg-rose-950/5">
                      {row.taxShareEmp > 0 ? (
                        <span className="text-foreground font-bold">{formatCurrency(row.taxShareEmp)}</span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>

                    {/* Taxes Contribution (Comp) */}
                    <td className="p-4 text-center print:p-2 bg-rose-50/10 dark:bg-rose-950/5 text-emerald-600">
                      {row.taxShareComp > 0 ? (
                        <span className="font-bold">{formatCurrency(row.taxShareComp)}</span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>

                    {/* Loans Recovery installment */}
                    <td className="p-4 text-center print:p-2 bg-amber-50/10 dark:bg-amber-950/5">
                      {row.loansShareEmp > 0 ? (
                        <span className="text-foreground font-bold">{formatCurrency(row.loansShareEmp)}</span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>

                    {/* Other Deductions Category */}
                    <td className="p-4 text-center print:p-2 bg-violet-50/10 dark:bg-violet-950/5">
                      {row.otherDeductionsTotal > 0 ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-foreground font-bold">{formatCurrency(row.otherDeductionsTotal)}</span>
                          {/* Inner detailed tooltip showing what other contains */}
                          {(row.absenceDeduction > 0 || row.delayDeduction > 0 || row.penaltiesDeduction > 0) && (
                            <span className="text-[8px] text-muted-foreground leading-none font-bold">
                              ({row.absenceDeduction > 0 && `${isRtl ? t('غياب') : 'Abs'}`} 
                              {row.delayDeduction > 0 && ` + ${isRtl ? t('تأخير') : 'Delay'}`} 
                              {row.penaltiesDeduction > 0 && ` + ${isRtl ? t('جزاء') : 'Pen'}`})
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>

                    {/* Total Borne by Employee */}
                    <td className="p-4 text-center print:p-2 font-black text-orange-600 bg-orange-50/10 dark:bg-orange-950/5">
                      {row.totalDeduction > 0 ? (
                        formatCurrency(row.totalDeduction)
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>

                    {/* Total Contribution Borne by Company */}
                    <td className="p-4 text-center print:p-2 font-black text-emerald-600 bg-emerald-50/10 dark:bg-emerald-950/5">
                      {row.totalCompany > 0 ? (
                        formatCurrency(row.totalCompany)
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>

                    {/* Net Combative Burden */}
                    <td className="p-4 text-center print:p-2 font-black text-purple-600 bg-purple-50/10 dark:bg-purple-950/5">
                      {row.grandTotal > 0 ? (
                        formatCurrency(row.grandTotal)
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            
            {/* Total Summary Footer Row */}
            {reportData.rows.length > 0 && (
              <tfoot>
                <tr className="bg-muted font-black border-t-2 border-border text-[11px] text-foreground">
                  <td className="p-4 text-right print:p-2">
                    {isRtl ? t('مجموع إجماليات الكشف المالي') : 'TOTAL LEDGER SUMS'}
                  </td>
                  <td className="p-4 text-center print:p-2 bg-blue-50/30 dark:bg-blue-950/20">
                    {formatCurrency(reportData.sums.sumSiEmp)}
                  </td>
                  <td className="p-4 text-center print:p-2 bg-blue-50/30 dark:bg-blue-950/20 text-emerald-600">
                    {formatCurrency(reportData.sums.sumSiComp)}
                  </td>
                  <td className="p-4 text-center print:p-2 bg-rose-50/30 dark:bg-rose-950/20">
                    {formatCurrency(reportData.sums.sumTaxEmp)}
                  </td>
                  <td className="p-4 text-center print:p-2 bg-rose-50/30 dark:bg-rose-950/20 text-emerald-600">
                    {formatCurrency(reportData.sums.sumTaxComp)}
                  </td>
                  <td className="p-4 text-center print:p-2 bg-amber-50/30 dark:bg-amber-950/20">
                    {formatCurrency(reportData.sums.sumLoanEmp)}
                  </td>
                  <td className="p-4 text-center print:p-2 bg-violet-50/30 dark:bg-violet-950/20">
                    {formatCurrency(reportData.sums.sumOtherEmp)}
                  </td>
                  <td className="p-4 text-center print:p-2 text-orange-600 bg-orange-50/20 font-black">
                    {formatCurrency(reportData.sums.sumTotalEmp)}
                  </td>
                  <td className="p-4 text-center print:p-2 text-emerald-600 bg-emerald-50/20 font-black">
                    {formatCurrency(reportData.sums.sumTotalComp)}
                  </td>
                  <td className="p-4 text-center print:p-2 text-purple-600 bg-purple-50/20 font-black">
                    {formatCurrency(reportData.sums.totalCombinedImpact)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
