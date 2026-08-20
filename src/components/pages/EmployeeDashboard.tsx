import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "motion/react";
import {
  Fingerprint,
  Clock,
  MapPin,
  Wifi,
  Calendar,
  FileText,
  History,
  User,
  Bell,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Briefcase,
  ChevronRight,
  TrendingUp,
  Sliders,
  ArrowUpRight,
  Layers,
  Check,
  Maximize2,
  Minimize2,
  Home,
  Users,
  AlertTriangle,
  Star,
  Award,
  Plus,
  CheckSquare,
  RotateCcw,
  Compass,
  ShieldAlert,
  Eye,
  X,
  Scale,
  Target,
  BookOpen,
  Sparkles,
  Printer,
  ChevronDown,
  ChevronUp,
  Info,
  Building2,
  CheckCheck,
  HeartPulse
} from "lucide-react";
import { useAuth } from "../../AuthContext";
import { useData } from "../../contexts/DataContext";
import { cn } from "../../lib/utils";
import { db, doc, updateDoc, addDoc, collection } from "../../api";
import { useLanguage } from "../../contexts/LanguageContext";
import { usePermissions } from "../../hooks/usePermissions";
import { formatTime12h, formatDateTime12h } from "../../utils/timeFormatter";

export const EmployeeDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const {
    employees = [],
    projectTasks = [],
    projects = [],
    leaveRequests = [],
    missions = [],
    missionTypes = [],
    penalties = [],
    adminDepartments = [],
    performanceCycles = [],
    performanceTemplates = [],
    performanceCriteria = [],
    performanceEvaluations = [],
    performanceDevelopmentPlans = [],
    refreshData,
    recordRemoteAttendance,
  } = useData();
  const { language, t } = useLanguage();
  const isRtl = language === "ar";
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Home office/WFH and team request state controls
  const [isWfhModalOpen, setIsWfhModalOpen] = useState(false);
  const [isTeamRequestsModalOpen, setIsTeamRequestsModalOpen] = useState(false);
  const [managerActiveTab, setManagerActiveTab] = useState<
    | "employee_tasks"
    | "wfh"
    | "leaves"
    | "missions"
    | "penalties"
    | "evaluations"
  >("employee_tasks");
  const [completedTasksWeekFilter, setCompletedTasksWeekFilter] =
    useState<string>("current_week");
  const [selectedTeamRequest, setSelectedTeamRequest] = useState<any>(null);
  const [selectedTeamRequestType, setSelectedTeamRequestType] = useState<
    "wfh" | "leave" | "mission" | "penalty"
  >("leave");
  const [wfhRequest, setWfhRequest] = useState({
    date: new Date().toISOString().split("T")[0],
    reason: "",
  });

  // Grievance modal state
  const [grievanceModal, setGrievanceModal] = useState<{
    isOpen: boolean;
    penalty: any | null;
    reason: string;
    submitting: boolean;
  }>({
    isOpen: false,
    penalty: null,
    reason: "",
    submitting: false,
  });

  const handleGrievanceSubmit = async () => {
    if (!grievanceModal.penalty || !grievanceModal.reason.trim()) {
      alert("يرجى كتابة أسباب وتفاصيل التظلم الإداري");
      return;
    }
    if (grievanceModal.penalty.status === "Cancelled" || grievanceModal.penalty.status === "تم إلغاء الجزاء") {
      alert("لا يمكن تقديم تظلم على جزاء تم إلغاؤه رسمياً");
      setGrievanceModal({ isOpen: false, penalty: null, reason: "", submitting: false });
      return;
    }
    setGrievanceModal((prev) => ({ ...prev, submitting: true }));
    try {
      const pen = grievanceModal.penalty;
      const currentUserDisplayName = profile?.name || user?.email || "الموظف";
      
      let res = await fetch(`/api/penalties/${pen.id}/grievance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify({
          reason: grievanceModal.reason.trim(),
          grievanceReason: grievanceModal.reason.trim(),
        }),
      });

      if (!res.ok) {
        res = await fetch(`/api/penalties/${pen.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
          },
          body: JSON.stringify({
            hasGrievance: true,
            grievanceReason: grievanceModal.reason.trim(),
            grievanceDate: new Date().toISOString().split("T")[0],
            grievanceStatus: "Pending",
          }),
        });
      }

      if (!res.ok) {
        throw new Error("Failed to submit grievance");
      }

      setGrievanceModal({
        isOpen: false,
        penalty: null,
        reason: "",
        submitting: false,
      });

      alert("تم إرسال تظلمك الإداري بنجاح، وتم إشعار مسؤولي الموارد البشرية (HR) لمراجعته والبت فيه.");
      if (typeof refreshData === "function") {
        await refreshData();
      }
    } catch (err: any) {
      alert("حدث خطأ أثناء تقديم التظلم: " + err.message);
      setGrievanceModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Performance appraisals states
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [cycles, setCycles] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [developmentPlans, setDevelopmentPlans] = useState<any[]>([]);
  const [viewingEvaluationModal, setViewingEvaluationModal] = useState<any | null>(null);
  const [activeEvalTab, setActiveEvalTab] = useState<"current" | "archive" | "plan">("current");

  // Selected evaluation for direct filling in dashboard
  const [selectedEvalToFill, setSelectedEvalToFill] = useState<any>(null);
  const [evalScoresToFill, setEvalScoresToFill] = useState<
    Record<string, number>
  >({});
  const [evalComments, setEvalComments] = useState({
    strengths: "",
    improvements: "",
    recommendations: "",
  });
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);

  // Selected team evaluation for direct appraisal by manager
  const [selectedTeamEvalToFill, setSelectedTeamEvalToFill] =
    useState<any>(null);
  const [teamScoreRatings, setTeamScoreRatings] = useState<
    Record<string, number>
  >({});
  const [teamComments, setTeamComments] = useState({
    strengths: "",
    improvements: "",
    recommendations: "",
  });
  const [isSubmittingTeamEval, setIsSubmittingTeamEval] = useState(false);

  // Helper formula for Eisenhower quadrant auto calculation
  const getAutomaticEisenhowerQuadrant = (item: {
    dueDate?: string;
    endDate?: string;
    priority?: "Critical" | "High" | "Medium" | "Low" | string;
    status?: string;
  }) => {
    const prio = (item.priority || "Medium").toString().toLowerCase();
    const isImportant =
      prio === "critical" || prio === "high" || prio === "medium";

    const targetDateStr = item.dueDate || item.endDate;
    if (!targetDateStr) {
      if (prio === "critical" || prio === "high") return "do_first";
      if (prio === "medium") return "schedule";
      return "eliminate";
    }

    const todayVal = new Date();
    todayVal.setHours(0, 0, 0, 0);
    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - todayVal.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const isCompleted =
      item.status === "Approved" ||
      item.status === "Executed" ||
      item.status === "Completed";
    const isUrgent = (diffDays <= 2 && !isCompleted) || prio === "critical";

    if (isImportant && isUrgent) return "do_first";
    if (isImportant && !isUrgent) return "schedule";
    if (!isImportant && isUrgent) return "delegate";
    return "eliminate";
  };

  const isApprovedStatus = (status: string) => {
    if (!status) return false;
    const s = String(status).toLowerCase().trim();
    return s === "approved" || s === "approvedbymanager" || s === "approvedbyhr" || s === "معتمد";
  };

  const isCompletedStatus = (status: string) => {
    if (!status) return false;
    const s = String(status).toLowerCase().trim();
    return s === "completed" || s === "executed" || s === "done" || s === "مكتملة";
  };

  const isPendingStatus = (status: string) => {
    if (!status) return false;
    const s = String(status).toLowerCase().trim();
    return (
      s === "pending" ||
      s.startsWith("pending") ||
      s === "draft" ||
      s === "قيد الانتظار" ||
      s === "قيد المراجعة"
    );
  };

  const isRejectedStatus = (status: string) => {
    if (!status) return false;
    const s = String(status).toLowerCase().trim();
    return s === "rejected" || s === "cancelled" || s === "refused" || s === "مرفوض" || s === "مرفوضة";
  };

  // State to hold personal commitments from localstorage
  const [dashboardCommitments, setDashboardCommitments] = useState<any[]>([]);
  const currentEmployeeEmail = user?.email || "default";
  const currentEmployeeId = useMemo(() => {
    return (
      dashboardData?.employee?.id ||
      (profile as any)?.employeeId ||
      (profile as any)?.id ||
      user?.uid ||
      "default"
    );
  }, [dashboardData, profile, user]);

  const currentEmpObject = useMemo(() => {
    const found = employees.find(
      (e) =>
        e.id === currentEmployeeId ||
        e.userId === user?.uid ||
        ((profile as any)?.employeeId &&
          e.employeeId === (profile as any)?.employeeId) ||
        ((profile as any)?.employeeId &&
          e.id === (profile as any)?.employeeId) ||
        (e.email &&
          user?.email &&
          e.email.toLowerCase().trim() === user.email.toLowerCase().trim()),
    );
    if (found) return found;

    if (user || profile) {
      return {
        id: currentEmployeeId,
        employeeId: (profile as any)?.employeeId || currentEmployeeId,
        name:
          (profile as any)?.name ||
          (profile as any)?.displayName ||
          (user as any)?.displayName ||
          user?.email?.split("@")[0] ||
          t("الموظف الحالي (أنا)"),
        email: user?.email || "",
        jobTitle: (profile as any)?.role || (user as any)?.role || t("موظف"),
        department: "",
        userId: user?.uid,
      } as any;
    }
    return null;
  }, [employees, currentEmployeeId, user, profile, t]);

  const isNotSubjectToAttendance = useMemo(() => {
    const emp = currentEmpObject || dashboardData?.employee;
    if (!emp) return false;
    const val = String(
      emp.subjectToAttendance || (emp as any).isSubjectToAttendance || "",
    )
      .trim()
      .toLowerCase();
    return (
      val === "no" ||
      val === "false" ||
      val === "لا" ||
      (emp as any).isSubjectToAttendance === false
    );
  }, [currentEmpObject, dashboardData]);

  const currentManagerIds = useMemo(() => {
    const ids = new Set<string>();
    const addVal = (val?: string | null) => {
      if (!val) return;
      const clean = String(val).trim().toLowerCase();
      if (!clean) return;
      ids.add(clean);
      const noSpace = clean.replace(/\s+/g, "");
      if (noSpace) ids.add(noSpace);
    };

    addVal(currentEmployeeId);
    addVal((profile as any)?.employeeId);
    addVal((profile as any)?.id);
    addVal((profile as any)?.name);
    addVal((profile as any)?.displayName);
    addVal(user?.uid);
    addVal(user?.email);
    addVal(user?.displayName);
    addVal(dashboardData?.employee?.id);
    addVal(dashboardData?.employee?.employeeId);
    addVal(dashboardData?.employee?.name);
    addVal(currentEmpObject?.id);
    addVal(currentEmpObject?.employeeId);
    addVal(currentEmpObject?.userId);
    addVal(currentEmpObject?.email);
    addVal(currentEmpObject?.name);

    // Cross-match with employees array for exact matching records
    const uEmail = user?.email ? String(user.email).trim().toLowerCase() : "";
    const uUid = user?.uid ? String(user.uid).trim().toLowerCase() : "";
    employees.forEach((e) => {
      const eEmail = e.email ? String(e.email).trim().toLowerCase() : "";
      const eUserId = e.userId ? String(e.userId).trim().toLowerCase() : "";
      const eEmpId = e.employeeId
        ? String(e.employeeId).trim().toLowerCase()
        : "";
      const eId = e.id ? String(e.id).trim().toLowerCase() : "";
      if (
        (uEmail && eEmail === uEmail) ||
        (uUid && (eUserId === uUid || eId === uUid))
      ) {
        addVal(e.id);
        addVal(e.employeeId);
        addVal(e.userId);
        addVal(e.email);
        addVal(e.name);
      }
    });

    return Array.from(ids);
  }, [
    currentEmployeeId,
    profile,
    user,
    dashboardData,
    currentEmpObject,
    employees,
  ]);

  const isSubordinateOfCurrentManager = useCallback(
    (emp: any) => {
      if (!emp) return false;

      const empIdStr = String(emp.id || "")
        .trim()
        .toLowerCase();
      const empUserIdStr = String(emp.userId || "")
        .trim()
        .toLowerCase();
      const empEmailStr = String(emp.email || "")
        .trim()
        .toLowerCase();
      const empNameStr = String(emp.name || "")
        .trim()
        .toLowerCase();

      // Do not count manager themselves as subordinate
      if (
        currentManagerIds.includes(empIdStr) ||
        (empUserIdStr && currentManagerIds.includes(empUserIdStr)) ||
        (empEmailStr && currentManagerIds.includes(empEmailStr))
      ) {
        return false;
      }

      const mgrId = emp.managerId
        ? String(emp.managerId).trim().toLowerCase()
        : "";
      const supervisorId = (emp as any).supervisorId
        ? String((emp as any).supervisorId)
            .trim()
            .toLowerCase()
        : "";
      const directMgr = (emp as any).directManager
        ? String((emp as any).directManager)
            .trim()
            .toLowerCase()
        : "";
      const mgrIdNoSpace = mgrId.replace(/\s+/g, "");

      if (
        currentManagerIds.includes(mgrId) ||
        (mgrIdNoSpace && currentManagerIds.includes(mgrIdNoSpace)) ||
        currentManagerIds.includes(supervisorId) ||
        currentManagerIds.includes(directMgr)
      ) {
        return true;
      }

      if (mgrId) {
        const mgrEmp = employees.find(
          (e) =>
            String(e.id).toLowerCase() === mgrId ||
            String(e.employeeId || "").toLowerCase() === mgrId ||
            String(e.userId || "").toLowerCase() === mgrId ||
            String(e.email || "").toLowerCase() === mgrId ||
            String(e.name || "").toLowerCase() === mgrId,
        );
        if (mgrEmp) {
          const mgrEmpIds = [
            mgrEmp.id,
            mgrEmp.userId,
            mgrEmp.employeeId,
            mgrEmp.email,
            mgrEmp.name,
          ]
            .filter(Boolean)
            .map((x) => String(x).trim().toLowerCase());
          if (mgrEmpIds.some((id) => currentManagerIds.includes(id))) {
            return true;
          }
        }
      }

      if (emp.department && adminDepartments && adminDepartments.length > 0) {
        const empDeptStr = String(emp.department).trim().toLowerCase();
        const dept = adminDepartments.find(
          (d) =>
            String(d.id).toLowerCase() === empDeptStr ||
            String(d.name || "").toLowerCase() === empDeptStr,
        );
        if (dept && dept.managerId) {
          const deptMgrId = String(dept.managerId).trim().toLowerCase();
          if (currentManagerIds.includes(deptMgrId)) return true;
          const deptMgrEmp = employees.find(
            (e) =>
              String(e.id).toLowerCase() === deptMgrId ||
              String(e.employeeId || "").toLowerCase() === deptMgrId ||
              String(e.name || "").toLowerCase() === deptMgrId,
          );
          if (deptMgrEmp) {
            const dIds = [
              deptMgrEmp.id,
              deptMgrEmp.userId,
              deptMgrEmp.employeeId,
              deptMgrEmp.email,
              deptMgrEmp.name,
            ]
              .filter(Boolean)
              .map((x) => String(x).trim().toLowerCase());
            if (dIds.some((id) => currentManagerIds.includes(id))) return true;
          }
        }
      }

      return false;
    },
    [currentManagerIds, employees, adminDepartments],
  );

  // Subordinated direct-report employees list under this manager
  const myTeamEmployees = useMemo(() => {
    if (currentManagerIds.length === 0) return [];
    return employees.filter((emp) => isSubordinateOfCurrentManager(emp));
  }, [employees, currentManagerIds, isSubordinateOfCurrentManager]);

  const teamEmployeeIds = useMemo(() => {
    const ids: string[] = [];
    myTeamEmployees.forEach((emp) => {
      if (emp.id) ids.push(String(emp.id));
      if (emp.userId) ids.push(String(emp.userId));
      if (emp.employeeId) ids.push(String(emp.employeeId));
      if (emp.email) ids.push(String(emp.email).trim().toLowerCase());
    });
    return Array.from(new Set(ids));
  }, [myTeamEmployees]);

  const { can } = usePermissions();

  // Permission check for Executive Director / Admin to view Eisenhower Matrix for all employees
  const canViewAllEisenhower = useMemo(() => {
    return (
      can("time_management.eisenhower_all") ||
      can("*") ||
      [
        "Super Admin",
        "Admin",
        "Executive Director",
        "General Manager",
        "CEO",
        "Operations Director",
      ].includes((profile as any)?.role || "") ||
      [
        "Super Admin",
        "Admin",
        "Executive Director",
        "General Manager",
        "CEO",
        "Operations Director",
      ].includes((user as any)?.role || "")
    );
  }, [can, profile, user]);

  // Is this logged-in person a manager/supervisor or executive with access to team matrix?
  const isManager = useMemo(() => {
    const userRole = (profile as any)?.role || (user as any)?.role || "";
    const hasManagerRole = [
      "Manager",
      "Supervisor",
      "HR",
      "Operations",
      "Department Head",
      "Line Manager",
    ].includes(userRole);
    return myTeamEmployees.length > 0 || hasManagerRole || canViewAllEisenhower;
  }, [myTeamEmployees, profile, user, canViewAllEisenhower]);

  const currentEmpIdentifiers = useMemo(() => {
    const emp =
      currentEmpObject || employees.find((e) => e.id === currentEmployeeId);
    return Array.from(
      new Set(
        [
          currentEmployeeId,
          emp?.id,
          emp?.employeeId,
          emp?.userId,
          emp?.email?.trim().toLowerCase(),
          (profile as any)?.employeeId,
          (profile as any)?.id,
          user?.uid,
          user?.email?.trim().toLowerCase(),
        ].filter(Boolean),
      ),
    ).map((id) => String(id).trim().toLowerCase());
  }, [currentEmployeeId, currentEmpObject, employees, profile, user]);

  // Available employees for Eisenhower Matrix view:
  // Executives -> All employees across company
  // Line Manager / Supervisor -> Self + direct team subordinates
  // Fallback for elevated roles -> All employees
  const eisenhowerEmployees = useMemo(() => {
    if (canViewAllEisenhower) {
      if (currentEmpObject) {
        return [
          currentEmpObject,
          ...employees.filter(
            (e) => String(e.id) !== String(currentEmpObject.id),
          ),
        ];
      }
      return employees;
    }
    if (myTeamEmployees.length > 0) {
      if (currentEmpObject) {
        return [
          currentEmpObject,
          ...myTeamEmployees.filter(
            (e) => String(e.id) !== String(currentEmpObject.id),
          ),
        ];
      }
      return myTeamEmployees;
    }
    // Fallback for managers / supervisors if DB lacks explicit managerId links
    const userRole = (profile as any)?.role || (user as any)?.role || "";
    const isManagerRole = [
      "Manager",
      "Supervisor",
      "HR",
      "Operations",
      "Department Head",
      "Line Manager",
    ].includes(userRole);
    if (isManagerRole && employees.length > 0) {
      if (currentEmpObject) {
        return [
          currentEmpObject,
          ...employees.filter(
            (e) => String(e.id) !== String(currentEmpObject.id),
          ),
        ];
      }
      return employees;
    }
    if (currentEmpObject) {
      return [currentEmpObject];
    }
    return employees.length > 0 ? employees : [];
  }, [
    canViewAllEisenhower,
    employees,
    myTeamEmployees,
    currentEmpObject,
    profile,
    user,
  ]);

  const [selectedEisenhowerEmpId, setSelectedEisenhowerEmpId] =
    useState<string>("");

  useEffect(() => {
    if (eisenhowerEmployees.length > 0) {
      if (
        !selectedEisenhowerEmpId ||
        !eisenhowerEmployees.some((e) => e.id === selectedEisenhowerEmpId)
      ) {
        const target =
          currentEmpObject &&
          eisenhowerEmployees.some((e) => e.id === currentEmpObject.id)
            ? currentEmpObject.id
            : eisenhowerEmployees[0].id;
        setSelectedEisenhowerEmpId(target);
      }
    }
  }, [eisenhowerEmployees, currentEmpObject, selectedEisenhowerEmpId]);

  const activeEisenhowerEmp = useMemo(() => {
    return (
      eisenhowerEmployees.find((e) => e.id === selectedEisenhowerEmpId) ||
      employees.find((e) => e.id === selectedEisenhowerEmpId) ||
      eisenhowerEmployees[0] ||
      currentEmpObject ||
      null
    );
  }, [
    eisenhowerEmployees,
    employees,
    selectedEisenhowerEmpId,
    currentEmpObject,
  ]);

  // All tasks, personal commitments, missions, and work meetings for active employee
  const activeEisenhowerEmpAllItems = useMemo(() => {
    if (!activeEisenhowerEmp) return [];
    const empIds = Array.from(
      new Set(
        [
          activeEisenhowerEmp.id,
          activeEisenhowerEmp.userId,
          activeEisenhowerEmp.employeeId,
          activeEisenhowerEmp.email?.trim().toLowerCase(),
          activeEisenhowerEmp.name?.trim().toLowerCase(),
          ...(activeEisenhowerEmp.id === currentEmpObject?.id ||
          activeEisenhowerEmp.userId === user?.uid ||
          (user?.email &&
            activeEisenhowerEmp.email?.toLowerCase().trim() ===
              user.email.toLowerCase().trim())
            ? currentEmpIdentifiers
            : []),
        ].filter(Boolean),
      ),
    ).map((id) => String(id).trim().toLowerCase());

    const items: any[] = [];

    // 1. Project / Job Tasks
    (projectTasks || []).forEach((task) => {
      const assignedTo = task.assignedToId
        ? String(task.assignedToId).trim().toLowerCase()
        : "";
      const assignedToName = task.assignedTo
        ? String(task.assignedTo).trim().toLowerCase()
        : "";
      let assignedToIds: string[] = [];
      if (Array.isArray(task.assignedToIds)) {
        assignedToIds = task.assignedToIds.map((id) =>
          String(id).trim().toLowerCase(),
        );
      } else if (
        typeof task.assignedToIds === "string" &&
        (task.assignedToIds as string).trim().startsWith("[")
      ) {
        try {
          const parsed = JSON.parse(task.assignedToIds as string);
          if (Array.isArray(parsed))
            assignedToIds = parsed.map((id: any) =>
              String(id).trim().toLowerCase(),
            );
        } catch (e) {}
      }
      const creatorIdStr = task.creatorId
        ? String(task.creatorId).trim().toLowerCase()
        : "";

      // Check if task is strictly assigned to or created by this active employee
      const isAssignedToActiveEmp =
        empIds.includes(assignedTo) ||
        empIds.includes(assignedToName) ||
        assignedToIds.some((id) => empIds.includes(id));
      const isCreatedByActiveEmp = empIds.includes(creatorIdStr);

      const belongsToActiveEmp = isAssignedToActiveEmp || isCreatedByActiveEmp;

      if (belongsToActiveEmp) {
        const isDone =
          task.status === "Approved" ||
          task.status === "Executed" ||
          (task.status as string) === "Completed";
        items.push({
          id: `task-${task.id}`,
          rawId: task.id,
          source: "projectTask",
          title: task.title,
          description: task.description || "",
          typeLabel: "وظيفة عمل / مهمة مشاريع",
          typeBadgeColor: "bg-primary/10 text-primary border-primary/20",
          typeIcon: "Briefcase",
          endDate: task.endDate || task.startDate,
          startDate: task.startDate,
          priority: task.priority || "Medium",
          status: task.status,
          creatorId: task.creatorId,
          isCompleted: isDone,
          workflowLog: task.workflowLog,
        });
      }
    });

    // 2. Personal Commitments & Tasks
    if (empIds.some((id) => currentEmpIdentifiers.includes(id))) {
      (dashboardCommitments || []).forEach((commit) => {
        if (commit.id?.startsWith("task-override-")) return;
        const isDone =
          commit.status === "Completed" || commit.status === "Approved";
        items.push({
          id: commit.id,
          rawId: commit.id,
          source: "personalCommitment",
          title: commit.title,
          description: commit.description || "التزام شخصي خاص",
          typeLabel: "مهمة / التزام شخصي",
          typeBadgeColor:
            "bg-purple-500/10 text-purple-600 border-purple-500/20",
          typeIcon: "User",
          endDate: commit.startDate || commit.endDate,
          startDate: commit.startDate,
          priority: commit.priority || "Medium",
          status: isDone ? "Approved" : commit.status || "Pending",
          quadrant: commit.quadrant,
          isCompleted: isDone,
        });
      });
    } else {
      const empEmail = activeEisenhowerEmp.email?.trim().toLowerCase();
      if (empEmail) {
        try {
          const saved = localStorage.getItem(`salarix_commitments_${empEmail}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              parsed.forEach((commit) => {
                if (commit.id?.startsWith("task-override-")) return;
                const isDone =
                  commit.status === "Completed" || commit.status === "Approved";
                items.push({
                  id: commit.id,
                  rawId: commit.id,
                  source: "personalCommitment",
                  title: commit.title,
                  description: commit.description || "التزام شخصي خاص",
                  typeLabel: "مهمة / التزام شخصي",
                  typeBadgeColor:
                    "bg-purple-500/10 text-purple-600 border-purple-500/20",
                  typeIcon: "User",
                  endDate: commit.startDate || commit.endDate,
                  startDate: commit.startDate,
                  priority: commit.priority || "Medium",
                  status: isDone ? "Approved" : commit.status || "Pending",
                  quadrant: commit.quadrant,
                  isCompleted: isDone,
                });
              });
            }
          }
        } catch (e) {}
      }
    }

    return items;
  }, [
    projectTasks,
    activeEisenhowerEmp,
    currentEmpObject,
    user,
    currentEmpIdentifiers,
    dashboardCommitments,
  ]);

  // Active (non-completed) tasks for matrix quadrants
  const activeEisenhowerEmpTasks = useMemo(() => {
    return activeEisenhowerEmpAllItems.filter((item) => !item.isCompleted);
  }, [activeEisenhowerEmpAllItems]);

  // Completed tasks for dedicated bottom section/tab
  const completedEisenhowerEmpTasks = useMemo(() => {
    return activeEisenhowerEmpAllItems.filter((item) => item.isCompleted);
  }, [activeEisenhowerEmpAllItems]);

  // Weekly range bounds calculator for manager team completed tasks filter
  const weeklyRanges = useMemo(() => {
    const getWeekBounds = (weeksAgo: number) => {
      const now = new Date();
      // Start of week: Sunday (day 0)
      const dayOfWeek = now.getDay();
      const start = new Date(now);
      start.setDate(now.getDate() - dayOfWeek - weeksAgo * 7);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const formatDateStr = (d: Date) => {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        return `${day}/${month}`;
      };

      return {
        start,
        end,
        labelRange: `(${formatDateStr(start)} - ${formatDateStr(end)})`,
      };
    };

    return {
      current_week: {
        key: "current_week",
        label: "الأسبوع الحالي",
        ...getWeekBounds(0),
      },
      last_week: {
        key: "last_week",
        label: "الأسبوع الماضي",
        ...getWeekBounds(1),
      },
      "2_weeks_ago": {
        key: "2_weeks_ago",
        label: "قبل أسبوعين",
        ...getWeekBounds(2),
      },
      "3_weeks_ago": {
        key: "3_weeks_ago",
        label: "قبل 3 أسابيع",
        ...getWeekBounds(3),
      },
      "4_weeks_ago": {
        key: "4_weeks_ago",
        label: "قبل 4 أسابيع",
        ...getWeekBounds(4),
      },
      all: {
        key: "all",
        label: "جميع الأسابيع (سجل كامل)",
        start: new Date(0),
        end: new Date(8640000000000000),
        labelRange: "(الكل)",
      },
    };
  }, []);

  // Filter completed tasks by week
  const filteredCompletedEmpTasks = useMemo(() => {
    if (completedTasksWeekFilter === "all") return completedEisenhowerEmpTasks;

    const currentRange = (weeklyRanges as any)[completedTasksWeekFilter];
    if (!currentRange) return completedEisenhowerEmpTasks;

    return completedEisenhowerEmpTasks.filter((task) => {
      const taskDateStr =
        task.endDate || task.startDate || task.createdAt || task.updatedAt;
      if (!taskDateStr) return completedTasksWeekFilter === "current_week";
      const d = new Date(taskDateStr);
      if (isNaN(d.getTime()))
        return completedTasksWeekFilter === "current_week";
      return d >= currentRange.start && d <= currentRange.end;
    });
  }, [completedEisenhowerEmpTasks, completedTasksWeekFilter, weeklyRanges]);

  // Quadrants breakdown for active employee
  const activeEmpEisenhowerMatrix = useMemo(() => {
    const doFirst: any[] = [];
    const schedule: any[] = [];
    const delegate: any[] = [];
    const eliminate: any[] = [];

    activeEisenhowerEmpTasks.forEach((task) => {
      const quad =
        task.quadrant ||
        getAutomaticEisenhowerQuadrant({
          dueDate: task.endDate,
          priority: task.priority,
          status: task.status,
        });
      if (quad === "do_first") doFirst.push(task);
      else if (quad === "schedule") schedule.push(task);
      else if (quad === "delegate") delegate.push(task);
      else eliminate.push(task);
    });

    return { doFirst, schedule, delegate, eliminate };
  }, [activeEisenhowerEmpTasks]);

  // Check if current user is viewing their own matrix or if a manager is viewing an employee's matrix
  const isViewingOwnMatrix = useMemo(() => {
    if (!activeEisenhowerEmp) return true;
    const activeEmpIds = [
      activeEisenhowerEmp.id,
      activeEisenhowerEmp.userId,
      activeEisenhowerEmp.employeeId,
      activeEisenhowerEmp.email?.trim().toLowerCase(),
      activeEisenhowerEmp.name?.trim().toLowerCase(),
    ]
      .filter(Boolean)
      .map((id) => String(id).toLowerCase());

    return activeEmpIds.some((id) => currentEmpIdentifiers.includes(id));
  }, [activeEisenhowerEmp, currentEmpIdentifiers]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const effectiveWorkMode = useMemo(() => {
    const currentEmp =
      dashboardData?.employee ||
      employees.find((e) => e.id === currentEmployeeId);
    // Check if there is an approved WFH request for today
    const hasApprovedWfhToday = (leaveRequests || []).some((lr) => {
      if (lr.type !== "WorkFromHome") return false;
      if (lr.status !== "Approved") return false;
      const lrEmpIds = [
        lr.employeeId,
        (lr as any).userId,
        (lr as any).userEmail,
        (lr as any).email,
      ]
        .filter(Boolean)
        .map((x) => String(x).trim().toLowerCase());
      const isForMe = lrEmpIds.some((id) => currentEmpIdentifiers.includes(id));
      if (!isForMe) return false;
      return lr.startDate <= todayStr && todayStr <= lr.endDate;
    });

    if (hasApprovedWfhToday) return "Work From Home";
    return currentEmp?.workMode || "Office Work";
  }, [
    dashboardData,
    employees,
    currentEmployeeId,
    leaveRequests,
    currentEmpIdentifiers,
    todayStr,
  ]);

  // Subordinated direct-report employees list under the SELECTED active employee
  const activeEmpTeamEmployees = useMemo(() => {
    if (!activeEisenhowerEmp) return [];
    const activeEmpIds = Array.from(
      new Set(
        [
          activeEisenhowerEmp.id,
          activeEisenhowerEmp.employeeId,
          activeEisenhowerEmp.userId,
          activeEisenhowerEmp.email?.trim().toLowerCase(),
          activeEisenhowerEmp.name?.trim().toLowerCase(),
        ].filter(Boolean),
      ),
    ).map((id) => String(id).trim().toLowerCase());

    return employees.filter((emp) => {
      const empIdStr = String(emp.id).trim().toLowerCase();
      const empUserIdStr = emp.userId
        ? String(emp.userId).trim().toLowerCase()
        : "";
      const empEmailStr = emp.email
        ? String(emp.email).trim().toLowerCase()
        : "";
      if (
        activeEmpIds.includes(empIdStr) ||
        (empUserIdStr && activeEmpIds.includes(empUserIdStr)) ||
        (empEmailStr && activeEmpIds.includes(empEmailStr))
      ) {
        return false;
      }

      const mgrId = emp.managerId
        ? String(emp.managerId).trim().toLowerCase()
        : "";
      const supervisorId = (emp as any).supervisorId
        ? String((emp as any).supervisorId)
            .trim()
            .toLowerCase()
        : "";
      const directMgr = (emp as any).directManager
        ? String((emp as any).directManager)
            .trim()
            .toLowerCase()
        : "";

      return (
        activeEmpIds.includes(mgrId) ||
        activeEmpIds.includes(supervisorId) ||
        activeEmpIds.includes(directMgr)
      );
    });
  }, [employees, activeEisenhowerEmp]);

  // Subordinates list to display on the Team Card / Appraisals section:
  // Shows strictly the subordinates managed by the active selected employee (or logged-in user if viewing self)
  const displaySubordinates = useMemo(() => {
    if (!activeEisenhowerEmp || isViewingOwnMatrix) {
      return myTeamEmployees;
    }
    return activeEmpTeamEmployees;
  }, [
    activeEisenhowerEmp,
    isViewingOwnMatrix,
    myTeamEmployees,
    activeEmpTeamEmployees,
  ]);

  // Handler to toggle status of any item in Eisenhower Matrix
  const handleToggleEisenhowerItemStatus = async (
    item: any,
    targetStatus: string,
  ) => {
    try {
      const isDoneAction =
        targetStatus === "Approved" ||
        targetStatus === "Executed" ||
        targetStatus === "Completed";

      // Manager viewing another employee cannot mark active task as complete
      if (isDoneAction && !isViewingOwnMatrix) {
        setMessage({
          type: "error",
          text: "لا يمكن للمدير المباشر إكتمال المهمة نيابة عن الموظف. يمكنك فقط متابعة المهمة، وإعادة فتحها وتوجيهها عندما تكتمل.",
        });
        return;
      }

      if (item.source === "projectTask") {
        const existingLogs = Array.isArray(item.workflowLog)
          ? item.workflowLog
          : [];
        const newLog = {
          fromStatus: item.status || "Pending",
          toStatus: targetStatus,
          userId: user?.uid || (profile as any)?.id || "user",
          userName:
            (profile as any)?.name ||
            user?.displayName ||
            user?.email ||
            "المستخدم",
          timestamp: new Date().toISOString(),
          note:
            !isViewingOwnMatrix &&
            (targetStatus === "In Progress" || targetStatus === "Pending")
              ? "إعادة فتح المهمة وتوجيه الموظف من قبل المدير المباشر"
              : `تحديث الحالة من مصفوفة أيزنهاور إلى ${targetStatus}`,
        };
        await updateDoc(doc(db, "projectTasks", item.rawId), {
          status: targetStatus,
          workflowLog: [...existingLogs, newLog],
          updatedAt: new Date().toISOString(),
        });
        await refreshData();
        setMessage({ type: "success", text: `تم تحديث حالة المهمة بنجاح` });
      } else if (item.source === "personalCommitment") {
        const updated = dashboardCommitments.map((c: any) =>
          c.id === item.id
            ? {
                ...c,
                status:
                  targetStatus === "Approved" || targetStatus === "Completed"
                    ? "Completed"
                    : "Pending",
              }
            : c,
        );
        setDashboardCommitments(updated);
        const key = `salarix_commitments_${currentEmployeeEmail}`;
        localStorage.setItem(key, JSON.stringify(updated));
        setMessage({
          type: "success",
          text: "تم تحديث حالة الالتزام الشخصي بنجاح",
        });
      } else if (item.source === "mission") {
        await updateDoc(doc(db, "missions", item.rawId), {
          status: targetStatus === "Approved" ? "Approved" : "Pending",
          updatedAt: new Date().toISOString(),
        });
        await refreshData();
        setMessage({ type: "success", text: "تم تحديث حالة المأمورية بنجاح" });
      }
    } catch (err: any) {
      console.error("Error toggling Eisenhower item status:", err);
      setMessage({
        type: "error",
        text: "تعذر تحديث حالة العنصر: " + (err.message || ""),
      });
    }
  };

  // Handle priority/quadrant change for Eisenhower matrix items
  const handleDashboardChangeQuadrant = async (
    item: any,
    targetQuadrant: string,
  ) => {
    try {
      let mappedPriority = "High";
      if (targetQuadrant === "do_first") mappedPriority = "Critical";
      else if (targetQuadrant === "schedule") mappedPriority = "High";
      else if (targetQuadrant === "delegate") mappedPriority = "Medium";
      else if (targetQuadrant === "eliminate") mappedPriority = "Low";

      const isManagerAssigned =
        item.source === "projectTask" ||
        item.source === "assigned_manager" ||
        item.source === "mission";
      const cleanId =
        item.rawId ||
        String(item.id || "")
          .replace("task-", "")
          .replace("personal-", "");

      if (isManagerAssigned) {
        if (cleanId) {
          try {
            const taskObj = projectTasks.find(
              (t) => String(t.id) === String(cleanId),
            );
            const updatedTaskData = {
              ...(taskObj || {}),
              priority: mappedPriority,
              updatedAt: new Date().toISOString(),
            };
            await fetch(`/api/project-tasks/${cleanId}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
              },
              body: JSON.stringify(updatedTaskData),
            });
            await refreshData();
          } catch (e) {
            console.warn("Backend update task priority notice:", e);
          }
        }

        const overrideObj = {
          id: `task-override-${cleanId || item.id}`,
          quadrant: targetQuadrant,
          priority: mappedPriority,
        };
        const existing = (dashboardCommitments || []).filter(
          (c: any) => c.id !== overrideObj.id,
        );
        const updated = [...existing, overrideObj];
        setDashboardCommitments(updated);
        if (currentEmployeeEmail) {
          const key = `salarix_commitments_${currentEmployeeEmail}`;
          localStorage.setItem(key, JSON.stringify(updated));
        }
        setMessage({
          type: "success",
          text: "تم تغيير أولوية المهمة ومربع مصفوفة الأولويات بنجاح",
        });
        return;
      }

      if (item.source === "personalCommitment") {
        const updated = (dashboardCommitments || []).map((c: any) =>
          c.id === item.id
            ? { ...c, quadrant: targetQuadrant, priority: mappedPriority }
            : c,
        );
        setDashboardCommitments(updated);
        if (currentEmployeeEmail) {
          const key = `salarix_commitments_${currentEmployeeEmail}`;
          localStorage.setItem(key, JSON.stringify(updated));
        }
        setMessage({
          type: "success",
          text: "تم تغيير أولوية الالتزام الشخصي بنجاح",
        });
      }
    } catch (err: any) {
      console.error("Error changing Eisenhower quadrant:", err);
      setMessage({ type: "error", text: "تعذر تغيير أولوية المهمة" });
    }
  };

  // Modal State for viewing or editing task details & manager guidance
  const [viewingTaskDetail, setViewingTaskDetail] = useState<any>(null);
  const [taskEditForm, setTaskEditForm] = useState({
    title: "",
    description: "",
    priority: "High",
    endDate: "",
    guidanceNote: "",
  });
  const [isSavingTaskEdit, setIsSavingTaskEdit] = useState(false);

  const handleOpenTaskDetailModal = (taskItem: any) => {
    setViewingTaskDetail(taskItem);
    setTaskEditForm({
      title: taskItem.title || "",
      description: taskItem.description || "",
      priority: taskItem.priority || "Medium",
      endDate: taskItem.endDate || "",
      guidanceNote: "",
    });
  };

  const handleSaveTaskDetailsOrReopen = async (reopen: boolean = false) => {
    if (!viewingTaskDetail) return;
    setIsSavingTaskEdit(true);
    try {
      if (viewingTaskDetail.source === "projectTask") {
        const existingLogs = Array.isArray(viewingTaskDetail.workflowLog)
          ? viewingTaskDetail.workflowLog
          : [];
        const newStatus = reopen
          ? "In Progress"
          : viewingTaskDetail.status || "Pending";
        const logNote = reopen
          ? `إعادة فتح المهمة بواسطة المدير وتوجيه الموظف: ${taskEditForm.guidanceNote || "لا يوجد ملاحظات إضافية"}`
          : taskEditForm.guidanceNote
            ? `توجيه وملاحظات إضافية من المدير: ${taskEditForm.guidanceNote}`
            : "تحديث بيانات المهمة من قبل المدير المباشر";

        const updatedLogs = [
          ...existingLogs,
          {
            fromStatus: viewingTaskDetail.status || "Pending",
            toStatus: newStatus,
            userId: user?.uid || "manager",
            userName:
              (profile as any)?.name || user?.displayName || "المدير المباشر",
            timestamp: new Date().toISOString(),
            note: logNote,
          },
        ];

        const updateData: any = {
          title: taskEditForm.title,
          description: taskEditForm.description,
          priority: taskEditForm.priority,
          endDate: taskEditForm.endDate,
          status: newStatus,
          workflowLog: updatedLogs,
          updatedAt: new Date().toISOString(),
        };

        if (taskEditForm.guidanceNote) {
          updateData.managerGuidance = taskEditForm.guidanceNote;
        }

        await updateDoc(
          doc(db, "projectTasks", viewingTaskDetail.rawId),
          updateData,
        );
        await refreshData();
        setMessage({
          type: "success",
          text: reopen
            ? "تم إعادة فتح المهمة وإرسال التوجيهات للموظف بنجاح"
            : "تم حفظ تعديل بيانات المهمة وتوجيه الموظف بنجاح",
        });
        setViewingTaskDetail(null);
      } else if (viewingTaskDetail.source === "personalCommitment") {
        const updated = dashboardCommitments.map((c: any) =>
          c.id === viewingTaskDetail.id
            ? {
                ...c,
                title: taskEditForm.title,
                description: taskEditForm.description,
                priority: taskEditForm.priority,
                endDate: taskEditForm.endDate,
                status: reopen ? "Pending" : c.status,
              }
            : c,
        );
        setDashboardCommitments(updated);
        const key = `salarix_commitments_${currentEmployeeEmail}`;
        localStorage.setItem(key, JSON.stringify(updated));
        setMessage({ type: "success", text: "تم حفظ التعديلات بنجاح" });
        setViewingTaskDetail(null);
      } else {
        setViewingTaskDetail(null);
      }
    } catch (err: any) {
      console.error("Error saving task details:", err);
      setMessage({
        type: "error",
        text: "حدث خطأ أثناء حفظ المهمة: " + (err.message || ""),
      });
    } finally {
      setIsSavingTaskEdit(false);
    }
  };

  // Modal State to assign new task to employee
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);
  const [assignTaskForm, setAssignTaskForm] = useState({
    projectId: "",
    phase: "",
    subPhase: "",
    title: "",
    description: "",
    priority: "High" as "Critical" | "High" | "Medium" | "Low",
    endDate: new Date().toISOString().split("T")[0],
    estimatedHours: 4,
    targetEmployeeId: "",
  });
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  const handleCreateTaskForEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmpId =
      assignTaskForm.targetEmployeeId || activeEisenhowerEmp?.id;
    if (!assignTaskForm.title.trim() || !targetEmpId) return;

    const targetEmpObj = employees.find(
      (emp) =>
        emp.id === targetEmpId ||
        emp.employeeId === targetEmpId ||
        emp.userId === targetEmpId,
    );

    setIsSubmittingTask(true);
    try {
      // Optional project association (undefined if empty or "no_project")
      const selectedProjId =
        assignTaskForm.projectId && assignTaskForm.projectId !== "no_project"
          ? assignTaskForm.projectId
          : undefined;

      const assignedToIds = Array.from(
        new Set(
          [
            targetEmpId,
            targetEmpObj?.id,
            targetEmpObj?.employeeId,
            targetEmpObj?.userId,
            targetEmpObj?.email?.trim().toLowerCase(),
            targetEmpObj?.name?.trim().toLowerCase(),
          ].filter(Boolean),
        ),
      );

      const newTask = {
        ...(selectedProjId ? { 
          projectId: selectedProjId,
          phase: assignTaskForm.phase || null,
          subPhase: assignTaskForm.subPhase || 'General'
        } : {}),
        title: assignTaskForm.title.trim(),
        description: assignTaskForm.description.trim(),
        assignedTo: targetEmpObj?.name || targetEmpId,
        assignedToId: targetEmpObj?.id || targetEmpId,
        assignedToIds: assignedToIds,
        creatorId: currentEmployeeId,
        priority: assignTaskForm.priority,
        startDate: new Date().toISOString().split("T")[0],
        endDate: assignTaskForm.endDate,
        estimatedHours: Number(assignTaskForm.estimatedHours) || 4,
        status: "Pending",
        comments: [],
        workflowLog: [
          {
            fromStatus: "New",
            toStatus: "Pending",
            userId: user?.uid || "manager",
            userName:
              (profile as any)?.name || user?.displayName || "المستند الإداري",
            timestamp: new Date().toISOString(),
            note: "إسناد مباشر عبر كارت مهام الموظفين ومصفوفة أيزنهاور",
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "projectTasks"), newTask);
      await refreshData();
      setIsAssignTaskModalOpen(false);
      setAssignTaskForm({
        projectId: "",
        phase: "",
        subPhase: "",
        title: "",
        description: "",
        priority: "High",
        endDate: new Date().toISOString().split("T")[0],
        estimatedHours: 4,
        targetEmployeeId: "",
      });
      setMessage({
        type: "success",
        text: "تم إسناد المهمة بنجاح وتحديث مصفوفة أيزنهاور للموظف",
      });
    } catch (err: any) {
      console.error("Error creating task for employee:", err);
      setMessage({
        type: "error",
        text: "فشل إسناد المهمة: " + (err.message || ""),
      });
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const handleQuickStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      const existingTask = (projectTasks || []).find((t) => t.id === taskId);

      // Prevent direct manager from marking an employee's task as complete on their behalf
      if (newStatus === "Approved" || newStatus === "Executed") {
        const currentAssigned =
          (existingTask as any)?.assignedTo || existingTask?.assignedToId
            ? String(
                (existingTask as any)?.assignedTo || existingTask?.assignedToId,
              )
                .trim()
                .toLowerCase()
            : "";
        const currentAssignedIds = Array.isArray(existingTask?.assignedToIds)
          ? existingTask.assignedToIds.map((id: any) =>
              String(id).trim().toLowerCase(),
            )
          : [];

        const isSelf =
          currentEmpIdentifiers.includes(currentAssigned) ||
          currentAssignedIds.some((id) => currentEmpIdentifiers.includes(id));

        if (!isSelf && !can("*")) {
          setMessage({
            type: "error",
            text: "لا يمكن للمدير المباشر إتمام المهمة بدلاً عن الموظف. تحديث حالة الإتمام يخص الموظف المكلف بالمهمة فقط.",
          });
          return;
        }
      }

      const existingLogs = Array.isArray(existingTask?.workflowLog)
        ? existingTask.workflowLog
        : [];
      const newLog = {
        fromStatus: existingTask?.status || "Unknown",
        toStatus: newStatus,
        userId: user?.uid || (profile as any)?.id || "user",
        userName:
          (profile as any)?.name ||
          user?.displayName ||
          user?.email ||
          "المستخدم",
        timestamp: new Date().toISOString(),
        note: `تغيير حالة المهمة إلى ${newStatus}`,
      };

      await updateDoc(doc(db, "projectTasks", taskId), {
        status: newStatus,
        workflowLog: [...existingLogs, newLog],
        updatedAt: new Date().toISOString(),
      });
      await refreshData();
      const statusLabels: Record<string, string> = {
        Pending: "قيد الانتظار",
        "In Progress": "قيد التنفيذ",
        "Under Review": "قيد المراجعة",
        Approved: "مكتملة وموافق عليها",
        Executed: "منفذة",
      };
      setMessage({
        type: "success",
        text: `تم تحديث حالة المهمة إلى (${statusLabels[newStatus] || newStatus}) بنجاح`,
      });
    } catch (err: any) {
      console.error("Error updating status:", err);
      setMessage({
        type: "error",
        text: "فشل تحديث حالة المهمة: " + (err.message || ""),
      });
    }
  };

  // Team workflow subsets helper functions
  const isItemForTeam = useCallback(
    (item: any) => {
      if (canViewAllEisenhower) return true;
      if (!item) return false;

      // 1. Direct item identifiers
      const itemIds = [
        item.employeeId,
        item.userId,
        item.email,
        item.userEmail,
        item.empId,
        item.employeeName,
        item.name,
        item.employee?.id,
        item.employee?.userId,
        item.employee?.email,
        item.employee?.name,
      ]
        .filter(Boolean)
        .map((id) => String(id).trim().toLowerCase());

      if (itemIds.some((id) => teamEmployeeIds.includes(id))) {
        return true;
      }

      // 2. Lookup target employee from employees list
      const targetEmp = employees.find((emp) => {
        const eIds = [emp.id, emp.userId, emp.employeeId, emp.email, emp.name]
          .filter(Boolean)
          .map((id) => String(id).trim().toLowerCase());
        return itemIds.some((id) => eIds.includes(id));
      });

      if (targetEmp) {
        if (isSubordinateOfCurrentManager(targetEmp)) {
          return true;
        }
      }

      // 3. Item managerId or approverId directly matches currentManagerIds
      const itemMgrIds = [
        item.managerId,
        item.approverId,
        item.directManager,
        item.managerName,
      ]
        .filter(Boolean)
        .map((id) => String(id).trim().toLowerCase());
      if (itemMgrIds.some((id) => currentManagerIds.includes(id))) {
        return true;
      }

      // 4. Fallback check for any subordinate in myTeamEmployees
      if (myTeamEmployees && myTeamEmployees.length > 0) {
        const isSub = myTeamEmployees.some((emp) => {
          const eIds = [emp.id, emp.userId, emp.employeeId, emp.email, emp.name]
            .filter(Boolean)
            .map((id) => String(id).trim().toLowerCase());
          return itemIds.some((id) => eIds.includes(id));
        });
        if (isSub) return true;
      }

      return false;
    },
    [
      canViewAllEisenhower,
      teamEmployeeIds,
      employees,
      isSubordinateOfCurrentManager,
      currentManagerIds,
      myTeamEmployees,
    ],
  );

  const findEmployeeForRecord = useCallback(
    (rec: any) => {
      if (!rec) return null;
      const recEmpId = String(rec.employeeId || "")
        .trim()
        .toLowerCase();
      const recUserId = String(rec.userId || "")
        .trim()
        .toLowerCase();
      const recEmail = String(rec.email || rec.userEmail || "")
        .trim()
        .toLowerCase();

      return (
        employees.find((e) => {
          const eIds = [e.id, e.userId, e.employeeId, e.email, e.name]
            .filter(Boolean)
            .map((x) => String(x).trim().toLowerCase());
          return (
            (recEmpId && eIds.includes(recEmpId)) ||
            (recUserId && eIds.includes(recUserId)) ||
            (recEmail && eIds.includes(recEmail))
          );
        }) || null
      );
    },
    [employees],
  );

  const teamWfhRequests = useMemo(() => {
    return (leaveRequests || []).filter((lr) => {
      if (lr.type !== "WorkFromHome") return false;
      return isItemForTeam(lr);
    });
  }, [leaveRequests, isItemForTeam]);

  const teamLeaveRequests = useMemo(() => {
    return (leaveRequests || []).filter((lr) => {
      if (lr.type === "WorkFromHome") return false;
      return isItemForTeam(lr);
    });
  }, [leaveRequests, isItemForTeam]);

  const teamMissions = useMemo(() => {
    return (missions || []).filter((m) => isItemForTeam(m));
  }, [missions, isItemForTeam]);

  const teamPenalties = useMemo(() => {
    return (penalties || []).filter((p) => isItemForTeam(p));
  }, [penalties, isItemForTeam]);

  const myApprovedPenalties = useMemo(() => {
    if (!currentEmployeeId || currentEmployeeId === "default") return [];
    return (penalties || []).filter(
      (p) =>
        (p.employeeId === currentEmployeeId ||
         currentEmpIdentifiers.includes(String(p.employeeId || '').toLowerCase().trim())) &&
        p.status !== "Draft" &&
        p.status !== "Cancelled",
    );
  }, [penalties, currentEmployeeId, currentEmpIdentifiers]);

  // Memoized employee evaluations & performance data
  const allMyEvaluations = useMemo(() => {
    const rawList = evaluations.length > 0 ? evaluations : performanceEvaluations;
    const list = (rawList || []).filter((ev: any) => {
      if (!ev) return false;
      const evEmpId = String(ev.employeeId || "").toLowerCase().trim();
      if (currentEmpIdentifiers && currentEmpIdentifiers.length > 0) {
        return currentEmpIdentifiers.some(
          (id) => String(id).toLowerCase().trim() === evEmpId
        );
      }
      return evEmpId === String(currentEmployeeId).toLowerCase().trim();
    });

    return [...list].sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const dateB = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return dateB - dateA;
    });
  }, [evaluations, performanceEvaluations, currentEmpIdentifiers, currentEmployeeId]);

  const allCyclesList = useMemo(() => {
    return (cycles && cycles.length > 0 ? cycles : performanceCycles) || [];
  }, [cycles, performanceCycles]);

  const allTemplatesList = useMemo(() => {
    return (templates && templates.length > 0 ? templates : performanceTemplates) || [];
  }, [templates, performanceTemplates]);

  const allCriteriaList = useMemo(() => {
    return (criteria && criteria.length > 0 ? criteria : performanceCriteria) || [];
  }, [criteria, performanceCriteria]);

  const allDevPlansList = useMemo(() => {
    return (developmentPlans && developmentPlans.length > 0 ? developmentPlans : performanceDevelopmentPlans) || [];
  }, [developmentPlans, performanceDevelopmentPlans]);

  const currentEvaluation = useMemo(() => {
    if (allMyEvaluations.length === 0) return null;
    const activeCycle = allCyclesList.find(
      (c: any) => c.status === "Active" || c.status === "Open" || c.status === "نشطة"
    );
    if (activeCycle) {
      const match = allMyEvaluations.find((ev: any) => ev.cycleId === activeCycle.id);
      if (match) return match;
    }
    return allMyEvaluations[0];
  }, [allMyEvaluations, allCyclesList]);

  const previousEvaluations = useMemo(() => {
    if (!currentEvaluation) return allMyEvaluations;
    return allMyEvaluations.filter((ev: any) => ev.id !== currentEvaluation.id);
  }, [allMyEvaluations, currentEvaluation]);

  const currentDevPlan = useMemo(() => {
    if (!currentEvaluation) return null;
    return allDevPlansList.find(
      (dp: any) => dp.evaluationId === currentEvaluation.id || dp.employeeId === currentEvaluation.employeeId
    );
  }, [allDevPlansList, currentEvaluation]);

  const getEvalGradeInfo = (score?: number, finalGrade?: string) => {
    if (finalGrade) {
      const g = String(finalGrade).toLowerCase();
      if (g.includes("ممتاز") || g.includes("outstanding") || g.includes("excellent")) {
        return { label: isRtl ? "ممتاز (أداء استثنائي)" : "Outstanding", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", ring: "stroke-emerald-500" };
      }
      if (g.includes("جيد جدا") || g.includes("exceeds") || g.includes("very good")) {
        return { label: isRtl ? "جيد جداً (يفوق التوقعات)" : "Very Good", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", ring: "stroke-blue-500" };
      }
      if (g.includes("جيد") || g.includes("meets") || g.includes("good")) {
        return { label: isRtl ? "جيد (يلبي التوقعات)" : "Good", color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", ring: "stroke-cyan-500" };
      }
      if (g.includes("مرضي") || g.includes("satisfactory")) {
        return { label: isRtl ? "مرضي (مستوى مقبول)" : "Satisfactory", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", ring: "stroke-amber-500" };
      }
      if (g.includes("يحتاج") || g.includes("needs") || g.includes("improvement")) {
        return { label: isRtl ? "يحتاج إلى تحسين" : "Needs Improvement", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", ring: "stroke-rose-500" };
      }
    }
    const s = Number(score) || 0;
    if (s >= 90) return { label: isRtl ? "ممتاز (أداء استثنائي)" : "Outstanding", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", ring: "stroke-emerald-500" };
    if (s >= 80) return { label: isRtl ? "جيد جداً (يفوق التوقعات)" : "Very Good", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", ring: "stroke-blue-500" };
    if (s >= 70) return { label: isRtl ? "جيد (يلبي التوقعات)" : "Good", color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/30", ring: "stroke-cyan-500" };
    if (s >= 60) return { label: isRtl ? "مرضي (مستوى مقبول)" : "Satisfactory", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", ring: "stroke-amber-500" };
    return { label: isRtl ? "يحتاج إلى تحسين" : "Needs Improvement", color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", ring: "stroke-rose-500" };
  };

  const getEvalStatusBadge = (status?: string) => {
    switch (status) {
      case "Approved":
        return {
          label: isRtl ? "معتمد ونهائي" : "Approved & Finalized",
          color: "text-emerald-600 dark:text-emerald-400",
          bg: "bg-emerald-500/10",
          border: "border-emerald-500/30",
          icon: CheckCircle2,
        };
      case "PendingApproval":
        return {
          label: isRtl ? "بانتظار قرار واعتماد الرئيس الأعلى" : "Pending Higher Manager Decision",
          color: "text-indigo-600 dark:text-indigo-400",
          bg: "bg-indigo-500/10",
          border: "border-indigo-500/30",
          icon: Scale,
        };
      case "PendingManager":
        return {
          label: isRtl ? "بانتظار تقييم المدير المباشر" : "Pending Manager Rating",
          color: "text-violet-600 dark:text-violet-400",
          bg: "bg-violet-500/10",
          border: "border-violet-500/30",
          icon: Clock,
        };
      case "PendingSelf":
        return {
          label: isRtl ? "بانتظار التقييم الذاتي من الموظف" : "Pending Self Evaluation",
          color: "text-amber-600 dark:text-amber-400",
          bg: "bg-amber-500/10",
          border: "border-amber-500/30",
          icon: AlertCircle,
        };
      case "Returned for Re-evaluation":
        return {
          label: isRtl ? "مُعاد للمراجعة وإعادة التقييم" : "Returned for Re-evaluation",
          color: "text-rose-600 dark:text-rose-400",
          bg: "bg-rose-500/10",
          border: "border-rose-500/30",
          icon: RotateCcw,
        };
      case "Rejected":
        return {
          label: isRtl ? "مرفوض" : "Rejected",
          color: "text-red-600 dark:text-red-400",
          bg: "bg-red-500/10",
          border: "border-red-500/30",
          icon: XCircle,
        };
      default:
        return {
          label: status || (isRtl ? "قيد الإجراء" : "In Progress"),
          color: "text-muted-foreground",
          bg: "bg-muted/30",
          border: "border-border",
          icon: Clock,
        };
    }
  };

  useEffect(() => {
    const key = `salarix_commitments_${currentEmployeeEmail}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        setDashboardCommitments(JSON.parse(saved));
      } catch (e) {}
    }
  }, [currentEmployeeEmail]);

  // Unified events lists for the dashboard
  const dashboardEvents = useMemo(() => {
    const list: any[] = [];
    if (!currentEmployeeId) return [];

    // 1. Project Tasks
    (projectTasks || []).forEach((task) => {
      const assignedTo = task.assignedToId
        ? String(task.assignedToId).trim().toLowerCase()
        : "";
      const assignedToName = task.assignedTo
        ? String(task.assignedTo).trim().toLowerCase()
        : "";
      let assignedToIds: string[] = [];
      if (Array.isArray(task.assignedToIds)) {
        assignedToIds = task.assignedToIds.map((id) =>
          String(id).trim().toLowerCase(),
        );
      } else if (
        typeof task.assignedToIds === "string" &&
        (task.assignedToIds as string).trim().startsWith("[")
      ) {
        try {
          const parsed = JSON.parse(task.assignedToIds as string);
          if (Array.isArray(parsed))
            assignedToIds = parsed.map((id: any) =>
              String(id).trim().toLowerCase(),
            );
        } catch (e) {}
      }
      const isAssigned =
        currentEmpIdentifiers.includes(assignedTo) ||
        currentEmpIdentifiers.includes(assignedToName) ||
        assignedToIds.some((id) => currentEmpIdentifiers.includes(id));
      if (isAssigned) {
        // Check for state / status override stored in local storage
        const localStatusOverride = dashboardCommitments.find(
          (c) => c.id === `task-override-status-${task.id}`,
        )?.status;
        const isCompleted =
          task.status === "Approved" ||
          task.status === "Executed" ||
          localStatusOverride === "Completed";
        const start =
          task.startDate ||
          task.endDate ||
          new Date().toISOString().split("T")[0];

        const todayVal = new Date();
        todayVal.setHours(0, 0, 0, 0);
        let isOverdue = false;
        if (task.endDate) {
          const due = new Date(task.endDate);
          due.setHours(0, 0, 0, 0);
          isOverdue = due.getTime() < todayVal.getTime() && !isCompleted;
        }

        const calculatedQuadrant = getAutomaticEisenhowerQuadrant({
          dueDate: task.endDate,
          priority: (task as any).priority,
          status: isCompleted ? "Completed" : task.status,
        });

        // Check for manual override stored in localstorage commitments
        const override = dashboardCommitments.find(
          (c) => c.id === `task-override-${task.id}`,
        )?.quadrant;

        list.push({
          id: `task-${task.id}`,
          rawId: task.id,
          source: "projectTask",
          title: task.title,
          description: task.description || "",
          type: isCompleted ? "completed" : isOverdue ? "overdue" : "job_task",
          typeLabel: "وظيفة عمل / مهمة مشاريع",
          typeBadgeColor: "bg-primary/10 text-primary border-primary/20",
          startDate: start,
          endDate: task.endDate || task.startDate,
          priority: (task as any).priority || "Medium",
          status: isCompleted ? "Completed" : "Pending",
          plannedHours: task.estimatedHours || 4,
          actualHours:
            task.status === "Approved" || isCompleted ? task.estimatedHours : 0,
          quadrant: override || calculatedQuadrant,
          isCompleted: isCompleted,
          workflowLog: task.workflowLog,
        });
      }
    });

    // 2. Personal manual commitments
    (dashboardCommitments || []).forEach((commit) => {
      if (commit.id.startsWith("task-override-")) return;
      const isDone = commit.status === "Completed";

      const todayVal = new Date();
      todayVal.setHours(0, 0, 0, 0);
      const due = new Date(commit.startDate);
      due.setHours(0, 0, 0, 0);
      const isOverdue = due.getTime() < todayVal.getTime() && !isDone;

      const calculatedQuadrant = getAutomaticEisenhowerQuadrant({
        dueDate: commit.startDate,
        priority: commit.priority,
        status: commit.status,
      });

      list.push({
        id: commit.id,
        rawId: commit.id,
        source: "personalCommitment",
        title: commit.title,
        description: commit.description || "التزام شخصي خاص",
        type: isDone ? "completed" : isOverdue ? "overdue" : commit.type,
        typeLabel: "تخطيط شخصي",
        typeBadgeColor: "bg-purple-500/10 text-purple-600 border-purple-500/20",
        startDate: commit.startDate,
        endDate: commit.endDate || commit.startDate,
        priority: commit.priority || "Medium",
        status: commit.status,
        plannedHours: commit.plannedHours || 0,
        actualHours: isDone ? commit.plannedHours : 0,
        quadrant: commit.quadrant || calculatedQuadrant,
        isCompleted: isDone,
      });
    });

    return list;
  }, [
    projectTasks,
    leaveRequests,
    missions,
    dashboardCommitments,
    currentEmployeeId,
  ]);

  // Compute daily stats for today
  const dashboardDailyStats = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayEvents = dashboardEvents.filter((e) => e.startDate === todayStr);

    const totalTodayNum = todayEvents.length;
    const completedTodayNum = todayEvents.filter(
      (e) => e.status === "Completed",
    ).length;
    const overdueTodayNum = todayEvents.filter(
      (e) => e.type === "overdue",
    ).length;

    let plannedTodayHours = 0;
    let actualTodayHours = 0;

    todayEvents.forEach((e) => {
      plannedTodayHours += e.plannedHours || 0;
      actualTodayHours += e.actualHours || 0;
    });

    const completionRate =
      totalTodayNum > 0
        ? Math.round((completedTodayNum / totalTodayNum) * 100)
        : 0;

    return {
      totalTodayNum,
      completedTodayNum,
      overdueTodayNum,
      plannedTodayHours: plannedTodayHours || 8,
      actualTodayHours,
      completionRate,
    };
  }, [dashboardEvents]);

  // Function to navigate to time management planner
  const goToTimeManagement = () => {
    window.dispatchEvent(
      new CustomEvent("navigate_to_entity", {
        detail: { module: "self_service", tab: "time_management" },
      }),
    );
  };

  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return new Date().toISOString().slice(0, 7);
  });
  const [isMyDetailsModalOpen, setIsMyDetailsModalOpen] = useState(false);
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceMonthLogs, setAttendanceMonthLogs] = useState<any[]>([]);
  const [loadingMonthLogs, setLoadingMonthLogs] = useState(false);
  const [employeeMissions, setEmployeeMissions] = useState<any[]>([]);

  const fetchPerformanceAppraisals = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const [evRes, cyRes, tmRes, crRes, dpRes] = await Promise.all([
        fetch("/api/performance-evaluations", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/performance-cycles", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/performance-templates", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/performance-criteria", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/performance-development-plans", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (evRes.ok) setEvaluations(await evRes.json());
      if (cyRes.ok) setCycles(await cyRes.json());
      if (tmRes.ok) setTemplates(await tmRes.json());
      if (crRes.ok) setCriteria(await crRes.json());
      if (dpRes && dpRes.ok) setDevelopmentPlans(await dpRes.json());
    } catch (err) {
      console.error("Error fetching appraisal entities on dashboard:", err);
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/employee/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDashboardData(data);

      const missionsRes = await fetch("/api/missions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (missionsRes.ok) {
        const mData = await missionsRes.json();
        setEmployeeMissions(mData || []);
      }
      await fetchPerformanceAppraisals();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleSubmitSelfEvaluation = async () => {
    if (!selectedEvalToFill) return;
    setIsSubmittingEval(true);
    try {
      const token = localStorage.getItem("auth_token");
      let totalRatingSum = 0;
      let ratedCount = 0;
      const scoresPayload: Record<string, number> = {};

      (criteria || []).forEach((c) => {
        const rating = evalScoresToFill[c.id] || 3;
        scoresPayload[c.id] = rating;
        totalRatingSum += rating;
        ratedCount++;
      });

      const averageRating = ratedCount > 0 ? totalRatingSum / ratedCount : 3;
      const percentageScore = Math.round((averageRating / 5) * 100);

      const payload = {
        selfScores: scoresPayload,
        selfStrengths: evalComments.strengths,
        selfImprovements: evalComments.improvements,
        selfRecommendations: evalComments.recommendations,
        selfPercentageScore: percentageScore,
        status: "PendingManager",
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch(
        `/api/performance-evaluations/${selectedEvalToFill.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        setMessage({
          type: "success",
          text: isRtl
            ? "تم تقديم التقييم الذاتي بنجاح وبانتظار اعتماد المدير المباشر."
            : "Self-evaluation submitted successfully and is pending manager review.",
        });
        setSelectedEvalToFill(null);
        await fetchPerformanceAppraisals();
      } else {
        setMessage({
          type: "error",
          text: isRtl
            ? "فشل إرسال التقييم الذاتي، يرجى المحاولة لاحقاً."
            : "Failed to submit self-evaluation.",
        });
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: String(e) });
    } finally {
      setIsSubmittingEval(false);
    }
  };

  const handleSubmitTeamEvaluation = async () => {
    if (!selectedTeamEvalToFill) return;
    setIsSubmittingTeamEval(true);
    try {
      const token = localStorage.getItem("auth_token");
      let totalRatingSum = 0;
      let ratedCount = 0;
      const scoresPayload: Record<string, number> = {};

      (criteria || []).forEach((c) => {
        const rating = teamScoreRatings[c.id] || 3;
        scoresPayload[c.id] = rating;
        totalRatingSum += rating;
        ratedCount++;
      });

      const averageRating = ratedCount > 0 ? totalRatingSum / ratedCount : 3;
      const percentageScore = Math.round((averageRating / 5) * 100);

      const payload = {
        managerScores: scoresPayload,
        managerStrengths: teamComments.strengths,
        managerImprovements: teamComments.improvements,
        managerRecommendations: teamComments.recommendations,
        finalPercentageScore: percentageScore,
        status: "Approved",
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch(
        `/api/performance-evaluations/${selectedTeamEvalToFill.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        setMessage({
          type: "success",
          text: isRtl
            ? "تم اعتماد وتقييم الموظف وإرساله للمدير الأعلى بنجاح!"
            : "Employee appraisal submitted and approved successfully.",
        });
        setSelectedTeamEvalToFill(null);
        await fetchPerformanceAppraisals();
      } else {
        setMessage({
          type: "error",
          text: isRtl
            ? "فشل اعتماد التقييم، يرجى المحاولة لاحقاً."
            : "Failed to approve employee appraisal.",
        });
      }
    } catch (e) {
      console.error(e);
      setMessage({ type: "error", text: String(e) });
    } finally {
      setIsSubmittingTeamEval(false);
    }
  };

  const fetchAttendanceMonthLogs = async () => {
    setLoadingMonthLogs(true);
    try {
      const token = localStorage.getItem("auth_token");
      const [logsRes, recsRes] = await Promise.all([
        fetch(`/api/attendance-logs`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/attendance-records`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      
      const logsData = logsRes.ok ? await logsRes.json() : [];
      const recsData = recsRes.ok ? await recsRes.json() : [];

      // Combine logs and records
      const combined: any[] = [];
      if (Array.isArray(logsData)) combined.push(...logsData);
      if (Array.isArray(recsData)) {
        recsData.forEach(r => {
          const d = r.timestamp ? r.timestamp.split('T')[0] : '';
          const t = r.timestamp ? (r.timestamp.includes('T') ? r.timestamp.split('T')[1].substring(0, 8) : r.timestamp) : '';
          combined.push({
            id: r.id,
            attendanceDate: d,
            actionTime: t,
            actionType: r.type === 'In' || r.type === 'in' ? 'CheckIn' : 'CheckOut',
            status: 'Success',
            deviceName: r.deviceName || (r.manual ? 'إضافة يدوية (HR)' : 'جهاز بصمة'),
            notes: r.note || '',
            timestamp: r.timestamp
          });
        });
      }
      setAttendanceMonthLogs(combined);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMonthLogs(false);
    }
  };

  const handleOpenAttendanceSummaryModal = () => {
    if (isNotSubjectToAttendance) {
      setMessage({
        type: "error",
        text: "أنت غير خاضع لنظام الحضور والانصراف",
      });
      return;
    }
    fetchAttendanceMonthLogs();
    setIsAttendanceModalOpen(true);
  };

  const handleAttendance = async (type: "check-in" | "check-out") => {
    if (isNotSubjectToAttendance) {
      setMessage({
        type: "error",
        text: "أنت غير خاضع لنظام الحضور والانصراف",
      });
      return;
    }
    setAttendanceLoading(true);
    setMessage(null);
    try {
      const isRemote =
        effectiveWorkMode === "Remotely Work" ||
        effectiveWorkMode === "Work From Home";
      const currentIso = new Date().toISOString();
      const result = await recordRemoteAttendance(type, {
        workMode: effectiveWorkMode,
        isRemote,
        timestamp: currentIso,
      });

      if (result.success) {
        setMessage({
          type: "success",
          text:
            type === "check-in"
              ? `تم تسجيل الحضور/بدء العمل بنجاح (${result.time || ""})`
              : `تم تسجيل الانصراف/إنهاء العمل بنجاح (${result.time || ""})`,
        });
        loadDashboard();
      } else {
        setMessage({
          type: "error",
          text: result.error || t("فشل تنفيذ العملية"),
        });
      }
    } catch (e) {
      console.error("Attendance transaction call failed:", e);
      setMessage({ type: "error", text: t("حدث خطأ في الاتصال بالسيرفر") });
    } finally {
      setAttendanceLoading(false);
    }
  };

  const [detailsPopupType, setDetailsPopupType] = useState<
    | "pendingLeaves"
    | "approvedLeaves"
    | "rejectedLeaves"
    | "allLeaves"
    | "pendingMissions"
    | "approvedMissions"
    | "rejectedMissions"
    | "allMissions"
    | "pendingWfh"
    | "approvedWfh"
    | "rejectedWfh"
    | "allWfh"
    | null
  >(null);
  const [popupStatusFilter, setPopupStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [selectedMissionForEval, setSelectedMissionForEval] = useState<
    any | null
  >(null);

  const handleDashboardMarkComplete = async (
    eventId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (eventId.startsWith("manual-")) {
      const updated = dashboardCommitments.map((c: any) =>
        c.id === eventId ? { ...c, status: "Completed" } : c,
      );
      setDashboardCommitments(updated);
      const key = `salarix_commitments_${currentEmployeeEmail}`;
      localStorage.setItem(key, JSON.stringify(updated));
    } else if (eventId.startsWith("task-")) {
      const taskId = eventId.replace("task-", "");
      try {
        const existingTask = (projectTasks || []).find((t) => t.id === taskId);
        const existingLogs = Array.isArray(existingTask?.workflowLog)
          ? existingTask.workflowLog
          : [];
        const newLog = {
          fromStatus: existingTask?.status || "Unknown",
          toStatus: "Approved",
          userId: user?.uid || (profile as any)?.id || "user",
          userName:
            (profile as any)?.name ||
            user?.displayName ||
            user?.email ||
            "المستخدم",
          timestamp: new Date().toISOString(),
          note: "إتمام المهمة من لوحة التحكم",
        };

        await updateDoc(doc(db, "projectTasks", taskId), {
          status: "Approved",
          workflowLog: [...existingLogs, newLog],
          updatedAt: new Date().toISOString(),
        });
        if (typeof refreshData === "function") {
          await refreshData();
        }
        setMessage({
          type: "success",
          text: "تم تحديث حالة المهمة إلى مكتملة بنجاح",
        });
      } catch (err: any) {
        console.error("Error marking task complete from dashboard:", err);
        setMessage({
          type: "error",
          text: "تعذر تحديث المهمة: " + (err.message || ""),
        });
      }
      // Save status override in localstorage commitments
      const overrideItem = {
        id: `task-override-status-${taskId}`,
        title: "",
        type: "completed",
        startDate: "",
        priority: "Medium",
        status: "Completed",
        quadrant: undefined,
      };
      const filtered = dashboardCommitments.filter(
        (c: any) => c.id !== `task-override-status-${taskId}`,
      );
      const updated = [...filtered, overrideItem];
      setDashboardCommitments(updated);
      const key = `salarix_commitments_${currentEmployeeEmail}`;
      localStorage.setItem(key, JSON.stringify(updated));
    }
  };

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isMissionModalOpen, setIsMissionModalOpen] = useState(false);
  const [isEisenhowerExpanded, setIsEisenhowerExpanded] = useState(false);
  const [requestItem, setRequestItem] = useState({
    type: "Annual",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    reason: "",
    projectId: "",
    missionTypeId: "",
  });

  // Personal annual vacation balance calculator
  const dashboardEmployeeInfo = useMemo(() => {
    const employee =
      dashboardData?.employee ||
      employees.find((e) => e.id === currentEmployeeId);
    if (!employee) return null;

    const entitled = Number(employee.leavePlan || 21);
    const currentYear = new Date().getFullYear();
    const effectiveLeaveRequests =
      leaveRequests && leaveRequests.length > 0
        ? leaveRequests
        : dashboardData?.leaveRequests || [];

    const approvedList = effectiveLeaveRequests.filter(
      (lr) =>
        lr.employeeId === employee.id &&
        lr.status === "Approved" &&
        (lr.type === "Vacation" ||
          lr.type === "Annual" ||
          lr.type === t("إجازة اعتيادية") ||
          lr.type === t("اعتيادي")) &&
        lr.startDate &&
        lr.startDate.startsWith(String(currentYear)),
    );

    const consumed = approvedList.reduce((sum, lr) => {
      const s = new Date(lr.startDate);
      const e = new Date(lr.endDate);
      const diffTime = e.getTime() - s.getTime();
      const days =
        diffTime < 0 ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return sum + days;
    }, 0);

    const requested = (() => {
      if (!requestItem.startDate || !requestItem.endDate) return 0;
      const s = new Date(requestItem.startDate);
      const e = new Date(requestItem.endDate);
      const diffTime = e.getTime() - s.getTime();
      return diffTime < 0 ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    })();

    const remaining = entitled - (consumed + requested);

    return {
      entitled,
      requested,
      consumed,
      remaining,
    };
  }, [
    dashboardData,
    employees,
    leaveRequests,
    requestItem.startDate,
    requestItem.endDate,
    currentEmployeeId,
    t,
  ]);

  // Personal annual sick leave balance calculator
  const dashboardEmployeeSickInfo = useMemo(() => {
    const employee =
      dashboardData?.employee ||
      employees.find((e) => e.id === currentEmployeeId);
    if (!employee) return null;

    const entitled = Number(employee.sickLeavePlan || 30);
    const currentYear = new Date().getFullYear();
    const effectiveLeaveRequests =
      leaveRequests && leaveRequests.length > 0
        ? leaveRequests
        : dashboardData?.leaveRequests || [];

    const approvedList = effectiveLeaveRequests.filter(
      (lr) =>
        lr.employeeId === employee.id &&
        lr.status === "Approved" &&
        (lr.type === "Sick" ||
          lr.type === "مرضية" ||
          lr.type === "إجازة مرضية" ||
          lr.type === t("إجازة مرضية") ||
          lr.type === t("مرضية")) &&
        lr.startDate &&
        lr.startDate.startsWith(String(currentYear)),
    );

    const consumed = approvedList.reduce((sum, lr) => {
      const s = new Date(lr.startDate);
      const e = new Date(lr.endDate);
      const diffTime = e.getTime() - s.getTime();
      const days =
        diffTime < 0 ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return sum + days;
    }, 0);

    const requested = (() => {
      if (!requestItem.startDate || !requestItem.endDate) return 0;
      const s = new Date(requestItem.startDate);
      const e = new Date(requestItem.endDate);
      const diffTime = e.getTime() - s.getTime();
      return diffTime < 0 ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    })();

    const remaining = entitled - (consumed + requested);

    return {
      entitled,
      requested,
      consumed,
      remaining,
    };
  }, [
    dashboardData,
    employees,
    leaveRequests,
    requestItem.startDate,
    requestItem.endDate,
    currentEmployeeId,
    t,
  ]);

  const handleCreateRequest = async (
    entity: "leave-requests" | "mission-requests",
  ) => {
    try {
      // Find the effective employee ID. Correctly prioritize the actual employees table UUID
      const effectiveEmployeeId =
        dashboardData?.employee?.id ||
        (profile as any)?.employeeId ||
        (profile as any)?.id ||
        user?.uid;

      if (!effectiveEmployeeId) {
        setMessage({
          type: "error",
          text: t("لا يمكن تحديد هوية الموظف. يرجى التواصل مع الإدارة."),
        });
        return;
      }

      // Check balance for Annual Leave before sending
      if (entity === "leave-requests" && requestItem.type === "Annual") {
        if (dashboardEmployeeInfo && dashboardEmployeeInfo.remaining < 0) {
          setMessage({
            type: "error",
            text: `رصيدك من الإجازات الاعتيادية لا يكفي! المتبقي المتاح لديك هو ${dashboardEmployeeInfo.entitled - dashboardEmployeeInfo.consumed} يوم فقط بينما تطلب ${dashboardEmployeeInfo.requested} يوم.`,
          });
          return;
        }
      }

      // Check balance for Sick Leave before sending
      if (entity === "leave-requests" && requestItem.type === "Sick") {
        if (dashboardEmployeeSickInfo && dashboardEmployeeSickInfo.remaining < 0) {
          setMessage({
            type: "error",
            text: `رصيدك من الإجازات المرضية لا يكفي! المتبقي المتاح لديك هو ${dashboardEmployeeSickInfo.entitled - dashboardEmployeeSickInfo.consumed} يوم فقط بينما تطلب ${dashboardEmployeeSickInfo.requested} يوم.`,
          });
          return;
        }
      }

      const payload =
        entity === "leave-requests"
          ? {
              employeeId: effectiveEmployeeId,
              startDate: requestItem.startDate,
              endDate: requestItem.endDate,
              type: requestItem.type,
              reason: requestItem.reason,
              status: "Pending",
            }
          : {
              employeeId: effectiveEmployeeId,
              projectId:
                requestItem.projectId && requestItem.projectId.trim() !== ""
                  ? requestItem.projectId
                  : null,
              missionTypeId:
                requestItem.missionTypeId &&
                requestItem.missionTypeId.trim() !== ""
                  ? requestItem.missionTypeId
                  : null,
              startDate: requestItem.startDate,
              endDate: requestItem.endDate,
              notes: requestItem.reason || "",
              status: "Pending",
            };

      const apiEntity = entity === "mission-requests" ? "missions" : entity;

      const res = await fetch(`/api/${apiEntity}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessage({ type: "success", text: t("تم تقديم الطلب بنجاح") });
        setIsLeaveModalOpen(false);
        setIsMissionModalOpen(false);
        loadDashboard();
      } else {
        const d = await res.json();
        setMessage({ type: "error", text: d.error || t("فشل تقديم الطلب") });
      }
    } catch (e) {
      setMessage({ type: "error", text: t("خطأ في الاتصال") });
    }
  };

  const summary = useMemo(() => {
    const s = { ...(dashboardData?.summary || {}) };

    // Real-time calculation from context for immediate responsiveness
    const isMatchingMyEmp = (item: any) => {
      const eId = String(item.employeeId || '').trim().toLowerCase();
      const uId = String(item.userId || '').trim().toLowerCase();
      const mail = String(item.email || item.userEmail || '').trim().toLowerCase();
      return (
        currentEmpIdentifiers.includes(eId) ||
        (uId && currentEmpIdentifiers.includes(uId)) ||
        (mail && currentEmpIdentifiers.includes(mail)) ||
        eId === String(currentEmployeeId).trim().toLowerCase()
      );
    };

    const myLeaves = (leaveRequests || []).filter(isMatchingMyEmp);
    const myMissionsList = (missions || []).filter(isMatchingMyEmp);

    if (myLeaves.length > 0) {
      s.pendingLeaves = myLeaves.filter(l => isPendingStatus(l.status) && l.type !== 'WorkFromHome').length;
      s.approvedLeaves = myLeaves.filter(l => isApprovedStatus(l.status) && l.type !== 'WorkFromHome').length;
      s.rejectedLeaves = myLeaves.filter(l => isRejectedStatus(l.status) && l.type !== 'WorkFromHome').length;

      s.pendingWfh = myLeaves.filter(l => isPendingStatus(l.status) && l.type === 'WorkFromHome').length;
      s.approvedWfh = myLeaves.filter(l => isApprovedStatus(l.status) && l.type === 'WorkFromHome').length;
      s.rejectedWfh = myLeaves.filter(l => isRejectedStatus(l.status) && l.type === 'WorkFromHome').length;
    }

    if (myMissionsList.length > 0) {
      s.pendingMissions = myMissionsList.filter(m => isPendingStatus(m.status)).length;
      s.approvedMissions = myMissionsList.filter(m => isApprovedStatus(m.status) || isCompletedStatus(m.status)).length;
      s.rejectedMissions = myMissionsList.filter(m => isRejectedStatus(m.status)).length;
    }

    return s;
  }, [dashboardData, leaveRequests, missions, currentEmpIdentifiers, currentEmployeeId]);

  if (loading && !dashboardData)
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );

  const attendance = dashboardData?.attendance || { checkIn: null, checkOut: null };
  const notifications = dashboardData?.notifications || [];
  const linkedEmployee = dashboardData?.employee || null;
  const activeTasksCount = dashboardData?.activeTasksCount || 0;

  const status = !attendance?.checkIn
    ? "Not Checked In"
    : !attendance?.checkOut
      ? "Checked In"
      : "Checked Out";

  const requestCards = summary
    ? [
        {
          id: "pendingLeaves",
          label: t("إجازات معلقة"),
          value: summary.pendingLeaves || 0,
          bg: "bg-orange-500/10 hover:bg-orange-500/20",
          border: "border-orange-500/40 hover:border-orange-500",
          color: "text-orange-600",
          desc: t("اضغط لعرض تفاصيل الإجازات المرفوعة بانتظار الاعتماد"),
        },
        {
          id: "approvedLeaves",
          label: t("إجازات معتمدة"),
          value: summary.approvedLeaves || 0,
          bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
          border: "border-emerald-500/40 hover:border-emerald-500",
          color: "text-emerald-600",
          desc: t("اضغط لعرض تفاصيل إجازاتك المعتمدة رسمياً"),
        },
        {
          id: "rejectedLeaves",
          label: t("إجازات مرفوضة"),
          value: summary.rejectedLeaves || 0,
          bg: "bg-rose-500/10 hover:bg-rose-500/20",
          border: "border-rose-500/40 hover:border-rose-500",
          color: "text-rose-600",
          desc: t("اضغط لعرض تفاصيل الإجازات المرفوضة من الإدارة وأسباب الرفض"),
        },
        {
          id: "pendingMissions",
          label: t("مأموريات معلقة"),
          value: summary.pendingMissions || 0,
          bg: "bg-indigo-500/10 hover:bg-indigo-500/20",
          border: "border-indigo-500/40 hover:border-indigo-500",
          color: "text-indigo-600",
          desc: t("اضغط لعرض تفاصيل مأموريات العمل المرفوعة بانتظار الاعتماد"),
        },
        {
          id: "approvedMissions",
          label: t("مأموريات معتمدة"),
          value: summary.approvedMissions || 0,
          bg: "bg-primary/10 hover:bg-primary/20",
          border: "border-primary/40 hover:border-primary",
          color: "text-primary",
          desc: t("اضغط لعرض تفاصيل مأموريات العمل والزيارات المعتمدة"),
        },
        {
          id: "pendingWfh",
          label: t("عمل عن بعد (معلق)"),
          value: summary.pendingWfh || 0,
          bg: "bg-pink-500/10 hover:bg-pink-500/20",
          border: "border-pink-500/40 hover:border-pink-500",
          color: "text-pink-600",
          desc: t("اضغط لعرض تفاصيل تصاريح العمل من المنزل المعلقة"),
        },
      ]
    : [];

  const goToMyTasks = () => {
    window.dispatchEvent(
      new CustomEvent("navigate_to_entity", {
        detail: { module: "operations", tab: "my-tasks" },
      }),
    );
  };

  const handleCreateWfhRequest = async () => {
    try {
      const effectiveEmployeeId =
        dashboardData?.employee?.id ||
        (profile as any)?.employeeId ||
        (profile as any)?.id ||
        user?.uid;

      if (!effectiveEmployeeId) {
        setMessage({
          type: "error",
          text: t("لا يمكن تحديد هوية الموظف. يرجى التواصل مع الإدارة."),
        });
        return;
      }

      // Check if date is valid
      if (!wfhRequest.date) {
        setMessage({
          type: "error",
          text: t("يرجى تحديد تاريخ إذن العمل من المنزل!"),
        });
        return;
      }

      const payload = {
        employeeId: effectiveEmployeeId,
        startDate: wfhRequest.date,
        endDate: wfhRequest.date,
        type: "WorkFromHome",
        reason:
          wfhRequest.reason || t("إذن عمل من المنزل مستقل عبر الخدمة الذاتية"),
        status: "Pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch(`/api/leave-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setMessage({
          type: "success",
          text: t("تم تقديم طلب إذن العمل من المنزل بنجاح"),
        });
        setIsWfhModalOpen(false);
        setWfhRequest({
          date: new Date().toISOString().split("T")[0],
          reason: "",
        });
        loadDashboard();
        await refreshData();
      } else {
        const d = await res.json();
        setMessage({
          type: "error",
          text: d.error || t("فشل تقديم طلب العمل من المنزل"),
        });
      }
    } catch (e) {
      setMessage({ type: "error", text: t("خطأ في الاتصال بقاعدة البيانات") });
    }
  };

  const handleManagerDecisionLeave = async (
    id: string,
    newStatus: "Approved" | "Rejected",
    reviewNote?: string,
  ) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/leave-requests/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          reviewNote: reviewNote || "",
        }),
      });
      if (!res.ok) {
        await updateDoc(doc(db, "leaveRequests", id), {
          status: newStatus,
          reviewNote: reviewNote || "",
          updatedAt: new Date().toISOString(),
        });
      }
      setMessage({
        type: "success",
        text: `تم ${newStatus === "Approved" ? t("اعتماد") : t("رفض")} طلب الإجازة/العمل بنجاح`,
      });
      setSelectedTeamRequest(null);
      loadDashboard();
      await refreshData();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: t("فشل تحديث حالة الطلب:") + err.message,
      });
    }
  };

  const handleManagerDecisionMission = async (
    id: string,
    newStatus: "Approved" | "Rejected",
    reviewNote?: string,
  ) => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/missions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          notes: reviewNote || "",
        }),
      });
      if (!res.ok) {
        await updateDoc(doc(db, "missions", id), {
          status: newStatus,
          reviewNote: reviewNote || "",
          updatedAt: new Date().toISOString(),
        });
      }
      setMessage({
        type: "success",
        text: `تم ${newStatus === "Approved" ? t("اعتماد") : t("رفض")} المأمورية بنجاح`,
      });
      setSelectedTeamRequest(null);
      loadDashboard();
      await refreshData();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: t("فشل تحديث حالة المأمورية:") + err.message,
      });
    }
  };

  const handleManagerDecisionPenalty = async (
    id: string,
    action: "Approved" | "Objected" | "Rejected",
    reviewNote?: string,
  ) => {
    try {
      const pen = (penalties || []).find((p: any) => String(p.id) === String(id));
      if (!pen) return;

      const emp = employees.find((e) => e.id === pen.employeeId || e.employeeId === pen.employeeId);
      const directMgr = emp?.managerId ? employees.find((e) => e.id === emp.managerId) : null;
      const higherMgr = directMgr?.managerId ? employees.find((e) => e.id === directMgr.managerId) : null;

      let nextStatus = pen.status || "Pending Direct Manager";
      let actionName = "";
      const extraFields: any = {};
      const currentStatus = pen.status || "Pending Direct Manager";

      // 1. Direct Manager Stage
      if (["Pending Direct Manager", "Pending Approval", "Draft", "Pending"].includes(currentStatus)) {
        if (action === "Approved") {
          nextStatus = higherMgr ? "Pending Higher Manager" : "Pending HR";
          actionName = higherMgr
            ? "موافقة المدير المباشر (إحالة للرئيس الأعلى)"
            : "موافقة المدير المباشر (إحالة للموارد البشرية)";
          extraFields.directManagerDecision = "Approved";
        } else {
          if (!reviewNote || !reviewNote.trim()) {
            alert(t("سبب الاعتراض مطلوب إلزامياً للمتابعة"));
            return;
          }
          nextStatus = higherMgr ? "Pending Higher Manager" : "Pending HR";
          actionName = higherMgr
            ? "اعتراض المدير المباشر (إحالة للرئيس الأعلى للبت)"
            : "اعتراض المدير المباشر (إحالة للموارد البشرية للقرار النهائي)";
          extraFields.directManagerDecision = "Objected";
          extraFields.directManagerObjectionReason = reviewNote.trim();
        }
      }
      // 2. Higher Manager Stage
      else if (currentStatus === "Pending Higher Manager") {
        if (action === "Approved") {
          nextStatus = "Pending HR";
          actionName = "موافقة الرئيس الأعلى (إحالة للموارد البشرية)";
          extraFields.higherManagerDecision = "Approved";
        } else {
          if (!reviewNote || !reviewNote.trim()) {
            alert(t("سبب الاعتراض مطلوب إلزامياً للمتابعة"));
            return;
          }
          nextStatus = "Pending HR";
          actionName = "اعتراض الرئيس الأعلى (إحالة للموارد البشرية للقرار النهائي)";
          extraFields.higherManagerDecision = "Objected";
          extraFields.higherManagerObjectionReason = reviewNote.trim();
        }
      }
      // 3. HR Stage
      else {
        if (action === "Approved") {
          nextStatus = "Approved";
          actionName = "اعتماد نهائي من الموارد البشرية";
          extraFields.hrDecision = "Approved";
        } else {
          if (!reviewNote || !reviewNote.trim()) {
            alert(t("سبب الرفض مطلوب إلزامياً للمتابعة"));
            return;
          }
          nextStatus = "Rejected";
          actionName = "رفض نهائي من الموارد البشرية";
          extraFields.hrDecision = "Rejected";
          extraFields.rejectionReason = reviewNote.trim();
        }
      }

      const existingAudit = Array.isArray(pen.auditTrail) ? pen.auditTrail : [];
      const newAuditEntry = {
        timestamp: new Date().toISOString(),
        userName: (profile as any)?.name || user?.email || "المدير المباشر",
        action: actionName,
        comment: reviewNote || (nextStatus === "Approved" ? "تمت الموافقة" : "تم تدوين الملاحظة والاعتراض"),
        previousStatus: pen.status,
        newStatus: nextStatus,
      };

      const updatedPayload = {
        status: nextStatus,
        ...extraFields,
        auditTrail: [...existingAudit, newAuditEntry],
        updatedAt: new Date().toISOString(),
      };

      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/penalties/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedPayload),
      });

      if (!res.ok) {
        try {
          await updateDoc(doc(db, "penalties", id), updatedPayload);
        } catch (e) {}
      }

      // Update administrative notice
      try {
        const empName = emp?.name || (pen as any).employeeName || "الموظف المعني";
        const violationTypeName = pen.violationType || "مخالفة إدارية";
        const noticeTitle = `قرار جزاء إداري رقم ${pen.penaltyNumber || pen.id}: ${violationTypeName}`;
        const audienceSet = new Set<string>();
        [pen.employeeId, emp?.id, emp?.employeeId, emp?.userId, emp?.email].filter(Boolean).forEach(x => audienceSet.add(String(x).toLowerCase().trim()));
        if (directMgr) [directMgr.id, directMgr.employeeId, directMgr.userId, directMgr.email].filter(Boolean).forEach(x => audienceSet.add(String(x).toLowerCase().trim()));
        if (higherMgr) [higherMgr.id, higherMgr.employeeId, higherMgr.userId, higherMgr.email].filter(Boolean).forEach(x => audienceSet.add(String(x).toLowerCase().trim()));

        const noticePayload = {
          id: `NOTICE-PEN-${pen.id}`,
          title: noticeTitle,
          category: 'decision',
          priority: 'urgent',
          noticeDate: pen.penaltyDate || new Date().toISOString().split('T')[0],
          startDate: pen.penaltyDate || new Date().toISOString().split('T')[0],
          durationDays: 30,
          isPermanent: false,
          content: `<p><strong>قرار جزاء إداري رقم:</strong> ${pen.penaltyNumber || pen.id}</p><p><strong>حالة القرار الحالية:</strong> ${nextStatus}</p>`,
          targetAudience: Array.from(audienceSet),
          status: 'Published',
          readBy: [],
          createdById: profile?.id || user?.uid || 'system',
          createdByName: (profile as any)?.name || user?.email || 'إدارة النظام',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await fetch(`/api/administrative-notices/${noticePayload.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(noticePayload),
        });
      } catch (err) {}

      setMessage({
        type: "success",
        text: `تم تحديث حالة الجزاء بنجاح (الحالة الحالية: ${nextStatus})`,
      });
      setSelectedTeamRequest(null);
      loadDashboard();
      await refreshData();
    } catch (err: any) {
      setMessage({
        type: "error",
        text: t("فشل تحديث حالة الجزاء:") + err.message,
      });
    }
  };

  // Display data from linked employee record if available, otherwise fallback to auth user
  const displayName =
    linkedEmployee?.name || user?.displayName || user?.name || "User";
  const displayJobTitle =
    linkedEmployee?.jobTitle || (profile as any)?.jobTitle || "Memeber";
  const displayEmployeeId =
    linkedEmployee?.employeeId || (profile as any)?.employeeId || "---";
  const displayBranch =
    linkedEmployee?.branchId || (profile as any)?.branch || "Branch";

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <section className="bg-card p-10 rounded-none border-2 border-primary shadow-[8px_8px_0px_0px_rgba(37,99,235,0.1)] relative overflow-hidden transition-colors duration-500">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
          <div className="w-32 h-32 bg-primary rounded-none flex items-center justify-center text-primary-foreground text-5xl font-black shadow-2xl shadow-primary/20 transition-transform hover:scale-105 overflow-hidden">
            {(profile as any)?.photoUrl ? (
              <img
                src={(profile as any).photoUrl}
                alt={displayName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
              />
            ) : (
              displayName[0]
            )}
          </div>
          <div className="flex-1 text-center md:text-right">
            <h1 className="text-4xl font-black heading-gradient mb-3">
              {displayName}
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-xs text-muted-foreground font-black uppercase tracking-widest">
              <span className="flex items-center gap-2 px-4 py-2 bg-muted border-2 border-border/80 rounded-none group hover:bg-muted/50 transition-colors">
                <User className="w-4 h-4 text-primary" />
                <span className="opacity-60">
                  {isRtl ? t("الرقم الوظيفي:") : "Employee ID:"}
                </span>
                <span className="text-foreground">{displayEmployeeId}</span>
              </span>
              <span className="flex items-center gap-2 px-4 py-2 bg-muted border-2 border-border/80 rounded-none group hover:bg-muted/50 transition-colors">
                <Briefcase className="w-4 h-4 text-primary" />
                <span className="opacity-60">
                  {isRtl ? t("المسمى:") : "Job Title:"}
                </span>
                <span className="text-foreground">{displayJobTitle}</span>
              </span>
              <span className="flex items-center gap-2 px-4 py-2 bg-muted border-2 border-border/80 rounded-none group hover:bg-muted/50 transition-colors">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="opacity-60">
                  {isRtl ? t("الفرع:") : "Branch:"}
                </span>
                <span className="text-foreground">{displayBranch}</span>
              </span>
            </div>
          </div>
          <div
            className={cn(
              "px-10 py-4 rounded-none font-black text-xs uppercase tracking-[0.2em] shadow-sm border-4 transition-all animate-pulse",
              status === "Not Checked In"
                ? "bg-muted text-muted-foreground border-border"
                : status === "Checked In"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/40"
                  : "bg-primary/10 text-primary border-primary/40",
            )}
          >
            {status === "Not Checked In"
              ? isRtl
                ? t("لم يتم تسجيل الحضور")
                : "Not Checked In"
              : status === "Checked In"
                ? isRtl
                  ? t("متصل الآن")
                  : "Active Online"
                : isRtl
                  ? t("تم تسجيل الانصراف")
                  : "Checked Out"}
          </div>
        </div>
      </section>

      {/* Approved Penalties warnings if any */}
      {myApprovedPenalties.length > 0 && (
        <section className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 bg-destructive/10 rounded-none flex items-center justify-center text-destructive">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <h2 className="text-xl font-black text-foreground uppercase tracking-widest">
              {isRtl
                ? t("التنبيهات الإدارية والجزاءات المعتمدة")
                : "Official Written Warnings & Approved Penalties"}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myApprovedPenalties.map((penalty, idx) => {
              const penaltyTypeName = isRtl
                ? penalty.penaltyType === "Warning"
                  ? t("لفت نظر إداري")
                  : penalty.penaltyType === "Final Warning"
                    ? t("إنذار نهائي شديد اللهجة")
                    : penalty.penaltyType === "Day Deduction"
                      ? t("جزاء خصم من الراتب (بالأيام)")
                      : penalty.penaltyType === "Amount Deduction"
                        ? t("خصم مالي مباشر من المستحقات")
                        : penalty.penaltyType
                : penalty.penaltyType === "Warning"
                  ? "Official Written Warning"
                  : penalty.penaltyType === "Final Warning"
                    ? "Severe Final Warning"
                    : penalty.penaltyType === "Day Deduction"
                      ? "Salary Deduction (Days)"
                      : penalty.penaltyType === "Amount Deduction"
                        ? "Direct Financial Penalty"
                        : penalty.penaltyType;

              const violationTypeName = isRtl
                ? penalty.violationType === "Delay"
                  ? t("تأخير غير مبرر عن العمل")
                  : penalty.violationType === "Absence"
                    ? t("غياب بدون إذن رسمي")
                    : penalty.violationType === "Early Departure"
                      ? t("انصراف مبكر قبل الموعد")
                      : penalty.violationType === "Instruction Violation"
                        ? t("مخالفة التعليمات الإدارية")
                        : penalty.violationType === "Misconduct"
                          ? t("سلوك غير مهني")
                          : penalty.violationType === "Other"
                            ? t("أخرى (حسب اللائحة الداخلية)")
                            : penalty.violationType
                : penalty.violationType === "Delay"
                  ? "Unjustified Work Delay"
                  : penalty.violationType === "Absence"
                    ? "Absence Without Official Permission"
                    : penalty.violationType === "Early Departure"
                      ? "Early Departure Before Schedule"
                      : penalty.violationType === "Instruction Violation"
                        ? "Administrative Policy Non-Compliance"
                        : penalty.violationType === "Misconduct"
                          ? "Unprofessional Misconduct"
                          : penalty.violationType === "Other"
                            ? "Other Internal Policy Violation"
                            : penalty.violationType;

              return (
                <motion.div
                  initial={{ y: 15, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  key={penalty.id}
                  className={cn(
                    "p-6 bg-red-600/[0.03] border-2 border-red-500/30 rounded-none hover:border-red-500 hover:bg-red-600/[0.05] transition-all relative flex flex-col justify-between shadow-[4px_4px_0px_0px_rgba(239,68,68,0.1)]",
                    isRtl ? "text-right" : "text-left",
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-red-500/10 pb-3 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
                        <h3 className="text-base font-black text-red-600">
                          {penaltyTypeName}
                        </h3>
                      </div>
                      <span className="text-[10px] bg-red-500 text-white font-black px-2.5 py-1 rounded-none uppercase tracking-wider">
                        {isRtl ? t("رقم:") : "No:"} {penalty.penaltyNumber}
                      </span>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="grid grid-cols-2 gap-3 text-xs bg-muted/30 p-2.5 border border-border">
                        <div>
                          <span className="text-muted-foreground block text-[10px] font-bold mb-0.5">
                            {isRtl
                              ? t("نوع المخالفة المرتكبة:")
                              : "Committed Violation Type:"}
                          </span>
                          <span className="font-extrabold text-foreground">
                            {violationTypeName}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground block text-[10px] font-bold mb-0.5">
                            {isRtl ? t("تاريخ المخالفة:") : "Violation Date:"}
                          </span>
                          <span className="font-extrabold text-foreground font-mono">
                            {penalty.violationDate}
                          </span>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "p-3.5 bg-background",
                          isRtl
                            ? "border-r-4 border-red-500/70"
                            : "border-l-4 border-red-500/70",
                        )}
                      >
                        <span className="text-[10px] text-muted-foreground block font-bold mb-1">
                          {isRtl
                            ? t("تفاصيل ومبررات القرار الإداري:")
                            : "Administrative Decision Details:"}
                        </span>
                        <p className="text-xs font-bold leading-relaxed text-foreground/90">
                          {penalty.description}
                        </p>
                      </div>

                      {Number(penalty.deductionValue) > 0 && (
                        <div className="flex items-center gap-2 text-xs bg-red-500/10 text-red-600 p-2.5 border border-red-500/20 font-extrabold">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          <span>
                            {isRtl
                              ? t("الجزاء المترتب: خصم قدره")
                              : "Resulting Penalty: Deduction of"}{" "}
                            <span className="font-black text-sm text-red-700 underline mx-1">
                              {penalty.deductionValue}
                            </span>{" "}
                            {penalty.deductionType === "Amount"
                              ? isRtl
                                ? t("ج.م")
                                : "EGP"
                              : isRtl
                                ? t("أيام من الراتب الأساسي")
                                : "days from basic salary"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grievance section */}
                  {penalty.hasGrievance ? (
                    <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-none text-xs space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5 text-indigo-600" />
                          {isRtl ? "التظلم الإداري المقدم:" : "Submitted Grievance:"}
                        </span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-none bg-indigo-500/20 text-indigo-800 dark:text-indigo-300">
                          {penalty.grievanceStatus === "Pending"
                            ? isRtl ? "قيد دراسة HR" : "HR Under Review"
                            : penalty.grievanceStatus === "Accepted_Modified"
                              ? isRtl ? "مقبول وتم تعديل الجزاء" : "Accepted & Modified"
                              : isRtl ? "مرفوض التظلم" : "Rejected"}
                        </span>
                      </div>
                      <p className="text-foreground text-[11px] font-medium">
                        <strong>{isRtl ? "سبب التظلم:" : "Reason:"}</strong> {penalty.grievanceReason}
                      </p>
                      {penalty.grievanceReply && (
                        <div className="pt-1.5 border-t border-indigo-500/20 text-indigo-900 dark:text-indigo-200 text-[11px]">
                          <strong>{isRtl ? "رد وقرار إدارة الموارد البشرية:" : "HR Decision:"}</strong> {penalty.grievanceReply}
                        </div>
                      )}
                      {penalty.grievanceStatus === "Accepted_Modified" && (
                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold space-y-1">
                          <div className="text-muted-foreground">
                            {isRtl ? "الجزاء قبل التظلم:" : "Original Penalty:"} {penalty.preGrievancePenaltyType || "-"} ({penalty.preGrievanceDeductionValue || 0} {penalty.preGrievanceDeductionType === "Days" ? (isRtl ? "يوم" : "days") : (isRtl ? "ج.م" : "EGP")})
                          </div>
                          <div className="text-emerald-700 dark:text-emerald-400 font-black">
                            {isRtl ? "الجزاء المعتمد بعد قبول التظلم:" : "Approved Penalty after Grievance:"} {penalty.postGrievancePenaltyType || penalty.penaltyType} ({penalty.postGrievanceDeductionValue ?? penalty.deductionValue} {penalty.deductionType === "Days" ? (isRtl ? "يوم" : "days") : (isRtl ? "ج.م" : "EGP")})
                          </div>
                        </div>
                      )}
                    </div>
                  ) : penalty.status === "Cancelled" || penalty.status === "تم إلغاء الجزاء" ? (
                    <div className="pt-2">
                      <div className="p-2.5 bg-slate-500/10 border border-slate-500/20 text-[11px] text-slate-600 dark:text-slate-400 font-bold flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-slate-500" />
                          {isRtl ? "تم إلغاء هذا الجزاء رسمياً" : "This penalty has been officially cancelled"}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-500/20 text-slate-700 dark:text-slate-300 font-black">
                          {isRtl ? "تم إلغاء الجزاء" : "Cancelled"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          setGrievanceModal({
                            isOpen: true,
                            penalty: penalty,
                            reason: "",
                            submitting: false,
                          });
                        }}
                        className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-none text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>{isRtl ? "تقديم تظلم إداري رسمي على هذا الجزاء" : "Submit Formal Disciplinary Grievance"}</span>
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] font-black tracking-widest text-muted-foreground border-t border-border/60 pt-3">
                    <span>
                      {isRtl ? t("تاريخ صدور العقوبة:") : "Issue Date:"}{" "}
                      <span className="font-mono text-foreground">
                        {penalty.penaltyDate}
                      </span>
                    </span>
                    <span className={cn(
                      "px-2 py-0.5 font-bold rounded-none uppercase text-[10px] border",
                      penalty.status === "Approved"
                        ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/25"
                        : penalty.status === "Cancelled"
                          ? "text-slate-600 bg-slate-500/10 border-slate-500/25"
                          : "text-amber-600 bg-amber-500/10 border-amber-500/25"
                    )}>
                      {penalty.status === "Approved"
                        ? (isRtl ? t("معتمد كلياً") : "Fully Approved")
                        : penalty.status === "Cancelled"
                          ? (isRtl ? t("تم إلغاء الجزاء") : "Penalty Cancelled")
                          : (isRtl ? t("قيد المراجعة") : "Under Review")}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Actions / Smart Services Hub */}
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-none flex items-center justify-center text-primary-foreground">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black heading-gradient uppercase tracking-widest">
                  {t("الخدمات الذكية")}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">
                  {t("الشهر النشط للمعاملات:")}
                </span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="p-2 border-2 border-primary/50 bg-card text-foreground text-xs font-black rounded-none focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              <button
                onClick={goToMyTasks}
                className="p-8 bg-card border-2 border-primary/40 rounded-none shadow-[4px_4px_0px_0px_rgba(37,99,235,0.1)] flex flex-col items-center gap-4 hover:border-primary hover:bg-primary/5 hover:shadow-[6px_6px_0px_0px_rgba(37,99,235,0.2)] transition-all group text-center active:scale-95 relative"
              >
                <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-none">
                  {activeTasksCount}
                </div>
                <div className="w-16 h-16 rounded-none flex items-center justify-center bg-primary/10 transition-transform group-hover:scale-110">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-black text-foreground mb-1">
                    {t("المهام النشطة")}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium italic opacity-60">
                    {t("متابعة إنجاز الأعمال")}
                  </p>
                </div>
              </button>
              {(() => {
                let actionsList = [
                  {
                    icon: Calendar,
                    label: t("طلب إجازة"),
                    desc: t("سنوية، مرضية، مرافقة"),
                    color: "text-orange-500",
                    bg: "bg-orange-500/10",
                    onClick: () => setIsLeaveModalOpen(true),
                  },
                  {
                    icon: Home,
                    label: t("العمل من المنزل"),
                    desc: t("التقديم على تصريح العمل من المنزل"),
                    color: "text-pink-500",
                    bg: "bg-pink-500/10",
                    onClick: () => setIsWfhModalOpen(true),
                  },
                  {
                    icon: FileText,
                    label: t("طلب مأمورية"),
                    desc: t("عمل خارجي، زيارة موقع"),
                    color: "text-primary",
                    bg: "bg-primary/10",
                    onClick: () => setIsMissionModalOpen(true),
                  },
                  {
                    icon: History,
                    label: t("سجل الحضور"),
                    desc: t("تقرير الحضور لشهر مختار"),
                    color: "text-emerald-500",
                    bg: "bg-emerald-500/10",
                    onClick: handleOpenAttendanceSummaryModal,
                  },
                  {
                    icon: User,
                    label: t("بياناتي"),
                    desc: t("بيانات الموظف الشاملة"),
                    color: "text-slate-500",
                    bg: "bg-slate-500/10",
                    onClick: () => setIsMyDetailsModalOpen(true),
                  },
                  {
                    icon: Award,
                    label: t("تقييم الأداء والنمو"),
                    desc: currentEvaluation 
                      ? (currentEvaluation.status === "Approved" ? `${t("النتيجة:")} ${currentEvaluation.finalPercentageScore || 0}%` : t("متابعة الدورة التقييمية"))
                      : t("سجل التقييمات والأداء المهني"),
                    color: "text-amber-500",
                    bg: "bg-amber-500/10",
                    onClick: () => {
                      const el = document.getElementById("performance-appraisal-section");
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth" });
                      }
                    },
                  },
                ];

                if (isNotSubjectToAttendance) {
                  actionsList = actionsList.filter(
                    (act) => act.label !== t("سجل الحضور"),
                  );
                }

                if (isManager) {
                  actionsList.push({
                    icon: Users,
                    label: t("منصة فريقي الإشرافية"),
                    desc: t(
                      "إدارة ومتابعة أعضاء الفريق والطلبات والمهام والأداء عبر الإدارات",
                    ),
                    color: "text-violet-500",
                    bg: "bg-violet-500/10",
                    onClick: () =>
                      window.dispatchEvent(
                        new CustomEvent("navigate_to_entity", {
                          detail: { module: "self_service", tab: "my_team" },
                        }),
                      ),
                  });
                }

                return actionsList.map((action, i) => (
                  <button
                    key={i}
                    onClick={action.onClick}
                    className="p-8 bg-card border-2 border-border/60 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] flex flex-col items-center gap-4 hover:border-primary hover:bg-muted/30 hover:shadow-[4px_4px_0px_0px_var(--primary-opacity,rgba(37,99,235,0.4))] transition-all group text-center active:scale-95"
                  >
                    <div
                      className={cn(
                        "w-16 h-16 rounded-none flex items-center justify-center transition-transform group-hover:scale-110",
                        action.bg,
                      )}
                    >
                      <action.icon className={cn("w-8 h-8", action.color)} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground mb-1">
                        {action.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-medium italic opacity-60">
                        {action.desc}
                      </p>
                    </div>
                  </button>
                ));
              })()}
            </div>
          </section>

          {/* Time Management: Daily Ticket & Eisenhower Matrix Widget */}
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-border/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500/10 rounded-none flex items-center justify-center text-indigo-600">
                  <Sliders className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black heading-gradient">
                    {t("أدوات إدارة الوقت والإنتاجية")}
                  </h2>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-1">
                    {t(
                      "توليد تلقائي لتوزيع الأعمال اليومية ومصفوفة أيزنهاور الذكية",
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={goToTimeManagement}
                className="p-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-none cursor-pointer flex items-center gap-1.5 transition-all shadow-md border-none"
              >
                <span>{t("فتح الأجندة الكاملة")}</span>
                <ArrowUpRight className="w-4 h-4 animate-bounce" />
              </button>
            </div>

            {/* Daily Ticket + Eisenhower Summary Intro Dual Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Requests Summary wide panel */}
              <div className="lg:col-span-3 bg-gradient-to-br from-indigo-500/5 via-card to-card border-2 border-border/80 p-6 rounded-none space-y-6 flex flex-col justify-between">
                <div className="space-y-2 text-right">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-black text-foreground flex items-center gap-1.5">
                      <div className="w-1.5 h-5 bg-primary rounded-none" />
                      {t("ملخص الطلبات والإجراءات الشاملة (انقر للتفاصيل)")}
                    </h4>
                    <span className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5">
                      {t("مزامنة مباشرة مالي وإداري")}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {t(
                      "اضغط على أي تصنيف من التصنيفات أدناه لفتح تفصيل وقرارات الطلبات الحالية والسابقة فوراً",
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {requestCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => setDetailsPopupType(card.id as any)}
                      className={cn(
                        "p-5 border-2 text-right transition-all hover:scale-[1.03] hover:shadow-lg active:scale-95 group rounded-none outline-none relative overflow-hidden cursor-pointer",
                        card.bg,
                        card.border,
                      )}
                      title={card.desc}
                    >
                      <div className="absolute top-2 left-2 bg-foreground/5 p-1 rounded-none opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowUpRight className="w-3 h-3 text-foreground" />
                      </div>
                      <p
                        className={cn(
                          "text-[10px] font-black uppercase tracking-widest mb-2",
                          card.color,
                        )}
                      >
                        {card.label}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-foreground leading-none">
                          {card.value}
                        </span>
                        <span className="text-[8px] text-muted-foreground opacity-60">
                          {t("طلبات")}
                        </span>
                      </div>
                      <p className="text-[8px] text-muted-foreground font-black mt-3 italic opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 whitespace-nowrap overflow-hidden text-ellipsis text-left">
                        {t("انقر للتفاصيل &larr;")}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-dashed border-border flex justify-between items-center text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1 font-bold text-foreground">
                    <AlertCircle className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    مجموع طلبات الخدمة الذاتية النشطة:{" "}
                    {summary
                      ? summary.pendingLeaves +
                        summary.approvedLeaves +
                        summary.pendingMissions +
                        summary.approvedMissions +
                        (summary.pendingWfh || 0) +
                        (summary.approvedWfh || 0)
                      : 0}
                  </span>
                  <span className="font-mono text-[9px] text-muted-foreground">
                    {t("تحديث حي")}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Attendance Widget */}
          {!isNotSubjectToAttendance && (
            <section className="bg-card rounded-none border-2 border-border/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-none flex items-center justify-center text-primary">
                    {effectiveWorkMode === "Office Work" ? (
                      <Fingerprint className="w-6 h-6" />
                    ) : effectiveWorkMode === "Work From Home" ? (
                      <Home className="w-6 h-6 text-pink-500" />
                    ) : (
                      <MapPin className="w-6 h-6 text-purple-500" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-black heading-gradient">
                      {effectiveWorkMode === "Work From Home"
                        ? t("بوابة العمل من المنزل (تصريح مؤقت معتمد اليوم)")
                        : effectiveWorkMode === "Remotely Work"
                          ? t("بوابة تسجيل العمل عن بُعد (Remotely Work)")
                          : t("بوابة تسجيل الحضور بالمقر (Office Work)")}
                    </h2>
                    <p className="text-[10px] text-muted-foreground font-bold mt-0.5">
                      {effectiveWorkMode === "Work From Home"
                        ? t("تم اعتماد طلب إذن العمل من المنزل ليومنا هذا")
                        : effectiveWorkMode === "Remotely Work"
                          ? t("طريقة العمل الأساسية: العمل عن بُعد بدون GPS")
                          : t(
                              "طريقة العمل الأساسية: تسجيل الحضور بالبصمة في المقر الرسمية",
                            )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-none border-2 border-border/60">
                  {effectiveWorkMode === "Office Work" ? (
                    <>
                      <Wifi className="w-4 h-4 text-emerald-500" />
                      <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        {t("شبكة معتمدة")}
                      </span>
                    </>
                  ) : effectiveWorkMode === "Work From Home" ? (
                    <>
                      <Home className="w-4 h-4 text-pink-500" />
                      <span className="text-[10px] font-black text-pink-600 dark:text-pink-400 uppercase tracking-widest">
                        {t("تصريح WFH معتمد")}
                      </span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-purple-500" />
                      <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                        {t("عمل عن بُعد")}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "p-5 mb-8 flex items-center gap-4 rounded-none font-black text-xs border-2 uppercase tracking-widest",
                    message.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/40"
                      : "bg-destructive/10 text-destructive border-destructive/40",
                  )}
                >
                  {message.type === "success" ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0" />
                  )}
                  {message.text}
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="p-8 bg-muted/30 rounded-none border-2 border-border transition-all hover:bg-muted/50 group">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mb-2 opacity-60">
                    {effectiveWorkMode === "Office Work"
                      ? t("وقت الحضور بالمقر")
                      : t("وقت بدء العمل")}
                  </p>
                  <p className="text-4xl font-black text-foreground tracking-widest group-hover:text-primary transition-colors">
                    {formatTime12h(attendance.checkIn, language)}
                  </p>
                </div>
                <div className="p-8 bg-muted/30 rounded-none border-2 border-border transition-all hover:bg-muted/50 group">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter mb-2 opacity-60">
                    {effectiveWorkMode === "Office Work"
                      ? t("وقت الانصراف")
                      : t("وقت إنهاء العمل")}
                  </p>
                  <p className="text-4xl font-black text-foreground tracking-widest group-hover:text-emerald-500 transition-colors">
                    {formatTime12h(attendance.checkOut, language)}
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4">
                {!attendance.checkIn && (
                  <button
                    disabled={attendanceLoading}
                    onClick={() => handleAttendance("check-in")}
                    className="flex-1 py-6 bg-primary text-primary-foreground font-black rounded-none shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-4 disabled:opacity-50 active:scale-[0.98] uppercase tracking-[0.2em] text-xs"
                  >
                    {effectiveWorkMode === "Office Work" ? (
                      <>
                        <Fingerprint className="w-7 h-7" />
                        <span>{t("تسجيل بصمة حضـور (GPS)")}</span>
                      </>
                    ) : effectiveWorkMode === "Work From Home" ? (
                      <>
                        <Home className="w-7 h-7" />
                        <span>{t("تسجيل بدء العمل من المنزل")}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-7 h-7" />
                        <span>{t("بدء العمل عن بُعد (Start Work)")}</span>
                      </>
                    )}
                  </button>
                )}
                {attendance.checkIn && !attendance.checkOut && (
                  <button
                    disabled={attendanceLoading}
                    onClick={() => handleAttendance("check-out")}
                    className="flex-1 py-6 bg-emerald-600 text-white font-black rounded-none shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center justify-center gap-4 disabled:opacity-50 active:scale-[0.98] uppercase tracking-[0.2em] text-xs"
                  >
                    <Clock className="w-7 h-7" />
                    <span>
                      {effectiveWorkMode === "Office Work"
                        ? t("تسجيل بصمة انصراف (GPS)")
                        : effectiveWorkMode === "Work From Home"
                          ? t("تسجيل إنهاء العمل من المنزل")
                          : t("إنهاء العمل عن بُعد (End Work)")}
                    </span>
                  </button>
                )}
                {attendance.checkIn && attendance.checkOut && (
                  <div className="flex-1 py-6 bg-muted text-muted-foreground font-black rounded-none flex items-center justify-center gap-4 border border-border shadow-inner uppercase tracking-widest text-xs">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                    <span>{t("اكتمل يوم العمل بنجاح")}</span>
                  </div>
                )}
              </div>

              <p className="mt-8 text-[10px] text-muted-foreground font-bold uppercase tracking-widest text-center leading-relaxed italic opacity-70">
                {effectiveWorkMode === "Office Work"
                  ? t(
                      "* يجب التواجد داخل النطاق الجغرافي المعتمد والاتصال بالشبكة المحلية لتتمكن من تسجيل الحضور بالمقر.",
                    )
                  : effectiveWorkMode === "Work From Home"
                    ? t(
                        "* تم رصد إذن عمل من المنزل معتمد لهذا اليوم. تم تفعيل خيار التسجيل الإلكتروني السريع بدون اشتراط GPS المقر.",
                      )
                    : t(
                        "* نمط العمل المعرّف بالملف الشخصي: العمل عن بُعد. يتم تسجيل الحضور مباشرة دون الاشتراط بالتواجد الجغرافي بالمقر.",
                      )}
                <br />
                {t("يتم تتبع المعرفات الرقمية للأجهزة لضمان أمن السجلات.")}
              </p>
            </section>
          )}

          {/* Missions Log for Selected Month */}
          <section className="bg-card rounded-none border-2 border-border/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-none flex items-center justify-center text-primary">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black heading-gradient">
                    {t("سجل المأموريات")}
                  </h2>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">
                    تتبع المأموريات والمواقع للشهر المختار: {selectedMonth}
                  </p>
                </div>
              </div>
            </div>

            {(() => {
              const combinedMissions = [...(missions || []), ...(employeeMissions || [])];
              const uniqueMissionsMap = new Map<string, any>();
              combinedMissions.forEach((m) => {
                if (!m || !m.id) return;
                if (!uniqueMissionsMap.has(m.id)) {
                  uniqueMissionsMap.set(m.id, m);
                } else {
                  const existing = uniqueMissionsMap.get(m.id);
                  if (
                    (isApprovedStatus(m.status) || isCompletedStatus(m.status)) &&
                    !(isApprovedStatus(existing.status) || isCompletedStatus(existing.status))
                  ) {
                    uniqueMissionsMap.set(m.id, m);
                  }
                }
              });

              const myMissions = Array.from(uniqueMissionsMap.values()).filter((m: any) => {
                if (!m) return false;
                const matchesMonth =
                  !selectedMonth ||
                  m.startDate?.startsWith(selectedMonth) ||
                  m.endDate?.startsWith(selectedMonth);
                if (!matchesMonth) return false;

                if (currentEmpIdentifiers && currentEmpIdentifiers.length > 0) {
                  const mEmpId = String(m.employeeId || m.employee_id || m.userId || "").toLowerCase().trim();
                  const mCreatorId = String(m.creatorId || "").toLowerCase().trim();
                  const isMine = currentEmpIdentifiers.some(
                    (id) => id === mEmpId || id === mCreatorId
                  );
                  if (!isMine && (m.employeeId || m.employee_id)) {
                    return false;
                  }
                }
                return true;
              });

              if (myMissions.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground italic font-semibold text-xs">
                    {t("لا توجد مأموريات مسجلة لهذا الشهر.")}
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse" dir="rtl">
                    <thead>
                      <tr className="border-b-2 border-border text-[9px] font-black text-muted-foreground uppercase tracking-widest bg-muted/30">
                        <th className="py-3 px-4">{t("المأمورية")}</th>
                        <th className="py-3 px-4">{t("المشروع المرتبط")}</th>
                        <th className="py-3 px-4">{t("من تاريخ")}</th>
                        <th className="py-3 px-4">{t("إلى تاريخ")}</th>
                        <th className="py-3 px-4">{t("الحالة")}</th>
                        <th className="py-3 px-4">{t("ملاحظات العمل")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myMissions.map((mission: any) => {
                        const project =
                          dashboardData?.projects?.find(
                            (p: any) => p.id === mission.projectId,
                          ) || projects?.find((p: any) => p.id === mission.projectId);
                        const mType =
                          dashboardData?.missionTypes?.find(
                            (t: any) => t.id === mission.missionTypeId,
                          ) || missionTypes?.find((t: any) => t.id === mission.missionTypeId);

                        const isApp = isApprovedStatus(mission.status);
                        const isComp = isCompletedStatus(mission.status);
                        const isRej = isRejectedStatus(mission.status);
                        const isPend = isPendingStatus(mission.status);

                        return (
                          <tr
                            key={mission.id}
                            className="border-b border-border/65 text-xs font-bold hover:bg-muted/10 transition-colors"
                          >
                            <td className="py-4 px-4 text-foreground">
                              {mType?.name || mission.title || t("مأمورية عمل")}
                            </td>
                            <td className="py-4 px-4 text-muted-foreground">
                              {project?.name || t("عام / خارجي")}
                            </td>
                            <td className="py-4 px-4 font-mono">
                              {mission.startDate}
                            </td>
                            <td className="py-4 px-4 font-mono">
                              {mission.endDate}
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className={cn(
                                  "px-2 py-1 rounded-none text-[8px] font-black border uppercase tracking-wider",
                                  isApp
                                    ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                    : isComp
                                      ? "bg-blue-500/15 text-blue-600 border-blue-500/30"
                                      : isPend
                                        ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                                        : isRej
                                          ? "bg-destructive/10 text-destructive border-destructive/30"
                                          : "bg-muted text-muted-foreground border-border",
                                )}
                              >
                                {isApp
                                  ? t("معتمدة")
                                  : isComp
                                    ? t("مكتملة ومُقيّمة")
                                    : isPend
                                      ? t("قيد الانتظار")
                                      : isRej
                                        ? t("مرفوضة")
                                        : mission.status || t("معلق")}
                              </span>
                            </td>
                            <td
                              className="py-4 px-4 text-muted-foreground font-medium max-w-[180px] truncate"
                              title={mission.notes}
                            >
                              {mission.notes || "---"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </section>
        </div>

        {/* Sidebar Widgets */}
        <div className="space-y-8">
          {/* Eisenhower Mini Matrix Representation (Moved to Sidebar professionally) */}
          {/* Eisenhower Mini Matrix Representation (Enlarged and optimized beautifully) */}
          <section className="bg-card p-8 rounded-none border-2 border-border/80 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.08)] space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b-2 border-border/80">
              <h3 className="text-base md:text-lg font-black text-foreground flex items-center gap-2 font-sans">
                <Layers className="w-5 h-5 text-indigo-600 animate-pulse" />
                {t("مصفوفة أيزنهاور لتوزيع الأولويات")}
              </h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setIsEisenhowerExpanded(true)}
                  className="flex-1 sm:flex-none px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-none cursor-pointer flex items-center justify-center gap-1.5 transition-all shadow-sm border-none"
                  title={t("عرض وحجم كامل للشاشة")}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>{t("تكبير المصفوفة")}</span>
                </button>
                <button
                  onClick={goToTimeManagement}
                  className="px-3 py-1.5 border border-border bg-muted/40 hover:bg-muted text-foreground font-black text-xs rounded-none transition-colors"
                >
                  {t("الخيارات المتقدمة")}
                </button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed font-sans pr-1">
              {t(
                "توزيع وتصنيف تلقائي ذكي لالتزامات الوقت والمهام، مع إمكانية إنجاز وحذف الفوري للمهام من المصفوفة مباشرةً:",
              )}
            </p>

            <div className="grid grid-cols-2 gap-4">
              {/* DO FIRST Quadrant */}
              <div className="bg-muted/15 border-r-4 border-emerald-500 border border-border/80 p-4 flex flex-col justify-between gap-3 text-right">
                <div className="w-full">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-xs font-black text-emerald-800 dark:text-emerald-400">
                      {t("עاجل وهام")}
                    </span>
                    <span className="text-[10px] font-mono font-black text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5">
                      {
                        dashboardEvents.filter(
                          (e) =>
                            e.quadrant === "do_first" &&
                            e.status !== "Completed",
                        ).length
                      }{" "}
                      مهام
                    </span>
                  </div>

                  <div className="space-y-1.5 mt-2">
                    {dashboardEvents
                      .filter(
                        (e) =>
                          e.quadrant === "do_first" && e.status !== "Completed",
                      )
                      .slice(0, 4)
                      .map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => handleOpenTaskDetailModal(evt)}
                          className="group relative flex items-center justify-between text-xs text-muted-foreground hover:text-foreground font-semibold gap-1.5 min-h-[22px] cursor-pointer"
                          title={evt.title}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <span className="text-emerald-500 shrink-0 text-base">
                              &bull;
                            </span>
                            <span className="truncate text-right">
                              {evt.title}
                            </span>
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDashboardMarkComplete(evt.id, e);
                            }}
                            className="w-4 h-4 rounded-full border border-emerald-500 bg-background text-emerald-500 hover:bg-emerald-500 hover:text-white flex items-center justify-center text-xs cursor-pointer transition-all shrink-0"
                            title={t("إكمال وإغلاق")}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[4]" />
                          </button>
                        </div>
                      ))}
                    {dashboardEvents.filter(
                      (e) =>
                        e.quadrant === "do_first" && e.status !== "Completed",
                    ).length === 0 && (
                      <div className="text-[10px] text-muted-foreground/60 italic py-2">
                        {t("لا توجد مهام عاجلة وهامة")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-border/30">
                  <span className="text-muted-foreground font-bold">
                    {t("كفاءة الإنجاز:")}
                  </span>
                  <span className="font-mono font-black text-emerald-600">
                    {(() => {
                      const total = dashboardEvents.filter(
                        (e) => e.quadrant === "do_first",
                      ).length;
                      const done = dashboardEvents.filter(
                        (e) =>
                          e.quadrant === "do_first" && e.status === "Completed",
                      ).length;
                      return total > 0
                        ? `${Math.round((done / total) * 100)}%`
                        : "0%";
                    })()}
                  </span>
                </div>
              </div>

              {/* SCHEDULE Quadrant */}
              <div className="bg-muted/15 border-r-4 border-indigo-600 border border-border/80 p-4 flex flex-col justify-between gap-3 text-right">
                <div className="w-full">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-xs font-black text-indigo-800 dark:text-indigo-400 font-sans">
                      {t("جدولة هادئة")}
                    </span>
                    <span className="text-[10px] font-mono font-black text-indigo-600 bg-indigo-500/10 px-1.5 py-0.5">
                      {
                        dashboardEvents.filter(
                          (e) =>
                            e.quadrant === "schedule" &&
                            e.status !== "Completed",
                        ).length
                      }{" "}
                      مهام
                    </span>
                  </div>

                  <div className="space-y-1.5 mt-2">
                    {dashboardEvents
                      .filter(
                        (e) =>
                          e.quadrant === "schedule" && e.status !== "Completed",
                      )
                      .slice(0, 4)
                      .map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => handleOpenTaskDetailModal(evt)}
                          className="group relative flex items-center justify-between text-xs text-muted-foreground hover:text-foreground font-semibold gap-1.5 min-h-[22px] cursor-pointer"
                          title={evt.title}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <span className="text-indigo-500 shrink-0 text-base">
                              &bull;
                            </span>
                            <span className="truncate text-right">
                              {evt.title}
                            </span>
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDashboardMarkComplete(evt.id, e);
                            }}
                            className="w-4 h-4 rounded-full border border-indigo-600 bg-background text-indigo-500 hover:bg-indigo-600 hover:text-white flex items-center justify-center text-xs cursor-pointer transition-all shrink-0"
                            title={t("إكمال وإغلاق")}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[4]" />
                          </button>
                        </div>
                      ))}
                    {dashboardEvents.filter(
                      (e) =>
                        e.quadrant === "schedule" && e.status !== "Completed",
                    ).length === 0 && (
                      <div className="text-[10px] text-muted-foreground/60 italic py-2">
                        {t("مربع مجدول فارغ")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-border/30">
                  <span className="text-muted-foreground font-bold">
                    {t("كفاءة الإنجاز:")}
                  </span>
                  <span className="font-mono font-black text-indigo-600">
                    {(() => {
                      const total = dashboardEvents.filter(
                        (e) => e.quadrant === "schedule",
                      ).length;
                      const done = dashboardEvents.filter(
                        (e) =>
                          e.quadrant === "schedule" && e.status === "Completed",
                      ).length;
                      return total > 0
                        ? `${Math.round((done / total) * 100)}%`
                        : "0%";
                    })()}
                  </span>
                </div>
              </div>

              {/* DELEGATE Quadrant */}
              <div className="bg-muted/15 border-r-4 border-amber-500 border border-border/80 p-4 flex flex-col justify-between gap-3 text-right">
                <div className="w-full">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-xs font-black text-amber-800 dark:text-amber-400">
                      {t("تفويض فعال")}
                    </span>
                    <span className="text-[10px] font-mono font-black text-amber-600 bg-amber-500/10 px-1.5 py-0.5">
                      {
                        dashboardEvents.filter(
                          (e) =>
                            e.quadrant === "delegate" &&
                            e.status !== "Completed",
                        ).length
                      }{" "}
                      مهام
                    </span>
                  </div>

                  <div className="space-y-1.5 mt-2">
                    {dashboardEvents
                      .filter(
                        (e) =>
                          e.quadrant === "delegate" && e.status !== "Completed",
                      )
                      .slice(0, 4)
                      .map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => handleOpenTaskDetailModal(evt)}
                          className="group relative flex items-center justify-between text-xs text-muted-foreground hover:text-foreground font-semibold gap-1.5 min-h-[22px] cursor-pointer"
                          title={evt.title}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <span className="text-amber-500 shrink-0 text-base">
                              &bull;
                            </span>
                            <span className="truncate text-right">
                              {evt.title}
                            </span>
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDashboardMarkComplete(evt.id, e);
                            }}
                            className="w-4 h-4 rounded-full border border-amber-500 bg-background text-amber-500 hover:bg-amber-500 hover:text-white flex items-center justify-center text-xs cursor-pointer transition-all shrink-0"
                            title={t("إكمال وإغلاق")}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[4]" />
                          </button>
                        </div>
                      ))}
                    {dashboardEvents.filter(
                      (e) =>
                        e.quadrant === "delegate" && e.status !== "Completed",
                    ).length === 0 && (
                      <div className="text-[10px] text-muted-foreground/60 italic py-2">
                        {t("لا توجد مهام تفويض")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-border/30">
                  <span className="text-muted-foreground font-bold">
                    {t("كفاءة الإنجاز:")}
                  </span>
                  <span className="font-mono font-black text-amber-600">
                    {(() => {
                      const total = dashboardEvents.filter(
                        (e) => e.quadrant === "delegate",
                      ).length;
                      const done = dashboardEvents.filter(
                        (e) =>
                          e.quadrant === "delegate" && e.status === "Completed",
                      ).length;
                      return total > 0
                        ? `${Math.round((done / total) * 100)}%`
                        : "0%";
                    })()}
                  </span>
                </div>
              </div>

              {/* ELIMINATE Quadrant */}
              <div className="bg-muted/15 border-r-4 border-rose-500 border border-border/80 p-4 flex flex-col justify-between gap-3 text-right">
                <div className="w-full">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-xs font-black text-rose-800 dark:text-rose-400 font-sans">
                      {t("خارج الأولويات")}
                    </span>
                    <span className="text-[10px] font-mono font-black text-rose-600 bg-rose-500/10 px-1.5 py-0.5">
                      {
                        dashboardEvents.filter(
                          (e) =>
                            e.quadrant === "eliminate" &&
                            e.status !== "Completed",
                        ).length
                      }{" "}
                      مهام
                    </span>
                  </div>

                  <div className="space-y-1.5 mt-2">
                    {dashboardEvents
                      .filter(
                        (e) =>
                          e.quadrant === "eliminate" &&
                          e.status !== "Completed",
                      )
                      .slice(0, 4)
                      .map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => handleOpenTaskDetailModal(evt)}
                          className="group relative flex items-center justify-between text-xs text-muted-foreground hover:text-foreground font-semibold gap-1.5 min-h-[22px] cursor-pointer"
                          title={evt.title}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            <span className="text-rose-500 shrink-0 text-base">
                              &bull;
                            </span>
                            <span className="truncate text-right">
                              {evt.title}
                            </span>
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDashboardMarkComplete(evt.id, e);
                            }}
                            className="w-4 h-4 rounded-full border border-rose-500 bg-background text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center text-xs cursor-pointer transition-all shrink-0"
                            title={t("إكمال وإغلاق")}
                          >
                            <Check className="w-2.5 h-2.5 stroke-[4]" />
                          </button>
                        </div>
                      ))}
                    {dashboardEvents.filter(
                      (e) =>
                        e.quadrant === "eliminate" && e.status !== "Completed",
                    ).length === 0 && (
                      <div className="text-[10px] text-muted-foreground/60 italic py-2">
                        {t("لا توجد مهام هامشية")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-[10px] pt-1.5 border-t border-border/30">
                  <span className="text-muted-foreground font-bold">
                    {t("كفاءة الإنجاز:")}
                  </span>
                  <span className="font-mono font-black text-rose-600">
                    {(() => {
                      const total = dashboardEvents.filter(
                        (e) => e.quadrant === "eliminate",
                      ).length;
                      const done = dashboardEvents.filter(
                        (e) =>
                          e.quadrant === "eliminate" &&
                          e.status === "Completed",
                      ).length;
                      return total > 0
                        ? `${Math.round((done / total) * 100)}%`
                        : "0%";
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Interactive Performance Appraisal Hub & History */}
          <section
            id="performance-appraisal-section"
            className="bg-card p-6 md:p-8 rounded-none border-2 border-border/80 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.05)] text-right space-y-6"
            dir="rtl"
          >
            {/* Header & Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                    {t("تقييم الأداء والنمو المهني")}
                    {allMyEvaluations.length > 0 && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 border border-primary/20">
                        {allMyEvaluations.length} {t("تقييم")}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground font-semibold">
                    {t("متابعة نتائج الأداء السنوي والدوري وسجل التقييمات السابقة وخطة التطوير")}
                  </p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-wrap gap-1.5 bg-muted/40 p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setActiveEvalTab("current")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-black transition-all",
                    activeEvalTab === "current"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  {t("التقييم الحالي")}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEvalTab("archive")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-black transition-all flex items-center gap-1.5",
                    activeEvalTab === "archive"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  <span>{t("سجل التقييمات السابقة")}</span>
                  {previousEvaluations.length > 0 && (
                    <span className={cn(
                      "text-[9px] font-mono px-1.5 py-0.2 rounded-none",
                      activeEvalTab === "archive" ? "bg-white/20 text-white" : "bg-muted text-foreground"
                    )}>
                      {previousEvaluations.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveEvalTab("plan")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-black transition-all",
                    activeEvalTab === "plan"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                >
                  {t("خطة التطوير المهني")}
                </button>
              </div>
            </div>

            {/* Tab 1: Current Evaluation */}
            {activeEvalTab === "current" && (
              <div className="space-y-6">
                {currentEvaluation ? (
                  <>
                    {/* Cycle & Status Header */}
                    {(() => {
                      const cycle = allCyclesList.find((c: any) => c.id === currentEvaluation.cycleId);
                      const statusBadge = getEvalStatusBadge(currentEvaluation.status);
                      const StatusIcon = statusBadge.icon;
                      const gradeInfo = getEvalGradeInfo(
                        currentEvaluation.finalPercentageScore || currentEvaluation.systemCalculatedScore || 0,
                        currentEvaluation.finalGrade
                      );

                      return (
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/25 p-4 border border-border">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                  {t("الدورة التقييمية الحالية:")}
                                </span>
                                <h4 className="font-extrabold text-foreground text-sm">
                                  {cycle?.nameAr || cycle?.name || t("دورة تقييم الأداء")}
                                </h4>
                              </div>
                              <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 font-semibold">
                                {cycle?.startDate && (
                                  <span>{t("الفترة:")} {cycle.startDate} {cycle.endDate ? `— ${cycle.endDate}` : ""}</span>
                                )}
                                {currentEvaluation.updatedAt && (
                                  <span>{t("آخر تحديث:")} {new Date(currentEvaluation.updatedAt).toLocaleDateString("ar-EG")}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "px-3 py-1.5 font-black text-xs border flex items-center gap-1.5",
                                  statusBadge.bg,
                                  statusBadge.color,
                                  statusBadge.border
                                )}
                              >
                                <StatusIcon className="w-3.5 h-3.5" />
                                {statusBadge.label}
                              </span>
                            </div>
                          </div>

                          {/* Top Score & Highlights Card */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            {/* Gauge / Score */}
                            <div className="md:col-span-4 bg-muted/15 border border-border p-5 flex flex-col items-center justify-center text-center">
                              <div className="relative w-28 h-28 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                  <circle
                                    cx="56"
                                    cy="56"
                                    r="46"
                                    className="stroke-muted/40"
                                    strokeWidth="8"
                                    fill="transparent"
                                  />
                                  <circle
                                    cx="56"
                                    cy="56"
                                    r="46"
                                    className={cn("transition-all duration-700", gradeInfo.ring)}
                                    strokeWidth="8"
                                    fill="transparent"
                                    strokeDasharray={289}
                                    strokeDashoffset={
                                      289 -
                                      (289 *
                                        (currentEvaluation.finalPercentageScore ||
                                          currentEvaluation.systemCalculatedScore ||
                                          currentEvaluation.selfPercentageScore ||
                                          0)) /
                                        100
                                    }
                                  />
                                </svg>
                                <div className="absolute flex flex-col items-center">
                                  <span className="font-mono font-black text-2xl text-foreground">
                                    {currentEvaluation.finalPercentageScore ||
                                      currentEvaluation.systemCalculatedScore ||
                                      currentEvaluation.selfPercentageScore ||
                                      0}%
                                  </span>
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">
                                    {currentEvaluation.status === "Approved" ? t("النتيجة المعتمدة") : t("النتيجة الحالية")}
                                  </span>
                                </div>
                              </div>

                              <span
                                className={cn(
                                  "mt-3 px-3 py-1 font-black text-xs border",
                                  gradeInfo.bg,
                                  gradeInfo.color,
                                  gradeInfo.border
                                )}
                              >
                                {gradeInfo.label}
                              </span>

                              {/* Decision Source Tag */}
                              {currentEvaluation.decisionSource && (
                                <div className="mt-2 text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                                  <Scale className="w-3 h-3 text-primary" />
                                  <span>
                                    {currentEvaluation.decisionSource === "HigherManagerCustom"
                                      ? t("بقرار واعتماد الرئيس الأعلى")
                                      : currentEvaluation.decisionSource === "Manager"
                                      ? t("باعتماد تقييم المدير المباشر")
                                      : t("باعتماد مؤشر النظام التشغيلي")}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Workflow Timeline & Stages */}
                            <div className="md:col-span-8 bg-muted/15 border border-border p-5 flex flex-col justify-between space-y-4">
                              <div>
                                <h5 className="text-xs font-black text-foreground mb-3 flex items-center gap-2">
                                  <Sliders className="w-4 h-4 text-primary" />
                                  {t("سير ومراحل دورة التقييم")}
                                </h5>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                                  {/* Stage 1: Self */}
                                  <div className={cn(
                                    "p-2.5 border text-xs font-bold transition-colors",
                                    currentEvaluation.isSelfSubmitted || currentEvaluation.status !== "PendingSelf"
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                      : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                                  )}>
                                    <div className="flex items-center justify-center mb-1">
                                      {currentEvaluation.isSelfSubmitted || currentEvaluation.status !== "PendingSelf" ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      ) : (
                                        <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                                      )}
                                    </div>
                                    <p className="text-[11px] font-black">{t("1. التقييم الذاتي")}</p>
                                    <p className="text-[9px] font-medium opacity-80">
                                      {currentEvaluation.isSelfSubmitted || currentEvaluation.status !== "PendingSelf"
                                        ? t("تم التقديم")
                                        : t("مطلوب إنجازه")}
                                    </p>
                                  </div>

                                  {/* Stage 2: Manager */}
                                  <div className={cn(
                                    "p-2.5 border text-xs font-bold transition-colors",
                                    currentEvaluation.isManagerSubmitted || currentEvaluation.status === "PendingApproval" || currentEvaluation.status === "Approved"
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                      : currentEvaluation.status === "PendingManager"
                                      ? "bg-violet-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300"
                                      : "bg-muted/40 border-border text-muted-foreground"
                                  )}>
                                    <div className="flex items-center justify-center mb-1">
                                      {currentEvaluation.isManagerSubmitted || currentEvaluation.status === "PendingApproval" || currentEvaluation.status === "Approved" ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      ) : currentEvaluation.status === "PendingManager" ? (
                                        <Clock className="w-4 h-4 text-violet-600 animate-pulse" />
                                      ) : (
                                        <Clock className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </div>
                                    <p className="text-[11px] font-black">{t("2. المدير المباشر")}</p>
                                    <p className="text-[9px] font-medium opacity-80">
                                      {currentEvaluation.isManagerSubmitted || currentEvaluation.status === "PendingApproval" || currentEvaluation.status === "Approved"
                                        ? t("تم التقييم")
                                        : currentEvaluation.status === "PendingManager"
                                        ? t("قيد التقييم")
                                        : t("قيد الانتظار")}
                                    </p>
                                  </div>

                                  {/* Stage 3: Higher Manager Decision */}
                                  <div className={cn(
                                    "p-2.5 border text-xs font-bold transition-colors",
                                    currentEvaluation.status === "Approved" || currentEvaluation.higherManagerDecision
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                      : currentEvaluation.status === "PendingApproval"
                                      ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300"
                                      : "bg-muted/40 border-border text-muted-foreground"
                                  )}>
                                    <div className="flex items-center justify-center mb-1">
                                      {currentEvaluation.status === "Approved" || currentEvaluation.higherManagerDecision ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      ) : currentEvaluation.status === "PendingApproval" ? (
                                        <Scale className="w-4 h-4 text-indigo-600 animate-pulse" />
                                      ) : (
                                        <Scale className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </div>
                                    <p className="text-[11px] font-black">{t("3. الرئيس الأعلى")}</p>
                                    <p className="text-[9px] font-medium opacity-80">
                                      {currentEvaluation.status === "Approved" || currentEvaluation.higherManagerDecision
                                        ? t("تم الاعتماد")
                                        : currentEvaluation.status === "PendingApproval"
                                        ? t("بانتظار القرار")
                                        : t("قيد الانتظار")}
                                    </p>
                                  </div>

                                  {/* Stage 4: Final Signoff */}
                                  <div className={cn(
                                    "p-2.5 border text-xs font-bold transition-colors",
                                    currentEvaluation.status === "Approved"
                                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                                      : "bg-muted/40 border-border text-muted-foreground"
                                  )}>
                                    <div className="flex items-center justify-center mb-1">
                                      {currentEvaluation.status === "Approved" ? (
                                        <Award className="w-4 h-4 text-emerald-600" />
                                      ) : (
                                        <Clock className="w-4 h-4 text-muted-foreground" />
                                      )}
                                    </div>
                                    <p className="text-[11px] font-black">{t("4. الاعتماد النهائي")}</p>
                                    <p className="text-[9px] font-medium opacity-80">
                                      {currentEvaluation.status === "Approved" ? t("معتمد وأُغلق") : t("قيد الإجراء")}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Call to action for PendingSelf */}
                              {currentEvaluation.status === "PendingSelf" && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                                  <div className="text-xs text-amber-800 dark:text-amber-300 font-bold">
                                    <p>{t("دورة التقييم مفتوحة لك الآن. يرجى تعبئة تقييمك الذاتي لإبراز إنجازاتك.")}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedEvalToFill(currentEvaluation);
                                      const initialRatings: Record<string, number> = {};
                                      (allCriteriaList || []).forEach((c: any) => {
                                        initialRatings[c.id] = currentEvaluation.selfScores?.[c.id] || 3;
                                      });
                                      setEvalScoresToFill(initialRatings);
                                      setEvalComments({
                                        strengths: currentEvaluation.selfStrengths || "",
                                        improvements: currentEvaluation.selfImprovements || "",
                                        recommendations: currentEvaluation.selfRecommendations || "",
                                      });
                                    }}
                                    className="px-4 py-2 bg-primary text-primary-foreground font-black text-xs rounded-none hover:bg-primary/90 whitespace-nowrap active:scale-95 transition-transform"
                                  >
                                    {t("تعبئة نموذج التقييم الذاتي")}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Criteria Ratings Breakdown */}
                          {allCriteriaList.length > 0 && (
                            <div className="space-y-3 pt-2">
                              <h5 className="text-xs font-black text-foreground flex items-center gap-2 border-b border-border pb-2">
                                <Target className="w-4 h-4 text-primary" />
                                {t("تفصيل معايير ومؤشرات تقييم الأداء")}
                              </h5>

                              <div className="space-y-2.5">
                                {allCriteriaList.map((crit: any) => {
                                  const selfScore = currentEvaluation.selfScores?.[crit.id];
                                  const managerScore = currentEvaluation.managerScores?.[crit.id];

                                  return (
                                    <div
                                      key={crit.id}
                                      className="p-3.5 bg-muted/20 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                    >
                                      <div className="space-y-1 max-w-lg">
                                        <div className="flex items-center gap-2">
                                          <p className="text-xs font-black text-foreground">
                                            {crit.nameAr || crit.name}
                                          </p>
                                          {crit.weight && (
                                            <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.2 border border-primary/20">
                                              {crit.weight}%
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                                          {crit.descriptionAr || crit.description || t("معيار تقييم الأداء")}
                                        </p>
                                      </div>

                                      <div className="flex items-center gap-4 flex-wrap">
                                        {/* Self Rating */}
                                        {selfScore !== undefined && (
                                          <div className="text-right">
                                            <span className="text-[10px] text-muted-foreground font-bold block mb-0.5">
                                              {t("تقييمي الذاتي:")}
                                            </span>
                                            <div className="flex items-center gap-1">
                                              <div className="flex gap-0.5">
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                  <Star
                                                    key={s}
                                                    className={cn(
                                                      "w-3.5 h-3.5",
                                                      s <= Number(selfScore)
                                                        ? "fill-amber-500 text-amber-500"
                                                        : "text-muted-foreground/30"
                                                    )}
                                                  />
                                                ))}
                                              </div>
                                              <span className="text-xs font-mono font-black text-foreground mr-1">
                                                {selfScore}/5
                                              </span>
                                            </div>
                                          </div>
                                        )}

                                        {/* Manager Rating */}
                                        {managerScore !== undefined && (
                                          <div className="text-right border-r border-border pr-3">
                                            <span className="text-[10px] text-muted-foreground font-bold block mb-0.5">
                                              {t("تقييم المدير:")}
                                            </span>
                                            <div className="flex items-center gap-1">
                                              <div className="flex gap-0.5">
                                                {[1, 2, 3, 4, 5].map((s) => (
                                                  <Star
                                                    key={s}
                                                    className={cn(
                                                      "w-3.5 h-3.5",
                                                      s <= Number(managerScore)
                                                        ? "fill-emerald-500 text-emerald-500"
                                                        : "text-muted-foreground/30"
                                                    )}
                                                  />
                                                ))}
                                              </div>
                                              <span className="text-xs font-mono font-black text-foreground mr-1">
                                                {managerScore}/5
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Qualitative Feedback & Comments */}
                          {(currentEvaluation.managerStrengths ||
                            currentEvaluation.managerImprovements ||
                            currentEvaluation.managerRecommendations ||
                            currentEvaluation.selfStrengths ||
                            currentEvaluation.higherManagerNotes) && (
                            <div className="space-y-3 pt-2">
                              <h5 className="text-xs font-black text-foreground flex items-center gap-2 border-b border-border pb-2">
                                <BookOpen className="w-4 h-4 text-primary" />
                                {t("المرئيات وملاحظات الأداء")}
                              </h5>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                                {/* Strengths */}
                                {(currentEvaluation.managerStrengths || currentEvaluation.selfStrengths) && (
                                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                                    <h6 className="font-extrabold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5" />
                                      {t("نقاط القوة والإنجازات البارزة")}
                                    </h6>
                                    <p className="text-foreground leading-relaxed">
                                      {currentEvaluation.managerStrengths || currentEvaluation.selfStrengths}
                                    </p>
                                  </div>
                                )}

                                {/* Improvements */}
                                {(currentEvaluation.managerImprovements || currentEvaluation.selfImprovements) && (
                                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 space-y-1.5">
                                    <h6 className="font-extrabold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                                      <Target className="w-3.5 h-3.5" />
                                      {t("مجالات التطوير المستهدفة")}
                                    </h6>
                                    <p className="text-foreground leading-relaxed">
                                      {currentEvaluation.managerImprovements || currentEvaluation.selfImprovements}
                                    </p>
                                  </div>
                                )}

                                {/* Recommendations */}
                                {currentEvaluation.managerRecommendations && (
                                  <div className="p-4 bg-blue-500/5 border border-blue-500/20 space-y-1.5 md:col-span-2">
                                    <h6 className="font-extrabold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
                                      <FileText className="w-3.5 h-3.5" />
                                      {t("توصيات الإدارة المباشرة")}
                                    </h6>
                                    <p className="text-foreground leading-relaxed">
                                      {currentEvaluation.managerRecommendations}
                                    </p>
                                  </div>
                                )}

                                {/* Higher Level Manager Decision & Notes */}
                                {currentEvaluation.higherManagerNotes && (
                                  <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 space-y-1.5 md:col-span-2">
                                    <h6 className="font-extrabold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                                      <Scale className="w-3.5 h-3.5" />
                                      {t("توجيهات وقرار الرئيس الأعلى المعتمد")}
                                    </h6>
                                    <p className="text-foreground leading-relaxed">
                                      {currentEvaluation.higherManagerNotes}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Footer Action: View Full Official Report */}
                          <div className="flex justify-end pt-3 border-t border-border">
                            <button
                              type="button"
                              onClick={() => setViewingEvaluationModal(currentEvaluation)}
                              className="px-4 py-2 border-2 border-border bg-card hover:bg-muted text-foreground font-black text-xs rounded-none flex items-center gap-2 transition-colors"
                            >
                              <Eye className="w-4 h-4 text-primary" />
                              <span>{t("عرض وطباعة التقرير الشامل للتقييم")}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <div className="p-8 bg-muted/20 border border-border text-center rounded-none font-bold space-y-3">
                    <Award className="w-10 h-10 text-muted-foreground/50 mx-auto" />
                    <h4 className="text-sm font-black text-foreground">
                      {t("لا توجد دورة تقييم نشطة مدرجة لك حالياً")}
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                      {t(
                        "سيظهر تقييم أدائك الفردي والسنوي هنا تلقائياً بمجرد إطلاق دورة التقييم الجديدة وتفعيلها من قِبل إدارة الموارد البشرية."
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Previous Evaluations Archive */}
            {activeEvalTab === "archive" && (
              <div className="space-y-4">
                {previousEvaluations.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground font-semibold">
                      {t("أرشيف التقييمات والدورات السابقة المعتمدة للموظف:")}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {previousEvaluations.map((ev: any) => {
                        const cycle = allCyclesList.find((c: any) => c.id === ev.cycleId);
                        const statusBadge = getEvalStatusBadge(ev.status);
                        const StatusIcon = statusBadge.icon;
                        const gradeInfo = getEvalGradeInfo(
                          ev.finalPercentageScore || ev.systemCalculatedScore || 0,
                          ev.finalGrade
                        );

                        return (
                          <div
                            key={ev.id}
                            className="bg-muted/15 border-2 border-border/80 p-5 rounded-none flex flex-col justify-between space-y-4 hover:border-primary transition-all"
                          >
                            <div className="space-y-3">
                              <div className="flex justify-between items-start gap-2">
                                <div>
                                  <h5 className="text-sm font-black text-foreground">
                                    {cycle?.nameAr || cycle?.name || t("دورة تقييم سابقة")}
                                  </h5>
                                  <span className="text-[10px] text-muted-foreground font-semibold">
                                    {ev.updatedAt || ev.createdAt
                                      ? new Date(ev.updatedAt || ev.createdAt).toLocaleDateString("ar-EG")
                                      : "---"}
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    "px-2.5 py-1 text-[10px] font-black border flex items-center gap-1",
                                    statusBadge.bg,
                                    statusBadge.color,
                                    statusBadge.border
                                  )}
                                >
                                  <StatusIcon className="w-3 h-3" />
                                  {statusBadge.label}
                                </span>
                              </div>

                              <div className="flex items-center justify-between bg-card p-3 border border-border">
                                <div>
                                  <span className="text-[10px] text-muted-foreground font-bold block">
                                    {t("النتيجة والتقدير:")}
                                  </span>
                                  <span className={cn("text-xs font-black", gradeInfo.color)}>
                                    {gradeInfo.label}
                                  </span>
                                </div>
                                <span className="text-xl font-mono font-black text-foreground">
                                  {ev.finalPercentageScore || ev.systemCalculatedScore || 0}%
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setViewingEvaluationModal(ev)}
                              className="w-full py-2 bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary border border-primary/20 font-black text-xs rounded-none transition-colors flex items-center justify-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t("عرض التقرير المفصل")}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 bg-muted/20 border border-border text-center rounded-none font-bold space-y-3">
                    <History className="w-10 h-10 text-muted-foreground/50 mx-auto" />
                    <h4 className="text-sm font-black text-foreground">
                      {t("لا توجد تقييمات سابقة مؤرشفة حتى الآن")}
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                      {t(
                        "عند اكتمال واعتماد دورات التقييم الحالية، ستتم أرشفتها هنا لتتمكن من الرجوع إلى نتائجك ومقارنة تطورك المهني عبر السنوات."
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Career Development Plan */}
            {activeEvalTab === "plan" && (
              <div className="space-y-4">
                {currentDevPlan ? (
                  <div className="space-y-4">
                    {/* Overall Plan Progress */}
                    <div className="p-4 bg-muted/25 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                          <Target className="w-4 h-4 text-primary" />
                          {t("خطة التطوير والنمو المهني الفردية (IDP)")}
                        </h4>
                        <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                          {t("خطة أهداف مخصصة تم إعدادها بالتعاون مع الإدارة المباشرة")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-32 bg-muted h-2.5 overflow-hidden border border-border">
                          <div
                            className="bg-primary h-full transition-all duration-500"
                            style={{ width: `${currentDevPlan.progressPercentage || 0}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono font-black text-primary">
                          {currentDevPlan.progressPercentage || 0}%
                        </span>
                      </div>
                    </div>

                    {/* SMART Objectives */}
                    {Array.isArray(currentDevPlan.smartObjectives) && currentDevPlan.smartObjectives.length > 0 && (
                      <div className="space-y-2.5">
                        <h5 className="text-xs font-black text-foreground uppercase tracking-wider">
                          {t("الأهداف الذكية المستهدفة (SMART Objectives)")}
                        </h5>
                        <div className="space-y-2">
                          {currentDevPlan.smartObjectives.map((obj: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-3 bg-muted/15 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold text-foreground">
                                  {obj.objective || obj.title || obj.name || t("هدف تطويري")}
                                </p>
                                {obj.deadline && (
                                  <span className="text-[10px] text-muted-foreground font-semibold">
                                    {t("الموعد المستهدف:")} {obj.deadline}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono font-black text-foreground">
                                  {obj.progress || 0}%
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recommended Training Courses */}
                    {Array.isArray(currentDevPlan.trainingCourses) && currentDevPlan.trainingCourses.length > 0 && (
                      <div className="space-y-2.5 pt-2">
                        <h5 className="text-xs font-black text-foreground uppercase tracking-wider">
                          {t("الدورات والبرامج التدريبية الموصى بها")}
                        </h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {currentDevPlan.trainingCourses.map((c: any, idx: number) => (
                            <div
                              key={idx}
                              className="p-3 bg-muted/15 border border-border flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-indigo-500" />
                                <span className="text-xs font-bold text-foreground">
                                  {typeof c === "string" ? c : c.courseName || c.name}
                                </span>
                              </div>
                              <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 px-2 py-0.5">
                                {typeof c === "object" && c.status ? c.status : t("موصى به")}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 bg-muted/20 border border-border text-center rounded-none font-bold space-y-3">
                    <Target className="w-10 h-10 text-muted-foreground/50 mx-auto" />
                    <h4 className="text-sm font-black text-foreground">
                      {t("لا توجد خطة تطوير مهني مسجلة حالياً")}
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                      {t(
                        "سيتم إعداد وتحديد خطة النمو والتدريب المهني الفردية (IDP) تلقائياً استناداً إلى نتائج وتوصيات دورة تقييم الأداء."
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Self-Evaluation Form Modal */}
      {selectedEvalToFill && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-colors duration-300">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8 rounded-none shadow-2xl relative text-right border border-border"
            dir="rtl"
          >
            <button
              onClick={() => setSelectedEvalToFill(null)}
              className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors outline-none"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 mb-6 border-b border-border pb-4">
              <Award className="w-6 h-6 text-primary" />
              <div>
                <h3 className="text-xl font-black text-foreground">
                  {t("نموذج التقييم الذاتي السنوي لمنتسبي الخدمة")}
                </h3>
                <p className="text-xs text-muted-foreground font-semibold">
                  {(cycles || []).find(
                    (c) => c.id === selectedEvalToFill.cycleId,
                  )?.nameAr || t("الدورة الحالية المفتوحة")}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Appraisal Guidelines Alert Info */}
              <div className="p-4 bg-primary/5 text-primary border border-primary/20 text-xs font-bold leading-relaxed space-y-1">
                <p>
                  {t(
                    "المعايير المحددة أدناه ترتكز على نظام تقييم الأداء والنمو المهني المتكامل.",
                  )}
                </p>
                <p>
                  {t(
                    "يرجى تقييم أدائك الفعلي بكل موضوعية (من 1 إلى 5 نجوم). علمًا بأن تقييماتك تساهم بشكل رئيسي في التوافق والتطوير.",
                  )}
                </p>
              </div>

              {/* Criteria evaluations */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-xs text-foreground uppercase tracking-widest border-r-2 border-primary pr-2">
                  {t("المعايير التقيمية ومؤشرات الإنجاز")}
                </h4>
                <div className="space-y-3.5">
                  {(criteria || []).length > 0 ? (
                    (criteria || []).map((crit) => (
                      <div
                        key={crit.id}
                        className="p-4 bg-muted/20 border border-border space-y-3 rounded-none"
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-0.5">
                            <p className="text-sm font-black text-foreground">
                              {crit.nameAr || crit.name}
                            </p>
                            <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                              {crit.descriptionAr ||
                                crit.description ||
                                t("لا يوجد وصف للمعيار")}
                            </p>
                          </div>
                          <div className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 whitespace-nowrap">
                            {t("الوزن:")} {crit.weight}%
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                          <span className="text-xs font-bold text-muted-foreground">
                            {t("التقييم الذاتي:")}
                          </span>
                          <div className="flex gap-1.5 direction-ltr">
                            {[1, 2, 3, 4, 5].map((star) => {
                              const curRating = evalScoresToFill[crit.id] || 3;
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() =>
                                    setEvalScoresToFill({
                                      ...evalScoresToFill,
                                      [crit.id]: star,
                                    })
                                  }
                                  className="text-amber-500 hover:scale-125 transition-transform p-0.5 outline-none"
                                >
                                  <Star
                                    className={cn(
                                      "w-5 h-5",
                                      star <= curRating
                                        ? "fill-amber-500 stroke-amber-500"
                                        : "text-muted-foreground stroke-muted/65",
                                    )}
                                  />
                                </button>
                              );
                            })}
                          </div>
                          <span className="text-xs font-black text-amber-600 mr-2">
                            ({evalScoresToFill[crit.id] || 3} / 5)
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {t("لم يتم إعداد أي معايير تقييم حالية في لوحة القيادة.")}
                    </p>
                  )}
                </div>
              </div>

              {/* Strengths and comments inputs */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h4 className="font-extrabold text-xs text-foreground uppercase tracking-widest border-r-2 border-primary pr-2">
                  {t("المرئيات وخطط النمو المهني")}
                </h4>

                <div className="space-y-3">
                  <div className="space-y-1.5 text-right">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                      {t("مواطن القوة وأبرز الإنجازات (التقييم الذاتي)")}
                    </label>
                    <textarea
                      className="w-full p-3 bg-muted/25 border border-border text-xs text-foreground font-semibold placeholder:text-muted-foreground/50 rounded-none focus:outline-none focus:ring-2 focus:ring-primary h-20"
                      placeholder={t(
                        "اكتب هنا أهم الإنجازات التي حققتها والمهام التي أبدعت فيها...",
                      )}
                      value={evalComments.strengths}
                      onChange={(e) =>
                        setEvalComments({
                          ...evalComments,
                          strengths: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5 text-right">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                      {t("مجالات التحسين والتطوير المهني المستهدفة")}
                    </label>
                    <textarea
                      className="w-full p-3 bg-muted/25 border border-border text-xs text-foreground font-semibold placeholder:text-muted-foreground/50 rounded-none focus:outline-none focus:ring-2 focus:ring-primary h-20"
                      placeholder={t(
                        "اكتب أفكارك حول المهارات التي ترغب في صقلها والدعم المهني الذي تطلبه...",
                      )}
                      value={evalComments.improvements}
                      onChange={(e) =>
                        setEvalComments({
                          ...evalComments,
                          improvements: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-1.5 text-right">
                    <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                      {t("توصيات وملاحظات عامة لشركاء العمل الإداري")}
                    </label>
                    <textarea
                      className="w-full p-3 bg-muted/25 border border-border text-xs text-foreground font-semibold placeholder:text-muted-foreground/50 rounded-none focus:outline-none focus:ring-2 focus:ring-primary h-20"
                      placeholder={t(
                        "أي ملاحظات أو توصيات أخرى ترغب في مشاركتها...",
                      )}
                      value={evalComments.recommendations}
                      onChange={(e) =>
                        setEvalComments({
                          ...evalComments,
                          recommendations: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setSelectedEvalToFill(null)}
                  className="py-3 px-6 border-2 border-border text-[11px] font-black uppercase text-muted-foreground tracking-widest hover:bg-muted transition-colors rounded-none outline-none"
                >
                  {t("إلغاء")}
                </button>
                <button
                  type="button"
                  disabled={isSubmittingEval}
                  onClick={handleSubmitSelfEvaluation}
                  className="py-3 px-8 bg-primary hover:bg-primary/95 font-black text-[11px] text-primary-foreground uppercase tracking-widest rounded-none hover:shadow-lg transition-all flex items-center gap-2 outline-none disabled:opacity-50"
                >
                  {isSubmittingEval
                    ? t("جاري الإرسال...")
                    : t("تقديم التقييم الذاتي")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Full Performance Appraisal Report Modal */}
      {viewingEvaluationModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 md:p-8 rounded-none shadow-2xl relative text-right border-2 border-border"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Award className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-foreground">
                    {t("تقرير الأداء والتقييم السنوي الشامل")}
                  </h3>
                  <p className="text-xs text-muted-foreground font-semibold">
                    {allCyclesList.find((c: any) => c.id === viewingEvaluationModal.cycleId)?.nameAr ||
                      allCyclesList.find((c: any) => c.id === viewingEvaluationModal.cycleId)?.name ||
                      t("تقرير تقييم الأداء المعتمد")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 border border-border bg-muted/40 hover:bg-muted text-xs font-bold flex items-center gap-1 text-foreground"
                >
                  <Printer className="w-3.5 h-3.5 text-primary" />
                  <span>{t("طباعة")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingEvaluationModal(null)}
                  className="text-muted-foreground hover:text-foreground p-1 transition-colors outline-none"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content of the report */}
            <div className="space-y-6 text-foreground">
              {/* Employee & Cycle metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-4 border border-border text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground font-bold block">{t("اسم الموظف:")}</span>
                  <span className="font-extrabold">{currentEmpObject?.name || (profile as any)?.name || user?.displayName || "---"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground font-bold block">{t("الرقم الوظيفي:")}</span>
                  <span className="font-mono font-bold">{currentEmployeeId || "---"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground font-bold block">{t("حالة التقييم:")}</span>
                  <span className="font-bold">{getEvalStatusBadge(viewingEvaluationModal.status).label}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground font-bold block">{t("تاريخ الاعتماد / الإصدار:")}</span>
                  <span className="font-semibold">
                    {viewingEvaluationModal.updatedAt
                      ? new Date(viewingEvaluationModal.updatedAt).toLocaleDateString("ar-EG")
                      : "---"}
                  </span>
                </div>
              </div>

              {/* Scorecard Hero Banner */}
              {(() => {
                const gradeInfo = getEvalGradeInfo(
                  viewingEvaluationModal.finalPercentageScore || viewingEvaluationModal.systemCalculatedScore || 0,
                  viewingEvaluationModal.finalGrade
                );
                return (
                  <div className="p-6 bg-primary/5 border-2 border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 text-center sm:text-right">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        {t("النتيجة المعتمدة والتقدير النهائي")}
                      </span>
                      <div className="flex items-center gap-3 justify-center sm:justify-start">
                        <span className="text-4xl font-mono font-black text-primary">
                          {viewingEvaluationModal.finalPercentageScore || viewingEvaluationModal.systemCalculatedScore || 0}%
                        </span>
                        <span className={cn("px-3 py-1 font-black text-xs border", gradeInfo.bg, gradeInfo.color, gradeInfo.border)}>
                          {gradeInfo.label}
                        </span>
                      </div>
                      {viewingEvaluationModal.decisionSource && (
                        <p className="text-xs text-muted-foreground font-semibold">
                          {viewingEvaluationModal.decisionSource === "HigherManagerCustom"
                            ? t("تم اعتماد النتيجة بقرار وتعديل مخصص من الرئيس الأعلى")
                            : viewingEvaluationModal.decisionSource === "Manager"
                            ? t("تم اعتماد نتيجة تقييم المدير المباشر")
                            : t("تم اعتماد نتيجة النظام التلقائية المبنية على المعايير")}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center text-xs">
                      <div className="p-3 bg-card border border-border">
                        <span className="text-[10px] text-muted-foreground font-bold block">{t("التقييم الذاتي")}</span>
                        <span className="text-base font-mono font-black">{viewingEvaluationModal.selfPercentageScore || 0}%</span>
                      </div>
                      <div className="p-3 bg-card border border-border">
                        <span className="text-[10px] text-muted-foreground font-bold block">{t("تقييم المدير")}</span>
                        <span className="text-base font-mono font-black">{viewingEvaluationModal.managerPercentageScore || 0}%</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Criteria Score Table */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-foreground border-r-2 border-primary pr-2">
                  {t("تفاصيل المعايير والمؤشرات التفصيلية")}
                </h4>
                <div className="border border-border overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead className="bg-muted/50 text-foreground font-black border-b border-border">
                      <tr>
                        <th className="p-3">{t("المعيار / الكفاءة")}</th>
                        <th className="p-3 text-center">{t("الوزن")}</th>
                        <th className="p-3 text-center">{t("التقييم الذاتي")}</th>
                        <th className="p-3 text-center">{t("تقييم المدير")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {allCriteriaList.map((crit: any) => (
                        <tr key={crit.id} className="hover:bg-muted/20">
                          <td className="p-3">
                            <p className="font-bold text-foreground">{crit.nameAr || crit.name}</p>
                            <p className="text-[10px] text-muted-foreground">{crit.descriptionAr || crit.description}</p>
                          </td>
                          <td className="p-3 text-center font-mono font-bold">{crit.weight ? `${crit.weight}%` : "---"}</td>
                          <td className="p-3 text-center font-mono font-bold">
                            {viewingEvaluationModal.selfScores?.[crit.id] !== undefined
                              ? `${viewingEvaluationModal.selfScores[crit.id]}/5`
                              : "---"}
                          </td>
                          <td className="p-3 text-center font-mono font-bold">
                            {viewingEvaluationModal.managerScores?.[crit.id] !== undefined
                              ? `${viewingEvaluationModal.managerScores[crit.id]}/5`
                              : "---"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Feedback notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
                {viewingEvaluationModal.managerStrengths && (
                  <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                    <h5 className="font-extrabold text-emerald-700 dark:text-emerald-400">{t("نقاط القوة والإشادة:")}</h5>
                    <p className="text-foreground leading-relaxed">{viewingEvaluationModal.managerStrengths}</p>
                  </div>
                )}
                {viewingEvaluationModal.managerImprovements && (
                  <div className="p-4 bg-amber-500/5 border border-amber-500/20 space-y-1">
                    <h5 className="font-extrabold text-amber-700 dark:text-amber-400">{t("مجالات التحسين والتطوير:")}</h5>
                    <p className="text-foreground leading-relaxed">{viewingEvaluationModal.managerImprovements}</p>
                  </div>
                )}
                {viewingEvaluationModal.managerRecommendations && (
                  <div className="p-4 bg-blue-500/5 border border-blue-500/20 space-y-1 md:col-span-2">
                    <h5 className="font-extrabold text-blue-700 dark:text-blue-400">{t("توصيات الإدارة المباشرة:")}</h5>
                    <p className="text-foreground leading-relaxed">{viewingEvaluationModal.managerRecommendations}</p>
                  </div>
                )}
                {viewingEvaluationModal.higherManagerNotes && (
                  <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 space-y-1 md:col-span-2">
                    <h5 className="font-extrabold text-indigo-700 dark:text-indigo-400">{t("قرار وتوجيهات الرئيس الأعلى:")}</h5>
                    <p className="text-foreground leading-relaxed">{viewingEvaluationModal.higherManagerNotes}</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setViewingEvaluationModal(null)}
                  className="px-6 py-2.5 bg-primary text-primary-foreground font-black text-xs rounded-none hover:bg-primary/90 outline-none"
                >
                  {t("إغلاق")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Leave Request Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-colors duration-300">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-lg p-8 rounded-none shadow-2xl relative text-right border border-border"
            dir="rtl"
          >
            <button
              onClick={() => setIsLeaveModalOpen(false)}
              className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors outline-none"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-black text-foreground mb-6">
              {t("طلب إجازة جديد")}
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">
                  {t("نوع الإجازة")}
                </label>
                <select
                  className="w-full p-4 bg-muted/30 border border-border rounded-none outline-none font-bold text-foreground focus:ring-2 focus:ring-primary"
                  value={requestItem.type || ""}
                  onChange={(e) =>
                    setRequestItem({ ...requestItem, type: e.target.value })
                  }
                >
                  <option value="Annual" className="bg-card">
                    {t("إجازة اعتيادية (سنوية)")}
                  </option>
                  <option value="Sick" className="bg-card">
                    {t("إجازة مرضية")}
                  </option>
                  <option value="Unpaid" className="bg-card">
                    {t("بدون راتب")}
                  </option>
                  <option value="Permission" className="bg-card">
                    {t("تصريح (إذن)")}
                  </option>
                </select>
              </div>
              {requestItem.type === "Annual" && dashboardEmployeeInfo && (
                <div className="p-4 bg-card border-2 border-primary/20 rounded-none text-right text-xs text-foreground space-y-2 font-semibold">
                  <p className="font-black text-xs text-primary pb-1 border-b border-border/60">
                    {t("📊 رصيد الإجازة الاعتيادية الخاص بك:")}
                  </p>
                  <div className="flex justify-between items-center text-[10px] sm:text-[11px] bg-muted/35 p-1.5 border border-border/40">
                    <span className="text-muted-foreground">
                      {t("1. الرصيد الإجمالي المستحق:")}
                    </span>
                    <span className="font-extrabold text-foreground">
                      {dashboardEmployeeInfo.entitled} يوم
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] sm:text-[11px] bg-blue-500/5 p-1.5 border border-blue-500/10">
                    <span className="text-blue-700 dark:text-blue-300 font-extrabold">
                      {t("2. الأيام المطلوبة حالياً:")}
                    </span>
                    <span className="font-extrabold text-blue-600">
                      {dashboardEmployeeInfo.requested} يوم
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] sm:text-[11px] bg-red-500/5 p-1.5 border border-red-500/10">
                    <span className="text-red-700 dark:text-red-300 font-bold">
                      {t("3. المستهلك المعتمد سابقاً:")}
                    </span>
                    <span className="font-extrabold text-red-600">
                      {dashboardEmployeeInfo.consumed} يوم
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 p-2 border border-emerald-500/25">
                    <span className="font-black">
                      {t("4. الصافي المتبقي المتاح:")}
                    </span>
                    <span
                      className={cn(
                        "font-black text-xs px-1.5 py-0.5 rounded",
                        dashboardEmployeeInfo.remaining >= 0
                          ? "text-emerald-600 font-extrabold"
                          : "text-destructive font-extrabold bg-destructive/10 animate-pulse",
                      )}
                    >
                      {dashboardEmployeeInfo.remaining} يوم
                    </span>
                  </div>
                </div>
              )}

              {requestItem.type === "Sick" && dashboardEmployeeSickInfo && (
                <div className="p-4 bg-card border-2 border-blue-500/30 rounded-none text-right text-xs text-foreground space-y-2 font-semibold">
                  <div className="flex items-center justify-between pb-1 border-b border-border/60">
                    <p className="font-black text-xs text-blue-600 flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5 text-blue-600" />
                      {t("🩺 رصيد الإجازة المرضية السنوي الخاص بك:")}
                    </p>
                    <span className="text-[10px] text-muted-foreground">{t("تجديد سنوي")}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] sm:text-[11px] bg-muted/35 p-1.5 border border-border/40">
                    <span className="text-muted-foreground">
                      {t("1. الرصيد الإجمالي المستحق:")}
                    </span>
                    <span className="font-extrabold text-foreground">
                      {dashboardEmployeeSickInfo.entitled} يوم
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] sm:text-[11px] bg-blue-500/5 p-1.5 border border-blue-500/10">
                    <span className="text-blue-700 dark:text-blue-300 font-extrabold">
                      {t("2. الأيام المطلوبة حالياً:")}
                    </span>
                    <span className="font-extrabold text-blue-600">
                      {dashboardEmployeeSickInfo.requested} يوم
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] sm:text-[11px] bg-red-500/5 p-1.5 border border-red-500/10">
                    <span className="text-red-700 dark:text-red-300 font-bold">
                      {t("3. المستهلك المعتمد سابقاً:")}
                    </span>
                    <span className="font-extrabold text-red-600">
                      {dashboardEmployeeSickInfo.consumed} يوم
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 p-2 border border-emerald-500/25">
                    <span className="font-black">
                      {t("4. الصافي المتبقي المتاح:")}
                    </span>
                    <span
                      className={cn(
                        "font-black text-xs px-1.5 py-0.5 rounded",
                        dashboardEmployeeSickInfo.remaining >= 0
                          ? "text-emerald-600 font-extrabold"
                          : "text-destructive font-extrabold bg-destructive/10 animate-pulse",
                      )}
                    >
                      {dashboardEmployeeSickInfo.remaining} يوم
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground pt-1">
                    {t("ℹ️ الإجازة المرضية المعتمدة تخصم من الرصيد المرضي فقط ولا تخصم من الاعتيادي.")}
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">
                    {t("من تاريخ")}
                  </label>
                  <input
                    type="date"
                    className="w-full p-4 bg-muted/30 border border-border rounded-none outline-none font-bold text-foreground focus:ring-2 focus:ring-primary"
                    value={requestItem.startDate}
                    onChange={(e) =>
                      setRequestItem({
                        ...requestItem,
                        startDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">
                    {t("إلى تاريخ")}
                  </label>
                  <input
                    type="date"
                    className="w-full p-4 bg-muted/30 border border-border rounded-none outline-none font-bold text-foreground focus:ring-2 focus:ring-primary"
                    value={requestItem.endDate}
                    onChange={(e) =>
                      setRequestItem({
                        ...requestItem,
                        endDate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">
                  {t("السبب")}
                </label>
                <textarea
                  className="w-full p-4 bg-muted/30 border border-border rounded-none outline-none font-bold h-24 text-foreground focus:ring-2 focus:ring-primary resize-none placeholder:text-muted-foreground/50"
                  placeholder={t("اذكر سبب طلب الإجازة...")}
                  value={requestItem.reason}
                  onChange={(e) =>
                    setRequestItem({ ...requestItem, reason: e.target.value })
                  }
                />
              </div>
              <button
                onClick={() => handleCreateRequest("leave-requests")}
                className="w-full py-4 bg-primary text-primary-foreground font-black rounded-none shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
              >
                {t("إرسال الطلب")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Mission Request Modal */}
      {isMissionModalOpen &&
        (() => {
          const availableProjects =
            projects && projects.length > 0
              ? projects
              : dashboardData?.projects || [];
          const availableTypes =
            missionTypes && missionTypes.length > 0
              ? missionTypes
              : dashboardData?.missionTypes || [];

          const linkedType = requestItem.projectId
            ? availableTypes.find(
                (mt: any) =>
                  Array.isArray(mt.projectIds) &&
                  mt.projectIds.includes(requestItem.projectId),
              )
            : null;

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-colors duration-300">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-card w-full max-w-lg rounded-none shadow-2xl relative text-right border border-border flex flex-col max-h-[90vh] overflow-hidden"
                dir="rtl"
              >
                <div className="p-6 border-b border-border bg-muted/30 flex items-center justify-between shrink-0">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-foreground">
                      {t("طلب مأمورية جديد")}
                    </h3>
                    <p className="text-xs text-muted-foreground font-bold mt-1">
                      {t("اختر المشروع المرتبط بالمأمورية، أو قدم مأمورية عامة.")}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsMissionModalOpen(false)}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none cursor-pointer"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 sm:p-8 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">
                      {t("تحديد المشروع")}
                    </label>
                    <select
                      className="w-full p-4 bg-muted/30 border border-border rounded-none outline-none font-bold text-foreground focus:ring-2 focus:ring-primary"
                      value={requestItem.projectId || ""}
                      onChange={(e) => {
                        const pId = e.target.value;
                        const foundLinkedType = pId
                          ? availableTypes.find(
                              (mt: any) =>
                                Array.isArray(mt.projectIds) &&
                                mt.projectIds.includes(pId),
                            )
                          : null;
                        setRequestItem({
                          ...requestItem,
                          projectId: pId,
                          missionTypeId: foundLinkedType
                            ? foundLinkedType.id
                            : "",
                        });
                      }}
                    >
                      <option
                        value=""
                        className="bg-card font-black text-primary"
                      >
                        {t("مأمورية عامة (ليست على مشروع)")}
                      </option>
                      {availableProjects.map((p: any) => (
                        <option key={p.id} value={p.id} className="bg-card">
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Auto-detected or General Mission Type Status Box */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">
                      {t("تصنيف المأمورية والتكاليف")}
                    </label>
                    <div className="p-4 bg-muted/20 border border-border/80 rounded-none space-y-1">
                      {linkedType ? (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-black text-primary block">
                              {linkedType.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {t(
                                "تم الربط التلقائي بمصفوفة تكاليف هذا المشروع",
                              )}
                            </span>
                          </div>
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                            {t("مربوط تلقائياً")}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-black text-foreground block">
                              {t("مأمورية عامة (خارج مصفوفة المشاريع)")}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {t(
                                "يمكن لمسؤول HR إضافة التكاليف والبدلات لاحقاً بعد موافقة المدير المباشر",
                              )}
                            </span>
                          </div>
                          <span className="px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                            {t("عامة / بدون ربط")}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">
                        {t("من تاريخ")}
                      </label>
                      <input
                        type="date"
                        className="w-full p-4 bg-muted/30 border border-border rounded-none outline-none font-bold text-foreground focus:ring-2 focus:ring-primary"
                        value={requestItem.startDate}
                        onChange={(e) =>
                          setRequestItem({
                            ...requestItem,
                            startDate: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">
                        {t("إلى تاريخ")}
                      </label>
                      <input
                        type="date"
                        className="w-full p-4 bg-muted/30 border border-border rounded-none outline-none font-bold text-foreground focus:ring-2 focus:ring-primary"
                        value={requestItem.endDate}
                        onChange={(e) =>
                          setRequestItem({
                            ...requestItem,
                            endDate: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">
                      {t("الملاحظات والبيانات التنفيذية")}
                    </label>
                    <textarea
                      className="w-full p-4 bg-muted/30 border border-border rounded-none outline-none font-bold h-24 text-foreground focus:ring-2 focus:ring-primary resize-none placeholder:text-muted-foreground/50"
                      placeholder={t(
                        "وصف المأمورية أو الموقع المقصود بالتفصيل...",
                      )}
                      value={requestItem.reason}
                      onChange={(e) =>
                        setRequestItem({
                          ...requestItem,
                          reason: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="p-4 sm:p-6 border-t border-border bg-muted/20 flex gap-4 shrink-0 mt-auto">
                  <button
                    onClick={() => handleCreateRequest("mission-requests")}
                    className="flex-1 py-3.5 sm:py-4 bg-primary text-primary-foreground font-black rounded-none shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 cursor-pointer"
                  >
                    {t("إرسال الطلب")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMissionModalOpen(false)}
                    className="flex-1 py-3.5 sm:py-4 bg-muted hover:bg-muted/80 text-muted-foreground font-black rounded-none transition-colors cursor-pointer"
                  >
                    {t("إلغاء")}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
       {/* Details Lists Popup for Requests Summary */}
      {detailsPopupType && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-colors duration-300">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-4xl p-8 rounded-none shadow-2xl relative text-right border-2 border-border max-h-[90vh] flex flex-col"
            dir="rtl"
          >
            <button
              onClick={() => {
                setDetailsPopupType(null);
                setPopupStatusFilter("all");
              }}
              className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>

            {/* Dynamic Heading Based on Category */}
            <div className="flex items-center gap-3 mb-4 border-b border-border/80 pb-4 shrink-0">
              <div
                className={cn(
                  "w-10 h-10 rounded-none flex items-center justify-center",
                  detailsPopupType.includes("Leaves")
                    ? "bg-orange-500/10 text-orange-600"
                    : detailsPopupType.includes("Wfh")
                      ? "bg-pink-500/10 text-pink-600"
                      : "bg-indigo-500/10 text-indigo-600",
                )}
              >
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-foreground">
                  {detailsPopupType === "pendingLeaves" &&
                    t("تفاصيل طلبات الإجازات المعلقة (بانتظار الموافقة)")}
                  {detailsPopupType === "approvedLeaves" &&
                    t("سجل الإجازات المعتمدة والنشطة")}
                  {detailsPopupType === "rejectedLeaves" &&
                    t("سجل طلبات الإجازات المرفوضة وأسباب الرفض")}
                  {detailsPopupType === "allLeaves" &&
                    t("سجل كافة طلبات الإجازات")}
                  {detailsPopupType === "pendingMissions" &&
                    t("تفاصيل طلبات المأموريات المعلقة")}
                  {detailsPopupType === "approvedMissions" &&
                    t("سجل المأموريات الرسمية المعتمدة")}
                  {detailsPopupType === "rejectedMissions" &&
                    t("سجل طلبات المأموريات المرفوضة")}
                  {detailsPopupType === "allMissions" &&
                    t("سجل كافة مأموريات العمل")}
                  {detailsPopupType === "pendingWfh" &&
                    t("تفاصيل تصاريح العمل عن بعد المعلقة")}
                  {detailsPopupType === "approvedWfh" &&
                    t("سجل تصاريح العمل عن بعد المعتمدة")}
                  {detailsPopupType === "rejectedWfh" &&
                    t("سجل تصاريح العمل عن بعد المرفوضة")}
                  {detailsPopupType === "allWfh" &&
                    t("سجل كافة تصاريح العمل عن بعد")}
                </h3>
                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
                  {t("مزامنة فورية لحالة الطلبات والقرارات الإدارية للموظف")}
                </p>
              </div>
            </div>

            {/* Inner Details Content */}
            <div className="space-y-4 overflow-hidden flex flex-col flex-1">
              {/* Filter Tabs for quick navigation inside popup */}
              <div className="flex gap-2 border-b border-border/60 pb-2 shrink-0">
                {[
                  { id: "all", label: t("جميع الحالات") },
                  { id: "pending", label: t("قيد الانتظار (معلقة)") },
                  { id: "approved", label: t("معتمدة") },
                  { id: "rejected", label: t("مرفوضة") },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setPopupStatusFilter(tab.id as any)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-black rounded-none border transition-all cursor-pointer",
                      popupStatusFilter === tab.id
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted border-border",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="overflow-y-auto border border-border flex-1">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-border text-[9px] font-black text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                      <th className="py-3 px-4 bg-muted text-right">
                        {t("التاريخ والمدة")}
                      </th>
                      <th className="py-3 px-4 bg-muted text-right">
                        {t("نوع المعاملة / الجهة")}
                      </th>
                      <th className="py-3 px-4 bg-muted text-right">
                        {t("السبب والملاحظات")}
                      </th>
                      <th className="py-3 px-4 text-center bg-muted">
                        {t("حالة الطلب")}
                      </th>
                      {(detailsPopupType.includes("Missions")) && (
                        <th className="py-3 px-4 text-center bg-muted">
                          {t("تقييم المدير")}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const isMatchingMyEmp = (item: any) => {
                        const eId = String(item.employeeId || '').trim().toLowerCase();
                        const uId = String(item.userId || '').trim().toLowerCase();
                        const mail = String(item.email || item.userEmail || '').trim().toLowerCase();
                        return (
                          currentEmpIdentifiers.includes(eId) ||
                          (uId && currentEmpIdentifiers.includes(uId)) ||
                          (mail && currentEmpIdentifiers.includes(mail)) ||
                          eId === String(currentEmployeeId).trim().toLowerCase()
                        );
                      };

                      const popupLeaveRequests = (
                        leaveRequests && leaveRequests.length > 0
                          ? leaveRequests
                          : dashboardData?.leaveRequests || []
                      ).filter(isMatchingMyEmp);

                      const popupMissions = (
                        missions && missions.length > 0
                          ? missions
                          : dashboardData?.missions || []
                      ).filter(isMatchingMyEmp);

                      let baseList: any[] = [];
                      const isLeaves = detailsPopupType.includes("Leaves");
                      const isWfh = detailsPopupType.includes("Wfh");
                      const isMissions = detailsPopupType.includes("Missions");

                      if (isLeaves) {
                        baseList = popupLeaveRequests.filter((item) => item.type !== "WorkFromHome");
                      } else if (isWfh) {
                        baseList = popupLeaveRequests.filter((item) => item.type === "WorkFromHome");
                      } else if (isMissions) {
                        baseList = popupMissions;
                      }

                      // Apply active tab filter
                      let filteredItems = baseList;
                      if (popupStatusFilter === "pending") {
                        filteredItems = baseList.filter((item) => isPendingStatus(item.status));
                      } else if (popupStatusFilter === "approved") {
                        filteredItems = baseList.filter(
                          (item) => isApprovedStatus(item.status) || isCompletedStatus(item.status),
                        );
                      } else if (popupStatusFilter === "rejected") {
                        filteredItems = baseList.filter((item) => isRejectedStatus(item.status));
                      } else if (popupStatusFilter === "all") {
                        // If initial opened popup had a specific category and user hasn't switched filter
                        if (detailsPopupType === "pendingLeaves" || detailsPopupType === "pendingMissions" || detailsPopupType === "pendingWfh") {
                          filteredItems = baseList.filter((item) => isPendingStatus(item.status));
                        } else if (detailsPopupType === "approvedLeaves" || detailsPopupType === "approvedMissions" || detailsPopupType === "approvedWfh") {
                          filteredItems = baseList.filter(
                            (item) => isApprovedStatus(item.status) || isCompletedStatus(item.status),
                          );
                        } else if (detailsPopupType === "rejectedLeaves" || detailsPopupType === "rejectedMissions" || detailsPopupType === "rejectedWfh") {
                          filteredItems = baseList.filter((item) => isRejectedStatus(item.status));
                        }
                      }

                      if (filteredItems.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={5}
                              className="text-center py-16 text-muted-foreground font-black italic text-xs font-sans"
                            >
                              {t(
                                "لا توجد أي معاملات مسجلة تطابق التصفية الحالية.",
                              )}
                            </td>
                          </tr>
                        );
                      }

                      return filteredItems.map((item) => {
                        const startStr = item.startDate || "---";
                        const endStr = item.endDate || "---";
                        const isRejected = isRejectedStatus(item.status);
                        const isApproved = isApprovedStatus(item.status) || isCompletedStatus(item.status);
                        const isPending = isPendingStatus(item.status);

                        // Determine readable type
                        let displayType = t("مأمورية رسمية");
                        if (isLeaves || isWfh) {
                          if (item.type === "Annual")
                            displayType = t("إجازة اعتيادية (سنوية)");
                          else if (item.type === "Sick")
                            displayType = t("إجازة مرضية");
                          else if (item.type === "Unpaid")
                            displayType = t("إجازة بدون راتب");
                          else if (item.type === "Permission")
                            displayType = t("تصريح خروج (إذن)");
                          else if (item.type === "WorkFromHome")
                            displayType = t("إذن عمل عن بعد");
                          else displayType = `إجازة ${item.type || ""}`;
                        } else {
                          const linkedProj = (
                            dashboardData?.projects || []
                          ).find((p: any) => p.id === item.projectId)?.name;
                          displayType = linkedProj
                            ? `مأمورية: ${linkedProj}`
                            : t("مأمورية عمل رسمية");
                        }

                        let evalObj: any = null;
                        if (item.evaluation) {
                          try {
                            evalObj =
                              typeof item.evaluation === "string"
                                ? JSON.parse(item.evaluation)
                                : item.evaluation;
                          } catch (e) {}
                        }

                        const rejectionReason =
                          item.reviewNote ||
                          item.managerReviewNote ||
                          item.rejectionReason ||
                          "";

                        return (
                          <tr
                            key={item.id}
                            className={cn(
                              "border-b border-border/60 text-xs font-bold transition-colors",
                              isRejected
                                ? "bg-rose-500/5 hover:bg-rose-500/10"
                                : "hover:bg-muted/10",
                            )}
                          >
                            <td className="py-4 px-4 text-right">
                              <div className="flex flex-col gap-1">
                                <span className="font-mono text-[10px] text-foreground font-bold">
                                  من: {startStr}
                                </span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  إلى: {endStr}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right text-foreground text-xs leading-normal">
                              <span className="font-black">{displayType}</span>
                              {item.daysCount && (
                                <span className="mr-2 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 border border-border">
                                  {item.daysCount} {t("أيام")}
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right text-[11px] leading-relaxed max-w-[280px]">
                              <div className="text-muted-foreground truncate" title={item.reason || item.notes}>
                                {item.reason || item.notes || t("لا توجد ملاحظات مرفقة")}
                              </div>
                              {isRejected && rejectionReason && (
                                <div className="mt-1.5 p-1.5 bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[10px] font-extrabold flex items-start gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                                  <span>
                                    {t("سبب الرفض:")} {rejectionReason}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span
                                className={cn(
                                  "px-2.5 py-1 text-[9px] font-black border uppercase tracking-wider inline-flex items-center gap-1",
                                  isApproved
                                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"
                                    : isRejected
                                      ? "bg-rose-500/15 text-rose-600 border-rose-500/30 font-extrabold"
                                      : "bg-orange-500/10 text-orange-600 border-orange-500/25",
                                )}
                              >
                                {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                                {isRejected && <XCircle className="w-3 h-3 text-rose-600" />}
                                {isPending && <Clock className="w-3 h-3 text-orange-600" />}
                                {isApproved
                                  ? t("معتمدة رسمياً")
                                  : isRejected
                                    ? t("مرفوضة")
                                    : t("قيد المراجعة والاعتماد")}
                              </span>
                            </td>
                            {isMissions && (
                              <td className="py-4 px-4 text-center">
                                {evalObj ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMissionForEval(item);
                                    }}
                                    className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 font-black text-[10px] rounded inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <Award className="w-3.5 h-3.5 text-amber-500" />
                                    <span>
                                      {evalObj.finalScore}% (
                                      {evalObj.ratingGrade || "ممتاز"})
                                    </span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">---</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center pt-2 shrink-0">
                <p className="text-[9px] text-muted-foreground/80 font-bold italic font-sans">
                  {t(
                    "* يتم تحديث حالة الطلبات تلقائياً فور اتخاذ المدير المباشر أو الموارد البشرية القرار.",
                  )}
                </p>
                <button
                  onClick={() => {
                    setDetailsPopupType(null);
                    setPopupStatusFilter("all");
                  }}
                  className="px-4 py-1.5 bg-muted hover:bg-muted/80 text-foreground font-black text-xs border border-border cursor-pointer transition-colors"
                >
                  {t("إغلاق")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Professional My Details Popup (بيانات الموظف الشاملة - دون أي بيانات مالية) */}
      {isMyDetailsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-colors duration-300">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-2xl p-8 rounded-none shadow-2xl relative text-right border-2 border-border"
            dir="rtl"
          >
            <button
              onClick={() => setIsMyDetailsModalOpen(false)}
              className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors outline-none"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 mb-8 border-b-2 border-border pb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-none flex items-center justify-center text-primary">
                <User className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-foreground">
                  {displayName}
                </h3>
                <p className="text-xs text-muted-foreground font-black uppercase tracking-widest mt-1">
                  {linkedEmployee?.gradeLevel
                    ? `${linkedEmployee.jobTitle || displayJobTitle} (${isRtl ? t("الدرجة") : "Grade"}: ${linkedEmployee.gradeLevel})`
                    : linkedEmployee?.jobTitle || displayJobTitle}{" "}
                  • {isRtl ? t("الرقم الوظيفي:") : "Employee ID:"}{" "}
                  {linkedEmployee?.employeeId || displayEmployeeId}
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {[
                  {
                    label: isRtl
                      ? t("الاسم الكامل الموثق")
                      : "Verified Full Name",
                    value: linkedEmployee?.name || displayName,
                  },
                  {
                    label: isRtl
                      ? t("المسمى الوظيفي والدرجة")
                      : "Job Title & Grade",
                    value: linkedEmployee?.gradeLevel
                      ? `${linkedEmployee.jobTitle || displayJobTitle} (${isRtl ? t("الدرجة") : "Grade"}: ${linkedEmployee.gradeLevel})`
                      : linkedEmployee?.jobTitle || displayJobTitle,
                  },
                  {
                    label: isRtl ? t("الرقم الوظيفي") : "Employee ID",
                    value: linkedEmployee?.employeeId || displayEmployeeId,
                  },
                  {
                    label: isRtl
                      ? t("البريد الإلكتروني المعتمد")
                      : "Official Email",
                    value:
                      linkedEmployee?.email ||
                      user?.email ||
                      (isRtl ? t("غير متوفر") : "Not Available"),
                  },
                  {
                    label: isRtl ? t("رقم الموبايل") : "Mobile Number",
                    value:
                      linkedEmployee?.phone ||
                      (isRtl ? t("غير متوفر") : "Not Available"),
                  },
                  {
                    label: isRtl ? t("المدير المباشر") : "Direct Manager",
                    value:
                      employees.find(
                        (emp: any) => emp.id === linkedEmployee?.managerId,
                      )?.name || (isRtl ? t("غير محدد") : "Not Specified"),
                  },
                  {
                    label: isRtl
                      ? t("القسم / الإدارة")
                      : "Department / Administration",
                    value:
                      linkedEmployee?.department ||
                      (isRtl ? t("الإدارة العامة") : "General Administration"),
                  },
                  {
                    label: isRtl ? t("الرقم القومي") : "National ID",
                    value:
                      linkedEmployee?.iqamaNumber ||
                      linkedEmployee?.nationalId ||
                      "---",
                  },
                  {
                    label: isRtl ? t("تاريخ التعيين") : "Date of Hiring",
                    value: linkedEmployee?.joinDate || "---",
                  },
                  {
                    label: isRtl
                      ? t("الحالة الوظيفية الحالية")
                      : "Current Status",
                    value:
                      linkedEmployee?.status === "Active"
                        ? isRtl
                          ? t("نشط وقائم بالعمل")
                          : "Active & At Work"
                        : linkedEmployee?.status ||
                          (isRtl ? t("نشط") : "Active"),
                  },
                  {
                    label: isRtl
                      ? t("اسم البنك المعتمد للرواتب")
                      : "Certified Salary Bank",
                    value: linkedEmployee?.bankName || "---",
                  },
                  {
                    label: isRtl
                      ? t("رقم الحساب البنكي (IBAN)")
                      : "Bank Account (IBAN)",
                    value: linkedEmployee?.bankAccount || "---",
                  },
                ].map((item, i) => (
                  <div key={i} className="border-b border-border/40 pb-2">
                    <p className="text-[10px] font-black text-muted-foreground uppercase mb-1 opacity-75">
                      {item.label}
                    </p>
                    <p className="text-xs font-black text-foreground">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Strict Anti-Financial Disclosure Warning */}
              <div className="p-4 bg-muted/40 border border-border/80 rounded-none text-[10px] font-medium text-muted-foreground/80 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse text-xs" />
                <span>
                  {t(
                    "تم حجب البيانات والبدلات والرواتب المالية لضمان الخصوصية والامتثال لمعايير الأمان المالي.",
                  )}
                </span>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setIsMyDetailsModalOpen(false)}
                  className="px-6 py-2.5 bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest hover:bg-primary/95 transition-colors rounded-none"
                >
                  {t("إغلاق التفاصيل الشخصية")}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Attendance History Modal */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-colors duration-300">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-4xl p-8 rounded-none shadow-2xl relative text-right border-2 border-border max-h-[90vh] flex flex-col"
            dir={isRtl ? "rtl" : "ltr"}
          >
            <button
              onClick={() => setIsAttendanceModalOpen(false)}
              className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors outline-none"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b-2 border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-none flex items-center justify-center text-emerald-600">
                  <History className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground">
                    {t("سجل الحضور والانصراف")}
                  </h3>
                  <p className="text-xs text-muted-foreground font-black uppercase tracking-widest mt-1">
                    {isRtl ? "عرض تفاصيل البصمات والأوقات بنظام 12 ساعة" : "Attendance logs formatted in 12-hour standard"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-muted-foreground">{t("الشهر:")}</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 bg-background text-foreground border border-border font-bold text-xs outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1">
              {loadingMonthLogs ? (
                <div className="py-16 text-center text-muted-foreground font-bold">
                  {t("جاري تحميل السجلات...")}
                </div>
              ) : (() => {
                const monthFiltered = attendanceMonthLogs.filter(l => {
                  const d = l.attendanceDate || (l.timestamp ? l.timestamp.split('T')[0] : '');
                  return d.startsWith(selectedMonth);
                });

                // Group by date
                const groupedByDate: Record<string, { checkIn?: string; checkOut?: string; deviceName?: string; notes?: string }> = {};
                monthFiltered.forEach(l => {
                  const d = l.attendanceDate || (l.timestamp ? l.timestamp.split('T')[0] : '');
                  if (!d) return;
                  if (!groupedByDate[d]) groupedByDate[d] = {};
                  const timeStr = l.actionTime || (l.timestamp ? (l.timestamp.includes('T') ? l.timestamp.split('T')[1].substring(0, 8) : l.timestamp) : '');
                  if (l.actionType === 'CheckIn' || l.type === 'In' || l.type === 'in') {
                    if (!groupedByDate[d].checkIn || timeStr < groupedByDate[d].checkIn!) {
                      groupedByDate[d].checkIn = timeStr;
                    }
                  } else if (l.actionType === 'CheckOut' || l.type === 'Out' || l.type === 'out') {
                    if (!groupedByDate[d].checkOut || timeStr > groupedByDate[d].checkOut!) {
                      groupedByDate[d].checkOut = timeStr;
                    }
                  }
                  if (l.deviceName) groupedByDate[d].deviceName = l.deviceName;
                  if (l.notes) groupedByDate[d].notes = l.notes;
                });

                const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

                if (sortedDates.length === 0) {
                  return (
                    <div className="py-16 text-center text-muted-foreground font-bold border-2 border-dashed border-border/60">
                      {t("لا توجد سجلات حضور مسجلة لهذا الشهر")}
                    </div>
                  );
                }

                return (
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted/40 text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                        <th className="p-3">{t("التاريخ")}</th>
                        <th className="p-3">{t("وقت الحضور")}</th>
                        <th className="p-3">{t("وقت الانصراف")}</th>
                        <th className="p-3">{t("المصدر / الجهاز")}</th>
                        <th className="p-3">{t("ملاحظات")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-xs font-bold">
                      {sortedDates.map((dateKey) => {
                        const dayData = groupedByDate[dateKey];
                        return (
                          <tr key={dateKey} className="hover:bg-muted/30 transition-colors">
                            <td className="p-3 font-mono font-black text-foreground">{dateKey}</td>
                            <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">
                              {dayData.checkIn ? formatTime12h(dayData.checkIn, language) : "--:--"}
                            </td>
                            <td className="p-3 font-mono font-black text-primary">
                              {dayData.checkOut ? formatTime12h(dayData.checkOut, language) : "--:--"}
                            </td>
                            <td className="p-3 text-muted-foreground text-[11px]">
                              {dayData.deviceName || t("النظام الإلكتروني")}
                            </td>
                            <td className="p-3 text-muted-foreground text-[11px] italic">
                              {dayData.notes || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            <div className="flex justify-end pt-4 border-t-2 border-border mt-4">
              <button
                onClick={() => setIsAttendanceModalOpen(false)}
                className="px-6 py-2.5 bg-primary text-primary-foreground font-black text-xs uppercase tracking-widest hover:bg-primary/95 transition-colors rounded-none cursor-pointer"
              >
                {t("إغلاق")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Majestic Fullscreen Expanded Eisenhower Matrix Modal */}
      {isEisenhowerExpanded && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md transition-colors duration-300">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-6xl h-[90vh] p-8 rounded-none shadow-2xl relative text-right border-4 border-slate-900 dark:border-slate-800 flex flex-col justify-between"
            dir="rtl"
          >
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b-2 border-border/80">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-600 rounded-none flex items-center justify-center text-white">
                  <Layers className="w-6 h-6 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-foreground">
                    {t("الرؤية الموسعة لمصفوفة أيزنهاور")}
                  </h3>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">
                    {t(
                      "تتبع وإنجاز المهام والالتزامات بنظام الأرباع الأربعة لمضاعفة الإنتاجية الشخصية والعملية",
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEisenhowerExpanded(false)}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-none transition-all flex items-center gap-2 shadow-md cursor-pointer border-none"
              >
                <Minimize2 className="w-4 h-4" />
                <span>{t("تصغير وإغلاق النافذة")}</span>
              </button>
            </div>

            {/* Matrix Grid (4 Quadrants filled with all events) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 flex-1 overflow-hidden">
              {/* 1. DO FIRST Quadrant */}
              <div className="bg-emerald-500/5 dark:bg-emerald-500-[3%] border-2 border-emerald-500 rounded-none p-5 flex flex-col justify-between overflow-hidden relative">
                <div className="absolute top-0 right-0 left-0 h-1.5 bg-emerald-500" />
                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center pb-2 border-b border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-emerald-500 rounded-none" />
                      <span className="text-sm font-black text-emerald-800 dark:text-emerald-400">
                        {t("عاجل وهام (Do First)")}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-black text-white bg-emerald-600 px-2 py-0.5">
                      {
                        dashboardEvents.filter(
                          (e) =>
                            e.quadrant === "do_first" &&
                            e.status !== "Completed",
                        ).length
                      }{" "}
                      مهام نشطة
                    </span>
                  </div>

                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {dashboardEvents
                      .filter(
                        (e) =>
                          e.quadrant === "do_first" && e.status !== "Completed",
                      )
                      .map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => handleOpenTaskDetailModal(evt)}
                          className="group flex items-center justify-between p-3 bg-card border border-emerald-500/20 rounded-none transition-all hover:bg-emerald-500/5 hover:border-emerald-500 cursor-pointer"
                        >
                          <div className="flex flex-col text-right gap-1 min-w-0 flex-1">
                            <span className="text-xs font-black text-foreground truncate">
                              {evt.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                              <span>تبدأ: {evt.startDate}</span>
                              {evt.endDate && (
                                <span>• الموعد الأخير: {evt.endDate}</span>
                              )}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDashboardMarkComplete(evt.id, e);
                            }}
                            className="w-8 h-8 rounded-full border-2 border-emerald-500 text-emerald-500 bg-background hover:bg-emerald-500 hover:text-white flex items-center justify-center cursor-pointer transition-all shrink-0 mr-4"
                            title={t("إكمال وإغلاق المهمة")}
                          >
                            <Check className="w-4 h-4 stroke-[4]" />
                          </button>
                        </div>
                      ))}
                    {dashboardEvents.filter(
                      (e) =>
                        e.quadrant === "do_first" && e.status !== "Completed",
                    ).length === 0 && (
                      <div className="text-center py-12 text-sm text-muted-foreground italic bg-card/40 border-2 border-dashed border-border/80">
                        {t("لا توجد مهام نشطة في هذا المربع الذهبي.")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-3 mt-3 border-t border-emerald-500/20 text-emerald-700 dark:text-emerald-450">
                  <span className="font-bold">
                    {t("كفاءة التخطيط والإنجاز:")}
                  </span>
                  <span className="font-mono font-black text-sm bg-emerald-500/10 px-2 py-0.5">
                    {(() => {
                      const total = dashboardEvents.filter(
                        (e) => e.quadrant === "do_first",
                      ).length;
                      const done = dashboardEvents.filter(
                        (e) =>
                          e.quadrant === "do_first" && e.status === "Completed",
                      ).length;
                      return total > 0
                        ? `${Math.round((done / total) * 105) > 100 ? 100 : Math.round((done / total) * 100)}%`
                        : "100%";
                    })()}
                  </span>
                </div>
              </div>

              {/* 2. SCHEDULE Quadrant */}
              <div className="bg-indigo-500/5 dark:bg-indigo-500-[3%] border-2 border-indigo-500 rounded-none p-5 flex flex-col justify-between overflow-hidden relative">
                <div className="absolute top-0 right-0 left-0 h-1.5 bg-indigo-500" />
                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center pb-2 border-b border-indigo-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-indigo-500 rounded-none" />
                      <span className="text-sm font-black text-indigo-800 dark:text-indigo-400">
                        {t("مهام مجدولة وبدقة (Schedule)")}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-black text-white bg-indigo-600 px-2 py-0.5">
                      {
                        dashboardEvents.filter(
                          (e) =>
                            e.quadrant === "schedule" &&
                            e.status !== "Completed",
                        ).length
                      }{" "}
                      مهام active
                    </span>
                  </div>

                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {dashboardEvents
                      .filter(
                        (e) =>
                          e.quadrant === "schedule" && e.status !== "Completed",
                      )
                      .map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => handleOpenTaskDetailModal(evt)}
                          className="group flex items-center justify-between p-3 bg-card border border-indigo-500/20 rounded-none transition-all hover:bg-indigo-500/5 hover:border-indigo-500 cursor-pointer"
                        >
                          <div className="flex flex-col text-right gap-1 min-w-0 flex-1">
                            <span className="text-xs font-black text-foreground truncate">
                              {evt.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                              <span>تبدأ: {evt.startDate}</span>
                              {evt.endDate && (
                                <span>• الموعد المخطط: {evt.endDate}</span>
                              )}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDashboardMarkComplete(evt.id, e);
                            }}
                            className="w-8 h-8 rounded-full border-2 border-indigo-500 text-indigo-500 bg-background hover:bg-indigo-500 hover:text-white flex items-center justify-center cursor-pointer transition-all shrink-0 mr-4"
                            title={t("إكمال وإغلاق المهمة")}
                          >
                            <Check className="w-4 h-4 stroke-[4]" />
                          </button>
                        </div>
                      ))}
                    {dashboardEvents.filter(
                      (e) =>
                        e.quadrant === "schedule" && e.status !== "Completed",
                    ).length === 0 && (
                      <div className="text-center py-12 text-sm text-muted-foreground italic bg-card/40 border-2 border-dashed border-border/80">
                        {t("لا توجد التزامات مجدولة في هذا المربع الهادئ.")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-3 mt-3 border-t border-indigo-500/20 text-indigo-700 dark:text-indigo-450">
                  <span className="font-bold">
                    {t("كفاءة التجدول الزمني:")}
                  </span>
                  <span className="font-mono font-black text-sm bg-indigo-500/10 px-2 py-0.5">
                    {(() => {
                      const total = dashboardEvents.filter(
                        (e) => e.quadrant === "schedule",
                      ).length;
                      const done = dashboardEvents.filter(
                        (e) =>
                          e.quadrant === "schedule" && e.status === "Completed",
                      ).length;
                      return total > 0
                        ? `${Math.round((done / total) * 100)}%`
                        : "100%";
                    })()}
                  </span>
                </div>
              </div>

              {/* 3. DELEGATE Quadrant */}
              <div className="bg-amber-500/5 dark:bg-amber-500-[3%] border-2 border-amber-500 rounded-none p-5 flex flex-col justify-between overflow-hidden relative">
                <div className="absolute top-0 right-0 left-0 h-1.5 bg-amber-500" />
                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center pb-2 border-b border-amber-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-amber-500 rounded-none" />
                      <span className="text-sm font-black text-amber-800 dark:text-amber-400">
                        {t("مهام مفوضة للزملاء (Delegate)")}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-black text-white bg-amber-600 px-2 py-0.5">
                      {
                        dashboardEvents.filter(
                          (e) =>
                            e.quadrant === "delegate" &&
                            e.status !== "Completed",
                        ).length
                      }{" "}
                      مهام active
                    </span>
                  </div>

                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {dashboardEvents
                      .filter(
                        (e) =>
                          e.quadrant === "delegate" && e.status !== "Completed",
                      )
                      .map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => handleOpenTaskDetailModal(evt)}
                          className="group flex items-center justify-between p-3 bg-card border border-amber-500/20 rounded-none transition-all hover:bg-amber-500/5 hover:border-amber-500 cursor-pointer"
                        >
                          <div className="flex flex-col text-right gap-1 min-w-0 flex-1">
                            <span className="text-xs font-black text-foreground truncate">
                              {evt.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                              <span>تبدأ: {evt.startDate}</span>
                              {evt.endDate && (
                                <span>• الموعد الأخير: {evt.endDate}</span>
                              )}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDashboardMarkComplete(evt.id, e);
                            }}
                            className="w-8 h-8 rounded-full border-2 border-amber-500 text-amber-500 bg-background hover:bg-amber-500 hover:text-white flex items-center justify-center cursor-pointer transition-all shrink-0 mr-4"
                            title={t("إكمال وإغلاق المهمة")}
                          >
                            <Check className="w-4 h-4 stroke-[4]" />
                          </button>
                        </div>
                      ))}
                    {dashboardEvents.filter(
                      (e) =>
                        e.quadrant === "delegate" && e.status !== "Completed",
                    ).length === 0 && (
                      <div className="text-center py-12 text-sm text-muted-foreground italic bg-card/40 border-2 border-dashed border-border/80">
                        {t("لا توجد مهام مفوضة حالياً للآخرين.")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-3 mt-3 border-t border-amber-500/20 text-amber-700 dark:text-amber-400">
                  <span className="font-bold">{t("كفاءة التفويض النشط:")}</span>
                  <span className="font-mono font-black text-sm bg-amber-500/10 px-2 py-0.5">
                    {(() => {
                      const total = dashboardEvents.filter(
                        (e) => e.quadrant === "delegate",
                      ).length;
                      const done = dashboardEvents.filter(
                        (e) =>
                          e.quadrant === "delegate" && e.status === "Completed",
                      ).length;
                      return total > 0
                        ? `${Math.round((done / total) * 100)}%`
                        : "100%";
                    })()}
                  </span>
                </div>
              </div>

              {/* 4. ELIMINATE Quadrant */}
              <div className="bg-rose-500/5 dark:bg-rose-500-[3%] border-2 border-rose-500 rounded-none p-5 flex flex-col justify-between overflow-hidden relative">
                <div className="absolute top-0 right-0 left-0 h-1.5 bg-rose-500" />
                <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                  <div className="flex justify-between items-center pb-2 border-b border-rose-500/20">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 bg-rose-500 rounded-none" />
                      <span className="text-sm font-black text-rose-800 dark:text-rose-400">
                        {t("مهام هامشية للتصفية (Eliminate)")}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-black text-white bg-rose-600 px-2 py-0.5">
                      {
                        dashboardEvents.filter(
                          (e) =>
                            e.quadrant === "eliminate" &&
                            e.status !== "Completed",
                        ).length
                      }{" "}
                      مهام active
                    </span>
                  </div>

                  <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                    {dashboardEvents
                      .filter(
                        (e) =>
                          e.quadrant === "eliminate" &&
                          e.status !== "Completed",
                      )
                      .map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => handleOpenTaskDetailModal(evt)}
                          className="group flex items-center justify-between p-3 bg-card border border-rose-500/20 rounded-none transition-all hover:bg-rose-500/5 hover:border-rose-500 cursor-pointer"
                        >
                          <div className="flex flex-col text-right gap-1 min-w-0 flex-1">
                            <span className="text-xs font-black text-foreground truncate">
                              {evt.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5">
                              <span>تبدأ: {evt.startDate}</span>
                              {evt.endDate && (
                                <span>• الموعد الأخير: {evt.endDate}</span>
                              )}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDashboardMarkComplete(evt.id, e);
                            }}
                            className="w-8 h-8 rounded-full border-2 border-rose-500 text-rose-500 bg-background hover:bg-rose-500 hover:text-white flex items-center justify-center cursor-pointer transition-all shrink-0 mr-4"
                            title={t("إكمال وإغلاق المهمة")}
                          >
                            <Check className="w-4 h-4 stroke-[4]" />
                          </button>
                        </div>
                      ))}
                    {dashboardEvents.filter(
                      (e) =>
                        e.quadrant === "eliminate" && e.status !== "Completed",
                    ).length === 0 && (
                      <div className="text-center py-12 text-sm text-muted-foreground italic bg-card/40 border-2 border-dashed border-border/80">
                        {t("لا توجد مهام هامشية لتصفيتها هنا.")}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs pt-3 mt-3 border-t border-rose-500/20 text-rose-700 dark:text-rose-400">
                  <span className="font-bold">
                    {t("كفاءة التصفية والاستبعاد:")}
                  </span>
                  <span className="font-mono font-black text-sm bg-rose-500/10 px-2 py-0.5">
                    {(() => {
                      const total = dashboardEvents.filter(
                        (e) => e.quadrant === "eliminate",
                      ).length;
                      const done = dashboardEvents.filter(
                        (e) =>
                          e.quadrant === "eliminate" &&
                          e.status === "Completed",
                      ).length;
                      return total > 0
                        ? `${Math.round((done / total) * 100)}%`
                        : "100%";
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-border/85 text-muted-foreground">
              <p className="text-xs text-muted-foreground text-right font-sans">
                {t("* اضغط على زر الصح (")}
                <Check className="w-3 h-3 inline-block font-black" />
                {t(
                  ") بجانب أي مهمة نشطة لإكمالها وإغلاقها وإزالتها من مصفوفتك وتحديث إحصائياتك فوراً.",
                )}
              </p>
              <button
                onClick={() => setIsEisenhowerExpanded(false)}
                className="px-8 py-3 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground font-black text-xs uppercase tracking-widest transition-colors rounded-none outline-none border border-border cursor-pointer font-sans"
              >
                {t("الرجوع للوحة التحكم الرئيسية")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 1. Work From Home (إذن عمل من المنزل) Modal */}
      {isWfhModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm transition-colors duration-300">
          <motion.div
            initial={{ scale: 0.9, opacity: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-lg p-8 rounded-none shadow-2xl relative text-right border border-border"
            dir="rtl"
          >
            <button
              onClick={() => setIsWfhModalOpen(false)}
              className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateWfhRequest();
              }}
            >
              <h3 className="text-2xl font-black text-foreground mb-4">
                {t("تقديم طلب إذن العمل من المنزل")}
              </h3>
              <p className="text-xs text-muted-foreground font-semibold leading-relaxed mb-6">
                {t(
                  "يتم توجيه هذا الطلب كإجراء لإثبات الحضور والعمل الفعلي من المنزل لليوم المحدد، دون الخصم من الراتب أو الخضوع لساعات الغياب.",
                )}
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">
                    {t("التاريخ المحدد للعمل عن بعد")}
                  </label>
                  <input
                    type="date"
                    required
                    className="w-full p-4 bg-muted/30 border border-border rounded-none outline-none font-bold text-foreground focus:ring-2 focus:ring-primary"
                    value={wfhRequest.date}
                    onChange={(e) =>
                      setWfhRequest({ ...wfhRequest, date: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mr-2">
                    {t("السبب / المبرر المهني")}
                  </label>
                  <textarea
                    required
                    placeholder={t(
                      "اكتب أسباب أو مبررات طلب العمل من المنزل بوضوح هنا...",
                    )}
                    className="w-full p-4 bg-muted/30 border border-border rounded-none outline-none font-bold h-28 text-foreground focus:ring-2 focus:ring-primary resize-none placeholder:text-muted-foreground/50"
                    value={wfhRequest.reason}
                    onChange={(e) =>
                      setWfhRequest({ ...wfhRequest, reason: e.target.value })
                    }
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-primary text-primary-foreground font-black rounded-none shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 cursor-pointer"
                  >
                    {t("إرسال طلب العمل عن بعد")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsWfhModalOpen(false)}
                    className="px-6 py-4 bg-muted text-muted-foreground font-black rounded-none border border-border hover:bg-muted/70 transition-all cursor-pointer"
                  >
                    {t("إلغاء")}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 2. Team Requests (طلبات وموافقات الفريق) Modal */}
      {isTeamRequestsModalOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-background/90 backdrop-blur-md transition-colors duration-350">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-card w-full max-w-4xl p-8 rounded-none shadow-2xl relative text-right border-2 border-primary"
            dir="rtl"
          >
            <button
              onClick={() => setIsTeamRequestsModalOpen(false)}
              className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-4 mb-6 border-b border-border pb-4">
              <div className="w-12 h-12 bg-primary/10 rounded-none flex items-center justify-center text-primary font-bold">
                <Users className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-foreground">
                  {t("منصة إدارة فريقي وتقييم الأداء والنمو")}
                </h3>
                <p className="text-xs text-muted-foreground font-bold mt-1">
                  {isViewingOwnMatrix || !activeEisenhowerEmp
                    ? `الموظفون تحت إشرافك المباشر: ${myTeamEmployees.length} موظفين`
                    : `الموظفون تحت الإشراف المباشر لـ (${activeEisenhowerEmp.name}): ${activeEmpTeamEmployees.length} موظفين`}
                </p>
              </div>
            </div>

            {/* Main Tabs Selection */}
            <div className="flex gap-2 p-1 bg-muted border border-border border-b-0 rounded-none w-fit overflow-x-auto">
              {[
                {
                  type: "employee_tasks",
                  label: `مهام الموظفين (${activeEisenhowerEmpTasks.length})`,
                },
                {
                  type: "wfh",
                  label: `العمل من المنزل (${teamWfhRequests.length})`,
                },
                {
                  type: "leaves",
                  label: `الإجازات (${teamLeaveRequests.length})`,
                },
                {
                  type: "missions",
                  label: `المأموريات (${teamMissions.length})`,
                },
                {
                  type: "penalties",
                  label: `الجزاءات والدراسات (${teamPenalties.length})`,
                },
                {
                  type: "evaluations",
                  label: `تقييمات الأداء والنمو (${(evaluations || []).filter((ev) => displaySubordinates.some((emp) => emp.id === ev.employeeId)).length})`,
                },
              ].map((tab) => (
                <button
                  key={tab.type}
                  onClick={() => setManagerActiveTab(tab.type as any)}
                  className={cn(
                    "px-4 py-2.5 text-xs font-black rounded-none transition-all uppercase tracking-wider whitespace-nowrap cursor-pointer",
                    managerActiveTab === tab.type
                      ? "bg-primary text-primary-foreground font-black shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* List Panels */}
            <div className="border border-border p-4 bg-muted/20 min-h-[300px] max-h-[550px] overflow-y-auto">
              {/* TAB 0: Employee Tasks & Eisenhower Matrix */}
              {managerActiveTab === "employee_tasks" && (
                <div className="space-y-4 text-right font-semibold" dir="rtl">
                  <div className="p-3 bg-muted/40 border border-border/80 text-xs text-muted-foreground flex items-center justify-between">
                    <span>
                      💡 يستعرض المدير المباشر جميع مهام الموظف (التي أنشأها
                      الموظف، أو أسندها المدير، أو أسندتها إدارة المشاريع).
                    </span>
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 border border-primary/20">
                      تحديث حالة الإتمام خاص بالموظف
                    </span>
                  </div>

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-card p-4 border border-border">
                    <div className="flex-1 w-full space-y-1">
                      <label className="text-xs font-black text-foreground flex items-center gap-1.5">
                        <User className="w-4 h-4 text-primary" />
                        {t(
                          "اختر الموظف لعرض مصفوفة أيزنهاور والمهام المسندة إليه:",
                        )}
                      </label>
                      <select
                        value={selectedEisenhowerEmpId}
                        onChange={(e) =>
                          setSelectedEisenhowerEmpId(e.target.value)
                        }
                        className="w-full p-2.5 bg-muted/40 border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                      >
                        {eisenhowerEmployees.length === 0 ? (
                          <option value="">{t("لا يوجد موظفون متاحون")}</option>
                        ) : (
                          eisenhowerEmployees.map((emp) => (
                            <option key={emp.id} value={emp.id}>
                              {emp.name} — {emp.jobTitle || "موظف"}{" "}
                              {emp.employeeId ? `[#${emp.employeeId}]` : ""}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        setAssignTaskForm((prev) => ({
                          ...prev,
                          targetEmployeeId: activeEisenhowerEmp?.id || "",
                        }));
                        setIsAssignTaskModalOpen(true);
                      }}
                      className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs rounded-none shadow-md flex items-center gap-2 cursor-pointer whitespace-nowrap self-end"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t("إسناد مهمة جديدة للموظف")}</span>
                    </button>
                  </div>

                  {activeEisenhowerEmp && (
                    <div className="space-y-4">
                      {/* Active Tasks Matrix (4 Quadrants) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Q1 */}
                        <div className="bg-red-500/5 border-t-2 border-red-500 border border-border p-3 space-y-2">
                          <div className="flex justify-between items-center border-b border-border pb-1">
                            <span className="text-xs font-black text-red-600">
                              🔴 عاجل ومهم (إنجاز فوراً)
                            </span>
                            <span className="text-[10px] font-black bg-red-500/10 text-red-600 px-1.5 py-0.5">
                              {activeEmpEisenhowerMatrix.doFirst.length}
                            </span>
                          </div>
                          <div className="space-y-2 max-h-52 overflow-y-auto">
                            {activeEmpEisenhowerMatrix.doFirst.length === 0 ? (
                              <div className="text-[10px] text-muted-foreground italic py-4 text-center">
                                {t("لا توجد مهام نشطة")}
                              </div>
                            ) : (
                              activeEmpEisenhowerMatrix.doFirst.map((task) => {
                                const creatorEmp = employees.find(
                                  (e) =>
                                    e.id === task.creatorId ||
                                    e.userId === task.creatorId,
                                );
                                return (
                                  <div
                                    key={task.id}
                                    onClick={() =>
                                      handleOpenTaskDetailModal(task)
                                    }
                                    className="p-2.5 bg-card border border-border text-xs font-bold space-y-1.5 hover:border-red-500/70 transition-colors cursor-pointer"
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="truncate font-extrabold text-foreground">
                                        {task.title}
                                      </span>
                                      <span
                                        className={cn(
                                          "text-[9px] font-black px-1.5 py-0.5 border shrink-0",
                                          task.typeBadgeColor ||
                                            "bg-muted text-muted-foreground",
                                        )}
                                      >
                                        {task.typeLabel || "مهمة"}
                                      </span>
                                    </div>
                                    {task.description && (
                                      <p className="text-[10px] text-muted-foreground line-clamp-1 font-normal">
                                        {task.description}
                                      </p>
                                    )}
                                    <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono pt-1.5 border-t border-border/40">
                                      <div className="flex items-center gap-1.5">
                                        <span>
                                          📅 {task.endDate || "بدون تاريخ"}
                                        </span>
                                        {creatorEmp && (
                                          <span className="text-[9px] text-foreground font-sans">
                                            👤 {creatorEmp.name}
                                          </span>
                                        )}
                                      </div>
                                      {isViewingOwnMatrix ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleEisenhowerItemStatus(
                                              task,
                                              "Approved",
                                            );
                                          }}
                                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] rounded-none shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                                        >
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span>إتمام</span>
                                        </button>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenTaskDetailModal(task);
                                          }}
                                          className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary font-black text-[9px] border border-primary/20 rounded-none shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                                        >
                                          <span>عرض / تعديل</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Q2 */}
                        <div className="bg-blue-500/5 border-t-2 border-blue-500 border border-border p-3 space-y-2">
                          <div className="flex justify-between items-center border-b border-border pb-1">
                            <span className="text-xs font-black text-blue-600">
                              🔵 غير عاجل ومهم (تخطيط وجدولة)
                            </span>
                            <span className="text-[10px] font-black bg-blue-500/10 text-blue-600 px-1.5 py-0.5">
                              {activeEmpEisenhowerMatrix.schedule.length}
                            </span>
                          </div>
                          <div className="space-y-2 max-h-52 overflow-y-auto">
                            {activeEmpEisenhowerMatrix.schedule.length === 0 ? (
                              <div className="text-[10px] text-muted-foreground italic py-4 text-center">
                                {t("لا توجد مهام نشطة")}
                              </div>
                            ) : (
                              activeEmpEisenhowerMatrix.schedule.map((task) => {
                                const creatorEmp = employees.find(
                                  (e) =>
                                    e.id === task.creatorId ||
                                    e.userId === task.creatorId,
                                );
                                return (
                                  <div
                                    key={task.id}
                                    onClick={() =>
                                      handleOpenTaskDetailModal(task)
                                    }
                                    className="p-2.5 bg-card border border-border text-xs font-bold space-y-1.5 hover:border-blue-500/70 transition-colors cursor-pointer"
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="truncate font-extrabold text-foreground">
                                        {task.title}
                                      </span>
                                      <span
                                        className={cn(
                                          "text-[9px] font-black px-1.5 py-0.5 border shrink-0",
                                          task.typeBadgeColor ||
                                            "bg-muted text-muted-foreground",
                                        )}
                                      >
                                        {task.typeLabel || "مهمة"}
                                      </span>
                                    </div>
                                    {task.description && (
                                      <p className="text-[10px] text-muted-foreground line-clamp-1 font-normal">
                                        {task.description}
                                      </p>
                                    )}
                                    <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono pt-1.5 border-t border-border/40">
                                      <div className="flex items-center gap-1.5">
                                        <span>
                                          📅 {task.endDate || "بدون تاريخ"}
                                        </span>
                                        {creatorEmp && (
                                          <span className="text-[9px] text-foreground font-sans">
                                            👤 {creatorEmp.name}
                                          </span>
                                        )}
                                      </div>
                                      {isViewingOwnMatrix ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleEisenhowerItemStatus(
                                              task,
                                              "Approved",
                                            );
                                          }}
                                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] rounded-none shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                                        >
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span>إتمام</span>
                                        </button>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenTaskDetailModal(task);
                                          }}
                                          className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary font-black text-[9px] border border-primary/20 rounded-none shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                                        >
                                          <span>عرض / تعديل</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Q3 */}
                        <div className="bg-amber-500/5 border-t-2 border-amber-500 border border-border p-3 space-y-2">
                          <div className="flex justify-between items-center border-b border-border pb-1">
                            <span className="text-xs font-black text-amber-600">
                              🟡 عاجل وغير مهم (تفويض ومتابعة)
                            </span>
                            <span className="text-[10px] font-black bg-amber-500/10 text-amber-600 px-1.5 py-0.5">
                              {activeEmpEisenhowerMatrix.delegate.length}
                            </span>
                          </div>
                          <div className="space-y-2 max-h-52 overflow-y-auto">
                            {activeEmpEisenhowerMatrix.delegate.length === 0 ? (
                              <div className="text-[10px] text-muted-foreground italic py-4 text-center">
                                {t("لا توجد مهام نشطة")}
                              </div>
                            ) : (
                              activeEmpEisenhowerMatrix.delegate.map((task) => {
                                const creatorEmp = employees.find(
                                  (e) =>
                                    e.id === task.creatorId ||
                                    e.userId === task.creatorId,
                                );
                                return (
                                  <div
                                    key={task.id}
                                    onClick={() =>
                                      handleOpenTaskDetailModal(task)
                                    }
                                    className="p-2.5 bg-card border border-border text-xs font-bold space-y-1.5 hover:border-amber-500/70 transition-colors cursor-pointer"
                                  >
                                    <div className="flex justify-between items-start gap-2">
                                      <span className="truncate font-extrabold text-foreground">
                                        {task.title}
                                      </span>
                                      <span
                                        className={cn(
                                          "text-[9px] font-black px-1.5 py-0.5 border shrink-0",
                                          task.typeBadgeColor ||
                                            "bg-muted text-muted-foreground",
                                        )}
                                      >
                                        {task.typeLabel || "مهمة"}
                                      </span>
                                    </div>
                                    {task.description && (
                                      <p className="text-[10px] text-muted-foreground line-clamp-1 font-normal">
                                        {task.description}
                                      </p>
                                    )}
                                    <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono pt-1.5 border-t border-border/40">
                                      <div className="flex items-center gap-1.5">
                                        <span>
                                          📅 {task.endDate || "بدون تاريخ"}
                                        </span>
                                        {creatorEmp && (
                                          <span className="text-[9px] text-foreground font-sans">
                                            👤 {creatorEmp.name}
                                          </span>
                                        )}
                                      </div>
                                      {isViewingOwnMatrix ? (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleEisenhowerItemStatus(
                                              task,
                                              "Approved",
                                            );
                                          }}
                                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] rounded-none shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                                        >
                                          <CheckCircle2 className="w-3 h-3" />
                                          <span>إتمام</span>
                                        </button>
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenTaskDetailModal(task);
                                          }}
                                          className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary font-black text-[9px] border border-primary/20 rounded-none shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                                        >
                                          <span>عرض / تعديل</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Q4 */}
                        <div className="bg-emerald-500/5 border-t-2 border-emerald-500 border border-border p-3 space-y-2">
                          <div className="flex justify-between items-center border-b border-border pb-1">
                            <span className="text-xs font-black text-emerald-600">
                              🟢 غير عاجل وغير مهم (استبعاد وتقليل)
                            </span>
                            <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5">
                              {activeEmpEisenhowerMatrix.eliminate.length}
                            </span>
                          </div>
                          <div className="space-y-2 max-h-52 overflow-y-auto">
                            {activeEmpEisenhowerMatrix.eliminate.length ===
                            0 ? (
                              <div className="text-[10px] text-muted-foreground italic py-4 text-center">
                                {t("لا توجد مهام نشطة")}
                              </div>
                            ) : (
                              activeEmpEisenhowerMatrix.eliminate.map(
                                (task) => {
                                  const creatorEmp = employees.find(
                                    (e) =>
                                      e.id === task.creatorId ||
                                      e.userId === task.creatorId,
                                  );
                                  return (
                                    <div
                                      key={task.id}
                                      onClick={() =>
                                        handleOpenTaskDetailModal(task)
                                      }
                                      className="p-2.5 bg-card border border-border text-xs font-bold space-y-1.5 hover:border-emerald-500/70 transition-colors cursor-pointer"
                                    >
                                      <div className="flex justify-between items-start gap-2">
                                        <span className="truncate font-extrabold text-foreground">
                                          {task.title}
                                        </span>
                                        <span
                                          className={cn(
                                            "text-[9px] font-black px-1.5 py-0.5 border shrink-0",
                                            task.typeBadgeColor ||
                                              "bg-muted text-muted-foreground",
                                          )}
                                        >
                                          {task.typeLabel || "مهمة"}
                                        </span>
                                      </div>
                                      {task.description && (
                                        <p className="text-[10px] text-muted-foreground line-clamp-1 font-normal">
                                          {task.description}
                                        </p>
                                      )}
                                      <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono pt-1.5 border-t border-border/40">
                                        <div className="flex items-center gap-1.5">
                                          <span>
                                            📅 {task.endDate || "بدون تاريخ"}
                                          </span>
                                          {creatorEmp && (
                                            <span className="text-[9px] text-foreground font-sans">
                                              👤 {creatorEmp.name}
                                            </span>
                                          )}
                                        </div>
                                        {isViewingOwnMatrix ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleEisenhowerItemStatus(
                                                task,
                                                "Approved",
                                              );
                                            }}
                                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] rounded-none shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                                          >
                                            <CheckCircle2 className="w-3 h-3" />
                                            <span>إتمام</span>
                                          </button>
                                        ) : (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenTaskDetailModal(task);
                                            }}
                                            className="px-2 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary font-black text-[9px] border border-primary/20 rounded-none shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                                          >
                                            <span>عرض / تعديل</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                },
                              )
                            )}
                          </div>
                        </div>
                      </div>

                      {/* WEEKLY COMPLETED TASKS TAB / SECTION UNDER MATRIX */}
                      <div className="bg-card border-2 border-emerald-500/30 p-4 space-y-3 mt-4">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-emerald-500/20 pb-3">
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>
                                ✅ المهام والالتزامات الأسبوعية المكتملة (
                                {filteredCompletedEmpTasks.length})
                              </span>
                            </span>
                            <p className="text-[10px] text-muted-foreground font-semibold">
                              تتبع إنجازات الموظف حسب الأسبوع مع إمكانية الفلترة
                              للأسابيع السابقة
                            </p>
                          </div>

                          {/* Weekly Filter Selector */}
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <label className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                              <span>فلتر الأسبوع:</span>
                            </label>
                            <select
                              value={completedTasksWeekFilter}
                              onChange={(e) =>
                                setCompletedTasksWeekFilter(e.target.value)
                              }
                              className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 font-black text-xs outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                            >
                              {Object.values(weeklyRanges).map((w: any) => (
                                <option
                                  key={w.key}
                                  value={w.key}
                                  className="bg-card text-foreground"
                                >
                                  {w.label} {w.labelRange}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {filteredCompletedEmpTasks.length === 0 ? (
                          <div className="text-[11px] text-muted-foreground italic py-8 text-center bg-muted/20 border border-dashed border-border space-y-1">
                            <p className="font-bold">
                              لا توجد مهام منتهية خلال{" "}
                              {(weeklyRanges as any)[completedTasksWeekFilter]
                                ?.label || "الأسبوع المحدد"}
                              .
                            </p>
                            <p className="text-[10px]">
                              يمكنك تصفح الأسابيع السابقة أو عرض "جميع الأسابيع"
                              من القائمة أعلاه.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto">
                            {filteredCompletedEmpTasks.map((task) => (
                              <div
                                key={task.id}
                                onClick={() => handleOpenTaskDetailModal(task)}
                                className="p-3 bg-muted/30 border border-emerald-500/30 text-xs font-bold space-y-1.5 hover:border-emerald-500 cursor-pointer transition-colors"
                              >
                                <div className="flex justify-between items-start gap-2">
                                  <span className="truncate font-black text-foreground line-through opacity-80">
                                    {task.title}
                                  </span>
                                  <span className="text-[9px] font-black px-2 py-0.5 border shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                    مكتملة
                                  </span>
                                </div>
                                {task.description && (
                                  <p className="text-[10px] text-muted-foreground line-clamp-1 font-normal">
                                    {task.description}
                                  </p>
                                )}
                                <div className="flex justify-between items-center text-[9px] text-muted-foreground font-mono pt-1.5 border-t border-border/40">
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 border font-sans text-[9px]",
                                      task.typeBadgeColor ||
                                        "bg-muted text-muted-foreground",
                                    )}
                                  >
                                    {task.typeLabel || "مهمة"}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <span>
                                      📅 {task.endDate || "بدون تاريخ"}
                                    </span>
                                    {!isViewingOwnMatrix ? (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenTaskDetailModal(task);
                                        }}
                                        className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-[9px] rounded-none shadow-xs flex items-center gap-1 cursor-pointer transition-all"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>إعادة فتح والتوجيه</span>
                                      </button>
                                    ) : (
                                      <span className="text-[9px] text-emerald-600 font-bold">
                                        تم الإنجاز
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {managerActiveTab === "wfh" && (
                <div className="space-y-3 font-semibold">
                  {teamWfhRequests.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground italic font-semibold text-xs">
                      {t("لا توجد طلبات عمل من المنزل للفريق حالياً.")}
                    </div>
                  ) : (
                    teamWfhRequests.map((req) => {
                      const emp = findEmployeeForRecord(req);
                      return (
                        <div
                          key={req.id}
                          onClick={() => {
                            setSelectedTeamRequest(req);
                            setSelectedTeamRequestType("wfh");
                          }}
                          className="p-4 bg-card border border-border hover:border-violet-500 cursor-pointer transition-colors flex justify-between items-center text-right group"
                        >
                          <div>
                            <p className="font-black text-foreground text-sm group-hover:text-primary transition-colors">
                              {emp?.name || t("موظف رئيسي")}
                            </p>
                            <p className="text-xs text-muted-foreground font-bold mt-1">
                              {t("تاريخ العمل عن بعد:")}
                              <span className="font-mono">{req.startDate}</span>
                            </p>
                          </div>
                          <span
                            className={cn(
                              "px-3 py-1 font-black text-[10px] border",
                              req.status === "Approved"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"
                                : req.status === "Rejected"
                                  ? "bg-red-500/10 text-red-600 border-red-500/25"
                                  : "bg-orange-500/10 text-orange-600 border-orange-500/25",
                            )}
                          >
                            {req.status === "Approved"
                              ? t("معتمد")
                              : req.status === "Rejected"
                                ? t("مرفوض")
                                : t("قيد الانتظار")}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 2: Leaves */}
              {managerActiveTab === "leaves" && (
                <div className="space-y-3">
                  {teamLeaveRequests.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground italic font-semibold text-xs">
                      {t("لا توجد طلبات إجازة للفريق حالياً.")}
                    </div>
                  ) : (
                    teamLeaveRequests.map((req) => {
                      const emp = findEmployeeForRecord(req);
                      return (
                        <div
                          key={req.id}
                          onClick={() => {
                            setSelectedTeamRequest(req);
                            setSelectedTeamRequestType("leave");
                          }}
                          className="p-4 bg-card border border-border hover:border-violet-500 cursor-pointer transition-colors flex justify-between items-center text-right group"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-black text-foreground text-sm group-hover:text-primary transition-colors">
                                {emp?.name || t("موظف رئيسي")}
                              </p>
                              <span className="text-[10px] bg-muted/80 text-foreground px-2 py-0.5 border border-border">
                                {req.type === "Annual"
                                  ? t("اعتيادية سنوية")
                                  : req.type === "Sick"
                                    ? t("مرضية")
                                    : t("بدون مرتب")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground font-bold mt-1">
                              {t("الفترة المستغرقـة:")}
                              <span className="font-mono">{req.startDate}</span>
                              {t("إلى")}
                              <span className="font-mono">{req.endDate}</span>
                            </p>
                          </div>
                          <span
                            className={cn(
                              "px-3 py-1 font-black text-[10px] border",
                              req.status === "Approved"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"
                                : req.status === "Rejected"
                                  ? "bg-red-500/10 text-red-600 border-red-500/25"
                                  : "bg-orange-500/10 text-orange-600 border-orange-500/25",
                            )}
                          >
                            {req.status === "Approved"
                              ? t("معتمد")
                              : req.status === "Rejected"
                                ? t("مرفوض")
                                : t("قيد الانتظار")}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 3: Missions */}
              {managerActiveTab === "missions" && (
                <div className="space-y-3">
                  {teamMissions.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground italic font-semibold text-xs">
                      {t("لا توجد مأموريات عمل للفريق حالياً.")}
                    </div>
                  ) : (
                    teamMissions.map((req) => {
                      const emp = findEmployeeForRecord(req);
                      return (
                        <div
                          key={req.id}
                          onClick={() => {
                            setSelectedTeamRequest(req);
                            setSelectedTeamRequestType("mission");
                          }}
                          className="p-4 bg-card border border-border hover:border-violet-500 cursor-pointer transition-colors flex justify-between items-center text-right group"
                        >
                          <div>
                            <p className="font-black text-foreground text-sm group-hover:text-primary transition-colors">
                              {emp?.name || t("موظف رئيسي")}
                            </p>
                            <p className="text-xs text-muted-foreground font-bold mt-1">
                              {t("من تاريخ:")}
                              <span className="font-mono">{req.startDate}</span>
                              {t("إلى")}
                              <span className="font-mono">{req.endDate}</span>
                            </p>
                          </div>
                          <span
                            className={cn(
                              "px-3 py-1 font-black text-[10px] border",
                              isApprovedStatus(req.status) || isCompletedStatus(req.status)
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"
                                : isRejectedStatus(req.status)
                                  ? "bg-red-500/10 text-red-600 border-red-500/25"
                                  : "bg-orange-500/10 text-orange-600 border-orange-500/25",
                            )}
                          >
                            {isApprovedStatus(req.status)
                              ? t("معتمدة")
                              : isCompletedStatus(req.status)
                                ? t("مكتملة ومُقيّمة")
                                : isRejectedStatus(req.status)
                                  ? t("مرفوضة")
                                  : t("قيد المراجعة")}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 4: Penalties */}
              {managerActiveTab === "penalties" && (
                <div className="space-y-3 font-semibold">
                  {teamPenalties.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground italic font-semibold text-xs animate-pulse">
                      {t("لا توجد جزاءات أو تحقيقات للفريق المباشر حالياً.")}
                    </div>
                  ) : (
                    teamPenalties.map((req) => {
                      const emp = employees.find(
                        (e) => e.id === req.employeeId,
                      );
                      return (
                        <div
                          key={req.id}
                          onClick={() => {
                            setSelectedTeamRequest(req);
                            setSelectedTeamRequestType("penalty");
                          }}
                          className="p-4 bg-card border border-border hover:border-violet-500 cursor-pointer transition-colors flex justify-between items-center text-right group"
                        >
                          <div>
                            <p className="font-black text-foreground text-sm group-hover:text-primary transition-colors">
                              {emp?.name || t("موظف رئيسي")}
                            </p>
                            <p className="text-xs text-muted-foreground font-bold mt-1">
                              {t("النوع:")}
                              <span className="text-destructive font-black">
                                {req.penaltyType}
                              </span>{" "}
                              {req.deductionValue
                                ? `• الخصم: ${req.deductionValue} أيام`
                                : ""}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "px-3 py-1 font-black text-[10px] border",
                              req.status === "Approved"
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"
                                : req.status === "Cancelled"
                                  ? "bg-slate-500/10 text-slate-600 border-slate-500/25"
                                  : req.status === "Rejected"
                                    ? "bg-red-500/10 text-red-600 border-red-500/25"
                                    : "bg-orange-500/10 text-orange-600 border-orange-500/25",
                            )}
                          >
                            {req.status === "Approved"
                              ? t("معتمد")
                              : req.status === "Cancelled"
                                ? t("تم إلغاء الجزاء")
                                : req.status === "Rejected"
                                  ? t("مرفوض")
                                  : t("قيد الانتظار")}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 5: Team Evaluations */}
              {managerActiveTab === "evaluations" && (
                <div className="space-y-4">
                  {selectedTeamEvalToFill ? (
                    /* Active Evaluation Form for direct report */
                    <div className="p-6 bg-card border-2 border-primary space-y-6 text-right">
                      <div className="flex justify-between items-center border-b border-border pb-3">
                        <h4 className="text-sm font-black text-foreground">
                          {t("تقييم الأداء الفني السنوي للموظف:")}{" "}
                          <span className="text-primary">
                            {
                              myTeamEmployees.find(
                                (e) =>
                                  e.id === selectedTeamEvalToFill.employeeId,
                              )?.name
                            }
                          </span>
                        </h4>
                        <button
                          onClick={() => setSelectedTeamEvalToFill(null)}
                          className="text-xs text-muted-foreground hover:text-foreground font-bold underline cursor-pointer"
                        >
                          {t("العودة للقائمة")}
                        </button>
                      </div>

                      {/* Display the Employee's Self-Evaluation Input for reference */}
                      <div className="p-4 bg-muted/20 border border-border space-y-3">
                        <h5 className="text-xs font-black text-amber-600 border-r-2 border-amber-500 pr-2 pb-0.5">
                          {t("مرئيات التقييم الذاتي المدخلة بواسطة الموظف:")}
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          {selectedTeamEvalToFill.selfStrengths && (
                            <div className="space-y-1">
                              <p className="font-extrabold text-foreground">
                                {t("نقاط القوة المدونة:")}
                              </p>
                              <p className="text-muted-foreground bg-card p-2 border border-border font-medium">
                                {selectedTeamEvalToFill.selfStrengths}
                              </p>
                            </div>
                          )}
                          {selectedTeamEvalToFill.selfImprovements && (
                            <div className="space-y-1">
                              <p className="font-extrabold text-foreground">
                                {t("مجالات التطوير المطلوبة:")}
                              </p>
                              <p className="text-muted-foreground bg-card p-2 border border-border font-medium">
                                {selectedTeamEvalToFill.selfImprovements}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Criteria Score Entries */}
                      <div className="space-y-4">
                        <h5 className="text-xs font-black text-foreground border-r-2 border-primary pr-2">
                          {t("تقييم المعايير الفردية (من 1 إلى 5 نجوم)")}
                        </h5>
                        <div className="space-y-3">
                          {(criteria || []).map((crit) => {
                            const employeeSelfRating =
                              selectedTeamEvalToFill.selfScores?.[crit.id] || 3;
                            return (
                              <div
                                key={crit.id}
                                className="p-4 bg-muted/10 border border-border space-y-2"
                              >
                                <div className="flex justify-between items-start gap-4">
                                  <div>
                                    <p className="text-xs font-black text-foreground">
                                      {crit.nameAr || crit.name}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground font-medium">
                                      {crit.descriptionAr || crit.description}
                                    </p>
                                  </div>
                                  <span className="text-[10px] font-black bg-primary/10 text-primary px-1.5 py-0.5">
                                    {t("الوزن:")} {crit.weight}%
                                  </span>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border/40 text-xs font-bold items-start sm:items-center">
                                  <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">
                                      {t("تقييم الموظف لنفسه:")}
                                    </span>
                                    <span className="text-amber-600 font-extrabold">
                                      {employeeSelfRating} / 5
                                    </span>
                                  </div>
                                  <div className="sm:mr-auto flex items-center gap-2">
                                    <span className="text-foreground font-extrabold">
                                      {t("تقييمك الفني كمدير متبقٍ:")}
                                    </span>
                                    <div className="flex gap-1.5 direction-ltr">
                                      {[1, 2, 3, 4, 5].map((star) => {
                                        const curMgrRating =
                                          teamScoreRatings[crit.id] || 3;
                                        return (
                                          <button
                                            key={star}
                                            type="button"
                                            onClick={() =>
                                              setTeamScoreRatings({
                                                ...teamScoreRatings,
                                                [crit.id]: star,
                                              })
                                            }
                                            className="text-amber-500 hover:scale-125 transition-transform p-0.5 cursor-pointer"
                                          >
                                            <Star
                                              className={cn(
                                                "w-4.5 h-4.5",
                                                star <= curMgrRating
                                                  ? "fill-amber-500 stroke-amber-500"
                                                  : "text-muted-foreground stroke-muted/50",
                                              )}
                                            />
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <span className="text-amber-600 font-black">
                                      ({teamScoreRatings[crit.id] || 3} / 5)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Manager growth areas development texts */}
                      <div className="space-y-3.5 pt-4 border-t border-border">
                        <div className="space-y-1.5 text-right">
                          <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                            {t("مواطن القوة وأبرز إنجازات الموظف الفعلية")}
                          </label>
                          <textarea
                            className="w-full p-3 bg-muted/25 border border-border text-xs text-foreground font-semibold placeholder:text-muted-foreground/55 rounded-none focus:outline-none focus:ring-2 focus:ring-primary h-20"
                            placeholder={t(
                              "اكتب هنا تقييمك لنقاط التميز التي أظهرها الموظف خلال هذه الفترة...",
                            )}
                            value={teamComments.strengths}
                            onChange={(e) =>
                              setTeamComments({
                                ...teamComments,
                                strengths: e.target.value,
                              })
                            }
                          />
                        </div>

                        <div className="space-y-1.5 text-right">
                          <label className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">
                            {t("توصيات ومخطط التطوير المهني المقترح للموظف")}
                          </label>
                          <textarea
                            className="w-full p-3 bg-muted/25 border border-border text-xs text-foreground font-semibold placeholder:text-muted-foreground/55 rounded-none focus:outline-none focus:ring-2 focus:ring-primary h-20"
                            placeholder={t(
                              "اكتب التوصيات المناسبة لمجالات التحسين والبرامج التدريبية الموصى بها...",
                            )}
                            value={teamComments.improvements}
                            onChange={(e) =>
                              setTeamComments({
                                ...teamComments,
                                improvements: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 justify-end pt-4 border-t border-border">
                        <button
                          type="button"
                          onClick={() => setSelectedTeamEvalToFill(null)}
                          className="py-2.5 px-5 border-2 border-border text-[11px] font-black text-muted-foreground uppercase tracking-widest hover:bg-muted rounded-none cursor-pointer"
                        >
                          {t("إلغاء")}
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingTeamEval}
                          onClick={handleSubmitTeamEvaluation}
                          className="py-2.5 px-6 bg-primary hover:bg-primary/95 text-primary-foreground font-black text-[11px] uppercase tracking-widest rounded-none shadow-md flex items-center gap-2 cursor-pointer"
                        >
                          {isSubmittingTeamEval
                            ? t("جاري الاعتماد...")
                            : t("اعتماد وإرسال التقييم السنوي")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Table of team member appraisals status */
                    <div className="space-y-3">
                      {displaySubordinates.length === 0 ? (
                        <p className="text-center py-12 text-xs font-semibold italic text-muted-foreground">
                          {isViewingOwnMatrix || !activeEisenhowerEmp
                            ? t("لا يوجد موظفون تحت إشرافك المباشر حالياً.")
                            : `لا يوجد مرؤوسون مباشرون يتبعون لـ (${activeEisenhowerEmp.name}) حالياً.`}
                        </p>
                      ) : (
                        displaySubordinates.map((emp) => {
                          const evalObj = (evaluations || []).find(
                            (ev) => ev.employeeId === emp.id,
                          );
                          const isClickable =
                            evalObj && evalObj.status === "PendingManager";
                          return (
                            <div
                              key={emp.id}
                              className="p-5 bg-card border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right rounded-none hover:border-primary/65 transition-colors"
                            >
                              <div className="space-y-1">
                                <p className="font-extrabold text-foreground text-sm flex items-center gap-2">
                                  {isClickable ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedTeamEvalToFill(evalObj);
                                        const initialScores: Record<
                                          string,
                                          number
                                        > = {};
                                        (criteria || []).forEach((c) => {
                                          initialScores[c.id] =
                                            evalObj.selfScores?.[c.id] || 3;
                                        });
                                        setTeamScoreRatings(initialScores);
                                        setTeamComments({
                                          strengths:
                                            evalObj.selfStrengths || "",
                                          improvements:
                                            evalObj.selfImprovements || "",
                                          recommendations:
                                            evalObj.selfRecommendations || "",
                                        });
                                      }}
                                      className="hover:underline hover:text-primary text-primary transition-colors cursor-pointer text-right text-foreground font-black text-sm"
                                    >
                                      {emp.name}
                                    </button>
                                  ) : (
                                    <span>{emp.name}</span>
                                  )}
                                  <span className="text-[10px] bg-muted/80 text-muted-foreground px-2 py-0.5 border font-mono">
                                    {emp.employeeId || emp.id.slice(0, 6)}
                                  </span>
                                </p>
                                <p className="text-xs text-muted-foreground font-bold">
                                  {emp.jobTitle || t("مستشار الخدمة المدنية")} •{" "}
                                  {t("بوابة فريقي")}
                                </p>
                              </div>

                              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                                {evalObj ? (
                                  <div className="flex items-center gap-3">
                                    <span
                                      className={cn(
                                        "px-2.5 py-1 font-black text-[10px] border",
                                        evalObj.status === "Approved"
                                          ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/25"
                                          : evalObj.status === "PendingManager"
                                            ? "bg-yellow-500/10 text-amber-600 border-amber-500/25"
                                            : "bg-orange-500/10 text-orange-600 border-orange-500/25",
                                      )}
                                    >
                                      {evalObj.status === "Approved"
                                        ? t("تم التقييم والاعتماد")
                                        : evalObj.status === "PendingManager"
                                          ? t("جاهز للاعتماد من قبلك")
                                          : t(
                                              "بانتظار التقييم الذاتي من الموظف",
                                            )}
                                    </span>

                                    {evalObj.status === "PendingManager" && (
                                      <button
                                        onClick={() => {
                                          setSelectedTeamEvalToFill(evalObj);
                                          const initialScores: Record<
                                            string,
                                            number
                                          > = {};
                                          (criteria || []).forEach((c) => {
                                            initialScores[c.id] =
                                              evalObj.selfScores?.[c.id] || 3;
                                          });
                                          setTeamScoreRatings(initialScores);
                                          setTeamComments({
                                            strengths:
                                              evalObj.selfStrengths || "",
                                            improvements:
                                              evalObj.selfImprovements || "",
                                            recommendations:
                                              evalObj.selfRecommendations || "",
                                          });
                                        }}
                                        className="py-2 px-4 bg-primary text-primary-foreground font-black text-xs hover:bg-primary/95 rounded-none outline-none active:scale-95 transition-all cursor-pointer"
                                      >
                                        {t("تقييم أداء الموظف")}
                                      </button>
                                    )}

                                    {evalObj.status === "Approved" && (
                                      <div className="text-xs font-black text-emerald-600 border border-emerald-500/35 px-2 py-1 bg-emerald-500/5">
                                        {t("النتيجة:")}{" "}
                                        {evalObj.finalPercentageScore || 0}%
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-bold text-muted-foreground italic bg-muted p-1 border">
                                    {t("لا توجد دورة تقييم سنوية منشورة")}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-border mt-6">
              <button
                onClick={() => setIsTeamRequestsModalOpen(false)}
                className="px-6 py-2.5 bg-muted text-muted-foreground font-black text-xs uppercase tracking-widest border border-border rounded-none hover:bg-muted/70 transition-colors cursor-pointer"
              >
                {t("إغلاق لوحة التحكم")}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 3. Selected Team Request Detail (تفاصيل طلب الموظف لاتخاذ الإجراء) Nested Pop-up */}
      {selectedTeamRequest && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-background/95 backdrop-blur-sm transition-colors duration-250">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-lg p-8 rounded-none shadow-2xl relative text-right border-2 border-violet-500"
            dir="rtl"
          >
            <button
              onClick={() => setSelectedTeamRequest(null)}
              className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors outline-none cursor-pointer"
            >
              <XCircle className="w-6 h-6" />
            </button>

            {(() => {
              const emp = employees.find(
                (e) => e.id === selectedTeamRequest.employeeId,
              );
              return (
                <div className="space-y-6">
                  <div className="border-b border-border pb-4">
                    <span className="text-[10px] text-violet-600 font-black tracking-widest uppercase block mb-1">
                      {t("تفاصيل طلب الموظف وبحث الإجراء")}
                    </span>
                    <h4 className="text-xl font-black text-foreground">
                      {emp?.name || t("موظف مجهول")}
                    </h4>
                    <p className="text-xs text-muted-foreground font-semibold">
                      الرقم الوظيفي: #{emp?.employeeId || "---"} • المسمى:{" "}
                      {emp?.jobTitle || t("عضو بالفريق")}
                    </p>
                  </div>

                  <div className="space-y-4 text-sm font-semibold">
                    <div className="grid grid-cols-2 gap-4 bg-muted/40 p-3 border border-border">
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">
                          {t("نوع المعاملة الذاتية:")}
                        </span>
                        <span className="font-extrabold text-foreground">
                          {selectedTeamRequestType === "wfh" &&
                            t("العمل من المنزل")}
                          {selectedTeamRequestType === "leave" &&
                            `إجازة ${selectedTeamRequest.type === "Annual" ? t("اعتيادية") : selectedTeamRequest.type === "Sick" ? t("مرضية") : t("بدون مرتب")}`}
                          {selectedTeamRequestType === "mission" &&
                            t("مأمورية عمل رسمية")}
                          {selectedTeamRequestType === "penalty" &&
                            `بحث جزاء إداري: ${selectedTeamRequest.type}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">
                          {t("الفترة الزمنية المحددة:")}
                        </span>
                        <span className="font-extrabold text-foreground font-mono">
                          {selectedTeamRequest.startDate}{" "}
                          {selectedTeamRequest.endDate &&
                          selectedTeamRequest.endDate !==
                            selectedTeamRequest.startDate
                            ? ` إلى ${selectedTeamRequest.endDate}`
                            : ""}
                        </span>
                      </div>
                    </div>

                    <div className="bg-muted p-4 border-l-4 border-violet-500">
                      <span className="text-xs text-muted-foreground block mb-2 font-bold">
                        {t("السبب والمبرر الوارد بالطلب:")}
                      </span>
                      <p className="text-xs font-bold text-foreground leading-relaxed italic">
                        {selectedTeamRequest.reason ||
                          selectedTeamRequest.notes ||
                          t("لا يوجد مبرر مكتوب مرفق بالمعاملة.")}
                      </p>
                    </div>

                    {selectedTeamRequestType === "leave" &&
                      (selectedTeamRequest.type === "Annual" || selectedTeamRequest.type === "Vacation") &&
                      (() => {
                        const calculatedEntitled = Number(emp?.leavePlan || 21);
                        const currentYear = new Date().getFullYear();
                        const approvedList = (leaveRequests || []).filter(
                          (lr) =>
                            lr.employeeId === emp?.id &&
                            lr.status === "Approved" &&
                            (lr.type === "Vacation" ||
                              lr.type === "Annual" ||
                              lr.type === t("إجازة اعتيادية") ||
                              lr.type === t("اعتيادي")) &&
                            lr.startDate &&
                            lr.startDate.startsWith(String(currentYear)),
                        );
                        const approvedConsumed = approvedList.reduce(
                          (sum, lr) => {
                            const s = new Date(lr.startDate);
                            const e = new Date(lr.endDate);
                            const diffTime = e.getTime() - s.getTime();
                            const days =
                              diffTime < 0
                                ? 0
                                : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) +
                                  1;
                            return sum + days;
                          },
                          0,
                        );
                        const thisReqDays = (() => {
                          if (
                            !selectedTeamRequest.startDate ||
                            !selectedTeamRequest.endDate
                          )
                            return 0;
                          const s = new Date(selectedTeamRequest.startDate);
                          const e = new Date(selectedTeamRequest.endDate);
                          const diffTime = e.getTime() - s.getTime();
                          return diffTime < 0
                            ? 0
                            : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        })();
                        const teamRem = calculatedEntitled - approvedConsumed;

                        return (
                          <div className="p-3 bg-card border border-border/80 text-xs text-right space-y-1">
                            <p className="font-extrabold text-emerald-600 mb-1">
                              {t("📦 رصيد الإجازات الاعتيادية للموظف لهذا العام:")}
                            </p>
                            <div className="flex justify-between">
                              <span>{t("الرصيد السنوي الكلي:")}</span>
                              <span className="font-black">
                                {calculatedEntitled} {t("أيام")}
                              </span>
                            </div>
                            <div className="flex justify-between text-red-600">
                              <span>{t("المستهلك من قبل المعتمد:")}</span>
                              <span className="font-black">
                                {approvedConsumed} {t("أيام")}
                              </span>
                            </div>
                            <div className="flex justify-between text-blue-600 border-t pt-1">
                              <span>{t("أيام هذا الطلب المقدم:")}</span>
                              <span className="font-black">
                                {thisReqDays} {t("أيام")}
                              </span>
                            </div>
                            <div className="flex justify-between text-emerald-600 font-extrabold">
                              <span>{t("الرصيد المتبقي المتاح:")}</span>
                              <span className="font-black">
                                {teamRem - thisReqDays} {t("أيام")}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                    {selectedTeamRequestType === "leave" &&
                      selectedTeamRequest.type === "Sick" &&
                      (() => {
                        const calculatedSickEntitled = Number(emp?.sickLeavePlan || 30);
                        const currentYear = new Date().getFullYear();
                        const approvedSickList = (leaveRequests || []).filter(
                          (lr) =>
                            lr.employeeId === emp?.id &&
                            lr.status === "Approved" &&
                            (lr.type === "Sick" ||
                              lr.type === "مرضية" ||
                              lr.type === "إجازة مرضية" ||
                              lr.type === t("إجازة مرضية") ||
                              lr.type === t("مرضية")) &&
                            lr.startDate &&
                            lr.startDate.startsWith(String(currentYear)),
                        );
                        const approvedSickConsumed = approvedSickList.reduce(
                          (sum, lr) => {
                            const s = new Date(lr.startDate);
                            const e = new Date(lr.endDate);
                            const diffTime = e.getTime() - s.getTime();
                            const days =
                              diffTime < 0
                                ? 0
                                : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) +
                                  1;
                            return sum + days;
                          },
                          0,
                        );
                        const thisSickReqDays = (() => {
                          if (
                            !selectedTeamRequest.startDate ||
                            !selectedTeamRequest.endDate
                          )
                            return 0;
                          const s = new Date(selectedTeamRequest.startDate);
                          const e = new Date(selectedTeamRequest.endDate);
                          const diffTime = e.getTime() - s.getTime();
                          return diffTime < 0
                            ? 0
                            : Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                        })();
                        const teamSickRem = calculatedSickEntitled - approvedSickConsumed;

                        return (
                          <div className="p-3 bg-card border border-blue-500/30 text-xs text-right space-y-1">
                            <p className="font-extrabold text-blue-600 mb-1 flex items-center gap-1">
                              <HeartPulse className="w-3.5 h-3.5 text-blue-600" />
                              {t("🩺 رصيد الإجازة المرضية السنوية للموظف:")}
                            </p>
                            <div className="flex justify-between">
                              <span>{t("الرصيد المرضي السنوي الكلي:")}</span>
                              <span className="font-black">
                                {calculatedSickEntitled} {t("أيام")}
                              </span>
                            </div>
                            <div className="flex justify-between text-red-600">
                              <span>{t("المستهلك المعتمد سابقاً:")}</span>
                              <span className="font-black">
                                {approvedSickConsumed} {t("أيام")}
                              </span>
                            </div>
                            <div className="flex justify-between text-blue-600 border-t pt-1">
                              <span>{t("أيام هذا الطلب المقدم:")}</span>
                              <span className="font-black">
                                {thisSickReqDays} {t("أيام")}
                              </span>
                            </div>
                            <div className="flex justify-between text-emerald-600 font-extrabold">
                              <span>{t("الرصيد المرضي المتبقي:")}</span>
                              <span className="font-black">
                                {teamSickRem - thisSickReqDays} {t("أيام")}
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                  </div>

                  {/* Decision Actions */}
                  <div className="pt-4 border-t border-border mt-6">
                    {selectedTeamRequestType === "penalty" ? (
                      ["Pending Direct Manager", "Pending Higher Manager", "Pending HR", "Pending Approval", "Pending", "Draft"].includes(selectedTeamRequest.status) ? (
                        <div className="flex flex-col gap-3">
                          {selectedTeamRequest.directManagerObjectionReason && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 font-bold rounded">
                              <strong>اعتراض المدير المباشر:</strong> {selectedTeamRequest.directManagerObjectionReason}
                            </div>
                          )}
                          {selectedTeamRequest.higherManagerObjectionReason && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 font-bold rounded">
                              <strong>اعتراض الرئيس الأعلى:</strong> {selectedTeamRequest.higherManagerObjectionReason}
                            </div>
                          )}
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                handleManagerDecisionPenalty(
                                  selectedTeamRequest.id,
                                  "Approved",
                                );
                              }}
                              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-none shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all border-none text-xs"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {["Pending Direct Manager", "Pending Approval", "Pending", "Draft"].includes(selectedTeamRequest.status)
                                ? t("الموافقة كمدير مباشر")
                                : selectedTeamRequest.status === "Pending Higher Manager"
                                  ? t("الموافقة كرئيس أعلى")
                                  : t("موافقة واعتماد الجزاء")}
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt("يرجى كتابة سبب الاعتراض على الجزاء الإداري (إجباري):");
                                if (reason === null) return;
                                if (!reason.trim()) {
                                  alert("سبب الاعتراض مطلوب إلزامياً للمتابعة.");
                                  return;
                                }
                                handleManagerDecisionPenalty(
                                  selectedTeamRequest.id,
                                  "Objected",
                                  reason.trim(),
                                );
                              }}
                              className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-none shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all border-none text-xs"
                            >
                              <XCircle className="w-4 h-4" />
                              {t("اعتراض وتدوين الملاحظات")}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-3 bg-muted text-xs font-black rounded border border-border">
                          حالة قرار الجزاء الحالية:{" "}
                          <span className="underline font-bold text-primary">
                            {selectedTeamRequest.status === "Approved"
                              ? t("معتمد نهائياً")
                              : selectedTeamRequest.status === "Cancelled"
                                ? t("تم إلغاء الجزاء")
                                : selectedTeamRequest.status === "Rejected"
                                  ? t("مرفوض")
                                  : selectedTeamRequest.status}
                          </span>
                        </div>
                      )
                    ) : isPendingStatus(selectedTeamRequest.status) ? (
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            if (
                              selectedTeamRequestType === "leave" ||
                              selectedTeamRequestType === "wfh"
                            ) {
                              handleManagerDecisionLeave(
                                selectedTeamRequest.id,
                                "Approved",
                              );
                            } else if (selectedTeamRequestType === "mission") {
                              handleManagerDecisionMission(
                                selectedTeamRequest.id,
                                "Approved",
                              );
                            }
                          }}
                          className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-none shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer transition-all border-none text-xs"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          {t("اعتماد وقبول الطلب")}
                        </button>
                        <button
                          onClick={() => {
                            if (
                              selectedTeamRequestType === "leave" ||
                              selectedTeamRequestType === "wfh"
                            ) {
                              handleManagerDecisionLeave(
                                selectedTeamRequest.id,
                                "Rejected",
                              );
                            } else if (selectedTeamRequestType === "mission") {
                              handleManagerDecisionMission(
                                selectedTeamRequest.id,
                                "Rejected",
                              );
                            }
                          }}
                          className="flex-1 py-3 bg-destructive hover:bg-destructive/90 text-white font-black rounded-none shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all border-none text-xs"
                        >
                          <XCircle className="w-4 h-4" />
                          {t("رفض وإلغاء الطلب")}
                        </button>
                      </div>
                    ) : (
                      <div className="text-center p-3 bg-muted text-xs font-black rounded border border-border">
                        حالة الطلب الحالية هي:{" "}
                        <span
                          className={cn(
                            "underline font-bold",
                            isApprovedStatus(selectedTeamRequest.status) || isCompletedStatus(selectedTeamRequest.status)
                              ? "text-emerald-600"
                              : isRejectedStatus(selectedTeamRequest.status)
                                ? "text-destructive"
                                : "text-amber-600",
                          )}
                        >
                          {isApprovedStatus(selectedTeamRequest.status) || isCompletedStatus(selectedTeamRequest.status)
                            ? t("معتمد ومقبول سابقاً")
                            : isRejectedStatus(selectedTeamRequest.status)
                              ? t("مرفوض كلياً")
                              : selectedTeamRequest.status || t("قيد الانتظار")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </motion.div>
        </div>
      )}

      {/* Modal: Assign Task to Employee */}
      {isAssignTaskModalOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card text-foreground border-2 border-border shadow-2xl w-full max-w-xl p-6 space-y-6 text-right"
          >
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-black text-foreground">
                  {t("إسناد مهمة جديدة للموظف")}
                </h3>
              </div>
              <button
                onClick={() => setIsAssignTaskModalOpen(false)}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTaskForEmployee} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-foreground">
                    {t("الموظف المستهدف:")}
                  </label>
                  <select
                    value={
                      assignTaskForm.targetEmployeeId ||
                      activeEisenhowerEmp?.id ||
                      ""
                    }
                    onChange={(e) =>
                      setAssignTaskForm((prev) => ({
                        ...prev,
                        targetEmployeeId: e.target.value,
                      }))
                    }
                    required
                    className="w-full p-3 bg-muted/40 border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="">{t("-- اختر الموظف --")}</option>
                    {eisenhowerEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.jobTitle || "موظف"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-foreground">
                    {t("ربط بالمشروع والتكليف:")}
                  </label>
                  <div className="grid grid-cols-2 gap-2 mb-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        setAssignTaskForm((prev) => ({
                          ...prev,
                          projectId: "",
                        }))
                      }
                      className={`p-2 border text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        !assignTaskForm.projectId ||
                        assignTaskForm.projectId === "no_project"
                          ? "bg-primary/10 border-primary text-primary shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span>📌</span>
                      <span>{t("بدون مشروع")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          projects.length > 0 &&
                          (!assignTaskForm.projectId ||
                            assignTaskForm.projectId === "no_project")
                        ) {
                          setAssignTaskForm((prev) => ({
                            ...prev,
                            projectId: projects[0].id,
                          }));
                        }
                      }}
                      className={`p-2 border text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        assignTaskForm.projectId &&
                        assignTaskForm.projectId !== "no_project"
                          ? "bg-primary/10 border-primary text-primary shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <span>📁</span>
                      <span>{t("اختيار مشروع")}</span>
                    </button>
                  </div>
                  <select
                    value={assignTaskForm.projectId}
                    onChange={(e) => {
                      const newPId = e.target.value;
                      const selProj = projects.find((p) => p.id === newPId);
                      setAssignTaskForm((prev) => ({
                        ...prev,
                        projectId: newPId,
                        phase: selProj?.phases?.[0] || "",
                        subPhase: selProj?.scope?.[0]?.name || "General",
                      }));
                    }}
                    className="w-full p-3 bg-muted/40 border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="">
                      📌 {t("بدون مشروع محدد (تكليف مباشر/مستقل)")}
                    </option>
                    {projects.map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        📁 {proj.name}
                      </option>
                    ))}
                  </select>

                  {/* Dynamic Phase and Scope (WBS) Selection */}
                  {assignTaskForm.projectId &&
                    assignTaskForm.projectId !== "no_project" &&
                    (() => {
                      const selectedProj = projects.find(
                        (p) => p.id === assignTaskForm.projectId,
                      );
                      if (!selectedProj) return null;
                      const projectPhases = selectedProj.phases || [];
                      const projectScopes = selectedProj.scope || [];

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 mt-2 bg-primary/5 border border-primary/20 rounded-xl">
                          <div>
                            <label className="block mb-1 text-primary font-black text-xs">
                              {t("المرحلة (Phase):")}
                            </label>
                            <select
                              value={assignTaskForm.phase}
                              onChange={(e) =>
                                setAssignTaskForm((prev) => ({
                                  ...prev,
                                  phase: e.target.value,
                                }))
                              }
                              className="w-full p-2 bg-background border border-border font-bold outline-none focus:border-primary text-xs cursor-pointer text-foreground"
                            >
                              <option value="">
                                {t("-- بدون مرحلة محددة --")}
                              </option>
                              {projectPhases.map((phase) => (
                                <option key={phase} value={phase}>
                                  {phase}
                                </option>
                              ))}
                            </select>
                            {projectPhases.length === 0 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {t("لم يتم إضافة مراحل مسبقة لهذا المشروع")}
                              </p>
                            )}
                          </div>

                          <div>
                            <label className="block mb-1 text-primary font-black text-xs">
                              {t("نطاق العمل / Scope (WBS):")}
                            </label>
                            <select
                              value={assignTaskForm.subPhase}
                              onChange={(e) =>
                                setAssignTaskForm((prev) => ({
                                  ...prev,
                                  subPhase: e.target.value,
                                }))
                              }
                              className="w-full p-2 bg-background border border-border font-bold outline-none focus:border-primary text-xs cursor-pointer text-foreground"
                            >
                              <option value="">{t("-- عام (General) --")}</option>
                              {projectScopes.map((sc: any) => (
                                <option
                                  key={sc.id || sc.name}
                                  value={sc.name}
                                >
                                  {sc.name}
                                </option>
                              ))}
                            </select>
                            {projectScopes.length === 0 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {t("لم يتم إضافة نطاقات عمل مسبقة لهذا المشروع")}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground">
                  {t("عنوان المهمة:")}
                </label>
                <input
                  type="text"
                  value={assignTaskForm.title}
                  onChange={(e) =>
                    setAssignTaskForm((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                  placeholder={t("أدخل عنوان المهمة المطلوبة...")}
                  required
                  className="w-full p-3 bg-muted/40 border border-border text-xs font-bold text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-foreground">
                  {t("وصف المهمة والتعليمات:")}
                </label>
                <textarea
                  value={assignTaskForm.description}
                  onChange={(e) =>
                    setAssignTaskForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder={t("اكتب الشروط والتعليمات والتفاصيل هنا...")}
                  rows={3}
                  className="w-full p-3 bg-muted/40 border border-border text-xs font-semibold text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-foreground">
                    {t("الأولوية:")}
                  </label>
                  <select
                    value={assignTaskForm.priority}
                    onChange={(e) =>
                      setAssignTaskForm((prev) => ({
                        ...prev,
                        priority: e.target.value as any,
                      }))
                    }
                    className="w-full p-2.5 bg-muted/40 border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                  >
                    <option value="Critical">{t("حرجة جداً 🔴")}</option>
                    <option value="High">{t("مرتفعة 🔵")}</option>
                    <option value="Medium">{t("متوسطة 🟡")}</option>
                    <option value="Low">{t("منخفضة 🟢")}</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-foreground">
                    {t("تاريخ الإنجاز المطلوب:")}
                  </label>
                  <input
                    type="date"
                    value={assignTaskForm.endDate}
                    onChange={(e) =>
                      setAssignTaskForm((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    required
                    className="w-full p-2.5 bg-muted/40 border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-foreground">
                    {t("الساعات التقديرية:")}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={assignTaskForm.estimatedHours}
                    onChange={(e) =>
                      setAssignTaskForm((prev) => ({
                        ...prev,
                        estimatedHours: Number(e.target.value),
                      }))
                    }
                    className="w-full p-2.5 bg-muted/40 border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAssignTaskModalOpen(false)}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-bold text-xs rounded-none transition-colors cursor-pointer"
                >
                  {t("إلغاء")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTask}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs rounded-none shadow-md transition-all cursor-pointer flex items-center gap-2"
                >
                  {isSubmittingTask ? (
                    <span>{t("جاري الإسناد...")}</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{t("إسناد المهمة للموظف")}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal: View & Edit Task Details / Manager Guidance */}
      {viewingTaskDetail && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          dir="rtl"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card text-foreground border-2 border-border shadow-2xl w-full max-w-2xl p-6 space-y-5 text-right relative overflow-y-auto max-h-[90vh]"
          >
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                <h3 className="text-base font-black text-foreground">
                  {!isViewingOwnMatrix
                    ? "تفاصيل وتعديل المهمة / توجيه الموظف"
                    : "تفاصيل المهمة المسندة"}
                </h3>
              </div>
              <button
                onClick={() => setViewingTaskDetail(null)}
                className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Badges Bar */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={cn(
                  "px-2 py-0.5 border font-bold",
                  viewingTaskDetail.typeBadgeColor ||
                    "bg-muted text-muted-foreground",
                )}
              >
                {viewingTaskDetail.typeLabel || "مهمة"}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 border font-black",
                  viewingTaskDetail.isCompleted
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-600 border-amber-500/30",
                )}
              >
                {viewingTaskDetail.isCompleted
                  ? "مكتملة ✅"
                  : "قيد التنفيذ / جارية ⏳"}
              </span>
              <span className="text-muted-foreground font-mono text-[11px] mr-auto">
                تاريخ الاستحقاق: {viewingTaskDetail.endDate || "غير محدد"}
              </span>
            </div>

            {/* Content Form / Readonly */}
            <div className="space-y-4">
              {!isViewingOwnMatrix ? (
                /* Manager View: Edit Title, Description, Priority, Due Date and add Guidance */
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-foreground">
                      عنوان المهمة:
                    </label>
                    <input
                      type="text"
                      value={taskEditForm.title}
                      onChange={(e) =>
                        setTaskEditForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className="w-full p-2.5 bg-muted/30 border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-foreground">
                      الوصف والتعليمات التفصيلية للموظف:
                    </label>
                    <textarea
                      value={taskEditForm.description}
                      onChange={(e) =>
                        setTaskEditForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full p-2.5 bg-muted/30 border border-border text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-black text-foreground">
                        الأولوية:
                      </label>
                      <select
                        value={taskEditForm.priority}
                        onChange={(e) =>
                          setTaskEditForm((prev) => ({
                            ...prev,
                            priority: e.target.value,
                          }))
                        }
                        className="w-full p-2.5 bg-muted/30 border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                      >
                        <option value="Critical">حرجة جداً 🔴</option>
                        <option value="High">مرتفعة 🔵</option>
                        <option value="Medium">متوسطة 🟡</option>
                        <option value="Low">منخفضة 🟢</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-black text-foreground">
                        تاريخ الاستحقاق / الإنجاز:
                      </label>
                      <input
                        type="date"
                        value={taskEditForm.endDate}
                        onChange={(e) =>
                          setTaskEditForm((prev) => ({
                            ...prev,
                            endDate: e.target.value,
                          }))
                        }
                        className="w-full p-2.5 bg-muted/30 border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 bg-amber-500/5 p-3 border border-amber-500/20">
                    <label className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Compass className="w-4 h-4" />
                      <span>إضافة توجيهات إدارية جديدة / إرشادات للموظف:</span>
                    </label>
                    <textarea
                      value={taskEditForm.guidanceNote}
                      onChange={(e) =>
                        setTaskEditForm((prev) => ({
                          ...prev,
                          guidanceNote: e.target.value,
                        }))
                      }
                      placeholder="اكتب توجيهاتك للموظف أو ملاحظات إعادة فتح المهمة هنا..."
                      rows={2}
                      className="w-full p-2 bg-card border border-amber-500/30 text-xs font-medium text-foreground outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              ) : (
                /* Employee View: Details and priority adjustment */
                <div className="space-y-4">
                  <div className="p-3 bg-muted/20 border border-border space-y-2">
                    <h4 className="text-sm font-black text-foreground">
                      {viewingTaskDetail.title}
                    </h4>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {viewingTaskDetail.description ||
                        "لا يوجد وصف تفصيلي مضاف"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    <div className="p-2 bg-muted/30 border border-border">
                      <span className="text-[10px] text-muted-foreground block">
                        الأولوية الحالية:
                      </span>
                      <span className="font-bold">
                        {viewingTaskDetail.priority}
                      </span>
                    </div>
                    <div className="p-2 bg-muted/30 border border-border">
                      <span className="text-[10px] text-muted-foreground block">
                        تاريخ الإنجاز:
                      </span>
                      <span className="font-bold">
                        {viewingTaskDetail.endDate || "غير محدد"}
                      </span>
                    </div>
                    <div className="p-2 bg-muted/30 border border-border col-span-2 md:col-span-1">
                      <span className="text-[10px] text-muted-foreground block">
                        الحالة الحالية:
                      </span>
                      <span className="font-bold">
                        {viewingTaskDetail.status}
                      </span>
                    </div>
                  </div>

                  {/* Employee Priority Adjustment Section */}
                  <div className="p-3 bg-primary/5 border border-primary/20 space-y-3">
                    <div className="flex items-center gap-2 text-primary font-black text-xs">
                      <Sliders className="w-4 h-4" />
                      <span>تغيير أولوية تنفيذ المهمة في مصفوفة أيزنهاور:</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground">
                          تحديد الأولوية:
                        </label>
                        <select
                          value={taskEditForm.priority}
                          onChange={(e) =>
                            setTaskEditForm((prev) => ({
                              ...prev,
                              priority: e.target.value,
                            }))
                          }
                          className="w-full p-2 bg-card border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                        >
                          <option value="Critical">
                            🔴 حرجة جداً (عاجل وهام)
                          </option>
                          <option value="High">
                            🔵 مرتفعة (مهم وغير عاجل)
                          </option>
                          <option value="Medium">
                            🟡 متوسطة (عاجل وغير مهم)
                          </option>
                          <option value="Low">
                            🟢 منخفضة (غير عاجل وغير مهم)
                          </option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-muted-foreground">
                          مربع أيزنهاور المناظر:
                        </label>
                        <select
                          value={
                            taskEditForm.priority === "Critical"
                              ? "do_first"
                              : taskEditForm.priority === "High"
                                ? "schedule"
                                : taskEditForm.priority === "Medium"
                                  ? "delegate"
                                  : "eliminate"
                          }
                          onChange={(e) => {
                            const quad = e.target.value;
                            let p = "High";
                            if (quad === "do_first") p = "Critical";
                            else if (quad === "schedule") p = "High";
                            else if (quad === "delegate") p = "Medium";
                            else if (quad === "eliminate") p = "Low";
                            setTaskEditForm((prev) => ({
                              ...prev,
                              priority: p,
                            }));
                          }}
                          className="w-full p-2 bg-card border border-border text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary cursor-pointer"
                        >
                          <option value="do_first">
                            🟢 عاجل وهام (أفعل أولاً)
                          </option>
                          <option value="schedule">
                            🔵 مهم وغير عاجل (جدولة)
                          </option>
                          <option value="delegate">
                            🟡 عاجل وغير مهم (تفويض)
                          </option>
                          <option value="eliminate">
                            🔴 غير عاجل وغير مهم (تأجيل)
                          </option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={async () => {
                        let targetQuad = "schedule";
                        if (taskEditForm.priority === "Critical")
                          targetQuad = "do_first";
                        else if (taskEditForm.priority === "High")
                          targetQuad = "schedule";
                        else if (taskEditForm.priority === "Medium")
                          targetQuad = "delegate";
                        else if (taskEditForm.priority === "Low")
                          targetQuad = "eliminate";

                        await handleDashboardChangeQuadrant(
                          viewingTaskDetail,
                          targetQuad,
                        );
                        setViewingTaskDetail(null);
                      }}
                      className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs cursor-pointer shadow-xs transition-all flex items-center justify-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>حفظ الأولوية الجديدة بمصفوفة أيزنهاور</span>
                    </button>
                  </div>

                  {/* Workflow Log / Manager Guidance History */}
                  {Array.isArray(viewingTaskDetail.workflowLog) &&
                    viewingTaskDetail.workflowLog.length > 0 && (
                      <div className="space-y-2 border-t border-border pt-3">
                        <h5 className="text-xs font-black text-foreground flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-primary" />
                          <span>توجيهات وملاحظات المدير المباشر:</span>
                        </h5>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {viewingTaskDetail.workflowLog.map(
                            (log: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-2 bg-primary/5 border border-primary/10 text-[11px] space-y-0.5"
                              >
                                <div className="flex justify-between text-muted-foreground text-[9px]">
                                  <span>👤 {log.userName || "المدير"}</span>
                                  <span>
                                    {log.timestamp
                                      ? new Date(
                                          log.timestamp,
                                        ).toLocaleDateString("ar-EG")
                                      : ""}
                                  </span>
                                </div>
                                <p className="font-medium text-foreground">
                                  {log.note}
                                </p>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center border-t border-border pt-4 gap-2">
              <button
                onClick={() => setViewingTaskDetail(null)}
                className="px-4 py-2 bg-muted text-muted-foreground font-black text-xs hover:bg-muted/80 transition-colors cursor-pointer"
              >
                إغلاق
              </button>

              <div className="flex items-center gap-2">
                {!isViewingOwnMatrix ? (
                  /* Manager Actions */
                  <>
                    {viewingTaskDetail.isCompleted ? (
                      <button
                        onClick={() => handleSaveTaskDetailsOrReopen(true)}
                        disabled={isSavingTaskEdit}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-none shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RotateCcw className="w-4 h-4" />
                        <span>إعادة فتح والتوجيه مرة أخرى</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSaveTaskDetailsOrReopen(false)}
                        disabled={isSavingTaskEdit}
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs rounded-none shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>حفظ التعديلات والتوجيهات</span>
                      </button>
                    )}
                  </>
                ) : (
                  /* Employee Actions */
                  <>
                    {!viewingTaskDetail.isCompleted && (
                      <button
                        onClick={() => {
                          handleToggleEisenhowerItemStatus(
                            viewingTaskDetail,
                            "Approved",
                          );
                          setViewingTaskDetail(null);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-none shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>إتمام المهمة الآن</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Disciplinary Penalty Grievance Submission Modal */}
      {grievanceModal.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card w-full max-w-lg border-2 border-indigo-500 rounded-none shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Scale className="w-5 h-5" />
                <h3 className="text-base font-black">
                  {isRtl ? "تقديم تظلم إداري رسمي على الجزاء" : "Submit Formal Disciplinary Grievance"}
                </h3>
              </div>
              <button
                onClick={() => setGrievanceModal({ isOpen: false, penalty: null, reason: "", submitting: false })}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-muted/40 border border-border text-xs space-y-1">
              <div>
                <strong>{isRtl ? "رقم الجزاء / القرار:" : "Penalty #:"}</strong> {grievanceModal.penalty?.penaltyNumber || grievanceModal.penalty?.id}
              </div>
              <div>
                <strong>{isRtl ? "نوع الجزاء:" : "Penalty Type:"}</strong> {grievanceModal.penalty?.penaltyType || "-"}
              </div>
              {grievanceModal.penalty?.deductionValue > 0 && (
                <div className="text-red-600 font-bold">
                  <strong>{isRtl ? "الخصم المالي:" : "Deduction:"}</strong> {grievanceModal.penalty.deductionValue} {grievanceModal.penalty.deductionType === "Days" ? (isRtl ? "يوم" : "days") : (isRtl ? "ج.م" : "EGP")}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-foreground">
                {isRtl ? "أسباب ومبررات التظلم الإداري:" : "Grievance Reasons & Details:"}
              </label>
              <textarea
                rows={4}
                value={grievanceModal.reason}
                onChange={(e) => setGrievanceModal(prev => ({ ...prev, reason: e.target.value }))}
                placeholder={isRtl ? "اكتب أسباب التظلم بالتفصيل والدلائل التي تستند إليها..." : "Provide detailed reasons and supporting facts for your grievance..."}
                className="w-full p-3 bg-background border-2 border-border focus:border-indigo-500 rounded-none text-xs text-foreground focus:outline-none"
              />
            </div>

            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-[11px] font-bold text-indigo-900 dark:text-indigo-200">
              ℹ️ {isRtl ? "سيتم إرسال إشعار فوري وتنبيه لمسؤولي الموارد البشرية (HR) فور إرسال التظلم لفحصه والبت فيه." : "An instant notification will be delivered to HR management to review and decide upon your grievance."}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setGrievanceModal({ isOpen: false, penalty: null, reason: "", submitting: false })}
                className="px-4 py-2 border border-border text-foreground font-bold text-xs hover:bg-muted cursor-pointer"
              >
                {isRtl ? "إلغاء" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={handleGrievanceSubmit}
                disabled={grievanceModal.submitting || !grievanceModal.reason.trim()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Scale className="w-4 h-4" />
                <span>{grievanceModal.submitting ? (isRtl ? "جاري الإرسال..." : "Submitting...") : (isRtl ? "إرسال التظلم لـ HR" : "Submit to HR")}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
