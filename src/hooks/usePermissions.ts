import { useAuth } from '../AuthContext';
import { useData } from '../contexts/DataContext';
import { AppUser } from '../types';
import { ROLE_PERMISSIONS, expandPermissions } from '../lib/rolePermissions';

// Map old screen definitions to the new modular system for complete backward compatibility
const SCREEN_TO_PERMISSION_MAP: Record<string, Record<string, string>> = {
  'employees': {
    view: 'hr.employees.view', create: 'hr.employees.create', edit: 'hr.employees.edit', delete: 'hr.employees.delete', export: 'hr.employees.view'
  },
  'attendance': {
    view: 'hr.attendance.view', create: 'hr.attendance.create', edit: 'hr.attendance.edit', delete: 'hr.attendance.edit', export: 'hr.attendance.view'
  },
  'missions': {
    view: 'hr.missions.view', create: 'self_service.missions.create', edit: 'hr.missions.edit', delete: 'hr.missions.delete', export: 'hr.missions.view'
  },
  'dashboard_hr': {
    view: 'hr.dashboard.view', create: 'hr.dashboard.view', edit: 'hr.dashboard.view', delete: 'hr.dashboard.view', export: 'hr.dashboard.view'
  },
  'adminStructure': {
    view: 'hr.admin_structure.view', create: 'hr.admin_structure.manage', edit: 'hr.admin_structure.manage', delete: 'hr.admin_structure.manage', export: 'hr.admin_structure.manage'
  },
  'orgChart': {
    view: 'hr.admin_structure.view', create: 'hr.admin_structure.manage', edit: 'hr.admin_structure.manage', delete: 'hr.admin_structure.manage', export: 'hr.admin_structure.manage'
  },
  'dashboard_payroll': {
    view: 'payroll.dashboard.view', create: 'payroll.dashboard.view', edit: 'payroll.dashboard.view', delete: 'payroll.dashboard.view', export: 'payroll.dashboard.view'
  },
  'allowanceTypes': {
    view: 'payroll.allowance_types.manage', create: 'payroll.allowance_types.manage', edit: 'payroll.allowance_types.manage', delete: 'payroll.allowance_types.manage', export: 'payroll.allowance_types.manage'
  },
  'transactions': {
    view: 'payroll.transactions.view', create: 'payroll.transactions.create', edit: 'payroll.transactions.edit', delete: 'payroll.transactions.delete', export: 'payroll.transactions.view'
  },
  'payroll': {
    view: 'payroll.runs.view', create: 'payroll.runs.create', edit: 'payroll.runs.submit', delete: 'payroll.runs.approve', export: 'payroll.runs.view'
  },
  'settlements': {
    view: 'payroll.settlements.manage', create: 'payroll.settlements.manage', edit: 'payroll.settlements.manage', delete: 'payroll.settlements.manage', export: 'payroll.settlements.manage'
  },
  'dashboard_ops': {
    view: 'operations.dashboard.view', create: 'operations.dashboard.view', edit: 'operations.dashboard.view', delete: 'operations.dashboard.view', export: 'operations.dashboard.view'
  },
  'operations': {
    view: 'operations.projects.view', create: 'operations.projects.create', edit: 'operations.projects.edit', delete: 'operations.projects.delete', export: 'operations.projects.view'
  },
  'my-tasks': {
    view: 'self_service.my_tasks.view', create: 'operations.tasks.create', edit: 'operations.tasks.change_status', delete: 'operations.tasks.close', export: 'operations.tasks.view'
  },
  'users': {
    view: 'admin.users.view', create: 'admin.users.create', edit: 'admin.users.edit', delete: 'admin.users.delete', export: 'admin.users.view'
  },
  'employee_dashboard': {
    view: 'self_service.dashboard.view', create: 'self_service.dashboard.view', edit: 'self_service.dashboard.view', delete: 'self_service.dashboard.view', export: 'self_service.dashboard.view'
  },
  'my_team': {
    view: 'self_service.executive_team_dashboard_access', create: 'self_service.executive_team_dashboard_access', edit: 'self_service.executive_team_dashboard_access', delete: 'self_service.executive_team_dashboard_access', export: 'self_service.executive_team_dashboard_access'
  },
  'my-team': {
    view: 'self_service.executive_team_dashboard_access', create: 'self_service.executive_team_dashboard_access', edit: 'self_service.executive_team_dashboard_access', delete: 'self_service.executive_team_dashboard_access', export: 'self_service.executive_team_dashboard_access'
  },
  'leaveRequests': {
    view: 'hr.leaves.view', create: 'self_service.leaves.create', edit: 'hr.leaves.approve', delete: 'hr.leaves.delete', export: 'hr.leaves.view'
  },
  'leaves': {
    view: 'hr.leaves.view', create: 'self_service.leaves.create', edit: 'hr.leaves.approve', delete: 'hr.leaves.delete', export: 'hr.leaves.view'
  },
  'penalties': {
    view: 'hr.penalties.view', create: 'hr.penalties.create', edit: 'hr.penalties.edit', delete: 'hr.penalties.delete', export: 'hr.penalties.view'
  },
  'investigations': {
    view: 'hr.investigations.view', create: 'hr.investigations.manage', edit: 'hr.investigations.manage', delete: 'hr.investigations.manage', export: 'hr.investigations.view'
  },
  'admin_notices': {
    view: 'admin.notices.view', create: 'admin.notices.manage', edit: 'admin.notices.manage', delete: 'admin.notices.manage', export: 'admin.notices.view'
  },
  'system_kpis': {
    view: 'admin.system_logs.view', create: 'admin.system_logs.view', edit: 'admin.system_logs.view', delete: 'admin.system_logs.view', export: 'admin.system_logs.view'
  },
  'mission-allowance-runs': {
    view: 'payroll.mission_allowance_runs.view', create: 'payroll.mission_allowance_runs.create', edit: 'payroll.mission_allowance_runs.edit', delete: 'payroll.mission_allowance_runs.delete', export: 'payroll.mission_allowance_runs.export'
  }
};

