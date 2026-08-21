import { ProjectTask, Employee } from '../types';

/**
 * Returns true if the task is considered open/active
 * Includes: New, Open, Pending, In Progress, Under Review, Testing, Overdue, Rejected
 * Excludes: Completed, Executed, Approved, Cancelled, Closed
 */
/**
 * Safe conversion of Date/string to local YYYY-MM-DD string without UTC timezone shift
 */
export function toLocalDateStr(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  try {
    const d = typeof val === 'string' ? new Date(val) : val;
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {}
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.includes('T')) return trimmed.split('T')[0];
    if (trimmed.includes(' ')) return trimmed.split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  return null;
}

/**
 * Checks if a task was assigned by a manager or someone else (meaning the employee cannot edit estimated hours)
 */
export function isManagerAssignedTask(
  task: ProjectTask | null | undefined,
  currentEmployeeId?: string | null,
  currentEmployeeEmail?: string | null,
  isUserAdminOrManager?: boolean
): boolean {
  if (!task) return false;
  // If user is admin/manager, they are allowed to edit estimated hours
  if (isUserAdminOrManager) return false;

  // If marked explicitly as manager task
  if ((task as any).isManagerTask === true) return true;

  // If it's a project task with a project id and creator is not self
  const creatorId = String(task.creatorId || (task as any).createdBy || '').trim().toLowerCase();
  const empId = String(currentEmployeeId || '').trim().toLowerCase();
  const empEmail = String(currentEmployeeEmail || '').trim().toLowerCase();

  // If creator is set and different from current employee
  if (creatorId && creatorId !== empId && creatorId !== empEmail && creatorId !== 'self') {
    return true;
  }

  // If task belongs to an organizational project (phase is not 'Personal' and not a personal commitment)
  if (task.projectId && task.phase !== 'Personal') {
    return true;
  }

  return false;
}

export function isOpenTask(taskOrStatus?: ProjectTask | string | null): boolean {
  if (!taskOrStatus) return false;
  const statusStr = typeof taskOrStatus === 'string' 
    ? taskOrStatus 
    : (taskOrStatus.status || '');
    
  const closedStatuses = [
    'completed', 'executed', 'approved', 'cancelled', 'closed', 'done',
    'منجزة', 'مكتملة', 'مكتمل', 'تم الانجاز', 'تم الإنجاز', 'مقبولة', 'ملغاة', 'مغلقة'
  ];
  const lower = String(statusStr).trim().toLowerCase();
  return !closedStatuses.includes(lower);
}

/**
 * Resolves a single identifier (id, employeeId, userId, email, name) to an Employee object
 */
export function findEmployeeByIdentifier(identifier: string | null | undefined, employees: Employee[] = []): Employee | undefined {
  if (!identifier || !employees || employees.length === 0) return undefined;
  const idLower = String(identifier).trim().toLowerCase();
  if (!idLower) return undefined;

  return employees.find(e => 
    String(e.id || '').toLowerCase() === idLower ||
    String(e.employeeId || '').toLowerCase() === idLower ||
    (e.userId && String(e.userId).toLowerCase() === idLower) ||
    (e.email && String(e.email).trim().toLowerCase() === idLower) ||
    (e.name && String(e.name).trim().toLowerCase() === idLower)
  );
}

/**
 * Extracts and normalizes assigned employee IDs array from a task (handles string, JSON string, array, single id)
 */
export function getTaskAssignedIds(taskOrIds: any): string[] {
  if (!taskOrIds) return [];
  if (Array.isArray(taskOrIds)) {
    return Array.from(new Set(taskOrIds.map(id => String(id).trim()).filter(Boolean)));
  }

  const rawIds = taskOrIds.assignedToIds;
  const singleId = taskOrIds.assignedToId;
  let result: string[] = [];

  if (Array.isArray(rawIds)) {
    result = rawIds.map(id => String(id).trim()).filter(Boolean);
  } else if (typeof rawIds === 'string') {
    const trimmed = rawIds.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          result = parsed.map(id => String(id).trim()).filter(Boolean);
        }
      } catch (e) {}
    } else if (trimmed) {
      result = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (result.length === 0 && singleId) {
    result = [String(singleId).trim()].filter(Boolean);
  }

  return Array.from(new Set(result));
}

