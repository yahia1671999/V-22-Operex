import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Trash2, 
  Briefcase, 
  User, 
  FileCheck, 
  ShieldAlert, 
  CheckSquare, 
  Play, 
  HelpCircle,
  X,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Layers,
  ArrowUpRight,
  Sliders,
  Check,
  Users,
  Building2,
  Search,
  Filter,
  BarChart3,
  PieChart,
  TrendingUp,
  SlidersHorizontal,
  UserCheck,
  Eye,
  CalendarCheck,
  Inbox,
  GitFork
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../AuthContext';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../contexts/LanguageContext';
import { db, doc, setDoc } from '../../api';
import { StartTaskModal } from '../common/StartTaskModal';
import { CompleteTaskModal } from '../common/CompleteTaskModal';
import { getTaskExecutionMetrics, formatDateTimeArabic, formatDurationArabic, isOpenTask } from '../../lib/taskUtils';
import { ProjectTask } from '../../types';

// Types for local commitments
export interface Commitment {
  id: string;
  title: string;
  type: 'job_task' | 'meeting' | 'approval' | 'overdue' | 'personal' | 'completed';
  startDate: string;
  endDate?: string;
  completedAt?: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'Completed';
  plannedHours?: number;
  actualHours?: number;
  notes?: string;
  quadrant?: 'do_first' | 'schedule' | 'delegate' | 'eliminate'; // Manual override quadrant
}