export const usePermissions = () => {
  const { user, profile, isAdmin, isHR, isFinance, isOperations } = useAuth();
  const { adminDepartments = [], projectTasks = [] } = useData();

  const userRole = (profile as any)?.role || 'Viewer';
  const appUser = profile as AppUser | null;
  
  // Safely parse permissions if stored as string
  let dbPermissions = appUser?.permissions;
  if (typeof dbPermissions === 'string') {
    try {
      dbPermissions = JSON.parse(dbPermissions);
    } catch (e) {
      dbPermissions = undefined;
    }
  }

  // Resolve All Effective Permissions (Combined Role list & Direct assignment list)
  const getEffectivePermissions = (): string[] => {
    let perms: string[] = [];

    // 1. Get from Role
    if (userRole && ROLE_PERMISSIONS[userRole]) {
      perms = [...ROLE_PERMISSIONS[userRole]];
    } else {
      // Fallback for custom role strings
      perms = ROLE_PERMISSIONS['Viewer'];
    }

    // 2. Direct permissions in JSON if present
    if (dbPermissions) {
      // Direct star permission
      if ((dbPermissions as any).all) {
        perms.push('*');
      }

      // Check direct list
      if (Array.isArray((dbPermissions as any).directPermissions)) {
        perms = [...perms, ...(dbPermissions as any).directPermissions];
      }
    }

    // Legacy default fallbacks
    if (isAdmin) {
      perms.push('*');
    }

    const baseSet = Array.from(new Set(perms));
    return expandPermissions(baseSet);
  };

  const effectivePermissions = getEffectivePermissions();

  // Helper matching permission key (handles *, wildcards like hr.*)
  const can = (requiredPerm: string): boolean => {
    if (effectivePermissions.includes('*') || effectivePermissions.includes('all')) return true;
    if (effectivePermissions.includes(requiredPerm)) return true;

    // Wildcard matching (e.g. hr.* matching hr.employees.view)
    const requiredParts = requiredPerm.split('.');
    for (const has of effectivePermissions) {
      const hasParts = has.split('.');
      let match = true;
      for (let i = 0; i < hasParts.length; i++) {
        if (hasParts[i] === '*') {
          return true;
        }
        if (hasParts[i] !== requiredParts[i]) {
          match = false;
          break;
        }
      }
      if (match && hasParts.length === requiredParts.length) {
        return true;
      }
    }
    return false;
  };

  const canAny = (permissionKeys: string[]): boolean => {
    return permissionKeys.some(p => can(p));
  };

  const canAll = (permissionKeys: string[]): boolean => {
    return permissionKeys.every(p => can(p));
  };

  const canViewModule = (moduleName: string): boolean => {
    return can(`${moduleName}.dashboard.view`) || can(`${moduleName}.view`);
  };

  // Resolve Linked Employee Profile ID
  const getEmployeeId = (): string | null => {
    return (profile as any)?.employeeId || (profile as any)?.id || user?.uid || null;
  };

  const employeeId = getEmployeeId();

  // Project Access Logic (Contextual)
  const canAccessProject = (project: any): boolean => {
    if (can('*') || can('operations.projects.view_all')) return true;
    if (!employeeId) return false;

    // Is PM or TL
    if (project.projectManagerId === employeeId) return true;
    if (project.teamLeaderId === employeeId || 
        project.consultantTlId === employeeId || 
        project.developerTlId === employeeId) return true;

    // Contextual: Has an assigned/created/mentioned task in this project
    const hasProjectTaskContext = projectTasks.some((t: any) => {
      if (t.projectId !== project.id) return false;
      const isCreator = t.creatorId === employeeId;
      const isSingleAssignee = t.assignedToId === employeeId;
      let isMultiAssignee = false;
      if (t.assignedToIds) {
        try {
          const ids = Array.isArray(t.assignedToIds) ? t.assignedToIds : JSON.parse(t.assignedToIds);
          if (Array.isArray(ids) && ids.includes(employeeId)) isMultiAssignee = true;
        } catch (e) {}
      }
      let isMentioned = false;
      if (t.mentions) {
        try {
          const mIds = Array.isArray(t.mentions) ? t.mentions : JSON.parse(t.mentions);
          if (Array.isArray(mIds) && mIds.includes(employeeId)) isMentioned = true;
        } catch (e) {}
      }
      return isCreator || isSingleAssignee || isMultiAssignee || isMentioned;
    });

    if (hasProjectTaskContext) return true;

    // Mentioned in project chat message
    if (project.chat) {
      try {
        const chatMsgs = Array.isArray(project.chat) ? project.chat : JSON.parse(project.chat);
        if (Array.isArray(chatMsgs) && chatMsgs.some((m: any) => m.userId === employeeId || (Array.isArray(m.mentions) && m.mentions.includes(employeeId)))) {
          return true;
        }
      } catch (e) {}
    }

    return false;
  };

  // Task Access Logic (Contextual)
  const canAccessTask = (task: any, project?: any): boolean => {
    if (can('*') || can('operations.tasks.view_all')) return true;
    if (!employeeId) return false;

    // Project context check (PM/TL of project has full task visibility)
    if (project && (
      project.projectManagerId === employeeId || 
      project.teamLeaderId === employeeId ||
      project.consultantTlId === employeeId ||
      project.developerTlId === employeeId
    )) return true;

    // Task details check
    if (task.creatorId === employeeId) return true;
    
    // Assignee checks
    if (task.assignedToId === employeeId) return true;
    if (task.assignedToIds) {
      try {
        const ids = Array.isArray(task.assignedToIds) ? task.assignedToIds : JSON.parse(task.assignedToIds);
        if (Array.isArray(ids) && ids.includes(employeeId)) return true;
      } catch (e) {}
    }

    // Mentions
    if (task.mentions) {
      try {
        const mIds = Array.isArray(task.mentions) ? task.mentions : JSON.parse(task.mentions);
        if (Array.isArray(mIds) && mIds.includes(employeeId)) return true;
      } catch (e) {}
    }

    // Mentioned in task comments
    if (task.comments) {
      try {
        const comments = Array.isArray(task.comments) ? task.comments : JSON.parse(task.comments);
        if (Array.isArray(comments) && comments.some((c: any) => c.userId === employeeId || (Array.isArray(c.mentions) && c.mentions.includes(employeeId)))) {
          return true;
        }
      } catch (e) {}
    }

    return false;
  };

  const canAccessTaskChat = (task: any): boolean => {
    if (can('*') || can('operations.task_chat.view_all')) return true;
    return canAccessTask(task);
  };

  const getAssignedIds = (task: any): string[] => {
    if (!task) return [];
    if (Array.isArray(task.assignedToIds)) return task.assignedToIds;
    if (typeof task.assignedToIds === 'string') {
      try {
        const parsed = JSON.parse(task.assignedToIds);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return task.assignedToId ? [task.assignedToId] : [];
  };

  // Fine-grained permission helpers requested by user
  const canCreateProject = (): boolean => {
    if ((profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin' || can('*') || can('operations.projects.create')) return true;
    return false;
  };

  const canDeleteProject = (project: any): boolean => {
    if ((profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin' || can('*') || can('operations.projects.delete')) return true;
    return false;
  };

  const canViewTask = (task: any, project: any): boolean => {
    if ((profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin' || can('*') || can('operations.tasks.view_all')) return true;
    if (!can('operations.tasks.view')) return false;
    return canAccessTask(task, project);
  };

  const canEditProject = (project: any): boolean => {
    const role = (profile?.role as any) || '';
    if (role === 'Admin' || role === 'Super Admin' || role === 'Operations Director' || role === 'General Manager' || role === 'CEO' || can('*') || can('operations.projects.view_all')) return true;
    if (!can('operations.projects.edit') && !can('operations.projects.manage_scope') && !can('operations.projects.manage_phases')) return false;
    const userCandIds = [employeeId, (profile as any)?.id, user?.uid, (profile as any)?.employeeId].filter(Boolean).map(id => String(id).toLowerCase());
    if (userCandIds.length === 0) return true;
    return userCandIds.some(id => 
      id === String(project?.projectManagerId || '').toLowerCase() ||
      id === String(project?.teamLeaderId || '').toLowerCase() ||
      id === String(project?.consultantTlId || '').toLowerCase() ||
      id === String(project?.developerTlId || '').toLowerCase() ||
      id === String(project?.creatorId || '').toLowerCase()
    );
  };

  const canManageProjectPhases = (project: any): boolean => {
    const role = (profile?.role as any) || '';
    if (role === 'Admin' || role === 'Super Admin' || role === 'Operations Director' || role === 'General Manager' || role === 'CEO' || can('*') || can('operations.projects.manage_phases') || can('operations.projects.view_all') || can('operations.projects.edit')) return true;
    if (!can('operations.projects.manage_phases') && !can('operations.projects.edit')) return false;
    const userCandIds = [employeeId, (profile as any)?.id, user?.uid, (profile as any)?.employeeId].filter(Boolean).map(id => String(id).toLowerCase());
    if (userCandIds.length === 0) return true;
    return userCandIds.some(id => 
      id === String(project?.projectManagerId || '').toLowerCase() ||
      id === String(project?.teamLeaderId || '').toLowerCase() ||
      id === String(project?.consultantTlId || '').toLowerCase() ||
      id === String(project?.developerTlId || '').toLowerCase() ||
      id === String(project?.creatorId || '').toLowerCase()
    );
  };

  const canManageProjectScope = (project: any): boolean => {
    const role = (profile?.role as any) || '';
    if (role === 'Admin' || role === 'Super Admin' || role === 'Operations Director' || role === 'General Manager' || role === 'CEO' || can('*') || can('operations.projects.manage_scope') || can('operations.projects.view_all') || can('operations.projects.edit')) return true;
    if (!can('operations.projects.manage_scope') && !can('operations.projects.edit')) return false;
    const userCandIds = [employeeId, (profile as any)?.id, user?.uid, (profile as any)?.employeeId].filter(Boolean).map(id => String(id).toLowerCase());
    if (userCandIds.length === 0) return true;
    return userCandIds.some(id => 
      id === String(project?.projectManagerId || '').toLowerCase() ||
      id === String(project?.teamLeaderId || '').toLowerCase() ||
      id === String(project?.consultantTlId || '').toLowerCase() ||
      id === String(project?.developerTlId || '').toLowerCase() ||
      id === String(project?.creatorId || '').toLowerCase()
    );
  };

  const canCreateTask = (project: any): boolean => {
    const userRole = (profile?.role as string) || '';
    if (userRole === 'Admin' || userRole === 'Super Admin' || can('*') || can('operations.tasks.view_all')) return true;
    if (!can('operations.tasks.create') && !can('self_service.my_tasks.view') && !can('operations.tasks.view')) return false;
    if (!employeeId && userRole === 'Viewer') return false;
    if (!project) return true;
    return project.projectManagerId === employeeId || 
           project.teamLeaderId === employeeId || 
           project.consultantTlId === employeeId || 
           project.developerTlId === employeeId ||
           ['Operations Director', 'Project Manager', 'Team Leader', 'HR Manager', 'General Manager', 'CEO'].includes(userRole);
  };

  const canEditTask = (task: any, project: any): boolean => {
    if ((profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin' || can('*') || can('operations.tasks.view_all')) return true;
    if (!can('operations.tasks.edit')) return false;
    if (!employeeId) return false;
    // PM, TL or Creator can edit details
    const isPMOrTL = project && (
      project.projectManagerId === employeeId || 
      project.teamLeaderId === employeeId || 
      project.consultantTlId === employeeId || 
      project.developerTlId === employeeId
    );
    const isCreator = task?.creatorId === employeeId;
    return isPMOrTL || isCreator;
  };

  const canDeleteTask = (task: any, project: any): boolean => {
    if ((profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin' || can('*') || can('operations.tasks.view_all')) return true;
    if (!can('operations.tasks.delete')) return false;
    if (!employeeId) return false;
    // PM or TL can delete tasks
    return !!project && (
      project.projectManagerId === employeeId || 
      project.teamLeaderId === employeeId || 
      project.consultantTlId === employeeId || 
      project.developerTlId === employeeId
    );
  };

  const canChangeTaskStatus = (task: any, project: any): boolean => {
    if ((profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin' || can('*') || can('operations.tasks.view_all')) return true;
    if (!can('operations.tasks.change_status')) return false;
    if (!employeeId) return false;
    // Creator, Assignee, PM or TL can change status
    const isPMOrTL = project && (
      project.projectManagerId === employeeId || 
      project.teamLeaderId === employeeId || 
      project.consultantTlId === employeeId || 
      project.developerTlId === employeeId
    );
    const isCreator = task?.creatorId === employeeId;
    const isAssigned = task?.assignedToId === employeeId || getAssignedIds(task).includes(employeeId);
    return isPMOrTL || isCreator || isAssigned;
  };

  const canApproveTask = (task: any, project: any): boolean => {
    if ((profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin' || can('*') || can('operations.tasks.view_all')) return true;
    if (!can('operations.tasks.approve')) return false;
    if (!employeeId) return false;
    return !!project && (
      project.projectManagerId === employeeId || 
      project.teamLeaderId === employeeId || 
      project.consultantTlId === employeeId || 
      project.developerTlId === employeeId
    );
  };

  const canCloseTask = (task: any, project: any): boolean => {
    if ((profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin' || can('*') || can('operations.tasks.view_all')) return true;
    if (!can('operations.tasks.close')) return false;
    if (!employeeId) return false;
    return !!project && (
      project.projectManagerId === employeeId || 
      project.teamLeaderId === employeeId || 
      project.consultantTlId === employeeId || 
      project.developerTlId === employeeId
    );
  };

  // Fine-grained Disciplinary Penalty & Investigation helpers
  const canViewPenalties = (): boolean => {
    if (isAdmin || isHR || (profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin') return true;
    return can('*') || can('hr.penalties.view') || can('hr.employees.view') || can('hr.penalties.approve');
  };

  const canCreatePenalty = (): boolean => {
    if (isAdmin || isHR || (profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin') return true;
    return can('*') || can('hr.penalties.create') || can('hr.employees.create') || can('hr.employees.edit');
  };

  const canEditPenalty = (penalty?: any): boolean => {
    if (isAdmin || isHR || (profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin') return true;
    if (can('*') || can('hr.penalties.edit') || can('hr.employees.edit')) return true;
    // Direct creator before final approval
    if (penalty && penalty.createdBy && employeeId && penalty.createdBy === employeeId && penalty.status === 'Draft') return true;
    return false;
  };

  const canApprovePenalty = (penalty?: any): boolean => {
    if (isAdmin || isHR || (profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin') return true;
    if (can('*') || can('hr.penalties.approve') || can('hr.employees.edit')) return true;
    return false;
  };

  const canDeletePenalty = (penalty?: any): boolean => {
    if (isAdmin || (profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin') return true;
    if (can('*') || can('hr.penalties.delete')) return true;
    return false;
  };

  const canResolveGrievance = (): boolean => {
    if (isAdmin || isHR || (profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin') return true;
    return can('*') || can('hr.penalties.grievance') || can('hr.penalties.approve') || can('hr.employees.edit');
  };

  const canManageInvestigations = (): boolean => {
    if (isAdmin || isHR || (profile?.role as any) === 'Admin' || (profile?.role as any) === 'Super Admin') return true;
    return can('*') || can('hr.investigations.manage') || can('hr.employees.edit');
  };

  const canPerformAction = (resource: string, action: string, context?: any): boolean => {
    const requiredPerm = `${resource}.${action}`;
    if (!can(requiredPerm)) return false;

    if (context) {
      if (resource === 'projects') return canAccessProject(context);
      if (resource === 'tasks') return canAccessTask(context);
    }
    return true;
  };

  // Legacy Screen-Based fallback checking
  const checkPerm = (screenId: string, action: 'view' | 'create' | 'edit' | 'delete' | 'export') => {
    // Try translating screenId to the new permission key first
    const mappedNode = SCREEN_TO_PERMISSION_MAP[screenId];
    if (mappedNode && mappedNode[action]) {
      return can(mappedNode[action]);
    }

    return false;
  };

  return {
    can,
    canAny,
    canAll,
    canViewModule,
    canAccessProject,
    canAccessTask,
    canAccessTaskChat,
    canPerformAction,
    canEditProject,
    canManageProjectPhases,
    canManageProjectScope,
    canCreateProject,
    canDeleteProject,
    canViewTask,
    canCreateTask,
    canEditTask,
    canDeleteTask,
    canChangeTaskStatus,
    canApproveTask,
    canCloseTask,
    canViewPenalties,
    canCreatePenalty,
    canEditPenalty,
    canApprovePenalty,
    canDeletePenalty,
    canResolveGrievance,
    canManageInvestigations,
    canView: (screenId: string) => checkPerm(screenId, 'view'),
    canCreate: (screenId: string) => checkPerm(screenId, 'create'),
    canEdit: (screenId: string) => checkPerm(screenId, 'edit'),
    canDelete: (screenId: string) => checkPerm(screenId, 'delete'),
    canExport: (screenId: string) => checkPerm(screenId, 'export'),
    allowedDepartments: Array.isArray((dbPermissions as any)?.departments)
      ? (dbPermissions as any).departments
      : (adminDepartments || []).map(d => d.id),
    isSuperAdmin: !!isAdmin || userRole === 'Admin' || userRole === 'Super Admin',
    employeeId
  };
};