export interface TaskAssigneeInfo {
  id: string;
  name: string;
  employee?: Employee;
  employeeId?: string;
  jobTitle?: string;
  department?: string;
}

/**
 * Resolves all distinct assignees for a given task, guaranteeing that:
 * 1. Each employee appears exactly ONCE (no duplicate names, no duplicate badges)
 * 2. Multi-assigned tasks correctly list distinct employees
 */
export function getTaskDistinctAssignees(
  task: any, 
  employees: Employee[] = []
): TaskAssigneeInfo[] {
  if (!task) return [];

  const rawIds = getTaskAssignedIds(task);
  const seenEmployeeKeys = new Set<string>();
  const seenNames = new Set<string>();
  const result: TaskAssigneeInfo[] = [];

  const tryAdd = (empOrId: string | Employee | null | undefined) => {
    if (!empOrId) return;

    let matchedEmp: Employee | undefined;
    let fallbackId = '';

    if (typeof empOrId === 'object') {
      matchedEmp = empOrId as Employee;
    } else {
      fallbackId = String(empOrId).trim();
      matchedEmp = findEmployeeByIdentifier(fallbackId, employees);
    }

    if (matchedEmp) {
      const canonicalKey = String(matchedEmp.id || matchedEmp.employeeId || matchedEmp.name).toLowerCase();
      const nameKey = String(matchedEmp.name || '').trim().toLowerCase();
      
      if (!seenEmployeeKeys.has(canonicalKey) && (!nameKey || !seenNames.has(nameKey))) {
        seenEmployeeKeys.add(canonicalKey);
        if (nameKey) seenNames.add(nameKey);
        result.push({
          id: matchedEmp.id || matchedEmp.employeeId || fallbackId,
          name: matchedEmp.name || fallbackId,
          employee: matchedEmp,
          employeeId: matchedEmp.employeeId,
          jobTitle: (matchedEmp as any).jobTitle || (matchedEmp as any).position,
          department: (matchedEmp as any).department || (matchedEmp as any).departmentName
        });
      }
    } else if (fallbackId) {
      const fallbackLower = fallbackId.toLowerCase();
      if (!seenEmployeeKeys.has(fallbackLower) && !seenNames.has(fallbackLower)) {
        seenEmployeeKeys.add(fallbackLower);
        seenNames.add(fallbackLower);
        result.push({
          id: fallbackId,
          name: fallbackId
        });
      }
    }
  };

  // 1. Process all IDs in rawIds
  rawIds.forEach(id => tryAdd(id));

  // 2. If nothing matched yet, check single fields
  if (result.length === 0) {
    if (task.assignedToId) tryAdd(task.assignedToId);
    if (task.assignedTo) tryAdd(task.assignedTo);
  }

  return result;
}

/**
 * Normalizes an array of employee IDs to unique canonical IDs (one ID per distinct employee)
 * Prevents creating duplicate assignments for the same employeeId.
 */
export function normalizeTaskAssigneeIds(
  assigneeIds: (string | null | undefined)[], 
  employees: Employee[] = []
): string[] {
  if (!assigneeIds || !Array.isArray(assigneeIds)) return [];

  const seenCanonical = new Set<string>();
  const cleanList: string[] = [];

  assigneeIds.filter(Boolean).forEach(rawId => {
    const trimmed = String(rawId).trim();
    if (!trimmed) return;

    const emp = findEmployeeByIdentifier(trimmed, employees);
    if (emp) {
      const canonicalKey = String(emp.id || emp.employeeId || emp.name).toLowerCase();
      if (!seenCanonical.has(canonicalKey)) {
        seenCanonical.add(canonicalKey);
        cleanList.push(emp.id || emp.employeeId || canonicalKey);
      }
    } else {
      const lower = trimmed.toLowerCase();
      if (!seenCanonical.has(lower)) {
        seenCanonical.add(lower);
        cleanList.push(trimmed);
      }
    }
  });

  return cleanList;
}

/**
 * Resolves the full assigned employee name(s) for a given task, guaranteed unique
 */
export function getAssignedEmployeeName(task: ProjectTask, employees: Employee[] = []): string {
  if (!task) return 'غير موجه';

  const distinctAssignees = getTaskDistinctAssignees(task, employees);
  if (distinctAssignees.length > 0) {
    return distinctAssignees.map(a => a.name).join(', ');
  }

  if (task.assignedTo && typeof task.assignedTo === 'string' && task.assignedTo.trim()) {
    return task.assignedTo.trim();
  }
  return 'غير موجه';
}

