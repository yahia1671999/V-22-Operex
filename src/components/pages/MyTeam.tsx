import React, { useState, useMemo, useCallback } from 'react';
import { parse, isAfter } from 'date-fns';
import { 
  Users, CheckCircle2, CheckCircle, Clock, AlertTriangle, Calendar, Briefcase, FileText, 
  Building2, Filter, Search, Plus, ChevronRight, ChevronDown, Check, X, Eye, 
  UserCheck, ShieldAlert, PieChart, BarChart3, TrendingUp, Send, MessageSquare, 
  Award, FileCheck, SlidersHorizontal, Layers, Grid, List, ArrowUpRight, 
  RefreshCw, AlertCircle, Phone, Mail, MapPin, User, Activity, CheckSquare, 
  XCircle, Plane, Percent, ArrowLeft, Shield, Sparkles, ChevronLeft, MoreHorizontal,
  ThumbsUp, ThumbsDown, HelpCircle, UserPlus, Info, Sliders, Archive, GitFork, CornerDownLeft, Download, Printer
} from 'lucide-react';
import { getAutomaticEisenhowerQuadrant } from './TimeManagement';
import { motion, AnimatePresence } from 'motion/react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { Employee, LeaveRequest, Mission, Penalty, Investigation, ProjectTask, PerformanceEvaluation, MissionEvaluation } from '../../types';
import { MissionEvaluationModal } from '../common/MissionEvaluationModal';
import { TaskDetailsModal } from '../common/TaskDetailsModal';
import { WeeklySchedulePdfModal } from './WeeklySchedulePdfModal';
import { TeamPerformanceTab } from './TeamPerformanceTab';
import { getTaskAssignedIds, getTaskCompletionDate, calculateTaskDelay, TaskDelayInfo, toLocalDateStr, normalizeTaskAssigneeIds, findEmployeeByIdentifier } from '../../lib/taskUtils';
import { formatTime12h, formatDateTime12h } from '../../utils/timeFormatter';

interface MyTeamProps {
  onNavigateToTab?: (tab: string) => void;
}

