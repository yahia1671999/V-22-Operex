import React, { createContext, useContext, useState, useEffect } from 'react';
import translatedDictionary from './translated_dictionary.json';

export type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Basic translation dictionary
const translations: Record<Language, Record<string, string>> = {
  ar: {
    'nav.dashboard': 'لوحة التحكم',
    'nav.employees': 'الموظفين',
    'nav.payroll': 'مسير الرواتب',
    'nav.attendance': 'الحضور والانصراف',
    'nav.missions': 'المأموريات',
    'nav.adminStructure': 'الهيكل الإداري',
    'nav.orgChart': 'الهيكل التنظيمي',
    'nav.transactions': 'الحركات الشهرية',
    'nav.allowanceTypes': 'أنواع البدلات',
    'nav.settlements': 'تصفية البيانات',
    'nav.users': 'المستخدمين والصلاحيات',
    'nav.operations': 'إدارة العمليات',
    'nav.myTasks': 'مهامي الشخصية',
    'nav.systemAdmin': 'إدارة النظام',
    'nav.hr': 'الموارد البشرية',
    'nav.payrollModule': 'الرواتب',
    'nav.operationsModule': 'إدارة التشغيل',
    'nav.selfService': 'الخدمات الذاتية',
    'nav.logout': 'تسجيل الخروج',
    
    // Common keys
    'common.welcome': 'مرحباً بك في نظام OPerix',
    'common.search': 'بحث...',
    'common.add': 'إضافة',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.edit': 'تعديل',
    'common.delete': 'حذف',
    'common.actions': 'الإجراءات',
    'common.status': 'الحالة',
    'common.date': 'التاريخ',
    'common.name': 'الاسم',
    'common.success': 'نجاح',
    'common.error': 'خطأ',
    'common.loading': 'جاري التحميل...',
    'common.save_success': 'تم الحفظ بنجاح',
    'common.update_success': 'تم التعديل بنجاح',
    'common.delete_success': 'تم الحذف بنجاح',
    'common.approve_success': 'تم الاعتماد بنجاح',
    'common.lock_success': 'تم القفل بنجاح',

    // Required standardized keys
    'hr.employee.name': 'اسم الموظف',
    'hr.employee.department': 'القسم / الإدارة',
    'hr.employee.position': 'المسمى الوظيفي',
    'payroll.run.create': 'إنشاء حركات مسير الرواتب',
    'payroll.run.approve': 'اعتماد مسير الرواتب',
    'payroll.run.lock': 'قفل مسير الرواتب',
    'operations.project.create': 'إنشاء مشروع جديد',
    'operations.task.status': 'حالة المهمة',
    'selfservice.leave.request': 'تقديم طلب إجازة',
    'selfservice.mission.request': 'تقديم طلب مأمورية',

    // Workflow / database statuses bidirectional translation
    'Draft': 'مسودة',
    'draft': 'مسودة',
    'مسودة': 'مسودة',
    'Pending': 'قيد الانتظار',
    'pending': 'قيد الانتظار',
    'قيد الانتظار': 'قيد الانتظار',
    'Approved': 'معتمد',
    'approved': 'معتمد',
    'معتمد': 'معتمد',
    'Rejected': 'مرفوض',
    'rejected': 'مرفوض',
    'مرفوض': 'مرفوض',
    'Locked': 'مغلق',
    'locked': 'مغلق',
    'مغلق': 'مغلق',

    // Leave types bidirectional translation
    'Annual': 'إجازة سنوية',
    'annual': 'إجازة سنوية',
    'إجازة سنوية': 'إجازة سنوية',
    'Sick': 'إجازة مرضية',
    'sick': 'إجازة مرضية',
    'إجازة مرضية': 'إجازة مرضية',
    'Maternity': 'إجازة وضع/أموية',
    'maternity': 'إجازة وضع/أموية',
    'إجازة وضع': 'إجازة وضع/أموية',
    'Unpaid': 'إجازة بدون راتب',
    'unpaid': 'إجازة بدون راتب',
    'إجازة بدون راتب': 'إجازة بدون راتب',
    'Emergency': 'إجازة طارئة',
    'emergency': 'إجازة طارئة',
    'إجازة طارئة': 'إجازة طارئة',

    // Mission types bidirectional translation
    'Business Trip': 'مأمورية عمل خارجية',
    'business trip': 'مأمورية عمل خارجية',
    'مأمورية خارجية': 'مأمورية عمل خارجية',
    'Training': 'مأمورية تدريبية',
    'training': 'مأمورية تدريبية',
    'مأمورية تدريبية': 'مأمورية تدريبية',
    'Client Visit': 'زيارة موقع عميل',
    'client visit': 'زيارة موقع عميل',
    'زيارة عميل': 'زيارة موقع عميل',

    // Penalty types bidirectional translation
    'Warning': 'لفت نظر إداري',
    'warning': 'لفت نظر إداري',
    'لفت نظر إداري': 'لفت نظر إداري',
    'Final Warning': 'إنذار نهائي شديد اللهجة',
    'final warning': 'إنذار نهائي شديد اللهجة',
    'إنذار نهائي شديد اللهجة': 'إنذار نهائي شديد اللهجة',
    'Day Deduction': 'جزاء خصم من الراتب (أيام)',
    'day deduction': 'جزاء خصم من الراتب (أيام)',
    'خصم من الراتب': 'جزاء خصم من الراتب (أيام)',
    'Amount Deduction': 'خصم مالي مباشر',
    'amount deduction': 'خصم مالي مباشر',

    // System Messages bidirectional translation
    'Saved Successfully': 'تم الحفظ بنجاح',
    'Saved successfully': 'تم الحفظ بنجاح',
    'Updated Successfully': 'تم التعديل بنجاح',
    'Updated successfully': 'تم التعديل بنجاح',
    'Deleted Successfully': 'تم الحذف بنجاح',
    'Deleted successfully': 'تم الحذف بنجاح',
    'Approved Successfully': 'تم الاعتماد بنجاح',
    'Approved successfully': 'تم الاعتماد بنجاح',
    'Locked Successfully': 'تم القفل بنجاح',
    'Locked successfully': 'تم القفل بنجاح',
  },
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.employees': 'Employees',
    'nav.payroll': 'Payroll',
    'nav.attendance': 'Attendance',
    'nav.missions': 'Missions',
    'nav.adminStructure': 'Admin Structure',
    'nav.orgChart': 'Org Chart',
    'nav.transactions': 'Monthly Transactions',
    'nav.allowanceTypes': 'Allowance Types',
    'nav.settlements': 'Settlements',
    'nav.users': 'Users & Permissions',
    'nav.operations': 'Operations',
    'nav.myTasks': 'My Tasks',
    'nav.systemAdmin': 'System Admin',
    'nav.hr': 'HR',
    'nav.payrollModule': 'Payroll',
    'nav.operationsModule': 'Operations',
    'nav.selfService': 'Self Service',
    'nav.logout': 'Logout',
    
    // Common keys
    'common.welcome': 'Welcome to OPerix',
    'common.search': 'Search...',
    'common.add': 'Add',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.edit': 'Edit',
    'common.delete': 'Delete',
    'common.actions': 'Actions',
    'common.status': 'Status',
    'common.date': 'Date',
    'common.name': 'Name',
    'common.success': 'Success',
    'common.error': 'Error',
    'common.loading': 'Loading...',
    'common.save_success': 'Saved Successfully',
    'common.update_success': 'Updated Successfully',
    'common.delete_success': 'Deleted Successfully',
    'common.approve_success': 'Approved Successfully',
    'common.lock_success': 'Locked Successfully',

    // Required standardized keys
    'hr.employee.name': 'Employee Name',
    'hr.employee.department': 'Department / Admin Bureau',
    'hr.employee.position': 'Job Title',
    'payroll.run.create': 'Create Payroll Run',
    'payroll.run.approve': 'Approve Payroll Run',
    'payroll.run.lock': 'Lock Payroll Run',
    'operations.project.create': 'Create New Project',
    'operations.task.status': 'Task Status',
    'selfservice.leave.request': 'Request Leave',
    'selfservice.mission.request': 'Request Mission',

    // Workflow / database statuses bidirectional translation
    'Draft': 'Draft',
    'draft': 'Draft',
    'مسودة': 'Draft',
    'Pending': 'Pending Approval',
    'pending': 'Pending Approval',
    'قيد الانتظار': 'Pending Approval',
    'Approved': 'Approved',
    'approved': 'Approved',
    'معتمد': 'Approved',
    'Rejected': 'Rejected',
    'rejected': 'Rejected',
    'مرفوض': 'Rejected',
    'Locked': 'Locked',
    'locked': 'Locked',
    'مغلق': 'Locked',

    // Leave types bidirectional translation
    'Annual': 'Annual Leave',
    'annual': 'Annual Leave',
    'إجازة سنوية': 'Annual Leave',
    'Sick': 'Sick Leave',
    'sick': 'Sick Leave',
    'إجازة مرضية': 'Sick Leave',
    'Maternity': 'Maternity Leave',
    'maternity': 'Maternity Leave',
    'إجازة وضع': 'Maternity Leave',
    'Unpaid': 'Unpaid Leave',
    'unpaid': 'Unpaid Leave',
    'إجازة بدون راتب': 'Unpaid Leave',
    'Emergency': 'Emergency Leave',
    'emergency': 'Emergency Leave',
    'إجازة طارئة': 'Emergency Leave',

    // Mission types bidirectional translation
    'Business Trip': 'Business Trip',
    'business trip': 'Business Trip',
    'مأمورية خارجية': 'Business Trip',
    'Training': 'Training Course',
    'training': 'Training Course',
    'مأمورية تدريبية': 'Training Course',
    'Client Visit': 'Client Visit',
    'client visit': 'Client Visit',
    'زيارة عميل': 'Client Visit',

    // Penalty types bidirectional translation
    'Warning': 'Official Written Warning',
    'warning': 'Official Written Warning',
    'لفت نظر إداري': 'Official Written Warning',
    'Final Warning': 'Severe Final Warning',
    'final warning': 'Severe Final Warning',
    'إنذار نهائي شديد اللهجة': 'Severe Final Warning',
    'Day Deduction': 'Salary Deduction (Days)',
    'day deduction': 'Salary Deduction (Days)',
    'خصم من الراتب': 'Salary Deduction (Days)',
    'Amount Deduction': 'Direct Financial Penalty',
    'amount deduction': 'Direct Financial Penalty',

    // System Messages bidirectional translation
    'Saved Successfully': 'Saved Successfully',
    'Saved successfully': 'Saved Successfully',
    'Updated Successfully': 'Updated Successfully',
    'Updated successfully': 'Updated Successfully',
    'Deleted Successfully': 'Deleted Successfully',
    'Deleted successfully': 'Deleted Successfully',
    'Approved Successfully': 'Approved Successfully',
    'Approved successfully': 'Approved Successfully',
    'Locked Successfully': 'Locked Successfully',
    'Locked successfully': 'Locked Successfully',
    ...translatedDictionary
  }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'ar';
  });

  useEffect(() => {
    // If user has no explicit saved preference, use system default
    if (!localStorage.getItem('language')) {
      const fetchWithRetry = async (url: string, retries = 3, delay = 1000): Promise<any> => {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          return await res.json();
        } catch (err) {
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchWithRetry(url, retries - 1, delay * 1.5);
          }
          throw err;
        }
      };

      fetchWithRetry('/api/system-settings/public')
        .then(data => {
          if (data && data.defaultLanguage && (data.defaultLanguage === 'ar' || data.defaultLanguage === 'en')) {
            setLanguage(data.defaultLanguage);
          }
        })
        .catch(err => console.warn('Failed to pre-fetch default language settings on load after retries', err));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('language', language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
