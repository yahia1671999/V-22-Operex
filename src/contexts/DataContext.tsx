import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  Employee, 
  Transaction, 
  PayrollRun, 
  AllowanceType, 
  AppUser, 
  AttendanceRecord, 
  AttendanceDevice, 
  AttendanceShift,
  AbsenceType,
  AbsenceRecord,
  MissionType,
  Mission,
  Project,
  ProjectTask,
  AdministrativeDepartment,
  LeaveRequest,
  SystemSettings,
  Penalty,
  Investigation,
  PerformanceCycle,
  PerformanceCriteria,
  PerformanceTemplate,
  PerformanceEvaluation,
  DevelopmentPlan,
  AdministrativeNotice
} from '../types';
import { useAuth } from '../AuthContext';
import { ROLE_PERMISSIONS, expandPermissions } from '../lib/rolePermissions';

export interface RemoteAttendanceOptions {
  workMode?: string;
  isRemote?: boolean;
  timestamp?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  note?: string;
}

export type RecordAttendanceFn = (
  type: 'check-in' | 'check-out',
  options?: RemoteAttendanceOptions
) => Promise<{ success: boolean; time?: string; error?: string }>;

interface DataContextType {
  employees: Employee[];
  transactions: Transaction[];
  payrollRuns: PayrollRun[];
  allowanceTypes: AllowanceType[];
  appUsers: AppUser[];
  attendanceRecords: AttendanceRecord[];
  attendanceDevices: AttendanceDevice[];
  attendanceShifts: AttendanceShift[];
  absenceTypes: AbsenceType[];
  absenceRecords: AbsenceRecord[];
  missionTypes: MissionType[];
  missions: Mission[];
  projects: Project[];
  projectTasks: ProjectTask[];
  adminDepartments: AdministrativeDepartment[];
  leaveRequests: LeaveRequest[];
  penalties: Penalty[];
  performanceCycles: PerformanceCycle[];
  performanceTemplates: PerformanceTemplate[];
  performanceCriteria: PerformanceCriteria[];
  performanceEvaluations: PerformanceEvaluation[];
  performanceDevelopmentPlans: DevelopmentPlan[];
  administrativeNotices: AdministrativeNotice[];
  investigations: Investigation[];
  systemSettings: SystemSettings | null;
  adminStats: any | null;
  loading: boolean;
  error: any | null;
  refreshData: () => Promise<void>;
  recordRemoteAttendance: RecordAttendanceFn;
  recordAttendance: RecordAttendanceFn;
  addAdministrativeNotice: (notice: Partial<AdministrativeNotice>) => Promise<boolean>;
  updateAdministrativeNotice: (id: string, notice: Partial<AdministrativeNotice>) => Promise<boolean>;
  deleteAdministrativeNotice: (id: string) => Promise<boolean>;
  markNoticeAsRead: (id: string) => Promise<boolean>;
}

