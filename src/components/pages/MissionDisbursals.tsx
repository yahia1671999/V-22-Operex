import React, { useState, useEffect } from 'react';
import { 
  Plane, 
  Search, 
  Calendar, 
  CheckCircle2, 
  Clock3, 
  Download, 
  Printer, 
  ArrowUpRight, 
  DollarSign, 
  FileSpreadsheet, 
  CreditCard, 
  Coins, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  X,
  FileText,
  AlertCircle,
  History,
  TrendingDown
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { db, handleApiError } from '../../api';
import { Employee } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { parse, format } from 'date-fns';
import * as XLSX from 'xlsx';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatDateTime12h } from '../../utils/timeFormatter';

// Types for the partial and structured disbursements
export interface MissionPaymentRecord {
  paymentId: string;
  amount: number;
  paymentMethod: 'Cash' | 'Bank';
  reference?: string;
  notes?: string;
  disbursedAt: string;
}

export interface MissionDisbursal {
  id: string; // employeeId_month
  employeeId: string;
  month: string;
  totalAmount: number;
  paidAmount: number;
  status: 'Draft' | 'Partial' | 'Approved';
  payments: string; // JSON string of MissionPaymentRecord[]
  notes?: string;
}

export const MissionDisbursals: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { employees, missions, missionTypes, projects } = useData();
  
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEmployees, setExpandedEmployees] = useState<Record<string, boolean>>({});
  
  const [disbursals, setDisbursals] = useState<Record<string, MissionDisbursal>>({});
  const [advances, setAdvances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Payment Modal controllers
  const [payingEmpId, setPayingEmpId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState({
    paymentMethod: 'Bank' as 'Cash' | 'Bank',
    amountToPay: 0,
    reference: '',
    notes: ''
  });

  // Load Disbursals and Advances
  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      // 1. Fetch disbursals
      const disbursalsRes = await fetch('/api/mission-disbursals', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const disbursalsMap: Record<string, MissionDisbursal> = {};
      if (disbursalsRes.ok) {
        const disbursalsData = await disbursalsRes.json();
        if (Array.isArray(disbursalsData)) {
          disbursalsData.forEach((r: any) => {
            disbursalsMap[r.id] = r;
          });
        }
      }

      // 2. Fetch advances (for liquidation calculation)
      const advancesRes = await fetch('/api/financial-advances', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (advancesRes.ok) {
        const advancesData = await advancesRes.json();
        setAdvances(advancesData || []);
      }

      setDisbursals(disbursalsMap);
    } catch (e) {
      console.error("Failed to load mission disbursals data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  // Calculate mission details for an employee in the selected month
  const isMissionApprovedForDisbursal = (status?: string | null) => {
    if (!status) return false;
    const s = status.trim();
    return ['Approved', 'Completed', 'Executed', 'معتمدة', 'مكتملة', 'مكتملة ومُقيّمة', 'منفذة'].includes(s);
  };

  const getEmployeeMissionsInfo = (empId: string) => {
    // Filter approved / completed missions for this employee matching the selected entitlement month
    const empMissions = (missions || []).filter(m => {
      if (m.employeeId !== empId) return false;
      if (!isMissionApprovedForDisbursal(m.status)) return false;
      
      const startMonth = m.startDate ? m.startDate.slice(0, 7) : '';
      const endMonth = m.endDate ? m.endDate.slice(0, 7) : '';
      return (
        startMonth === selectedMonth || 
        endMonth === selectedMonth || 
        (startMonth && endMonth && startMonth <= selectedMonth && endMonth >= selectedMonth)
      );
    });

    // Deduplicate missions by ID to strictly prevent any duplicate calculation
    const uniqueMissionsMap = new Map<string, typeof empMissions[0]>();
    empMissions.forEach(m => {
      if (m.id && !uniqueMissionsMap.has(m.id)) {
        uniqueMissionsMap.set(m.id, m);
      }
    });
    const uniqueMissions = Array.from(uniqueMissionsMap.values());

    let totalAmount = 0;
    const items = uniqueMissions.map(m => {
      const type = missionTypes.find(t => t.id === m.missionTypeId);
      const proj = projects.find(p => p.id === m.projectId);
      
      let days = 1;
      try {
        const start = new Date(m.startDate);
        const end = new Date(m.endDate);
        days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);
      } catch (e) {
        console.error(e);
      }

      const rawAllowances = m.allowances;
      let allowances = Array.isArray(rawAllowances) 
        ? rawAllowances 
        : (typeof rawAllowances === 'string' ? JSON.parse(rawAllowances) : []);

      if (!Array.isArray(allowances) || allowances.length === 0) {
        if (type?.allowances) {
          try {
            allowances = typeof type.allowances === 'string' ? JSON.parse(type.allowances) : type.allowances;
          } catch (e) {
            allowances = [];
          }
        }
        // Also check if linked by projectId in missionTypes (Cost Matrix)
        if ((!Array.isArray(allowances) || allowances.length === 0) && m.projectId) {
          const linkedType = (missionTypes || []).find(t => {
            let pIds: string[] = [];
            try {
              pIds = Array.isArray(t.projectIds) ? t.projectIds : (typeof t.projectIds === 'string' ? JSON.parse(t.projectIds) : []);
            } catch (_) {}
            return Array.isArray(pIds) && pIds.includes(m.projectId!);
          });
          if (linkedType?.allowances) {
            try {
              allowances = typeof linkedType.allowances === 'string' ? JSON.parse(linkedType.allowances) : linkedType.allowances;
            } catch (_) {}
          }
        }
        // Fallback to type.allowanceAmount if defined
        if ((!Array.isArray(allowances) || allowances.length === 0) && type?.allowanceAmount && Number(type.allowanceAmount) > 0) {
          allowances = [{
            id: 'default_allowance',
            name: type.name || t('بدل مأمورية'),
            amount: Number(type.allowanceAmount),
            type: 'Daily'
          }];
        }
      }

      let mTotal = 0;
      const allowanceBreakdown = (Array.isArray(allowances) ? allowances : []).map((a: any) => {
        const amt = Number(a.amount) || 0;
        const isDaily = a.type === 'Daily' || a.type === 'يومي';
        const lineTotal = isDaily ? amt * days : amt;
        mTotal += lineTotal;
        return {
          id: a.id || String(Math.random()),
          name: a.name || t('بدل مأمورية'),
          rate: amt,
          type: isDaily ? 'Daily' : 'Once',
          total: lineTotal
        };
      });

      totalAmount += mTotal;

      return {
        id: m.id,
        startDate: m.startDate,
        endDate: m.endDate,
        days,
        status: m.status,
        notes: m.notes,
        typeName: type?.name || t('مأمورية عمل'),
        projectName: proj?.name || t('غير مرتبط بمشروع'),
        total: mTotal,
        allowanceBreakdown
      };
    });

    return {
      missionsCount: uniqueMissions.length,
      totalAmount,
      items
    };
  };

  // Get active advances (to liquidate) for an employee in the selected month
  const getEmployeeAdvancesInfo = (empId: string) => {
    const empAdvances = advances.filter(a => 
      a.employeeId === empId && 
      a.month === selectedMonth &&
      (a.status === 'Paid' || a.status === 'Liquidated')
    );
    const totalAdvAmount = empAdvances.reduce((sum, a) => sum + (a.amount || 0), 0);
    return {
      records: empAdvances,
      totalAdvances: totalAdvAmount
    };
  };

  const handleOpenPayModal = (empId: string) => {
    const info = getEmployeeMissionsInfo(empId);
    const advInfo = getEmployeeAdvancesInfo(empId);
    
    const docId = `${empId}_${selectedMonth}`;
    const disRecord = disbursals[docId];
    
    const totalPaid = disRecord ? Number(disRecord.paidAmount) : 0;
    const netFinalDue = Math.max(0, info.totalAmount - advInfo.totalAdvances);
    const remainingToPay = Math.max(0, netFinalDue - totalPaid);

    setPayForm({
      paymentMethod: 'Bank',
      amountToPay: remainingToPay,
      reference: '',
      notes: ''
    });
    setPayingEmpId(empId);
  };

  // Execute partial or complete payment
  const handleExecutePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingEmpId) return;

    const empId = payingEmpId;
    const info = getEmployeeMissionsInfo(empId);
    const advInfo = getEmployeeAdvancesInfo(empId);
    
    const docId = `${empId}_${selectedMonth}`;
    const disRecord = disbursals[docId];
    
    const prevPaid = disRecord ? Number(disRecord.paidAmount) : 0;
    const netFinalDue = Math.max(0, info.totalAmount - advInfo.totalAdvances);
    const remainingToPay = Math.max(0, netFinalDue - prevPaid);

    const payVal = Number(payForm.amountToPay);
    if (isNaN(payVal) || payVal <= 0) {
      alert('يرجى إدخال مبلغ صحيح للصرف قيمته أكبر من صفر');
      return;
    }

    if (payVal > remainingToPay) {
      alert(`عذرًا! لا يمكنك صرف مبلغ أكبر من القيمة المتبقية للسداد (${remainingToPay} ج.م.)`);
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      // Create new payment record
      const newPayment: MissionPaymentRecord = {
        paymentId: 'pmt_' + crypto.randomUUID(),
        amount: payVal,
        paymentMethod: payForm.paymentMethod,
        reference: payForm.reference || undefined,
        notes: payForm.notes || undefined,
        disbursedAt: new Date().toISOString()
      };

      // Reconstruct historical payments list
      let parsedPayments: MissionPaymentRecord[] = [];
      if (disRecord && disRecord.payments) {
        try {
          parsedPayments = JSON.parse(disRecord.payments);
        } catch (_) {
          parsedPayments = [];
        }
      }
      const updatedPayments = [...parsedPayments, newPayment];
      const newPaidTotal = prevPaid + payVal;
      
      // Determine new status
      const newStatus = newPaidTotal >= netFinalDue ? 'Approved' : 'Partial';

      const updatedRecord: MissionDisbursal = {
        id: docId,
        employeeId: empId,
        month: selectedMonth,
        totalAmount: info.totalAmount,
        paidAmount: newPaidTotal,
        status: newStatus,
        payments: JSON.stringify(updatedPayments),
        notes: payForm.notes || undefined
      };

      const exists = !!disbursals[docId];
      const url = exists ? `/api/mission-disbursals/${docId}` : '/api/mission-disbursals';
      const method = exists ? 'PUT' : 'POST';

      // 1. Save Disbursal
      const disRes = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedRecord)
      });

      if (!disRes.ok) throw new Error(t('فشل حفظ المعاملة بموديول الصرف المستقل'));

      // 2. Liquidate associated financial advances (عهود) if any exist
      if (advInfo.records.length > 0) {
        for (const adv of advInfo.records) {
          if (adv.status !== 'Liquidated') {
            await fetch(`/api/financial-advances/${adv.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                ...adv,
                status: 'Liquidated'
              })
            });
          }
        }
      }

      await loadData();
      setPayingEmpId(null);
      alert(`تم بنجاح صرف دفعة بقيمة ${formatCurrency(payVal)} ج.م. للموظف وتسجيل التصفية!`);
    } catch (err: any) {
      alert('خطأ أثناء الصرف: ' + err.message);
    }
  };

  // Reset all payments
  const handleResetDisbursal = async (empId: string) => {
    if (!window.confirm(t(t('تحذير! هل أنت متأكد من مسح جميع دفعات الصرف المسجلة وإعادة السجل للحالة الافتراضية؟ سيتم إرجاع العهود لحالة بانتظار التصفية.')))) return;
    try {
      const docId = `${empId}_${selectedMonth}`;
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const res = await fetch(`/api/mission-disbursals/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        // Also revert advances for this month back to "Paid" (صرفت ولم تصفى)
        const advInfo = getEmployeeAdvancesInfo(empId);
        for (const adv of advInfo.records) {
          await fetch(`/api/financial-advances/${adv.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              ...adv,
              status: 'Paid'
            })
          });
        }

        await loadData();
        alert('تم تصفير الدفعات وإعادة العينات لانتظار الصرف المستقل.');
      }
    } catch (err: any) {
      alert('فشل التراجع عن الصرف: ' + err.message);
    }
  };

  // Disburse All Group Action (Draft -> fully paid in 1-Click for ready employees without pending advances)
  const handleDisburseAll = async (targetEligibleEmployees: { empId: string, amount: number, finalNet: number }[]) => {
    if (!window.confirm(`هل أنت متأكد من صرف دفعة كاملة لعدد ${targetEligibleEmployees.length} موظف بشكل فوري؟`)) return;
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      let successCount = 0;
      for (const item of targetEligibleEmployees) {
        const docId = `${item.empId}_${selectedMonth}`;
        const advInfo = getEmployeeAdvancesInfo(item.empId);

        const newPayment: MissionPaymentRecord = {
          paymentId: 'pmt_' + crypto.randomUUID(),
          amount: item.finalNet,
          paymentMethod: 'Bank',
          notes: t('صرف جماعي تلقائي عبر موديول المأموريات المنفصل'),
          disbursedAt: new Date().toISOString()
        };

        const updatedRecord: MissionDisbursal = {
          id: docId,
          employeeId: item.empId,
          month: selectedMonth,
          totalAmount: item.amount,
          paidAmount: item.finalNet,
          status: 'Approved',
          payments: JSON.stringify([newPayment]),
          notes: t('صرف جماعي ذكي ومستقل')
        };

        const exists = !!disbursals[docId];
        const url = exists ? `/api/mission-disbursals/${docId}` : '/api/mission-disbursals';
        const method = exists ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(updatedRecord)
        });

        if (res.ok) {
          successCount++;
          // Liquidate advances
          for (const adv of advInfo.records) {
            await fetch(`/api/financial-advances/${adv.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                ...adv,
                status: 'Liquidated'
              })
            });
          }
        }
      }

      await loadData();
      alert(`تم بنجاح صرف بدلات المأموريات لعدد ${successCount} موظف جماعياً!`);
    } catch (err: any) {
      alert("حدث خطأ أثناء الصرف الجماعي: " + err.message);
    }
  };

  // Filter processes
  const eligibleEmployees = employees.filter(emp => {
    const info = getEmployeeMissionsInfo(emp.id);
    const matchesSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          emp.employeeId.includes(searchTerm);
    return info.missionsCount > 0 && matchesSearch;
  });

  // Aggregations
  let totalMissionsCount = 0;
  let totalAmountDueAll = 0;
  let totalAdvancesAll = 0;
  let totalPaidAll = 0;

  eligibleEmployees.forEach(emp => {
    const info = getEmployeeMissionsInfo(emp.id);
    const advInfo = getEmployeeAdvancesInfo(emp.id);
    const disRecord = disbursals[`${emp.id}_${selectedMonth}`];

    totalMissionsCount += info.missionsCount;
    totalAmountDueAll += info.totalAmount;
    totalAdvancesAll += advInfo.totalAdvances;
    totalPaidAll += disRecord ? Number(disRecord.paidAmount) : 0;
  });

  const totalOutstanding = Math.max(0, (totalAmountDueAll - totalAdvancesAll) - totalPaidAll);

  const toggleExpand = (empId: string) => {
    setExpandedEmployees(prev => ({ ...prev, [empId]: !prev[empId] }));
  };

  // Export spreadsheet
  const handleExportExcel = () => {
    const dataRows = eligibleEmployees.map((emp, idx) => {
      const info = getEmployeeMissionsInfo(emp.id);
      const advInfo = getEmployeeAdvancesInfo(emp.id);
      const disRecord = disbursals[`${emp.id}_${selectedMonth}`];
      
      const paid = disRecord ? disRecord.paidAmount : 0;
      const advancesSum = advInfo.totalAdvances;
      const netFinal = Math.max(0, info.totalAmount - advancesSum);
      const remaining = Math.max(0, netFinal - paid);

      return {
        [t('م')]: idx + 1,
        [t('الرقم الوظيفي')]: emp.employeeId,
        [t('اسم الموظف')]: emp.name,
        [t('اسم البنك')]: emp.bankCode || '-',
        [t('رقم الايبان')]: emp.bankAccount || '-',
        [t('إجمالي البدلات')]: info.totalAmount,
        [t('تصفية العهد المسبقة')]: advancesSum,
        [t('صافي الدخل المستحق')]: netFinal,
        [t('المدفوع حالياً')]: paid,
        [t('المتبقي للسداد')]: remaining,
        [t('طبيعة الحالة')]: remaining === 0 ? t('مغلق ومسدد') : (paid > 0 ? t('مسدد جزئياً') : t('بانتظار الصرف الأول'))
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('مسير صرف بدلات المأموريات'));
    worksheet['!dir'] = 'rtl';
    XLSX.writeFile(workbook, `مسير_صرف_المأموريات_${selectedMonth}.xlsx`);
  };

  const draftDisbursalsList = eligibleEmployees
    .filter(emp => {
      const disRecord = disbursals[`${emp.id}_${selectedMonth}`];
      return !disRecord || disRecord.status !== 'Approved';
    })
    .map(emp => {
      const info = getEmployeeMissionsInfo(emp.id);
      const advInfo = getEmployeeAdvancesInfo(emp.id);
      const prevPaid = disbursals[`${emp.id}_${selectedMonth}`]?.paidAmount || 0;
      const netFinal = Math.max(0, info.totalAmount - advInfo.totalAdvances);
      return {
        empId: emp.id,
        amount: info.totalAmount,
        finalNet: Math.max(0, netFinal - prevPaid)
      };
    })
    .filter(x => x.finalNet > 0);

  return (
    <div className="space-y-8 p-1 md:p-6 text-right" dir="rtl">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div>
          <span className="px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full text-xs font-black tracking-widest uppercase">{t('SUP MODULE - نظام الصرف والبدلات المستقل')}</span>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mt-1.5 flex items-center gap-3">
            <Plane className="w-8 h-8 text-teal-500 animate-pulse" />
            <span>{t('مسيرات وصرف بدلات المأموريات')}</span>
          </h2>
          <p className="text-sm text-slate-400 font-bold mt-1">{t('إمكانية الصرف الجزئي، تتبع المتبقي بوضوح، تصفية فورية وتنزيل للعهود المالية كمقاصة من إجمالي المستحق')}</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-4 py-2.5 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input 
              type="month" 
              className="bg-transparent text-sm font-black text-slate-700 dark:text-slate-200 outline-none"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          </div>

          <button 
            onClick={handleExportExcel}
            className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm flex items-center justify-center gap-2 font-bold text-xs cursor-pointer focus:ring-1 focus:ring-teal-500"
            title={t('تصدير Excel لمالية المنشأة')}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">{t('كشف المقاصة والبدلات (Excel)')}</span>
          </button>
        </div>
      </div>

      {/* Numerical Stats Widgets bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('إجمالي البدلات المستحقة'), val: formatCurrency(totalAmountDueAll), desc: t('المستحقات دون العهود'), icon: DollarSign, bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-600 dark:text-indigo-400' },
          { label: t('مبالغ عهود لتصفيتها'), val: formatCurrency(totalAdvancesAll), desc: t('عهود مصروفة مسبقاً وتخصم الآن'), icon: TrendingDown, bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-600 dark:text-amber-400 font-extrabold' },
          { label: t('إجمالي المبالغ المسددة فعلياً'), val: formatCurrency(totalPaidAll), desc: t('إجمالي المبالغ المصروفة للبدلات'), icon: CheckCircle2, bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-600 dark:text-emerald-400' },
          { label: t('إجمالي المتبقي المستقبلي للسداد'), val: formatCurrency(totalOutstanding), desc: t('ذمم مالية متبقية بانتظار السداد'), icon: Coins, bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-600 dark:text-rose-400' }
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[2rem] shadow-sm flex items-center justify-between transition-all hover:translate-y-[-2px]">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-lg md:text-2xl font-black text-slate-900 dark:text-white tabular-nums">{stat.val}</p>
              <p className="text-[10px] font-bold text-slate-400/80">{stat.desc}</p>
            </div>
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg, stat.text)}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Filtering area */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            className="w-full pr-11 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none font-bold text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 transition-all text-right"
            placeholder={t('بحث باسم الموظف أو الرقم الوظيفي...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {draftDisbursalsList.length > 0 && (
          <button 
            onClick={() => handleDisburseAll(draftDisbursalsList)}
            className="w-full md:w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>تسجيل صرف البدلات كاملة جماعياً ({draftDisbursalsList.length} موظفين)</span>
          </button>
        )}
      </div>

      {/* Main List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-sm overflow-hidden animate-fade-in">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400 font-bold">{t('جاري تحميل كشوفات البدلات والمقاصة والعهد...')}</p>
          </div>
        ) : eligibleEmployees.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="inline-flex p-5 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300 dark:text-slate-600">
              <Plane className="w-12 h-12" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-slate-700 dark:text-slate-200">لا توجد مأموريات عمل معتمدة لشهر {selectedMonth}</p>
              <p className="text-xs text-slate-400 font-bold">{t('لم يسجل الموظفون مأموريات معتمدة لهذا الشهر بعد')}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right divide-y divide-slate-100 dark:divide-slate-800">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 text-xs font-black uppercase tracking-wider">
                  <th className="px-8 py-5">{t('الموظف')}</th>
                  <th className="px-6 py-5 text-center">{t('إجمالي البدلات')}</th>
                  <th className="px-6 py-5 text-center">{t('العهدة المصفاة (خصم)')}</th>
                  <th className="px-6 py-5 text-center">{t('الصافي المطلوب')}</th>
                  <th className="px-6 py-5 text-center">{t('المدفوع حتي الآن')}</th>
                  <th className="px-6 py-5 text-center">{t('المتبقي للسداد')}</th>
                  <th className="px-6 py-5 text-center">{t('تفاصيل عمليات الصرف')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/40 font-semibold text-slate-700 dark:text-slate-200 text-sm">
                {eligibleEmployees.map((emp) => {
                  const info = getEmployeeMissionsInfo(emp.id);
                  const advInfo = getEmployeeAdvancesInfo(emp.id);
                  const docId = `${emp.id}_${selectedMonth}`;
                  const disRecord = disbursals[docId];

                  const paid = disRecord ? Number(disRecord.paidAmount) : 0;
                  const advancesSum = advInfo.totalAdvances;
                  const netFinal = Math.max(0, info.totalAmount - advancesSum);
                  const remaining = Math.max(0, netFinal - paid);
                  
                  const isExpanded = expandedEmployees[emp.id] || false;

                  return (
                    <React.Fragment key={emp.id}>
                      <tr className={cn(
                        "hover:bg-slate-50/50 dark:hover:bg-slate-800/10 cursor-pointer transition-all",
                        remaining === 0 && netFinal > 0 && "bg-emerald-50/10 dark:bg-emerald-950/5"
                      )} onClick={() => toggleExpand(emp.id)}>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 font-extrabold shadow-inner uppercase">
                              {emp.name[0]}
                            </div>
                            <div>
                              <p className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{emp.name}</span>
                                <span className="text-[10px] px-2 py-0.5 bg-slate-150 dark:bg-slate-800 rounded-md text-slate-400 font-bold uppercase tracking-wider">ID: {emp.employeeId}</span>
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5 font-semibold">
                                {emp.jobTitle} | {emp.paymentMethod === 'Bank' ? `تحويل بنكي ${emp.bankCode || ''}` : t('نقداً في الفرع')}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5 text-center font-black text-slate-900 dark:text-white tabular-nums">
                          {formatCurrency(info.totalAmount)}
                        </td>

                        <td className="px-6 py-5 text-center text-amber-600 dark:text-amber-400 font-extrabold tabular-nums">
                          {advancesSum > 0 ? `-${formatCurrency(advancesSum)}` : '0.00'}
                        </td>

                        <td className="px-6 py-5 text-center font-black text-slate-950 dark:text-slate-100 tabular-nums">
                          {formatCurrency(netFinal)}
                        </td>

                        <td className="px-6 py-5 text-center text-emerald-600 dark:text-emerald-400 font-extrabold tabular-nums">
                          {formatCurrency(paid)}
                        </td>

                        <td className="px-6 py-5 text-center">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-xs font-black tabular-nums border",
                            remaining === 0 && netFinal > 0
                              ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                              : remaining > 0 && paid > 0
                                ? "bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                                : "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30"
                          )}>
                            {remaining === 0 && netFinal > 0 ? t('مغلق ومسدد') : formatCurrency(remaining)}
                          </span>
                        </td>

                        <td className="px-6 py-5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            {remaining > 0 ? (
                              <button 
                                onClick={() => handleOpenPayModal(emp.id)}
                                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1 active:scale-95 cursor-pointer"
                              >
                                <Check className="w-3" />
                                <span>{t('صرف دفعة')}</span>
                              </button>
                            ) : null}

                            {paid > 0 && (
                              <button 
                                onClick={() => handleResetDisbursal(emp.id)}
                                className="p-1.5 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg transition-colors cursor-pointer"
                                title={t('مسح الصرف وتصفير البيانات')}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}

                            <button 
                              onClick={() => toggleExpand(emp.id)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Section showing allowance breakdowns and advance details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} className="bg-slate-50/40 dark:bg-slate-900/40 px-10 py-6 text-right">
                              <motion.div 
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="space-y-6"
                              >
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                  {/* Allowances details list */}
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                      <FileText className="w-4 h-4 text-teal-500" />
                                      <span>كشف مأموريات وبدلات {emp.name}:</span>
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {info.items.map((mission, mIdx) => (
                                        <div key={mIdx} className="bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm space-y-2.5">
                                          <div className="flex justify-between items-start border-b border-slate-50 dark:border-slate-800/50 pb-2">
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <p className="text-xs font-black text-slate-800 dark:text-slate-100">{mission.typeName}</p>
                                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] font-mono text-slate-500 rounded">
                                                  #{mission.id.slice(0, 8)}
                                                </span>
                                              </div>
                                              <p className="text-[10px] text-slate-400 font-bold tracking-tight mt-0.5">
                                                {t('المشروع')}: {mission.projectName}
                                              </p>
                                            </div>
                                            <div className="text-left space-y-0.5">
                                              <span className="px-2 py-0.5 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-md text-[10px] font-black tabular-nums block">
                                                {mission.days} {t('أيام')}
                                              </span>
                                              <span className="text-[9px] text-slate-400 font-bold block">
                                                {mission.startDate} → {mission.endDate}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="space-y-1.5 text-xs">
                                            {mission.allowanceBreakdown.map((ab: any, abIdx: number) => (
                                              <div key={abIdx} className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                                                <span>
                                                  {ab.name} {ab.type === 'Daily' ? `(${formatCurrency(ab.rate)}/يوم)` : `(مقطوعة)`}
                                                </span>
                                                <span className="font-extrabold text-slate-800 dark:text-slate-200 tabular-nums">
                                                  {formatCurrency(ab.total)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>

                                          <div className="flex justify-between items-center border-t border-slate-50 dark:border-slate-800/30 pt-2 text-xs">
                                            <span className="font-extrabold text-slate-400">{t('إجمالي المستحق:')}</span>
                                            <span className="font-black text-teal-600 dark:text-teal-400 tabular-nums">
                                              {formatCurrency(mission.total)}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Advances (العهود) details list */}
                                  <div className="space-y-3">
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                      <Coins className="w-4 h-4 text-amber-500" />
                                      <span>{t('العهود المستلمة وتصفيتها (العهود المالية):')}</span>
                                    </h4>
                                    {advInfo.records.length === 0 ? (
                                      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl text-center">
                                        <p className="text-xs text-slate-400 font-bold">{t('لا توجد عهد مالية مسجلة أو مصروفة للموظف هذا الشهر')}</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {advInfo.records.map((adv: any, aIdx: number) => (
                                          <div key={aIdx} className="bg-white dark:bg-slate-900 px-4 py-3 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                              <Clock3 className="w-4 h-4 text-amber-500" />
                                              <div>
                                                <p className="font-black text-slate-800 dark:text-slate-100">عهدة مأمورية / مشروع: {adv.refNumber || t('سند عام')}</p>
                                                <p className="text-[10px] text-slate-400 mt-0.5 font-bold">تاريخ السحب: {format(new Date(adv.createdAt), 'yyyy-MM-dd')}</p>
                                              </div>
                                            </div>
                                            <div className="text-left">
                                              <p className="font-black text-slate-900 dark:text-white tabular-nums">{formatCurrency(adv.amount)} ج.م.</p>
                                              <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-md font-black">{t('خصم تصفية العهد المالي')}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Payment History Listing */}
                                {disRecord && disRecord.payments && (
                                  <div className="bg-white dark:bg-slate-900 p-5 border border-slate-100 dark:border-slate-800 rounded-[2rem] space-y-3">
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-slate-50 dark:border-slate-800/50 pb-2">
                                      <History className="w-4 h-4 text-emerald-500" />
                                      <span>{t('سجلات دفعات الصرف المالي لهذا الشهر:')}</span>
                                    </h4>
                                    <div className="space-y-2.5">
                                      {(() => {
                                        try {
                                          const list: MissionPaymentRecord[] = JSON.parse(disRecord.payments);
                                          if (list.length === 0) return <p className="text-xs text-slate-400 font-bold">{t('لم تصرف أي دفعات مالية بعد.')}</p>;
                                          return list.map((pay, pIdx) => (
                                            <div key={pay.paymentId} className="flex justify-between items-center text-xs p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                                              <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 flex items-center justify-center font-bold">
                                                  {pIdx + 1}
                                                </div>
                                                <div>
                                                  <p className="font-black text-slate-800 dark:text-slate-100">
                                                    دفعة صرف بدلات ({pay.paymentMethod === 'Bank' ? t('حوالة بنكية') : t('نقداً')})
                                                  </p>
                                                  <p className="text-[10px] text-slate-400 mt-0.5 font-bold">
                                                    المرجع: {pay.reference || t('بدون مرجع')} | الوقت: {formatDateTime12h(pay.disbursedAt, { lang: language })}
                                                  </p>
                                                </div>
                                              </div>
                                              <p className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                                                +{formatCurrency(pay.amount)} ج.م.
                                              </p>
                                            </div>
                                          ));
                                        } catch (_) {
                                          return null;
                                        }
                                      })()}
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pay Confirmation Modal with partial customization info */}
      <AnimatePresence>
        {payingEmpId && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setPayingEmpId(null)} 
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative bg-white dark:bg-slate-900 w-full max-w-lg p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 text-right shadow-2xl"
              dir="rtl"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <Plane className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">{t('جدولة وصرف دفعة البدلات')}</h3>
                  <p className="text-xs text-slate-400 font-bold">{t('تسجيل الصرف في شؤون المالية للشهر')}</p>
                </div>
              </div>

              <form onSubmit={handleExecutePaymentSubmit} className="space-y-4">
                {/* Micro Receipt breakdown */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs space-y-2">
                  <div className="flex justify-between text-slate-500">
                    <span>{t('إجمالي البدلات المستحقة:')}</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-150 tabular-nums">
                      {formatCurrency(getEmployeeMissionsInfo(payingEmpId).totalAmount)} ج.م.
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-600">
                    <span>{t('خصم تصفية العهد المالية (المقاصة):')}</span>
                    <span className="font-extrabold tabular-nums">
                      -{formatCurrency(getEmployeeAdvancesInfo(payingEmpId).totalAdvances)} ج.م.
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>{t('المسدد سابقاً:')}</span>
                    <span className="font-extrabold text-emerald-600 tabular-nums">
                      {formatCurrency(disbursals[`${payingEmpId}_${selectedMonth}`]?.paidAmount || 0)} ج.م.
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800 pt-2 text-sm font-black text-slate-900 dark:text-white">
                    <span>{t('صافي المتبقي الصالح للصرف:')}</span>
                    <span className="text-md text-teal-600 dark:text-teal-400 tabular-nums">
                      {formatCurrency(
                        Math.max(0, 
                          getEmployeeMissionsInfo(payingEmpId).totalAmount 
                          - getEmployeeAdvancesInfo(payingEmpId).totalAdvances
                          - (disbursals[`${payingEmpId}_${selectedMonth}`]?.paidAmount || 0)
                        )
                      )} ج.م.
                    </span>
                  </div>
                </div>

                {/* Amount to disburse */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('مبلغ دفعة الصرف الحالية')}</label>
                  <div className="relative">
                    <input 
                      type="number"
                      step="0.01"
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-teal-500 dark:border-teal-500/40 rounded-xl outline-none font-black text-sm text-teal-600 text-left pl-12"
                      placeholder="0.00"
                      value={payForm.amountToPay || ''}
                      onChange={(e) => setPayForm({ ...payForm, amountToPay: Number(e.target.value) || 0 })}
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xs text-slate-400">{t('جنيه')}</span>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('طريقة الدفع')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { val: 'Bank', label: t('تحويل بنكي / شيك'), icon: CreditCard },
                      { val: 'Cash', label: t('نقدي (الكاش)'), icon: Coins }
                    ].map((m) => (
                      <button
                        key={m.val}
                        type="button"
                        onClick={() => setPayForm({ ...payForm, paymentMethod: m.val as any })}
                        className={cn(
                          "flex items-center justify-center gap-2 py-3.5 rounded-xl border font-bold text-xs transition-all outline-none cursor-pointer",
                          payForm.paymentMethod === m.val 
                            ? "bg-teal-50/50 dark:bg-teal-950/20 border-teal-500 text-teal-600 dark:text-teal-400" 
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50"
                        )}
                      >
                        <m.icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Reference */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('رقم الحوالة أو السند')}</label>
                  <input
                    type="text"
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl outline-none text-slate-800 dark:text-slate-100 font-bold text-sm focus:ring-2 focus:ring-teal-500"
                    placeholder={t('رقم المستند والتحويل البنكي...')}
                    value={payForm.reference}
                    onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })}
                  />
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('ملاحظات للمالية')}</label>
                  <textarea
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl outline-none text-slate-800 dark:text-slate-100 font-bold text-sm focus:ring-2 focus:ring-teal-500 h-20 resize-none"
                    placeholder={t('ملاحظات توثق مع دفعة الصرف...')}
                    value={payForm.notes}
                    onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-2.5 mt-8 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl shadow-lg transition-all text-center cursor-pointer"
                  >{t('تأكيد دفع الدفعة المالية')}</button>
                  <button
                    type="button"
                    onClick={() => setPayingEmpId(null)}
                    className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 font-black text-xs rounded-xl transition-all cursor-pointer"
                  >{t('إلغاء')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
