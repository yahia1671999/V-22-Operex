import { Project, ProjectTask } from '../types';

/**
 * Helper to check if two scope values match, taking into account:
 * - Scope Name (e.g. 'Civil Work')
 * - Scope ID / WBS ID (e.g. 'sc-123')
 * - 'General' / 'عام' fallback
 * - Project Scope object definitions
 */
export const matchScopeOrWbs = (
  taskScope: string | null | undefined,
  targetScope: string | null | undefined,
  taskWbsId?: string | null | undefined,
  projectObj?: Project | null
): boolean => {
  const normTaskScope = String(taskScope || '').trim();
  const normTargetScope = String(targetScope || '').trim();
  const normTaskWbsId = String(taskWbsId || '').trim();

  const isTaskGeneral = !normTaskScope || normTaskScope.toLowerCase() === 'general' || normTaskScope === 'عام' || normTaskScope === 'عام (general)';
  const isTargetGeneral = !normTargetScope || normTargetScope.toLowerCase() === 'general' || normTargetScope === 'عام' || normTargetScope === 'عام (general)';

  if (isTargetGeneral) {
    return isTaskGeneral;
  }

  if (isTaskGeneral) {
    return false;
  }

  // Exact direct match (case-insensitive)
  if (normTaskScope.toLowerCase() === normTargetScope.toLowerCase()) {
    return true;
  }

  // WBS ID direct match
  if (normTaskWbsId && normTaskWbsId.toLowerCase() === normTargetScope.toLowerCase()) {
    return true;
  }

  // Match via Project Scope definitions
  if (projectObj?.scope && projectObj.scope.length > 0) {
    const targetScopeObj = projectObj.scope.find(
      s => String(s.id).trim().toLowerCase() === normTargetScope.toLowerCase() ||
           String(s.name).trim().toLowerCase() === normTargetScope.toLowerCase()
    );

    if (targetScopeObj) {
      const taskMatchesTargetName = normTaskScope.toLowerCase() === targetScopeObj.name.trim().toLowerCase();
      const taskMatchesTargetId = normTaskScope.toLowerCase() === targetScopeObj.id.trim().toLowerCase() ||
                                  normTaskWbsId.toLowerCase() === targetScopeObj.id.trim().toLowerCase();
      if (taskMatchesTargetName || taskMatchesTargetId) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Helper to check if two phase values match, taking into account:
 * - Phase Name (e.g. 'Analysis', 'Design')
 * - Phase ID
 * - Empty / Unassigned Phase
 */
export const matchPhase = (
  taskPhase: string | null | undefined,
  targetPhase: string | null | undefined,
  taskPhaseId?: string | null | undefined
): boolean => {
  const normTaskPhase = String(taskPhase || '').trim();
  const normTargetPhase = String(targetPhase || '').trim();
  const normTaskPhaseId = String(taskPhaseId || '').trim();

  if (!normTargetPhase) {
    return !normTaskPhase && !normTaskPhaseId;
  }

  if (!normTaskPhase && !normTaskPhaseId) {
    return false;
  }

  return (
    normTaskPhase.toLowerCase() === normTargetPhase.toLowerCase() ||
    (Boolean(normTaskPhaseId) && normTaskPhaseId.toLowerCase() === normTargetPhase.toLowerCase())
  );
};

/**
 * Calculates the depth level of a task (0 = Main Task, 1 = Sub-task L1, 2 = Sub-task L2, etc.)
 */
export const getTaskDepth = (taskId: string | null | undefined, allTasks: ProjectTask[]): number => {
  if (!taskId || !allTasks || allTasks.length === 0) return 0;
  let currentId: string | undefined = taskId;
  let depth = 0;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) break; // avoid infinite loop
    visited.add(currentId);
    const task = allTasks.find(t => t.id === currentId);
    if (task && task.parentTaskId && String(task.parentTaskId).trim() !== '') {
      depth++;
      currentId = task.parentTaskId;
    } else {
      break;
    }
  }
  return depth;
};

/**
 * Returns formatted hierarchy and level information for UI display
 */
export const getTaskHierarchyInfo = (task: ProjectTask, allTasks: ProjectTask[]) => {
  const depth = getTaskDepth(task.id, allTasks);
  const isSubTask = depth > 0 || Boolean(task.parentTaskId && String(task.parentTaskId).trim() !== '');

  let typeLabel = 'مهمة رئيسية / Main Task';
  let badgeLabel = 'Main Task';
  let prefix = '📌';
  let indent = '';

  if (depth === 1) {
    typeLabel = 'مهمة فرعية / Sub-task';
    badgeLabel = 'Sub-task';
    prefix = '↳';
    indent = '── ';
  } else if (depth > 1) {
    typeLabel = `مهمة فرعية (مستوى ${depth + 1}) / Sub-task (L${depth + 1})`;
    badgeLabel = `Sub-task L${depth + 1}`;
    prefix = '↳↳';
    indent = '──── ';
  }

  return {
    depth,
    isSubTask,
    typeLabel,
    badgeLabel,
    prefix,
    indent
  };
};

/**
 * Returns all valid candidate tasks that can be chosen as a Parent Task for a given task
 * within the same Project, Phase, and Scope / WBS.
 *
 * Includes BOTH Main Tasks and Sub-tasks (allowing creation of multi-level sub-tasks).
 * Excludes only the current task itself and its descendants to strictly prevent circular relations.
 */
export const getValidParentTasks = (
  allTasks: ProjectTask[],
  targetProjectId: string | null | undefined,
  targetPhase: string | null | undefined,
  targetScope: string | null | undefined,
  currentTaskId?: string | null,
  projectObj?: Project | null
): ProjectTask[] => {
  if (!allTasks || allTasks.length === 0) return [];

  const normTargetProjId = String(targetProjectId || '').trim();

  // Find all tasks that are children/descendants of currentTaskId to prevent any circular loops
  const forbiddenIds = new Set<string>();
  if (currentTaskId) {
    forbiddenIds.add(currentTaskId);
    const queue = [currentTaskId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const children = allTasks.filter(t => t.parentTaskId === curr);
      for (const ch of children) {
        if (!forbiddenIds.has(ch.id)) {
          forbiddenIds.add(ch.id);
          queue.push(ch.id);
        }
      }
    }
  }

  const validTasks = allTasks.filter(t => {
    // 1. Cannot link to itself or any of its descendants (Anti-circular relation)
    if (forbiddenIds.has(t.id)) {
      return false;
    }

    // 2. Project Filter (matches targetProjectId)
    const taskProjId = String(t.projectId || '').trim();
    if (normTargetProjId) {
      if (taskProjId !== normTargetProjId) return false;
    } else {
      if (taskProjId !== '') return false;
    }

    // 3. Phase Filter (matches phase / phaseId)
    if (!matchPhase(t.phase, targetPhase, (t as any).phaseId)) {
      return false;
    }

    // 4. Scope / WBS Filter (matches subPhase / wbsId / scope)
    if (!matchScopeOrWbs(t.subPhase, targetScope, (t as any).wbsId || (t as any).scopeId, projectObj)) {
      return false;
    }

    return true;
  });

  // Sort tasks hierarchically (Main tasks first, then nested sub-tasks)
  const result: ProjectTask[] = [];
  const added = new Set<string>();

  const addHierarchy = (parentId: string | null) => {
    const layer = validTasks.filter(t => {
      if (parentId === null) {
        return !t.parentTaskId || !validTasks.some(p => p.id === t.parentTaskId);
      }
      return t.parentTaskId === parentId;
    });

    for (const item of layer) {
      if (!added.has(item.id)) {
        added.add(item.id);
        result.push(item);
        addHierarchy(item.id);
      }
    }
  };

  addHierarchy(null);

  // Add any remaining valid tasks
  for (const item of validTasks) {
    if (!added.has(item.id)) {
      added.add(item.id);
      result.push(item);
    }
  }

  return result;
};

/**
 * Checks if an existing parentTaskId is valid for the given project, phase, and scope
 */
export const isParentTaskIdValid = (
  parentTaskId: string | null | undefined,
  allTasks: ProjectTask[],
  targetProjectId: string | null | undefined,
  targetPhase: string | null | undefined,
  targetScope: string | null | undefined,
  currentTaskId?: string | null,
  projectObj?: Project | null
): boolean => {
  if (!parentTaskId) return true; // not linked to parent is always valid
  const validParents = getValidParentTasks(
    allTasks,
    targetProjectId,
    targetPhase,
    targetScope,
    currentTaskId,
    projectObj
  );
  return validParents.some(t => String(t.id) === String(parentTaskId));
};
