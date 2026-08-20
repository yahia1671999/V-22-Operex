import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Calendar,
  Search,
  Filter,
  User,
  Trash2,
  X,
  Sparkles,
  Plus,
  Building2,
  CalendarPlus,
  Info
} from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc } from '../../api';
import { useData } from '../../contexts/DataContext';
import { LeaveRequest, Employee } from '../../types';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { usePermissions } from '../../hooks/usePermissions';
import { useLanguage } from '../../contexts/LanguageContext';

export const Leaves: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { employees, leaveRequests, adminDepartments = [], refreshData } = useData();
  const { canView, canEdit, canDelete } = usePermissions();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedMonth, setSelectedMonth] = useState<string>('All');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  const [viewingLeave, setViewingLeave] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedLeaveIdForReturn, setSelectedLeaveIdForReturn] = useState<string | null>(null);
  const [actualReturnDate, setActualReturnDate] = useState('');
  const [returnNotes, setReturnNotes] = useState('');

  // Official Holiday Modal state
  const [isOfficialHolidayModalOpen, setIsOfficialHolidayModalOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });
  const [isSubmittingHoliday, setIsSubmittingHoliday] = useState(false);
  const [holidaySuccessMsg, setHolidaySuccessMsg] = useState<string | null>(null);

  // Eligible employees count for attendance
  const eligibleEmployeesCount = useMemo(() => {
    return employees.filter(emp => {
      const sub = String(emp.subjectToAttendance || '').trim().toLowerCase();
      return sub !== 'no' && sub !== 'لا' && (emp as any).isSubjectToAttendance !== false;
    }).length;
  }, [employees]);

  // Rejection Reason Popup Modal state
  const [rejectionModalRequest, setRejectionModalRequest] = useState<{ id: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [mainTab, setMainTab] = useState<'leaves' | 'wfh'>('leaves');

  const handleSaveOfficialHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.name.trim() || !holidayForm.startDate || !holidayForm.endDate) {
      alert(t('يرجى ملء جميع الحقول الإلزامية: اسم الإجازة، تاريخ البداية، وتاريخ النهاية'));
      return;
    }
    if (holidayForm.endDate < holidayForm.startDate) {
      alert(t('تاريخ النهاية يجب أن يكون مساوياً أو بعد تاريخ البداية'));
      return;
    }

    setIsSubmittingHoliday(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/leave-requests/official-holiday', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: holidayForm.name.trim(),
          startDate: holidayForm.startDate,
          endDate: holidayForm.endDate,
          notes: holidayForm.notes.trim()
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || t('فشل تسجيل الإجازة الرسمية'));
      }

      await refreshData();
      setIsOfficialHolidayModalOpen(false);
      setHolidaySuccessMsg(resData.message || t('تم تطبيق الإجازة الرسمية بنجاح على جميع الموظفين الخاضعين للحضور.'));
      setTimeout(() => setHolidaySuccessMsg(null), 6000);
      setHolidayForm({
        name: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        notes: ''
      });
    } catch (err: any) {
      alert('حدث خطأ: ' + err.message);
    } finally {
      setIsSubmittingHoliday(false);
    }
  };

  const handleRequestReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLeaveIdForReturn || !actualReturnDate) return;
    try {
      const response = await fetch(`/api/leave-requests/${selectedLeaveIdForReturn}/request-return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          actualReturnDate,
          notes: returnNotes
        })
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || t('فشلت عملية تقديم طلب الرجوع'));
      }
      setReturnModalOpen(false);
      setSelectedLeaveIdForReturn(null);
      setActualReturnDate('');
      setReturnNotes('');
      await refreshData();
    } catch (err: any) {
      alert('حدث خطأ: ' + err.message);
    }
  };

  const handleApproveReturn = async (id: string) => {
    try {
      const response = await fetch(`/api/leave-requests/${id}/approve-return`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || t('فشلت عملية اعتماد الرجوع'));
      }
      await refreshData();
    } catch (err: any) {
      alert('حدث خطأ: ' + err.message);
    }
  };

  const handleRejectReturn = async (id: string) => {
    try {
      const response = await fetch(`/api/leave-requests/${id}/reject-return`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || t('فشلت عملية رفض الرجوع'));
      }
      await refreshData();
    } catch (err: any) {
      alert('حدث خطأ: ' + err.message);
    }
  };

  const handleRenewAllLeaves = async () => {
    let isConfirm = true;
    try {
      isConfirm = window.confirm(t(t('هل أنت متأكد من رغبتك في تجديد رصيد الإجازات السنوي والبدء بسنة جديدة لجميع الموظفين؟ سيتم أرشفة جميع الطلبات النشطة الحالية.')));
    } catch (e) {
      isConfirm = true;
    }
    if (!isConfirm) return;

    try {
      const response = await fetch("/api/leave-requests/renew-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("auth_token")}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t(t('فشلت عملية التجديد.')));
      }

      await refreshData();
      alert("تم تجديد رصيد جميع الموظفين بنجاح وتصفير الإجازات المستهلكة.");
    } catch (err: any) {
      alert("حدث خطأ أثناء التجديد: " + err.message);
    }
  };

  const hasViewAccess = canView('leaveRequests') || canView('leaves');

  const filteredRequests = useMemo(() => {
    if (!hasViewAccess) return [];
    return leaveRequests
      .filter(r => {
        // Skip archived ones during conventional pending/approved view if we filter strictly
        if ((r.status as string) === 'Renewed_Archived') return false;

        // Separate leaves from work from home requests
        if (mainTab === 'leaves' && r.type === 'WorkFromHome') return false;
        if (mainTab === 'wfh' && r.type !== 'WorkFromHome') return false;

        const emp = employees.find(e => e.id === r.employeeId);
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || (
          emp?.name.toLowerCase().includes(searchLower) ||
          emp?.employeeId.toLowerCase().includes(searchLower) ||
          (r.reason || '').toLowerCase().includes(searchLower)
        );
        const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
        
        let matchesMonth = true;
        if (selectedMonth !== 'All' && r.startDate) {
          const m = r.startDate.substring(5, 7);
          matchesMonth = m === selectedMonth;
        }

        let matchesYear = true;
        if (selectedYear !== 'All' && r.startDate) {
          const y = r.startDate.substring(0, 4);
          matchesYear = y === selectedYear;
        }

        return matchesSearch && matchesStatus && matchesMonth && matchesYear;
      })
      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());
  }, [leaveRequests, employees, searchTerm, statusFilter, selectedMonth, selectedYear, hasViewAccess, mainTab]);

  if (!hasViewAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-card border border-border text-center">
        <p className="text-lg font-black text-destructive uppercase tracking-widest leading-relaxed">{t('عذرًا، ليس لديك صلاحيات كافية لزيارة هذه الصفحة.')}</p>
        <p className="text-xs font-bold text-muted-foreground mt-2 italic">{t('يرجى التواصل مع إدارة النظام لتفعيل الصلاحية المطلوبة.')}</p>
      </div>
    );
  }

  const handleUpdateStatus = async (id: string, status: 'Approved' | 'Rejected', note?: string) => {
    try {
      await setDoc(doc(db, 'leaveRequests', id), { 
        status, 
        reviewNote: note || '',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      await refreshData();
    } catch (error: any) {
      alert('حدث خطأ أثناء تحديث الحالة: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async (id: string) => {
    await deleteDoc(doc(db, 'leaveRequests', id));
    await refreshData();
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'Approved':
        return <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-none text-xs font-black border border-emerald-500/20">{t('معتمدة')}</span>;
      case 'Rejected':
        return <span className="px-3 py-1 bg-destructive/10 text-destructive rounded-none text-xs font-black border border-destructive/20">{t('مرفوضة')}</span>;
      default:
        return <span className="px-3 py-1 bg-orange-500/10 text-orange-600 rounded-none text-xs font-black border border-orange-500/20">{t('قيد الانتظار')}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-card p-8 rounded-none border border-border shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-orange-500/10 rounded-none flex items-center justify-center text-orange-600">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">{t('إدارة الإجازات والعمل من المنزل')}</h2>
            <p className="text-muted-foreground font-bold italic">{t('مراجعة واعتماد طلبات الإجازات والعمل من المنزل المقدمة من الموظفين')}</p>
          </div>
        </div>
      </div>

      {/* Horizontal Tabs */}
      <div className="flex gap-4 border-b border-border/60">
        <button
          onClick={() => setMainTab('leaves')}
          className={cn(
            "px-6 py-3.5 font-black text-xs uppercase tracking-wider border-b-4 transition-all cursor-pointer outline-none",
            mainTab === 'leaves' ? "border-orange-500 text-orange-600 font-extrabold" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t('إدارة الإجازات')}
        </button>
        <button
          onClick={() => setMainTab('wfh')}
          className={cn(
            "px-6 py-3.5 font-black text-xs uppercase tracking-wider border-b-4 transition-all cursor-pointer outline-none",
            mainTab === 'wfh' ? "border-orange-500 text-orange-600 font-extrabold" : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          {t('طلبات العمل من المنزل')}
        </button>
      </div>

      {/* Filters & Actions */}
      <div className="bg-card p-6 border border-border space-y-4">
        {holidaySuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-black flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{holidaySuccessMsg}</span>
            </div>
            <button onClick={() => setHolidaySuccessMsg(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 transition-colors group-focus-within:text-primary" />
            <input 
              type="text" 
              placeholder={t('بحث في الطلبات...')}
              className="w-full pr-12 pl-4 py-3 bg-muted/40 border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold text-foreground transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              onClick={() => {
                setHolidayForm({
                  name: '',
                  startDate: format(new Date(), 'yyyy-MM-dd'),
                  endDate: format(new Date(), 'yyyy-MM-dd'),
                  notes: ''
                });
                setIsOfficialHolidayModalOpen(true);
              }}
              className="flex-1 lg:flex-none px-6 py-3 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black text-xs uppercase tracking-wider rounded-none shadow-md inline-flex items-center justify-center gap-2 cursor-pointer transition-all border-none"
              title={t('إضافة إجازة رسمية معتمدة لجميع الموظفين')}
            >
              <Sparkles className="w-4 h-4" />
              {t('إضافة إجازة رسمية')}
            </button>

            <button
              onClick={handleRenewAllLeaves}
              className="flex-1 lg:flex-none px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-black text-xs uppercase tracking-wider rounded-none shadow-md inline-flex items-center justify-center gap-2 cursor-pointer transition-all border-none"
              title={t('تصفير وأرشفة الإجازات لبدء دورة رصيد جديدة')}
            >
              <Calendar className="w-4 h-4" />{t('تجديد أرصدة الإجازات السنوية لجميع الموظفين')}</button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between pt-2 border-t border-border/40">
          <div className="flex gap-2 p-1 bg-muted rounded-none w-fit border border-border">
            {['All', 'Pending', 'Approved', 'Rejected'].map((status) => (
              <button 
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "px-5 py-2 rounded-none text-xs font-black transition-all uppercase tracking-widest outline-none cursor-pointer",
                  statusFilter === status ? "bg-card text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {status === 'All' ? t('الكل') : status === 'Pending' ? t('قيد الانتظار') : status === 'Approved' ? t('معتمدة') : t('مرفوضة')}
              </button>
            ))}
          </div>

          <div className="flex gap-4 items-center w-full md:w-auto text-right">
            {/* Month Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-muted-foreground whitespace-nowrap">{t('الشهر:')}</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-card border border-border text-xs font-bold text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-primary rounded-none"
              >
                <option value="All">{t('الكل (Months)')}</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const mStr = String(i + 1).padStart(2, '0');
                  return (
                    <option key={mStr} value={mStr}>
                      {mStr}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Year Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-black text-muted-foreground whitespace-nowrap">{t('السنة:')}</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-card border border-border text-xs font-bold text-foreground px-3 py-2 outline-none focus:ring-2 focus:ring-primary rounded-none"
              >
                <option value="All">{t('الكل (Years)')}</option>
                {['2024', '2025', '2026', '2027', '2028'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-card rounded-none border border-border shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border text-xs font-black text-muted-foreground uppercase tracking-widest">
                <th className="px-8 py-6 text-right">{t('الموظف')}</th>
                <th className="px-8 py-6 text-right">{t('النوع')}</th>
                <th className="px-8 py-6 text-right">{t('الفترة')}</th>
                <th className="px-8 py-6 text-right">{t('السبب')}</th>
                <th className="px-8 py-6 text-right">{t('الحالة')}</th>
                <th className="px-8 py-6 text-left">{t('الإجراءات')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRequests.map((r) => {
                const emp = employees.find(e => e.id === r.employeeId);
                return (
                  <tr 
                    key={r.id} 
                    onClick={() => setViewingLeave({ ...r, employee: emp })}
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-none flex items-center justify-center font-black text-orange-600 shadow-sm transition-transform group-hover:scale-105">
                           {emp?.name?.[0] || 'U'}
                        </div>
                        <div>
                           <p className="font-black text-foreground leading-tight">{emp?.name || t('موظف مجهول')}</p>
                           <p className="text-xs text-muted-foreground font-bold">#{emp?.employeeId}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {r.type === 'Sick' ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400">{t('مرضية')}</span>
                      ) : r.type === 'Annual' || r.type === 'Vacation' ? (
                        <span className="font-bold text-sky-600 dark:text-sky-400">{t('سنوية')}</span>
                      ) : r.type === 'WorkFromHome' ? (
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{t('العمل من المنزل')}</span>
                      ) : r.type === 'OfficialHoliday' || r.type === 'Official' || r.type === 'إجازة رسمية' ? (
                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-black text-xs inline-flex items-center gap-1.5 rounded-none">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          {t('إجازة رسمية')}
                        </span>
                      ) : (
                        <span className="font-bold text-muted-foreground">{t('بدون راتب')}</span>
                      )}
                    </td>
                    <td className="px-8 py-6 text-sm">
                      <div className="flex items-center gap-2 font-bold text-muted-foreground">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <span className="text-foreground">{r.startDate}</span> <span className="text-[10px] text-muted-foreground px-1 border border-border bg-muted">{t('إلى')}</span> <span className="text-foreground">{r.endDate}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <p className="text-xs text-muted-foreground font-medium max-w-[200px] truncate leading-relaxed" title={r.reason}>
                        {r.reason || '-'}
                      </p>
                    </td>
                    <td className="px-8 py-6 text-xs font-black">
                      {getStatusBadge(r.status)}
                      {r.returnRequestStatus && (
                        <div className="mt-2 text-right">
                          {r.returnRequestStatus === 'Pending' && (
                            <span className="inline-block px-2.5 py-1 bg-amber-500/10 text-amber-600 rounded-none text-[10px] font-black border border-amber-500/20">{t('طلب رجوع قيد الانتظار')}</span>
                          )}
                          {r.returnRequestStatus === 'Approved' && (
                            <span className="inline-block px-2.5 py-1 bg-emerald-500/10 text-emerald-600 rounded-none text-[10px] font-black border border-emerald-500/20">{t('تم الرجوع مبكراً للعمل')}</span>
                          )}
                          {r.returnRequestStatus === 'Rejected' && (
                            <span className="inline-block px-2.5 py-1 bg-rose-500/10 text-rose-600 rounded-none text-[10px] font-black border border-rose-500/20">{t('تم رفض طلب الرجوع')}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-8 py-6" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                         {r.status === 'Pending' && canEdit('leaveRequests') && (
                           <>
                             <button 
                               onClick={() => handleUpdateStatus(r.id, 'Approved')}
                               className="p-2 bg-emerald-500/10 text-emerald-600 rounded-none hover:bg-emerald-500/20 border border-emerald-500/20 transition-all outline-none"
                               title={t('اعتماد')}
                             >
                               <CheckCircle2 className="w-5 h-5" />
                             </button>
                             <button 
                               onClick={() => {
                                  setRejectionModalRequest({ id: r.id });
                                  setRejectionReason('');
                                }}
                               className="p-2 bg-destructive/10 text-destructive rounded-none hover:bg-destructive/20 border border-destructive/20 transition-all outline-none"
                               title={t('رفض')}
                             >
                               <XCircle className="w-5 h-5" />
                             </button>
                           </>
                         )}
                         {r.status === 'Approved' && !r.returnRequestStatus && (
                           <button 
                             onClick={() => {
                               setSelectedLeaveIdForReturn(r.id);
                               setActualReturnDate(new Date().toISOString().split('T')[0]);
                               setReturnModalOpen(true);
                             }}
                             className="px-3 py-1.5 bg-blue-500/10 text-blue-600 rounded-none hover:bg-blue-500 hover:text-white font-black border border-blue-500/20 transition-all text-xs mr-2"
                             title={t('تسجيل رجوع مبكر')}
                           >{t('طلب رجوع مبكر')}</button>
                         )}
                         {r.returnRequestStatus === 'Pending' && canEdit('leaveRequests') && (
                           <div className="flex gap-1.5 mr-2">
                             <button 
                               onClick={() => handleApproveReturn(r.id)}
                               className="px-2.5 py-1.5 bg-emerald-500/15 text-emerald-600 rounded-none hover:bg-emerald-500 hover:text-white font-black border border-emerald-500/30 transition-all text-[11px]"
                               title={t('اعتماد طلب الرجوع من الإجازة')}
                             >{t('اعتماد الرجوع')}</button>
                             <button 
                               onClick={() => handleRejectReturn(r.id)}
                               className="px-2.5 py-1.5 bg-destructive/15 text-destructive rounded-none hover:bg-destructive hover:text-white font-black border border-destructive/30 transition-all text-[11px]"
                               title={t('رفض طلب الرجوع من الإجازة')}
                             >{t('رفض الرجوع')}</button>
                           </div>
                         )}
                         {canDelete('leaveRequests') && (
                           <button 
                             onClick={() => handleDelete(r.id)}
                             className="p-2 bg-muted text-muted-foreground rounded-none hover:bg-destructive hover:text-destructive-foreground border border-border transition-all outline-none"
                             title={t('حذف')}
                           >
                             <Trash2 className="w-4 h-4" />
                           </button>
                         )}
                         {!canEdit('leaveRequests') && !canDelete('leaveRequests') && (
                           <span className="text-xs text-muted-foreground italic font-bold">{t('لا يوجد صلاحيات')}</span>
                         )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-muted-foreground font-bold italic uppercase tracking-widest text-sm">{t('لا توجد طلبات إجازة مطابقة للبحث')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Return Early Request Modal */}
      <AnimatePresence>
        {returnModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setReturnModalOpen(false)} 
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-none shadow-2xl overflow-hidden border border-border z-10 text-right p-8"
              dir="rtl"
            >
              <h3 className="text-xl font-black text-foreground mb-1">{t('تسجيل الرجوع من الإجازة لحاجة العمل')}</h3>
              <p className="text-xs text-muted-foreground font-bold mb-6">{t('سيتم إعادة احتساب مدة الإجازة تلقائياً وإرسال طلب اعتماد للمدير المباشر')}</p>
              
              <form onSubmit={handleRequestReturn} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block mr-1 font-black">{t('تاريخ الرجوع الفعلي للعمل / Actual Return Date')}</label>
                  <input 
                    type="date" 
                    required 
                    className="w-full px-4 py-3 bg-card border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold dark:text-white"
                    value={actualReturnDate} 
                    onChange={(e) => setActualReturnDate(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-muted-foreground uppercase tracking-wider block mr-1 font-black">{t('السبب أو الملاحظات / Notes')}</label>
                  <textarea 
                    className="w-full px-4 py-3 bg-card border border-border rounded-none outline-none focus:ring-2 focus:ring-primary font-bold h-24 dark:text-white text-sm"
                    value={returnNotes} 
                    onChange={(e) => setReturnNotes(e.target.value)} 
                    placeholder={t('اكتب سبب الحاجة لقطع الإجازة السنوية أو المرضية...')}
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button 
                    type="button" 
                    onClick={() => setReturnModalOpen(false)}
                    className="px-5 py-2 text-xs font-black hover:bg-muted border border-border rounded-none text-muted-foreground uppercase transition-all"
                  >{t('إلغاء')}</button>
                  <button 
                    type="submit"
                    className="px-6 py-2 text-xs font-black bg-blue-600 text-white hover:bg-blue-700 rounded-none uppercase transition-all shadow-sm"
                  >{t('تقديم الطلب')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Reason Popup dialog */}
      <AnimatePresence>
        {rejectionModalRequest && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-md border-2 border-red-600 rounded-none shadow-2xl overflow-hidden text-right leading-relaxed"
            >
              <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
                <h4 className="font-black text-base flex items-center gap-2">
                  <XCircle className="w-5 h-5" />{t('تسجيل سبب رفض طلب الإجازة')}</h4>
                <button 
                  onClick={() => setRejectionModalRequest(null)}
                  className="text-white hover:opacity-80 transition-opacity"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form 
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!rejectionReason.trim()) return;
                  await handleUpdateStatus(rejectionModalRequest.id, 'Rejected', rejectionReason);
                  setRejectionModalRequest(null);
                }}
                className="p-6 space-y-4"
              >
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground block">{t('يرجى كتابة سبب الرفض بالتفصيل ليظهر للموظف *')}</label>
                  <textarea 
                    required
                    rows={4}
                    placeholder={t('مثال: يرجى تعديل تاريخ الطلب لوجود تسليمات مشروع هامة في نفس الفترة...')}
                    className="w-full px-4 py-3 bg-muted/40 border border-border rounded-none focus:ring-1 focus:ring-red-600 outline-none text-sm text-foreground font-medium"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button 
                    type="button" 
                    onClick={() => setRejectionModalRequest(null)}
                    className="px-4 py-2 hover:bg-muted text-foreground border border-border text-xs font-bold"
                  >{t('إلغاء التراجع')}</button>
                  <button 
                    type="submit"
                    disabled={!rejectionReason.trim()}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black disabled:opacity-50"
                  >{t('تأكيد رفض الإجازة')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leave Request Detailed View Popup */}
      <AnimatePresence>
        {viewingLeave && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-lg border-t-4 border-orange-500 rounded-none shadow-2xl overflow-hidden text-right leading-relaxed"
              dir="rtl"
            >
              <div className="bg-orange-500 text-white px-6 py-4 flex items-center justify-between">
                <h4 className="font-black text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 animate-pulse" />{t('تفاصيل طلب الإجازة المقدم')}</h4>
                <button 
                  onClick={() => setViewingLeave(null)}
                  className="text-white hover:opacity-85 border-none outline-none bg-transparent cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Employee Card Info summary */}
                <div className="bg-muted/40 p-4 border border-border/80 rounded-none flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-500/10 border border-orange-500/20 rounded-none flex items-center justify-center font-black text-orange-600 shadow-sm text-lg">
                    {viewingLeave.employee?.name?.[0] || 'U'}
                  </div>
                  <div>
                    <h5 className="font-black text-sm text-foreground leading-none mb-1">{viewingLeave.employee?.name || t('موظف مجهول')}</h5>
                    <p className="text-xs text-muted-foreground font-bold">الرقم الوظيفي: #{viewingLeave.employee?.employeeId || '—'}</p>
                  </div>
                </div>

                {/* Main Leave Details list/grid */}
                <div className="grid grid-cols-2 gap-4 text-xs font-bold divide-y divide-border/20">
                  <div className="space-y-1">
                    <span className="text-muted-foreground block text-[10px] uppercase font-extrabold">{t('نوع الإجازة')}</span>
                    <span className="text-foreground text-sm font-black">
                      {viewingLeave.type === 'Sick' ? t('إجازة مرضية') : 
                       viewingLeave.type === 'Annual' || viewingLeave.type === 'Vacation' ? t('إجازة سنوية') : 
                       viewingLeave.type === 'WorkFromHome' ? t('العمل من المنزل') : 
                       viewingLeave.type === 'OfficialHoliday' || viewingLeave.type === 'Official' || viewingLeave.type === 'إجازة رسمية' ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-black">
                          <Sparkles className="w-4 h-4" />
                          {t('إجازة رسمية (مدفوعة الأجر)')}
                        </span>
                       ) : t('إجازة بدون راتب')}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <span className="text-muted-foreground block text-[10px] uppercase font-extrabold">{t('حالة الطلب')}</span>
                    <div>
                      {getStatusBadge(viewingLeave.status)}
                    </div>
                  </div>

                  <div className="col-span-2 pt-3 space-y-1">
                    <span className="text-muted-foreground block text-[10px] uppercase font-extrabold">{t('فترة الإجازة وتاريخها')}</span>
                    <div className="flex items-center gap-2 font-mono text-xs dark:text-gray-300">
                      <Calendar className="w-4 h-4 text-orange-500" />
                      <span>{t('من:')}<strong className="text-foreground text-sm font-black">{viewingLeave.startDate}</strong></span>
                      <span className="px-1.5 border border-border bg-muted text-[10px]">{t('إلى')}</span>
                      <span>{t('حتى:')}<strong className="text-foreground text-sm font-black">{viewingLeave.endDate}</strong></span>
                    </div>
                  </div>

                  <div className="pt-3 space-y-1">
                    <span className="text-muted-foreground block text-[10px] uppercase font-extrabold">{t('إجمالي عدد الأيام')}</span>
                    <span className="text-orange-600 text-sm font-black">
                      {(() => {
                        const days = viewingLeave.daysCount || (viewingLeave.startDate && viewingLeave.endDate ? Math.max(1, Math.round((new Date(viewingLeave.endDate).getTime() - new Date(viewingLeave.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1) : 0);
                        return days ? `${days} أيام` : '—';
                      })()}
                    </span>
                  </div>

                  <div className="pt-3 space-y-1">
                    <span className="text-muted-foreground block text-[10px] uppercase font-extrabold">{t('القسم / الإدارة')}</span>
                    <span className="text-foreground text-xs font-black">
                      {adminDepartments.find(d => d.id === viewingLeave.employee?.departmentId)?.name || t('غير محدد')}
                    </span>
                  </div>

                  <div className="col-span-2 pt-3 space-y-1">
                    <span className="text-muted-foreground block text-[10px] uppercase font-extrabold">{t('المدير المباشر المعتمد')}</span>
                    <span className="text-foreground text-xs font-black">
                      {employees.find(e => e.id === viewingLeave.employee?.managerId)?.name || t('غير محدد (مدير أعلى)')}
                    </span>
                  </div>

                  {viewingLeave.reason && (
                    <div className="col-span-2 pt-3 space-y-1">
                      <span className="text-muted-foreground block text-[10px] uppercase font-extrabold">{t('سبب تقديم الإجازة')}</span>
                      <p className="text-xs text-muted-foreground font-semibold leading-relaxed bg-muted/25 p-3 border border-border/40">
                        {viewingLeave.reason}
                      </p>
                    </div>
                  )}

                  {viewingLeave.reviewNote && (
                    <div className="col-span-2 pt-3 space-y-1 border-t border-destructive/10 bg-rose-500/5 p-3 font-semibold text-rose-700">
                      <span className="text-rose-600 block text-[10px] uppercase font-extrabold">{t('ملاحظة المراجعة / الرفض')}</span>
                      <p className="text-xs leading-relaxed">
                        {viewingLeave.reviewNote}
                      </p>
                    </div>
                  )}
                  
                  {viewingLeave.returnRequestStatus && (
                    <div className="col-span-2 pt-3 space-y-2 border-t border-amber-500/10 bg-amber-500/5 p-3">
                      <span className="text-amber-700 block text-[10px] uppercase font-extrabold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />{t('تفاصيل طلب الرجوع المبكر إلى العمل')}</span>
                      <div className="text-xs space-y-1 text-slate-800 dark:text-neutral-200">
                        <p>{t('تاريخ الرجوع الفعلي للعمل:')}<strong className="text-amber-700 font-extrabold">{viewingLeave.actualReturnDate || 'غير محدد'}</strong></p>
                        {viewingLeave.returnRequestNotes && <p>{t('السبب أو المبررات:')}<span className="text-muted-foreground italic font-semibold">"{viewingLeave.returnRequestNotes}"</span></p>}
                        <p className="flex items-center gap-1">{t('حالة طلب الرجوع:')}<span className={cn(
                            "px-2 py-0.5 border text-[10px] font-black mr-1",
                            viewingLeave.returnRequestStatus === 'Approved' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                            viewingLeave.returnRequestStatus === 'Rejected' ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                            "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          )}>
                            {viewingLeave.returnRequestStatus === 'Approved' ? t('معتمد ومعدل') : viewingLeave.returnRequestStatus === 'Rejected' ? t('مرفوض') : t('قيد الانتظار والمراجعة')}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end border-t border-border pt-4">
                  <button 
                    onClick={() => setViewingLeave(null)}
                    className="p-3 px-5 bg-muted hover:bg-muted/80 text-foreground font-black text-xs rounded-none border-none cursor-pointer"
                  >{t('إغلاق التفاصيل')}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Official Holiday Modal Popup */}
      <AnimatePresence>
        {isOfficialHolidayModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => !isSubmittingHoliday && setIsOfficialHolidayModalOpen(false)} 
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              className="relative bg-card w-full max-w-lg rounded-none shadow-2xl overflow-hidden border border-border z-10 text-right"
              dir="rtl"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-amber-600 to-yellow-600 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-white/10 rounded-none">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight">{t('إضافة إجازة رسمية')}</h3>
                    <p className="text-[11px] font-bold text-amber-100 opacity-90">{t('تطبيق الإجازة تلقائياً لكافة الموظفين الخاضعين للحضور')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => !isSubmittingHoliday && setIsOfficialHolidayModalOpen(false)}
                  className="text-white/80 hover:text-white border-none outline-none bg-transparent cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveOfficialHoliday} className="p-6 space-y-5">
                {/* Information Card */}
                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-none space-y-2">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-black text-xs">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>{t('معلومات وضوابط الإجازة الرسمية:')}</span>
                  </div>
                  <ul className="text-[11px] text-muted-foreground font-bold space-y-1 mr-4 list-disc">
                    <li>{t('تُطبق تلقائياً على جميع الموظفين الخاضعين لنظام الحضور (العمل من المقر وعن بُعد)')} <strong className="text-foreground">({eligibleEmployeesCount} {t('موظف')})</strong>.</li>
                    <li>{t('الإجازة مدفوعة الأجر بالكامل ولا تُحسب غياباً أو استقطاعاً مالياً.')}</li>
                    <li>{t('لا تُخصم من رصيد الإجازات السنوية أو المرضية للموظف.')}</li>
                  </ul>
                </div>

                {/* Holiday Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-foreground block">
                    {t('اسم الإجازة الرسمية')} <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    placeholder={t('مثال: إجازة عيد الفطر المبارك / اليوم الوطني / المولد النبوي...')}
                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-none outline-none focus:ring-2 focus:ring-amber-500 font-bold text-foreground text-sm"
                    value={holidayForm.name} 
                    onChange={(e) => setHolidayForm(prev => ({ ...prev, name: e.target.value }))} 
                  />
                </div>

                {/* Dates Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-foreground block">
                      {t('من تاريخ')} <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      required 
                      className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-none outline-none focus:ring-2 focus:ring-amber-500 font-bold text-foreground text-sm"
                      value={holidayForm.startDate} 
                      onChange={(e) => setHolidayForm(prev => {
                        const newStart = e.target.value;
                        const newEnd = prev.endDate < newStart ? newStart : prev.endDate;
                        return { ...prev, startDate: newStart, endDate: newEnd };
                      })} 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-foreground block">
                      {t('إلى تاريخ')} <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="date" 
                      required 
                      min={holidayForm.startDate}
                      className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-none outline-none focus:ring-2 focus:ring-amber-500 font-bold text-foreground text-sm"
                      value={holidayForm.endDate} 
                      onChange={(e) => setHolidayForm(prev => ({ ...prev, endDate: e.target.value }))} 
                    />
                  </div>
                </div>

                {/* Days Count badge */}
                {holidayForm.startDate && holidayForm.endDate && (
                  <div className="flex items-center justify-between p-3 bg-muted/50 border border-border text-xs font-bold">
                    <span className="text-muted-foreground">{t('إجمالي مدة الإجازة الرسمية:')}</span>
                    <span className="text-amber-600 dark:text-amber-400 font-black">
                      {Math.max(1, Math.round((new Date(holidayForm.endDate).getTime() - new Date(holidayForm.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1)} {t('يوم')}
                    </span>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-foreground block">
                    {t('ملاحظات وتفاصيل إضافية (اختياري)')}
                  </label>
                  <textarea 
                    rows={3}
                    placeholder={t('ملاحظات إدارية أو توجيهات متعلقة بهذه الإجازة...')}
                    className="w-full px-4 py-2.5 bg-muted/40 border border-border rounded-none outline-none focus:ring-2 focus:ring-amber-500 font-bold text-foreground text-sm resize-none"
                    value={holidayForm.notes} 
                    onChange={(e) => setHolidayForm(prev => ({ ...prev, notes: e.target.value }))} 
                  />
                </div>

                {/* Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                  <button 
                    type="button"
                    disabled={isSubmittingHoliday}
                    onClick={() => setIsOfficialHolidayModalOpen(false)}
                    className="px-5 py-2.5 bg-muted hover:bg-muted/80 text-foreground font-black text-xs rounded-none border border-border cursor-pointer transition-all disabled:opacity-50"
                  >
                    {t('إلغاء')}
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmittingHoliday}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white font-black text-xs rounded-none shadow-md inline-flex items-center gap-2 cursor-pointer transition-all border-none disabled:opacity-50"
                  >
                    {isSubmittingHoliday ? (
                      <>
                        <Clock className="w-4 h-4 animate-spin" />
                        {t('جاري الحفظ والتطبيق...')}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        {t('حفظ وتطبيق الإجازة الرسمية')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={async () => {
          if (deleteConfirmId) {
            await confirmDelete(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        title={t('تأكيد حذف طلب الإجازة')}
        description={t('هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.')}
      />
    </div>
  );
};