export const getAutomaticEisenhowerQuadrant = (item: {
  dueDate?: string;
  endDate?: string;
  priority?: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  status?: string;
}) => {
  const prio = (item.priority || 'Medium').toString().toLowerCase();
  const isImportant = prio === 'critical' || prio === 'high' || prio === 'medium';

  const targetDateStr = item.dueDate || item.endDate;
  if (!targetDateStr) {
    if (prio === 'critical' || prio === 'high') return 'do_first';
    if (prio === 'medium') return 'schedule';
    return 'eliminate';
  }

  const today = new Date();
  today.setHours(0,0,0,0);
  const targetDate = new Date(targetDateStr);
  targetDate.setHours(0,0,0,0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isCompleted = item.status === 'Approved' || item.status === 'Executed' || item.status === 'Completed';
  const isUrgent = (diffDays <= 2 && !isCompleted) || prio === 'critical';

  if (isImportant && isUrgent) {
    return 'do_first';
  }
  if (isImportant && !isUrgent) {
    return 'schedule';
  }
  if (!isImportant && isUrgent) {
    return 'delegate';
  }
  return 'eliminate';
};

interface TaskTimelineMetricsCardProps {
  task: ProjectTask;
  onStart?: () => void;
  onComplete?: () => void;
  onEditStart?: () => void;
  showActions?: boolean;
}

export const TaskTimelineMetricsCard: React.FC<TaskTimelineMetricsCardProps> = ({
  task,
  onStart,
  onComplete,
  onEditStart,
  showActions = true
}) => {
  const { t } = useLanguage();
  const metrics = getTaskExecutionMetrics(task);
  const isCompleted = metrics.isCompleted;
  const isInProgress = metrics.isInProgress;

  return (
    <div className="bg-muted/30 border border-border/80 p-3.5 space-y-2.5 text-right font-sans">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-xs font-black text-foreground">{t('مؤشرات وسجل التنفيذ الزمني (الفعلي والمقدر)')}</span>
        </div>
        <span className={cn("px-2.5 py-0.5 text-[10px] font-black border", metrics.statusBadge.color)}>
          {metrics.statusBadge.text}
        </span>
      </div>

      {/* The 6 specific required metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-right pt-0.5">
        <div className="bg-card p-2 border border-border/50 space-y-0.5">
          <span className="text-[9px] text-muted-foreground font-bold block">{t('وقت الإسناد')}</span>
          <span className="text-[11px] font-black text-foreground block font-mono truncate" title={metrics.assignedAtFormatted}>
            {metrics.assignedAtFormatted}
          </span>
        </div>

        <div className="bg-amber-500/5 p-2 border border-amber-500/20 space-y-0.5">
          <span className="text-[9px] text-amber-700 dark:text-amber-400 font-bold block">{t('الوقت التقديري')}</span>
          <span className="text-[11px] font-black text-amber-600 dark:text-amber-400 block font-mono">
            {metrics.estimatedHoursFormatted}
          </span>
        </div>

        <div className="bg-blue-500/5 p-2 border border-blue-500/20 space-y-0.5">
          <span className="text-[9px] text-blue-700 dark:text-blue-400 font-bold block">{t('وقت البدء')}</span>
          <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 block font-mono truncate" title={metrics.startedAtFormatted}>
            {metrics.startedAtFormatted}
          </span>
        </div>

        <div className="bg-emerald-500/5 p-2 border border-emerald-500/20 space-y-0.5">
          <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-bold block">{t('وقت الانتهاء')}</span>
          <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 block font-mono truncate" title={metrics.completedAtFormatted}>
            {metrics.completedAtFormatted}
          </span>
        </div>

        <div className="bg-indigo-500/5 p-2 border border-indigo-500/20 space-y-0.5">
          <span className="text-[9px] text-indigo-700 dark:text-indigo-400 font-bold block">{t('الوقت الفعلي')}</span>
          <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 block font-mono">
            {metrics.actualTimeFormatted}
          </span>
        </div>

        <div className={cn("p-2 border space-y-0.5", metrics.isDelayed ? "bg-rose-500/5 border-rose-500/20" : "bg-emerald-500/5 border-emerald-500/20")}>
          <div className="flex items-center gap-1 text-[9px] font-bold">
            <span className={metrics.isDelayed ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}>{t('التأخير')}</span>
            <AlertCircle className={cn("w-3 h-3", metrics.isDelayed ? "text-rose-500" : "text-emerald-500")} />
          </div>
          <span className={cn("text-[11px] font-black block font-mono", metrics.isDelayed ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
            {metrics.delayFormatted}
          </span>
        </div>
      </div>

      {showActions && !isCompleted && (
        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/50">
          {!isInProgress && onStart && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onStart(); }}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {t('بدء المهمة')}
            </button>
          )}

          {isInProgress && onEditStart && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEditStart(); }}
              className="px-2.5 py-1.5 bg-background hover:bg-muted text-foreground text-[11px] font-bold flex items-center gap-1 border border-border cursor-pointer shadow-2xs"
            >
              <Edit2 className="w-3 h-3" />
              {t('تعديل البدء/المقدر')}
            </button>
          )}

          {onComplete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onComplete(); }}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              {t('إنهاء المهمة')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const TimeManagement: React.FC = () => {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const { projects, projectTasks, leaveRequests, missions, employees, adminDepartments, refreshData } = useData();
  const { user, profile, isAdmin } = useAuth();

  // Role detection
  const isExecutive = useMemo(() => {
    const roleStr = String(profile?.role || '');
    return isAdmin || roleStr === 'executive_director' || roleStr === 'general_manager' || roleStr === 'admin' || roleStr.includes('exec') || roleStr.includes('general');
  }, [isAdmin, profile]);

  const isManager = useMemo(() => {
    const roleStr = String(profile?.role || '');
    return isExecutive || roleStr === 'department_manager' || roleStr === 'direct_manager' || roleStr.includes('manager') || roleStr.includes('head');
  }, [isExecutive, profile]);

  // Current logged in employee record detection
  const myEmployee = useMemo(() => {
    if (!employees) return null;
    return employees.find(e => 
      (user?.email && e.email && e.email.trim().toLowerCase() === user.email.trim().toLowerCase()) ||
      (user?.uid && (e.userId === user.uid || e.id === user.uid)) ||
      (profile?.employeeId && (e.id === profile.employeeId || e.employeeId === profile.employeeId)) ||
      (profile?.id && e.id === profile.id)
    );
  }, [employees, user, profile]);

  const employeeEmail = user?.email || 'default';
  const employeeId = myEmployee?.id || myEmployee?.employeeId || user?.uid || 'default';

  // State for active view tab
  // Requirements specify matrix is primary default screen
  const [activeTab, setActiveTab] = useState<'eisenhower' | 'assigned' | 'personal' | 'completed' | 'team_dashboard' | 'planner'>('eisenhower');
  
  // Calendar View State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [calendarView, setCalendarView] = useState<'Daily' | 'Weekly' | 'Monthly'>('Monthly');
  const [personalCommitments, setPersonalCommitments] = useState<Commitment[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<any | null>(null);
  
  // Drag and Drop active states
  const [draggedEventId, setDraggedEventId] = useState<string | null>(null);

  // Modal states for Start and Complete Task workflows
  const [taskToStart, setTaskToStart] = useState<ProjectTask | null>(null);
  const [taskToComplete, setTaskToComplete] = useState<ProjectTask | null>(null);

  // Helper to resolve a complete ProjectTask object from event / commitment data
  const resolveTaskObject = (item: any): ProjectTask => {
    if (!item) return null as any;
    if (item.originalTask) return item.originalTask;
    const rawId = item.taskId || item.id;
    const cleanId = String(rawId).replace('task-', '');
    const found = projectTasks.find(t => String(t.id) === cleanId);
    if (found) return found;
    return {
      id: cleanId,
      title: item.title || '',
      description: item.description || item.notes || '',
      status: item.status === 'Completed' ? 'Executed' : (item.taskStatus || item.status || 'Pending'),
      priority: item.priority || 'Medium',
      startDate: item.startDate,
      endDate: item.endDate,
      dueDate: item.endDate || item.startDate,
      estimatedHours: item.plannedHours || item.estimatedHours || 2,
      projectId: item.projectId || null,
      startedAt: item.startedAt,
      actualStartDate: item.actualStartDate || item.startDate,
      actualStartTime: item.actualStartTime,
      completedAt: item.completedAt,
      createdAt: item.createdAt || new Date().toISOString(),
      assignedTo: item.assignedTo,
      assignedToId: item.assignedToId
    } as unknown as ProjectTask;
  };

  const handleOpenStartModal = (item: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const obj = resolveTaskObject(item);
    setTaskToStart(obj);
  };

  const handleOpenCompleteModal = (item: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const obj = resolveTaskObject(item);
    setTaskToComplete(obj);
  };

  // Completion Dialog Modal State
  const [completingTask, setCompletingTask] = useState<any | null>(null);
  const [completionDate, setCompletionDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [completionNotes, setCompletionNotes] = useState<string>('');
  const [isSubmittingCompletion, setIsSubmittingCompletion] = useState<boolean>(false);

  // Completed Tasks Filter State
  const [completedTaskMonth, setCompletedTaskMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [completedTaskWeek, setCompletedTaskWeek] = useState<string>('all');

  // Team Dashboard Filter State
  const [teamDeptFilter, setTeamDeptFilter] = useState<string>('all');
  const [teamSearchTerm, setTeamSearchTerm] = useState<string>('');
  const [selectedTeamMemberDetail, setSelectedTeamMemberDetail] = useState<any | null>(null);

  const [isSubmittingTask, setIsSubmittingTask] = useState<boolean>(false);

  // Auto-migrate legacy localStorage commitments to backend database
  useEffect(() => {
    const key = `salarix_commitments_${employeeEmail}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const empId = myEmployee?.id || myEmployee?.employeeId || employeeId || user?.uid || '';
          const empName = myEmployee?.name || (user as any)?.displayName || employeeEmail || 'الموظف';
          const deptId = myEmployee?.departmentId || (myEmployee as any)?.department || (profile as any)?.departmentId || '';

          Promise.all(parsed.map((c: any) => {
            if (c.id && c.id.startsWith('task-override-')) return Promise.resolve();
            return fetch('/api/project-tasks', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
              },
              body: JSON.stringify({
                title: c.title,
                description: c.notes || 'التزام شخصي محول',
                phase: 'Personal',
                subPhase: 'personal',
                priority: c.priority || 'Medium',
                status: c.status === 'Completed' ? 'Executed' : 'Pending',
                creatorId: empId,
                assignedToId: empId,
                assignedTo: empName,
                assignedToIds: JSON.stringify([empId]),
                departmentId: deptId,
                startDate: c.startDate || new Date().toISOString().split('T')[0],
                endDate: c.startDate || new Date().toISOString().split('T')[0],
                dueDate: c.startDate || new Date().toISOString().split('T')[0],
                estimatedHours: Number(c.plannedHours) || 2,
                createdAt: new Date().toISOString()
              })
            });
          })).then(() => {
            localStorage.removeItem(key);
            refreshData();
          }).catch(e => console.error('Migration error:', e));
        }
      } catch (e) {
        console.error("Error migrating commitments", e);
      }
    }
  }, [employeeEmail, myEmployee, refreshData, user, profile, employeeId]);

  // Add commitment state
  const [newCommitment, setNewCommitment] = useState<Partial<Commitment> & { projectId?: string; phase?: string; subPhase?: string; parentTaskId?: string }>({
    title: '',
    type: 'personal',
    priority: 'Medium',
    plannedHours: 2,
    notes: '',
    projectId: '',
    phase: '',
    subPhase: '',
    parentTaskId: ''
  });
  const [newCommitmentParentSearch, setNewCommitmentParentSearch] = useState('');

  // Edit commitment state
  const [editingCommitment, setEditingCommitment] = useState<any | null>(null);
  const [editCommitmentParentSearch, setEditCommitmentParentSearch] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const handleOpenEditModal = (taskItem: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const rawId = taskItem.taskId || taskItem.originalTask?.id || taskItem.id;
    const cleanId = String(rawId).replace('task-', '');
    const taskObj = projectTasks.find(t => String(t.id) === cleanId) || taskItem.originalTask;
    setEditingCommitment({
      id: cleanId,
      title: taskItem.title || '',
      description: taskItem.description || taskItem.notes || '',
      priority: taskItem.priority || 'Medium',
      startDate: taskItem.startDate || selectedDay,
      endDate: taskItem.endDate || taskItem.startDate || selectedDay,
      plannedHours: taskItem.plannedHours || taskItem.estimatedHours || 2,
      projectId: taskItem.projectId || taskObj?.projectId || '',
      phase: taskItem.phase || taskObj?.phase || '',
      subPhase: taskItem.subPhase || taskObj?.subPhase || '',
      parentTaskId: taskItem.parentTaskId || taskObj?.parentTaskId || ''
    });
    setEditCommitmentParentSearch('');
    setIsEditModalOpen(true);
  };

  const handleSaveEditCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommitment || !editingCommitment.title) return;

    setIsSubmittingEdit(true);
    try {
      const cleanId = String(editingCommitment.id).replace('task-', '');
      const taskObj = projectTasks.find(t => String(t.id) === cleanId);

      const updatedTaskData = {
        ...taskObj,
        title: editingCommitment.title,
        description: editingCommitment.description,
        priority: editingCommitment.priority,
        startDate: editingCommitment.startDate,
        endDate: editingCommitment.endDate,
        dueDate: editingCommitment.endDate,
        estimatedHours: Number(editingCommitment.plannedHours) || 2,
        projectId: editingCommitment.projectId || null,
        phase: editingCommitment.phase || taskObj?.phase || (editingCommitment.projectId ? 'Personal' : undefined),
        subPhase: editingCommitment.subPhase || taskObj?.subPhase || 'personal',
        parentTaskId: editingCommitment.parentTaskId || null,
        updatedAt: new Date().toISOString()
      };

      const res = await fetch(`/api/project-tasks/${cleanId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(updatedTaskData)
      });

      if (res.ok) {
        await refreshData();
        setIsEditModalOpen(false);
        setEditingCommitment(null);
        if (selectedTaskDetail) {
          setSelectedTaskDetail(null);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert('فشل تعديل التزامك الشخصي: ' + (errJson.error || 'خطأ غير معروف'));
      }
    } catch (err: any) {
      console.error('Error updating task:', err);
      alert('حدث خطأ أثناء حفظ التعديل: ' + err.message);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleAddCommitment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommitment.title) return;

    setIsSubmittingTask(true);
    try {
      const empId = myEmployee?.id || myEmployee?.employeeId || employeeId || user?.uid || '';
      const empName = myEmployee?.name || (user as any)?.displayName || employeeEmail || 'الموظف';
      const deptId = myEmployee?.departmentId || (myEmployee as any)?.department || (profile as any)?.departmentId || '';

      const isLinkedToProject = !!newCommitment.projectId;
      const newTaskData = {
        title: newCommitment.title,
        description: newCommitment.notes || 'التزام شخصي خاص',
        phase: isLinkedToProject ? (newCommitment.phase || 'Personal') : 'Personal',
        subPhase: newCommitment.subPhase || 'personal',
        isPersonal: true,
        category: 'personal',
        type: 'personal',
        priority: newCommitment.priority || 'Medium',
        status: 'Pending',
        creatorId: empId,
        assignedToId: empId,
        assignedTo: empName,
        assignedToIds: JSON.stringify([empId]),
        departmentId: deptId,
        startDate: selectedDay,
        endDate: selectedDay,
        dueDate: selectedDay,
        estimatedHours: Number(newCommitment.plannedHours) || 2,
        projectId: newCommitment.projectId || null,
        parentTaskId: newCommitment.parentTaskId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const res = await fetch('/api/project-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(newTaskData)
      });

      if (res.ok) {
        await refreshData();
        setIsAddModalOpen(false);
        setNewCommitment({
          title: '',
          type: 'personal',
          priority: 'Medium',
          plannedHours: 2,
          notes: '',
          projectId: '',
          phase: '',
          subPhase: '',
          parentTaskId: ''
        });
        setNewCommitmentParentSearch('');
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert('فشل إضافة المهمة: ' + (errJson.error || 'خطأ غير معروف'));
      }
    } catch (err: any) {
      console.error('Error adding task:', err);
      alert('حدث خطأ أثناء إضافة المهمة: ' + err.message);
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleDeleteCommitment = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت تأكد من حذف هذه المهمة؟')) return;

    try {
      const cleanId = String(id).replace('task-', '');
      await fetch(`/api/project-tasks/${cleanId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      await refreshData();
    } catch (err) {
      console.error('Error deleting task:', err);
    }
  };

  // Open Task Completion Dialog
  const handleOpenCompletionModal = (taskItem: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCompletingTask(taskItem);
    setCompletionDate(new Date().toISOString().split('T')[0]);
    setCompletionNotes('');
  };

  // Execute Task Completion
  const handleConfirmTaskCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTask) return;

    setIsSubmittingCompletion(true);
    try {
      const rawId = completingTask.taskId || completingTask.originalTask?.id || completingTask.id;
      const cleanId = String(rawId).replace('task-', '');

      const res = await fetch(`/api/project-tasks/${cleanId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          status: 'Executed',
          completedAt: completionDate,
          completionNotes: completionNotes || undefined,
          updatedAt: new Date().toISOString()
        })
      });

      if (res.ok) {
        await refreshData();
      } else {
        const errJson = await res.json().catch(() => ({}));
        alert('فشل تحديث حالة المهمة: ' + (errJson.error || 'خطأ غير معروف'));
      }

      setCompletingTask(null);
    } catch (err) {
      console.error('Error completing task:', err);
    } finally {
      setIsSubmittingCompletion(false);
    }
  };

  // Unified list of all tasks for logged in employee
  const allEvents = useMemo(() => {
    const list: any[] = [];
    const empIds = [
      employeeId, 
      myEmployee?.id, 
      myEmployee?.employeeId, 
      myEmployee?.userId,
      myEmployee?.email,
      myEmployee?.name,
      user?.uid,
      user?.email,
      (user as any)?.displayName,
      profile?.id,
      (profile as any)?.employeeId,
      (profile as any)?.email,
      (profile as any)?.name
    ].filter(Boolean).map(x => String(x).trim().toLowerCase());

    projectTasks.forEach(task => {
      const assignedId = String(task.assignedToId || '').trim().toLowerCase();
      const assignedName = String(task.assignedTo || '').trim().toLowerCase();
      const creatorIdStr = String(task.creatorId || '').trim().toLowerCase();
      let assignedIds: string[] = [];
      if (Array.isArray(task.assignedToIds)) {
        assignedIds = task.assignedToIds.map(x => String(x).trim().toLowerCase());
      } else if (typeof task.assignedToIds === 'string' && (task.assignedToIds as string).trim().startsWith('[')) {
        try {
          const parsed = JSON.parse(task.assignedToIds as string);
          if (Array.isArray(parsed)) assignedIds = parsed.map((x: any) => String(x).trim().toLowerCase());
        } catch (e) {}
      }
      
      const isAssignedToMe = empIds.includes(assignedId) || 
                             empIds.includes(assignedName) || 
                             assignedIds.some(id => empIds.includes(id));

      const hasAssignee = Boolean(assignedId || assignedName || (assignedIds && assignedIds.length > 0));
      const isPersonal = Boolean((task as any).isPersonal) || 
                         (task as any).category === 'personal' || 
                         (task as any).type === 'personal' || 
                         String((task as any).subPhase || '').toLowerCase() === 'personal' || 
                         String((task as any).phase || '').toLowerCase() === 'personal' ||
                         Boolean((task as any).description && String((task as any).description).includes('التزام شخصي'));
      const isCreatedByMe = empIds.includes(creatorIdStr) || empIds.includes(String((task as any).createdBy || '').trim().toLowerCase());

      // Task belongs in user's Time Management ONLY IF assigned to them, or personal/unassigned created by them.
      // Tasks assigned to other team members MUST NOT appear in the manager's personal Time Management or affect stats.
      const shouldShowForMe = isAssignedToMe || (isPersonal && isCreatedByMe) || (!hasAssignee && isCreatedByMe);

      if (shouldShowForMe) {
        const isCompleted = task.status === 'Approved' || task.status === 'Executed' || (task.status as string) === 'Completed';
        const start = task.startDate || (task as any).dueDate || task.endDate || new Date().toISOString().split('T')[0];
        
        const today = new Date();
        today.setHours(0,0,0,0);
        let isOverdue = false;
        const dueStr = (task as any).dueDate || task.endDate;
        if (dueStr) {
          const due = new Date(dueStr);
          due.setHours(0,0,0,0);
          isOverdue = due.getTime() < today.getTime() && !isCompleted;
        }

        const calculatedQuadrant = getAutomaticEisenhowerQuadrant({
          dueDate: dueStr,
          priority: (task as any).priority,
          status: task.status
        });

        list.push({
          id: `task-${task.id}`,
          taskId: task.id,
          title: task.title,
          type: isCompleted ? 'completed' : (isOverdue ? 'overdue' : (isPersonal ? 'personal' : 'job_task')),
          startDate: start,
          endDate: dueStr || start,
          completedAt: (task as any).completedAt || (task as any).updatedAt?.split('T')[0],
          startedAt: task.startedAt,
          actualStartDate: task.actualStartDate,
          actualStartTime: task.actualStartTime,
          createdAt: task.createdAt,
          taskStatus: task.status,
          priority: (task as any).priority || 'Medium',
          status: isCompleted ? 'Completed' : 'Pending',
          source: isPersonal ? 'personal' : 'assigned_manager',
          plannedHours: task.estimatedHours || 2,
          estimatedHours: task.estimatedHours || 2,
          actualHours: isCompleted ? (task.estimatedHours || 2) : 0,
          description: task.description || (isPersonal ? t('التزام شخصي خاص') : t('مهمة رسمية مسندة من المدير المباشر')),
          quadrant: calculatedQuadrant,
          projectId: task.projectId,
          originalTask: task
        });
      }
    });

    return list;
  }, [projectTasks, employeeId, myEmployee, user, profile, t]);

  // Tasks specifically for Priority Matrix (Pending tasks)
  const activeMatrixEvents = useMemo(() => {
    return allEvents.filter(e => e.status !== 'Completed' && e.type !== 'completed');
  }, [allEvents]);

  // Tasks assigned by manager specifically
  const managerAssignedEvents = useMemo(() => {
    return allEvents.filter(e => e.source === 'assigned_manager');
  }, [allEvents]);

  // Personal commitments specifically
  const personalEventsOnly = useMemo(() => {
    return allEvents.filter(e => e.source === 'personal');
  }, [allEvents]);

  // Completed tasks specifically
  const completedEventsOnly = useMemo(() => {
    return allEvents.filter(e => e.status === 'Completed' || e.type === 'completed');
  }, [allEvents]);

  // Daily statistics
  const dailyStats = useMemo(() => {
    const todayStr = currentDate.toISOString().split('T')[0];
    const todayEvents = allEvents.filter(e => {
      if (e.status === 'Completed' || e.type === 'completed') {
        const compDate = (e.completedAt || e.startDate || '').split('T')[0];
        return compDate === todayStr;
      }
      return e.startDate === todayStr;
    });

    const openTasks = activeMatrixEvents.length;
    const managerTasksCount = managerAssignedEvents.filter(e => e.status !== 'Completed').length;
    const completedTasksCount = completedEventsOnly.length;
    const overdueTasks = allEvents.filter(e => e.type === 'overdue').length;

    const totalTodayNum = todayEvents.length;
    const completedTodayNum = todayEvents.filter(e => e.status === 'Completed' || e.type === 'completed').length;

    const completionRate = allEvents.length > 0 
      ? Math.round((completedEventsOnly.length / allEvents.length) * 100) 
      : 0;

    return {
      openTasks,
      managerTasksCount,
      completedTasksCount,
      overdueTasks,
      totalTodayNum,
      completedTodayNum,
      completionRate
    };
  }, [allEvents, activeMatrixEvents, managerAssignedEvents, completedEventsOnly, currentDate]);

  // Calendar Helper Functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const startDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month, 1).getDay();
  };

  const getMonthNameAr = (date: Date) => {
    const monthsAr = [
      t('يناير'), t('فبراير'), t('مارس'), t('أبريل'), t('مايو'), t('يونيو'),
      t('يوليو'), t('أغسطس'), t('سبتمبر'), t('أكتوبر'), t('نوفمبر'), t('ديسمبر')
    ];
    return monthsAr[date.getMonth()];
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const formattedSelectedDayText = useMemo(() => {
    const d = new Date(selectedDay);
    const dayName = d.toLocaleDateString('ar-EG', { weekday: 'long' });
    const dayNum = d.getDate();
    const monthName = d.toLocaleDateString('ar-EG', { month: 'long' });
    return `${dayName}، ${dayNum} ${monthName}`;
  }, [selectedDay]);

  // Handle manual quadrant change for Drag-And-Drop / Dropdown
  const handleMoveEventToQuadrant = async (eventId: string, targetQuadrant: 'do_first' | 'schedule' | 'delegate' | 'eliminate') => {
    try {
      const cleanId = String(eventId).replace('task-', '');
      const evt = allEvents.find(e => e.id === eventId || e.taskId === cleanId || String(e.id) === cleanId);

      let priorityMap: Record<string, string> = {
        'do_first': 'Critical',
        'schedule': 'High',
        'delegate': 'Medium',
        'eliminate': 'Low'
      };
      const newPriority = priorityMap[targetQuadrant] || 'Medium';

      const taskObj = projectTasks.find(t => String(t.id) === cleanId);
      if (taskObj) {
        await fetch(`/api/project-tasks/${cleanId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            ...taskObj,
            priority: newPriority,
            updatedAt: new Date().toISOString()
          })
        });
        await refreshData();
      }

      // Store local commitment override so quadrant reflects in personal list
      if (employeeEmail) {
        try {
          const key = `salarix_commitments_${employeeEmail.toLowerCase().trim()}`;
          const saved = localStorage.getItem(key);
          if (saved) {
            let parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              let found = false;
              parsed = parsed.map((c: any) => {
                if (c.id === eventId || c.id === cleanId) {
                  found = true;
                  return { ...c, quadrant: targetQuadrant, priority: newPriority };
                }
                return c;
              });
              if (!found) {
                parsed.push({
                  id: `task-override-${cleanId}`,
                  quadrant: targetQuadrant,
                  priority: newPriority
                });
              }
              localStorage.setItem(key, JSON.stringify(parsed));
            }
          }
        } catch (e) {}
      }
    } catch (err: any) {
      console.error('Error updating task quadrant priority:', err);
      alert('تعذر تعديل أولوية المهمة: ' + (err.message || ''));
    }
  };

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedEventId(id);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, quadrant: 'do_first' | 'schedule' | 'delegate' | 'eliminate') => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedEventId;
    if (id) {
      handleMoveEventToQuadrant(id, quadrant);
    }
    setDraggedEventId(null);
  };

  const selectedDayEvents = useMemo(() => {
    return allEvents.filter(e => {
      if (e.status === 'Completed' || e.type === 'completed') {
        const compDate = (e.completedAt || e.startDate || '').split('T')[0];
        return compDate === selectedDay;
      }
      return e.startDate === selectedDay;
    });
  }, [allEvents, selectedDay]);

  // Team Dashboard Calculation for Requirement 5
  const teamDashboardData = useMemo(() => {
    let teamEmps = employees;

    // Filter by department if selected
    if (teamDeptFilter !== 'all') {
      teamEmps = teamEmps.filter(e => (e.departmentId || (e as any).department) === teamDeptFilter);
    }

    // Filter by search term
    if (teamSearchTerm.trim()) {
      const term = teamSearchTerm.toLowerCase();
      teamEmps = teamEmps.filter(e => 
        e.name?.toLowerCase().includes(term) || 
        e.employeeId?.toLowerCase().includes(term) ||
        (e as any).jobTitle?.toLowerCase().includes(term)
      );
    }

    // Compute stats per team member
    const memberStats = teamEmps.map(emp => {
      const empIds = [emp.id, emp.employeeId, emp.email?.trim().toLowerCase()].filter(Boolean).map(x => String(x).toLowerCase());

      // 1. Manager Assigned Tasks
      const empAssignedTasks = projectTasks.filter(t => {
        const aId = String(t.assignedToId || (t as any).assignedTo || '').trim().toLowerCase();
        const aIds = Array.isArray(t.assignedToIds) ? t.assignedToIds.map(x => String(x).toLowerCase()) : [];
        return empIds.includes(aId) || aIds.some(id => empIds.includes(id));
      });

      // 2. Personal Commitments (try loading from localStorage key for this employee)
      let empPersonalCommits: Commitment[] = [];
      try {
        const saved = localStorage.getItem(`salarix_commitments_${emp.email}`);
        if (saved) empPersonalCommits = JSON.parse(saved);
      } catch (e) {}

      // Combine for active matrix & completed
      const activeManagerTasks = empAssignedTasks.filter(t => t.status !== 'Executed' && t.status !== 'Approved' && (t.status as string) !== 'Completed');
      const completedManagerTasks = empAssignedTasks.filter(t => t.status === 'Executed' || t.status === 'Approved' || (t.status as string) === 'Completed');

      const activePersonalTasks = empPersonalCommits.filter(c => c.status !== 'Completed' && !c.id.startsWith('task-override-'));
      const completedPersonalTasks = empPersonalCommits.filter(c => c.status === 'Completed' && !c.id.startsWith('task-override-'));

      const activeMatrixCount = activeManagerTasks.length + activePersonalTasks.length;
      const completedCount = completedManagerTasks.length + completedPersonalTasks.length;
      const totalCount = activeMatrixCount + completedCount;

      const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

      return {
        employee: emp,
        empAssignedTasks,
        empPersonalCommits,
        activeManagerTasks,
        activePersonalTasks,
        completedManagerTasks,
        completedPersonalTasks,
        activeMatrixCount,
        completedCount,
        totalCount,
        completionRate
      };
    });

    // Overall summaries
    const totalTeamActiveMatrix = memberStats.reduce((acc, m) => acc + m.activeMatrixCount, 0);
    const totalTeamManagerAssigned = memberStats.reduce((acc, m) => acc + m.empAssignedTasks.length, 0);
    const totalTeamCompleted = memberStats.reduce((acc, m) => acc + m.completedCount, 0);
    const totalTeamAll = totalTeamActiveMatrix + totalTeamCompleted;
    const overallCompletionRate = totalTeamAll > 0 ? Math.round((totalTeamCompleted / totalTeamAll) * 100) : 0;

    return {
      memberStats,
      totalTeamActiveMatrix,
      totalTeamManagerAssigned,
      totalTeamCompleted,
      overallCompletionRate
    };
  }, [employees, projectTasks, teamDeptFilter, teamSearchTerm]);

  return (
    <div className="space-y-8 pb-16" dir="rtl">
      {/* Header Banner */}
      <section className="bg-gradient-to-l from-slate-900 via-slate-900 to-indigo-950 p-8 rounded-none border border-slate-800 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mt-20" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-extrabold text-xs uppercase tracking-widest mb-2">
              <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
              {t('نظام إدارة الوقت والالتزامات ومتابعة مهام الفريق')}
            </div>
            <h1 className="text-3xl font-black mb-1 text-slate-100 flex items-center gap-3">
              أهلاً بك، {myEmployee?.name || profile?.name || user?.displayName || t('الموظف')}
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              متابعة الالتزامات الشخصية، المهام المسندة من المدير، مصفوفة الأولويات، وتقرير إنجاز الفريق
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="p-3 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs inline-flex items-center gap-2 rounded-none transition-all shadow-lg cursor-pointer border-none"
            >
              <Plus className="w-4 h-4" />
              {t('إضافة التزام شخصي')}
            </button>

            <div className="bg-slate-800/80 border border-slate-700/80 p-3 px-4 flex items-center gap-3 rounded-none">
              <CalendarIcon className="w-5 h-5 text-indigo-400" />
              <div className="text-right">
                <span className="block text-[10px] text-slate-400 font-bold uppercase">{t('التاريخ اليوم')}</span>
                <span className="text-xs font-black text-slate-100 font-mono">
                  {new Date().toLocaleDateString('ar-EG', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Summary Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8 pt-6 border-t border-slate-800">
          <div 
            onClick={() => setActiveTab('eisenhower')} 
            className="bg-slate-800/40 p-4 border border-indigo-500/20 rounded-none hover:bg-slate-800/60 transition-all cursor-pointer"
          >
            <span className="text-[10px] text-indigo-400 font-extrabold block mb-1">{t('مصفوفة الأولويات (المفتوحة)')}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-100 font-mono">{dailyStats.openTasks}</span>
              <span className="text-[10px] text-indigo-300 font-bold">{t('مهمة')}</span>
            </div>
          </div>
          
          <div 
            onClick={() => setActiveTab('assigned')}
            className="bg-slate-800/40 p-4 border border-blue-500/20 rounded-none hover:bg-slate-800/60 transition-all cursor-pointer"
          >
            <span className="text-[10px] text-blue-400 font-extrabold block mb-1">{t('مسندة من المدير')}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-400 font-mono">{dailyStats.managerTasksCount}</span>
              <span className="text-[10px] text-blue-300 font-bold">{t('مهمة')}</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('completed')}
            className="bg-slate-800/40 p-4 border border-emerald-500/20 rounded-none hover:bg-slate-800/60 transition-all cursor-pointer"
          >
            <span className="text-[10px] text-emerald-400 font-extrabold block mb-1">{t('المهام المكتملة')}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400 font-mono">{dailyStats.completedTasksCount}</span>
              <span className="text-[10px] text-emerald-300 font-bold">{t('منجزة')}</span>
            </div>
          </div>

          <div 
            onClick={() => setActiveTab('eisenhower')}
            className="bg-slate-800/40 p-4 border border-rose-500/20 rounded-none hover:bg-slate-800/60 transition-all cursor-pointer"
          >
            <span className="text-[10px] text-rose-400 font-extrabold block mb-1">{t('مهام متأخرة/عاجلة')}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-400 font-mono">{dailyStats.overdueTasks}</span>
              <span className="text-[10px] text-rose-300 font-bold">{t('عاجلة')}</span>
            </div>
          </div>

          <div className="col-span-2 md:col-span-1 bg-indigo-500/10 p-4 border border-indigo-500/30 rounded-none">
            <span className="text-[10px] text-indigo-300 font-extrabold block mb-1">{t('نسبة إنجازك الكلية')}</span>
            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-black text-indigo-200 font-mono">{dailyStats.completionRate}%</span>
                <span className="text-[9px] text-white/50">{dailyStats.completedTasksCount}/{allEvents.length}</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-indigo-400 h-full transition-all duration-500" style={{ width: `${dailyStats.completionRate}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Primary Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-card border border-border shadow-sm">
        <button
          onClick={() => setActiveTab('eisenhower')}
          className={cn(
            "p-3 px-5 text-xs font-black transition-all rounded-none cursor-pointer flex items-center gap-2 uppercase border",
            activeTab === 'eisenhower' 
              ? "bg-primary text-primary-foreground border-primary shadow-sm" 
              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          )}
        >
          <Layers className="w-4 h-4" />
          {t('مصفوفة الأولويات (Priority Matrix)')}
          {activeMatrixEvents.length > 0 && (
            <span className="px-1.5 py-0.2 bg-white/20 text-[10px] font-mono rounded-none">
              {activeMatrixEvents.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('assigned')}
          className={cn(
            "p-3 px-5 text-xs font-black transition-all rounded-none cursor-pointer flex items-center gap-2 uppercase border",
            activeTab === 'assigned' 
              ? "bg-primary text-primary-foreground border-primary shadow-sm" 
              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          )}
        >
          <Inbox className="w-4 h-4" />
          {t('المهام المسندة لي')}
          {managerAssignedEvents.length > 0 && (
            <span className="px-1.5 py-0.2 bg-white/20 text-[10px] font-mono rounded-none">
              {managerAssignedEvents.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('personal')}
          className={cn(
            "p-3 px-5 text-xs font-black transition-all rounded-none cursor-pointer flex items-center gap-2 uppercase border",
            activeTab === 'personal' 
              ? "bg-primary text-primary-foreground border-primary shadow-sm" 
              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          )}
        >
          <User className="w-4 h-4" />
          {t('الالتزامات الشخصية')}
          {personalEventsOnly.length > 0 && (
            <span className="px-1.5 py-0.2 bg-white/20 text-[10px] font-mono rounded-none">
              {personalEventsOnly.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={cn(
            "p-3 px-5 text-xs font-black transition-all rounded-none cursor-pointer flex items-center gap-2 uppercase border",
            activeTab === 'completed' 
              ? "bg-primary text-primary-foreground border-primary shadow-sm" 
              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          )}
        >
          <CheckSquare className="w-4 h-4 text-emerald-400" />
          {t('المهام المكتملة')}
          {completedEventsOnly.length > 0 && (
            <span className="px-1.5 py-0.2 bg-emerald-500/30 text-[10px] font-mono rounded-none">
              {completedEventsOnly.length}
            </span>
          )}
        </button>

        {isManager && (
          <button
            onClick={() => setActiveTab('team_dashboard')}
            className={cn(
              "p-3 px-5 text-xs font-black transition-all rounded-none cursor-pointer flex items-center gap-2 uppercase border",
              activeTab === 'team_dashboard' 
                ? "bg-primary text-primary-foreground border-primary shadow-sm" 
                : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/20"
            )}
          >
            <Users className="w-4 h-4" />
            {t('Dashboard فريقي (My Team Dashboard)')}
          </button>
        )}

        <button
          onClick={() => setActiveTab('planner')}
          className={cn(
            "p-3 px-5 text-xs font-black transition-all rounded-none cursor-pointer flex items-center gap-2 uppercase border ms-auto",
            activeTab === 'planner' 
              ? "bg-primary text-primary-foreground border-primary shadow-sm" 
              : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          )}
        >
          <CalendarIcon className="w-4 h-4" />
          {t('التقويم والخطط اليومية')}
        </button>
      </div>

      {/* Main Dynamic View Switcher */}
      <AnimatePresence mode="wait">
        {/* TAB 1: PRIORITY MATRIX (مصفوفة الأولويات) */}
        {activeTab === 'eisenhower' && (
          <motion.div
            key="eisenhower-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Explanatory introduction banner */}
            <div className="bg-card border-x-2 border-y-4 border-slate-900 p-6 rounded-none space-y-4 shadow-md text-right">
              <div className="flex items-start gap-4">
                <Sparkles className="w-7 h-7 text-indigo-500 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <h4 className="font-extrabold text-sm text-foreground">
                    مصفوفة الأولويات الذكية (Priority Matrix)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    تضم المصفوفة كافة <strong>المهام الشخصية</strong> و<strong>المهام المسندة من المدير المباشر</strong>. 
                    قم بتنظيم المهام في الأرباع الأربعة حسب درجة الأهمية والاستعجال. عند الضغط على <strong>إكمال المهمة</strong> تنتقل تلقائيًا إلى تبويب <strong>المهام المكتملة</strong> وتتحدث لدى المدير المباشر.
                  </p>
                </div>
              </div>

              {/* 4 Quadrants Definitions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-dashed border-border">
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border-r-4 border-emerald-500 rounded-none">
                  <span className="text-xs font-black text-emerald-800 dark:text-emerald-400 block">🟢 أفعل أولاً (عاجل وهام)</span>
                  <p className="text-[10px] text-emerald-900/80 dark:text-emerald-300/80 font-medium">مهام ذات تأثير فوري مباشر، يجب تنفيذه اليوم.</p>
                </div>

                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 border-r-4 border-indigo-500 rounded-none">
                  <span className="text-xs font-black text-indigo-800 dark:text-indigo-400 block">🔵 جدوله (غير عاجل وهام)</span>
                  <p className="text-[10px] text-indigo-900/80 dark:text-indigo-300/80 font-medium">مهام استراتيجية خطط لها وحدد لها موعداً مستقبلياً.</p>
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border-r-4 border-amber-500 rounded-none">
                  <span className="text-xs font-black text-amber-800 dark:text-amber-400 block">🟡 فوضه (عاجل وغير مهم)</span>
                  <p className="text-[10px] text-amber-900/80 dark:text-amber-300/80 font-medium">مهام عاجلة تتطلب سرعة استجابة ويمكن تفويضها.</p>
                </div>

                <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border-r-4 border-rose-500 rounded-none">
                  <span className="text-xs font-black text-rose-800 dark:text-rose-400 block">🔴 اهمله (غير عاجل وغير مهم)</span>
                  <p className="text-[10px] text-rose-900/80 dark:text-rose-300/80 font-medium">مهام ذات قيمة منخفضة تسبب التشتت.</p>
                </div>
              </div>
            </div>

            {/* Eisenhower 2x2 Interactive Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Do First (عاجل وهام) */}
              <div 
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, 'do_first')}
                className="bg-gradient-to-br from-emerald-500/5 via-card to-card border-t-4 border-emerald-500 border border-border p-5 space-y-4 hover:shadow-lg transition-all min-h-[380px] flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-emerald-500 inline-block animate-pulse" />
                      افعله (عاجل وهام)
                    </h4>
                    <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-black px-2.5 py-0.5">
                      {activeMatrixEvents.filter(e => e.quadrant === 'do_first').length} مهام
                    </span>
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[280px]">
                    {activeMatrixEvents.filter(e => e.quadrant === 'do_first').length === 0 ? (
                      <div className="border border-dashed border-emerald-300/40 p-8 text-center text-xs text-emerald-800/50 dark:text-emerald-300/50 font-black">
                        لا توجد مهام حالية في هذا المربع
                      </div>
                    ) : (
                      activeMatrixEvents.filter(e => e.quadrant === 'do_first').map(evt => {
                        const resolvedTask = resolveTaskObject(evt);
                        const isStarted = !!resolvedTask.startedAt || resolvedTask.status === 'In Progress';
                        return (
                          <div 
                            key={evt.id} 
                            draggable
                            onDragStart={(e) => onDragStart(e, evt.id)}
                            onClick={() => setSelectedTaskDetail(evt)}
                            className="bg-card p-3 border-r-4 border-emerald-500 border border-border hover:shadow-sm cursor-pointer text-xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-black text-foreground">{evt.title}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isStarted && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 animate-pulse">
                                    قيد التنفيذ
                                  </span>
                                )}
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 shrink-0",
                                  evt.source === 'assigned_manager' 
                                    ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" 
                                    : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                                )}>
                                  {evt.source === 'assigned_manager' ? 'مسندة من المدير' : 'التزام شخصي'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold pt-1 border-t border-border/40">
                              <span>الاستحقاق: {evt.endDate || evt.startDate}</span>
                              <div className="flex items-center gap-1.5">
                                {!isStarted ? (
                                  <button
                                    onClick={(e) => handleOpenStartModal(evt, e)}
                                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                    title="بدء المهمة وتسجيل وقت البدء الفعلي"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-current" /> بدء
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => handleOpenStartModal(evt, e)}
                                    className="px-1.5 py-0.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-[9px] border border-border cursor-pointer"
                                    title="تعديل وقت البدء أو الوقت المقدر"
                                  >
                                    تعديل
                                  </button>
                                )}
                                <button
                                  onClick={(e) => handleOpenCompleteModal(evt, e)}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-0.5"
                                  title="إنهاء المهمة وتسجيل وقت الانتهاء الفعلي وحساب التأخير"
                                >
                                  ✓ إنهاء
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Schedule (غير عاجل وهام) */}
              <div 
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, 'schedule')}
                className="bg-gradient-to-br from-indigo-500/5 via-card to-card border-t-4 border-indigo-600 border border-border p-5 space-y-4 hover:shadow-lg transition-all min-h-[380px] flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-black text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-indigo-600 inline-block" />
                      جدوله (غير عاجل وهام)
                    </h4>
                    <span className="bg-indigo-600/10 text-indigo-700 dark:text-indigo-400 text-xs font-black px-2.5 py-0.5">
                      {activeMatrixEvents.filter(e => e.quadrant === 'schedule').length} مهام
                    </span>
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[280px]">
                    {activeMatrixEvents.filter(e => e.quadrant === 'schedule').length === 0 ? (
                      <div className="border border-dashed border-indigo-300/40 p-8 text-center text-xs text-indigo-800/50 dark:text-indigo-300/50 font-black">
                        لا توجد مهام حالية في هذا المربع
                      </div>
                    ) : (
                      activeMatrixEvents.filter(e => e.quadrant === 'schedule').map(evt => {
                        const resolvedTask = resolveTaskObject(evt);
                        const isStarted = !!resolvedTask.startedAt || resolvedTask.status === 'In Progress';
                        return (
                          <div 
                            key={evt.id} 
                            draggable
                            onDragStart={(e) => onDragStart(e, evt.id)}
                            onClick={() => setSelectedTaskDetail(evt)}
                            className="bg-card p-3 border-r-4 border-indigo-600 border border-border hover:shadow-sm cursor-pointer text-xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-black text-foreground">{evt.title}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isStarted && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 animate-pulse">
                                    قيد التنفيذ
                                  </span>
                                )}
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 shrink-0",
                                  evt.source === 'assigned_manager' 
                                    ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" 
                                    : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                                )}>
                                  {evt.source === 'assigned_manager' ? 'مسندة من المدير' : 'التزام شخصي'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold pt-1 border-t border-border/40">
                              <span>الاستحقاق: {evt.endDate || evt.startDate}</span>
                              <div className="flex items-center gap-1.5">
                                {!isStarted ? (
                                  <button
                                    onClick={(e) => handleOpenStartModal(evt, e)}
                                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                    title="بدء المهمة وتسجيل وقت البدء الفعلي"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-current" /> بدء
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => handleOpenStartModal(evt, e)}
                                    className="px-1.5 py-0.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-[9px] border border-border cursor-pointer"
                                    title="تعديل وقت البدء أو الوقت المقدر"
                                  >
                                    تعديل
                                  </button>
                                )}
                                <button
                                  onClick={(e) => handleOpenCompleteModal(evt, e)}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-0.5"
                                  title="إنهاء المهمة وتسجيل وقت الانتهاء الفعلي وحساب التأخير"
                                >
                                  ✓ إنهاء
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Delegate (عاجل وغير مهم) */}
              <div 
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, 'delegate')}
                className="bg-gradient-to-br from-amber-500/5 via-card to-card border-t-4 border-amber-500 border border-border p-5 space-y-4 hover:shadow-lg transition-all min-h-[380px] flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-black text-amber-700 dark:text-amber-400 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-amber-500 inline-block animate-pulse" />
                      فوضه (عاجل وغير مهم)
                    </h4>
                    <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-black px-2.5 py-0.5">
                      {activeMatrixEvents.filter(e => e.quadrant === 'delegate').length} مهام
                    </span>
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[280px]">
                    {activeMatrixEvents.filter(e => e.quadrant === 'delegate').length === 0 ? (
                      <div className="border border-dashed border-amber-300/40 p-8 text-center text-xs text-amber-800/50 dark:text-amber-300/50 font-black">
                        لا توجد مهام حالية في هذا المربع
                      </div>
                    ) : (
                      activeMatrixEvents.filter(e => e.quadrant === 'delegate').map(evt => {
                        const resolvedTask = resolveTaskObject(evt);
                        const isStarted = !!resolvedTask.startedAt || resolvedTask.status === 'In Progress';
                        return (
                          <div 
                            key={evt.id} 
                            draggable
                            onDragStart={(e) => onDragStart(e, evt.id)}
                            onClick={() => setSelectedTaskDetail(evt)}
                            className="bg-card p-3 border-r-4 border-amber-500 border border-border hover:shadow-sm cursor-pointer text-xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-black text-foreground">{evt.title}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isStarted && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 animate-pulse">
                                    قيد التنفيذ
                                  </span>
                                )}
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 shrink-0",
                                  evt.source === 'assigned_manager' 
                                    ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" 
                                    : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                                )}>
                                  {evt.source === 'assigned_manager' ? 'مسندة من المدير' : 'التزام شخصي'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold pt-1 border-t border-border/40">
                              <span>الاستحقاق: {evt.endDate || evt.startDate}</span>
                              <div className="flex items-center gap-1.5">
                                {!isStarted ? (
                                  <button
                                    onClick={(e) => handleOpenStartModal(evt, e)}
                                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                    title="بدء المهمة وتسجيل وقت البدء الفعلي"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-current" /> بدء
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => handleOpenStartModal(evt, e)}
                                    className="px-1.5 py-0.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-[9px] border border-border cursor-pointer"
                                    title="تعديل وقت البدء أو الوقت المقدر"
                                  >
                                    تعديل
                                  </button>
                                )}
                                <button
                                  onClick={(e) => handleOpenCompleteModal(evt, e)}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-0.5"
                                  title="إنهاء المهمة وتسجيل وقت الانتهاء الفعلي وحساب التأخير"
                                >
                                  ✓ إنهاء
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Eliminate (غير عاجل وغير مهم) */}
              <div 
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, 'eliminate')}
                className="bg-gradient-to-br from-rose-500/5 via-card to-card border-t-4 border-rose-500 border border-border p-5 space-y-4 hover:shadow-lg transition-all min-h-[380px] flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-black text-rose-700 dark:text-rose-400 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-rose-500 inline-block" />
                      اهمله (غير عاجل وغير مهم)
                    </h4>
                    <span className="bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-black px-2.5 py-0.5">
                      {activeMatrixEvents.filter(e => e.quadrant === 'eliminate').length} مهام
                    </span>
                  </div>

                  <div className="space-y-2 overflow-y-auto max-h-[280px]">
                    {activeMatrixEvents.filter(e => e.quadrant === 'eliminate').length === 0 ? (
                      <div className="border border-dashed border-rose-300/40 p-8 text-center text-xs text-rose-800/50 dark:text-rose-300/50 font-black">
                        لا توجد مهام حالية في هذا المربع
                      </div>
                    ) : (
                      activeMatrixEvents.filter(e => e.quadrant === 'eliminate').map(evt => {
                        const resolvedTask = resolveTaskObject(evt);
                        const isStarted = !!resolvedTask.startedAt || resolvedTask.status === 'In Progress';
                        return (
                          <div 
                            key={evt.id} 
                            draggable
                            onDragStart={(e) => onDragStart(e, evt.id)}
                            onClick={() => setSelectedTaskDetail(evt)}
                            className="bg-card p-3 border-r-4 border-rose-500 border border-border hover:shadow-sm cursor-pointer text-xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-black text-foreground">{evt.title}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isStarted && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 animate-pulse">
                                    قيد التنفيذ
                                  </span>
                                )}
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.5 shrink-0",
                                  evt.source === 'assigned_manager' 
                                    ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" 
                                    : "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                                )}>
                                  {evt.source === 'assigned_manager' ? 'مسندة من المدير' : 'التزام شخصي'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold pt-1 border-t border-border/40">
                              <span>الاستحقاق: {evt.endDate || evt.startDate}</span>
                              <div className="flex items-center gap-1.5">
                                {!isStarted ? (
                                  <button
                                    onClick={(e) => handleOpenStartModal(evt, e)}
                                    className="px-2 py-0.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                    title="بدء المهمة وتسجيل وقت البدء الفعلي"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-current" /> بدء
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => handleOpenStartModal(evt, e)}
                                    className="px-1.5 py-0.5 bg-muted hover:bg-muted/80 text-foreground font-bold text-[9px] border border-border cursor-pointer"
                                    title="تعديل وقت البدء أو الوقت المقدر"
                                  >
                                    تعديل
                                  </button>
                                )}
                                <button
                                  onClick={(e) => handleOpenCompleteModal(evt, e)}
                                  className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer flex items-center gap-0.5"
                                  title="إنهاء المهمة وتسجيل وقت الانتهاء الفعلي وحساب التأخير"
                                >
                                  ✓ إنهاء
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: ASSIGNED TO ME (المهام المسندة لي) */}
        {activeTab === 'assigned' && (
          <motion.div
            key="assigned-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-card border border-border p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="text-base font-black text-foreground">المهام المسندة لي من المدير المباشر</h3>
                    <p className="text-xs text-muted-foreground">عرض وافي بجميع المهام والتكليفات الرسمية الصادرة من الإدارة</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-blue-500/10 text-blue-600 border border-blue-500/20 text-xs font-black">
                  إجمالي: {managerAssignedEvents.length} مهمة
                </span>
              </div>

              {managerAssignedEvents.length === 0 ? (
                <div className="text-center py-16 text-xs text-muted-foreground font-semibold italic">
                  لا توجد مهام مسندة لك من المدير المباشر في الوقت الحالي.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {managerAssignedEvents.map(task => {
                    const isCompleted = task.status === 'Completed' || task.type === 'completed';
                    const resolvedTask = resolveTaskObject(task);
                    return (
                      <div 
                        key={task.id}
                        className={cn(
                          "bg-card border-2 p-5 space-y-4 transition-all relative",
                          isCompleted ? "border-emerald-500/40 bg-emerald-500/5 opacity-90" : "border-border hover:border-blue-500"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block mb-1">
                              مهمة رسمية • {task.priority} Priority
                            </span>
                            <h4 className={cn("text-sm font-black text-foreground", isCompleted && "line-through text-muted-foreground")}>
                              {task.title}
                            </h4>
                          </div>
                          <span className={cn(
                            "px-2.5 py-0.5 text-[10px] font-black border shrink-0",
                            isCompleted ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-amber-500/15 text-amber-600 border-amber-500/30"
                          )}>
                            {isCompleted ? 'مكتملة' : 'قيد التنفيذ'}
                          </span>
                        </div>

                        {task.description && (
                          <p className="text-xs text-muted-foreground font-medium line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Full 6-Metric Execution Card */}
                        <TaskTimelineMetricsCard
                          task={resolvedTask}
                          onStart={() => handleOpenStartModal(task)}
                          onEditStart={() => handleOpenStartModal(task)}
                          onComplete={() => handleOpenCompleteModal(task)}
                          showActions={!isCompleted}
                        />

                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <button
                            onClick={() => setSelectedTaskDetail(task)}
                            className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" /> عرض التفاصيل
                          </button>

                          <div className="flex items-center gap-2">
                            {/* Matrix Quadrant Change */}
                            {!isCompleted && (
                              <select
                                value={task.quadrant || 'do_first'}
                                onChange={(e) => handleMoveEventToQuadrant(task.id, e.target.value as any)}
                                className="p-1 bg-background border border-border text-[10px] font-bold"
                              >
                                <option value="do_first">🟢 أفعل أولاً</option>
                                <option value="schedule">🔵 جدوله</option>
                                <option value="delegate">🟡 فوضه</option>
                                <option value="eliminate">🔴 اهمله</option>
                              </select>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 3: PERSONAL COMMITMENTS (الالتزامات الشخصية) */}
        {activeTab === 'personal' && (
          <motion.div
            key="personal-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-card border border-border p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="text-base font-black text-foreground">التزاماتي ومهامي الشخصية</h3>
                    <p className="text-xs text-muted-foreground">إضافة وإدارة التزاماتك الذاتية وتحديد مواعيدها بالأجندة</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center gap-2 cursor-pointer shadow-sm border-none"
                >
                  <Plus className="w-4 h-4" /> إضافة التزام شخصي جديد
                </button>
              </div>

              {personalEventsOnly.length === 0 ? (
                <div className="text-center py-16 text-xs text-muted-foreground font-semibold italic">
                  لم تقم بإضافة أي التزامات شخصية بعد. اضغط على "إضافة التزام شخصي جديد" لإنشاء التزامك الأول.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {personalEventsOnly.map(commit => {
                    const isCompleted = commit.status === 'Completed';
                    const resolvedTask = resolveTaskObject(commit);
                    return (
                      <div 
                        key={commit.id}
                        className={cn(
                          "bg-card border-2 p-5 space-y-4 transition-all",
                          isCompleted ? "border-emerald-500/40 bg-emerald-500/5 opacity-90" : "border-border hover:border-purple-500"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider block mb-1">
                              التزام شخصي • {commit.priority}
                            </span>
                            <h4 className={cn("text-sm font-black text-foreground", isCompleted && "line-through text-muted-foreground")}>
                              {commit.title}
                            </h4>
                          </div>
                          <span className={cn(
                            "px-2.5 py-0.5 text-[10px] font-black border shrink-0",
                            isCompleted ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-purple-500/15 text-purple-600 border-purple-500/30"
                          )}>
                            {isCompleted ? 'مكتمل' : 'قيد الانتظار'}
                          </span>
                        </div>

                        {commit.description && (
                          <p className="text-xs text-muted-foreground font-medium line-clamp-2 leading-relaxed">
                            {commit.description}
                          </p>
                        )}

                        {/* Full 6-Metric Execution Card */}
                        <TaskTimelineMetricsCard
                          task={resolvedTask}
                          onStart={() => handleOpenStartModal(commit)}
                          onEditStart={() => handleOpenStartModal(commit)}
                          onComplete={() => handleOpenCompleteModal(commit)}
                          showActions={!isCompleted}
                        />

                        <div className="flex items-center justify-between pt-2 border-t border-border">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={(e) => handleOpenEditModal(commit, e)}
                              className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> تعديل
                            </button>

                            <button
                              onClick={(e) => handleDeleteCommitment(commit.id, e)}
                              className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> حذف
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TAB 4: COMPLETED TASKS (المهام المكتملة) */}
        {activeTab === 'completed' && (
          <motion.div
            key="completed-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-card border border-border p-6 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-foreground">جدول وسجل المهام المكتملة حسب يوم الإنجاز</h3>
                    <p className="text-xs text-muted-foreground">عرض وافٍ لجميع المهام والالتزامات المنجزة مرتبة ومفهرسة حسب تاريخ ويوم الإكمال الفعلي</p>
                  </div>
                </div>

                {/* Filters & Totals */}
                <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                  <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 border border-border">
                    <span className="text-muted-foreground">الشهر:</span>
                    <input
                      type="month"
                      value={completedTaskMonth}
                      onChange={e => setCompletedTaskMonth(e.target.value)}
                      className="p-1 bg-background border border-border font-bold text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 border border-border">
                    <span className="text-muted-foreground">الأسبوع:</span>
                    <select
                      value={completedTaskWeek}
                      onChange={e => setCompletedTaskWeek(e.target.value)}
                      className="p-1 bg-background border border-border font-bold text-xs"
                    >
                      <option value="all">جميع الأسابيع</option>
                      <option value="w1">الأسبوع الأول (1 - 7)</option>
                      <option value="w2">الأسبوع الثاني (8 - 14)</option>
                      <option value="w3">الأسبوع الثالث (15 - 21)</option>
                      <option value="w4">الأسبوع الرابع (22 - النهاية)</option>
                    </select>
                  </div>

                  <span className="px-3 py-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-black">
                    إجمالي المكتمل: {completedEventsOnly.length}
                  </span>
                </div>
              </div>

              {/* Grouped by Day Completed Tasks Table */}
              <div className="space-y-6">
                {(() => {
                  const filteredCompleted = completedEventsOnly.filter(e => {
                    const rawDate = (e.completedAt || e.startDate || '').split('T')[0];
                    if (!rawDate) return true;

                    if (completedTaskMonth && !rawDate.startsWith(completedTaskMonth)) {
                      return false;
                    }

                    if (completedTaskWeek !== 'all') {
                      const dayNum = parseInt(rawDate.split('-')[2] || '1', 10);
                      if (completedTaskWeek === 'w1' && !(dayNum >= 1 && dayNum <= 7)) return false;
                      if (completedTaskWeek === 'w2' && !(dayNum >= 8 && dayNum <= 14)) return false;
                      if (completedTaskWeek === 'w3' && !(dayNum >= 15 && dayNum <= 21)) return false;
                      if (completedTaskWeek === 'w4' && !(dayNum >= 22)) return false;
                    }

                    return true;
                  });

                  if (filteredCompleted.length === 0) {
                    return (
                      <div className="text-center py-16 bg-muted/10 border border-dashed border-border text-xs font-bold text-muted-foreground italic">
                        لا توجد مهام مكتملة مطابقة للفلتر المحدد
                      </div>
                    );
                  }

                  // Group by completion date
                  const groups: { [date: string]: typeof filteredCompleted } = {};
                  filteredCompleted.forEach(item => {
                    const dKey = (item.completedAt || item.startDate || 'بدون تاريخ').split('T')[0];
                    if (!groups[dKey]) groups[dKey] = [];
                    groups[dKey].push(item);
                  });

                  // Sort dates descending
                  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

                  return sortedDates.map(dateKey => {
                    const dateObj = new Date(dateKey);
                    const formattedDay = !isNaN(dateObj.getTime())
                      ? dateObj.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
                      : dateKey;
                    const items = groups[dateKey];
                    const totalHoursOnDay = items.reduce((acc, curr) => acc + (Number(curr.plannedHours || curr.estimatedHours) || 0), 0);

                    return (
                      <div key={dateKey} className="border border-border bg-card shadow-xs overflow-hidden">
                        {/* Day Header Banner */}
                        <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full" />
                            <h4 className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                              {formattedDay} <span className="font-mono text-[11px] text-muted-foreground">({dateKey})</span>
                            </h4>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                            <span>عدد المهام المنجزة: <span className="font-mono font-black text-foreground">{items.length}</span></span>
                            <span>•</span>
                            <span>إجمالي الساعات: <span className="font-mono font-black text-foreground">{totalHoursOnDay}</span> س</span>
                          </div>
                        </div>

                        {/* Tasks Table for This Day */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-right text-xs border-collapse">
                            <thead>
                              <tr className="bg-muted/40 text-muted-foreground border-b border-border font-black text-[11px]">
                                <th className="p-3">المهمة والمشروع</th>
                                <th className="p-3">وقت الإسناد</th>
                                <th className="p-3">وقت البدء الفعلي</th>
                                <th className="p-3">وقت الانتهاء الفعلي</th>
                                <th className="p-3">التقديري / الفعلي</th>
                                <th className="p-3">مؤشر التأخير</th>
                                <th className="p-3 text-center">الإجراء</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border font-medium">
                              {items.map(task => {
                                const linkedProj = projects.find((p: any) => p.id === task.projectId || p.id === (task.originalTask as any)?.projectId);
                                const phaseName = task.phase || (task.originalTask as any)?.phase;
                                const scopeName = task.subPhase || (task.originalTask as any)?.subPhase;
                                const metrics = getTaskExecutionMetrics(task);

                                return (
                                  <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="p-3">
                                      <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                          <span className="font-black text-foreground">{task.title}</span>
                                          <span className={cn(
                                            "px-1.5 py-0.2 text-[9px] font-bold border shrink-0",
                                            task.source === 'assigned_manager'
                                              ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                              : "bg-purple-500/10 text-purple-600 border-purple-500/20"
                                          )}>
                                            {task.source === 'assigned_manager' ? 'مسندة' : 'شخصي'}
                                          </span>
                                        </div>
                                        {linkedProj && (
                                          <p className="text-[10px] text-primary font-bold ps-5">
                                            {linkedProj.name} {phaseName ? `• ${phaseName}` : ''}
                                          </p>
                                        )}
                                      </div>
                                    </td>

                                    <td className="p-3 font-mono text-[11px] text-muted-foreground">
                                      {metrics.assignedAtFormatted}
                                    </td>

                                    <td className="p-3 font-mono text-[11px] font-bold text-foreground">
                                      {metrics.startedAtFormatted}
                                    </td>

                                    <td className="p-3 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                                      {metrics.completedAtFormatted}
                                    </td>

                                    <td className="p-3 text-[11px]">
                                      <div className="space-y-0.5">
                                        <div className="text-muted-foreground text-[10px]">مقدّر: <span className="font-mono font-bold text-foreground">{metrics.estimatedHoursFormatted}</span></div>
                                        <div className="text-emerald-700 dark:text-emerald-400 font-bold">فعلي: <span className="font-mono font-black">{metrics.actualTimeFormatted}</span></div>
                                      </div>
                                    </td>

                                    <td className="p-3">
                                      {metrics.isDelayed ? (
                                        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 text-[10px] font-black inline-flex items-center gap-1">
                                          <AlertCircle className="w-3 h-3 shrink-0" />
                                          {metrics.delayFormatted}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black inline-flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3 shrink-0" /> {metrics.delayFormatted}
                                        </span>
                                      )}
                                    </td>

                                    <td className="p-3 text-center">
                                      <button
                                        onClick={() => setSelectedTaskDetail(task)}
                                        className="px-3 py-1 bg-muted hover:bg-muted/80 text-foreground font-bold text-[10px] border border-border cursor-pointer inline-flex items-center gap-1"
                                      >
                                        <Eye className="w-3 h-3" /> التفاصيل
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 5: MY TEAM DASHBOARD (Dashboard فريقي للمدير والمدير التنفيذي) */}
        {activeTab === 'team_dashboard' && isManager && (
          <motion.div
            key="team-dashboard-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Team Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-card p-5 border-2 border-primary/30 space-y-1">
                <span className="text-xs font-bold text-muted-foreground block">إجمالي مهام الفريق بالمصفوفة</span>
                <span className="text-2xl font-black text-primary font-mono">{teamDashboardData.totalTeamActiveMatrix}</span>
                <span className="text-[10px] text-muted-foreground block">مهام مفتوحة حالياً لدى الموظفين</span>
              </div>

              <div className="bg-card p-5 border-2 border-blue-500/30 space-y-1">
                <span className="text-xs font-bold text-muted-foreground block">المهام المسندة من المدير</span>
                <span className="text-2xl font-black text-blue-600 font-mono">{teamDashboardData.totalTeamManagerAssigned}</span>
                <span className="text-[10px] text-muted-foreground block">تكليفات صادرة من الإدارة</span>
              </div>

              <div className="bg-card p-5 border-2 border-emerald-500/30 space-y-1">
                <span className="text-xs font-bold text-muted-foreground block">إجمالي المهام المكتملة</span>
                <span className="text-2xl font-black text-emerald-600 font-mono">{teamDashboardData.totalTeamCompleted}</span>
                <span className="text-[10px] text-muted-foreground block">تم إنهاؤها بالكامل</span>
              </div>

              <div className="bg-card p-5 border-2 border-indigo-500/30 space-y-1">
                <span className="text-xs font-bold text-muted-foreground block">معدل الإنجاز الإجمالي للفريق</span>
                <span className="text-2xl font-black text-indigo-600 font-mono">{teamDashboardData.overallCompletionRate}%</span>
                <div className="w-full bg-muted h-1.5 mt-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full" style={{ width: `${teamDashboardData.overallCompletionRate}%` }} />
                </div>
              </div>
            </div>

            {/* Filter controls */}
            <div className="bg-card p-4 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground">تصفية حسب الإدارة:</span>
                <select
                  value={teamDeptFilter}
                  onChange={(e) => setTeamDeptFilter(e.target.value)}
                  className="p-1.5 bg-background border border-border text-xs font-bold"
                >
                  <option value="all">جميع الإدارات</option>
                  {adminDepartments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-64">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="بحث باسم الموظف..."
                  value={teamSearchTerm}
                  onChange={(e) => setTeamSearchTerm(e.target.value)}
                  className="w-full p-1.5 bg-background border border-border text-xs font-bold"
                />
              </div>
            </div>

            {/* Per-Employee Tasks Matrix Breakdown Table */}
            <div className="bg-card border-2 border-border overflow-x-auto shadow-sm">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-muted border-b border-border font-black text-muted-foreground">
                    <th className="p-3">#</th>
                    <th className="p-3">الموظف</th>
                    <th className="p-3">المسمى الوظيفي</th>
                    <th className="p-3 text-center">المهام بمصفوفة الأولويات</th>
                    <th className="p-3 text-center">المهام المسندة من المدير</th>
                    <th className="p-3 text-center">المهام المكتملة</th>
                    <th className="p-3 text-center">نسبة الإنجاز</th>
                    <th className="p-3 text-center">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {teamDashboardData.memberStats.map((stat, idx) => (
                    <tr key={stat.employee.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 text-muted-foreground font-bold">{idx + 1}</td>
                      <td className="p-3 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-primary/10 text-primary font-black flex items-center justify-center text-xs border border-primary/20 shrink-0">
                            {stat.employee.name ? stat.employee.name.charAt(0) : 'U'}
                          </div>
                          <div>
                            <div>{stat.employee.name}</div>
                            <div className="text-[10px] text-muted-foreground font-normal">{stat.employee.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-muted-foreground">{stat.employee.jobTitle || 'موظف'}</td>
                      
                      <td className="p-3 text-center font-bold">
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 font-mono text-xs">
                          {stat.activeMatrixCount}
                        </span>
                      </td>

                      <td className="p-3 text-center font-bold">
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-600 font-mono text-xs">
                          {stat.empAssignedTasks.length}
                        </span>
                      </td>

                      <td className="p-3 text-center font-bold">
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 font-mono text-xs">
                          {stat.completedCount}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-mono font-black text-xs text-foreground">{stat.completionRate}%</span>
                          <div className="w-20 bg-muted h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{ width: `${stat.completionRate}%` }} />
                          </div>
                        </div>
                      </td>

                      <td className="p-3 text-center">
                        <button
                          onClick={() => setSelectedTeamMemberDetail(stat)}
                          className="px-3 py-1 bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 cursor-pointer"
                        >
                          استعراض المهام
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* TAB 6: PLANNER & CALENDAR (الأجندة والتقويم) */}
        {activeTab === 'planner' && (
          <motion.div
            key="planner-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            {/* Calendar display - Column 1 & 2 */}
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-card p-6 border border-border rounded-none shadow-sm space-y-6">
                {/* Month Picker Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handlePrevMonth}
                      className="p-2 border border-border hover:bg-muted transition-colors rounded-none cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <h3 className="text-sm font-black text-foreground min-w-[120px] text-center">
                      {getMonthNameAr(currentDate)} {currentDate.getFullYear()}
                    </h3>
                    <button 
                      onClick={handleNextMonth}
                      className="p-2 border border-border hover:bg-muted transition-colors rounded-none cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Calendar Views Button Group */}
                  <div className="flex gap-1 p-1 bg-muted border border-border/60 rounded-none w-fit">
                    {(['Daily', 'Weekly', 'Monthly'] as const).map(view => (
                      <button
                        key={view}
                        onClick={() => {
                          setCalendarView(view);
                          if (view === 'Daily') {
                            setSelectedDay(new Date().toISOString().split('T')[0]);
                          }
                        }}
                        className={cn(
                          "px-4 py-1.5 text-[10px] font-black transition-all rounded-none cursor-pointer",
                          calendarView === view ? "bg-card text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {view === 'Daily' ? t('عرض يومي') : view === 'Weekly' ? t('عرض أسبوعي') : t('عرض شهري')}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="p-2 px-4 bg-primary text-primary-foreground font-black text-xs inline-flex items-center gap-2 rounded-none hover:bg-primary/95 transition-all shadow-md cursor-pointer border-none"
                  >
                    <Plus className="w-4 h-4" />
                    {t('إضافة التزام شخصي')}
                  </button>
                </div>

                {/* Calendar Layout */}
                {calendarView === 'Monthly' && (
                  <div className="space-y-1">
                    <div className="grid grid-cols-7 text-center font-black text-[10px] text-muted-foreground bg-muted/65 py-2">
                      <div>{t('الأحد')}</div>
                      <div>{t('الأثنين')}</div>
                      <div>{t('الثلاثاء')}</div>
                      <div>{t('الأربعاء')}</div>
                      <div>{t('الخميس')}</div>
                      <div>{t('الجمعة')}</div>
                      <div>{t('السبت')}</div>
                    </div>

                    <div className="grid grid-cols-7 border-r border-b border-border/80">
                      {Array.from({ length: startDayOfMonth(currentDate) }).map((_, idx) => (
                        <div key={`empty-${idx}`} className="h-28 bg-muted/10 border-l border-t border-border/80" />
                      ))}
                      
                      {Array.from({ length: getDaysInMonth(currentDate) }).map((_, idx) => {
                        const dayNum = idx + 1;
                        const curMonthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
                        const curYearStr = currentDate.getFullYear();
                        const dayStrStr = String(dayNum).padStart(2, '0');
                        const fullDateKey = `${curYearStr}-${curMonthStr}-${dayStrStr}`;

                        const isActiveDayToday = new Date().toISOString().split('T')[0] === fullDateKey;
                        const isDaySelected = selectedDay === fullDateKey;
                        const dayEvents = allEvents.filter(e => {
                          if (e.status === 'Completed' || e.type === 'completed') {
                            const compDate = (e.completedAt || e.startDate || '').split('T')[0];
                            return compDate === fullDateKey;
                          }
                          return e.startDate === fullDateKey;
                        });

                        return (
                          <div 
                            key={dayNum}
                            onClick={() => setSelectedDay(fullDateKey)}
                            className={cn(
                              "h-28 p-1.5 border-l border-t border-border/80 text-right flex flex-col justify-between transition-all hover:bg-muted/30 cursor-pointer overflow-hidden",
                              isActiveDayToday && "bg-indigo-500/5 relative after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:bg-indigo-500",
                              isDaySelected && "ring-2 ring-primary/80 bg-primary/5 z-10"
                            )}
                          >
                            <span className={cn(
                              "text-xs font-mono font-black rounded-none px-1.5 py-0.5 inline-block w-fit",
                              isActiveDayToday ? "bg-indigo-600 text-white" : "text-muted-foreground"
                            )}>
                              {dayNum}
                            </span>

                            <div className="space-y-1 overflow-y-auto max-h-[70px] mt-1">
                              {dayEvents.map((evt) => (
                                <div 
                                  key={evt.id} 
                                  onClick={(e) => { e.stopPropagation(); setSelectedTaskDetail(evt); }}
                                  className={cn(
                                    "p-1 text-[8px] font-bold leading-normal truncate rounded-none cursor-pointer hover:opacity-80 transition-opacity", 
                                    evt.status === 'Completed' ? 'bg-slate-400 text-slate-100 line-through' :
                                    evt.source === 'assigned_manager' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
                                  )}
                                >
                                  {evt.title}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Daily Pass Ticket Summary Card - Column 3 */}
            <div className="space-y-8">
              <div className="bg-card border-x-2 border-y-4 border-slate-900 rounded-none shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
                <div className="p-6 space-y-6">
                  <div className="flex justify-between items-center pb-4 border-b border-dashed border-border">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-primary/10 px-2 py-0.5">{t('تذكرة إنجاز يومية')}</span>
                    <span className="text-[9px] font-mono font-black text-muted-foreground">#TKT-{selectedDay}</span>
                  </div>

                  <div className="text-center py-3">
                    <h4 className="text-lg font-black heading-gradient">{formattedSelectedDayText}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-1">{t('نشاط ومعدل كفاءة اليوم')}</p>
                  </div>

                  <div className="space-y-4 bg-muted/40 p-4 border border-border/80">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-muted-foreground">{t('المهام المطلوبة اليوم:')}</span>
                      <span className="font-black text-foreground font-mono">{dailyStats.totalTodayNum}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-emerald-600">{t('مهام مكتملة ومنجزة:')}</span>
                      <span className="font-black text-emerald-600 font-mono">{dailyStats.completedTodayNum}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-rose-600">{t('مهام عاجلة بالمصفوفة:')}</span>
                      <span className="font-black text-rose-600 font-mono">{dailyStats.openTasks}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Completion Modal Dialog */}
      <AnimatePresence>
        {completingTask && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-foreground border-t-4 border-emerald-600 border border-border shadow-2xl w-full max-w-md p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-black text-sm text-foreground">تأكيد إكمال المهمة</h3>
                </div>
                <button
                  onClick={() => setCompletingTask(null)}
                  className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmTaskCompletion} className="space-y-4 text-xs font-bold">
                <div className="p-3 bg-muted/40 border border-border space-y-1">
                  <span className="text-[10px] text-muted-foreground block">عنوان المهمة:</span>
                  <p className="text-xs font-black text-foreground">{completingTask.title}</p>
                </div>

                <div>
                  <label className="block text-foreground mb-1">تاريخ إكمال المهمة:</label>
                  <input
                    type="date"
                    required
                    value={completionDate}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="w-full p-2.5 bg-background border border-border font-mono font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block text-foreground mb-1">ملاحظات الإكمال (اختياري):</label>
                  <textarea
                    rows={2}
                    value={completionNotes}
                    onChange={(e) => setCompletionNotes(e.target.value)}
                    placeholder="ملاحظات حول طريقة التنفيذ أو الإنجاز..."
                    className="w-full p-2 bg-background border border-border font-medium text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setCompletingTask(null)}
                    className="px-4 py-2 bg-muted text-muted-foreground font-bold hover:bg-muted/80 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCompletion}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black cursor-pointer shadow-sm flex items-center gap-1.5"
                  >
                    ✓ تأكيد إكمال المهمة
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Quick Add Personal Commitment Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-hidden" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card w-full max-w-lg sm:max-w-xl max-h-[90vh] flex flex-col border-t-4 border-primary border-x border-b border-border shadow-2xl rounded-2xl overflow-hidden text-right leading-relaxed"
            >
              <div className="bg-primary text-primary-foreground px-5 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
                <h4 className="font-black text-sm flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />{t('إضافة التزام / مهمة شخصية')}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-primary-foreground/80 hover:text-primary-foreground border-none outline-none bg-transparent cursor-pointer p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddCommitment} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto min-h-0 text-xs">
                {/* SUB-TASK / PARENT TASK LINKING */}
                <div className="bg-muted/30 p-3.5 border border-border rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-foreground font-black flex items-center gap-1.5 text-xs">
                      <GitFork className="w-3.5 h-3.5 text-primary rotate-180" />
                      <span>{t('الربط بمهمة رئيسية (إنشاء كمهمة فرعية - Sub-task):')}</span>
                    </label>
                    {newCommitment.parentTaskId && (
                      <button
                        type="button"
                        onClick={() => setNewCommitment(prev => ({ ...prev, parentTaskId: '' }))}
                        className="text-[10px] text-rose-600 hover:underline cursor-pointer font-bold"
                      >
                        {t('إلغاء الربط بالمهمة الرئيسية')}
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={t('ابحث عن المهمة الرئيسية بالاسم...')}
                      value={newCommitmentParentSearch}
                      onChange={e => setNewCommitmentParentSearch(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary font-bold text-xs text-foreground"
                    />
                  </div>

                  <select
                    value={newCommitment.parentTaskId || ''}
                    onChange={e => {
                      const pId = e.target.value;
                      const selectedParent = projectTasks.find(t => String(t.id) === pId);
                      if (selectedParent) {
                        setNewCommitment(prev => ({
                          ...prev,
                          parentTaskId: pId,
                          projectId: selectedParent.projectId || prev.projectId,
                          phase: selectedParent.phase || prev.phase,
                          subPhase: selectedParent.subPhase || prev.subPhase
                        }));
                      } else {
                        setNewCommitment(prev => ({ ...prev, parentTaskId: '' }));
                      }
                    }}
                    className="w-full p-2 bg-background border border-border rounded-lg outline-none focus:border-primary font-bold text-xs text-foreground cursor-pointer"
                  >
                    <option value="">{t('-- بدون مهمة رئيسية (مهمة مستقلة) --')}</option>
                    {projectTasks
                      .filter(t => {
                        if (!newCommitmentParentSearch) return true;
                        return (t.title || '').toLowerCase().includes(newCommitmentParentSearch.toLowerCase());
                      })
                      .slice(0, 50)
                      .map(t => {
                        const parentP = projects.find((p: any) => p.id === t.projectId);
                        return (
                          <option key={t.id} value={t.id}>
                            📌 {t.title} {parentP ? `(${parentP.name})` : ''} {t.assignedTo ? `[${t.assignedTo}]` : ''}
                          </option>
                        );
                      })}
                  </select>

                  {newCommitment.parentTaskId && (() => {
                    const pTask = projectTasks.find(t => String(t.id) === newCommitment.parentTaskId);
                    if (!pTask) return null;
                    const pProj = projects.find((p: any) => p.id === pTask.projectId);
                    return (
                      <div className="p-2.5 bg-primary/10 border border-primary/30 rounded-lg text-[11px] font-bold text-foreground space-y-1">
                        <div className="flex items-center gap-1.5 text-primary">
                          <GitFork className="w-3.5 h-3.5 rotate-180 shrink-0" />
                          <span>{t('سيتم إنشاء هذه المهمة كمهمة فرعية تابعة لـ:')}</span>
                        </div>
                        <p className="font-black text-foreground pr-5">« {pTask.title} »</p>
                        {pProj && (
                          <span className="inline-block text-[10px] bg-background/80 px-2 py-0.5 rounded text-muted-foreground border border-border">
                            📁 {pProj.name}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-muted-foreground">{t('عنوان الالتزام أو المهمة:')}</label>
                  <input
                    type="text"
                    required
                    placeholder={t('مثال: مراجعة المستند المالي مع المحاسب...')}
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
                    value={newCommitment.title || ''}
                    onChange={(e) => setNewCommitment({ ...newCommitment, title: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-muted-foreground">{t('نوع الحدث:')}</label>
                    <select
                      className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
                      value={newCommitment.type || 'personal'}
                      onChange={(e) => setNewCommitment({ ...newCommitment, type: e.target.value as any })}
                    >
                      <option value="personal">{t('التزام شخصي (بنفسجي)')}</option>
                      <option value="meeting">{t('اجتماع عمل (أخضر)')}</option>
                      <option value="job_task">{t('مهمة وظيفية (أزرق)')}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-muted-foreground">{t('التاريخ المحدد:')}</label>
                    <input
                      type="date"
                      required
                      className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-mono font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-muted-foreground">{t('مستوى الأولوية:')}</label>
                    <select
                      className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
                      value={newCommitment.priority || 'Medium'}
                      onChange={(e) => setNewCommitment({ ...newCommitment, priority: e.target.value as any })}
                    >
                      <option value="Critical">{t('حرجة للغاية (Critical)')}</option>
                      <option value="High">{t('عالية (High)')}</option>
                      <option value="Medium">{t('متوسطة (Medium)')}</option>
                      <option value="Low">{t('منخفضة (Low)')}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-muted-foreground">{t('الوقت المقدر (بالساعات):')}</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-mono font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
                      value={newCommitment.plannedHours || 0}
                      onChange={(e) => setNewCommitment({ ...newCommitment, plannedHours: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-muted-foreground">{t('ربط بمشروع محدد (اختياري):')}</label>
                  <select
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                    value={newCommitment.projectId || ''}
                    onChange={(e) => {
                      const newPId = e.target.value;
                      const selP = projects.find((p: any) => p.id === newPId);
                      setNewCommitment({
                        ...newCommitment,
                        projectId: newPId,
                        phase: selP?.phases?.[0] || '',
                        subPhase: selP?.scope?.[0]?.name || 'General'
                      });
                    }}
                  >
                    <option value="">📌 {t('بدون مشروع محدد (تكليف مباشر/شخصي)')}</option>
                    {projects.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        📁 {p.name}
                      </option>
                    ))}
                  </select>

                  {/* DYNAMIC PHASE & SCOPE SELECTION */}
                  {newCommitment.projectId && (() => {
                    const selP = projects.find((p: any) => p.id === newCommitment.projectId);
                    if (!selP) return null;
                    const pPhases = selP.phases || [];
                    const pScopes = selP.scope || [];

                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 mt-2 bg-primary/5 border border-primary/20 rounded-lg">
                        <div>
                          <label className="block mb-1 text-primary font-black text-xs">{t('المرحلة (Phase):')}</label>
                          <select
                            value={newCommitment.phase || ''}
                            onChange={(e) => setNewCommitment({ ...newCommitment, phase: e.target.value })}
                            className="w-full p-2 bg-background border border-border rounded font-bold outline-none focus:border-primary text-xs cursor-pointer text-foreground"
                          >
                            <option value="">{t('-- بدون مرحلة محددة --')}</option>
                            {pPhases.map((phase: string) => (
                              <option key={phase} value={phase}>{phase}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block mb-1 text-primary font-black text-xs">{t('نطاق العمل / Scope (WBS):')}</label>
                          <select
                            value={newCommitment.subPhase || ''}
                            onChange={(e) => setNewCommitment({ ...newCommitment, subPhase: e.target.value })}
                            className="w-full p-2 bg-background border border-border rounded font-bold outline-none focus:border-primary text-xs cursor-pointer text-foreground"
                          >
                            <option value="">{t('-- عام (General) --')}</option>
                            {pScopes.map((sc: any) => (
                              <option key={sc.id || sc.name} value={sc.name}>{sc.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-muted-foreground">{t('تفاصيل أو ملاحظات إضافية:')}</label>
                  <textarea
                    rows={3}
                    placeholder={t('تفاصيل إضافية للمهمة...')}
                    className="w-full p-2.5 bg-background border border-border rounded-lg text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
                    value={newCommitment.notes || ''}
                    onChange={(e) => setNewCommitment({ ...newCommitment, notes: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-border shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2.5 border border-border text-xs font-black hover:bg-muted transition-all cursor-pointer rounded-xl bg-muted/40 text-muted-foreground"
                  >
                    {t('إلغاء')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTask}
                    className="px-5 py-2.5 bg-primary text-primary-foreground text-xs font-black hover:bg-primary/90 shadow-md flex items-center gap-2 rounded-xl cursor-pointer border-none disabled:opacity-50"
                  >
                    {isSubmittingTask ? t('جاري الحفظ...') : t('إضافة الالتزام بالمصفوفة')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Personal Commitment Modal Popup */}
      <AnimatePresence>
        {isEditModalOpen && editingCommitment && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs overflow-hidden" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-foreground border-2 border-border shadow-2xl w-full max-w-lg sm:max-w-xl max-h-[90vh] flex flex-col p-4 sm:p-6 space-y-4 text-right relative rounded-2xl overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-purple-600" />
                  <h3 className="text-base font-black text-foreground">تعديل الالتزام الشخصي</h3>
                </div>
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditCommitment} className="space-y-4 text-xs font-bold flex-1 overflow-y-auto min-h-0 pr-1 pl-1">
                {/* SUB-TASK LINKING IN EDIT MODAL */}
                <div className="bg-muted/30 p-3.5 border border-border rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-foreground font-black flex items-center gap-1.5 text-xs">
                      <GitFork className="w-3.5 h-3.5 text-purple-600 rotate-180" />
                      <span>{t('الربط بمهمة رئيسية (كمهمة فرعية - Sub-task):')}</span>
                    </label>
                    {editingCommitment.parentTaskId && (
                      <button
                        type="button"
                        onClick={() => setEditingCommitment({ ...editingCommitment, parentTaskId: '' })}
                        className="text-[10px] text-rose-600 hover:underline cursor-pointer font-bold"
                      >
                        {t('إلغاء الربط بالمهمة الرئيسية')}
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={t('ابحث عن المهمة الرئيسية بالاسم...')}
                      value={editCommitmentParentSearch}
                      onChange={e => setEditCommitmentParentSearch(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 bg-background border border-border rounded-lg outline-none focus:border-purple-600 font-bold text-xs text-foreground"
                    />
                  </div>

                  <select
                    value={editingCommitment.parentTaskId || ''}
                    onChange={e => {
                      const pId = e.target.value;
                      const selectedParent = projectTasks.find(t => String(t.id) === pId);
                      if (selectedParent) {
                        setEditingCommitment({
                          ...editingCommitment,
                          parentTaskId: pId,
                          projectId: selectedParent.projectId || editingCommitment.projectId,
                          phase: selectedParent.phase || editingCommitment.phase,
                          subPhase: selectedParent.subPhase || editingCommitment.subPhase
                        });
                      } else {
                        setEditingCommitment({ ...editingCommitment, parentTaskId: '' });
                      }
                    }}
                    className="w-full p-2 bg-background border border-border rounded-lg outline-none focus:border-purple-600 font-bold text-xs text-foreground cursor-pointer"
                  >
                    <option value="">{t('-- بدون مهمة رئيسية (مهمة مستقلة) --')}</option>
                    {projectTasks
                      .filter(t => String(t.id) !== String(editingCommitment.id))
                      .filter(t => {
                        if (!editCommitmentParentSearch) return true;
                        return (t.title || '').toLowerCase().includes(editCommitmentParentSearch.toLowerCase());
                      })
                      .slice(0, 50)
                      .map(t => {
                        const parentP = projects.find((p: any) => p.id === t.projectId);
                        return (
                          <option key={t.id} value={t.id}>
                            📌 {t.title} {parentP ? `(${parentP.name})` : ''} {t.assignedTo ? `[${t.assignedTo}]` : ''}
                          </option>
                        );
                      })}
                  </select>

                  {editingCommitment.parentTaskId && (() => {
                    const pTask = projectTasks.find(t => String(t.id) === editingCommitment.parentTaskId);
                    if (!pTask) return null;
                    const pProj = projects.find((p: any) => p.id === pTask.projectId);
                    return (
                      <div className="p-2.5 bg-purple-500/10 border border-purple-500/30 rounded-lg text-[11px] font-bold text-foreground space-y-1">
                        <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                          <GitFork className="w-3.5 h-3.5 rotate-180 shrink-0" />
                          <span>{t('مرتبطة كمهمة فرعية للمهمة الرئيسية:')}</span>
                        </div>
                        <p className="font-black text-foreground pr-5">« {pTask.title} »</p>
                        {pProj && (
                          <span className="inline-block text-[10px] bg-background/80 px-2 py-0.5 rounded text-muted-foreground border border-border">
                            📁 {pProj.name}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground block">عنوان الالتزام الشخصي *</label>
                  <input
                    type="text"
                    required
                    value={editingCommitment.title}
                    onChange={(e) => setEditingCommitment({ ...editingCommitment, title: e.target.value })}
                    className="w-full p-2.5 bg-background border border-border text-foreground text-xs font-bold rounded-lg focus:outline-hidden focus:border-purple-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-foreground block">درجة الأولوية</label>
                    <select
                      value={editingCommitment.priority}
                      onChange={(e) => setEditingCommitment({ ...editingCommitment, priority: e.target.value })}
                      className="w-full p-2.5 bg-background border border-border text-foreground text-xs font-bold rounded-lg"
                    >
                      <option value="Critical">🔴 عاجل وهام جداً (Critical)</option>
                      <option value="High">🔵 مرتفعة (High)</option>
                      <option value="Medium">🟡 متوسطة (Medium)</option>
                      <option value="Low">🟢 منخفضة (Low)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-foreground block">الساعات المخططة</label>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={editingCommitment.plannedHours}
                      onChange={(e) => setEditingCommitment({ ...editingCommitment, plannedHours: e.target.value })}
                      className="w-full p-2.5 bg-background border border-border text-foreground text-xs font-bold font-mono rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-foreground block">تاريخ التكليف / البداية</label>
                    <input
                      type="date"
                      value={editingCommitment.startDate}
                      onChange={(e) => setEditingCommitment({ ...editingCommitment, startDate: e.target.value })}
                      className="w-full p-2.5 bg-background border border-border text-foreground text-xs font-bold font-mono rounded-lg"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-foreground block">تاريخ الاستحقاق / النهاية</label>
                    <input
                      type="date"
                      value={editingCommitment.endDate}
                      onChange={(e) => setEditingCommitment({ ...editingCommitment, endDate: e.target.value })}
                      className="w-full p-2.5 bg-background border border-border text-foreground text-xs font-bold font-mono rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground block">ربط بمشروع (اختياري)</label>
                  <select
                    value={editingCommitment.projectId || ''}
                    onChange={(e) => setEditingCommitment({ ...editingCommitment, projectId: e.target.value })}
                    className="w-full p-2.5 bg-background border border-border text-foreground text-xs font-bold rounded-lg"
                  >
                    <option value="">📌 بدون مشروع محدد (التزام مستقل)</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>📁 {p.name} ({(p as any).code || p.id})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground block">الملاحظات والتفاصيل</label>
                  <textarea
                    rows={3}
                    value={editingCommitment.description}
                    onChange={(e) => setEditingCommitment({ ...editingCommitment, description: e.target.value })}
                    className="w-full p-2.5 bg-background border border-border text-foreground text-xs font-medium rounded-lg focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-border shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="px-4 py-2.5 bg-muted text-muted-foreground font-black text-xs border border-border rounded-xl cursor-pointer hover:bg-muted/80"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingEdit}
                    className="px-5 py-2.5 bg-purple-600 text-white text-xs font-black hover:bg-purple-700 shadow-md cursor-pointer border-none rounded-xl disabled:opacity-50"
                  >
                    {isSubmittingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Task Detail View Modal Popup */}
      <AnimatePresence>
        {selectedTaskDetail && (() => {
          const resolvedTask = resolveTaskObject(selectedTaskDetail);
          const isCompleted = selectedTaskDetail.status === 'Completed' || selectedTaskDetail.type === 'completed';
          return (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" dir="rtl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card text-foreground border-2 border-border shadow-2xl w-full max-w-xl p-6 space-y-6 text-right relative overflow-y-auto max-h-[90vh]"
              >
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-black text-foreground">تفاصيل المهمة وتتبع التنفيذ</h3>
                  </div>
                  <button
                    onClick={() => setSelectedTaskDetail(null)}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-none cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-muted/40 border border-border rounded-none space-y-1">
                    <span className="text-[10px] font-bold text-muted-foreground block">عنوان المهمة</span>
                    <p className="text-sm font-black text-foreground">{selectedTaskDetail.title}</p>
                  </div>

                  {(selectedTaskDetail.description || selectedTaskDetail.notes) && (
                    <div className="p-3 bg-muted/40 border border-border rounded-none space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground block">الوصف والتفاصيل المرفقة</span>
                      <p className="text-xs font-medium text-foreground leading-relaxed whitespace-pre-wrap">{selectedTaskDetail.description || selectedTaskDetail.notes}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted/40 border border-border rounded-none">
                      <span className="text-[10px] font-bold text-muted-foreground block">المصدر</span>
                      <span className="text-xs font-black text-primary">
                        {selectedTaskDetail.source === 'assigned_manager' ? 'مسندة من المدير المباشر' : 'التزام شخصي'}
                      </span>
                    </div>
                    <div className="p-3 bg-muted/40 border border-border rounded-none">
                      <span className="text-[10px] font-bold text-muted-foreground block">الأولوية</span>
                      <span className="text-xs font-black text-rose-600">{selectedTaskDetail.priority || 'Medium'}</span>
                    </div>
                    <div className="p-3 bg-muted/40 border border-border rounded-none">
                      <span className="text-[10px] font-bold text-muted-foreground block">تاريخ الاستحقاق</span>
                      <span className="text-xs font-mono font-bold text-foreground">{selectedTaskDetail.endDate || selectedTaskDetail.startDate || 'غير محدد'}</span>
                    </div>
                    <div className="p-3 bg-muted/40 border border-border rounded-none">
                      <span className="text-[10px] font-bold text-muted-foreground block">مربع مصفوفة الأولويات</span>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        {selectedTaskDetail.quadrant === 'do_first' ? '🟢 أفعل أولاً (عاجل ومهم)' :
                         selectedTaskDetail.quadrant === 'schedule' ? '🔵 جدولة (غير عاجل ومهم)' :
                         selectedTaskDetail.quadrant === 'delegate' ? '🟡 تفويض (عاجل وغير مهم)' : '🔴 اهمله/تأجيل'}
                      </span>
                    </div>
                  </div>

                  {/* 6 Metrics Execution Card */}
                  <TaskTimelineMetricsCard
                    task={resolvedTask}
                    onStart={() => {
                      const task = selectedTaskDetail;
                      setSelectedTaskDetail(null);
                      handleOpenStartModal(task);
                    }}
                    onEditStart={() => {
                      const task = selectedTaskDetail;
                      setSelectedTaskDetail(null);
                      handleOpenStartModal(task);
                    }}
                    onComplete={() => {
                      const task = selectedTaskDetail;
                      setSelectedTaskDetail(null);
                      handleOpenCompleteModal(task);
                    }}
                    showActions={!isCompleted}
                  />

                  {selectedTaskDetail.source === 'assigned_manager' && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 font-bold text-[11px] leading-relaxed">
                      📌 مهمة مسندة رسمياً من المدير المباشر. يمكنك تسجيل ومتابعة أوقات التنفيذ وإكمال المهمة أو تعديل الأولوية ضمن مصفوفة إدارة الوقت.
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    {selectedTaskDetail.source === 'personal_commitment' && (
                      <button
                        onClick={(e) => {
                          const taskToEdit = selectedTaskDetail;
                          setSelectedTaskDetail(null);
                          handleOpenEditModal(taskToEdit, e);
                        }}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs cursor-pointer shadow-sm flex items-center gap-1.5 border-none"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> تعديل البيانات
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedTaskDetail(null)}
                    className="px-6 py-2 bg-muted text-muted-foreground hover:bg-muted/80 font-black text-xs cursor-pointer border border-border"
                  >
                    إغلاق
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}

        {/* Selected Team Member Task Breakdown Modal */}
        {selectedTeamMemberDetail && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card text-foreground border-2 border-border shadow-2xl w-full max-w-2xl p-6 space-y-6 text-right relative overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary/10 text-primary font-black flex items-center justify-center border border-primary/20">
                    {selectedTeamMemberDetail.employee.name ? selectedTeamMemberDetail.employee.name.charAt(0) : 'U'}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-foreground">
                      تقرير مهام الموظف: {selectedTeamMemberDetail.employee.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedTeamMemberDetail.employee.jobTitle || 'موظف'} • نسبة الإنجاز: <span className="font-mono font-black text-primary">{selectedTeamMemberDetail.completionRate}%</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedTeamMemberDetail(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Breakdown lists */}
              <div className="space-y-6 text-xs font-bold">
                {/* Active Matrix Tasks */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-indigo-600 flex items-center gap-2 border-b border-border pb-2">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    المهام المفتوحة بمصفوفة الأولويات ({selectedTeamMemberDetail.activeMatrixCount})
                  </h4>
                  {selectedTeamMemberDetail.activeMatrixCount === 0 ? (
                    <p className="text-muted-foreground text-[11px] italic">لا توجد مهام مفتوحة حالياً لهذا الموظف</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedTeamMemberDetail.activeManagerTasks.map((t: any) => (
                        <div key={t.id} className="p-3 bg-muted/40 border border-border flex items-center justify-between">
                          <span>{t.title} (مسندة من المدير)</span>
                          <span className="text-[10px] bg-blue-500/10 text-blue-600 px-2 py-0.5">قيد التنفيذ</span>
                        </div>
                      ))}
                      {selectedTeamMemberDetail.activePersonalTasks.map((c: any) => (
                        <div key={c.id} className="p-3 bg-muted/40 border border-border flex items-center justify-between">
                          <span>{c.title} (التزام شخصي)</span>
                          <span className="text-[10px] bg-purple-500/10 text-purple-600 px-2 py-0.5">شخصي</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Completed Tasks */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-emerald-600 flex items-center gap-2 border-b border-border pb-2">
                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                    المهام المكتملة ({selectedTeamMemberDetail.completedCount})
                  </h4>
                  {selectedTeamMemberDetail.completedCount === 0 ? (
                    <p className="text-muted-foreground text-[11px] italic">لا توجد مهام مكتملة لهذا الموظف بعد</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedTeamMemberDetail.completedManagerTasks.map((t: any) => (
                        <div key={t.id} className="p-3 bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
                          <span className="line-through text-muted-foreground">{t.title} (مسندة من المدير)</span>
                          <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5">مكتملة</span>
                        </div>
                      ))}
                      {selectedTeamMemberDetail.completedPersonalTasks.map((c: any) => (
                        <div key={c.id} className="p-3 bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between">
                          <span className="line-through text-muted-foreground">{c.title} (التزام شخصي)</span>
                          <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5">مكتملة ({c.completedAt || c.startDate})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  onClick={() => setSelectedTeamMemberDetail(null)}
                  className="px-6 py-2 bg-primary text-primary-foreground font-black text-xs cursor-pointer"
                >
                  إغلاق التقرير
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Global Standard Start Task Modal */}
        {taskToStart && (
          <StartTaskModal
            task={taskToStart}
            isOpen={!!taskToStart}
            onClose={() => setTaskToStart(null)}
            onSuccess={() => {
              setTaskToStart(null);
              refreshData();
            }}
          />
        )}

        {/* Global Standard Complete Task Modal with Delay & Actual Duration Calculations */}
        {taskToComplete && (
          <CompleteTaskModal
            task={taskToComplete}
            isOpen={!!taskToComplete}
            onClose={() => setTaskToComplete(null)}
            onSuccess={() => {
              setTaskToComplete(null);
              refreshData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