const DataContext = createContext<DataContextType>({
  employees: [],
  transactions: [],
  payrollRuns: [],
  allowanceTypes: [],
  appUsers: [],
  attendanceRecords: [],
  attendanceDevices: [],
  attendanceShifts: [],
  absenceTypes: [],
  absenceRecords: [],
  missionTypes: [],
  missions: [],
  projects: [],
  projectTasks: [],
  adminDepartments: [],
  leaveRequests: [],
  penalties: [],
  performanceCycles: [],
  performanceTemplates: [],
  performanceCriteria: [],
  performanceEvaluations: [],
  performanceDevelopmentPlans: [],
  administrativeNotices: [],
  investigations: [],
  systemSettings: null,
  adminStats: null,
  loading: true,
  error: null,
  refreshData: async () => {},
  recordRemoteAttendance: async () => ({ success: false, error: 'Context not initialized' }),
  recordAttendance: async () => ({ success: false, error: 'Context not initialized' }),
  addAdministrativeNotice: async () => false,
  updateAdministrativeNotice: async () => false,
  deleteAdministrativeNotice: async () => false,
  markNoticeAsRead: async () => false,
});

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceDevices, setAttendanceDevices] = useState<AttendanceDevice[]>([]);
  const [attendanceShifts, setAttendanceShifts] = useState<AttendanceShift[]>([]);
  const [absenceTypes, setAbsenceTypes] = useState<AbsenceType[]>([]);
  const [absenceRecords, setAbsenceRecords] = useState<AbsenceRecord[]>([]);
  const [missionTypes, setMissionTypes] = useState<MissionType[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>([]);
  const [adminDepartments, setAdminDepartments] = useState<AdministrativeDepartment[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [performanceCycles, setPerformanceCycles] = useState<PerformanceCycle[]>([]);
  const [performanceTemplates, setPerformanceTemplates] = useState<PerformanceTemplate[]>([]);
  const [performanceCriteria, setPerformanceCriteria] = useState<PerformanceCriteria[]>([]);
  const [performanceEvaluations, setPerformanceEvaluations] = useState<PerformanceEvaluation[]>([]);
  const [performanceDevelopmentPlans, setPerformanceDevelopmentPlans] = useState<DevelopmentPlan[]>([]);
  const [administrativeNotices, setAdministrativeNotices] = useState<AdministrativeNotice[]>([]);
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [adminStats, setAdminStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any | null>(null);

  const refreshData = useCallback(async () => {
    if (!user) return;
    
    // Mapping of entity paths to their required permission keys (matches server.ts)
    const permissionMap: Record<string, string> = {
      'employees': 'employees',
      'transactions': 'transactions',
      'payroll-runs': 'payroll',
      'payroll-results': 'payroll',
      'app-users': 'users',
      'attendance-records': 'attendance',
      'attendance-devices': 'attendance',
      'attendance-shifts': 'attendance',
      'absence-types': 'attendance',
      'absence-records': 'attendance',
      'allowance-types': 'allowanceTypes',
      'mission-types': 'missions',
      'missions': 'missions',
      'projects': 'operations',
      'project-tasks': 'operations',
      'admin-departments': 'adminStructure',
      'leave-requests': 'dashboard_hr',
      'penalties': 'employees',
      'investigations': 'employees',
      'system-settings': 'users'
    };

    const hasPermission = (entityPath: string) => {
        if (entityPath === 'attendance-records') return true;
        if (!profile) return false;
        const p = profile as any;
        const userRole = p.role || 'Viewer';
        if (userRole === 'Admin' || userRole === 'Super Admin') return true;

        // Gather effective permissions (combined role default + direct permissions)
        let permsList: string[] = [];
        if (ROLE_PERMISSIONS[userRole]) {
          permsList = [...ROLE_PERMISSIONS[userRole]];
        } else {
          permsList = [...(ROLE_PERMISSIONS['Viewer'] || [])];
        }

        let dbPermsObj = p.permissions || {};
        if (typeof dbPermsObj === 'string') {
          try {
            dbPermsObj = JSON.parse(dbPermsObj);
          } catch (e) {
            dbPermsObj = {};
          }
        }
        if (dbPermsObj.all) return true;

        if (Array.isArray(dbPermsObj.directPermissions)) {
          permsList = [...permsList, ...dbPermsObj.directPermissions];
        }
        
        permsList = expandPermissions(permsList);

        const can = (permKey: string): boolean => {
          if (permsList.includes('*') || permsList.includes('all')) return true;
          if (permsList.includes(permKey)) return true;
          
          const requiredParts = permKey.split('.');
          for (const has of permsList) {
            const hasParts = has.split('.');
            let match = true;
            for (let i = 0; i < hasParts.length; i++) {
              if (hasParts[i] === '*') return true;
              if (hasParts[i] !== requiredParts[i]) {
                match = false;
                break;
              }
            }
            if (match && hasParts.length === requiredParts.length) return true;
          }
          return false;
        };

        // Strict conditional fetching requested by the user
        if (entityPath === 'projects' || entityPath === 'app-users' || entityPath === 'users') {
          return true; // All authenticated users can load project list and user directory for dropdowns and task selection
        }
        if (entityPath === 'project-tasks') {
          return can('operations.tasks.view') || can('operations.tasks.view_all') || can('self_service.my_tasks.view');
        }
        if (entityPath === 'missions' || entityPath === 'mission-requests' || entityPath === 'mission-types') {
          return true; // Server securely shields based on user role & manager subordinates
        }
        if (entityPath === 'employees') {
          return true; // Server securely shields sensitive columns of other employees
        }
        if (entityPath === 'system-settings') {
          return true; // All authenticated users can read system-settings/branding
        }
        if (entityPath === 'leave-requests') {
          return true; // Server securely shields based on user role & manager subordinates
        }
        if (entityPath === 'attendance-records' || entityPath === 'investigations' || entityPath === 'penalties' || entityPath === 'administrative-notices') {
          return true; // Server securely shields based on user role, target IDs & manager subordinates
        }

        const requiredPerm = permissionMap[entityPath];
        if (!requiredPerm) return true; // Default allow if not mapped

        // Helper to check wildcard permission matching
        const canMatch = (hasPerms: string[], requiredKey: string): boolean => {
          if (hasPerms.includes('*') || hasPerms.includes('all')) return true;
          if (hasPerms.includes(requiredKey)) return true;

          const blockToModulePrefix: Record<string, string> = {
            'employees': 'hr.employees',
            'attendance': 'hr.attendance',
            'missions': 'hr.missions',
            'absences': 'hr.attendance',
            'hr': 'hr',
            'adminStructure': 'hr.admin_structure',
            'payroll': 'payroll.runs',
            'transactions': 'payroll.transactions',
            'allowanceTypes': 'payroll.allowance_types',
            'operations': 'operations',
            'users': 'admin.users',
            'leave-requests': 'hr.leaves'
          };

          const matchedPrefix = blockToModulePrefix[requiredKey];

          for (const has of hasPerms) {
            if (has === '*' || has === 'all') return true;
            if (has === requiredKey || has === `${requiredKey}.*` || has === `${requiredKey}.view`) return true;

            if (matchedPrefix) {
              if (has.startsWith(matchedPrefix)) return true;
              const part0 = matchedPrefix.split('.')[0];
              if (has === `${part0}.*` || has.startsWith(`${part0}.`)) return true;
            }
          }
          return false;
        };

        if (canMatch(permsList, requiredPerm)) return true;

        // Check direct screen permission (backwards compatibility)
        if (dbPermsObj.screens?.[requiredPerm]?.view) return true;

        // Check module dashboard fallbacks (matching server logic)
        const resourceToModule: Record<string, string[]> = {
            'dashboard_hr': ['employees', 'attendance', 'missions', 'adminStructure', 'absences', 'hr', 'attendance-devices', 'absence-types', 'mission-types', 'leave-requests', 'attendance-records', 'attendance-shifts'],
            'dashboard_payroll': ['payroll', 'transactions', 'allowanceTypes', 'settlements', 'finance', 'payroll-results', 'payroll-runs', 'allowance-types'],
            'dashboard_ops': ['operations', 'projects', 'project-tasks', 'my-tasks']
        };

        for (const [moduleDash, resources] of Object.entries(resourceToModule)) {
            if (resources.includes(requiredPerm)) {
               if (dbPermsObj.screens?.[moduleDash]?.view) return true;
               if (moduleDash === 'dashboard_hr' && permsList.some(h => h.startsWith('hr.'))) return true;
               if (moduleDash === 'dashboard_payroll' && permsList.some(h => h.startsWith('payroll.'))) return true;
               if (moduleDash === 'dashboard_ops' && permsList.some(h => h.startsWith('operations.'))) return true;
            }
        }

        if (dbPermsObj.screens?.[requiredPerm]?.view) return true;

        return false;
    };

    try {
      const fetchEntity = async (path: string, retries = 3) => {
        if (!hasPermission(path)) {
            console.log(`Skipping fetch for ${path} due to missing permissions`);
            return null;
        }
        
        const baseUrl = '/api';
        const token = localStorage.getItem('auth_token');
        if (!token) {
            return null;
        }
        
        for (let i = 0; i < retries; i++) {
          try {
            const res = await fetch(`${baseUrl}/${path}`, {
              headers: {
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              }
            });
            
            if (!res.ok) {
              if (res.status === 403) return null;
              if (res.status === 401) {
                  // Token might be expired, let AuthContext handle it or just fail this fetch
                  return null;
              }
              console.error(`Failed to fetch ${path}: ${res.status} ${res.statusText}`);
              return null;
            }

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
              console.warn(`Non-JSON response received for ${path} (${contentType})`);
              return null;
            }

            const text = await res.text();
            if (!text || text.trim().startsWith('<')) {
              console.warn(`HTML/Empty payload received for ${path}, skipping JSON parse`);
              return null;
            }

            return JSON.parse(text);
          } catch (e) {
            if (i === retries - 1) {
                console.error(`Network error fetching ${path} after ${retries} attempts:`, e);
                return null;
            }
            // Wait slightly before retry
            await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
          }
        }
        return null;
      };

      // Fetch entities with a small delay between groups to avoid overloading the server
      const employeesData = await fetchEntity('employees');
      const transactionsData = await fetchEntity('transactions');
      const payrollRunsData = await fetchEntity('payroll-runs');
      const allowanceTypesData = await fetchEntity('allowance-types');
      const appUsersData = await fetchEntity('app-users');
      
      // Delay next batch
      await new Promise(resolve => setTimeout(resolve, 100));

      const [
        attendanceRecordsData,
        attendanceDevicesData,
        attendanceShiftsData,
        absenceTypesData,
        absenceRecordsData,
        missionTypesData,
        missionsData,
        projectsData,
        projectTasksData,
        adminDepartmentsData,
        leaveRequestsData,
        penaltiesData,
        systemSettingsData,
        dashboardData,
        perfCyclesData,
        perfTemplatesData,
        perfCriteriaData,
        perfEvaluationsData,
        perfPlansData,
        adminNoticesData,
        investigationsData
      ] = await Promise.all([
        fetchEntity('attendance-records'),
        fetchEntity('attendance-devices'),
        fetchEntity('attendance-shifts'),
        fetchEntity('absence-types'),
        fetchEntity('absence-records'),
        fetchEntity('mission-types'),
        fetchEntity('missions'),
        fetchEntity('projects'),
        fetchEntity('project-tasks'),
        fetchEntity('admin-departments'),
        fetchEntity('leave-requests'),
        fetchEntity('penalties'),
        fetchEntity('system-settings'),
        fetchEntity('employee/dashboard'),
        fetchEntity('performance-cycles'),
        fetchEntity('performance-templates'),
        fetchEntity('performance-criteria'),
        fetchEntity('performance-evaluations'),
        fetchEntity('performance-development-plans'),
        fetchEntity('administrative-notices'),
        fetchEntity('investigations')
      ]);

      if (employeesData !== null) setEmployees(employeesData);
      if (transactionsData !== null) setTransactions(transactionsData);
      if (payrollRunsData !== null) setPayrollRuns(payrollRunsData);
      if (allowanceTypesData !== null) setAllowanceTypes(allowanceTypesData);
      if (appUsersData !== null) setAppUsers(appUsersData);
      if (attendanceRecordsData !== null) setAttendanceRecords(attendanceRecordsData);
      if (attendanceDevicesData !== null) setAttendanceDevices(attendanceDevicesData);
      if (attendanceShiftsData !== null) setAttendanceShifts(attendanceShiftsData);
      if (absenceTypesData !== null) setAbsenceTypes(absenceTypesData);
      if (absenceRecordsData !== null) setAbsenceRecords(absenceRecordsData);
      if (perfCyclesData !== null) setPerformanceCycles(perfCyclesData);
      if (perfTemplatesData !== null) setPerformanceTemplates(perfTemplatesData);
      if (perfCriteriaData !== null) setPerformanceCriteria(perfCriteriaData);
      if (perfEvaluationsData !== null) setPerformanceEvaluations(perfEvaluationsData);
      if (perfPlansData !== null) setPerformanceDevelopmentPlans(perfPlansData);
      if (adminNoticesData !== null) setAdministrativeNotices(adminNoticesData);
      if (investigationsData !== null) setInvestigations(investigationsData);
      if (missionTypesData !== null) setMissionTypes(missionTypesData);
      if (missionsData !== null) setMissions(missionsData);
      if (Array.isArray(projectsData)) {
        setProjects(projectsData);
      }
      if (Array.isArray(projectTasksData)) {
        setProjectTasks(projectTasksData);
      }
      if (adminDepartmentsData !== null) setAdminDepartments(adminDepartmentsData);
      if (leaveRequestsData !== null) setLeaveRequests(leaveRequestsData);
      if (penaltiesData !== null) setPenalties(penaltiesData);
      if (systemSettingsData !== null && systemSettingsData.length > 0) {
        setSystemSettings(systemSettingsData[0]);
      }
      if (dashboardData !== null && dashboardData.adminStats) {
        setAdminStats(dashboardData.adminStats);
      }
      
      setError(null);
    } catch (err: any) {
      console.error('Data refresh failed', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const recordRemoteAttendance: RecordAttendanceFn = useCallback(async (type, options) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        return { success: false, error: 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً' };
      }

      const currentEmp = employees.find(e => 
        e.userId === user?.uid || 
        (e.email && user?.email && e.email.toLowerCase().trim() === user.email.toLowerCase().trim()) ||
        (e.id === (user as any)?.employeeId)
      );
      if (currentEmp && (
        currentEmp.subjectToAttendance === 'No' || 
        currentEmp.subjectToAttendance === 'no' || 
        currentEmp.subjectToAttendance === 'لا' || 
        (currentEmp as any).isSubjectToAttendance === false
      )) {
        const todayStr = new Date().toISOString().slice(0, 10);
        const effDate = currentEmp.attendanceStatusEffectiveDate;
        if (!effDate || todayStr >= effDate) {
          return { success: false, error: 'أنت غير خاضع لنظام الحضور والانصراف' };
        }
      }

      let lat = options?.latitude;
      let lng = options?.longitude;
      let acc = options?.accuracy;

      if (lat === undefined && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 6000,
              maximumAge: 0
            });
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
          acc = position.coords.accuracy;
        } catch (err) {
          console.warn("Geolocation positioning skipped or failed", err);
        }
      }

      const now = options?.timestamp ? new Date(options.timestamp) : new Date();
      const currentIso = now.toISOString();
      
      const pad = (n: number) => String(n).padStart(2, '0');
      const clientDate = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const clientTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh';

      const response = await fetch(`/api/attendance/${type}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          browserInfo: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
          deviceId: typeof navigator !== 'undefined' ? ('WEB-' + (navigator.hardwareConcurrency || 'GENERIC')) : 'WEB-CLIENT',
          workMode: options?.workMode || 'Remotely Work',
          isRemote: options?.isRemote ?? true,
          timestamp: currentIso,
          clientDate,
          clientTime,
          timeZone,
          note: options?.note
        })
      });

      let data: any = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { error: text || `خطأ بالسيرفر (${response.status})` };
      }

      if (response.ok && data.success !== false) {
        await refreshData();
        return { 
          success: true, 
          time: data.time || now.toLocaleTimeString('en-GB', { hour12: false }) 
        };
      } else {
        return { success: false, error: data.error || 'فشل تسجيل العملية' };
      }
    } catch (err: any) {
      console.error('recordRemoteAttendance error:', err);
      return { success: false, error: err?.message || 'حدث خطأ في الاتصال بالسيرفر' };
    }
  }, [refreshData]);

  const recordAttendance = recordRemoteAttendance;

  const addAdministrativeNotice = useCallback(async (notice: Partial<AdministrativeNotice>): Promise<boolean> => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/administrative-notices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(notice)
      });
      if (res.ok) {
        await refreshData();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error adding administrative notice', e);
      return false;
    }
  }, [refreshData]);

  const updateAdministrativeNotice = useCallback(async (id: string, notice: Partial<AdministrativeNotice>): Promise<boolean> => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/administrative-notices/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(notice)
      });
      if (res.ok) {
        await refreshData();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error updating administrative notice', e);
      return false;
    }
  }, [refreshData]);

  const deleteAdministrativeNotice = useCallback(async (id: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/administrative-notices/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        await refreshData();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error deleting administrative notice', e);
      return false;
    }
  }, [refreshData]);

  const markNoticeAsRead = useCallback(async (id: string): Promise<boolean> => {
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/administrative-notices/${id}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        await refreshData();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error marking notice as read', e);
      return false;
    }
  }, [refreshData]);

  useEffect(() => {
    if (user) {
      refreshData();
      // Set up polling for "real-time" effect every 30 seconds
      const interval = setInterval(refreshData, 30000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [user, refreshData]);

  return (
    <DataContext.Provider value={{ 
      employees, 
      transactions, 
      payrollRuns, 
      allowanceTypes, 
      appUsers, 
      attendanceRecords,
      attendanceDevices,
      attendanceShifts,
      absenceTypes,
      absenceRecords,
      missionTypes,
      missions,
      projects,
      projectTasks,
      adminDepartments,
      leaveRequests,
      penalties,
      performanceCycles,
      performanceTemplates,
      performanceCriteria,
      performanceEvaluations,
      performanceDevelopmentPlans,
      administrativeNotices,
      investigations,
      systemSettings,
      adminStats,
      loading, 
      error,
      refreshData,
      recordRemoteAttendance,
      recordAttendance,
      addAdministrativeNotice,
      updateAdministrativeNotice,
      deleteAdministrativeNotice,
      markNoticeAsRead
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
