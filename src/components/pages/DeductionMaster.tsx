import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../AuthContext';
import { 
  Percent, 
  Plus, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  AlertCircle, 
  HelpCircle,
  Calendar,
  Layers,
  FileCheck
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
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  calculationMethod: string;
  fixedAmount: number;
  percentage: number;
  brackets: Bracket[] | string;
  equation: string;
  chargeType: string;
  employeePercentage: number;
  companyPercentage: number;
  employeeAmount: number;
  companyAmount: number;
}

export const DeductionMaster: React.FC = () => {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const isRtl = language === 'ar';

  const [deductions, setDeductions] = useState<DeductionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick Tax Rate State
  const [taxInputPercentage, setTaxInputPercentage] = useState<string>('');
  const [updatingTax, setUpdatingTax] = useState(false);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nameAr: '',
    nameEn: '',
    category: t('أخرى'),
    description: '',
    status: 'Active',
    startDate: '',
    endDate: '',
    calculationMethod: t('مبلغ ثابت'),
    fixedAmount: 0,
    percentage: 0,
    equation: '',
    chargeType: t('يتحمله الموظف بالكامل'),
    employeePercentage: 0,
    companyPercentage: 0,
    employeeAmount: 0,
    companyAmount: 0
  });

  const [brackets, setBrackets] = useState<Bracket[]>([
    { name: t('الشريحة الأولى'), from: '0', to: '40000', percentage: '0' },
  ]);

  const categories = [
    { value: t('تأمينات'), labelAr: t('تأمينات اجتماعية'), labelEn: 'Social Insurance' },
    { value: 'ضريبة كسب العمل', labelAr: 'ضريبة كسب العمل', labelEn: 'Labor Income Tax (Employee)' },
    { value: t('ضرائب'), labelAr: t('ضرائب ورسوم أخرى'), labelEn: 'Other Taxes' },
    { value: t('جزاءات'), labelAr: t('جزاءات ومخالفات'), labelEn: 'Penalties' },
    { value: t('سلف'), labelAr: t('سلف مستردة'), labelEn: 'Advances' },
    { value: t('نقابة'), labelAr: t('اشتراك نقابة'), labelEn: 'Union' },
    { value: t('صندوق'), labelAr: t('صندوق زمالة'), labelEn: 'Fellowship Fund' },
    { value: t('أخرى'), labelAr: t('أخرى'), labelEn: 'Other' },
  ];

  const calcMethods = [
    { value: t('مبلغ ثابت'), labelAr: t('مبلغ ثابت شهرياً'), labelEn: 'Fixed Monthly Amount' },
    { value: t('نسبة مئوية'), labelAr: t('نسبة مئوية من الراتب'), labelEn: 'Salary Percentage' },
    { value: t('شرائح'), labelAr: t('شرائح تصاعدية'), labelEn: 'Progressive Brackets' },
    { value: t('معادلة'), labelAr: t('معادلة حسابية مخصصة'), labelEn: 'Custom Formula' },
    { value: t('يدوي'), labelAr: t('إدخال يدوي شهري'), labelEn: 'Manual Input' }
  ];

  const chargeTypes = [
    { value: t('يتحمله الموظف بالكامل'), labelAr: t('يتحمله الموظف بالكامل (خصم من الراتب)'), labelEn: 'Employee Fully (Deducted)' },
    { value: t('تتحمله الشركة بالكامل'), labelAr: t('تتحمله الشركة بالكامل (تكلفة إضافية)'), labelEn: 'Company Fully (Cost)' },
    { value: t('مشاركة بين الموظف والشركة'), labelAr: t('مشاركة بنسب محددة بينهما'), labelEn: 'Shared Ratio Split' }
  ];

  const fetchDeductions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/deduction-types', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error('Failed to fetch deduction master types');
      const data = await res.json();
      setDeductions(data);
      
      // Auto populate quick tax inputs if active "ضريبة كسب العمل" exists
      const activeTax = data.find((d: any) => d.category === 'ضريبة كسب العمل' && d.status === 'Active');
      if (activeTax) {
        setTaxInputPercentage(String(activeTax.percentage || 10));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBootDefaultTax = async () => {
    try {
      setUpdatingTax(true);
      const token = localStorage.getItem('auth_token');
      const payload = {
        id: crypto.randomUUID(),
        code: 'DED-TAX',
        nameAr: 'ضريبة كسب العمل',
        nameEn: 'Employee Income Tax',
        category: 'ضريبة كسب العمل',
        description: 'ضريبة كسب العمل المستقطعة شهرياً من راتب الموظف في النظام تلقائياً للجميع بدون تعديل يدوي.',
        status: 'Active',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        calculationMethod: t('نسبة مئوية'),
        fixedAmount: 0,
        percentage: 10,
        brackets: null,
        equation: '',
        chargeType: t('يتحمله الموظف بالكامل'),
        employeePercentage: 100,
        companyPercentage: 0,
        employeeAmount: 0,
        companyAmount: 0
      };

      const res = await fetch('/api/deduction-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to bootstrap default tax rule');
      
      alert(isRtl ? 'تم تأسيس وتفعيل ضريبة كسب العمل بنجاح!' : 'Employee Income Tax successfully bootstrapped!');
      await fetchDeductions();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpdatingTax(false);
    }
  };

  const handleQuickTaxUpdate = async (activeTaxId: string) => {
    if (!taxInputPercentage || isNaN(parseFloat(taxInputPercentage))) {
      alert(isRtl ? 'الرجاء إدخال نسبة صحيحة' : 'Please input a valid percentage');
      return;
    }
    const rate = parseFloat(taxInputPercentage);
    if (rate < 0 || rate > 100) {
      alert(isRtl ? 'النسبة يجب أن تكون بين 0 و 100' : 'Percentage must be between 0 and 100');
      return;
    }

    try {
      setUpdatingTax(true);
      const token = localStorage.getItem('auth_token');
      const activeTaxObj = deductions.find(d => d.id === activeTaxId);
      if (!activeTaxObj) return;

      const updatedPayload = {
        ...activeTaxObj,
        percentage: rate,
        employeePercentage: 100,
      };

      const res = await fetch(`/api/deduction-types/${activeTaxId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify(updatedPayload)
      });
      if (!res.ok) throw new Error('Failed to update tax rate');
      
      alert(isRtl ? 'تم تحديث نسبة ضريبة كسب العمل بنجاح وتطبيقها فوراً على كل الموظفين!' : 'Employee Income Tax rate updated and propagated to all eligible profiles!');
      await fetchDeductions();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setUpdatingTax(false);
    }
  };

  useEffect(() => {
    fetchDeductions();
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormData({
      nameAr: '',
      nameEn: '',
      category: t('أخرى'),
      description: '',
      status: 'Active',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      calculationMethod: t('مبلغ ثابت'),
      fixedAmount: 0,
      percentage: 0,
      equation: '',
      chargeType: t('يتحمله الموظف بالكامل'),
      employeePercentage: 0,
      companyPercentage: 0,
      employeeAmount: 0,
      companyAmount: 0
    });
    setBrackets([{ name: t('الشريحة الأساسية'), from: '0', to: '40000', percentage: '0' }]);
    setShowModal(true);
  };

  const handleOpenEdit = (item: DeductionType) => {
    setEditingId(item.id);
    setFormData({
      nameAr: item.nameAr,
      nameEn: item.nameEn,
      category: item.category,
      description: item.description || '',
      status: item.status || 'Active',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      calculationMethod: item.calculationMethod,
      fixedAmount: item.fixedAmount || 0,
      percentage: item.percentage || 0,
      equation: item.equation || '',
      chargeType: item.chargeType,
      employeePercentage: item.employeePercentage || 0,
      companyPercentage: item.companyPercentage || 0,
      employeeAmount: item.employeeAmount || 0,
      companyAmount: item.companyAmount || 0
    });

    let loadedBrackets: Bracket[] = [];
    if (item.brackets) {
      try {
        loadedBrackets = typeof item.brackets === 'string' ? JSON.parse(item.brackets) : item.brackets;
      } catch (e) {
        loadedBrackets = [];
      }
    }
    if (!Array.isArray(loadedBrackets) || loadedBrackets.length === 0) {
      loadedBrackets = [{ name: t('الشريحة الأولى'), from: '0', to: '40000', percentage: '0' }];
    }
    setBrackets(loadedBrackets);
    setShowModal(true);
  };

  const handleAddBracket = () => {
    setBrackets([...brackets, { name: `شريحة ${brackets.length + 1}`, from: '', to: '', percentage: '0' }]);
  };

  const handleRemoveBracket = (index: number) => {
    setBrackets(brackets.filter((_, i) => i !== index));
  };

  const handleBracketChange = (index: number, field: keyof Bracket, value: string) => {
    const updated = [...brackets];
    updated[index][field] = value;
    setBrackets(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr.trim() || !formData.nameEn.trim()) {
      alert(isRtl ? t('الرجاء إدخال الاسم باللغتين العربية والإنجليزية') : 'Please input names in both Arabic and English');
      return;
    }

    try {
      const deductionData: any = {
        ...formData,
        brackets: formData.calculationMethod === t('شرائح') ? brackets : null,
      };

      if (!editingId) {
        // Auto-generate Code
        const prefix = 'DED-';
        const num = String(deductions.length + 1).padStart(3, '0');
        deductionData.code = `${prefix}${num}`;
        deductionData.id = crypto.randomUUID();

        // POST request
        const token = localStorage.getItem('auth_token');
        const res = await fetch('/api/deduction-types', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(deductionData)
        });
        if (!res.ok) throw new Error('Failed to create deduction master');
      } else {
        deductionData.code = deductions.find(d => d.id === editingId)?.code || 'DED-99';
        // PUT request
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`/api/deduction-types/${editingId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(deductionData)
        });
        if (!res.ok) throw new Error('Failed to update deduction master');
      }

      setShowModal(false);
      fetchDeductions();
      alert(isRtl ? t('تم حفظ إعدادات الاستقطاع بنجاح') : 'Deduction configuration successfully saved');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(isRtl ? t('هل أنت متأكد من حذف هذا الاستقطاع الماستر؟') : 'Are you sure you want to delete this master deduction?')) return;
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/deduction-types/${id}`, { 
        method: 'DELETE',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) throw new Error('Failed to delete');
      fetchDeductions();
      alert(isRtl ? t('تم الحذف بنجاح') : 'Deleted successfully');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6" id="deduction_master_page">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground font-sans tracking-tight">
            {isRtl ? t('إعدادات الاستقطاعات (Deduction Master)') : 'Deduction Master Configuration'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isRtl 
              ? t('إدارة محرك الاستقطاعات المركزي للمنشأة وتخصيص معادلات التأمينات والضرائب الطبية والنقابات والجزاءات') 
              : 'Centralized rules engine for social insurance, corporate taxes, health insurance, funds, and custom formulas'
            }
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800 text-white rounded-lg flex items-center gap-2 font-bold transition-colors cursor-pointer border-none"
        >
          <Plus className="w-5 h-5" />
          {isRtl ? t('إضافة استقطاع جديد') : 'New Deduction Master'}
        </button>
      </div>


      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="p-4 bg-destructive/10 border border-destructive text-destructive rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : deductions.length === 0 ? (
        <div className="text-center py-16 bg-muted/20 border border-dashed border-border rounded-xl">
          <Percent className="w-16 h-16 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium text-lg">
            {isRtl ? t('لا توجد استقطاعات معرفة حالياً') : 'No deduction configurations found'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isRtl ? t('اضغط على زر الإضافة لتأسيس تأمينات اجتماعية، ضرائب، أو تأمين طبي مخصص') : 'Click "New Deduction Master" to bootstrap corporate rules'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {deductions.map(dt => {
            const catInfo = categories.find(c => c.value === dt.category);
            return (
              <div 
                key={dt.id} 
                className="bg-card hover:shadow-lg border border-border rounded-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div className="p-5 border-b border-border">
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <span className="px-2.5 py-1 text-xs font-mono font-bold bg-muted text-muted-foreground rounded">
                      {dt.code}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      dt.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    }`}>
                      {dt.status === 'Active' ? (isRtl ? t('فعال') : 'Active') : (isRtl ? t('غير فعال') : 'Inactive')}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-foreground">
                    {isRtl ? dt.nameAr : dt.nameEn}
                  </h3>
                  <h4 className="text-xs text-muted-foreground mt-0.5 font-mono">
                    {isRtl ? dt.nameEn : dt.nameAr}
                  </h4>

                  <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 rounded inline-block mt-3 font-semibold">
                    {isRtl ? catInfo?.labelAr : catInfo?.labelEn}
                  </div>

                  <p className="text-xs text-muted-foreground mt-3 line-clamp-2 min-h-[2rem]">
                    {dt.description || (isRtl ? t('لا يوجد وصف للمستند.') : 'No description provided')}
                  </p>
                </div>

                <div className="p-5 bg-muted/10 space-y-3 text-xs border-b border-border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{isRtl ? t('طريقة الحساب:') : 'Calculation Method:'}</span>
                    <span className="font-bold text-foreground">{dt.calculationMethod}</span>
                  </div>

                  {dt.calculationMethod === t('مبلغ ثابت') && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isRtl ? t('القيمة:') : 'Amount:'}</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{dt.fixedAmount} {isRtl ? t('ج.م.') : 'EGP'}</span>
                    </div>
                  )}

                  {dt.calculationMethod === t('نسبة مئوية') && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{isRtl ? t('النسبة:') : 'Percentage:'}</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{dt.percentage}%</span>
                    </div>
                  )}

                  {dt.calculationMethod === t('معادلة') && (
                    <div className="bg-muted p-2 rounded">
                      <div className="text-[10px] text-muted-foreground font-semibold">{isRtl ? t('صيغة المعادلة المحسوبة:') : 'Calculated Formula:'}</div>
                      <div className="font-mono text-foreground font-bold mt-0.5 truncate">{dt.equation}</div>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-border/60 pt-2 text-[11px]">
                    <span className="text-muted-foreground">{isRtl ? t('جهة التحمل:') : 'Charge Type:'}</span>
                    <span className="font-bold text-foreground">
                      {dt.chargeType === t('يتحمله الموظف بالكامل') && (isRtl ? t('الموظف بالكامل') : 'Employee Fully')}
                      {dt.chargeType === t('تتمله الشركة بالكامل') || dt.chargeType === t('تتحمله الشركة بالكامل') && (isRtl ? t('الشركة بالكامل') : 'Company Fully')}
                      {dt.chargeType === t('مشاركة بين الموظف والشركة') && (
                        isRtl 
                          ? `مشاركة (الموظف: ${dt.employeePercentage}% | الشركة: ${dt.companyPercentage}%)`
                          : `Split (Emp: ${dt.employeePercentage}% | Co: ${dt.companyPercentage}%)`
                      )}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-muted/20 flex justify-end gap-2 rounded-b-xl">
                  <button
                    onClick={() => handleOpenEdit(dt)}
                    className="p-1.5 hover:bg-muted text-blue-600 dark:text-blue-400 rounded transition-colors border-none cursor-pointer bg-transparent"
                    title={isRtl ? t('تعديل') : 'Edit'}
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dt.id)}
                    className="p-1.5 hover:bg-muted text-red-600 dark:text-red-400 rounded transition-colors border-none cursor-pointer bg-transparent"
                    title={isRtl ? t('حذف') : 'Delete'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Creator / Modifier */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col justify-between">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h3 className="text-lg font-bold text-foreground">
                {editingId ? (isRtl ? t('تعديل استقطاع الماستر') : 'Edit Master Deduction') : (isRtl ? t('تأسيس استقطاع جديد في الماستر') : 'Bootstrap New Deduction Master')}
              </h3>
              <button onClick={() => setShowModal(false)} className="bg-transparent border-none text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6">
              {/* Box info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('الاسم باللغة العربية *') : 'Name in Arabic *'}</label>
                  <input
                    type="text"
                    required
                    value={formData.nameAr}
                    onChange={e => setFormData({ ...formData, nameAr: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                    placeholder={t('مثال: تأمينات اجتماعية موظفين')}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('الاسم باللغة الإنجليزية *') : 'Name in English *'}</label>
                  <input
                    type="text"
                    required
                    value={formData.nameEn}
                    onChange={e => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                    placeholder="e.g. Social Insurance Employees"
                  />
                </div>
              </div>

              {/* Category and dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('تصنيف الاستقطاع *') : 'Category *'}</label>
                  <select
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{isRtl ? cat.labelAr : cat.labelEn}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('تاريخ السريان') : 'Start Date'}</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('تاريخ الانتهاء') : 'End Date'}</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Calculation Method */}
              <div className="p-4 bg-muted/30 border border-border rounded-lg space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('طريقة احتساب القيمة *') : 'Calculation Method *'}</label>
                    <select
                      value={formData.calculationMethod}
                      onChange={e => setFormData({ ...formData, calculationMethod: e.target.value })}
                      className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                    >
                      {calcMethods.map(m => (
                        <option key={m.value} value={m.value}>{isRtl ? m.labelAr : m.labelEn}</option>
                      ))}
                    </select>
                  </div>

                  {formData.calculationMethod === t('مبلغ ثابت') && (
                    <div>
                      <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('المبلغ الثابت شهرياً (ج.م.)') : 'Fixed Amount (EGP)'}</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.fixedAmount}
                        onChange={e => setFormData({ ...formData, fixedAmount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                      />
                    </div>
                  )}

                  {formData.calculationMethod === t('نسبة مئوية') && (
                    <div>
                      <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('النسبة المئوية (%)') : 'Percentage (%)'}</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.percentage}
                        onChange={e => setFormData({ ...formData, percentage: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                      />
                    </div>
                  )}
                </div>

                {formData.calculationMethod === t('معادلة') && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-muted-foreground">
                      {isRtl ? t('المعادلة الحسابية المخصصة:') : 'Custom Math Formula:'}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.equation}
                      onChange={e => setFormData({ ...formData, equation: e.target.value })}
                      placeholder="e.g. (basic salary + allowances) * 0.11"
                      className="w-full px-3 py-2 border border-border bg-background font-mono text-foreground text-sm rounded outline-none focus:border-blue-600"
                    />
                    <div className="text-[11px] text-muted-foreground space-y-1">
                      <p className="font-semibold text-blue-600 dark:text-blue-400">
                        {isRtl ? t('الرموز المدعومة للتكامل تلقائياً:') : 'Supported calculation aliases:'}
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 font-mono text-[10px]">
                        <li><span className="text-foreground">basic salary</span> : {isRtl ? t('الراتب الأساسي للموظف') : 'Employee Basic Salary'}</li>
                        <li><span className="text-foreground">allowances</span> : {isRtl ? t('مجموع البدلات الشهرية للموظف') : 'Total allowance amounts'}</li>
                        <li><span className="text-foreground">taxable income</span> : {isRtl ? t('إجمالي الدخل الخاضع للضريبية') : 'Gross taxable base'}</li>
                      </ul>
                      <p className="text-red-500 text-[10px]">
                        {isRtl ? t('مثال: (basic salary + allowances) * 11%') : 'Example formula syntax: (basic salary + allowances) * 11%'}
                      </p>
                    </div>
                  </div>
                )}

                {formData.calculationMethod === t('شرائح') && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-border/40">
                      <span className="text-xs font-bold text-foreground">{isRtl ? t('قائمة الشرائح التقديرية:') : 'Value Brackets:'}</span>
                      <button
                        type="button"
                        onClick={handleAddBracket}
                        className="px-2 py-1 bg-muted hover:bg-border text-foreground text-xs rounded border-none flex items-center gap-1 font-bold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isRtl ? t('إضافة شريحة') : 'Add Bracket'}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {brackets.map((br, index) => (
                        <div key={index} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-muted/40 p-2 rounded">
                          <input
                            type="text"
                            required
                            placeholder={isRtl ? t('اسم الشريحة') : 'Bracket Name'}
                            value={br.name}
                            onChange={e => handleBracketChange(index, 'name', e.target.value)}
                            className="bg-background border border-border px-2 py-1 rounded text-xs w-full sm:w-1/3 text-foreground"
                          />
                          <input
                            type="number"
                            required
                            placeholder={isRtl ? t('الراتب من') : 'From Salary'}
                            value={br.from}
                            onChange={e => handleBracketChange(index, 'from', e.target.value)}
                            className="bg-background border border-border px-2 py-1 rounded text-xs w-24 text-foreground"
                          />
                          <input
                            type="number"
                            required
                            placeholder={isRtl ? t('إلى') : 'To Salary'}
                            value={br.to}
                            onChange={e => handleBracketChange(index, 'to', e.target.value)}
                            className="bg-background border border-border px-2 py-1 rounded text-xs w-24 text-foreground"
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              required
                              placeholder="Ratio %"
                              value={br.percentage}
                              onChange={e => handleBracketChange(index, 'percentage', e.target.value)}
                              className="bg-background border border-border px-2 py-1 rounded text-xs w-16 text-foreground"
                            />
                            <span className="text-xs text-muted-foreground">%</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveBracket(index)}
                            disabled={brackets.length <= 1}
                            className="p-1 text-red-500 hover:bg-muted disabled:opacity-40 rounded cursor-pointer border-none bg-transparent"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Charge split */}
              <div className="p-4 bg-muted/30 border border-border rounded-lg space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('جهة التحمل وصرف التكاليف *') : 'Responsible Bearer *'}</label>
                  <select
                    value={formData.chargeType}
                    onChange={e => setFormData({ ...formData, chargeType: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                  >
                    {chargeTypes.map(c => (
                      <option key={c.value} value={c.value}>{isRtl ? c.labelAr : c.labelEn}</option>
                    ))}
                  </select>
                </div>

                {formData.chargeType === t('مشاركة بين الموظف والشركة') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('تحمل الموظف (%)') : 'Employee Percent (%)'}</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.employeePercentage}
                        onChange={e => setFormData({ ...formData, employeePercentage: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('تحمل الشركة (%)') : 'Company Cost percent (%)'}</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.companyPercentage}
                        onChange={e => setFormData({ ...formData, companyPercentage: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Status and description */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('الوصف') : 'Description'}</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded outline-none text-sm focus:border-blue-600"
                    placeholder={isRtl ? t('مثال: نظام التأمينات الاجتماعية المعتمد للموظفين ذوي الطابع الشهري...') : 'e.g. Standard social insurance settings for local employees'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground">{isRtl ? t('حالة التفعيل الكلي') : 'Global Application Status'}</label>
                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'Active' })}
                      className={`px-4 py-2 text-xs font-bold rounded cursor-pointer transition-colors border ${
                        formData.status === 'Active' 
                          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-muted border-border text-muted-foreground hover:bg-border'
                      }`}
                    >
                      {isRtl ? t('فعال ومطبق') : 'Active'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: 'Inactive' })}
                      className={`px-4 py-2 text-xs font-bold rounded cursor-pointer transition-colors border ${
                        formData.status === 'Inactive' 
                          ? 'bg-red-500/15 border-red-500 text-red-600 dark:text-red-400' 
                          : 'bg-muted border-border text-muted-foreground hover:bg-border'
                      }`}
                    >
                      {isRtl ? t('موقوف مؤقتاً') : 'Inactive'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-border text-foreground text-sm font-bold rounded border-none cursor-pointer"
                >
                  {isRtl ? t('إلغاء') : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded border-none cursor-pointer"
                >
                  {isRtl ? t('حفظ البيانات') : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