export interface TaskDelayInfo {
  isDelayed: boolean;
  delayHours: number;
  delayMinutes: number;
  delayText: string;
  timeRemainingText?: string;
  expectedEndTime?: Date | null;
  expectedEndTimeFormatted?: string;
  status: 'not_started' | 'on_track' | 'delayed' | 'completed_on_time' | 'completed_delayed';
  badgeColor: string;
}

/**
 * Resolves the planned / specified start time (وقت البدء المحدد) for a task.
 * Note: Never uses task creation or assignment time (createdAt / assignedAt).
 */
export function getPlannedStartTime(task: ProjectTask): Date | null {
  if (!task) return null;

  // 1. Check startDate (scheduled start date)
  if (task.startDate) {
    const raw = String(task.startDate).trim();
    if (raw.includes('T') || raw.includes(' ')) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
    const timePart = (task as any).startTime || task.actualStartTime || '09:00';
    const d = new Date(`${raw}T${timePart.length === 5 ? timePart + ':00' : timePart}`);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Check actualStartDate if scheduled startDate was not explicitly defined
  if (task.actualStartDate) {
    const raw = String(task.actualStartDate).trim();
    const timePart = task.actualStartTime || '09:00';
    const d = new Date(`${raw}T${timePart.length === 5 ? timePart + ':00' : timePart}`);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Check startedAt timestamp if set
  if (task.startedAt) {
    const d = new Date(task.startedAt);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Resolves the planned end time (وقت الانتهاء المخطط) for a task.
 * Rule: وقت الانتهاء المخطط = وقت البدء المحدد + المدة التقديرية.
 * Fallback: If no estimated duration, uses scheduled endDate / dueDate.
 */
export function getPlannedEndTime(task: ProjectTask): Date | null {
  if (!task) return null;

  const plannedStart = getPlannedStartTime(task);
  const estimatedHours = Number(task.estimatedHours) || 0;

  // Primary Rule: وقت الانتهاء المخطط = وقت البدء المحدد + المدة التقديرية
  if (plannedStart && estimatedHours > 0) {
    return new Date(plannedStart.getTime() + estimatedHours * 60 * 60 * 1000);
  }

  // Fallback: If estimatedHours not provided, check scheduled endDate / dueDate
  const dueDateStr = (task as any).dueDate || task.endDate;
  if (dueDateStr) {
    const raw = String(dueDateStr).trim();
    if (raw.includes('T') || raw.includes(' ')) {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) return d;
    }
    const timePart = (task as any).endTime || '17:00';
    const d = new Date(`${raw}T${timePart.length === 5 ? timePart + ':00' : timePart}`);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Resolves the actual completion time (وقت الانتهاء الفعلي) for a task.
 */
export function getTaskCompletionDateTime(task: ProjectTask): Date | null {
  if (!task) return null;

  if (task.completedAt) {
    const d = new Date(task.completedAt);
    if (!isNaN(d.getTime())) return d;
  }

  if ((task as any).actualEndDate) {
    const raw = String((task as any).actualEndDate).trim();
    const timePart = (task as any).actualEndTime || '17:00';
    const d = new Date(`${raw}T${timePart.length === 5 ? timePart + ':00' : timePart}`);
    if (!isNaN(d.getTime())) return d;
  }

  if (Array.isArray(task.workflowLog) && task.workflowLog.length > 0) {
    const doneLogs = task.workflowLog.filter(l => 
      l.toStatus === 'Executed' || (l.toStatus as string) === 'Completed' || l.toStatus === 'Approved'
    );
    if (doneLogs.length > 0) {
      const lastLog = doneLogs[doneLogs.length - 1];
      if (lastLog.timestamp) {
        const d = new Date(lastLog.timestamp);
        if (!isNaN(d.getTime())) return d;
      }
    }
  }

  if (task.updatedAt && !isOpenTask(task)) {
    const d = new Date(task.updatedAt);
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

/**
 * Calculates delay or on-track status for a task based on planned end time:
 * وقت الانتهاء المخطط = وقت البدء المحدد + المدة التقديرية.
 * Delay is calculated ONLY when exceeding planned end time.
 * If completed before or at planned end time, delay is 0.
 * Assignment time (createdAt) is never used for delay calculation.
 */
export function calculateTaskDelay(task: ProjectTask): TaskDelayInfo {
  if (!task) {
    return {
      isDelayed: false,
      delayHours: 0,
      delayMinutes: 0,
      delayText: 'غير محدد',
      status: 'not_started',
      badgeColor: 'text-muted-foreground bg-muted border-border'
    };
  }

  const isDone = !isOpenTask(task);
  const plannedEndTime = getPlannedEndTime(task);
  const expectedEndTimeFormatted = plannedEndTime 
    ? `${plannedEndTime.toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' })} ${String(plannedEndTime.getHours()).padStart(2, '0')}:${String(plannedEndTime.getMinutes()).padStart(2, '0')}`
    : undefined;

  // Case 1: Task is Finished/Completed/Executed
  if (isDone) {
    if (!plannedEndTime) {
      return {
        isDelayed: false,
        delayHours: 0,
        delayMinutes: 0,
        delayText: 'أنجزت بالوقت المحدد ✓',
        expectedEndTime: null,
        expectedEndTimeFormatted: undefined,
        status: 'completed_on_time',
        badgeColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      };
    }

    const completionDateTime = getTaskCompletionDateTime(task) || new Date();

    // Rule: إذا أنهى الموظف المهمة قبل أو عند وقت الانتهاء المخطط، يكون التأخير صفر
    if (completionDateTime.getTime() <= plannedEndTime.getTime()) {
      return {
        isDelayed: false,
        delayHours: 0,
        delayMinutes: 0,
        delayText: 'أنجزت بالوقت المحدد ✓',
        expectedEndTime: plannedEndTime,
        expectedEndTimeFormatted,
        status: 'completed_on_time',
        badgeColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
      };
    }

    // Rule: يُحسب التأخير فقط عند تجاوز وقت الانتهاء المخطط للمهمة
    const diffMs = completionDateTime.getTime() - plannedEndTime.getTime();
    const delayMinutes = Math.round(diffMs / (1000 * 60));
    const delayHours = Math.round((delayMinutes / 60) * 10) / 10;
    const timeStr = formatDurationArabic(delayMinutes);

    return {
      isDelayed: true,
      delayHours,
      delayMinutes,
      delayText: `أنجزت بتأخير ${timeStr}`,
      expectedEndTime: plannedEndTime,
      expectedEndTimeFormatted,
      status: 'completed_delayed',
      badgeColor: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30'
    };
  }

  // Case 2: Task is Open / Ongoing / Pending
  const now = new Date();

  if (!plannedEndTime) {
    const isPending = task.status === 'Pending' && !task.startedAt && !task.actualStartDate;
    return {
      isDelayed: false,
      delayHours: 0,
      delayMinutes: 0,
      delayText: isPending ? 'بانتظار بدء التنفيذ' : 'قيد التنفيذ',
      expectedEndTime: null,
      expectedEndTimeFormatted: undefined,
      status: isPending ? 'not_started' : 'on_track',
      badgeColor: isPending 
        ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30' 
        : 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30'
    };
  }

  // If currently within planned end time
  if (now.getTime() <= plannedEndTime.getTime()) {
    const remainingMs = plannedEndTime.getTime() - now.getTime();
    const remMinutes = Math.round(remainingMs / (1000 * 60));
    const timeStr = formatDurationArabic(remMinutes);
    const isPending = task.status === 'Pending' && !task.startedAt && !task.actualStartDate;

    return {
      isDelayed: false,
      delayHours: 0,
      delayMinutes: 0,
      delayText: isPending ? 'بانتظار بدء التنفيذ' : 'ضمن الوقت المقدر',
      timeRemainingText: `متبقي ${timeStr}`,
      expectedEndTime: plannedEndTime,
      expectedEndTimeFormatted,
      status: isPending ? 'not_started' : 'on_track',
      badgeColor: isPending 
        ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30' 
        : 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30'
    };
  }

  // If current time has exceeded planned end time -> Delayed
  const diffMs = now.getTime() - plannedEndTime.getTime();
  const delayMinutes = Math.round(diffMs / (1000 * 60));
  const delayHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
  const timeStr = formatDurationArabic(delayMinutes);

  return {
    isDelayed: true,
    delayHours,
    delayMinutes,
    delayText: `متأخرة بـ ${timeStr}`,
    expectedEndTime: plannedEndTime,
    expectedEndTimeFormatted,
    status: 'delayed',
    badgeColor: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30'
  };
}

/**
 * Extracts ISO date string (YYYY-MM-DD) for when a task was completed
 */
export function getTaskCompletionDate(task: ProjectTask): string | null {
  if (!task) return null;
  const isDone = !isOpenTask(task);
  if (!isDone) return null;

  const toLocalDateStr = (val: string | Date | undefined): string | null => {
    if (!val) return null;
    try {
      const d = typeof val === 'string' ? new Date(val) : val;
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {}
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.includes('T')) return trimmed.split('T')[0];
      if (trimmed.includes(' ')) return trimmed.split(' ')[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    }
    return null;
  };

  if ((task as any).actualEndDate) {
    const dStr = toLocalDateStr((task as any).actualEndDate);
    if (dStr) return dStr;
  }

  if (task.completedAt) {
    const dStr = toLocalDateStr(task.completedAt);
    if (dStr) return dStr;
  }

  if (Array.isArray(task.workflowLog) && task.workflowLog.length > 0) {
    const doneLogs = task.workflowLog.filter(l => 
      l.toStatus === 'Executed' || (l.toStatus as string) === 'Completed' || l.toStatus === 'Approved'
    );
    if (doneLogs.length > 0) {
      const last = doneLogs[doneLogs.length - 1];
      if (last.timestamp) {
        const dStr = toLocalDateStr(last.timestamp);
        if (dStr) return dStr;
      }
    }
  }

  if (task.updatedAt) {
    const dStr = toLocalDateStr(task.updatedAt);
    if (dStr) return dStr;
  }

  if (task.endDate) {
    const dStr = toLocalDateStr(task.endDate);
    if (dStr) return dStr;
  }

  return null;
}

export interface TaskExecutionMetrics {
  assignedAtFormatted: string;      // وقت الإسناد
  estimatedHours: number;           // Estimated Time
  estimatedHoursFormatted: string;  // e.g. "2 ساعة"
  startedAtFormatted: string;       // وقت البدء
  completedAtFormatted: string;     // وقت الانتهاء
  actualHours: number;              // الوقت الفعلي بالساعات
  actualMinutes: number;            // الوقت الفعلي بالدقائق
  actualTimeFormatted: string;      // الوقت الفعلي منسق
  delayHours: number;               // ساعات التأخير
  delayMinutes: number;             // دقائق التأخير
  delayFormatted: string;           // نص التأخير
  isDelayed: boolean;               // هل تأخر
  statusBadge: { text: string; color: string };
  isCompleted: boolean;
  isInProgress: boolean;
  isPending: boolean;
}

export function formatDateTimeArabic(dateObj: Date | null): string {
  if (!dateObj || isNaN(dateObj.getTime())) return 'غير محدد';
  const dStr = dateObj.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });
  const tStr = dateObj.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  return `${dStr} - ${tStr}`;
}

export function formatDurationArabic(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0 دقيقة';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours > 0 && minutes > 0) {
    const hoursStr = hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : `${hours} ساعات`;
    return `${hoursStr} و ${minutes} دقيقة`;
  } else if (hours > 0) {
    return hours === 1 ? 'ساعة واحدة' : hours === 2 ? 'ساعتان' : `${hours} ساعات`;
  } else {
    return `${minutes} دقيقة`;
  }
}

/**
 * Calculates complete task execution metrics: Assignment time, Estimated Time,
 * Start time, End time, Actual execution time, and Delay.
 */
export function getTaskExecutionMetrics(task: ProjectTask): TaskExecutionMetrics {
  const isDone = !isOpenTask(task);
  const isInProgress = task?.status === 'In Progress';
  const isPending = task?.status === 'Pending';
  const estimatedHours = Number(task?.estimatedHours) || 0;

  // 1. Assignment Time (وقت الإسناد)
  let assignedDate: Date | null = null;
  if (task?.createdAt) {
    const d = new Date(task.createdAt);
    if (!isNaN(d.getTime())) assignedDate = d;
  }
  const assignedAtFormatted = assignedDate ? formatDateTimeArabic(assignedDate) : (task?.startDate || 'غير محدد');

  // 2. Estimated Time (الوقت التقديري)
  const estimatedHoursFormatted = estimatedHours > 0
    ? (estimatedHours === 1 ? 'ساعة واحدة' : estimatedHours === 2 ? 'ساعتان' : `${estimatedHours} ساعة`)
    : 'غير محدد';

  // 3. Start Time (وقت البدء)
  let startDate: Date | null = null;
  if (task?.startedAt) {
    const d = new Date(task.startedAt);
    if (!isNaN(d.getTime())) startDate = d;
  } else if (task?.actualStartDate) {
    const timeStr = task.actualStartTime || '09:00';
    const d = new Date(`${task.actualStartDate}T${timeStr}:00`);
    if (!isNaN(d.getTime())) startDate = d;
  } else if (task?.startDate) {
    const d = new Date(`${task.startDate}T09:00:00`);
    if (!isNaN(d.getTime())) startDate = d;
  }
  const startedAtFormatted = startDate ? formatDateTimeArabic(startDate) : 'لم يبدأ بعد';

  // 4. Completion / End Time (وقت الانتهاء)
  let completedDate: Date | null = null;
  if (isDone) {
    if (task?.completedAt) {
      const d = new Date(task.completedAt);
      if (!isNaN(d.getTime())) completedDate = d;
    } else if (Array.isArray(task?.workflowLog) && task.workflowLog.length > 0) {
      const doneLogs = task.workflowLog.filter(l => 
        l.toStatus === 'Executed' || (l.toStatus as string) === 'Completed' || l.toStatus === 'Approved'
      );
      if (doneLogs.length > 0) {
        const last = doneLogs[doneLogs.length - 1];
        const d = new Date(last.timestamp);
        if (!isNaN(d.getTime())) completedDate = d;
      }
    } else if (task?.updatedAt) {
      const d = new Date(task.updatedAt);
      if (!isNaN(d.getTime())) completedDate = d;
    }
  }
  const completedAtFormatted = completedDate ? formatDateTimeArabic(completedDate) : (task?.endDate ? `${task.endDate} (مستهدف)` : 'قيد التنفيذ');

  // 5. Actual Execution Time (الوقت الفعلي)
  let actualMinutes = 0;
  let actualHours = 0;
  let actualTimeFormatted = 'غير محدد';

  if (startDate) {
    const endPoint = completedDate || (isInProgress ? new Date() : null);
    if (endPoint && endPoint.getTime() >= startDate.getTime()) {
      const diffMs = endPoint.getTime() - startDate.getTime();
      actualMinutes = Math.round(diffMs / (1000 * 60));
      actualHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
      actualTimeFormatted = formatDurationArabic(actualMinutes);
      if (isInProgress) {
        actualTimeFormatted += ' (مستمر حالياً)';
      }
    } else if (isDone && !completedDate) {
      actualTimeFormatted = 'تم الإنهاء';
    }
  }

  // 6. Delay Calculation (حساب التأخير)
  const delayInfo = calculateTaskDelay(task);
  const isDelayed = delayInfo.isDelayed;
  const delayHours = delayInfo.delayHours;
  const delayMinutes = delayInfo.delayMinutes;
  const delayFormatted = isDelayed 
    ? `تأخير: ${formatDurationArabic(delayMinutes)}` 
    : (isDone ? 'تم الإنجاز بالوقت المحدد ✓' : delayInfo.timeRemainingText || 'في الوقت المحدد');

  const statusBadge = {
    text: delayInfo.delayText,
    color: delayInfo.badgeColor
  };

  return {
    assignedAtFormatted,
    estimatedHours,
    estimatedHoursFormatted,
    startedAtFormatted,
    completedAtFormatted,
    actualHours,
    actualMinutes,
    actualTimeFormatted,
    delayHours,
    delayMinutes,
    delayFormatted,
    isDelayed,
    statusBadge,
    isCompleted: isDone,
    isInProgress,
    isPending
  };
}

export interface ProjectPhaseStats {
  phase: string;
  totalTasks: number;
  completedTasks: number;
  openTasks: number;
  inProgressTasks: number;
  isCompleted: boolean;
  isActive: boolean;
  progressPercent: number;
}

export interface ProjectPhaseDetails {
  currentPhase: string;
  currentPhaseIndex: number;
  totalPhases: number;
  phases: string[];
  phaseStats: ProjectPhaseStats[];
  overallProgress: number;
  isProjectCompleted: boolean;
}

/**
 * Dynamically computes the current active phase of a project based on workflow and task states
 */
export function getCurrentProjectPhase(
  project?: { phases?: string[]; status?: string; id?: string; currentPhase?: string } | null,
  tasks: ProjectTask[] = []
): string {
  if (!project) return 'Analysis';
  
  const phases = (Array.isArray(project.phases) && project.phases.length > 0)
    ? project.phases
    : ['Analysis', 'Design', 'Development', 'Testing', 'UAT', 'Go-Live'];

  if (phases.length === 0) return 'Analysis';

  // If the project explicitly has a currentPhase specified and it is valid within the project's phases, use it
  if (project.currentPhase && phases.includes(project.currentPhase)) {
    return project.currentPhase;
  }

  const projTasks = (project.id ? tasks.filter(t => t.projectId === project.id) : tasks) || [];
  
  // If no tasks exist in the project, the current phase is the initial phase
  if (projTasks.length === 0) {
    return phases[0];
  }

  // 1. Check if any phase has tasks actively in-progress / testing / under review
  for (const phase of phases) {
    const pTasks = projTasks.filter(t => t.phase === phase);
    const hasActiveTask = pTasks.some(t => 
      t.status === 'In Progress' || t.status === 'Under Review' || t.status === 'Testing'
    );
    if (hasActiveTask) {
      return phase;
    }
  }

  // 2. Step through phases sequentially
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const pTasks = projTasks.filter(t => t.phase === phase);
    
    if (pTasks.length > 0) {
      const allDone = pTasks.every(t => !isOpenTask(t));
      if (!allDone) {
        // This phase still has open/pending tasks
        return phase;
      }
      // If all tasks in this phase are done, check the next phase in loop
    } else {
      // This phase has no tasks yet, but previous phases are all finished
      return phase;
    }
  }

  // If all phases are completely finished
  return phases[phases.length - 1];
}

/**
 * Returns comprehensive metrics and progress per phase for a project
 */
export function getProjectPhaseDetails(
  project?: { phases?: string[]; status?: string; id?: string; name?: string } | null,
  tasks: ProjectTask[] = []
): ProjectPhaseDetails {
  const currentPhase = getCurrentProjectPhase(project, tasks);
  const phases = (Array.isArray(project?.phases) && project.phases.length > 0)
    ? project.phases
    : ['Analysis', 'Design', 'Development', 'Testing', 'UAT', 'Go-Live'];

  const projTasks = (project?.id ? tasks.filter(t => t.projectId === project.id) : tasks) || [];
  const currentPhaseIndex = Math.max(0, phases.indexOf(currentPhase));

  let totalAllTasks = projTasks.length;
  let totalCompletedTasks = 0;

  const phaseStats: ProjectPhaseStats[] = phases.map((phase, idx) => {
    const pTasks = projTasks.filter(t => t.phase === phase);
    const total = pTasks.length;
    const completed = pTasks.filter(t => !isOpenTask(t)).length;
    const open = pTasks.filter(t => isOpenTask(t)).length;
    const inProgress = pTasks.filter(t => t.status === 'In Progress' || t.status === 'Under Review' || t.status === 'Testing').length;
    const isCompleted = total > 0 && completed === total;
    const isActive = phase === currentPhase;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : (idx < currentPhaseIndex ? 100 : 0);

    totalCompletedTasks += completed;

    return {
      phase,
      totalTasks: total,
      completedTasks: completed,
      openTasks: open,
      inProgressTasks: inProgress,
      isCompleted,
      isActive,
      progressPercent
    };
  });

  const overallProgress = totalAllTasks > 0 
    ? Math.round((totalCompletedTasks / totalAllTasks) * 100)
    : (project?.status === 'Completed' ? 100 : Math.round((currentPhaseIndex / Math.max(1, phases.length)) * 100));

  const isProjectCompleted = project?.status === 'Completed' || (totalAllTasks > 0 && totalCompletedTasks === totalAllTasks);

  return {
    currentPhase,
    currentPhaseIndex,
    totalPhases: phases.length,
    phases,
    phaseStats,
    overallProgress,
    isProjectCompleted
  };
}
