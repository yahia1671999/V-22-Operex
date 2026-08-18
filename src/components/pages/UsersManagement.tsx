import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Shield, 
  UserCheck, 
  UserX, 
  Trash2, 
  Mail,
  ShieldAlert,
  Edit,
  Settings,
  X as CloseIcon,
  Camera,
  Upload,
  Image as ImageIcon,
  User as UserIcon,
  Copy,
  RotateCcw,
  CheckCircle2,
  AlertOctagon,
  Eye,
  Key,
  ShieldCheck,
  Check,
  Info
} from 'lucide-react';
import { db, setDoc, doc, deleteDoc, OperationType, handleApiError } from '../../api';
import { useData } from '../../contexts/DataContext';
import { AppUser, UserRole } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ConfirmDialog } from '../common/ConfirmDialog';

// Default Role Options
const SYSTEM_ROLES: { key: string; label: string; desc: string }[] = [
  { key: 'Super Admin', label: 'سوبر أدمن (Super Admin)', desc: 'كامل الصلاحيات المطلقة بالمنشأة لتغيير الكود والأمان والتحكم بكافة البيانات.' },
  { key: 'System Admin', label: 'مدير النظام (System Admin)', desc: 'إدارة أمن وحسابات وموظفي النظام، مراقبة السجلات الأمنية، وتهيئة شبكات الواي فاي.' },
  { key: 'Operations Director', label: 'مدير التشغيل (Operations Director)', desc: 'الإشراف الكامل على قسم العمليات والمشاريع والمهام والشاشات التابعة للتشغيل.' },
  { key: 'Project Manager', label: 'مدير مشروع (Project Manager)', desc: 'إدارة المشاريع المسندة إليه، إنشاء وتعديل وإلغاء المهام والدردشات مع أعضاء فريقه.' },
  { key: 'Team Leader', label: 'قائد فريق (Team Leader)', desc: 'متابعة مهام المشاريع وتوجيه المطورين والاستشاريين والموافقة على منجزاتهم.' },
  { key: 'Operations User', label: 'مهندس تشغيل (Operations User)', desc: 'المطور أو الاستشاري المسؤول عن إنهاء المهام ورفع التحديثات والتفاعل مع الدردشة.' },
  { key: 'HR Manager', label: 'مدير الموارد البشرية (HR Manager)', desc: 'إدارة الهيكل الإداري الكامل، ملفات الموظفين، الحضور والانصراف، والاعتمادات الكبرى.' },
  { key: 'HR Officer', label: 'مسؤول الموارد البشرية (HR Officer)', desc: 'متابعة الحسابات والتسجيل، الحضور اليومي، التقديم، ومسؤولية البصومة.' },
  { key: 'Payroll Manager', label: 'مدير الرواتب والمالية (Payroll Manager)', desc: 'إعداد الكامل للمسيرات الشهرية واعتماد البدلات والحركات وتصفية مستحقات الموظفين.' },
  { key: 'Payroll Officer', label: 'مسؤول الرواتب (Payroll Officer)', desc: 'إدخال الحركات والتعديلات والبدلات والفرز الأولي للمسيرات والمحافظ المباشرة.' },
  { key: 'Attendance Officer', label: 'مسؤول الحضور والانصراف (Attendance Officer)', desc: 'مراقبة سجلات الدخول والخروج اليومية، ورديات العمل، وأجهزة البصمة.' },
  { key: 'Auditor', label: 'المراجع والمراقب المالي (Auditor)', desc: 'صلاحيات الاطلاع الكاملة لرؤية الرواتب وسجلات التشغيل وأحداث لتدقيق ومتابعة الأمان.' },
  { key: 'Employee', label: 'الموظف العادي - الخدمة الذاتية (Employee)', desc: 'صلاحيات الخدمة الذاتية الخاصة به فقط؛ تسجيل الحضور، ومتابعة البدلات والإجازات والمهام.' }
];

import { ROLE_PERMISSIONS as SYSTEM_ROLE_PRESETS, SYSTEM_PERMISSIONS } from '../../lib/rolePermissions';
import { useLanguage } from '../../contexts/LanguageContext';

interface PermissionNode {
  key: string;
  label: string;
  description: string;
  isDangerous: boolean;
}

