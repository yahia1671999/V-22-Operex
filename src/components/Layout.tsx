import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  LayoutDashboard, 
  Receipt, 
  History, 
  LogOut, 
  ChevronRight, 
  Menu, 
  X,
  Settings,
  ShieldCheck,
  FileText,
  Fingerprint,
  Link,
  Briefcase,
  Network,
  CheckCircle2,
  ChevronDown,
  Wallet,
  Sun,
  Moon,
  Globe,
  Calendar,
  User,
  Wifi,
  Building2,
  Lock,
  Activity,
  Plane,
  Coins,
  Percent,
  FileCheck,
  KeyRound,
  Bell,
  CheckSquare,
  AlertTriangle,
  ShieldAlert,
  Scale
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';
import { isOpenTask, getTaskAssignedIds } from '../lib/taskUtils';
import { LockScreen } from './LockScreen';
import { checkPenaltyUserRole } from '../utils/penaltyWorkflow';

// Pages
import { Dashboard } from './pages/Dashboard';
import { OperationsDashboard } from './pages/OperationsDashboard';
import { HRDashboard } from './pages/HRDashboard';
import { EmployeesList } from './pages/EmployeesList';
import { PayrollRuns } from './pages/PayrollRuns';
import { Transactions } from './pages/Transactions';
import { DeductionMaster } from './pages/DeductionMaster';
import { DeductionTransactions } from './pages/DeductionTransactions';
import { AllowanceTypes } from './pages/AllowanceTypes';
import { UsersManagement } from './pages/UsersManagement';
import { Settlements } from './pages/Settlements';
import { Attendance } from './pages/Attendance';
import { Missions } from './pages/Missions';
import { OrgChart } from './pages/OrgChart';
import { Operations } from './pages/Operations';
import { AdminStructure } from './pages/AdminStructure';
import { MyTasks } from './pages/MyTasks';
import { EmployeeDashboard } from './pages/EmployeeDashboard';
import { TimeManagement } from './pages/TimeManagement';
import { WiFiSettings } from './pages/WiFiSettings';
import { Leaves } from './pages/Leaves';
import { OrganizationSettings } from './pages/OrganizationSettings';
import { SecuritySettings } from './pages/SecuritySettings';
import { MissionDisbursals } from './pages/MissionDisbursals';
import { FinancialAdvances } from './pages/FinancialAdvances';
import { MissionAllowanceRuns } from './pages/MissionAllowanceRuns';
import { Penalties } from './pages/Penalties';
import { PerformanceAppraisal } from './pages/PerformanceAppraisal';
import { MyTeam } from './pages/MyTeam';
import { AdminNotices } from './pages/AdminNotices';
import { useData } from '../contexts/DataContext';

