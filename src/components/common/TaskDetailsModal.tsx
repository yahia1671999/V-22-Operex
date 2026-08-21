import React, { useState, useMemo } from 'react';
import { 
  X, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Calendar, 
  User, 
  FolderKanban, 
  Layers, 
  GitFork, 
  Edit3, 
  CheckSquare, 
  Activity, 
  FileText, 
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Briefcase,
  Building2,
  ChevronRight,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  Tag
} from 'lucide-react';
import { ProjectTask, Employee } from '../../types';
import { calculateTaskDelay, getTaskAssignedIds, isOpenTask, getTaskDistinctAssignees, findEmployeeByIdentifier } from '../../lib/taskUtils';

interface TaskDetailsModalProps {
  task: ProjectTask | null;
  isOpen: boolean;
  onClose: () => void;
  onEditTask?: (task: ProjectTask) => void;
  allTasks: ProjectTask[];
  employees: Employee[];
  projects: any[];
  onSelectTask?: (task: ProjectTask) => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  isOpen,
  onClose,
  onEditTask,
  allTasks = [],
  employees = [],
  projects = [],
  onSelectTask,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'tracking' | 'activeTasks'>('details');

  if (!isOpen || !task) return null;

  // 1. Assigned Employees Information (Distinct & Deduplicated)
  const distinctAssignees = getTaskDistinctAssignees(task, employees);
  const primaryAssignee = distinctAssignees[0];
  const assignedEmployee = primaryAssignee?.employee;
  const assignedEmpId = primaryAssignee?.id || task.assignedToId || '';

  const assignedEmpName = primaryAssignee?.name || task.assignedTo || 'غير مسند لموظف';
  const assignedEmpJob = (assignedEmployee as any)?.jobTitle || (assignedEmployee as any)?.position || 'موظف';
  const assignedEmpDept = (assignedEmployee as any)?.department || (assignedEmployee as any)?.departmentName || 'عام';
  const assignedEmpCode = assignedEmployee?.employeeId || '---';

  // 2. Project Information
  const linkedProject = projects.find(p => p.id === task.projectId);
  const projectName = linkedProject?.name || ((task as any).subPhase === 'personal' || (task as any).phase === 'Personal' ? 'مهمة شخصية (إدارة الوقت)' : 'تكليف مباشر');

  // 3. Delay & Timing Analysis
  const delayInfo = calculateTaskDelay(task);
  const isDone = task.status === 'Executed' || task.status === 'Approved' || (task.status as string) === 'Completed';

  // 4. Parent Task & Child Sub-tasks
  const parentTask = task.parentTaskId ? allTasks.find(t => t.id === task.parentTaskId) : null;
  
  // Find child tasks that have this task as their parentTaskId, or in task.subTasks
  const childSubTasks = useMemo(() => {
    const fromParentField = allTasks.filter(t => t.parentTaskId === task.id);
    let fromJsonSubTasks: any[] = [];
    if (Array.isArray(task.subTasks)) {
      fromJsonSubTasks = task.subTasks;
    } else if (typeof task.subTasks === 'string') {
      try {
        const parsed = JSON.parse(task.subTasks);
        if (Array.isArray(parsed)) fromJsonSubTasks = parsed;
      } catch (e) {}
    }
    return { fromParentField, fromJsonSubTasks };
  }, [allTasks, task]);

  // 5. Active Tasks that the employee is currently working on
  const employeeActiveTasks = useMemo(() => {
    if (!assignedEmployee && !assignedEmpId) return [];
    const empIdentifier = assignedEmployee?.id || assignedEmpId;
    const empName = (assignedEmployee?.name || '').trim().toLowerCase();

    return allTasks.filter(t => {
      // Must belong to this employee
      const tAssignedIds = getTaskAssignedIds(t);
      const matchesEmp = 
        tAssignedIds.includes(empIdentifier) ||
        (assignedEmployee?.employeeId && tAssignedIds.includes(assignedEmployee.employeeId)) ||
        (t.assignedToId && t.assignedToId === empIdentifier) ||
        (t.assignedTo && t.assignedTo.trim().toLowerCase() === empName);

      if (!matchesEmp) return false;

      // Must be currently active / open
      const isTaskDone = t.status === 'Executed' || t.status === 'Approved' || (t.status as string) === 'Completed';
      return !isTaskDone;
    });
  }, [allTasks, assignedEmployee, assignedEmpId]);