interface PermissionGroup {
  id: string;
  title: string;
  nodes: PermissionNode[];
}

const MODULE_LABELS: Record<string, string> = {
  'admin': 'إدارة النظام والأمن (System Security & Admin)',
  'hr': 'الموارد البشرية وشؤون الموظفين (HR Core & Workflows)',
  'payroll': 'الرواتب والعمليات المالية (Payroll & Finance)',
  'operations': 'المشاريع والمهام والتشغيل (Operations & Projects)',
  'self_service': 'الخدمة الذاتية للموظف (Self-Service Profile)',
  'files': 'إدارة الملفات والمستندات (Files & Documents)'
};

const generateDynamicGroups = (): PermissionGroup[] => {
  const groupsMap: Record<string, typeof SYSTEM_PERMISSIONS> = {};
  
  SYSTEM_PERMISSIONS.forEach(node => {
    const mod = node.module || 'other';
    if (!groupsMap[mod]) {
      groupsMap[mod] = [];
    }
    groupsMap[mod].push(node);
  });

  const order = ['self_service', 'hr', 'payroll', 'operations', 'admin', 'files'];
  return order.map(modKey => {
    const nodes = groupsMap[modKey] || [];
    return {
      id: modKey,
      title: MODULE_LABELS[modKey] || modKey,
      nodes: nodes.map(n => ({
        key: n.key,
        label: n.arabicLabel,
        description: n.description,
        isDangerous: !!n.isDangerous
      }))
    };
  }).filter(g => g.nodes.length > 0);
};

const PERMISSION_GROUPS = generateDynamicGroups();

const checkPasswordRequirements = (password: string) => {
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return {
    isValid: hasMinLength && hasUppercase && hasLowercase && hasDigit && hasSpecial,
    requirements: { hasMinLength, hasUppercase, hasLowercase, hasDigit, hasSpecial }
  };
};