export const Layout: React.FC = () => {
  const { user, profile, isAdmin, isHR, isFinance, isOperations, logout } = useAuth();
  const { 
    systemSettings, 
    employees, 
    projects, 
    projectTasks, 
    leaveRequests, 
    payrollRuns, 
    attendanceDevices, 
    adminDepartments,
    appUsers, 
    penalties, 
    transactions,
    administrativeNotices,
    investigations,
    refreshData 
  } = useData();
  const { theme, toggleTheme, applyBranding } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    if (systemSettings) {
      applyBranding(systemSettings);
    }
  }, [systemSettings, applyBranding]);
  const [activeModule, setActiveModule] = useState<'self_service' | 'operations' | 'hr' | 'payroll' | 'admin'>(isAdmin ? 'admin' : 'self_service');
  const [activeTab, setActiveTab] = useState(isAdmin ? 'system_dashboard' : 'employee_dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);
  const [isModuleInfoOpen, setIsModuleInfoOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(() => sessionStorage.getItem('system_locked') === 'true');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { canView, can, isSuperAdmin } = usePermissions();
  const isRtl = language === 'ar';

  const currentUserEmp = React.useMemo(() => {
    return employees.find(e => 
      (e.email && e.email.trim().toLowerCase() === (user?.email?.trim().toLowerCase() || '')) ||
      (e.id && String(e.id) === String(user?.uid)) ||
      (e.userId && String(e.userId) === String(user?.uid)) ||
      (e.id === (profile as any)?.employeeId)
    );
  }, [employees, user, profile]);

  const isNotSubjectToAttendance = React.useMemo(() => {
    if (!currentUserEmp) return false;
    const val = String(currentUserEmp.subjectToAttendance || (currentUserEmp as any).isSubjectToAttendance || '').trim().toLowerCase();
    return val === 'no' || val === 'false' || val === 'لا' || (currentUserEmp as any).isSubjectToAttendance === false;
  }, [currentUserEmp]);

  const headerNotificationItems = React.useMemo(() => {
    const list: any[] = [];
    const currentEmail = user?.email?.trim().toLowerCase() || '';
    const currentEmp = employees.find(e => 
      (e.email && e.email.trim().toLowerCase() === currentEmail) ||
      (e.id && String(e.id) === String(user?.uid)) ||
      (e.userId && String(e.userId) === String(user?.uid))
    );

    const mgrIdsSet = new Set<string>();
    const addMgrId = (val?: string | null) => {
      if (!val) return;
      const clean = String(val).trim().toLowerCase();
      if (!clean) return;
      mgrIdsSet.add(clean);
      const noSpace = clean.replace(/\s+/g, '');
      if (noSpace) mgrIdsSet.add(noSpace);
    };

    addMgrId(user?.uid);
    addMgrId(user?.email);
    addMgrId(user?.displayName);
    addMgrId((profile as any)?.id);
    addMgrId((profile as any)?.employeeId);
    addMgrId((profile as any)?.name);
    addMgrId((profile as any)?.displayName);
    addMgrId(currentEmp?.id);
    addMgrId(currentEmp?.employeeId);
    addMgrId(currentEmp?.userId);
    addMgrId(currentEmp?.email);
    addMgrId(currentEmp?.name);

    employees.forEach(e => {
      const eEmail = e.email ? String(e.email).trim().toLowerCase() : '';
      const eUserId = e.userId ? String(e.userId).trim().toLowerCase() : '';
      const eEmpId = e.employeeId ? String(e.employeeId).trim().toLowerCase() : '';
      const eId = e.id ? String(e.id).trim().toLowerCase() : '';
      if ((currentEmail && eEmail === currentEmail) || (user?.uid && (eUserId === user.uid || eId === user.uid))) {
        addMgrId(e.id);
        addMgrId(e.employeeId);
        addMgrId(e.userId);
        addMgrId(e.email);
        addMgrId(e.name);
      }
    });

    const currentManagerIds = Array.from(mgrIdsSet);

    const isSubordinate = (emp: any) => {
      if (!emp) return false;
      const mgrId = emp.managerId ? String(emp.managerId).trim().toLowerCase() : '';
      const supervisorId = (emp as any).supervisorId ? String((emp as any).supervisorId).trim().toLowerCase() : '';
      const directMgr = (emp as any).directManager ? String((emp as any).directManager).trim().toLowerCase() : '';
      const mgrIdNoSpace = mgrId.replace(/\s+/g, '');

      if (currentManagerIds.includes(mgrId) || 
          (mgrIdNoSpace && currentManagerIds.includes(mgrIdNoSpace)) ||
          currentManagerIds.includes(supervisorId) || 
          currentManagerIds.includes(directMgr)) {
        return true;
      }

      if (mgrId) {
        const mgrEmp = employees.find(e => 
          String(e.id).toLowerCase() === mgrId || 
          String(e.employeeId || '').toLowerCase() === mgrId ||
          String(e.userId || '').toLowerCase() === mgrId ||
          String(e.email || '').toLowerCase() === mgrId ||
          String(e.name || '').toLowerCase() === mgrId
        );
        if (mgrEmp) {
          const mgrEmpIds = [mgrEmp.id, mgrEmp.userId, mgrEmp.employeeId, mgrEmp.email, mgrEmp.name]
            .filter(Boolean).map(x => String(x).trim().toLowerCase());
          if (mgrEmpIds.some(id => currentManagerIds.includes(id))) return true;
        }
      }

      if (emp.department && adminDepartments && adminDepartments.length > 0) {
        const empDeptStr = String(emp.department).trim().toLowerCase();
        const dept = adminDepartments.find(d => 
          String(d.id).toLowerCase() === empDeptStr ||
          String(d.name || '').toLowerCase() === empDeptStr
        );
        if (dept && dept.managerId) {
          const deptMgrId = String(dept.managerId).trim().toLowerCase();
          if (currentManagerIds.includes(deptMgrId)) return true;
        }
      }

      return false;
    };

    const mySubordinateEmpIds = employees.filter(emp => isSubordinate(emp))
      .flatMap(emp => [emp.id, emp.userId, emp.employeeId, emp.email, emp.name].filter(Boolean).map(id => String(id).trim().toLowerCase()));

    const currentEmpIds = [
      currentEmp?.id,
      currentEmp?.userId,
      currentEmp?.employeeId,
      currentEmp?.email,
      user?.uid,
      user?.email
    ].filter(Boolean).map(id => String(id).trim().toLowerCase());

    // 1. Pending Leave Requests (for manager / HR / admin)
    (leaveRequests || []).filter(lr => lr.status === 'Pending').forEach(lr => {
      const lrEmpId = String(lr.employeeId || '').trim().toLowerCase();
      const lrUserId = String((lr as any).userId || '').trim().toLowerCase();
      const lrEmail = String((lr as any).email || (lr as any).userEmail || '').trim().toLowerCase();
      const lrMgrId = String((lr as any).managerId || (lr as any).approverId || '').trim().toLowerCase();

      const emp = employees.find(e => {
        const eIds = [e.id, e.userId, e.employeeId, e.email, e.name].filter(Boolean).map(x => String(x).trim().toLowerCase());
        return (lrEmpId && eIds.includes(lrEmpId)) || 
               (lrUserId && eIds.includes(lrUserId)) || 
               (lrEmail && eIds.includes(lrEmail));
      });

      const empAllIds = emp 
        ? [emp.id, emp.userId, emp.employeeId, emp.email, emp.name].filter(Boolean).map(x => String(x).trim().toLowerCase())
        : [lrEmpId, lrUserId, lrEmail].filter(Boolean);

      const isSelf = empAllIds.some(id => currentEmpIds.includes(id));

      const isSub = empAllIds.some(id => mySubordinateEmpIds.includes(id)) ||
        isSubordinate(emp) ||
        (lrMgrId && currentManagerIds.includes(lrMgrId));

      const shouldNotify = isAdmin || isHR || (isSub && !isSelf);

      if (shouldNotify) {
        list.push({
          id: `leave-${lr.id}`,
          type: 'leave',
          title: isRtl ? `طلب إجازة جديد (${lr.type === 'WorkFromHome' ? 'عمل عن بعد' : lr.type || 'اعتيادية'})` : `New Leave Request (${lr.type || 'Standard'})`,
          subtitle: emp ? (isRtl ? `من الموظف: ${emp.name}` : `From: ${emp.name}`) : (isRtl ? `طلب في انتظار الاعتماد` : `Pending approval`),
          date: lr.startDate || new Date().toISOString().split('T')[0],
          action: () => {
            if (isAdmin || isHR) {
              setActiveModule('hr');
              setActiveTab('leaves');
            } else {
              setActiveModule('self_service');
              setActiveTab('employee_dashboard');
            }
            setIsNotificationsOpen(false);
          }
        });
      }
    });

    // 2. Assigned Tasks for current user
    (projectTasks || []).filter(t => {
      const assignedTo = String(t.assignedToId || '').trim().toLowerCase();
      const assignedToIds = getTaskAssignedIds(t).map(x => x.toLowerCase());
      const isAssigned = currentEmpIds.includes(assignedTo) || assignedToIds.some(id => currentEmpIds.includes(id));
      return isAssigned && isOpenTask(t);
    }).forEach(t => {
      list.push({
        id: `task-${t.id}`,
        type: 'task',
        title: isRtl ? `مهمة مسندة جديدة: ${t.title}` : `Assigned Task: ${t.title}`,
        subtitle: isRtl ? `الأولوية: ${t.priority || 'Medium'} | الموعد: ${t.endDate || t.startDate || 'قريباً'}` : `Priority: ${t.priority || 'Medium'} | Due: ${t.endDate || t.startDate || 'Soon'}`,
        date: t.endDate || t.startDate,
        action: () => {
          setActiveModule('self_service');
          setActiveTab('my_tasks');
          setIsNotificationsOpen(false);
        }
      });
    });

    // 3. Official Disciplinary Penalties & Decisions for Current Employee
    (penalties || []).filter(p => {
      const pEmpId = String(p.employeeId || '').trim().toLowerCase();
      const isSelf = currentEmpIds.includes(pEmpId);
      return isSelf && p.status !== 'Draft' && p.status !== 'Cancelled';
    }).forEach(p => {
      list.push({
        id: `pen-${p.id}`,
        type: 'penalty',
        title: isRtl ? `قرار جزاء إداري رقم ${p.penaltyNumber || p.id}` : `Disciplinary Penalty No. ${p.penaltyNumber || p.id}`,
        subtitle: isRtl ? `${p.violationType || 'مخالفة إدارية'} | الحالة: ${p.status === 'Approved' ? 'معتمد رسمياً' : p.status}` : `${p.violationType || 'Violation'} | Status: ${p.status}`,
        date: p.penaltyDate || p.violationDate || new Date().toISOString().split('T')[0],
        action: () => {
          setActiveModule('self_service');
          setActiveTab('employee_dashboard');
          setIsNotificationsOpen(false);
        }
      });
    });

    // 4. Administrative Investigation Calls for Current Employee
    (investigations || []).filter(inv => {
      if (inv.status === 'Completed' || inv.status === 'Cancelled') return false;
      const targetIds: string[] = [];
      if (inv.employeeIds && Array.isArray(inv.employeeIds)) {
        targetIds.push(...inv.employeeIds.map((id: any) => String(id).trim().toLowerCase()));
      }
      if (inv.employeeId) targetIds.push(String(inv.employeeId).trim().toLowerCase());
      return targetIds.some(tid => currentEmpIds.includes(tid));
    }).forEach(inv => {
      const invDate = inv.investigationDate || new Date().toISOString().split('T')[0];
      list.push({
        id: `inv-${inv.id}`,
        type: 'investigation',
        title: isRtl ? `دعوة لحضور تحقيق إداري: ${inv.title}` : `Administrative Investigation: ${inv.title}`,
        subtitle: isRtl ? `جلسة بتاريخ: ${invDate} | المحقق: ${inv.investigatorName || 'الشؤون القانونية'}` : `Date: ${invDate} | By: ${inv.investigatorName || 'Legal Dept'}`,
        date: invDate,
        action: () => {
          setActiveModule('self_service');
          setActiveTab('admin_notices');
          setIsNotificationsOpen(false);
        }
      });
    });

    // 5. Penalty Approvals pending for Manager / HR / Admin
    (penalties || []).forEach(p => {
      if (['Approved', 'Cancelled', 'Rejected', 'Draft'].includes(p.status)) return;
      const roleInfo = checkPenaltyUserRole(p, employees, user, (user as any)?.profile || null, isAdmin, isHR);

      // 1. Direct Manager stage
      if (roleInfo.isPendingDirectManager && (roleInfo.isDirectManager || isAdmin || isHR)) {
        const emp = roleInfo.targetEmp;
        list.push({
          id: `pen-dm-approval-${p.id}`,
          type: 'penalty_approval',
          title: isRtl ? `مطلوب رأي/موافقة المدير المباشر على الجزاء` : `Direct Manager Penalty Review Required`,
          subtitle: isRtl ? `للموظف: ${emp?.name || p.employeeName || 'المعني'} (${p.violationType || ''})` : `For: ${emp?.name || p.employeeName || 'Employee'} (${p.violationType || ''})`,
          date: p.penaltyDate || p.violationDate || new Date().toISOString().split('T')[0],
          action: () => {
            if (isAdmin || isHR) {
              setActiveModule('hr');
              setActiveTab('penalties');
            } else {
              setActiveModule('self_service');
              setActiveTab('my_team');
            }
            setIsNotificationsOpen(false);
          }
        });
      }
      // 2. Higher Manager stage (STRICT: Only Higher Manager or Admin/HR - Direct Manager is NOT notified here)
      else if (roleInfo.isPendingHigherManager && (roleInfo.isHigherManager || isAdmin || isHR)) {
        const emp = roleInfo.targetEmp;
        list.push({
          id: `pen-hm-approval-${p.id}`,
          type: 'penalty_approval',
          title: isRtl ? `مطلوب رأي/موافقة الرئيس الأعلى على الجزاء` : `Higher Manager Penalty Review Required`,
          subtitle: isRtl ? `للموظف: ${emp?.name || p.employeeName || 'المعني'} (${p.violationType || ''})` : `For: ${emp?.name || p.employeeName || 'Employee'} (${p.violationType || ''})`,
          date: p.penaltyDate || p.violationDate || new Date().toISOString().split('T')[0],
          action: () => {
            if (isAdmin || isHR) {
              setActiveModule('hr');
              setActiveTab('penalties');
            } else {
              setActiveModule('self_service');
              setActiveTab('my_team');
            }
            setIsNotificationsOpen(false);
          }
        });
      }
      // 3. HR stage (Only HR / Admin)
      else if (roleInfo.isPendingHR && (isAdmin || isHR)) {
        const emp = roleInfo.targetEmp;
        list.push({
          id: `pen-hr-approval-${p.id}`,
          type: 'penalty_approval',
          title: isRtl ? `مطلوب الاعتماد النهائي لقرار الجزاء (HR)` : `Final HR Penalty Approval Required`,
          subtitle: isRtl ? `للموظف: ${emp?.name || p.employeeName || 'المعني'} (${p.violationType || ''})` : `For: ${emp?.name || p.employeeName || 'Employee'} (${p.violationType || ''})`,
          date: p.penaltyDate || p.violationDate || new Date().toISOString().split('T')[0],
          action: () => {
            setActiveModule('hr');
            setActiveTab('penalties');
            setIsNotificationsOpen(false);
          }
        });
      }
    });

    // 6. Pending Disciplinary Grievance Submissions (Alert HR / Admin / Super Admin)
    const isHRAuthorized = isAdmin || isHR || isSuperAdmin || can('hr.penalties.approve') || can('hr.penalties.edit') || can('hr.penalties.review_grievance') || can('hr.penalties.view') || can('hr.penalties');
    if (isHRAuthorized) {
      (penalties || []).forEach(p => {
        const isPendingGrievance = (p.hasGrievance === true || (p as any).hasGrievance === 1) && 
          (p.grievanceStatus === 'Pending' || (!p.grievanceStatus && p.grievanceReason));
        
        if (!isPendingGrievance) return;

        const emp = employees.find(e => e.id === p.employeeId || e.employeeId === p.employeeId);
        list.push({
          id: `grievance-review-${p.id}`,
          type: 'grievance',
          title: isRtl ? `تظلم إداري وارد على الجزاء رقم ${p.penaltyNumber || p.id}` : `Disciplinary Grievance on Penalty #${p.penaltyNumber || p.id}`,
          subtitle: isRtl 
            ? `الموظف: ${emp?.name || p.employeeName || 'المعني'} | السبب: ${p.grievanceReason || 'تظلم إداري'}` 
            : `Employee: ${emp?.name || p.employeeName || 'Employee'} | Reason: ${p.grievanceReason || 'Grievance'}`,
          date: p.grievanceDate || p.updatedAt || new Date().toISOString().split('T')[0],
          action: () => {
            setActiveModule('hr');
            setActiveTab('penalties');
            setIsNotificationsOpen(false);
            window.dispatchEvent(new CustomEvent('open_grievance_review', { detail: { penaltyId: p.id } }));
          }
        });
      });
    }

    return list;
  }, [leaveRequests, projectTasks, penalties, investigations, employees, user, isAdmin, isHR, isSuperAdmin, isRtl]);

  // Custom states for Personal Password Change Modal
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!newPassword) {
      setPasswordError(isRtl ? 'يرجى إدخال كلمة المرور الجديدة' : 'Please enter new password');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(isRtl ? 'يجب أن تكون كلمة المرور 8 خانات على الأقل وبها حرف كبير وصغير ورقم ورمز' : 'Password must be at least 8 characters with upper, lower, number, and symbol');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    setIsSubmittingPassword(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user?.uid,
          newPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || (isRtl ? 'فشل تحديث كلمة المرور' : 'Failed to update password'));
      }

      setPasswordSuccess(isRtl ? 'تم تحديث كلمة المرور بنجاح' : 'Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setPasswordSuccess(null);
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message);
    } finally {
      setIsSubmittingPassword(false);
    }
  };
  
  // Idle timeout handle
  useEffect(() => {
    if (!profile || isLocked) return;
    
    // Check if sys settings has lock enabled
    const isLockEnabled = systemSettings?.isLockEnabled;
    const timeoutMinutes = systemSettings?.idleTimeoutMinutes || 5;
    
    if (!isLockEnabled) return;

    let timeoutId: any;
    
    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleLock();
      }, timeoutMinutes * 60 * 1000);
    };

    // Events to track activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(name => document.addEventListener(name, resetTimer));

    resetTimer(); // Initialize

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(name => document.removeEventListener(name, resetTimer));
    };
  }, [profile, isLocked, systemSettings]);

  const getModuleStyle = (modId: string): any => {
    switch (modId) {
      case 'self_service':
        return {
          iconColor: 'text-orange-500 dark:text-orange-400',
          borderColor: 'border-orange-200 dark:border-orange-900/50',
          bgColor: 'bg-orange-500/10 dark:bg-orange-950/20',
          animation: {
            animate: { scale: [1, 1.05, 1] },
            transition: { repeat: Infinity, duration: 4, ease: "easeInOut" },
            whileHover: { scale: 1.15, rotate: 12, transition: { type: "spring", stiffness: 300 } },
            whileTap: { scale: 0.95 }
          }
        };
      case 'operations':
        return {
          iconColor: 'text-indigo-500 dark:text-indigo-400',
          borderColor: 'border-indigo-200 dark:border-indigo-900/40',
          bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/20',
          animation: {
            whileHover: { scale: 1.18, rotate: 360, transition: { duration: 0.6, ease: "easeInOut" } },
            whileTap: { scale: 0.95 }
          }
        };
      case 'hr':
        return {
          iconColor: 'text-emerald-500 dark:text-emerald-400',
          borderColor: 'border-emerald-200 dark:border-emerald-900/40',
          bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/20',
          animation: {
            animate: { y: [0, -3, 0] },
            transition: { repeat: Infinity, duration: 3, ease: "easeInOut" },
            whileHover: { scale: 1.2, y: -6, transition: { type: "spring", stiffness: 450 } },
            whileTap: { scale: 0.95 }
          }
        };
      case 'payroll':
        return {
          iconColor: 'text-blue-500 dark:text-blue-400',
          borderColor: 'border-blue-200 dark:border-blue-900/40',
          bgColor: 'bg-blue-500/10 dark:bg-blue-950/20',
          animation: {
            whileHover: { scale: 1.22, rotate: -15, y: -2, transition: { type: "spring", stiffness: 300 } },
            whileTap: { scale: 0.95 }
          }
        };
      case 'admin':
        return {
          iconColor: 'text-rose-500 dark:text-rose-400',
          borderColor: 'border-rose-200 dark:border-rose-950/40',
          bgColor: 'bg-rose-500/10 dark:bg-rose-950/20',
          animation: {
            animate: { rotate: [0, 8, -8, 0] },
            transition: { repeat: Infinity, duration: 6, ease: "linear" },
            whileHover: { scale: 1.15, rotate: 180, transition: { duration: 0.5 } },
            whileTap: { scale: 0.95 }
          }
        };
      default:
        return {
          iconColor: 'text-primary',
          borderColor: 'border-primary/20',
          bgColor: 'bg-primary/10',
          animation: {
            whileHover: { scale: 1.1 },
            whileTap: { scale: 0.95 }
          }
        };
    }
  };

  const modules = [
    { id: 'self_service', label: t('nav.selfService') || 'الخدمات الذكية', icon: User, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', show: true },
    { id: 'operations', label: t('nav.operationsModule'), icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20', show: canView('dashboard_ops') || canView('my-tasks') || canView('operations') },
    { id: 'hr', label: t('nav.hr'), icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', show: canView('dashboard_hr') || canView('employees') || canView('attendance') || canView('missions') || canView('adminStructure') },
    { id: 'payroll', label: t('nav.payrollModule'), icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', show: canView('dashboard_payroll') || canView('payroll') || canView('transactions') || canView('allowanceTypes') || canView('settlements') || canView('missions') },
  ];

  if (isSuperAdmin || canView('users')) {
    modules.push({ id: 'admin', label: t('nav.systemAdmin'), icon: Settings, color: 'text-gray-600', bg: 'bg-gray-50 dark:bg-gray-800/40', show: true });
  }

  // Filter out completely hidden modules
  const visibleModules = modules.filter(m => m.show);

  useEffect(() => {
    // If user is Admin and we are on self_service, but they just logged in, we might want to default to admin dashboard
    if (isAdmin && activeModule === 'self_service' && activeTab === 'employee_dashboard') {
       // Only do this once on mount if it's the very first render and no other tab was set
       // But usually the initial state handles it.
    }
  }, [isAdmin]);

  useEffect(() => {
    const handleNavigate = (e: any) => {
      const { module, tab, entityId, type } = e.detail;
      setActiveModule(module);
      setActiveTab(tab);
      // We also need to tell the Operations/MyTasks component to select the specific project/task.
      // Easiest is to store it globally or use sessionStorage to pick it up on mount/render.
      if (entityId) {
        sessionStorage.setItem('target_entity_id', entityId);
        sessionStorage.setItem('target_entity_type', type);
      }
    };
    window.addEventListener('navigate_to_entity', handleNavigate);
    return () => window.removeEventListener('navigate_to_entity', handleNavigate);
  }, []);

  // Auto fallback to first available module if active is not visible
  useEffect(() => {
     if (visibleModules.length > 0 && !visibleModules.find(m => m.id === activeModule)) {
         setActiveModule(visibleModules[0].id as any);
     }
  }, [visibleModules, activeModule]);

  // Check if My Team tab should be visible (Executives/Admins, users with Executive Team Dashboard Access permission, or Managers with direct subordinates)
  const showMyTeam = React.useMemo(() => {
    if (isAdmin || canView('my_team') || can('self_service.executive_team_dashboard_access')) return true;
    const userRoleStr = (profile as any)?.role || (user as any)?.role || '';
    const roleLower = String(userRoleStr).toLowerCase();
    const execRoles = [
      'super admin', 'admin', 'executive director', 'general manager', 'ceo',
      'تنفيذي', 'مدير تنفيذي', 'مدير عام', 'أدمن', 'مدير إداري', 'رئيس مجلس الإدارة', 'مساعد مدير عام'
    ];
    const isExecutive = execRoles.some(r => roleLower.includes(r)) || Boolean((profile as any)?.isExecutive || (user as any)?.isExecutive);
    if (isExecutive) return true;

    // Check if user is direct manager of at least one employee
    const currentEmail = user?.email?.trim().toLowerCase() || '';
    const currentEmp = employees.find(e => 
      (e.email && e.email.trim().toLowerCase() === currentEmail) ||
      (e.id && String(e.id) === String(user?.uid)) ||
      (e.userId && String(e.userId) === String(user?.uid))
    );

    const mgrIdsSet = new Set<string>();
    const addMgrId = (val?: string | null) => {
      if (!val) return;
      const clean = String(val).trim().toLowerCase();
      if (!clean) return;
      mgrIdsSet.add(clean);
      const noSpace = clean.replace(/\s+/g, '');
      if (noSpace) mgrIdsSet.add(noSpace);
    };

    addMgrId(user?.uid);
    addMgrId(user?.email);
    addMgrId(user?.displayName);
    addMgrId((profile as any)?.id);
    addMgrId((profile as any)?.employeeId);
    addMgrId((profile as any)?.name);
    addMgrId((profile as any)?.displayName);
    addMgrId(currentEmp?.id);
    addMgrId(currentEmp?.employeeId);
    addMgrId(currentEmp?.userId);
    addMgrId(currentEmp?.email);
    addMgrId(currentEmp?.name);

    return employees.some(e => {
      const m1 = e.managerId ? String(e.managerId).trim().toLowerCase() : '';
      const m2 = (e as any).directManagerId ? String((e as any).directManagerId).trim().toLowerCase() : '';
      const m3 = (e as any).directManager ? String((e as any).directManager).trim().toLowerCase() : '';
      return (m1 && mgrIdsSet.has(m1)) || (m2 && mgrIdsSet.has(m2)) || (m3 && mgrIdsSet.has(m3));
    });
  }, [isAdmin, profile, user, employees, can, canView]);

  // Define tabs per module
  const moduleTabs = {
    self_service: [
      { id: 'employee_dashboard', label: t('nav.dashboard') || (isRtl ? 'لوحة التحكم' : 'Dashboard'), icon: LayoutDashboard, show: canView('employee_dashboard') },
      { id: 'admin_notices', label: isRtl ? 'التنبيهات الإدارية' : 'Administrative Notices', icon: Bell, show: true },
      { id: 'my_team', label: isRtl ? 'فريقي' : 'My Team', icon: Users, show: showMyTeam },
      { id: 'time_management', label: isRtl ? 'إدارة الوقت والالتزامات' : 'Time & Commitments Management', icon: Calendar, show: true },
      { id: 'my_performance', label: isRtl ? 'تقييم الأداء والنمو' : 'Appraisals & Development', icon: FileCheck, show: false },
      { id: 'system_security', label: isRtl ? 'حماية النظام واليوزر' : 'System & User Security', icon: ShieldCheck, show: true },
      { id: 'system_kpis', label: isRtl ? 'مؤشرات أداء النظام' : 'System Performance Indicators', icon: Activity, show: canView('system_kpis') },
    ],
    operations: [
      { id: 'dashboard_ops', label: t('nav.dashboard'), icon: LayoutDashboard, show: canView('dashboard_ops') },
      { id: 'my-tasks', label: t('nav.myTasks'), icon: CheckCircle2, show: canView('my-tasks') },
      { id: 'operations', label: t('nav.operations'), icon: Network, show: canView('operations') },
    ],
    hr: [
      { id: 'dashboard_hr', label: t('nav.dashboard'), icon: LayoutDashboard, show: canView('dashboard_hr') },
      { id: 'admin-structure', label: t('nav.adminStructure'), icon: Network, show: canView('adminStructure') },
      { id: 'employees', label: t('nav.employees'), icon: Users, show: canView('employees') },
      { id: 'admin_notices_hr', label: isRtl ? 'التنبيهات والقرارات الإدارية' : 'Notices & Decisions', icon: Bell, show: true },
      { id: 'org-chart', label: t('nav.orgChart'), icon: Link, show: canView('orgChart') },
      { id: 'attendance', label: t('nav.attendance'), icon: Fingerprint, show: canView('attendance') && (!isNotSubjectToAttendance || isHR || isAdmin) },
      { id: 'missions', label: t('nav.missions'), icon: FileText, show: canView('missions') },
      { id: 'leaves', label: isRtl ? 'طلبات الإجازات' : 'Leave Requests', icon: FileText, show: canView('leaveRequests') },
      { id: 'penalties', label: isRtl ? 'الجزاءات والمخالفات' : 'Penalties & Violations', icon: ShieldCheck, show: canView('employees') },
      { id: 'performance_appraisal', label: isRtl ? 'إدارة تقييم الأداء' : 'Performance Appraisal Control', icon: FileCheck, show: canView('employees') },
    ],
    payroll: [
      { id: 'dashboard_payroll', label: t('nav.dashboard'), icon: LayoutDashboard, show: canView('dashboard_payroll') },
      { id: 'allowance-types', label: t('nav.allowanceTypes'), icon: Settings, show: canView('allowanceTypes') },
      { id: 'deduction-master', label: isRtl ? 'إعدادات الاستقطاعات (Deduction Master)' : 'Deduction Master settings', icon: Percent, show: canView('payroll') },
      { id: 'deduction-transactions', label: isRtl ? 'تقرير إجماليات الاستقطاعات' : 'Deductions Totals Report', icon: FileCheck, show: canView('payroll') },
      { id: 'transactions', label: t('nav.transactions'), icon: History, show: canView('transactions') },
      { id: 'mission-disbursals', label: isRtl ? 'صرف بدلات المأموريات' : 'Mission Allowances Disbursal', icon: Plane, show: canView('transactions') || canView('missions') },
      { id: 'financial-advances', label: isRtl ? 'العهود المالية للمأموريات' : 'Mission Financial Advances', icon: Coins, show: canView('transactions') || canView('missions') },
      { id: 'mission-allowance-runs', label: isRtl ? 'مسيرات بدلات المأموريات' : 'Mission Allowances Payroll', icon: Plane, show: canView('payroll') || canView('missions') },
      { id: 'payroll', label: t('nav.payroll'), icon: Receipt, show: canView('payroll') },
      { id: 'settlements', label: t('nav.settlements'), icon: ShieldCheck, show: canView('settlements') },
    ],
    admin: [
      { id: 'system_dashboard', label: isRtl ? 'مؤشرات أداء النظام' : 'System Performance Indicators', icon: LayoutDashboard, show: isAdmin },
      { id: 'admin_notices_mgmt', label: isRtl ? 'إدارة التنبيهات الإدارية' : 'Admin Notices Control', icon: Bell, show: true },
      { id: 'organization_settings', label: isRtl ? 'إعدادات المنشأة' : 'Organization Settings', icon: Building2, show: isAdmin },
      { id: 'users', label: t('nav.users'), icon: ShieldCheck, show: canView('users') },
      { id: 'wifi_settings', label: isRtl ? 'إعدادات WiFi الحضور' : 'Attendance WiFi Settings', icon: Wifi, show: canView('users') },
    ]
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const renderPage = () => {
    switch (activeTab) {
      // Self Service
      case 'employee_dashboard': return <EmployeeDashboard />;
      case 'admin_notices':
      case 'admin_notices_hr':
      case 'admin_notices_mgmt':
        return <AdminNotices />;
      case 'my_team': return <MyTeam onNavigateToTab={(t) => setActiveTab(t)} />;
      case 'time_management': return <TimeManagement />;
      case 'my_performance': return <PerformanceAppraisal isManagerPortal={false} />;
      case 'system_security': return <SecuritySettings />;
      case 'system_kpis': return <Dashboard isSystemWide />;
      // Operations
      case 'dashboard_ops': return <OperationsDashboard />;
      case 'my-tasks': return <MyTasks />;
      case 'operations': return <Operations />;
      // HR
      case 'dashboard_hr': return <HRDashboard />;
      case 'admin-structure': return <AdminStructure />;
      case 'employees': return <EmployeesList />;
      case 'org-chart': return <OrgChart />;
      case 'attendance':
        if (isNotSubjectToAttendance && !isHR && !isAdmin) {
          return (
            <div className="p-8 bg-card border-2 border-destructive/40 rounded-xl flex items-center gap-6 my-12 shadow-xl max-w-2xl mx-auto">
              <ShieldAlert className="w-12 h-12 text-destructive shrink-0" />
              <div>
                <h3 className="font-black text-lg text-foreground mb-1">
                  أنت غير خاضع لنظام الحضور والانصراف
                </h3>
                <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                  عذراً، حسابك الوظيفي مسجل حالياً كـ "غير خاضع لنظام الحضور والانصراف" طبقاً لقرارات الموارد البشرية. لا يمكنك الوصول لصفحة الحضور أو تسجيل بصمة الحضور والانصراف.
                </p>
              </div>
            </div>
          );
        }
        return <Attendance />;
      case 'missions': return <Missions />;
      case 'leaves': return <Leaves />;
      case 'penalties': return <Penalties />;
      case 'performance_appraisal': return <PerformanceAppraisal isManagerPortal={true} />;
      // Payroll
      case 'dashboard_payroll': return <Dashboard />; // The current dashboard acts as Payroll dashboard
      case 'allowance-types': return <AllowanceTypes />;
      case 'deduction-master': return <DeductionMaster />;
      case 'deduction-transactions': return <DeductionTransactions />;
      case 'transactions': return <Transactions />;
      case 'mission-disbursals': return <MissionDisbursals />;
      case 'financial-advances': return <FinancialAdvances />;
      case 'mission-allowance-runs': return <MissionAllowanceRuns />;
      case 'payroll': return <PayrollRuns />;
      case 'settlements': return <Settlements />;
      // Admin
      case 'system_dashboard': return <Dashboard isSystemWide />;
      case 'users': return <UsersManagement />;
      case 'wifi_settings': return <WiFiSettings />;
      case 'organization_settings': return <OrganizationSettings />;
      default: return <EmployeeDashboard />;
    }
  };

  const renderModuleBentoInfo = () => {
    const isRtl = language === 'ar';

    switch (activeModule) {
      case 'self_service': {
        const userId = profile?.id || user?.uid || '';
        const myTasksCount = (projectTasks || []).filter(t => 
          (t.assignedToId === userId || getTaskAssignedIds(t).includes(userId)) &&
          isOpenTask(t)
        ).length;
        const myLeavesCount = leaveRequests.filter(r => r.employeeId === userId).length;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 bg-orange-500/15 rounded-lg">
                <User className="w-5 h-5 text-orange-500" />
              </div>
              <div className="text-right">
                <h4 className="font-black text-sm text-foreground">
                  {isRtl ? 'بوابة الخدمات الذاتية الذكية' : 'Smart Self Service Hub'}
                </h4>
                <p className="text-[10px] text-muted-foreground font-bold">
                  {isRtl ? 'ملف الموظف والطلبات الشخصية' : 'Personal employee cabinet'}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-right">
                <span className="text-[10px] font-bold text-muted-foreground block mb-1">
                  {isRtl ? 'مهامي المعلقة' : 'My Pending Tasks'}
                </span>
                <span className="text-xl font-black text-foreground">{myTasksCount}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-right">
                <span className="text-[10px] font-bold text-muted-foreground block mb-1">
                  {isRtl ? 'إجمالي طلبات الإجازة' : 'My Leave Requests'}
                </span>
                <span className="text-xl font-black text-foreground">{myLeavesCount}</span>
              </div>
            </div>

            <div className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl text-right">
              <p className="text-xs font-bold text-orange-600 dark:text-orange-400">
                {isRtl ? '💡 نصيحة سريعة:' : '💡 Quick Tip:'}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold leading-relaxed mt-1">
                {isRtl 
                  ? 'يمكنك مراجعة رصيد إجازاتك وتغيير كلمة المرور الشخصية لضمان أمان حسابك في أي وقت.'
                  : 'You can review your leave balances and update your personal password to ensure access security at any time.'}
              </p>
            </div>
          </div>
        );
      }
      case 'operations': {
        const activeProjectsCount = projects.filter(p => !p.parentProjectId).length;
        const subProjectsCount = projects.filter(p => p.parentProjectId).length;
        const pendingTasks = projectTasks.filter(t => isOpenTask(t)).length;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 bg-indigo-500/15 rounded-lg">
                <Briefcase className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="text-right">
                <h4 className="font-black text-sm text-foreground">
                  {isRtl ? 'تتبع العمليات والمشاريع' : 'Operations & Projects Hub'}
                </h4>
                <p className="text-[10px] text-muted-foreground font-bold">
                  {isRtl ? 'الحالة العامة للمشروعات والمهام' : 'Overview of active projects and phases'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-right">
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block mb-1">
                  {isRtl ? 'المشاريع الرئيسية' : 'Main Projects'}
                </span>
                <span className="text-xl font-black text-foreground">{activeProjectsCount}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-right">
                <span className="text-[10px] font-bold text-muted-foreground block mb-1">
                  {isRtl ? 'المهام قيد التنفيذ' : 'Active Tasks'}
                </span>
                <span className="text-xl font-black text-foreground">{pendingTasks}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-right col-span-2 text-right">
                <span className="text-[10px] font-bold text-muted-foreground block mb-1">
                  {isRtl ? 'المشاريع الفرعية المتفرعة' : 'Sub-Projects / Phases Count'}
                </span>
                <span className="text-xs font-black text-foreground">{subProjectsCount} {isRtl ? 'مشاريع مضافة' : 'registered'}</span>
              </div>
            </div>
          </div>
        );
      }
      case 'hr': {
        const activeEmployeesCount = employees.filter(e => e.status === 'Active').length;
        const pendingLeaves = leaveRequests.filter(r => r.status === 'Pending').length;
        const totalPenalties = penalties.length;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 bg-emerald-500/15 rounded-lg">
                <Users className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="text-right">
                <h4 className="font-black text-sm text-foreground">
                  {isRtl ? 'لوحة الموارد البشرية والمنشأة' : 'HR & Organization Hub'}
                </h4>
                <p className="text-[10px] text-muted-foreground font-bold">
                  {isRtl ? 'مؤشرات الكادر الوظيفي والرقابة' : 'Welfare and control statistics'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-right">
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                  {isRtl ? 'الموظفين النشطين' : 'Active Workforce'}
                </span>
                <span className="text-xl font-black text-foreground">{activeEmployeesCount}</span>
              </div>
              <div className="p-3 bg-orange-500/5 rounded-xl border border-orange-500/10 text-right">
                <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 block mb-1">
                  {isRtl ? 'طلبات الإجازة المعلقة' : 'Pending Leaves'}
                </span>
                <span className="text-xl font-black text-foreground text-orange-600">{pendingLeaves}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-right col-span-2 flex justify-between items-center">
                <span className="text-[10px] font-bold text-muted-foreground">
                  {isRtl ? 'إجمالي مخالفات وجزاءات المنشأة' : 'Total Registered Penalties'}
                </span>
                <span className="text-xs font-black text-foreground">{totalPenalties} {isRtl ? 'سجلات جزاء' : 'records'}</span>
              </div>
            </div>
          </div>
        );
      }
      case 'payroll': {
        const publishedRuns = payrollRuns.length;
        const bankTransfersCount = employees.filter(e => e.bankAccount).length;
        const advancesTotal = transactions.filter(t => t.loans > 0).length;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 bg-blue-500/15 rounded-lg">
                <Wallet className="w-5 h-5 text-blue-500" />
              </div>
              <div className="text-right">
                <h4 className="font-black text-sm text-foreground">
                  {isRtl ? 'نظام الرواتب والأمور المالية' : 'Financials & Payroll Hub'}
                </h4>
                <p className="text-[10px] text-muted-foreground font-bold">
                  {isRtl ? 'معلومات الذمم والمسيرات والعهود المعتمدة' : 'Access payroll and transaction telemetry'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 text-right">
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 block mb-1">
                  {isRtl ? 'المسيرات المصدرة' : 'Payroll Runs'}
                </span>
                <span className="text-xl font-black text-foreground">{publishedRuns}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-right">
                <span className="text-[10px] font-bold text-muted-foreground block mb-1">
                  {isRtl ? 'مسجلي السداد البنكي والآيبان' : 'Bank IBANs Added'}
                </span>
                <span className="text-xl font-black text-foreground">{bankTransfersCount}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-right col-span-2">
                <span className="text-[10px] font-bold text-muted-foreground block mb-1 text-right">
                  {isRtl ? 'إجمالي حركات السلف الحالية' : 'Total current salary advance records'}
                </span>
                <span className="text-xs font-black text-foreground block text-right">{advancesTotal} {isRtl ? 'سجل سلفة نشط' : 'active advance records'}</span>
              </div>
            </div>
          </div>
        );
      }
      case 'admin': {
        const systemUsersCount = appUsers.length;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 bg-rose-500/15 rounded-lg">
                <Settings className="w-5 h-5 text-rose-500" />
              </div>
              <div className="text-right">
                <h4 className="font-black text-sm text-foreground">
                  {isRtl ? 'بوابة الإشراف والتحكم العام' : 'System Administration'}
                </h4>
                <p className="text-[10px] text-muted-foreground font-bold">
                  {isRtl ? 'إحصاءات شبكات الحضور والمستخدمين' : 'Internal settings and access telemetry'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 text-right">
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 block mb-1">
                  {isRtl ? 'المستخدمين بالنظام' : 'Platform Users'}
                </span>
                <span className="text-xl font-black text-foreground">{systemUsersCount}</span>
              </div>
              <div className="p-3 bg-muted/40 rounded-xl border border-border/50 text-right">
                <span className="text-[10px] font-bold text-muted-foreground block mb-1">
                  {isRtl ? 'أجهزة البصمة المربطة' : 'Connected Devices'}
                </span>
                <span className="text-xs font-black text-foreground mt-2 block">{attendanceDevices.length} {isRtl ? 'أجهزة' : 'devices'}</span>
              </div>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  // Theme Mode Toggle Component
  const ThemeToggle = () => (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative w-14 h-7 flex items-center rounded-full p-1 transition-colors duration-300 outline-none shadow-inner",
        theme === 'dark' ? "bg-slate-800" : "bg-slate-200"
      )}
    >
      <motion.div
        animate={{ x: theme === 'dark' ? (isRtl ? -28 : 28) : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow-md flex items-center justify-center overflow-hidden"
      >
        <AnimatePresence mode="wait">
          {theme === 'light' ? (
            <motion.div
              key="sun"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Sun className="w-3.5 h-3.5 text-orange-500 fill-orange-500" />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Moon className="w-3.5 h-3.5 text-blue-400 fill-blue-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <div className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none">
        <Sun className={cn("w-3 h-3 transition-opacity", theme === 'dark' ? "opacity-30" : "opacity-0")} />
        <Moon className={cn("w-3 h-3 transition-opacity", theme === 'light' ? "opacity-30" : "opacity-0")} />
      </div>
    </button>
  );

  const handleUnlock = () => {
    setIsLocked(false);
    sessionStorage.setItem('system_locked', 'false');
  };

  const handleLock = () => {
    setIsLocked(true);
    sessionStorage.setItem('system_locked', 'true');
  };

  const renderSidebarContent = (isMobileView = false) => {
    const showLabels = isMobileView || isSidebarOpen;
    return (
      <div className="flex flex-col h-full bg-card overflow-y-auto min-h-0 custom-scrollbar">
        {/* Logo / Drawer Close */}
        <div className="h-24 flex items-center justify-between px-6 border-b-2 border-border mb-6">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 flex items-center justify-center shrink-0 overflow-hidden transition-all duration-500",
              systemSettings?.logoUrl 
                ? "bg-transparent p-1" 
                : "bg-gradient-to-br from-primary to-secondary shadow-xl shadow-primary/20 border-2 border-primary-foreground/20"
            )}>
              {systemSettings?.logoUrl ? (
                <img src={systemSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <ShieldCheck className="w-7 h-7 text-primary-foreground" />
              )}
            </div>
            {showLabels && (
              <span className="text-xl font-black tracking-tighter uppercase italic truncate max-w-[140px] bg-gradient-to-r from-blue-600 to-emerald-600 dark:from-[#22D3EE] dark:to-[#10B981] bg-clip-text text-transparent">
                {systemSettings?.organizationName || 'OPerix'}
              </span>
            )}
          </div>
          {isMobileView && (
            <button 
              onClick={() => setIsMobileSidebarOpen(false)} 
              className="p-2 bg-muted text-muted-foreground hover:text-foreground border border-border"
              id="btn-close-mobile-sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
          {/* Module Switcher */}
          {showLabels ? (
            <div className="relative mb-6 px-1">
              <button
                onClick={() => setIsModuleDropdownOpen(!isModuleDropdownOpen)}
                className="w-full flex items-center justify-between p-3 bg-muted/50 border-2 border-border rounded-none hover:border-primary transition-all shadow-sm group"
                id="btn-switch-module"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn("w-8 h-8 rounded-none flex items-center justify-center shrink-0 border border-border/40 shadow-inner", visibleModules.find(m => m.id === activeModule)?.bg || 'bg-muted')}>
                    {visibleModules.find(m => m.id === activeModule)?.icon && React.createElement(visibleModules.find(m => m.id === activeModule)!.icon, { className: cn("w-5 h-5", visibleModules.find(m => m.id === activeModule)?.color) })}
                  </div>
                  <span className="font-black text-foreground text-xs uppercase tracking-widest leading-none truncate pr-1">
                    {visibleModules.find(m => m.id === activeModule)?.label || (isRtl ? 'اختر النظام' : 'Select module')}
                  </span>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform group-hover:text-primary shrink-0", isModuleDropdownOpen && "rotate-180")} />
              </button>

              <AnimatePresence>
                {isModuleDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-card border-2 border-border rounded-none shadow-xl z-50 overflow-hidden p-2 space-y-1"
                  >
                    {visibleModules.map(mod => (
                      <button
                        key={mod.id}
                        onClick={() => {
                          setActiveModule(mod.id as any);
                          const visibleTabs = moduleTabs[mod.id as keyof typeof moduleTabs].filter(t => t.show);
                          if (visibleTabs.length > 0) setActiveTab(visibleTabs[0].id);
                          setIsModuleDropdownOpen(false);
                          if (isMobileView) setIsMobileSidebarOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 rounded-none transition-all text-right",
                          activeModule === mod.id ? mod.bg : "hover:bg-muted/50"
                        )}
                      >
                        <div className={cn("w-8 h-8 rounded-none flex items-center justify-center shrink-0", mod.bg)}>
                          <mod.icon className={cn("w-4 h-4", mod.color)} />
                        </div>
                        <span className={cn(
                          "font-bold text-sm",
                          activeModule === mod.id ? mod.color : "text-muted-foreground"
                        )}>{mod.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
             <div className="flex flex-col gap-2 relative">
               {visibleModules.map(mod => (
                  <button
                    key={mod.id}
                    onClick={() => {
                      setActiveModule(mod.id as any);
                      const visibleTabs = moduleTabs[mod.id as keyof typeof moduleTabs].filter(t => t.show);
                      if (visibleTabs.length > 0) setActiveTab(visibleTabs[0].id);
                    }}
                    className={cn(
                      "w-12 h-12 mx-auto rounded-none flex items-center justify-center shrink-0 transition-all",
                      activeModule === mod.id ? mod.bg : "hover:bg-muted/50"
                    )}
                    title={mod.label}
                  >
                    <mod.icon className={cn("w-6 h-6", activeModule === mod.id ? mod.color : "text-muted-foreground")} />
                  </button>
               ))}
               <div className="h-px bg-border w-8 mx-auto my-2" />
             </div>
          )}

          {/* Current Module Tabs */}
          <div className="space-y-1">
            {showLabels && (
               <div className="px-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">
                 {isRtl ? 'قوائم النظام' : 'System Menus'}
               </div>
            )}
            {moduleTabs[activeModule].filter(item => item.show).map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (isMobileView) setIsMobileSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-none transition-all duration-200 group relative text-right",
                  activeTab === item.id 
                    ? "bg-primary/10 text-primary font-bold border-r-2 border-primary" 
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
                title={!showLabels ? item.label : undefined}
              >
                <item.icon className={cn(
                  "w-5 h-5 shrink-0 transition-transform duration-200",
                  activeTab === item.id ? "scale-110 text-primary" : "group-hover:scale-110"
                )} />
                {showLabels && <span className="text-xs md:text-sm font-bold truncate">{item.label}</span>}
              </button>
            ))}
          </div>
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-border mt-auto">
          {showLabels && (
            <div 
              onClick={() => {
                setActiveModule('self_service');
                setActiveTab('system_security');
                if (isMobileView) setIsMobileSidebarOpen(false);
              }}
              className="mb-3 p-3 bg-muted/40 rounded-none flex items-center gap-3 border border-border/40 hover:border-primary cursor-pointer transition-all group"
            >
              <div className="w-8 h-8 bg-primary/10 rounded-none flex items-center justify-center text-primary font-bold overflow-hidden border border-primary/20 group-hover:scale-110 transition-transform">
                {(profile as any)?.photoUrl ? (
                  <img src={(profile as any).photoUrl} alt={user?.displayName || 'Avatar'} className="w-full h-full object-cover" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                ) : (
                  user?.displayName?.[0] || 'U'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-foreground truncate uppercase tracking-tighter">{(profile as any)?.name || (profile as any)?.displayName || user?.displayName || 'System User'}</p>
                <p className="text-[9px] text-primary font-black uppercase tracking-wider flex items-center gap-1">
                  {profile?.role || 'User'} 
                  <ShieldCheck className="w-3 h-3" />
                </p>
              </div>
              <Settings className="w-3.5 h-3.5 text-muted-foreground group-hover:rotate-45 transition-all" />
            </div>
          )}
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 p-3 text-destructive hover:bg-destructive/10 rounded-none transition-colors text-xs md:text-sm font-bold",
              !showLabels && "justify-center"
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {showLabels && <span>{t('nav.logout')}</span>}
          </button>
          <button
            onClick={() => setIsChangePasswordOpen(true)}
            className={cn(
              "w-full flex items-center gap-3 p-3 text-primary hover:bg-primary/10 rounded-none transition-colors text-xs md:text-sm font-bold mt-1",
              !showLabels && "justify-center"
            )}
          >
            <KeyRound className="w-5 h-5 shrink-0 text-primary" />
            {showLabels && <span>{isRtl ? 'تغيير كلمة المرور الشخصية' : 'Change Personal Password'}</span>}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("min-h-screen bg-background flex transition-colors duration-300 overflow-x-auto w-full max-w-full")} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <AnimatePresence>
        {isLocked && <LockScreen onUnlock={handleUnlock} />}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {isChangePasswordOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsChangePasswordOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative w-full max-w-md bg-card text-card-foreground border-2 border-border/60 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-6 z-10 overflow-hidden"
              dir={isRtl ? 'rtl' : 'ltr'}
            >
              <button
                onClick={() => setIsChangePasswordOpen(false)}
                className="absolute top-4 p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-all cursor-pointer"
                style={isRtl ? { left: '16px' } : { right: '16px' }}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center text-center mt-2 mb-6">
                <div className="w-14 h-14 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-600 mb-4 border border-blue-600/20">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-foreground tracking-tight">
                  {isRtl ? 'تغيير كلمة المرور الشخصية' : 'Change Personal Password'}
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-1">
                  {isRtl 
                    ? 'تحديث كلمة المرور لحسابك الشخصي للوصول السريع والآمن' 
                    : 'Update your account password for quick and secure access'}
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                {passwordError && (
                  <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs font-bold rounded-xl">
                    {passwordError}
                  </div>
                )}
                
                {passwordSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold rounded-xl">
                    {passwordSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground">
                    {isRtl ? 'كلمة المرور الجديدة *' : 'New Password *'}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={isRtl ? 'أدخل كلمة المرور الجديدة' : 'Enter new password'}
                    className="w-full bg-input border border-border/80 px-4 py-3 rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium text-sm transition-all text-center placeholder:text-muted-foreground/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 text-muted-foreground">
                    {isRtl ? 'تأكيد كلمة المرور الجديدة *' : 'Confirm New Password *'}
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={isRtl ? 'أعد إدخال كلمة المرور لتأكيدها' : 'Confirm new password'}
                    className="w-full bg-input border border-border/80 px-4 py-3 rounded-2xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 font-medium text-sm transition-all text-center placeholder:text-muted-foreground/50"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingPassword}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all active:scale-98 text-sm mt-2 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/25 disabled:opacity-50"
                >
                  {isSubmittingPassword ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span>{isRtl ? 'تحديث كلمة المرور' : 'Update Password'}</span>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSidebarOpen(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: isRtl ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRtl ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className={cn(
                "absolute inset-y-0 w-72 bg-card border-x-2 border-border shadow-2xl z-50 overflow-hidden",
                isRtl ? "right-0" : "left-0"
              )}
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar Desktop */}
      <aside 
        className={cn(
          "hidden md:block fixed inset-y-0 z-30 bg-card border-2 border-border transition-all duration-300 shadow-[10px_0_30px_rgba(0,0,0,0.05)] h-[calc(100vh-20px)] m-[10px] rounded-none overflow-y-auto max-h-[calc(100vh-20px)] custom-scrollbar",
          isSidebarOpen ? "w-72" : "w-20",
          isRtl ? "right-0 border-r-2" : "left-0 border-l-2"
        )}
      >
        {renderSidebarContent(false)}

        {/* Toggle Button Desktop */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={cn(
            "fixed top-12 w-8 h-8 bg-card border-2 border-border rounded-none flex items-center justify-center shadow-lg hover:bg-muted transition-colors z-[70] cursor-pointer",
            isRtl ? (isSidebarOpen ? "right-[270px]" : "right-[66px]") : (isSidebarOpen ? "left-[270px]" : "left-[66px]")
          )}
          id="btn-sidebar-desktop-toggle"
        >
          <ChevronRight className={cn("w-4 h-4 text-foreground transition-transform font-black", isSidebarOpen ? (isRtl ? "rotate-0" : "rotate-180") : (isRtl ? "rotate-180" : "rotate-0"))} />
        </button>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 min-h-screen w-full flex flex-col min-w-0 max-w-full overflow-x-auto",
        isRtl 
          ? (isSidebarOpen ? "md:mr-72" : "md:ml-0 md:mr-20") 
          : (isSidebarOpen ? "md:ml-72" : "md:mr-0 md:ml-20"),
        isRtl ? "mr-0" : "ml-0"
      )}>
        <header className="h-20 md:h-24 bg-background/80 backdrop-blur-3xl sticky top-0 z-40 px-4 md:px-10 flex items-center justify-between border-b-2 border-border transition-all duration-300">
          <div className="flex items-center gap-2 md:gap-4">
            {/* Hamburger button on Mobile */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-2 hover:bg-muted border border-border flex items-center justify-center text-foreground"
              id="btn-mobile-sidebar-trigger"
            >
              <Menu className="w-5 h-5" />
            </button>
            {(() => {
              const activeItem = moduleTabs[activeModule]?.find(i => i.id === activeTab);
              const IconComp = activeItem?.icon;
              const style = getModuleStyle(activeModule);
              if (!IconComp) return <div className="w-1.5 h-8 md:h-10 bg-gradient-to-b from-primary to-secondary hidden sm:block" />;

              const moduleIconMap = {
                self_service: User,
                operations: Briefcase,
                hr: Users,
                payroll: Wallet,
                admin: Settings,
              };
              const ModuleIcon = moduleIconMap[activeModule] || IconComp;
              
              return (
                <div className="relative">
                  <motion.div
                    onClick={() => setIsModuleInfoOpen(!isModuleInfoOpen)}
                    className={cn(
                      "w-10 h-10 md:w-11 md:h-11 border-2 rounded-xl flex items-center justify-center shadow-md transition-all cursor-pointer select-none hidden sm:flex shrink-0",
                      style.bgColor,
                      style.borderColor,
                      isModuleInfoOpen && "ring-2 ring-primary scale-110"
                    )}
                    {...style.animation}
                    title={isRtl ? "عرض موجز الأعمال التفاعلي" : "View Interactive Business Summary"}
                  >
                    <ModuleIcon className={cn("w-5 h-5 md:w-5.5 md:h-5.5", style.iconColor)} />
                  </motion.div>

                  <AnimatePresence>
                    {isModuleInfoOpen && (
                      <>
                        <div className="fixed inset-0 z-40 animate-fade-in" onClick={() => setIsModuleInfoOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 15, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 15, scale: 0.95 }}
                          transition={{ type: "spring", damping: 20, stiffness: 350 }}
                          className={cn(
                            "absolute top-full mt-3 z-50 w-80 sm:w-96 bg-card text-card-foreground border-2 border-border rounded-2xl shadow-3xl p-6",
                            isRtl ? "right-0 origin-top-right text-right" : "left-0 origin-top-left text-left"
                          )}
                        >
                          {renderModuleBentoInfo()}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              );
            })()}
            <h2 className="text-base md:text-2xl font-black heading-gradient uppercase tracking-widest truncate max-w-[150px] sm:max-w-none">
              {moduleTabs[activeModule].find(i => i.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-6">
            {/* Theme & Language Toggles & Notifications */}
            <div className="flex items-center gap-2 md:gap-4 px-2 md:px-4 py-1.5 md:py-2 bg-muted border border-border rounded-xl transition-colors duration-300">
              {/* Professional Drill-Down Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="relative p-1.5 bg-card rounded-lg text-muted-foreground hover:text-primary transition-all shadow-sm border border-border hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center"
                  title={isRtl ? 'التنبيهات والإشعارات الفعالة' : 'Notifications & Alerts'}
                  id="btn-header-notifications"
                >
                  <Bell className="w-4 h-4" />
                  {headerNotificationItems.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                      {headerNotificationItems.length}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {isNotificationsOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.95 }}
                        className={cn(
                          "absolute top-full mt-3 z-50 w-80 sm:w-96 bg-card text-foreground border-2 border-border shadow-2xl p-4 space-y-3",
                          isRtl ? "left-0 sm:left-auto sm:right-0 origin-top-right text-right" : "right-0 origin-top-left text-left"
                        )}
                      >
                        <div className="flex items-center justify-between border-b border-border pb-3">
                          <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-primary" />
                            <h4 className="text-xs font-black text-foreground">
                              {isRtl ? 'مركز الإشعارات والتنبيهات المباشرة' : 'Notification & Alerts Hub'}
                            </h4>
                          </div>
                          <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            {headerNotificationItems.length} {isRtl ? 'إشعار' : 'alerts'}
                          </span>
                        </div>

                        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                          {headerNotificationItems.length === 0 ? (
                            <div className="p-6 text-center text-xs font-bold text-muted-foreground">
                              {isRtl ? 'لا توجد إشعارات معلقة حالياً' : 'No pending notifications'}
                            </div>
                          ) : (
                            headerNotificationItems.map(item => (
                              <div
                                key={item.id}
                                onClick={item.action}
                                className="p-3 bg-muted/40 hover:bg-muted/80 border border-border/60 transition-all cursor-pointer flex items-start gap-3 group text-right"
                              >
                                <div className={cn(
                                  "p-2 rounded-lg shrink-0 mt-0.5",
                                  item.type === 'grievance' ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400" :
                                  item.type === 'penalty' ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                                  item.type === 'investigation' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" :
                                  item.type === 'penalty_approval' ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" :
                                  item.type === 'leave' ? "bg-orange-500/10 text-orange-600 dark:text-orange-400" : 
                                  "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                )}>
                                  {item.type === 'grievance' ? <Scale className="w-4 h-4" /> :
                                   item.type === 'penalty' ? <ShieldAlert className="w-4 h-4" /> :
                                   item.type === 'investigation' ? <AlertTriangle className="w-4 h-4" /> :
                                   item.type === 'penalty_approval' ? <ShieldCheck className="w-4 h-4" /> :
                                   item.type === 'leave' ? <FileText className="w-4 h-4" /> : 
                                   <CheckSquare className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="text-xs font-black text-foreground group-hover:text-primary transition-colors truncate">
                                    {item.title}
                                  </h5>
                                  <p className="text-[10px] text-muted-foreground font-bold mt-0.5 truncate">
                                    {item.subtitle}
                                  </p>
                                  <span className="text-[9px] text-muted-foreground font-mono mt-1 block">
                                    {item.date}
                                  </span>
                                </div>
                                <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                                  {isRtl ? 'انتقال ➔' : 'Jump ➔'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <div className="w-px h-6 bg-border" />
              <ThemeToggle />
              <div className="w-px h-6 bg-border" />
              <button
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                className="flex items-center gap-1 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-card rounded-lg text-xs md:text-sm font-black text-foreground hover:bg-muted transition-all shadow-sm border border-border"
                id="btn-language-toggle"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? 'EN' : 'AR'}</span>
              </button>
              <div className="w-px h-6 bg-border hidden sm:block" />
              <button
                onClick={handleLock}
                className="p-1.5 bg-card rounded-lg text-muted-foreground hover:text-primary transition-all shadow-sm border border-border hover:scale-110 active:scale-95 hidden sm:block"
                title={isRtl ? 'قفل النظام' : 'Lock System'}
                id="btn-lock-system"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>

            <div className="hidden lg:flex flex-col items-end">
              <span className="text-sm font-bold text-foreground">
                {new Date().toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
              <span className="text-xs text-muted-foreground font-medium">{t('common.welcome')}</span>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 mx-auto transition-all duration-500 w-full flex-1 flex flex-col">
          <div className="mx-auto max-w-none w-full flex-1 flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full flex-1 flex flex-col"
              >
                {renderPage()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
};