export const MyTeam: React.FC<MyTeamProps> = ({ onNavigateToTab }) => {
  const { user, profile, isAdmin } = useAuth();
  const { can } = usePermissions();
  const { 
    employees = [], 
    projectTasks = [], 
    projects = [],
    leaveRequests = [], 
    missions = [], 
    penalties = [], 
    investigations = [],
    adminDepartments = [], 
    performanceCycles = [],
    performanceTemplates = [],
    performanceCriteria = [],
    performanceEvaluations = [],
    performanceDevelopmentPlans = [],
    attendanceRecords = [],
    attendanceShifts = [],
    systemSettings = null,
    refreshData 
  } = useData();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'weekly_schedule' | 'members' | 'requests' | 'tasks' | 'attendance' | 'performance' | 'investigations_penalties' | 'analytics'>('weekly_schedule');

  // Weekly Schedule State
  const [selectedWeeklyDate, setSelectedWeeklyDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [weeklyScheduleDept, setWeeklyScheduleDept] = useState<string>('all');
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);
  const [editingWeeklyTaskEmp, setEditingWeeklyTaskEmp] = useState<Employee | null>(null);
  
  const [weeklyTaskForm, setWeeklyTaskForm] = useState({
    mainTask: '',
    sunTask: '',
    monTask: '',
    tueTask: '',
    wedTask: '',
    thuTask: '',
    followUp: '',
    status: 'In Progress',
    progress: 50
  });

  // Local storage store for weekly tasks
  const [weeklyStore, setWeeklyStore] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('operix_weekly_schedule_store');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const saveWeeklyStore = (newStore: Record<string, any>) => {
    setWeeklyStore(newStore);
    try {
      localStorage.setItem('operix_weekly_schedule_store', JSON.stringify(newStore));
    } catch (e) {}
  };

  // Multi-Department Filters
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string>('all');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deptSearchTerm, setDeptSearchTerm] = useState<string>('');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState<boolean>(false);
  const [timePeriod, setTimePeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [customPreset, setCustomPreset] = useState<string>('all');

  // View modes
  const [membersViewMode, setMembersViewMode] = useState<'grid' | 'table'>('grid');
  const [tasksViewMode, setTasksViewMode] = useState<'table' | 'kanban' | 'eisenhower' | 'calendar' | 'completed'>('kanban');

  // Sub-filters
  const [requestsStatusFilter, setRequestsStatusFilter] = useState<string>('all');
  const [requestsTypeFilter, setRequestsTypeFilter] = useState<string>('all');
  const [tasksPriorityFilter, setTasksPriorityFilter] = useState<string>('all');
  const [tasksStatusFilter, setTasksStatusFilter] = useState<string>('all');

  // Selected Employee Details Side Drawer State
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [empDrawerTab, setEmpDrawerTab] = useState<'info' | 'requests' | 'tasks' | 'attendance' | 'performance' | 'leaves_missions'>('info');

  // Task Details Modal State (تفاصيل المهمة وتتبع التنفيذ والمهام الحالية)
  const [viewingTaskDetails, setViewingTaskDetails] = useState<ProjectTask | null>(null);

  // Weekly Schedule PDF Export Modal State
  const [showWeeklyPdfModal, setShowWeeklyPdfModal] = useState(false);

  // Task Editing Modal State
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDesc, setEditTaskDesc] = useState('');
  const [editTaskProjectId, setEditTaskProjectId] = useState<string>('');
  const [editTaskPhase, setEditTaskPhase] = useState<string>('');
  const [editTaskScope, setEditTaskScope] = useState<string>('');
  const [editTaskParentTaskId, setEditTaskParentTaskId] = useState<string>('');
  const [editTaskParentSearch, setEditTaskParentSearch] = useState<string>('');
  const [editTaskPriority, setEditTaskPriority] = useState<string>('Medium');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskStatus, setEditTaskStatus] = useState<string>('In Progress');
  const [editTaskProgress, setEditTaskProgress] = useState<number>(0);
  const [isSubmittingEditTask, setIsSubmittingEditTask] = useState(false);

  // Completed Tasks Filters State
  const [completedTaskMonth, setCompletedTaskMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [completedTaskWeek, setCompletedTaskWeek] = useState<string>('all');

  // Action Modals State
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);
  const [newTaskTargetEmpId, setNewTaskTargetEmpId] = useState<string>('');
  const [newTaskProjectId, setNewTaskProjectId] = useState<string>('');
  const [newTaskPhase, setNewTaskPhase] = useState<string>('');
  const [newTaskScope, setNewTaskScope] = useState<string>('');
  const [newTaskParentTaskId, setNewTaskParentTaskId] = useState<string>('');
  const [newTaskParentSearch, setNewTaskParentSearch] = useState<string>('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [newTaskStartDate, setNewTaskStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskEstimatedHours, setNewTaskEstimatedHours] = useState<number>(2);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Monthly Attendance History Modal State
  const [showAttendanceHistoryModal, setShowAttendanceHistoryModal] = useState(false);
  const [historyMonth, setHistoryMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [historyEmpFilter, setHistoryEmpFilter] = useState<string>('all');

  // Employee Filter for Team Tasks
  const [selectedEmployeeTaskFilter, setSelectedEmployeeTaskFilter] = useState<string>('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<string>('all');
  const [taskDeptFilter, setTaskDeptFilter] = useState<string>('all');
  const [taskDueDateFilter, setTaskDueDateFilter] = useState<string>('');

  // Decision Modal State for Requests (Approve / Reject / Request Completion)
  const [decisionModalItem, setDecisionModalItem] = useState<{ item: any; actionType: 'approve' | 'reject' | 'needs_info' } | null>(null);
  const [decisionReason, setDecisionReason] = useState('');
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  // Investigation Result State for Manager in "MyTeam"
  const [invResultModal, setInvResultModal] = useState<{
    isOpen: boolean;
    investigation: any;
    recommendation: string;
    notes: string;
    status: 'Completed' | 'Scheduled' | 'Cancelled';
    saving: boolean;
  }>({
    isOpen: false,
    investigation: null,
    recommendation: '',
    notes: '',
    status: 'Completed',
    saving: false
  });

  // Manager Penalty Approval / Objection Modal State
  const [managerPenaltyModal, setManagerPenaltyModal] = useState<{
    isOpen: boolean;
    penalty: any | null;
    action: 'Approved' | 'Objected';
    roleType: 'DirectManager' | 'HigherManager';
    reason: string;
    submitting: boolean;
  }>({
    isOpen: false,
    penalty: null,
    action: 'Approved',
    roleType: 'DirectManager',
    reason: '',
    submitting: false
  });

  const handleOpenResultModal = (inv: any) => {
    setInvResultModal({
      isOpen: true,
      investigation: inv,
      recommendation: inv.recommendation || '',
      notes: inv.notes || '',
      status: (inv.status as 'Completed' | 'Scheduled' | 'Cancelled') || 'Completed',
      saving: false
    });
  };

  const handleSaveInvResult = async () => {
    if (!invResultModal.investigation) return;
    setInvResultModal(prev => ({ ...prev, saving: true }));
    try {
      const invId = invResultModal.investigation.id;
      const res = await fetch(`/api/investigations/${invId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          recommendation: invResultModal.recommendation,
          notes: invResultModal.notes,
          status: invResultModal.status
        })
      });

      if (res.ok) {
        await refreshData();
        setInvResultModal({ isOpen: false, investigation: null, recommendation: '', notes: '', status: 'Completed', saving: false });
        alert('تم حفظ نتيجة التحقيق والقرارات الصادرة بنجاح!');
      } else {
        alert('حدث خطأ أثناء حفظ نتيجة التحقيق');
        setInvResultModal(prev => ({ ...prev, saving: false }));
      }
    } catch (err: any) {
      alert('خطأ: ' + err.message);
      setInvResultModal(prev => ({ ...prev, saving: false }));
    }
  };

  const handleManagerPenaltyAction = async () => {
    if (!managerPenaltyModal.penalty) return;
    const { penalty, action, roleType, reason } = managerPenaltyModal;

    if (action === 'Objected' && !reason.trim()) {
      alert('يرجى كتابة سبب الاعتراض أو الرأي لتسجيله رسميًا في الملف الإداري');
      return;
    }

    setManagerPenaltyModal(prev => ({ ...prev, submitting: true }));
    try {
      let nextStatus = penalty.status;
      let updatePayload: any = {};
      const reviewerName = profile?.name || user?.email || 'المدير المسؤول';
      const nowStr = new Date().toISOString();

      let auditEntry = {
        action: '',
        performedBy: reviewerName,
        performedAt: nowStr,
        details: reason || (action === 'Approved' ? 'تمت الموافقة' : 'تم الاعتراض'),
        previousStatus: penalty.status,
        newStatus: ''
      };

      if (roleType === 'DirectManager') {
        nextStatus = 'Pending Higher Manager';
        updatePayload = {
          directManagerDecision: action,
          directManagerObjectionReason: action === 'Objected' ? reason : null,
          directManagerNotes: reason || (action === 'Approved' ? 'موافقة المدير المباشر' : null),
          status: nextStatus
        };
        auditEntry.action = action === 'Approved' ? 'موافقة المدير المباشر' : 'اعتراض المدير المباشر';
      } else {
        // HigherManager
        nextStatus = 'Pending HR';
        updatePayload = {
          higherManagerDecision: action,
          higherManagerObjectionReason: action === 'Objected' ? reason : null,
          higherManagerNotes: reason || (action === 'Approved' ? 'موافقة الرئيس الأعلى' : null),
          status: nextStatus
        };
        auditEntry.action = action === 'Approved' ? 'موافقة الرئيس الأعلى' : 'اعتراض / رأي الرئيس الأعلى';
      }

      auditEntry.newStatus = nextStatus;

      let currentAuditTrail = [];
      try {
        currentAuditTrail = typeof penalty.auditTrail === 'string' ? JSON.parse(penalty.auditTrail) : (penalty.auditTrail || []);
      } catch (e) {
        currentAuditTrail = [];
      }
      const newAuditTrail = [...currentAuditTrail, auditEntry];
      updatePayload.auditTrail = JSON.stringify(newAuditTrail);
      updatePayload.updatedAt = nowStr;

      const res = await fetch(`/api/penalties/${penalty.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(updatePayload)
      });

      if (res.ok) {
        // Create an administrative notice about this decision
        const empName = penalty.employeeName || 'عضو الفريق';
        const noticeTitle = `تحديث مسار اعتماد جزاء - ${empName} (${action === 'Approved' ? 'موافقة' : 'اعتراض'})`;
        const noticeContent = `<div style="direction: rtl; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; border-radius: 12px; background-color: #ffffff; border: 2px solid #d97706; color: #111827; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h3 style="color: #b45309; margin-top: 0; margin-bottom: 12px; font-weight: 900; font-size: 16px; border-bottom: 2px solid #fef3c7; padding-bottom: 8px;">⚖️ تحديث مسار اعتماد الجزاء الإداري</h3>
          <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">الموظف المعني:</strong> <span style="color: #b45309; font-weight: 800;">${empName}</span></p>
          <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">القرار الإداري:</strong> <span style="color: #1f2937; font-weight: 700;">${penalty.penaltyNumber || penalty.id}</span></p>
          <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">جهة الرأي / المعتمد:</strong> <span style="color: #1f2937; font-weight: 700;">${roleType === 'DirectManager' ? 'المدير المباشر' : 'الرئيس الأعلى'} (${reviewerName})</span></p>
          <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">القرار المتخذ:</strong> <span style="color: ${action === 'Approved' ? '#047857' : '#b91c1c'}; font-weight: 800;">${action === 'Approved' ? 'موافقة' : 'اعتراض'}</span></p>
          ${reason ? `<p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">سبب وملاحظات الرأي:</strong> <span style="color: #374151;">${reason}</span></p>` : ''}
          <p style="margin: 6px 0; color: #111827; font-size: 13px; line-height: 1.5;"><strong style="color: #111827; font-weight: 800;">المرحلة التالية:</strong> <span style="color: #0284c7; font-weight: 700;">${nextStatus === 'Pending Higher Manager' ? 'بانتظار موافقة ورأي الرئيس الأعلى' : 'بانتظار اعتماد الموارد البشرية (HR)'}</span></p>
        </div>`;

        try {
          await fetch('/api/administrative-notices', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({
              title: noticeTitle,
              content: noticeContent,
              category: 'decision',
              priority: 'high',
              noticeDate: new Date().toISOString().split('T')[0],
              startDate: new Date().toISOString().split('T')[0],
              durationDays: 14,
              targetAudience: [penalty.employeeId, String(profile?.id || '')].filter(Boolean),
              createdByName: reviewerName,
              createdByRole: roleType === 'DirectManager' ? 'المدير المباشر' : 'الرئيس الأعلى',
              createdById: profile?.id || user?.uid || '',
              status: 'Published'
            })
          });
        } catch (noticeErr) {
          console.warn('Notice creation warning:', noticeErr);
        }

        await refreshData();
        setManagerPenaltyModal({ isOpen: false, penalty: null, action: 'Approved', roleType: 'DirectManager', reason: '', submitting: false });
        alert('تم تسجيل القرار وتمرير الجزاء للمرحلة التالية بنجاح!');
      } else {
        alert('حدث خطأ أثناء تحديث مسار الجزاء');
        setManagerPenaltyModal(prev => ({ ...prev, submitting: false }));
      }
    } catch (err: any) {
      alert('خطأ: ' + err.message);
      setManagerPenaltyModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // Mission Evaluation State & Handler
  const [evaluatingMission, setEvaluatingMission] = useState<any>(null);
  const [isSubmittingEvaluation, setIsSubmittingEvaluation] = useState(false);

  const handleSubmitMissionEvaluation = async (missionId: string, evaluation: MissionEvaluation, markCompleted: boolean) => {
    setIsSubmittingEvaluation(true);
    try {
      const res = await fetch(`/api/missions/${missionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          status: markCompleted ? 'Completed' : undefined,
          evaluation: evaluation,
          evaluatedBy: user?.displayName || user?.email || profile?.name || 'المدير المباشر',
          evaluatedAt: new Date().toISOString()
        })
      });

      if (res.ok) {
        await refreshData();
        setEvaluatingMission(null);
        alert('تم اعتماد تقييم المأمورية بنجاح وتحديث حالتها إلى مكتملة!');
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert('فشل حفظ التقييم: ' + (errJson.error || 'خطأ غير معروف'));
      }
    } catch (e: any) {
      console.error('Error submitting evaluation:', e);
      alert('حدث خطأ أثناء حفظ التقييم: ' + e.message);
    } finally {
      setIsSubmittingEvaluation(false);
    }
  };

  // Internal Alert Modal State
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertTargetEmp, setAlertTargetEmp] = useState<Employee | null>(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertSuccess, setAlertSuccess] = useState(false);

  // Helper: Get department name for an employee
  const getEmpDepartmentName = useCallback((emp: Employee) => {
    if (!emp) return 'غير محدد';
    const deptKey = (emp as any).departmentName || (emp as any).department || emp.departmentId || '';
    if (!deptKey) return 'غير محدد';
    const deptObj = adminDepartments.find(d => d.id === deptKey || d.name === deptKey);
    if (deptObj && deptObj.name) return deptObj.name;
    if (deptKey.includes('-') && deptKey.length > 20) return 'غير محدد';
    return deptKey;
  }, [adminDepartments]);

  // Current Employee Record
  const currentEmp = useMemo(() => {
    return employees.find(e => 
      (user?.email && e.email && e.email.toLowerCase() === user.email.toLowerCase()) ||
      (user?.uid && (e.userId === user.uid || e.id === user.uid)) ||
      (profile?.email && e.email && e.email.toLowerCase() === profile.email.toLowerCase()) ||
      (profile?.id && (e.id === profile.id || (e as any).employeeId === profile.id || (e as any).userId === profile.id)) ||
      (profile?.name && e.name && e.name.toLowerCase() === profile.name.toLowerCase())
    ) || null;
  }, [user, profile, employees]);

  // 1. Identify Manager Identifiers
  const currentManagerIds = useMemo(() => {
    const ids = new Set<string>();
    const addVal = (val?: string | null) => {
      if (!val) return;
      const clean = String(val).trim().toLowerCase();
      if (!clean) return;
      ids.add(clean);
      ids.add(clean.replace(/\s+/g, ''));
    };

    if (user) {
      addVal(user.uid);
      addVal(user.email);
      addVal((user as any).employeeId);
      addVal(user.displayName);
    }

    if (currentEmp) {
      addVal(currentEmp.id);
      addVal(currentEmp.employeeId);
      addVal(currentEmp.userId);
      addVal(currentEmp.email);
      addVal(currentEmp.name);
      addVal((currentEmp as any).username);
    }

    return Array.from(ids);
  }, [user, profile, currentEmp]);

  // Find all department IDs managed by current manager
  const managedDepartmentIds = useMemo(() => {
    const deptIds = new Set<string>();
    adminDepartments.forEach(d => {
      const dMgrId = d.managerId ? String(d.managerId).trim().toLowerCase() : '';
      const dMgrName = (d as any).managerName ? String((d as any).managerName).trim().toLowerCase() : '';
      const dMgr = (d as any).manager ? String((d as any).manager).trim().toLowerCase() : '';
      const dMgrEmail = (d as any).managerEmail ? String((d as any).managerEmail).trim().toLowerCase() : '';
      const dHead = (d as any).headId ? String((d as any).headId).trim().toLowerCase() : '';

      if (currentManagerIds.some(id => 
        id === dMgrId || id === dMgrName || id === dMgr || id === dMgrEmail || id === dHead
      )) {
        deptIds.add(String(d.id).trim().toLowerCase());
        deptIds.add(String(d.name).trim().toLowerCase());
      }
    });
    return Array.from(deptIds);
  }, [adminDepartments, currentManagerIds]);

  // 2. Check Subordinates for Current Manager (Multi-department support)
  const isSubordinate = useCallback((emp: Employee) => {
    if (!emp || currentManagerIds.length === 0) return false;

    const empIds = [emp.id, emp.employeeId, emp.userId, emp.email, emp.name]
      .filter(Boolean)
      .map(x => String(x).trim().toLowerCase());

    // Skip self
    if (empIds.some(id => currentManagerIds.includes(id))) {
      return false;
    }

    const mgrId = emp.managerId ? String(emp.managerId).trim().toLowerCase() : '';
    const supervisorId = (emp as any).supervisorId ? String((emp as any).supervisorId).trim().toLowerCase() : '';
    const directMgr = (emp as any).directManager ? String((emp as any).directManager).trim().toLowerCase() : '';
    const directMgrId = (emp as any).directManagerId ? String((emp as any).directManagerId).trim().toLowerCase() : '';
    const directMgrName = (emp as any).directManagerName ? String((emp as any).directManagerName).trim().toLowerCase() : '';
    const manager = (emp as any).manager ? String((emp as any).manager).trim().toLowerCase() : '';
    const managerName = (emp as any).managerName ? String((emp as any).managerName).trim().toLowerCase() : '';
    const supervisor = (emp as any).supervisor ? String((emp as any).supervisor).trim().toLowerCase() : '';
    const supervisorName = (emp as any).supervisorName ? String((emp as any).supervisorName).trim().toLowerCase() : '';
    const reportsTo = (emp as any).reportsTo ? String((emp as any).reportsTo).trim().toLowerCase() : '';
    const reportsToId = (emp as any).reportsToId ? String((emp as any).reportsToId).trim().toLowerCase() : '';

    const checkFields = [
      mgrId, supervisorId, directMgr, directMgrId, directMgrName, 
      manager, managerName, supervisor, supervisorName, reportsTo, reportsToId
    ];

    if (checkFields.some(f => f && currentManagerIds.includes(f))) {
      return true;
    }

    // Check department management
    const empDeptStr = String((emp as any).department || emp.departmentId || '').trim().toLowerCase();
    if (empDeptStr) {
      if (managedDepartmentIds.includes(empDeptStr)) return true;
      const managedDept = adminDepartments.find(d => {
        const dMgr = d.managerId ? String(d.managerId).trim().toLowerCase() : '';
        const dId = String(d.id).trim().toLowerCase();
        const dName = String(d.name).trim().toLowerCase();
        return (dId === empDeptStr || dName === empDeptStr) && currentManagerIds.includes(dMgr);
      });
      if (managedDept) return true;
    }

    // Indirect check via employees list lookup for manager object
    if (mgrId || directMgr || directMgrId) {
      const targetMgrId = mgrId || directMgrId || directMgr;
      const parentMgrEmp = employees.find(m => {
        const mIds = [m.id, m.employeeId, m.userId, m.email, m.name].filter(Boolean).map(x => String(x).trim().toLowerCase());
        return mIds.includes(targetMgrId);
      });
      if (parentMgrEmp) {
        const pIds = [parentMgrEmp.id, parentMgrEmp.employeeId, parentMgrEmp.userId, parentMgrEmp.email, parentMgrEmp.name]
          .filter(Boolean).map(x => String(x).trim().toLowerCase());
        if (pIds.some(id => currentManagerIds.includes(id))) return true;
      }
    }

    return false;
  }, [currentManagerIds, managedDepartmentIds, adminDepartments, employees]);

  // User Executive Role & Permission Check
  const userRoleStr = useMemo(() => {
    return (profile as any)?.role || (user as any)?.role || '';
  }, [profile, user]);

  const hasExecutivePermission = can('self_service.executive_team_dashboard_access') || 
                                 can('executive.team_dashboard.access') ||
                                 can('my_team.view') ||
                                 can('self_service.my_team_view') ||
                                 can('hr.employees.view');

  const isExecutive = useMemo(() => {
    const roleLower = String(userRoleStr).toLowerCase();
    const execRoles = [
      'super admin', 'admin', 'executive director', 'general manager', 'ceo',
      'تنفيذي', 'مدير تنفيذي', 'مدير عام', 'أدمن', 'مدير إداري', 'رئيس مجلس الإدارة', 'مساعد مدير عام'
    ];
    return Boolean(
      isAdmin || 
      hasExecutivePermission || 
      execRoles.some(r => roleLower.includes(r)) || 
      (profile as any)?.isExecutive || 
      (user as any)?.isExecutive
    );
  }, [userRoleStr, isAdmin, profile, user, hasExecutivePermission]);

  // Is Direct Manager (has manager role or manages departments/subordinates)
  const isDirectManager = useMemo(() => {
    const roleLower = String(userRoleStr).toLowerCase();
    const mgrRoles = [
      'manager', 'director', 'supervisor', 'head', 'lead', 'chief',
      'مدير', 'مشرف', 'رئيس', 'مسؤول', 'قائد', 'إداري', 'منسق'
    ];
    const hasMgrRole = mgrRoles.some(r => roleLower.includes(r));
    const managesAnyDept = managedDepartmentIds.length > 0;
    const hasAnySubordinate = employees.some(emp => isSubordinate(emp));

    return Boolean(
      isExecutive || 
      isAdmin || 
      hasExecutivePermission || 
      hasMgrRole || 
      managesAnyDept || 
      hasAnySubordinate ||
      (profile as any)?.isManager ||
      (user as any)?.isManager
    );
  }, [userRoleStr, managedDepartmentIds, employees, isSubordinate, isExecutive, isAdmin, hasExecutivePermission, profile, user]);

  // 3. All Supervised Team Members (Deduplicated)
  // For Executive Director / Admin -> Returns all employees across the company
  // For Direct Manager -> Returns subordinates
  const allTeamMembers = useMemo(() => {
    const list = isExecutive ? employees : employees.filter(emp => isSubordinate(emp));
    const unique = new Map<string, Employee>();
    list.forEach(emp => {
      const key = emp.id || emp.employeeId || emp.email;
      if (key && !unique.has(key)) {
        unique.set(key, emp);
      }
    });
    return Array.from(unique.values());
  }, [isExecutive, employees, isSubordinate]);

  // Week Details Calculation (Sunday to Thursday)
  const weekDetails = useMemo(() => {
    const rawD = selectedWeeklyDate ? new Date(selectedWeeklyDate) : new Date();
    // Use midday to avoid any daylight savings or timezone boundaries
    const d = new Date(rawD.getFullYear(), rawD.getMonth(), rawD.getDate(), 12, 0, 0);
    const dayOfWeek = d.getDay(); // 0 is Sunday
    
    const sunday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek, 12, 0, 0);

    const days = [];
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu'];
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];
    for (let i = 0; i < 5; i++) {
      const dayDate = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + i, 12, 0, 0);
      const dateFormatted = `${dayDate.getDate()}-${dayDate.getMonth() + 1}`;
      const isoDate = toLocalDateStr(dayDate) || '';
      days.push({
        key: dayKeys[i],
        name: dayNames[i],
        dateFormatted,
        isoDate,
        dayDate
      });
    }

    const thursday = days[4].dayDate;
    const sundayIso = toLocalDateStr(sunday) || '';
    
    const monthNameSun = sunday.toLocaleString('ar-EG', { month: 'long' });
    const monthNameThu = thursday.toLocaleString('ar-EG', { month: 'long' });
    const rangeText = `من الأحد ${sunday.getDate()} ${monthNameSun} ${sunday.getFullYear()} إلى الخميس ${thursday.getDate()} ${monthNameThu} ${thursday.getFullYear()}`;

    return { days, sunday, thursday, sundayIso, rangeText };
  }, [selectedWeeklyDate]);

  // Available Departments for Weekly Schedule Filter based on Role
  const weeklyAvailableDepartments = useMemo(() => {
    if (isExecutive) {
      const list = new Set<string>();
      adminDepartments.forEach(d => { if (d.name) list.add(d.name); });
      employees.forEach(e => {
        const dName = getEmpDepartmentName(e);
        if (dName && dName !== 'غير محدد') list.add(dName);
      });
      return ['all', ...Array.from(list)];
    } else {
      // Direct Manager: only departments where this manager has subordinates
      const list = new Set<string>();
      allTeamMembers.forEach(e => {
        const dName = getEmpDepartmentName(e);
        if (dName && dName !== 'غير محدد') list.add(dName);
      });
      const depts = Array.from(list);
      return depts.length > 0 ? depts : ['إدارتي'];
    }
  }, [isExecutive, adminDepartments, employees, getEmpDepartmentName, allTeamMembers]);

  // Employees visible in Weekly Schedule tab
  const weeklyEmployeesInView = useMemo(() => {
    let baseList = isExecutive ? employees : allTeamMembers;

    // Filter by department
    if (weeklyScheduleDept !== 'all') {
      baseList = baseList.filter(e => getEmpDepartmentName(e) === weeklyScheduleDept);
    }

    // Filter by search term if typed
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      baseList = baseList.filter(e => 
        e.name?.toLowerCase().includes(q) || 
        (e as any).jobTitle?.toLowerCase().includes(q) ||
        getEmpDepartmentName(e).toLowerCase().includes(q)
      );
    }

    return baseList;
  }, [isExecutive, employees, allTeamMembers, weeklyScheduleDept, getEmpDepartmentName, searchTerm]);

  // Group employees by department when 'all' is selected (for Executive Director)
  const weeklyEmployeesByDept = useMemo(() => {
    const map = new Map<string, Employee[]>();
    weeklyEmployeesInView.forEach(emp => {
      const deptName = getEmpDepartmentName(emp);
      if (!map.has(deptName)) {
        map.set(deptName, []);
      }
      map.get(deptName)!.push(emp);
    });
    return map;
  }, [weeklyEmployeesInView, getEmpDepartmentName]);

  // Helper to extract Manager-Assigned Main Tasks for an employee
  const getManagerAssignedTasks = useCallback((emp: Employee) => {
    const empIds = [emp.id, emp.employeeId, emp.userId, emp.email].filter(Boolean).map(x => String(x).trim().toLowerCase());
    
    // Direct manager object
    const manager = employees.find(e => e.id === emp.managerId || (emp.departmentId && e.id === adminDepartments.find(d => d.id === emp.departmentId)?.managerId));
    const managerIds = manager 
      ? [manager.id, manager.employeeId, manager.userId, manager.email, manager.name].filter(Boolean).map(x => String(x).trim().toLowerCase())
      : [];
    
    // Executive / Admin / Logged-in Manager IDs
    const currentUserId = user?.uid ? String(user.uid).trim().toLowerCase() : '';
    const currentUserEmail = user?.email ? String(user.email).trim().toLowerCase() : '';
    const currentUserName = user?.displayName ? String(user.displayName).trim().toLowerCase() : '';

    return projectTasks.filter(t => {
      const assigned = String(t.assignedToId || (t as any).assignedTo || '').trim().toLowerCase();
      const assignedIds = Array.isArray(t.assignedToIds) ? t.assignedToIds.map(x => String(x).trim().toLowerCase()) : [];
      const isAssignedToEmp = empIds.includes(assigned) || assignedIds.some(id => empIds.includes(id));
      
      if (!isAssignedToEmp) return false;

      const creator = String(t.creatorId || (t as any).createdBy || '').trim().toLowerCase();
      const isCreatedByManager = managerIds.length > 0
        ? managerIds.some(id => id && creator.includes(id)) || creator === currentUserId || creator === currentUserEmail || creator === currentUserName || creator.includes('مدير') || creator.includes('المباشر') || creator.includes('إدارة')
        : true; // If no explicit manager set, treat assigned project tasks created by managers/admins as manager tasks

      return isCreatedByManager;
    });
  }, [projectTasks, employees, adminDepartments, user]);

  // Helper to extract completed task objects for a specific day column in Weekly Task Schedule
  const getCompletedDayTasksObjects = useCallback((emp: Employee, dayKey: string, dayIsoDate: string, entry: any) => {
    const completedTasks: Array<{
      id: string;
      title: string;
      isManagerTask: boolean;
      projectName?: string;
      status: string;
      source: 'project' | 'manual';
      completionTime?: string;
      completionTimeFormatted?: string;
      estimatedHours?: number;
      delayInfo?: any;
      priority?: string;
    }> = [];

    // 1. Manual task in weekly store if week status or entry task is completed
    const dayTaskVal = entry ? entry[`${dayKey}Task`] : null;
    const isEntryCompleted = entry && (entry.status === 'Completed' || entry.status === 'Executed' || entry.status === 'Approved');
    if (dayTaskVal && dayTaskVal.trim() && isEntryCompleted) {
      completedTasks.push({
        id: `manual_${emp.id}_${dayKey}`,
        title: dayTaskVal.trim(),
        isManagerTask: false,
        status: 'Completed',
        source: 'manual'
      });
    }

    // 2. Project tasks assigned to employee that are completed for this specific date
    const empIds = [emp.id, emp.employeeId, emp.userId, emp.email, emp.name].filter(Boolean).map(x => String(x).trim().toLowerCase());
    const manager = employees.find(e => e.id === emp.managerId || (emp.departmentId && e.id === adminDepartments.find(d => d.id === emp.departmentId)?.managerId));
    const managerIds = manager 
      ? [manager.id, manager.employeeId, manager.userId, manager.email, manager.name].filter(Boolean).map(x => String(x).trim().toLowerCase())
      : [];
    const currentUserId = user?.uid ? String(user.uid).trim().toLowerCase() : '';
    const currentUserEmail = user?.email ? String(user.email).trim().toLowerCase() : '';
    const currentUserName = user?.displayName ? String(user.displayName).trim().toLowerCase() : '';

    const completedProjectTasks = projectTasks.filter(t => {
      const assigned = String(t.assignedToId || (t as any).assignedTo || '').trim().toLowerCase();
      const assignedIds = getTaskAssignedIds(t).map(x => String(x).trim().toLowerCase());
      const isAssigned = empIds.includes(assigned) || assignedIds.some(id => empIds.includes(id));
      if (!isAssigned) return false;

      const completionDate = getTaskCompletionDate(t);
      if (!completionDate) return false;

      return completionDate === dayIsoDate;
    });

    completedProjectTasks.forEach(t => {
      const creator = String(t.creatorId || (t as any).createdBy || '').trim().toLowerCase();
      const isMgrTask = managerIds.length > 0
        ? managerIds.some(id => id && creator.includes(id)) || creator === currentUserId || creator === currentUserEmail || creator === currentUserName || creator.includes('مدير') || creator.includes('المباشر') || creator.includes('إدارة')
        : true;

      const proj = projects.find(p => p.id === t.projectId);
      const delayInfo = calculateTaskDelay(t);

      let completionTimeFormatted = '';
      if (t.completedAt) {
        try {
          const cd = new Date(t.completedAt);
          if (!isNaN(cd.getTime())) {
            completionTimeFormatted = `${String(cd.getHours()).padStart(2, '0')}:${String(cd.getMinutes()).padStart(2, '0')}`;
          }
        } catch (e) {}
      }

      if (!completedTasks.some(ct => ct.id === t.id)) {
        completedTasks.push({
          id: t.id,
          title: t.title,
          isManagerTask: isMgrTask,
          projectName: proj?.name,
          status: t.status,
          source: 'project',
          completionTime: (t as any).completedAt || t.updatedAt,
          completionTimeFormatted,
          estimatedHours: t.estimatedHours,
          delayInfo,
          priority: t.priority
        });
      }
    });

    return completedTasks;
  }, [projectTasks, employees, adminDepartments, user, projects]);

  // Backward compatible string array helper
  const getCompletedDayTasks = useCallback((emp: Employee, dayKey: string, dayIsoDate: string, entry: any) => {
    return getCompletedDayTasksObjects(emp, dayKey, dayIsoDate, entry).map(t => t.title);
  }, [getCompletedDayTasksObjects]);

  // Weekly Schedule completion rate
  const weeklyCompletionRate = useMemo(() => {
    if (weeklyEmployeesInView.length === 0) return 0;
    let totalPct = 0;
    let count = 0;

    weeklyEmployeesInView.forEach(emp => {
      const storeKey = `${emp.id}_${weekDetails.sundayIso}`;
      const entry = weeklyStore[storeKey];
      if (entry) {
        totalPct += Number(entry.progress || (entry.status === 'Completed' || entry.status === 'Executed' || entry.status === 'Approved' ? 100 : 50));
        count++;
      } else {
        const empTasks = projectTasks.filter(t => t.assignedToId === emp.id || t.assignedToId === emp.employeeId);
        if (empTasks.length > 0) {
          const done = empTasks.filter(t => t.status === 'Executed' || (t.status as string) === 'Completed' || t.status === 'Approved').length;
          totalPct += Math.round((done / empTasks.length) * 100);
        } else {
          totalPct += 0;
        }
        count++;
      }
    });

    return count > 0 ? Math.round(totalPct / count) : 0;
  }, [weeklyEmployeesInView, weekDetails.sundayIso, weeklyStore, projectTasks]);

  // Summary metrics for Weekly Schedule Header
  const weeklyScheduleStats = useMemo(() => {
    let totalManagerTasks = 0;
    let totalCompletedThisWeek = 0;

    weeklyEmployeesInView.forEach(emp => {
      const mgrTasks = getManagerAssignedTasks(emp);
      totalManagerTasks += mgrTasks.length;

      const storeKey = `${emp.id}_${weekDetails.sundayIso}`;
      const entry = weeklyStore[storeKey];

      weekDetails.days.forEach(d => {
        const completed = getCompletedDayTasksObjects(emp, d.key, d.isoDate, entry);
        totalCompletedThisWeek += completed.length;
      });
    });

    return {
      totalEmployees: weeklyEmployeesInView.length,
      totalManagerTasks,
      totalCompletedThisWeek,
      completionRate: weeklyCompletionRate
    };
  }, [weeklyEmployeesInView, getManagerAssignedTasks, getCompletedDayTasksObjects, weekDetails, weeklyStore, weeklyCompletionRate]);

  // Historical Weeks list (last 12 weeks)
  const pastWeeksList = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7), 12, 0, 0);
      const dayOfWeek = d.getDay();
      const sun = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dayOfWeek, 12, 0, 0);
      const thu = new Date(sun.getFullYear(), sun.getMonth(), sun.getDate() + 4, 12, 0, 0);
      
      const iso = toLocalDateStr(sun) || '';
      const label = `أسبوع (${sun.getDate()}/${sun.getMonth()+1} - ${thu.getDate()}/${thu.getMonth()+1}/${thu.getFullYear()})`;
      list.push({ iso, label, isCurrent: i === 0 });
    }
    return list;
  }, []);

  const handleOpenWeeklyTaskEdit = (emp: Employee) => {
    setEditingWeeklyTaskEmp(emp);
    const storeKey = `${emp.id}_${weekDetails.sundayIso}`;
    const existing = weeklyStore[storeKey];

    if (existing) {
      setWeeklyTaskForm({
        mainTask: existing.mainTask || '',
        sunTask: existing.sunTask || '',
        monTask: existing.monTask || '',
        tueTask: existing.tueTask || '',
        wedTask: existing.wedTask || '',
        thuTask: existing.thuTask || '',
        followUp: existing.followUp || '',
        status: existing.status || 'In Progress',
        progress: existing.progress || 50
      });
    } else {
      const mgrTasks = getManagerAssignedTasks(emp);
      const mainTaskStr = mgrTasks.length > 0 
        ? mgrTasks.map(t => t.title).join(' | ') 
        : 'متابعة المهام التشغيلية اليومية المسندة من المدير المباشر';
      setWeeklyTaskForm({
        mainTask: mainTaskStr,
        sunTask: '',
        monTask: '',
        tueTask: '',
        wedTask: '',
        thuTask: '',
        followUp: 'متابعة تنفيذ التكليفات الأسبوعية...',
        status: 'In Progress',
        progress: 50
      });
    }
  };

  const handleSaveWeeklyTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWeeklyTaskEmp) return;

    const storeKey = `${editingWeeklyTaskEmp.id}_${weekDetails.sundayIso}`;
    const newStore = {
      ...weeklyStore,
      [storeKey]: {
        ...weeklyTaskForm,
        employeeId: editingWeeklyTaskEmp.id,
        employeeName: editingWeeklyTaskEmp.name,
        department: getEmpDepartmentName(editingWeeklyTaskEmp),
        sundayIso: weekDetails.sundayIso,
        updatedAt: new Date().toISOString()
      }
    };

    saveWeeklyStore(newStore);
    setEditingWeeklyTaskEmp(null);
  };

  // 4. Department Counts & List from Database
  const departmentBreakdown = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();

    // 1) Populate all actual database departments from adminDepartments table
    adminDepartments.forEach(dept => {
      if (dept && dept.name) {
        map.set(dept.name, { id: dept.id, name: dept.name, count: 0 });
      }
    });

    // 2) Count employee members in each department & add any custom department names
    allTeamMembers.forEach(emp => {
      const deptName = getEmpDepartmentName(emp);
      if (deptName) {
        if (!map.has(deptName)) {
          map.set(deptName, { id: emp.departmentId || deptName, name: deptName, count: 0 });
        }
        const item = map.get(deptName)!;
        item.count += 1;
      }
    });

    return Array.from(map.values());
  }, [adminDepartments, allTeamMembers, getEmpDepartmentName]);

  // Filtered Team Members by selected departments, sections, and search term
  const filteredTeamMembers = useMemo(() => {
    return allTeamMembers.filter(emp => {
      const empDeptName = getEmpDepartmentName(emp);

      // Department Filter
      if (selectedDeptIds.length > 0) {
        const matchesDept = selectedDeptIds.some(dId => dId === empDeptName || dId === emp.departmentId || dId === (emp as any).department);
        if (!matchesDept) return false;
      }

      // Employee Search Term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = emp.name.toLowerCase().includes(term);
        const matchesEmpId = emp.employeeId?.toLowerCase().includes(term);
        const matchesJob = emp.jobTitle?.toLowerCase().includes(term);
        if (!matchesName && !matchesEmpId && !matchesJob) return false;
      }

      // Specific Employee Select
      if (selectedEmpId !== 'all' && emp.id !== selectedEmpId && emp.employeeId !== selectedEmpId) {
        return false;
      }

      return true;
    });
  }, [allTeamMembers, selectedDeptIds, searchTerm, selectedEmpId, getEmpDepartmentName]);

  // Team Member Identifier Array for request filtering
  const filteredTeamMemberIds = useMemo(() => {
    const ids = new Set<string>();
    filteredTeamMembers.forEach(emp => {
      [emp.id, emp.employeeId, emp.userId, emp.email, emp.name]
        .filter(Boolean)
        .forEach(x => ids.add(String(x).trim().toLowerCase()));
    });
    return Array.from(ids);
  }, [filteredTeamMembers]);

  // Helper: Match record to filtered team members
  const isRecordForFilteredTeam = useCallback((rec: any) => {
    if (!rec) return false;
    const recIds = [
      rec.employeeId,
      rec.userId,
      rec.email,
      rec.userEmail,
      rec.empId,
      rec.employeeName,
      rec.name,
      rec.employee?.id,
      rec.employee?.email
    ].filter(Boolean).map(x => String(x).trim().toLowerCase());

    return recIds.some(id => filteredTeamMemberIds.includes(id));
  }, [filteredTeamMemberIds]);

  // Requests Data for Team
  const teamLeaveRequests = useMemo(() => leaveRequests.filter(lr => isRecordForFilteredTeam(lr)), [leaveRequests, isRecordForFilteredTeam]);
  const teamMissions = useMemo(() => missions.filter(m => isRecordForFilteredTeam(m)), [missions, isRecordForFilteredTeam]);
  const teamPenalties = useMemo(() => penalties.filter(p => isRecordForFilteredTeam(p)), [penalties, isRecordForFilteredTeam]);
  const teamInvestigations = useMemo(() => {
    return (investigations || []).filter((inv: any) => {
      let empArr: string[] = [];
      try {
        empArr = typeof inv.employeeIds === 'string' ? JSON.parse(inv.employeeIds) : (inv.employeeIds || []);
      } catch (e) {}
      if (!Array.isArray(empArr)) empArr = [];
      
      const invIds = [
        inv.employeeId,
        inv.userId,
        inv.email,
        ...empArr
      ].filter(Boolean).map(x => String(x).trim().toLowerCase());

      return invIds.some(id => 
        filteredTeamMemberIds.some(tId => tId === id)
      );
    });
  }, [investigations, filteredTeamMemberIds]);

  // Helper to resolve assigned employee details cleanly (Name, ID, Dept, Job)
  const getAssignedEmployeeDetails = useCallback((t: any) => {
    if (!t) return { name: 'غير محدد', employeeId: '---', department: '---', jobTitle: '---' };
    const targetVal = String(t.assignedToId || t.assignedTo || '').trim().toLowerCase();
    
    const found = employees.find(e => {
      const ids = [e.id, e.employeeId, e.userId, e.email, e.name].filter(Boolean).map(x => String(x).trim().toLowerCase());
      return ids.includes(targetVal);
    });

    if (found) {
      return {
        name: found.name,
        employeeId: found.employeeId || found.id,
        department: getEmpDepartmentName(found),
        jobTitle: found.jobTitle || 'عضو بالفريق'
      };
    }

    const assignedName = (t.assignedTo && typeof t.assignedTo === 'string' && !t.assignedTo.includes('-') && !t.assignedTo.includes('@') && t.assignedTo !== 'undefined' && t.assignedTo !== 'null')
      ? t.assignedTo
      : (t.assignedToName || targetVal || 'عضو بالفريق');

    return {
      name: assignedName,
      employeeId: t.assignedToId || '---',
      department: '---',
      jobTitle: '---'
    };
  }, [employees, getEmpDepartmentName]);

  const getAssignedEmployeeName = useCallback((t: any) => {
    return getAssignedEmployeeDetails(t).name;
  }, [getAssignedEmployeeDetails]);

  // Tasks Data for Team
  const teamTasks = useMemo(() => {
    return projectTasks.filter(t => {
      const assignedTo = String(t.assignedToId || (t as any).assignedTo || '').trim().toLowerCase();
      const assignedIds = Array.isArray(t.assignedToIds) ? t.assignedToIds.map(x => String(x).trim().toLowerCase()) : [];
      const creatorIdStr = String(t.creatorId || '').trim().toLowerCase();
      
      const isAssignedToTeam = filteredTeamMemberIds.includes(assignedTo) || 
                               assignedIds.some(id => filteredTeamMemberIds.includes(id)) ||
                               isRecordForFilteredTeam(t);
      const isCreatedByManager = currentManagerIds.includes(creatorIdStr);

      return isAssignedToTeam || isCreatedByManager;
    });
  }, [projectTasks, filteredTeamMemberIds, currentManagerIds, isRecordForFilteredTeam]);

  // Display Tasks filtered by multi-dimensional filters (Employee, Department, Status, Priority, Due Date)
  const displayTeamTasks = useMemo(() => {
    const baseTasks = teamTasks.filter(t => {
      // 1. Employee Filter
      if (selectedEmployeeTaskFilter !== 'all') {
        const targetEmp = filteredTeamMembers.find(e => e.id === selectedEmployeeTaskFilter || e.employeeId === selectedEmployeeTaskFilter);
        if (targetEmp) {
          const targetIds = [targetEmp.id, targetEmp.employeeId, targetEmp.userId, targetEmp.email, targetEmp.name].filter(Boolean).map(x => String(x).trim().toLowerCase());
          const assignedTo = String(t.assignedToId || (t as any).assignedTo || '').trim().toLowerCase();
          const assignedIds = Array.isArray(t.assignedToIds) ? t.assignedToIds.map(x => String(x).trim().toLowerCase()) : [];
          if (!targetIds.includes(assignedTo) && !assignedIds.some(id => targetIds.includes(id))) {
            return false;
          }
        }
      }

      // 2. Department Filter
      if (taskDeptFilter !== 'all') {
        const empDetails = getAssignedEmployeeDetails(t);
        if (empDetails.department !== taskDeptFilter) return false;
      }

      // 3. Status Filter
      if (taskStatusFilter !== 'all') {
        const isDone = t.status === 'Executed' || t.status === 'Approved' || (t.status as string) === 'Completed';
        if (taskStatusFilter === 'Executed' && !isDone) return false;
        if (taskStatusFilter === 'In Progress' && isDone) return false;
      }

      // 4. Priority Filter
      if (taskPriorityFilter !== 'all') {
        if ((t as any).priority !== taskPriorityFilter) return false;
      }

      // 5. Due Date Filter
      if (taskDueDateFilter) {
        const dateVal = (t as any).dueDate || t.endDate || '';
        if (dateVal !== taskDueDateFilter) return false;
      }

      return true;
    });

    if (selectedEmployeeTaskFilter !== 'all') {
      const targetEmp = filteredTeamMembers.find(e => e.id === selectedEmployeeTaskFilter || e.employeeId === selectedEmployeeTaskFilter);
      if (targetEmp?.email) {
        try {
          const savedCommitments = localStorage.getItem(`salarix_commitments_${targetEmp.email.toLowerCase().trim()}`);
          if (savedCommitments) {
            const parsed = JSON.parse(savedCommitments);
            if (Array.isArray(parsed)) {
              parsed.forEach((c: any) => {
                if (!c.id || c.id.startsWith('task-override-')) return;
                const isDone = c.status === 'Completed' || c.status === 'Approved';
                
                if (taskStatusFilter === 'Executed' && !isDone) return;
                if (taskStatusFilter === 'In Progress' && isDone) return;
                if (taskPriorityFilter !== 'all' && c.priority !== taskPriorityFilter) return;

                const convertedTask: any = {
                  id: `personal-${c.id}`,
                  title: c.title,
                  description: c.description || 'التزام شخصي خاص بالموظف',
                  status: isDone ? 'Executed' : (c.status || 'In Progress'),
                  priority: c.priority || 'Medium',
                  quadrant: c.quadrant,
                  dueDate: c.startDate || c.endDate,
                  endDate: c.startDate || c.endDate,
                  assignedToId: targetEmp.id,
                  assignedToName: targetEmp.name,
                  subPhase: 'personal',
                  phase: 'Personal'
                };
                baseTasks.push(convertedTask);
              });
            }
          }
        } catch (e) {}
      }
    }

    return baseTasks;
  }, [teamTasks, selectedEmployeeTaskFilter, filteredTeamMembers, taskDeptFilter, taskStatusFilter, taskPriorityFilter, taskDueDateFilter, getAssignedEmployeeDetails]);

  // Overall completion rate calculation for team tasks
  const overallTeamTaskDoneRate = useMemo(() => {
    if (teamTasks.length === 0) return 100;
    const done = teamTasks.filter(t => t.status === 'Executed' || t.status === 'Approved' || (t.status as string) === 'Completed').length;
    return Math.round((done / teamTasks.length) * 100);
  }, [teamTasks]);

  // Performance Evaluations Data for Team (Matching filtered team members or manager hierarchy)
  const teamEvaluations = useMemo(() => {
    return performanceEvaluations.filter(e => {
      if (isRecordForFilteredTeam(e)) return true;
      const mgr = e.managerId ? String(e.managerId).trim().toLowerCase() : '';
      const higherMgr = e.higherLevelManagerId ? String(e.higherLevelManagerId).trim().toLowerCase() : '';
      const deptHead = e.deptHeadId ? String(e.deptHeadId).trim().toLowerCase() : '';
      if (currentManagerIds.some(id => id === mgr || id === higherMgr || id === deptHead)) return true;
      return false;
    });
  }, [performanceEvaluations, isRecordForFilteredTeam, currentManagerIds]);

  // Today Status Helpers
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const getEmpTodayStatus = useCallback((emp: Employee) => {
    if (!emp) return { label: 'غير محدد', color: 'bg-slate-500/10 text-slate-600 border-slate-500/30 font-black', type: 'unknown', checkInTime: '', checkOutTime: '' };

    const empIds = [emp.id, emp.employeeId, emp.userId, emp.email, emp.name].filter(Boolean).map(x => String(x).trim().toLowerCase());

    const isRemoteWorker = emp.workMode === 'Remotely Work' || 
                           (emp as any).workLocation === 'Remote' || 
                           (emp as any).workLocation === 'عمل عن بعد' || 
                           (emp as any).workType === 'Remote' || 
                           (emp as any).jobType === 'Remote';

    // 1. Check if user recorded attendance check-in today
    const empTodayRecs = attendanceRecords.filter(r => {
      const rEmpIds = [r.employeeId, (r as any).userId, (r as any).email].filter(Boolean).map(x => String(x).trim().toLowerCase());
      const matchesEmp = rEmpIds.some(id => empIds.includes(id));
      if (!matchesEmp) return false;
      const recDate = r.timestamp || (r as any).date || (r as any).createdAt || (r as any).actionTime || '';
      return recDate.startsWith(todayStr) || (r as any).attendanceDate === todayStr;
    });

    let checkInTimeStr = '';
    let checkOutTimeStr = '';

    if (empTodayRecs.length > 0) {
      const inRec = empTodayRecs.find(r => r.type === 'In' || (r as any).actionType === 'CheckIn') || empTodayRecs[0];
      const outRec = empTodayRecs.find(r => r.type === 'Out' || (r as any).actionType === 'CheckOut') || (empTodayRecs.length > 1 ? empTodayRecs[empTodayRecs.length - 1] : null);

      const formatRecTime = (r: any) => {
        if (!r) return '';
        const raw = r.timestamp || r.time || r.actionTime;
        return raw ? formatTime12h(raw, 'ar') : '';
      };

      checkInTimeStr = formatRecTime(inRec);
      if (outRec && outRec !== inRec) {
        checkOutTimeStr = formatRecTime(outRec);
      }
    }

    const hasCheckedInToday = Boolean(empTodayRecs.length > 0);

    // 2. Check approved active leave / WFH
    const activeLeave = leaveRequests.find(l => {
      if (l.status !== 'Approved') return false;
      const lEmpIds = [l.employeeId, (l as any).userId, (l as any).email].filter(Boolean).map(x => String(x).trim().toLowerCase());
      if (!lEmpIds.some(id => empIds.includes(id))) return false;
      return todayStr >= l.startDate && todayStr <= l.endDate;
    });

    // 3. Check approved mission
    const activeMission = missions.find(m => {
      if (m.status !== 'Approved') return false;
      const mEmpIds = [m.employeeId, (m as any).userId].filter(Boolean).map(x => String(x).trim().toLowerCase());
      if (!mEmpIds.some(id => empIds.includes(id))) return false;
      return todayStr >= m.startDate && todayStr <= m.endDate;
    });

    if (hasCheckedInToday) {
      if (isRemoteWorker) {
        return { 
          label: 'عمل عن بُعد', 
          color: 'bg-purple-500/10 text-purple-600 border-purple-500/30 font-black', 
          type: 'remote', 
          checkInTime: checkInTimeStr || 'تم تسجيل البدء',
          checkOutTime: checkOutTimeStr || 'لم يسجل الانصراف بعد'
        };
      }
      if (activeLeave && (activeLeave.type === 'WFH' || (activeLeave as any).leaveType === 'WFH' || ((activeLeave as any).notes && (activeLeave as any).notes.includes('منزل')) || ((activeLeave as any).reason && (activeLeave as any).reason.includes('منزل')))) {
        return { 
          label: 'يعمل من المنزل (WFH)', 
          color: 'bg-blue-500/10 text-blue-600 border-blue-500/30 font-black', 
          type: 'wfh', 
          checkInTime: checkInTimeStr || 'تم تسجيل البدء',
          checkOutTime: checkOutTimeStr || 'لم يسجل الانصراف بعد'
        };
      }
      return { 
        label: 'حاضر بالمقر', 
        color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-black', 
        type: 'present', 
        checkInTime: checkInTimeStr || 'تم تسجيل البدء',
        checkOutTime: checkOutTimeStr || 'لم يسجل الانصراف بعد'
      };
    }

    if (activeMission) {
      return { label: 'مأمورية رسمية', color: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30 font-black', type: 'mission', checkInTime: '', checkOutTime: '' };
    }

    if (activeLeave) {
      const isWfhLeave = activeLeave.type === 'WFH' || (activeLeave as any).leaveType === 'WFH' || ((activeLeave as any).notes && (activeLeave as any).notes.includes('منزل')) || ((activeLeave as any).reason && (activeLeave as any).reason.includes('منزل'));
      if (isWfhLeave) {
        return { label: 'يعمل من المنزل', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30 font-black', type: 'wfh', checkInTime: '', checkOutTime: '' };
      }
      const leaveLabel = activeLeave.type === 'Sick' || (activeLeave as any).leaveType === 'Sick' ? 'إجازة مرضية' : 'إجازة رسمية';
      return { label: leaveLabel, color: 'bg-amber-500/10 text-amber-600 border-amber-500/30 font-black', type: 'leave', checkInTime: '', checkOutTime: '' };
    }

    if (isRemoteWorker) {
      return { label: 'عن بُعد (لم يسجل البدء)', color: 'bg-slate-500/10 text-slate-600 border-slate-500/30 font-black', type: 'remote_pending', checkInTime: '', checkOutTime: '' };
    }

    return { label: 'غير حاضر', color: 'bg-rose-500/10 text-rose-600 border-rose-500/30 font-black', type: 'absent', checkInTime: '', checkOutTime: '' };
  }, [leaveRequests, missions, attendanceRecords, todayStr]);

  const getEmpOvertimeStats = useCallback((emp: Employee) => {
    if (!emp) return { todayOvertimeMins: 0, monthOvertimeMins: 0 };
    const empIds = [emp.id, emp.employeeId, emp.userId, emp.email, emp.name].filter(Boolean).map(x => String(x).trim().toLowerCase());
    const shift = attendanceShifts.find(s => s.id === emp.shiftId) || attendanceShifts[0];

    const empTodayRecs = attendanceRecords.filter(r => {
      const rEmpIds = [r.employeeId, (r as any).userId, (r as any).email].filter(Boolean).map(x => String(x).trim().toLowerCase());
      if (!rEmpIds.some(id => empIds.includes(id))) return false;
      const recDate = r.timestamp || (r as any).date || (r as any).createdAt || '';
      return recDate.startsWith(todayStr);
    });

    let todayOvertimeMins = 0;
    if (empTodayRecs.length > 0) {
      const sorted = [...empTodayRecs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const firstIn = sorted.find(r => r.type === 'In');
      const lastOut = sorted.find(r => r.type === 'Out') || [...sorted].reverse().find(r => r.type === 'Out');
      if (firstIn && lastOut && lastOut !== firstIn) {
        if (shift) {
          const shiftEnd = parse(shift.endTime, 'HH:mm', new Date());
          const actualOut = new Date(lastOut.timestamp);
          if (isAfter(actualOut, shiftEnd)) {
            todayOvertimeMins = Math.floor((actualOut.getTime() - shiftEnd.getTime()) / (1000 * 60));
          }
        } else {
          const actualIn = new Date(firstIn.timestamp);
          const actualOut = new Date(lastOut.timestamp);
          const workedMins = Math.floor((actualOut.getTime() - actualIn.getTime()) / (1000 * 60));
          if (workedMins > 480) todayOvertimeMins = workedMins - 480;
        }
      }
    }

    const currentMonthStr = todayStr.substring(0, 7);
    const empMonthRecs = attendanceRecords.filter(r => {
      const rEmpIds = [r.employeeId, (r as any).userId, (r as any).email].filter(Boolean).map(x => String(x).trim().toLowerCase());
      if (!rEmpIds.some(id => empIds.includes(id))) return false;
      const recDate = r.timestamp || (r as any).date || (r as any).createdAt || '';
      return recDate.startsWith(currentMonthStr);
    });

    const daysInMonth = empMonthRecs.reduce((acc, r) => {
      const day = r.timestamp ? r.timestamp.split('T')[0] : '';
      if (day) {
        if (!acc[day]) acc[day] = [];
        acc[day].push(r);
      }
      return acc;
    }, {} as Record<string, typeof attendanceRecords>);

    let monthOvertimeMins = 0;
    Object.entries(daysInMonth).forEach(([dayDate, recs]) => {
      const sorted = [...recs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const firstIn = sorted.find(r => r.type === 'In');
      const lastOut = sorted.find(r => r.type === 'Out') || [...sorted].reverse().find(r => r.type === 'Out');
      if (firstIn && lastOut && lastOut !== firstIn) {
        if (shift) {
          const shiftEnd = parse(shift.endTime, 'HH:mm', new Date(dayDate));
          const actualOut = new Date(lastOut.timestamp);
          if (isAfter(actualOut, shiftEnd)) {
            monthOvertimeMins += Math.floor((actualOut.getTime() - shiftEnd.getTime()) / (1000 * 60));
          }
        } else {
          const actualIn = new Date(firstIn.timestamp);
          const actualOut = new Date(lastOut.timestamp);
          const workedMins = Math.floor((actualOut.getTime() - actualIn.getTime()) / (1000 * 60));
          if (workedMins > 480) monthOvertimeMins += (workedMins - 480);
        }
      }
    });

    return { todayOvertimeMins, monthOvertimeMins };
  }, [attendanceRecords, attendanceShifts, todayStr]);

  // KPI Metrics Calculations
  const kpiStats = useMemo(() => {
    const totalMembers = filteredTeamMembers.length;
    const deptsRepresented = new Set(filteredTeamMembers.map(e => getEmpDepartmentName(e))).size;

    let availableToday = 0;
    let onLeaveToday = 0;
    let onMissionToday = 0;
    let onWfhToday = 0;

    filteredTeamMembers.forEach(emp => {
      const st = getEmpTodayStatus(emp);
      if (st.type === 'present') availableToday++;
      else if (st.type === 'leave') onLeaveToday++;
      else if (st.type === 'mission') onMissionToday++;
      else if (st.type === 'wfh') onWfhToday++;
    });

    const pendingLeaves = teamLeaveRequests.filter(r => r.status === 'Pending' || (r.status as string) === 'PendingManager').length;
    const pendingMissions = teamMissions.filter(m => m.status === 'Pending' || (m.status as string) === 'PendingManager').length;
    const pendingPenalties = teamPenalties.filter(p => (p.status as string) === 'Pending' || (p.status as string) === 'PendingManager').length;
    const totalPendingRequests = pendingLeaves + pendingMissions + pendingPenalties;

    const overdueTasks = teamTasks.filter(t => t.status !== 'Executed' && (t as any).dueDate && (t as any).dueDate < todayStr).length;

    const incompleteEvals = teamEvaluations.filter(e => e.status === 'PendingManager' || (e.status as string) === 'Draft' || (e.status as string) === 'Pending').length;

    return {
      totalMembers,
      deptsRepresented,
      availableToday,
      onLeaveToday,
      onMissionToday,
      onWfhToday,
      totalPendingRequests,
      overdueTasks,
      incompleteEvals
    };
  }, [filteredTeamMembers, getEmpTodayStatus, getEmpDepartmentName, teamLeaveRequests, teamMissions, teamPenalties, teamTasks, teamEvaluations, todayStr]);

  // Combined Unified Requests List
  const unifiedRequests = useMemo(() => {
    const list: any[] = [];

    teamLeaveRequests.forEach(r => {
      const emp = employees.find(e => e.id === r.employeeId || e.employeeId === r.employeeId || e.email === r.employeeId);
      list.push({
        id: r.id,
        rawId: r.id,
        type: (r.type === 'WFH' || (r as any).leaveType === 'WFH') ? 'العمل من المنزل' : `إجازة (${r.type || (r as any).leaveType || 'اعتيادية'})`,
        category: (r.type === 'WFH' || (r as any).leaveType === 'WFH') ? 'wfh' : 'leave',
        employeeName: emp?.name || (r as any).userEmail || 'عضو بالفريق',
        employeeId: r.employeeId,
        department: getEmpDepartmentName(emp!),
        startDate: r.startDate,
        endDate: r.endDate,
        createdAt: r.createdAt || r.startDate,
        status: r.status,
        reason: r.reason || (r as any).notes || 'طلب إجازة رسمية',
        originalObj: r,
        entity: 'leave-requests'
      });
    });

    teamMissions.forEach(m => {
      const emp = employees.find(e => e.id === m.employeeId || e.employeeId === m.employeeId);
      list.push({
        id: m.id,
        rawId: m.id,
        type: 'مأمورية عمل خارجية',
        category: 'mission',
        employeeName: emp?.name || 'عضو بالفريق',
        employeeId: m.employeeId,
        department: getEmpDepartmentName(emp!),
        startDate: m.startDate,
        endDate: m.endDate,
        createdAt: m.startDate,
        status: m.status,
        reason: m.notes || 'مأمورية رسمية لتنفيذ مهام عمل',
        originalObj: m,
        entity: 'missions'
      });
    });

    teamPenalties.forEach(p => {
      const emp = employees.find(e => e.id === p.employeeId || e.employeeId === p.employeeId);
      list.push({
        id: p.id,
        rawId: p.id,
        type: `إجراء/جزاء (${p.penaltyType || 'إداري'})`,
        category: 'penalty',
        employeeName: emp?.name || 'عضو بالفريق',
        employeeId: p.employeeId,
        department: getEmpDepartmentName(emp!),
        startDate: p.penaltyDate || p.createdAt || todayStr,
        endDate: p.penaltyDate || p.createdAt || todayStr,
        createdAt: p.createdAt || p.penaltyDate,
        status: p.status,
        reason: p.description || p.adminNotes || 'إجراء تنظيمي',
        originalObj: p,
        entity: 'penalties'
      });
    });

    return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [teamLeaveRequests, teamMissions, teamPenalties, employees, getEmpDepartmentName, todayStr]);

  // Filtered Unified Requests
  const filteredUnifiedRequests = useMemo(() => {
    return unifiedRequests.filter(req => {
      if (requestsTypeFilter !== 'all' && req.category !== requestsTypeFilter) return false;
      if (requestsStatusFilter !== 'all') {
        if (requestsStatusFilter === 'pending' && !(req.status === 'Pending' || req.status === 'PendingManager')) return false;
        if (requestsStatusFilter === 'approved' && req.status !== 'Approved') return false;
        if (requestsStatusFilter === 'rejected' && req.status !== 'Rejected') return false;
      }
      return true;
    });
  }, [unifiedRequests, requestsTypeFilter, requestsStatusFilter]);

  // Department Coverage Warning Logic
  const departmentWarnings = useMemo(() => {
    const warnings: { id: string; type: 'danger' | 'warning' | 'info'; title: string; message: string }[] = [];

    // Check overlapping leaves
    const activeLeavesToday = teamLeaveRequests.filter(l => l.status === 'Approved' && todayStr >= l.startDate && todayStr <= l.endDate);
    if (activeLeavesToday.length > 2) {
      warnings.push({
        id: 'leave-overlap',
        type: 'warning',
        title: 'تداخل طلبات إجازات متعددة اليوم',
        message: `يوجد ${activeLeavesToday.length} موظفين من فريقك في إجازات رسمية متزامنة اليوم.`
      });
    }

    // Check overdue tasks load
    if (kpiStats.overdueTasks > 3) {
      warnings.push({
        id: 'overdue-tasks-warn',
        type: 'warning',
        title: 'ارتفاع عدد المهام المتأخرة للفريق',
        message: `يوجد ${kpiStats.overdueTasks} مهام متأخرة تتطلب إعادة التوزيع والإنذار.`
      });
    }

    return warnings;
  }, [teamLeaveRequests, todayStr, kpiStats]);

  // Department Multi-select Handlers
  const toggleDeptSelection = (deptName: string) => {
    setSelectedDeptIds(prev => 
      prev.includes(deptName) ? prev.filter(d => d !== deptName) : [...prev, deptName]
    );
  };

  const selectAllDepartments = () => {
    setSelectedDeptIds(departmentBreakdown.map(d => d.name));
  };

  const clearAllDepartments = () => {
    setSelectedDeptIds([]);
  };

  // Handlers for Request Approvals & Rejections
  const handleOpenDecisionModal = (item: any, actionType: 'approve' | 'reject' | 'needs_info') => {
    setDecisionModalItem({ item, actionType });
    setDecisionReason('');
  };

  const handleExecuteDecision = async () => {
    if (!decisionModalItem) return;
    const { item, actionType } = decisionModalItem;

    if ((actionType === 'reject' || actionType === 'needs_info') && !decisionReason.trim()) {
      alert('يرجى إدخال سبب القرار أولاً.');
      return;
    }

    setIsSubmittingDecision(true);
    try {
      const targetCollection = item.entity;
      const statusVal = actionType === 'approve' ? 'Approved' : actionType === 'reject' ? 'Rejected' : 'NeedsCompletion';

      const res = await fetch(`/api/${targetCollection}/${item.rawId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          status: statusVal,
          reviewNote: decisionReason,
          managerReviewNote: decisionReason,
          reviewedBy: user?.displayName || user?.email || 'المدير المباشر',
          reviewedAt: new Date().toISOString()
        })
      });

      if (res.ok) {
        await refreshData();
        setDecisionModalItem(null);
        setDecisionReason('');
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert('فشل حفظ القرار: ' + (errJson.error || 'خطأ غير معروف'));
      }
    } catch (e: any) {
      console.error('Error submitting decision:', e);
      alert('حدث خطأ أثناء حفظ القرار: ' + e.message);
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Handlers for Assigning New Task
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskTargetEmpId) {
      alert('يرجى ملء كافة البيانات المطلوبة.');
      return;
    }

    setIsSubmittingTask(true);
    try {
      const targetEmp = findEmployeeByIdentifier(newTaskTargetEmpId, employees);
      const targetEmpIds = normalizeTaskAssigneeIds([targetEmp?.id, targetEmp?.employeeId, newTaskTargetEmpId], employees);
      const taskId = `task_${Date.now()}`;
      
      const res = await fetch('/api/project-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          id: taskId,
          title: newTaskTitle.trim(),
          description: newTaskDesc.trim(),
          projectId: newTaskProjectId || null,
          parentTaskId: newTaskParentTaskId || null,
          phase: newTaskPhase || null,
          subPhase: newTaskScope || 'General',
          assignedToId: targetEmp?.id || targetEmp?.employeeId || newTaskTargetEmpId,
          assignedTo: targetEmp?.name || 'عضو بالفريق',
          assignedToIds: JSON.stringify(targetEmpIds),
          priority: newTaskPriority,
          startDate: newTaskStartDate || todayStr,
          endDate: newTaskDueDate || todayStr,
          dueDate: newTaskDueDate || todayStr,
          estimatedHours: Number(newTaskEstimatedHours) || 2,
          status: 'Pending',
          workflowLog: JSON.stringify([{
            fromStatus: 'Pending',
            toStatus: 'Pending',
            userId: user?.uid || (profile as any)?.id || 'manager',
            userName: user?.displayName || user?.email || 'المدير المباشر',
            timestamp: new Date().toISOString(),
            note: `إسناد مهمة جديدة بوقت تقديري مقداره ${newTaskEstimatedHours || 2} ساعة${newTaskParentTaskId ? ' (كمهمة فرعية)' : ''}`
          }]),
          createdAt: new Date().toISOString(),
          createdBy: user?.displayName || user?.email || 'المدير المباشر'
        })
      });

      if (res.ok) {
        await refreshData();
        setIsAssignTaskModalOpen(false);
        setNewTaskTitle('');
        setNewTaskDesc('');
        setNewTaskTargetEmpId('');
        setNewTaskProjectId('');
        setNewTaskParentTaskId('');
        setNewTaskParentSearch('');
        setNewTaskPhase('');
        setNewTaskScope('');
        setNewTaskEstimatedHours(2);
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert('فشل إسناد المهمة: ' + (errJson.error || 'خطأ غير معروف'));
      }
    } catch (err: any) {
      console.error(err);
      alert('فشل في إسناد المهمة: ' + err.message);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  // Handlers for Editing Assigned Task
  const handleOpenEditTaskModal = (task: ProjectTask) => {
    setEditingTask(task);
    setEditTaskTitle(task.title || '');
    setEditTaskDesc(task.description || '');
    setEditTaskProjectId(task.projectId || '');
    setEditTaskParentTaskId(task.parentTaskId || '');
    setEditTaskParentSearch('');
    setEditTaskPhase(task.phase || '');
    setEditTaskScope(task.subPhase || '');
    setEditTaskPriority(task.priority || 'Medium');
    setEditTaskDueDate((task as any).dueDate || task.endDate || '');
    setEditTaskStatus(task.status || 'In Progress');
    setEditTaskProgress((task as any).progress || (task as any).completionPercentage || (task.status === 'Executed' || task.status === 'Approved' || (task.status as string) === 'Completed' ? 100 : 0));
  };

  const handleSaveEditedTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    if (!editTaskTitle.trim()) {
      alert('يرجى كتابة عنوان المهمة.');
      return;
    }

    setIsSubmittingEditTask(true);
    try {
      const res = await fetch(`/api/project-tasks/${editingTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          title: editTaskTitle.trim(),
          description: editTaskDesc.trim(),
          projectId: editTaskProjectId || null,
          parentTaskId: editTaskParentTaskId || null,
          phase: editTaskPhase || null,
          subPhase: editTaskScope || 'General',
          priority: editTaskPriority,
          dueDate: editTaskDueDate,
          endDate: editTaskDueDate,
          status: editTaskStatus,
          progress: Number(editTaskProgress),
          updatedAt: new Date().toISOString(),
          lastModifiedBy: user?.displayName || user?.email || 'المدير المباشر'
        })
      });

      if (res.ok) {
        await refreshData();
        setEditingTask(null);
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert('فشل حفظ التعديلات: ' + (errJson.error || 'خطأ غير معروف'));
      }
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ التعديلات: ' + err.message);
    } finally {
      setIsSubmittingEditTask(false);
    }
  };

  // Eisenhower Matrix quadrant classification for Team Tasks (Excludes Completed Tasks)
  const getTaskEisenhowerQuadrant = useCallback((task: ProjectTask) => {
    if (task.status === 'Executed' || (task.status as string) === 'Completed' || task.status === 'Approved') {
      return 'completed';
    }

    const quad = (task as any).quadrant;
    if (quad === 'do_first' || quad === 'urgent_important') return 'urgent_important';
    if (quad === 'schedule' || quad === 'important_not_urgent') return 'important_not_urgent';
    if (quad === 'delegate' || quad === 'urgent_not_important') return 'urgent_not_important';
    if (quad === 'eliminate' || quad === 'not_urgent_not_important') return 'not_urgent_not_important';

    const priorityStr = String(task.priority || 'Medium').toLowerCase();
    const isImportant = priorityStr === 'high' || priorityStr === 'critical' || priorityStr === 'medium';

    const dueStr = (task as any).dueDate || task.endDate || '';
    let isUrgent = priorityStr === 'critical';
    if (dueStr) {
      const due = new Date(dueStr);
      due.setHours(0,0,0,0);
      const today = new Date();
      today.setHours(0,0,0,0);
      const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 2) {
        isUrgent = true;
      }
    }

    if (isUrgent && isImportant) return 'urgent_important';
    if (!isUrgent && isImportant) return 'important_not_urgent';
    if (isUrgent && !isImportant) return 'urgent_not_important';
    return 'not_urgent_not_important';
  }, []);

  // Handlers for Internal Alert
  const handleSendAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertMessage.trim() || !alertTargetEmp) return;

    try {
      const alertId = `alert_${Date.now()}`;
      const res = await fetch('/api/dashboard-notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          id: alertId,
          employeeId: alertTargetEmp.id,
          title: 'تنبيه إداري من المدير المباشر',
          message: alertMessage.trim(),
          createdAt: new Date().toISOString(),
          sender: user?.displayName || 'المدير المباشر',
          read: false
        })
      });

      if (res.ok) {
        setAlertSuccess(true);
        setTimeout(() => {
          setAlertSuccess(false);
          setIsAlertModalOpen(false);
          setAlertMessage('');
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isExecutive && !isDirectManager && allTeamMembers.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-card border-2 border-amber-500/30 text-center space-y-4 shadow-xl rounded-none" dir="rtl">
        <div className="p-4 bg-amber-500/10 text-amber-600 rounded-full w-16 h-16 mx-auto flex items-center justify-center border border-amber-500/20">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-foreground">لا توجد صلاحية للوصول لشاشة «فريقي»</h2>
        <p className="text-xs font-bold text-muted-foreground leading-relaxed">
          عفواً، هذه الشاشة مخصصة فقط للمدراء المباشرين، أو للمدراء التنفيذيين وإدارة الشركة.
        </p>
        <div className="pt-2">
          <button
            onClick={() => onNavigateToTab?.('home')}
            className="px-6 py-2.5 bg-primary text-primary-foreground font-black text-xs hover:bg-primary/90 transition-all cursor-pointer shadow-md"
          >
            العودة للوحة التحكم الرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 text-right" dir="rtl">
      {/* HEADER SECTION */}
      <div className="bg-card border-2 border-border p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold mb-2">
            <span>لوحة التحكم</span>
            <ChevronLeft className="w-4 h-4" />
            <span className="text-primary font-bold">فريقي</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">فريقي — المنصة الإشرافية للمدير المباشر</h1>
              <p className="text-xs text-muted-foreground font-semibold mt-1">
                إدارة أعضاء الفريق ومتابعة الطلبات والمهام والحضور والأداء عبر الإدارات المختلفة.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Header Summary Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2.5 bg-muted border border-border flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground font-bold block">الموظفون تحت الإشراف</span>
              <span className="text-lg font-black text-foreground">{kpiStats.totalMembers} موظفاً</span>
            </div>
          </div>
          <div className="px-4 py-2.5 bg-muted border border-border flex items-center gap-3">
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground font-bold block">الإدارات الممثلة</span>
              <span className="text-lg font-black text-primary">{kpiStats.deptsRepresented} إدارات</span>
            </div>
          </div>
          <button 
            onClick={() => setIsAssignTaskModalOpen(true)}
            className="px-5 py-3 bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            إسناد مهمة للفريق
          </button>
        </div>
      </div>

      {/* NO SUBORDINATES INFO BANNER (IF MANAGER BUT NO SUBORDINATES FOUND) */}
      {allTeamMembers.length === 0 && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-between gap-4 text-right">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 text-amber-600 rounded-full shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-foreground">لا يوجد موظفون مرتبطون إدارياً بحسابك حالياً</h4>
              <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">
                تظهر هنا سجلات الموظفين المباشرين عند تحديد حسابك كـ «مدير مباشر» لهم في شاشة إدارة الموظفين أو تعيينك مديراً للإدارة في الهيكل التنظيمي.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab?.('org_structure')}
            className="px-3.5 py-1.5 bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-all cursor-pointer whitespace-nowrap"
          >
            عرض الهيكل التنظيمي
          </button>
        </div>
      )}

      {/* FILTER BAR & MULTI-DEPARTMENT CONTROLS */}
      <div className="bg-card border border-border p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">شريط الفلاتر التنظيمي:</span>
          </div>

          {/* Quick Filter Presets */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {[
              { id: 'all', label: 'جميع أعضاء الفريق' },
              { id: 'pending_requests', label: 'طلبات تنتظر الموافقة' },
              { id: 'overdue_tasks', label: 'المهام المتأخرة' },
              { id: 'absent_today', label: 'إجازات ومأموريات اليوم' }
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => {
                  setCustomPreset(preset.id);
                  if (preset.id === 'pending_requests') {
                    setActiveTab('requests');
                    setRequestsStatusFilter('pending');
                  } else if (preset.id === 'overdue_tasks') {
                    setActiveTab('tasks');
                    setTasksStatusFilter('overdue');
                  } else if (preset.id === 'absent_today') {
                    setActiveTab('attendance');
                  } else {
                    setRequestsStatusFilter('all');
                    setTasksStatusFilter('all');
                  }
                }}
                className={`px-3 py-1.5 text-xs font-bold transition-all border ${
                  customPreset === preset.id 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-border/60">
          {/* 1. Multi-Department Dropdown */}
          <div className="relative">
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">الإدارة:</label>
            <button
              onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
              className="w-full px-3 py-2 bg-background border border-border flex items-center justify-between text-xs font-bold text-foreground hover:border-primary transition-all"
            >
              <span className="truncate">
                {selectedDeptIds.length === 0 
                  ? `جميع الإدارات (${allTeamMembers.length})`
                  : `محدد (${selectedDeptIds.length} إدارات)`}
              </span>
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Dropdown Menu */}
            {isDeptDropdownOpen && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border-2 border-primary shadow-xl p-3 space-y-3">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                  <button onClick={selectAllDepartments} className="text-[11px] font-bold text-primary hover:underline">تحديد الكل</button>
                  <button onClick={clearAllDepartments} className="text-[11px] font-bold text-rose-500 hover:underline">إلغاء التحديد</button>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="البحث في الإدارات..."
                    value={deptSearchTerm}
                    onChange={e => setDeptSearchTerm(e.target.value)}
                    className="w-full pr-8 pl-2 py-1.5 text-xs bg-muted border border-border outline-none focus:border-primary"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {departmentBreakdown
                    .filter(d => d.name.toLowerCase().includes(deptSearchTerm.toLowerCase()))
                    .map(dept => {
                      const isChecked = selectedDeptIds.includes(dept.name);
                      return (
                        <label key={dept.name} className="flex items-center justify-between text-xs font-semibold p-1.5 hover:bg-muted/60 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleDeptSelection(dept.name)}
                              className="accent-primary w-4 h-4 cursor-pointer"
                            />
                            <span className="text-foreground">{dept.name}</span>
                          </div>
                          <span className="px-2 py-0.5 bg-muted text-muted-foreground font-bold text-[10px]">{dept.count} موظفين</span>
                        </label>
                      );
                    })}
                </div>
                <button
                  onClick={() => setIsDeptDropdownOpen(false)}
                  className="w-full py-1.5 bg-primary text-primary-foreground font-bold text-xs"
                >
                  تطبيق
                </button>
              </div>
            )}
          </div>

          {/* 2. Employee Search Input */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">الموظف / الرقم الوظيفي:</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="ابحث بالاسم أو الرقم الوظيفي..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs bg-background border border-border font-medium outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* 3. Time Period */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground block mb-1">الفترة الزمنية:</label>
            <select
              value={timePeriod}
              onChange={e => setTimePeriod(e.target.value as any)}
              className="w-full px-3 py-2 text-xs bg-background border border-border font-bold outline-none focus:border-primary"
            >
              <option value="today">اليوم</option>
              <option value="week">هذا الأسبوع</option>
              <option value="month">هذا الشهر</option>
              <option value="custom">فترة مخصصة</option>
            </select>
          </div>

          {/* 4. Reset & Filter Count */}
          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                setSelectedDeptIds([]);
                setSearchTerm('');
                setSelectedEmpId('all');
                setTimePeriod('month');
                setCustomPreset('all');
                setRequestsStatusFilter('all');
                setTasksStatusFilter('all');
              }}
              className="flex-1 py-2 bg-muted text-muted-foreground border border-border font-bold text-xs hover:bg-muted/80 transition-all flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              إعادة تصفية
            </button>
          </div>
        </div>

        {/* Selected Department Filter Chips */}
        {selectedDeptIds.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
            <span className="text-[11px] font-bold text-muted-foreground">الإدارات المحددة:</span>
            {selectedDeptIds.map(dName => (
              <span key={dName} className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 text-xs font-bold flex items-center gap-1.5">
                {dName}
                <X className="w-3.5 h-3.5 cursor-pointer hover:text-rose-500" onClick={() => toggleDeptSelection(dName)} />
              </span>
            ))}
            <button onClick={clearAllDepartments} className="text-[11px] font-bold text-rose-500 hover:underline mr-2">مسح الكل</button>
          </div>
        )}
      </div>

      {/* WARNINGS & AUTOMATED NOTIFICATIONS (IF ANY) */}
      {departmentWarnings.length > 0 && (
        <div className="space-y-2">
          {departmentWarnings.map(warn => (
            <div
              key={warn.id}
              className={`p-4 border flex items-center justify-between gap-3 ${
                warn.type === 'danger'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
              }`}
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <h4 className="text-xs font-black">{warn.title}</h4>
                  <p className="text-[11px] font-semibold mt-0.5 opacity-90">{warn.message}</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('attendance')}
                className="px-3 py-1 bg-background border border-current font-bold text-[11px] whitespace-nowrap hover:opacity-80"
              >
                متابعة التغطية
              </button>
            </div>
          ))}
        </div>
      )}

      {/* EXECUTIVE KPI CARDS (CLICKABLE) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-3">
        {[
          {
            id: 'members',
            title: 'إجمالي أعضاء الفريق',
            value: kpiStats.totalMembers,
            icon: Users,
            color: 'text-primary',
            bg: 'bg-primary/10 border-primary/20',
            tab: 'members'
          },
          {
            id: 'depts',
            title: 'الإدارات الممثلة',
            value: kpiStats.deptsRepresented,
            icon: Building2,
            color: 'text-indigo-600',
            bg: 'bg-indigo-500/10 border-indigo-500/20',
            tab: 'members'
          },
          {
            id: 'available',
            title: 'المتاحون اليوم (بصمة)',
            value: kpiStats.availableToday,
            icon: UserCheck,
            color: 'text-emerald-600',
            bg: 'bg-emerald-500/10 border-emerald-500/20',
            tab: 'attendance'
          },
          {
            id: 'leave',
            title: 'في إجازة اليوم',
            value: kpiStats.onLeaveToday,
            icon: Calendar,
            color: 'text-amber-600',
            bg: 'bg-amber-500/10 border-amber-500/20',
            tab: 'requests'
          },
          {
            id: 'mission',
            title: 'في مأمورية',
            value: kpiStats.onMissionToday,
            icon: Plane,
            color: 'text-purple-600',
            bg: 'bg-purple-500/10 border-purple-500/20',
            tab: 'requests'
          },
          {
            id: 'wfh',
            title: 'عمل من المنزل',
            value: kpiStats.onWfhToday,
            icon: Briefcase,
            color: 'text-blue-600',
            bg: 'bg-blue-500/10 border-blue-500/20',
            tab: 'requests'
          },
          {
            id: 'pending',
            title: 'طلبات تنتظر الموافقة',
            value: kpiStats.totalPendingRequests,
            icon: Clock,
            color: 'text-rose-600',
            bg: 'bg-rose-500/10 border-rose-500/20',
            tab: 'requests'
          },
          {
            id: 'overdue',
            title: 'مهام متأخرة',
            value: kpiStats.overdueTasks,
            icon: AlertCircle,
            color: 'text-rose-700',
            bg: 'bg-rose-600/10 border-rose-600/30',
            tab: 'tasks'
          },
          {
            id: 'evals',
            title: 'تقييمات غير مكتملة',
            value: kpiStats.incompleteEvals,
            icon: FileCheck,
            color: 'text-orange-600',
            bg: 'bg-orange-500/10 border-orange-500/20',
            tab: 'performance'
          }
        ].map(kpi => {
          const IconComp = kpi.icon;
          return (
            <div
              key={kpi.id}
              onClick={() => setActiveTab(kpi.tab as any)}
              className={`p-3.5 bg-card border ${kpi.bg} shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-95`}
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-[10px] font-black text-muted-foreground truncate">{kpi.title}</span>
                <IconComp className={`w-4 h-4 ${kpi.color} shrink-0 group-hover:scale-110 transition-transform`} />
              </div>
              <div className="text-xl font-black text-foreground">{kpi.value}</div>
            </div>
          );
        })}
      </div>

      {/* MAIN NAVIGATION TABS */}
      <div className="border-b-2 border-border flex flex-wrap gap-1 bg-card p-1">
        {[
          { id: 'weekly_schedule', label: 'جدول المهام الأسبوعي', count: null, icon: Calendar },
          { id: 'members', label: 'أعضاء الفريق', count: filteredTeamMembers.length, icon: Users },
          { id: 'requests', label: 'الطلبات والموافقات', count: kpiStats.totalPendingRequests, icon: Clock, badgeColor: 'bg-rose-500 text-white' },
          { id: 'tasks', label: 'المهام والتكليفات', count: teamTasks.length, icon: CheckSquare },
          { id: 'attendance', label: 'الحضور والتوفر', count: `${kpiStats.availableToday}/${filteredTeamMembers.length}`, icon: UserCheck },
          { id: 'performance', label: 'الأداء والنمو', count: kpiStats.incompleteEvals, icon: Award },
          { id: 'investigations_penalties', label: 'التحقيقات والجزاءات', count: teamInvestigations.length + teamPenalties.length, icon: AlertCircle, badgeColor: 'bg-red-600 text-white' },
          { id: 'analytics', label: 'التحليلات والتقارير', count: null, icon: BarChart3 }
        ].map(tab => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-3 font-black text-xs transition-all flex items-center gap-2 border-b-2 -mb-[6px] cursor-pointer ${
                isActive 
                  ? 'border-primary text-primary bg-primary/5' 
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <IconComp className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={`px-2 py-0.5 text-[10px] font-bold ${
                  tab.badgeColor ? tab.badgeColor : isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENTS */}

      {/* TAB 0: WEEKLY TASK SCHEDULE (جدول المهام الأسبوعي) */}
      {activeTab === 'weekly_schedule' && (
        <div className="space-y-4 text-xs font-sans">
          {/* PRINT ONLY STYLES */}
          <style>{`
            @media print {
              body * { visibility: hidden; }
              #weekly-schedule-print-area, #weekly-schedule-print-area * { visibility: visible; }
              #weekly-schedule-print-area { position: absolute; left: 0; top: 0; width: 100%; color: #000; background: #fff; padding: 20px; }
              .no-print { display: none !important; }
            }
          `}</style>

          {/* TOP SUMMARY STATS BAR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 no-print">
            <div className="bg-card p-3 border border-border shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground">عدد الموظفين بالجدول</div>
                <div className="text-lg font-black text-foreground">{weeklyScheduleStats.totalEmployees} موظف</div>
              </div>
              <div className="p-2 bg-primary/10 text-primary border border-primary/20">
                <Users className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-card p-3 border border-border shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground">مهام مسندة من المدير المباشر</div>
                <div className="text-lg font-black text-primary">{weeklyScheduleStats.totalManagerTasks} مهمة</div>
              </div>
              <div className="p-2 bg-primary/10 text-primary border border-primary/20">
                <Shield className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-card p-3 border border-border shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground">المهام المكتملة هذا الأسبوع</div>
                <div className="text-lg font-black text-emerald-600">{weeklyScheduleStats.totalCompletedThisWeek} مهمة مكتملة</div>
              </div>
              <div className="p-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-card p-3 border border-border shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold text-muted-foreground">نسبة الإنجاز الإجمالية</div>
                <div className="text-lg font-black text-foreground">{weeklyScheduleStats.completionRate}%</div>
              </div>
              <div className="p-2 bg-muted text-muted-foreground border border-border">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
            </div>
          </div>

          {/* HEADER / TOOLBAR */}
          <div className="bg-card p-4 border border-border space-y-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 text-primary border border-primary/20">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-foreground">جدول المهام الأسبوعي للموظفين</h2>
                  <p className="text-[11px] font-bold text-muted-foreground">{weekDetails.rangeText}</p>
                </div>
              </div>

              {/* METRICS & ACTIONS */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-black text-xs flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5" />
                  <span>معدل الإنجاز ({weeklyCompletionRate}%)</span>
                </div>

                <button
                  onClick={() => setIsHistoryDrawerOpen(true)}
                  className="px-3 py-1.5 bg-muted/60 hover:bg-muted border border-border text-foreground font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>سجل الأسابيع</span>
                </button>

                <button
                  onClick={() => setShowWeeklyPdfModal(true)}
                  className="px-3.5 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                  title="معاينة وتنزيل جدول المهام الأسبوعي كملف PDF معتمد بشعار واسم المنشأة وتفاصيل التكليفات"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير / تنزيل PDF</span>
                </button>

                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-muted hover:bg-muted/80 border border-border text-foreground font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  title="طباعة مباشرة"
                >
                  <Printer className="w-3.5 h-3.5 text-primary" />
                  <span>طباعة</span>
                </button>

                <button
                  onClick={() => {
                    setWeeklyScheduleDept('all');
                    setSelectedWeeklyDate(new Date().toISOString().split('T')[0]);
                    setSearchTerm('');
                  }}
                  className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط الفلاتر</span>
                </button>
              </div>
            </div>

            {/* FILTER & WEEK CONTROLS BAR */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* DEPARTMENT FILTER */}
              <div className="flex items-center gap-2">
                <label className="font-black text-foreground text-xs shrink-0 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                  <span>الإدارة:</span>
                </label>
                <select
                  value={weeklyScheduleDept}
                  onChange={(e) => setWeeklyScheduleDept(e.target.value)}
                  className="px-3 py-1.5 bg-background border border-border text-foreground font-bold text-xs focus:outline-none focus:border-primary min-w-[180px]"
                >
                  {isExecutive && <option value="all">جميع الإدارات</option>}
                  {weeklyAvailableDepartments.filter(d => d !== 'all').map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* WEEK NAVIGATION */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const d = new Date(selectedWeeklyDate);
                    d.setDate(d.getDate() - 7);
                    setSelectedWeeklyDate(d.toISOString().split('T')[0]);
                  }}
                  className="p-1.5 bg-muted/60 hover:bg-muted border border-border text-foreground transition-all cursor-pointer"
                  title="الأسبوع السابق"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 bg-background border border-border px-2 py-1">
                  <input
                    type="date"
                    value={selectedWeeklyDate}
                    onChange={(e) => e.target.value && setSelectedWeeklyDate(e.target.value)}
                    className="bg-transparent text-foreground font-bold text-xs focus:outline-none cursor-pointer"
                  />
                </div>

                <button
                  onClick={() => {
                    const d = new Date(selectedWeeklyDate);
                    d.setDate(d.getDate() + 7);
                    setSelectedWeeklyDate(d.toISOString().split('T')[0]);
                  }}
                  className="p-1.5 bg-muted/60 hover:bg-muted border border-border text-foreground transition-all cursor-pointer"
                  title="الأسبوع التالي"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setSelectedWeeklyDate(new Date().toISOString().split('T')[0])}
                  className="px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 font-black text-xs transition-all cursor-pointer"
                >
                  الأسبوع الحالي
                </button>
              </div>
            </div>
          </div>

          {/* PRINTABLE CONTAINER & TABLE */}
          <div id="weekly-schedule-print-area" className="bg-card border border-border p-4 space-y-4">
            <div className="hidden print:block text-center space-y-2 mb-4">
              <h1 className="text-xl font-black">جدول المهام الأسبوعي للموظفين</h1>
              <p className="text-sm font-bold text-gray-600">{weekDetails.rangeText}</p>
              <p className="text-xs font-bold text-gray-500">الإدارة: {weeklyScheduleDept === 'all' ? 'جميع الإدارات' : weeklyScheduleDept}</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-right text-xs">
                <thead>
                  <tr className="bg-muted/80 text-foreground border-y-2 border-border font-black">
                    <th className="p-2.5 border border-border text-center w-10">م</th>
                    <th className="p-2.5 border border-border min-w-[160px]">الموظف والإدارة</th>
                    <th className="p-2.5 border border-border min-w-[210px]">المهام الرئيسية (المسندة من المدير)</th>
                    {weekDetails.days.map(d => (
                      <th key={d.key} className="p-2.5 border border-border text-center min-w-[125px]">
                        <div className="text-xs font-black">{d.name}</div>
                        <div className="text-[10px] text-muted-foreground font-normal">{d.dateFormatted}</div>
                      </th>
                    ))}
                    <th className="p-2.5 border border-border min-w-[150px]">المتابعة ونسبة الإنجاز</th>
                    <th className="p-2.5 border border-border text-center w-20 no-print">إجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {weeklyScheduleDept === 'all' && isExecutive ? (
                    // Grouped by Department
                    Array.from(weeklyEmployeesByDept.entries()).map(([deptName, deptEmployees]) => (
                      <React.Fragment key={deptName}>
                        <tr className="bg-primary/10 border-y border-primary/20">
                          <td colSpan={10} className="p-2 font-black text-primary text-xs flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            <span>{deptName} ({deptEmployees.length} موظفاً)</span>
                          </td>
                        </tr>
                        {deptEmployees.map((emp, idx) => {
                          const storeKey = `${emp.id}_${weekDetails.sundayIso}`;
                          const entry = weeklyStore[storeKey];
                          const managerTasks = getManagerAssignedTasks(emp);

                          return (
                            <tr key={emp.id} className="hover:bg-muted/30 border-b border-border/60 transition-colors">
                              <td className="p-2 border border-border text-center font-bold text-muted-foreground w-10">{idx + 1}</td>
                              
                              {/* Employee & Quick Assign */}
                              <td className="p-2 border border-border font-bold min-w-[160px]">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-primary/10 text-primary font-black flex items-center justify-center text-xs border border-primary/20 shrink-0 rounded-xs">
                                      {emp.name ? emp.name.charAt(0) : 'U'}
                                    </div>
                                    <div className="overflow-hidden">
                                      <div className="text-foreground font-black text-xs truncate">{emp.name}</div>
                                      <div className="text-[10px] text-muted-foreground font-normal truncate">{(emp as any).jobTitle || getEmpDepartmentName(emp)}</div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setNewTaskTargetEmpId(emp.id);
                                      setIsAssignTaskModalOpen(true);
                                    }}
                                    className="w-full px-2 py-1 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-[10px] font-black flex items-center justify-center gap-1 transition-all no-print cursor-pointer"
                                    title="إسناد مهمة جديدة للموظف من المدير المباشر"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>تكليف مهمة جديدة</span>
                                  </button>
                                </div>
                              </td>

                              {/* Main Tasks Column (المهام الرئيسية المسندة من المدير المباشر) */}
                              <td className="p-2 border border-border min-w-[210px] max-w-[260px] align-top">
                                <div className="space-y-2">
                                  <div className="inline-flex items-center gap-1 text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 border border-primary/20">
                                    <Shield className="w-3 h-3 text-primary shrink-0" />
                                    <span>مسندة من المدير ({managerTasks.length})</span>
                                  </div>

                                  {managerTasks.length > 0 ? (
                                    <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                      {managerTasks.map(t => {
                                        const isDone = t.status === 'Executed' || (t.status as string) === 'Completed' || t.status === 'Approved';
                                        return (
                                          <div 
                                            key={t.id} 
                                            onClick={() => setViewingTaskDetails(t)}
                                            className={`p-2 border text-[11px] leading-snug space-y-1 transition-all cursor-pointer hover:border-primary/60 hover:shadow-xs group ${
                                              isDone 
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200' 
                                                : 'bg-card border-border/80 text-foreground hover:bg-muted/40'
                                            }`}
                                            title="انقر لعرض تفاصيل المهمة وتتبع التنفيذ والمهام الحالية"
                                          >
                                            <div className="flex items-start justify-between gap-1">
                                              <span className="font-bold flex items-center gap-1 group-hover:text-primary transition-colors">
                                                {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                                <span className="line-clamp-2">{t.title}</span>
                                              </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1 text-[9px] font-bold">
                                              <span className={`px-1 py-0.2 ${isDone ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'}`}>
                                                {isDone ? 'منفذة' : 'قيد التنفيذ'}
                                              </span>
                                              {t.priority && (
                                                <span className="bg-muted px-1 text-muted-foreground">{t.priority}</span>
                                              )}
                                              <span className="text-[8px] text-primary/70 mr-auto opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                                                عرض وتتبع ↗
                                              </span>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="p-2 bg-muted/30 border border-dashed border-border text-muted-foreground text-[10px] font-bold space-y-1">
                                      <p>{entry?.mainTask || 'لا توجد مهام رئيسية مسندة حالياً من المدير.'}</p>
                                      <button 
                                        onClick={() => { setNewTaskTargetEmpId(emp.id); setIsAssignTaskModalOpen(true); }}
                                        className="text-[9px] text-primary cursor-pointer hover:underline flex items-center gap-1 font-bold pt-1"
                                      >
                                        <Plus className="w-2.5 h-2.5" /> إضافة مهمة رئيسية
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Days Columns (Completed Tasks on that specific day) */}
                              {weekDetails.days.map(d => {
                                const completedTasks = getCompletedDayTasksObjects(emp, d.key, d.isoDate, entry);
                                return (
                                  <td key={d.key} className="p-2 border border-border text-[11px] min-w-[125px] max-w-[155px] align-top">
                                    {completedTasks.length > 0 ? (
                                      <div className="space-y-1.5">
                                        <div className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/30">
                                          <CheckSquare className="w-3 h-3 text-emerald-500 shrink-0" />
                                          <span>{completedTasks.length} مكتملة</span>
                                        </div>

                                        <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                                          {completedTasks.map((ct: any) => {
                                            const fullTaskObj = ct.taskObj || projectTasks.find(pt => pt.id === ct.id || pt.id === ct.taskId) || ct;
                                            return (
                                              <div 
                                                key={ct.id} 
                                                onClick={() => setViewingTaskDetails(fullTaskObj)}
                                                className="p-1.5 bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-500 hover:shadow-xs text-foreground font-bold text-[10px] leading-snug space-y-1 rounded-sm cursor-pointer transition-all group"
                                                title="انقر لعرض تفاصيل المهمة وتتبع التنفيذ"
                                              >
                                                <div className="flex items-start gap-1 text-emerald-800 dark:text-emerald-200 group-hover:text-emerald-600">
                                                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                                  <span className="font-bold leading-tight">{ct.title}</span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1 text-[8px] font-black">
                                                  {ct.completionTimeFormatted && (
                                                    <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-1 py-0.2">
                                                      ⏰ {ct.completionTimeFormatted}
                                                    </span>
                                                  )}
                                                  {ct.estimatedHours ? (
                                                    <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-1 py-0.2">
                                                      ⏳ {ct.estimatedHours} س
                                                    </span>
                                                  ) : null}
                                                  {ct.delayInfo?.isDelayed ? (
                                                    <span className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 px-1 py-0.2">
                                                      ⚠️ تأخير {ct.delayInfo.delayHours > 0 ? `${ct.delayInfo.delayHours} س` : `${ct.delayInfo.delayMinutes} د`}
                                                    </span>
                                                  ) : ct.delayInfo?.status === 'completed_on_time' ? (
                                                    <span className="bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40 px-1 py-0.2">
                                                      ⚡ في الموعد
                                                    </span>
                                                  ) : null}
                                                  {ct.isManagerTask && (
                                                    <span className="bg-primary/20 text-primary border border-primary/30 px-1 py-0.2">
                                                      من المدير
                                                    </span>
                                                  )}
                                                  {ct.projectName && (
                                                    <span className="bg-muted text-muted-foreground px-1 py-0.2 truncate max-w-[90px]">
                                                      {ct.projectName}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-center py-4 text-muted-foreground/30 font-bold text-[11px]">
                                        —
                                      </div>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Follow Up & Progress */}
                              <td className="p-2.5 border border-border min-w-[150px] align-top">
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px] font-black">
                                    <span className="text-muted-foreground">نسبة الإنجاز:</span>
                                    <span className="text-primary">{entry?.progress || 0}%</span>
                                  </div>
                                  <div className="w-full bg-muted h-2 border border-border overflow-hidden">
                                    <div 
                                      className="bg-primary h-full transition-all duration-300"
                                      style={{ width: `${entry?.progress || 0}%` }}
                                    />
                                  </div>

                                  <div className="text-[10px] font-medium text-foreground bg-muted/30 p-1.5 border border-border/60 leading-snug">
                                    {entry?.followUp || 'لم تُسجل ملاحظات متابعة بعد.'}
                                  </div>

                                  {entry?.status && (
                                    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-black border ${
                                      entry.status === 'Completed' || entry.status === 'Executed' 
                                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' 
                                        : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                    }`}>
                                      {entry.status === 'Completed' || entry.status === 'Executed' ? 'منفذة بالكامل' : 'قيد التنفيذ والمتابعة'}
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="p-2 border border-border text-center align-middle no-print w-20">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleOpenWeeklyTaskEdit(emp)}
                                    className="p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer border border-primary/20"
                                    title="تعديل جدول الأسبوع والمتابعة"
                                  >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setNewTaskTargetEmpId(emp.id);
                                      setIsAssignTaskModalOpen(true);
                                    }}
                                    className="p-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer border border-emerald-500/20"
                                    title="إسناد مهمة جديدة للموظف"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  ) : (
                    // Single Selected Department or Direct Manager's Team
                    weeklyEmployeesInView.map((emp, idx) => {
                      const storeKey = `${emp.id}_${weekDetails.sundayIso}`;
                      const entry = weeklyStore[storeKey];
                      const managerTasks = getManagerAssignedTasks(emp);

                      return (
                        <tr key={emp.id} className="hover:bg-muted/30 border-b border-border/60 transition-colors">
                          <td className="p-2 border border-border text-center font-bold text-muted-foreground w-10">{idx + 1}</td>
                          
                          {/* Employee & Quick Assign */}
                          <td className="p-2 border border-border font-bold min-w-[160px]">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-primary/10 text-primary font-black flex items-center justify-center text-xs border border-primary/20 shrink-0 rounded-xs">
                                  {emp.name ? emp.name.charAt(0) : 'U'}
                                </div>
                                <div className="overflow-hidden">
                                  <div className="text-foreground font-black text-xs truncate">{emp.name}</div>
                                  <div className="text-[10px] text-muted-foreground font-normal truncate">{(emp as any).jobTitle || getEmpDepartmentName(emp)}</div>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setNewTaskTargetEmpId(emp.id);
                                  setIsAssignTaskModalOpen(true);
                                }}
                                className="w-full px-2 py-1 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-[10px] font-black flex items-center justify-center gap-1 transition-all no-print cursor-pointer"
                                title="إسناد مهمة جديدة للموظف من المدير المباشر"
                              >
                                <Plus className="w-3 h-3" />
                                <span>تكليف مهمة جديدة</span>
                              </button>
                            </div>
                          </td>

                          {/* Main Tasks Column (المهام الرئيسية المسندة من المدير المباشر) */}
                          <td className="p-2 border border-border min-w-[210px] max-w-[260px] align-top">
                            <div className="space-y-2">
                              <div className="inline-flex items-center gap-1 text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 border border-primary/20">
                                <Shield className="w-3 h-3 text-primary shrink-0" />
                                <span>مسندة من المدير ({managerTasks.length})</span>
                              </div>

                              {managerTasks.length > 0 ? (
                                <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
                                  {managerTasks.map(t => {
                                    const isDone = t.status === 'Executed' || (t.status as string) === 'Completed' || t.status === 'Approved';
                                    return (
                                      <div 
                                        key={t.id} 
                                        onClick={() => setViewingTaskDetails(t)}
                                        className={`p-2 border text-[11px] leading-snug space-y-1 transition-all cursor-pointer hover:border-primary/60 hover:shadow-xs group ${
                                          isDone 
                                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200' 
                                            : 'bg-card border-border/80 text-foreground hover:bg-muted/40'
                                        }`}
                                        title="انقر لعرض تفاصيل المهمة وتتبع التنفيذ والمهام الحالية"
                                      >
                                        <div className="flex items-start justify-between gap-1">
                                          <span className="font-bold flex items-center gap-1 group-hover:text-primary transition-colors">
                                            {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                                            <span className="line-clamp-2">{t.title}</span>
                                          </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-1 text-[9px] font-bold">
                                          <span className={`px-1 py-0.2 ${isDone ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'}`}>
                                            {isDone ? 'منفذة' : 'قيد التنفيذ'}
                                          </span>
                                          {t.priority && (
                                            <span className="bg-muted px-1 text-muted-foreground">{t.priority}</span>
                                          )}
                                          <span className="text-[8px] text-primary/70 mr-auto opacity-0 group-hover:opacity-100 transition-opacity font-bold">
                                            عرض وتتبع ↗
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="p-2 bg-muted/30 border border-dashed border-border text-muted-foreground text-[10px] font-bold space-y-1">
                                  <p>{entry?.mainTask || 'لا توجد مهام رئيسية مسندة حالياً من المدير.'}</p>
                                  <button 
                                    onClick={() => { setNewTaskTargetEmpId(emp.id); setIsAssignTaskModalOpen(true); }}
                                    className="text-[9px] text-primary cursor-pointer hover:underline flex items-center gap-1 font-bold pt-1"
                                  >
                                    <Plus className="w-2.5 h-2.5" /> إضافة مهمة رئيسية
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Days Columns (Completed Tasks on that specific day) */}
                          {weekDetails.days.map(d => {
                            const completedTasks = getCompletedDayTasksObjects(emp, d.key, d.isoDate, entry);
                            return (
                              <td key={d.key} className="p-2 border border-border text-[11px] min-w-[125px] max-w-[155px] align-top">
                                {completedTasks.length > 0 ? (
                                  <div className="space-y-1.5">
                                    <div className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 border border-emerald-500/30">
                                      <CheckSquare className="w-3 h-3 text-emerald-500 shrink-0" />
                                      <span>{completedTasks.length} مكتملة</span>
                                    </div>

                                    <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                                      {completedTasks.map((ct: any) => {
                                        const fullTaskObj = ct.taskObj || projectTasks.find(pt => pt.id === ct.id || pt.id === ct.taskId) || ct;
                                        return (
                                          <div 
                                            key={ct.id} 
                                            onClick={() => setViewingTaskDetails(fullTaskObj)}
                                            className="p-1.5 bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 hover:border-emerald-500 hover:shadow-xs text-foreground font-bold text-[10px] leading-snug space-y-1 rounded-sm cursor-pointer transition-all group"
                                            title="انقر لعرض تفاصيل المهمة وتتبع التنفيذ"
                                          >
                                            <div className="flex items-start gap-1 text-emerald-800 dark:text-emerald-200 group-hover:text-emerald-600">
                                              <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                                              <span className="font-bold leading-tight">{ct.title}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1 text-[8px] font-black">
                                              {ct.completionTimeFormatted && (
                                                <span className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-1 py-0.2">
                                                  ⏰ {ct.completionTimeFormatted}
                                                </span>
                                              )}
                                              {ct.estimatedHours ? (
                                                <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-1 py-0.2">
                                                  ⏳ {ct.estimatedHours} س
                                                </span>
                                              ) : null}
                                              {ct.delayInfo?.isDelayed ? (
                                                <span className="bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 px-1 py-0.2">
                                                  ⚠️ تأخير {ct.delayInfo.delayHours > 0 ? `${ct.delayInfo.delayHours} س` : `${ct.delayInfo.delayMinutes} د`}
                                                </span>
                                              ) : ct.delayInfo?.status === 'completed_on_time' ? (
                                                <span className="bg-emerald-500/25 text-emerald-800 dark:text-emerald-200 border border-emerald-500/40 px-1 py-0.2">
                                                  ⚡ في الموعد
                                                </span>
                                              ) : null}
                                              {ct.isManagerTask && (
                                                <span className="bg-primary/20 text-primary border border-primary/30 px-1 py-0.2">
                                                  من المدير
                                                </span>
                                              )}
                                              {ct.projectName && (
                                                <span className="bg-muted text-muted-foreground px-1 py-0.2 truncate max-w-[90px]">
                                                  {ct.projectName}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-4 text-muted-foreground/30 font-bold text-[11px]">
                                    —
                                  </div>
                                )}
                              </td>
                            );
                          })}

                          {/* Follow Up & Progress */}
                          <td className="p-2.5 border border-border min-w-[150px] align-top">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] font-black">
                                <span className="text-muted-foreground">نسبة الإنجاز:</span>
                                <span className="text-primary">{entry?.progress || 0}%</span>
                              </div>
                              <div className="w-full bg-muted h-2 border border-border overflow-hidden">
                                <div 
                                  className="bg-primary h-full transition-all duration-300"
                                  style={{ width: `${entry?.progress || 0}%` }}
                                />
                              </div>

                              <div className="text-[10px] font-medium text-foreground bg-muted/30 p-1.5 border border-border/60 leading-snug">
                                {entry?.followUp || 'لم تُسجل ملاحظات متابعة بعد.'}
                              </div>

                              {entry?.status && (
                                <span className={`inline-block px-1.5 py-0.5 text-[9px] font-black border ${
                                  entry.status === 'Completed' || entry.status === 'Executed' 
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' 
                                    : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                                }`}>
                                  {entry.status === 'Completed' || entry.status === 'Executed' ? 'منفذة بالكامل' : 'قيد التنفيذ والمتابعة'}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="p-2 border border-border text-center align-middle no-print w-20">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenWeeklyTaskEdit(emp)}
                                className="p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all cursor-pointer border border-primary/20"
                                title="تعديل جدول الأسبوع والمتابعة"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setNewTaskTargetEmpId(emp.id);
                                  setIsAssignTaskModalOpen(true);
                                }}
                                className="p-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all cursor-pointer border border-emerald-500/20"
                                title="إسناد مهمة جديدة للموظف"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {weeklyEmployeesInView.length === 0 && (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-muted-foreground font-bold">
                        لا يوجد موظفون مسجلون في هذه الإدارة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* WEEKLY TASK EDIT MODAL */}
          <AnimatePresence>
            {editingWeeklyTaskEmp && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-card border-2 border-border p-6 max-w-2xl w-full space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]"
                  dir="rtl"
                >
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-black text-foreground text-sm flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-primary" />
                      تعديل المهام الأسبوعية — {editingWeeklyTaskEmp.name}
                    </h3>
                    <button
                      onClick={() => setEditingWeeklyTaskEmp(null)}
                      className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveWeeklyTask} className="space-y-4 text-xs font-bold">
                    <div>
                      <label className="block text-foreground mb-1">المهام الرئيسية للأسبوع:</label>
                      <textarea
                        rows={2}
                        value={weeklyTaskForm.mainTask}
                        onChange={(e) => setWeeklyTaskForm({ ...weeklyTaskForm, mainTask: e.target.value })}
                        className="w-full p-2 bg-background border border-border text-foreground font-semibold focus:outline-none focus:border-primary"
                        placeholder="أدخل المهام الرئيسية المكلف بها الموظف..."
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-foreground mb-1">الأحد ({weekDetails.days[0].dateFormatted}):</label>
                        <input
                          type="text"
                          value={weeklyTaskForm.sunTask}
                          onChange={(e) => setWeeklyTaskForm({ ...weeklyTaskForm, sunTask: e.target.value })}
                          className="w-full p-2 bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                          placeholder="مهمة الأحد..."
                        />
                      </div>

                      <div>
                        <label className="block text-foreground mb-1">الاثنين ({weekDetails.days[1].dateFormatted}):</label>
                        <input
                          type="text"
                          value={weeklyTaskForm.monTask}
                          onChange={(e) => setWeeklyTaskForm({ ...weeklyTaskForm, monTask: e.target.value })}
                          className="w-full p-2 bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                          placeholder="مهمة الاثنين..."
                        />
                      </div>

                      <div>
                        <label className="block text-foreground mb-1">الثلاثاء ({weekDetails.days[2].dateFormatted}):</label>
                        <input
                          type="text"
                          value={weeklyTaskForm.tueTask}
                          onChange={(e) => setWeeklyTaskForm({ ...weeklyTaskForm, tueTask: e.target.value })}
                          className="w-full p-2 bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                          placeholder="مهمة الثلاثاء..."
                        />
                      </div>

                      <div>
                        <label className="block text-foreground mb-1">الأربعاء ({weekDetails.days[3].dateFormatted}):</label>
                        <input
                          type="text"
                          value={weeklyTaskForm.wedTask}
                          onChange={(e) => setWeeklyTaskForm({ ...weeklyTaskForm, wedTask: e.target.value })}
                          className="w-full p-2 bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                          placeholder="مهمة الأربعاء..."
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-foreground mb-1">الخميس ({weekDetails.days[4].dateFormatted}):</label>
                      <input
                        type="text"
                        value={weeklyTaskForm.thuTask}
                        onChange={(e) => setWeeklyTaskForm({ ...weeklyTaskForm, thuTask: e.target.value })}
                        className="w-full p-2 bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                        placeholder="مهمة الخميس..."
                      />
                    </div>

                    <div>
                      <label className="block text-foreground mb-1">المتابعة المستمرة / ملاحظات:</label>
                      <textarea
                        rows={2}
                        value={weeklyTaskForm.followUp}
                        onChange={(e) => setWeeklyTaskForm({ ...weeklyTaskForm, followUp: e.target.value })}
                        className="w-full p-2 bg-background border border-border text-foreground focus:outline-none focus:border-primary"
                        placeholder="ملاحظات المتابعة والتنفيذ..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-foreground mb-1">حالة المهمة:</label>
                        <select
                          value={weeklyTaskForm.status}
                          onChange={(e) => setWeeklyTaskForm({ ...weeklyTaskForm, status: e.target.value })}
                          className="w-full p-2 bg-background border border-border text-foreground font-bold focus:outline-none focus:border-primary"
                        >
                          <option value="In Progress">قيد التنفيذ</option>
                          <option value="Executed">منفذة / مكتملة</option>
                          <option value="Pending">معلقة / بانتظار الاعتماد</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-foreground mb-1">نسبة الإنجاز ({weeklyTaskForm.progress}%):</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="10"
                          value={weeklyTaskForm.progress}
                          onChange={(e) => setWeeklyTaskForm({ ...weeklyTaskForm, progress: Number(e.target.value) })}
                          className="w-full mt-2 accent-primary cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={() => setEditingWeeklyTaskEmp(null)}
                        className="px-4 py-2 bg-muted text-muted-foreground hover:bg-muted/80 font-bold transition-all cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-primary text-primary-foreground font-black hover:bg-primary/90 transition-all cursor-pointer shadow-sm"
                      >
                        حفظ الجدول الأسبوعي
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* HISTORY DRAWER (سجل الأسابيع) */}
          <AnimatePresence>
            {isHistoryDrawerOpen && (
              <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs no-print">
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="w-full max-w-md bg-card border-l-2 border-border h-full p-6 space-y-4 shadow-2xl overflow-y-auto"
                  dir="rtl"
                >
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="font-black text-foreground text-sm flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary" />
                      سجل الأسابيع الموثقة
                    </h3>
                    <button
                      onClick={() => setIsHistoryDrawerOpen(false)}
                      className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-muted-foreground text-[11px] font-bold">اختر الأسبوع لعرض واستعراض سجل المهام المسجلة له:</p>
                    {pastWeeksList.map((wk) => (
                      <button
                        key={wk.iso}
                        onClick={() => {
                          setSelectedWeeklyDate(wk.iso);
                          setIsHistoryDrawerOpen(false);
                        }}
                        className={`w-full p-3 text-right border transition-all cursor-pointer flex items-center justify-between ${
                          selectedWeeklyDate === wk.iso
                            ? 'bg-primary/10 border-primary text-primary font-black'
                            : 'bg-muted/40 hover:bg-muted border-border text-foreground font-bold'
                        }`}
                      >
                        <span className="text-xs">{wk.label}</span>
                        {wk.isCurrent && (
                          <span className="px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold">الحالي</span>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* TAB 1: TEAM MEMBERS (أعضاء الفريق) */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 bg-card p-4 border border-border">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              قائمة أعضاء الفريق ({filteredTeamMembers.length} موظفاً)
            </h3>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setMembersViewMode('grid')}
                className={`p-2 border text-xs font-bold transition-all ${membersViewMode === 'grid' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}
                title="عرض بطاقات"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMembersViewMode('table')}
                className={`p-2 border text-xs font-bold transition-all ${membersViewMode === 'table' ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}
                title="عرض جدول"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Cards View */}
          {membersViewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTeamMembers.map(emp => {
                const todaySt = getEmpTodayStatus(emp);
                const empOpenTasks = teamTasks.filter(t => (t.assignedToId === emp.id || t.assignedToId === emp.employeeId) && t.status !== 'Executed').length;
                const empOverdueTasks = teamTasks.filter(t => (t.assignedToId === emp.id || t.assignedToId === emp.employeeId) && t.status !== 'Executed' && (t as any).dueDate && (t as any).dueDate < todayStr).length;
                const empPendingReqs = unifiedRequests.filter(r => (r.employeeId === emp.id || r.employeeId === emp.employeeId) && (r.status === 'Pending' || r.status === 'PendingManager')).length;

                return (
                  <div key={emp.id} className="bg-card border-2 border-border p-5 space-y-4 shadow-sm hover:border-primary transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-primary text-base">
                          {emp.name ? emp.name.charAt(0) : 'E'}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-foreground">{emp.name}</h4>
                          <span className="text-[11px] font-bold text-muted-foreground block mt-0.5">#{emp.employeeId || 'N/A'} • {emp.jobTitle || 'عضو بالفريق'}</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-bold border ${todaySt.color}`}>
                        {todaySt.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold bg-muted/40 p-3 border border-border">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">الإدارة:</span>
                        <span className="font-bold text-foreground">{getEmpDepartmentName(emp)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">الموقع / الفرع:</span>
                        <span className="font-bold text-foreground">{emp.branchId || 'المقر الرئيسي'}</span>
                      </div>
                      <div className="col-span-1 border-t border-border/50 pt-1.5">
                        <span className="text-muted-foreground block text-[10px]">بدء العمل:</span>
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">{todaySt.checkInTime || 'لم يسجل البدء'}</span>
                      </div>
                      <div className="col-span-1 border-t border-border/50 pt-1.5">
                        <span className="text-muted-foreground block text-[10px]">الانصراف:</span>
                        <span className="font-mono font-bold text-primary text-xs">{todaySt.checkOutTime || 'لم يسجل الانصراف'}</span>
                      </div>
                    </div>

                    {/* Task & Requests stats */}
                    <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                      <div className="p-2 bg-muted border border-border">
                        <span className="text-muted-foreground block">مهام مفتوحة</span>
                        <span className="text-xs text-foreground font-black">{empOpenTasks}</span>
                      </div>
                      <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-600">
                        <span className="block">متأخرة</span>
                        <span className="text-xs font-black">{empOverdueTasks}</span>
                      </div>
                      <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-600">
                        <span className="block">طلبات معلقة</span>
                        <span className="text-xs font-black">{empPendingReqs}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-border flex items-center gap-2">
                      <button
                        onClick={() => { setSelectedEmployee(emp); setEmpDrawerTab('info'); }}
                        className="flex-1 py-2 bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        الملف الكامل
                      </button>
                      <button
                        onClick={() => { setNewTaskTargetEmpId(emp.id); setIsAssignTaskModalOpen(true); }}
                        className="p-2 bg-muted text-muted-foreground border border-border font-bold text-xs hover:bg-muted/80 transition-all"
                        title="إسناد مهمة"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setAlertTargetEmp(emp); setIsAlertModalOpen(true); }}
                        className="p-2 bg-amber-500/10 text-amber-600 border border-amber-500/20 font-bold text-xs hover:bg-amber-500/20 transition-all cursor-pointer"
                        title="إرسال تنبيه"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="bg-card border-2 border-border overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-muted border-b border-border font-black text-muted-foreground">
                    <th className="p-3">الموظف</th>
                    <th className="p-3">الرقم الوظيفي</th>
                    <th className="p-3">المسمى الوظيفي</th>
                    <th className="p-3">الإدارة والقسم</th>
                    <th className="p-3">الحالة اليوم</th>
                    <th className="p-3">المهام المفتوحة</th>
                    <th className="p-3">الطلبات المعلقة</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {filteredTeamMembers.map(emp => {
                    const todaySt = getEmpTodayStatus(emp);
                    const empOpenTasks = teamTasks.filter(t => (t.assignedToId === emp.id || t.assignedToId === emp.employeeId) && t.status !== 'Executed').length;
                    const empPendingReqs = unifiedRequests.filter(r => (r.employeeId === emp.id || r.employeeId === emp.employeeId) && (r.status === 'Pending' || r.status === 'PendingManager')).length;

                    return (
                      <tr key={emp.id} className="hover:bg-muted/30">
                        <td className="p-3 font-bold text-foreground flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary/10 text-primary font-bold flex items-center justify-center border border-primary/20">
                            {emp.name ? emp.name.charAt(0) : 'E'}
                          </div>
                          {emp.name}
                        </td>
                        <td className="p-3 text-muted-foreground font-mono">{emp.employeeId || '---'}</td>
                        <td className="p-3 text-foreground font-semibold">{emp.jobTitle || 'عضو بالفريق'}</td>
                        <td className="p-3 text-muted-foreground">{getEmpDepartmentName(emp)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold border ${todaySt.color}`}>
                            {todaySt.label}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-foreground">{empOpenTasks}</td>
                        <td className="p-3 font-bold text-amber-600">{empPendingReqs}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => { setSelectedEmployee(emp); setEmpDrawerTab('info'); }}
                              className="px-2.5 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 cursor-pointer rounded"
                            >
                              عرض التفاصيل
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
      )}

      {/* TAB 2: REQUESTS & APPROVALS (الطلبات والموافقات) */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="bg-card border border-border p-4 flex flex-wrap items-center justify-between gap-4">
            {/* Filter Categories */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">نوع الطلب:</span>
              {[
                { id: 'all', label: 'الكل' },
                { id: 'leave', label: 'الإجازات' },
                { id: 'wfh', label: 'العمل من المنزل' },
                { id: 'mission', label: 'المأموريات' },
                { id: 'penalty', label: 'الجزاءات والإجراءات' }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setRequestsTypeFilter(cat.id)}
                  className={`px-3 py-1.5 text-xs font-bold border ${requestsTypeFilter === cat.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Filter Status */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">الحالة:</span>
              {[
                { id: 'all', label: 'الكل' },
                { id: 'pending', label: 'قيد المراجعة / ينتظر موافقتي' },
                { id: 'approved', label: 'معتمد' },
                { id: 'rejected', label: 'مرفوض' }
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setRequestsStatusFilter(st.id)}
                  className={`px-3 py-1.5 text-xs font-bold border ${requestsStatusFilter === st.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Requests List */}
          <div className="space-y-3">
            {filteredUnifiedRequests.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border text-muted-foreground font-semibold text-xs">
                لا توجد طلبات تطابق الفلاتر المحددة حالياً.
              </div>
            ) : (
              filteredUnifiedRequests.map(req => {
                const isPending = req.status === 'Pending' || req.status === 'PendingManager';
                const isMission = req.category === 'mission' || req.entity === 'missions';
                
                const rawEval = req.originalObj?.evaluation;
                const evalData: MissionEvaluation | null = rawEval 
                  ? (typeof rawEval === 'string' ? JSON.parse(rawEval) : rawEval)
                  : null;

                const isCompletedMission = isMission && (req.status === 'Completed' || req.status === 'Executed');

                return (
                  <div key={req.id} className="bg-card border-2 border-border p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm hover:border-primary transition-all">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold">
                          {req.type}
                        </span>
                        <h4 className="text-sm font-black text-foreground">{req.employeeName}</h4>
                        <span className="text-xs text-muted-foreground font-bold">• {req.department}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold border ${
                          isCompletedMission ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
                          isPending ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' :
                          req.status === 'Approved' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                          'bg-rose-500/10 text-rose-600 border-rose-500/30'
                        }`}>
                          {isCompletedMission ? 'مكتملة ومُقيّمة' : isPending ? 'بانتظار موافقتك' : req.status === 'Approved' ? 'معتمدة' : 'مرفوضة'}
                        </span>

                        {isMission && evalData && (
                          <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-[11px] font-mono font-black flex items-center gap-1">
                            <Award className="w-3.5 h-3.5 text-amber-500" />
                            تقييم المأمورية: {evalData.finalScore}% ({evalData.ratingGrade || 'مكتمل'})
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-foreground/80 font-medium">
                        السبب / البيان: {req.reason}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-bold">
                        <span>الفترة: من {req.startDate} إلى {req.endDate}</span>
                        <span>تاريخ التقديم: {req.createdAt?.split('T')[0] || req.startDate}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-border flex-wrap">
                      {isMission && (
                        <button
                          type="button"
                          onClick={() => setEvaluatingMission({ ...req.originalObj, employeeName: req.employeeName, department: req.department, type: req.type, reason: req.reason, rawId: req.rawId })}
                          className="px-4 py-2 bg-primary text-primary-foreground font-black text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
                        >
                          <Award className="w-4 h-4 text-amber-300" />
                          {evalData ? 'تعديل / عرض تقييم المأمورية' : 'إكمال المأمورية وتقييم الموظف'}
                        </button>
                      )}

                      {isPending ? (
                        <>
                          <button
                            onClick={() => handleOpenDecisionModal(req, 'approve')}
                            className="px-4 py-2 bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            اعتماد
                          </button>
                          <button
                            onClick={() => handleOpenDecisionModal(req, 'reject')}
                            className="px-4 py-2 bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <ThumbsDown className="w-3.5 h-3.5" />
                            رفض
                          </button>
                          <button
                            onClick={() => handleOpenDecisionModal(req, 'needs_info')}
                            className="px-3 py-2 bg-muted text-muted-foreground border border-border font-bold text-xs hover:bg-muted/80"
                          >
                            طلب استكمال
                          </button>
                        </>
                      ) : !isMission ? (
                        <span className="text-xs font-bold text-muted-foreground">تمت المراجعة</span>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: TASKS (المهام والتكليفات) */}
      {activeTab === 'tasks' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 border border-border">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-primary" />
              إدارة مهام وتكليفات الفريق ({displayTeamTasks.length} من {teamTasks.length} مهمة)
            </h3>

            {/* Tasks Filters & View Mode Switches */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">الموظف:</span>
                <select
                  value={selectedEmployeeTaskFilter}
                  onChange={e => setSelectedEmployeeTaskFilter(e.target.value)}
                  className="px-2 py-1 bg-background border border-border text-xs font-bold"
                >
                  <option value="all">الكل ({filteredTeamMembers.length})</option>
                  {filteredTeamMembers.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">الإدارة:</span>
                <select
                  value={taskDeptFilter}
                  onChange={e => setTaskDeptFilter(e.target.value)}
                  className="px-2 py-1 bg-background border border-border text-xs font-bold"
                >
                  <option value="all">جميع الإدارات</option>
                  {departmentBreakdown.map(d => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">الحالة:</span>
                <select
                  value={taskStatusFilter}
                  onChange={e => setTaskStatusFilter(e.target.value)}
                  className="px-2 py-1 bg-background border border-border text-xs font-bold"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="In Progress">قيد التنفيذ</option>
                  <option value="Executed">مكتملة ومستلمة</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">الأولوية:</span>
                <select
                  value={taskPriorityFilter}
                  onChange={e => setTaskPriorityFilter(e.target.value)}
                  className="px-2 py-1 bg-background border border-border text-xs font-bold"
                >
                  <option value="all">جميع الأولويات</option>
                  <option value="High">عالية جداً (High)</option>
                  <option value="Medium">متوسطة (Medium)</option>
                  <option value="Low">منخفضة (Low)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-muted-foreground">الاستحقاق:</span>
                <input
                  type="date"
                  value={taskDueDateFilter}
                  onChange={e => setTaskDueDateFilter(e.target.value)}
                  className="px-2 py-1 bg-background border border-border text-xs font-bold"
                />
                {taskDueDateFilter && (
                  <button onClick={() => setTaskDueDateFilter('')} className="text-xs text-rose-500 font-bold hover:underline cursor-pointer">مسح</button>
                )}
              </div>

              <div className="flex items-center gap-1 border-r border-border pr-3 mr-1">
                {[
                  { id: 'kanban', label: 'كانبان' },
                  { id: 'table', label: 'جدول' },
                  { id: 'eisenhower', label: 'مصفوفة الأولويات' },
                  { id: 'completed', label: 'المهام المنتهية' }
                ].map(vm => (
                  <button
                    key={vm.id}
                    onClick={() => setTasksViewMode(vm.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold border ${tasksViewMode === vm.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}
                  >
                    {vm.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks Content according to View Mode */}
          {tasksViewMode === 'kanban' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { status: 'In Progress', title: 'قيد التنفيذ', color: 'border-blue-500' },
                { status: 'Under Review', title: 'قيد المراجعة والتدقيق', color: 'border-amber-500' },
                { status: 'Executed', title: 'مكتملة', color: 'border-emerald-500' }
              ].map(col => {
                const colTasks = displayTeamTasks.filter(t => t.status === col.status || (col.status === 'In Progress' && !['Executed', 'Approved', 'Completed', 'Under Review'].includes(t.status)));
                return (
                  <div key={col.status} className={`bg-card border-t-4 ${col.color} border-x border-b border-border p-4 space-y-3`}>
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <h4 className="text-xs font-black text-foreground">{col.title}</h4>
                      <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-bold">{colTasks.length}</span>
                    </div>

                    <div className="space-y-3 min-h-[300px]">
                      {colTasks.map(t => {
                        const isOverdue = t.status !== 'Executed' && (t.status as string) !== 'Completed' && (t as any).dueDate && (t as any).dueDate < todayStr;

                        return (
                          <div key={t.id} className="p-3 bg-muted/40 border border-border space-y-2 hover:border-primary transition-all relative group">
                            <div className="flex items-start justify-between gap-2">
                              <h5 className="text-xs font-black text-foreground">{t.title}</h5>
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 text-[9px] font-bold ${
                                  t.priority === 'High' || t.priority === 'Critical' ? 'bg-rose-500/10 text-rose-600' : 'bg-muted text-muted-foreground'
                                }`}>
                                  {t.priority === 'High' || t.priority === 'Critical' ? 'عاجل' : 'عادي'}
                                </span>
                                <button
                                  onClick={() => handleOpenEditTaskModal(t)}
                                  className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold hover:bg-primary hover:text-white transition-all"
                                >
                                  تعديل
                                </button>
                              </div>
                            </div>
                            {t.description && <p className="text-[11px] text-muted-foreground line-clamp-2">{t.description}</p>}

                            {/* Project / Personal Badge */}
                            <div className="pt-1 flex items-center gap-1.5">
                              {((t as any).subPhase === 'personal' || (t as any).subPhase === 'Personal' || (t as any).phase === 'Personal') ? (
                                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-bold">
                                  👤 مهمة شخصية (إدارة الوقت)
                                </span>
                              ) : (() => {
                                const linkedProj = projects.find(p => p.id === t.projectId);
                                return linkedProj ? (
                                  <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 text-[9px] font-bold">
                                    📁 {linkedProj.name}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-muted text-muted-foreground border border-border text-[9px] font-bold">
                                    📌 تكليف مباشر (بدون مشروع)
                                  </span>
                                );
                              })()}
                            </div>

                            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] font-bold">
                              <span className="text-primary font-bold">المسند إليه: {getAssignedEmployeeName(t)}</span>
                              <span className={isOverdue ? 'text-rose-600 font-black' : 'text-muted-foreground'}>
                                {(t as any).dueDate ? `تاريخ: ${(t as any).dueDate}` : 'بدون تاريخ'}
                              </span>
                            </div>

                            {/* Audit Metadata */}
                            {((t as any).updatedAt || (t as any).lastModifiedBy) && (
                              <div className="text-[9px] text-muted-foreground/80 font-semibold pt-1 border-t border-dashed border-border/40">
                                آخر تعديل: {(t as any).updatedAt ? new Date((t as any).updatedAt).toLocaleDateString('ar-EG') : 'الآن'} {(t as any).lastModifiedBy ? `بواسطة ${(t as any).lastModifiedBy}` : ''}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : tasksViewMode === 'eisenhower' ? (
            /* Eisenhower Matrix View */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: 'urgent_important', title: 'عاجل ومهم (أولوية قصوى)', bg: 'bg-rose-500/5 border-rose-500/30' },
                  { key: 'important_not_urgent', title: 'مهم وغير عاجل (تخطيط)', bg: 'bg-blue-500/5 border-blue-500/30' },
                  { key: 'urgent_not_important', title: 'عاجل وغير مهم (تفويض)', bg: 'bg-amber-500/5 border-amber-500/30' },
                  { key: 'not_urgent_not_important', title: 'غير عاجل وغير مهم (استبعاد)', bg: 'bg-muted/30 border-border' }
                ].map(quad => {
                  const quadTasks = displayTeamTasks.filter(t => getTaskEisenhowerQuadrant(t) === quad.key);
                  return (
                    <div key={quad.key} className={`p-4 border-2 ${quad.bg} space-y-3 min-h-[220px]`}>
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <h4 className="text-xs font-black text-foreground">{quad.title}</h4>
                        <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-bold">{quadTasks.length} مهمة</span>
                      </div>
                      <div className="space-y-2">
                        {quadTasks.length === 0 ? (
                          <div className="text-center py-6 text-xs text-muted-foreground italic font-semibold">لا توجد مهام في هذا الربع</div>
                        ) : (
                          quadTasks.map(t => (
                            <div key={t.id} className="p-3 bg-card border border-border text-xs space-y-2 hover:border-primary transition-all">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-foreground">{t.title}</span>
                                  {((t as any).subPhase === 'personal' || (t as any).subPhase === 'Personal' || (t as any).phase === 'Personal') && (
                                    <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[9px] font-bold">
                                      👤 مهمة شخصية
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleOpenEditTaskModal(t)}
                                  className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary hover:text-white transition-all"
                                >
                                  تعديل
                                </button>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                                <span>المسند إليه: <strong className="text-foreground">{getAssignedEmployeeName(t)}</strong></span>
                                <span>الاستحقاق: {(t as any).dueDate || 'غير محدد'}</span>
                              </div>
                              {((t as any).updatedAt || (t as any).lastModifiedBy) && (
                                <div className="text-[9px] text-muted-foreground/70">
                                  آخر تعديل: {(t as any).updatedAt ? new Date((t as any).updatedAt).toLocaleDateString('ar-EG') : 'الآن'} {(t as any).lastModifiedBy ? `بواسطة ${(t as any).lastModifiedBy}` : ''}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : tasksViewMode === 'completed' ? (
            /* Completed Tasks Section */
            <div className="bg-card border-2 border-border p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <h4 className="text-xs font-black text-emerald-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  أرشيف المهام المنتهية والمنجزة للفريق
                </h4>

                {/* Filters for Month and Week */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="text-muted-foreground">الشهر:</span>
                    <input
                      type="month"
                      value={completedTaskMonth}
                      onChange={e => setCompletedTaskMonth(e.target.value)}
                      className="px-2 py-1 bg-background border border-border text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    <span className="text-muted-foreground">الأسبوع:</span>
                    <select
                      value={completedTaskWeek}
                      onChange={e => setCompletedTaskWeek(e.target.value)}
                      className="px-2 py-1 bg-background border border-border text-xs font-bold"
                    >
                      <option value="all">جميع الأسابيع</option>
                      <option value="1">الأسبوع الأول (1 - 7)</option>
                      <option value="2">الأسبوع الثاني (8 - 14)</option>
                      <option value="3">الأسبوع الثالث (15 - 21)</option>
                      <option value="4">الأسبوع الرابع (22 - النهاية)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Completed Tasks List */}
              <div className="space-y-3">
                {(() => {
                  const finished = displayTeamTasks.filter(t => t.status === 'Executed' || (t.status as string) === 'Completed' || t.status === 'Approved');
                  const filteredByMonthWeek = finished.filter(t => {
                    const dateStr = (t as any).updatedAt || (t as any).dueDate || t.endDate || '';
                    if (completedTaskMonth && dateStr) {
                      if (!dateStr.startsWith(completedTaskMonth)) return false;
                    }

                    if (completedTaskWeek !== 'all' && dateStr) {
                      const dayNum = parseInt(dateStr.split('-')[2] || '1', 10);
                      if (completedTaskWeek === '1' && (dayNum < 1 || dayNum > 7)) return false;
                      if (completedTaskWeek === '2' && (dayNum < 8 || dayNum > 14)) return false;
                      if (completedTaskWeek === '3' && (dayNum < 15 || dayNum > 21)) return false;
                      if (completedTaskWeek === '4' && dayNum < 22) return false;
                    }
                    return true;
                  });

                  if (filteredByMonthWeek.length === 0) {
                    return (
                      <div className="text-center py-12 text-xs font-bold text-muted-foreground">
                        لا توجد مهام مكتملة مطابقة للفلاتر المحددة.
                      </div>
                    );
                  }

                  return filteredByMonthWeek.map(t => (
                    <div key={t.id} className="p-4 bg-muted/40 border border-border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <h5 className="font-black text-foreground">{t.title}</h5>
                          <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">مكتملة</span>
                          {((t as any).subPhase === 'personal' || (t as any).subPhase === 'Personal' || (t as any).phase === 'Personal') && (
                            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-bold">👤 مهمة شخصية</span>
                          )}
                        </div>
                        {t.description && <p className="text-muted-foreground text-[11px] mt-1">{t.description}</p>}
                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-semibold mt-2">
                          <span>المسند إليه: <strong className="text-foreground">{getAssignedEmployeeName(t)}</strong></span>
                          <span>تاريخ الإنجاز/الاستحقاق: {(t as any).dueDate || '---'}</span>
                          {(t as any).lastModifiedBy && <span>المُنَفِّذ: {(t as any).lastModifiedBy}</span>}
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenEditTaskModal(t)}
                        className="px-3 py-1.5 bg-background border border-border text-xs font-bold hover:border-primary"
                      >
                        تعديل المهمة
                      </button>
                    </div>
                  ));
                })()}
              </div>
            </div>
          ) : (
            /* Table View */
            <div className="bg-card border-2 border-border overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-muted border-b border-border font-black text-muted-foreground">
                    <th className="p-3">عنوان المهمة والتفاصيل</th>
                    <th className="p-3">المسند إليه (الاسم / الكود / الإدارة / الوظيفة)</th>
                    <th className="p-3">الأولوية</th>
                    <th className="p-3">تاريخ الاستحقاق</th>
                    <th className="p-3">الحالة</th>
                    <th className="p-3">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {displayTeamTasks.map(t => {
                    const empDetails = getAssignedEmployeeDetails(t);
                    const isDone = t.status === 'Executed' || t.status === 'Approved' || (t.status as string) === 'Completed';
                    return (
                      <tr key={t.id} className="hover:bg-muted/30">
                        <td className="p-3 font-bold text-foreground">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{t.title}</span>
                            {((t as any).subPhase === 'personal' || (t as any).subPhase === 'Personal' || (t as any).phase === 'Personal') && (
                              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 text-[10px] font-bold">
                                👤 مهمة شخصية
                              </span>
                            )}
                          </div>
                          {t.description && <div className="text-[11px] text-muted-foreground font-normal mt-0.5">{t.description}</div>}
                        </td>
                        <td className="p-3 text-primary font-bold">
                          <div className="text-foreground">{empDetails.name}</div>
                          <div className="text-[10px] text-muted-foreground font-semibold">
                            كود: {empDetails.employeeId} | {empDetails.department} | {empDetails.jobTitle}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold ${t.priority === 'High' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-muted text-muted-foreground border border-border'}`}>
                            {t.priority === 'High' ? 'عالية جداً (High)' : t.priority === 'Low' ? 'منخفضة (Low)' : 'متوسطة (Medium)'}
                          </span>
                        </td>
                        <td className="p-3 font-mono">{(t as any).dueDate || '---'}</td>
                        <td className="p-3 font-bold">
                          <span className={`px-2 py-0.5 text-[10px] ${isDone ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'}`}>
                            {isDone ? 'مكتملة ومستلمة' : 'قيد التنفيذ'}
                          </span>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleOpenEditTaskModal(t)}
                            className="px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 font-bold hover:bg-primary hover:text-white transition-all text-[11px] cursor-pointer"
                          >
                            تعديل المهمة
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ATTENDANCE & AVAILABILITY (الحضور والتوفر) */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          <div className="bg-card border-2 border-border p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  حالة الحضور والتوفر اليومي لأعضاء الفريق
                </h3>
                <span className="text-[11px] text-muted-foreground font-bold">
                  تاريخ اليوم: {todayStr}
                </span>
              </div>
              <button
                onClick={() => setShowAttendanceHistoryModal(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-primary text-primary-foreground font-bold text-xs shadow-sm hover:opacity-90 transition-all cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                سجل الحضور والتوفر للأيام السابقة (حسب الشهر)
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {departmentBreakdown.map(dept => {
                const deptMembers = filteredTeamMembers.filter(e => getEmpDepartmentName(e) === dept.name);
                const availableCount = deptMembers.filter(e => ['present', 'remote', 'wfh'].includes(getEmpTodayStatus(e).type)).length;
                const ratio = deptMembers.length > 0 ? Math.round((availableCount / deptMembers.length) * 100) : 100;

                return (
                  <div key={dept.name} className="p-4 bg-muted/40 border border-border space-y-2">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span>{dept.name}</span>
                      <span className={ratio < 75 ? 'text-rose-600' : 'text-emerald-600'}>{ratio}% نسبة التغطية</span>
                    </div>
                    <div className="w-full h-2 bg-muted border border-border overflow-hidden">
                      <div className={`h-full transition-all ${ratio < 75 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${ratio}%` }}></div>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-bold block">{availableCount} من {deptMembers.length} موظفاً متاحون الآن</span>
                  </div>
                );
              })}
            </div>

            {/* Attendance Roster Table */}
            <div className="border border-border overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-muted border-b border-border font-black text-muted-foreground">
                    <th className="p-3">الموظف</th>
                    <th className="p-3">الإدارة</th>
                    <th className="p-3">نمط العمل المقرر</th>
                    <th className="p-3">وقت بدء العمل (Check-In)</th>
                    <th className="p-3">وقت الانتهاء (Check-Out)</th>
                    <th className="p-3">الإضافي اليوم</th>
                    <th className="p-3">إجمالي الإضافي هذا الشهر</th>
                    <th className="p-3">حالة الحضور والتوفر اليوم ({todayStr})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {filteredTeamMembers.map(emp => {
                    const st = getEmpTodayStatus(emp);
                    const ov = getEmpOvertimeStats(emp);
                    const isRemote = emp.workMode === 'Remotely Work' || (emp as any).workLocation === 'Remote' || (emp as any).workLocation === 'عمل عن بعد';
                    return (
                      <tr key={emp.id} className="hover:bg-muted/30">
                        <td className="p-3 font-bold text-foreground">{emp.name}</td>
                        <td className="p-3 text-muted-foreground">{getEmpDepartmentName(emp)}</td>
                        <td className="p-3 font-bold">
                          <span className={`px-2 py-0.5 text-[10px] ${isRemote ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' : 'bg-muted text-muted-foreground border border-border'}`}>
                            {isRemote ? 'عمل عن بعد (Remotely Work)' : 'حضور بالمقر الرئيسي'}
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {st.checkInTime ? st.checkInTime : 'لم يسجل البدء بعد'}
                        </td>
                        <td className="p-3 font-mono font-bold text-primary">
                          {st.checkOutTime ? st.checkOutTime : 'لم يسجل الانصراف بعد'}
                        </td>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {ov.todayOvertimeMins > 0 ? `${(ov.todayOvertimeMins / 60).toFixed(1)} س (${ov.todayOvertimeMins} د)` : '0'}
                        </td>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {ov.monthOvertimeMins > 0 ? `${(ov.monthOvertimeMins / 60).toFixed(1)} س (${ov.monthOvertimeMins} د)` : '0'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 text-[10px] font-bold border ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PERFORMANCE & GROWTH (الأداء والنمو) */}
      {activeTab === 'performance' && (
        <TeamPerformanceTab
          filteredTeamMembers={filteredTeamMembers}
          teamEvaluations={teamEvaluations}
          performanceDevelopmentPlans={performanceDevelopmentPlans}
          performanceCycles={performanceCycles}
          performanceTemplates={performanceTemplates}
          performanceCriteria={performanceCriteria}
          projectTasks={projectTasks}
          missions={missions}
          attendanceRecords={attendanceRecords}
          leaveRequests={leaveRequests}
          penalties={penalties}
          investigations={investigations}
          refreshData={refreshData}
          currentEmployee={currentEmp}
          userRole={profile?.role || (isAdmin ? 'Admin' : 'Manager')}
          adminDepartments={adminDepartments}
        />
      )}

      {/* TAB: INVESTIGATIONS & PENALTIES (التحقيقات والجزاءات) */}
      {activeTab === 'investigations_penalties' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-card border-2 border-border p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 text-red-600 rounded-xl border border-red-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-foreground">سجل التحقيقات الإدارية والجزاءات للفريق</h3>
                <p className="text-xs text-muted-foreground font-bold">متابعة جلسات التحقيق والجزاءات الصادرة بحق أعضاء فريقك المباشر</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-red-500/10 text-red-600 font-mono font-black text-xs rounded-lg border border-red-500/20">
                {teamInvestigations.length} جلسة تحقيق
              </span>
              <span className="px-3 py-1 bg-amber-500/10 text-amber-600 font-mono font-black text-xs rounded-lg border border-amber-500/20">
                {teamPenalties.length} جزاء ومخالفة
              </span>
            </div>
          </div>

          {/* SECTION 1: INVESTIGATIONS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-600" />
                <h4 className="text-sm font-black text-foreground">التحقيقات الإدارية للفريق ({teamInvestigations.length})</h4>
              </div>
              <span className="text-xs font-bold text-muted-foreground bg-muted/50 px-3 py-1 rounded-xl">
                متابعة الجلسات الصادرة من الشؤون القانونية والموارد البشرية
              </span>
            </div>

            {teamInvestigations.length === 0 ? (
              <div className="bg-card border border-dashed border-border p-8 rounded-2xl text-center text-xs font-bold text-muted-foreground space-y-2">
                <p>لا توجد جلسات تحقيق إدارية مسجلة لأعضاء فريقك حالياً.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamInvestigations.map((inv: any) => {
                  let empNames = inv.employeeName;
                  if (!empNames && inv.employeeIds) {
                    let eArr: string[] = [];
                    try {
                      eArr = typeof inv.employeeIds === 'string' ? JSON.parse(inv.employeeIds) : (inv.employeeIds || []);
                    } catch (e) {}
                    const matchedEmps = employees.filter(e => eArr.includes(e.id) || eArr.includes(e.employeeId));
                    if (matchedEmps.length > 0) {
                      empNames = matchedEmps.map(e => e.name).join(', ');
                    }
                  }
                  return (
                    <div key={inv.id} className="bg-card border-2 border-red-600/30 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-black text-red-600 bg-red-500/10 px-2.5 py-0.5 rounded-full border border-red-500/20 inline-block mb-1 font-mono">
                              {inv.investigationNumber || inv.id}
                            </span>
                            <h4 className="font-black text-sm text-foreground">{inv.title || 'تحقيق إداري'}</h4>
                            <p className="text-xs font-bold text-primary flex items-center gap-1 mt-0.5">
                              <User className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>الموظف المدعو: {empNames || 'غير محدد'}</span>
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 text-[10px] font-black rounded-full shrink-0 border ${
                            inv.status === 'Completed'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : inv.status === 'Cancelled'
                              ? 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                              : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          }`}>
                            {inv.status === 'Completed' ? 'مكتملة' : inv.status === 'Cancelled' ? 'ملغاة' : 'جلسة مجدولة'}
                          </span>
                        </div>

                        {inv.reason && (
                          <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border/50">
                            <strong>سبب التحقيق:</strong> {inv.reason}
                          </p>
                        )}

                        {(inv.recommendation || inv.notes) && (
                          <div className="bg-red-500/5 p-3 rounded-xl border border-red-500/10 text-xs space-y-0.5">
                            <span className="font-black text-red-600 block">القرارات والجزاءات الصادرة:</span>
                            <p className="text-foreground font-medium">{inv.recommendation || inv.notes}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-2 border-t border-border">
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Calendar className="w-3.5 h-3.5 text-red-600" />
                            <span>التاريخ: {inv.investigationDate || '-'}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-foreground">
                            <Clock className="w-3.5 h-3.5 text-red-600" />
                            <span>الوقت: {inv.investigationTime ? formatTime12h(inv.investigationTime, 'ar') : '-'}</span>
                          </div>
                          <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                            <FileText className="w-3.5 h-3.5 text-red-600" />
                            <span>المكان: {inv.location || 'الشؤون القانونية'} | المحقق: {inv.investigatorName || 'المستشار القانوني'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: PENALTIES & APPROVAL WORKFLOW */}
          <div className="space-y-4 pt-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h4 className="text-sm font-black text-foreground">الجزاءات والمخالفات الصادرة ومسار الاعتماد ({teamPenalties.length})</h4>
              </div>
              <span className="text-xs font-bold text-amber-700 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/20">
                مسار الاعتماد: المدير المباشر ⬅️ الرئيس الأعلى ⬅️ الموارد البشرية
              </span>
            </div>

            {teamPenalties.length === 0 ? (
              <div className="bg-card border border-dashed border-border p-8 rounded-2xl text-center text-xs font-bold text-muted-foreground">
                لا توجد جزاءات أو مخالفات مسجلة بحق أعضاء فريقك حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teamPenalties.map((p: any) => {
                  const targetEmp = employees.find(e => e.id === p.employeeId || e.employeeId === p.employeeId);
                  
                  // Check manager roles
                  const isDirectManager = filteredTeamMembers.some(tm => tm.id === p.employeeId || tm.employeeId === p.employeeId);
                  const isPendingDirectManager = p.status === 'Pending Direct Manager' || p.status === 'Pending Approval' || p.status === 'Draft';
                  const isPendingHigherManager = p.status === 'Pending Higher Manager';

                  return (
                    <div key={p.id} className="bg-card border-2 border-border hover:border-amber-500/40 rounded-2xl p-5 shadow-sm space-y-3 transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] font-black text-amber-600 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 inline-block mb-1 font-mono">
                            {p.penaltyNumber || p.id}
                          </span>
                          <h4 className="font-black text-sm text-foreground">{p.violationType || 'مخالفة إدارية'}</h4>
                          <p className="text-xs font-bold text-primary flex items-center gap-1 mt-0.5">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>الموظف: <strong className="text-foreground">{targetEmp?.name || p.employeeName || 'غير محدد'}</strong></span>
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 text-[10px] font-black rounded-full border ${
                          p.status === 'Approved'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                            : p.status === 'Cancelled'
                            ? 'bg-slate-500/10 text-slate-600 border-slate-500/20'
                            : p.status === 'Rejected'
                            ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                        }`}>
                          {p.status === 'Approved'
                            ? 'معتمد نهائياً'
                            : p.status === 'Pending Direct Manager'
                            ? 'بانتظار المدير المباشر'
                            : p.status === 'Pending Higher Manager'
                            ? 'بانتظار الرئيس الأعلى'
                            : p.status === 'Pending HR'
                            ? 'بانتظار اعتماد الموارد البشرية'
                            : p.status === 'Cancelled'
                            ? 'تم إلغاء الجزاء'
                            : p.status === 'Rejected'
                            ? 'مرفوض'
                            : 'قيد المراجعة'}
                        </span>
                      </div>

                      {p.description && (
                        <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border/50">
                          {p.description}
                        </p>
                      )}

                      {/* WORKFLOW OPINIONS BOX */}
                      <div className="space-y-1.5 text-xs bg-muted/20 p-3 rounded-xl border border-border/60">
                        <div className="font-black text-[11px] text-foreground mb-1">سجل آراء وقرارات الاعتماد:</div>
                        
                        {/* Direct Manager Opinion */}
                        <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5">
                          <span className="font-bold text-muted-foreground">رأي المدير المباشر:</span>
                          <span className="font-black">
                            {p.directManagerDecision === 'Approved' ? (
                              <span className="text-emerald-600">✅ موافقة</span>
                            ) : p.directManagerDecision === 'Objected' ? (
                              <span className="text-rose-600">❌ اعتراض: {p.directManagerObjectionReason || 'دون تفاصيل'}</span>
                            ) : (
                              <span className="text-amber-600 font-medium">بانتظار الرأي</span>
                            )}
                          </span>
                        </div>

                        {/* Higher Manager Opinion */}
                        <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5">
                          <span className="font-bold text-muted-foreground">رأي الرئيس الأعلى:</span>
                          <span className="font-black">
                            {p.higherManagerDecision === 'Approved' ? (
                              <span className="text-emerald-600">✅ موافقة</span>
                            ) : p.higherManagerDecision === 'Objected' ? (
                              <span className="text-rose-600">❌ اعتراض / رأي: {p.higherManagerObjectionReason || 'دون تفاصيل'}</span>
                            ) : (
                              <span className="text-amber-600 font-medium">بانتظار الرأي</span>
                            )}
                          </span>
                        </div>

                        {/* HR Decision */}
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-muted-foreground">قرار الموارد البشرية:</span>
                          <span className="font-black">
                            {p.status === 'Approved' ? (
                              <span className="text-emerald-600">✅ معتمد رسمياً</span>
                            ) : p.status === 'Cancelled' ? (
                              <span className="text-slate-600">🚫 ملغى / موقوف ({p.cancellationReason || 'بقرار HR'})</span>
                            ) : (
                              <span className="text-blue-600 font-medium">قيد مسار التدقيق</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* GRIEVANCE STATUS IF PRESENT */}
                      {p.hasGrievance && (
                        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-black text-indigo-700">تظلم الموظف المقدم:</span>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-800">
                              {p.grievanceStatus === 'Pending' ? 'قيد دراسة HR' : p.grievanceStatus === 'Accepted_Modified' ? 'مقبول ومعدل' : 'مرفوض'}
                            </span>
                          </div>
                          <p className="text-foreground font-medium"><strong>سبب التظلم:</strong> {p.grievanceReason}</p>
                          {p.grievanceReply && (
                            <p className="text-foreground font-bold pt-1 border-t border-indigo-500/20">
                              <strong>رد وقرار HR:</strong> {p.grievanceReply}
                            </p>
                          )}
                          {p.grievanceStatus === 'Accepted_Modified' && (
                            <div className="grid grid-cols-2 gap-1 pt-1 text-[11px] font-bold text-muted-foreground">
                              <span>الجزاء قبل التظلم: {p.preGrievancePenaltyType} ({p.preGrievanceDeductionValue || 0} {p.preGrievanceDeductionType === 'Days' ? 'يوم' : 'جنيه'})</span>
                              <span className="text-emerald-700">الجزاء بعد التظلم: {p.postGrievancePenaltyType || p.penaltyType} ({p.postGrievanceDeductionValue || p.deductionValue || 0} {p.deductionType === 'Days' ? 'يوم' : 'جنيه'})</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-border">
                        <span className="text-foreground">نوع الجزاء: {p.penaltyType || 'إنذار'}</span>
                        {p.deductionValue > 0 && (
                          <span className="text-red-600 font-black">الخصم: {p.deductionValue} {p.deductionType === 'Days' ? 'يوم' : 'جنيه'}</span>
                        )}
                      </div>

                      {/* MANAGER ACTION BUTTONS */}
                      {isPendingDirectManager && (
                        <div className="pt-2 border-t border-border flex items-center gap-2">
                          <button
                            onClick={() => {
                              setManagerPenaltyModal({
                                isOpen: true,
                                penalty: p,
                                action: 'Approved',
                                roleType: 'DirectManager',
                                reason: '',
                                submitting: false
                              });
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>موافقة المدير المباشر</span>
                          </button>
                          <button
                            onClick={() => {
                              setManagerPenaltyModal({
                                isOpen: true,
                                penalty: p,
                                action: 'Objected',
                                roleType: 'DirectManager',
                                reason: '',
                                submitting: false
                              });
                            }}
                            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>اعتراض مع إبداء السبب</span>
                          </button>
                        </div>
                      )}

                      {isPendingHigherManager && (
                        <div className="pt-2 border-t border-border flex items-center gap-2">
                          <button
                            onClick={() => {
                              setManagerPenaltyModal({
                                isOpen: true,
                                penalty: p,
                                action: 'Approved',
                                roleType: 'HigherManager',
                                reason: '',
                                submitting: false
                              });
                            }}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>موافقة الرئيس الأعلى</span>
                          </button>
                          <button
                            onClick={() => {
                              setManagerPenaltyModal({
                                isOpen: true,
                                penalty: p,
                                action: 'Objected',
                                roleType: 'HigherManager',
                                reason: '',
                                submitting: false
                              });
                            }}
                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black py-2 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>اعتراض / رأي الرئيس الأعلى</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: ANALYTICS (التحليلات والتقارير) */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dept Distribution */}
            <div className="bg-card border-2 border-border p-5 space-y-3">
              <h4 className="text-xs font-black text-foreground flex items-center gap-2">
                <PieChart className="w-4 h-4 text-primary" />
                توزيع اعضاء الفريق حسب الإدارة
              </h4>
              <div className="space-y-2 pt-2">
                {departmentBreakdown.map(d => (
                  <div key={d.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{d.name}</span>
                      <span className="text-primary">{d.count} موظفين</span>
                    </div>
                    <div className="w-full h-2 bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${(d.count / (allTeamMembers.length || 1)) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Organizational Recommendations */}
            <div className="bg-card border-2 border-border p-5 space-y-3">
              <h4 className="text-xs font-black text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                توصيات الدعم والإسناد التنظيمي
              </h4>
              <div className="space-y-2 text-xs font-semibold text-muted-foreground">
                <div className="p-3 bg-primary/5 border border-primary/20 text-foreground">
                  • بلغ إجمالي نسبة إنجاز مهام الفريق {overallTeamTaskDoneRate}% حتى الآن بناءً على المهام المنفذة.
                </div>
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 text-foreground">
                  • يفضل توزيع المهام المتأخرة على أعضاء فريق المتاحين اليوم لتفادي تراكم العمل.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN NEW TASK */}
      {isAssignTaskModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-background/80 backdrop-blur-sm overflow-hidden" dir="rtl">
          <div className="bg-card border-2 border-primary w-full max-w-lg sm:max-w-xl max-h-[90vh] flex flex-col p-4 sm:p-6 shadow-2xl relative text-right rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <h3 className="text-base font-black text-foreground flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                إسناد مهمة جديدة لعضو بالفريق
              </h3>
              <button onClick={() => setIsAssignTaskModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignTask} className="space-y-3 text-xs font-bold flex-1 overflow-y-auto min-h-0 py-3 pr-1 pl-1">
              <div>
                <label className="block mb-1 text-muted-foreground">اختر الموظف:</label>
                <select
                  value={newTaskTargetEmpId}
                  onChange={e => setNewTaskTargetEmpId(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border font-bold outline-none focus:border-primary"
                  required
                >
                  <option value="">-- اختر موظفاً من فريقك --</option>
                  {filteredTeamMembers.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({getEmpDepartmentName(emp)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 text-muted-foreground font-bold">خيارات الربط بالمشروع والتكليف:</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setNewTaskProjectId('')}
                    className={`p-2.5 border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !newTaskProjectId
                        ? 'bg-primary/10 border-primary text-primary shadow-sm'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span>📌</span>
                    <span>بدون مشروع محدد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (projects.length > 0 && !newTaskProjectId) {
                        setNewTaskProjectId(projects[0].id);
                      }
                    }}
                    className={`p-2.5 border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      newTaskProjectId
                        ? 'bg-primary/10 border-primary text-primary shadow-sm'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span>📁</span>
                    <span>اختيار مشروع محدد</span>
                  </button>
                </div>
                <select
                  value={newTaskProjectId}
                  onChange={e => {
                    const newPId = e.target.value;
                    setNewTaskProjectId(newPId);
                    const selP = projects.find(p => p.id === newPId);
                    if (selP) {
                      setNewTaskPhase(selP.phases?.[0] || '');
                      setNewTaskScope(selP.scope?.[0]?.name || 'General');
                    } else {
                      setNewTaskPhase('');
                      setNewTaskScope('');
                    }
                  }}
                  className="w-full p-2.5 bg-background border border-border font-bold outline-none focus:border-primary text-foreground cursor-pointer"
                >
                  <option value="">📌 بدون مشروع محدد (تكليف مباشر/مستقل)</option>
                  {projects.map(proj => (
                    <option key={proj.id} value={proj.id}>📁 {proj.name}</option>
                  ))}
                </select>

                {/* PHASE AND SCOPE SELECTION WHEN PROJECT IS SELECTED */}
                {newTaskProjectId && (() => {
                  const selectedProj = projects.find(p => p.id === newTaskProjectId);
                  if (!selectedProj) return null;
                  const projectPhases = selectedProj.phases || [];
                  const projectScopes = selectedProj.scope || [];

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 mt-2 bg-primary/5 border border-primary/20 rounded-xl">
                      <div>
                        <label className="block mb-1 text-primary font-black text-xs">المرحلة (Phase):</label>
                        <select
                          value={newTaskPhase}
                          onChange={e => setNewTaskPhase(e.target.value)}
                          className="w-full p-2 bg-background border border-border font-bold outline-none focus:border-primary text-xs cursor-pointer text-foreground"
                        >
                          <option value="">-- بدون مرحلة محددة --</option>
                          {projectPhases.map(phase => (
                            <option key={phase} value={phase}>{phase}</option>
                          ))}
                        </select>
                        {projectPhases.length === 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">لم يتم إضافة مراحل مسبقة لهذا المشروع</p>
                        )}
                      </div>

                      <div>
                        <label className="block mb-1 text-primary font-black text-xs">نطاق العمل / Scope (WBS):</label>
                        <select
                          value={newTaskScope}
                          onChange={e => setNewTaskScope(e.target.value)}
                          className="w-full p-2 bg-background border border-border font-bold outline-none focus:border-primary text-xs cursor-pointer text-foreground"
                        >
                          <option value="">-- عام (General) --</option>
                          {projectScopes.map((sc: any) => (
                            <option key={sc.id || sc.name} value={sc.name}>{sc.name}</option>
                          ))}
                        </select>
                        {projectScopes.length === 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">لم يتم إضافة نطاقات عمل مسبقة لهذا المشروع</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* SUB-TASK SELECTION (الربط بمهمة رئيسية كـ Sub-task) */}
              <div className="p-3 bg-muted/20 border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <GitFork className="w-3.5 h-3.5 text-indigo-600" />
                    <span>الربط بمهمة رئيسية (إنشاء كمهمة فرعية - Sub-task):</span>
                  </label>
                  {newTaskParentTaskId && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewTaskParentTaskId('');
                        setNewTaskParentSearch('');
                      }}
                      className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      إلغاء الربط بالمهمة الرئيسية
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="relative">
                    <input
                      type="text"
                      value={newTaskParentSearch}
                      onChange={e => setNewTaskParentSearch(e.target.value)}
                      placeholder="ابحث في جميع المهام لربط هذه المهمة كـ Sub-task..."
                      className="w-full p-2 pr-8 bg-background border border-border text-xs rounded-lg outline-none focus:border-primary font-medium"
                    />
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-3 pointer-events-none" />
                  </div>

                  <select
                    value={newTaskParentTaskId}
                    onChange={e => {
                      const selectedId = e.target.value;
                      setNewTaskParentTaskId(selectedId);
                      const parent = projectTasks.find(t => t.id === selectedId);
                      if (parent) {
                        if (parent.projectId && !newTaskProjectId) {
                          setNewTaskProjectId(parent.projectId);
                        }
                        if (parent.phase && !newTaskPhase) {
                          setNewTaskPhase(parent.phase);
                        }
                        if (parent.subPhase && !newTaskScope) {
                          setNewTaskScope(parent.subPhase);
                        }
                      }
                    }}
                    className="w-full p-2.5 bg-background border border-border text-xs rounded-lg font-bold outline-none focus:border-primary cursor-pointer text-foreground"
                  >
                    <option value="">-- مهمة رئيسية مستقلة (ليست مهمة فرعية) --</option>
                    {projectTasks
                      .filter(t => {
                        if (!newTaskParentSearch.trim()) return true;
                        const q = newTaskParentSearch.toLowerCase();
                        return (
                          t.title?.toLowerCase().includes(q) ||
                          t.assignedTo?.toLowerCase().includes(q) ||
                          t.description?.toLowerCase().includes(q)
                        );
                      })
                      .map(t => {
                        const isDone = t.status === 'Executed' || t.status === 'Approved' || (t.status as string) === 'Completed';
                        return (
                          <option key={t.id} value={t.id}>
                            {isDone ? '✔ ' : '⏳ '} {t.title} {t.assignedTo ? `(المكلف: ${t.assignedTo})` : ''} {t.priority ? `[${t.priority}]` : ''}
                          </option>
                        );
                      })}
                  </select>

                  {newTaskParentTaskId && (() => {
                    const selectedParent = projectTasks.find(t => t.id === newTaskParentTaskId);
                    if (!selectedParent) return null;
                    return (
                      <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-[11px] text-indigo-900 dark:text-indigo-200 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Layers className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span className="font-bold truncate">المهمة الأصلية: {selectedParent.title}</span>
                        </div>
                        <span className="text-[10px] bg-indigo-500/20 px-2 py-0.5 rounded font-black shrink-0">
                          {selectedParent.assignedTo || 'غير مسند'}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label className="block mb-1 text-muted-foreground">عنوان المهمة:</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  placeholder="أدخل عنوان المهمة المطلوب إنجازها..."
                  className="w-full p-2.5 bg-background border border-border outline-none focus:border-primary font-medium"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-muted-foreground">الوصف والتفاصيل:</label>
                <textarea
                  value={newTaskDesc}
                  onChange={e => setNewTaskDesc(e.target.value)}
                  rows={3}
                  placeholder="أدخل تفاصيل التكليف..."
                  className="w-full p-2.5 bg-background border border-border outline-none focus:border-primary font-medium"
                ></textarea>
              </div>

              {/* Estimated Time (الاستميت تايم) & Due Date */}
              <div className="bg-primary/5 border border-primary/20 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-primary font-black flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>الوقت التقديري للمهمة (Estimated Time)*:</span>
                  </label>
                  <span className="text-primary font-black text-xs font-mono">
                    {newTaskEstimatedHours} {newTaskEstimatedHours === 1 ? 'ساعة' : newTaskEstimatedHours === 2 ? 'ساعتان' : 'ساعات'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 4, 8].map(h => (
                    <button
                      type="button"
                      key={h}
                      onClick={() => setNewTaskEstimatedHours(h)}
                      className={`py-1.5 text-center text-xs font-black border transition-all cursor-pointer ${
                        newTaskEstimatedHours === h
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {h} {h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : 'ساعات'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap">أو حدد بالساعات:</span>
                  <input
                    type="number"
                    min="0.25"
                    max="200"
                    step="0.25"
                    value={newTaskEstimatedHours}
                    onChange={e => setNewTaskEstimatedHours(parseFloat(e.target.value) || 0)}
                    className="w-24 p-1.5 bg-background border border-border text-xs font-mono font-bold text-foreground text-center outline-none focus:border-primary"
                    required
                  />
                  <span className="text-[11px] text-muted-foreground">ساعة عمل (لحساب تأخير الموظف)</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block mb-1 text-muted-foreground">الأولوية:</label>
                  <select
                    value={newTaskPriority}
                    onChange={e => setNewTaskPriority(e.target.value as any)}
                    className="w-full p-2.5 bg-background border border-border font-bold outline-none focus:border-primary"
                  >
                    <option value="High">عالية جداً (High)</option>
                    <option value="Medium">متوسطة (Medium)</option>
                    <option value="Low">منخفضة (Low)</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-muted-foreground">تاريخ البدء:</label>
                  <input
                    type="date"
                    value={newTaskStartDate}
                    onChange={e => setNewTaskStartDate(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border font-bold outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-muted-foreground">تاريخ الاستحقاق:</label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border font-bold outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignTaskModalOpen(false)}
                  className="px-4 py-2 bg-muted text-muted-foreground border border-border font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTask}
                  className="px-6 py-2 bg-primary text-primary-foreground font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingTask ? 'جاري الحفظ...' : 'إسناد المهمة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DECISION FOR REQUESTS (APPROVE / REJECT / REQUEST COMPLETION) */}
      {decisionModalItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-hidden" dir="rtl">
          <div className="bg-card border-2 border-primary w-full max-w-md max-h-[90vh] flex flex-col p-4 sm:p-6 shadow-2xl relative text-right rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <h3 className="text-base font-black text-foreground">
                {decisionModalItem.actionType === 'approve' ? 'تأكيد اعتماد الطلب' :
                 decisionModalItem.actionType === 'reject' ? 'سبب رفض الطلب (إلزامي)' : 'طلب استكمال البيانات'}
              </h3>
              <button onClick={() => setDecisionModalItem(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0 py-3 pr-1 pl-1 space-y-3">
              <p className="text-xs text-muted-foreground font-semibold">
                الطلب الخاص بـ: <span className="text-foreground font-bold">{decisionModalItem.item.employeeName}</span> ({decisionModalItem.item.type})
              </p>

              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1">
                  {decisionModalItem.actionType === 'approve' ? 'ملاحظات الاعتماد (اختياري):' : 'أدخل البيان والسبب تفصيلياً:'}
                </label>
                <textarea
                  value={decisionReason}
                  onChange={e => setDecisionReason(e.target.value)}
                  rows={4}
                  placeholder="أكتب الملاحظات أو أسباب القرار هنا..."
                  className="w-full p-3 bg-background border border-border font-medium text-xs outline-none focus:border-primary rounded-lg"
                ></textarea>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border shrink-0">
              <button
                onClick={() => setDecisionModalItem(null)}
                className="px-4 py-2 bg-muted text-muted-foreground border border-border font-bold text-xs rounded-lg cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteDecision}
                disabled={isSubmittingDecision}
                className={`px-6 py-2 text-white font-bold text-xs cursor-pointer rounded-lg disabled:opacity-50 ${
                  decisionModalItem.actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmittingDecision ? 'جاري التنفيذ...' : 'تأكيد وحفظ القرار'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SEND INTERNAL ALERT */}
      {isAlertModalOpen && alertTargetEmp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-sm overflow-hidden" dir="rtl">
          <div className="bg-card border-2 border-amber-500 w-full max-w-md max-h-[90vh] flex flex-col p-4 sm:p-6 shadow-2xl relative text-right rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <h3 className="text-base font-black text-foreground flex items-center gap-2">
                <Send className="w-5 h-5 text-amber-500" />
                إرسال تنبيه إداري لـ {alertTargetEmp.name}
              </h3>
              <button onClick={() => setIsAlertModalOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {alertSuccess ? (
              <div className="p-4 bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-xs font-bold text-center rounded-xl my-4">
                تم إرسال التنبيه بنجاح للموظف!
              </div>
            ) : (
              <form onSubmit={handleSendAlert} className="flex-1 flex flex-col min-h-0 space-y-3 py-3 pr-1 pl-1 text-xs font-bold">
                <div className="flex-1 overflow-y-auto min-h-0">
                  <label className="block mb-1 text-muted-foreground">نص التنبيه أو الملاحظة الإدارية:</label>
                  <textarea
                    value={alertMessage}
                    onChange={e => setAlertMessage(e.target.value)}
                    rows={4}
                    placeholder="أدخل رسالة التنبيه التي ستظهر للموظف في لوحة تحكمه..."
                    className="w-full p-3 bg-background border border-border outline-none focus:border-amber-500 font-medium rounded-lg"
                    required
                  ></textarea>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAlertModalOpen(false)}
                    className="px-4 py-2 bg-muted text-muted-foreground border border-border font-bold cursor-pointer rounded-lg"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-amber-500 text-white font-bold hover:bg-amber-600 cursor-pointer rounded-lg"
                  >
                    إرسال التنبيه
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: EDIT ASSIGNED TASK */}
      {editingTask && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-background/80 backdrop-blur-sm overflow-hidden" dir="rtl">
          <div className="bg-card border-2 border-primary w-full max-w-lg sm:max-w-xl max-h-[90vh] flex flex-col p-4 sm:p-6 shadow-2xl relative text-right rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0">
              <h3 className="text-base font-black text-foreground flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-primary" />
                تعديل بيانات المهمة التكليفية
              </h3>
              <button onClick={() => setEditingTask(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedTask} className="space-y-3 text-xs font-bold flex-1 overflow-y-auto min-h-0 py-3 pr-1 pl-1">
              <div>
                <label className="block mb-1 text-muted-foreground font-bold">عنوان المهمة:</label>
                <input
                  type="text"
                  value={editTaskTitle}
                  onChange={e => setEditTaskTitle(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border font-bold outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="block mb-1 text-muted-foreground font-bold">خيارات الربط بالمشروع والتكليف:</label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setEditTaskProjectId('')}
                    className={`p-2 border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !editTaskProjectId
                        ? 'bg-primary/10 border-primary text-primary shadow-sm'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span>📌</span>
                    <span>بدون مشروع محدد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (projects.length > 0 && !editTaskProjectId) {
                        setEditTaskProjectId(projects[0].id);
                      }
                    }}
                    className={`p-2 border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      editTaskProjectId
                        ? 'bg-primary/10 border-primary text-primary shadow-sm'
                        : 'bg-background border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span>📁</span>
                    <span>اختيار مشروع محدد</span>
                  </button>
                </div>
                <select
                  value={editTaskProjectId}
                  onChange={e => {
                    const newPId = e.target.value;
                    setEditTaskProjectId(newPId);
                    const selP = projects.find(p => p.id === newPId);
                    if (selP) {
                      setEditTaskPhase(selP.phases?.[0] || '');
                      setEditTaskScope(selP.scope?.[0]?.name || 'General');
                    } else {
                      setEditTaskPhase('');
                      setEditTaskScope('');
                    }
                  }}
                  className="w-full p-2.5 bg-background border border-border font-bold outline-none focus:border-primary text-foreground cursor-pointer"
                >
                  <option value="">📌 بدون مشروع محدد (تكليف مباشر/مستقل)</option>
                  {projects.map(proj => (
                    <option key={proj.id} value={proj.id}>📁 {proj.name}</option>
                  ))}
                </select>

                {/* PHASE AND SCOPE SELECTION WHEN PROJECT IS SELECTED IN EDIT MODAL */}
                {editTaskProjectId && (() => {
                  const selectedProj = projects.find(p => p.id === editTaskProjectId);
                  if (!selectedProj) return null;
                  const projectPhases = selectedProj.phases || [];
                  const projectScopes = selectedProj.scope || [];

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 mt-2 bg-primary/5 border border-primary/20 rounded-xl">
                      <div>
                        <label className="block mb-1 text-primary font-black text-xs">المرحلة (Phase):</label>
                        <select
                          value={editTaskPhase}
                          onChange={e => setEditTaskPhase(e.target.value)}
                          className="w-full p-2 bg-background border border-border font-bold outline-none focus:border-primary text-xs cursor-pointer text-foreground"
                        >
                          <option value="">-- بدون مرحلة محددة --</option>
                          {projectPhases.map(phase => (
                            <option key={phase} value={phase}>{phase}</option>
                          ))}
                        </select>
                        {projectPhases.length === 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">لم يتم إضافة مراحل مسبقة لهذا المشروع</p>
                        )}
                      </div>

                      <div>
                        <label className="block mb-1 text-primary font-black text-xs">نطاق العمل / Scope (WBS):</label>
                        <select
                          value={editTaskScope}
                          onChange={e => setEditTaskScope(e.target.value)}
                          className="w-full p-2 bg-background border border-border font-bold outline-none focus:border-primary text-xs cursor-pointer text-foreground"
                        >
                          <option value="">-- عام (General) --</option>
                          {projectScopes.map((sc: any) => (
                            <option key={sc.id || sc.name} value={sc.name}>{sc.name}</option>
                          ))}
                        </select>
                        {projectScopes.length === 0 && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">لم يتم إضافة نطاقات عمل مسبقة لهذا المشروع</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* EDIT SUB-TASK SELECTION (الربط بمهمة رئيسية كـ Sub-task) */}
              <div className="p-3 bg-muted/20 border border-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <GitFork className="w-3.5 h-3.5 text-indigo-600" />
                    <span>المهمة الرئيسية التابعة لها (Sub-task):</span>
                  </label>
                  {editTaskParentTaskId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditTaskParentTaskId('');
                        setEditTaskParentSearch('');
                      }}
                      className="text-[10px] text-rose-600 font-bold hover:underline cursor-pointer"
                    >
                      إلغاء التبعية
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="relative">
                    <input
                      type="text"
                      value={editTaskParentSearch}
                      onChange={e => setEditTaskParentSearch(e.target.value)}
                      placeholder="ابحث في المهام لاختيار المهمة الرئيسية..."
                      className="w-full p-2 pr-8 bg-background border border-border text-xs rounded-lg outline-none focus:border-primary font-medium"
                    />
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-3 pointer-events-none" />
                  </div>

                  <select
                    value={editTaskParentTaskId}
                    onChange={e => setEditTaskParentTaskId(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border text-xs rounded-lg font-bold outline-none focus:border-primary cursor-pointer text-foreground"
                  >
                    <option value="">-- مهمة رئيسية مستقلة (بدون أصل) --</option>
                    {projectTasks
                      .filter(t => t.id !== editingTask.id)
                      .filter(t => {
                        if (!editTaskParentSearch.trim()) return true;
                        const q = editTaskParentSearch.toLowerCase();
                        return (
                          t.title?.toLowerCase().includes(q) ||
                          t.assignedTo?.toLowerCase().includes(q)
                        );
                      })
                      .map(t => (
                        <option key={t.id} value={t.id}>
                          {t.title} {t.assignedTo ? `(${t.assignedTo})` : ''}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1 text-muted-foreground">الوصف والتفاصيل:</label>
                <textarea
                  value={editTaskDesc}
                  onChange={e => setEditTaskDesc(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 bg-background border border-border font-medium outline-none focus:border-primary"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-muted-foreground">الأولوية:</label>
                  <select
                    value={editTaskPriority}
                    onChange={e => setEditTaskPriority(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border font-bold outline-none focus:border-primary"
                  >
                    <option value="Critical">حاسمة (Critical)</option>
                    <option value="High">عالية (High)</option>
                    <option value="Medium">متوسطة (Medium)</option>
                    <option value="Low">منخفضة (Low)</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-muted-foreground">تاريخ الاستحقاق:</label>
                  <input
                    type="date"
                    value={editTaskDueDate}
                    onChange={e => setEditTaskDueDate(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border font-bold outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-muted-foreground">حالة المهمة:</label>
                  <select
                    value={editTaskStatus}
                    onChange={e => setEditTaskStatus(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border font-bold outline-none focus:border-primary"
                  >
                    <option value="In Progress">قيد التنفيذ</option>
                    <option value="Under Review">قيد المراجعة</option>
                    <option value="Executed">مكتملة ومنفذة</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-muted-foreground">نسبة الإنجاز (%):</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editTaskProgress}
                    onChange={e => setEditTaskProgress(Number(e.target.value))}
                    className="w-full p-2.5 bg-background border border-border font-bold outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-4 py-2 bg-muted text-muted-foreground border border-border font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEditTask}
                  className="px-6 py-2 bg-primary text-primary-foreground font-bold hover:bg-primary/90 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingEditTask ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SIDE DRAWER: EMPLOYEE FULL DETAILS PANEL */}
      <AnimatePresence>
        {selectedEmployee && (
          <div className="fixed inset-0 z-[120] flex justify-start bg-background/70 backdrop-blur-sm">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-2xl bg-card border-l-2 border-primary h-full overflow-y-auto p-6 space-y-6 text-right relative shadow-2xl"
              dir="rtl"
            >
              <button
                onClick={() => setSelectedEmployee(null)}
                className="absolute top-4 left-4 p-2 bg-muted text-muted-foreground hover:text-foreground border border-border"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-center gap-4 border-b border-border pb-4">
                <div className="w-16 h-16 bg-primary/10 border-2 border-primary/30 text-primary font-black text-2xl flex items-center justify-center">
                  {selectedEmployee.name ? selectedEmployee.name.charAt(0) : 'E'}
                </div>
                <div>
                  <h2 className="text-xl font-black text-foreground">{selectedEmployee.name}</h2>
                  <p className="text-xs text-muted-foreground font-bold mt-0.5">
                    الرقم الوظيفي: #{selectedEmployee.employeeId || '---'} • {selectedEmployee.jobTitle || 'عضو بالفريق'}
                  </p>
                  <span className="inline-block mt-2 px-3 py-0.5 bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                    {getEmpDepartmentName(selectedEmployee)}
                  </span>
                </div>
              </div>

              {/* Drawer Tabs (6 Tabs) */}
              <div className="flex border-b border-border gap-2 text-xs font-bold overflow-x-auto pb-1">
                {[
                  { id: 'info', label: 'البيانات الأساسية' },
                  { id: 'requests', label: 'طلبات الموظف' },
                  { id: 'tasks', label: 'مهام الموظف' },
                  { id: 'attendance', label: 'الحضور والانصراف' },
                  { id: 'performance', label: 'الأداء والتقييم' },
                  { id: 'leaves_missions', label: 'الإجازات والمأموريات' }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setEmpDrawerTab(t.id as any)}
                    className={`pb-2 px-2 whitespace-nowrap border-b-2 transition-all cursor-pointer ${empDrawerTab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Drawer Content */}
              {/* TAB 1: BASIC INFO */}
              {empDrawerTab === 'info' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 p-4 bg-muted/40 border border-border">
                    <div>
                      <span className="text-muted-foreground block font-bold text-[10px]">الاسم الكامل:</span>
                      <span className="font-bold text-foreground">{selectedEmployee.name}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-bold text-[10px]">البريد الإلكتروني:</span>
                      <span className="font-bold text-foreground">{selectedEmployee.email || 'غير مدخل'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-bold text-[10px]">المسمى الوظيفي:</span>
                      <span className="font-bold text-foreground">{selectedEmployee.jobTitle || '---'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-bold text-[10px]">الإدارة:</span>
                      <span className="font-bold text-primary">{getEmpDepartmentName(selectedEmployee)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-bold text-[10px]">تاريخ الانضمام:</span>
                      <span className="font-bold text-foreground">{selectedEmployee.joinDate || '---'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block font-bold text-[10px]">نوع العقد والدوام:</span>
                      <span className="font-bold text-foreground">{selectedEmployee.workType || 'دوام كامل'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: REQUESTS */}
              {empDrawerTab === 'requests' && (
                <div className="space-y-3">
                  {(() => {
                    const empReqs = [...teamLeaveRequests, ...teamMissions].filter(r => r.employeeId === selectedEmployee.id || r.employeeId === selectedEmployee.employeeId || (r as any).employeeName === selectedEmployee.name);
                    if (empReqs.length === 0) {
                      return <div className="text-center py-8 text-xs font-bold text-muted-foreground">لا توجد طلبات مسجلة لهذا الموظف</div>;
                    }
                    return empReqs.map((r: any) => (
                      <div key={r.id} className="p-3 bg-muted/40 border border-border text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold">
                          <span>{r.type || 'طلب إداري'}</span>
                          <span className={`px-2 py-0.5 text-[10px] ${r.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {r.status}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{r.notes || r.reason || 'بدون تفاصيل إضافية'}</p>
                        <span className="text-[10px] text-muted-foreground/70 block">{r.date || r.startDate}</span>
                      </div>
                    ));
                  })()}
                </div>
              )}

              {/* TAB 3: TASKS & PRIORITY MATRIX */}
              {empDrawerTab === 'tasks' && (
                <div className="space-y-4 text-xs">
                  {(() => {
                    // Gather all tasks assigned to selected employee
                    const empAssignedTasks = teamTasks.filter(t => {
                      const empIds = [selectedEmployee.id, selectedEmployee.employeeId, selectedEmployee.userId, selectedEmployee.email, selectedEmployee.name].filter(Boolean).map(x => String(x).toLowerCase().trim());
                      const assignedTo = String(t.assignedToId || (t as any).assignedTo || '').toLowerCase().trim();
                      const assignedIds = Array.isArray(t.assignedToIds) ? t.assignedToIds.map(x => String(x).toLowerCase().trim()) : [];
                      return empIds.includes(assignedTo) || assignedIds.some(id => empIds.includes(id));
                    });

                    // Gather personal commitments from localStorage
                    const empCommitments: any[] = [];
                    if (selectedEmployee.email) {
                      try {
                        const saved = localStorage.getItem(`salarix_commitments_${selectedEmployee.email.toLowerCase().trim()}`);
                        if (saved) {
                          const parsed = JSON.parse(saved);
                          if (Array.isArray(parsed)) {
                            parsed.forEach((c: any) => {
                              if (!c.id || c.id.startsWith('task-override-')) return;
                              const isDone = c.status === 'Completed' || c.status === 'Approved';
                              empCommitments.push({
                                id: `personal-${c.id}`,
                                title: c.title,
                                description: c.description || 'التزام شخصي مسجل بملف الموظف',
                                status: isDone ? 'Executed' : (c.status || 'In Progress'),
                                priority: c.priority || 'Medium',
                                quadrant: c.quadrant,
                                dueDate: c.startDate || c.endDate,
                                endDate: c.startDate || c.endDate,
                                isPersonal: true
                              });
                            });
                          }
                        }
                      } catch (e) {}
                    }

                    const allEmpItems = [...empAssignedTasks, ...empCommitments];

                    if (allEmpItems.length === 0) {
                      return (
                        <div className="text-center py-12 bg-muted/20 border border-dashed border-border p-6 space-y-2">
                          <CheckCircle2 className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
                          <p className="font-bold text-foreground text-sm">لا توجد مهام أو التزامات مسجلة لهذا الموظف</p>
                          <p className="text-muted-foreground text-xs">لم يقم الموظف بإضافة التزامات شخصية أو استقبال تكليفات رسمية حتى الآن.</p>
                        </div>
                      );
                    }

                    // Helper to get quadrant key for item
                    const getItemQuad = (item: any) => {
                      if (item.status === 'Executed' || item.status === 'Approved' || (item.status as string) === 'Completed') {
                        return 'completed';
                      }
                      const q = item.quadrant;
                      if (q === 'do_first' || q === 'urgent_important') return 'do_first';
                      if (q === 'schedule' || q === 'important_not_urgent') return 'schedule';
                      if (q === 'delegate' || q === 'urgent_not_important') return 'delegate';
                      if (q === 'eliminate' || q === 'not_urgent_not_important') return 'eliminate';

                      return getAutomaticEisenhowerQuadrant({
                        dueDate: item.dueDate || item.endDate,
                        priority: item.priority,
                        status: item.status
                      });
                    };

                    const doFirstItems = allEmpItems.filter(i => getItemQuad(i) === 'do_first');
                    const scheduleItems = allEmpItems.filter(i => getItemQuad(i) === 'schedule');
                    const delegateItems = allEmpItems.filter(i => getItemQuad(i) === 'delegate');
                    const eliminateItems = allEmpItems.filter(i => getItemQuad(i) === 'eliminate');
                    const completedItems = allEmpItems.filter(i => getItemQuad(i) === 'completed');

                    return (
                      <div className="space-y-4">
                        {/* Header Banner */}
                        <div className="p-3 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-primary" />
                            <div>
                              <h4 className="font-extrabold text-foreground text-xs">مصفوفة الأولويات الخاصة بالموظف (أيزنهاور)</h4>
                              <p className="text-[11px] text-muted-foreground">تطابق الترتيب والقيم المسجلة في ملف الموظف لتوضيح أسلوبه في إدارة المهام</p>
                            </div>
                          </div>
                          <span className="px-2 py-1 bg-primary text-primary-foreground font-black text-[10px] rounded">
                            {allEmpItems.length - completedItems.length} مهام نشطة
                          </span>
                        </div>

                        {/* 2x2 Quadrant Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Q1: Do First (عاجل ومهم - أفعل أولاً) */}
                          <div className="p-3 bg-red-500/5 border-2 border-red-500/20 rounded-md space-y-2">
                            <div className="flex items-center justify-between pb-2 border-b border-red-500/20">
                              <span className="font-black text-red-600 flex items-center gap-1.5 text-xs">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                🟢 عاجل ومهم (أفعل أولاً)
                              </span>
                              <span className="px-1.5 py-0.5 bg-red-500 text-white font-black text-[10px] rounded-full">
                                {doFirstItems.length}
                              </span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {doFirstItems.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground text-center py-4 italic">لا توجد مهام في هذا الربع</p>
                              ) : (
                                doFirstItems.map((item: any, idx: number) => (
                                  <div key={item.id || idx} className="p-2 bg-card border border-red-500/20 rounded text-[11px] space-y-1 shadow-sm">
                                    <div className="flex items-center justify-between font-bold">
                                      <span className="text-foreground">{item.title}</span>
                                      <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold ${item.isPersonal ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                        {item.isPersonal ? 'التزام شخصي' : 'تكليف رسمي'}
                                      </span>
                                    </div>
                                    {item.description && <p className="text-muted-foreground text-[10px] line-clamp-2">{item.description}</p>}
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                                      <span>الأولوية: {item.priority || 'حرجة'}</span>
                                      <span>الاستحقاق: {item.dueDate || item.endDate || 'غير محدد'}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Q2: Schedule (مهم وغير عاجل - جدولة) */}
                          <div className="p-3 bg-blue-500/5 border-2 border-blue-500/20 rounded-md space-y-2">
                            <div className="flex items-center justify-between pb-2 border-b border-blue-500/20">
                              <span className="font-black text-blue-600 flex items-center gap-1.5 text-xs">
                                <Calendar className="w-3.5 h-3.5" />
                                🔵 مهم وغير عاجل (جدولة)
                              </span>
                              <span className="px-1.5 py-0.5 bg-blue-500 text-white font-black text-[10px] rounded-full">
                                {scheduleItems.length}
                              </span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {scheduleItems.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground text-center py-4 italic">لا توجد مهام في هذا الربع</p>
                              ) : (
                                scheduleItems.map((item: any, idx: number) => (
                                  <div key={item.id || idx} className="p-2 bg-card border border-blue-500/20 rounded text-[11px] space-y-1 shadow-sm">
                                    <div className="flex items-center justify-between font-bold">
                                      <span className="text-foreground">{item.title}</span>
                                      <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold ${item.isPersonal ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                        {item.isPersonal ? 'التزام شخصي' : 'تكليف رسمي'}
                                      </span>
                                    </div>
                                    {item.description && <p className="text-muted-foreground text-[10px] line-clamp-2">{item.description}</p>}
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                                      <span>الأولوية: {item.priority || 'عالية'}</span>
                                      <span>الاستحقاق: {item.dueDate || item.endDate || 'غير محدد'}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Q3: Delegate (عاجل وغير مهم - تفويض) */}
                          <div className="p-3 bg-amber-500/5 border-2 border-amber-500/20 rounded-md space-y-2">
                            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                              <span className="font-black text-amber-600 flex items-center gap-1.5 text-xs">
                                <UserCheck className="w-3.5 h-3.5" />
                                🟡 عاجل وغير مهم (تفويض)
                              </span>
                              <span className="px-1.5 py-0.5 bg-amber-500 text-white font-black text-[10px] rounded-full">
                                {delegateItems.length}
                              </span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {delegateItems.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground text-center py-4 italic">لا توجد مهام في هذا الربع</p>
                              ) : (
                                delegateItems.map((item: any, idx: number) => (
                                  <div key={item.id || idx} className="p-2 bg-card border border-amber-500/20 rounded text-[11px] space-y-1 shadow-sm">
                                    <div className="flex items-center justify-between font-bold">
                                      <span className="text-foreground">{item.title}</span>
                                      <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold ${item.isPersonal ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                        {item.isPersonal ? 'التزام شخصي' : 'تكليف رسمي'}
                                      </span>
                                    </div>
                                    {item.description && <p className="text-muted-foreground text-[10px] line-clamp-2">{item.description}</p>}
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                                      <span>الأولوية: {item.priority || 'متوسطة'}</span>
                                      <span>الاستحقاق: {item.dueDate || item.endDate || 'غير محدد'}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Q4: Eliminate (غير عاجل وغير مهم - تأجيل) */}
                          <div className="p-3 bg-slate-500/5 border-2 border-slate-500/20 rounded-md space-y-2">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-500/20">
                              <span className="font-black text-slate-600 flex items-center gap-1.5 text-xs">
                                <Archive className="w-3.5 h-3.5" />
                                🔴 غير عاجل وغير مهم (تأجيل)
                              </span>
                              <span className="px-1.5 py-0.5 bg-slate-500 text-white font-black text-[10px] rounded-full">
                                {eliminateItems.length}
                              </span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {eliminateItems.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground text-center py-4 italic">لا توجد مهام في هذا الربع</p>
                              ) : (
                                eliminateItems.map((item: any, idx: number) => (
                                  <div key={item.id || idx} className="p-2 bg-card border border-slate-500/20 rounded text-[11px] space-y-1 shadow-sm">
                                    <div className="flex items-center justify-between font-bold">
                                      <span className="text-foreground">{item.title}</span>
                                      <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold ${item.isPersonal ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                        {item.isPersonal ? 'التزام شخصي' : 'تكليف رسمي'}
                                      </span>
                                    </div>
                                    {item.description && <p className="text-muted-foreground text-[10px] line-clamp-2">{item.description}</p>}
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                                      <span>الأولوية: {item.priority || 'منخفضة'}</span>
                                      <span>الاستحقاق: {item.dueDate || item.endDate || 'غير محدد'}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Completed Tasks Summary Section */}
                        {completedItems.length > 0 && (
                          <div className="pt-3 border-t border-border space-y-2">
                            <h5 className="font-bold text-muted-foreground text-xs flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>المهام المكتملة والإنجازات ({completedItems.length})</span>
                            </h5>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {completedItems.slice(0, 6).map((item: any, idx: number) => (
                                <div key={item.id || idx} className="p-2 bg-emerald-500/5 border border-emerald-500/20 rounded text-[11px] flex items-center justify-between">
                                  <span className="font-bold text-foreground line-clamp-1">{item.title}</span>
                                  <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 font-bold text-[9px]">مكتملة</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 4: ATTENDANCE */}
              {empDrawerTab === 'attendance' && (
                <div className="space-y-3 text-xs">
                  {(() => {
                    const status = getEmpTodayStatus(selectedEmployee);
                    const ov = getEmpOvertimeStats(selectedEmployee);
                    return (
                      <div className="p-4 bg-muted/40 border border-border space-y-3">
                        <div className="flex items-center justify-between font-bold">
                          <span>حالة التوفر اليوم:</span>
                          <span className={`px-3 py-1 ${status.color}`}>{status.label}</span>
                        </div>
                        <div className="text-muted-foreground space-y-1 text-[11px]">
                          <p>ساعات العمل المتوقعة: 08:00 ص - 04:00 م</p>
                          <p>حالة البصمة اليومية: {status.type === 'present' ? 'تم تسجيل الحضور بانتظام' : 'لم يتم تسجيل الحضور اليوم'}</p>
                        </div>
                        <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="p-2 bg-background border border-border">
                            <span className="text-muted-foreground block text-[10px] font-bold">الساعات الإضافية (اليوم):</span>
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                              {ov.todayOvertimeMins > 0 ? `${(ov.todayOvertimeMins / 60).toFixed(1)} ساعة (${ov.todayOvertimeMins} دقيقة)` : 'لا يوجد'}
                            </span>
                          </div>
                          <div className="p-2 bg-background border border-border">
                            <span className="text-muted-foreground block text-[10px] font-bold">إجمالي الإضافي (هذا الشهر):</span>
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                              {ov.monthOvertimeMins > 0 ? `${(ov.monthOvertimeMins / 60).toFixed(1)} ساعة (${ov.monthOvertimeMins} دقيقة)` : 'لا يوجد'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 5: PERFORMANCE */}
              {empDrawerTab === 'performance' && (
                <div className="space-y-4 text-xs">
                  {(() => {
                    const drawerEmpTasks = teamTasks.filter(t => {
                      const empIds = [selectedEmployee?.id, selectedEmployee?.employeeId, selectedEmployee?.userId, selectedEmployee?.email, selectedEmployee?.name].filter(Boolean).map(x => String(x).trim().toLowerCase());
                      const assignedTo = String(t.assignedToId || (t as any).assignedTo || '').trim().toLowerCase();
                      const assignedIds = Array.isArray(t.assignedToIds) ? t.assignedToIds.map(x => String(x).trim().toLowerCase()) : [];
                      return empIds.includes(assignedTo) || assignedIds.some(id => empIds.includes(id));
                    });
                    const drawerDoneTasks = drawerEmpTasks.filter(t => t.status === 'Executed' || t.status === 'Approved' || (t.status as string) === 'Completed').length;
                    const drawerTaskDoneRate = drawerEmpTasks.length > 0 ? Math.round((drawerDoneTasks / drawerEmpTasks.length) * 100) : 100;

                    const drawerOverdueTasks = drawerEmpTasks.filter(t => t.status !== 'Executed' && t.status !== 'Approved' && (t as any).dueDate && (t as any).dueDate < todayStr).length;
                    const drawerPunctualityRate = drawerEmpTasks.length > 0 ? Math.round(((drawerEmpTasks.length - drawerOverdueTasks) / drawerEmpTasks.length) * 100) : 100;

                    return (
                      <div className="p-4 bg-muted/40 border border-border space-y-3">
                        <h4 className="font-black text-foreground">مؤشرات الأداء السريع (KPIs)</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 bg-background border border-border text-center">
                            <span className="text-muted-foreground text-[10px] block">نسبة إنجاز المهام:</span>
                            <span className="text-base font-black text-emerald-600">{drawerTaskDoneRate}%</span>
                          </div>
                          <div className="p-3 bg-background border border-border text-center">
                            <span className="text-muted-foreground text-[10px] block">الالتزام بالمواعيد:</span>
                            <span className="text-base font-black text-primary">{drawerPunctualityRate}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* TAB 6: LEAVES & MISSIONS */}
              {empDrawerTab === 'leaves_missions' && (
                <div className="space-y-3 text-xs">
                  {(() => {
                    const empLM = [...teamLeaveRequests, ...teamMissions].filter(r => r.employeeId === selectedEmployee.id || r.employeeId === selectedEmployee.employeeId || (r as any).employeeName === selectedEmployee.name);
                    if (empLM.length === 0) {
                      return <div className="text-center py-8 text-xs font-bold text-muted-foreground">لا توجد إجازات أو مأموريات مسجلة لهذا الموظف</div>;
                    }
                    return empLM.map((r: any) => {
                      const isMission = 'missionTypeId' in r || missions.some(m => m.id === r.id);
                      const rawEval = r.evaluation;
                      const evalObj: MissionEvaluation | null = rawEval ? (typeof rawEval === 'string' ? JSON.parse(rawEval) : rawEval) : null;

                      return (
                        <div key={r.id} className="p-3 bg-muted/40 border border-border space-y-2">
                          <div className="flex items-center justify-between font-bold flex-wrap gap-1">
                            <span className="text-foreground">{isMission ? 'مأمورية عمل خارجية' : (r.type || 'إجازة رسمية')}</span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold border ${r.status === 'Completed' || r.status === 'Executed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                              {r.status === 'Completed' || r.status === 'Executed' ? 'مكتملة ومُقيّمة' : r.status}
                            </span>
                          </div>

                          <p className="text-muted-foreground text-[11px]">{r.notes || r.reason || 'إجازة / مأمورية رسمية'}</p>
                          <div className="text-[10px] text-muted-foreground font-semibold">التاريخ: {r.startDate || r.date} {r.endDate ? `إلى ${r.endDate}` : ''}</div>

                          {isMission && (
                            <div className="pt-2 border-t border-border flex items-center justify-between gap-2 flex-wrap">
                              {evalObj ? (
                                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 font-mono font-bold text-[10px] border border-emerald-500/20">
                                  ⭐ تقييم المأمورية: {evalObj.finalScore}% ({evalObj.ratingGrade || 'مكتمل'})
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-600">غير مقيّمة بعد</span>
                              )}

                              <button
                                type="button"
                                onClick={() => setEvaluatingMission({ ...r, employeeName: selectedEmployee.name, department: getEmpDepartmentName(selectedEmployee) })}
                                className="px-3 py-1 bg-primary text-primary-foreground font-bold text-[11px] hover:bg-primary/90 flex items-center gap-1 cursor-pointer"
                              >
                                <Award className="w-3.5 h-3.5 text-amber-300" />
                                {evalObj ? 'عرض / تعديل التقييم' : 'تقييم المأمورية'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Attendance History by Month Modal */}
      <AnimatePresence>
        {showAttendanceHistoryModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card border-2 border-border p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto space-y-4 text-right"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-base font-black text-foreground flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  سجل الحضور والتوفر للأيام السابقة حسب الشهر
                </h3>
                <button
                  onClick={() => setShowAttendanceHistoryModal(false)}
                  className="p-1 hover:bg-muted font-bold text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {/* Modal Controls */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/40 p-3 border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">اختر الشهر:</span>
                  <input
                    type="month"
                    value={historyMonth}
                    onChange={e => setHistoryMonth(e.target.value)}
                    className="px-3 py-1.5 bg-background border border-border text-xs font-mono font-bold"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">فلترة حسب الموظف:</span>
                  <select
                    value={historyEmpFilter}
                    onChange={e => setHistoryEmpFilter(e.target.value)}
                    className="px-3 py-1.5 bg-background border border-border text-xs font-bold"
                  >
                    <option value="all">جميع موظفي الفريق</option>
                    {filteredTeamMembers.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Records List Table */}
              <div className="border border-border overflow-x-auto">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted border-b border-border font-black text-muted-foreground">
                      <th className="p-3">التاريخ</th>
                      <th className="p-3">الموظف</th>
                      <th className="p-3">الإدارة</th>
                      <th className="p-3">وقت بدء العمل (In)</th>
                      <th className="p-3">وقت الانتهاء (Out)</th>
                      <th className="p-3">حالة الحضور والتوفر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {(() => {
                      const recordsForMonth = attendanceRecords.filter(r => {
                        const recDate = r.timestamp || (r as any).date || (r as any).createdAt || (r as any).attendanceDate || '';
                        return historyMonth ? recDate.startsWith(historyMonth) : true;
                      });

                      if (recordsForMonth.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-xs font-bold text-muted-foreground">
                              لا توجد سجلات حضور مسجلة لشهر {historyMonth}.
                            </td>
                          </tr>
                        );
                      }

                      return recordsForMonth.map((r, idx) => {
                        const recEmpId = String(r.employeeId || (r as any).userId || (r as any).email || '').trim().toLowerCase();
                        const matchingEmp = filteredTeamMembers.find(e => {
                          const ids = [e.id, e.employeeId, e.userId, e.email, e.name].filter(Boolean).map(x => String(x).trim().toLowerCase());
                          return ids.includes(recEmpId);
                        });

                        if (historyEmpFilter !== 'all' && matchingEmp?.id !== historyEmpFilter && matchingEmp?.employeeId !== historyEmpFilter) {
                          return null;
                        }

                        const dateStr = (r.timestamp ? r.timestamp.split('T')[0] : (r as any).date || (r as any).attendanceDate || '---');
                        const isCheckIn = r.type === 'In' || (r as any).actionType === 'CheckIn';
                        const isCheckOut = r.type === 'Out' || (r as any).actionType === 'CheckOut';

                        return (
                          <tr key={r.id || idx} className="hover:bg-muted/30">
                            <td className="p-3 font-mono font-bold text-foreground">{dateStr}</td>
                            <td className="p-3 font-bold text-primary">{matchingEmp ? matchingEmp.name : ((r as any).employeeName || (r as any).name || r.employeeId || 'عضو بالفريق')}</td>
                            <td className="p-3 text-muted-foreground">{matchingEmp ? getEmpDepartmentName(matchingEmp) : '---'}</td>
                            <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {isCheckIn 
                                ? formatTime12h(r.timestamp || (r as any).time || (r as any).actionTime, 'ar')
                                : ((r as any).checkInTime ? formatTime12h((r as any).checkInTime, 'ar') : '---')}
                            </td>
                            <td className="p-3 font-mono font-bold text-primary">
                              {isCheckOut 
                                ? formatTime12h(r.timestamp || (r as any).time || (r as any).actionTime, 'ar')
                                : ((r as any).checkOutTime ? formatTime12h((r as any).checkOutTime, 'ar') : '---')}
                            </td>
                            <td className="p-3 font-bold">
                              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px]">
                                {isCheckIn ? 'تسجيل بدء العمل' : isCheckOut ? 'تسجيل الانصراف' : ((r as any).status || 'مسجل')}
                              </span>
                            </td>
                          </tr>
                        );
                      }).filter(Boolean);
                    })()}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-3 border-t border-border">
                <button
                  onClick={() => setShowAttendanceHistoryModal(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Mission Evaluation Modal */}
      {evaluatingMission && (
        <MissionEvaluationModal
          isOpen={!!evaluatingMission}
          onClose={() => setEvaluatingMission(null)}
          mission={evaluatingMission}
          onSubmitEvaluation={handleSubmitMissionEvaluation}
          isSubmitting={isSubmittingEvaluation}
        />
      )}

      {/* MANAGER PENALTY DECISION MODAL */}
      {managerPenaltyModal.isOpen && managerPenaltyModal.penalty && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-border rounded-2xl p-6 w-full max-w-lg text-right space-y-4 shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 font-black text-foreground">
                <AlertTriangle className={`w-5 h-5 ${managerPenaltyModal.action === 'Approved' ? 'text-emerald-600' : 'text-rose-600'}`} />
                <h3 className="text-base">
                  {managerPenaltyModal.roleType === 'DirectManager' ? 'قرار المدير المباشر بشأن الجزاء' : 'قرار ورأي الرئيس الأعلى بشأن الجزاء'}
                </h3>
              </div>
              <button
                onClick={() => setManagerPenaltyModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-muted/30 p-3 rounded-xl space-y-1.5 border border-border">
                <p className="text-foreground font-bold">
                  <strong>الموظف المعني:</strong> {managerPenaltyModal.penalty.employeeName || 'عضو الفريق'}
                </p>
                <p className="text-foreground font-bold">
                  <strong>نوع المخالفة:</strong> {managerPenaltyModal.penalty.violationType} (بتاريخ {managerPenaltyModal.penalty.violationDate})
                </p>
                <p className="text-foreground font-bold">
                  <strong>الجزاء المقترح:</strong> {managerPenaltyModal.penalty.penaltyType} 
                  {managerPenaltyModal.penalty.deductionValue > 0 && ` (خصم ${managerPenaltyModal.penalty.deductionValue} ${managerPenaltyModal.penalty.deductionType === 'Days' ? 'يوم' : 'جنيه'})`}
                </p>
                <p className="text-muted-foreground">
                  <strong>الوصف والبيان:</strong> {managerPenaltyModal.penalty.description}
                </p>
              </div>

              <div>
                <label className="block font-black text-foreground mb-1.5">
                  نوع القرار المتخذ <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setManagerPenaltyModal(prev => ({ ...prev, action: 'Approved' }))}
                    className={`py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      managerPenaltyModal.action === 'Approved'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted border-border'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>موافقة وتمرير</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setManagerPenaltyModal(prev => ({ ...prev, action: 'Objected' }))}
                    className={`py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      managerPenaltyModal.action === 'Objected'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted border-border'
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    <span>اعتراض وإبداء الرأي</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-black text-foreground mb-1.5">
                  {managerPenaltyModal.action === 'Objected' ? 'سبب الاعتراض أو الملاحظات (إلزامي)' : 'ملاحظات إضافية إن وجدت'}
                  {managerPenaltyModal.action === 'Objected' && <span className="text-red-600"> *</span>}
                </label>
                <textarea
                  rows={3}
                  value={managerPenaltyModal.reason}
                  onChange={(e) => setManagerPenaltyModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder={managerPenaltyModal.action === 'Objected' ? 'اكتب بالتفصيل سبب اعتراضك على الجزاء ليتم رفعه للمستوى الأعلى والموارد البشرية...' : 'ملاحظات إدارية موجهة للإدارة...'}
                  className="w-full p-2.5 bg-muted/20 border border-border rounded-xl focus:ring-2 focus:ring-amber-600 outline-none text-foreground font-medium"
                />
              </div>

              <div className="bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-300 font-bold">
                ℹ️ سيتم تسجيل هذا الرأي في السجل الإداري وملف الموظف وإحالته إلى {managerPenaltyModal.roleType === 'DirectManager' ? 'الرئيس الأعلى' : 'الموارد البشرية (HR)'} للبت النهائي.
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <button
                disabled={managerPenaltyModal.submitting || (managerPenaltyModal.action === 'Objected' && !managerPenaltyModal.reason.trim())}
                onClick={handleManagerPenaltyAction}
                className={`flex-1 font-black py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md text-white disabled:opacity-50 ${
                  managerPenaltyModal.action === 'Approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {managerPenaltyModal.submitting ? 'جاري الحفظ...' : 'تأكيد القرار وتمرير المسار'}
              </button>
              <button
                type="button"
                onClick={() => setManagerPenaltyModal(prev => ({ ...prev, isOpen: false }))}
                className="px-5 bg-muted text-foreground font-bold py-2.5 rounded-xl text-xs hover:bg-muted/80 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TASK DETAILS, WORKFLOW AUDIT & EMPLOYEE ACTIVE TASKS MODAL */}
      {viewingTaskDetails && (
        <TaskDetailsModal
          isOpen={!!viewingTaskDetails}
          onClose={() => setViewingTaskDetails(null)}
          task={viewingTaskDetails}
          onEditTask={(task) => handleOpenEditTaskModal(task)}
          allTasks={projectTasks}
          employees={employees}
          projects={projects}
          onSelectTask={(task) => setViewingTaskDetails(task)}
        />
      )}

      {/* WEEKLY SCHEDULE PROFESSIONAL PDF EXPORT MODAL */}
      {showWeeklyPdfModal && (
        <WeeklySchedulePdfModal
          isOpen={showWeeklyPdfModal}
          onClose={() => setShowWeeklyPdfModal(false)}
          weekDetails={weekDetails}
          employees={employees}
          weeklyEmployeesByDept={weeklyEmployeesByDept}
          weeklyEmployeesInView={weeklyEmployeesInView}
          weeklyScheduleDept={weeklyScheduleDept}
          isExecutive={isExecutive}
          weeklyStore={weeklyStore}
          getManagerAssignedTasks={getManagerAssignedTasks}
          getCompletedDayTasksObjects={getCompletedDayTasksObjects}
          getEmpDepartmentName={getEmpDepartmentName}
          systemSettings={systemSettings}
          currentUserName={user?.displayName || (profile as any)?.name || user?.email || 'المدير المباشر'}
        />
      )}
    </div>
  );
};