  // 6. Workflow Log / Audit Trail Parsing
  const parsedWorkflowLogs = useMemo(() => {
    let logs: any[] = [];
    if (Array.isArray(task.workflowLog)) {
      logs = [...task.workflowLog];
    } else if (typeof task.workflowLog === 'string') {
      try {
        const parsed = JSON.parse(task.workflowLog);
        if (Array.isArray(parsed)) logs = [...parsed];
      } catch (e) {}
    }

    // Sort ascending by timestamp
    logs.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());

    // If no workflow logs yet, construct a logical audit trail from task timestamps
    if (logs.length === 0) {
      const syntheticLogs = [];
      if (task.createdAt) {
        syntheticLogs.push({
          timestamp: task.createdAt,
          fromStatus: 'None',
          toStatus: 'Pending',
          userName: (task as any).createdBy || task.creatorId || 'النظام / المدير المباشر',
          action: 'إنشاء وتكليف المهمة',
          notes: 'تم تسجيل وتكليف المهمة في النظام'
        });
      }
      if (task.startedAt || task.actualStartDate) {
        syntheticLogs.push({
          timestamp: task.startedAt || `${task.actualStartDate}T${task.actualStartTime || '09:00:00'}`,
          fromStatus: 'Pending',
          toStatus: 'In Progress',
          userName: assignedEmpName,
          action: 'بدء تنفيذ المهمة',
          notes: 'قام الموظف ببدء العمل على المهمة'
        });
      }
      if (task.status === 'Under Review') {
        syntheticLogs.push({
          timestamp: (task as any).updatedAt || new Date().toISOString(),
          fromStatus: 'In Progress',
          toStatus: 'Under Review',
          userName: assignedEmpName,
          action: 'إرسال المهمة للمراجعة والتدقيق',
          notes: (task as any).completionNotes || 'بانتظار اعتماد المدير المباشر'
        });
      }
      if (isDone) {
        syntheticLogs.push({
          timestamp: task.completedAt || (task as any).updatedAt || new Date().toISOString(),
          fromStatus: 'In Progress',
          toStatus: task.status || 'Executed',
          userName: (task as any).lastModifiedBy || assignedEmpName,
          action: 'إنجاز المهمة وتسليمها',
          notes: (task as any).completionNotes || 'تم إتمام كافة المتطلبات'
        });
      }
      return syntheticLogs;
    }

    return logs;
  }, [task, isDone, assignedEmpName]);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Executed':
      case 'Completed':
      case 'Approved':
        return { label: 'مكتملة ومنفذة', bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', icon: CheckCircle2 };
      case 'In Progress':
        return { label: 'قيد التنفيذ', bg: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30', icon: Clock };
      case 'Under Review':
        return { label: 'قيد المراجعة والاعتماد', bg: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30', icon: AlertCircle };
      case 'Testing':
        return { label: 'مرحلة الاختبار / الفحص', bg: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30', icon: Activity };
      case 'Delayed':
      case 'Overdue':
        return { label: 'متأخرة', bg: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', icon: AlertTriangle };
      case 'Pending':
      default:
        return { label: 'قيد الانتظار / جديدة', bg: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', icon: Clock };
    }
  };

  const statusMeta = getStatusBadge(task.status);
  const StatusIcon = statusMeta.icon;

  const progressPercent = typeof (task as any).progress === 'number' 
    ? (task as any).progress 
    : (isDone ? 100 : task.status === 'In Progress' ? 50 : 0);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-background/80 backdrop-blur-md overflow-y-auto" dir="rtl">
      <div 
        className="bg-card border-2 border-primary/40 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* MODAL HEADER */}
        <div className="bg-primary/5 border-b border-border/80 p-4 sm:p-5 flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-black border rounded-md ${statusMeta.bg}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                <span>{statusMeta.label}</span>
              </span>

              <span className={`px-2.5 py-1 text-xs font-black border rounded-md ${
                task.priority === 'Critical' ? 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30' :
                task.priority === 'High' ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' :
                task.priority === 'Low' ? 'bg-muted text-muted-foreground border-border' :
                'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
              }`}>
                الأولوية: {task.priority === 'Critical' ? 'حاسمة (Critical)' : task.priority === 'High' ? 'عالية جداً (High)' : task.priority === 'Low' ? 'منخفضة (Low)' : 'متوسطة (Medium)'}
              </span>

              {parentTask && (
                <button
                  type="button"
                  onClick={() => onSelectTask?.(parentTask)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 rounded-md transition-all cursor-pointer"
                  title="الانتقال للمهمة الأصلية"
                >
                  <GitFork className="w-3.5 h-3.5" />
                  <span>مهمة فرعية لـ: {parentTask.title}</span>
                </button>
              )}

              {task.phase && task.phase !== 'Personal' && (
                <span className="px-2 py-0.5 bg-muted text-muted-foreground border border-border text-[11px] font-bold rounded-md">
                  المرحلة: {task.phase}
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-black text-foreground leading-snug break-words">
              {task.title}
            </h2>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2 shrink-0">
            {onEditTask && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditTask(task);
                }}
                className="px-3 py-1.5 bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary border border-primary/30 text-xs font-black rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
                title="تعديل بيانات المهمة"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">تعديل المهمة</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center border-b border-border bg-muted/40 px-4 sm:px-5 gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`py-3 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'border-primary text-primary font-black'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>تفاصيل المهمة والمشروع</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tracking')}
            className={`py-3 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'tracking'
                ? 'border-primary text-primary font-black'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>تتبع التنفيذ ومسار العمليات ({parsedWorkflowLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activeTasks')}
            className={`py-3 px-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'activeTasks'
                ? 'border-primary text-primary font-black'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-4 h-4 text-blue-600" />
            <span>المهام التي يعمل عليها الآن ({employeeActiveTasks.length})</span>
          </button>
        </div>

        {/* MODAL CONTENT BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 text-right">
          {/* TAB 1: FULL DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* ASSIGNED EMPLOYEE & PROJECT CARD */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Employee Card */}
                <div className="p-4 bg-card border border-border/80 rounded-xl space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-black text-primary border-b border-border/60 pb-2">
                    <User className="w-4 h-4" />
                    <span>الموظف المسند إليه المهمة</span>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 bg-primary/10 text-primary border border-primary/20 rounded-xl flex items-center justify-center font-black text-base shrink-0">
                      {assignedEmpName ? assignedEmpName.charAt(0) : 'U'}
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="text-sm font-black text-foreground truncate">{assignedEmpName}</div>
                      <div className="text-xs text-muted-foreground font-bold flex items-center gap-2">
                        <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-mono">كود: {assignedEmpCode}</span>
                        <span>{assignedEmpJob}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
                        <span>الإدارة: <strong className="text-foreground">{assignedEmpDept}</strong></span>
                      </div>
                    </div>
                  </div>

                  {distinctAssignees.length > 1 && (
                    <div className="pt-2 border-t border-border/60">
                      <span className="text-[10px] font-black text-muted-foreground block mb-1.5">كل الموظفين المسند إليهم ({distinctAssignees.length}):</span>
                      <div className="flex flex-wrap gap-1.5">
                        {distinctAssignees.map(a => (
                          <span key={a.id} className="bg-primary/10 text-primary border border-primary/20 text-xs font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {a.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Project & Scope Card */}
                <div className="p-4 bg-card border border-border/80 rounded-xl space-y-3 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-black text-primary border-b border-border/60 pb-2">
                    <FolderKanban className="w-4 h-4" />
                    <span>ارتباط المشروع ونطاق العمل</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-bold">المشروع التابع له:</span>
                      <span className="font-black text-foreground bg-primary/5 px-2.5 py-1 border border-primary/20 rounded-md">
                        {projectName}
                      </span>
                    </div>

                    {task.phase && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-bold">مرحلة المشروع (Phase):</span>
                        <span className="font-bold text-foreground">{task.phase}</span>
                      </div>
                    )}

                    {((task as any).scope || (task as any).subPhase) && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground font-bold">نطاق العمل (WBS / Scope):</span>
                        <span className="font-bold text-foreground">{(task as any).scope || (task as any).subPhase}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-border/40 pt-2">
                      <span className="text-muted-foreground font-bold">طبيعة التكليف:</span>
                      <span className="font-bold text-primary">
                        {(task as any).isManagerTask ? 'تكليف إداري رسمي مباشر' : 'مهمة عمل تنظيمية'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* TIMING, ESTIMATED HOURS & DELAY ANALYSIS */}
              <div className="p-4 bg-card border border-border/80 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-2 text-xs font-black text-foreground">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>الجدولة الزمنية ومؤشر الالتزام (Time & SLA Tracking)</span>
                  </div>
                  <span className={`px-2.5 py-0.5 text-xs font-black border rounded-md ${delayInfo.badgeColor}`}>
                    {delayInfo.delayText}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 bg-muted/30 border border-border/60 rounded-lg space-y-1">
                    <span className="text-muted-foreground text-[11px] font-bold block">تاريخ البدء المخطط:</span>
                    <span className="font-mono font-black text-foreground">{task.startDate || 'غير محدد'}</span>
                  </div>

                  <div className="p-2.5 bg-muted/30 border border-border/60 rounded-lg space-y-1">
                    <span className="text-muted-foreground text-[11px] font-bold block">تاريخ الاستحقاق (Due Date):</span>
                    <span className="font-mono font-black text-foreground">{(task as any).dueDate || task.endDate || 'غير محدد'}</span>
                  </div>

                  <div className="p-2.5 bg-muted/30 border border-border/60 rounded-lg space-y-1">
                    <span className="text-muted-foreground text-[11px] font-bold block">الوقت التقديري المعتمد:</span>
                    <span className="font-mono font-black text-primary">
                      {task.estimatedHours ? `${task.estimatedHours} ساعة عمل` : 'غير محدد'}
                    </span>
                  </div>

                  <div className="p-2.5 bg-muted/30 border border-border/60 rounded-lg space-y-1">
                    <span className="text-muted-foreground text-[11px] font-bold block">توقيت الإنجاز الفعلي:</span>
                    <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">
                      {task.completedAt ? new Date(task.completedAt).toLocaleString('ar-EG') : (isDone ? 'منجز' : 'قيد العمل')}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs font-black">
                    <span className="text-muted-foreground">نسبة الإنجاز المحققة:</span>
                    <span className="text-primary font-mono">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-muted h-2.5 rounded-full overflow-hidden border border-border">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${
                        progressPercent === 100 ? 'bg-emerald-500' : 'bg-primary'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* TASK DESCRIPTION & DETAILS */}
              <div className="p-4 bg-card border border-border/80 rounded-xl space-y-2.5 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-black text-foreground border-b border-border/60 pb-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span>الوصف وتفاصيل التكليف</span>
                </div>
                <div className="text-xs text-foreground/90 font-medium whitespace-pre-wrap leading-relaxed bg-muted/20 p-3 rounded-lg border border-border/40 min-h-[60px]">
                  {task.description || 'لا يوجد وصف مدون لهذه المهمة.'}
                </div>

                {(task as any).completionNotes && (
                  <div className="space-y-1 pt-2">
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 block">ملاحظات الإنجاز والتسليم:</span>
                    <div className="text-xs text-foreground font-semibold bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
                      {(task as any).completionNotes}
                    </div>
                  </div>
                )}
              </div>

              {/* CHILD SUB-TASKS LIST (IF ANY) */}
              {(childSubTasks.fromParentField.length > 0 || childSubTasks.fromJsonSubTasks.length > 0) && (
                <div className="p-4 bg-card border border-border/80 rounded-xl space-y-3 shadow-xs">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div className="flex items-center gap-2 text-xs font-black text-foreground">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>المهام الفرعية التابعة لهذه المهمة (Sub-tasks)</span>
                    </div>
                    <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-600 text-xs font-bold rounded-md">
                      {childSubTasks.fromParentField.length + childSubTasks.fromJsonSubTasks.length} مهمة فرعية
                    </span>
                  </div>

                  <div className="space-y-2">
                    {childSubTasks.fromParentField.map(st => {
                      const stDone = st.status === 'Executed' || st.status === 'Approved' || (st.status as string) === 'Completed';
                      return (
                        <div 
                          key={st.id}
                          onClick={() => onSelectTask?.(st)}
                          className="p-3 bg-muted/30 hover:bg-muted/60 border border-border rounded-lg flex items-center justify-between gap-3 text-xs transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {stDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            )}
                            <span className="font-bold text-foreground group-hover:text-primary transition-colors truncate">
                              {st.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                              stDone ? 'bg-emerald-500/10 text-emerald-600' : 'bg-blue-500/10 text-blue-600'
                            }`}>
                              {stDone ? 'منفذة' : 'قيد التنفيذ'}
                            </span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-[-2px] transition-transform" />
                          </div>
                        </div>
                      );
                    })}

                    {childSubTasks.fromJsonSubTasks.map((jst: any, idx: number) => (
                      <div 
                        key={jst.id || idx}
                        className="p-2.5 bg-muted/20 border border-border/60 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <CheckSquare className={`w-3.5 h-3.5 ${jst.completed ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                          <span className={jst.completed ? 'line-through text-muted-foreground' : 'font-bold text-foreground'}>
                            {jst.title || jst.text}
                          </span>
                        </div>
                        {jst.completed && (
                          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-1.5 py-0.2 rounded">مكتمل</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AUDIT METADATA */}
              <div className="text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg border border-border/40 font-semibold">
                <div>
                  تاريخ الإنشاء: {task.createdAt ? new Date(task.createdAt).toLocaleDateString('ar-EG') : '---'}
                  {(task as any).createdBy && ` بواسطة: ${(task as any).createdBy}`}
                </div>
                <div>
                  آخر تعديل: {(task as any).updatedAt ? new Date((task as any).updatedAt).toLocaleString('ar-EG') : '---'}
                  {(task as any).lastModifiedBy && ` بواسطة: ${(task as any).lastModifiedBy}`}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WORKFLOW TRACKING & AUDIT TIMELINE */}
          {activeTab === 'tracking' && (
            <div className="space-y-4">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2 text-primary">
                  <Activity className="w-4 h-4" />
                  <span>سجل مسار العمليات والاعتمادات الرسمية (Workflow Audit Trail)</span>
                </div>
                <span className="text-muted-foreground">
                  الحالة الراهنة: <strong className="text-foreground">{statusMeta.label}</strong>
                </span>
              </div>

              {parsedWorkflowLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs font-bold space-y-2">
                  <Activity className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p>لم يتم تسجيل أي عمليات أو تعديلات على هذه المهمة بعد.</p>
                </div>
              ) : (
                <div className="relative pr-6 space-y-6 before:content-[''] before:absolute before:top-2 before:bottom-2 before:right-2 before:w-0.5 before:bg-border">
                  {parsedWorkflowLogs.map((log: any, idx: number) => {
                    const logDate = log.timestamp ? new Date(log.timestamp) : null;
                    const dateFormatted = logDate && !isNaN(logDate.getTime())
                      ? logDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })
                      : '---';
                    const timeFormatted = logDate && !isNaN(logDate.getTime())
                      ? logDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
                      : '';

                    const isLogDone = log.toStatus === 'Executed' || log.toStatus === 'Completed' || log.toStatus === 'Approved';

                    return (
                      <div key={idx} className="relative group">
                        {/* Dot */}
                        <div className={`absolute -right-6 top-1 w-4 h-4 rounded-full border-2 bg-card flex items-center justify-center ${
                          isLogDone ? 'border-emerald-500 text-emerald-500' : 'border-primary text-primary'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${isLogDone ? 'bg-emerald-500' : 'bg-primary'}`} />
                        </div>

                        {/* Card */}
                        <div className="p-3.5 bg-card border border-border/80 rounded-xl space-y-2 shadow-xs hover:border-primary/50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border/40 pb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-xs text-foreground">
                                {log.action || `تغيير الحالة إلى ${log.toStatus}`}
                              </span>
                              {log.toStatus && (
                                <span className={`px-2 py-0.5 text-[10px] font-black rounded border ${
                                  isLogDone ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-primary/10 text-primary border-primary/20'
                                }`}>
                                  {log.toStatus}
                                </span>
                              )}
                            </div>

                            <span className="text-[11px] font-mono text-muted-foreground font-bold" dir="ltr">
                              {dateFormatted} {timeFormatted}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                            <span>بواسطة: <strong className="text-foreground">{log.userName || log.userEmail || 'المسؤول المباشر'}</strong></span>
                            {log.fromStatus && log.fromStatus !== 'None' && (
                              <span className="text-[10px]">
                                من ({log.fromStatus}) ➔ إلى ({log.toStatus})
                              </span>
                            )}
                          </div>

                          {log.notes && (
                            <div className="text-xs text-foreground/90 font-medium bg-muted/30 p-2.5 rounded-md border border-border/40">
                              {log.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ACTIVE TASKS EMPLOYEE IS WORKING ON RIGHT NOW */}
          {activeTab === 'activeTasks' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-bold">
                  <Clock className="w-4 h-4" />
                  <span>المهام المفتوحة والنشطة المسندة لـ ({assignedEmpName}) حالياً</span>
                </div>
                <span className="px-2.5 py-1 bg-blue-500/20 text-blue-700 dark:text-blue-300 font-black rounded-lg">
                  {employeeActiveTasks.length} مهام قيد العمل
                </span>
              </div>

              {employeeActiveTasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs font-bold space-y-2 bg-card border border-border rounded-xl">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                  <p>لا توجد مهام معلقة أو قيد التنفيذ حالياً لهذا الموظف (جميع مهامه منجزة بالكامل).</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {employeeActiveTasks.map(activeT => {
                    const isCurrentViewing = activeT.id === task.id;
                    const activeTDelay = calculateTaskDelay(activeT);
                    const activeTProject = projects.find(p => p.id === activeT.projectId);

                    return (
                      <div 
                        key={activeT.id}
                        className={`p-3.5 border rounded-xl space-y-2.5 transition-all text-xs ${
                          isCurrentViewing 
                            ? 'bg-primary/10 border-primary shadow-sm' 
                            : 'bg-card border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-black text-foreground text-xs leading-snug">
                                {activeT.title}
                              </h4>
                              {isCurrentViewing && (
                                <span className="px-1.5 py-0.2 bg-primary text-primary-foreground text-[9px] font-black rounded">
                                  المعروضة حالياً
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-bold">
                              📁 {activeTProject?.name || 'تكليف مباشر'}
                            </div>
                          </div>

                          <span className={`px-2 py-0.5 text-[10px] font-black rounded border shrink-0 ${
                            activeT.priority === 'High' || activeT.priority === 'Critical'
                              ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                              : 'bg-muted text-muted-foreground border-border'
                          }`}>
                            {activeT.priority || 'Medium'}
                          </span>
                        </div>

                        {activeT.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {activeT.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[10px] font-bold pt-1 border-t border-border/40">
                          <span className="text-muted-foreground">
                            الاستحقاق: <strong className="text-foreground">{(activeT as any).dueDate || activeT.endDate || '---'}</strong>
                          </span>
                          <span className={activeTDelay.isDelayed ? 'text-rose-600 font-black' : 'text-amber-600'}>
                            {activeTDelay.delayText}
                          </span>
                        </div>

                        {!isCurrentViewing && onSelectTask && (
                          <button
                            type="button"
                            onClick={() => onSelectTask(activeT)}
                            className="w-full py-1.5 bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary border border-primary/20 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <span>عرض تفاصيل هذه المهمة</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-between gap-3 text-xs font-bold">
          <div className="text-muted-foreground flex items-center gap-2">
            <Tag className="w-3.5 h-3.5" />
            <span>معرف المهمة: <span className="font-mono text-foreground">{task.id}</span></span>
          </div>

          <div className="flex items-center gap-2">
            {onEditTask && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditTask(task);
                }}
                className="px-4 py-2 bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary border border-primary/30 font-black rounded-lg transition-all cursor-pointer"
              >
                تعديل المهمة
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-primary text-primary-foreground font-black rounded-lg hover:opacity-90 transition-all cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
