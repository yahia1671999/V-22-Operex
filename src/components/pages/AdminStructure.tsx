import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Network, 
  Plus, 
  Trash2, 
  Users, 
  ChevronRight, 
  Briefcase,
  Building2,
  MoreVertical,
  Edit2,
  UserPlus,
  X,
  Search,
  Check
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { db, collection, addDoc, deleteDoc, doc, updateDoc } from '../../api';
import { AdministrativeDepartment, Employee } from '../../types';
import { cn } from '../../lib/utils';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useLanguage } from '../../contexts/LanguageContext';

export const AdminStructure: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { adminDepartments, employees, refreshData } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<AdministrativeDepartment | null>(null);
  const [activeDeptForEmployees, setActiveDeptForEmployees] = useState<AdministrativeDepartment | null>(null);
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<AdministrativeDepartment>>({
    name: '',
    description: '',
    managerId: '',
    parentDeptId: ''
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sanitizedData = {
        ...formData,
        managerId: formData.managerId || null,
        parentDeptId: formData.parentDeptId || null
      };

      if (editingDept) {
        await updateDoc(doc(db, 'adminDepartments', editingDept.id), sanitizedData);
      } else {
        await addDoc(collection(db, 'adminDepartments'), sanitizedData);
      }
      await refreshData();
      setIsModalOpen(false);
      setEditingDept(null);
      setFormData({ name: '', description: '', managerId: '', parentDeptId: '' });
    } catch (error) {
      console.error('Error saving department:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'adminDepartments', id));
      // Also clear departmentId from employees in this dept
      const deptEmployees = employees.filter(e => e.departmentId === id);
      for (const emp of deptEmployees) {
        await updateDoc(doc(db, 'employees', emp.id), { departmentId: null });
      }
      await refreshData();
    } catch (error) {
      console.error('Error deleting department:', error);
    }
  };

  const handleToggleEmployee = async (employeeId: string, currentDeptId?: string) => {
    if (!activeDeptForEmployees) return;
    try {
      const isCurrentlyIn = currentDeptId === activeDeptForEmployees.id;
      await updateDoc(doc(db, 'employees', employeeId), {
        departmentId: isCurrentlyIn ? null : activeDeptForEmployees.id
      });
      await refreshData();
    } catch (error) {
      console.error('Error toggling employee department:', error);
    }
  };

  const openEditModal = (dept: AdministrativeDepartment) => {
    setEditingDept(dept);
    setFormData(dept);
    setIsModalOpen(true);
  };

  const openEmployeeModal = (dept: AdministrativeDepartment) => {
    setActiveDeptForEmployees(dept);
    setIsEmployeeModalOpen(true);
  };

  // Build a tree structure for display
  const buildTree = (parentId?: string) => {
    return adminDepartments
      .filter(d => (parentId ? d.parentDeptId === parentId : !d.parentDeptId))
      .map(dept => (
        <div key={dept.id} className="space-y-4">
          <div className="flex items-center gap-4 group">
            <div className={cn(
              "flex-1 bg-card p-6 rounded-3xl border border-border shadow-sm transition-all hover:shadow-md hover:border-primary/50 relative",
              parentId && "mr-12"
            )}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <h4 className="text-xl font-black text-foreground">{dept.name}</h4>
                    <p className="text-sm text-muted-foreground font-medium">{dept.description || t('لا يوجد وصف')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => openEmployeeModal(dept)}
                    title={t('إدارة الموظفين')}
                    className="p-2 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-xl transition-all"
                  >
                    <UserPlus className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => openEditModal(dept)}
                    className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setDeleteConfirmId(dept.id)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground font-sans">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    المدير: {employees.find(e => e.id === dept.managerId)?.name || t('غير محدد')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-black text-primary bg-primary/10 px-3 py-1 rounded-full">
                  <Briefcase className="w-3 h-3" />
                  {employees.filter(e => e.departmentId === dept.id).length} موظف
                </div>
              </div>

              {parentId && (
                <div className="absolute right-[-80px] top-1/2 -translate-y-1/2 w-[80px] h-0.5 border-t-2 border-dashed border-primary/40" />
              )}
            </div>
          </div>
          <div className="mr-8 border-r-2 border-dashed border-border/50 pr-8">
            {buildTree(dept.id)}
          </div>
        </div>
      ));
  };

  return (
    <div className="space-y-8 pb-20">
      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        onConfirm={() => deleteConfirmId && handleDelete(deleteConfirmId)}
        title={t('تأكيد حذف القسم')}
        description={t('هل أنت متأكد من حذف هذا القسم؟ سيتم إزالة جميع الموظفين منه وتحويلهم إلى (بدون قسم). لا يمكن التراجع عن هذا الإجراء.')}
      />
      <div className="flex justify-between items-center bg-card p-8 rounded-[3rem] border border-border shadow-sm">
        <div className="text-right">
          <h1 className="text-4xl font-bold text-foreground mb-2">{t('الهيكل الإداري')}</h1>
          <p className="text-muted-foreground font-medium text-lg">{t('إدارة الأقسام والوحدات التنظيمية والمسؤولين عنها')}</p>
        </div>
        <button 
          onClick={() => {
            setEditingDept(null);
            setFormData({ name: '', description: '', managerId: '', parentDeptId: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 rounded-2xl font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
        >
          <Plus className="w-6 h-6" />{t('إضافة قسم جديد')}</button>
      </div>

      <div className="space-y-8 bg-muted/30 p-8 rounded-[3rem] border border-border min-h-[600px]">
        {adminDepartments.length > 0 ? (
          buildTree()
        ) : (
          <div className="flex flex-col items-center justify-center py-32 text-muted-foreground gap-4">
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center border border-border shadow-inner">
              <Network className="w-10 h-10" />
            </div>
            <p className="text-xl font-bold">{t('لم يتم تعريف أقسام إدارية بعد')}</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-primary font-black hover:underline"
            >{t('ابدأ بإضافة أول قسم')}</button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsModalOpen(false)} 
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="relative bg-card w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-border"
            >
              <div className="p-8 border-b border-border bg-muted/30 flex justify-between items-center">
                <h3 className="text-2xl font-black text-foreground">
                  {editingDept ? t('تعديل بيانات القسم') : t('إضافة قسم جديد')}
                </h3>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2 text-right">
                    <label className="text-sm font-black text-muted-foreground mr-2">{t('اسم القسم')}</label>
                    <input 
                      required
                      placeholder={t('مثال: قسم تطوير البرمجيات')}
                      className="w-full px-6 py-4 bg-muted border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold transition-all text-foreground placeholder:text-muted-foreground/40"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 text-right">
                    <label className="text-sm font-black text-muted-foreground mr-2">{t('الوصف')}</label>
                    <textarea 
                      placeholder={t('وصف مختصر لمهام القسم...')}
                      className="w-full px-6 py-4 bg-muted border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold transition-all h-24 resize-none text-foreground placeholder:text-muted-foreground/40"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 text-right">
                      <label className="text-sm font-black text-muted-foreground mr-2">{t('المدير المسؤول')}</label>
                      <select 
                        required
                        className="w-full px-6 py-4 bg-muted border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold transition-all text-foreground"
                        value={formData.managerId || ''}
                        onChange={(e) => setFormData({ ...formData, managerId: e.target.value })}
                      >
                        <option value="" className="bg-card">{t('اختر مديراً...')}</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id} className="bg-card">{emp.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 text-right">
                      <label className="text-sm font-black text-muted-foreground mr-2">{t('القسم الأعلى (اختياري)')}</label>
                      <select 
                        className="w-full px-6 py-4 bg-muted border border-border rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold transition-all text-foreground"
                        value={formData.parentDeptId || ''}
                        onChange={(e) => setFormData({ ...formData, parentDeptId: e.target.value })}
                      >
                        <option value="" className="bg-card">{t('لا يوجد (قسم رئيسي)')}</option>
                        {adminDepartments.filter(d => d.id !== editingDept?.id).map(dept => (
                          <option key={dept.id} value={dept.id} className="bg-card">{dept.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit" 
                    className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-2xl transition-all shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95"
                  >
                    {editingDept ? t('تحديث البيانات') : t('حفظ القسم')}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="flex-1 py-4 bg-muted text-muted-foreground font-black rounded-2xl hover:bg-muted/50 transition-colors border border-border"
                  >{t('إلغاء')}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isEmployeeModalOpen && activeDeptForEmployees && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsEmployeeModalOpen(false)} className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-card w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border">
              <div className="p-8 border-b border-border bg-muted/30 flex justify-between items-center">
                <div className="text-right">
                  <h3 className="text-2xl font-black text-foreground">{t('إدارة موظفي القسم')}</h3>
                  <p className="text-sm font-bold text-primary">{activeDeptForEmployees.name}</p>
                </div>
                <button onClick={() => setIsEmployeeModalOpen(false)} className="p-2 hover:bg-muted font-sans rounded-full transition-colors text-muted-foreground"><X/></button>
              </div>
              
              <div className="p-6 border-b border-border">
                <div className="relative">
                  <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <input 
                    type="text"
                    placeholder={t('البحث عن موظف بالاسم أو الرقم الوظيفي...')}
                    className="w-full pr-12 pl-4 py-3 bg-muted border border-border rounded-xl outline-none focus:ring-2 focus:ring-primary font-bold text-foreground placeholder:text-muted-foreground/40"
                    value={employeeSearchTerm}
                    onChange={(e) => setEmployeeSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {employees
                  .filter(e => 
                    e.name.toLowerCase().includes(employeeSearchTerm.toLowerCase()) || 
                    e.employeeId.includes(employeeSearchTerm)
                  )
                  .map(emp => {
                    const isInThisDept = emp.departmentId === activeDeptForEmployees.id;
                    const isInOtherDept = emp.departmentId && emp.departmentId !== activeDeptForEmployees.id;
                    
                    return (
                      <button
                        key={emp.id}
                        onClick={() => handleToggleEmployee(emp.id, emp.departmentId)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                          isInThisDept 
                            ? "bg-primary/10 border-primary/20" 
                            : "bg-card border-border hover:border-primary/30"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold",
                            isInThisDept ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {isInThisDept ? <Check className="w-6 h-6" /> : emp.name[0]}
                          </div>
                          <div className="text-right">
                            <p className="font-black text-foreground">{emp.name}</p>
                            <p className="text-xs text-muted-foreground font-bold font-sans">
                              رقم وظيفي: {emp.employeeId} 
                              {isInOtherDept && ` | ${adminDepartments.find(d => d.id === emp.departmentId)?.name}`}
                            </p>
                          </div>
                        </div>
                        {isInThisDept && (
                          <div className="text-xs font-black text-primary bg-card px-3 py-1 rounded-full border border-primary/10 shadow-sm">{t('مضاف للقسم')}</div>
                        )}
                      </button>
                    );
                  })}
              </div>

              <div className="p-8 border-t border-border bg-muted/30">
                <button 
                  onClick={() => setIsEmployeeModalOpen(false)}
                  className="w-full py-4 bg-primary text-primary-foreground font-black rounded-2xl shadow-lg shadow-primary/10 hover:bg-primary/90 transition-all"
                >{t('تم')}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminStructure;