export const UsersManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { appUsers: users, employees = [], refreshData } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [permissionQuery, setPermissionQuery] = useState('');
  
  // Custom interface test variables
  const [testAccessKey, setTestAccessKey] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, show: boolean }>({ id: '', show: false });
  const [authPassword, setAuthPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'permissions' | 'preview'>('details');

  const [formData, setFormData] = useState<Omit<AppUser, 'id' | 'createdAt'>>({
    email: '',
    name: '',
    role: 'Viewer',
    status: 'Active',
    photoUrl: '',
    employeeId: '',
    permissions: {
      directPermissions: [] as string[]
    } as any
  });

  // Calculate missing employee warning
  const needsEmployeeMapping = useMemo(() => {
    const rolesThatNeedMapping: string[] = [
      'Employee', 
      'Operations User', 
      'Team Leader', 
      'Project Manager', 
      'Operations Director',
      'HR Manager',
      'HR Officer',
      'Payroll Manager',
      'Payroll Officer'
    ];
    return rolesThatNeedMapping.includes(formData.role) && !formData.employeeId;
  }, [formData.role, formData.employeeId]);

  // Copy Permissions From Selected User ID
  const [copyUserId, setCopyUserId] = useState('');

  const handleCopyPermissions = () => {
    if (!copyUserId) return;
    const targetUser = users.find(u => u.id === copyUserId);
    if (targetUser) {
      const perms = (targetUser.permissions as any) || {};
      const targetDirectPerms = Array.isArray(perms.directPermissions) 
        ? perms.directPermissions 
        : [];
      
      setFormData(prev => ({
        ...prev,
        role: targetUser.role as any,
        employeeId: targetUser.employeeId || prev.employeeId || '',
        permissions: {
          ...prev.permissions,
          directPermissions: [...targetDirectPerms]
        } as any
      }));
      alert(`تم نسخ دور (${targetUser.role}) وصلاحياته المباشرة من (${targetUser.name}) بنجاح!`);
    }
  };

  // Reset/Clone role presets to default
  const handleCloneRolePresets = () => {
    const defaultPerms = SYSTEM_ROLE_PRESETS[formData.role] || ['self_service.*'];
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        directPermissions: [...defaultPerms]
      } as any
    }));
  };

  // Compile effective permissions for preview
  const effectivePermissionsList = useMemo(() => {
    const rolePerms = SYSTEM_ROLE_PRESETS[formData.role] || [];
    const directPerms = Array.isArray((formData.permissions as any)?.directPermissions) 
      ? (formData.permissions as any).directPermissions 
      : [];
    
    // Union
    const combined = new Set([...rolePerms, ...directPerms]);
    return Array.from(combined);
  }, [formData.role, (formData.permissions as any)?.directPermissions]);

  // Local helper logic to check if required keys are in effective
  const checkEffectivePermission = (requiredKey: string, effective: string[]): boolean => {
    if (effective.includes('*') || effective.includes('all')) return true;
    if (effective.includes(requiredKey)) return true;

    const requiredParts = requiredKey.split('.');
    for (const item of effective) {
      if (item === '*') return true;
      const parts = item.split('.');
      let match = true;
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '*') return true;
        if (parts[i] !== requiredParts[i]) {
          match = false;
          break;
        }
      }
      if (match && parts.length === requiredParts.length) return true;
    }
    return false;
  };

  // Access test checker output
  const isTestedAccessGranted = useMemo(() => {
    if (!testAccessKey.trim()) return null;
    return checkEffectivePermission(testAccessKey.trim(), effectivePermissionsList);
  }, [testAccessKey, effectivePermissionsList]);

  const openAddModal = () => {
    setEditingUserId(null);
    setAuthPassword('');
    setFormData({
      email: '',
      name: '',
      role: 'Employee' as any,
      status: 'Active',
      photoUrl: '',
      employeeId: '',
      permissions: {
        directPermissions: ['self_service.*', 'files.download']
      } as any
    });
    setCopyUserId('');
    setActiveTab('details');
    setIsModalOpen(true);
  };

  const openEditModal = (u: AppUser) => {
    setEditingUserId(u.id);
    setAuthPassword('');
    
    const loadedPerms = u.permissions || {};
    const directPerms = Array.isArray((loadedPerms as any).directPermissions)
      ? (loadedPerms as any).directPermissions
      : [];

    setFormData({
      email: u.email,
      name: u.name,
      role: u.role as any,
      status: u.status,
      photoUrl: u.photoUrl || '',
      employeeId: u.employeeId || '',
      permissions: {
        ...loadedPerms,
        directPermissions: directPerms
      } as any
    });
    setCopyUserId('');
    setActiveTab('details');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() || !formData.name.trim()) {
      alert("الاسم والبريد الإلكتروني خيارات إلزامية!");
      return;
    }

    if (!editingUserId) {
      const strength = checkPasswordRequirements(authPassword);
      if (!strength.isValid) {
        alert("كلمة المرور لا تطابق المعايير الأمنية للأرقام والرموز الخاصة!");
        return;
      }
    }

    const id = editingUserId || formData.email.toLowerCase().replace(/\s+/g, '');
    
    // Ensure only valid SYSTEM_PERMISSIONS or authorized wildcards are stored
    const validPermKeys = new Set(SYSTEM_PERMISSIONS.map(p => p.key));
    validPermKeys.add('*');
    const directPerms = Array.isArray((formData.permissions as any)?.directPermissions)
      ? (formData.permissions as any).directPermissions
      : [];
    const filteredDirectPerms = directPerms.filter((p: string) => {
      if (p === '*') return true;
      if (p.endsWith('.*') || ['hr', 'payroll', 'admin', 'operations', 'self_service', 'files'].includes(p)) return true;
      return validPermKeys.has(p);
    });

    const sanitizedPermissions = {
      ...(formData.permissions || {}),
      directPermissions: filteredDirectPerms
    };
    
    try {
      const payload = {
        ...formData,
        id: id,
        email: formData.email.toLowerCase().trim(),
        employeeId: formData.employeeId || null,
        permissions: sanitizedPermissions,
        updatedAt: new Date().toISOString(),
        ...(editingUserId ? {} : { 
          createdAt: new Date().toISOString(),
          password: authPassword
        })
      };

      await setDoc(doc(db, 'users', id), payload, { merge: true });
      setIsModalOpen(false);
      refreshData();
      alert("تم حفظ بيانات وامتيازات أمان المستخدم بنجاح!");
    } catch (err: any) {
      console.error("Error setting user doc:", err);
      alert(err?.message || t(t('فشلت عملية حفظ التعديلات')));
      handleApiError(err, OperationType.UPDATE, 'users');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (id === 'admin') {
        alert("لا يمكن حذف حساب السوبر أدمن الأساسي للنظام لمبررات الأمان!");
        return;
      }
      await deleteDoc(doc(db, 'users', id));
      setDeleteConfirm({ id: '', show: false });
      refreshData();
      alert("تم إزالة صلاحيات الحساب وتعطيله بنجاح.");
    } catch (err: any) {
      alert("فشل مسح الحساب: " + err.message);
    }
  };

  const toggleDirectPermNode = (nodeKey: string) => {
    setFormData(prev => {
      const currentList = Array.isArray((prev.permissions as any)?.directPermissions)
        ? [...(prev.permissions as any).directPermissions]
        : [];
      
      const updatedList = currentList.includes(nodeKey)
        ? currentList.filter(k => k !== nodeKey)
        : [...currentList, nodeKey];

      return {
        ...prev,
        permissions: {
          ...prev.permissions,
          directPermissions: updatedList
        } as any
      };
    });
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      ((u.name || '').toLowerCase()).includes((searchTerm || '').toLowerCase()) ||
      ((u.email || '').toLowerCase()).includes((searchTerm || '').toLowerCase()) ||
      ((u.role || '').toLowerCase()).includes((searchTerm || '').toLowerCase())
    );
  }, [users, searchTerm]);

  // Highlight permission nodes based on local search inside matrix
  const isNodeSearched = (nodeKey: string, nodeLabel: string): boolean => {
    if (!permissionQuery.trim()) return false;
    const q = permissionQuery.toLowerCase();
    return nodeKey.toLowerCase().includes(q) || nodeLabel.toLowerCase().includes(q);
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Title Banner */}
      <div className="flex items-center gap-4 bg-gradient-to-l from-slate-900 to-slate-800 p-6 rounded-[2rem] border border-slate-700/50 shadow-md">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
          <Shield className="w-8 h-8 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">{t('إدارة حسابات ومستخدمي النظام')}</h1>
          <p className="text-slate-300 font-medium mt-1">{t('ضبط الأدوار القيادية وتوجيه الصلاحيات لكل المنشأة من خلال لوحة أمنية موحدة.')}</p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
          <input 
            type="text" 
            placeholder={t('البحث بالاسم، البريد أو المسمى الوظيفي...')}
            className="w-full pr-12 pl-4 py-3 bg-card border border-border rounded-2xl focus:ring-2 focus:ring-primary outline-none transition-all font-medium text-foreground text-right"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={openAddModal}
          className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-2xl transition-all shadow-lg shadow-primary/20 cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          <span>{t('إنشاء حساب مستخدم جديد')}</span>
        </button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((u) => {
          const isLinked = !!u.employeeId;
          const employeeName = isLinked 
            ? (employees.find(e => e.id === u.employeeId)?.name || t('موظف مجهول'))
            : null;

          return (
            <motion.div 
              key={u.id}
              layout
              className="bg-card border border-border rounded-[2rem] p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden"
            >
              <div className="space-y-4">
                {/* Header Profile Info */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 border border-border flex items-center justify-center overflow-hidden">
                    {u.photoUrl ? (
                      <img src={u.photoUrl} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="text-right">
                    <h2 className="font-extrabold text-foreground text-base line-clamp-1">{u.name}</h2>
                    <span className="text-xs text-muted-foreground block line-clamp-1 mt-0.5">{u.email}</span>
                  </div>
                </div>

                {/* Badge tags */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-dashed border-border/60">
                  <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 text-xs font-black rounded-lg">
                    {u.role}
                  </span>
                  
                  {u.status === 'Active' ? (
                    <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-bold rounded-lg">{t('نشط / فعال')}</span>
                  ) : (
                    <span className="px-3 py-1 bg-red-500/10 text-red-600 border border-red-500/20 text-xs font-bold rounded-lg">{t('معطل')}</span>
                  )}

                  {isLinked ? (
                    <span className="px-2 py-1 bg-sky-500/10 text-sky-600 border border-sky-500/20 text-[11px] font-bold rounded-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      مرتبط بـ: {employeeName}
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[11px] font-extrabold rounded-lg flex items-center gap-1">
                      <AlertOctagon className="w-3.5 h-3.5" />{t('غير مرتبط بملف موظف')}</span>
                  )}
                </div>

                {/* Direct Permissions Snippet Summary count */}
                <div className="bg-muted/40 p-3 rounded-xl border border-border/50 text-right text-xs">
                  <span className="font-bold text-muted-foreground">{t('صلاحيات أمان مباشرة مخصصة:')}</span>
                  <span className="font-black text-foreground ml-1">
                    {(u.permissions as any)?.directPermissions?.length || 0} عقدة
                  </span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border/80">
                <button 
                  onClick={() => openEditModal(u)}
                  className="p-2.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-all shadow-sm cursor-pointer"
                  title={t('تعديل الصلاحيات والأمان')}
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setDeleteConfirm({ id: u.id, show: true })}
                  className="p-2.5 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 rounded-xl transition-all shadow-sm cursor-pointer"
                  title={t('إنهاء الصلاحيات والحذف')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Edit/Create Form Modal Container */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-5xl bg-card border border-border rounded-[2.5rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
              dir="rtl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-slate-50 dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-black text-foreground">
                      {editingUserId ? t('تحديث صلاحيات وتعيينات الحساب') : t('تأسيس حساب أمني وملف دخول جديد')}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('تهيئة أدوار المسؤوليات وإدارة شبكات وصلاحيات الموظفين الكلية.')}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <CloseIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Form Navigation Tabs */}
              <div className="flex border-b border-border bg-muted/30 px-6 gap-2">
                <button 
                  onClick={() => setActiveTab('details')}
                  className={cn(
                    "px-5 py-3 text-xs font-black transition-all border-b-2 hover:text-foreground relative top-[1px] flex items-center gap-2",
                    activeTab === 'details' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                  )}
                >
                  <UserIcon className="w-4 h-4" />{t('تفاصيل وبيانات الحساب')}</button>
                <button 
                  onClick={() => setActiveTab('permissions')}
                  className={cn(
                    "px-5 py-3 text-xs font-black transition-all border-b-2 hover:text-foreground relative top-[1px] flex items-center gap-2",
                    activeTab === 'permissions' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                  )}
                >
                  <ShieldCheck className="w-4 h-4" />{t('مصفوفة الصلاحيات المخصصة')}</button>
                <button 
                  onClick={() => setActiveTab('preview')}
                  className={cn(
                    "px-5 py-3 text-xs font-black transition-all border-b-2 hover:text-foreground relative top-[1px] flex items-center gap-2",
                    activeTab === 'preview' ? "border-primary text-primary" : "border-transparent text-muted-foreground"
                  )}
                >
                  <Eye className="w-4 h-4" />{t('عرض كافة الصلاحيات الفعالة')}</button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                
                {/* 1. View / Set Account details */}
                {activeTab === 'details' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-right">
                    
                    {/* Real Profile Mapping Warnings */}
                    {needsEmployeeMapping && (
                      <div className="col-span-2 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-4 rounded-2xl flex gap-3 text-sm font-semibold relative">
                        <AlertOctagon className="w-6 h-6 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-extrabold text-amber-800 dark:text-amber-300">{t('تنبيه: حساب الأمان تائه (غير مرتبط بملف موظف)!')}</p>
                          <p className="mt-1 leading-relaxed text-xs">{t('لقد قمت باختيار دور إداري أو دور خدمي يستلزم تفتيش علاقات الموظفين. بدون ربطه بملف الموظف المناسب، لن يتمكن هذا الحساب من رؤية المهام، شات المشاريع، الحضور والانصراف، أو تقديم الاستحقاقات عبر لوحات الخدمة الذاتية.')}</p>
                        </div>
                      </div>
                    )}

                    {/* Basic Form fields */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground block">{t('الاسم الكامل للمستخدم')}</label>
                      <input 
                        type="text" 
                        required
                        className="w-full p-3 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm text-foreground"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={t('أدخل الاسم الرباعي للموظف')}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground block">{t('البريد الإلكتروني (عنوان تسجيل الدخول الرسمي)')}</label>
                      <input 
                        type="email" 
                        required
                        disabled={!!editingUserId}
                        className="w-full p-3 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm text-foreground disabled:bg-muted"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="example@organization.com"
                      />
                    </div>

                    {/* Employee profile mapping selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground block flex items-center gap-1">
                        <span>{t('ربط الحساب بملف الموظف الوظيفي (Employee Profile)')}</span>
                        <span className="text-rose-500 font-extrabold">*</span>
                      </label>
                      <select 
                        className="w-full p-3 border border-border bg-card rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm text-foreground"
                        value={formData.employeeId}
                        onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                      >
                        <option value="">{t('-- لم يتم الربط / حساب تائه مستقل --')}</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.name} (رقم وظيفي: {emp.employeeId || emp.id})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Role Selection & Description presets */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground block">{t('الدور العام والافتراضي (System Role)')}</label>
                      <select 
                        className="w-full p-3 border border-border bg-card rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm text-foreground font-bold text-primary"
                        value={formData.role}
                        onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                      >
                        {SYSTEM_ROLES.map(role => (
                          <option key={role.key} value={role.key}>
                            {t(role.label)}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] font-bold text-slate-400 block mt-1">
                        {t(SYSTEM_ROLES.find(r => r.key === formData.role)?.desc || '')}
                      </span>
                    </div>

                    {/* Account state setting */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground block">{t('حالة الحساب وأمان الدخول')}</label>
                      <select 
                        className="w-full p-3 border border-border bg-card rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm text-foreground"
                        value={formData.status}
                        onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      >
                        <option value="Active">{t('نشط ومسموح بتسجيل الدخول')}</option>
                        <option value="Inactive">{t('معطل وقيد المراجعة الأمنية')}</option>
                      </select>
                    </div>

                    {/* Password section on Create */}
                    {!editingUserId ? (
                      <div className="bg-slate-50 dark:bg-slate-900 border border-border p-4 rounded-xl col-span-2 space-y-3">
                        <div className="flex items-center gap-2">
                          <Key className="w-5 h-5 text-primary" />
                          <h4 className="font-extrabold text-sm text-foreground">{t('تأسيس كلمة المرور الجديدة الفعالة للأمان')}</h4>
                        </div>
                        <input 
                          type="password" 
                          required
                          className="w-full p-3 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm bg-card text-foreground text-left"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder={t('أدخل كلمة مرور معقدة')}
                          dir="ltr"
                        />
                        {authPassword && (
                          <div className="p-3 bg-muted/60 rounded-xl space-y-2 text-right">
                            <span className="text-xs font-extrabold text-muted-foreground">{t('صمام فحص جدار كلمة المرور:')}</span>
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold text-muted-foreground pt-1">
                              <span className={authPassword.length >= 8 ? "text-emerald-500" : "text-rose-500"}>
                                {authPassword.length >= 8 ? "✓" : "✗"} 8 خانات على الأقل
                              </span>
                              <span className={/[A-Z]/.test(authPassword) ? "text-emerald-500" : "text-rose-500"}>
                                {/[A-Z]/.test(authPassword) ? "✓" : "✗"} حرف كبير واحد
                              </span>
                              <span className={/[a-z]/.test(authPassword) ? "text-emerald-500" : "text-rose-500"}>
                                {/[a-z]/.test(authPassword) ? "✓" : "✗"} حرف صغير واحد
                              </span>
                              <span className={/[!@#$%^&*(),.?":{}|<>]/.test(authPassword) ? "text-emerald-500" : "text-rose-500"}>
                                {/[!@#$%^&*(),.?":{}|<>]/.test(authPassword) ? "✓" : "✗"} رمز خاص معقد
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="col-span-2 bg-muted/30 p-4 border border-border rounded-xl text-right text-xs text-muted-foreground font-semibold">{t('ملاحظة أمنية: لتعديل كلمة المرور أو كلمة مرور القفل، الرجاء استخدام زر التعديل من صفحة "الملف الشخصي" أو إحدى الأدوات من صفحة "UsersManagement" بمفاتيح مشفرة ومصادق عليها.')}</div>
                    )}

                    {/* Avatar Upload */}
                    <div className="col-span-2 space-y-2">
                      <label className="text-xs font-bold text-muted-foreground block">{t('رابط الصورة الشخصية (اختياري)')}</label>
                      <input 
                        type="text" 
                        className="w-full p-3 border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all text-sm text-foreground text-left"
                        value={formData.photoUrl || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, photoUrl: e.target.value }))}
                        placeholder="https://example.com/photo.png"
                        dir="ltr"
                      />
                    </div>

                  </div>
                )}

                {/* 2. Direct Permission Matrix Checkboxes */}
                {activeTab === 'permissions' && (
                  <div className="space-y-6 text-right">

                    {/* Top Action Ribbon for copying / cloning */}
                    <div className="bg-slate-50 dark:bg-slate-900 border border-border p-5 rounded-3xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                      
                      {/* Clone system default button */}
                      <button 
                        type="button"
                        onClick={handleCloneRolePresets}
                        className="px-4 py-2 border border-primary text-primary hover:bg-primary/10 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>إعادة تعيين لصلاحيات الدور ({formData.role}) الافتراضية</span>
                      </button>

                      {/* Copy configuration from another user */}
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-xs font-bold text-muted-foreground shrink-0">{t('نسخ الصلاحيات بالكامل من:')}</span>
                        <select 
                          className="p-2 border border-border bg-card rounded-xl text-xs text-foreground focus:ring-1 focus:ring-primary outline-none font-bold"
                          value={copyUserId}
                          onChange={(e) => setCopyUserId(e.target.value)}
                        >
                          <option value="">{t('-- اختر مستخدمًا آخر --')}</option>
                          {users.filter(u => u.id !== editingUserId).map(u => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.role})
                            </option>
                          ))}
                        </select>
                        <button 
                          type="button"
                          onClick={handleCopyPermissions}
                          disabled={!copyUserId}
                          className="p-2 bg-slate-200 dark:bg-slate-800 text-foreground hover:bg-slate-300 dark:hover:bg-slate-700 disabled:opacity-40 rounded-xl transition-all cursor-pointer"
                          title={t('نسخ الحساب')}
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>

                    </div>

                    {/* Local Permission Filter Query Search bar */}
                    <div className="relative">
                      <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <input 
                        type="text" 
                        placeholder={t('ابحث وصَفِّ لتحديد الصلاحيات المخصصة بسرعة...')}
                        className="w-full pr-10 pl-4 py-2.5 bg-muted/60 border border-border rounded-xl text-xs text-foreground font-semibold focus:ring-2 focus:ring-primary outline-none transition-all"
                        value={permissionQuery}
                        onChange={(e) => setPermissionQuery(e.target.value)}
                      />
                    </div>

                    {/* Matrix render */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      {PERMISSION_GROUPS.map(group => {
                        const directPerms = Array.isArray((formData.permissions as any)?.directPermissions) 
                          ? (formData.permissions as any).directPermissions 
                          : [];

                        return (
                          <div 
                            key={group.id}
                            className="bg-card border border-border rounded-2.5xl p-5 shadow-sm space-y-3"
                          >
                            <h3 className="font-extrabold text-sm text-foreground bg-slate-50 dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-border/60">
                              {group.title}
                            </h3>
                            <div className="space-y-2 pt-1">
                              {group.nodes.map(node => {
                                const isChecked = directPerms.includes(node.key);
                                const isHighlighted = isNodeSearched(node.key, node.label);

                                return (
                                  <label 
                                    key={node.key}
                                    className={cn(
                                      "flex items-start gap-3 p-2.5 rounded-xl border border-transparent hover:bg-muted/60 transition-all text-xs font-semibold cursor-pointer text-right min-h-[44px]",
                                      isChecked ? "bg-primary/5 border-primary/20 text-primary" : "text-foreground",
                                      isHighlighted ? "ring-2 ring-amber-500 bg-amber-500/5" : ""
                                    )}
                                  >
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleDirectPermNode(node.key)}
                                      className="mt-0.5 rounded border-border-foreground text-primary focus:ring-primary accent-primary w-4 h-4 shrink-0 transition-all cursor-pointer"
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="block">{node.label}</span>
                                        {node.isDangerous && (
                                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[9px] bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 font-bold border border-red-200/50">
                                            <AlertOctagon className="w-2.5 h-2.5 shrink-0" />{t('صلاحية حساسة خطيرة')}</span>
                                        )}
                                      </div>
                                      {node.description && (
                                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                                          {node.description}
                                        </p>
                                      )}
                                      <code className="text-[9px] text-slate-400 font-mono block mt-1" dir="ltr">
                                        {node.key}
                                      </code>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                )}

                {/* 3. Effective Permissions & Sandboxed Access Test Area */}
                {activeTab === 'preview' && (
                  <div className="space-y-6 text-right">
                    
                    {/* Sandboxed access simulation test sandbox block */}
                    <div className="bg-primary/5 border border-primary/10 rounded-2.5xl p-6 space-y-4">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-primary" />
                        <h4 className="font-extrabold text-sm text-foreground">{t('بيئة فحص وتأكيد الصلاحيات والامتيازات الممنوحة')}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{t('اكتب الكلمة المفتاحية للصلاحية ومستواها بالنظام (مثلاً:')}<code className="text-foreground font-semibold">operations.projects.create</code>{t(') وسنقوم بتقييم فعاليتها حسب مصفوفة دور المستخدم والامتيازات المباشرة المدخلة فوراً.')}</p>
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                          type="text"
                          placeholder={t('مثلاً: hr.employees.view')}
                          className="flex-1 p-3 border border-border bg-card rounded-xl text-xs font-bold text-left outline-none text-foreground focus:ring-2 focus:ring-primary"
                          dir="ltr"
                          value={testAccessKey}
                          onChange={(e) => setTestAccessKey(e.target.value)}
                        />
                        {testAccessKey.trim() && (
                          <div className={cn(
                            "px-5 py-3 rounded-xl border flex items-center gap-2 text-xs font-black sm:w-52 justify-center",
                            isTestedAccessGranted 
                              ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                              : "bg-red-500/15 border-red-500/20 text-red-600 dark:text-red-400"
                          )}>
                            {isTestedAccessGranted ? (
                              <>
                                <Check className="w-4 h-4" />
                                <span>{t('الوصول مسموح به (Granted)')}</span>
                              </>
                            ) : (
                              <>
                                <UserX className="w-4 h-4" />
                                <span>{t('الوصول محجوب (Denied)')}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Effective list panel */}
                    <div className="bg-card border border-border rounded-2.5xl p-5 space-y-4">
                      <h4 className="font-extrabold text-sm text-foreground flex items-center gap-1">
                        <Info className="w-4 h-4 text-primary" />
                        <span>قائمة بكل عقد الصلاحيات الفعالة حالياً ({effectivePermissionsList.length} كتل مفاتيح):</span>
                      </h4>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {effectivePermissionsList.map(node => (
                          <div 
                            key={node}
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-border rounded-lg text-xs font-mono font-bold text-foreground"
                            dir="ltr"
                          >
                            {node}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Modal Footer Controls */}
              <div className="px-8 py-5 border-t border-border bg-slate-50 dark:bg-slate-900 flex items-center justify-end gap-3.5">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-foreground font-extrabold rounded-xl text-xs transition-all cursor-pointer"
                >{t('إلغاء وإغلاق')}</button>
                <button 
                  type="button"
                  onClick={handleSubmit}
                  className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-black rounded-xl text-xs transition-all shadow-md shadow-primary/10 cursor-pointer"
                >{t('حفظ وتفعيل الصلاحيات')}</button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete/Revoke Confirm Dialog */}
      <ConfirmDialog 
        isOpen={deleteConfirm.show}
        title={t('تأكيد إلغاء صلاحيات وحذف الحساب أمنياً')}
        description={t('هل أنت متأكد من رغبتك في حذف وحذف صلاحية الدخول نهائياً لهذا الحساب من قواعد البيانات؟ هذا الإجراء لا يمكن التراجع عنه وسجل العمليات.')}
        onConfirm={() => handleDelete(deleteConfirm.id)}
        onClose={() => setDeleteConfirm({ id: '', show: false })}
        confirmLabel={t('تأكيد الحذف النهائي')}
        cancelLabel={t('التراجع والغاء')}
        variant="danger"
      />

    </div>
  );
};
