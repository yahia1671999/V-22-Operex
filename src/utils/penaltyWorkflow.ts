import { Employee } from '../types';

export interface PenaltyManagersInfo {
  targetEmp: Employee | null;
  directMgr: Employee | null;
  higherMgr: Employee | null;
  hasHigherManager: boolean;
  directMgrIdentifiers: string[];
  higherMgrIdentifiers: string[];
  targetEmpIdentifiers: string[];
}

export function getPenaltyManagers(penalty: any, employees: Employee[]): PenaltyManagersInfo {
  if (!penalty || !Array.isArray(employees)) {
    return {
      targetEmp: null,
      directMgr: null,
      higherMgr: null,
      hasHigherManager: false,
      directMgrIdentifiers: [],
      higherMgrIdentifiers: [],
      targetEmpIdentifiers: [],
    };
  }

  const pEmpId = String(penalty.employeeId || '').trim().toLowerCase();

  // 1. Find Target Employee
  const targetEmp = employees.find((e) => {
    const ids = [e.id, e.employeeId, e.userId, e.email]
      .filter(Boolean)
      .map((x) => String(x).trim().toLowerCase());
    return ids.includes(pEmpId);
  }) || null;

  const targetEmpIdentifiers = targetEmp
    ? [targetEmp.id, targetEmp.employeeId, targetEmp.userId, targetEmp.email, targetEmp.name]
        .filter(Boolean)
        .map((x) => String(x).trim().toLowerCase())
    : [pEmpId].filter(Boolean);

  // 2. Direct Manager
  const directMgrId = targetEmp
    ? (targetEmp.managerId || (targetEmp as any).supervisorId || (targetEmp as any).directManager)
    : null;

  let directMgr: Employee | null = null;
  if (directMgrId) {
    const directMgrIdStr = String(directMgrId).trim().toLowerCase();
    directMgr = employees.find((e) => {
      const ids = [e.id, e.employeeId, e.userId, e.email, e.name]
        .filter(Boolean)
        .map((x) => String(x).trim().toLowerCase());
      return ids.includes(directMgrIdStr);
    }) || null;
  }

  const directMgrIdentifiers = directMgr
    ? [directMgr.id, directMgr.employeeId, directMgr.userId, directMgr.email, directMgr.name]
        .filter(Boolean)
        .map((x) => String(x).trim().toLowerCase())
    : [];

  // 3. Higher Manager (The direct manager of the direct manager)
  let higherMgr: Employee | null = null;
  if (directMgr) {
    const higherMgrId = directMgr.managerId || (directMgr as any).supervisorId || (directMgr as any).directManager;
    if (higherMgrId) {
      const higherMgrIdStr = String(higherMgrId).trim().toLowerCase();
      // Ensure higher manager is NOT the direct manager themselves and NOT the target employee
      if (!directMgrIdentifiers.includes(higherMgrIdStr) && !targetEmpIdentifiers.includes(higherMgrIdStr)) {
        higherMgr = employees.find((e) => {
          const ids = [e.id, e.employeeId, e.userId, e.email, e.name]
            .filter(Boolean)
            .map((x) => String(x).trim().toLowerCase());
          return ids.includes(higherMgrIdStr);
        }) || null;
      }
    }
  }

  // Also ensure higher manager object is not identical to direct manager
  if (higherMgr && directMgr && (higherMgr.id === directMgr.id || (higherMgr.employeeId && higherMgr.employeeId === directMgr.employeeId))) {
    higherMgr = null;
  }

  const higherMgrIdentifiers = higherMgr
    ? [higherMgr.id, higherMgr.employeeId, higherMgr.userId, higherMgr.email, higherMgr.name]
        .filter(Boolean)
        .map((x) => String(x).trim().toLowerCase())
    : [];

  const hasHigherManager = Boolean(higherMgr && higherMgrIdentifiers.length > 0);

  return {
    targetEmp,
    directMgr,
    higherMgr,
    hasHigherManager,
    directMgrIdentifiers,
    higherMgrIdentifiers,
    targetEmpIdentifiers,
  };
}

export function getUserIdentifiers(user: any, profile: any, currentEmp?: Employee | null): string[] {
  const set = new Set<string>();
  if (user?.uid) set.add(String(user.uid).trim().toLowerCase());
  if (user?.email) set.add(String(user.email).trim().toLowerCase());
  if (user?.displayName) set.add(String(user.displayName).trim().toLowerCase());
  if (profile?.id) set.add(String(profile.id).trim().toLowerCase());
  if (profile?.employeeId) set.add(String(profile.employeeId).trim().toLowerCase());
  if (profile?.userId) set.add(String(profile.userId).trim().toLowerCase());
  if (profile?.email) set.add(String(profile.email).trim().toLowerCase());
  if (profile?.name) set.add(String(profile.name).trim().toLowerCase());
  if (currentEmp) {
    if (currentEmp.id) set.add(String(currentEmp.id).trim().toLowerCase());
    if (currentEmp.employeeId) set.add(String(currentEmp.employeeId).trim().toLowerCase());
    if (currentEmp.userId) set.add(String(currentEmp.userId).trim().toLowerCase());
    if (currentEmp.email) set.add(String(currentEmp.email).trim().toLowerCase());
    if (currentEmp.name) set.add(String(currentEmp.name).trim().toLowerCase());
  }
  return Array.from(set);
}

export function checkPenaltyUserRole(
  penalty: any,
  employees: Employee[],
  user: any,
  profile: any,
  isAdmin: boolean,
  isHR: boolean,
  currentEmp?: Employee | null
) {
  const { targetEmp, directMgr, higherMgr, hasHigherManager, directMgrIdentifiers, higherMgrIdentifiers, targetEmpIdentifiers } =
    getPenaltyManagers(penalty, employees);

  const userIds = getUserIdentifiers(user, profile, currentEmp);

  const roleStr = String((profile as any)?.role || (user as any)?.role || '').toLowerCase();
  const isHRorAdmin = Boolean(
    isAdmin ||
    isHR ||
    roleStr.includes('admin') ||
    roleStr.includes('super admin') ||
    roleStr.includes('hr') ||
    roleStr.includes('أدمن') ||
    roleStr.includes('موارد بشرية')
  );

  const isDirectManager = directMgrIdentifiers.some((id) => userIds.includes(id));
  const isHigherManager = higherMgrIdentifiers.some((id) => userIds.includes(id));
  const isTargetEmployee = targetEmpIdentifiers.some((id) => userIds.includes(id));

  const status = penalty.status || 'Pending Direct Manager';
  const isPendingDirectManager = ['Pending Direct Manager', 'Pending Approval', 'Pending', 'Draft'].includes(status);
  const isPendingHigherManager = status === 'Pending Higher Manager';
  const isPendingHR = status === 'Pending HR';

  // Permission flags
  const canActAsDirectManager = (isDirectManager || isHRorAdmin) && isPendingDirectManager;
  // STRICT RULE: Direct Manager CANNOT act as Higher Manager! Only actual higher manager or HR/Admin.
  const canActAsHigherManager = (isHigherManager || isHRorAdmin) && isPendingHigherManager;
  const canActAsHR = isHRorAdmin && (isPendingHR || status === 'Approved' || status === 'Cancelled' || status === 'Returned' || status === 'Rejected');

  return {
    targetEmp,
    directMgr,
    higherMgr,
    hasHigherManager,
    isDirectManager,
    isHigherManager,
    isTargetEmployee,
    isHRorAdmin,
    isPendingDirectManager,
    isPendingHigherManager,
    isPendingHR,
    canActAsDirectManager,
    canActAsHigherManager,
    canActAsHR,
  };
}
