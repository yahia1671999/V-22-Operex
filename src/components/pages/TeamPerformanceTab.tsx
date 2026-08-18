import React, { useState, useMemo } from 'react';
import { 
  Award, 
  Star, 
  Sparkles, 
  Target, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText, 
  RefreshCw, 
  Save, 
  Send, 
  Check, 
  X, 
  Plus, 
  BookOpen, 
  UserCheck, 
  RotateCcw, 
  HelpCircle, 
  Zap,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  AlertCircle,
  Eye,
  CheckSquare,
  ShieldCheck,
  User,
  Users,
  CornerDownRight,
  Edit3,
  CheckCircle,
  MessageSquare
} from 'lucide-react';
import { 
  Employee, 
  PerformanceEvaluation, 
  DevelopmentPlan, 
  PerformanceCycle, 
  PerformanceTemplate, 
  PerformanceCriteria, 
  ProjectTask, 
  Mission, 
  AttendanceRecord, 
  LeaveRequest, 
  Penalty, 
  Investigation,
  AuditTrailEntry
} from '../../types';
import { 
  calculateEmployeePerformance, 
  getPerformanceGrade, 
  PerformanceAutoScoreResult 
} from '../../utils/performanceCalculator';
import { useData } from '../../contexts/DataContext';

interface TeamPerformanceTabProps {
  filteredTeamMembers: Employee[];
  teamEvaluations: PerformanceEvaluation[];
  performanceDevelopmentPlans: DevelopmentPlan[];
  performanceCycles: PerformanceCycle[];
  performanceTemplates: PerformanceTemplate[];
  performanceCriteria: PerformanceCriteria[];
  projectTasks: ProjectTask[];
  missions: Mission[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  penalties: Penalty[];
  investigations: Investigation[];
  refreshData: () => Promise<void>;
  currentEmployee?: Employee | null;
  userRole?: string;
  adminDepartments?: any[];
}

/**
 * Direct Manager (B) of Employee (A):
 * Looks up direct managerId in database / employees list.
 */
export const findDirectManager = (emp: Employee | null | undefined, allEmployees: Employee[]): Employee | null => {
  if (!emp || !allEmployees || allEmployees.length === 0) return null;
  const rawId = emp.managerId || (emp as any).directManagerId || (emp as any).directManager;
  if (!rawId) return null;
  const target = String(rawId).trim().toLowerCase();

  return allEmployees.find(m => {
    if (!m) return false;
    const ids = [m.id, m.employeeId, m.userId, m.email, m.name].filter(Boolean).map(x => String(x).trim().toLowerCase());
    return ids.includes(target);
  }) || null;
};

/**
 * Higher Level Manager (C) of Employee (A):
 * STRICT RULE: Higher Level Manager = Direct Manager of Direct Manager (Direct Manager of B).
 * Employee A -> Direct Manager B -> Higher Level Manager C.
 */
export const findHigherLevelManager = (emp: Employee | null | undefined, allEmployees: Employee[]): Employee | null => {
  if (!emp || !allEmployees || allEmployees.length === 0) return null;
  const directMgr = findDirectManager(emp, allEmployees);
  if (!directMgr) return null;
  return findDirectManager(directMgr, allEmployees);
};

/**
 * Check if the current user is the Direct Manager of Employee A
 */
export const isUserDirectManager = (
  emp: Employee | null | undefined, 
  currentUserEmp: Employee | null | undefined, 
  allEmployees: Employee[]
): boolean => {
  if (!emp || !currentUserEmp || !allEmployees) return false;
  const directMgr = findDirectManager(emp, allEmployees);
  if (!directMgr) return false;

  const currentIds = [
    currentUserEmp.id,
    currentUserEmp.employeeId,
    currentUserEmp.userId,
    currentUserEmp.email,
    currentUserEmp.name
  ].filter(Boolean).map(x => String(x).trim().toLowerCase());

  const directIds = [
    directMgr.id,
    directMgr.employeeId,
    directMgr.userId,
    directMgr.email,
    directMgr.name
  ].filter(Boolean).map(x => String(x).trim().toLowerCase());

  return currentIds.some(id => directIds.includes(id));
};

/**
 * Check if the current user is the Higher Level Manager (C) of Employee A
 */
export const isUserHigherLevelManager = (
  emp: Employee | null | undefined, 
  currentUserEmp: Employee | null | undefined, 
  allEmployees: Employee[]
): boolean => {
  if (!emp || !currentUserEmp || !allEmployees) return false;
  const higherMgr = findHigherLevelManager(emp, allEmployees);
  if (!higherMgr) return false;

  const currentIds = [
    currentUserEmp.id,
    currentUserEmp.employeeId,
    currentUserEmp.userId,
    currentUserEmp.email,
    currentUserEmp.name
  ].filter(Boolean).map(x => String(x).trim().toLowerCase());

  const higherIds = [
    higherMgr.id,
    higherMgr.employeeId,
    higherMgr.userId,
    higherMgr.email,
    higherMgr.name
  ].filter(Boolean).map(x => String(x).trim().toLowerCase());

  return currentIds.some(id => higherIds.includes(id));
};

export const TeamPerformanceTab: React.FC<TeamPerformanceTabProps> = ({
  filteredTeamMembers,
  teamEvaluations,
  performanceDevelopmentPlans,
  performanceCycles,
  performanceTemplates,
  performanceCriteria,
  projectTasks,
  missions,
  attendanceRecords,
  leaveRequests,
  penalties,
  investigations,
  refreshData,
  currentEmployee,
  userRole = 'Manager',
  adminDepartments = []
}) => {
  // Global Data Context
  const { employees: allSystemEmployees = [] } = useData();
  const allEmployeesList = useMemo(() => {
    return allSystemEmployees.length > 0 ? allSystemEmployees : filteredTeamMembers;
  }, [allSystemEmployees, filteredTeamMembers]);

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'success' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // State Filters
  const [selectedCycleId, setSelectedCycleId] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedScopeFilter, setSelectedScopeFilter] = useState<'ALL' | 'DIRECT' | 'HIGHER_SUBORDINATES'>('ALL');
  const [perfSearchTerm, setPerfSearchTerm] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Active Evaluation Cycle
  const activeCycle = useMemo(() => {
    return performanceCycles.find(c => c.status === 'Active') || performanceCycles[0] || null;
  }, [performanceCycles]);

  // Selected Cycle for Viewing
  const currentViewCycle = useMemo(() => {
    if (selectedCycleId === 'ALL') return activeCycle;
    return performanceCycles.find(c => c.id === selectedCycleId) || activeCycle;
  }, [selectedCycleId, performanceCycles, activeCycle]);

  // Modal States
  const [isEvalModalOpen, setIsEvalModalOpen] = useState<boolean>(false);
  const [selectedEvalEmp, setSelectedEvalEmp] = useState<Employee | null>(null);
  const [selectedEval, setSelectedEval] = useState<PerformanceEvaluation | null>(null);
  const [evalRatings, setEvalRatings] = useState<Record<string, number>>({});
  const [evalFeedback, setEvalFeedback] = useState<{ strengths: string; improvements: string; recommendations: string }>({
    strengths: '',
    improvements: '',
    recommendations: ''
  });
  const [showAutoBreakdown, setShowAutoBreakdown] = useState<boolean>(false);
  const [isSavingEval, setIsSavingEval] = useState<boolean>(false);

  // Higher Manager Decision Center States
  const [higherManagerDecisionChoice, setHigherManagerDecisionChoice] = useState<'AdoptSystem' | 'AdoptManager' | 'CustomScore'>('AdoptSystem');
  const [higherManagerCustomScore, setHigherManagerCustomScore] = useState<number>(85);
  const [higherManagerNotes, setHigherManagerNotes] = useState<string>('');

  // Return Evaluation Modal State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState<boolean>(false);
  const [returnReasonText, setReturnReasonText] = useState<string>('');

  // Development Plan Modal State
  const [isDevPlanModalOpen, setIsDevPlanModalOpen] = useState<boolean>(false);
  const [selectedDevPlanEmp, setSelectedDevPlanEmp] = useState<Employee | null>(null);
  const [selectedDevPlan, setSelectedDevPlan] = useState<DevelopmentPlan | null>(null);
  const [devPlanForm, setDevPlanForm] = useState<{
    weaknesses: string[];
    trainingCourses: Array<{ courseName: string; provider?: string; status: 'Planned' | 'In Progress' | 'Completed' | string }>;
    smartObjectives: Array<{ objective: string; deadline: string; progress: number; title?: string; targetDate?: string; status?: string }>;
    progressPercentage: number;
    notes?: string;
  }>({
    weaknesses: [],
    trainingCourses: [],
    smartObjectives: [],
    progressPercentage: 0,
    notes: ''
  });
  const [newWeakness, setNewWeakness] = useState<string>('');
  const [newCourseName, setNewCourseName] = useState<string>('');
  const [newCourseProvider, setNewCourseProvider] = useState<string>('');
  const [newObjectiveTitle, setNewObjectiveTitle] = useState<string>('');
  const [newObjectiveDate, setNewObjectiveDate] = useState<string>('');
  const [isSavingDevPlan, setIsSavingDevPlan] = useState<boolean>(false);

  // Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [reportEval, setReportEval] = useState<PerformanceEvaluation | null>(null);
  const [reportEmp, setReportEmp] = useState<Employee | null>(null);

  // Auto-calculated operational scores map
  const autoScoreMap = useMemo(() => {
    const map = new Map<string, PerformanceAutoScoreResult>();
    filteredTeamMembers.forEach(emp => {
      const result = calculateEmployeePerformance({
        employee: emp,
        tasks: projectTasks,
        missions,
        attendanceLogs: attendanceRecords,
        leaveRequests,
        penalties,
        investigations,
        criteriaList: performanceCriteria
      });
      map.set(emp.id, result);
      if (emp.employeeId) map.set(emp.employeeId, result);
    });
    return map;
  }, [filteredTeamMembers, projectTasks, missions, attendanceRecords, leaveRequests, penalties, investigations, performanceCriteria]);

  // Is current user an Executive / Admin
  const isExecutiveOrAdmin = useMemo(() => {
    const role = String(userRole).toLowerCase();
    return role.includes('admin') || role.includes('executive') || role.includes('director') || role.includes('تنفيذي') || role.includes('أدمن') || role.includes('عام');
  }, [userRole]);

  // Sync Evaluations with Backend
  const handleSyncWorkforce = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/performance-evaluations/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (!response.ok) throw new Error('فشلت المزامنة');
      const result = await response.json();
      showToast(`تمت مزامنة ونشر نماذج التقييم بنجاح (تم إنشاء ${result.createdCount}، وتحديث ${result.updatedCount})`);
      await refreshData();
    } catch {
      showToast('فشل في مزامنة نماذج التقييم مع الخادم', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // Open Evaluation Modal for an Employee
  const handleOpenEvaluationModal = (emp: Employee) => {
    setSelectedEvalEmp(emp);
    
    // Find existing evaluation in cycle or general
    const existing = teamEvaluations.find(e => {
      const isEmpMatch = e.employeeId === emp.id || e.employeeId === emp.employeeId;
      if (selectedCycleId !== 'ALL') {
        return isEmpMatch && e.cycleId === selectedCycleId;
      }
      return isEmpMatch;
    });

    setSelectedEval(existing || null);

    if (existing) {
      const initialRatings = (existing.managerScores && Object.keys(existing.managerScores).length > 0)
        ? { ...existing.managerScores }
        : (existing.selfScores && Object.keys(existing.selfScores).length > 0)
          ? { ...existing.selfScores }
          : {};
      setEvalRatings(initialRatings);
      setEvalFeedback({
        strengths: existing.managerStrengths || existing.selfStrengths || '',
        improvements: existing.managerImprovements || existing.selfImprovements || '',
        recommendations: existing.managerRecommendations || existing.selfRecommendations || ''
      });

      // Higher Level Manager decision state initializations
      setHigherManagerDecisionChoice((existing.higherManagerDecision as any) || 'AdoptSystem');
      setHigherManagerCustomScore(existing.higherManagerCustomScore || existing.finalPercentageScore || 85);
      setHigherManagerNotes(existing.higherManagerNotes || '');
    } else {
      // Auto-prefill with system auto-score suggestions if available
      const autoScore = autoScoreMap.get(emp.id) || autoScoreMap.get(emp.employeeId || '');
      const defaultRatings: Record<string, number> = {};
      if (autoScore && autoScore.criteriaResults) {
        performanceCriteria.forEach(cri => {
          const match = autoScore.criteriaResults.find(b => 
            (cri.criterionKey && b.criterionKey === cri.criterionKey) ||
            b.criterionId === cri.id ||
            b.nameAr === cri.nameAr
          );
          if (match && match.isApplicable) {
            defaultRatings[cri.id] = Math.max(1, Math.min(5, Math.round(match.score / 20)));
          } else {
            defaultRatings[cri.id] = 4;
          }
        });
      } else {
        performanceCriteria.forEach(cri => {
          defaultRatings[cri.id] = 4;
        });
      }
      setEvalRatings(defaultRatings);
      setEvalFeedback({ strengths: '', improvements: '', recommendations: '' });
      setHigherManagerDecisionChoice('AdoptSystem');
      setHigherManagerCustomScore(autoScore?.overallScore || 85);
      setHigherManagerNotes('');
    }

    setShowAutoBreakdown(false);
    setIsEvalModalOpen(true);
  };

  // Auto-Fill Stars from System Score
  const handleApplyAutoScores = () => {
    if (!selectedEvalEmp) return;
    const autoScore = autoScoreMap.get(selectedEvalEmp.id) || autoScoreMap.get(selectedEvalEmp.employeeId || '');
    if (!autoScore || !autoScore.criteriaResults) {
      showToast('لا توجد بيانات عملياتية كافية لحساب التقييم التلقائي', 'error');
      return;
    }

    const newRatings: Record<string, number> = { ...evalRatings };
    performanceCriteria.forEach(cri => {
      const match = autoScore.criteriaResults.find(b => 
        (cri.criterionKey && b.criterionKey === cri.criterionKey) ||
        b.criterionId === cri.id ||
        b.nameAr === cri.nameAr
      );
      if (match && match.isApplicable) {
        newRatings[cri.id] = Math.max(1, Math.min(5, Math.round(match.score / 20)));
      }
    });

    setEvalRatings(newRatings);
    showToast('تم تطبيق درجات التقييم التلقائية للتشغيل والحضور بنجاح ⚡');
  };

  // Calculate live rating score
  const liveCalculatedScore = useMemo(() => {
    const ratedCriteriaIds = Object.keys(evalRatings);
    if (ratedCriteriaIds.length === 0) return 0;
    
    let totalScore = 0;
    let totalWeight = 0;

    performanceCriteria.forEach(cri => {
      const rating = evalRatings[cri.id];
      if (rating !== undefined && rating > 0) {
        const weight = Number(cri.weight) || 10;
        const normalized = (rating / 5) * 100;
        totalScore += normalized * weight;
        totalWeight += weight;
      }
    });

    if (totalWeight === 0) return 0;
    return Math.round(totalScore / totalWeight);
  }, [evalRatings, performanceCriteria]);

  const liveCalculatedGrade = useMemo(() => {
    return getPerformanceGrade(liveCalculatedScore);
  }, [liveCalculatedScore]);

  // Save Direct Manager Evaluation
  const handleSaveEvaluation = async (targetStatus: 'PendingManager' | 'PendingApproval' | 'Approved' = 'PendingApproval') => {
    if (!selectedEvalEmp) return;
    setIsSavingEval(true);

    try {
      const userDisplayName = currentEmployee?.name || 'المدير المباشر';
      const existingAudit: AuditTrailEntry[] = selectedEval?.auditTrail && Array.isArray(selectedEval.auditTrail) 
        ? (selectedEval.auditTrail as any) 
        : [];

      const actionTitle = targetStatus === 'Approved' 
        ? 'اعتماد التقييم مباشرة'
        : targetStatus === 'PendingApproval' 
          ? 'إرسال التقييم للاعتماد النهائي للرئيس الأعلى'
          : 'حفظ مسودة تقييم المدير';

      const newAuditEntry: AuditTrailEntry = {
        timestamp: new Date().toISOString(),
        userName: userDisplayName,
        action: actionTitle,
        comment: `تم تسجيل تقييم المدير بنسبة ${liveCalculatedScore}% (${liveCalculatedGrade.ar})`,
        previousStatus: selectedEval?.status || 'Draft',
        newStatus: targetStatus
      };

      const payload: Partial<PerformanceEvaluation> = {
        employeeId: selectedEvalEmp.id,
        cycleId: currentViewCycle?.id || selectedCycleId,
        templateId: selectedEval?.templateId || performanceTemplates[0]?.id || 'default',
        managerId: currentEmployee?.id || selectedEvalEmp.managerId || undefined,
        managerScores: evalRatings,
        managerStrengths: evalFeedback.strengths,
        managerImprovements: evalFeedback.improvements,
        managerRecommendations: evalFeedback.recommendations,
        finalPercentageScore: liveCalculatedScore,
        finalGrade: liveCalculatedGrade.ar,
        decisionSource: 'DirectManager',
        status: targetStatus,
        auditTrail: [...existingAudit, newAuditEntry],
        updatedAt: new Date().toISOString()
      };

      let response: Response;
      if (selectedEval?.id) {
        response = await fetch(`/api/performance-evaluations/${selectedEval.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch('/api/performance-evaluations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) throw new Error('فشل حفظ التقييم');

      showToast(targetStatus === 'PendingApproval' 
        ? 'تم إرسال استمارة التقييم بنجاح للاعتماد من الرئيس الأعلى'
        : 'تم حفظ التقييم بنجاح'
      );

      setIsEvalModalOpen(false);
      setSelectedEval(null);
      setSelectedEvalEmp(null);
      await refreshData();
    } catch {
      showToast('حدث خطأ أثناء حفظ التقييم', 'error');
    } finally {
      setIsSavingEval(false);
    }
  };

  // Higher Level Manager Decision Processor
  const handleHigherManagerDecision = async (
    decisionType: 'AdoptSystem' | 'AdoptManager' | 'CustomScore' | 'Return'
  ) => {
    if (!selectedEvalEmp || !selectedEval) return;
    setIsSavingEval(true);

    try {
      const userDisplayName = currentEmployee?.name || 'الرئيس الأعلى';
      const existingAudit: AuditTrailEntry[] = Array.isArray(selectedEval.auditTrail) 
        ? (selectedEval.auditTrail as any) 
        : [];
      
      const newStatus = decisionType === 'Return' ? 'Returned for Re-evaluation' : 'Approved';
      let finalScore = selectedEval.finalPercentageScore || 80;
      let finalGrade = selectedEval.finalGrade || 'جيد جداً';
      let decisionSource = 'System';

      const autoScore = autoScoreMap.get(selectedEvalEmp.id) || autoScoreMap.get(selectedEvalEmp.employeeId || '');

      if (decisionType === 'AdoptSystem') {
        finalScore = autoScore?.overallScore ?? selectedEval.systemCalculatedScore ?? 85;
        finalGrade = getPerformanceGrade(finalScore).ar;
        decisionSource = 'System';
      } else if (decisionType === 'AdoptManager') {
        const scores = selectedEval.managerScores || evalRatings;
        const totalCriteriaCount = Object.keys(scores).length;
        if (totalCriteriaCount > 0) {
          const totalScore = Object.values(scores).reduce((sum: number, val: any) => sum + (Number(val) || 0), 0);
          finalScore = Math.round((totalScore / (totalCriteriaCount * 5)) * 100);
        } else {
          finalScore = selectedEval.finalPercentageScore || 80;
        }
        finalGrade = getPerformanceGrade(finalScore).ar;
        decisionSource = 'DirectManager';
      } else if (decisionType === 'CustomScore') {
        finalScore = Math.max(0, Math.min(100, Number(higherManagerCustomScore) || 85));
        finalGrade = getPerformanceGrade(finalScore).ar;
        decisionSource = 'CustomScore';
      }

      const actionDesc = decisionType === 'Return' 
        ? 'إعادة التقييم للمدير المباشر'
        : decisionType === 'AdoptSystem'
          ? 'اعتماد تقييم النظام التلقائي'
          : decisionType === 'AdoptManager'
            ? 'اعتماد تقييم المدير المباشر'
            : 'اعتماد بنسبة مخصصة من الرئيس الأعلى';

      const newAuditEntry: AuditTrailEntry = {
        timestamp: new Date().toISOString(),
        userName: userDisplayName,
        action: actionDesc,
        comment: decisionType === 'Return' ? returnReasonText : (higherManagerNotes || `القرار: ${actionDesc} - النسبة النهائية: ${finalScore}%`),
        previousStatus: selectedEval.status,
        newStatus: newStatus
      };

      const payload: Partial<PerformanceEvaluation> = {
        status: newStatus,
        returnReason: decisionType === 'Return' ? returnReasonText : undefined,
        auditTrail: [...existingAudit, newAuditEntry],
        updatedAt: new Date().toISOString()
      };

      if (decisionType !== 'Return') {
        payload.finalPercentageScore = finalScore;
        payload.finalGrade = finalGrade;
        payload.higherManagerDecision = decisionType;
        payload.decisionSource = decisionSource;
        payload.higherLevelManagerId = currentEmployee?.id || undefined;
        payload.higherManagerCustomScore = decisionType === 'CustomScore' ? finalScore : undefined;
        payload.higherManagerNotes = higherManagerNotes;
        if (autoScore) {
          payload.systemCalculatedScore = autoScore.overallScore;
          payload.systemScoreBreakdown = autoScore.criteriaResults;
        }
      }

      const response = await fetch(`/api/performance-evaluations/${selectedEval.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('فشل معالجة قرار الرئيس الأعلى');

      showToast(
        decisionType === 'Return'
          ? 'تمت إعادة التقييم للمدير المباشر مع تسجيل الملاحظات بنجاح'
          : 'تم اعتماد قرار الرئيس الأعلى وتثبيت النتيجة النهائية بنجاح 🛡️'
      );

      setIsEvalModalOpen(false);
      setSelectedEval(null);
      setSelectedEvalEmp(null);
      setIsReturnModalOpen(false);
      setReturnReasonText('');
      await refreshData();
    } catch {
      showToast('حدث خطأ أثناء معالجة قرار الرئيس الأعلى', 'error');
    } finally {
      setIsSavingEval(false);
    }
  };

  // Open Development Plan Modal
  const handleOpenDevPlanModal = (emp: Employee) => {
    setSelectedDevPlanEmp(emp);
    const existingPlan = performanceDevelopmentPlans.find(p => p.employeeId === emp.id || p.employeeId === emp.employeeId);
    setSelectedDevPlan(existingPlan || null);

    if (existingPlan) {
      setDevPlanForm({
        weaknesses: existingPlan.weaknesses || [],
        trainingCourses: (existingPlan.trainingCourses || []).map((c: any) => ({
          courseName: c.courseName || '',
          provider: c.provider || undefined,
          status: c.status || 'Planned'
        })),
        smartObjectives: (existingPlan.smartObjectives || []).map((s: any) => ({
          objective: s.objective || s.title || '',
          deadline: s.deadline || s.targetDate || '',
          progress: Number(s.progress) || 0,
          title: s.title || s.objective || '',
          targetDate: s.targetDate || s.deadline || '',
          status: s.status || 'Pending'
        })),
        progressPercentage: existingPlan.progressPercentage || 0,
        notes: existingPlan.notes || ''
      });
    } else {
      setDevPlanForm({
        weaknesses: [],
        trainingCourses: [],
        smartObjectives: [],
        progressPercentage: 0,
        notes: ''
      });
    }
    setIsDevPlanModalOpen(true);
  };

  // Save SMART Development Plan
  const handleSaveDevPlan = async () => {
    if (!selectedDevPlanEmp) return;
    setIsSavingDevPlan(true);

    try {
      const payload: Partial<DevelopmentPlan> = {
        employeeId: selectedDevPlanEmp.id,
        employeeName: selectedDevPlanEmp.name,
        managerId: currentEmployee?.id || undefined,
        weaknesses: devPlanForm.weaknesses,
        trainingCourses: devPlanForm.trainingCourses,
        smartObjectives: devPlanForm.smartObjectives,
        progressPercentage: devPlanForm.progressPercentage,
        notes: devPlanForm.notes,
        status: devPlanForm.progressPercentage >= 100 ? 'Completed' : 'Active',
        updatedAt: new Date().toISOString()
      };

      let response: Response;
      if (selectedDevPlan?.id) {
        response = await fetch(`/api/performance-development-plans/${selectedDevPlan.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch('/api/performance-development-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
          body: JSON.stringify({ ...payload, createdAt: new Date().toISOString() })
        });
      }

      if (!response.ok) throw new Error('فشل حفظ خطة التطوير');
      showToast('تم حفظ وتحديث خطة التطوير والنمو SMART بنجاح');
      setIsDevPlanModalOpen(false);
      await refreshData();
    } catch {
      showToast('حدث خطأ أثناء حفظ خطة التطوير', 'error');
    } finally {
      setIsSavingDevPlan(false);
    }
  };

  // Filtered List of Team Members
  const filteredList = useMemo(() => {
    return filteredTeamMembers.filter(emp => {
      // 1. Search term match
      if (perfSearchTerm.trim()) {
        const term = perfSearchTerm.toLowerCase();
        const nameMatch = emp.name?.toLowerCase().includes(term);
        const idMatch = emp.employeeId?.toLowerCase().includes(term);
        const titleMatch = emp.jobTitle?.toLowerCase().includes(term);
        if (!nameMatch && !idMatch && !titleMatch) return false;
      }

      // 2. Scope filter (Direct Reports vs Level 2 Subordinates / Higher Level Supervision)
      if (selectedScopeFilter === 'DIRECT') {
        const isDirect = isUserDirectManager(emp, currentEmployee, allEmployeesList);
        if (!isDirect) return false;
      } else if (selectedScopeFilter === 'HIGHER_SUBORDINATES') {
        const isHigher = isUserHigherLevelManager(emp, currentEmployee, allEmployeesList);
        if (!isHigher) return false;
      }

      // 3. Status filter
      if (selectedStatusFilter !== 'ALL') {
        const evalObj = teamEvaluations.find(e => {
          const isEmpMatch = e.employeeId === emp.id || e.employeeId === emp.employeeId;
          if (selectedCycleId !== 'ALL') {
            return isEmpMatch && e.cycleId === selectedCycleId;
          }
          return isEmpMatch;
        });

        const status = evalObj?.status || 'PendingManager';
        if (selectedStatusFilter === 'PENDING_MANAGER' && status !== 'PendingManager' && status !== 'Draft' && status !== 'Returned for Re-evaluation') return false;
        if (selectedStatusFilter === 'PENDING_SELF' && status !== 'PendingSelf') return false;
        if (selectedStatusFilter === 'PENDING_APPROVAL' && status !== 'PendingApproval' && status !== 'PendingReview') return false;
        if (selectedStatusFilter === 'APPROVED' && status !== 'Approved' && status !== 'Closed' && (status as string) !== 'Completed') return false;
      }

      return true;
    });
  }, [filteredTeamMembers, perfSearchTerm, selectedScopeFilter, selectedStatusFilter, selectedCycleId, teamEvaluations, currentEmployee, allEmployeesList]);

  // Metrics Summary
  const metrics = useMemo(() => {
    const total = filteredTeamMembers.length;
    let pendingMgr = 0;
    let pendingHigherMgr = 0;
    let pendingSelf = 0;
    let pendingAppr = 0;
    let approved = 0;
    let sumScore = 0;
    let scoreCount = 0;

    filteredTeamMembers.forEach(emp => {
      const evalObj = teamEvaluations.find(e => {
        const isEmpMatch = e.employeeId === emp.id || e.employeeId === emp.employeeId;
        if (selectedCycleId !== 'ALL') {
          return isEmpMatch && e.cycleId === selectedCycleId;
        }
        return isEmpMatch;
      });

      const isHigherLevelMgr = isUserHigherLevelManager(emp, currentEmployee, allEmployeesList);
      const isDirectMgr = isUserDirectManager(emp, currentEmployee, allEmployeesList);

      if (!evalObj || evalObj.status === 'PendingManager' || evalObj.status === 'Draft' || evalObj.status === 'Returned for Re-evaluation') {
        pendingMgr++;
      } else if (evalObj.status === 'PendingSelf') {
        pendingSelf++;
      } else if (evalObj.status === 'PendingApproval' || evalObj.status === 'PendingReview') {
        pendingAppr++;
        if (isHigherLevelMgr || isExecutiveOrAdmin) {
          pendingHigherMgr++;
        }
      } else if (evalObj.status === 'Approved' || evalObj.status === 'Closed' || (evalObj.status as string) === 'Completed') {
        approved++;
      }

      const score = evalObj?.finalPercentageScore;
      if (score !== undefined && score !== null) {
        sumScore += Number(score);
        scoreCount++;
      } else {
        const auto = autoScoreMap.get(emp.id) || autoScoreMap.get(emp.employeeId || '');
        if (auto) {
          sumScore += auto.overallScore;
          scoreCount++;
        }
      }
    });

    const avgScore = scoreCount > 0 ? Math.round(sumScore / scoreCount) : 0;

    return { total, pendingMgr, pendingHigherMgr, pendingSelf, pendingAppr, approved, avgScore };
  }, [filteredTeamMembers, teamEvaluations, selectedCycleId, autoScoreMap, currentEmployee, allEmployeesList, isExecutiveOrAdmin]);

  // Selected Employee Management Chain
  const selectedEmpDirectManager = useMemo(() => {
    return findDirectManager(selectedEvalEmp, allEmployeesList);
  }, [selectedEvalEmp, allEmployeesList]);

  const selectedEmpHigherLevelManager = useMemo(() => {
    return findHigherLevelManager(selectedEvalEmp, allEmployeesList);
  }, [selectedEvalEmp, allEmployeesList]);

  const isCurrentEmpHigherLevelManagerForSelected = useMemo(() => {
    return isUserHigherLevelManager(selectedEvalEmp, currentEmployee, allEmployeesList);
  }, [selectedEvalEmp, currentEmployee, allEmployeesList]);

  const isCurrentEmpDirectManagerForSelected = useMemo(() => {
    return isUserDirectManager(selectedEvalEmp, currentEmployee, allEmployeesList);
  }, [selectedEvalEmp, currentEmployee, allEmployeesList]);

  return (
    <div className="space-y-6" id="team-performance-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`p-4 border text-xs font-black flex items-center justify-between shadow-lg transition-all ${
          toastMessage.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-600' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{toastMessage.text}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Banner & Sync Control */}
      <div className="bg-card border-2 border-border p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-primary/10 text-primary border border-primary/20">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-black text-foreground flex items-center gap-2">
              تقييم الأداء والنمو المهني للفريق
              {currentViewCycle && (
                <span className="px-2.5 py-0.5 text-xs bg-primary/10 text-primary border border-primary/20 font-bold">
                  {currentViewCycle.nameAr || currentViewCycle.nameEn}
                </span>
              )}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              متابعة وإجراء تقييمات الأداء للمرؤوسين المباشرين، وإصدار قرارات واعتمادات الرئيس الأعلى، وربطها بنظام الذكاء العملياتي.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full lg:w-auto">
          <button
            onClick={handleSyncWorkforce}
            disabled={isSyncing}
            id="sync-team-evaluations-btn"
            className="flex-1 lg:flex-initial px-4 py-2.5 bg-primary text-primary-foreground text-xs font-black flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'جارِ المزامنة...' : 'مزامنة ونشر نماذج التقييم'}</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 bg-card border border-border space-y-1">
          <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-primary" />
            إجمالي المرؤوسين
          </span>
          <p className="text-xl font-black text-foreground">{metrics.total}</p>
        </div>

        <div className="p-4 bg-amber-500/5 border border-amber-500/20 space-y-1">
          <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            بانتظار تقييمك كمدير
          </span>
          <p className="text-xl font-black text-amber-600">{metrics.pendingMgr}</p>
        </div>

        <div className="p-4 bg-purple-500/10 border-2 border-purple-500/40 space-y-1">
          <span className="text-[11px] font-black text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            بانتظار قرارك كرئيس أعلى
          </span>
          <p className="text-xl font-black text-purple-700 dark:text-purple-300">{metrics.pendingHigherMgr}</p>
        </div>

        <div className="p-4 bg-blue-500/5 border border-blue-500/20 space-y-1">
          <span className="text-[11px] font-bold text-blue-600 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5" />
            بانتظار التقييم الذاتي
          </span>
          <p className="text-xl font-black text-blue-600">{metrics.pendingSelf}</p>
        </div>

        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 space-y-1">
          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            معتمد ومكتمل
          </span>
          <p className="text-xl font-black text-emerald-600">{metrics.approved}</p>
        </div>

        <div className="p-4 bg-primary/5 border border-primary/20 space-y-1">
          <span className="text-[11px] font-bold text-primary flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            متوسط أداء الفريق
          </span>
          <p className="text-xl font-black text-primary">{metrics.avgScore}%</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card border border-border p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Cycle Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">دورة التقييم:</span>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="px-3 py-1.5 bg-background border border-border text-xs font-bold text-foreground focus:outline-none focus:border-primary"
            >
              <option value="ALL">جميع الدورات التقييمية</option>
              {performanceCycles.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nameAr} {c.status === 'Active' ? '(الحالية - نشطة)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Scope Selector */}
          <div className="flex items-center gap-1 border-r border-border pr-2 mr-2">
            <span className="text-xs font-bold text-muted-foreground whitespace-nowrap">النطاق:</span>
            <div className="flex items-center gap-1">
              {[
                { id: 'ALL', label: 'الكل' },
                { id: 'DIRECT', label: 'مرؤوسين مباشرين' },
                { id: 'HIGHER_SUBORDINATES', label: 'إشراف الرئيس الأعلى' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedScopeFilter(s.id as any)}
                  className={`px-2.5 py-1 text-[11px] font-bold transition-all border ${
                    selectedScopeFilter === s.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter Buttons */}
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {[
              { id: 'ALL', label: 'الكل' },
              { id: 'PENDING_MANAGER', label: 'بانتظار تقييم المدير' },
              { id: 'PENDING_APPROVAL', label: 'بانتظار قرار الرئيس الأعلى' },
              { id: 'PENDING_SELF', label: 'التقييم الذاتي' },
              { id: 'APPROVED', label: 'معتمد ومكتمل' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedStatusFilter(f.id)}
                className={`px-3 py-1 text-xs font-bold transition-all border ${
                  selectedStatusFilter === f.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="بحث بالاسم أو الرقم الوظيفي..."
            value={perfSearchTerm}
            onChange={(e) => setPerfSearchTerm(e.target.value)}
            className="w-full pl-3 pr-9 py-1.5 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      {/* Grid of Team Members */}
      {filteredList.length === 0 ? (
        <div className="bg-card border-2 border-dashed border-border p-12 text-center space-y-3">
          <Award className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
          <h4 className="text-sm font-black text-foreground">لا يوجد موظفون يطابقون معايير التصفية الحالية</h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            تأكد من اختيار دورة التقييم والنطاق المناسب، أو اضغط على زر "مزامنة ونشر نماذج التقييم" لتوليد النماذج تلقائياً لأعضاء فريقك.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map(emp => {
            const evalObj = teamEvaluations.find(e => {
              const isEmpMatch = e.employeeId === emp.id || e.employeeId === emp.employeeId;
              if (selectedCycleId !== 'ALL') {
                return isEmpMatch && e.cycleId === selectedCycleId;
              }
              return isEmpMatch;
            });

            const devPlan = performanceDevelopmentPlans.find(p => p.employeeId === emp.id || p.employeeId === emp.employeeId);
            const autoScore = autoScoreMap.get(emp.id) || autoScoreMap.get(emp.employeeId || '');

            const directMgr = findDirectManager(emp, allEmployeesList);
            const higherMgr = findHigherLevelManager(emp, allEmployeesList);
            const isDirectReportOfUser = isUserDirectManager(emp, currentEmployee, allEmployeesList);
            const isHigherReportOfUser = isUserHigherLevelManager(emp, currentEmployee, allEmployeesList);

            const isApproved = evalObj?.status === 'Approved' || evalObj?.status === 'Closed' || (evalObj?.status as string) === 'Completed';
            const isPendingManager = !evalObj || evalObj.status === 'PendingManager' || evalObj.status === 'Draft' || evalObj.status === 'Returned for Re-evaluation';
            const isPendingSelf = evalObj?.status === 'PendingSelf';
            const isPendingApproval = evalObj?.status === 'PendingApproval' || evalObj?.status === 'PendingReview';

            const finalPercentage = evalObj?.finalPercentageScore ?? (evalObj as any)?.overallScore ?? null;
            const hasFinalScore = finalPercentage !== null && finalPercentage !== undefined;

            return (
              <div 
                key={emp.id} 
                className={`bg-card border p-5 space-y-4 hover:border-primary/50 transition-all flex flex-col justify-between shadow-sm relative ${
                  isPendingApproval && isHigherReportOfUser ? 'border-purple-500/50 ring-1 ring-purple-500/30' : 'border-border'
                }`}
              >
                {/* Employee Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary/10 text-primary font-black text-sm flex items-center justify-center border border-primary/20">
                        {emp.name ? emp.name.charAt(0) : 'م'}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-foreground leading-tight">{emp.name}</h4>
                        <span className="text-[11px] text-muted-foreground font-semibold block mt-0.5">
                          {emp.jobTitle} • {emp.employeeId || '---'}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-2.5 py-1 text-[10px] font-black border ${
                      isApproved 
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' 
                        : isPendingApproval 
                          ? 'bg-purple-500/10 text-purple-600 border-purple-500/30 font-black'
                          : isPendingSelf 
                            ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' 
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                    }`}>
                      {isApproved 
                        ? 'معتمد نهائياً' 
                        : isPendingApproval 
                          ? 'بانتظار قرار الرئيس الأعلى' 
                          : isPendingSelf 
                            ? 'بانتظار التقييم الذاتي' 
                            : 'بانتظار تقييم المدير'}
                    </span>
                  </div>

                  {/* Management Hierarchy Strip */}
                  <div className="p-2.5 bg-muted/40 border border-border/80 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-bold flex items-center gap-1">
                        <User className="w-3 h-3 text-blue-500" />
                        المدير المباشر (B):
                      </span>
                      <span className="font-black text-foreground">
                        {directMgr ? directMgr.name : 'غير محدد'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-purple-500" />
                        الرئيس الأعلى (C):
                      </span>
                      <span className="font-black text-foreground">
                        {higherMgr ? higherMgr.name : 'غير محدد'}
                      </span>
                    </div>

                    <div className="pt-1 border-t border-border/50 flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-semibold">علاقتك بالموظف:</span>
                      {isDirectReportOfUser ? (
                        <span className="text-[10px] font-black text-blue-600 bg-blue-500/10 px-2 py-0.5 border border-blue-500/20">
                          مرؤوسك المباشر
                        </span>
                      ) : isHigherReportOfUser ? (
                        <span className="text-[10px] font-black text-purple-600 bg-purple-500/10 px-2 py-0.5 border border-purple-500/20">
                          أنت الرئيس الأعلى له (C)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground">
                          إشراف إداري
                        </span>
                      )}
                    </div>
                  </div>

                  {/* System Live Operational Score */}
                  {autoScore && (
                    <div className="p-2.5 bg-muted/40 border border-border flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <div>
                          <span className="text-[10px] font-bold text-muted-foreground block">مؤشر التشغيل الآلي:</span>
                          <span className="text-xs font-black text-foreground">
                            {autoScore.overallScore}% ({autoScore.finalGrade.ar})
                          </span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 ${autoScore.finalGrade.badgeClass}`}>
                        {autoScore.finalGrade.gradeCode}
                      </span>
                    </div>
                  )}

                  {/* Evaluation Score Status */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-muted-foreground">النتيجة التقييمية المسجلة:</span>
                      <span className={hasFinalScore ? "text-primary font-black" : "text-muted-foreground font-medium"}>
                        {hasFinalScore ? `${finalPercentage}% (${evalObj?.finalGrade || ''})` : 'لم تعتمد النتيجة بعد'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-muted border border-border overflow-hidden">
                      <div 
                        className={`h-full transition-all ${isApproved ? 'bg-emerald-500' : isPendingApproval ? 'bg-purple-500' : 'bg-primary'}`} 
                        style={{ width: `${Math.min(100, Math.max(0, Number(finalPercentage || autoScore?.overallScore || 0)))}%` }}
                      />
                    </div>
                  </div>

                  {/* Development Plan Preview Tag */}
                  {devPlan && (
                    <div className="flex items-center justify-between text-[11px] bg-primary/5 border border-primary/20 p-2 font-bold text-primary">
                      <span className="flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5" />
                        خطة التطوير SMART:
                      </span>
                      <span>إنجاز {devPlan.progressPercentage || 0}%</span>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-border flex flex-wrap items-center gap-2">
                  {isPendingApproval && (isHigherReportOfUser || isExecutiveOrAdmin) ? (
                    <button
                      onClick={() => handleOpenEvaluationModal(emp)}
                      id={`eval-btn-${emp.id}`}
                      className="flex-1 px-3 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md hover:opacity-90 transition-all cursor-pointer animate-pulse"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>قرار واعتماد الرئيس الأعلى 🛡️</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleOpenEvaluationModal(emp)}
                      id={`eval-btn-${emp.id}`}
                      className={`flex-1 px-3 py-2 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer ${
                        isPendingManager
                          ? 'bg-amber-500 text-white hover:bg-amber-600'
                          : isApproved
                            ? 'bg-secondary text-secondary-foreground border border-border hover:bg-muted'
                            : 'bg-primary text-primary-foreground hover:opacity-90'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5 fill-current" />
                      <span>
                        {isApproved ? 'عرض استمارة التقييم' : evalObj ? 'متابعة تقييم الأداء' : 'تقييم أداء الموظف'}
                      </span>
                    </button>
                  )}

                  <button
                    onClick={() => handleOpenDevPlanModal(emp)}
                    id={`devplan-btn-${emp.id}`}
                    className="px-3 py-2 bg-secondary text-secondary-foreground border border-border text-xs font-bold hover:bg-muted flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="خطة التطوير والنمو SMART"
                  >
                    <Target className="w-3.5 h-3.5 text-primary" />
                    <span>خطة التطوير</span>
                  </button>

                  {evalObj && (
                    <button
                      onClick={() => {
                        setReportEval(evalObj);
                        setReportEmp(emp);
                        setIsReportModalOpen(true);
                      }}
                      className="p-2 text-muted-foreground hover:text-foreground border border-border hover:bg-muted cursor-pointer"
                      title="عرض التقرير المفصل"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* EVALUATION FORM & HIGHER MANAGER DECISION MODAL */}
      {/* ========================================================================= */}
      {isEvalModalOpen && selectedEvalEmp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border-2 border-border w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary border border-primary/20">
                  <Star className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    استمارة تقييم الأداء والنمو الوظيفي
                    <span className="text-xs px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 font-bold">
                      {selectedEvalEmp.name}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedEvalEmp.jobTitle} • الرقم الوظيفي: {selectedEvalEmp.employeeId || '---'} • دورة {currentViewCycle?.nameAr || 'التقييم السنوي'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsEvalModalOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground border border-border cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Hierarchy Visualizer Banner */}
              <div className="p-4 bg-muted/30 border border-border text-xs space-y-2">
                <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  التسلسل الإداري المعتمد للموظف في قاعدة البيانات:
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="px-3 py-1.5 bg-background border border-border flex items-center gap-1.5 font-bold">
                    <span className="text-muted-foreground">الموظف (A):</span>
                    <span className="text-foreground">{selectedEvalEmp.name}</span>
                  </div>
                  <CornerDownRight className="w-4 h-4 text-muted-foreground rotate-180" />
                  <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                    <span>المدير المباشر (B):</span>
                    <span>{selectedEmpDirectManager?.name || 'غير محدد'}</span>
                    {isCurrentEmpDirectManagerForSelected && (
                      <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 font-black">(أنت)</span>
                    )}
                  </div>
                  <CornerDownRight className="w-4 h-4 text-muted-foreground rotate-180" />
                  <div className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-300">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>الرئيس الأعلى (C):</span>
                    <span>{selectedEmpHigherLevelManager?.name || 'غير محدد'}</span>
                    {isCurrentEmpHigherLevelManagerForSelected && (
                      <span className="text-[10px] bg-purple-600 text-white px-1.5 py-0.2 font-black">(أنت - صاحب القرار)</span>
                    )}
                  </div>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* HIGHER LEVEL MANAGER DECISION CARD (مركز قرار واعتماد الرئيس الأعلى) */}
              {/* ========================================================================= */}
              {(selectedEval?.status === 'PendingApproval' || isCurrentEmpHigherLevelManagerForSelected || isExecutiveOrAdmin) && (
                <div className="p-5 bg-gradient-to-br from-purple-500/10 via-background to-blue-500/10 border-2 border-purple-500/40 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-black text-sm">
                      <ShieldCheck className="w-5 h-5 text-purple-600" />
                      <span>مركز قرار واعتماد الرئيس الأعلى (Higher Level Manager Decision)</span>
                    </div>
                    <span className="text-xs px-2.5 py-1 bg-purple-500/20 text-purple-700 dark:text-purple-300 font-black border border-purple-500/30">
                      {isCurrentEmpHigherLevelManagerForSelected ? 'أنت الرئيس الأعلى المعتمد' : 'صلاحية اعتماد إداري'}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    يتيح النظام للرئيس الأعلى الاختيار بين: اعتماد التقييم الآلي للتشغيل، اعتماد تقييم المدير المباشر، أو تحديد نسبة مخصصة معتمدة مباشرة.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* OPTION 1: ADOPT SYSTEM SCORE */}
                    <button
                      type="button"
                      onClick={() => setHigherManagerDecisionChoice('AdoptSystem')}
                      className={`p-3.5 border text-right transition-all flex flex-col justify-between cursor-pointer ${
                        higherManagerDecisionChoice === 'AdoptSystem'
                          ? 'bg-indigo-500/15 border-indigo-500 font-bold ring-2 ring-indigo-500 shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-xs font-black flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                          <Zap className="w-4 h-4" />
                          اعتماد تقييم النظام التلقائي
                        </span>
                        <input
                          type="radio"
                          name="higherDecisionChoice"
                          checked={higherManagerDecisionChoice === 'AdoptSystem'}
                          onChange={() => setHigherManagerDecisionChoice('AdoptSystem')}
                          className="accent-indigo-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">
                          {autoScoreMap.get(selectedEvalEmp.id)?.overallScore ?? selectedEval?.systemCalculatedScore ?? 85}%
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          اعتماد النتيجة التلقائية المحسوبة من مؤشرات التشغيل، الحضور، والمهام.
                        </p>
                      </div>
                    </button>

                    {/* OPTION 2: ADOPT DIRECT MANAGER */}
                    <button
                      type="button"
                      onClick={() => setHigherManagerDecisionChoice('AdoptManager')}
                      className={`p-3.5 border text-right transition-all flex flex-col justify-between cursor-pointer ${
                        higherManagerDecisionChoice === 'AdoptManager'
                          ? 'bg-blue-500/15 border-blue-500 font-bold ring-2 ring-blue-500 shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-xs font-black flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                          <User className="w-4 h-4" />
                          اعتماد تقييم المدير المباشر
                        </span>
                        <input
                          type="radio"
                          name="higherDecisionChoice"
                          checked={higherManagerDecisionChoice === 'AdoptManager'}
                          onChange={() => setHigherManagerDecisionChoice('AdoptManager')}
                          className="accent-blue-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">
                          {liveCalculatedScore > 0 
                            ? `${liveCalculatedScore}%` 
                            : `${selectedEval?.finalPercentageScore || 80}%`}
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          اعتماد متوسط درجات التقييم التقديرية المسجلة من المدير المباشر (B).
                        </p>
                      </div>
                    </button>

                    {/* OPTION 3: CUSTOM SCORE */}
                    <button
                      type="button"
                      onClick={() => setHigherManagerDecisionChoice('CustomScore')}
                      className={`p-3.5 border text-right transition-all flex flex-col justify-between cursor-pointer ${
                        higherManagerDecisionChoice === 'CustomScore'
                          ? 'bg-emerald-500/15 border-emerald-500 font-bold ring-2 ring-emerald-500 shadow-sm'
                          : 'bg-background border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <span className="text-xs font-black flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                          <Edit3 className="w-4 h-4" />
                          تحديد نسبة ودرجة مخصصة
                        </span>
                        <input
                          type="radio"
                          name="higherDecisionChoice"
                          checked={higherManagerDecisionChoice === 'CustomScore'}
                          onChange={() => setHigherManagerDecisionChoice('CustomScore')}
                          className="accent-emerald-600"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                          {higherManagerCustomScore}%
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                          تحديد نسبة استثنائية معتمدة ومثبتة مباشرة من الرئيس الأعلى.
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* CUSTOM SCORE INPUT WHEN SELECTED */}
                  {higherManagerDecisionChoice === 'CustomScore' && (
                    <div className="p-3 bg-background border border-border space-y-2 animate-in fade-in">
                      <label className="text-xs font-bold text-foreground block">
                        النسبة المئوية المخصصة من الرئيس الأعلى (0 - 100%):
                      </label>
                      <div className="flex items-center gap-3">
                        <input 
                          type="number" 
                          min="0" 
                          max="100" 
                          value={higherManagerCustomScore}
                          onChange={(e) => setHigherManagerCustomScore(Math.max(0, Math.min(100, Number(e.target.value))))}
                          className="w-32 text-center text-sm font-black font-mono p-2 bg-muted border border-border focus:ring-2 focus:ring-emerald-500 text-foreground"
                        />
                        <span className="text-xs font-bold text-muted-foreground">
                          التقدير المقابل:{' '}
                          <strong className="text-emerald-600 font-black">
                            {getPerformanceGrade(higherManagerCustomScore).ar} ({getPerformanceGrade(higherManagerCustomScore).gradeCode})
                          </strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* HIGHER MANAGER NOTES */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-purple-600" />
                      ملاحظات ومبررات قرار الرئيس الأعلى (تُسجل في سجل التدقيق):
                    </label>
                    <textarea 
                      value={higherManagerNotes}
                      onChange={(e) => setHigherManagerNotes(e.target.value)}
                      rows={2}
                      className="w-full text-xs p-2.5 bg-background border border-border focus:outline-none focus:border-purple-500 text-foreground"
                      placeholder="اكتب أسباب ومبررات القرار المعتمد النهائي هنا..."
                    />
                  </div>

                  {/* HIGHER MANAGER ACTION BUTTONS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button 
                      type="button"
                      disabled={isSavingEval}
                      onClick={() => handleHigherManagerDecision(higherManagerDecisionChoice)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-black py-2.5 text-xs tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>اعتماد وتثبيت النتيجة النهائية رسمياً</span>
                    </button>
                    <button 
                      type="button"
                      disabled={isSavingEval}
                      onClick={() => setIsReturnModalOpen(true)}
                      className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-black py-2.5 text-xs tracking-wide shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>إعادة التقييم للمدير المباشر مع الملاحظات</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Operational Auto-Score System Banner */}
              {autoScoreMap.get(selectedEvalEmp.id) && (
                <div className="p-4 bg-gradient-to-r from-amber-500/10 via-primary/10 to-transparent border-2 border-amber-500/30 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500 text-white">
                        <Zap className="w-5 h-5 fill-current" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-foreground flex items-center gap-2">
                          اقتراح النظام الآلي المبني على مؤشرات التشغيل الواقعية
                          <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-amber-400 font-bold">
                            درجة الأداء العملياتي: {autoScoreMap.get(selectedEvalEmp.id)?.overallScore}% ({autoScoreMap.get(selectedEvalEmp.id)?.finalGrade.ar})
                          </span>
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          تم احتساب هذه الدرجة تلقائياً بناءً على إنجاز المهام، انضباط الحضور والانصراف، المأموريات، وسجل الجزاءات.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleApplyAutoScores}
                        className="px-3.5 py-1.5 bg-amber-500 text-white text-xs font-black flex items-center justify-center gap-1.5 hover:bg-amber-600 transition-all shadow-sm cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>تطبيق درجات النظام ⚡</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAutoBreakdown(!showAutoBreakdown)}
                        className="px-3 py-1.5 bg-card border border-border text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
                      >
                        {showAutoBreakdown ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                      </button>
                    </div>
                  </div>

                  {/* Auto Breakdown Details */}
                  {showAutoBreakdown && autoScoreMap.get(selectedEvalEmp.id)?.criteriaResults && (
                    <div className="pt-3 border-t border-border/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {autoScoreMap.get(selectedEvalEmp.id)?.criteriaResults.map(res => (
                        <div key={res.criterionId} className="p-2.5 bg-background border border-border text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold">
                            <span className="text-foreground">{res.nameAr}</span>
                            <span className="text-primary font-black">{res.score}%</span>
                          </div>
                          {res.details && res.details.length > 0 && (
                            <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t border-border">
                              {res.details.map((d, i) => (
                                <div key={i} className="flex justify-between">
                                  <span>{d.labelAr}:</span>
                                  <span className="font-bold text-foreground">{d.value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Live Rating Score Indicator Header */}
              <div className="p-4 bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-muted-foreground block">النتيجة المحسوبة لتقييم المدير:</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-2xl font-black text-primary">{liveCalculatedScore}%</span>
                    <span className="text-xs px-2.5 py-0.5 bg-primary text-primary-foreground font-black">
                      {liveCalculatedGrade.ar} ({liveCalculatedGrade.gradeCode})
                    </span>
                  </div>
                </div>

                <div className="text-left text-xs text-muted-foreground">
                  <span>عدد المعايير المقيّمة: </span>
                  <span className="font-black text-foreground">{Object.keys(evalRatings).length}</span> من {performanceCriteria.length}
                </div>
              </div>

              {/* Performance Criteria Rating Matrix */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-primary" />
                  محاور ومعايير التقييم المهني (مقياس 1 - 5 نجوم)
                </h4>

                <div className="space-y-3">
                  {performanceCriteria.map(cri => {
                    const currentRating = evalRatings[cri.id] || 0;
                    return (
                      <div 
                        key={cri.id} 
                        className="p-4 bg-muted/30 border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-primary/40 transition-all"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-black text-foreground">{cri.nameAr}</h5>
                            <span className="text-[10px] px-2 py-0.5 bg-muted border border-border text-muted-foreground font-bold">
                              الوزن: {cri.weight}%
                            </span>
                          </div>
                          {cri.descriptionAr && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {cri.descriptionAr}
                            </p>
                          )}
                        </div>

                        {/* Star Rating Interactive Controls */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map(star => {
                              const isFilled = star <= currentRating;
                              return (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => setEvalRatings(prev => ({ ...prev, [cri.id]: star }))}
                                  className={`p-1.5 transition-transform hover:scale-125 focus:outline-none cursor-pointer ${
                                    isFilled ? 'text-amber-500' : 'text-muted-foreground/30 hover:text-amber-300'
                                  }`}
                                  title={`${star} من 5`}
                                >
                                  <Star className={`w-5 h-5 ${isFilled ? 'fill-current' : ''}`} />
                                </button>
                              );
                            })}
                          </div>
                          <span className="w-12 text-center text-xs font-black text-foreground">
                            {currentRating > 0 ? `${currentRating} / 5` : '---'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Qualitative Assessment Feedback */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h4 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  الملاحظات التقييمية والتوصيات الإدارية
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      نقاط القوة والإنجازات البارزة:
                    </label>
                    <textarea
                      rows={3}
                      value={evalFeedback.strengths}
                      onChange={(e) => setEvalFeedback(prev => ({ ...prev, strengths: e.target.value }))}
                      placeholder="اذكر أبرز إنجازات الموظف ونقاط تميزه المهني..."
                      className="w-full p-2.5 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      مجالات التحسين والتطوير:
                    </label>
                    <textarea
                      rows={3}
                      value={evalFeedback.improvements}
                      onChange={(e) => setEvalFeedback(prev => ({ ...prev, improvements: e.target.value }))}
                      placeholder="المهارات أو الممارسات التي تحتاج إلى تحسين..."
                      className="w-full p-2.5 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-primary" />
                      التوصيات وخطة الدعم:
                    </label>
                    <textarea
                      rows={3}
                      value={evalFeedback.recommendations}
                      onChange={(e) => setEvalFeedback(prev => ({ ...prev, recommendations: e.target.value }))}
                      placeholder="التوصيات الخاصة بالترقيات، المكافآت، أو الدورات التدريبية..."
                      className="w-full p-2.5 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsEvalModalOpen(false)}
                className="px-4 py-2 bg-card border border-border text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
              >
                إلغاء
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSavingEval}
                  onClick={() => handleSaveEvaluation('PendingManager')}
                  className="px-4 py-2 bg-secondary text-secondary-foreground border border-border text-xs font-bold hover:bg-muted flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>حفظ كمسودة</span>
                </button>

                <button
                  type="button"
                  disabled={isSavingEval}
                  onClick={() => handleSaveEvaluation('PendingApproval')}
                  className="px-5 py-2 bg-primary text-primary-foreground text-xs font-black flex items-center gap-1.5 hover:opacity-90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال للاعتماد النهائي للرئيس الأعلى</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RETURN FOR RE-EVALUATION MODAL */}
      {/* ========================================================================= */}
      {isReturnModalOpen && selectedEvalEmp && selectedEval && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border-2 border-amber-500/40 w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in">
            <div className="flex items-center gap-3 text-amber-600">
              <RotateCcw className="w-6 h-6" />
              <h3 className="text-base font-black text-foreground">
                إعادة التقييم للمدير المباشر ({selectedEmpDirectManager?.name || 'المدير المباشر'})
              </h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              يرجى كتابة سبب الإعادة والملاحظات المطلوب تعديلها أو مراجعتها من قبل المدير المباشر قبل الاعتماد النهائي:
            </p>

            <textarea 
              value={returnReasonText}
              onChange={(e) => setReturnReasonText(e.target.value)}
              rows={4}
              placeholder="اكتب أسباب الإعادة وتوجيهات التعديل هنا..."
              className="w-full text-xs p-3 bg-background border border-border focus:outline-none focus:border-amber-500 text-foreground"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="px-4 py-2 bg-card border border-border text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isSavingEval || !returnReasonText.trim()}
                onClick={() => handleHigherManagerDecision('Return')}
                className="px-4 py-2 bg-amber-600 text-white text-xs font-black flex items-center gap-1.5 hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>تأكيد الإعادة للمدير المباشر</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DEVELOPMENT PLAN MODAL (خطة التطوير SMART) */}
      {/* ========================================================================= */}
      {isDevPlanModalOpen && selectedDevPlanEmp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border-2 border-border w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary border border-primary/20">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground flex items-center gap-2">
                    خطة التطوير والنمو المهني (SMART Growth Plan)
                    <span className="text-xs px-2.5 py-0.5 bg-primary/10 text-primary border border-primary/20 font-bold">
                      {selectedDevPlanEmp.name}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    تحديد مجالات التطوير المستهدفة، الدورات التدريبية الموصى بها، والأهداف الذكية القابلة للقياس.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDevPlanModalOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground border border-border cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Progress Slider */}
              <div className="p-4 bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>نسبة تقدم تنفيذ خطة التطوير الحالية:</span>
                  <span className="text-primary font-black text-sm">{devPlanForm.progressPercentage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={devPlanForm.progressPercentage}
                  onChange={(e) => setDevPlanForm(prev => ({ ...prev, progressPercentage: Number(e.target.value) }))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              {/* Weaknesses / Focus Areas */}
              <div className="space-y-3">
                <label className="text-xs font-black text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  مجالات التحسين ونقاط التركيز المستهدفة:
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newWeakness}
                    onChange={(e) => setNewWeakness(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newWeakness.trim()) {
                        e.preventDefault();
                        setDevPlanForm(prev => ({ ...prev, weaknesses: [...prev.weaknesses, newWeakness.trim()] }));
                        setNewWeakness('');
                      }
                    }}
                    placeholder="أدخل مجال تحسين واضغط إضافة..."
                    className="flex-1 p-2 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newWeakness.trim()) {
                        setDevPlanForm(prev => ({ ...prev, weaknesses: [...prev.weaknesses, newWeakness.trim()] }));
                        setNewWeakness('');
                      }
                    }}
                    className="px-3 py-2 bg-secondary text-secondary-foreground border border-border text-xs font-bold hover:bg-muted cursor-pointer"
                  >
                    إضافة
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {devPlanForm.weaknesses.map((w, idx) => (
                    <span key={idx} className="px-2.5 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-bold flex items-center gap-1.5">
                      <span>{w}</span>
                      <button 
                        type="button" 
                        onClick={() => setDevPlanForm(prev => ({ ...prev, weaknesses: prev.weaknesses.filter((_, i) => i !== idx) }))}
                        className="text-amber-600 hover:text-amber-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Training Courses */}
              <div className="space-y-3 pt-3 border-t border-border">
                <label className="text-xs font-black text-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  الدورات التدريبية والبرامج التأهيلية المقترحة:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    placeholder="اسم الدورة التدريبية..."
                    className="p-2 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newCourseProvider}
                      onChange={(e) => setNewCourseProvider(e.target.value)}
                      placeholder="الجهة المقدمة / المنصة (اختياري)..."
                      className="flex-1 p-2 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newCourseName.trim()) {
                          setDevPlanForm(prev => ({
                            ...prev,
                            trainingCourses: [...prev.trainingCourses, { courseName: newCourseName.trim(), provider: newCourseProvider.trim() || undefined, status: 'Planned' }]
                          }));
                          setNewCourseName('');
                          setNewCourseProvider('');
                        }
                      }}
                      className="px-3 py-2 bg-primary text-primary-foreground text-xs font-black hover:opacity-90 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {devPlanForm.trainingCourses.map((c, idx) => (
                    <div key={idx} className="p-2.5 bg-muted/40 border border-border flex items-center justify-between text-xs">
                      <div>
                        <span className="font-black text-foreground">{c.courseName}</span>
                        {c.provider && <span className="text-muted-foreground mr-2 font-semibold">({c.provider})</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDevPlanForm(prev => ({
                          ...prev,
                          trainingCourses: prev.trainingCourses.filter((_, i) => i !== idx)
                        }))}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* SMART Objectives */}
              <div className="space-y-3 pt-3 border-t border-border">
                <label className="text-xs font-black text-foreground flex items-center gap-2">
                  <Target className="w-4 h-4 text-emerald-500" />
                  الأهداف الذكية القابلة للقياس (SMART Objectives):
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newObjectiveTitle}
                    onChange={(e) => setNewObjectiveTitle(e.target.value)}
                    placeholder="نص الهدف الذكي المحدد..."
                    className="p-2 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={newObjectiveDate}
                      onChange={(e) => setNewObjectiveDate(e.target.value)}
                      className="flex-1 p-2 bg-background border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newObjectiveTitle.trim()) {
                          setDevPlanForm(prev => ({
                            ...prev,
                            smartObjectives: [...prev.smartObjectives, {
                              objective: newObjectiveTitle.trim(),
                              deadline: newObjectiveDate || '',
                              progress: 0,
                              title: newObjectiveTitle.trim(),
                              targetDate: newObjectiveDate || '',
                              status: 'Pending'
                            }]
                          }));
                          setNewObjectiveTitle('');
                          setNewObjectiveDate('');
                        }
                      }}
                      className="px-3 py-2 bg-primary text-primary-foreground text-xs font-black hover:opacity-90 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {devPlanForm.smartObjectives.map((g, idx) => (
                    <div key={idx} className="p-2.5 bg-muted/40 border border-border flex items-center justify-between text-xs">
                      <div>
                        <span className="font-black text-foreground">{g.title}</span>
                        {g.targetDate && (
                          <span className="text-muted-foreground mr-2 font-semibold text-[11px]">
                            (تاريخ الاستحقاق: {g.targetDate})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDevPlanForm(prev => ({
                          ...prev,
                          smartObjectives: prev.smartObjectives.filter((_, i) => i !== idx)
                        }))}
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsDevPlanModalOpen(false)}
                className="px-4 py-2 bg-card border border-border text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={isSavingDevPlan}
                onClick={handleSaveDevPlan}
                className="px-5 py-2 bg-primary text-primary-foreground text-xs font-black flex items-center gap-1.5 hover:opacity-90 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingDevPlan ? 'جارِ الحفظ...' : 'حفظ خطة التطوير SMART'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED REPORT VIEW MODAL */}
      {/* ========================================================================= */}
      {isReportModalOpen && reportEval && reportEmp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border-2 border-border w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in duration-200">
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary border border-primary/20">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    تقرير تقييم الأداء التفصيلي
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {reportEmp.name} • {reportEmp.jobTitle}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsReportModalOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground border border-border cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              <div className="p-4 bg-muted/40 border border-border grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-muted-foreground font-bold block">الدرجة المعتمدة:</span>
                  <span className="text-lg font-black text-primary">{reportEval.finalPercentageScore || '---'}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block">المستوى المستحق:</span>
                  <span className="text-sm font-black text-foreground">{reportEval.finalGrade || '---'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block">مصدر القرار:</span>
                  <span className="font-black text-foreground">
                    {reportEval.decisionSource === 'CustomScore' ? 'نسبة مخصصة من الرئيس الأعلى' : reportEval.decisionSource === 'DirectManager' ? 'تقييم المدير المباشر' : 'تقييم النظام التلقائي'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block">تاريخ التحديث:</span>
                  <span className="font-semibold text-foreground">
                    {reportEval.updatedAt ? new Date(reportEval.updatedAt).toLocaleDateString('ar-SA') : '---'}
                  </span>
                </div>
              </div>

              {/* Higher Level Manager Notes */}
              {reportEval.higherManagerNotes && (
                <div className="p-3 bg-purple-500/5 border border-purple-500/20 space-y-1">
                  <span className="font-black text-purple-600 block flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    ملاحظات وقرار الرئيس الأعلى:
                  </span>
                  <p className="text-foreground leading-relaxed">{reportEval.higherManagerNotes}</p>
                </div>
              )}

              {/* Strengths & Improvements */}
              <div className="space-y-3">
                {reportEval.managerStrengths && (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 space-y-1">
                    <span className="font-black text-emerald-600 block">نقاط القوة والإنجازات:</span>
                    <p className="text-foreground leading-relaxed">{reportEval.managerStrengths}</p>
                  </div>
                )}
                {reportEval.managerImprovements && (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 space-y-1">
                    <span className="font-black text-amber-600 block">مجالات التحسين والتطوير:</span>
                    <p className="text-foreground leading-relaxed">{reportEval.managerImprovements}</p>
                  </div>
                )}
                {reportEval.managerRecommendations && (
                  <div className="p-3 bg-primary/5 border border-primary/20 space-y-1">
                    <span className="font-black text-primary block">التوصيات الإدارية:</span>
                    <p className="text-foreground leading-relaxed">{reportEval.managerRecommendations}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-border bg-muted/30 flex justify-end">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(false)}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-black cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
