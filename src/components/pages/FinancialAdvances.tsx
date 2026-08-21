import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  Clock3, 
  Calendar, 
  ArrowDownLeft, 
  DollarSign, 
  FileText, 
  User, 
  Briefcase,
  X,
  Check
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { db, collection, setDoc, doc, deleteDoc } from '../../api';
import { Employee } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { useLanguage } from '../../contexts/LanguageContext';

export interface FinancialAdvance {
  id: string;
  employeeId: string;
  projectId?: string;
  month: string; // YYYY-MM
  amount: number;
  status: 'Draft' | 'Paid' | 'Liquidated';
  notes?: string;
  refNumber?: string;
  createdAt: string;
  disbursedAt?: string;
}

export const FinancialAdvances: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { employees, projects, refreshData } = useData();

  const [advances, setAdvances] = useState<FinancialAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Draft' | 'Paid' | 'Liquidated'>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<FinancialAdvance | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    employeeId: '',
    projectId: '',
    month: new Date().toISOString().slice(0, 7),
    amount: 0,
    status: 'Draft' as 'Draft' | 'Paid' | 'Liquidated',
    notes: '',
    refNumber: ''
  });

  const fetchAdvances = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const res = await fetch('/api/financial-advances', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAdvances(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch financial advances', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, []);

  const handleOpenAddModal = () => {
    setEditingAdvance(null);
    setFormData({
      employeeId: '',
      projectId: '',
      month: selectedMonth,
      amount: 0,
      status: 'Draft',
      notes: '',
      refNumber: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (adv: FinancialAdvance) => {
    setEditingAdvance(adv);
    setFormData({
      employeeId: adv.employeeId,
      projectId: adv.projectId || '',
      month: adv.month,
      amount: adv.amount,
      status: adv.status,
      notes: adv.notes || '',
      refNumber: adv.refNumber || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || formData.amount <= 0) {
      alert('يرجى ملء كافة الحقول الأساسية وتحديد مبلغ العهدة');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const id = editingAdvance ? editingAdvance.id : 'adv_' + crypto.randomUUID();
      const record: FinancialAdvance = {
        id,
        employeeId: formData.employeeId,
        projectId: formData.projectId || undefined,
        month: formData.month,
        amount: Number(formData.amount),
        status: formData.status,
        notes: formData.notes || undefined,
        refNumber: formData.refNumber || undefined,
        createdAt: editingAdvance ? editingAdvance.createdAt : new Date().toISOString(),
        disbursedAt: formData.status === 'Paid' ? new Date().toISOString() : (editingAdvance?.disbursedAt || undefined)
      };

      const url = editingAdvance ? `/api/financial-advances/${id}` : '/api/financial-advances';
      const method = editingAdvance ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(record)
      });

      if (res.ok) {
        await fetchAdvances();
        setIsModalOpen(false);
        alert(editingAdvance ? t('تم تحديث العهدة المالية بنجاح') : t('تم إضافة وتسجيل العهدة المالية بنجاح'));
      } else {
        throw new Error(t('فشلت العملية على سيرفر البيانات'));
      }
    } catch (err: any) {
      alert('خطأ أثناء حفظ العهدة الملحقة: ' + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('هل أنت متأكد من رغبتك بحذف مستند العهدة المالية هذا نهائيًا؟'))) return;
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const res = await fetch(`/api/financial-advances/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setAdvances(prev => prev.filter(a => a.id !== id));
        alert('تم حذف العهدة المالية بنجاح.');
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`فشل حذف العهدة المالية: ${errData.error || 'خطأ غير معروف'}`);
      }
    } catch (err: any) {
      alert('خطأ في حذف المستند: ' + err.message);
    }
  };

  const handleUpdateStatus = async (adv: FinancialAdvance, newStatus: 'Draft' | 'Paid' | 'Liquidated') => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const updated: FinancialAdvance = {
        ...adv,
        status: newStatus,
        disbursedAt: newStatus === 'Paid' ? new Date().toISOString() : adv.disbursedAt
      };

      const res = await fetch(`/api/financial-advances/${adv.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updated)
      });

      if (res.ok) {
        setAdvances(prev => prev.map(a => a.id === adv.id ? updated : a));
        alert('تم تغيير حالة العهدة واعتمادها بنجاح.');
      }
    } catch (err: any) {
      alert('خطأ في تغيير الحالة: ' + err.message);
    }
  };

  // Filter advances
  const filteredAdvances = advances.filter(adv => {
    const emp = employees.find(e => e.id === adv.employeeId);
    const proj = projects.find(p => p.id === adv.projectId);
    
    const matchesSearch = (emp?.name.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                          (emp?.employeeId || '').includes(searchTerm) ||
                          (proj?.name.toLowerCase() || '').includes(searchTerm.toLowerCase());
                          
    const matchesStatus = statusFilter === 'all' || adv.status === statusFilter;
    const matchesMonth = adv.month === selectedMonth;

    return matchesSearch && matchesStatus && matchesMonth;
  });

  // KPI calculations
  const totalDraft = filteredAdvances.filter(a => a.status === 'Draft').reduce((s, a) => s + a.amount, 0);
  const totalPaid = filteredAdvances.filter(a => a.status === 'Paid').reduce((s, a) => s + a.amount, 0);
  const totalLiquidated = filteredAdvances.filter(a => a.status === 'Liquidated').reduce((s, a) => s + a.amount, 0);
  const totalSum = filteredAdvances.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="space-y-8 p-1 md:p-6 text-right" dir="rtl">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
        <div>
          <span className="px-3 py-1 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-full text-xs font-black tracking-widest uppercase">{t('SUP MODULE - العُهَد المالية للمأموريات')}</span>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white mt-1.5 flex items-center gap-3">
            <Coins className="w-8 h-8 text-amber-500 animate-bounce" />
            <span>{t('إدارة العهد المالية وتصفيتها')}</span>
          </h2>
          <p className="text-sm text-slate-400 font-bold mt-1">{t('تسجيل مبالغ العهد المصروفة مسبقًا للموظفين وتصفيتها تلقائيًا من بدلات المأموريات')}</p>
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
            onClick={handleOpenAddModal}
            className="px-5 py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t('طلب عهدة جديدة')}</span>
          </button>
        </div>
      </div>

      {/* Numerical Stats card widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('إجمالي العهد المسجلة'), val: formatCurrency(totalSum), desc: `إجمالي مستندات الشهر الحالي`, icon: Coins, bg: 'bg-indigo-50 dark:bg-indigo-950/20', text: 'text-indigo-600 dark:text-indigo-400' },
          { label: t('عهود بانتظار الصرف'), val: formatCurrency(totalDraft), desc: `مسودات غير مدفوعة`, icon: Clock3, bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-600 dark:text-amber-400' },
          { label: t('عهود مصروفة ونشطة'), val: formatCurrency(totalPaid), desc: t('صرفت للموظف ولم تصفى بعد'), icon: ArrowDownLeft, bg: 'bg-emerald-50 dark:bg-emerald-950/20', text: 'text-emerald-600 dark:text-emerald-400' },
          { label: t('تمت تصفيتها بالكامل'), val: formatCurrency(totalLiquidated), desc: t('خصمت من بدلات المأموريات'), icon: CheckCircle2, bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600 dark:text-blue-400' }
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5 rounded-[2rem] shadow-sm flex items-center justify-between transition-all hover:translate-y-[-2px]">
            <div className="space-y-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
              <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tabular-nums">{stat.val}</p>
              <p className="text-[10px] font-bold text-slate-400/80">{stat.desc}</p>
            </div>
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", stat.bg, stat.text)}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
        ))}
      </div>

      {/* Filter and search control board */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-900 p-4 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            className="w-full pr-11 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none font-bold text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-teal-500 transition-all text-right"
            placeholder={t('بحث باسم الموظف أو رقم المشروع...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status filtering toggles */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-full md:w-auto">
          {[
            { id: 'all', label: t('الكل') },
            { id: 'Draft', label: t('مسودة') },
            { id: 'Paid', label: t('مصروفة') },
            { id: 'Liquidated', label: t('تمت التصفية') }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={cn(
                "flex-1 md:flex-initial px-5 py-2 text-xs font-black rounded-xl transition-all cursor-pointer outline-none",
                statusFilter === tab.id 
                  ? "bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm" 
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Advances List Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-400 font-bold">{t('جاري تحميل كشوفات العهد المالية...')}</p>
          </div>
        ) : filteredAdvances.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="inline-flex p-5 bg-slate-50 dark:bg-slate-800/50 rounded-full text-slate-300 dark:text-slate-600">
              <Coins className="w-12 h-12" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-slate-700 dark:text-slate-200">{t('لا توجد عهد مالية مسجلة')}</p>
              <p className="text-xs text-slate-400 font-bold">{t('لم تسجل أي ذمم مالية أو عهد للظروف المحددة')}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-right">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/40 text-slate-400 text-xs font-black uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="px-8 py-5">{t('الموظف المعني')}</th>
                  <th className="px-8 py-5">{t('المشروع المرتبط')}</th>
                  <th className="px-8 py-5">{t('الرقم المرجعي')}</th>
                  <th className="px-8 py-5">{t('تاريخ التسجيل')}</th>
                  <th className="px-8 py-5 text-left">{t('قيمة العهدة')}</th>
                  <th className="px-8 py-5 text-center">{t('حالة العهدة')}</th>
                  <th className="px-8 py-5 text-center">{t('إجراءات')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-sm font-semibold text-slate-700 dark:text-slate-200">
                {filteredAdvances.map((adv) => {
                  const emp = employees.find(e => e.id === adv.employeeId);
                  const proj = projects.find(p => p.id === adv.projectId);

                  return (
                    <tr key={adv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 flex items-center justify-center font-bold">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 dark:text-white">{emp?.name || t('موظف غير متوفر')}</p>
                            <p className="text-[10px] text-slate-400 font-bold mt-0.5">الرقم الوظيفي: {emp?.employeeId}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-8 py-5 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          <span>{proj?.name || t('غير مرتبط بمشروع معين')}</span>
                        </div>
                      </td>

                      <td className="px-8 py-5 font-bold text-xs text-slate-500 tabular-nums">
                        {adv.refNumber || t('بدون مرجع')}
                      </td>

                      <td className="px-8 py-5 text-xs text-slate-400 font-bold tabular-nums">
                        {format(new Date(adv.createdAt), 'yyyy-MM-dd')}
                      </td>

                      <td className="px-8 py-5 text-left font-black text-slate-900 dark:text-white tabular-nums text-md">
                        {formatCurrency(adv.amount)}
                      </td>

                      <td className="px-8 py-5">
                        <div className="flex justify-center">
                          {adv.status === 'Liquidated' ? (
                            <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[10px] font-black flex items-center gap-1">
                              <CheckCircle2 className="w-3" />
                              <span>{t('تمت التصفية والمقاصة')}</span>
                            </span>
                          ) : adv.status === 'Paid' ? (
                            <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black flex items-center gap-1">
                              <ArrowDownLeft className="w-3" />
                              <span>{t('دُفعت / مصروفة')}</span>
                            </span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 text-[10px] font-black flex items-center gap-1">
                              <Clock3 className="w-3" />
                              <span>{t('مسودة أولية')}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-8 py-5">
                        <div className="flex items-center justify-center gap-1">
                          {adv.status === 'Draft' && (
                            <button
                              onClick={() => handleUpdateStatus(adv, 'Paid')}
                              className="p-1.5 bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 text-emerald-600 rounded-lg transition-colors border border-emerald-100 dark:border-emerald-900/30"
                              title={t('تسجيل دفع العهدة الفوري للموظف')}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          
                          {adv.status !== 'Liquidated' && (
                            <button
                              onClick={() => handleOpenEditModal(adv)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-all"
                              title={t('تعديل بيانات العهدة')}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleDelete(adv.id)}
                            className="p-1.5 hover:bg-red-50 hover:text-red-600 text-slate-400 rounded-lg transition-all"
                            title={t('حذف كلي للعهد')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Overlay Sheet for Creation / Editing */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsModalOpen(false)} 
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="relative bg-white dark:bg-slate-900 w-full max-w-lg p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 text-right shadow-2xl"
              dir="rtl"
            >
              <div className="flex items-center gap-3 border-b border-slate-50 dark:border-slate-800 pb-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-500 flex items-center justify-center">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingAdvance ? t('تعديل بيانات العهدة المالية') : t('تسجيل عهدة مالية للمأمورية')}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold">{t('تسجيل الأموال المصروفة مسبقًا كعهدة للمقاصة والتصفية')}</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('الموظف المعني')}</label>
                  <select 
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-bold text-sm text-slate-700 dark:text-slate-200"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  >
                    <option value="">{t('-- اختر الموظف --')}</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({e.employeeId})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('الشهر المستهدف')}</label>
                    <input 
                      type="month"
                      className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-bold text-sm text-slate-700 dark:text-slate-200"
                      value={formData.month}
                      onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('قيمة العهدة المالية')}</label>
                    <div className="relative">
                      <input 
                        type="number"
                        className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-black text-sm text-slate-700 dark:text-slate-200 text-left pl-12"
                        placeholder="0.00"
                        value={formData.amount || ''}
                        onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) || 0 })}
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xs text-slate-400">{t('جنيه')}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('المشروع الملحق به العهدة')}</label>
                  <select 
                    className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-bold text-sm text-slate-700 dark:text-slate-200"
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  >
                    <option value="">{t('-- غير مرتبط بمشروع معين / مأمورية عامة --')}</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('مرجع السحب / السند المالي')}</label>
                    <input 
                      type="text"
                      placeholder={t('رقم المستند المالي للعهدة...')}
                      className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-bold text-sm text-slate-700 dark:text-slate-200"
                      value={formData.refNumber}
                      onChange={(e) => setFormData({ ...formData, refNumber: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('الحالة الأولية')}</label>
                    <select 
                      className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-bold text-sm text-emerald-600 dark:text-emerald-400"
                      value={formData.status}
                      disabled={formData.status === 'Liquidated'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    >
                      <option value="Draft">{t('مسودة (طلب مسجل)')}</option>
                      <option value="Paid">{t('مصروفة كاش / شيك للموظف')}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">{t('ملاحظات العهدة وتفاصيل الترجيع')}</label>
                  <textarea 
                    placeholder={t('ملاحظات توجب التحقق أثناء الصرف...')}
                    className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl outline-none font-bold text-sm text-slate-700 dark:text-slate-200 h-20 resize-none"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="flex gap-2.5 mt-8 border-t border-slate-50 dark:border-slate-800 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs rounded-xl shadow-lg transition-all text-center"
                  >{t('حفظ وتسجيل البيانات')}</button>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 font-black text-xs rounded-xl transition-all"
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
